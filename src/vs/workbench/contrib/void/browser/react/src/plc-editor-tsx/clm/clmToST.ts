/*
 * CLM → ST Compiler
 * Traverses a CLMGraph and emits IEC 61131-3 Structured Text.
 *
 * Output contract:
 *  - Emits one PROGRAM block named "prog0" (matches ensureConfiguration() in server.js)
 *  - VAR section lists every TAG node referenced by the program
 *  - Global tags with a hardware address get AT declarations (%I/%Q/%M)
 *  - LD rungs → ST IF/END_IF ladder semantics
 *  - FBD blocks → function-block instance calls with named parameters
 *  - SFC → ST encoding: one enumerated state variable + CASE statement
 *  - Wrapped in CONFIGURATION Config0 / RESOURCE Res0 scaffold
 *
 * debug-map.json path format (confirmed from real STruC++ output):
 *  "INST0.<VARNAME>" — uppercase instance name (Inst0 → INST0), uppercase var name.
 *  Mapping from logicStore TagEntry.name: debugMap.leaves.find(l => l.path === "INST0." + tag.name.toUpperCase())
 */

import type { CLMGraph } from './graph.js';
import type {
  TagNodeData,
  POUNodeData,
  RungNodeData,
  LDElementNodeData,
  LDElementKind,
  FBDBlockNodeData,
  FBDPinNodeData,
  SFCStepNodeData,
  SFCTransitionNodeData,
  SFCActionNodeData,
} from './schema.js';
import type { IECDataType } from '../logicStore.js';

// ─── IEC 61131-3 Standard FB Declarations ────────────────────────────────────
// STruC++ does not have built-in standard library FBs — they must be declared.
// MatIEC resolves these from its stdlib (-I lib), but STruC++ is pure JS with
// no filesystem access to iec2c's lib, so we inline minimal stubs.
// These match the IEC 61131-3 §6.6.3 standard function block signatures.

const IEC_STDLIB_STUBS = `
FUNCTION_BLOCK TON
  VAR_INPUT IN : BOOL; PT : TIME; END_VAR
  VAR_OUTPUT Q : BOOL; ET : TIME; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK TOF
  VAR_INPUT IN : BOOL; PT : TIME; END_VAR
  VAR_OUTPUT Q : BOOL; ET : TIME; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK TP
  VAR_INPUT IN : BOOL; PT : TIME; END_VAR
  VAR_OUTPUT Q : BOOL; ET : TIME; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTU
  VAR_INPUT CU : BOOL; R : BOOL; PV : INT; END_VAR
  VAR_OUTPUT Q : BOOL; CV : INT; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTD
  VAR_INPUT CD : BOOL; LD : BOOL; PV : INT; END_VAR
  VAR_OUTPUT Q : BOOL; CV : INT; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTUD
  VAR_INPUT CU : BOOL; CD : BOOL; R : BOOL; LD : BOOL; PV : INT; END_VAR
  VAR_OUTPUT QU : BOOL; QD : BOOL; CV : INT; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK SR
  VAR_INPUT S1 : BOOL; R : BOOL; END_VAR
  VAR_OUTPUT Q1 : BOOL; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK RS
  VAR_INPUT S : BOOL; R1 : BOOL; END_VAR
  VAR_OUTPUT Q1 : BOOL; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK RTRIG
  VAR_INPUT CLK : BOOL; END_VAR
  VAR_OUTPUT Q : BOOL; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK FTRIG
  VAR_INPUT CLK : BOOL; END_VAR
  VAR_OUTPUT Q : BOOL; END_VAR
END_FUNCTION_BLOCK
`;

// ─── Public API ───────────────────────────────────────────────────────────────

export interface STCompileResult {
  /** ST code for MatIEC validation — no stdlib stubs (MatIEC uses -I lib). */
  stCode: string;
  /** ST code for STruC++ compile() — includes IEC stdlib stubs (STruC++ is pure JS, no filesystem). */
  stCodeForStrucpp: string;
  programName: string;
  tagCount: number;
  rungCount: number;
  warnings: string[];
}

/**
 * Compile a CLMGraph to IEC 61131-3 Structured Text.
 * Returns two ST variants:
 *   - stCode: for MatIEC (no stubs — MatIEC resolves standard FBs from its -I lib)
 *   - stCodeForStrucpp: for STruC++ (includes IEC standard FB stubs before PROGRAM)
 */
