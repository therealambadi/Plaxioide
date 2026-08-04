/*
 * ElementsPanel.tsx — Left sidebar "ELEMENTS" tree for the Ladder Diagram editor.
 *
 * Mirrors the OpenPLC Editor elements panel layout:
 *   ▼ ELEMENTS  (20)
 *     ▼ Contacts   (4)
 *       -| |-  NO Contact
 *       -|/|-  NC Contact
 *       -|P|-  P↑ Contact
 *       -|N|-  N↓ Contact
 *     ▼ Coils     (6)
 *       ...
 *     ▼ Timers    (3)
 *     ▼ Counters  (3)
 *     ▼ Bistable  (2)
 *     ▼ Edge Detect (2)
 *   ▼ TAG DATABASE (n)  [+ button]
 *
 * Each leaf item is draggable via HTML5 drag setting
 * dataTransfer['application/plc-ladder-element'] = kind string.
 */

import React, { useState, useCallback } from 'react';
import { useLogicStoreSelector, logicStore } from '../logicStore.js';

// ── Colors ─────────────────────────────────────────────────────────────────
const C_BG = 'var(--vscode-sideBar-background, #252526)';
const C_FG = 'var(--vscode-sideBar-foreground, #cccccc)';
const C_MUTED = 'var(--vscode-descriptionForeground, #999)';
const C_BORDER = 'var(--vscode-sideBarSectionHeader-border, #3c3c3c)';
const C_HDR_BG = 'var(--vscode-sideBarSectionHeader-background, #2d2d2d)';
const C_HOVER = 'var(--vscode-list-hoverBackground, rgba(255,255,255,0.05))';
const C_SEL = 'var(--vscode-focusBorder, #0078d4)';
const C_BADGE = 'var(--vscode-badge-background, #4d4d4d)';
const C_BADGE_FG = 'var(--vscode-badge-foreground, #fff)';

// ── Tiny schematic glyphs for each element type ────────────────────────────

const GlyphNO = () =>
<svg width={28} height={14} viewBox="0 0 28 14" fill="none" style={{ flexShrink: 0 }}>
    <line x1={0} y1={7} x2={8} y2={7} stroke={C_FG} strokeWidth={1.5} />
    <line x1={8} y1={2} x2={8} y2={12} stroke={C_FG} strokeWidth={1.5} />
    <line x1={20} y1={2} x2={20} y2={12} stroke={C_FG} strokeWidth={1.5} />
    <line x1={20} y1={7} x2={28} y2={7} stroke={C_FG} strokeWidth={1.5} />
  </svg>;


const GlyphNC = () =>
<svg width={28} height={14} viewBox="0 0 28 14" fill="none" style={{ flexShrink: 0 }}>
    <line x1={0} y1={7} x2={8} y2={7} stroke={C_FG} strokeWidth={1.5} />
    <line x1={8} y1={2} x2={8} y2={12} stroke={C_FG} strokeWidth={1.5} />
    <line x1={20} y1={2} x2={20} y2={12} stroke={C_FG} strokeWidth={1.5} />
    <line x1={20} y1={7} x2={28} y2={7} stroke={C_FG} strokeWidth={1.5} />
    <line x1={9} y1={12} x2={19} y2={2} stroke="#0464fb" strokeWidth={1.2} />
  </svg>;


const GlyphPContact = () =>
<svg width={28} height={14} viewBox="0 0 28 14" fill="none" style={{ flexShrink: 0 }}>
    <line x1={0} y1={7} x2={8} y2={7} stroke={C_FG} strokeWidth={1.5} />
    <line x1={8} y1={2} x2={8} y2={12} stroke={C_FG} strokeWidth={1.5} />
    <line x1={20} y1={2} x2={20} y2={12} stroke={C_FG} strokeWidth={1.5} />
    <line x1={20} y1={7} x2={28} y2={7} stroke={C_FG} strokeWidth={1.5} />
    <text x={14} y={11} textAnchor="middle" fontSize={8} fill="#0464fb" fontFamily="monospace" fontWeight="bold">P</text>
  </svg>;


