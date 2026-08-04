/*
 * LadderElementPalette — collapsible element palette rendered as a left panel
 * inside the Ladder canvas area. Must live inside the same DndContext as the
 * canvas so useDraggable works correctly.
 */

import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

export type PaletteItemKind =
'contact-NO' | 'contact-NC' | 'contact-P' | 'contact-N' |
'coil-normal' | 'coil-negated' | 'coil-set' | 'coil-reset' | 'coil-latch' | 'coil-unlatch' |
'block-TON' | 'block-TOF' | 'block-TP' |
'block-CTU' | 'block-CTD' | 'block-CTUD' |
'block-SR' | 'block-RS' |
'block-RTRIG' | 'block-FTRIG';

interface PaletteItem {
  kind: PaletteItemKind;
  label: string;
  symbol: string;
  color: string;
}

const GROUPS: {title: string;items: PaletteItem[];}[] = [
{
  title: 'Contacts',
  items: [
  { kind: 'contact-NO', label: 'NO', symbol: '─[ ]─', color: '#60a5fa' },
  { kind: 'contact-NC', label: 'NC', symbol: '─[/]─', color: '#60a5fa' },
  { kind: 'contact-P', label: 'P↑', symbol: '─[P]─', color: '#93c5fd' },
  { kind: 'contact-N', label: 'N↓', symbol: '─[N]─', color: '#93c5fd' }]

},
{
  title: 'Coils',
  items: [
  { kind: 'coil-normal', label: 'Coil', symbol: '─( )─', color: '#f472b6' },
  { kind: 'coil-negated', label: 'NOT', symbol: '─(/)─', color: '#f472b6' },
  { kind: 'coil-set', label: 'Set', symbol: '─(S)─', color: '#fb923c' },
  { kind: 'coil-reset', label: 'Reset', symbol: '─(R)─', color: '#fb923c' },
  { kind: 'coil-latch', label: 'Latch', symbol: '─(L)─', color: '#fb923c' },
  { kind: 'coil-unlatch', label: 'Unlch', symbol: '─(U)─', color: '#fb923c' }]

},
{
  title: 'Timers',
  items: [
  { kind: 'block-TON', label: 'TON', symbol: 'TON', color: '#a78bfa' },
  { kind: 'block-TOF', label: 'TOF', symbol: 'TOF', color: '#a78bfa' },
  { kind: 'block-TP', label: 'TP', symbol: 'TP', color: '#a78bfa' }]

},
{
  title: 'Counters',
  items: [
  { kind: 'block-CTU', label: 'CTU', symbol: 'CTU', color: '#34d399' },
  { kind: 'block-CTD', label: 'CTD', symbol: 'CTD', color: '#34d399' },
  { kind: 'block-CTUD', label: 'CTUD', symbol: 'CTUD', color: '#34d399' }]

},
{
  title: 'Bistable',
  items: [
  { kind: 'block-SR', label: 'SR', symbol: 'SR', color: '#fbbf24' },
  { kind: 'block-RS', label: 'RS', symbol: 'RS', color: '#fbbf24' }]

},
{
  title: 'Edge',
  items: [
  { kind: 'block-RTRIG', label: 'R↑', symbol: 'R↑', color: '#94a3b8' },
  { kind: 'block-FTRIG', label: 'F↓', symbol: 'F↓', color: '#94a3b8' }]

}];


// ── Draggable chip ────────────────────────────────────────────────────────────
const PaletteChip: React.FC<{item: PaletteItem;}> = ({ item }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${item.kind}`,
    data: { kind: item.kind }
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '4px 2px',
        borderRadius: 3,
        cursor: 'grab',
        border: '1px solid transparent',
        opacity: isDragging ? 0.4 : 1,
        transform: CSS.Translate.toString(transform),
        userSelect: 'none',
        minWidth: 38
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)';
        e.currentTarget.style.borderColor = 'var(--vscode-input-border, #3c3c3c)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = 'transparent';
      }}>

      <span style={{ fontFamily: 'monospace', fontSize: 10, color: item.color, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1 }}>
        {item.symbol}
      </span>
      <span style={{ fontSize: 9, color: 'var(--vscode-descriptionForeground)', lineHeight: 1 }}>
        {item.label}
      </span>
    </div>);

};

// ── Group header ──────────────────────────────────────────────────────────────
const GroupHeader: React.FC<{title: string;open: boolean;onToggle: () => void;}> = ({ title, open, onToggle }) =>
<div
  onClick={onToggle}
  style={{
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '3px 6px',
    cursor: 'pointer',
    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: 'var(--vscode-sideBarSectionHeader-foreground)',
    background: 'var(--vscode-sideBarSectionHeader-background)',
    borderBottom: '1px solid var(--vscode-editorGroup-border)',
    userSelect: 'none'
  }}>

    <span style={{
    fontFamily: 'codicon', fontSize: 9,
    transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
    transition: 'transform 0.1s', display: 'inline-block'
  }}>{''}</span>
    {title}
  </div>;


// ── Main palette panel ────────────────────────────────────────────────────────
export const LadderElementPalette: React.FC = () => {
  const [open, setOpen] = useState<Record<string, boolean>>({
    Contacts: true,
    Coils: true,
    Timers: false,
    Counters: false,
    Bistable: false,
    Edge: false
  });

  const toggle = (title: string) => setOpen((s) => ({ ...s, [title]: !s[title] }));

  return (
    <div style={{
      width: 104,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      overflowX: 'hidden',
      background: 'var(--vscode-sideBar-background)',
      borderRight: '1px solid var(--vscode-editorGroup-border)'
    }}>
      {/* Panel header */}
      <div style={{
        padding: '5px 8px',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'var(--vscode-sideBarSectionHeader-foreground)',
        background: 'var(--vscode-sideBarSectionHeader-background)',
        borderBottom: '1px solid var(--vscode-editorGroup-border)',
        flexShrink: 0
      }}>
        Elements
      </div>

      {GROUPS.map((group) =>
      <div key={group.title} style={{ flexShrink: 0 }}>
          <GroupHeader title={group.title} open={!!open[group.title]} onToggle={() => toggle(group.title)} />
          {open[group.title] &&
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 2,
          padding: '4px'
        }}>
              {group.items.map((item) => <PaletteChip key={item.kind} item={item} />)}
            </div>
        }
        </div>
      )}
    </div>);

};

export { GROUPS };