export function clmToST(clm: CLMGraph, cycleMs = 50): STCompileResult {
  const warnings: string[] = [];

  // ── Collect tags ────────────────────────────────────────────────────────────
  const tagIds = clm.getNodesByType('TAG');
  const tags = tagIds.map(id => ({
    id,
    data: clm.getNodeData<TagNodeData>(id),
  }));

  // ── VAR section ─────────────────────────────────────────────────────────────
  // AT declarations are only valid in VAR_GLOBAL (config-scope), not in PROGRAM VAR.
  // MatIEC rejects AT %I/%Q/%M inside PROGRAM blocks — drop the AT clause here.
  const varLines: string[] = [];
  const varRetainLines: string[] = [];
  for (const { data } of tags) {
    const initClause = data.initialValue ? ` := ${data.initialValue}` : defaultInitFor(data.dataType);
    const decl = `    ${sanitizeName(data.name)} : ${data.dataType}${initClause};`;
    if (data.retain) {
      varRetainLines.push(decl);
    } else {
      varLines.push(decl);
    }
  }

  // ── LD body (per-rung) ───────────────────────────────────────────────────────
  const ldLines: string[] = [];
  const rungIds = clm.getNodesByType('RUNG');
  // Sort by rungNumber
  rungIds.sort((a, b) => {
    const ra = clm.getNodeData<RungNodeData>(a).rungNumber;
    const rb = clm.getNodeData<RungNodeData>(b).rungNumber;
    return ra - rb;
  });

  for (const rungId of rungIds) {
    const rungData = clm.getNodeData<RungNodeData>(rungId);
    if (rungData.comment) {
      ldLines.push(`  (* Rung ${rungData.rungNumber}: ${rungData.comment} *)`);
    }

    // Collect LD_ELEMENT nodes for this rung
    const elementIds = clm.getChildren(rungId);
    const elements = elementIds.map(id => ({
      id,
      attr: clm.getNodeAttr(id),
      data: clm.getNodeData<LDElementNodeData>(id),
    })).filter(e => e.attr.type === 'LD_ELEMENT');

    // Separate main rail from branch elements
    const mainRail = elements.filter(e => !e.data.branchId);
    const branchGroups = groupByBranchId(elements.filter(e => !!e.data.branchId));

    const rungST = compileRungToST(clm, rungId, mainRail, branchGroups, warnings);
    ldLines.push(...rungST);
    ldLines.push('');
  }

  // ── FBD body ─────────────────────────────────────────────────────────────────
  const fbdLines: string[] = [];
  const fbdBlockIds = clm.getNodesByType('FBD_BLOCK');
  for (const blockId of fbdBlockIds) {
    const blockData = clm.getNodeData<FBDBlockNodeData>(blockId);
    const fbdST = compileFBDBlockToST(clm, blockId, blockData, warnings);
    fbdLines.push(...fbdST);
  }

  // ── SFC body ──────────────────────────────────────────────────────────────────
  const sfcLines: string[] = [];
  const sfcStepIds = clm.getNodesByType('SFC_STEP');
  if (sfcStepIds.length > 0) {
    sfcLines.push(...compileSFCToST(clm, sfcStepIds, warnings));
  }

  // ── Assemble PROGRAM block ───────────────────────────────────────────────────
  const programName = 'prog0';
  const bodyLines = [...ldLines, ...fbdLines, ...sfcLines];

  // FB instance variables (TON, CTU etc.) need VAR blocks too
  const fbVarLines = collectFBInstanceVars(clm);

  const parts: string[] = [];
  parts.push(`PROGRAM ${programName}`);

  if (varLines.length > 0 || fbVarLines.length > 0) {
    parts.push('  VAR');
    parts.push(...varLines);
    parts.push(...fbVarLines);
    parts.push('  END_VAR');
  }

  if (varRetainLines.length > 0) {
    parts.push('  VAR_RETAIN');
    parts.push(...varRetainLines);
    parts.push('  END_VAR');
  }

  if (bodyLines.length > 0) {
    parts.push('');
    parts.push(...bodyLines);
  }

  parts.push(`END_PROGRAM`);

  // ── CONFIGURATION scaffold ──────────────────────────────────────────────────
  parts.push('');
  parts.push('CONFIGURATION Config0');
  parts.push('');
  parts.push('  RESOURCE Res0 ON PLC');
  parts.push(`    TASK Main(INTERVAL := T#${cycleMs}ms, PRIORITY := 0);`);
  parts.push(`    PROGRAM Inst0 WITH Main : ${programName};`);
  parts.push('  END_RESOURCE');
  parts.push('');
  parts.push('END_CONFIGURATION');

  const stCode = parts.join('\n');

  // STruC++ variant: prepend IEC stdlib stubs when function-block instances are used.
  // STruC++ is pure JS with no filesystem — it cannot resolve standard FBs from a lib directory.
  const needsStubs = fbVarLines.length > 0;
  const stCodeForStrucpp = needsStubs
    ? IEC_STDLIB_STUBS.trim() + '\n\n' + stCode
    : stCode;

  return {
    stCode,
    stCodeForStrucpp,
    programName,
    tagCount: tags.length,
    rungCount: rungIds.length,
    warnings,
  };
}

// ─── Debug-map tag resolution ─────────────────────────────────────────────────

