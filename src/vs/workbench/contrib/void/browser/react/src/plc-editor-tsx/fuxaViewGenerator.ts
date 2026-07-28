/*
 * fuxaViewGenerator — auto-generates a FUXA HMI view for a set of tags.
 * Produces a proper FUXA view: svgcontent with <g type="..."> elements
 * + items{} GaugeSettings keyed by widget ID.
 * Uses the correct GET+POST /api/project pattern (no per-view endpoints).
 */

import { logicStore } from './logicStore.js';
import type { TagEntry } from './logicStore.js';

const FUXA_BASE = 'http://127.0.0.1:1881';
const DEVICE = 'FuxaServer';

// ── Widget role heuristics ────────────────────────────────────────────────────

type WidgetRole = 'tank' | 'motor' | 'valve' | 'pump' | 'bool_indicator' | 'number_display';

function inferRole(tag: TagEntry): WidgetRole {
    const n = tag.name.toLowerCase();
    if (/level|tank|vessel|hopper/.test(n)) return 'tank';
    if (/motor|run|speed|rpm/.test(n)) return 'motor';
    if (/valve|open|close|gate|damper/.test(n)) return 'valve';
    if (/pump/.test(n)) return 'pump';
    if (tag.dataType === 'BOOL') return 'bool_indicator';
    return 'number_display';
}

// Map role → FUXA type string and widget dimensions
interface WidgetSpec {
    type: string;   // exact FUXA type string for <g type="...">
    w: number;
    h: number;
    prefix: string; // GaugeSettings id prefix
}

const ROLE_SPEC: Record<WidgetRole, WidgetSpec> = {
    tank:           { type: 'svg-ext-proceng-tank4',      w: 110, h: 150, prefix: 'SHE_' },
    motor:          { type: 'svg-ext-proceng-motor',      w: 130, h: 110, prefix: 'SHE_' },
    valve:          { type: 'svg-ext-proceng-valvecx',    w: 110, h: 130, prefix: 'SHE_' },
    pump:           { type: 'svg-ext-proceng-pumpcentri1',w: 140, h: 120, prefix: 'SHE_' },
    bool_indicator: { type: 'svg-ext-gauge_semaphore',    w: 80,  h: 80,  prefix: 'GSE_' },
    number_display: { type: 'svg-ext-value',              w: 140, h: 60,  prefix: 'VAL_' },
};

// ── SVG geometry per role ─────────────────────────────────────────────────────
// These are the inner SVG path/rect bodies that go inside the <g> wrapper.
// FUXA applies animations by walking child elements of the <g> node.

