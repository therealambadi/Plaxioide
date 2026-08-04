/*
 * FBDNodeTypes — Block rendering for Function Block Diagram editor.
 *
 * Each FBD block is rendered as an HTML div with:
 *  - Header showing block type name
 *  - Instance name or tag binding (for variables)
 *  - Input pins on the left edge
 *  - Output pins on the right edge
 *  - Pin dots for connection points
 *  - Selected state with blue dashed border
 *  - Draggable via data-block-id attribute
 */

import React, { useState } from 'react';
import { FBDNode, FBDBlockType, Pin, Position, IECDataType, logicStore } from '../logicStore.js';

// ── Block dimensions ───────────────────────────────────────────────────────────
export const HEADER_H = 28;
export const LINE_H = 24;
export const BLOCK_MIN_W = 80;
export const PIN_STUB = 12;
export const PIN_DOT_R = 4;

// ── Pin definitions for each block type ───────────────────────────────────────
const BLOCK_PIN_DEFS: Partial<Record<FBDBlockType, {inputs: Array<{name: string;type: IECDataType;}>;outputs: Array<{name: string;type: IECDataType;}>;}>> = {
  AND: { inputs: [{ name: 'IN1', type: 'BOOL' }, { name: 'IN2', type: 'BOOL' }], outputs: [{ name: 'OUT', type: 'BOOL' }] },
  OR: { inputs: [{ name: 'IN1', type: 'BOOL' }, { name: 'IN2', type: 'BOOL' }], outputs: [{ name: 'OUT', type: 'BOOL' }] },
  NOT: { inputs: [{ name: 'IN', type: 'BOOL' }], outputs: [{ name: 'OUT', type: 'BOOL' }] },
  XOR: { inputs: [{ name: 'IN1', type: 'BOOL' }, { name: 'IN2', type: 'BOOL' }], outputs: [{ name: 'OUT', type: 'BOOL' }] },
  NAND: { inputs: [{ name: 'IN1', type: 'BOOL' }, { name: 'IN2', type: 'BOOL' }], outputs: [{ name: 'OUT', type: 'BOOL' }] },
  NOR: { inputs: [{ name: 'IN1', type: 'BOOL' }, { name: 'IN2', type: 'BOOL' }], outputs: [{ name: 'OUT', type: 'BOOL' }] },
  ADD: { inputs: [{ name: 'IN1', type: 'INT' }, { name: 'IN2', type: 'INT' }], outputs: [{ name: 'OUT', type: 'INT' }] },
  SUB: { inputs: [{ name: 'IN1', type: 'INT' }, { name: 'IN2', type: 'INT' }], outputs: [{ name: 'OUT', type: 'INT' }] },
  MUL: { inputs: [{ name: 'IN1', type: 'INT' }, { name: 'IN2', type: 'INT' }], outputs: [{ name: 'OUT', type: 'INT' }] },
  DIV: { inputs: [{ name: 'IN1', type: 'INT' }, { name: 'IN2', type: 'INT' }], outputs: [{ name: 'OUT', type: 'INT' }] },
  MOD: { inputs: [{ name: 'IN1', type: 'INT' }, { name: 'IN2', type: 'INT' }], outputs: [{ name: 'OUT', type: 'INT' }] },
  ABS: { inputs: [{ name: 'IN', type: 'INT' }], outputs: [{ name: 'OUT', type: 'INT' }] },
  SQRT: { inputs: [{ name: 'IN', type: 'REAL' }], outputs: [{ name: 'OUT', type: 'REAL' }] },
  GT: { inputs: [{ name: 'IN1', type: 'INT' }, { name: 'IN2', type: 'INT' }], outputs: [{ name: 'OUT', type: 'BOOL' }] },
  LT: { inputs: [{ name: 'IN1', type: 'INT' }, { name: 'IN2', type: 'INT' }], outputs: [{ name: 'OUT', type: 'BOOL' }] },
  GE: { inputs: [{ name: 'IN1', type: 'INT' }, { name: 'IN2', type: 'INT' }], outputs: [{ name: 'OUT', type: 'BOOL' }] },
  LE: { inputs: [{ name: 'IN1', type: 'INT' }, { name: 'IN2', type: 'INT' }], outputs: [{ name: 'OUT', type: 'BOOL' }] },
  EQ: { inputs: [{ name: 'IN1', type: 'INT' }, { name: 'IN2', type: 'INT' }], outputs: [{ name: 'OUT', type: 'BOOL' }] },
  NE: { inputs: [{ name: 'IN1', type: 'INT' }, { name: 'IN2', type: 'INT' }], outputs: [{ name: 'OUT', type: 'BOOL' }] },
  TON: { inputs: [{ name: 'IN', type: 'BOOL' }, { name: 'PT', type: 'TIME' }], outputs: [{ name: 'Q', type: 'BOOL' }, { name: 'ET', type: 'TIME' }] },
  TOF: { inputs: [{ name: 'IN', type: 'BOOL' }, { name: 'PT', type: 'TIME' }], outputs: [{ name: 'Q', type: 'BOOL' }, { name: 'ET', type: 'TIME' }] },
  TP: { inputs: [{ name: 'IN', type: 'BOOL' }, { name: 'PT', type: 'TIME' }], outputs: [{ name: 'Q', type: 'BOOL' }, { name: 'ET', type: 'TIME' }] },
  CTU: { inputs: [{ name: 'CU', type: 'BOOL' }, { name: 'R', type: 'BOOL' }, { name: 'PV', type: 'INT' }], outputs: [{ name: 'Q', type: 'BOOL' }, { name: 'CV', type: 'INT' }] },
  CTD: { inputs: [{ name: 'CD', type: 'BOOL' }, { name: 'LD', type: 'BOOL' }, { name: 'PV', type: 'INT' }], outputs: [{ name: 'Q', type: 'BOOL' }, { name: 'CV', type: 'INT' }] },
  SR: { inputs: [{ name: 'S1', type: 'BOOL' }, { name: 'R', type: 'BOOL' }], outputs: [{ name: 'Q1', type: 'BOOL' }] },
  RS: { inputs: [{ name: 'S', type: 'BOOL' }, { name: 'R1', type: 'BOOL' }], outputs: [{ name: 'Q1', type: 'BOOL' }] },
  SEL: { inputs: [{ name: 'G', type: 'BOOL' }, { name: 'IN0', type: 'INT' }, { name: 'IN1', type: 'INT' }], outputs: [{ name: 'OUT', type: 'INT' }] },
  MUX: { inputs: [{ name: 'K', type: 'INT' }, { name: 'IN0', type: 'INT' }, { name: 'IN1', type: 'INT' }, { name: 'IN2', type: 'INT' }], outputs: [{ name: 'OUT', type: 'INT' }] },
  LIMIT: { inputs: [{ name: 'MN', type: 'INT' }, { name: 'IN', type: 'INT' }, { name: 'MX', type: 'INT' }], outputs: [{ name: 'OUT', type: 'INT' }] },
  MIN: { inputs: [{ name: 'IN1', type: 'INT' }, { name: 'IN2', type: 'INT' }], outputs: [{ name: 'OUT', type: 'INT' }] },
  MAX: { inputs: [{ name: 'IN1', type: 'INT' }, { name: 'IN2', type: 'INT' }], outputs: [{ name: 'OUT', type: 'INT' }] },
  MOVE: { inputs: [{ name: 'IN', type: 'INT' }], outputs: [{ name: 'OUT', type: 'INT' }] },
  IN_VARIABLE: { inputs: [], outputs: [{ name: 'OUT', type: 'BOOL' }] },
  OUT_VARIABLE: { inputs: [{ name: 'IN', type: 'BOOL' }], outputs: [] },
  INOUT_VARIABLE: { inputs: [{ name: 'IN', type: 'BOOL' }], outputs: [{ name: 'OUT', type: 'BOOL' }] }
};

