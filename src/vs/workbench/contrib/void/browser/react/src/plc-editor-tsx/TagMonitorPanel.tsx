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

// All IEC data types for the selector
const ALL_DATA_TYPES: IECDataType[] = [
  'BOOL', 'INT', 'UINT', 'DINT', 'UDINT', 'LINT', 'ULINT',
  'REAL', 'LREAL', 'BYTE', 'WORD', 'DWORD', 'LWORD',
  'STRING', 'WSTRING', 'TIME', 'DATE', 'TOD', 'DT',
  'ARRAY_BOOL', 'ARRAY_INT', 'ARRAY_REAL', 'STRUCT',
];
import { simulationEngine } from './simulation/engine.js';
import { buildCLMFromStore } from './clm/builder.js';

// ── Tokens — strictly VS Code panel/terminal design tokens ────────────────────
const T = {
  bg:           'var(--vscode-panel-background, var(--vscode-editor-background))',
  bgRowHover:   'var(--vscode-list-hoverBackground)',
  bgRowForced:  'var(--vscode-list-warningForeground, rgba(255,170,0,0.08))',
  bgHeader:     'var(--vscode-sideBarSectionHeader-background, var(--vscode-editorGroupHeader-tabsBackground))',
  border:       'var(--vscode-panel-border, var(--vscode-editorGroup-border))',
  borderRow:    'var(--vscode-editorGroup-border)',
  fg:           'var(--vscode-foreground)',
  fgDim:        'var(--vscode-descriptionForeground)',
  fgForced:     'var(--vscode-editorWarning-foreground, #cca700)',
  fgTrue:       'var(--vscode-charts-green, #4ec9b0)',
  fgFalse:      'var(--vscode-descriptionForeground)',
  fgAddr:       'var(--vscode-textLink-foreground, #4fc1ff)',
  accent:       'var(--vscode-focusBorder, #007acc)',
  btnBg:        'transparent',
  btnFg:        'var(--vscode-descriptionForeground)',
  btnBgHover:   'var(--vscode-toolbar-hoverBackground, rgba(90,93,94,.31))',
  inputBg:      'var(--vscode-input-background)',
  inputBorder:  'var(--vscode-input-border)',
  font:         'var(--vscode-editor-font-family, monospace)',
  fontUI:       'var(--vscode-font-family, sans-serif)',
  fontSize:     12,
  rowH:         24,
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

// ── Value cell — plain text, terminal style ────────────────────────────────────
function renderValue(val: string | undefined, dataType: IECDataType, forced: boolean) {
  if (val === undefined || val === '') return <span style={{ color: T.fgDim, fontFamily: T.font }}>—</span>;
  if (dataType === 'BOOL') {
    const on = val === 'TRUE' || val === 'true' || val === '1';
    return (
      <span style={{
        fontFamily: T.font, fontSize: T.fontSize,
        color: forced ? T.fgForced : on ? T.fgTrue : T.fgFalse,
        fontWeight: on ? 600 : 400,
      }}>
        {on ? 'TRUE' : 'FALSE'}
      </span>
    );
  }
  return <span style={{ fontFamily: T.font, fontSize: T.fontSize, color: forced ? T.fgForced : T.fg }}>{val}</span>;
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

// ── Create Tag modal ──────────────────────────────────────────────────────────
const CreateTagModal: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const [name, setName]         = useState('');
  const [address, setAddress]   = useState('');
  const [dataType, setDataType] = useState<IECDataType>('BOOL');
  const [description, setDesc]  = useState('');
  const [retain, setRetain]     = useState(false);
  const [initialValue, setInitV] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const canSubmit = name.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    logicStore.createTag({
      name: name.trim(),
      address: address.trim(),
      dataType,
      description: description.trim() || undefined,
      retain: retain || undefined,
      initialValue: initialValue.trim() || undefined,
    });
    logicStore.addToWatchList(name.trim());
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: T.inputBg, border: `1px solid ${T.inputBorder}`,
    borderRadius: 4, padding: '5px 8px',
    color: T.fg, fontSize: 12, fontFamily: T.font,
    outline: 'none',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--vscode-editorWidget-background, #1e1e2e)',
        border: `1px solid ${T.border}`,
        borderRadius: 6, padding: '16px 20px', minWidth: 320,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ fontFamily: T.fontUI, fontSize: 12, fontWeight: 600, color: T.fg }}>
          Create New Tag
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: T.fgDim, marginBottom: 3, fontFamily: T.fontUI }}>Name *</div>
            <input ref={nameRef} value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onClose(); }}
              placeholder="e.g. MOTOR_RUN" style={inputStyle} />
          </div>
          <div style={{ width: 100 }}>
            <div style={{ fontSize: 10, color: T.fgDim, marginBottom: 3, fontFamily: T.fontUI }}>Address</div>
            <input value={address} onChange={e => setAddress(e.target.value)}
              placeholder="%Q0.0" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: T.fgDim, marginBottom: 3, fontFamily: T.fontUI }}>Data Type</div>
            <select value={dataType} onChange={e => setDataType(e.target.value as IECDataType)}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              {ALL_DATA_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: T.fgDim, marginBottom: 3, fontFamily: T.fontUI }}>Initial Value</div>
            <input value={initialValue} onChange={e => setInitV(e.target.value)}
              placeholder="e.g. FALSE or 0" style={inputStyle} />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, color: T.fgDim, marginBottom: 3, fontFamily: T.fontUI }}>Description</div>
          <input value={description} onChange={e => setDesc(e.target.value)}
            placeholder="Optional description" style={inputStyle} />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: T.fontUI, fontSize: 11, color: T.fg }}>
          <input type="checkbox" checked={retain} onChange={e => setRetain(e.target.checked)}
            style={{ accentColor: T.accent }} />
          RETAIN (persist value across restart)
        </label>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onClose} style={{
            padding: '5px 14px', borderRadius: 4, fontSize: 11,
            border: `1px solid ${T.border}`, background: T.btnBg,
            color: T.btnFg, cursor: 'pointer', fontFamily: T.fontUI,
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!canSubmit} style={{
            padding: '5px 14px', borderRadius: 4, fontSize: 11,
            border: `1px solid ${T.accent}`, background: canSubmit ? T.accent : 'transparent',
            color: canSubmit ? '#fff' : T.fgDim, cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontFamily: T.fontUI,
          }}>Create Tag</button>
        </div>
      </div>
    </div>
  );
};

