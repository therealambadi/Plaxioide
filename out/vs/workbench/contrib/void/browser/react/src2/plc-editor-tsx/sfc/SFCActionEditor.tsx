/*
 * SFCActionEditor — Action qualifier editor for SFC steps.
 * Each step can have multiple actions with IEC 61131-3 qualifiers:
 * N, S, R, P1, P0, L, D, SD, DS, SL
 */

import React, { useState } from 'react';
import { SFCAction, SFCStep, ActionQualifier, TagRef, logicStore } from '../logicStore.js';
import { TagBindingInput } from '../shared/TagBindingInput.js';
import { undoRedoStore } from '../undoRedoStore.js';

// ── IEC 61131-3 Action Qualifier Descriptions ─────────────────────────────────

const QUALIFIER_DESCRIPTIONS: Record<ActionQualifier, string> = {
  N: 'Non-stored (active while step is active)',
  S: 'Set (latching — remains active until reset)',
  R: 'Reset (cancel a stored action)',
  P1: 'Pulse on activation (one scan on entry)',
  P0: 'Pulse on deactivation (one scan on exit)',
  L: 'Time-limited (active for duration)',
  D: 'Time-delayed activation',
  SD: 'Stored + Time-delayed',
  DS: 'Delayed + Stored',
  SL: 'Stored + Time-limited'
};

