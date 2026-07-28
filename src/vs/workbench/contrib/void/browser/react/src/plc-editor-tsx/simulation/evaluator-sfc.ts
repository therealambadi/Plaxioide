import { CLMGraph } from '../clm/graph.js';
import type { SFCStepNodeData, SFCTransitionNodeData, SFCActionNodeData, SFCJumpNodeData } from '../clm/schema.js';
import { TagState } from './types.js';
import { evaluateExpression } from './expression-eval.js';

export interface SFCEvalResult {
  tagUpdates: TagState;
  activeSteps: Set<string>;
  sfcActive: Record<string, boolean>;
  timerState: Map<string, SFCTimerEntry>;
}

// Per (stepId + '::' + actionId) timer tracking for timed qualifiers
export interface SFCTimerEntry {
  // Wall-clock ms when this (step, action) pair was first activated in the current step activation
  startMs: number;
  // For SD/DS: whether the delayed-set/delayed-reset outcome has already been applied
  activated: boolean;
}

// ─── IEC time literal parser ──────────────────────────────────────────────────
// Parses T#5s, T#1m30s, T#500ms, T#2h, T#1h30m15s500ms → milliseconds
// Returns 0 for malformed strings (fail-safe)
export function parseIECTime(raw: string): number {
  if (!raw) return 0;
  const s = raw.trim().toUpperCase();
  // Strip T# or TIME# prefix
  const body = s.replace(/^(TIME#|T#)/, '');
  if (!body) return 0;

  let ms = 0;
  // Match segments like 1H, 30M, 15S, 500MS in any order
  const re = /(\d+(?:\.\d+)?)(H|M(?!S)|S(?!$)|MS)/g;
  // Simpler: match optional day, hour, minute, second, millisecond parts
  const pattern = /^(?:(\d+(?:\.\d+)?)D)?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M(?!S))?(?:(\d+(?:\.\d+)?)S)?(?:(\d+(?:\.\d+)?)MS)?$/;
  const m = body.match(pattern);
  if (!m || m[0] === '') {
    // Fallback: just a raw number → treat as milliseconds
    const n = parseFloat(body);
    return isNaN(n) ? 0 : n;
  }
  if (m[1]) ms += parseFloat(m[1]) * 86400000;  // days
  if (m[2]) ms += parseFloat(m[2]) * 3600000;   // hours
  if (m[3]) ms += parseFloat(m[3]) * 60000;     // minutes
  if (m[4]) ms += parseFloat(m[4]) * 1000;      // seconds
  if (m[5]) ms += parseFloat(m[5]);             // milliseconds
  return ms || 0;
}

export function evaluateSFC(
  clm: CLMGraph,
  tagValues: TagState,
  activeSteps: Set<string>,
  dt: number,
  timerState: Map<string, SFCTimerEntry>,
  nowMs: number,
): SFCEvalResult {
  const tagUpdates: TagState = {};
  const sfcActive: Record<string, boolean> = {};
  const currentActive = new Set(activeSteps);

  const stepIds = clm.getNodesByType('SFC_STEP');
  if (stepIds.length === 0) return { tagUpdates, activeSteps: currentActive, sfcActive, timerState };

  // Initialize: if no steps active, activate initial steps
  if (currentActive.size === 0) {
    for (const stepId of stepIds) {
      const stepData = clm.getNodeData<SFCStepNodeData>(stepId);
      if (stepData.isInitial) {
        currentActive.add(stepId);
      }
    }
  }

  // Execute actions for all active steps
  for (const stepId of currentActive) {
    executeStepActions(clm, stepId, tagValues, tagUpdates, timerState, nowMs);
  }

  // Evaluate transitions from active steps
  const stepsToDeactivate = new Set<string>();
  const stepsToActivate   = new Set<string>();

  for (const stepId of currentActive) {
    const outFlows = clm.getOutEdgesByType(stepId, 'SFC_FLOW');
    // Sort transitions by priority (lower = higher priority)
    const transitions: Array<{ transId: string; priority: number }> = [];
    for (const flow of outFlows) {
      const attr = clm.getNodeAttr(flow.target);
      if (attr.type === 'SFC_TRANSITION') {
        const tData = clm.getNodeData<SFCTransitionNodeData>(flow.target);
        transitions.push({ transId: flow.target, priority: tData.priority ?? 0 });
      }
    }
    transitions.sort((a, b) => a.priority - b.priority);

    for (const { transId } of transitions) {
      const transData = clm.getNodeData<SFCTransitionNodeData>(transId);
      const merged = { ...tagValues, ...tagUpdates };
      const conditionMet = toBool(evaluateExpression(transData.conditionExpr, merged));

      if (conditionMet) {
        stepsToDeactivate.add(stepId);
        // Find target steps via SFC_FLOW edges out of the transition
        const targetFlows = clm.getOutEdgesByType(transId, 'SFC_FLOW');
        for (const tf of targetFlows) {
          const targetAttr = clm.getNodeAttr(tf.target);
          if (targetAttr.type === 'SFC_STEP') {
            stepsToActivate.add(tf.target);
          } else if (targetAttr.type === 'SFC_JUMP') {
            // Resolve jump by looking up step by name
            const jumpData = clm.getNodeData<SFCJumpNodeData>(tf.target);
            const namedStep = stepIds.find(sid => {
              const sd = clm.getNodeData<SFCStepNodeData>(sid);
              return sd.stepName === jumpData.targetStepName;
            });
            if (namedStep) stepsToActivate.add(namedStep);
          }
        }
        break; // Only first matching transition fires per step (selection branching)
      }
    }
  }

  // Clean up timer state for deactivated steps
  for (const stepId of stepsToDeactivate) {
    // Remove all timer entries that belong to this step
    for (const key of timerState.keys()) {
      if (key.startsWith(stepId + '::')) {
        timerState.delete(key);
      }
    }
  }

  // Apply transition results
  for (const s of stepsToDeactivate) currentActive.delete(s);
  for (const s of stepsToActivate)   currentActive.add(s);

  // Build sfcActive map for UI
  for (const stepId of stepIds) {
    sfcActive[stepId] = currentActive.has(stepId);
  }

  return { tagUpdates, activeSteps: currentActive, sfcActive, timerState };
}

// ─── Action execution with full qualifier semantics ───────────────────────────
function executeStepActions(
  clm: CLMGraph,
  stepId: string,
  tagValues: TagState,
  tagUpdates: TagState,
  timerState: Map<string, SFCTimerEntry>,
  nowMs: number,
): void {
  const actionEdges = clm.getOutEdgesByType(stepId, 'HAS_ACTION');

  for (const ae of actionEdges) {
    const actionData = clm.getNodeData<SFCActionNodeData>(ae.target);
    const tagName  = actionData.actionName;
    const actionId = ae.target;
    const timerKey = `${stepId}::${actionId}`;
    const durationMs = parseIECTime(actionData.duration ?? '');

    switch (actionData.qualifier) {
      // ── Non-stored: TRUE while step active, FALSE when step deactivates ───
      case 'N':
        tagUpdates[tagName] = true;
        break;

      // ── Set: latch TRUE (persists after step deactivates, cleared by R) ──
      case 'S':
        tagUpdates[tagName] = true;
        break;

      // ── Reset: latch FALSE ─────────────────────────────────────────────
      case 'R':
        tagUpdates[tagName] = false;
        break;

      // ── P / P1: rising pulse — TRUE only on the first scan after entry ──
      case 'P':
      case 'P1': {
        const timerEntry = timerState.get(timerKey);
        if (!timerEntry) {
          // First scan this action is active → pulse TRUE
          timerState.set(timerKey, { startMs: nowMs, activated: true });
          tagUpdates[tagName] = true;
        } else {
          // Subsequent scans → stay FALSE (pulse already fired)
          tagUpdates[tagName] = false;
        }
        break;
      }

      // ── P0: falling pulse — TRUE only on the scan when step deactivates ─
      // We set this in the deactivation path, not here. During active scans → FALSE.
      case 'P0':
        tagUpdates[tagName] = false;
        break;

      // ── L: time-limited — TRUE while step active, but only for ≤ duration ─
      // IEC §6.5.6.4: action is active from entry; if duration elapses, action stops.
      case 'L': {
        const entry = timerState.get(timerKey);
        if (!entry) {
          timerState.set(timerKey, { startMs: nowMs, activated: false });
          tagUpdates[tagName] = true;
        } else {
          const elapsed = nowMs - entry.startMs;
          if (durationMs > 0 && elapsed >= durationMs) {
            tagUpdates[tagName] = false;
          } else {
            tagUpdates[tagName] = true;
          }
        }
        break;
      }

      // ── D: time-delayed — tag activates after duration elapses ───────────
      // IEC §6.5.6.5: action begins after a delay; deactivates when step deactivates.
      case 'D': {
        const entry = timerState.get(timerKey);
        if (!entry) {
          timerState.set(timerKey, { startMs: nowMs, activated: false });
          tagUpdates[tagName] = false;
        } else {
          const elapsed = nowMs - entry.startMs;
          if (durationMs > 0 && elapsed >= durationMs) {
            tagUpdates[tagName] = true;
          } else {
            tagUpdates[tagName] = false;
          }
        }
        break;
      }

      // ── SD: stored + delayed — tag latched TRUE after duration elapses ────
      // IEC §6.5.6.6: like D, but latch is stored (survives step deactivation).
      case 'SD': {
        const entry = timerState.get(timerKey);
        if (!entry) {
          timerState.set(timerKey, { startMs: nowMs, activated: false });
          // Don't write tagUpdates — existing latch value remains
        } else if (!entry.activated) {
          const elapsed = nowMs - entry.startMs;
          if (durationMs > 0 && elapsed >= durationMs) {
            entry.activated = true;
            tagUpdates[tagName] = true;  // set latch
          }
          // Before timer fires: no update (preserve existing value)
        }
        // Once activated: no further writes — it remains set until R action clears it
        break;
      }

      // ── DS: delayed + stored — like SD but the delay only runs while step active
      // If step deactivates before timer fires, the latch never sets.
      case 'DS': {
        const entry = timerState.get(timerKey);
        if (!entry) {
          timerState.set(timerKey, { startMs: nowMs, activated: false });
        } else if (!entry.activated) {
          const elapsed = nowMs - entry.startMs;
          if (durationMs > 0 && elapsed >= durationMs) {
            entry.activated = true;
            tagUpdates[tagName] = true;
          }
        }
        // After activation: tag stays set (stored) until R qualifier clears it
        break;
      }

      // ── SL: stored + time-limited — latch TRUE on entry, auto-reset after duration
      // IEC §6.5.6.8: set on entry, then automatically reset when timer expires.
      case 'SL': {
        const entry = timerState.get(timerKey);
        if (!entry) {
          timerState.set(timerKey, { startMs: nowMs, activated: false });
          tagUpdates[tagName] = true;  // set latch on entry
        } else {
          const elapsed = nowMs - entry.startMs;
          if (durationMs > 0 && elapsed >= durationMs && !entry.activated) {
            entry.activated = true;
            tagUpdates[tagName] = false;  // auto-reset after duration
          }
          // Before timer expires: stored → no write, value persists
        }
        break;
      }

      default:
        tagUpdates[tagName] = true;
        break;
    }
  }
}

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number')  return v !== 0;
  if (typeof v === 'string')  return v === 'TRUE' || v === 'true' || v === '1';
  return !!v;
}
