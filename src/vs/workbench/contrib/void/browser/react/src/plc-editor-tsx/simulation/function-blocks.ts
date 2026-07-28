import { FBInstanceState, FBContext } from './types.js';

function makeState(type: string, partial?: Partial<FBInstanceState>): FBInstanceState {
  return { type, prevInputs: {}, outputs: {}, internal: {}, ...partial };
}

function risingEdge(current: boolean, prev: boolean | undefined): boolean {
  return current === true && prev !== true;
}

function fallingEdge(current: boolean, prev: boolean | undefined): boolean {
  return current === false && prev !== false;
}

function parseTIME(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const m = val.match(/T#(\d+)(ms|s|m|h)/i);
    if (m) {
      const n = parseInt(m[1], 10);
      switch (m[2].toLowerCase()) {
        case 'ms': return n;
        case 's': return n * 1000;
        case 'm': return n * 60000;
        case 'h': return n * 3600000;
      }
    }
    const num = parseFloat(val);
    if (!isNaN(num)) return num;
  }
  return 0;
}

function toBool(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'TRUE' || v === '1' || v === 'true';
  return !!v;
}

function toInt(v: any): number {
  if (typeof v === 'number') return Math.trunc(v);
  return parseInt(String(v), 10) || 0;
}

export function executeFB(
  type: string,
  inputs: Record<string, any>,
  state: FBInstanceState | undefined,
  ctx: FBContext
): { outputs: Record<string, any>; state: FBInstanceState } {
  if (!state) state = makeState(type);

  switch (type) {
    case 'TON': return execTON(inputs, state, ctx);
    case 'TOF': return execTOF(inputs, state, ctx);
    case 'TP': return execTP(inputs, state, ctx);
    case 'CTU': return execCTU(inputs, state, ctx);
    case 'CTD': return execCTD(inputs, state, ctx);
    case 'CTUD': return execCTUD(inputs, state, ctx);
    case 'SR': return execSR(inputs, state);
    case 'RS': return execRS(inputs, state);
    case 'RTRIG':
    case 'R_TRIG': return execRTRIG(inputs, state);
    case 'FTRIG':
    case 'F_TRIG': return execFTRIG(inputs, state);
    default:
      return { outputs: state.outputs, state };
  }
}

function execTON(inputs: Record<string, any>, state: FBInstanceState, ctx: FBContext) {
  const IN = toBool(inputs.IN);
  const PT = parseTIME(inputs.PT);
  let ET = (state.internal.ET as number) || 0;
  let Q = false;

  if (IN) {
    ET += ctx.dt;
    if (ET >= PT) {
      ET = PT;
      Q = true;
    }
  } else {
    ET = 0;
    Q = false;
  }

  const newState: FBInstanceState = {
    ...state,
    prevInputs: { IN },
    outputs: { Q, ET },
    internal: { ET },
  };
  return { outputs: { Q, ET }, state: newState };
}

function execTOF(inputs: Record<string, any>, state: FBInstanceState, ctx: FBContext) {
  const IN = toBool(inputs.IN);
  const PT = parseTIME(inputs.PT);
  let ET = (state.internal.ET as number) || 0;
  let Q: boolean;

  if (IN) {
    Q = true;
    ET = 0;
  } else {
    if (toBool(state.prevInputs.IN)) {
      // Falling edge — start timing
      ET = 0;
    }
    ET += ctx.dt;
    Q = ET < PT;
    if (ET >= PT) ET = PT;
  }

  const newState: FBInstanceState = {
    ...state,
    prevInputs: { IN },
    outputs: { Q, ET },
    internal: { ET },
  };
  return { outputs: { Q, ET }, state: newState };
}

function execTP(inputs: Record<string, any>, state: FBInstanceState, ctx: FBContext) {
  const IN = toBool(inputs.IN);
  const PT = parseTIME(inputs.PT);
  let ET = (state.internal.ET as number) || 0;
  let running = (state.internal.running as boolean) || false;
  let Q: boolean;

  if (risingEdge(IN, toBool(state.prevInputs.IN)) && !running) {
    running = true;
    ET = 0;
  }

  if (running) {
    ET += ctx.dt;
    if (ET >= PT) {
      ET = PT;
      running = false;
    }
    Q = true;
  } else {
    Q = false;
    if (!IN) ET = 0;
  }

  const newState: FBInstanceState = {
    ...state,
    prevInputs: { IN },
    outputs: { Q, ET },
    internal: { ET, running },
  };
  return { outputs: { Q, ET }, state: newState };
}

