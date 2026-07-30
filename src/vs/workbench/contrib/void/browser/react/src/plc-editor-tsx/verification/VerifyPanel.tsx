/*
 * VerifyPanel — Formal verification UI panel.
 *
 * Layout:
 *   ┌─────────────────────────────────────┐
 *   │ VERIFY                    [Run All] │
 *   ├─────────────────────────────────────┤
 *   │ Properties (user-defined list)      │
 *   │  ├─ ✓ Motor mutual exclusion  SAFE │
 *   │  ├─ ✗ Pressure invariant  VIOLATED │
 *   │  └─ ? Response timeout  UNKNOWN    │
 *   ├─────────────────────────────────────┤
 *   │ + Add Property                      │
 *   ├─────────────────────────────────────┤
 *   │ Results / Counterexample viewer     │
 *   └─────────────────────────────────────┘
 */

import React, { useState, useCallback } from 'react';
import {
  useVerificationStore,
  useVerificationStoreSelector,
  verificationStore,
} from './verificationStore.js';
import { startVerificationRun, cancelVerificationRun, checkEngineAvailability } from './engineBackend.js';
import { counterexampleReplayer } from './counterexampleReplay.js';
import type {
  VerificationProperty,
  PropertyResult,
  CounterexampleTrace,
  PropertyKind,
  VerificationVerdict,
} from './types.js';

// ─── Design Tokens (matches TagMonitorPanel / ExportPanel conventions) ────────

const T = {
  bg: 'var(--vscode-panel-background, var(--vscode-editor-background))',
  bgHeader: 'var(--vscode-sideBarSectionHeader-background, var(--vscode-editorGroupHeader-tabsBackground))',
  bgHover: 'var(--vscode-list-hoverBackground)',
  bgSelected: 'var(--vscode-list-activeSelectionBackground)',
  border: 'var(--vscode-panel-border, var(--vscode-editorGroup-border))',
  borderSection: 'var(--vscode-sideBarSectionHeader-border, var(--vscode-widget-border, rgba(255,255,255,0.1)))',
  fg: 'var(--vscode-foreground)',
  fgDim: 'var(--vscode-descriptionForeground)',
  fgSelected: 'var(--vscode-list-activeSelectionForeground)',
  accent: 'var(--vscode-focusBorder, #007acc)',
  btnBg: 'var(--vscode-button-background)',
  btnFg: 'var(--vscode-button-foreground)',
  btnSecBg: 'var(--vscode-button-secondaryBackground, #3c3c3c)',
  btnSecFg: 'var(--vscode-button-secondaryForeground, #ccc)',
  btnHover: 'var(--vscode-toolbar-hoverBackground, rgba(90,93,94,.31))',
  inputBg: 'var(--vscode-input-background)',
  inputFg: 'var(--vscode-input-foreground)',
  inputBorder: 'var(--vscode-input-border, transparent)',
  dropdownBg: 'var(--vscode-dropdown-background)',
  dropdownFg: 'var(--vscode-dropdown-foreground)',
  dropdownBorder: 'var(--vscode-dropdown-border, transparent)',
  font: 'var(--vscode-editor-font-family, monospace)',
  fontUI: 'var(--vscode-font-family, sans-serif)',
  safe: 'var(--vscode-charts-green, #4ec9b0)',
  violated: 'var(--vscode-charts-red, #f38ba8)',
  warning: 'var(--vscode-editorWarning-foreground, #f9e2af)',
  info: 'var(--vscode-editorInfo-foreground, #89dceb)',
  unknown: 'var(--vscode-descriptionForeground)',
  purple: 'var(--vscode-charts-purple, #a78bfa)',
};

// ─── Verdict Colors ──────────────────────────────────────────────────────────

const VERDICT_COLORS: Record<VerificationVerdict, string> = {
  SAFE: T.safe,
  VIOLATION: T.violated,
  UNKNOWN: T.unknown,
  TIMEOUT: T.warning,
  UNSUPPORTED: T.purple,
};

const VERDICT_ICONS: Record<VerificationVerdict, string> = {
  SAFE: '✓',
  VIOLATION: '✗',
  UNKNOWN: '?',
  TIMEOUT: '⏱',
  UNSUPPORTED: '⚠',
};

