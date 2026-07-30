/*
 * Counterexample Replay — Drives the existing simulation UI (energized wires,
 * active SFC steps, tag values) from a formal verification counterexample trace.
 *
 * Reuses the same logicStore methods the SimulationEngine uses:
 *   - logicStore.batchUpdateTagValues()
 *   - logicStore.updateEnergizedStates()
 *   - logicStore.updateSFCActiveSteps()
 *
 * This gives the user the exact same visual feedback as a live simulation run,
 * but driven from a mathematically-derived trace rather than scan-cycle evaluation.
 */

import { logicStore } from '../logicStore.js';
import type { CounterexampleTrace, CounterexampleStep } from './types.js';

export type ReplayStatus = 'idle' | 'playing' | 'paused';

class CounterexampleReplayer {
  private _trace: CounterexampleTrace | null = null;
  private _currentStep = 0;
  private _status: ReplayStatus = 'idle';
  private _intervalId: ReturnType<typeof setInterval> | null = null;
  private _playbackSpeed = 500; // ms between steps
  private _onStepChange: ((step: number, total: number) => void) | null = null;

  get status(): ReplayStatus { return this._status; }
  get currentStep(): number { return this._currentStep; }
  get totalSteps(): number { return this._trace?.steps.length ?? 0; }

  onStepChange(callback: (step: number, total: number) => void): void {
    this._onStepChange = callback;
  }

  load(trace: CounterexampleTrace): void {
    this.stop();
    this._trace = trace;
    this._currentStep = 0;
    this._applyStep(0);
  }

  play(speed?: number): void {
    if (!this._trace || this._trace.steps.length === 0) return;
    if (speed !== undefined) this._playbackSpeed = speed;
    this._status = 'playing';
    this._intervalId = setInterval(() => {
      if (this._currentStep < this._trace!.steps.length - 1) {
        this._currentStep++;
        this._applyStep(this._currentStep);
      } else {
        this.pause();
      }
    }, this._playbackSpeed);
  }

  pause(): void {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this._status = 'paused';
  }

  stop(): void {
    this.pause();
    this._status = 'idle';
    this._trace = null;
    this._currentStep = 0;
    // Clear energized states
    logicStore.updateEnergizedStates({}, undefined, {}, {});
    logicStore.batchUpdateTagValues({});
    logicStore.updateSFCActiveSteps({});
    logicStore.clearLiveValues();
  }

  stepTo(index: number): void {
    if (!this._trace) return;
    const clamped = Math.max(0, Math.min(index, this._trace.steps.length - 1));
    this._currentStep = clamped;
    this._applyStep(clamped);
  }

  stepForward(): void {
    this.stepTo(this._currentStep + 1);
  }

  stepBackward(): void {
    this.stepTo(this._currentStep - 1);
  }

  private _applyStep(index: number): void {
    if (!this._trace) return;
    const step = this._trace.steps[index];
    if (!step) return;

    // Apply tag values to the UI
    logicStore.batchUpdateTagValues(step.tagValues);

    // Derive energized states from boolean tag values
    const energized: Record<string, boolean> = {};
    for (const [tag, value] of Object.entries(step.tagValues)) {
      if (typeof value === 'boolean') {
        energized[tag] = value;
      }
    }
    logicStore.updateEnergizedStates(energized, undefined, {}, {});

    // Derive SFC active steps from tag naming convention (_SFC_STATE = N)
    const sfcState = step.tagValues['_SFC_STATE'];
    if (typeof sfcState === 'number') {
      const activeSteps: Record<string, boolean> = {};
      // The simulation engine uses step node IDs; counterexample uses state numbers.
      // Store as special key for the UI to interpret.
      activeSteps[`__sfc_state_${sfcState}`] = true;
      logicStore.updateSFCActiveSteps(activeSteps);
    }

    this._onStepChange?.(index, this._trace.steps.length);

    // Log to console panel
    const isLast = index === this._trace.steps.length - 1;
    if (isLast) {
      logicStore.addConsoleEntry('error', `[Verify] Counterexample step ${index + 1}/${this._trace.steps.length} — VIOLATION occurs here`);
    } else {
      logicStore.addConsoleEntry('info', `[Verify] Counterexample step ${index + 1}/${this._trace.steps.length}`);
    }
  }
}

export const counterexampleReplayer = new CounterexampleReplayer();