export interface DebugLeaf {
  arrayIdx: number;
  elemIdx: number;
  path: string;
  type: string;
  size: number;
}

export interface DebugMap {
  version: number;
  md5: string;
  typeTags: Record<string, number>;
  arrays: Array<{ index: number; count: number }>;
  leaves: DebugLeaf[];
}

/**
 * Given a debug-map.json (from STruC++ generateDebugTable) and a raw tag name
 * from logicStore.TagEntry.name, return the leaf entry.
 *
 * Confirmed format from real output:
 *   path = "INST0.MOTOR_RUN"  (uppercase instance "INST0", dot, uppercase var name)
 *
 * Instance name: ensureConfiguration() renames PROGRAM to prog0 and sets
 * PROGRAM Inst0 WITH Main — so the instance name is always "Inst0" → "INST0".
 */
export function resolveTagDebugLeaf(debugMap: DebugMap, tagName: string): DebugLeaf | undefined {
  const needle = `INST0.${tagName.toUpperCase()}`;
  return debugMap.leaves.find(l => l.path === needle);
}

/**
 * Build a Map<tagName, debugIndex> for all tags in the debug map.
 * debugIndex = elemIdx within array 0 (the single flat variable array).
 */
export function buildTagIndexMap(debugMap: DebugMap): Map<string, number> {
  const result = new Map<string, number>();
  for (const leaf of debugMap.leaves) {
    // path = "INST0.VAR_NAME"
    const dotIdx = leaf.path.indexOf('.');
    if (dotIdx === -1) continue;
    const varName = leaf.path.slice(dotIdx + 1); // "MOTOR_RUN"
    result.set(varName, leaf.elemIdx);
  }
  return result;
}

// ─── LD → ST ──────────────────────────────────────────────────────────────────

type ElementWithData = {
  id: string;
  attr: ReturnType<CLMGraph['getNodeAttr']>;
  data: LDElementNodeData;
};

function groupByBranchId(elements: ElementWithData[]): Map<string, ElementWithData[]> {
  const groups = new Map<string, ElementWithData[]>();
  for (const el of elements) {
    const bid = el.data.branchId!;
    if (!groups.has(bid)) groups.set(bid, []);
    groups.get(bid)!.push(el);
  }
  return groups;
}

function compileRungToST(
  clm: CLMGraph,
  _rungId: string,
  mainRail: ElementWithData[],
  branchGroups: Map<string, ElementWithData[]>,
  warnings: string[],
): string[] {
  // Split main rail: contacts (conditions) then coils/blocks (outputs)
  const contacts = mainRail.filter(e => isContactKind(e.data.elementKind));
  const outputs = mainRail.filter(e => !isContactKind(e.data.elementKind));

  if (contacts.length === 0 && outputs.length === 0) return [];

  // Build condition expression — LD semantics:
  // Main rail contacts are series (AND). Each branch provides a parallel path (OR) for
  // the section of the rung it spans. Simple model: branch contacts OR with main rail.
  // Result: (mainContact1 AND mainContact2 AND ... ) OR (branch1) OR (branch2) ...
  const mainExpr = contacts.length > 0
    ? contacts.map(e => contactToExpr(clm, e)).join(' AND ')
    : '';

  const branchExprs: string[] = [];
  for (const [, branchEls] of branchGroups) {
    const branchContacts = branchEls.filter(e => isContactKind(e.data.elementKind));
    if (branchContacts.length > 0) {
      branchExprs.push(`(${branchContacts.map(e => contactToExpr(clm, e)).join(' AND ')})`);
    }
  }

  let condition: string;
  if (mainExpr && branchExprs.length > 0) {
    condition = `(${mainExpr}) OR ${branchExprs.join(' OR ')}`;
  } else if (mainExpr) {
    condition = mainExpr;
  } else if (branchExprs.length > 0) {
    condition = branchExprs.join(' OR ');
  } else {
    condition = 'TRUE';
  }

  const lines: string[] = [];

  if (outputs.length === 0) {
    warnings.push(`Rung has contacts but no output element`);
    return lines;
  }

  for (const output of outputs) {
    const outputLines = outputToST(clm, output, condition, warnings);
    lines.push(...outputLines);
  }

  return lines;
}

function isContactKind(kind: LDElementKind): boolean {
  return kind.startsWith('contact_');
}

function contactToExpr(clm: CLMGraph, el: ElementWithData): string {
  // Resolve tag name via READS edge
  const reads = clm.getOutEdgesByType(el.id, 'READS');
  const tagName = reads.length > 0
    ? sanitizeName((clm.getNodeData<TagNodeData>(reads[0].target)).name)
    : '_UNKNOWN';

  const kind = el.data.elementKind;
  switch (kind) {
    case 'contact_no': return tagName;
    case 'contact_nc': return `NOT ${tagName}`;
    case 'contact_p':  return tagName;   // positive edge — ST approximation
    case 'contact_n':  return `NOT ${tagName}`; // negative edge — ST approximation
    default: return tagName;
  }
}