const GlyphNContact = () =>
<svg width={28} height={14} viewBox="0 0 28 14" fill="none" style={{ flexShrink: 0 }}>
    <line x1={0} y1={7} x2={8} y2={7} stroke={C_FG} strokeWidth={1.5} />
    <line x1={8} y1={2} x2={8} y2={12} stroke={C_FG} strokeWidth={1.5} />
    <line x1={20} y1={2} x2={20} y2={12} stroke={C_FG} strokeWidth={1.5} />
    <line x1={20} y1={7} x2={28} y2={7} stroke={C_FG} strokeWidth={1.5} />
    <text x={14} y={11} textAnchor="middle" fontSize={8} fill="#0464fb" fontFamily="monospace" fontWeight="bold">N</text>
  </svg>;


const COIL_L_SMALL = "M5 0C4.7 0.6 4.5 1.2 4.3 1.7C4.1 2.2 3.9 2.8 3.7 3.3C3.5 3.9 3.4 4.5 3.3 5C3.2 5.6 3.2 6.2 3.2 7C3.2 7.7 3.2 8.4 3.3 9C3.4 9.6 3.5 10.1 3.7 10.7C3.9 11.2 4.1 11.8 4.3 12.3C4.5 12.8 4.7 13.4 5 14H3.4C2.6 12.9 1.9 11.8 1.4 10.6C0.9 9.4 0.6 8.2 0.6 7C0.6 5.8 0.9 4.6 1.4 3.4C1.9 2.2 2.6 1.1 3.4 0H5Z";
const COIL_R_SMALL = "M9 0C9.3 0.6 9.5 1.2 9.7 1.7C9.9 2.2 10.1 2.8 10.3 3.3C10.5 3.9 10.6 4.5 10.7 5C10.8 5.6 10.8 6.2 10.8 7C10.8 7.7 10.8 8.4 10.7 9C10.6 9.6 10.5 10.1 10.3 10.7C10.1 11.2 9.9 11.8 9.7 12.3C9.5 12.8 9.3 13.4 9 14H10.6C11.4 12.9 12.1 11.8 12.6 10.6C13.1 9.4 13.4 8.2 13.4 7C13.4 5.8 13.1 4.6 12.6 3.4C12.1 2.2 11.4 1.1 10.6 0H9Z";

const GlyphCoil = ({ letter }: {letter?: string;}) =>
<svg width={28} height={14} viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
    <line x1={0} y1={7} x2={3} y2={7} stroke={C_FG} strokeWidth={1.2} />
    <path d={COIL_L_SMALL} fill={C_FG} />
    <path d={COIL_R_SMALL} fill={C_FG} />
    <line x1={11} y1={7} x2={14} y2={7} stroke={C_FG} strokeWidth={1.2} />
    {letter && <text x={7} y={10} textAnchor="middle" fontSize={6} fill="#0464fb" fontFamily="monospace" fontWeight="bold">{letter}</text>}
  </svg>;


const GlyphCoilSlash = () =>
<svg width={28} height={14} viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
    <line x1={0} y1={7} x2={3} y2={7} stroke={C_FG} strokeWidth={1.2} />
    <path d={COIL_L_SMALL} fill={C_FG} />
    <path d={COIL_R_SMALL} fill={C_FG} />
    <line x1={11} y1={7} x2={14} y2={7} stroke={C_FG} strokeWidth={1.2} />
    <line x1={4} y1={11} x2={10} y2={3} stroke="#0464fb" strokeWidth={1} />
  </svg>;


const GlyphBlock = ({ label, color }: {label: string;color: string;}) =>
<svg width={32} height={14} viewBox="0 0 32 14" fill="none" style={{ flexShrink: 0 }}>
    <rect x={1} y={1} width={30} height={12} rx={1} stroke={color} strokeWidth={1} fill="none" />
    <text x={16} y={10} textAnchor="middle" fontSize={7} fill={color} fontFamily="monospace" fontWeight="bold">{label}</text>
  </svg>;


// ── Element definitions ────────────────────────────────────────────────────

interface ElementDef {
  kind: string; // drag data value
  label: string;
  glyph: React.ReactNode;
}

