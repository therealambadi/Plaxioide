/*
 * FBDCanvas — Function Block Diagram editor.
 *
 * Layout constants match OpenPLC reference implementation:
 *   Block:    width up to 216, header at top (block name input), pins at y=48+i*48
 *   Variable: 128×32, handle at y=16 (center), handle IDs: 'input-variable' / 'output-variable'
 *   Connector/Continuation: 112×32, pentagon shape, handle at y=16
 *   Comment:  resizable, min 144×80
 *
 * Handle style: top=<px>, left=0 (target) / right=0 (source)  — NOT ±7px offset.
 * ReactFlow places the handle center ON the node border when offset=0.
 *
 * Wire drawing: drag from source handle → target handle. Live preview is a
 * dashed blue line. Released connection fires onConnect → persisted to store.
 */

import React, {
  useCallback, useEffect, useRef, useState } from
'react';

import {
  BaseEdge,
  Background,
  BackgroundVariant,
  Controls,
  EdgeLabelRenderer,
  Handle,
  NodeResizer,
  Position,
  ReactFlow,
  addEdge,
  getSmoothStepPath,
  useEdgesState,
  useNodesState } from
'@xyflow/react';
import type {
  Connection,
  Edge,
  EdgeChange,
  EdgeProps,
  IsValidConnection,
  Node,
  NodeChange,
  NodeTypes,
  ReactFlowInstance } from
'@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  FBDBlockType,
  FBDNode,
  FBDWire,
  IECDataType,
  Pin,
  logicStore,
  useLogicStoreSelector } from
'../logicStore.js';
import { undoRedoStore } from '../undoRedoStore.js';

// ─── OpenPLC layout constants ────────────────────────────────────────────────

const BLK_CONNECTOR_Y = 48; // top of first pin row inside block
const BLK_CONNECTOR_Y_OFFSET = 48; // spacing between consecutive pins
const BLK_MAX_WIDTH = 216; // cap block width
const BLK_MIN_WIDTH = 80;
const VAR_W = 128; // variable node total width
const VAR_H = 32; // variable node height
const VAR_INNER_W = 112; // text area inside variable node
const CONN_W = 112; // connector/continuation total width
const CONN_H = 32;

// ─── Pin definitions ──────────────────────────────────────────────────────────

interface PinDef {name: string;type: IECDataType;}
interface BlockPinDef {inputs: PinDef[];outputs: PinDef[];}

export const BLOCK_PIN_DEFS: Partial<Record<FBDBlockType, BlockPinDef>> = {
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
  CTUD: { inputs: [{ name: 'CU', type: 'BOOL' }, { name: 'CD', type: 'BOOL' }, { name: 'R', type: 'BOOL' }, { name: 'LD', type: 'BOOL' }, { name: 'PV', type: 'INT' }], outputs: [{ name: 'QU', type: 'BOOL' }, { name: 'QD', type: 'BOOL' }, { name: 'CV', type: 'INT' }] },
  SR: { inputs: [{ name: 'S1', type: 'BOOL' }, { name: 'R', type: 'BOOL' }], outputs: [{ name: 'Q1', type: 'BOOL' }] },
  RS: { inputs: [{ name: 'S', type: 'BOOL' }, { name: 'R1', type: 'BOOL' }], outputs: [{ name: 'Q1', type: 'BOOL' }] },
  RTRIG: { inputs: [{ name: 'CLK', type: 'BOOL' }], outputs: [{ name: 'Q', type: 'BOOL' }] },
  FTRIG: { inputs: [{ name: 'CLK', type: 'BOOL' }], outputs: [{ name: 'Q', type: 'BOOL' }] },
  SEL: { inputs: [{ name: 'G', type: 'BOOL' }, { name: 'IN0', type: 'INT' }, { name: 'IN1', type: 'INT' }], outputs: [{ name: 'OUT', type: 'INT' }] },
  MUX: { inputs: [{ name: 'K', type: 'INT' }, { name: 'IN0', type: 'INT' }, { name: 'IN1', type: 'INT' }, { name: 'IN2', type: 'INT' }], outputs: [{ name: 'OUT', type: 'INT' }] },
  LIMIT: { inputs: [{ name: 'MN', type: 'INT' }, { name: 'IN', type: 'INT' }, { name: 'MX', type: 'INT' }], outputs: [{ name: 'OUT', type: 'INT' }] },
  MIN: { inputs: [{ name: 'IN1', type: 'INT' }, { name: 'IN2', type: 'INT' }], outputs: [{ name: 'OUT', type: 'INT' }] },
  MAX: { inputs: [{ name: 'IN1', type: 'INT' }, { name: 'IN2', type: 'INT' }], outputs: [{ name: 'OUT', type: 'INT' }] },
  MOVE: { inputs: [{ name: 'IN', type: 'INT' }], outputs: [{ name: 'OUT', type: 'INT' }] },
  IN_VARIABLE: { inputs: [], outputs: [{ name: 'output-variable', type: 'BOOL' }] },
  OUT_VARIABLE: { inputs: [{ name: 'input-variable', type: 'BOOL' }], outputs: [] },
  INOUT_VARIABLE: { inputs: [{ name: 'input-variable', type: 'BOOL' }], outputs: [{ name: 'output-variable', type: 'BOOL' }] },
  CONNECTOR: { inputs: [{ name: 'input', type: 'BOOL' }], outputs: [] },
  CONTINUATION: { inputs: [], outputs: [{ name: 'output', type: 'BOOL' }] },
  COMMENT: { inputs: [], outputs: [] }
};

// Compute block height from max pin count (OpenPLC formula)
function computeBlockH(inputs: PinDef[], outputs: PinDef[]): number {
  const maxPins = Math.max(inputs.length, outputs.length);
  return BLK_CONNECTOR_Y + 24 + Math.max(maxPins - 1, 0) * BLK_CONNECTOR_Y_OFFSET;
}

// Compute block width from label lengths (OpenPLC formula, capped at 216)
function computeBlockW(inputs: PinDef[], outputs: PinDef[], blockName: string): number {
  const inW = inputs.reduce((m, p) => Math.max(m, p.name.length * 9), 0);
  const outW = outputs.reduce((m, p) => Math.max(m, p.name.length * 9), 0);
  const nameW = blockName.length * 11;
  return Math.min(Math.max(inW + 12 + outW, nameW, BLK_MIN_WIDTH), BLK_MAX_WIDTH);
}

// ─── Color palette ────────────────────────────────────────────────────────────

const C: Record<string, string> = {
  AND: '#60a5fa', OR: '#60a5fa', NOT: '#60a5fa', XOR: '#60a5fa', NAND: '#60a5fa', NOR: '#60a5fa',
  ADD: '#34d399', SUB: '#34d399', MUL: '#34d399', DIV: '#34d399', MOD: '#34d399', ABS: '#34d399', SQRT: '#34d399',
  GT: '#fb923c', LT: '#fb923c', GE: '#fb923c', LE: '#fb923c', EQ: '#fb923c', NE: '#fb923c',
  TON: '#a78bfa', TOF: '#a78bfa', TP: '#a78bfa',
  CTU: '#f472b6', CTD: '#f472b6', CTUD: '#f472b6',
  RTRIG: '#94a3b8', FTRIG: '#94a3b8',
  SR: '#fbbf24', RS: '#fbbf24',
  SEL: '#94a3b8', MUX: '#94a3b8', LIMIT: '#94a3b8', MIN: '#94a3b8', MAX: '#94a3b8', MOVE: '#94a3b8',
  IN_VARIABLE: '#4ade80', OUT_VARIABLE: '#fb923c', INOUT_VARIABLE: '#a78bfa',
  CONNECTOR: '#60a5fa', CONTINUATION: '#60a5fa'
};
const blockColor = (t: string) => C[t] ?? '#94a3b8';

