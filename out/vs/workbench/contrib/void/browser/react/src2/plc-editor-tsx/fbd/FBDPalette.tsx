/*
 * FBDPalette — draggable block palette for the FBD editor.
 * Blocks are HTML5-dragged into the ReactFlow canvas.
 */

import React, { useState } from 'react';
import { FBDBlockType } from '../logicStore.js';

interface FBDPaletteItem {
  type: FBDBlockType;
  label: string;
  description: string;
  color: string;
}

const FBD_PALETTE_GROUPS: {title: string;items: FBDPaletteItem[];}[] = [
{
  title: 'Variables',
  items: [
  { type: 'IN_VARIABLE', label: 'Input Var', description: 'Read a variable value', color: '#4ade80' },
  { type: 'OUT_VARIABLE', label: 'Output Var', description: 'Write to a variable', color: '#4ade80' },
  { type: 'INOUT_VARIABLE', label: 'InOut Var', description: 'Bidirectional variable', color: '#4ade80' }]

},
{
  title: 'Logic',
  items: [
  { type: 'AND', label: 'AND', description: 'Logical AND', color: '#60a5fa' },
  { type: 'OR', label: 'OR', description: 'Logical OR', color: '#60a5fa' },
  { type: 'NOT', label: 'NOT', description: 'Logical NOT', color: '#60a5fa' },
  { type: 'XOR', label: 'XOR', description: 'Logical XOR', color: '#60a5fa' },
  { type: 'NAND', label: 'NAND', description: 'Logical NAND', color: '#60a5fa' },
  { type: 'NOR', label: 'NOR', description: 'Logical NOR', color: '#60a5fa' }]

},
{
  title: 'Arithmetic',
  items: [
  { type: 'ADD', label: 'ADD', description: 'Add', color: '#34d399' },
  { type: 'SUB', label: 'SUB', description: 'Subtract', color: '#34d399' },
  { type: 'MUL', label: 'MUL', description: 'Multiply', color: '#34d399' },
  { type: 'DIV', label: 'DIV', description: 'Divide', color: '#34d399' },
  { type: 'MOD', label: 'MOD', description: 'Modulo', color: '#34d399' },
  { type: 'ABS', label: 'ABS', description: 'Absolute', color: '#34d399' },
  { type: 'SQRT', label: 'SQRT', description: 'Square Root', color: '#34d399' }]

},
{
  title: 'Compare',
  items: [
  { type: 'GT', label: '>', description: 'Greater Than', color: '#fb923c' },
  { type: 'LT', label: '<', description: 'Less Than', color: '#fb923c' },
  { type: 'GE', label: '>=', description: 'Greater or Equal', color: '#fb923c' },
  { type: 'LE', label: '<=', description: 'Less or Equal', color: '#fb923c' },
  { type: 'EQ', label: '=', description: 'Equal', color: '#fb923c' },
  { type: 'NE', label: '<>', description: 'Not Equal', color: '#fb923c' }]

},
{
  title: 'Timers',
  items: [
  { type: 'TON', label: 'TON', description: 'Timer On-Delay', color: '#a78bfa' },
  { type: 'TOF', label: 'TOF', description: 'Timer Off-Delay', color: '#a78bfa' },
  { type: 'TP', label: 'TP', description: 'Timer Pulse', color: '#a78bfa' }]

},
{
  title: 'Counters',
  items: [
  { type: 'CTU', label: 'CTU', description: 'Count Up', color: '#f472b6' },
  { type: 'CTD', label: 'CTD', description: 'Count Down', color: '#f472b6' }]

},
{
  title: 'Bistable',
  items: [
  { type: 'SR', label: 'SR', description: 'SR Bistable', color: '#fbbf24' },
  { type: 'RS', label: 'RS', description: 'RS Bistable', color: '#fbbf24' }]

},
{
  title: 'Selection',
  items: [
  { type: 'SEL', label: 'SEL', description: 'Binary Select', color: '#94a3b8' },
  { type: 'MUX', label: 'MUX', description: 'Multiplexer', color: '#94a3b8' },
  { type: 'LIMIT', label: 'LIMIT', description: 'Clamp value', color: '#94a3b8' },
  { type: 'MIN', label: 'MIN', description: 'Minimum', color: '#94a3b8' },
  { type: 'MAX', label: 'MAX', description: 'Maximum', color: '#94a3b8' },
  { type: 'MOVE', label: 'MOVE', description: 'Move/Copy', color: '#94a3b8' }]

}];


const PaletteBlock: React.FC<{item: FBDPaletteItem;}> = ({ item }) => {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/plc-element', `block-${item.type}`);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      title={item.description}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '5px 4px',
        borderRadius: 4,
        cursor: 'grab',
        border: '1px solid transparent',
        transition: 'background 0.1s, border-color 0.1s',
        userSelect: 'none'
      }}
      onMouseEnter={(e) => {e.currentTarget.style.background = 'var(--vscode-sideBar-background)';e.currentTarget.style.borderColor = 'var(--vscode-input-border, #3c3c3c)';}}
      onMouseLeave={(e) => {e.currentTarget.style.background = 'transparent';e.currentTarget.style.borderColor = 'transparent';}}>

      <div style={{
        width: 36, height: 24,
        background: item.color + '18',
        border: `1px solid ${item.color}66`,
        borderRadius: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, color: item.color,
        fontWeight: 700, fontFamily: 'monospace'
      }}>
        {item.label}
      </div>
    </div>);

};

export const FBDPalette: React.FC = () => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <div style={{
      width: 90, flexShrink: 0, background: 'var(--vscode-sideBar-background)',
      borderRight: '1px solid var(--vscode-editorGroup-border)',
      display: 'flex', flexDirection: 'column', overflowY: 'auto'
    }}>
      <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--vscode-editorGroup-border)', color: 'var(--vscode-descriptionForeground)', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
        BLOCKS
      </div>

      {FBD_PALETTE_GROUPS.map((group) =>
      <div key={group.title}>
          <button
          onClick={() => setCollapsed((c) => ({ ...c, [group.title]: !c[group.title] }))}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            width: '100%', background: 'none', border: 'none',
            padding: '4px 8px', cursor: 'pointer',
            color: 'var(--vscode-descriptionForeground)', fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
            textTransform: 'uppercase', textAlign: 'left'
          }}>

            <span style={{ fontSize: 8 }}>{collapsed[group.title] ? '▶' : '▼'}</span>
            {group.title}
          </button>
          {!collapsed[group.title] &&
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '0 4px 4px' }}>
              {group.items.map((item) =>
          <PaletteBlock key={item.type} item={item} />
          )}
            </div>
        }
        </div>
      )}
    </div>);

};