const ELEMENT_SECTIONS: {title: string;items: ElementDef[];}[] = [
{
  title: 'Contacts',
  items: [
  { kind: 'contact-NO', label: 'NO Contact', glyph: <GlyphNO /> },
  { kind: 'contact-NC', label: 'NC Contact', glyph: <GlyphNC /> },
  { kind: 'contact-P', label: 'P↑ Contact', glyph: <GlyphPContact /> },
  { kind: 'contact-N', label: 'N↓ Contact', glyph: <GlyphNContact /> }]

},
{
  title: 'Coils',
  items: [
  { kind: 'coil-normal', label: 'Output Coil', glyph: <GlyphCoil /> },
  { kind: 'coil-negated', label: 'NOT Coil', glyph: <GlyphCoilSlash /> },
  { kind: 'coil-set', label: 'Set Coil', glyph: <GlyphCoil letter="S" /> },
  { kind: 'coil-reset', label: 'Reset Coil', glyph: <GlyphCoil letter="R" /> },
  { kind: 'coil-latch', label: 'Latch Coil', glyph: <GlyphCoil letter="L" /> },
  { kind: 'coil-unlatch', label: 'Unlatch Coil', glyph: <GlyphCoil letter="U" /> }]

},
{
  title: 'Timers',
  items: [
  { kind: 'block-TON', label: 'TON', glyph: <GlyphBlock label="TON" color="#a78bfa" /> },
  { kind: 'block-TOF', label: 'TOF', glyph: <GlyphBlock label="TOF" color="#a78bfa" /> },
  { kind: 'block-TP', label: 'TP', glyph: <GlyphBlock label="TP" color="#a78bfa" /> }]

},
{
  title: 'Counters',
  items: [
  { kind: 'block-CTU', label: 'CTU', glyph: <GlyphBlock label="CTU" color="#f472b6" /> },
  { kind: 'block-CTD', label: 'CTD', glyph: <GlyphBlock label="CTD" color="#f472b6" /> },
  { kind: 'block-CTUD', label: 'CTUD', glyph: <GlyphBlock label="CTUD" color="#f472b6" /> }]

},
{
  title: 'Bistable',
  items: [
  { kind: 'block-SR', label: 'SR', glyph: <GlyphBlock label="SR" color="#fbbf24" /> },
  { kind: 'block-RS', label: 'RS', glyph: <GlyphBlock label="RS" color="#fbbf24" /> }]

},
{
  title: 'Edge Detect',
  items: [
  { kind: 'block-RTRIG', label: 'RTRIG', glyph: <GlyphBlock label="R↑" color="#60a5fa" /> },
  { kind: 'block-FTRIG', label: 'FTRIG', glyph: <GlyphBlock label="F↓" color="#60a5fa" /> }]

}];


const TOTAL_ELEMENTS = ELEMENT_SECTIONS.reduce((n, s) => n + s.items.length, 0);

// ── DraggableItem ──────────────────────────────────────────────────────────

const DraggableItem: React.FC<ElementDef> = ({ kind, label, glyph }) => {
  const [hovered, setHovered] = useState(false);

  const onDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('application/plc-ladder-element', kind);
    e.dataTransfer.effectAllowed = 'copy';
  }, [kind]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '3px 8px 3px 28px',
        cursor: 'grab',
        background: hovered ? C_HOVER : 'transparent',
        userSelect: 'none',
        fontSize: 12,
        color: C_FG,
        borderRadius: 2,
        transition: 'background 0.1s'
      }}>

      {glyph}
      <span style={{ fontSize: 11, color: C_FG, whiteSpace: 'nowrap' }}>{label}</span>
    </div>);

};

// ── Section ────────────────────────────────────────────────────────────────

const Section: React.FC<{
  title: string;
  count: number;
  items: ElementDef[];
  defaultOpen?: boolean;
}> = ({ title, count, items, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          width: '100%', background: 'none', border: 'none',
          padding: '4px 8px 4px 12px', cursor: 'pointer',
          color: C_MUTED, fontSize: 11, fontWeight: 600,
          letterSpacing: 0.5, textTransform: 'uppercase',
          textAlign: 'left'
        }}>

        <span style={{ fontSize: 9, width: 8, flexShrink: 0 }}>{open ? '▼' : '▶'}</span>
        <span style={{ flex: 1 }}>{title}</span>
        <span style={{
          minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px',
          background: C_BADGE, color: C_BADGE_FG,
          fontSize: 9, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
        }}>{count}</span>
      </button>
      {open &&
      <div style={{ paddingBottom: 2 }}>
          {items.map((item) =>
        <DraggableItem key={item.kind} {...item} />
        )}
        </div>
      }
    </div>);

};

