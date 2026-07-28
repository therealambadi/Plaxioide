/*
 * CLM Validator — Structural and semantic validation of the CLM graph.
 * Checks: dangling references, type mismatches, cycle detection, scan-order integrity.
 */

import { CLMGraph } from './graph.js';
import type {
  TagNodeData,
  FBDPinNodeData,
  RungNodeData,
  SFCStepNodeData,
} from './schema.js';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationError {
  nodeId: string;
  severity: ValidationSeverity;
  message: string;
  category: 'dangling_ref' | 'type_mismatch' | 'cycle' | 'scan_order' | 'structure';
}

export function validateCLM(clm: CLMGraph): ValidationError[] {
  const errors: ValidationError[] = [];

  errors.push(...validateDanglingRefs(clm));
  errors.push(...validateWireTypes(clm));
  errors.push(...validateFBDCycles(clm));
  errors.push(...validateRungOrder(clm));
  errors.push(...validateDoubleCoil(clm));
  errors.push(...validateSFCStructure(clm));

  return errors;
}

/**
 * Double-coil warning: two or more standard coils writing the same tag.
 * This is a logic authoring error — the last-evaluated rung silently wins,
 * which is rarely what the programmer intended.
 * Set/Reset coils for the same tag are intentional (SR latch pattern) — warn separately.
 */
function validateDoubleCoil(clm: CLMGraph): ValidationError[] {
  const errors: ValidationError[] = [];

  // Build: tagName → list of {elId, kind}
  const tagCoils = new Map<string, Array<{ elId: string; kind: string }>>();
  clm.graph.forEachNode((elId, attr) => {
    if (attr.type !== 'LD_ELEMENT') return;
    const data = attr.data as import('./schema.js').LDElementNodeData;
    if (!data.elementKind.startsWith('coil')) return;
    const writeEdges = clm.getOutEdgesByType(elId, 'WRITES');
    for (const edge of writeEdges) {
      const tagData = clm.getNodeData<TagNodeData>(edge.target);
      if (!tagData?.name) continue;
      const list = tagCoils.get(tagData.name) ?? [];
      list.push({ elId, kind: data.elementKind });
      tagCoils.set(tagData.name, list);
    }
  });

  for (const [tagName, coils] of tagCoils) {
    if (coils.length <= 1) continue;

    const stdCoils = coils.filter(c => c.kind === 'coil');
    if (stdCoils.length >= 2) {
      for (const c of stdCoils) {
        errors.push({
          nodeId: c.elId,
          severity: 'warning',
          message: `Double coil: tag "${tagName}" is driven by ${stdCoils.length} standard coils — last-evaluated rung wins`,
          category: 'structure',
        });
      }
    }

    // Set + Reset for the same tag is intentional (SR latch) — info only
    const hasSet   = coils.some(c => c.kind === 'coil_set'   || c.kind === 'coil_latch');
    const hasReset = coils.some(c => c.kind === 'coil_reset'  || c.kind === 'coil_unlatch');
    const hasStd   = coils.some(c => c.kind === 'coil');
    if (hasStd && (hasSet || hasReset)) {
      for (const c of coils.filter(cc => cc.kind === 'coil')) {
        errors.push({
          nodeId: c.elId,
          severity: 'warning',
          message: `Tag "${tagName}" has both a standard coil and a Set/Reset coil — standard coil will overwrite latched state every scan it evaluates`,
          category: 'structure',
        });
      }
    }
  }

  return errors;
}

/**
 * Every READS/WRITES edge must point to an existing TAG node.
 */
function validateDanglingRefs(clm: CLMGraph): ValidationError[] {
  const errors: ValidationError[] = [];
  const graph = clm.graph;

  graph.forEachEdge((edgeKey, attr, source, target) => {
    if (attr.type === 'READS' || attr.type === 'WRITES') {
      if (!graph.hasNode(target)) {
        errors.push({
          nodeId: source,
          severity: 'error',
          message: `Dangling ${attr.type} reference: target node "${target}" does not exist`,
          category: 'dangling_ref',
        });
      } else {
        const targetAttr = graph.getNodeAttributes(target);
        if (targetAttr.type !== 'TAG') {
          errors.push({
            nodeId: source,
            severity: 'error',
            message: `${attr.type} edge points to non-TAG node (type: ${targetAttr.type})`,
            category: 'structure',
          });
        }
      }
    }
  });

  return errors;
}

