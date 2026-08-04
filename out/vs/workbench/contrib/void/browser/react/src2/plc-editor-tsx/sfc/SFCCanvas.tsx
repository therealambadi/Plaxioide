/*
 * SFCCanvas — IEC 61131-3 §6.5 Sequential Function Chart editor.
 *
 * Architecture (three layers, see spec):
 *   1. INTERACTION: ReactFlow captures drag/connect events
 *   2. CONSTRAINT:  isValidConnection + onConnect enforce step↔transition alternation
 *   3. DATA:        logicStore is the single source of truth (SFCProgram)
 *
 * Node types (grey palette like FBD):
 *   sfcStep       — rectangular box, double-border for initial, action table below name
 *   sfcTransition — IEC horizontal bar with condition text to the right
 *
 * Elements come from the ELEMENTS panel in the left navigator sidebar.
 * MIME: 'application/plc-sfc-element' = 'sfc-step' | 'sfc-transition'
 *
 * Wiring:
 *   Drag from bottom handle of a node to top handle of another.
 *   Connection is rejected if it would violate step↔transition alternation.
 *   Snap-to-grid: 20px.
 *
 * IEC rules enforced live:
 *   - No direct step→step or transition→transition edges
 *   - Exactly one initial step
 *   - Transition condition must be non-empty
 *   - Unreachable steps flagged
 *
 * Context-menu (right-click a node):
 *   - Set as initial step
 *   - Add transition + step below (auto-wired)
 *   - Inject transition into an existing edge (drop onto wire)
 *   - Delete node
 *
 * Double-click step → SFCActionEditor modal
 * Double-click transition condition text → inline edit
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
  Panel } from
'@xyflow/react';
import type {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  NodeTypes,
  ReactFlowInstance,
  IsValidConnection,
  EdgeMouseHandler } from
'@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  SFCStep, SFCTransition, SFCLink, SFCAction, ActionQualifier, SFCLinkType, SFCJump, SFCProgram,
  logicStore, useLogicStoreSelector, TagEntry } from
'../logicStore.js';
import { undoRedoStore } from '../undoRedoStore.js';
import { SFCActionEditor } from './SFCActionEditor.js';

// ─── Layout & palette ─────────────────────────────────────────────────────────
const STEP_W = 160;
const STEP_H = 40; // header height
const ACTION_H = 22; // per-action row
const TRANS_W = 160; // same width → wires align on x+80
const TRANS_H = 40;

const SNAP: [number, number] = [20, 20];

// Grey colour palette matching FBD aesthetic
const C = {
  stepBorder: '#4b5563',
  stepBorderSel: '#60a5fa',
  stepBorderAct: '#22c55e',
  stepBorderErr: '#ef4444',
  stepBg: '#111827',
  stepHeaderBg: '#1f2937',
  actionBg: '#0f172a',
  actionQual: '#94a3b8',
  actionText: '#64748b',
  tranBar: '#6b7280',
  tranBarSel: '#60a5fa',
  tranBarAct: '#22c55e',
  condText: '#9ca3af',
  wire: '#374151',
  wireSel: '#60a5fa'
};

// ─── uid ──────────────────────────────────────────────────────────────────────
let _seq = 0;
const uid = () => `${Date.now()}-${(++_seq).toString(36)}`;

// ─── Node data shapes ─────────────────────────────────────────────────────────
interface StepData {step: SFCStep;}
interface TransData {transition: SFCTransition;}
interface DivergenceData {divId: string;type: 'selection' | 'simultaneous';branchCount: number;}
interface JumpData {jumpId: string;targetStepName: string;}

// ─── SFC Step node ────────────────────────────────────────────────────────────
// IEC §6.5.4.2: rectangular box. Initial step = double border.
// Action table: qualifier | variable | [duration]
const SFCStepNodeRF: React.FC<{data: StepData;selected?: boolean;}> = ({ data, selected }) => {
  const { step } = data;
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(step.name);
  const [showEditor, setShowEditor] = useState(false);

  // Sync name draft when step name changes externally
  useEffect(() => {setNameDraft(step.name);}, [step.name]);

  // Read monitor data for first action tag
  const monitorMode = useLogicStoreSelector((s) => s.monitorMode);
  const firstActionTagName = step.actions[0]?.tag.name;
  const tagEntry = useLogicStoreSelector((s) =>
  firstActionTagName ? s.tagDatabase.find((t) => t.name === firstActionTagName) : undefined
  );
  const forcedValue = tagEntry?.forcedValue;
  const liveValue = tagEntry?.liveValue;

  const totalH = STEP_H + step.actions.length * ACTION_H;

  const border = forcedValue === 'TRUE' ? '#80C000' :
  forcedValue === 'FALSE' ? '#4080FF' :
  step.isActive ? C.stepBorderAct :
  selected ? C.stepBorderSel :
  C.stepBorder;

  const commitName = () => {
    const v = nameDraft.trim();
    if (v && v !== step.name) {undoRedoStore.push();logicStore.updateSFCStep(step.id, { name: v });}
    setEditingName(false);
  };

  return (
    <>
      <div style={{
        width: STEP_W, height: totalH,
        background: C.stepBg,
        border: `1.5px solid ${border}`,
        borderRadius: 2,
        boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'monospace',
        userSelect: 'none',
        position: 'relative',
        boxShadow: step.isActive ? `0 0 10px ${C.stepBorderAct}44` : selected ? `0 0 0 1px ${border}33` : 'none'
      }}
      onDoubleClick={(e) => {e.stopPropagation();setShowEditor(true);}}>

        {/* IEC §6.5.4.2 double-border for initial step */}
        {step.isInitial &&
        <div style={{
          position: 'absolute', inset: 3,
          border: `1px solid ${border}55`,
          borderRadius: 1, pointerEvents: 'none', zIndex: 1
        }} />
        }

        {/* Step name header */}
        <div style={{
          height: STEP_H, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: C.stepHeaderBg,
          borderBottom: step.actions.length > 0 ? `1px solid #1e2a3a` : 'none',
          padding: '0 10px'
        }}>
          {editingName ?
          <input autoFocus value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName();
            if (e.key === 'Escape') {setNameDraft(step.name);setEditingName(false);}
            e.stopPropagation();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: '100%', textAlign: 'center', background: 'transparent',
            border: 'none', borderBottom: `1px solid ${C.stepBorderSel}`,
            outline: 'none', color: '#e2e8f0',
            fontSize: 12, fontWeight: 700, fontFamily: 'monospace'
          }} /> :


          <span
            onClick={(e) => {e.stopPropagation();setEditingName(true);setNameDraft(step.name);}}
            title={step.isInitial ? `${step.name} [INITIAL]` : step.name}
            style={{
              color: '#e2e8f0', fontSize: 12, fontWeight: 700,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: '100%', cursor: 'text',
              letterSpacing: 0.5
            }}>
            {step.name}</span>
          }
        </div>

        {/* IEC §6.5.6 Action table: qualifier | variable [duration] */}
        {step.actions.map((action, i) =>
        <div key={action.id} style={{
          display: 'grid', gridTemplateColumns: '24px 1fr',
          height: ACTION_H, flexShrink: 0,
          background: C.actionBg,
          borderBottom: i < step.actions.length - 1 ? '1px solid #1a2332' : 'none',
          overflow: 'hidden'
        }}>
            {/* Qualifier cell — single letter code */}
            <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRight: '1px solid #1e2a3a',
            fontSize: 8, fontWeight: 800, fontFamily: 'monospace',
            color: C.actionQual,
            background: '#1a2332',
            letterSpacing: 0.5
          }}>{action.qualifier}</div>
            {/* Variable + optional duration */}
            <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 6px', minWidth: 0, overflow: 'hidden'
          }}>
              <span style={{
              color: C.actionText, fontSize: 10,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>{action.tag.name}</span>
              {action.duration &&
            <span style={{
              color: '#2d3748', fontSize: 8, flexShrink: 0, marginLeft: 4
            }}>{action.duration}</span>
            }
            </div>
          </div>
        )}

        {/* Active indicator dot */}
        {step.isActive &&
        <div style={{
          position: 'absolute', top: 4, right: 6,
          width: 5, height: 5, borderRadius: '50%',
          background: C.stepBorderAct,
          boxShadow: `0 0 6px ${C.stepBorderAct}`,
          pointerEvents: 'none'
        }} />
        }

        {/* Force indicator badge */}
        {forcedValue !== undefined &&
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: 9, height: 9,
          background: '#f59e0b',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 6, fontWeight: 800, color: '#000',
          borderRadius: 2, zIndex: 10, pointerEvents: 'none',
          fontFamily: 'monospace'
        }}>F</div>
        }

        {/* Live value badge */}
        {monitorMode === 'running' && liveValue !== undefined &&
        <div style={{
          position: 'absolute', bottom: 2, left: 0, right: 0,
          textAlign: 'center',
          fontSize: 8, padding: '0 4px', borderRadius: 8,
          background: '#22c55e22', color: '#22c55e',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          fontFamily: 'monospace', pointerEvents: 'none'
        }}>
            {liveValue === 'true' || liveValue === 'TRUE' ? 'TRUE' :
          liveValue === 'false' || liveValue === 'FALSE' ? 'FALSE' :
          liveValue}
          </div>
        }
      </div>

      {/* ReactFlow connection handles — hidden visually, shown on hover via CSS */}
      <Handle type="target" position={Position.Top} id="top"
      style={{
        top: -4, left: '50%', transform: 'translateX(-50%)',
        width: 8, height: 8, borderRadius: '50%',
        background: '#374151', border: '1.5px solid #6b7280',
        cursor: 'crosshair'
      }} />

      <Handle type="source" position={Position.Bottom} id="bottom"
      style={{
        bottom: -4, left: '50%', transform: 'translateX(-50%)',
        width: 8, height: 8, borderRadius: '50%',
        background: '#374151', border: '1.5px solid #6b7280',
        cursor: 'crosshair'
      }} />


      {showEditor && <SFCActionEditor step={step} onClose={() => setShowEditor(false)} />}
    </>);

};