// ─── Codicon helper (same pattern as ExportPanel) ────────────────────────────

const Codicon: React.FC<{ name: string; style?: React.CSSProperties }> = ({ name, style }) => (
  <span
    className={`codicon codicon-${name}`}
    style={{ fontSize: 14, width: 14, height: 14, display: 'inline-flex', alignItems: 'center',
             justifyContent: 'center', flexShrink: 0, lineHeight: 1, ...style }}
  />
);

// ─── Verdict Badge ───────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: VerificationVerdict }) {
  const color = VERDICT_COLORS[verdict];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600,
      background: `color-mix(in srgb, ${color} 12%, transparent)`,
      color, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
    }}>
      {VERDICT_ICONS[verdict]} {verdict}
    </span>
  );
}

// ─── Property Row ────────────────────────────────────────────────────────────

function PropertyRow({ prop, result, selected, onSelect, onRemove }: {
  prop: VerificationProperty;
  result?: PropertyResult;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', padding: '5px 8px', gap: 8,
        cursor: 'pointer', borderRadius: 3, marginBottom: 1,
        background: selected ? T.bgSelected : hovered ? T.bgHover : 'transparent',
        color: selected ? T.fgSelected : T.fg,
      }}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Codicon
        name={result?.verdict === 'SAFE' ? 'shield' : result?.verdict === 'VIOLATION' ? 'error' : 'question'}
        style={{ color: result ? VERDICT_COLORS[result.verdict] : T.fgDim }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 10, color: T.fgDim, marginRight: 6 }}>
          {prop.kind.replace(/_/g, ' ')}
        </span>
        <span style={{ fontSize: 12 }}>{prop.label}</span>
      </span>
      {result && <VerdictBadge verdict={result.verdict} />}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: T.fgDim, fontSize: 14, padding: '0 2px', lineHeight: 1,
          opacity: hovered ? 1 : 0, transition: 'opacity 0.1s',
        }}
        title="Remove property"
      >
        <Codicon name="close" style={{ fontSize: 12 }} />
      </button>
    </div>
  );
}

// ─── Add Property Form ───────────────────────────────────────────────────────

const PROPERTY_KINDS: { value: PropertyKind; label: string; icon: string }[] = [
  { value: 'mutual_exclusion', label: 'Mutual Exclusion', icon: 'lock' },
  { value: 'invariant', label: 'Invariant (always true)', icon: 'verified' },
  { value: 'absence', label: 'Absence (never true)', icon: 'circle-slash' },
  { value: 'response', label: 'Response (if A then eventually B)', icon: 'arrow-right' },
  { value: 'reachability', label: 'Reachability (must be possible)', icon: 'target' },
];

