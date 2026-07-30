/*
 * LogicToolbar — top toolbar for the PLC Logic tab.
 * Styled with Void --void-* and --vscode-* tokens.
 */

import React, { useCallback, useRef, useState } from 'react';
import { logicStore, useLogicStoreSelector } from '../logicStore.js';
import { useUndoRedo } from '../undoRedoStore.js';
import { simulationEngine } from '../simulation/engine.js';
import { buildCLMFromStore } from '../clm/builder.js';

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
  const tagDatabase = useLogicStoreSelector(s => s.tagDatabase);
  const ladderProgram = useLogicStoreSelector(s => s.ladderProgram);
  const { undo, redo, canUndo, canRedo } = useUndoRedo();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Compute search matches: element IDs whose tag name includes the query
  const searchMatches: Array<{ elementId: string; rungId: string }> = (() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: Array<{ elementId: string; rungId: string }> = [];
    for (const rung of ladderProgram.rungs) {
      for (const el of rung.elements) {
        const name = el.kind === 'block' ? (el as any).instanceName ?? '' : (el as any).tag?.name ?? '';
        if (name.toLowerCase().includes(q)) results.push({ elementId: el.id, rungId: rung.id });
      }
      for (const branch of rung.branches) {
        for (const el of branch.elements) {
          const name = el.kind === 'block' ? (el as any).instanceName ?? '' : (el as any).tag?.name ?? '';
          if (name.toLowerCase().includes(q)) results.push({ elementId: el.id, rungId: rung.id });
        }
      }
    }
    // Also search tag database names
    for (const tag of tagDatabase) {
      if (tag.name.toLowerCase().includes(q) && !results.some(r => r.elementId === tag.name)) {
        // no-op — tag database matches inform count but elements are the nav targets
      }
    }
    return results;
  })();

  // Navigate to current match
  const navigateToMatch = useCallback((idx: number) => {
    if (searchMatches.length === 0) return;
    const match = searchMatches[idx % searchMatches.length];
    logicStore.setSelection([match.elementId], match.rungId);
  }, [searchMatches]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); return; }
    if (e.key === 'Enter') {
      const next = (searchMatchIdx + 1) % Math.max(searchMatches.length, 1);
      setSearchMatchIdx(next);
      navigateToMatch(next);
    }
  };

  const isRunning = monitorMode === 'running';

  const handleRun = useCallback(() => {
    const state = logicStore.getState();
    const clm = buildCLMFromStore(state.ladderProgram, state.fbdProgram, state.sfcProgram, state.tagDatabase);
    const initialValues: Record<string, any> = {};
    for (const tag of state.tagDatabase) {
      if (tag.forcedValue !== undefined) {
        simulationEngine.forceTag(tag.name, tag.forcedValue === 'TRUE' || tag.forcedValue === 'true' ? true : tag.forcedValue === 'FALSE' || tag.forcedValue === 'false' ? false : tag.forcedValue);
      }
      initialValues[tag.name] = tag.forcedValue ?? tag.initialValue ?? tag.liveValue ?? false;
    }
    simulationEngine.start(clm, state.scanRate, initialValues);
    logicStore.setMonitorMode('running');
  }, []);

  const handleStop = useCallback(() => {
    simulationEngine.stop();
    logicStore.setMonitorMode('stopped');
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
      {/* Single Run/Stop toggle button */}
      <Btn
        title={isRunning ? 'Stop simulation' : 'Run simulation'}
        active={isRunning}
        danger={isRunning}
        onClick={isRunning ? handleStop : handleRun}
      >
        {isRunning ? '⏹ Stop' : '▶ Run'}
      </Btn>

      {/* Scan rate — always visible */}
      <Sep />
      <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 11 }}>Scan:</span>
      <select
        value={scanRate}
        onChange={e => logicStore.setScanRate(Number(e.target.value))}
        style={{
          background: 'var(--vscode-input-background)', border: '1px solid var(--vscode-input-border, #3c3c3c)',
          borderRadius: 3, color: 'var(--vscode-foreground)', fontSize: 11, padding: '1px 4px',
          cursor: 'pointer',
        }}
      >
        {[10, 50, 100, 500, 1000].map(v => <option key={v} value={v}>{v < 1000 ? `${v}ms` : '1s'}</option>)}
      </select>

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

      {searchOpen ? (
        <>
          <input
            ref={searchInputRef}
            autoFocus
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearchMatchIdx(0); }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search tags…"
            style={{
              background: 'var(--vscode-input-background)', border: '1px solid var(--vscode-input-border, #3c3c3c)',
              borderRadius: 3, color: 'var(--vscode-foreground)', fontSize: 11, padding: '2px 6px',
              outline: 'none', width: 140, flexShrink: 0,
            }}
          />
          <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 11, flexShrink: 0 }}>
            {searchQuery ? `${searchMatches.length} result${searchMatches.length !== 1 ? 's' : ''}` : ''}
          </span>
          <Btn title="Close search (Esc)" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>✕</Btn>
        </>
      ) : (
        <Btn title="Search tags" onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 0); }}>🔍 Search</Btn>
      )}

      <div style={{ flex: 1 }} />
      <Btn title="Open Export tab" onClick={() => window.postMessage({ type: 'volt:open-export' }, '*')}>⬆ Export</Btn>

    </div>
  );
};
