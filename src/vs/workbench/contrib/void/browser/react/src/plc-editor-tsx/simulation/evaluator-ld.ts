/**
 * IEC 61131-3 Ladder Diagram evaluator — graph-reachability model.
 *
 * Each rung is modeled as a directed Boolean graph:
 *   - Nodes: junction points (left rail source, right rail sink, inter-element junctions).
 *   - Edges: wire segments. Each edge carries zero or one element (contact/block).
 *     An edge with no element is a plain wire — always conducts.
 *     An edge with a contact conducts per Section 2.1 rules (NO/NC/P/N).
 *     An edge with a coil is a sink edge — records power arrival, writes tag, never propagates.
 *   - Parallel branches add extra edges between the junction nodes that flank their anchor element.
 *
 * Power flow = BFS reachability from the left-rail source node, following only conducting edges.
 * A node is energized if it is reachable. A coil fires if its sink edge's source node is energized.
 *
 * This model is provably general: any series/parallel/nested-branch combination maps to a graph,
 * and BFS reachability is correct for all graphs by definition.
 *
 * powerAfter[elementId]: power exiting right side of element — used by wire renderer.
 * energized[elementId]:  element glyph color — the element individually conducted.
 * These differ at branch anchors: bypass branch can make powerAfter=true while anchor energized=false.
 */

import { CLMGraph } from '../clm/graph.js';
import type { LDElementNodeData, TagNodeData } from '../clm/schema.js';
import { TagState, FBInstanceState, FBContext } from './types.js';
import { executeFB } from './function-blocks.js';

// ─── Public result ────────────────────────────────────────────────────────────