// ─── SFC Transition node ──────────────────────────────────────────────────────
// IEC §6.5.4.3: short horizontal bar bisecting the vertical flow.
// Condition expression shown to the right of the bar (click to edit).
const SFCTransitionNodeRF: React.FC<{data: TransData;selected?: boolean;}> = ({ data, selected }) => {
  const { transition } = data;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(transition.condition);

  useEffect(() => {setDraft(transition.condition);}, [transition.condition]);

  const barColor = transition.isTrue ? C.tranBarAct :
  selected ? C.tranBarSel :
  C.tranBar;

  const commit = () => {
    const v = draft.trim();
    if (v !== transition.condition) {
      undoRedoStore.push();
      logicStore.updateSFCTransition(transition.id, { condition: v || 'TRUE' });
    }
    setEditing(false);
  };

  const cx = TRANS_W / 2;
  const barW = 40;
  const barX = cx - barW / 2;
  const midY = TRANS_H / 2;

  return (
    <div style={{
      width: TRANS_W, height: TRANS_H,
      position: 'relative', userSelect: 'none',
      display: 'flex', alignItems: 'center',
      fontFamily: 'monospace'
    }}>
      {/* IEC visual: vertical wire segments + horizontal bar */}
      <svg width={TRANS_W} height={TRANS_H}
      style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}>
        {/* Wire above bar */}
        <line x1={cx} y1={0} x2={cx} y2={midY - 2}
        stroke={barColor} strokeWidth={1.5} strokeLinecap="round" />
        {/* Horizontal bar — the transition symbol */}
        <line x1={barX} y1={midY} x2={barX + barW} y2={midY}
        stroke={barColor} strokeWidth={3} strokeLinecap="round" />
        {/* Wire below bar */}
        <line x1={cx} y1={midY + 2} x2={cx} y2={TRANS_H}
        stroke={barColor} strokeWidth={1.5} strokeLinecap="round" />
        {/* Selection indicator */}
        {selected &&
        <rect x={barX - 4} y={midY - 5} width={barW + 8} height={10}
        fill="none" stroke={C.tranBarSel} strokeWidth={1} strokeDasharray="3 2" rx={1} />
        }
      </svg>

      {/* Condition text — right of bar, double-click to edit */}
      <div
        style={{
          position: 'absolute',
          left: barX + barW + 10,
          top: 0, height: TRANS_H,
          display: 'flex', alignItems: 'center',
          maxWidth: TRANS_W - barX - barW - 14,
          overflow: 'hidden'
        }}
        onDoubleClick={(e) => {e.stopPropagation();setEditing(true);}}>

        {editing ?
        <input autoFocus value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {setDraft(transition.condition);setEditing(false);}
          e.stopPropagation();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 100, background: '#0f172a',
          border: `1px solid ${C.tranBarSel}`, borderRadius: 2,
          outline: 'none', color: '#e2e8f0',
          fontSize: 10, fontFamily: 'monospace', padding: '1px 4px'
        }} /> :


        <span title="Double-click to edit condition" style={{
          color: transition.isTrue ? C.tranBarAct : C.condText,
          fontSize: 10, cursor: 'text',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          fontStyle: !transition.condition || transition.condition === 'TRUE' ? 'italic' : 'normal'
        }}>{transition.condition || 'TRUE'}</span>
        }
      </div>

      {/* ReactFlow handles */}
      <Handle type="target" position={Position.Top} id="top"
      style={{
        top: -4, left: '50%', transform: 'translateX(-50%)',
        width: 8, height: 8, borderRadius: '50%',
        background: '#374151', border: '1.5px solid #6b7280', cursor: 'crosshair'
      }} />

      <Handle type="source" position={Position.Bottom} id="bottom"
      style={{
        bottom: -4, left: '50%', transform: 'translateX(-50%)',
        width: 8, height: 8, borderRadius: '50%',
        background: '#374151', border: '1.5px solid #6b7280', cursor: 'crosshair'
      }} />

    </div>);

};

