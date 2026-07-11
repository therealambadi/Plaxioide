/*
 * TagMonitorPanel — live tag watch table for the PLC bottom panel.
 *
 * Architecture:
 *   - Reads from logicStore: tagDatabase, watchedTags, monitorMode, scanRate
 *   - Displays only tags in the watchedTags list (user-curated subset)
 *   - Simulates live values when monitorMode === 'running' (real adapter wires
 *     into updateTagLiveValue — same API, just a different caller)
 *   - Supports: add/remove from watch, force value, release force, cross-ref nav
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLogicStoreSelector, logicStore, TagEntry, IECDataType } from './logicStore.js';
import { clmStore } from './clm/index.js';

// ── Tokens ────────────────────────────────────────────────────────────────────
const T = {
  bg:           'var(--vscode-panel-background, var(--vscode-editor-background))',
  bgRow:        'var(--vscode-list-inactiveSelectionBackground, rgba(255,255,255,0.04))',
  bgRowHover:   'var(--vscode-list-hoverBackground, rgba(255,255,255,0.07))',
  bgRowForced:  'rgba(255,170,0,0.08)',
  bgHeader:     'var(--vscode-editorGroupHeader-tabsBackground)',
  border:       'var(--vscode-panel-border, var(--vscode-editorGroup-border, rgba(255,255,255,0.12)))',
  fg:           'var(--vscode-foreground)',
  fgDim:        'var(--vscode-descriptionForeground)',
  fgForced:     'var(--vscode-charts-yellow, #f9e2af)',
  fgRunning:    'var(--vscode-charts-green, #a6e3a1)',
  fgStopped:    'var(--vscode-descriptionForeground)',
  fgAddress:    'var(--vscode-textLink-foreground, #4fc1ff)',
  fgType:       'var(--vscode-charts-purple, #cba6f7)',
  accent:       'var(--vscode-focusBorder, #007acc)',
  btnBg:        'var(--vscode-button-secondaryBackground, rgba(255,255,255,0.08))',
  btnFg:        'var(--vscode-button-secondaryForeground, var(--vscode-foreground))',
  btnBgHover:   'var(--vscode-button-secondaryHoverBackground, rgba(255,255,255,0.14))',
  inputBg:      'var(--vscode-input-background, #1e1e2e)',
  inputBorder:  'var(--vscode-input-border, rgba(255,255,255,0.2))',
  font:         'var(--vscode-editor-font-family, "Cascadia Code", "Fira Code", monospace)',
  fontUI:       'var(--vscode-font-family, -apple-system, "Segoe UI", sans-serif)',
  fontSize:     11,
  rowH:         28,
};

// ── Type color map ─────────────────────────────────────────────────────────────
function typeColor(dt: IECDataType): string {
  if (dt === 'BOOL')                              return 'var(--vscode-charts-blue, #89b4fa)';
  if (['INT','UINT','DINT','UDINT','LINT','ULINT'].includes(dt)) return 'var(--vscode-charts-purple, #cba6f7)';
  if (['REAL','LREAL'].includes(dt))              return 'var(--vscode-charts-yellow, #f9e2af)';
  if (['BYTE','WORD','DWORD','LWORD'].includes(dt)) return 'var(--vscode-charts-orange, #fab387)';
  return T.fgDim;
}

// ── Address prefix color ───────────────────────────────────────────────────────
function addressColor(addr: string): string {
  if (addr.startsWith('%I')) return 'var(--vscode-charts-blue, #89b4fa)';
  if (addr.startsWith('%Q')) return 'var(--vscode-charts-green, #a6e3a1)';
  if (addr.startsWith('%M')) return 'var(--vscode-charts-yellow, #f9e2af)';
  return T.fgDim;
}

// ── Bool value display ─────────────────────────────────────────────────────────
function boolPill(val: string | undefined, forced: boolean) {
  if (val === undefined) return <span style={{ color: T.fgDim }}>—</span>;
  const on = val === 'TRUE' || val === '1';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      <span style={{
        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
        background: on
          ? 'var(--vscode-charts-green, #a6e3a1)'
          : 'var(--vscode-charts-red, #f38ba8)',
        flexShrink: 0,
        boxShadow: on ? '0 0 4px var(--vscode-charts-green, #a6e3a1)' : 'none',
      }} />
      <span style={{ color: forced ? T.fgForced : (on ? T.fgRunning : T.fg) }}>
        {on ? 'TRUE' : 'FALSE'}
      </span>
    </span>
  );
}

// ── Numeric value display ──────────────────────────────────────────────────────
function numericValue(val: string | undefined, forced: boolean) {
  if (val === undefined) return <span style={{ color: T.fgDim }}>—</span>;
  return <span style={{ color: forced ? T.fgForced : T.fg, fontFamily: T.font }}>{val}</span>;
}

// ── Force dialog ───────────────────────────────────────────────────────────────
const ForceDialog: React.FC<{
  tag: TagEntry;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}> = ({ tag, onConfirm, onCancel }) => {
  const [val, setVal] = useState(tag.forcedValue ?? tag.liveValue ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  const isBool = tag.dataType === 'BOOL';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: 'var(--vscode-editorWidget-background, #1e1e2e)',
        border: `1px solid ${T.border}`,
        borderRadius: 6, padding: '16px 20px', minWidth: 280,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontFamily: T.fontUI, fontSize: 12, fontWeight: 600, color: T.fg, marginBottom: 12 }}>
          Force value — <span style={{ color: T.fgForced }}>{tag.name}</span>
        </div>
        <div style={{ fontSize: 11, color: T.fgDim, marginBottom: 10, fontFamily: T.fontUI }}>
          Type: <span style={{ color: typeColor(tag.dataType) }}>{tag.dataType}</span>
          &nbsp;·&nbsp;Address: <span style={{ color: addressColor(tag.address) }}>{tag.address}</span>
        </div>

        {isBool ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {['TRUE', 'FALSE'].map(opt => (
              <button
                key={opt}
                onClick={() => setVal(opt)}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: 4,
                  border: `1px solid ${val === opt ? T.accent : T.border}`,
                  background: val === opt ? T.accent : T.btnBg,
                  color: val === opt ? '#fff' : T.btnFg,
                  cursor: 'pointer', fontSize: 11, fontFamily: T.fontUI,
                }}
              >{opt}</button>
            ))}
          </div>
        ) : (
          <input
            ref={inputRef}
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onConfirm(val);
              if (e.key === 'Escape') onCancel();
            }}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: T.inputBg, border: `1px solid ${T.inputBorder}`,
              borderRadius: 4, padding: '5px 8px',
              color: T.fg, fontSize: 12, fontFamily: T.font,
              marginBottom: 14, outline: 'none',
            }}
            placeholder="Enter value…"
          />
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '5px 14px', borderRadius: 4, fontSize: 11,
              border: `1px solid ${T.border}`, background: T.btnBg,
              color: T.btnFg, cursor: 'pointer', fontFamily: T.fontUI,
            }}
          >Cancel</button>
          <button
            onClick={() => onConfirm(val)}
            style={{
              padding: '5px 14px', borderRadius: 4, fontSize: 11,
              border: `1px solid ${T.accent}`, background: T.accent,
              color: '#fff', cursor: 'pointer', fontFamily: T.fontUI,
            }}
          >Force</button>
        </div>
      </div>
    </div>
  );
};

// ── Add Tag dropdown ───────────────────────────────────────────────────────────
const AddTagDropdown: React.FC<{
  allTags: TagEntry[];
  watchedNames: string[];
  onAdd: (name: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement>;
}> = ({ allTags, watchedNames, onAdd, onClose, anchorRef }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const available = allTags.filter(t =>
    !watchedNames.includes(t.name) &&
    (t.name.toLowerCase().includes(query.toLowerCase()) ||
     t.address.toLowerCase().includes(query.toLowerCase()) ||
     (t.description ?? '').toLowerCase().includes(query.toLowerCase()))
  );

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (anchorRef.current && anchorRef.current.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, zIndex: 200,
      background: 'var(--vscode-editorWidget-background, #1e1e2e)',
      border: `1px solid ${T.border}`, borderRadius: 4,
      minWidth: 280, maxHeight: 280, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
    }}>
      <div style={{ padding: '6px 8px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && available.length === 1) { onAdd(available[0].name); onClose(); }
          }}
          placeholder="Search tags…"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: T.inputBg, border: `1px solid ${T.inputBorder}`,
            borderRadius: 3, padding: '4px 7px',
            color: T.fg, fontSize: 11, fontFamily: T.fontUI, outline: 'none',
          }}
        />
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {available.length === 0 && (
          <div style={{ padding: '10px 12px', color: T.fgDim, fontSize: 11, fontFamily: T.fontUI }}>
            {allTags.length === watchedNames.length ? 'All tags are in the watch list.' : 'No matching tags.'}
          </div>
        )}
        {available.map(tag => (
          <div
            key={tag.name}
            onClick={() => { onAdd(tag.name); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 10px', cursor: 'pointer',
              fontFamily: T.fontUI, fontSize: 11,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = T.bgRowHover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ color: T.fg, fontWeight: 500, minWidth: 80 }}>{tag.name}</span>
            <span style={{ color: addressColor(tag.address), fontFamily: T.font, fontSize: 10 }}>{tag.address}</span>
            <span style={{ color: typeColor(tag.dataType), fontSize: 10 }}>{tag.dataType}</span>
            {tag.description && (
              <span style={{ color: T.fgDim, fontSize: 10, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tag.description}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Context menu ───────────────────────────────────────────────────────────────
const ContextMenu: React.FC<{
  x: number; y: number;
  tag: TagEntry;
  onForce: () => void;
  onRelease: () => void;
  onRemove: () => void;
  onCrossRef: () => void;
  onClose: () => void;
}> = ({ x, y, tag, onForce, onRelease, onRemove, onCrossRef, onClose }) => {
  useEffect(() => {
    const handler = () => onClose();
    document.addEventListener('mousedown', handler);
    document.addEventListener('scroll', handler, true);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('scroll', handler, true);
    };
  }, [onClose]);

  const items: Array<{ label: string; action: () => void; danger?: boolean } | null> = [
    { label: 'Force value…', action: onForce },
    tag.forcedValue !== undefined ? { label: 'Release force', action: onRelease } : null,
    null,
    { label: 'Show cross-references', action: onCrossRef },
    null,
    { label: 'Remove from watch list', action: onRemove, danger: true },
  ].filter((x): x is { label: string; action: () => void; danger?: boolean } | null => x !== false);

  return (
    <div
      style={{
        position: 'fixed', left: x, top: y, zIndex: 9999,
        background: 'var(--vscode-menu-background, var(--vscode-editorWidget-background, #1e1e2e))',
        border: `1px solid ${T.border}`, borderRadius: 4,
        minWidth: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        paddingBlock: 4,
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item === null ? (
          <div key={i} style={{ height: 1, background: T.border, marginBlock: 3, marginInline: 8 }} />
        ) : (
          <div
            key={item.label}
            onClick={() => { item.action(); onClose(); }}
            style={{
              padding: '5px 14px', cursor: 'pointer',
              fontSize: 12, fontFamily: T.fontUI,
              color: item.danger ? 'var(--vscode-charts-red, #f38ba8)' : T.fg,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = T.bgRowHover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >{item.label}</div>
        )
      )}
    </div>
  );
};

// ── Simulated runtime value generator ─────────────────────────────────────────
// When monitorMode === 'running', this simulates live values for demo purposes.
// Real runtime adapter replaces this by calling logicStore.updateTagLiveValue().
function simulatedValue(tag: TagEntry, tick: number): string {
  const seed = tag.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const t = tick + seed;
  if (tag.dataType === 'BOOL') {
    // Inputs toggle slowly, outputs mirror input patterns
    if (tag.address.startsWith('%I')) return ((t >> 2) & 1) === 1 ? 'TRUE' : 'FALSE';
    if (tag.address.startsWith('%Q')) return ((t >> 1) & 1) === 1 ? 'TRUE' : 'FALSE';
    return ((t >> 3) & 1) === 1 ? 'TRUE' : 'FALSE';
  }
  if (['INT', 'UINT', 'DINT'].includes(tag.dataType)) {
    return String(Math.round(Math.sin(t / 20 + seed) * 1000));
  }
  if (['REAL', 'LREAL'].includes(tag.dataType)) {
    return (Math.sin(t / 15 + seed) * 100).toFixed(3);
  }
  if (['BYTE', 'WORD', 'DWORD'].includes(tag.dataType)) {
    return String((t * 7 + seed) & 0xff);
  }
  return '0';
}

// ── Column widths ──────────────────────────────────────────────────────────────
const COL = {
  forced: 20,
  name:   140,
  addr:   80,
  type:   70,
  value:  120,
  desc:   1,   // flex: 1
  action: 56,
};

// ── Header cell ───────────────────────────────────────────────────────────────
const Th: React.FC<{ w?: number; flex?: number; children: React.ReactNode }> = ({ w, flex, children }) => (
  <div style={{
    width: w, flex: flex, flexShrink: 0,
    padding: '0 6px', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: T.fgDim, userSelect: 'none',
    fontFamily: T.fontUI,
    display: 'flex', alignItems: 'center',
  }}>{children}</div>
);

// ── Main component ─────────────────────────────────────────────────────────────
export const TagMonitorPanel: React.FC = () => {
  const tagDatabase  = useLogicStoreSelector(s => s.tagDatabase);
  const watchedNames = useLogicStoreSelector(s => s.watchedTags);
  const monitorMode  = useLogicStoreSelector(s => s.monitorMode);
  const scanRate     = useLogicStoreSelector(s => s.scanRate);

  const watchedTags = tagDatabase.filter(t => watchedNames.includes(t.name));

  // ── Simulation tick ──────────────────────────────────────────────────────────
  // Will be replaced by the JS simulation engine worker postMessage stream.
  const tickRef = useRef(0);
  useEffect(() => {
    if (monitorMode !== 'running') return;
    const id = setInterval(() => {
      tickRef.current += 1;
      tagDatabase.forEach(tag => {
        if (!watchedNames.includes(tag.name)) return;
        if (tag.forcedValue !== undefined) return;
        logicStore.updateTagLiveValue(tag.name, simulatedValue(tag, tickRef.current));
      });
    }, Math.max(scanRate, 50));
    return () => clearInterval(id);
  }, [monitorMode, scanRate, tagDatabase, watchedNames]);

  // ── Force dialog state ───────────────────────────────────────────────────────
  const [forceTarget, setForceTarget] = useState<string | null>(null);

  // ── Add tag dropdown ─────────────────────────────────────────────────────────
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null!);

  // ── Context menu ─────────────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tagName: string } | null>(null);

  const openCtxMenu = useCallback((e: React.MouseEvent, tagName: string) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, tagName });
  }, []);

  const ctxTag = ctxMenu ? tagDatabase.find(t => t.name === ctxMenu.tagName) : null;

  // ── Toolbar actions ──────────────────────────────────────────────────────────
  const toggleMonitor = () => {
    if (monitorMode === 'running') logicStore.setMonitorMode('stopped');
    else logicStore.setMonitorMode('running');
  };

  const isRunning = monitorMode === 'running';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: T.bg,
      color: T.fg, fontSize: T.fontSize,
      fontFamily: T.fontUI, overflow: 'hidden',
    }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', flexShrink: 0,
        borderBottom: `1px solid ${T.border}`,
        background: T.bgHeader,
      }}>
        {/* Run/Stop toggle */}
        <button
          onClick={toggleMonitor}
          title={isRunning ? 'Stop monitoring' : 'Start monitoring'}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
            border: `1px solid ${isRunning ? 'var(--vscode-charts-red,#f38ba8)' : T.accent}`,
            background: isRunning ? 'rgba(243,139,168,0.15)' : 'rgba(0,122,204,0.15)',
            color: isRunning ? 'var(--vscode-charts-red,#f38ba8)' : T.accent,
            fontSize: 11, fontFamily: T.fontUI,
          }}
        >
          {isRunning ? (
            <>
              <svg width="9" height="9" viewBox="0 0 9 9"><rect width="9" height="9" fill="currentColor" rx="1"/></svg>
              Stop
            </>
          ) : (
            <>
              <svg width="9" height="9" viewBox="0 0 9 9"><polygon points="0,0 9,4.5 0,9" fill="currentColor"/></svg>
              Monitor
            </>
          )}
        </button>

        {/* Status dot */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.fgDim, fontSize: 10 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: isRunning ? 'var(--vscode-charts-green,#a6e3a1)' : T.fgDim,
            boxShadow: isRunning ? '0 0 5px var(--vscode-charts-green,#a6e3a1)' : 'none',
          }} />
          {monitorMode.charAt(0).toUpperCase() + monitorMode.slice(1)}
        </span>

        <div style={{ flex: 1 }} />

        {/* Scan rate display */}
        <span style={{ color: T.fgDim, fontSize: 10 }}>Scan: {scanRate}ms</span>

        <div style={{ width: 1, height: 14, background: T.border }} />

        {/* Add tag */}
        <div style={{ position: 'relative' }}>
          <button
            ref={addBtnRef}
            onClick={() => setShowAddDropdown(v => !v)}
            title="Add tag to watch list"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
              border: `1px solid ${T.border}`, background: T.btnBg,
              color: T.btnFg, fontSize: 11, fontFamily: T.fontUI,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = T.btnBgHover)}
            onMouseLeave={e => (e.currentTarget.style.background = T.btnBg)}
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="5" y1="1" x2="5" y2="9" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            Add Tag
          </button>
          {showAddDropdown && (
            <AddTagDropdown
              allTags={tagDatabase}
              watchedNames={watchedNames}
              onAdd={name => logicStore.addToWatchList(name)}
              onClose={() => setShowAddDropdown(false)}
              anchorRef={addBtnRef}
            />
          )}
        </div>

        {/* Add all */}
        <button
          onClick={() => logicStore.addAllTagsToWatchList()}
          title="Add all tags"
          style={{
            padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
            border: `1px solid ${T.border}`, background: T.btnBg,
            color: T.btnFg, fontSize: 11, fontFamily: T.fontUI,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = T.btnBgHover)}
          onMouseLeave={e => (e.currentTarget.style.background = T.btnBg)}
        >All</button>

        {/* Clear */}
        {watchedNames.length > 0 && (
          <button
            onClick={() => logicStore.clearWatchList()}
            title="Clear watch list"
            style={{
              padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
              border: `1px solid ${T.border}`, background: T.btnBg,
              color: 'var(--vscode-charts-red,#f38ba8)', fontSize: 11, fontFamily: T.fontUI,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = T.btnBgHover)}
            onMouseLeave={e => (e.currentTarget.style.background = T.btnBg)}
          >Clear</button>
        )}
      </div>

      {/* ── Table ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header row */}
        <div style={{
          display: 'flex', alignItems: 'center',
          height: 26, flexShrink: 0,
          borderBottom: `1px solid ${T.border}`,
          background: T.bgHeader,
          paddingInline: 4,
        }}>
          <Th w={COL.forced} />
          <Th w={COL.name}>Name</Th>
          <Th w={COL.addr}>Address</Th>
          <Th w={COL.type}>Type</Th>
          <Th w={COL.value}>Value</Th>
          <Th flex={1}>Description</Th>
          <Th w={COL.action} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {watchedTags.length === 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%',
              color: T.fgDim, fontSize: 12, gap: 8,
              fontFamily: T.fontUI,
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
              <span>No tags in watch list.</span>
              <span style={{ fontSize: 11 }}>Click <strong>Add Tag</strong> or <strong>All</strong> to start monitoring.</span>
            </div>
          )}

          {watchedTags.map((tag, idx) => {
            const isForced = tag.forcedValue !== undefined;
            const isBool   = tag.dataType === 'BOOL';
            const displayVal = isForced ? tag.forcedValue : tag.liveValue;

            return (
              <div
                key={tag.name}
                onContextMenu={e => openCtxMenu(e, tag.name)}
                style={{
                  display: 'flex', alignItems: 'center',
                  height: T.rowH, paddingInline: 4,
                  background: isForced
                    ? T.bgRowForced
                    : idx % 2 === 1 ? T.bgRow : 'transparent',
                  borderBottom: `1px solid ${T.border}`,
                  cursor: 'default',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = T.bgRowHover)}
                onMouseLeave={e => (e.currentTarget.style.background = isForced ? T.bgRowForced : idx % 2 === 1 ? T.bgRow : 'transparent')}
              >
                {/* Forced indicator */}
                <div style={{ width: COL.forced, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isForced && (
                    <span title="Value is forced" style={{ color: T.fgForced, fontSize: 10 }}>⚡</span>
                  )}
                </div>

                {/* Name */}
                <div style={{
                  width: COL.name, flexShrink: 0, paddingInline: 6,
                  fontFamily: T.font, fontSize: 11, fontWeight: 600,
                  color: isForced ? T.fgForced : T.fg,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }} title={tag.name}>{tag.name}</div>

                {/* Address */}
                <div style={{
                  width: COL.addr, flexShrink: 0, paddingInline: 6,
                  fontFamily: T.font, fontSize: 10,
                  color: addressColor(tag.address),
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{tag.address}</div>

                {/* Type */}
                <div style={{
                  width: COL.type, flexShrink: 0, paddingInline: 6,
                  fontSize: 10, color: typeColor(tag.dataType),
                }}>{tag.dataType}</div>

                {/* Value */}
                <div style={{
                  width: COL.value, flexShrink: 0, paddingInline: 6,
                  fontFamily: T.font, fontSize: 11,
                }}>
                  {isBool
                    ? boolPill(displayVal, isForced)
                    : numericValue(displayVal, isForced)
                  }
                </div>

                {/* Description */}
                <div style={{
                  flex: 1, paddingInline: 6, fontSize: 10, color: T.fgDim,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{tag.description ?? ''}</div>

                {/* Action buttons */}
                <div style={{
                  width: COL.action, flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 4, paddingInline: 4,
                }}>
                  {/* Force button */}
                  <button
                    onClick={() => setForceTarget(tag.name)}
                    title="Force value"
                    style={{
                      width: 22, height: 22, borderRadius: 3, cursor: 'pointer',
                      border: `1px solid ${isForced ? T.fgForced : T.border}`,
                      background: isForced ? 'rgba(249,226,175,0.12)' : T.btnBg,
                      color: isForced ? T.fgForced : T.fgDim,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, padding: 0,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = T.btnBgHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = isForced ? 'rgba(249,226,175,0.12)' : T.btnBg)}
                  >
                    {isForced ? '⚡' : 'F'}
                  </button>

                  {/* Release / Remove */}
                  <button
                    onClick={() => {
                      if (isForced) logicStore.releaseForce(tag.name);
                      else logicStore.removeFromWatchList(tag.name);
                    }}
                    title={isForced ? 'Release force' : 'Remove from watch list'}
                    style={{
                      width: 22, height: 22, borderRadius: 3, cursor: 'pointer',
                      border: `1px solid ${T.border}`,
                      background: T.btnBg, color: T.fgDim,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, padding: 0,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = T.btnBgHover;
                      e.currentTarget.style.color = isForced ? T.fgForced : 'var(--vscode-charts-red,#f38ba8)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = T.btnBg;
                      e.currentTarget.style.color = T.fgDim;
                    }}
                  >{isForced ? '✕' : '×'}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Force dialog ── */}
      {forceTarget && (() => {
        const tag = tagDatabase.find(t => t.name === forceTarget)!;
        return (
          <ForceDialog
            tag={tag}
            onConfirm={val => { logicStore.forceTag(forceTarget, val); setForceTarget(null); }}
            onCancel={() => setForceTarget(null)}
          />
        );
      })()}

      {/* ── Context menu ── */}
      {ctxMenu && ctxTag && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          tag={ctxTag}
          onForce={() => setForceTarget(ctxTag.name)}
          onRelease={() => logicStore.releaseForce(ctxTag.name)}
          onRemove={() => logicStore.removeFromWatchList(ctxTag.name)}
          onCrossRef={() => logicStore.openCrossRef(ctxTag.name)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
};
