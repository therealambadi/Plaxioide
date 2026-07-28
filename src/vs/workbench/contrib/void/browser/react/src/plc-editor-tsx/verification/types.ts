/*
 * ESBMC-PLC+ Formal Verification — Type definitions.
 * Covers property specification, verification results, counterexample traces.
 */

// ─── Property Specification (YAML schema from ESBMC-PLC+ paper) ──────────────

export type PropertyKind = 'mutual_exclusion' | 'invariant' | 'absence' | 'response' | 'reachability';

export interface MutualExclusionProperty {
  kind: 'mutual_exclusion';
  id: string;
  label: string;
  tags: string[];  // ≥2 tags that must never be TRUE simultaneously
}

export interface InvariantProperty {
  kind: 'invariant';
  id: string;
  label: string;
  expression: string;  // ST boolean expression that must ALWAYS hold
}

export interface AbsenceProperty {
  kind: 'absence';
  id: string;
  label: string;
  expression: string;  // ST boolean expression that must NEVER become TRUE
}

export interface ResponseProperty {
  kind: 'response';
  id: string;
  label: string;
  trigger: string;     // when this becomes TRUE...
  response: string;    // ...this must eventually become TRUE
  withinScans?: number; // optional bounded response time (in scan cycles)
}

export interface ReachabilityProperty {
  kind: 'reachability';
  id: string;
  label: string;
  expression: string;  // ST boolean expression that MUST be reachable (liveness)
}

export type VerificationProperty =
  | MutualExclusionProperty
  | InvariantProperty
  | AbsenceProperty
  | ResponseProperty
  | ReachabilityProperty;

// ─── Verification Results ────────────────────────────────────────────────────

export type VerificationVerdict = 'SAFE' | 'VIOLATION' | 'UNKNOWN' | 'TIMEOUT' | 'UNSUPPORTED';

export interface CounterexampleStep {
  scanCycle: number;
  tagValues: Record<string, any>;
  description?: string;
}

export interface CounterexampleTrace {
  steps: CounterexampleStep[];
  loopStart?: number;  // if k-induction found a loop, index where it starts
}

export interface PropertyResult {
  propertyId: string;
  verdict: VerificationVerdict;
  timeMs: number;
  counterexample?: CounterexampleTrace;
  message?: string;
  unsupportedBlocks?: string[];  // FBs that fell back to nondeterministic over-approximation
}

export interface VerificationRun {
  id: string;
  timestamp: number;
  properties: VerificationProperty[];
  results: PropertyResult[];
  stCode: string;  // the ST that was actually verified
  engineVersion: string;
  totalTimeMs: number;
  status: 'running' | 'complete' | 'error';
  errorMessage?: string;
}

// ─── Engine Configuration ────────────────────────────────────────────────────

export interface VerificationEngineConfig {
  binaryPath: string;       // path to esbmc-plcplus binary or docker wrapper
  mode: 'native' | 'docker';
  timeoutMs: number;        // per-property timeout (default 30000)
  kInductionDepth: number;  // max k for k-induction (default 100)
  unwindBound?: number;     // BMC unwind bound (for bounded model checking fallback)
}

// ─── Store State ─────────────────────────────────────────────────────────────

export interface VerificationState {
  properties: VerificationProperty[];
  runs: VerificationRun[];
  currentRunId: string | null;
  engineConfig: VerificationEngineConfig;
  engineAvailable: boolean;  // true if binary/docker found on system
}
