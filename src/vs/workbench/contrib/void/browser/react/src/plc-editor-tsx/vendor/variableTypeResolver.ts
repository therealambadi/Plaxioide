/*
 * Variable Type Resolver
 *
 * Builds a lookup map from variable name → IECDataType from a POU's declared
 * tags (local vars, global tags, etc.) and provides a resolve() function.
 *
 * Usage:
 *   const resolver = new VariableTypeResolver(localTags, globalTags);
 *   const dt = resolver.resolve('MyTimer.PT');  // → 'TIME'
 *
 * Dot-notation: for structured types (TIMER, COUNTER, etc.) the resolver
 * recognises well-known member paths like ".PT" → TIME, ".ACC" → DINT, etc.
 * This lets adapters resolve Rockwell TIMER/COUNTER member accesses correctly.
 */

import type { IECDataType } from '../logicStore.js';
import type { NormalizedTag } from './types.js';

// ─── Well-known struct member types ──────────────────────────────────────────

// Rockwell TIMER members
const TIMER_MEMBERS: Record<string, IECDataType> = {
  PRE: 'DINT', ACC: 'DINT', EN: 'BOOL', TT: 'BOOL', DN: 'BOOL',
};

// Rockwell COUNTER members
const COUNTER_MEMBERS: Record<string, IECDataType> = {
  PRE: 'DINT', ACC: 'DINT', CU: 'BOOL', CD: 'BOOL', DN: 'BOOL', OV: 'BOOL', UN: 'BOOL',
};

// IEC timer members (TON/TOF/TP instance)
const IEC_TIMER_MEMBERS: Record<string, IECDataType> = {
  IN: 'BOOL', PT: 'TIME', Q: 'BOOL', ET: 'TIME',
};

// IEC counter members (CTU/CTD/CTUD instance)
const IEC_COUNTER_MEMBERS: Record<string, IECDataType> = {
  CU: 'BOOL', CD: 'BOOL', R: 'BOOL', LD: 'BOOL', PV: 'INT', QU: 'BOOL', QD: 'BOOL', CV: 'INT',
};

// SR/RS latch members
const SR_MEMBERS: Record<string, IECDataType> = {
  S1: 'BOOL', R: 'BOOL', Q1: 'BOOL',
};
const RS_MEMBERS: Record<string, IECDataType> = {
  S: 'BOOL', R1: 'BOOL', Q1: 'BOOL',
};

// Map from struct type name → its member table
const STRUCT_MEMBERS: Record<string, Record<string, IECDataType>> = {
  TIMER:       TIMER_MEMBERS,
  COUNTER:     COUNTER_MEMBERS,
  CONTROL:     { LEN: 'DINT', POS: 'DINT', FD: 'BOOL', ST: 'BOOL', DN: 'BOOL', EM: 'BOOL', ER: 'BOOL', UL: 'BOOL', IN: 'BOOL', EN: 'BOOL' },
  TON:         IEC_TIMER_MEMBERS,
  TOF:         IEC_TIMER_MEMBERS,
  TP:          IEC_TIMER_MEMBERS,
  RTO:         IEC_TIMER_MEMBERS,
  IEC_TIMER:   IEC_TIMER_MEMBERS,
  CTU:         IEC_COUNTER_MEMBERS,
  CTD:         IEC_COUNTER_MEMBERS,
  CTUD:        IEC_COUNTER_MEMBERS,
  IEC_COUNTER: IEC_COUNTER_MEMBERS,
  SR:          SR_MEMBERS,
  RS:          RS_MEMBERS,
};

// ─── Resolver class ───────────────────────────────────────────────────────────

export class VariableTypeResolver {
  // flat map: variableName → IECDataType (base type)
  private tagMap = new Map<string, IECDataType>();

  constructor(localTags: NormalizedTag[] = [], globalTags: NormalizedTag[] = []) {
    // Global tags are added first so local tags shadow them if names clash
    for (const tag of [...globalTags, ...localTags]) {
      this.tagMap.set(tag.name.toUpperCase(), tag.dataType);
    }
  }

