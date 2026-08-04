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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjMi9wbGMtZWRpdG9yLXRzeC92ZW5kb3IvcGluU2lnbmF0dXJlcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLypcbiAqIENhbm9uaWNhbCBwaW4gc2lnbmF0dXJlIHRhYmxlIGZvciBhbGwgSUVDIDYxMTMxLTMgc3RhbmRhcmQgZnVuY3Rpb24gYmxvY2tzLlxuICpcbiAqIFRoaXMgaXMgdGhlIHNpbmdsZSBzb3VyY2Ugb2YgdHJ1dGggZm9yIHBpbiBuYW1lcyBhbmQgdGhlaXIgSUVDRGF0YVR5cGUuXG4gKiBFdmVyeSBhZGFwdGVyIHVzZXMgdGhpcyBpbnN0ZWFkIG9mIGhhcmRjb2RpbmcgJ0JPT0wnIGV2ZXJ5d2hlcmUuXG4gKlxuICogU3RydWN0dXJlIHBlciBlbnRyeTpcbiAqICAgaW5wdXRzOiAgeyBwaW5OYW1lOiBJRUNEYXRhVHlwZSB9W10gICBcdTIwMTQgb3JkZXJlZCBsaXN0LCBtYXRjaGVzIElFQyA2MTEzMS0zIHN0YW5kYXJkXG4gKiAgIG91dHB1dHM6IHsgcGluTmFtZTogSUVDRGF0YVR5cGUgfVtdXG4gKlxuICogRm9yIGJsb2NrcyB3aG9zZSBvcGVyYW5kIGRhdGEgdHlwZSBpcyBwb2x5bW9ycGhpYyAoQURELCBTVUIsIE1PVkUsIGNvbXBhcmlzb25zLCBldGMuKVxuICogdGhlIGNhbm9uaWNhbCB0eXBlIGlzICdESU5UJyBhcyB0aGUgZGVmYXVsdCBudW1lcmljIHR5cGUuIENhbGxlcnMgdGhhdCBoYXZlIGNvbmNyZXRlXG4gKiB2YXJpYWJsZSBkZWNsYXJhdGlvbnMgc2hvdWxkIG92ZXJyaWRlIHVzaW5nIHJlc29sdmVUYWdUeXBlKCkgZnJvbSB2YXJpYWJsZVR5cGVSZXNvbHZlci5cbiAqL1xuXG5pbXBvcnQgdHlwZSB7IElFQ0RhdGFUeXBlIH0gZnJvbSAnLi4vbG9naWNTdG9yZS5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGluRGVmIHtcbiAgbmFtZTogc3RyaW5nO1xuICBkYXRhVHlwZTogSUVDRGF0YVR5cGU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQmxvY2tTaWduYXR1cmUge1xuICBpbnB1dHM6IFBpbkRlZltdO1xuICBvdXRwdXRzOiBQaW5EZWZbXTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFN0YW5kYXJkIElFQyA2MTEzMS0zIEZ1bmN0aW9uIEJsb2NrIFNpZ25hdHVyZXMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNvbnN0IFNJRzogUmVjb3JkPHN0cmluZywgQmxvY2tTaWduYXR1cmU+ID0ge1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBUaW1lcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIFRPTjoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnUFQnLCBkYXRhVHlwZTogJ1RJTUUnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdRJywgIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnRVQnLCBkYXRhVHlwZTogJ1RJTUUnIH1dLFxuICB9LFxuICBUT0Y6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ1BUJywgZGF0YVR5cGU6ICdUSU1FJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnUScsICBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0VUJywgZGF0YVR5cGU6ICdUSU1FJyB9XSxcbiAgfSxcbiAgVFA6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ1BUJywgZGF0YVR5cGU6ICdUSU1FJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnUScsICBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0VUJywgZGF0YVR5cGU6ICdUSU1FJyB9XSxcbiAgfSxcbiAgLy8gUm9ja3dlbGwgcmV0ZW50aXZlIHRpbWVyIFx1MjAxNCBzYW1lIGludGVyZmFjZSBhcyBUT05cbiAgUlRPOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdQVCcsIGRhdGFUeXBlOiAnVElNRScgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ1EnLCAgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdFVCcsIGRhdGFUeXBlOiAnVElNRScgfV0sXG4gIH0sXG5cbiAgLy8gXHUyNTAwXHUyNTAwIENvdW50ZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBDVFU6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnQ1UnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ1InLCAgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdQVicsIGRhdGFUeXBlOiAnSU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnUVUnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0NWJywgZGF0YVR5cGU6ICdJTlQnIH1dLFxuICB9LFxuICBDVEQ6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnQ0QnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0xEJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdQVicsIGRhdGFUeXBlOiAnSU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnUUQnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0NWJywgZGF0YVR5cGU6ICdJTlQnIH1dLFxuICB9LFxuICBDVFVEOiB7XG4gICAgaW5wdXRzOiAgW1xuICAgICAgeyBuYW1lOiAnQ1UnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0NEJywgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgeyBuYW1lOiAnUicsICBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0xEJywgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgeyBuYW1lOiAnUFYnLCBkYXRhVHlwZTogJ0lOVCcgfSxcbiAgICBdLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdRVScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnUUQnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0NWJywgZGF0YVR5cGU6ICdJTlQnIH1dLFxuICB9LFxuXG4gIC8vIFx1MjUwMFx1MjUwMCBCaXN0YWJsZSBsYXRjaGVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBTUjoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdTMScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnUicsICBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdRMScsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG4gIFJTOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1MnLCAgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdSMScsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ1ExJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcblxuICAvLyBcdTI1MDBcdTI1MDAgRWRnZSBkZXRlY3Rpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIFJUUklHOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0NMSycsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ1EnLCAgIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG4gIEZUUklHOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0NMSycsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ1EnLCAgIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG4gIC8vIEFsaWFzIG5hbWVzIHVzZWQgYnkgc29tZSB2ZW5kb3JzXG4gIFJfVFJJRzoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdDTEsnLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdRJywgICBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICB9LFxuICBGX1RSSUc6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnQ0xLJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnUScsICAgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcblxuICAvLyBcdTI1MDBcdTI1MDAgQm9vbGVhbiBnYXRlcyAoRkJEKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgQU5EOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOMScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnSU4yJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcbiAgT1I6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4xJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdJTjInLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICB9LFxuICBYT1I6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4xJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdJTjInLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICB9LFxuICBOT1Q6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCAgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcbiAgTkFORDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG4gIE5PUjoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG5cbiAgLy8gXHUyNTAwXHUyNTAwIEFyaXRobWV0aWMgKHBvbHltb3JwaGljIFx1MjAxNCBjYW5vbmljYWwgZGVmYXVsdDogRElOVCkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIEFERDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gIH0sXG4gIFNVQjoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gIH0sXG4gIE1VTDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gIH0sXG4gIERJVjoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gIH0sXG4gIE1PRDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gIH0sXG4gIEFCUzoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTicsICBkYXRhVHlwZTogJ0RJTlQnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0RJTlQnIH1dLFxuICB9LFxuICBTUVJUOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gIH0sXG4gIE5FRzoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTicsICBkYXRhVHlwZTogJ0RJTlQnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0RJTlQnIH1dLFxuICB9LFxuXG4gIC8vIFx1MjUwMFx1MjUwMCBNYXRoIChhbHdheXMgUkVBTCkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIExOOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gIH0sXG4gIExPRzoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTicsICBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICB9LFxuICBFWFA6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCAgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgfSxcbiAgU0lOOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gIH0sXG4gIENPUzoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTicsICBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICB9LFxuICBUQU46IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCAgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgfSxcbiAgQVNJTjoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTicsICBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICB9LFxuICBBQ09TOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gIH0sXG4gIEFUQU46IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCAgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgfSxcbiAgLy8gUm9ja3dlbGwgYWxpYXNlc1xuICBBVE46ICB7IGlucHV0czogW3sgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdSRUFMJyB9XSwgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnUkVBTCcgfV0gfSxcbiAgQVNOOiAgeyBpbnB1dHM6IFt7IG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnUkVBTCcgfV0sIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ1JFQUwnIH1dIH0sXG4gIEFDUzogIHsgaW5wdXRzOiBbeyBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ1JFQUwnIH1dLCBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdSRUFMJyB9XSB9LFxuICBTUVI6ICB7IGlucHV0czogW3sgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdSRUFMJyB9XSwgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnUkVBTCcgfV0gfSxcbiAgWFBZOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1NvdXJjZScsIGRhdGFUeXBlOiAnUkVBTCcgfSwgeyBuYW1lOiAnRXhwb25lbnQnLCBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdEZXN0JywgICBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICB9LFxuXG4gIC8vIFx1MjUwMFx1MjUwMCBDb21wYXJpc29uIChvdXRwdXQgaXMgQk9PTCwgaW5wdXRzIGFyZSBwb2x5bW9ycGhpYyBudW1lcmljIFx1MjAxNCBkZWZhdWx0IERJTlQpIFx1MjUwMFx1MjUwMFxuICBHVDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG4gIEdFOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOMScsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnSU4yJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcbiAgTFQ6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4xJywgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdJTjInLCBkYXRhVHlwZTogJ0RJTlQnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICB9LFxuICBMRToge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG4gIEVROiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOMScsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnSU4yJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcbiAgTkU6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4xJywgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdJTjInLCBkYXRhVHlwZTogJ0RJTlQnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICB9LFxuXG4gIC8vIFx1MjUwMFx1MjUwMCBEYXRhL3NlbGVjdGlvbiAocG9seW1vcnBoaWMgXHUyMDE0IGRlZmF1bHQgRElOVCkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIE1PVkU6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCAgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgfSxcbiAgU0VMOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0cnLCAgIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnSU4wJywgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ0RJTlQnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0RJTlQnIH1dLFxuICB9LFxuICBNVVg6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSycsICAgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdJTjAnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0lOMScsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gIH0sXG4gIExJTUlUOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ01OJywgIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnSU4nLCAgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdNWCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gIH0sXG4gIE1JTjoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gIH0sXG4gIE1BWDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gIH0sXG5cbiAgLy8gXHUyNTAwXHUyNTAwIFJvY2t3ZWxsLXNwZWNpZmljIGluc3RydWN0aW9uIGJsb2NrcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgTU9WOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1NvdXJjZScsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ0Rlc3QnLCAgIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gIH0sXG4gIENPUDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdTb3VyY2UnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0xlbmd0aCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ0Rlc3QnLCAgIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gIH0sXG4gIE1WTToge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdTb3VyY2UnLCBkYXRhVHlwZTogJ0RXT1JEJyB9LCB7IG5hbWU6ICdNYXNrJywgZGF0YVR5cGU6ICdEV09SRCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ0Rlc3QnLCAgIGRhdGFUeXBlOiAnRFdPUkQnIH1dLFxuICB9LFxuICBCVEQ6IHtcbiAgICBpbnB1dHM6ICBbXG4gICAgICB7IG5hbWU6ICdTb3VyY2UnLCAgICAgZGF0YVR5cGU6ICdEV09SRCcgfSwgeyBuYW1lOiAnU291cmNlQml0JywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgeyBuYW1lOiAnRGVzdEJpdCcsICAgIGRhdGFUeXBlOiAnRElOVCcgIH0sIHsgbmFtZTogJ0xlbmd0aCcsICAgIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICBdLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdEZXN0JywgZGF0YVR5cGU6ICdEV09SRCcgfV0sXG4gIH0sXG4gIFNXUEI6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnU291cmNlJywgZGF0YVR5cGU6ICdEV09SRCcgfSwgeyBuYW1lOiAnT3JkZXInLCBkYXRhVHlwZTogJ0RJTlQnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdEZXN0JywgICBkYXRhVHlwZTogJ0RXT1JEJyB9XSxcbiAgfSxcbiAgRkxMOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1NvdXJjZScsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnTGVuZ3RoJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnRGVzdCcsICAgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgfSxcbiAgU0laRToge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdTb3VyY2UnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0RpbScsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ0Rlc3QnLCAgIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gIH0sXG4gIENQVDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdFeHByZXNzaW9uJywgZGF0YVR5cGU6ICdTVFJJTkcnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdEZXN0JywgICAgICAgZGF0YVR5cGU6ICdESU5UJyAgIH1dLFxuICB9LFxuICBDTVA6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnRXhwcmVzc2lvbicsIGRhdGFUeXBlOiAnU1RSSU5HJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgICAgICAgIGRhdGFUeXBlOiAnQk9PTCcgICB9XSxcbiAgfSxcblxuICAvLyBSb2Nrd2VsbCBGSUZPL0xJRk9cbiAgRkZMOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1NvdXJjZScsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnRklGTycsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnTGVuZ3RoJywgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdQb3NpdGlvbicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsICAgIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG4gIEZGVToge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdGSUZPJywgICBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0Rlc3QnLCAgIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnTGVuZ3RoJywgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdQb3NpdGlvbicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsICAgIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG4gIExGTDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdTb3VyY2UnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ1N0YWNrJywgIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnTGVuZ3RoJywgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdQb3NpdGlvbicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsICAgIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG4gIExGVToge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdTdGFjaycsICBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0Rlc3QnLCAgIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnTGVuZ3RoJywgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdQb3NpdGlvbicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsICAgIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG5cbiAgLy8gUm9ja3dlbGwgc2VxdWVuY2VyXG4gIFNRTzoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdBcnJheScsICBkYXRhVHlwZTogJ0RXT1JEJyB9LCB7IG5hbWU6ICdNYXNrJywgZGF0YVR5cGU6ICdEV09SRCcgfSwgeyBuYW1lOiAnRGVzdCcsICAgZGF0YVR5cGU6ICdEV09SRCcgfSwgeyBuYW1lOiAnTGVuZ3RoJywgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdQb3NpdGlvbicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsICAgIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG4gIFNRSToge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdBcnJheScsICBkYXRhVHlwZTogJ0RXT1JEJyB9LCB7IG5hbWU6ICdNYXNrJywgZGF0YVR5cGU6ICdEV09SRCcgfSwgeyBuYW1lOiAnU291cmNlJywgZGF0YVR5cGU6ICdEV09SRCcgfSwgeyBuYW1lOiAnTGVuZ3RoJywgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdQb3NpdGlvbicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ0ZvdW5kJywgIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG4gIFNRTDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdBcnJheScsICBkYXRhVHlwZTogJ0RXT1JEJyB9LCB7IG5hbWU6ICdMZW5ndGgnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ1Bvc2l0aW9uJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgICAgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcblxuICAvLyBSb2Nrd2VsbCBQSURcbiAgUElEOiB7XG4gICAgaW5wdXRzOiAgW1xuICAgICAgeyBuYW1lOiAnUElEJywgICAgICBkYXRhVHlwZTogJ1NUUlVDVCcgfSwgeyBuYW1lOiAnUHJvY2VzcycsICBkYXRhVHlwZTogJ1JFQUwnIH0sXG4gICAgICB7IG5hbWU6ICdUaWViYWNrJywgIGRhdGFUeXBlOiAnUkVBTCcgICB9LCB7IG5hbWU6ICdDb250cm9sJywgIGRhdGFUeXBlOiAnUkVBTCcgfSxcbiAgICBdLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCAgICBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICB9LFxuXG4gIC8vIFJvY2t3ZWxsIHN0cmluZyBpbnN0cnVjdGlvbnNcbiAgQ09OQ0FUOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1NvdXJjZTEnLCBkYXRhVHlwZTogJ1NUUklORycgfSwgeyBuYW1lOiAnU291cmNlMicsIGRhdGFUeXBlOiAnU1RSSU5HJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnRGVzdCcsICAgIGRhdGFUeXBlOiAnU1RSSU5HJyB9XSxcbiAgfSxcbiAgTUlEOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1NvdXJjZScsIGRhdGFUeXBlOiAnU1RSSU5HJyB9LCB7IG5hbWU6ICdRdHknLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ1N0YXJ0JywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnRGVzdCcsICAgZGF0YVR5cGU6ICdTVFJJTkcnIH1dLFxuICB9LFxuICBGSU5EOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1NvdXJjZScsIGRhdGFUeXBlOiAnU1RSSU5HJyB9LCB7IG5hbWU6ICdTZWFyY2gnLCBkYXRhVHlwZTogJ1NUUklORycgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ1Jlc3VsdCcsIGRhdGFUeXBlOiAnRElOVCcgICB9XSxcbiAgfSxcbiAgSU5TRVJUOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1NvdXJjZScsIGRhdGFUeXBlOiAnU1RSSU5HJyB9LCB7IG5hbWU6ICdJbnNlcnQnLCBkYXRhVHlwZTogJ1NUUklORycgfSwgeyBuYW1lOiAnU3RhcnQnLCBkYXRhVHlwZTogJ0RJTlQnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdEZXN0JywgICBkYXRhVHlwZTogJ1NUUklORycgfV0sXG4gIH0sXG4gIERFTEVURToge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdTb3VyY2UnLCBkYXRhVHlwZTogJ1NUUklORycgfSwgeyBuYW1lOiAnUXR5JywgZGF0YVR5cGU6ICdESU5UJyB9LCB7IG5hbWU6ICdTdGFydCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ0Rlc3QnLCAgIGRhdGFUeXBlOiAnU1RSSU5HJyB9XSxcbiAgfSxcbiAgTEVOOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1NvdXJjZScsIGRhdGFUeXBlOiAnU1RSSU5HJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnRGVzdCcsICAgZGF0YVR5cGU6ICdESU5UJyAgIH1dLFxuICB9LFxuICBVUFBFUl9DQVNFOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgIGRhdGFUeXBlOiAnU1RSSU5HJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdTVFJJTkcnIH1dLFxuICB9LFxuICBMT1dFUl9DQVNFOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgIGRhdGFUeXBlOiAnU1RSSU5HJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdTVFJJTkcnIH1dLFxuICB9LFxuICBDT05DQVRfREFURV9UT0Q6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4xJywgZGF0YVR5cGU6ICdEQVRFJyB9LCB7IG5hbWU6ICdJTjInLCBkYXRhVHlwZTogJ1RPRCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnRFQnICAgfV0sXG4gIH0sXG5cbiAgLy8gUm9ja3dlbGwgbWVzc2FnZSAvIG1vdGlvbiAocHJlc2VydmUgYXMgYmxvY2tzIHdpdGggbWluaW1hbCB0eXBlZCBwaW5zKVxuICBNU0c6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnTWVzc2FnZScsIGRhdGFUeXBlOiAnU1RSVUNUJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnRE4nLCAgICAgIGRhdGFUeXBlOiAnQk9PTCcgICB9XSxcbiAgfSxcbiAgTUFKOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0F4aXMnLCAgICBkYXRhVHlwZTogJ1NUUlVDVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ0RvbmUnLCAgICBkYXRhVHlwZTogJ0JPT0wnICAgfV0sXG4gIH0sXG4gIE1BTToge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdBeGlzJywgICAgZGF0YVR5cGU6ICdTVFJVQ1QnIH0sIHsgbmFtZTogJ01vdGlvbkNvbnRyb2wnLCBkYXRhVHlwZTogJ1NUUlVDVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ0RvbmUnLCAgICBkYXRhVHlwZTogJ0JPT0wnICAgfV0sXG4gIH0sXG4gIE1BUzoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdBeGlzJywgICAgZGF0YVR5cGU6ICdTVFJVQ1QnIH0sIHsgbmFtZTogJ01vdGlvbkNvbnRyb2wnLCBkYXRhVHlwZTogJ1NUUlVDVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ0RvbmUnLCAgICBkYXRhVHlwZTogJ0JPT0wnICAgfV0sXG4gIH0sXG4gIEdTVjoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdPYmplY3QnLCAgICBkYXRhVHlwZTogJ1NUUklORycgfSwgeyBuYW1lOiAnQXR0cmlidXRlJywgZGF0YVR5cGU6ICdTVFJJTkcnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdEZXN0JywgICAgICBkYXRhVHlwZTogJ0RJTlQnICAgfV0sXG4gIH0sXG4gIFNTVjoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdPYmplY3QnLCAgICBkYXRhVHlwZTogJ1NUUklORycgfSwgeyBuYW1lOiAnQXR0cmlidXRlJywgZGF0YVR5cGU6ICdTVFJJTkcnIH0sIHsgbmFtZTogJ1NvdXJjZScsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsICAgICAgIGRhdGFUeXBlOiAnQk9PTCcgICB9XSxcbiAgfSxcblxuICAvLyBSb2Nrd2VsbCBMSU0gKGxpbWl0IHRlc3QpIFx1MjAxNCByYW5nZSBjaGVja1xuICBMSU06IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnTG93TGltaXQnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ1Rlc3QnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0hpZ2hMaW1pdCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsICAgICAgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcbiAgTUVROiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1NvdXJjZScsIGRhdGFUeXBlOiAnRFdPUkQnIH0sIHsgbmFtZTogJ01hc2snLCBkYXRhVHlwZTogJ0RXT1JEJyB9LCB7IG5hbWU6ICdDb21wYXJlJywgZGF0YVR5cGU6ICdEV09SRCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsICAgIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG5cbiAgLy8gU2llbWVucy1zcGVjaWZpYyAoSUVDIGxpYnJhcnkgZXF1aXZhbGVudHMpXG4gIEJMSU5LOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0VOQUJMRScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnVElNRV9ISUdIJywgZGF0YVR5cGU6ICdUSU1FJyB9LCB7IG5hbWU6ICdUSU1FX0xPVycsIGRhdGFUeXBlOiAnVElNRScgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsICAgIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gIH0sXG4gIFRPTlI6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ1InLCAgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdQVCcsIGRhdGFUeXBlOiAnVElNRScgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ1EnLCAgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdFVCcsIGRhdGFUeXBlOiAnVElNRScgfV0sXG4gIH0sXG4gIElFQ19USU1FUjoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnUFQnLCBkYXRhVHlwZTogJ1RJTUUnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdRJywgIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnRVQnLCBkYXRhVHlwZTogJ1RJTUUnIH1dLFxuICB9LFxuICBJRUNfTFRJTUVSOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdQVCcsIGRhdGFUeXBlOiAnVElNRScgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ1EnLCAgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdFVCcsIGRhdGFUeXBlOiAnVElNRScgfV0sXG4gIH0sXG4gIElFQ19DT1VOVEVSOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0NVJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdSJywgIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnUFYnLCBkYXRhVHlwZTogJ0lOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ1FVJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdDVicsIGRhdGFUeXBlOiAnSU5UJyB9XSxcbiAgfSxcbiAgSUVDX0xDT1VOVEVSOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0NVJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdSJywgIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnUFYnLCBkYXRhVHlwZTogJ0lOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ1FVJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdDVicsIGRhdGFUeXBlOiAnSU5UJyB9XSxcbiAgfSxcblxuICAvLyBTaWVtZW5zIHNjYWxpbmcgKGFuYWxvZyBJL08pXG4gIFNDQUxFOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdJTlQnIH0sIHsgbmFtZTogJ0hJX0xJTScsIGRhdGFUeXBlOiAnUkVBTCcgfSwgeyBuYW1lOiAnTE9fTElNJywgZGF0YVR5cGU6ICdSRUFMJyB9LCB7IG5hbWU6ICdCSVBPTEFSJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdSRUFMJyB9LCB7IG5hbWU6ICdSRVRfVkFMJywgZGF0YVR5cGU6ICdJTlQnIH1dLFxuICB9LFxuICBVTlNDQUxFOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdSRUFMJyB9LCB7IG5hbWU6ICdISV9MSU0nLCBkYXRhVHlwZTogJ1JFQUwnIH0sIHsgbmFtZTogJ0xPX0xJTScsIGRhdGFUeXBlOiAnUkVBTCcgfSwgeyBuYW1lOiAnQklQT0xBUicsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnSU5UJyB9LCB7IG5hbWU6ICdSRVRfVkFMJywgZGF0YVR5cGU6ICdJTlQnIH1dLFxuICB9LFxuICBOT1JNX1g6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnTUlOJywgZGF0YVR5cGU6ICdSRUFMJyB9LCB7IG5hbWU6ICdWQUxVRScsIGRhdGFUeXBlOiAnUkVBTCcgfSwgeyBuYW1lOiAnTUFYJywgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgfSxcbiAgU0NBTEVfWDoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdNSU4nLCBkYXRhVHlwZTogJ1JFQUwnIH0sIHsgbmFtZTogJ1ZBTFVFJywgZGF0YVR5cGU6ICdSRUFMJyB9LCB7IG5hbWU6ICdNQVgnLCBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ1JFQUwnIH1dLFxuICB9LFxuXG4gIC8vIFNpZW1lbnMgc3RyaW5nIGZ1bmN0aW9uc1xuICBTX0xFTjogICB7IGlucHV0czogW3sgbmFtZTogJ1MnLCAgIGRhdGFUeXBlOiAnU1RSSU5HJyB9XSwgb3V0cHV0czogW3sgbmFtZTogJ1JFVF9WQUwnLCBkYXRhVHlwZTogJ0lOVCcgfV0gfSxcbiAgU19MRUZUOiAgeyBpbnB1dHM6IFt7IG5hbWU6ICdMJywgICBkYXRhVHlwZTogJ1NUUklORycgfSwgeyBuYW1lOiAnTicsIGRhdGFUeXBlOiAnSU5UJyB9XSwgb3V0cHV0czogW3sgbmFtZTogJ1JFVF9WQUwnLCBkYXRhVHlwZTogJ1NUUklORycgfV0gfSxcbiAgU19SSUdIVDogeyBpbnB1dHM6IFt7IG5hbWU6ICdMJywgICBkYXRhVHlwZTogJ1NUUklORycgfSwgeyBuYW1lOiAnTicsIGRhdGFUeXBlOiAnSU5UJyB9XSwgb3V0cHV0czogW3sgbmFtZTogJ1JFVF9WQUwnLCBkYXRhVHlwZTogJ1NUUklORycgfV0gfSxcbiAgU19NSUQ6ICAgeyBpbnB1dHM6IFt7IG5hbWU6ICdMJywgICBkYXRhVHlwZTogJ1NUUklORycgfSwgeyBuYW1lOiAnTicsIGRhdGFUeXBlOiAnSU5UJyB9LCB7IG5hbWU6ICdQJywgZGF0YVR5cGU6ICdJTlQnIH1dLCBvdXRwdXRzOiBbeyBuYW1lOiAnUkVUX1ZBTCcsIGRhdGFUeXBlOiAnU1RSSU5HJyB9XSB9LFxuICBTX0ZJTkQ6ICB7IGlucHV0czogW3sgbmFtZTogJ0lOMScsIGRhdGFUeXBlOiAnU1RSSU5HJyB9LCB7IG5hbWU6ICdJTjInLCBkYXRhVHlwZTogJ1NUUklORycgfV0sIG91dHB1dHM6IFt7IG5hbWU6ICdSRVRfVkFMJywgZGF0YVR5cGU6ICdJTlQnIH1dIH0sXG4gIFNfQ09OVjogIHsgaW5wdXRzOiBbeyBuYW1lOiAnSU4nLCAgZGF0YVR5cGU6ICdESU5UJyAgIH1dLCBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdTVFJJTkcnIH1dIH0sXG4gIFNfQ09OQ0FUOnsgaW5wdXRzOiBbeyBuYW1lOiAnSU4xJywgZGF0YVR5cGU6ICdTVFJJTkcnIH0sIHsgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnU1RSSU5HJyB9XSwgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnU1RSSU5HJyB9XSB9LFxuXG4gIC8vIFNpZW1lbnMgdHlwZSBjb252ZXJzaW9uc1xuICBDT05WRVJUOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gIH0sXG4gIFJPVU5EOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gIH0sXG4gIFRSVU5DOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0lOJywgIGRhdGFUeXBlOiAnUkVBTCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gIH0sXG4gIENFSUw6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCAgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgfSxcbiAgRkxPT1I6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnSU4nLCAgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgICBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdSRUFMJyB9XSxcbiAgfSxcblxuICAvLyBTaWVtZW5zIGNvbW11bmljYXRpb24gLyBkYXRhIGV4Y2hhbmdlIEZCcyAobWluaW1hbCB0eXBlZCBwaW5zKVxuICBTRU5EOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ1JFUScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnSUQnLCBkYXRhVHlwZTogJ1dPUkQnIH0sIHsgbmFtZTogJ1NEXzEnLCBkYXRhVHlwZTogJ1NUUlVDVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ0RPTkUnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0VSUk9SJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdTVEFUVVMnLCBkYXRhVHlwZTogJ1dPUkQnIH1dLFxuICB9LFxuICBSRUNWOiB7XG4gICAgaW5wdXRzOiAgW3sgbmFtZTogJ0VOX1InLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0lEJywgZGF0YVR5cGU6ICdXT1JEJyB9LCB7IG5hbWU6ICdSRF8xJywgZGF0YVR5cGU6ICdTVFJVQ1QnIH1dLFxuICAgIG91dHB1dHM6IFt7IG5hbWU6ICdORFInLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0VSUk9SJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdTVEFUVVMnLCBkYXRhVHlwZTogJ1dPUkQnIH1dLFxuICB9LFxuICBSRFJFQzoge1xuICAgIGlucHV0czogIFt7IG5hbWU6ICdSRVEnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0lEJywgZGF0YVR5cGU6ICdXT1JEJyB9LCB7IG5hbWU6ICdJTkRFWCcsIGRhdGFUeXBlOiAnRElOVCcgfSwgeyBuYW1lOiAnTUxFTicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ1ZBTElEJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdCVVNZJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdFUlJPUicsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBuYW1lOiAnTEVOJywgZGF0YVR5cGU6ICdESU5UJyB9XSxcbiAgfSxcbiAgV1JSRUM6IHtcbiAgICBpbnB1dHM6ICBbeyBuYW1lOiAnUkVRJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IG5hbWU6ICdJRCcsIGRhdGFUeXBlOiAnV09SRCcgfSwgeyBuYW1lOiAnSU5ERVgnLCBkYXRhVHlwZTogJ0RJTlQnIH0sIHsgbmFtZTogJ0xFTicsIGRhdGFUeXBlOiAnRElOVCcgfV0sXG4gICAgb3V0cHV0czogW3sgbmFtZTogJ0RPTkUnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0JVU1knLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgbmFtZTogJ0VSUk9SJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgfSxcblxuICAvLyBTdGFuZGFyZCBJRUMgZGF0YSBjb252ZXJzaW9ucyAodXNlZCBhY3Jvc3MgYWxsIHZlbmRvcnMpXG4gIElOVF9UT19SRUFMOiAgeyBpbnB1dHM6IFt7IG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnSU5UJyAgfV0sIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ1JFQUwnICB9XSB9LFxuICBSRUFMX1RPX0lOVDogIHsgaW5wdXRzOiBbeyBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ1JFQUwnIH1dLCBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdJTlQnICAgfV0gfSxcbiAgRElOVF9UT19SRUFMOiB7IGlucHV0czogW3sgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdESU5UJyB9XSwgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnUkVBTCcgIH1dIH0sXG4gIFJFQUxfVE9fRElOVDogeyBpbnB1dHM6IFt7IG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnUkVBTCcgfV0sIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0RJTlQnICB9XSB9LFxuICBJTlRfVE9fRElOVDogIHsgaW5wdXRzOiBbeyBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ0lOVCcgIH1dLCBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdESU5UJyAgfV0gfSxcbiAgQk9PTF9UT19JTlQ6ICB7IGlucHV0czogW3sgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdCT09MJyB9XSwgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnSU5UJyAgIH1dIH0sXG4gIElOVF9UT19CT09MOiAgeyBpbnB1dHM6IFt7IG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnSU5UJyAgfV0sIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0JPT0wnICB9XSB9LFxuICBXT1JEX1RPX0lOVDogIHsgaW5wdXRzOiBbeyBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ1dPUkQnIH1dLCBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdJTlQnICAgfV0gfSxcbiAgSU5UX1RPX1dPUkQ6ICB7IGlucHV0czogW3sgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdJTlQnICB9XSwgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnV09SRCcgIH1dIH0sXG4gIERXT1JEX1RPX0RJTlQ6eyBpbnB1dHM6IFt7IG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnRFdPUkQnfV0sIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0RJTlQnICB9XSB9LFxuICBESU5UX1RPX0RXT1JEOnsgaW5wdXRzOiBbeyBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ0RJTlQnIH1dLCBvdXRwdXRzOiBbeyBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdEV09SRCcgfV0gfSxcbiAgVElNRV9UT19ESU5UOiB7IGlucHV0czogW3sgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdUSU1FJyB9XSwgb3V0cHV0czogW3sgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnRElOVCcgIH1dIH0sXG4gIERJTlRfVE9fVElNRTogeyBpbnB1dHM6IFt7IG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnRElOVCcgfV0sIG91dHB1dHM6IFt7IG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ1RJTUUnICB9XSB9LFxufTtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFB1YmxpYyBBUEkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbi8qKlxuICogUmV0dXJucyB0aGUgY2Fub25pY2FsIHBpbiBzaWduYXR1cmUgZm9yIGEgYmxvY2sgdHlwZSBuYW1lLlxuICogUmV0dXJucyBudWxsIGlmIHRoZSBibG9jayB0eXBlIGlzIHVua25vd24gKGNhbGxlciBzaG91bGQgZmFsbCBiYWNrIHRvICdCT09MJykuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRCbG9ja1NpZ25hdHVyZShibG9ja1R5cGU6IHN0cmluZyk6IEJsb2NrU2lnbmF0dXJlIHwgbnVsbCB7XG4gIHJldHVybiBTSUdbYmxvY2tUeXBlLnRvVXBwZXJDYXNlKCldID8/IFNJR1tibG9ja1R5cGVdID8/IG51bGw7XG59XG5cbi8qKlxuICogUmV0dXJucyB0aGUgSUVDRGF0YVR5cGUgZm9yIGEgbmFtZWQgaW5wdXQgcGluIG9mIGEga25vd24gYmxvY2sgdHlwZS5cbiAqIEZhbGxzIGJhY2sgdG8gJ0JPT0wnIGZvciBib29sZWFuLWNvbnRleHQgYmxvY2tzLCAnRElOVCcgb3RoZXJ3aXNlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0UGluRGF0YVR5cGUoYmxvY2tUeXBlOiBzdHJpbmcsIHBpbk5hbWU6IHN0cmluZywgZGlyZWN0aW9uOiAnaW5wdXQnIHwgJ291dHB1dCcpOiBJRUNEYXRhVHlwZSB7XG4gIGNvbnN0IHNpZyA9IGdldEJsb2NrU2lnbmF0dXJlKGJsb2NrVHlwZSk7XG4gIGlmICghc2lnKSByZXR1cm4gJ0JPT0wnO1xuICBjb25zdCBsaXN0ID0gZGlyZWN0aW9uID09PSAnaW5wdXQnID8gc2lnLmlucHV0cyA6IHNpZy5vdXRwdXRzO1xuICByZXR1cm4gbGlzdC5maW5kKHAgPT4gcC5uYW1lID09PSBwaW5OYW1lKT8uZGF0YVR5cGUgPz8gbGlzdFswXT8uZGF0YVR5cGUgPz8gJ0JPT0wnO1xufVxuXG4vKipcbiAqIEJ1aWxkcyBhIGZ1bGwgc2V0IG9mIHR5cGVkIFBpbltdIGFycmF5cyBmcm9tIHRoZSBjYW5vbmljYWwgc2lnbmF0dXJlLlxuICogQW55IHBpbiBuYW1lcyBwcmVzZW50IGluIGBjb25uZWN0ZWRQaW5zYCBhcmUgd2lyZWQgd2l0aCBhIHJlc29sdmVkIGRhdGFUeXBlXG4gKiAodGhlIGNhbm9uaWNhbCB0eXBlIHRha2VzIHByaW9yaXR5IG92ZXIgd2hhdGV2ZXIgdGhlIHZlbmRvciBYTUwgc2FpZCkuXG4gKiBNaXNzaW5nIHBpbnMgZ2V0IHRoZSBjYW5vbmljYWwgZGVmYXVsdCB0eXBlIHdpdGggYW4gZW1wdHkgdmFsdWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFR5cGVkUGlucyhcbiAgYmxvY2tUeXBlOiBzdHJpbmcsXG4gIGNvbm5lY3RlZFBpbk5hbWVzOiBzdHJpbmdbXSxcbiAgaWRQcmVmaXg6IHN0cmluZyxcbik6IHsgaW5wdXRzOiB7IGlkOiBzdHJpbmc7IG5hbWU6IHN0cmluZzsgZGF0YVR5cGU6IElFQ0RhdGFUeXBlOyBuZWdhdGVkPzogYm9vbGVhbiB9W107XG4gICAgb3V0cHV0czogeyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmc7IGRhdGFUeXBlOiBJRUNEYXRhVHlwZTsgbmVnYXRlZD86IGJvb2xlYW4gfVtdIH0ge1xuICBjb25zdCBzaWcgPSBnZXRCbG9ja1NpZ25hdHVyZShibG9ja1R5cGUpO1xuICBpZiAoIXNpZykge1xuICAgIC8vIFVua25vd24gYmxvY2sgdHlwZSBcdTIwMTQgcmV0dXJuIGFsbCBjb25uZWN0ZWQgcGlucyBhcyBCT09MIGlucHV0cy9vdXRwdXRzXG4gICAgY29uc3QgcGlucyA9IGNvbm5lY3RlZFBpbk5hbWVzLm1hcCgobiwgaSkgPT4gKHsgaWQ6IGAke2lkUHJlZml4fS1waW4tJHtpfWAsIG5hbWU6IG4sIGRhdGFUeXBlOiAnQk9PTCcgYXMgSUVDRGF0YVR5cGUgfSkpO1xuICAgIHJldHVybiB7IGlucHV0czogcGlucywgb3V0cHV0czogW10gfTtcbiAgfVxuXG4gIGNvbnN0IGlucHV0cyA9IHNpZy5pbnB1dHMubWFwKChwZCwgaSkgPT4gKHtcbiAgICBpZDogYCR7aWRQcmVmaXh9LWluLSR7cGQubmFtZX0tJHtpfWAsXG4gICAgbmFtZTogcGQubmFtZSxcbiAgICBkYXRhVHlwZTogcGQuZGF0YVR5cGUsXG4gIH0pKTtcbiAgY29uc3Qgb3V0cHV0cyA9IHNpZy5vdXRwdXRzLm1hcCgocGQsIGkpID0+ICh7XG4gICAgaWQ6IGAke2lkUHJlZml4fS1vdXQtJHtwZC5uYW1lfS0ke2l9YCxcbiAgICBuYW1lOiBwZC5uYW1lLFxuICAgIGRhdGFUeXBlOiBwZC5kYXRhVHlwZSxcbiAgfSkpO1xuICByZXR1cm4geyBpbnB1dHMsIG91dHB1dHMgfTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHR5cGVkIFRhZ1JlZiBwaW5zIChmb3IgTEQgQmxvY2tFbGVtZW50LnBpbnMpIGZyb20gdGhlIGNhbm9uaWNhbCBzaWduYXR1cmUuXG4gKiBgcmVzb2x2ZWRWYWx1ZXNgIG1hcHMgcGluIG5hbWUgXHUyMTkyIGNvbm5lY3RlZCB2YXJpYWJsZSBuYW1lIChmcm9tIHRoZSB2ZW5kb3IgWE1MKS5cbiAqIEFueSBwaW4gbm90IHByZXNlbnQgaW4gcmVzb2x2ZWRWYWx1ZXMga2VlcHMgaXRzIGNhbm9uaWNhbCB0eXBlIGJ1dCBnZXRzIG5hbWUgPSAnJy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkVHlwZWRUYWdSZWZQaW5zKFxuICBibG9ja1R5cGU6IHN0cmluZyxcbiAgcmVzb2x2ZWRWYWx1ZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sXG4pOiBSZWNvcmQ8c3RyaW5nLCB7IG5hbWU6IHN0cmluZzsgZGF0YVR5cGU6IElFQ0RhdGFUeXBlIH0+IHtcbiAgY29uc3Qgc2lnID0gZ2V0QmxvY2tTaWduYXR1cmUoYmxvY2tUeXBlKTtcbiAgaWYgKCFzaWcpIHtcbiAgICAvLyBVbmtub3duIFx1MjAxNCBwYXNzIHRocm91Z2ggd2hhdGV2ZXIgd2FzIHJlc29sdmVkLCBkZWZhdWx0IHRvIEJPT0xcbiAgICByZXR1cm4gT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgICAgT2JqZWN0LmVudHJpZXMocmVzb2x2ZWRWYWx1ZXMpLm1hcCgoW2ssIHZdKSA9PiBbaywgeyBuYW1lOiB2LCBkYXRhVHlwZTogJ0JPT0wnIGFzIElFQ0RhdGFUeXBlIH1dKVxuICAgICk7XG4gIH1cblxuICBjb25zdCByZXN1bHQ6IFJlY29yZDxzdHJpbmcsIHsgbmFtZTogc3RyaW5nOyBkYXRhVHlwZTogSUVDRGF0YVR5cGUgfT4gPSB7fTtcbiAgZm9yIChjb25zdCBwZCBvZiBbLi4uc2lnLmlucHV0cywgLi4uc2lnLm91dHB1dHNdKSB7XG4gICAgcmVzdWx0W3BkLm5hbWVdID0ge1xuICAgICAgbmFtZTogcmVzb2x2ZWRWYWx1ZXNbcGQubmFtZV0gPz8gJycsXG4gICAgICBkYXRhVHlwZTogcGQuZGF0YVR5cGUsXG4gICAgfTtcbiAgfVxuICAvLyBBbHNvIGluY2x1ZGUgYW55IGV4dHJhIHBpbnMgZnJvbSB0aGUgdmVuZG9yIFhNTCB0aGF0IHRoZSBzaWduYXR1cmUgZG9lc24ndCBjb3ZlclxuICBmb3IgKGNvbnN0IFtrLCB2XSBvZiBPYmplY3QuZW50cmllcyhyZXNvbHZlZFZhbHVlcykpIHtcbiAgICBpZiAoIShrIGluIHJlc3VsdCkpIHtcbiAgICAgIHJlc3VsdFtrXSA9IHsgbmFtZTogdiwgZGF0YVR5cGU6ICdCT09MJyB9O1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBNkJBLE1BQU0sTUFBc0M7QUFBQTtBQUFBLEVBRzFDLEtBQUs7QUFBQSxJQUNILFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzVFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sS0FBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzlFO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUM1RSxTQUFTLENBQUMsRUFBRSxNQUFNLEtBQU0sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM5RTtBQUFBLEVBQ0EsSUFBSTtBQUFBLElBQ0YsUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDNUUsU0FBUyxDQUFDLEVBQUUsTUFBTSxLQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDOUU7QUFBQTtBQUFBLEVBRUEsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDNUUsU0FBUyxDQUFDLEVBQUUsTUFBTSxLQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDOUU7QUFBQTtBQUFBLEVBR0EsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxLQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsTUFBTSxDQUFDO0FBQUEsSUFDN0csU0FBUyxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsTUFBTSxDQUFDO0FBQUEsRUFDN0U7QUFBQSxFQUNBLEtBQUs7QUFBQSxJQUNILFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE1BQU0sQ0FBQztBQUFBLElBQzdHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE1BQU0sQ0FBQztBQUFBLEVBQzdFO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDSixRQUFTO0FBQUEsTUFDUCxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU87QUFBQSxNQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTztBQUFBLE1BQ2pFLEVBQUUsTUFBTSxLQUFNLFVBQVUsT0FBTztBQUFBLE1BQUcsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPO0FBQUEsTUFDakUsRUFBRSxNQUFNLE1BQU0sVUFBVSxNQUFNO0FBQUEsSUFDaEM7QUFBQSxJQUNBLFNBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE1BQU0sQ0FBQztBQUFBLEVBQy9HO0FBQUE7QUFBQSxFQUdBLElBQUk7QUFBQSxJQUNGLFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sS0FBTSxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzVFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzVDO0FBQUEsRUFDQSxJQUFJO0FBQUEsSUFDRixRQUFTLENBQUMsRUFBRSxNQUFNLEtBQU0sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUM1RSxTQUFTLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM1QztBQUFBO0FBQUEsRUFHQSxPQUFPO0FBQUEsSUFDTCxRQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUMzQyxTQUFTLENBQUMsRUFBRSxNQUFNLEtBQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDM0MsU0FBUyxDQUFDLEVBQUUsTUFBTSxLQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQTtBQUFBLEVBRUEsUUFBUTtBQUFBLElBQ04sUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDM0MsU0FBUyxDQUFDLEVBQUUsTUFBTSxLQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLFFBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzNDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sS0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUE7QUFBQSxFQUdBLEtBQUs7QUFBQSxJQUNILFFBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzlFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxJQUFJO0FBQUEsSUFDRixRQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUM5RSxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDOUUsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLEtBQUs7QUFBQSxJQUNILFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzNDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDSixRQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUM5RSxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDOUUsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQTtBQUFBLEVBR0EsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDOUUsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLEtBQUs7QUFBQSxJQUNILFFBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzlFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxRQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUM5RSxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDOUUsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLEtBQUs7QUFBQSxJQUNILFFBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzlFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUMzQyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsTUFBTTtBQUFBLElBQ0osUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDM0MsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLEtBQUs7QUFBQSxJQUNILFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzNDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUE7QUFBQSxFQUdBLElBQUk7QUFBQSxJQUNGLFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzNDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUMzQyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDM0MsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLEtBQUs7QUFBQSxJQUNILFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzNDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUMzQyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDM0MsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLE1BQU07QUFBQSxJQUNKLFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzNDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDSixRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUMzQyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsTUFBTTtBQUFBLElBQ0osUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDM0MsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQTtBQUFBLEVBRUEsS0FBTSxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQyxFQUFFO0FBQUEsRUFDakcsS0FBTSxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQyxFQUFFO0FBQUEsRUFDakcsS0FBTSxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQyxFQUFFO0FBQUEsRUFDakcsS0FBTSxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQyxFQUFFO0FBQUEsRUFDakcsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxVQUFVLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxZQUFZLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDdEYsU0FBUyxDQUFDLEVBQUUsTUFBTSxRQUFVLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDaEQ7QUFBQTtBQUFBLEVBR0EsSUFBSTtBQUFBLElBQ0YsUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDOUUsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLElBQUk7QUFBQSxJQUNGLFFBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzlFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxJQUFJO0FBQUEsSUFDRixRQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUM5RSxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsSUFBSTtBQUFBLElBQ0YsUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDOUUsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLElBQUk7QUFBQSxJQUNGLFFBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzlFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxJQUFJO0FBQUEsSUFDRixRQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUM5RSxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBO0FBQUEsRUFHQSxNQUFNO0FBQUEsSUFDSixRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUMzQyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxLQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDakgsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLEtBQUs7QUFBQSxJQUNILFFBQVMsQ0FBQyxFQUFFLE1BQU0sS0FBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQ2pILFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU8sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE1BQU8sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUNoSCxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsS0FBSztBQUFBLElBQ0gsUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDOUUsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLEtBQUs7QUFBQSxJQUNILFFBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzlFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUE7QUFBQSxFQUdBLEtBQUs7QUFBQSxJQUNILFFBQVMsQ0FBQyxFQUFFLE1BQU0sVUFBVSxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzlDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sUUFBVSxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQ2hEO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxRQUFTLENBQUMsRUFBRSxNQUFNLFVBQVUsVUFBVSxPQUFPLEdBQUcsRUFB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QyxFQUFFLE1BQU0sWUFBWSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sUUFBUSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sYUFBYSxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzdILFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBWSxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQ2xEO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxRQUFTLENBQUMsRUFBRSxNQUFNLFVBQVUsVUFBVSxRQUFRLEdBQUcsRUFBRSxNQUFNLFFBQVEsVUFBVSxRQUFRLEdBQUcsRUFBRSxNQUFNLFdBQVcsVUFBVSxRQUFRLENBQUM7QUFBQSxJQUM1SCxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQVUsVUFBVSxPQUFPLENBQUM7QUFBQSxFQUNoRDtBQUFBO0FBQUEsRUFHQSxPQUFPO0FBQUEsSUFDTCxRQUFTLENBQUMsRUFBRSxNQUFNLFVBQVUsVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLGFBQWEsVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLFlBQVksVUFBVSxPQUFPLENBQUM7QUFBQSxJQUMvSCxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQVUsVUFBVSxPQUFPLENBQUM7QUFBQSxFQUNoRDtBQUFBLEVBQ0EsTUFBTTtBQUFBLElBQ0osUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxLQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDOUcsU0FBUyxDQUFDLEVBQUUsTUFBTSxLQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDOUU7QUFBQSxFQUNBLFdBQVc7QUFBQSxJQUNULFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzVFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sS0FBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzlFO0FBQUEsRUFDQSxZQUFZO0FBQUEsSUFDVixRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUM1RSxTQUFTLENBQUMsRUFBRSxNQUFNLEtBQU0sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM5RTtBQUFBLEVBQ0EsYUFBYTtBQUFBLElBQ1gsUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxLQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsTUFBTSxDQUFDO0FBQUEsSUFDN0csU0FBUyxDQUFDLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsTUFBTSxDQUFDO0FBQUEsRUFDN0U7QUFBQSxFQUNBLGNBQWM7QUFBQSxJQUNaLFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sS0FBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE1BQU0sQ0FBQztBQUFBLElBQzdHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE1BQU0sQ0FBQztBQUFBLEVBQzdFO0FBQUE7QUFBQSxFQUdBLE9BQU87QUFBQSxJQUNMLFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTSxVQUFVLE1BQU0sR0FBRyxFQUFFLE1BQU0sVUFBVSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sVUFBVSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sV0FBVyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzVKLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sV0FBVyxVQUFVLE1BQU0sQ0FBQztBQUFBLEVBQ25GO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLFVBQVUsVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLFVBQVUsVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLFdBQVcsVUFBVSxPQUFPLENBQUM7QUFBQSxJQUM3SixTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxNQUFNLEdBQUcsRUFBRSxNQUFNLFdBQVcsVUFBVSxNQUFNLENBQUM7QUFBQSxFQUNsRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxTQUFTLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDbkgsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLFFBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sU0FBUyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQ25ILFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUE7QUFBQSxFQUdBLE9BQVMsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLEtBQU8sVUFBVSxTQUFTLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLFdBQVcsVUFBVSxNQUFNLENBQUMsRUFBRTtBQUFBLEVBQzFHLFFBQVMsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLEtBQU8sVUFBVSxTQUFTLEdBQUcsRUFBRSxNQUFNLEtBQUssVUFBVSxNQUFNLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLFdBQVcsVUFBVSxTQUFTLENBQUMsRUFBRTtBQUFBLEVBQzdJLFNBQVMsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLEtBQU8sVUFBVSxTQUFTLEdBQUcsRUFBRSxNQUFNLEtBQUssVUFBVSxNQUFNLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLFdBQVcsVUFBVSxTQUFTLENBQUMsRUFBRTtBQUFBLEVBQzdJLE9BQVMsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLEtBQU8sVUFBVSxTQUFTLEdBQUcsRUFBRSxNQUFNLEtBQUssVUFBVSxNQUFNLEdBQUcsRUFBRSxNQUFNLEtBQUssVUFBVSxNQUFNLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLFdBQVcsVUFBVSxTQUFTLENBQUMsRUFBRTtBQUFBLEVBQzdLLFFBQVMsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxTQUFTLEdBQUcsRUFBRSxNQUFNLE9BQU8sVUFBVSxTQUFTLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLFdBQVcsVUFBVSxNQUFNLENBQUMsRUFBRTtBQUFBLEVBQy9JLFFBQVMsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLE1BQU8sVUFBVSxPQUFTLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxTQUFTLENBQUMsRUFBRTtBQUFBLEVBQ3pHLFVBQVMsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxTQUFTLEdBQUcsRUFBRSxNQUFNLE9BQU8sVUFBVSxTQUFTLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxTQUFTLENBQUMsRUFBRTtBQUFBO0FBQUEsRUFHOUksU0FBUztBQUFBLElBQ1AsUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDM0MsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzNDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFTLENBQUMsRUFBRSxNQUFNLE1BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxJQUMzQyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFBQSxFQUM3QztBQUFBLEVBQ0EsTUFBTTtBQUFBLElBQ0osUUFBUyxDQUFDLEVBQUUsTUFBTSxNQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDM0MsU0FBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVMsQ0FBQyxFQUFFLE1BQU0sTUFBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzNDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQzdDO0FBQUE7QUFBQSxFQUdBLE1BQU07QUFBQSxJQUNKLFFBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sUUFBUSxVQUFVLFNBQVMsQ0FBQztBQUFBLElBQ25ILFNBQVMsQ0FBQyxFQUFFLE1BQU0sUUFBUSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sU0FBUyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sVUFBVSxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQ3pIO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDSixRQUFTLENBQUMsRUFBRSxNQUFNLFFBQVEsVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLFFBQVEsVUFBVSxTQUFTLENBQUM7QUFBQSxJQUNwSCxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLFNBQVMsVUFBVSxPQUFPLEdBQUcsRUFBRSxNQUFNLFVBQVUsVUFBVSxPQUFPLENBQUM7QUFBQSxFQUN4SDtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUyxDQUFDLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxTQUFTLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxRQUFRLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDdEosU0FBUyxDQUFDLEVBQUUsTUFBTSxTQUFTLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxRQUFRLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxTQUFTLFVBQVUsT0FBTyxHQUFHLEVBQUUsTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFDM0o7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVMsQ0FBQyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sU0FBUyxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQ3JKLFNBQVMsQ0FBQyxFQUFFLE1BQU0sUUFBUSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sUUFBUSxVQUFVLE9BQU8sR0FBRyxFQUFFLE1BQU0sU0FBUyxVQUFVLE9BQU8sQ0FBQztBQUFBLEVBQ3ZIO0FBQUE7QUFBQSxFQUdBLGFBQWMsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxNQUFPLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFRLENBQUMsRUFBRTtBQUFBLEVBQzFHLGFBQWMsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxNQUFRLENBQUMsRUFBRTtBQUFBLEVBQzFHLGNBQWMsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFRLENBQUMsRUFBRTtBQUFBLEVBQzFHLGNBQWMsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFRLENBQUMsRUFBRTtBQUFBLEVBQzFHLGFBQWMsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxNQUFPLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFRLENBQUMsRUFBRTtBQUFBLEVBQzFHLGFBQWMsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxNQUFRLENBQUMsRUFBRTtBQUFBLEVBQzFHLGFBQWMsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxNQUFPLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFRLENBQUMsRUFBRTtBQUFBLEVBQzFHLGFBQWMsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxNQUFRLENBQUMsRUFBRTtBQUFBLEVBQzFHLGFBQWMsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxNQUFPLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFRLENBQUMsRUFBRTtBQUFBLEVBQzFHLGVBQWMsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxRQUFPLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sVUFBVSxPQUFRLENBQUMsRUFBRTtBQUFBLEVBQzFHLGVBQWMsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPLENBQUMsR0FBRyxTQUFT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