// ─── Variable node ────────────────────────────────────────────────────────────
// Matches OpenPLC: VARIABLE_ELEMENT_SIZE=128, VARIABLE_ELEMENT_HEIGHT=32
// Handle IDs: 'input-variable' (target on left) / 'output-variable' (source on right)
// Handle style: top = VAR_H/2 = 16, left=0 / right=0

interface VarData {
  blockType: FBDBlockType;
  tagName: string;
  nodeId: string;
  _forcedValue?: string;
  _liveValue?: string;
  _monitorMode?: string;
}

const FBDVariableNode: React.FC<{data: VarData;}> = ({ data }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.tagName);
  useEffect(() => {setDraft(data.tagName);}, [data.tagName]);

  const isIn = data.blockType === 'IN_VARIABLE';
  const isOut = data.blockType === 'OUT_VARIABLE';
  const isInOut = data.blockType === 'INOUT_VARIABLE';
  const accent = blockColor(data.blockType);
  const badge = isIn ? 'IN' : isOut ? 'OUT' : 'I/O';

  // Read from data prop (injected by storeNodeToFlow on each scan) to avoid per-node subscriptions
  const monitorMode = data._monitorMode;
  const forcedValue = data._forcedValue;
  const liveValue = data._liveValue;
  const borderColor = forcedValue === 'TRUE' ? '#80C000' :
  forcedValue === 'FALSE' ? '#4080FF' :
  accent;

  const commit = () => {
    setEditing(false);
    const node = logicStore.getState().fbdProgram.nodes.find((n) => n.id === data.nodeId);
    if (node) logicStore.updateFBDNode(data.nodeId, { tag: { name: draft, dataType: node.tag?.dataType ?? 'BOOL' } });
  };

  return (
    <div style={{
      position: 'relative',
      width: VAR_W, height: VAR_H,
      background: 'var(--vscode-editor-background, #1e1e1e)',
      border: `1.5px solid ${borderColor}`,
      borderRadius: 3,
      display: 'flex', alignItems: 'stretch',
      boxSizing: 'border-box'
    }}>
      {/* Type badge */}
      <div style={{
        width: 28, flexShrink: 0,
        background: `${borderColor}33`,
        borderRight: `1px solid ${borderColor}88`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 7, fontWeight: 800, fontFamily: 'monospace',
        color: borderColor, userSelect: 'none', letterSpacing: 0.2
      }}>{badge}</div>
      {/* Tag name */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 6px', minWidth: 0 }}>
        {editing ?
        <input autoFocus value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {if (e.key === 'Enter') commit();if (e.key === 'Escape') {setEditing(false);setDraft(data.tagName);}}}
        style={{
          width: '100%', fontSize: 10, fontFamily: 'monospace',
          background: 'transparent', color: 'var(--vscode-editor-foreground, #ccc)',
          border: 'none', borderBottom: `1px solid ${borderColor}`, outline: 'none'
        }} /> :


        <span onDoubleClick={() => setEditing(true)} title="Double-click to set tag"
        style={{
          fontSize: 10, fontFamily: 'monospace', cursor: 'text', userSelect: 'none',
          color: draft ? 'var(--vscode-editor-foreground, #e0e0e0)' : '#888',
          fontStyle: draft ? 'normal' : 'italic',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>{draft || '…tag…'}</span>
        }
      </div>
      {/* Handles — top=VAR_H/2=16, matching OpenPLC DEFAULT_VARIABLE_CONNECTOR_Y */}
      {(isOut || isInOut) &&
      <Handle type="target" position={Position.Left} id="input-variable"
      style={{ top: VAR_H / 2, left: 0, width: 8, height: 8, background: 'transparent', border: `2px solid ${borderColor}`, borderRadius: '50%' }} />
      }
      {(isIn || isInOut) &&
      <Handle type="source" position={Position.Right} id="output-variable"
      style={{ top: VAR_H / 2, right: 0, width: 8, height: 8, background: borderColor, border: `2px solid ${borderColor}`, borderRadius: '50%' }} />
      }
      {/* Live value badge */}
      {monitorMode === 'running' && liveValue !== undefined &&
      <div style={{
        position: 'absolute', bottom: -16, left: 0, right: 0,
        textAlign: 'center',
        fontSize: 8, padding: '1px 4px', borderRadius: 8,
        background: '#22c55e22', color: '#22c55e',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        fontFamily: 'monospace', pointerEvents: 'none'
      }}>
          {liveValue === 'true' || liveValue === 'TRUE' ? 'TRUE' :
        liveValue === 'false' || liveValue === 'FALSE' ? 'FALSE' :
        liveValue}
        </div>
      }
      {/* Force indicator */}
      {forcedValue !== undefined &&
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 9, height: 9,
        background: '#f59e0b',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 6, fontWeight: 800, color: '#000',
        borderRadius: 2, zIndex: 10, pointerEvents: 'none',
        fontFamily: 'monospace'
      }}>F</div>
      }
    </div>);

};

// ─── Block node ───────────────────────────────────────────────────────────────
// Matches OpenPLC: name input at top-2, pins at top = BLK_CONNECTOR_Y + i*BLK_CONNECTOR_Y_OFFSET
// left=0 for target handles, right=0 for source handles

interface BlockData {
  blockType: FBDBlockType;instanceName: string;nodeId: string;
  inputs: Array<{id: string;name: string;negated?: boolean;}>;
  outputs: Array<{id: string;name: string;negated?: boolean;}>;
  w: number;h: number;
  _monitorMode?: string;
  _pinValues?: Record<string, string>;
}

// Variadic block types support dynamic pin add/remove
const VARIADIC_TYPES = new Set<FBDBlockType>(['AND', 'OR', 'NAND', 'NOR', 'XOR', 'ADD', 'MUL']);

