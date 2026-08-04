/*
 * CompileConsolePanel — compile log output for the Console bottom-panel tab.
 * Reads from runtimeStore.compileLog. Auto-scrolls to bottom on new entries.
 */

import React, { useState, useEffect, useRef } from 'react';
import { runtimeStore, CompileLogEntry } from './runtimeStore.js';

const levelColor = (level: CompileLogEntry['level']): string => ({
  info: 'var(--vscode-foreground)',
  warn: 'var(--vscode-charts-yellow, #f9e2af)',
  error: 'var(--vscode-charts-red, #f38ba8)',
  success: 'var(--vscode-charts-green, #a6e3a1)'
})[level];

const levelPrefix = (level: CompileLogEntry['level']): string => ({
  info: '  ', warn: '⚠ ', error: '✕ ', success: '✓ '
})[level];

export const CompileConsolePanel: React.FC = () => {
  const [log, setLog] = useState<CompileLogEntry[]>(() => runtimeStore.getState().compileLog);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => runtimeStore.subscribe((s) => setLog([...s.compileLog])), []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length]);

  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      padding: '8px 12px',
      fontFamily: 'var(--vscode-editor-font-family, "Cascadia Code", monospace)',
      fontSize: 12,
      background: 'var(--vscode-panel-background, var(--vscode-editor-background))',
      color: 'var(--vscode-foreground)',
      boxSizing: 'border-box'
    }}>
      {log.length === 0 ?
      <span style={{ color: 'var(--vscode-descriptionForeground)' }}>
          Console output will appear here when you click Run.
        </span> :

      log.map((entry, i) => {
        const ts = new Date(entry.timestamp).toLocaleTimeString('en-US', {
          hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        return (
          <div key={i} style={{ display: 'flex', gap: 10, lineHeight: '19px' }}>
              <span style={{ color: 'var(--vscode-descriptionForeground)', flexShrink: 0, fontSize: 11 }}>{ts}</span>
              <span style={{ color: levelColor(entry.level), whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {levelPrefix(entry.level)}{entry.message}
              </span>
            </div>);

      })
      }
      <div ref={bottomRef} />
    </div>);

};