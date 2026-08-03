/*
 * PLC Logic Editor — Central State Store
 * Manages LD/FBD/SFC diagram state, selection, clipboard, monitor mode.
 * Uses immer for immutable updates and a command-pattern undo/redo stack.
 */

import { produce } from 'immer';

// ─── Shared Primitives ────────────────────────────────────────────────────────

export type IECDataType =
  | 'BOOL' | 'INT' | 'UINT' | 'DINT' | 'UDINT' | 'LINT' | 'ULINT'
  | 'REAL' | 'LREAL' | 'BYTE' | 'WORD' | 'DWORD' | 'LWORD'
  | 'STRING' | 'WSTRING' | 'TIME' | 'DATE' | 'TOD' | 'DT'
  | 'ARRAY_BOOL' | 'ARRAY_INT' | 'ARRAY_REAL'
  | 'STRUCT';

export interface Position { x: number; y: number }

export interface TagRef {
  name: string;
  address?: string;   // e.g. "%I0.0", "%Q0.1", "%M0.0"
  dataType: IECDataType;
}

// ─── Ladder Diagram Model ─────────────────────────────────────────────────────

export type ContactType = 'NO' | 'NC' | 'P_CONTACT' | 'N_CONTACT';
export type CoilType = 'normal' | 'negated' | 'set' | 'reset' | 'latch' | 'unlatch';
export type FBType = 'TON' | 'TOF' | 'TP' | 'CTU' | 'CTD' | 'CTUD' | 'SR' | 'RS' | 'RTRIG' | 'FTRIG'
  | 'EQ' | 'NE' | 'GT' | 'GE' | 'LT' | 'LE'
  | 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'MOD' | 'ABS' | 'SQRT'
  | 'MOVE' | 'SEL' | 'LIMIT' | 'MIN' | 'MAX'
  // Extended: Siemens-specific timers/counters with direct IEC equivalents
  | 'TONR' | 'IEC_TIMER' | 'IEC_LTIMER' | 'IEC_COUNTER' | 'IEC_LCOUNTER'
  // Extended: Siemens analog scaling / normalisation
  | 'SCALE' | 'UNSCALE' | 'NORM_X' | 'SCALE_X'
  // Extended: Siemens blink / oscillator
  | 'BLINK'
  // Extended: Siemens IEC timer contact (edge-based timer output contact)
  | 'IEC_TC'
  // Extended: String functions (used in FBD/LD in all vendors)
  | 'LEN' | 'LEFT' | 'RIGHT' | 'MID' | 'CONCAT' | 'FIND' | 'INSERT' | 'DELETE' | 'REPLACE'
  | 'UPPER_CASE' | 'LOWER_CASE'
  // Extended: Siemens communication FBs (simplified representation)
  | 'SEND' | 'RECV' | 'RDREC' | 'WRREC'
  // Extended: Math extensions
  | 'LN' | 'LOG' | 'EXP' | 'SIN' | 'COS' | 'TAN' | 'ASIN' | 'ACOS' | 'ATAN'
  | 'NEG' | 'MUL' | 'XOR' | 'NOT' | 'AND' | 'OR'
  // Extended: Rockwell extras
  | 'MOV' | 'COP' | 'FFL' | 'FFU' | 'LFL' | 'LFU' | 'SQO' | 'SQI' | 'SQL'
  | 'PID' | 'MSG' | 'GSV' | 'SSV' | 'LIM' | 'MEQ' | 'MVM' | 'BTD' | 'FLL' | 'SIZE';

export interface ContactElement {
  kind: 'contact';
  id: string;
  type: ContactType;
  tag: TagRef;
  position: Position;
  energized?: boolean;  // monitor mode
}

export interface CoilElement {
  kind: 'coil';
  id: string;
  type: CoilType;
  tag: TagRef;
  position: Position;
  energized?: boolean;
}

export interface BlockElement {
  kind: 'block';
  id: string;
  fbType: FBType;
  instanceName: string;
  pins: Record<string, TagRef>;
  position: Position;
  energized?: boolean;                 // monitor mode
  pinValues?: Record<string, string>;  // monitor mode live values per output pin
  vendorOriginalName?: string;         // preserves exact vendor type name for lossless export (e.g. 'IEC_TIMER_1s' vs 'IEC_TIMER')
}

export type LadderElement = ContactElement | CoilElement | BlockElement;

export interface Branch {
  id: string;
  startNodeId: string;
  endNodeId: string;
  elements: LadderElement[];
  energized?: boolean;  // monitor mode — branch path delivers power
}

export interface Rung {
  id: string;
  number: number;
  comment: string;
  elements: LadderElement[];
  branches: Branch[];
  energized?: boolean;  // monitor mode — whole rung powered
  vendorType?: string;  // L5X rung type: "N" (Normal), "R" (Routine), "E" (Empty), etc.
}

export interface LadderProgram {
  rungs: Rung[];
}

// ─── FBD Model ────────────────────────────────────────────────────────────────