const FBDBlockNode: React.FC<{data: BlockData;}> = ({ data }) => {
  const color = blockColor(data.blockType);
  const { w, h } = data;
  const pinValues = data._pinValues ?? {};
  const monitorMode_running = data._monitorMode === 'running';

  const [editName, setEditName] = useState(false);
  const [draft, setDraft] = useState(data.instanceName);
  useEffect(() => {setDraft(data.instanceName);}, [data.instanceName]);

  const commitName = () => {
    setEditName(false);
    logicStore.updateFBDNode(data.nodeId, { instanceName: draft });
  };

  const isVariadic = VARIADIC_TYPES.has(data.blockType);

  return (
    <div style={{ position: 'relative' }}>
      {/* Instance name above block (for FB-type blocks) */}
      <div style={{
        position: 'absolute', top: -20, left: 0, right: 0, textAlign: 'center',
        fontSize: 9, fontFamily: 'monospace',
        color: 'var(--vscode-editor-foreground, #aaa)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        pointerEvents: 'none', userSelect: 'none'
      }}>
        {editName ?
        <input autoFocus value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {if (e.key === 'Enter') commitName();if (e.key === 'Escape') {setEditName(false);setDraft(data.instanceName);}}}
        style={{
          fontSize: 9, fontFamily: 'monospace', textAlign: 'center',
          background: 'var(--vscode-input-background, #3c3c3c)',
          color: 'var(--vscode-editor-foreground, #ccc)',
          border: `1px solid ${color}44`, borderRadius: 2, outline: 'none',
          width: '80%', pointerEvents: 'all'
        }} /> :


        <span onDoubleClick={() => setEditName(true)} title="Double-click to set instance name"
        style={{ cursor: 'text', pointerEvents: 'all', opacity: draft ? 1 : 0.4 }}>
            {draft || 'instance'}
          </span>
        }
      </div>

      {/* Block body */}
      <div style={{
        width: w, height: h, position: 'relative', boxSizing: 'border-box',
        background: 'var(--vscode-editor-background, #1e1e1e)',
        border: `1.5px solid ${color}`,
        borderRadius: 4
      }}>
        {/* Block type name at top center, matching OpenPLC InputWithRef at top:2 */}
        <div style={{
          position: 'absolute', top: 6, left: 0, right: 0, textAlign: 'center',
          fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
          color, letterSpacing: 0.5, userSelect: 'none'
        }}>{data.blockType}</div>

        {/* Separator line under block name */}
        <div style={{
          position: 'absolute', top: BLK_CONNECTOR_Y - 6, left: 0, right: 0,
          height: 1, background: `${color}66`
        }} />

        {/* Input pin labels & handles — top = BLK_CONNECTOR_Y + i*BLK_CONNECTOR_Y_OFFSET */}
        {data.inputs.map((pin, i) => {
          const top = BLK_CONNECTOR_Y + i * BLK_CONNECTOR_Y_OFFSET;
          const negated = pin.negated === true;
          return (
            <React.Fragment key={`in-${pin.id}`}>
              {/* Handle: left=0, top=<px>, matching OpenPLC style */}
              <Handle type="target" position={Position.Left} id={pin.name}
              style={{
                top, left: 0, width: 8, height: 8,
                background: negated ? 'var(--vscode-editor-background, #1e1e1e)' : 'var(--vscode-editor-background, #1e1e1e)',
                border: `2px solid ${color}`,
                borderRadius: '50%'
              }} />
              {/* Negation indicator: small circle overlaid on handle */}
              {negated &&
              <svg
                style={{ position: 'absolute', left: -7, top: top - 6, pointerEvents: 'none', zIndex: 5 }}
                width={14} height={14}>

                  <circle cx={7} cy={7} r={5}
                stroke={color} strokeWidth={1.5}
                fill="var(--vscode-editor-background, #1e1e1e)" />
                </svg>
              }
              <div
                title="Right-click to toggle pin negation"
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const storeNode = logicStore.getState().fbdProgram.nodes.find((n) => n.id === data.nodeId);
                  if (!storeNode) return;
                  const updatedInputs = storeNode.inputs.map((p) =>
                  p.name === pin.name ? { ...p, negated: !p.negated } : p
                  );
                  undoRedoStore.push();
                  logicStore.updateFBDNode(data.nodeId, { inputs: updatedInputs });
                }}
                style={{
                  position: 'absolute', left: 8, top: top - 9,
                  fontSize: 9, fontFamily: 'monospace', lineHeight: '18px',
                  color: negated ? color : 'var(--vscode-editor-foreground, #bbb)',
                  userSelect: 'none', cursor: 'context-menu',
                  fontStyle: negated ? 'italic' : 'normal'
                }}>{pin.name}</div>
            </React.Fragment>);

        })}

        {/* Output pin labels & handles — top = BLK_CONNECTOR_Y + i*BLK_CONNECTOR_Y_OFFSET */}
        {data.outputs.map((pin, i) => {
          const top = BLK_CONNECTOR_Y + i * BLK_CONNECTOR_Y_OFFSET;
          const rawVal = pinValues[pin.name];
          const displayVal = rawVal === 'true' || rawVal === 'TRUE' ? 'T' :
          rawVal === 'false' || rawVal === 'FALSE' ? 'F' :
          rawVal;
          return (
            <React.Fragment key={`out-${pin.id}`}>
              <Handle type="source" position={Position.Right} id={pin.name}
              style={{
                top, right: 0, width: 8, height: 8,
                background: color,
                border: `2px solid ${color}`,
                borderRadius: '50%'
              }} />
              <div style={{
                position: 'absolute', right: 8, top: top - 9,
                fontSize: 9, fontFamily: 'monospace', lineHeight: '18px',
                color: 'var(--vscode-editor-foreground, #bbb)',
                pointerEvents: 'none', userSelect: 'none', textAlign: 'right'
              }}>{pin.name}</div>
              {monitorMode_running && displayVal !== undefined &&
              <div style={{
                position: 'absolute', right: 12, top: top + 2,
                fontSize: 7, padding: '0px 3px', borderRadius: 4,
                background: '#a78bfa22', color: '#a78bfa',
                fontFamily: 'monospace', pointerEvents: 'none', whiteSpace: 'nowrap'
              }}>{displayVal}</div>
              }
            </React.Fragment>);

        })}

        {/* Variadic +/− buttons — only in edit mode */}
        {isVariadic && !monitorMode_running &&
        <div style={{
          position: 'absolute', bottom: 4, right: 6,
          display: 'flex', gap: 3
        }}>
            <button
            title="Remove last input pin (min 2)"
            onMouseDown={(e) => {e.stopPropagation();e.preventDefault();}}
            onClick={(e) => {
              e.stopPropagation();
              const storeNode = logicStore.getState().fbdProgram.nodes.find((n) => n.id === data.nodeId);
              if (!storeNode || storeNode.inputs.length <= 2) return;
              const removedPin = storeNode.inputs[storeNode.inputs.length - 1];
              const wires = logicStore.getState().fbdProgram.wires;
              wires.
              filter((wire) => wire.to.nodeId === storeNode.id && wire.to.pin === removedPin.name).
              forEach((wire) => logicStore.deleteFBDWire(wire.id));
              undoRedoStore.push();
              logicStore.updateFBDNode(data.nodeId, { inputs: storeNode.inputs.slice(0, -1) });
            }}
            style={{
              width: 16, height: 16, borderRadius: 3, border: 'none', cursor: 'pointer',
              background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
              color: 'var(--vscode-button-secondaryForeground, #ccc)',
              fontSize: 13, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0
            }}>
            −</button>
            <button
            title="Add input pin"
            onMouseDown={(e) => {e.stopPropagation();e.preventDefault();}}
            onClick={(e) => {
              e.stopPropagation();
              const storeNode = logicStore.getState().fbdProgram.nodes.find((n) => n.id === data.nodeId);
              if (!storeNode) return;
              undoRedoStore.push();
              const n = storeNode.inputs.length + 1;
              const pinName = `IN${n}`;
              const newPin: Pin = { id: `in-${pinName}-${n}`, name: pinName, dataType: 'BOOL' };
              logicStore.updateFBDNode(data.nodeId, { inputs: [...storeNode.inputs, newPin] });
            }}
            style={{
              width: 16, height: 16, borderRadius: 3, border: 'none', cursor: 'pointer',
              background: 'var(--vscode-button-background, #0078d4)',
              color: 'var(--vscode-button-foreground, #fff)',
              fontSize: 13, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0
            }}>
            +</button>
          </div>
        }
      </div>
    </div>);

};