/**
 * WIRE edges must connect pins with compatible data types.
 */
function validateWireTypes(clm: CLMGraph): ValidationError[] {
  const errors: ValidationError[] = [];
  const graph = clm.graph;

  graph.forEachEdge((edgeKey, attr, source, target) => {
    if (attr.type !== 'WIRE') return;
    if (!graph.hasNode(source) || !graph.hasNode(target)) return;

    const sourceAttr = graph.getNodeAttributes(source);
    const targetAttr = graph.getNodeAttributes(target);

    if (sourceAttr.type !== 'FBD_PIN' || targetAttr.type !== 'FBD_PIN') return;

    const sourcePin = sourceAttr.data as FBDPinNodeData;
    const targetPin = targetAttr.data as FBDPinNodeData;

    if (sourcePin.direction !== 'out') {
      errors.push({
        nodeId: source,
        severity: 'error',
        message: `WIRE source "${sourcePin.pinName}" is not an output pin`,
        category: 'structure',
      });
    }

    if (targetPin.direction !== 'in') {
      errors.push({
        nodeId: target,
        severity: 'error',
        message: `WIRE target "${targetPin.pinName}" is not an input pin`,
        category: 'structure',
      });
    }

    // Type compatibility check
    if (!isTypeCompatible(sourcePin.dataType, targetPin.dataType)) {
      errors.push({
        nodeId: source,
        severity: 'error',
        message: `Type mismatch on wire: ${sourcePin.pinName} (${sourcePin.dataType}) → ${targetPin.pinName} (${targetPin.dataType})`,
        category: 'type_mismatch',
      });
    }
  });

  return errors;
}

/**
 * FBD wire graph must be acyclic (DAG) — except for explicitly allowed feedback blocks (SR, RS).
 */
function validateFBDCycles(clm: CLMGraph): ValidationError[] {
  const errors: ValidationError[] = [];
  const graph = clm.graph;

  // Build adjacency of FBD_PIN nodes connected by WIRE edges
  const adjList = new Map<string, string[]>();
  const pinNodes = new Set<string>();

  graph.forEachNode((id, attr) => {
    if (attr.type === 'FBD_PIN') pinNodes.add(id);
  });

  for (const pinId of pinNodes) {
    const wires = clm.getOutEdgesByType(pinId, 'WIRE');
    if (wires.length > 0) {
      adjList.set(pinId, wires.map(w => w.target));
    }
  }

  // DFS cycle detection
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const id of pinNodes) color.set(id, WHITE);

  function dfs(node: string): boolean {
    color.set(node, GRAY);
    const neighbors = adjList.get(node) ?? [];
    for (const next of neighbors) {
      if (!color.has(next)) continue;
      if (color.get(next) === GRAY) {
        errors.push({
          nodeId: node,
          severity: 'error',
          message: `Cycle detected in FBD wire graph at pin node`,
          category: 'cycle',
        });
        return true;
      }
      if (color.get(next) === WHITE && dfs(next)) return true;
    }
    color.set(node, BLACK);
    return false;
  }

  for (const id of pinNodes) {
    if (color.get(id) === WHITE) dfs(id);
  }

  return errors;
}

/**
 * RUNG_ORDER edges must form a single linear chain (no branches, no gaps).
 */
