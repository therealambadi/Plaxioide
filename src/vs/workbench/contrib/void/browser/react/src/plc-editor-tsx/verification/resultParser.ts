/*
 * ESBMC-PLC+ Result Parser — Parses CLI stdout/stderr into structured PropertyResult[].
 *
 * ESBMC output format (from paper §5 and empirical testing):
 *   - "VERIFICATION SUCCESSFUL" → SAFE
 *   - "VERIFICATION FAILED" → VIOLATION (counterexample follows)
 *   - "Timed out" → TIMEOUT
 *   - Counterexample format: State N lines with variable assignments
 *
 * The parser also extracts counterexample traces for replay in the simulation engine.
 */

import type {
  PropertyResult,
  CounterexampleTrace,
  CounterexampleStep,
  VerificationVerdict,
} from './types.js';

interface RawESBMCOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  timeMs: number;
  propertyId: string;
}

export function parseESBMCOutput(raw: RawESBMCOutput): PropertyResult {
  const { stdout, stderr, exitCode, timeMs, propertyId } = raw;
  const combined = stdout + '\n' + stderr;

  // Check for timeout
  if (combined.includes('Timed out') || combined.includes('TIMEOUT') || exitCode === 137) {
    return { propertyId, verdict: 'TIMEOUT', timeMs, message: 'Verification timed out' };
  }

  // Check for unsupported constructs
  const unsupportedMatch = combined.match(/unsupported.*?:\s*(.+)/gi);
  const unsupportedBlocks = unsupportedMatch
    ? unsupportedMatch.map(m => m.replace(/unsupported.*?:\s*/i, '').trim())
    : undefined;

  // Check for successful verification
  if (combined.includes('VERIFICATION SUCCESSFUL')) {
    return {
      propertyId,
      verdict: 'SAFE',
      timeMs,
      message: 'Property holds for all reachable states (k-induction proof)',
      unsupportedBlocks,
    };
  }

  // Check for violation
  if (combined.includes('VERIFICATION FAILED')) {
    const counterexample = parseCounterexample(stdout);
    return {
      propertyId,
      verdict: 'VIOLATION',
      timeMs,
      counterexample,
      message: 'Property violated — counterexample trace available',
      unsupportedBlocks,
    };
  }

  // Check for parse/compilation errors
  if (exitCode !== 0) {
    const errorLines = combined.split('\n').filter(l =>
      l.includes('error') || l.includes('Error') || l.includes('ERROR')
    ).slice(0, 5);
    return {
      propertyId,
      verdict: 'UNKNOWN',
      timeMs,
      message: errorLines.length > 0
        ? `Engine error: ${errorLines.join('; ')}`
        : `Engine exited with code ${exitCode}`,
      unsupportedBlocks,
    };
  }

  return {
    propertyId,
    verdict: 'UNKNOWN',
    timeMs,
    message: 'Could not determine verification result from engine output',
  };
}

/**
 * Parse ESBMC counterexample output into a structured trace.
 *
 * ESBMC counterexample format:
 *   State 1 file ... line ... function ...
 *   ────────────────────────────────
 *     var_name=value
 *     var_name=value
 *
 *   State 2 ...
 *   ...
 *
 * For PLC programs, each "State" corresponds to one scan cycle evaluation.
 */
function parseCounterexample(stdout: string): CounterexampleTrace | undefined {
  const lines = stdout.split('\n');
  const steps: CounterexampleStep[] = [];
  let currentStep: CounterexampleStep | null = null;
  let scanCycle = 0;

  for (const line of lines) {
    const stateMatch = line.match(/^State\s+(\d+)/);
    if (stateMatch) {
      if (currentStep) steps.push(currentStep);
      scanCycle = parseInt(stateMatch[1], 10);
      currentStep = { scanCycle, tagValues: {} };
      continue;
    }

    if (!currentStep) continue;

    // Variable assignment line: "  INST0.TAG_NAME=value" or "  tag_name=value"
    const assignMatch = line.match(/^\s+(?:INST0\.)?([A-Za-z_][A-Za-z0-9_]*)=(.*)/);
    if (assignMatch) {
      const [, varName, rawValue] = assignMatch;
      currentStep.tagValues[varName] = parseValue(rawValue.trim());
    }
  }

  if (currentStep) steps.push(currentStep);

  if (steps.length === 0) return undefined;

  // Detect loop (ESBMC marks "Back to state N" or similar)
  let loopStart: number | undefined;
  const loopMatch = stdout.match(/[Bb]ack to [Ss]tate\s+(\d+)/);
  if (loopMatch) {
    loopStart = parseInt(loopMatch[1], 10);
  }

  return { steps, loopStart };
}

function parseValue(raw: string): any {
  if (raw === 'TRUE' || raw === '1') return true;
  if (raw === 'FALSE' || raw === '0') return false;
  const num = Number(raw);
  if (!isNaN(num)) return num;
  // TIME literal: T#500ms → 500
  const timeMatch = raw.match(/T#(\d+)(\w+)/);
  if (timeMatch) {
    const val = parseInt(timeMatch[1], 10);
    const unit = timeMatch[2];
    if (unit === 'ms') return val;
    if (unit === 's') return val * 1000;
    if (unit === 'min') return val * 60000;
    return val;
  }
  return raw;
}

/**
 * Parse multiple property results from a batch verification run.
 * ESBMC-PLC+ runs properties sequentially; each has a delimited output section.
 */
export function parseBatchOutput(
  stdout: string,
  stderr: string,
  exitCode: number,
  timeMs: number,
  propertyIds: string[],
): PropertyResult[] {
  // Try to split output by property markers
  const sections = stdout.split(/={3,}\s*Property:\s*/);

  if (sections.length > 1) {
    return sections.slice(1).map((section, idx) => {
      const id = propertyIds[idx] ?? `unknown_${idx}`;
      return parseESBMCOutput({
        stdout: section,
        stderr,
        exitCode,
        timeMs: Math.round(timeMs / propertyIds.length),
        propertyId: id,
      });
    });
  }

  // Single-property run or undelimited output — parse as single result
  if (propertyIds.length === 1) {
    return [parseESBMCOutput({ stdout, stderr, exitCode, timeMs, propertyId: propertyIds[0] })];
  }

  // Can't split — return same verdict for all
  return propertyIds.map(id =>
    parseESBMCOutput({ stdout, stderr, exitCode, timeMs, propertyId: id })
  );
}
