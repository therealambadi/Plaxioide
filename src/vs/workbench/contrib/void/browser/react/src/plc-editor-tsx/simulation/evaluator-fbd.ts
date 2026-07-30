import { CLMGraph } from '../clm/graph.js';
import type { FBDBlockNodeData, FBDPinNodeData, TagNodeData } from '../clm/schema.js';
import { TagState, FBInstanceState, FBContext } from './types.js';
import { executeFB } from './function-blocks.js';

export interface FBDEvalResult {
  tagUpdates: TagState;
  energized: Record<string, boolean>;
  fbStates: Map<string, FBInstanceState>;
  fbdPinValues: Record<string, Record<string, string>>;
}

export function evaluateFBD(
  clm: CLMGraph,
  tagValues: TagState,
  fbStates: Map<string, FBInstanceState>,
  dt: number,
): FBDEvalResult {
  const tagUpdates: TagState = {};
  const energized: Record<string, boolean> = {};
  const newFbStates = new Map(fbStates);
  const fbdPinValues: Record<string, Record<string, string>> = {};

  const blockIds = clm.getNodesByType('FBD_BLOCK');
  if (blockIds.length === 0) return { tagUpdates, energized, fbStates: newFbStates, fbdPinValues };

  // Build dependency graph and topologically sort
  const sorted = topologicalSort(clm, blockIds);

  // Pin value cache: pinNodeId → computed value
  const pinValues = new Map<string, any>();

  for (const blockId of sorted) {
    const blockData = clm.getNodeData<FBDBlockNodeData>(blockId);
    executeBlock(clm, blockId, blockData, tagValues, tagUpdates, pinValues, newFbStates, energized, fbdPinValues, dt);
  }

  return { tagUpdates, energized, fbStates: newFbStates, fbdPinValues };
}

function topologicalSort(clm: CLMGraph, blockIds: string[]): string[] {
  // Build adjacency: block A depends on block B if a wire goes from B's output pin to A's input pin
  const blockOfPin = new Map<string, string>();
  const deps = new Map<string, Set<string>>();

  for (const blockId of blockIds) {
    deps.set(blockId, new Set());
    const pinEdges = clm.getOutEdgesByType(blockId, 'HAS_PIN');
    for (const pe of pinEdges) {
      blockOfPin.set(pe.target, blockId);
    }
  }

  // For each block's input pins, find incoming WIRE edges → source pin → source block
  for (const blockId of blockIds) {
    const pinEdges = clm.getOutEdgesByType(blockId, 'HAS_PIN');
    for (const pe of pinEdges) {
      const pinData = clm.getNodeData<FBDPinNodeData>(pe.target);
      if (pinData.direction !== 'in') continue;
      const inWires = clm.getInEdgesByType(pe.target, 'WIRE');
      for (const wire of inWires) {
        const srcBlock = blockOfPin.get(wire.source);
        if (srcBlock && srcBlock !== blockId) {
          deps.get(blockId)!.add(srcBlock);
        }
      }
    }
  }

  // Kahn's algorithm
  const inDegree = new Map<string, number>();
  for (const id of blockIds) inDegree.set(id, deps.get(id)!.size);

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const [id, depSet] of deps) {
      if (depSet.has(node)) {
        depSet.delete(node);
        inDegree.set(id, inDegree.get(id)! - 1);
        if (inDegree.get(id) === 0) queue.push(id);
      }
    }
  }

  // Append any remaining (cycles) in original order
  for (const id of blockIds) {
    if (!sorted.includes(id)) sorted.push(id);
  }

  return sorted;
}

