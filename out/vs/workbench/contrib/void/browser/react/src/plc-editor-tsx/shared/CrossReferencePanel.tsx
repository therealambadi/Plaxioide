/*
 * CrossReferencePanel — "Where Used" side panel.
 * Shows all occurrences of a selected tag across LD/FBD/SFC/ST.
 */

import React, { useMemo } from 'react';
import { logicStore, useLogicStoreSelector } from '../logicStore.js';

export const CrossReferencePanel: React.FC = () => {
  const crossRefPanelOpen = useLogicStoreSelector(s => s.crossRefPanelOpen);
  const crossRefTarget = useLogicStoreSelector(s => s.crossRefTarget);
  const crossRefIndex = useLogicStoreSelector(s => s.crossRefIndex);
  const ladderProgram = useLogicStoreSelector(s => s.ladderProgram);

  const usages = useMemo(() => {
    if (!crossRefTarget) return [];
    return crossRefIndex.get(crossRefTarget) || [];
  }, [crossRefTarget, crossRefIndex]);

  if (!crossRefPanelOpen) return null;

  const getRungNumber = (rungId: string) => {
    const rung = ladderProgram.rungs.find(r => r.id === rungId);
    return rung ? rung.number : '?';
  };

  const getElementDescription = (rungId: string | undefined, elementId: string) => {
    if (!rungId) return elementId;
    const rung = ladderProgram.rungs.find(r => r.id === rungId);
    if (!rung) return elementId;
    const el = rung.elements.find(e => e.id === elementId)
      || rung.branches.flatMap(b => b.elements).find(e => e.id === elementId);
    if (!el) return elementId;
    if (el.kind === 'contact') return `Contact (${el.type})`;
    if (el.kind === 'coil') return `Coil (${el.type})`;
    if (el.kind === 'block') return `Block ${el.fbType} (${el.instanceName})`;
    return elementId;
  };

  const langColors: Record<string, string> = {
    LD: '#60a5fa', FBD: '#a78bfa', SFC: '#f472b6', ST: '#4ade80',
  };

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 280,
      background: 'var(--vscode-input-background)', borderLeft: '1px solid var(--vscode-widget-border, #454545)',
      display: 'flex', flexDirection: 'column', zIndex: 100,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--vscode-input-border, #3c3c3c)', gap: 8 }}>
        <span style={{ color: 'var(--vscode-editor-foreground)', fontWeight: 600, fontSize: 13, flex: 1 }}>
          Where Used: <span style={{ color: 'var(--vscode-focusBorder)', fontFamily: 'monospace' }}>{crossRefTarget}</span>
        </span>
        <button
          onClick={() => logicStore.closeCrossRef()}
          style={{ background: 'none', border: 'none', color: 'var(--vscode-descriptionForeground)', cursor: 'pointer', fontSize: 16, padding: 2 }}
        >×</button>
      </div>

      {/* Usage count */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--vscode-editorGroup-border)', color: 'var(--vscode-descriptionForeground)', fontSize: 11 }}>
        {usages.length} occurrence{usages.length !== 1 ? 's' : ''} found
      </div>

      {/* Usages list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {usages.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--vscode-descriptionForeground)', fontSize: 12, textAlign: 'center' }}>
            No usages found for this tag
          </div>
        ) : (
          usages.map((usage, i) => (
            <div
              key={i}
              onClick={() => {
                // Scroll to element — set selection
                if (usage.rungId) {
                  logicStore.setSelection([usage.elementId], usage.rungId);
                }
              }}
              style={{
                display: 'flex', flexDirection: 'column', gap: 2,
                padding: '8px 12px', borderBottom: '1px solid var(--vscode-editorGroup-border)',
                cursor: 'pointer', transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--vscode-sideBar-background)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  background: langColors[usage.language] + '25',
                  color: langColors[usage.language],
                  borderRadius: 3, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                }}>{usage.language}</span>
                {usage.rungId && (
                  <span style={{ color: 'var(--vscode-focusBorder)', fontSize: 11 }}>
                    Rung {getRungNumber(usage.rungId)}
                  </span>
                )}
              </div>
              <div style={{ color: 'var(--vscode-input-placeholderForeground)', fontSize: 11, fontFamily: 'monospace' }}>
                {getElementDescription(usage.rungId, usage.elementId)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
