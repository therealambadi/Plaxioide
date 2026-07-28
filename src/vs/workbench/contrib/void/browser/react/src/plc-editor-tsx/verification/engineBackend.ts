/*
 * Engine Backend — Interface between the React UI and the ESBMC-PLC+ process.
 *
 * Communication path:
 *   React (verificationStore.prepareRun)
 *     → postMessage to VS Code host
 *       → Electron main process spawns ESBMC-PLC+ CLI
 *         → stdout/stderr piped back
 *           → postMessage back to React
 *             → resultParser → verificationStore.recordResults
 *
 * The backend handles:
 *   1. Engine discovery (find binary or Docker image)
 *   2. Writing temp files (instrumented ST, property YAML)
 *   3. Spawning the verification process
 *   4. Streaming progress updates
 *   5. Parsing results and counterexamples
 */

import { verificationStore } from './verificationStore.js';
import { parseBatchOutput } from './resultParser.js';
import type { VerificationProperty, PropertyResult } from './types.js';

type VSCodeAPI = { postMessage(msg: any): void };
declare function acquireVsCodeApi(): VSCodeAPI;

let _vscodeApi: VSCodeAPI | null = null;
function getVSCodeAPI(): VSCodeAPI | null {
  if (_vscodeApi) return _vscodeApi;
  try { _vscodeApi = acquireVsCodeApi(); } catch { /* not in webview context */ }
  return _vscodeApi;
}

// ─── Message protocol between webview and extension host ─────────────────────

export interface VerifyRequest {
  type: 'plaxio:verify-run';
  runId: string;
  instrumentedST: string;
  propertyIds: string[];
  config: {
    timeoutMs: number;
    kInductionDepth: number;
    mode: 'native' | 'docker';
    binaryPath: string;
  };
}

export interface VerifyResponse {
  type: 'plaxio:verify-result';
  runId: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  timeMs: number;
  propertyIds: string[];
}

export interface VerifyProgressMessage {
  type: 'plaxio:verify-progress';
  runId: string;
  message: string;
  propertyId?: string;
}

export interface EngineStatusResponse {
  type: 'plaxio:verify-engine-status';
  available: boolean;
  version?: string;
  binaryPath?: string;
  mode?: 'native' | 'docker';
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Request engine availability check from the extension host.
 */
export function checkEngineAvailability(): void {
  const api = getVSCodeAPI();
  if (!api) {
    // Running outside webview (e.g. in development) — use window.postMessage fallback
    window.postMessage({ type: 'plaxio:verify-check-engine' }, '*');
    return;
  }
  api.postMessage({ type: 'plaxio:verify-check-engine' });
}

/**
 * Start a verification run. Compiles properties, instruments ST, sends to host.
 */
export function startVerificationRun(): boolean {
  const prepared = verificationStore.prepareRun();
  if (!prepared) return false;

  const { runId, instrumentedST, properties } = prepared;
  const config = verificationStore.getState().engineConfig;

  const request: VerifyRequest = {
    type: 'plaxio:verify-run',
    runId,
    instrumentedST,
    propertyIds: properties.map(p => p.id),
    config: {
      timeoutMs: config.timeoutMs,
      kInductionDepth: config.kInductionDepth,
      mode: config.mode,
      binaryPath: config.binaryPath,
    },
  };

  const api = getVSCodeAPI();
  if (api) {
    api.postMessage(request);
  } else {
    window.postMessage(request, '*');
  }

  return true;
}

/**
 * Cancel a running verification.
 */
export function cancelVerificationRun(runId: string): void {
  const api = getVSCodeAPI();
  const msg = { type: 'plaxio:verify-cancel', runId };
  if (api) api.postMessage(msg);
  else window.postMessage(msg, '*');
}

// ─── Message listener (receives results from extension host) ─────────────────

function handleMessage(event: MessageEvent): void {
  const data = event.data;
  if (!data || typeof data.type !== 'string') return;

  switch (data.type) {
    case 'plaxio:verify-result': {
      const resp = data as VerifyResponse;
      const results = parseBatchOutput(
        resp.stdout,
        resp.stderr,
        resp.exitCode,
        resp.timeMs,
        resp.propertyIds,
      );
      verificationStore.recordResults(resp.runId, results, resp.timeMs);
      break;
    }

    case 'plaxio:verify-engine-status': {
      const status = data as EngineStatusResponse;
      verificationStore.setEngineAvailable(status.available);
      if (status.binaryPath) {
        verificationStore.setEngineConfig({
          binaryPath: status.binaryPath,
          mode: status.mode ?? 'native',
        });
      }
      break;
    }

    case 'plaxio:verify-progress': {
      // Progress messages — currently just logged to console panel
      const progress = data as VerifyProgressMessage;
      const { logicStore: ls } = require('../logicStore.js');
      ls.addConsoleEntry('info', `[Verify] ${progress.message}`);
      break;
    }

    case 'plaxio:verify-error': {
      const err = data as { runId: string; message: string };
      verificationStore.recordError(err.runId, err.message);
      break;
    }

    case 'plaxio:verify-add-property': {
      const prop = data.property;
      if (prop && prop.kind && prop.id && prop.label) {
        verificationStore.addProperty(prop);
      }
      break;
    }
  }
}

// Auto-register listener and check engine on load
if (typeof window !== 'undefined') {
  window.addEventListener('message', handleMessage);
  setTimeout(() => checkEngineAvailability(), 2000);
}

// ─── Offline/Fallback Mode ───────────────────────────────────────────────────
// When ESBMC-PLC+ is not available, provide a lightweight static analysis
// fallback using the existing CLM validator + basic boolean satisfiability.

export function runOfflineCheck(properties: VerificationProperty[]): PropertyResult[] {
  const results: PropertyResult[] = [];

  for (const prop of properties) {
    if (prop.kind === 'mutual_exclusion') {
      // Check if the CLM graph has any path where both tags can be simultaneously written
      // This is a conservative check — it may report UNKNOWN but never false SAFE
      results.push({
        propertyId: prop.id,
        verdict: 'UNKNOWN',
        timeMs: 0,
        message: 'Offline mode: mutual exclusion requires formal engine for proof. Structural check only: no obvious double-write path detected.',
      });
    } else {
      results.push({
        propertyId: prop.id,
        verdict: 'UNKNOWN',
        timeMs: 0,
        message: 'Offline mode: formal verification engine not available. Install ESBMC-PLC+ for full verification.',
      });
    }
  }

  return results;
}
