import { produce } from "immer";
const createInitialLadder = () => ({
  rungs: [
    {
      id: "rung-1",
      number: 1,
      comment: "Motor start/stop circuit",
      elements: [
        { kind: "contact", id: "el-1", type: "NO", tag: { name: "PB_START", dataType: "BOOL" }, position: { x: 0, y: 0 } },
        { kind: "contact", id: "el-2", type: "NC", tag: { name: "PB_STOP", dataType: "BOOL" }, position: { x: 60, y: 0 } },
        { kind: "contact", id: "el-3", type: "NC", tag: { name: "OVERLOAD", dataType: "BOOL" }, position: { x: 120, y: 0 } },
        { kind: "coil", id: "el-4", type: "normal", tag: { name: "MOTOR_RUN", dataType: "BOOL" }, position: { x: 180, y: 0 } }
      ],
      branches: [
        {
          id: "branch-1",
          startNodeId: "el-1",
          endNodeId: "el-2",
          elements: [
            { kind: "contact", id: "el-5", type: "NO", tag: { name: "MOTOR_RUN", dataType: "BOOL" }, position: { x: 0, y: 0 } }
          ]
        }
      ]
    },
    {
      id: "rung-2",
      number: 2,
      comment: "Motor run timer",
      elements: [
        { kind: "contact", id: "el-6", type: "NO", tag: { name: "MOTOR_RUN", dataType: "BOOL" }, position: { x: 0, y: 0 } },
        { kind: "block", id: "el-7", fbType: "TON", instanceName: "RUN_TMR", pins: { IN: { name: "MOTOR_RUN", dataType: "BOOL" }, PT: { name: "T#10s", dataType: "TIME" } }, position: { x: 60, y: 0 } },
        { kind: "coil", id: "el-8", type: "set", tag: { name: "RUN_TIMEOUT", dataType: "BOOL" }, position: { x: 180, y: 0 } }
      ],
      branches: []
    },
    {
      id: "rung-3",
      number: 3,
      comment: "Fault reset",
      elements: [
        { kind: "contact", id: "el-9", type: "NO", tag: { name: "FAULT_RESET", dataType: "BOOL" }, position: { x: 0, y: 0 } },
        { kind: "coil", id: "el-10", type: "reset", tag: { name: "RUN_TIMEOUT", dataType: "BOOL" }, position: { x: 60, y: 0 } }
      ],
      branches: []
    }
  ]
});
const createInitialFBD = () => ({
  nodes: [
    {
      id: "fbd-input-1",
      type: "IN_VARIABLE",
      position: { x: 60, y: 80 },
      inputs: [],
      outputs: [{ id: "out-output-variable-0", name: "output-variable", dataType: "BOOL" }],
      tag: { name: "PB_START", dataType: "BOOL" }
    },
    {
      id: "fbd-input-2",
      type: "IN_VARIABLE",
      position: { x: 60, y: 180 },
      inputs: [],
      outputs: [{ id: "out-output-variable-0", name: "output-variable", dataType: "BOOL" }],
      tag: { name: "PB_STOP", dataType: "BOOL" }
    },
    {
      id: "fbd-and-1",
      type: "AND",
      position: { x: 280, y: 100 },
      instanceName: "and1",
      inputs: [{ id: "in-IN1-0", name: "IN1", dataType: "BOOL" }, { id: "in-IN2-1", name: "IN2", dataType: "BOOL" }],
      outputs: [{ id: "out-OUT-0", name: "OUT", dataType: "BOOL" }]
    },
    {
      id: "fbd-ton-1",
      type: "TON",
      position: { x: 500, y: 90 },
      instanceName: "RUN_TMR",
      inputs: [{ id: "in-IN-0", name: "IN", dataType: "BOOL" }, { id: "in-PT-1", name: "PT", dataType: "TIME" }],
      outputs: [{ id: "out-Q-0", name: "Q", dataType: "BOOL" }, { id: "out-ET-1", name: "ET", dataType: "TIME" }]
    },
    {
      id: "fbd-output-1",
      type: "OUT_VARIABLE",
      position: { x: 720, y: 110 },
      inputs: [{ id: "in-input-variable-0", name: "input-variable", dataType: "BOOL" }],
      outputs: [],
      tag: { name: "MOTOR_RUN", dataType: "BOOL" }
    }
  ],
  wires: [
    { id: "fbd-w1", from: { nodeId: "fbd-input-1", pin: "output-variable" }, to: { nodeId: "fbd-and-1", pin: "IN1" } },
    { id: "fbd-w2", from: { nodeId: "fbd-input-2", pin: "output-variable" }, to: { nodeId: "fbd-and-1", pin: "IN2" } },
    { id: "fbd-w3", from: { nodeId: "fbd-and-1", pin: "OUT" }, to: { nodeId: "fbd-ton-1", pin: "IN" } },
    { id: "fbd-w4", from: { nodeId: "fbd-ton-1", pin: "Q" }, to: { nodeId: "fbd-output-1", pin: "input-variable" } }
  ]
});
const createInitialSFC = () => ({
  steps: [
    {
      id: "step-initial",
      name: "Init",
      isInitial: true,
      actions: [{ id: "a1", qualifier: "N", tag: { name: "RESET_ALL", dataType: "BOOL" } }],
      position: { x: 100, y: 60 }
    },
    {
      id: "step-run",
      name: "Running",
      isInitial: false,
      actions: [
        { id: "a2", qualifier: "N", tag: { name: "MOTOR_ON", dataType: "BOOL" } },
        { id: "a3", qualifier: "D", tag: { name: "START_TMR", dataType: "BOOL" }, duration: "T#5s" }
      ],
      position: { x: 100, y: 260 }
    },
    {
      id: "step-stop",
      name: "Stopped",
      isInitial: false,
      actions: [{ id: "a4", qualifier: "N", tag: { name: "MOTOR_OFF", dataType: "BOOL" } }],
      position: { x: 100, y: 480 }
    }
  ],
  transitions: [
    {
      id: "trans-0",
      condition: "PB_START",
      position: { x: 100, y: 180 }
    },
    {
      id: "trans-1",
      condition: "PB_STOP OR TIMEOUT",
      position: { x: 100, y: 400 }
    },
    {
      id: "trans-2",
      condition: "TRUE",
      position: { x: 100, y: 620 }
    }
  ],
  links: [
    { id: "link-0", from: "step-initial", to: "trans-0", type: "simple" },
    { id: "link-1", from: "trans-0", to: "step-run", type: "simple" },
    { id: "link-2", from: "step-run", to: "trans-1", type: "simple" },
    { id: "link-3", from: "trans-1", to: "step-stop", type: "simple" },
    { id: "link-4", from: "step-stop", to: "trans-2", type: "simple" },
    { id: "link-5", from: "trans-2", to: "step-initial", type: "simple" }
  ],
  branches: [],
  jumps: []
});
const _initialLadder = createInitialLadder();
const _initialFBD = createInitialFBD();
const _initialSFC = createInitialSFC();
const initialState = {
  activeLanguage: "LD",
  ladderProgram: _initialLadder,
  fbdProgram: _initialFBD,
  sfcProgram: _initialSFC,
  selectedElementIds: /* @__PURE__ */ new Set(),
  selectedRungId: null,
  clipboard: {},
  tagDatabase: [
    { name: "PB_START", address: "%I0.0", dataType: "BOOL", description: "Start pushbutton" },
    { name: "PB_STOP", address: "%I0.1", dataType: "BOOL", description: "Stop pushbutton" },
    { name: "OVERLOAD", address: "%I0.2", dataType: "BOOL", description: "Motor overload relay" },
    { name: "MOTOR_RUN", address: "%Q0.0", dataType: "BOOL", description: "Motor contactor output" },
    { name: "FAULT_RESET", address: "%I0.3", dataType: "BOOL", description: "Fault reset button" },
    { name: "RUN_TIMEOUT", address: "%M0.0", dataType: "BOOL", description: "Motor run timeout flag" }
  ],
  crossRefIndex: /* @__PURE__ */ new Map(),
  monitorMode: "stopped",
  scanRate: 10,
  watchedTags: [],
  zoom: 1,
  showGrid: true,
  searchQuery: "",
  crossRefPanelOpen: false,
  crossRefTarget: null,
  inspectorOpen: false,
  inspectorElementId: null,
  fbdBlockPinValues: {},
  consoleLog: [],
  pous: [{
    id: "pou-main",
    name: "Main",
    language: "LD",
    ladderProgram: _initialLadder,
    fbdProgram: _initialFBD,
    sfcProgram: _initialSFC
  }],
  activePouId: "pou-main",
  importedSidecar: null
};
class LogicStore {
  constructor() {
    this.state = { ...initialState, selectedElementIds: /* @__PURE__ */ new Set(), crossRefIndex: /* @__PURE__ */ new Map(), clipboard: {}, consoleLog: [], fbdBlockPinValues: {} };
    this.listeners = /* @__PURE__ */ new Set();
    this._engineRef = null;
  }
  getState() {
    return this.state;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  notify() {
    this.listeners.forEach((l) => l(this.state));
  }
  setState(updater) {
    this.state = produce(this.state, updater);
    this.notify();
  }
  // ── Language switching ──────────────────────────────────────────────────────
  setActiveLanguage(lang) {
    this.setState((d) => {
      d.activeLanguage = lang;
    });
  }
  // ── Ladder operations ───────────────────────────────────────────────────────
  addRung(afterIndex) {
    this.setState((d) => {
      const newRung = {
        id: `rung-${Date.now()}`,
        number: d.ladderProgram.rungs.length + 1,
        comment: "",
        elements: [],
        branches: []
      };
      if (afterIndex !== void 0) {
        d.ladderProgram.rungs.splice(afterIndex + 1, 0, newRung);
      } else {
        d.ladderProgram.rungs.push(newRung);
      }
      d.ladderProgram.rungs.forEach((r, i) => {
        r.number = i + 1;
      });
    });
  }
  deleteRung(rungId) {
    this.setState((d) => {
      d.ladderProgram.rungs = d.ladderProgram.rungs.filter((r) => r.id !== rungId);
      d.ladderProgram.rungs.forEach((r, i) => {
        r.number = i + 1;
      });
    });
  }
  duplicateRung(rungId) {
    this.setState((d) => {
      const idx = d.ladderProgram.rungs.findIndex((r) => r.id === rungId);
      if (idx === -1) return;
      const orig = d.ladderProgram.rungs[idx];
      const copy = JSON.parse(JSON.stringify(orig));
      const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const idMap = {};
      copy.elements = copy.elements.map((el) => {
        const newId = `${el.kind}-${uid()}`;
        idMap[el.id] = newId;
        return { ...el, id: newId };
      });
      copy.branches = copy.branches.map((br) => ({
        ...br,
        id: `branch-${uid()}`,
        startNodeId: idMap[br.startNodeId] ?? br.startNodeId,
        endNodeId: idMap[br.endNodeId] ?? br.endNodeId,
        elements: br.elements.map((el) => {
          const newId = `${el.kind}-${uid()}`;
          return { ...el, id: newId };
        })
      }));
      copy.id = `rung-${uid()}`;
      d.ladderProgram.rungs.splice(idx + 1, 0, copy);
      d.ladderProgram.rungs.forEach((r, i) => {
        r.number = i + 1;
      });
      this._rebuildCrossRef(d);
    });
  }
  moveRung(fromIdx, toIdx) {
    this.setState((d) => {
      const rungs = d.ladderProgram.rungs;
      const [moved] = rungs.splice(fromIdx, 1);
      rungs.splice(toIdx, 0, moved);
      rungs.forEach((r, i) => {
        r.number = i + 1;
      });
    });
  }
  updateRungComment(rungId, comment) {
    this.setState((d) => {
      const rung = d.ladderProgram.rungs.find((r) => r.id === rungId);
      if (rung) rung.comment = comment;
    });
  }
  addElementToRung(rungId, element) {
    this.setState((d) => {
      const rung = d.ladderProgram.rungs.find((r) => r.id === rungId);
      if (rung) rung.elements.push(element);
      this._rebuildCrossRef(d);
    });
  }
  updateElement(rungId, elementId, updates) {
    this.setState((d) => {
      const rung = d.ladderProgram.rungs.find((r) => r.id === rungId);
      if (!rung) return;
      const idx = rung.elements.findIndex((el) => el.id === elementId);
      if (idx !== -1) {
        Object.assign(rung.elements[idx], updates);
      }
      for (const branch of rung.branches) {
        const bidx = branch.elements.findIndex((el) => el.id === elementId);
        if (bidx !== -1) Object.assign(branch.elements[bidx], updates);
      }
      this._rebuildCrossRef(d);
    });
  }
  moveElement(rungId, fromIndex, toIndex) {
    this.setState((d) => {
      const rung = d.ladderProgram.rungs.find((r) => r.id === rungId);
      if (!rung) return;
      const els = rung.elements;
      if (fromIndex < 0 || fromIndex >= els.length) return;
      if (toIndex < 0 || toIndex >= els.length) return;
      const [el] = els.splice(fromIndex, 1);
      els.splice(toIndex, 0, el);
      this._rebuildCrossRef(d);
    });
  }
  deleteElement(rungId, elementId) {
    this.setState((d) => {
      const rung = d.ladderProgram.rungs.find((r) => r.id === rungId);
      if (!rung) return;
      rung.elements = rung.elements.filter((el) => el.id !== elementId);
      rung.branches = rung.branches.filter((br) => br.startNodeId !== elementId);
      for (const branch of rung.branches) {
        branch.elements = branch.elements.filter((el) => el.id !== elementId);
      }
      this._rebuildCrossRef(d);
    });
  }
  addBranchToRung(rungId, branch) {
    this.setState((d) => {
      const rung = d.ladderProgram.rungs.find((r) => r.id === rungId);
      if (rung) rung.branches.push(branch);
    });
  }
  addParallelBranch(rungId, anchorElId, kind, tag) {
    this.setState((d) => {
      const rung = d.ladderProgram.rungs.find((r) => r.id === rungId);
      if (!rung) return;
      const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      let newEl = null;
      if (kind.startsWith("contact")) {
        const typeMap = {
          "contact-NO": "NO",
          "contact-NC": "NC",
          "contact-P": "P_CONTACT",
          "contact-N": "N_CONTACT"
        };
        newEl = { kind: "contact", id: `contact-${uid()}`, type: typeMap[kind] ?? "NO", tag, position: { x: 0, y: 0 } };
      } else if (kind.startsWith("coil")) {
        const typeMap = {
          "coil-normal": "normal",
          "coil-negated": "negated",
          "coil-set": "set",
          "coil-reset": "reset",
          "coil-latch": "latch",
          "coil-unlatch": "unlatch"
        };
        newEl = { kind: "coil", id: `coil-${uid()}`, type: typeMap[kind] ?? "normal", tag, position: { x: 0, y: 0 } };
      } else if (kind.startsWith("block")) {
        const fbType = kind.replace("block-", "");
        newEl = { kind: "block", id: `block-${uid()}`, fbType, instanceName: "", position: { x: 0, y: 0 } };
      }
      if (!newEl) return;
      const branch = {
        id: `branch-${uid()}`,
        startNodeId: anchorElId,
        endNodeId: anchorElId,
        elements: [newEl]
      };
      rung.branches.push(branch);
      this._rebuildCrossRef(d);
    });
  }
  // ── FBD operations ──────────────────────────────────────────────────────────
  addFBDNode(node) {
    this.setState((d) => {
      d.fbdProgram.nodes.push(node);
      this._rebuildCrossRef(d);
    });
  }
  updateFBDNode(nodeId, updates) {
    this.setState((d) => {
      const node = d.fbdProgram.nodes.find((n) => n.id === nodeId);
      if (node) Object.assign(node, updates);
      this._rebuildCrossRef(d);
    });
  }
  deleteFBDNode(nodeId) {
    this.setState((d) => {
      d.fbdProgram.nodes = d.fbdProgram.nodes.filter((n) => n.id !== nodeId);
      d.fbdProgram.wires = d.fbdProgram.wires.filter((w) => w.from.nodeId !== nodeId && w.to.nodeId !== nodeId);
      this._rebuildCrossRef(d);
    });
  }
  addFBDWire(wire) {
    this.setState((d) => {
      d.fbdProgram.wires.push(wire);
    });
  }
  deleteFBDWire(wireId) {
    this.setState((d) => {
      d.fbdProgram.wires = d.fbdProgram.wires.filter((w) => w.id !== wireId);
    });
  }
  // ── SFC operations ──────────────────────────────────────────────────────────
  addSFCStep(step) {
    this.setState((d) => {
      d.sfcProgram.steps.push(step);
    });
  }
  updateSFCStep(stepId, updates) {
    this.setState((d) => {
      const step = d.sfcProgram.steps.find((s) => s.id === stepId);
      if (step) Object.assign(step, updates);
    });
  }
  deleteSFCStep(stepId) {
    this.setState((d) => {
      d.sfcProgram.steps = d.sfcProgram.steps.filter((s) => s.id !== stepId);
      d.sfcProgram.links = d.sfcProgram.links.filter((l) => l.from !== stepId && l.to !== stepId);
    });
  }
  addSFCTransition(transition) {
    this.setState((d) => {
      d.sfcProgram.transitions.push(transition);
    });
  }
  updateSFCTransition(transId, updates) {
    this.setState((d) => {
      const t = d.sfcProgram.transitions.find((t2) => t2.id === transId);
      if (t) Object.assign(t, updates);
    });
  }
  deleteSFCTransition(transId) {
    this.setState((d) => {
      d.sfcProgram.transitions = d.sfcProgram.transitions.filter((t) => t.id !== transId);
      d.sfcProgram.links = d.sfcProgram.links.filter((l) => l.from !== transId && l.to !== transId);
    });
  }
  addSFCLink(link) {
    this.setState((d) => {
      d.sfcProgram.links.push(link);
    });
  }
  deleteSFCLink(linkId) {
    this.setState((d) => {
      d.sfcProgram.links = d.sfcProgram.links.filter((l) => l.id !== linkId);
    });
  }
  addSFCBranch(branch) {
    this.setState((d) => {
      d.sfcProgram.branches.push(branch);
    });
  }
  deleteSFCBranch(branchId) {
    this.setState((d) => {
      d.sfcProgram.branches = d.sfcProgram.branches.filter((b) => b.id !== branchId);
    });
  }
  updateSFCLinkBarPosition(linkId, pos) {
    this.setState((d) => {
      const l = d.sfcProgram.links.find((l2) => l2.id === linkId);
      if (l) l.barPosition = pos;
    });
  }
  addSFCJump(jump) {
    this.setState((d) => {
      if (!d.sfcProgram.jumps) d.sfcProgram.jumps = [];
      d.sfcProgram.jumps.push(jump);
    });
  }
  updateSFCJump(jumpId, targetStepName) {
    this.setState((d) => {
      if (!d.sfcProgram.jumps) return;
      const j = d.sfcProgram.jumps.find((j2) => j2.id === jumpId);
      if (j) j.targetStepName = targetStepName;
    });
  }
  updateSFCJumpPosition(jumpId, position) {
    this.setState((d) => {
      if (!d.sfcProgram.jumps) return;
      const j = d.sfcProgram.jumps.find((j2) => j2.id === jumpId);
      if (j) j.position = position;
    });
  }
  deleteSFCJump(jumpId) {
    this.setState((d) => {
      if (!d.sfcProgram.jumps) return;
      d.sfcProgram.jumps = d.sfcProgram.jumps.filter((j) => j.id !== jumpId);
    });
  }
  // ── Selection ───────────────────────────────────────────────────────────────
  setSelection(ids, rungId) {
    this.setState((d) => {
      d.selectedElementIds = new Set(ids);
      d.selectedRungId = rungId ?? null;
    });
  }
  clearSelection() {
    this.setState((d) => {
      d.selectedElementIds = /* @__PURE__ */ new Set();
      d.selectedRungId = null;
    });
  }
  // ── Clipboard ───────────────────────────────────────────────────────────────
  copyRungs(rungIds) {
    this.setState((d) => {
      d.clipboard.rungs = d.ladderProgram.rungs.filter((r) => rungIds.includes(r.id)).map((r) => JSON.parse(JSON.stringify(r)));
    });
  }
  pasteRungs(afterIndex) {
    this.setState((d) => {
      if (!d.clipboard.rungs?.length) return;
      const newRungs = d.clipboard.rungs.map((r) => ({
        ...JSON.parse(JSON.stringify(r)),
        id: `rung-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        elements: r.elements.map((el) => ({ ...el, id: `${el.id}-p-${Date.now()}` }))
      }));
      if (afterIndex !== void 0) {
        d.ladderProgram.rungs.splice(afterIndex + 1, 0, ...newRungs);
      } else {
        d.ladderProgram.rungs.push(...newRungs);
      }
      d.ladderProgram.rungs.forEach((r, i) => {
        r.number = i + 1;
      });
    });
  }
  // ── FBD Clipboard ───────────────────────────────────────────────────────────
  copyFBDNodes(nodeIds) {
    this.setState((d) => {
      d.clipboard.fbdNodes = d.fbdProgram.nodes.filter((n) => nodeIds.includes(n.id)).map((n) => JSON.parse(JSON.stringify(n)));
    });
  }
  pasteFBDNodes(offsetX = 40, offsetY = 40) {
    this.setState((d) => {
      if (!d.clipboard.fbdNodes?.length) return;
      const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newNodes = d.clipboard.fbdNodes.map((n) => ({
        ...JSON.parse(JSON.stringify(n)),
        id: `fbd-${n.type.toLowerCase().replace(/_/g, "-")}-${uid()}`,
        position: { x: n.position.x + offsetX, y: n.position.y + offsetY },
        inputs: n.inputs.map((p) => ({ ...p, id: `${p.id}-p-${uid()}` })),
        outputs: n.outputs.map((p) => ({ ...p, id: `${p.id}-p-${uid()}` }))
      }));
      d.fbdProgram.nodes.push(...newNodes);
    });
  }
  // ── Tag database ────────────────────────────────────────────────────────────
  setTagDatabase(tags) {
    this.setState((d) => {
      d.tagDatabase = tags;
    });
  }
  createTag(tag) {
    this.setState((d) => {
      if (!d.tagDatabase.find((t) => t.name === tag.name)) {
        d.tagDatabase.push(tag);
      }
    });
  }
  updateTag(name, updates) {
    this.setState((d) => {
      const tag = d.tagDatabase.find((t) => t.name === name);
      if (tag) Object.assign(tag, updates);
    });
  }
  updateTagLiveValue(tagName, value) {
    this.setState((d) => {
      const tag = d.tagDatabase.find((t) => t.name === tagName);
      if (tag) tag.liveValue = value;
    });
  }
  clearLiveValues() {
    this.setState((d) => {
      for (const tag of d.tagDatabase) {
        tag.liveValue = void 0;
      }
      for (const rung of d.ladderProgram.rungs) {
        rung.energized = false;
        for (const el of rung.elements) el.energized = false;
        for (const branch of rung.branches) {
          branch.energized = false;
          for (const el of branch.elements) el.energized = false;
        }
      }
      for (const node of d.fbdProgram.nodes) node.energized = false;
      for (const wire of d.fbdProgram.wires) wire.energized = false;
      for (const step of d.sfcProgram.steps) step.isActive = false;
    });
  }
  _setEngineRef(engine) {
    this._engineRef = engine;
  }
  forceTag(tagName, value) {
    if (!tagName) return;
    this.setState((d) => {
      let tag = d.tagDatabase.find((t) => t.name === tagName);
      if (!tag) {
        tag = { id: `tag-${tagName}-${Date.now()}`, name: tagName, dataType: "BOOL", address: "", description: "" };
        d.tagDatabase.push(tag);
      }
      tag.forcedValue = value;
      tag.liveValue = value;
    });
    if (this._engineRef) {
      const parsed = value === "TRUE" || value === "true" ? true : value === "FALSE" || value === "false" ? false : value;
      this._engineRef.forceTag(tagName, parsed);
    }
  }
  releaseForce(tagName) {
    this.setState((d) => {
      const tag = d.tagDatabase.find((t) => t.name === tagName);
      if (tag) {
        tag.forcedValue = void 0;
        tag.liveValue = void 0;
      }
    });
    if (this._engineRef) {
      this._engineRef.releaseForce(tagName);
    }
  }
  batchUpdateTagValues(values) {
    this.setState((d) => {
      for (const [name, value] of Object.entries(values)) {
        let tag = d.tagDatabase.find((t) => t.name === name);
        if (!tag) {
          tag = { id: `tag-${name}-auto`, name, dataType: "BOOL", address: "", description: "" };
          d.tagDatabase.push(tag);
        }
        if (tag.forcedValue === void 0) tag.liveValue = String(value);
      }
    });
  }
  updateEnergizedStates(energized, blockPinValues, fbdPinValues, powerAfter) {
    this.setState((d) => {
      if (fbdPinValues) d.fbdBlockPinValues = fbdPinValues;
      for (const rung of d.ladderProgram.rungs) {
        for (const el of rung.elements) {
          el.energized = !!energized[el.id];
          if (powerAfter !== void 0) el.powerAfter = !!powerAfter[el.id];
          if (el.kind === "block" && blockPinValues) {
            const pinVals = {};
            for (const [key, val] of Object.entries(blockPinValues)) {
              if (key.startsWith(el.id + ":")) {
                const pin = key.slice(el.id.length + 1);
                pinVals[pin] = val;
              }
            }
            if (Object.keys(pinVals).length > 0) el.pinValues = pinVals;
          }
        }
        for (const branch of rung.branches) {
          for (const el of branch.elements) {
            el.energized = !!energized[el.id];
            if (powerAfter !== void 0) el.powerAfter = !!powerAfter[el.id];
            if (el.kind === "block" && blockPinValues) {
              const pinVals = {};
              for (const [key, val] of Object.entries(blockPinValues)) {
                if (key.startsWith(el.id + ":")) {
                  const pin = key.slice(el.id.length + 1);
                  pinVals[pin] = val;
                }
              }
              if (Object.keys(pinVals).length > 0) el.pinValues = pinVals;
            }
          }
        }
        const coils = rung.elements.filter((e) => e.kind === "coil");
        const lastEl = rung.elements.at(-1);
        if (coils.length > 0) {
          rung.energized = coils.some((c) => !!c.energized);
        } else {
          rung.energized = lastEl ? !!lastEl.energized : false;
        }
        for (const branch of rung.branches) {
          const lastBranchEl = branch.elements.at(-1);
          if (!lastBranchEl) {
            branch.energized = false;
            continue;
          }
          branch.energized = !!lastBranchEl.energized;
        }
      }
      for (const node of d.fbdProgram.nodes) {
        node.energized = !!energized[node.id];
      }
      for (const wire of d.fbdProgram.wires) {
        wire.energized = !!energized[wire.from.nodeId];
      }
    });
  }
  updateSFCActiveSteps(active) {
    this.setState((d) => {
      for (const step of d.sfcProgram.steps) {
        step.isActive = !!active[step.id];
      }
    });
  }
  // ── Monitor mode ─────────────────────────────────────────────────────────────
  setMonitorMode(mode) {
    this.setState((d) => {
      d.monitorMode = mode;
    });
  }
  setScanRate(ms) {
    this.setState((d) => {
      d.scanRate = ms;
    });
  }
  // ── Watch list ───────────────────────────────────────────────────────────────
  addToWatchList(tagName) {
    this.setState((d) => {
      if (!d.watchedTags.includes(tagName)) d.watchedTags.push(tagName);
    });
  }
  removeFromWatchList(tagName) {
    this.setState((d) => {
      d.watchedTags = d.watchedTags.filter((n) => n !== tagName);
    });
  }
  addAllTagsToWatchList() {
    this.setState((d) => {
      d.watchedTags = d.tagDatabase.map((t) => t.name);
    });
  }
  clearWatchList() {
    this.setState((d) => {
      d.watchedTags = [];
    });
  }
  // ── UI state ─────────────────────────────────────────────────────────────────
  setZoom(zoom) {
    this.setState((d) => {
      d.zoom = Math.max(0.25, Math.min(4, zoom));
    });
  }
  toggleGrid() {
    this.setState((d) => {
      d.showGrid = !d.showGrid;
    });
  }
  setSearchQuery(q) {
    this.setState((d) => {
      d.searchQuery = q;
    });
  }
  openCrossRef(tagName) {
    this.setState((d) => {
      d.crossRefPanelOpen = true;
      d.crossRefTarget = tagName;
    });
  }
  closeCrossRef() {
    this.setState((d) => {
      d.crossRefPanelOpen = false;
      d.crossRefTarget = null;
    });
  }
  openInspector(elementId) {
    this.setState((d) => {
      d.inspectorOpen = true;
      d.inspectorElementId = elementId;
    });
  }
  closeInspector() {
    this.setState((d) => {
      d.inspectorOpen = false;
      d.inspectorElementId = null;
    });
  }
  // ── Load programs ────────────────────────────────────────────────────────────
  setImportedSidecar(sidecar) {
    this.setState((d) => {
      d.importedSidecar = sidecar;
    });
  }
  loadLadderProgram(program) {
    this.setState((d) => {
      d.ladderProgram = program;
      this._rebuildCrossRef(d);
    });
  }
  loadFBDProgram(program) {
    this.setState((d) => {
      d.fbdProgram = program;
      this._rebuildCrossRef(d);
    });
  }
  loadSFCProgram(program) {
    this.setState((d) => {
      d.sfcProgram = program;
    });
  }
  // ── Console log ──────────────────────────────────────────────────────────────
  addConsoleEntry(level, message) {
    this.setState((d) => {
      d.consoleLog.push({ timestamp: Date.now(), level, message });
      if (d.consoleLog.length > 200) d.consoleLog.splice(0, d.consoleLog.length - 200);
    });
  }
  clearConsole() {
    this.setState((d) => {
      d.consoleLog = [];
    });
  }
  // ── Multi-POU operations ─────────────────────────────────────────────────────
  addPOU(name, language) {
    this.setState((d) => {
      const newPOU = {
        id: `pou-${Date.now()}`,
        name,
        language,
        ladderProgram: { rungs: [] },
        fbdProgram: { nodes: [], wires: [] },
        sfcProgram: { steps: [], transitions: [], links: [], branches: [], jumps: [] }
      };
      d.pous.push(newPOU);
    });
  }
  setActivePOU(id) {
    this.setState((d) => {
      const pou = d.pous.find((p) => p.id === id);
      if (!pou) return;
      d.activePouId = id;
      d.ladderProgram = pou.ladderProgram;
      d.fbdProgram = pou.fbdProgram;
      d.sfcProgram = pou.sfcProgram;
      d.activeLanguage = pou.language;
      this._rebuildCrossRef(d);
    });
  }
  deletePOU(id) {
    this.setState((d) => {
      if (d.pous.length <= 1) return;
      d.pous = d.pous.filter((p) => p.id !== id);
      if (d.activePouId === id) {
        const first = d.pous[0];
        d.activePouId = first.id;
        d.ladderProgram = first.ladderProgram;
        d.fbdProgram = first.fbdProgram;
        d.sfcProgram = first.sfcProgram;
        d.activeLanguage = first.language;
        this._rebuildCrossRef(d);
      }
    });
  }
  renamePOU(id, name) {
    this.setState((d) => {
      const pou = d.pous.find((p) => p.id === id);
      if (pou) pou.name = name;
    });
  }
  // ── Cross-reference index rebuild ────────────────────────────────────────────
  _rebuildCrossRef(d) {
    const index = /* @__PURE__ */ new Map();
    const addRef = (tagName, rungId, elementId, language) => {
      if (!tagName) return;
      if (!index.has(tagName)) index.set(tagName, []);
      index.get(tagName).push({ rungId, elementId, language });
    };
    for (const rung of d.ladderProgram.rungs) {
      for (const el of rung.elements) {
        if (el.kind === "contact" || el.kind === "coil") {
          addRef(el.tag.name, rung.id, el.id, "LD");
        } else if (el.kind === "block") {
          for (const [, tagRef] of Object.entries(el.pins)) {
            addRef(tagRef.name, rung.id, el.id, "LD");
          }
        }
      }
      for (const branch of rung.branches) {
        for (const el of branch.elements) {
          if (el.kind === "contact" || el.kind === "coil") {
            addRef(el.tag.name, rung.id, el.id, "LD");
          }
        }
      }
    }
    for (const node of d.fbdProgram.nodes) {
      if (node.tag) addRef(node.tag.name, void 0, node.id, "FBD");
    }
    d.crossRefIndex = index;
  }
}
const logicStore = new LogicStore();
import { useState, useEffect, useRef } from "react";
function useLogicStore() {
  const [state, setState] = useState(logicStore.getState());
  useEffect(() => {
    return logicStore.subscribe(setState);
  }, []);
  return state;
}
function useLogicStoreSelector(selector) {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const [value, setValue] = useState(() => selector(logicStore.getState()));
  useEffect(() => {
    return logicStore.subscribe((state) => {
      const next = selectorRef.current(state);
      setValue((prev) => Object.is(prev, next) ? prev : next);
    });
  }, []);
  return value;
}
export {
  logicStore,
  useLogicStore,
  useLogicStoreSelector
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjL3BsYy1lZGl0b3ItdHN4L2xvZ2ljU3RvcmUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qXG4gKiBQTEMgTG9naWMgRWRpdG9yIFx1MjAxNCBDZW50cmFsIFN0YXRlIFN0b3JlXG4gKiBNYW5hZ2VzIExEL0ZCRC9TRkMgZGlhZ3JhbSBzdGF0ZSwgc2VsZWN0aW9uLCBjbGlwYm9hcmQsIG1vbml0b3IgbW9kZS5cbiAqIFVzZXMgaW1tZXIgZm9yIGltbXV0YWJsZSB1cGRhdGVzIGFuZCBhIGNvbW1hbmQtcGF0dGVybiB1bmRvL3JlZG8gc3RhY2suXG4gKi9cblxuaW1wb3J0IHsgcHJvZHVjZSB9IGZyb20gJ2ltbWVyJztcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFNoYXJlZCBQcmltaXRpdmVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgdHlwZSBJRUNEYXRhVHlwZSA9XG4gIHwgJ0JPT0wnIHwgJ0lOVCcgfCAnVUlOVCcgfCAnRElOVCcgfCAnVURJTlQnIHwgJ0xJTlQnIHwgJ1VMSU5UJ1xuICB8ICdSRUFMJyB8ICdMUkVBTCcgfCAnQllURScgfCAnV09SRCcgfCAnRFdPUkQnIHwgJ0xXT1JEJ1xuICB8ICdTVFJJTkcnIHwgJ1dTVFJJTkcnIHwgJ1RJTUUnIHwgJ0RBVEUnIHwgJ1RPRCcgfCAnRFQnXG4gIHwgJ0FSUkFZX0JPT0wnIHwgJ0FSUkFZX0lOVCcgfCAnQVJSQVlfUkVBTCdcbiAgfCAnU1RSVUNUJztcblxuZXhwb3J0IGludGVyZmFjZSBQb3NpdGlvbiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH1cblxuZXhwb3J0IGludGVyZmFjZSBUYWdSZWYge1xuICBuYW1lOiBzdHJpbmc7XG4gIGFkZHJlc3M/OiBzdHJpbmc7ICAgLy8gZS5nLiBcIiVJMC4wXCIsIFwiJVEwLjFcIiwgXCIlTTAuMFwiXG4gIGRhdGFUeXBlOiBJRUNEYXRhVHlwZTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIExhZGRlciBEaWFncmFtIE1vZGVsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgdHlwZSBDb250YWN0VHlwZSA9ICdOTycgfCAnTkMnIHwgJ1BfQ09OVEFDVCcgfCAnTl9DT05UQUNUJztcbmV4cG9ydCB0eXBlIENvaWxUeXBlID0gJ25vcm1hbCcgfCAnbmVnYXRlZCcgfCAnc2V0JyB8ICdyZXNldCcgfCAnbGF0Y2gnIHwgJ3VubGF0Y2gnO1xuZXhwb3J0IHR5cGUgRkJUeXBlID0gJ1RPTicgfCAnVE9GJyB8ICdUUCcgfCAnQ1RVJyB8ICdDVEQnIHwgJ0NUVUQnIHwgJ1NSJyB8ICdSUycgfCAnUlRSSUcnIHwgJ0ZUUklHJ1xuICB8ICdFUScgfCAnTkUnIHwgJ0dUJyB8ICdHRScgfCAnTFQnIHwgJ0xFJ1xuICB8ICdBREQnIHwgJ1NVQicgfCAnTVVMJyB8ICdESVYnIHwgJ01PRCcgfCAnQUJTJyB8ICdTUVJUJ1xuICB8ICdNT1ZFJyB8ICdTRUwnIHwgJ0xJTUlUJyB8ICdNSU4nIHwgJ01BWCdcbiAgLy8gRXh0ZW5kZWQ6IFNpZW1lbnMtc3BlY2lmaWMgdGltZXJzL2NvdW50ZXJzIHdpdGggZGlyZWN0IElFQyBlcXVpdmFsZW50c1xuICB8ICdUT05SJyB8ICdJRUNfVElNRVInIHwgJ0lFQ19MVElNRVInIHwgJ0lFQ19DT1VOVEVSJyB8ICdJRUNfTENPVU5URVInXG4gIC8vIEV4dGVuZGVkOiBTaWVtZW5zIGFuYWxvZyBzY2FsaW5nIC8gbm9ybWFsaXNhdGlvblxuICB8ICdTQ0FMRScgfCAnVU5TQ0FMRScgfCAnTk9STV9YJyB8ICdTQ0FMRV9YJ1xuICAvLyBFeHRlbmRlZDogU2llbWVucyBibGluayAvIG9zY2lsbGF0b3JcbiAgfCAnQkxJTksnXG4gIC8vIEV4dGVuZGVkOiBTaWVtZW5zIElFQyB0aW1lciBjb250YWN0IChlZGdlLWJhc2VkIHRpbWVyIG91dHB1dCBjb250YWN0KVxuICB8ICdJRUNfVEMnXG4gIC8vIEV4dGVuZGVkOiBTdHJpbmcgZnVuY3Rpb25zICh1c2VkIGluIEZCRC9MRCBpbiBhbGwgdmVuZG9ycylcbiAgfCAnTEVOJyB8ICdMRUZUJyB8ICdSSUdIVCcgfCAnTUlEJyB8ICdDT05DQVQnIHwgJ0ZJTkQnIHwgJ0lOU0VSVCcgfCAnREVMRVRFJyB8ICdSRVBMQUNFJ1xuICB8ICdVUFBFUl9DQVNFJyB8ICdMT1dFUl9DQVNFJ1xuICAvLyBFeHRlbmRlZDogU2llbWVucyBjb21tdW5pY2F0aW9uIEZCcyAoc2ltcGxpZmllZCByZXByZXNlbnRhdGlvbilcbiAgfCAnU0VORCcgfCAnUkVDVicgfCAnUkRSRUMnIHwgJ1dSUkVDJ1xuICAvLyBFeHRlbmRlZDogTWF0aCBleHRlbnNpb25zXG4gIHwgJ0xOJyB8ICdMT0cnIHwgJ0VYUCcgfCAnU0lOJyB8ICdDT1MnIHwgJ1RBTicgfCAnQVNJTicgfCAnQUNPUycgfCAnQVRBTidcbiAgfCAnTkVHJyB8ICdNVUwnIHwgJ1hPUicgfCAnTk9UJyB8ICdBTkQnIHwgJ09SJ1xuICAvLyBFeHRlbmRlZDogUm9ja3dlbGwgZXh0cmFzXG4gIHwgJ01PVicgfCAnQ09QJyB8ICdGRkwnIHwgJ0ZGVScgfCAnTEZMJyB8ICdMRlUnIHwgJ1NRTycgfCAnU1FJJyB8ICdTUUwnXG4gIHwgJ1BJRCcgfCAnTVNHJyB8ICdHU1YnIHwgJ1NTVicgfCAnTElNJyB8ICdNRVEnIHwgJ01WTScgfCAnQlREJyB8ICdGTEwnIHwgJ1NJWkUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbnRhY3RFbGVtZW50IHtcbiAga2luZDogJ2NvbnRhY3QnO1xuICBpZDogc3RyaW5nO1xuICB0eXBlOiBDb250YWN0VHlwZTtcbiAgdGFnOiBUYWdSZWY7XG4gIHBvc2l0aW9uOiBQb3NpdGlvbjtcbiAgZW5lcmdpemVkPzogYm9vbGVhbjsgIC8vIG1vbml0b3IgbW9kZVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvaWxFbGVtZW50IHtcbiAga2luZDogJ2NvaWwnO1xuICBpZDogc3RyaW5nO1xuICB0eXBlOiBDb2lsVHlwZTtcbiAgdGFnOiBUYWdSZWY7XG4gIHBvc2l0aW9uOiBQb3NpdGlvbjtcbiAgZW5lcmdpemVkPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCbG9ja0VsZW1lbnQge1xuICBraW5kOiAnYmxvY2snO1xuICBpZDogc3RyaW5nO1xuICBmYlR5cGU6IEZCVHlwZTtcbiAgaW5zdGFuY2VOYW1lOiBzdHJpbmc7XG4gIHBpbnM6IFJlY29yZDxzdHJpbmcsIFRhZ1JlZj47XG4gIHBvc2l0aW9uOiBQb3NpdGlvbjtcbiAgZW5lcmdpemVkPzogYm9vbGVhbjsgICAgICAgICAgICAgICAgIC8vIG1vbml0b3IgbW9kZVxuICBwaW5WYWx1ZXM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+OyAgLy8gbW9uaXRvciBtb2RlIGxpdmUgdmFsdWVzIHBlciBvdXRwdXQgcGluXG4gIHZlbmRvck9yaWdpbmFsTmFtZT86IHN0cmluZzsgICAgICAgICAvLyBwcmVzZXJ2ZXMgZXhhY3QgdmVuZG9yIHR5cGUgbmFtZSBmb3IgbG9zc2xlc3MgZXhwb3J0IChlLmcuICdJRUNfVElNRVJfMXMnIHZzICdJRUNfVElNRVInKVxufVxuXG5leHBvcnQgdHlwZSBMYWRkZXJFbGVtZW50ID0gQ29udGFjdEVsZW1lbnQgfCBDb2lsRWxlbWVudCB8IEJsb2NrRWxlbWVudDtcblxuZXhwb3J0IGludGVyZmFjZSBCcmFuY2gge1xuICBpZDogc3RyaW5nO1xuICBzdGFydE5vZGVJZDogc3RyaW5nO1xuICBlbmROb2RlSWQ6IHN0cmluZztcbiAgZWxlbWVudHM6IExhZGRlckVsZW1lbnRbXTtcbiAgZW5lcmdpemVkPzogYm9vbGVhbjsgIC8vIG1vbml0b3IgbW9kZSBcdTIwMTQgYnJhbmNoIHBhdGggZGVsaXZlcnMgcG93ZXJcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSdW5nIHtcbiAgaWQ6IHN0cmluZztcbiAgbnVtYmVyOiBudW1iZXI7XG4gIGNvbW1lbnQ6IHN0cmluZztcbiAgZWxlbWVudHM6IExhZGRlckVsZW1lbnRbXTtcbiAgYnJhbmNoZXM6IEJyYW5jaFtdO1xuICBlbmVyZ2l6ZWQ/OiBib29sZWFuOyAgLy8gbW9uaXRvciBtb2RlIFx1MjAxNCB3aG9sZSBydW5nIHBvd2VyZWRcbiAgdmVuZG9yVHlwZT86IHN0cmluZzsgIC8vIEw1WCBydW5nIHR5cGU6IFwiTlwiIChOb3JtYWwpLCBcIlJcIiAoUm91dGluZSksIFwiRVwiIChFbXB0eSksIGV0Yy5cbn1cblxuZXhwb3J0IGludGVyZmFjZSBMYWRkZXJQcm9ncmFtIHtcbiAgcnVuZ3M6IFJ1bmdbXTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEZCRCBNb2RlbCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IHR5cGUgRkJEQmxvY2tUeXBlID1cbiAgfCAnQU5EJyB8ICdPUicgfCAnTk9UJyB8ICdYT1InIHwgJ05BTkQnIHwgJ05PUidcbiAgfCAnQUREJyB8ICdTVUInIHwgJ01VTCcgfCAnRElWJyB8ICdNT0QnIHwgJ0FCUycgfCAnU1FSVCdcbiAgfCAnR1QnIHwgJ0xUJyB8ICdHRScgfCAnTEUnIHwgJ0VRJyB8ICdORSdcbiAgfCAnVE9OJyB8ICdUT0YnIHwgJ1RQJyB8ICdDVFUnIHwgJ0NURCcgfCAnQ1RVRCcgfCAnU1InIHwgJ1JTJyB8ICdSVFJJRycgfCAnRlRSSUcnXG4gIHwgJ1NFTCcgfCAnTVVYJyB8ICdMSU1JVCcgfCAnTUlOJyB8ICdNQVgnXG4gIHwgJ01PVkUnIHwgJ0lOX1ZBUklBQkxFJyB8ICdPVVRfVkFSSUFCTEUnIHwgJ0lOT1VUX1ZBUklBQkxFJyB8ICdJTl9PVVRfVkFSSUFCTEUnXG4gIHwgJ0NPTk5FQ1RPUicgfCAnQ09OVElOVUFUSU9OJyB8ICdDT01NRU5UJ1xuICB8ICdMQUJFTCcgfCAnSlVNUCcgfCAnUkVUVVJOJ1xuICAvLyBFeHRlbmRlZDogU2llbWVucy1zcGVjaWZpYyB0aW1lcnMgLyBjb3VudGVyc1xuICB8ICdUT05SJyB8ICdJRUNfVElNRVInIHwgJ0lFQ19MVElNRVInIHwgJ0lFQ19DT1VOVEVSJyB8ICdJRUNfTENPVU5URVInXG4gIC8vIEV4dGVuZGVkOiBTaWVtZW5zIGFuYWxvZyBzY2FsaW5nIC8gbm9ybWFsaXNhdGlvblxuICB8ICdTQ0FMRScgfCAnVU5TQ0FMRScgfCAnTk9STV9YJyB8ICdTQ0FMRV9YJ1xuICAvLyBFeHRlbmRlZDogU2llbWVucyBibGluayAvIG9zY2lsbGF0b3IgLyBJRUMgdGltZXIgY29udGFjdFxuICB8ICdCTElOSycgfCAnSUVDX1RDJ1xuICAvLyBFeHRlbmRlZDogTWF0aCAodXNlZCBhY3Jvc3MgYWxsIHZlbmRvcnMpXG4gIHwgJ0xOJyB8ICdMT0cnIHwgJ0VYUCcgfCAnU0lOJyB8ICdDT1MnIHwgJ1RBTicgfCAnQVNJTicgfCAnQUNPUycgfCAnQVRBTicgfCAnTkVHJ1xuICAvLyBFeHRlbmRlZDogU3RyaW5nIGZ1bmN0aW9uc1xuICB8ICdMRU4nIHwgJ0xFRlQnIHwgJ1JJR0hUJyB8ICdNSUQnIHwgJ0NPTkNBVCcgfCAnRklORCcgfCAnSU5TRVJUJyB8ICdERUxFVEUnIHwgJ1JFUExBQ0UnXG4gIHwgJ1VQUEVSX0NBU0UnIHwgJ0xPV0VSX0NBU0UnIHwgJ1NfTEVOJyB8ICdTX0xFRlQnIHwgJ1NfUklHSFQnIHwgJ1NfTUlEJyB8ICdTX0ZJTkQnIHwgJ1NfQ09OVicgfCAnU19DT05DQVQnXG4gIC8vIEV4dGVuZGVkOiBUeXBlIGNvbnZlcnNpb25zXG4gIHwgJ0lOVF9UT19SRUFMJyB8ICdSRUFMX1RPX0lOVCcgfCAnRElOVF9UT19SRUFMJyB8ICdSRUFMX1RPX0RJTlQnIHwgJ0lOVF9UT19ESU5UJ1xuICB8ICdCT09MX1RPX0lOVCcgfCAnSU5UX1RPX0JPT0wnIHwgJ1dPUkRfVE9fSU5UJyB8ICdJTlRfVE9fV09SRCcgfCAnRFdPUkRfVE9fRElOVCcgfCAnRElOVF9UT19EV09SRCdcbiAgfCAnVElNRV9UT19ESU5UJyB8ICdESU5UX1RPX1RJTUUnXG4gIHwgJ1JPVU5EJyB8ICdUUlVOQycgfCAnQ0VJTCcgfCAnRkxPT1InIHwgJ0NPTlZFUlQnXG4gIC8vIEV4dGVuZGVkOiBTaWVtZW5zIGNvbW11bmljYXRpb24gRkJzXG4gIHwgJ1NFTkQnIHwgJ1JFQ1YnIHwgJ1JEUkVDJyB8ICdXUlJFQydcbiAgLy8gRXh0ZW5kZWQ6IFJvY2t3ZWxsLXNwZWNpZmljXG4gIHwgJ01PVicgfCAnQ09QJyB8ICdGRkwnIHwgJ0ZGVScgfCAnTEZMJyB8ICdMRlUnIHwgJ1NRTycgfCAnU1FJJyB8ICdTUUwnXG4gIHwgJ1BJRCcgfCAnTVNHJyB8ICdHU1YnIHwgJ1NTVicgfCAnTElNJyB8ICdNRVEnIHwgJ01WTScgfCAnQlREJyB8ICdTSVpFJztcblxuZXhwb3J0IGludGVyZmFjZSBQaW4ge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIGRhdGFUeXBlOiBJRUNEYXRhVHlwZTtcbiAgbmVnYXRlZD86IGJvb2xlYW47XG4gIHZhbHVlPzogc3RyaW5nOyAgLy8gbW9uaXRvciBtb2RlXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRkJETm9kZSB7XG4gIGlkOiBzdHJpbmc7XG4gIHR5cGU6IEZCREJsb2NrVHlwZTtcbiAgbGFiZWw/OiBzdHJpbmc7ICAgICAgICAgIC8vIGNvbm5lY3Rvci9jb250aW51YXRpb24gbGFiZWxcbiAgaW5zdGFuY2VOYW1lPzogc3RyaW5nOyAgIC8vIGZ1bmN0aW9uLWJsb2NrIGluc3RhbmNlIG5hbWVcbiAgY29udGVudD86IHN0cmluZzsgICAgICAgIC8vIGNvbW1lbnQgdGV4dFxuICBwb3NpdGlvbjogUG9zaXRpb247XG4gIHNpemU/OiB7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH07ICAvLyBjb21tZW50IG5vZGVzIGFyZSByZXNpemFibGVcbiAgaW5wdXRzOiBQaW5bXTtcbiAgb3V0cHV0czogUGluW107XG4gIHRhZz86IFRhZ1JlZjsgIC8vIGZvciB2YXJpYWJsZSBub2Rlc1xuICBuZWdhdGVkPzogYm9vbGVhbjsgIC8vIGZvciB2YXJpYWJsZSBub2RlcyAoaW5WYXJpYWJsZS9vdXRWYXJpYWJsZSBuZWdhdGlvbilcbiAgZXhlY3V0aW9uT3JkZXJJZD86IG51bWJlcjsgIC8vIFRDNjogZXhlY3V0aW9uIG9yZGVyIGZvciBibG9ja3NcbiAgdmVuZG9yT3JpZ2luYWxOYW1lPzogc3RyaW5nOyAgLy8gZXhhY3QgdmVuZG9yIHR5cGUgc3RyaW5nIGZvciBsb3NzbGVzcyBleHBvcnQgcm91bmQtdHJpcFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEZCRFdpcmUge1xuICBpZDogc3RyaW5nO1xuICBmcm9tOiB7IG5vZGVJZDogc3RyaW5nOyBwaW46IHN0cmluZyB9O1xuICB0bzogeyBub2RlSWQ6IHN0cmluZzsgcGluOiBzdHJpbmcgfTtcbiAgbmVnYXRlZD86IGJvb2xlYW47XG4gIGVuZXJnaXplZD86IGJvb2xlYW47ICAvLyBtb25pdG9yIG1vZGVcbn1cblxuZXhwb3J0IGludGVyZmFjZSBGQkRQcm9ncmFtIHtcbiAgbm9kZXM6IEZCRE5vZGVbXTtcbiAgd2lyZXM6IEZCRFdpcmVbXTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFNGQyBNb2RlbCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLy8gQWxsIDExIElFQyA2MTEzMS0zIFx1MDBBNzYuOC4zIHF1YWxpZmllcnNcbmV4cG9ydCB0eXBlIEFjdGlvblF1YWxpZmllciA9ICdOJyB8ICdTJyB8ICdSJyB8ICdQJyB8ICdQMScgfCAnUDAnIHwgJ0wnIHwgJ0QnIHwgJ1NEJyB8ICdEUycgfCAnU0wnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNGQ0FjdGlvbiB7XG4gIGlkOiBzdHJpbmc7XG4gIHF1YWxpZmllcjogQWN0aW9uUXVhbGlmaWVyO1xuICB0YWc6IFRhZ1JlZjtcbiAgZHVyYXRpb24/OiBzdHJpbmc7ICAvLyBmb3IgdGltZWQgcXVhbGlmaWVycyBMLCBELCBTRCwgRFMsIFNMXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU0ZDU3RlcCB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgaXNJbml0aWFsOiBib29sZWFuO1xuICBhY3Rpb25zOiBTRkNBY3Rpb25bXTtcbiAgcG9zaXRpb246IFBvc2l0aW9uO1xuICBpc0FjdGl2ZT86IGJvb2xlYW47ICAvLyBtb25pdG9yIG1vZGVcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTRkNUcmFuc2l0aW9uIHtcbiAgaWQ6IHN0cmluZztcbiAgY29uZGl0aW9uOiBzdHJpbmc7ICAvLyBTVCBib29sZWFuIGV4cHJlc3Npb25cbiAgcG9zaXRpb246IFBvc2l0aW9uO1xuICBwcmlvcml0eT86IG51bWJlcjsgIC8vIGZvciBPUi1icmFuY2ggZXZhbHVhdGlvbiBvcmRlclxuICBpc1RydWU/OiBib29sZWFuOyAgIC8vIG1vbml0b3IgbW9kZVxufVxuXG5leHBvcnQgdHlwZSBTRkNMaW5rVHlwZSA9XG4gIHwgJ3NpbXBsZSdcbiAgfCAnc2VsZWN0aW9uLWRpdmVyZ2VuY2UnXG4gIHwgJ3NlbGVjdGlvbi1jb252ZXJnZW5jZSdcbiAgfCAnc2ltdWx0YW5lb3VzLWRpdmVyZ2VuY2UnXG4gIHwgJ3NpbXVsdGFuZW91cy1jb252ZXJnZW5jZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU0ZDTGluayB7XG4gIGlkOiBzdHJpbmc7XG4gIGZyb206IHN0cmluZztcbiAgdG86IHN0cmluZztcbiAgdHlwZTogU0ZDTGlua1R5cGU7XG4gIC8vIE9ubHkgdXNlZCBmb3IgZGl2ZXJnZW5jZS9jb252ZXJnZW5jZSBiYXIgbm9kZXMgXHUyMDE0IHBvc2l0aW9uIG9mIHRoZSB2aXN1YWwgYmFyIG5vZGUgb24gY2FudmFzXG4gIGJhclBvc2l0aW9uPzogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9O1xufVxuXG4vLyBPUiBicmFuY2ggPSBzaW5nbGUgYmFyIChvbmx5IG9uZSBmaXJlcyk7IEFORCBicmFuY2ggPSBkb3VibGUgYmFyIChhbGwgZmlyZSBzaW11bHRhbmVvdXNseSlcbmV4cG9ydCBpbnRlcmZhY2UgU0ZDQnJhbmNoIHtcbiAgaWQ6IHN0cmluZztcbiAgdHlwZTogJ09SJyB8ICdBTkQnO1xuICBkaXZlcmdpbmdGcm9tVHJhbnNJZDogc3RyaW5nOyAgIC8vIHRyYW5zaXRpb24gdGhhdCBmYW5zIE9VVFxuICBicmFuY2hTdGVwSWRzOiBzdHJpbmdbXVtdOyAgICAgIC8vIGVhY2ggaW5uZXIgYXJyYXkgPSBzdGVwIGlkcyBhbG9uZyB0aGF0IGJyYW5jaFxuICBjb252ZXJnaW5nVG9UcmFuc0lkOiBzdHJpbmc7ICAgIC8vIHRyYW5zaXRpb24gdGhhdCBmYW5zIElOXG59XG5cbi8vIEp1bXAtdG8tc3RlcCBjb25uZWN0b3I6IGEgdGVybWluYWwgbm9kZSB0aGF0IHJlcHJlc2VudHMgYSBiYWNrd2FyZCBhcmMgdG8gYSBuYW1lZCBzdGVwLlxuLy8gV2hlbiB0aGUgZmxvdyByZWFjaGVzIHRoaXMgbm9kZSwgZXhlY3V0aW9uIGNvbnRpbnVlcyBmcm9tIHRoZSBuYW1lZCB0YXJnZXQgc3RlcC5cbmV4cG9ydCBpbnRlcmZhY2UgU0ZDSnVtcCB7XG4gIGlkOiBzdHJpbmc7XG4gIHRhcmdldFN0ZXBOYW1lOiBzdHJpbmc7ICAvLyBuYW1lIG9mIHRoZSBzdGVwIHRvIGp1bXAgdG9cbiAgcG9zaXRpb246IFBvc2l0aW9uO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNGQ1Byb2dyYW0ge1xuICBzdGVwczogU0ZDU3RlcFtdO1xuICB0cmFuc2l0aW9uczogU0ZDVHJhbnNpdGlvbltdO1xuICBsaW5rczogU0ZDTGlua1tdO1xuICBicmFuY2hlczogU0ZDQnJhbmNoW107XG4gIGp1bXBzOiBTRkNKdW1wW107XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBUYWcgRGF0YWJhc2UgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFnRW50cnkge1xuICBuYW1lOiBzdHJpbmc7XG4gIGFkZHJlc3M6IHN0cmluZztcbiAgZGF0YVR5cGU6IElFQ0RhdGFUeXBlO1xuICBkZXNjcmlwdGlvbj86IHN0cmluZztcbiAgcmV0YWluPzogYm9vbGVhbjsgICAgICAgLy8gUkVUQUlOIHF1YWxpZmllciBcdTIwMTQgdmFsdWUgc3Vydml2ZXMgcG93ZXIgY3ljbGVcbiAgaW5pdGlhbFZhbHVlPzogc3RyaW5nOyAgLy8gaW5pdGlhbC9kZWZhdWx0IHZhbHVlIGF0IHByb2dyYW0gc3RhcnRcbiAgZm9yY2VkVmFsdWU/OiBzdHJpbmc7ICAgLy8gbnVsbCA9IG5vdCBmb3JjZWRcbiAgbGl2ZVZhbHVlPzogc3RyaW5nOyAgICAgLy8gbW9uaXRvciBtb2RlXG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBQT1UgKFByb2dyYW0gT3JnYW5pemF0aW9uIFVuaXQpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgaW50ZXJmYWNlIFBPVSB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgbGFuZ3VhZ2U6ICdMRCcgfCAnRkJEJyB8ICdTRkMnO1xuICBsYWRkZXJQcm9ncmFtOiBMYWRkZXJQcm9ncmFtO1xuICBmYmRQcm9ncmFtOiBGQkRQcm9ncmFtO1xuICBzZmNQcm9ncmFtOiBTRkNQcm9ncmFtO1xuICByZXRhaW4/OiBib29sZWFuO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgTG9naWMgU3RvcmUgU3RhdGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCB0eXBlIEVkaXRvckxhbmd1YWdlID0gJ0xEJyB8ICdGQkQnIHwgJ1NGQyc7XG5leHBvcnQgdHlwZSBNb25pdG9yTW9kZSA9ICdzdG9wcGVkJyB8ICdydW5uaW5nJyB8ICdwYXVzZWQnIHwgJ3N0ZXBwaW5nJztcblxuZXhwb3J0IGludGVyZmFjZSBMb2dpY1N0b3JlU3RhdGUge1xuICBhY3RpdmVMYW5ndWFnZTogRWRpdG9yTGFuZ3VhZ2U7XG5cbiAgLy8gRGlhZ3JhbSBtb2RlbHNcbiAgbGFkZGVyUHJvZ3JhbTogTGFkZGVyUHJvZ3JhbTtcbiAgZmJkUHJvZ3JhbTogRkJEUHJvZ3JhbTtcbiAgc2ZjUHJvZ3JhbTogU0ZDUHJvZ3JhbTtcblxuICAvLyBTZWxlY3Rpb25cbiAgc2VsZWN0ZWRFbGVtZW50SWRzOiBTZXQ8c3RyaW5nPjtcbiAgc2VsZWN0ZWRSdW5nSWQ6IHN0cmluZyB8IG51bGw7XG5cbiAgLy8gQ2xpcGJvYXJkXG4gIGNsaXBib2FyZDoge1xuICAgIHJ1bmdzPzogUnVuZ1tdO1xuICAgIGVsZW1lbnRzPzogTGFkZGVyRWxlbWVudFtdO1xuICAgIGZiZE5vZGVzPzogRkJETm9kZVtdO1xuICAgIHNmY1N0ZXBzPzogU0ZDU3RlcFtdO1xuICB9O1xuXG4gIC8vIFRhZyBkYXRhYmFzZSAobG9hZGVkIGZyb20gd29ya3NwYWNlIHRhZyBzdG9yZSlcbiAgdGFnRGF0YWJhc2U6IFRhZ0VudHJ5W107XG5cbiAgLy8gQ3Jvc3MtcmVmZXJlbmNlOiB0YWdOYW1lIFx1MjE5MiBsaXN0IG9mIChydW5nSWQsIGVsZW1lbnRJZClcbiAgY3Jvc3NSZWZJbmRleDogTWFwPHN0cmluZywgQXJyYXk8eyBydW5nSWQ/OiBzdHJpbmc7IGVsZW1lbnRJZDogc3RyaW5nOyBsYW5ndWFnZTogRWRpdG9yTGFuZ3VhZ2UgfT4+O1xuXG4gIC8vIE1vbml0b3IgbW9kZVxuICBtb25pdG9yTW9kZTogTW9uaXRvck1vZGU7XG4gIHNjYW5SYXRlOiBudW1iZXI7ICAvLyBtc1xuXG4gIC8vIFRhZyBNb25pdG9yIHdhdGNoIGxpc3QgXHUyMDE0IHN1YnNldCBvZiB0YWdEYXRhYmFzZSBuYW1lcyB0aGUgdXNlciBoYXMgcGlubmVkXG4gIHdhdGNoZWRUYWdzOiBzdHJpbmdbXTtcblxuICAvLyBVSSBzdGF0ZVxuICB6b29tOiBudW1iZXI7XG4gIHNob3dHcmlkOiBib29sZWFuO1xuICBzZWFyY2hRdWVyeTogc3RyaW5nO1xuICBjcm9zc1JlZlBhbmVsT3BlbjogYm9vbGVhbjtcbiAgY3Jvc3NSZWZUYXJnZXQ6IHN0cmluZyB8IG51bGw7XG4gIGluc3BlY3Rvck9wZW46IGJvb2xlYW47XG4gIGluc3BlY3RvckVsZW1lbnRJZDogc3RyaW5nIHwgbnVsbDtcblxuICAvLyBGQkQgYmxvY2sgb3V0cHV0IHBpbiBsaXZlIHZhbHVlczogaW5zdGFuY2VLZXkgXHUyMTkyIHsgcGluTmFtZSBcdTIxOTIgdmFsdWUgfVxuICBmYmRCbG9ja1BpblZhbHVlczogUmVjb3JkPHN0cmluZywgUmVjb3JkPHN0cmluZywgc3RyaW5nPj47XG5cbiAgLy8gQ29uc29sZSBvdXRwdXQgbG9nXG4gIGNvbnNvbGVMb2c6IEFycmF5PHsgdGltZXN0YW1wOiBudW1iZXI7IGxldmVsOiAnaW5mbycgfCAnd2FybicgfCAnZXJyb3InIHwgJ3N1Y2Nlc3MnOyBtZXNzYWdlOiBzdHJpbmcgfT47XG5cbiAgLy8gTXVsdGktUE9VIHN1cHBvcnQgKGZvdW5kYXRpb24gXHUyMDE0IGV4aXN0aW5nIHRvcC1sZXZlbCBmaWVsZHMgcmVtYWluIGFzIGFjdGl2ZSBQT1UpXG4gIHBvdXM6IFBPVVtdO1xuICBhY3RpdmVQb3VJZDogc3RyaW5nO1xuXG4gIC8vIFNpZGVjYXIgZnJvbSBsYXN0IHZlbmRvciBpbXBvcnQgXHUyMDE0IHVzZWQgYnkgZXhwb3J0IHRhYiBmb3IgbG9zc2xlc3Mgcm91bmQtdHJpcFxuICBpbXBvcnRlZFNpZGVjYXI6IGltcG9ydCgnLi92ZW5kb3IvdHlwZXMuanMnKS5WZW5kb3JNZXRhZGF0YVNpZGVjYXIgfCBudWxsO1xufVxuXG5jb25zdCBjcmVhdGVJbml0aWFsTGFkZGVyID0gKCk6IExhZGRlclByb2dyYW0gPT4gKHtcbiAgcnVuZ3M6IFtcbiAgICB7XG4gICAgICBpZDogJ3J1bmctMScsXG4gICAgICBudW1iZXI6IDEsXG4gICAgICBjb21tZW50OiAnTW90b3Igc3RhcnQvc3RvcCBjaXJjdWl0JyxcbiAgICAgIGVsZW1lbnRzOiBbXG4gICAgICAgIHsga2luZDogJ2NvbnRhY3QnLCBpZDogJ2VsLTEnLCB0eXBlOiAnTk8nLCB0YWc6IHsgbmFtZTogJ1BCX1NUQVJUJywgZGF0YVR5cGU6ICdCT09MJyB9LCBwb3NpdGlvbjogeyB4OiAwLCB5OiAwIH0gfSxcbiAgICAgICAgeyBraW5kOiAnY29udGFjdCcsIGlkOiAnZWwtMicsIHR5cGU6ICdOQycsIHRhZzogeyBuYW1lOiAnUEJfU1RPUCcsIGRhdGFUeXBlOiAnQk9PTCcgfSwgcG9zaXRpb246IHsgeDogNjAsIHk6IDAgfSB9LFxuICAgICAgICB7IGtpbmQ6ICdjb250YWN0JywgaWQ6ICdlbC0zJywgdHlwZTogJ05DJywgdGFnOiB7IG5hbWU6ICdPVkVSTE9BRCcsIGRhdGFUeXBlOiAnQk9PTCcgfSwgcG9zaXRpb246IHsgeDogMTIwLCB5OiAwIH0gfSxcbiAgICAgICAgeyBraW5kOiAnY29pbCcsIGlkOiAnZWwtNCcsIHR5cGU6ICdub3JtYWwnLCB0YWc6IHsgbmFtZTogJ01PVE9SX1JVTicsIGRhdGFUeXBlOiAnQk9PTCcgfSwgcG9zaXRpb246IHsgeDogMTgwLCB5OiAwIH0gfSxcbiAgICAgIF0sXG4gICAgICBicmFuY2hlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdicmFuY2gtMScsXG4gICAgICAgICAgc3RhcnROb2RlSWQ6ICdlbC0xJyxcbiAgICAgICAgICBlbmROb2RlSWQ6ICdlbC0yJyxcbiAgICAgICAgICBlbGVtZW50czogW1xuICAgICAgICAgICAgeyBraW5kOiAnY29udGFjdCcsIGlkOiAnZWwtNScsIHR5cGU6ICdOTycsIHRhZzogeyBuYW1lOiAnTU9UT1JfUlVOJywgZGF0YVR5cGU6ICdCT09MJyB9LCBwb3NpdGlvbjogeyB4OiAwLCB5OiAwIH0gfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9XG4gICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdydW5nLTInLFxuICAgICAgbnVtYmVyOiAyLFxuICAgICAgY29tbWVudDogJ01vdG9yIHJ1biB0aW1lcicsXG4gICAgICBlbGVtZW50czogW1xuICAgICAgICB7IGtpbmQ6ICdjb250YWN0JywgaWQ6ICdlbC02JywgdHlwZTogJ05PJywgdGFnOiB7IG5hbWU6ICdNT1RPUl9SVU4nLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHBvc2l0aW9uOiB7IHg6IDAsIHk6IDAgfSB9LFxuICAgICAgICB7IGtpbmQ6ICdibG9jaycsIGlkOiAnZWwtNycsIGZiVHlwZTogJ1RPTicsIGluc3RhbmNlTmFtZTogJ1JVTl9UTVInLCBwaW5zOiB7IElOOiB7IG5hbWU6ICdNT1RPUl9SVU4nLCBkYXRhVHlwZTogJ0JPT0wnIH0sIFBUOiB7IG5hbWU6ICdUIzEwcycsIGRhdGFUeXBlOiAnVElNRScgfSB9LCBwb3NpdGlvbjogeyB4OiA2MCwgeTogMCB9IH0sXG4gICAgICAgIHsga2luZDogJ2NvaWwnLCBpZDogJ2VsLTgnLCB0eXBlOiAnc2V0JywgdGFnOiB7IG5hbWU6ICdSVU5fVElNRU9VVCcsIGRhdGFUeXBlOiAnQk9PTCcgfSwgcG9zaXRpb246IHsgeDogMTgwLCB5OiAwIH0gfSxcbiAgICAgIF0sXG4gICAgICBicmFuY2hlczogW10sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ3J1bmctMycsXG4gICAgICBudW1iZXI6IDMsXG4gICAgICBjb21tZW50OiAnRmF1bHQgcmVzZXQnLFxuICAgICAgZWxlbWVudHM6IFtcbiAgICAgICAgeyBraW5kOiAnY29udGFjdCcsIGlkOiAnZWwtOScsIHR5cGU6ICdOTycsIHRhZzogeyBuYW1lOiAnRkFVTFRfUkVTRVQnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHBvc2l0aW9uOiB7IHg6IDAsIHk6IDAgfSB9LFxuICAgICAgICB7IGtpbmQ6ICdjb2lsJywgaWQ6ICdlbC0xMCcsIHR5cGU6ICdyZXNldCcsIHRhZzogeyBuYW1lOiAnUlVOX1RJTUVPVVQnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHBvc2l0aW9uOiB7IHg6IDYwLCB5OiAwIH0gfSxcbiAgICAgIF0sXG4gICAgICBicmFuY2hlczogW10sXG4gICAgfSxcbiAgXVxufSk7XG5cbmNvbnN0IGNyZWF0ZUluaXRpYWxGQkQgPSAoKTogRkJEUHJvZ3JhbSA9PiAoe1xuICBub2RlczogW1xuICAgIHtcbiAgICAgIGlkOiAnZmJkLWlucHV0LTEnLFxuICAgICAgdHlwZTogJ0lOX1ZBUklBQkxFJyBhcyBGQkRCbG9ja1R5cGUsXG4gICAgICBwb3NpdGlvbjogeyB4OiA2MCwgeTogODAgfSxcbiAgICAgIGlucHV0czogW10sXG4gICAgICBvdXRwdXRzOiBbeyBpZDogJ291dC1vdXRwdXQtdmFyaWFibGUtMCcsIG5hbWU6ICdvdXRwdXQtdmFyaWFibGUnLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICAgICAgdGFnOiB7IG5hbWU6ICdQQl9TVEFSVCcsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnZmJkLWlucHV0LTInLFxuICAgICAgdHlwZTogJ0lOX1ZBUklBQkxFJyBhcyBGQkRCbG9ja1R5cGUsXG4gICAgICBwb3NpdGlvbjogeyB4OiA2MCwgeTogMTgwIH0sXG4gICAgICBpbnB1dHM6IFtdLFxuICAgICAgb3V0cHV0czogW3sgaWQ6ICdvdXQtb3V0cHV0LXZhcmlhYmxlLTAnLCBuYW1lOiAnb3V0cHV0LXZhcmlhYmxlJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICAgIHRhZzogeyBuYW1lOiAnUEJfU1RPUCcsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnZmJkLWFuZC0xJyxcbiAgICAgIHR5cGU6ICdBTkQnIGFzIEZCREJsb2NrVHlwZSxcbiAgICAgIHBvc2l0aW9uOiB7IHg6IDI4MCwgeTogMTAwIH0sXG4gICAgICBpbnN0YW5jZU5hbWU6ICdhbmQxJyxcbiAgICAgIGlucHV0czogW3sgaWQ6ICdpbi1JTjEtMCcsIG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgaWQ6ICdpbi1JTjItMScsIG5hbWU6ICdJTjInLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICAgICAgb3V0cHV0czogW3sgaWQ6ICdvdXQtT1VULTAnLCBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnZmJkLXRvbi0xJyxcbiAgICAgIHR5cGU6ICdUT04nIGFzIEZCREJsb2NrVHlwZSxcbiAgICAgIHBvc2l0aW9uOiB7IHg6IDUwMCwgeTogOTAgfSxcbiAgICAgIGluc3RhbmNlTmFtZTogJ1JVTl9UTVInLFxuICAgICAgaW5wdXRzOiBbeyBpZDogJ2luLUlOLTAnLCBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgaWQ6ICdpbi1QVC0xJywgbmFtZTogJ1BUJywgZGF0YVR5cGU6ICdUSU1FJyB9XSxcbiAgICAgIG91dHB1dHM6IFt7IGlkOiAnb3V0LVEtMCcsIG5hbWU6ICdRJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IGlkOiAnb3V0LUVULTEnLCBuYW1lOiAnRVQnLCBkYXRhVHlwZTogJ1RJTUUnIH1dLFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdmYmQtb3V0cHV0LTEnLFxuICAgICAgdHlwZTogJ09VVF9WQVJJQUJMRScgYXMgRkJEQmxvY2tUeXBlLFxuICAgICAgcG9zaXRpb246IHsgeDogNzIwLCB5OiAxMTAgfSxcbiAgICAgIGlucHV0czogW3sgaWQ6ICdpbi1pbnB1dC12YXJpYWJsZS0wJywgbmFtZTogJ2lucHV0LXZhcmlhYmxlJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICAgIG91dHB1dHM6IFtdLFxuICAgICAgdGFnOiB7IG5hbWU6ICdNT1RPUl9SVU4nLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgfSxcbiAgXSxcbiAgd2lyZXM6IFtcbiAgICB7IGlkOiAnZmJkLXcxJywgZnJvbTogeyBub2RlSWQ6ICdmYmQtaW5wdXQtMScsIHBpbjogJ291dHB1dC12YXJpYWJsZScgfSwgdG86IHsgbm9kZUlkOiAnZmJkLWFuZC0xJywgcGluOiAnSU4xJyB9IH0sXG4gICAgeyBpZDogJ2ZiZC13MicsIGZyb206IHsgbm9kZUlkOiAnZmJkLWlucHV0LTInLCBwaW46ICdvdXRwdXQtdmFyaWFibGUnIH0sIHRvOiB7IG5vZGVJZDogJ2ZiZC1hbmQtMScsIHBpbjogJ0lOMicgfSB9LFxuICAgIHsgaWQ6ICdmYmQtdzMnLCBmcm9tOiB7IG5vZGVJZDogJ2ZiZC1hbmQtMScsICAgcGluOiAnT1VUJyB9LCAgICAgICAgICAgICB0bzogeyBub2RlSWQ6ICdmYmQtdG9uLTEnLCAgICBwaW46ICdJTicgfSB9LFxuICAgIHsgaWQ6ICdmYmQtdzQnLCBmcm9tOiB7IG5vZGVJZDogJ2ZiZC10b24tMScsICAgcGluOiAnUScgfSwgICAgICAgICAgICAgICB0bzogeyBub2RlSWQ6ICdmYmQtb3V0cHV0LTEnLCBwaW46ICdpbnB1dC12YXJpYWJsZScgfSB9LFxuICBdLFxufSk7XG5cbmNvbnN0IGNyZWF0ZUluaXRpYWxTRkMgPSAoKTogU0ZDUHJvZ3JhbSA9PiAoe1xuICBzdGVwczogW1xuICAgIHtcbiAgICAgIGlkOiAnc3RlcC1pbml0aWFsJyxcbiAgICAgIG5hbWU6ICdJbml0JyxcbiAgICAgIGlzSW5pdGlhbDogdHJ1ZSxcbiAgICAgIGFjdGlvbnM6IFt7IGlkOiAnYTEnLCBxdWFsaWZpZXI6ICdOJywgdGFnOiB7IG5hbWU6ICdSRVNFVF9BTEwnLCBkYXRhVHlwZTogJ0JPT0wnIH0gfV0sXG4gICAgICBwb3NpdGlvbjogeyB4OiAxMDAsIHk6IDYwIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ3N0ZXAtcnVuJyxcbiAgICAgIG5hbWU6ICdSdW5uaW5nJyxcbiAgICAgIGlzSW5pdGlhbDogZmFsc2UsXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgIHsgaWQ6ICdhMicsIHF1YWxpZmllcjogJ04nLCB0YWc6IHsgbmFtZTogJ01PVE9SX09OJywgZGF0YVR5cGU6ICdCT09MJyB9IH0sXG4gICAgICAgIHsgaWQ6ICdhMycsIHF1YWxpZmllcjogJ0QnLCB0YWc6IHsgbmFtZTogJ1NUQVJUX1RNUicsIGRhdGFUeXBlOiAnQk9PTCcgfSwgZHVyYXRpb246ICdUIzVzJyB9LFxuICAgICAgXSxcbiAgICAgIHBvc2l0aW9uOiB7IHg6IDEwMCwgeTogMjYwIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ3N0ZXAtc3RvcCcsXG4gICAgICBuYW1lOiAnU3RvcHBlZCcsXG4gICAgICBpc0luaXRpYWw6IGZhbHNlLFxuICAgICAgYWN0aW9uczogW3sgaWQ6ICdhNCcsIHF1YWxpZmllcjogJ04nLCB0YWc6IHsgbmFtZTogJ01PVE9SX09GRicsIGRhdGFUeXBlOiAnQk9PTCcgfSB9XSxcbiAgICAgIHBvc2l0aW9uOiB7IHg6IDEwMCwgeTogNDgwIH0sXG4gICAgfSxcbiAgXSxcbiAgdHJhbnNpdGlvbnM6IFtcbiAgICB7XG4gICAgICBpZDogJ3RyYW5zLTAnLFxuICAgICAgY29uZGl0aW9uOiAnUEJfU1RBUlQnLFxuICAgICAgcG9zaXRpb246IHsgeDogMTAwLCB5OiAxODAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAndHJhbnMtMScsXG4gICAgICBjb25kaXRpb246ICdQQl9TVE9QIE9SIFRJTUVPVVQnLFxuICAgICAgcG9zaXRpb246IHsgeDogMTAwLCB5OiA0MDAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAndHJhbnMtMicsXG4gICAgICBjb25kaXRpb246ICdUUlVFJyxcbiAgICAgIHBvc2l0aW9uOiB7IHg6IDEwMCwgeTogNjIwIH0sXG4gICAgfSxcbiAgXSxcbiAgbGlua3M6IFtcbiAgICB7IGlkOiAnbGluay0wJywgZnJvbTogJ3N0ZXAtaW5pdGlhbCcsIHRvOiAndHJhbnMtMCcsIHR5cGU6ICdzaW1wbGUnIH0sXG4gICAgeyBpZDogJ2xpbmstMScsIGZyb206ICd0cmFucy0wJywgdG86ICdzdGVwLXJ1bicsIHR5cGU6ICdzaW1wbGUnIH0sXG4gICAgeyBpZDogJ2xpbmstMicsIGZyb206ICdzdGVwLXJ1bicsIHRvOiAndHJhbnMtMScsIHR5cGU6ICdzaW1wbGUnIH0sXG4gICAgeyBpZDogJ2xpbmstMycsIGZyb206ICd0cmFucy0xJywgdG86ICdzdGVwLXN0b3AnLCB0eXBlOiAnc2ltcGxlJyB9LFxuICAgIHsgaWQ6ICdsaW5rLTQnLCBmcm9tOiAnc3RlcC1zdG9wJywgdG86ICd0cmFucy0yJywgdHlwZTogJ3NpbXBsZScgfSxcbiAgICB7IGlkOiAnbGluay01JywgZnJvbTogJ3RyYW5zLTInLCB0bzogJ3N0ZXAtaW5pdGlhbCcsIHR5cGU6ICdzaW1wbGUnIH0sXG4gIF0sXG4gIGJyYW5jaGVzOiBbXSxcbiAganVtcHM6IFtdLFxufSk7XG5cbmNvbnN0IF9pbml0aWFsTGFkZGVyID0gY3JlYXRlSW5pdGlhbExhZGRlcigpO1xuY29uc3QgX2luaXRpYWxGQkQgICAgPSBjcmVhdGVJbml0aWFsRkJEKCk7XG5jb25zdCBfaW5pdGlhbFNGQyAgICA9IGNyZWF0ZUluaXRpYWxTRkMoKTtcblxuY29uc3QgaW5pdGlhbFN0YXRlOiBMb2dpY1N0b3JlU3RhdGUgPSB7XG4gIGFjdGl2ZUxhbmd1YWdlOiAnTEQnLFxuICBsYWRkZXJQcm9ncmFtOiBfaW5pdGlhbExhZGRlcixcbiAgZmJkUHJvZ3JhbTogX2luaXRpYWxGQkQsXG4gIHNmY1Byb2dyYW06IF9pbml0aWFsU0ZDLFxuICBzZWxlY3RlZEVsZW1lbnRJZHM6IG5ldyBTZXQoKSxcbiAgc2VsZWN0ZWRSdW5nSWQ6IG51bGwsXG4gIGNsaXBib2FyZDoge30sXG4gIHRhZ0RhdGFiYXNlOiBbXG4gICAgeyBuYW1lOiAnUEJfU1RBUlQnLCAgICBhZGRyZXNzOiAnJUkwLjAnLCBkYXRhVHlwZTogJ0JPT0wnLCBkZXNjcmlwdGlvbjogJ1N0YXJ0IHB1c2hidXR0b24nIH0sXG4gICAgeyBuYW1lOiAnUEJfU1RPUCcsICAgICBhZGRyZXNzOiAnJUkwLjEnLCBkYXRhVHlwZTogJ0JPT0wnLCBkZXNjcmlwdGlvbjogJ1N0b3AgcHVzaGJ1dHRvbicgfSxcbiAgICB7IG5hbWU6ICdPVkVSTE9BRCcsICAgIGFkZHJlc3M6ICclSTAuMicsIGRhdGFUeXBlOiAnQk9PTCcsIGRlc2NyaXB0aW9uOiAnTW90b3Igb3ZlcmxvYWQgcmVsYXknIH0sXG4gICAgeyBuYW1lOiAnTU9UT1JfUlVOJywgICBhZGRyZXNzOiAnJVEwLjAnLCBkYXRhVHlwZTogJ0JPT0wnLCBkZXNjcmlwdGlvbjogJ01vdG9yIGNvbnRhY3RvciBvdXRwdXQnIH0sXG4gICAgeyBuYW1lOiAnRkFVTFRfUkVTRVQnLCBhZGRyZXNzOiAnJUkwLjMnLCBkYXRhVHlwZTogJ0JPT0wnLCBkZXNjcmlwdGlvbjogJ0ZhdWx0IHJlc2V0IGJ1dHRvbicgfSxcbiAgICB7IG5hbWU6ICdSVU5fVElNRU9VVCcsIGFkZHJlc3M6ICclTTAuMCcsIGRhdGFUeXBlOiAnQk9PTCcsIGRlc2NyaXB0aW9uOiAnTW90b3IgcnVuIHRpbWVvdXQgZmxhZycgfSxcbiAgXSxcbiAgY3Jvc3NSZWZJbmRleDogbmV3IE1hcCgpLFxuICBtb25pdG9yTW9kZTogJ3N0b3BwZWQnLFxuICBzY2FuUmF0ZTogMTAsXG4gIHdhdGNoZWRUYWdzOiBbXSxcbiAgem9vbTogMSxcbiAgc2hvd0dyaWQ6IHRydWUsXG4gIHNlYXJjaFF1ZXJ5OiAnJyxcbiAgY3Jvc3NSZWZQYW5lbE9wZW46IGZhbHNlLFxuICBjcm9zc1JlZlRhcmdldDogbnVsbCxcbiAgaW5zcGVjdG9yT3BlbjogZmFsc2UsXG4gIGluc3BlY3RvckVsZW1lbnRJZDogbnVsbCxcbiAgZmJkQmxvY2tQaW5WYWx1ZXM6IHt9LFxuICBjb25zb2xlTG9nOiBbXSxcbiAgcG91czogW3tcbiAgICBpZDogJ3BvdS1tYWluJyxcbiAgICBuYW1lOiAnTWFpbicsXG4gICAgbGFuZ3VhZ2U6ICdMRCcsXG4gICAgbGFkZGVyUHJvZ3JhbTogX2luaXRpYWxMYWRkZXIsXG4gICAgZmJkUHJvZ3JhbTogX2luaXRpYWxGQkQsXG4gICAgc2ZjUHJvZ3JhbTogX2luaXRpYWxTRkMsXG4gIH1dLFxuICBhY3RpdmVQb3VJZDogJ3BvdS1tYWluJyxcbiAgaW1wb3J0ZWRTaWRlY2FyOiBudWxsLFxufTtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFN0b3JlIChzaW1wbGUgcHViL3N1Yiwgbm8gZXh0ZXJuYWwgbGlicmFyeSBuZWVkZWQpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG50eXBlIExpc3RlbmVyID0gKHN0YXRlOiBMb2dpY1N0b3JlU3RhdGUpID0+IHZvaWQ7XG5cbmNsYXNzIExvZ2ljU3RvcmUge1xuICBwcml2YXRlIHN0YXRlOiBMb2dpY1N0b3JlU3RhdGUgPSB7IC4uLmluaXRpYWxTdGF0ZSwgc2VsZWN0ZWRFbGVtZW50SWRzOiBuZXcgU2V0KCksIGNyb3NzUmVmSW5kZXg6IG5ldyBNYXAoKSwgY2xpcGJvYXJkOiB7fSwgY29uc29sZUxvZzogW10sIGZiZEJsb2NrUGluVmFsdWVzOiB7fSB9O1xuICBwcml2YXRlIGxpc3RlbmVyczogU2V0PExpc3RlbmVyPiA9IG5ldyBTZXQoKTtcblxuICBnZXRTdGF0ZSgpOiBMb2dpY1N0b3JlU3RhdGUge1xuICAgIHJldHVybiB0aGlzLnN0YXRlO1xuICB9XG5cbiAgc3Vic2NyaWJlKGxpc3RlbmVyOiBMaXN0ZW5lcik6ICgpID0+IHZvaWQge1xuICAgIHRoaXMubGlzdGVuZXJzLmFkZChsaXN0ZW5lcik7XG4gICAgcmV0dXJuICgpID0+IHRoaXMubGlzdGVuZXJzLmRlbGV0ZShsaXN0ZW5lcik7XG4gIH1cblxuICBwcml2YXRlIG5vdGlmeSgpIHtcbiAgICB0aGlzLmxpc3RlbmVycy5mb3JFYWNoKGwgPT4gbCh0aGlzLnN0YXRlKSk7XG4gIH1cblxuICBzZXRTdGF0ZSh1cGRhdGVyOiAoZHJhZnQ6IExvZ2ljU3RvcmVTdGF0ZSkgPT4gdm9pZCkge1xuICAgIHRoaXMuc3RhdGUgPSBwcm9kdWNlKHRoaXMuc3RhdGUsIHVwZGF0ZXIpO1xuICAgIHRoaXMubm90aWZ5KCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgTGFuZ3VhZ2Ugc3dpdGNoaW5nIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBzZXRBY3RpdmVMYW5ndWFnZShsYW5nOiBFZGl0b3JMYW5ndWFnZSkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7IGQuYWN0aXZlTGFuZ3VhZ2UgPSBsYW5nOyB9KTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBMYWRkZXIgb3BlcmF0aW9ucyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgYWRkUnVuZyhhZnRlckluZGV4PzogbnVtYmVyKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGNvbnN0IG5ld1J1bmc6IFJ1bmcgPSB7XG4gICAgICAgIGlkOiBgcnVuZy0ke0RhdGUubm93KCl9YCxcbiAgICAgICAgbnVtYmVyOiBkLmxhZGRlclByb2dyYW0ucnVuZ3MubGVuZ3RoICsgMSxcbiAgICAgICAgY29tbWVudDogJycsXG4gICAgICAgIGVsZW1lbnRzOiBbXSxcbiAgICAgICAgYnJhbmNoZXM6IFtdLFxuICAgICAgfTtcbiAgICAgIGlmIChhZnRlckluZGV4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZC5sYWRkZXJQcm9ncmFtLnJ1bmdzLnNwbGljZShhZnRlckluZGV4ICsgMSwgMCwgbmV3UnVuZyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkLmxhZGRlclByb2dyYW0ucnVuZ3MucHVzaChuZXdSdW5nKTtcbiAgICAgIH1cbiAgICAgIC8vIHJlbnVtYmVyXG4gICAgICBkLmxhZGRlclByb2dyYW0ucnVuZ3MuZm9yRWFjaCgociwgaSkgPT4geyByLm51bWJlciA9IGkgKyAxOyB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGRlbGV0ZVJ1bmcocnVuZ0lkOiBzdHJpbmcpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgZC5sYWRkZXJQcm9ncmFtLnJ1bmdzID0gZC5sYWRkZXJQcm9ncmFtLnJ1bmdzLmZpbHRlcihyID0+IHIuaWQgIT09IHJ1bmdJZCk7XG4gICAgICBkLmxhZGRlclByb2dyYW0ucnVuZ3MuZm9yRWFjaCgociwgaSkgPT4geyByLm51bWJlciA9IGkgKyAxOyB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGR1cGxpY2F0ZVJ1bmcocnVuZ0lkOiBzdHJpbmcpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgY29uc3QgaWR4ID0gZC5sYWRkZXJQcm9ncmFtLnJ1bmdzLmZpbmRJbmRleChyID0+IHIuaWQgPT09IHJ1bmdJZCk7XG4gICAgICBpZiAoaWR4ID09PSAtMSkgcmV0dXJuO1xuICAgICAgY29uc3Qgb3JpZyA9IGQubGFkZGVyUHJvZ3JhbS5ydW5nc1tpZHhdO1xuICAgICAgLy8gRGVlcCBjbG9uZSB0aGVuIGdpdmUgZXZlcnkgaWQgYSBmcmVzaCB1bmlxdWUgc3VmZml4XG4gICAgICBjb25zdCBjb3B5OiBSdW5nID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShvcmlnKSk7XG4gICAgICBjb25zdCB1aWQgPSAoKSA9PiBgJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIsIDcpfWA7XG4gICAgICAvLyBNYXAgb2xkIGVsZW1lbnQgSURzIFx1MjE5MiBuZXcgSURzIHNvIGJyYW5jaCByZWZlcmVuY2VzIHN0YXkgY29uc2lzdGVudFxuICAgICAgY29uc3QgaWRNYXA6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgICAgIGNvcHkuZWxlbWVudHMgPSBjb3B5LmVsZW1lbnRzLm1hcChlbCA9PiB7XG4gICAgICAgIGNvbnN0IG5ld0lkID0gYCR7ZWwua2luZH0tJHt1aWQoKX1gO1xuICAgICAgICBpZE1hcFtlbC5pZF0gPSBuZXdJZDtcbiAgICAgICAgcmV0dXJuIHsgLi4uZWwsIGlkOiBuZXdJZCB9O1xuICAgICAgfSk7XG4gICAgICBjb3B5LmJyYW5jaGVzID0gY29weS5icmFuY2hlcy5tYXAoYnIgPT4gKHtcbiAgICAgICAgLi4uYnIsXG4gICAgICAgIGlkOiBgYnJhbmNoLSR7dWlkKCl9YCxcbiAgICAgICAgc3RhcnROb2RlSWQ6IGlkTWFwW2JyLnN0YXJ0Tm9kZUlkXSA/PyBici5zdGFydE5vZGVJZCxcbiAgICAgICAgZW5kTm9kZUlkOiAgIGlkTWFwW2JyLmVuZE5vZGVJZF0gICA/PyBici5lbmROb2RlSWQsXG4gICAgICAgIGVsZW1lbnRzOiBici5lbGVtZW50cy5tYXAoZWwgPT4ge1xuICAgICAgICAgIGNvbnN0IG5ld0lkID0gYCR7ZWwua2luZH0tJHt1aWQoKX1gO1xuICAgICAgICAgIHJldHVybiB7IC4uLmVsLCBpZDogbmV3SWQgfTtcbiAgICAgICAgfSksXG4gICAgICB9KSk7XG4gICAgICBjb3B5LmlkID0gYHJ1bmctJHt1aWQoKX1gO1xuICAgICAgZC5sYWRkZXJQcm9ncmFtLnJ1bmdzLnNwbGljZShpZHggKyAxLCAwLCBjb3B5KTtcbiAgICAgIGQubGFkZGVyUHJvZ3JhbS5ydW5ncy5mb3JFYWNoKChyLCBpKSA9PiB7IHIubnVtYmVyID0gaSArIDE7IH0pO1xuICAgICAgdGhpcy5fcmVidWlsZENyb3NzUmVmKGQpO1xuICAgIH0pO1xuICB9XG5cbiAgbW92ZVJ1bmcoZnJvbUlkeDogbnVtYmVyLCB0b0lkeDogbnVtYmVyKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGNvbnN0IHJ1bmdzID0gZC5sYWRkZXJQcm9ncmFtLnJ1bmdzO1xuICAgICAgY29uc3QgW21vdmVkXSA9IHJ1bmdzLnNwbGljZShmcm9tSWR4LCAxKTtcbiAgICAgIHJ1bmdzLnNwbGljZSh0b0lkeCwgMCwgbW92ZWQpO1xuICAgICAgcnVuZ3MuZm9yRWFjaCgociwgaSkgPT4geyByLm51bWJlciA9IGkgKyAxOyB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHVwZGF0ZVJ1bmdDb21tZW50KHJ1bmdJZDogc3RyaW5nLCBjb21tZW50OiBzdHJpbmcpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgY29uc3QgcnVuZyA9IGQubGFkZGVyUHJvZ3JhbS5ydW5ncy5maW5kKHIgPT4gci5pZCA9PT0gcnVuZ0lkKTtcbiAgICAgIGlmIChydW5nKSBydW5nLmNvbW1lbnQgPSBjb21tZW50O1xuICAgIH0pO1xuICB9XG5cbiAgYWRkRWxlbWVudFRvUnVuZyhydW5nSWQ6IHN0cmluZywgZWxlbWVudDogTGFkZGVyRWxlbWVudCkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBjb25zdCBydW5nID0gZC5sYWRkZXJQcm9ncmFtLnJ1bmdzLmZpbmQociA9PiByLmlkID09PSBydW5nSWQpO1xuICAgICAgaWYgKHJ1bmcpIHJ1bmcuZWxlbWVudHMucHVzaChlbGVtZW50KTtcbiAgICAgIHRoaXMuX3JlYnVpbGRDcm9zc1JlZihkKTtcbiAgICB9KTtcbiAgfVxuXG4gIHVwZGF0ZUVsZW1lbnQocnVuZ0lkOiBzdHJpbmcsIGVsZW1lbnRJZDogc3RyaW5nLCB1cGRhdGVzOiBQYXJ0aWFsPExhZGRlckVsZW1lbnQ+KSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGNvbnN0IHJ1bmcgPSBkLmxhZGRlclByb2dyYW0ucnVuZ3MuZmluZChyID0+IHIuaWQgPT09IHJ1bmdJZCk7XG4gICAgICBpZiAoIXJ1bmcpIHJldHVybjtcbiAgICAgIGNvbnN0IGlkeCA9IHJ1bmcuZWxlbWVudHMuZmluZEluZGV4KGVsID0+IGVsLmlkID09PSBlbGVtZW50SWQpO1xuICAgICAgaWYgKGlkeCAhPT0gLTEpIHtcbiAgICAgICAgT2JqZWN0LmFzc2lnbihydW5nLmVsZW1lbnRzW2lkeF0sIHVwZGF0ZXMpO1xuICAgICAgfVxuICAgICAgLy8gYWxzbyBjaGVjayBicmFuY2hlc1xuICAgICAgZm9yIChjb25zdCBicmFuY2ggb2YgcnVuZy5icmFuY2hlcykge1xuICAgICAgICBjb25zdCBiaWR4ID0gYnJhbmNoLmVsZW1lbnRzLmZpbmRJbmRleChlbCA9PiBlbC5pZCA9PT0gZWxlbWVudElkKTtcbiAgICAgICAgaWYgKGJpZHggIT09IC0xKSBPYmplY3QuYXNzaWduKGJyYW5jaC5lbGVtZW50c1tiaWR4XSwgdXBkYXRlcyk7XG4gICAgICB9XG4gICAgICB0aGlzLl9yZWJ1aWxkQ3Jvc3NSZWYoZCk7XG4gICAgfSk7XG4gIH1cblxuICBtb3ZlRWxlbWVudChydW5nSWQ6IHN0cmluZywgZnJvbUluZGV4OiBudW1iZXIsIHRvSW5kZXg6IG51bWJlcikge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBjb25zdCBydW5nID0gZC5sYWRkZXJQcm9ncmFtLnJ1bmdzLmZpbmQociA9PiByLmlkID09PSBydW5nSWQpO1xuICAgICAgaWYgKCFydW5nKSByZXR1cm47XG4gICAgICBjb25zdCBlbHMgPSBydW5nLmVsZW1lbnRzO1xuICAgICAgaWYgKGZyb21JbmRleCA8IDAgfHwgZnJvbUluZGV4ID49IGVscy5sZW5ndGgpIHJldHVybjtcbiAgICAgIGlmICh0b0luZGV4IDwgMCB8fCB0b0luZGV4ID49IGVscy5sZW5ndGgpIHJldHVybjtcbiAgICAgIGNvbnN0IFtlbF0gPSBlbHMuc3BsaWNlKGZyb21JbmRleCwgMSk7XG4gICAgICBlbHMuc3BsaWNlKHRvSW5kZXgsIDAsIGVsKTtcbiAgICAgIHRoaXMuX3JlYnVpbGRDcm9zc1JlZihkKTtcbiAgICB9KTtcbiAgfVxuXG4gIGRlbGV0ZUVsZW1lbnQocnVuZ0lkOiBzdHJpbmcsIGVsZW1lbnRJZDogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGNvbnN0IHJ1bmcgPSBkLmxhZGRlclByb2dyYW0ucnVuZ3MuZmluZChyID0+IHIuaWQgPT09IHJ1bmdJZCk7XG4gICAgICBpZiAoIXJ1bmcpIHJldHVybjtcbiAgICAgIHJ1bmcuZWxlbWVudHMgPSBydW5nLmVsZW1lbnRzLmZpbHRlcihlbCA9PiBlbC5pZCAhPT0gZWxlbWVudElkKTtcbiAgICAgIC8vIFJlbW92ZSBicmFuY2ggZWxlbWVudHMgdGhhdCByZWZlcmVuY2UgdGhlIGRlbGV0ZWQgZWxlbWVudCwgYW5kIGFsc29cbiAgICAgIC8vIHBydW5lIGFueSBicmFuY2ggd2hvc2UgYW5jaG9yIChzdGFydE5vZGVJZCkgaXMgdGhlIGRlbGV0ZWQgZWxlbWVudCBcdTIwMTRcbiAgICAgIC8vIGFuIG9ycGhhbmVkIGJyYW5jaCB3aXRoIG5vIGFuY2hvciBlbGVtZW50IHJlbmRlcnMgYXMgZGFuZ2xpbmcgd2lyZXMuXG4gICAgICBydW5nLmJyYW5jaGVzID0gcnVuZy5icmFuY2hlcy5maWx0ZXIoYnIgPT4gYnIuc3RhcnROb2RlSWQgIT09IGVsZW1lbnRJZCk7XG4gICAgICBmb3IgKGNvbnN0IGJyYW5jaCBvZiBydW5nLmJyYW5jaGVzKSB7XG4gICAgICAgIGJyYW5jaC5lbGVtZW50cyA9IGJyYW5jaC5lbGVtZW50cy5maWx0ZXIoZWwgPT4gZWwuaWQgIT09IGVsZW1lbnRJZCk7XG4gICAgICB9XG4gICAgICB0aGlzLl9yZWJ1aWxkQ3Jvc3NSZWYoZCk7XG4gICAgfSk7XG4gIH1cblxuICBhZGRCcmFuY2hUb1J1bmcocnVuZ0lkOiBzdHJpbmcsIGJyYW5jaDogQnJhbmNoKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGNvbnN0IHJ1bmcgPSBkLmxhZGRlclByb2dyYW0ucnVuZ3MuZmluZChyID0+IHIuaWQgPT09IHJ1bmdJZCk7XG4gICAgICBpZiAocnVuZykgcnVuZy5icmFuY2hlcy5wdXNoKGJyYW5jaCk7XG4gICAgfSk7XG4gIH1cblxuICBhZGRQYXJhbGxlbEJyYW5jaChydW5nSWQ6IHN0cmluZywgYW5jaG9yRWxJZDogc3RyaW5nLCBraW5kOiBzdHJpbmcsIHRhZzogeyBuYW1lOiBzdHJpbmc7IGRhdGFUeXBlOiAnQk9PTCcgfSkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBjb25zdCBydW5nID0gZC5sYWRkZXJQcm9ncmFtLnJ1bmdzLmZpbmQociA9PiByLmlkID09PSBydW5nSWQpO1xuICAgICAgaWYgKCFydW5nKSByZXR1cm47XG4gICAgICBjb25zdCB1aWQgPSAoKSA9PiBgJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIsIDkpfWA7XG4gICAgICBsZXQgbmV3RWw6IExhZGRlckVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgICAgIGlmIChraW5kLnN0YXJ0c1dpdGgoJ2NvbnRhY3QnKSkge1xuICAgICAgICBjb25zdCB0eXBlTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgICAgICdjb250YWN0LU5PJzogJ05PJywgJ2NvbnRhY3QtTkMnOiAnTkMnLFxuICAgICAgICAgICdjb250YWN0LVAnOiAnUF9DT05UQUNUJywgJ2NvbnRhY3QtTic6ICdOX0NPTlRBQ1QnLFxuICAgICAgICB9O1xuICAgICAgICBuZXdFbCA9IHsga2luZDogJ2NvbnRhY3QnLCBpZDogYGNvbnRhY3QtJHt1aWQoKX1gLCB0eXBlOiAodHlwZU1hcFtraW5kXSA/PyAnTk8nKSBhcyBhbnksIHRhZywgcG9zaXRpb246IHsgeDogMCwgeTogMCB9IH07XG4gICAgICB9IGVsc2UgaWYgKGtpbmQuc3RhcnRzV2l0aCgnY29pbCcpKSB7XG4gICAgICAgIGNvbnN0IHR5cGVNYXA6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgICAgICAgJ2NvaWwtbm9ybWFsJzogJ25vcm1hbCcsICdjb2lsLW5lZ2F0ZWQnOiAnbmVnYXRlZCcsXG4gICAgICAgICAgJ2NvaWwtc2V0JzogJ3NldCcsICdjb2lsLXJlc2V0JzogJ3Jlc2V0JyxcbiAgICAgICAgICAnY29pbC1sYXRjaCc6ICdsYXRjaCcsICdjb2lsLXVubGF0Y2gnOiAndW5sYXRjaCcsXG4gICAgICAgIH07XG4gICAgICAgIG5ld0VsID0geyBraW5kOiAnY29pbCcsIGlkOiBgY29pbC0ke3VpZCgpfWAsIHR5cGU6ICh0eXBlTWFwW2tpbmRdID8/ICdub3JtYWwnKSBhcyBhbnksIHRhZywgcG9zaXRpb246IHsgeDogMCwgeTogMCB9IH07XG4gICAgICB9IGVsc2UgaWYgKGtpbmQuc3RhcnRzV2l0aCgnYmxvY2snKSkge1xuICAgICAgICBjb25zdCBmYlR5cGUgPSBraW5kLnJlcGxhY2UoJ2Jsb2NrLScsICcnKSBhcyBhbnk7XG4gICAgICAgIG5ld0VsID0geyBraW5kOiAnYmxvY2snLCBpZDogYGJsb2NrLSR7dWlkKCl9YCwgZmJUeXBlLCBpbnN0YW5jZU5hbWU6ICcnLCBwb3NpdGlvbjogeyB4OiAwLCB5OiAwIH0gfTtcbiAgICAgIH1cbiAgICAgIGlmICghbmV3RWwpIHJldHVybjtcbiAgICAgIGNvbnN0IGJyYW5jaDogQnJhbmNoID0ge1xuICAgICAgICBpZDogYGJyYW5jaC0ke3VpZCgpfWAsXG4gICAgICAgIHN0YXJ0Tm9kZUlkOiBhbmNob3JFbElkLFxuICAgICAgICBlbmROb2RlSWQ6IGFuY2hvckVsSWQsXG4gICAgICAgIGVsZW1lbnRzOiBbbmV3RWxdLFxuICAgICAgfTtcbiAgICAgIHJ1bmcuYnJhbmNoZXMucHVzaChicmFuY2gpO1xuICAgICAgdGhpcy5fcmVidWlsZENyb3NzUmVmKGQpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIEZCRCBvcGVyYXRpb25zIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBhZGRGQkROb2RlKG5vZGU6IEZCRE5vZGUpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgZC5mYmRQcm9ncmFtLm5vZGVzLnB1c2gobm9kZSk7XG4gICAgICB0aGlzLl9yZWJ1aWxkQ3Jvc3NSZWYoZCk7XG4gICAgfSk7XG4gIH1cblxuICB1cGRhdGVGQkROb2RlKG5vZGVJZDogc3RyaW5nLCB1cGRhdGVzOiBQYXJ0aWFsPEZCRE5vZGU+KSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGNvbnN0IG5vZGUgPSBkLmZiZFByb2dyYW0ubm9kZXMuZmluZChuID0+IG4uaWQgPT09IG5vZGVJZCk7XG4gICAgICBpZiAobm9kZSkgT2JqZWN0LmFzc2lnbihub2RlLCB1cGRhdGVzKTtcbiAgICAgIHRoaXMuX3JlYnVpbGRDcm9zc1JlZihkKTtcbiAgICB9KTtcbiAgfVxuXG4gIGRlbGV0ZUZCRE5vZGUobm9kZUlkOiBzdHJpbmcpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgZC5mYmRQcm9ncmFtLm5vZGVzID0gZC5mYmRQcm9ncmFtLm5vZGVzLmZpbHRlcihuID0+IG4uaWQgIT09IG5vZGVJZCk7XG4gICAgICBkLmZiZFByb2dyYW0ud2lyZXMgPSBkLmZiZFByb2dyYW0ud2lyZXMuZmlsdGVyKHcgPT4gdy5mcm9tLm5vZGVJZCAhPT0gbm9kZUlkICYmIHcudG8ubm9kZUlkICE9PSBub2RlSWQpO1xuICAgICAgdGhpcy5fcmVidWlsZENyb3NzUmVmKGQpO1xuICAgIH0pO1xuICB9XG5cbiAgYWRkRkJEV2lyZSh3aXJlOiBGQkRXaXJlKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHsgZC5mYmRQcm9ncmFtLndpcmVzLnB1c2god2lyZSk7IH0pO1xuICB9XG5cbiAgZGVsZXRlRkJEV2lyZSh3aXJlSWQ6IHN0cmluZykge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7IGQuZmJkUHJvZ3JhbS53aXJlcyA9IGQuZmJkUHJvZ3JhbS53aXJlcy5maWx0ZXIodyA9PiB3LmlkICE9PSB3aXJlSWQpOyB9KTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBTRkMgb3BlcmF0aW9ucyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgYWRkU0ZDU3RlcChzdGVwOiBTRkNTdGVwKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHsgZC5zZmNQcm9ncmFtLnN0ZXBzLnB1c2goc3RlcCk7IH0pO1xuICB9XG5cbiAgdXBkYXRlU0ZDU3RlcChzdGVwSWQ6IHN0cmluZywgdXBkYXRlczogUGFydGlhbDxTRkNTdGVwPikge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBjb25zdCBzdGVwID0gZC5zZmNQcm9ncmFtLnN0ZXBzLmZpbmQocyA9PiBzLmlkID09PSBzdGVwSWQpO1xuICAgICAgaWYgKHN0ZXApIE9iamVjdC5hc3NpZ24oc3RlcCwgdXBkYXRlcyk7XG4gICAgfSk7XG4gIH1cblxuICBkZWxldGVTRkNTdGVwKHN0ZXBJZDogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGQuc2ZjUHJvZ3JhbS5zdGVwcyA9IGQuc2ZjUHJvZ3JhbS5zdGVwcy5maWx0ZXIocyA9PiBzLmlkICE9PSBzdGVwSWQpO1xuICAgICAgZC5zZmNQcm9ncmFtLmxpbmtzID0gZC5zZmNQcm9ncmFtLmxpbmtzLmZpbHRlcihsID0+IGwuZnJvbSAhPT0gc3RlcElkICYmIGwudG8gIT09IHN0ZXBJZCk7XG4gICAgfSk7XG4gIH1cblxuICBhZGRTRkNUcmFuc2l0aW9uKHRyYW5zaXRpb246IFNGQ1RyYW5zaXRpb24pIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4geyBkLnNmY1Byb2dyYW0udHJhbnNpdGlvbnMucHVzaCh0cmFuc2l0aW9uKTsgfSk7XG4gIH1cblxuICB1cGRhdGVTRkNUcmFuc2l0aW9uKHRyYW5zSWQ6IHN0cmluZywgdXBkYXRlczogUGFydGlhbDxTRkNUcmFuc2l0aW9uPikge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBjb25zdCB0ID0gZC5zZmNQcm9ncmFtLnRyYW5zaXRpb25zLmZpbmQodCA9PiB0LmlkID09PSB0cmFuc0lkKTtcbiAgICAgIGlmICh0KSBPYmplY3QuYXNzaWduKHQsIHVwZGF0ZXMpO1xuICAgIH0pO1xuICB9XG5cbiAgZGVsZXRlU0ZDVHJhbnNpdGlvbih0cmFuc0lkOiBzdHJpbmcpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgZC5zZmNQcm9ncmFtLnRyYW5zaXRpb25zID0gZC5zZmNQcm9ncmFtLnRyYW5zaXRpb25zLmZpbHRlcih0ID0+IHQuaWQgIT09IHRyYW5zSWQpO1xuICAgICAgZC5zZmNQcm9ncmFtLmxpbmtzID0gZC5zZmNQcm9ncmFtLmxpbmtzLmZpbHRlcihsID0+IGwuZnJvbSAhPT0gdHJhbnNJZCAmJiBsLnRvICE9PSB0cmFuc0lkKTtcbiAgICB9KTtcbiAgfVxuXG4gIGFkZFNGQ0xpbmsobGluazogU0ZDTGluaykge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7IGQuc2ZjUHJvZ3JhbS5saW5rcy5wdXNoKGxpbmspOyB9KTtcbiAgfVxuXG4gIGRlbGV0ZVNGQ0xpbmsobGlua0lkOiBzdHJpbmcpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4geyBkLnNmY1Byb2dyYW0ubGlua3MgPSBkLnNmY1Byb2dyYW0ubGlua3MuZmlsdGVyKGwgPT4gbC5pZCAhPT0gbGlua0lkKTsgfSk7XG4gIH1cblxuICBhZGRTRkNCcmFuY2goYnJhbmNoOiBTRkNCcmFuY2gpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4geyBkLnNmY1Byb2dyYW0uYnJhbmNoZXMucHVzaChicmFuY2gpOyB9KTtcbiAgfVxuXG4gIGRlbGV0ZVNGQ0JyYW5jaChicmFuY2hJZDogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHsgZC5zZmNQcm9ncmFtLmJyYW5jaGVzID0gZC5zZmNQcm9ncmFtLmJyYW5jaGVzLmZpbHRlcihiID0+IGIuaWQgIT09IGJyYW5jaElkKTsgfSk7XG4gIH1cblxuICB1cGRhdGVTRkNMaW5rQmFyUG9zaXRpb24obGlua0lkOiBzdHJpbmcsIHBvczogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9KSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGNvbnN0IGwgPSBkLnNmY1Byb2dyYW0ubGlua3MuZmluZChsID0+IGwuaWQgPT09IGxpbmtJZCk7XG4gICAgICBpZiAobCkgbC5iYXJQb3NpdGlvbiA9IHBvcztcbiAgICB9KTtcbiAgfVxuXG4gIGFkZFNGQ0p1bXAoanVtcDogU0ZDSnVtcCkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBpZiAoIWQuc2ZjUHJvZ3JhbS5qdW1wcykgZC5zZmNQcm9ncmFtLmp1bXBzID0gW107XG4gICAgICBkLnNmY1Byb2dyYW0uanVtcHMucHVzaChqdW1wKTtcbiAgICB9KTtcbiAgfVxuXG4gIHVwZGF0ZVNGQ0p1bXAoanVtcElkOiBzdHJpbmcsIHRhcmdldFN0ZXBOYW1lOiBzdHJpbmcpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgaWYgKCFkLnNmY1Byb2dyYW0uanVtcHMpIHJldHVybjtcbiAgICAgIGNvbnN0IGogPSBkLnNmY1Byb2dyYW0uanVtcHMuZmluZChqID0+IGouaWQgPT09IGp1bXBJZCk7XG4gICAgICBpZiAoaikgai50YXJnZXRTdGVwTmFtZSA9IHRhcmdldFN0ZXBOYW1lO1xuICAgIH0pO1xuICB9XG5cbiAgdXBkYXRlU0ZDSnVtcFBvc2l0aW9uKGp1bXBJZDogc3RyaW5nLCBwb3NpdGlvbjogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9KSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGlmICghZC5zZmNQcm9ncmFtLmp1bXBzKSByZXR1cm47XG4gICAgICBjb25zdCBqID0gZC5zZmNQcm9ncmFtLmp1bXBzLmZpbmQoaiA9PiBqLmlkID09PSBqdW1wSWQpO1xuICAgICAgaWYgKGopIGoucG9zaXRpb24gPSBwb3NpdGlvbjtcbiAgICB9KTtcbiAgfVxuXG4gIGRlbGV0ZVNGQ0p1bXAoanVtcElkOiBzdHJpbmcpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgaWYgKCFkLnNmY1Byb2dyYW0uanVtcHMpIHJldHVybjtcbiAgICAgIGQuc2ZjUHJvZ3JhbS5qdW1wcyA9IGQuc2ZjUHJvZ3JhbS5qdW1wcy5maWx0ZXIoaiA9PiBqLmlkICE9PSBqdW1wSWQpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFNlbGVjdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgc2V0U2VsZWN0aW9uKGlkczogc3RyaW5nW10sIHJ1bmdJZD86IHN0cmluZykge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBkLnNlbGVjdGVkRWxlbWVudElkcyA9IG5ldyBTZXQoaWRzKTtcbiAgICAgIGQuc2VsZWN0ZWRSdW5nSWQgPSBydW5nSWQgPz8gbnVsbDtcbiAgICB9KTtcbiAgfVxuXG4gIGNsZWFyU2VsZWN0aW9uKCkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBkLnNlbGVjdGVkRWxlbWVudElkcyA9IG5ldyBTZXQoKTtcbiAgICAgIGQuc2VsZWN0ZWRSdW5nSWQgPSBudWxsO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIENsaXBib2FyZCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgY29weVJ1bmdzKHJ1bmdJZHM6IHN0cmluZ1tdKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGQuY2xpcGJvYXJkLnJ1bmdzID0gZC5sYWRkZXJQcm9ncmFtLnJ1bmdzLmZpbHRlcihyID0+IHJ1bmdJZHMuaW5jbHVkZXMoci5pZCkpXG4gICAgICAgIC5tYXAociA9PiBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHIpKSk7XG4gICAgfSk7XG4gIH1cblxuICBwYXN0ZVJ1bmdzKGFmdGVySW5kZXg/OiBudW1iZXIpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgaWYgKCFkLmNsaXBib2FyZC5ydW5ncz8ubGVuZ3RoKSByZXR1cm47XG4gICAgICBjb25zdCBuZXdSdW5ncyA9IGQuY2xpcGJvYXJkLnJ1bmdzLm1hcChyID0+ICh7XG4gICAgICAgIC4uLkpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkocikpLFxuICAgICAgICBpZDogYHJ1bmctJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpfWAsXG4gICAgICAgIGVsZW1lbnRzOiByLmVsZW1lbnRzLm1hcChlbCA9PiAoeyAuLi5lbCwgaWQ6IGAke2VsLmlkfS1wLSR7RGF0ZS5ub3coKX1gIH0pKSxcbiAgICAgIH0pKTtcbiAgICAgIGlmIChhZnRlckluZGV4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZC5sYWRkZXJQcm9ncmFtLnJ1bmdzLnNwbGljZShhZnRlckluZGV4ICsgMSwgMCwgLi4ubmV3UnVuZ3MpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZC5sYWRkZXJQcm9ncmFtLnJ1bmdzLnB1c2goLi4ubmV3UnVuZ3MpO1xuICAgICAgfVxuICAgICAgZC5sYWRkZXJQcm9ncmFtLnJ1bmdzLmZvckVhY2goKHIsIGkpID0+IHsgci5udW1iZXIgPSBpICsgMTsgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgRkJEIENsaXBib2FyZCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgY29weUZCRE5vZGVzKG5vZGVJZHM6IHN0cmluZ1tdKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGQuY2xpcGJvYXJkLmZiZE5vZGVzID0gZC5mYmRQcm9ncmFtLm5vZGVzXG4gICAgICAgIC5maWx0ZXIobiA9PiBub2RlSWRzLmluY2x1ZGVzKG4uaWQpKVxuICAgICAgICAubWFwKG4gPT4gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShuKSkpO1xuICAgIH0pO1xuICB9XG5cbiAgcGFzdGVGQkROb2RlcyhvZmZzZXRYID0gNDAsIG9mZnNldFkgPSA0MCkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBpZiAoIWQuY2xpcGJvYXJkLmZiZE5vZGVzPy5sZW5ndGgpIHJldHVybjtcbiAgICAgIGNvbnN0IHVpZCA9ICgpID0+IGAke0RhdGUubm93KCl9LSR7TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMiwgNyl9YDtcbiAgICAgIGNvbnN0IG5ld05vZGVzID0gZC5jbGlwYm9hcmQuZmJkTm9kZXMubWFwKG4gPT4gKHtcbiAgICAgICAgLi4uSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShuKSksXG4gICAgICAgIGlkOiBgZmJkLSR7bi50eXBlLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvXy9nLCAnLScpfS0ke3VpZCgpfWAsXG4gICAgICAgIHBvc2l0aW9uOiB7IHg6IG4ucG9zaXRpb24ueCArIG9mZnNldFgsIHk6IG4ucG9zaXRpb24ueSArIG9mZnNldFkgfSxcbiAgICAgICAgaW5wdXRzOiAgbi5pbnB1dHMubWFwKChwOiBQaW4pICA9PiAoeyAuLi5wLCBpZDogYCR7cC5pZH0tcC0ke3VpZCgpfWAgfSkpLFxuICAgICAgICBvdXRwdXRzOiBuLm91dHB1dHMubWFwKChwOiBQaW4pID0+ICh7IC4uLnAsIGlkOiBgJHtwLmlkfS1wLSR7dWlkKCl9YCB9KSksXG4gICAgICB9KSk7XG4gICAgICBkLmZiZFByb2dyYW0ubm9kZXMucHVzaCguLi5uZXdOb2Rlcyk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgVGFnIGRhdGFiYXNlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBzZXRUYWdEYXRhYmFzZSh0YWdzOiBUYWdFbnRyeVtdKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHsgZC50YWdEYXRhYmFzZSA9IHRhZ3M7IH0pO1xuICB9XG5cbiAgY3JlYXRlVGFnKHRhZzogVGFnRW50cnkpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgaWYgKCFkLnRhZ0RhdGFiYXNlLmZpbmQodCA9PiB0Lm5hbWUgPT09IHRhZy5uYW1lKSkge1xuICAgICAgICBkLnRhZ0RhdGFiYXNlLnB1c2godGFnKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHVwZGF0ZVRhZyhuYW1lOiBzdHJpbmcsIHVwZGF0ZXM6IFBhcnRpYWw8VGFnRW50cnk+KSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGNvbnN0IHRhZyA9IGQudGFnRGF0YWJhc2UuZmluZCh0ID0+IHQubmFtZSA9PT0gbmFtZSk7XG4gICAgICBpZiAodGFnKSBPYmplY3QuYXNzaWduKHRhZywgdXBkYXRlcyk7XG4gICAgfSk7XG4gIH1cblxuICB1cGRhdGVUYWdMaXZlVmFsdWUodGFnTmFtZTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGNvbnN0IHRhZyA9IGQudGFnRGF0YWJhc2UuZmluZCh0ID0+IHQubmFtZSA9PT0gdGFnTmFtZSk7XG4gICAgICBpZiAodGFnKSB0YWcubGl2ZVZhbHVlID0gdmFsdWU7XG4gICAgfSk7XG4gIH1cblxuICBjbGVhckxpdmVWYWx1ZXMoKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGZvciAoY29uc3QgdGFnIG9mIGQudGFnRGF0YWJhc2UpIHtcbiAgICAgICAgdGFnLmxpdmVWYWx1ZSA9IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICAgIC8vIENsZWFyIGFsbCBlbGVtZW50IGVuZXJnaXplZCBzdGF0ZXNcbiAgICAgIGZvciAoY29uc3QgcnVuZyBvZiBkLmxhZGRlclByb2dyYW0ucnVuZ3MpIHtcbiAgICAgICAgcnVuZy5lbmVyZ2l6ZWQgPSBmYWxzZTtcbiAgICAgICAgZm9yIChjb25zdCBlbCBvZiBydW5nLmVsZW1lbnRzKSAoZWwgYXMgYW55KS5lbmVyZ2l6ZWQgPSBmYWxzZTtcbiAgICAgICAgZm9yIChjb25zdCBicmFuY2ggb2YgcnVuZy5icmFuY2hlcykge1xuICAgICAgICAgIGJyYW5jaC5lbmVyZ2l6ZWQgPSBmYWxzZTtcbiAgICAgICAgICBmb3IgKGNvbnN0IGVsIG9mIGJyYW5jaC5lbGVtZW50cykgKGVsIGFzIGFueSkuZW5lcmdpemVkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3Qgbm9kZSBvZiBkLmZiZFByb2dyYW0ubm9kZXMpIChub2RlIGFzIGFueSkuZW5lcmdpemVkID0gZmFsc2U7XG4gICAgICBmb3IgKGNvbnN0IHdpcmUgb2YgZC5mYmRQcm9ncmFtLndpcmVzKSB3aXJlLmVuZXJnaXplZCA9IGZhbHNlO1xuICAgICAgZm9yIChjb25zdCBzdGVwIG9mIGQuc2ZjUHJvZ3JhbS5zdGVwcykgKHN0ZXAgYXMgYW55KS5pc0FjdGl2ZSA9IGZhbHNlO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfZW5naW5lUmVmOiBhbnkgPSBudWxsO1xuICBfc2V0RW5naW5lUmVmKGVuZ2luZTogYW55KSB7IHRoaXMuX2VuZ2luZVJlZiA9IGVuZ2luZTsgfVxuXG4gIGZvcmNlVGFnKHRhZ05hbWU6IHN0cmluZywgdmFsdWU6IHN0cmluZykge1xuICAgIGlmICghdGFnTmFtZSkgcmV0dXJuO1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBsZXQgdGFnID0gZC50YWdEYXRhYmFzZS5maW5kKHQgPT4gdC5uYW1lID09PSB0YWdOYW1lKTtcbiAgICAgIGlmICghdGFnKSB7XG4gICAgICAgIC8vIEF1dG8tY3JlYXRlIHRhZyBpZiByZWZlcmVuY2VkIGJ5IGFuIGVsZW1lbnQgYnV0IG5vdCB5ZXQgaW4gdGhlIGRhdGFiYXNlXG4gICAgICAgIHRhZyA9IHsgaWQ6IGB0YWctJHt0YWdOYW1lfS0ke0RhdGUubm93KCl9YCwgbmFtZTogdGFnTmFtZSwgZGF0YVR5cGU6ICdCT09MJywgYWRkcmVzczogJycsIGRlc2NyaXB0aW9uOiAnJyB9O1xuICAgICAgICBkLnRhZ0RhdGFiYXNlLnB1c2godGFnKTtcbiAgICAgIH1cbiAgICAgIHRhZy5mb3JjZWRWYWx1ZSA9IHZhbHVlO1xuICAgICAgdGFnLmxpdmVWYWx1ZSA9IHZhbHVlO1xuICAgIH0pO1xuICAgIC8vIEFsd2F5cyBwdXNoIHRoZSBmb3JjZWQgdmFsdWUgdG8gdGhlIGVuZ2luZSByZWdhcmRsZXNzIG9mIHJ1biBzdGF0ZS5cbiAgICAvLyBUaGUgZW5naW5lIHdpbGwgYXBwbHkgaXQgdG8gdGFnVmFsdWVzIGltbWVkaWF0ZWx5IGFuZCByZWNvbXB1dGUgZW5lcmdpemVkXG4gICAgLy8gc3RhdGVzIHNvIHRoZSBncmFwaGljYWwgZWRpdG9yIGNhbnZhcyB1cGRhdGVzIGV2ZW4gd2hlbiBzaW11bGF0aW9uIGlzIHN0b3BwZWQuXG4gICAgaWYgKHRoaXMuX2VuZ2luZVJlZikge1xuICAgICAgY29uc3QgcGFyc2VkID0gdmFsdWUgPT09ICdUUlVFJyB8fCB2YWx1ZSA9PT0gJ3RydWUnID8gdHJ1ZSA6IHZhbHVlID09PSAnRkFMU0UnIHx8IHZhbHVlID09PSAnZmFsc2UnID8gZmFsc2UgOiB2YWx1ZTtcbiAgICAgIHRoaXMuX2VuZ2luZVJlZi5mb3JjZVRhZyh0YWdOYW1lLCBwYXJzZWQpO1xuICAgIH1cbiAgfVxuXG4gIHJlbGVhc2VGb3JjZSh0YWdOYW1lOiBzdHJpbmcpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgY29uc3QgdGFnID0gZC50YWdEYXRhYmFzZS5maW5kKHQgPT4gdC5uYW1lID09PSB0YWdOYW1lKTtcbiAgICAgIGlmICh0YWcpIHsgdGFnLmZvcmNlZFZhbHVlID0gdW5kZWZpbmVkOyB0YWcubGl2ZVZhbHVlID0gdW5kZWZpbmVkOyB9XG4gICAgfSk7XG4gICAgaWYgKHRoaXMuX2VuZ2luZVJlZikge1xuICAgICAgdGhpcy5fZW5naW5lUmVmLnJlbGVhc2VGb3JjZSh0YWdOYW1lKTtcbiAgICB9XG4gIH1cblxuICBiYXRjaFVwZGF0ZVRhZ1ZhbHVlcyh2YWx1ZXM6IFJlY29yZDxzdHJpbmcsIGFueT4pIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgZm9yIChjb25zdCBbbmFtZSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHZhbHVlcykpIHtcbiAgICAgICAgbGV0IHRhZyA9IGQudGFnRGF0YWJhc2UuZmluZCh0ID0+IHQubmFtZSA9PT0gbmFtZSk7XG4gICAgICAgIGlmICghdGFnKSB7XG4gICAgICAgICAgdGFnID0geyBpZDogYHRhZy0ke25hbWV9LWF1dG9gLCBuYW1lLCBkYXRhVHlwZTogJ0JPT0wnLCBhZGRyZXNzOiAnJywgZGVzY3JpcHRpb246ICcnIH07XG4gICAgICAgICAgZC50YWdEYXRhYmFzZS5wdXNoKHRhZyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gU2tpcCBsaXZlVmFsdWUgdXBkYXRlIGZvciBmb3JjZWQgdGFncyBcdTIwMTQgZm9yY2VkIHZhbHVlIHRha2VzIHByZWNlZGVuY2VcbiAgICAgICAgaWYgKHRhZy5mb3JjZWRWYWx1ZSA9PT0gdW5kZWZpbmVkKSB0YWcubGl2ZVZhbHVlID0gU3RyaW5nKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHVwZGF0ZUVuZXJnaXplZFN0YXRlcyhlbmVyZ2l6ZWQ6IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+LCBibG9ja1BpblZhbHVlcz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sIGZiZFBpblZhbHVlcz86IFJlY29yZDxzdHJpbmcsIFJlY29yZDxzdHJpbmcsIHN0cmluZz4+LCBwb3dlckFmdGVyPzogUmVjb3JkPHN0cmluZywgYm9vbGVhbj4pIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgaWYgKGZiZFBpblZhbHVlcykgZC5mYmRCbG9ja1BpblZhbHVlcyA9IGZiZFBpblZhbHVlcztcbiAgICAgIGZvciAoY29uc3QgcnVuZyBvZiBkLmxhZGRlclByb2dyYW0ucnVuZ3MpIHtcbiAgICAgICAgZm9yIChjb25zdCBlbCBvZiBydW5nLmVsZW1lbnRzKSB7XG4gICAgICAgICAgKGVsIGFzIGFueSkuZW5lcmdpemVkID0gISFlbmVyZ2l6ZWRbZWwuaWRdO1xuICAgICAgICAgIGlmIChwb3dlckFmdGVyICE9PSB1bmRlZmluZWQpIChlbCBhcyBhbnkpLnBvd2VyQWZ0ZXIgPSAhIXBvd2VyQWZ0ZXJbZWwuaWRdO1xuICAgICAgICAgIC8vIFBvcHVsYXRlIHBlci1waW4gb3V0cHV0IHZhbHVlcyBmb3IgRkIgYmxvY2tzXG4gICAgICAgICAgaWYgKGVsLmtpbmQgPT09ICdibG9jaycgJiYgYmxvY2tQaW5WYWx1ZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IHBpblZhbHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsXSBvZiBPYmplY3QuZW50cmllcyhibG9ja1BpblZhbHVlcykpIHtcbiAgICAgICAgICAgICAgaWYgKGtleS5zdGFydHNXaXRoKGVsLmlkICsgJzonKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBpbiA9IGtleS5zbGljZShlbC5pZC5sZW5ndGggKyAxKTtcbiAgICAgICAgICAgICAgICBwaW5WYWxzW3Bpbl0gPSB2YWw7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhwaW5WYWxzKS5sZW5ndGggPiAwKSBlbC5waW5WYWx1ZXMgPSBwaW5WYWxzO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IGJyYW5jaCBvZiBydW5nLmJyYW5jaGVzKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBlbCBvZiBicmFuY2guZWxlbWVudHMpIHtcbiAgICAgICAgICAgIChlbCBhcyBhbnkpLmVuZXJnaXplZCA9ICEhZW5lcmdpemVkW2VsLmlkXTtcbiAgICAgICAgICAgIGlmIChwb3dlckFmdGVyICE9PSB1bmRlZmluZWQpIChlbCBhcyBhbnkpLnBvd2VyQWZ0ZXIgPSAhIXBvd2VyQWZ0ZXJbZWwuaWRdO1xuICAgICAgICAgICAgaWYgKGVsLmtpbmQgPT09ICdibG9jaycgJiYgYmxvY2tQaW5WYWx1ZXMpIHtcbiAgICAgICAgICAgICAgY29uc3QgcGluVmFsczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbF0gb2YgT2JqZWN0LmVudHJpZXMoYmxvY2tQaW5WYWx1ZXMpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGtleS5zdGFydHNXaXRoKGVsLmlkICsgJzonKSkge1xuICAgICAgICAgICAgICAgICAgY29uc3QgcGluID0ga2V5LnNsaWNlKGVsLmlkLmxlbmd0aCArIDEpO1xuICAgICAgICAgICAgICAgICAgcGluVmFsc1twaW5dID0gdmFsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMocGluVmFscykubGVuZ3RoID4gMCkgZWwucGluVmFsdWVzID0gcGluVmFscztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gUnVuZyBpcyBlbmVyZ2l6ZWQgd2hlbiBBTlkgY29pbCByZWNlaXZlcyBwb3dlci5cbiAgICAgICAgLy8gQ29pbCBlbmVyZ2l6ZWQgPSBwb3dlckluIHRvIGNvaWwuIElmIG5vIGNvaWwsIGNoZWNrIGxhc3QgY29udGFjdC5cbiAgICAgICAgY29uc3QgY29pbHMgPSBydW5nLmVsZW1lbnRzLmZpbHRlcihlID0+IGUua2luZCA9PT0gJ2NvaWwnKTtcbiAgICAgICAgY29uc3QgbGFzdEVsID0gcnVuZy5lbGVtZW50cy5hdCgtMSk7XG4gICAgICAgIGlmIChjb2lscy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgcnVuZy5lbmVyZ2l6ZWQgPSBjb2lscy5zb21lKGMgPT4gISEoYyBhcyBhbnkpLmVuZXJnaXplZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcnVuZy5lbmVyZ2l6ZWQgPSBsYXN0RWwgPyAhIShsYXN0RWwgYXMgYW55KS5lbmVyZ2l6ZWQgOiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBCcmFuY2ggYmFyIGNvbG9yID0gZGlkIHBvd2VyIGZsb3cgVEhST1VHSCB0aGUgYnJhbmNoP1xuICAgICAgICAvLyBVc2UgZW5lcmdpemVkW2xhc3RCcmFuY2hFbF0gXHUyMDE0IHRoaXMgaXMgc291cmNlUmVhY2hhYmxlICYmIGVkZ2VDb25kdWN0cywgd2hpY2ggaXMgdHJ1ZSBvbmx5XG4gICAgICAgIC8vIHdoZW4gcG93ZXIgYXJyaXZlZCBhdCB0aGUgYnJhbmNoIGVudHJ5IEFORCB0aGUgbGFzdCBlbGVtZW50IHBhc3NlZCBpdC4gcG93ZXJBZnRlciBpcyB3cm9uZ1xuICAgICAgICAvLyBoZXJlIGJlY2F1c2UgdGhlIHRhcmdldCBqdW5jdGlvbiBjYW4gYmUgcmVhY2hlZCB2aWEgdGhlIG1haW4gcmFpbCwgZ2l2aW5nIGEgZmFsc2UgcG9zaXRpdmUuXG4gICAgICAgIGZvciAoY29uc3QgYnJhbmNoIG9mIHJ1bmcuYnJhbmNoZXMpIHtcbiAgICAgICAgICBjb25zdCBsYXN0QnJhbmNoRWwgPSBicmFuY2guZWxlbWVudHMuYXQoLTEpO1xuICAgICAgICAgIGlmICghbGFzdEJyYW5jaEVsKSB7IGJyYW5jaC5lbmVyZ2l6ZWQgPSBmYWxzZTsgY29udGludWU7IH1cbiAgICAgICAgICBicmFuY2guZW5lcmdpemVkID0gISEobGFzdEJyYW5jaEVsIGFzIGFueSkuZW5lcmdpemVkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IG5vZGUgb2YgZC5mYmRQcm9ncmFtLm5vZGVzKSB7XG4gICAgICAgIChub2RlIGFzIGFueSkuZW5lcmdpemVkID0gISFlbmVyZ2l6ZWRbbm9kZS5pZF07XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IHdpcmUgb2YgZC5mYmRQcm9ncmFtLndpcmVzKSB7XG4gICAgICAgIHdpcmUuZW5lcmdpemVkID0gISFlbmVyZ2l6ZWRbd2lyZS5mcm9tLm5vZGVJZF07XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICB1cGRhdGVTRkNBY3RpdmVTdGVwcyhhY3RpdmU6IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+KSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGZvciAoY29uc3Qgc3RlcCBvZiBkLnNmY1Byb2dyYW0uc3RlcHMpIHtcbiAgICAgICAgKHN0ZXAgYXMgYW55KS5pc0FjdGl2ZSA9ICEhYWN0aXZlW3N0ZXAuaWRdO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIE1vbml0b3IgbW9kZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgc2V0TW9uaXRvck1vZGUobW9kZTogTW9uaXRvck1vZGUpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4geyBkLm1vbml0b3JNb2RlID0gbW9kZTsgfSk7XG4gIH1cblxuICBzZXRTY2FuUmF0ZShtczogbnVtYmVyKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHsgZC5zY2FuUmF0ZSA9IG1zOyB9KTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBXYXRjaCBsaXN0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBhZGRUb1dhdGNoTGlzdCh0YWdOYW1lOiBzdHJpbmcpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgaWYgKCFkLndhdGNoZWRUYWdzLmluY2x1ZGVzKHRhZ05hbWUpKSBkLndhdGNoZWRUYWdzLnB1c2godGFnTmFtZSk7XG4gICAgfSk7XG4gIH1cblxuICByZW1vdmVGcm9tV2F0Y2hMaXN0KHRhZ05hbWU6IHN0cmluZykge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBkLndhdGNoZWRUYWdzID0gZC53YXRjaGVkVGFncy5maWx0ZXIobiA9PiBuICE9PSB0YWdOYW1lKTtcbiAgICB9KTtcbiAgfVxuXG4gIGFkZEFsbFRhZ3NUb1dhdGNoTGlzdCgpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgZC53YXRjaGVkVGFncyA9IGQudGFnRGF0YWJhc2UubWFwKHQgPT4gdC5uYW1lKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNsZWFyV2F0Y2hMaXN0KCkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7IGQud2F0Y2hlZFRhZ3MgPSBbXTsgfSk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgVUkgc3RhdGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIHNldFpvb20oem9vbTogbnVtYmVyKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHsgZC56b29tID0gTWF0aC5tYXgoMC4yNSwgTWF0aC5taW4oNCwgem9vbSkpOyB9KTtcbiAgfVxuXG4gIHRvZ2dsZUdyaWQoKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHsgZC5zaG93R3JpZCA9ICFkLnNob3dHcmlkOyB9KTtcbiAgfVxuXG4gIHNldFNlYXJjaFF1ZXJ5KHE6IHN0cmluZykge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7IGQuc2VhcmNoUXVlcnkgPSBxOyB9KTtcbiAgfVxuXG4gIG9wZW5Dcm9zc1JlZih0YWdOYW1lOiBzdHJpbmcpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgZC5jcm9zc1JlZlBhbmVsT3BlbiA9IHRydWU7XG4gICAgICBkLmNyb3NzUmVmVGFyZ2V0ID0gdGFnTmFtZTtcbiAgICB9KTtcbiAgfVxuXG4gIGNsb3NlQ3Jvc3NSZWYoKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHsgZC5jcm9zc1JlZlBhbmVsT3BlbiA9IGZhbHNlOyBkLmNyb3NzUmVmVGFyZ2V0ID0gbnVsbDsgfSk7XG4gIH1cblxuICBvcGVuSW5zcGVjdG9yKGVsZW1lbnRJZDogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHsgZC5pbnNwZWN0b3JPcGVuID0gdHJ1ZTsgZC5pbnNwZWN0b3JFbGVtZW50SWQgPSBlbGVtZW50SWQ7IH0pO1xuICB9XG5cbiAgY2xvc2VJbnNwZWN0b3IoKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHsgZC5pbnNwZWN0b3JPcGVuID0gZmFsc2U7IGQuaW5zcGVjdG9yRWxlbWVudElkID0gbnVsbDsgfSk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgTG9hZCBwcm9ncmFtcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgc2V0SW1wb3J0ZWRTaWRlY2FyKHNpZGVjYXI6IGltcG9ydCgnLi92ZW5kb3IvdHlwZXMuanMnKS5WZW5kb3JNZXRhZGF0YVNpZGVjYXIgfCBudWxsKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHsgZC5pbXBvcnRlZFNpZGVjYXIgPSBzaWRlY2FyIGFzIGFueTsgfSk7XG4gIH1cblxuICBsb2FkTGFkZGVyUHJvZ3JhbShwcm9ncmFtOiBMYWRkZXJQcm9ncmFtKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGQubGFkZGVyUHJvZ3JhbSA9IHByb2dyYW07XG4gICAgICB0aGlzLl9yZWJ1aWxkQ3Jvc3NSZWYoZCk7XG4gICAgfSk7XG4gIH1cblxuICBsb2FkRkJEUHJvZ3JhbShwcm9ncmFtOiBGQkRQcm9ncmFtKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGQuZmJkUHJvZ3JhbSA9IHByb2dyYW07XG4gICAgICB0aGlzLl9yZWJ1aWxkQ3Jvc3NSZWYoZCk7XG4gICAgfSk7XG4gIH1cblxuICBsb2FkU0ZDUHJvZ3JhbShwcm9ncmFtOiBTRkNQcm9ncmFtKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHsgZC5zZmNQcm9ncmFtID0gcHJvZ3JhbTsgfSk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgQ29uc29sZSBsb2cgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGFkZENvbnNvbGVFbnRyeShsZXZlbDogJ2luZm8nIHwgJ3dhcm4nIHwgJ2Vycm9yJyB8ICdzdWNjZXNzJywgbWVzc2FnZTogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGQuY29uc29sZUxvZy5wdXNoKHsgdGltZXN0YW1wOiBEYXRlLm5vdygpLCBsZXZlbCwgbWVzc2FnZSB9KTtcbiAgICAgIGlmIChkLmNvbnNvbGVMb2cubGVuZ3RoID4gMjAwKSBkLmNvbnNvbGVMb2cuc3BsaWNlKDAsIGQuY29uc29sZUxvZy5sZW5ndGggLSAyMDApO1xuICAgIH0pO1xuICB9XG5cbiAgY2xlYXJDb25zb2xlKCkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7IGQuY29uc29sZUxvZyA9IFtdOyB9KTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBNdWx0aS1QT1Ugb3BlcmF0aW9ucyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgYWRkUE9VKG5hbWU6IHN0cmluZywgbGFuZ3VhZ2U6ICdMRCcgfCAnRkJEJyB8ICdTRkMnKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGNvbnN0IG5ld1BPVTogUE9VID0ge1xuICAgICAgICBpZDogYHBvdS0ke0RhdGUubm93KCl9YCxcbiAgICAgICAgbmFtZSxcbiAgICAgICAgbGFuZ3VhZ2UsXG4gICAgICAgIGxhZGRlclByb2dyYW06IHsgcnVuZ3M6IFtdIH0sXG4gICAgICAgIGZiZFByb2dyYW06IHsgbm9kZXM6IFtdLCB3aXJlczogW10gfSxcbiAgICAgICAgc2ZjUHJvZ3JhbTogeyBzdGVwczogW10sIHRyYW5zaXRpb25zOiBbXSwgbGlua3M6IFtdLCBicmFuY2hlczogW10sIGp1bXBzOiBbXSB9LFxuICAgICAgfTtcbiAgICAgIGQucG91cy5wdXNoKG5ld1BPVSk7XG4gICAgfSk7XG4gIH1cblxuICBzZXRBY3RpdmVQT1UoaWQ6IHN0cmluZykge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBjb25zdCBwb3UgPSBkLnBvdXMuZmluZChwID0+IHAuaWQgPT09IGlkKTtcbiAgICAgIGlmICghcG91KSByZXR1cm47XG4gICAgICBkLmFjdGl2ZVBvdUlkID0gaWQ7XG4gICAgICAvLyBNaXJyb3IgYWN0aXZlIFBPVSBwcm9ncmFtcyBpbnRvIHRvcC1sZXZlbCBmaWVsZHMgc28gZXhpc3RpbmcgZWRpdG9ycyB3b3JrXG4gICAgICBkLmxhZGRlclByb2dyYW0gPSBwb3UubGFkZGVyUHJvZ3JhbTtcbiAgICAgIGQuZmJkUHJvZ3JhbSAgICA9IHBvdS5mYmRQcm9ncmFtO1xuICAgICAgZC5zZmNQcm9ncmFtICAgID0gcG91LnNmY1Byb2dyYW07XG4gICAgICBkLmFjdGl2ZUxhbmd1YWdlID0gcG91Lmxhbmd1YWdlO1xuICAgICAgdGhpcy5fcmVidWlsZENyb3NzUmVmKGQpO1xuICAgIH0pO1xuICB9XG5cbiAgZGVsZXRlUE9VKGlkOiBzdHJpbmcpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgaWYgKGQucG91cy5sZW5ndGggPD0gMSkgcmV0dXJuOyAvLyBjYW4ndCBkZWxldGUgbGFzdCBQT1VcbiAgICAgIGQucG91cyA9IGQucG91cy5maWx0ZXIocCA9PiBwLmlkICE9PSBpZCk7XG4gICAgICAvLyBJZiBkZWxldGVkIHRoZSBhY3RpdmUgUE9VLCBzd2l0Y2ggdG8gZmlyc3RcbiAgICAgIGlmIChkLmFjdGl2ZVBvdUlkID09PSBpZCkge1xuICAgICAgICBjb25zdCBmaXJzdCA9IGQucG91c1swXTtcbiAgICAgICAgZC5hY3RpdmVQb3VJZCAgICA9IGZpcnN0LmlkO1xuICAgICAgICBkLmxhZGRlclByb2dyYW0gID0gZmlyc3QubGFkZGVyUHJvZ3JhbTtcbiAgICAgICAgZC5mYmRQcm9ncmFtICAgICA9IGZpcnN0LmZiZFByb2dyYW07XG4gICAgICAgIGQuc2ZjUHJvZ3JhbSAgICAgPSBmaXJzdC5zZmNQcm9ncmFtO1xuICAgICAgICBkLmFjdGl2ZUxhbmd1YWdlID0gZmlyc3QubGFuZ3VhZ2U7XG4gICAgICAgIHRoaXMuX3JlYnVpbGRDcm9zc1JlZihkKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHJlbmFtZVBPVShpZDogc3RyaW5nLCBuYW1lOiBzdHJpbmcpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgY29uc3QgcG91ID0gZC5wb3VzLmZpbmQocCA9PiBwLmlkID09PSBpZCk7XG4gICAgICBpZiAocG91KSBwb3UubmFtZSA9IG5hbWU7XG4gICAgfSk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgQ3Jvc3MtcmVmZXJlbmNlIGluZGV4IHJlYnVpbGQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIHByaXZhdGUgX3JlYnVpbGRDcm9zc1JlZihkOiBMb2dpY1N0b3JlU3RhdGUpIHtcbiAgICBjb25zdCBpbmRleCA9IG5ldyBNYXA8c3RyaW5nLCBBcnJheTx7IHJ1bmdJZD86IHN0cmluZzsgZWxlbWVudElkOiBzdHJpbmc7IGxhbmd1YWdlOiBFZGl0b3JMYW5ndWFnZSB9Pj4oKTtcblxuICAgIGNvbnN0IGFkZFJlZiA9ICh0YWdOYW1lOiBzdHJpbmcsIHJ1bmdJZDogc3RyaW5nIHwgdW5kZWZpbmVkLCBlbGVtZW50SWQ6IHN0cmluZywgbGFuZ3VhZ2U6IEVkaXRvckxhbmd1YWdlKSA9PiB7XG4gICAgICBpZiAoIXRhZ05hbWUpIHJldHVybjtcbiAgICAgIGlmICghaW5kZXguaGFzKHRhZ05hbWUpKSBpbmRleC5zZXQodGFnTmFtZSwgW10pO1xuICAgICAgaW5kZXguZ2V0KHRhZ05hbWUpIS5wdXNoKHsgcnVuZ0lkLCBlbGVtZW50SWQsIGxhbmd1YWdlIH0pO1xuICAgIH07XG5cbiAgICAvLyBMYWRkZXJcbiAgICBmb3IgKGNvbnN0IHJ1bmcgb2YgZC5sYWRkZXJQcm9ncmFtLnJ1bmdzKSB7XG4gICAgICBmb3IgKGNvbnN0IGVsIG9mIHJ1bmcuZWxlbWVudHMpIHtcbiAgICAgICAgaWYgKGVsLmtpbmQgPT09ICdjb250YWN0JyB8fCBlbC5raW5kID09PSAnY29pbCcpIHtcbiAgICAgICAgICBhZGRSZWYoZWwudGFnLm5hbWUsIHJ1bmcuaWQsIGVsLmlkLCAnTEQnKTtcbiAgICAgICAgfSBlbHNlIGlmIChlbC5raW5kID09PSAnYmxvY2snKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBbLCB0YWdSZWZdIG9mIE9iamVjdC5lbnRyaWVzKGVsLnBpbnMpKSB7XG4gICAgICAgICAgICBhZGRSZWYodGFnUmVmLm5hbWUsIHJ1bmcuaWQsIGVsLmlkLCAnTEQnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgYnJhbmNoIG9mIHJ1bmcuYnJhbmNoZXMpIHtcbiAgICAgICAgZm9yIChjb25zdCBlbCBvZiBicmFuY2guZWxlbWVudHMpIHtcbiAgICAgICAgICBpZiAoZWwua2luZCA9PT0gJ2NvbnRhY3QnIHx8IGVsLmtpbmQgPT09ICdjb2lsJykge1xuICAgICAgICAgICAgYWRkUmVmKGVsLnRhZy5uYW1lLCBydW5nLmlkLCBlbC5pZCwgJ0xEJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRkJEXG4gICAgZm9yIChjb25zdCBub2RlIG9mIGQuZmJkUHJvZ3JhbS5ub2Rlcykge1xuICAgICAgaWYgKG5vZGUudGFnKSBhZGRSZWYobm9kZS50YWcubmFtZSwgdW5kZWZpbmVkLCBub2RlLmlkLCAnRkJEJyk7XG4gICAgfVxuXG4gICAgZC5jcm9zc1JlZkluZGV4ID0gaW5kZXg7XG4gIH1cbn1cblxuLy8gU2luZ2xldG9uIHN0b3JlIGluc3RhbmNlXG5leHBvcnQgY29uc3QgbG9naWNTdG9yZSA9IG5ldyBMb2dpY1N0b3JlKCk7XG5cbi8vIFJlYWN0IGhvb2sgZm9yIHN1YnNjcmliaW5nIHRvIHN0b3JlXG5pbXBvcnQgeyB1c2VTdGF0ZSwgdXNlRWZmZWN0LCB1c2VSZWYgfSBmcm9tICdyZWFjdCc7XG5cbmV4cG9ydCBmdW5jdGlvbiB1c2VMb2dpY1N0b3JlKCk6IExvZ2ljU3RvcmVTdGF0ZSB7XG4gIGNvbnN0IFtzdGF0ZSwgc2V0U3RhdGVdID0gdXNlU3RhdGUobG9naWNTdG9yZS5nZXRTdGF0ZSgpKTtcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICByZXR1cm4gbG9naWNTdG9yZS5zdWJzY3JpYmUoc2V0U3RhdGUpO1xuICB9LCBbXSk7XG4gIHJldHVybiBzdGF0ZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVzZUxvZ2ljU3RvcmVTZWxlY3RvcjxUPihzZWxlY3RvcjogKHM6IExvZ2ljU3RvcmVTdGF0ZSkgPT4gVCk6IFQge1xuICBjb25zdCBzZWxlY3RvclJlZiA9IHVzZVJlZihzZWxlY3Rvcik7XG4gIHNlbGVjdG9yUmVmLmN1cnJlbnQgPSBzZWxlY3RvcjtcbiAgY29uc3QgW3ZhbHVlLCBzZXRWYWx1ZV0gPSB1c2VTdGF0ZSgoKSA9PiBzZWxlY3Rvcihsb2dpY1N0b3JlLmdldFN0YXRlKCkpKTtcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICAvLyBTdGFibGUgc3Vic2NyaXB0aW9uIFx1MjAxNCByZWFkcyBsYXRlc3Qgc2VsZWN0b3IgdmlhIHJlZiBzbyBpbmxpbmUgYXJyb3cgZnVuY3Rpb25zXG4gICAgLy8gaW4gY2FsbGVycyBkb24ndCBjYXVzZSB0aGUgc3Vic2NyaXB0aW9uIHRvIHRlYXJkb3duL3Jlc3Vic2NyaWJlIG9uIGV2ZXJ5IHJlbmRlci5cbiAgICByZXR1cm4gbG9naWNTdG9yZS5zdWJzY3JpYmUoc3RhdGUgPT4ge1xuICAgICAgY29uc3QgbmV4dCA9IHNlbGVjdG9yUmVmLmN1cnJlbnQoc3RhdGUpO1xuICAgICAgc2V0VmFsdWUocHJldiA9PiBPYmplY3QuaXMocHJldiwgbmV4dCkgPyBwcmV2IDogbmV4dCk7XG4gICAgfSk7XG4gIH0sIFtdKTtcbiAgcmV0dXJuIHZhbHVlO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBTUEsU0FB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LGVBQVcsUUFBUSxFQUFFLGNBQWMsT0FBTztBQUN4QyxpQkFBVyxNQUFNLEtBQUssVUFBVTtBQUM5QixZQUFJLEdBQUcsU0FBUyxhQUFhLEdBQUcsU0FBUyxRQUFRO0FBQy9DLGlCQUFPLEdBQUcsSUFBSSxNQUFNLEtBQUssSUFBSSxHQUFHLElBQUksSUFBSTtBQUFBLFFBQzFDLFdBQVcsR0FBRyxTQUFTLFNBQVM7QUFDOUIscUJBQVcsQ0FBQyxFQUFFLE1BQU0sS0FBSyxPQUFPLFFBQVEsR0FBRyxJQUFJLEdBQUc7QUFDaEQsbUJBQU8sT0FBTyxNQUFNLEtBQUssSUFBSSxHQUFHLElBQUksSUFBSTtBQUFBLFVBQzFDO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFDQSxpQkFBVyxVQUFVLEtBQUssVUFBVTtBQUNsQyxtQkFBVyxNQUFNLE9BQU8sVUFBVTtBQUNoQyxjQUFJLEdBQUcsU0FBUyxhQUFhLEdBQUcsU0FBUyxRQUFRO0FBQy9DLG1CQUFPLEdBQUcsSUFBSSxNQUFNLEtBQUssSUFBSSxHQUFHLElBQUksSUFBSTtBQUFBLFVBQzFDO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBR0EsZUFBVyxRQUFRLEVBQUUsV0FBVyxPQUFPO0FBQ3JDLFVBQUksS0FBSyxJQUFLLFFBQU8sS0FBSyxJQUFJLE1BQU0sUUFBVyxLQUFLLElBQUksS0FBSztBQUFBLElBQy9EO0FBRUEsTUFBRSxnQkFBZ0I7QUFBQSxFQUNwQjtBQUNGO0FBR08sTUFBTSxhQUFhLElBQUksV0FBVztBQUd6QyxTQUFTLFVBQVUsV0FBVyxjQUFjO0FBRXJDLFNBQVMsZ0JBQWlDO0FBQy9DLFFBQU0sQ0FBQyxPQUFPLFFBQVEsSUFBSSxTQUFTLFdBQVcsU0FBUyxDQUFDO0FBQ3hELFlBQVUsTUFBTTtBQUNkLFdBQU8sV0FBVyxVQUFVLFFBQVE7QUFBQSxFQUN0QyxHQUFHLENBQUMsQ0FBQztBQUNMLFNBQU87QUFDVDtBQUVPLFNBQVMsc0JBQXlCLFVBQXdDO0FBQy9FLFFBQU0sY0FBYyxPQUFPLFFBQVE7QUFDbkMsY0FBWSxVQUFVO0FBQ3RCLFFBQU0sQ0FBQyxPQUFPLFFBQVEsSUFBSSxTQUFTLE1BQU0sU0FBUyxXQUFXLFNBQVMsQ0FBQyxDQUFDO0FBQ3hFLFlBQVUsTUFBTTtBQUdkLFdBQU8sV0FBVyxVQUFVLFdBQVM7QUFDbkMsWUFBTSxPQUFPLFlBQVksUUFBUSxLQUFLO0FBQ3RDLGVBQVMsVUFBUSxPQUFPLEdBQUcsTUFBTSxJQUFJLElBQUksT0FBTyxJQUFJO0FBQUEsSUFDdEQsQ0FBQztBQUFBLEVBQ0gsR0FBRyxDQUFDLENBQUM7QUFDTCxTQUFPO0FBQ1Q7IiwKICAibmFtZXMiOiBbInQiLCAibCIsICJqIl0KfQo=
