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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjL3BsYy1lZGl0b3ItdHN4L2NsbS9jbG1TdG9yZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLypcbiAqIENMTSBTdG9yZSBcdTIwMTQgUmVhY3RpdmUgbGF5ZXIgb3ZlciB0aGUgQ0xNIGdyYXBoLlxuICogSG9sZHMgdGhlIHNpbmdsZSBncmFwaCBpbnN0YW5jZSwgZXhwb3NlcyBtdXRhdGlvbiBtZXRob2RzIHRoYXQgdXBkYXRlIHRoZSBncmFwaFxuICogYW5kIGZpcmUgbm90aWZpY2F0aW9ucyBzbyBSZWFjdCByZS1yZW5kZXJzLlxuICpcbiAqIENhbnZhc2VzIGNvbnN1bWUgZGF0YSB2aWEgcHJvamVjdGlvbiBob29rcyAodXNlQ0xNTGFkZGVyLCB1c2VDTE1GQkQsIHVzZUNMTVNGQylcbiAqIHdoaWNoIGludGVybmFsbHkgY2FsbCB0aGUgcHJvamVjdGlvbiBmdW5jdGlvbnMgYW5kIG1lbW9pemUgcmVzdWx0cy5cbiAqL1xuXG5pbXBvcnQgeyBDTE1HcmFwaCB9IGZyb20gJy4vZ3JhcGguanMnO1xuaW1wb3J0IHsgYnVpbGRDTE1Gcm9tU3RvcmUsIFBPVV9JRCwgcGFyc2VDb25kaXRpb25UYWdSZWZzLCBpc0ZCT3V0cHV0UGluIH0gZnJvbSAnLi9idWlsZGVyLmpzJztcbmltcG9ydCB7IHByb2plY3RMYWRkZXJQcm9ncmFtLCBwcm9qZWN0RkJEUHJvZ3JhbSwgcHJvamVjdFNGQ1Byb2dyYW0sIHByb2plY3RUYWdEYXRhYmFzZSB9IGZyb20gJy4vcHJvamVjdGlvbnMuanMnO1xuaW1wb3J0IHR5cGUge1xuICBMREVsZW1lbnRLaW5kLFxuICBUYWdOb2RlRGF0YSxcbiAgUnVuZ05vZGVEYXRhLFxuICBMREVsZW1lbnROb2RlRGF0YSxcbiAgRkJEQmxvY2tOb2RlRGF0YSxcbiAgRkJEUGluTm9kZURhdGEsXG4gIFNGQ1N0ZXBOb2RlRGF0YSxcbiAgU0ZDVHJhbnNpdGlvbk5vZGVEYXRhLFxuICBTRkNBY3Rpb25Ob2RlRGF0YSxcbiAgQWN0aW9uUXVhbGlmaWVyLFxuICBDTE1FZGdlVHlwZSxcbn0gZnJvbSAnLi9zY2hlbWEuanMnO1xuaW1wb3J0IHR5cGUge1xuICBMYWRkZXJQcm9ncmFtLFxuICBGQkRQcm9ncmFtLFxuICBTRkNQcm9ncmFtLFxuICBUYWdFbnRyeSxcbiAgTGFkZGVyRWxlbWVudCxcbiAgRkJETm9kZSxcbiAgRkJEV2lyZSxcbiAgU0ZDU3RlcCxcbiAgU0ZDVHJhbnNpdGlvbixcbiAgU0ZDTGluayxcbiAgU0ZDQnJhbmNoLFxuICBSdW5nLFxuICBDb250YWN0VHlwZSxcbiAgQ29pbFR5cGUsXG4gIElFQ0RhdGFUeXBlLFxuICBFZGl0b3JMYW5ndWFnZSxcbn0gZnJvbSAnLi4vbG9naWNTdG9yZS5qcyc7XG5cbnR5cGUgTGlzdGVuZXIgPSAoKSA9PiB2b2lkO1xuXG5jbGFzcyBDTE1TdG9yZSB7XG4gIHByaXZhdGUgX2dyYXBoOiBDTE1HcmFwaDtcbiAgcHJpdmF0ZSBfbGlzdGVuZXJzID0gbmV3IFNldDxMaXN0ZW5lcj4oKTtcbiAgcHJpdmF0ZSBfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLl9ncmFwaCA9IG5ldyBDTE1HcmFwaCgpO1xuICB9XG5cbiAgZ2V0IGdyYXBoKCk6IENMTUdyYXBoIHtcbiAgICByZXR1cm4gdGhpcy5fZ3JhcGg7XG4gIH1cblxuICBnZXQgaW5pdGlhbGl6ZWQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuX2luaXRpYWxpemVkO1xuICB9XG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUgQ0xNIGZyb20gZXhpc3RpbmcgZmxhdCBzdG9yZSBzdGF0ZS5cbiAgICogQ2FsbGVkIG9uY2UgYXQgYXBwIHN0YXJ0dXAgYWZ0ZXIgbG9naWNTdG9yZSBoYXMgaXRzIGluaXRpYWwgZGF0YS5cbiAgICovXG4gIGluaXRpYWxpemUoXG4gICAgbGFkZGVyUHJvZ3JhbTogTGFkZGVyUHJvZ3JhbSxcbiAgICBmYmRQcm9ncmFtOiBGQkRQcm9ncmFtLFxuICAgIHNmY1Byb2dyYW06IFNGQ1Byb2dyYW0sXG4gICAgdGFnRGF0YWJhc2U6IFRhZ0VudHJ5W10sXG4gICk6IHZvaWQge1xuICAgIHRoaXMuX2dyYXBoID0gYnVpbGRDTE1Gcm9tU3RvcmUobGFkZGVyUHJvZ3JhbSwgZmJkUHJvZ3JhbSwgc2ZjUHJvZ3JhbSwgdGFnRGF0YWJhc2UpO1xuICAgIHRoaXMuX2luaXRpYWxpemVkID0gdHJ1ZTtcbiAgICB0aGlzLl9ub3RpZnkoKTtcbiAgICBjb25zb2xlLmxvZyhgW0NMTV0gSW5pdGlhbGl6ZWQ6ICR7dGhpcy5fZ3JhcGgubm9kZUNvdW50fSBub2RlcywgJHt0aGlzLl9ncmFwaC5lZGdlQ291bnR9IGVkZ2VzYCk7XG4gIH1cblxuICBzdWJzY3JpYmUobGlzdGVuZXI6IExpc3RlbmVyKTogKCkgPT4gdm9pZCB7XG4gICAgdGhpcy5fbGlzdGVuZXJzLmFkZChsaXN0ZW5lcik7XG4gICAgcmV0dXJuICgpID0+IHRoaXMuX2xpc3RlbmVycy5kZWxldGUobGlzdGVuZXIpO1xuICB9XG5cbiAgcHJpdmF0ZSBfbm90aWZ5KCk6IHZvaWQge1xuICAgIHRoaXMuX2xpc3RlbmVycy5mb3JFYWNoKGwgPT4gbCgpKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMFx1MjUwMCBQcm9qZWN0aW9ucyAocHJvZHVjZSBmbGF0IGRhdGEgZm9yIGNhbnZhc2VzKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBnZXRMYWRkZXJQcm9ncmFtKCk6IExhZGRlclByb2dyYW0ge1xuICAgIHJldHVybiBwcm9qZWN0TGFkZGVyUHJvZ3JhbSh0aGlzLl9ncmFwaCk7XG4gIH1cblxuICBnZXRGQkRQcm9ncmFtKCk6IEZCRFByb2dyYW0ge1xuICAgIHJldHVybiBwcm9qZWN0RkJEUHJvZ3JhbSh0aGlzLl9ncmFwaCk7XG4gIH1cblxuICBnZXRTRkNQcm9ncmFtKCk6IFNGQ1Byb2dyYW0ge1xuICAgIHJldHVybiBwcm9qZWN0U0ZDUHJvZ3JhbSh0aGlzLl9ncmFwaCk7XG4gIH1cblxuICBnZXRUYWdEYXRhYmFzZSgpOiBUYWdFbnRyeVtdIHtcbiAgICByZXR1cm4gcHJvamVjdFRhZ0RhdGFiYXNlKHRoaXMuX2dyYXBoKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMFx1MjUwMCBDcm9zcy1SZWZlcmVuY2UgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgZ2V0Q3Jvc3NSZWZlcmVuY2VzKHRhZ05hbWU6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLl9ncmFwaC5nZXRDcm9zc1JlZmVyZW5jZXModGFnTmFtZSk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgTXV0YXRpb25zOiBMYWRkZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgYWRkUnVuZyhhZnRlclJ1bmdJZD86IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgaWQgPSBgcnVuZy0ke0RhdGUubm93KCl9LSR7TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMiwgNyl9YDtcbiAgICBjb25zdCBleGlzdGluZ1J1bmdzID0gdGhpcy5fZ3JhcGguZ2V0Tm9kZXNCeVR5cGUoJ1JVTkcnKTtcbiAgICBjb25zdCBydW5nTnVtYmVyID0gZXhpc3RpbmdSdW5ncy5sZW5ndGggKyAxO1xuXG4gICAgdGhpcy5fZ3JhcGguYWRkTm9kZShpZCwgJ1JVTkcnLCAnTEQnLCB7XG4gICAgICBydW5nTnVtYmVyLFxuICAgICAgY29tbWVudDogJycsXG4gICAgfSBzYXRpc2ZpZXMgUnVuZ05vZGVEYXRhKTtcblxuICAgIHRoaXMuX2dyYXBoLmFkZEVkZ2UoUE9VX0lELCBpZCwgJ0NPTlRBSU5TJyk7XG5cbiAgICAvLyBJbnNlcnQgaW50byBSVU5HX09SREVSIGNoYWluXG4gICAgaWYgKGFmdGVyUnVuZ0lkICYmIHRoaXMuX2dyYXBoLmhhc05vZGUoYWZ0ZXJSdW5nSWQpKSB7XG4gICAgICAvLyBGaW5kIHdoYXQgY3VycmVudGx5IGZvbGxvd3MgYWZ0ZXJSdW5nSWRcbiAgICAgIGNvbnN0IG5leHRFZGdlcyA9IHRoaXMuX2dyYXBoLmdldE91dEVkZ2VzQnlUeXBlKGFmdGVyUnVuZ0lkLCAnUlVOR19PUkRFUicpO1xuICAgICAgaWYgKG5leHRFZGdlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIC8vIFJlbW92ZSBvbGQgZWRnZSwgaW5zZXJ0IG5ldyBub2RlIGluIGNoYWluXG4gICAgICAgIHRoaXMuX2dyYXBoLnJlbW92ZUVkZ2UobmV4dEVkZ2VzWzBdLmVkZ2VLZXkpO1xuICAgICAgICB0aGlzLl9ncmFwaC5hZGRFZGdlKGlkLCBuZXh0RWRnZXNbMF0udGFyZ2V0LCAnUlVOR19PUkRFUicpO1xuICAgICAgfVxuICAgICAgdGhpcy5fZ3JhcGguYWRkRWRnZShhZnRlclJ1bmdJZCwgaWQsICdSVU5HX09SREVSJyk7XG4gICAgfSBlbHNlIGlmIChleGlzdGluZ1J1bmdzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIEFwcGVuZCBhdCBlbmQ6IGZpbmQgbGFzdCBydW5nIGluIGNoYWluXG4gICAgICBjb25zdCBsYXN0UnVuZyA9IHRoaXMuX2ZpbmRMYXN0SW5DaGFpbihleGlzdGluZ1J1bmdzKTtcbiAgICAgIGlmIChsYXN0UnVuZykge1xuICAgICAgICB0aGlzLl9ncmFwaC5hZGRFZGdlKGxhc3RSdW5nLCBpZCwgJ1JVTkdfT1JERVInKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9yZW51bWJlclJ1bmdzKCk7XG4gICAgdGhpcy5fbm90aWZ5KCk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG5cbiAgZGVsZXRlUnVuZyhydW5nSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICghdGhpcy5fZ3JhcGguaGFzTm9kZShydW5nSWQpKSByZXR1cm47XG5cbiAgICAvLyBGaXggUlVOR19PUkRFUiBjaGFpbjogY29ubmVjdCBwcmVkZWNlc3NvciB0byBzdWNjZXNzb3JcbiAgICBjb25zdCBpbkVkZ2VzID0gdGhpcy5fZ3JhcGguZ2V0SW5FZGdlc0J5VHlwZShydW5nSWQsICdSVU5HX09SREVSJyk7XG4gICAgY29uc3Qgb3V0RWRnZXMgPSB0aGlzLl9ncmFwaC5nZXRPdXRFZGdlc0J5VHlwZShydW5nSWQsICdSVU5HX09SREVSJyk7XG4gICAgY29uc3QgcHJlZGVjZXNzb3IgPSBpbkVkZ2VzLmxlbmd0aCA+IDAgPyBpbkVkZ2VzWzBdLnNvdXJjZSA6IG51bGw7XG4gICAgY29uc3Qgc3VjY2Vzc29yID0gb3V0RWRnZXMubGVuZ3RoID4gMCA/IG91dEVkZ2VzWzBdLnRhcmdldCA6IG51bGw7XG5cbiAgICBpZiAocHJlZGVjZXNzb3IgJiYgc3VjY2Vzc29yKSB7XG4gICAgICB0aGlzLl9ncmFwaC5hZGRFZGdlKHByZWRlY2Vzc29yLCBzdWNjZXNzb3IsICdSVU5HX09SREVSJyk7XG4gICAgfVxuXG4gICAgLy8gUmVtb3ZlIGFsbCBjaGlsZHJlbiAoTERfRUxFTUVOVCBub2Rlcykgb2YgdGhpcyBydW5nXG4gICAgY29uc3QgY2hpbGRyZW4gPSB0aGlzLl9ncmFwaC5nZXRDaGlsZHJlbihydW5nSWQpO1xuICAgIGZvciAoY29uc3QgY2hpbGRJZCBvZiBjaGlsZHJlbikge1xuICAgICAgdGhpcy5fZ3JhcGgucmVtb3ZlTm9kZShjaGlsZElkKTtcbiAgICB9XG5cbiAgICB0aGlzLl9ncmFwaC5yZW1vdmVOb2RlKHJ1bmdJZCk7XG4gICAgdGhpcy5fcmVudW1iZXJSdW5ncygpO1xuICAgIHRoaXMuX25vdGlmeSgpO1xuICB9XG5cbiAgYWRkRWxlbWVudFRvUnVuZyhydW5nSWQ6IHN0cmluZywgZWxlbWVudDogTGFkZGVyRWxlbWVudCk6IHZvaWQge1xuICAgIHRoaXMuX2FkZExERWxlbWVudEZyb21GbGF0KHJ1bmdJZCwgZWxlbWVudCk7XG4gICAgdGhpcy5fbm90aWZ5KCk7XG4gIH1cblxuICB1cGRhdGVFbGVtZW50KGVsZW1lbnRJZDogc3RyaW5nLCB1cGRhdGVzOiBQYXJ0aWFsPExhZGRlckVsZW1lbnQ+KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLl9ncmFwaC5oYXNOb2RlKGVsZW1lbnRJZCkpIHJldHVybjtcbiAgICBjb25zdCBkYXRhID0gdGhpcy5fZ3JhcGguZ2V0Tm9kZURhdGE8TERFbGVtZW50Tm9kZURhdGE+KGVsZW1lbnRJZCk7XG5cbiAgICAvLyBQb3NpdGlvbiBjaGFuZ2VcbiAgICBpZiAodXBkYXRlcy5wb3NpdGlvbikge1xuICAgICAgZGF0YS5wb3NpdGlvbiA9IHVwZGF0ZXMucG9zaXRpb247XG4gICAgfVxuXG4gICAgLy8gS2luZCBjaGFuZ2UgKGUuZy4gTk8gY29udGFjdCBcdTIxOTIgTkMgY29udGFjdCwgbm9ybWFsIGNvaWwgXHUyMTkyIHNldCBjb2lsKVxuICAgIGlmICh1cGRhdGVzLmtpbmQgPT09ICdjb250YWN0JyAmJiAndHlwZScgaW4gdXBkYXRlcykge1xuICAgICAgY29uc3QgbWFwOiBSZWNvcmQ8c3RyaW5nLCBMREVsZW1lbnRLaW5kPiA9IHtcbiAgICAgICAgJ05PJzogJ2NvbnRhY3Rfbm8nLCAnTkMnOiAnY29udGFjdF9uYycsICdQX0NPTlRBQ1QnOiAnY29udGFjdF9wJywgJ05fQ09OVEFDVCc6ICdjb250YWN0X24nLFxuICAgICAgfTtcbiAgICAgIGRhdGEuZWxlbWVudEtpbmQgPSBtYXBbKHVwZGF0ZXMgYXMgYW55KS50eXBlXSA/PyBkYXRhLmVsZW1lbnRLaW5kO1xuICAgIH0gZWxzZSBpZiAodXBkYXRlcy5raW5kID09PSAnY29pbCcgJiYgJ3R5cGUnIGluIHVwZGF0ZXMpIHtcbiAgICAgIGNvbnN0IG1hcDogUmVjb3JkPHN0cmluZywgTERFbGVtZW50S2luZD4gPSB7XG4gICAgICAgICdub3JtYWwnOiAnY29pbCcsICduZWdhdGVkJzogJ2NvaWxfbmVnYXRlZCcsICdzZXQnOiAnY29pbF9zZXQnLFxuICAgICAgICAncmVzZXQnOiAnY29pbF9yZXNldCcsICdsYXRjaCc6ICdjb2lsX2xhdGNoJywgJ3VubGF0Y2gnOiAnY29pbF91bmxhdGNoJyxcbiAgICAgIH07XG4gICAgICBkYXRhLmVsZW1lbnRLaW5kID0gbWFwWyh1cGRhdGVzIGFzIGFueSkudHlwZV0gPz8gZGF0YS5lbGVtZW50S2luZDtcbiAgICB9XG5cbiAgICAvLyBCbG9jay1zcGVjaWZpYyBmaWVsZHNcbiAgICBpZiAodXBkYXRlcy5raW5kID09PSAnYmxvY2snKSB7XG4gICAgICBpZiAoJ2ZiVHlwZScgaW4gdXBkYXRlcyAmJiB1cGRhdGVzLmZiVHlwZSkgZGF0YS5mYlR5cGUgPSB1cGRhdGVzLmZiVHlwZSBhcyBzdHJpbmc7XG4gICAgICBpZiAoJ2luc3RhbmNlTmFtZScgaW4gdXBkYXRlcykgZGF0YS5pbnN0YW5jZU5hbWUgPSAodXBkYXRlcyBhcyBhbnkpLmluc3RhbmNlTmFtZTtcbiAgICB9XG5cbiAgICB0aGlzLl9ncmFwaC51cGRhdGVOb2RlRGF0YShlbGVtZW50SWQsIGRhdGEpO1xuXG4gICAgLy8gVGFnIHJlZmVyZW5jZSBjaGFuZ2VkIFx1MjAxNCByZS13aXJlIFJFQURTL1dSSVRFUyBlZGdlc1xuICAgIGlmICgndGFnJyBpbiB1cGRhdGVzICYmICh1cGRhdGVzIGFzIGFueSkudGFnKSB7XG4gICAgICBjb25zdCB0YWcgPSAodXBkYXRlcyBhcyBhbnkpLnRhZztcbiAgICAgIC8vIFJlbW92ZSBvbGQgUkVBRFMvV1JJVEVTIGVkZ2VzXG4gICAgICBjb25zdCBvbGRSZWFkcyA9IHRoaXMuX2dyYXBoLmdldE91dEVkZ2VzQnlUeXBlKGVsZW1lbnRJZCwgJ1JFQURTJyk7XG4gICAgICBjb25zdCBvbGRXcml0ZXMgPSB0aGlzLl9ncmFwaC5nZXRPdXRFZGdlc0J5VHlwZShlbGVtZW50SWQsICdXUklURVMnKTtcbiAgICAgIGZvciAoY29uc3QgZSBvZiBbLi4ub2xkUmVhZHMsIC4uLm9sZFdyaXRlc10pIHtcbiAgICAgICAgdGhpcy5fZ3JhcGgucmVtb3ZlRWRnZShlLmVkZ2VLZXkpO1xuICAgICAgfVxuICAgICAgLy8gQWRkIG5ldyBcdTIwMTQgZGlyZWN0aW9uIGRldGVybWluZWQgYnkgdXBkYXRlZCBraW5kXG4gICAgICBjb25zdCB0YWdJZCA9IHRoaXMuX2Vuc3VyZVRhZyh0YWcubmFtZSwgdGFnLmRhdGFUeXBlKTtcbiAgICAgIGNvbnN0IGlzV3JpdGUgPSBkYXRhLmVsZW1lbnRLaW5kLnN0YXJ0c1dpdGgoJ2NvaWwnKTtcbiAgICAgIHRoaXMuX2dyYXBoLmFkZEVkZ2UoZWxlbWVudElkLCB0YWdJZCwgaXNXcml0ZSA/ICdXUklURVMnIDogJ1JFQURTJyk7XG4gICAgfVxuXG4gICAgdGhpcy5fbm90aWZ5KCk7XG4gIH1cblxuICBkZWxldGVFbGVtZW50KGVsZW1lbnRJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX2dyYXBoLmhhc05vZGUoZWxlbWVudElkKSkge1xuICAgICAgdGhpcy5fZ3JhcGgucmVtb3ZlTm9kZShlbGVtZW50SWQpO1xuICAgICAgdGhpcy5fbm90aWZ5KCk7XG4gICAgfVxuICB9XG5cbiAgdXBkYXRlUnVuZ0NvbW1lbnQocnVuZ0lkOiBzdHJpbmcsIGNvbW1lbnQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICghdGhpcy5fZ3JhcGguaGFzTm9kZShydW5nSWQpKSByZXR1cm47XG4gICAgY29uc3QgZGF0YSA9IHRoaXMuX2dyYXBoLmdldE5vZGVEYXRhPFJ1bmdOb2RlRGF0YT4ocnVuZ0lkKTtcbiAgICB0aGlzLl9ncmFwaC51cGRhdGVOb2RlRGF0YShydW5nSWQsIHsgLi4uZGF0YSwgY29tbWVudCB9KTtcbiAgICB0aGlzLl9ub3RpZnkoKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMFx1MjUwMCBNdXRhdGlvbnM6IEZCRCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBhZGRGQkROb2RlKG5vZGU6IEZCRE5vZGUpOiB2b2lkIHtcbiAgICB0aGlzLl9ncmFwaC5hZGROb2RlKG5vZGUuaWQsICdGQkRfQkxPQ0snLCAnRkJEJywge1xuICAgICAgYmxvY2tUeXBlOiBub2RlLnR5cGUsXG4gICAgICBpbnN0YW5jZU5hbWU6IG5vZGUuaW5zdGFuY2VOYW1lLFxuICAgICAgbGFiZWw6IG5vZGUubGFiZWwsXG4gICAgICBjb250ZW50OiBub2RlLmNvbnRlbnQsXG4gICAgICBwb3NpdGlvbjogbm9kZS5wb3NpdGlvbixcbiAgICAgIHNpemU6IG5vZGUuc2l6ZSxcbiAgICB9IHNhdGlzZmllcyBGQkRCbG9ja05vZGVEYXRhKTtcblxuICAgIHRoaXMuX2dyYXBoLmFkZEVkZ2UoUE9VX0lELCBub2RlLmlkLCAnQ09OVEFJTlMnKTtcblxuICAgIGZvciAoY29uc3QgcGluIG9mIG5vZGUuaW5wdXRzKSB7XG4gICAgICBjb25zdCBwaW5Ob2RlSWQgPSBgJHtub2RlLmlkfTo6JHtwaW4uaWR9YDtcbiAgICAgIHRoaXMuX2dyYXBoLmFkZE5vZGUocGluTm9kZUlkLCAnRkJEX1BJTicsICdGQkQnLCB7XG4gICAgICAgIHBpbk5hbWU6IHBpbi5uYW1lLCBkaXJlY3Rpb246ICdpbicsIGRhdGFUeXBlOiBwaW4uZGF0YVR5cGUsIG5lZ2F0ZWQ6IHBpbi5uZWdhdGVkLFxuICAgICAgfSBzYXRpc2ZpZXMgRkJEUGluTm9kZURhdGEpO1xuICAgICAgdGhpcy5fZ3JhcGguYWRkRWRnZShub2RlLmlkLCBwaW5Ob2RlSWQsICdIQVNfUElOJyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGluIG9mIG5vZGUub3V0cHV0cykge1xuICAgICAgY29uc3QgcGluTm9kZUlkID0gYCR7bm9kZS5pZH06OiR7cGluLmlkfWA7XG4gICAgICB0aGlzLl9ncmFwaC5hZGROb2RlKHBpbk5vZGVJZCwgJ0ZCRF9QSU4nLCAnRkJEJywge1xuICAgICAgICBwaW5OYW1lOiBwaW4ubmFtZSwgZGlyZWN0aW9uOiAnb3V0JywgZGF0YVR5cGU6IHBpbi5kYXRhVHlwZSwgbmVnYXRlZDogcGluLm5lZ2F0ZWQsXG4gICAgICB9IHNhdGlzZmllcyBGQkRQaW5Ob2RlRGF0YSk7XG4gICAgICB0aGlzLl9ncmFwaC5hZGRFZGdlKG5vZGUuaWQsIHBpbk5vZGVJZCwgJ0hBU19QSU4nKTtcbiAgICB9XG5cbiAgICBpZiAobm9kZS50YWcpIHtcbiAgICAgIGNvbnN0IHRhZ0lkID0gdGhpcy5fZW5zdXJlVGFnKG5vZGUudGFnLm5hbWUsIG5vZGUudGFnLmRhdGFUeXBlKTtcbiAgICAgIGlmIChub2RlLnR5cGUgPT09ICdJTl9WQVJJQUJMRScgfHwgbm9kZS50eXBlID09PSAnSU5PVVRfVkFSSUFCTEUnKSB7XG4gICAgICAgIHRoaXMuX2dyYXBoLmFkZEVkZ2Uobm9kZS5pZCwgdGFnSWQsICdSRUFEUycpO1xuICAgICAgfVxuICAgICAgaWYgKG5vZGUudHlwZSA9PT0gJ09VVF9WQVJJQUJMRScgfHwgbm9kZS50eXBlID09PSAnSU5PVVRfVkFSSUFCTEUnKSB7XG4gICAgICAgIHRoaXMuX2dyYXBoLmFkZEVkZ2Uobm9kZS5pZCwgdGFnSWQsICdXUklURVMnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9ub3RpZnkoKTtcbiAgfVxuXG4gIHVwZGF0ZUZCRE5vZGUobm9kZUlkOiBzdHJpbmcsIHVwZGF0ZXM6IFBhcnRpYWw8RkJETm9kZT4pOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuX2dyYXBoLmhhc05vZGUobm9kZUlkKSkgcmV0dXJuO1xuICAgIGNvbnN0IGRhdGEgPSB0aGlzLl9ncmFwaC5nZXROb2RlRGF0YTxGQkRCbG9ja05vZGVEYXRhPihub2RlSWQpO1xuICAgIGlmICh1cGRhdGVzLnBvc2l0aW9uKSBkYXRhLnBvc2l0aW9uID0gdXBkYXRlcy5wb3NpdGlvbjtcbiAgICBpZiAodXBkYXRlcy5zaXplKSBkYXRhLnNpemUgPSB1cGRhdGVzLnNpemU7XG4gICAgaWYgKHVwZGF0ZXMuaW5zdGFuY2VOYW1lICE9PSB1bmRlZmluZWQpIGRhdGEuaW5zdGFuY2VOYW1lID0gdXBkYXRlcy5pbnN0YW5jZU5hbWU7XG4gICAgaWYgKHVwZGF0ZXMubGFiZWwgIT09IHVuZGVmaW5lZCkgZGF0YS5sYWJlbCA9IHVwZGF0ZXMubGFiZWw7XG4gICAgaWYgKHVwZGF0ZXMuY29udGVudCAhPT0gdW5kZWZpbmVkKSBkYXRhLmNvbnRlbnQgPSB1cGRhdGVzLmNvbnRlbnQ7XG4gICAgdGhpcy5fZ3JhcGgudXBkYXRlTm9kZURhdGEobm9kZUlkLCBkYXRhKTtcbiAgICB0aGlzLl9ub3RpZnkoKTtcbiAgfVxuXG4gIGRlbGV0ZUZCRE5vZGUobm9kZUlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuX2dyYXBoLmhhc05vZGUobm9kZUlkKSkgcmV0dXJuO1xuICAgIC8vIFJlbW92ZSBwaW5zIGZpcnN0XG4gICAgY29uc3QgcGluRWRnZXMgPSB0aGlzLl9ncmFwaC5nZXRPdXRFZGdlc0J5VHlwZShub2RlSWQsICdIQVNfUElOJyk7XG4gICAgZm9yIChjb25zdCBwZSBvZiBwaW5FZGdlcykge1xuICAgICAgdGhpcy5fZ3JhcGgucmVtb3ZlTm9kZShwZS50YXJnZXQpO1xuICAgIH1cbiAgICB0aGlzLl9ncmFwaC5yZW1vdmVOb2RlKG5vZGVJZCk7XG4gICAgdGhpcy5fbm90aWZ5KCk7XG4gIH1cblxuICBhZGRGQkRXaXJlKHdpcmU6IEZCRFdpcmUpOiB2b2lkIHtcbiAgICBjb25zdCBmcm9tUGluSWQgPSB0aGlzLl9maW5kUGluSWQod2lyZS5mcm9tLm5vZGVJZCwgd2lyZS5mcm9tLnBpbiwgJ291dCcpO1xuICAgIGNvbnN0IHRvUGluSWQgPSB0aGlzLl9maW5kUGluSWQod2lyZS50by5ub2RlSWQsIHdpcmUudG8ucGluLCAnaW4nKTtcblxuICAgIGlmIChmcm9tUGluSWQgJiYgdG9QaW5JZCkge1xuICAgICAgdGhpcy5fZ3JhcGguYWRkRWRnZShmcm9tUGluSWQsIHRvUGluSWQsICdXSVJFJywgeyB3aXJlSWQ6IHdpcmUuaWQsIG5lZ2F0ZWQ6IHdpcmUubmVnYXRlZCB9KTtcbiAgICB9XG4gICAgdGhpcy5fbm90aWZ5KCk7XG4gIH1cblxuICBkZWxldGVGQkRXaXJlKHdpcmVJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgLy8gRmluZCBhbmQgcmVtb3ZlIHRoZSBXSVJFIGVkZ2Ugd2l0aCB0aGlzIHdpcmVJZFxuICAgIHRoaXMuX2dyYXBoLmdyYXBoLmZvckVhY2hFZGdlKChlZGdlS2V5LCBhdHRyKSA9PiB7XG4gICAgICBpZiAoYXR0ci50eXBlID09PSAnV0lSRScgJiYgKGF0dHIuZGF0YSBhcyBhbnkpPy53aXJlSWQgPT09IHdpcmVJZCkge1xuICAgICAgICB0aGlzLl9ncmFwaC5yZW1vdmVFZGdlKGVkZ2VLZXkpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuX25vdGlmeSgpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIE11dGF0aW9uczogU0ZDIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIGFkZFNGQ1N0ZXAoc3RlcDogU0ZDU3RlcCk6IHZvaWQge1xuICAgIHRoaXMuX2dyYXBoLmFkZE5vZGUoc3RlcC5pZCwgJ1NGQ19TVEVQJywgJ1NGQycsIHtcbiAgICAgIHN0ZXBOYW1lOiBzdGVwLm5hbWUsXG4gICAgICBpc0luaXRpYWw6IHN0ZXAuaXNJbml0aWFsLFxuICAgICAgcG9zaXRpb246IHN0ZXAucG9zaXRpb24sXG4gICAgfSBzYXRpc2ZpZXMgU0ZDU3RlcE5vZGVEYXRhKTtcbiAgICB0aGlzLl9ncmFwaC5hZGRFZGdlKFBPVV9JRCwgc3RlcC5pZCwgJ0NPTlRBSU5TJyk7XG5cbiAgICBmb3IgKGNvbnN0IGFjdGlvbiBvZiBzdGVwLmFjdGlvbnMpIHtcbiAgICAgIHRoaXMuX2FkZFNGQ0FjdGlvbihzdGVwLmlkLCBhY3Rpb24pO1xuICAgIH1cbiAgICB0aGlzLl9ub3RpZnkoKTtcbiAgfVxuXG4gIHVwZGF0ZVNGQ1N0ZXAoc3RlcElkOiBzdHJpbmcsIHVwZGF0ZXM6IFBhcnRpYWw8U0ZDU3RlcD4pOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuX2dyYXBoLmhhc05vZGUoc3RlcElkKSkgcmV0dXJuO1xuICAgIGNvbnN0IGRhdGEgPSB0aGlzLl9ncmFwaC5nZXROb2RlRGF0YTxTRkNTdGVwTm9kZURhdGE+KHN0ZXBJZCk7XG4gICAgaWYgKHVwZGF0ZXMubmFtZSAhPT0gdW5kZWZpbmVkKSBkYXRhLnN0ZXBOYW1lID0gdXBkYXRlcy5uYW1lO1xuICAgIGlmICh1cGRhdGVzLmlzSW5pdGlhbCAhPT0gdW5kZWZpbmVkKSBkYXRhLmlzSW5pdGlhbCA9IHVwZGF0ZXMuaXNJbml0aWFsO1xuICAgIGlmICh1cGRhdGVzLnBvc2l0aW9uICE9PSB1bmRlZmluZWQpIGRhdGEucG9zaXRpb24gPSB1cGRhdGVzLnBvc2l0aW9uO1xuICAgIHRoaXMuX2dyYXBoLnVwZGF0ZU5vZGVEYXRhKHN0ZXBJZCwgZGF0YSk7XG4gICAgdGhpcy5fbm90aWZ5KCk7XG4gIH1cblxuICBkZWxldGVTRkNTdGVwKHN0ZXBJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLl9ncmFwaC5oYXNOb2RlKHN0ZXBJZCkpIHJldHVybjtcbiAgICAvLyBSZW1vdmUgYWN0aW9uc1xuICAgIGNvbnN0IGFjdGlvbkVkZ2VzID0gdGhpcy5fZ3JhcGguZ2V0T3V0RWRnZXNCeVR5cGUoc3RlcElkLCAnSEFTX0FDVElPTicpO1xuICAgIGZvciAoY29uc3QgYWUgb2YgYWN0aW9uRWRnZXMpIHtcbiAgICAgIHRoaXMuX2dyYXBoLnJlbW92ZU5vZGUoYWUudGFyZ2V0KTtcbiAgICB9XG4gICAgdGhpcy5fZ3JhcGgucmVtb3ZlTm9kZShzdGVwSWQpO1xuICAgIHRoaXMuX25vdGlmeSgpO1xuICB9XG5cbiAgYWRkU0ZDVHJhbnNpdGlvbih0cmFuczogU0ZDVHJhbnNpdGlvbik6IHZvaWQge1xuICAgIHRoaXMuX2dyYXBoLmFkZE5vZGUodHJhbnMuaWQsICdTRkNfVFJBTlNJVElPTicsICdTRkMnLCB7XG4gICAgICBjb25kaXRpb25FeHByOiB0cmFucy5jb25kaXRpb24sXG4gICAgICBwb3NpdGlvbjogdHJhbnMucG9zaXRpb24sXG4gICAgICBwcmlvcml0eTogdHJhbnMucHJpb3JpdHksXG4gICAgfSBzYXRpc2ZpZXMgU0ZDVHJhbnNpdGlvbk5vZGVEYXRhKTtcbiAgICB0aGlzLl9ncmFwaC5hZGRFZGdlKFBPVV9JRCwgdHJhbnMuaWQsICdDT05UQUlOUycpO1xuXG4gICAgLy8gUGFyc2UgY29uZGl0aW9uIHJlZnNcbiAgICBjb25zdCByZWZzID0gcGFyc2VDb25kaXRpb25UYWdSZWZzKHRyYW5zLmNvbmRpdGlvbik7XG4gICAgZm9yIChjb25zdCByZWYgb2YgcmVmcykge1xuICAgICAgY29uc3QgdGFnSWQgPSB0aGlzLl9lbnN1cmVUYWcocmVmLCAnQk9PTCcpO1xuICAgICAgdGhpcy5fZ3JhcGguYWRkRWRnZSh0cmFucy5pZCwgdGFnSWQsICdSRUFEUycpO1xuICAgIH1cbiAgICB0aGlzLl9ub3RpZnkoKTtcbiAgfVxuXG4gIHVwZGF0ZVNGQ1RyYW5zaXRpb24odHJhbnNJZDogc3RyaW5nLCB1cGRhdGVzOiBQYXJ0aWFsPFNGQ1RyYW5zaXRpb24+KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLl9ncmFwaC5oYXNOb2RlKHRyYW5zSWQpKSByZXR1cm47XG4gICAgY29uc3QgZGF0YSA9IHRoaXMuX2dyYXBoLmdldE5vZGVEYXRhPFNGQ1RyYW5zaXRpb25Ob2RlRGF0YT4odHJhbnNJZCk7XG4gICAgaWYgKHVwZGF0ZXMuY29uZGl0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIFJlbW92ZSBvbGQgUkVBRFMgZWRnZXMgZnJvbSB0aGlzIHRyYW5zaXRpb25cbiAgICAgIGNvbnN0IG9sZFJlYWRzID0gdGhpcy5fZ3JhcGguZ2V0T3V0RWRnZXNCeVR5cGUodHJhbnNJZCwgJ1JFQURTJyk7XG4gICAgICBmb3IgKGNvbnN0IGUgb2Ygb2xkUmVhZHMpIHRoaXMuX2dyYXBoLnJlbW92ZUVkZ2UoZS5lZGdlS2V5KTtcblxuICAgICAgZGF0YS5jb25kaXRpb25FeHByID0gdXBkYXRlcy5jb25kaXRpb247XG4gICAgICAvLyBBZGQgbmV3IFJFQURTIGVkZ2VzXG4gICAgICBjb25zdCByZWZzID0gcGFyc2VDb25kaXRpb25UYWdSZWZzKHVwZGF0ZXMuY29uZGl0aW9uKTtcbiAgICAgIGZvciAoY29uc3QgcmVmIG9mIHJlZnMpIHtcbiAgICAgICAgY29uc3QgdGFnSWQgPSB0aGlzLl9lbnN1cmVUYWcocmVmLCAnQk9PTCcpO1xuICAgICAgICB0aGlzLl9ncmFwaC5hZGRFZGdlKHRyYW5zSWQsIHRhZ0lkLCAnUkVBRFMnKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHVwZGF0ZXMucG9zaXRpb24gIT09IHVuZGVmaW5lZCkgZGF0YS5wb3NpdGlvbiA9IHVwZGF0ZXMucG9zaXRpb247XG4gICAgaWYgKHVwZGF0ZXMucHJpb3JpdHkgIT09IHVuZGVmaW5lZCkgZGF0YS5wcmlvcml0eSA9IHVwZGF0ZXMucHJpb3JpdHk7XG4gICAgdGhpcy5fZ3JhcGgudXBkYXRlTm9kZURhdGEodHJhbnNJZCwgZGF0YSk7XG4gICAgdGhpcy5fbm90aWZ5KCk7XG4gIH1cblxuICBkZWxldGVTRkNUcmFuc2l0aW9uKHRyYW5zSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICh0aGlzLl9ncmFwaC5oYXNOb2RlKHRyYW5zSWQpKSB7XG4gICAgICB0aGlzLl9ncmFwaC5yZW1vdmVOb2RlKHRyYW5zSWQpO1xuICAgICAgdGhpcy5fbm90aWZ5KCk7XG4gICAgfVxuICB9XG5cbiAgYWRkU0ZDTGluayhsaW5rOiBTRkNMaW5rKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX2dyYXBoLmhhc05vZGUobGluay5mcm9tKSAmJiB0aGlzLl9ncmFwaC5oYXNOb2RlKGxpbmsudG8pKSB7XG4gICAgICB0aGlzLl9ncmFwaC5hZGRFZGdlKGxpbmsuZnJvbSwgbGluay50bywgJ1NGQ19GTE9XJywgeyBsaW5rSWQ6IGxpbmsuaWQsIGxpbmtUeXBlOiBsaW5rLnR5cGUgfSk7XG4gICAgICB0aGlzLl9ub3RpZnkoKTtcbiAgICB9XG4gIH1cblxuICBkZWxldGVTRkNMaW5rKGxpbmtJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5fZ3JhcGguZ3JhcGguZm9yRWFjaEVkZ2UoKGVkZ2VLZXksIGF0dHIpID0+IHtcbiAgICAgIGlmIChhdHRyLnR5cGUgPT09ICdTRkNfRkxPVycgJiYgKGF0dHIuZGF0YSBhcyBhbnkpPy5saW5rSWQgPT09IGxpbmtJZCkge1xuICAgICAgICB0aGlzLl9ncmFwaC5yZW1vdmVFZGdlKGVkZ2VLZXkpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuX25vdGlmeSgpO1xuICB9XG5cbiAgYWRkU0ZDQnJhbmNoKGJyYW5jaDogU0ZDQnJhbmNoKTogdm9pZCB7XG4gICAgLy8gU0ZDIGJyYW5jaGVzIGFyZSBzdHJ1Y3R1cmFsIG1ldGFkYXRhIFx1MjAxNCBzdG9yZSBhcyBDT05UQUlOUyBlZGdlcyBvbiB0aGUgUE9VLlxuICAgIC8vIFRoZSBicmFuY2ggSUQgaXMgc3RvcmVkIG9uIGVhY2ggc3RlcCBub2RlJ3MgYnJhbmNoSWQgZmllbGQgKG5vdCBhIHNlcGFyYXRlIG5vZGUpLlxuICAgIC8vIEJyYW5jaGVzIGFyZSByZWNvbnN0cnVjdGVkIGZyb20gU0ZDX0ZMT1cgdG9wb2xvZ3kgZHVyaW5nIHByb2plY3Rpb24uXG4gICAgLy8gSGVyZSB3ZSBqdXN0IGVuc3VyZSB0aGUgYnJhbmNoIHN0ZXBzIGFyZSBjb3JyZWN0bHkgYXNzb2NpYXRlZC5cbiAgICB0aGlzLl9ub3RpZnkoKTtcbiAgfVxuXG4gIGRlbGV0ZVNGQ0JyYW5jaChfYnJhbmNoSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIC8vIEJyYW5jaCByZW1vdmFsOiBhbGwgU0ZDX0ZMT1cgZWRnZXMgbGlua2luZyB0aHJvdWdoIHRoaXMgYnJhbmNoJ3Mgc3RlcHNcbiAgICAvLyBhcmUgYWxyZWFkeSBoYW5kbGVkIGJ5IGRlbGV0ZVNGQ0xpbmsvZGVsZXRlU0ZDU3RlcC5cbiAgICB0aGlzLl9ub3RpZnkoKTtcbiAgfVxuXG4gIGFkZFNGQ0p1bXAoanVtcDogeyBpZDogc3RyaW5nOyB0YXJnZXRTdGVwTmFtZTogc3RyaW5nOyBwb3NpdGlvbj86IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSB9KTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX2dyYXBoLmhhc05vZGUoanVtcC5pZCkpIHJldHVybjtcbiAgICB0aGlzLl9ncmFwaC5hZGROb2RlKGp1bXAuaWQsICdTRkNfSlVNUCcsICdTRkMnLCB7XG4gICAgICB0YXJnZXRTdGVwTmFtZToganVtcC50YXJnZXRTdGVwTmFtZSxcbiAgICB9KTtcbiAgICB0aGlzLl9ncmFwaC5hZGRFZGdlKFBPVV9JRCwganVtcC5pZCwgJ0NPTlRBSU5TJyk7XG4gICAgdGhpcy5fbm90aWZ5KCk7XG4gIH1cblxuICBkZWxldGVTRkNKdW1wKGp1bXBJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX2dyYXBoLmhhc05vZGUoanVtcElkKSkge1xuICAgICAgdGhpcy5fZ3JhcGgucmVtb3ZlTm9kZShqdW1wSWQpO1xuICAgICAgdGhpcy5fbm90aWZ5KCk7XG4gICAgfVxuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIE11dGF0aW9uczogVGFncyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICByZW5hbWVUYWcob2xkTmFtZTogc3RyaW5nLCBuZXdOYW1lOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCB0YWdJZCA9IHRoaXMuX2dyYXBoLmZpbmRUYWdCeU5hbWUob2xkTmFtZSk7XG4gICAgaWYgKCF0YWdJZCkgcmV0dXJuO1xuICAgIGNvbnN0IGRhdGEgPSB0aGlzLl9ncmFwaC5nZXROb2RlRGF0YTxUYWdOb2RlRGF0YT4odGFnSWQpO1xuICAgIGRhdGEubmFtZSA9IG5ld05hbWU7XG4gICAgdGhpcy5fZ3JhcGgudXBkYXRlTm9kZURhdGEodGFnSWQsIGRhdGEpO1xuXG4gICAgLy8gUHJvcGFnYXRlIHJlbmFtZSBpbnRvIFNGQyB0cmFuc2l0aW9uIGNvbmRpdGlvbiBleHByZXNzaW9uc1xuICAgIC8vICh0aGVzZSBlbWJlZCB0YWcgbmFtZXMgYXMgcGxhaW4gaWRlbnRpZmllcnMgaW4gdGhlIGNvbmRpdGlvbkV4cHIgc3RyaW5nKVxuICAgIGZvciAoY29uc3QgdHJhbnNJZCBvZiB0aGlzLl9ncmFwaC5nZXROb2Rlc0J5VHlwZSgnU0ZDX1RSQU5TSVRJT04nKSkge1xuICAgICAgY29uc3QgdHJhbnNEYXRhID0gdGhpcy5fZ3JhcGguZ2V0Tm9kZURhdGE8aW1wb3J0KCcuL3NjaGVtYS5qcycpLlNGQ1RyYW5zaXRpb25Ob2RlRGF0YT4odHJhbnNJZCk7XG4gICAgICBpZiAoIXRyYW5zRGF0YS5jb25kaXRpb25FeHByKSBjb250aW51ZTtcbiAgICAgIC8vIFJlcGxhY2Ugd2hvbGUtd29yZCBvY2N1cnJlbmNlcyBvZiBvbGROYW1lIHdpdGggbmV3TmFtZVxuICAgICAgY29uc3QgdXBkYXRlZCA9IHRyYW5zRGF0YS5jb25kaXRpb25FeHByLnJlcGxhY2UoXG4gICAgICAgIG5ldyBSZWdFeHAoYFxcXFxiJHtvbGROYW1lLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCAnXFxcXCQmJyl9XFxcXGJgLCAnZycpLFxuICAgICAgICBuZXdOYW1lLFxuICAgICAgKTtcbiAgICAgIGlmICh1cGRhdGVkICE9PSB0cmFuc0RhdGEuY29uZGl0aW9uRXhwcikge1xuICAgICAgICB0aGlzLl9ncmFwaC51cGRhdGVOb2RlRGF0YSh0cmFuc0lkLCB7IC4uLnRyYW5zRGF0YSwgY29uZGl0aW9uRXhwcjogdXBkYXRlZCB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9ub3RpZnkoKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMFx1MjUwMCBVbmRvL1JlZG8gc3VwcG9ydCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBzbmFwc2hvdCgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLl9ncmFwaC5zbmFwc2hvdCgpO1xuICB9XG5cbiAgcmVzdG9yZUZyb21TbmFwc2hvdChqc29uOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLl9ncmFwaC5yZXN0b3JlRnJvbVNuYXBzaG90KGpzb24pO1xuICAgIHRoaXMuX25vdGlmeSgpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFByaXZhdGUgaGVscGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBwcml2YXRlIF9lbnN1cmVUYWcobmFtZTogc3RyaW5nLCBkYXRhVHlwZTogSUVDRGF0YVR5cGUpOiBzdHJpbmcge1xuICAgIGNvbnN0IHRhZ0lkID0gYHRhZy0ke25hbWV9YDtcbiAgICBpZiAoIXRoaXMuX2dyYXBoLmhhc05vZGUodGFnSWQpKSB7XG4gICAgICB0aGlzLl9ncmFwaC5hZGROb2RlKHRhZ0lkLCAnVEFHJywgJ3NoYXJlZCcsIHtcbiAgICAgICAgbmFtZSwgZGF0YVR5cGUsIHNjb3BlOiAnZ2xvYmFsJyxcbiAgICAgIH0gc2F0aXNmaWVzIFRhZ05vZGVEYXRhKTtcbiAgICB9XG4gICAgcmV0dXJuIHRhZ0lkO1xuICB9XG5cbiAgcHJpdmF0ZSBfZmluZExhc3RJbkNoYWluKHJ1bmdJZHM6IHN0cmluZ1tdKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgaGFzT3V0Z29pbmcgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBmb3IgKGNvbnN0IGlkIG9mIHJ1bmdJZHMpIHtcbiAgICAgIGNvbnN0IG91dCA9IHRoaXMuX2dyYXBoLmdldE91dEVkZ2VzQnlUeXBlKGlkLCAnUlVOR19PUkRFUicpO1xuICAgICAgaWYgKG91dC5sZW5ndGggPiAwKSBoYXNPdXRnb2luZy5hZGQoaWQpO1xuICAgIH1cbiAgICByZXR1cm4gcnVuZ0lkcy5maW5kKGlkID0+ICFoYXNPdXRnb2luZy5oYXMoaWQpKSA/PyBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVudW1iZXJSdW5ncygpOiB2b2lkIHtcbiAgICBjb25zdCBydW5nSWRzID0gdGhpcy5fZ3JhcGguZ2V0Tm9kZXNCeVR5cGUoJ1JVTkcnKTtcbiAgICAvLyBGb2xsb3cgUlVOR19PUkRFUiBjaGFpblxuICAgIGNvbnN0IG9yZGVyZWQgPSB0aGlzLl9vcmRlclJ1bmdzKHJ1bmdJZHMpO1xuICAgIG9yZGVyZWQuZm9yRWFjaCgoaWQsIGkpID0+IHtcbiAgICAgIGNvbnN0IGRhdGEgPSB0aGlzLl9ncmFwaC5nZXROb2RlRGF0YTxSdW5nTm9kZURhdGE+KGlkKTtcbiAgICAgIGRhdGEucnVuZ051bWJlciA9IGkgKyAxO1xuICAgICAgdGhpcy5fZ3JhcGgudXBkYXRlTm9kZURhdGEoaWQsIGRhdGEpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfb3JkZXJSdW5ncyhydW5nSWRzOiBzdHJpbmdbXSk6IHN0cmluZ1tdIHtcbiAgICBpZiAocnVuZ0lkcy5sZW5ndGggPD0gMSkgcmV0dXJuIHJ1bmdJZHM7XG4gICAgY29uc3QgbmV4dE1hcCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gICAgY29uc3QgaGFzSW5jb21pbmcgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBmb3IgKGNvbnN0IGlkIG9mIHJ1bmdJZHMpIHtcbiAgICAgIGNvbnN0IG91dEVkZ2VzID0gdGhpcy5fZ3JhcGguZ2V0T3V0RWRnZXNCeVR5cGUoaWQsICdSVU5HX09SREVSJyk7XG4gICAgICBpZiAob3V0RWRnZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBuZXh0TWFwLnNldChpZCwgb3V0RWRnZXNbMF0udGFyZ2V0KTtcbiAgICAgICAgaGFzSW5jb21pbmcuYWRkKG91dEVkZ2VzWzBdLnRhcmdldCk7XG4gICAgICB9XG4gICAgfVxuICAgIGxldCBzdGFydCA9IHJ1bmdJZHMuZmluZChpZCA9PiAhaGFzSW5jb21pbmcuaGFzKGlkKSk7XG4gICAgaWYgKCFzdGFydCkgc3RhcnQgPSBydW5nSWRzWzBdO1xuICAgIGNvbnN0IG9yZGVyZWQ6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IGN1cnJlbnQ6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHN0YXJ0O1xuICAgIGNvbnN0IHZpc2l0ZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICB3aGlsZSAoY3VycmVudCAmJiAhdmlzaXRlZC5oYXMoY3VycmVudCkpIHtcbiAgICAgIHZpc2l0ZWQuYWRkKGN1cnJlbnQpO1xuICAgICAgb3JkZXJlZC5wdXNoKGN1cnJlbnQpO1xuICAgICAgY3VycmVudCA9IG5leHRNYXAuZ2V0KGN1cnJlbnQpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGlkIG9mIHJ1bmdJZHMpIHtcbiAgICAgIGlmICghdmlzaXRlZC5oYXMoaWQpKSBvcmRlcmVkLnB1c2goaWQpO1xuICAgIH1cbiAgICByZXR1cm4gb3JkZXJlZDtcbiAgfVxuXG4gIHByaXZhdGUgX2ZpbmRQaW5JZChibG9ja0lkOiBzdHJpbmcsIHBpbk5hbWU6IHN0cmluZywgZGlyZWN0aW9uOiAnaW4nIHwgJ291dCcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCBwaW5FZGdlcyA9IHRoaXMuX2dyYXBoLmdldE91dEVkZ2VzQnlUeXBlKGJsb2NrSWQsICdIQVNfUElOJyk7XG4gICAgZm9yIChjb25zdCBwZSBvZiBwaW5FZGdlcykge1xuICAgICAgY29uc3QgcGQgPSB0aGlzLl9ncmFwaC5nZXROb2RlRGF0YTxGQkRQaW5Ob2RlRGF0YT4ocGUudGFyZ2V0KTtcbiAgICAgIGlmIChwZC5waW5OYW1lID09PSBwaW5OYW1lICYmIHBkLmRpcmVjdGlvbiA9PT0gZGlyZWN0aW9uKSByZXR1cm4gcGUudGFyZ2V0O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgX2FkZExERWxlbWVudEZyb21GbGF0KHJ1bmdJZDogc3RyaW5nLCBlbDogTGFkZGVyRWxlbWVudCwgYnJhbmNoSWQ/OiBzdHJpbmcpOiB2b2lkIHtcbiAgICBsZXQga2luZDogTERFbGVtZW50S2luZDtcbiAgICBpZiAoZWwua2luZCA9PT0gJ2NvbnRhY3QnKSB7XG4gICAgICBjb25zdCBtYXA6IFJlY29yZDxzdHJpbmcsIExERWxlbWVudEtpbmQ+ID0ge1xuICAgICAgICAnTk8nOiAnY29udGFjdF9ubycsICdOQyc6ICdjb250YWN0X25jJywgJ1BfQ09OVEFDVCc6ICdjb250YWN0X3AnLCAnTl9DT05UQUNUJzogJ2NvbnRhY3RfbidcbiAgICAgIH07XG4gICAgICBraW5kID0gbWFwW2VsLnR5cGVdID8/ICdjb250YWN0X25vJztcbiAgICB9IGVsc2UgaWYgKGVsLmtpbmQgPT09ICdjb2lsJykge1xuICAgICAgY29uc3QgbWFwOiBSZWNvcmQ8c3RyaW5nLCBMREVsZW1lbnRLaW5kPiA9IHtcbiAgICAgICAgJ25vcm1hbCc6ICdjb2lsJywgJ25lZ2F0ZWQnOiAnY29pbF9uZWdhdGVkJywgJ3NldCc6ICdjb2lsX3NldCcsXG4gICAgICAgICdyZXNldCc6ICdjb2lsX3Jlc2V0JywgJ2xhdGNoJzogJ2NvaWxfbGF0Y2gnLCAndW5sYXRjaCc6ICdjb2lsX3VubGF0Y2gnXG4gICAgICB9O1xuICAgICAga2luZCA9IG1hcFtlbC50eXBlXSA/PyAnY29pbCc7XG4gICAgfSBlbHNlIHtcbiAgICAgIGtpbmQgPSAnZmJfY2FsbCc7XG4gICAgfVxuXG4gICAgdGhpcy5fZ3JhcGguYWRkTm9kZShlbC5pZCwgJ0xEX0VMRU1FTlQnLCAnTEQnLCB7XG4gICAgICBlbGVtZW50S2luZDoga2luZCwgcG9zaXRpb246IGVsLnBvc2l0aW9uLCBicmFuY2hJZCxcbiAgICAgIC4uLihlbC5raW5kID09PSAnYmxvY2snID8geyBmYlR5cGU6IGVsLmZiVHlwZSwgaW5zdGFuY2VOYW1lOiBlbC5pbnN0YW5jZU5hbWUgfSA6IHt9KSxcbiAgICB9IHNhdGlzZmllcyBMREVsZW1lbnROb2RlRGF0YSk7XG5cbiAgICB0aGlzLl9ncmFwaC5hZGRFZGdlKHJ1bmdJZCwgZWwuaWQsICdDT05UQUlOUycpO1xuXG4gICAgaWYgKGVsLmtpbmQgPT09ICdjb250YWN0Jykge1xuICAgICAgY29uc3QgdGFnSWQgPSB0aGlzLl9lbnN1cmVUYWcoZWwudGFnLm5hbWUsIGVsLnRhZy5kYXRhVHlwZSk7XG4gICAgICB0aGlzLl9ncmFwaC5hZGRFZGdlKGVsLmlkLCB0YWdJZCwgJ1JFQURTJyk7XG4gICAgfSBlbHNlIGlmIChlbC5raW5kID09PSAnY29pbCcpIHtcbiAgICAgIGNvbnN0IHRhZ0lkID0gdGhpcy5fZW5zdXJlVGFnKGVsLnRhZy5uYW1lLCBlbC50YWcuZGF0YVR5cGUpO1xuICAgICAgdGhpcy5fZ3JhcGguYWRkRWRnZShlbC5pZCwgdGFnSWQsICdXUklURVMnKTtcbiAgICB9IGVsc2UgaWYgKGVsLmtpbmQgPT09ICdibG9jaycpIHtcbiAgICAgIGZvciAoY29uc3QgW3Bpbk5hbWUsIHRhZ1JlZl0gb2YgT2JqZWN0LmVudHJpZXMoZWwucGlucykpIHtcbiAgICAgICAgaWYgKCF0YWdSZWYubmFtZSkgY29udGludWU7XG4gICAgICAgIGNvbnN0IHRhZ0lkID0gdGhpcy5fZW5zdXJlVGFnKHRhZ1JlZi5uYW1lLCB0YWdSZWYuZGF0YVR5cGUpO1xuICAgICAgICB0aGlzLl9ncmFwaC5hZGRFZGdlKGVsLmlkLCB0YWdJZCxcbiAgICAgICAgICBpc0ZCT3V0cHV0UGluKGVsLmZiVHlwZSwgcGluTmFtZSkgPyAnV1JJVEVTJyA6ICdSRUFEUycsXG4gICAgICAgICAgeyBwaW5OYW1lIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2FkZFNGQ0FjdGlvbihzdGVwSWQ6IHN0cmluZywgYWN0aW9uOiB7IGlkOiBzdHJpbmc7IHF1YWxpZmllcjogYW55OyB0YWc6IHsgbmFtZTogc3RyaW5nOyBkYXRhVHlwZTogSUVDRGF0YVR5cGUgfTsgZHVyYXRpb24/OiBzdHJpbmcgfSk6IHZvaWQge1xuICAgIHRoaXMuX2dyYXBoLmFkZE5vZGUoYWN0aW9uLmlkLCAnU0ZDX0FDVElPTicsICdTRkMnLCB7XG4gICAgICBhY3Rpb25OYW1lOiBhY3Rpb24udGFnLm5hbWUsXG4gICAgICBxdWFsaWZpZXI6IGFjdGlvbi5xdWFsaWZpZXIsXG4gICAgICBkdXJhdGlvbjogYWN0aW9uLmR1cmF0aW9uLFxuICAgIH0gc2F0aXNmaWVzIFNGQ0FjdGlvbk5vZGVEYXRhKTtcbiAgICB0aGlzLl9ncmFwaC5hZGRFZGdlKHN0ZXBJZCwgYWN0aW9uLmlkLCAnSEFTX0FDVElPTicpO1xuICAgIGNvbnN0IHRhZ0lkID0gdGhpcy5fZW5zdXJlVGFnKGFjdGlvbi50YWcubmFtZSwgYWN0aW9uLnRhZy5kYXRhVHlwZSk7XG4gICAgdGhpcy5fZ3JhcGguYWRkRWRnZShhY3Rpb24uaWQsIHRhZ0lkLCAnV1JJVEVTJyk7XG4gIH1cbn1cblxuLy8gU2luZ2xldG9uXG5leHBvcnQgY29uc3QgY2xtU3RvcmUgPSBuZXcgQ0xNU3RvcmUoKTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQVNBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsbUJBQW1CLFFBQVEsdUJBQXVCLHFCQUFxQjtBQUNoRixTQUFTLHNCQUFzQixtQkFBbUIsbUJBQW1CLDBCQUEwQjtBQW1DL0YsTUFBTSxTQUFTO0FBQUEsRUFLYixjQUFjO0FBSGQsU0FBUSxhQUFhLG9CQUFJLElBQWM7QUFDdkMsU0FBUSxlQUFlO0FBR3JCLFNBQUssU0FBUyxJQUFJLFNBQVM7QUFBQSxFQUM3QjtBQUFBLEVBRUEsSUFBSSxRQUFrQjtBQUNwQixXQUFPLEtBQUs7QUFBQSxFQUNkO0FBQUEsRUFFQSxJQUFJLGNBQXVCO0FBQ3pCLFdBQU8sS0FBSztBQUFBLEVBQ2Q7QUFBQTtBQUFBO0FBQUE7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
