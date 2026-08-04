import React, { useState } from 'react';
import { SFCTransition, logicStore } from '../logicStore.js';
import { undoRedoStore } from '../undoRedoStore.js';
import { DOT_R } from './SFCStepNode.js';

export const TRANS_W = 160; // hit area width — matches STEP_W so wires align
export const TRANS_BAR_W = 36; // visible horizontal bar
export const TRANS_BAR_H = 2;
export const TRANS_TOTAL_H = 32;

interface Props {
  transition: SFCTransition;
  selected: boolean;
  linking: boolean;
  hasError?: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onTopConnect: (e: React.MouseEvent) => void;
  onBottomConnect: (e: React.MouseEvent) => void;
}

export const SFCTransitionNode: React.FC<Props> = ({
  transition, selected, linking, hasError,
  onMouseDown, onContextMenu, onTopConnect, onBottomConnect
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(transition.condition);

  const barColor = transition.isTrue ? '#22c55e' :
  hasError ? '#ef4444' :
  selected ? '#60a5fa' :
  '#6b7280';

  const commit = () => {
    const v = draft.trim();
    if (v && v !== transition.condition) {undoRedoStore.push();logicStore.updateSFCTransition(transition.id, { condition: v });}
    setEditing(false);
  };

  const cx = TRANS_W / 2; // centre X of hit area
  const barL = cx - TRANS_BAR_W / 2; // bar left edge
  const wireY1 = 0; // wire from top
  const barY = (TRANS_TOTAL_H - TRANS_BAR_H) / 2;
  const wireY2 = TRANS_TOTAL_H; // wire to bottom

  const dotStyle = (at: 'top' | 'bottom'): React.CSSProperties => ({
    position: 'absolute',
    left: cx - DOT_R,
    top: at === 'top' ? -DOT_R : TRANS_TOTAL_H - DOT_R,
    width: DOT_R * 2, height: DOT_R * 2,
    borderRadius: '50%',
    background: linking ? '#60a5fa' : '#374151',
    border: `1.5px solid ${linking ? '#93c5fd' : '#4b5563'}`,
    cursor: 'crosshair', zIndex: 20,
    transition: 'background 0.1s',
    boxSizing: 'border-box'
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: transition.position.x,
        top: transition.position.y,
        width: TRANS_W,
        height: TRANS_TOTAL_H,
        cursor: 'move',
        userSelect: 'none',
        overflow: 'visible'
      }}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}>

      {/* IEC visual: vertical wire → bar → vertical wire */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}
        width={TRANS_W} height={TRANS_TOTAL_H}>

        {/* Vertical wire top half */}
        <line x1={cx} y1={wireY1} x2={cx} y2={barY}
        stroke={barColor} strokeWidth={1.5} strokeLinecap="round" />
        {/* Horizontal bar */}
        <line x1={barL} y1={barY + TRANS_BAR_H / 2} x2={barL + TRANS_BAR_W} y2={barY + TRANS_BAR_H / 2}
        stroke={barColor} strokeWidth={TRANS_BAR_H + 1} strokeLinecap="round" />
        {/* Vertical wire bottom half */}
        <line x1={cx} y1={barY + TRANS_BAR_H} x2={cx} y2={wireY2}
        stroke={barColor} strokeWidth={1.5} strokeLinecap="round" />
        {/* Selection highlight on bar */}
        {selected &&
        <rect x={barL - 3} y={barY - 3} width={TRANS_BAR_W + 6} height={TRANS_BAR_H + 6}
        fill="none" stroke="#60a5fa" strokeWidth={1} strokeDasharray="3 2" rx={1} />
        }
      </svg>

      {/* Condition text — to the right of the bar */}
      <div
        style={{
          position: 'absolute',
          left: barL + TRANS_BAR_W + 10,
          top: 0, bottom: 0,
          display: 'flex', alignItems: 'center',
          maxWidth: TRANS_W - barL - TRANS_BAR_W - 16,
          overflow: 'hidden'
        }}
        onDoubleClick={(e) => {e.stopPropagation();setEditing(true);setDraft(transition.condition);}}>

        {editing ?
        <input
          autoFocus value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {setDraft(transition.condition);setEditing(false);}
            e.stopPropagation();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 80, background: '#0f172a',
            border: '1px solid #60a5fa', borderRadius: 2, outline: 'none',
            color: '#e2e8f0', fontSize: 10, fontFamily: 'monospace',
            padding: '1px 4px'
          }} /> :


        <span
          title="Double-click to edit condition"
          style={{
            color: transition.isTrue ? '#22c55e' : '#94a3b8',
            fontSize: 10, fontFamily: 'monospace',
            cursor: 'text', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
          {transition.condition || 'TRUE'}</span>
        }
      </div>

      {/* Top connector dot */}
      <div style={dotStyle('top')}
      onClick={onTopConnect}
      onMouseDown={(e) => e.stopPropagation()}
      title="Connect wire (incoming)" />


      {/* Bottom connector dot */}
      <div style={dotStyle('bottom')}
      onClick={onBottomConnect}
      onMouseDown={(e) => e.stopPropagation()}
      title="Connect wire (outgoing)" />

    </div>);

};