// ─── Connector node (receives a wire — pentagon arrow) ────────────────────────
// OpenPLC: CONNECTION_ELEMENT_WIDTH=112, HEIGHT=32
// Handle: top=16, left=0 (target 'input')

interface ConnData {label: string;nodeId: string;}

const FBDConnectorNode: React.FC<{data: ConnData;}> = ({ data }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  useEffect(() => {setDraft(data.label);}, [data.label]);

  const commit = () => {
    setEditing(false);
    logicStore.updateFBDNode(data.nodeId, { label: draft });
  };

  const ARROW = 14;
  // Pentagon: body 0→(W-ARROW), then arrow point at W
  const pts = `0,0 ${CONN_W - ARROW},0 ${CONN_W},${CONN_H / 2} ${CONN_W - ARROW},${CONN_H} 0,${CONN_H}`;

  return (
    <div style={{ position: 'relative', width: CONN_W, height: CONN_H }}>
      <svg width={CONN_W} height={CONN_H} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        <polygon points={pts}
        fill="var(--vscode-editor-background, #1e1e1e)"
        stroke="#60a5facc" strokeWidth={1.5} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, paddingRight: ARROW + 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1
      }}>
        {editing ?
        <input autoFocus value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {if (e.key === 'Enter') commit();if (e.key === 'Escape') {setEditing(false);setDraft(data.label);}}}
        style={{
          width: '80%', fontSize: 10, fontFamily: 'monospace', textAlign: 'center',
          background: 'transparent', color: 'var(--vscode-editor-foreground, #ccc)',
          border: 'none', borderBottom: '1px solid #60a5fa', outline: 'none'
        }} /> :


        <span onDoubleClick={() => setEditing(true)} title="Double-click to set label"
        style={{
          fontSize: 10, fontFamily: 'monospace', cursor: 'text', userSelect: 'none',
          color: draft ? '#60a5fa' : '#60a5fa88', fontStyle: draft ? 'normal' : 'italic'
        }}>{draft || 'label'}</span>
        }
      </div>
      <Handle type="target" position={Position.Left} id="input"
      style={{ top: CONN_H / 2, left: 0, width: 8, height: 8, background: 'transparent', border: '2px solid #60a5fa', borderRadius: '50%' }} />
    </div>);

};

// ─── Continuation node (emits a wire — pentagon body) ─────────────────────────
// Handle: top=16, right=0 (source 'output')

const FBDContinuationNode: React.FC<{data: ConnData;}> = ({ data }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  useEffect(() => {setDraft(data.label);}, [data.label]);

  const commit = () => {
    setEditing(false);
    logicStore.updateFBDNode(data.nodeId, { label: draft });
  };

  const ARROW = 14;
  const pts = `${ARROW},0 ${CONN_W},0 ${CONN_W},${CONN_H} ${ARROW},${CONN_H} 0,${CONN_H / 2}`;

  return (
    <div style={{ position: 'relative', width: CONN_W, height: CONN_H }}>
      <svg width={CONN_W} height={CONN_H} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        <polygon points={pts}
        fill="var(--vscode-editor-background, #1e1e1e)"
        stroke="#60a5facc" strokeWidth={1.5} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, paddingLeft: ARROW + 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1
      }}>
        {editing ?
        <input autoFocus value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {if (e.key === 'Enter') commit();if (e.key === 'Escape') {setEditing(false);setDraft(data.label);}}}
        style={{
          width: '80%', fontSize: 10, fontFamily: 'monospace', textAlign: 'center',
          background: 'transparent', color: 'var(--vscode-editor-foreground, #ccc)',
          border: 'none', borderBottom: '1px solid #60a5fa', outline: 'none'
        }} /> :


        <span onDoubleClick={() => setEditing(true)} title="Double-click to set label"
        style={{
          fontSize: 10, fontFamily: 'monospace', cursor: 'text', userSelect: 'none',
          color: draft ? '#60a5fa' : '#60a5fa88', fontStyle: draft ? 'normal' : 'italic'
        }}>{draft || 'label'}</span>
        }
      </div>
      <Handle type="source" position={Position.Right} id="output"
      style={{ top: CONN_H / 2, right: 0, width: 8, height: 8, background: '#60a5fa', border: '2px solid #60a5fa', borderRadius: '50%' }} />
    </div>);

};

// ─── Comment node ─────────────────────────────────────────────────────────────
// OpenPLC: MINIMUM_ELEMENT_WIDTH=144, MINIMUM_ELEMENT_HEIGHT=80, no handles

interface CommentData {content: string;nodeId: string;}

const FBDCommentNode: React.FC<{data: CommentData;selected?: boolean;}> = ({ data, selected }) => {
  const [text, setText] = useState(data.content);
  useEffect(() => {setText(data.content);}, [data.content]);

  return (
    <div style={{
      width: '100%', height: '100%', minWidth: 144, minHeight: 80,
      background: '#fbbf2410', border: '1.5px dashed #fbbf2455',
      borderRadius: 3, padding: '6px 8px', boxSizing: 'border-box', position: 'relative'
    }}>
      <NodeResizer minWidth={144} minHeight={80} isVisible={selected} />
      <div style={{
        fontSize: 8, fontWeight: 700, fontFamily: 'monospace',
        color: '#fbbf24aa', marginBottom: 3, userSelect: 'none', letterSpacing: 0.8
      }}>COMMENT</div>
      <textarea
        value={text}
        onChange={(e) => {setText(e.target.value);logicStore.updateFBDNode(data.nodeId, { content: e.target.value });}}
        onMouseDown={(e) => e.stopPropagation()}
        placeholder="Type here…"
        style={{
          width: '100%', height: 'calc(100% - 18px)',
          background: 'transparent', color: 'var(--vscode-editor-foreground, #ccc)',
          border: 'none', outline: 'none', resize: 'none',
          fontFamily: 'monospace', fontSize: 11, lineHeight: 1.4
        }} />

    </div>);

};

// ─── FBD Wire custom edge ─────────────────────────────────────────────────────

const FBDWireEdge: React.FC<EdgeProps> = ({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data, selected, style,
  markerEnd
}) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition
  });

  const label = (data as any)?._label as string | undefined;
  const energized = (data as any)?._energized as boolean | undefined;

  const strokeColor = energized ? '#22c55e' : selected ? '#60a5fa' : 'var(--vscode-editor-foreground, #6b7280)';
  const strokeWidth = energized ? 2.5 : selected ? 2 : 1.5;
  const filter = energized ? 'drop-shadow(0 0 3px #22c55e)' : undefined;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: strokeColor, strokeWidth, filter, ...(style as React.CSSProperties) }}
        markerEnd={markerEnd} />

      {label &&
      <EdgeLabelRenderer>
          <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'none',
            background: 'var(--vscode-editor-background, #1e1e1e)',
            border: '1px solid var(--vscode-editorGroup-border, #333)',
            borderRadius: 3,
            padding: '1px 5px',
            fontSize: 9,
            fontFamily: 'monospace',
            color: energized ? '#22c55e' : 'var(--vscode-descriptionForeground, #888)',
            whiteSpace: 'nowrap',
            zIndex: 10
          }}>

            {label}
          </div>
        </EdgeLabelRenderer>
      }
    </>);

};

