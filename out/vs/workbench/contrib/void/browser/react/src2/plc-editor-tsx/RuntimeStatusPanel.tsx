/*
 * RuntimeStatusPanel — compact panel showing the state of each backend service.
 * Mounted inside LogicTab above the canvas area.
 * Nothing runs invisibly — if it's running, it shows here.
 */

import React, { useState, useEffect } from 'react';
import { runtimeStore, RuntimeStoreState, ComponentState, ComponentStatus } from './runtimeStore.js';
import { runtimeProcessManager } from './runtimeProcessManager.js';

// ── Token helpers ─────────────────────────────────────────────────────────────
const statusColor = (s: ComponentStatus): string => ({
  stopped: 'var(--vscode-descriptionForeground)',
  starting: 'var(--vscode-charts-yellow, #f9e2af)',
  running: 'var(--vscode-charts-green, #a6e3a1)',
  error: 'var(--vscode-charts-red, #f38ba8)'
})[s];

const statusDot = (s: ComponentStatus): string => ({
  stopped: '○', starting: '◌', running: '●', error: '✕'
})[s];

// ── Single service chip ───────────────────────────────────────────────────────
const Chip: React.FC<{label: string;state: ComponentState;}> = ({ label, state }) => {
  const color = statusColor(state.status);
  return (
    <div
      title={state.lastError ?? state.detail ?? state.status}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '0 8px', height: 22,
        background: 'var(--vscode-input-background)',
        border: `1px solid ${state.status === 'error' ? color : 'var(--vscode-widget-border, #3c3c3c)'}`,
        borderRadius: 4,
        fontSize: 11,
        color,
        cursor: state.lastError ? 'help' : 'default',
        flexShrink: 0
      }}>

      <span style={{ fontSize: 10 }}>{statusDot(state.status)}</span>
      <span style={{ color: 'var(--vscode-foreground)', fontWeight: 500 }}>{label}</span>
      {state.detail &&
      <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 10 }}>{state.detail}</span>
      }
    </div>);

};

// ── Compile log drawer ────────────────────────────────────────────────────────
const LogLine: React.FC<{level: string;message: string;timestamp: number;}> = ({ level, message, timestamp }) => {
  const color = level === 'error' ? 'var(--vscode-charts-red, #f38ba8)' :
  level === 'warn' ? 'var(--vscode-charts-yellow, #f9e2af)' :
  level === 'success' ? 'var(--vscode-charts-green, #a6e3a1)' :
  'var(--vscode-foreground)';
  const ts = new Date(timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <div style={{ display: 'flex', gap: 8, fontFamily: 'var(--vscode-editor-font-family, monospace)', fontSize: 11, lineHeight: '18px' }}>
      <span style={{ color: 'var(--vscode-descriptionForeground)', flexShrink: 0 }}>{ts}</span>
      <span style={{ color }}>{message}</span>
    </div>);

};

// ── Main panel ────────────────────────────────────────────────────────────────
export const RuntimeStatusPanel: React.FC = () => {
  const [state, setState] = useState<RuntimeStoreState>(() => runtimeStore.getState());
  const [logOpen, setLogOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => runtimeStore.subscribe(setState), []);

  const hasActivity = state.matiec.status !== 'stopped' ||
  state.strucpp.status !== 'stopped' ||
  state.openplc.status !== 'stopped';

  const hasError = state.matiec.status === 'error' ||
  state.strucpp.status === 'error' ||
  state.openplc.status === 'error';

  const errorCount = state.compileLog.filter((l) => l.level === 'error').length;

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await runtimeProcessManager.stopProgram();
      runtimeStore.reset();
    } finally {
      setRestarting(false);
    }
  };

  if (!hasActivity && !logOpen) return null;

  return (
    <div style={{
      flexShrink: 0,
      background: 'var(--vscode-editorGroupHeader-tabsBackground)',
      borderBottom: '1px solid var(--vscode-panel-border, var(--vscode-editorGroup-border))'
    }}>
      {/* ── Status bar row ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 8px', height: 28,
        overflow: 'hidden'
      }}>
        <span style={{ fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--vscode-descriptionForeground)', flexShrink: 0 }}>
          Runtime
        </span>

        <Chip label="MatIEC" state={state.matiec} />
        <Chip label="STruC++" state={state.strucpp} />
        <Chip label="OpenPLC" state={state.openplc} />

        {state.plcRunning &&
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', height: 22,
          background: 'rgba(166,227,161,0.1)', border: '1px solid var(--vscode-charts-green, #a6e3a1)',
          borderRadius: 4, fontSize: 11, color: 'var(--vscode-charts-green, #a6e3a1)', flexShrink: 0 }}>
            ● PLC running · {state.connectedTags} tags · {state.scanCycle_ms}ms
          </div>
        }

        <div style={{ flex: 1 }} />

        {/* Log toggle */}
        <button
          onClick={() => setLogOpen((o) => !o)}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: hasError ? 'var(--vscode-charts-red, #f38ba8)' : 'var(--vscode-descriptionForeground)',
            fontSize: 11, padding: '2px 6px', borderRadius: 3,
            display: 'flex', alignItems: 'center', gap: 4
          }}
          title="Toggle compile log">

          {errorCount > 0 ? `⚠ ${errorCount} error${errorCount > 1 ? 's' : ''}` : '≡ Log'}
          {logOpen ? ' ▲' : ' ▼'}
        </button>

        {/* Restart */}
        <button
          onClick={handleRestart}
          disabled={restarting}
          style={{
            background: 'transparent', border: 'none', cursor: restarting ? 'not-allowed' : 'pointer',
            color: 'var(--vscode-descriptionForeground)',
            fontSize: 11, padding: '2px 6px', borderRadius: 3
          }}
          title="Stop all backend services and reset state">

          {restarting ? '⏳' : '↺'} Restart
        </button>
      </div>

      {/* ── Log drawer ── */}
      {logOpen &&
      <div style={{
        maxHeight: 160, overflowY: 'auto',
        padding: '6px 12px',
        borderTop: '1px solid var(--vscode-panel-border, var(--vscode-editorGroup-border))'
      }}>
          {state.compileLog.length === 0 ?
        <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 11 }}>No log entries.</span> :

        [...state.compileLog].reverse().map((entry, i) =>
        <LogLine key={i} level={entry.level} message={entry.message} timestamp={entry.timestamp} />
        )
        }
        </div>
      }
    </div>);

};