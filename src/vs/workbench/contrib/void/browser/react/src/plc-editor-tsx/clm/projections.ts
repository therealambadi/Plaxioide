/*
 * CLM Projections — Convert graph state back to the flat view models
 * that the existing LD/FBD/SFC canvases consume.
 *
 * The canvases don't know about CLM; they get the same shapes they always got.
 */

import { CLMGraph } from './graph.js';
import { POU_ID } from './builder.js';
import type {
  RungNodeData,
  LDElementNodeData,
  FBDBlockNodeData,
  FBDPinNodeData,
  SFCStepNodeData,
  SFCTransitionNodeData,
  SFCActionNodeData,
  SFCJumpNodeData,
  TagNodeData,
} from './schema.js';
import type {
  Rung,
  LadderElement,
  ContactElement,
  CoilElement,
  BlockElement,
  ContactType,
  CoilType,
  FBType,
  Branch,
  LadderProgram,
  FBDNode,
  FBDWire,
  FBDProgram,
  SFCStep,
  SFCTransition,
  SFCLink,
  SFCBranch,
  SFCJump,
  SFCProgram,
  TagEntry,
  TagRef,
  Pin,
  IECDataType,
} from '../logicStore.js';

// ─── Ladder Projection ───────────────────────────────────────────────────────

function kindToContactType(kind: string): ContactType {
  switch (kind) {
    case 'contact_no': return 'NO';
    case 'contact_nc': return 'NC';
    case 'contact_p': return 'P_CONTACT';
    case 'contact_n': return 'N_CONTACT';
    default: return 'NO';
  }
}

function kindToCoilType(kind: string): CoilType {
  switch (kind) {
    case 'coil': return 'normal';
    case 'coil_negated': return 'negated';
    case 'coil_set': return 'set';
    case 'coil_reset': return 'reset';
    case 'coil_latch': return 'latch';
    case 'coil_unlatch': return 'unlatch';
    default: return 'normal';
  }
}

function getTagRefForElement(clm: CLMGraph, elementId: string, relation: 'READS' | 'WRITES'): TagRef {
  const edges = relation === 'READS'
    ? clm.getOutEdgesByType(elementId, 'READS')
    : clm.getOutEdgesByType(elementId, 'WRITES');

  if (edges.length > 0) {
    const tagData = clm.getNodeData<TagNodeData>(edges[0].target);
    return { name: tagData.name, dataType: tagData.dataType, address: tagData.address };
  }
  return { name: '', dataType: 'BOOL' };
}

function projectLDElement(clm: CLMGraph, elementId: string): LadderElement {
  const data = clm.getNodeData<LDElementNodeData>(elementId);

  if (data.elementKind.startsWith('contact')) {
    const tag = getTagRefForElement(clm, elementId, 'READS');
    return {
      kind: 'contact',
      id: elementId,
      type: kindToContactType(data.elementKind),
      tag,
      position: data.position,
    } satisfies ContactElement;
  }

  if (data.elementKind.startsWith('coil')) {
    const tag = getTagRefForElement(clm, elementId, 'WRITES');
    return {
      kind: 'coil',
      id: elementId,
      type: kindToCoilType(data.elementKind),
      tag,
      position: data.position,
    } satisfies CoilElement;
  }

  // fb_call
  const pins: Record<string, TagRef> = {};
  const readEdges = clm.getOutEdgesByType(elementId, 'READS');
  const writeEdges = clm.getOutEdgesByType(elementId, 'WRITES');

  for (const edge of [...readEdges, ...writeEdges]) {
    const tagData = clm.getNodeData<TagNodeData>(edge.target);
    // Use data field to get pin name if stored, otherwise use tag name
    const pinName = (edge.data as any)?.pinName ?? tagData.name;
    pins[pinName] = { name: tagData.name, dataType: tagData.dataType };
  }

  return {
    kind: 'block',
    id: elementId,
    fbType: (data.fbType ?? 'TON') as FBType,
    instanceName: data.instanceName ?? '',
    pins,
    position: data.position,
  } satisfies BlockElement;
}