// ─── SFC Divergence/Convergence node ─────────────────────────────────────────
// IEC §6.5.6: selection divergence = single bar, simultaneous = double bar.
// This node represents either the diverging-fan-OUT (multiple outgoing flows) or
// converging-fan-IN (multiple incoming flows). The type determines bar rendering.
const DIVERG_W = 160;
const DIVERG_H = 24;

const SFCDivergenceNodeRF: React.FC<{data: DivergenceData;selected?: boolean;}> = ({ data, selected }) => {
  const { type } = data;
  const isSimultaneous = type === 'simultaneous';
  const barColor = selected ? C.tranBarSel : C.tranBar;
  const cx = DIVERG_W / 2;
  const midY = DIVERG_H / 2;

  return (
    <div style={{
      width: DIVERG_W, height: DIVERG_H,
      position: 'relative', userSelect: 'none',
      fontFamily: 'monospace'
    }}>
      <svg width={DIVERG_W} height={DIVERG_H}
      style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}>
        {/* Main horizontal bar */}
        <line x1={10} y1={midY} x2={DIVERG_W - 10} y2={midY}
        stroke={barColor} strokeWidth={isSimultaneous ? 2.5 : 1.5} strokeLinecap="round" />
        {/* Second bar for simultaneous (double-bar) */}
        {isSimultaneous &&
        <line x1={10} y1={midY + 4} x2={DIVERG_W - 10} y2={midY + 4}
        stroke={barColor} strokeWidth={2.5} strokeLinecap="round" />
        }
        {/* Selection indicator */}
        {selected &&
        <rect x={8} y={midY - 6} width={DIVERG_W - 16} height={isSimultaneous ? 16 : 12}
        fill="none" stroke={C.tranBarSel} strokeWidth={1} strokeDasharray="3 2" rx={1} />
        }
      </svg>

      {/* Label */}
      <div style={{
        position: 'absolute', right: 0, top: 0, height: DIVERG_H,
        display: 'flex', alignItems: 'center',
        fontSize: 8, fontFamily: 'monospace',
        color: '#374151', paddingRight: 4,
        pointerEvents: 'none', userSelect: 'none'
      }}>
        {isSimultaneous ? 'AND' : 'OR'}
      </div>

      {/* Handles — single top input, dynamic bottom outputs per branch */}
      <Handle type="target" position={Position.Top} id="top"
      style={{
        top: -4, left: '50%', transform: 'translateX(-50%)',
        width: 8, height: 8, borderRadius: '50%',
        background: '#374151', border: '1.5px solid #6b7280', cursor: 'crosshair'
      }} />

      {Array.from({ length: data.branchCount }, (_, i) => {
        const pct = data.branchCount === 1 ? 50 : 10 + 80 / (data.branchCount - 1) * i;
        return (
          <Handle key={i} type="source" position={Position.Bottom} id={`bottom-${i}`}
          style={{
            bottom: -4,
            left: `${pct}%`,
            transform: 'translateX(-50%)',
            width: 8, height: 8, borderRadius: '50%',
            background: '#374151', border: '1.5px solid #6b7280', cursor: 'crosshair'
          }} />);


      })}
    </div>);

};

// ─── SFC Convergence node ─────────────────────────────────────────────────────
// IEC §6.5.6: convergence bar is the mirror of divergence. Same visual, but
// has multiple target handles on top and a single source handle on bottom.
const SFCConvergenceNodeRF: React.FC<{data: DivergenceData;selected?: boolean;}> = ({ data, selected }) => {
  const { type } = data;
  const isSimultaneous = type === 'simultaneous';
  const barColor = selected ? C.tranBarSel : C.tranBar;
  const midY = DIVERG_H / 2;

  return (
    <div style={{
      width: DIVERG_W, height: DIVERG_H,
      position: 'relative', userSelect: 'none',
      fontFamily: 'monospace'
    }}>
      <svg width={DIVERG_W} height={DIVERG_H}
      style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}>
        <line x1={10} y1={midY} x2={DIVERG_W - 10} y2={midY}
        stroke={barColor} strokeWidth={isSimultaneous ? 2.5 : 1.5} strokeLinecap="round" />
        {isSimultaneous &&
        <line x1={10} y1={midY - 4} x2={DIVERG_W - 10} y2={midY - 4}
        stroke={barColor} strokeWidth={2.5} strokeLinecap="round" />
        }
        {selected &&
        <rect x={8} y={midY - 6} width={DIVERG_W - 16} height={isSimultaneous ? 16 : 12}
        fill="none" stroke={C.tranBarSel} strokeWidth={1} strokeDasharray="3 2" rx={1} />
        }
      </svg>

      {Array.from({ length: data.branchCount }, (_, i) => {
        const pct = data.branchCount === 1 ? 50 : 10 + 80 / (data.branchCount - 1) * i;
        return (
          <Handle key={i} type="target" position={Position.Top} id={`top-${i}`}
          style={{
            top: -4,
            left: `${pct}%`,
            transform: 'translateX(-50%)',
            width: 8, height: 8, borderRadius: '50%',
            background: '#374151', border: '1.5px solid #6b7280', cursor: 'crosshair'
          }} />);


      })}
      <Handle type="source" position={Position.Bottom} id="bottom"
      style={{
        bottom: -4, left: '50%', transform: 'translateX(-50%)',
        width: 8, height: 8, borderRadius: '50%',
        background: '#374151', border: '1.5px solid #6b7280', cursor: 'crosshair'
      }} />

    </div>);

};

// ─── SFC Jump-to-Step node ────────────────────────────────────────────────────
// IEC §6.5.7: arrow pointing to a step name, used to avoid drawing long return wires.
// Rendered as a downward arrow with step name label inside.
const JUMP_W = 100;
const JUMP_H = 36;