export type FBDBlockType =
  | 'AND' | 'OR' | 'NOT' | 'XOR' | 'NAND' | 'NOR'
  | 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'MOD' | 'ABS' | 'SQRT'
  | 'GT' | 'LT' | 'GE' | 'LE' | 'EQ' | 'NE'
  | 'TON' | 'TOF' | 'TP' | 'CTU' | 'CTD' | 'CTUD' | 'SR' | 'RS' | 'RTRIG' | 'FTRIG'
  | 'SEL' | 'MUX' | 'LIMIT' | 'MIN' | 'MAX'
  | 'MOVE' | 'IN_VARIABLE' | 'OUT_VARIABLE' | 'INOUT_VARIABLE' | 'IN_OUT_VARIABLE'
  | 'CONNECTOR' | 'CONTINUATION' | 'COMMENT'
  | 'LABEL' | 'JUMP' | 'RETURN'
  // Extended: Siemens-specific timers / counters
  | 'TONR' | 'IEC_TIMER' | 'IEC_LTIMER' | 'IEC_COUNTER' | 'IEC_LCOUNTER'
  // Extended: Siemens analog scaling / normalisation
  | 'SCALE' | 'UNSCALE' | 'NORM_X' | 'SCALE_X'
  // Extended: Siemens blink / oscillator / IEC timer contact
  | 'BLINK' | 'IEC_TC'
  // Extended: Math (used across all vendors)
  | 'LN' | 'LOG' | 'EXP' | 'SIN' | 'COS' | 'TAN' | 'ASIN' | 'ACOS' | 'ATAN' | 'NEG'
  // Extended: String functions
  | 'LEN' | 'LEFT' | 'RIGHT' | 'MID' | 'CONCAT' | 'FIND' | 'INSERT' | 'DELETE' | 'REPLACE'
  | 'UPPER_CASE' | 'LOWER_CASE' | 'S_LEN' | 'S_LEFT' | 'S_RIGHT' | 'S_MID' | 'S_FIND' | 'S_CONV' | 'S_CONCAT'
  // Extended: Type conversions
  | 'INT_TO_REAL' | 'REAL_TO_INT' | 'DINT_TO_REAL' | 'REAL_TO_DINT' | 'INT_TO_DINT'
  | 'BOOL_TO_INT' | 'INT_TO_BOOL' | 'WORD_TO_INT' | 'INT_TO_WORD' | 'DWORD_TO_DINT' | 'DINT_TO_DWORD'
  | 'TIME_TO_DINT' | 'DINT_TO_TIME'
  | 'ROUND' | 'TRUNC' | 'CEIL' | 'FLOOR' | 'CONVERT'
  // Extended: Siemens communication FBs
  | 'SEND' | 'RECV' | 'RDREC' | 'WRREC'
  // Extended: Rockwell-specific
  | 'MOV' | 'COP' | 'FFL' | 'FFU' | 'LFL' | 'LFU' | 'SQO' | 'SQI' | 'SQL'
  | 'PID' | 'MSG' | 'GSV' | 'SSV' | 'LIM' | 'MEQ' | 'MVM' | 'BTD' | 'SIZE';

export interface Pin {
  id: string;
  name: string;
  dataType: IECDataType;
  negated?: boolean;
  value?: string;  // monitor mode
}

export interface FBDNode {
  id: string;
  type: FBDBlockType;
  label?: string;          // connector/continuation label
  instanceName?: string;   // function-block instance name
  content?: string;        // comment text
  position: Position;
  size?: { width: number; height: number };  // comment nodes are resizable
  inputs: Pin[];
  outputs: Pin[];
  tag?: TagRef;  // for variable nodes
  negated?: boolean;  // for variable nodes (inVariable/outVariable negation)
  executionOrderId?: number;  // TC6: execution order for blocks
  vendorOriginalName?: string;  // exact vendor type string for lossless export round-trip
}

export interface FBDWire {
  id: string;
  from: { nodeId: string; pin: string };
  to: { nodeId: string; pin: string };
  negated?: boolean;
  energized?: boolean;  // monitor mode
}

export interface FBDProgram {
  nodes: FBDNode[];
  wires: FBDWire[];
}

// ─── SFC Model ────────────────────────────────────────────────────────────────

// All 11 IEC 61131-3 §6.8.3 qualifiers
export type ActionQualifier = 'N' | 'S' | 'R' | 'P' | 'P1' | 'P0' | 'L' | 'D' | 'SD' | 'DS' | 'SL';

export interface SFCAction {
  id: string;
  qualifier: ActionQualifier;
  tag: TagRef;
  duration?: string;  // for timed qualifiers L, D, SD, DS, SL
}

export interface SFCStep {
  id: string;
  name: string;
  isInitial: boolean;
  actions: SFCAction[];
  position: Position;
  isActive?: boolean;  // monitor mode
}

export interface SFCTransition {
  id: string;
  condition: string;  // ST boolean expression
  position: Position;
  priority?: number;  // for OR-branch evaluation order
  isTrue?: boolean;   // monitor mode
}

export type SFCLinkType =
  | 'simple'
  | 'selection-divergence'
  | 'selection-convergence'
  | 'simultaneous-divergence'
  | 'simultaneous-convergence';

export interface SFCLink {
  id: string;
  from: string;
  to: string;
  type: SFCLinkType;
  // Only used for divergence/convergence bar nodes — position of the visual bar node on canvas
  barPosition?: { x: number; y: number };
}

// OR branch = single bar (only one fires); AND branch = double bar (all fire simultaneously)
export interface SFCBranch {
  id: string;
  type: 'OR' | 'AND';
  divergingFromTransId: string;   // transition that fans OUT
  branchStepIds: string[][];      // each inner array = step ids along that branch
  convergingToTransId: string;    // transition that fans IN
}

// Jump-to-step connector: a terminal node that represents a backward arc to a named step.
// When the flow reaches this node, execution continues from the named target step.
export interface SFCJump {
  id: string;
  targetStepName: string;  // name of the step to jump to
  position: Position;
}

export interface SFCProgram {
  steps: SFCStep[];
  transitions: SFCTransition[];
  links: SFCLink[];
  branches: SFCBranch[];
  jumps: SFCJump[];
}

// ─── Tag Database ─────────────────────────────────────────────────────────────

export interface TagEntry {
  name: string;
  address: string;
  dataType: IECDataType;
  description?: string;
  retain?: boolean;       // RETAIN qualifier — value survives power cycle
  initialValue?: string;  // initial/default value at program start
  forcedValue?: string;   // null = not forced
  liveValue?: string;     // monitor mode
}

// ─── POU (Program Organization Unit) ─────────────────────────────────────────

export interface POU {
  id: string;
  name: string;
  language: 'LD' | 'FBD' | 'SFC';
  ladderProgram: LadderProgram;
  fbdProgram: FBDProgram;
  sfcProgram: SFCProgram;
  retain?: boolean;
}

// ─── Logic Store State ────────────────────────────────────────────────────────

export type EditorLanguage = 'LD' | 'FBD' | 'SFC';
export type MonitorMode = 'stopped' | 'running' | 'paused' | 'stepping';

export interface LogicStoreState {
  activeLanguage: EditorLanguage;

  // Diagram models
  ladderProgram: LadderProgram;
  fbdProgram: FBDProgram;
  sfcProgram: SFCProgram;

