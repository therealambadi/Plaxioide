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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjMi9wbGMtZWRpdG9yLXRzeC9sb2dpY1N0b3JlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKlxuICogUExDIExvZ2ljIEVkaXRvciBcdTIwMTQgQ2VudHJhbCBTdGF0ZSBTdG9yZVxuICogTWFuYWdlcyBMRC9GQkQvU0ZDIGRpYWdyYW0gc3RhdGUsIHNlbGVjdGlvbiwgY2xpcGJvYXJkLCBtb25pdG9yIG1vZGUuXG4gKiBVc2VzIGltbWVyIGZvciBpbW11dGFibGUgdXBkYXRlcyBhbmQgYSBjb21tYW5kLXBhdHRlcm4gdW5kby9yZWRvIHN0YWNrLlxuICovXG5cbmltcG9ydCB7IHByb2R1Y2UgfSBmcm9tICdpbW1lcic7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBTaGFyZWQgUHJpbWl0aXZlcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IHR5cGUgSUVDRGF0YVR5cGUgPVxuICB8ICdCT09MJyB8ICdJTlQnIHwgJ1VJTlQnIHwgJ0RJTlQnIHwgJ1VESU5UJyB8ICdMSU5UJyB8ICdVTElOVCdcbiAgfCAnUkVBTCcgfCAnTFJFQUwnIHwgJ0JZVEUnIHwgJ1dPUkQnIHwgJ0RXT1JEJyB8ICdMV09SRCdcbiAgfCAnU1RSSU5HJyB8ICdXU1RSSU5HJyB8ICdUSU1FJyB8ICdEQVRFJyB8ICdUT0QnIHwgJ0RUJ1xuICB8ICdBUlJBWV9CT09MJyB8ICdBUlJBWV9JTlQnIHwgJ0FSUkFZX1JFQUwnXG4gIHwgJ1NUUlVDVCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUG9zaXRpb24geyB4OiBudW1iZXI7IHk6IG51bWJlciB9XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFnUmVmIHtcbiAgbmFtZTogc3RyaW5nO1xuICBhZGRyZXNzPzogc3RyaW5nOyAgIC8vIGUuZy4gXCIlSTAuMFwiLCBcIiVRMC4xXCIsIFwiJU0wLjBcIlxuICBkYXRhVHlwZTogSUVDRGF0YVR5cGU7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBMYWRkZXIgRGlhZ3JhbSBNb2RlbCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IHR5cGUgQ29udGFjdFR5cGUgPSAnTk8nIHwgJ05DJyB8ICdQX0NPTlRBQ1QnIHwgJ05fQ09OVEFDVCc7XG5leHBvcnQgdHlwZSBDb2lsVHlwZSA9ICdub3JtYWwnIHwgJ25lZ2F0ZWQnIHwgJ3NldCcgfCAncmVzZXQnIHwgJ2xhdGNoJyB8ICd1bmxhdGNoJztcbmV4cG9ydCB0eXBlIEZCVHlwZSA9ICdUT04nIHwgJ1RPRicgfCAnVFAnIHwgJ0NUVScgfCAnQ1REJyB8ICdDVFVEJyB8ICdTUicgfCAnUlMnIHwgJ1JUUklHJyB8ICdGVFJJRydcbiAgfCAnRVEnIHwgJ05FJyB8ICdHVCcgfCAnR0UnIHwgJ0xUJyB8ICdMRSdcbiAgfCAnQUREJyB8ICdTVUInIHwgJ01VTCcgfCAnRElWJyB8ICdNT0QnIHwgJ0FCUycgfCAnU1FSVCdcbiAgfCAnTU9WRScgfCAnU0VMJyB8ICdMSU1JVCcgfCAnTUlOJyB8ICdNQVgnXG4gIC8vIEV4dGVuZGVkOiBTaWVtZW5zLXNwZWNpZmljIHRpbWVycy9jb3VudGVycyB3aXRoIGRpcmVjdCBJRUMgZXF1aXZhbGVudHNcbiAgfCAnVE9OUicgfCAnSUVDX1RJTUVSJyB8ICdJRUNfTFRJTUVSJyB8ICdJRUNfQ09VTlRFUicgfCAnSUVDX0xDT1VOVEVSJ1xuICAvLyBFeHRlbmRlZDogU2llbWVucyBhbmFsb2cgc2NhbGluZyAvIG5vcm1hbGlzYXRpb25cbiAgfCAnU0NBTEUnIHwgJ1VOU0NBTEUnIHwgJ05PUk1fWCcgfCAnU0NBTEVfWCdcbiAgLy8gRXh0ZW5kZWQ6IFNpZW1lbnMgYmxpbmsgLyBvc2NpbGxhdG9yXG4gIHwgJ0JMSU5LJ1xuICAvLyBFeHRlbmRlZDogU2llbWVucyBJRUMgdGltZXIgY29udGFjdCAoZWRnZS1iYXNlZCB0aW1lciBvdXRwdXQgY29udGFjdClcbiAgfCAnSUVDX1RDJ1xuICAvLyBFeHRlbmRlZDogU3RyaW5nIGZ1bmN0aW9ucyAodXNlZCBpbiBGQkQvTEQgaW4gYWxsIHZlbmRvcnMpXG4gIHwgJ0xFTicgfCAnTEVGVCcgfCAnUklHSFQnIHwgJ01JRCcgfCAnQ09OQ0FUJyB8ICdGSU5EJyB8ICdJTlNFUlQnIHwgJ0RFTEVURScgfCAnUkVQTEFDRSdcbiAgfCAnVVBQRVJfQ0FTRScgfCAnTE9XRVJfQ0FTRSdcbiAgLy8gRXh0ZW5kZWQ6IFNpZW1lbnMgY29tbXVuaWNhdGlvbiBGQnMgKHNpbXBsaWZpZWQgcmVwcmVzZW50YXRpb24pXG4gIHwgJ1NFTkQnIHwgJ1JFQ1YnIHwgJ1JEUkVDJyB8ICdXUlJFQydcbiAgLy8gRXh0ZW5kZWQ6IE1hdGggZXh0ZW5zaW9uc1xuICB8ICdMTicgfCAnTE9HJyB8ICdFWFAnIHwgJ1NJTicgfCAnQ09TJyB8ICdUQU4nIHwgJ0FTSU4nIHwgJ0FDT1MnIHwgJ0FUQU4nXG4gIHwgJ05FRycgfCAnTVVMJyB8ICdYT1InIHwgJ05PVCcgfCAnQU5EJyB8ICdPUidcbiAgLy8gRXh0ZW5kZWQ6IFJvY2t3ZWxsIGV4dHJhc1xuICB8ICdNT1YnIHwgJ0NPUCcgfCAnRkZMJyB8ICdGRlUnIHwgJ0xGTCcgfCAnTEZVJyB8ICdTUU8nIHwgJ1NRSScgfCAnU1FMJ1xuICB8ICdQSUQnIHwgJ01TRycgfCAnR1NWJyB8ICdTU1YnIHwgJ0xJTScgfCAnTUVRJyB8ICdNVk0nIHwgJ0JURCcgfCAnRkxMJyB8ICdTSVpFJztcblxuZXhwb3J0IGludGVyZmFjZSBDb250YWN0RWxlbWVudCB7XG4gIGtpbmQ6ICdjb250YWN0JztcbiAgaWQ6IHN0cmluZztcbiAgdHlwZTogQ29udGFjdFR5cGU7XG4gIHRhZzogVGFnUmVmO1xuICBwb3NpdGlvbjogUG9zaXRpb247XG4gIGVuZXJnaXplZD86IGJvb2xlYW47ICAvLyBtb25pdG9yIG1vZGVcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb2lsRWxlbWVudCB7XG4gIGtpbmQ6ICdjb2lsJztcbiAgaWQ6IHN0cmluZztcbiAgdHlwZTogQ29pbFR5cGU7XG4gIHRhZzogVGFnUmVmO1xuICBwb3NpdGlvbjogUG9zaXRpb247XG4gIGVuZXJnaXplZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQmxvY2tFbGVtZW50IHtcbiAga2luZDogJ2Jsb2NrJztcbiAgaWQ6IHN0cmluZztcbiAgZmJUeXBlOiBGQlR5cGU7XG4gIGluc3RhbmNlTmFtZTogc3RyaW5nO1xuICBwaW5zOiBSZWNvcmQ8c3RyaW5nLCBUYWdSZWY+O1xuICBwb3NpdGlvbjogUG9zaXRpb247XG4gIGVuZXJnaXplZD86IGJvb2xlYW47ICAgICAgICAgICAgICAgICAvLyBtb25pdG9yIG1vZGVcbiAgcGluVmFsdWVzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPjsgIC8vIG1vbml0b3IgbW9kZSBsaXZlIHZhbHVlcyBwZXIgb3V0cHV0IHBpblxuICB2ZW5kb3JPcmlnaW5hbE5hbWU/OiBzdHJpbmc7ICAgICAgICAgLy8gcHJlc2VydmVzIGV4YWN0IHZlbmRvciB0eXBlIG5hbWUgZm9yIGxvc3NsZXNzIGV4cG9ydCAoZS5nLiAnSUVDX1RJTUVSXzFzJyB2cyAnSUVDX1RJTUVSJylcbn1cblxuZXhwb3J0IHR5cGUgTGFkZGVyRWxlbWVudCA9IENvbnRhY3RFbGVtZW50IHwgQ29pbEVsZW1lbnQgfCBCbG9ja0VsZW1lbnQ7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnJhbmNoIHtcbiAgaWQ6IHN0cmluZztcbiAgc3RhcnROb2RlSWQ6IHN0cmluZztcbiAgZW5kTm9kZUlkOiBzdHJpbmc7XG4gIGVsZW1lbnRzOiBMYWRkZXJFbGVtZW50W107XG4gIGVuZXJnaXplZD86IGJvb2xlYW47ICAvLyBtb25pdG9yIG1vZGUgXHUyMDE0IGJyYW5jaCBwYXRoIGRlbGl2ZXJzIHBvd2VyXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUnVuZyB7XG4gIGlkOiBzdHJpbmc7XG4gIG51bWJlcjogbnVtYmVyO1xuICBjb21tZW50OiBzdHJpbmc7XG4gIGVsZW1lbnRzOiBMYWRkZXJFbGVtZW50W107XG4gIGJyYW5jaGVzOiBCcmFuY2hbXTtcbiAgZW5lcmdpemVkPzogYm9vbGVhbjsgIC8vIG1vbml0b3IgbW9kZSBcdTIwMTQgd2hvbGUgcnVuZyBwb3dlcmVkXG4gIHZlbmRvclR5cGU/OiBzdHJpbmc7ICAvLyBMNVggcnVuZyB0eXBlOiBcIk5cIiAoTm9ybWFsKSwgXCJSXCIgKFJvdXRpbmUpLCBcIkVcIiAoRW1wdHkpLCBldGMuXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGFkZGVyUHJvZ3JhbSB7XG4gIHJ1bmdzOiBSdW5nW107XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBGQkQgTW9kZWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCB0eXBlIEZCREJsb2NrVHlwZSA9XG4gIHwgJ0FORCcgfCAnT1InIHwgJ05PVCcgfCAnWE9SJyB8ICdOQU5EJyB8ICdOT1InXG4gIHwgJ0FERCcgfCAnU1VCJyB8ICdNVUwnIHwgJ0RJVicgfCAnTU9EJyB8ICdBQlMnIHwgJ1NRUlQnXG4gIHwgJ0dUJyB8ICdMVCcgfCAnR0UnIHwgJ0xFJyB8ICdFUScgfCAnTkUnXG4gIHwgJ1RPTicgfCAnVE9GJyB8ICdUUCcgfCAnQ1RVJyB8ICdDVEQnIHwgJ0NUVUQnIHwgJ1NSJyB8ICdSUycgfCAnUlRSSUcnIHwgJ0ZUUklHJ1xuICB8ICdTRUwnIHwgJ01VWCcgfCAnTElNSVQnIHwgJ01JTicgfCAnTUFYJ1xuICB8ICdNT1ZFJyB8ICdJTl9WQVJJQUJMRScgfCAnT1VUX1ZBUklBQkxFJyB8ICdJTk9VVF9WQVJJQUJMRScgfCAnSU5fT1VUX1ZBUklBQkxFJ1xuICB8ICdDT05ORUNUT1InIHwgJ0NPTlRJTlVBVElPTicgfCAnQ09NTUVOVCdcbiAgfCAnTEFCRUwnIHwgJ0pVTVAnIHwgJ1JFVFVSTidcbiAgLy8gRXh0ZW5kZWQ6IFNpZW1lbnMtc3BlY2lmaWMgdGltZXJzIC8gY291bnRlcnNcbiAgfCAnVE9OUicgfCAnSUVDX1RJTUVSJyB8ICdJRUNfTFRJTUVSJyB8ICdJRUNfQ09VTlRFUicgfCAnSUVDX0xDT1VOVEVSJ1xuICAvLyBFeHRlbmRlZDogU2llbWVucyBhbmFsb2cgc2NhbGluZyAvIG5vcm1hbGlzYXRpb25cbiAgfCAnU0NBTEUnIHwgJ1VOU0NBTEUnIHwgJ05PUk1fWCcgfCAnU0NBTEVfWCdcbiAgLy8gRXh0ZW5kZWQ6IFNpZW1lbnMgYmxpbmsgLyBvc2NpbGxhdG9yIC8gSUVDIHRpbWVyIGNvbnRhY3RcbiAgfCAnQkxJTksnIHwgJ0lFQ19UQydcbiAgLy8gRXh0ZW5kZWQ6IE1hdGggKHVzZWQgYWNyb3NzIGFsbCB2ZW5kb3JzKVxuICB8ICdMTicgfCAnTE9HJyB8ICdFWFAnIHwgJ1NJTicgfCAnQ09TJyB8ICdUQU4nIHwgJ0FTSU4nIHwgJ0FDT1MnIHwgJ0FUQU4nIHwgJ05FRydcbiAgLy8gRXh0ZW5kZWQ6IFN0cmluZyBmdW5jdGlvbnNcbiAgfCAnTEVOJyB8ICdMRUZUJyB8ICdSSUdIVCcgfCAnTUlEJyB8ICdDT05DQVQnIHwgJ0ZJTkQnIHwgJ0lOU0VSVCcgfCAnREVMRVRFJyB8ICdSRVBMQUNFJ1xuICB8ICdVUFBFUl9DQVNFJyB8ICdMT1dFUl9DQVNFJyB8ICdTX0xFTicgfCAnU19MRUZUJyB8ICdTX1JJR0hUJyB8ICdTX01JRCcgfCAnU19GSU5EJyB8ICdTX0NPTlYnIHwgJ1NfQ09OQ0FUJ1xuICAvLyBFeHRlbmRlZDogVHlwZSBjb252ZXJzaW9uc1xuICB8ICdJTlRfVE9fUkVBTCcgfCAnUkVBTF9UT19JTlQnIHwgJ0RJTlRfVE9fUkVBTCcgfCAnUkVBTF9UT19ESU5UJyB8ICdJTlRfVE9fRElOVCdcbiAgfCAnQk9PTF9UT19JTlQnIHwgJ0lOVF9UT19CT09MJyB8ICdXT1JEX1RPX0lOVCcgfCAnSU5UX1RPX1dPUkQnIHwgJ0RXT1JEX1RPX0RJTlQnIHwgJ0RJTlRfVE9fRFdPUkQnXG4gIHwgJ1RJTUVfVE9fRElOVCcgfCAnRElOVF9UT19USU1FJ1xuICB8ICdST1VORCcgfCAnVFJVTkMnIHwgJ0NFSUwnIHwgJ0ZMT09SJyB8ICdDT05WRVJUJ1xuICAvLyBFeHRlbmRlZDogU2llbWVucyBjb21tdW5pY2F0aW9uIEZCc1xuICB8ICdTRU5EJyB8ICdSRUNWJyB8ICdSRFJFQycgfCAnV1JSRUMnXG4gIC8vIEV4dGVuZGVkOiBSb2Nrd2VsbC1zcGVjaWZpY1xuICB8ICdNT1YnIHwgJ0NPUCcgfCAnRkZMJyB8ICdGRlUnIHwgJ0xGTCcgfCAnTEZVJyB8ICdTUU8nIHwgJ1NRSScgfCAnU1FMJ1xuICB8ICdQSUQnIHwgJ01TRycgfCAnR1NWJyB8ICdTU1YnIHwgJ0xJTScgfCAnTUVRJyB8ICdNVk0nIHwgJ0JURCcgfCAnU0laRSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGluIHtcbiAgaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBkYXRhVHlwZTogSUVDRGF0YVR5cGU7XG4gIG5lZ2F0ZWQ/OiBib29sZWFuO1xuICB2YWx1ZT86IHN0cmluZzsgIC8vIG1vbml0b3IgbW9kZVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEZCRE5vZGUge1xuICBpZDogc3RyaW5nO1xuICB0eXBlOiBGQkRCbG9ja1R5cGU7XG4gIGxhYmVsPzogc3RyaW5nOyAgICAgICAgICAvLyBjb25uZWN0b3IvY29udGludWF0aW9uIGxhYmVsXG4gIGluc3RhbmNlTmFtZT86IHN0cmluZzsgICAvLyBmdW5jdGlvbi1ibG9jayBpbnN0YW5jZSBuYW1lXG4gIGNvbnRlbnQ/OiBzdHJpbmc7ICAgICAgICAvLyBjb21tZW50IHRleHRcbiAgcG9zaXRpb246IFBvc2l0aW9uO1xuICBzaXplPzogeyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9OyAgLy8gY29tbWVudCBub2RlcyBhcmUgcmVzaXphYmxlXG4gIGlucHV0czogUGluW107XG4gIG91dHB1dHM6IFBpbltdO1xuICB0YWc/OiBUYWdSZWY7ICAvLyBmb3IgdmFyaWFibGUgbm9kZXNcbiAgbmVnYXRlZD86IGJvb2xlYW47ICAvLyBmb3IgdmFyaWFibGUgbm9kZXMgKGluVmFyaWFibGUvb3V0VmFyaWFibGUgbmVnYXRpb24pXG4gIGV4ZWN1dGlvbk9yZGVySWQ/OiBudW1iZXI7ICAvLyBUQzY6IGV4ZWN1dGlvbiBvcmRlciBmb3IgYmxvY2tzXG4gIHZlbmRvck9yaWdpbmFsTmFtZT86IHN0cmluZzsgIC8vIGV4YWN0IHZlbmRvciB0eXBlIHN0cmluZyBmb3IgbG9zc2xlc3MgZXhwb3J0IHJvdW5kLXRyaXBcbn1cblxuZXhwb3J0IGludGVyZmFjZSBGQkRXaXJlIHtcbiAgaWQ6IHN0cmluZztcbiAgZnJvbTogeyBub2RlSWQ6IHN0cmluZzsgcGluOiBzdHJpbmcgfTtcbiAgdG86IHsgbm9kZUlkOiBzdHJpbmc7IHBpbjogc3RyaW5nIH07XG4gIG5lZ2F0ZWQ/OiBib29sZWFuO1xuICBlbmVyZ2l6ZWQ/OiBib29sZWFuOyAgLy8gbW9uaXRvciBtb2RlXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRkJEUHJvZ3JhbSB7XG4gIG5vZGVzOiBGQkROb2RlW107XG4gIHdpcmVzOiBGQkRXaXJlW107XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBTRkMgTW9kZWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbi8vIEFsbCAxMSBJRUMgNjExMzEtMyBcdTAwQTc2LjguMyBxdWFsaWZpZXJzXG5leHBvcnQgdHlwZSBBY3Rpb25RdWFsaWZpZXIgPSAnTicgfCAnUycgfCAnUicgfCAnUCcgfCAnUDEnIHwgJ1AwJyB8ICdMJyB8ICdEJyB8ICdTRCcgfCAnRFMnIHwgJ1NMJztcblxuZXhwb3J0IGludGVyZmFjZSBTRkNBY3Rpb24ge1xuICBpZDogc3RyaW5nO1xuICBxdWFsaWZpZXI6IEFjdGlvblF1YWxpZmllcjtcbiAgdGFnOiBUYWdSZWY7XG4gIGR1cmF0aW9uPzogc3RyaW5nOyAgLy8gZm9yIHRpbWVkIHF1YWxpZmllcnMgTCwgRCwgU0QsIERTLCBTTFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNGQ1N0ZXAge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIGlzSW5pdGlhbDogYm9vbGVhbjtcbiAgYWN0aW9uczogU0ZDQWN0aW9uW107XG4gIHBvc2l0aW9uOiBQb3NpdGlvbjtcbiAgaXNBY3RpdmU/OiBib29sZWFuOyAgLy8gbW9uaXRvciBtb2RlXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU0ZDVHJhbnNpdGlvbiB7XG4gIGlkOiBzdHJpbmc7XG4gIGNvbmRpdGlvbjogc3RyaW5nOyAgLy8gU1QgYm9vbGVhbiBleHByZXNzaW9uXG4gIHBvc2l0aW9uOiBQb3NpdGlvbjtcbiAgcHJpb3JpdHk/OiBudW1iZXI7ICAvLyBmb3IgT1ItYnJhbmNoIGV2YWx1YXRpb24gb3JkZXJcbiAgaXNUcnVlPzogYm9vbGVhbjsgICAvLyBtb25pdG9yIG1vZGVcbn1cblxuZXhwb3J0IHR5cGUgU0ZDTGlua1R5cGUgPVxuICB8ICdzaW1wbGUnXG4gIHwgJ3NlbGVjdGlvbi1kaXZlcmdlbmNlJ1xuICB8ICdzZWxlY3Rpb24tY29udmVyZ2VuY2UnXG4gIHwgJ3NpbXVsdGFuZW91cy1kaXZlcmdlbmNlJ1xuICB8ICdzaW11bHRhbmVvdXMtY29udmVyZ2VuY2UnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNGQ0xpbmsge1xuICBpZDogc3RyaW5nO1xuICBmcm9tOiBzdHJpbmc7XG4gIHRvOiBzdHJpbmc7XG4gIHR5cGU6IFNGQ0xpbmtUeXBlO1xuICAvLyBPbmx5IHVzZWQgZm9yIGRpdmVyZ2VuY2UvY29udmVyZ2VuY2UgYmFyIG5vZGVzIFx1MjAxNCBwb3NpdGlvbiBvZiB0aGUgdmlzdWFsIGJhciBub2RlIG9uIGNhbnZhc1xuICBiYXJQb3NpdGlvbj86IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfTtcbn1cblxuLy8gT1IgYnJhbmNoID0gc2luZ2xlIGJhciAob25seSBvbmUgZmlyZXMpOyBBTkQgYnJhbmNoID0gZG91YmxlIGJhciAoYWxsIGZpcmUgc2ltdWx0YW5lb3VzbHkpXG5leHBvcnQgaW50ZXJmYWNlIFNGQ0JyYW5jaCB7XG4gIGlkOiBzdHJpbmc7XG4gIHR5cGU6ICdPUicgfCAnQU5EJztcbiAgZGl2ZXJnaW5nRnJvbVRyYW5zSWQ6IHN0cmluZzsgICAvLyB0cmFuc2l0aW9uIHRoYXQgZmFucyBPVVRcbiAgYnJhbmNoU3RlcElkczogc3RyaW5nW11bXTsgICAgICAvLyBlYWNoIGlubmVyIGFycmF5ID0gc3RlcCBpZHMgYWxvbmcgdGhhdCBicmFuY2hcbiAgY29udmVyZ2luZ1RvVHJhbnNJZDogc3RyaW5nOyAgICAvLyB0cmFuc2l0aW9uIHRoYXQgZmFucyBJTlxufVxuXG4vLyBKdW1wLXRvLXN0ZXAgY29ubmVjdG9yOiBhIHRlcm1pbmFsIG5vZGUgdGhhdCByZXByZXNlbnRzIGEgYmFja3dhcmQgYXJjIHRvIGEgbmFtZWQgc3RlcC5cbi8vIFdoZW4gdGhlIGZsb3cgcmVhY2hlcyB0aGlzIG5vZGUsIGV4ZWN1dGlvbiBjb250aW51ZXMgZnJvbSB0aGUgbmFtZWQgdGFyZ2V0IHN0ZXAuXG5leHBvcnQgaW50ZXJmYWNlIFNGQ0p1bXAge1xuICBpZDogc3RyaW5nO1xuICB0YXJnZXRTdGVwTmFtZTogc3RyaW5nOyAgLy8gbmFtZSBvZiB0aGUgc3RlcCB0byBqdW1wIHRvXG4gIHBvc2l0aW9uOiBQb3NpdGlvbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTRkNQcm9ncmFtIHtcbiAgc3RlcHM6IFNGQ1N0ZXBbXTtcbiAgdHJhbnNpdGlvbnM6IFNGQ1RyYW5zaXRpb25bXTtcbiAgbGlua3M6IFNGQ0xpbmtbXTtcbiAgYnJhbmNoZXM6IFNGQ0JyYW5jaFtdO1xuICBqdW1wczogU0ZDSnVtcFtdO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgVGFnIERhdGFiYXNlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgaW50ZXJmYWNlIFRhZ0VudHJ5IHtcbiAgbmFtZTogc3RyaW5nO1xuICBhZGRyZXNzOiBzdHJpbmc7XG4gIGRhdGFUeXBlOiBJRUNEYXRhVHlwZTtcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmc7XG4gIHJldGFpbj86IGJvb2xlYW47ICAgICAgIC8vIFJFVEFJTiBxdWFsaWZpZXIgXHUyMDE0IHZhbHVlIHN1cnZpdmVzIHBvd2VyIGN5Y2xlXG4gIGluaXRpYWxWYWx1ZT86IHN0cmluZzsgIC8vIGluaXRpYWwvZGVmYXVsdCB2YWx1ZSBhdCBwcm9ncmFtIHN0YXJ0XG4gIGZvcmNlZFZhbHVlPzogc3RyaW5nOyAgIC8vIG51bGwgPSBub3QgZm9yY2VkXG4gIGxpdmVWYWx1ZT86IHN0cmluZzsgICAgIC8vIG1vbml0b3IgbW9kZVxufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgUE9VIChQcm9ncmFtIE9yZ2FuaXphdGlvbiBVbml0KSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGludGVyZmFjZSBQT1Uge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIGxhbmd1YWdlOiAnTEQnIHwgJ0ZCRCcgfCAnU0ZDJztcbiAgbGFkZGVyUHJvZ3JhbTogTGFkZGVyUHJvZ3JhbTtcbiAgZmJkUHJvZ3JhbTogRkJEUHJvZ3JhbTtcbiAgc2ZjUHJvZ3JhbTogU0ZDUHJvZ3JhbTtcbiAgcmV0YWluPzogYm9vbGVhbjtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIExvZ2ljIFN0b3JlIFN0YXRlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgdHlwZSBFZGl0b3JMYW5ndWFnZSA9ICdMRCcgfCAnRkJEJyB8ICdTRkMnO1xuZXhwb3J0IHR5cGUgTW9uaXRvck1vZGUgPSAnc3RvcHBlZCcgfCAncnVubmluZycgfCAncGF1c2VkJyB8ICdzdGVwcGluZyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTG9naWNTdG9yZVN0YXRlIHtcbiAgYWN0aXZlTGFuZ3VhZ2U6IEVkaXRvckxhbmd1YWdlO1xuXG4gIC8vIERpYWdyYW0gbW9kZWxzXG4gIGxhZGRlclByb2dyYW06IExhZGRlclByb2dyYW07XG4gIGZiZFByb2dyYW06IEZCRFByb2dyYW07XG4gIHNmY1Byb2dyYW06IFNGQ1Byb2dyYW07XG5cbiAgLy8gU2VsZWN0aW9uXG4gIHNlbGVjdGVkRWxlbWVudElkczogU2V0PHN0cmluZz47XG4gIHNlbGVjdGVkUnVuZ0lkOiBzdHJpbmcgfCBudWxsO1xuXG4gIC8vIENsaXBib2FyZFxuICBjbGlwYm9hcmQ6IHtcbiAgICBydW5ncz86IFJ1bmdbXTtcbiAgICBlbGVtZW50cz86IExhZGRlckVsZW1lbnRbXTtcbiAgICBmYmROb2Rlcz86IEZCRE5vZGVbXTtcbiAgICBzZmNTdGVwcz86IFNGQ1N0ZXBbXTtcbiAgfTtcblxuICAvLyBUYWcgZGF0YWJhc2UgKGxvYWRlZCBmcm9tIHdvcmtzcGFjZSB0YWcgc3RvcmUpXG4gIHRhZ0RhdGFiYXNlOiBUYWdFbnRyeVtdO1xuXG4gIC8vIENyb3NzLXJlZmVyZW5jZTogdGFnTmFtZSBcdTIxOTIgbGlzdCBvZiAocnVuZ0lkLCBlbGVtZW50SWQpXG4gIGNyb3NzUmVmSW5kZXg6IE1hcDxzdHJpbmcsIEFycmF5PHsgcnVuZ0lkPzogc3RyaW5nOyBlbGVtZW50SWQ6IHN0cmluZzsgbGFuZ3VhZ2U6IEVkaXRvckxhbmd1YWdlIH0+PjtcblxuICAvLyBNb25pdG9yIG1vZGVcbiAgbW9uaXRvck1vZGU6IE1vbml0b3JNb2RlO1xuICBzY2FuUmF0ZTogbnVtYmVyOyAgLy8gbXNcblxuICAvLyBUYWcgTW9uaXRvciB3YXRjaCBsaXN0IFx1MjAxNCBzdWJzZXQgb2YgdGFnRGF0YWJhc2UgbmFtZXMgdGhlIHVzZXIgaGFzIHBpbm5lZFxuICB3YXRjaGVkVGFnczogc3RyaW5nW107XG5cbiAgLy8gVUkgc3RhdGVcbiAgem9vbTogbnVtYmVyO1xuICBzaG93R3JpZDogYm9vbGVhbjtcbiAgc2VhcmNoUXVlcnk6IHN0cmluZztcbiAgY3Jvc3NSZWZQYW5lbE9wZW46IGJvb2xlYW47XG4gIGNyb3NzUmVmVGFyZ2V0OiBzdHJpbmcgfCBudWxsO1xuICBpbnNwZWN0b3JPcGVuOiBib29sZWFuO1xuICBpbnNwZWN0b3JFbGVtZW50SWQ6IHN0cmluZyB8IG51bGw7XG5cbiAgLy8gRkJEIGJsb2NrIG91dHB1dCBwaW4gbGl2ZSB2YWx1ZXM6IGluc3RhbmNlS2V5IFx1MjE5MiB7IHBpbk5hbWUgXHUyMTkyIHZhbHVlIH1cbiAgZmJkQmxvY2tQaW5WYWx1ZXM6IFJlY29yZDxzdHJpbmcsIFJlY29yZDxzdHJpbmcsIHN0cmluZz4+O1xuXG4gIC8vIENvbnNvbGUgb3V0cHV0IGxvZ1xuICBjb25zb2xlTG9nOiBBcnJheTx7IHRpbWVzdGFtcDogbnVtYmVyOyBsZXZlbDogJ2luZm8nIHwgJ3dhcm4nIHwgJ2Vycm9yJyB8ICdzdWNjZXNzJzsgbWVzc2FnZTogc3RyaW5nIH0+O1xuXG4gIC8vIE11bHRpLVBPVSBzdXBwb3J0IChmb3VuZGF0aW9uIFx1MjAxNCBleGlzdGluZyB0b3AtbGV2ZWwgZmllbGRzIHJlbWFpbiBhcyBhY3RpdmUgUE9VKVxuICBwb3VzOiBQT1VbXTtcbiAgYWN0aXZlUG91SWQ6IHN0cmluZztcblxuICAvLyBTaWRlY2FyIGZyb20gbGFzdCB2ZW5kb3IgaW1wb3J0IFx1MjAxNCB1c2VkIGJ5IGV4cG9ydCB0YWIgZm9yIGxvc3NsZXNzIHJvdW5kLXRyaXBcbiAgaW1wb3J0ZWRTaWRlY2FyOiBpbXBvcnQoJy4vdmVuZG9yL3R5cGVzLmpzJykuVmVuZG9yTWV0YWRhdGFTaWRlY2FyIHwgbnVsbDtcbn1cblxuY29uc3QgY3JlYXRlSW5pdGlhbExhZGRlciA9ICgpOiBMYWRkZXJQcm9ncmFtID0+ICh7XG4gIHJ1bmdzOiBbXG4gICAge1xuICAgICAgaWQ6ICdydW5nLTEnLFxuICAgICAgbnVtYmVyOiAxLFxuICAgICAgY29tbWVudDogJ01vdG9yIHN0YXJ0L3N0b3AgY2lyY3VpdCcsXG4gICAgICBlbGVtZW50czogW1xuICAgICAgICB7IGtpbmQ6ICdjb250YWN0JywgaWQ6ICdlbC0xJywgdHlwZTogJ05PJywgdGFnOiB7IG5hbWU6ICdQQl9TVEFSVCcsIGRhdGFUeXBlOiAnQk9PTCcgfSwgcG9zaXRpb246IHsgeDogMCwgeTogMCB9IH0sXG4gICAgICAgIHsga2luZDogJ2NvbnRhY3QnLCBpZDogJ2VsLTInLCB0eXBlOiAnTkMnLCB0YWc6IHsgbmFtZTogJ1BCX1NUT1AnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHBvc2l0aW9uOiB7IHg6IDYwLCB5OiAwIH0gfSxcbiAgICAgICAgeyBraW5kOiAnY29udGFjdCcsIGlkOiAnZWwtMycsIHR5cGU6ICdOQycsIHRhZzogeyBuYW1lOiAnT1ZFUkxPQUQnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHBvc2l0aW9uOiB7IHg6IDEyMCwgeTogMCB9IH0sXG4gICAgICAgIHsga2luZDogJ2NvaWwnLCBpZDogJ2VsLTQnLCB0eXBlOiAnbm9ybWFsJywgdGFnOiB7IG5hbWU6ICdNT1RPUl9SVU4nLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHBvc2l0aW9uOiB7IHg6IDE4MCwgeTogMCB9IH0sXG4gICAgICBdLFxuICAgICAgYnJhbmNoZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnYnJhbmNoLTEnLFxuICAgICAgICAgIHN0YXJ0Tm9kZUlkOiAnZWwtMScsXG4gICAgICAgICAgZW5kTm9kZUlkOiAnZWwtMicsXG4gICAgICAgICAgZWxlbWVudHM6IFtcbiAgICAgICAgICAgIHsga2luZDogJ2NvbnRhY3QnLCBpZDogJ2VsLTUnLCB0eXBlOiAnTk8nLCB0YWc6IHsgbmFtZTogJ01PVE9SX1JVTicsIGRhdGFUeXBlOiAnQk9PTCcgfSwgcG9zaXRpb246IHsgeDogMCwgeTogMCB9IH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfVxuICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAncnVuZy0yJyxcbiAgICAgIG51bWJlcjogMixcbiAgICAgIGNvbW1lbnQ6ICdNb3RvciBydW4gdGltZXInLFxuICAgICAgZWxlbWVudHM6IFtcbiAgICAgICAgeyBraW5kOiAnY29udGFjdCcsIGlkOiAnZWwtNicsIHR5cGU6ICdOTycsIHRhZzogeyBuYW1lOiAnTU9UT1JfUlVOJywgZGF0YVR5cGU6ICdCT09MJyB9LCBwb3NpdGlvbjogeyB4OiAwLCB5OiAwIH0gfSxcbiAgICAgICAgeyBraW5kOiAnYmxvY2snLCBpZDogJ2VsLTcnLCBmYlR5cGU6ICdUT04nLCBpbnN0YW5jZU5hbWU6ICdSVU5fVE1SJywgcGluczogeyBJTjogeyBuYW1lOiAnTU9UT1JfUlVOJywgZGF0YVR5cGU6ICdCT09MJyB9LCBQVDogeyBuYW1lOiAnVCMxMHMnLCBkYXRhVHlwZTogJ1RJTUUnIH0gfSwgcG9zaXRpb246IHsgeDogNjAsIHk6IDAgfSB9LFxuICAgICAgICB7IGtpbmQ6ICdjb2lsJywgaWQ6ICdlbC04JywgdHlwZTogJ3NldCcsIHRhZzogeyBuYW1lOiAnUlVOX1RJTUVPVVQnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHBvc2l0aW9uOiB7IHg6IDE4MCwgeTogMCB9IH0sXG4gICAgICBdLFxuICAgICAgYnJhbmNoZXM6IFtdLFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdydW5nLTMnLFxuICAgICAgbnVtYmVyOiAzLFxuICAgICAgY29tbWVudDogJ0ZhdWx0IHJlc2V0JyxcbiAgICAgIGVsZW1lbnRzOiBbXG4gICAgICAgIHsga2luZDogJ2NvbnRhY3QnLCBpZDogJ2VsLTknLCB0eXBlOiAnTk8nLCB0YWc6IHsgbmFtZTogJ0ZBVUxUX1JFU0VUJywgZGF0YVR5cGU6ICdCT09MJyB9LCBwb3NpdGlvbjogeyB4OiAwLCB5OiAwIH0gfSxcbiAgICAgICAgeyBraW5kOiAnY29pbCcsIGlkOiAnZWwtMTAnLCB0eXBlOiAncmVzZXQnLCB0YWc6IHsgbmFtZTogJ1JVTl9USU1FT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9LCBwb3NpdGlvbjogeyB4OiA2MCwgeTogMCB9IH0sXG4gICAgICBdLFxuICAgICAgYnJhbmNoZXM6IFtdLFxuICAgIH0sXG4gIF1cbn0pO1xuXG5jb25zdCBjcmVhdGVJbml0aWFsRkJEID0gKCk6IEZCRFByb2dyYW0gPT4gKHtcbiAgbm9kZXM6IFtcbiAgICB7XG4gICAgICBpZDogJ2ZiZC1pbnB1dC0xJyxcbiAgICAgIHR5cGU6ICdJTl9WQVJJQUJMRScgYXMgRkJEQmxvY2tUeXBlLFxuICAgICAgcG9zaXRpb246IHsgeDogNjAsIHk6IDgwIH0sXG4gICAgICBpbnB1dHM6IFtdLFxuICAgICAgb3V0cHV0czogW3sgaWQ6ICdvdXQtb3V0cHV0LXZhcmlhYmxlLTAnLCBuYW1lOiAnb3V0cHV0LXZhcmlhYmxlJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICAgIHRhZzogeyBuYW1lOiAnUEJfU1RBUlQnLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2ZiZC1pbnB1dC0yJyxcbiAgICAgIHR5cGU6ICdJTl9WQVJJQUJMRScgYXMgRkJEQmxvY2tUeXBlLFxuICAgICAgcG9zaXRpb246IHsgeDogNjAsIHk6IDE4MCB9LFxuICAgICAgaW5wdXRzOiBbXSxcbiAgICAgIG91dHB1dHM6IFt7IGlkOiAnb3V0LW91dHB1dC12YXJpYWJsZS0wJywgbmFtZTogJ291dHB1dC12YXJpYWJsZScsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgICB0YWc6IHsgbmFtZTogJ1BCX1NUT1AnLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2ZiZC1hbmQtMScsXG4gICAgICB0eXBlOiAnQU5EJyBhcyBGQkRCbG9ja1R5cGUsXG4gICAgICBwb3NpdGlvbjogeyB4OiAyODAsIHk6IDEwMCB9LFxuICAgICAgaW5zdGFuY2VOYW1lOiAnYW5kMScsXG4gICAgICBpbnB1dHM6IFt7IGlkOiAnaW4tSU4xLTAnLCBuYW1lOiAnSU4xJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IGlkOiAnaW4tSU4yLTEnLCBuYW1lOiAnSU4yJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICAgIG91dHB1dHM6IFt7IGlkOiAnb3V0LU9VVC0wJywgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ2ZiZC10b24tMScsXG4gICAgICB0eXBlOiAnVE9OJyBhcyBGQkRCbG9ja1R5cGUsXG4gICAgICBwb3NpdGlvbjogeyB4OiA1MDAsIHk6IDkwIH0sXG4gICAgICBpbnN0YW5jZU5hbWU6ICdSVU5fVE1SJyxcbiAgICAgIGlucHV0czogW3sgaWQ6ICdpbi1JTi0wJywgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IGlkOiAnaW4tUFQtMScsIG5hbWU6ICdQVCcsIGRhdGFUeXBlOiAnVElNRScgfV0sXG4gICAgICBvdXRwdXRzOiBbeyBpZDogJ291dC1RLTAnLCBuYW1lOiAnUScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBpZDogJ291dC1FVC0xJywgbmFtZTogJ0VUJywgZGF0YVR5cGU6ICdUSU1FJyB9XSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnZmJkLW91dHB1dC0xJyxcbiAgICAgIHR5cGU6ICdPVVRfVkFSSUFCTEUnIGFzIEZCREJsb2NrVHlwZSxcbiAgICAgIHBvc2l0aW9uOiB7IHg6IDcyMCwgeTogMTEwIH0sXG4gICAgICBpbnB1dHM6IFt7IGlkOiAnaW4taW5wdXQtdmFyaWFibGUtMCcsIG5hbWU6ICdpbnB1dC12YXJpYWJsZScsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgICBvdXRwdXRzOiBbXSxcbiAgICAgIHRhZzogeyBuYW1lOiAnTU9UT1JfUlVOJywgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgIH0sXG4gIF0sXG4gIHdpcmVzOiBbXG4gICAgeyBpZDogJ2ZiZC13MScsIGZyb206IHsgbm9kZUlkOiAnZmJkLWlucHV0LTEnLCBwaW46ICdvdXRwdXQtdmFyaWFibGUnIH0sIHRvOiB7IG5vZGVJZDogJ2ZiZC1hbmQtMScsIHBpbjogJ0lOMScgfSB9LFxuICAgIHsgaWQ6ICdmYmQtdzInLCBmcm9tOiB7IG5vZGVJZDogJ2ZiZC1pbnB1dC0yJywgcGluOiAnb3V0cHV0LXZhcmlhYmxlJyB9LCB0bzogeyBub2RlSWQ6ICdmYmQtYW5kLTEnLCBwaW46ICdJTjInIH0gfSxcbiAgICB7IGlkOiAnZmJkLXczJywgZnJvbTogeyBub2RlSWQ6ICdmYmQtYW5kLTEnLCAgIHBpbjogJ09VVCcgfSwgICAgICAgICAgICAgdG86IHsgbm9kZUlkOiAnZmJkLXRvbi0xJywgICAgcGluOiAnSU4nIH0gfSxcbiAgICB7IGlkOiAnZmJkLXc0JywgZnJvbTogeyBub2RlSWQ6ICdmYmQtdG9uLTEnLCAgIHBpbjogJ1EnIH0sICAgICAgICAgICAgICAgdG86IHsgbm9kZUlkOiAnZmJkLW91dHB1dC0xJywgcGluOiAnaW5wdXQtdmFyaWFibGUnIH0gfSxcbiAgXSxcbn0pO1xuXG5jb25zdCBjcmVhdGVJbml0aWFsU0ZDID0gKCk6IFNGQ1Byb2dyYW0gPT4gKHtcbiAgc3RlcHM6IFtcbiAgICB7XG4gICAgICBpZDogJ3N0ZXAtaW5pdGlhbCcsXG4gICAgICBuYW1lOiAnSW5pdCcsXG4gICAgICBpc0luaXRpYWw6IHRydWUsXG4gICAgICBhY3Rpb25zOiBbeyBpZDogJ2ExJywgcXVhbGlmaWVyOiAnTicsIHRhZzogeyBuYW1lOiAnUkVTRVRfQUxMJywgZGF0YVR5cGU6ICdCT09MJyB9IH1dLFxuICAgICAgcG9zaXRpb246IHsgeDogMTAwLCB5OiA2MCB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdzdGVwLXJ1bicsXG4gICAgICBuYW1lOiAnUnVubmluZycsXG4gICAgICBpc0luaXRpYWw6IGZhbHNlLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICB7IGlkOiAnYTInLCBxdWFsaWZpZXI6ICdOJywgdGFnOiB7IG5hbWU6ICdNT1RPUl9PTicsIGRhdGFUeXBlOiAnQk9PTCcgfSB9LFxuICAgICAgICB7IGlkOiAnYTMnLCBxdWFsaWZpZXI6ICdEJywgdGFnOiB7IG5hbWU6ICdTVEFSVF9UTVInLCBkYXRhVHlwZTogJ0JPT0wnIH0sIGR1cmF0aW9uOiAnVCM1cycgfSxcbiAgICAgIF0sXG4gICAgICBwb3NpdGlvbjogeyB4OiAxMDAsIHk6IDI2MCB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdzdGVwLXN0b3AnLFxuICAgICAgbmFtZTogJ1N0b3BwZWQnLFxuICAgICAgaXNJbml0aWFsOiBmYWxzZSxcbiAgICAgIGFjdGlvbnM6IFt7IGlkOiAnYTQnLCBxdWFsaWZpZXI6ICdOJywgdGFnOiB7IG5hbWU6ICdNT1RPUl9PRkYnLCBkYXRhVHlwZTogJ0JPT0wnIH0gfV0sXG4gICAgICBwb3NpdGlvbjogeyB4OiAxMDAsIHk6IDQ4MCB9LFxuICAgIH0sXG4gIF0sXG4gIHRyYW5zaXRpb25zOiBbXG4gICAge1xuICAgICAgaWQ6ICd0cmFucy0wJyxcbiAgICAgIGNvbmRpdGlvbjogJ1BCX1NUQVJUJyxcbiAgICAgIHBvc2l0aW9uOiB7IHg6IDEwMCwgeTogMTgwIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ3RyYW5zLTEnLFxuICAgICAgY29uZGl0aW9uOiAnUEJfU1RPUCBPUiBUSU1FT1VUJyxcbiAgICAgIHBvc2l0aW9uOiB7IHg6IDEwMCwgeTogNDAwIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ3RyYW5zLTInLFxuICAgICAgY29uZGl0aW9uOiAnVFJVRScsXG4gICAgICBwb3NpdGlvbjogeyB4OiAxMDAsIHk6IDYyMCB9LFxuICAgIH0sXG4gIF0sXG4gIGxpbmtzOiBbXG4gICAgeyBpZDogJ2xpbmstMCcsIGZyb206ICdzdGVwLWluaXRpYWwnLCB0bzogJ3RyYW5zLTAnLCB0eXBlOiAnc2ltcGxlJyB9LFxuICAgIHsgaWQ6ICdsaW5rLTEnLCBmcm9tOiAndHJhbnMtMCcsIHRvOiAnc3RlcC1ydW4nLCB0eXBlOiAnc2ltcGxlJyB9LFxuICAgIHsgaWQ6ICdsaW5rLTInLCBmcm9tOiAnc3RlcC1ydW4nLCB0bzogJ3RyYW5zLTEnLCB0eXBlOiAnc2ltcGxlJyB9LFxuICAgIHsgaWQ6ICdsaW5rLTMnLCBmcm9tOiAndHJhbnMtMScsIHRvOiAnc3RlcC1zdG9wJywgdHlwZTogJ3NpbXBsZScgfSxcbiAgICB7IGlkOiAnbGluay00JywgZnJvbTogJ3N0ZXAtc3RvcCcsIHRvOiAndHJhbnMtMicsIHR5cGU6ICdzaW1wbGUnIH0sXG4gICAgeyBpZDogJ2xpbmstNScsIGZyb206ICd0cmFucy0yJywgdG86ICdzdGVwLWluaXRpYWwnLCB0eXBlOiAnc2ltcGxlJyB9LFxuICBdLFxuICBicmFuY2hlczogW10sXG4gIGp1bXBzOiBbXSxcbn0pO1xuXG5jb25zdCBfaW5pdGlhbExhZGRlciA9IGNyZWF0ZUluaXRpYWxMYWRkZXIoKTtcbmNvbnN0IF9pbml0aWFsRkJEICAgID0gY3JlYXRlSW5pdGlhbEZCRCgpO1xuY29uc3QgX2luaXRpYWxTRkMgICAgPSBjcmVhdGVJbml0aWFsU0ZDKCk7XG5cbmNvbnN0IGluaXRpYWxTdGF0ZTogTG9naWNTdG9yZVN0YXRlID0ge1xuICBhY3RpdmVMYW5ndWFnZTogJ0xEJyxcbiAgbGFkZGVyUHJvZ3JhbTogX2luaXRpYWxMYWRkZXIsXG4gIGZiZFByb2dyYW06IF9pbml0aWFsRkJELFxuICBzZmNQcm9ncmFtOiBfaW5pdGlhbFNGQyxcbiAgc2VsZWN0ZWRFbGVtZW50SWRzOiBuZXcgU2V0KCksXG4gIHNlbGVjdGVkUnVuZ0lkOiBudWxsLFxuICBjbGlwYm9hcmQ6IHt9LFxuICB0YWdEYXRhYmFzZTogW1xuICAgIHsgbmFtZTogJ1BCX1NUQVJUJywgICAgYWRkcmVzczogJyVJMC4wJywgZGF0YVR5cGU6ICdCT09MJywgZGVzY3JpcHRpb246ICdTdGFydCBwdXNoYnV0dG9uJyB9LFxuICAgIHsgbmFtZTogJ1BCX1NUT1AnLCAgICAgYWRkcmVzczogJyVJMC4xJywgZGF0YVR5cGU6ICdCT09MJywgZGVzY3JpcHRpb246ICdTdG9wIHB1c2hidXR0b24nIH0sXG4gICAgeyBuYW1lOiAnT1ZFUkxPQUQnLCAgICBhZGRyZXNzOiAnJUkwLjInLCBkYXRhVHlwZTogJ0JPT0wnLCBkZXNjcmlwdGlvbjogJ01vdG9yIG92ZXJsb2FkIHJlbGF5JyB9LFxuICAgIHsgbmFtZTogJ01PVE9SX1JVTicsICAgYWRkcmVzczogJyVRMC4wJywgZGF0YVR5cGU6ICdCT09MJywgZGVzY3JpcHRpb246ICdNb3RvciBjb250YWN0b3Igb3V0cHV0JyB9LFxuICAgIHsgbmFtZTogJ0ZBVUxUX1JFU0VUJywgYWRkcmVzczogJyVJMC4zJywgZGF0YVR5cGU6ICdCT09MJywgZGVzY3JpcHRpb246ICdGYXVsdCByZXNldCBidXR0b24nIH0sXG4gICAgeyBuYW1lOiAnUlVOX1RJTUVPVVQnLCBhZGRyZXNzOiAnJU0wLjAnLCBkYXRhVHlwZTogJ0JPT0wnLCBkZXNjcmlwdGlvbjogJ01vdG9yIHJ1biB0aW1lb3V0IGZsYWcnIH0sXG4gIF0sXG4gIGNyb3NzUmVmSW5kZXg6IG5ldyBNYXAoKSxcbiAgbW9uaXRvck1vZGU6ICdzdG9wcGVkJyxcbiAgc2NhblJhdGU6IDEwLFxuICB3YXRjaGVkVGFnczogW10sXG4gIHpvb206IDEsXG4gIHNob3dHcmlkOiB0cnVlLFxuICBzZWFyY2hRdWVyeTogJycsXG4gIGNyb3NzUmVmUGFuZWxPcGVuOiBmYWxzZSxcbiAgY3Jvc3NSZWZUYXJnZXQ6IG51bGwsXG4gIGluc3BlY3Rvck9wZW46IGZhbHNlLFxuICBpbnNwZWN0b3JFbGVtZW50SWQ6IG51bGwsXG4gIGZiZEJsb2NrUGluVmFsdWVzOiB7fSxcbiAgY29uc29sZUxvZzogW10sXG4gIHBvdXM6IFt7XG4gICAgaWQ6ICdwb3UtbWFpbicsXG4gICAgbmFtZTogJ01haW4nLFxuICAgIGxhbmd1YWdlOiAnTEQnLFxuICAgIGxhZGRlclByb2dyYW06IF9pbml0aWFsTGFkZGVyLFxuICAgIGZiZFByb2dyYW06IF9pbml0aWFsRkJELFxuICAgIHNmY1Byb2dyYW06IF9pbml0aWFsU0ZDLFxuICB9XSxcbiAgYWN0aXZlUG91SWQ6ICdwb3UtbWFpbicsXG4gIGltcG9ydGVkU2lkZWNhcjogbnVsbCxcbn07XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBTdG9yZSAoc2ltcGxlIHB1Yi9zdWIsIG5vIGV4dGVybmFsIGxpYnJhcnkgbmVlZGVkKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxudHlwZSBMaXN0ZW5lciA9IChzdGF0ZTogTG9naWNTdG9yZVN0YXRlKSA9PiB2b2lkO1xuXG5jbGFzcyBMb2dpY1N0b3JlIHtcbiAgcHJpdmF0ZSBzdGF0ZTogTG9naWNTdG9yZVN0YXRlID0geyAuLi5pbml0aWFsU3RhdGUsIHNlbGVjdGVkRWxlbWVudElkczogbmV3IFNldCgpLCBjcm9zc1JlZkluZGV4OiBuZXcgTWFwKCksIGNsaXBib2FyZDoge30sIGNvbnNvbGVMb2c6IFtdLCBmYmRCbG9ja1BpblZhbHVlczoge30gfTtcbiAgcHJpdmF0ZSBsaXN0ZW5lcnM6IFNldDxMaXN0ZW5lcj4gPSBuZXcgU2V0KCk7XG5cbiAgZ2V0U3RhdGUoKTogTG9naWNTdG9yZVN0YXRlIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZTtcbiAgfVxuXG4gIHN1YnNjcmliZShsaXN0ZW5lcjogTGlzdGVuZXIpOiAoKSA9PiB2b2lkIHtcbiAgICB0aGlzLmxpc3RlbmVycy5hZGQobGlzdGVuZXIpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLmxpc3RlbmVycy5kZWxldGUobGlzdGVuZXIpO1xuICB9XG5cbiAgcHJpdmF0ZSBub3RpZnkoKSB7XG4gICAgdGhpcy5saXN0ZW5lcnMuZm9yRWFjaChsID0+IGwodGhpcy5zdGF0ZSkpO1xuICB9XG5cbiAgc2V0U3RhdGUodXBkYXRlcjogKGRyYWZ0OiBMb2dpY1N0b3JlU3RhdGUpID0+IHZvaWQpIHtcbiAgICB0aGlzLnN0YXRlID0gcHJvZHVjZSh0aGlzLnN0YXRlLCB1cGRhdGVyKTtcbiAgICB0aGlzLm5vdGlmeSgpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIExhbmd1YWdlIHN3aXRjaGluZyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgc2V0QWN0aXZlTGFuZ3VhZ2UobGFuZzogRWRpdG9yTGFuZ3VhZ2UpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4geyBkLmFjdGl2ZUxhbmd1YWdlID0gbGFuZzsgfSk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgTGFkZGVyIG9wZXJhdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGFkZFJ1bmcoYWZ0ZXJJbmRleD86IG51bWJlcikge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBjb25zdCBuZXdSdW5nOiBSdW5nID0ge1xuICAgICAgICBpZDogYHJ1bmctJHtEYXRlLm5vdygpfWAsXG4gICAgICAgIG51bWJlcjogZC5sYWRkZXJQcm9ncmFtLnJ1bmdzLmxlbmd0aCArIDEsXG4gICAgICAgIGNvbW1lbnQ6ICcnLFxuICAgICAgICBlbGVtZW50czogW10sXG4gICAgICAgIGJyYW5jaGVzOiBbXSxcbiAgICAgIH07XG4gICAgICBpZiAoYWZ0ZXJJbmRleCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGQubGFkZGVyUHJvZ3JhbS5ydW5ncy5zcGxpY2UoYWZ0ZXJJbmRleCArIDEsIDAsIG5ld1J1bmcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZC5sYWRkZXJQcm9ncmFtLnJ1bmdzLnB1c2gobmV3UnVuZyk7XG4gICAgICB9XG4gICAgICAvLyByZW51bWJlclxuICAgICAgZC5sYWRkZXJQcm9ncmFtLnJ1bmdzLmZvckVhY2goKHIsIGkpID0+IHsgci5udW1iZXIgPSBpICsgMTsgfSk7XG4gICAgfSk7XG4gIH1cblxuICBkZWxldGVSdW5nKHJ1bmdJZDogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGQubGFkZGVyUHJvZ3JhbS5ydW5ncyA9IGQubGFkZGVyUHJvZ3JhbS5ydW5ncy5maWx0ZXIociA9PiByLmlkICE9PSBydW5nSWQpO1xuICAgICAgZC5sYWRkZXJQcm9ncmFtLnJ1bmdzLmZvckVhY2goKHIsIGkpID0+IHsgci5udW1iZXIgPSBpICsgMTsgfSk7XG4gICAgfSk7XG4gIH1cblxuICBkdXBsaWNhdGVSdW5nKHJ1bmdJZDogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGNvbnN0IGlkeCA9IGQubGFkZGVyUHJvZ3JhbS5ydW5ncy5maW5kSW5kZXgociA9PiByLmlkID09PSBydW5nSWQpO1xuICAgICAgaWYgKGlkeCA9PT0gLTEpIHJldHVybjtcbiAgICAgIGNvbnN0IG9yaWcgPSBkLmxhZGRlclByb2dyYW0ucnVuZ3NbaWR4XTtcbiAgICAgIC8vIERlZXAgY2xvbmUgdGhlbiBnaXZlIGV2ZXJ5IGlkIGEgZnJlc2ggdW5pcXVlIHN1ZmZpeFxuICAgICAgY29uc3QgY29weTogUnVuZyA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkob3JpZykpO1xuICAgICAgY29uc3QgdWlkID0gKCkgPT4gYCR7RGF0ZS5ub3coKX0tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyLCA3KX1gO1xuICAgICAgLy8gTWFwIG9sZCBlbGVtZW50IElEcyBcdTIxOTIgbmV3IElEcyBzbyBicmFuY2ggcmVmZXJlbmNlcyBzdGF5IGNvbnNpc3RlbnRcbiAgICAgIGNvbnN0IGlkTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gICAgICBjb3B5LmVsZW1lbnRzID0gY29weS5lbGVtZW50cy5tYXAoZWwgPT4ge1xuICAgICAgICBjb25zdCBuZXdJZCA9IGAke2VsLmtpbmR9LSR7dWlkKCl9YDtcbiAgICAgICAgaWRNYXBbZWwuaWRdID0gbmV3SWQ7XG4gICAgICAgIHJldHVybiB7IC4uLmVsLCBpZDogbmV3SWQgfTtcbiAgICAgIH0pO1xuICAgICAgY29weS5icmFuY2hlcyA9IGNvcHkuYnJhbmNoZXMubWFwKGJyID0+ICh7XG4gICAgICAgIC4uLmJyLFxuICAgICAgICBpZDogYGJyYW5jaC0ke3VpZCgpfWAsXG4gICAgICAgIHN0YXJ0Tm9kZUlkOiBpZE1hcFtici5zdGFydE5vZGVJZF0gPz8gYnIuc3RhcnROb2RlSWQsXG4gICAgICAgIGVuZE5vZGVJZDogICBpZE1hcFtici5lbmROb2RlSWRdICAgPz8gYnIuZW5kTm9kZUlkLFxuICAgICAgICBlbGVtZW50czogYnIuZWxlbWVudHMubWFwKGVsID0+IHtcbiAgICAgICAgICBjb25zdCBuZXdJZCA9IGAke2VsLmtpbmR9LSR7dWlkKCl9YDtcbiAgICAgICAgICByZXR1cm4geyAuLi5lbCwgaWQ6IG5ld0lkIH07XG4gICAgICAgIH0pLFxuICAgICAgfSkpO1xuICAgICAgY29weS5pZCA9IGBydW5nLSR7dWlkKCl9YDtcbiAgICAgIGQubGFkZGVyUHJvZ3JhbS5ydW5ncy5zcGxpY2UoaWR4ICsgMSwgMCwgY29weSk7XG4gICAgICBkLmxhZGRlclByb2dyYW0ucnVuZ3MuZm9yRWFjaCgociwgaSkgPT4geyByLm51bWJlciA9IGkgKyAxOyB9KTtcbiAgICAgIHRoaXMuX3JlYnVpbGRDcm9zc1JlZihkKTtcbiAgICB9KTtcbiAgfVxuXG4gIG1vdmVSdW5nKGZyb21JZHg6IG51bWJlciwgdG9JZHg6IG51bWJlcikge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBjb25zdCBydW5ncyA9IGQubGFkZGVyUHJvZ3JhbS5ydW5ncztcbiAgICAgIGNvbnN0IFttb3ZlZF0gPSBydW5ncy5zcGxpY2UoZnJvbUlkeCwgMSk7XG4gICAgICBydW5ncy5zcGxpY2UodG9JZHgsIDAsIG1vdmVkKTtcbiAgICAgIHJ1bmdzLmZvckVhY2goKHIsIGkpID0+IHsgci5udW1iZXIgPSBpICsgMTsgfSk7XG4gICAgfSk7XG4gIH1cblxuICB1cGRhdGVSdW5nQ29tbWVudChydW5nSWQ6IHN0cmluZywgY29tbWVudDogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGNvbnN0IHJ1bmcgPSBkLmxhZGRlclByb2dyYW0ucnVuZ3MuZmluZChyID0+IHIuaWQgPT09IHJ1bmdJZCk7XG4gICAgICBpZiAocnVuZykgcnVuZy5jb21tZW50ID0gY29tbWVudDtcbiAgICB9KTtcbiAgfVxuXG4gIGFkZEVsZW1lbnRUb1J1bmcocnVuZ0lkOiBzdHJpbmcsIGVsZW1lbnQ6IExhZGRlckVsZW1lbnQpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgY29uc3QgcnVuZyA9IGQubGFkZGVyUHJvZ3JhbS5ydW5ncy5maW5kKHIgPT4gci5pZCA9PT0gcnVuZ0lkKTtcbiAgICAgIGlmIChydW5nKSBydW5nLmVsZW1lbnRzLnB1c2goZWxlbWVudCk7XG4gICAgICB0aGlzLl9yZWJ1aWxkQ3Jvc3NSZWYoZCk7XG4gICAgfSk7XG4gIH1cblxuICB1cGRhdGVFbGVtZW50KHJ1bmdJZDogc3RyaW5nLCBlbGVtZW50SWQ6IHN0cmluZywgdXBkYXRlczogUGFydGlhbDxMYWRkZXJFbGVtZW50Pikge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBjb25zdCBydW5nID0gZC5sYWRkZXJQcm9ncmFtLnJ1bmdzLmZpbmQociA9PiByLmlkID09PSBydW5nSWQpO1xuICAgICAgaWYgKCFydW5nKSByZXR1cm47XG4gICAgICBjb25zdCBpZHggPSBydW5nLmVsZW1lbnRzLmZpbmRJbmRleChlbCA9PiBlbC5pZCA9PT0gZWxlbWVudElkKTtcbiAgICAgIGlmIChpZHggIT09IC0xKSB7XG4gICAgICAgIE9iamVjdC5hc3NpZ24ocnVuZy5lbGVtZW50c1tpZHhdLCB1cGRhdGVzKTtcbiAgICAgIH1cbiAgICAgIC8vIGFsc28gY2hlY2sgYnJhbmNoZXNcbiAgICAgIGZvciAoY29uc3QgYnJhbmNoIG9mIHJ1bmcuYnJhbmNoZXMpIHtcbiAgICAgICAgY29uc3QgYmlkeCA9IGJyYW5jaC5lbGVtZW50cy5maW5kSW5kZXgoZWwgPT4gZWwuaWQgPT09IGVsZW1lbnRJZCk7XG4gICAgICAgIGlmIChiaWR4ICE9PSAtMSkgT2JqZWN0LmFzc2lnbihicmFuY2guZWxlbWVudHNbYmlkeF0sIHVwZGF0ZXMpO1xuICAgICAgfVxuICAgICAgdGhpcy5fcmVidWlsZENyb3NzUmVmKGQpO1xuICAgIH0pO1xuICB9XG5cbiAgbW92ZUVsZW1lbnQocnVuZ0lkOiBzdHJpbmcsIGZyb21JbmRleDogbnVtYmVyLCB0b0luZGV4OiBudW1iZXIpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgY29uc3QgcnVuZyA9IGQubGFkZGVyUHJvZ3JhbS5ydW5ncy5maW5kKHIgPT4gci5pZCA9PT0gcnVuZ0lkKTtcbiAgICAgIGlmICghcnVuZykgcmV0dXJuO1xuICAgICAgY29uc3QgZWxzID0gcnVuZy5lbGVtZW50cztcbiAgICAgIGlmIChmcm9tSW5kZXggPCAwIHx8IGZyb21JbmRleCA+PSBlbHMubGVuZ3RoKSByZXR1cm47XG4gICAgICBpZiAodG9JbmRleCA8IDAgfHwgdG9JbmRleCA+PSBlbHMubGVuZ3RoKSByZXR1cm47XG4gICAgICBjb25zdCBbZWxdID0gZWxzLnNwbGljZShmcm9tSW5kZXgsIDEpO1xuICAgICAgZWxzLnNwbGljZSh0b0luZGV4LCAwLCBlbCk7XG4gICAgICB0aGlzLl9yZWJ1aWxkQ3Jvc3NSZWYoZCk7XG4gICAgfSk7XG4gIH1cblxuICBkZWxldGVFbGVtZW50KHJ1bmdJZDogc3RyaW5nLCBlbGVtZW50SWQ6IHN0cmluZykge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBjb25zdCBydW5nID0gZC5sYWRkZXJQcm9ncmFtLnJ1bmdzLmZpbmQociA9PiByLmlkID09PSBydW5nSWQpO1xuICAgICAgaWYgKCFydW5nKSByZXR1cm47XG4gICAgICBydW5nLmVsZW1lbnRzID0gcnVuZy5lbGVtZW50cy5maWx0ZXIoZWwgPT4gZWwuaWQgIT09IGVsZW1lbnRJZCk7XG4gICAgICAvLyBSZW1vdmUgYnJhbmNoIGVsZW1lbnRzIHRoYXQgcmVmZXJlbmNlIHRoZSBkZWxldGVkIGVsZW1lbnQsIGFuZCBhbHNvXG4gICAgICAvLyBwcnVuZSBhbnkgYnJhbmNoIHdob3NlIGFuY2hvciAoc3RhcnROb2RlSWQpIGlzIHRoZSBkZWxldGVkIGVsZW1lbnQgXHUyMDE0XG4gICAgICAvLyBhbiBvcnBoYW5lZCBicmFuY2ggd2l0aCBubyBhbmNob3IgZWxlbWVudCByZW5kZXJzIGFzIGRhbmdsaW5nIHdpcmVzLlxuICAgICAgcnVuZy5icmFuY2hlcyA9IHJ1bmcuYnJhbmNoZXMuZmlsdGVyKGJyID0+IGJyLnN0YXJ0Tm9kZUlkICE9PSBlbGVtZW50SWQpO1xuICAgICAgZm9yIChjb25zdCBicmFuY2ggb2YgcnVuZy5icmFuY2hlcykge1xuICAgICAgICBicmFuY2guZWxlbWVudHMgPSBicmFuY2guZWxlbWVudHMuZmlsdGVyKGVsID0+IGVsLmlkICE9PSBlbGVtZW50SWQpO1xuICAgICAgfVxuICAgICAgdGhpcy5fcmVidWlsZENyb3NzUmVmKGQpO1xuICAgIH0pO1xuICB9XG5cbiAgYWRkQnJhbmNoVG9SdW5nKHJ1bmdJZDogc3RyaW5nLCBicmFuY2g6IEJyYW5jaCkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBjb25zdCBydW5nID0gZC5sYWRkZXJQcm9ncmFtLnJ1bmdzLmZpbmQociA9PiByLmlkID09PSBydW5nSWQpO1xuICAgICAgaWYgKHJ1bmcpIHJ1bmcuYnJhbmNoZXMucHVzaChicmFuY2gpO1xuICAgIH0pO1xuICB9XG5cbiAgYWRkUGFyYWxsZWxCcmFuY2gocnVuZ0lkOiBzdHJpbmcsIGFuY2hvckVsSWQ6IHN0cmluZywga2luZDogc3RyaW5nLCB0YWc6IHsgbmFtZTogc3RyaW5nOyBkYXRhVHlwZTogJ0JPT0wnIH0pIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgY29uc3QgcnVuZyA9IGQubGFkZGVyUHJvZ3JhbS5ydW5ncy5maW5kKHIgPT4gci5pZCA9PT0gcnVuZ0lkKTtcbiAgICAgIGlmICghcnVuZykgcmV0dXJuO1xuICAgICAgY29uc3QgdWlkID0gKCkgPT4gYCR7RGF0ZS5ub3coKX0tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyLCA5KX1gO1xuICAgICAgbGV0IG5ld0VsOiBMYWRkZXJFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gICAgICBpZiAoa2luZC5zdGFydHNXaXRoKCdjb250YWN0JykpIHtcbiAgICAgICAgY29uc3QgdHlwZU1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICAgICAnY29udGFjdC1OTyc6ICdOTycsICdjb250YWN0LU5DJzogJ05DJyxcbiAgICAgICAgICAnY29udGFjdC1QJzogJ1BfQ09OVEFDVCcsICdjb250YWN0LU4nOiAnTl9DT05UQUNUJyxcbiAgICAgICAgfTtcbiAgICAgICAgbmV3RWwgPSB7IGtpbmQ6ICdjb250YWN0JywgaWQ6IGBjb250YWN0LSR7dWlkKCl9YCwgdHlwZTogKHR5cGVNYXBba2luZF0gPz8gJ05PJykgYXMgYW55LCB0YWcsIHBvc2l0aW9uOiB7IHg6IDAsIHk6IDAgfSB9O1xuICAgICAgfSBlbHNlIGlmIChraW5kLnN0YXJ0c1dpdGgoJ2NvaWwnKSkge1xuICAgICAgICBjb25zdCB0eXBlTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgICAgICdjb2lsLW5vcm1hbCc6ICdub3JtYWwnLCAnY29pbC1uZWdhdGVkJzogJ25lZ2F0ZWQnLFxuICAgICAgICAgICdjb2lsLXNldCc6ICdzZXQnLCAnY29pbC1yZXNldCc6ICdyZXNldCcsXG4gICAgICAgICAgJ2NvaWwtbGF0Y2gnOiAnbGF0Y2gnLCAnY29pbC11bmxhdGNoJzogJ3VubGF0Y2gnLFxuICAgICAgICB9O1xuICAgICAgICBuZXdFbCA9IHsga2luZDogJ2NvaWwnLCBpZDogYGNvaWwtJHt1aWQoKX1gLCB0eXBlOiAodHlwZU1hcFtraW5kXSA/PyAnbm9ybWFsJykgYXMgYW55LCB0YWcsIHBvc2l0aW9uOiB7IHg6IDAsIHk6IDAgfSB9O1xuICAgICAgfSBlbHNlIGlmIChraW5kLnN0YXJ0c1dpdGgoJ2Jsb2NrJykpIHtcbiAgICAgICAgY29uc3QgZmJUeXBlID0ga2luZC5yZXBsYWNlKCdibG9jay0nLCAnJykgYXMgYW55O1xuICAgICAgICBuZXdFbCA9IHsga2luZDogJ2Jsb2NrJywgaWQ6IGBibG9jay0ke3VpZCgpfWAsIGZiVHlwZSwgaW5zdGFuY2VOYW1lOiAnJywgcG9zaXRpb246IHsgeDogMCwgeTogMCB9IH07XG4gICAgICB9XG4gICAgICBpZiAoIW5ld0VsKSByZXR1cm47XG4gICAgICBjb25zdCBicmFuY2g6IEJyYW5jaCA9IHtcbiAgICAgICAgaWQ6IGBicmFuY2gtJHt1aWQoKX1gLFxuICAgICAgICBzdGFydE5vZGVJZDogYW5jaG9yRWxJZCxcbiAgICAgICAgZW5kTm9kZUlkOiBhbmNob3JFbElkLFxuICAgICAgICBlbGVtZW50czogW25ld0VsXSxcbiAgICAgIH07XG4gICAgICBydW5nLmJyYW5jaGVzLnB1c2goYnJhbmNoKTtcbiAgICAgIHRoaXMuX3JlYnVpbGRDcm9zc1JlZihkKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBGQkQgb3BlcmF0aW9ucyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgYWRkRkJETm9kZShub2RlOiBGQkROb2RlKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGQuZmJkUHJvZ3JhbS5ub2Rlcy5wdXNoKG5vZGUpO1xuICAgICAgdGhpcy5fcmVidWlsZENyb3NzUmVmKGQpO1xuICAgIH0pO1xuICB9XG5cbiAgdXBkYXRlRkJETm9kZShub2RlSWQ6IHN0cmluZywgdXBkYXRlczogUGFydGlhbDxGQkROb2RlPikge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBjb25zdCBub2RlID0gZC5mYmRQcm9ncmFtLm5vZGVzLmZpbmQobiA9PiBuLmlkID09PSBub2RlSWQpO1xuICAgICAgaWYgKG5vZGUpIE9iamVjdC5hc3NpZ24obm9kZSwgdXBkYXRlcyk7XG4gICAgICB0aGlzLl9yZWJ1aWxkQ3Jvc3NSZWYoZCk7XG4gICAgfSk7XG4gIH1cblxuICBkZWxldGVGQkROb2RlKG5vZGVJZDogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGQuZmJkUHJvZ3JhbS5ub2RlcyA9IGQuZmJkUHJvZ3JhbS5ub2Rlcy5maWx0ZXIobiA9PiBuLmlkICE9PSBub2RlSWQpO1xuICAgICAgZC5mYmRQcm9ncmFtLndpcmVzID0gZC5mYmRQcm9ncmFtLndpcmVzLmZpbHRlcih3ID0+IHcuZnJvbS5ub2RlSWQgIT09IG5vZGVJZCAmJiB3LnRvLm5vZGVJZCAhPT0gbm9kZUlkKTtcbiAgICAgIHRoaXMuX3JlYnVpbGRDcm9zc1JlZihkKTtcbiAgICB9KTtcbiAgfVxuXG4gIGFkZEZCRFdpcmUod2lyZTogRkJEV2lyZSkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7IGQuZmJkUHJvZ3JhbS53aXJlcy5wdXNoKHdpcmUpOyB9KTtcbiAgfVxuXG4gIGRlbGV0ZUZCRFdpcmUod2lyZUlkOiBzdHJpbmcpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4geyBkLmZiZFByb2dyYW0ud2lyZXMgPSBkLmZiZFByb2dyYW0ud2lyZXMuZmlsdGVyKHcgPT4gdy5pZCAhPT0gd2lyZUlkKTsgfSk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgU0ZDIG9wZXJhdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGFkZFNGQ1N0ZXAoc3RlcDogU0ZDU3RlcCkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7IGQuc2ZjUHJvZ3JhbS5zdGVwcy5wdXNoKHN0ZXApOyB9KTtcbiAgfVxuXG4gIHVwZGF0ZVNGQ1N0ZXAoc3RlcElkOiBzdHJpbmcsIHVwZGF0ZXM6IFBhcnRpYWw8U0ZDU3RlcD4pIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgY29uc3Qgc3RlcCA9IGQuc2ZjUHJvZ3JhbS5zdGVwcy5maW5kKHMgPT4gcy5pZCA9PT0gc3RlcElkKTtcbiAgICAgIGlmIChzdGVwKSBPYmplY3QuYXNzaWduKHN0ZXAsIHVwZGF0ZXMpO1xuICAgIH0pO1xuICB9XG5cbiAgZGVsZXRlU0ZDU3RlcChzdGVwSWQ6IHN0cmluZykge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBkLnNmY1Byb2dyYW0uc3RlcHMgPSBkLnNmY1Byb2dyYW0uc3RlcHMuZmlsdGVyKHMgPT4gcy5pZCAhPT0gc3RlcElkKTtcbiAgICAgIGQuc2ZjUHJvZ3JhbS5saW5rcyA9IGQuc2ZjUHJvZ3JhbS5saW5rcy5maWx0ZXIobCA9PiBsLmZyb20gIT09IHN0ZXBJZCAmJiBsLnRvICE9PSBzdGVwSWQpO1xuICAgIH0pO1xuICB9XG5cbiAgYWRkU0ZDVHJhbnNpdGlvbih0cmFuc2l0aW9uOiBTRkNUcmFuc2l0aW9uKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHsgZC5zZmNQcm9ncmFtLnRyYW5zaXRpb25zLnB1c2godHJhbnNpdGlvbik7IH0pO1xuICB9XG5cbiAgdXBkYXRlU0ZDVHJhbnNpdGlvbih0cmFuc0lkOiBzdHJpbmcsIHVwZGF0ZXM6IFBhcnRpYWw8U0ZDVHJhbnNpdGlvbj4pIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgY29uc3QgdCA9IGQuc2ZjUHJvZ3JhbS50cmFuc2l0aW9ucy5maW5kKHQgPT4gdC5pZCA9PT0gdHJhbnNJZCk7XG4gICAgICBpZiAodCkgT2JqZWN0LmFzc2lnbih0LCB1cGRhdGVzKTtcbiAgICB9KTtcbiAgfVxuXG4gIGRlbGV0ZVNGQ1RyYW5zaXRpb24odHJhbnNJZDogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGQuc2ZjUHJvZ3JhbS50cmFuc2l0aW9ucyA9IGQuc2ZjUHJvZ3JhbS50cmFuc2l0aW9ucy5maWx0ZXIodCA9PiB0LmlkICE9PSB0cmFuc0lkKTtcbiAgICAgIGQuc2ZjUHJvZ3JhbS5saW5rcyA9IGQuc2ZjUHJvZ3JhbS5saW5rcy5maWx0ZXIobCA9PiBsLmZyb20gIT09IHRyYW5zSWQgJiYgbC50byAhPT0gdHJhbnNJZCk7XG4gICAgfSk7XG4gIH1cblxuICBhZGRTRkNMaW5rKGxpbms6IFNGQ0xpbmspIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4geyBkLnNmY1Byb2dyYW0ubGlua3MucHVzaChsaW5rKTsgfSk7XG4gIH1cblxuICBkZWxldGVTRkNMaW5rKGxpbmtJZDogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHsgZC5zZmNQcm9ncmFtLmxpbmtzID0gZC5zZmNQcm9ncmFtLmxpbmtzLmZpbHRlcihsID0+IGwuaWQgIT09IGxpbmtJZCk7IH0pO1xuICB9XG5cbiAgYWRkU0ZDQnJhbmNoKGJyYW5jaDogU0ZDQnJhbmNoKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHsgZC5zZmNQcm9ncmFtLmJyYW5jaGVzLnB1c2goYnJhbmNoKTsgfSk7XG4gIH1cblxuICBkZWxldGVTRkNCcmFuY2goYnJhbmNoSWQ6IHN0cmluZykge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7IGQuc2ZjUHJvZ3JhbS5icmFuY2hlcyA9IGQuc2ZjUHJvZ3JhbS5icmFuY2hlcy5maWx0ZXIoYiA9PiBiLmlkICE9PSBicmFuY2hJZCk7IH0pO1xuICB9XG5cbiAgdXBkYXRlU0ZDTGlua0JhclBvc2l0aW9uKGxpbmtJZDogc3RyaW5nLCBwb3M6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBjb25zdCBsID0gZC5zZmNQcm9ncmFtLmxpbmtzLmZpbmQobCA9PiBsLmlkID09PSBsaW5rSWQpO1xuICAgICAgaWYgKGwpIGwuYmFyUG9zaXRpb24gPSBwb3M7XG4gICAgfSk7XG4gIH1cblxuICBhZGRTRkNKdW1wKGp1bXA6IFNGQ0p1bXApIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgaWYgKCFkLnNmY1Byb2dyYW0uanVtcHMpIGQuc2ZjUHJvZ3JhbS5qdW1wcyA9IFtdO1xuICAgICAgZC5zZmNQcm9ncmFtLmp1bXBzLnB1c2goanVtcCk7XG4gICAgfSk7XG4gIH1cblxuICB1cGRhdGVTRkNKdW1wKGp1bXBJZDogc3RyaW5nLCB0YXJnZXRTdGVwTmFtZTogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGlmICghZC5zZmNQcm9ncmFtLmp1bXBzKSByZXR1cm47XG4gICAgICBjb25zdCBqID0gZC5zZmNQcm9ncmFtLmp1bXBzLmZpbmQoaiA9PiBqLmlkID09PSBqdW1wSWQpO1xuICAgICAgaWYgKGopIGoudGFyZ2V0U3RlcE5hbWUgPSB0YXJnZXRTdGVwTmFtZTtcbiAgICB9KTtcbiAgfVxuXG4gIHVwZGF0ZVNGQ0p1bXBQb3NpdGlvbihqdW1wSWQ6IHN0cmluZywgcG9zaXRpb246IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBpZiAoIWQuc2ZjUHJvZ3JhbS5qdW1wcykgcmV0dXJuO1xuICAgICAgY29uc3QgaiA9IGQuc2ZjUHJvZ3JhbS5qdW1wcy5maW5kKGogPT4gai5pZCA9PT0ganVtcElkKTtcbiAgICAgIGlmIChqKSBqLnBvc2l0aW9uID0gcG9zaXRpb247XG4gICAgfSk7XG4gIH1cblxuICBkZWxldGVTRkNKdW1wKGp1bXBJZDogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGlmICghZC5zZmNQcm9ncmFtLmp1bXBzKSByZXR1cm47XG4gICAgICBkLnNmY1Byb2dyYW0uanVtcHMgPSBkLnNmY1Byb2dyYW0uanVtcHMuZmlsdGVyKGogPT4gai5pZCAhPT0ganVtcElkKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBTZWxlY3Rpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIHNldFNlbGVjdGlvbihpZHM6IHN0cmluZ1tdLCBydW5nSWQ/OiBzdHJpbmcpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgZC5zZWxlY3RlZEVsZW1lbnRJZHMgPSBuZXcgU2V0KGlkcyk7XG4gICAgICBkLnNlbGVjdGVkUnVuZ0lkID0gcnVuZ0lkID8/IG51bGw7XG4gICAgfSk7XG4gIH1cblxuICBjbGVhclNlbGVjdGlvbigpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgZC5zZWxlY3RlZEVsZW1lbnRJZHMgPSBuZXcgU2V0KCk7XG4gICAgICBkLnNlbGVjdGVkUnVuZ0lkID0gbnVsbDtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBDbGlwYm9hcmQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvcHlSdW5ncyhydW5nSWRzOiBzdHJpbmdbXSkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBkLmNsaXBib2FyZC5ydW5ncyA9IGQubGFkZGVyUHJvZ3JhbS5ydW5ncy5maWx0ZXIociA9PiBydW5nSWRzLmluY2x1ZGVzKHIuaWQpKVxuICAgICAgICAubWFwKHIgPT4gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShyKSkpO1xuICAgIH0pO1xuICB9XG5cbiAgcGFzdGVSdW5ncyhhZnRlckluZGV4PzogbnVtYmVyKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGlmICghZC5jbGlwYm9hcmQucnVuZ3M/Lmxlbmd0aCkgcmV0dXJuO1xuICAgICAgY29uc3QgbmV3UnVuZ3MgPSBkLmNsaXBib2FyZC5ydW5ncy5tYXAociA9PiAoe1xuICAgICAgICAuLi5KU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHIpKSxcbiAgICAgICAgaWQ6IGBydW5nLSR7RGF0ZS5ub3coKX0tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKX1gLFxuICAgICAgICBlbGVtZW50czogci5lbGVtZW50cy5tYXAoZWwgPT4gKHsgLi4uZWwsIGlkOiBgJHtlbC5pZH0tcC0ke0RhdGUubm93KCl9YCB9KSksXG4gICAgICB9KSk7XG4gICAgICBpZiAoYWZ0ZXJJbmRleCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGQubGFkZGVyUHJvZ3JhbS5ydW5ncy5zcGxpY2UoYWZ0ZXJJbmRleCArIDEsIDAsIC4uLm5ld1J1bmdzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGQubGFkZGVyUHJvZ3JhbS5ydW5ncy5wdXNoKC4uLm5ld1J1bmdzKTtcbiAgICAgIH1cbiAgICAgIGQubGFkZGVyUHJvZ3JhbS5ydW5ncy5mb3JFYWNoKChyLCBpKSA9PiB7IHIubnVtYmVyID0gaSArIDE7IH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIEZCRCBDbGlwYm9hcmQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvcHlGQkROb2Rlcyhub2RlSWRzOiBzdHJpbmdbXSkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBkLmNsaXBib2FyZC5mYmROb2RlcyA9IGQuZmJkUHJvZ3JhbS5ub2Rlc1xuICAgICAgICAuZmlsdGVyKG4gPT4gbm9kZUlkcy5pbmNsdWRlcyhuLmlkKSlcbiAgICAgICAgLm1hcChuID0+IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkobikpKTtcbiAgICB9KTtcbiAgfVxuXG4gIHBhc3RlRkJETm9kZXMob2Zmc2V0WCA9IDQwLCBvZmZzZXRZID0gNDApIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgaWYgKCFkLmNsaXBib2FyZC5mYmROb2Rlcz8ubGVuZ3RoKSByZXR1cm47XG4gICAgICBjb25zdCB1aWQgPSAoKSA9PiBgJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIsIDcpfWA7XG4gICAgICBjb25zdCBuZXdOb2RlcyA9IGQuY2xpcGJvYXJkLmZiZE5vZGVzLm1hcChuID0+ICh7XG4gICAgICAgIC4uLkpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkobikpLFxuICAgICAgICBpZDogYGZiZC0ke24udHlwZS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL18vZywgJy0nKX0tJHt1aWQoKX1gLFxuICAgICAgICBwb3NpdGlvbjogeyB4OiBuLnBvc2l0aW9uLnggKyBvZmZzZXRYLCB5OiBuLnBvc2l0aW9uLnkgKyBvZmZzZXRZIH0sXG4gICAgICAgIGlucHV0czogIG4uaW5wdXRzLm1hcCgocDogUGluKSAgPT4gKHsgLi4ucCwgaWQ6IGAke3AuaWR9LXAtJHt1aWQoKX1gIH0pKSxcbiAgICAgICAgb3V0cHV0czogbi5vdXRwdXRzLm1hcCgocDogUGluKSA9PiAoeyAuLi5wLCBpZDogYCR7cC5pZH0tcC0ke3VpZCgpfWAgfSkpLFxuICAgICAgfSkpO1xuICAgICAgZC5mYmRQcm9ncmFtLm5vZGVzLnB1c2goLi4ubmV3Tm9kZXMpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFRhZyBkYXRhYmFzZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgc2V0VGFnRGF0YWJhc2UodGFnczogVGFnRW50cnlbXSkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7IGQudGFnRGF0YWJhc2UgPSB0YWdzOyB9KTtcbiAgfVxuXG4gIGNyZWF0ZVRhZyh0YWc6IFRhZ0VudHJ5KSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGlmICghZC50YWdEYXRhYmFzZS5maW5kKHQgPT4gdC5uYW1lID09PSB0YWcubmFtZSkpIHtcbiAgICAgICAgZC50YWdEYXRhYmFzZS5wdXNoKHRhZyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICB1cGRhdGVUYWcobmFtZTogc3RyaW5nLCB1cGRhdGVzOiBQYXJ0aWFsPFRhZ0VudHJ5Pikge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBjb25zdCB0YWcgPSBkLnRhZ0RhdGFiYXNlLmZpbmQodCA9PiB0Lm5hbWUgPT09IG5hbWUpO1xuICAgICAgaWYgKHRhZykgT2JqZWN0LmFzc2lnbih0YWcsIHVwZGF0ZXMpO1xuICAgIH0pO1xuICB9XG5cbiAgdXBkYXRlVGFnTGl2ZVZhbHVlKHRhZ05hbWU6IHN0cmluZywgdmFsdWU6IHN0cmluZykge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBjb25zdCB0YWcgPSBkLnRhZ0RhdGFiYXNlLmZpbmQodCA9PiB0Lm5hbWUgPT09IHRhZ05hbWUpO1xuICAgICAgaWYgKHRhZykgdGFnLmxpdmVWYWx1ZSA9IHZhbHVlO1xuICAgIH0pO1xuICB9XG5cbiAgY2xlYXJMaXZlVmFsdWVzKCkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBmb3IgKGNvbnN0IHRhZyBvZiBkLnRhZ0RhdGFiYXNlKSB7XG4gICAgICAgIHRhZy5saXZlVmFsdWUgPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgICAvLyBDbGVhciBhbGwgZWxlbWVudCBlbmVyZ2l6ZWQgc3RhdGVzXG4gICAgICBmb3IgKGNvbnN0IHJ1bmcgb2YgZC5sYWRkZXJQcm9ncmFtLnJ1bmdzKSB7XG4gICAgICAgIHJ1bmcuZW5lcmdpemVkID0gZmFsc2U7XG4gICAgICAgIGZvciAoY29uc3QgZWwgb2YgcnVuZy5lbGVtZW50cykgKGVsIGFzIGFueSkuZW5lcmdpemVkID0gZmFsc2U7XG4gICAgICAgIGZvciAoY29uc3QgYnJhbmNoIG9mIHJ1bmcuYnJhbmNoZXMpIHtcbiAgICAgICAgICBicmFuY2guZW5lcmdpemVkID0gZmFsc2U7XG4gICAgICAgICAgZm9yIChjb25zdCBlbCBvZiBicmFuY2guZWxlbWVudHMpIChlbCBhcyBhbnkpLmVuZXJnaXplZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IG5vZGUgb2YgZC5mYmRQcm9ncmFtLm5vZGVzKSAobm9kZSBhcyBhbnkpLmVuZXJnaXplZCA9IGZhbHNlO1xuICAgICAgZm9yIChjb25zdCB3aXJlIG9mIGQuZmJkUHJvZ3JhbS53aXJlcykgd2lyZS5lbmVyZ2l6ZWQgPSBmYWxzZTtcbiAgICAgIGZvciAoY29uc3Qgc3RlcCBvZiBkLnNmY1Byb2dyYW0uc3RlcHMpIChzdGVwIGFzIGFueSkuaXNBY3RpdmUgPSBmYWxzZTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX2VuZ2luZVJlZjogYW55ID0gbnVsbDtcbiAgX3NldEVuZ2luZVJlZihlbmdpbmU6IGFueSkgeyB0aGlzLl9lbmdpbmVSZWYgPSBlbmdpbmU7IH1cblxuICBmb3JjZVRhZyh0YWdOYW1lOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcpIHtcbiAgICBpZiAoIXRhZ05hbWUpIHJldHVybjtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgbGV0IHRhZyA9IGQudGFnRGF0YWJhc2UuZmluZCh0ID0+IHQubmFtZSA9PT0gdGFnTmFtZSk7XG4gICAgICBpZiAoIXRhZykge1xuICAgICAgICAvLyBBdXRvLWNyZWF0ZSB0YWcgaWYgcmVmZXJlbmNlZCBieSBhbiBlbGVtZW50IGJ1dCBub3QgeWV0IGluIHRoZSBkYXRhYmFzZVxuICAgICAgICB0YWcgPSB7IGlkOiBgdGFnLSR7dGFnTmFtZX0tJHtEYXRlLm5vdygpfWAsIG5hbWU6IHRhZ05hbWUsIGRhdGFUeXBlOiAnQk9PTCcsIGFkZHJlc3M6ICcnLCBkZXNjcmlwdGlvbjogJycgfTtcbiAgICAgICAgZC50YWdEYXRhYmFzZS5wdXNoKHRhZyk7XG4gICAgICB9XG4gICAgICB0YWcuZm9yY2VkVmFsdWUgPSB2YWx1ZTtcbiAgICAgIHRhZy5saXZlVmFsdWUgPSB2YWx1ZTtcbiAgICB9KTtcbiAgICAvLyBBbHdheXMgcHVzaCB0aGUgZm9yY2VkIHZhbHVlIHRvIHRoZSBlbmdpbmUgcmVnYXJkbGVzcyBvZiBydW4gc3RhdGUuXG4gICAgLy8gVGhlIGVuZ2luZSB3aWxsIGFwcGx5IGl0IHRvIHRhZ1ZhbHVlcyBpbW1lZGlhdGVseSBhbmQgcmVjb21wdXRlIGVuZXJnaXplZFxuICAgIC8vIHN0YXRlcyBzbyB0aGUgZ3JhcGhpY2FsIGVkaXRvciBjYW52YXMgdXBkYXRlcyBldmVuIHdoZW4gc2ltdWxhdGlvbiBpcyBzdG9wcGVkLlxuICAgIGlmICh0aGlzLl9lbmdpbmVSZWYpIHtcbiAgICAgIGNvbnN0IHBhcnNlZCA9IHZhbHVlID09PSAnVFJVRScgfHwgdmFsdWUgPT09ICd0cnVlJyA/IHRydWUgOiB2YWx1ZSA9PT0gJ0ZBTFNFJyB8fCB2YWx1ZSA9PT0gJ2ZhbHNlJyA/IGZhbHNlIDogdmFsdWU7XG4gICAgICB0aGlzLl9lbmdpbmVSZWYuZm9yY2VUYWcodGFnTmFtZSwgcGFyc2VkKTtcbiAgICB9XG4gIH1cblxuICByZWxlYXNlRm9yY2UodGFnTmFtZTogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGNvbnN0IHRhZyA9IGQudGFnRGF0YWJhc2UuZmluZCh0ID0+IHQubmFtZSA9PT0gdGFnTmFtZSk7XG4gICAgICBpZiAodGFnKSB7IHRhZy5mb3JjZWRWYWx1ZSA9IHVuZGVmaW5lZDsgdGFnLmxpdmVWYWx1ZSA9IHVuZGVmaW5lZDsgfVxuICAgIH0pO1xuICAgIGlmICh0aGlzLl9lbmdpbmVSZWYpIHtcbiAgICAgIHRoaXMuX2VuZ2luZVJlZi5yZWxlYXNlRm9yY2UodGFnTmFtZSk7XG4gICAgfVxuICB9XG5cbiAgYmF0Y2hVcGRhdGVUYWdWYWx1ZXModmFsdWVzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyh2YWx1ZXMpKSB7XG4gICAgICAgIGxldCB0YWcgPSBkLnRhZ0RhdGFiYXNlLmZpbmQodCA9PiB0Lm5hbWUgPT09IG5hbWUpO1xuICAgICAgICBpZiAoIXRhZykge1xuICAgICAgICAgIHRhZyA9IHsgaWQ6IGB0YWctJHtuYW1lfS1hdXRvYCwgbmFtZSwgZGF0YVR5cGU6ICdCT09MJywgYWRkcmVzczogJycsIGRlc2NyaXB0aW9uOiAnJyB9O1xuICAgICAgICAgIGQudGFnRGF0YWJhc2UucHVzaCh0YWcpO1xuICAgICAgICB9XG4gICAgICAgIC8vIFNraXAgbGl2ZVZhbHVlIHVwZGF0ZSBmb3IgZm9yY2VkIHRhZ3MgXHUyMDE0IGZvcmNlZCB2YWx1ZSB0YWtlcyBwcmVjZWRlbmNlXG4gICAgICAgIGlmICh0YWcuZm9yY2VkVmFsdWUgPT09IHVuZGVmaW5lZCkgdGFnLmxpdmVWYWx1ZSA9IFN0cmluZyh2YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICB1cGRhdGVFbmVyZ2l6ZWRTdGF0ZXMoZW5lcmdpemVkOiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPiwgYmxvY2tQaW5WYWx1ZXM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+LCBmYmRQaW5WYWx1ZXM/OiBSZWNvcmQ8c3RyaW5nLCBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+PiwgcG93ZXJBZnRlcj86IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+KSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGlmIChmYmRQaW5WYWx1ZXMpIGQuZmJkQmxvY2tQaW5WYWx1ZXMgPSBmYmRQaW5WYWx1ZXM7XG4gICAgICBmb3IgKGNvbnN0IHJ1bmcgb2YgZC5sYWRkZXJQcm9ncmFtLnJ1bmdzKSB7XG4gICAgICAgIGZvciAoY29uc3QgZWwgb2YgcnVuZy5lbGVtZW50cykge1xuICAgICAgICAgIChlbCBhcyBhbnkpLmVuZXJnaXplZCA9ICEhZW5lcmdpemVkW2VsLmlkXTtcbiAgICAgICAgICBpZiAocG93ZXJBZnRlciAhPT0gdW5kZWZpbmVkKSAoZWwgYXMgYW55KS5wb3dlckFmdGVyID0gISFwb3dlckFmdGVyW2VsLmlkXTtcbiAgICAgICAgICAvLyBQb3B1bGF0ZSBwZXItcGluIG91dHB1dCB2YWx1ZXMgZm9yIEZCIGJsb2Nrc1xuICAgICAgICAgIGlmIChlbC5raW5kID09PSAnYmxvY2snICYmIGJsb2NrUGluVmFsdWVzKSB7XG4gICAgICAgICAgICBjb25zdCBwaW5WYWxzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbF0gb2YgT2JqZWN0LmVudHJpZXMoYmxvY2tQaW5WYWx1ZXMpKSB7XG4gICAgICAgICAgICAgIGlmIChrZXkuc3RhcnRzV2l0aChlbC5pZCArICc6JykpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwaW4gPSBrZXkuc2xpY2UoZWwuaWQubGVuZ3RoICsgMSk7XG4gICAgICAgICAgICAgICAgcGluVmFsc1twaW5dID0gdmFsO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMocGluVmFscykubGVuZ3RoID4gMCkgZWwucGluVmFsdWVzID0gcGluVmFscztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBicmFuY2ggb2YgcnVuZy5icmFuY2hlcykge1xuICAgICAgICAgIGZvciAoY29uc3QgZWwgb2YgYnJhbmNoLmVsZW1lbnRzKSB7XG4gICAgICAgICAgICAoZWwgYXMgYW55KS5lbmVyZ2l6ZWQgPSAhIWVuZXJnaXplZFtlbC5pZF07XG4gICAgICAgICAgICBpZiAocG93ZXJBZnRlciAhPT0gdW5kZWZpbmVkKSAoZWwgYXMgYW55KS5wb3dlckFmdGVyID0gISFwb3dlckFmdGVyW2VsLmlkXTtcbiAgICAgICAgICAgIGlmIChlbC5raW5kID09PSAnYmxvY2snICYmIGJsb2NrUGluVmFsdWVzKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHBpblZhbHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCBba2V5LCB2YWxdIG9mIE9iamVjdC5lbnRyaWVzKGJsb2NrUGluVmFsdWVzKSkge1xuICAgICAgICAgICAgICAgIGlmIChrZXkuc3RhcnRzV2l0aChlbC5pZCArICc6JykpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHBpbiA9IGtleS5zbGljZShlbC5pZC5sZW5ndGggKyAxKTtcbiAgICAgICAgICAgICAgICAgIHBpblZhbHNbcGluXSA9IHZhbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKE9iamVjdC5rZXlzKHBpblZhbHMpLmxlbmd0aCA+IDApIGVsLnBpblZhbHVlcyA9IHBpblZhbHM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIFJ1bmcgaXMgZW5lcmdpemVkIHdoZW4gQU5ZIGNvaWwgcmVjZWl2ZXMgcG93ZXIuXG4gICAgICAgIC8vIENvaWwgZW5lcmdpemVkID0gcG93ZXJJbiB0byBjb2lsLiBJZiBubyBjb2lsLCBjaGVjayBsYXN0IGNvbnRhY3QuXG4gICAgICAgIGNvbnN0IGNvaWxzID0gcnVuZy5lbGVtZW50cy5maWx0ZXIoZSA9PiBlLmtpbmQgPT09ICdjb2lsJyk7XG4gICAgICAgIGNvbnN0IGxhc3RFbCA9IHJ1bmcuZWxlbWVudHMuYXQoLTEpO1xuICAgICAgICBpZiAoY29pbHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHJ1bmcuZW5lcmdpemVkID0gY29pbHMuc29tZShjID0+ICEhKGMgYXMgYW55KS5lbmVyZ2l6ZWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJ1bmcuZW5lcmdpemVkID0gbGFzdEVsID8gISEobGFzdEVsIGFzIGFueSkuZW5lcmdpemVkIDogZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQnJhbmNoIGJhciBjb2xvciA9IGRpZCBwb3dlciBmbG93IFRIUk9VR0ggdGhlIGJyYW5jaD9cbiAgICAgICAgLy8gVXNlIGVuZXJnaXplZFtsYXN0QnJhbmNoRWxdIFx1MjAxNCB0aGlzIGlzIHNvdXJjZVJlYWNoYWJsZSAmJiBlZGdlQ29uZHVjdHMsIHdoaWNoIGlzIHRydWUgb25seVxuICAgICAgICAvLyB3aGVuIHBvd2VyIGFycml2ZWQgYXQgdGhlIGJyYW5jaCBlbnRyeSBBTkQgdGhlIGxhc3QgZWxlbWVudCBwYXNzZWQgaXQuIHBvd2VyQWZ0ZXIgaXMgd3JvbmdcbiAgICAgICAgLy8gaGVyZSBiZWNhdXNlIHRoZSB0YXJnZXQganVuY3Rpb24gY2FuIGJlIHJlYWNoZWQgdmlhIHRoZSBtYWluIHJhaWwsIGdpdmluZyBhIGZhbHNlIHBvc2l0aXZlLlxuICAgICAgICBmb3IgKGNvbnN0IGJyYW5jaCBvZiBydW5nLmJyYW5jaGVzKSB7XG4gICAgICAgICAgY29uc3QgbGFzdEJyYW5jaEVsID0gYnJhbmNoLmVsZW1lbnRzLmF0KC0xKTtcbiAgICAgICAgICBpZiAoIWxhc3RCcmFuY2hFbCkgeyBicmFuY2guZW5lcmdpemVkID0gZmFsc2U7IGNvbnRpbnVlOyB9XG4gICAgICAgICAgYnJhbmNoLmVuZXJnaXplZCA9ICEhKGxhc3RCcmFuY2hFbCBhcyBhbnkpLmVuZXJnaXplZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBub2RlIG9mIGQuZmJkUHJvZ3JhbS5ub2Rlcykge1xuICAgICAgICAobm9kZSBhcyBhbnkpLmVuZXJnaXplZCA9ICEhZW5lcmdpemVkW25vZGUuaWRdO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCB3aXJlIG9mIGQuZmJkUHJvZ3JhbS53aXJlcykge1xuICAgICAgICB3aXJlLmVuZXJnaXplZCA9ICEhZW5lcmdpemVkW3dpcmUuZnJvbS5ub2RlSWRdO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgdXBkYXRlU0ZDQWN0aXZlU3RlcHMoYWN0aXZlOiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPikge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBmb3IgKGNvbnN0IHN0ZXAgb2YgZC5zZmNQcm9ncmFtLnN0ZXBzKSB7XG4gICAgICAgIChzdGVwIGFzIGFueSkuaXNBY3RpdmUgPSAhIWFjdGl2ZVtzdGVwLmlkXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBNb25pdG9yIG1vZGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIHNldE1vbml0b3JNb2RlKG1vZGU6IE1vbml0b3JNb2RlKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHsgZC5tb25pdG9yTW9kZSA9IG1vZGU7IH0pO1xuICB9XG5cbiAgc2V0U2NhblJhdGUobXM6IG51bWJlcikge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7IGQuc2NhblJhdGUgPSBtczsgfSk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgV2F0Y2ggbGlzdCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgYWRkVG9XYXRjaExpc3QodGFnTmFtZTogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGlmICghZC53YXRjaGVkVGFncy5pbmNsdWRlcyh0YWdOYW1lKSkgZC53YXRjaGVkVGFncy5wdXNoKHRhZ05hbWUpO1xuICAgIH0pO1xuICB9XG5cbiAgcmVtb3ZlRnJvbVdhdGNoTGlzdCh0YWdOYW1lOiBzdHJpbmcpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgZC53YXRjaGVkVGFncyA9IGQud2F0Y2hlZFRhZ3MuZmlsdGVyKG4gPT4gbiAhPT0gdGFnTmFtZSk7XG4gICAgfSk7XG4gIH1cblxuICBhZGRBbGxUYWdzVG9XYXRjaExpc3QoKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGQud2F0Y2hlZFRhZ3MgPSBkLnRhZ0RhdGFiYXNlLm1hcCh0ID0+IHQubmFtZSk7XG4gICAgfSk7XG4gIH1cblxuICBjbGVhcldhdGNoTGlzdCgpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4geyBkLndhdGNoZWRUYWdzID0gW107IH0pO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFVJIHN0YXRlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBzZXRab29tKHpvb206IG51bWJlcikge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7IGQuem9vbSA9IE1hdGgubWF4KDAuMjUsIE1hdGgubWluKDQsIHpvb20pKTsgfSk7XG4gIH1cblxuICB0b2dnbGVHcmlkKCkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7IGQuc2hvd0dyaWQgPSAhZC5zaG93R3JpZDsgfSk7XG4gIH1cblxuICBzZXRTZWFyY2hRdWVyeShxOiBzdHJpbmcpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4geyBkLnNlYXJjaFF1ZXJ5ID0gcTsgfSk7XG4gIH1cblxuICBvcGVuQ3Jvc3NSZWYodGFnTmFtZTogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGQuY3Jvc3NSZWZQYW5lbE9wZW4gPSB0cnVlO1xuICAgICAgZC5jcm9zc1JlZlRhcmdldCA9IHRhZ05hbWU7XG4gICAgfSk7XG4gIH1cblxuICBjbG9zZUNyb3NzUmVmKCkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7IGQuY3Jvc3NSZWZQYW5lbE9wZW4gPSBmYWxzZTsgZC5jcm9zc1JlZlRhcmdldCA9IG51bGw7IH0pO1xuICB9XG5cbiAgb3Blbkluc3BlY3RvcihlbGVtZW50SWQ6IHN0cmluZykge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7IGQuaW5zcGVjdG9yT3BlbiA9IHRydWU7IGQuaW5zcGVjdG9yRWxlbWVudElkID0gZWxlbWVudElkOyB9KTtcbiAgfVxuXG4gIGNsb3NlSW5zcGVjdG9yKCkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7IGQuaW5zcGVjdG9yT3BlbiA9IGZhbHNlOyBkLmluc3BlY3RvckVsZW1lbnRJZCA9IG51bGw7IH0pO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIExvYWQgcHJvZ3JhbXMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIHNldEltcG9ydGVkU2lkZWNhcihzaWRlY2FyOiBpbXBvcnQoJy4vdmVuZG9yL3R5cGVzLmpzJykuVmVuZG9yTWV0YWRhdGFTaWRlY2FyIHwgbnVsbCkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7IGQuaW1wb3J0ZWRTaWRlY2FyID0gc2lkZWNhciBhcyBhbnk7IH0pO1xuICB9XG5cbiAgbG9hZExhZGRlclByb2dyYW0ocHJvZ3JhbTogTGFkZGVyUHJvZ3JhbSkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBkLmxhZGRlclByb2dyYW0gPSBwcm9ncmFtO1xuICAgICAgdGhpcy5fcmVidWlsZENyb3NzUmVmKGQpO1xuICAgIH0pO1xuICB9XG5cbiAgbG9hZEZCRFByb2dyYW0ocHJvZ3JhbTogRkJEUHJvZ3JhbSkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBkLmZiZFByb2dyYW0gPSBwcm9ncmFtO1xuICAgICAgdGhpcy5fcmVidWlsZENyb3NzUmVmKGQpO1xuICAgIH0pO1xuICB9XG5cbiAgbG9hZFNGQ1Byb2dyYW0ocHJvZ3JhbTogU0ZDUHJvZ3JhbSkge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7IGQuc2ZjUHJvZ3JhbSA9IHByb2dyYW07IH0pO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIENvbnNvbGUgbG9nIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBhZGRDb25zb2xlRW50cnkobGV2ZWw6ICdpbmZvJyB8ICd3YXJuJyB8ICdlcnJvcicgfCAnc3VjY2VzcycsIG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBkLmNvbnNvbGVMb2cucHVzaCh7IHRpbWVzdGFtcDogRGF0ZS5ub3coKSwgbGV2ZWwsIG1lc3NhZ2UgfSk7XG4gICAgICBpZiAoZC5jb25zb2xlTG9nLmxlbmd0aCA+IDIwMCkgZC5jb25zb2xlTG9nLnNwbGljZSgwLCBkLmNvbnNvbGVMb2cubGVuZ3RoIC0gMjAwKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNsZWFyQ29uc29sZSgpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4geyBkLmNvbnNvbGVMb2cgPSBbXTsgfSk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgTXVsdGktUE9VIG9wZXJhdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGFkZFBPVShuYW1lOiBzdHJpbmcsIGxhbmd1YWdlOiAnTEQnIHwgJ0ZCRCcgfCAnU0ZDJykge1xuICAgIHRoaXMuc2V0U3RhdGUoZCA9PiB7XG4gICAgICBjb25zdCBuZXdQT1U6IFBPVSA9IHtcbiAgICAgICAgaWQ6IGBwb3UtJHtEYXRlLm5vdygpfWAsXG4gICAgICAgIG5hbWUsXG4gICAgICAgIGxhbmd1YWdlLFxuICAgICAgICBsYWRkZXJQcm9ncmFtOiB7IHJ1bmdzOiBbXSB9LFxuICAgICAgICBmYmRQcm9ncmFtOiB7IG5vZGVzOiBbXSwgd2lyZXM6IFtdIH0sXG4gICAgICAgIHNmY1Byb2dyYW06IHsgc3RlcHM6IFtdLCB0cmFuc2l0aW9uczogW10sIGxpbmtzOiBbXSwgYnJhbmNoZXM6IFtdLCBqdW1wczogW10gfSxcbiAgICAgIH07XG4gICAgICBkLnBvdXMucHVzaChuZXdQT1UpO1xuICAgIH0pO1xuICB9XG5cbiAgc2V0QWN0aXZlUE9VKGlkOiBzdHJpbmcpIHtcbiAgICB0aGlzLnNldFN0YXRlKGQgPT4ge1xuICAgICAgY29uc3QgcG91ID0gZC5wb3VzLmZpbmQocCA9PiBwLmlkID09PSBpZCk7XG4gICAgICBpZiAoIXBvdSkgcmV0dXJuO1xuICAgICAgZC5hY3RpdmVQb3VJZCA9IGlkO1xuICAgICAgLy8gTWlycm9yIGFjdGl2ZSBQT1UgcHJvZ3JhbXMgaW50byB0b3AtbGV2ZWwgZmllbGRzIHNvIGV4aXN0aW5nIGVkaXRvcnMgd29ya1xuICAgICAgZC5sYWRkZXJQcm9ncmFtID0gcG91LmxhZGRlclByb2dyYW07XG4gICAgICBkLmZiZFByb2dyYW0gICAgPSBwb3UuZmJkUHJvZ3JhbTtcbiAgICAgIGQuc2ZjUHJvZ3JhbSAgICA9IHBvdS5zZmNQcm9ncmFtO1xuICAgICAgZC5hY3RpdmVMYW5ndWFnZSA9IHBvdS5sYW5ndWFnZTtcbiAgICAgIHRoaXMuX3JlYnVpbGRDcm9zc1JlZihkKTtcbiAgICB9KTtcbiAgfVxuXG4gIGRlbGV0ZVBPVShpZDogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGlmIChkLnBvdXMubGVuZ3RoIDw9IDEpIHJldHVybjsgLy8gY2FuJ3QgZGVsZXRlIGxhc3QgUE9VXG4gICAgICBkLnBvdXMgPSBkLnBvdXMuZmlsdGVyKHAgPT4gcC5pZCAhPT0gaWQpO1xuICAgICAgLy8gSWYgZGVsZXRlZCB0aGUgYWN0aXZlIFBPVSwgc3dpdGNoIHRvIGZpcnN0XG4gICAgICBpZiAoZC5hY3RpdmVQb3VJZCA9PT0gaWQpIHtcbiAgICAgICAgY29uc3QgZmlyc3QgPSBkLnBvdXNbMF07XG4gICAgICAgIGQuYWN0aXZlUG91SWQgICAgPSBmaXJzdC5pZDtcbiAgICAgICAgZC5sYWRkZXJQcm9ncmFtICA9IGZpcnN0LmxhZGRlclByb2dyYW07XG4gICAgICAgIGQuZmJkUHJvZ3JhbSAgICAgPSBmaXJzdC5mYmRQcm9ncmFtO1xuICAgICAgICBkLnNmY1Byb2dyYW0gICAgID0gZmlyc3Quc2ZjUHJvZ3JhbTtcbiAgICAgICAgZC5hY3RpdmVMYW5ndWFnZSA9IGZpcnN0Lmxhbmd1YWdlO1xuICAgICAgICB0aGlzLl9yZWJ1aWxkQ3Jvc3NSZWYoZCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICByZW5hbWVQT1UoaWQ6IHN0cmluZywgbmFtZTogc3RyaW5nKSB7XG4gICAgdGhpcy5zZXRTdGF0ZShkID0+IHtcbiAgICAgIGNvbnN0IHBvdSA9IGQucG91cy5maW5kKHAgPT4gcC5pZCA9PT0gaWQpO1xuICAgICAgaWYgKHBvdSkgcG91Lm5hbWUgPSBuYW1lO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIENyb3NzLXJlZmVyZW5jZSBpbmRleCByZWJ1aWxkIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBwcml2YXRlIF9yZWJ1aWxkQ3Jvc3NSZWYoZDogTG9naWNTdG9yZVN0YXRlKSB7XG4gICAgY29uc3QgaW5kZXggPSBuZXcgTWFwPHN0cmluZywgQXJyYXk8eyBydW5nSWQ/OiBzdHJpbmc7IGVsZW1lbnRJZDogc3RyaW5nOyBsYW5ndWFnZTogRWRpdG9yTGFuZ3VhZ2UgfT4+KCk7XG5cbiAgICBjb25zdCBhZGRSZWYgPSAodGFnTmFtZTogc3RyaW5nLCBydW5nSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgZWxlbWVudElkOiBzdHJpbmcsIGxhbmd1YWdlOiBFZGl0b3JMYW5ndWFnZSkgPT4ge1xuICAgICAgaWYgKCF0YWdOYW1lKSByZXR1cm47XG4gICAgICBpZiAoIWluZGV4Lmhhcyh0YWdOYW1lKSkgaW5kZXguc2V0KHRhZ05hbWUsIFtdKTtcbiAgICAgIGluZGV4LmdldCh0YWdOYW1lKSEucHVzaCh7IHJ1bmdJZCwgZWxlbWVudElkLCBsYW5ndWFnZSB9KTtcbiAgICB9O1xuXG4gICAgLy8gTGFkZGVyXG4gICAgZm9yIChjb25zdCBydW5nIG9mIGQubGFkZGVyUHJvZ3JhbS5ydW5ncykge1xuICAgICAgZm9yIChjb25zdCBlbCBvZiBydW5nLmVsZW1lbnRzKSB7XG4gICAgICAgIGlmIChlbC5raW5kID09PSAnY29udGFjdCcgfHwgZWwua2luZCA9PT0gJ2NvaWwnKSB7XG4gICAgICAgICAgYWRkUmVmKGVsLnRhZy5uYW1lLCBydW5nLmlkLCBlbC5pZCwgJ0xEJyk7XG4gICAgICAgIH0gZWxzZSBpZiAoZWwua2luZCA9PT0gJ2Jsb2NrJykge1xuICAgICAgICAgIGZvciAoY29uc3QgWywgdGFnUmVmXSBvZiBPYmplY3QuZW50cmllcyhlbC5waW5zKSkge1xuICAgICAgICAgICAgYWRkUmVmKHRhZ1JlZi5uYW1lLCBydW5nLmlkLCBlbC5pZCwgJ0xEJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGJyYW5jaCBvZiBydW5nLmJyYW5jaGVzKSB7XG4gICAgICAgIGZvciAoY29uc3QgZWwgb2YgYnJhbmNoLmVsZW1lbnRzKSB7XG4gICAgICAgICAgaWYgKGVsLmtpbmQgPT09ICdjb250YWN0JyB8fCBlbC5raW5kID09PSAnY29pbCcpIHtcbiAgICAgICAgICAgIGFkZFJlZihlbC50YWcubmFtZSwgcnVuZy5pZCwgZWwuaWQsICdMRCcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEZCRFxuICAgIGZvciAoY29uc3Qgbm9kZSBvZiBkLmZiZFByb2dyYW0ubm9kZXMpIHtcbiAgICAgIGlmIChub2RlLnRhZykgYWRkUmVmKG5vZGUudGFnLm5hbWUsIHVuZGVmaW5lZCwgbm9kZS5pZCwgJ0ZCRCcpO1xuICAgIH1cblxuICAgIGQuY3Jvc3NSZWZJbmRleCA9IGluZGV4O1xuICB9XG59XG5cbi8vIFNpbmdsZXRvbiBzdG9yZSBpbnN0YW5jZVxuZXhwb3J0IGNvbnN0IGxvZ2ljU3RvcmUgPSBuZXcgTG9naWNTdG9yZSgpO1xuXG4vLyBSZWFjdCBob29rIGZvciBzdWJzY3JpYmluZyB0byBzdG9yZVxuaW1wb3J0IHsgdXNlU3RhdGUsIHVzZUVmZmVjdCwgdXNlUmVmIH0gZnJvbSAncmVhY3QnO1xuXG5leHBvcnQgZnVuY3Rpb24gdXNlTG9naWNTdG9yZSgpOiBMb2dpY1N0b3JlU3RhdGUge1xuICBjb25zdCBbc3RhdGUsIHNldFN0YXRlXSA9IHVzZVN0YXRlKGxvZ2ljU3RvcmUuZ2V0U3RhdGUoKSk7XG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgcmV0dXJuIGxvZ2ljU3RvcmUuc3Vic2NyaWJlKHNldFN0YXRlKTtcbiAgfSwgW10pO1xuICByZXR1cm4gc3RhdGU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1c2VMb2dpY1N0b3JlU2VsZWN0b3I8VD4oc2VsZWN0b3I6IChzOiBMb2dpY1N0b3JlU3RhdGUpID0+IFQpOiBUIHtcbiAgY29uc3Qgc2VsZWN0b3JSZWYgPSB1c2VSZWYoc2VsZWN0b3IpO1xuICBzZWxlY3RvclJlZi5jdXJyZW50ID0gc2VsZWN0b3I7XG4gIGNvbnN0IFt2YWx1ZSwgc2V0VmFsdWVdID0gdXNlU3RhdGUoKCkgPT4gc2VsZWN0b3IobG9naWNTdG9yZS5nZXRTdGF0ZSgpKSk7XG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgLy8gU3RhYmxlIHN1YnNjcmlwdGlvbiBcdTIwMTQgcmVhZHMgbGF0ZXN0IHNlbGVjdG9yIHZpYSByZWYgc28gaW5saW5lIGFycm93IGZ1bmN0aW9uc1xuICAgIC8vIGluIGNhbGxlcnMgZG9uJ3QgY2F1c2UgdGhlIHN1YnNjcmlwdGlvbiB0byB0ZWFyZG93bi9yZXN1YnNjcmliZSBvbiBldmVyeSByZW5kZXIuXG4gICAgcmV0dXJuIGxvZ2ljU3RvcmUuc3Vic2NyaWJlKHN0YXRlID0+IHtcbiAgICAgIGNvbnN0IG5leHQgPSBzZWxlY3RvclJlZi5jdXJyZW50KHN0YXRlKTtcbiAgICAgIHNldFZhbHVlKHByZXYgPT4gT2JqZWN0LmlzKHByZXYsIG5leHQpID8gcHJldiA6IG5leHQpO1xuICAgIH0pO1xuICB9LCBbXSk7XG4gIHJldHVybiB2YWx1ZTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQU1BLFNB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QSxlQUFXLFFBQVEsRUFBRSxjQUFjLE9BQU87QUFDeEMsaUJBQVcsTUFBTSxLQUFLLFVBQVU7QUFDOUIsWUFBSSxHQUFHLFNBQVMsYUFBYSxHQUFHLFNBQVMsUUFBUTtBQUMvQyxpQkFBTyxHQUFHLElBQUksTUFBTSxLQUFLLElBQUksR0FBRyxJQUFJLElBQUk7QUFBQSxRQUMxQyxXQUFXLEdBQUcsU0FBUyxTQUFTO0FBQzlCLHFCQUFXLENBQUMsRUFBRSxNQUFNLEtBQUssT0FBTyxRQUFRLEdBQUcsSUFBSSxHQUFHO0FBQ2hELG1CQUFPLE9BQU8sTUFBTSxLQUFLLElBQUksR0FBRyxJQUFJLElBQUk7QUFBQSxVQUMxQztBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQ0EsaUJBQVcsVUFBVSxLQUFLLFVBQVU7QUFDbEMsbUJBQVcsTUFBTSxPQUFPLFVBQVU7QUFDaEMsY0FBSSxHQUFHLFNBQVMsYUFBYSxHQUFHLFNBQVMsUUFBUTtBQUMvQyxtQkFBTyxHQUFHLElBQUksTUFBTSxLQUFLLElBQUksR0FBRyxJQUFJLElBQUk7QUFBQSxVQUMxQztBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUdBLGVBQVcsUUFBUSxFQUFFLFdBQVcsT0FBTztBQUNyQyxVQUFJLEtBQUssSUFBSyxRQUFPLEtBQUssSUFBSSxNQUFNLFFBQVcsS0FBSyxJQUFJLEtBQUs7QUFBQSxJQUMvRDtBQUVBLE1BQUUsZ0JBQWdCO0FBQUEsRUFDcEI7QUFDRjtBQUdPLE1BQU0sYUFBYSxJQUFJLFdBQVc7QUFHekMsU0FBUyxVQUFVLFdBQVcsY0FBYztBQUVyQyxTQUFTLGdCQUFpQztBQUMvQyxRQUFNLENBQUMsT0FBTyxRQUFRLElBQUksU0FBUyxXQUFXLFNBQVMsQ0FBQztBQUN4RCxZQUFVLE1BQU07QUFDZCxXQUFPLFdBQVcsVUFBVSxRQUFRO0FBQUEsRUFDdEMsR0FBRyxDQUFDLENBQUM7QUFDTCxTQUFPO0FBQ1Q7QUFFTyxTQUFTLHNCQUF5QixVQUF3QztBQUMvRSxRQUFNLGNBQWMsT0FBTyxRQUFRO0FBQ25DLGNBQVksVUFBVTtBQUN0QixRQUFNLENBQUMsT0FBTyxRQUFRLElBQUksU0FBUyxNQUFNLFNBQVMsV0FBVyxTQUFTLENBQUMsQ0FBQztBQUN4RSxZQUFVLE1BQU07QUFHZCxXQUFPLFdBQVcsVUFBVSxXQUFTO0FBQ25DLFlBQU0sT0FBTyxZQUFZLFFBQVEsS0FBSztBQUN0QyxlQUFTLFVBQVEsT0FBTyxHQUFHLE1BQU0sSUFBSSxJQUFJLE9BQU8sSUFBSTtBQUFBLElBQ3RELENBQUM7QUFBQSxFQUNILEdBQUcsQ0FBQyxDQUFDO0FBQ0wsU0FBTztBQUNUOyIsCiAgIm5hbWVzIjogWyJ0IiwgImwiLCAiaiJdCn0K
