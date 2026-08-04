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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjMi9wbGMtZWRpdG9yLXRzeC9jbG0vY2xtVG9TVC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLypcbiAqIENMTSBcdTIxOTIgU1QgQ29tcGlsZXJcbiAqIFRyYXZlcnNlcyBhIENMTUdyYXBoIGFuZCBlbWl0cyBJRUMgNjExMzEtMyBTdHJ1Y3R1cmVkIFRleHQuXG4gKlxuICogT3V0cHV0IGNvbnRyYWN0OlxuICogIC0gRW1pdHMgb25lIFBST0dSQU0gYmxvY2sgbmFtZWQgXCJwcm9nMFwiIChtYXRjaGVzIGVuc3VyZUNvbmZpZ3VyYXRpb24oKSBpbiBzZXJ2ZXIuanMpXG4gKiAgLSBWQVIgc2VjdGlvbiBsaXN0cyBldmVyeSBUQUcgbm9kZSByZWZlcmVuY2VkIGJ5IHRoZSBwcm9ncmFtXG4gKiAgLSBHbG9iYWwgdGFncyB3aXRoIGEgaGFyZHdhcmUgYWRkcmVzcyBnZXQgQVQgZGVjbGFyYXRpb25zICglSS8lUS8lTSlcbiAqICAtIExEIHJ1bmdzIFx1MjE5MiBTVCBJRi9FTkRfSUYgbGFkZGVyIHNlbWFudGljc1xuICogIC0gRkJEIGJsb2NrcyBcdTIxOTIgZnVuY3Rpb24tYmxvY2sgaW5zdGFuY2UgY2FsbHMgd2l0aCBuYW1lZCBwYXJhbWV0ZXJzXG4gKiAgLSBTRkMgXHUyMTkyIFNUIGVuY29kaW5nOiBvbmUgZW51bWVyYXRlZCBzdGF0ZSB2YXJpYWJsZSArIENBU0Ugc3RhdGVtZW50XG4gKiAgLSBXcmFwcGVkIGluIENPTkZJR1VSQVRJT04gQ29uZmlnMCAvIFJFU09VUkNFIFJlczAgc2NhZmZvbGRcbiAqXG4gKiBkZWJ1Zy1tYXAuanNvbiBwYXRoIGZvcm1hdCAoY29uZmlybWVkIGZyb20gcmVhbCBTVHJ1QysrIG91dHB1dCk6XG4gKiAgXCJJTlNUMC48VkFSTkFNRT5cIiBcdTIwMTQgdXBwZXJjYXNlIGluc3RhbmNlIG5hbWUgKEluc3QwIFx1MjE5MiBJTlNUMCksIHVwcGVyY2FzZSB2YXIgbmFtZS5cbiAqICBNYXBwaW5nIGZyb20gbG9naWNTdG9yZSBUYWdFbnRyeS5uYW1lOiBkZWJ1Z01hcC5sZWF2ZXMuZmluZChsID0+IGwucGF0aCA9PT0gXCJJTlNUMC5cIiArIHRhZy5uYW1lLnRvVXBwZXJDYXNlKCkpXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBDTE1HcmFwaCB9IGZyb20gJy4vZ3JhcGguanMnO1xuaW1wb3J0IHR5cGUge1xuICBUYWdOb2RlRGF0YSxcbiAgUE9VTm9kZURhdGEsXG4gIFJ1bmdOb2RlRGF0YSxcbiAgTERFbGVtZW50Tm9kZURhdGEsXG4gIExERWxlbWVudEtpbmQsXG4gIEZCREJsb2NrTm9kZURhdGEsXG4gIEZCRFBpbk5vZGVEYXRhLFxuICBTRkNTdGVwTm9kZURhdGEsXG4gIFNGQ1RyYW5zaXRpb25Ob2RlRGF0YSxcbiAgU0ZDQWN0aW9uTm9kZURhdGEsXG59IGZyb20gJy4vc2NoZW1hLmpzJztcbmltcG9ydCB0eXBlIHsgSUVDRGF0YVR5cGUgfSBmcm9tICcuLi9sb2dpY1N0b3JlLmpzJztcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIElFQyA2MTEzMS0zIFN0YW5kYXJkIEZCIERlY2xhcmF0aW9ucyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIFNUcnVDKysgZG9lcyBub3QgaGF2ZSBidWlsdC1pbiBzdGFuZGFyZCBsaWJyYXJ5IEZCcyBcdTIwMTQgdGhleSBtdXN0IGJlIGRlY2xhcmVkLlxuLy8gTWF0SUVDIHJlc29sdmVzIHRoZXNlIGZyb20gaXRzIHN0ZGxpYiAoLUkgbGliKSwgYnV0IFNUcnVDKysgaXMgcHVyZSBKUyB3aXRoXG4vLyBubyBmaWxlc3lzdGVtIGFjY2VzcyB0byBpZWMyYydzIGxpYiwgc28gd2UgaW5saW5lIG1pbmltYWwgc3R1YnMuXG4vLyBUaGVzZSBtYXRjaCB0aGUgSUVDIDYxMTMxLTMgXHUwMEE3Ni42LjMgc3RhbmRhcmQgZnVuY3Rpb24gYmxvY2sgc2lnbmF0dXJlcy5cblxuY29uc3QgSUVDX1NURExJQl9TVFVCUyA9IGBcbkZVTkNUSU9OX0JMT0NLIFRPTlxuICBWQVJfSU5QVVQgSU4gOiBCT09MOyBQVCA6IFRJTUU7IEVORF9WQVJcbiAgVkFSX09VVFBVVCBRIDogQk9PTDsgRVQgOiBUSU1FOyBFTkRfVkFSXG5FTkRfRlVOQ1RJT05fQkxPQ0tcblxuRlVOQ1RJT05fQkxPQ0sgVE9GXG4gIFZBUl9JTlBVVCBJTiA6IEJPT0w7IFBUIDogVElNRTsgRU5EX1ZBUlxuICBWQVJfT1VUUFVUIFEgOiBCT09MOyBFVCA6IFRJTUU7IEVORF9WQVJcbkVORF9GVU5DVElPTl9CTE9DS1xuXG5GVU5DVElPTl9CTE9DSyBUUFxuICBWQVJfSU5QVVQgSU4gOiBCT09MOyBQVCA6IFRJTUU7IEVORF9WQVJcbiAgVkFSX09VVFBVVCBRIDogQk9PTDsgRVQgOiBUSU1FOyBFTkRfVkFSXG5FTkRfRlVOQ1RJT05fQkxPQ0tcblxuRlVOQ1RJT05fQkxPQ0sgQ1RVXG4gIFZBUl9JTlBVVCBDVSA6IEJPT0w7IFIgOiBCT09MOyBQViA6IElOVDsgRU5EX1ZBUlxuICBWQVJfT1VUUFVUIFEgOiBCT09MOyBDViA6IElOVDsgRU5EX1ZBUlxuRU5EX0ZVTkNUSU9OX0JMT0NLXG5cbkZVTkNUSU9OX0JMT0NLIENURFxuICBWQVJfSU5QVVQgQ0QgOiBCT09MOyBMRCA6IEJPT0w7IFBWIDogSU5UOyBFTkRfVkFSXG4gIFZBUl9PVVRQVVQgUSA6IEJPT0w7IENWIDogSU5UOyBFTkRfVkFSXG5FTkRfRlVOQ1RJT05fQkxPQ0tcblxuRlVOQ1RJT05fQkxPQ0sgQ1RVRFxuICBWQVJfSU5QVVQgQ1UgOiBCT09MOyBDRCA6IEJPT0w7IFIgOiBCT09MOyBMRCA6IEJPT0w7IFBWIDogSU5UOyBFTkRfVkFSXG4gIFZBUl9PVVRQVVQgUVUgOiBCT09MOyBRRCA6IEJPT0w7IENWIDogSU5UOyBFTkRfVkFSXG5FTkRfRlVOQ1RJT05fQkxPQ0tcblxuRlVOQ1RJT05fQkxPQ0sgU1JcbiAgVkFSX0lOUFVUIFMxIDogQk9PTDsgUiA6IEJPT0w7IEVORF9WQVJcbiAgVkFSX09VVFBVVCBRMSA6IEJPT0w7IEVORF9WQVJcbkVORF9GVU5DVElPTl9CTE9DS1xuXG5GVU5DVElPTl9CTE9DSyBSU1xuICBWQVJfSU5QVVQgUyA6IEJPT0w7IFIxIDogQk9PTDsgRU5EX1ZBUlxuICBWQVJfT1VUUFVUIFExIDogQk9PTDsgRU5EX1ZBUlxuRU5EX0ZVTkNUSU9OX0JMT0NLXG5cbkZVTkNUSU9OX0JMT0NLIFJUUklHXG4gIFZBUl9JTlBVVCBDTEsgOiBCT09MOyBFTkRfVkFSXG4gIFZBUl9PVVRQVVQgUSA6IEJPT0w7IEVORF9WQVJcbkVORF9GVU5DVElPTl9CTE9DS1xuXG5GVU5DVElPTl9CTE9DSyBGVFJJR1xuICBWQVJfSU5QVVQgQ0xLIDogQk9PTDsgRU5EX1ZBUlxuICBWQVJfT1VUUFVUIFEgOiBCT09MOyBFTkRfVkFSXG5FTkRfRlVOQ1RJT05fQkxPQ0tcbmA7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBQdWJsaWMgQVBJIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgaW50ZXJmYWNlIFNUQ29tcGlsZVJlc3VsdCB7XG4gIC8qKiBTVCBjb2RlIGZvciBNYXRJRUMgdmFsaWRhdGlvbiBcdTIwMTQgbm8gc3RkbGliIHN0dWJzIChNYXRJRUMgdXNlcyAtSSBsaWIpLiAqL1xuICBzdENvZGU6IHN0cmluZztcbiAgLyoqIFNUIGNvZGUgZm9yIFNUcnVDKysgY29tcGlsZSgpIFx1MjAxNCBpbmNsdWRlcyBJRUMgc3RkbGliIHN0dWJzIChTVHJ1QysrIGlzIHB1cmUgSlMsIG5vIGZpbGVzeXN0ZW0pLiAqL1xuICBzdENvZGVGb3JTdHJ1Y3BwOiBzdHJpbmc7XG4gIHByb2dyYW1OYW1lOiBzdHJpbmc7XG4gIHRhZ0NvdW50OiBudW1iZXI7XG4gIHJ1bmdDb3VudDogbnVtYmVyO1xuICB3YXJuaW5nczogc3RyaW5nW107XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIENMTUdyYXBoIHRvIElFQyA2MTEzMS0zIFN0cnVjdHVyZWQgVGV4dC5cbiAqIFJldHVybnMgdHdvIFNUIHZhcmlhbnRzOlxuICogICAtIHN0Q29kZTogZm9yIE1hdElFQyAobm8gc3R1YnMgXHUyMDE0IE1hdElFQyByZXNvbHZlcyBzdGFuZGFyZCBGQnMgZnJvbSBpdHMgLUkgbGliKVxuICogICAtIHN0Q29kZUZvclN0cnVjcHA6IGZvciBTVHJ1QysrIChpbmNsdWRlcyBJRUMgc3RhbmRhcmQgRkIgc3R1YnMgYmVmb3JlIFBST0dSQU0pXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjbG1Ub1NUKGNsbTogQ0xNR3JhcGgsIGN5Y2xlTXMgPSA1MCk6IFNUQ29tcGlsZVJlc3VsdCB7XG4gIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBDb2xsZWN0IHRhZ3MgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvbnN0IHRhZ0lkcyA9IGNsbS5nZXROb2Rlc0J5VHlwZSgnVEFHJyk7XG4gIGNvbnN0IHRhZ3MgPSB0YWdJZHMubWFwKGlkID0+ICh7XG4gICAgaWQsXG4gICAgZGF0YTogY2xtLmdldE5vZGVEYXRhPFRhZ05vZGVEYXRhPihpZCksXG4gIH0pKTtcblxuICAvLyBcdTI1MDBcdTI1MDAgVkFSIHNlY3Rpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIC8vIEFUIGRlY2xhcmF0aW9ucyBhcmUgb25seSB2YWxpZCBpbiBWQVJfR0xPQkFMIChjb25maWctc2NvcGUpLCBub3QgaW4gUFJPR1JBTSBWQVIuXG4gIC8vIE1hdElFQyByZWplY3RzIEFUICVJLyVRLyVNIGluc2lkZSBQUk9HUkFNIGJsb2NrcyBcdTIwMTQgZHJvcCB0aGUgQVQgY2xhdXNlIGhlcmUuXG4gIGNvbnN0IHZhckxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCB2YXJSZXRhaW5MaW5lczogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCB7IGRhdGEgfSBvZiB0YWdzKSB7XG4gICAgY29uc3QgaW5pdENsYXVzZSA9IGRhdGEuaW5pdGlhbFZhbHVlID8gYCA6PSAke2RhdGEuaW5pdGlhbFZhbHVlfWAgOiBkZWZhdWx0SW5pdEZvcihkYXRhLmRhdGFUeXBlKTtcbiAgICBjb25zdCBkZWNsID0gYCAgICAke3Nhbml0aXplTmFtZShkYXRhLm5hbWUpfSA6ICR7ZGF0YS5kYXRhVHlwZX0ke2luaXRDbGF1c2V9O2A7XG4gICAgaWYgKGRhdGEucmV0YWluKSB7XG4gICAgICB2YXJSZXRhaW5MaW5lcy5wdXNoKGRlY2wpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXJMaW5lcy5wdXNoKGRlY2wpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBMRCBib2R5IChwZXItcnVuZykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvbnN0IGxkTGluZXM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHJ1bmdJZHMgPSBjbG0uZ2V0Tm9kZXNCeVR5cGUoJ1JVTkcnKTtcbiAgLy8gU29ydCBieSBydW5nTnVtYmVyXG4gIHJ1bmdJZHMuc29ydCgoYSwgYikgPT4ge1xuICAgIGNvbnN0IHJhID0gY2xtLmdldE5vZGVEYXRhPFJ1bmdOb2RlRGF0YT4oYSkucnVuZ051bWJlcjtcbiAgICBjb25zdCByYiA9IGNsbS5nZXROb2RlRGF0YTxSdW5nTm9kZURhdGE+KGIpLnJ1bmdOdW1iZXI7XG4gICAgcmV0dXJuIHJhIC0gcmI7XG4gIH0pO1xuXG4gIGZvciAoY29uc3QgcnVuZ0lkIG9mIHJ1bmdJZHMpIHtcbiAgICBjb25zdCBydW5nRGF0YSA9IGNsbS5nZXROb2RlRGF0YTxSdW5nTm9kZURhdGE+KHJ1bmdJZCk7XG4gICAgaWYgKHJ1bmdEYXRhLmNvbW1lbnQpIHtcbiAgICAgIGxkTGluZXMucHVzaChgICAoKiBSdW5nICR7cnVuZ0RhdGEucnVuZ051bWJlcn06ICR7cnVuZ0RhdGEuY29tbWVudH0gKilgKTtcbiAgICB9XG5cbiAgICAvLyBDb2xsZWN0IExEX0VMRU1FTlQgbm9kZXMgZm9yIHRoaXMgcnVuZ1xuICAgIGNvbnN0IGVsZW1lbnRJZHMgPSBjbG0uZ2V0Q2hpbGRyZW4ocnVuZ0lkKTtcbiAgICBjb25zdCBlbGVtZW50cyA9IGVsZW1lbnRJZHMubWFwKGlkID0+ICh7XG4gICAgICBpZCxcbiAgICAgIGF0dHI6IGNsbS5nZXROb2RlQXR0cihpZCksXG4gICAgICBkYXRhOiBjbG0uZ2V0Tm9kZURhdGE8TERFbGVtZW50Tm9kZURhdGE+KGlkKSxcbiAgICB9KSkuZmlsdGVyKGUgPT4gZS5hdHRyLnR5cGUgPT09ICdMRF9FTEVNRU5UJyk7XG5cbiAgICAvLyBTZXBhcmF0ZSBtYWluIHJhaWwgZnJvbSBicmFuY2ggZWxlbWVudHNcbiAgICBjb25zdCBtYWluUmFpbCA9IGVsZW1lbnRzLmZpbHRlcihlID0+ICFlLmRhdGEuYnJhbmNoSWQpO1xuICAgIGNvbnN0IGJyYW5jaEdyb3VwcyA9IGdyb3VwQnlCcmFuY2hJZChlbGVtZW50cy5maWx0ZXIoZSA9PiAhIWUuZGF0YS5icmFuY2hJZCkpO1xuXG4gICAgY29uc3QgcnVuZ1NUID0gY29tcGlsZVJ1bmdUb1NUKGNsbSwgcnVuZ0lkLCBtYWluUmFpbCwgYnJhbmNoR3JvdXBzLCB3YXJuaW5ncyk7XG4gICAgbGRMaW5lcy5wdXNoKC4uLnJ1bmdTVCk7XG4gICAgbGRMaW5lcy5wdXNoKCcnKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBGQkQgYm9keSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgY29uc3QgZmJkTGluZXM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IGZiZEJsb2NrSWRzID0gY2xtLmdldE5vZGVzQnlUeXBlKCdGQkRfQkxPQ0snKTtcbiAgZm9yIChjb25zdCBibG9ja0lkIG9mIGZiZEJsb2NrSWRzKSB7XG4gICAgY29uc3QgYmxvY2tEYXRhID0gY2xtLmdldE5vZGVEYXRhPEZCREJsb2NrTm9kZURhdGE+KGJsb2NrSWQpO1xuICAgIGNvbnN0IGZiZFNUID0gY29tcGlsZUZCREJsb2NrVG9TVChjbG0sIGJsb2NrSWQsIGJsb2NrRGF0YSwgd2FybmluZ3MpO1xuICAgIGZiZExpbmVzLnB1c2goLi4uZmJkU1QpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFNGQyBib2R5IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBjb25zdCBzZmNMaW5lczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3Qgc2ZjU3RlcElkcyA9IGNsbS5nZXROb2Rlc0J5VHlwZSgnU0ZDX1NURVAnKTtcbiAgaWYgKHNmY1N0ZXBJZHMubGVuZ3RoID4gMCkge1xuICAgIHNmY0xpbmVzLnB1c2goLi4uY29tcGlsZVNGQ1RvU1QoY2xtLCBzZmNTdGVwSWRzLCB3YXJuaW5ncykpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIEFzc2VtYmxlIFBST0dSQU0gYmxvY2sgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvbnN0IHByb2dyYW1OYW1lID0gJ3Byb2cwJztcbiAgY29uc3QgYm9keUxpbmVzID0gWy4uLmxkTGluZXMsIC4uLmZiZExpbmVzLCAuLi5zZmNMaW5lc107XG5cbiAgLy8gRkIgaW5zdGFuY2UgdmFyaWFibGVzIChUT04sIENUVSBldGMuKSBuZWVkIFZBUiBibG9ja3MgdG9vXG4gIGNvbnN0IGZiVmFyTGluZXMgPSBjb2xsZWN0RkJJbnN0YW5jZVZhcnMoY2xtKTtcblxuICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcbiAgcGFydHMucHVzaChgUFJPR1JBTSAke3Byb2dyYW1OYW1lfWApO1xuXG4gIGlmICh2YXJMaW5lcy5sZW5ndGggPiAwIHx8IGZiVmFyTGluZXMubGVuZ3RoID4gMCkge1xuICAgIHBhcnRzLnB1c2goJyAgVkFSJyk7XG4gICAgcGFydHMucHVzaCguLi52YXJMaW5lcyk7XG4gICAgcGFydHMucHVzaCguLi5mYlZhckxpbmVzKTtcbiAgICBwYXJ0cy5wdXNoKCcgIEVORF9WQVInKTtcbiAgfVxuXG4gIGlmICh2YXJSZXRhaW5MaW5lcy5sZW5ndGggPiAwKSB7XG4gICAgcGFydHMucHVzaCgnICBWQVJfUkVUQUlOJyk7XG4gICAgcGFydHMucHVzaCguLi52YXJSZXRhaW5MaW5lcyk7XG4gICAgcGFydHMucHVzaCgnICBFTkRfVkFSJyk7XG4gIH1cblxuICBpZiAoYm9keUxpbmVzLmxlbmd0aCA+IDApIHtcbiAgICBwYXJ0cy5wdXNoKCcnKTtcbiAgICBwYXJ0cy5wdXNoKC4uLmJvZHlMaW5lcyk7XG4gIH1cblxuICBwYXJ0cy5wdXNoKGBFTkRfUFJPR1JBTWApO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBDT05GSUdVUkFUSU9OIHNjYWZmb2xkIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBwYXJ0cy5wdXNoKCcnKTtcbiAgcGFydHMucHVzaCgnQ09ORklHVVJBVElPTiBDb25maWcwJyk7XG4gIHBhcnRzLnB1c2goJycpO1xuICBwYXJ0cy5wdXNoKCcgIFJFU09VUkNFIFJlczAgT04gUExDJyk7XG4gIHBhcnRzLnB1c2goYCAgICBUQVNLIE1haW4oSU5URVJWQUwgOj0gVCMke2N5Y2xlTXN9bXMsIFBSSU9SSVRZIDo9IDApO2ApO1xuICBwYXJ0cy5wdXNoKGAgICAgUFJPR1JBTSBJbnN0MCBXSVRIIE1haW4gOiAke3Byb2dyYW1OYW1lfTtgKTtcbiAgcGFydHMucHVzaCgnICBFTkRfUkVTT1VSQ0UnKTtcbiAgcGFydHMucHVzaCgnJyk7XG4gIHBhcnRzLnB1c2goJ0VORF9DT05GSUdVUkFUSU9OJyk7XG5cbiAgY29uc3Qgc3RDb2RlID0gcGFydHMuam9pbignXFxuJyk7XG5cbiAgLy8gU1RydUMrKyB2YXJpYW50OiBwcmVwZW5kIElFQyBzdGRsaWIgc3R1YnMgd2hlbiBmdW5jdGlvbi1ibG9jayBpbnN0YW5jZXMgYXJlIHVzZWQuXG4gIC8vIFNUcnVDKysgaXMgcHVyZSBKUyB3aXRoIG5vIGZpbGVzeXN0ZW0gXHUyMDE0IGl0IGNhbm5vdCByZXNvbHZlIHN0YW5kYXJkIEZCcyBmcm9tIGEgbGliIGRpcmVjdG9yeS5cbiAgY29uc3QgbmVlZHNTdHVicyA9IGZiVmFyTGluZXMubGVuZ3RoID4gMDtcbiAgY29uc3Qgc3RDb2RlRm9yU3RydWNwcCA9IG5lZWRzU3R1YnNcbiAgICA/IElFQ19TVERMSUJfU1RVQlMudHJpbSgpICsgJ1xcblxcbicgKyBzdENvZGVcbiAgICA6IHN0Q29kZTtcblxuICByZXR1cm4ge1xuICAgIHN0Q29kZSxcbiAgICBzdENvZGVGb3JTdHJ1Y3BwLFxuICAgIHByb2dyYW1OYW1lLFxuICAgIHRhZ0NvdW50OiB0YWdzLmxlbmd0aCxcbiAgICBydW5nQ291bnQ6IHJ1bmdJZHMubGVuZ3RoLFxuICAgIHdhcm5pbmdzLFxuICB9O1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgRGVidWctbWFwIHRhZyByZXNvbHV0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgaW50ZXJmYWNlIERlYnVnTGVhZiB7XG4gIGFycmF5SWR4OiBudW1iZXI7XG4gIGVsZW1JZHg6IG51bWJlcjtcbiAgcGF0aDogc3RyaW5nO1xuICB0eXBlOiBzdHJpbmc7XG4gIHNpemU6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBEZWJ1Z01hcCB7XG4gIHZlcnNpb246IG51bWJlcjtcbiAgbWQ1OiBzdHJpbmc7XG4gIHR5cGVUYWdzOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+O1xuICBhcnJheXM6IEFycmF5PHsgaW5kZXg6IG51bWJlcjsgY291bnQ6IG51bWJlciB9PjtcbiAgbGVhdmVzOiBEZWJ1Z0xlYWZbXTtcbn1cblxuLyoqXG4gKiBHaXZlbiBhIGRlYnVnLW1hcC5qc29uIChmcm9tIFNUcnVDKysgZ2VuZXJhdGVEZWJ1Z1RhYmxlKSBhbmQgYSByYXcgdGFnIG5hbWVcbiAqIGZyb20gbG9naWNTdG9yZS5UYWdFbnRyeS5uYW1lLCByZXR1cm4gdGhlIGxlYWYgZW50cnkuXG4gKlxuICogQ29uZmlybWVkIGZvcm1hdCBmcm9tIHJlYWwgb3V0cHV0OlxuICogICBwYXRoID0gXCJJTlNUMC5NT1RPUl9SVU5cIiAgKHVwcGVyY2FzZSBpbnN0YW5jZSBcIklOU1QwXCIsIGRvdCwgdXBwZXJjYXNlIHZhciBuYW1lKVxuICpcbiAqIEluc3RhbmNlIG5hbWU6IGVuc3VyZUNvbmZpZ3VyYXRpb24oKSByZW5hbWVzIFBST0dSQU0gdG8gcHJvZzAgYW5kIHNldHNcbiAqIFBST0dSQU0gSW5zdDAgV0lUSCBNYWluIFx1MjAxNCBzbyB0aGUgaW5zdGFuY2UgbmFtZSBpcyBhbHdheXMgXCJJbnN0MFwiIFx1MjE5MiBcIklOU1QwXCIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlVGFnRGVidWdMZWFmKGRlYnVnTWFwOiBEZWJ1Z01hcCwgdGFnTmFtZTogc3RyaW5nKTogRGVidWdMZWFmIHwgdW5kZWZpbmVkIHtcbiAgY29uc3QgbmVlZGxlID0gYElOU1QwLiR7dGFnTmFtZS50b1VwcGVyQ2FzZSgpfWA7XG4gIHJldHVybiBkZWJ1Z01hcC5sZWF2ZXMuZmluZChsID0+IGwucGF0aCA9PT0gbmVlZGxlKTtcbn1cblxuLyoqXG4gKiBCdWlsZCBhIE1hcDx0YWdOYW1lLCBkZWJ1Z0luZGV4PiBmb3IgYWxsIHRhZ3MgaW4gdGhlIGRlYnVnIG1hcC5cbiAqIGRlYnVnSW5kZXggPSBlbGVtSWR4IHdpdGhpbiBhcnJheSAwICh0aGUgc2luZ2xlIGZsYXQgdmFyaWFibGUgYXJyYXkpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRUYWdJbmRleE1hcChkZWJ1Z01hcDogRGVidWdNYXApOiBNYXA8c3RyaW5nLCBudW1iZXI+IHtcbiAgY29uc3QgcmVzdWx0ID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgZm9yIChjb25zdCBsZWFmIG9mIGRlYnVnTWFwLmxlYXZlcykge1xuICAgIC8vIHBhdGggPSBcIklOU1QwLlZBUl9OQU1FXCJcbiAgICBjb25zdCBkb3RJZHggPSBsZWFmLnBhdGguaW5kZXhPZignLicpO1xuICAgIGlmIChkb3RJZHggPT09IC0xKSBjb250aW51ZTtcbiAgICBjb25zdCB2YXJOYW1lID0gbGVhZi5wYXRoLnNsaWNlKGRvdElkeCArIDEpOyAvLyBcIk1PVE9SX1JVTlwiXG4gICAgcmVzdWx0LnNldCh2YXJOYW1lLCBsZWFmLmVsZW1JZHgpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBMRCBcdTIxOTIgU1QgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbnR5cGUgRWxlbWVudFdpdGhEYXRhID0ge1xuICBpZDogc3RyaW5nO1xuICBhdHRyOiBSZXR1cm5UeXBlPENMTUdyYXBoWydnZXROb2RlQXR0ciddPjtcbiAgZGF0YTogTERFbGVtZW50Tm9kZURhdGE7XG59O1xuXG5mdW5jdGlvbiBncm91cEJ5QnJhbmNoSWQoZWxlbWVudHM6IEVsZW1lbnRXaXRoRGF0YVtdKTogTWFwPHN0cmluZywgRWxlbWVudFdpdGhEYXRhW10+IHtcbiAgY29uc3QgZ3JvdXBzID0gbmV3IE1hcDxzdHJpbmcsIEVsZW1lbnRXaXRoRGF0YVtdPigpO1xuICBmb3IgKGNvbnN0IGVsIG9mIGVsZW1lbnRzKSB7XG4gICAgY29uc3QgYmlkID0gZWwuZGF0YS5icmFuY2hJZCE7XG4gICAgaWYgKCFncm91cHMuaGFzKGJpZCkpIGdyb3Vwcy5zZXQoYmlkLCBbXSk7XG4gICAgZ3JvdXBzLmdldChiaWQpIS5wdXNoKGVsKTtcbiAgfVxuICByZXR1cm4gZ3JvdXBzO1xufVxuXG5mdW5jdGlvbiBjb21waWxlUnVuZ1RvU1QoXG4gIGNsbTogQ0xNR3JhcGgsXG4gIF9ydW5nSWQ6IHN0cmluZyxcbiAgbWFpblJhaWw6IEVsZW1lbnRXaXRoRGF0YVtdLFxuICBicmFuY2hHcm91cHM6IE1hcDxzdHJpbmcsIEVsZW1lbnRXaXRoRGF0YVtdPixcbiAgd2FybmluZ3M6IHN0cmluZ1tdLFxuKTogc3RyaW5nW10ge1xuICAvLyBTcGxpdCBtYWluIHJhaWw6IGNvbnRhY3RzIChjb25kaXRpb25zKSB0aGVuIGNvaWxzL2Jsb2NrcyAob3V0cHV0cylcbiAgY29uc3QgY29udGFjdHMgPSBtYWluUmFpbC5maWx0ZXIoZSA9PiBpc0NvbnRhY3RLaW5kKGUuZGF0YS5lbGVtZW50S2luZCkpO1xuICBjb25zdCBvdXRwdXRzID0gbWFpblJhaWwuZmlsdGVyKGUgPT4gIWlzQ29udGFjdEtpbmQoZS5kYXRhLmVsZW1lbnRLaW5kKSk7XG5cbiAgaWYgKGNvbnRhY3RzLmxlbmd0aCA9PT0gMCAmJiBvdXRwdXRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtdO1xuXG4gIC8vIEJ1aWxkIGNvbmRpdGlvbiBleHByZXNzaW9uIFx1MjAxNCBMRCBzZW1hbnRpY3M6XG4gIC8vIE1haW4gcmFpbCBjb250YWN0cyBhcmUgc2VyaWVzIChBTkQpLiBFYWNoIGJyYW5jaCBwcm92aWRlcyBhIHBhcmFsbGVsIHBhdGggKE9SKSBmb3JcbiAgLy8gdGhlIHNlY3Rpb24gb2YgdGhlIHJ1bmcgaXQgc3BhbnMuIFNpbXBsZSBtb2RlbDogYnJhbmNoIGNvbnRhY3RzIE9SIHdpdGggbWFpbiByYWlsLlxuICAvLyBSZXN1bHQ6IChtYWluQ29udGFjdDEgQU5EIG1haW5Db250YWN0MiBBTkQgLi4uICkgT1IgKGJyYW5jaDEpIE9SIChicmFuY2gyKSAuLi5cbiAgY29uc3QgbWFpbkV4cHIgPSBjb250YWN0cy5sZW5ndGggPiAwXG4gICAgPyBjb250YWN0cy5tYXAoZSA9PiBjb250YWN0VG9FeHByKGNsbSwgZSkpLmpvaW4oJyBBTkQgJylcbiAgICA6ICcnO1xuXG4gIGNvbnN0IGJyYW5jaEV4cHJzOiBzdHJpbmdbXSA9IFtdO1xuICBmb3IgKGNvbnN0IFssIGJyYW5jaEVsc10gb2YgYnJhbmNoR3JvdXBzKSB7XG4gICAgY29uc3QgYnJhbmNoQ29udGFjdHMgPSBicmFuY2hFbHMuZmlsdGVyKGUgPT4gaXNDb250YWN0S2luZChlLmRhdGEuZWxlbWVudEtpbmQpKTtcbiAgICBpZiAoYnJhbmNoQ29udGFjdHMubGVuZ3RoID4gMCkge1xuICAgICAgYnJhbmNoRXhwcnMucHVzaChgKCR7YnJhbmNoQ29udGFjdHMubWFwKGUgPT4gY29udGFjdFRvRXhwcihjbG0sIGUpKS5qb2luKCcgQU5EICcpfSlgKTtcbiAgICB9XG4gIH1cblxuICBsZXQgY29uZGl0aW9uOiBzdHJpbmc7XG4gIGlmIChtYWluRXhwciAmJiBicmFuY2hFeHBycy5sZW5ndGggPiAwKSB7XG4gICAgY29uZGl0aW9uID0gYCgke21haW5FeHByfSkgT1IgJHticmFuY2hFeHBycy5qb2luKCcgT1IgJyl9YDtcbiAgfSBlbHNlIGlmIChtYWluRXhwcikge1xuICAgIGNvbmRpdGlvbiA9IG1haW5FeHByO1xuICB9IGVsc2UgaWYgKGJyYW5jaEV4cHJzLmxlbmd0aCA+IDApIHtcbiAgICBjb25kaXRpb24gPSBicmFuY2hFeHBycy5qb2luKCcgT1IgJyk7XG4gIH0gZWxzZSB7XG4gICAgY29uZGl0aW9uID0gJ1RSVUUnO1xuICB9XG5cbiAgY29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG5cbiAgaWYgKG91dHB1dHMubGVuZ3RoID09PSAwKSB7XG4gICAgd2FybmluZ3MucHVzaChgUnVuZyBoYXMgY29udGFjdHMgYnV0IG5vIG91dHB1dCBlbGVtZW50YCk7XG4gICAgcmV0dXJuIGxpbmVzO1xuICB9XG5cbiAgZm9yIChjb25zdCBvdXRwdXQgb2Ygb3V0cHV0cykge1xuICAgIGNvbnN0IG91dHB1dExpbmVzID0gb3V0cHV0VG9TVChjbG0sIG91dHB1dCwgY29uZGl0aW9uLCB3YXJuaW5ncyk7XG4gICAgbGluZXMucHVzaCguLi5vdXRwdXRMaW5lcyk7XG4gIH1cblxuICByZXR1cm4gbGluZXM7XG59XG5cbmZ1bmN0aW9uIGlzQ29udGFjdEtpbmQoa2luZDogTERFbGVtZW50S2luZCk6IGJvb2xlYW4ge1xuICByZXR1cm4ga2luZC5zdGFydHNXaXRoKCdjb250YWN0XycpO1xufVxuXG5mdW5jdGlvbiBjb250YWN0VG9FeHByKGNsbTogQ0xNR3JhcGgsIGVsOiBFbGVtZW50V2l0aERhdGEpOiBzdHJpbmcge1xuICAvLyBSZXNvbHZlIHRhZyBuYW1lIHZpYSBSRUFEUyBlZGdlXG4gIGNvbnN0IHJlYWRzID0gY2xtLmdldE91dEVkZ2VzQnlUeXBlKGVsLmlkLCAnUkVBRFMnKTtcbiAgY29uc3QgdGFnTmFtZSA9IHJlYWRzLmxlbmd0aCA+IDBcbiAgICA/IHNhbml0aXplTmFtZSgoY2xtLmdldE5vZGVEYXRhPFRhZ05vZGVEYXRhPihyZWFkc1swXS50YXJnZXQpKS5uYW1lKVxuICAgIDogJ19VTktOT1dOJztcblxuICBjb25zdCBraW5kID0gZWwuZGF0YS5lbGVtZW50S2luZDtcbiAgc3dpdGNoIChraW5kKSB7XG4gICAgY2FzZSAnY29udGFjdF9ubyc6IHJldHVybiB0YWdOYW1lO1xuICAgIGNhc2UgJ2NvbnRhY3RfbmMnOiByZXR1cm4gYE5PVCAke3RhZ05hbWV9YDtcbiAgICBjYXNlICdjb250YWN0X3AnOiAgcmV0dXJuIHRhZ05hbWU7ICAgLy8gcG9zaXRpdmUgZWRnZSBcdTIwMTQgU1QgYXBwcm94aW1hdGlvblxuICAgIGNhc2UgJ2NvbnRhY3Rfbic6ICByZXR1cm4gYE5PVCAke3RhZ05hbWV9YDsgLy8gbmVnYXRpdmUgZWRnZSBcdTIwMTQgU1QgYXBwcm94aW1hdGlvblxuICAgIGRlZmF1bHQ6IHJldHVybiB0YWdOYW1lO1xuICB9XG59XG5cbmZ1bmN0aW9uIG91dHB1dFRvU1QoXG4gIGNsbTogQ0xNR3JhcGgsXG4gIGVsOiBFbGVtZW50V2l0aERhdGEsXG4gIGNvbmRpdGlvbjogc3RyaW5nLFxuICB3YXJuaW5nczogc3RyaW5nW10sXG4pOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHdyaXRlcyA9IGNsbS5nZXRPdXRFZGdlc0J5VHlwZShlbC5pZCwgJ1dSSVRFUycpO1xuICBjb25zdCBraW5kID0gZWwuZGF0YS5lbGVtZW50S2luZDtcblxuICBpZiAoa2luZCA9PT0gJ2ZiX2NhbGwnKSB7XG4gICAgcmV0dXJuIGNvbXBpbGVGQkNhbGxJblJ1bmcoY2xtLCBlbCwgY29uZGl0aW9uLCB3YXJuaW5ncyk7XG4gIH1cblxuICBpZiAod3JpdGVzLmxlbmd0aCA9PT0gMCkge1xuICAgIHdhcm5pbmdzLnB1c2goYENvaWwgZWxlbWVudCAke2VsLmlkfSBoYXMgbm8gV1JJVEVTIGVkZ2UgXHUyMDE0IHNraXBwZWRgKTtcbiAgICByZXR1cm4gW107XG4gIH1cblxuICBjb25zdCB0YWdOYW1lID0gc2FuaXRpemVOYW1lKChjbG0uZ2V0Tm9kZURhdGE8VGFnTm9kZURhdGE+KHdyaXRlc1swXS50YXJnZXQpKS5uYW1lKTtcblxuICBzd2l0Y2ggKGtpbmQpIHtcbiAgICBjYXNlICdjb2lsJzpcbiAgICAgIHJldHVybiBbYCAgSUYgJHtjb25kaXRpb259IFRIRU4gJHt0YWdOYW1lfSA6PSBUUlVFOyBFTFNFICR7dGFnTmFtZX0gOj0gRkFMU0U7IEVORF9JRjtgXTtcbiAgICBjYXNlICdjb2lsX25lZ2F0ZWQnOlxuICAgICAgcmV0dXJuIFtgICBJRiAke2NvbmRpdGlvbn0gVEhFTiAke3RhZ05hbWV9IDo9IEZBTFNFOyBFTFNFICR7dGFnTmFtZX0gOj0gVFJVRTsgRU5EX0lGO2BdO1xuICAgIGNhc2UgJ2NvaWxfc2V0JzpcbiAgICAgIHJldHVybiBbYCAgSUYgJHtjb25kaXRpb259IFRIRU4gJHt0YWdOYW1lfSA6PSBUUlVFOyBFTkRfSUY7YF07XG4gICAgY2FzZSAnY29pbF9yZXNldCc6XG4gICAgICByZXR1cm4gW2AgIElGICR7Y29uZGl0aW9ufSBUSEVOICR7dGFnTmFtZX0gOj0gRkFMU0U7IEVORF9JRjtgXTtcbiAgICBjYXNlICdjb2lsX2xhdGNoJzpcbiAgICAgIHJldHVybiBbYCAgSUYgJHtjb25kaXRpb259IFRIRU4gJHt0YWdOYW1lfSA6PSBUUlVFOyBFTkRfSUY7YF07XG4gICAgY2FzZSAnY29pbF91bmxhdGNoJzpcbiAgICAgIHJldHVybiBbYCAgSUYgJHtjb25kaXRpb259IFRIRU4gJHt0YWdOYW1lfSA6PSBGQUxTRTsgRU5EX0lGO2BdO1xuICAgIGRlZmF1bHQ6XG4gICAgICB3YXJuaW5ncy5wdXNoKGBVbmtub3duIGNvaWwga2luZCAke2tpbmR9IFx1MjAxNCBlbWl0dGVkIGFzIG5vcm1hbCBjb2lsYCk7XG4gICAgICByZXR1cm4gW2AgIElGICR7Y29uZGl0aW9ufSBUSEVOICR7dGFnTmFtZX0gOj0gVFJVRTsgRUxTRSAke3RhZ05hbWV9IDo9IEZBTFNFOyBFTkRfSUY7YF07XG4gIH1cbn1cblxuZnVuY3Rpb24gY29tcGlsZUZCQ2FsbEluUnVuZyhcbiAgY2xtOiBDTE1HcmFwaCxcbiAgZWw6IEVsZW1lbnRXaXRoRGF0YSxcbiAgY29uZGl0aW9uOiBzdHJpbmcsXG4gIHdhcm5pbmdzOiBzdHJpbmdbXSxcbik6IHN0cmluZ1tdIHtcbiAgY29uc3QgaW5zdGFuY2VOYW1lID0gc2FuaXRpemVOYW1lKGVsLmRhdGEuaW5zdGFuY2VOYW1lID8/IGBfRkJfJHtlbC5pZH1gKTtcblxuICAvLyBDb2xsZWN0IGlucHV0IHBpbiBhc3NpZ25tZW50cyAoUkVBRFMgZWRnZXMgY2Fycnkge3Bpbk5hbWV9IGluIGVkZ2UgZGF0YSlcbiAgY29uc3QgcmVhZHMgPSBjbG0uZ2V0T3V0RWRnZXNCeVR5cGUoZWwuaWQsICdSRUFEUycpO1xuICBjb25zdCB3cml0ZXMgPSBjbG0uZ2V0T3V0RWRnZXNCeVR5cGUoZWwuaWQsICdXUklURVMnKTtcblxuICBjb25zdCBpbnB1dFBhcmFtczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3Qgb3V0cHV0QXNzaWdubWVudHM6IHN0cmluZ1tdID0gW107XG5cbiAgZm9yIChjb25zdCBlZGdlIG9mIHJlYWRzKSB7XG4gICAgY29uc3QgdGFnRGF0YSA9IGNsbS5nZXROb2RlRGF0YTxUYWdOb2RlRGF0YT4oZWRnZS50YXJnZXQpO1xuICAgIGNvbnN0IHBpbk5hbWUgPSAoZWRnZS5kYXRhIGFzIGFueSk/LnBpbk5hbWUgPz8gc2FuaXRpemVOYW1lKHRhZ0RhdGEubmFtZSk7XG4gICAgaW5wdXRQYXJhbXMucHVzaChgJHtwaW5OYW1lfSA6PSAke3Nhbml0aXplTmFtZSh0YWdEYXRhLm5hbWUpfWApO1xuICB9XG5cbiAgZm9yIChjb25zdCBlZGdlIG9mIHdyaXRlcykge1xuICAgIGNvbnN0IHRhZ0RhdGEgPSBjbG0uZ2V0Tm9kZURhdGE8VGFnTm9kZURhdGE+KGVkZ2UudGFyZ2V0KTtcbiAgICBjb25zdCBwaW5OYW1lID0gKGVkZ2UuZGF0YSBhcyBhbnkpPy5waW5OYW1lID8/IHNhbml0aXplTmFtZSh0YWdEYXRhLm5hbWUpO1xuICAgIG91dHB1dEFzc2lnbm1lbnRzLnB1c2goYCAgICAke3Nhbml0aXplTmFtZSh0YWdEYXRhLm5hbWUpfSA6PSAke2luc3RhbmNlTmFtZX0uJHtwaW5OYW1lfTtgKTtcbiAgfVxuXG4gIGNvbnN0IHBhcmFtU3RyID0gaW5wdXRQYXJhbXMubGVuZ3RoID4gMFxuICAgID8gYEVOIDo9ICgke2NvbmRpdGlvbn0pLCAke2lucHV0UGFyYW1zLmpvaW4oJywgJyl9YFxuICAgIDogYEVOIDo9ICgke2NvbmRpdGlvbn0pYDtcblxuICBjb25zdCBsaW5lcyA9IFtcbiAgICBgICAke2luc3RhbmNlTmFtZX0oJHtwYXJhbVN0cn0pO2AsXG4gICAgLi4ub3V0cHV0QXNzaWdubWVudHMsXG4gIF07XG5cbiAgcmV0dXJuIGxpbmVzO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgRkJEIFx1MjE5MiBTVCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gY29tcGlsZUZCREJsb2NrVG9TVChcbiAgY2xtOiBDTE1HcmFwaCxcbiAgYmxvY2tJZDogc3RyaW5nLFxuICBibG9ja0RhdGE6IEZCREJsb2NrTm9kZURhdGEsXG4gIHdhcm5pbmdzOiBzdHJpbmdbXSxcbik6IHN0cmluZ1tdIHtcbiAgY29uc3QgYnR5cGUgPSBibG9ja0RhdGEuYmxvY2tUeXBlO1xuXG4gIC8vIFNraXAgcHVyZWx5IHZpc3VhbCBub2Rlc1xuICBpZiAoYnR5cGUgPT09ICdDT01NRU5UJyB8fCBidHlwZSA9PT0gJ0NPTk5FQ1RPUicgfHwgYnR5cGUgPT09ICdDT05USU5VQVRJT04nKSByZXR1cm4gW107XG5cbiAgLy8gVmFyaWFibGUgbm9kZXMgXHUyMDE0IGp1c3QgYSB0YWcgcmVmZXJlbmNlLCBubyBjYWxsIG5lZWRlZFxuICBpZiAoYnR5cGUgPT09ICdJTl9WQVJJQUJMRScgfHwgYnR5cGUgPT09ICdPVVRfVkFSSUFCTEUnIHx8IGJ0eXBlID09PSAnSU5PVVRfVkFSSUFCTEUnKSByZXR1cm4gW107XG5cbiAgLy8gRnVuY3Rpb24tYmxvY2sgaW5zdGFuY2UgY2FsbCAoVE9OLCBDVFUsIFNSLCBSUyBldGMuKVxuICBjb25zdCBpc0ZCSW5zdGFuY2UgPSBpc0Z1bmN0aW9uQmxvY2soYnR5cGUpO1xuICBpZiAoaXNGQkluc3RhbmNlKSB7XG4gICAgY29uc3QgaW5zdGFuY2VOYW1lID0gc2FuaXRpemVOYW1lKGJsb2NrRGF0YS5pbnN0YW5jZU5hbWUgPz8gYF9GQl8ke2Jsb2NrSWR9YCk7XG4gICAgY29uc3QgeyBpbnB1dFBhcmFtcywgb3V0cHV0QXNzaWdubWVudHMgfSA9IGNvbGxlY3RGQkRQaW5QYXJhbXMoY2xtLCBibG9ja0lkLCB3YXJuaW5ncyk7XG4gICAgY29uc3QgY2FsbExpbmVzOiBzdHJpbmdbXSA9IFtcbiAgICAgIGAgICR7aW5zdGFuY2VOYW1lfShgLFxuICAgICAgLi4uaW5wdXRQYXJhbXMubWFwKChwLCBpKSA9PiBgICAgICR7cH0ke2kgPCBpbnB1dFBhcmFtcy5sZW5ndGggLSAxID8gJywnIDogJyd9YCksXG4gICAgICBgICApO2AsXG4gICAgXTtcbiAgICByZXR1cm4gWy4uLmNhbGxMaW5lcywgLi4ub3V0cHV0QXNzaWdubWVudHNdO1xuICB9XG5cbiAgLy8gQ29tYmluYXRvcmlhbCAvIGFyaXRobWV0aWMgYmxvY2tzIFx1MjAxNCBmb2xkIGludG8gaW5saW5lIFNUIGV4cHJlc3Npb25zXG4gIHJldHVybiBjb21waWxlRkJEQ29tYmluYXRvcmlhbChjbG0sIGJsb2NrSWQsIGJsb2NrRGF0YSwgd2FybmluZ3MpO1xufVxuXG5pbnRlcmZhY2UgRkJEUGluUmVzdWx0IHtcbiAgaW5wdXRQYXJhbXM6IHN0cmluZ1tdO1xuICBvdXRwdXRBc3NpZ25tZW50czogc3RyaW5nW107ICAvLyBcInRhZ05hbWUgOj0gaW5zdGFuY2VOYW1lLnBpbk5hbWU7XCIgXHUyMDE0IGVtaXR0ZWQgYWZ0ZXIgY2FsbFxufVxuXG5mdW5jdGlvbiBjb2xsZWN0RkJEUGluUGFyYW1zKGNsbTogQ0xNR3JhcGgsIGJsb2NrSWQ6IHN0cmluZywgd2FybmluZ3M6IHN0cmluZ1tdKTogRkJEUGluUmVzdWx0IHtcbiAgY29uc3QgcGluRWRnZXMgPSBjbG0uZ2V0T3V0RWRnZXNCeVR5cGUoYmxvY2tJZCwgJ0hBU19QSU4nKTtcbiAgY29uc3QgaW5wdXRQYXJhbXM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IG91dHB1dEFzc2lnbm1lbnRzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGZvciAoY29uc3QgZWRnZSBvZiBwaW5FZGdlcykge1xuICAgIGNvbnN0IHBpbkRhdGEgPSBjbG0uZ2V0Tm9kZURhdGE8RkJEUGluTm9kZURhdGE+KGVkZ2UudGFyZ2V0KTtcblxuICAgIGlmIChwaW5EYXRhLmRpcmVjdGlvbiA9PT0gJ2luJykge1xuICAgICAgLy8gRmluZCB3aGF0J3Mgd2lyZWQgdG8gdGhpcyBpbnB1dCBwaW5cbiAgICAgIGNvbnN0IGluV2lyZXMgPSBjbG0uZ2V0SW5FZGdlc0J5VHlwZShlZGdlLnRhcmdldCwgJ1dJUkUnKTtcbiAgICAgIGlmIChpbldpcmVzLmxlbmd0aCA9PT0gMCkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IHNvdXJjZVBpbiA9IGluV2lyZXNbMF0uc291cmNlO1xuICAgICAgY29uc3QgcGFyZW50RWRnZXMgPSBjbG0uZ2V0SW5FZGdlc0J5VHlwZShzb3VyY2VQaW4sICdIQVNfUElOJyk7XG4gICAgICBpZiAocGFyZW50RWRnZXMubGVuZ3RoID09PSAwKSBjb250aW51ZTtcblxuICAgICAgY29uc3QgcGFyZW50QmxvY2tJZCA9IHBhcmVudEVkZ2VzWzBdLnNvdXJjZTtcbiAgICAgIGNvbnN0IHBhcmVudEJsb2NrRGF0YSA9IGNsbS5nZXROb2RlRGF0YTxGQkRCbG9ja05vZGVEYXRhPihwYXJlbnRCbG9ja0lkKTtcblxuICAgICAgaWYgKHBhcmVudEJsb2NrRGF0YS5ibG9ja1R5cGUgPT09ICdJTl9WQVJJQUJMRScpIHtcbiAgICAgICAgY29uc3QgcmVhZHMgPSBjbG0uZ2V0T3V0RWRnZXNCeVR5cGUocGFyZW50QmxvY2tJZCwgJ1JFQURTJyk7XG4gICAgICAgIGlmIChyZWFkcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgY29uc3QgdGFnTmFtZSA9IHNhbml0aXplTmFtZSgoY2xtLmdldE5vZGVEYXRhPFRhZ05vZGVEYXRhPihyZWFkc1swXS50YXJnZXQpKS5uYW1lKTtcbiAgICAgICAgICBpbnB1dFBhcmFtcy5wdXNoKGAke3BpbkRhdGEucGluTmFtZX0gOj0gJHt0YWdOYW1lfWApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChwaW5EYXRhLmRpcmVjdGlvbiA9PT0gJ291dCcpIHtcbiAgICAgIC8vIE91dHB1dCBwaW4gd2lyZWQgdG8gYW4gT1VUX1ZBUklBQkxFIFx1MjAxNCBlbWl0IGFzIHBvc3QtY2FsbCBhc3NpZ25tZW50OiB0YWcgOj0gaW5zdGFuY2UucGluXG4gICAgICBjb25zdCBvdXRXaXJlcyA9IGNsbS5nZXRPdXRFZGdlc0J5VHlwZShlZGdlLnRhcmdldCwgJ1dJUkUnKTtcbiAgICAgIGlmIChvdXRXaXJlcy5sZW5ndGggPT09IDApIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCB0YXJnZXRQaW4gPSBvdXRXaXJlc1swXS50YXJnZXQ7XG4gICAgICBjb25zdCBwYXJlbnRFZGdlcyA9IGNsbS5nZXRJbkVkZ2VzQnlUeXBlKHRhcmdldFBpbiwgJ0hBU19QSU4nKTtcbiAgICAgIGlmIChwYXJlbnRFZGdlcy5sZW5ndGggPT09IDApIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCB0YXJnZXRCbG9ja0lkID0gcGFyZW50RWRnZXNbMF0uc291cmNlO1xuICAgICAgY29uc3QgdGFyZ2V0QmxvY2tEYXRhID0gY2xtLmdldE5vZGVEYXRhPEZCREJsb2NrTm9kZURhdGE+KHRhcmdldEJsb2NrSWQpO1xuXG4gICAgICBpZiAodGFyZ2V0QmxvY2tEYXRhLmJsb2NrVHlwZSA9PT0gJ09VVF9WQVJJQUJMRScpIHtcbiAgICAgICAgY29uc3Qgd3JpdGVzID0gY2xtLmdldE91dEVkZ2VzQnlUeXBlKHRhcmdldEJsb2NrSWQsICdXUklURVMnKTtcbiAgICAgICAgaWYgKHdyaXRlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgY29uc3QgdGFnTmFtZSA9IHNhbml0aXplTmFtZSgoY2xtLmdldE5vZGVEYXRhPFRhZ05vZGVEYXRhPih3cml0ZXNbMF0udGFyZ2V0KSkubmFtZSk7XG4gICAgICAgICAgLy8gYmxvY2tJZCBpcyB0aGUgRkIgaW5zdGFuY2UgYmxvY2sgXHUyMDE0IG5lZWQgaW5zdGFuY2VOYW1lIGZyb20gaXRzIGRhdGFcbiAgICAgICAgICBjb25zdCBibG9ja0RhdGEgPSBjbG0uZ2V0Tm9kZURhdGE8RkJEQmxvY2tOb2RlRGF0YT4oYmxvY2tJZCk7XG4gICAgICAgICAgY29uc3QgaW5zdGFuY2VOYW1lID0gc2FuaXRpemVOYW1lKGJsb2NrRGF0YS5pbnN0YW5jZU5hbWUgPz8gYF9GQl8ke2Jsb2NrSWR9YCk7XG4gICAgICAgICAgb3V0cHV0QXNzaWdubWVudHMucHVzaChgICAke3RhZ05hbWV9IDo9ICR7aW5zdGFuY2VOYW1lfS4ke3BpbkRhdGEucGluTmFtZX07YCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBpbnB1dFBhcmFtcywgb3V0cHV0QXNzaWdubWVudHMgfTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEZCRCBDb21iaW5hdG9yaWFsIEV4cHJlc3Npb24gRm9sZGluZyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIENvbnZlcnRzIGxvZ2ljIGdhdGUgYW5kIGFyaXRobWV0aWMgYmxvY2tzIGludG8gaW5saW5lIFNUIGFzc2lnbm1lbnQgc3RhdGVtZW50cy5cbi8vIE9ubHkgZW1pdHMgYW4gYXNzaWdubWVudCB3aGVuIHRoaXMgYmxvY2sncyBvdXRwdXQgZmVlZHMgYW4gT1VUX1ZBUklBQkxFLlxuXG4vLyBNYXBzIEZCRCBibG9jayB0eXBlIHRvIHRoZSBTVCBvcGVyYXRvciB1c2VkIHdoZW4gZm9sZGluZyBpbnB1dHNcbmNvbnN0IENPTUJJTkFUT1JfT1BTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBBTkQ6ICdBTkQnLCBPUjogJ09SJywgWE9SOiAnWE9SJywgTk9UOiAnTk9UJyxcbiAgQUREOiAnKycsIFNVQjogJy0nLCBNVUw6ICcqJywgRElWOiAnLycsIE1PRDogJ01PRCcsXG4gIEVROiAnPScsIE5FUTogJzw+JywgR1Q6ICc+JywgR0VROiAnPj0nLCBMVDogJzwnLCBMRVE6ICc8PScsXG4gIFNFTDogJycsICAgLy8gMi1pbnB1dCBzZWxlY3Q6IHNwZWNpYWwgY2FzZVxuICBNVVg6ICcnLCAgIC8vIG11bHRpLWlucHV0IG11eDogc3BlY2lhbCBjYXNlXG4gIE1PVkU6ICcnLCAgLy8gcGFzcy10aHJvdWdoXG4gIE1BWDogJycsICAgLy8gc3RhbmRhcmQgZnVuY3Rpb24gY2FsbFxuICBNSU46ICcnLFxuICBBQlM6ICcnLFxuICBTUVJUOiAnJyxcbiAgTE46ICcnLFxuICBMT0c6ICcnLFxuICBFWFA6ICcnLFxuICBTSU46ICcnLFxuICBDT1M6ICcnLFxuICBUQU46ICcnLFxuICBBU0lOOiAnJyxcbiAgQUNPUzogJycsXG4gIEFUQU46ICcnLFxuICBUUlVOQzogJycsXG4gIEVYUFQ6ICcnLFxuICBMSU1JVDogJycsXG59O1xuXG4vLyBTdGFuZGFyZCBJRUMgNjExMzEtMyBmdW5jdGlvbnMgdGhhdCB0YWtlIGNvbW1hLXNlcGFyYXRlZCBhcmdzXG5jb25zdCBGVU5DVElPTl9CTE9DS1NfRElSRUNUID0gbmV3IFNldChbXG4gICdNQVgnLCAnTUlOJywgJ0FCUycsICdTUVJUJywgJ0xOJywgJ0xPRycsICdFWFAnLFxuICAnU0lOJywgJ0NPUycsICdUQU4nLCAnQVNJTicsICdBQ09TJywgJ0FUQU4nLCAnVFJVTkMnLCAnRVhQVCcsICdMSU1JVCcsXG4gICdTRUwnLCAnTVVYJyxcbl0pO1xuXG4vKipcbiAqIFJlc29sdmUgdGhlIFNUIGV4cHJlc3Npb24gdGhhdCBwcm9kdWNlcyBhbiBpbnB1dCBwaW4ncyB2YWx1ZS5cbiAqIEZvbGxvd3MgV0lSRSBlZGdlcyBiYWNrd2FyZHMgdG8gSU5fVkFSSUFCTEUgYmxvY2tzIG9yIHJldHVybnMgYSBsaXRlcmFsLlxuICovXG5mdW5jdGlvbiByZXNvbHZlUGluRXhwcihjbG06IENMTUdyYXBoLCBwaW5JZDogc3RyaW5nLCBfd2FybmluZ3M6IHN0cmluZ1tdKTogc3RyaW5nIHtcbiAgY29uc3QgaW5XaXJlcyA9IGNsbS5nZXRJbkVkZ2VzQnlUeXBlKHBpbklkLCAnV0lSRScpO1xuICBpZiAoaW5XaXJlcy5sZW5ndGggPT09IDApIHtcbiAgICAvLyBObyB3aXJlOiBjaGVjayBpZiBwaW4gaGFzIGEgZGVmYXVsdCBmcm9tIGl0cyBwaW4gZGF0YVxuICAgIGNvbnN0IHBkID0gY2xtLmdldE5vZGVEYXRhPEZCRFBpbk5vZGVEYXRhPihwaW5JZCk7XG4gICAgLy8gVXNlIHBpbiBuYW1lIGFzIGxhc3QtcmVzb3J0IGZhbGxiYWNrIHNvIGF0IG1pbmltdW0gY29tcGlsYXRpb24gc3VjY2VlZHNcbiAgICByZXR1cm4gcGQucGluTmFtZSA/PyAnRkFMU0UnO1xuICB9XG5cbiAgY29uc3Qgc291cmNlUGluSWQgPSBpbldpcmVzWzBdLnNvdXJjZTtcbiAgY29uc3QgbmVnYXRlZCA9IChpbldpcmVzWzBdLmRhdGEgYXMgYW55KT8ubmVnYXRlZDtcbiAgY29uc3QgcGFyZW50RWRnZXMgPSBjbG0uZ2V0SW5FZGdlc0J5VHlwZShzb3VyY2VQaW5JZCwgJ0hBU19QSU4nKTtcbiAgaWYgKHBhcmVudEVkZ2VzLmxlbmd0aCA9PT0gMCkgcmV0dXJuICdfd2lyZV9zcmNfdW5rbm93bic7XG5cbiAgY29uc3QgcGFyZW50QmxvY2tJZCA9IHBhcmVudEVkZ2VzWzBdLnNvdXJjZTtcbiAgY29uc3QgcGFyZW50QmxvY2sgPSBjbG0uZ2V0Tm9kZURhdGE8RkJEQmxvY2tOb2RlRGF0YT4ocGFyZW50QmxvY2tJZCk7XG5cbiAgbGV0IGV4cHI6IHN0cmluZztcbiAgaWYgKHBhcmVudEJsb2NrLmJsb2NrVHlwZSA9PT0gJ0lOX1ZBUklBQkxFJykge1xuICAgIGNvbnN0IHJlYWRzID0gY2xtLmdldE91dEVkZ2VzQnlUeXBlKHBhcmVudEJsb2NrSWQsICdSRUFEUycpO1xuICAgIGV4cHIgPSByZWFkcy5sZW5ndGggPiAwXG4gICAgICA/IHNhbml0aXplTmFtZSgoY2xtLmdldE5vZGVEYXRhPFRhZ05vZGVEYXRhPihyZWFkc1swXS50YXJnZXQpKS5uYW1lKVxuICAgICAgOiAnX2luX3Zhcl91bmJvdW5kJztcbiAgfSBlbHNlIGlmIChDT01CSU5BVE9SX09QU1twYXJlbnRCbG9jay5ibG9ja1R5cGVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAvLyBSZWN1cnNpdmVseSBmb2xkIHRoaXMgYmxvY2sncyBleHByZXNzaW9uXG4gICAgZXhwciA9IGJ1aWxkQmxvY2tFeHByKGNsbSwgcGFyZW50QmxvY2tJZCwgcGFyZW50QmxvY2ssIF93YXJuaW5ncyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gRkIgaW5zdGFuY2UgYmxvY2sgXHUyMDE0IHJlZmVyZW5jZSBpbnN0YW5jZS5vdXRwdXRQaW5cbiAgICBjb25zdCBpbnN0YW5jZU5hbWUgPSBzYW5pdGl6ZU5hbWUocGFyZW50QmxvY2suaW5zdGFuY2VOYW1lID8/IGBfRkJfJHtwYXJlbnRCbG9ja0lkfWApO1xuICAgIGNvbnN0IHNvdXJjZVBpbkRhdGEgPSBjbG0uZ2V0Tm9kZURhdGE8RkJEUGluTm9kZURhdGE+KHNvdXJjZVBpbklkKTtcbiAgICBleHByID0gYCR7aW5zdGFuY2VOYW1lfS4ke3NvdXJjZVBpbkRhdGEucGluTmFtZX1gO1xuICB9XG5cbiAgcmV0dXJuIG5lZ2F0ZWQgPyBgTk9UICgke2V4cHJ9KWAgOiBleHByO1xufVxuXG4vKipcbiAqIEJ1aWxkIHRoZSBTVCBleHByZXNzaW9uIGZvciBhIGNvbWJpbmF0b3JpYWwgYmxvY2sgYnkgZm9sZGluZyBpdHMgaW5wdXQgcGlucy5cbiAqL1xuZnVuY3Rpb24gYnVpbGRCbG9ja0V4cHIoXG4gIGNsbTogQ0xNR3JhcGgsXG4gIGJsb2NrSWQ6IHN0cmluZyxcbiAgYmxvY2tEYXRhOiBGQkRCbG9ja05vZGVEYXRhLFxuICB3YXJuaW5nczogc3RyaW5nW10sXG4pOiBzdHJpbmcge1xuICBjb25zdCBidHlwZSA9IGJsb2NrRGF0YS5ibG9ja1R5cGU7XG4gIGNvbnN0IHBpbkVkZ2VzID0gY2xtLmdldE91dEVkZ2VzQnlUeXBlKGJsb2NrSWQsICdIQVNfUElOJyk7XG4gIGNvbnN0IGluUGlucyA9IHBpbkVkZ2VzXG4gICAgLm1hcChlID0+ICh7IGlkOiBlLnRhcmdldCwgZGF0YTogY2xtLmdldE5vZGVEYXRhPEZCRFBpbk5vZGVEYXRhPihlLnRhcmdldCkgfSkpXG4gICAgLmZpbHRlcihwID0+IHAuZGF0YS5kaXJlY3Rpb24gPT09ICdpbicpO1xuXG4gIGNvbnN0IGlucHV0RXhwcnMgPSBpblBpbnMubWFwKHAgPT4gcmVzb2x2ZVBpbkV4cHIoY2xtLCBwLmlkLCB3YXJuaW5ncykpO1xuXG4gIGlmIChidHlwZSA9PT0gJ05PVCcpIHtcbiAgICByZXR1cm4gYE5PVCAoJHtpbnB1dEV4cHJzWzBdID8/ICdGQUxTRSd9KWA7XG4gIH1cbiAgaWYgKGJ0eXBlID09PSAnTU9WRScpIHtcbiAgICByZXR1cm4gaW5wdXRFeHByc1swXSA/PyAnRkFMU0UnO1xuICB9XG4gIGlmIChGVU5DVElPTl9CTE9DS1NfRElSRUNULmhhcyhidHlwZSkpIHtcbiAgICByZXR1cm4gYCR7YnR5cGV9KCR7aW5wdXRFeHBycy5qb2luKCcsICcpfSlgO1xuICB9XG5cbiAgY29uc3Qgb3AgPSBDT01CSU5BVE9SX09QU1tidHlwZV07XG4gIGlmIChvcCAmJiBpbnB1dEV4cHJzLmxlbmd0aCA+PSAyKSB7XG4gICAgcmV0dXJuIGlucHV0RXhwcnMubWFwKGUgPT4gYCgke2V9KWApLmpvaW4oYCAke29wfSBgKTtcbiAgfVxuICBpZiAob3AgJiYgaW5wdXRFeHBycy5sZW5ndGggPT09IDEpIHtcbiAgICByZXR1cm4gaW5wdXRFeHByc1swXTtcbiAgfVxuXG4gIHdhcm5pbmdzLnB1c2goYEZCRCBibG9jayAke2J0eXBlfSBoYXMgdW5yZWNvZ25pc2VkIGNvbWJpbmF0b3IgcGF0dGVybiBcdTIwMTQgdXNpbmcgVFJVRWApO1xuICByZXR1cm4gJ1RSVUUnO1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBjb21iaW5hdG9yaWFsIC8gYXJpdGhtZXRpYyBGQkQgYmxvY2sgdG8gU1QgYXNzaWdubWVudCBzdGF0ZW1lbnRzLlxuICogRW1pdHMgb25lIGFzc2lnbm1lbnQgcGVyIG91dHB1dCBwaW4gdGhhdCBpcyB3aXJlZCB0byBhbiBPVVRfVkFSSUFCTEUuXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVGQkRDb21iaW5hdG9yaWFsKFxuICBjbG06IENMTUdyYXBoLFxuICBibG9ja0lkOiBzdHJpbmcsXG4gIGJsb2NrRGF0YTogRkJEQmxvY2tOb2RlRGF0YSxcbiAgd2FybmluZ3M6IHN0cmluZ1tdLFxuKTogc3RyaW5nW10ge1xuICBjb25zdCBidHlwZSA9IGJsb2NrRGF0YS5ibG9ja1R5cGU7XG4gIGlmICghKGJ0eXBlIGluIENPTUJJTkFUT1JfT1BTKSkge1xuICAgIHdhcm5pbmdzLnB1c2goYEZCRCBibG9jayB0eXBlIFwiJHtidHlwZX1cIiBub3QgaW4gY29tYmluYXRvciB0YWJsZSBcdTIwMTQgc2tpcHBlZGApO1xuICAgIHJldHVybiBbYCAgKCogRkJEICR7YnR5cGV9ICR7YmxvY2tJZH0gXHUyMDE0IHVua25vd24gYmxvY2sgdHlwZSwgc2tpcHBlZCAqKWBdO1xuICB9XG5cbiAgY29uc3QgcGluRWRnZXMgPSBjbG0uZ2V0T3V0RWRnZXNCeVR5cGUoYmxvY2tJZCwgJ0hBU19QSU4nKTtcbiAgY29uc3Qgb3V0UGlucyA9IHBpbkVkZ2VzXG4gICAgLm1hcChlID0+ICh7IGlkOiBlLnRhcmdldCwgZGF0YTogY2xtLmdldE5vZGVEYXRhPEZCRFBpbk5vZGVEYXRhPihlLnRhcmdldCkgfSkpXG4gICAgLmZpbHRlcihwID0+IHAuZGF0YS5kaXJlY3Rpb24gPT09ICdvdXQnKTtcblxuICBjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCBvdXRQaW4gb2Ygb3V0UGlucykge1xuICAgIGNvbnN0IG91dFdpcmVzID0gY2xtLmdldE91dEVkZ2VzQnlUeXBlKG91dFBpbi5pZCwgJ1dJUkUnKTtcbiAgICBmb3IgKGNvbnN0IG91dFdpcmUgb2Ygb3V0V2lyZXMpIHtcbiAgICAgIGNvbnN0IHRhcmdldFBpblBhcmVudHMgPSBjbG0uZ2V0SW5FZGdlc0J5VHlwZShvdXRXaXJlLnRhcmdldCwgJ0hBU19QSU4nKTtcbiAgICAgIGlmICh0YXJnZXRQaW5QYXJlbnRzLmxlbmd0aCA9PT0gMCkgY29udGludWU7XG4gICAgICBjb25zdCB0YXJnZXRCbG9ja0lkID0gdGFyZ2V0UGluUGFyZW50c1swXS5zb3VyY2U7XG4gICAgICBjb25zdCB0YXJnZXRCbG9jayA9IGNsbS5nZXROb2RlRGF0YTxGQkRCbG9ja05vZGVEYXRhPih0YXJnZXRCbG9ja0lkKTtcblxuICAgICAgaWYgKHRhcmdldEJsb2NrLmJsb2NrVHlwZSA9PT0gJ09VVF9WQVJJQUJMRScpIHtcbiAgICAgICAgY29uc3Qgd3JpdGVFZGdlcyA9IGNsbS5nZXRPdXRFZGdlc0J5VHlwZSh0YXJnZXRCbG9ja0lkLCAnV1JJVEVTJyk7XG4gICAgICAgIGlmICh3cml0ZUVkZ2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjb25zdCBkZXN0VGFnID0gc2FuaXRpemVOYW1lKChjbG0uZ2V0Tm9kZURhdGE8VGFnTm9kZURhdGE+KHdyaXRlRWRnZXNbMF0udGFyZ2V0KSkubmFtZSk7XG4gICAgICAgICAgY29uc3QgZXhwciA9IGJ1aWxkQmxvY2tFeHByKGNsbSwgYmxvY2tJZCwgYmxvY2tEYXRhLCB3YXJuaW5ncyk7XG4gICAgICAgICAgbGluZXMucHVzaChgICAke2Rlc3RUYWd9IDo9ICR7ZXhwcn07YCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gbGluZXM7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBTRkMgXHUyMTkyIFNUIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBjb21waWxlU0ZDVG9TVChjbG06IENMTUdyYXBoLCBzdGVwSWRzOiBzdHJpbmdbXSwgd2FybmluZ3M6IHN0cmluZ1tdKTogc3RyaW5nW10ge1xuICAvLyBTRkMgXHUyMTkyIFNUOiBlbmNvZGUgc3RhdGUgbWFjaGluZSBhcyBhbiBJTlQgc3RhdGUgdmFyaWFibGUgKyBDQVNFIHN0YXRlbWVudFxuICAvLyBUaGlzIGlzIGEgc3RhbmRhcmQsIG5vbi1wcm9wcmlldGFyeSB0cmFuc2Zvcm1hdGlvbi5cbiAgY29uc3Qgc3RlcHMgPSBzdGVwSWRzLm1hcChpZCA9PiAoe1xuICAgIGlkLFxuICAgIGRhdGE6IGNsbS5nZXROb2RlRGF0YTxTRkNTdGVwTm9kZURhdGE+KGlkKSxcbiAgfSkpO1xuXG4gIGNvbnN0IGluaXRpYWxTdGVwID0gc3RlcHMuZmluZChzID0+IHMuZGF0YS5pc0luaXRpYWwpID8/IHN0ZXBzWzBdO1xuICBpZiAoIWluaXRpYWxTdGVwKSByZXR1cm4gW107XG5cbiAgY29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG4gIGxpbmVzLnB1c2goJyAgKCogU0ZDIGVuY29kZWQgYXMgc3RhdGUgbWFjaGluZSAqKScpO1xuXG4gIC8vIFN0YXRlIHZhcmlhYmxlIChkZWNsYXJlZCBpbmxpbmUgXHUyMDE0IFZBUiBzZWN0aW9uIGhhbmRsZXMgaXQgYXQgdG9wIGxldmVsKVxuICAvLyBXZSB1c2Ugc3RlcCBpbmRleCBhcyBzdGF0ZSBudW1iZXJcbiAgY29uc3Qgc3RlcEluZGV4TWFwID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgc3RlcHMuZm9yRWFjaCgocywgaSkgPT4gc3RlcEluZGV4TWFwLnNldChzLmlkLCBpKSk7XG5cbiAgY29uc3QgaW5pdGlhbFN0YXRlID0gc3RlcEluZGV4TWFwLmdldChpbml0aWFsU3RlcC5pZCkgPz8gMDtcbiAgbGluZXMucHVzaChgICBJRiBfU0ZDX1NUQVRFID0gLTEgVEhFTiBfU0ZDX1NUQVRFIDo9ICR7aW5pdGlhbFN0YXRlfTsgRU5EX0lGO2ApO1xuICBsaW5lcy5wdXNoKCcnKTtcbiAgbGluZXMucHVzaCgnICBDQVNFIF9TRkNfU1RBVEUgT0YnKTtcblxuICBmb3IgKGNvbnN0IHN0ZXAgb2Ygc3RlcHMpIHtcbiAgICBjb25zdCBzdGF0ZU51bSA9IHN0ZXBJbmRleE1hcC5nZXQoc3RlcC5pZCkhO1xuICAgIGxpbmVzLnB1c2goYCAgICAke3N0YXRlTnVtfTogKCogJHtzdGVwLmRhdGEuc3RlcE5hbWV9ICopYCk7XG5cbiAgICAvLyBFbWl0IGFjdGlvbnMgZm9yIHRoaXMgc3RlcCBcdTIwMTQgdXNlIHVwZGF0ZWQgc2ZjQWN0aW9uVG9TVCB3aXRoIHRpbWVkIHF1YWxpZmllciBzdXBwb3J0XG4gICAgY29uc3QgYWN0aW9uRWRnZXMgPSBjbG0uZ2V0T3V0RWRnZXNCeVR5cGUoc3RlcC5pZCwgJ0hBU19BQ1RJT04nKTtcbiAgICBmb3IgKGNvbnN0IGVkZ2Ugb2YgYWN0aW9uRWRnZXMpIHtcbiAgICAgIGNvbnN0IGFjdGlvbkRhdGEgPSBjbG0uZ2V0Tm9kZURhdGE8U0ZDQWN0aW9uTm9kZURhdGE+KGVkZ2UudGFyZ2V0KTtcbiAgICAgIGNvbnN0IHdyaXRlcyA9IGNsbS5nZXRPdXRFZGdlc0J5VHlwZShlZGdlLnRhcmdldCwgJ1dSSVRFUycpO1xuICAgICAgY29uc3QgdGFnTmFtZSA9IHdyaXRlcy5sZW5ndGggPiAwXG4gICAgICAgID8gc2FuaXRpemVOYW1lKChjbG0uZ2V0Tm9kZURhdGE8VGFnTm9kZURhdGE+KHdyaXRlc1swXS50YXJnZXQpKS5uYW1lKVxuICAgICAgICA6ICdfVU5LTk9XTic7XG5cbiAgICAgIGNvbnN0IGFjdGlvbkxpbmVzID0gc2ZjQWN0aW9uVG9TVChhY3Rpb25EYXRhLCB0YWdOYW1lLCAnX1NGQ19TVEFURScsIHN0YXRlTnVtKTtcbiAgICAgIGxpbmVzLnB1c2goLi4uYWN0aW9uTGluZXMpO1xuICAgIH1cblxuICAgIC8vIE91dGdvaW5nIFNGQ19GTE9XIGVkZ2VzIFx1MjE5MiBmaW5kIG5leHQgc3RlcHMgdmlhIHRyYW5zaXRpb25zXG4gICAgY29uc3Qgb3V0Zmxvd3MgPSBjbG0uZ2V0T3V0RWRnZXNCeVR5cGUoc3RlcC5pZCwgJ1NGQ19GTE9XJyk7XG4gICAgZm9yIChjb25zdCBmbG93IG9mIG91dGZsb3dzKSB7XG4gICAgICBjb25zdCB0YXJnZXRJZCA9IGZsb3cudGFyZ2V0O1xuICAgICAgY29uc3QgdGFyZ2V0QXR0ciA9IGNsbS5nZXROb2RlQXR0cih0YXJnZXRJZCk7XG5cbiAgICAgIGlmICh0YXJnZXRBdHRyLnR5cGUgPT09ICdTRkNfVFJBTlNJVElPTicpIHtcbiAgICAgICAgY29uc3QgdHJhbnNEYXRhID0gY2xtLmdldE5vZGVEYXRhPFNGQ1RyYW5zaXRpb25Ob2RlRGF0YT4odGFyZ2V0SWQpO1xuICAgICAgICBjb25zdCB0cmFuc091dGZsb3dzID0gY2xtLmdldE91dEVkZ2VzQnlUeXBlKHRhcmdldElkLCAnU0ZDX0ZMT1cnKTtcblxuICAgICAgICBmb3IgKGNvbnN0IG5leHRGbG93IG9mIHRyYW5zT3V0Zmxvd3MpIHtcbiAgICAgICAgICBjb25zdCBuZXh0U3RlcElkID0gbmV4dEZsb3cudGFyZ2V0O1xuICAgICAgICAgIGNvbnN0IG5leHRTdGF0ZSA9IHN0ZXBJbmRleE1hcC5nZXQobmV4dFN0ZXBJZCk7XG4gICAgICAgICAgaWYgKG5leHRTdGF0ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb25zdCBjb25kID0gdHJhbnNEYXRhLmNvbmRpdGlvbkV4cHIgfHwgJ1RSVUUnO1xuICAgICAgICAgICAgbGluZXMucHVzaChgICAgICAgSUYgJHtjb25kfSBUSEVOIF9TRkNfU1RBVEUgOj0gJHtuZXh0U3RhdGV9OyBFTkRfSUY7YCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGxpbmVzLnB1c2goJycpO1xuICB9XG5cbiAgbGluZXMucHVzaCgnICBFTkRfQ0FTRTsnKTtcbiAgcmV0dXJuIGxpbmVzO1xufVxuXG5mdW5jdGlvbiBzZmNBY3Rpb25Ub1NUKGFjdGlvbjogU0ZDQWN0aW9uTm9kZURhdGEsIHRhZ05hbWU6IHN0cmluZywgc3RlcFN0YXRlVmFyOiBzdHJpbmcsIHN0YXRlTnVtOiBudW1iZXIpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IGR1ciA9IGFjdGlvbi5kdXJhdGlvbiA/IGBUIyR7YWN0aW9uLmR1cmF0aW9ufWAgOiAnVCMwbXMnO1xuICBjb25zdCB0aW1lclZhciA9IGBfU0ZDX1RNUl8ke3RhZ05hbWV9XyR7c3RhdGVOdW19YDtcblxuICBzd2l0Y2ggKGFjdGlvbi5xdWFsaWZpZXIpIHtcbiAgICBjYXNlICdOJzpcbiAgICAgIC8vIE5vbi1zdG9yZWQ6IGFjdGl2ZSBleGFjdGx5IHdoaWxlIHN0ZXAgaXMgYWN0aXZlXG4gICAgICByZXR1cm4gW2AgICAgICAke3RhZ05hbWV9IDo9IFRSVUU7ICAgKCogTjogYWN0aXZlIHdoaWxlIHN0ZXAgJHtzdGF0ZU51bX0gaXMgYWN0aXZlICopYF07XG5cbiAgICBjYXNlICdTJzpcbiAgICAgIC8vIFNldDogbGF0Y2ggb24sIHJlbWFpbnMgYWZ0ZXIgc3RlcCBleGl0c1xuICAgICAgcmV0dXJuIFtgICAgICAgJHt0YWdOYW1lfSA6PSBUUlVFOyAgICgqIFM6IHNldCAtIHJlbWFpbnMgbGF0Y2hlZCAqKWBdO1xuXG4gICAgY2FzZSAnUic6XG4gICAgICAvLyBSZXNldDogdW5sYXRjaFxuICAgICAgcmV0dXJuIFtgICAgICAgJHt0YWdOYW1lfSA6PSBGQUxTRTsgICgqIFI6IHJlc2V0IC0gdW5sYXRjaCAqKWBdO1xuXG4gICAgY2FzZSAnUCc6XG4gICAgY2FzZSAnUDEnOiB7XG4gICAgICAvLyBQb3NpdGl2ZSBwdWxzZTogZmlyZSBvbmNlIG9uIHN0ZXAgZW50cnkgdXNpbmcgYSBvbmUtc2hvdCBmbGFnXG4gICAgICBjb25zdCBlZGdlVmFyID0gYF9TRkNfUDFfJHt0YWdOYW1lfV8ke3N0YXRlTnVtfWA7XG4gICAgICByZXR1cm4gW1xuICAgICAgICBgICAgICAgSUYgTk9UICR7ZWRnZVZhcn0gVEhFTiAke3RhZ05hbWV9IDo9IFRSVUU7ICR7ZWRnZVZhcn0gOj0gVFJVRTsgRU5EX0lGOyAoKiBQMTogcmlzaW5nIHB1bHNlICopYCxcbiAgICAgIF07XG4gICAgfVxuXG4gICAgY2FzZSAnUDAnOiB7XG4gICAgICAvLyBOZWdhdGl2ZSBwdWxzZTogZmlyZSBvbmNlIG9uIHN0ZXAgZXhpdCBcdTIwMTQgZGV0ZWN0ZWQgYnkgX3ByZXYgc3RhdGUgdmFyaWFibGVcbiAgICAgIGNvbnN0IGVkZ2VWYXIgPSBgX1NGQ19QMF8ke3RhZ05hbWV9XyR7c3RhdGVOdW19YDtcbiAgICAgIHJldHVybiBbXG4gICAgICAgIGAgICAgICAke2VkZ2VWYXJ9IDo9IFRSVUU7ICgqIFAwOiBmYWxsaW5nIHB1bHNlIGFybSBcdTIwMTQgZmlyZXMgb24gZXhpdCAqKWAsXG4gICAgICBdO1xuICAgIH1cblxuICAgIGNhc2UgJ0wnOlxuICAgICAgLy8gVGltZS1saW1pdGVkOiBhY3RpdmUgd2hpbGUgc3RlcCBhY3RpdmUgQU5EIGVsYXBzZWQgPCBkdXJhdGlvblxuICAgICAgcmV0dXJuIFtcbiAgICAgICAgYCAgICAgICR7dGltZXJWYXJ9KElOIDo9ICgke3N0ZXBTdGF0ZVZhcn0gPSAke3N0YXRlTnVtfSksIFBUIDo9ICR7ZHVyfSk7YCxcbiAgICAgICAgYCAgICAgIElGIE5PVCAke3RpbWVyVmFyfS5RIFRIRU4gJHt0YWdOYW1lfSA6PSBUUlVFOyBFTFNFICR7dGFnTmFtZX0gOj0gRkFMU0U7IEVORF9JRjsgKCogTDogdGltZS1saW1pdGVkICopYCxcbiAgICAgIF07XG5cbiAgICBjYXNlICdEJzpcbiAgICAgIC8vIFRpbWUtZGVsYXllZDogYWN0aXZlIG9ubHkgQUZURVIgZHVyYXRpb24gaGFzIGVsYXBzZWQgd2hpbGUgc3RlcCBhY3RpdmVcbiAgICAgIHJldHVybiBbXG4gICAgICAgIGAgICAgICAke3RpbWVyVmFyfShJTiA6PSAoJHtzdGVwU3RhdGVWYXJ9ID0gJHtzdGF0ZU51bX0pLCBQVCA6PSAke2R1cn0pO2AsXG4gICAgICAgIGAgICAgICAke3RhZ05hbWV9IDo9ICR7dGltZXJWYXJ9LlE7ICAgKCogRDogZGVsYXllZCBhY3RpdmF0aW9uICopYCxcbiAgICAgIF07XG5cbiAgICBjYXNlICdTRCc6XG4gICAgICAvLyBTdG9yZWQtZGVsYXllZDogc2V0IGFmdGVyIGRlbGF5LCByZW1haW5zIHNldCBhZnRlciBzdGVwIGV4aXRzXG4gICAgICByZXR1cm4gW1xuICAgICAgICBgICAgICAgJHt0aW1lclZhcn0oSU4gOj0gKCR7c3RlcFN0YXRlVmFyfSA9ICR7c3RhdGVOdW19KSwgUFQgOj0gJHtkdXJ9KTtgLFxuICAgICAgICBgICAgICAgSUYgJHt0aW1lclZhcn0uUSBUSEVOICR7dGFnTmFtZX0gOj0gVFJVRTsgRU5EX0lGOyAoKiBTRDogc3RvcmVkLWRlbGF5ZWQgc2V0ICopYCxcbiAgICAgIF07XG5cbiAgICBjYXNlICdEUyc6XG4gICAgICAvLyBEZWxheWVkLXN0b3JlZDogbGlrZSBTRCBidXQgb25seSBzZXRzIGlmIHN0ZXAgc3RpbGwgYWN0aXZlIHdoZW4gdGltZXIgZmlyZXNcbiAgICAgIHJldHVybiBbXG4gICAgICAgIGAgICAgICAke3RpbWVyVmFyfShJTiA6PSAoJHtzdGVwU3RhdGVWYXJ9ID0gJHtzdGF0ZU51bX0pLCBQVCA6PSAke2R1cn0pO2AsXG4gICAgICAgIGAgICAgICBJRiAke3RpbWVyVmFyfS5RIEFORCAoJHtzdGVwU3RhdGVWYXJ9ID0gJHtzdGF0ZU51bX0pIFRIRU4gJHt0YWdOYW1lfSA6PSBUUlVFOyBFTkRfSUY7ICgqIERTOiBkZWxheWVkLXN0b3JlZCAqKWAsXG4gICAgICBdO1xuXG4gICAgY2FzZSAnU0wnOlxuICAgICAgLy8gU3RvcmVkLXRpbWUtbGltaXRlZDogc2V0IG9uIGVudHJ5LCByZXNldHMgYWZ0ZXIgZHVyYXRpb25cbiAgICAgIHJldHVybiBbXG4gICAgICAgIGAgICAgICBJRiAke3N0ZXBTdGF0ZVZhcn0gPSAke3N0YXRlTnVtfSBUSEVOICR7dGFnTmFtZX0gOj0gVFJVRTsgRU5EX0lGO2AsXG4gICAgICAgIGAgICAgICAke3RpbWVyVmFyfShJTiA6PSAke3RhZ05hbWV9LCBQVCA6PSAke2R1cn0pO2AsXG4gICAgICAgIGAgICAgICBJRiAke3RpbWVyVmFyfS5RIFRIRU4gJHt0YWdOYW1lfSA6PSBGQUxTRTsgRU5EX0lGOyAoKiBTTDogc3RvcmVkLWxpbWl0ZWQgKilgLFxuICAgICAgXTtcblxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gW2AgICAgICAke3RhZ05hbWV9IDo9IFRSVUU7ICAgKCogJHthY3Rpb24ucXVhbGlmaWVyfTogdW5yZWNvZ25pc2VkIHF1YWxpZmllciAqKWBdO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBGQiBpbnN0YW5jZSBWQVIgY29sbGVjdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gY29sbGVjdEZCSW5zdGFuY2VWYXJzKGNsbTogQ0xNR3JhcGgpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHZhcnM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICAvLyBMRCBmYl9jYWxsIGVsZW1lbnRzXG4gIGZvciAoY29uc3Qgbm9kZUlkIG9mIGNsbS5nZXROb2Rlc0J5VHlwZSgnTERfRUxFTUVOVCcpKSB7XG4gICAgY29uc3QgZGF0YSA9IGNsbS5nZXROb2RlRGF0YTxMREVsZW1lbnROb2RlRGF0YT4obm9kZUlkKTtcbiAgICBpZiAoZGF0YS5lbGVtZW50S2luZCA9PT0gJ2ZiX2NhbGwnICYmIGRhdGEuaW5zdGFuY2VOYW1lICYmIGRhdGEuZmJUeXBlKSB7XG4gICAgICBjb25zdCBuYW1lID0gc2FuaXRpemVOYW1lKGRhdGEuaW5zdGFuY2VOYW1lKTtcbiAgICAgIGlmICghc2Vlbi5oYXMobmFtZSkpIHtcbiAgICAgICAgc2Vlbi5hZGQobmFtZSk7XG4gICAgICAgIHZhcnMucHVzaChgICAgICR7bmFtZX0gOiAke2RhdGEuZmJUeXBlfTtgKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBGQkQgZnVuY3Rpb24tYmxvY2sgYmxvY2tzXG4gIGZvciAoY29uc3Qgbm9kZUlkIG9mIGNsbS5nZXROb2Rlc0J5VHlwZSgnRkJEX0JMT0NLJykpIHtcbiAgICBjb25zdCBkYXRhID0gY2xtLmdldE5vZGVEYXRhPEZCREJsb2NrTm9kZURhdGE+KG5vZGVJZCk7XG4gICAgaWYgKGlzRnVuY3Rpb25CbG9jayhkYXRhLmJsb2NrVHlwZSkgJiYgZGF0YS5pbnN0YW5jZU5hbWUpIHtcbiAgICAgIGNvbnN0IG5hbWUgPSBzYW5pdGl6ZU5hbWUoZGF0YS5pbnN0YW5jZU5hbWUpO1xuICAgICAgaWYgKCFzZWVuLmhhcyhuYW1lKSkge1xuICAgICAgICBzZWVuLmFkZChuYW1lKTtcbiAgICAgICAgdmFycy5wdXNoKGAgICAgJHtuYW1lfSA6ICR7ZGF0YS5ibG9ja1R5cGV9O2ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFNGQyBzdGF0ZSB2YXJpYWJsZSBhbmQgdGltZWQtcXVhbGlmaWVyIHRpbWVyIGluc3RhbmNlc1xuICBjb25zdCBzZmNTdGVwcyA9IGNsbS5nZXROb2Rlc0J5VHlwZSgnU0ZDX1NURVAnKTtcbiAgaWYgKHNmY1N0ZXBzLmxlbmd0aCA+IDApIHtcbiAgICB2YXJzLnB1c2goJyAgICBfU0ZDX1NUQVRFIDogSU5UIDo9IC0xOycpO1xuXG4gICAgc2ZjU3RlcHMuZm9yRWFjaCgoc3RlcElkLCBzdGF0ZU51bSkgPT4ge1xuICAgICAgY29uc3QgYWN0aW9uRWRnZXMgPSBjbG0uZ2V0T3V0RWRnZXNCeVR5cGUoc3RlcElkLCAnSEFTX0FDVElPTicpO1xuICAgICAgZm9yIChjb25zdCBhZSBvZiBhY3Rpb25FZGdlcykge1xuICAgICAgICBjb25zdCBhY3Rpb25EYXRhID0gY2xtLmdldE5vZGVEYXRhPFNGQ0FjdGlvbk5vZGVEYXRhPihhZS50YXJnZXQpO1xuICAgICAgICBjb25zdCB3cml0ZXMgPSBjbG0uZ2V0T3V0RWRnZXNCeVR5cGUoYWUudGFyZ2V0LCAnV1JJVEVTJyk7XG4gICAgICAgIGNvbnN0IHRhZ05hbWUgPSB3cml0ZXMubGVuZ3RoID4gMFxuICAgICAgICAgID8gc2FuaXRpemVOYW1lKChjbG0uZ2V0Tm9kZURhdGE8VGFnTm9kZURhdGE+KHdyaXRlc1swXS50YXJnZXQpKS5uYW1lKVxuICAgICAgICAgIDogJ19VTktOT1dOJztcblxuICAgICAgICBjb25zdCB0aW1lZFF1YWxpZmllcnMgPSBuZXcgU2V0KFsnTCcsICdEJywgJ1NEJywgJ0RTJywgJ1NMJ10pO1xuICAgICAgICBpZiAodGltZWRRdWFsaWZpZXJzLmhhcyhhY3Rpb25EYXRhLnF1YWxpZmllcikpIHtcbiAgICAgICAgICBjb25zdCB0aW1lclZhciA9IGBfU0ZDX1RNUl8ke3RhZ05hbWV9XyR7c3RhdGVOdW19YDtcbiAgICAgICAgICBpZiAoIXNlZW4uaGFzKHRpbWVyVmFyKSkge1xuICAgICAgICAgICAgc2Vlbi5hZGQodGltZXJWYXIpO1xuICAgICAgICAgICAgdmFycy5wdXNoKGAgICAgJHt0aW1lclZhcn0gOiBUT047YCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIFAwL1AxIG9uZS1zaG90IGZsYWdzXG4gICAgICAgIGlmIChhY3Rpb25EYXRhLnF1YWxpZmllciA9PT0gJ1AnIHx8IGFjdGlvbkRhdGEucXVhbGlmaWVyID09PSAnUDEnKSB7XG4gICAgICAgICAgY29uc3QgZWRnZVZhciA9IGBfU0ZDX1AxXyR7dGFnTmFtZX1fJHtzdGF0ZU51bX1gO1xuICAgICAgICAgIGlmICghc2Vlbi5oYXMoZWRnZVZhcikpIHsgc2Vlbi5hZGQoZWRnZVZhcik7IHZhcnMucHVzaChgICAgICR7ZWRnZVZhcn0gOiBCT09MIDo9IEZBTFNFO2ApOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFjdGlvbkRhdGEucXVhbGlmaWVyID09PSAnUDAnKSB7XG4gICAgICAgICAgY29uc3QgZWRnZVZhciA9IGBfU0ZDX1AwXyR7dGFnTmFtZX1fJHtzdGF0ZU51bX1gO1xuICAgICAgICAgIGlmICghc2Vlbi5oYXMoZWRnZVZhcikpIHsgc2Vlbi5hZGQoZWRnZVZhcik7IHZhcnMucHVzaChgICAgICR7ZWRnZVZhcn0gOiBCT09MIDo9IEZBTFNFO2ApOyB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB2YXJzO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgSGVscGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gaXNGdW5jdGlvbkJsb2NrKGJsb2NrVHlwZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IEZCX1RZUEVTID0gbmV3IFNldChbXG4gICAgJ1RPTicsICdUT0YnLCAnVFAnLCAnQ1RVJywgJ0NURCcsICdDVFVEJyxcbiAgICAnU1InLCAnUlMnLCAnUlRSSUcnLCAnRlRSSUcnLFxuICBdKTtcbiAgcmV0dXJuIEZCX1RZUEVTLmhhcyhibG9ja1R5cGUpO1xufVxuXG5mdW5jdGlvbiBzYW5pdGl6ZU5hbWUobmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgLy8gSUVDIDYxMTMxLTMgaWRlbnRpZmllcnM6IFtBLVphLXpfXVtBLVphLXowLTlfXSpcbiAgcmV0dXJuIG5hbWUucmVwbGFjZSgvW15BLVphLXowLTlfXS9nLCAnXycpLnJlcGxhY2UoL14oWzAtOV0pLywgJ18kMScpO1xufVxuXG5mdW5jdGlvbiBkZWZhdWx0SW5pdEZvcihkdDogSUVDRGF0YVR5cGUpOiBzdHJpbmcge1xuICBzd2l0Y2ggKGR0KSB7XG4gICAgY2FzZSAnQk9PTCc6IHJldHVybiAnIDo9IEZBTFNFJztcbiAgICBjYXNlICdSRUFMJzpcbiAgICBjYXNlICdMUkVBTCc6IHJldHVybiAnIDo9IDAuMCc7XG4gICAgY2FzZSAnU1RSSU5HJzpcbiAgICBjYXNlICdXU1RSSU5HJzogcmV0dXJuIFwiIDo9ICcnXCI7XG4gICAgY2FzZSAnVElNRSc6IHJldHVybiAnIDo9IFQjMG1zJztcbiAgICBjYXNlICdBUlJBWV9CT09MJzogcmV0dXJuICcnOyAgLy8gQVJSQVkgdHlwZSBcdTIwMTQgaW5pdGlhbGl6ZXIgc3ludGF4IGRlcGVuZHMgb24gZGltZW5zaW9uczsgb21pdFxuICAgIGNhc2UgJ0FSUkFZX0lOVCc6ICByZXR1cm4gJyc7XG4gICAgY2FzZSAnQVJSQVlfUkVBTCc6IHJldHVybiAnJztcbiAgICBjYXNlICdTVFJVQ1QnOiByZXR1cm4gJyA6PSAoKSc7XG4gICAgZGVmYXVsdDogcmV0dXJuICcgOj0gMCc7XG4gIH1cbn1cblxuIl0sCiAgIm1hcHBpbmdzIjogIkFBdUNBLE1BQU0sbUJBQW1CO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FB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