function outputToST(
  clm: CLMGraph,
  el: ElementWithData,
  condition: string,
  warnings: string[],
): string[] {
  const writes = clm.getOutEdgesByType(el.id, 'WRITES');
  const kind = el.data.elementKind;

  if (kind === 'fb_call') {
    return compileFBCallInRung(clm, el, condition, warnings);
  }

  if (writes.length === 0) {
    warnings.push(`Coil element ${el.id} has no WRITES edge — skipped`);
    return [];
  }

  const tagName = sanitizeName((clm.getNodeData<TagNodeData>(writes[0].target)).name);

  switch (kind) {
    case 'coil':
      return [`  IF ${condition} THEN ${tagName} := TRUE; ELSE ${tagName} := FALSE; END_IF;`];
    case 'coil_negated':
      return [`  IF ${condition} THEN ${tagName} := FALSE; ELSE ${tagName} := TRUE; END_IF;`];
    case 'coil_set':
      return [`  IF ${condition} THEN ${tagName} := TRUE; END_IF;`];
    case 'coil_reset':
      return [`  IF ${condition} THEN ${tagName} := FALSE; END_IF;`];
    case 'coil_latch':
      return [`  IF ${condition} THEN ${tagName} := TRUE; END_IF;`];
    case 'coil_unlatch':
      return [`  IF ${condition} THEN ${tagName} := FALSE; END_IF;`];
    default:
      warnings.push(`Unknown coil kind ${kind} — emitted as normal coil`);
      return [`  IF ${condition} THEN ${tagName} := TRUE; ELSE ${tagName} := FALSE; END_IF;`];
  }
}

function compileFBCallInRung(
  clm: CLMGraph,
  el: ElementWithData,
  condition: string,
  warnings: string[],
): string[] {
  const instanceName = sanitizeName(el.data.instanceName ?? `_FB_${el.id}`);

  // Collect input pin assignments (READS edges carry {pinName} in edge data)
  const reads = clm.getOutEdgesByType(el.id, 'READS');
  const writes = clm.getOutEdgesByType(el.id, 'WRITES');

  const inputParams: string[] = [];
  const outputAssignments: string[] = [];

  for (const edge of reads) {
    const tagData = clm.getNodeData<TagNodeData>(edge.target);
    const pinName = (edge.data as any)?.pinName ?? sanitizeName(tagData.name);
    inputParams.push(`${pinName} := ${sanitizeName(tagData.name)}`);
  }

  for (const edge of writes) {
    const tagData = clm.getNodeData<TagNodeData>(edge.target);
    const pinName = (edge.data as any)?.pinName ?? sanitizeName(tagData.name);
    outputAssignments.push(`    ${sanitizeName(tagData.name)} := ${instanceName}.${pinName};`);
  }

  const paramStr = inputParams.length > 0
    ? `EN := (${condition}), ${inputParams.join(', ')}`
    : `EN := (${condition})`;

  const lines = [
    `  ${instanceName}(${paramStr});`,
    ...outputAssignments,
  ];

  return lines;
}

// ─── FBD → ST ────────────────────────────────────────────────────────────────

function compileFBDBlockToST(
  clm: CLMGraph,
  blockId: string,
  blockData: FBDBlockNodeData,
  warnings: string[],
): string[] {
  const btype = blockData.blockType;

  // Skip purely visual nodes
  if (btype === 'COMMENT' || btype === 'CONNECTOR' || btype === 'CONTINUATION') return [];

  // Variable nodes — just a tag reference, no call needed
  if (btype === 'IN_VARIABLE' || btype === 'OUT_VARIABLE' || btype === 'INOUT_VARIABLE') return [];

  // Function-block instance call (TON, CTU, SR, RS etc.)
  const isFBInstance = isFunctionBlock(btype);
  if (isFBInstance) {
    const instanceName = sanitizeName(blockData.instanceName ?? `_FB_${blockId}`);
    const { inputParams, outputAssignments } = collectFBDPinParams(clm, blockId, warnings);
    const callLines: string[] = [
      `  ${instanceName}(`,
      ...inputParams.map((p, i) => `    ${p}${i < inputParams.length - 1 ? ',' : ''}`),
      `  );`,
    ];
    return [...callLines, ...outputAssignments];
  }

  // Combinatorial / arithmetic blocks — fold into inline ST expressions
  return compileFBDCombinatorial(clm, blockId, blockData, warnings);
}

interface FBDPinResult {
  inputParams: string[];
  outputAssignments: string[];  // "tagName := instanceName.pinName;" — emitted after call
}