// ── Block colors by category ───────────────────────────────────────────────────
const BLOCK_COLORS: Record<string, string> = {
  AND: '#60a5fa', OR: '#60a5fa', NOT: '#60a5fa', XOR: '#60a5fa', NAND: '#60a5fa', NOR: '#60a5fa',
  ADD: '#34d399', SUB: '#34d399', MUL: '#34d399', DIV: '#34d399', MOD: '#34d399', ABS: '#34d399', SQRT: '#34d399',
  GT: '#fb923c', LT: '#fb923c', GE: '#fb923c', LE: '#fb923c', EQ: '#fb923c', NE: '#fb923c',
  TON: '#a78bfa', TOF: '#a78bfa', TP: '#a78bfa',
  CTU: '#f472b6', CTD: '#f472b6',
  SR: '#fbbf24', RS: '#fbbf24',
  SEL: '#94a3b8', MUX: '#94a3b8', LIMIT: '#94a3b8', MIN: '#94a3b8', MAX: '#94a3b8',
  MOVE: '#94a3b8',
  IN_VARIABLE: '#4ade80', OUT_VARIABLE: '#4ade80', INOUT_VARIABLE: '#4ade80'
};

// ── Helper: Create default node ───────────────────────────────────────────────
export function createDefaultNode(type: FBDBlockType, position: Position): FBDNode {
  const pinDef = BLOCK_PIN_DEFS[type] || { inputs: [{ name: 'IN', type: 'BOOL' as IECDataType }], outputs: [{ name: 'OUT', type: 'BOOL' as IECDataType }] };
  const inputs: Pin[] = pinDef.inputs.map((p, i) => ({ id: `${p.name}-${i}`, name: p.name, dataType: p.type }));
  const outputs: Pin[] = pinDef.outputs.map((p, i) => ({ id: `${p.name}-${i}`, name: p.name, dataType: p.type }));

  const isVariable = ['IN_VARIABLE', 'OUT_VARIABLE', 'INOUT_VARIABLE'].includes(type);
  const node: FBDNode = {
    id: `fbd-${type.toLowerCase()}-${Date.now()}`,
    type,
    position,
    inputs,
    outputs
  };

  if (!isVariable) {
    node.instanceName = `${type.toLowerCase()}1`;
  } else {
    node.tag = { name: '', dataType: 'BOOL' };
  }

  return node;
}