const QUALIFIER_COLORS: Record<ActionQualifier, string> = {
  N: 'var(--vscode-charts-blue, #60a5fa)',
  S: 'var(--vscode-charts-pink, #f472b6)',
  R: 'var(--vscode-errorForeground, #f38ba8)',
  P1: 'var(--vscode-charts-green, #34d399)',
  P0: 'var(--vscode-charts-green, #34d399)',
  L: 'var(--vscode-charts-yellow, #fbbf24)',
  D: 'var(--vscode-charts-orange, #fb923c)',
  SD: 'var(--vscode-charts-orange, #fb923c)',
  DS: 'var(--vscode-charts-orange, #fb923c)',
  SL: 'var(--vscode-charts-orange, #fb923c)'
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface SFCActionEditorProps {
  step: SFCStep;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const SFCActionEditor: React.FC<SFCActionEditorProps> = ({ step, onClose }) => {
  const [newQualifier, setNewQualifier] = useState<ActionQualifier>('N');
  const [newTag, setNewTag] = useState<TagRef>({ name: '', dataType: 'BOOL' });
  const [newDuration, setNewDuration] = useState('T#1s');

  const needsDuration = ['L', 'D', 'SD', 'DS', 'SL'].includes(newQualifier);

  const addAction = () => {
    if (!newTag.name) return;
    undoRedoStore.push();
    const action: SFCAction = {
      id: `action-${Date.now()}`,
      qualifier: newQualifier,
      tag: newTag,
      duration: needsDuration ? newDuration : undefined
    };
    logicStore.updateSFCStep(step.id, {
      actions: [...step.actions, action]
    });
    setNewTag({ name: '', dataType: 'BOOL' });
  };

  const removeAction = (actionId: string) => {
    undoRedoStore.push();
    logicStore.updateSFCStep(step.id, {
      actions: step.actions.filter((a) => a.id !== actionId)
    });
  };

  const updateAction = (actionId: string, updates: Partial<SFCAction>) => {
    undoRedoStore.push();
    logicStore.updateSFCStep(step.id, {
      actions: step.actions.map((a) => a.id === actionId ? { ...a, ...updates } : a)
    });
  };

  // ── Styling ─────────────────────────────────────────────────────────────────

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.4)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const editorStyle: React.CSSProperties = {
    background: 'var(--vscode-editorWidget-background)',
    border: '1px solid var(--vscode-editorWidget-border)',
    borderRadius: 6,
    padding: 16,
    minWidth: 380,
    maxWidth: 500,
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)'
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottom: '1px solid var(--vscode-editorGroup-border)'
  };

  const titleStyle: React.CSSProperties = {
    color: 'var(--vscode-foreground)',
    fontWeight: 700,
    fontSize: 13,
    flex: 1
  };

  const closeBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--vscode-descriptionForeground)',
    cursor: 'pointer',
    fontSize: 20,
    padding: 0,
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--vscode-descriptionForeground)',
    marginBottom: 8,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  };

  const actionRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    background: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: 4,
    marginBottom: 6
  };

  const qualifierBadgeStyle = (qualifier: ActionQualifier): React.CSSProperties => ({
    background: QUALIFIER_COLORS[qualifier] + '25',
    color: QUALIFIER_COLORS[qualifier],
    borderRadius: 3,
    padding: '2px 6px',
    fontSize: 11,
    fontWeight: 700,
    minWidth: 36,
    textAlign: 'center',
    fontFamily: 'monospace'
  });

  const tagTextStyle: React.CSSProperties = {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 12,
    color: 'var(--vscode-foreground)'
  };

  const durationTextStyle: React.CSSProperties = {
    fontSize: 10,
    color: 'var(--vscode-descriptionForeground)',
    fontFamily: 'monospace'
  };

  const deleteBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--vscode-errorForeground)',
    cursor: 'pointer',
    fontSize: 16,
    padding: 0,
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const addSectionStyle: React.CSSProperties = {
    borderTop: '1px solid var(--vscode-editorGroup-border)',
    paddingTop: 14,
    marginTop: 14
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--vscode-dropdown-background)',
    border: '1px solid var(--vscode-dropdown-border)',
    borderRadius: 3,
    color: 'var(--vscode-dropdown-foreground)',
    fontSize: 12,
    padding: '6px 8px',
    marginBottom: 8,
    outline: 'none',
    cursor: 'pointer'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: 3,
    color: 'var(--vscode-input-foreground)',
    fontSize: 12,
    padding: '6px 8px',
    marginBottom: 8,
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'monospace'
  };

  const addBtnStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--vscode-button-background)',
    border: 'none',
    borderRadius: 4,
    color: 'var(--vscode-button-foreground)',
    fontSize: 12,
    padding: '8px 0',
    cursor: newTag.name ? 'pointer' : 'not-allowed',
    opacity: newTag.name ? 1 : 0.5,
    fontWeight: 600
  };

  const hintStyle: React.CSSProperties = {
    fontSize: 10,
    color: 'var(--vscode-descriptionForeground)',
    marginTop: 4,
    fontStyle: 'italic'
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      style={overlayStyle}
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}>

      <div
        style={editorStyle}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={headerStyle}>
          <div style={titleStyle}>
            Actions for Step: <span style={{ fontFamily: 'monospace', color: 'var(--vscode-focusBorder)' }}>{step.name}</span>
          </div>
          <button
            onClick={onClose}
            style={closeBtnStyle}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--vscode-toolbar-hoverBackground)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>

            ×
          </button>
        </div>

        {/* Existing actions list */}
        {step.actions.length > 0 &&
        <div style={{ marginBottom: 16 }}>
            <div style={sectionTitleStyle}>Current Actions ({step.actions.length})</div>
            {step.actions.map((action) =>
          <div key={action.id} style={actionRowStyle}>
                <div style={qualifierBadgeStyle(action.qualifier)}>
                  {action.qualifier}
                </div>
                <div style={tagTextStyle}>
                  {action.tag.name}
                </div>
                {action.duration &&
            <div style={durationTextStyle}>
                    {action.duration}
                  </div>
            }
                <button
              onClick={() => removeAction(action.id)}
              style={deleteBtnStyle}
              title="Remove action"
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--vscode-toolbar-hoverBackground)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>

                  ×
                </button>
              </div>
          )}
          </div>
        }

        {/* Add new action form */}
        <div style={addSectionStyle}>
          <div style={sectionTitleStyle}>Add New Action</div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', display: 'block', marginBottom: 4 }}>
              Qualifier
            </label>
            <select
              value={newQualifier}
              onChange={(e) => setNewQualifier(e.target.value as ActionQualifier)}
              style={selectStyle}
              title={QUALIFIER_DESCRIPTIONS[newQualifier]}>

              {(Object.keys(QUALIFIER_DESCRIPTIONS) as ActionQualifier[]).map((q) =>
              <option key={q} value={q}>
                  {q} — {QUALIFIER_DESCRIPTIONS[q]}
                </option>
              )}
            </select>
            <div style={hintStyle}>
              {QUALIFIER_DESCRIPTIONS[newQualifier]}
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', display: 'block', marginBottom: 4 }}>
              Tag / Variable
            </label>
            <TagBindingInput
              value={newTag}
              onChange={setNewTag}
              placeholder="Tag name or address..." />

          </div>

          {needsDuration &&
          <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', display: 'block', marginBottom: 4 }}>
                Duration
              </label>
              <input
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              placeholder="e.g. T#5s, T#100ms"
              style={inputStyle} />

              <div style={hintStyle}>
                IEC time format: T#5s, T#100ms, T#1m30s
              </div>
            </div>
          }

          <button
            onClick={addAction}
            disabled={!newTag.name}
            style={addBtnStyle}
            onMouseEnter={(e) => newTag.name && (e.currentTarget.style.background = 'var(--vscode-button-hoverBackground)')}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--vscode-button-background)'}>

            + Add Action
          </button>
        </div>

        {/* Help info */}
        <div style={{
          marginTop: 16,
          padding: 10,
          background: 'var(--vscode-textBlockQuote-background)',
          border: '1px solid var(--vscode-textBlockQuote-border)',
          borderRadius: 4,
          fontSize: 10,
          color: 'var(--vscode-descriptionForeground)'
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--vscode-foreground)' }}>
            IEC 61131-3 Action Qualifiers
          </div>
          <div><strong>N:</strong> Non-stored (default)</div>
          <div><strong>S/R:</strong> Set/Reset (latching)</div>
          <div><strong>P1/P0:</strong> Pulse on entry/exit</div>
          <div><strong>L/D:</strong> Time-limited/delayed</div>
        </div>
      </div>
    </div>);

};