const IEC_STDLIB_STUBS = `
FUNCTION_BLOCK TON
  VAR_INPUT IN : BOOL; PT : TIME; END_VAR
  VAR_OUTPUT Q : BOOL; ET : TIME; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK TOF
  VAR_INPUT IN : BOOL; PT : TIME; END_VAR
  VAR_OUTPUT Q : BOOL; ET : TIME; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK TP
  VAR_INPUT IN : BOOL; PT : TIME; END_VAR
  VAR_OUTPUT Q : BOOL; ET : TIME; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTU
  VAR_INPUT CU : BOOL; R : BOOL; PV : INT; END_VAR
  VAR_OUTPUT Q : BOOL; CV : INT; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTD
  VAR_INPUT CD : BOOL; LD : BOOL; PV : INT; END_VAR
  VAR_OUTPUT Q : BOOL; CV : INT; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTUD
  VAR_INPUT CU : BOOL; CD : BOOL; R : BOOL; LD : BOOL; PV : INT; END_VAR
  VAR_OUTPUT QU : BOOL; QD : BOOL; CV : INT; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK SR
  VAR_INPUT S1 : BOOL; R : BOOL; END_VAR
  VAR_OUTPUT Q1 : BOOL; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK RS
  VAR_INPUT S : BOOL; R1 : BOOL; END_VAR
  VAR_OUTPUT Q1 : BOOL; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK RTRIG
  VAR_INPUT CLK : BOOL; END_VAR
  VAR_OUTPUT Q : BOOL; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK FTRIG
  VAR_INPUT CLK : BOOL; END_VAR
  VAR_OUTPUT Q : BOOL; END_VAR
END_FUNCTION_BLOCK
`;
function clmToST(clm, cycleMs = 50) {
  const warnings = [];
  const tagIds = clm.getNodesByType("TAG");
  const tags = tagIds.map((id) => ({
    id,
    data: clm.getNodeData(id)
  }));
  const varLines = [];
  const varRetainLines = [];
  for (const { data } of tags) {
    const initClause = data.initialValue ? ` := ${data.initialValue}` : defaultInitFor(data.dataType);
    const decl = `    ${sanitizeName(data.name)} : ${data.dataType}${initClause};`;
    if (data.retain) {
      varRetainLines.push(decl);
    } else {
      varLines.push(decl);
    }
  }
  const ldLines = [];
  const rungIds = clm.getNodesByType("RUNG");
  rungIds.sort((a, b) => {
    const ra = clm.getNodeData(a).rungNumber;
    const rb = clm.getNodeData(b).rungNumber;
    return ra - rb;
  });
  for (const rungId of rungIds) {
    const rungData = clm.getNodeData(rungId);
    if (rungData.comment) {
      ldLines.push(`  (* Rung ${rungData.rungNumber}: ${rungData.comment} *)`);
    }
    const elementIds = clm.getChildren(rungId);
    const elements = elementIds.map((id) => ({
      id,
      attr: clm.getNodeAttr(id),
      data: clm.getNodeData(id)
    })).filter((e) => e.attr.type === "LD_ELEMENT");
    const mainRail = elements.filter((e) => !e.data.branchId);
    const branchGroups = groupByBranchId(elements.filter((e) => !!e.data.branchId));
    const rungST = compileRungToST(clm, rungId, mainRail, branchGroups, warnings);
    ldLines.push(...rungST);
    ldLines.push("");
  }
  const fbdLines = [];
  const fbdBlockIds = clm.getNodesByType("FBD_BLOCK");
  for (const blockId of fbdBlockIds) {
    const blockData = clm.getNodeData(blockId);
    const fbdST = compileFBDBlockToST(clm, blockId, blockData, warnings);
    fbdLines.push(...fbdST);
  }
  const sfcLines = [];
  const sfcStepIds = clm.getNodesByType("SFC_STEP");
  if (sfcStepIds.length > 0) {
    sfcLines.push(...compileSFCToST(clm, sfcStepIds, warnings));
  }
  const programName = "prog0";
  const bodyLines = [...ldLines, ...fbdLines, ...sfcLines];
  const fbVarLines = collectFBInstanceVars(clm);
  const parts = [];
  parts.push(`PROGRAM ${programName}`);
  if (varLines.length > 0 || fbVarLines.length > 0) {
    parts.push("  VAR");
    parts.push(...varLines);
    parts.push(...fbVarLines);
    parts.push("  END_VAR");
  }
  if (varRetainLines.length > 0) {
    parts.push("  VAR_RETAIN");
    parts.push(...varRetainLines);
    parts.push("  END_VAR");
  }
  if (bodyLines.length > 0) {
    parts.push("");
    parts.push(...bodyLines);
  }
  parts.push(`END_PROGRAM`);
  parts.push("");
  parts.push("CONFIGURATION Config0");
  parts.push("");
  parts.push("  RESOURCE Res0 ON PLC");
  parts.push(`    TASK Main(INTERVAL := T#${cycleMs}ms, PRIORITY := 0);`);
  parts.push(`    PROGRAM Inst0 WITH Main : ${programName};`);
  parts.push("  END_RESOURCE");
  parts.push("");
  parts.push("END_CONFIGURATION");
  const stCode = parts.join("\n");
  const needsStubs = fbVarLines.length > 0;
  const stCodeForStrucpp = needsStubs ? IEC_STDLIB_STUBS.trim() + "\n\n" + stCode : stCode;
  return {
    stCode,
    stCodeForStrucpp,
    programName,
    tagCount: tags.length,
    rungCount: rungIds.length,
    warnings
  };
}
function resolveTagDebugLeaf(debugMap, tagName) {
  const needle = `INST0.${tagName.toUpperCase()}`;
  return debugMap.leaves.find((l) => l.path === needle);
}
function buildTagIndexMap(debugMap) {
  const result = /* @__PURE__ */ new Map();
  for (const leaf of debugMap.leaves) {
    const dotIdx = leaf.path.indexOf(".");
    if (dotIdx === -1) continue;
    const varName = leaf.path.slice(dotIdx + 1);
    result.set(varName, leaf.elemIdx);
  }
  return result;
}
function groupByBranchId(elements) {
  const groups = /* @__PURE__ */ new Map();
  for (const el of elements) {
    const bid = el.data.branchId;
    if (!groups.has(bid)) groups.set(bid, []);
    groups.get(bid).push(el);
  }
  return groups;
}
function compileRungToST(clm, _rungId, mainRail, branchGroups, warnings) {
  const contacts = mainRail.filter((e) => isContactKind(e.data.elementKind));
  const outputs = mainRail.filter((e) => !isContactKind(e.data.elementKind));
  if (contacts.length === 0 && outputs.length === 0) return [];
  const mainExpr = contacts.length > 0 ? contacts.map((e) => contactToExpr(clm, e)).join(" AND ") : "";
  const branchExprs = [];
  for (const [, branchEls] of branchGroups) {
    const branchContacts = branchEls.filter((e) => isContactKind(e.data.elementKind));
    if (branchContacts.length > 0) {
      branchExprs.push(`(${branchContacts.map((e) => contactToExpr(clm, e)).join(" AND ")})`);
    }
  }
  let condition;
  if (mainExpr && branchExprs.length > 0) {
    condition = `(${mainExpr}) OR ${branchExprs.join(" OR ")}`;
  } else if (mainExpr) {
    condition = mainExpr;
  } else if (branchExprs.length > 0) {
    condition = branchExprs.join(" OR ");
  } else {
    condition = "TRUE";
  }
  const lines = [];
  if (outputs.length === 0) {
    warnings.push(`Rung has contacts but no output element`);
    return lines;
  }
  for (const output of outputs) {
    const outputLines = outputToST(clm, output, condition, warnings);
    lines.push(...outputLines);
  }
  return lines;
}
function isContactKind(kind) {
  return kind.startsWith("contact_");
}
function contactToExpr(clm, el) {
  const reads = clm.getOutEdgesByType(el.id, "READS");
  const tagName = reads.length > 0 ? sanitizeName(clm.getNodeData(reads[0].target).name) : "_UNKNOWN";
  const kind = el.data.elementKind;
  switch (kind) {
    case "contact_no":
      return tagName;
    case "contact_nc":
      return `NOT ${tagName}`;
    case "contact_p":
      return tagName;
    // positive edge — ST approximation
    case "contact_n":
      return `NOT ${tagName}`;
    // negative edge — ST approximation
    default:
      return tagName;
  }
}
function outputToST(clm, el, condition, warnings) {
  const writes = clm.getOutEdgesByType(el.id, "WRITES");
  const kind = el.data.elementKind;
  if (kind === "fb_call") {
    return compileFBCallInRung(clm, el, condition, warnings);
  }
  if (writes.length === 0) {
    warnings.push(`Coil element ${el.id} has no WRITES edge \u2014 skipped`);
    return [];
  }
  const tagName = sanitizeName(clm.getNodeData(writes[0].target).name);
  switch (kind) {
    case "coil":
      return [`  IF ${condition} THEN ${tagName} := TRUE; ELSE ${tagName} := FALSE; END_IF;`];
    case "coil_negated":
      return [`  IF ${condition} THEN ${tagName} := FALSE; ELSE ${tagName} := TRUE; END_IF;`];
    case "coil_set":
      return [`  IF ${condition} THEN ${tagName} := TRUE; END_IF;`];
    case "coil_reset":
      return [`  IF ${condition} THEN ${tagName} := FALSE; END_IF;`];
    case "coil_latch":
      return [`  IF ${condition} THEN ${tagName} := TRUE; END_IF;`];
    case "coil_unlatch":
      return [`  IF ${condition} THEN ${tagName} := FALSE; END_IF;`];
    default:
      warnings.push(`Unknown coil kind ${kind} \u2014 emitted as normal coil`);
      return [`  IF ${condition} THEN ${tagName} := TRUE; ELSE ${tagName} := FALSE; END_IF;`];
  }
}
function compileFBCallInRung(clm, el, condition, warnings) {
  const instanceName = sanitizeName(el.data.instanceName ?? `_FB_${el.id}`);
  const reads = clm.getOutEdgesByType(el.id, "READS");
  const writes = clm.getOutEdgesByType(el.id, "WRITES");
  const inputParams = [];
  const outputAssignments = [];
  for (const edge of reads) {
    const tagData = clm.getNodeData(edge.target);
    const pinName = edge.data?.pinName ?? sanitizeName(tagData.name);
    inputParams.push(`${pinName} := ${sanitizeName(tagData.name)}`);
  }
  for (const edge of writes) {
    const tagData = clm.getNodeData(edge.target);
    const pinName = edge.data?.pinName ?? sanitizeName(tagData.name);
    outputAssignments.push(`    ${sanitizeName(tagData.name)} := ${instanceName}.${pinName};`);
  }
  const paramStr = inputParams.length > 0 ? `EN := (${condition}), ${inputParams.join(", ")}` : `EN := (${condition})`;
  const lines = [
    `  ${instanceName}(${paramStr});`,
    ...outputAssignments
  ];
  return lines;
}
function compileFBDBlockToST(clm, blockId, blockData, warnings) {
  const btype = blockData.blockType;
  if (btype === "COMMENT" || btype === "CONNECTOR" || btype === "CONTINUATION") return [];
  if (btype === "IN_VARIABLE" || btype === "OUT_VARIABLE" || btype === "INOUT_VARIABLE") return [];
  const isFBInstance = isFunctionBlock(btype);
  if (isFBInstance) {
    const instanceName = sanitizeName(blockData.instanceName ?? `_FB_${blockId}`);
    const { inputParams, outputAssignments } = collectFBDPinParams(clm, blockId, warnings);
    const callLines = [
      `  ${instanceName}(`,
      ...inputParams.map((p, i) => `    ${p}${i < inputParams.length - 1 ? "," : ""}`),
      `  );`
    ];
    return [...callLines, ...outputAssignments];
  }
  return compileFBDCombinatorial(clm, blockId, blockData, warnings);
}
function collectFBDPinParams(clm, blockId, warnings) {
  const pinEdges = clm.getOutEdgesByType(blockId, "HAS_PIN");
  const inputParams = [];
  const outputAssignments = [];
  for (const edge of pinEdges) {
    const pinData = clm.getNodeData(edge.target);
    if (pinData.direction === "in") {
      const inWires = clm.getInEdgesByType(edge.target, "WIRE");
      if (inWires.length === 0) continue;
      const sourcePin = inWires[0].source;
      const parentEdges = clm.getInEdgesByType(sourcePin, "HAS_PIN");
      if (parentEdges.length === 0) continue;
      const parentBlockId = parentEdges[0].source;
      const parentBlockData = clm.getNodeData(parentBlockId);
      if (parentBlockData.blockType === "IN_VARIABLE") {
        const reads = clm.getOutEdgesByType(parentBlockId, "READS");
        if (reads.length > 0) {
          const tagName = sanitizeName(clm.getNodeData(reads[0].target).name);
          inputParams.push(`${pinData.pinName} := ${tagName}`);
        }
      }
    } else if (pinData.direction === "out") {
      const outWires = clm.getOutEdgesByType(edge.target, "WIRE");
      if (outWires.length === 0) continue;
      const targetPin = outWires[0].target;
      const parentEdges = clm.getInEdgesByType(targetPin, "HAS_PIN");
      if (parentEdges.length === 0) continue;
      const targetBlockId = parentEdges[0].source;
      const targetBlockData = clm.getNodeData(targetBlockId);
      if (targetBlockData.blockType === "OUT_VARIABLE") {
        const writes = clm.getOutEdgesByType(targetBlockId, "WRITES");
        if (writes.length > 0) {
          const tagName = sanitizeName(clm.getNodeData(writes[0].target).name);
          const blockData = clm.getNodeData(blockId);
          const instanceName = sanitizeName(blockData.instanceName ?? `_FB_${blockId}`);
          outputAssignments.push(`  ${tagName} := ${instanceName}.${pinData.pinName};`);
        }
      }
    }
  }
  return { inputParams, outputAssignments };
}
const COMBINATOR_OPS = {
  AND: "AND",
  OR: "OR",
  XOR: "XOR",
  NOT: "NOT",
  ADD: "+",
  SUB: "-",
  MUL: "*",
  DIV: "/",
  MOD: "MOD",
  EQ: "=",
  NEQ: "<>",
  GT: ">",
  GEQ: ">=",
  LT: "<",
  LEQ: "<=",
  SEL: "",
  // 2-input select: special case
  MUX: "",
  // multi-input mux: special case
  MOVE: "",
  // pass-through
  MAX: "",
  // standard function call
  MIN: "",
  ABS: "",
  SQRT: "",
  LN: "",
  LOG: "",
  EXP: "",
  SIN: "",
  COS: "",
  TAN: "",
  ASIN: "",
  ACOS: "",
  ATAN: "",
  TRUNC: "",
  EXPT: "",
  LIMIT: ""
};
const FUNCTION_BLOCKS_DIRECT = /* @__PURE__ */ new Set([
  "MAX",
  "MIN",
  "ABS",
  "SQRT",
  "LN",
  "LOG",
  "EXP",
  "SIN",
  "COS",
  "TAN",
  "ASIN",
  "ACOS",
  "ATAN",
  "TRUNC",
  "EXPT",
  "LIMIT",
  "SEL",
  "MUX"
]);
function resolvePinExpr(clm, pinId, _warnings) {
  const inWires = clm.getInEdgesByType(pinId, "WIRE");
  if (inWires.length === 0) {
    const pd = clm.getNodeData(pinId);
    return pd.pinName ?? "FALSE";
  }
  const sourcePinId = inWires[0].source;
  const negated = inWires[0].data?.negated;
  const parentEdges = clm.getInEdgesByType(sourcePinId, "HAS_PIN");
  if (parentEdges.length === 0) return "_wire_src_unknown";
  const parentBlockId = parentEdges[0].source;
  const parentBlock = clm.getNodeData(parentBlockId);
  let expr;
  if (parentBlock.blockType === "IN_VARIABLE") {
    const reads = clm.getOutEdgesByType(parentBlockId, "READS");
    expr = reads.length > 0 ? sanitizeName(clm.getNodeData(reads[0].target).name) : "_in_var_unbound";
  } else if (COMBINATOR_OPS[parentBlock.blockType] !== void 0) {
    expr = buildBlockExpr(clm, parentBlockId, parentBlock, _warnings);
  } else {
    const instanceName = sanitizeName(parentBlock.instanceName ?? `_FB_${parentBlockId}`);
    const sourcePinData = clm.getNodeData(sourcePinId);
    expr = `${instanceName}.${sourcePinData.pinName}`;
  }
  return negated ? `NOT (${expr})` : expr;
}
function buildBlockExpr(clm, blockId, blockData, warnings) {
  const btype = blockData.blockType;
  const pinEdges = clm.getOutEdgesByType(blockId, "HAS_PIN");
  const inPins = pinEdges.map((e) => ({ id: e.target, data: clm.getNodeData(e.target) })).filter((p) => p.data.direction === "in");
  const inputExprs = inPins.map((p) => resolvePinExpr(clm, p.id, warnings));
  if (btype === "NOT") {
    return `NOT (${inputExprs[0] ?? "FALSE"})`;
  }
  if (btype === "MOVE") {
    return inputExprs[0] ?? "FALSE";
  }
  if (FUNCTION_BLOCKS_DIRECT.has(btype)) {
    return `${btype}(${inputExprs.join(", ")})`;
  }
  const op = COMBINATOR_OPS[btype];
  if (op && inputExprs.length >= 2) {
    return inputExprs.map((e) => `(${e})`).join(` ${op} `);
  }
  if (op && inputExprs.length === 1) {
    return inputExprs[0];
  }
  warnings.push(`FBD block ${btype} has unrecognised combinator pattern \u2014 using TRUE`);
  return "TRUE";
}
function compileFBDCombinatorial(clm, blockId, blockData, warnings) {
  const btype = blockData.blockType;
  if (!(btype in COMBINATOR_OPS)) {
    warnings.push(`FBD block type "${btype}" not in combinator table \u2014 skipped`);
    return [`  (* FBD ${btype} ${blockId} \u2014 unknown block type, skipped *)`];
  }
  const pinEdges = clm.getOutEdgesByType(blockId, "HAS_PIN");
  const outPins = pinEdges.map((e) => ({ id: e.target, data: clm.getNodeData(e.target) })).filter((p) => p.data.direction === "out");
  const lines = [];
  for (const outPin of outPins) {
    const outWires = clm.getOutEdgesByType(outPin.id, "WIRE");
    for (const outWire of outWires) {
      const targetPinParents = clm.getInEdgesByType(outWire.target, "HAS_PIN");
      if (targetPinParents.length === 0) continue;
      const targetBlockId = targetPinParents[0].source;
      const targetBlock = clm.getNodeData(targetBlockId);
      if (targetBlock.blockType === "OUT_VARIABLE") {
        const writeEdges = clm.getOutEdgesByType(targetBlockId, "WRITES");
        if (writeEdges.length > 0) {
          const destTag = sanitizeName(clm.getNodeData(writeEdges[0].target).name);
          const expr = buildBlockExpr(clm, blockId, blockData, warnings);
          lines.push(`  ${destTag} := ${expr};`);
        }
      }
    }
  }
  return lines;
}
function compileSFCToST(clm, stepIds, warnings) {
  const steps = stepIds.map((id) => ({
    id,
    data: clm.getNodeData(id)
  }));
  const initialStep = steps.find((s) => s.data.isInitial) ?? steps[0];
  if (!initialStep) return [];
  const lines = [];
  lines.push("  (* SFC encoded as state machine *)");
  const stepIndexMap = /* @__PURE__ */ new Map();
  steps.forEach((s, i) => stepIndexMap.set(s.id, i));
  const initialState = stepIndexMap.get(initialStep.id) ?? 0;
  lines.push(`  IF _SFC_STATE = -1 THEN _SFC_STATE := ${initialState}; END_IF;`);
  lines.push("");
  lines.push("  CASE _SFC_STATE OF");
  for (const step of steps) {
    const stateNum = stepIndexMap.get(step.id);
    lines.push(`    ${stateNum}: (* ${step.data.stepName} *)`);
    const actionEdges = clm.getOutEdgesByType(step.id, "HAS_ACTION");
    for (const edge of actionEdges) {
      const actionData = clm.getNodeData(edge.target);
      const writes = clm.getOutEdgesByType(edge.target, "WRITES");
      const tagName = writes.length > 0 ? sanitizeName(clm.getNodeData(writes[0].target).name) : "_UNKNOWN";
      const actionLines = sfcActionToST(actionData, tagName, "_SFC_STATE", stateNum);
      lines.push(...actionLines);
    }
    const outflows = clm.getOutEdgesByType(step.id, "SFC_FLOW");
    for (const flow of outflows) {
      const targetId = flow.target;
      const targetAttr = clm.getNodeAttr(targetId);
      if (targetAttr.type === "SFC_TRANSITION") {
        const transData = clm.getNodeData(targetId);
        const transOutflows = clm.getOutEdgesByType(targetId, "SFC_FLOW");
        for (const nextFlow of transOutflows) {
          const nextStepId = nextFlow.target;
          const nextState = stepIndexMap.get(nextStepId);
          if (nextState !== void 0) {
            const cond = transData.conditionExpr || "TRUE";
            lines.push(`      IF ${cond} THEN _SFC_STATE := ${nextState}; END_IF;`);
          }
        }
      }
    }
    lines.push("");
  }
  lines.push("  END_CASE;");
  return lines;
}
function sfcActionToST(action, tagName, stepStateVar, stateNum) {
  const dur = action.duration ? `T#${action.duration}` : "T#0ms";
  const timerVar = `_SFC_TMR_${tagName}_${stateNum}`;
  switch (action.qualifier) {
    case "N":
      return [`      ${tagName} := TRUE;   (* N: active while step ${stateNum} is active *)`];
    case "S":
      return [`      ${tagName} := TRUE;   (* S: set - remains latched *)`];
    case "R":
      return [`      ${tagName} := FALSE;  (* R: reset - unlatch *)`];
    case "P":
    case "P1": {
      const edgeVar = `_SFC_P1_${tagName}_${stateNum}`;
      return [
        `      IF NOT ${edgeVar} THEN ${tagName} := TRUE; ${edgeVar} := TRUE; END_IF; (* P1: rising pulse *)`
      ];
    }
    case "P0": {
      const edgeVar = `_SFC_P0_${tagName}_${stateNum}`;
      return [
        `      ${edgeVar} := TRUE; (* P0: falling pulse arm \u2014 fires on exit *)`
      ];
    }
    case "L":
      return [
        `      ${timerVar}(IN := (${stepStateVar} = ${stateNum}), PT := ${dur});`,
        `      IF NOT ${timerVar}.Q THEN ${tagName} := TRUE; ELSE ${tagName} := FALSE; END_IF; (* L: time-limited *)`
      ];
    case "D":
      return [
        `      ${timerVar}(IN := (${stepStateVar} = ${stateNum}), PT := ${dur});`,
        `      ${tagName} := ${timerVar}.Q;   (* D: delayed activation *)`
      ];
    case "SD":
      return [
        `      ${timerVar}(IN := (${stepStateVar} = ${stateNum}), PT := ${dur});`,
        `      IF ${timerVar}.Q THEN ${tagName} := TRUE; END_IF; (* SD: stored-delayed set *)`
      ];
    case "DS":
      return [
        `      ${timerVar}(IN := (${stepStateVar} = ${stateNum}), PT := ${dur});`,
        `      IF ${timerVar}.Q AND (${stepStateVar} = ${stateNum}) THEN ${tagName} := TRUE; END_IF; (* DS: delayed-stored *)`
      ];
    case "SL":
      return [
        `      IF ${stepStateVar} = ${stateNum} THEN ${tagName} := TRUE; END_IF;`,
        `      ${timerVar}(IN := ${tagName}, PT := ${dur});`,
        `      IF ${timerVar}.Q THEN ${tagName} := FALSE; END_IF; (* SL: stored-limited *)`
      ];
    default:
      return [`      ${tagName} := TRUE;   (* ${action.qualifier}: unrecognised qualifier *)`];
  }
}
function collectFBInstanceVars(clm) {
  const vars = [];
  const seen = /* @__PURE__ */ new Set();
  for (const nodeId of clm.getNodesByType("LD_ELEMENT")) {
    const data = clm.getNodeData(nodeId);
    if (data.elementKind === "fb_call" && data.instanceName && data.fbType) {
      const name = sanitizeName(data.instanceName);
      if (!seen.has(name)) {
        seen.add(name);
        vars.push(`    ${name} : ${data.fbType};`);
      }
    }
  }
  for (const nodeId of clm.getNodesByType("FBD_BLOCK")) {
    const data = clm.getNodeData(nodeId);
    if (isFunctionBlock(data.blockType) && data.instanceName) {
      const name = sanitizeName(data.instanceName);
      if (!seen.has(name)) {
        seen.add(name);
        vars.push(`    ${name} : ${data.blockType};`);
      }
    }
  }
  const sfcSteps = clm.getNodesByType("SFC_STEP");
  if (sfcSteps.length > 0) {
    vars.push("    _SFC_STATE : INT := -1;");
    sfcSteps.forEach((stepId, stateNum) => {
      const actionEdges = clm.getOutEdgesByType(stepId, "HAS_ACTION");
      for (const ae of actionEdges) {
        const actionData = clm.getNodeData(ae.target);
        const writes = clm.getOutEdgesByType(ae.target, "WRITES");
        const tagName = writes.length > 0 ? sanitizeName(clm.getNodeData(writes[0].target).name) : "_UNKNOWN";
        const timedQualifiers = /* @__PURE__ */ new Set(["L", "D", "SD", "DS", "SL"]);
        if (timedQualifiers.has(actionData.qualifier)) {
          const timerVar = `_SFC_TMR_${tagName}_${stateNum}`;
          if (!seen.has(timerVar)) {
            seen.add(timerVar);
            vars.push(`    ${timerVar} : TON;`);
          }
        }
        if (actionData.qualifier === "P" || actionData.qualifier === "P1") {
          const edgeVar = `_SFC_P1_${tagName}_${stateNum}`;
          if (!seen.has(edgeVar)) {
            seen.add(edgeVar);
            vars.push(`    ${edgeVar} : BOOL := FALSE;`);
          }
        }
        if (actionData.qualifier === "P0") {
          const edgeVar = `_SFC_P0_${tagName}_${stateNum}`;
          if (!seen.has(edgeVar)) {
            seen.add(edgeVar);
            vars.push(`    ${edgeVar} : BOOL := FALSE;`);
          }
        }
      }
    });
  }
  return vars;
}
function isFunctionBlock(blockType) {
  const FB_TYPES = /* @__PURE__ */ new Set([
    "TON",
    "TOF",
    "TP",
    "CTU",
    "CTD",
    "CTUD",
    "SR",
    "RS",
    "RTRIG",
    "FTRIG"
  ]);
  return FB_TYPES.has(blockType);
}
function sanitizeName(name) {
  return name.replace(/[^A-Za-z0-9_]/g, "_").replace(/^([0-9])/, "_$1");
}
function defaultInitFor(dt) {
  switch (dt) {
    case "BOOL":
      return " := FALSE";
    case "REAL":
    case "LREAL":
      return " := 0.0";
    case "STRING":
    case "WSTRING":
      return " := ''";
    case "TIME":
      return " := T#0ms";
    case "ARRAY_BOOL":
      return "";
    // ARRAY type — initializer syntax depends on dimensions; omit
    case "ARRAY_INT":
      return "";
    case "ARRAY_REAL":
      return "";
    case "STRUCT":
      return " := ()";
    default:
      return " := 0";
  }
}
export {
  buildTagIndexMap,
  clmToST,
  resolveTagDebugLeaf
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjL3BsYy1lZGl0b3ItdHN4L2NsbS9jbG1Ub1NULnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKlxuICogQ0xNIFx1MjE5MiBTVCBDb21waWxlclxuICogVHJhdmVyc2VzIGEgQ0xNR3JhcGggYW5kIGVtaXRzIElFQyA2MTEzMS0zIFN0cnVjdHVyZWQgVGV4dC5cbiAqXG4gKiBPdXRwdXQgY29udHJhY3Q6XG4gKiAgLSBFbWl0cyBvbmUgUFJPR1JBTSBibG9jayBuYW1lZCBcInByb2cwXCIgKG1hdGNoZXMgZW5zdXJlQ29uZmlndXJhdGlvbigpIGluIHNlcnZlci5qcylcbiAqICAtIFZBUiBzZWN0aW9uIGxpc3RzIGV2ZXJ5IFRBRyBub2RlIHJlZmVyZW5jZWQgYnkgdGhlIHByb2dyYW1cbiAqICAtIEdsb2JhbCB0YWdzIHdpdGggYSBoYXJkd2FyZSBhZGRyZXNzIGdldCBBVCBkZWNsYXJhdGlvbnMgKCVJLyVRLyVNKVxuICogIC0gTEQgcnVuZ3MgXHUyMTkyIFNUIElGL0VORF9JRiBsYWRkZXIgc2VtYW50aWNzXG4gKiAgLSBGQkQgYmxvY2tzIFx1MjE5MiBmdW5jdGlvbi1ibG9jayBpbnN0YW5jZSBjYWxscyB3aXRoIG5hbWVkIHBhcmFtZXRlcnNcbiAqICAtIFNGQyBcdTIxOTIgU1QgZW5jb2Rpbmc6IG9uZSBlbnVtZXJhdGVkIHN0YXRlIHZhcmlhYmxlICsgQ0FTRSBzdGF0ZW1lbnRcbiAqICAtIFdyYXBwZWQgaW4gQ09ORklHVVJBVElPTiBDb25maWcwIC8gUkVTT1VSQ0UgUmVzMCBzY2FmZm9sZFxuICpcbiAqIGRlYnVnLW1hcC5qc29uIHBhdGggZm9ybWF0IChjb25maXJtZWQgZnJvbSByZWFsIFNUcnVDKysgb3V0cHV0KTpcbiAqICBcIklOU1QwLjxWQVJOQU1FPlwiIFx1MjAxNCB1cHBlcmNhc2UgaW5zdGFuY2UgbmFtZSAoSW5zdDAgXHUyMTkyIElOU1QwKSwgdXBwZXJjYXNlIHZhciBuYW1lLlxuICogIE1hcHBpbmcgZnJvbSBsb2dpY1N0b3JlIFRhZ0VudHJ5Lm5hbWU6IGRlYnVnTWFwLmxlYXZlcy5maW5kKGwgPT4gbC5wYXRoID09PSBcIklOU1QwLlwiICsgdGFnLm5hbWUudG9VcHBlckNhc2UoKSlcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IENMTUdyYXBoIH0gZnJvbSAnLi9ncmFwaC5qcyc7XG5pbXBvcnQgdHlwZSB7XG4gIFRhZ05vZGVEYXRhLFxuICBQT1VOb2RlRGF0YSxcbiAgUnVuZ05vZGVEYXRhLFxuICBMREVsZW1lbnROb2RlRGF0YSxcbiAgTERFbGVtZW50S2luZCxcbiAgRkJEQmxvY2tOb2RlRGF0YSxcbiAgRkJEUGluTm9kZURhdGEsXG4gIFNGQ1N0ZXBOb2RlRGF0YSxcbiAgU0ZDVHJhbnNpdGlvbk5vZGVEYXRhLFxuICBTRkNBY3Rpb25Ob2RlRGF0YSxcbn0gZnJvbSAnLi9zY2hlbWEuanMnO1xuaW1wb3J0IHR5cGUgeyBJRUNEYXRhVHlwZSB9IGZyb20gJy4uL2xvZ2ljU3RvcmUuanMnO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgSUVDIDYxMTMxLTMgU3RhbmRhcmQgRkIgRGVjbGFyYXRpb25zIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gU1RydUMrKyBkb2VzIG5vdCBoYXZlIGJ1aWx0LWluIHN0YW5kYXJkIGxpYnJhcnkgRkJzIFx1MjAxNCB0aGV5IG11c3QgYmUgZGVjbGFyZWQuXG4vLyBNYXRJRUMgcmVzb2x2ZXMgdGhlc2UgZnJvbSBpdHMgc3RkbGliICgtSSBsaWIpLCBidXQgU1RydUMrKyBpcyBwdXJlIEpTIHdpdGhcbi8vIG5vIGZpbGVzeXN0ZW0gYWNjZXNzIHRvIGllYzJjJ3MgbGliLCBzbyB3ZSBpbmxpbmUgbWluaW1hbCBzdHVicy5cbi8vIFRoZXNlIG1hdGNoIHRoZSBJRUMgNjExMzEtMyBcdTAwQTc2LjYuMyBzdGFuZGFyZCBmdW5jdGlvbiBibG9jayBzaWduYXR1cmVzLlxuXG5jb25zdCBJRUNfU1RETElCX1NUVUJTID0gYFxuRlVOQ1RJT05fQkxPQ0sgVE9OXG4gIFZBUl9JTlBVVCBJTiA6IEJPT0w7IFBUIDogVElNRTsgRU5EX1ZBUlxuICBWQVJfT1VUUFVUIFEgOiBCT09MOyBFVCA6IFRJTUU7IEVORF9WQVJcbkVORF9GVU5DVElPTl9CTE9DS1xuXG5GVU5DVElPTl9CTE9DSyBUT0ZcbiAgVkFSX0lOUFVUIElOIDogQk9PTDsgUFQgOiBUSU1FOyBFTkRfVkFSXG4gIFZBUl9PVVRQVVQgUSA6IEJPT0w7IEVUIDogVElNRTsgRU5EX1ZBUlxuRU5EX0ZVTkNUSU9OX0JMT0NLXG5cbkZVTkNUSU9OX0JMT0NLIFRQXG4gIFZBUl9JTlBVVCBJTiA6IEJPT0w7IFBUIDogVElNRTsgRU5EX1ZBUlxuICBWQVJfT1VUUFVUIFEgOiBCT09MOyBFVCA6IFRJTUU7IEVORF9WQVJcbkVORF9GVU5DVElPTl9CTE9DS1xuXG5GVU5DVElPTl9CTE9DSyBDVFVcbiAgVkFSX0lOUFVUIENVIDogQk9PTDsgUiA6IEJPT0w7IFBWIDogSU5UOyBFTkRfVkFSXG4gIFZBUl9PVVRQVVQgUSA6IEJPT0w7IENWIDogSU5UOyBFTkRfVkFSXG5FTkRfRlVOQ1RJT05fQkxPQ0tcblxuRlVOQ1RJT05fQkxPQ0sgQ1REXG4gIFZBUl9JTlBVVCBDRCA6IEJPT0w7IExEIDogQk9PTDsgUFYgOiBJTlQ7IEVORF9WQVJcbiAgVkFSX09VVFBVVCBRIDogQk9PTDsgQ1YgOiBJTlQ7IEVORF9WQVJcbkVORF9GVU5DVElPTl9CTE9DS1xuXG5GVU5DVElPTl9CTE9DSyBDVFVEXG4gIFZBUl9JTlBVVCBDVSA6IEJPT0w7IENEIDogQk9PTDsgUiA6IEJPT0w7IExEIDogQk9PTDsgUFYgOiBJTlQ7IEVORF9WQVJcbiAgVkFSX09VVFBVVCBRVSA6IEJPT0w7IFFEIDogQk9PTDsgQ1YgOiBJTlQ7IEVORF9WQVJcbkVORF9GVU5DVElPTl9CTE9DS1xuXG5GVU5DVElPTl9CTE9DSyBTUlxuICBWQVJfSU5QVVQgUzEgOiBCT09MOyBSIDogQk9PTDsgRU5EX1ZBUlxuICBWQVJfT1VUUFVUIFExIDogQk9PTDsgRU5EX1ZBUlxuRU5EX0ZVTkNUSU9OX0JMT0NLXG5cbkZVTkNUSU9OX0JMT0NLIFJTXG4gIFZBUl9JTlBVVCBTIDogQk9PTDsgUjEgOiBCT09MOyBFTkRfVkFSXG4gIFZBUl9PVVRQVVQgUTEgOiBCT09MOyBFTkRfVkFSXG5FTkRfRlVOQ1RJT05fQkxPQ0tcblxuRlVOQ1RJT05fQkxPQ0sgUlRSSUdcbiAgVkFSX0lOUFVUIENMSyA6IEJPT0w7IEVORF9WQVJcbiAgVkFSX09VVFBVVCBRIDogQk9PTDsgRU5EX1ZBUlxuRU5EX0ZVTkNUSU9OX0JMT0NLXG5cbkZVTkNUSU9OX0JMT0NLIEZUUklHXG4gIFZBUl9JTlBVVCBDTEsgOiBCT09MOyBFTkRfVkFSXG4gIFZBUl9PVVRQVVQgUSA6IEJPT0w7IEVORF9WQVJcbkVORF9GVU5DVElPTl9CTE9DS1xuYDtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFB1YmxpYyBBUEkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBpbnRlcmZhY2UgU1RDb21waWxlUmVzdWx0IHtcbiAgLyoqIFNUIGNvZGUgZm9yIE1hdElFQyB2YWxpZGF0aW9uIFx1MjAxNCBubyBzdGRsaWIgc3R1YnMgKE1hdElFQyB1c2VzIC1JIGxpYikuICovXG4gIHN0Q29kZTogc3RyaW5nO1xuICAvKiogU1QgY29kZSBmb3IgU1RydUMrKyBjb21waWxlKCkgXHUyMDE0IGluY2x1ZGVzIElFQyBzdGRsaWIgc3R1YnMgKFNUcnVDKysgaXMgcHVyZSBKUywgbm8gZmlsZXN5c3RlbSkuICovXG4gIHN0Q29kZUZvclN0cnVjcHA6IHN0cmluZztcbiAgcHJvZ3JhbU5hbWU6IHN0cmluZztcbiAgdGFnQ291bnQ6IG51bWJlcjtcbiAgcnVuZ0NvdW50OiBudW1iZXI7XG4gIHdhcm5pbmdzOiBzdHJpbmdbXTtcbn1cblxuLyoqXG4gKiBDb21waWxlIGEgQ0xNR3JhcGggdG8gSUVDIDYxMTMxLTMgU3RydWN0dXJlZCBUZXh0LlxuICogUmV0dXJucyB0d28gU1QgdmFyaWFudHM6XG4gKiAgIC0gc3RDb2RlOiBmb3IgTWF0SUVDIChubyBzdHVicyBcdTIwMTQgTWF0SUVDIHJlc29sdmVzIHN0YW5kYXJkIEZCcyBmcm9tIGl0cyAtSSBsaWIpXG4gKiAgIC0gc3RDb2RlRm9yU3RydWNwcDogZm9yIFNUcnVDKysgKGluY2x1ZGVzIElFQyBzdGFuZGFyZCBGQiBzdHVicyBiZWZvcmUgUFJPR1JBTSlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsbVRvU1QoY2xtOiBDTE1HcmFwaCwgY3ljbGVNcyA9IDUwKTogU1RDb21waWxlUmVzdWx0IHtcbiAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG5cbiAgLy8gXHUyNTAwXHUyNTAwIENvbGxlY3QgdGFncyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgY29uc3QgdGFnSWRzID0gY2xtLmdldE5vZGVzQnlUeXBlKCdUQUcnKTtcbiAgY29uc3QgdGFncyA9IHRhZ0lkcy5tYXAoaWQgPT4gKHtcbiAgICBpZCxcbiAgICBkYXRhOiBjbG0uZ2V0Tm9kZURhdGE8VGFnTm9kZURhdGE+KGlkKSxcbiAgfSkpO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBWQVIgc2VjdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgLy8gQVQgZGVjbGFyYXRpb25zIGFyZSBvbmx5IHZhbGlkIGluIFZBUl9HTE9CQUwgKGNvbmZpZy1zY29wZSksIG5vdCBpbiBQUk9HUkFNIFZBUi5cbiAgLy8gTWF0SUVDIHJlamVjdHMgQVQgJUkvJVEvJU0gaW5zaWRlIFBST0dSQU0gYmxvY2tzIFx1MjAxNCBkcm9wIHRoZSBBVCBjbGF1c2UgaGVyZS5cbiAgY29uc3QgdmFyTGluZXM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHZhclJldGFpbkxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuICBmb3IgKGNvbnN0IHsgZGF0YSB9IG9mIHRhZ3MpIHtcbiAgICBjb25zdCBpbml0Q2xhdXNlID0gZGF0YS5pbml0aWFsVmFsdWUgPyBgIDo9ICR7ZGF0YS5pbml0aWFsVmFsdWV9YCA6IGRlZmF1bHRJbml0Rm9yKGRhdGEuZGF0YVR5cGUpO1xuICAgIGNvbnN0IGRlY2wgPSBgICAgICR7c2FuaXRpemVOYW1lKGRhdGEubmFtZSl9IDogJHtkYXRhLmRhdGFUeXBlfSR7aW5pdENsYXVzZX07YDtcbiAgICBpZiAoZGF0YS5yZXRhaW4pIHtcbiAgICAgIHZhclJldGFpbkxpbmVzLnB1c2goZGVjbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhckxpbmVzLnB1c2goZGVjbCk7XG4gICAgfVxuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIExEIGJvZHkgKHBlci1ydW5nKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgY29uc3QgbGRMaW5lczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgcnVuZ0lkcyA9IGNsbS5nZXROb2Rlc0J5VHlwZSgnUlVORycpO1xuICAvLyBTb3J0IGJ5IHJ1bmdOdW1iZXJcbiAgcnVuZ0lkcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgY29uc3QgcmEgPSBjbG0uZ2V0Tm9kZURhdGE8UnVuZ05vZGVEYXRhPihhKS5ydW5nTnVtYmVyO1xuICAgIGNvbnN0IHJiID0gY2xtLmdldE5vZGVEYXRhPFJ1bmdOb2RlRGF0YT4oYikucnVuZ051bWJlcjtcbiAgICByZXR1cm4gcmEgLSByYjtcbiAgfSk7XG5cbiAgZm9yIChjb25zdCBydW5nSWQgb2YgcnVuZ0lkcykge1xuICAgIGNvbnN0IHJ1bmdEYXRhID0gY2xtLmdldE5vZGVEYXRhPFJ1bmdOb2RlRGF0YT4ocnVuZ0lkKTtcbiAgICBpZiAocnVuZ0RhdGEuY29tbWVudCkge1xuICAgICAgbGRMaW5lcy5wdXNoKGAgICgqIFJ1bmcgJHtydW5nRGF0YS5ydW5nTnVtYmVyfTogJHtydW5nRGF0YS5jb21tZW50fSAqKWApO1xuICAgIH1cblxuICAgIC8vIENvbGxlY3QgTERfRUxFTUVOVCBub2RlcyBmb3IgdGhpcyBydW5nXG4gICAgY29uc3QgZWxlbWVudElkcyA9IGNsbS5nZXRDaGlsZHJlbihydW5nSWQpO1xuICAgIGNvbnN0IGVsZW1lbnRzID0gZWxlbWVudElkcy5tYXAoaWQgPT4gKHtcbiAgICAgIGlkLFxuICAgICAgYXR0cjogY2xtLmdldE5vZGVBdHRyKGlkKSxcbiAgICAgIGRhdGE6IGNsbS5nZXROb2RlRGF0YTxMREVsZW1lbnROb2RlRGF0YT4oaWQpLFxuICAgIH0pKS5maWx0ZXIoZSA9PiBlLmF0dHIudHlwZSA9PT0gJ0xEX0VMRU1FTlQnKTtcblxuICAgIC8vIFNlcGFyYXRlIG1haW4gcmFpbCBmcm9tIGJyYW5jaCBlbGVtZW50c1xuICAgIGNvbnN0IG1haW5SYWlsID0gZWxlbWVudHMuZmlsdGVyKGUgPT4gIWUuZGF0YS5icmFuY2hJZCk7XG4gICAgY29uc3QgYnJhbmNoR3JvdXBzID0gZ3JvdXBCeUJyYW5jaElkKGVsZW1lbnRzLmZpbHRlcihlID0+ICEhZS5kYXRhLmJyYW5jaElkKSk7XG5cbiAgICBjb25zdCBydW5nU1QgPSBjb21waWxlUnVuZ1RvU1QoY2xtLCBydW5nSWQsIG1haW5SYWlsLCBicmFuY2hHcm91cHMsIHdhcm5pbmdzKTtcbiAgICBsZExpbmVzLnB1c2goLi4ucnVuZ1NUKTtcbiAgICBsZExpbmVzLnB1c2goJycpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIEZCRCBib2R5IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBjb25zdCBmYmRMaW5lczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgZmJkQmxvY2tJZHMgPSBjbG0uZ2V0Tm9kZXNCeVR5cGUoJ0ZCRF9CTE9DSycpO1xuICBmb3IgKGNvbnN0IGJsb2NrSWQgb2YgZmJkQmxvY2tJZHMpIHtcbiAgICBjb25zdCBibG9ja0RhdGEgPSBjbG0uZ2V0Tm9kZURhdGE8RkJEQmxvY2tOb2RlRGF0YT4oYmxvY2tJZCk7XG4gICAgY29uc3QgZmJkU1QgPSBjb21waWxlRkJEQmxvY2tUb1NUKGNsbSwgYmxvY2tJZCwgYmxvY2tEYXRhLCB3YXJuaW5ncyk7XG4gICAgZmJkTGluZXMucHVzaCguLi5mYmRTVCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgU0ZDIGJvZHkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvbnN0IHNmY0xpbmVzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBzZmNTdGVwSWRzID0gY2xtLmdldE5vZGVzQnlUeXBlKCdTRkNfU1RFUCcpO1xuICBpZiAoc2ZjU3RlcElkcy5sZW5ndGggPiAwKSB7XG4gICAgc2ZjTGluZXMucHVzaCguLi5jb21waWxlU0ZDVG9TVChjbG0sIHNmY1N0ZXBJZHMsIHdhcm5pbmdzKSk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgQXNzZW1ibGUgUFJPR1JBTSBibG9jayBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgY29uc3QgcHJvZ3JhbU5hbWUgPSAncHJvZzAnO1xuICBjb25zdCBib2R5TGluZXMgPSBbLi4ubGRMaW5lcywgLi4uZmJkTGluZXMsIC4uLnNmY0xpbmVzXTtcblxuICAvLyBGQiBpbnN0YW5jZSB2YXJpYWJsZXMgKFRPTiwgQ1RVIGV0Yy4pIG5lZWQgVkFSIGJsb2NrcyB0b29cbiAgY29uc3QgZmJWYXJMaW5lcyA9IGNvbGxlY3RGQkluc3RhbmNlVmFycyhjbG0pO1xuXG4gIGNvbnN0IHBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuICBwYXJ0cy5wdXNoKGBQUk9HUkFNICR7cHJvZ3JhbU5hbWV9YCk7XG5cbiAgaWYgKHZhckxpbmVzLmxlbmd0aCA+IDAgfHwgZmJWYXJMaW5lcy5sZW5ndGggPiAwKSB7XG4gICAgcGFydHMucHVzaCgnICBWQVInKTtcbiAgICBwYXJ0cy5wdXNoKC4uLnZhckxpbmVzKTtcbiAgICBwYXJ0cy5wdXNoKC4uLmZiVmFyTGluZXMpO1xuICAgIHBhcnRzLnB1c2goJyAgRU5EX1ZBUicpO1xuICB9XG5cbiAgaWYgKHZhclJldGFpbkxpbmVzLmxlbmd0aCA+IDApIHtcbiAgICBwYXJ0cy5wdXNoKCcgIFZBUl9SRVRBSU4nKTtcbiAgICBwYXJ0cy5wdXNoKC4uLnZhclJldGFpbkxpbmVzKTtcbiAgICBwYXJ0cy5wdXNoKCcgIEVORF9WQVInKTtcbiAgfVxuXG4gIGlmIChib2R5TGluZXMubGVuZ3RoID4gMCkge1xuICAgIHBhcnRzLnB1c2goJycpO1xuICAgIHBhcnRzLnB1c2goLi4uYm9keUxpbmVzKTtcbiAgfVxuXG4gIHBhcnRzLnB1c2goYEVORF9QUk9HUkFNYCk7XG5cbiAgLy8gXHUyNTAwXHUyNTAwIENPTkZJR1VSQVRJT04gc2NhZmZvbGQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIHBhcnRzLnB1c2goJycpO1xuICBwYXJ0cy5wdXNoKCdDT05GSUdVUkFUSU9OIENvbmZpZzAnKTtcbiAgcGFydHMucHVzaCgnJyk7XG4gIHBhcnRzLnB1c2goJyAgUkVTT1VSQ0UgUmVzMCBPTiBQTEMnKTtcbiAgcGFydHMucHVzaChgICAgIFRBU0sgTWFpbihJTlRFUlZBTCA6PSBUIyR7Y3ljbGVNc31tcywgUFJJT1JJVFkgOj0gMCk7YCk7XG4gIHBhcnRzLnB1c2goYCAgICBQUk9HUkFNIEluc3QwIFdJVEggTWFpbiA6ICR7cHJvZ3JhbU5hbWV9O2ApO1xuICBwYXJ0cy5wdXNoKCcgIEVORF9SRVNPVVJDRScpO1xuICBwYXJ0cy5wdXNoKCcnKTtcbiAgcGFydHMucHVzaCgnRU5EX0NPTkZJR1VSQVRJT04nKTtcblxuICBjb25zdCBzdENvZGUgPSBwYXJ0cy5qb2luKCdcXG4nKTtcblxuICAvLyBTVHJ1QysrIHZhcmlhbnQ6IHByZXBlbmQgSUVDIHN0ZGxpYiBzdHVicyB3aGVuIGZ1bmN0aW9uLWJsb2NrIGluc3RhbmNlcyBhcmUgdXNlZC5cbiAgLy8gU1RydUMrKyBpcyBwdXJlIEpTIHdpdGggbm8gZmlsZXN5c3RlbSBcdTIwMTQgaXQgY2Fubm90IHJlc29sdmUgc3RhbmRhcmQgRkJzIGZyb20gYSBsaWIgZGlyZWN0b3J5LlxuICBjb25zdCBuZWVkc1N0dWJzID0gZmJWYXJMaW5lcy5sZW5ndGggPiAwO1xuICBjb25zdCBzdENvZGVGb3JTdHJ1Y3BwID0gbmVlZHNTdHVic1xuICAgID8gSUVDX1NURExJQl9TVFVCUy50cmltKCkgKyAnXFxuXFxuJyArIHN0Q29kZVxuICAgIDogc3RDb2RlO1xuXG4gIHJldHVybiB7XG4gICAgc3RDb2RlLFxuICAgIHN0Q29kZUZvclN0cnVjcHAsXG4gICAgcHJvZ3JhbU5hbWUsXG4gICAgdGFnQ291bnQ6IHRhZ3MubGVuZ3RoLFxuICAgIHJ1bmdDb3VudDogcnVuZ0lkcy5sZW5ndGgsXG4gICAgd2FybmluZ3MsXG4gIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBEZWJ1Zy1tYXAgdGFnIHJlc29sdXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBpbnRlcmZhY2UgRGVidWdMZWFmIHtcbiAgYXJyYXlJZHg6IG51bWJlcjtcbiAgZWxlbUlkeDogbnVtYmVyO1xuICBwYXRoOiBzdHJpbmc7XG4gIHR5cGU6IHN0cmluZztcbiAgc2l6ZTogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIERlYnVnTWFwIHtcbiAgdmVyc2lvbjogbnVtYmVyO1xuICBtZDU6IHN0cmluZztcbiAgdHlwZVRhZ3M6IFJlY29yZDxzdHJpbmcsIG51bWJlcj47XG4gIGFycmF5czogQXJyYXk8eyBpbmRleDogbnVtYmVyOyBjb3VudDogbnVtYmVyIH0+O1xuICBsZWF2ZXM6IERlYnVnTGVhZltdO1xufVxuXG4vKipcbiAqIEdpdmVuIGEgZGVidWctbWFwLmpzb24gKGZyb20gU1RydUMrKyBnZW5lcmF0ZURlYnVnVGFibGUpIGFuZCBhIHJhdyB0YWcgbmFtZVxuICogZnJvbSBsb2dpY1N0b3JlLlRhZ0VudHJ5Lm5hbWUsIHJldHVybiB0aGUgbGVhZiBlbnRyeS5cbiAqXG4gKiBDb25maXJtZWQgZm9ybWF0IGZyb20gcmVhbCBvdXRwdXQ6XG4gKiAgIHBhdGggPSBcIklOU1QwLk1PVE9SX1JVTlwiICAodXBwZXJjYXNlIGluc3RhbmNlIFwiSU5TVDBcIiwgZG90LCB1cHBlcmNhc2UgdmFyIG5hbWUpXG4gKlxuICogSW5zdGFuY2UgbmFtZTogZW5zdXJlQ29uZmlndXJhdGlvbigpIHJlbmFtZXMgUFJPR1JBTSB0byBwcm9nMCBhbmQgc2V0c1xuICogUFJPR1JBTSBJbnN0MCBXSVRIIE1haW4gXHUyMDE0IHNvIHRoZSBpbnN0YW5jZSBuYW1lIGlzIGFsd2F5cyBcIkluc3QwXCIgXHUyMTkyIFwiSU5TVDBcIi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVUYWdEZWJ1Z0xlYWYoZGVidWdNYXA6IERlYnVnTWFwLCB0YWdOYW1lOiBzdHJpbmcpOiBEZWJ1Z0xlYWYgfCB1bmRlZmluZWQge1xuICBjb25zdCBuZWVkbGUgPSBgSU5TVDAuJHt0YWdOYW1lLnRvVXBwZXJDYXNlKCl9YDtcbiAgcmV0dXJuIGRlYnVnTWFwLmxlYXZlcy5maW5kKGwgPT4gbC5wYXRoID09PSBuZWVkbGUpO1xufVxuXG4vKipcbiAqIEJ1aWxkIGEgTWFwPHRhZ05hbWUsIGRlYnVnSW5kZXg+IGZvciBhbGwgdGFncyBpbiB0aGUgZGVidWcgbWFwLlxuICogZGVidWdJbmRleCA9IGVsZW1JZHggd2l0aGluIGFycmF5IDAgKHRoZSBzaW5nbGUgZmxhdCB2YXJpYWJsZSBhcnJheSkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFRhZ0luZGV4TWFwKGRlYnVnTWFwOiBEZWJ1Z01hcCk6IE1hcDxzdHJpbmcsIG51bWJlcj4ge1xuICBjb25zdCByZXN1bHQgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICBmb3IgKGNvbnN0IGxlYWYgb2YgZGVidWdNYXAubGVhdmVzKSB7XG4gICAgLy8gcGF0aCA9IFwiSU5TVDAuVkFSX05BTUVcIlxuICAgIGNvbnN0IGRvdElkeCA9IGxlYWYucGF0aC5pbmRleE9mKCcuJyk7XG4gICAgaWYgKGRvdElkeCA9PT0gLTEpIGNvbnRpbnVlO1xuICAgIGNvbnN0IHZhck5hbWUgPSBsZWFmLnBhdGguc2xpY2UoZG90SWR4ICsgMSk7IC8vIFwiTU9UT1JfUlVOXCJcbiAgICByZXN1bHQuc2V0KHZhck5hbWUsIGxlYWYuZWxlbUlkeCk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIExEIFx1MjE5MiBTVCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxudHlwZSBFbGVtZW50V2l0aERhdGEgPSB7XG4gIGlkOiBzdHJpbmc7XG4gIGF0dHI6IFJldHVyblR5cGU8Q0xNR3JhcGhbJ2dldE5vZGVBdHRyJ10+O1xuICBkYXRhOiBMREVsZW1lbnROb2RlRGF0YTtcbn07XG5cbmZ1bmN0aW9uIGdyb3VwQnlCcmFuY2hJZChlbGVtZW50czogRWxlbWVudFdpdGhEYXRhW10pOiBNYXA8c3RyaW5nLCBFbGVtZW50V2l0aERhdGFbXT4ge1xuICBjb25zdCBncm91cHMgPSBuZXcgTWFwPHN0cmluZywgRWxlbWVudFdpdGhEYXRhW10+KCk7XG4gIGZvciAoY29uc3QgZWwgb2YgZWxlbWVudHMpIHtcbiAgICBjb25zdCBiaWQgPSBlbC5kYXRhLmJyYW5jaElkITtcbiAgICBpZiAoIWdyb3Vwcy5oYXMoYmlkKSkgZ3JvdXBzLnNldChiaWQsIFtdKTtcbiAgICBncm91cHMuZ2V0KGJpZCkhLnB1c2goZWwpO1xuICB9XG4gIHJldHVybiBncm91cHM7XG59XG5cbmZ1bmN0aW9uIGNvbXBpbGVSdW5nVG9TVChcbiAgY2xtOiBDTE1HcmFwaCxcbiAgX3J1bmdJZDogc3RyaW5nLFxuICBtYWluUmFpbDogRWxlbWVudFdpdGhEYXRhW10sXG4gIGJyYW5jaEdyb3VwczogTWFwPHN0cmluZywgRWxlbWVudFdpdGhEYXRhW10+LFxuICB3YXJuaW5nczogc3RyaW5nW10sXG4pOiBzdHJpbmdbXSB7XG4gIC8vIFNwbGl0IG1haW4gcmFpbDogY29udGFjdHMgKGNvbmRpdGlvbnMpIHRoZW4gY29pbHMvYmxvY2tzIChvdXRwdXRzKVxuICBjb25zdCBjb250YWN0cyA9IG1haW5SYWlsLmZpbHRlcihlID0+IGlzQ29udGFjdEtpbmQoZS5kYXRhLmVsZW1lbnRLaW5kKSk7XG4gIGNvbnN0IG91dHB1dHMgPSBtYWluUmFpbC5maWx0ZXIoZSA9PiAhaXNDb250YWN0S2luZChlLmRhdGEuZWxlbWVudEtpbmQpKTtcblxuICBpZiAoY29udGFjdHMubGVuZ3RoID09PSAwICYmIG91dHB1dHMubGVuZ3RoID09PSAwKSByZXR1cm4gW107XG5cbiAgLy8gQnVpbGQgY29uZGl0aW9uIGV4cHJlc3Npb24gXHUyMDE0IExEIHNlbWFudGljczpcbiAgLy8gTWFpbiByYWlsIGNvbnRhY3RzIGFyZSBzZXJpZXMgKEFORCkuIEVhY2ggYnJhbmNoIHByb3ZpZGVzIGEgcGFyYWxsZWwgcGF0aCAoT1IpIGZvclxuICAvLyB0aGUgc2VjdGlvbiBvZiB0aGUgcnVuZyBpdCBzcGFucy4gU2ltcGxlIG1vZGVsOiBicmFuY2ggY29udGFjdHMgT1Igd2l0aCBtYWluIHJhaWwuXG4gIC8vIFJlc3VsdDogKG1haW5Db250YWN0MSBBTkQgbWFpbkNvbnRhY3QyIEFORCAuLi4gKSBPUiAoYnJhbmNoMSkgT1IgKGJyYW5jaDIpIC4uLlxuICBjb25zdCBtYWluRXhwciA9IGNvbnRhY3RzLmxlbmd0aCA+IDBcbiAgICA/IGNvbnRhY3RzLm1hcChlID0+IGNvbnRhY3RUb0V4cHIoY2xtLCBlKSkuam9pbignIEFORCAnKVxuICAgIDogJyc7XG5cbiAgY29uc3QgYnJhbmNoRXhwcnM6IHN0cmluZ1tdID0gW107XG4gIGZvciAoY29uc3QgWywgYnJhbmNoRWxzXSBvZiBicmFuY2hHcm91cHMpIHtcbiAgICBjb25zdCBicmFuY2hDb250YWN0cyA9IGJyYW5jaEVscy5maWx0ZXIoZSA9PiBpc0NvbnRhY3RLaW5kKGUuZGF0YS5lbGVtZW50S2luZCkpO1xuICAgIGlmIChicmFuY2hDb250YWN0cy5sZW5ndGggPiAwKSB7XG4gICAgICBicmFuY2hFeHBycy5wdXNoKGAoJHticmFuY2hDb250YWN0cy5tYXAoZSA9PiBjb250YWN0VG9FeHByKGNsbSwgZSkpLmpvaW4oJyBBTkQgJyl9KWApO1xuICAgIH1cbiAgfVxuXG4gIGxldCBjb25kaXRpb246IHN0cmluZztcbiAgaWYgKG1haW5FeHByICYmIGJyYW5jaEV4cHJzLmxlbmd0aCA+IDApIHtcbiAgICBjb25kaXRpb24gPSBgKCR7bWFpbkV4cHJ9KSBPUiAke2JyYW5jaEV4cHJzLmpvaW4oJyBPUiAnKX1gO1xuICB9IGVsc2UgaWYgKG1haW5FeHByKSB7XG4gICAgY29uZGl0aW9uID0gbWFpbkV4cHI7XG4gIH0gZWxzZSBpZiAoYnJhbmNoRXhwcnMubGVuZ3RoID4gMCkge1xuICAgIGNvbmRpdGlvbiA9IGJyYW5jaEV4cHJzLmpvaW4oJyBPUiAnKTtcbiAgfSBlbHNlIHtcbiAgICBjb25kaXRpb24gPSAnVFJVRSc7XG4gIH1cblxuICBjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXTtcblxuICBpZiAob3V0cHV0cy5sZW5ndGggPT09IDApIHtcbiAgICB3YXJuaW5ncy5wdXNoKGBSdW5nIGhhcyBjb250YWN0cyBidXQgbm8gb3V0cHV0IGVsZW1lbnRgKTtcbiAgICByZXR1cm4gbGluZXM7XG4gIH1cblxuICBmb3IgKGNvbnN0IG91dHB1dCBvZiBvdXRwdXRzKSB7XG4gICAgY29uc3Qgb3V0cHV0TGluZXMgPSBvdXRwdXRUb1NUKGNsbSwgb3V0cHV0LCBjb25kaXRpb24sIHdhcm5pbmdzKTtcbiAgICBsaW5lcy5wdXNoKC4uLm91dHB1dExpbmVzKTtcbiAgfVxuXG4gIHJldHVybiBsaW5lcztcbn1cblxuZnVuY3Rpb24gaXNDb250YWN0S2luZChraW5kOiBMREVsZW1lbnRLaW5kKTogYm9vbGVhbiB7XG4gIHJldHVybiBraW5kLnN0YXJ0c1dpdGgoJ2NvbnRhY3RfJyk7XG59XG5cbmZ1bmN0aW9uIGNvbnRhY3RUb0V4cHIoY2xtOiBDTE1HcmFwaCwgZWw6IEVsZW1lbnRXaXRoRGF0YSk6IHN0cmluZyB7XG4gIC8vIFJlc29sdmUgdGFnIG5hbWUgdmlhIFJFQURTIGVkZ2VcbiAgY29uc3QgcmVhZHMgPSBjbG0uZ2V0T3V0RWRnZXNCeVR5cGUoZWwuaWQsICdSRUFEUycpO1xuICBjb25zdCB0YWdOYW1lID0gcmVhZHMubGVuZ3RoID4gMFxuICAgID8gc2FuaXRpemVOYW1lKChjbG0uZ2V0Tm9kZURhdGE8VGFnTm9kZURhdGE+KHJlYWRzWzBdLnRhcmdldCkpLm5hbWUpXG4gICAgOiAnX1VOS05PV04nO1xuXG4gIGNvbnN0IGtpbmQgPSBlbC5kYXRhLmVsZW1lbnRLaW5kO1xuICBzd2l0Y2ggKGtpbmQpIHtcbiAgICBjYXNlICdjb250YWN0X25vJzogcmV0dXJuIHRhZ05hbWU7XG4gICAgY2FzZSAnY29udGFjdF9uYyc6IHJldHVybiBgTk9UICR7dGFnTmFtZX1gO1xuICAgIGNhc2UgJ2NvbnRhY3RfcCc6ICByZXR1cm4gdGFnTmFtZTsgICAvLyBwb3NpdGl2ZSBlZGdlIFx1MjAxNCBTVCBhcHByb3hpbWF0aW9uXG4gICAgY2FzZSAnY29udGFjdF9uJzogIHJldHVybiBgTk9UICR7dGFnTmFtZX1gOyAvLyBuZWdhdGl2ZSBlZGdlIFx1MjAxNCBTVCBhcHByb3hpbWF0aW9uXG4gICAgZGVmYXVsdDogcmV0dXJuIHRhZ05hbWU7XG4gIH1cbn1cblxuZnVuY3Rpb24gb3V0cHV0VG9TVChcbiAgY2xtOiBDTE1HcmFwaCxcbiAgZWw6IEVsZW1lbnRXaXRoRGF0YSxcbiAgY29uZGl0aW9uOiBzdHJpbmcsXG4gIHdhcm5pbmdzOiBzdHJpbmdbXSxcbik6IHN0cmluZ1tdIHtcbiAgY29uc3Qgd3JpdGVzID0gY2xtLmdldE91dEVkZ2VzQnlUeXBlKGVsLmlkLCAnV1JJVEVTJyk7XG4gIGNvbnN0IGtpbmQgPSBlbC5kYXRhLmVsZW1lbnRLaW5kO1xuXG4gIGlmIChraW5kID09PSAnZmJfY2FsbCcpIHtcbiAgICByZXR1cm4gY29tcGlsZUZCQ2FsbEluUnVuZyhjbG0sIGVsLCBjb25kaXRpb24sIHdhcm5pbmdzKTtcbiAgfVxuXG4gIGlmICh3cml0ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgd2FybmluZ3MucHVzaChgQ29pbCBlbGVtZW50ICR7ZWwuaWR9IGhhcyBubyBXUklURVMgZWRnZSBcdTIwMTQgc2tpcHBlZGApO1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIGNvbnN0IHRhZ05hbWUgPSBzYW5pdGl6ZU5hbWUoKGNsbS5nZXROb2RlRGF0YTxUYWdOb2RlRGF0YT4od3JpdGVzWzBdLnRhcmdldCkpLm5hbWUpO1xuXG4gIHN3aXRjaCAoa2luZCkge1xuICAgIGNhc2UgJ2NvaWwnOlxuICAgICAgcmV0dXJuIFtgICBJRiAke2NvbmRpdGlvbn0gVEhFTiAke3RhZ05hbWV9IDo9IFRSVUU7IEVMU0UgJHt0YWdOYW1lfSA6PSBGQUxTRTsgRU5EX0lGO2BdO1xuICAgIGNhc2UgJ2NvaWxfbmVnYXRlZCc6XG4gICAgICByZXR1cm4gW2AgIElGICR7Y29uZGl0aW9ufSBUSEVOICR7dGFnTmFtZX0gOj0gRkFMU0U7IEVMU0UgJHt0YWdOYW1lfSA6PSBUUlVFOyBFTkRfSUY7YF07XG4gICAgY2FzZSAnY29pbF9zZXQnOlxuICAgICAgcmV0dXJuIFtgICBJRiAke2NvbmRpdGlvbn0gVEhFTiAke3RhZ05hbWV9IDo9IFRSVUU7IEVORF9JRjtgXTtcbiAgICBjYXNlICdjb2lsX3Jlc2V0JzpcbiAgICAgIHJldHVybiBbYCAgSUYgJHtjb25kaXRpb259IFRIRU4gJHt0YWdOYW1lfSA6PSBGQUxTRTsgRU5EX0lGO2BdO1xuICAgIGNhc2UgJ2NvaWxfbGF0Y2gnOlxuICAgICAgcmV0dXJuIFtgICBJRiAke2NvbmRpdGlvbn0gVEhFTiAke3RhZ05hbWV9IDo9IFRSVUU7IEVORF9JRjtgXTtcbiAgICBjYXNlICdjb2lsX3VubGF0Y2gnOlxuICAgICAgcmV0dXJuIFtgICBJRiAke2NvbmRpdGlvbn0gVEhFTiAke3RhZ05hbWV9IDo9IEZBTFNFOyBFTkRfSUY7YF07XG4gICAgZGVmYXVsdDpcbiAgICAgIHdhcm5pbmdzLnB1c2goYFVua25vd24gY29pbCBraW5kICR7a2luZH0gXHUyMDE0IGVtaXR0ZWQgYXMgbm9ybWFsIGNvaWxgKTtcbiAgICAgIHJldHVybiBbYCAgSUYgJHtjb25kaXRpb259IFRIRU4gJHt0YWdOYW1lfSA6PSBUUlVFOyBFTFNFICR7dGFnTmFtZX0gOj0gRkFMU0U7IEVORF9JRjtgXTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb21waWxlRkJDYWxsSW5SdW5nKFxuICBjbG06IENMTUdyYXBoLFxuICBlbDogRWxlbWVudFdpdGhEYXRhLFxuICBjb25kaXRpb246IHN0cmluZyxcbiAgd2FybmluZ3M6IHN0cmluZ1tdLFxuKTogc3RyaW5nW10ge1xuICBjb25zdCBpbnN0YW5jZU5hbWUgPSBzYW5pdGl6ZU5hbWUoZWwuZGF0YS5pbnN0YW5jZU5hbWUgPz8gYF9GQl8ke2VsLmlkfWApO1xuXG4gIC8vIENvbGxlY3QgaW5wdXQgcGluIGFzc2lnbm1lbnRzIChSRUFEUyBlZGdlcyBjYXJyeSB7cGluTmFtZX0gaW4gZWRnZSBkYXRhKVxuICBjb25zdCByZWFkcyA9IGNsbS5nZXRPdXRFZGdlc0J5VHlwZShlbC5pZCwgJ1JFQURTJyk7XG4gIGNvbnN0IHdyaXRlcyA9IGNsbS5nZXRPdXRFZGdlc0J5VHlwZShlbC5pZCwgJ1dSSVRFUycpO1xuXG4gIGNvbnN0IGlucHV0UGFyYW1zOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBvdXRwdXRBc3NpZ25tZW50czogc3RyaW5nW10gPSBbXTtcblxuICBmb3IgKGNvbnN0IGVkZ2Ugb2YgcmVhZHMpIHtcbiAgICBjb25zdCB0YWdEYXRhID0gY2xtLmdldE5vZGVEYXRhPFRhZ05vZGVEYXRhPihlZGdlLnRhcmdldCk7XG4gICAgY29uc3QgcGluTmFtZSA9IChlZGdlLmRhdGEgYXMgYW55KT8ucGluTmFtZSA/PyBzYW5pdGl6ZU5hbWUodGFnRGF0YS5uYW1lKTtcbiAgICBpbnB1dFBhcmFtcy5wdXNoKGAke3Bpbk5hbWV9IDo9ICR7c2FuaXRpemVOYW1lKHRhZ0RhdGEubmFtZSl9YCk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGVkZ2Ugb2Ygd3JpdGVzKSB7XG4gICAgY29uc3QgdGFnRGF0YSA9IGNsbS5nZXROb2RlRGF0YTxUYWdOb2RlRGF0YT4oZWRnZS50YXJnZXQpO1xuICAgIGNvbnN0IHBpbk5hbWUgPSAoZWRnZS5kYXRhIGFzIGFueSk/LnBpbk5hbWUgPz8gc2FuaXRpemVOYW1lKHRhZ0RhdGEubmFtZSk7XG4gICAgb3V0cHV0QXNzaWdubWVudHMucHVzaChgICAgICR7c2FuaXRpemVOYW1lKHRhZ0RhdGEubmFtZSl9IDo9ICR7aW5zdGFuY2VOYW1lfS4ke3Bpbk5hbWV9O2ApO1xuICB9XG5cbiAgY29uc3QgcGFyYW1TdHIgPSBpbnB1dFBhcmFtcy5sZW5ndGggPiAwXG4gICAgPyBgRU4gOj0gKCR7Y29uZGl0aW9ufSksICR7aW5wdXRQYXJhbXMuam9pbignLCAnKX1gXG4gICAgOiBgRU4gOj0gKCR7Y29uZGl0aW9ufSlgO1xuXG4gIGNvbnN0IGxpbmVzID0gW1xuICAgIGAgICR7aW5zdGFuY2VOYW1lfSgke3BhcmFtU3RyfSk7YCxcbiAgICAuLi5vdXRwdXRBc3NpZ25tZW50cyxcbiAgXTtcblxuICByZXR1cm4gbGluZXM7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBGQkQgXHUyMTkyIFNUIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBjb21waWxlRkJEQmxvY2tUb1NUKFxuICBjbG06IENMTUdyYXBoLFxuICBibG9ja0lkOiBzdHJpbmcsXG4gIGJsb2NrRGF0YTogRkJEQmxvY2tOb2RlRGF0YSxcbiAgd2FybmluZ3M6IHN0cmluZ1tdLFxuKTogc3RyaW5nW10ge1xuICBjb25zdCBidHlwZSA9IGJsb2NrRGF0YS5ibG9ja1R5cGU7XG5cbiAgLy8gU2tpcCBwdXJlbHkgdmlzdWFsIG5vZGVzXG4gIGlmIChidHlwZSA9PT0gJ0NPTU1FTlQnIHx8IGJ0eXBlID09PSAnQ09OTkVDVE9SJyB8fCBidHlwZSA9PT0gJ0NPTlRJTlVBVElPTicpIHJldHVybiBbXTtcblxuICAvLyBWYXJpYWJsZSBub2RlcyBcdTIwMTQganVzdCBhIHRhZyByZWZlcmVuY2UsIG5vIGNhbGwgbmVlZGVkXG4gIGlmIChidHlwZSA9PT0gJ0lOX1ZBUklBQkxFJyB8fCBidHlwZSA9PT0gJ09VVF9WQVJJQUJMRScgfHwgYnR5cGUgPT09ICdJTk9VVF9WQVJJQUJMRScpIHJldHVybiBbXTtcblxuICAvLyBGdW5jdGlvbi1ibG9jayBpbnN0YW5jZSBjYWxsIChUT04sIENUVSwgU1IsIFJTIGV0Yy4pXG4gIGNvbnN0IGlzRkJJbnN0YW5jZSA9IGlzRnVuY3Rpb25CbG9jayhidHlwZSk7XG4gIGlmIChpc0ZCSW5zdGFuY2UpIHtcbiAgICBjb25zdCBpbnN0YW5jZU5hbWUgPSBzYW5pdGl6ZU5hbWUoYmxvY2tEYXRhLmluc3RhbmNlTmFtZSA/PyBgX0ZCXyR7YmxvY2tJZH1gKTtcbiAgICBjb25zdCB7IGlucHV0UGFyYW1zLCBvdXRwdXRBc3NpZ25tZW50cyB9ID0gY29sbGVjdEZCRFBpblBhcmFtcyhjbG0sIGJsb2NrSWQsIHdhcm5pbmdzKTtcbiAgICBjb25zdCBjYWxsTGluZXM6IHN0cmluZ1tdID0gW1xuICAgICAgYCAgJHtpbnN0YW5jZU5hbWV9KGAsXG4gICAgICAuLi5pbnB1dFBhcmFtcy5tYXAoKHAsIGkpID0+IGAgICAgJHtwfSR7aSA8IGlucHV0UGFyYW1zLmxlbmd0aCAtIDEgPyAnLCcgOiAnJ31gKSxcbiAgICAgIGAgICk7YCxcbiAgICBdO1xuICAgIHJldHVybiBbLi4uY2FsbExpbmVzLCAuLi5vdXRwdXRBc3NpZ25tZW50c107XG4gIH1cblxuICAvLyBDb21iaW5hdG9yaWFsIC8gYXJpdGhtZXRpYyBibG9ja3MgXHUyMDE0IGZvbGQgaW50byBpbmxpbmUgU1QgZXhwcmVzc2lvbnNcbiAgcmV0dXJuIGNvbXBpbGVGQkRDb21iaW5hdG9yaWFsKGNsbSwgYmxvY2tJZCwgYmxvY2tEYXRhLCB3YXJuaW5ncyk7XG59XG5cbmludGVyZmFjZSBGQkRQaW5SZXN1bHQge1xuICBpbnB1dFBhcmFtczogc3RyaW5nW107XG4gIG91dHB1dEFzc2lnbm1lbnRzOiBzdHJpbmdbXTsgIC8vIFwidGFnTmFtZSA6PSBpbnN0YW5jZU5hbWUucGluTmFtZTtcIiBcdTIwMTQgZW1pdHRlZCBhZnRlciBjYWxsXG59XG5cbmZ1bmN0aW9uIGNvbGxlY3RGQkRQaW5QYXJhbXMoY2xtOiBDTE1HcmFwaCwgYmxvY2tJZDogc3RyaW5nLCB3YXJuaW5nczogc3RyaW5nW10pOiBGQkRQaW5SZXN1bHQge1xuICBjb25zdCBwaW5FZGdlcyA9IGNsbS5nZXRPdXRFZGdlc0J5VHlwZShibG9ja0lkLCAnSEFTX1BJTicpO1xuICBjb25zdCBpbnB1dFBhcmFtczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3Qgb3V0cHV0QXNzaWdubWVudHM6IHN0cmluZ1tdID0gW107XG5cbiAgZm9yIChjb25zdCBlZGdlIG9mIHBpbkVkZ2VzKSB7XG4gICAgY29uc3QgcGluRGF0YSA9IGNsbS5nZXROb2RlRGF0YTxGQkRQaW5Ob2RlRGF0YT4oZWRnZS50YXJnZXQpO1xuXG4gICAgaWYgKHBpbkRhdGEuZGlyZWN0aW9uID09PSAnaW4nKSB7XG4gICAgICAvLyBGaW5kIHdoYXQncyB3aXJlZCB0byB0aGlzIGlucHV0IHBpblxuICAgICAgY29uc3QgaW5XaXJlcyA9IGNsbS5nZXRJbkVkZ2VzQnlUeXBlKGVkZ2UudGFyZ2V0LCAnV0lSRScpO1xuICAgICAgaWYgKGluV2lyZXMubGVuZ3RoID09PSAwKSBjb250aW51ZTtcblxuICAgICAgY29uc3Qgc291cmNlUGluID0gaW5XaXJlc1swXS5zb3VyY2U7XG4gICAgICBjb25zdCBwYXJlbnRFZGdlcyA9IGNsbS5nZXRJbkVkZ2VzQnlUeXBlKHNvdXJjZVBpbiwgJ0hBU19QSU4nKTtcbiAgICAgIGlmIChwYXJlbnRFZGdlcy5sZW5ndGggPT09IDApIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBwYXJlbnRCbG9ja0lkID0gcGFyZW50RWRnZXNbMF0uc291cmNlO1xuICAgICAgY29uc3QgcGFyZW50QmxvY2tEYXRhID0gY2xtLmdldE5vZGVEYXRhPEZCREJsb2NrTm9kZURhdGE+KHBhcmVudEJsb2NrSWQpO1xuXG4gICAgICBpZiAocGFyZW50QmxvY2tEYXRhLmJsb2NrVHlwZSA9PT0gJ0lOX1ZBUklBQkxFJykge1xuICAgICAgICBjb25zdCByZWFkcyA9IGNsbS5nZXRPdXRFZGdlc0J5VHlwZShwYXJlbnRCbG9ja0lkLCAnUkVBRFMnKTtcbiAgICAgICAgaWYgKHJlYWRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjb25zdCB0YWdOYW1lID0gc2FuaXRpemVOYW1lKChjbG0uZ2V0Tm9kZURhdGE8VGFnTm9kZURhdGE+KHJlYWRzWzBdLnRhcmdldCkpLm5hbWUpO1xuICAgICAgICAgIGlucHV0UGFyYW1zLnB1c2goYCR7cGluRGF0YS5waW5OYW1lfSA6PSAke3RhZ05hbWV9YCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHBpbkRhdGEuZGlyZWN0aW9uID09PSAnb3V0Jykge1xuICAgICAgLy8gT3V0cHV0IHBpbiB3aXJlZCB0byBhbiBPVVRfVkFSSUFCTEUgXHUyMDE0IGVtaXQgYXMgcG9zdC1jYWxsIGFzc2lnbm1lbnQ6IHRhZyA6PSBpbnN0YW5jZS5waW5cbiAgICAgIGNvbnN0IG91dFdpcmVzID0gY2xtLmdldE91dEVkZ2VzQnlUeXBlKGVkZ2UudGFyZ2V0LCAnV0lSRScpO1xuICAgICAgaWYgKG91dFdpcmVzLmxlbmd0aCA9PT0gMCkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IHRhcmdldFBpbiA9IG91dFdpcmVzWzBdLnRhcmdldDtcbiAgICAgIGNvbnN0IHBhcmVudEVkZ2VzID0gY2xtLmdldEluRWRnZXNCeVR5cGUodGFyZ2V0UGluLCAnSEFTX1BJTicpO1xuICAgICAgaWYgKHBhcmVudEVkZ2VzLmxlbmd0aCA9PT0gMCkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IHRhcmdldEJsb2NrSWQgPSBwYXJlbnRFZGdlc1swXS5zb3VyY2U7XG4gICAgICBjb25zdCB0YXJnZXRCbG9ja0RhdGEgPSBjbG0uZ2V0Tm9kZURhdGE8RkJEQmxvY2tOb2RlRGF0YT4odGFyZ2V0QmxvY2tJZCk7XG5cbiAgICAgIGlmICh0YXJnZXRCbG9ja0RhdGEuYmxvY2tUeXBlID09PSAnT1VUX1ZBUklBQkxFJykge1xuICAgICAgICBjb25zdCB3cml0ZXMgPSBjbG0uZ2V0T3V0RWRnZXNCeVR5cGUodGFyZ2V0QmxvY2tJZCwgJ1dSSVRFUycpO1xuICAgICAgICBpZiAod3JpdGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjb25zdCB0YWdOYW1lID0gc2FuaXRpemVOYW1lKChjbG0uZ2V0Tm9kZURhdGE8VGFnTm9kZURhdGE+KHdyaXRlc1swXS50YXJnZXQpKS5uYW1lKTtcbiAgICAgICAgICAvLyBibG9ja0lkIGlzIHRoZSBGQiBpbnN0YW5jZSBibG9jayBcdTIwMTQgbmVlZCBpbnN0YW5jZU5hbWUgZnJvbSBpdHMgZGF0YVxuICAgICAgICAgIGNvbnN0IGJsb2NrRGF0YSA9IGNsbS5nZXROb2RlRGF0YTxGQkRCbG9ja05vZGVEYXRhPihibG9ja0lkKTtcbiAgICAgICAgICBjb25zdCBpbnN0YW5jZU5hbWUgPSBzYW5pdGl6ZU5hbWUoYmxvY2tEYXRhLmluc3RhbmNlTmFtZSA/PyBgX0ZCXyR7YmxvY2tJZH1gKTtcbiAgICAgICAgICBvdXRwdXRBc3NpZ25tZW50cy5wdXNoKGAgICR7dGFnTmFtZX0gOj0gJHtpbnN0YW5jZU5hbWV9LiR7cGluRGF0YS5waW5OYW1lfTtgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7IGlucHV0UGFyYW1zLCBvdXRwdXRBc3NpZ25tZW50cyB9O1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgRkJEIENvbWJpbmF0b3JpYWwgRXhwcmVzc2lvbiBGb2xkaW5nIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gQ29udmVydHMgbG9naWMgZ2F0ZSBhbmQgYXJpdGhtZXRpYyBibG9ja3MgaW50byBpbmxpbmUgU1QgYXNzaWdubWVudCBzdGF0ZW1lbnRzLlxuLy8gT25seSBlbWl0cyBhbiBhc3NpZ25tZW50IHdoZW4gdGhpcyBibG9jaydzIG91dHB1dCBmZWVkcyBhbiBPVVRfVkFSSUFCTEUuXG5cbi8vIE1hcHMgRkJEIGJsb2NrIHR5cGUgdG8gdGhlIFNUIG9wZXJhdG9yIHVzZWQgd2hlbiBmb2xkaW5nIGlucHV0c1xuY29uc3QgQ09NQklOQVRPUl9PUFM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gIEFORDogJ0FORCcsIE9SOiAnT1InLCBYT1I6ICdYT1InLCBOT1Q6ICdOT1QnLFxuICBBREQ6ICcrJywgU1VCOiAnLScsIE1VTDogJyonLCBESVY6ICcvJywgTU9EOiAnTU9EJyxcbiAgRVE6ICc9JywgTkVROiAnPD4nLCBHVDogJz4nLCBHRVE6ICc+PScsIExUOiAnPCcsIExFUTogJzw9JyxcbiAgU0VMOiAnJywgICAvLyAyLWlucHV0IHNlbGVjdDogc3BlY2lhbCBjYXNlXG4gIE1VWDogJycsICAgLy8gbXVsdGktaW5wdXQgbXV4OiBzcGVjaWFsIGNhc2VcbiAgTU9WRTogJycsICAvLyBwYXNzLXRocm91Z2hcbiAgTUFYOiAnJywgICAvLyBzdGFuZGFyZCBmdW5jdGlvbiBjYWxsXG4gIE1JTjogJycsXG4gIEFCUzogJycsXG4gIFNRUlQ6ICcnLFxuICBMTjogJycsXG4gIExPRzogJycsXG4gIEVYUDogJycsXG4gIFNJTjogJycsXG4gIENPUzogJycsXG4gIFRBTjogJycsXG4gIEFTSU46ICcnLFxuICBBQ09TOiAnJyxcbiAgQVRBTjogJycsXG4gIFRSVU5DOiAnJyxcbiAgRVhQVDogJycsXG4gIExJTUlUOiAnJyxcbn07XG5cbi8vIFN0YW5kYXJkIElFQyA2MTEzMS0zIGZ1bmN0aW9ucyB0aGF0IHRha2UgY29tbWEtc2VwYXJhdGVkIGFyZ3NcbmNvbnN0IEZVTkNUSU9OX0JMT0NLU19ESVJFQ1QgPSBuZXcgU2V0KFtcbiAgJ01BWCcsICdNSU4nLCAnQUJTJywgJ1NRUlQnLCAnTE4nLCAnTE9HJywgJ0VYUCcsXG4gICdTSU4nLCAnQ09TJywgJ1RBTicsICdBU0lOJywgJ0FDT1MnLCAnQVRBTicsICdUUlVOQycsICdFWFBUJywgJ0xJTUlUJyxcbiAgJ1NFTCcsICdNVVgnLFxuXSk7XG5cbi8qKlxuICogUmVzb2x2ZSB0aGUgU1QgZXhwcmVzc2lvbiB0aGF0IHByb2R1Y2VzIGFuIGlucHV0IHBpbidzIHZhbHVlLlxuICogRm9sbG93cyBXSVJFIGVkZ2VzIGJhY2t3YXJkcyB0byBJTl9WQVJJQUJMRSBibG9ja3Mgb3IgcmV0dXJucyBhIGxpdGVyYWwuXG4gKi9cbmZ1bmN0aW9uIHJlc29sdmVQaW5FeHByKGNsbTogQ0xNR3JhcGgsIHBpbklkOiBzdHJpbmcsIF93YXJuaW5nczogc3RyaW5nW10pOiBzdHJpbmcge1xuICBjb25zdCBpbldpcmVzID0gY2xtLmdldEluRWRnZXNCeVR5cGUocGluSWQsICdXSVJFJyk7XG4gIGlmIChpbldpcmVzLmxlbmd0aCA9PT0gMCkge1xuICAgIC8vIE5vIHdpcmU6IGNoZWNrIGlmIHBpbiBoYXMgYSBkZWZhdWx0IGZyb20gaXRzIHBpbiBkYXRhXG4gICAgY29uc3QgcGQgPSBjbG0uZ2V0Tm9kZURhdGE8RkJEUGluTm9kZURhdGE+KHBpbklkKTtcbiAgICAvLyBVc2UgcGluIG5hbWUgYXMgbGFzdC1yZXNvcnQgZmFsbGJhY2sgc28gYXQgbWluaW11bSBjb21waWxhdGlvbiBzdWNjZWVkc1xuICAgIHJldHVybiBwZC5waW5OYW1lID8/ICdGQUxTRSc7XG4gIH1cblxuICBjb25zdCBzb3VyY2VQaW5JZCA9IGluV2lyZXNbMF0uc291cmNlO1xuICBjb25zdCBuZWdhdGVkID0gKGluV2lyZXNbMF0uZGF0YSBhcyBhbnkpPy5uZWdhdGVkO1xuICBjb25zdCBwYXJlbnRFZGdlcyA9IGNsbS5nZXRJbkVkZ2VzQnlUeXBlKHNvdXJjZVBpbklkLCAnSEFTX1BJTicpO1xuICBpZiAocGFyZW50RWRnZXMubGVuZ3RoID09PSAwKSByZXR1cm4gJ193aXJlX3NyY191bmtub3duJztcblxuICBjb25zdCBwYXJlbnRCbG9ja0lkID0gcGFyZW50RWRnZXNbMF0uc291cmNlO1xuICBjb25zdCBwYXJlbnRCbG9jayA9IGNsbS5nZXROb2RlRGF0YTxGQkRCbG9ja05vZGVEYXRhPihwYXJlbnRCbG9ja0lkKTtcblxuICBsZXQgZXhwcjogc3RyaW5nO1xuICBpZiAocGFyZW50QmxvY2suYmxvY2tUeXBlID09PSAnSU5fVkFSSUFCTEUnKSB7XG4gICAgY29uc3QgcmVhZHMgPSBjbG0uZ2V0T3V0RWRnZXNCeVR5cGUocGFyZW50QmxvY2tJZCwgJ1JFQURTJyk7XG4gICAgZXhwciA9IHJlYWRzLmxlbmd0aCA+IDBcbiAgICAgID8gc2FuaXRpemVOYW1lKChjbG0uZ2V0Tm9kZURhdGE8VGFnTm9kZURhdGE+KHJlYWRzWzBdLnRhcmdldCkpLm5hbWUpXG4gICAgICA6ICdfaW5fdmFyX3VuYm91bmQnO1xuICB9IGVsc2UgaWYgKENPTUJJTkFUT1JfT1BTW3BhcmVudEJsb2NrLmJsb2NrVHlwZV0gIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIFJlY3Vyc2l2ZWx5IGZvbGQgdGhpcyBibG9jaydzIGV4cHJlc3Npb25cbiAgICBleHByID0gYnVpbGRCbG9ja0V4cHIoY2xtLCBwYXJlbnRCbG9ja0lkLCBwYXJlbnRCbG9jaywgX3dhcm5pbmdzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBGQiBpbnN0YW5jZSBibG9jayBcdTIwMTQgcmVmZXJlbmNlIGluc3RhbmNlLm91dHB1dFBpblxuICAgIGNvbnN0IGluc3RhbmNlTmFtZSA9IHNhbml0aXplTmFtZShwYXJlbnRCbG9jay5pbnN0YW5jZU5hbWUgPz8gYF9GQl8ke3BhcmVudEJsb2NrSWR9YCk7XG4gICAgY29uc3Qgc291cmNlUGluRGF0YSA9IGNsbS5nZXROb2RlRGF0YTxGQkRQaW5Ob2RlRGF0YT4oc291cmNlUGluSWQpO1xuICAgIGV4cHIgPSBgJHtpbnN0YW5jZU5hbWV9LiR7c291cmNlUGluRGF0YS5waW5OYW1lfWA7XG4gIH1cblxuICByZXR1cm4gbmVnYXRlZCA/IGBOT1QgKCR7ZXhwcn0pYCA6IGV4cHI7XG59XG5cbi8qKlxuICogQnVpbGQgdGhlIFNUIGV4cHJlc3Npb24gZm9yIGEgY29tYmluYXRvcmlhbCBibG9jayBieSBmb2xkaW5nIGl0cyBpbnB1dCBwaW5zLlxuICovXG5mdW5jdGlvbiBidWlsZEJsb2NrRXhwcihcbiAgY2xtOiBDTE1HcmFwaCxcbiAgYmxvY2tJZDogc3RyaW5nLFxuICBibG9ja0RhdGE6IEZCREJsb2NrTm9kZURhdGEsXG4gIHdhcm5pbmdzOiBzdHJpbmdbXSxcbik6IHN0cmluZyB7XG4gIGNvbnN0IGJ0eXBlID0gYmxvY2tEYXRhLmJsb2NrVHlwZTtcbiAgY29uc3QgcGluRWRnZXMgPSBjbG0uZ2V0T3V0RWRnZXNCeVR5cGUoYmxvY2tJZCwgJ0hBU19QSU4nKTtcbiAgY29uc3QgaW5QaW5zID0gcGluRWRnZXNcbiAgICAubWFwKGUgPT4gKHsgaWQ6IGUudGFyZ2V0LCBkYXRhOiBjbG0uZ2V0Tm9kZURhdGE8RkJEUGluTm9kZURhdGE+KGUudGFyZ2V0KSB9KSlcbiAgICAuZmlsdGVyKHAgPT4gcC5kYXRhLmRpcmVjdGlvbiA9PT0gJ2luJyk7XG5cbiAgY29uc3QgaW5wdXRFeHBycyA9IGluUGlucy5tYXAocCA9PiByZXNvbHZlUGluRXhwcihjbG0sIHAuaWQsIHdhcm5pbmdzKSk7XG5cbiAgaWYgKGJ0eXBlID09PSAnTk9UJykge1xuICAgIHJldHVybiBgTk9UICgke2lucHV0RXhwcnNbMF0gPz8gJ0ZBTFNFJ30pYDtcbiAgfVxuICBpZiAoYnR5cGUgPT09ICdNT1ZFJykge1xuICAgIHJldHVybiBpbnB1dEV4cHJzWzBdID8/ICdGQUxTRSc7XG4gIH1cbiAgaWYgKEZVTkNUSU9OX0JMT0NLU19ESVJFQ1QuaGFzKGJ0eXBlKSkge1xuICAgIHJldHVybiBgJHtidHlwZX0oJHtpbnB1dEV4cHJzLmpvaW4oJywgJyl9KWA7XG4gIH1cblxuICBjb25zdCBvcCA9IENPTUJJTkFUT1JfT1BTW2J0eXBlXTtcbiAgaWYgKG9wICYmIGlucHV0RXhwcnMubGVuZ3RoID49IDIpIHtcbiAgICByZXR1cm4gaW5wdXRFeHBycy5tYXAoZSA9PiBgKCR7ZX0pYCkuam9pbihgICR7b3B9IGApO1xuICB9XG4gIGlmIChvcCAmJiBpbnB1dEV4cHJzLmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBpbnB1dEV4cHJzWzBdO1xuICB9XG5cbiAgd2FybmluZ3MucHVzaChgRkJEIGJsb2NrICR7YnR5cGV9IGhhcyB1bnJlY29nbmlzZWQgY29tYmluYXRvciBwYXR0ZXJuIFx1MjAxNCB1c2luZyBUUlVFYCk7XG4gIHJldHVybiAnVFJVRSc7XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGNvbWJpbmF0b3JpYWwgLyBhcml0aG1ldGljIEZCRCBibG9jayB0byBTVCBhc3NpZ25tZW50IHN0YXRlbWVudHMuXG4gKiBFbWl0cyBvbmUgYXNzaWdubWVudCBwZXIgb3V0cHV0IHBpbiB0aGF0IGlzIHdpcmVkIHRvIGFuIE9VVF9WQVJJQUJMRS5cbiAqL1xuZnVuY3Rpb24gY29tcGlsZUZCRENvbWJpbmF0b3JpYWwoXG4gIGNsbTogQ0xNR3JhcGgsXG4gIGJsb2NrSWQ6IHN0cmluZyxcbiAgYmxvY2tEYXRhOiBGQkRCbG9ja05vZGVEYXRhLFxuICB3YXJuaW5nczogc3RyaW5nW10sXG4pOiBzdHJpbmdbXSB7XG4gIGNvbnN0IGJ0eXBlID0gYmxvY2tEYXRhLmJsb2NrVHlwZTtcbiAgaWYgKCEoYnR5cGUgaW4gQ09NQklOQVRPUl9PUFMpKSB7XG4gICAgd2FybmluZ3MucHVzaChgRkJEIGJsb2NrIHR5cGUgXCIke2J0eXBlfVwiIG5vdCBpbiBjb21iaW5hdG9yIHRhYmxlIFx1MjAxNCBza2lwcGVkYCk7XG4gICAgcmV0dXJuIFtgICAoKiBGQkQgJHtidHlwZX0gJHtibG9ja0lkfSBcdTIwMTQgdW5rbm93biBibG9jayB0eXBlLCBza2lwcGVkICopYF07XG4gIH1cblxuICBjb25zdCBwaW5FZGdlcyA9IGNsbS5nZXRPdXRFZGdlc0J5VHlwZShibG9ja0lkLCAnSEFTX1BJTicpO1xuICBjb25zdCBvdXRQaW5zID0gcGluRWRnZXNcbiAgICAubWFwKGUgPT4gKHsgaWQ6IGUudGFyZ2V0LCBkYXRhOiBjbG0uZ2V0Tm9kZURhdGE8RkJEUGluTm9kZURhdGE+KGUudGFyZ2V0KSB9KSlcbiAgICAuZmlsdGVyKHAgPT4gcC5kYXRhLmRpcmVjdGlvbiA9PT0gJ291dCcpO1xuXG4gIGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuICBmb3IgKGNvbnN0IG91dFBpbiBvZiBvdXRQaW5zKSB7XG4gICAgY29uc3Qgb3V0V2lyZXMgPSBjbG0uZ2V0T3V0RWRnZXNCeVR5cGUob3V0UGluLmlkLCAnV0lSRScpO1xuICAgIGZvciAoY29uc3Qgb3V0V2lyZSBvZiBvdXRXaXJlcykge1xuICAgICAgY29uc3QgdGFyZ2V0UGluUGFyZW50cyA9IGNsbS5nZXRJbkVkZ2VzQnlUeXBlKG91dFdpcmUudGFyZ2V0LCAnSEFTX1BJTicpO1xuICAgICAgaWYgKHRhcmdldFBpblBhcmVudHMubGVuZ3RoID09PSAwKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHRhcmdldEJsb2NrSWQgPSB0YXJnZXRQaW5QYXJlbnRzWzBdLnNvdXJjZTtcbiAgICAgIGNvbnN0IHRhcmdldEJsb2NrID0gY2xtLmdldE5vZGVEYXRhPEZCREJsb2NrTm9kZURhdGE+KHRhcmdldEJsb2NrSWQpO1xuXG4gICAgICBpZiAodGFyZ2V0QmxvY2suYmxvY2tUeXBlID09PSAnT1VUX1ZBUklBQkxFJykge1xuICAgICAgICBjb25zdCB3cml0ZUVkZ2VzID0gY2xtLmdldE91dEVkZ2VzQnlUeXBlKHRhcmdldEJsb2NrSWQsICdXUklURVMnKTtcbiAgICAgICAgaWYgKHdyaXRlRWRnZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGNvbnN0IGRlc3RUYWcgPSBzYW5pdGl6ZU5hbWUoKGNsbS5nZXROb2RlRGF0YTxUYWdOb2RlRGF0YT4od3JpdGVFZGdlc1swXS50YXJnZXQpKS5uYW1lKTtcbiAgICAgICAgICBjb25zdCBleHByID0gYnVpbGRCbG9ja0V4cHIoY2xtLCBibG9ja0lkLCBibG9ja0RhdGEsIHdhcm5pbmdzKTtcbiAgICAgICAgICBsaW5lcy5wdXNoKGAgICR7ZGVzdFRhZ30gOj0gJHtleHByfTtgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBsaW5lcztcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFNGQyBcdTIxOTIgU1QgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGNvbXBpbGVTRkNUb1NUKGNsbTogQ0xNR3JhcGgsIHN0ZXBJZHM6IHN0cmluZ1tdLCB3YXJuaW5nczogc3RyaW5nW10pOiBzdHJpbmdbXSB7XG4gIC8vIFNGQyBcdTIxOTIgU1Q6IGVuY29kZSBzdGF0ZSBtYWNoaW5lIGFzIGFuIElOVCBzdGF0ZSB2YXJpYWJsZSArIENBU0Ugc3RhdGVtZW50XG4gIC8vIFRoaXMgaXMgYSBzdGFuZGFyZCwgbm9uLXByb3ByaWV0YXJ5IHRyYW5zZm9ybWF0aW9uLlxuICBjb25zdCBzdGVwcyA9IHN0ZXBJZHMubWFwKGlkID0+ICh7XG4gICAgaWQsXG4gICAgZGF0YTogY2xtLmdldE5vZGVEYXRhPFNGQ1N0ZXBOb2RlRGF0YT4oaWQpLFxuICB9KSk7XG5cbiAgY29uc3QgaW5pdGlhbFN0ZXAgPSBzdGVwcy5maW5kKHMgPT4gcy5kYXRhLmlzSW5pdGlhbCkgPz8gc3RlcHNbMF07XG4gIGlmICghaW5pdGlhbFN0ZXApIHJldHVybiBbXTtcblxuICBjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXTtcbiAgbGluZXMucHVzaCgnICAoKiBTRkMgZW5jb2RlZCBhcyBzdGF0ZSBtYWNoaW5lICopJyk7XG5cbiAgLy8gU3RhdGUgdmFyaWFibGUgKGRlY2xhcmVkIGlubGluZSBcdTIwMTQgVkFSIHNlY3Rpb24gaGFuZGxlcyBpdCBhdCB0b3AgbGV2ZWwpXG4gIC8vIFdlIHVzZSBzdGVwIGluZGV4IGFzIHN0YXRlIG51bWJlclxuICBjb25zdCBzdGVwSW5kZXhNYXAgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICBzdGVwcy5mb3JFYWNoKChzLCBpKSA9PiBzdGVwSW5kZXhNYXAuc2V0KHMuaWQsIGkpKTtcblxuICBjb25zdCBpbml0aWFsU3RhdGUgPSBzdGVwSW5kZXhNYXAuZ2V0KGluaXRpYWxTdGVwLmlkKSA/PyAwO1xuICBsaW5lcy5wdXNoKGAgIElGIF9TRkNfU1RBVEUgPSAtMSBUSEVOIF9TRkNfU1RBVEUgOj0gJHtpbml0aWFsU3RhdGV9OyBFTkRfSUY7YCk7XG4gIGxpbmVzLnB1c2goJycpO1xuICBsaW5lcy5wdXNoKCcgIENBU0UgX1NGQ19TVEFURSBPRicpO1xuXG4gIGZvciAoY29uc3Qgc3RlcCBvZiBzdGVwcykge1xuICAgIGNvbnN0IHN0YXRlTnVtID0gc3RlcEluZGV4TWFwLmdldChzdGVwLmlkKSE7XG4gICAgbGluZXMucHVzaChgICAgICR7c3RhdGVOdW19OiAoKiAke3N0ZXAuZGF0YS5zdGVwTmFtZX0gKilgKTtcblxuICAgIC8vIEVtaXQgYWN0aW9ucyBmb3IgdGhpcyBzdGVwIFx1MjAxNCB1c2UgdXBkYXRlZCBzZmNBY3Rpb25Ub1NUIHdpdGggdGltZWQgcXVhbGlmaWVyIHN1cHBvcnRcbiAgICBjb25zdCBhY3Rpb25FZGdlcyA9IGNsbS5nZXRPdXRFZGdlc0J5VHlwZShzdGVwLmlkLCAnSEFTX0FDVElPTicpO1xuICAgIGZvciAoY29uc3QgZWRnZSBvZiBhY3Rpb25FZGdlcykge1xuICAgICAgY29uc3QgYWN0aW9uRGF0YSA9IGNsbS5nZXROb2RlRGF0YTxTRkNBY3Rpb25Ob2RlRGF0YT4oZWRnZS50YXJnZXQpO1xuICAgICAgY29uc3Qgd3JpdGVzID0gY2xtLmdldE91dEVkZ2VzQnlUeXBlKGVkZ2UudGFyZ2V0LCAnV1JJVEVTJyk7XG4gICAgICBjb25zdCB0YWdOYW1lID0gd3JpdGVzLmxlbmd0aCA+IDBcbiAgICAgICAgPyBzYW5pdGl6ZU5hbWUoKGNsbS5nZXROb2RlRGF0YTxUYWdOb2RlRGF0YT4od3JpdGVzWzBdLnRhcmdldCkpLm5hbWUpXG4gICAgICAgIDogJ19VTktOT1dOJztcblxuICAgICAgY29uc3QgYWN0aW9uTGluZXMgPSBzZmNBY3Rpb25Ub1NUKGFjdGlvbkRhdGEsIHRhZ05hbWUsICdfU0ZDX1NUQVRFJywgc3RhdGVOdW0pO1xuICAgICAgbGluZXMucHVzaCguLi5hY3Rpb25MaW5lcyk7XG4gICAgfVxuXG4gICAgLy8gT3V0Z29pbmcgU0ZDX0ZMT1cgZWRnZXMgXHUyMTkyIGZpbmQgbmV4dCBzdGVwcyB2aWEgdHJhbnNpdGlvbnNcbiAgICBjb25zdCBvdXRmbG93cyA9IGNsbS5nZXRPdXRFZGdlc0J5VHlwZShzdGVwLmlkLCAnU0ZDX0ZMT1cnKTtcbiAgICBmb3IgKGNvbnN0IGZsb3cgb2Ygb3V0Zmxvd3MpIHtcbiAgICAgIGNvbnN0IHRhcmdldElkID0gZmxvdy50YXJnZXQ7XG4gICAgICBjb25zdCB0YXJnZXRBdHRyID0gY2xtLmdldE5vZGVBdHRyKHRhcmdldElkKTtcblxuICAgICAgaWYgKHRhcmdldEF0dHIudHlwZSA9PT0gJ1NGQ19UUkFOU0lUSU9OJykge1xuICAgICAgICBjb25zdCB0cmFuc0RhdGEgPSBjbG0uZ2V0Tm9kZURhdGE8U0ZDVHJhbnNpdGlvbk5vZGVEYXRhPih0YXJnZXRJZCk7XG4gICAgICAgIGNvbnN0IHRyYW5zT3V0Zmxvd3MgPSBjbG0uZ2V0T3V0RWRnZXNCeVR5cGUodGFyZ2V0SWQsICdTRkNfRkxPVycpO1xuXG4gICAgICAgIGZvciAoY29uc3QgbmV4dEZsb3cgb2YgdHJhbnNPdXRmbG93cykge1xuICAgICAgICAgIGNvbnN0IG5leHRTdGVwSWQgPSBuZXh0Rmxvdy50YXJnZXQ7XG4gICAgICAgICAgY29uc3QgbmV4dFN0YXRlID0gc3RlcEluZGV4TWFwLmdldChuZXh0U3RlcElkKTtcbiAgICAgICAgICBpZiAobmV4dFN0YXRlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbmQgPSB0cmFuc0RhdGEuY29uZGl0aW9uRXhwciB8fCAnVFJVRSc7XG4gICAgICAgICAgICBsaW5lcy5wdXNoKGAgICAgICBJRiAke2NvbmR9IFRIRU4gX1NGQ19TVEFURSA6PSAke25leHRTdGF0ZX07IEVORF9JRjtgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgbGluZXMucHVzaCgnJyk7XG4gIH1cblxuICBsaW5lcy5wdXNoKCcgIEVORF9DQVNFOycpO1xuICByZXR1cm4gbGluZXM7XG59XG5cbmZ1bmN0aW9uIHNmY0FjdGlvblRvU1QoYWN0aW9uOiBTRkNBY3Rpb25Ob2RlRGF0YSwgdGFnTmFtZTogc3RyaW5nLCBzdGVwU3RhdGVWYXI6IHN0cmluZywgc3RhdGVOdW06IG51bWJlcik6IHN0cmluZ1tdIHtcbiAgY29uc3QgZHVyID0gYWN0aW9uLmR1cmF0aW9uID8gYFQjJHthY3Rpb24uZHVyYXRpb259YCA6ICdUIzBtcyc7XG4gIGNvbnN0IHRpbWVyVmFyID0gYF9TRkNfVE1SXyR7dGFnTmFtZX1fJHtzdGF0ZU51bX1gO1xuXG4gIHN3aXRjaCAoYWN0aW9uLnF1YWxpZmllcikge1xuICAgIGNhc2UgJ04nOlxuICAgICAgLy8gTm9uLXN0b3JlZDogYWN0aXZlIGV4YWN0bHkgd2hpbGUgc3RlcCBpcyBhY3RpdmVcbiAgICAgIHJldHVybiBbYCAgICAgICR7dGFnTmFtZX0gOj0gVFJVRTsgICAoKiBOOiBhY3RpdmUgd2hpbGUgc3RlcCAke3N0YXRlTnVtfSBpcyBhY3RpdmUgKilgXTtcblxuICAgIGNhc2UgJ1MnOlxuICAgICAgLy8gU2V0OiBsYXRjaCBvbiwgcmVtYWlucyBhZnRlciBzdGVwIGV4aXRzXG4gICAgICByZXR1cm4gW2AgICAgICAke3RhZ05hbWV9IDo9IFRSVUU7ICAgKCogUzogc2V0IC0gcmVtYWlucyBsYXRjaGVkICopYF07XG5cbiAgICBjYXNlICdSJzpcbiAgICAgIC8vIFJlc2V0OiB1bmxhdGNoXG4gICAgICByZXR1cm4gW2AgICAgICAke3RhZ05hbWV9IDo9IEZBTFNFOyAgKCogUjogcmVzZXQgLSB1bmxhdGNoICopYF07XG5cbiAgICBjYXNlICdQJzpcbiAgICBjYXNlICdQMSc6IHtcbiAgICAgIC8vIFBvc2l0aXZlIHB1bHNlOiBmaXJlIG9uY2Ugb24gc3RlcCBlbnRyeSB1c2luZyBhIG9uZS1zaG90IGZsYWdcbiAgICAgIGNvbnN0IGVkZ2VWYXIgPSBgX1NGQ19QMV8ke3RhZ05hbWV9XyR7c3RhdGVOdW19YDtcbiAgICAgIHJldHVybiBbXG4gICAgICAgIGAgICAgICBJRiBOT1QgJHtlZGdlVmFyfSBUSEVOICR7dGFnTmFtZX0gOj0gVFJVRTsgJHtlZGdlVmFyfSA6PSBUUlVFOyBFTkRfSUY7ICgqIFAxOiByaXNpbmcgcHVsc2UgKilgLFxuICAgICAgXTtcbiAgICB9XG5cbiAgICBjYXNlICdQMCc6IHtcbiAgICAgIC8vIE5lZ2F0aXZlIHB1bHNlOiBmaXJlIG9uY2Ugb24gc3RlcCBleGl0IFx1MjAxNCBkZXRlY3RlZCBieSBfcHJldiBzdGF0ZSB2YXJpYWJsZVxuICAgICAgY29uc3QgZWRnZVZhciA9IGBfU0ZDX1AwXyR7dGFnTmFtZX1fJHtzdGF0ZU51bX1gO1xuICAgICAgcmV0dXJuIFtcbiAgICAgICAgYCAgICAgICR7ZWRnZVZhcn0gOj0gVFJVRTsgKCogUDA6IGZhbGxpbmcgcHVsc2UgYXJtIFx1MjAxNCBmaXJlcyBvbiBleGl0ICopYCxcbiAgICAgIF07XG4gICAgfVxuXG4gICAgY2FzZSAnTCc6XG4gICAgICAvLyBUaW1lLWxpbWl0ZWQ6IGFjdGl2ZSB3aGlsZSBzdGVwIGFjdGl2ZSBBTkQgZWxhcHNlZCA8IGR1cmF0aW9uXG4gICAgICByZXR1cm4gW1xuICAgICAgICBgICAgICAgJHt0aW1lclZhcn0oSU4gOj0gKCR7c3RlcFN0YXRlVmFyfSA9ICR7c3RhdGVOdW19KSwgUFQgOj0gJHtkdXJ9KTtgLFxuICAgICAgICBgICAgICAgSUYgTk9UICR7dGltZXJWYXJ9LlEgVEhFTiAke3RhZ05hbWV9IDo9IFRSVUU7IEVMU0UgJHt0YWdOYW1lfSA6PSBGQUxTRTsgRU5EX0lGOyAoKiBMOiB0aW1lLWxpbWl0ZWQgKilgLFxuICAgICAgXTtcblxuICAgIGNhc2UgJ0QnOlxuICAgICAgLy8gVGltZS1kZWxheWVkOiBhY3RpdmUgb25seSBBRlRFUiBkdXJhdGlvbiBoYXMgZWxhcHNlZCB3aGlsZSBzdGVwIGFjdGl2ZVxuICAgICAgcmV0dXJuIFtcbiAgICAgICAgYCAgICAgICR7dGltZXJWYXJ9KElOIDo9ICgke3N0ZXBTdGF0ZVZhcn0gPSAke3N0YXRlTnVtfSksIFBUIDo9ICR7ZHVyfSk7YCxcbiAgICAgICAgYCAgICAgICR7dGFnTmFtZX0gOj0gJHt0aW1lclZhcn0uUTsgICAoKiBEOiBkZWxheWVkIGFjdGl2YXRpb24gKilgLFxuICAgICAgXTtcblxuICAgIGNhc2UgJ1NEJzpcbiAgICAgIC8vIFN0b3JlZC1kZWxheWVkOiBzZXQgYWZ0ZXIgZGVsYXksIHJlbWFpbnMgc2V0IGFmdGVyIHN0ZXAgZXhpdHNcbiAgICAgIHJldHVybiBbXG4gICAgICAgIGAgICAgICAke3RpbWVyVmFyfShJTiA6PSAoJHtzdGVwU3RhdGVWYXJ9ID0gJHtzdGF0ZU51bX0pLCBQVCA6PSAke2R1cn0pO2AsXG4gICAgICAgIGAgICAgICBJRiAke3RpbWVyVmFyfS5RIFRIRU4gJHt0YWdOYW1lfSA6PSBUUlVFOyBFTkRfSUY7ICgqIFNEOiBzdG9yZWQtZGVsYXllZCBzZXQgKilgLFxuICAgICAgXTtcblxuICAgIGNhc2UgJ0RTJzpcbiAgICAgIC8vIERlbGF5ZWQtc3RvcmVkOiBsaWtlIFNEIGJ1dCBvbmx5IHNldHMgaWYgc3RlcCBzdGlsbCBhY3RpdmUgd2hlbiB0aW1lciBmaXJlc1xuICAgICAgcmV0dXJuIFtcbiAgICAgICAgYCAgICAgICR7dGltZXJWYXJ9KElOIDo9ICgke3N0ZXBTdGF0ZVZhcn0gPSAke3N0YXRlTnVtfSksIFBUIDo9ICR7ZHVyfSk7YCxcbiAgICAgICAgYCAgICAgIElGICR7dGltZXJWYXJ9LlEgQU5EICgke3N0ZXBTdGF0ZVZhcn0gPSAke3N0YXRlTnVtfSkgVEhFTiAke3RhZ05hbWV9IDo9IFRSVUU7IEVORF9JRjsgKCogRFM6IGRlbGF5ZWQtc3RvcmVkICopYCxcbiAgICAgIF07XG5cbiAgICBjYXNlICdTTCc6XG4gICAgICAvLyBTdG9yZWQtdGltZS1saW1pdGVkOiBzZXQgb24gZW50cnksIHJlc2V0cyBhZnRlciBkdXJhdGlvblxuICAgICAgcmV0dXJuIFtcbiAgICAgICAgYCAgICAgIElGICR7c3RlcFN0YXRlVmFyfSA9ICR7c3RhdGVOdW19IFRIRU4gJHt0YWdOYW1lfSA6PSBUUlVFOyBFTkRfSUY7YCxcbiAgICAgICAgYCAgICAgICR7dGltZXJWYXJ9KElOIDo9ICR7dGFnTmFtZX0sIFBUIDo9ICR7ZHVyfSk7YCxcbiAgICAgICAgYCAgICAgIElGICR7dGltZXJWYXJ9LlEgVEhFTiAke3RhZ05hbWV9IDo9IEZBTFNFOyBFTkRfSUY7ICgqIFNMOiBzdG9yZWQtbGltaXRlZCAqKWAsXG4gICAgICBdO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBbYCAgICAgICR7dGFnTmFtZX0gOj0gVFJVRTsgICAoKiAke2FjdGlvbi5xdWFsaWZpZXJ9OiB1bnJlY29nbmlzZWQgcXVhbGlmaWVyICopYF07XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEZCIGluc3RhbmNlIFZBUiBjb2xsZWN0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBjb2xsZWN0RkJJbnN0YW5jZVZhcnMoY2xtOiBDTE1HcmFwaCk6IHN0cmluZ1tdIHtcbiAgY29uc3QgdmFyczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3Qgc2VlbiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gIC8vIExEIGZiX2NhbGwgZWxlbWVudHNcbiAgZm9yIChjb25zdCBub2RlSWQgb2YgY2xtLmdldE5vZGVzQnlUeXBlKCdMRF9FTEVNRU5UJykpIHtcbiAgICBjb25zdCBkYXRhID0gY2xtLmdldE5vZGVEYXRhPExERWxlbWVudE5vZGVEYXRhPihub2RlSWQpO1xuICAgIGlmIChkYXRhLmVsZW1lbnRLaW5kID09PSAnZmJfY2FsbCcgJiYgZGF0YS5pbnN0YW5jZU5hbWUgJiYgZGF0YS5mYlR5cGUpIHtcbiAgICAgIGNvbnN0IG5hbWUgPSBzYW5pdGl6ZU5hbWUoZGF0YS5pbnN0YW5jZU5hbWUpO1xuICAgICAgaWYgKCFzZWVuLmhhcyhuYW1lKSkge1xuICAgICAgICBzZWVuLmFkZChuYW1lKTtcbiAgICAgICAgdmFycy5wdXNoKGAgICAgJHtuYW1lfSA6ICR7ZGF0YS5mYlR5cGV9O2ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEZCRCBmdW5jdGlvbi1ibG9jayBibG9ja3NcbiAgZm9yIChjb25zdCBub2RlSWQgb2YgY2xtLmdldE5vZGVzQnlUeXBlKCdGQkRfQkxPQ0snKSkge1xuICAgIGNvbnN0IGRhdGEgPSBjbG0uZ2V0Tm9kZURhdGE8RkJEQmxvY2tOb2RlRGF0YT4obm9kZUlkKTtcbiAgICBpZiAoaXNGdW5jdGlvbkJsb2NrKGRhdGEuYmxvY2tUeXBlKSAmJiBkYXRhLmluc3RhbmNlTmFtZSkge1xuICAgICAgY29uc3QgbmFtZSA9IHNhbml0aXplTmFtZShkYXRhLmluc3RhbmNlTmFtZSk7XG4gICAgICBpZiAoIXNlZW4uaGFzKG5hbWUpKSB7XG4gICAgICAgIHNlZW4uYWRkKG5hbWUpO1xuICAgICAgICB2YXJzLnB1c2goYCAgICAke25hbWV9IDogJHtkYXRhLmJsb2NrVHlwZX07YCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gU0ZDIHN0YXRlIHZhcmlhYmxlIGFuZCB0aW1lZC1xdWFsaWZpZXIgdGltZXIgaW5zdGFuY2VzXG4gIGNvbnN0IHNmY1N0ZXBzID0gY2xtLmdldE5vZGVzQnlUeXBlKCdTRkNfU1RFUCcpO1xuICBpZiAoc2ZjU3RlcHMubGVuZ3RoID4gMCkge1xuICAgIHZhcnMucHVzaCgnICAgIF9TRkNfU1RBVEUgOiBJTlQgOj0gLTE7Jyk7XG5cbiAgICBzZmNTdGVwcy5mb3JFYWNoKChzdGVwSWQsIHN0YXRlTnVtKSA9PiB7XG4gICAgICBjb25zdCBhY3Rpb25FZGdlcyA9IGNsbS5nZXRPdXRFZGdlc0J5VHlwZShzdGVwSWQsICdIQVNfQUNUSU9OJyk7XG4gICAgICBmb3IgKGNvbnN0IGFlIG9mIGFjdGlvbkVkZ2VzKSB7XG4gICAgICAgIGNvbnN0IGFjdGlvbkRhdGEgPSBjbG0uZ2V0Tm9kZURhdGE8U0ZDQWN0aW9uTm9kZURhdGE+KGFlLnRhcmdldCk7XG4gICAgICAgIGNvbnN0IHdyaXRlcyA9IGNsbS5nZXRPdXRFZGdlc0J5VHlwZShhZS50YXJnZXQsICdXUklURVMnKTtcbiAgICAgICAgY29uc3QgdGFnTmFtZSA9IHdyaXRlcy5sZW5ndGggPiAwXG4gICAgICAgICAgPyBzYW5pdGl6ZU5hbWUoKGNsbS5nZXROb2RlRGF0YTxUYWdOb2RlRGF0YT4od3JpdGVzWzBdLnRhcmdldCkpLm5hbWUpXG4gICAgICAgICAgOiAnX1VOS05PV04nO1xuXG4gICAgICAgIGNvbnN0IHRpbWVkUXVhbGlmaWVycyA9IG5ldyBTZXQoWydMJywgJ0QnLCAnU0QnLCAnRFMnLCAnU0wnXSk7XG4gICAgICAgIGlmICh0aW1lZFF1YWxpZmllcnMuaGFzKGFjdGlvbkRhdGEucXVhbGlmaWVyKSkge1xuICAgICAgICAgIGNvbnN0IHRpbWVyVmFyID0gYF9TRkNfVE1SXyR7dGFnTmFtZX1fJHtzdGF0ZU51bX1gO1xuICAgICAgICAgIGlmICghc2Vlbi5oYXModGltZXJWYXIpKSB7XG4gICAgICAgICAgICBzZWVuLmFkZCh0aW1lclZhcik7XG4gICAgICAgICAgICB2YXJzLnB1c2goYCAgICAke3RpbWVyVmFyfSA6IFRPTjtgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gUDAvUDEgb25lLXNob3QgZmxhZ3NcbiAgICAgICAgaWYgKGFjdGlvbkRhdGEucXVhbGlmaWVyID09PSAnUCcgfHwgYWN0aW9uRGF0YS5xdWFsaWZpZXIgPT09ICdQMScpIHtcbiAgICAgICAgICBjb25zdCBlZGdlVmFyID0gYF9TRkNfUDFfJHt0YWdOYW1lfV8ke3N0YXRlTnVtfWA7XG4gICAgICAgICAgaWYgKCFzZWVuLmhhcyhlZGdlVmFyKSkgeyBzZWVuLmFkZChlZGdlVmFyKTsgdmFycy5wdXNoKGAgICAgJHtlZGdlVmFyfSA6IEJPT0wgOj0gRkFMU0U7YCk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoYWN0aW9uRGF0YS5xdWFsaWZpZXIgPT09ICdQMCcpIHtcbiAgICAgICAgICBjb25zdCBlZGdlVmFyID0gYF9TRkNfUDBfJHt0YWdOYW1lfV8ke3N0YXRlTnVtfWA7XG4gICAgICAgICAgaWYgKCFzZWVuLmhhcyhlZGdlVmFyKSkgeyBzZWVuLmFkZChlZGdlVmFyKTsgdmFycy5wdXNoKGAgICAgJHtlZGdlVmFyfSA6IEJPT0wgOj0gRkFMU0U7YCk7IH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHZhcnM7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBIZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uQmxvY2soYmxvY2tUeXBlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgRkJfVFlQRVMgPSBuZXcgU2V0KFtcbiAgICAnVE9OJywgJ1RPRicsICdUUCcsICdDVFUnLCAnQ1REJywgJ0NUVUQnLFxuICAgICdTUicsICdSUycsICdSVFJJRycsICdGVFJJRycsXG4gIF0pO1xuICByZXR1cm4gRkJfVFlQRVMuaGFzKGJsb2NrVHlwZSk7XG59XG5cbmZ1bmN0aW9uIHNhbml0aXplTmFtZShuYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAvLyBJRUMgNjExMzEtMyBpZGVudGlmaWVyczogW0EtWmEtel9dW0EtWmEtejAtOV9dKlxuICByZXR1cm4gbmFtZS5yZXBsYWNlKC9bXkEtWmEtejAtOV9dL2csICdfJykucmVwbGFjZSgvXihbMC05XSkvLCAnXyQxJyk7XG59XG5cbmZ1bmN0aW9uIGRlZmF1bHRJbml0Rm9yKGR0OiBJRUNEYXRhVHlwZSk6IHN0cmluZyB7XG4gIHN3aXRjaCAoZHQpIHtcbiAgICBjYXNlICdCT09MJzogcmV0dXJuICcgOj0gRkFMU0UnO1xuICAgIGNhc2UgJ1JFQUwnOlxuICAgIGNhc2UgJ0xSRUFMJzogcmV0dXJuICcgOj0gMC4wJztcbiAgICBjYXNlICdTVFJJTkcnOlxuICAgIGNhc2UgJ1dTVFJJTkcnOiByZXR1cm4gXCIgOj0gJydcIjtcbiAgICBjYXNlICdUSU1FJzogcmV0dXJuICcgOj0gVCMwbXMnO1xuICAgIGNhc2UgJ0FSUkFZX0JPT0wnOiByZXR1cm4gJyc7ICAvLyBBUlJBWSB0eXBlIFx1MjAxNCBpbml0aWFsaXplciBzeW50YXggZGVwZW5kcyBvbiBkaW1lbnNpb25zOyBvbWl0XG4gICAgY2FzZSAnQVJSQVlfSU5UJzogIHJldHVybiAnJztcbiAgICBjYXNlICdBUlJBWV9SRUFMJzogcmV0dXJuICcnO1xuICAgIGNhc2UgJ1NUUlVDVCc6IHJldHVybiAnIDo9ICgpJztcbiAgICBkZWZhdWx0OiByZXR1cm4gJyA6PSAwJztcbiAgfVxufVxuXG4iXSwKICAibWFwcGluZ3MiOiAiQUF1Q0EsTUFBTSxtQkFBbUI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFB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
