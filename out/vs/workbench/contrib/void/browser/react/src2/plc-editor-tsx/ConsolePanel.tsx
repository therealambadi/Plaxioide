import React, { useEffect, useRef } from 'react';
import { useLogicStoreSelector, logicStore } from './logicStore.js';

const COLORS = {
  info: 'var(--vscode-foreground)',
  warn: '#e5c07b',
  error: '#f38ba8',
  success: '#22c55e'
};

export const ConsolePanel: React.FC = () => {
  const logs = useLogicStoreSelector((s) => s.consoleLog);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const clearLogs = () => logicStore.clearConsole();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'var(--vscode-editor-font-family, monospace)', fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid var(--vscode-editorGroup-border)', gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--vscode-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Output
        </span>
        <button
          onClick={clearLogs}
          style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--vscode-descriptionForeground)', cursor: 'pointer', fontSize: 11 }}>

          Clear
        </button>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '4px 8px' }}>
        {logs.map((entry, i) =>
        <div key={i} style={{ display: 'flex', gap: 8, padding: '1px 0', color: COLORS[entry.level] }}>
            <span style={{ color: 'var(--vscode-descriptionForeground)', flexShrink: 0 }}>
              [{new Date(entry.timestamp).toLocaleTimeString()}]
            </span>
            <span>{entry.message}</span>
          </div>
        )}
      </div>
    </div>);

};