const SFCJumpNodeRF: React.FC<{data: JumpData;selected?: boolean;}> = ({ data, selected }) => {
  const { jumpId, targetStepName } = data;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(targetStepName);
  const borderColor = selected ? C.stepBorderSel : '#4b5563';

  useEffect(() => {setDraft(targetStepName);}, [targetStepName]);

  const commit = () => {
    const v = draft.trim();
    if (v && v !== targetStepName) {
      undoRedoStore.push();
      logicStore.updateSFCJump(jumpId, v);
    }
    setEditing(false);
  };

  return (
    <div style={{
      width: JUMP_W, height: JUMP_H,
      background: C.stepBg,
      border: `1.5px solid ${borderColor}`,
      borderRadius: 2,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', userSelect: 'none', position: 'relative'
    }}>
      {/* IEC jump arrow: a small downward chevron */}
      <svg width={14} height={10} style={{ display: 'block', marginBottom: 2, pointerEvents: 'none' }}>
        <polyline points="2,2 7,8 12,2" fill="none" stroke="#6b7280" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>

      {editing ?
      <input autoFocus value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {setDraft(targetStepName);setEditing(false);}
        e.stopPropagation();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        width: '80%', textAlign: 'center', background: 'transparent',
        border: 'none', borderBottom: `1px solid ${C.stepBorderSel}`,
        outline: 'none', color: '#60a5fa',
        fontSize: 10, fontFamily: 'monospace'
      }} /> :


      <span
        onDoubleClick={(e) => {e.stopPropagation();setEditing(true);}}
        title={`Jump to: ${targetStepName}`}
        style={{
          color: '#60a5fa', fontSize: 10, cursor: 'text',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: '90%'
        }}>
        {targetStepName || '?'}</span>
      }

      <Handle type="target" position={Position.Top} id="top"
      style={{
        top: -4, left: '50%', transform: 'translateX(-50%)',
        width: 8, height: 8, borderRadius: '50%',
        background: '#374151', border: '1.5px solid #6b7280', cursor: 'crosshair'
      }} />

    </div>);

};

// ─── Node type registry ───────────────────────────────────────────────────────
const NODE_TYPES: NodeTypes = {
  sfcStep: SFCStepNodeRF as any,
  sfcTransition: SFCTransitionNodeRF as any,
  sfcDivergence: SFCDivergenceNodeRF as any,
  sfcConvergence: SFCConvergenceNodeRF as any,
  sfcJump: SFCJumpNodeRF as any
};

// ─── Store ↔ ReactFlow conversion ────────────────────────────────────────────
function stepToNode(s: SFCStep): Node {
  return {
    id: s.id, type: 'sfcStep',
    position: s.position,
    data: { step: s } as StepData,
    style: { width: STEP_W, height: STEP_H + s.actions.length * ACTION_H }
  };
}

function transToNode(t: SFCTransition): Node {
  return {
    id: t.id, type: 'sfcTransition',
    position: t.position,
    data: { transition: t } as TransData,
    style: { width: TRANS_W, height: TRANS_H }
  };
}

// Divergence nodes are stored in SFCLink with type containing 'divergence' or 'convergence'.
// We synthesise ReactFlow nodes for visual rendering only — the link data is the source of truth.
// The id uses the link id with a '-div'/'-conv' suffix.
function divLinkToNode(l: SFCLink, allLinks: SFCLink[]): Node | null {
  const isDiverg = l.type.includes('divergence');
  const isConverg = l.type.includes('convergence');
  const isSimul = l.type.startsWith('simultaneous');
  if (!isDiverg && !isConverg) return null;

  // The bar node ID in links: for divergence it's l.to, for convergence it's l.from
  const barNodeIdInLinks = isDiverg ? l.to : l.from;

  // Only create one node per bar node id (first link creates it)
  const sameBarLinks = allLinks.filter((lk) =>
  lk.type === l.type && (isDiverg ? lk.to === barNodeIdInLinks : lk.from === barNodeIdInLinks)
  );
  if (sameBarLinks[0]?.id !== l.id) return null;

  // Count branches
  const branchCount = isDiverg ?
  Math.max(2, allLinks.filter((lk) => lk.from === barNodeIdInLinks).length) :
  Math.max(2, allLinks.filter((lk) => lk.to === barNodeIdInLinks).length);

  const rfNodeId = `${barNodeIdInLinks}-barnode`;
  const kind = isDiverg ? 'sfcDivergence' : 'sfcConvergence';
  return {
    id: rfNodeId,
    type: kind,
    position: l.barPosition ?? { x: 80, y: 80 },
    data: {
      divId: l.id,
      type: isSimul ? 'simultaneous' : 'selection',
      branchCount
    } as DivergenceData,
    style: { width: Math.max(DIVERG_W, branchCount * 80), height: DIVERG_H }
  };
}

function jumpToNode(j: SFCJump): Node {
  return {
    id: j.id, type: 'sfcJump',
    position: j.position,
    data: { jumpId: j.id, targetStepName: j.targetStepName } as JumpData,
    style: { width: JUMP_W, height: JUMP_H }
  };
}

const EDGE_STYLE = { stroke: C.wire, strokeWidth: 1.5 };
const EDGE_MARKER = { type: MarkerType.ArrowClosed, color: C.wire, width: 8, height: 8 };

function linkToEdge(l: SFCLink, allLinks: SFCLink[]): Edge {
  let sourceHandle = 'bottom';
  let targetHandle = 'top';

  const isFromDivBar = /^sfc-(simDiv|selDiv)-/.test(l.from);
  const isToConvBar = /^sfc-(simConv|selConv)-/.test(l.to);

  if (isFromDivBar) {
    const siblings = allLinks.filter((lk) => lk.from === l.from).sort((a, b) => a.id.localeCompare(b.id));
    const idx = siblings.findIndex((lk) => lk.id === l.id);
    sourceHandle = `bottom-${Math.max(0, idx)}`;
  }
  if (isToConvBar) {
    const siblings = allLinks.filter((lk) => lk.to === l.to).sort((a, b) => a.id.localeCompare(b.id));
    const idx = siblings.findIndex((lk) => lk.id === l.id);
    targetHandle = `top-${Math.max(0, idx)}`;
  }

  const sourceId = /^sfc-(simDiv|selDiv|simConv|selConv)-/.test(l.from) ? `${l.from}-barnode` : l.from;
  const targetId = /^sfc-(simDiv|selDiv|simConv|selConv)-/.test(l.to) ? `${l.to}-barnode` : l.to;

  return {
    id: l.id,
    source: sourceId,
    sourceHandle,
    target: targetId,
    targetHandle,
    type: 'straight',
    style: EDGE_STYLE,
    markerEnd: EDGE_MARKER
  };
}