function execCTU(inputs: Record<string, any>, state: FBInstanceState, _ctx: FBContext) {
  const CU = toBool(inputs.CU);
  const RESET = toBool(inputs.RESET || inputs.R);
  const PV = toInt(inputs.PV);
  let CV = (state.internal.CV as number) ?? 0;

  if (RESET) {
    CV = 0;
  } else if (risingEdge(CU, toBool(state.prevInputs.CU))) {
    CV++;
  }

  const Q = CV >= PV;
  const newState: FBInstanceState = {
    ...state,
    prevInputs: { CU, RESET },
    outputs: { Q, CV },
    internal: { CV },
  };
  return { outputs: { Q, CV }, state: newState };
}

function execCTD(inputs: Record<string, any>, state: FBInstanceState, _ctx: FBContext) {
  const CD = toBool(inputs.CD);
  const LOAD = toBool(inputs.LOAD || inputs.LD);
  const PV = toInt(inputs.PV);
  let CV = (state.internal.CV as number) ?? PV;

  if (LOAD) {
    CV = PV;
  } else if (risingEdge(CD, toBool(state.prevInputs.CD))) {
    CV--;
  }

  const Q = CV <= 0;
  const newState: FBInstanceState = {
    ...state,
    prevInputs: { CD, LOAD },
    outputs: { Q, CV },
    internal: { CV },
  };
  return { outputs: { Q, CV }, state: newState };
}

function execCTUD(inputs: Record<string, any>, state: FBInstanceState, _ctx: FBContext) {
  const CU = toBool(inputs.CU);
  const CD = toBool(inputs.CD);
  const RESET = toBool(inputs.RESET || inputs.R);
  const LOAD = toBool(inputs.LOAD || inputs.LD);
  const PV = toInt(inputs.PV);
  let CV = (state.internal.CV as number) ?? 0;

  if (RESET) {
    CV = 0;
  } else if (LOAD) {
    CV = PV;
  } else {
    if (risingEdge(CU, toBool(state.prevInputs.CU))) CV++;
    if (risingEdge(CD, toBool(state.prevInputs.CD))) CV--;
  }

  const QU = CV >= PV;
  const QD = CV <= 0;
  const newState: FBInstanceState = {
    ...state,
    prevInputs: { CU, CD, RESET, LOAD },
    outputs: { QU, QD, CV },
    internal: { CV },
  };
  return { outputs: { QU, QD, CV }, state: newState };
}

function execSR(inputs: Record<string, any>, state: FBInstanceState) {
  const S1 = toBool(inputs.S1 || inputs.S);
  const R = toBool(inputs.R);
  const prevQ = toBool(state.outputs.Q1 ?? state.outputs.Q);
  const Q1 = S1 || (!R && prevQ);

  const newState: FBInstanceState = {
    ...state,
    prevInputs: { S1, R },
    outputs: { Q1 },
    internal: {},
  };
  return { outputs: { Q1 }, state: newState };
}

function execRS(inputs: Record<string, any>, state: FBInstanceState) {
  const S = toBool(inputs.S);
  const R1 = toBool(inputs.R1 || inputs.R);
  const prevQ = toBool(state.outputs.Q1 ?? state.outputs.Q);
  const Q1 = !R1 && (S || prevQ);

  const newState: FBInstanceState = {
    ...state,
    prevInputs: { S, R1 },
    outputs: { Q1 },
    internal: {},
  };
  return { outputs: { Q1 }, state: newState };
}

function execRTRIG(inputs: Record<string, any>, state: FBInstanceState) {
  const CLK = toBool(inputs.CLK);
  const Q = risingEdge(CLK, toBool(state.prevInputs.CLK));

  const newState: FBInstanceState = {
    ...state,
    prevInputs: { CLK },
    outputs: { Q },
    internal: {},
  };
  return { outputs: { Q }, state: newState };
}

function execFTRIG(inputs: Record<string, any>, state: FBInstanceState) {
  const CLK = toBool(inputs.CLK);
  const Q = fallingEdge(CLK, toBool(state.prevInputs.CLK));

  const newState: FBInstanceState = {
    ...state,
    prevInputs: { CLK },
    outputs: { Q },
    internal: {},
  };
  return { outputs: { Q }, state: newState };
}