export function projectLadderProgram(clm: CLMGraph): LadderProgram {
  const rungIds = clm.getNodesByType('RUNG');
  if (rungIds.length === 0) return { rungs: [] };

  // Sort rungs by RUNG_ORDER edges (topological: follow RUNG_ORDER chain)
  const orderedRungs = orderByChain(clm, rungIds);

  const rungs: Rung[] = orderedRungs.map(rungId => {
    const rungData = clm.getNodeData<RungNodeData>(rungId);
    const children = clm.getChildren(rungId);

    // Separate main rail vs branch elements
    const mainElements: LadderElement[] = [];
    const branchMap = new Map<string, LadderElement[]>();

    // Sort children by x position so LD elements render left-to-right as authored
    const sortedChildren = [...children].sort((a, b) => {
      const aAttr = clm.getNodeAttr(a);
      const bAttr = clm.getNodeAttr(b);
      if (aAttr.type !== 'LD_ELEMENT' || bAttr.type !== 'LD_ELEMENT') return 0;
      const ax = (aAttr.data as LDElementNodeData).position?.x ?? 0;
      const bx = (bAttr.data as LDElementNodeData).position?.x ?? 0;
      return ax - bx;
    });

    for (const childId of sortedChildren) {
      const attr = clm.getNodeAttr(childId);
      if (attr.type !== 'LD_ELEMENT') continue;
      const elData = attr.data as LDElementNodeData;

      if (elData.branchId) {
        if (!branchMap.has(elData.branchId)) branchMap.set(elData.branchId, []);
        branchMap.get(elData.branchId)!.push(projectLDElement(clm, childId));
      } else {
        mainElements.push(projectLDElement(clm, childId));
      }
    }

    // Restore branch anchor IDs from the stored anchorId field on elements
    const branches: Branch[] = Array.from(branchMap.entries()).map(([branchId, elements]) => {
      // anchorId on the first element preserves the original startNodeId
      const storedAnchor = (clm.getNodeData<LDElementNodeData>(elements[0]?.id))?.anchorId;
      return {
        id: branchId,
        startNodeId: storedAnchor ?? elements[0]?.id ?? '',
        endNodeId: elements[elements.length - 1]?.id ?? '',
        elements,
      };
    });

    return {
      id: rungId,
      number: rungData.rungNumber,
      comment: rungData.comment,
      elements: mainElements,
      branches,
    };
  });

  return { rungs };
}

function orderByChain(clm: CLMGraph, rungIds: string[]): string[] {
  if (rungIds.length <= 1) return rungIds;

  // Build adjacency from RUNG_ORDER edges
  const nextMap = new Map<string, string>();
  const hasIncoming = new Set<string>();

  for (const id of rungIds) {
    const outEdges = clm.getOutEdgesByType(id, 'RUNG_ORDER');
    if (outEdges.length > 0) {
      nextMap.set(id, outEdges[0].target);
      hasIncoming.add(outEdges[0].target);
    }
  }

  // Find start (node with no incoming RUNG_ORDER)
  let start = rungIds.find(id => !hasIncoming.has(id));
  if (!start) start = rungIds[0];

  const ordered: string[] = [];
  let current: string | undefined = start;
  const visited = new Set<string>();

  while (current && !visited.has(current)) {
    visited.add(current);
    ordered.push(current);
    current = nextMap.get(current);
  }

  // Add any orphan rungs not in the chain
  for (const id of rungIds) {
    if (!visited.has(id)) ordered.push(id);
  }

  return ordered;
}

// ─── FBD Projection ──────────────────────────────────────────────────────────

export function projectFBDProgram(clm: CLMGraph): FBDProgram {
  const blockIds = clm.getNodesByType('FBD_BLOCK');
  const nodes: FBDNode[] = [];
  const wires: FBDWire[] = [];
  const seenWires = new Set<string>();

  for (const blockId of blockIds) {
    const blockData = clm.getNodeData<FBDBlockNodeData>(blockId);
    const pinEdges = clm.getOutEdgesByType(blockId, 'HAS_PIN');

    const inputs: Pin[] = [];
    const outputs: Pin[] = [];

    for (const pinEdge of pinEdges) {
      const pinData = clm.getNodeData<FBDPinNodeData>(pinEdge.target);
      // Extract original pin ID from scoped format (blockId::pinId)
      const scopedId = pinEdge.target;
      const originalPinId = scopedId.includes('::') ? scopedId.split('::')[1] : scopedId;
      const pin: Pin = {
        id: originalPinId,
        name: pinData.pinName,
        dataType: pinData.dataType,
        negated: pinData.negated,
      };

      if (pinData.direction === 'in') {
        inputs.push(pin);
      } else {
        outputs.push(pin);
      }

      // Collect WIRE edges from output pins
      if (pinData.direction === 'out') {
        const wireEdges = clm.getOutEdgesByType(pinEdge.target, 'WIRE');
        for (const wireEdge of wireEdges) {
          const wireId = (wireEdge.data as any)?.wireId ?? wireEdge.edgeKey;
          if (seenWires.has(wireId)) continue;
          seenWires.add(wireId);

          // Find the block that owns the target pin
          const targetPinId = wireEdge.target;
          const targetPinData = clm.getNodeData<FBDPinNodeData>(targetPinId);
          const targetBlockEdges = clm.getInEdgesByType(targetPinId, 'HAS_PIN');
          if (targetBlockEdges.length === 0) continue;

          wires.push({
            id: wireId,
            from: { nodeId: blockId, pin: pinData.pinName },
            to: { nodeId: targetBlockEdges[0].source, pin: targetPinData.pinName },
            negated: (wireEdge.data as any)?.negated,
          });
        }
      }
    }

    // Find tag reference
    let tag: TagRef | undefined;
    const readEdges = clm.getOutEdgesByType(blockId, 'READS');
    const writeEdges = clm.getOutEdgesByType(blockId, 'WRITES');
    const tagEdge = readEdges[0] ?? writeEdges[0];
    if (tagEdge) {
      const tagData = clm.getNodeData<TagNodeData>(tagEdge.target);
      tag = { name: tagData.name, dataType: tagData.dataType, address: tagData.address };
    }

    nodes.push({
      id: blockId,
      type: blockData.blockType as any,
      instanceName: blockData.instanceName,
      label: blockData.label,
      content: blockData.content,
      position: blockData.position,
      size: blockData.size,
      inputs,
      outputs,
      tag,
    });
  }

  return { nodes, wires };
}

