/*
 * CLM Builder — Converts flat logicStore data structures into a CLM graph.
 * This is the migration bridge: existing LD/FBD/SFC flat arrays → graph nodes/edges.
 */

import { CLMGraph } from './graph.js';
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
  SFCJumpNodeData,
  ActionQualifier,
} from './schema.js';
import type {
  LadderProgram,
  FBDProgram,
  SFCProgram,
  TagEntry,
  LadderElement,
  ContactType,
  CoilType,
  Rung,
} from '../logicStore.js';

export const POU_ID = 'pou-main';

// Map old ContactType to CLM LDElementKind
function contactTypeToKind(type: ContactType): LDElementKind {
  switch (type) {
    case 'NO': return 'contact_no';
    case 'NC': return 'contact_nc';
    case 'P_CONTACT': return 'contact_p';
    case 'N_CONTACT': return 'contact_n';
    default: return 'contact_no';
  }
}

// Map old CoilType to CLM LDElementKind
function coilTypeToKind(type: CoilType): LDElementKind {
  switch (type) {
    case 'normal': return 'coil';
    case 'negated': return 'coil_negated';
    case 'set': return 'coil_set';
    case 'reset': return 'coil_reset';
    case 'latch': return 'coil_latch';
    case 'unlatch': return 'coil_unlatch';
    default: return 'coil';
  }
}

/**
 * Determine if a pin name is an output pin for a given FB type.
 * Used to classify WRITES vs READS edges for LD fb_call elements.
 * Comprehensive list covering all standard IEC 61131-3 FBs + common vendor FBs.
 */
const FB_OUTPUT_PINS: Record<string, Set<string>> = {
  TON:   new Set(['Q', 'ET']),
  TOF:   new Set(['Q', 'ET']),
  TP:    new Set(['Q', 'ET']),
  CTU:   new Set(['Q', 'CV']),
  CTD:   new Set(['Q', 'CV']),
  CTUD:  new Set(['QU', 'QD', 'CV']),
  SR:    new Set(['Q1']),
  RS:    new Set(['Q1']),
  RTRIG: new Set(['Q']),
  FTRIG: new Set(['Q']),
  // common generic outputs
  _DEFAULT: new Set(['Q', 'QU', 'QD', 'CV', 'ET', 'OUT', 'OUT1', 'OUT2', 'RESULT', 'ERROR', 'DONE', 'BUSY', 'NDR']),
};

function isFBOutputPin(fbType: string | undefined, pinName: string): boolean {
  const specific = fbType ? FB_OUTPUT_PINS[fbType] : undefined;
  if (specific) return specific.has(pinName);
  return FB_OUTPUT_PINS['_DEFAULT']!.has(pinName);
}

/**
 * Build a complete CLM graph from the existing flat store state.
 */
export function buildCLMFromStore(
  ladderProgram: LadderProgram,
  fbdProgram: FBDProgram,
  sfcProgram: SFCProgram,
  tagDatabase: TagEntry[],
): CLMGraph {
  const clm = new CLMGraph();

  // ── POU node ──
  clm.addNode(POU_ID, 'POU', 'shared', {
    pouName: 'Main',
    pouType: 'program',
    language: 'LD',
  } satisfies POUNodeData);

  // ── TAG nodes ──
  for (const tag of tagDatabase) {
    const tagId = `tag-${tag.name}`;
    if (!clm.hasNode(tagId)) {
      clm.addNode(tagId, 'TAG', 'shared', {
        name: tag.name,
        dataType: tag.dataType,
        scope: 'global',
        address: tag.address,
        description: tag.description,
        initialValue: tag.initialValue,
        retain: tag.retain,
      } satisfies TagNodeData);
    }
  }

  // ── Ladder ──
  buildLadder(clm, ladderProgram);

  // ── FBD ──
  buildFBD(clm, fbdProgram);

  // ── SFC ──
  buildSFC(clm, sfcProgram);

  return clm;
}

function ensureTag(clm: CLMGraph, name: string, dataType: string): string {
  const tagId = `tag-${name}`;
  if (!clm.hasNode(tagId)) {
    clm.addNode(tagId, 'TAG', 'shared', {
      name,
      dataType: dataType as any,
      scope: 'global',
    } satisfies TagNodeData);
  }
  return tagId;
}

