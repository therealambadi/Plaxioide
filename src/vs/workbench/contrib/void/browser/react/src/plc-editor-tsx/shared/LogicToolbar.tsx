/*
 * LogicToolbar — top toolbar for the PLC Logic tab.
 * Styled with Void --void-* and --vscode-* tokens.
 *
 * Run/Stop are stubbed — will be wired to the JS simulation engine.
 */

import React, { useCallback, useState } from 'react';
import { logicStore, useLogicStoreSelector } from '../logicStore.js';
import { useUndoRedo } from '../undoRedoStore.js';

interface LogicToolbarProps {
  onExportPNG?: () => void;
  onExportPDF?: () => void;
}

const Btn: React.FC<{
  title: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, active, disabled, danger, onClick, children }) => (
  <button
    title={title}
    onClick={onClick}
    disabled={disabled}
    style={{
      background: active ? 'var(--vscode-input-background)' : 'transparent',
      border: `1px solid ${active ? 'var(--vscode-widget-border, #454545)' : 'transparent'}`,
      borderRadius: 4,
      color: disabled ? 'var(--vscode-descriptionForeground)'
        : danger ? 'var(--vscode-charts-red, #f38ba8)'
        : active ? 'var(--vscode-editor-foreground)'
        : 'var(--vscode-foreground)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      padding: '3px 8px',
      fontSize: 12,
      display: 'flex', alignItems: 'center', gap: 4,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}
    onMouseEnter={e => { if (!disabled && !active) (e.currentTarget as HTMLElement).style.background = 'var(--vscode-input-background)'; }}
    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
  >
    {children}
  </button>
);

const Sep: React.FC = () => (
  <div style={{ width: 1, height: 16, background: 'var(--vscode-editorGroup-border)', margin: '0 3px', flexShrink: 0 }} />
);

export const LogicToolbar: React.FC<LogicToolbarProps> = ({ onExportPNG: _onExportPNG, onExportPDF: _onExportPDF }) => {
  const monitorMode = useLogicStoreSelector(s => s.monitorMode);
  const zoom = useLogicStoreSelector(s => s.zoom);
  const showGrid = useLogicStoreSelector(s => s.showGrid);
  const scanRate = useLogicStoreSelector(s => s.scanRate);
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const [_launching, _setLaunching] = useState(false);

  const isRunning = monitorMode === 'running';
  const isMonitoring = monitorMode !== 'stopped';

  // Stubbed — will be wired to JS simulation engine in the next phase
  const handleRun = useCallback(() => {
    console.log('[LogicToolbar] Run — simulation engine not yet wired');
  }, []);

  const handleStop = useCallback(() => {
    console.log('[LogicToolbar] Stop — simulation engine not yet wired');
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2,
      padding: '0 8px',
      background: 'var(--vscode-sideBar-background)',
      borderBottom: '1px solid var(--vscode-editorGroup-border)',
      height: 36, boxSizing: 'border-box', flexShrink: 0,
      overflow: 'hidden',
    }}>
      <Btn
        title={isRunning ? 'PLC running — click Stop to halt' : 'Run simulation'}
        active={isRunning}
        onClick={isRunning ? handleStop : handleRun}
      >
        {isRunning ? '⏹' : '▶'} {isRunning ? 'Stop' : 'Run'}
      </Btn>

      <Btn title="Stop simulation" disabled={!isMonitoring} danger onClick={handleStop}>
        ⏹ Stop
      </Btn>

      {isMonitoring && <>
        <Sep />
        <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 11 }}>Scan:</span>
        <select
          value={scanRate}
          onChange={e => logicStore.setScanRate(Number(e.target.value))}
          style={{
            background: 'var(--vscode-input-background)', border: '1px solid var(--vscode-input-border, #3c3c3c)',
            borderRadius: 3, color: 'var(--vscode-foreground)', fontSize: 11, padding: '1px 4px',
          }}
        >
          {[10, 50, 100, 500, 1000].map(v => <option key={v} value={v}>{v < 1000 ? `${v}ms` : '1s'}</option>)}
        </select>
      </>}

      <Sep />

      <Btn title="Undo (⌘Z)" disabled={!canUndo} onClick={undo}>↩ Undo</Btn>
      <Btn title="Redo (⌘⇧Z)" disabled={!canRedo} onClick={redo}>↪ Redo</Btn>

      <Sep />

      <Btn title="Zoom out" onClick={() => logicStore.setZoom(zoom - 0.1)}>−</Btn>
      <span style={{ color: 'var(--vscode-foreground)', fontSize: 12, minWidth: 40, textAlign: 'center', flexShrink: 0 }}>
        {Math.round(zoom * 100)}%
      </span>
      <Btn title="Zoom in" onClick={() => logicStore.setZoom(zoom + 0.1)}>+</Btn>
      <Btn title="Reset zoom" onClick={() => logicStore.setZoom(1)}>1:1</Btn>

      <Sep />

      <Btn title="Toggle grid" active={showGrid} onClick={() => logicStore.toggleGrid()}>⊞ Grid</Btn>

      <Sep />

      <Btn title="Search tags" onClick={() => {}}>🔍 Search</Btn>

    </div>
  );
};