// ─── IEC validation ───────────────────────────────────────────────────────────
function getIssues(sfc: {steps: SFCStep[];transitions: SFCTransition[];links: SFCLink[];jumps?: SFCJump[];}) {
  const out: {msg: string;sev: 'error' | 'warn';}[] = [];
  const inits = sfc.steps.filter((s) => s.isInitial);
  if (sfc.steps.length > 0 && inits.length === 0) out.push({ msg: 'No initial step defined (IEC §6.5.4.2)', sev: 'error' });
  if (inits.length > 1) out.push({ msg: `Multiple initial steps: ${inits.map((s) => s.name).join(', ')}`, sev: 'error' });
  sfc.links.forEach((l) => {
    if (sfc.steps.some((s) => s.id === l.from) && sfc.steps.some((s) => s.id === l.to))
    out.push({ msg: 'Direct Step→Step not allowed (IEC §6.5.4.3 requires Transition between)', sev: 'error' });
    if (sfc.transitions.some((t) => t.id === l.from) && sfc.transitions.some((t) => t.id === l.to))
    out.push({ msg: 'Direct Transition→Transition not allowed (IEC requires Step between)', sev: 'error' });
  });
  sfc.transitions.forEach((t) => {
    if (!t.condition?.trim()) out.push({ msg: `Transition has empty condition (IEC §6.5.4.3)`, sev: 'warn' });
  });
  // Validate jump targets reference existing step names
  (sfc.jumps ?? []).forEach((j) => {
    if (!j.targetStepName || j.targetStepName === '?') {
      out.push({ msg: 'Jump-to-step has no target name set', sev: 'warn' });
    } else if (!sfc.steps.some((s) => s.name === j.targetStepName)) {
      out.push({ msg: `Jump target "${j.targetStepName}" does not match any step`, sev: 'error' });
    }
  });
  // A step is reachable if it has an incoming link OR a jump points to it by name
  const jumpTargets = new Set((sfc.jumps ?? []).map((j) => j.targetStepName));
  sfc.steps.filter((s) => !s.isInitial).forEach((s) => {
    const hasIncomingLink = sfc.links.some((l) => l.to === s.id);
    const reachableByJump = jumpTargets.has(s.name);
    if (!hasIncomingLink && !reachableByJump)
    out.push({ msg: `Step "${s.name}" is unreachable (no incoming transition or jump)`, sev: 'warn' });
  });
  return out;
}

// ─── Context-menu ─────────────────────────────────────────────────────────────
interface CtxState {
  x: number;y: number;
  nodeId: string;nodeType: 'step' | 'transition';
}

const ContextMenu: React.FC<{
  ctx: CtxState;sfc: {steps: SFCStep[];transitions: SFCTransition[];links: SFCLink[];};
  onClose: () => void;
  onAddBelow: (id: string, type: 'step' | 'transition') => void;
  onSetInitial: (id: string) => void;
  onDelete: (id: string, type: 'step' | 'transition') => void;
}> = ({ ctx, sfc, onClose, onAddBelow, onSetInitial, onDelete }) => {
  const step = sfc.steps.find((s) => s.id === ctx.nodeId);
  const Btn = ({ label, danger, onClick }: {label: string;danger?: boolean;onClick: () => void;}) =>
  <button style={{
    display: 'block', width: '100%', textAlign: 'left', padding: '5px 14px',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: danger ? '#fca5a5' : '#d1d5db', fontSize: 11, fontFamily: 'monospace'
  }}
  onMouseEnter={(e) => e.currentTarget.style.background = '#1e3a5f'}
  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
  onClick={onClick}>
    {label}</button>;

  return (
    <div style={{
      position: 'fixed', left: ctx.x, top: ctx.y, zIndex: 9999,
      background: '#111827', border: '1px solid #374151',
      borderRadius: 4, padding: '4px 0', minWidth: 220,
      boxShadow: '0 8px 32px rgba(0,0,0,0.7)', fontFamily: 'monospace'
    }}
    onMouseDown={(e) => e.stopPropagation()}
    onContextMenu={(e) => e.preventDefault()}>

      {ctx.nodeType === 'step' && step &&
      <Btn label={step.isInitial ? '✓ Initial step (unset)' : 'Set as initial step'}
      onClick={() => {onSetInitial(ctx.nodeId);onClose();}} />
      }
      <Btn label={`Add ${ctx.nodeType === 'step' ? 'Transition' : 'Step'} below (auto-wire)`}
      onClick={() => {onAddBelow(ctx.nodeId, ctx.nodeType);onClose();}} />
      <div style={{ height: 1, background: '#1f2937', margin: '3px 0' }} />
      <Btn label="Double-click to edit actions" danger={false}
      onClick={onClose} />
      <div style={{ height: 1, background: '#1f2937', margin: '3px 0' }} />
      <Btn label="Delete" danger
      onClick={() => {onDelete(ctx.nodeId, ctx.nodeType);onClose();}} />
    </div>);

};

// ─── Force Popover (inline) ───────────────────────────────────────────────────

interface SFCForceMenu {x: number;y: number;tagName: string;}

