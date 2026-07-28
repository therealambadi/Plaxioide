/*
 * Verification Store — State management for formal verification.
 * Manages properties, runs, engine status, and integrates with logicStore for CLM access.
 */

import { produce } from 'immer';
import type {
  VerificationState,
  VerificationProperty,
  VerificationRun,
  PropertyResult,
  VerificationEngineConfig,
  CounterexampleTrace,
} from './types.js';
import { compileProperties, instrumentST } from './propertyCompiler.js';
import { logicStore } from '../logicStore.js';
import { buildCLMFromStore } from '../clm/builder.js';
import { clmToST } from '../clm/clmToST.js';

type Listener = () => void;

const DEFAULT_CONFIG: VerificationEngineConfig = {
  binaryPath: '',
  mode: 'native',
  timeoutMs: 30000,
  kInductionDepth: 100,
};

const INITIAL_STATE: VerificationState = {
  properties: [],
  runs: [],
  currentRunId: null,
  engineConfig: DEFAULT_CONFIG,
  engineAvailable: false,
};

class VerificationStore {
  private _state: VerificationState = INITIAL_STATE;
  private _listeners = new Set<Listener>();

  getState(): VerificationState { return this._state; }

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _notify(): void {
    for (const l of this._listeners) l();
  }

  private _update(recipe: (draft: VerificationState) => void): void {
    this._state = produce(this._state, recipe);
    this._notify();
  }

  // ─── Property Management ─────────────────────────────────────────────────

  addProperty(property: VerificationProperty): void {
    this._update(d => { d.properties.push(property); });
  }

  removeProperty(id: string): void {
    this._update(d => { d.properties = d.properties.filter(p => p.id !== id); });
  }

  updateProperty(id: string, updates: Partial<VerificationProperty>): void {
    this._update(d => {
      const idx = d.properties.findIndex(p => p.id === id);
      if (idx !== -1) d.properties[idx] = { ...d.properties[idx], ...updates } as VerificationProperty;
    });
  }

  clearProperties(): void {
    this._update(d => { d.properties = []; });
  }

  // ─── Engine Configuration ────────────────────────────────────────────────

  setEngineConfig(config: Partial<VerificationEngineConfig>): void {
    this._update(d => { d.engineConfig = { ...d.engineConfig, ...config }; });
  }

  setEngineAvailable(available: boolean): void {
    this._update(d => { d.engineAvailable = available; });
  }

  // ─── Verification Run ────────────────────────────────────────────────────

  /**
   * Prepare a verification run: compile properties, instrument ST, return
   * the instrumented code ready for the engine backend to execute.
   */
  prepareRun(): { runId: string; instrumentedST: string; properties: VerificationProperty[] } | null {
    const state = logicStore.getState();
    const clm = buildCLMFromStore(state.ladderProgram, state.fbdProgram, state.sfcProgram, state.tagDatabase as any);
    const stResult = clmToST(clm);

    if (!stResult.stCode || stResult.tagCount === 0) {
      return null;
    }

    const properties = this._state.properties;
    if (properties.length === 0) return null;

    const compilation = compileProperties(properties);
    const instrumentedST = instrumentST(stResult.stCode, compilation);

    const runId = `vrun_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const run: VerificationRun = {
      id: runId,
      timestamp: Date.now(),
      properties: [...properties],
      results: [],
      stCode: instrumentedST,
      engineVersion: 'esbmc-plcplus-2026',
      totalTimeMs: 0,
      status: 'running',
    };

    this._update(d => {
      d.runs.unshift(run);
      if (d.runs.length > 20) d.runs = d.runs.slice(0, 20);
      d.currentRunId = runId;
    });

    return { runId, instrumentedST, properties };
  }

  /**
   * Record results from the engine backend.
   */
  recordResults(runId: string, results: PropertyResult[], totalTimeMs: number): void {
    this._update(d => {
      const run = d.runs.find(r => r.id === runId);
      if (run) {
        run.results = results;
        run.totalTimeMs = totalTimeMs;
        run.status = 'complete';
      }
      if (d.currentRunId === runId) d.currentRunId = null;
    });
  }

  recordError(runId: string, errorMessage: string): void {
    this._update(d => {
      const run = d.runs.find(r => r.id === runId);
      if (run) {
        run.status = 'error';
        run.errorMessage = errorMessage;
      }
      if (d.currentRunId === runId) d.currentRunId = null;
    });
  }

  // ─── Counterexample Replay ───────────────────────────────────────────────

  getCounterexample(runId: string, propertyId: string): CounterexampleTrace | undefined {
    const run = this._state.runs.find(r => r.id === runId);
    if (!run) return undefined;
    const result = run.results.find(r => r.propertyId === propertyId);
    return result?.counterexample;
  }

  // ─── Quick Helpers ───────────────────────────────────────────────────────

  getLatestRun(): VerificationRun | undefined {
    return this._state.runs[0];
  }

  isRunning(): boolean {
    return this._state.currentRunId !== null;
  }

  getSummary(): { safe: number; violated: number; unknown: number; total: number } {
    const run = this.getLatestRun();
    if (!run || run.status !== 'complete') return { safe: 0, violated: 0, unknown: 0, total: 0 };
    const results = run.results;
    return {
      safe: results.filter(r => r.verdict === 'SAFE').length,
      violated: results.filter(r => r.verdict === 'VIOLATION').length,
      unknown: results.filter(r => r.verdict === 'UNKNOWN' || r.verdict === 'TIMEOUT').length,
      total: results.length,
    };
  }
}

export const verificationStore = new VerificationStore();

// ─── React hook ──────────────────────────────────────────────────────────────

import { useSyncExternalStore } from 'react';

export function useVerificationStore(): VerificationState {
  return useSyncExternalStore(
    (cb) => verificationStore.subscribe(cb),
    () => verificationStore.getState(),
  );
}

export function useVerificationStoreSelector<T>(selector: (state: VerificationState) => T): T {
  return useSyncExternalStore(
    (cb) => verificationStore.subscribe(cb),
    () => selector(verificationStore.getState()),
  );
}
