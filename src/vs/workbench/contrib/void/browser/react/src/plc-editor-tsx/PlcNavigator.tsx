/*
 * PlcNavigator — Library panel for the PLC editor sidebar.
 *
 * Structure:
 *   PROGRAMS
 *     └─ main (POU)
 *          ├─ Ladder Diagram
 *          ├─ Function Block Diagram
 *          └─ Sequential Function Chart
 *   TAG DATABASE
 *   LADDER DIAGRAM (LD)
 *     ├─ Contacts
 *     ├─ Coils
 *     ├─ Timers
 *     ├─ Counters
 *     ├─ Bistable
 *     └─ Edge Detect
 *   FUNCTION BLOCK DIAGRAM (FBD)
 *     ├─ Variables
 *     ├─ Logic
 *     ├─ Arithmetic
 *     ├─ Compare
 *     ├─ Timers
 *     ├─ Counters
 *     ├─ Bistable
 *     ├─ Selection
 *     ├─ Edge Detect
 *     └─ Wiring
 *   SEQUENTIAL FUNCTION CHART (SFC)
 *     ├─ Steps
 *     └─ Transitions
 *   IEC STANDARD LIBRARY
 *     ├─ Timers
 *     ├─ Counters
 *     ├─ Bistable
 *     ├─ Edge Detect
 *     ├─ Math
 *     ├─ Comparison
 *     ├─ Logic
 *     ├─ Selection
 *     └─ Data Move
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLogicStoreSelector, logicStore } from './logicStore.js';

// ─── VS Code class name helper ─────────────────────────────────────────────────
const vsClass = (...parts: string[]) => parts.join(' ');

// ─── Primitives ────────────────────────────────────────────────────────────────

const Codicon: React.FC<{ name: string; style?: React.CSSProperties }> = ({ name, style }) => (
  <span
    className={vsClass('codicon', 'codicon-' + name)}
    style={{ fontSize: 16, width: 16, height: 16, display: 'inline-flex', alignItems: 'center',
             justifyContent: 'center', flexShrink: 0, lineHeight: 1, ...style }}
  />
);

const Twisty: React.FC<{ open: boolean }> = ({ open }) => (
  <Codicon name={open ? 'chevron-down' : 'chevron-right'}
    style={{ color: 'var(--vscode-icon-foreground)', marginRight: 2, flexShrink: 0 }} />
);

// ─── Section header ────────────────────────────────────────────────────────────
const SectionHeader: React.FC<{
  label: string;
  sublabel?: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  isFirst?: boolean;
  accentColor?: string;
}> = ({ label, sublabel, count, open, onToggle, isFirst, accentColor }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 22,
        lineHeight: '22px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        cursor: 'pointer',
        userSelect: 'none',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--vscode-sideBarSectionHeader-foreground)',
        backgroundColor: hov
          ? 'var(--vscode-list-hoverBackground)'
          : 'var(--vscode-sideBarSectionHeader-background)',
        borderTop: isFirst ? 'none' : '1px solid var(--vscode-sideBarSectionHeader-border,transparent)',
      }}
    >
      <Twisty open={open} />
      <span style={{ flex: 1, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
        {sublabel && (
          <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0,
            color: accentColor ?? 'var(--vscode-descriptionForeground)', marginLeft: 4, fontSize: 10 }}>
            {sublabel}
          </span>
        )}
      </span>
      {count !== undefined && (
        <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)',
          flexShrink: 0, marginRight: 6 }}>{count}</span>
      )}
    </div>
  );
};

// ─── Tree row ──────────────────────────────────────────────────────────────────
const TreeRow: React.FC<{
  indent?: number;
  selected?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: React.DragEventHandler;
  title?: string;
  children: React.ReactNode;
}> = ({ indent = 0, selected, onClick, draggable, onDragStart, title, children }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', height: 22,
        paddingLeft: 8 + indent * 8, paddingRight: 8, gap: 4,
        boxSizing: 'border-box', overflow: 'hidden',
        cursor: onClick ? 'pointer' : draggable ? 'grab' : 'default',
        userSelect: 'none', fontSize: 13, fontWeight: 400,
        lineHeight: '22px', whiteSpace: 'nowrap',
        background: selected
          ? 'var(--vscode-list-activeSelectionBackground)'
          : hov ? 'var(--vscode-list-hoverBackground)' : 'transparent',
        color: selected
          ? 'var(--vscode-list-activeSelectionForeground)'
          : 'var(--vscode-list-foreground,var(--vscode-foreground))',
        outline: selected ? '1px solid var(--vscode-list-focusOutline,transparent)' : 'none',
        outlineOffset: '-1px',
      }}
    >
      {children}
    </div>
  );
};

// ─── Sub-group row (collapsible folder) ───────────────────────────────────────
const GroupRow: React.FC<{
  label: string;
  icon?: string;
  iconColor?: string;
  count?: number;
  open: boolean;
  indent?: number;
  onToggle: () => void;
}> = ({ label, icon, iconColor, count, open, indent = 1, onToggle }) => (
  <TreeRow indent={indent} onClick={onToggle}>
    <Twisty open={open} />
    {icon && <Codicon name={icon} style={{ color: iconColor, fontSize: 14 }} />}
    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13 }}>
      {label}
    </span>
    {count !== undefined && (
      <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)', flexShrink: 0, marginRight: 4 }}>
        {count}
      </span>
    )}
  </TreeRow>
);

// ─── PROGRAMS section ──────────────────────────────────────────────────────────
const LANG_ICON: Record<string, string> = { LD: 'pulse', FBD: 'type-hierarchy', SFC: 'git-branch' };
const LANG_COLOR: Record<string, string> = {
  LD:  'var(--vscode-charts-blue,#60a5fa)',
  FBD: 'var(--vscode-charts-green,#4ade80)',
  SFC: 'var(--vscode-charts-purple,#a78bfa)',
};

const ProgramSection: React.FC = () => {
  const [open, setOpen] = useState(true);
  const [mainOpen, setMainOpen] = useState(true);
  const lang   = useLogicStoreSelector(s => s.activeLanguage);
  const ladder = useLogicStoreSelector(s => s.ladderProgram);
  const fbd    = useLogicStoreSelector(s => s.fbdProgram);
  const sfc    = useLogicStoreSelector(s => s.sfcProgram);

  const programs = [
    { id: 'LD'  as const, label: 'Ladder Diagram',            detail: `${ladder.rungs.length} rung${ladder.rungs.length !== 1 ? 's' : ''}` },
    { id: 'FBD' as const, label: 'Function Block Diagram',    detail: `${fbd.nodes.length} block${fbd.nodes.length !== 1 ? 's' : ''}` },
    { id: 'SFC' as const, label: 'Sequential Function Chart', detail: `${sfc.steps.length} step${sfc.steps.length !== 1 ? 's' : ''}` },
  ];

  return (
    <div>
      <SectionHeader label="Programs" open={open} onToggle={() => setOpen(o => !o)} isFirst />
      {open && (
        <>
          <TreeRow indent={1} onClick={() => setMainOpen(o => !o)}>
            <Twisty open={mainOpen} />
            <Codicon name="symbol-class" style={{ color: 'var(--vscode-charts-orange,#fb923c)', fontSize: 14 }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>main</span>
            <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)', flexShrink: 0 }}>POU</span>
          </TreeRow>
          {mainOpen && programs.map(p => (
            <TreeRow key={p.id} indent={3} selected={lang === p.id} onClick={() => logicStore.setActiveLanguage(p.id)}>
              <Codicon name={LANG_ICON[p.id]} style={{ color: LANG_COLOR[p.id], fontSize: 14 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</span>
              <span style={{ fontSize: 10, flexShrink: 0, color: 'var(--vscode-descriptionForeground)' }}>{p.detail}</span>
            </TreeRow>
          ))}
        </>
      )}
    </div>
  );
};

// ─── TAG DATABASE section ──────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
  BOOL:  'var(--vscode-charts-blue,#60a5fa)',
  INT:   'var(--vscode-charts-yellow,#fbbf24)',
  DINT:  'var(--vscode-charts-yellow,#fbbf24)',
  REAL:  'var(--vscode-charts-green,#34d399)',
  LREAL: 'var(--vscode-charts-green,#34d399)',
  WORD:  'var(--vscode-charts-orange,#fb923c)',
  DWORD: 'var(--vscode-charts-orange,#fb923c)',
  STRING:'var(--vscode-charts-pink,#f472b6)',
};

const TagSection: React.FC = () => {
  const [open, setOpen] = useState(false);
  const tags = useLogicStoreSelector(s => s.tagDatabase);
  return (
    <div>
      <SectionHeader label="Tag Database" count={tags.length} open={open} onToggle={() => setOpen(o => !o)} isFirst />
      {open && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 44px', height: 20,
            alignItems: 'center', padding: '0 8px 0 24px', fontSize: 10,
            color: 'var(--vscode-descriptionForeground)',
            borderBottom: '1px solid var(--vscode-editorGroup-border)' }}>
            <span>TYPE</span><span>NAME</span><span style={{ textAlign: 'right' }}>VAL</span>
          </div>
          {tags.length === 0 ? (
            <TreeRow indent={1}>
              <Codicon name="symbol-variable" style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 14 }} />
              <span style={{ fontStyle: 'italic', color: 'var(--vscode-descriptionForeground)', fontSize: 12 }}>No tags defined</span>
            </TreeRow>
          ) : tags.map(tag => (
            <TreeRow key={tag.name} indent={1}>
              <span style={{ fontSize: 8, padding: '1px 3px', borderRadius: 3, flexShrink: 0,
                lineHeight: '14px', fontWeight: 700, fontFamily: 'var(--vscode-editor-font-family,monospace)',
                background: 'var(--vscode-badge-background)',
                color: TYPE_COLOR[tag.dataType] ?? 'var(--vscode-descriptionForeground)' }}>
                {tag.dataType}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                fontFamily: 'var(--vscode-editor-font-family,monospace)', fontSize: 12 }} title={tag.description ?? ''}>
                {tag.name}
              </span>
              <span style={{ fontSize: 10, flexShrink: 0, color: 'var(--vscode-descriptionForeground)',
                fontFamily: 'var(--vscode-editor-font-family,monospace)' }}>
                {tag.liveValue ?? '—'}
              </span>
            </TreeRow>
          ))}
        </>
      )}
    </div>
  );
};

// ─── Shared element group renderer ────────────────────────────────────────────
type ElemItem = { kind: string; label: string; symbol: string };
type ElemGroup = { title: string; icon: string; color: string; items: ElemItem[] };

const ElementGroupList: React.FC<{
  groups: ElemGroup[];
  dragType: string;
  baseIndent?: number;
}> = ({ groups, dragType, baseIndent = 1 }) => {
  const makeDefault = (gs: ElemGroup[]) => {
    const r: Record<string, boolean> = {};
    gs.forEach(g => { r[g.title] = false; });
    return r;
  };
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(() => makeDefault(groups));

  const setDrag = (e: React.DragEvent, kind: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(dragType, kind);
    e.dataTransfer.setData('text/plain', kind);
  };

  return (
    <>
      {groups.map(group => (
        <div key={group.title}>
          <GroupRow
            label={group.title}
            icon={group.icon}
            iconColor={group.color}
            count={group.items.length}
            open={!!groupOpen[group.title]}
            indent={baseIndent}
            onToggle={() => setGroupOpen(s => ({ ...s, [group.title]: !s[group.title] }))}
          />
          {groupOpen[group.title] && group.items.map(item => (
            <TreeRow key={item.kind} indent={baseIndent + 2} draggable
              onDragStart={e => setDrag(e, item.kind)}
              title={`Drag to add: ${item.label}`}>
              <span style={{
                fontFamily: 'var(--vscode-editor-font-family,monospace)',
                fontSize: 9, fontWeight: 700, color: group.color,
                flexShrink: 0, minWidth: 24, letterSpacing: -0.5,
              }}>
                {item.symbol}
              </span>
              <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.label}
              </span>
            </TreeRow>
          ))}
        </div>
      ))}
    </>
  );
};

// ─── LD element definitions ────────────────────────────────────────────────────
const LD_GROUPS: ElemGroup[] = [
  {
    title: 'Contacts', icon: 'zap', color: 'var(--vscode-charts-blue,#60a5fa)',
    items: [
      { kind: 'contact-NO', label: 'Normally Open (NO)', symbol: '─┤├─' },
      { kind: 'contact-NC', label: 'Normally Closed (NC)', symbol: '─┤/├─' },
      { kind: 'contact-P',  label: 'Positive Edge (P↑)', symbol: '─┤P├─' },
      { kind: 'contact-N',  label: 'Negative Edge (N↓)', symbol: '─┤N├─' },
    ],
  },
  {
    title: 'Coils', icon: 'circle-outline', color: 'var(--vscode-charts-pink,#f472b6)',
    items: [
      { kind: 'coil-normal',  label: 'Output Coil', symbol: '─( )─' },
      { kind: 'coil-negated', label: 'NOT Coil',    symbol: '─(/)─' },
      { kind: 'coil-set',     label: 'Set (S)',      symbol: '─(S)─' },
      { kind: 'coil-reset',   label: 'Reset (R)',    symbol: '─(R)─' },
      { kind: 'coil-latch',   label: 'Latch (L)',    symbol: '─(L)─' },
      { kind: 'coil-unlatch', label: 'Unlatch (U)',  symbol: '─(U)─' },
    ],
  },
  {
    title: 'Timers', icon: 'watch', color: 'var(--vscode-charts-purple,#a78bfa)',
    items: [
      { kind: 'block-TON', label: 'TON — On-Delay Timer',  symbol: 'TON' },
      { kind: 'block-TOF', label: 'TOF — Off-Delay Timer', symbol: 'TOF' },
      { kind: 'block-TP',  label: 'TP  — Pulse Timer',     symbol: 'TP' },
    ],
  },
  {
    title: 'Counters', icon: 'symbol-numeric', color: 'var(--vscode-charts-green,#34d399)',
    items: [
      { kind: 'block-CTU',  label: 'CTU  — Count Up',       symbol: 'CTU' },
      { kind: 'block-CTD',  label: 'CTD  — Count Down',     symbol: 'CTD' },
      { kind: 'block-CTUD', label: 'CTUD — Count Up/Down',  symbol: 'CTUD' },
    ],
  },
  {
    title: 'Bistable', icon: 'symbol-boolean', color: 'var(--vscode-charts-yellow,#fbbf24)',
    items: [
      { kind: 'block-SR', label: 'SR — Set-dominant flip-flop',   symbol: 'SR' },
      { kind: 'block-RS', label: 'RS — Reset-dominant flip-flop', symbol: 'RS' },
    ],
  },
  {
    title: 'Edge Detect', icon: 'graph-line', color: 'var(--vscode-descriptionForeground)',
    items: [
      { kind: 'block-RTRIG', label: 'R_TRIG — Rising edge',  symbol: 'R↑' },
      { kind: 'block-FTRIG', label: 'F_TRIG — Falling edge', symbol: 'F↓' },
    ],
  },
];

// ─── FBD element definitions ───────────────────────────────────────────────────
const FBD_GROUPS: ElemGroup[] = [
  {
    title: 'Variables', icon: 'symbol-variable', color: 'var(--vscode-charts-green,#4ade80)',
    items: [
      { kind: 'fbd-IN_VARIABLE',   label: 'Input Variable',  symbol: '▷' },
      { kind: 'fbd-OUT_VARIABLE',  label: 'Output Variable', symbol: '▶' },
      { kind: 'fbd-INOUT_VARIABLE',label: 'In/Out Variable', symbol: '⇄' },
    ],
  },
  {
    title: 'Logic Gates', icon: 'circuit-board', color: 'var(--vscode-charts-blue,#60a5fa)',
    items: [
      { kind: 'fbd-AND',  label: 'AND  — All inputs true',          symbol: '&'  },
      { kind: 'fbd-OR',   label: 'OR   — Any input true',           symbol: '≥1' },
      { kind: 'fbd-XOR',  label: 'XOR  — Exactly one input true',   symbol: '=1' },
      { kind: 'fbd-NOT',  label: 'NOT  — Invert input',             symbol: '¬'  },
      { kind: 'fbd-NAND', label: 'NAND — NOT AND',                  symbol: '¬&' },
      { kind: 'fbd-NOR',  label: 'NOR  — NOT OR',                   symbol: '¬≥1'},
    ],
  },
  {
    title: 'Arithmetic', icon: 'symbol-operator', color: 'var(--vscode-charts-green,#34d399)',
    items: [
      { kind: 'fbd-ADD',  label: 'ADD  — Addition',       symbol: '+'   },
      { kind: 'fbd-SUB',  label: 'SUB  — Subtraction',    symbol: '−'   },
      { kind: 'fbd-MUL',  label: 'MUL  — Multiply',       symbol: '×'   },
      { kind: 'fbd-DIV',  label: 'DIV  — Divide',         symbol: '÷'   },
      { kind: 'fbd-MOD',  label: 'MOD  — Modulo',         symbol: '%'   },
      { kind: 'fbd-ABS',  label: 'ABS  — Absolute value', symbol: '|x|' },
      { kind: 'fbd-SQRT', label: 'SQRT — Square root',    symbol: '√'   },
    ],
  },
  {
    title: 'Comparison', icon: 'diff', color: 'var(--vscode-charts-orange,#fb923c)',
    items: [
      { kind: 'fbd-EQ', label: 'EQ — Equal',             symbol: '=' },
      { kind: 'fbd-NE', label: 'NE — Not equal',         symbol: '≠' },
      { kind: 'fbd-GT', label: 'GT — Greater than',      symbol: '>' },
      { kind: 'fbd-GE', label: 'GE — Greater or equal',  symbol: '≥' },
      { kind: 'fbd-LT', label: 'LT — Less than',         symbol: '<' },
      { kind: 'fbd-LE', label: 'LE — Less or equal',     symbol: '≤' },
    ],
  },
  {
    title: 'Timers', icon: 'watch', color: 'var(--vscode-charts-purple,#a78bfa)',
    items: [
      { kind: 'fbd-TON', label: 'TON — On-Delay Timer',  symbol: 'TON' },
      { kind: 'fbd-TOF', label: 'TOF — Off-Delay Timer', symbol: 'TOF' },
      { kind: 'fbd-TP',  label: 'TP  — Pulse Timer',     symbol: 'TP'  },
    ],
  },
  {
    title: 'Counters', icon: 'symbol-numeric', color: 'var(--vscode-charts-pink,#f472b6)',
    items: [
      { kind: 'fbd-CTU',  label: 'CTU  — Count Up',      symbol: 'CTU'  },
      { kind: 'fbd-CTD',  label: 'CTD  — Count Down',    symbol: 'CTD'  },
      { kind: 'fbd-CTUD', label: 'CTUD — Up/Down',       symbol: 'CTUD' },
    ],
  },
  {
    title: 'Bistable', icon: 'symbol-boolean', color: 'var(--vscode-charts-yellow,#fbbf24)',
    items: [
      { kind: 'fbd-SR', label: 'SR — Set-dominant',   symbol: 'SR' },
      { kind: 'fbd-RS', label: 'RS — Reset-dominant', symbol: 'RS' },
    ],
  },
  {
    title: 'Selection', icon: 'list-selection', color: 'var(--vscode-icon-foreground)',
    items: [
      { kind: 'fbd-SEL',   label: 'SEL   — Select two inputs', symbol: 'SEL' },
      { kind: 'fbd-MUX',   label: 'MUX   — Multiplexer',       symbol: 'MUX' },
      { kind: 'fbd-LIMIT', label: 'LIMIT — Clamp to range',     symbol: 'LIM' },
      { kind: 'fbd-MIN',   label: 'MIN   — Minimum of inputs',  symbol: 'MIN' },
      { kind: 'fbd-MAX',   label: 'MAX   — Maximum of inputs',  symbol: 'MAX' },
      { kind: 'fbd-MOVE',  label: 'MOVE  — Copy value',         symbol: 'MOV' },
    ],
  },
  {
    title: 'Edge Detect', icon: 'graph-line', color: 'var(--vscode-icon-foreground)',
    items: [
      { kind: 'fbd-RTRIG', label: 'R_TRIG — Rising edge',  symbol: 'R↑' },
      { kind: 'fbd-FTRIG', label: 'F_TRIG — Falling edge', symbol: 'F↓' },
    ],
  },
  {
    title: 'Wiring', icon: 'arrow-both', color: 'var(--vscode-charts-blue,#60a5fa)',
    items: [
      { kind: 'fbd-CONNECTOR',   label: 'Connector',   symbol: '→|' },
      { kind: 'fbd-CONTINUATION',label: 'Continuation',symbol: '|→' },
      { kind: 'fbd-COMMENT',     label: 'Comment',     symbol: '✎'  },
    ],
  },
];

// ─── SFC element definitions ───────────────────────────────────────────────────
const SFC_GROUPS: ElemGroup[] = [
  {
    title: 'Steps', icon: 'symbol-interface', color: 'var(--vscode-charts-blue,#60a5fa)',
    items: [
      { kind: 'sfc-step',         label: 'Step',         symbol: '□' },
      { kind: 'sfc-initial-step', label: 'Initial Step', symbol: '▣' },
    ],
  },
  {
    title: 'Transitions', icon: 'arrow-right', color: 'var(--vscode-charts-purple,#a78bfa)',
    items: [
      { kind: 'sfc-transition', label: 'Transition', symbol: '—' },
    ],
  },
  {
    title: 'Divergence', icon: 'git-branch', color: 'var(--vscode-charts-green,#4ade80)',
    items: [
      { kind: 'sfc-AND-diverge',  label: 'AND Diverge  (parallel split)',   symbol: '═╦═' },
      { kind: 'sfc-AND-converge', label: 'AND Converge (parallel join)',     symbol: '═╩═' },
      { kind: 'sfc-OR-diverge',   label: 'OR Diverge  (exclusive split)',    symbol: '─┬─' },
      { kind: 'sfc-OR-converge',  label: 'OR Converge (exclusive join)',     symbol: '─┴─' },
    ],
  },
  {
    title: 'Actions', icon: 'symbol-event', color: 'var(--vscode-charts-orange,#fb923c)',
    items: [
      { kind: 'sfc-action-N',  label: 'Action N  — Non-stored',      symbol: 'N'  },
      { kind: 'sfc-action-S',  label: 'Action S  — Set (stored)',     symbol: 'S'  },
      { kind: 'sfc-action-R',  label: 'Action R  — Reset',           symbol: 'R'  },
      { kind: 'sfc-action-L',  label: 'Action L  — Time-limited',    symbol: 'L'  },
      { kind: 'sfc-action-D',  label: 'Action D  — Time-delayed',    symbol: 'D'  },
      { kind: 'sfc-action-P',  label: 'Action P  — Pulse',           symbol: 'P'  },
    ],
  },
];

// ─── LD section ────────────────────────────────────────────────────────────────
const LadderSection: React.FC = () => {
  const [open, setOpen] = useState(false);
  const total = LD_GROUPS.reduce((s, g) => s + g.items.length, 0);
  return (
    <div>
      <SectionHeader
        label="Ladder Diagram"
        count={total}
        open={open}
        onToggle={() => setOpen(o => !o)}
      />
      {open && (
        <ElementGroupList
          groups={LD_GROUPS}
          dragType="application/plc-ladder-element"
        />
      )}
    </div>
  );
};

// ─── FBD section ───────────────────────────────────────────────────────────────
const FBDSection: React.FC = () => {
  const [open, setOpen] = useState(false);
  const total = FBD_GROUPS.reduce((s, g) => s + g.items.length, 0);
  return (
    <div>
      <SectionHeader
        label="Function Block Diagram"
        count={total}
        open={open}
        onToggle={() => setOpen(o => !o)}
      />
      {open && (
        <ElementGroupList
          groups={FBD_GROUPS}
          dragType="application/plc-fbd-element"
        />
      )}
    </div>
  );
};

// ─── SFC section ───────────────────────────────────────────────────────────────
const SFCSection: React.FC = () => {
  const [open, setOpen] = useState(false);
  const total = SFC_GROUPS.reduce((s, g) => s + g.items.length, 0);
  return (
    <div>
      <SectionHeader
        label="Sequential Function Chart"
        count={total}
        open={open}
        onToggle={() => setOpen(o => !o)}
      />
      {open && (
        <ElementGroupList
          groups={SFC_GROUPS}
          dragType="application/plc-sfc-element"
        />
      )}
    </div>
  );
};

// ─── IEC Standard Library section ─────────────────────────────────────────────
type LibItem = { name: string; desc: string; inputs?: string; output?: string };
type LibGroup = { group: string; icon: string; color: string; items: LibItem[] };

const IEC_LIBRARY: LibGroup[] = [
  {
    group: 'Timers', icon: 'watch', color: 'var(--vscode-charts-purple,#a78bfa)',
    items: [
      { name: 'TON',  desc: 'On-Delay Timer',   inputs: 'IN, PT',     output: 'Q, ET' },
      { name: 'TOF',  desc: 'Off-Delay Timer',  inputs: 'IN, PT',     output: 'Q, ET' },
      { name: 'TP',   desc: 'Pulse Timer',       inputs: 'IN, PT',     output: 'Q, ET' },
    ],
  },
  {
    group: 'Counters', icon: 'symbol-numeric', color: 'var(--vscode-charts-green,#34d399)',
    items: [
      { name: 'CTU',  desc: 'Count Up',          inputs: 'CU, R, PV',  output: 'Q, CV' },
      { name: 'CTD',  desc: 'Count Down',        inputs: 'CD, LD, PV', output: 'Q, CV' },
      { name: 'CTUD', desc: 'Count Up/Down',     inputs: 'CU, CD, R, LD, PV', output: 'QU, QD, CV' },
    ],
  },
  {
    group: 'Bistable', icon: 'symbol-boolean', color: 'var(--vscode-charts-yellow,#fbbf24)',
    items: [
      { name: 'SR',  desc: 'Set-dominant flip-flop',   inputs: 'S1, R',  output: 'Q1' },
      { name: 'RS',  desc: 'Reset-dominant flip-flop', inputs: 'S, R1',  output: 'Q1' },
    ],
  },
  {
    group: 'Edge Detect', icon: 'graph-line', color: 'var(--vscode-descriptionForeground)',
    items: [
      { name: 'R_TRIG', desc: 'Rising edge detector',  inputs: 'CLK', output: 'Q' },
      { name: 'F_TRIG', desc: 'Falling edge detector', inputs: 'CLK', output: 'Q' },
    ],
  },
  {
    group: 'Math', icon: 'symbol-operator', color: 'var(--vscode-charts-green,#34d399)',
    items: [
      { name: 'ADD',  desc: 'Addition',       inputs: 'IN1, IN2', output: 'OUT' },
      { name: 'SUB',  desc: 'Subtraction',    inputs: 'IN1, IN2', output: 'OUT' },
      { name: 'MUL',  desc: 'Multiplication', inputs: 'IN1, IN2', output: 'OUT' },
      { name: 'DIV',  desc: 'Division',       inputs: 'IN1, IN2', output: 'OUT' },
      { name: 'MOD',  desc: 'Modulo',         inputs: 'IN1, IN2', output: 'OUT' },
      { name: 'ABS',  desc: 'Absolute value', inputs: 'IN',       output: 'OUT' },
      { name: 'SQRT', desc: 'Square root',    inputs: 'IN',       output: 'OUT' },
      { name: 'SHL',  desc: 'Shift left',     inputs: 'IN, N',    output: 'OUT' },
      { name: 'SHR',  desc: 'Shift right',    inputs: 'IN, N',    output: 'OUT' },
    ],
  },
  {
    group: 'Comparison', icon: 'diff', color: 'var(--vscode-charts-orange,#fb923c)',
    items: [
      { name: 'EQ',  desc: 'Equal',            inputs: 'IN1, IN2', output: 'OUT' },
      { name: 'NE',  desc: 'Not equal',        inputs: 'IN1, IN2', output: 'OUT' },
      { name: 'GT',  desc: 'Greater than',     inputs: 'IN1, IN2', output: 'OUT' },
      { name: 'GE',  desc: 'Greater or equal', inputs: 'IN1, IN2', output: 'OUT' },
      { name: 'LT',  desc: 'Less than',        inputs: 'IN1, IN2', output: 'OUT' },
      { name: 'LE',  desc: 'Less or equal',    inputs: 'IN1, IN2', output: 'OUT' },
    ],
  },
  {
    group: 'Logic', icon: 'circuit-board', color: 'var(--vscode-charts-blue,#60a5fa)',
    items: [
      { name: 'AND',  desc: 'Bitwise AND',        inputs: 'IN1, IN2', output: 'OUT' },
      { name: 'OR',   desc: 'Bitwise OR',         inputs: 'IN1, IN2', output: 'OUT' },
      { name: 'XOR',  desc: 'Exclusive OR',       inputs: 'IN1, IN2', output: 'OUT' },
      { name: 'NOT',  desc: 'Logical NOT',        inputs: 'IN',       output: 'OUT' },
      { name: 'NAND', desc: 'NOT AND',            inputs: 'IN1, IN2', output: 'OUT' },
      { name: 'NOR',  desc: 'NOT OR',             inputs: 'IN1, IN2', output: 'OUT' },
    ],
  },
  {
    group: 'Selection', icon: 'list-selection', color: 'var(--vscode-icon-foreground)',
    items: [
      { name: 'SEL',   desc: 'Select between two',  inputs: 'G, IN0, IN1', output: 'OUT' },
      { name: 'MUX',   desc: 'Multiplexer',         inputs: 'K, IN0..INn', output: 'OUT' },
      { name: 'LIMIT', desc: 'Clamp to range',      inputs: 'MN, IN, MX',  output: 'OUT' },
      { name: 'MIN',   desc: 'Minimum of inputs',   inputs: 'IN1..INn',    output: 'OUT' },
      { name: 'MAX',   desc: 'Maximum of inputs',   inputs: 'IN1..INn',    output: 'OUT' },
    ],
  },
  {
    group: 'Data Move', icon: 'arrow-swap', color: 'var(--vscode-icon-foreground)',
    items: [
      { name: 'MOVE',  desc: 'Copy value',     inputs: 'IN',      output: 'OUT' },
      { name: 'CONCAT',desc: 'Concatenate',    inputs: 'IN1, IN2',output: 'OUT' },
    ],
  },
  {
    group: 'Type Convert', icon: 'symbol-type-parameter', color: 'var(--vscode-descriptionForeground)',
    items: [
      { name: 'INT_TO_REAL',  desc: 'INT → REAL',  inputs: 'IN', output: 'OUT' },
      { name: 'REAL_TO_INT',  desc: 'REAL → INT',  inputs: 'IN', output: 'OUT' },
      { name: 'BOOL_TO_INT',  desc: 'BOOL → INT',  inputs: 'IN', output: 'OUT' },
      { name: 'INT_TO_BOOL',  desc: 'INT → BOOL',  inputs: 'IN', output: 'OUT' },
      { name: 'INT_TO_DINT',  desc: 'INT → DINT',  inputs: 'IN', output: 'OUT' },
      { name: 'INT_TO_WORD',  desc: 'INT → WORD',  inputs: 'IN', output: 'OUT' },
    ],
  },
];

const IecLibrarySection: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});
  const total = IEC_LIBRARY.reduce((s, g) => s + g.items.length, 0);
  return (
    <div>
      <SectionHeader label="IEC Standard Library" count={total} open={open} onToggle={() => setOpen(o => !o)} />
      {open && IEC_LIBRARY.map(({ group, icon, color, items }) => (
        <div key={group}>
          <GroupRow
            label={group}
            icon={icon}
            iconColor={color}
            count={items.length}
            open={!!groupOpen[group]}
            onToggle={() => setGroupOpen(s => ({ ...s, [group]: !s[group] }))}
          />
          {groupOpen[group] && items.map(item => (
            <TreeRow key={item.name} indent={3} draggable
              onDragStart={e => {
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('application/plc-library-block', item.name);
                e.dataTransfer.setData('text/plain', item.name);
              }}
              title={item.inputs ? `${item.desc}\nIN: ${item.inputs}  OUT: ${item.output}` : item.desc}
            >
              <Codicon name="symbol-method" style={{ color, fontSize: 14 }} />
              <span style={{ fontFamily: 'var(--vscode-editor-font-family,monospace)', fontSize: 11,
                fontWeight: 600, flexShrink: 0, minWidth: 48 }}>{item.name}</span>
              <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)',
                overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.desc}</span>
            </TreeRow>
          ))}
        </div>
      ))}
    </div>
  );
};

// ─── Monitor footer ────────────────────────────────────────────────────────────
const MonitorFooter: React.FC = () => {
  const mode = useLogicStoreSelector(s => s.monitorMode);
  const scanRate = useLogicStoreSelector(s => s.scanRate);
  const running = mode === 'running';
  const [launching, setLaunching] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleRun = useCallback(async () => {
    if (launching) return;
    setErr(null);
    setLaunching(true);
    try {
      // Stub — will be wired to JS simulation engine
      console.log('[PlcNavigator] Run — simulation engine not yet wired');
    } catch (e: any) {
      setErr(e?.message ?? 'Launch failed');
    } finally {
      setLaunching(false);
    }
  }, [launching, scanRate]);

  const handleStop = useCallback(() => {
    setErr(null);
    // Stub — will be wired to JS simulation engine
    console.log('[PlcNavigator] Stop — simulation engine not yet wired');
  }, []);

  return (
    <div style={{ flexShrink: 0,
      borderTop: '1px solid var(--vscode-sideBarSectionHeader-border,transparent)',
      background: 'var(--vscode-sideBarSectionHeader-background)', fontSize: 11,
      color: 'var(--vscode-sideBar-foreground,var(--vscode-foreground))' }}>
      <div style={{ height: 28, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: running ? 'var(--vscode-charts-green,#22c55e)' : launching ? 'var(--vscode-charts-yellow,#f9e2af)' : 'var(--vscode-descriptionForeground)',
          boxShadow: running ? '0 0 4px var(--vscode-charts-green,#22c55e)' : 'none' }} />
        <span style={{ flex: 1 }}>{running ? 'Running' : launching ? 'Launching…' : 'Stopped'}</span>
        <button
          disabled={launching}
          onClick={running ? handleStop : handleRun}
          style={{ fontSize: 11, padding: '2px 10px', borderRadius: 3, border: 'none',
            cursor: launching ? 'not-allowed' : 'pointer',
            background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)',
            opacity: launching ? 0.6 : 1 }}>
          {launching ? '…' : running ? 'Stop' : 'Run'}
        </button>
      </div>
      {err && (
        <div style={{ padding: '2px 8px 4px', color: 'var(--vscode-charts-red,#f38ba8)', fontSize: 10,
          wordBreak: 'break-word' }} title={err}>⚠ {err}</div>
      )}
    </div>
  );
};

// ─── Root ──────────────────────────────────────────────────────────────────────
export const PlcNavigator: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
    background: 'var(--vscode-sideBar-background)',
    color: 'var(--vscode-list-foreground,var(--vscode-foreground))',
    fontFamily: 'var(--vscode-font-family,inherit)', fontSize: 13 }}>
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
      <TagSection />
      <LadderSection />
      <FBDSection />
      <SFCSection />
      <IecLibrarySection />
    </div>
    <MonitorFooter />
  </div>
);
