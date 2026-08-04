/*
 * ExportSection — vendor export panel for the LIBRARY sidebar.
 *
 * Design tokens: uses exclusively VS Code --vscode-* CSS variables so the
 * panel automatically adapts to any installed theme (dark, light, high-contrast).
 *
 * Architecture:
 *  - Format selector: four format cards
 *  - Version overrides: format-specific dropdowns revealed per selection
 *  - Pre-export validation: runs CLM validator live on every store change;
 *    blocks Export button if blocking errors exist
 *  - Sidecar fidelity panel: populated from importedSidecar.unmappedElements
 *  - Scope selector: all POUs or a specific subset
 *  - Destination input: filename text field
 *  - Export action + result summary
 *  - Export history log
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { logicStore, useLogicStoreSelector } from './logicStore.js';
import { exportVendorFile, getVendorDisplayName, getVendorExtension } from './vendor/unifiedExportService.js';
import { buildCLMFromStore } from './clm/builder.js';
import { validateCLM } from './clm/validator.js';
import type { VendorFormat } from './vendor/types.js';
import type { ValidationError } from './clm/validator.js';
import { Codicon, SectionHeader } from './PlcNavigator.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const Twisty: React.FC<{open: boolean;}> = ({ open }) =>
<Codicon name={open ? 'chevron-down' : 'chevron-right'}
style={{ color: 'var(--vscode-icon-foreground)', marginRight: 2, flexShrink: 0, fontSize: 12 }} />;


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
  description: 'ControlLogix / CompactLogix ladder XML'
},
{
  id: 'siemens_simatic_ml',
  label: 'Siemens SimaticML',
  vendor: 'TIA Portal',
  ext: '.xml',
  icon: 'symbol-namespace',
  iconColor: 'var(--vscode-charts-blue,#60a5fa)',
  description: 'LAD/FBD network blocks for SIMATIC S7'
},
{
  id: 'schneider_xef',
  label: 'Schneider XEF',
  vendor: 'EcoStruxure / Unity Pro',
  ext: '.XEF',
  icon: 'symbol-enum',
  iconColor: 'var(--vscode-charts-green,#4ade80)',
  description: 'Modicon M340 / M580 project archive'
},
{
  id: 'plcopen_xml',
  label: 'PLCopen XML',
  vendor: 'CODESYS / Mitsubishi / vendor-neutral',
  ext: '.xml',
  icon: 'globe',
  iconColor: 'var(--vscode-charts-purple,#a78bfa)',
  description: 'IEC 61131-3 TC6 standard interchange format'
}];


// Version options exposed per format
const FORMAT_VERSION_OPTIONS: Partial<Record<VendorFormat, {key: string;label: string;options: string[];}>> = {
  rockwell_l5x: {
    key: 'schemaRevision',
    label: 'L5X Schema Revision',
    options: ['1.0', '18.0', '20.0', '21.0', '24.0', '26.0', '28.0', '32.0', '34.0']
  },
  siemens_simatic_ml: {
    key: 'tiaVersion',
    label: 'TIA Portal Version',
    options: ['15.1', '16.0', '17.0', '18.0', '19.0']
  }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FormatCardProps {
  fmt: FormatMeta;
  selected: boolean;
  onSelect: () => void;
}
const FormatCard: React.FC<FormatCardProps> = ({ fmt, selected, onSelect }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px',
        cursor: 'pointer', userSelect: 'none', boxSizing: 'border-box',
        borderRadius: 4, margin: '3px 6px',
        border: selected ?
        `1px solid var(--vscode-focusBorder,#007acc)` :
        `1px solid var(--vscode-widget-border,transparent)`,
        background: selected ?
        'var(--vscode-list-activeSelectionBackground)' :
        hov ? 'var(--vscode-list-hoverBackground)' : 'var(--vscode-input-background)',
        color: selected ?
        'var(--vscode-list-activeSelectionForeground)' :
        'var(--vscode-foreground)',
        transition: 'background 80ms'
      }}>

      <Codicon name={fmt.icon} style={{ color: fmt.iconColor, fontSize: 16, width: 16, height: 16, marginTop: 1 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 12, lineHeight: '16px' }}>
          {fmt.label}
          <span style={{ fontWeight: 400, fontSize: 10, color: 'var(--vscode-descriptionForeground)', marginLeft: 5 }}>{fmt.ext}</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)', marginTop: 1, lineHeight: '13px' }}>
          {fmt.vendor}
        </div>
        <div style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)', marginTop: 2, lineHeight: '13px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fmt.description}
        </div>
      </div>
    </div>);

};

// Severity badge
const SevBadge: React.FC<{sev: 'error' | 'warning' | 'info';}> = ({ sev }) => {
  const COLOR = {
    error: 'var(--vscode-editorError-foreground,#f38ba8)',
    warning: 'var(--vscode-editorWarning-foreground,#f9e2af)',
    info: 'var(--vscode-editorInfo-foreground,#89dceb)'
  };
  const ICON = { error: 'error', warning: 'warning', info: 'info' };
  return <Codicon name={ICON[sev]} style={{ color: COLOR[sev], fontSize: 12, flexShrink: 0 }} />;
};

// ─── Export history entry ─────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export const ExportSection: React.FC = () => {
  const [open, setOpen] = useState(false);

  // Store subscriptions — reactive to CLM changes
  const pous = useLogicStoreSelector((s) => s.pous);
  const tagDatabase = useLogicStoreSelector((s) => s.tagDatabase);
  const ladderProgram = useLogicStoreSelector((s) => s.ladderProgram);
  const fbdProgram = useLogicStoreSelector((s) => s.fbdProgram);
  const sfcProgram = useLogicStoreSelector((s) => s.sfcProgram);
  const importedSidecar = useLogicStoreSelector((s) => s.importedSidecar);

  // Local UI state
  const [selectedFormat, setSelectedFormat] = useState<VendorFormat>('plcopen_xml');
  const [versionOverride, setVersionOverride] = useState<string>('');
  const [scopeAll, setScopeAll] = useState(true);
  const [selectedPouIds, setSelectedPouIds] = useState<Set<string>>(new Set());
  const [filename, setFilename] = useState('export');
  const [exporting, setExporting] = useState(false);
  const [lastResult, setLastResult] = useState<{ok: boolean;summary: string;} | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sidecarOpen, setSidecarOpen] = useState(false);
  const [validationOpen, setValidationOpen] = useState(true);

  // ── Live CLM validation ─────────────────────────────────────────────────────
  const validationErrors = useMemo<ValidationError[]>(() => {
    try {
      const state = logicStore.getState();
      const clm = buildCLMFromStore(state.ladderProgram, state.fbdProgram, state.sfcProgram, state.tagDatabase);
      return validateCLM(clm);
    } catch {
      return [];
    }
    // Re-runs whenever these store slices change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ladderProgram, fbdProgram, sfcProgram, tagDatabase]);

  const blockingErrors = validationErrors.filter((e) => e.severity === 'error');
  const hasBlockingErrors = blockingErrors.length > 0;

  // ── Default filename from format ────────────────────────────────────────────
  useEffect(() => {
    const base = importedSidecar?.originalFilePath ?
    importedSidecar.originalFilePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'export' :
    'export';
    setFilename(base);
  }, [selectedFormat, importedSidecar]);

  // ── Default version override from sidecar ───────────────────────────────────
  useEffect(() => {
    const verMeta = FORMAT_VERSION_OPTIONS[selectedFormat];
    if (!verMeta) {setVersionOverride('');return;}
    const fromSidecar = importedSidecar?.vendorSpecificGlobals?.[verMeta.key];
    const defaults: Record<string, string> = { schemaRevision: '1.0', tiaVersion: '17.0' };
    setVersionOverride(String(fromSidecar ?? defaults[verMeta.key] ?? ''));
  }, [selectedFormat, importedSidecar]);

  // ── POU scope toggle ────────────────────────────────────────────────────────
  const togglePou = useCallback((id: string) => {
    setSelectedPouIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);else next.add(id);
      return next;
    });
  }, []);

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (hasBlockingErrors) return;
    setExporting(true);
    setLastResult(null);
    try {
      const verMeta = FORMAT_VERSION_OPTIONS[selectedFormat];
      const versionOverrides = verMeta && versionOverride ?
      { [verMeta.key]: versionOverride } :
      undefined;

      const effectivePouIds = scopeAll ? undefined : [...selectedPouIds];

      const result = await exportVendorFile({
        format: selectedFormat,
        sidecar: importedSidecar ?? undefined,
        projectName: filename,
        scopePouIds: effectivePouIds,
        versionOverrides
      });

      if (!result.ok) {
        setLastResult({ ok: false, summary: `Export failed: ${result.errors.join('; ')}` });
        return;
      }

      // Trigger browser download
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

      // Count exported items
      const state = logicStore.getState();
      const exportedPous = effectivePouIds && effectivePouIds.length > 0 ?
      state.pous.filter((p) => effectivePouIds.includes(p.id)) :
      state.pous;
      const pouCount = exportedPous.length || 1;
      const tagCount = state.tagDatabase.length;
      const unmappedCount = importedSidecar?.unmappedElements?.length ?? 0;

      const summaryParts = [
      `Exported to ${filename}${ext}`,
      `${pouCount} POU(s)`,
      `${tagCount} tag(s)`,
      unmappedCount > 0 ? `${unmappedCount} element(s) preserved via sidecar` : null,
      result.warnings.length > 0 ? `${result.warnings.length} warning(s)` : null].
      filter(Boolean).join(' · ');

      setLastResult({ ok: true, summary: summaryParts });

      const entry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        format: selectedFormat,
        filename: `${filename}${ext}`,
        pouCount,
        tagCount,
        unmappedCount,
        warnings: result.warnings
      };
      setHistory((prev) => [entry, ...prev.slice(0, 19)]);

    } catch (err) {
      setLastResult({ ok: false, summary: `Export error: ${err}` });
    } finally {
      setExporting(false);
    }
  }, [hasBlockingErrors, selectedFormat, versionOverride, scopeAll, selectedPouIds,
  filename, importedSidecar]);

  // ── Render ───────────────────────────────────────────────────────────────────

  const verMeta = FORMAT_VERSION_OPTIONS[selectedFormat];
  const unmappedElements = importedSidecar?.unmappedElements ?? [];
  const hasImportedSidecar = !!importedSidecar && importedSidecar.unmappedElements.length > 0;

  return (
    <div>
      <SectionHeader
        label="Export"
        sublabel={selectedFormat ? getVendorDisplayName(selectedFormat) : undefined}
        open={open}
        onToggle={() => setOpen((o) => !o)} />

      {open &&
      <div style={{ padding: '4px 0 8px 0' }}>

          {/* ── 1. Format selector ── */}
          <SubHeading label="Target Format" />
          {FORMATS.map((fmt) =>
        <FormatCard
          key={fmt.id}
          fmt={fmt}
          selected={selectedFormat === fmt.id}
          onSelect={() => setSelectedFormat(fmt.id)} />

        )}

          {/* ── 1b. Version overrides (format-specific) ── */}
          {verMeta &&
        <div style={{ padding: '6px 10px 2px 10px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--vscode-descriptionForeground)',
              textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {verMeta.label}
                </span>
                <select
              value={versionOverride}
              onChange={(e) => setVersionOverride(e.target.value)}
              style={{
                background: 'var(--vscode-input-background)',
                border: '1px solid var(--vscode-input-border,#3c3c3c)',
                borderRadius: 3, color: 'var(--vscode-input-foreground)',
                fontSize: 11, padding: '2px 5px', cursor: 'pointer'
              }}>

                  {verMeta.options.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
            </div>
        }

          <Divider />

          {/* ── 2. Pre-export validation ── */}
          <CollapsibleRow
          label="Validation"
          badge={blockingErrors.length > 0 ?
          { text: `${blockingErrors.length} error${blockingErrors.length > 1 ? 's' : ''}`, color: 'var(--vscode-editorError-foreground,#f38ba8)' } :
          validationErrors.filter((e) => e.severity === 'warning').length > 0 ?
          { text: `${validationErrors.filter((e) => e.severity === 'warning').length} warn`, color: 'var(--vscode-editorWarning-foreground,#f9e2af)' } :
          { text: '✓ OK', color: 'var(--vscode-testing-iconPassed,#4ade80)' }}
          open={validationOpen}
          onToggle={() => setValidationOpen((v) => !v)}>

            {validationErrors.length === 0 ?
          <InfoRow icon="pass" iconColor="var(--vscode-testing-iconPassed,#4ade80)" text="No validation errors found." /> :

          <>
                {validationErrors.slice(0, 20).map((e, i) =>
            <ValidationRow key={i} err={e} />
            )}
                {validationErrors.length > 20 &&
            <InfoRow icon="ellipsis" text={`…and ${validationErrors.length - 20} more`} />
            }
              </>
          }
            {hasBlockingErrors &&
          <div style={{ margin: '4px 10px', padding: '5px 8px', borderRadius: 3, fontSize: 10,
            background: 'var(--vscode-inputValidation-errorBackground,rgba(243,139,168,0.1))',
            border: '1px solid var(--vscode-inputValidation-errorBorder,rgba(243,139,168,0.4))',
            color: 'var(--vscode-editorError-foreground,#f38ba8)', lineHeight: '14px' }}>
                Export disabled — resolve blocking errors to proceed.
              </div>
          }
          </CollapsibleRow>

          {/* ── 2b. Sidecar fidelity (only if project was imported) ── */}
          {importedSidecar &&
        <>
              <CollapsibleRow
            label="Preservation Fidelity"
            badge={hasImportedSidecar ?
            { text: `${unmappedElements.length} approximated`, color: 'var(--vscode-editorWarning-foreground,#f9e2af)' } :
            { text: '100% mapped', color: 'var(--vscode-testing-iconPassed,#4ade80)' }}
            open={sidecarOpen}
            onToggle={() => setSidecarOpen((v) => !v)}>

                <div style={{ padding: '2px 10px 4px 10px', fontSize: 10,
              color: 'var(--vscode-descriptionForeground)', lineHeight: '14px' }}>
                  Original import: <strong style={{ color: 'var(--vscode-foreground)' }}>{importedSidecar.sourceVendor}</strong>
                  {importedSidecar.originalFilePath &&
              <span> · {importedSidecar.originalFilePath.split('/').pop()}</span>
              }
                </div>
                {unmappedElements.length === 0 ?
            <InfoRow icon="pass" iconColor="var(--vscode-testing-iconPassed,#4ade80)"
            text="All elements have a clean equivalent in the target format." /> :

            unmappedElements.slice(0, 15).map((el, i) =>
            <div key={i} style={{ display: 'flex', gap: 5, alignItems: 'flex-start',
              padding: '2px 10px', fontSize: 10, lineHeight: '14px',
              color: 'var(--vscode-descriptionForeground)' }}>
                      <Codicon name="warning" style={{ color: 'var(--vscode-editorWarning-foreground,#f9e2af)',
                fontSize: 10, marginTop: 1, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {el.reason}
                      </span>
                    </div>
            )
            }
                {unmappedElements.length > 15 &&
            <InfoRow icon="ellipsis" text={`…and ${unmappedElements.length - 15} more (re-merged via sidecar)`} />
            }
              </CollapsibleRow>
            </>
        }

          <Divider />

          {/* ── 3. Scope selector ── */}
          <SubHeading label="Export Scope" />
          <div style={{ padding: '2px 10px 6px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <RadioRow
            checked={scopeAll}
            onCheck={() => setScopeAll(true)}
            label={`Whole project (${pous.length} POU${pous.length !== 1 ? 's' : ''})`} />

            <RadioRow
            checked={!scopeAll}
            onCheck={() => setScopeAll(false)}
            label="Specific POU(s)" />

            {!scopeAll &&
          <div style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                {pous.map((p) =>
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, cursor: 'pointer', color: 'var(--vscode-foreground)' }}>
                    <input
                type="checkbox"
                checked={selectedPouIds.has(p.id)}
                onChange={() => togglePou(p.id)}
                style={{ accentColor: 'var(--vscode-focusBorder,#007acc)', cursor: 'pointer' }} />

                    <Codicon name="symbol-method" style={{ color: 'var(--vscode-charts-blue,#60a5fa)', fontSize: 12 }} />
                    <span>{p.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)' }}>
                      {p.language}
                    </span>
                  </label>
            )}
                {!scopeAll && selectedPouIds.size === 0 &&
            <div style={{ fontSize: 10, color: 'var(--vscode-editorWarning-foreground,#f9e2af)', marginTop: 2 }}>
                    Select at least one POU
                  </div>
            }
              </div>
          }
          </div>

          <Divider />

          {/* ── 4. Destination filename ── */}
          <SubHeading label="Destination" />
          <div style={{ padding: '2px 10px 6px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1, background: 'var(--vscode-input-background)',
                border: '1px solid var(--vscode-input-border,#3c3c3c)',
                borderRadius: 3, color: 'var(--vscode-input-foreground)',
                fontSize: 11, padding: '3px 6px', outline: 'none'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--vscode-focusBorder,#007acc)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--vscode-input-border,#3c3c3c)'} />

              <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)', flexShrink: 0 }}>
                {getVendorExtension(selectedFormat)}
              </span>
            </div>
            {importedSidecar?.originalFilePath &&
          <div style={{ marginTop: 4, fontSize: 10, color: 'var(--vscode-descriptionForeground)' }}>
                Original: {importedSidecar.originalFilePath.split('/').pop()}
              </div>
          }
          </div>

          <Divider />

          {/* ── 5. Export action ── */}
          <div style={{ padding: '4px 10px 6px 10px' }}>
            <button
            onClick={handleExport}
            disabled={hasBlockingErrors || exporting || !scopeAll && selectedPouIds.size === 0}
            style={{
              width: '100%', padding: '6px 0',
              background: hasBlockingErrors || !scopeAll && selectedPouIds.size === 0 ?
              'var(--vscode-button-secondaryBackground,#3c3c3c)' :
              'var(--vscode-button-background,#0e639c)',
              color: hasBlockingErrors || !scopeAll && selectedPouIds.size === 0 ?
              'var(--vscode-button-secondaryForeground,#888)' :
              'var(--vscode-button-foreground,#fff)',
              border: 'none', borderRadius: 3, cursor:
              hasBlockingErrors || !scopeAll && selectedPouIds.size === 0 ? 'not-allowed' : 'pointer',
              fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 5, transition: 'background 80ms'
            }}
            onMouseEnter={(e) => {
              if (!hasBlockingErrors && !exporting && (scopeAll || selectedPouIds.size > 0))
              (e.currentTarget as HTMLElement).style.background = 'var(--vscode-button-hoverBackground,#1177bb)';
            }}
            onMouseLeave={(e) => {
              if (!hasBlockingErrors)
              (e.currentTarget as HTMLElement).style.background =
              hasBlockingErrors || !scopeAll && selectedPouIds.size === 0 ?
              'var(--vscode-button-secondaryBackground,#3c3c3c)' :
              'var(--vscode-button-background,#0e639c)';
            }}>

              {exporting ?
            <><Codicon name="loading~spin" /> Exporting…</> :
            <><Codicon name="cloud-download" /> Export {getVendorDisplayName(selectedFormat)}</>}
            </button>

            {/* Result summary */}
            {lastResult &&
          <div style={{
            marginTop: 6, padding: '5px 8px', borderRadius: 3, fontSize: 10, lineHeight: '14px',
            background: lastResult.ok ?
            'var(--vscode-testing-messagePeekBorder,rgba(74,222,128,0.08))' :
            'var(--vscode-inputValidation-errorBackground,rgba(243,139,168,0.08))',
            border: `1px solid ${lastResult.ok ?
            'var(--vscode-testing-iconPassed,rgba(74,222,128,0.3))' :
            'var(--vscode-inputValidation-errorBorder,rgba(243,139,168,0.4))'}`,
            color: lastResult.ok ?
            'var(--vscode-foreground)' :
            'var(--vscode-editorError-foreground,#f38ba8)',
            display: 'flex', gap: 5, alignItems: 'flex-start'
          }}>
                <Codicon
              name={lastResult.ok ? 'pass-filled' : 'error'}
              style={{ color: lastResult.ok ? 'var(--vscode-testing-iconPassed,#4ade80)' : 'var(--vscode-editorError-foreground,#f38ba8)',
                fontSize: 12, marginTop: 0, flexShrink: 0 }} />

                <span>{lastResult.summary}</span>
              </div>
          }
          </div>

          {/* ── 6. Export history ── */}
          {history.length > 0 &&
        <>
              <Divider />
              <CollapsibleRow
            label="Export History"
            badge={{ text: `${history.length}`, color: 'var(--vscode-descriptionForeground)' }}
            open={historyOpen}
            onToggle={() => setHistoryOpen((v) => !v)}>

                {history.map((h) =>
            <HistoryRow key={h.id} entry={h} />
            )}
              </CollapsibleRow>
            </>
        }

        </div>
      }
    </div>);

};

// ─── Small layout helpers ─────────────────────────────────────────────────────

const SubHeading: React.FC<{label: string;}> = ({ label }) =>
<div style={{ padding: '4px 10px 2px 10px', fontSize: 10, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.05em',
  color: 'var(--vscode-descriptionForeground)' }}>
    {label}
  </div>;


const Divider: React.FC = () =>
<div style={{ height: 1, margin: '6px 0',
  background: 'var(--vscode-sideBarSectionHeader-border,var(--vscode-widget-border,rgba(255,255,255,0.08)))' }} />;


const RadioRow: React.FC<{checked: boolean;onCheck: () => void;label: string;}> = ({ checked, onCheck, label }) =>
<label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
  cursor: 'pointer', color: 'var(--vscode-foreground)' }}>
    <input
    type="radio"
    checked={checked}
    onChange={onCheck}
    style={{ accentColor: 'var(--vscode-focusBorder,#007acc)', cursor: 'pointer' }} />

    {label}
  </label>;


const InfoRow: React.FC<{icon: string;iconColor?: string;text: string;}> = ({ icon, iconColor, text }) =>
<div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '2px 10px',
  fontSize: 10, color: 'var(--vscode-descriptionForeground)', lineHeight: '14px' }}>
    <Codicon name={icon} style={{ color: iconColor ?? 'var(--vscode-descriptionForeground)', fontSize: 10, flexShrink: 0 }} />
    <span>{text}</span>
  </div>;