function AddPropertyForm({ onAdd }: { onAdd: (prop: VerificationProperty) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [kind, setKind] = useState<PropertyKind>('mutual_exclusion');
  const [label, setLabel] = useState('');
  const [field1, setField1] = useState('');
  const [field2, setField2] = useState('');
  const [field3, setField3] = useState('');

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '5px 8px', fontSize: 12,
    background: T.inputBg, color: T.inputFg,
    border: `1px solid ${T.inputBorder}`, borderRadius: 3, outline: 'none',
    fontFamily: T.font,
  };

  const selectStyle: React.CSSProperties = {
    padding: '4px 8px', fontSize: 11, width: '100%',
    background: T.dropdownBg, color: T.dropdownFg,
    border: `1px solid ${T.dropdownBorder}`, borderRadius: 3,
  };

  const handleAdd = () => {
    if (!label.trim()) return;
    const id = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    let prop: VerificationProperty;
    switch (kind) {
      case 'mutual_exclusion':
        prop = { kind, id, label, tags: field1.split(',').map(t => t.trim()).filter(Boolean) };
        break;
      case 'invariant':
        prop = { kind, id, label, expression: field1 };
        break;
      case 'absence':
        prop = { kind, id, label, expression: field1 };
        break;
      case 'response':
        prop = { kind, id, label, trigger: field1, response: field2, withinScans: field3 ? parseInt(field3) : undefined };
        break;
      case 'reachability':
        prop = { kind, id, label, expression: field1 };
        break;
    }

    onAdd(prop!);
    setLabel('');
    setField1('');
    setField2('');
    setField3('');
    setExpanded(false);
  };

  if (!expanded) {
    return (
      <div style={{ padding: '8px 12px' }}>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'transparent', border: `1px dashed ${T.borderSection}`,
            borderRadius: 3, padding: '5px 10px', cursor: 'pointer',
            color: T.fgDim, fontSize: 11, width: '100%', justifyContent: 'center',
          }}
          onClick={() => setExpanded(true)}
        >
          <Codicon name="add" style={{ fontSize: 12 }} /> Add Safety Property
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '10px 12px', borderTop: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <select style={selectStyle} value={kind} onChange={e => setKind(e.target.value as PropertyKind)}>
        {PROPERTY_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
      </select>

      <input
        style={inputStyle}
        placeholder="Label (e.g. Motor A/B mutual exclusion)"
        value={label}
        onChange={e => setLabel(e.target.value)}
      />

      {kind === 'mutual_exclusion' && (
        <input style={inputStyle} placeholder="Tags (comma-separated, e.g. Motor_A, Motor_B)" value={field1} onChange={e => setField1(e.target.value)} />
      )}
      {(kind === 'invariant' || kind === 'absence' || kind === 'reachability') && (
        <input style={inputStyle} placeholder="ST boolean expression (e.g. NOT (Pump_On AND Valve_Closed))" value={field1} onChange={e => setField1(e.target.value)} />
      )}
      {kind === 'response' && (<>
        <input style={inputStyle} placeholder="Trigger expression (when this becomes TRUE...)" value={field1} onChange={e => setField1(e.target.value)} />
        <input style={inputStyle} placeholder="Response expression (...this must eventually become TRUE)" value={field2} onChange={e => setField2(e.target.value)} />
        <input style={inputStyle} placeholder="Within N scan cycles (optional, default 100)" value={field3} onChange={e => setField3(e.target.value)} />
      </>)}

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 3, cursor: 'pointer', background: T.btnBg, color: T.btnFg }}
          onClick={handleAdd}
        >Add</button>
        <button
          style={{ padding: '4px 12px', fontSize: 11, border: 'none', borderRadius: 3, cursor: 'pointer', background: T.btnSecBg, color: T.btnSecFg }}
          onClick={() => setExpanded(false)}
        >Cancel</button>
      </div>
    </div>
  );
}

// ─── Counterexample Viewer ───────────────────────────────────────────────────

