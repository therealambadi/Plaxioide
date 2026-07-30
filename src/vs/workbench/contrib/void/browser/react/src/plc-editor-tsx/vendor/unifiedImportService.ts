/*
 * Unified Import Service — single entry point for all vendor import flows.
 * Both UI triggers (chat pin button, folder detection) call this.
 * Never modifies the original vendor file in place.
 */

import { detectFormat } from './detectFormat.js';
import { importPLCopen } from './adapters/plcopenAdapter.js';
import { importRockwell } from './adapters/rockwellAdapter.js';
import { importSiemens } from './adapters/siemensAdapter.js';
import { importSchneider } from './adapters/schneiderAdapter.js';
import { parseSTSource } from './stParser.js';
import type { ImportResult, NormalizedProject, VendorFormat } from './types.js';
import { logicStore } from '../logicStore.js';
import { clmStore } from '../clm/clmStore.js';

export interface ImportServiceResult {
  ok: boolean;
  format?: VendorFormat;
  projectName?: string;
  tagCount?: number;
  pouCount?: number;
  unmappedCount?: number;
  errors: string[];
  warnings: string[];
}

/**
 * Import a vendor file from raw XML content.
 * Detects format, runs the right adapter, then loads the result into logicStore.
 *
 * @param xmlContent  - Full file content as string
 * @param filename    - Original filename (used for extension-based format hint)
 * @param filePath    - Full path (stored in sidecar for reference)
 * @param formatOverride - If user explicitly selected the format (skip detection)
 */
export async function importVendorFile(
  xmlContent: string,
  filename: string,
  filePath: string,
  formatOverride?: VendorFormat
): Promise<ImportServiceResult> {
  // Step 1: Detect format
  const format = formatOverride ?? detectFormat(filename, xmlContent);
  if (!format) {
    return {
      ok: false,
      errors: ['Could not identify vendor format. Please specify: rockwell_l5x, siemens_simatic_ml, schneider_xef, or plcopen_xml'],
      warnings: [],
    };
  }

  // Step 2: Run vendor-specific adapter (yielded to avoid blocking main thread)
  let result: ImportResult;
  const parseStart = performance.now();
  result = await new Promise<ImportResult>((resolve) => {
    setTimeout(() => {
      let r: ImportResult;
      switch (format) {
        case 'plcopen_xml':
          r = importPLCopen(xmlContent, filePath);
          break;
        case 'rockwell_l5x':
          r = importRockwell(xmlContent, filePath);
          break;
        case 'siemens_simatic_ml':
          r = importSiemens(xmlContent, filePath);
          break;
        case 'schneider_xef':
          r = importSchneider(xmlContent, filePath);
          break;
        case 'iec_st': {
          const stResult = parseSTSource(xmlContent, filePath);
          r = {
            ok: stResult.errors.length === 0,
            project: {
              projectName: stResult.pou.name,
              pous: [stResult.pou],
              globalTags: stResult.pou.localTags,
              sidecar: {
                sourceVendor: 'iec_st',
                sourceFileVersion: '1.0',
                originalFilePath: filePath,
                unmappedElements: [],
              },
            },
            errors: stResult.errors,
            warnings: stResult.warnings,
          };
          break;
        }
        default:
          r = { ok: false, errors: [`Unknown vendor format: ${format}`], warnings: [], project: undefined as any };
      }
      resolve(r);
    }, 0);
  });
  console.log(`[Plaxio Perf] importVendorFile parse (${format}): ${(performance.now() - parseStart).toFixed(1)}ms`);

  if (!result.ok || !result.project) {
    return { ok: false, format, errors: result.errors, warnings: result.warnings };
  }

  // Step 3: Load into logicStore
  loadProjectIntoStore(result.project);

  return {
    ok: true,
    format,
    projectName: result.project.projectName,
    tagCount: result.project.globalTags.length + result.project.pous.reduce((s, p) => s + p.localTags.length, 0),
    pouCount: result.project.pous.length,
    unmappedCount: result.project.sidecar.unmappedElements.length,
    errors: result.errors,
    warnings: result.warnings,
  };
}

/**
 * Load a NormalizedProject into the active logicStore state.
 * Uses the first LD POU as the active ladder program, first FBD as FBD program, etc.
 */
function loadProjectIntoStore(project: NormalizedProject): void {
  const state = logicStore.getState();

  // Collect all tags (global + all POU local)
  const allTags = [
    ...project.globalTags,
    ...project.pous.flatMap(p => p.localTags),
  ];

  // Build tag database
  const tagDatabase = allTags.map(t => ({
    name: t.name,
    address: t.address || '',
    dataType: t.dataType,
    description: t.description,
    retain: t.retain,
    initialValue: t.initialValue,
  }));

  // Load first LD POU as ladder, first FBD as fbd, first SFC as sfc
  const ldPOU = project.pous.find(p => p.language === 'LD');
  const fbdPOU = project.pous.find(p => p.language === 'FBD');
  const sfcPOU = project.pous.find(p => p.language === 'SFC');

  // Build multi-POU list for store (include ST POUs)
  const pous = project.pous.map(p => ({
    id: p.id,
    name: p.name,
    language: p.language as 'LD' | 'FBD' | 'SFC' | 'ST',
    ladderProgram: p.ladderProgram ?? { rungs: [] },
    fbdProgram: p.fbdProgram ?? { nodes: [], wires: [] },
    sfcProgram: p.sfcProgram ?? { steps: [], transitions: [], links: [], branches: [] },
    stSource: p.stSource ?? '',
  }));

  // Load tag database and POU list
  logicStore.setState(s => {
    s.tagDatabase = tagDatabase as any;
    if (pous.length > 0) {
      s.pous = pous;
      s.activePouId = pous[0].id;
      s.activeLanguage = pous[0].language;
    }
  });

  // Use dedicated load methods so cross-ref rebuilds correctly
  if (ldPOU?.ladderProgram) logicStore.loadLadderProgram(ldPOU.ladderProgram);
  if (fbdPOU?.fbdProgram) logicStore.loadFBDProgram(fbdPOU.fbdProgram);
  if (sfcPOU?.sfcProgram) logicStore.loadSFCProgram(sfcPOU.sfcProgram);

  // Sync CLM graph with the freshly loaded logicStore state.
  // This is the single mandatory sync point after vendor import — without it the
  // CLM validator, ST compiler, and cross-reference system operate on stale data.
  const finalState = logicStore.getState();
  clmStore.initialize(
    finalState.ladderProgram,
    finalState.fbdProgram,
    finalState.sfcProgram,
    finalState.tagDatabase,
  );

  // Log import summary to console panel
  const sidecar = project.sidecar;
  if (sidecar.unmappedElements.length > 0) {
    logicStore.addConsoleEntry('warn',
      `[Import] ${sidecar.unmappedElements.length} unmapped element(s) from ${sidecar.sourceVendor}. Review details below.`);
    sidecar.unmappedElements.slice(0, 10).forEach(u => {
      logicStore.addConsoleEntry('warn', `  · ${u.reason}`);
    });
    if (sidecar.unmappedElements.length > 10) {
      logicStore.addConsoleEntry('warn', `  · ... and ${sidecar.unmappedElements.length - 10} more`);
    }
  }
  logicStore.addConsoleEntry('success',
    `[Import] Loaded "${project.projectName}" from ${sidecar.sourceVendor}: ${pous.length} POU(s), ${tagDatabase.length} tag(s).`);
  logicStore.setImportedSidecar(sidecar);
}