const ValidationRow: React.FC<{err: ValidationError;}> = ({ err }) =>
<div style={{ display: 'flex', gap: 5, alignItems: 'flex-start',
  padding: '2px 10px', fontSize: 10, lineHeight: '14px' }}>
    <SevBadge sev={err.severity === 'info' ? 'info' : err.severity === 'warning' ? 'warning' : 'error'} />
    <span style={{ color: 'var(--vscode-foreground)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {err.message}
    </span>
    <span style={{ fontSize: 9, color: 'var(--vscode-descriptionForeground)', flexShrink: 0, marginTop: 1 }}>
      {err.category}
    </span>
  </div>;


const CollapsibleRow: React.FC<{
  label: string;
  badge?: {text: string;color: string;};
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ label, badge, open, onToggle, children }) => {
  const [hov, setHov] = useState(false);
  return (
    <div>
      <div
        onClick={onToggle}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: 'flex', alignItems: 'center', height: 20, padding: '0 10px 0 8px',
          cursor: 'pointer', userSelect: 'none', gap: 4,
          background: hov ? 'var(--vscode-list-hoverBackground)' : 'transparent'
        }}>

        <Twisty open={open} />
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600,
          color: 'var(--vscode-sideBarSectionHeader-foreground)', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        {badge &&
        <span style={{ fontSize: 9, color: badge.color, flexShrink: 0,
          fontWeight: 600, letterSpacing: '0.02em' }}>
            {badge.text}
          </span>
        }
      </div>
      {open && <div>{children}</div>}
    </div>);

};