  // Selection
  selectedElementIds: Set<string>;
  selectedRungId: string | null;

  // Clipboard
  clipboard: {
    rungs?: Rung[];
    elements?: LadderElement[];
    fbdNodes?: FBDNode[];
    sfcSteps?: SFCStep[];
  };

  // Tag database (loaded from workspace tag store)
  tagDatabase: TagEntry[];

  // Cross-reference: tagName → list of (rungId, elementId)
  crossRefIndex: Map<string, Array<{ rungId?: string; elementId: string; language: EditorLanguage }>>;

  // Monitor mode
  monitorMode: MonitorMode;
  scanRate: number;  // ms

  // Tag Monitor watch list — subset of tagDatabase names the user has pinned
  watchedTags: string[];

  // UI state
  zoom: number;
  showGrid: boolean;
  searchQuery: string;
  crossRefPanelOpen: boolean;
  crossRefTarget: string | null;
  inspectorOpen: boolean;
  inspectorElementId: string | null;

  // FBD block output pin live values: instanceKey → { pinName → value }
  fbdBlockPinValues: Record<string, Record<string, string>>;

  // Console output log
  consoleLog: Array<{ timestamp: number; level: 'info' | 'warn' | 'error' | 'success'; message: string }>;

  // Multi-POU support (foundation — existing top-level fields remain as active POU)
  pous: POU[];
  activePouId: string;

  // Sidecar from last vendor import — used by export tab for lossless round-trip
  importedSidecar: import('./vendor/types.js').VendorMetadataSidecar | null;
}

const createInitialLadder = (): LadderProgram => ({ rungs: [] });

const createInitialFBD = (): FBDProgram => ({ nodes: [], wires: [] });

const createInitialSFC = (): SFCProgram => ({ steps: [], transitions: [], links: [], branches: [], jumps: [] });

const _initialLadder = createInitialLadder();
const _initialFBD    = createInitialFBD();
const _initialSFC    = createInitialSFC();

const initialState: LogicStoreState = {
  activeLanguage: 'LD',
  ladderProgram: _initialLadder,
  fbdProgram: _initialFBD,
  sfcProgram: _initialSFC,
  selectedElementIds: new Set(),
  selectedRungId: null,
  clipboard: {},
  tagDatabase: [],
  crossRefIndex: new Map(),
  monitorMode: 'stopped',
  scanRate: 10,
  watchedTags: [],
  zoom: 1,
  showGrid: true,
  searchQuery: '',
  crossRefPanelOpen: false,
  crossRefTarget: null,
  inspectorOpen: false,
  inspectorElementId: null,
  fbdBlockPinValues: {},
  consoleLog: [],
  pous: [{
    id: 'pou-main',
    name: 'Main',
    language: 'LD',
    ladderProgram: _initialLadder,
    fbdProgram: _initialFBD,
    sfcProgram: _initialSFC,
  }],
  activePouId: 'pou-main',
  importedSidecar: null,
};

// ─── Store (simple pub/sub, no external library needed) ───────────────────────

type Listener = (state: LogicStoreState) => void;

class LogicStore {
  private state: LogicStoreState = { ...initialState, selectedElementIds: new Set(), crossRefIndex: new Map(), clipboard: {}, consoleLog: [], fbdBlockPinValues: {} };
  private listeners: Set<Listener> = new Set();