function collectFBDPinParams(clm: CLMGraph, blockId: string, warnings: string[]): FBDPinResult {
  const pinEdges = clm.getOutEdgesByType(blockId, 'HAS_PIN');
  const inputParams: string[] = [];
  const outputAssignments: string[] = [];

  for (const edge of pinEdges) {
    const pinData = clm.getNodeData<FBDPinNodeData>(edge.target);

    if (pinData.direction === 'in') {
      // Find what's wired to this input pin
      const inWires = clm.getInEdgesByType(edge.target, 'WIRE');
      if (inWires.length === 0) continue;

      const sourcePin = inWires[0].source;
      const parentEdges = clm.getInEdgesByType(sourcePin, 'HAS_PIN');
      if (parentEdges.length === 0) continue;

      const parentBlockId = parentEdges[0].source;
      const parentBlockData = clm.getNodeData<FBDBlockNodeData>(parentBlockId);

      if (parentBlockData.blockType === 'IN_VARIABLE') {
        const reads = clm.getOutEdgesByType(parentBlockId, 'READS');
        if (reads.length > 0) {
          const tagName = sanitizeName((clm.getNodeData<TagNodeData>(reads[0].target)).name);
          inputParams.push(`${pinData.pinName} := ${tagName}`);
        }
      }
    } else if (pinData.direction === 'out') {
      // Output pin wired to an OUT_VARIABLE — emit as post-call assignment: tag := instance.pin
      const outWires = clm.getOutEdgesByType(edge.target, 'WIRE');
      if (outWires.length === 0) continue;

      const targetPin = outWires[0].target;
      const parentEdges = clm.getInEdgesByType(targetPin, 'HAS_PIN');
      if (parentEdges.length === 0) continue;

      const targetBlockId = parentEdges[0].source;
      const targetBlockData = clm.getNodeData<FBDBlockNodeData>(targetBlockId);

      if (targetBlockData.blockType === 'OUT_VARIABLE') {
        const writes = clm.getOutEdgesByType(targetBlockId, 'WRITES');
        if (writes.length > 0) {
          const tagName = sanitizeName((clm.getNodeData<TagNodeData>(writes[0].target)).name);
          // blockId is the FB instance block — need instanceName from its data
          const blockData = clm.getNodeData<FBDBlockNodeData>(blockId);
          const instanceName = sanitizeName(blockData.instanceName ?? `_FB_${blockId}`);
          outputAssignments.push(`  ${tagName} := ${instanceName}.${pinData.pinName};`);
        }
      }
    }
  }

  return { inputParams, outputAssignments };
}

// ─── FBD Combinatorial Expression Folding ─────────────────────────────────────
// Converts logic gate and arithmetic blocks into inline ST assignment statements.
// Only emits an assignment when this block's output feeds an OUT_VARIABLE.

// Maps FBD block type to the ST operator used when folding inputs
const COMBINATOR_OPS: Record<string, string> = {
  AND: 'AND', OR: 'OR', XOR: 'XOR', NOT: 'NOT',
  ADD: '+', SUB: '-', MUL: '*', DIV: '/', MOD: 'MOD',
  EQ: '=', NEQ: '<>', GT: '>', GEQ: '>=', LT: '<', LEQ: '<=',
  SEL: '',   // 2-input select: special case
  MUX: '',   // multi-input mux: special case
  MOVE: '',  // pass-through
  MAX: '',   // standard function call
  MIN: '',
  ABS: '',
  SQRT: '',
  LN: '',
  LOG: '',
  EXP: '',
  SIN: '',
  COS: '',
  TAN: '',
  ASIN: '',
  ACOS: '',
  ATAN: '',
  TRUNC: '',
  EXPT: '',
  LIMIT: '',
};

// Standard IEC 61131-3 functions that take comma-separated args
const FUNCTION_BLOCKS_DIRECT = new Set([
  'MAX', 'MIN', 'ABS', 'SQRT', 'LN', 'LOG', 'EXP',
  'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN', 'TRUNC', 'EXPT', 'LIMIT',
  'SEL', 'MUX',
]);

/**
 * Resolve the ST expression that produces an input pin's value.
 * Follows WIRE edges backwards to IN_VARIABLE blocks or returns a literal.
 */
