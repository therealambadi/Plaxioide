import React, { useEffect, useState } from 'react';
import { useLogicStoreSelector } from './logicStore.js';
import { simulationEngine } from './simulation/engine.js';

const S = {
  label: { fontSize: 10, fontWeight: 600, color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  value: { fontSize: 13, color: 'var(--vscode-foreground)', fontFamily: 'var(--vscode-editor-font-family, monospace)' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid var(--vscode-editorGroup-border)' },
  badge: (color: string) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: `${color}22`, color, border: `1px solid ${color}44` }),
};

export const RuntimePanel: React.FC = () => {
  const monitorMode = useLogicStoreSelector(s => s.monitorMode);
  const scanRate = useLogicStoreSelector(s => s.scanRate);
  const activeLanguage = useLogicStoreSelector(s => s.activeLanguage);
  const tagCount = useLogicStoreSelector(s => s.tagDatabase.length);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (monitorMode !== 'running') return;
    const id = setInterval(() => {
      setTick(simulationEngine.currentTick);
    }, 200);
    return () => clearInterval(id);
  }, [monitorMode]);

  const statusColor = monitorMode === 'running' ? '#22c55e' : monitorMode === 'paused' ? '#e5c07b' : '#6b7280';
  const statusText = monitorMode === 'running' ? 'RUNNING' : monitorMode === 'paused' ? 'PAUSED' : 'STOPPED';

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={S.row}>
        <span style={S.label}>Status</span>
        <span style={S.badge(statusColor)}>{statusText}</span>
      </div>
      <div style={S.row}>
        <span style={S.label}>Engine</span>
        <span style={S.value}>JS Simulation (main thread)</span>
      </div>
      <div style={S.row}>
        <span style={S.label}>Active Language</span>
        <span style={S.value}>{activeLanguage}</span>
      </div>
      <div style={S.row}>
        <span style={S.label}>Scan Rate</span>
        <span style={S.value}>{scanRate} ms</span>
      </div>
      <div style={S.row}>
        <span style={S.label}>Scan Tick</span>
        <span style={S.value}>{monitorMode === 'running' ? tick : '—'}</span>
      </div>
      <div style={S.row}>
        <span style={S.label}>Tags Loaded</span>
        <span style={S.value}>{tagCount}</span>
      </div>
      <div style={S.row}>
        <span style={S.label}>Execution Model</span>
        <span style={S.value}>CLM Graph → LD → FBD → SFC (per scan)</span>
      </div>
      <div style={{ padding: '12px', color: 'var(--vscode-descriptionForeground)', fontSize: 11, lineHeight: 1.5 }}>
        {monitorMode === 'stopped' && 'Press Run to start the simulation engine. The CLM graph will be built from the current program and evaluated each scan cycle.'}
        {monitorMode === 'running' && `Engine executing at ${scanRate}ms intervals. All three language evaluators (LD, FBD, SFC) run sequentially each cycle. Live values and energized states are pushed to the UI after each scan.`}
        {monitorMode === 'paused' && 'Simulation paused. Use Step to advance one scan cycle, or Resume to continue.'}
      </div>
    </div>
  );
};
