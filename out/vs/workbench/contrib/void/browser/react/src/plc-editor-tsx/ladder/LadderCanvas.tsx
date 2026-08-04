/*
 * LadderCanvas.tsx — Production-grade Ladder Diagram canvas.
 *
 * Layout: single-column — top element palette toolbar + scrollable rung list.
 * No separate side panel column; elements palette is integrated at the top.
 *
 * Features:
 *  - Compact top toolbar: collapsible element categories with draggable items
 *  - SortableContext for vertical rung reordering
 *  - Keyboard shortcuts: Del/Backspace, Ctrl+Z, Ctrl+Y/Shift+Z
 *  - Empty state with call-to-action
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  DndContext, DragEndEvent, useSensor, useSensors, PointerSensor, KeyboardSensor,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { logicStore, useLogicStoreSelector, Rung } from '../logicStore.js';
import { undoRedoStore } from '../undoRedoStore.js';
import {
  insertRung, deleteRung, insertContact, insertCoil, insertBlock, moveRung,
} from './ladderCommands.js';
import { LadderRung, RUNG_HEADER_H } from './LadderRung.js';

// ── Colors ────────────────────────────────────────────────────────────────────
const C_BG     = 'var(--vscode-editor-background, #1e1e1e)';
const C_PANEL  = 'var(--vscode-sideBar-background, #252526)';
const C_BORDER = 'var(--vscode-editorGroup-border, #2e2e2e)';
const C_FG     = 'var(--vscode-editor-foreground, #cccccc)';
const C_MUTED  = 'var(--vscode-descriptionForeground, #999)';
const C_SEL    = 'var(--vscode-focusBorder, #0078d4)';
const C_HDR    = 'var(--vscode-sideBarSectionHeader-background, #2d2d2d)';

// ── PaletteItemKind ───────────────────────────────────────────────────────────

export type PaletteItemKind =
  | 'contact-NO' | 'contact-NC' | 'contact-P' | 'contact-N'
  | 'coil-normal' | 'coil-negated' | 'coil-set' | 'coil-reset' | 'coil-latch' | 'coil-unlatch'
  | 'block-TON' | 'block-TOF' | 'block-TP'
  | 'block-CTU' | 'block-CTD' | 'block-CTUD'
  | 'block-SR'  | 'block-RS'
  | 'block-RTRIG' | 'block-FTRIG'
  | 'block-EQ' | 'block-NE' | 'block-GT' | 'block-GE' | 'block-LT' | 'block-LE'
  | 'block-ADD' | 'block-SUB' | 'block-MUL' | 'block-DIV' | 'block-MOD' | 'block-ABS' | 'block-SQRT'
  | 'block-MOVE' | 'block-SEL' | 'block-LIMIT' | 'block-MIN' | 'block-MAX';

const EMPTY_TAG = { name: '', dataType: 'BOOL' as const };

export function applyElementDrop(kind: PaletteItemKind, rungId: string, atIndex?: number) {
  switch (kind) {
    case 'contact-NO':    return insertContact(rungId, EMPTY_TAG, 'NO',        atIndex);
    case 'contact-NC':    return insertContact(rungId, EMPTY_TAG, 'NC',        atIndex);
    case 'contact-P':     return insertContact(rungId, EMPTY_TAG, 'P_CONTACT', atIndex);
    case 'contact-N':     return insertContact(rungId, EMPTY_TAG, 'N_CONTACT', atIndex);
    case 'coil-normal':   return insertCoil   (rungId, EMPTY_TAG, 'normal',    atIndex);
    case 'coil-negated':  return insertCoil   (rungId, EMPTY_TAG, 'negated',   atIndex);
    case 'coil-set':      return insertCoil   (rungId, EMPTY_TAG, 'set',       atIndex);
    case 'coil-reset':    return insertCoil   (rungId, EMPTY_TAG, 'reset',     atIndex);
    case 'coil-latch':    return insertCoil   (rungId, EMPTY_TAG, 'latch',     atIndex);
    case 'coil-unlatch':  return insertCoil   (rungId, EMPTY_TAG, 'unlatch',   atIndex);
    case 'block-TON':     return insertBlock  (rungId, 'TON',   'ton1',        atIndex);
    case 'block-TOF':     return insertBlock  (rungId, 'TOF',   'tof1',        atIndex);
    case 'block-TP':      return insertBlock  (rungId, 'TP',    'tp1',         atIndex);
    case 'block-CTU':     return insertBlock  (rungId, 'CTU',   'ctu1',        atIndex);
    case 'block-CTD':     return insertBlock  (rungId, 'CTD',   'ctd1',        atIndex);
    case 'block-CTUD':    return insertBlock  (rungId, 'CTUD',  'ctud1',       atIndex);
    case 'block-SR':      return insertBlock  (rungId, 'SR',    'sr1',         atIndex);
    case 'block-RS':      return insertBlock  (rungId, 'RS',    'rs1',         atIndex);
    case 'block-RTRIG':   return insertBlock  (rungId, 'RTRIG', 'rtrig1',      atIndex);
    case 'block-FTRIG':   return insertBlock  (rungId, 'FTRIG', 'ftrig1',      atIndex);
    case 'block-EQ':    return insertBlock(rungId, 'EQ',    'eq1',    atIndex);
    case 'block-NE':    return insertBlock(rungId, 'NE',    'ne1',    atIndex);
    case 'block-GT':    return insertBlock(rungId, 'GT',    'gt1',    atIndex);
    case 'block-GE':    return insertBlock(rungId, 'GE',    'ge1',    atIndex);
    case 'block-LT':    return insertBlock(rungId, 'LT',    'lt1',    atIndex);
    case 'block-LE':    return insertBlock(rungId, 'LE',    'le1',    atIndex);
    case 'block-ADD':   return insertBlock(rungId, 'ADD',   'add1',   atIndex);
    case 'block-SUB':   return insertBlock(rungId, 'SUB',   'sub1',   atIndex);
    case 'block-MUL':   return insertBlock(rungId, 'MUL',   'mul1',   atIndex);
    case 'block-DIV':   return insertBlock(rungId, 'DIV',   'div1',   atIndex);
    case 'block-MOD':   return insertBlock(rungId, 'MOD',   'mod1',   atIndex);
    case 'block-ABS':   return insertBlock(rungId, 'ABS',   'abs1',   atIndex);
    case 'block-SQRT':  return insertBlock(rungId, 'SQRT',  'sqrt1',  atIndex);
    case 'block-MOVE':  return insertBlock(rungId, 'MOVE',  'move1',  atIndex);
    case 'block-SEL':   return insertBlock(rungId, 'SEL',   'sel1',   atIndex);
    case 'block-LIMIT': return insertBlock(rungId, 'LIMIT', 'limit1', atIndex);
    case 'block-MIN':   return insertBlock(rungId, 'MIN',   'min1',   atIndex);
    case 'block-MAX':   return insertBlock(rungId, 'MAX',   'max1',   atIndex);
  }
}

// ── Palette Toolbar (horizontal, lives at the top of the canvas area) ─────────

interface PaletteItem {
  kind: PaletteItemKind;
  label: string;
  shortLabel: string;
  glyph: React.ReactNode;
}

const ContactGlyphSVG: React.FC<{ variant?: string }> = ({ variant }) => (
  <svg width={20} height={16} viewBox="0 0 28 28" fill="none">
    <line x1="0.75" x2="0.75" y1="1" y2="27" stroke={C_FG} strokeWidth="2" />
    <line x1="26.75" x2="26.75" y1="1" y2="27" stroke={C_FG} strokeWidth="2" />
    {variant === 'NC' && <line x1="5" y1="23" x2="24" y2="5" stroke="#0464FB" strokeWidth="2" />}
    {variant === 'P'  && <text x="14" y="19" textAnchor="middle" fontSize="12" fill="#0464FB" fontFamily="monospace">P</text>}
    {variant === 'N'  && <text x="14" y="19" textAnchor="middle" fontSize="12" fill="#0464FB" fontFamily="monospace">N</text>}
  </svg>
);

const CoilGlyphSVG: React.FC<{ letter?: string; slash?: boolean }> = ({ letter, slash }) => (
  <svg width={22} height={16} viewBox="0 0 34 28" fill="none">
    <path d="M7 0C6.4 1.2 5.9 2.35 5.5 3.4C5 4.5 4.7 5.6 4.4 6.6C4.1 7.8 3.8 8.9 3.7 10.1C3.5 11.3 3.5 12.6 3.5 14C3.5 15.5 3.5 16.8 3.7 18C3.8 19.2 4.1 20.3 4.4 21.4C4.7 22.5 5 23.6 5.5 24.6C5.9 25.7 6.4 26.8 7 28H4.5C3.1 25.8 2 23.5 1.2 21.2C0.4 18.8 0 16.4 0 14C0 11.6 0.4 9.3 1.2 6.9C2 4.5 3.1 2.2 4.5 0H7Z" fill={C_FG} />
    <path d="M27 0C27.6 1.2 28.1 2.35 28.5 3.4C29 4.5 29.3 5.6 29.6 6.6C29.9 7.8 30.2 8.9 30.3 10.1C30.5 11.3 30.5 12.6 30.5 14C30.5 15.5 30.5 16.8 30.3 18C30.2 19.2 29.9 20.3 29.6 21.4C29.3 22.5 29 23.6 28.5 24.6C28.1 25.7 27.6 26.8 27 28H29.5C30.9 25.8 32 23.5 32.8 21.2C33.6 18.8 34 16.4 34 14C34 11.6 33.6 9.3 32.8 6.9C32 4.5 30.9 2.2 29.5 0H27Z" fill={C_FG} />
    {slash  && <line x1="8" y1="22" x2="26" y2="6" stroke="#0464FB" strokeWidth="2" />}
    {letter && <text x="17" y="18" textAnchor="middle" fontSize="11" fill="#0464FB" fontFamily="monospace" fontWeight="bold">{letter}</text>}
  </svg>
);

const BlockGlyphSVG: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <svg width={28} height={16} viewBox="0 0 40 28" fill="none">
    <rect x={1} y={1} width={38} height={26} rx={3} fill="transparent" stroke={color} strokeWidth={2} />
    <text x="20" y="17" textAnchor="middle" fontSize="10" fill={color} fontFamily="monospace" fontWeight="bold">{label}</text>
  </svg>
);

interface PaletteGroupDef {
  title: string;
  color?: string;
  items: PaletteItem[];
}

const PALETTE_GROUPS: PaletteGroupDef[] = [
  {
    title: 'Contacts',
    items: [
      { kind: 'contact-NO', label: 'Normally Open',  shortLabel: '—| |—',  glyph: <ContactGlyphSVG /> },
      { kind: 'contact-NC', label: 'Normally Closed', shortLabel: '—|/|—', glyph: <ContactGlyphSVG variant="NC" /> },
      { kind: 'contact-P',  label: 'Pos Edge',        shortLabel: '—|P|—', glyph: <ContactGlyphSVG variant="P" /> },
      { kind: 'contact-N',  label: 'Neg Edge',        shortLabel: '—|N|—', glyph: <ContactGlyphSVG variant="N" /> },
    ],
  },
  {
    title: 'Coils',
    items: [
      { kind: 'coil-normal',  label: 'Output',  shortLabel: '—( )—',  glyph: <CoilGlyphSVG /> },
      { kind: 'coil-negated', label: 'NOT',     shortLabel: '—(/)—',  glyph: <CoilGlyphSVG slash /> },
      { kind: 'coil-set',     label: 'Set',     shortLabel: '—(S)—',  glyph: <CoilGlyphSVG letter="S" /> },
      { kind: 'coil-reset',   label: 'Reset',   shortLabel: '—(R)—',  glyph: <CoilGlyphSVG letter="R" /> },
      { kind: 'coil-latch',   label: 'Latch',   shortLabel: '—(L)—',  glyph: <CoilGlyphSVG letter="L" /> },
      { kind: 'coil-unlatch', label: 'Unlatch', shortLabel: '—(U)—',  glyph: <CoilGlyphSVG letter="U" /> },
    ],
  },
  {
    title: 'Timers',
    color: '#a78bfa',
    items: [
      { kind: 'block-TON', label: 'On-Delay',  shortLabel: 'TON', glyph: <BlockGlyphSVG label="TON" color="#a78bfa" /> },
      { kind: 'block-TOF', label: 'Off-Delay', shortLabel: 'TOF', glyph: <BlockGlyphSVG label="TOF" color="#a78bfa" /> },
      { kind: 'block-TP',  label: 'Pulse',     shortLabel: 'TP',  glyph: <BlockGlyphSVG label="TP"  color="#a78bfa" /> },
    ],
  },
  {
    title: 'Counters',
    color: '#f472b6',
    items: [
      { kind: 'block-CTU',  label: 'Count Up',   shortLabel: 'CTU',  glyph: <BlockGlyphSVG label="CTU"  color="#f472b6" /> },
      { kind: 'block-CTD',  label: 'Count Down', shortLabel: 'CTD',  glyph: <BlockGlyphSVG label="CTD"  color="#f472b6" /> },
      { kind: 'block-CTUD', label: 'Up/Down',    shortLabel: 'CTUD', glyph: <BlockGlyphSVG label="CTUD" color="#f472b6" /> },
    ],
  },
  {
    title: 'Bistable',
    color: '#fbbf24',
    items: [
      { kind: 'block-SR', label: 'Set-Reset', shortLabel: 'SR', glyph: <BlockGlyphSVG label="SR" color="#fbbf24" /> },
      { kind: 'block-RS', label: 'Reset-Set', shortLabel: 'RS', glyph: <BlockGlyphSVG label="RS" color="#fbbf24" /> },
    ],
  },
  {
    title: 'Edge',
    color: '#60a5fa',
    items: [
      { kind: 'block-RTRIG', label: 'Rising',  shortLabel: 'R↑', glyph: <BlockGlyphSVG label="R↑" color="#60a5fa" /> },
      { kind: 'block-FTRIG', label: 'Falling', shortLabel: 'F↓', glyph: <BlockGlyphSVG label="F↓" color="#60a5fa" /> },
    ],
  },
  {
    title: 'Compare',
    color: '#fb923c',
    items: [
      { kind: 'block-EQ' as const,   label: '=',   shortLabel: 'EQ',   glyph: <BlockGlyphSVG label="EQ" color="#fb923c" /> },
      { kind: 'block-NE' as const,   label: '<>',  shortLabel: 'NE',   glyph: <BlockGlyphSVG label="NE" color="#fb923c" /> },
      { kind: 'block-GT' as const,   label: '>',   shortLabel: 'GT',   glyph: <BlockGlyphSVG label="GT" color="#fb923c" /> },
      { kind: 'block-GE' as const,   label: '>=',  shortLabel: 'GE',   glyph: <BlockGlyphSVG label="GE" color="#fb923c" /> },
      { kind: 'block-LT' as const,   label: '<',   shortLabel: 'LT',   glyph: <BlockGlyphSVG label="LT" color="#fb923c" /> },
      { kind: 'block-LE' as const,   label: '<=',  shortLabel: 'LE',   glyph: <BlockGlyphSVG label="LE" color="#fb923c" /> },
    ],
  },
  {
    title: 'Math',
    color: '#34d399',
    items: [
      { kind: 'block-ADD' as const,   label: 'ADD',   shortLabel: 'ADD',   glyph: <BlockGlyphSVG label="ADD" color="#34d399" /> },
      { kind: 'block-SUB' as const,   label: 'SUB',   shortLabel: 'SUB',   glyph: <BlockGlyphSVG label="SUB" color="#34d399" /> },
      { kind: 'block-MUL' as const,   label: 'MUL',   shortLabel: 'MUL',   glyph: <BlockGlyphSVG label="MUL" color="#34d399" /> },
      { kind: 'block-DIV' as const,   label: 'DIV',   shortLabel: 'DIV',   glyph: <BlockGlyphSVG label="DIV" color="#34d399" /> },
      { kind: 'block-MOD' as const,   label: 'MOD',   shortLabel: 'MOD',   glyph: <BlockGlyphSVG label="MOD" color="#34d399" /> },
      { kind: 'block-ABS' as const,   label: 'ABS',   shortLabel: 'ABS',   glyph: <BlockGlyphSVG label="ABS" color="#34d399" /> },
      { kind: 'block-SQRT' as const,  label: 'SQRT',  shortLabel: '√',     glyph: <BlockGlyphSVG label="√" color="#34d399" /> },
      { kind: 'block-MOVE' as const,  label: 'MOVE',  shortLabel: 'MOV',   glyph: <BlockGlyphSVG label="MOV" color="#94a3b8" /> },
      { kind: 'block-SEL' as const,   label: 'SEL',   shortLabel: 'SEL',   glyph: <BlockGlyphSVG label="SEL" color="#94a3b8" /> },
      { kind: 'block-LIMIT' as const, label: 'LIMIT', shortLabel: 'LIM',   glyph: <BlockGlyphSVG label="LIM" color="#94a3b8" /> },
      { kind: 'block-MIN' as const,   label: 'MIN',   shortLabel: 'MIN',   glyph: <BlockGlyphSVG label="MIN" color="#94a3b8" /> },
      { kind: 'block-MAX' as const,   label: 'MAX',   shortLabel: 'MAX',   glyph: <BlockGlyphSVG label="MAX" color="#94a3b8" /> },
    ],
  },
];

const PaletteToolbar: React.FC = () => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{
      flexShrink: 0,
      background: C_PANEL,
      borderBottom: `1px solid ${C_BORDER}`,
    }}>
      {/* Toolbar header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px',
        background: C_HDR,
        borderBottom: expanded ? `1px solid ${C_BORDER}` : 'none',
        userSelect: 'none',
      }}>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C_MUTED, fontSize: 10, padding: '0 2px', lineHeight: 1,
          }}
          title={expanded ? 'Collapse palette' : 'Expand palette'}
        >{expanded ? '▼' : '▶'}</button>
        <span style={{ fontSize: 10, fontWeight: 700, color: C_MUTED, letterSpacing: '.07em', textTransform: 'uppercase' }}>
          Elements
        </span>
        <span style={{
          fontSize: 9, padding: '1px 5px', borderRadius: 8,
          background: 'var(--vscode-badge-background, #4d4d4d)',
          color: 'var(--vscode-badge-foreground, #fff)',
        }}>
          {PALETTE_GROUPS.reduce((n, g) => n + g.items.length, 0)}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: C_MUTED, fontStyle: 'italic' }}>drag to rung</span>
      </div>

      {/* Groups row */}
      {expanded && (
        <div style={{
          display: 'flex', flexDirection: 'row', flexWrap: 'wrap',
          gap: 0, overflowX: 'auto',
        }}>
          {PALETTE_GROUPS.map((group, gi) => (
            <PaletteGroup key={group.title} group={group} isLast={gi === PALETTE_GROUPS.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
};

const PaletteGroup: React.FC<{ group: PaletteGroupDef; isLast: boolean }> = ({ group, isLast }) => {
  const [hov, setHov] = useState<string | null>(null);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      borderRight: isLast ? 'none' : `1px solid ${C_BORDER}`,
      minWidth: 0,
    }}>
      {/* Group label */}
      <div style={{
        padding: '2px 8px',
        fontSize: 9, fontWeight: 700, color: group.color ?? C_MUTED,
        textTransform: 'uppercase', letterSpacing: '.06em',
        background: C_HDR,
        borderBottom: `1px solid ${C_BORDER}`,
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}>{group.title}</div>
      {/* Items row */}
      <div style={{ display: 'flex', flexDirection: 'row', padding: '3px 4px', gap: 2 }}>
        {group.items.map(item => (
          <PaletteButton
            key={item.kind}
            item={item}
            hovered={hov === item.kind}
            onHover={setHov}
          />
        ))}
      </div>
    </div>
  );
};

const PaletteButton: React.FC<{
  item: PaletteItem;
  hovered: boolean;
  onHover: (k: string | null) => void;
}> = ({ item, hovered, onHover }) => (
  <div
    draggable
    title={item.label}
    onPointerDown={e => e.stopPropagation()}
    onDragStart={e => {
      e.dataTransfer.setData('application/plc-ladder-element', item.kind);
      e.dataTransfer.effectAllowed = 'copy';
    }}
    onMouseEnter={() => onHover(item.kind)}
    onMouseLeave={() => onHover(null)}
    style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 2,
      padding: '3px 5px',
      cursor: 'grab',
      borderRadius: 3,
      background: hovered ? 'var(--vscode-list-hoverBackground, rgba(255,255,255,0.07))' : 'transparent',
      border: hovered ? `1px solid ${C_BORDER}` : '1px solid transparent',
      userSelect: 'none',
      transition: 'background 0.1s, border-color 0.1s',
      minWidth: 32,
    }}
  >
    {item.glyph}
    <span style={{ fontSize: 8, color: C_MUTED, whiteSpace: 'nowrap' }}>{item.shortLabel}</span>
  </div>
);

// ── SortableRung wrapper ──────────────────────────────────────────────────────

interface SortableRungProps {
  rung: Rung;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDoubleClick: (id: string) => void;
  onDelete: () => void;
  onInsertAfter: () => void;
}

const SortableRung: React.FC<SortableRungProps> = ({
  rung, selectedId, onSelect, onDoubleClick, onDelete, onInsertAfter,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `rung-sort-${rung.id}` });

  // Pass dnd-kit listeners to the drag handle icon inside LadderRung header
  const dragHandleProps = { ...attributes, ...listeners };

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        borderRadius: 8,
        border: `1px solid ${C_BORDER}`,
        overflow: 'hidden',
        minWidth: 0,
        background: C_BG,
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      <LadderRung
        rung={rung}
        selectedId={selectedId}
        onSelect={onSelect}
        onDoubleClick={onDoubleClick}
        onAddRungAfter={onInsertAfter}
        onDeleteRung={onDelete}
        dragHandleProps={dragHandleProps}
      />
    </div>
  );
};

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptyCanvas: React.FC = () => (
  <div style={{
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16,
    color: 'var(--vscode-descriptionForeground)',
  }}>
    <svg width={64} height={64} viewBox="0 0 64 64" fill="none">
      <rect x={8}  y={8} width={5} height={48} rx={2.5} fill="var(--vscode-focusBorder)" opacity={0.7} />
      <rect x={51} y={8} width={5} height={48} rx={2.5} fill="var(--vscode-editorGroup-border)" opacity={0.7} />
      <line x1={13} y1={32} x2={51} y2={32} stroke="var(--vscode-editorGroup-border)" strokeWidth={2.5} strokeDasharray="5 5" opacity={0.6} />
    </svg>
    <div style={{ textAlign: 'center', maxWidth: 280, fontSize: 13, lineHeight: 1.5 }}>
      No rungs in this ladder diagram.<br />
      Drag elements from the panel or add your first rung below.
    </div>
    <button
      onClick={() => insertRung(0)}
      style={{
        padding: '8px 24px', borderRadius: 5, border: 'none',
        cursor: 'pointer', fontSize: 13, fontWeight: 600,
        background: 'var(--vscode-button-background)',
        color: 'var(--vscode-button-foreground)',
      }}
    >+ Add First Rung</button>
  </div>
);

