/*
 * Canonical pin signature table for all IEC 61131-3 standard function blocks.
 *
 * This is the single source of truth for pin names and their IECDataType.
 * Every adapter uses this instead of hardcoding 'BOOL' everywhere.
 *
 * Structure per entry:
 *   inputs:  { pinName: IECDataType }[]   — ordered list, matches IEC 61131-3 standard
 *   outputs: { pinName: IECDataType }[]
 *
 * For blocks whose operand data type is polymorphic (ADD, SUB, MOVE, comparisons, etc.)
 * the canonical type is 'DINT' as the default numeric type. Callers that have concrete
 * variable declarations should override using resolveTagType() from variableTypeResolver.
 */

import type { IECDataType } from '../logicStore.js';

export interface PinDef {
  name: string;
  dataType: IECDataType;
}

export interface BlockSignature {
  inputs: PinDef[];
  outputs: PinDef[];
}

// ─── Standard IEC 61131-3 Function Block Signatures ───────────────────────────

const SIG: Record<string, BlockSignature> = {

  // ── Timers ────────────────────────────────────────────────────────────────
  TON: {
    inputs:  [{ name: 'IN', dataType: 'BOOL' }, { name: 'PT', dataType: 'TIME' }],
    outputs: [{ name: 'Q',  dataType: 'BOOL' }, { name: 'ET', dataType: 'TIME' }],
  },
  TOF: {
    inputs:  [{ name: 'IN', dataType: 'BOOL' }, { name: 'PT', dataType: 'TIME' }],
    outputs: [{ name: 'Q',  dataType: 'BOOL' }, { name: 'ET', dataType: 'TIME' }],
  },
  TP: {
    inputs:  [{ name: 'IN', dataType: 'BOOL' }, { name: 'PT', dataType: 'TIME' }],
    outputs: [{ name: 'Q',  dataType: 'BOOL' }, { name: 'ET', dataType: 'TIME' }],
  },
  // Rockwell retentive timer — same interface as TON
  RTO: {
    inputs:  [{ name: 'IN', dataType: 'BOOL' }, { name: 'PT', dataType: 'TIME' }],
    outputs: [{ name: 'Q',  dataType: 'BOOL' }, { name: 'ET', dataType: 'TIME' }],
  },

  // ── Counters ─────────────────────────────────────────────────────────────
  CTU: {
    inputs:  [{ name: 'CU', dataType: 'BOOL' }, { name: 'R',  dataType: 'BOOL' }, { name: 'PV', dataType: 'INT' }],
    outputs: [{ name: 'QU', dataType: 'BOOL' }, { name: 'CV', dataType: 'INT' }],
  },
  CTD: {
    inputs:  [{ name: 'CD', dataType: 'BOOL' }, { name: 'LD', dataType: 'BOOL' }, { name: 'PV', dataType: 'INT' }],
    outputs: [{ name: 'QD', dataType: 'BOOL' }, { name: 'CV', dataType: 'INT' }],
  },
  CTUD: {
    inputs:  [
      { name: 'CU', dataType: 'BOOL' }, { name: 'CD', dataType: 'BOOL' },
      { name: 'R',  dataType: 'BOOL' }, { name: 'LD', dataType: 'BOOL' },
      { name: 'PV', dataType: 'INT' },
    ],
    outputs: [{ name: 'QU', dataType: 'BOOL' }, { name: 'QD', dataType: 'BOOL' }, { name: 'CV', dataType: 'INT' }],
  },

  // ── Bistable latches ──────────────────────────────────────────────────────
  SR: {
    inputs:  [{ name: 'S1', dataType: 'BOOL' }, { name: 'R',  dataType: 'BOOL' }],
    outputs: [{ name: 'Q1', dataType: 'BOOL' }],
  },
  RS: {
    inputs:  [{ name: 'S',  dataType: 'BOOL' }, { name: 'R1', dataType: 'BOOL' }],
    outputs: [{ name: 'Q1', dataType: 'BOOL' }],
  },

  // ── Edge detection ────────────────────────────────────────────────────────
  RTRIG: {
    inputs:  [{ name: 'CLK', dataType: 'BOOL' }],
    outputs: [{ name: 'Q',   dataType: 'BOOL' }],
  },
  FTRIG: {
    inputs:  [{ name: 'CLK', dataType: 'BOOL' }],
    outputs: [{ name: 'Q',   dataType: 'BOOL' }],
  },
  // Alias names used by some vendors
  R_TRIG: {
    inputs:  [{ name: 'CLK', dataType: 'BOOL' }],
    outputs: [{ name: 'Q',   dataType: 'BOOL' }],
  },
  F_TRIG: {
    inputs:  [{ name: 'CLK', dataType: 'BOOL' }],
    outputs: [{ name: 'Q',   dataType: 'BOOL' }],
  },

  // ── Boolean gates (FBD) ───────────────────────────────────────────────────
  AND: {
    inputs:  [{ name: 'IN1', dataType: 'BOOL' }, { name: 'IN2', dataType: 'BOOL' }],
    outputs: [{ name: 'OUT', dataType: 'BOOL' }],
  },
  OR: {
    inputs:  [{ name: 'IN1', dataType: 'BOOL' }, { name: 'IN2', dataType: 'BOOL' }],
    outputs: [{ name: 'OUT', dataType: 'BOOL' }],
  },
  XOR: {
    inputs:  [{ name: 'IN1', dataType: 'BOOL' }, { name: 'IN2', dataType: 'BOOL' }],
    outputs: [{ name: 'OUT', dataType: 'BOOL' }],
  },
  NOT: {
    inputs:  [{ name: 'IN',  dataType: 'BOOL' }],
    outputs: [{ name: 'OUT', dataType: 'BOOL' }],
  },
  NAND: {
    inputs:  [{ name: 'IN1', dataType: 'BOOL' }, { name: 'IN2', dataType: 'BOOL' }],
    outputs: [{ name: 'OUT', dataType: 'BOOL' }],
  },
  NOR: {
    inputs:  [{ name: 'IN1', dataType: 'BOOL' }, { name: 'IN2', dataType: 'BOOL' }],
    outputs: [{ name: 'OUT', dataType: 'BOOL' }],
  },

  // ── Arithmetic (polymorphic — canonical default: DINT) ────────────────────
  ADD: {
    inputs:  [{ name: 'IN1', dataType: 'DINT' }, { name: 'IN2', dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'DINT' }],
  },
  SUB: {
    inputs:  [{ name: 'IN1', dataType: 'DINT' }, { name: 'IN2', dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'DINT' }],
  },
  MUL: {
    inputs:  [{ name: 'IN1', dataType: 'DINT' }, { name: 'IN2', dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'DINT' }],
  },
  DIV: {
    inputs:  [{ name: 'IN1', dataType: 'DINT' }, { name: 'IN2', dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'DINT' }],
  },
  MOD: {
    inputs:  [{ name: 'IN1', dataType: 'DINT' }, { name: 'IN2', dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'DINT' }],
  },
  ABS: {
    inputs:  [{ name: 'IN',  dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'DINT' }],
  },
  SQRT: {
    inputs:  [{ name: 'IN',  dataType: 'REAL' }],
    outputs: [{ name: 'OUT', dataType: 'REAL' }],
  },
  NEG: {
    inputs:  [{ name: 'IN',  dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'DINT' }],
  },

  // ── Math (always REAL) ────────────────────────────────────────────────────
  LN: {
    inputs:  [{ name: 'IN',  dataType: 'REAL' }],
    outputs: [{ name: 'OUT', dataType: 'REAL' }],
  },
  LOG: {
    inputs:  [{ name: 'IN',  dataType: 'REAL' }],
    outputs: [{ name: 'OUT', dataType: 'REAL' }],
  },
  EXP: {
    inputs:  [{ name: 'IN',  dataType: 'REAL' }],
    outputs: [{ name: 'OUT', dataType: 'REAL' }],
  },
  SIN: {
    inputs:  [{ name: 'IN',  dataType: 'REAL' }],
    outputs: [{ name: 'OUT', dataType: 'REAL' }],
  },
  COS: {
    inputs:  [{ name: 'IN',  dataType: 'REAL' }],
    outputs: [{ name: 'OUT', dataType: 'REAL' }],
  },
  TAN: {
    inputs:  [{ name: 'IN',  dataType: 'REAL' }],
    outputs: [{ name: 'OUT', dataType: 'REAL' }],
  },
  ASIN: {
    inputs:  [{ name: 'IN',  dataType: 'REAL' }],
    outputs: [{ name: 'OUT', dataType: 'REAL' }],
  },
  ACOS: {
    inputs:  [{ name: 'IN',  dataType: 'REAL' }],
    outputs: [{ name: 'OUT', dataType: 'REAL' }],
  },
  ATAN: {
    inputs:  [{ name: 'IN',  dataType: 'REAL' }],
    outputs: [{ name: 'OUT', dataType: 'REAL' }],
  },
  // Rockwell aliases
  ATN:  { inputs: [{ name: 'IN', dataType: 'REAL' }], outputs: [{ name: 'OUT', dataType: 'REAL' }] },
  ASN:  { inputs: [{ name: 'IN', dataType: 'REAL' }], outputs: [{ name: 'OUT', dataType: 'REAL' }] },
  ACS:  { inputs: [{ name: 'IN', dataType: 'REAL' }], outputs: [{ name: 'OUT', dataType: 'REAL' }] },
  SQR:  { inputs: [{ name: 'IN', dataType: 'REAL' }], outputs: [{ name: 'OUT', dataType: 'REAL' }] },
  XPY: {
    inputs:  [{ name: 'Source', dataType: 'REAL' }, { name: 'Exponent', dataType: 'REAL' }],
    outputs: [{ name: 'Dest',   dataType: 'REAL' }],
  },

  // ── Comparison (output is BOOL, inputs are polymorphic numeric — default DINT) ──
  GT: {
    inputs:  [{ name: 'IN1', dataType: 'DINT' }, { name: 'IN2', dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'BOOL' }],
  },
  GE: {
    inputs:  [{ name: 'IN1', dataType: 'DINT' }, { name: 'IN2', dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'BOOL' }],
  },
  LT: {
    inputs:  [{ name: 'IN1', dataType: 'DINT' }, { name: 'IN2', dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'BOOL' }],
  },
  LE: {
    inputs:  [{ name: 'IN1', dataType: 'DINT' }, { name: 'IN2', dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'BOOL' }],
  },
  EQ: {
    inputs:  [{ name: 'IN1', dataType: 'DINT' }, { name: 'IN2', dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'BOOL' }],
  },
  NE: {
    inputs:  [{ name: 'IN1', dataType: 'DINT' }, { name: 'IN2', dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'BOOL' }],
  },

  // ── Data/selection (polymorphic — default DINT) ───────────────────────────
  MOVE: {
    inputs:  [{ name: 'IN',  dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'DINT' }],
  },
  SEL: {
    inputs:  [{ name: 'G',   dataType: 'BOOL' }, { name: 'IN0', dataType: 'DINT' }, { name: 'IN1', dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'DINT' }],
  },
  MUX: {
    inputs:  [{ name: 'K',   dataType: 'DINT' }, { name: 'IN0', dataType: 'DINT' }, { name: 'IN1', dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'DINT' }],
  },
  LIMIT: {
    inputs:  [{ name: 'MN',  dataType: 'DINT' }, { name: 'IN',  dataType: 'DINT' }, { name: 'MX', dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'DINT' }],
  },
  MIN: {
    inputs:  [{ name: 'IN1', dataType: 'DINT' }, { name: 'IN2', dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'DINT' }],
  },
  MAX: {
    inputs:  [{ name: 'IN1', dataType: 'DINT' }, { name: 'IN2', dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'DINT' }],
  },

  // ── Rockwell-specific instruction blocks ─────────────────────────────────
  MOV: {
    inputs:  [{ name: 'Source', dataType: 'DINT' }],
    outputs: [{ name: 'Dest',   dataType: 'DINT' }],
  },
  COP: {
    inputs:  [{ name: 'Source', dataType: 'DINT' }, { name: 'Length', dataType: 'DINT' }],
    outputs: [{ name: 'Dest',   dataType: 'DINT' }],
  },
  MVM: {
    inputs:  [{ name: 'Source', dataType: 'DWORD' }, { name: 'Mask', dataType: 'DWORD' }],
    outputs: [{ name: 'Dest',   dataType: 'DWORD' }],
  },
  BTD: {
    inputs:  [
      { name: 'Source',     dataType: 'DWORD' }, { name: 'SourceBit', dataType: 'DINT' },
      { name: 'DestBit',    dataType: 'DINT'  }, { name: 'Length',    dataType: 'DINT' },
    ],
    outputs: [{ name: 'Dest', dataType: 'DWORD' }],
  },
  SWPB: {
    inputs:  [{ name: 'Source', dataType: 'DWORD' }, { name: 'Order', dataType: 'DINT' }],
    outputs: [{ name: 'Dest',   dataType: 'DWORD' }],
  },
  FLL: {
    inputs:  [{ name: 'Source', dataType: 'DINT' }, { name: 'Length', dataType: 'DINT' }],
    outputs: [{ name: 'Dest',   dataType: 'DINT' }],
  },
  SIZE: {
    inputs:  [{ name: 'Source', dataType: 'DINT' }, { name: 'Dim', dataType: 'DINT' }],
    outputs: [{ name: 'Dest',   dataType: 'DINT' }],
  },
  CPT: {
    inputs:  [{ name: 'Expression', dataType: 'STRING' }],
    outputs: [{ name: 'Dest',       dataType: 'DINT'   }],
  },
  CMP: {
    inputs:  [{ name: 'Expression', dataType: 'STRING' }],
    outputs: [{ name: 'OUT',        dataType: 'BOOL'   }],
  },

  // Rockwell FIFO/LIFO
  FFL: {
    inputs:  [{ name: 'Source', dataType: 'DINT' }, { name: 'FIFO', dataType: 'DINT' }, { name: 'Length', dataType: 'DINT' }, { name: 'Position', dataType: 'DINT' }],
    outputs: [{ name: 'OUT',    dataType: 'BOOL' }],
  },
  FFU: {
    inputs:  [{ name: 'FIFO',   dataType: 'DINT' }, { name: 'Dest',   dataType: 'DINT' }, { name: 'Length', dataType: 'DINT' }, { name: 'Position', dataType: 'DINT' }],
    outputs: [{ name: 'OUT',    dataType: 'BOOL' }],
  },
  LFL: {
    inputs:  [{ name: 'Source', dataType: 'DINT' }, { name: 'Stack',  dataType: 'DINT' }, { name: 'Length', dataType: 'DINT' }, { name: 'Position', dataType: 'DINT' }],
    outputs: [{ name: 'OUT',    dataType: 'BOOL' }],
  },
  LFU: {
    inputs:  [{ name: 'Stack',  dataType: 'DINT' }, { name: 'Dest',   dataType: 'DINT' }, { name: 'Length', dataType: 'DINT' }, { name: 'Position', dataType: 'DINT' }],
    outputs: [{ name: 'OUT',    dataType: 'BOOL' }],
  },

  // Rockwell sequencer
  SQO: {
    inputs:  [{ name: 'Array',  dataType: 'DWORD' }, { name: 'Mask', dataType: 'DWORD' }, { name: 'Dest',   dataType: 'DWORD' }, { name: 'Length', dataType: 'DINT' }, { name: 'Position', dataType: 'DINT' }],
    outputs: [{ name: 'OUT',    dataType: 'BOOL' }],
  },
  SQI: {
    inputs:  [{ name: 'Array',  dataType: 'DWORD' }, { name: 'Mask', dataType: 'DWORD' }, { name: 'Source', dataType: 'DWORD' }, { name: 'Length', dataType: 'DINT' }, { name: 'Position', dataType: 'DINT' }],
    outputs: [{ name: 'Found',  dataType: 'BOOL' }],
  },
  SQL: {
    inputs:  [{ name: 'Array',  dataType: 'DWORD' }, { name: 'Length', dataType: 'DINT' }, { name: 'Position', dataType: 'DINT' }],
    outputs: [{ name: 'OUT',    dataType: 'BOOL' }],
  },

  // Rockwell PID
  PID: {
    inputs:  [
      { name: 'PID',      dataType: 'STRUCT' }, { name: 'Process',  dataType: 'REAL' },
      { name: 'Tieback',  dataType: 'REAL'   }, { name: 'Control',  dataType: 'REAL' },
    ],
    outputs: [{ name: 'OUT',    dataType: 'BOOL' }],
  },

  // Rockwell string instructions
  CONCAT: {
    inputs:  [{ name: 'Source1', dataType: 'STRING' }, { name: 'Source2', dataType: 'STRING' }],
    outputs: [{ name: 'Dest',    dataType: 'STRING' }],
  },
  MID: {
    inputs:  [{ name: 'Source', dataType: 'STRING' }, { name: 'Qty', dataType: 'DINT' }, { name: 'Start', dataType: 'DINT' }],
    outputs: [{ name: 'Dest',   dataType: 'STRING' }],
  },
  FIND: {
    inputs:  [{ name: 'Source', dataType: 'STRING' }, { name: 'Search', dataType: 'STRING' }],
    outputs: [{ name: 'Result', dataType: 'DINT'   }],
  },
  INSERT: {
    inputs:  [{ name: 'Source', dataType: 'STRING' }, { name: 'Insert', dataType: 'STRING' }, { name: 'Start', dataType: 'DINT' }],
    outputs: [{ name: 'Dest',   dataType: 'STRING' }],
  },
  DELETE: {
    inputs:  [{ name: 'Source', dataType: 'STRING' }, { name: 'Qty', dataType: 'DINT' }, { name: 'Start', dataType: 'DINT' }],
    outputs: [{ name: 'Dest',   dataType: 'STRING' }],
  },
  LEN: {
    inputs:  [{ name: 'Source', dataType: 'STRING' }],
    outputs: [{ name: 'Dest',   dataType: 'DINT'   }],
  },
  UPPER_CASE: {
    inputs:  [{ name: 'IN',  dataType: 'STRING' }],
    outputs: [{ name: 'OUT', dataType: 'STRING' }],
  },
  LOWER_CASE: {
    inputs:  [{ name: 'IN',  dataType: 'STRING' }],
    outputs: [{ name: 'OUT', dataType: 'STRING' }],
  },
  CONCAT_DATE_TOD: {
    inputs:  [{ name: 'IN1', dataType: 'DATE' }, { name: 'IN2', dataType: 'TOD' }],
    outputs: [{ name: 'OUT', dataType: 'DT'   }],
  },

  // Rockwell message / motion (preserve as blocks with minimal typed pins)
  MSG: {
    inputs:  [{ name: 'Message', dataType: 'STRUCT' }],
    outputs: [{ name: 'DN',      dataType: 'BOOL'   }],
  },
  MAJ: {
    inputs:  [{ name: 'Axis',    dataType: 'STRUCT' }],
    outputs: [{ name: 'Done',    dataType: 'BOOL'   }],
  },
  MAM: {
    inputs:  [{ name: 'Axis',    dataType: 'STRUCT' }, { name: 'MotionControl', dataType: 'STRUCT' }],
    outputs: [{ name: 'Done',    dataType: 'BOOL'   }],
  },
  MAS: {
    inputs:  [{ name: 'Axis',    dataType: 'STRUCT' }, { name: 'MotionControl', dataType: 'STRUCT' }],
    outputs: [{ name: 'Done',    dataType: 'BOOL'   }],
  },
  GSV: {
    inputs:  [{ name: 'Object',    dataType: 'STRING' }, { name: 'Attribute', dataType: 'STRING' }],
    outputs: [{ name: 'Dest',      dataType: 'DINT'   }],
  },
  SSV: {
    inputs:  [{ name: 'Object',    dataType: 'STRING' }, { name: 'Attribute', dataType: 'STRING' }, { name: 'Source', dataType: 'DINT' }],
    outputs: [{ name: 'OUT',       dataType: 'BOOL'   }],
  },

  // Rockwell LIM (limit test) — range check
  LIM: {
    inputs:  [{ name: 'LowLimit', dataType: 'DINT' }, { name: 'Test', dataType: 'DINT' }, { name: 'HighLimit', dataType: 'DINT' }],
    outputs: [{ name: 'OUT',      dataType: 'BOOL' }],
  },
  MEQ: {
    inputs:  [{ name: 'Source', dataType: 'DWORD' }, { name: 'Mask', dataType: 'DWORD' }, { name: 'Compare', dataType: 'DWORD' }],
    outputs: [{ name: 'OUT',    dataType: 'BOOL' }],
  },

  // Siemens-specific (IEC library equivalents)
  BLINK: {
    inputs:  [{ name: 'ENABLE', dataType: 'BOOL' }, { name: 'TIME_HIGH', dataType: 'TIME' }, { name: 'TIME_LOW', dataType: 'TIME' }],
    outputs: [{ name: 'OUT',    dataType: 'BOOL' }],
  },
  TONR: {
    inputs:  [{ name: 'IN', dataType: 'BOOL' }, { name: 'R',  dataType: 'BOOL' }, { name: 'PT', dataType: 'TIME' }],
    outputs: [{ name: 'Q',  dataType: 'BOOL' }, { name: 'ET', dataType: 'TIME' }],
  },
  IEC_TIMER: {
    inputs:  [{ name: 'IN', dataType: 'BOOL' }, { name: 'PT', dataType: 'TIME' }],
    outputs: [{ name: 'Q',  dataType: 'BOOL' }, { name: 'ET', dataType: 'TIME' }],
  },
  IEC_LTIMER: {
    inputs:  [{ name: 'IN', dataType: 'BOOL' }, { name: 'PT', dataType: 'TIME' }],
    outputs: [{ name: 'Q',  dataType: 'BOOL' }, { name: 'ET', dataType: 'TIME' }],
  },
  IEC_COUNTER: {
    inputs:  [{ name: 'CU', dataType: 'BOOL' }, { name: 'R',  dataType: 'BOOL' }, { name: 'PV', dataType: 'INT' }],
    outputs: [{ name: 'QU', dataType: 'BOOL' }, { name: 'CV', dataType: 'INT' }],
  },
  IEC_LCOUNTER: {
    inputs:  [{ name: 'CU', dataType: 'BOOL' }, { name: 'R',  dataType: 'BOOL' }, { name: 'PV', dataType: 'INT' }],
    outputs: [{ name: 'QU', dataType: 'BOOL' }, { name: 'CV', dataType: 'INT' }],
  },

  // Siemens scaling (analog I/O)
  SCALE: {
    inputs:  [{ name: 'IN', dataType: 'INT' }, { name: 'HI_LIM', dataType: 'REAL' }, { name: 'LO_LIM', dataType: 'REAL' }, { name: 'BIPOLAR', dataType: 'BOOL' }],
    outputs: [{ name: 'OUT', dataType: 'REAL' }, { name: 'RET_VAL', dataType: 'INT' }],
  },
  UNSCALE: {
    inputs:  [{ name: 'IN', dataType: 'REAL' }, { name: 'HI_LIM', dataType: 'REAL' }, { name: 'LO_LIM', dataType: 'REAL' }, { name: 'BIPOLAR', dataType: 'BOOL' }],
    outputs: [{ name: 'OUT', dataType: 'INT' }, { name: 'RET_VAL', dataType: 'INT' }],
  },
  NORM_X: {
    inputs:  [{ name: 'MIN', dataType: 'REAL' }, { name: 'VALUE', dataType: 'REAL' }, { name: 'MAX', dataType: 'REAL' }],
    outputs: [{ name: 'OUT', dataType: 'REAL' }],
  },
  SCALE_X: {
    inputs:  [{ name: 'MIN', dataType: 'REAL' }, { name: 'VALUE', dataType: 'REAL' }, { name: 'MAX', dataType: 'REAL' }],
    outputs: [{ name: 'OUT', dataType: 'REAL' }],
  },

  // Siemens string functions
  S_LEN:   { inputs: [{ name: 'S',   dataType: 'STRING' }], outputs: [{ name: 'RET_VAL', dataType: 'INT' }] },
  S_LEFT:  { inputs: [{ name: 'L',   dataType: 'STRING' }, { name: 'N', dataType: 'INT' }], outputs: [{ name: 'RET_VAL', dataType: 'STRING' }] },
  S_RIGHT: { inputs: [{ name: 'L',   dataType: 'STRING' }, { name: 'N', dataType: 'INT' }], outputs: [{ name: 'RET_VAL', dataType: 'STRING' }] },
  S_MID:   { inputs: [{ name: 'L',   dataType: 'STRING' }, { name: 'N', dataType: 'INT' }, { name: 'P', dataType: 'INT' }], outputs: [{ name: 'RET_VAL', dataType: 'STRING' }] },
  S_FIND:  { inputs: [{ name: 'IN1', dataType: 'STRING' }, { name: 'IN2', dataType: 'STRING' }], outputs: [{ name: 'RET_VAL', dataType: 'INT' }] },
  S_CONV:  { inputs: [{ name: 'IN',  dataType: 'DINT'   }], outputs: [{ name: 'OUT', dataType: 'STRING' }] },
  S_CONCAT:{ inputs: [{ name: 'IN1', dataType: 'STRING' }, { name: 'IN2', dataType: 'STRING' }], outputs: [{ name: 'OUT', dataType: 'STRING' }] },

  // Siemens type conversions
  CONVERT: {
    inputs:  [{ name: 'IN',  dataType: 'DINT' }],
    outputs: [{ name: 'OUT', dataType: 'DINT' }],
  },
  ROUND: {
    inputs:  [{ name: 'IN',  dataType: 'REAL' }],
    outputs: [{ name: 'OUT', dataType: 'DINT' }],
  },
  TRUNC: {
    inputs:  [{ name: 'IN',  dataType: 'REAL' }],
    outputs: [{ name: 'OUT', dataType: 'DINT' }],
  },
  CEIL: {
    inputs:  [{ name: 'IN',  dataType: 'REAL' }],
    outputs: [{ name: 'OUT', dataType: 'REAL' }],
  },
  FLOOR: {
    inputs:  [{ name: 'IN',  dataType: 'REAL' }],
    outputs: [{ name: 'OUT', dataType: 'REAL' }],
  },

  // Siemens communication / data exchange FBs (minimal typed pins)
  SEND: {
    inputs:  [{ name: 'REQ', dataType: 'BOOL' }, { name: 'ID', dataType: 'WORD' }, { name: 'SD_1', dataType: 'STRUCT' }],
    outputs: [{ name: 'DONE', dataType: 'BOOL' }, { name: 'ERROR', dataType: 'BOOL' }, { name: 'STATUS', dataType: 'WORD' }],
  },
  RECV: {
    inputs:  [{ name: 'EN_R', dataType: 'BOOL' }, { name: 'ID', dataType: 'WORD' }, { name: 'RD_1', dataType: 'STRUCT' }],
    outputs: [{ name: 'NDR', dataType: 'BOOL' }, { name: 'ERROR', dataType: 'BOOL' }, { name: 'STATUS', dataType: 'WORD' }],
  },
  RDREC: {
    inputs:  [{ name: 'REQ', dataType: 'BOOL' }, { name: 'ID', dataType: 'WORD' }, { name: 'INDEX', dataType: 'DINT' }, { name: 'MLEN', dataType: 'DINT' }],
    outputs: [{ name: 'VALID', dataType: 'BOOL' }, { name: 'BUSY', dataType: 'BOOL' }, { name: 'ERROR', dataType: 'BOOL' }, { name: 'LEN', dataType: 'DINT' }],
  },
  WRREC: {
    inputs:  [{ name: 'REQ', dataType: 'BOOL' }, { name: 'ID', dataType: 'WORD' }, { name: 'INDEX', dataType: 'DINT' }, { name: 'LEN', dataType: 'DINT' }],
    outputs: [{ name: 'DONE', dataType: 'BOOL' }, { name: 'BUSY', dataType: 'BOOL' }, { name: 'ERROR', dataType: 'BOOL' }],
  },

  // Standard IEC data conversions (used across all vendors)
  INT_TO_REAL:  { inputs: [{ name: 'IN', dataType: 'INT'  }], outputs: [{ name: 'OUT', dataType: 'REAL'  }] },
  REAL_TO_INT:  { inputs: [{ name: 'IN', dataType: 'REAL' }], outputs: [{ name: 'OUT', dataType: 'INT'   }] },
  DINT_TO_REAL: { inputs: [{ name: 'IN', dataType: 'DINT' }], outputs: [{ name: 'OUT', dataType: 'REAL'  }] },
  REAL_TO_DINT: { inputs: [{ name: 'IN', dataType: 'REAL' }], outputs: [{ name: 'OUT', dataType: 'DINT'  }] },
  INT_TO_DINT:  { inputs: [{ name: 'IN', dataType: 'INT'  }], outputs: [{ name: 'OUT', dataType: 'DINT'  }] },
  BOOL_TO_INT:  { inputs: [{ name: 'IN', dataType: 'BOOL' }], outputs: [{ name: 'OUT', dataType: 'INT'   }] },
  INT_TO_BOOL:  { inputs: [{ name: 'IN', dataType: 'INT'  }], outputs: [{ name: 'OUT', dataType: 'BOOL'  }] },
  WORD_TO_INT:  { inputs: [{ name: 'IN', dataType: 'WORD' }], outputs: [{ name: 'OUT', dataType: 'INT'   }] },
  INT_TO_WORD:  { inputs: [{ name: 'IN', dataType: 'INT'  }], outputs: [{ name: 'OUT', dataType: 'WORD'  }] },
  DWORD_TO_DINT:{ inputs: [{ name: 'IN', dataType: 'DWORD'}], outputs: [{ name: 'OUT', dataType: 'DINT'  }] },
  DINT_TO_DWORD:{ inputs: [{ name: 'IN', dataType: 'DINT' }], outputs: [{ name: 'OUT', dataType: 'DWORD' }] },
  TIME_TO_DINT: { inputs: [{ name: 'IN', dataType: 'TIME' }], outputs: [{ name: 'OUT', dataType: 'DINT'  }] },
  DINT_TO_TIME: { inputs: [{ name: 'IN', dataType: 'DINT' }], outputs: [{ name: 'OUT', dataType: 'TIME'  }] },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the canonical pin signature for a block type name.
 * Returns null if the block type is unknown (caller should fall back to 'BOOL').
 */
export function getBlockSignature(blockType: string): BlockSignature | null {
  return SIG[blockType.toUpperCase()] ?? SIG[blockType] ?? null;
}

/**
 * Returns the IECDataType for a named input pin of a known block type.
 * Falls back to 'BOOL' for boolean-context blocks, 'DINT' otherwise.
 */
export function getPinDataType(blockType: string, pinName: string, direction: 'input' | 'output'): IECDataType {
  const sig = getBlockSignature(blockType);
  if (!sig) return 'BOOL';
  const list = direction === 'input' ? sig.inputs : sig.outputs;
  return list.find(p => p.name === pinName)?.dataType ?? list[0]?.dataType ?? 'BOOL';
}

/**
 * Builds a full set of typed Pin[] arrays from the canonical signature.
 * Any pin names present in `connectedPins` are wired with a resolved dataType
 * (the canonical type takes priority over whatever the vendor XML said).
 * Missing pins get the canonical default type with an empty value.
 */
export function buildTypedPins(
  blockType: string,
  connectedPinNames: string[],
  idPrefix: string,
): { inputs: { id: string; name: string; dataType: IECDataType; negated?: boolean }[];
    outputs: { id: string; name: string; dataType: IECDataType; negated?: boolean }[] } {
  const sig = getBlockSignature(blockType);
  if (!sig) {
    // Unknown block type — return all connected pins as BOOL inputs/outputs
    const pins = connectedPinNames.map((n, i) => ({ id: `${idPrefix}-pin-${i}`, name: n, dataType: 'BOOL' as IECDataType }));
    return { inputs: pins, outputs: [] };
  }

  const inputs = sig.inputs.map((pd, i) => ({
    id: `${idPrefix}-in-${pd.name}-${i}`,
    name: pd.name,
    dataType: pd.dataType,
  }));
  const outputs = sig.outputs.map((pd, i) => ({
    id: `${idPrefix}-out-${pd.name}-${i}`,
    name: pd.name,
    dataType: pd.dataType,
  }));
  return { inputs, outputs };
}

/**
 * Returns typed TagRef pins (for LD BlockElement.pins) from the canonical signature.
 * `resolvedValues` maps pin name → connected variable name (from the vendor XML).
 * Any pin not present in resolvedValues keeps its canonical type but gets name = ''.
 */
export function buildTypedTagRefPins(
  blockType: string,
  resolvedValues: Record<string, string>,
): Record<string, { name: string; dataType: IECDataType }> {
  const sig = getBlockSignature(blockType);
  if (!sig) {
    // Unknown — pass through whatever was resolved, default to BOOL
    return Object.fromEntries(
      Object.entries(resolvedValues).map(([k, v]) => [k, { name: v, dataType: 'BOOL' as IECDataType }])
    );
  }

  const result: Record<string, { name: string; dataType: IECDataType }> = {};
  for (const pd of [...sig.inputs, ...sig.outputs]) {
    result[pd.name] = {
      name: resolvedValues[pd.name] ?? '',
      dataType: pd.dataType,
    };
  }
  // Also include any extra pins from the vendor XML that the signature doesn't cover
  for (const [k, v] of Object.entries(resolvedValues)) {
    if (!(k in result)) {
      result[k] = { name: v, dataType: 'BOOL' };
    }
  }
  return result;
}
