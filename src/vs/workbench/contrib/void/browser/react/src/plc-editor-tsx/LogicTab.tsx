/*
 * LogicTab — top-level PLC Logic editor.
 * Sub-tab bar: Ladder | FBD | SFC
 * Toolbar: Run/Pause/Step, Zoom, Grid, Search, Export, Undo/Redo
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

import { useLogicStoreSelector, logicStore, EditorLanguage } from './logicStore.js';
import { LogicToolbar } from './shared/LogicToolbar.js';
import { CrossReferencePanel } from './shared/CrossReferencePanel.js';
import { LadderCanvas } from './ladder/LadderCanvas.js';
import { FBDCanvas } from './fbd/FBDCanvas.js';
import { SFCCanvas } from './sfc/SFCCanvas.js';
import { clmStore, validateCLM } from './clm/index.js';

// ── Sub-tab button ────────────────────────────────────────────────────────────
const SubTabButton: React.FC<{
  label: string;
  active: boolean;
  description: string;
  onClick: () => void;
}> = ({ label, active, description, onClick }) => (
  <div
    role="tab"
    aria-selected={active}
    title={description}
    onClick={onClick}
    style={{
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      userSelect: 'none',
      padding: '0 14px',
      height: 35,
      display: 'flex',
      alignItems: 'center',
      fontSize: 13,
      fontWeight: active ? 600 : 400,
      color: active
        ? 'var(--vscode-tab-activeForeground)'
        : 'var(--vscode-tab-inactiveForeground)',
      background: active
        ? 'var(--vscode-tab-activeBackground, var(--vscode-editor-background))'
        : 'transparent',
      borderBottom: active
        ? '2px solid var(--vscode-tab-activeBorderTop, var(--vscode-focusBorder))'
        : '2px solid transparent',
      transition: 'color 0.1s, border-color 0.1s',
    }}
    onMouseEnter={e => {
      if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--vscode-tab-activeForeground)';
    }}
    onMouseLeave={e => {
      if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--vscode-tab-inactiveForeground)';
    }}
  >
    {label}
  </div>
);

// ── Normalize FBD from AI output format to renderer format ───────────────────
function normalizeFBD(raw: any): any {
  if (!raw || typeof raw !== 'object') return { nodes: [], wires: [] };
  const nodes = raw.nodes ?? [];
  const wires = raw.wires ?? [];
  // If nodes already have inputs/outputs arrays, assume correct format
  if (nodes.length === 0 || (nodes[0]?.inputs && Array.isArray(nodes[0].inputs))) {
    return { nodes, wires };
  }
  // AI sometimes generates a non-standard format — normalize each node
  const normalizedNodes = nodes.map((n: any) => {
    if (n.inputs && Array.isArray(n.inputs)) return n; // already correct
    const node: any = {
      id: n.id,
      type: normalizeNodeType(n.type),
      position: n.position ?? { x: 0, y: 0 },
      instanceName: n.instanceName,
      inputs: [],
      outputs: [],
    };
    // Handle tag for variable nodes
    if (node.type === 'IN_VARIABLE' || node.type === 'OUT_VARIABLE') {
      node.tag = n.tag ?? n.output?.tag ?? n.input?.tag ?? { name: n.id };
      if (node.type === 'IN_VARIABLE') {
        node.outputs = [{ id: 'OUT', name: 'OUT' }];
      } else {
        node.inputs = [{ id: 'IN', name: 'IN' }];
      }
      return node;
    }
    // For function blocks, build inputs/outputs from params or standard pins
    if (n.params) {
      // AI used params object — convert keys to inputs
      const paramKeys = Object.keys(n.params);
      node.inputs = paramKeys.map((k: string) => ({ id: k, name: k }));
      node.outputs = [{ id: 'OUT', name: 'OUT' }];
    }
    if (n.input) {
      node.inputs = [{ id: 'IN', name: 'IN' }];
    }
    if (n.output) {
      node.outputs = [{ id: 'OUT', name: 'OUT' }];
      if (n.output.tag) node.tag = n.output.tag;
    }
    // Fallback: use standard pin definitions based on type
    if (node.inputs.length === 0) node.inputs = getDefaultInputs(node.type);
    if (node.outputs.length === 0) node.outputs = getDefaultOutputs(node.type);
    return node;
  });
  return { nodes: normalizedNodes, wires };
}

function normalizeNodeType(type: string): string {
  const upper = (type ?? '').toUpperCase();
  const map: Record<string, string> = {
    'SR': 'SR', 'RS': 'RS', 'TON': 'TON', 'TOF': 'TOF', 'TP': 'TP',
    'CTU': 'CTU', 'CTD': 'CTD', 'CTUD': 'CTUD',
    'AND': 'AND', 'OR': 'OR', 'NOT': 'NOT', 'XOR': 'XOR',
    'ADD': 'ADD', 'SUB': 'SUB', 'MUL': 'MUL', 'DIV': 'DIV',
    'GT': 'GT', 'LT': 'LT', 'GE': 'GE', 'LE': 'LE', 'EQ': 'EQ', 'NE': 'NE',
    'IN_VARIABLE': 'IN_VARIABLE', 'OUT_VARIABLE': 'OUT_VARIABLE', 'LITERAL': 'LITERAL',
  };
  return map[upper] ?? upper;
}

function getDefaultInputs(type: string): Array<{id: string; name: string}> {
  switch (type) {
    case 'NOT': return [{ id: 'IN', name: 'IN' }];
    case 'AND': case 'OR': case 'XOR': return [{ id: 'IN1', name: 'IN1' }, { id: 'IN2', name: 'IN2' }];
    case 'TON': case 'TOF': case 'TP': return [{ id: 'IN', name: 'IN' }, { id: 'PT', name: 'PT' }];
    case 'CTU': return [{ id: 'CU', name: 'CU' }, { id: 'R', name: 'R' }, { id: 'PV', name: 'PV' }];
    case 'CTD': return [{ id: 'CD', name: 'CD' }, { id: 'LD', name: 'LD' }, { id: 'PV', name: 'PV' }];
    case 'SR': return [{ id: 'S1', name: 'S1' }, { id: 'R', name: 'R' }];
    case 'RS': return [{ id: 'S', name: 'S' }, { id: 'R1', name: 'R1' }];
    case 'ADD': case 'SUB': case 'MUL': case 'DIV': return [{ id: 'IN1', name: 'IN1' }, { id: 'IN2', name: 'IN2' }];
    case 'GT': case 'LT': case 'GE': case 'LE': case 'EQ': case 'NE': return [{ id: 'IN1', name: 'IN1' }, { id: 'IN2', name: 'IN2' }];
    default: return [{ id: 'IN', name: 'IN' }];
  }
}

function getDefaultOutputs(type: string): Array<{id: string; name: string}> {
  switch (type) {
    case 'TON': case 'TOF': case 'TP': return [{ id: 'Q', name: 'Q' }, { id: 'ET', name: 'ET' }];
    case 'CTU': case 'CTD': return [{ id: 'Q', name: 'Q' }, { id: 'CV', name: 'CV' }];
    case 'SR': case 'RS': return [{ id: 'Q1', name: 'Q1' }];
    default: return [{ id: 'OUT', name: 'OUT' }];
  }
}

// ── Main LogicTab ─────────────────────────────────────────────────────────────
export interface LoadProgramPayload {
  language: EditorLanguage;
  program: any;
  tags: import('./logicStore.js').TagEntry[];
  fileName: string;
}

export const LogicTab: React.FC<{ lockedLanguage?: EditorLanguage; onSwitchToCode?: () => void; loadProgram?: LoadProgramPayload | null }> = ({ lockedLanguage, loadProgram, onSwitchToCode }) => {
  const storeLanguage     = useLogicStoreSelector(s => s.activeLanguage);
  const activeLanguage    = lockedLanguage ?? storeLanguage;
  const crossRefPanelOpen = useLogicStoreSelector(s => s.crossRefPanelOpen);

  // When the host passes a loadProgram payload (new file opened), load it into the store
  useEffect(() => {
    if (!loadProgram) return;
    const { language, program, tags, fileName } = loadProgram;
    logicStore.setActiveLanguage(language);
    if (language === 'LD') {
      const ld = program.ladderProgram ?? program;
      logicStore.loadLadderProgram(ld);
    } else if (language === 'FBD') {
      const fbd = program.fbdProgram ?? program;
      logicStore.loadFBDProgram(fbd);
    } else if (language === 'SFC') {
      const sfc = program.sfcProgram ?? program;
      logicStore.loadSFCProgram(sfc);
    }
    if (tags.length > 0) {
      logicStore.setTagDatabase(tags);
      logicStore.addAllTagsToWatchList();
    }
    logicStore.addConsoleEntry('success', `Loaded ${language} program from ${fileName} (${tags.length} tags)`);
  }, [loadProgram]);

  // Initialize CLM graph from logicStore on first mount
  useEffect(() => {
    if (!clmStore.initialized) {
      const state = logicStore.getState();
      clmStore.initialize(state.ladderProgram, state.fbdProgram, state.sfcProgram, state.tagDatabase);
      const errors = validateCLM(clmStore.graph);
      if (errors.length > 0) {
        console.warn('[CLM] Validation errors after init:', errors);
      } else {
        console.log('[CLM] Validation passed: 0 errors');
      }

      // Expose diagnostic on window for manual testing — auto-run once on init
      (window as any).__CLM_DIAG = () => {
        const g = clmStore.graph;
        const ladder = clmStore.getLadderProgram();
        const fbd = clmStore.getFBDProgram();
        const sfc = clmStore.getSFCProgram();
        const tags = clmStore.getTagDatabase();
        const crossRef = clmStore.getCrossReferences('MOTOR_RUN');
        const valErrors = validateCLM(g);

        const report = {
          graph: { nodes: g.nodeCount, edges: g.edgeCount },
          projections: {
            ladder: { rungs: ladder.rungs.length, elements: ladder.rungs.reduce((s, r) => s + r.elements.length, 0) },
            fbd: { nodes: fbd.nodes.length, wires: fbd.wires.length },
            sfc: { steps: sfc.steps.length, transitions: sfc.transitions.length, links: sfc.links.length },
            tags: tags.length,
          },
          crossRef_MOTOR_RUN: crossRef,
          validation: { errors: valErrors.length, details: valErrors },
          snapshot: { bytes: clmStore.snapshot().length },
        };
        console.log('[CLM-DIAG] Full diagnostic report:', JSON.stringify(report, null, 2));
        return report;
      };
    }
  }, []);

  // exportRef is attached only to the canvas area div used for PNG/PDF export.
  // It is NOT passed into child canvas components to avoid double-attach.
  const exportRef = useRef<HTMLDivElement>(null);

  const exportPNG = useCallback(async () => {
    if (!exportRef.current) return;
    const dataUrl = await toPng(exportRef.current, { quality: 1, pixelRatio: 2 });
    const a = document.createElement('a');
    a.download = `plc-${activeLanguage.toLowerCase()}-${Date.now()}.png`;
    a.href = dataUrl;
    a.click();
  }, [activeLanguage]);

  const exportPDF = useCallback(async () => {
    if (!exportRef.current) return;
    const dataUrl = await toPng(exportRef.current, { quality: 1, pixelRatio: 2 });
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [exportRef.current.scrollWidth, exportRef.current.scrollHeight],
    });
    pdf.addImage(dataUrl, 'PNG', 0, 0, exportRef.current.scrollWidth, exportRef.current.scrollHeight);
    pdf.save(`plc-${activeLanguage.toLowerCase()}.pdf`);
  }, [activeLanguage]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', width: '100%',
      background: 'var(--vscode-editor-background)',
      color: 'var(--vscode-foreground)',
      fontFamily: 'inherit',
      fontSize: 13,
      overflow: 'hidden',
    }}>
      {/* ── Sub-tab bar ── */}
      <div
        role="tablist"
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'stretch',
          height: 35,
          background: 'var(--vscode-editorGroupHeader-tabsBackground)',
          borderBottom: '1px solid var(--vscode-editorGroupHeader-tabsBorder, var(--vscode-panel-border, transparent))',
          overflow: 'hidden',
        }}
      >
        {!lockedLanguage && ([
          ['LD',  'Ladder (LD)',   'IEC 61131-3 Ladder Diagram'],
          ['FBD', 'FBD',           'Function Block Diagram'],
          ['SFC', 'SFC',           'Sequential Function Chart'],
        ] as [EditorLanguage, string, string][]).map(([id, label, desc]) => (
          <SubTabButton
            key={id}
            label={label}
            description={desc}
            active={activeLanguage === id}
            onClick={() => logicStore.setActiveLanguage(id)}
          />
        ))}
        {lockedLanguage && (
          <span style={{
            padding: '0 14px', fontSize: 13, fontWeight: 600,
            color: 'var(--vscode-tab-activeForeground)', alignSelf: 'center',
          }}>
            {lockedLanguage === 'LD' ? 'Ladder (LD)' : lockedLanguage === 'FBD' ? 'Function Block (FBD)' : 'Sequential Function Chart (SFC)'}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{
          padding: '0 12px', fontSize: 10, letterSpacing: '0.04em',
          color: 'var(--vscode-descriptionForeground)', alignSelf: 'center',
          textTransform: 'uppercase',
        }}>
          IEC 61131-3
        </span>
      </div>

      {/* ── Toolbar ── */}
      <LogicToolbar onExportPNG={exportPNG} onExportPDF={exportPDF} />

      {/* ── Editor area ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* The exportRef wraps only the visible canvas area, not the cross-ref panel */}
        <div
          ref={exportRef}
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            // Slide the cross-ref panel in from the right without reflowing the canvas
            marginRight: crossRefPanelOpen ? 280 : 0,
            transition: 'margin-right 0.18s',
          }}
        >
          <div style={{ display: activeLanguage === 'LD'  ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}><LadderCanvas /></div>
          <div style={{ display: activeLanguage === 'FBD' ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}><FBDCanvas /></div>
          <div style={{ display: activeLanguage === 'SFC' ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}><SFCCanvas /></div>
        </div>

        {crossRefPanelOpen && <CrossReferencePanel />}
      </div>

    </div>
  );
};

// ── Status bar ────────────────────────────────────────────────────────────────
const StatusBar: React.FC = () => {
  const activeLanguage = useLogicStoreSelector(s => s.activeLanguage);
  const monitorMode    = useLogicStoreSelector(s => s.monitorMode);
  const ladderProgram  = useLogicStoreSelector(s => s.ladderProgram);
  const fbdProgram     = useLogicStoreSelector(s => s.fbdProgram);
  const sfcProgram     = useLogicStoreSelector(s => s.sfcProgram);
  const tagDatabase    = useLogicStoreSelector(s => s.tagDatabase);

  const counts: Record<string, string> = {
    LD:  `${ladderProgram.rungs.length} rung${ladderProgram.rungs.length !== 1 ? 's' : ''}`,
    FBD: `${fbdProgram.nodes.length} block${fbdProgram.nodes.length !== 1 ? 's' : ''}`,
    SFC: `${sfcProgram.steps.length} step${sfcProgram.steps.length !== 1 ? 's' : ''}`,
  };

  const modeColor = monitorMode === 'running'
    ? 'var(--vscode-charts-green, #a6e3a1)'
    : monitorMode === 'paused'
      ? 'var(--vscode-charts-yellow, #f9e2af)'
      : 'var(--vscode-descriptionForeground)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '0 12px', height: 22, flexShrink: 0,
      background: 'var(--vscode-statusBar-background, var(--vscode-editorGroupHeader-tabsBackground))',
      borderTop: '1px solid var(--vscode-panel-border, transparent)',
      fontSize: 11,
      color: 'var(--vscode-statusBar-foreground, var(--vscode-descriptionForeground))',
    }}>
      <span>PLC Logic Editor</span>
      <span style={{ color: 'var(--vscode-editorGroup-border)' }}>|</span>
      <span style={{ color: 'var(--vscode-foreground)', fontWeight: 600 }}>{activeLanguage}</span>
      <span style={{ color: 'var(--vscode-editorGroup-border)' }}>|</span>
      <span>{counts[activeLanguage]}</span>
      <span style={{ color: 'var(--vscode-editorGroup-border)' }}>|</span>
      <span>{tagDatabase.length} tag{tagDatabase.length !== 1 ? 's' : ''}</span>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: modeColor }} />
        <span style={{ color: modeColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {monitorMode}
        </span>
      </div>
    </div>
  );
};