function CounterexampleViewer({ trace, propertyLabel }: { trace: CounterexampleTrace; propertyLabel: string }) {
  const [selectedStep, setSelectedStep] = useState(0);
  const [replaying, setReplaying] = useState(false);
  const step = trace.steps[selectedStep];

  const handleReplay = () => {
    if (replaying) {
      counterexampleReplayer.stop();
      setReplaying(false);
    } else {
      counterexampleReplayer.load(trace);
      counterexampleReplayer.onStepChange((step) => setSelectedStep(step));
      counterexampleReplayer.play(600);
      setReplaying(true);
    }
  };

  const handleStepClick = (i: number) => {
    setSelectedStep(i);
    if (replaying) {
      counterexampleReplayer.stepTo(i);
    }
  };

  return (
    <div style={{ padding: '10px 12px', borderTop: `1px solid ${T.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: T.fgDim, flex: 1 }}>
          Counterexample — {propertyLabel}
        </span>
        <button
          onClick={handleReplay}
          style={{
            padding: '2px 8px', fontSize: 10, fontWeight: 600, border: 'none', borderRadius: 3, cursor: 'pointer',
            background: replaying ? `color-mix(in srgb, ${T.violated} 15%, transparent)` : T.btnBg,
            color: replaying ? T.violated : T.btnFg,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <Codicon name={replaying ? 'debug-stop' : 'debug-start'} style={{ fontSize: 11 }} />
          {replaying ? 'Stop' : 'Replay on Canvas'}
        </button>
      </div>
      <div style={{ marginBottom: 8, fontSize: 11, color: T.fgDim }}>
        {trace.steps.length} scan cycles to violation
        {trace.loopStart !== undefined && ` (loops from cycle ${trace.loopStart})`}
      </div>

      <div style={{ display: 'flex', gap: 3, marginBottom: 10, flexWrap: 'wrap' }}>
        {trace.steps.map((_, i) => (
          <button
            key={i}
            onClick={() => handleStepClick(i)}
            style={{
              padding: '2px 6px', fontSize: 10, fontWeight: 500,
              borderRadius: 3, cursor: 'pointer',
              background: i === selectedStep ? T.btnBg : T.inputBg,
              color: i === selectedStep ? T.btnFg : T.fg,
              border: i === trace.steps.length - 1 ? `1px solid ${T.violated}` : `1px solid transparent`,
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {step && (
        <div style={{ fontFamily: T.font, fontSize: 11 }}>
          <div style={{ color: T.fgDim, marginBottom: 4 }}>
            Scan cycle {step.scanCycle}:
          </div>
          {Object.entries(step.tagValues).map(([tag, value]) => (
            <div key={tag} style={{
              display: 'flex', justifyContent: 'space-between', padding: '2px 4px',
              borderBottom: `1px solid ${T.border}`,
            }}>
              <span style={{ color: T.fg }}>{tag}</span>
              <span style={{ color: typeof value === 'boolean' ? (value ? T.safe : T.fgDim) : T.warning, fontFamily: T.font }}>
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Summary Bar ─────────────────────────────────────────────────────────────

function SummaryBar() {
  const summary = verificationStore.getSummary();
  const latestRun = verificationStore.getLatestRun();

  if (!latestRun || latestRun.status !== 'complete') return null;

  const badgeStyle = (color: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 3,
    padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    color, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
  });

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', borderBottom: `1px solid ${T.border}` }}>
      <span style={badgeStyle(T.safe)}>{summary.safe} safe</span>
      {summary.violated > 0 && <span style={badgeStyle(T.violated)}>{summary.violated} violated</span>}
      {summary.unknown > 0 && <span style={badgeStyle(T.unknown)}>{summary.unknown} unknown</span>}
      <span style={{ marginLeft: 'auto', fontSize: 10, color: T.fgDim, fontFamily: T.font }}>
        {latestRun.totalTimeMs}ms
      </span>
    </div>
  );
}

// ─── Engine Status ───────────────────────────────────────────────────────────

function EngineStatus() {
  const available = useVerificationStoreSelector(s => s.engineAvailable);
  const config = useVerificationStoreSelector(s => s.engineConfig);

  return (
    <div style={{ padding: '8px 12px', borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.fgDim }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: available ? T.safe : T.unknown, flexShrink: 0 }} />
        <span style={{ color: available ? T.safe : T.fgDim }}>
          {available ? `ESBMC-PLC+ ready (${config.mode})` : 'ESBMC-PLC+ not detected'}
        </span>
        <span
          title="Re-check engine"
          style={{ marginLeft: 'auto', cursor: 'pointer', color: T.fgDim, display: 'flex', alignItems: 'center', padding: '2px 4px', borderRadius: 3 }}
          onClick={() => checkEngineAvailability()}
          onMouseEnter={e => (e.currentTarget.style.color = T.fg)}
          onMouseLeave={e => (e.currentTarget.style.color = T.fgDim)}
        >
          <Codicon name="refresh" style={{ fontSize: 12 }} />
        </span>
      </div>
      {!available && (
        <div style={{ marginTop: 6, lineHeight: 1.5 }}>
          Install ESBMC-PLC+ for formal verification (k-induction proofs). Without it, only structural validation is available.
          Properties defined here will be verified once the engine is detected.
        </div>
      )}
    </div>
  );
}

// ─── Unsupported Blocks Warning ──────────────────────────────────────────────

function UnsupportedWarning({ blocks }: { blocks: string[] }) {
  if (blocks.length === 0) return null;
  return (
    <div style={{
      margin: '0 12px', padding: '6px 8px', fontSize: 10, borderRadius: 3,
      color: T.warning, background: `color-mix(in srgb, ${T.warning} 8%, transparent)`,
      border: `1px solid color-mix(in srgb, ${T.warning} 20%, transparent)`,
      display: 'flex', alignItems: 'flex-start', gap: 6,
    }}>
      <Codicon name="warning" style={{ color: T.warning, fontSize: 12, marginTop: 1 }} />
      <span>
        {blocks.length} function block(s) unsupported — nondeterministic over-approximation used: {blocks.join(', ')}.
        Result may be vacuously SAFE for logic involving these blocks.
      </span>
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export const VerifyPanel: React.FC = () => {
  const state = useVerificationStore();
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);
  const isRunning = state.currentRunId !== null;

  const latestResults = state.runs[0]?.results ?? [];
  const resultMap = new Map(latestResults.map(r => [r.propertyId, r]));

  const handleRun = useCallback(() => {
    if (isRunning) {
      cancelVerificationRun(state.currentRunId!);
    } else {
      if (state.properties.length === 0) return;
      startVerificationRun();
    }
  }, [isRunning, state.currentRunId, state.properties.length]);

  const selectedResult = selectedPropId ? resultMap.get(selectedPropId) : undefined;
  const selectedProp = state.properties.find(p => p.id === selectedPropId);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
      fontFamily: T.fontUI, fontSize: 12, background: T.bg, color: T.fg,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 12px', gap: 8,
        borderBottom: `1px solid ${T.border}`, background: T.bgHeader,
      }}>
        <Codicon name="shield" style={{ color: T.accent, fontSize: 14 }} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.fg }}>
          Verify
        </span>
        <span style={{ flex: 1 }} />
        {isRunning && (
          <span style={{ fontSize: 10, color: T.fgDim, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Codicon name="loading~spin" style={{ fontSize: 12 }} /> Verifying...
          </span>
        )}
        <button
          style={{
            padding: '3px 10px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 3, cursor: 'pointer',
            background: isRunning ? `color-mix(in srgb, ${T.violated} 15%, transparent)` : T.btnBg,
            color: isRunning ? T.violated : T.btnFg,
            opacity: !isRunning && state.properties.length === 0 ? 0.5 : 1,
          }}
          onClick={handleRun}
          disabled={!isRunning && state.properties.length === 0}
        >
          {isRunning ? 'Cancel' : 'Run All'}
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <SummaryBar />

        {/* Properties list */}
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: T.fgDim, marginBottom: 6 }}>
            Safety Properties ({state.properties.length})
          </div>
          {state.properties.length === 0 && (
            <div style={{ color: T.fgDim, fontSize: 11, padding: '4px 0', lineHeight: 1.5 }}>
              Define safety properties to formally verify your PLC logic. Properties are mathematically proven to hold for all reachable states using k-induction.
            </div>
          )}
          {state.properties.map(prop => (
            <PropertyRow
              key={prop.id}
              prop={prop}
              result={resultMap.get(prop.id)}
              selected={selectedPropId === prop.id}
              onSelect={() => setSelectedPropId(selectedPropId === prop.id ? null : prop.id)}
              onRemove={() => verificationStore.removeProperty(prop.id)}
            />
          ))}
        </div>

        <AddPropertyForm onAdd={(prop) => verificationStore.addProperty(prop)} />

        {/* Unsupported blocks warning */}
        {selectedResult?.unsupportedBlocks && selectedResult.unsupportedBlocks.length > 0 && (
          <UnsupportedWarning blocks={selectedResult.unsupportedBlocks} />
        )}

        {/* Counterexample viewer */}
        {selectedResult?.counterexample && selectedProp && (
          <CounterexampleViewer
            trace={selectedResult.counterexample}
            propertyLabel={selectedProp.label}
          />
        )}

        {/* Result detail (when no counterexample) */}
        {selectedResult && !selectedResult.counterexample && (
          <div style={{ padding: '10px 12px', borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: T.fgDim, marginBottom: 6 }}>
              Result Detail
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.6 }}>
              <VerdictBadge verdict={selectedResult.verdict} />
              <div style={{ marginTop: 6, color: T.fgDim }}>{selectedResult.message}</div>
              <div style={{ marginTop: 2, color: T.fgDim, fontFamily: T.font }}>
                Time: {selectedResult.timeMs}ms
              </div>
            </div>
          </div>
        )}

        <EngineStatus />
      </div>
    </div>
  );
};
