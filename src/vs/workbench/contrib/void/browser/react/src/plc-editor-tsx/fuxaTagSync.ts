/*
 * fuxaTagSync — syncs Volt tag schema and live values directly to FUXA's
 * FuxaServer device via the project REST API and setTagValue command API.
 *
 * Architecture:
 *   - Tag schema: POST /api/project with updated devices.0.tags on every
 *     tagDatabase structural change (debounced 400ms).
 *   - Live values: POST /api/setTagValue on every logicStore update when
 *     simulation is running (throttled to ~10 Hz max).
 */

import { logicStore } from './logicStore.js';
import type { IECDataType, TagEntry } from './logicStore.js';

const FUXA_BASE = 'http://127.0.0.1:1881';
const FUXA_DEVICE_ID = '0';           // FuxaServer is always device id "0"
const FUXA_DEVICE_NAME = 'FuxaServer';
const TAG_PREFIX = `${FUXA_DEVICE_NAME}^~^`; // FUXA internal tag key format

// ── Type helpers ──────────────────────────────────────────────────────────────

function mapType(dt: IECDataType): string {
    if (dt === 'BOOL') return 'Bool';
    if (dt === 'REAL' || dt === 'LREAL') return 'Float32';
    if (dt === 'STRING' || dt === 'WSTRING') return 'String';
    return 'Int32';
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch(path: string, method = 'GET', body?: unknown): Promise<any> {
    const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(FUXA_BASE + path, opts);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`FUXA ${method} ${path} → ${res.status}: ${text}`);
    }
    return res.json().catch(() => null);
}

// ── Tag schema sync ───────────────────────────────────────────────────────────

let _schemaDebounce: ReturnType<typeof setTimeout> | null = null;
let _lastSchemaSnapshot = '';

function buildFuxaTagsMap(tags: TagEntry[]): Record<string, object> {
    const map: Record<string, object> = {};
    for (const t of tags) {
        const key = `${TAG_PREFIX}${t.name}`;
        map[key] = {
            id: t.name,
            name: t.name,
            label: t.description || t.name,
            type: mapType(t.dataType),
            address: t.name,
            memaddress: t.name,
        };
    }
    return map;
}

async function pushTagSchema(tags: TagEntry[]) {
    try {
        // GET current project
        const project = await apiFetch('/api/project');
        if (!project || !project.devices) return;

        // Find or build FuxaServer device entry
        const device = project.devices[FUXA_DEVICE_ID] || {
            id: FUXA_DEVICE_ID,
            name: FUXA_DEVICE_NAME,
            type: 'FuxaServer',
            enabled: true,
            property: { address: '127.0.0.1' },
            polling: 1000,
        };

        // Merge new tags — preserve any existing FUXA-native tags
        const existingTags: Record<string, object> = device.tags || {};
        const voltTags = buildFuxaTagsMap(tags);

        // Remove old volt_ tags that no longer exist in logicStore
        const currentVoltNames = new Set(tags.map(t => `${TAG_PREFIX}${t.name}`));
        for (const key of Object.keys(existingTags)) {
            if (key.startsWith(TAG_PREFIX) && !currentVoltNames.has(key)) {
                delete existingTags[key];
            }
        }

        device.tags = { ...existingTags, ...voltTags };
        project.devices[FUXA_DEVICE_ID] = device;

        await apiFetch('/api/project', 'POST', project);
        logicStore.addConsoleEntry('info', `[FuxaSync] Tag schema synced — ${tags.length} tags`);
    } catch (e: any) {
        // FUXA may not be ready yet — silent, will retry on next change
    }
}

function scheduleSchemaSync() {
    const tags = logicStore.state.tagDatabase;
    const snapshot = JSON.stringify(tags.map(t => ({ n: t.name, dt: t.dataType })));
    if (snapshot === _lastSchemaSnapshot) return;
    _lastSchemaSnapshot = snapshot;

    if (_schemaDebounce !== null) clearTimeout(_schemaDebounce);
    _schemaDebounce = setTimeout(() => {
        _schemaDebounce = null;
        pushTagSchema(tags).catch(() => {});
    }, 400);
}

// ── Live value push ───────────────────────────────────────────────────────────

let _lastValuePush = 0;
const VALUE_PUSH_INTERVAL_MS = 100; // max 10 Hz

function pushLiveValues() {
    const now = Date.now();
    if (now - _lastValuePush < VALUE_PUSH_INTERVAL_MS) return;
    _lastValuePush = now;

    const { tagDatabase, monitorMode } = logicStore.state;
    if (monitorMode !== 'running') return;

    const tagsPayload = tagDatabase
        .filter(t => t.liveValue !== undefined || t.forcedValue !== undefined)
        .map(t => ({
            id: `${TAG_PREFIX}${t.name}`,
            value: t.forcedValue ?? t.liveValue ?? '0',
        }));

    if (tagsPayload.length === 0) return;

    fetch(FUXA_BASE + '/api/setTagValue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: tagsPayload }),
    }).catch(() => {}); // fire-and-forget
}

// ── Entry point ───────────────────────────────────────────────────────────────

let _started = false;

export function startFuxaTagSync() {
    if (_started) return;
    _started = true;

    logicStore.subscribe(() => {
        scheduleSchemaSync();
        pushLiveValues();
    });

    // Initial schema push after FUXA has a moment to start
    setTimeout(() => scheduleSchemaSync(), 1500);
}