function addLDElement(clm: CLMGraph, el: LadderElement, rungId: string, branchId?: string, anchorId?: string): void {
  let kind: LDElementKind;
  let tagName: string | undefined;
  let tagDataType: string | undefined;

  if (el.kind === 'contact') {
    kind = contactTypeToKind(el.type);
    tagName = el.tag.name;
    tagDataType = el.tag.dataType;
  } else if (el.kind === 'coil') {
    kind = coilTypeToKind(el.type);
    tagName = el.tag.name;
    tagDataType = el.tag.dataType;
  } else {
    kind = 'fb_call';
  }

  const nodeData: LDElementNodeData = {
    elementKind: kind,
    position: el.position,
    branchId,
    anchorId,
  };

  if (el.kind === 'block') {
    nodeData.fbType = el.fbType;
    nodeData.instanceName = el.instanceName;
  }

  clm.addNode(el.id, 'LD_ELEMENT', 'LD', nodeData);
  clm.addEdge(rungId, el.id, 'CONTAINS');

  // Tag references
  if (el.kind === 'contact' && tagName) {
    const tagId = ensureTag(clm, tagName, tagDataType!);
    clm.addEdge(el.id, tagId, 'READS');
  } else if (el.kind === 'coil' && tagName) {
    const tagId = ensureTag(clm, tagName, tagDataType!);
    clm.addEdge(el.id, tagId, 'WRITES');
  } else if (el.kind === 'block') {
    for (const [pinName, tagRef] of Object.entries(el.pins)) {
      if (!tagRef.name) continue;
      const tagId = ensureTag(clm, tagRef.name, tagRef.dataType);
      clm.addEdge(el.id, tagId, isFBOutputPin(el.fbType, pinName) ? 'WRITES' : 'READS',
        { pinName });
    }
  }
}

function buildLadder(clm: CLMGraph, program: LadderProgram): void {
  let prevRungId: string | null = null;

  for (const rung of program.rungs) {
    clm.addNode(rung.id, 'RUNG', 'LD', {
      rungNumber: rung.number,
      comment: rung.comment,
    } satisfies RungNodeData);

    clm.addEdge(POU_ID, rung.id, 'CONTAINS');

    if (prevRungId) {
      clm.addEdge(prevRungId, rung.id, 'RUNG_ORDER');
    }
    prevRungId = rung.id;

    // Main rail elements
    for (const el of rung.elements) {
      addLDElement(clm, el, rung.id);
    }

    // Branch elements
    for (const branch of rung.branches) {
      for (const el of branch.elements) {
        addLDElement(clm, el, rung.id, branch.id, branch.startNodeId);
      }
    }
  }
}

function buildFBD(clm: CLMGraph, program: FBDProgram): void {
  for (const node of program.nodes) {
    // FBD_BLOCK node
    clm.addNode(node.id, 'FBD_BLOCK', 'FBD', {
      blockType: node.type,
      instanceName: node.instanceName,
      label: node.label,
      content: node.content,
      position: node.position,
      size: node.size,
    } satisfies FBDBlockNodeData);

    clm.addEdge(POU_ID, node.id, 'CONTAINS');

    // FBD_PIN nodes for inputs (scope ID to parent block to avoid collisions)
    for (const pin of node.inputs) {
      const pinNodeId = `${node.id}::${pin.id}`;
      clm.addNode(pinNodeId, 'FBD_PIN', 'FBD', {
        pinName: pin.name,
        direction: 'in',
        dataType: pin.dataType,
        negated: pin.negated,
      } satisfies FBDPinNodeData);
      clm.addEdge(node.id, pinNodeId, 'HAS_PIN');
    }

    // FBD_PIN nodes for outputs (scope ID to parent block to avoid collisions)
    for (const pin of node.outputs) {
      const pinNodeId = `${node.id}::${pin.id}`;
      clm.addNode(pinNodeId, 'FBD_PIN', 'FBD', {
        pinName: pin.name,
        direction: 'out',
        dataType: pin.dataType,
        negated: pin.negated,
      } satisfies FBDPinNodeData);
      clm.addEdge(node.id, pinNodeId, 'HAS_PIN');
    }

    // Tag reference for variable nodes (IN_VARIABLE, OUT_VARIABLE, INOUT_VARIABLE)
    if (node.tag) {
      const tagId = ensureTag(clm, node.tag.name, node.tag.dataType);
      if (node.type === 'IN_VARIABLE' || node.type === 'INOUT_VARIABLE') {
        clm.addEdge(node.id, tagId, 'READS');
      }
      if (node.type === 'OUT_VARIABLE' || node.type === 'INOUT_VARIABLE') {
        clm.addEdge(node.id, tagId, 'WRITES');
      }
    }
  }

  // WIRE edges (connect output pin → input pin, using scoped IDs)
  for (const wire of program.wires) {
    const fromNode = program.nodes.find(n => n.id === wire.from.nodeId);
    const toNode = program.nodes.find(n => n.id === wire.to.nodeId);
    if (!fromNode || !toNode) continue;

    const fromPin = fromNode.outputs.find(p => p.name === wire.from.pin);
    const toPin = toNode.inputs.find(p => p.name === wire.to.pin);
    if (!fromPin || !toPin) continue;

    const fromPinId = `${fromNode.id}::${fromPin.id}`;
    const toPinId = `${toNode.id}::${toPin.id}`;

    if (clm.hasNode(fromPinId) && clm.hasNode(toPinId)) {
      clm.addEdge(fromPinId, toPinId, 'WIRE', { wireId: wire.id, negated: wire.negated });
    }
  }
}

