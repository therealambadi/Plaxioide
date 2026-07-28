/*
 * CLM Store — Reactive layer over the CLM graph.
 * Holds the single graph instance, exposes mutation methods that update the graph
 * and fire notifications so React re-renders.
 *
 * Canvases consume data via projection hooks (useCLMLadder, useCLMFBD, useCLMSFC)
 * which internally call the projection functions and memoize results.
 */

import { CLMGraph } from './graph.js';
import { buildCLMFromStore, POU_ID, parseConditionTagRefs, isFBOutputPin } from './builder.js';
import { projectLadderProgram, projectFBDProgram, projectSFCProgram, projectTagDatabase } from './projections.js';
import type {
  LDElementKind,
  TagNodeData,
  RungNodeData,
  LDElementNodeData,
  FBDBlockNodeData,
  FBDPinNodeData,
  SFCStepNodeData,
  SFCTransitionNodeData,
  SFCActionNodeData,
  ActionQualifier,
  CLMEdgeType,
} from './schema.js';
import type {
  LadderProgram,
  FBDProgram,
  SFCProgram,
  TagEntry,
  LadderElement,
  FBDNode,
  FBDWire,
  SFCStep,
  SFCTransition,
  SFCLink,
  SFCBranch,
  Rung,
  ContactType,
  CoilType,
  IECDataType,
  EditorLanguage,
} from '../logicStore.js';

type Listener = () => void;

class CLMStore {
  private _graph: CLMGraph;
  private _listeners = new Set<Listener>();
  private _initialized = false;

  constructor() {
    this._graph = new CLMGraph();
  }

