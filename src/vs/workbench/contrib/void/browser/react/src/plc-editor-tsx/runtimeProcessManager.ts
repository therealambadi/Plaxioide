/*
 * Runtime Process Manager
 * Owns the lifecycle of all PLC backend components:
 *   1. MatIEC (iec2c)          — native child process, ST → C validation
 *   2. STruC++ codegen         — in-process Node.js module, ST → C++ + debug-map
 *   3. OpenPLC Runtime v4      — Docker container (macOS), native process (Linux)
 *
 * Binary protocol bug note (confirmed from debug_handler.c source):
 *   - GET_LIST request uses BIG-ENDIAN count and 3-byte entries [arr, elem_hi, elem_lo]
 *   - The volt.diy openplcClient.ts uses little-endian 2-byte entries — DO NOT copy that
 *   - Correct builder: buildGetListCommand() below
 *
 * Debug-map path format (confirmed from real STruC++ output):
 *   "INST0.<UPPERCASE_VARNAME>" — use resolveTagDebugLeaf() from clmToST.ts
 *
 * First-run note:
 *   OpenPLC v4 starts with an empty user DB. Must POST /api/create-user on first launch.
 */

/* eslint-disable @typescript-eslint/no-var-requires */

import type { CLMGraph } from './clm/graph.js';
import { clmToST, buildTagIndexMap } from './clm/clmToST.js';
import type { DebugMap } from './clm/clmToST.js';
import { runtimeStore } from './runtimeStore.js';
import { logicStore } from './logicStore.js';
import type { IECDataType } from './logicStore.js';
import * as ipcService from '../../../runtimeProcessManagerService.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const OPENPLC_BASE_URL = 'https://localhost:8443';
const OPENPLC_PORT = 8443;
const COMPILE_POLL_INTERVAL_MS = 500;
const COMPILE_TIMEOUT_MS = 120_000;
const DEBUG_POLL_INTERVAL_MS = 500;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2000;

// ─── IEC type → debug type mapping ───────────────────────────────────────────

type DebugTagType = 'BOOL' | 'INT' | 'DINT' | 'REAL' | 'WORD';

function iecToDebugType(dt: IECDataType): DebugTagType {
  switch (dt) {
    case 'BOOL': return 'BOOL';
    case 'INT': case 'UINT': return 'INT';
    case 'DINT': case 'UDINT': return 'DINT';
    case 'REAL': case 'LREAL': return 'REAL';
    case 'WORD': case 'BYTE': case 'DWORD': return 'WORD';
    default: return 'INT';
  }
}

// ─── Binary protocol helpers (CORRECT — confirmed from debug_handler.c) ──────

function be16(n: number): number[] {
  return [(n >> 8) & 0xff, n & 0xff];
}

function le16(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff];
}

function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join(' ');
}

function hexToBytes(hex: string): number[] {
  return hex.trim().split(/\s+/).filter(Boolean).map(h => parseInt(h, 16));
}

/**
 * Build FC 0x44 GET_LIST command.
 * Format per debug_handler.c: [0x44, count_hi, count_lo, arr(1B), elem_hi, elem_lo, ...]
 * arrayIdx is 0 for the single flat array in all our generated programs.
 */
function buildGetListCommand(arrayIdx: number, elemIndexes: number[]): string {
  return bytesToHex([
    0x44,
    ...be16(elemIndexes.length),
    ...elemIndexes.flatMap(e => [arrayIdx, ...be16(e)]),
  ]);
}

/**
 * Build FC 0x42 DEBUG_SET command (force a variable value).
 * Format: [0x42, arr(1B), elem_hi, elem_lo, type_byte, value_bytes...]
 */
function buildForceCommand(arrayIdx: number, elemIdx: number, type: DebugTagType, value: boolean | number): string {
  const bytes: number[] = [0x42, arrayIdx, ...be16(elemIdx)];
  switch (type) {
    case 'BOOL':
      bytes.push(0x00, value ? 0x01 : 0x00);
      break;
    case 'INT':
    case 'WORD': {
      const v = Number(value) & 0xffff;
      bytes.push(0x01, ...le16(v));
      break;
    }
    case 'DINT': {
      const v = Number(value) >>> 0;
      bytes.push(0x02, v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff);
      break;
    }
    case 'REAL': {
      const buf = new ArrayBuffer(4);
      new DataView(buf).setFloat32(0, Number(value), true);
      const arr = new Uint8Array(buf);
      bytes.push(0x03, arr[0], arr[1], arr[2], arr[3]);
      break;
    }
  }
  return bytesToHex(bytes);
}