export interface LDEvalResult {
  tagUpdates: TagState;
  energized:  Record<string, boolean>;
  /** Power exiting right side of each element — for wire renderer. */
  powerAfter:    Record<string, boolean>;
  blockPinValues: Record<string, string>;
  fbStates:      Map<string, FBInstanceState>;
  /** Coil power this scan — for P/N coil edge detection next scan. */
  coilPowerThisScan: Record<string, boolean>;
  prevTagValues: TagState;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export function evaluateLadder(
  clm:           CLMGraph,
  tagValues:     TagState,
  fbStates:      Map<string, FBInstanceState>,
  dt:            number,
  prevTagValues:     TagState = {},
  prevCoilPower:     Record<string, boolean> = {},
  forcedValues?:     Record<string, any>,
): LDEvalResult {
  const tagUpdates:       TagState                  = {};
  const energized:        Record<string, boolean>   = {};
  const powerAfter:       Record<string, boolean>   = {};
  const blockPinValues:   Record<string, string>    = {};
  const coilPowerThisScan: Record<string, boolean>  = {};
  const newFbStates       = new Map(fbStates);
  const newPrevTagValues: TagState                  = { ...tagValues };

  // Single force-injection point — only place forcing logic lives.
  const getEffective = (tagName: string): any =>
    forcedValues && tagName in forcedValues
      ? forcedValues[tagName]
      : (tagUpdates[tagName] ?? tagValues[tagName]);

  const ctx: EvalCtx = {
    clm, tagValues, tagUpdates, energized, powerAfter,
    blockPinValues, coilPowerThisScan, fbStates: newFbStates, dt,
    prevTagValues, prevCoilPower, getEffective,
  };

  for (const rungId of getOrderedRungs(clm)) {
    evaluateRung(ctx, rungId);
  }

  return {
    tagUpdates, energized, powerAfter, blockPinValues,
    fbStates: newFbStates, coilPowerThisScan,
    prevTagValues: newPrevTagValues,
  };
}

// ─── Internal context ─────────────────────────────────────────────────────────

interface EvalCtx {
  clm:               CLMGraph;
  tagValues:         TagState;
  tagUpdates:        TagState;
  energized:         Record<string, boolean>;
  powerAfter:        Record<string, boolean>;
  blockPinValues:    Record<string, string>;
  coilPowerThisScan: Record<string, boolean>;
  fbStates:          Map<string, FBInstanceState>;
  dt:                number;
  prevTagValues:     TagState;
  prevCoilPower:     Record<string, boolean>;
  getEffective:      (tagName: string) => any;
}

// ─── Rung ordering ────────────────────────────────────────────────────────────

function getOrderedRungs(clm: CLMGraph): string[] {
  const allRungs = clm.getNodesByType('RUNG');
  if (allRungs.length === 0) return [];
  const nextRung = new Map<string, string>();
  for (const id of allRungs) {
    for (const e of clm.getOutEdgesByType(id, 'RUNG_ORDER')) nextRung.set(id, e.target);
  }
  const hasIncoming = new Set(nextRung.values());
  let cur: string | undefined = allRungs.find(r => !hasIncoming.has(r)) ?? allRungs[0];
  const ordered: string[] = [];
  const visited = new Set<string>();
  while (cur && !visited.has(cur)) { visited.add(cur); ordered.push(cur); cur = nextRung.get(cur); }
  for (const r of allRungs) if (!visited.has(r)) ordered.push(r);
  return ordered;
}

// ─── Rung graph representation ────────────────────────────────────────────────
//
// We build a lightweight directed graph with:
//   - String node IDs (synthetic: 'SOURCE', 'SINK', or junction IDs like 'J_before_<elId>')
//   - Directed edges carrying an optional element reference + conduction state
//
// Graph shape for a rung with main elements [A, B, C] and one branch parallel to B:
//
//   SOURCE --A--> J_A  --B--> J_B  --C--> SINK
//                 |                  ^
//                 +----branchEl------|
//
// The branch adds an extra edge from J_A (junction before B) to J_B (junction after B).
// BFS from SOURCE following conducting edges determines which nodes are reachable.

interface RungEdge {
  from:    string;
  to:      string;
  elId?:   string;  // element ID if this edge carries a contact/block; undefined = plain wire
  isCoil?: boolean; // coil edges are sinks — they fire when `from` is reachable but never propagate
}

interface RungGraph {
  edges: RungEdge[];
  // All node IDs present (union of all from/to)
  nodes: Set<string>;
}

const SOURCE = 'SOURCE';
const SINK   = 'SINK';

/**
 * Build the junction-node graph for a rung.
 *
 * Main-rail elements form a series chain: SOURCE → J0 → J1 → … → Jn → SINK
 * where each Ji is the junction between element i and element i+1.
 * Junction before first main element = SOURCE; junction after last = SINK.
 *
 * For each branch (identified by anchorId on the branch's first element):
 *   - Locate the anchor element on the main rail. Its left junction = junctionBefore[anchor],
 *     its right junction = junctionAfter[anchor].
 *   - Add a series of edges for the branch elements between those two junctions.
 *   - This naturally creates parallel paths, correctly OR-ing the anchor with the branch.
 *
 * Coil elements: placed at the right end of the main rail (or as a parallel branch of the rightmost
 * non-coil). Each coil gets a dedicated sink edge from the junction before it to SINK, tagged isCoil.
 */
function buildRungGraph(
  ctx:    EvalCtx,
  rungId: string,
): RungGraph {
  const children = ctx.clm.getChildren(rungId);
  const allEls: Array<{ id: string; data: LDElementNodeData }> = [];
  for (const cId of children) {
    const attr = ctx.clm.getNodeAttr(cId);
    if (attr?.type === 'LD_ELEMENT') allEls.push({ id: cId, data: attr.data as LDElementNodeData });
  }

  // Partition into main-rail (no branchId) vs branch elements
  const mainRail = allEls.filter(e => !e.data.branchId)
                         .sort((a, b) => a.data.position.x - b.data.position.x);

  // Group branch elements by branchId, sorted left-to-right within each group
  const branchGroups = new Map<string, Array<{ id: string; data: LDElementNodeData }>>();
  for (const el of allEls) {
    if (!el.data.branchId) continue;
    const g = branchGroups.get(el.data.branchId) ?? [];
    g.push(el);
    branchGroups.set(el.data.branchId, g);
  }
  for (const [, g] of branchGroups) g.sort((a, b) => a.data.position.x - b.data.position.x);

  const edges: RungEdge[] = [];
  const nodes = new Set<string>([SOURCE, SINK]);

  // Build junction IDs for main-rail element boundaries.
  // junctionBefore[i] = left side of mainRail[i]; junctionAfter[i] = right side.
  // junctionBefore[0] = SOURCE; junctionAfter[last] depends on element type.
  const contacts = mainRail.filter(e => !e.data.elementKind.startsWith('coil'));
  const coils    = mainRail.filter(e =>  e.data.elementKind.startsWith('coil'));

  // Build junction node IDs for each contact/block (the non-terminal elements)
  // J_before_[id] and J_after_[id] — but consecutive elements share a junction:
  //   junctionAfter[i] === junctionBefore[i+1]
  // We generate one junction ID per inter-element gap.
  const junctionBefore: Record<string, string> = {};
  const junctionAfter:  Record<string, string> = {};

  if (contacts.length === 0) {
    // Rung has only coils (or is empty) — SOURCE directly connects to SINK for coils
  } else {
    junctionBefore[contacts[0].id] = SOURCE;
    for (let i = 0; i < contacts.length - 1; i++) {
      const jId = `J_${contacts[i].id}_${contacts[i + 1].id}`;
      junctionAfter[contacts[i].id]      = jId;
      junctionBefore[contacts[i + 1].id] = jId;
      nodes.add(jId);
    }
    junctionAfter[contacts[contacts.length - 1].id] = coils.length > 0 ? `J_pre_coils` : SINK;
    if (coils.length > 0) nodes.add('J_pre_coils');
  }

  // Add edges for main-rail contacts/blocks
  for (const el of contacts) {
    const from = junctionBefore[el.id];
    const to   = junctionAfter[el.id];
    edges.push({ from, to, elId: el.id });
  }

  // Add sink edges for coils (from J_pre_coils or SOURCE if no contacts, to SINK)
  const coilSource = contacts.length > 0 ? (coils.length > 0 ? 'J_pre_coils' : SINK) : SOURCE;
  for (const coil of coils) {
    edges.push({ from: coilSource, to: SINK, elId: coil.id, isCoil: true });
  }

  // Add edges for each branch group
  for (const [, group] of branchGroups) {
    const anchorId = group[0]?.data.anchorId;
    if (!anchorId) continue;

    // Locate the anchor on the main rail
    const anchorIsContact = contacts.some(c => c.id === anchorId);
    if (!anchorIsContact) continue;  // anchor must be a contact on main rail

    const leftJunction  = junctionBefore[anchorId];
    const rightJunction = junctionAfter[anchorId];
    if (!leftJunction || !rightJunction) continue;

    if (group.length === 0) {
      // Empty branch = plain wire (short-circuit bypass of anchor)
      edges.push({ from: leftJunction, to: rightJunction });
    } else {
      // Build series chain for branch elements between the two anchor junctions
      let prevNode = leftJunction;
      for (let i = 0; i < group.length; i++) {
        const bel = group[i];
        const nextNode = i === group.length - 1
          ? rightJunction
          : `BJ_${group[i].id}_${group[i + 1].id}`;
        if (nextNode !== rightJunction) nodes.add(nextNode);
        edges.push({ from: prevNode, to: nextNode, elId: bel.id });
        prevNode = nextNode;
      }
    }
  }

  return { edges, nodes };
}

// ─── Rung evaluation ──────────────────────────────────────────────────────────

function evaluateRung(ctx: EvalCtx, rungId: string): void {
  const graph = buildRungGraph(ctx, rungId);
  if (graph.edges.length === 0) return;

  // Step 1: Evaluate conduction state of every edge
  // An edge conducts if:
  //   - it has no element (plain wire) → always true
  //   - it has a contact/block → contactConducts(...)
  //   - it has a coil → coil edges are NEVER used for traversal (isCoil=true edges are sinks)
  const conducts = new Map<RungEdge, boolean>();
  for (const edge of graph.edges) {
    if (edge.isCoil) {
      conducts.set(edge, false); // coil edges don't propagate — evaluated separately
      continue;
    }
    if (!edge.elId) {
      conducts.set(edge, true); // plain wire
      continue;
    }
    const attr = ctx.clm.getNodeAttr(edge.elId);
    if (!attr) { conducts.set(edge, false); continue; }
    const data = attr.data as LDElementNodeData;
    if (data.elementKind === 'fb_call') {
      // FB call conduction is computed during BFS (needs to know if source node is reachable)
      // Defer — mark as needing evaluation
      conducts.set(edge, false); // placeholder; will be re-evaluated during BFS
    } else {
      conducts.set(edge, contactConducts(ctx, edge.elId, data));
    }
  }

  // Step 2: BFS reachability from SOURCE through conducting non-coil edges
  const reachable = new Set<string>([SOURCE]);
  const queue: string[] = [SOURCE];
  // Track which edges we need to re-evaluate for FB calls (needs power-in to be known)
  const fbEdges = graph.edges.filter(e => {
    if (!e.elId || e.isCoil) return false;
    const attr = ctx.clm.getNodeAttr(e.elId);
    return attr && (attr.data as LDElementNodeData).elementKind === 'fb_call';
  });

  // Re-evaluate FB-call edges once source node reachability is known
  // We need an iterative approach: BFS, then handle FB edges that became reachable
  let changed = true;
  while (changed) {
    changed = false;
    // Process the queue
    let head = 0;
    while (head < queue.length) {
      const node = queue[head++];
      for (const edge of graph.edges) {
        if (edge.from !== node || edge.isCoil) continue;
        // Re-evaluate FB edges now that we know `from` is reachable
        if (edge.elId) {
          const attr = ctx.clm.getNodeAttr(edge.elId);
          if (attr && (attr.data as LDElementNodeData).elementKind === 'fb_call') {
            const fbResult = evaluateFBCall(ctx, edge.elId, attr.data as LDElementNodeData, true);
            conducts.set(edge, fbResult);
          }
        }
        if (conducts.get(edge) && !reachable.has(edge.to)) {
          reachable.add(edge.to);
          queue.push(edge.to);
          changed = true;
        }
      }
    }
    // Check FB edges from non-reachable nodes (they don't conduct — but mark them)
    for (const edge of fbEdges) {
      if (!reachable.has(edge.from) && conducts.get(edge) === false) {
        // Still false — no change
      }
    }
  }

  // Step 3: Write energized and powerAfter for all contact/block elements
  // For each contact element on a non-coil edge:
  //   energized[id] = the element's own conduction AND its source node was reachable
  //   powerAfter[id] = the target junction node is reachable (OR of all parallel paths through it)
  for (const edge of graph.edges) {
    if (!edge.elId || edge.isCoil) continue;
    const data = (ctx.clm.getNodeAttr(edge.elId)?.data) as LDElementNodeData | undefined;
    if (!data) continue;

    const sourceReachable = reachable.has(edge.from);
    const targetReachable = reachable.has(edge.to);
    const edgeConducts    = !!conducts.get(edge);

    // energized = the element individually conducted (source was live AND it passed power)
    ctx.energized[edge.elId]  = sourceReachable && edgeConducts;
    // powerAfter = power exits right side (target junction reachable, possibly via parallel branch)
    ctx.powerAfter[edge.elId] = targetReachable;
  }

  // Step 4: Fire coil sink edges — coil fires if its source node is reachable
  for (const edge of graph.edges) {
    if (!edge.elId || !edge.isCoil) continue;
    const data = (ctx.clm.getNodeAttr(edge.elId)?.data) as LDElementNodeData | undefined;
    if (!data) continue;
    const powerIn = reachable.has(edge.from);
    evaluateCoilElement(ctx, edge.elId, data, powerIn);
  }

}

// ─── Contact conduction ───────────────────────────────────────────────────────

function contactConducts(
  ctx:   EvalCtx,
  elId:  string,
  data:  LDElementNodeData,
): boolean {
  const tagName = getReadTag(ctx.clm, elId);
  if (!tagName) return false;

  const val     = toBool(ctx.getEffective(tagName));
  const prevVal = toBool(ctx.prevTagValues[tagName]);

  switch (data.elementKind) {
    case 'contact_no': return val;
    case 'contact_nc': return !val;
    case 'contact_p':  return val && !prevVal;   // rising edge — exactly one scan
    case 'contact_n':  return !val && prevVal;   // falling edge — exactly one scan
    default:           return val;
  }
}

// ─── FB call evaluation ───────────────────────────────────────────────────────

function evaluateFBCall(
  ctx:     EvalCtx,
  elId:    string,
  data:    LDElementNodeData,
  powerIn: boolean,
): boolean {
  if (!powerIn || !data.fbType) return false;

  // Inline stateless math / compare / selector operations
  const inlineOps = new Set(['EQ','NE','GT','GE','LT','LE','ADD','SUB','MUL','DIV','MOD','ABS','SQRT','MOVE','SEL','LIMIT','MIN','MAX']);
  if (inlineOps.has(data.fbType)) {
    // Collect pin → tag mappings from READS edges
    const pinToTag: Record<string, string> = {};
    for (const edge of ctx.clm.getOutEdgesByType(elId, 'READS')) {
      const tagData = ctx.clm.getNodeData<TagNodeData>(edge.target);
      const pin = (edge.data as any)?.pin || 'IN';
      pinToTag[pin] = tagData.name;
    }
    const getVal = (pin: string): any => ctx.getEffective(pinToTag[pin] ?? '') ?? 0;
    const toNum = (v: any): number => {
      if (typeof v === 'number') return v;
      if (typeof v === 'boolean') return v ? 1 : 0;
      const n = parseFloat(String(v ?? '0'));
      return isNaN(n) ? 0 : n;
    };
    const toBoolLocal = (v: any): boolean => {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      return v === 'TRUE' || v === 'true' || v === '1';
    };
    const a = toNum(getVal('IN1') ?? getVal('IN'));
    const b = toNum(getVal('IN2'));
    let result: any;
    switch (data.fbType) {
      case 'EQ': result = a === b; break;
      case 'NE': result = a !== b; break;
      case 'GT': result = a > b; break;
      case 'GE': result = a >= b; break;
      case 'LT': result = a < b; break;
      case 'LE': result = a <= b; break;
      case 'ADD': result = a + b; break;
      case 'SUB': result = a - b; break;
      case 'MUL': result = a * b; break;
      case 'DIV': result = b !== 0 ? a / b : 0; break;
      case 'MOD': result = b !== 0 ? a % b : 0; break;
      case 'ABS': result = Math.abs(a); break;
      case 'SQRT': result = Math.sqrt(Math.max(0, a)); break;
      case 'MOVE': result = getVal('IN'); break;
      case 'SEL': result = toBoolLocal(getVal('G')) ? toNum(getVal('IN1')) : toNum(getVal('IN0')); break;
      case 'LIMIT': { const mn = toNum(getVal('MN')); const mx = toNum(getVal('MX')); result = Math.max(mn, Math.min(mx, a)); break; }
      case 'MIN': result = Math.min(a, b); break;
      case 'MAX': result = Math.max(a, b); break;
      default: result = false;
    }
    // Write result to output tag via WRITES edges
    for (const edge of ctx.clm.getOutEdgesByType(elId, 'WRITES')) {
      const tagData = ctx.clm.getNodeData<TagNodeData>(edge.target);
      ctx.tagUpdates[tagData.name] = result;
    }
    ctx.blockPinValues[`${elId}:OUT`] = String(result);
    ctx.energized[elId] = true;
    ctx.powerAfter[elId] = typeof result === 'boolean' ? result : true;
    return typeof result === 'boolean' ? result : true;
  }

  const instanceKey = data.instanceName || elId;
  const inputs: Record<string, any> = {};

  const readEdges = ctx.clm.getOutEdgesByType(elId, 'READS');
  for (const edge of readEdges) {
    const tagData = ctx.clm.getNodeData<TagNodeData>(edge.target);
    const pin = (edge.data as any)?.pin || 'IN';
    inputs[pin] = ctx.getEffective(tagData.name) ?? false;
  }
  if (readEdges.length === 1 && inputs['IN'] === undefined) {
    const tagData = ctx.clm.getNodeData<TagNodeData>(readEdges[0].target);
    inputs['IN'] = ctx.getEffective(tagData.name) ?? false;
  }

  const result = executeFB(data.fbType, inputs, ctx.fbStates.get(instanceKey), { dt: ctx.dt });
  ctx.fbStates.set(instanceKey, result.state);

  for (const edge of ctx.clm.getOutEdgesByType(elId, 'WRITES')) {
    const tagData = ctx.clm.getNodeData<TagNodeData>(edge.target);
    const pin = (edge.data as any)?.pin || 'Q';
    if (result.outputs[pin] !== undefined) ctx.tagUpdates[tagData.name] = result.outputs[pin];
  }
  for (const [pin, val] of Object.entries(result.outputs)) {
    ctx.blockPinValues[`${elId}:${pin}`] = String(val);
  }

  return toBool(result.outputs.Q ?? result.outputs.Q1 ?? false);
}

// ─── Coil evaluation ──────────────────────────────────────────────────────────

function evaluateCoilElement(
  ctx:     EvalCtx,
  elId:    string,
  data:    LDElementNodeData,
  powerIn: boolean,
): void {
  // Record for P/N edge detection on next scan
  ctx.coilPowerThisScan[elId] = powerIn;
  // Glyph = coil receiving power
  ctx.energized[elId] = powerIn;
  // Coil is terminal — no power exits
  ctx.powerAfter[elId] = false;

  const tagName = getWriteTag(ctx.clm, elId);
  if (!tagName) return;

  const prevPower = toBool(ctx.prevCoilPower[elId]);

  switch (data.elementKind) {
    case 'coil':
      // Non-retentive: recomputed every scan
      ctx.tagUpdates[tagName] = powerIn;
      break;

    case 'coil_negated':
      // Writes inverse of power — true when NOT energized
      ctx.tagUpdates[tagName] = !powerIn;
      break;

    case 'coil_set':
    case 'coil_latch':
      // Retentive SET: only acts when energized; never clears
      if (powerIn) ctx.tagUpdates[tagName] = true;
      break;

    case 'coil_reset':
    case 'coil_unlatch':
      // Retentive RESET: only acts when energized; never sets
      if (powerIn) ctx.tagUpdates[tagName] = false;
      break;

    case 'coil_p':
      // Positive sensing: 1-scan pulse on power FALSE→TRUE transition
      ctx.tagUpdates[tagName] = powerIn && !prevPower;
      break;

    case 'coil_n':
      // Negative sensing: 1-scan pulse on power TRUE→FALSE transition
      ctx.tagUpdates[tagName] = !powerIn && prevPower;
      break;
  }
}

// ─── Tag name helpers ─────────────────────────────────────────────────────────

function getReadTag(clm: CLMGraph, elementId: string): string | undefined {
  const edges = clm.getOutEdgesByType(elementId, 'READS');
  if (edges.length === 0) return undefined;
  return clm.getNodeData<TagNodeData>(edges[0].target)?.name;
}

function getWriteTag(clm: CLMGraph, elementId: string): string | undefined {
  const edges = clm.getOutEdgesByType(elementId, 'WRITES');
  if (edges.length === 0) return undefined;
  return clm.getNodeData<TagNodeData>(edges[0].target)?.name;
}

function toBool(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v === 'TRUE' || v === 'true' || v === '1';
  // Graceful fallback for array types: use index 0
  if (Array.isArray(v)) return toBool(v[0]);
  return !!v;
}
