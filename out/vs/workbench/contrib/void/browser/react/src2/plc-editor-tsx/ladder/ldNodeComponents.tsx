/*
 * ldNodeComponents.tsx — Custom ReactFlow node components for Ladder Diagram.
 * ContactNode, CoilNode, BlockNode, PowerRailNode, PlaceholderNode.
 */

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { FB_PINS } from './LadderElementRenderer.js';
import type { FBType } from '../logicStore.js';

// ── Colors ────────────────────────────────────────────────────────────────────
const C_FG = 'var(--vscode-editor-foreground, #cccccc)';
const C_BG = 'var(--vscode-editor-background, #1e1e1e)';
const C_MUTED = 'var(--vscode-descriptionForeground, #999)';
const C_SEL = 'var(--vscode-focusBorder, #0078d4)';
const C_ENRG = 'var(--vscode-charts-green, #22c55e)';
const C_RAIL = 'var(--vscode-focusBorder, #0078d4)';

const COIL_LEFT = "M7 0 C0 7 0 21 7 28 C4 21 4 7 7 0 Z";
const COIL_RIGHT = "M27 0 C34 7 34 21 27 28 C30 21 30 7 27 0 Z";

const BLOCK_COLORS: Record<string, string> = {
  TON: '#a78bfa', TOF: '#a78bfa', TP: '#a78bfa',
  CTU: '#f472b6', CTD: '#f472b6', CTUD: '#f472b6',
  SR: '#fbbf24', RS: '#fbbf24',
  RTRIG: '#60a5fa', FTRIG: '#60a5fa'
};

// ── ContactNode ───────────────────────────────────────────────────────────────

export const ContactNode: React.FC<NodeProps> = ({ data, selected, id }: any) => {
  const stroke = data.energized ? C_ENRG : selected ? C_SEL : C_FG;

  return (
    <div
      onDoubleClick={() => data.onDoubleClick?.(id)}
      style={{
        width: 28, height: 28, position: 'relative', cursor: 'pointer', userSelect: 'none',
        outline: selected ? `2px solid ${C_SEL}` : 'none',
        outlineOffset: 3
      }}>

      <Handle type="target" position={Position.Left} id="input"
      style={{ opacity: 0, left: -4, top: 14, width: 8, height: 8, background: 'transparent', border: 'none' }} />
      <Handle type="source" position={Position.Right} id="output"
      style={{ opacity: 0, right: -4, top: 14, width: 8, height: 8, background: 'transparent', border: 'none' }} />

      {/* Tag label above */}
      <div style={{
        position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
        fontSize: 10, whiteSpace: 'nowrap', color: C_MUTED,
        fontFamily: 'monospace', pointerEvents: 'none'
      }}>{data.tagName || '???'}</div>

      {/* SVG glyph */}
      <svg width={28} height={28} viewBox="0 0 28 28" fill="none" style={{ display: 'block' }}>
        {/* Left bar */}
        <line x1="0.75" x2="0.75" y1="4" y2="24" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        {/* Right bar */}
        <line x1="27.25" x2="27.25" y1="4" y2="24" stroke={stroke} strokeWidth="2" strokeLinecap="round" />

        {/* NC diagonal slash */}
        {data.variant === 'negated' &&
        <line x1="5" y1="22" x2="23" y2="6" stroke="#0464FB" strokeWidth="1.5" />
        }
        {/* P rising edge */}
        {data.variant === 'risingEdge' &&
        <text x="14" y="18" textAnchor="middle" fontSize="11" fill="#0464FB"
        fontFamily="monospace" fontWeight="bold">P</text>
        }
        {/* N falling edge */}
        {data.variant === 'fallingEdge' &&
        <text x="14" y="18" textAnchor="middle" fontSize="11" fill="#0464FB"
        fontFamily="monospace" fontWeight="bold">N</text>
        }
      </svg>
    </div>);

};

// ── CoilNode ──────────────────────────────────────────────────────────────────