// ── Helper: Get pin world position ─────────────────────────────────────────────
export function getPinPosition(node: FBDNode, pinName: string, side: 'input' | 'output'): Position {
  const isVariable = ['IN_VARIABLE', 'OUT_VARIABLE', 'INOUT_VARIABLE'].includes(node.type);
  const width = isVariable ? 100 : Math.max(BLOCK_MIN_W, node.type.length * 8 + 20);
  const inputCount = node.inputs.length;
  const outputCount = node.outputs.length;
  const maxPins = Math.max(inputCount, outputCount);
  const height = HEADER_H + maxPins * LINE_H + 8;

  if (side === 'input') {
    const idx = node.inputs.findIndex((p) => p.name === pinName);
    if (idx === -1) return { x: node.position.x, y: node.position.y + height / 2 };
    const pinY = node.position.y + HEADER_H + (idx + 0.5) * LINE_H + 4;
    return { x: node.position.x, y: pinY };
  } else {
    const idx = node.outputs.findIndex((p) => p.name === pinName);
    if (idx === -1) return { x: node.position.x + width, y: node.position.y + height / 2 };
    const pinY = node.position.y + HEADER_H + (idx + 0.5) * LINE_H + 4;
    return { x: node.position.x + width, y: pinY };
  }
}

// ── Block Renderer ─────────────────────────────────────────────────────────────
export const FBDBlockRenderer: React.FC<{
  node: FBDNode;
  selected: boolean;
  hoverPinTarget?: {nodeId: string;pin: string;};
}> = ({ node, selected, hoverPinTarget }) => {
  const [editingTag, setEditingTag] = useState(false);
  const isVariable = ['IN_VARIABLE', 'OUT_VARIABLE', 'INOUT_VARIABLE'].includes(node.type);
  const color = BLOCK_COLORS[node.type] || '#94a3b8';

  const inputCount = node.inputs.length;
  const outputCount = node.outputs.length;
  const maxPins = Math.max(inputCount, outputCount, 1);
  const width = isVariable ? 100 : Math.max(BLOCK_MIN_W, node.type.length * 8 + 20);
  const height = HEADER_H + maxPins * LINE_H + 8;

  return (
    <div
      data-block-id={node.id}
      style={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        width,
        height,
        background: 'var(--vscode-input-background)',
        border: selected ? `2px dashed var(--vscode-focusBorder)` : `1.5px solid ${color}88`,
        borderRadius: 4,
        boxShadow: selected ? `0 0 0 2px ${color}44` : 'none',
        cursor: 'move',
        userSelect: 'none'
      }}>

      {/* Header */}
      <div style={{
        height: HEADER_H,
        background: `${color}22`,
        borderBottom: `1px solid ${color}44`,
        borderRadius: '3px 3px 0 0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
        color, letterSpacing: 0.5,
        pointerEvents: 'none'
      }}>
        {node.type.replace(/_/g, ' ')}
      </div>

      {/* Instance name or tag */}
      <div style={{
        position: 'absolute', top: HEADER_H + 2, left: 8, right: 8,
        textAlign: 'center', fontSize: 9, color: 'var(--vscode-descriptionForeground)',
        fontFamily: 'monospace', pointerEvents: isVariable ? 'auto' : 'none'
      }}>
        {isVariable ?
        editingTag ?
        <input
          autoFocus
          value={node.tag?.name || ''}
          onChange={(e) => {
            logicStore.updateFBDNode(node.id, {
              tag: { name: e.target.value, dataType: node.tag?.dataType || 'BOOL' }
            });
          }}
          onBlur={() => setEditingTag(false)}
          onKeyDown={(e) => {if (e.key === 'Enter') setEditingTag(false);}}
          style={{
            width: '100%', padding: 2, fontSize: 9, fontFamily: 'monospace',
            background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)',
            border: '1px solid var(--vscode-focusBorder)', borderRadius: 2
          }} /> :


        <div
          onDoubleClick={() => setEditingTag(true)}
          title="Double-click to edit tag"
          style={{ cursor: 'text', color: node.tag?.name ? 'var(--vscode-editor-foreground)' : 'var(--vscode-descriptionForeground)' }}>

              {node.tag?.name || '?tag?'}
            </div> :


        node.instanceName || ''
        }
      </div>

      {/* Input pins */}
      {node.inputs.map((pin, i) => {
        const pinY = HEADER_H + (i + 0.5) * LINE_H + 4;
        const isHovered = hoverPinTarget?.nodeId === node.id && hoverPinTarget.pin === pin.name;
        return (
          <React.Fragment key={pin.id}>
            {/* Pin stub line */}
            <div style={{
              position: 'absolute', left: 0, top: pinY - 1,
              width: PIN_STUB, height: 2,
              background: 'var(--vscode-input-placeholderForeground)',
              pointerEvents: 'none'
            }} />
            {/* Pin dot */}
            <div
              data-node-id={node.id}
              data-pin={pin.name}
              data-pin-side="input"
              style={{
                position: 'absolute',
                left: -PIN_DOT_R,
                top: pinY - PIN_DOT_R,
                width: PIN_DOT_R * 2,
                height: PIN_DOT_R * 2,
                borderRadius: '50%',
                background: isHovered ? 'var(--vscode-focusBorder)' : 'var(--vscode-input-placeholderForeground)',
                border: isHovered ? '2px solid var(--vscode-focusBorder)' : '1px solid var(--vscode-widget-border)',
                cursor: 'crosshair',
                boxShadow: isHovered ? '0 0 4px var(--vscode-focusBorder)' : 'none',
                pointerEvents: 'auto'
              }} />

            {/* Pin label */}
            <div style={{
              position: 'absolute', left: PIN_STUB + 4, top: pinY - 8,
              fontSize: 8, color: 'var(--vscode-input-placeholderForeground)',
              fontFamily: 'monospace', pointerEvents: 'none'
            }}>
              {pin.name}
            </div>
          </React.Fragment>);

      })}

      {/* Output pins */}
      {node.outputs.map((pin, i) => {
        const pinY = HEADER_H + (i + 0.5) * LINE_H + 4;
        return (
          <React.Fragment key={pin.id}>
            {/* Pin stub line */}
            <div style={{
              position: 'absolute', right: 0, top: pinY - 1,
              width: PIN_STUB, height: 2,
              background: 'var(--vscode-input-placeholderForeground)',
              pointerEvents: 'none'
            }} />
            {/* Pin dot */}
            <div
              data-node-id={node.id}
              data-pin={pin.name}
              data-pin-side="output"
              style={{
                position: 'absolute',
                right: -PIN_DOT_R,
                top: pinY - PIN_DOT_R,
                width: PIN_DOT_R * 2,
                height: PIN_DOT_R * 2,
                borderRadius: '50%',
                background: 'var(--vscode-input-placeholderForeground)',
                border: '1px solid var(--vscode-widget-border)',
                cursor: 'crosshair',
                pointerEvents: 'auto'
              }} />

            {/* Pin label */}
            <div style={{
              position: 'absolute', right: PIN_STUB + 4, top: pinY - 8,
              fontSize: 8, color: 'var(--vscode-input-placeholderForeground)',
              fontFamily: 'monospace', textAlign: 'right', pointerEvents: 'none'
            }}>
              {pin.name}
            </div>
            {/* Live value badge (if monitor mode) */}
            {pin.value !== undefined &&
            <div style={{
              position: 'absolute', right: -48, top: pinY - 10,
              padding: '2px 6px', borderRadius: 3,
              background: 'var(--vscode-badge-background)',
              color: 'var(--vscode-badge-foreground)',
              fontSize: 8, fontFamily: 'monospace',
              pointerEvents: 'none'
            }}>
                {pin.value}
              </div>
            }
          </React.Fragment>);

      })}
    </div>);

};