/**
 * Parse FC 0x44 GET_LIST response.
 * Response header (10 bytes):
 *   [0] = 0x44 (opcode echo)
 *   [1] = 0x7E (SUCCESS) or 0x81 (error)
 *   [2..3] = last_req_idx (big-endian uint16)
 *   [4..7] = scan_counter (big-endian uint32)
 *   [8..9] = response_sz (big-endian uint16)
 *   [10..] = variable data (from ext_strucpp_debug_read)
 *
 * Variable data format per debug_table.hpp — each entry:
 *   [type_byte, value_bytes...] where type matches IEC_STDLIB typeTags
 */
function parseGetListResponse(hex: string, tagIndexMap: Map<string, number>): Record<string, boolean | number> {
  const bytes = hexToBytes(hex);
  const result: Record<string, boolean | number> = {};

  if (bytes.length < 10 || bytes[1] !== 0x7e) return result;

  const responseSz = (bytes[8] << 8) | bytes[9];
  if (responseSz === 0) return result;

  // Build reverse map: elemIdx → tagName
  const indexToName = new Map<number, string>();
  for (const [name, idx] of tagIndexMap) {
    indexToName.set(idx, name);
  }

  // Variable data starts at offset 10; format is [type_tag, ...value_bytes]
  // The entries are in the order they were requested (elemIdx order)
  let i = 10;
  let entryIdx = 0;
  while (i < bytes.length) {
    const typeByte = bytes[i];
    i++;

    const tagName = indexToName.get(entryIdx);

    switch (typeByte) {
      case 0x00: { // BOOL — 1 byte
        if (i >= bytes.length) break;
        if (tagName) result[tagName] = bytes[i] !== 0;
        i++;
        entryIdx++;
        break;
      }
      case 0x01: // INT — 2 bytes LE
      case 0x04: { // WORD — 2 bytes LE
        if (i + 2 > bytes.length) break;
        if (tagName) result[tagName] = bytes[i] | (bytes[i + 1] << 8);
        i += 2;
        entryIdx++;
        break;
      }
      case 0x02: { // DINT — 4 bytes LE
        if (i + 4 > bytes.length) break;
        if (tagName) result[tagName] = (bytes[i] | (bytes[i+1]<<8) | (bytes[i+2]<<16) | (bytes[i+3]<<24)) | 0;
        i += 4;
        entryIdx++;
        break;
      }
      case 0x03: { // REAL — 4 bytes LE float
        if (i + 4 > bytes.length) break;
        const raw = (bytes[i+3]<<24 | bytes[i+2]<<16 | bytes[i+1]<<8 | bytes[i]) >>> 0;
        const buf = new ArrayBuffer(4);
        new DataView(buf).setUint32(0, raw, false);
        if (tagName) result[tagName] = new DataView(buf).getFloat32(0, false);
        i += 4;
        entryIdx++;
        break;
      }
      default:
        // Unknown type — stop parsing
        i = bytes.length;
    }
  }

  return result;
}

// ─── HTTPS fetch with self-signed cert bypass ─────────────────────────────────
// Routes through IPC to the main process (Node.js) so self-signed cert is bypassed.

