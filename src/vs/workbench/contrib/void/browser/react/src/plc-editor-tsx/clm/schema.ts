/*
 * CLM (Canonical Logic Model) — Graph Schema
 * Defines all node types, edge types, and their data payloads.
 * This is the single source of truth for the graph structure.
 */

import type { IECDataType } from '../logicStore.js';

// ─── Node Types ──────────────────────────────────────────────────────────────

export type CLMNodeType =
  | 'TAG'
  | 'POU'
  | 'RUNG'
  | 'LD_ELEMENT'
  | 'FBD_BLOCK'
  | 'FBD_PIN'
  | 'SFC_STEP'
  | 'SFC_TRANSITION'
  | 'SFC_ACTION'
  | 'SFC_JUMP';

export type CLMLanguage = 'LD' | 'FBD' | 'SFC' | 'shared';

// -- TAG node
export interface TagNodeData {
  name: string;
  dataType: IECDataType;
  scope: 'global' | 'local';
  initialValue?: string;
  retain?: boolean;
  address?: string;
  description?: string;
}

// -- POU node
export type POUType = 'program' | 'function_block' | 'function';

export interface POUNodeData {
  pouName: string;
  pouType: POUType;
  language: CLMLanguage;
}

// -- RUNG node
export interface RungNodeData {
  rungNumber: number;
  comment: string;
}

// -- LD_ELEMENT node
export type LDElementKind =
  | 'contact_no' | 'contact_nc' | 'contact_p' | 'contact_n'
  | 'coil' | 'coil_negated' | 'coil_set' | 'coil_reset' | 'coil_latch' | 'coil_unlatch'
  | 'coil_p' | 'coil_n'
  | 'fb_call';

export interface LDElementNodeData {
  elementKind: LDElementKind;
  fbType?: string;
  instanceName?: string;
  position: { x: number; y: number };
  branchId?: string;
  anchorId?: string;   // for branch elements: the main-rail element ID this branch parallels
}

// -- FBD_BLOCK node
export interface FBDBlockNodeData {
  blockType: string;
  instanceName?: string;
  label?: string;
  content?: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
}

// -- FBD_PIN node
export interface FBDPinNodeData {
  pinName: string;
  direction: 'in' | 'out';
  dataType: IECDataType;
  negated?: boolean;
}

// -- SFC_STEP node
export interface SFCStepNodeData {
  stepName: string;
  isInitial: boolean;
  position: { x: number; y: number };
}

// -- SFC_TRANSITION node
export interface SFCTransitionNodeData {
  conditionExpr: string;
  position: { x: number; y: number };
  priority?: number;
}

// -- SFC_ACTION node
export type ActionQualifier = 'N' | 'S' | 'R' | 'P' | 'P1' | 'P0' | 'L' | 'D' | 'SD' | 'DS' | 'SL';

export interface SFCActionNodeData {
  actionName: string;
  qualifier: ActionQualifier;
  duration?: string;
}

export interface SFCJumpNodeData {
  targetStepName: string;
}

// -- Union of all node data types
export type CLMNodeData =
  | TagNodeData
  | POUNodeData
  | RungNodeData
  | LDElementNodeData
  | FBDBlockNodeData
  | FBDPinNodeData
  | SFCStepNodeData
  | SFCTransitionNodeData
  | SFCActionNodeData
  | SFCJumpNodeData;

// -- Full node attributes (what graphology stores per node)
export interface CLMNodeAttributes {
  type: CLMNodeType;
  language: CLMLanguage;
  data: CLMNodeData;
}

// ─── Edge Types ──────────────────────────────────────────────────────────────

export type CLMEdgeType =
  | 'CONTAINS'
  | 'READS'
  | 'WRITES'
  | 'WIRE'
  | 'RUNG_ORDER'
  | 'SFC_FLOW'
  | 'HAS_PIN'
  | 'HAS_ACTION'
  | 'CROSS_LANG_REF';

export interface CLMEdgeAttributes {
  type: CLMEdgeType;
  data?: Record<string, unknown>;
}

// ─── Graph Typing (for Graphology generic params) ────────────────────────────

export interface CLMGraphTypes {
  NodeAttributes: CLMNodeAttributes;
  EdgeAttributes: CLMEdgeAttributes;
}

// ─── Serialized format version ───────────────────────────────────────────────

export const CLM_VERSION = 1;

export interface CLMSerializedGraph {
  clmVersion: number;
  pouId: string;
  graph: ReturnType<typeof JSON.parse>; // graphology export() JSON
}