// ─── SFC Projection ─────────────────────────────────────────────────────────

export function projectSFCProgram(clm: CLMGraph): SFCProgram {
  const stepIds = clm.getNodesByType('SFC_STEP');
  const transIds = clm.getNodesByType('SFC_TRANSITION');

  const steps: SFCStep[] = stepIds.map(stepId => {
    const data = clm.getNodeData<SFCStepNodeData>(stepId);
    const actionEdges = clm.getOutEdgesByType(stepId, 'HAS_ACTION');

    const actions = actionEdges.map(ae => {
      const actionData = clm.getNodeData<SFCActionNodeData>(ae.target);
      // Find the tag this action writes to
      const writeEdges = clm.getOutEdgesByType(ae.target, 'WRITES');
      let tag: TagRef = { name: actionData.actionName, dataType: 'BOOL' };
      if (writeEdges.length > 0) {
        const tagData = clm.getNodeData<TagNodeData>(writeEdges[0].target);
        tag = { name: tagData.name, dataType: tagData.dataType };
      }
      return {
        id: ae.target,
        qualifier: actionData.qualifier,
        tag,
        duration: actionData.duration,
      };
    });

    return {
      id: stepId,
      name: data.stepName,
      isInitial: data.isInitial,
      actions,
      position: data.position,
    };
  });

  const transitions: SFCTransition[] = transIds.map(transId => {
    const data = clm.getNodeData<SFCTransitionNodeData>(transId);
    return {
      id: transId,
      condition: data.conditionExpr,
      position: data.position,
      priority: data.priority,
    };
  });

  // Reconstruct links from SFC_FLOW edges
  const links: SFCLink[] = [];
  const allSfcNodes = [...stepIds, ...transIds];
  for (const nodeId of allSfcNodes) {
    const flowEdges = clm.getOutEdgesByType(nodeId, 'SFC_FLOW');
    for (const edge of flowEdges) {
      const linkData = edge.data as any;
      links.push({
        id: linkData?.linkId ?? edge.edgeKey,
        from: nodeId,
        to: edge.target,
        type: linkData?.linkType ?? 'simple',
      });
    }
  }

  // Reconstruct SFC branches from SFC_FLOW topology.
  // An AND-divergence is signalled by a transition with >1 outgoing SFC_FLOW edges,
  // a SELECT-divergence by a step with >1 outgoing edges.
  const branches: SFCBranch[] = [];
  for (const transId of transIds) {
    const outFlows = clm.getOutEdgesByType(transId, 'SFC_FLOW');
    if (outFlows.length > 1) {
      // AND-divergence: transition fans out to multiple steps simultaneously
      branches.push({
        id: `branch-and-${transId}`,
        type: 'simultaneous',
        startNodeId: transId,
        endNodeId: '',   // convergence node unknown without full topology analysis
        stepIds: outFlows.map(f => f.target),
      });
    }
  }
  for (const stepId of stepIds) {
    const outFlows = clm.getOutEdgesByType(stepId, 'SFC_FLOW');
    if (outFlows.length > 1) {
      // SELECT-divergence: step fans out to multiple transitions (alternative paths)
      branches.push({
        id: `branch-sel-${stepId}`,
        type: 'selection',
        startNodeId: stepId,
        endNodeId: '',
        stepIds: [],
        transitionIds: outFlows.map(f => f.target),
      });
    }
  }

  // Reconstruct SFC jumps
  const jumpNodeIds = clm.getNodesByType('SFC_JUMP');
  const jumps = jumpNodeIds.map(jid => {
    const jdata = clm.getNodeData<import('./schema.js').SFCJumpNodeData>(jid);
    return { id: jid, targetStepName: jdata.targetStepName };
  });

  return { steps, transitions, links, branches, jumps };
}

// ─── Tag Database Projection ─────────────────────────────────────────────────

export function projectTagDatabase(clm: CLMGraph): TagEntry[] {
  const tagIds = clm.getNodesByType('TAG');
  return tagIds.map(tagId => {
    const data = clm.getNodeData<TagNodeData>(tagId);
    return {
      name: data.name,
      address: data.address ?? '',
      dataType: data.dataType,
      description: data.description ?? '',
      initialValue: data.initialValue,
      retain: data.retain ?? false,
    };
  });
}