async function plcFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${OPENPLC_BASE_URL}${path}`;
  const method = (init.method as string) || 'GET';
  const headers = init.headers as Record<string, string> | undefined;
  const body = init.body as string | undefined;
  const result = await ipcService.plcFetch(url, method, headers, body);
  return new Response(result.body, {
    status: result.status,
    headers: { 'content-type': 'application/json' },
  });
}

// ─── Runtime Process Manager ──────────────────────────────────────────────────

class RuntimeProcessManager {
  private token: string | null = null;
  private socket: any = null;  // Socket.IO socket instance
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private _isRunning = false;
  private currentDebugMap: DebugMap | null = null;
  private tagIndexMap = new Map<string, number>();  // tagName → elemIdx
  private tagTypes = new Map<string, DebugTagType>(); // tagName → type
  private debugArrayIdx = 0; // always 0 for our programs
  private _projectPath: string | null = null;

  /** Set by the VS Code layer before calling runProgram. */
  setProjectPath(p: string): void { this._projectPath = p; }

  get isRunning(): boolean { return this._isRunning; }

  // ─── Full pipeline: CLM → run PLC ─────────────────────────────────────────

  async runProgram(clm: CLMGraph, programName = 'program', cycleMs = 50): Promise<void> {
    runtimeStore.clearLog();
    runtimeStore.appendLog('info', 'Starting compilation pipeline...');

    // Step 1: MatIEC validation
    const stResult = clmToST(clm, cycleMs);
    console.error('[clmToST] Generated ST code:\n' + stResult.stCode);
    runtimeStore.appendLog('info', `Generated ST: ${stResult.tagCount} tags, ${stResult.rungCount} rungs`);
    if (stResult.warnings.length > 0) {
      stResult.warnings.forEach(w => runtimeStore.appendLog('warn', w));
    }

    runtimeStore.setMatiecStatus('starting', 'Validating...');
    const matiecResult = await this._validateWithMatIEC(stResult.stCode);
    if (!matiecResult.success) {
      runtimeStore.setMatiecStatus('error', undefined, matiecResult.errors.join('\n'));
      matiecResult.errors.forEach(e => runtimeStore.appendLog('error', `MatIEC: ${e}`));
      throw new Error(`MatIEC validation failed: ${matiecResult.errors.join('; ')}`);
    }
    runtimeStore.setMatiecStatus('running', `PASS (${matiecResult.errors.length} errors)`);
    runtimeStore.appendLog('success', 'MatIEC: PASS');

    // Step 2: STruC++ codegen (in-process)
    runtimeStore.setStrucppStatus('starting', 'Compiling...');
    const { zipBase64, debugMap, errors } = await this._compileWithStrucpp(
      stResult.stCodeForStrucpp, programName, cycleMs
    );
    if (!zipBase64) {
      runtimeStore.setStrucppStatus('error', undefined);
      errors.forEach(e => runtimeStore.appendLog('error', `STruC++: ${e}`));
      throw new Error(`STruC++ compilation failed`);
    }
    const leafCount = debugMap.leaves?.length ?? 0;
    runtimeStore.setStrucppStatus('running', `${leafCount} variables`);
    runtimeStore.appendLog('success', `STruC++: compiled ${leafCount} variables`);
    this.currentDebugMap = debugMap;

    // Build tag index map for debug stream
    this.tagIndexMap = buildTagIndexMap(debugMap);
    this.tagTypes.clear();
    for (const tag of logicStore.getState().tagDatabase) {
      this.tagTypes.set(tag.name, iecToDebugType(tag.dataType));
    }

    // Step 3: Ensure OpenPLC Runtime is running
    runtimeStore.appendLog('info', 'Step 3/5: Checking PLC webserver...');
    await this._ensureOpenPLCRunning();

    // Step 4: Upload and compile
    runtimeStore.appendLog('info', `Step 4/5: Logging in to OpenPLC...`);
    await this._loginOpenPLC();
    runtimeStore.appendLog('success', 'Logged in to OpenPLC');
    // Base64 length → approximate byte size
    const approxKb = ((zipBase64.length * 3) / 4 / 1024).toFixed(1);
    runtimeStore.appendLog('info', `Uploading program.zip (~${approxKb} KB)...`);
    await this._uploadZip(zipBase64, programName);
    runtimeStore.appendLog('success', 'Upload complete — waiting for g++ compile...');
    const compileResult = await this._waitForCompilation();
    if (compileResult.status !== 'SUCCESS') {
      const logs = compileResult.logs.slice(-10).join('\n');
      runtimeStore.appendLog('error', `g++ compile failed:\n${logs}`);
      throw new Error(`OpenPLC compilation failed`);
    }
    runtimeStore.appendLog('success', 'g++ compile: SUCCESS');

    // Step 5: Start PLC + debug stream
    runtimeStore.appendLog('info', 'Step 5/5: Starting PLC...');
    await this._startPLC();
    this._isRunning = true;
    this.reconnectAttempts = 0;
    runtimeStore.appendLog('success', `PLC running at ${cycleMs}ms cycle`);
    // Start main-process debug poller (TAG_FRAME events pushed via IPC)
    runtimeStore.appendLog('info', 'Connecting debug stream...');
    try {
      const pollerResult = await ipcService.plcStartDebugPoller();
      if (pollerResult.ok) {
        runtimeStore.appendLog('success', 'Debug stream connected');
      } else {
        runtimeStore.appendLog('warn', `Debug poller: ${pollerResult.error ?? 'failed'}`);
      }
    } catch (e: any) {
      runtimeStore.appendLog('warn', `Debug poller error: ${e?.message ?? String(e)}`);
    }
    runtimeStore.setPlcRunning(true, this.tagIndexMap.size);
  }

  async stopProgram(): Promise<void> {
    this._isRunning = false;
    this._stopDebugStream();
    if (this._projectPath) {
      try {
        await ipcService.plcStop();
      } catch { /* best-effort */ }
    } else {
      try {
        await this._loginOpenPLC();
        await plcFetch('/api/stop-plc', { headers: this._authHeaders() });
      } catch { /* best-effort */ }
    }
    runtimeStore.setPlcRunning(false);
    runtimeStore.appendLog('info', 'PLC stopped');
  }

  // ─── MatIEC validation ────────────────────────────────────────────────────

  private async _validateWithMatIEC(stCode: string): Promise<{ success: boolean; errors: string[] }> {
    return ipcService.plcCompileMatiec(stCode);
  }

  // ─── STruC++ in-process codegen ───────────────────────────────────────────

  private async _compileWithStrucpp(
    stCodeForStrucpp: string,
    programName: string,
    _cycleMs: number,
  ): Promise<{ zipBase64: string | null; debugMap: DebugMap; errors: string[] }> {
    const result = await ipcService.plcCompileStrucpp(stCodeForStrucpp, programName);
    if (result.errors?.length > 0 || !result.zipBase64) {
      return { zipBase64: null, debugMap: {} as DebugMap, errors: result.errors ?? ['strucpp failed'] };
    }
    const debugMap: DebugMap = result.debugMapJson ? JSON.parse(result.debugMapJson) : {} as DebugMap;
    return { zipBase64: result.zipBase64, debugMap, errors: [] };
  }

  // ─── OpenPLC Runtime management ───────────────────────────────────────────

  private async _ensureOpenPLCRunning(): Promise<void> {
    runtimeStore.setOpenPLCStatus('starting', 'Checking...');

    // Check if already responding
    try {
      const r = await plcFetch('/api/version', { signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        runtimeStore.setOpenPLCStatus('running', `Port ${OPENPLC_PORT}`);
        runtimeStore.appendLog('success', `PLC webserver already running on port ${OPENPLC_PORT}`);
        return;
      }
    } catch { /* not up yet */ }

    // Start via Electron-main IPC (spawns the webserver child process)
    if (this._projectPath) {
      runtimeStore.appendLog('info', 'PLC webserver not running — starting it...');
      const result = await ipcService.plcStart(this._projectPath);
      if (!result.ok) {
        runtimeStore.setOpenPLCStatus('error', undefined, result.error ?? 'plc:start failed');
        runtimeStore.appendLog('error', `Webserver start failed: ${result.error}`);
        throw new Error(result.error ?? 'plc:start failed');
      }
      // plcStart waits until the webserver is ready — check it is actually up
      try {
        const r = await plcFetch('/api/version', { signal: AbortSignal.timeout(5000) });
        if (r.ok) {
          runtimeStore.setOpenPLCStatus('running', `Port ${OPENPLC_PORT}`);
          runtimeStore.appendLog('success', 'PLC webserver ready');
          return;
        }
      } catch {}
      runtimeStore.setOpenPLCStatus('error', undefined, 'Webserver started but not responding');
      runtimeStore.appendLog('error', 'Webserver process started but /api/version not responding');
      throw new Error('Webserver started but /api/version not responding');
    }

    // No project path set — cannot start native runtime
    const msg = 'No workspace folder open. Open a folder containing your PLC project to run the simulator.';
    runtimeStore.setOpenPLCStatus('error', undefined, msg);
    runtimeStore.appendLog('error', msg);
    throw new Error(msg);
  }

  // ─── OpenPLC REST API ─────────────────────────────────────────────────────

  private async _loginOpenPLC(): Promise<void> {
    // Delegate auth to main process — it owns the credentials (volt-internal + encrypted password)
    const result = await ipcService.plcGetToken();
    if (!result.ok || !result.token) {
      throw new Error(`OpenPLC login failed: ${result.error ?? 'no token returned'}`);
    }
    this.token = result.token;
    runtimeStore.appendLog('success', 'Auth token obtained');
  }

  private _authHeaders(): Record<string, string> {
    return { 'Authorization': `Bearer ${this.token ?? ''}` };
  }

  private async _uploadZip(zipBase64: string, programName: string): Promise<void> {
    const result = await ipcService.plcUploadZip(zipBase64, `${programName}.zip`, this.token ?? '');
    if (!result.ok) throw new Error(`Upload failed (${result.status}): ${result.body}`);
    let data: { UploadFileFail?: string } = {};
    try { data = JSON.parse(result.body); } catch {}
    if (data.UploadFileFail) throw new Error(`Upload rejected: ${data.UploadFileFail}`);
  }

  private async _waitForCompilation(): Promise<{ status: string; logs: string[] }> {
    const deadline = Date.now() + COMPILE_TIMEOUT_MS;
    let lastStatus = '';
    while (Date.now() < deadline) {
      const r = await plcFetch('/api/compilation-status', { headers: this._authHeaders() });
      if (!r.ok) throw new Error(`Compilation status check failed (${r.status})`);
      const data = await r.json() as { status: string; logs: string[]; exit_code: number | null };
      if (data.status !== lastStatus) {
        runtimeStore.appendLog('info', `g++ status: ${data.status}`);
        lastStatus = data.status;
      }
      if (data.status === 'SUCCESS' || data.status === 'FAILED') return data;
      await new Promise<void>(res => setTimeout(res, COMPILE_POLL_INTERVAL_MS));
    }
    throw new Error(`Compilation timed out after ${COMPILE_TIMEOUT_MS}ms`);
  }

  private async _startPLC(): Promise<void> {
    const r = await plcFetch('/api/start-plc', { method: 'GET', headers: this._authHeaders() });
    if (!r.ok) throw new Error(`Failed to start PLC (${r.status})`);
    runtimeStore.appendLog('success', 'PLC start command sent');
  }

  // ─── Socket.IO debug stream ───────────────────────────────────────────────

  private _connectDebugStream(): void {
    this._stopDebugStream();
    if (!this.token || this.tagIndexMap.size === 0) return;

    let SocketIO: any;
    try {
      // Try packaged dependency first, then dev location
      try { SocketIO = require('socket.io-client').io; } catch {}
      if (!SocketIO) {
        const path = require('path');
        SocketIO = require(path.join(__dirname, '../../../../../../../../../../../../volt.diy/node_modules/socket.io-client')).io;
      }
    } catch (e) {
      runtimeStore.appendLog('error', `socket.io-client not found: ${(e as Error).message}`);
      return;
    }

    this.socket = SocketIO(`${OPENPLC_BASE_URL}/api/debug`, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token: this.token },
      rejectUnauthorized: false,
      reconnection: false,
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      const tagCount = this.tagIndexMap.size;
      runtimeStore.setPlcRunning(true, tagCount);
      runtimeStore.appendLog('success', `Debug stream connected — monitoring ${tagCount} variables`);
      this._startPolling();
    });

    this.socket.on('debug_response', (data: { success: boolean; data?: string; error?: string }) => {
      if (!data.success || !data.data) return;
      try {
        const tagValues = parseGetListResponse(data.data, this.tagIndexMap);
        // Push live values into logicStore
        for (const [tagName, value] of Object.entries(tagValues)) {
          logicStore.updateTagLiveValue(tagName, String(value));
        }
      } catch { /* malformed frame — skip */ }
    });

    this.socket.on('connect_error', () => {
      this._scheduleReconnect();
    });

    this.socket.on('disconnect', () => {
      this._stopPolling();
      this._scheduleReconnect();
    });
  }

  private _startPolling(): void {
    this._stopPolling();
    if (this.tagIndexMap.size === 0) return;
    const elemIndexes = Array.from(this.tagIndexMap.values());
    const cmd = buildGetListCommand(this.debugArrayIdx, elemIndexes);

    this.pollTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('debug_command', { command: cmd });
      }
    }, DEBUG_POLL_INTERVAL_MS);
  }

  private _stopPolling(): void {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  }

  private _stopDebugStream(): void {
    this._stopPolling();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    runtimeStore.setPlcRunning(false);
  }

  private _scheduleReconnect(): void {
    if (!this._isRunning) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      runtimeStore.appendLog('error', 'Debug stream: max reconnect attempts reached');
      runtimeStore.setOpenPLCStatus('error', undefined, 'Debug stream disconnected');
      return;
    }
    this.reconnectAttempts++;
    const delay = RECONNECT_DELAY_MS * this.reconnectAttempts;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this._isRunning) this._connectDebugStream();
    }, delay);
  }

  // ─── Force / release tag ─────────────────────────────────────────────────

  forceTag(tagName: string, value: boolean | number): void {
    const elemIdx = this.tagIndexMap.get(tagName);
    const tagType = this.tagTypes.get(tagName);
    if (elemIdx === undefined || !tagType || !this.socket?.connected) return;

    const cmd = buildForceCommand(this.debugArrayIdx, elemIdx, tagType, value);
    this.socket.emit('debug_command', { command: cmd });
  }

  releaseTag(tagName: string): void {
    const tagType = this.tagTypes.get(tagName);
    this.forceTag(tagName, tagType === 'BOOL' ? false : 0);
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  destroy(): void {
    this._isRunning = false;
    this._stopDebugStream();
  }
}

// Singleton
export const runtimeProcessManager = new RuntimeProcessManager();
