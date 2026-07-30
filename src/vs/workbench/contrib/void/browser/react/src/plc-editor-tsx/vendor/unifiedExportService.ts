/*
 * Unified Export Service — export current logicStore state to any vendor format.
 * Re-merges sidecar metadata where available for lossless round-trip.
 */

import { exportPLCopen } from './adapters/plcopenAdapter.js';
import { exportRockwell } from './adapters/rockwellAdapter.js';
import { exportSiemens } from './adapters/siemensAdapter.js';
import { exportSchneider } from './adapters/schneiderAdapter.js';
import type { ExportResult, NormalizedProject, NormalizedPOU, VendorFormat, VendorMetadataSidecar } from './types.js';
import { logicStore } from '../logicStore.js';

export interface ExportServiceOptions {
  format: VendorFormat;
  sidecar?: VendorMetadataSidecar;
  projectName?: string;
  /** Optional POU id filter — if provided, only export these POUs */
  scopePouIds?: string[];
  /** Per-format version overrides — written into sidecar.vendorSpecificGlobals */
  versionOverrides?: Record<string, string>;
}

export async function exportVendorFile(options: ExportServiceOptions): Promise<ExportResult> {
  const { format, sidecar, projectName, scopePouIds, versionOverrides } = options;
  const state = logicStore.getState();

  // Build NormalizedProject from current store state
  const sourcePous = state.pous.length > 0 ? state.pous : [{
    id: 'pou-main',
    name: 'MainProgram',
    language: state.activeLanguage,
    ladderProgram: state.ladderProgram,
    fbdProgram: state.fbdProgram,
    sfcProgram: state.sfcProgram,
    localTags: [] as any[],
  }];

  const filteredPous = scopePouIds && scopePouIds.length > 0
    ? sourcePous.filter(p => scopePouIds.includes(p.id))
    : sourcePous;

  const pous: NormalizedPOU[] = filteredPous.map(p => ({
    id: p.id,
    name: p.name,
    language: p.language,
    ladderProgram: p.ladderProgram,
    fbdProgram: p.fbdProgram,
    sfcProgram: p.sfcProgram,
    stSource: (p as any).stSource,
    localTags: (p as any).localTags || [],
  }));

  const globalTags = state.tagDatabase.map(t => ({
    name: t.name,
    dataType: t.dataType,
    initialValue: t.initialValue,
    description: t.description,
    address: t.address || undefined,
    retain: t.retain,
  }));

  // Build or restore sidecar, applying any version overrides
  const effectiveSidecar: VendorMetadataSidecar = {
    ...(sidecar ?? {
      sourceVendor: format,
      sourceFileVersion: '1.0',
      originalFilePath: '',
      unmappedElements: [],
    }),
    vendorSpecificGlobals: {
      ...(sidecar?.vendorSpecificGlobals ?? {}),
      ...(versionOverrides ?? {}),
    },
  };

  const project: NormalizedProject = {
    projectName: projectName ?? 'Plaxio Export',
    pous,
    globalTags,
    sidecar: effectiveSidecar,
  };

  switch (format) {
    case 'plcopen_xml':
      return exportPLCopen(project);
    case 'rockwell_l5x':
      return exportRockwell(project);
    case 'siemens_simatic_ml':
      return exportSiemens(project);
    case 'schneider_xef':
      return exportSchneider(project);
    case 'iec_st': {
      // Export ST POUs as plain .st text file
      const stContent = project.pous
        .map(p => p.stSource || `PROGRAM ${p.name}\n  (* no ST source *)\nEND_PROGRAM`)
        .join('\n\n');
      return { ok: true, content: stContent, errors: [], warnings: [] };
    }
    default:
      return { ok: false, errors: [`Unknown export format: ${format}`], warnings: [] };
  }
}

/**
 * Returns the file extension for a given vendor format.
 */
export function getVendorExtension(format: VendorFormat): string {
  switch (format) {
    case 'rockwell_l5x': return '.L5X';
    case 'siemens_simatic_ml': return '.xml';
    case 'schneider_xef': return '.XEF';
    case 'plcopen_xml': return '.xml';
    case 'iec_st': return '.st';
    default: return '.xml';
  }
}

export function getVendorDisplayName(format: VendorFormat): string {
  switch (format) {
    case 'rockwell_l5x': return 'Rockwell L5X';
    case 'siemens_simatic_ml': return 'Siemens SimaticML';
    case 'schneider_xef': return 'Schneider XEF';
    case 'plcopen_xml': return 'PLCopen XML';
    case 'iec_st': return 'IEC 61131-3 ST';
    default: return format;
  }
}