// ── TagDatabase section ────────────────────────────────────────────────────

const TagDatabaseSection: React.FC = () => {
  const [open, setOpen] = useState(true);
  const tags = useLogicStoreSelector((s) => s.tagDatabase);

  return (
    <div style={{ borderTop: `1px solid ${C_BORDER}`, marginTop: 4 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          width: '100%', background: 'none', border: 'none',
          padding: '5px 8px 5px 12px', cursor: 'pointer',
          color: C_MUTED, fontSize: 11, fontWeight: 700,
          letterSpacing: 0.5, textTransform: 'uppercase',
          textAlign: 'left'
        }}>

        <span style={{ fontSize: 9, width: 8, flexShrink: 0 }}>{open ? '▼' : '▶'}</span>
        <span style={{ flex: 1 }}>Tag Database</span>
        <span style={{
          minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px',
          background: C_BADGE, color: C_BADGE_FG,
          fontSize: 9, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
        }}>{tags.length}</span>
        <button
          title="Add tag"
          onClick={(e) => {e.stopPropagation(); /* TODO */}}
          style={{
            width: 16, height: 16, borderRadius: 3, border: 'none',
            background: 'var(--vscode-button-background, #0078d4)',
            color: 'var(--vscode-button-foreground, #fff)',
            cursor: 'pointer', fontSize: 12, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
          +</button>
      </button>
      {open &&
      <div style={{ paddingBottom: 4 }}>
          {tags.length === 0 ?
        <div style={{ padding: '4px 28px', fontSize: 11, color: C_MUTED, fontStyle: 'italic' }}>
              No tags defined
            </div> :

        tags.map((tag) =>
        <div key={tag.name} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '2px 8px 2px 28px', fontSize: 11, color: C_FG
        }}>
                <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: tag.dataType === 'BOOL' ? '#4ade80' :
            tag.dataType === 'INT' ? '#60a5fa' :
            '#94a3b8'
          }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tag.name}
                </span>
                <span style={{ fontSize: 9, color: C_MUTED, flexShrink: 0 }}>{tag.dataType}</span>
              </div>
        )
        }
        </div>
      }
    </div>);

};

// ── Main ElementsPanel ─────────────────────────────────────────────────────

export const ElementsPanel: React.FC = () => {
  const [panelOpen, setPanelOpen] = useState(true);
  const [topOpen, setTopOpen] = useState(true);

  if (!panelOpen) {
    return (
      <div style={{
        width: 18, flexShrink: 0,
        background: C_BG,
        borderRight: `1px solid ${C_BORDER}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 8
      }}>
        <button
          title="Expand elements panel"
          onClick={() => setPanelOpen(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C_MUTED, fontSize: 12, padding: 2
          }}>
          ›</button>
      </div>);

  }

  return (
    <div style={{
      width: 220,
      flexShrink: 0,
      background: C_BG,
      borderRight: `1px solid ${C_BORDER}`,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontSize: 12
    }}>
      {/* Panel header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '0 8px 0 12px',
        height: 30, flexShrink: 0,
        background: C_HDR_BG,
        borderBottom: `1px solid ${C_BORDER}`,
        cursor: 'pointer',
        userSelect: 'none'
      }} onClick={() => setTopOpen((o) => !o)}>
        <span style={{ fontSize: 9, width: 8, flexShrink: 0, color: C_MUTED }}>{topOpen ? '▼' : '▶'}</span>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: C_MUTED, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Elements
        </span>
        <span style={{
          minWidth: 18, height: 16, borderRadius: 8, padding: '0 4px',
          background: C_BADGE, color: C_BADGE_FG,
          fontSize: 9, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
        }}>{TOTAL_ELEMENTS}</span>
        <button
          title="Collapse panel"
          onClick={(e) => {e.stopPropagation();setPanelOpen(false);}}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C_MUTED, fontSize: 13, padding: '0 2px', lineHeight: 1
          }}>
          ‹</button>
      </div>

      {/* Scrollable content */}
      {topOpen &&
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {ELEMENT_SECTIONS.map((section) =>
        <Section
          key={section.title}
          title={section.title}
          count={section.items.length}
          items={section.items}
          defaultOpen={section.title === 'Contacts' || section.title === 'Coils'} />

        )}
          <TagDatabaseSection />
        </div>
      }
    </div>);

};