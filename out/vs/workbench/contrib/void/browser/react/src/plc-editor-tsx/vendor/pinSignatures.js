const SIG = {
  // ── Timers ────────────────────────────────────────────────────────────────
  TON: {
    inputs: [{ name: "IN", dataType: "BOOL" }, { name: "PT", dataType: "TIME" }],
    outputs: [{ name: "Q", dataType: "BOOL" }, { name: "ET", dataType: "TIME" }]
  },
  TOF: {
    inputs: [{ name: "IN", dataType: "BOOL" }, { name: "PT", dataType: "TIME" }],
    outputs: [{ name: "Q", dataType: "BOOL" }, { name: "ET", dataType: "TIME" }]
  },
  TP: {
    inputs: [{ name: "IN", dataType: "BOOL" }, { name: "PT", dataType: "TIME" }],
    outputs: [{ name: "Q", dataType: "BOOL" }, { name: "ET", dataType: "TIME" }]
  },
  // Rockwell retentive timer — same interface as TON
  RTO: {
    inputs: [{ name: "IN", dataType: "BOOL" }, { name: "PT", dataType: "TIME" }],
    outputs: [{ name: "Q", dataType: "BOOL" }, { name: "ET", dataType: "TIME" }]
  },
  // ── Counters ─────────────────────────────────────────────────────────────
  CTU: {
    inputs: [{ name: "CU", dataType: "BOOL" }, { name: "R", dataType: "BOOL" }, { name: "PV", dataType: "INT" }],
    outputs: [{ name: "QU", dataType: "BOOL" }, { name: "CV", dataType: "INT" }]
  },
  CTD: {
    inputs: [{ name: "CD", dataType: "BOOL" }, { name: "LD", dataType: "BOOL" }, { name: "PV", dataType: "INT" }],
    outputs: [{ name: "QD", dataType: "BOOL" }, { name: "CV", dataType: "INT" }]
  },
  CTUD: {
    inputs: [
      { name: "CU", dataType: "BOOL" },
      { name: "CD", dataType: "BOOL" },
      { name: "R", dataType: "BOOL" },
      { name: "LD", dataType: "BOOL" },
      { name: "PV", dataType: "INT" }
    ],
    outputs: [{ name: "QU", dataType: "BOOL" }, { name: "QD", dataType: "BOOL" }, { name: "CV", dataType: "INT" }]
  },
  // ── Bistable latches ──────────────────────────────────────────────────────
  SR: {
    inputs: [{ name: "S1", dataType: "BOOL" }, { name: "R", dataType: "BOOL" }],
    outputs: [{ name: "Q1", dataType: "BOOL" }]
  },
  RS: {
    inputs: [{ name: "S", dataType: "BOOL" }, { name: "R1", dataType: "BOOL" }],
    outputs: [{ name: "Q1", dataType: "BOOL" }]
  },
  // ── Edge detection ────────────────────────────────────────────────────────
  RTRIG: {
    inputs: [{ name: "CLK", dataType: "BOOL" }],
    outputs: [{ name: "Q", dataType: "BOOL" }]
  },
  FTRIG: {
    inputs: [{ name: "CLK", dataType: "BOOL" }],
    outputs: [{ name: "Q", dataType: "BOOL" }]
  },
  // Alias names used by some vendors
  R_TRIG: {
    inputs: [{ name: "CLK", dataType: "BOOL" }],
    outputs: [{ name: "Q", dataType: "BOOL" }]
  },
  F_TRIG: {
    inputs: [{ name: "CLK", dataType: "BOOL" }],
    outputs: [{ name: "Q", dataType: "BOOL" }]
  },
  // ── Boolean gates (FBD) ───────────────────────────────────────────────────
  AND: {
    inputs: [{ name: "IN1", dataType: "BOOL" }, { name: "IN2", dataType: "BOOL" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  OR: {
    inputs: [{ name: "IN1", dataType: "BOOL" }, { name: "IN2", dataType: "BOOL" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  XOR: {
    inputs: [{ name: "IN1", dataType: "BOOL" }, { name: "IN2", dataType: "BOOL" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  NOT: {
    inputs: [{ name: "IN", dataType: "BOOL" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  NAND: {
    inputs: [{ name: "IN1", dataType: "BOOL" }, { name: "IN2", dataType: "BOOL" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  NOR: {
    inputs: [{ name: "IN1", dataType: "BOOL" }, { name: "IN2", dataType: "BOOL" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  // ── Arithmetic (polymorphic — canonical default: DINT) ────────────────────
  ADD: {
    inputs: [{ name: "IN1", dataType: "DINT" }, { name: "IN2", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "DINT" }]
  },
  SUB: {
    inputs: [{ name: "IN1", dataType: "DINT" }, { name: "IN2", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "DINT" }]
  },
  MUL: {
    inputs: [{ name: "IN1", dataType: "DINT" }, { name: "IN2", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "DINT" }]
  },
  DIV: {
    inputs: [{ name: "IN1", dataType: "DINT" }, { name: "IN2", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "DINT" }]
  },
  MOD: {
    inputs: [{ name: "IN1", dataType: "DINT" }, { name: "IN2", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "DINT" }]
  },
  ABS: {
    inputs: [{ name: "IN", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "DINT" }]
  },
  SQRT: {
    inputs: [{ name: "IN", dataType: "REAL" }],
    outputs: [{ name: "OUT", dataType: "REAL" }]
  },
  NEG: {
    inputs: [{ name: "IN", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "DINT" }]
  },
  // ── Math (always REAL) ────────────────────────────────────────────────────
  LN: {
    inputs: [{ name: "IN", dataType: "REAL" }],
    outputs: [{ name: "OUT", dataType: "REAL" }]
  },
  LOG: {
    inputs: [{ name: "IN", dataType: "REAL" }],
    outputs: [{ name: "OUT", dataType: "REAL" }]
  },
  EXP: {
    inputs: [{ name: "IN", dataType: "REAL" }],
    outputs: [{ name: "OUT", dataType: "REAL" }]
  },
  SIN: {
    inputs: [{ name: "IN", dataType: "REAL" }],
    outputs: [{ name: "OUT", dataType: "REAL" }]
  },
  COS: {
    inputs: [{ name: "IN", dataType: "REAL" }],
    outputs: [{ name: "OUT", dataType: "REAL" }]
  },
  TAN: {
    inputs: [{ name: "IN", dataType: "REAL" }],
    outputs: [{ name: "OUT", dataType: "REAL" }]
  },
  ASIN: {
    inputs: [{ name: "IN", dataType: "REAL" }],
    outputs: [{ name: "OUT", dataType: "REAL" }]
  },
  ACOS: {
    inputs: [{ name: "IN", dataType: "REAL" }],
    outputs: [{ name: "OUT", dataType: "REAL" }]
  },
  ATAN: {
    inputs: [{ name: "IN", dataType: "REAL" }],
    outputs: [{ name: "OUT", dataType: "REAL" }]
  },
  // Rockwell aliases
  ATN: { inputs: [{ name: "IN", dataType: "REAL" }], outputs: [{ name: "OUT", dataType: "REAL" }] },
  ASN: { inputs: [{ name: "IN", dataType: "REAL" }], outputs: [{ name: "OUT", dataType: "REAL" }] },
  ACS: { inputs: [{ name: "IN", dataType: "REAL" }], outputs: [{ name: "OUT", dataType: "REAL" }] },
  SQR: { inputs: [{ name: "IN", dataType: "REAL" }], outputs: [{ name: "OUT", dataType: "REAL" }] },
  XPY: {
    inputs: [{ name: "Source", dataType: "REAL" }, { name: "Exponent", dataType: "REAL" }],
    outputs: [{ name: "Dest", dataType: "REAL" }]
  },
  // ── Comparison (output is BOOL, inputs are polymorphic numeric — default DINT) ──
  GT: {
    inputs: [{ name: "IN1", dataType: "DINT" }, { name: "IN2", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  GE: {
    inputs: [{ name: "IN1", dataType: "DINT" }, { name: "IN2", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  LT: {
    inputs: [{ name: "IN1", dataType: "DINT" }, { name: "IN2", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  LE: {
    inputs: [{ name: "IN1", dataType: "DINT" }, { name: "IN2", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  EQ: {
    inputs: [{ name: "IN1", dataType: "DINT" }, { name: "IN2", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  NE: {
    inputs: [{ name: "IN1", dataType: "DINT" }, { name: "IN2", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  // ── Data/selection (polymorphic — default DINT) ───────────────────────────
  MOVE: {
    inputs: [{ name: "IN", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "DINT" }]
  },
  SEL: {
    inputs: [{ name: "G", dataType: "BOOL" }, { name: "IN0", dataType: "DINT" }, { name: "IN1", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "DINT" }]
  },
  MUX: {
    inputs: [{ name: "K", dataType: "DINT" }, { name: "IN0", dataType: "DINT" }, { name: "IN1", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "DINT" }]
  },
  LIMIT: {
    inputs: [{ name: "MN", dataType: "DINT" }, { name: "IN", dataType: "DINT" }, { name: "MX", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "DINT" }]
  },
  MIN: {
    inputs: [{ name: "IN1", dataType: "DINT" }, { name: "IN2", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "DINT" }]
  },
  MAX: {
    inputs: [{ name: "IN1", dataType: "DINT" }, { name: "IN2", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "DINT" }]
  },
  // ── Rockwell-specific instruction blocks ─────────────────────────────────
  MOV: {
    inputs: [{ name: "Source", dataType: "DINT" }],
    outputs: [{ name: "Dest", dataType: "DINT" }]
  },
  COP: {
    inputs: [{ name: "Source", dataType: "DINT" }, { name: "Length", dataType: "DINT" }],
    outputs: [{ name: "Dest", dataType: "DINT" }]
  },
  MVM: {
    inputs: [{ name: "Source", dataType: "DWORD" }, { name: "Mask", dataType: "DWORD" }],
    outputs: [{ name: "Dest", dataType: "DWORD" }]
  },
  BTD: {
    inputs: [
      { name: "Source", dataType: "DWORD" },
      { name: "SourceBit", dataType: "DINT" },
      { name: "DestBit", dataType: "DINT" },
      { name: "Length", dataType: "DINT" }
    ],
    outputs: [{ name: "Dest", dataType: "DWORD" }]
  },
  SWPB: {
    inputs: [{ name: "Source", dataType: "DWORD" }, { name: "Order", dataType: "DINT" }],
    outputs: [{ name: "Dest", dataType: "DWORD" }]
  },
  FLL: {
    inputs: [{ name: "Source", dataType: "DINT" }, { name: "Length", dataType: "DINT" }],
    outputs: [{ name: "Dest", dataType: "DINT" }]
  },
  SIZE: {
    inputs: [{ name: "Source", dataType: "DINT" }, { name: "Dim", dataType: "DINT" }],
    outputs: [{ name: "Dest", dataType: "DINT" }]
  },
  CPT: {
    inputs: [{ name: "Expression", dataType: "STRING" }],
    outputs: [{ name: "Dest", dataType: "DINT" }]
  },
  CMP: {
    inputs: [{ name: "Expression", dataType: "STRING" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  // Rockwell FIFO/LIFO
  FFL: {
    inputs: [{ name: "Source", dataType: "DINT" }, { name: "FIFO", dataType: "DINT" }, { name: "Length", dataType: "DINT" }, { name: "Position", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  FFU: {
    inputs: [{ name: "FIFO", dataType: "DINT" }, { name: "Dest", dataType: "DINT" }, { name: "Length", dataType: "DINT" }, { name: "Position", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  LFL: {
    inputs: [{ name: "Source", dataType: "DINT" }, { name: "Stack", dataType: "DINT" }, { name: "Length", dataType: "DINT" }, { name: "Position", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  LFU: {
    inputs: [{ name: "Stack", dataType: "DINT" }, { name: "Dest", dataType: "DINT" }, { name: "Length", dataType: "DINT" }, { name: "Position", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  // Rockwell sequencer
  SQO: {
    inputs: [{ name: "Array", dataType: "DWORD" }, { name: "Mask", dataType: "DWORD" }, { name: "Dest", dataType: "DWORD" }, { name: "Length", dataType: "DINT" }, { name: "Position", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  SQI: {
    inputs: [{ name: "Array", dataType: "DWORD" }, { name: "Mask", dataType: "DWORD" }, { name: "Source", dataType: "DWORD" }, { name: "Length", dataType: "DINT" }, { name: "Position", dataType: "DINT" }],
    outputs: [{ name: "Found", dataType: "BOOL" }]
  },
  SQL: {
    inputs: [{ name: "Array", dataType: "DWORD" }, { name: "Length", dataType: "DINT" }, { name: "Position", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  // Rockwell PID
  PID: {
    inputs: [
      { name: "PID", dataType: "STRUCT" },
      { name: "Process", dataType: "REAL" },
      { name: "Tieback", dataType: "REAL" },
      { name: "Control", dataType: "REAL" }
    ],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  // Rockwell string instructions
  CONCAT: {
    inputs: [{ name: "Source1", dataType: "STRING" }, { name: "Source2", dataType: "STRING" }],
    outputs: [{ name: "Dest", dataType: "STRING" }]
  },
  MID: {
    inputs: [{ name: "Source", dataType: "STRING" }, { name: "Qty", dataType: "DINT" }, { name: "Start", dataType: "DINT" }],
    outputs: [{ name: "Dest", dataType: "STRING" }]
  },
  FIND: {
    inputs: [{ name: "Source", dataType: "STRING" }, { name: "Search", dataType: "STRING" }],
    outputs: [{ name: "Result", dataType: "DINT" }]
  },
  INSERT: {
    inputs: [{ name: "Source", dataType: "STRING" }, { name: "Insert", dataType: "STRING" }, { name: "Start", dataType: "DINT" }],
    outputs: [{ name: "Dest", dataType: "STRING" }]
  },
  DELETE: {
    inputs: [{ name: "Source", dataType: "STRING" }, { name: "Qty", dataType: "DINT" }, { name: "Start", dataType: "DINT" }],
    outputs: [{ name: "Dest", dataType: "STRING" }]
  },
  LEN: {
    inputs: [{ name: "Source", dataType: "STRING" }],
    outputs: [{ name: "Dest", dataType: "DINT" }]
  },
  UPPER_CASE: {
    inputs: [{ name: "IN", dataType: "STRING" }],
    outputs: [{ name: "OUT", dataType: "STRING" }]
  },
  LOWER_CASE: {
    inputs: [{ name: "IN", dataType: "STRING" }],
    outputs: [{ name: "OUT", dataType: "STRING" }]
  },
  CONCAT_DATE_TOD: {
    inputs: [{ name: "IN1", dataType: "DATE" }, { name: "IN2", dataType: "TOD" }],
    outputs: [{ name: "OUT", dataType: "DT" }]
  },
  // Rockwell message / motion (preserve as blocks with minimal typed pins)
  MSG: {
    inputs: [{ name: "Message", dataType: "STRUCT" }],
    outputs: [{ name: "DN", dataType: "BOOL" }]
  },
  MAJ: {
    inputs: [{ name: "Axis", dataType: "STRUCT" }],
    outputs: [{ name: "Done", dataType: "BOOL" }]
  },
  MAM: {
    inputs: [{ name: "Axis", dataType: "STRUCT" }, { name: "MotionControl", dataType: "STRUCT" }],
    outputs: [{ name: "Done", dataType: "BOOL" }]
  },
  MAS: {
    inputs: [{ name: "Axis", dataType: "STRUCT" }, { name: "MotionControl", dataType: "STRUCT" }],
    outputs: [{ name: "Done", dataType: "BOOL" }]
  },
  GSV: {
    inputs: [{ name: "Object", dataType: "STRING" }, { name: "Attribute", dataType: "STRING" }],
    outputs: [{ name: "Dest", dataType: "DINT" }]
  },
  SSV: {
    inputs: [{ name: "Object", dataType: "STRING" }, { name: "Attribute", dataType: "STRING" }, { name: "Source", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  // Rockwell LIM (limit test) — range check
  LIM: {
    inputs: [{ name: "LowLimit", dataType: "DINT" }, { name: "Test", dataType: "DINT" }, { name: "HighLimit", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  MEQ: {
    inputs: [{ name: "Source", dataType: "DWORD" }, { name: "Mask", dataType: "DWORD" }, { name: "Compare", dataType: "DWORD" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  // Siemens-specific (IEC library equivalents)
  BLINK: {
    inputs: [{ name: "ENABLE", dataType: "BOOL" }, { name: "TIME_HIGH", dataType: "TIME" }, { name: "TIME_LOW", dataType: "TIME" }],
    outputs: [{ name: "OUT", dataType: "BOOL" }]
  },
  TONR: {
    inputs: [{ name: "IN", dataType: "BOOL" }, { name: "R", dataType: "BOOL" }, { name: "PT", dataType: "TIME" }],
    outputs: [{ name: "Q", dataType: "BOOL" }, { name: "ET", dataType: "TIME" }]
  },
  IEC_TIMER: {
    inputs: [{ name: "IN", dataType: "BOOL" }, { name: "PT", dataType: "TIME" }],
    outputs: [{ name: "Q", dataType: "BOOL" }, { name: "ET", dataType: "TIME" }]
  },
  IEC_LTIMER: {
    inputs: [{ name: "IN", dataType: "BOOL" }, { name: "PT", dataType: "TIME" }],
    outputs: [{ name: "Q", dataType: "BOOL" }, { name: "ET", dataType: "TIME" }]
  },
  IEC_COUNTER: {
    inputs: [{ name: "CU", dataType: "BOOL" }, { name: "R", dataType: "BOOL" }, { name: "PV", dataType: "INT" }],
    outputs: [{ name: "QU", dataType: "BOOL" }, { name: "CV", dataType: "INT" }]
  },
  IEC_LCOUNTER: {
    inputs: [{ name: "CU", dataType: "BOOL" }, { name: "R", dataType: "BOOL" }, { name: "PV", dataType: "INT" }],
    outputs: [{ name: "QU", dataType: "BOOL" }, { name: "CV", dataType: "INT" }]
  },
  // Siemens scaling (analog I/O)
  SCALE: {
    inputs: [{ name: "IN", dataType: "INT" }, { name: "HI_LIM", dataType: "REAL" }, { name: "LO_LIM", dataType: "REAL" }, { name: "BIPOLAR", dataType: "BOOL" }],
    outputs: [{ name: "OUT", dataType: "REAL" }, { name: "RET_VAL", dataType: "INT" }]
  },
  UNSCALE: {
    inputs: [{ name: "IN", dataType: "REAL" }, { name: "HI_LIM", dataType: "REAL" }, { name: "LO_LIM", dataType: "REAL" }, { name: "BIPOLAR", dataType: "BOOL" }],
    outputs: [{ name: "OUT", dataType: "INT" }, { name: "RET_VAL", dataType: "INT" }]
  },
  NORM_X: {
    inputs: [{ name: "MIN", dataType: "REAL" }, { name: "VALUE", dataType: "REAL" }, { name: "MAX", dataType: "REAL" }],
    outputs: [{ name: "OUT", dataType: "REAL" }]
  },
  SCALE_X: {
    inputs: [{ name: "MIN", dataType: "REAL" }, { name: "VALUE", dataType: "REAL" }, { name: "MAX", dataType: "REAL" }],
    outputs: [{ name: "OUT", dataType: "REAL" }]
  },
  // Siemens string functions
  S_LEN: { inputs: [{ name: "S", dataType: "STRING" }], outputs: [{ name: "RET_VAL", dataType: "INT" }] },
  S_LEFT: { inputs: [{ name: "L", dataType: "STRING" }, { name: "N", dataType: "INT" }], outputs: [{ name: "RET_VAL", dataType: "STRING" }] },
  S_RIGHT: { inputs: [{ name: "L", dataType: "STRING" }, { name: "N", dataType: "INT" }], outputs: [{ name: "RET_VAL", dataType: "STRING" }] },
  S_MID: { inputs: [{ name: "L", dataType: "STRING" }, { name: "N", dataType: "INT" }, { name: "P", dataType: "INT" }], outputs: [{ name: "RET_VAL", dataType: "STRING" }] },
  S_FIND: { inputs: [{ name: "IN1", dataType: "STRING" }, { name: "IN2", dataType: "STRING" }], outputs: [{ name: "RET_VAL", dataType: "INT" }] },
  S_CONV: { inputs: [{ name: "IN", dataType: "DINT" }], outputs: [{ name: "OUT", dataType: "STRING" }] },
  S_CONCAT: { inputs: [{ name: "IN1", dataType: "STRING" }, { name: "IN2", dataType: "STRING" }], outputs: [{ name: "OUT", dataType: "STRING" }] },
  // Siemens type conversions
  CONVERT: {
    inputs: [{ name: "IN", dataType: "DINT" }],
    outputs: [{ name: "OUT", dataType: "DINT" }]
  },
  ROUND: {
    inputs: [{ name: "IN", dataType: "REAL" }],
    outputs: [{ name: "OUT", dataType: "DINT" }]
  },
  TRUNC: {
    inputs: [{ name: "IN", dataType: "REAL" }],
    outputs: [{ name: "OUT", dataType: "DINT" }]
  },
  CEIL: {
    inputs: [{ name: "IN", dataType: "REAL" }],
    outputs: [{ name: "OUT", dataType: "REAL" }]
  },
  FLOOR: {
    inputs: [{ name: "IN", dataType: "REAL" }],
    outputs: [{ name: "OUT", dataType: "REAL" }]
  },
  // Siemens communication / data exchange FBs (minimal typed pins)
  SEND: {
    inputs: [{ name: "REQ", dataType: "BOOL" }, { name: "ID", dataType: "WORD" }, { name: "SD_1", dataType: "STRUCT" }],
    outputs: [{ name: "DONE", dataType: "BOOL" }, { name: "ERROR", dataType: "BOOL" }, { name: "STATUS", dataType: "WORD" }]
  },
  RECV: {
    inputs: [{ name: "EN_R", dataType: "BOOL" }, { name: "ID", dataType: "WORD" }, { name: "RD_1", dataType: "STRUCT" }],
    outputs: [{ name: "NDR", dataType: "BOOL" }, { name: "ERROR", dataType: "BOOL" }, { name: "STATUS", dataType: "WORD" }]
  },
  RDREC: {
    inputs: [{ name: "REQ", dataType: "BOOL" }, { name: "ID", dataType: "WORD" }, { name: "INDEX", dataType: "DINT" }, { name: "MLEN", dataType: "DINT" }],
    outputs: [{ name: "VALID", dataType: "BOOL" }, { name: "BUSY", dataType: "BOOL" }, { name: "ERROR", dataType: "BOOL" }, { name: "LEN", dataType: "DINT" }]
  },
  WRREC: {
    inputs: [{ name: "REQ", dataType: "BOOL" }, { name: "ID", dataType: "WORD" }, { name: "INDEX", dataType: "DINT" }, { name: "LEN", dataType: "DINT" }],
    outputs: [{ name: "DONE", dataType: "BOOL" }, { name: "BUSY", dataType: "BOOL" }, { name: "ERROR", dataType: "BOOL" }]
  },
  // Standard IEC data conversions (used across all vendors)
  INT_TO_REAL: { inputs: [{ name: "IN", dataType: "INT" }], outputs: [{ name: "OUT", dataType: "REAL" }] },
  REAL_TO_INT: { inputs: [{ name: "IN", dataType: "REAL" }], outputs: [{ name: "OUT", dataType: "INT" }] },
  DINT_TO_REAL: { inputs: [{ name: "IN", dataType: "DINT" }], outputs: [{ name: "OUT", dataType: "REAL" }] },
  REAL_TO_DINT: { inputs: [{ name: "IN", dataType: "REAL" }], outputs: [{ name: "OUT", dataType: "DINT" }] },
  INT_TO_DINT: { inputs: [{ name: "IN", dataType: "INT" }], outputs: [{ name: "OUT", dataType: "DINT" }] },
  BOOL_TO_INT: { inputs: [{ name: "IN", dataType: "BOOL" }], outputs: [{ name: "OUT", dataType: "INT" }] },
  INT_TO_BOOL: { inputs: [{ name: "IN", dataType: "INT" }], outputs: [{ name: "OUT", dataType: "BOOL" }] },
  WORD_TO_INT: { inputs: [{ name: "IN", dataType: "WORD" }], outputs: [{ name: "OUT", dataType: "INT" }] },
  INT_TO_WORD: { inputs: [{ name: "IN", dataType: "INT" }], outputs: [{ name: "OUT", dataType: "WORD" }] },
  DWORD_TO_DINT: { inputs: [{ name: "IN", dataType: "DWORD" }], outputs: [{ name: "OUT", dataType: "DINT" }] },
  DINT_TO_DWORD: { inputs: [{ name: "IN", dataType: "DINT" }], outputs: [{ name: "OUT", dataType: "DWORD" }] },
  TIME_TO_DINT: { inputs: [{ name: "IN", dataType: "TIME" }], outputs: [{ name: "OUT", dataType: "DINT" }] },
  DINT_TO_TIME: { inputs: [{ name: "IN", dataType: "DINT" }], outputs: [{ name: "OUT", dataType: "TIME" }] }
};
function getBlockSignature(blockType) {
  return SIG[blockType.toUpperCase()] ?? SIG[blockType] ?? null;
}
function getPinDataType(blockType, pinName, direction) {
  const sig = getBlockSignature(blockType);
  if (!sig) return "BOOL";
  const list = direction === "input" ? sig.inputs : sig.outputs;
  return list.find((p) => p.name === pinName)?.dataType ?? list[0]?.dataType ?? "BOOL";
}
function buildTypedPins(blockType, connectedPinNames, idPrefix) {
  const sig = getBlockSignature(blockType);
  if (!sig) {
    const pins = connectedPinNames.map((n, i) => ({ id: `${idPrefix}-pin-${i}`, name: n, dataType: "BOOL" }));
    return { inputs: pins, outputs: [] };
  }
  const inputs = sig.inputs.map((pd, i) => ({
    id: `${idPrefix}-in-${pd.name}-${i}`,
    name: pd.name,
    dataType: pd.dataType
  }));
  const outputs = sig.outputs.map((pd, i) => ({
    id: `${idPrefix}-out-${pd.name}-${i}`,
    name: pd.name,
    dataType: pd.dataType
  }));
  return { inputs, outputs };
}
function buildTypedTagRefPins(blockType, resolvedValues) {
  const sig = getBlockSignature(blockType);
  if (!sig) {
    return Object.fromEntries(
      Object.entries(resolvedValues).map(([k, v]) => [k, { name: v, dataType: "BOOL" }])
    );
  }
  const result = {};
  for (const pd of [...sig.inputs, ...sig.outputs]) {
    result[pd.name] = {
      name: resolvedValues[pd.name] ?? "",
      dataType: pd.dataType
    };
  }
  for (const [k, v] of Object.entries(resolvedValues)) {
    if (!(k in result)) {
      result[k] = { name: v, dataType: "BOOL" };
    }
  }
  return result;
}
export {
  buildTypedPins,
  buildTypedTagRefPins,
  getBlockSignature,
  getPinDataType
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjL3BsYy1lZGl0b3ItdHN4L3ZlbmRvci9waW5TaWduYXR1cmVzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKlxuICogQ2Fub25pY2FsIHBpbiBzaWduYXR1cmUgdGFibGUgZm9yIGFsbCBJRUMgNjExMzEtMyBzdGFuZGFyZCBmdW5jdGlvbiBibG9ja3MuXG4gKlxuICogVGhpcyBpcyB0aGUgc2luZ2xlIHNvdXJjZSBvZiB0cnV0aCBmb3IgcGluIG5hbWVzIGFuZCB0aGVpciBJRUNEYXRhVHlwZS5cbiAqIEV2ZXJ5IGFkYXB0ZXIgdXNlcyB0aGlzIGluc3RlYWQgb2YgaGFyZGNvZGluZyAnQk9PTCcgZXZlcnl3aGVyZS5cbiAqXG4gKiBTdHJ1Y3R1cmUgcGVyIGVudHJ5OlxuICogICBpbnB1dHM6ICB7IHBpbk5hbWU6IElFQ0RhdGFUeXBlIH1bXSAgIFx1MjAxNCBvcmRlcmVkIGxpc3QsIG1hdGNoZXMgSUVDIDYxMTMxLTMgc3RhbmRhcmRcbiAqICAgb3V0cHV0czogeyBwaW5OYW1lOiBJRUNEYXRhVHlwZSB9W11cbiAqXG4gKiBGb3IgYmxvY2tzIHdob3NlIG9wZXJhbmQgZGF0YSB0eXBlIGlzIHBvbHltb3JwaGljIChBREQsIFNVQiwgTU9WRSwgY29tcGFyaXNvbnMsIGV0Yy4pXG4gKiB0aGUgY2Fub25pY2FsIHR5cGUgaXMgJ0RJTlQnIGFzIHRoZSBkZWZhdWx0IG51bWVyaWMgdHlwZS4gQ2FsbGVycyB0aGF0IGhhdmUgY29uY3JldGVcbiAqIHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBzaG91bGQgb3ZlcnJpZGUgdXNpbmcgcmVzb2x2ZVRhZ1R5cGUoKSBmcm9tIHZhcmlhYmxlVHlwZVJlc29sdmVyLlxuICovXG5cbmltcG9ydCB0eXBlIHsgSUVDRGF0YVR5cGUgfSBmcm9tICcuLi9sb2dpY1N0b3JlLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBQaW5EZWYge1xuICBuYW1lOiBzdHJpbmc7XG4gIGRhdGFUeXBlOiBJRUNEYXRhVHlwZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCbG9ja1NpZ25hdHVyZSB7XG4gIGlucHV0czogUGluRGVmW107XG4gIG91dHB1dHM6IFBpbkRlZltdO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgU3RhbmRhcmQgSUVDIDYxMTMxLTMgRnVuY3Rpb24gQmxvY2sgU2lnbmF0dXJlcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY29uc3QgU0lHOiBSZWNvcmQ8c3RyaW5nLCBCbG9ja1NpZ25hdHVyZT4gPSB7XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFRpbWVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgVE9OOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdQVCcsIGRhdGFUeXBlOiAnVElNRScgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ1EnLCAgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdFVCcsIGRhdGFUeXBlOiAnVElNRScgfV0sXG4gIH0sXG4gIFRPRjoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnUFQnLCBkYXRhVHlwZTogJ1RJTUUnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdRJywgIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnRVQnLCBkYXRhVHlwZTogJ1RJTUUnIH1dLFxuICB9LFxuICBUUDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnUFQnLCBkYXRhVHlwZTogJ1RJTUUnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdRJywgIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnRVQnLCBkYXRhVHlwZTogJ1RJTUUnIH1dLFxuICB9LFxuICAvLyBSb2Nrd2VsbCByZXRlbnRpdmUgdGltZXIgXHUyMDE0IHNhbWUgaW50ZXJmYWNlIGFzIFRPTlxuICBSVE86IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ1BUJywgZGF0YVR5cGU6ICdUSU1FJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnUScsICBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0VUJywgZGF0YVR5cGU6ICdUSU1FJyB9XSxcbiAgfSxcblxuICAvLyBcdTI1MDBcdTI1MDAgQ291bnRlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIENUVToge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdDVScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnUicsICBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ1BWJywgZGF0YVR5cGU6ICdJTlQnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdRVScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnQ1YnLCBkYXRhVHlwZTogJ0lOVCcgfV0sXG4gIH0sXG4gIENURDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdDRCcsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnTEQnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ1BWJywgZGF0YVR5cGU6ICdJTlQnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdRRCcsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnQ1YnLCBkYXRhVHlwZTogJ0lOVCcgfV0sXG4gIH0sXG4gIENUVUQ6IHtcbiAgICBpbnB1dHM6ICBbXG4gICAgICB7IG5hbWU6ICdDVScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnQ0QnLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICB7IG5hbWU6ICdSJywgIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnTEQnLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICB7IG5hbWU6ICdQVicsIGRhdGFUeXBlOiAnSU5UJyB9LFxuICAgIF0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ1FVJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdRRCcsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnQ1YnLCBkYXRhVHlwZTogJ0lOVCcgfV0sXG4gIH0sXG5cbiAgLy8gXHUyNTAwXHUyNTAwIEJpc3RhYmxlIGxhdGNoZXMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIFNSOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1MxJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdSJywgIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ1ExJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcbiAgUlM6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnUycsICBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ1IxJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnUTEnLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICB9LFxuXG4gIC8vIFx1MjUwMFx1MjUwMCBFZGdlIGRldGVjdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgUlRSSUc6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnQ0xLJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnUScsICAgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcbiAgRlRSSUc6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnQ0xLJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnUScsICAgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcbiAgLy8gQWxpYXMgbmFtZXMgdXNlZCBieSBzb21lIHZlbmRvcnNcbiAgUl9UUklHOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0NMSycsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ1EnLCAgIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG4gIEZfVFJJRzoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdDTEsnLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdRJywgICBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICB9LFxuXG4gIC8vIFx1MjUwMFx1MjUwMCBCb29sZWFuIGdhdGVzIChGQkQpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBBTkQ6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4xJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdJTjInLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICB9LFxuICBPUjoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG4gIFhPUjoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG4gIE5PVDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTicsICBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICB9LFxuICBOQU5EOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOMScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnSU4yJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcbiAgTk9SOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOMScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnSU4yJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcblxuICAvLyBcdTI1MDBcdTI1MDAgQXJpdGhtZXRpYyAocG9seW1vcnBoaWMgXHUyMDE0IGNhbm9uaWNhbCBkZWZhdWx0OiBESU5UKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgQUREOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOMScsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnSU4yJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgfSxcbiAgU1VCOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOMScsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnSU4yJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgfSxcbiAgTVVMOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOMScsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnSU4yJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgfSxcbiAgRElWOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOMScsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnSU4yJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgfSxcbiAgTU9EOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOMScsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnSU4yJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgfSxcbiAgQUJTOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gIH0sXG4gIFNRUlQ6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCAgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgfSxcbiAgTkVHOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gIH0sXG5cbiAgLy8gXHUyNTAwXHUyNTAwIE1hdGggKGFsd2F5cyBSRUFMKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgTE46IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCAgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgfSxcbiAgTE9HOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gIH0sXG4gIEVYUDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTicsICBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICB9LFxuICBTSU46IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCAgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgfSxcbiAgQ09TOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gIH0sXG4gIFRBTjoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTicsICBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICB9LFxuICBBU0lOOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gIH0sXG4gIEFDT1M6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCAgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgfSxcbiAgQVRBTjoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTicsICBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICB9LFxuICAvLyBSb2Nrd2VsbCBhbGlhc2VzXG4gIEFUTjogIHsgaW5wdXRzOiBbeyBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ1JFQUwnIH1dLCBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdSRUFMJyB9XSB9LFxuICBBU046ICB7IGlucHV0czogW3sgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdSRUFMJyB9XSwgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnUkVBTCcgfV0gfSxcbiAgQUNTOiAgeyBpbnB1dHM6IFt7IG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnUkVBTCcgfV0sIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ1JFQUwnIH1dIH0sXG4gIFNRUjogIHsgaW5wdXRzOiBbeyBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ1JFQUwnIH1dLCBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdSRUFMJyB9XSB9LFxuICBYUFk6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnU291cmNlJywgZGF0YVR5cGU6ICdSRUFMJyB9LCB7IG5hbWU6ICdFeHBvbmVudCcsIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ0Rlc3QnLCAgIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gIH0sXG5cbiAgLy8gXHUyNTAwXHUyNTAwIENvbXBhcmlzb24gKG91dHB1dCBpcyBCT09MLCBpbnB1dHMgYXJlIHBvbHltb3JwaGljIG51bWVyaWMgXHUyMDE0IGRlZmF1bHQgRElOVCkgXHUyNTAwXHUyNTAwXG4gIEdUOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOMScsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnSU4yJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcbiAgR0U6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4xJywgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdJTjInLCBkYXRhVHlwZTogJ0RJTlQnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICB9LFxuICBMVDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG4gIExFOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOMScsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnSU4yJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcbiAgRVE6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4xJywgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdJTjInLCBkYXRhVHlwZTogJ0RJTlQnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICB9LFxuICBORToge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG5cbiAgLy8gXHUyNTAwXHUyNTAwIERhdGEvc2VsZWN0aW9uIChwb2x5bW9ycGhpYyBcdTIwMTQgZGVmYXVsdCBESU5UKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgTU9WRToge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTicsICBkYXRhVHlwZTogJ0RJTlQnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0RJTlQnIH1dLFxuICB9LFxuICBTRUw6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnRycsICAgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdJTjAnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0lOMScsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gIH0sXG4gIE1VWDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdLJywgICBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0lOMCcsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnSU4xJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgfSxcbiAgTElNSVQ6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnTU4nLCAgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdJTicsICBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ01YJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgfSxcbiAgTUlOOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOMScsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnSU4yJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgfSxcbiAgTUFYOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOMScsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnSU4yJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgfSxcblxuICAvLyBcdTI1MDBcdTI1MDAgUm9ja3dlbGwtc3BlY2lmaWMgaW5zdHJ1Y3Rpb24gYmxvY2tzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBNT1Y6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnU291cmNlJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnRGVzdCcsICAgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgfSxcbiAgQ09QOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1NvdXJjZScsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnTGVuZ3RoJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnRGVzdCcsICAgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgfSxcbiAgTVZNOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1NvdXJjZScsIGRhdGFUeXBlOiAnRFdPUkQnIH0sIHsgbmFtZTogJ01hc2snLCBkYXRhVHlwZTogJ0RXT1JEJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnRGVzdCcsICAgZGF0YVR5cGU6ICdEV09SRCcgfV0sXG4gIH0sXG4gIEJURDoge1xuICAgIGlucHV0czogIFtcbiAgICAgIHsgbmFtZTogJ1NvdXJjZScsICAgICBkYXRhVHlwZTogJ0RXT1JEJyB9LCB7IG5hbWU6ICdTb3VyY2VCaXQnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICB7IG5hbWU6ICdEZXN0Qml0JywgICAgZGF0YVR5cGU6ICdESU5UJyAgfSwgeyBuYW1lOiAnTGVuZ3RoJywgICAgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgIF0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ0Rlc3QnLCBkYXRhVHlwZTogJ0RXT1JEJyB9XSxcbiAgfSxcbiAgU1dQQjoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdTb3VyY2UnLCBkYXRhVHlwZTogJ0RXT1JEJyB9LCB7IG5hbWU6ICdPcmRlcicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ0Rlc3QnLCAgIGRhdGFUeXBlOiAnRFdPUkQnIH1dLFxuICB9LFxuICBGTEw6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnU291cmNlJywgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdMZW5ndGgnLCBkYXRhVHlwZTogJ0RJTlQnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdEZXN0JywgICBkYXRhVHlwZTogJ0RJTlQnIH1dLFxuICB9LFxuICBTSVpFOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1NvdXJjZScsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnRGltJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnRGVzdCcsICAgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgfSxcbiAgQ1BUOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0V4cHJlc3Npb24nLCBkYXRhVHlwZTogJ1NUUklORycgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ0Rlc3QnLCAgICAgICBkYXRhVHlwZTogJ0RJTlQnICAgfV0sXG4gIH0sXG4gIENNUDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdFeHByZXNzaW9uJywgZGF0YVR5cGU6ICdTVFJJTkcnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCAgICAgICAgZGF0YVR5cGU6ICdCT09MJyAgIH1dLFxuICB9LFxuXG4gIC8vIFJvY2t3ZWxsIEZJRk8vTElGT1xuICBGRkw6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnU291cmNlJywgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdGSUZPJywgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdMZW5ndGgnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ1Bvc2l0aW9uJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgICAgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcbiAgRkZVOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0ZJRk8nLCAgIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnRGVzdCcsICAgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdMZW5ndGgnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ1Bvc2l0aW9uJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgICAgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcbiAgTEZMOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1NvdXJjZScsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnU3RhY2snLCAgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdMZW5ndGgnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ1Bvc2l0aW9uJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgICAgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcbiAgTEZVOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1N0YWNrJywgIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnRGVzdCcsICAgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdMZW5ndGgnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ1Bvc2l0aW9uJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgICAgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcblxuICAvLyBSb2Nrd2VsbCBzZXF1ZW5jZXJcbiAgU1FPOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0FycmF5JywgIGRhdGFUeXBlOiAnRFdPUkQnIH0sIHsgbmFtZTogJ01hc2snLCBkYXRhVHlwZTogJ0RXT1JEJyB9LCB7IG5hbWU6ICdEZXN0JywgICBkYXRhVHlwZTogJ0RXT1JEJyB9LCB7IG5hbWU6ICdMZW5ndGgnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ1Bvc2l0aW9uJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgICAgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcbiAgU1FJOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0FycmF5JywgIGRhdGFUeXBlOiAnRFdPUkQnIH0sIHsgbmFtZTogJ01hc2snLCBkYXRhVHlwZTogJ0RXT1JEJyB9LCB7IG5hbWU6ICdTb3VyY2UnLCBkYXRhVHlwZTogJ0RXT1JEJyB9LCB7IG5hbWU6ICdMZW5ndGgnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ1Bvc2l0aW9uJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnRm91bmQnLCAgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcbiAgU1FMOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0FycmF5JywgIGRhdGFUeXBlOiAnRFdPUkQnIH0sIHsgbmFtZTogJ0xlbmd0aCcsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnUG9zaXRpb24nLCBkYXRhVHlwZTogJ0RJTlQnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCAgICBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICB9LFxuXG4gIC8vIFJvY2t3ZWxsIFBJRFxuICBQSUQ6IHtcbiAgICBpbnB1dHM6ICBbXG4gICAgICB7IG5hbWU6ICdQSUQnLCAgICAgIGRhdGFUeXBlOiAnU1RSVUNUJyB9LCB7IG5hbWU6ICdQcm9jZXNzJywgIGRhdGFUeXBlOiAnUkVBTCcgfSxcbiAgICAgIHsgbmFtZTogJ1RpZWJhY2snLCAgZGF0YVR5cGU6ICdSRUFMJyAgIH0sIHsgbmFtZTogJ0NvbnRyb2wnLCAgZGF0YVR5cGU6ICdSRUFMJyB9LFxuICAgIF0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsICAgIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG5cbiAgLy8gUm9ja3dlbGwgc3RyaW5nIGluc3RydWN0aW9uc1xuICBDT05DQVQ6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnU291cmNlMScsIGRhdGFUeXBlOiAnU1RSSU5HJyB9LCB7IG5hbWU6ICdTb3VyY2UyJywgZGF0YVR5cGU6ICdTVFJJTkcnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdEZXN0JywgICAgZGF0YVR5cGU6ICdTVFJJTkcnIH1dLFxuICB9LFxuICBNSUQ6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnU291cmNlJywgZGF0YVR5cGU6ICdTVFJJTkcnIH0sIHsgbmFtZTogJ1F0eScsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnU3RhcnQnLCBkYXRhVHlwZTogJ0RJTlQnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdEZXN0JywgICBkYXRhVHlwZTogJ1NUUklORycgfV0sXG4gIH0sXG4gIEZJTkQ6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnU291cmNlJywgZGF0YVR5cGU6ICdTVFJJTkcnIH0sIHsgbmFtZTogJ1NlYXJjaCcsIGRhdGFUeXBlOiAnU1RSSU5HJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnUmVzdWx0JywgZGF0YVR5cGU6ICdESU5UJyAgIH1dLFxuICB9LFxuICBJTlNFUlQ6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnU291cmNlJywgZGF0YVR5cGU6ICdTVFJJTkcnIH0sIHsgbmFtZTogJ0luc2VydCcsIGRhdGFUeXBlOiAnU1RSSU5HJyB9LCB7IG5hbWU6ICdTdGFydCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ0Rlc3QnLCAgIGRhdGFUeXBlOiAnU1RSSU5HJyB9XSxcbiAgfSxcbiAgREVMRVRFOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1NvdXJjZScsIGRhdGFUeXBlOiAnU1RSSU5HJyB9LCB7IG5hbWU6ICdRdHknLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ1N0YXJ0JywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnRGVzdCcsICAgZGF0YVR5cGU6ICdTVFJJTkcnIH1dLFxuICB9LFxuICBMRU46IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnU291cmNlJywgZGF0YVR5cGU6ICdTVFJJTkcnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdEZXN0JywgICBkYXRhVHlwZTogJ0RJTlQnICAgfV0sXG4gIH0sXG4gIFVQUEVSX0NBU0U6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCAgZGF0YVR5cGU6ICdTVFJJTkcnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ1NUUklORycgfV0sXG4gIH0sXG4gIExPV0VSX0NBU0U6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCAgZGF0YVR5cGU6ICdTVFJJTkcnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ1NUUklORycgfV0sXG4gIH0sXG4gIENPTkNBVF9EQVRFX1RPRDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ0RBVEUnIH0sIHsgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnVE9EJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdEVCcgICB9XSxcbiAgfSxcblxuICAvLyBSb2Nrd2VsbCBtZXNzYWdlIC8gbW90aW9uIChwcmVzZXJ2ZSBhcyBibG9ja3Mgd2l0aCBtaW5pbWFsIHR5cGVkIHBpbnMpXG4gIE1TRzoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdNZXNzYWdlJywgZGF0YVR5cGU6ICdTVFJVQ1QnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdETicsICAgICAgZGF0YVR5cGU6ICdCT09MJyAgIH1dLFxuICB9LFxuICBNQUo6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnQXhpcycsICAgIGRhdGFUeXBlOiAnU1RSVUNUJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnRG9uZScsICAgIGRhdGFUeXBlOiAnQk9PTCcgICB9XSxcbiAgfSxcbiAgTUFNOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0F4aXMnLCAgICBkYXRhVHlwZTogJ1NUUlVDVCcgfSwgeyBuYW1lOiAnTW90aW9uQ29udHJvbCcsIGRhdGFUeXBlOiAnU1RSVUNUJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnRG9uZScsICAgIGRhdGFUeXBlOiAnQk9PTCcgICB9XSxcbiAgfSxcbiAgTUFTOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0F4aXMnLCAgICBkYXRhVHlwZTogJ1NUUlVDVCcgfSwgeyBuYW1lOiAnTW90aW9uQ29udHJvbCcsIGRhdGFUeXBlOiAnU1RSVUNUJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnRG9uZScsICAgIGRhdGFUeXBlOiAnQk9PTCcgICB9XSxcbiAgfSxcbiAgR1NWOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ09iamVjdCcsICAgIGRhdGFUeXBlOiAnU1RSSU5HJyB9LCB7IG5hbWU6ICdBdHRyaWJ1dGUnLCBkYXRhVHlwZTogJ1NUUklORycgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ0Rlc3QnLCAgICAgIGRhdGFUeXBlOiAnRElOVCcgICB9XSxcbiAgfSxcbiAgU1NWOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ09iamVjdCcsICAgIGRhdGFUeXBlOiAnU1RSSU5HJyB9LCB7IG5hbWU6ICdBdHRyaWJ1dGUnLCBkYXRhVHlwZTogJ1NUUklORycgfSwgeyBuYW1lOiAnU291cmNlJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgICAgICAgZGF0YVR5cGU6ICdCT09MJyAgIH1dLFxuICB9LFxuXG4gIC8vIFJvY2t3ZWxsIExJTSAobGltaXQgdGVzdCkgXHUyMDE0IHJhbmdlIGNoZWNrXG4gIExJTToge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdMb3dMaW1pdCcsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnVGVzdCcsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnSGlnaExpbWl0JywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgICAgICBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICB9LFxuICBNRVE6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnU291cmNlJywgZGF0YVR5cGU6ICdEV09SRCcgfSwgeyBuYW1lOiAnTWFzaycsIGRhdGFUeXBlOiAnRFdPUkQnIH0sIHsgbmFtZTogJ0NvbXBhcmUnLCBkYXRhVHlwZTogJ0RXT1JEJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgICAgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcblxuICAvLyBTaWVtZW5zLXNwZWNpZmljIChJRUMgbGlicmFyeSBlcXVpdmFsZW50cylcbiAgQkxJTks6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnRU5BQkxFJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdUSU1FX0hJR0gnLCBkYXRhVHlwZTogJ1RJTUUnIH0sIHsgbmFtZTogJ1RJTUVfTE9XJywgZGF0YVR5cGU6ICdUSU1FJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgICAgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcbiAgVE9OUjoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnUicsICBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ1BUJywgZGF0YVR5cGU6ICdUSU1FJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnUScsICBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0VUJywgZGF0YVR5cGU6ICdUSU1FJyB9XSxcbiAgfSxcbiAgSUVDX1RJTUVSOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdQVCcsIGRhdGFUeXBlOiAnVElNRScgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ1EnLCAgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdFVCcsIGRhdGFUeXBlOiAnVElNRScgfV0sXG4gIH0sXG4gIElFQ19MVElNRVI6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ1BUJywgZGF0YVR5cGU6ICdUSU1FJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnUScsICBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0VUJywgZGF0YVR5cGU6ICdUSU1FJyB9XSxcbiAgfSxcbiAgSUVDX0NPVU5URVI6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnQ1UnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ1InLCAgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdQVicsIGRhdGFUeXBlOiAnSU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnUVUnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0NWJywgZGF0YVR5cGU6ICdJTlQnIH1dLFxuICB9LFxuICBJRUNfTENPVU5URVI6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnQ1UnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ1InLCAgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdQVicsIGRhdGFUeXBlOiAnSU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnUVUnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0NWJywgZGF0YVR5cGU6ICdJTlQnIH1dLFxuICB9LFxuXG4gIC8vIFNpZW1lbnMgc2NhbGluZyAoYW5hbG9nIEkvTylcbiAgU0NBTEU6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ0lOVCcgfSwgeyBuYW1lOiAnSElfTElNJywgZGF0YVR5cGU6ICdSRUFMJyB9LCB7IG5hbWU6ICdMT19MSU0nLCBkYXRhVHlwZTogJ1JFQUwnIH0sIHsgbmFtZTogJ0JJUE9MQVInLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ1JFQUwnIH0sIHsgbmFtZTogJ1JFVF9WQUwnLCBkYXRhVHlwZTogJ0lOVCcgfV0sXG4gIH0sXG4gIFVOU0NBTEU6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ1JFQUwnIH0sIHsgbmFtZTogJ0hJX0xJTScsIGRhdGFUeXBlOiAnUkVBTCcgfSwgeyBuYW1lOiAnTE9fTElNJywgZGF0YVR5cGU6ICdSRUFMJyB9LCB7IG5hbWU6ICdCSVBPTEFSJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdJTlQnIH0sIHsgbmFtZTogJ1JFVF9WQUwnLCBkYXRhVHlwZTogJ0lOVCcgfV0sXG4gIH0sXG4gIE5PUk1fWDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdNSU4nLCBkYXRhVHlwZTogJ1JFQUwnIH0sIHsgbmFtZTogJ1ZBTFVFJywgZGF0YVR5cGU6ICdSRUFMJyB9LCB7IG5hbWU6ICdNQVgnLCBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICB9LFxuICBTQ0FMRV9YOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ01JTicsIGRhdGFUeXBlOiAnUkVBTCcgfSwgeyBuYW1lOiAnVkFMVUUnLCBkYXRhVHlwZTogJ1JFQUwnIH0sIHsgbmFtZTogJ01BWCcsIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gIH0sXG5cbiAgLy8gU2llbWVucyBzdHJpbmcgZnVuY3Rpb25zXG4gIFNfTEVOOiAgIHsgaW5wdXRzOiBbeyBuYW1lOiAnUycsICAgZGF0YVR5cGU6ICdTVFJJTkcnIH1dLCBvdXRwdXRzOiBbeyBuYW1lOiAnUkVUX1ZBTCcsIGRhdGFUeXBlOiAnSU5UJyB9XSB9LFxuICBTX0xFRlQ6ICB7IGlucHV0czogW3sgbmFtZTogJ0wnLCAgIGRhdGFUeXBlOiAnU1RSSU5HJyB9LCB7IG5hbWU6ICdOJywgZGF0YVR5cGU6ICdJTlQnIH1dLCBvdXRwdXRzOiBbeyBuYW1lOiAnUkVUX1ZBTCcsIGRhdGFUeXBlOiAnU1RSSU5HJyB9XSB9LFxuICBTX1JJR0hUOiB7IGlucHV0czogW3sgbmFtZTogJ0wnLCAgIGRhdGFUeXBlOiAnU1RSSU5HJyB9LCB7IG5hbWU6ICdOJywgZGF0YVR5cGU6ICdJTlQnIH1dLCBvdXRwdXRzOiBbeyBuYW1lOiAnUkVUX1ZBTCcsIGRhdGFUeXBlOiAnU1RSSU5HJyB9XSB9LFxuICBTX01JRDogICB7IGlucHV0czogW3sgbmFtZTogJ0wnLCAgIGRhdGFUeXBlOiAnU1RSSU5HJyB9LCB7IG5hbWU6ICdOJywgZGF0YVR5cGU6ICdJTlQnIH0sIHsgbmFtZTogJ1AnLCBkYXRhVHlwZTogJ0lOVCcgfV0sIG91dHB1dHM6IFt7IG5hbWU6ICdSRVRfVkFMJywgZGF0YVR5cGU6ICdTVFJJTkcnIH1dIH0sXG4gIFNfRklORDogIHsgaW5wdXRzOiBbeyBuYW1lOiAnSU4xJywgZGF0YVR5cGU6ICdTVFJJTkcnIH0sIHsgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnU1RSSU5HJyB9XSwgb3V0cHV0czogW3sgbmFtZTogJ1JFVF9WQUwnLCBkYXRhVHlwZTogJ0lOVCcgfV0gfSxcbiAgU19DT05WOiAgeyBpbnB1dHM6IFt7IG5hbWU6ICdJTicsICBkYXRhVHlwZTogJ0RJTlQnICAgfV0sIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ1NUUklORycgfV0gfSxcbiAgU19DT05DQVQ6eyBpbnB1dHM6IFt7IG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ1NUUklORycgfSwgeyBuYW1lOiAnSU4yJywgZGF0YVR5cGU6ICdTVFJJTkcnIH1dLCBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdTVFJJTkcnIH1dIH0sXG5cbiAgLy8gU2llbWVucyB0eXBlIGNvbnZlcnNpb25zXG4gIENPTlZFUlQ6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCAgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgfSxcbiAgUk9VTkQ6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCAgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgfSxcbiAgVFJVTkM6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCAgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgfSxcbiAgQ0VJTDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTicsICBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICB9LFxuICBGTE9PUjoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTicsICBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICB9LFxuXG4gIC8vIFNpZW1lbnMgY29tbXVuaWNhdGlvbiAvIGRhdGEgZXhjaGFuZ2UgRkJzIChtaW5pbWFsIHR5cGVkIHBpbnMpXG4gIFNFTkQ6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnUkVRJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdJRCcsIGRhdGFUeXBlOiAnV09SRCcgfSwgeyBuYW1lOiAnU0RfMScsIGRhdGFUeXBlOiAnU1RSVUNUJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnRE9ORScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnRVJST1InLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ1NUQVRVUycsIGRhdGFUeXBlOiAnV09SRCcgfV0sXG4gIH0sXG4gIFJFQ1Y6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnRU5fUicsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnSUQnLCBkYXRhVHlwZTogJ1dPUkQnIH0sIHsgbmFtZTogJ1JEXzEnLCBkYXRhVHlwZTogJ1NUUlVDVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ05EUicsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnRVJST1InLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ1NUQVRVUycsIGRhdGFUeXBlOiAnV09SRCcgfV0sXG4gIH0sXG4gIFJEUkVDOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1JFUScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnSUQnLCBkYXRhVHlwZTogJ1dPUkQnIH0sIHsgbmFtZTogJ0lOREVYJywgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdNTEVOJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnVkFMSUQnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0JVU1knLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0VSUk9SJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdMRU4nLCBkYXRhVHlwZTogJ0RJTlQnIH1dLFxuICB9LFxuICBXUlJFQzoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdSRVEnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0lEJywgZGF0YVR5cGU6ICdXT1JEJyB9LCB7IG5hbWU6ICdJTkRFWCcsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnTEVOJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnRE9ORScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnQlVTWScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnRVJST1InLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICB9LFxuXG4gIC8vIFN0YW5kYXJkIElFQyBkYXRhIGNvbnZlcnNpb25zICh1c2VkIGFjcm9zcyBhbGwgdmVuZG9ycylcbiAgSU5UX1RPX1JFQUw6ICB7IGlucHV0czogW3sgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdJTlQnICB9XSwgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnUkVBTCcgIH1dIH0sXG4gIFJFQUxfVE9fSU5UOiAgeyBpbnB1dHM6IFt7IG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnUkVBTCcgfV0sIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0lOVCcgICB9XSB9LFxuICBESU5UX1RPX1JFQUw6IHsgaW5wdXRzOiBbeyBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ0RJTlQnIH1dLCBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdSRUFMJyAgfV0gfSxcbiAgUkVBTF9UT19ESU5UOiB7IGlucHV0czogW3sgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdSRUFMJyB9XSwgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnRElOVCcgIH1dIH0sXG4gIElOVF9UT19ESU5UOiAgeyBpbnB1dHM6IFt7IG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnSU5UJyAgfV0sIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0RJTlQnICB9XSB9LFxuICBCT09MX1RPX0lOVDogIHsgaW5wdXRzOiBbeyBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ0JPT0wnIH1dLCBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdJTlQnICAgfV0gfSxcbiAgSU5UX1RPX0JPT0w6ICB7IGlucHV0czogW3sgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdJTlQnICB9XSwgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcgIH1dIH0sXG4gIFdPUkRfVE9fSU5UOiAgeyBpbnB1dHM6IFt7IG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnV09SRCcgfV0sIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0lOVCcgICB9XSB9LFxuICBJTlRfVE9fV09SRDogIHsgaW5wdXRzOiBbeyBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ0lOVCcgIH1dLCBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdXT1JEJyAgfV0gfSxcbiAgRFdPUkRfVE9fRElOVDp7IGlucHV0czogW3sgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdEV09SRCd9XSwgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnRElOVCcgIH1dIH0sXG4gIERJTlRfVE9fRFdPUkQ6eyBpbnB1dHM6IFt7IG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnRElOVCcgfV0sIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0RXT1JEJyB9XSB9LFxuICBUSU1FX1RPX0RJTlQ6IHsgaW5wdXRzOiBbeyBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ1RJTUUnIH1dLCBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdESU5UJyAgfV0gfSxcbiAgRElOVF9UT19USU1FOiB7IGlucHV0czogW3sgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdESU5UJyB9XSwgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnVElNRScgIH1dIH0sXG59O1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgUHVibGljIEFQSSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBjYW5vbmljYWwgcGluIHNpZ25hdHVyZSBmb3IgYSBibG9jayB0eXBlIG5hbWUuXG4gKiBSZXR1cm5zIG51bGwgaWYgdGhlIGJsb2NrIHR5cGUgaXMgdW5rbm93biAoY2FsbGVyIHNob3VsZCBmYWxsIGJhY2sgdG8gJ0JPT0wnKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEJsb2NrU2lnbmF0dXJlKGJsb2NrVHlwZTogc3RyaW5nKTogQmxvY2tTaWduYXR1cmUgfCBudWxsIHtcbiAgcmV0dXJuIFNJR1tibG9ja1R5cGUudG9VcHBlckNhc2UoKV0gPz8gU0lHW2Jsb2NrVHlwZV0gPz8gbnVsbDtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBJRUNEYXRhVHlwZSBmb3IgYSBuYW1lZCBpbnB1dCBwaW4gb2YgYSBrbm93biBibG9jayB0eXBlLlxuICogRmFsbHMgYmFjayB0byAnQk9PTCcgZm9yIGJvb2xlYW4tY29udGV4dCBibG9ja3MsICdESU5UJyBvdGhlcndpc2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRQaW5EYXRhVHlwZShibG9ja1R5cGU6IHN0cmluZywgcGluTmFtZTogc3RyaW5nLCBkaXJlY3Rpb246ICdpbnB1dCcgfCAnb3V0cHV0Jyk6IElFQ0RhdGFUeXBlIHtcbiAgY29uc3Qgc2lnID0gZ2V0QmxvY2tTaWduYXR1cmUoYmxvY2tUeXBlKTtcbiAgaWYgKCFzaWcpIHJldHVybiAnQk9PTCc7XG4gIGNvbnN0IGxpc3QgPSBkaXJlY3Rpb24gPT09ICdpbnB1dCcgPyBzaWcuaW5wdXRzIDogc2lnLm91dHB1dHM7XG4gIHJldHVybiBsaXN0LmZpbmQocCA9PiBwLm5hbWUgPT09IHBpbk5hbWUpPy5kYXRhVHlwZSA/PyBsaXN0WzBdPy5kYXRhVHlwZSA/PyAnQk9PTCc7XG59XG5cbi8qKlxuICogQnVpbGRzIGEgZnVsbCBzZXQgb2YgdHlwZWQgUGluW10gYXJyYXlzIGZyb20gdGhlIGNhbm9uaWNhbCBzaWduYXR1cmUuXG4gKiBBbnkgcGluIG5hbWVzIHByZXNlbnQgaW4gYGNvbm5lY3RlZFBpbnNgIGFyZSB3aXJlZCB3aXRoIGEgcmVzb2x2ZWQgZGF0YVR5cGVcbiAqICh0aGUgY2Fub25pY2FsIHR5cGUgdGFrZXMgcHJpb3JpdHkgb3ZlciB3aGF0ZXZlciB0aGUgdmVuZG9yIFhNTCBzYWlkKS5cbiAqIE1pc3NpbmcgcGlucyBnZXQgdGhlIGNhbm9uaWNhbCBkZWZhdWx0IHR5cGUgd2l0aCBhbiBlbXB0eSB2YWx1ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkVHlwZWRQaW5zKFxuICBibG9ja1R5cGU6IHN0cmluZyxcbiAgY29ubmVjdGVkUGluTmFtZXM6IHN0cmluZ1tdLFxuICBpZFByZWZpeDogc3RyaW5nLFxuKTogeyBpbnB1dHM6IHsgaWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nOyBkYXRhVHlwZTogSUVDRGF0YVR5cGU7IG5lZ2F0ZWQ/OiBib29sZWFuIH1bXTtcbiAgICBvdXRwdXRzOiB7IGlkOiBzdHJpbmc7IG5hbWU6IHN0cmluZzsgZGF0YVR5cGU6IElFQ0RhdGFUeXBlOyBuZWdhdGVkPzogYm9vbGVhbiB9W10gfSB7XG4gIGNvbnN0IHNpZyA9IGdldEJsb2NrU2lnbmF0dXJlKGJsb2NrVHlwZSk7XG4gIGlmICghc2lnKSB7XG4gICAgLy8gVW5rbm93biBibG9jayB0eXBlIFx1MjAxNCByZXR1cm4gYWxsIGNvbm5lY3RlZCBwaW5zIGFzIEJPT0wgaW5wdXRzL291dHB1dHNcbiAgICBjb25zdCBwaW5zID0gY29ubmVjdGVkUGluTmFtZXMubWFwKChuLCBpKSA9PiAoeyBpZDogYCR7aWRQcmVmaXh9LXBpbi0ke2l9YCwgbmFtZTogbiwgZGF0YVR5cGU6ICdCT09MJyBhcyBJRUNEYXRhVHlwZSB9KSk7XG4gICAgcmV0dXJuIHsgaW5wdXRzOiBwaW5zLCBvdXRwdXRzOiBbXSB9O1xuICB9XG5cbiAgY29uc3QgaW5wdXRzID0gc2lnLmlucHV0cy5tYXAoKHBkLCBpKSA9PiAoe1xuICAgIGlkOiBgJHtpZFByZWZpeH0taW4tJHtwZC5uYW1lfS0ke2l9YCxcbiAgICBuYW1lOiBwZC5uYW1lLFxuICAgIGRhdGFUeXBlOiBwZC5kYXRhVHlwZSxcbiAgfSkpO1xuICBjb25zdCBvdXRwdXRzID0gc2lnLm91dHB1dHMubWFwKChwZCwgaSkgPT4gKHtcbiAgICBpZDogYCR7aWRQcmVmaXh9LW91dC0ke3BkLm5hbWV9LSR7aX1gLFxuICAgIG5hbWU6IHBkLm5hbWUsXG4gICAgZGF0YVR5cGU6IHBkLmRhdGFUeXBlLFxuICB9KSk7XG4gIHJldHVybiB7IGlucHV0cywgb3V0cHV0cyB9O1xufVxuXG4vKipcbiAqIFJldHVybnMgdHlwZWQgVGFnUmVmIHBpbnMgKGZvciBMRCBCbG9ja0VsZW1lbnQucGlucykgZnJvbSB0aGUgY2Fub25pY2FsIHNpZ25hdHVyZS5cbiAqIGByZXNvbHZlZFZhbHVlc2AgbWFwcyBwaW4gbmFtZSBcdTIxOTIgY29ubmVjdGVkIHZhcmlhYmxlIG5hbWUgKGZyb20gdGhlIHZlbmRvciBYTUwpLlxuICogQW55IHBpbiBub3QgcHJlc2VudCBpbiByZXNvbHZlZFZhbHVlcyBrZWVwcyBpdHMgY2Fub25pY2FsIHR5cGUgYnV0IGdldHMgbmFtZSA9ICcnLlxuICovXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRUeXBlZFRhZ1JlZlBpbnMoXG4gIGJsb2NrVHlwZTogc3RyaW5nLFxuICByZXNvbHZlZFZhbHVlczogUmVjb3JkPHN0cmluZywgc3RyaW5nPixcbik6IFJlY29yZDxzdHJpbmcsIHsgbmFtZTogc3RyaW5nOyBkYXRhVHlwZTogSUVDRGF0YVR5cGUgfT4ge1xuICBjb25zdCBzaWcgPSBnZXRCbG9ja1NpZ25hdHVyZShibG9ja1R5cGUpO1xuICBpZiAoIXNpZykge1xuICAgIC8vIFVua25vd24gXHUyMDE0IHBhc3MgdGhyb3VnaCB3aGF0ZXZlciB3YXMgcmVzb2x2ZWQsIGRlZmF1bHQgdG8gQk9PTFxuICAgIHJldHVybiBPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgICBPYmplY3QuZW50cmllcyhyZXNvbHZlZFZhbHVlcykubWFwKChbaywgdl0pID0+IFtrLCB7IG5hbWU6IHYsIGRhdGFUeXBlOiAnQk9PTCcgYXMgSUVDRGF0YVR5cGUgfV0pXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IHJlc3VsdDogUmVjb3JkPHN0cmluZywgeyBuYW1lOiBzdHJpbmc7IGRhdGFUeXBlOiBJRUNEYXRhVHlwZSB9PiA9IHt9O1xuICBmb3IgKGNvbnN0IHBkIG9mIFsuLi5zaWcuaW5wdXRzLCAuLi5zaWcub3V0cHV0c10pIHtcbiAgICByZXN1bHRbcGQubmFtZV0gPSB7XG4gICAgICBuYW1lOiByZXNvbHZlZFZhbHVlc1twZC5uYW1lXSA/PyAnJyxcbiAgICAgIGRhdGFUeXBlOiBwZC5kYXRhVHlwZSxcbiAgICB9O1xuICB9XG4gIC8vIEFsc28gaW5jbHVkZSBhbnkgZXh0cmEgcGlucyBmcm9tIHRoZSB2ZW5kb3IgWE1MIHRoYXQgdGhlIHNpZ25hdHVyZSBkb2Vzbid0IGNvdmVyXG4gIGZvciAoY29uc3QgW2ssIHZdIG9mIE9iamVjdC5lbnRyaWVzKHJlc29sdmVkVmFsdWVzKSkge1xuICAgIGlmICghKGsgaW4gcmVzdWx0KSkge1xuICAgICAgcmVzdWx0W2tdID0geyBuYW1lOiB2LCBkYXRhVHlwZTogJ0JPT0wnIH07XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUE2QkEsTUFBTSxNQUFzQztBQUFBO0FBQUEsRUFHMUMsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDNUUsU0FBUyxDQUFDLEVBQUUsTUFBTSxLQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDOUU7QUFBQSxFQUNBLEtBQUs7QUFBQSxJQUNILFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzVFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sS0FBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzlFO0FBQUEsRUFDQSxJQUFJO0FBQUEsSUFDRixRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUM1RSxTQUFTLENBQUMsRUFBRSxNQUFNLEtBQU0sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM5RTtBQUFBO0FBQUEsRUFFQSxLQUFLO0FBQUEsSUFDSCxRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUM1RSxTQUFTLENBQUMsRUFBRSxNQUFNLEtBQU0sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM5RTtBQUFBO0FBQUEsRUFHQSxLQUFLO0FBQUEsSUFDSCxRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLEtBQU0sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE1BQU0sVUFBVSxNQUFNLENBQUM7QUFBQSxJQUM3RyxTQUFTLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE1BQU0sVUFBVSxNQUFNLENBQUM7QUFBQSxFQUM3RTtBQUFBLEVBQ0EsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsTUFBTSxDQUFDO0FBQUEsSUFDN0csU0FBUyxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsTUFBTSxDQUFDO0FBQUEsRUFDN0U7QUFBQSxFQUNBLE1BQU07QUFBQSxJQUNKLFFBQVM7QUFBQSxNQUNQLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTztBQUFBLE1BQUcsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPO0FBQUEsTUFDakUsRUFBRSxNQUFNLEtBQU0sVUFBVSxPQUFPO0FBQUEsTUFBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU87QUFBQSxNQUNqRSxFQUFFLE1BQU0sTUFBTSxVQUFVLE1BQU07QUFBQSxJQUNoQztBQUFBLElBQ0EsU0FBUyxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsTUFBTSxDQUFDO0FBQUEsRUFDL0c7QUFBQTtBQUFBLEVBR0EsSUFBSTtBQUFBLElBQ0YsUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxLQUFNLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDNUUsU0FBUyxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDNUM7QUFBQSxFQUNBLElBQUk7QUFBQSxJQUNGLFFBQVMsQ0FBQyxFQUFFLE1BQU0sS0FBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzVFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzVDO0FBQUE7QUFBQSxFQUdBLE9BQU87QUFBQSxJQUNMLFFBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzNDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sS0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUMzQyxTQUFTLENBQUMsRUFBRSxNQUFNLEtBQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBO0FBQUEsRUFFQSxRQUFRO0FBQUEsSUFDTixRQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUMzQyxTQUFTLENBQUMsRUFBRSxNQUFNLEtBQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDM0MsU0FBUyxDQUFDLEVBQUUsTUFBTSxLQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQTtBQUFBLEVBR0EsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDOUUsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLElBQUk7QUFBQSxJQUNGLFFBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzlFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxRQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUM5RSxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDM0MsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLE1BQU07QUFBQSxJQUNKLFFBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzlFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxRQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUM5RSxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBO0FBQUEsRUFHQSxLQUFLO0FBQUEsSUFDSCxRQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUM5RSxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDOUUsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLEtBQUs7QUFBQSxJQUNILFFBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzlFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxRQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUM5RSxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDOUUsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLEtBQUs7QUFBQSxJQUNILFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzNDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDSixRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUMzQyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDM0MsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQTtBQUFBLEVBR0EsSUFBSTtBQUFBLElBQ0YsUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDM0MsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLEtBQUs7QUFBQSxJQUNILFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzNDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUMzQyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDM0MsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLEtBQUs7QUFBQSxJQUNILFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzNDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUMzQyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsTUFBTTtBQUFBLElBQ0osUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDM0MsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLE1BQU07QUFBQSxJQUNKLFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzNDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDSixRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUMzQyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBO0FBQUEsRUFFQSxLQUFNLEVBQUUsUUFBUSxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxDQUFDLEdBQUcsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDLEVBQUU7QUFBQSxFQUNqRyxLQUFNLEVBQUUsUUFBUSxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxDQUFDLEdBQUcsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDLEVBQUU7QUFBQSxFQUNqRyxLQUFNLEVBQUUsUUFBUSxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxDQUFDLEdBQUcsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDLEVBQUU7QUFBQSxFQUNqRyxLQUFNLEVBQUUsUUFBUSxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxDQUFDLEdBQUcsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDLEVBQUU7QUFBQSxFQUNqRyxLQUFLO0FBQUEsSUFDSCxRQUFTLENBQUMsRUFBRSxNQUFNLFVBQVUsVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLFlBQVksVUFBVSxPQUFPLENBQUM7QUFBQSxJQUN0RixTQUFTLENBQUMsRUFBRSxNQUFNLFFBQVUsVUFBVSxPQUFPLENBQUM7QUFBQSxFQUNoRDtBQUFBO0FBQUEsRUFHQSxJQUFJO0FBQUEsSUFDRixRQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUM5RSxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsSUFBSTtBQUFBLElBQ0YsUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDOUUsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLElBQUk7QUFBQSxJQUNGLFFBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzlFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxJQUFJO0FBQUEsSUFDRixRQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUM5RSxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsSUFBSTtBQUFBLElBQ0YsUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDOUUsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLElBQUk7QUFBQSxJQUNGLFFBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzlFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUE7QUFBQSxFQUdBLE1BQU07QUFBQSxJQUNKLFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzNDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxRQUFTLENBQUMsRUFBRSxNQUFNLEtBQU8sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUNqSCxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxLQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDakgsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQ2hILFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxRQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUM5RSxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDOUUsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQTtBQUFBLEVBR0EsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxVQUFVLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDOUMsU0FBUyxDQUFDLEVBQUUsTUFBTSxRQUFVLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDaEQ7QUFBQSxFQUNBLEtBQUs7QUFBQSxJQUNILFFBQVMsQ0FBQyxFQUFFLE1BQU0sVUFBVSxVQUFVLE9BQU8sR0FBRyxFQUFF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TUFBTSxNQUFNLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDOUU7QUFBQSxFQUNBLFlBQVk7QUFBQSxJQUNWLFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzVFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sS0FBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzlFO0FBQUEsRUFDQSxhQUFhO0FBQUEsSUFDWCxRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLEtBQU0sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE1BQU0sVUFBVSxNQUFNLENBQUM7QUFBQSxJQUM3RyxTQUFTLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE1BQU0sVUFBVSxNQUFNLENBQUM7QUFBQSxFQUM3RTtBQUFBLEVBQ0EsY0FBYztBQUFBLElBQ1osUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxLQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsTUFBTSxDQUFDO0FBQUEsSUFDN0csU0FBUyxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsTUFBTSxDQUFDO0FBQUEsRUFDN0U7QUFBQTtBQUFBLEVBR0EsT0FBTztBQUFBLElBQ0wsUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsTUFBTSxHQUFHLEVBQUUsTUFBTSxVQUFVLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxVQUFVLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxXQUFXLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDNUosU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxXQUFXLFVBQVUsTUFBTSxDQUFDO0FBQUEsRUFDbkY7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sVUFBVSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sVUFBVSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sV0FBVyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzdKLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE1BQU0sR0FBRyxFQUFFLE1BQU0sV0FBVyxVQUFVLE1BQU0sQ0FBQztBQUFBLEVBQ2xGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixRQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLFNBQVMsVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUNuSCxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxTQUFTLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDbkgsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQTtBQUFBLEVBR0EsT0FBUyxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sS0FBTyxVQUFVLFNBQVMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sV0FBVyxVQUFVLE1BQU0sQ0FBQyxFQUFFO0FBQUEsRUFDMUcsUUFBUyxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sS0FBTyxVQUFVLFNBQVMsR0FBRyxFQUFFLE1BQU0sS0FBSyxVQUFVLE1BQU0sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sV0FBVyxVQUFVLFNBQVMsQ0FBQyxFQUFFO0FBQUEsRUFDN0ksU0FBUyxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sS0FBTyxVQUFVLFNBQVMsR0FBRyxFQUFFLE1BQU0sS0FBSyxVQUFVLE1BQU0sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sV0FBVyxVQUFVLFNBQVMsQ0FBQyxFQUFFO0FBQUEsRUFDN0ksT0FBUyxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sS0FBTyxVQUFVLFNBQVMsR0FBRyxFQUFFLE1BQU0sS0FBSyxVQUFVLE1BQU0sR0FBRyxFQUFFLE1BQU0sS0FBSyxVQUFVLE1BQU0sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sV0FBVyxVQUFVLFNBQVMsQ0FBQyxFQUFFO0FBQUEsRUFDN0ssUUFBUyxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLFNBQVMsR0FBRyxFQUFFLE1BQU0sT0FBTyxVQUFVLFNBQVMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sV0FBVyxVQUFVLE1BQU0sQ0FBQyxFQUFFO0FBQUEsRUFDL0ksUUFBUyxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sTUFBTyxVQUFVLE9BQVMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLFNBQVMsQ0FBQyxFQUFFO0FBQUEsRUFDekcsVUFBUyxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLFNBQVMsR0FBRyxFQUFFLE1BQU0sT0FBTyxVQUFVLFNBQVMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLFNBQVMsQ0FBQyxFQUFFO0FBQUE7QUFBQSxFQUc5SSxTQUFTO0FBQUEsSUFDUCxRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUMzQyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDM0MsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzNDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDSixRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUMzQyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDM0MsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQTtBQUFBLEVBR0EsTUFBTTtBQUFBLElBQ0osUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxRQUFRLFVBQVUsU0FBUyxDQUFDO0FBQUEsSUFDbkgsU0FBUyxDQUFDLEVBQUUsTUFBTSxRQUFRLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxTQUFTLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxVQUFVLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDekg7QUFBQSxFQUNBLE1BQU07QUFBQSxJQUNKLFFBQVMsQ0FBQyxFQUFFLE1BQU0sUUFBUSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sUUFBUSxVQUFVLFNBQVMsQ0FBQztBQUFBLElBQ3BILFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sU0FBUyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sVUFBVSxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQ3hIO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLFNBQVMsVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLFFBQVEsVUFBVSxPQUFPLENBQUM7QUFBQSxJQUN0SixTQUFTLENBQUMsRUFBRSxNQUFNLFNBQVMsVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLFFBQVEsVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLFNBQVMsVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUMzSjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxTQUFTLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDckosU0FBUyxDQUFDLEVBQUUsTUFBTSxRQUFRLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxRQUFRLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxTQUFTLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDdkg7QUFBQTtBQUFBLEVBR0EsYUFBYyxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE1BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQVEsQ0FBQyxFQUFFO0FBQUEsRUFDMUcsYUFBYyxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE1BQVEsQ0FBQyxFQUFFO0FBQUEsRUFDMUcsY0FBYyxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQVEsQ0FBQyxFQUFFO0FBQUEsRUFDMUcsY0FBYyxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQVEsQ0FBQyxFQUFFO0FBQUEsRUFDMUcsYUFBYyxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE1BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQVEsQ0FBQyxFQUFFO0FBQUEsRUFDMUcsYUFBYyxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE1BQVEsQ0FBQyxFQUFFO0FBQUEsRUFDMUcsYUFBYyxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE1BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQVEsQ0FBQyxFQUFFO0FBQUEsRUFDMUcsYUFBYyxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE1BQVEsQ0FBQyxFQUFFO0FBQUEsRUFDMUcsYUFBYyxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE1BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQVEsQ0FBQyxFQUFFO0FBQUEsRUFDMUcsZUFBYyxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLFFBQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQVEsQ0FBQyxFQUFFO0FBQUEsRUFDMUcsZUFBYyxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQyxHQUFHLFNBQVMs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