// ─── Node type registry ───────────────────────────────────────────────────────

const NODE_TYPES: NodeTypes = {
  fbdVariable: FBDVariableNode as any,
  fbdBlock: FBDBlockNode as any,
  fbdConnector: FBDConnectorNode as any,
  fbdContinuation: FBDContinuationNode as any,
  fbdComment: FBDCommentNode as any
};

const EDGE_TYPES = { fbdWire: FBDWireEdge as any };

// ─── Store ↔ ReactFlow conversion ────────────────────────────────────────────

function storeNodeToFlow(node: FBDNode): Node {
  const type = node.type;

  if (type === 'IN_VARIABLE' || type === 'OUT_VARIABLE' || type === 'INOUT_VARIABLE') {
    const state = logicStore.getState();
    const tagName = node.tag?.name ?? '';
    const tagEntry = state.tagDatabase.find((t) => t.name === tagName);
    return {
      id: node.id, type: 'fbdVariable', position: node.position,
      data: {
        blockType: type,
        tagName,
        nodeId: node.id,
        _forcedValue: tagEntry?.forcedValue,
        _liveValue: tagEntry?.liveValue,
        _monitorMode: state.monitorMode
      } as VarData
    };
  }
  if (type === 'CONNECTOR') {
    return { id: node.id, type: 'fbdConnector', position: node.position,
      data: { label: node.label ?? '', nodeId: node.id } as ConnData };
  }
  if (type === 'CONTINUATION') {
    return { id: node.id, type: 'fbdContinuation', position: node.position,
      data: { label: node.label ?? '', nodeId: node.id } as ConnData };
  }
  if (type === 'COMMENT') {
    return { id: node.id, type: 'fbdComment', position: node.position,
      style: { width: node.size?.width ?? 200, height: node.size?.height ?? 100 },
      data: { content: node.content ?? '', nodeId: node.id } as CommentData };
  }

  // Generic block — compute pixel dimensions using actual node pins (supports variadic)
  const defAdapted = {
    inputs: node.inputs.map((p) => ({ name: p.name, type: p.dataType })),
    outputs: node.outputs.map((p) => ({ name: p.name, type: p.dataType }))
  };
  const w = computeBlockW(defAdapted.inputs, defAdapted.outputs, type);
  const h = computeBlockH(defAdapted.inputs, defAdapted.outputs);
  const blockState = logicStore.getState();
  const instanceKey = node.instanceName ?? node.id;
  const blockPinVals = blockState.fbdBlockPinValues?.[instanceKey] ?? {};
  return {
    id: node.id, type: 'fbdBlock', position: node.position,
    data: {
      blockType: type,
      instanceName: node.instanceName ?? '',
      nodeId: node.id,
      inputs: node.inputs.map((p) => ({ id: p.id, name: p.name, negated: p.negated })),
      outputs: node.outputs.map((p) => ({ id: p.id, name: p.name, negated: p.negated })),
      w, h,
      _monitorMode: blockState.monitorMode,
      _pinValues: blockPinVals
    } as BlockData
  };
}

function storeWiresToFlow(wires: FBDWire[], nodes: FBDNode[]): Edge[] {
  return wires.map((w) => {
    const srcNode = nodes.find((n) => n.id === w.from.nodeId);
    const tgtNode = nodes.find((n) => n.id === w.to.nodeId);

    // Wire label: show tag name only when wire connects BETWEEN two block nodes
    // (not directly to/from a visible variable node — user can see its label)
    let label: string | undefined;
    if (srcNode?.type === 'IN_VARIABLE' && srcNode.tag?.name &&
    tgtNode && !['IN_VARIABLE', 'OUT_VARIABLE', 'INOUT_VARIABLE', 'CONNECTOR', 'CONTINUATION'].includes(tgtNode.type)) {
      label = srcNode.tag.name;
    } else if (tgtNode?.type === 'OUT_VARIABLE' && tgtNode.tag?.name &&
    srcNode && !['IN_VARIABLE', 'OUT_VARIABLE', 'INOUT_VARIABLE', 'CONNECTOR', 'CONTINUATION'].includes(srcNode.type)) {
      label = tgtNode.tag.name;
    }

    return {
      id: w.id,
      source: w.from.nodeId, sourceHandle: w.from.pin,
      target: w.to.nodeId, targetHandle: w.to.pin,
      type: 'fbdWire',
      data: {
        _label: label,
        _energized: w.energized
      },
      style: {}
    };
  });
}

// ─── Node factory ─────────────────────────────────────────────────────────────

function createDefaultNode(type: FBDBlockType, position: {x: number;y: number;}): FBDNode {
  const def = BLOCK_PIN_DEFS[type];
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const buildPin = (p: PinDef, dir: 'in' | 'out', i: number) => ({
    id: `${dir}-${p.name}-${i}`,
    name: p.name,
    dataType: p.type
  });

  const inputs = (def?.inputs ?? []).map((p, i) => buildPin(p, 'in', i));
  const outputs = (def?.outputs ?? []).map((p, i) => buildPin(p, 'out', i));

  const isVar = type === 'IN_VARIABLE' || type === 'OUT_VARIABLE' || type === 'INOUT_VARIABLE';
  const isConn = type === 'CONNECTOR' || type === 'CONTINUATION';
  const isComm = type === 'COMMENT';

  return {
    id: `fbd-${type.toLowerCase().replace(/_/g, '-')}-${uid}`,
    type, position, inputs, outputs,
    ...(isVar ? { tag: { name: '', dataType: 'BOOL' as IECDataType } } : {}),
    ...(isConn ? { label: '' } : {}),
    ...(isComm ? { content: '', size: { width: 200, height: 100 } } : { instanceName: '' })
  };
}

// ─── FBDCanvas ────────────────────────────────────────────────────────────────

// ─── Force Popover (inline, mirrors LD implementation) ───────────────────────

interface FBDForceMenu {x: number;y: number;tagName: string;}

