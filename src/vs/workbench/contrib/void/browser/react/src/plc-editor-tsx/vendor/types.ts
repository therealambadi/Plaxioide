/*
 * Vendor Import/Export Layer — Shared Types
 * All four vendor adapters share these types. This file has no runtime deps.
 */

// ─── Vendor Format Enum ───────────────────────────────────────────────────────

export type VendorFormat =
  | 'rockwell_l5x'
  | 'siemens_simatic_ml'
  | 'schneider_xef'
  | 'plcopen_xml'
  | 'iec_st';

// ─── Sidecar — preserves unmapped vendor data for lossless round-trip ─────────

export interface UnmappedElement {
  clmNodeId: string | null;
  vendorSpecificData: unknown;
  reason: string;
}

export interface VendorMetadataSidecar {
  sourceVendor: VendorFormat;
  sourceFileVersion: string;
  originalFilePath: string;
  unmappedElements: UnmappedElement[];
  organizerTreeLayout?: unknown;
  vendorSpecificGlobals?: Record<string, unknown>;
}

// ─── Normalized intermediate shapes ──────────────────────────────────────────
// These are the in-memory shapes that every adapter produces/consumes.
// They align closely with logicStore types so mapping is trivial.

import type { IECDataType, LadderProgram, FBDProgram, SFCProgram, TagEntry } from '../logicStore.js';

export interface NormalizedProject {
  projectName: string;
  pous: NormalizedPOU[];
  globalTags: NormalizedTag[];
  sidecar: VendorMetadataSidecar;
}

export interface NormalizedPOU {
  id: string;
  name: string;
  pouType?: 'program' | 'functionBlock' | 'function';
  language: 'LD' | 'FBD' | 'SFC' | 'ST';
  ladderProgram?: LadderProgram;
  fbdProgram?: FBDProgram;
  sfcProgram?: SFCProgram;
  stSource?: string;
  localTags: NormalizedTag[];
}

export interface NormalizedTag {
  name: string;
  dataType: IECDataType;
  initialValue?: string;
  description?: string;
  address?: string;
  retain?: boolean;
}

// ─── Import/Export result shapes ──────────────────────────────────────────────

export interface ImportResult {
  ok: boolean;
  project?: NormalizedProject;
  errors: string[];
  warnings: string[];
}

export interface ExportResult {
  ok: boolean;
  xmlContent?: string;
  errors: string[];
  warnings: string[];
}