export const CoilNode: React.FC<NodeProps> = ({ data, selected, id }: any) => {
  const stroke = data.energized ? C_ENRG : selected ? C_SEL : C_FG;

  return (
    <div
      onDoubleClick={() => data.onDoubleClick?.(id)}
      style={{
        width: 34, height: 28, position: 'relative', cursor: 'pointer', userSelect: 'none',
        outline: selected ? `2px solid ${C_SEL}` : 'none',
        outlineOffset: 3
      }}>

      <Handle type="target" position={Position.Left} id="input"
      style={{ opacity: 0, left: -4, top: 14, width: 8, height: 8, background: 'transparent', border: 'none' }} />
      <Handle type="source" position={Position.Right} id="output"
      style={{ opacity: 0, right: -4, top: 14, width: 8, height: 8, background: 'transparent', border: 'none' }} />

      {/* Tag label above */}
      <div style={{
        position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
        fontSize: 10, whiteSpace: 'nowrap', color: C_MUTED,
        fontFamily: 'monospace', pointerEvents: 'none'
      }}>{data.tagName || '???'}</div>

      <svg width={34} height={28} viewBox="0 0 34 28" fill="none" style={{ display: 'block' }}>
        <path d={COIL_LEFT} fill={stroke} />
        <path d={COIL_RIGHT} fill={stroke} />

        {data.variant === 'set' &&
        <text x="17" y="17" textAnchor="middle" fontSize="10" fill="#0464FB" fontFamily="monospace" fontWeight="bold">S</text>
        }
        {data.variant === 'reset' &&
        <text x="17" y="17" textAnchor="middle" fontSize="10" fill="#0464FB" fontFamily="monospace" fontWeight="bold">R</text>
        }
        {data.variant === 'latch' &&
        <text x="17" y="17" textAnchor="middle" fontSize="10" fill="#0464FB" fontFamily="monospace" fontWeight="bold">L</text>
        }
        {data.variant === 'unlatch' &&
        <text x="17" y="17" textAnchor="middle" fontSize="10" fill="#0464FB" fontFamily="monospace" fontWeight="bold">U</text>
        }
        {data.variant === 'negated' &&
        <line x1="8" y1="22" x2="26" y2="6" stroke="#0464FB" strokeWidth="1.5" />
        }
        {data.variant === 'risingEdge' &&
        <text x="17" y="17" textAnchor="middle" fontSize="10" fill="#0464FB" fontFamily="monospace" fontWeight="bold">P</text>
        }
        {data.variant === 'fallingEdge' &&
        <text x="17" y="17" textAnchor="middle" fontSize="10" fill="#0464FB" fontFamily="monospace" fontWeight="bold">N</text>
        }
      </svg>
    </div>);

};

// ── BlockNode ─────────────────────────────────────────────────────────────────