function makeInnerSvg(role: WidgetRole, tagName: string, w: number, h: number): string {
    const short = tagName.length > 10 ? tagName.slice(0, 9) + '…' : tagName;
    switch (role) {
        case 'tank':
            return `
  <defs>
    <linearGradient id="tkg_${tagName}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#90caf9"/><stop offset="40%" stop-color="#e3f2fd"/><stop offset="100%" stop-color="#64b5f6"/>
    </linearGradient>
    <linearGradient id="tkf_${tagName}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#1565c0"/><stop offset="50%" stop-color="#1e88e5"/><stop offset="100%" stop-color="#0d47a1"/>
    </linearGradient>
    <clipPath id="tkc_${tagName}"><rect x="13" y="22" width="84" height="100" rx="4"/></clipPath>
  </defs>
  <rect x="13" y="22" width="84" height="100" rx="6" fill="url(#tkg_${tagName})" stroke="#1565c0" stroke-width="2.5"/>
  <rect x="14" y="67" width="82" height="54" clip-path="url(#tkc_${tagName})" fill="url(#tkf_${tagName})" opacity="0.92"/>
  <line x1="13" y1="45" x2="20" y2="45" stroke="#1565c0" stroke-width="1"/>
  <line x1="13" y1="67" x2="20" y2="67" stroke="#1565c0" stroke-width="1"/>
  <line x1="13" y1="89" x2="20" y2="89" stroke="#1565c0" stroke-width="1"/>
  <rect x="17" y="26" width="10" height="92" rx="3" fill="white" opacity="0.18"/>
  <ellipse cx="55" cy="22" rx="42" ry="10" fill="#bbdefb" stroke="#1565c0" stroke-width="2"/>
  <rect x="50" y="4" width="10" height="18" rx="3" fill="#90caf9" stroke="#1565c0" stroke-width="1.5"/>
  <rect x="48" y="122" width="14" height="10" rx="2" fill="#90caf9" stroke="#1565c0" stroke-width="1.5"/>
  <text x="${w/2}" y="${h-3}" text-anchor="middle" font-size="9" fill="#0d47a1" font-family="monospace" font-weight="bold">${short}</text>`;

        case 'motor':
            return `
  <defs>
    <linearGradient id="mg_${tagName}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e0e0e0"/><stop offset="50%" stop-color="#bdbdbd"/><stop offset="100%" stop-color="#9e9e9e"/>
    </linearGradient>
  </defs>
  <rect x="10" y="20" width="90" height="60" rx="10" fill="url(#mg_${tagName})" stroke="#616161" stroke-width="2"/>
  <line x1="25" y1="20" x2="25" y2="80" stroke="#9e9e9e" stroke-width="1.5"/>
  <line x1="38" y1="20" x2="38" y2="80" stroke="#9e9e9e" stroke-width="1.5"/>
  <line x1="51" y1="20" x2="51" y2="80" stroke="#9e9e9e" stroke-width="1.5"/>
  <line x1="64" y1="20" x2="64" y2="80" stroke="#9e9e9e" stroke-width="1.5"/>
  <ellipse cx="100" cy="50" rx="12" ry="30" fill="#d0d0d0" stroke="#616161" stroke-width="2"/>
  <rect x="108" y="46" width="18" height="8" rx="3" fill="#bdbdbd" stroke="#424242" stroke-width="1.5"/>
  <text x="55" y="55" text-anchor="middle" font-size="18" fill="#424242" font-weight="bold" opacity="0.5">M</text>
  <circle cx="18" cy="50" r="7" fill="#ef5350" stroke="#b71c1c" stroke-width="1.5"/>
  <text x="${w/2}" y="${h-2}" text-anchor="middle" font-size="9" fill="#212121" font-family="monospace" font-weight="bold">${short}</text>`;

        case 'valve':
            return `
  <defs>
    <linearGradient id="vg_${tagName}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffcc80"/><stop offset="50%" stop-color="#ffe0b2"/><stop offset="100%" stop-color="#ffb74d"/>
    </linearGradient>
  </defs>
  <rect x="0" y="42" width="22" height="26" rx="2" fill="#bdbdbd" stroke="#757575" stroke-width="1.5"/>
  <rect x="88" y="42" width="22" height="26" rx="2" fill="#bdbdbd" stroke="#757575" stroke-width="1.5"/>
  <polygon points="22,42 88,42 88,68 22,68" fill="#ffe0b2" stroke="#e65100" stroke-width="1.5"/>
  <polygon points="22,42 55,55 22,68" fill="url(#vg_${tagName})" stroke="#e65100" stroke-width="2"/>
  <polygon points="88,42 55,55 88,68" fill="url(#vg_${tagName})" stroke="#e65100" stroke-width="2"/>
  <rect x="51" y="10" width="8" height="32" rx="2" fill="#bdbdbd" stroke="#757575" stroke-width="1.5"/>
  <rect x="46" y="36" width="18" height="10" rx="3" fill="#9e9e9e" stroke="#616161" stroke-width="1.5"/>
  <circle cx="55" cy="8" r="14" fill="none" stroke="#424242" stroke-width="3"/>
  <circle cx="55" cy="8" r="4" fill="#616161"/>
  <circle cx="55" cy="55" r="7" fill="#ef5350" stroke="#b71c1c" stroke-width="1.5"/>
  <text x="${w/2}" y="${h-3}" text-anchor="middle" font-size="9" fill="#bf360c" font-family="monospace" font-weight="bold">${short}</text>`;

        case 'pump':
            return `
  <defs>
    <radialGradient id="pumpg_${tagName}" cx="45%" cy="45%">
      <stop offset="0%" stop-color="#e1bee7"/><stop offset="100%" stop-color="#9c27b0"/>
    </radialGradient>
    <linearGradient id="pumpmg_${tagName}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e0e0e0"/><stop offset="100%" stop-color="#9e9e9e"/>
    </linearGradient>
  </defs>
  <rect x="57" y="0" width="16" height="22" rx="2" fill="#ce93d8" stroke="#6a1b9a" stroke-width="1.5"/>
  <rect x="0" y="47" width="20" height="16" rx="2" fill="#ce93d8" stroke="#6a1b9a" stroke-width="1.5"/>
  <ellipse cx="55" cy="58" rx="35" ry="35" fill="url(#pumpg_${tagName})" stroke="#6a1b9a" stroke-width="2.5"/>
  <line x1="55" y1="35" x2="55" y2="81" stroke="#7b1fa2" stroke-width="2" opacity="0.7"/>
  <line x1="32" y1="45" x2="78" y2="71" stroke="#7b1fa2" stroke-width="2" opacity="0.7"/>
  <line x1="32" y1="71" x2="78" y2="45" stroke="#7b1fa2" stroke-width="2" opacity="0.7"/>
  <circle cx="55" cy="58" r="8" fill="#4a148c" stroke="#7b1fa2" stroke-width="1.5"/>
  <rect x="98" y="44" width="38" height="28" rx="6" fill="url(#pumpmg_${tagName})" stroke="#616161" stroke-width="2"/>
  <text x="117" y="61" text-anchor="middle" font-size="10" fill="#424242" font-weight="bold" opacity="0.6">M</text>
  <circle cx="100" cy="48" r="6" fill="#ef5350" stroke="#b71c1c" stroke-width="1.5"/>
  <text x="${w/2}" y="${h-2}" text-anchor="middle" font-size="9" fill="#4a148c" font-family="monospace" font-weight="bold">${short}</text>`;

        case 'bool_indicator':
            return `
  <defs>
    <radialGradient id="ledg_${tagName}" cx="38%" cy="38%">
      <stop offset="0%" stop-color="#ef9a9a"/><stop offset="100%" stop-color="#c62828"/>
    </radialGradient>
  </defs>
  <rect x="3" y="3" width="74" height="74" rx="8" fill="#eeeeee" stroke="#bdbdbd" stroke-width="2"/>
  <circle cx="40" cy="35" r="22" fill="#bdbdbd" stroke="#9e9e9e" stroke-width="1.5"/>
  <circle cx="40" cy="35" r="15" fill="url(#ledg_${tagName})"/>
  <ellipse cx="33" cy="28" rx="5" ry="3" fill="white" opacity="0.4" transform="rotate(-20 33 28)"/>
  <text x="40" y="${h-3}" text-anchor="middle" font-size="8" fill="#212121" font-family="monospace" font-weight="bold">${short}</text>`;

        default: // number_display
            return `
  <defs>
    <linearGradient id="dspg_${tagName}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e8eaf6"/><stop offset="100%" stop-color="#c5cae9"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="${w-4}" height="${h-4}" rx="8" fill="url(#dspg_${tagName})" stroke="#3949ab" stroke-width="2.5"/>
  <rect x="8" y="8" width="${w-16}" height="${h-20}" rx="5" fill="#1a237e" stroke="#3949ab" stroke-width="1.5"/>
  <rect x="12" y="12" width="${w-24}" height="${h-32}" rx="3" fill="#0d1b0d"/>
  <text x="${w/2}" y="${Math.floor(h/2)+6}" text-anchor="middle" font-size="20" fill="#00e676" font-family="'Courier New',monospace" font-weight="bold" letter-spacing="2">0.00</text>
  <text x="${w/2}" y="${h-4}" text-anchor="middle" font-size="8" fill="#9fa8da" font-family="monospace" font-weight="bold">${short}</text>`;
    }
}