  /**
   * Resolve a variable reference to its IECDataType.
   *
   * Handles:
   *   - Simple names:          "MyVar"    → looks up in tagMap
   *   - Struct member access:  "Timer1.DN" → resolves Timer1 → STRUCT (TIMER),
   *                            then looks up member 'DN' in TIMER_MEMBERS → BOOL
   *   - Array indexing:        "MyArray[0]" → strips index, resolves base
   *   - Literal values:        "T#5s", "100", "TRUE" → inferred from syntax
   *   - Falls back to 'BOOL' for anything unresolvable
   */
  resolve(name: string): IECDataType {
    if (!name) return 'BOOL';

    // Time literal: T#... or TIME#...
    if (/^(T#|TIME#|LT#)/i.test(name)) return 'TIME';
    // Date literals
    if (/^(D#|DATE#)/i.test(name)) return 'DATE';
    if (/^(TOD#|TIME_OF_DAY#)/i.test(name)) return 'TOD';
    if (/^(DT#|DATE_AND_TIME#)/i.test(name)) return 'DT';
    // String literal
    if (/^'.*'$/.test(name) || /^".*"$/.test(name)) return 'STRING';
    // Boolean literal
    if (/^(TRUE|FALSE)$/i.test(name)) return 'BOOL';
    // Integer literal
    if (/^-?\d+$/.test(name)) return 'DINT';
    // Float literal
    if (/^-?\d+\.\d+$/.test(name)) return 'REAL';
    // Hex literal
    if (/^16#[0-9A-F]+$/i.test(name)) return 'DWORD';
    // Binary literal
    if (/^2#[01]+$/.test(name)) return 'DWORD';

    // Strip array index: "MyArray[0]" → "MyArray"
    const withoutIndex = name.replace(/\[.*?\]/g, '');

    // Dot-notation member access: "Timer1.DN" → resolve base then member
    const dotIdx = withoutIndex.indexOf('.');
    if (dotIdx !== -1) {
      const baseName = withoutIndex.slice(0, dotIdx);
      const memberName = withoutIndex.slice(dotIdx + 1).toUpperCase();
      const baseType = this.resolveSimple(baseName);
      if (baseType === 'STRUCT') {
        // Try to look up the actual struct type name
        const baseTypeName = this.getStructTypeName(baseName);
        if (baseTypeName) {
          const members = STRUCT_MEMBERS[baseTypeName.toUpperCase()];
          if (members?.[memberName]) return members[memberName];
        }
        // Fallback: search all struct member tables for the member name
        for (const members of Object.values(STRUCT_MEMBERS)) {
          if (members[memberName]) return members[memberName];
        }
      }
      // If base is not a struct, the member is likely a field — return base type
      return baseType;
    }

    return this.resolveSimple(withoutIndex);
  }

  private resolveSimple(name: string): IECDataType {
    return this.tagMap.get(name.toUpperCase()) ?? 'BOOL';
  }

  /**
   * Returns the vendor-side type name (e.g. 'TIMER', 'TON') for a variable
   * whose IECDataType is 'STRUCT', so we can look up its member types.
   * We store a parallel structTypeMap for this.
   */
  private structTypeMap = new Map<string, string>();

  registerStructType(varName: string, structTypeName: string) {
    this.structTypeMap.set(varName.toUpperCase(), structTypeName.toUpperCase());
  }

  private getStructTypeName(varName: string): string | undefined {
    return this.structTypeMap.get(varName.toUpperCase());
  }
}

/**
 * Build a VariableTypeResolver from flat tag arrays.
 * Also registers struct types for variables whose dataType is STRUCT.
 */
export function buildResolver(
  localTags: NormalizedTag[],
  globalTags: NormalizedTag[],
  structTypeHints?: Array<{ varName: string; typeName: string }>,
): VariableTypeResolver {
  const r = new VariableTypeResolver(localTags, globalTags);
  if (structTypeHints) {
    for (const h of structTypeHints) r.registerStructType(h.varName, h.typeName);
  }
  return r;
}