  getState(): LogicStoreState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l(this.state));
  }

  setState(updater: (draft: LogicStoreState) => void) {
    this.state = produce(this.state, updater);
    this.notify();
  }

  // ── Language switching ──────────────────────────────────────────────────────
  setActiveLanguage(lang: EditorLanguage) {
    this.setState(d => { d.activeLanguage = lang; });
  }

  // ── Ladder operations ───────────────────────────────────────────────────────
  addRung(afterIndex?: number) {
    this.setState(d => {
      const newRung: Rung = {
        id: `rung-${Date.now()}`,
        number: d.ladderProgram.rungs.length + 1,
        comment: '',
        elements: [],
        branches: [],
      };
      if (afterIndex !== undefined) {
        d.ladderProgram.rungs.splice(afterIndex + 1, 0, newRung);
      } else {
        d.ladderProgram.rungs.push(newRung);
      }
      // renumber
      d.ladderProgram.rungs.forEach((r, i) => { r.number = i + 1; });
    });
  }

  deleteRung(rungId: string) {
    this.setState(d => {
      d.ladderProgram.rungs = d.ladderProgram.rungs.filter(r => r.id !== rungId);
      d.ladderProgram.rungs.forEach((r, i) => { r.number = i + 1; });
    });
  }

  duplicateRung(rungId: string) {
    this.setState(d => {
      const idx = d.ladderProgram.rungs.findIndex(r => r.id === rungId);
      if (idx === -1) return;
      const orig = d.ladderProgram.rungs[idx];
      // Deep clone then give every id a fresh unique suffix
      const copy: Rung = JSON.parse(JSON.stringify(orig));
      const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      // Map old element IDs → new IDs so branch references stay consistent
      const idMap: Record<string, string> = {};
      copy.elements = copy.elements.map(el => {
        const newId = `${el.kind}-${uid()}`;
        idMap[el.id] = newId;
        return { ...el, id: newId };
      });
      copy.branches = copy.branches.map(br => ({
        ...br,
        id: `branch-${uid()}`,
        startNodeId: idMap[br.startNodeId] ?? br.startNodeId,
        endNodeId:   idMap[br.endNodeId]   ?? br.endNodeId,
        elements: br.elements.map(el => {
          const newId = `${el.kind}-${uid()}`;
          return { ...el, id: newId };
        }),
      }));
      copy.id = `rung-${uid()}`;
      d.ladderProgram.rungs.splice(idx + 1, 0, copy);
      d.ladderProgram.rungs.forEach((r, i) => { r.number = i + 1; });
      this._rebuildCrossRef(d);
    });
  }

  moveRung(fromIdx: number, toIdx: number) {
    this.setState(d => {
      const rungs = d.ladderProgram.rungs;
      const [moved] = rungs.splice(fromIdx, 1);
      rungs.splice(toIdx, 0, moved);
      rungs.forEach((r, i) => { r.number = i + 1; });
    });
  }

  updateRungComment(rungId: string, comment: string) {
    this.setState(d => {
      const rung = d.ladderProgram.rungs.find(r => r.id === rungId);
      if (rung) rung.comment = comment;
    });
  }

  addElementToRung(rungId: string, element: LadderElement) {
    this.setState(d => {
      const rung = d.ladderProgram.rungs.find(r => r.id === rungId);
      if (rung) rung.elements.push(element);
      this._rebuildCrossRef(d);
    });
  }

  updateElement(rungId: string, elementId: string, updates: Partial<LadderElement>) {
    this.setState(d => {
      const rung = d.ladderProgram.rungs.find(r => r.id === rungId);
      if (!rung) return;
      const idx = rung.elements.findIndex(el => el.id === elementId);
      if (idx !== -1) {
        Object.assign(rung.elements[idx], updates);
      }
      // also check branches
      for (const branch of rung.branches) {
        const bidx = branch.elements.findIndex(el => el.id === elementId);
        if (bidx !== -1) Object.assign(branch.elements[bidx], updates);
      }
      this._rebuildCrossRef(d);
    });
  }

  moveElement(rungId: string, fromIndex: number, toIndex: number) {
    this.setState(d => {
      const rung = d.ladderProgram.rungs.find(r => r.id === rungId);
      if (!rung) return;
      const els = rung.elements;
      if (fromIndex < 0 || fromIndex >= els.length) return;
      if (toIndex < 0 || toIndex >= els.length) return;
      const [el] = els.splice(fromIndex, 1);
      els.splice(toIndex, 0, el);
      this._rebuildCrossRef(d);
    });
  }

  deleteElement(rungId: string, elementId: string) {
    this.setState(d => {
      const rung = d.ladderProgram.rungs.find(r => r.id === rungId);
      if (!rung) return;
      rung.elements = rung.elements.filter(el => el.id !== elementId);
      // Remove branch elements that reference the deleted element, and also
      // prune any branch whose anchor (startNodeId) is the deleted element —
      // an orphaned branch with no anchor element renders as dangling wires.
      rung.branches = rung.branches.filter(br => br.startNodeId !== elementId);
      for (const branch of rung.branches) {
        branch.elements = branch.elements.filter(el => el.id !== elementId);
      }
      this._rebuildCrossRef(d);
    });
  }

  addBranchToRung(rungId: string, branch: Branch) {
    this.setState(d => {
      const rung = d.ladderProgram.rungs.find(r => r.id === rungId);
      if (rung) rung.branches.push(branch);
    });
  }

  addParallelBranch(rungId: string, anchorElId: string, kind: string, tag: { name: string; dataType: 'BOOL' }) {
    this.setState(d => {
      const rung = d.ladderProgram.rungs.find(r => r.id === rungId);
      if (!rung) return;
      const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      let newEl: LadderElement | null = null;
      if (kind.startsWith('contact')) {
        const typeMap: Record<string, string> = {
          'contact-NO': 'NO', 'contact-NC': 'NC',
          'contact-P': 'P_CONTACT', 'contact-N': 'N_CONTACT',
        };
        newEl = { kind: 'contact', id: `contact-${uid()}`, type: (typeMap[kind] ?? 'NO') as any, tag, position: { x: 0, y: 0 } };
      } else if (kind.startsWith('coil')) {
        const typeMap: Record<string, string> = {
          'coil-normal': 'normal', 'coil-negated': 'negated',
          'coil-set': 'set', 'coil-reset': 'reset',
          'coil-latch': 'latch', 'coil-unlatch': 'unlatch',
        };
        newEl = { kind: 'coil', id: `coil-${uid()}`, type: (typeMap[kind] ?? 'normal') as any, tag, position: { x: 0, y: 0 } };
      } else if (kind.startsWith('block')) {
        const fbType = kind.replace('block-', '') as any;
        newEl = { kind: 'block', id: `block-${uid()}`, fbType, instanceName: '', position: { x: 0, y: 0 } };
      }
      if (!newEl) return;
      const branch: Branch = {
        id: `branch-${uid()}`,
        startNodeId: anchorElId,
        endNodeId: anchorElId,
        elements: [newEl],
      };
      rung.branches.push(branch);
      this._rebuildCrossRef(d);
    });
  }

  // ── FBD operations ──────────────────────────────────────────────────────────
  addFBDNode(node: FBDNode) {
    this.setState(d => {
      d.fbdProgram.nodes.push(node);
      this._rebuildCrossRef(d);
    });
  }

  updateFBDNode(nodeId: string, updates: Partial<FBDNode>) {
    this.setState(d => {
      const node = d.fbdProgram.nodes.find(n => n.id === nodeId);
      if (node) Object.assign(node, updates);
      this._rebuildCrossRef(d);
    });
  }

  deleteFBDNode(nodeId: string) {
    this.setState(d => {
      d.fbdProgram.nodes = d.fbdProgram.nodes.filter(n => n.id !== nodeId);
      d.fbdProgram.wires = d.fbdProgram.wires.filter(w => w.from.nodeId !== nodeId && w.to.nodeId !== nodeId);
      this._rebuildCrossRef(d);
    });
  }

  addFBDWire(wire: FBDWire) {
    this.setState(d => { d.fbdProgram.wires.push(wire); });
  }

  deleteFBDWire(wireId: string) {
    this.setState(d => { d.fbdProgram.wires = d.fbdProgram.wires.filter(w => w.id !== wireId); });
  }

  // ── SFC operations ──────────────────────────────────────────────────────────
  addSFCStep(step: SFCStep) {
    this.setState(d => { d.sfcProgram.steps.push(step); });
  }

  updateSFCStep(stepId: string, updates: Partial<SFCStep>) {
    this.setState(d => {
      const step = d.sfcProgram.steps.find(s => s.id === stepId);
      if (step) Object.assign(step, updates);
    });
  }

  deleteSFCStep(stepId: string) {
    this.setState(d => {
      d.sfcProgram.steps = d.sfcProgram.steps.filter(s => s.id !== stepId);
      d.sfcProgram.links = d.sfcProgram.links.filter(l => l.from !== stepId && l.to !== stepId);
    });
  }

  addSFCTransition(transition: SFCTransition) {
    this.setState(d => { d.sfcProgram.transitions.push(transition); });
  }

  updateSFCTransition(transId: string, updates: Partial<SFCTransition>) {
    this.setState(d => {
      const t = d.sfcProgram.transitions.find(t => t.id === transId);
      if (t) Object.assign(t, updates);
    });
  }

  deleteSFCTransition(transId: string) {
    this.setState(d => {
      d.sfcProgram.transitions = d.sfcProgram.transitions.filter(t => t.id !== transId);
      d.sfcProgram.links = d.sfcProgram.links.filter(l => l.from !== transId && l.to !== transId);
    });
  }

  addSFCLink(link: SFCLink) {
    this.setState(d => { d.sfcProgram.links.push(link); });
  }

  deleteSFCLink(linkId: string) {
    this.setState(d => { d.sfcProgram.links = d.sfcProgram.links.filter(l => l.id !== linkId); });
  }

  addSFCBranch(branch: SFCBranch) {
    this.setState(d => { d.sfcProgram.branches.push(branch); });
  }

  deleteSFCBranch(branchId: string) {
    this.setState(d => { d.sfcProgram.branches = d.sfcProgram.branches.filter(b => b.id !== branchId); });
  }

  updateSFCLinkBarPosition(linkId: string, pos: { x: number; y: number }) {
    this.setState(d => {
      const l = d.sfcProgram.links.find(l => l.id === linkId);
      if (l) l.barPosition = pos;
    });
  }

  addSFCJump(jump: SFCJump) {
    this.setState(d => {
      if (!d.sfcProgram.jumps) d.sfcProgram.jumps = [];
      d.sfcProgram.jumps.push(jump);
    });
  }

  updateSFCJump(jumpId: string, targetStepName: string) {
    this.setState(d => {
      if (!d.sfcProgram.jumps) return;
      const j = d.sfcProgram.jumps.find(j => j.id === jumpId);
      if (j) j.targetStepName = targetStepName;
    });
  }

  updateSFCJumpPosition(jumpId: string, position: { x: number; y: number }) {
    this.setState(d => {
      if (!d.sfcProgram.jumps) return;
      const j = d.sfcProgram.jumps.find(j => j.id === jumpId);
      if (j) j.position = position;
    });
  }

  deleteSFCJump(jumpId: string) {
    this.setState(d => {
      if (!d.sfcProgram.jumps) return;
      d.sfcProgram.jumps = d.sfcProgram.jumps.filter(j => j.id !== jumpId);
    });
  }

  // ── Selection ───────────────────────────────────────────────────────────────
  setSelection(ids: string[], rungId?: string) {
    this.setState(d => {
      d.selectedElementIds = new Set(ids);
      d.selectedRungId = rungId ?? null;
    });
  }

  clearSelection() {
    this.setState(d => {
      d.selectedElementIds = new Set();
      d.selectedRungId = null;
    });
  }

  // ── Clipboard ───────────────────────────────────────────────────────────────
  copyRungs(rungIds: string[]) {
    this.setState(d => {
      d.clipboard.rungs = d.ladderProgram.rungs.filter(r => rungIds.includes(r.id))
        .map(r => JSON.parse(JSON.stringify(r)));
    });
  }

  pasteRungs(afterIndex?: number) {
    this.setState(d => {
      if (!d.clipboard.rungs?.length) return;
      const newRungs = d.clipboard.rungs.map(r => ({
        ...JSON.parse(JSON.stringify(r)),
        id: `rung-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        elements: r.elements.map(el => ({ ...el, id: `${el.id}-p-${Date.now()}` })),
      }));
      if (afterIndex !== undefined) {
        d.ladderProgram.rungs.splice(afterIndex + 1, 0, ...newRungs);
      } else {
        d.ladderProgram.rungs.push(...newRungs);
      }
      d.ladderProgram.rungs.forEach((r, i) => { r.number = i + 1; });
    });
  }

  // ── FBD Clipboard ───────────────────────────────────────────────────────────
  copyFBDNodes(nodeIds: string[]) {
    this.setState(d => {
      d.clipboard.fbdNodes = d.fbdProgram.nodes
        .filter(n => nodeIds.includes(n.id))
        .map(n => JSON.parse(JSON.stringify(n)));
    });
  }

  pasteFBDNodes(offsetX = 40, offsetY = 40) {
    this.setState(d => {
      if (!d.clipboard.fbdNodes?.length) return;
      const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newNodes = d.clipboard.fbdNodes.map(n => ({
        ...JSON.parse(JSON.stringify(n)),
        id: `fbd-${n.type.toLowerCase().replace(/_/g, '-')}-${uid()}`,
        position: { x: n.position.x + offsetX, y: n.position.y + offsetY },
        inputs:  n.inputs.map((p: Pin)  => ({ ...p, id: `${p.id}-p-${uid()}` })),
        outputs: n.outputs.map((p: Pin) => ({ ...p, id: `${p.id}-p-${uid()}` })),
      }));
      d.fbdProgram.nodes.push(...newNodes);
    });
  }

  // ── Tag database ────────────────────────────────────────────────────────────
  setTagDatabase(tags: TagEntry[]) {
    this.setState(d => { d.tagDatabase = tags; });
  }

  createTag(tag: TagEntry) {
    this.setState(d => {
      if (!d.tagDatabase.find(t => t.name === tag.name)) {
        d.tagDatabase.push(tag);
      }
    });
  }

  updateTag(name: string, updates: Partial<TagEntry>) {
    this.setState(d => {
      const tag = d.tagDatabase.find(t => t.name === name);
      if (tag) Object.assign(tag, updates);
    });
  }

  updateTagLiveValue(tagName: string, value: string) {
    this.setState(d => {
      const tag = d.tagDatabase.find(t => t.name === tagName);
      if (tag) tag.liveValue = value;
    });
  }

  clearLiveValues() {
    this.setState(d => {
      for (const tag of d.tagDatabase) {
        tag.liveValue = undefined;
      }
      // Clear all element energized states
      for (const rung of d.ladderProgram.rungs) {
        rung.energized = false;
        for (const el of rung.elements) (el as any).energized = false;
        for (const branch of rung.branches) {
          branch.energized = false;
          for (const el of branch.elements) (el as any).energized = false;
        }
      }
      for (const node of d.fbdProgram.nodes) (node as any).energized = false;
      for (const wire of d.fbdProgram.wires) wire.energized = false;
      for (const step of d.sfcProgram.steps) (step as any).isActive = false;
    });
  }

  private _engineRef: any = null;
  _setEngineRef(engine: any) { this._engineRef = engine; }

  forceTag(tagName: string, value: string) {
    if (!tagName) return;
    this.setState(d => {
      let tag = d.tagDatabase.find(t => t.name === tagName);
      if (!tag) {
        // Auto-create tag if referenced by an element but not yet in the database
        tag = { id: `tag-${tagName}-${Date.now()}`, name: tagName, dataType: 'BOOL', address: '', description: '' };
        d.tagDatabase.push(tag);
      }
      tag.forcedValue = value;
      tag.liveValue = value;
    });
    // Always push the forced value to the engine regardless of run state.
    // The engine will apply it to tagValues immediately and recompute energized
    // states so the graphical editor canvas updates even when simulation is stopped.
    if (this._engineRef) {
      const parsed = value === 'TRUE' || value === 'true' ? true : value === 'FALSE' || value === 'false' ? false : value;
      this._engineRef.forceTag(tagName, parsed);
    }
  }

  releaseForce(tagName: string) {
    this.setState(d => {
      const tag = d.tagDatabase.find(t => t.name === tagName);
      if (tag) { tag.forcedValue = undefined; tag.liveValue = undefined; }
    });
    if (this._engineRef) {
      this._engineRef.releaseForce(tagName);
    }
  }

  batchUpdateTagValues(values: Record<string, any>) {
    this.setState(d => {
      for (const [name, value] of Object.entries(values)) {
        let tag = d.tagDatabase.find(t => t.name === name);
        if (!tag) {
          tag = { id: `tag-${name}-auto`, name, dataType: 'BOOL', address: '', description: '' };
          d.tagDatabase.push(tag);
        }
        // Skip liveValue update for forced tags — forced value takes precedence
        if (tag.forcedValue === undefined) tag.liveValue = String(value);
      }
    });
  }

  updateEnergizedStates(energized: Record<string, boolean>, blockPinValues?: Record<string, string>, fbdPinValues?: Record<string, Record<string, string>>, powerAfter?: Record<string, boolean>) {
    this.setState(d => {
      if (fbdPinValues) d.fbdBlockPinValues = fbdPinValues;
      for (const rung of d.ladderProgram.rungs) {
        for (const el of rung.elements) {
          (el as any).energized = !!energized[el.id];
          if (powerAfter !== undefined) (el as any).powerAfter = !!powerAfter[el.id];
          // Populate per-pin output values for FB blocks
          if (el.kind === 'block' && blockPinValues) {
            const pinVals: Record<string, string> = {};
            for (const [key, val] of Object.entries(blockPinValues)) {
              if (key.startsWith(el.id + ':')) {
                const pin = key.slice(el.id.length + 1);
                pinVals[pin] = val;
              }
            }
            if (Object.keys(pinVals).length > 0) el.pinValues = pinVals;
          }
        }
        for (const branch of rung.branches) {
          for (const el of branch.elements) {
            (el as any).energized = !!energized[el.id];
            if (powerAfter !== undefined) (el as any).powerAfter = !!powerAfter[el.id];
            if (el.kind === 'block' && blockPinValues) {
              const pinVals: Record<string, string> = {};
              for (const [key, val] of Object.entries(blockPinValues)) {
                if (key.startsWith(el.id + ':')) {
                  const pin = key.slice(el.id.length + 1);
                  pinVals[pin] = val;
                }
              }
              if (Object.keys(pinVals).length > 0) el.pinValues = pinVals;
            }
          }
        }
        // Rung is energized when ANY coil receives power.
        // Coil energized = powerIn to coil. If no coil, check last contact.
        const coils = rung.elements.filter(e => e.kind === 'coil');
        const lastEl = rung.elements.at(-1);
        if (coils.length > 0) {
          rung.energized = coils.some(c => !!(c as any).energized);
        } else {
          rung.energized = lastEl ? !!(lastEl as any).energized : false;
        }
        // Branch bar color = did power flow THROUGH the branch?
        // Use energized[lastBranchEl] — this is sourceReachable && edgeConducts, which is true only
        // when power arrived at the branch entry AND the last element passed it. powerAfter is wrong
        // here because the target junction can be reached via the main rail, giving a false positive.
        for (const branch of rung.branches) {
          const lastBranchEl = branch.elements.at(-1);
          if (!lastBranchEl) { branch.energized = false; continue; }
          branch.energized = !!(lastBranchEl as any).energized;
        }
      }
      for (const node of d.fbdProgram.nodes) {
        (node as any).energized = !!energized[node.id];
      }
      for (const wire of d.fbdProgram.wires) {
        wire.energized = !!energized[wire.from.nodeId];
      }
    });
  }

  updateSFCActiveSteps(active: Record<string, boolean>) {
    this.setState(d => {
      for (const step of d.sfcProgram.steps) {
        (step as any).isActive = !!active[step.id];
      }
    });
  }

  // ── Monitor mode ─────────────────────────────────────────────────────────────
  setMonitorMode(mode: MonitorMode) {
    this.setState(d => { d.monitorMode = mode; });
  }

  setScanRate(ms: number) {
    this.setState(d => { d.scanRate = ms; });
  }

  // ── Watch list ───────────────────────────────────────────────────────────────
  addToWatchList(tagName: string) {
    this.setState(d => {
      if (!d.watchedTags.includes(tagName)) d.watchedTags.push(tagName);
    });
  }

  removeFromWatchList(tagName: string) {
    this.setState(d => {
      d.watchedTags = d.watchedTags.filter(n => n !== tagName);
    });
  }

  addAllTagsToWatchList() {
    this.setState(d => {
      d.watchedTags = d.tagDatabase.map(t => t.name);
    });
  }

  clearWatchList() {
    this.setState(d => { d.watchedTags = []; });
  }

  // ── UI state ─────────────────────────────────────────────────────────────────
  setZoom(zoom: number) {
    this.setState(d => { d.zoom = Math.max(0.25, Math.min(4, zoom)); });
  }

  toggleGrid() {
    this.setState(d => { d.showGrid = !d.showGrid; });
  }

  setSearchQuery(q: string) {
    this.setState(d => { d.searchQuery = q; });
  }

  openCrossRef(tagName: string) {
    this.setState(d => {
      d.crossRefPanelOpen = true;
      d.crossRefTarget = tagName;
    });
  }

  closeCrossRef() {
    this.setState(d => { d.crossRefPanelOpen = false; d.crossRefTarget = null; });
  }

  openInspector(elementId: string) {
    this.setState(d => { d.inspectorOpen = true; d.inspectorElementId = elementId; });
  }

  closeInspector() {
    this.setState(d => { d.inspectorOpen = false; d.inspectorElementId = null; });
  }

  // ── Load programs ────────────────────────────────────────────────────────────
  setImportedSidecar(sidecar: import('./vendor/types.js').VendorMetadataSidecar | null) {
    this.setState(d => { d.importedSidecar = sidecar as any; });
  }

  loadLadderProgram(program: LadderProgram) {
    this.setState(d => {
      d.ladderProgram = program;
      this._rebuildCrossRef(d);
    });
  }

  loadFBDProgram(program: any) {
    this.setState(d => {
      d.fbdProgram = this._normalizeFBD(program);
      this._rebuildCrossRef(d);
    });
  }

  private _normalizeFBD(raw: any): FBDProgram {
    if (!raw || typeof raw !== 'object') return { nodes: [], wires: [] };
    const nodes = raw.nodes ?? [];
    const rawWires = raw.wires ?? [];

    // Always normalize nodes to ensure pin IDs are correct
    const normalizedNodes: FBDNode[] = nodes.map((n: any) => {
      const t = (n.type ?? '').toUpperCase();
      const isVar = t === 'IN_VARIABLE' || t === 'OUT_VARIABLE' || t === 'INOUT_VARIABLE';
      const node: any = {
        id: n.id, type: t, position: n.position ?? { x: 0, y: 0 },
        instanceName: n.instanceName,
        inputs: [] as Pin[], outputs: [] as Pin[],
      };
      if (isVar) {
        node.tag = n.tag ?? n.output?.tag ?? n.input?.tag ?? { name: n.id, dataType: 'BOOL' };
        if (t === 'IN_VARIABLE') {
          node.outputs = [{ id: 'out-output-variable-0', name: 'output-variable', dataType: 'BOOL' }];
        } else if (t === 'OUT_VARIABLE') {
          node.inputs = [{ id: 'in-input-variable-0', name: 'input-variable', dataType: 'BOOL' }];
        } else {
          node.inputs = [{ id: 'in-input-variable-0', name: 'input-variable', dataType: 'BOOL' }];
          node.outputs = [{ id: 'out-output-variable-0', name: 'output-variable', dataType: 'BOOL' }];
        }
        return node as FBDNode;
      }
      // Build inputs from existing array or defaults
      if (n.inputs && Array.isArray(n.inputs) && n.inputs.length > 0) {
        node.inputs = n.inputs.map((p: any, i: number) => ({
          id: p.id ?? `in-${p.name ?? i}-${i}`,
          name: p.name ?? String(i),
          dataType: p.dataType ?? 'BOOL',
        }));
      } else if (n.params) {
        node.inputs = Object.keys(n.params).map((k: string, i: number) => ({ id: `in-${k}-${i}`, name: k, dataType: 'BOOL' }));
      } else {
        node.inputs = this._defaultFBDInputs(t);
      }
      if (n.outputs && Array.isArray(n.outputs) && n.outputs.length > 0) {
        node.outputs = n.outputs.map((p: any, i: number) => ({
          id: p.id ?? `out-${p.name ?? i}-${i}`,
          name: p.name ?? String(i),
          dataType: p.dataType ?? 'BOOL',
        }));
      } else {
        node.outputs = this._defaultFBDOutputs(t);
      }
      if (n.output?.tag) node.tag = n.output.tag;
      if (n.tag) node.tag = n.tag;
      return node as FBDNode;
    });

    // Normalize wires — AI may use source/target instead of from/to, and node instead of nodeId
    const normalizedWires: FBDWire[] = rawWires.map((w: any) => {
      const from = w.from ?? w.source ?? {};
      const to = w.to ?? w.target ?? {};
      return {
        id: w.id ?? `w-${Math.random().toString(36).slice(2)}`,
        from: { nodeId: from.nodeId ?? from.node ?? from.id ?? '', pin: from.pin ?? from.handle ?? '' },
        to:   { nodeId: to.nodeId ?? to.node ?? to.id ?? '',   pin: to.pin ?? to.handle ?? '' },
      } as FBDWire;
    });

    // Fix wire pins that reference wrong pin names (e.g. "Q" on SR should be "Q1")
    const pinAliases: Record<string, Record<string, string>> = {
      SR: { Q: 'Q1' }, RS: { Q: 'Q1' },
    };
    const nodeTypeMap = new Map(normalizedNodes.map(n => [n.id, n.type]));
    const fixedWires = normalizedWires.map(w => {
      const srcType = nodeTypeMap.get(w.from.nodeId);
      const tgtType = nodeTypeMap.get(w.to.nodeId);
      const srcAliases = srcType ? (pinAliases[srcType] ?? {}) : {};
      const tgtAliases = tgtType ? (pinAliases[tgtType] ?? {}) : {};
      return {
        ...w,
        from: { ...w.from, pin: srcAliases[w.from.pin] ?? w.from.pin },
        to:   { ...w.to,   pin: tgtAliases[w.to.pin]   ?? w.to.pin   },
      };
    });

    return { nodes: normalizedNodes, wires: fixedWires };
  }

  private _defaultFBDInputs(type: string): Pin[] {
    switch (type) {
      case 'NOT': return [{ id: 'IN', name: 'IN' }];
      case 'AND': case 'OR': case 'XOR': return [{ id: 'IN1', name: 'IN1' }, { id: 'IN2', name: 'IN2' }];
      case 'TON': case 'TOF': case 'TP': return [{ id: 'IN', name: 'IN' }, { id: 'PT', name: 'PT' }];
      case 'CTU': return [{ id: 'CU', name: 'CU' }, { id: 'R', name: 'R' }, { id: 'PV', name: 'PV' }];
      case 'CTD': return [{ id: 'CD', name: 'CD' }, { id: 'LD', name: 'LD' }, { id: 'PV', name: 'PV' }];
      case 'SR': return [{ id: 'S1', name: 'S1' }, { id: 'R', name: 'R' }];
      case 'RS': return [{ id: 'S', name: 'S' }, { id: 'R1', name: 'R1' }];
      case 'ADD': case 'SUB': case 'MUL': case 'DIV':
      case 'GT': case 'LT': case 'GE': case 'LE': case 'EQ': case 'NE':
        return [{ id: 'IN1', name: 'IN1' }, { id: 'IN2', name: 'IN2' }];
      default: return [{ id: 'IN', name: 'IN' }];
    }
  }

  private _defaultFBDOutputs(type: string): Pin[] {
    switch (type) {
      case 'TON': case 'TOF': case 'TP': return [{ id: 'Q', name: 'Q' }, { id: 'ET', name: 'ET' }];
      case 'CTU': case 'CTD': return [{ id: 'Q', name: 'Q' }, { id: 'CV', name: 'CV' }];
      case 'SR': case 'RS': return [{ id: 'Q1', name: 'Q1' }];
      default: return [{ id: 'OUT', name: 'OUT' }];
    }
  }

  loadSFCProgram(program: SFCProgram) {
    this.setState(d => { d.sfcProgram = program; });
  }

  // ── Console log ──────────────────────────────────────────────────────────────
  addConsoleEntry(level: 'info' | 'warn' | 'error' | 'success', message: string) {
    this.setState(d => {
      d.consoleLog.push({ timestamp: Date.now(), level, message });
      if (d.consoleLog.length > 200) d.consoleLog.splice(0, d.consoleLog.length - 200);
    });
  }

  clearConsole() {
    this.setState(d => { d.consoleLog = []; });
  }

  // ── Multi-POU operations ─────────────────────────────────────────────────────
  addPOU(name: string, language: 'LD' | 'FBD' | 'SFC') {
    this.setState(d => {
      const newPOU: POU = {
        id: `pou-${Date.now()}`,
        name,
        language,
        ladderProgram: { rungs: [] },
        fbdProgram: { nodes: [], wires: [] },
        sfcProgram: { steps: [], transitions: [], links: [], branches: [], jumps: [] },
      };
      d.pous.push(newPOU);
    });
  }

  setActivePOU(id: string) {
    this.setState(d => {
      const pou = d.pous.find(p => p.id === id);
      if (!pou) return;
      d.activePouId = id;
      // Mirror active POU programs into top-level fields so existing editors work
      d.ladderProgram = pou.ladderProgram;
      d.fbdProgram    = pou.fbdProgram;
      d.sfcProgram    = pou.sfcProgram;
      d.activeLanguage = pou.language;
      this._rebuildCrossRef(d);
    });
  }

  deletePOU(id: string) {
    this.setState(d => {
      if (d.pous.length <= 1) return; // can't delete last POU
      d.pous = d.pous.filter(p => p.id !== id);
      // If deleted the active POU, switch to first
      if (d.activePouId === id) {
        const first = d.pous[0];
        d.activePouId    = first.id;
        d.ladderProgram  = first.ladderProgram;
        d.fbdProgram     = first.fbdProgram;
        d.sfcProgram     = first.sfcProgram;
        d.activeLanguage = first.language;
        this._rebuildCrossRef(d);
      }
    });
  }

  renamePOU(id: string, name: string) {
    this.setState(d => {
      const pou = d.pous.find(p => p.id === id);
      if (pou) pou.name = name;
    });
  }

  // ── Cross-reference index rebuild ────────────────────────────────────────────
  private _rebuildCrossRef(d: LogicStoreState) {
    const index = new Map<string, Array<{ rungId?: string; elementId: string; language: EditorLanguage }>>();

    const addRef = (tagName: string, rungId: string | undefined, elementId: string, language: EditorLanguage) => {
      if (!tagName) return;
      if (!index.has(tagName)) index.set(tagName, []);
      index.get(tagName)!.push({ rungId, elementId, language });
    };

    // Ladder
    for (const rung of (d.ladderProgram?.rungs ?? [])) {
      for (const el of rung.elements) {
        if (el.kind === 'contact' || el.kind === 'coil') {
          addRef(el.tag.name, rung.id, el.id, 'LD');
        } else if (el.kind === 'block') {
          for (const [, tagRef] of Object.entries(el.pins)) {
            addRef(tagRef.name, rung.id, el.id, 'LD');
          }
        }
      }
      for (const branch of rung.branches) {
        for (const el of branch.elements) {
          if (el.kind === 'contact' || el.kind === 'coil') {
            addRef(el.tag.name, rung.id, el.id, 'LD');
          }
        }
      }
    }

    // FBD
    for (const node of (d.fbdProgram?.nodes ?? [])) {
      if (node.tag) addRef(node.tag.name, undefined, node.id, 'FBD');
    }

    d.crossRefIndex = index;
  }
}

// Singleton store instance
export const logicStore = new LogicStore();

// React hook for subscribing to store
import { useState, useEffect, useRef } from 'react';

export function useLogicStore(): LogicStoreState {
  const [state, setState] = useState(logicStore.getState());
  useEffect(() => {
    return logicStore.subscribe(setState);
  }, []);
  return state;
}

export function useLogicStoreSelector<T>(selector: (s: LogicStoreState) => T): T {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const [value, setValue] = useState(() => selector(logicStore.getState()));
  useEffect(() => {
    // Stable subscription — reads latest selector via ref so inline arrow functions
    // in callers don't cause the subscription to teardown/resubscribe on every render.
    return logicStore.subscribe(state => {
      const next = selectorRef.current(state);
      setValue(prev => Object.is(prev, next) ? prev : next);
    });
  }, []);
  return value;
}
