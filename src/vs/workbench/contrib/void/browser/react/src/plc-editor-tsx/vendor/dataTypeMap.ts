/*
 * Data Type Mapping — vendor type strings → IECDataType and back.
 * Each adapter calls these rather than inlining fragile switch statements.
 */

import type { IECDataType } from '../logicStore.js';

// ─── Rockwell ─────────────────────────────────────────────────────────────────

const ROCKWELL_TO_IEC: Record<string, IECDataType> = {
  BOOL:    'BOOL',
  INT:     'INT',
  UINT:    'UINT',
  DINT:    'DINT',
  UDINT:   'UDINT',
  LINT:    'LINT',
  ULINT:   'ULINT',
  REAL:    'REAL',
  LREAL:   'LREAL',
  SINT:    'INT',   // Rockwell SINT → nearest IEC type
  USINT:   'UINT',
  BYTE:    'BYTE',
  WORD:    'WORD',
  DWORD:   'DWORD',
  LWORD:   'LWORD',
  STRING:  'STRING',
  TIMER:   'STRUCT', // preserve as struct
  COUNTER: 'STRUCT',
  CONTROL: 'STRUCT',
};

export function rockwellTypeToIEC(t: string): IECDataType {
  return ROCKWELL_TO_IEC[t.toUpperCase()] ?? 'DINT';
}

export function iecTypeToRockwell(t: IECDataType): string {
  const map: Partial<Record<IECDataType, string>> = {
    BOOL: 'BOOL', INT: 'INT', UINT: 'UINT', DINT: 'DINT', UDINT: 'UDINT',
    LINT: 'LINT', ULINT: 'ULINT', REAL: 'REAL', LREAL: 'LREAL',
    BYTE: 'BYTE', WORD: 'WORD', DWORD: 'DWORD', LWORD: 'LWORD',
    STRING: 'STRING', STRUCT: 'DINT', ARRAY_BOOL: 'BOOL', ARRAY_INT: 'INT', ARRAY_REAL: 'REAL',
  };
  return map[t] ?? 'DINT';
}

// ─── Siemens ──────────────────────────────────────────────────────────────────

const SIEMENS_TO_IEC: Record<string, IECDataType> = {
  Bool:    'BOOL',
  Int:     'INT',
  UInt:    'UINT',
  DInt:    'DINT',
  UDInt:   'UDINT',
  LInt:    'LINT',
  ULInt:   'ULINT',
  Real:    'REAL',
  LReal:   'LREAL',
  Byte:    'BYTE',
  Word:    'WORD',
  DWord:   'DWORD',
  LWord:   'LWORD',
  String:  'STRING',
  WString: 'WSTRING',
  Time:    'TIME',
  Date:    'DATE',
  TimeOfDay: 'TOD',
  DTL:     'DT',
  Struct:  'STRUCT',
  Array:   'ARRAY_BOOL', // caller inspects element type for better mapping
};

export function siemensTypeToIEC(t: string): IECDataType {
  return SIEMENS_TO_IEC[t] ?? SIEMENS_TO_IEC[t.toLowerCase()] ?? 'DINT';
}

export function iecTypeToSimatic(t: IECDataType): string {
  const map: Partial<Record<IECDataType, string>> = {
    BOOL: 'Bool', INT: 'Int', UINT: 'UInt', DINT: 'DInt', UDINT: 'UDInt',
    LINT: 'LInt', ULINT: 'ULInt', REAL: 'Real', LREAL: 'LReal',
    BYTE: 'Byte', WORD: 'Word', DWORD: 'DWord', LWORD: 'LWord',
    STRING: 'String', WSTRING: 'WString', TIME: 'Time', DATE: 'Date',
    TOD: 'TimeOfDay', DT: 'DTL', STRUCT: 'Struct',
    ARRAY_BOOL: 'Array', ARRAY_INT: 'Array', ARRAY_REAL: 'Array',
  };
  return map[t] ?? 'DInt';
}

// ─── PLCopen XML ──────────────────────────────────────────────────────────────

// PLCopen uses standard IEC type names directly — trivial mapping
export function plcopenTypeToIEC(t: string): IECDataType {
  const upper = t.toUpperCase() as IECDataType;
  const valid: IECDataType[] = [
    'BOOL','INT','UINT','DINT','UDINT','LINT','ULINT','REAL','LREAL',
    'BYTE','WORD','DWORD','LWORD','STRING','WSTRING','TIME','DATE','TOD','DT',
    'ARRAY_BOOL','ARRAY_INT','ARRAY_REAL','STRUCT',
  ];
  return valid.includes(upper) ? upper : 'DINT';
}

// ─── Schneider (EcoStruxure/Control Expert) ───────────────────────────────────

const SCHNEIDER_TO_IEC: Record<string, IECDataType> = {
  BOOL:    'BOOL',
  BYTE:    'BYTE',
  INT:     'INT',
  UINT:    'UINT',
  DINT:    'DINT',
  UDINT:   'UDINT',
  REAL:    'REAL',
  LREAL:   'LREAL',
  STRING:  'STRING',
  WORD:    'WORD',
  DWORD:   'DWORD',
  LWORD:   'LWORD',
  TIME:    'TIME',
  DATE:    'DATE',
  TOD:     'TOD',
  DT:      'DT',
  EBOOL:   'BOOL',   // Schneider extended BOOL → BOOL (sidecar preserves original)
  TIME_OF_DAY: 'TOD',
};

export function schneiderTypeToIEC(t: string): IECDataType {
  return SCHNEIDER_TO_IEC[t.toUpperCase()] ?? 'DINT';
}