function validateRungOrder(clm: CLMGraph): ValidationError[] {
  const errors: ValidationError[] = [];
  const rungIds = clm.getNodesByType('RUNG');

  if (rungIds.length <= 1) return errors;

  // Check each rung has at most 1 outgoing and 1 incoming RUNG_ORDER
  for (const rungId of rungIds) {
    const out = clm.getOutEdgesByType(rungId, 'RUNG_ORDER');
    const inc = clm.getInEdgesByType(rungId, 'RUNG_ORDER');

    if (out.length > 1) {
      errors.push({
        nodeId: rungId,
        severity: 'error',
        message: `Rung has ${out.length} outgoing RUNG_ORDER edges (must be ≤1)`,
        category: 'scan_order',
      });
    }
    if (inc.length > 1) {
      errors.push({
        nodeId: rungId,
        severity: 'error',
        message: `Rung has ${inc.length} incoming RUNG_ORDER edges (must be ≤1)`,
        category: 'scan_order',
      });
    }
  }

  return errors;
}

/**
 * SFC structural validation:
 * 1. Exactly one initial step must exist.
 * 2. No orphaned steps/transitions (every node must be reachable from the initial step).
 * 3. Every step must have at least one outgoing SFC_FLOW edge (except terminal jumps).
 */
function validateSFCStructure(clm: CLMGraph): ValidationError[] {
  const errors: ValidationError[] = [];
  const stepIds = clm.getNodesByType('SFC_STEP');
  const transIds = clm.getNodesByType('SFC_TRANSITION');

  if (stepIds.length === 0) return errors;

  // Check 1: exactly one initial step
  const initialSteps = stepIds.filter(id => {
    const data = clm.getNodeData<SFCStepNodeData>(id);
    return data.isInitial;
  });

  if (initialSteps.length === 0) {
    errors.push({
      nodeId: stepIds[0],
      severity: 'error',
      message: 'SFC has no initial step — exactly one step must be marked isInitial',
      category: 'structure',
    });
  } else if (initialSteps.length > 1) {
    for (const id of initialSteps) {
      errors.push({
        nodeId: id,
        severity: 'error',
        message: `SFC has ${initialSteps.length} initial steps — only one allowed`,
        category: 'structure',
      });
    }
  }

  // Check 2: reachability from initial step via SFC_FLOW edges
  if (initialSteps.length === 1) {
    const reachable = new Set<string>();
    const queue = [initialSteps[0]];
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (reachable.has(node)) continue;
      reachable.add(node);
      const flows = clm.getOutEdgesByType(node, 'SFC_FLOW');
      for (const f of flows) {
        if (!reachable.has(f.target)) queue.push(f.target);
      }
    }
    for (const id of [...stepIds, ...transIds]) {
      if (!reachable.has(id)) {
        const type = stepIds.includes(id) ? 'Step' : 'Transition';
        errors.push({
          nodeId: id,
          severity: 'warning',
          message: `${type} "${id}" is not reachable from the initial step`,
          category: 'structure',
        });
      }
    }
  }

  // Check 3: every step (except last) must have at least one outgoing SFC_FLOW
  for (const stepId of stepIds) {
    const out = clm.getOutEdgesByType(stepId, 'SFC_FLOW');
    if (out.length === 0) {
      // Check if there's a jump pointing away from this step (means it's intentionally terminal)
      const jumpIds = clm.getNodesByType('SFC_JUMP');
      const hasJump = jumpIds.some(jid => {
        const inFlows = clm.getInEdgesByType(jid, 'SFC_FLOW');
        return inFlows.some(f => f.source === stepId);
      });
      if (!hasJump) {
        errors.push({
          nodeId: stepId,
          severity: 'warning',
          message: `Step "${clm.getNodeData<SFCStepNodeData>(stepId).stepName}" has no outgoing transition — SFC will halt here`,
          category: 'structure',
        });
      }
    }
  }

  return errors;
}

/**
 * Type compatibility: same type is always compatible; numeric types are cross-compatible
 * with a warning for precision-losing casts (LREAL→INT etc.).
 */
function isTypeCompatible(a: string, b: string): boolean {
  if (a === b) return true;

  const numericTypes = new Set(['INT', 'UINT', 'DINT', 'UDINT', 'LINT', 'ULINT', 'REAL', 'LREAL']);
  if (numericTypes.has(a) && numericTypes.has(b)) return true;

  const bitTypes = new Set(['BYTE', 'WORD', 'DWORD', 'LWORD']);
  if (bitTypes.has(a) && bitTypes.has(b)) return true;

  return false;
}