const SFCForcePopover: React.FC<{
  menu: SFCForceMenu;
  hasForcedValue: boolean;
  onClose: () => void;
}> = ({ menu, hasForcedValue, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
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
    color: '#d1d5db', fontSize: 11, fontFamily: 'monospace'
  };

  return (
    <div ref={ref} style={{
      position: 'fixed',
      left: Math.min(menu.x + 8, window.innerWidth - 200),
      top: Math.min(menu.y - 10, window.innerHeight - 150),
      zIndex: 9999,
      background: '#111827', border: '1px solid #374151',
      borderRadius: 4, padding: '4px 0', minWidth: 160,
      boxShadow: '0 8px 24px rgba(0,0,0,0.7)'
    }} onMouseDown={(e) => e.stopPropagation()}>
      <div style={{ padding: '4px 14px 6px', fontSize: 9, fontFamily: 'monospace', color: '#6b7280', borderBottom: '1px solid #1f2937', marginBottom: 2 }}>
        {menu.tagName || '—'}
      </div>
      <button style={{ ...btnStyle, color: '#80C000' }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#1e3a1e'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      onClick={() => {logicStore.forceTag(menu.tagName, 'TRUE');onClose();}}>Force TRUE</button>
      <button style={{ ...btnStyle, color: '#4080FF' }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#1e1e3a'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      onClick={() => {logicStore.forceTag(menu.tagName, 'FALSE');onClose();}}>Force FALSE</button>
      {hasForcedValue &&
      <button style={{ ...btnStyle, color: '#f59e0b' }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#1e1a0e'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      onClick={() => {logicStore.releaseForce(menu.tagName);onClose();}}>Release Force</button>
      }
    </div>);

};

// ─── Branch layout helper ─────────────────────────────────────────────────────
function layoutSFCBranches(sfc: SFCProgram): Map<string, {x: number;y: number;}> {
  const overrides = new Map<string, {x: number;y: number;}>();
  const COL_W = 200;
  const ROW_H = 120;

  for (const branch of sfc.branches) {
    const numBranches = branch.branchStepIds.length;
    const divTrans = (sfc.transitions as any[]).find((t) => t.id === branch.divergingFromTransId) ||
    (sfc.steps as any[]).find((s) => s.id === branch.divergingFromTransId);
    if (!divTrans) continue;

    const baseX = divTrans.position.x - (numBranches - 1) * COL_W / 2;
    const baseY = divTrans.position.y + ROW_H;

    branch.branchStepIds.forEach((stepIds, colIdx) => {
      stepIds.forEach((stepId, rowIdx) => {
        overrides.set(stepId, { x: baseX + colIdx * COL_W, y: baseY + rowIdx * ROW_H });
      });
    });
  }
  return overrides;
}

// ─── Inner canvas (needs ReactFlow context) ───────────────────────────────────
const SFCInner: React.FC = () => {
  const sfc = useLogicStoreSelector((s) => s.sfcProgram);
  const monitorMode = useLogicStoreSelector((s) => s.monitorMode);
  const tagDatabase = useLogicStoreSelector((s) => s.tagDatabase);
  const rfRef = useRef<ReactFlowInstance | null>(null);
  const prevSfc = useRef(sfc);

  const allNodesToFlow = (s: typeof sfc) => {
    const branchOverrides = layoutSFCBranches(s);
    return [
    ...s.steps.map((step) => {
      const override = branchOverrides.get(step.id);
      return stepToNode(override ? { ...step, position: override } : step);
    }),
    ...s.transitions.map(transToNode),
    ...(s.links ?? []).flatMap((l) => {
      const n = divLinkToNode(l, s.links);
      return n ? [n] : [];
    }),
    ...(s.jumps ?? []).map(jumpToNode)];

  };

  const [nodes, setNodes, onNodesChange] = useNodesState(() => allNodesToFlow(sfc));
  const [edges, setEdges, onEdgesChange] = useEdgesState(() =>
  sfc.links.map((l) => linkToEdge(l, sfc.links))
  );

  const [ctxMenu, setCtxMenu] = useState<CtxState | null>(null);
  const [forceMenu, setForceMenu] = useState<SFCForceMenu | null>(null);

  // Sync from store on undo/redo
  useEffect(() => {
    if (sfc === prevSfc.current) return;
    prevSfc.current = sfc;
    setNodes(allNodesToFlow(sfc));
    setEdges(sfc.links.map((l) => linkToEdge(l, sfc.links)));
  }, [sfc, setNodes, setEdges]);

  // Propagate node position changes back to store
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    changes.forEach((ch) => {
      if (ch.type === 'position' && ch.position && !ch.dragging) {
        if (sfc.steps.some((s) => s.id === ch.id)) {
          logicStore.updateSFCStep(ch.id, { position: ch.position });
        } else if (sfc.transitions.some((t) => t.id === ch.id)) {
          logicStore.updateSFCTransition(ch.id, { position: ch.position });
        } else if ((sfc.jumps ?? []).some((j) => j.id === ch.id)) {
          logicStore.updateSFCJumpPosition(ch.id, ch.position);
        } else if (ch.id.endsWith('-barnode')) {
          // Update the backing link's barPosition
          const linkId = ch.id.slice(0, -'-barnode'.length);
          logicStore.updateSFCLinkBarPosition(linkId, ch.position);
        }
      }
    });
  }, [onNodesChange, sfc]);

  // CONSTRAINT LAYER: enforce step↔transition alternation (IEC §6.5.4.3)
  // Extended rules for divergence/convergence bars and jump nodes:
  //   step      → transition    ✓  (linear chain)
  //   transition → step         ✓  (linear chain)
  //   step      → divergence    ✓  (divergence fan-out)
  //   divergence → step         ✓  (divergence fan-out branches)
  //   step      → convergence   ✓  (convergence fan-in branches)
  //   convergence → transition  ✓  (convergence fan-in → transition)
  //   transition → jump         ✓  (loop back)
  //   step      → jump          ✓  (direct loop back from step — unusual but valid)
  const isValidConnection: IsValidConnection = useCallback((conn) => {
    const srcIsStep = sfc.steps.some((s) => s.id === conn.source);
    const tgtIsStep = sfc.steps.some((s) => s.id === conn.target);
    const srcIsTrans = sfc.transitions.some((t) => t.id === conn.source);
    const tgtIsTrans = sfc.transitions.some((t) => t.id === conn.target);
    const srcIsDiv = conn.source?.endsWith('-barnode') && sfc.links.some((l) => `${l.id}-barnode` === conn.source && l.type.includes('divergence'));
    const tgtIsDiv = conn.target?.endsWith('-barnode') && sfc.links.some((l) => `${l.id}-barnode` === conn.target && l.type.includes('divergence'));
    const srcIsConv = conn.source?.endsWith('-barnode') && sfc.links.some((l) => `${l.id}-barnode` === conn.source && l.type.includes('convergence'));
    const tgtIsConv = conn.target?.endsWith('-barnode') && sfc.links.some((l) => `${l.id}-barnode` === conn.target && l.type.includes('convergence'));
    const tgtIsJump = (sfc.jumps ?? []).some((j) => j.id === conn.target);

    if (srcIsStep && tgtIsTrans) return true;
    if (srcIsTrans && tgtIsStep) return true;
    if (srcIsStep && tgtIsDiv) return true; // step feeds into divergence bar
    if (srcIsDiv && tgtIsStep) return true; // divergence bar fans to steps
    if (srcIsStep && tgtIsConv) return true; // steps converge into convergence bar
    if (srcIsConv && tgtIsTrans) return true; // convergence bar exits to transition
    if (srcIsTrans && tgtIsJump) return true; // transition → jump
    if (srcIsStep && tgtIsJump) return true; // step → jump (optional loop shortcut)
    return false;
  }, [sfc]);

  const handleConnect = useCallback((conn: Connection) => {
    undoRedoStore.push();
    const link: SFCLink = { id: `link-${uid()}`, from: conn.source!, to: conn.target!, type: 'simple' };
    logicStore.addSFCLink(link);
    setEdges((eds) => addEdge({
      ...conn, id: link.id, type: 'straight',
      style: EDGE_STYLE, markerEnd: EDGE_MARKER
    }, eds));
  }, [setEdges]);

  const handleNodesDelete = useCallback((deleted: Node[]) => {
    undoRedoStore.push();
    deleted.forEach((n) => {
      if (sfc.steps.some((s) => s.id === n.id))
      logicStore.deleteSFCStep(n.id);else
      if (sfc.transitions.some((t) => t.id === n.id))
      logicStore.deleteSFCTransition(n.id);else
      if ((sfc.jumps ?? []).some((j) => j.id === n.id))
      logicStore.deleteSFCJump(n.id);else
      if (n.id.endsWith('-barnode')) {
        // Delete the backing divergence/convergence link
        const linkId = n.id.slice(0, -'-barnode'.length);
        logicStore.deleteSFCLink(linkId);
      }
    });
  }, [sfc]);

  const handleEdgesDelete = useCallback((deleted: Edge[]) => {
    undoRedoStore.push();
    deleted.forEach((e) => logicStore.deleteSFCLink(e.id));
  }, []);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes);
    changes.forEach((ch) => {if (ch.type === 'remove') logicStore.deleteSFCLink(ch.id);});
  }, [onEdgesChange]);

  // Drop from navigator palette
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/plc-sfc-element')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!rfRef.current) return;
    const raw = e.dataTransfer.getData('application/plc-sfc-element');
    if (!raw) return;
    const pos = rfRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    // Snap to grid
    const snapped = { x: Math.round(pos.x / 20) * 20, y: Math.round(pos.y / 20) * 20 };
    undoRedoStore.push();
    if (raw === 'sfc-step') {
      const step: SFCStep = {
        id: `step-${uid()}`, name: `Step${sfc.steps.length + 1}`,
        isInitial: sfc.steps.length === 0, actions: [], position: snapped
      };
      logicStore.addSFCStep(step);
      setNodes((ns) => [...ns, stepToNode(step)]);
    } else if (raw === 'sfc-transition') {
      const trans: SFCTransition = { id: `trans-${uid()}`, condition: 'TRUE', position: snapped };
      logicStore.addSFCTransition(trans);
      setNodes((ns) => [...ns, transToNode(trans)]);
    } else if (raw === 'sfc-selection-divergence' || raw === 'sfc-simultaneous-divergence') {
      const isSimul = raw.startsWith('sfc-simultaneous');
      const linkId = `divlink-${uid()}`;
      const link: SFCLink = {
        id: linkId,
        from: '', to: '', // wired manually after drop
        type: isSimul ? 'simultaneous-divergence' : 'selection-divergence',
        barPosition: snapped
      };
      logicStore.addSFCLink(link);
      const barNode = divLinkToNode(link, [link]);
      if (barNode) setNodes((ns) => [...ns, barNode]);
    } else if (raw === 'sfc-selection-convergence' || raw === 'sfc-simultaneous-convergence') {
      const isSimul = raw.startsWith('sfc-simultaneous');
      const linkId = `convlink-${uid()}`;
      const link: SFCLink = {
        id: linkId,
        from: '', to: '',
        type: isSimul ? 'simultaneous-convergence' : 'selection-convergence',
        barPosition: snapped
      };
      logicStore.addSFCLink(link);
      const barNode = divLinkToNode(link, [link]);
      if (barNode) setNodes((ns) => [...ns, barNode]);
    } else if (raw === 'sfc-jump') {
      const jump: SFCJump = { id: `jump-${uid()}`, targetStepName: '?', position: snapped };
      logicStore.addSFCJump(jump);
      setNodes((ns) => [...ns, jumpToNode(jump)]);
    }
  }, [sfc, setNodes]);

  // Node context menu — only for step/transition; jumps/bar-nodes have no extra menu
  const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    if (sfc.steps.some((s) => s.id === node.id)) {
      setCtxMenu({ x: e.clientX, y: e.clientY, nodeId: node.id, nodeType: 'step' });
    } else if (sfc.transitions.some((t) => t.id === node.id)) {
      setCtxMenu({ x: e.clientX, y: e.clientY, nodeId: node.id, nodeType: 'transition' });
    }
  }, [sfc]);

  // Context-menu: add below
  const ctxAddBelow = useCallback((targetId: string, targetType: 'step' | 'transition') => {
    const target = targetType === 'step' ?
    sfc.steps.find((s) => s.id === targetId) :
    sfc.transitions.find((t) => t.id === targetId);
    if (!target) return;
    const h = targetType === 'step' ?
    STEP_H + (sfc.steps.find((s) => s.id === targetId)?.actions.length ?? 0) * ACTION_H :
    TRANS_H;
    const newPos = { x: Math.round(target.position.x / 20) * 20, y: Math.round((target.position.y + h + 60) / 20) * 20 };
    undoRedoStore.push();
    if (targetType === 'step') {
      const tid = `trans-${uid()}`;
      const trans: SFCTransition = { id: tid, condition: 'TRUE', position: newPos };
      logicStore.addSFCTransition(trans);
      logicStore.addSFCLink({ id: `link-${uid()}`, from: targetId, to: tid, type: 'simple' });
      setNodes((ns) => [...ns, transToNode(trans)]);
      setEdges((eds) => {const lnk = { id: `link-${uid()}`, from: targetId, to: tid, type: 'simple' as const };return [...eds, linkToEdge(lnk, [...sfc.links, lnk])];});
    } else {
      const sid = `step-${uid()}`;
      const step: SFCStep = { id: sid, name: `Step${sfc.steps.length + 1}`, isInitial: false, actions: [], position: newPos };
      logicStore.addSFCStep(step);
      logicStore.addSFCLink({ id: `link-${uid()}`, from: targetId, to: sid, type: 'simple' });
      setNodes((ns) => [...ns, stepToNode(step)]);
      setEdges((eds) => {const lnk = { id: `link-${uid()}`, from: targetId, to: sid, type: 'simple' as const };return [...eds, linkToEdge(lnk, [...sfc.links, lnk])];});
    }
  }, [sfc, setNodes, setEdges]);

  // Context-menu: set initial
  const ctxSetInitial = useCallback((stepId: string) => {
    undoRedoStore.push();
    sfc.steps.forEach((s) => {if (s.isInitial) logicStore.updateSFCStep(s.id, { isInitial: false });});
    logicStore.updateSFCStep(stepId, { isInitial: true });
  }, [sfc]);

  // Context-menu: delete
  const ctxDelete = useCallback((id: string, type: 'step' | 'transition') => {
    undoRedoStore.push();
    if (type === 'step') logicStore.deleteSFCStep(id);else
    logicStore.deleteSFCTransition(id);
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [setNodes, setEdges]);

  const handleNodeDoubleClick = useCallback((e: React.MouseEvent, node: Node) => {
    if (monitorMode !== 'running') return; // edit mode (stopped) is handled inside node components via onDoubleClick
    const step = sfc.steps.find((s) => s.id === node.id);
    if (step) {
      // force on the first action's tag, if any
      const tagName = step.actions[0]?.tag.name ?? step.name;
      setForceMenu({ x: e.clientX, y: e.clientY, tagName });
      return;
    }
    const transition = sfc.transitions.find((t) => t.id === node.id);
    if (transition) {
      // Only open force popover if the condition is a simple tag name (not a complex expression)
      const cond = transition.condition?.trim() ?? '';
      const isSimpleTag = /^[A-Za-z_][A-Za-z0-9_.]*$/.test(cond);
      if (isSimpleTag && cond) {
        setForceMenu({ x: e.clientX, y: e.clientY, tagName: cond });
      }
    }
  }, [monitorMode, sfc, tagDatabase]);

  const issues = getIssues(sfc);
  const hasErr = issues.some((i) => i.sev === 'error');

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <style>{`
        /* Dark Controls panel */
        .react-flow__controls {
          background: #111827 !important;
          border: 1px solid #374151 !important;
          border-radius: 4px !important; overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5) !important;
        }
        .react-flow__controls-button {
          background: #111827 !important; border: none !important;
          border-bottom: 1px solid #1f2937 !important;
          width: 26px !important; height: 26px !important;
        }
        .react-flow__controls-button:last-child { border-bottom: none !important; }
        .react-flow__controls-button:hover { background: #1f2937 !important; }
        .react-flow__controls-button svg { fill: #9ca3af !important; max-width: 12px !important; max-height: 12px !important; }
        /* Live connection preview */
        .react-flow__connection-path { stroke: #60a5fa !important; stroke-width: 1.5 !important; stroke-dasharray: 6 3; }
        /* Handle hover */
        .react-flow__handle { transition: box-shadow 0.1s, background 0.1s !important; }
        .react-flow__handle:hover,
        .react-flow__handle.connectingfrom,
        .react-flow__handle.valid {
          box-shadow: 0 0 0 4px rgba(96,165,250,0.25) !important;
          background: #60a5fa !important; opacity: 1 !important;
          cursor: crosshair !important;
        }
        .react-flow__handle.invalid { background: #ef4444 !important; }
        /* Edge selection */
        .react-flow__edge.selected .react-flow__edge-path { stroke: #60a5fa !important; stroke-width: 2 !important; }
        /* Selection rect */
        .react-flow__selection { background: rgba(96,165,250,0.04) !important; border: 1px dashed #60a5fa55 !important; }
        /* Node selection ring */
        .react-flow__node.selected > div { box-shadow: 0 0 0 1px #60a5fa66 !important; }
      `}</style>

      <ReactFlow
        nodes={nodes} edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodesDelete={handleNodesDelete}
        onEdgesDelete={handleEdgesDelete}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onInit={(inst) => {rfRef.current = inst;}}
        isValidConnection={isValidConnection}
        onNodeContextMenu={handleNodeContextMenu}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={() => {setCtxMenu(null);setForceMenu(null);}}
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode="Shift"
        selectionKeyCode="Shift"
        connectionRadius={24}
        snapToGrid snapGrid={SNAP}
        defaultViewport={{ x: 100, y: 40, zoom: 1 }}
        minZoom={0.1} maxZoom={4}
        style={{ width: '100%', height: '100%', background: 'var(--vscode-editor-background, #0d1117)' }}
        defaultEdgeOptions={{ type: 'straight', style: EDGE_STYLE, markerEnd: EDGE_MARKER }}
        proOptions={{ hideAttribution: true }}>

        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1f2937" />
        <Controls />

        {/* IEC legend */}
        <Panel position="top-right">
          <div style={{
            background: '#111827', border: '1px solid #1f2937',
            borderRadius: 4, padding: '6px 10px',
            fontSize: 9, fontFamily: 'monospace', color: '#4b5563',
            lineHeight: 1.8, userSelect: 'none'
          }}>
            <div style={{ color: '#6b7280', marginBottom: 3, fontWeight: 700, letterSpacing: 1 }}>SFC ELEMENTS</div>
            <div>□□ double border = initial step</div>
            <div>—— single bar = transition / OR-branch</div>
            <div>══ double bar = simultaneous (AND)</div>
            <div>↓ arrow = jump-to-step</div>
            <div>N·S·R·L·D·P = action qualifiers</div>
            <div style={{ marginTop: 3, color: '#374151' }}>Drag from panel · Del = delete</div>
          </div>
        </Panel>
      </ReactFlow>

      {/* Validation bar */}
      {issues.length > 0 &&
      <div style={{
        position: 'absolute', bottom: 10, left: 10, right: 50, zIndex: 10,
        background: hasErr ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.08)',
        border: `1px solid ${hasErr ? '#ef4444' : '#f59e0b'}`,
        borderRadius: 4, padding: '3px 10px',
        fontSize: 10, fontFamily: 'monospace',
        color: hasErr ? '#fca5a5' : '#fde68a',
        pointerEvents: 'none'
      }}>
          {issues[0].msg}{issues.length > 1 ? ` · +${issues.length - 1} more` : ''}
        </div>
      }

      {/* Force popover */}
      {forceMenu &&
      <SFCForcePopover
        menu={forceMenu}
        hasForcedValue={!!tagDatabase.find((t) => t.name === forceMenu.tagName)?.forcedValue}
        onClose={() => setForceMenu(null)} />

      }

      {/* Context menu */}
      {ctxMenu &&
      <ContextMenu
        ctx={ctxMenu} sfc={sfc}
        onClose={() => setCtxMenu(null)}
        onAddBelow={ctxAddBelow}
        onSetInitial={ctxSetInitial}
        onDelete={ctxDelete} />

      }
    </div>);

};

// ─── Public export (wrapped in ReactFlowProvider) ─────────────────────────────
export const SFCCanvas: React.FC = () =>
<ReactFlowProvider>
    <SFCInner />
  </ReactFlowProvider>;