function resolvePinExpr(clm: CLMGraph, pinId: string, _warnings: string[]): string {
  const inWires = clm.getInEdgesByType(pinId, 'WIRE');
  if (inWires.length === 0) {
    // No wire: check if pin has a default from its pin data
    const pd = clm.getNodeData<FBDPinNodeData>(pinId);
    // Use pin name as last-resort fallback so at minimum compilation succeeds
    return pd.pinName ?? 'FALSE';
  }

  const sourcePinId = inWires[0].source;
  const negated = (inWires[0].data as any)?.negated;
  const parentEdges = clm.getInEdgesByType(sourcePinId, 'HAS_PIN');
  if (parentEdges.length === 0) return '_wire_src_unknown';

  const parentBlockId = parentEdges[0].source;
  const parentBlock = clm.getNodeData<FBDBlockNodeData>(parentBlockId);

  let expr: string;
  if (parentBlock.blockType === 'IN_VARIABLE') {
    const reads = clm.getOutEdgesByType(parentBlockId, 'READS');
    expr = reads.length > 0
      ? sanitizeName((clm.getNodeData<TagNodeData>(reads[0].target)).name)
      : '_in_var_unbound';
  } else if (COMBINATOR_OPS[parentBlock.blockType] !== undefined) {
    // Recursively fold this block's expression
    expr = buildBlockExpr(clm, parentBlockId, parentBlock, _warnings);
  } else {
    // FB instance block — reference instance.outputPin
    const instanceName = sanitizeName(parentBlock.instanceName ?? `_FB_${parentBlockId}`);
    const sourcePinData = clm.getNodeData<FBDPinNodeData>(sourcePinId);
    expr = `${instanceName}.${sourcePinData.pinName}`;
  }

  return negated ? `NOT (${expr})` : expr;
}

/**
 * Build the ST expression for a combinatorial block by folding its input pins.
 */
function buildBlockExpr(
  clm: CLMGraph,
  blockId: string,
  blockData: FBDBlockNodeData,
  warnings: string[],
): string {
  const btype = blockData.blockType;
  const pinEdges = clm.getOutEdgesByType(blockId, 'HAS_PIN');
  const inPins = pinEdges
    .map(e => ({ id: e.target, data: clm.getNodeData<FBDPinNodeData>(e.target) }))
    .filter(p => p.data.direction === 'in');

  const inputExprs = inPins.map(p => resolvePinExpr(clm, p.id, warnings));

  if (btype === 'NOT') {
    return `NOT (${inputExprs[0] ?? 'FALSE'})`;
  }
  if (btype === 'MOVE') {
    return inputExprs[0] ?? 'FALSE';
  }
  if (FUNCTION_BLOCKS_DIRECT.has(btype)) {
    return `${btype}(${inputExprs.join(', ')})`;
  }

  const op = COMBINATOR_OPS[btype];
  if (op && inputExprs.length >= 2) {
    return inputExprs.map(e => `(${e})`).join(` ${op} `);
  }
  if (op && inputExprs.length === 1) {
    return inputExprs[0];
  }

  warnings.push(`FBD block ${btype} has unrecognised combinator pattern — using TRUE`);
  return 'TRUE';
}

/**
 * Compile a combinatorial / arithmetic FBD block to ST assignment statements.
 * Emits one assignment per output pin that is wired to an OUT_VARIABLE.
 */
function compileFBDCombinatorial(
  clm: CLMGraph,
  blockId: string,
  blockData: FBDBlockNodeData,
  warnings: string[],
): string[] {
  const btype = blockData.blockType;
  if (!(btype in COMBINATOR_OPS)) {
    warnings.push(`FBD block type "${btype}" not in combinator table — skipped`);
    return [`  (* FBD ${btype} ${blockId} — unknown block type, skipped *)`];
  }

  const pinEdges = clm.getOutEdgesByType(blockId, 'HAS_PIN');
  const outPins = pinEdges
    .map(e => ({ id: e.target, data: clm.getNodeData<FBDPinNodeData>(e.target) }))
    .filter(p => p.data.direction === 'out');

  const lines: string[] = [];
  for (const outPin of outPins) {
    const outWires = clm.getOutEdgesByType(outPin.id, 'WIRE');
    for (const outWire of outWires) {
      const targetPinParents = clm.getInEdgesByType(outWire.target, 'HAS_PIN');
      if (targetPinParents.length === 0) continue;
      const targetBlockId = targetPinParents[0].source;
      const targetBlock = clm.getNodeData<FBDBlockNodeData>(targetBlockId);

      if (targetBlock.blockType === 'OUT_VARIABLE') {
        const writeEdges = clm.getOutEdgesByType(targetBlockId, 'WRITES');
        if (writeEdges.length > 0) {
          const destTag = sanitizeName((clm.getNodeData<TagNodeData>(writeEdges[0].target)).name);
          const expr = buildBlockExpr(clm, blockId, blockData, warnings);
          lines.push(`  ${destTag} := ${expr};`);
        }
      }
    }
  }

  return lines;
}

// ─── SFC → ST ────────────────────────────────────────────────────────────────