  get graph(): CLMGraph {
    return this._graph;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * Initialize CLM from existing flat store state.
   * Called once at app startup after logicStore has its initial data.
   */
  initialize(
    ladderProgram: LadderProgram,
    fbdProgram: FBDProgram,
    sfcProgram: SFCProgram,
    tagDatabase: TagEntry[],
  ): void {
    this._graph = buildCLMFromStore(ladderProgram, fbdProgram, sfcProgram, tagDatabase);
    this._initialized = true;
    this._notify();
    console.log(`[CLM] Initialized: ${this._graph.nodeCount} nodes, ${this._graph.edgeCount} edges`);
  }

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _notify(): void {
    this._listeners.forEach(l => l());
  }

  // ─── Projections (produce flat data for canvases) ──────────────────────────

  getLadderProgram(): LadderProgram {
    return projectLadderProgram(this._graph);
  }

  getFBDProgram(): FBDProgram {
    return projectFBDProgram(this._graph);
  }

  getSFCProgram(): SFCProgram {
    return projectSFCProgram(this._graph);
  }

  getTagDatabase(): TagEntry[] {
    return projectTagDatabase(this._graph);
  }

  // ─── Cross-Reference ──────────────────────────────────────────────────────

  getCrossReferences(tagName: string) {
    return this._graph.getCrossReferences(tagName);
  }

  // ─── Mutations: Ladder ─────────────────────────────────────────────────────

  addRung(afterRungId?: string): string {
    const id = `rung-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const existingRungs = this._graph.getNodesByType('RUNG');
    const rungNumber = existingRungs.length + 1;

    this._graph.addNode(id, 'RUNG', 'LD', {
      rungNumber,
      comment: '',
    } satisfies RungNodeData);

    this._graph.addEdge(POU_ID, id, 'CONTAINS');

    // Insert into RUNG_ORDER chain
    if (afterRungId && this._graph.hasNode(afterRungId)) {
      // Find what currently follows afterRungId
      const nextEdges = this._graph.getOutEdgesByType(afterRungId, 'RUNG_ORDER');
      if (nextEdges.length > 0) {
        // Remove old edge, insert new node in chain
        this._graph.removeEdge(nextEdges[0].edgeKey);
        this._graph.addEdge(id, nextEdges[0].target, 'RUNG_ORDER');
      }
      this._graph.addEdge(afterRungId, id, 'RUNG_ORDER');
    } else if (existingRungs.length > 0) {
      // Append at end: find last rung in chain
      const lastRung = this._findLastInChain(existingRungs);
      if (lastRung) {
        this._graph.addEdge(lastRung, id, 'RUNG_ORDER');
      }
    }

    this._renumberRungs();
    this._notify();
    return id;
  }

  deleteRung(rungId: string): void {
    if (!this._graph.hasNode(rungId)) return;

    // Fix RUNG_ORDER chain: connect predecessor to successor
    const inEdges = this._graph.getInEdgesByType(rungId, 'RUNG_ORDER');
    const outEdges = this._graph.getOutEdgesByType(rungId, 'RUNG_ORDER');
    const predecessor = inEdges.length > 0 ? inEdges[0].source : null;
    const successor = outEdges.length > 0 ? outEdges[0].target : null;

    if (predecessor && successor) {
      this._graph.addEdge(predecessor, successor, 'RUNG_ORDER');
    }

    // Remove all children (LD_ELEMENT nodes) of this rung
    const children = this._graph.getChildren(rungId);
    for (const childId of children) {
      this._graph.removeNode(childId);
    }

    this._graph.removeNode(rungId);
    this._renumberRungs();
    this._notify();
  }

  addElementToRung(rungId: string, element: LadderElement): void {
    this._addLDElementFromFlat(rungId, element);
    this._notify();
  }

  updateElement(elementId: string, updates: Partial<LadderElement>): void {
    if (!this._graph.hasNode(elementId)) return;
    const data = this._graph.getNodeData<LDElementNodeData>(elementId);

    // Position change
    if (updates.position) {
      data.position = updates.position;
    }

    // Kind change (e.g. NO contact → NC contact, normal coil → set coil)
    if (updates.kind === 'contact' && 'type' in updates) {
      const map: Record<string, LDElementKind> = {
        'NO': 'contact_no', 'NC': 'contact_nc', 'P_CONTACT': 'contact_p', 'N_CONTACT': 'contact_n',
      };
      data.elementKind = map[(updates as any).type] ?? data.elementKind;
    } else if (updates.kind === 'coil' && 'type' in updates) {
      const map: Record<string, LDElementKind> = {
        'normal': 'coil', 'negated': 'coil_negated', 'set': 'coil_set',
        'reset': 'coil_reset', 'latch': 'coil_latch', 'unlatch': 'coil_unlatch',
      };
      data.elementKind = map[(updates as any).type] ?? data.elementKind;
    }

    // Block-specific fields
    if (updates.kind === 'block') {
      if ('fbType' in updates && updates.fbType) data.fbType = updates.fbType as string;
      if ('instanceName' in updates) data.instanceName = (updates as any).instanceName;
    }

    this._graph.updateNodeData(elementId, data);

    // Tag reference changed — re-wire READS/WRITES edges
    if ('tag' in updates && (updates as any).tag) {
      const tag = (updates as any).tag;
      // Remove old READS/WRITES edges
      const oldReads = this._graph.getOutEdgesByType(elementId, 'READS');
      const oldWrites = this._graph.getOutEdgesByType(elementId, 'WRITES');
      for (const e of [...oldReads, ...oldWrites]) {
        this._graph.removeEdge(e.edgeKey);
      }
      // Add new — direction determined by updated kind
      const tagId = this._ensureTag(tag.name, tag.dataType);
      const isWrite = data.elementKind.startsWith('coil');
      this._graph.addEdge(elementId, tagId, isWrite ? 'WRITES' : 'READS');
    }

    this._notify();
  }

  deleteElement(elementId: string): void {
    if (this._graph.hasNode(elementId)) {
      this._graph.removeNode(elementId);
      this._notify();
    }
  }

  updateRungComment(rungId: string, comment: string): void {
    if (!this._graph.hasNode(rungId)) return;
    const data = this._graph.getNodeData<RungNodeData>(rungId);
    this._graph.updateNodeData(rungId, { ...data, comment });
    this._notify();
  }

  // ─── Mutations: FBD ────────────────────────────────────────────────────────

  addFBDNode(node: FBDNode): void {
    this._graph.addNode(node.id, 'FBD_BLOCK', 'FBD', {
      blockType: node.type,
      instanceName: node.instanceName,
      label: node.label,
      content: node.content,
      position: node.position,
      size: node.size,
    } satisfies FBDBlockNodeData);

    this._graph.addEdge(POU_ID, node.id, 'CONTAINS');

    for (const pin of node.inputs) {
      const pinNodeId = `${node.id}::${pin.id}`;
      this._graph.addNode(pinNodeId, 'FBD_PIN', 'FBD', {
        pinName: pin.name, direction: 'in', dataType: pin.dataType, negated: pin.negated,
      } satisfies FBDPinNodeData);
      this._graph.addEdge(node.id, pinNodeId, 'HAS_PIN');
    }
    for (const pin of node.outputs) {
      const pinNodeId = `${node.id}::${pin.id}`;
      this._graph.addNode(pinNodeId, 'FBD_PIN', 'FBD', {
        pinName: pin.name, direction: 'out', dataType: pin.dataType, negated: pin.negated,
      } satisfies FBDPinNodeData);
      this._graph.addEdge(node.id, pinNodeId, 'HAS_PIN');
    }

    if (node.tag) {
      const tagId = this._ensureTag(node.tag.name, node.tag.dataType);
      if (node.type === 'IN_VARIABLE' || node.type === 'INOUT_VARIABLE') {
        this._graph.addEdge(node.id, tagId, 'READS');
      }
      if (node.type === 'OUT_VARIABLE' || node.type === 'INOUT_VARIABLE') {
        this._graph.addEdge(node.id, tagId, 'WRITES');
      }
    }

    this._notify();
  }

  updateFBDNode(nodeId: string, updates: Partial<FBDNode>): void {
    if (!this._graph.hasNode(nodeId)) return;
    const data = this._graph.getNodeData<FBDBlockNodeData>(nodeId);
    if (updates.position) data.position = updates.position;
    if (updates.size) data.size = updates.size;
    if (updates.instanceName !== undefined) data.instanceName = updates.instanceName;
    if (updates.label !== undefined) data.label = updates.label;
    if (updates.content !== undefined) data.content = updates.content;
    this._graph.updateNodeData(nodeId, data);
    this._notify();
  }

  deleteFBDNode(nodeId: string): void {
    if (!this._graph.hasNode(nodeId)) return;
    // Remove pins first
    const pinEdges = this._graph.getOutEdgesByType(nodeId, 'HAS_PIN');
    for (const pe of pinEdges) {
      this._graph.removeNode(pe.target);
    }
    this._graph.removeNode(nodeId);
    this._notify();
  }

  addFBDWire(wire: FBDWire): void {
    const fromPinId = this._findPinId(wire.from.nodeId, wire.from.pin, 'out');
    const toPinId = this._findPinId(wire.to.nodeId, wire.to.pin, 'in');

    if (fromPinId && toPinId) {
      this._graph.addEdge(fromPinId, toPinId, 'WIRE', { wireId: wire.id, negated: wire.negated });
    }
    this._notify();
  }

  deleteFBDWire(wireId: string): void {
    // Find and remove the WIRE edge with this wireId
    this._graph.graph.forEachEdge((edgeKey, attr) => {
      if (attr.type === 'WIRE' && (attr.data as any)?.wireId === wireId) {
        this._graph.removeEdge(edgeKey);
      }
    });
    this._notify();
  }

  // ─── Mutations: SFC ────────────────────────────────────────────────────────

  addSFCStep(step: SFCStep): void {
    this._graph.addNode(step.id, 'SFC_STEP', 'SFC', {
      stepName: step.name,
      isInitial: step.isInitial,
      position: step.position,
    } satisfies SFCStepNodeData);
    this._graph.addEdge(POU_ID, step.id, 'CONTAINS');

    for (const action of step.actions) {
      this._addSFCAction(step.id, action);
    }
    this._notify();
  }

  updateSFCStep(stepId: string, updates: Partial<SFCStep>): void {
    if (!this._graph.hasNode(stepId)) return;
    const data = this._graph.getNodeData<SFCStepNodeData>(stepId);
    if (updates.name !== undefined) data.stepName = updates.name;
    if (updates.isInitial !== undefined) data.isInitial = updates.isInitial;
    if (updates.position !== undefined) data.position = updates.position;
    this._graph.updateNodeData(stepId, data);
    this._notify();
  }

  deleteSFCStep(stepId: string): void {
    if (!this._graph.hasNode(stepId)) return;
    // Remove actions
    const actionEdges = this._graph.getOutEdgesByType(stepId, 'HAS_ACTION');
    for (const ae of actionEdges) {
      this._graph.removeNode(ae.target);
    }
    this._graph.removeNode(stepId);
    this._notify();
  }

  addSFCTransition(trans: SFCTransition): void {
    this._graph.addNode(trans.id, 'SFC_TRANSITION', 'SFC', {
      conditionExpr: trans.condition,
      position: trans.position,
      priority: trans.priority,
    } satisfies SFCTransitionNodeData);
    this._graph.addEdge(POU_ID, trans.id, 'CONTAINS');

    // Parse condition refs
    const refs = parseConditionTagRefs(trans.condition);
    for (const ref of refs) {
      const tagId = this._ensureTag(ref, 'BOOL');
      this._graph.addEdge(trans.id, tagId, 'READS');
    }
    this._notify();
  }

  updateSFCTransition(transId: string, updates: Partial<SFCTransition>): void {
    if (!this._graph.hasNode(transId)) return;
    const data = this._graph.getNodeData<SFCTransitionNodeData>(transId);
    if (updates.condition !== undefined) {
      // Remove old READS edges from this transition
      const oldReads = this._graph.getOutEdgesByType(transId, 'READS');
      for (const e of oldReads) this._graph.removeEdge(e.edgeKey);

      data.conditionExpr = updates.condition;
      // Add new READS edges
      const refs = parseConditionTagRefs(updates.condition);
      for (const ref of refs) {
        const tagId = this._ensureTag(ref, 'BOOL');
        this._graph.addEdge(transId, tagId, 'READS');
      }
    }
    if (updates.position !== undefined) data.position = updates.position;
    if (updates.priority !== undefined) data.priority = updates.priority;
    this._graph.updateNodeData(transId, data);
    this._notify();
  }

  deleteSFCTransition(transId: string): void {
    if (this._graph.hasNode(transId)) {
      this._graph.removeNode(transId);
      this._notify();
    }
  }

  addSFCLink(link: SFCLink): void {
    if (this._graph.hasNode(link.from) && this._graph.hasNode(link.to)) {
      this._graph.addEdge(link.from, link.to, 'SFC_FLOW', { linkId: link.id, linkType: link.type });
      this._notify();
    }
  }

  deleteSFCLink(linkId: string): void {
    this._graph.graph.forEachEdge((edgeKey, attr) => {
      if (attr.type === 'SFC_FLOW' && (attr.data as any)?.linkId === linkId) {
        this._graph.removeEdge(edgeKey);
      }
    });
    this._notify();
  }

  addSFCBranch(branch: SFCBranch): void {
    // SFC branches are structural metadata — store as CONTAINS edges on the POU.
    // The branch ID is stored on each step node's branchId field (not a separate node).
    // Branches are reconstructed from SFC_FLOW topology during projection.
    // Here we just ensure the branch steps are correctly associated.
    this._notify();
  }

  deleteSFCBranch(_branchId: string): void {
    // Branch removal: all SFC_FLOW edges linking through this branch's steps
    // are already handled by deleteSFCLink/deleteSFCStep.
    this._notify();
  }

  addSFCJump(jump: { id: string; targetStepName: string; position?: { x: number; y: number } }): void {
    if (this._graph.hasNode(jump.id)) return;
    this._graph.addNode(jump.id, 'SFC_JUMP', 'SFC', {
      targetStepName: jump.targetStepName,
    });
    this._graph.addEdge(POU_ID, jump.id, 'CONTAINS');
    this._notify();
  }

  deleteSFCJump(jumpId: string): void {
    if (this._graph.hasNode(jumpId)) {
      this._graph.removeNode(jumpId);
      this._notify();
    }
  }

  // ─── Mutations: Tags ───────────────────────────────────────────────────────

  renameTag(oldName: string, newName: string): void {
    const tagId = this._graph.findTagByName(oldName);
    if (!tagId) return;
    const data = this._graph.getNodeData<TagNodeData>(tagId);
    data.name = newName;
    this._graph.updateNodeData(tagId, data);

    // Propagate rename into SFC transition condition expressions
    // (these embed tag names as plain identifiers in the conditionExpr string)
    for (const transId of this._graph.getNodesByType('SFC_TRANSITION')) {
      const transData = this._graph.getNodeData<import('./schema.js').SFCTransitionNodeData>(transId);
      if (!transData.conditionExpr) continue;
      // Replace whole-word occurrences of oldName with newName
      const updated = transData.conditionExpr.replace(
        new RegExp(`\\b${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'),
        newName,
      );
      if (updated !== transData.conditionExpr) {
        this._graph.updateNodeData(transId, { ...transData, conditionExpr: updated });
      }
    }

    this._notify();
  }