// ── LadderCanvas ──────────────────────────────────────────────────────────────

export const LadderCanvas: React.FC = () => {
  const ladderProgram = useLogicStoreSelector(s => s.ladderProgram);
  const zoom          = useLogicStoreSelector(s => s.zoom);

  const [selectedId,     setSelectedId]     = useState<string | null>(null);
  const [selectedRungId, setSelectedRungId] = useState<string | null>(null);
  const [copiedRungId,   setCopiedRungId]   = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && selectedRungId) {
        undoRedoStore.push();
        logicStore.deleteElement(selectedRungId, selectedId);
        setSelectedId(null);
        setSelectedRungId(null);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoRedoStore.undo();
        return;
      }
      if (
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') ||
        ((e.ctrlKey) && e.key === 'y')
      ) {
        e.preventDefault();
        undoRedoStore.redo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !e.shiftKey) {
        if (selectedRungId) {
          e.preventDefault();
          logicStore.copyRungs([selectedRungId]);
          setCopiedRungId(selectedRungId);
          setTimeout(() => setCopiedRungId(null), 800);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && !e.shiftKey) {
        e.preventDefault();
        undoRedoStore.push();
        const rungs = logicStore.getState().ladderProgram.rungs;
        const afterIndex = selectedRungId
          ? rungs.findIndex(r => r.id === selectedRungId)
          : rungs.length - 1;
        logicStore.pasteRungs(afterIndex >= 0 ? afterIndex : undefined);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, selectedRungId]);

  const handleSelect = useCallback((rungId: string, elId: string | null) => {
    setSelectedId(elId);
    setSelectedRungId(elId ? rungId : null);
  }, []);

  // ── DragEnd: rung reorder OR palette-element insertion ───────────────────
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const aId = String(active.id);
    const oId = String(over.id);

    if (aId.startsWith('rung-sort-') && oId.startsWith('rung-sort-') && aId !== oId) {
      const fromId = aId.slice('rung-sort-'.length);
      const toId   = oId.slice('rung-sort-'.length);
      const ids = ladderProgram.rungs.map(r => r.id);
      const fi = ids.indexOf(fromId);
      const ti = ids.indexOf(toId);
      if (fi !== -1 && ti !== -1) moveRung(fi, ti);
      return;
    }

    const activeData = active.data?.current as { source?: string; elementType?: string } | undefined;
    const overData   = over.data?.current   as { rungId?: string; index?: number } | undefined;

    if (activeData?.source === 'palette' && overData?.rungId !== undefined) {
      const { rungId, index } = overData;
      const kind = activeData.elementType ?? '';
      applyElementDrop(kind as PaletteItemKind, rungId!, index);
    }
  }, [ladderProgram.rungs]);

  const sortableItems = useMemo(
    () => ladderProgram.rungs.map(r => `rung-sort-${r.id}`),
    [ladderProgram.rungs],
  );

  // ── HTML5 drop onto canvas (from ElementsPanel) ──────────────────────────
  const handleCanvasDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const kind = e.dataTransfer.getData('application/plc-ladder-element');
    if (!kind) return;
    undoRedoStore.push();
    if (ladderProgram.rungs.length === 0) {
      insertRung(0);
      setTimeout(() => {
        const rungs = logicStore.getState().ladderProgram.rungs;
        if (rungs.length > 0) applyElementDrop(kind as PaletteItemKind, rungs[0].id, undefined);
      }, 0);
    } else {
      applyElementDrop(kind as PaletteItemKind, ladderProgram.rungs[0].id, undefined);
    }
  }, [ladderProgram.rungs]);

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/plc-ladder-element')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>

        {/* Rung list */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto', overflowX: 'hidden',
            background: C_BG,
            minHeight: 0, minWidth: 0,
          }}
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
        >
          {ladderProgram.rungs.length === 0 ? (
            <EmptyCanvas />
          ) : (
            <div
              style={{
                transformOrigin: 'top left',
                transform: `scale(${zoom})`,
                width: zoom !== 1 ? `${100 / zoom}%` : '100%',
                boxSizing: 'border-box',
                padding: '12px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
                {ladderProgram.rungs.map(rung => (
                  <SortableRung
                    key={rung.id}
                    rung={rung}
                    selectedId={selectedRungId === rung.id ? selectedId : null}
                    onSelect={elId => handleSelect(rung.id, elId)}
                    onDoubleClick={id => handleSelect(rung.id, id)}
                    onDelete={() => deleteRung(rung.id)}
                    onInsertAfter={() => insertRung(rung.number)}
                  />
                ))}
              </SortableContext>

              {/* Create new rung */}
              <div
                onClick={() => insertRung(ladderProgram.rungs.length)}
                style={{
                  padding: '8px 16px', cursor: 'pointer', textAlign: 'center',
                  color: 'var(--vscode-descriptionForeground)', fontSize: 12,
                  borderRadius: 8,
                  border: `1px solid ${C_BORDER}`,
                  userSelect: 'none',
                  opacity: 0.5,
                  transition: 'opacity 0.12s, background 0.12s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.opacity = '0.5';
                  e.currentTarget.style.background = 'transparent';
                }}
              >+ Create new rung</div>
            </div>
          )}
        </div>
      </div>
    </DndContext>
  );
};