function executeBlock(
  clm: CLMGraph,
  blockId: string,
  blockData: FBDBlockNodeData,
  tagValues: TagState,
  tagUpdates: TagState,
  pinValues: Map<string, any>,
  fbStates: Map<string, FBInstanceState>,
  energized: Record<string, boolean>,
  fbdPinValues: Record<string, Record<string, string>>,
  dt: number,
): void {
  const pinEdges = clm.getOutEdgesByType(blockId, 'HAS_PIN');
  const inputPins: Array<{ pinId: string; data: FBDPinNodeData }> = [];
  const outputPins: Array<{ pinId: string; data: FBDPinNodeData }> = [];

  for (const pe of pinEdges) {
    const pinData = clm.getNodeData<FBDPinNodeData>(pe.target);
    if (pinData.direction === 'in') {
      inputPins.push({ pinId: pe.target, data: pinData });
    } else {
      outputPins.push({ pinId: pe.target, data: pinData });
    }
  }

  // Resolve input values
  const inputs: Record<string, any> = {};
  for (const pin of inputPins) {
    inputs[pin.data.pinName] = resolveInputPin(clm, pin.pinId, pin.data, tagValues, tagUpdates, pinValues);
  }

  // Execute based on block type
  let outputs: Record<string, any> = {};
  const type = blockData.blockType;

  if (type === 'IN_VARIABLE') {
    // Read tag
    const readEdges = clm.getOutEdgesByType(blockId, 'READS');
    let val: any = false;
    if (readEdges.length > 0) {
      const tagData = clm.getNodeData<TagNodeData>(readEdges[0].target);
      val = tagUpdates[tagData.name] ?? tagValues[tagData.name] ?? false;
    }
    outputs = { OUT: val };
  } else if (type === 'OUT_VARIABLE') {
    // Write tag
    const val = inputs['IN'] ?? inputs[Object.keys(inputs)[0]] ?? false;
    const writeEdges = clm.getOutEdgesByType(blockId, 'WRITES');
    if (writeEdges.length > 0) {
      const tagData = clm.getNodeData<TagNodeData>(writeEdges[0].target);
      tagUpdates[tagData.name] = val;
    }
    outputs = { OUT: val };
  } else if (isLogicGate(type)) {
    outputs = executeLogicGate(type, inputs);
  } else if (isArithmeticOp(type)) {
    outputs = executeArithmetic(type, inputs);
  } else if (isComparisonOp(type)) {
    outputs = executeComparison(type, inputs);
  } else if (isSelectorOp(type)) {
    outputs = executeSelector(type, inputs);
  } else {
    // Timer/Counter/other FB
    const instanceKey = blockData.instanceName || blockId;
    const ctx: FBContext = { dt };
    const result = executeFB(type, inputs, fbStates.get(instanceKey), ctx);
    fbStates.set(instanceKey, result.state);
    outputs = result.outputs;
  }

  // Write outputs to pin cache and collect for UI display
  const instanceKey = blockData.instanceName || blockId;
  const blockPins: Record<string, string> = {};
  for (const pin of outputPins) {
    let val = outputs[pin.data.pinName] ?? outputs['OUT'] ?? outputs['Q'] ?? false;
    if (pin.data.negated) val = !toBool(val);
    pinValues.set(pin.pinId, val);
    blockPins[pin.data.pinName] = String(val);
  }
  if (Object.keys(blockPins).length > 0) fbdPinValues[instanceKey] = blockPins;
  // Also key by blockId so the canvas can look up by node.id
  if (instanceKey !== blockId) fbdPinValues[blockId] = blockPins;

  energized[blockId] = toBool(outputs['OUT'] ?? outputs['Q'] ?? outputs['Q1'] ?? false);
}

function resolveInputPin(
  clm: CLMGraph,
  pinId: string,
  pinData: FBDPinNodeData,
  tagValues: TagState,
  tagUpdates: TagState,
  pinValues: Map<string, any>,
): any {
  // Check for incoming WIRE
  const wires = clm.getInEdgesByType(pinId, 'WIRE');
  if (wires.length > 0) {
    let val = pinValues.get(wires[0].source) ?? false;
    const wireData = clm.getNodeAttr(pinId); // check negation from wire edge data
    if (pinData.negated) val = !toBool(val);
    return val;
  }
  // No wire — check if pin reads a tag directly (rare in FBD, but possible)
  return false;
}