// ── GaugeSettings builder ─────────────────────────────────────────────────────

function buildGaugeSettings(tag: TagEntry, widgetId: string, role: WidgetRole): object {
    const spec = ROLE_SPEC[role];
    const variableId = `${DEVICE}^~^${tag.name}`;

    // Base property
    const property: Record<string, unknown> = {
        variableId,
        variableSrc: DEVICE,
        variable: tag.name,
        alarmId: '', alarmSrc: '', alarm: '', alarmColor: '',
        ranges: [],
        actions: [],
        events: [],
        options: {},
    };

    // Role-specific bindings
    if (role === 'bool_indicator') {
        property.ranges = [
            { type: 'range', min: '1', max: '1', color: '#00b050ff', stroke: '' },
            { type: 'range', min: '0', max: '0', color: '#d8d8d8ff', stroke: '' },
        ];
    } else if (role === 'motor' || role === 'pump') {
        property.actions = [
            { variableId, variableSrc: DEVICE, variable: tag.name,
              range: { min: '1', max: '1' }, type: 'clockwise', options: {} },
            { variableId, variableSrc: DEVICE, variable: tag.name,
              range: { min: '0', max: '0' }, type: 'stop', options: {} },
        ];
        property.ranges = [
            { type: 'range', min: '1', max: '1', color: '#00b050ff', stroke: '' },
            { type: 'range', min: '0', max: '0', color: '#9e9e9eff', stroke: '' },
        ];
    } else if (role === 'valve') {
        property.ranges = [
            { type: 'range', min: '1', max: '1', color: '#00b050ff', stroke: '' },
            { type: 'range', min: '0', max: '0', color: '#d8d8d8ff', stroke: '' },
        ];
    }

    return {
        id: widgetId,
        type: spec.type,
        name: tag.name,
        label: tag.description || tag.name,
        property,
    };
}

// ── Main API ──────────────────────────────────────────────────────────────────

