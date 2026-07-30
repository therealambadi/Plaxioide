import { CLMGraph } from '../clm/graph.js';
import { TagState, FBInstanceState, ScanResult } from './types.js';
import { evaluateLadder } from './evaluator-ld.js';
import { evaluateFBD } from './evaluator-fbd.js';
import { evaluateSFC, SFCTimerEntry } from './evaluator-sfc.js';
import { logicStore } from '../logicStore.js';
import { buildCLMFromStore } from '../clm/builder.js';

export type EngineStatus = 'stopped' | 'running' | 'paused';

export class SimulationEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private clm: CLMGraph | null = null;
  private tagValues: TagState = {};
  private prevTagValues: TagState = {};
  private prevCoilPower: Record<string, boolean> = {};
  private fbStates = new Map<string, FBInstanceState>();
  private activeSteps = new Set<string>();
  private sfcTimerState = new Map<string, SFCTimerEntry>();
  private forcedValues = new Map<string, any>();
  private tick = 0;
  private lastTime = 0;
  private scanRate = 10;
  private status: EngineStatus = 'stopped';
  private onScanCallback: ((result: ScanResult) => void) | null = null;

  get currentStatus(): EngineStatus { return this.status; }
  get currentTick(): number { return this.tick; }

  onScan(callback: (result: ScanResult) => void): void {
    this.onScanCallback = callback;
  }

  start(clm: CLMGraph, scanRate: number, initialTagValues?: TagState): void {
    this.stop();
    this.clm = clm;
    this.scanRate = scanRate;
    this.tagValues = initialTagValues ? { ...initialTagValues } : {};
    this.prevTagValues = {};
    this.prevCoilPower = {};
    this.fbStates.clear();
    this.activeSteps.clear();
    this.sfcTimerState.clear();
    this.tick = 0;
    this.lastTime = performance.now();
    this.status = 'running';

    this.intervalId = setInterval(() => this.scanCycle(), this.scanRate);
    logicStore.addConsoleEntry('success', `Simulation started — CLM graph built, scan loop active at ${scanRate}ms`);
  }

  stop(): void {
    const prevTick = this.tick;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    const wasRunning = this.status === 'running' || this.status === 'paused';
    this.status = 'stopped';
    this.clm = null;
    this.tagValues = {};
    this.prevTagValues = {};
    this.prevCoilPower = {};
    this.fbStates.clear();
    this.activeSteps.clear();
    this.sfcTimerState.clear();
    this.forcedValues.clear();
    this.tick = 0;
    if (wasRunning) {
      // Clear all live values and energized states so the UI resets to idle
      logicStore.updateEnergizedStates({}, undefined, {}, {});
      logicStore.batchUpdateTagValues({});
      logicStore.updateSFCActiveSteps({});
      logicStore.clearLiveValues();
      logicStore.addConsoleEntry('info', `Simulation stopped at tick ${prevTick}`);
    }
  }

  pause(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.status = 'paused';
    logicStore.addConsoleEntry('warn', `Simulation paused at tick ${this.tick}`);
  }

  resume(): void {
    if (this.status !== 'paused' || !this.clm) return;
    this.lastTime = performance.now();
    this.status = 'running';
    this.intervalId = setInterval(() => this.scanCycle(), this.scanRate);
    logicStore.addConsoleEntry('info', `Simulation resumed from tick ${this.tick}`);
  }

  step(): void {
    if (!this.clm) return;
    this.status = 'paused';
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    const now = performance.now();
    const dt = this.lastTime > 0 ? now - this.lastTime : this.scanRate;
    this.lastTime = now;
    this.executeSingleScan(dt, now);
  }

  forceTag(name: string, value: any): void {
    this.forcedValues.set(name, value);
    this.tagValues[name] = value;
    this._recomputeEnergized();
  }

  releaseForce(name: string): void {
    this.forcedValues.delete(name);
    delete this.tagValues[name];
    this._recomputeEnergized();
  }

  /** Recompute energized/tag state and push to logicStore so the canvas updates immediately.
   *  Works even when the engine is stopped — builds a transient CLM from the current store state. */
  private _recomputeEnergized(): void {
    try {
      const s = logicStore.getState();
      const clm = this.clm ?? buildCLMFromStore(s.ladderProgram, s.fbdProgram, s.sfcProgram, s.tagDatabase);
      // Seed from store's liveValues so stopped-engine evaluations see real tag state
      const storeValues: TagState = {};
      for (const tag of s.tagDatabase) {
        if (tag.liveValue !== undefined) storeValues[tag.name] = tag.liveValue === 'TRUE' || tag.liveValue === 'true' ? true : tag.liveValue === 'FALSE' || tag.liveValue === 'false' ? false : tag.liveValue;
      }
      const baseValues: TagState = { ...storeValues, ...this.tagValues };
      const forcedObj: Record<string, any> = {};
      for (const [n, v] of this.forcedValues) { baseValues[n] = v; forcedObj[n] = v; }
      const ldResult = evaluateLadder(clm, baseValues, this.fbStates, this.scanRate, {}, {}, forcedObj);
      const merged = { ...baseValues, ...ldResult.tagUpdates };
      const fbdResult = evaluateFBD(clm, merged, this.fbStates, this.scanRate);
      const energized = { ...ldResult.energized, ...fbdResult.energized };
      const powerAfter = { ...ldResult.powerAfter };
      const finalTags = { ...merged, ...fbdResult.tagUpdates };
      for (const [n, v] of this.forcedValues) finalTags[n] = v;
      logicStore.updateEnergizedStates(energized, ldResult.blockPinValues, fbdResult.fbdPinValues, powerAfter);
      logicStore.batchUpdateTagValues(finalTags);
    } catch (_e) {
      // Silently ignore — incomplete programs are fine
    }
  }

  setScanRate(ms: number): void {
    this.scanRate = Math.max(1, ms);
    if (this.status === 'running' && this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(() => this.scanCycle(), this.scanRate);
    }
  }

  getTagValues(): TagState {
    return { ...this.tagValues };
  }

  private scanCycle(): void {
    const now = performance.now();
    const dt = now - this.lastTime;
    this.lastTime = now;
    this.executeSingleScan(dt, now);
  }

  private executeSingleScan(dt: number, nowMs = performance.now()): void {
    if (!this.clm) return;

    let ldResult!: ReturnType<typeof evaluateLadder>;
    let fbdResult!: ReturnType<typeof evaluateFBD>;
    let sfcResult!: ReturnType<typeof evaluateSFC>;

    try {
      // Snapshot prev values before scan for edge detection (P/N contacts and coils)
      const scanPrevValues = { ...this.prevTagValues };
      const scanPrevCoilPower = { ...this.prevCoilPower };

      // Resolve forced values into a plain object for the evaluator's force-injection layer
      const forcedObj: Record<string, any> = {};
      for (const [n, v] of this.forcedValues) forcedObj[n] = v;

      // Evaluate LD (forced values injected at tag-read layer inside evaluator)
      ldResult = evaluateLadder(this.clm, this.tagValues, this.fbStates, dt, scanPrevValues, scanPrevCoilPower, forcedObj);
      this.fbStates = ldResult.fbStates;
      // Save coil power for next scan's P/N coil edge detection
      this.prevCoilPower = { ...ldResult.coilPowerThisScan };

      // Merge LD results into tag values before FBD evaluation
      Object.assign(this.tagValues, ldResult.tagUpdates);

      fbdResult = evaluateFBD(this.clm, this.tagValues, this.fbStates, dt);
      this.fbStates = fbdResult.fbStates;
      Object.assign(this.tagValues, fbdResult.tagUpdates);

      sfcResult = evaluateSFC(this.clm, this.tagValues, this.activeSteps, dt, this.sfcTimerState, now);
      this.activeSteps = sfcResult.activeSteps;
      // timerState is mutated in-place by evaluateSFC; no reassignment needed
      Object.assign(this.tagValues, sfcResult.tagUpdates);
    } catch (e: any) {
      logicStore.addConsoleEntry('error', `Scan error at tick ${this.tick}: ${e?.message ?? String(e)}`);
      return;
    }

    // Apply forced values (override everything)
    for (const [name, value] of this.forcedValues) {
      this.tagValues[name] = value;
    }

    // Update prev values for next scan's edge detection
    this.prevTagValues = { ...this.tagValues };

    this.tick++;

    // Merge energized maps
    const energized = { ...ldResult.energized, ...fbdResult.energized };
    const powerAfter = { ...ldResult.powerAfter };

    // Push results to the store so canvases update on every scan
    logicStore.updateEnergizedStates(energized, ldResult.blockPinValues, fbdResult.fbdPinValues, powerAfter);
    logicStore.batchUpdateTagValues(this.tagValues);
    logicStore.updateSFCActiveSteps(sfcResult.sfcActive);

    const result: ScanResult = {
      tick: this.tick,
      tagValues: { ...this.tagValues },
      energized,
      sfcActive: sfcResult.sfcActive,
    };

    if (this.onScanCallback) {
      this.onScanCallback(result);
    }
  }
}

export const simulationEngine = new SimulationEngine();
logicStore._setEngineRef(simulationEngine);