function isLogicGate(type: string): boolean {
  return ['AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR'].includes(type);
}

function isArithmeticOp(type: string): boolean {
  return ['ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'ABS', 'SQRT', 'NEG'].includes(type);
}

function isComparisonOp(type: string): boolean {
  return ['GT', 'GE', 'LT', 'LE', 'EQ', 'NE'].includes(type);
}

function isSelectorOp(type: string): boolean {
  return ['MUX', 'SEL', 'LIMIT', 'MOVE'].includes(type);
}

function executeLogicGate(type: string, inputs: Record<string, any>): Record<string, any> {
  const vals = Object.values(inputs).map(toBool);
  switch (type) {
    case 'AND': return { OUT: vals.every(v => v) };
    case 'OR': return { OUT: vals.some(v => v) };
    case 'NOT': return { OUT: !vals[0] };
    case 'XOR': return { OUT: vals.reduce((a, b) => a !== b, false) };
    case 'NAND': return { OUT: !vals.every(v => v) };
    case 'NOR': return { OUT: !vals.some(v => v) };
    default: return { OUT: false };
  }
}

function executeArithmetic(type: string, inputs: Record<string, any>): Record<string, any> {
  const vals = Object.values(inputs).map(toNum);
  switch (type) {
    case 'ADD': return { OUT: vals.reduce((a, b) => a + b, 0) };
    case 'SUB': return { OUT: vals.length >= 2 ? vals[0] - vals[1] : -vals[0] };
    case 'MUL': return { OUT: vals.reduce((a, b) => a * b, 1) };
    case 'DIV': return { OUT: vals[1] !== 0 ? vals[0] / vals[1] : 0 };
    case 'MOD': return { OUT: vals[1] !== 0 ? vals[0] % vals[1] : 0 };
    case 'ABS': return { OUT: Math.abs(vals[0]) };
    case 'SQRT': return { OUT: Math.sqrt(Math.max(0, vals[0])) };
    case 'NEG': return { OUT: -vals[0] };
    default: return { OUT: 0 };
  }
}

function executeComparison(type: string, inputs: Record<string, any>): Record<string, any> {
  const vals = Object.values(inputs).map(toNum);
  const [a, b] = [vals[0] ?? 0, vals[1] ?? 0];
  switch (type) {
    case 'GT': return { OUT: a > b };
    case 'GE': return { OUT: a >= b };
    case 'LT': return { OUT: a < b };
    case 'LE': return { OUT: a <= b };
    case 'EQ': return { OUT: a === b };
    case 'NE': return { OUT: a !== b };
    default: return { OUT: false };
  }
}

function executeSelector(type: string, inputs: Record<string, any>): Record<string, any> {
  const keys = Object.keys(inputs);
  switch (type) {
    case 'SEL': {
      const g = toBool(inputs['G'] ?? inputs[keys[0]]);
      return { OUT: g ? (inputs['IN1'] ?? inputs[keys[2]]) : (inputs['IN0'] ?? inputs[keys[1]]) };
    }
    case 'MUX': {
      const k = toNum(inputs['K'] ?? inputs[keys[0]]);
      const vals = keys.slice(1).map(k => inputs[k]);
      return { OUT: vals[Math.max(0, Math.min(k, vals.length - 1))] ?? 0 };
    }
    case 'LIMIT': {
      const mn = toNum(inputs['MN'] ?? inputs[keys[0]]);
      const val = toNum(inputs['IN'] ?? inputs[keys[1]]);
      const mx = toNum(inputs['MX'] ?? inputs[keys[2]]);
      return { OUT: Math.max(mn, Math.min(mx, val)) };
    }
    case 'MOVE': return { OUT: inputs['IN'] ?? inputs[keys[0]] ?? 0 };
    default: return { OUT: 0 };
  }
}

function toBool(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v === 'TRUE' || v === 'true' || v === '1';
  return !!v;
}

function toNum(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}