const FBDForcePopover: React.FC<{
  menu: FBDForceMenu;
  hasForcedValue: boolean;
  onClose: () => void;
}> = ({ menu, hasForcedValue, onClose }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const btnStyle: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left', padding: '6px 14px',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'var(--vscode-menu-foreground, #d1d5db)', fontSize: 11, fontFamily: 'monospace'
  };

  return (
    <div ref={ref}
    onMouseDown={(e) => e.stopPropagation()}
    style={{
      position: 'fixed',
      left: Math.min(menu.x + 8, window.innerWidth - 200),
      top: Math.min(menu.y - 10, window.innerHeight - 170),
      zIndex: 9999,
      background: 'var(--vscode-editor-background, #1e1e1e)',
      border: '1px solid var(--vscode-contrastBorder, #6fc3df)',
      borderRadius: 4, padding: '0', minWidth: 180,
      boxShadow: '0 8px 32px rgba(0,0,0,.85)',
      fontFamily: 'var(--vscode-font-family, sans-serif)',
      overflow: 'hidden'
    }}>

      {/* Title bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 14px 6px',
        borderBottom: '1px solid var(--vscode-editorGroup-border, #3c3c3c)',
        background: 'var(--vscode-editor-background, #1e1e1e)'
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', color: 'var(--vscode-editor-foreground, #e2e8f0)', letterSpacing: 0.5 }}>
          Force Tag
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vscode-descriptionForeground, #888)', fontSize: 14, lineHeight: 1, padding: '0 2px' }}>
          ×</button>
      </div>
      {/* Tag name row */}
      <div style={{ padding: '5px 14px 4px', fontSize: 9, fontFamily: 'monospace', color: 'var(--vscode-descriptionForeground, #888)' }}>
        {menu.tagName || '—'}
      </div>
      <button style={{ ...btnStyle, color: '#80C000' }}
      onMouseEnter={(e) => {(e.currentTarget as HTMLButtonElement).style.background = 'var(--vscode-list-hoverBackground, #2a2d2e)';}}
      onMouseLeave={(e) => {(e.currentTarget as HTMLButtonElement).style.background = 'transparent';}}
      onClick={() => {logicStore.forceTag(menu.tagName, 'TRUE');onClose();}}>Force TRUE</button>
      <button style={{ ...btnStyle, color: '#4080FF' }}
      onMouseEnter={(e) => {(e.currentTarget as HTMLButtonElement).style.background = 'var(--vscode-list-hoverBackground, #2a2d2e)';}}
      onMouseLeave={(e) => {(e.currentTarget as HTMLButtonElement).style.background = 'transparent';}}
      onClick={() => {logicStore.forceTag(menu.tagName, 'FALSE');onClose();}}>Force FALSE</button>
      {hasForcedValue &&
      <button style={{ ...btnStyle, color: '#f59e0b' }}
      onMouseEnter={(e) => {(e.currentTarget as HTMLButtonElement).style.background = 'var(--vscode-list-hoverBackground, #2a2d2e)';}}
      onMouseLeave={(e) => {(e.currentTarget as HTMLButtonElement).style.background = 'transparent';}}
      onClick={() => {logicStore.releaseForce(menu.tagName);onClose();}}>Release Force</button>
      }
    </div>);

};

// ─── Block Config Modal (edit mode double-click on block node) ────────────────

interface FBDBlockConfigModalProps {
  nodeId: string;
  onClose: () => void;
}