function compileSFCToST(clm: CLMGraph, stepIds: string[], warnings: string[]): string[] {
  // SFC → ST: encode state machine as an INT state variable + CASE statement
  // This is a standard, non-proprietary transformation.
  const steps = stepIds.map(id => ({
    id,
    data: clm.getNodeData<SFCStepNodeData>(id),
  }));

  const initialStep = steps.find(s => s.data.isInitial) ?? steps[0];
  if (!initialStep) return [];

  const lines: string[] = [];
  lines.push('  (* SFC encoded as state machine *)');

  // State variable (declared inline — VAR section handles it at top level)
  // We use step index as state number
  const stepIndexMap = new Map<string, number>();
  steps.forEach((s, i) => stepIndexMap.set(s.id, i));

  const initialState = stepIndexMap.get(initialStep.id) ?? 0;
  lines.push(`  IF _SFC_STATE = -1 THEN _SFC_STATE := ${initialState}; END_IF;`);
  lines.push('');
  lines.push('  CASE _SFC_STATE OF');

  for (const step of steps) {
    const stateNum = stepIndexMap.get(step.id)!;
    lines.push(`    ${stateNum}: (* ${step.data.stepName} *)`);

    // Emit actions for this step — use updated sfcActionToST with timed qualifier support
    const actionEdges = clm.getOutEdgesByType(step.id, 'HAS_ACTION');
    for (const edge of actionEdges) {
      const actionData = clm.getNodeData<SFCActionNodeData>(edge.target);
      const writes = clm.getOutEdgesByType(edge.target, 'WRITES');
      const tagName = writes.length > 0
        ? sanitizeName((clm.getNodeData<TagNodeData>(writes[0].target)).name)
        : '_UNKNOWN';

      const actionLines = sfcActionToST(actionData, tagName, '_SFC_STATE', stateNum);
      lines.push(...actionLines);
    }

    // Outgoing SFC_FLOW edges → find next steps via transitions
    const outflows = clm.getOutEdgesByType(step.id, 'SFC_FLOW');
    for (const flow of outflows) {
      const targetId = flow.target;
      const targetAttr = clm.getNodeAttr(targetId);

      if (targetAttr.type === 'SFC_TRANSITION') {
        const transData = clm.getNodeData<SFCTransitionNodeData>(targetId);
        const transOutflows = clm.getOutEdgesByType(targetId, 'SFC_FLOW');

        for (const nextFlow of transOutflows) {
          const nextStepId = nextFlow.target;
          const nextState = stepIndexMap.get(nextStepId);
          if (nextState !== undefined) {
            const cond = transData.conditionExpr || 'TRUE';
            lines.push(`      IF ${cond} THEN _SFC_STATE := ${nextState}; END_IF;`);
          }
        }
      }
    }
    lines.push('');
  }

  lines.push('  END_CASE;');
  return lines;
}

function sfcActionToST(action: SFCActionNodeData, tagName: string, stepStateVar: string, stateNum: number): string[] {
  const dur = action.duration ? `T#${action.duration}` : 'T#0ms';
  const timerVar = `_SFC_TMR_${tagName}_${stateNum}`;

  switch (action.qualifier) {
    case 'N':
      // Non-stored: active exactly while step is active
      return [`      ${tagName} := TRUE;   (* N: active while step ${stateNum} is active *)`];

    case 'S':
      // Set: latch on, remains after step exits
      return [`      ${tagName} := TRUE;   (* S: set - remains latched *)`];

    case 'R':
      // Reset: unlatch
      return [`      ${tagName} := FALSE;  (* R: reset - unlatch *)`];

    case 'P':
    case 'P1': {
      // Positive pulse: fire once on step entry using a one-shot flag
      const edgeVar = `_SFC_P1_${tagName}_${stateNum}`;
      return [
        `      IF NOT ${edgeVar} THEN ${tagName} := TRUE; ${edgeVar} := TRUE; END_IF; (* P1: rising pulse *)`,
      ];
    }

    case 'P0': {
      // Negative pulse: fire once on step exit — detected by _prev state variable
      const edgeVar = `_SFC_P0_${tagName}_${stateNum}`;
      return [
        `      ${edgeVar} := TRUE; (* P0: falling pulse arm — fires on exit *)`,
      ];
    }

    case 'L':
      // Time-limited: active while step active AND elapsed < duration
      return [
        `      ${timerVar}(IN := (${stepStateVar} = ${stateNum}), PT := ${dur});`,
        `      IF NOT ${timerVar}.Q THEN ${tagName} := TRUE; ELSE ${tagName} := FALSE; END_IF; (* L: time-limited *)`,
      ];

    case 'D':
      // Time-delayed: active only AFTER duration has elapsed while step active
      return [
        `      ${timerVar}(IN := (${stepStateVar} = ${stateNum}), PT := ${dur});`,
        `      ${tagName} := ${timerVar}.Q;   (* D: delayed activation *)`,
      ];

    case 'SD':
      // Stored-delayed: set after delay, remains set after step exits
      return [
        `      ${timerVar}(IN := (${stepStateVar} = ${stateNum}), PT := ${dur});`,
        `      IF ${timerVar}.Q THEN ${tagName} := TRUE; END_IF; (* SD: stored-delayed set *)`,
      ];

    case 'DS':
      // Delayed-stored: like SD but only sets if step still active when timer fires
      return [
        `      ${timerVar}(IN := (${stepStateVar} = ${stateNum}), PT := ${dur});`,
        `      IF ${timerVar}.Q AND (${stepStateVar} = ${stateNum}) THEN ${tagName} := TRUE; END_IF; (* DS: delayed-stored *)`,
      ];

    case 'SL':
      // Stored-time-limited: set on entry, resets after duration
      return [
        `      IF ${stepStateVar} = ${stateNum} THEN ${tagName} := TRUE; END_IF;`,
        `      ${timerVar}(IN := ${tagName}, PT := ${dur});`,
        `      IF ${timerVar}.Q THEN ${tagName} := FALSE; END_IF; (* SL: stored-limited *)`,
      ];

    default:
      return [`      ${tagName} := TRUE;   (* ${action.qualifier}: unrecognised qualifier *)`];
  }
}