  // ─── Undo/Redo support ─────────────────────────────────────────────────────

  snapshot(): string {
    return this._graph.snapshot();
  }

  restoreFromSnapshot(json: string): void {
    this._graph.restoreFromSnapshot(json);
    this._notify();
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private _ensureTag(name: string, dataType: IECDataType): string {
    const tagId = `tag-${name}`;
    if (!this._graph.hasNode(tagId)) {
      this._graph.addNode(tagId, 'TAG', 'shared', {
        name, dataType, scope: 'global',
      } satisfies TagNodeData);
    }
    return tagId;
  }

  private _findLastInChain(rungIds: string[]): string | null {
    const hasOutgoing = new Set<string>();
    for (const id of rungIds) {
      const out = this._graph.getOutEdgesByType(id, 'RUNG_ORDER');
      if (out.length > 0) hasOutgoing.add(id);
    }
    return rungIds.find(id => !hasOutgoing.has(id)) ?? null;
  }

  private _renumberRungs(): void {
    const rungIds = this._graph.getNodesByType('RUNG');
    // Follow RUNG_ORDER chain
    const ordered = this._orderRungs(rungIds);
    ordered.forEach((id, i) => {
      const data = this._graph.getNodeData<RungNodeData>(id);
      data.rungNumber = i + 1;
      this._graph.updateNodeData(id, data);
    });
  }

  private _orderRungs(rungIds: string[]): string[] {
    if (rungIds.length <= 1) return rungIds;
    const nextMap = new Map<string, string>();
    const hasIncoming = new Set<string>();
    for (const id of rungIds) {
      const outEdges = this._graph.getOutEdgesByType(id, 'RUNG_ORDER');
      if (outEdges.length > 0) {
        nextMap.set(id, outEdges[0].target);
        hasIncoming.add(outEdges[0].target);
      }
    }
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
    for (const id of rungIds) {
      if (!visited.has(id)) ordered.push(id);
    }
    return ordered;
  }

  private _findPinId(blockId: string, pinName: string, direction: 'in' | 'out'): string | null {
    const pinEdges = this._graph.getOutEdgesByType(blockId, 'HAS_PIN');
    for (const pe of pinEdges) {
      const pd = this._graph.getNodeData<FBDPinNodeData>(pe.target);
      if (pd.pinName === pinName && pd.direction === direction) return pe.target;
    }
    return null;
  }

  private _addLDElementFromFlat(rungId: string, el: LadderElement, branchId?: string): void {
    let kind: LDElementKind;
    if (el.kind === 'contact') {
      const map: Record<string, LDElementKind> = {
        'NO': 'contact_no', 'NC': 'contact_nc', 'P_CONTACT': 'contact_p', 'N_CONTACT': 'contact_n'
      };
      kind = map[el.type] ?? 'contact_no';
    } else if (el.kind === 'coil') {
      const map: Record<string, LDElementKind> = {
        'normal': 'coil', 'negated': 'coil_negated', 'set': 'coil_set',
        'reset': 'coil_reset', 'latch': 'coil_latch', 'unlatch': 'coil_unlatch'
      };
      kind = map[el.type] ?? 'coil';
    } else {
      kind = 'fb_call';
    }

    this._graph.addNode(el.id, 'LD_ELEMENT', 'LD', {
      elementKind: kind, position: el.position, branchId,
      ...(el.kind === 'block' ? { fbType: el.fbType, instanceName: el.instanceName } : {}),
    } satisfies LDElementNodeData);

    this._graph.addEdge(rungId, el.id, 'CONTAINS');

    if (el.kind === 'contact') {
      const tagId = this._ensureTag(el.tag.name, el.tag.dataType);
      this._graph.addEdge(el.id, tagId, 'READS');
    } else if (el.kind === 'coil') {
      const tagId = this._ensureTag(el.tag.name, el.tag.dataType);
      this._graph.addEdge(el.id, tagId, 'WRITES');
    } else if (el.kind === 'block') {
      for (const [pinName, tagRef] of Object.entries(el.pins)) {
        if (!tagRef.name) continue;
        const tagId = this._ensureTag(tagRef.name, tagRef.dataType);
        this._graph.addEdge(el.id, tagId,
          isFBOutputPin(el.fbType, pinName) ? 'WRITES' : 'READS',
          { pinName });
      }
    }
  }

  private _addSFCAction(stepId: string, action: { id: string; qualifier: any; tag: { name: string; dataType: IECDataType }; duration?: string }): void {
    this._graph.addNode(action.id, 'SFC_ACTION', 'SFC', {
      actionName: action.tag.name,
      qualifier: action.qualifier,
      duration: action.duration,
    } satisfies SFCActionNodeData);
    this._graph.addEdge(stepId, action.id, 'HAS_ACTION');
    const tagId = this._ensureTag(action.tag.name, action.tag.dataType);
    this._graph.addEdge(action.id, tagId, 'WRITES');
  }
}

// Singleton
export const clmStore = new CLMStore();
