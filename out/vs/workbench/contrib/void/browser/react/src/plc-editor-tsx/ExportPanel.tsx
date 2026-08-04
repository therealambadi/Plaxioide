/*
 * ExportPanel — full-page export view mounted as a VS Code editor tab.
 * Renders the same ExportSection content but expanded full-height, no
 * collapsible wrapper — the tab chrome acts as the section header.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { logicStore, useLogicStoreSelector } from './logicStore.js';
import { exportVendorFile, getVendorDisplayName, getVendorExtension } from './vendor/unifiedExportService.js';
import { buildCLMFromStore } from './clm/builder.js';
import { validateCLM } from './clm/validator.js';
import type { VendorFormat } from './vendor/types.js';
import type { ValidationError } from './clm/validator.js';

// ─── Codicon ──────────────────────────────────────────────────────────────────
const Codicon: React.FC<{ name: string; style?: React.CSSProperties }> = ({ name, style }) => (
  <span
    className={`codicon codicon-${name}`}
    style={{ fontSize: 14, width: 14, height: 14, display: 'inline-flex', alignItems: 'center',
             justifyContent: 'center', flexShrink: 0, lineHeight: 1, ...style }}
  />
);

// ─── Format metadata ──────────────────────────────────────────────────────────
interface FormatMeta {
  id: VendorFormat;
  label: string;
  vendor: string;
  ext: string;
  icon: string;
  iconColor: string;
  description: string;
}

const FORMATS: FormatMeta[] = [
  {
    id: 'rockwell_l5x',
    label: 'Rockwell L5X',
    vendor: 'Studio 5000 / RSLogix',
    ext: '.L5X',
    icon: 'circuit-board',
    iconColor: 'var(--vscode-charts-red,#f38ba8)',
    description: 'ControlLogix / CompactLogix ladder XML',
  },
  {
    id: 'siemens_simatic_ml',
    label: 'Siemens SimaticML',
    vendor: 'TIA Portal',
    ext: '.xml',
    icon: 'symbol-namespace',
    iconColor: 'var(--vscode-charts-blue,#60a5fa)',
    description: 'LAD/FBD network blocks for SIMATIC S7',
  },
  {
    id: 'schneider_xef',
    label: 'Schneider XEF',
    vendor: 'EcoStruxure / Unity Pro',
    ext: '.XEF',
    icon: 'symbol-enum',
    iconColor: 'var(--vscode-charts-green,#4ade80)',
    description: 'Modicon M340 / M580 project archive',
  },
  {
    id: 'plcopen_xml',
    label: 'PLCopen XML',
    vendor: 'CODESYS / Mitsubishi / vendor-neutral',
    ext: '.xml',
    icon: 'globe',
    iconColor: 'var(--vscode-charts-purple,#a78bfa)',
    description: 'IEC 61131-3 TC6 standard interchange format',
  },
];

const FORMAT_VERSION_OPTIONS: Partial<Record<VendorFormat, { key: string; label: string; options: string[] }>> = {
  rockwell_l5x: {
    key: 'schemaRevision',
    label: 'L5X Schema Revision',
    options: ['1.0', '18.0', '20.0', '21.0', '24.0', '26.0', '28.0', '32.0', '34.0'],
  },
  siemens_simatic_ml: {
    key: 'tiaVersion',
    label: 'TIA Portal Version',
    options: ['15.1', '16.0', '17.0', '18.0', '19.0'],
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const PanelSection: React.FC<{ title: string; children: React.ReactNode; badge?: React.ReactNode }> = ({ title, badge, children }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
      paddingBottom: 6, borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border,var(--vscode-widget-border,rgba(255,255,255,0.1)))',
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
        color: 'var(--vscode-sideBarSectionHeader-foreground)', flex: 1 }}>
        {title}
      </span>
      {badge}
    </div>
    {children}
  </div>
);

const FormatCard: React.FC<{ fmt: FormatMeta; selected: boolean; onSelect: () => void }> = ({ fmt, selected, onSelect }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
        cursor: 'pointer', userSelect: 'none', boxSizing: 'border-box',
        borderRadius: 5, marginBottom: 4,
        border: selected
          ? '1px solid var(--vscode-focusBorder,#007acc)'
          : '1px solid var(--vscode-widget-border,rgba(255,255,255,0.1))',
        background: selected
          ? 'var(--vscode-list-activeSelectionBackground)'
          : hov ? 'var(--vscode-list-hoverBackground)' : 'var(--vscode-input-background)',
        color: selected ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-foreground)',
        transition: 'background 80ms, border-color 80ms',
      }}
    >
      <Codicon name={fmt.icon} style={{ color: fmt.iconColor, fontSize: 20, width: 20, height: 20, marginTop: 2 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, lineHeight: '18px' }}>
          {fmt.label}
          <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginLeft: 6 }}>{fmt.ext}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginTop: 1 }}>{fmt.vendor}</div>
        <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginTop: 2 }}>{fmt.description}</div>
      </div>
    </div>
  );
};

const SevIcon: React.FC<{ sev: 'error' | 'warning' | 'info' }> = ({ sev }) => {
  const color = sev === 'error' ? 'var(--vscode-editorError-foreground,#f38ba8)'
    : sev === 'warning' ? 'var(--vscode-editorWarning-foreground,#f9e2af)'
    : 'var(--vscode-editorInfo-foreground,#89dceb)';
  return <Codicon name={sev === 'error' ? 'error' : sev === 'warning' ? 'warning' : 'info'} style={{ color, fontSize: 13 }} />;
};

interface HistoryEntry {
  id: string;
  timestamp: number;
  format: VendorFormat;
  filename: string;
  pouCount: number;
  tagCount: number;
  unmappedCount: number;
  warnings: string[];
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export const ExportPanel: React.FC = () => {
  const pous = useLogicStoreSelector(s => s.pous);
  const tagDatabase = useLogicStoreSelector(s => s.tagDatabase);
  const ladderProgram = useLogicStoreSelector(s => s.ladderProgram);
  const fbdProgram = useLogicStoreSelector(s => s.fbdProgram);
  const sfcProgram = useLogicStoreSelector(s => s.sfcProgram);
  const importedSidecar = useLogicStoreSelector(s => s.importedSidecar);

  const [selectedFormat, setSelectedFormat] = useState<VendorFormat>('plcopen_xml');
  const [versionOverride, setVersionOverride] = useState<string>('');
  const [scopeAll, setScopeAll] = useState(true);
  const [selectedPouIds, setSelectedPouIds] = useState<Set<string>>(new Set());
  const [filename, setFilename] = useState('export');
  const [exporting, setExporting] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; summary: string } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Live CLM validation — updates whenever any diagram slice changes
  const validationErrors = useMemo<ValidationError[]>(() => {
    try {
      const state = logicStore.getState();
      const clm = buildCLMFromStore(state.ladderProgram, state.fbdProgram, state.sfcProgram, state.tagDatabase);
      return validateCLM(clm);
    } catch { return []; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ladderProgram, fbdProgram, sfcProgram, tagDatabase]);

  const blockingErrors = validationErrors.filter(e => e.severity === 'error');
  const warnings = validationErrors.filter(e => e.severity === 'warning');
  const hasBlockingErrors = blockingErrors.length > 0;

  useEffect(() => {
    const base = importedSidecar?.originalFilePath
      ? importedSidecar.originalFilePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'export'
      : 'export';
    setFilename(base);
  }, [selectedFormat, importedSidecar]);

  useEffect(() => {
    const verMeta = FORMAT_VERSION_OPTIONS[selectedFormat];
    if (!verMeta) { setVersionOverride(''); return; }
    const fromSidecar = importedSidecar?.vendorSpecificGlobals?.[verMeta.key];
    const defaults: Record<string, string> = { schemaRevision: '1.0', tiaVersion: '17.0' };
    setVersionOverride(String(fromSidecar ?? defaults[verMeta.key] ?? ''));
  }, [selectedFormat, importedSidecar]);

  const togglePou = useCallback((id: string) => {
    setSelectedPouIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleExport = useCallback(async () => {
    if (hasBlockingErrors) return;
    setExporting(true);
    setLastResult(null);
    try {
      const verMeta = FORMAT_VERSION_OPTIONS[selectedFormat];
      const versionOverrides = verMeta && versionOverride ? { [verMeta.key]: versionOverride } : undefined;
      const effectivePouIds = scopeAll ? undefined : [...selectedPouIds];

      const result = await exportVendorFile({
        format: selectedFormat,
        sidecar: importedSidecar ?? undefined,
        projectName: filename,
        scopePouIds: effectivePouIds,
        versionOverrides,
      });

      if (!result.ok) {
        setLastResult({ ok: false, summary: `Export failed: ${result.errors.join('; ')}` });
        return;
      }

      const ext = getVendorExtension(selectedFormat);
      const blob = new Blob([result.xmlContent ?? ''], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const state = logicStore.getState();
      const exportedPous = (effectivePouIds && effectivePouIds.length > 0)
        ? state.pous.filter(p => effectivePouIds.includes(p.id))
        : state.pous;
      const pouCount = exportedPous.length || 1;
      const tagCount = state.tagDatabase.length;
      const unmappedCount = importedSidecar?.unmappedElements?.length ?? 0;

      const parts = [
        `Exported to ${filename}${ext}`,
        `${pouCount} POU(s)`, `${tagCount} tag(s)`,
        unmappedCount > 0 ? `${unmappedCount} element(s) preserved via sidecar` : null,
        result.warnings.length > 0 ? `${result.warnings.length} warning(s)` : null,
      ].filter(Boolean).join(' · ');

      setLastResult({ ok: true, summary: parts });
      setHistory(prev => [{
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        format: selectedFormat,
        filename: `${filename}${ext}`,
        pouCount, tagCount, unmappedCount,
        warnings: result.warnings,
      }, ...prev.slice(0, 19)]);

    } catch (err) {
      setLastResult({ ok: false, summary: `Export error: ${err}` });
    } finally {
      setExporting(false);
    }
  }, [hasBlockingErrors, selectedFormat, versionOverride, scopeAll, selectedPouIds, filename, importedSidecar]);

  const verMeta = FORMAT_VERSION_OPTIONS[selectedFormat];
  const unmappedElements = importedSidecar?.unmappedElements ?? [];
  const canExport = !hasBlockingErrors && !exporting && (scopeAll || selectedPouIds.size > 0);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--vscode-editor-background)',
      color: 'var(--vscode-foreground)',
      fontFamily: 'var(--vscode-font-family,inherit)',
      fontSize: 13,
      overflow: 'hidden',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px 10px 20px',
        borderBottom: '1px solid var(--vscode-editorGroup-border)',
        background: 'var(--vscode-sideBar-background)',
        flexShrink: 0,
      }}>
        <Codicon name="cloud-download" style={{ fontSize: 18, color: 'var(--vscode-charts-blue,#60a5fa)' }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--vscode-foreground)' }}>Export PLC Project</div>
          <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginTop: 1 }}>
            {pous.length} POU(s) · {tagDatabase.length} tag(s)
            {importedSidecar ? ` · imported from ${importedSidecar.sourceVendor}` : ''}
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minHeight: 0 }}>

        {/* ── 1. Target format ── */}
        <PanelSection title="Target Format">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {FORMATS.map(fmt => (
              <FormatCard key={fmt.id} fmt={fmt} selected={selectedFormat === fmt.id} onSelect={() => setSelectedFormat(fmt.id)} />
            ))}
          </div>
          {verMeta && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', minWidth: 130 }}>
                {verMeta.label}
              </span>
              <select
                value={versionOverride}
                onChange={e => setVersionOverride(e.target.value)}
                style={{
                  background: 'var(--vscode-input-background)',
                  border: '1px solid var(--vscode-input-border,#3c3c3c)',
                  borderRadius: 3, color: 'var(--vscode-input-foreground)',
                  fontSize: 11, padding: '3px 8px', cursor: 'pointer',
                }}
              >
                {verMeta.options.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}
        </PanelSection>

        {/* ── 2. Validation ── */}
        <PanelSection
          title="Pre-Export Validation"
          badge={
            hasBlockingErrors
              ? <span style={{ fontSize: 11, color: 'var(--vscode-editorError-foreground,#f38ba8)', fontWeight: 600 }}>
                  {blockingErrors.length} blocking error{blockingErrors.length > 1 ? 's' : ''}
                </span>
              : warnings.length > 0
              ? <span style={{ fontSize: 11, color: 'var(--vscode-editorWarning-foreground,#f9e2af)', fontWeight: 600 }}>
                  {warnings.length} warning{warnings.length > 1 ? 's' : ''}
                </span>
              : <span style={{ fontSize: 11, color: 'var(--vscode-testing-iconPassed,#4ade80)', fontWeight: 600 }}>✓ OK</span>
          }
        >
          {validationErrors.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
              color: 'var(--vscode-testing-iconPassed,#4ade80)', padding: '4px 0' }}>
              <Codicon name="pass-filled" style={{ color: 'var(--vscode-testing-iconPassed,#4ade80)', fontSize: 14 }} />
              No validation errors — project is ready to export.
            </div>
          ) : (
            <div style={{
              border: '1px solid var(--vscode-widget-border,rgba(255,255,255,0.1))',
              borderRadius: 4, overflow: 'hidden',
            }}>
              {validationErrors.slice(0, 30).map((e, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 10px',
                  borderBottom: i < validationErrors.length - 1 ? '1px solid var(--vscode-widget-border,rgba(255,255,255,0.05))' : 'none',
                  background: i % 2 === 0 ? 'transparent' : 'var(--vscode-list-hoverBackground)',
                }}>
                  <SevIcon sev={e.severity === 'info' ? 'info' : e.severity === 'warning' ? 'warning' : 'error'} />
                  <span style={{ flex: 1, fontSize: 12, lineHeight: '18px', color: 'var(--vscode-foreground)' }}>{e.message}</span>
                  <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)', flexShrink: 0, marginTop: 2,
                    background: 'var(--vscode-badge-background)', padding: '1px 5px', borderRadius: 3 }}>
                    {e.category}
                  </span>
                </div>
              ))}
            </div>
          )}
          {hasBlockingErrors && (
            <div style={{
              marginTop: 8, padding: '7px 10px', borderRadius: 4, fontSize: 12,
              background: 'var(--vscode-inputValidation-errorBackground,rgba(243,139,168,0.08))',
              border: '1px solid var(--vscode-inputValidation-errorBorder,rgba(243,139,168,0.35))',
              color: 'var(--vscode-editorError-foreground,#f38ba8)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Codicon name="error" style={{ color: 'var(--vscode-editorError-foreground,#f38ba8)', fontSize: 13, flexShrink: 0 }} />
              Export is disabled until all blocking errors are resolved.
            </div>
          )}
        </PanelSection>

        {/* ── 2b. Sidecar fidelity (only if this was an imported project) ── */}
        {importedSidecar && (
          <PanelSection
            title="Preservation Fidelity"
            badge={unmappedElements.length > 0
              ? <span style={{ fontSize: 11, color: 'var(--vscode-editorWarning-foreground,#f9e2af)', fontWeight: 600 }}>
                  {unmappedElements.length} approximated
                </span>
              : <span style={{ fontSize: 11, color: 'var(--vscode-testing-iconPassed,#4ade80)', fontWeight: 600 }}>100% mapped</span>
            }
          >
            <div style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', marginBottom: 8 }}>
              Originally imported from&nbsp;
              <strong style={{ color: 'var(--vscode-foreground)' }}>{importedSidecar.sourceVendor}</strong>
              {importedSidecar.originalFilePath && (
                <span> · <code style={{ fontSize: 11 }}>{importedSidecar.originalFilePath.split('/').pop()}</code></span>
              )}
            </div>
            {unmappedElements.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                color: 'var(--vscode-testing-iconPassed,#4ade80)', padding: '4px 0' }}>
                <Codicon name="pass-filled" style={{ color: 'var(--vscode-testing-iconPassed,#4ade80)', fontSize: 14 }} />
                All elements map cleanly to the target format — lossless round-trip.
              </div>
            ) : (
              <div style={{ border: '1px solid var(--vscode-widget-border,rgba(255,255,255,0.1))', borderRadius: 4, overflow: 'hidden' }}>
                {unmappedElements.slice(0, 20).map((el, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 10px', fontSize: 12,
                    borderBottom: i < unmappedElements.length - 1 ? '1px solid var(--vscode-widget-border,rgba(255,255,255,0.05))' : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'var(--vscode-list-hoverBackground)',
                  }}>
                    <Codicon name="warning" style={{ color: 'var(--vscode-editorWarning-foreground,#f9e2af)', fontSize: 12, flexShrink: 0, marginTop: 2 }} />
                    <span style={{ color: 'var(--vscode-foreground)' }}>{el.reason}</span>
                  </div>
                ))}
                {unmappedElements.length > 20 && (
                  <div style={{ padding: '5px 10px', fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
                    …and {unmappedElements.length - 20} more — all preserved via sidecar re-merge
                  </div>
                )}
              </div>
            )}
          </PanelSection>
        )}

        {/* ── 3. Scope ── */}
        <PanelSection title="Export Scope">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
              <input type="radio" checked={scopeAll} onChange={() => setScopeAll(true)}
                style={{ accentColor: 'var(--vscode-focusBorder,#007acc)' }} />
              <span>Whole project</span>
              <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
                {pous.length} POU{pous.length !== 1 ? 's' : ''} · {tagDatabase.length} global tags
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
              <input type="radio" checked={!scopeAll} onChange={() => setScopeAll(false)}
                style={{ accentColor: 'var(--vscode-focusBorder,#007acc)' }} />
              <span>Specific POU(s)</span>
            </label>
            {!scopeAll && (
              <div style={{
                marginLeft: 24, marginTop: 4, padding: '8px 10px', borderRadius: 4,
                border: '1px solid var(--vscode-widget-border,rgba(255,255,255,0.1))',
                background: 'var(--vscode-input-background)',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                {pous.map(p => (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 12, cursor: 'pointer', color: 'var(--vscode-foreground)' }}>
                    <input
                      type="checkbox"
                      checked={selectedPouIds.has(p.id)}
                      onChange={() => togglePou(p.id)}
                      style={{ accentColor: 'var(--vscode-focusBorder,#007acc)' }}
                    />
                    <Codicon name="symbol-method" style={{ color: 'var(--vscode-charts-blue,#60a5fa)', fontSize: 12 }} />
                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)',
                      background: 'var(--vscode-badge-background)', padding: '1px 5px', borderRadius: 3 }}>
                      {p.language}
                    </span>
                  </label>
                ))}
                {selectedPouIds.size === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--vscode-editorWarning-foreground,#f9e2af)', marginTop: 2 }}>
                    Select at least one POU to export
                  </div>
                )}
              </div>
            )}
          </div>
        </PanelSection>

        {/* ── 4. Destination ── */}
        <PanelSection title="Destination">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', minWidth: 60 }}>Filename</div>
            <input
              type="text"
              value={filename}
              onChange={e => setFilename(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1, background: 'var(--vscode-input-background)',
                border: '1px solid var(--vscode-input-border,#3c3c3c)',
                borderRadius: 3, color: 'var(--vscode-input-foreground)',
                fontSize: 12, padding: '4px 8px', outline: 'none',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--vscode-focusBorder,#007acc)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--vscode-input-border,#3c3c3c)')}
            />
            <span style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', flexShrink: 0, minWidth: 36 }}>
              {getVendorExtension(selectedFormat)}
            </span>
          </div>
          {importedSidecar?.originalFilePath && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
              <Codicon name="file" style={{ fontSize: 11, marginRight: 4 }} />
              Original: {importedSidecar.originalFilePath}
            </div>
          )}
        </PanelSection>

        {/* ── 5. Export action + result ── */}
        <PanelSection title="Export">
          <button
            onClick={handleExport}
            disabled={!canExport}
            style={{
              width: '100%', padding: '8px 0',
              background: canExport ? 'var(--vscode-button-background,#0e639c)' : 'var(--vscode-button-secondaryBackground,#3c3c3c)',
              color: canExport ? 'var(--vscode-button-foreground,#fff)' : 'var(--vscode-button-secondaryForeground,#888)',
              border: 'none', borderRadius: 4, cursor: canExport ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'background 80ms',
            }}
            onMouseEnter={e => { if (canExport) (e.currentTarget as HTMLElement).style.background = 'var(--vscode-button-hoverBackground,#1177bb)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = canExport ? 'var(--vscode-button-background,#0e639c)' : 'var(--vscode-button-secondaryBackground,#3c3c3c)'; }}
          >
            {exporting
              ? <><Codicon name="loading~spin" style={{ fontSize: 14 }} /> Exporting…</>
              : <><Codicon name="cloud-download" style={{ fontSize: 14 }} /> Export as {getVendorDisplayName(selectedFormat)}</>}
          </button>

          {lastResult && (
            <div style={{
              marginTop: 10, padding: '8px 12px', borderRadius: 4, fontSize: 12, lineHeight: '18px',
              background: lastResult.ok
                ? 'rgba(74,222,128,0.07)'
                : 'var(--vscode-inputValidation-errorBackground,rgba(243,139,168,0.07))',
              border: `1px solid ${lastResult.ok ? 'rgba(74,222,128,0.3)' : 'var(--vscode-inputValidation-errorBorder,rgba(243,139,168,0.35))'}`,
              color: lastResult.ok ? 'var(--vscode-foreground)' : 'var(--vscode-editorError-foreground,#f38ba8)',
              display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <Codicon
                name={lastResult.ok ? 'pass-filled' : 'error'}
                style={{ color: lastResult.ok ? 'var(--vscode-testing-iconPassed,#4ade80)' : 'var(--vscode-editorError-foreground,#f38ba8)',
                  fontSize: 14, flexShrink: 0, marginTop: 1 }}
              />
              {lastResult.summary}
            </div>
          )}
        </PanelSection>

        {/* ── 6. Export history ── */}
        {history.length > 0 && (
          <PanelSection title="Export History" badge={
            <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>{history.length} export{history.length !== 1 ? 's' : ''}</span>
          }>
            <div style={{ border: '1px solid var(--vscode-widget-border,rgba(255,255,255,0.1))', borderRadius: 4, overflow: 'hidden' }}>
              {history.map((h, i) => {
                const fmt = FORMATS.find(f => f.id === h.format);
                const ts = new Date(h.timestamp);
                const timeStr = `${ts.getHours().toString().padStart(2, '0')}:${ts.getMinutes().toString().padStart(2, '0')}`;
                const dateStr = `${(ts.getMonth() + 1)}/${ts.getDate()}`;
                return (
                  <div key={h.id} style={{
                    padding: '6px 12px',
                    borderBottom: i < history.length - 1 ? '1px solid var(--vscode-widget-border,rgba(255,255,255,0.05))' : 'none',
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {fmt && <Codicon name={fmt.icon} style={{ color: fmt.iconColor, fontSize: 12 }} />}
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--vscode-foreground)', flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.filename}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)', flexShrink: 0 }}>
                        {dateStr} {timeStr}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', paddingLeft: 20 }}>
                      {h.pouCount} POU · {h.tagCount} tags
                      {h.unmappedCount > 0 && ` · ${h.unmappedCount} via sidecar`}
                      {h.warnings.length > 0 && ` · ${h.warnings.length} warnings`}
                    </div>
                  </div>
                );
              })}
            </div>
          </PanelSection>
        )}

      </div>
    </div>
  );
};