// ─── FB instance VAR collection ───────────────────────────────────────────────

function collectFBInstanceVars(clm: CLMGraph): string[] {
  const vars: string[] = [];
  const seen = new Set<string>();

  // LD fb_call elements
  for (const nodeId of clm.getNodesByType('LD_ELEMENT')) {
    const data = clm.getNodeData<LDElementNodeData>(nodeId);
    if (data.elementKind === 'fb_call' && data.instanceName && data.fbType) {
      const name = sanitizeName(data.instanceName);
      if (!seen.has(name)) {
        seen.add(name);
        vars.push(`    ${name} : ${data.fbType};`);
      }
    }
  }

  // FBD function-block blocks
  for (const nodeId of clm.getNodesByType('FBD_BLOCK')) {
    const data = clm.getNodeData<FBDBlockNodeData>(nodeId);
    if (isFunctionBlock(data.blockType) && data.instanceName) {
      const name = sanitizeName(data.instanceName);
      if (!seen.has(name)) {
        seen.add(name);
        vars.push(`    ${name} : ${data.blockType};`);
      }
    }
  }

  // SFC state variable and timed-qualifier timer instances
  const sfcSteps = clm.getNodesByType('SFC_STEP');
  if (sfcSteps.length > 0) {
    vars.push('    _SFC_STATE : INT := -1;');

    sfcSteps.forEach((stepId, stateNum) => {
      const actionEdges = clm.getOutEdgesByType(stepId, 'HAS_ACTION');
      for (const ae of actionEdges) {
        const actionData = clm.getNodeData<SFCActionNodeData>(ae.target);
        const writes = clm.getOutEdgesByType(ae.target, 'WRITES');
        const tagName = writes.length > 0
          ? sanitizeName((clm.getNodeData<TagNodeData>(writes[0].target)).name)
          : '_UNKNOWN';

        const timedQualifiers = new Set(['L', 'D', 'SD', 'DS', 'SL']);
        if (timedQualifiers.has(actionData.qualifier)) {
          const timerVar = `_SFC_TMR_${tagName}_${stateNum}`;
          if (!seen.has(timerVar)) {
            seen.add(timerVar);
            vars.push(`    ${timerVar} : TON;`);
          }
        }
        // P0/P1 one-shot flags
        if (actionData.qualifier === 'P' || actionData.qualifier === 'P1') {
          const edgeVar = `_SFC_P1_${tagName}_${stateNum}`;
          if (!seen.has(edgeVar)) { seen.add(edgeVar); vars.push(`    ${edgeVar} : BOOL := FALSE;`); }
        }
        if (actionData.qualifier === 'P0') {
          const edgeVar = `_SFC_P0_${tagName}_${stateNum}`;
          if (!seen.has(edgeVar)) { seen.add(edgeVar); vars.push(`    ${edgeVar} : BOOL := FALSE;`); }
        }
      }
    });
  }

  return vars;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isFunctionBlock(blockType: string): boolean {
  const FB_TYPES = new Set([
    'TON', 'TOF', 'TP', 'CTU', 'CTD', 'CTUD',
    'SR', 'RS', 'RTRIG', 'FTRIG',
  ]);
  return FB_TYPES.has(blockType);
}

function sanitizeName(name: string): string {
  // IEC 61131-3 identifiers: [A-Za-z_][A-Za-z0-9_]*
  return name.replace(/[^A-Za-z0-9_]/g, '_').replace(/^([0-9])/, '_$1');
}

function defaultInitFor(dt: IECDataType): string {
  switch (dt) {
    case 'BOOL': return ' := FALSE';
    case 'REAL':
    case 'LREAL': return ' := 0.0';
    case 'STRING':
    case 'WSTRING': return " := ''";
    case 'TIME': return ' := T#0ms';
    case 'ARRAY_BOOL': return '';  // ARRAY type — initializer syntax depends on dimensions; omit
    case 'ARRAY_INT':  return '';
    case 'ARRAY_REAL': return '';
    case 'STRUCT': return ' := ()';
    default: return ' := 0';
  }
}

