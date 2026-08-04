/*
 * InspectorPanel.tsx — Right-side properties panel for the PLC editor.
 * Slides in when an element is selected. Shows element properties.
 */

import React from 'react';
import { useLogicStoreSelector } from '../logicStore.js';

// ── Props ─────────────────────────────────────────────────────────────────────

interface InspectorPanelProps {
  language: 'LD' | 'FBD' | 'SFC';
  onClose: () => void;
}

// ── LD Inspector ──────────────────────────────────────────────────────────────

const LDInspector: React.FC = () => {
  const selectedIds = useLogicStoreSelector((s) => s.selectedElementIds);
  const ladderProgram = useLogicStoreSelector((s) => s.ladderProgram);

  // Find the selected element across all rungs
  let selectedEl: {rungId: string;element: any;} | null = null;
  for (const rung of ladderProgram.rungs) {
    const el = rung.elements.find((e) => selectedIds.has(e.id));
    if (el) {selectedEl = { rungId: rung.id, element: el };break;}
  }

  if (!selectedEl) {
    return (
      <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12, padding: '8px 0' }}>
        Select an element on the canvas to inspect its properties.
      </div>);

  }

  const { element } = selectedEl;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <PropRow label="Type" value={element.kind ?? element.type ?? '—'} />
      {element.tag && <PropRow label="Tag" value={element.tag.name || '(unnamed)'} />}
      {element.tag?.dataType && <PropRow label="Data Type" value={element.tag.dataType} />}
      {element.blockType && <PropRow label="Block" value={element.blockType} />}
      {element.instanceName && <PropRow label="Instance" value={element.instanceName} />}
      <PropRow label="ID" value={element.id} dimmed />
    </div>);

};

// ── FBD Inspector ─────────────────────────────────────────────────────────────

const FBDInspector: React.FC = () => {
  return (
    <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12, padding: '8px 0' }}>
      Select a node to inspect its properties.
      <br /><br />
      <span style={{ fontSize: 11 }}>Double-click a variable node to edit its tag name.</span>
    </div>);

};

// ── SFC Inspector ─────────────────────────────────────────────────────────────

const SFCInspector: React.FC = () => {
  const selectedIds = useLogicStoreSelector((s) => s.selectedElementIds);
  const sfcProgram = useLogicStoreSelector((s) => s.sfcProgram);

  if (selectedIds.size === 0) {
    return (
      <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12, padding: '8px 0' }}>
        Select a step or transition to inspect its properties.
      </div>);

  }

  const id = Array.from(selectedIds)[0];
  const step = sfcProgram.steps.find((s) => s.id === id);
  const trans = sfcProgram.transitions.find((t) => t.id === id);

  if (step) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PropRow label="Type" value="Step" />
        <PropRow label="Name" value={step.name} />
        <PropRow label="Initial" value={step.isInitial ? 'Yes' : 'No'} />
        <PropRow label="Actions" value={String(step.actions?.length ?? 0)} />
        <PropRow label="Position" value={`(${step.position.x}, ${step.position.y})`} dimmed />
        <PropRow label="ID" value={step.id} dimmed />
      </div>);

  }

  if (trans) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PropRow label="Type" value="Transition" />
        <PropRow label="Condition" value={trans.condition} />
        <PropRow label="Position" value={`(${trans.position.x}, ${trans.position.y})`} dimmed />
        <PropRow label="ID" value={trans.id} dimmed />
      </div>);

  }

  return null;
};

// ── PropRow ───────────────────────────────────────────────────────────────────

const PropRow: React.FC<{label: string;value: string;dimmed?: boolean;}> = ({ label, value, dimmed }) =>
<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--vscode-descriptionForeground)' }}>
      {label}
    </div>
    <div style={{
    fontSize: 12, fontFamily: 'monospace',
    color: dimmed ? 'var(--vscode-descriptionForeground)' : 'var(--vscode-editor-foreground)',
    wordBreak: 'break-all'
  }}>
      {value}
    </div>
  </div>;


// ── InspectorPanel ────────────────────────────────────────────────────────────

export const InspectorPanel: React.FC<InspectorPanelProps> = ({ language, onClose }) => {
  return (
    <div style={{
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: 220,
      background: 'var(--vscode-sideBar-background)',
      borderLeft: '1px solid var(--vscode-editorGroup-border)',
      zIndex: 10,
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: '1px solid var(--vscode-editorGroup-border)'
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--vscode-descriptionForeground)' }}>
          Properties
        </div>
        <button
          onClick={onClose}
          title="Close inspector"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--vscode-descriptionForeground)',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: '0 4px',
            borderRadius: 3
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--vscode-foreground)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--vscode-descriptionForeground)'}>

          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {language === 'LD' && <LDInspector />}
        {language === 'FBD' && <FBDInspector />}
        {language === 'SFC' && <SFCInspector />}
      </div>
    </div>);

};