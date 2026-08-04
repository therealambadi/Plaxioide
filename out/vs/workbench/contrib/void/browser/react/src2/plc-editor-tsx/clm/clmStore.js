import { CLMGraph } from "./graph.js";
import { buildCLMFromStore, POU_ID, parseConditionTagRefs, isFBOutputPin } from "./builder.js";
import { projectLadderProgram, projectFBDProgram, projectSFCProgram, projectTagDatabase } from "./projections.js";
class CLMStore {
  constructor() {
    this._listeners = /* @__PURE__ */ new Set();
    this._initialized = false;
    this._graph = new CLMGraph();
  }
  get graph() {
    return this._graph;
  }
  get initialized() {
    return this._initialized;
  }
  /**
   * Initialize CLM from existing flat store state.
   * Called once at app startup after logicStore has its initial data.
   */
  initialize(ladderProgram, fbdProgram, sfcProgram, tagDatabase) {
    this._graph = buildCLMFromStore(ladderProgram, fbdProgram, sfcProgram, tagDatabase);
    this._initialized = true;
    this._notify();
    console.log(`[CLM] Initialized: ${this._graph.nodeCount} nodes, ${this._graph.edgeCount} edges`);
  }
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }
  _notify() {
    this._listeners.forEach((l) => l());
  }
  // ─── Projections (produce flat data for canvases) ──────────────────────────
  getLadderProgram() {
    return projectLadderProgram(this._graph);
  }
  getFBDProgram() {
    return projectFBDProgram(this._graph);
  }
  getSFCProgram() {
    return projectSFCProgram(this._graph);
  }
  getTagDatabase() {
    return projectTagDatabase(this._graph);
  }
  // ─── Cross-Reference ──────────────────────────────────────────────────────
  getCrossReferences(tagName) {
    return this._graph.getCrossReferences(tagName);
  }
  // ─── Mutations: Ladder ─────────────────────────────────────────────────────
  addRung(afterRungId) {
    const id = `rung-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const existingRungs = this._graph.getNodesByType("RUNG");
    const rungNumber = existingRungs.length + 1;
    this._graph.addNode(id, "RUNG", "LD", {
      rungNumber,
      comment: ""
    });
    this._graph.addEdge(POU_ID, id, "CONTAINS");
    if (afterRungId && this._graph.hasNode(afterRungId)) {
      const nextEdges = this._graph.getOutEdgesByType(afterRungId, "RUNG_ORDER");
      if (nextEdges.length > 0) {
        this._graph.removeEdge(nextEdges[0].edgeKey);
        this._graph.addEdge(id, nextEdges[0].target, "RUNG_ORDER");
      }
      this._graph.addEdge(afterRungId, id, "RUNG_ORDER");
    } else if (existingRungs.length > 0) {
      const lastRung = this._findLastInChain(existingRungs);
      if (lastRung) {
        this._graph.addEdge(lastRung, id, "RUNG_ORDER");
      }
    }
    this._renumberRungs();
    this._notify();
    return id;
  }
  deleteRung(rungId) {
    if (!this._graph.hasNode(rungId)) return;
    const inEdges = this._graph.getInEdgesByType(rungId, "RUNG_ORDER");
    const outEdges = this._graph.getOutEdgesByType(rungId, "RUNG_ORDER");
    const predecessor = inEdges.length > 0 ? inEdges[0].source : null;
    const successor = outEdges.length > 0 ? outEdges[0].target : null;
    if (predecessor && successor) {
      this._graph.addEdge(predecessor, successor, "RUNG_ORDER");
    }
    const children = this._graph.getChildren(rungId);
    for (const childId of children) {
      this._graph.removeNode(childId);
    }
    this._graph.removeNode(rungId);
    this._renumberRungs();
    this._notify();
  }
  addElementToRung(rungId, element) {
    this._addLDElementFromFlat(rungId, element);
    this._notify();
  }
  updateElement(elementId, updates) {
    if (!this._graph.hasNode(elementId)) return;
    const data = this._graph.getNodeData(elementId);
    if (updates.position) {
      data.position = updates.position;
    }
    if (updates.kind === "contact" && "type" in updates) {
      const map = {
        "NO": "contact_no",
        "NC": "contact_nc",
        "P_CONTACT": "contact_p",
        "N_CONTACT": "contact_n"
      };
      data.elementKind = map[updates.type] ?? data.elementKind;
    } else if (updates.kind === "coil" && "type" in updates) {
      const map = {
        "normal": "coil",
        "negated": "coil_negated",
        "set": "coil_set",
        "reset": "coil_reset",
        "latch": "coil_latch",
        "unlatch": "coil_unlatch"
      };
      data.elementKind = map[updates.type] ?? data.elementKind;
    }
    if (updates.kind === "block") {
      if ("fbType" in updates && updates.fbType) data.fbType = updates.fbType;
      if ("instanceName" in updates) data.instanceName = updates.instanceName;
    }
    this._graph.updateNodeData(elementId, data);
    if ("tag" in updates && updates.tag) {
      const tag = updates.tag;
      const oldReads = this._graph.getOutEdgesByType(elementId, "READS");
      const oldWrites = this._graph.getOutEdgesByType(elementId, "WRITES");
      for (const e of [...oldReads, ...oldWrites]) {
        this._graph.removeEdge(e.edgeKey);
      }
      const tagId = this._ensureTag(tag.name, tag.dataType);
      const isWrite = data.elementKind.startsWith("coil");
      this._graph.addEdge(elementId, tagId, isWrite ? "WRITES" : "READS");
    }
    this._notify();
  }
  deleteElement(elementId) {
    if (this._graph.hasNode(elementId)) {
      this._graph.removeNode(elementId);
      this._notify();
    }
  }
  updateRungComment(rungId, comment) {
    if (!this._graph.hasNode(rungId)) return;
    const data = this._graph.getNodeData(rungId);
    this._graph.updateNodeData(rungId, { ...data, comment });
    this._notify();
  }
  // ─── Mutations: FBD ────────────────────────────────────────────────────────
  addFBDNode(node) {
    this._graph.addNode(node.id, "FBD_BLOCK", "FBD", {
      blockType: node.type,
      instanceName: node.instanceName,
      label: node.label,
      content: node.content,
      position: node.position,
      size: node.size
    });
    this._graph.addEdge(POU_ID, node.id, "CONTAINS");
    for (const pin of node.inputs) {
      const pinNodeId = `${node.id}::${pin.id}`;
      this._graph.addNode(pinNodeId, "FBD_PIN", "FBD", {
        pinName: pin.name,
        direction: "in",
        dataType: pin.dataType,
        negated: pin.negated
      });
      this._graph.addEdge(node.id, pinNodeId, "HAS_PIN");
    }
    for (const pin of node.outputs) {
      const pinNodeId = `${node.id}::${pin.id}`;
      this._graph.addNode(pinNodeId, "FBD_PIN", "FBD", {
        pinName: pin.name,
        direction: "out",
        dataType: pin.dataType,
        negated: pin.negated
      });
      this._graph.addEdge(node.id, pinNodeId, "HAS_PIN");
    }
    if (node.tag) {
      const tagId = this._ensureTag(node.tag.name, node.tag.dataType);
      if (node.type === "IN_VARIABLE" || node.type === "INOUT_VARIABLE") {
        this._graph.addEdge(node.id, tagId, "READS");
      }
      if (node.type === "OUT_VARIABLE" || node.type === "INOUT_VARIABLE") {
        this._graph.addEdge(node.id, tagId, "WRITES");
      }
    }
    this._notify();
  }
  updateFBDNode(nodeId, updates) {
    if (!this._graph.hasNode(nodeId)) return;
    const data = this._graph.getNodeData(nodeId);
    if (updates.position) data.position = updates.position;
    if (updates.size) data.size = updates.size;
    if (updates.instanceName !== void 0) data.instanceName = updates.instanceName;
    if (updates.label !== void 0) data.label = updates.label;
    if (updates.content !== void 0) data.content = updates.content;
    this._graph.updateNodeData(nodeId, data);
    this._notify();
  }
  deleteFBDNode(nodeId) {
    if (!this._graph.hasNode(nodeId)) return;
    const pinEdges = this._graph.getOutEdgesByType(nodeId, "HAS_PIN");
    for (const pe of pinEdges) {
      this._graph.removeNode(pe.target);
    }
    this._graph.removeNode(nodeId);
    this._notify();
  }
  addFBDWire(wire) {
    const fromPinId = this._findPinId(wire.from.nodeId, wire.from.pin, "out");
    const toPinId = this._findPinId(wire.to.nodeId, wire.to.pin, "in");
    if (fromPinId && toPinId) {
      this._graph.addEdge(fromPinId, toPinId, "WIRE", { wireId: wire.id, negated: wire.negated });
    }
    this._notify();
  }
  deleteFBDWire(wireId) {
    this._graph.graph.forEachEdge((edgeKey, attr) => {
      if (attr.type === "WIRE" && attr.data?.wireId === wireId) {
        this._graph.removeEdge(edgeKey);
      }
    });
    this._notify();
  }
  // ─── Mutations: SFC ────────────────────────────────────────────────────────
  addSFCStep(step) {
    this._graph.addNode(step.id, "SFC_STEP", "SFC", {
      stepName: step.name,
      isInitial: step.isInitial,
      position: step.position
    });
    this._graph.addEdge(POU_ID, step.id, "CONTAINS");
    for (const action of step.actions) {
      this._addSFCAction(step.id, action);
    }
    this._notify();
  }
  updateSFCStep(stepId, updates) {
    if (!this._graph.hasNode(stepId)) return;
    const data = this._graph.getNodeData(stepId);
    if (updates.name !== void 0) data.stepName = updates.name;
    if (updates.isInitial !== void 0) data.isInitial = updates.isInitial;
    if (updates.position !== void 0) data.position = updates.position;
    this._graph.updateNodeData(stepId, data);
    this._notify();
  }
  deleteSFCStep(stepId) {
    if (!this._graph.hasNode(stepId)) return;
    const actionEdges = this._graph.getOutEdgesByType(stepId, "HAS_ACTION");
    for (const ae of actionEdges) {
      this._graph.removeNode(ae.target);
    }
    this._graph.removeNode(stepId);
    this._notify();
  }
  addSFCTransition(trans) {
    this._graph.addNode(trans.id, "SFC_TRANSITION", "SFC", {
      conditionExpr: trans.condition,
      position: trans.position,
      priority: trans.priority
    });
    this._graph.addEdge(POU_ID, trans.id, "CONTAINS");
    const refs = parseConditionTagRefs(trans.condition);
    for (const ref of refs) {
      const tagId = this._ensureTag(ref, "BOOL");
      this._graph.addEdge(trans.id, tagId, "READS");
    }
    this._notify();
  }
  updateSFCTransition(transId, updates) {
    if (!this._graph.hasNode(transId)) return;
    const data = this._graph.getNodeData(transId);
    if (updates.condition !== void 0) {
      const oldReads = this._graph.getOutEdgesByType(transId, "READS");
      for (const e of oldReads) this._graph.removeEdge(e.edgeKey);
      data.conditionExpr = updates.condition;
      const refs = parseConditionTagRefs(updates.condition);
      for (const ref of refs) {
        const tagId = this._ensureTag(ref, "BOOL");
        this._graph.addEdge(transId, tagId, "READS");
      }
    }
    if (updates.position !== void 0) data.position = updates.position;
    if (updates.priority !== void 0) data.priority = updates.priority;
    this._graph.updateNodeData(transId, data);
    this._notify();
  }
  deleteSFCTransition(transId) {
    if (this._graph.hasNode(transId)) {
      this._graph.removeNode(transId);
      this._notify();
    }
  }
  addSFCLink(link) {
    if (this._graph.hasNode(link.from) && this._graph.hasNode(link.to)) {
      this._graph.addEdge(link.from, link.to, "SFC_FLOW", { linkId: link.id, linkType: link.type });
      this._notify();
    }
  }
  deleteSFCLink(linkId) {
    this._graph.graph.forEachEdge((edgeKey, attr) => {
      if (attr.type === "SFC_FLOW" && attr.data?.linkId === linkId) {
        this._graph.removeEdge(edgeKey);
      }
    });
    this._notify();
  }
  addSFCBranch(branch) {
    this._notify();
  }
  deleteSFCBranch(_branchId) {
    this._notify();
  }
  addSFCJump(jump) {
    if (this._graph.hasNode(jump.id)) return;
    this._graph.addNode(jump.id, "SFC_JUMP", "SFC", {
      targetStepName: jump.targetStepName
    });
    this._graph.addEdge(POU_ID, jump.id, "CONTAINS");
    this._notify();
  }
  deleteSFCJump(jumpId) {
    if (this._graph.hasNode(jumpId)) {
      this._graph.removeNode(jumpId);
      this._notify();
    }
  }
  // ─── Mutations: Tags ───────────────────────────────────────────────────────
  renameTag(oldName, newName) {
    const tagId = this._graph.findTagByName(oldName);
    if (!tagId) return;
    const data = this._graph.getNodeData(tagId);
    data.name = newName;
    this._graph.updateNodeData(tagId, data);
    for (const transId of this._graph.getNodesByType("SFC_TRANSITION")) {
      const transData = this._graph.getNodeData(transId);
      if (!transData.conditionExpr) continue;
      const updated = transData.conditionExpr.replace(
        new RegExp(`\\b${oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"),
        newName
      );
      if (updated !== transData.conditionExpr) {
        this._graph.updateNodeData(transId, { ...transData, conditionExpr: updated });
      }
    }
    this._notify();
  }
  // ─── Undo/Redo support ─────────────────────────────────────────────────────
  snapshot() {
    return this._graph.snapshot();
  }
  restoreFromSnapshot(json) {
    this._graph.restoreFromSnapshot(json);
    this._notify();
  }
  // ─── Private helpers ───────────────────────────────────────────────────────
  _ensureTag(name, dataType) {
    const tagId = `tag-${name}`;
    if (!this._graph.hasNode(tagId)) {
      this._graph.addNode(tagId, "TAG", "shared", {
        name,
        dataType,
        scope: "global"
      });
    }
    return tagId;
  }
  _findLastInChain(rungIds) {
    const hasOutgoing = /* @__PURE__ */ new Set();
    for (const id of rungIds) {
      const out = this._graph.getOutEdgesByType(id, "RUNG_ORDER");
      if (out.length > 0) hasOutgoing.add(id);
    }
    return rungIds.find((id) => !hasOutgoing.has(id)) ?? null;
  }
  _renumberRungs() {
    const rungIds = this._graph.getNodesByType("RUNG");
    const ordered = this._orderRungs(rungIds);
    ordered.forEach((id, i) => {
      const data = this._graph.getNodeData(id);
      data.rungNumber = i + 1;
      this._graph.updateNodeData(id, data);
    });
  }
  _orderRungs(rungIds) {
    if (rungIds.length <= 1) return rungIds;
    const nextMap = /* @__PURE__ */ new Map();
    const hasIncoming = /* @__PURE__ */ new Set();
    for (const id of rungIds) {
      const outEdges = this._graph.getOutEdgesByType(id, "RUNG_ORDER");
      if (outEdges.length > 0) {
        nextMap.set(id, outEdges[0].target);
        hasIncoming.add(outEdges[0].target);
      }
    }
    let start = rungIds.find((id) => !hasIncoming.has(id));
    if (!start) start = rungIds[0];
    const ordered = [];
    let current = start;
    const visited = /* @__PURE__ */ new Set();
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
  _findPinId(blockId, pinName, direction) {
    const pinEdges = this._graph.getOutEdgesByType(blockId, "HAS_PIN");
    for (const pe of pinEdges) {
      const pd = this._graph.getNodeData(pe.target);
      if (pd.pinName === pinName && pd.direction === direction) return pe.target;
    }
    return null;
  }
  _addLDElementFromFlat(rungId, el, branchId) {
    let kind;
    if (el.kind === "contact") {
      const map = {
        "NO": "contact_no",
        "NC": "contact_nc",
        "P_CONTACT": "contact_p",
        "N_CONTACT": "contact_n"
      };
      kind = map[el.type] ?? "contact_no";
    } else if (el.kind === "coil") {
      const map = {
        "normal": "coil",
        "negated": "coil_negated",
        "set": "coil_set",
        "reset": "coil_reset",
        "latch": "coil_latch",
        "unlatch": "coil_unlatch"
      };
      kind = map[el.type] ?? "coil";
    } else {
      kind = "fb_call";
    }
    this._graph.addNode(el.id, "LD_ELEMENT", "LD", {
      elementKind: kind,
      position: el.position,
      branchId,
      ...el.kind === "block" ? { fbType: el.fbType, instanceName: el.instanceName } : {}
    });
    this._graph.addEdge(rungId, el.id, "CONTAINS");
    if (el.kind === "contact") {
      const tagId = this._ensureTag(el.tag.name, el.tag.dataType);
      this._graph.addEdge(el.id, tagId, "READS");
    } else if (el.kind === "coil") {
      const tagId = this._ensureTag(el.tag.name, el.tag.dataType);
      this._graph.addEdge(el.id, tagId, "WRITES");
    } else if (el.kind === "block") {
      for (const [pinName, tagRef] of Object.entries(el.pins)) {
        if (!tagRef.name) continue;
        const tagId = this._ensureTag(tagRef.name, tagRef.dataType);
        this._graph.addEdge(
          el.id,
          tagId,
          isFBOutputPin(el.fbType, pinName) ? "WRITES" : "READS",
          { pinName }
        );
      }
    }
  }
  _addSFCAction(stepId, action) {
    this._graph.addNode(action.id, "SFC_ACTION", "SFC", {
      actionName: action.tag.name,
      qualifier: action.qualifier,
      duration: action.duration
    });
    this._graph.addEdge(stepId, action.id, "HAS_ACTION");
    const tagId = this._ensureTag(action.tag.name, action.tag.dataType);
    this._graph.addEdge(action.id, tagId, "WRITES");
  }
}
const clmStore = new CLMStore();
export {
  clmStore
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjMi9wbGMtZWRpdG9yLXRzeC9jbG0vY2xtU3RvcmUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qXG4gKiBDTE0gU3RvcmUgXHUyMDE0IFJlYWN0aXZlIGxheWVyIG92ZXIgdGhlIENMTSBncmFwaC5cbiAqIEhvbGRzIHRoZSBzaW5nbGUgZ3JhcGggaW5zdGFuY2UsIGV4cG9zZXMgbXV0YXRpb24gbWV0aG9kcyB0aGF0IHVwZGF0ZSB0aGUgZ3JhcGhcbiAqIGFuZCBmaXJlIG5vdGlmaWNhdGlvbnMgc28gUmVhY3QgcmUtcmVuZGVycy5cbiAqXG4gKiBDYW52YXNlcyBjb25zdW1lIGRhdGEgdmlhIHByb2plY3Rpb24gaG9va3MgKHVzZUNMTUxhZGRlciwgdXNlQ0xNRkJELCB1c2VDTE1TRkMpXG4gKiB3aGljaCBpbnRlcm5hbGx5IGNhbGwgdGhlIHByb2plY3Rpb24gZnVuY3Rpb25zIGFuZCBtZW1vaXplIHJlc3VsdHMuXG4gKi9cblxuaW1wb3J0IHsgQ0xNR3JhcGggfSBmcm9tICcuL2dyYXBoLmpzJztcbmltcG9ydCB7IGJ1aWxkQ0xNRnJvbVN0b3JlLCBQT1VfSUQsIHBhcnNlQ29uZGl0aW9uVGFnUmVmcywgaXNGQk91dHB1dFBpbiB9IGZyb20gJy4vYnVpbGRlci5qcyc7XG5pbXBvcnQgeyBwcm9qZWN0TGFkZGVyUHJvZ3JhbSwgcHJvamVjdEZCRFByb2dyYW0sIHByb2plY3RTRkNQcm9ncmFtLCBwcm9qZWN0VGFnRGF0YWJhc2UgfSBmcm9tICcuL3Byb2plY3Rpb25zLmpzJztcbmltcG9ydCB0eXBlIHtcbiAgTERFbGVtZW50S2luZCxcbiAgVGFnTm9kZURhdGEsXG4gIFJ1bmdOb2RlRGF0YSxcbiAgTERFbGVtZW50Tm9kZURhdGEsXG4gIEZCREJsb2NrTm9kZURhdGEsXG4gIEZCRFBpbk5vZGVEYXRhLFxuICBTRkNTdGVwTm9kZURhdGEsXG4gIFNGQ1RyYW5zaXRpb25Ob2RlRGF0YSxcbiAgU0ZDQWN0aW9uTm9kZURhdGEsXG4gIEFjdGlvblF1YWxpZmllcixcbiAgQ0xNRWRnZVR5cGUsXG59IGZyb20gJy4vc2NoZW1hLmpzJztcbmltcG9ydCB0eXBlIHtcbiAgTGFkZGVyUHJvZ3JhbSxcbiAgRkJEUHJvZ3JhbSxcbiAgU0ZDUHJvZ3JhbSxcbiAgVGFnRW50cnksXG4gIExhZGRlckVsZW1lbnQsXG4gIEZCRE5vZGUsXG4gIEZCRFdpcmUsXG4gIFNGQ1N0ZXAsXG4gIFNGQ1RyYW5zaXRpb24sXG4gIFNGQ0xpbmssXG4gIFNGQ0JyYW5jaCxcbiAgUnVuZyxcbiAgQ29udGFjdFR5cGUsXG4gIENvaWxUeXBlLFxuICBJRUNEYXRhVHlwZSxcbiAgRWRpdG9yTGFuZ3VhZ2UsXG59IGZyb20gJy4uL2xvZ2ljU3RvcmUuanMnO1xuXG50eXBlIExpc3RlbmVyID0gKCkgPT4gdm9pZDtcblxuY2xhc3MgQ0xNU3RvcmUge1xuICBwcml2YXRlIF9ncmFwaDogQ0xNR3JhcGg7XG4gIHByaXZhdGUgX2xpc3RlbmVycyA9IG5ldyBTZXQ8TGlzdGVuZXI+KCk7XG4gIHByaXZhdGUgX2luaXRpYWxpemVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5fZ3JhcGggPSBuZXcgQ0xNR3JhcGgoKTtcbiAgfVxuXG4gIGdldCBncmFwaCgpOiBDTE1HcmFwaCB7XG4gICAgcmV0dXJuIHRoaXMuX2dyYXBoO1xuICB9XG5cbiAgZ2V0IGluaXRpYWxpemVkKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLl9pbml0aWFsaXplZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplIENMTSBmcm9tIGV4aXN0aW5nIGZsYXQgc3RvcmUgc3RhdGUuXG4gICAqIENhbGxlZCBvbmNlIGF0IGFwcCBzdGFydHVwIGFmdGVyIGxvZ2ljU3RvcmUgaGFzIGl0cyBpbml0aWFsIGRhdGEuXG4gICAqL1xuICBpbml0aWFsaXplKFxuICAgIGxhZGRlclByb2dyYW06IExhZGRlclByb2dyYW0sXG4gICAgZmJkUHJvZ3JhbTogRkJEUHJvZ3JhbSxcbiAgICBzZmNQcm9ncmFtOiBTRkNQcm9ncmFtLFxuICAgIHRhZ0RhdGFiYXNlOiBUYWdFbnRyeVtdLFxuICApOiB2b2lkIHtcbiAgICB0aGlzLl9ncmFwaCA9IGJ1aWxkQ0xNRnJvbVN0b3JlKGxhZGRlclByb2dyYW0sIGZiZFByb2dyYW0sIHNmY1Byb2dyYW0sIHRhZ0RhdGFiYXNlKTtcbiAgICB0aGlzLl9pbml0aWFsaXplZCA9IHRydWU7XG4gICAgdGhpcy5fbm90aWZ5KCk7XG4gICAgY29uc29sZS5sb2coYFtDTE1dIEluaXRpYWxpemVkOiAke3RoaXMuX2dyYXBoLm5vZGVDb3VudH0gbm9kZXMsICR7dGhpcy5fZ3JhcGguZWRnZUNvdW50fSBlZGdlc2ApO1xuICB9XG5cbiAgc3Vic2NyaWJlKGxpc3RlbmVyOiBMaXN0ZW5lcik6ICgpID0+IHZvaWQge1xuICAgIHRoaXMuX2xpc3RlbmVycy5hZGQobGlzdGVuZXIpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLl9saXN0ZW5lcnMuZGVsZXRlKGxpc3RlbmVyKTtcbiAgfVxuXG4gIHByaXZhdGUgX25vdGlmeSgpOiB2b2lkIHtcbiAgICB0aGlzLl9saXN0ZW5lcnMuZm9yRWFjaChsID0+IGwoKSk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgUHJvamVjdGlvbnMgKHByb2R1Y2UgZmxhdCBkYXRhIGZvciBjYW52YXNlcykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgZ2V0TGFkZGVyUHJvZ3JhbSgpOiBMYWRkZXJQcm9ncmFtIHtcbiAgICByZXR1cm4gcHJvamVjdExhZGRlclByb2dyYW0odGhpcy5fZ3JhcGgpO1xuICB9XG5cbiAgZ2V0RkJEUHJvZ3JhbSgpOiBGQkRQcm9ncmFtIHtcbiAgICByZXR1cm4gcHJvamVjdEZCRFByb2dyYW0odGhpcy5fZ3JhcGgpO1xuICB9XG5cbiAgZ2V0U0ZDUHJvZ3JhbSgpOiBTRkNQcm9ncmFtIHtcbiAgICByZXR1cm4gcHJvamVjdFNGQ1Byb2dyYW0odGhpcy5fZ3JhcGgpO1xuICB9XG5cbiAgZ2V0VGFnRGF0YWJhc2UoKTogVGFnRW50cnlbXSB7XG4gICAgcmV0dXJuIHByb2plY3RUYWdEYXRhYmFzZSh0aGlzLl9ncmFwaCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgQ3Jvc3MtUmVmZXJlbmNlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIGdldENyb3NzUmVmZXJlbmNlcyh0YWdOYW1lOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5fZ3JhcGguZ2V0Q3Jvc3NSZWZlcmVuY2VzKHRhZ05hbWUpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIE11dGF0aW9uczogTGFkZGVyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIGFkZFJ1bmcoYWZ0ZXJSdW5nSWQ/OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IGlkID0gYHJ1bmctJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIsIDcpfWA7XG4gICAgY29uc3QgZXhpc3RpbmdSdW5ncyA9IHRoaXMuX2dyYXBoLmdldE5vZGVzQnlUeXBlKCdSVU5HJyk7XG4gICAgY29uc3QgcnVuZ051bWJlciA9IGV4aXN0aW5nUnVuZ3MubGVuZ3RoICsgMTtcblxuICAgIHRoaXMuX2dyYXBoLmFkZE5vZGUoaWQsICdSVU5HJywgJ0xEJywge1xuICAgICAgcnVuZ051bWJlcixcbiAgICAgIGNvbW1lbnQ6ICcnLFxuICAgIH0gc2F0aXNmaWVzIFJ1bmdOb2RlRGF0YSk7XG5cbiAgICB0aGlzLl9ncmFwaC5hZGRFZGdlKFBPVV9JRCwgaWQsICdDT05UQUlOUycpO1xuXG4gICAgLy8gSW5zZXJ0IGludG8gUlVOR19PUkRFUiBjaGFpblxuICAgIGlmIChhZnRlclJ1bmdJZCAmJiB0aGlzLl9ncmFwaC5oYXNOb2RlKGFmdGVyUnVuZ0lkKSkge1xuICAgICAgLy8gRmluZCB3aGF0IGN1cnJlbnRseSBmb2xsb3dzIGFmdGVyUnVuZ0lkXG4gICAgICBjb25zdCBuZXh0RWRnZXMgPSB0aGlzLl9ncmFwaC5nZXRPdXRFZGdlc0J5VHlwZShhZnRlclJ1bmdJZCwgJ1JVTkdfT1JERVInKTtcbiAgICAgIGlmIChuZXh0RWRnZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAvLyBSZW1vdmUgb2xkIGVkZ2UsIGluc2VydCBuZXcgbm9kZSBpbiBjaGFpblxuICAgICAgICB0aGlzLl9ncmFwaC5yZW1vdmVFZGdlKG5leHRFZGdlc1swXS5lZGdlS2V5KTtcbiAgICAgICAgdGhpcy5fZ3JhcGguYWRkRWRnZShpZCwgbmV4dEVkZ2VzWzBdLnRhcmdldCwgJ1JVTkdfT1JERVInKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2dyYXBoLmFkZEVkZ2UoYWZ0ZXJSdW5nSWQsIGlkLCAnUlVOR19PUkRFUicpO1xuICAgIH0gZWxzZSBpZiAoZXhpc3RpbmdSdW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBBcHBlbmQgYXQgZW5kOiBmaW5kIGxhc3QgcnVuZyBpbiBjaGFpblxuICAgICAgY29uc3QgbGFzdFJ1bmcgPSB0aGlzLl9maW5kTGFzdEluQ2hhaW4oZXhpc3RpbmdSdW5ncyk7XG4gICAgICBpZiAobGFzdFJ1bmcpIHtcbiAgICAgICAgdGhpcy5fZ3JhcGguYWRkRWRnZShsYXN0UnVuZywgaWQsICdSVU5HX09SREVSJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fcmVudW1iZXJSdW5ncygpO1xuICAgIHRoaXMuX25vdGlmeSgpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuXG4gIGRlbGV0ZVJ1bmcocnVuZ0lkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuX2dyYXBoLmhhc05vZGUocnVuZ0lkKSkgcmV0dXJuO1xuXG4gICAgLy8gRml4IFJVTkdfT1JERVIgY2hhaW46IGNvbm5lY3QgcHJlZGVjZXNzb3IgdG8gc3VjY2Vzc29yXG4gICAgY29uc3QgaW5FZGdlcyA9IHRoaXMuX2dyYXBoLmdldEluRWRnZXNCeVR5cGUocnVuZ0lkLCAnUlVOR19PUkRFUicpO1xuICAgIGNvbnN0IG91dEVkZ2VzID0gdGhpcy5fZ3JhcGguZ2V0T3V0RWRnZXNCeVR5cGUocnVuZ0lkLCAnUlVOR19PUkRFUicpO1xuICAgIGNvbnN0IHByZWRlY2Vzc29yID0gaW5FZGdlcy5sZW5ndGggPiAwID8gaW5FZGdlc1swXS5zb3VyY2UgOiBudWxsO1xuICAgIGNvbnN0IHN1Y2Nlc3NvciA9IG91dEVkZ2VzLmxlbmd0aCA+IDAgPyBvdXRFZGdlc1swXS50YXJnZXQgOiBudWxsO1xuXG4gICAgaWYgKHByZWRlY2Vzc29yICYmIHN1Y2Nlc3Nvcikge1xuICAgICAgdGhpcy5fZ3JhcGguYWRkRWRnZShwcmVkZWNlc3Nvciwgc3VjY2Vzc29yLCAnUlVOR19PUkRFUicpO1xuICAgIH1cblxuICAgIC8vIFJlbW92ZSBhbGwgY2hpbGRyZW4gKExEX0VMRU1FTlQgbm9kZXMpIG9mIHRoaXMgcnVuZ1xuICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5fZ3JhcGguZ2V0Q2hpbGRyZW4ocnVuZ0lkKTtcbiAgICBmb3IgKGNvbnN0IGNoaWxkSWQgb2YgY2hpbGRyZW4pIHtcbiAgICAgIHRoaXMuX2dyYXBoLnJlbW92ZU5vZGUoY2hpbGRJZCk7XG4gICAgfVxuXG4gICAgdGhpcy5fZ3JhcGgucmVtb3ZlTm9kZShydW5nSWQpO1xuICAgIHRoaXMuX3JlbnVtYmVyUnVuZ3MoKTtcbiAgICB0aGlzLl9ub3RpZnkoKTtcbiAgfVxuXG4gIGFkZEVsZW1lbnRUb1J1bmcocnVuZ0lkOiBzdHJpbmcsIGVsZW1lbnQ6IExhZGRlckVsZW1lbnQpOiB2b2lkIHtcbiAgICB0aGlzLl9hZGRMREVsZW1lbnRGcm9tRmxhdChydW5nSWQsIGVsZW1lbnQpO1xuICAgIHRoaXMuX25vdGlmeSgpO1xuICB9XG5cbiAgdXBkYXRlRWxlbWVudChlbGVtZW50SWQ6IHN0cmluZywgdXBkYXRlczogUGFydGlhbDxMYWRkZXJFbGVtZW50Pik6IHZvaWQge1xuICAgIGlmICghdGhpcy5fZ3JhcGguaGFzTm9kZShlbGVtZW50SWQpKSByZXR1cm47XG4gICAgY29uc3QgZGF0YSA9IHRoaXMuX2dyYXBoLmdldE5vZGVEYXRhPExERWxlbWVudE5vZGVEYXRhPihlbGVtZW50SWQpO1xuXG4gICAgLy8gUG9zaXRpb24gY2hhbmdlXG4gICAgaWYgKHVwZGF0ZXMucG9zaXRpb24pIHtcbiAgICAgIGRhdGEucG9zaXRpb24gPSB1cGRhdGVzLnBvc2l0aW9uO1xuICAgIH1cblxuICAgIC8vIEtpbmQgY2hhbmdlIChlLmcuIE5PIGNvbnRhY3QgXHUyMTkyIE5DIGNvbnRhY3QsIG5vcm1hbCBjb2lsIFx1MjE5MiBzZXQgY29pbClcbiAgICBpZiAodXBkYXRlcy5raW5kID09PSAnY29udGFjdCcgJiYgJ3R5cGUnIGluIHVwZGF0ZXMpIHtcbiAgICAgIGNvbnN0IG1hcDogUmVjb3JkPHN0cmluZywgTERFbGVtZW50S2luZD4gPSB7XG4gICAgICAgICdOTyc6ICdjb250YWN0X25vJywgJ05DJzogJ2NvbnRhY3RfbmMnLCAnUF9DT05UQUNUJzogJ2NvbnRhY3RfcCcsICdOX0NPTlRBQ1QnOiAnY29udGFjdF9uJyxcbiAgICAgIH07XG4gICAgICBkYXRhLmVsZW1lbnRLaW5kID0gbWFwWyh1cGRhdGVzIGFzIGFueSkudHlwZV0gPz8gZGF0YS5lbGVtZW50S2luZDtcbiAgICB9IGVsc2UgaWYgKHVwZGF0ZXMua2luZCA9PT0gJ2NvaWwnICYmICd0eXBlJyBpbiB1cGRhdGVzKSB7XG4gICAgICBjb25zdCBtYXA6IFJlY29yZDxzdHJpbmcsIExERWxlbWVudEtpbmQ+ID0ge1xuICAgICAgICAnbm9ybWFsJzogJ2NvaWwnLCAnbmVnYXRlZCc6ICdjb2lsX25lZ2F0ZWQnLCAnc2V0JzogJ2NvaWxfc2V0JyxcbiAgICAgICAgJ3Jlc2V0JzogJ2NvaWxfcmVzZXQnLCAnbGF0Y2gnOiAnY29pbF9sYXRjaCcsICd1bmxhdGNoJzogJ2NvaWxfdW5sYXRjaCcsXG4gICAgICB9O1xuICAgICAgZGF0YS5lbGVtZW50S2luZCA9IG1hcFsodXBkYXRlcyBhcyBhbnkpLnR5cGVdID8/IGRhdGEuZWxlbWVudEtpbmQ7XG4gICAgfVxuXG4gICAgLy8gQmxvY2stc3BlY2lmaWMgZmllbGRzXG4gICAgaWYgKHVwZGF0ZXMua2luZCA9PT0gJ2Jsb2NrJykge1xuICAgICAgaWYgKCdmYlR5cGUnIGluIHVwZGF0ZXMgJiYgdXBkYXRlcy5mYlR5cGUpIGRhdGEuZmJUeXBlID0gdXBkYXRlcy5mYlR5cGUgYXMgc3RyaW5nO1xuICAgICAgaWYgKCdpbnN0YW5jZU5hbWUnIGluIHVwZGF0ZXMpIGRhdGEuaW5zdGFuY2VOYW1lID0gKHVwZGF0ZXMgYXMgYW55KS5pbnN0YW5jZU5hbWU7XG4gICAgfVxuXG4gICAgdGhpcy5fZ3JhcGgudXBkYXRlTm9kZURhdGEoZWxlbWVudElkLCBkYXRhKTtcblxuICAgIC8vIFRhZyByZWZlcmVuY2UgY2hhbmdlZCBcdTIwMTQgcmUtd2lyZSBSRUFEUy9XUklURVMgZWRnZXNcbiAgICBpZiAoJ3RhZycgaW4gdXBkYXRlcyAmJiAodXBkYXRlcyBhcyBhbnkpLnRhZykge1xuICAgICAgY29uc3QgdGFnID0gKHVwZGF0ZXMgYXMgYW55KS50YWc7XG4gICAgICAvLyBSZW1vdmUgb2xkIFJFQURTL1dSSVRFUyBlZGdlc1xuICAgICAgY29uc3Qgb2xkUmVhZHMgPSB0aGlzLl9ncmFwaC5nZXRPdXRFZGdlc0J5VHlwZShlbGVtZW50SWQsICdSRUFEUycpO1xuICAgICAgY29uc3Qgb2xkV3JpdGVzID0gdGhpcy5fZ3JhcGguZ2V0T3V0RWRnZXNCeVR5cGUoZWxlbWVudElkLCAnV1JJVEVTJyk7XG4gICAgICBmb3IgKGNvbnN0IGUgb2YgWy4uLm9sZFJlYWRzLCAuLi5vbGRXcml0ZXNdKSB7XG4gICAgICAgIHRoaXMuX2dyYXBoLnJlbW92ZUVkZ2UoZS5lZGdlS2V5KTtcbiAgICAgIH1cbiAgICAgIC8vIEFkZCBuZXcgXHUyMDE0IGRpcmVjdGlvbiBkZXRlcm1pbmVkIGJ5IHVwZGF0ZWQga2luZFxuICAgICAgY29uc3QgdGFnSWQgPSB0aGlzLl9lbnN1cmVUYWcodGFnLm5hbWUsIHRhZy5kYXRhVHlwZSk7XG4gICAgICBjb25zdCBpc1dyaXRlID0gZGF0YS5lbGVtZW50S2luZC5zdGFydHNXaXRoKCdjb2lsJyk7XG4gICAgICB0aGlzLl9ncmFwaC5hZGRFZGdlKGVsZW1lbnRJZCwgdGFnSWQsIGlzV3JpdGUgPyAnV1JJVEVTJyA6ICdSRUFEUycpO1xuICAgIH1cblxuICAgIHRoaXMuX25vdGlmeSgpO1xuICB9XG5cbiAgZGVsZXRlRWxlbWVudChlbGVtZW50SWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICh0aGlzLl9ncmFwaC5oYXNOb2RlKGVsZW1lbnRJZCkpIHtcbiAgICAgIHRoaXMuX2dyYXBoLnJlbW92ZU5vZGUoZWxlbWVudElkKTtcbiAgICAgIHRoaXMuX25vdGlmeSgpO1xuICAgIH1cbiAgfVxuXG4gIHVwZGF0ZVJ1bmdDb21tZW50KHJ1bmdJZDogc3RyaW5nLCBjb21tZW50OiBzdHJpbmcpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuX2dyYXBoLmhhc05vZGUocnVuZ0lkKSkgcmV0dXJuO1xuICAgIGNvbnN0IGRhdGEgPSB0aGlzLl9ncmFwaC5nZXROb2RlRGF0YTxSdW5nTm9kZURhdGE+KHJ1bmdJZCk7XG4gICAgdGhpcy5fZ3JhcGgudXBkYXRlTm9kZURhdGEocnVuZ0lkLCB7IC4uLmRhdGEsIGNvbW1lbnQgfSk7XG4gICAgdGhpcy5fbm90aWZ5KCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgTXV0YXRpb25zOiBGQkQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgYWRkRkJETm9kZShub2RlOiBGQkROb2RlKTogdm9pZCB7XG4gICAgdGhpcy5fZ3JhcGguYWRkTm9kZShub2RlLmlkLCAnRkJEX0JMT0NLJywgJ0ZCRCcsIHtcbiAgICAgIGJsb2NrVHlwZTogbm9kZS50eXBlLFxuICAgICAgaW5zdGFuY2VOYW1lOiBub2RlLmluc3RhbmNlTmFtZSxcbiAgICAgIGxhYmVsOiBub2RlLmxhYmVsLFxuICAgICAgY29udGVudDogbm9kZS5jb250ZW50LFxuICAgICAgcG9zaXRpb246IG5vZGUucG9zaXRpb24sXG4gICAgICBzaXplOiBub2RlLnNpemUsXG4gICAgfSBzYXRpc2ZpZXMgRkJEQmxvY2tOb2RlRGF0YSk7XG5cbiAgICB0aGlzLl9ncmFwaC5hZGRFZGdlKFBPVV9JRCwgbm9kZS5pZCwgJ0NPTlRBSU5TJyk7XG5cbiAgICBmb3IgKGNvbnN0IHBpbiBvZiBub2RlLmlucHV0cykge1xuICAgICAgY29uc3QgcGluTm9kZUlkID0gYCR7bm9kZS5pZH06OiR7cGluLmlkfWA7XG4gICAgICB0aGlzLl9ncmFwaC5hZGROb2RlKHBpbk5vZGVJZCwgJ0ZCRF9QSU4nLCAnRkJEJywge1xuICAgICAgICBwaW5OYW1lOiBwaW4ubmFtZSwgZGlyZWN0aW9uOiAnaW4nLCBkYXRhVHlwZTogcGluLmRhdGFUeXBlLCBuZWdhdGVkOiBwaW4ubmVnYXRlZCxcbiAgICAgIH0gc2F0aXNmaWVzIEZCRFBpbk5vZGVEYXRhKTtcbiAgICAgIHRoaXMuX2dyYXBoLmFkZEVkZ2Uobm9kZS5pZCwgcGluTm9kZUlkLCAnSEFTX1BJTicpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBpbiBvZiBub2RlLm91dHB1dHMpIHtcbiAgICAgIGNvbnN0IHBpbk5vZGVJZCA9IGAke25vZGUuaWR9Ojoke3Bpbi5pZH1gO1xuICAgICAgdGhpcy5fZ3JhcGguYWRkTm9kZShwaW5Ob2RlSWQsICdGQkRfUElOJywgJ0ZCRCcsIHtcbiAgICAgICAgcGluTmFtZTogcGluLm5hbWUsIGRpcmVjdGlvbjogJ291dCcsIGRhdGFUeXBlOiBwaW4uZGF0YVR5cGUsIG5lZ2F0ZWQ6IHBpbi5uZWdhdGVkLFxuICAgICAgfSBzYXRpc2ZpZXMgRkJEUGluTm9kZURhdGEpO1xuICAgICAgdGhpcy5fZ3JhcGguYWRkRWRnZShub2RlLmlkLCBwaW5Ob2RlSWQsICdIQVNfUElOJyk7XG4gICAgfVxuXG4gICAgaWYgKG5vZGUudGFnKSB7XG4gICAgICBjb25zdCB0YWdJZCA9IHRoaXMuX2Vuc3VyZVRhZyhub2RlLnRhZy5uYW1lLCBub2RlLnRhZy5kYXRhVHlwZSk7XG4gICAgICBpZiAobm9kZS50eXBlID09PSAnSU5fVkFSSUFCTEUnIHx8IG5vZGUudHlwZSA9PT0gJ0lOT1VUX1ZBUklBQkxFJykge1xuICAgICAgICB0aGlzLl9ncmFwaC5hZGRFZGdlKG5vZGUuaWQsIHRhZ0lkLCAnUkVBRFMnKTtcbiAgICAgIH1cbiAgICAgIGlmIChub2RlLnR5cGUgPT09ICdPVVRfVkFSSUFCTEUnIHx8IG5vZGUudHlwZSA9PT0gJ0lOT1VUX1ZBUklBQkxFJykge1xuICAgICAgICB0aGlzLl9ncmFwaC5hZGRFZGdlKG5vZGUuaWQsIHRhZ0lkLCAnV1JJVEVTJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fbm90aWZ5KCk7XG4gIH1cblxuICB1cGRhdGVGQkROb2RlKG5vZGVJZDogc3RyaW5nLCB1cGRhdGVzOiBQYXJ0aWFsPEZCRE5vZGU+KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLl9ncmFwaC5oYXNOb2RlKG5vZGVJZCkpIHJldHVybjtcbiAgICBjb25zdCBkYXRhID0gdGhpcy5fZ3JhcGguZ2V0Tm9kZURhdGE8RkJEQmxvY2tOb2RlRGF0YT4obm9kZUlkKTtcbiAgICBpZiAodXBkYXRlcy5wb3NpdGlvbikgZGF0YS5wb3NpdGlvbiA9IHVwZGF0ZXMucG9zaXRpb247XG4gICAgaWYgKHVwZGF0ZXMuc2l6ZSkgZGF0YS5zaXplID0gdXBkYXRlcy5zaXplO1xuICAgIGlmICh1cGRhdGVzLmluc3RhbmNlTmFtZSAhPT0gdW5kZWZpbmVkKSBkYXRhLmluc3RhbmNlTmFtZSA9IHVwZGF0ZXMuaW5zdGFuY2VOYW1lO1xuICAgIGlmICh1cGRhdGVzLmxhYmVsICE9PSB1bmRlZmluZWQpIGRhdGEubGFiZWwgPSB1cGRhdGVzLmxhYmVsO1xuICAgIGlmICh1cGRhdGVzLmNvbnRlbnQgIT09IHVuZGVmaW5lZCkgZGF0YS5jb250ZW50ID0gdXBkYXRlcy5jb250ZW50O1xuICAgIHRoaXMuX2dyYXBoLnVwZGF0ZU5vZGVEYXRhKG5vZGVJZCwgZGF0YSk7XG4gICAgdGhpcy5fbm90aWZ5KCk7XG4gIH1cblxuICBkZWxldGVGQkROb2RlKG5vZGVJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLl9ncmFwaC5oYXNOb2RlKG5vZGVJZCkpIHJldHVybjtcbiAgICAvLyBSZW1vdmUgcGlucyBmaXJzdFxuICAgIGNvbnN0IHBpbkVkZ2VzID0gdGhpcy5fZ3JhcGguZ2V0T3V0RWRnZXNCeVR5cGUobm9kZUlkLCAnSEFTX1BJTicpO1xuICAgIGZvciAoY29uc3QgcGUgb2YgcGluRWRnZXMpIHtcbiAgICAgIHRoaXMuX2dyYXBoLnJlbW92ZU5vZGUocGUudGFyZ2V0KTtcbiAgICB9XG4gICAgdGhpcy5fZ3JhcGgucmVtb3ZlTm9kZShub2RlSWQpO1xuICAgIHRoaXMuX25vdGlmeSgpO1xuICB9XG5cbiAgYWRkRkJEV2lyZSh3aXJlOiBGQkRXaXJlKTogdm9pZCB7XG4gICAgY29uc3QgZnJvbVBpbklkID0gdGhpcy5fZmluZFBpbklkKHdpcmUuZnJvbS5ub2RlSWQsIHdpcmUuZnJvbS5waW4sICdvdXQnKTtcbiAgICBjb25zdCB0b1BpbklkID0gdGhpcy5fZmluZFBpbklkKHdpcmUudG8ubm9kZUlkLCB3aXJlLnRvLnBpbiwgJ2luJyk7XG5cbiAgICBpZiAoZnJvbVBpbklkICYmIHRvUGluSWQpIHtcbiAgICAgIHRoaXMuX2dyYXBoLmFkZEVkZ2UoZnJvbVBpbklkLCB0b1BpbklkLCAnV0lSRScsIHsgd2lyZUlkOiB3aXJlLmlkLCBuZWdhdGVkOiB3aXJlLm5lZ2F0ZWQgfSk7XG4gICAgfVxuICAgIHRoaXMuX25vdGlmeSgpO1xuICB9XG5cbiAgZGVsZXRlRkJEV2lyZSh3aXJlSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIC8vIEZpbmQgYW5kIHJlbW92ZSB0aGUgV0lSRSBlZGdlIHdpdGggdGhpcyB3aXJlSWRcbiAgICB0aGlzLl9ncmFwaC5ncmFwaC5mb3JFYWNoRWRnZSgoZWRnZUtleSwgYXR0cikgPT4ge1xuICAgICAgaWYgKGF0dHIudHlwZSA9PT0gJ1dJUkUnICYmIChhdHRyLmRhdGEgYXMgYW55KT8ud2lyZUlkID09PSB3aXJlSWQpIHtcbiAgICAgICAgdGhpcy5fZ3JhcGgucmVtb3ZlRWRnZShlZGdlS2V5KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLl9ub3RpZnkoKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMFx1MjUwMCBNdXRhdGlvbnM6IFNGQyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBhZGRTRkNTdGVwKHN0ZXA6IFNGQ1N0ZXApOiB2b2lkIHtcbiAgICB0aGlzLl9ncmFwaC5hZGROb2RlKHN0ZXAuaWQsICdTRkNfU1RFUCcsICdTRkMnLCB7XG4gICAgICBzdGVwTmFtZTogc3RlcC5uYW1lLFxuICAgICAgaXNJbml0aWFsOiBzdGVwLmlzSW5pdGlhbCxcbiAgICAgIHBvc2l0aW9uOiBzdGVwLnBvc2l0aW9uLFxuICAgIH0gc2F0aXNmaWVzIFNGQ1N0ZXBOb2RlRGF0YSk7XG4gICAgdGhpcy5fZ3JhcGguYWRkRWRnZShQT1VfSUQsIHN0ZXAuaWQsICdDT05UQUlOUycpO1xuXG4gICAgZm9yIChjb25zdCBhY3Rpb24gb2Ygc3RlcC5hY3Rpb25zKSB7XG4gICAgICB0aGlzLl9hZGRTRkNBY3Rpb24oc3RlcC5pZCwgYWN0aW9uKTtcbiAgICB9XG4gICAgdGhpcy5fbm90aWZ5KCk7XG4gIH1cblxuICB1cGRhdGVTRkNTdGVwKHN0ZXBJZDogc3RyaW5nLCB1cGRhdGVzOiBQYXJ0aWFsPFNGQ1N0ZXA+KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLl9ncmFwaC5oYXNOb2RlKHN0ZXBJZCkpIHJldHVybjtcbiAgICBjb25zdCBkYXRhID0gdGhpcy5fZ3JhcGguZ2V0Tm9kZURhdGE8U0ZDU3RlcE5vZGVEYXRhPihzdGVwSWQpO1xuICAgIGlmICh1cGRhdGVzLm5hbWUgIT09IHVuZGVmaW5lZCkgZGF0YS5zdGVwTmFtZSA9IHVwZGF0ZXMubmFtZTtcbiAgICBpZiAodXBkYXRlcy5pc0luaXRpYWwgIT09IHVuZGVmaW5lZCkgZGF0YS5pc0luaXRpYWwgPSB1cGRhdGVzLmlzSW5pdGlhbDtcbiAgICBpZiAodXBkYXRlcy5wb3NpdGlvbiAhPT0gdW5kZWZpbmVkKSBkYXRhLnBvc2l0aW9uID0gdXBkYXRlcy5wb3NpdGlvbjtcbiAgICB0aGlzLl9ncmFwaC51cGRhdGVOb2RlRGF0YShzdGVwSWQsIGRhdGEpO1xuICAgIHRoaXMuX25vdGlmeSgpO1xuICB9XG5cbiAgZGVsZXRlU0ZDU3RlcChzdGVwSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICghdGhpcy5fZ3JhcGguaGFzTm9kZShzdGVwSWQpKSByZXR1cm47XG4gICAgLy8gUmVtb3ZlIGFjdGlvbnNcbiAgICBjb25zdCBhY3Rpb25FZGdlcyA9IHRoaXMuX2dyYXBoLmdldE91dEVkZ2VzQnlUeXBlKHN0ZXBJZCwgJ0hBU19BQ1RJT04nKTtcbiAgICBmb3IgKGNvbnN0IGFlIG9mIGFjdGlvbkVkZ2VzKSB7XG4gICAgICB0aGlzLl9ncmFwaC5yZW1vdmVOb2RlKGFlLnRhcmdldCk7XG4gICAgfVxuICAgIHRoaXMuX2dyYXBoLnJlbW92ZU5vZGUoc3RlcElkKTtcbiAgICB0aGlzLl9ub3RpZnkoKTtcbiAgfVxuXG4gIGFkZFNGQ1RyYW5zaXRpb24odHJhbnM6IFNGQ1RyYW5zaXRpb24pOiB2b2lkIHtcbiAgICB0aGlzLl9ncmFwaC5hZGROb2RlKHRyYW5zLmlkLCAnU0ZDX1RSQU5TSVRJT04nLCAnU0ZDJywge1xuICAgICAgY29uZGl0aW9uRXhwcjogdHJhbnMuY29uZGl0aW9uLFxuICAgICAgcG9zaXRpb246IHRyYW5zLnBvc2l0aW9uLFxuICAgICAgcHJpb3JpdHk6IHRyYW5zLnByaW9yaXR5LFxuICAgIH0gc2F0aXNmaWVzIFNGQ1RyYW5zaXRpb25Ob2RlRGF0YSk7XG4gICAgdGhpcy5fZ3JhcGguYWRkRWRnZShQT1VfSUQsIHRyYW5zLmlkLCAnQ09OVEFJTlMnKTtcblxuICAgIC8vIFBhcnNlIGNvbmRpdGlvbiByZWZzXG4gICAgY29uc3QgcmVmcyA9IHBhcnNlQ29uZGl0aW9uVGFnUmVmcyh0cmFucy5jb25kaXRpb24pO1xuICAgIGZvciAoY29uc3QgcmVmIG9mIHJlZnMpIHtcbiAgICAgIGNvbnN0IHRhZ0lkID0gdGhpcy5fZW5zdXJlVGFnKHJlZiwgJ0JPT0wnKTtcbiAgICAgIHRoaXMuX2dyYXBoLmFkZEVkZ2UodHJhbnMuaWQsIHRhZ0lkLCAnUkVBRFMnKTtcbiAgICB9XG4gICAgdGhpcy5fbm90aWZ5KCk7XG4gIH1cblxuICB1cGRhdGVTRkNUcmFuc2l0aW9uKHRyYW5zSWQ6IHN0cmluZywgdXBkYXRlczogUGFydGlhbDxTRkNUcmFuc2l0aW9uPik6IHZvaWQge1xuICAgIGlmICghdGhpcy5fZ3JhcGguaGFzTm9kZSh0cmFuc0lkKSkgcmV0dXJuO1xuICAgIGNvbnN0IGRhdGEgPSB0aGlzLl9ncmFwaC5nZXROb2RlRGF0YTxTRkNUcmFuc2l0aW9uTm9kZURhdGE+KHRyYW5zSWQpO1xuICAgIGlmICh1cGRhdGVzLmNvbmRpdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBSZW1vdmUgb2xkIFJFQURTIGVkZ2VzIGZyb20gdGhpcyB0cmFuc2l0aW9uXG4gICAgICBjb25zdCBvbGRSZWFkcyA9IHRoaXMuX2dyYXBoLmdldE91dEVkZ2VzQnlUeXBlKHRyYW5zSWQsICdSRUFEUycpO1xuICAgICAgZm9yIChjb25zdCBlIG9mIG9sZFJlYWRzKSB0aGlzLl9ncmFwaC5yZW1vdmVFZGdlKGUuZWRnZUtleSk7XG5cbiAgICAgIGRhdGEuY29uZGl0aW9uRXhwciA9IHVwZGF0ZXMuY29uZGl0aW9uO1xuICAgICAgLy8gQWRkIG5ldyBSRUFEUyBlZGdlc1xuICAgICAgY29uc3QgcmVmcyA9IHBhcnNlQ29uZGl0aW9uVGFnUmVmcyh1cGRhdGVzLmNvbmRpdGlvbik7XG4gICAgICBmb3IgKGNvbnN0IHJlZiBvZiByZWZzKSB7XG4gICAgICAgIGNvbnN0IHRhZ0lkID0gdGhpcy5fZW5zdXJlVGFnKHJlZiwgJ0JPT0wnKTtcbiAgICAgICAgdGhpcy5fZ3JhcGguYWRkRWRnZSh0cmFuc0lkLCB0YWdJZCwgJ1JFQURTJyk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh1cGRhdGVzLnBvc2l0aW9uICE9PSB1bmRlZmluZWQpIGRhdGEucG9zaXRpb24gPSB1cGRhdGVzLnBvc2l0aW9uO1xuICAgIGlmICh1cGRhdGVzLnByaW9yaXR5ICE9PSB1bmRlZmluZWQpIGRhdGEucHJpb3JpdHkgPSB1cGRhdGVzLnByaW9yaXR5O1xuICAgIHRoaXMuX2dyYXBoLnVwZGF0ZU5vZGVEYXRhKHRyYW5zSWQsIGRhdGEpO1xuICAgIHRoaXMuX25vdGlmeSgpO1xuICB9XG5cbiAgZGVsZXRlU0ZDVHJhbnNpdGlvbih0cmFuc0lkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5fZ3JhcGguaGFzTm9kZSh0cmFuc0lkKSkge1xuICAgICAgdGhpcy5fZ3JhcGgucmVtb3ZlTm9kZSh0cmFuc0lkKTtcbiAgICAgIHRoaXMuX25vdGlmeSgpO1xuICAgIH1cbiAgfVxuXG4gIGFkZFNGQ0xpbmsobGluazogU0ZDTGluayk6IHZvaWQge1xuICAgIGlmICh0aGlzLl9ncmFwaC5oYXNOb2RlKGxpbmsuZnJvbSkgJiYgdGhpcy5fZ3JhcGguaGFzTm9kZShsaW5rLnRvKSkge1xuICAgICAgdGhpcy5fZ3JhcGguYWRkRWRnZShsaW5rLmZyb20sIGxpbmsudG8sICdTRkNfRkxPVycsIHsgbGlua0lkOiBsaW5rLmlkLCBsaW5rVHlwZTogbGluay50eXBlIH0pO1xuICAgICAgdGhpcy5fbm90aWZ5KCk7XG4gICAgfVxuICB9XG5cbiAgZGVsZXRlU0ZDTGluayhsaW5rSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuX2dyYXBoLmdyYXBoLmZvckVhY2hFZGdlKChlZGdlS2V5LCBhdHRyKSA9PiB7XG4gICAgICBpZiAoYXR0ci50eXBlID09PSAnU0ZDX0ZMT1cnICYmIChhdHRyLmRhdGEgYXMgYW55KT8ubGlua0lkID09PSBsaW5rSWQpIHtcbiAgICAgICAgdGhpcy5fZ3JhcGgucmVtb3ZlRWRnZShlZGdlS2V5KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLl9ub3RpZnkoKTtcbiAgfVxuXG4gIGFkZFNGQ0JyYW5jaChicmFuY2g6IFNGQ0JyYW5jaCk6IHZvaWQge1xuICAgIC8vIFNGQyBicmFuY2hlcyBhcmUgc3RydWN0dXJhbCBtZXRhZGF0YSBcdTIwMTQgc3RvcmUgYXMgQ09OVEFJTlMgZWRnZXMgb24gdGhlIFBPVS5cbiAgICAvLyBUaGUgYnJhbmNoIElEIGlzIHN0b3JlZCBvbiBlYWNoIHN0ZXAgbm9kZSdzIGJyYW5jaElkIGZpZWxkIChub3QgYSBzZXBhcmF0ZSBub2RlKS5cbiAgICAvLyBCcmFuY2hlcyBhcmUgcmVjb25zdHJ1Y3RlZCBmcm9tIFNGQ19GTE9XIHRvcG9sb2d5IGR1cmluZyBwcm9qZWN0aW9uLlxuICAgIC8vIEhlcmUgd2UganVzdCBlbnN1cmUgdGhlIGJyYW5jaCBzdGVwcyBhcmUgY29ycmVjdGx5IGFzc29jaWF0ZWQuXG4gICAgdGhpcy5fbm90aWZ5KCk7XG4gIH1cblxuICBkZWxldGVTRkNCcmFuY2goX2JyYW5jaElkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAvLyBCcmFuY2ggcmVtb3ZhbDogYWxsIFNGQ19GTE9XIGVkZ2VzIGxpbmtpbmcgdGhyb3VnaCB0aGlzIGJyYW5jaCdzIHN0ZXBzXG4gICAgLy8gYXJlIGFscmVhZHkgaGFuZGxlZCBieSBkZWxldGVTRkNMaW5rL2RlbGV0ZVNGQ1N0ZXAuXG4gICAgdGhpcy5fbm90aWZ5KCk7XG4gIH1cblxuICBhZGRTRkNKdW1wKGp1bXA6IHsgaWQ6IHN0cmluZzsgdGFyZ2V0U3RlcE5hbWU6IHN0cmluZzsgcG9zaXRpb24/OiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0gfSk6IHZvaWQge1xuICAgIGlmICh0aGlzLl9ncmFwaC5oYXNOb2RlKGp1bXAuaWQpKSByZXR1cm47XG4gICAgdGhpcy5fZ3JhcGguYWRkTm9kZShqdW1wLmlkLCAnU0ZDX0pVTVAnLCAnU0ZDJywge1xuICAgICAgdGFyZ2V0U3RlcE5hbWU6IGp1bXAudGFyZ2V0U3RlcE5hbWUsXG4gICAgfSk7XG4gICAgdGhpcy5fZ3JhcGguYWRkRWRnZShQT1VfSUQsIGp1bXAuaWQsICdDT05UQUlOUycpO1xuICAgIHRoaXMuX25vdGlmeSgpO1xuICB9XG5cbiAgZGVsZXRlU0ZDSnVtcChqdW1wSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICh0aGlzLl9ncmFwaC5oYXNOb2RlKGp1bXBJZCkpIHtcbiAgICAgIHRoaXMuX2dyYXBoLnJlbW92ZU5vZGUoanVtcElkKTtcbiAgICAgIHRoaXMuX25vdGlmeSgpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMFx1MjUwMCBNdXRhdGlvbnM6IFRhZ3MgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgcmVuYW1lVGFnKG9sZE5hbWU6IHN0cmluZywgbmV3TmFtZTogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgdGFnSWQgPSB0aGlzLl9ncmFwaC5maW5kVGFnQnlOYW1lKG9sZE5hbWUpO1xuICAgIGlmICghdGFnSWQpIHJldHVybjtcbiAgICBjb25zdCBkYXRhID0gdGhpcy5fZ3JhcGguZ2V0Tm9kZURhdGE8VGFnTm9kZURhdGE+KHRhZ0lkKTtcbiAgICBkYXRhLm5hbWUgPSBuZXdOYW1lO1xuICAgIHRoaXMuX2dyYXBoLnVwZGF0ZU5vZGVEYXRhKHRhZ0lkLCBkYXRhKTtcblxuICAgIC8vIFByb3BhZ2F0ZSByZW5hbWUgaW50byBTRkMgdHJhbnNpdGlvbiBjb25kaXRpb24gZXhwcmVzc2lvbnNcbiAgICAvLyAodGhlc2UgZW1iZWQgdGFnIG5hbWVzIGFzIHBsYWluIGlkZW50aWZpZXJzIGluIHRoZSBjb25kaXRpb25FeHByIHN0cmluZylcbiAgICBmb3IgKGNvbnN0IHRyYW5zSWQgb2YgdGhpcy5fZ3JhcGguZ2V0Tm9kZXNCeVR5cGUoJ1NGQ19UUkFOU0lUSU9OJykpIHtcbiAgICAgIGNvbnN0IHRyYW5zRGF0YSA9IHRoaXMuX2dyYXBoLmdldE5vZGVEYXRhPGltcG9ydCgnLi9zY2hlbWEuanMnKS5TRkNUcmFuc2l0aW9uTm9kZURhdGE+KHRyYW5zSWQpO1xuICAgICAgaWYgKCF0cmFuc0RhdGEuY29uZGl0aW9uRXhwcikgY29udGludWU7XG4gICAgICAvLyBSZXBsYWNlIHdob2xlLXdvcmQgb2NjdXJyZW5jZXMgb2Ygb2xkTmFtZSB3aXRoIG5ld05hbWVcbiAgICAgIGNvbnN0IHVwZGF0ZWQgPSB0cmFuc0RhdGEuY29uZGl0aW9uRXhwci5yZXBsYWNlKFxuICAgICAgICBuZXcgUmVnRXhwKGBcXFxcYiR7b2xkTmFtZS5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgJ1xcXFwkJicpfVxcXFxiYCwgJ2cnKSxcbiAgICAgICAgbmV3TmFtZSxcbiAgICAgICk7XG4gICAgICBpZiAodXBkYXRlZCAhPT0gdHJhbnNEYXRhLmNvbmRpdGlvbkV4cHIpIHtcbiAgICAgICAgdGhpcy5fZ3JhcGgudXBkYXRlTm9kZURhdGEodHJhbnNJZCwgeyAuLi50cmFuc0RhdGEsIGNvbmRpdGlvbkV4cHI6IHVwZGF0ZWQgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fbm90aWZ5KCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgVW5kby9SZWRvIHN1cHBvcnQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgc25hcHNob3QoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5fZ3JhcGguc25hcHNob3QoKTtcbiAgfVxuXG4gIHJlc3RvcmVGcm9tU25hcHNob3QoanNvbjogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5fZ3JhcGgucmVzdG9yZUZyb21TbmFwc2hvdChqc29uKTtcbiAgICB0aGlzLl9ub3RpZnkoKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMFx1MjUwMCBQcml2YXRlIGhlbHBlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgcHJpdmF0ZSBfZW5zdXJlVGFnKG5hbWU6IHN0cmluZywgZGF0YVR5cGU6IElFQ0RhdGFUeXBlKTogc3RyaW5nIHtcbiAgICBjb25zdCB0YWdJZCA9IGB0YWctJHtuYW1lfWA7XG4gICAgaWYgKCF0aGlzLl9ncmFwaC5oYXNOb2RlKHRhZ0lkKSkge1xuICAgICAgdGhpcy5fZ3JhcGguYWRkTm9kZSh0YWdJZCwgJ1RBRycsICdzaGFyZWQnLCB7XG4gICAgICAgIG5hbWUsIGRhdGFUeXBlLCBzY29wZTogJ2dsb2JhbCcsXG4gICAgICB9IHNhdGlzZmllcyBUYWdOb2RlRGF0YSk7XG4gICAgfVxuICAgIHJldHVybiB0YWdJZDtcbiAgfVxuXG4gIHByaXZhdGUgX2ZpbmRMYXN0SW5DaGFpbihydW5nSWRzOiBzdHJpbmdbXSk6IHN0cmluZyB8IG51bGwge1xuICAgIGNvbnN0IGhhc091dGdvaW5nID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgZm9yIChjb25zdCBpZCBvZiBydW5nSWRzKSB7XG4gICAgICBjb25zdCBvdXQgPSB0aGlzLl9ncmFwaC5nZXRPdXRFZGdlc0J5VHlwZShpZCwgJ1JVTkdfT1JERVInKTtcbiAgICAgIGlmIChvdXQubGVuZ3RoID4gMCkgaGFzT3V0Z29pbmcuYWRkKGlkKTtcbiAgICB9XG4gICAgcmV0dXJuIHJ1bmdJZHMuZmluZChpZCA9PiAhaGFzT3V0Z29pbmcuaGFzKGlkKSkgPz8gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX3JlbnVtYmVyUnVuZ3MoKTogdm9pZCB7XG4gICAgY29uc3QgcnVuZ0lkcyA9IHRoaXMuX2dyYXBoLmdldE5vZGVzQnlUeXBlKCdSVU5HJyk7XG4gICAgLy8gRm9sbG93IFJVTkdfT1JERVIgY2hhaW5cbiAgICBjb25zdCBvcmRlcmVkID0gdGhpcy5fb3JkZXJSdW5ncyhydW5nSWRzKTtcbiAgICBvcmRlcmVkLmZvckVhY2goKGlkLCBpKSA9PiB7XG4gICAgICBjb25zdCBkYXRhID0gdGhpcy5fZ3JhcGguZ2V0Tm9kZURhdGE8UnVuZ05vZGVEYXRhPihpZCk7XG4gICAgICBkYXRhLnJ1bmdOdW1iZXIgPSBpICsgMTtcbiAgICAgIHRoaXMuX2dyYXBoLnVwZGF0ZU5vZGVEYXRhKGlkLCBkYXRhKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX29yZGVyUnVuZ3MocnVuZ0lkczogc3RyaW5nW10pOiBzdHJpbmdbXSB7XG4gICAgaWYgKHJ1bmdJZHMubGVuZ3RoIDw9IDEpIHJldHVybiBydW5nSWRzO1xuICAgIGNvbnN0IG5leHRNYXAgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIGNvbnN0IGhhc0luY29taW5nID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgZm9yIChjb25zdCBpZCBvZiBydW5nSWRzKSB7XG4gICAgICBjb25zdCBvdXRFZGdlcyA9IHRoaXMuX2dyYXBoLmdldE91dEVkZ2VzQnlUeXBlKGlkLCAnUlVOR19PUkRFUicpO1xuICAgICAgaWYgKG91dEVkZ2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgbmV4dE1hcC5zZXQoaWQsIG91dEVkZ2VzWzBdLnRhcmdldCk7XG4gICAgICAgIGhhc0luY29taW5nLmFkZChvdXRFZGdlc1swXS50YXJnZXQpO1xuICAgICAgfVxuICAgIH1cbiAgICBsZXQgc3RhcnQgPSBydW5nSWRzLmZpbmQoaWQgPT4gIWhhc0luY29taW5nLmhhcyhpZCkpO1xuICAgIGlmICghc3RhcnQpIHN0YXJ0ID0gcnVuZ0lkc1swXTtcbiAgICBjb25zdCBvcmRlcmVkOiBzdHJpbmdbXSA9IFtdO1xuICAgIGxldCBjdXJyZW50OiBzdHJpbmcgfCB1bmRlZmluZWQgPSBzdGFydDtcbiAgICBjb25zdCB2aXNpdGVkID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgd2hpbGUgKGN1cnJlbnQgJiYgIXZpc2l0ZWQuaGFzKGN1cnJlbnQpKSB7XG4gICAgICB2aXNpdGVkLmFkZChjdXJyZW50KTtcbiAgICAgIG9yZGVyZWQucHVzaChjdXJyZW50KTtcbiAgICAgIGN1cnJlbnQgPSBuZXh0TWFwLmdldChjdXJyZW50KTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBpZCBvZiBydW5nSWRzKSB7XG4gICAgICBpZiAoIXZpc2l0ZWQuaGFzKGlkKSkgb3JkZXJlZC5wdXNoKGlkKTtcbiAgICB9XG4gICAgcmV0dXJuIG9yZGVyZWQ7XG4gIH1cblxuICBwcml2YXRlIF9maW5kUGluSWQoYmxvY2tJZDogc3RyaW5nLCBwaW5OYW1lOiBzdHJpbmcsIGRpcmVjdGlvbjogJ2luJyB8ICdvdXQnKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgcGluRWRnZXMgPSB0aGlzLl9ncmFwaC5nZXRPdXRFZGdlc0J5VHlwZShibG9ja0lkLCAnSEFTX1BJTicpO1xuICAgIGZvciAoY29uc3QgcGUgb2YgcGluRWRnZXMpIHtcbiAgICAgIGNvbnN0IHBkID0gdGhpcy5fZ3JhcGguZ2V0Tm9kZURhdGE8RkJEUGluTm9kZURhdGE+KHBlLnRhcmdldCk7XG4gICAgICBpZiAocGQucGluTmFtZSA9PT0gcGluTmFtZSAmJiBwZC5kaXJlY3Rpb24gPT09IGRpcmVjdGlvbikgcmV0dXJuIHBlLnRhcmdldDtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIF9hZGRMREVsZW1lbnRGcm9tRmxhdChydW5nSWQ6IHN0cmluZywgZWw6IExhZGRlckVsZW1lbnQsIGJyYW5jaElkPzogc3RyaW5nKTogdm9pZCB7XG4gICAgbGV0IGtpbmQ6IExERWxlbWVudEtpbmQ7XG4gICAgaWYgKGVsLmtpbmQgPT09ICdjb250YWN0Jykge1xuICAgICAgY29uc3QgbWFwOiBSZWNvcmQ8c3RyaW5nLCBMREVsZW1lbnRLaW5kPiA9IHtcbiAgICAgICAgJ05PJzogJ2NvbnRhY3Rfbm8nLCAnTkMnOiAnY29udGFjdF9uYycsICdQX0NPTlRBQ1QnOiAnY29udGFjdF9wJywgJ05fQ09OVEFDVCc6ICdjb250YWN0X24nXG4gICAgICB9O1xuICAgICAga2luZCA9IG1hcFtlbC50eXBlXSA/PyAnY29udGFjdF9ubyc7XG4gICAgfSBlbHNlIGlmIChlbC5raW5kID09PSAnY29pbCcpIHtcbiAgICAgIGNvbnN0IG1hcDogUmVjb3JkPHN0cmluZywgTERFbGVtZW50S2luZD4gPSB7XG4gICAgICAgICdub3JtYWwnOiAnY29pbCcsICduZWdhdGVkJzogJ2NvaWxfbmVnYXRlZCcsICdzZXQnOiAnY29pbF9zZXQnLFxuICAgICAgICAncmVzZXQnOiAnY29pbF9yZXNldCcsICdsYXRjaCc6ICdjb2lsX2xhdGNoJywgJ3VubGF0Y2gnOiAnY29pbF91bmxhdGNoJ1xuICAgICAgfTtcbiAgICAgIGtpbmQgPSBtYXBbZWwudHlwZV0gPz8gJ2NvaWwnO1xuICAgIH0gZWxzZSB7XG4gICAgICBraW5kID0gJ2ZiX2NhbGwnO1xuICAgIH1cblxuICAgIHRoaXMuX2dyYXBoLmFkZE5vZGUoZWwuaWQsICdMRF9FTEVNRU5UJywgJ0xEJywge1xuICAgICAgZWxlbWVudEtpbmQ6IGtpbmQsIHBvc2l0aW9uOiBlbC5wb3NpdGlvbiwgYnJhbmNoSWQsXG4gICAgICAuLi4oZWwua2luZCA9PT0gJ2Jsb2NrJyA/IHsgZmJUeXBlOiBlbC5mYlR5cGUsIGluc3RhbmNlTmFtZTogZWwuaW5zdGFuY2VOYW1lIH0gOiB7fSksXG4gICAgfSBzYXRpc2ZpZXMgTERFbGVtZW50Tm9kZURhdGEpO1xuXG4gICAgdGhpcy5fZ3JhcGguYWRkRWRnZShydW5nSWQsIGVsLmlkLCAnQ09OVEFJTlMnKTtcblxuICAgIGlmIChlbC5raW5kID09PSAnY29udGFjdCcpIHtcbiAgICAgIGNvbnN0IHRhZ0lkID0gdGhpcy5fZW5zdXJlVGFnKGVsLnRhZy5uYW1lLCBlbC50YWcuZGF0YVR5cGUpO1xuICAgICAgdGhpcy5fZ3JhcGguYWRkRWRnZShlbC5pZCwgdGFnSWQsICdSRUFEUycpO1xuICAgIH0gZWxzZSBpZiAoZWwua2luZCA9PT0gJ2NvaWwnKSB7XG4gICAgICBjb25zdCB0YWdJZCA9IHRoaXMuX2Vuc3VyZVRhZyhlbC50YWcubmFtZSwgZWwudGFnLmRhdGFUeXBlKTtcbiAgICAgIHRoaXMuX2dyYXBoLmFkZEVkZ2UoZWwuaWQsIHRhZ0lkLCAnV1JJVEVTJyk7XG4gICAgfSBlbHNlIGlmIChlbC5raW5kID09PSAnYmxvY2snKSB7XG4gICAgICBmb3IgKGNvbnN0IFtwaW5OYW1lLCB0YWdSZWZdIG9mIE9iamVjdC5lbnRyaWVzKGVsLnBpbnMpKSB7XG4gICAgICAgIGlmICghdGFnUmVmLm5hbWUpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCB0YWdJZCA9IHRoaXMuX2Vuc3VyZVRhZyh0YWdSZWYubmFtZSwgdGFnUmVmLmRhdGFUeXBlKTtcbiAgICAgICAgdGhpcy5fZ3JhcGguYWRkRWRnZShlbC5pZCwgdGFnSWQsXG4gICAgICAgICAgaXNGQk91dHB1dFBpbihlbC5mYlR5cGUsIHBpbk5hbWUpID8gJ1dSSVRFUycgOiAnUkVBRFMnLFxuICAgICAgICAgIHsgcGluTmFtZSB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9hZGRTRkNBY3Rpb24oc3RlcElkOiBzdHJpbmcsIGFjdGlvbjogeyBpZDogc3RyaW5nOyBxdWFsaWZpZXI6IGFueTsgdGFnOiB7IG5hbWU6IHN0cmluZzsgZGF0YVR5cGU6IElFQ0RhdGFUeXBlIH07IGR1cmF0aW9uPzogc3RyaW5nIH0pOiB2b2lkIHtcbiAgICB0aGlzLl9ncmFwaC5hZGROb2RlKGFjdGlvbi5pZCwgJ1NGQ19BQ1RJT04nLCAnU0ZDJywge1xuICAgICAgYWN0aW9uTmFtZTogYWN0aW9uLnRhZy5uYW1lLFxuICAgICAgcXVhbGlmaWVyOiBhY3Rpb24ucXVhbGlmaWVyLFxuICAgICAgZHVyYXRpb246IGFjdGlvbi5kdXJhdGlvbixcbiAgICB9IHNhdGlzZmllcyBTRkNBY3Rpb25Ob2RlRGF0YSk7XG4gICAgdGhpcy5fZ3JhcGguYWRkRWRnZShzdGVwSWQsIGFjdGlvbi5pZCwgJ0hBU19BQ1RJT04nKTtcbiAgICBjb25zdCB0YWdJZCA9IHRoaXMuX2Vuc3VyZVRhZyhhY3Rpb24udGFnLm5hbWUsIGFjdGlvbi50YWcuZGF0YVR5cGUpO1xuICAgIHRoaXMuX2dyYXBoLmFkZEVkZ2UoYWN0aW9uLmlkLCB0YWdJZCwgJ1dSSVRFUycpO1xuICB9XG59XG5cbi8vIFNpbmdsZXRvblxuZXhwb3J0IGNvbnN0IGNsbVN0b3JlID0gbmV3IENMTVN0b3JlKCk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFTQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLG1CQUFtQixRQUFRLHVCQUF1QixxQkFBcUI7QUFDaEYsU0FBUyxzQkFBc0IsbUJBQW1CLG1CQUFtQiwwQkFBMEI7QUFtQy9GLE1BQU0sU0FBUztBQUFBLEVBS2IsY0FBYztBQUhkLFNBQVEsYUFBYSxvQkFBSSxJQUFjO0FBQ3ZDLFNBQVEsZUFBZTtBQUdyQixTQUFLLFNBQVMsSUFBSSxTQUFTO0FBQUEsRUFDN0I7QUFBQSxFQUVBLElBQUksUUFBa0I7QUFDcEIsV0FBTyxLQUFLO0FBQUEsRUFDZDtBQUFBLEVBRUEsSUFBSSxjQUF1QjtBQUN6QixXQUFPLEtBQUs7QUFBQSxFQUNkO0FBQUE7QUFBQTtBQUFB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