const HistoryRow: React.FC<{entry: HistoryEntry;}> = ({ entry }) => {
  const fmt = FORMATS.find((f) => f.id === entry.format);
  const ts = new Date(entry.timestamp);
  const timeStr = `${ts.getHours().toString().padStart(2, '0')}:${ts.getMinutes().toString().padStart(2, '0')}`;
  const dateStr = `${ts.getMonth() + 1}/${ts.getDate()}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 10px 4px 14px',
      borderBottom: '1px solid var(--vscode-widget-border,rgba(255,255,255,0.05))',
      gap: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {fmt && <Codicon name={fmt.icon} style={{ color: fmt.iconColor, fontSize: 11 }} />}
        <span style={{ fontSize: 11, color: 'var(--vscode-foreground)', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {entry.filename}
        </span>
        <span style={{ fontSize: 9, color: 'var(--vscode-descriptionForeground)', flexShrink: 0 }}>
          {dateStr} {timeStr}
        </span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)', paddingLeft: 19 }}>
        {entry.pouCount} POU · {entry.tagCount} tags
        {entry.unmappedCount > 0 && ` · ${entry.unmappedCount} via sidecar`}
        {entry.warnings.length > 0 && ` · ${entry.warnings.length} warnings`}
      </div>
    </div>);

};