async function apiFetch(path: string, method = 'GET', body?: unknown) {
    const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(FUXA_BASE + path, opts);
    if (!res.ok) throw new Error(`FUXA ${method} ${path} → ${res.status}`);
    return res.json().catch(() => null);
}

export async function generateFuxaViewForPOU(pouName: string, tags: TagEntry[]) {
    if (!tags.length) return;

    const MAX_COLS = 5;
    const CELL_W = 200;
    const CELL_H = 200;
    const MARGIN_X = 40;
    const MARGIN_Y = 80;

    // Build widget layout
    const widgets: Array<{
        id: string; widgetId: string; role: WidgetRole;
        spec: WidgetSpec; tag: TagEntry; x: number; y: number;
    }> = [];

    let col = 0, row = 0;
    for (const tag of tags) {
        const role = inferRole(tag);
        const spec = ROLE_SPEC[role];
        const x = MARGIN_X + col * CELL_W;
        const y = MARGIN_Y + row * CELL_H;
        const widgetId = `${spec.prefix}widget_${tag.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        widgets.push({ id: `g_${tag.name}`, widgetId, role, spec, tag, x, y });
        col++;
        if (col >= MAX_COLS) { col = 0; row++; }
    }

    const canvasW = Math.max(1200, (Math.min(tags.length, MAX_COLS)) * CELL_W + MARGIN_X * 2);
    const canvasH = Math.max(800, (row + 1) * CELL_H + MARGIN_Y * 2);

    // Build svgcontent — each widget is a <g id="WIDGET_ID" type="FUXA_TYPE"> element
    // positioned with a transform. FUXA reads type, id, and transform to render components.
    const gElements = widgets.map(w => {
        const inner = makeInnerSvg(w.role, w.tag.name, w.spec.w, w.spec.h);
        return `<g id="${w.widgetId}" transform="translate(${w.x},${w.y})" type="${w.spec.type}" name="${w.tag.name}" width="${w.spec.w}" height="${w.spec.h}">\n${inner}\n</g>`;
    });
    const svgcontent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvasW}" height="${canvasH}">\n${gElements.join('\n')}\n</svg>`;

    // Build items{} — keyed by widget id, each value is a GaugeSettings object
    const items: Record<string, object> = {};
    for (const w of widgets) {
        items[w.widgetId] = buildGaugeSettings(w.tag, w.widgetId, w.role);
    }

    const viewId = `view_${pouName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    const view = {
        id: viewId,
        name: pouName,
        type: 'svg',
        profile: { width: canvasW, height: canvasH, bkcolor: '#ffffff', margin: '0' },
        svgcontent,
        items,
    };

    try {
        // Correct FUXA pattern: GET full project, merge view, POST full project
        const project = await apiFetch('/api/project');
        if (!project?.hmi) throw new Error('Unexpected project structure from FUXA');

        // Patch bkcolor on all existing views (white background)
        if (Array.isArray(project.hmi.views)) {
            for (const v of project.hmi.views) {
                if (v.profile?.bkcolor) v.profile.bkcolor = '#ffffff';
            }
            // Replace or insert our view
            const idx = project.hmi.views.findIndex((v: any) => v.id === viewId);
            if (idx >= 0) project.hmi.views[idx] = view;
            else project.hmi.views.push(view);
        } else {
            project.hmi.views = [view];
        }

        // Inject tag entries into devices["0"] so plaxio_set_tag_value can find them
        const devices = project.devices ?? {};
        const fuxaDevice = Object.values(devices).find((d: any) => d.name === DEVICE || d.id === DEVICE) as any;
        if (fuxaDevice) {
            if (!fuxaDevice.tags) fuxaDevice.tags = {};
            for (const w of widgets) {
                const key = `${DEVICE}^~^${w.tag.name}`;
                if (!fuxaDevice.tags[key]) {
                    fuxaDevice.tags[key] = {
                        id: w.tag.name,
                        name: w.tag.name,
                        type: w.tag.dataType,
                        address: `${DEVICE}^~^${w.tag.name}`,
                        value: 0,
                    };
                }
            }
        }

        await apiFetch('/api/project', 'POST', project);
        logicStore.addConsoleEntry('success',
            `[FuxaView] Generated HMI view "${pouName}" — ${widgets.length} widget(s) on ${canvasW}×${canvasH} canvas`);
    } catch (e: any) {
        logicStore.addConsoleEntry('warn', `[FuxaView] Could not save view to FUXA: ${e.message}`);
    }
}

// Auto-generate view from current tagDatabase whenever called
export async function generateFuxaViewFromCurrentTags(pouName = 'main') {
    const tags = logicStore.state.tagDatabase;
    return generateFuxaViewForPOU(pouName, tags);
}