const FBDBlockConfigModal: React.FC<FBDBlockConfigModalProps> = ({ nodeId, onClose }) => {
  const node = logicStore.getState().fbdProgram.nodes.find((n) => n.id === nodeId);
  const [instName, setInstName] = useState(node?.instanceName ?? '');
  if (!node) return null;

  const def = BLOCK_PIN_DEFS[node.type] ?? { inputs: [], outputs: [] };
  const [inputVals, setInputVals] = useState<Record<string, string>>(() => {
    const vals: Record<string, string> = {};
    (def.inputs ?? []).forEach((p) => {vals[p.name] = node.inputs.find((i) => i.name === p.name)?.value ?? '';});
    return vals;
  });

  const commit = () => {
    const updatedInputs = node.inputs.map((pin) => ({
      ...pin,
      value: inputVals[pin.name] ?? pin.value
    }));
    logicStore.updateFBDNode(nodeId, { instanceName: instName, inputs: updatedInputs });
    onClose();
  };

  const C_BDR = 'var(--vscode-editorGroup-border, #444)';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 380, borderRadius: 8, background: 'var(--vscode-editor-background, #1e1e1e)', border: `1px solid ${C_BDR}`, boxShadow: '0 16px 48px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px 12px', borderBottom: `1px solid ${C_BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>{node.type}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#888', marginBottom: 5 }}>Instance Name</div>
            <input autoFocus value={instName} onChange={(e) => setInstName(e.target.value)}
            onKeyDown={(e) => {if (e.key === 'Enter') commit();if (e.key === 'Escape') onClose();}}
            style={{ width: '100%', boxSizing: 'border-box', padding: '5px 9px', background: 'var(--vscode-input-background, #3c3c3c)', border: `1px solid var(--vscode-input-border, #555)`, borderRadius: 4, color: '#e2e8f0', fontSize: 12, outline: 'none', fontFamily: 'monospace' }} />

          </div>
          {(def.inputs ?? []).length > 0 &&
          <div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#888', marginBottom: 5 }}>Input Pins</div>
              {(def.inputs ?? []).map((p) =>
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ minWidth: 50, fontSize: 10, fontFamily: 'monospace', color: '#94a3b8' }}>{p.name}</span>
                  <input value={inputVals[p.name] ?? ''} onChange={(e) => setInputVals((v) => ({ ...v, [p.name]: e.target.value }))}
              style={{ flex: 1, padding: '3px 7px', background: 'var(--vscode-input-background, #3c3c3c)', border: `1px solid var(--vscode-input-border, #555)`, borderRadius: 4, color: '#e2e8f0', fontSize: 11, outline: 'none', fontFamily: 'monospace' }} />

                </div>
            )}
            </div>
          }
        </div>
        <div style={{ padding: '10px 18px 14px', borderTop: `1px solid ${C_BDR}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '6px 18px', borderRadius: 4, cursor: 'pointer', fontSize: 12, background: 'transparent', border: `1px solid ${C_BDR}`, color: '#e2e8f0' }}>Cancel</button>
          <button onClick={commit} style={{ padding: '6px 18px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'var(--vscode-button-background, #0078d4)', color: '#fff' }}>Confirm</button>
        </div>
      </div>
    </div>);

};

// ─── Context menu state type ──────────────────────────────────────────────────

interface CtxMenuState {x: number;y: number;nodeId: string;nodeType: string;}

export const FBDCanvas: React.FC = () => {
  const fbdProgram = useLogicStoreSelector((s) => s.fbdProgram);
  const monitorMode = useLogicStoreSelector((s) => s.monitorMode);
  const tagDatabase = useLogicStoreSelector((s) => s.tagDatabase);

  const [nodes, setNodes, onNodesChange] = useNodesState(
    () => fbdProgram.nodes.map(storeNodeToFlow)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    () => storeWiresToFlow(fbdProgram.wires, fbdProgram.nodes)
  );

  const [forceMenu, setForceMenu] = useState<FBDForceMenu | null>(null);
  const [blockConfigId, setBlockConfigId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);

  const rfRef = useRef<ReactFlowInstance | null>(null);
  const prevRef = useRef(fbdProgram);

  // Sync from store on undo/redo (full rebuild when structure changes)
  useEffect(() => {
    if (fbdProgram === prevRef.current) return;
    prevRef.current = fbdProgram;
    setNodes(fbdProgram.nodes.map(storeNodeToFlow));
    setEdges(storeWiresToFlow(fbdProgram.wires, fbdProgram.nodes));
  }, [fbdProgram, setNodes, setEdges]);

  // Inject live/forced values into existing nodes on each scan tick without
  // replacing the whole array (which would reset ReactFlow position/selection state).
  useEffect(() => {
    if (monitorMode !== 'running') {
      // Clear all monitor data when stopped
      setNodes((ns) => ns.map((n) => {
        if (n.type === 'fbdVariable') {
          return { ...n, data: { ...n.data, _liveValue: undefined, _forcedValue: undefined, _monitorMode: 'stopped' } };
        }
        if (n.type === 'fbdBlock') {
          return { ...n, data: { ...n.data, _monitorMode: 'stopped', _pinValues: {} } };
        }
        return n;
      }));
      setEdges(storeWiresToFlow(fbdProgram.wires, fbdProgram.nodes));
      return;
    }
    const state = logicStore.getState();
    setNodes((ns) => ns.map((n) => {
      if (n.type === 'fbdVariable') {
        const tagName = (n.data as VarData).tagName;
        const tagEntry = state.tagDatabase.find((t) => t.name === tagName);
        return { ...n, data: { ...n.data, _forcedValue: tagEntry?.forcedValue, _liveValue: tagEntry?.liveValue, _monitorMode: 'running' } };
      }
      if (n.type === 'fbdBlock') {
        const storeNode = fbdProgram.nodes.find((sn) => sn.id === n.id);
        const instanceKey = storeNode?.instanceName ?? n.id;
        const blockPinVals = state.fbdBlockPinValues?.[instanceKey] ?? {};
        return { ...n, data: { ...n.data, _monitorMode: 'running', _pinValues: blockPinVals } };
      }
      return n;
    }));
    setEdges(storeWiresToFlow(fbdProgram.wires, fbdProgram.nodes));
  }, [tagDatabase, monitorMode, fbdProgram, setNodes, setEdges]);

  // Keyboard shortcuts: Ctrl+C copy, Ctrl+V paste, Ctrl+Z undo, Ctrl+Y redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selected = nodes.filter((n) => n.selected);
        if (selected.length) logicStore.copyFBDNodes(selected.map((n) => n.id));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        undoRedoStore.push();
        logicStore.pasteFBDNodes();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        undoRedoStore.undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.shiftKey && e.key === 'z')) {
        undoRedoStore.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nodes]);

  // ── isValidConnection ────────────────────────────────────────────────────────
  const isValidConnection: IsValidConnection = useCallback((conn) => {
    const state = logicStore.getState();
    const storeNodes = state.fbdProgram.nodes;
    const srcNode = storeNodes.find((n) => n.id === conn.source);
    const tgtNode = storeNodes.find((n) => n.id === conn.target);
    if (!srcNode || !tgtNode) return true;

    // Variable and structural nodes accept any type connection
    const structuralTypes = new Set<string>(['IN_VARIABLE', 'OUT_VARIABLE', 'INOUT_VARIABLE', 'CONNECTOR', 'CONTINUATION', 'COMMENT']);
    if (structuralTypes.has(srcNode.type) || structuralTypes.has(tgtNode.type)) return true;

    const srcPin = srcNode.outputs.find((p) => p.name === conn.sourceHandle);
    const tgtPin = tgtNode.inputs.find((p) => p.name === conn.targetHandle);
    if (!srcPin || !tgtPin) return true;

    const srcType = srcPin.dataType;
    const tgtType = tgtPin.dataType;

    if (srcType === tgtType) return true;

    // Numeric promotion: INT ↔ REAL allowed
    const numeric = new Set<string>(['INT', 'REAL']);
    if (numeric.has(srcType) && numeric.has(tgtType)) return true;

    // All other cross-type connections are blocked
    return false;
  }, []);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    changes.forEach((ch) => {
      if (ch.type === 'position' && ch.position && !ch.dragging)
      logicStore.updateFBDNode(ch.id, { position: ch.position });
      if (ch.type === 'dimensions' && ch.dimensions) {
        const n = logicStore.getState().fbdProgram.nodes.find((x) => x.id === ch.id);
        if (n?.type === 'COMMENT') logicStore.updateFBDNode(ch.id, { size: ch.dimensions });
      }
    });
  }, [onNodesChange]);

  // Wire drawn by dragging between handles
  const handleConnect = useCallback((conn: Connection) => {
    undoRedoStore.push();
    const wire: FBDWire = {
      id: `wire-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      from: { nodeId: conn.source!, pin: conn.sourceHandle! },
      to: { nodeId: conn.target!, pin: conn.targetHandle! }
    };
    logicStore.addFBDWire(wire);
    const storeNodes = logicStore.getState().fbdProgram.nodes;
    setEdges((eds) => addEdge({
      ...conn,
      id: wire.id,
      type: 'fbdWire',
      data: { _label: undefined, _energized: false },
      style: {}
    }, eds));
    // Recompute wire labels after adding
    setEdges(storeWiresToFlow(logicStore.getState().fbdProgram.wires, storeNodes));
  }, [setEdges]);

  const handleNodesDelete = useCallback((deleted: Node[]) => {
    undoRedoStore.push();
    deleted.forEach((n) => logicStore.deleteFBDNode(n.id));
  }, []);

  const handleEdgesDelete = useCallback((deleted: Edge[]) => {
    undoRedoStore.push();
    deleted.forEach((e) => logicStore.deleteFBDWire(e.id));
  }, []);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes);
    changes.forEach((ch) => {if (ch.type === 'remove') logicStore.deleteFBDWire(ch.id);});
  }, [onEdgesChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/plc-fbd-element') &&
    !e.dataTransfer.types.includes('application/plc-element')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!rfRef.current) return;

    let raw = e.dataTransfer.getData('application/plc-fbd-element');
    let blockType: FBDBlockType | null = null;

    if (raw?.startsWith('fbd-')) {
      blockType = raw.slice(4) as FBDBlockType;
    } else {
      raw = e.dataTransfer.getData('application/plc-element');
      if (raw?.startsWith('block-')) blockType = raw.slice(6) as FBDBlockType;
    }

    if (!blockType || !BLOCK_PIN_DEFS[blockType]) return;

    const position = rfRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    undoRedoStore.push();
    const newNode = createDefaultNode(blockType, position);
    logicStore.addFBDNode(newNode);
    setNodes((ns) => [...ns, storeNodeToFlow(newNode)]);
  }, [setNodes]);

  const handleNodeDoubleClick = useCallback((e: React.MouseEvent, node: Node) => {
    const storeNode = logicStore.getState().fbdProgram.nodes.find((n) => n.id === node.id);
    if (!storeNode) return;
    const isVar = storeNode.type === 'IN_VARIABLE' || storeNode.type === 'OUT_VARIABLE' || storeNode.type === 'INOUT_VARIABLE';
    const isStructural = storeNode.type === 'COMMENT' || storeNode.type === 'CONNECTOR' || storeNode.type === 'CONTINUATION';
    if (monitorMode === 'running' && isVar) {
      const tagName = storeNode.tag?.name ?? '';
      if (tagName) setForceMenu({ x: e.clientX, y: e.clientY, tagName });
    } else if (monitorMode !== 'running' && !isVar && !isStructural) {
      setBlockConfigId(node.id);
    }
  }, [monitorMode]);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    const storeNode = logicStore.getState().fbdProgram.nodes.find((n) => n.id === node.id);
    setCtxMenu({ x: e.clientX, y: e.clientY, nodeId: node.id, nodeType: storeNode?.type ?? '' });
  }, []);

  const handleInit = useCallback((instance: ReactFlowInstance) => {
    rfRef.current = instance;
  }, []);

  // ── Context menu renderer ─────────────────────────────────────────────────
  const renderCtxMenu = () => {
    if (!ctxMenu) return null;
    const storeNode = logicStore.getState().fbdProgram.nodes.find((n) => n.id === ctxMenu.nodeId);
    if (!storeNode) return null;

    const clipboardHasNodes = (logicStore.getState().clipboard.fbdNodes?.length ?? 0) > 0;

    const menuItemStyle: React.CSSProperties = {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '5px 14px', fontSize: 12, fontFamily: 'var(--vscode-font-family, sans-serif)',
      color: 'var(--vscode-menu-foreground, #cccccc)',
      cursor: 'pointer', userSelect: 'none', gap: 24, whiteSpace: 'nowrap',
      background: 'transparent'
    };
    const hintStyle: React.CSSProperties = {
      fontSize: 10, color: 'var(--vscode-descriptionForeground, #888)', flexShrink: 0
    };
    const sepStyle: React.CSSProperties = {
      height: 1, background: 'var(--vscode-menu-separatorBackground, #454545)', margin: '3px 0'
    };

    const doHover = (e: React.MouseEvent<HTMLDivElement>, on: boolean) => {
      (e.currentTarget as HTMLDivElement).style.background = on ?
      'var(--vscode-menu-selectionBackground, #094771)' :
      'transparent';
      (e.currentTarget as HTMLDivElement).style.color = on ?
      'var(--vscode-menu-selectionForeground, #ffffff)' :
      'var(--vscode-menu-foreground, #cccccc)';
    };

    const duplicate = () => {
      undoRedoStore.push();
      const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const cloned: FBDNode = {
        ...JSON.parse(JSON.stringify(storeNode)),
        id: `fbd-${storeNode.type.toLowerCase().replace(/_/g, '-')}-${uid}`,
        position: { x: storeNode.position.x + 40, y: storeNode.position.y + 40 },
        inputs: storeNode.inputs.map((p) => ({ ...p, id: `${p.id}-c` })),
        outputs: storeNode.outputs.map((p) => ({ ...p, id: `${p.id}-c` }))
      };
      logicStore.addFBDNode(cloned);
      setCtxMenu(null);
    };

    const deleteNode = () => {
      undoRedoStore.push();
      logicStore.deleteFBDNode(ctxMenu.nodeId);
      setCtxMenu(null);
    };

    const copyNode = () => {
      logicStore.copyFBDNodes([ctxMenu.nodeId]);
      setCtxMenu(null);
    };

    const pasteNodes = () => {
      undoRedoStore.push();
      logicStore.pasteFBDNodes();
      setCtxMenu(null);
    };

    const menuW = 200;
    const menuLeft = Math.min(ctxMenu.x, window.innerWidth - menuW - 8);
    const menuTop = Math.min(ctxMenu.y, window.innerHeight - 200);

    return (
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          position: 'fixed', top: menuTop, left: menuLeft, zIndex: 9999,
          background: 'var(--vscode-menu-background, #252526)',
          border: '1px solid var(--vscode-menu-border, #454545)',
          borderRadius: 4, padding: '4px 0', minWidth: menuW,
          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          fontFamily: 'var(--vscode-font-family, sans-serif)'
        }}>

        <div style={menuItemStyle}
        onMouseEnter={(e) => doHover(e, true)} onMouseLeave={(e) => doHover(e, false)}
        onClick={duplicate}>
          <span>Duplicate</span><span style={hintStyle}>⧉</span>
        </div>
        <div style={menuItemStyle}
        onMouseEnter={(e) => doHover(e, true)} onMouseLeave={(e) => doHover(e, false)}
        onClick={copyNode}>
          <span>Copy</span><span style={hintStyle}>Ctrl+C</span>
        </div>
        {clipboardHasNodes &&
        <div style={menuItemStyle}
        onMouseEnter={(e) => doHover(e, true)} onMouseLeave={(e) => doHover(e, false)}
        onClick={pasteNodes}>
            <span>Paste</span><span style={hintStyle}>Ctrl+V</span>
          </div>
        }
        <div style={sepStyle} />
        <div
          style={{ ...menuItemStyle, color: 'var(--vscode-errorForeground, #f38ba8)' }}
          onMouseEnter={(e) => doHover(e, true)} onMouseLeave={(e) => doHover(e, false)}
          onClick={deleteNode}>
          <span>Delete</span><span style={hintStyle}>Del</span>
        </div>
      </div>);

  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }} onDoubleClick={() => {}}>
      {forceMenu &&
      <FBDForcePopover
        menu={forceMenu}
        hasForcedValue={!!tagDatabase.find((t) => t.name === forceMenu.tagName)?.forcedValue}
        onClose={() => setForceMenu(null)} />

      }
      {blockConfigId &&
      <FBDBlockConfigModal nodeId={blockConfigId} onClose={() => setBlockConfigId(null)} />
      }
      {renderCtxMenu()}
      <style>{`
        /* Dark-theme Controls panel */
        .react-flow__controls {
          background: var(--vscode-sideBar-background, #252526) !important;
          border: 1px solid var(--vscode-editorGroup-border, #444) !important;
          border-radius: 4px !important; overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important;
        }
        .react-flow__controls-button {
          background: var(--vscode-sideBar-background, #252526) !important;
          border: none !important;
          border-bottom: 1px solid var(--vscode-editorGroup-border, #444) !important;
          width: 26px !important; height: 26px !important;
        }
        .react-flow__controls-button:last-child { border-bottom: none !important; }
        .react-flow__controls-button:hover { background: var(--vscode-list-hoverBackground, #2a2d2e) !important; }
        .react-flow__controls-button svg { fill: var(--vscode-foreground, #ccc) !important; max-width: 12px !important; max-height: 12px !important; }
        /* Default edge/wire color */
        .react-flow__edge-path { stroke: var(--vscode-editor-foreground, #ccc); }
        /* Live connection preview — dashed blue */
        .react-flow__connection-path { stroke: #60a5fa !important; stroke-width: 2 !important; stroke-dasharray: 5 4; }
        /* Handle hover glow so user can see connectable points */
        .react-flow__handle:hover, .react-flow__handle.connectingfrom, .react-flow__handle.valid { box-shadow: 0 0 0 5px rgba(96,165,250,0.35); cursor: crosshair; }
        .react-flow__handle.connectable { cursor: crosshair; }
        /* Invalid connection handle feedback */
        .react-flow__handle.invalid { background: #ef4444 !important; box-shadow: 0 0 0 4px rgba(239,68,68,0.25) !important; }
        /* Selection marquee */
        .react-flow__selection { background: rgba(96,165,250,0.08) !important; border: 1.5px dashed #60a5fa77 !important; }
      `}</style>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodesDelete={handleNodesDelete}
        onEdgesDelete={handleEdgesDelete}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onInit={handleInit}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={() => setCtxMenu(null)}
        isValidConnection={isValidConnection}
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode="Shift"
        selectionKeyCode="Shift"
        connectionRadius={20}
        snapToGrid
        snapGrid={[16, 16]}
        defaultViewport={{ x: 60, y: 60, zoom: 1 }}
        minZoom={0.1}
        maxZoom={4}
        style={{ width: '100%', height: '100%', background: 'var(--vscode-editor-background, #1e1e1e)' }}
        defaultEdgeOptions={{ type: 'fbdWire', style: {} }}
        proOptions={{ hideAttribution: true }}>

        <Background variant={BackgroundVariant.Dots} gap={16} size={1}
        color="var(--vscode-editorGroup-border, #3c3c3c)" />
        <Controls />
      </ReactFlow>
    </div>);

};