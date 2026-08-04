/*
 * PlcPanel — mounted inside the VS Code bottom panel area as a native ViewPane.
 * Tabs: Tag Monitor | Console | Runtime
 */

import React, { useState } from 'react';

type TabId = 'tag-monitor' | 'console' | 'runtime';

const TABS: {id: TabId;label: string;}[] = [
{ id: 'tag-monitor', label: 'Tag Monitor' },
{ id: 'console', label: 'Console' },
{ id: 'runtime', label: 'Runtime' }];


export const PlcPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('tag-monitor');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: 'var(--vscode-panel-background, var(--vscode-editor-background))',
      color: 'var(--vscode-foreground)',
      fontFamily: 'inherit',
      fontSize: 12,
      overflow: 'hidden'
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        height: 35,
        flexShrink: 0,
        borderBottom: '1px solid var(--vscode-panel-border, rgba(255,255,255,0.08))',
        background: 'var(--vscode-panel-background, var(--vscode-editor-background))'
      }}>
        {TABS.map((tab) =>
        <div
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          style={{
            padding: '0 14px',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            fontSize: 11,
            fontWeight: activeTab === tab.id ? 600 : 400,
            cursor: 'pointer',
            userSelect: 'none',
            color: activeTab === tab.id ?
            'var(--vscode-panelTitle-activeForeground, var(--vscode-foreground))' :
            'var(--vscode-panelTitle-inactiveForeground, var(--vscode-descriptionForeground))',
            borderBottom: activeTab === tab.id ?
            '1px solid var(--vscode-panelTitle-activeBorder, var(--vscode-focusBorder))' :
            '1px solid transparent'
          }}>

            {tab.label}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: '8px 12px',
        fontFamily: 'var(--vscode-editor-font-family, monospace)',
        color: 'var(--vscode-descriptionForeground)'
      }}>
        {activeTab === 'tag-monitor' &&
        <div>No tags being monitored. Start the runtime to see live values.</div>
        }
        {activeTab === 'console' &&
        <div>Console output will appear here.</div>
        }
        {activeTab === 'runtime' &&
        <div>Runtime status: Stopped</div>
        }
      </div>
    </div>);

};