// ── Simulated runtime value generator ─────────────────────────────────────────

// ── Column widths ──────────────────────────────────────────────────────────────
const COL = {
  forced: 16,   // forced indicator (⚡ or blank)
  name:   160,
  type:   50,
  value:  100,
  desc:   1,    // flex: 1
  action: 48,
};

// ── Header cell ───────────────────────────────────────────────────────────────
const Th: React.FC<{ w?: number; flex?: number; children?: React.ReactNode }> = ({ w, flex, children }) => (
  <div style={{
    width: w, flex: flex, flexShrink: 0,
    padding: '0 8px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
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

  // Live values now flow from simulationEngine → logicStore.batchUpdateTagValues automatically

  // ── Force dialog state ───────────────────────────────────────────────────────
  const [forceTarget, setForceTarget] = useState<string | null>(null);

  // ── Create tag modal ─────────────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);

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
    if (monitorMode === 'running') {
      simulationEngine.stop();
      logicStore.setMonitorMode('stopped');
    } else {
      const s = logicStore.getState();
      const clm = buildCLMFromStore(s.ladderProgram, s.fbdProgram, s.sfcProgram, s.tagDatabase);
      simulationEngine.start(clm, s.scanRate);
      logicStore.setMonitorMode('running');
    }
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
        padding: '3px 8px', flexShrink: 0,
        borderBottom: `1px solid ${T.border}`,
        background: T.bgHeader,
      }}>
        {/* Run/Stop toggle */}
        <button
          onClick={toggleMonitor}
          title={isRunning ? 'Stop monitoring' : 'Start monitoring'}
          style={{
            padding: '2px 10px', borderRadius: 2, cursor: 'pointer',
            border: `1px solid ${isRunning ? 'var(--vscode-charts-red,#cd3131)' : T.accent}`,
            background: 'transparent',
            color: isRunning ? 'var(--vscode-charts-red,#cd3131)' : T.accent,
            fontSize: 11, fontFamily: T.fontUI,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = T.btnBgHover)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >{isRunning ? 'Stop' : 'Run'}</button>

        {/* Status text */}
        <span style={{ color: isRunning ? T.fgTrue : T.fgDim, fontSize: 11, fontFamily: T.fontUI }}>
          {isRunning ? 'Running' : 'Stopped'}
        </span>

        <div style={{ flex: 1 }} />

        <span style={{ color: T.fgDim, fontSize: 11, fontFamily: T.fontUI }}>Scan: {scanRate}ms</span>
        <span style={{ color: T.fgDim }}>|</span>

        {/* New tag */}
        <button
          onClick={() => setShowCreateModal(true)}
          title="Create new tag"
          style={{
            padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
            border: `1px solid ${T.accent}`, background: T.btnBg,
            color: T.accent, fontSize: 11, fontFamily: T.fontUI,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = T.btnBgHover)}
          onMouseLeave={e => (e.currentTarget.style.background = T.btnBg)}
        >+ New</button>

        {/* Add tag */}
        <div style={{ position: 'relative' }}>
          <button
            ref={addBtnRef}
            onClick={() => setShowAddDropdown(v => !v)}
            title="Add tag to watch list"
            style={{
              padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
              border: `1px solid ${T.border}`, background: T.btnBg,
              color: T.btnFg, fontSize: 11, fontFamily: T.fontUI,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = T.btnBgHover)}
            onMouseLeave={e => (e.currentTarget.style.background = T.btnBg)}
          >Add Tag</button>
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

        <button onClick={() => logicStore.addAllTagsToWatchList()} title="Add all tags"
          style={{ padding: '2px 8px', borderRadius: 2, cursor: 'pointer', border: `1px solid ${T.border}`, background: T.btnBg, color: T.btnFg, fontSize: 11, fontFamily: T.fontUI }}
          onMouseEnter={e => (e.currentTarget.style.background = T.btnBgHover)}
          onMouseLeave={e => (e.currentTarget.style.background = T.btnBg)}
        >All</button>

        {watchedNames.length > 0 && (
          <button onClick={() => logicStore.clearWatchList()} title="Clear watch list"
            style={{ padding: '2px 8px', borderRadius: 2, cursor: 'pointer', border: `1px solid ${T.border}`, background: T.btnBg, color: T.fgDim, fontSize: 11, fontFamily: T.fontUI }}
            onMouseEnter={e => (e.currentTarget.style.background = T.btnBgHover)}
            onMouseLeave={e => (e.currentTarget.style.background = T.btnBg)}
          >Clear</button>
        )}
      </div>

      {/* ── Table ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* Column header */}
        <div style={{
          display: 'flex', alignItems: 'center', flexShrink: 0,
          height: 22, paddingInline: 4,
          background: T.bgHeader,
          borderBottom: `1px solid ${T.borderRow}`,
        }}>
          <Th w={COL.forced} />
          <Th w={COL.name}>Name</Th>
          <Th w={COL.type}>Type</Th>
          <Th w={COL.value}>Value</Th>
          <Th flex={1}>Description</Th>
          <Th w={COL.action} />
        </div>

        {/* Rows */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {watchedTags.length === 0 ? (
            <div style={{
              padding: '16px 12px',
              color: T.fgDim, fontSize: 11,
              fontFamily: T.fontUI,
            }}>
              No tags in watch list. Click <strong>Add Tag</strong> or <strong>All</strong>.
            </div>
          ) : watchedTags.map((tag) => {
            const isForced   = tag.forcedValue !== undefined;
            const displayVal = isForced ? tag.forcedValue : tag.liveValue;

            return (
              <div
                key={tag.name}
                onContextMenu={e => openCtxMenu(e, tag.name)}
                style={{
                  display: 'flex', alignItems: 'center',
                  height: T.rowH, paddingInline: 4,
                  borderBottom: `1px solid ${T.borderRow}`,
                  background: 'transparent',
                  outline: isForced ? `1px solid ${T.fgForced}` : 'none',
                  outlineOffset: -1,
                  cursor: 'default',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = T.bgRowHover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Forced marker */}
                <div style={{ width: COL.forced, flexShrink: 0, textAlign: 'center', fontSize: 9, color: T.fgForced }}>
                  {isForced ? '*' : ''}
                </div>

                {/* Name */}
                <div style={{
                  width: COL.name, flexShrink: 0, paddingInline: 8,
                  fontFamily: T.font, fontSize: T.fontSize, fontWeight: isForced ? 600 : 400,
                  color: isForced ? T.fgForced : T.fg,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }} title={tag.name}>{tag.name}</div>

                {/* Type */}
                <div style={{
                  width: COL.type, flexShrink: 0, paddingInline: 8,
                  fontFamily: T.font, fontSize: 10, color: T.fgDim,
                }}>{tag.dataType}</div>

                {/* Value */}
                <div style={{ width: COL.value, flexShrink: 0, paddingInline: 8 }}>
                  {renderValue(displayVal, tag.dataType, isForced)}
                </div>

                {/* Description */}
                <div style={{
                  flex: 1, paddingInline: 8, fontSize: 11, color: T.fgDim,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontFamily: T.fontUI,
                }}>{tag.description ?? ''}</div>

                {/* Actions: Force + Remove */}
                <div style={{
                  width: COL.action, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  gap: 2, paddingRight: 4,
                }}>
                  <button
                    onClick={() => setForceTarget(tag.name)}
                    title={isForced ? 'Change forced value' : 'Force value'}
                    style={{
                      padding: '1px 5px', borderRadius: 2, cursor: 'pointer',
                      border: 'none', background: T.btnBg,
                      color: isForced ? T.fgForced : T.btnFg,
                      fontSize: 10, fontFamily: T.fontUI,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = T.btnBgHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = T.btnBg)}
                  >F</button>
                  <button
                    onClick={() => isForced ? logicStore.releaseForce(tag.name) : logicStore.removeFromWatchList(tag.name)}
                    title={isForced ? 'Release force' : 'Remove'}
                    style={{
                      padding: '1px 5px', borderRadius: 2, cursor: 'pointer',
                      border: 'none', background: T.btnBg, color: T.btnFg,
                      fontSize: 11, fontFamily: T.fontUI,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = T.btnBgHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = T.btnBg)}
                  >×</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Create tag modal ── */}
      {showCreateModal && (
        <CreateTagModal onClose={() => setShowCreateModal(false)} />
      )}

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