export const BlockNode: React.FC<NodeProps> = ({ data, selected, id }: any) => {
  const fbType = data.fbType as FBType ?? 'TON';
  const color = BLOCK_COLORS[fbType] ?? '#94a3b8';
  const pins = FB_PINS[fbType] ?? { in: [], out: [] };
  const HDR_H = 24;
  const PIN_Y_START = 40;
  const PIN_STEP = 30;

  return (
    <div
      onDoubleClick={() => data.onDoubleClick?.(id)}
      style={{
        width: 160, height: 100, position: 'relative', cursor: 'pointer',
        background: C_BG,
        border: `1.5px solid ${color}88`,
        borderRadius: 4,
        userSelect: 'none',
        outline: selected ? `2px solid ${C_SEL}` : 'none',
        outlineOffset: 3,
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
      }}>

      {/* Input handles */}
      {pins.in.map((name: string, i: number) => {
        const connY = PIN_Y_START + i * PIN_STEP;
        return (
          <React.Fragment key={`in-${i}`}>
            <Handle
              type="target"
              position={Position.Left}
              id={`input-${i}`}
              style={{ opacity: 0, left: -4, top: connY, width: 8, height: 8, background: 'transparent', border: 'none' }} />

            {/* Pin label */}
            <div style={{
              position: 'absolute', left: 8, top: connY - 7,
              fontSize: 8, fontFamily: 'monospace', color: C_MUTED
            }}>{name}</div>
          </React.Fragment>);

      })}

      {/* Output handles */}
      {pins.out.map((name: string, i: number) => {
        const connY = PIN_Y_START + i * PIN_STEP;
        return (
          <React.Fragment key={`out-${i}`}>
            <Handle
              type="source"
              position={Position.Right}
              id={`output-${i}`}
              style={{ opacity: 0, right: -4, top: connY, width: 8, height: 8, background: 'transparent', border: 'none' }} />

            {/* Pin label */}
            <div style={{
              position: 'absolute', right: 8, top: connY - 7,
              fontSize: 8, fontFamily: 'monospace', color: C_MUTED,
              textAlign: 'right'
            }}>{name}</div>
          </React.Fragment>);

      })}

      {/* Main input/output handles for rung wire connection at BLOCK_H/2 = 50 */}
      <Handle type="target" position={Position.Left} id="input"
      style={{ opacity: 0, left: -4, top: 50, width: 8, height: 8, background: 'transparent', border: 'none' }} />
      <Handle type="source" position={Position.Right} id="output"
      style={{ opacity: 0, right: -4, top: 50, width: 8, height: 8, background: 'transparent', border: 'none' }} />

      {/* Header */}
      <div style={{
        height: HDR_H, width: '100%',
        background: `${color}22`,
        borderBottom: `1px solid ${color}44`,
        borderRadius: '3px 3px 0 0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color
      }}>
        {fbType}
      </div>

      {/* Instance name */}
      <div style={{
        fontSize: 9, fontFamily: 'monospace', color: C_MUTED,
        textAlign: 'center', padding: '3px 4px 0',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
      }}>
        {data.instanceName || '…'}
      </div>

      {/* Tag label above */}
      <div style={{
        position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
        fontSize: 10, whiteSpace: 'nowrap', color: C_MUTED,
        fontFamily: 'monospace', pointerEvents: 'none'
      }}>{data.instanceName || ''}</div>
    </div>);

};

// ── PowerRailNode ─────────────────────────────────────────────────────────────

export const PowerRailNode: React.FC<NodeProps> = ({ data }: any) => {
  const isLeft = data?.side === 'left';
  const railH = data?.railH ?? 180;
  const color = data?.energized ? C_ENRG : C_RAIL;
  return (
    <div style={{ width: 6, height: railH, position: 'relative' }}>
      <svg width={6} height={railH} viewBox={`0 0 6 ${railH}`} style={{ display: 'block' }}>
        <rect x={0} y={0} width={6} height={railH} fill={color} rx={1} />
      </svg>
      {isLeft ?
      <Handle type="source" position={Position.Right} id="output"
      style={{ opacity: 0, right: -4, top: 70, width: 8, height: 8, background: 'transparent', border: 'none' }} /> :
      <Handle type="target" position={Position.Left} id="input"
      style={{ opacity: 0, left: -4, top: 70, width: 8, height: 8, background: 'transparent', border: 'none' }} />
      }
    </div>);

};

// ── PlaceholderNode ───────────────────────────────────────────────────────────

export const PlaceholderNode: React.FC<NodeProps> = ({ selected }: any) => {
  return (
    <div style={{
      width: 10, height: 10, position: 'relative',
      cursor: 'pointer'
    }}>
      <svg width={10} height={10} viewBox="0 0 10 10">
        <polygon
          points="5,0 10,5 5,10 0,5"
          fill={selected ? C_SEL : 'transparent'}
          stroke={selected ? C_SEL : C_MUTED}
          strokeWidth={1} />

      </svg>
      <Handle type="target" position={Position.Left} id="input"
      style={{ opacity: 0, left: -3, top: 5, width: 4, height: 4, background: 'transparent', border: 'none' }} />
      <Handle type="source" position={Position.Right} id="output"
      style={{ opacity: 0, right: -3, top: 5, width: 4, height: 4, background: 'transparent', border: 'none' }} />
    </div>);

};

// ── Node type registry (exported for ReactFlow) ───────────────────────────────

import type { NodeTypes } from '@xyflow/react';

export const LD_NODE_TYPES: NodeTypes = {
  contact: ContactNode as any,
  coil: CoilNode as any,
  block: BlockNode as any,
  powerRail: PowerRailNode as any,
  placeholder: PlaceholderNode as any
};