function buildSFC(clm: CLMGraph, program: SFCProgram): void {
  // SFC_STEP nodes
  for (const step of program.steps) {
    clm.addNode(step.id, 'SFC_STEP', 'SFC', {
      stepName: step.name,
      isInitial: step.isInitial,
      position: step.position,
    } satisfies SFCStepNodeData);

    clm.addEdge(POU_ID, step.id, 'CONTAINS');

    // Actions
    for (const action of step.actions) {
      clm.addNode(action.id, 'SFC_ACTION', 'SFC', {
        actionName: action.tag.name,
        qualifier: action.qualifier as ActionQualifier,
        duration: action.duration,
      } satisfies SFCActionNodeData);

      clm.addEdge(step.id, action.id, 'HAS_ACTION');

      // Action writes to tag
      const tagId = ensureTag(clm, action.tag.name, action.tag.dataType);
      clm.addEdge(action.id, tagId, 'WRITES');
    }
  }

  // SFC_TRANSITION nodes
  for (const trans of program.transitions) {
    clm.addNode(trans.id, 'SFC_TRANSITION', 'SFC', {
      conditionExpr: trans.condition,
      position: trans.position,
      priority: trans.priority,
    } satisfies SFCTransitionNodeData);

    clm.addEdge(POU_ID, trans.id, 'CONTAINS');

    // Parse condition expression for tag references
    const tagRefs = parseConditionTagRefs(trans.condition);
    for (const tagName of tagRefs) {
      const tagId = ensureTag(clm, tagName, 'BOOL');
      clm.addEdge(trans.id, tagId, 'READS');
    }
  }

  // SFC_FLOW edges from links
  for (const link of program.links) {
    if (clm.hasNode(link.from) && clm.hasNode(link.to)) {
      clm.addEdge(link.from, link.to, 'SFC_FLOW', { linkId: link.id, linkType: link.type });
    }
  }

  // SFC_JUMP nodes — a terminal that re-activates the named target step
  for (const jump of program.jumps ?? []) {
    clm.addNode(jump.id, 'SFC_JUMP', 'SFC', {
      targetStepName: jump.targetStepName,
    } satisfies SFCJumpNodeData);
    clm.addEdge(POU_ID, jump.id, 'CONTAINS');
  }
}

/**
 * Simple expression parser: extract tag name references from an ST boolean expression.
 * Handles: AND, OR, NOT, TRUE, FALSE, comparison operators, parentheses.
 * Returns only identifiers that are likely tag names (excludes keywords and literals).
 */
export function parseConditionTagRefs(expr: string): string[] {
  if (!expr) return [];

  const KEYWORDS = new Set(['AND', 'OR', 'NOT', 'XOR', 'TRUE', 'FALSE', 'MOD']);
  const LITERAL_PATTERN = /^(T#|t#|[0-9])/;

  // Tokenize: split on operators and whitespace, keep identifiers
  const tokens = expr
    .replace(/[()]/g, ' ')
    .replace(/[<>=!]+/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);

  const tags: string[] = [];
  for (const token of tokens) {
    if (KEYWORDS.has(token.toUpperCase())) continue;
    if (LITERAL_PATTERN.test(token)) continue;
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
      tags.push(token);
    }
  }

  return [...new Set(tags)];
}

export { isFBOutputPin };
