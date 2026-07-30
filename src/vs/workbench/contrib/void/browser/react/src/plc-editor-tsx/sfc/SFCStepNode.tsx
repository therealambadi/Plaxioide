import React, { useState } from 'react';
import { SFCStep, logicStore } from '../logicStore.js';
import { SFCActionEditor } from './SFCActionEditor.js';
import { undoRedoStore } from '../undoRedoStore.js';

export const STEP_W   = 160;  // wide enough for action rows
export const STEP_H   = 40;   // header height
export const ACTION_H = 22;   // per-action row
const INSET  = 4;    // double-border inset for initial step
export const DOT_R = 4;      // connector dot radius (exported so Canvas can match wire endpoints)

interface Props {
  step:            SFCStep;
  selected:        boolean;
  linking:         boolean;
  hasError?:       boolean;
  onMouseDown:     (e: React.MouseEvent) => void;
  onContextMenu:   (e: React.MouseEvent) => void;
  onTopConnect:    (e: React.MouseEvent) => void;
  onBottomConnect: (e: React.MouseEvent) => void;
}

export const SFCStepNode: React.FC<Props> = ({
  step, selected, linking, hasError,
  onMouseDown, onContextMenu, onTopConnect, onBottomConnect,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft,   setNameDraft]   = useState(step.name);
  const [showEditor,  setShowEditor]  = useState(false);

  const totalH = STEP_H + step.actions.length * ACTION_H;

  const borderColor = step.isActive ? '#22c55e'
    : hasError   ? '#ef4444'
    : selected   ? '#60a5fa'
    : '#6b7280';

  const bg = step.isActive ? 'rgba(34,197,94,0.06)' : '#1e1e2e';

  const commitName = () => {
    const v = nameDraft.trim();
    if (v && v !== step.name) { undoRedoStore.push(); logicStore.updateSFCStep(step.id, { name: v }); }
    setEditingName(false);
  };

  // Dot style — sits exactly on the node border edge (half inside, half outside)
  const dotStyle = (at: 'top' | 'bottom'): React.CSSProperties => ({
    position: 'absolute',
    left: STEP_W / 2 - DOT_R,
    top: at === 'top' ? -DOT_R : totalH - DOT_R,
    width: DOT_R * 2,
    height: DOT_R * 2,
    borderRadius: '50%',
    background: linking ? '#60a5fa' : '#374151',
    border: `1.5px solid ${linking ? '#93c5fd' : '#4b5563'}`,
    cursor: 'crosshair',
    zIndex: 20,
    transition: 'background 0.1s',
    boxSizing: 'border-box',
  });

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: step.position.x,
          top:  step.position.y,
          width: STEP_W,
          height: totalH,
          background: bg,
          border: `1.5px solid ${borderColor}`,
          borderRadius: 2,
          cursor: 'move',
          userSelect: 'none',
          boxSizing: 'border-box',
          overflow: 'visible',  // allow dots to straddle border
          boxShadow: selected ? `0 0 0 1px ${borderColor}44` : 'none',
        }}
        onMouseDown={onMouseDown}
        onContextMenu={onContextMenu}
        onDoubleClick={e => { e.stopPropagation(); setShowEditor(true); }}
      >
        {/* Inner border for initial step */}
        {step.isInitial && (
          <div style={{
            position: 'absolute', inset: INSET,
            border: `1px solid ${borderColor}88`,
            borderRadius: 1, pointerEvents: 'none',
          }} />
        )}

        {/* Step name header */}
        <div style={{
          height: STEP_H,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 8px',
          borderBottom: step.actions.length > 0 ? `1px solid ${borderColor}22` : 'none',
          overflow: 'hidden',
        }}>
          {editingName ? (
            <input
              autoFocus value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => {
                if (e.key === 'Enter')  commitName();
                if (e.key === 'Escape') { setNameDraft(step.name); setEditingName(false); }
                e.stopPropagation();
              }}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', textAlign: 'center', background: 'transparent',
                border: 'none', borderBottom: `1px solid #60a5fa`, outline: 'none',
                color: '#e2e8f0', fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
              }}
            />
          ) : (
            <span
              onClick={e => { e.stopPropagation(); setEditingName(true); setNameDraft(step.name); }}
              style={{
                color: '#e2e8f0', fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
                cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}
            >{step.name}</span>
          )}
        </div>

        {/* Action rows */}
        {step.actions.map((action, i) => (
          <div key={action.id} style={{
            display: 'grid', gridTemplateColumns: '22px 1fr',
            height: ACTION_H,
            borderBottom: i < step.actions.length - 1 ? `1px solid ${borderColor}18` : 'none',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${borderColor}12`, borderRight: `1px solid ${borderColor}22`,
              fontSize: 8, fontWeight: 800, fontFamily: 'monospace', color: '#7dd3fc',
              flexShrink: 0,
            }}>{action.qualifier}</div>
            <div style={{
              display: 'flex', alignItems: 'center', padding: '0 6px', minWidth: 0,
              color: '#94a3b8', fontSize: 10, fontFamily: 'monospace',
              overflow: 'hidden',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {action.tag.name}
              </span>
              {action.duration && (
                <span style={{ marginLeft: 4, color: '#4b5563', fontSize: 8, flexShrink: 0 }}>
                  {action.duration}
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Top connector dot */}
        <div style={dotStyle('top')}
          onClick={onTopConnect}
          onMouseDown={e => e.stopPropagation()}
          title="Connect wire (incoming)"
        />

        {/* Bottom connector dot */}
        <div style={dotStyle('bottom')}
          onClick={onBottomConnect}
          onMouseDown={e => e.stopPropagation()}
          title="Connect wire (outgoing)"
        />
      </div>

      {showEditor && <SFCActionEditor step={step} onClose={() => setShowEditor(false)} />}
    </>
  );
};
