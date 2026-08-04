import { parseXML, buildXML, attr, text, child, childArray } from "../xmlUtils.js";
import { plcopenTypeToIEC } from "../dataTypeMap.js";
import { buildResolver, VariableTypeResolver } from "../variableTypeResolver.js";
import { getPinDataType, buildTypedPins, buildTypedTagRefPins } from "../pinSignatures.js";
function unescapeXML(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
function importPLCopen(xmlContent, filePath) {
  const errors = [];
  const warnings = [];
  const unmapped = [];
  let root;
  try {
    root = parseXML(xmlContent);
  } catch (e) {
    return { ok: false, errors: [`XML parse error: ${e}`], warnings: [] };
  }
  const project = child(root, "project");
  if (!project) {
    return { ok: false, errors: ["No <project> root element found"], warnings: [] };
  }
  const fileInfo = child(project, "fileHeader");
  const projectName = attr(fileInfo, "projectName") || attr(project, "projectName") || "Imported Project";
  const version = attr(fileInfo, "productVersion") || "1.0";
  const globalTags = [];
  const typesNode = child(project, "types");
  if (typesNode) {
    childArray(typesNode, "globalVars").forEach((gvList) => {
      childArray(gvList, "variable").forEach((v) => {
        const tag = parseVariable(v, unmapped);
        if (tag) globalTags.push(tag);
      });
    });
  }
  const instancesNode = child(project, "instances");
  if (instancesNode) {
    childArray(instancesNode, "configurations").forEach((config) => {
      childArray(config, "globalVars").forEach((gvList) => {
        childArray(gvList, "variable").forEach((v) => {
          const tag = parseVariable(v, unmapped);
          if (tag) globalTags.push(tag);
        });
      });
    });
  }
  const pous = [];
  const typesEl = child(project, "types");
  const poisEl = typesEl ? child(typesEl, "pous") : void 0;
  const pouList = childArray(poisEl ?? typesEl, "pou");
  for (const pouEl of pouList) {
    const pou = parsePOU(pouEl, unmapped, warnings);
    if (pou) pous.push(pou);
  }
  if (pous.length === 0) {
    errors.push("No POUs found in file");
    return { ok: false, errors, warnings };
  }
  const sidecar = {
    sourceVendor: "plcopen_xml",
    sourceFileVersion: version,
    originalFilePath: filePath,
    unmappedElements: unmapped,
    organizerTreeLayout: child(project, "instances")
  };
  return {
    ok: true,
    project: { projectName, pous, globalTags, sidecar },
    errors,
    warnings
  };
}
function parseVariable(v, unmapped) {
  if (!v || typeof v !== "object") return null;
  const name = attr(v, "name");
  if (!name) return null;
  const typeEl = child(v, "type");
  const dataType = inferType(typeEl, unmapped, name);
  const initEl = child(v, "initialValue");
  const doc = child(v, "documentation");
  return {
    name,
    dataType,
    // TC6: <simpleValue value="0"/> — value is an attribute, not text content
    initialValue: initEl ? attr(child(initEl, "simpleValue"), "value") || text(child(initEl, "simpleValue")) || text(initEl) || void 0 : void 0,
    description: doc ? text(doc) : void 0,
    address: attr(v, "address") || void 0
  };
}
function inferType(typeEl, unmapped, hint) {
  if (!typeEl || typeof typeEl !== "object") return "BOOL";
  const t = typeEl;
  for (const key of Object.keys(t)) {
    if (key.startsWith("@_")) continue;
    return plcopenTypeToIEC(key);
  }
  unmapped.push({ clmNodeId: null, vendorSpecificData: typeEl, reason: `Unknown type for ${hint}` });
  return "DINT";
}
function parsePOU(pouEl, unmapped, warnings) {
  if (!pouEl || typeof pouEl !== "object") return null;
  const name = attr(pouEl, "name");
  if (!name) return null;
  const pouType = attr(pouEl, "pouType");
  const localTags = [];
  const interfaceEl = child(pouEl, "interface");
  if (interfaceEl) {
    for (const section of ["localVars", "inputVars", "outputVars", "inOutVars", "externalVars", "tempVars", "globalVars"]) {
      childArray(interfaceEl, section).forEach((sec) => {
        childArray(sec, "variable").forEach((v) => {
          const tag = parseVariable(v, unmapped);
          if (tag) localTags.push(tag);
        });
      });
    }
    childArray(interfaceEl, "variable").forEach((v) => {
      const tag = parseVariable(v, unmapped);
      if (tag) localTags.push(tag);
    });
    const retTypeEl = child(interfaceEl, "returnType");
    if (retTypeEl) {
      const retType = inferType(retTypeEl, unmapped, `${name}_returnType`);
      localTags.push({ name: "__returnType__", dataType: retType });
    }
  }
  const normalizedPouType = pouType;
  const bodyEl = child(pouEl, "body");
  if (!bodyEl) {
    warnings.push(`POU "${name}" has no body \u2014 imported as empty`);
    return { id: `pou-${name}`, name, pouType: normalizedPouType, language: "LD", ladderProgram: { rungs: [] }, localTags };
  }
  const resolver = buildResolver(localTags, []);
  if (child(bodyEl, "LD")) {
    const ld = parseLDBody(child(bodyEl, "LD"), name, unmapped, resolver);
    return { id: `pou-${name}`, name, pouType: normalizedPouType, language: "LD", ladderProgram: ld, localTags };
  }
  if (child(bodyEl, "FBD")) {
    const fbd = parseFBDBody(child(bodyEl, "FBD"), name, unmapped, resolver);
    return { id: `pou-${name}`, name, pouType: normalizedPouType, language: "FBD", fbdProgram: fbd, localTags };
  }
  if (child(bodyEl, "SFC")) {
    const sfc = parseSFCBody(child(bodyEl, "SFC"), name, unmapped);
    return { id: `pou-${name}`, name, pouType: normalizedPouType, language: "SFC", sfcProgram: sfc, localTags };
  }
  if (child(bodyEl, "ST")) {
    const stEl = child(bodyEl, "ST");
    const pEls = childArray(stEl, "xhtml:p");
    let rawSrc;
    if (pEls.length > 0) {
      rawSrc = pEls.map((p) => text(p) || "").join("\n");
    } else {
      rawSrc = text(child(stEl, "xhtml") ?? stEl) || "";
    }
    const src = rawSrc ? unescapeXML(rawSrc) : rawSrc;
    return { id: `pou-${name}`, name, pouType: normalizedPouType, language: "ST", stSource: src, localTags };
  }
  if (child(bodyEl, "IL")) {
    unmapped.push({ clmNodeId: `pou-${name}`, vendorSpecificData: bodyEl, reason: "IL language not supported" });
    return { id: `pou-${name}`, name, pouType: normalizedPouType, language: "ST", stSource: "(* IL import not supported *)", localTags };
  }
  unmapped.push({ clmNodeId: `pou-${name}`, vendorSpecificData: bodyEl, reason: "Unknown body language" });
  return { id: `pou-${name}`, name, pouType: normalizedPouType, language: "LD", ladderProgram: { rungs: [] }, localTags };
}
function parseLDBody(ldEl, pouName, unmapped, resolver = new VariableTypeResolver()) {
  const rungs = [];
  if (!ldEl) return { rungs };
  let rungElements = childArray(ldEl, "rung");
  if (rungElements.length === 0) {
    rungElements = [ldEl];
  }
  let rungIdx = 0;
  for (const networkEl of rungElements) {
    rungIdx++;
    const comment = text(child(networkEl, "comment") ?? child(networkEl, "documentation"));
    const allElements = [];
    const localIdMap = /* @__PURE__ */ new Map();
    for (const contact of childArray(networkEl, "contact")) {
      const el = parseLDContact(contact, allElements.length, resolver);
      if (el) {
        allElements.push(el);
        const lid = attr(contact, "localId");
        if (lid) localIdMap.set(lid, el);
      }
    }
    for (const coil of childArray(networkEl, "coil")) {
      const el = parseLDCoil(coil, allElements.length, resolver);
      if (el) {
        allElements.push(el);
        const lid = attr(coil, "localId");
        if (lid) localIdMap.set(lid, el);
      }
    }
    for (const block of childArray(networkEl, "block")) {
      const el = parseLDBlock(block, allElements.length, unmapped, resolver);
      if (el) {
        allElements.push(el);
        const lid = attr(block, "localId");
        if (lid) localIdMap.set(lid, el);
      }
    }
    const incomingEdges = /* @__PURE__ */ new Map();
    for (const elTag of [...childArray(networkEl, "contact"), ...childArray(networkEl, "coil"), ...childArray(networkEl, "block")]) {
      const localId = attr(elTag, "localId");
      if (!localId) continue;
      const cpIn = child(elTag, "connectionPointIn");
      if (!cpIn) continue;
      const conns = childArray(cpIn, "connection");
      const sources = conns.map((c) => attr(c, "refLocalId")).filter(Boolean);
      if (sources.length > 0) incomingEdges.set(localId, sources);
    }
    const outgoing = /* @__PURE__ */ new Map();
    for (const [target, sources] of incomingEdges) {
      for (const src of sources) {
        if (!outgoing.has(src)) outgoing.set(src, []);
        outgoing.get(src).push(target);
      }
    }
    const branchPoints = /* @__PURE__ */ new Set();
    for (const [src, targets] of outgoing) {
      if (targets.length > 1) branchPoints.add(src);
    }
    const branches = [];
    const branchElements = /* @__PURE__ */ new Set();
    if (branchPoints.size > 0) {
      for (const branchSrc of branchPoints) {
        const targets = outgoing.get(branchSrc) || [];
        for (let bi = 1; bi < targets.length; bi++) {
          const branchPath = [];
          let current = targets[bi];
          const visited = /* @__PURE__ */ new Set();
          while (current && !visited.has(current)) {
            visited.add(current);
            const el = localIdMap.get(current);
            if (el) {
              branchPath.push(el);
              branchElements.add(current);
            }
            const nextTargets = outgoing.get(current) || [];
            current = nextTargets.length === 1 ? nextTargets[0] : void 0;
          }
          if (branchPath.length > 0) {
            branches.push({
              id: `${pouName}-rung-${rungIdx}-branch-${bi}`,
              startNodeId: branchSrc,
              endNodeId: branchPath[branchPath.length - 1].id,
              elements: branchPath
            });
          }
        }
      }
    }
    const mainElements = allElements.filter((el) => {
      const lid = [...localIdMap.entries()].find(([_, v]) => v === el)?.[0];
      return !lid || !branchElements.has(lid);
    });
    mainElements.sort((a, b) => a.position.x - b.position.x);
    rungs.push({ id: `${pouName}-rung-${rungIdx}`, number: rungIdx, comment, elements: mainElements, branches });
  }
  return { rungs };
}
function parseLDContact(contactEl, idx, resolver = new VariableTypeResolver()) {
  if (!contactEl || typeof contactEl !== "object") return null;
  const localId = attr(contactEl, "localId");
  const negated = attr(contactEl, "negated") === "true";
  const edgeModifier = attr(contactEl, "edge");
  const varEl = child(contactEl, "variable");
  const tagName = varEl ? text(varEl) : attr(contactEl, "variable");
  if (!tagName) return null;
  let type = negated ? "NC" : "NO";
  if (edgeModifier === "rising") type = "P_CONTACT";
  if (edgeModifier === "falling") type = "N_CONTACT";
  const posEl = child(contactEl, "position");
  return {
    kind: "contact",
    id: `ld-contact-${localId || idx}`,
    type,
    tag: { name: tagName, dataType: resolver.resolve(tagName) },
    position: { x: Number(attr(posEl, "x")) || idx * 60, y: Number(attr(posEl, "y")) || 0 }
  };
}
function parseLDCoil(coilEl, idx, resolver = new VariableTypeResolver()) {
  if (!coilEl || typeof coilEl !== "object") return null;
  const localId = attr(coilEl, "localId");
  const negated = attr(coilEl, "negated") === "true";
  const storage = attr(coilEl, "storage");
  const edgeModifier = attr(coilEl, "edge");
  const varEl = child(coilEl, "variable");
  const tagName = varEl ? text(varEl) : attr(coilEl, "variable");
  if (!tagName) return null;
  let type = "normal";
  if (negated) type = "negated";
  if (storage === "set") type = "set";
  if (storage === "reset") type = "reset";
  if (storage === "retentive") type = "latch";
  if (edgeModifier === "rising") type = "positive_transition";
  if (edgeModifier === "falling") type = "negative_transition";
  const posEl = child(coilEl, "position");
  return {
    kind: "coil",
    id: `ld-coil-${localId || idx}`,
    type,
    tag: { name: tagName, dataType: resolver.resolve(tagName) },
    position: { x: Number(attr(posEl, "x")) || (idx + 1) * 60, y: Number(attr(posEl, "y")) || 0 }
  };
}
function parseLDBlock(blockEl, idx, unmapped, resolver = new VariableTypeResolver()) {
  if (!blockEl || typeof blockEl !== "object") return null;
  const localId = attr(blockEl, "localId");
  const typeName = attr(blockEl, "typeName") || "";
  const instanceName = attr(blockEl, "instanceName") || typeName;
  const fbTypeMap = {
    TON: "TON",
    TOF: "TOF",
    TP: "TP",
    CTU: "CTU",
    CTD: "CTD",
    CTUD: "CTUD",
    SR: "SR",
    RS: "RS",
    R_TRIG: "RTRIG",
    F_TRIG: "FTRIG",
    ADD: "ADD",
    SUB: "SUB",
    MUL: "MUL",
    DIV: "DIV",
    MOD: "MOD",
    GT: "GT",
    GE: "GE",
    LT: "LT",
    LE: "LE",
    EQ: "EQ",
    NE: "NE",
    SEL: "SEL",
    MUX: "MUX",
    LIMIT: "LIMIT",
    MOVE: "MOVE",
    AND: "AND",
    OR: "OR",
    XOR: "XOR",
    NOT: "NOT",
    ABS: "ABS",
    SQRT: "SQRT",
    LN: "LN",
    LOG: "LOG",
    EXP: "EXP",
    SIN: "SIN",
    COS: "COS",
    TAN: "TAN",
    ASIN: "ASIN",
    ACOS: "ACOS",
    ATAN: "ATAN",
    MAX: "MAX",
    MIN: "MIN"
  };
  const fbType = fbTypeMap[typeName.toUpperCase()] || typeName;
  const rawPins = {};
  for (const varEl of childArray(blockEl, "inputVariable").concat(childArray(blockEl, "outputVariable"))) {
    const pinName = attr(varEl, "formalParameter");
    const connEl = child(varEl, "connectionPointIn") ?? child(varEl, "connectionPointOut");
    const connChild = child(connEl, "connection");
    const connName = attr(connChild, "refLocalId") || text(connChild) || attr(varEl, "formalParameter") || "";
    if (pinName) rawPins[pinName] = connName;
  }
  const typedPins = buildTypedTagRefPins(fbType, rawPins);
  const pins = {};
  for (const [pinName, pinDef] of Object.entries(typedPins)) {
    const varName = pinDef.name;
    const resolvedType = varName ? resolver.resolve(varName) : null;
    pins[pinName] = {
      name: varName,
      // Use resolved variable type when it's more specific than BOOL canonical default
      dataType: resolvedType && resolvedType !== "BOOL" ? resolvedType : pinDef.dataType
    };
  }
  const posEl = child(blockEl, "position");
  const px = Number(attr(posEl, "x")) || idx * 60;
  const py = Number(attr(posEl, "y")) || 0;
  return {
    kind: "block",
    id: `ld-block-${localId || idx}`,
    fbType,
    instanceName,
    pins,
    position: { x: px, y: py }
  };
}
function parseFBDBody(fbdEl, pouName, unmapped, resolver = new VariableTypeResolver()) {
  const nodes = [];
  const wires = [];
  if (!fbdEl) return { nodes, wires };
  for (const labelEl of childArray(fbdEl, "label")) {
    const localId = attr(labelEl, "localId");
    const posEl = child(labelEl, "position");
    const labelName = attr(labelEl, "label") || "";
    nodes.push({
      id: `fbd-${localId}`,
      type: "LABEL",
      instanceName: labelName,
      position: { x: Number(attr(posEl, "x")) || 0, y: Number(attr(posEl, "y")) || 0 },
      inputs: [{ id: `label-${localId}-in`, name: "IN", dataType: "BOOL" }],
      outputs: []
    });
    const cpIn = child(labelEl, "connectionPointIn");
    if (cpIn) {
      for (const conn of childArray(cpIn, "connection")) {
        const refId = attr(conn, "refLocalId");
        const fromPin = attr(conn, "formalParameter") || "OUT";
        if (refId) {
          wires.push({ id: `wire-${refId}-to-label-${localId}`, from: { nodeId: `fbd-${refId}`, pin: fromPin }, to: { nodeId: `fbd-${localId}`, pin: "IN" } });
        }
      }
    }
  }
  for (const jumpEl of childArray(fbdEl, "jump")) {
    const localId = attr(jumpEl, "localId");
    const posEl = child(jumpEl, "position");
    const labelName = attr(jumpEl, "label") || "";
    nodes.push({
      id: `fbd-${localId}`,
      type: "JUMP",
      instanceName: labelName,
      position: { x: Number(attr(posEl, "x")) || 0, y: Number(attr(posEl, "y")) || 0 },
      inputs: [{ id: `jump-${localId}-in`, name: "IN", dataType: "BOOL" }],
      outputs: []
    });
    const cpIn = child(jumpEl, "connectionPointIn");
    if (cpIn) {
      for (const conn of childArray(cpIn, "connection")) {
        const refId = attr(conn, "refLocalId");
        const fromPin = attr(conn, "formalParameter") || "OUT";
        if (refId) {
          wires.push({ id: `wire-${refId}-to-jump-${localId}`, from: { nodeId: `fbd-${refId}`, pin: fromPin }, to: { nodeId: `fbd-${localId}`, pin: "IN" } });
        }
      }
    }
  }
  for (const retEl of childArray(fbdEl, "return")) {
    const localId = attr(retEl, "localId");
    const posEl = child(retEl, "position");
    nodes.push({
      id: `fbd-${localId}`,
      type: "RETURN",
      instanceName: "RETURN",
      position: { x: Number(attr(posEl, "x")) || 0, y: Number(attr(posEl, "y")) || 0 },
      inputs: [{ id: `return-${localId}-in`, name: "IN", dataType: "BOOL" }],
      outputs: []
    });
    const cpIn = child(retEl, "connectionPointIn");
    if (cpIn) {
      for (const conn of childArray(cpIn, "connection")) {
        const refId = attr(conn, "refLocalId");
        const fromPin = attr(conn, "formalParameter") || "OUT";
        if (refId) {
          wires.push({ id: `wire-${refId}-to-return-${localId}`, from: { nodeId: `fbd-${refId}`, pin: fromPin }, to: { nodeId: `fbd-${localId}`, pin: "IN" } });
        }
      }
    }
  }
  for (const connEl of childArray(fbdEl, "connector")) {
    const localId = attr(connEl, "localId");
    const posEl = child(connEl, "position");
    const connName = attr(connEl, "name") || "";
    nodes.push({
      id: `fbd-${localId}`,
      type: "CONNECTOR",
      instanceName: connName,
      position: { x: Number(attr(posEl, "x")) || 0, y: Number(attr(posEl, "y")) || 0 },
      inputs: [{ id: `connector-${localId}-in`, name: "IN", dataType: "BOOL" }],
      outputs: []
    });
    const cpIn = child(connEl, "connectionPointIn");
    if (cpIn) {
      for (const conn of childArray(cpIn, "connection")) {
        const refId = attr(conn, "refLocalId");
        const fromPin = attr(conn, "formalParameter") || "OUT";
        if (refId) {
          wires.push({ id: `wire-${refId}-to-connector-${localId}`, from: { nodeId: `fbd-${refId}`, pin: fromPin }, to: { nodeId: `fbd-${localId}`, pin: "IN" } });
        }
      }
    }
  }
  for (const contEl of childArray(fbdEl, "continuation")) {
    const localId = attr(contEl, "localId");
    const posEl = child(contEl, "position");
    const contName = attr(contEl, "name") || "";
    nodes.push({
      id: `fbd-${localId}`,
      type: "CONTINUATION",
      instanceName: contName,
      position: { x: Number(attr(posEl, "x")) || 0, y: Number(attr(posEl, "y")) || 0 },
      inputs: [],
      outputs: [{ id: `continuation-${localId}-out`, name: "OUT", dataType: "BOOL" }]
    });
  }
  const wireMap = /* @__PURE__ */ new Map();
  for (const blockEl of childArray(fbdEl, "block")) {
    const localId = attr(blockEl, "localId");
    const typeName = attr(blockEl, "typeName") || "";
    const instanceName = attr(blockEl, "instanceName") || `${typeName}_${localId}`;
    const posEl = child(blockEl, "position");
    const x = Number(attr(posEl, "x")) || 0;
    const y = Number(attr(posEl, "y")) || 0;
    const { inputs: sigInputs, outputs: sigOutputs } = buildTypedPins(typeName, [], `fbd-${localId}`);
    const inputsByName = new Map(sigInputs.map((p) => [p.name, { ...p }]));
    const outputsByName = new Map(sigOutputs.map((p) => [p.name, { ...p }]));
    const directVars = childArray(blockEl, "variable");
    const inputVarEls = childArray(blockEl, "inputVariables").flatMap((iv) => childArray(iv, "variable")).concat(directVars.filter((v) => child(v, "connectionPointIn") !== null && child(v, "connectionPointIn") !== void 0));
    for (const inVar of inputVarEls) {
      const pinName = attr(inVar, "formalParameter") || "";
      const negated = attr(inVar, "negated") === "true";
      const connId = attr(child(inVar, "connectionPointIn"), "refLocalId") || attr(inVar, "localId");
      const canonicalType = getPinDataType(typeName, pinName, "input");
      if (inputsByName.has(pinName)) {
        inputsByName.get(pinName).negated = negated;
      } else {
        inputsByName.set(pinName, { id: `${localId}-in-${pinName}`, name: pinName, dataType: canonicalType, negated });
      }
      if (connId) wireMap.set(connId, { nodeId: `fbd-${localId}`, pin: pinName });
    }
    for (const outVar of childArray(blockEl, "outputVariables").flatMap((ov) => childArray(ov, "variable"))) {
      const pinName = attr(outVar, "formalParameter") || "";
      const negated = attr(outVar, "negated") === "true";
      const canonicalType = getPinDataType(typeName, pinName, "output");
      if (outputsByName.has(pinName)) {
        outputsByName.get(pinName).negated = negated;
      } else {
        outputsByName.set(pinName, { id: `${localId}-out-${pinName}`, name: pinName, dataType: canonicalType, negated });
      }
    }
    const execOrder = attr(blockEl, "executionOrderId");
    nodes.push({
      id: `fbd-${localId}`,
      type: typeName.toUpperCase(),
      instanceName,
      position: { x, y },
      inputs: [...inputsByName.values()],
      outputs: [...outputsByName.values()],
      executionOrderId: execOrder ? Number(execOrder) : void 0
    });
  }
  for (const varEl of childArray(fbdEl, "inOutVariable")) {
    const localId = attr(varEl, "localId");
    const posEl = child(varEl, "position");
    const x = Number(attr(posEl, "x")) || 0;
    const y = Number(attr(posEl, "y")) || 0;
    const varName = text(child(varEl, "expression") ?? varEl) || "";
    const varType = resolver.resolve(varName);
    nodes.push({
      id: `fbd-var-${localId}`,
      type: "IN_OUT_VARIABLE",
      tag: { name: varName, dataType: varType },
      position: { x, y },
      inputs: [{ id: `var-${localId}-in`, name: "IN", dataType: varType }],
      outputs: [{ id: `var-${localId}-out`, name: "OUT", dataType: varType }]
    });
    const cpIn = child(varEl, "connectionPointIn");
    if (cpIn) {
      for (const conn of childArray(cpIn, "connection")) {
        const refId = attr(conn, "refLocalId");
        const fromPin = attr(conn, "formalParameter") || "OUT";
        if (refId) {
          wires.push({
            id: `wire-${refId}-to-var-${localId}`,
            from: { nodeId: `fbd-${refId}`, pin: fromPin },
            to: { nodeId: `fbd-var-${localId}`, pin: "IN" }
          });
        }
      }
    }
  }
  const outVarEls = new Set(childArray(fbdEl, "outVariable"));
  for (const varEl of childArray(fbdEl, "inVariable").concat(childArray(fbdEl, "outVariable"))) {
    const localId = attr(varEl, "localId");
    const isOut = outVarEls.has(varEl);
    const posEl = child(varEl, "position");
    const x = Number(attr(posEl, "x")) || 0;
    const y = Number(attr(posEl, "y")) || 0;
    const varName = text(child(varEl, "expression") ?? varEl) || "";
    const varType = resolver.resolve(varName);
    nodes.push({
      id: `fbd-var-${localId}`,
      type: isOut ? "OUT_VARIABLE" : "IN_VARIABLE",
      tag: { name: varName, dataType: varType },
      position: { x, y },
      inputs: isOut ? [{ id: `var-${localId}-in`, name: "IN", dataType: varType }] : [],
      outputs: isOut ? [] : [{ id: `var-${localId}-out`, name: "OUT", dataType: varType }]
    });
  }
  for (const blockEl of childArray(fbdEl, "block")) {
    const blockLocalId = attr(blockEl, "localId");
    for (const inVar of childArray(blockEl, "inputVariables").flatMap((iv) => childArray(iv, "variable"))) {
      const pinName = attr(inVar, "formalParameter");
      const cpIn = child(inVar, "connectionPointIn");
      if (!cpIn) continue;
      for (const conn of childArray(cpIn, "connection")) {
        const refId = attr(conn, "refLocalId");
        const fromPin = attr(conn, "formalParameter") || "OUT";
        if (refId) {
          wires.push({
            id: `wire-${refId}-to-${blockLocalId}-${pinName}`,
            from: { nodeId: `fbd-${refId}`, pin: fromPin },
            to: { nodeId: `fbd-${blockLocalId}`, pin: pinName }
          });
        }
      }
    }
  }
  for (const varEl of childArray(fbdEl, "outVariable")) {
    const localId = attr(varEl, "localId");
    const cpIn = child(varEl, "connectionPointIn");
    if (!cpIn) continue;
    for (const conn of childArray(cpIn, "connection")) {
      const refId = attr(conn, "refLocalId");
      const fromPin = attr(conn, "formalParameter") || "OUT";
      if (refId) {
        wires.push({
          id: `wire-${refId}-to-var-${localId}`,
          from: { nodeId: `fbd-${refId}`, pin: fromPin },
          to: { nodeId: `fbd-var-${localId}`, pin: "IN" }
        });
      }
    }
  }
  for (const varEl of childArray(fbdEl, "inVariable")) {
    const localId = attr(varEl, "localId");
    const cpIn = child(varEl, "connectionPointIn");
    if (!cpIn) continue;
    for (const conn of childArray(cpIn, "connection")) {
      const refId = attr(conn, "refLocalId");
      const fromPin = attr(conn, "formalParameter") || "OUT";
      if (refId) {
        wires.push({
          id: `wire-${refId}-to-var-${localId}`,
          from: { nodeId: `fbd-${refId}`, pin: fromPin },
          to: { nodeId: `fbd-var-${localId}`, pin: "IN" }
        });
      }
    }
  }
  return { nodes, wires };
}
function parseSFCBody(sfcEl, pouName, unmapped) {
  const steps = [];
  const transitions = [];
  const links = [];
  const jumps = [];
  if (!sfcEl) return { steps, transitions, links, branches: [], jumps };
  const stepActionMap = /* @__PURE__ */ new Map();
  for (const abEl of childArray(sfcEl, "actionBlock")) {
    const cpIn = child(abEl, "connectionPointIn");
    const refStepId = cpIn ? attr(child(cpIn, "connection"), "refLocalId") || "" : "";
    if (!refStepId) continue;
    const qualifiers = ["N", "S", "R", "P", "P1", "P0", "L", "D", "SD", "DS", "SL"];
    for (const actionEl of childArray(abEl, "action")) {
      const qual = attr(actionEl, "qualifier");
      const refEl = child(actionEl, "reference");
      const tagName = attr(refEl, "name") || attr(actionEl, "name");
      if (!tagName) continue;
      if (!stepActionMap.has(refStepId)) stepActionMap.set(refStepId, []);
      stepActionMap.get(refStepId).push({
        id: `action-${tagName}-${qual}`,
        qualifier: qualifiers.includes(qual) ? qual : "N",
        tag: { name: tagName, dataType: "BOOL" },
        duration: attr(actionEl, "duration") || void 0
      });
    }
  }
  let stepIdx = 0;
  for (const stepEl of childArray(sfcEl, "step")) {
    const localId = attr(stepEl, "localId");
    const name = attr(stepEl, "name") || `Step${stepIdx}`;
    const isInitial = attr(stepEl, "initialStep") === "true";
    const posEl = child(stepEl, "position");
    stepIdx++;
    const siblingActions = stepActionMap.get(localId || "") || [];
    const inlineActions = siblingActions.length === 0 ? parseActions(stepEl, unmapped) : [];
    steps.push({
      id: `sfc-step-${localId}`,
      name,
      isInitial,
      actions: siblingActions.length > 0 ? siblingActions : inlineActions,
      position: { x: Number(attr(posEl, "x")) || 0, y: Number(attr(posEl, "y")) || 0 }
    });
  }
  let transIdx = 0;
  for (const transEl of childArray(sfcEl, "transition")) {
    const localId = attr(transEl, "localId");
    const posEl = child(transEl, "position");
    const condEl = child(transEl, "condition");
    const stEl = child(condEl, "ST") ?? child(transEl, "reference") ?? condEl;
    const condition = stEl ? text(child(stEl, "xhtml:p") ?? child(stEl, "xhtml") ?? stEl) : "TRUE";
    const priority = attr(transEl, "priority");
    transIdx++;
    transitions.push({
      id: `sfc-trans-${localId}`,
      condition: condition || "TRUE",
      priority: priority ? Number(priority) : void 0,
      position: { x: Number(attr(posEl, "x")) || 0, y: Number(attr(posEl, "y")) || 0 }
    });
  }
  for (const stepEl of childArray(sfcEl, "step")) {
    const stepId = `sfc-step-${attr(stepEl, "localId")}`;
    for (const conn of childArray(child(stepEl, "connectionPointOut"), "connection")) {
      const toId = attr(conn, "refLocalId");
      if (toId) {
        links.push({
          id: `link-${stepId}-${toId}`,
          from: stepId,
          to: `sfc-trans-${toId}`,
          type: "simple"
        });
      }
    }
  }
  for (const transEl of childArray(sfcEl, "transition")) {
    const transId = `sfc-trans-${attr(transEl, "localId")}`;
    for (const conn of childArray(child(transEl, "connectionPointOut"), "connection")) {
      const toId = attr(conn, "refLocalId");
      if (toId) {
        links.push({
          id: `link-${transId}-${toId}`,
          from: transId,
          to: `sfc-step-${toId}`,
          type: "simple"
        });
      }
    }
  }
  for (const divEl of childArray(sfcEl, "simultaneousDivergence")) {
    const divId = attr(divEl, "localId");
    const cpIn = child(divEl, "connectionPointIn");
    if (cpIn) {
      for (const conn of childArray(cpIn, "connection")) {
        const refId = attr(conn, "refLocalId");
        if (refId) {
          links.push({ id: `link-${refId}-simDiv-${divId}`, from: `sfc-trans-${refId}`, to: `sfc-simDiv-${divId}`, type: "simultaneous-divergence" });
        }
      }
    }
    for (const cpOut of childArray(divEl, "connectionPointOut")) {
      for (const conn of childArray(cpOut, "connection")) {
        const refId = attr(conn, "refLocalId");
        if (refId) {
          links.push({ id: `link-simDiv-${divId}-${refId}`, from: `sfc-simDiv-${divId}`, to: `sfc-step-${refId}`, type: "simultaneous-divergence" });
        }
      }
    }
  }
  for (const convEl of childArray(sfcEl, "simultaneousConvergence")) {
    const convId = attr(convEl, "localId");
    for (const cpIn of childArray(convEl, "connectionPointIn")) {
      for (const conn of childArray(cpIn, "connection")) {
        const refId = attr(conn, "refLocalId");
        if (refId) {
          links.push({ id: `link-${refId}-simConv-${convId}`, from: `sfc-trans-${refId}`, to: `sfc-simConv-${convId}`, type: "simultaneous-convergence" });
        }
      }
    }
    for (const cpOut of childArray(convEl, "connectionPointOut")) {
      for (const conn of childArray(cpOut, "connection")) {
        const refId = attr(conn, "refLocalId");
        if (refId) {
          links.push({ id: `link-simConv-${convId}-${refId}`, from: `sfc-simConv-${convId}`, to: `sfc-step-${refId}`, type: "simultaneous-convergence" });
        }
      }
    }
  }
  for (const divEl of childArray(sfcEl, "selectionDivergence")) {
    const divId = attr(divEl, "localId");
    const cpIn = child(divEl, "connectionPointIn");
    if (cpIn) {
      for (const conn of childArray(cpIn, "connection")) {
        const refId = attr(conn, "refLocalId");
        if (refId) {
          links.push({ id: `link-${refId}-selDiv-${divId}`, from: `sfc-step-${refId}`, to: `sfc-selDiv-${divId}`, type: "selection-divergence" });
        }
      }
    }
    for (const cpOut of childArray(divEl, "connectionPointOut")) {
      for (const conn of childArray(cpOut, "connection")) {
        const refId = attr(conn, "refLocalId");
        if (refId) {
          links.push({ id: `link-selDiv-${divId}-${refId}`, from: `sfc-selDiv-${divId}`, to: `sfc-trans-${refId}`, type: "selection-divergence" });
        }
      }
    }
  }
  for (const convEl of childArray(sfcEl, "selectionConvergence")) {
    const convId = attr(convEl, "localId");
    for (const cpIn of childArray(convEl, "connectionPointIn")) {
      for (const conn of childArray(cpIn, "connection")) {
        const refId = attr(conn, "refLocalId");
        if (refId) {
          links.push({ id: `link-${refId}-selConv-${convId}`, from: `sfc-trans-${refId}`, to: `sfc-selConv-${convId}`, type: "selection-convergence" });
        }
      }
    }
    for (const cpOut of childArray(convEl, "connectionPointOut")) {
      for (const conn of childArray(cpOut, "connection")) {
        const refId = attr(conn, "refLocalId");
        if (refId) {
          links.push({ id: `link-selConv-${convId}-${refId}`, from: `sfc-selConv-${convId}`, to: `sfc-step-${refId}`, type: "selection-convergence" });
        }
      }
    }
  }
  for (const jumpEl of childArray(sfcEl, "jumpStep")) {
    const localId = attr(jumpEl, "localId");
    const targetName = attr(jumpEl, "targetName") || "";
    const posEl = child(jumpEl, "position");
    jumps.push({
      id: `sfc-jump-${localId}`,
      targetStepName: targetName,
      position: { x: Number(attr(posEl, "x")) || 0, y: Number(attr(posEl, "y")) || 0 }
    });
    const cpIn = child(jumpEl, "connectionPointIn");
    if (cpIn) {
      for (const conn of childArray(cpIn, "connection")) {
        const refId = attr(conn, "refLocalId");
        if (refId) {
          links.push({
            id: `link-${refId}-jump-${localId}`,
            from: `sfc-trans-${refId}`,
            to: `sfc-jump-${localId}`,
            type: "simple"
          });
        }
      }
    }
  }
  const branches = [];
  const convBarIds = new Set(links.flatMap((l) => [l.from, l.to]).filter((id) => /^sfc-(simConv|selConv)-/.test(id)));
  for (const link of links) {
    if (!link.type.includes("divergence")) continue;
    const divBarId = link.to;
    if (!divBarId.match(/^sfc-(simDiv|selDiv)-/)) continue;
    const isSimultaneous = divBarId.startsWith("sfc-simDiv-");
    const matchingConvPrefix = isSimultaneous ? "sfc-simConv-" : "sfc-selConv-";
    const upstreamIds = links.filter((l) => l.to === divBarId).map((l) => l.from);
    const branchHeadIds = links.filter((l) => l.from === divBarId).map((l) => l.to);
    const branchStepArrays = branchHeadIds.map((headId) => {
      const chain = [];
      let cur = headId;
      for (let depth = 0; depth < 20; depth++) {
        chain.push(cur);
        const next = links.find((l) => l.from === cur && l.type === "simple");
        if (!next) break;
        cur = next.to;
        if ([...convBarIds].some((cbId) => next.to === cbId)) break;
      }
      return chain.filter((id) => id.startsWith("sfc-step-"));
    });
    const convBarId = [...convBarIds].find((cbId) => cbId.startsWith(matchingConvPrefix)) ?? "";
    const downstreamIds = links.filter((l) => l.from === convBarId).map((l) => l.to);
    if (!branches.find((b) => b.id === `branch-${divBarId}`)) {
      branches.push({
        id: `branch-${divBarId}`,
        type: isSimultaneous ? "AND" : "OR",
        divergingFromTransId: upstreamIds[0] || "",
        branchStepIds: branchStepArrays,
        convergingToTransId: downstreamIds[0] || ""
      });
    }
  }
  return { steps, transitions, links, branches, jumps };
}
function parseActions(stepEl, unmapped) {
  const actions = [];
  const qualifiers = ["N", "S", "R", "P", "P1", "P0", "L", "D", "SD", "DS", "SL"];
  for (const actionEl of childArray(stepEl, "actionBlock").flatMap((ab) => childArray(ab, "action"))) {
    const qual = attr(actionEl, "qualifier");
    const refEl = child(actionEl, "reference");
    const tagName = attr(refEl, "name") || attr(actionEl, "name");
    if (!tagName) continue;
    actions.push({
      id: `action-${tagName}-${qual}`,
      qualifier: qualifiers.includes(qual) ? qual : "N",
      tag: { name: tagName, dataType: "BOOL" },
      duration: attr(actionEl, "duration") || void 0
    });
  }
  return actions;
}
function exportPLCopen(project) {
  const errors = [];
  const warnings = [];
  const pousXml = project.pous.map((pou) => buildPOUXml(pou, warnings));
  const globalVarsXml = project.globalTags.length > 0 ? {
    configuration: {
      "@_name": "Config0",
      globalVars: {
        "@_name": "GVL",
        variable: project.globalTags.map(tagToVarXml)
      }
    }
  } : {};
  const obj = {
    project: {
      "@_xmlns": "http://www.plcopen.org/xml/tc6_0201",
      "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "@_xmlns:xhtml": "http://www.w3.org/1999/xhtml",
      "@_xsi:schemaLocation": "http://www.plcopen.org/xml/tc6_0201 http://www.plcopen.org/xml/tc6_0201/tc6_xml_v201.xsd",
      fileHeader: {
        "@_companyName": "Plaxio",
        "@_productName": "Plaxio",
        "@_productVersion": "1.0",
        "@_creationDateTime": (/* @__PURE__ */ new Date()).toISOString()
      },
      contentHeader: {
        "@_name": project.projectName,
        "@_version": "1.0.0",
        coordinateInfo: {
          fbd: { scaling: { "@_x": "1", "@_y": "1" } },
          ld: { scaling: { "@_x": "1", "@_y": "1" } },
          sfc: { scaling: { "@_x": "1", "@_y": "1" } }
        }
      },
      types: { pous: { pou: pousXml } },
      instances: globalVarsXml
    }
  };
  return { ok: true, xmlContent: buildXML(obj), errors, warnings };
}
function buildPOUXml(pou, warnings) {
  const returnTypeTag = pou.localTags.find((t) => t.name === "__returnType__");
  const interfaceVars = pou.localTags.filter((t) => t.name !== "__returnType__").map(tagToVarXml);
  const bodyContent = buildBodyXml(pou, warnings);
  const iface = {
    localVars: { variable: interfaceVars }
  };
  if (returnTypeTag) {
    iface.returnType = { [returnTypeTag.dataType]: {} };
  }
  return {
    "@_name": pou.name,
    "@_pouType": pou.pouType || (pou.language === "FBD" || pou.language === "SFC" ? "functionBlock" : "program"),
    interface: iface,
    body: bodyContent
  };
}
function buildBodyXml(pou, warnings) {
  if (pou.language === "LD" && pou.ladderProgram) {
    return { LD: buildLDXml(pou.ladderProgram) };
  }
  if (pou.language === "FBD" && pou.fbdProgram) {
    return { FBD: buildFBDXml(pou.fbdProgram) };
  }
  if (pou.language === "SFC" && pou.sfcProgram) {
    return { SFC: buildSFCXml(pou.sfcProgram) };
  }
  if (pou.language === "ST" && pou.stSource) {
    const lines = pou.stSource.split("\n");
    return { ST: { "xhtml:p": lines.length === 1 ? lines[0] : lines } };
  }
  warnings.push(`POU "${pou.name}": no program data \u2014 empty body`);
  return { ST: { "xhtml:p": "(* empty *)" } };
}
function buildLDXml(ladder) {
  return {
    rung: ladder.rungs.map((rung, ri) => ({
      "@_localId": String(ri + 1),
      comment: rung.comment || void 0,
      ...buildRungElementsXml(rung)
    }))
  };
}
function buildRungElementsXml(rung) {
  const contacts = [];
  const coils = [];
  const blocks = [];
  let id = 2;
  const leftRailLocalId = 1;
  function emitElement(el, prevRefId) {
    const localId = id++;
    if (el.kind === "contact") {
      const c = el;
      const obj = {
        "@_localId": String(localId),
        "@_negated": c.type === "NC" ? "true" : "false",
        "@_edge": c.type === "P_CONTACT" ? "rising" : c.type === "N_CONTACT" ? "falling" : void 0,
        variable: c.tag.name,
        position: { "@_x": el.position?.x ?? 0, "@_y": el.position?.y ?? 0 },
        connectionPointIn: { connection: { "@_refLocalId": String(prevRefId) } },
        connectionPointOut: { relPosition: { "@_x": "0", "@_y": "0" } }
      };
      contacts.push(obj);
    } else if (el.kind === "coil") {
      const c = el;
      const storage = c.type === "set" ? "set" : c.type === "reset" ? "reset" : c.type === "latch" ? "retentive" : void 0;
      const edge = c.type === "positive_transition" ? "rising" : c.type === "negative_transition" ? "falling" : void 0;
      const obj = {
        "@_localId": String(localId),
        "@_negated": c.type === "negated" ? "true" : "false",
        "@_storage": storage,
        "@_edge": edge,
        variable: c.tag.name,
        position: { "@_x": el.position?.x ?? 0, "@_y": el.position?.y ?? 0 },
        connectionPointIn: { connection: { "@_refLocalId": String(prevRefId) } }
      };
      coils.push(obj);
    } else if (el.kind === "block") {
      const b = el;
      const fbTypeMap = { TON: "TON", TOF: "TOF", TP: "TP", CTU: "CTU", CTD: "CTD", CTUD: "CTUD", SR: "SR", RS: "RS", RTRIG: "R_TRIG", FTRIG: "F_TRIG" };
      const inputVars = Object.entries(b.pins || {}).filter(([pinName]) => !["OUT", "Q", "Q1", "CV", "ET"].includes(pinName)).map(([pinName, tagRef]) => ({
        variable: {
          "@_formalParameter": pinName,
          "@_negated": "false",
          connectionPointIn: { connection: { "@_refLocalId": String(prevRefId) } }
        }
      }));
      const outputVars = Object.entries(b.pins || {}).filter(([pinName]) => ["OUT", "Q", "Q1", "CV", "ET"].includes(pinName)).map(([pinName, tagRef]) => ({
        variable: {
          "@_formalParameter": pinName,
          "@_negated": "false",
          connectionPointOut: { relPosition: { "@_x": "0", "@_y": "0" } }
        }
      }));
      const obj = {
        "@_localId": String(localId),
        "@_typeName": fbTypeMap[b.fbType] || b.fbType,
        "@_instanceName": b.instanceName,
        position: { "@_x": el.position?.x ?? 0, "@_y": el.position?.y ?? 0 },
        inputVariables: inputVars.length ? { variable: inputVars.map((iv) => iv.variable) } : void 0,
        outputVariables: outputVars.length ? { variable: outputVars.map((ov) => ov.variable) } : void 0,
        inOutVariables: {}
      };
      blocks.push(obj);
    }
    return localId;
  }
  let prevId = leftRailLocalId;
  for (const el of rung.elements) {
    prevId = emitElement(el, prevId);
  }
  if (rung.branches && rung.branches.length > 0) {
    for (const branch of rung.branches) {
      let branchPrev = leftRailLocalId;
      for (const el of branch.elements) {
        branchPrev = emitElement(el, branchPrev);
      }
    }
  }
  const leftRail = {
    "@_localId": String(leftRailLocalId),
    "@_width": "10",
    position: { "@_x": 0, "@_y": 0 },
    connectionPointOut: { connection: [] }
  };
  const rightRailLocalId = id++;
  const rightRail = {
    "@_localId": String(rightRailLocalId),
    "@_width": "10",
    position: { "@_x": 0, "@_y": 0 },
    connectionPointIn: { connection: { "@_refLocalId": String(prevId) } }
  };
  const result = {};
  result.leftPowerRail = [leftRail];
  if (contacts.length) result.contact = contacts;
  if (coils.length) result.coil = coils;
  if (blocks.length) result.block = blocks;
  result.rightPowerRail = [rightRail];
  return result;
}
function cleanLocalId(id) {
  return id.replace(/^(fbd-var-|fbd-block-|fbd-|st-fbd-var-|st-fbd-)/, "");
}
function buildFBDXml(fbd) {
  const wiresByTarget = /* @__PURE__ */ new Map();
  for (const w of fbd.wires) {
    const key = `${w.to.nodeId}::${w.to.pin}`;
    if (!wiresByTarget.has(key)) wiresByTarget.set(key, []);
    wiresByTarget.get(key).push({ refLocalId: w.from.nodeId, formalParameter: w.from.pin });
  }
  const blocks = fbd.nodes.filter((n) => n.type !== "IN_VARIABLE" && n.type !== "OUT_VARIABLE" && n.type !== "IN_OUT_VARIABLE" && n.type !== "LABEL" && n.type !== "JUMP" && n.type !== "RETURN" && n.type !== "CONNECTOR" && n.type !== "CONTINUATION").map((n) => {
    const inputVariables = (n.inputs || []).map((pin) => {
      const conns = wiresByTarget.get(`${n.id}::${pin.name}`) || [];
      return {
        variable: {
          "@_formalParameter": pin.name,
          "@_negated": pin.negated ? "true" : "false",
          ...conns.length > 0 ? {
            connectionPointIn: {
              connection: conns.map((c) => ({
                "@_refLocalId": c.refLocalId,
                "@_formalParameter": c.formalParameter
              }))
            }
          } : {}
        }
      };
    });
    const outputVariables = (n.outputs || []).map((pin) => ({
      variable: {
        "@_formalParameter": pin.name,
        "@_negated": pin.negated ? "true" : "false",
        connectionPointOut: { relPosition: { "@_x": "0", "@_y": "0" } }
      }
    }));
    return {
      "@_localId": cleanLocalId(n.id),
      "@_typeName": n.type,
      "@_instanceName": n.instanceName || cleanLocalId(n.id),
      "@_executionOrderId": n.executionOrderId != null ? String(n.executionOrderId) : void 0,
      position: { "@_x": n.position.x, "@_y": n.position.y },
      inputVariables: inputVariables.length ? { variable: inputVariables.map((iv) => iv.variable) } : void 0,
      outputVariables: outputVariables.length ? { variable: outputVariables.map((ov) => ov.variable) } : void 0,
      inOutVariables: {}
    };
  });
  const inVars = fbd.nodes.filter((n) => n.type === "IN_VARIABLE").map((n) => ({
    "@_localId": cleanLocalId(n.id),
    "@_negated": n.negated === true ? "true" : "false",
    position: { "@_x": n.position.x, "@_y": n.position.y },
    expression: n.tag?.name || "",
    connectionPointOut: { relPosition: { "@_x": "0", "@_y": "0" } }
  }));
  const outVars = fbd.nodes.filter((n) => n.type === "OUT_VARIABLE").map((n) => {
    const conns = wiresByTarget.get(`${n.id}::IN`) || [];
    return {
      "@_localId": cleanLocalId(n.id),
      "@_negated": n.negated === true ? "true" : "false",
      position: { "@_x": n.position.x, "@_y": n.position.y },
      expression: n.tag?.name || "",
      ...conns.length > 0 ? {
        connectionPointIn: {
          connection: conns.map((c) => ({
            "@_refLocalId": c.refLocalId,
            "@_formalParameter": c.formalParameter
          }))
        }
      } : {}
    };
  });
  const inOutVars = fbd.nodes.filter((n) => n.type === "IN_OUT_VARIABLE").map((n) => {
    const conns = wiresByTarget.get(`${n.id}::IN`) || [];
    return {
      "@_localId": cleanLocalId(n.id),
      "@_negated": "false",
      position: { "@_x": n.position.x, "@_y": n.position.y },
      expression: n.tag?.name || "",
      ...conns.length > 0 ? {
        connectionPointIn: {
          connection: conns.map((c) => ({ "@_refLocalId": c.refLocalId, "@_formalParameter": c.formalParameter }))
        }
      } : {},
      connectionPointOut: { relPosition: { "@_x": "0", "@_y": "0" } }
    };
  });
  const labels = fbd.nodes.filter((n) => n.type === "LABEL").map((n) => {
    const conns = wiresByTarget.get(`${n.id}::IN`) || [];
    return {
      "@_localId": cleanLocalId(n.id),
      "@_label": n.instanceName || "",
      position: { "@_x": n.position.x, "@_y": n.position.y },
      ...conns.length > 0 ? { connectionPointIn: { connection: conns.map((c) => ({ "@_refLocalId": c.refLocalId, "@_formalParameter": c.formalParameter })) } } : {}
    };
  });
  const jumps = fbd.nodes.filter((n) => n.type === "JUMP").map((n) => {
    const conns = wiresByTarget.get(`${n.id}::IN`) || [];
    return {
      "@_localId": cleanLocalId(n.id),
      "@_label": n.instanceName || "",
      position: { "@_x": n.position.x, "@_y": n.position.y },
      ...conns.length > 0 ? { connectionPointIn: { connection: conns.map((c) => ({ "@_refLocalId": c.refLocalId, "@_formalParameter": c.formalParameter })) } } : {}
    };
  });
  const returns = fbd.nodes.filter((n) => n.type === "RETURN").map((n) => {
    const conns = wiresByTarget.get(`${n.id}::IN`) || [];
    return {
      "@_localId": cleanLocalId(n.id),
      position: { "@_x": n.position.x, "@_y": n.position.y },
      ...conns.length > 0 ? { connectionPointIn: { connection: conns.map((c) => ({ "@_refLocalId": c.refLocalId, "@_formalParameter": c.formalParameter })) } } : {}
    };
  });
  const connectors = fbd.nodes.filter((n) => n.type === "CONNECTOR").map((n) => {
    const conns = wiresByTarget.get(`${n.id}::IN`) || [];
    return {
      "@_localId": cleanLocalId(n.id),
      "@_name": n.instanceName || "",
      position: { "@_x": n.position.x, "@_y": n.position.y },
      ...conns.length > 0 ? { connectionPointIn: { connection: conns.map((c) => ({ "@_refLocalId": c.refLocalId, "@_formalParameter": c.formalParameter })) } } : {}
    };
  });
  const continuations = fbd.nodes.filter((n) => n.type === "CONTINUATION").map((n) => ({
    "@_localId": cleanLocalId(n.id),
    "@_name": n.instanceName || "",
    position: { "@_x": n.position.x, "@_y": n.position.y },
    connectionPointOut: { relPosition: { "@_x": "0", "@_y": "0" } }
  }));
  const result = {};
  if (blocks.length) result.block = blocks;
  if (inVars.length) result.inVariable = inVars;
  if (outVars.length) result.outVariable = outVars;
  if (inOutVars.length) result.inOutVariable = inOutVars;
  if (labels.length) result.label = labels;
  if (jumps.length) result.jump = jumps;
  if (returns.length) result["return"] = returns;
  if (connectors.length) result.connector = connectors;
  if (continuations.length) result.continuation = continuations;
  return result;
}
function buildSFCXml(sfc) {
  const outLinks = /* @__PURE__ */ new Map();
  const inLinks = /* @__PURE__ */ new Map();
  for (const link of sfc.links) {
    if (!outLinks.has(link.from)) outLinks.set(link.from, []);
    outLinks.get(link.from).push(link.to);
    if (!inLinks.has(link.to)) inLinks.set(link.to, []);
    inLinks.get(link.to).push(link.from);
  }
  const localIdMap = /* @__PURE__ */ new Map();
  let localIdCounter = 1;
  const allIds = [
    ...sfc.steps.map((s) => s.id),
    ...sfc.transitions.map((t) => t.id),
    // divergence/convergence nodes from links
    ...sfc.links.map((l) => [l.from, l.to]).flat().filter((id) => /^sfc-(simDiv|simConv|selDiv|selConv)-/.test(id))
  ];
  for (const id of allIds) {
    if (!localIdMap.has(id)) localIdMap.set(id, localIdCounter++);
  }
  const lid = (id) => String(localIdMap.get(id) ?? id);
  const steps = sfc.steps.map((s) => {
    const targets = outLinks.get(s.id) || [];
    const sources = inLinks.get(s.id) || [];
    const result2 = {
      "@_localId": lid(s.id),
      "@_name": s.name,
      "@_initialStep": String(s.isInitial),
      position: { "@_x": s.position.x, "@_y": s.position.y }
    };
    if (sources.length > 0) {
      result2.connectionPointIn = {
        connection: sources.map((src) => ({ "@_refLocalId": lid(src) }))
      };
    }
    if (targets.length > 0) {
      result2.connectionPointOut = {
        connection: targets.map((tgt) => ({ "@_refLocalId": lid(tgt) }))
      };
    }
    if (s.actions.length > 0) {
      result2.connectionPointOutAction = { "@_formalParameter": "x" };
    }
    return result2;
  });
  const transitions = sfc.transitions.map((t) => {
    const targets = outLinks.get(t.id) || [];
    const sources = inLinks.get(t.id) || [];
    const result2 = {
      "@_localId": lid(t.id),
      "@_priority": t.priority != null ? String(t.priority) : void 0,
      position: { "@_x": t.position.x, "@_y": t.position.y },
      condition: { ST: { "xhtml:p": t.condition } }
    };
    if (sources.length > 0) {
      result2.connectionPointIn = {
        connection: sources.map((src) => ({ "@_refLocalId": lid(src) }))
      };
    }
    if (targets.length > 0) {
      result2.connectionPointOut = {
        connection: targets.map((tgt) => ({ "@_refLocalId": lid(tgt) }))
      };
    }
    return result2;
  });
  const simultaneousDivergences = [];
  const simultaneousConvergences = [];
  const selectionDivergences = [];
  const selectionConvergences = [];
  const divIds = /* @__PURE__ */ new Set();
  for (const link of sfc.links) {
    if (link.type === "simultaneous-divergence" || link.type === "simultaneous-convergence" || link.type === "selection-divergence" || link.type === "selection-convergence") {
      const divMatch = link.from.match(/^sfc-(simDiv|simConv|selDiv|selConv)-(.+)$/);
      const convMatch = link.to.match(/^sfc-(simDiv|simConv|selDiv|selConv)-(.+)$/);
      const nodeId = divMatch ? link.from : convMatch ? link.to : null;
      if (nodeId && !divIds.has(nodeId)) {
        divIds.add(nodeId);
        const sources = inLinks.get(nodeId) || [];
        const targets = outLinks.get(nodeId) || [];
        const isConvergence = nodeId.includes("Conv");
        const el = {
          "@_localId": lid(nodeId),
          // Convergence: one connectionPointIn per source; divergence: single connectionPointIn with all sources
          ...sources.length > 0 ? isConvergence ? { connectionPointIn: sources.map((s) => ({ connection: { "@_refLocalId": lid(s) } })) } : { connectionPointIn: { connection: sources.map((s) => ({ "@_refLocalId": lid(s) })) } } : {},
          ...targets.length > 0 ? { connectionPointOut: targets.map((t, i) => ({ "@_formalParameter": String(i), connection: { "@_refLocalId": lid(t) } })) } : {}
        };
        if (link.type === "simultaneous-divergence") simultaneousDivergences.push(el);
        else if (link.type === "simultaneous-convergence") simultaneousConvergences.push(el);
        else if (link.type === "selection-divergence") selectionDivergences.push(el);
        else if (link.type === "selection-convergence") selectionConvergences.push(el);
      }
    }
  }
  const jumpSteps = [];
  for (const jump of sfc.jumps ?? []) {
    jumpSteps.push({
      "@_localId": String(localIdCounter++),
      "@_targetName": jump.targetStepName,
      position: { "@_x": jump.position?.x || 0, "@_y": jump.position?.y || 0 },
      connectionPointIn: {}
    });
  }
  const result = {
    step: steps.length ? steps : void 0,
    transition: transitions.length ? transitions : void 0
  };
  if (simultaneousDivergences.length) result.simultaneousDivergence = simultaneousDivergences;
  if (simultaneousConvergences.length) result.simultaneousConvergence = simultaneousConvergences;
  if (selectionDivergences.length) result.selectionDivergence = selectionDivergences;
  if (selectionConvergences.length) result.selectionConvergence = selectionConvergences;
  if (jumpSteps.length) result.jumpStep = jumpSteps;
  const actionBlocks = [];
  for (const s of sfc.steps) {
    if (s.actions.length > 0) {
      actionBlocks.push({
        "@_localId": String(localIdCounter++),
        connectionPointIn: { connection: { "@_refLocalId": lid(s.id) } },
        action: s.actions.map((a) => ({
          "@_qualifier": a.qualifier,
          "@_duration": a.duration || void 0,
          reference: { "@_name": a.tag.name }
        }))
      });
    }
  }
  if (actionBlocks.length) result.actionBlock = actionBlocks;
  return result;
}
function tagToVarXml(tag) {
  return {
    "@_name": tag.name,
    "@_address": tag.address || void 0,
    type: { [tag.dataType]: {} },
    initialValue: tag.initialValue ? { simpleValue: { "@_value": tag.initialValue } } : void 0,
    documentation: tag.description || void 0
  };
}
export {
  exportPLCopen,
  importPLCopen
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjL3BsYy1lZGl0b3ItdHN4L3ZlbmRvci9hZGFwdGVycy9wbGNvcGVuQWRhcHRlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLypcbiAqIFBMQ29wZW4gWE1MIEFkYXB0ZXIgKFRDNiBzY2hlbWEsIG5hbWVzcGFjZSBodHRwOi8vd3d3LnBsY29wZW4ub3JnL3htbC90YzZfMDIwMSlcbiAqIEhhbmRsZXMgTWl0c3ViaXNoaSBpUS1Xb3JrcywgQ09ERVNZUywgQmVja2hvZmYgVHdpbkNBVCwgYW5kIGFueSBUQzYtY29tcGxpYW50IHRvb2wuXG4gKlxuICogSW1wb3J0OiBQTENvcGVuIFhNTCBcdTIxOTIgTm9ybWFsaXplZFByb2plY3RcbiAqIEV4cG9ydDogTm9ybWFsaXplZFByb2plY3QgXHUyMTkyIFBMQ29wZW4gWE1MXG4gKi9cblxuaW1wb3J0IHsgcGFyc2VYTUwsIGJ1aWxkWE1MLCBhdHRyLCB0ZXh0LCBjaGlsZCwgY2hpbGRBcnJheSB9IGZyb20gJy4uL3htbFV0aWxzLmpzJztcbmltcG9ydCB7IHBsY29wZW5UeXBlVG9JRUMgfSBmcm9tICcuLi9kYXRhVHlwZU1hcC5qcyc7XG5pbXBvcnQgeyBidWlsZFJlc29sdmVyLCBWYXJpYWJsZVR5cGVSZXNvbHZlciB9IGZyb20gJy4uL3ZhcmlhYmxlVHlwZVJlc29sdmVyLmpzJztcbmltcG9ydCB7IGdldFBpbkRhdGFUeXBlLCBidWlsZFR5cGVkUGlucywgYnVpbGRUeXBlZFRhZ1JlZlBpbnMgfSBmcm9tICcuLi9waW5TaWduYXR1cmVzLmpzJztcblxuZnVuY3Rpb24gdW5lc2NhcGVYTUwoczogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHMucmVwbGFjZSgvJmFtcDsvZywgJyYnKS5yZXBsYWNlKC8mbHQ7L2csICc8JykucmVwbGFjZSgvJmd0Oy9nLCAnPicpLnJlcGxhY2UoLyZxdW90Oy9nLCAnXCInKS5yZXBsYWNlKC8mYXBvczsvZywgXCInXCIpO1xufVxuaW1wb3J0IHR5cGUge1xuICBJbXBvcnRSZXN1bHQsIEV4cG9ydFJlc3VsdCwgTm9ybWFsaXplZFByb2plY3QsIE5vcm1hbGl6ZWRQT1UsIE5vcm1hbGl6ZWRUYWcsXG4gIFZlbmRvck1ldGFkYXRhU2lkZWNhciwgVW5tYXBwZWRFbGVtZW50LFxufSBmcm9tICcuLi90eXBlcy5qcyc7XG5pbXBvcnQgdHlwZSB7XG4gIExhZGRlclByb2dyYW0sIEZCRFByb2dyYW0sIFNGQ1Byb2dyYW0sIFJ1bmcsIExhZGRlckVsZW1lbnQsXG4gIENvbnRhY3RFbGVtZW50LCBDb2lsRWxlbWVudCwgQmxvY2tFbGVtZW50LCBDb250YWN0VHlwZSwgQ29pbFR5cGUsXG4gIEZCRE5vZGUsIEZCRFdpcmUsIEZCREJsb2NrVHlwZSwgUGluLFxuICBTRkNTdGVwLCBTRkNUcmFuc2l0aW9uLCBTRkNMaW5rLCBTRkNBY3Rpb24sIEFjdGlvblF1YWxpZmllciwgU0ZDSnVtcCwgU0ZDQnJhbmNoLFxuICBUYWdSZWYsIElFQ0RhdGFUeXBlLFxufSBmcm9tICcuLi8uLi9sb2dpY1N0b3JlLmpzJztcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEltcG9ydCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGZ1bmN0aW9uIGltcG9ydFBMQ29wZW4oeG1sQ29udGVudDogc3RyaW5nLCBmaWxlUGF0aDogc3RyaW5nKTogSW1wb3J0UmVzdWx0IHtcbiAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdID0gW107XG5cbiAgbGV0IHJvb3Q6IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICB0cnkge1xuICAgIHJvb3QgPSBwYXJzZVhNTCh4bWxDb250ZW50KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3JzOiBbYFhNTCBwYXJzZSBlcnJvcjogJHtlfWBdLCB3YXJuaW5nczogW10gfTtcbiAgfVxuXG4gIGNvbnN0IHByb2plY3QgPSBjaGlsZChyb290LCAncHJvamVjdCcpIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgdW5kZWZpbmVkO1xuICBpZiAoIXByb2plY3QpIHtcbiAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9yczogWydObyA8cHJvamVjdD4gcm9vdCBlbGVtZW50IGZvdW5kJ10sIHdhcm5pbmdzOiBbXSB9O1xuICB9XG5cbiAgY29uc3QgZmlsZUluZm8gPSBjaGlsZChwcm9qZWN0LCAnZmlsZUhlYWRlcicpIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgdW5kZWZpbmVkO1xuICBjb25zdCBwcm9qZWN0TmFtZSA9IGF0dHIoZmlsZUluZm8sICdwcm9qZWN0TmFtZScpIHx8IGF0dHIocHJvamVjdCwgJ3Byb2plY3ROYW1lJykgfHwgJ0ltcG9ydGVkIFByb2plY3QnO1xuICBjb25zdCB2ZXJzaW9uID0gYXR0cihmaWxlSW5mbywgJ3Byb2R1Y3RWZXJzaW9uJykgfHwgJzEuMCc7XG5cbiAgLy8gR2xvYmFsIHZhcmlhYmxlIGxpc3RzXG4gIGNvbnN0IGdsb2JhbFRhZ3M6IE5vcm1hbGl6ZWRUYWdbXSA9IFtdO1xuICBjb25zdCB0eXBlc05vZGUgPSBjaGlsZChwcm9qZWN0LCAndHlwZXMnKTtcbiAgaWYgKHR5cGVzTm9kZSkge1xuICAgIC8vIEV4dHJhY3QgZ2xvYmFsIHZhcnMgZGVjbGFyZWQgYXQgdGhlIHR5cGVzIGxldmVsIChvdXRzaWRlIGluZGl2aWR1YWwgUE9VcylcbiAgICBjaGlsZEFycmF5KHR5cGVzTm9kZSwgJ2dsb2JhbFZhcnMnKS5mb3JFYWNoKGd2TGlzdCA9PiB7XG4gICAgICBjaGlsZEFycmF5KGd2TGlzdCwgJ3ZhcmlhYmxlJykuZm9yRWFjaCh2ID0+IHtcbiAgICAgICAgY29uc3QgdGFnID0gcGFyc2VWYXJpYWJsZSh2LCB1bm1hcHBlZCk7XG4gICAgICAgIGlmICh0YWcpIGdsb2JhbFRhZ3MucHVzaCh0YWcpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBpbnN0YW5jZXNOb2RlID0gY2hpbGQocHJvamVjdCwgJ2luc3RhbmNlcycpO1xuICBpZiAoaW5zdGFuY2VzTm9kZSkge1xuICAgIGNoaWxkQXJyYXkoaW5zdGFuY2VzTm9kZSwgJ2NvbmZpZ3VyYXRpb25zJykuZm9yRWFjaChjb25maWcgPT4ge1xuICAgICAgY2hpbGRBcnJheShjb25maWcsICdnbG9iYWxWYXJzJykuZm9yRWFjaChndkxpc3QgPT4ge1xuICAgICAgICBjaGlsZEFycmF5KGd2TGlzdCwgJ3ZhcmlhYmxlJykuZm9yRWFjaCh2ID0+IHtcbiAgICAgICAgICBjb25zdCB0YWcgPSBwYXJzZVZhcmlhYmxlKHYsIHVubWFwcGVkKTtcbiAgICAgICAgICBpZiAodGFnKSBnbG9iYWxUYWdzLnB1c2godGFnKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFBPVXNcbiAgY29uc3QgcG91czogTm9ybWFsaXplZFBPVVtdID0gW107XG4gIGNvbnN0IHR5cGVzRWwgPSBjaGlsZChwcm9qZWN0LCAndHlwZXMnKSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IHVuZGVmaW5lZDtcbiAgY29uc3QgcG9pc0VsID0gdHlwZXNFbCA/IGNoaWxkKHR5cGVzRWwsICdwb3VzJykgOiB1bmRlZmluZWQ7XG4gIGNvbnN0IHBvdUxpc3QgPSBjaGlsZEFycmF5KHBvaXNFbCA/PyB0eXBlc0VsLCAncG91Jyk7XG5cbiAgZm9yIChjb25zdCBwb3VFbCBvZiBwb3VMaXN0KSB7XG4gICAgY29uc3QgcG91ID0gcGFyc2VQT1UocG91RWwsIHVubWFwcGVkLCB3YXJuaW5ncyk7XG4gICAgaWYgKHBvdSkgcG91cy5wdXNoKHBvdSk7XG4gIH1cblxuICBpZiAocG91cy5sZW5ndGggPT09IDApIHtcbiAgICBlcnJvcnMucHVzaCgnTm8gUE9VcyBmb3VuZCBpbiBmaWxlJyk7XG4gICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcnMsIHdhcm5pbmdzIH07XG4gIH1cblxuICBjb25zdCBzaWRlY2FyOiBWZW5kb3JNZXRhZGF0YVNpZGVjYXIgPSB7XG4gICAgc291cmNlVmVuZG9yOiAncGxjb3Blbl94bWwnLFxuICAgIHNvdXJjZUZpbGVWZXJzaW9uOiB2ZXJzaW9uLFxuICAgIG9yaWdpbmFsRmlsZVBhdGg6IGZpbGVQYXRoLFxuICAgIHVubWFwcGVkRWxlbWVudHM6IHVubWFwcGVkLFxuICAgIG9yZ2FuaXplclRyZWVMYXlvdXQ6IGNoaWxkKHByb2plY3QsICdpbnN0YW5jZXMnKSxcbiAgfTtcblxuICByZXR1cm4ge1xuICAgIG9rOiB0cnVlLFxuICAgIHByb2plY3Q6IHsgcHJvamVjdE5hbWUsIHBvdXMsIGdsb2JhbFRhZ3MsIHNpZGVjYXIgfSxcbiAgICBlcnJvcnMsXG4gICAgd2FybmluZ3MsXG4gIH07XG59XG5cbmZ1bmN0aW9uIHBhcnNlVmFyaWFibGUodjogdW5rbm93biwgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdKTogTm9ybWFsaXplZFRhZyB8IG51bGwge1xuICBpZiAoIXYgfHwgdHlwZW9mIHYgIT09ICdvYmplY3QnKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgbmFtZSA9IGF0dHIodiwgJ25hbWUnKTtcbiAgaWYgKCFuYW1lKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgdHlwZUVsID0gY2hpbGQodiwgJ3R5cGUnKTtcbiAgY29uc3QgZGF0YVR5cGUgPSBpbmZlclR5cGUodHlwZUVsLCB1bm1hcHBlZCwgbmFtZSk7XG4gIGNvbnN0IGluaXRFbCA9IGNoaWxkKHYsICdpbml0aWFsVmFsdWUnKTtcbiAgY29uc3QgZG9jID0gY2hpbGQodiwgJ2RvY3VtZW50YXRpb24nKTtcbiAgcmV0dXJuIHtcbiAgICBuYW1lLFxuICAgIGRhdGFUeXBlLFxuICAgIC8vIFRDNjogPHNpbXBsZVZhbHVlIHZhbHVlPVwiMFwiLz4gXHUyMDE0IHZhbHVlIGlzIGFuIGF0dHJpYnV0ZSwgbm90IHRleHQgY29udGVudFxuICAgIGluaXRpYWxWYWx1ZTogaW5pdEVsXG4gICAgICA/IChhdHRyKGNoaWxkKGluaXRFbCwgJ3NpbXBsZVZhbHVlJyksICd2YWx1ZScpIHx8IHRleHQoY2hpbGQoaW5pdEVsLCAnc2ltcGxlVmFsdWUnKSkgfHwgdGV4dChpbml0RWwpIHx8IHVuZGVmaW5lZClcbiAgICAgIDogdW5kZWZpbmVkLFxuICAgIGRlc2NyaXB0aW9uOiBkb2MgPyB0ZXh0KGRvYykgOiB1bmRlZmluZWQsXG4gICAgYWRkcmVzczogYXR0cih2LCAnYWRkcmVzcycpIHx8IHVuZGVmaW5lZCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gaW5mZXJUeXBlKHR5cGVFbDogdW5rbm93biwgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdLCBoaW50OiBzdHJpbmcpOiBJRUNEYXRhVHlwZSB7XG4gIGlmICghdHlwZUVsIHx8IHR5cGVvZiB0eXBlRWwgIT09ICdvYmplY3QnKSByZXR1cm4gJ0JPT0wnO1xuICBjb25zdCB0ID0gdHlwZUVsIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICAvLyA8Qk9PTC8+LCA8SU5ULz4sIDxSRUFMLz4gZXRjLlxuICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyh0KSkge1xuICAgIGlmIChrZXkuc3RhcnRzV2l0aCgnQF8nKSkgY29udGludWU7XG4gICAgcmV0dXJuIHBsY29wZW5UeXBlVG9JRUMoa2V5KTtcbiAgfVxuICB1bm1hcHBlZC5wdXNoKHsgY2xtTm9kZUlkOiBudWxsLCB2ZW5kb3JTcGVjaWZpY0RhdGE6IHR5cGVFbCwgcmVhc29uOiBgVW5rbm93biB0eXBlIGZvciAke2hpbnR9YCB9KTtcbiAgcmV0dXJuICdESU5UJztcbn1cblxuZnVuY3Rpb24gcGFyc2VQT1UocG91RWw6IHVua25vd24sIHVubWFwcGVkOiBVbm1hcHBlZEVsZW1lbnRbXSwgd2FybmluZ3M6IHN0cmluZ1tdKTogTm9ybWFsaXplZFBPVSB8IG51bGwge1xuICBpZiAoIXBvdUVsIHx8IHR5cGVvZiBwb3VFbCAhPT0gJ29iamVjdCcpIHJldHVybiBudWxsO1xuICBjb25zdCBuYW1lID0gYXR0cihwb3VFbCwgJ25hbWUnKTtcbiAgaWYgKCFuYW1lKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgcG91VHlwZSA9IGF0dHIocG91RWwsICdwb3VUeXBlJyk7IC8vIHByb2dyYW0sIGZ1bmN0aW9uQmxvY2ssIGZ1bmN0aW9uXG5cbiAgY29uc3QgbG9jYWxUYWdzOiBOb3JtYWxpemVkVGFnW10gPSBbXTtcbiAgY29uc3QgaW50ZXJmYWNlRWwgPSBjaGlsZChwb3VFbCwgJ2ludGVyZmFjZScpO1xuICBpZiAoaW50ZXJmYWNlRWwpIHtcbiAgICBmb3IgKGNvbnN0IHNlY3Rpb24gb2YgWydsb2NhbFZhcnMnLCAnaW5wdXRWYXJzJywgJ291dHB1dFZhcnMnLCAnaW5PdXRWYXJzJywgJ2V4dGVybmFsVmFycycsICd0ZW1wVmFycycsICdnbG9iYWxWYXJzJ10pIHtcbiAgICAgIGNoaWxkQXJyYXkoaW50ZXJmYWNlRWwsIHNlY3Rpb24pLmZvckVhY2goc2VjID0+IHtcbiAgICAgICAgY2hpbGRBcnJheShzZWMsICd2YXJpYWJsZScpLmZvckVhY2godiA9PiB7XG4gICAgICAgICAgY29uc3QgdGFnID0gcGFyc2VWYXJpYWJsZSh2LCB1bm1hcHBlZCk7XG4gICAgICAgICAgaWYgKHRhZykgbG9jYWxUYWdzLnB1c2godGFnKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gQWxzbyBhY2NlcHQgPHZhcmlhYmxlPiBkaXJlY3RseSBpbiA8aW50ZXJmYWNlPlxuICAgIGNoaWxkQXJyYXkoaW50ZXJmYWNlRWwsICd2YXJpYWJsZScpLmZvckVhY2godiA9PiB7XG4gICAgICBjb25zdCB0YWcgPSBwYXJzZVZhcmlhYmxlKHYsIHVubWFwcGVkKTtcbiAgICAgIGlmICh0YWcpIGxvY2FsVGFncy5wdXNoKHRhZyk7XG4gICAgfSk7XG4gICAgLy8gcmV0dXJuVHlwZSBcdTIwMTQgc3RvcmUgYXMgYSBzcGVjaWFsIHRhZyBzbyBpdCBjYW4gYmUgcm91bmQtdHJpcHBlZFxuICAgIGNvbnN0IHJldFR5cGVFbCA9IGNoaWxkKGludGVyZmFjZUVsLCAncmV0dXJuVHlwZScpO1xuICAgIGlmIChyZXRUeXBlRWwpIHtcbiAgICAgIGNvbnN0IHJldFR5cGUgPSBpbmZlclR5cGUocmV0VHlwZUVsLCB1bm1hcHBlZCwgYCR7bmFtZX1fcmV0dXJuVHlwZWApO1xuICAgICAgbG9jYWxUYWdzLnB1c2goeyBuYW1lOiAnX19yZXR1cm5UeXBlX18nLCBkYXRhVHlwZTogcmV0VHlwZSB9KTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBub3JtYWxpemVkUG91VHlwZSA9IHBvdVR5cGUgYXMgTm9ybWFsaXplZFBPVVsncG91VHlwZSddO1xuXG4gIGNvbnN0IGJvZHlFbCA9IGNoaWxkKHBvdUVsLCAnYm9keScpO1xuICBpZiAoIWJvZHlFbCkge1xuICAgIHdhcm5pbmdzLnB1c2goYFBPVSBcIiR7bmFtZX1cIiBoYXMgbm8gYm9keSBcdTIwMTQgaW1wb3J0ZWQgYXMgZW1wdHlgKTtcbiAgICByZXR1cm4geyBpZDogYHBvdS0ke25hbWV9YCwgbmFtZSwgcG91VHlwZTogbm9ybWFsaXplZFBvdVR5cGUsIGxhbmd1YWdlOiAnTEQnLCBsYWRkZXJQcm9ncmFtOiB7IHJ1bmdzOiBbXSB9LCBsb2NhbFRhZ3MgfTtcbiAgfVxuXG4gIC8vIEJ1aWxkIGEgcmVzb2x2ZXIgc28gcGFyc2VycyBjYW4gbG9vayB1cCB2YXJpYWJsZSB0eXBlcyBmcm9tIGRlY2xhcmF0aW9uc1xuICBjb25zdCByZXNvbHZlciA9IGJ1aWxkUmVzb2x2ZXIobG9jYWxUYWdzLCBbXSk7XG5cbiAgLy8gRGV0ZXJtaW5lIGxhbmd1YWdlIGZyb20gYm9keVxuICBpZiAoY2hpbGQoYm9keUVsLCAnTEQnKSkge1xuICAgIGNvbnN0IGxkID0gcGFyc2VMREJvZHkoY2hpbGQoYm9keUVsLCAnTEQnKSwgbmFtZSwgdW5tYXBwZWQsIHJlc29sdmVyKTtcbiAgICByZXR1cm4geyBpZDogYHBvdS0ke25hbWV9YCwgbmFtZSwgcG91VHlwZTogbm9ybWFsaXplZFBvdVR5cGUsIGxhbmd1YWdlOiAnTEQnLCBsYWRkZXJQcm9ncmFtOiBsZCwgbG9jYWxUYWdzIH07XG4gIH1cbiAgaWYgKGNoaWxkKGJvZHlFbCwgJ0ZCRCcpKSB7XG4gICAgY29uc3QgZmJkID0gcGFyc2VGQkRCb2R5KGNoaWxkKGJvZHlFbCwgJ0ZCRCcpLCBuYW1lLCB1bm1hcHBlZCwgcmVzb2x2ZXIpO1xuICAgIHJldHVybiB7IGlkOiBgcG91LSR7bmFtZX1gLCBuYW1lLCBwb3VUeXBlOiBub3JtYWxpemVkUG91VHlwZSwgbGFuZ3VhZ2U6ICdGQkQnLCBmYmRQcm9ncmFtOiBmYmQsIGxvY2FsVGFncyB9O1xuICB9XG4gIGlmIChjaGlsZChib2R5RWwsICdTRkMnKSkge1xuICAgIGNvbnN0IHNmYyA9IHBhcnNlU0ZDQm9keShjaGlsZChib2R5RWwsICdTRkMnKSwgbmFtZSwgdW5tYXBwZWQpO1xuICAgIHJldHVybiB7IGlkOiBgcG91LSR7bmFtZX1gLCBuYW1lLCBwb3VUeXBlOiBub3JtYWxpemVkUG91VHlwZSwgbGFuZ3VhZ2U6ICdTRkMnLCBzZmNQcm9ncmFtOiBzZmMsIGxvY2FsVGFncyB9O1xuICB9XG4gIGlmIChjaGlsZChib2R5RWwsICdTVCcpKSB7XG4gICAgY29uc3Qgc3RFbCA9IGNoaWxkKGJvZHlFbCwgJ1NUJykgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gICAgLy8gSGFuZGxlIG11bHRpcGxlIHhodG1sOnAgZWxlbWVudHMgKG9uZSBwZXIgbGluZSkgb3Igc2luZ2xlIGVsZW1lbnRcbiAgICBjb25zdCBwRWxzID0gY2hpbGRBcnJheShzdEVsLCAneGh0bWw6cCcpO1xuICAgIGxldCByYXdTcmM6IHN0cmluZztcbiAgICBpZiAocEVscy5sZW5ndGggPiAwKSB7XG4gICAgICByYXdTcmMgPSBwRWxzLm1hcChwID0+IHRleHQocCkgfHwgJycpLmpvaW4oJ1xcbicpO1xuICAgIH0gZWxzZSB7XG4gICAgICByYXdTcmMgPSB0ZXh0KGNoaWxkKHN0RWwsICd4aHRtbCcpID8/IHN0RWwpIHx8ICcnO1xuICAgIH1cbiAgICBjb25zdCBzcmMgPSByYXdTcmMgPyB1bmVzY2FwZVhNTChyYXdTcmMpIDogcmF3U3JjO1xuICAgIHJldHVybiB7IGlkOiBgcG91LSR7bmFtZX1gLCBuYW1lLCBwb3VUeXBlOiBub3JtYWxpemVkUG91VHlwZSwgbGFuZ3VhZ2U6ICdTVCcsIHN0U291cmNlOiBzcmMsIGxvY2FsVGFncyB9O1xuICB9XG4gIGlmIChjaGlsZChib2R5RWwsICdJTCcpKSB7XG4gICAgdW5tYXBwZWQucHVzaCh7IGNsbU5vZGVJZDogYHBvdS0ke25hbWV9YCwgdmVuZG9yU3BlY2lmaWNEYXRhOiBib2R5RWwsIHJlYXNvbjogJ0lMIGxhbmd1YWdlIG5vdCBzdXBwb3J0ZWQnIH0pO1xuICAgIHJldHVybiB7IGlkOiBgcG91LSR7bmFtZX1gLCBuYW1lLCBwb3VUeXBlOiBub3JtYWxpemVkUG91VHlwZSwgbGFuZ3VhZ2U6ICdTVCcsIHN0U291cmNlOiAnKCogSUwgaW1wb3J0IG5vdCBzdXBwb3J0ZWQgKiknLCBsb2NhbFRhZ3MgfTtcbiAgfVxuXG4gIHVubWFwcGVkLnB1c2goeyBjbG1Ob2RlSWQ6IGBwb3UtJHtuYW1lfWAsIHZlbmRvclNwZWNpZmljRGF0YTogYm9keUVsLCByZWFzb246ICdVbmtub3duIGJvZHkgbGFuZ3VhZ2UnIH0pO1xuICByZXR1cm4geyBpZDogYHBvdS0ke25hbWV9YCwgbmFtZSwgcG91VHlwZTogbm9ybWFsaXplZFBvdVR5cGUsIGxhbmd1YWdlOiAnTEQnLCBsYWRkZXJQcm9ncmFtOiB7IHJ1bmdzOiBbXSB9LCBsb2NhbFRhZ3MgfTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIExEIGJvZHkgcGFyc2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBwYXJzZUxEQm9keShsZEVsOiB1bmtub3duLCBwb3VOYW1lOiBzdHJpbmcsIHVubWFwcGVkOiBVbm1hcHBlZEVsZW1lbnRbXSwgcmVzb2x2ZXI6IFZhcmlhYmxlVHlwZVJlc29sdmVyID0gbmV3IFZhcmlhYmxlVHlwZVJlc29sdmVyKCkpOiBMYWRkZXJQcm9ncmFtIHtcbiAgY29uc3QgcnVuZ3M6IFJ1bmdbXSA9IFtdO1xuICBpZiAoIWxkRWwpIHJldHVybiB7IHJ1bmdzIH07XG5cbiAgLy8gU29tZSBleHBvcnRlcnMgdXNlIGZsYXQgTEQgYm9keSB3aXRob3V0IDxydW5nPiB3cmFwcGVycyBcdTIwMTQgdHJlYXQgdGhlIHdob2xlIExEIGFzIG9uZSBydW5nXG4gIGxldCBydW5nRWxlbWVudHMgPSBjaGlsZEFycmF5KGxkRWwsICdydW5nJyk7XG4gIGlmIChydW5nRWxlbWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgLy8gVHJlYXQgdGhlIGVudGlyZSBMRCBlbGVtZW50IGFzIGEgc2luZ2xlIGltcGxpY2l0IHJ1bmdcbiAgICBydW5nRWxlbWVudHMgPSBbbGRFbCBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPl07XG4gIH1cblxuICBsZXQgcnVuZ0lkeCA9IDA7XG4gIGZvciAoY29uc3QgbmV0d29ya0VsIG9mIHJ1bmdFbGVtZW50cykge1xuICAgIHJ1bmdJZHgrKztcbiAgICBjb25zdCBjb21tZW50ID0gdGV4dChjaGlsZChuZXR3b3JrRWwsICdjb21tZW50JykgPz8gY2hpbGQobmV0d29ya0VsLCAnZG9jdW1lbnRhdGlvbicpKTtcbiAgICBjb25zdCBhbGxFbGVtZW50czogTGFkZGVyRWxlbWVudFtdID0gW107XG4gICAgY29uc3QgbG9jYWxJZE1hcCA9IG5ldyBNYXA8c3RyaW5nLCBMYWRkZXJFbGVtZW50PigpO1xuXG4gICAgZm9yIChjb25zdCBjb250YWN0IG9mIGNoaWxkQXJyYXkobmV0d29ya0VsLCAnY29udGFjdCcpKSB7XG4gICAgICBjb25zdCBlbCA9IHBhcnNlTERDb250YWN0KGNvbnRhY3QsIGFsbEVsZW1lbnRzLmxlbmd0aCwgcmVzb2x2ZXIpO1xuICAgICAgaWYgKGVsKSB7XG4gICAgICAgIGFsbEVsZW1lbnRzLnB1c2goZWwpO1xuICAgICAgICBjb25zdCBsaWQgPSBhdHRyKGNvbnRhY3QsICdsb2NhbElkJyk7XG4gICAgICAgIGlmIChsaWQpIGxvY2FsSWRNYXAuc2V0KGxpZCwgZWwpO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGNvaWwgb2YgY2hpbGRBcnJheShuZXR3b3JrRWwsICdjb2lsJykpIHtcbiAgICAgIGNvbnN0IGVsID0gcGFyc2VMRENvaWwoY29pbCwgYWxsRWxlbWVudHMubGVuZ3RoLCByZXNvbHZlcik7XG4gICAgICBpZiAoZWwpIHtcbiAgICAgICAgYWxsRWxlbWVudHMucHVzaChlbCk7XG4gICAgICAgIGNvbnN0IGxpZCA9IGF0dHIoY29pbCwgJ2xvY2FsSWQnKTtcbiAgICAgICAgaWYgKGxpZCkgbG9jYWxJZE1hcC5zZXQobGlkLCBlbCk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgYmxvY2sgb2YgY2hpbGRBcnJheShuZXR3b3JrRWwsICdibG9jaycpKSB7XG4gICAgICBjb25zdCBlbCA9IHBhcnNlTERCbG9jayhibG9jaywgYWxsRWxlbWVudHMubGVuZ3RoLCB1bm1hcHBlZCwgcmVzb2x2ZXIpO1xuICAgICAgaWYgKGVsKSB7XG4gICAgICAgIGFsbEVsZW1lbnRzLnB1c2goZWwpO1xuICAgICAgICBjb25zdCBsaWQgPSBhdHRyKGJsb2NrLCAnbG9jYWxJZCcpO1xuICAgICAgICBpZiAobGlkKSBsb2NhbElkTWFwLnNldChsaWQsIGVsKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBCdWlsZCB3aXJlIGdyYXBoIGZyb20gY29ubmVjdGlvblBvaW50SW4gcmVmZXJlbmNlc1xuICAgIGNvbnN0IGluY29taW5nRWRnZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nW10+KCk7IC8vIGxvY2FsSWQgXHUyMTkyIFtzb3VyY2UgbG9jYWxJZHNdXG4gICAgZm9yIChjb25zdCBlbFRhZyBvZiBbLi4uY2hpbGRBcnJheShuZXR3b3JrRWwsICdjb250YWN0JyksIC4uLmNoaWxkQXJyYXkobmV0d29ya0VsLCAnY29pbCcpLCAuLi5jaGlsZEFycmF5KG5ldHdvcmtFbCwgJ2Jsb2NrJyldKSB7XG4gICAgICBjb25zdCBsb2NhbElkID0gYXR0cihlbFRhZywgJ2xvY2FsSWQnKTtcbiAgICAgIGlmICghbG9jYWxJZCkgY29udGludWU7XG4gICAgICBjb25zdCBjcEluID0gY2hpbGQoZWxUYWcsICdjb25uZWN0aW9uUG9pbnRJbicpO1xuICAgICAgaWYgKCFjcEluKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGNvbm5zID0gY2hpbGRBcnJheShjcEluLCAnY29ubmVjdGlvbicpO1xuICAgICAgY29uc3Qgc291cmNlcyA9IGNvbm5zLm1hcChjID0+IGF0dHIoYywgJ3JlZkxvY2FsSWQnKSkuZmlsdGVyKEJvb2xlYW4pIGFzIHN0cmluZ1tdO1xuICAgICAgaWYgKHNvdXJjZXMubGVuZ3RoID4gMCkgaW5jb21pbmdFZGdlcy5zZXQobG9jYWxJZCwgc291cmNlcyk7XG4gICAgfVxuXG4gICAgLy8gRGV0ZWN0IGZhbi1vdXQgKG9uZSBzb3VyY2UgXHUyMTkyIG11bHRpcGxlIHRhcmdldHMpOiBpbmRpY2F0ZXMgYnJhbmNoaW5nXG4gICAgY29uc3Qgb3V0Z29pbmcgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nW10+KCk7IC8vIHNvdXJjZUlkIFx1MjE5MiBbdGFyZ2V0SWRzXVxuICAgIGZvciAoY29uc3QgW3RhcmdldCwgc291cmNlc10gb2YgaW5jb21pbmdFZGdlcykge1xuICAgICAgZm9yIChjb25zdCBzcmMgb2Ygc291cmNlcykge1xuICAgICAgICBpZiAoIW91dGdvaW5nLmhhcyhzcmMpKSBvdXRnb2luZy5zZXQoc3JjLCBbXSk7XG4gICAgICAgIG91dGdvaW5nLmdldChzcmMpIS5wdXNoKHRhcmdldCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRmluZCBicmFuY2ggcG9pbnRzIChhbnkgc291cmNlIHdpdGggPiAxIG91dGdvaW5nKVxuICAgIGNvbnN0IGJyYW5jaFBvaW50cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGZvciAoY29uc3QgW3NyYywgdGFyZ2V0c10gb2Ygb3V0Z29pbmcpIHtcbiAgICAgIGlmICh0YXJnZXRzLmxlbmd0aCA+IDEpIGJyYW5jaFBvaW50cy5hZGQoc3JjKTtcbiAgICB9XG5cbiAgICAvLyBCdWlsZCBicmFuY2hlcyBmcm9tIHRoZSB0b3BvbG9neVxuICAgIGNvbnN0IGJyYW5jaGVzOiBpbXBvcnQoJy4uLy4uL2xvZ2ljU3RvcmUuanMnKS5CcmFuY2hbXSA9IFtdO1xuICAgIGNvbnN0IGJyYW5jaEVsZW1lbnRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgICBpZiAoYnJhbmNoUG9pbnRzLnNpemUgPiAwKSB7XG4gICAgICBmb3IgKGNvbnN0IGJyYW5jaFNyYyBvZiBicmFuY2hQb2ludHMpIHtcbiAgICAgICAgY29uc3QgdGFyZ2V0cyA9IG91dGdvaW5nLmdldChicmFuY2hTcmMpIHx8IFtdO1xuICAgICAgICAvLyBGaXJzdCB0YXJnZXQgaXMgdGhlIG1haW4gcGF0aCwgcmVtYWluaW5nIGFyZSBicmFuY2hlc1xuICAgICAgICBmb3IgKGxldCBiaSA9IDE7IGJpIDwgdGFyZ2V0cy5sZW5ndGg7IGJpKyspIHtcbiAgICAgICAgICBjb25zdCBicmFuY2hQYXRoOiBMYWRkZXJFbGVtZW50W10gPSBbXTtcbiAgICAgICAgICBsZXQgY3VycmVudDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdGFyZ2V0c1tiaV07XG4gICAgICAgICAgY29uc3QgdmlzaXRlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICAgIHdoaWxlIChjdXJyZW50ICYmICF2aXNpdGVkLmhhcyhjdXJyZW50KSkge1xuICAgICAgICAgICAgdmlzaXRlZC5hZGQoY3VycmVudCk7XG4gICAgICAgICAgICBjb25zdCBlbCA9IGxvY2FsSWRNYXAuZ2V0KGN1cnJlbnQpO1xuICAgICAgICAgICAgaWYgKGVsKSB7XG4gICAgICAgICAgICAgIGJyYW5jaFBhdGgucHVzaChlbCk7XG4gICAgICAgICAgICAgIGJyYW5jaEVsZW1lbnRzLmFkZChjdXJyZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEZvbGxvdyB0aGUgc2luZ2xlIG91dGdvaW5nIGZyb20gdGhpcyBlbGVtZW50XG4gICAgICAgICAgICBjb25zdCBuZXh0VGFyZ2V0cyA9IG91dGdvaW5nLmdldChjdXJyZW50KSB8fCBbXTtcbiAgICAgICAgICAgIGN1cnJlbnQgPSBuZXh0VGFyZ2V0cy5sZW5ndGggPT09IDEgPyBuZXh0VGFyZ2V0c1swXSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGJyYW5jaFBhdGgubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgYnJhbmNoZXMucHVzaCh7XG4gICAgICAgICAgICAgIGlkOiBgJHtwb3VOYW1lfS1ydW5nLSR7cnVuZ0lkeH0tYnJhbmNoLSR7Yml9YCxcbiAgICAgICAgICAgICAgc3RhcnROb2RlSWQ6IGJyYW5jaFNyYyxcbiAgICAgICAgICAgICAgZW5kTm9kZUlkOiBicmFuY2hQYXRoW2JyYW5jaFBhdGgubGVuZ3RoIC0gMV0uaWQsXG4gICAgICAgICAgICAgIGVsZW1lbnRzOiBicmFuY2hQYXRoLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWFpbiBlbGVtZW50cyA9IGFsbCBlbGVtZW50cyBtaW51cyB0aG9zZSBjb25zdW1lZCBieSBicmFuY2hlc1xuICAgIGNvbnN0IG1haW5FbGVtZW50cyA9IGFsbEVsZW1lbnRzLmZpbHRlcihlbCA9PiB7XG4gICAgICBjb25zdCBsaWQgPSBbLi4ubG9jYWxJZE1hcC5lbnRyaWVzKCldLmZpbmQoKFtfLCB2XSkgPT4gdiA9PT0gZWwpPy5bMF07XG4gICAgICByZXR1cm4gIWxpZCB8fCAhYnJhbmNoRWxlbWVudHMuaGFzKGxpZCk7XG4gICAgfSk7XG5cbiAgICBtYWluRWxlbWVudHMuc29ydCgoYSwgYikgPT4gYS5wb3NpdGlvbi54IC0gYi5wb3NpdGlvbi54KTtcblxuICAgIHJ1bmdzLnB1c2goeyBpZDogYCR7cG91TmFtZX0tcnVuZy0ke3J1bmdJZHh9YCwgbnVtYmVyOiBydW5nSWR4LCBjb21tZW50LCBlbGVtZW50czogbWFpbkVsZW1lbnRzLCBicmFuY2hlcyB9KTtcbiAgfVxuXG4gIHJldHVybiB7IHJ1bmdzIH07XG59XG5cbmZ1bmN0aW9uIHBhcnNlTERDb250YWN0KGNvbnRhY3RFbDogdW5rbm93biwgaWR4OiBudW1iZXIsIHJlc29sdmVyOiBWYXJpYWJsZVR5cGVSZXNvbHZlciA9IG5ldyBWYXJpYWJsZVR5cGVSZXNvbHZlcigpKTogQ29udGFjdEVsZW1lbnQgfCBudWxsIHtcbiAgaWYgKCFjb250YWN0RWwgfHwgdHlwZW9mIGNvbnRhY3RFbCAhPT0gJ29iamVjdCcpIHJldHVybiBudWxsO1xuICBjb25zdCBsb2NhbElkID0gYXR0cihjb250YWN0RWwsICdsb2NhbElkJyk7XG4gIGNvbnN0IG5lZ2F0ZWQgPSBhdHRyKGNvbnRhY3RFbCwgJ25lZ2F0ZWQnKSA9PT0gJ3RydWUnO1xuICBjb25zdCBlZGdlTW9kaWZpZXIgPSBhdHRyKGNvbnRhY3RFbCwgJ2VkZ2UnKTsgLy8gJ3Jpc2luZycgfCAnZmFsbGluZydcbiAgY29uc3QgdmFyRWwgPSBjaGlsZChjb250YWN0RWwsICd2YXJpYWJsZScpO1xuICBjb25zdCB0YWdOYW1lID0gdmFyRWwgPyB0ZXh0KHZhckVsKSA6IGF0dHIoY29udGFjdEVsLCAndmFyaWFibGUnKTtcbiAgaWYgKCF0YWdOYW1lKSByZXR1cm4gbnVsbDtcblxuICBsZXQgdHlwZTogQ29udGFjdFR5cGUgPSBuZWdhdGVkID8gJ05DJyA6ICdOTyc7XG4gIGlmIChlZGdlTW9kaWZpZXIgPT09ICdyaXNpbmcnKSB0eXBlID0gJ1BfQ09OVEFDVCc7XG4gIGlmIChlZGdlTW9kaWZpZXIgPT09ICdmYWxsaW5nJykgdHlwZSA9ICdOX0NPTlRBQ1QnO1xuXG4gIGNvbnN0IHBvc0VsID0gY2hpbGQoY29udGFjdEVsLCAncG9zaXRpb24nKTtcblxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICdjb250YWN0JyxcbiAgICBpZDogYGxkLWNvbnRhY3QtJHtsb2NhbElkIHx8IGlkeH1gLFxuICAgIHR5cGUsXG4gICAgdGFnOiB7IG5hbWU6IHRhZ05hbWUsIGRhdGFUeXBlOiByZXNvbHZlci5yZXNvbHZlKHRhZ05hbWUpIH0sXG4gICAgcG9zaXRpb246IHsgeDogTnVtYmVyKGF0dHIocG9zRWwsICd4JykpIHx8IGlkeCAqIDYwLCB5OiBOdW1iZXIoYXR0cihwb3NFbCwgJ3knKSkgfHwgMCB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBwYXJzZUxEQ29pbChjb2lsRWw6IHVua25vd24sIGlkeDogbnVtYmVyLCByZXNvbHZlcjogVmFyaWFibGVUeXBlUmVzb2x2ZXIgPSBuZXcgVmFyaWFibGVUeXBlUmVzb2x2ZXIoKSk6IENvaWxFbGVtZW50IHwgbnVsbCB7XG4gIGlmICghY29pbEVsIHx8IHR5cGVvZiBjb2lsRWwgIT09ICdvYmplY3QnKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgbG9jYWxJZCA9IGF0dHIoY29pbEVsLCAnbG9jYWxJZCcpO1xuICBjb25zdCBuZWdhdGVkID0gYXR0cihjb2lsRWwsICduZWdhdGVkJykgPT09ICd0cnVlJztcbiAgY29uc3Qgc3RvcmFnZSA9IGF0dHIoY29pbEVsLCAnc3RvcmFnZScpOyAvLyAnc2V0JyB8ICdyZXNldCcgfCAncmV0ZW50aXZlJ1xuICBjb25zdCBlZGdlTW9kaWZpZXIgPSBhdHRyKGNvaWxFbCwgJ2VkZ2UnKTsgLy8gJ3Jpc2luZycgfCAnZmFsbGluZydcbiAgY29uc3QgdmFyRWwgPSBjaGlsZChjb2lsRWwsICd2YXJpYWJsZScpO1xuICBjb25zdCB0YWdOYW1lID0gdmFyRWwgPyB0ZXh0KHZhckVsKSA6IGF0dHIoY29pbEVsLCAndmFyaWFibGUnKTtcbiAgaWYgKCF0YWdOYW1lKSByZXR1cm4gbnVsbDtcblxuICBsZXQgdHlwZTogQ29pbFR5cGUgPSAnbm9ybWFsJztcbiAgaWYgKG5lZ2F0ZWQpIHR5cGUgPSAnbmVnYXRlZCc7XG4gIGlmIChzdG9yYWdlID09PSAnc2V0JykgdHlwZSA9ICdzZXQnO1xuICBpZiAoc3RvcmFnZSA9PT0gJ3Jlc2V0JykgdHlwZSA9ICdyZXNldCc7XG4gIGlmIChzdG9yYWdlID09PSAncmV0ZW50aXZlJykgdHlwZSA9ICdsYXRjaCc7XG4gIGlmIChlZGdlTW9kaWZpZXIgPT09ICdyaXNpbmcnKSB0eXBlID0gJ3Bvc2l0aXZlX3RyYW5zaXRpb24nIGFzIENvaWxUeXBlO1xuICBpZiAoZWRnZU1vZGlmaWVyID09PSAnZmFsbGluZycpIHR5cGUgPSAnbmVnYXRpdmVfdHJhbnNpdGlvbicgYXMgQ29pbFR5cGU7XG5cbiAgY29uc3QgcG9zRWwgPSBjaGlsZChjb2lsRWwsICdwb3NpdGlvbicpO1xuXG4gIHJldHVybiB7XG4gICAga2luZDogJ2NvaWwnLFxuICAgIGlkOiBgbGQtY29pbC0ke2xvY2FsSWQgfHwgaWR4fWAsXG4gICAgdHlwZSxcbiAgICB0YWc6IHsgbmFtZTogdGFnTmFtZSwgZGF0YVR5cGU6IHJlc29sdmVyLnJlc29sdmUodGFnTmFtZSkgfSxcbiAgICBwb3NpdGlvbjogeyB4OiBOdW1iZXIoYXR0cihwb3NFbCwgJ3gnKSkgfHwgKGlkeCArIDEpICogNjAsIHk6IE51bWJlcihhdHRyKHBvc0VsLCAneScpKSB8fCAwIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIHBhcnNlTERCbG9jayhibG9ja0VsOiB1bmtub3duLCBpZHg6IG51bWJlciwgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdLCByZXNvbHZlcjogVmFyaWFibGVUeXBlUmVzb2x2ZXIgPSBuZXcgVmFyaWFibGVUeXBlUmVzb2x2ZXIoKSk6IEJsb2NrRWxlbWVudCB8IG51bGwge1xuICBpZiAoIWJsb2NrRWwgfHwgdHlwZW9mIGJsb2NrRWwgIT09ICdvYmplY3QnKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgbG9jYWxJZCA9IGF0dHIoYmxvY2tFbCwgJ2xvY2FsSWQnKTtcbiAgY29uc3QgdHlwZU5hbWUgPSBhdHRyKGJsb2NrRWwsICd0eXBlTmFtZScpIHx8ICcnO1xuICBjb25zdCBpbnN0YW5jZU5hbWUgPSBhdHRyKGJsb2NrRWwsICdpbnN0YW5jZU5hbWUnKSB8fCB0eXBlTmFtZTtcbiAgY29uc3QgZmJUeXBlTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgIFRPTjonVE9OJyxUT0Y6J1RPRicsVFA6J1RQJyxDVFU6J0NUVScsQ1REOidDVEQnLENUVUQ6J0NUVUQnLFxuICAgIFNSOidTUicsUlM6J1JTJyxSX1RSSUc6J1JUUklHJyxGX1RSSUc6J0ZUUklHJyxcbiAgICBBREQ6J0FERCcsU1VCOidTVUInLE1VTDonTVVMJyxESVY6J0RJVicsTU9EOidNT0QnLFxuICAgIEdUOidHVCcsR0U6J0dFJyxMVDonTFQnLExFOidMRScsRVE6J0VRJyxORTonTkUnLFxuICAgIFNFTDonU0VMJyxNVVg6J01VWCcsTElNSVQ6J0xJTUlUJyxNT1ZFOidNT1ZFJyxcbiAgICBBTkQ6J0FORCcsT1I6J09SJyxYT1I6J1hPUicsTk9UOidOT1QnLFxuICAgIEFCUzonQUJTJyxTUVJUOidTUVJUJyxMTjonTE4nLExPRzonTE9HJyxFWFA6J0VYUCcsXG4gICAgU0lOOidTSU4nLENPUzonQ09TJyxUQU46J1RBTicsQVNJTjonQVNJTicsQUNPUzonQUNPUycsQVRBTjonQVRBTicsXG4gICAgTUFYOidNQVgnLE1JTjonTUlOJyxcbiAgfTtcbiAgY29uc3QgZmJUeXBlID0gZmJUeXBlTWFwW3R5cGVOYW1lLnRvVXBwZXJDYXNlKCldIHx8IHR5cGVOYW1lO1xuXG4gIC8vIENvbGxlY3QgcmF3IHBpblx1MjE5MnZhcmlhYmxlLW5hbWUgbWFwcGluZ3MgZnJvbSB0aGUgWE1MXG4gIGNvbnN0IHJhd1BpbnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgZm9yIChjb25zdCB2YXJFbCBvZiBjaGlsZEFycmF5KGJsb2NrRWwsICdpbnB1dFZhcmlhYmxlJykuY29uY2F0KGNoaWxkQXJyYXkoYmxvY2tFbCwgJ291dHB1dFZhcmlhYmxlJykpKSB7XG4gICAgY29uc3QgcGluTmFtZSA9IGF0dHIodmFyRWwsICdmb3JtYWxQYXJhbWV0ZXInKTtcbiAgICBjb25zdCBjb25uRWwgPSBjaGlsZCh2YXJFbCwgJ2Nvbm5lY3Rpb25Qb2ludEluJykgPz8gY2hpbGQodmFyRWwsICdjb25uZWN0aW9uUG9pbnRPdXQnKTtcbiAgICBjb25zdCBjb25uQ2hpbGQgPSBjaGlsZChjb25uRWwsICdjb25uZWN0aW9uJyk7XG4gICAgY29uc3QgY29ubk5hbWUgPSBhdHRyKGNvbm5DaGlsZCwgJ3JlZkxvY2FsSWQnKSB8fCB0ZXh0KGNvbm5DaGlsZCkgfHwgYXR0cih2YXJFbCwgJ2Zvcm1hbFBhcmFtZXRlcicpIHx8ICcnO1xuICAgIGlmIChwaW5OYW1lKSByYXdQaW5zW3Bpbk5hbWVdID0gY29ubk5hbWU7XG4gIH1cblxuICAvLyBCdWlsZCB0eXBlZCBwaW5zOiBjYW5vbmljYWwgdHlwZXMgZnJvbSBwaW5TaWduYXR1cmVzLCByZXNvbHZlZCB2YXJpYWJsZSB0eXBlcyBhcyBmYWxsYmFja1xuICBjb25zdCB0eXBlZFBpbnMgPSBidWlsZFR5cGVkVGFnUmVmUGlucyhmYlR5cGUsIHJhd1BpbnMpO1xuICAvLyBPdmVycmlkZSBjYW5vbmljYWwgdHlwZSB3aXRoIHJlc29sdmVyIHR5cGUgd2hlcmUgd2UgaGF2ZSBhIGNvbmNyZXRlIHZhcmlhYmxlIG5hbWVcbiAgY29uc3QgcGluczogUmVjb3JkPHN0cmluZywgVGFnUmVmPiA9IHt9O1xuICBmb3IgKGNvbnN0IFtwaW5OYW1lLCBwaW5EZWZdIG9mIE9iamVjdC5lbnRyaWVzKHR5cGVkUGlucykpIHtcbiAgICBjb25zdCB2YXJOYW1lID0gcGluRGVmLm5hbWU7XG4gICAgY29uc3QgcmVzb2x2ZWRUeXBlID0gdmFyTmFtZSA/IHJlc29sdmVyLnJlc29sdmUodmFyTmFtZSkgOiBudWxsO1xuICAgIHBpbnNbcGluTmFtZV0gPSB7XG4gICAgICBuYW1lOiB2YXJOYW1lLFxuICAgICAgLy8gVXNlIHJlc29sdmVkIHZhcmlhYmxlIHR5cGUgd2hlbiBpdCdzIG1vcmUgc3BlY2lmaWMgdGhhbiBCT09MIGNhbm9uaWNhbCBkZWZhdWx0XG4gICAgICBkYXRhVHlwZTogKHJlc29sdmVkVHlwZSAmJiByZXNvbHZlZFR5cGUgIT09ICdCT09MJykgPyByZXNvbHZlZFR5cGUgOiBwaW5EZWYuZGF0YVR5cGUsXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHBvc0VsID0gY2hpbGQoYmxvY2tFbCwgJ3Bvc2l0aW9uJyk7XG4gIGNvbnN0IHB4ID0gTnVtYmVyKGF0dHIocG9zRWwsICd4JykpIHx8IGlkeCAqIDYwO1xuICBjb25zdCBweSA9IE51bWJlcihhdHRyKHBvc0VsLCAneScpKSB8fCAwO1xuXG4gIHJldHVybiB7XG4gICAga2luZDogJ2Jsb2NrJyxcbiAgICBpZDogYGxkLWJsb2NrLSR7bG9jYWxJZCB8fCBpZHh9YCxcbiAgICBmYlR5cGU6IGZiVHlwZSBhcyBhbnksXG4gICAgaW5zdGFuY2VOYW1lLFxuICAgIHBpbnMsXG4gICAgcG9zaXRpb246IHsgeDogcHgsIHk6IHB5IH0sXG4gIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBGQkQgYm9keSBwYXJzZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHBhcnNlRkJEQm9keShmYmRFbDogdW5rbm93biwgcG91TmFtZTogc3RyaW5nLCB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10sIHJlc29sdmVyOiBWYXJpYWJsZVR5cGVSZXNvbHZlciA9IG5ldyBWYXJpYWJsZVR5cGVSZXNvbHZlcigpKTogRkJEUHJvZ3JhbSB7XG4gIGNvbnN0IG5vZGVzOiBGQkROb2RlW10gPSBbXTtcbiAgY29uc3Qgd2lyZXM6IEZCRFdpcmVbXSA9IFtdO1xuICBpZiAoIWZiZEVsKSByZXR1cm4geyBub2Rlcywgd2lyZXMgfTtcblxuICAvLyBQYXJzZSBsYWJlbCBlbGVtZW50cyAoanVtcCB0YXJnZXRzIGluIEZCRClcbiAgZm9yIChjb25zdCBsYWJlbEVsIG9mIGNoaWxkQXJyYXkoZmJkRWwsICdsYWJlbCcpKSB7XG4gICAgY29uc3QgbG9jYWxJZCA9IGF0dHIobGFiZWxFbCwgJ2xvY2FsSWQnKTtcbiAgICBjb25zdCBwb3NFbCA9IGNoaWxkKGxhYmVsRWwsICdwb3NpdGlvbicpO1xuICAgIGNvbnN0IGxhYmVsTmFtZSA9IGF0dHIobGFiZWxFbCwgJ2xhYmVsJykgfHwgJyc7XG4gICAgbm9kZXMucHVzaCh7XG4gICAgICBpZDogYGZiZC0ke2xvY2FsSWR9YCxcbiAgICAgIHR5cGU6ICdMQUJFTCcgYXMgRkJEQmxvY2tUeXBlLFxuICAgICAgaW5zdGFuY2VOYW1lOiBsYWJlbE5hbWUsXG4gICAgICBwb3NpdGlvbjogeyB4OiBOdW1iZXIoYXR0cihwb3NFbCwgJ3gnKSkgfHwgMCwgeTogTnVtYmVyKGF0dHIocG9zRWwsICd5JykpIHx8IDAgfSxcbiAgICAgIGlucHV0czogW3sgaWQ6IGBsYWJlbC0ke2xvY2FsSWR9LWluYCwgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICAgIG91dHB1dHM6IFtdLFxuICAgIH0pO1xuICAgIGNvbnN0IGNwSW4gPSBjaGlsZChsYWJlbEVsLCAnY29ubmVjdGlvblBvaW50SW4nKTtcbiAgICBpZiAoY3BJbikge1xuICAgICAgZm9yIChjb25zdCBjb25uIG9mIGNoaWxkQXJyYXkoY3BJbiwgJ2Nvbm5lY3Rpb24nKSkge1xuICAgICAgICBjb25zdCByZWZJZCA9IGF0dHIoY29ubiwgJ3JlZkxvY2FsSWQnKTtcbiAgICAgICAgY29uc3QgZnJvbVBpbiA9IGF0dHIoY29ubiwgJ2Zvcm1hbFBhcmFtZXRlcicpIHx8ICdPVVQnO1xuICAgICAgICBpZiAocmVmSWQpIHtcbiAgICAgICAgICB3aXJlcy5wdXNoKHsgaWQ6IGB3aXJlLSR7cmVmSWR9LXRvLWxhYmVsLSR7bG9jYWxJZH1gLCBmcm9tOiB7IG5vZGVJZDogYGZiZC0ke3JlZklkfWAsIHBpbjogZnJvbVBpbiB9LCB0bzogeyBub2RlSWQ6IGBmYmQtJHtsb2NhbElkfWAsIHBpbjogJ0lOJyB9IH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gUGFyc2UganVtcCBlbGVtZW50cyAodW5jb25kaXRpb25hbCBqdW1wIHRvIGxhYmVsIGluIEZCRClcbiAgZm9yIChjb25zdCBqdW1wRWwgb2YgY2hpbGRBcnJheShmYmRFbCwgJ2p1bXAnKSkge1xuICAgIGNvbnN0IGxvY2FsSWQgPSBhdHRyKGp1bXBFbCwgJ2xvY2FsSWQnKTtcbiAgICBjb25zdCBwb3NFbCA9IGNoaWxkKGp1bXBFbCwgJ3Bvc2l0aW9uJyk7XG4gICAgY29uc3QgbGFiZWxOYW1lID0gYXR0cihqdW1wRWwsICdsYWJlbCcpIHx8ICcnO1xuICAgIG5vZGVzLnB1c2goe1xuICAgICAgaWQ6IGBmYmQtJHtsb2NhbElkfWAsXG4gICAgICB0eXBlOiAnSlVNUCcgYXMgRkJEQmxvY2tUeXBlLFxuICAgICAgaW5zdGFuY2VOYW1lOiBsYWJlbE5hbWUsXG4gICAgICBwb3NpdGlvbjogeyB4OiBOdW1iZXIoYXR0cihwb3NFbCwgJ3gnKSkgfHwgMCwgeTogTnVtYmVyKGF0dHIocG9zRWwsICd5JykpIHx8IDAgfSxcbiAgICAgIGlucHV0czogW3sgaWQ6IGBqdW1wLSR7bG9jYWxJZH0taW5gLCBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICAgICAgb3V0cHV0czogW10sXG4gICAgfSk7XG4gICAgY29uc3QgY3BJbiA9IGNoaWxkKGp1bXBFbCwgJ2Nvbm5lY3Rpb25Qb2ludEluJyk7XG4gICAgaWYgKGNwSW4pIHtcbiAgICAgIGZvciAoY29uc3QgY29ubiBvZiBjaGlsZEFycmF5KGNwSW4sICdjb25uZWN0aW9uJykpIHtcbiAgICAgICAgY29uc3QgcmVmSWQgPSBhdHRyKGNvbm4sICdyZWZMb2NhbElkJyk7XG4gICAgICAgIGNvbnN0IGZyb21QaW4gPSBhdHRyKGNvbm4sICdmb3JtYWxQYXJhbWV0ZXInKSB8fCAnT1VUJztcbiAgICAgICAgaWYgKHJlZklkKSB7XG4gICAgICAgICAgd2lyZXMucHVzaCh7IGlkOiBgd2lyZS0ke3JlZklkfS10by1qdW1wLSR7bG9jYWxJZH1gLCBmcm9tOiB7IG5vZGVJZDogYGZiZC0ke3JlZklkfWAsIHBpbjogZnJvbVBpbiB9LCB0bzogeyBub2RlSWQ6IGBmYmQtJHtsb2NhbElkfWAsIHBpbjogJ0lOJyB9IH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gUGFyc2UgcmV0dXJuIGVsZW1lbnRzXG4gIGZvciAoY29uc3QgcmV0RWwgb2YgY2hpbGRBcnJheShmYmRFbCwgJ3JldHVybicpKSB7XG4gICAgY29uc3QgbG9jYWxJZCA9IGF0dHIocmV0RWwsICdsb2NhbElkJyk7XG4gICAgY29uc3QgcG9zRWwgPSBjaGlsZChyZXRFbCwgJ3Bvc2l0aW9uJyk7XG4gICAgbm9kZXMucHVzaCh7XG4gICAgICBpZDogYGZiZC0ke2xvY2FsSWR9YCxcbiAgICAgIHR5cGU6ICdSRVRVUk4nIGFzIEZCREJsb2NrVHlwZSxcbiAgICAgIGluc3RhbmNlTmFtZTogJ1JFVFVSTicsXG4gICAgICBwb3NpdGlvbjogeyB4OiBOdW1iZXIoYXR0cihwb3NFbCwgJ3gnKSkgfHwgMCwgeTogTnVtYmVyKGF0dHIocG9zRWwsICd5JykpIHx8IDAgfSxcbiAgICAgIGlucHV0czogW3sgaWQ6IGByZXR1cm4tJHtsb2NhbElkfS1pbmAsIG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgICBvdXRwdXRzOiBbXSxcbiAgICB9KTtcbiAgICBjb25zdCBjcEluID0gY2hpbGQocmV0RWwsICdjb25uZWN0aW9uUG9pbnRJbicpO1xuICAgIGlmIChjcEluKSB7XG4gICAgICBmb3IgKGNvbnN0IGNvbm4gb2YgY2hpbGRBcnJheShjcEluLCAnY29ubmVjdGlvbicpKSB7XG4gICAgICAgIGNvbnN0IHJlZklkID0gYXR0cihjb25uLCAncmVmTG9jYWxJZCcpO1xuICAgICAgICBjb25zdCBmcm9tUGluID0gYXR0cihjb25uLCAnZm9ybWFsUGFyYW1ldGVyJykgfHwgJ09VVCc7XG4gICAgICAgIGlmIChyZWZJZCkge1xuICAgICAgICAgIHdpcmVzLnB1c2goeyBpZDogYHdpcmUtJHtyZWZJZH0tdG8tcmV0dXJuLSR7bG9jYWxJZH1gLCBmcm9tOiB7IG5vZGVJZDogYGZiZC0ke3JlZklkfWAsIHBpbjogZnJvbVBpbiB9LCB0bzogeyBub2RlSWQ6IGBmYmQtJHtsb2NhbElkfWAsIHBpbjogJ0lOJyB9IH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gUGFyc2UgY29ubmVjdG9yIGVsZW1lbnRzIChuYW1lZCBzaWduYWwgc2luayBcdTIwMTQgcGFpcnMgd2l0aCBjb250aW51YXRpb24pXG4gIGZvciAoY29uc3QgY29ubkVsIG9mIGNoaWxkQXJyYXkoZmJkRWwsICdjb25uZWN0b3InKSkge1xuICAgIGNvbnN0IGxvY2FsSWQgPSBhdHRyKGNvbm5FbCwgJ2xvY2FsSWQnKTtcbiAgICBjb25zdCBwb3NFbCA9IGNoaWxkKGNvbm5FbCwgJ3Bvc2l0aW9uJyk7XG4gICAgY29uc3QgY29ubk5hbWUgPSBhdHRyKGNvbm5FbCwgJ25hbWUnKSB8fCAnJztcbiAgICBub2Rlcy5wdXNoKHtcbiAgICAgIGlkOiBgZmJkLSR7bG9jYWxJZH1gLFxuICAgICAgdHlwZTogJ0NPTk5FQ1RPUicgYXMgRkJEQmxvY2tUeXBlLFxuICAgICAgaW5zdGFuY2VOYW1lOiBjb25uTmFtZSxcbiAgICAgIHBvc2l0aW9uOiB7IHg6IE51bWJlcihhdHRyKHBvc0VsLCAneCcpKSB8fCAwLCB5OiBOdW1iZXIoYXR0cihwb3NFbCwgJ3knKSkgfHwgMCB9LFxuICAgICAgaW5wdXRzOiBbeyBpZDogYGNvbm5lY3Rvci0ke2xvY2FsSWR9LWluYCwgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICAgIG91dHB1dHM6IFtdLFxuICAgIH0pO1xuICAgIGNvbnN0IGNwSW4gPSBjaGlsZChjb25uRWwsICdjb25uZWN0aW9uUG9pbnRJbicpO1xuICAgIGlmIChjcEluKSB7XG4gICAgICBmb3IgKGNvbnN0IGNvbm4gb2YgY2hpbGRBcnJheShjcEluLCAnY29ubmVjdGlvbicpKSB7XG4gICAgICAgIGNvbnN0IHJlZklkID0gYXR0cihjb25uLCAncmVmTG9jYWxJZCcpO1xuICAgICAgICBjb25zdCBmcm9tUGluID0gYXR0cihjb25uLCAnZm9ybWFsUGFyYW1ldGVyJykgfHwgJ09VVCc7XG4gICAgICAgIGlmIChyZWZJZCkge1xuICAgICAgICAgIHdpcmVzLnB1c2goeyBpZDogYHdpcmUtJHtyZWZJZH0tdG8tY29ubmVjdG9yLSR7bG9jYWxJZH1gLCBmcm9tOiB7IG5vZGVJZDogYGZiZC0ke3JlZklkfWAsIHBpbjogZnJvbVBpbiB9LCB0bzogeyBub2RlSWQ6IGBmYmQtJHtsb2NhbElkfWAsIHBpbjogJ0lOJyB9IH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gUGFyc2UgY29udGludWF0aW9uIGVsZW1lbnRzIChuYW1lZCBzaWduYWwgc291cmNlIFx1MjAxNCBwYWlycyB3aXRoIGNvbm5lY3RvcilcbiAgZm9yIChjb25zdCBjb250RWwgb2YgY2hpbGRBcnJheShmYmRFbCwgJ2NvbnRpbnVhdGlvbicpKSB7XG4gICAgY29uc3QgbG9jYWxJZCA9IGF0dHIoY29udEVsLCAnbG9jYWxJZCcpO1xuICAgIGNvbnN0IHBvc0VsID0gY2hpbGQoY29udEVsLCAncG9zaXRpb24nKTtcbiAgICBjb25zdCBjb250TmFtZSA9IGF0dHIoY29udEVsLCAnbmFtZScpIHx8ICcnO1xuICAgIG5vZGVzLnB1c2goe1xuICAgICAgaWQ6IGBmYmQtJHtsb2NhbElkfWAsXG4gICAgICB0eXBlOiAnQ09OVElOVUFUSU9OJyBhcyBGQkRCbG9ja1R5cGUsXG4gICAgICBpbnN0YW5jZU5hbWU6IGNvbnROYW1lLFxuICAgICAgcG9zaXRpb246IHsgeDogTnVtYmVyKGF0dHIocG9zRWwsICd4JykpIHx8IDAsIHk6IE51bWJlcihhdHRyKHBvc0VsLCAneScpKSB8fCAwIH0sXG4gICAgICBpbnB1dHM6IFtdLFxuICAgICAgb3V0cHV0czogW3sgaWQ6IGBjb250aW51YXRpb24tJHtsb2NhbElkfS1vdXRgLCBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IHdpcmVNYXAgPSBuZXcgTWFwPHN0cmluZywgeyBub2RlSWQ6IHN0cmluZzsgcGluOiBzdHJpbmcgfT4oKTsgLy8gY29ubmVjdGlvbklkIFx1MjE5MiBzb3VyY2UgcGluXG5cbiAgZm9yIChjb25zdCBibG9ja0VsIG9mIGNoaWxkQXJyYXkoZmJkRWwsICdibG9jaycpKSB7XG4gICAgY29uc3QgbG9jYWxJZCA9IGF0dHIoYmxvY2tFbCwgJ2xvY2FsSWQnKTtcbiAgICBjb25zdCB0eXBlTmFtZSA9IGF0dHIoYmxvY2tFbCwgJ3R5cGVOYW1lJykgfHwgJyc7XG4gICAgY29uc3QgaW5zdGFuY2VOYW1lID0gYXR0cihibG9ja0VsLCAnaW5zdGFuY2VOYW1lJykgfHwgYCR7dHlwZU5hbWV9XyR7bG9jYWxJZH1gO1xuICAgIGNvbnN0IHBvc0VsID0gY2hpbGQoYmxvY2tFbCwgJ3Bvc2l0aW9uJyk7XG4gICAgY29uc3QgeCA9IE51bWJlcihhdHRyKHBvc0VsLCAneCcpKSB8fCAwO1xuICAgIGNvbnN0IHkgPSBOdW1iZXIoYXR0cihwb3NFbCwgJ3knKSkgfHwgMDtcblxuICAgIC8vIEJ1aWxkIHR5cGVkIHBpbiBhcnJheXMgZnJvbSBjYW5vbmljYWwgc2lnbmF0dXJlXG4gICAgY29uc3QgeyBpbnB1dHM6IHNpZ0lucHV0cywgb3V0cHV0czogc2lnT3V0cHV0cyB9ID0gYnVpbGRUeXBlZFBpbnModHlwZU5hbWUsIFtdLCBgZmJkLSR7bG9jYWxJZH1gKTtcbiAgICAvLyBCdWlsZCBhIGxvb2t1cCBzbyB3ZSBjYW4gb3ZlcnJpZGUgd2l0aCBhY3R1YWwgbmVnYXRlZCBmbGFncyBmcm9tIFhNTFxuICAgIGNvbnN0IGlucHV0c0J5TmFtZSA9IG5ldyBNYXAoc2lnSW5wdXRzLm1hcChwID0+IFtwLm5hbWUsIHsgLi4ucCB9XSkpO1xuICAgIGNvbnN0IG91dHB1dHNCeU5hbWUgPSBuZXcgTWFwKHNpZ091dHB1dHMubWFwKHAgPT4gW3AubmFtZSwgeyAuLi5wIH1dKSk7XG5cbiAgICAvLyBTb21lIHRvb2xzIChDT0RFU1lTLCBCZWNraG9mZikgb21pdCB0aGUgaW5wdXRWYXJpYWJsZXMgd3JhcHBlclxuICAgIGNvbnN0IGRpcmVjdFZhcnMgPSBjaGlsZEFycmF5KGJsb2NrRWwsICd2YXJpYWJsZScpO1xuICAgIGNvbnN0IGlucHV0VmFyRWxzID0gKGNoaWxkQXJyYXkoYmxvY2tFbCwgJ2lucHV0VmFyaWFibGVzJykuZmxhdE1hcChpdiA9PiBjaGlsZEFycmF5KGl2LCAndmFyaWFibGUnKSkpXG4gICAgICAuY29uY2F0KGRpcmVjdFZhcnMuZmlsdGVyKHYgPT4gY2hpbGQodiwgJ2Nvbm5lY3Rpb25Qb2ludEluJykgIT09IG51bGwgJiYgY2hpbGQodiwgJ2Nvbm5lY3Rpb25Qb2ludEluJykgIT09IHVuZGVmaW5lZCkpO1xuXG4gICAgZm9yIChjb25zdCBpblZhciBvZiBpbnB1dFZhckVscykge1xuICAgICAgY29uc3QgcGluTmFtZSA9IGF0dHIoaW5WYXIsICdmb3JtYWxQYXJhbWV0ZXInKSB8fCAnJztcbiAgICAgIGNvbnN0IG5lZ2F0ZWQgPSBhdHRyKGluVmFyLCAnbmVnYXRlZCcpID09PSAndHJ1ZSc7XG4gICAgICBjb25zdCBjb25uSWQgPSBhdHRyKGNoaWxkKGluVmFyLCAnY29ubmVjdGlvblBvaW50SW4nKSwgJ3JlZkxvY2FsSWQnKSB8fCBhdHRyKGluVmFyLCAnbG9jYWxJZCcpO1xuICAgICAgLy8gR2V0IGNhbm9uaWNhbCB0eXBlOyBmYWxsIGJhY2sgdG8gQk9PTCBmb3IgdW5rbm93biBibG9ja3MvcGluc1xuICAgICAgY29uc3QgY2Fub25pY2FsVHlwZSA9IGdldFBpbkRhdGFUeXBlKHR5cGVOYW1lLCBwaW5OYW1lLCAnaW5wdXQnKTtcbiAgICAgIGlmIChpbnB1dHNCeU5hbWUuaGFzKHBpbk5hbWUpKSB7XG4gICAgICAgIGlucHV0c0J5TmFtZS5nZXQocGluTmFtZSkhLm5lZ2F0ZWQgPSBuZWdhdGVkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5wdXRzQnlOYW1lLnNldChwaW5OYW1lLCB7IGlkOiBgJHtsb2NhbElkfS1pbi0ke3Bpbk5hbWV9YCwgbmFtZTogcGluTmFtZSwgZGF0YVR5cGU6IGNhbm9uaWNhbFR5cGUsIG5lZ2F0ZWQgfSk7XG4gICAgICB9XG4gICAgICBpZiAoY29ubklkKSB3aXJlTWFwLnNldChjb25uSWQsIHsgbm9kZUlkOiBgZmJkLSR7bG9jYWxJZH1gLCBwaW46IHBpbk5hbWUgfSk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBvdXRWYXIgb2YgY2hpbGRBcnJheShibG9ja0VsLCAnb3V0cHV0VmFyaWFibGVzJykuZmxhdE1hcChvdiA9PiBjaGlsZEFycmF5KG92LCAndmFyaWFibGUnKSkpIHtcbiAgICAgIGNvbnN0IHBpbk5hbWUgPSBhdHRyKG91dFZhciwgJ2Zvcm1hbFBhcmFtZXRlcicpIHx8ICcnO1xuICAgICAgY29uc3QgbmVnYXRlZCA9IGF0dHIob3V0VmFyLCAnbmVnYXRlZCcpID09PSAndHJ1ZSc7XG4gICAgICBjb25zdCBjYW5vbmljYWxUeXBlID0gZ2V0UGluRGF0YVR5cGUodHlwZU5hbWUsIHBpbk5hbWUsICdvdXRwdXQnKTtcbiAgICAgIGlmIChvdXRwdXRzQnlOYW1lLmhhcyhwaW5OYW1lKSkge1xuICAgICAgICBvdXRwdXRzQnlOYW1lLmdldChwaW5OYW1lKSEubmVnYXRlZCA9IG5lZ2F0ZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvdXRwdXRzQnlOYW1lLnNldChwaW5OYW1lLCB7IGlkOiBgJHtsb2NhbElkfS1vdXQtJHtwaW5OYW1lfWAsIG5hbWU6IHBpbk5hbWUsIGRhdGFUeXBlOiBjYW5vbmljYWxUeXBlLCBuZWdhdGVkIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGV4ZWNPcmRlciA9IGF0dHIoYmxvY2tFbCwgJ2V4ZWN1dGlvbk9yZGVySWQnKTtcbiAgICBub2Rlcy5wdXNoKHtcbiAgICAgIGlkOiBgZmJkLSR7bG9jYWxJZH1gLFxuICAgICAgdHlwZTogdHlwZU5hbWUudG9VcHBlckNhc2UoKSBhcyBGQkRCbG9ja1R5cGUsXG4gICAgICBpbnN0YW5jZU5hbWUsXG4gICAgICBwb3NpdGlvbjogeyB4LCB5IH0sXG4gICAgICBpbnB1dHM6IFsuLi5pbnB1dHNCeU5hbWUudmFsdWVzKCldLFxuICAgICAgb3V0cHV0czogWy4uLm91dHB1dHNCeU5hbWUudmFsdWVzKCldLFxuICAgICAgZXhlY3V0aW9uT3JkZXJJZDogZXhlY09yZGVyID8gTnVtYmVyKGV4ZWNPcmRlcikgOiB1bmRlZmluZWQsXG4gICAgfSk7XG4gIH1cblxuICAvLyBpbk91dFZhcmlhYmxlIGVsZW1lbnRzIChib3RoIGlucHV0IGFuZCBvdXRwdXQgY29ubmVjdGlvbnMpXG4gIGZvciAoY29uc3QgdmFyRWwgb2YgY2hpbGRBcnJheShmYmRFbCwgJ2luT3V0VmFyaWFibGUnKSkge1xuICAgIGNvbnN0IGxvY2FsSWQgPSBhdHRyKHZhckVsLCAnbG9jYWxJZCcpO1xuICAgIGNvbnN0IHBvc0VsID0gY2hpbGQodmFyRWwsICdwb3NpdGlvbicpO1xuICAgIGNvbnN0IHggPSBOdW1iZXIoYXR0cihwb3NFbCwgJ3gnKSkgfHwgMDtcbiAgICBjb25zdCB5ID0gTnVtYmVyKGF0dHIocG9zRWwsICd5JykpIHx8IDA7XG4gICAgY29uc3QgdmFyTmFtZSA9IHRleHQoY2hpbGQodmFyRWwsICdleHByZXNzaW9uJykgPz8gdmFyRWwpIHx8ICcnO1xuICAgIGNvbnN0IHZhclR5cGUgPSByZXNvbHZlci5yZXNvbHZlKHZhck5hbWUpO1xuICAgIG5vZGVzLnB1c2goe1xuICAgICAgaWQ6IGBmYmQtdmFyLSR7bG9jYWxJZH1gLFxuICAgICAgdHlwZTogJ0lOX09VVF9WQVJJQUJMRScgYXMgRkJEQmxvY2tUeXBlLFxuICAgICAgdGFnOiB7IG5hbWU6IHZhck5hbWUsIGRhdGFUeXBlOiB2YXJUeXBlIH0sXG4gICAgICBwb3NpdGlvbjogeyB4LCB5IH0sXG4gICAgICBpbnB1dHM6IFt7IGlkOiBgdmFyLSR7bG9jYWxJZH0taW5gLCBuYW1lOiAnSU4nLCBkYXRhVHlwZTogdmFyVHlwZSB9XSxcbiAgICAgIG91dHB1dHM6IFt7IGlkOiBgdmFyLSR7bG9jYWxJZH0tb3V0YCwgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiB2YXJUeXBlIH1dLFxuICAgIH0pO1xuICAgIC8vIEJ1aWxkIHdpcmVzIGZyb20gY29ubmVjdGlvblBvaW50SW4gY29ubmVjdGlvbnNcbiAgICBjb25zdCBjcEluID0gY2hpbGQodmFyRWwsICdjb25uZWN0aW9uUG9pbnRJbicpO1xuICAgIGlmIChjcEluKSB7XG4gICAgICBmb3IgKGNvbnN0IGNvbm4gb2YgY2hpbGRBcnJheShjcEluLCAnY29ubmVjdGlvbicpKSB7XG4gICAgICAgIGNvbnN0IHJlZklkID0gYXR0cihjb25uLCAncmVmTG9jYWxJZCcpO1xuICAgICAgICBjb25zdCBmcm9tUGluID0gYXR0cihjb25uLCAnZm9ybWFsUGFyYW1ldGVyJykgfHwgJ09VVCc7XG4gICAgICAgIGlmIChyZWZJZCkge1xuICAgICAgICAgIHdpcmVzLnB1c2goe1xuICAgICAgICAgICAgaWQ6IGB3aXJlLSR7cmVmSWR9LXRvLXZhci0ke2xvY2FsSWR9YCxcbiAgICAgICAgICAgIGZyb206IHsgbm9kZUlkOiBgZmJkLSR7cmVmSWR9YCwgcGluOiBmcm9tUGluIH0sXG4gICAgICAgICAgICB0bzogeyBub2RlSWQ6IGBmYmQtdmFyLSR7bG9jYWxJZH1gLCBwaW46ICdJTicgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFZhcmlhYmxlIChJTl9WQVJJQUJMRSAvIE9VVF9WQVJJQUJMRSlcbiAgY29uc3Qgb3V0VmFyRWxzID0gbmV3IFNldChjaGlsZEFycmF5KGZiZEVsLCAnb3V0VmFyaWFibGUnKSk7XG4gIGZvciAoY29uc3QgdmFyRWwgb2YgY2hpbGRBcnJheShmYmRFbCwgJ2luVmFyaWFibGUnKS5jb25jYXQoY2hpbGRBcnJheShmYmRFbCwgJ291dFZhcmlhYmxlJykpKSB7XG4gICAgY29uc3QgbG9jYWxJZCA9IGF0dHIodmFyRWwsICdsb2NhbElkJyk7XG4gICAgY29uc3QgaXNPdXQgPSBvdXRWYXJFbHMuaGFzKHZhckVsKTtcbiAgICBjb25zdCBwb3NFbCA9IGNoaWxkKHZhckVsLCAncG9zaXRpb24nKTtcbiAgICBjb25zdCB4ID0gTnVtYmVyKGF0dHIocG9zRWwsICd4JykpIHx8IDA7XG4gICAgY29uc3QgeSA9IE51bWJlcihhdHRyKHBvc0VsLCAneScpKSB8fCAwO1xuICAgIGNvbnN0IHZhck5hbWUgPSB0ZXh0KGNoaWxkKHZhckVsLCAnZXhwcmVzc2lvbicpID8/IHZhckVsKSB8fCAnJztcbiAgICBjb25zdCB2YXJUeXBlID0gcmVzb2x2ZXIucmVzb2x2ZSh2YXJOYW1lKTtcbiAgICBub2Rlcy5wdXNoKHtcbiAgICAgIGlkOiBgZmJkLXZhci0ke2xvY2FsSWR9YCxcbiAgICAgIHR5cGU6IGlzT3V0ID8gJ09VVF9WQVJJQUJMRScgOiAnSU5fVkFSSUFCTEUnLFxuICAgICAgdGFnOiB7IG5hbWU6IHZhck5hbWUsIGRhdGFUeXBlOiB2YXJUeXBlIH0sXG4gICAgICBwb3NpdGlvbjogeyB4LCB5IH0sXG4gICAgICBpbnB1dHM6IGlzT3V0ID8gW3sgaWQ6IGB2YXItJHtsb2NhbElkfS1pbmAsIG5hbWU6ICdJTicsIGRhdGFUeXBlOiB2YXJUeXBlIH1dIDogW10sXG4gICAgICBvdXRwdXRzOiBpc091dCA/IFtdIDogW3sgaWQ6IGB2YXItJHtsb2NhbElkfS1vdXRgLCBuYW1lOiAnT1VUJywgZGF0YVR5cGU6IHZhclR5cGUgfV0sXG4gICAgfSk7XG4gIH1cblxuICAvLyBCdWlsZCB3aXJlcyBieSB0cmF2ZXJzaW5nIGNvbm5lY3Rpb25Qb2ludEluIG9uIGVhY2ggYmxvY2sncyBpbnB1dCB2YXJpYWJsZXNcbiAgZm9yIChjb25zdCBibG9ja0VsIG9mIGNoaWxkQXJyYXkoZmJkRWwsICdibG9jaycpKSB7XG4gICAgY29uc3QgYmxvY2tMb2NhbElkID0gYXR0cihibG9ja0VsLCAnbG9jYWxJZCcpO1xuICAgIGZvciAoY29uc3QgaW5WYXIgb2YgY2hpbGRBcnJheShibG9ja0VsLCAnaW5wdXRWYXJpYWJsZXMnKS5mbGF0TWFwKGl2ID0+IGNoaWxkQXJyYXkoaXYsICd2YXJpYWJsZScpKSkge1xuICAgICAgY29uc3QgcGluTmFtZSA9IGF0dHIoaW5WYXIsICdmb3JtYWxQYXJhbWV0ZXInKTtcbiAgICAgIGNvbnN0IGNwSW4gPSBjaGlsZChpblZhciwgJ2Nvbm5lY3Rpb25Qb2ludEluJyk7XG4gICAgICBpZiAoIWNwSW4pIGNvbnRpbnVlO1xuICAgICAgZm9yIChjb25zdCBjb25uIG9mIGNoaWxkQXJyYXkoY3BJbiwgJ2Nvbm5lY3Rpb24nKSkge1xuICAgICAgICBjb25zdCByZWZJZCA9IGF0dHIoY29ubiwgJ3JlZkxvY2FsSWQnKTtcbiAgICAgICAgY29uc3QgZnJvbVBpbiA9IGF0dHIoY29ubiwgJ2Zvcm1hbFBhcmFtZXRlcicpIHx8ICdPVVQnO1xuICAgICAgICBpZiAocmVmSWQpIHtcbiAgICAgICAgICB3aXJlcy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiBgd2lyZS0ke3JlZklkfS10by0ke2Jsb2NrTG9jYWxJZH0tJHtwaW5OYW1lfWAsXG4gICAgICAgICAgICBmcm9tOiB7IG5vZGVJZDogYGZiZC0ke3JlZklkfWAsIHBpbjogZnJvbVBpbiB9LFxuICAgICAgICAgICAgdG86IHsgbm9kZUlkOiBgZmJkLSR7YmxvY2tMb2NhbElkfWAsIHBpbjogcGluTmFtZSB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gQnVpbGQgd2lyZXMgZm9yIG91dFZhcmlhYmxlIGVsZW1lbnRzICh0aGV5IHJlY2VpdmUgY29ubmVjdGlvbnMpXG4gIGZvciAoY29uc3QgdmFyRWwgb2YgY2hpbGRBcnJheShmYmRFbCwgJ291dFZhcmlhYmxlJykpIHtcbiAgICBjb25zdCBsb2NhbElkID0gYXR0cih2YXJFbCwgJ2xvY2FsSWQnKTtcbiAgICBjb25zdCBjcEluID0gY2hpbGQodmFyRWwsICdjb25uZWN0aW9uUG9pbnRJbicpO1xuICAgIGlmICghY3BJbikgY29udGludWU7XG4gICAgZm9yIChjb25zdCBjb25uIG9mIGNoaWxkQXJyYXkoY3BJbiwgJ2Nvbm5lY3Rpb24nKSkge1xuICAgICAgY29uc3QgcmVmSWQgPSBhdHRyKGNvbm4sICdyZWZMb2NhbElkJyk7XG4gICAgICBjb25zdCBmcm9tUGluID0gYXR0cihjb25uLCAnZm9ybWFsUGFyYW1ldGVyJykgfHwgJ09VVCc7XG4gICAgICBpZiAocmVmSWQpIHtcbiAgICAgICAgd2lyZXMucHVzaCh7XG4gICAgICAgICAgaWQ6IGB3aXJlLSR7cmVmSWR9LXRvLXZhci0ke2xvY2FsSWR9YCxcbiAgICAgICAgICBmcm9tOiB7IG5vZGVJZDogYGZiZC0ke3JlZklkfWAsIHBpbjogZnJvbVBpbiB9LFxuICAgICAgICAgIHRvOiB7IG5vZGVJZDogYGZiZC12YXItJHtsb2NhbElkfWAsIHBpbjogJ0lOJyB9LFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBCdWlsZCB3aXJlcyBmb3IgaW5WYXJpYWJsZSBjb25uZWN0aW9uUG9pbnRJbiAocmFyZSBidXQgcG9zc2libGUgaW4gc29tZSBleHBvcnRlcnMpXG4gIGZvciAoY29uc3QgdmFyRWwgb2YgY2hpbGRBcnJheShmYmRFbCwgJ2luVmFyaWFibGUnKSkge1xuICAgIGNvbnN0IGxvY2FsSWQgPSBhdHRyKHZhckVsLCAnbG9jYWxJZCcpO1xuICAgIGNvbnN0IGNwSW4gPSBjaGlsZCh2YXJFbCwgJ2Nvbm5lY3Rpb25Qb2ludEluJyk7XG4gICAgaWYgKCFjcEluKSBjb250aW51ZTtcbiAgICBmb3IgKGNvbnN0IGNvbm4gb2YgY2hpbGRBcnJheShjcEluLCAnY29ubmVjdGlvbicpKSB7XG4gICAgICBjb25zdCByZWZJZCA9IGF0dHIoY29ubiwgJ3JlZkxvY2FsSWQnKTtcbiAgICAgIGNvbnN0IGZyb21QaW4gPSBhdHRyKGNvbm4sICdmb3JtYWxQYXJhbWV0ZXInKSB8fCAnT1VUJztcbiAgICAgIGlmIChyZWZJZCkge1xuICAgICAgICB3aXJlcy5wdXNoKHtcbiAgICAgICAgICBpZDogYHdpcmUtJHtyZWZJZH0tdG8tdmFyLSR7bG9jYWxJZH1gLFxuICAgICAgICAgIGZyb206IHsgbm9kZUlkOiBgZmJkLSR7cmVmSWR9YCwgcGluOiBmcm9tUGluIH0sXG4gICAgICAgICAgdG86IHsgbm9kZUlkOiBgZmJkLXZhci0ke2xvY2FsSWR9YCwgcGluOiAnSU4nIH0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7IG5vZGVzLCB3aXJlcyB9O1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgU0ZDIGJvZHkgcGFyc2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBwYXJzZVNGQ0JvZHkoc2ZjRWw6IHVua25vd24sIHBvdU5hbWU6IHN0cmluZywgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdKTogU0ZDUHJvZ3JhbSB7XG4gIGNvbnN0IHN0ZXBzOiBTRkNTdGVwW10gPSBbXTtcbiAgY29uc3QgdHJhbnNpdGlvbnM6IFNGQ1RyYW5zaXRpb25bXSA9IFtdO1xuICBjb25zdCBsaW5rczogU0ZDTGlua1tdID0gW107XG5cbiAgY29uc3QganVtcHM6IFNGQ0p1bXBbXSA9IFtdO1xuICBpZiAoIXNmY0VsKSByZXR1cm4geyBzdGVwcywgdHJhbnNpdGlvbnMsIGxpbmtzLCBicmFuY2hlczogW10sIGp1bXBzIH07XG5cbiAgLy8gUHJlLWJ1aWxkIGEgbWFwIGZyb20gc3RlcCBsb2NhbElkIFx1MjE5MiBhY3Rpb25zIGZyb20gc2libGluZyBhY3Rpb25CbG9jayBlbGVtZW50c1xuICBjb25zdCBzdGVwQWN0aW9uTWFwID0gbmV3IE1hcDxzdHJpbmcsIFNGQ0FjdGlvbltdPigpO1xuICBmb3IgKGNvbnN0IGFiRWwgb2YgY2hpbGRBcnJheShzZmNFbCwgJ2FjdGlvbkJsb2NrJykpIHtcbiAgICBjb25zdCBjcEluID0gY2hpbGQoYWJFbCwgJ2Nvbm5lY3Rpb25Qb2ludEluJyk7XG4gICAgY29uc3QgcmVmU3RlcElkID0gY3BJbiA/IChhdHRyKGNoaWxkKGNwSW4sICdjb25uZWN0aW9uJyksICdyZWZMb2NhbElkJykgfHwgJycpIDogJyc7XG4gICAgaWYgKCFyZWZTdGVwSWQpIGNvbnRpbnVlO1xuICAgIGNvbnN0IHF1YWxpZmllcnM6IEFjdGlvblF1YWxpZmllcltdID0gWydOJywnUycsJ1InLCdQJywnUDEnLCdQMCcsJ0wnLCdEJywnU0QnLCdEUycsJ1NMJ107XG4gICAgZm9yIChjb25zdCBhY3Rpb25FbCBvZiBjaGlsZEFycmF5KGFiRWwsICdhY3Rpb24nKSkge1xuICAgICAgY29uc3QgcXVhbCA9IGF0dHIoYWN0aW9uRWwsICdxdWFsaWZpZXInKSBhcyBBY3Rpb25RdWFsaWZpZXI7XG4gICAgICBjb25zdCByZWZFbCA9IGNoaWxkKGFjdGlvbkVsLCAncmVmZXJlbmNlJyk7XG4gICAgICAvLyBCdWcgOCBmaXg6IHJlYWQgbmFtZSBhdHRyaWJ1dGUgZmlyc3QsIG5vdCB0ZXh0IGNvbnRlbnRcbiAgICAgIGNvbnN0IHRhZ05hbWUgPSBhdHRyKHJlZkVsLCAnbmFtZScpIHx8IGF0dHIoYWN0aW9uRWwsICduYW1lJyk7XG4gICAgICBpZiAoIXRhZ05hbWUpIGNvbnRpbnVlO1xuICAgICAgaWYgKCFzdGVwQWN0aW9uTWFwLmhhcyhyZWZTdGVwSWQpKSBzdGVwQWN0aW9uTWFwLnNldChyZWZTdGVwSWQsIFtdKTtcbiAgICAgIHN0ZXBBY3Rpb25NYXAuZ2V0KHJlZlN0ZXBJZCkhLnB1c2goe1xuICAgICAgICBpZDogYGFjdGlvbi0ke3RhZ05hbWV9LSR7cXVhbH1gLFxuICAgICAgICBxdWFsaWZpZXI6IHF1YWxpZmllcnMuaW5jbHVkZXMocXVhbCkgPyBxdWFsIDogJ04nLFxuICAgICAgICB0YWc6IHsgbmFtZTogdGFnTmFtZSwgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgICBkdXJhdGlvbjogYXR0cihhY3Rpb25FbCwgJ2R1cmF0aW9uJykgfHwgdW5kZWZpbmVkLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHN0ZXBJZHggPSAwO1xuICBmb3IgKGNvbnN0IHN0ZXBFbCBvZiBjaGlsZEFycmF5KHNmY0VsLCAnc3RlcCcpKSB7XG4gICAgY29uc3QgbG9jYWxJZCA9IGF0dHIoc3RlcEVsLCAnbG9jYWxJZCcpO1xuICAgIGNvbnN0IG5hbWUgPSBhdHRyKHN0ZXBFbCwgJ25hbWUnKSB8fCBgU3RlcCR7c3RlcElkeH1gO1xuICAgIGNvbnN0IGlzSW5pdGlhbCA9IGF0dHIoc3RlcEVsLCAnaW5pdGlhbFN0ZXAnKSA9PT0gJ3RydWUnO1xuICAgIGNvbnN0IHBvc0VsID0gY2hpbGQoc3RlcEVsLCAncG9zaXRpb24nKTtcbiAgICBzdGVwSWR4Kys7XG4gICAgLy8gQWN0aW9ucyBmcm9tIHNpYmxpbmcgYWN0aW9uQmxvY2tzIChwcmVmZXJyZWQpIG9yIGlubGluZSBzdGVwIGNoaWxkcmVuXG4gICAgY29uc3Qgc2libGluZ0FjdGlvbnMgPSBzdGVwQWN0aW9uTWFwLmdldChsb2NhbElkIHx8ICcnKSB8fCBbXTtcbiAgICBjb25zdCBpbmxpbmVBY3Rpb25zID0gc2libGluZ0FjdGlvbnMubGVuZ3RoID09PSAwID8gcGFyc2VBY3Rpb25zKHN0ZXBFbCwgdW5tYXBwZWQpIDogW107XG4gICAgc3RlcHMucHVzaCh7XG4gICAgICBpZDogYHNmYy1zdGVwLSR7bG9jYWxJZH1gLFxuICAgICAgbmFtZSxcbiAgICAgIGlzSW5pdGlhbCxcbiAgICAgIGFjdGlvbnM6IHNpYmxpbmdBY3Rpb25zLmxlbmd0aCA+IDAgPyBzaWJsaW5nQWN0aW9ucyA6IGlubGluZUFjdGlvbnMsXG4gICAgICBwb3NpdGlvbjogeyB4OiBOdW1iZXIoYXR0cihwb3NFbCwgJ3gnKSkgfHwgMCwgeTogTnVtYmVyKGF0dHIocG9zRWwsICd5JykpIHx8IDAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIGxldCB0cmFuc0lkeCA9IDA7XG4gIGZvciAoY29uc3QgdHJhbnNFbCBvZiBjaGlsZEFycmF5KHNmY0VsLCAndHJhbnNpdGlvbicpKSB7XG4gICAgY29uc3QgbG9jYWxJZCA9IGF0dHIodHJhbnNFbCwgJ2xvY2FsSWQnKTtcbiAgICBjb25zdCBwb3NFbCA9IGNoaWxkKHRyYW5zRWwsICdwb3NpdGlvbicpO1xuICAgIGNvbnN0IGNvbmRFbCA9IGNoaWxkKHRyYW5zRWwsICdjb25kaXRpb24nKTtcbiAgICBjb25zdCBzdEVsID0gY2hpbGQoY29uZEVsLCAnU1QnKSA/PyBjaGlsZCh0cmFuc0VsLCAncmVmZXJlbmNlJykgPz8gY29uZEVsO1xuICAgIGNvbnN0IGNvbmRpdGlvbiA9IHN0RWwgPyB0ZXh0KGNoaWxkKHN0RWwgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4sICd4aHRtbDpwJykgPz8gY2hpbGQoc3RFbCBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiwgJ3hodG1sJykgPz8gc3RFbCkgOiAnVFJVRSc7XG4gICAgY29uc3QgcHJpb3JpdHkgPSBhdHRyKHRyYW5zRWwsICdwcmlvcml0eScpO1xuICAgIHRyYW5zSWR4Kys7XG4gICAgdHJhbnNpdGlvbnMucHVzaCh7XG4gICAgICBpZDogYHNmYy10cmFucy0ke2xvY2FsSWR9YCxcbiAgICAgIGNvbmRpdGlvbjogY29uZGl0aW9uIHx8ICdUUlVFJyxcbiAgICAgIHByaW9yaXR5OiBwcmlvcml0eSA/IE51bWJlcihwcmlvcml0eSkgOiB1bmRlZmluZWQsXG4gICAgICBwb3NpdGlvbjogeyB4OiBOdW1iZXIoYXR0cihwb3NFbCwgJ3gnKSkgfHwgMCwgeTogTnVtYmVyKGF0dHIocG9zRWwsICd5JykpIHx8IDAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIEJ1aWxkIGxpbmtzIGZyb20gY29ubmVjdGlvbiBwb2ludHNcbiAgZm9yIChjb25zdCBzdGVwRWwgb2YgY2hpbGRBcnJheShzZmNFbCwgJ3N0ZXAnKSkge1xuICAgIGNvbnN0IHN0ZXBJZCA9IGBzZmMtc3RlcC0ke2F0dHIoc3RlcEVsLCAnbG9jYWxJZCcpfWA7XG4gICAgZm9yIChjb25zdCBjb25uIG9mIGNoaWxkQXJyYXkoY2hpbGQoc3RlcEVsLCAnY29ubmVjdGlvblBvaW50T3V0JyksICdjb25uZWN0aW9uJykpIHtcbiAgICAgIGNvbnN0IHRvSWQgPSBhdHRyKGNvbm4sICdyZWZMb2NhbElkJyk7XG4gICAgICBpZiAodG9JZCkge1xuICAgICAgICBsaW5rcy5wdXNoKHtcbiAgICAgICAgICBpZDogYGxpbmstJHtzdGVwSWR9LSR7dG9JZH1gLFxuICAgICAgICAgIGZyb206IHN0ZXBJZCxcbiAgICAgICAgICB0bzogYHNmYy10cmFucy0ke3RvSWR9YCxcbiAgICAgICAgICB0eXBlOiAnc2ltcGxlJyxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgdHJhbnNFbCBvZiBjaGlsZEFycmF5KHNmY0VsLCAndHJhbnNpdGlvbicpKSB7XG4gICAgY29uc3QgdHJhbnNJZCA9IGBzZmMtdHJhbnMtJHthdHRyKHRyYW5zRWwsICdsb2NhbElkJyl9YDtcbiAgICBmb3IgKGNvbnN0IGNvbm4gb2YgY2hpbGRBcnJheShjaGlsZCh0cmFuc0VsLCAnY29ubmVjdGlvblBvaW50T3V0JyksICdjb25uZWN0aW9uJykpIHtcbiAgICAgIGNvbnN0IHRvSWQgPSBhdHRyKGNvbm4sICdyZWZMb2NhbElkJyk7XG4gICAgICBpZiAodG9JZCkge1xuICAgICAgICBsaW5rcy5wdXNoKHtcbiAgICAgICAgICBpZDogYGxpbmstJHt0cmFuc0lkfS0ke3RvSWR9YCxcbiAgICAgICAgICBmcm9tOiB0cmFuc0lkLFxuICAgICAgICAgIHRvOiBgc2ZjLXN0ZXAtJHt0b0lkfWAsXG4gICAgICAgICAgdHlwZTogJ3NpbXBsZScsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFNpbXVsdGFuZW91cyBkaXZlcmdlbmNlL2NvbnZlcmdlbmNlIChBTkQtc3BsaXQvam9pbilcbiAgZm9yIChjb25zdCBkaXZFbCBvZiBjaGlsZEFycmF5KHNmY0VsLCAnc2ltdWx0YW5lb3VzRGl2ZXJnZW5jZScpKSB7XG4gICAgY29uc3QgZGl2SWQgPSBhdHRyKGRpdkVsLCAnbG9jYWxJZCcpO1xuICAgIC8vIGNvbm5lY3Rpb25Qb2ludEluOiB3aGVyZSB0aGUgZGl2ZXJnZW5jZSByZWNlaXZlcyBmcm9tXG4gICAgY29uc3QgY3BJbiA9IGNoaWxkKGRpdkVsLCAnY29ubmVjdGlvblBvaW50SW4nKTtcbiAgICBpZiAoY3BJbikge1xuICAgICAgZm9yIChjb25zdCBjb25uIG9mIGNoaWxkQXJyYXkoY3BJbiwgJ2Nvbm5lY3Rpb24nKSkge1xuICAgICAgICBjb25zdCByZWZJZCA9IGF0dHIoY29ubiwgJ3JlZkxvY2FsSWQnKTtcbiAgICAgICAgaWYgKHJlZklkKSB7XG4gICAgICAgICAgbGlua3MucHVzaCh7IGlkOiBgbGluay0ke3JlZklkfS1zaW1EaXYtJHtkaXZJZH1gLCBmcm9tOiBgc2ZjLXRyYW5zLSR7cmVmSWR9YCwgdG86IGBzZmMtc2ltRGl2LSR7ZGl2SWR9YCwgdHlwZTogJ3NpbXVsdGFuZW91cy1kaXZlcmdlbmNlJyB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBjb25uZWN0aW9uUG9pbnRPdXQ6IGJyYW5jaGVzIGdvaW5nIHRvIHN0ZXBzL3RyYW5zaXRpb25zXG4gICAgZm9yIChjb25zdCBjcE91dCBvZiBjaGlsZEFycmF5KGRpdkVsLCAnY29ubmVjdGlvblBvaW50T3V0JykpIHtcbiAgICAgIGZvciAoY29uc3QgY29ubiBvZiBjaGlsZEFycmF5KGNwT3V0LCAnY29ubmVjdGlvbicpKSB7XG4gICAgICAgIGNvbnN0IHJlZklkID0gYXR0cihjb25uLCAncmVmTG9jYWxJZCcpO1xuICAgICAgICBpZiAocmVmSWQpIHtcbiAgICAgICAgICBsaW5rcy5wdXNoKHsgaWQ6IGBsaW5rLXNpbURpdi0ke2RpdklkfS0ke3JlZklkfWAsIGZyb206IGBzZmMtc2ltRGl2LSR7ZGl2SWR9YCwgdG86IGBzZmMtc3RlcC0ke3JlZklkfWAsIHR5cGU6ICdzaW11bHRhbmVvdXMtZGl2ZXJnZW5jZScgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IGNvbnZFbCBvZiBjaGlsZEFycmF5KHNmY0VsLCAnc2ltdWx0YW5lb3VzQ29udmVyZ2VuY2UnKSkge1xuICAgIGNvbnN0IGNvbnZJZCA9IGF0dHIoY29udkVsLCAnbG9jYWxJZCcpO1xuICAgIGZvciAoY29uc3QgY3BJbiBvZiBjaGlsZEFycmF5KGNvbnZFbCwgJ2Nvbm5lY3Rpb25Qb2ludEluJykpIHtcbiAgICAgIGZvciAoY29uc3QgY29ubiBvZiBjaGlsZEFycmF5KGNwSW4sICdjb25uZWN0aW9uJykpIHtcbiAgICAgICAgY29uc3QgcmVmSWQgPSBhdHRyKGNvbm4sICdyZWZMb2NhbElkJyk7XG4gICAgICAgIGlmIChyZWZJZCkge1xuICAgICAgICAgIGxpbmtzLnB1c2goeyBpZDogYGxpbmstJHtyZWZJZH0tc2ltQ29udi0ke2NvbnZJZH1gLCBmcm9tOiBgc2ZjLXRyYW5zLSR7cmVmSWR9YCwgdG86IGBzZmMtc2ltQ29udi0ke2NvbnZJZH1gLCB0eXBlOiAnc2ltdWx0YW5lb3VzLWNvbnZlcmdlbmNlJyB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGNwT3V0IG9mIGNoaWxkQXJyYXkoY29udkVsLCAnY29ubmVjdGlvblBvaW50T3V0JykpIHtcbiAgICAgIGZvciAoY29uc3QgY29ubiBvZiBjaGlsZEFycmF5KGNwT3V0LCAnY29ubmVjdGlvbicpKSB7XG4gICAgICAgIGNvbnN0IHJlZklkID0gYXR0cihjb25uLCAncmVmTG9jYWxJZCcpO1xuICAgICAgICBpZiAocmVmSWQpIHtcbiAgICAgICAgICBsaW5rcy5wdXNoKHsgaWQ6IGBsaW5rLXNpbUNvbnYtJHtjb252SWR9LSR7cmVmSWR9YCwgZnJvbTogYHNmYy1zaW1Db252LSR7Y29udklkfWAsIHRvOiBgc2ZjLXN0ZXAtJHtyZWZJZH1gLCB0eXBlOiAnc2ltdWx0YW5lb3VzLWNvbnZlcmdlbmNlJyB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFNlbGVjdGlvbiBkaXZlcmdlbmNlL2NvbnZlcmdlbmNlIChPUi1zcGxpdC9qb2luKVxuICBmb3IgKGNvbnN0IGRpdkVsIG9mIGNoaWxkQXJyYXkoc2ZjRWwsICdzZWxlY3Rpb25EaXZlcmdlbmNlJykpIHtcbiAgICBjb25zdCBkaXZJZCA9IGF0dHIoZGl2RWwsICdsb2NhbElkJyk7XG4gICAgY29uc3QgY3BJbiA9IGNoaWxkKGRpdkVsLCAnY29ubmVjdGlvblBvaW50SW4nKTtcbiAgICBpZiAoY3BJbikge1xuICAgICAgZm9yIChjb25zdCBjb25uIG9mIGNoaWxkQXJyYXkoY3BJbiwgJ2Nvbm5lY3Rpb24nKSkge1xuICAgICAgICBjb25zdCByZWZJZCA9IGF0dHIoY29ubiwgJ3JlZkxvY2FsSWQnKTtcbiAgICAgICAgaWYgKHJlZklkKSB7XG4gICAgICAgICAgbGlua3MucHVzaCh7IGlkOiBgbGluay0ke3JlZklkfS1zZWxEaXYtJHtkaXZJZH1gLCBmcm9tOiBgc2ZjLXN0ZXAtJHtyZWZJZH1gLCB0bzogYHNmYy1zZWxEaXYtJHtkaXZJZH1gLCB0eXBlOiAnc2VsZWN0aW9uLWRpdmVyZ2VuY2UnIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgY3BPdXQgb2YgY2hpbGRBcnJheShkaXZFbCwgJ2Nvbm5lY3Rpb25Qb2ludE91dCcpKSB7XG4gICAgICBmb3IgKGNvbnN0IGNvbm4gb2YgY2hpbGRBcnJheShjcE91dCwgJ2Nvbm5lY3Rpb24nKSkge1xuICAgICAgICBjb25zdCByZWZJZCA9IGF0dHIoY29ubiwgJ3JlZkxvY2FsSWQnKTtcbiAgICAgICAgaWYgKHJlZklkKSB7XG4gICAgICAgICAgbGlua3MucHVzaCh7IGlkOiBgbGluay1zZWxEaXYtJHtkaXZJZH0tJHtyZWZJZH1gLCBmcm9tOiBgc2ZjLXNlbERpdi0ke2RpdklkfWAsIHRvOiBgc2ZjLXRyYW5zLSR7cmVmSWR9YCwgdHlwZTogJ3NlbGVjdGlvbi1kaXZlcmdlbmNlJyB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgY29udkVsIG9mIGNoaWxkQXJyYXkoc2ZjRWwsICdzZWxlY3Rpb25Db252ZXJnZW5jZScpKSB7XG4gICAgY29uc3QgY29udklkID0gYXR0cihjb252RWwsICdsb2NhbElkJyk7XG4gICAgZm9yIChjb25zdCBjcEluIG9mIGNoaWxkQXJyYXkoY29udkVsLCAnY29ubmVjdGlvblBvaW50SW4nKSkge1xuICAgICAgZm9yIChjb25zdCBjb25uIG9mIGNoaWxkQXJyYXkoY3BJbiwgJ2Nvbm5lY3Rpb24nKSkge1xuICAgICAgICBjb25zdCByZWZJZCA9IGF0dHIoY29ubiwgJ3JlZkxvY2FsSWQnKTtcbiAgICAgICAgaWYgKHJlZklkKSB7XG4gICAgICAgICAgbGlua3MucHVzaCh7IGlkOiBgbGluay0ke3JlZklkfS1zZWxDb252LSR7Y29udklkfWAsIGZyb206IGBzZmMtdHJhbnMtJHtyZWZJZH1gLCB0bzogYHNmYy1zZWxDb252LSR7Y29udklkfWAsIHR5cGU6ICdzZWxlY3Rpb24tY29udmVyZ2VuY2UnIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgY3BPdXQgb2YgY2hpbGRBcnJheShjb252RWwsICdjb25uZWN0aW9uUG9pbnRPdXQnKSkge1xuICAgICAgZm9yIChjb25zdCBjb25uIG9mIGNoaWxkQXJyYXkoY3BPdXQsICdjb25uZWN0aW9uJykpIHtcbiAgICAgICAgY29uc3QgcmVmSWQgPSBhdHRyKGNvbm4sICdyZWZMb2NhbElkJyk7XG4gICAgICAgIGlmIChyZWZJZCkge1xuICAgICAgICAgIGxpbmtzLnB1c2goeyBpZDogYGxpbmstc2VsQ29udi0ke2NvbnZJZH0tJHtyZWZJZH1gLCBmcm9tOiBgc2ZjLXNlbENvbnYtJHtjb252SWR9YCwgdG86IGBzZmMtc3RlcC0ke3JlZklkfWAsIHR5cGU6ICdzZWxlY3Rpb24tY29udmVyZ2VuY2UnIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gUGFyc2UganVtcFN0ZXAgZWxlbWVudHNcbiAgZm9yIChjb25zdCBqdW1wRWwgb2YgY2hpbGRBcnJheShzZmNFbCwgJ2p1bXBTdGVwJykpIHtcbiAgICBjb25zdCBsb2NhbElkID0gYXR0cihqdW1wRWwsICdsb2NhbElkJyk7XG4gICAgY29uc3QgdGFyZ2V0TmFtZSA9IGF0dHIoanVtcEVsLCAndGFyZ2V0TmFtZScpIHx8ICcnO1xuICAgIGNvbnN0IHBvc0VsID0gY2hpbGQoanVtcEVsLCAncG9zaXRpb24nKTtcbiAgICBqdW1wcy5wdXNoKHtcbiAgICAgIGlkOiBgc2ZjLWp1bXAtJHtsb2NhbElkfWAsXG4gICAgICB0YXJnZXRTdGVwTmFtZTogdGFyZ2V0TmFtZSxcbiAgICAgIHBvc2l0aW9uOiB7IHg6IE51bWJlcihhdHRyKHBvc0VsLCAneCcpKSB8fCAwLCB5OiBOdW1iZXIoYXR0cihwb3NFbCwgJ3knKSkgfHwgMCB9LFxuICAgIH0pO1xuICAgIC8vIFdpcmUgaW5jb21pbmcgY29ubmVjdGlvbnMgdG8gdGhlIGp1bXBTdGVwXG4gICAgY29uc3QgY3BJbiA9IGNoaWxkKGp1bXBFbCwgJ2Nvbm5lY3Rpb25Qb2ludEluJyk7XG4gICAgaWYgKGNwSW4pIHtcbiAgICAgIGZvciAoY29uc3QgY29ubiBvZiBjaGlsZEFycmF5KGNwSW4sICdjb25uZWN0aW9uJykpIHtcbiAgICAgICAgY29uc3QgcmVmSWQgPSBhdHRyKGNvbm4sICdyZWZMb2NhbElkJyk7XG4gICAgICAgIGlmIChyZWZJZCkge1xuICAgICAgICAgIGxpbmtzLnB1c2goe1xuICAgICAgICAgICAgaWQ6IGBsaW5rLSR7cmVmSWR9LWp1bXAtJHtsb2NhbElkfWAsXG4gICAgICAgICAgICBmcm9tOiBgc2ZjLXRyYW5zLSR7cmVmSWR9YCxcbiAgICAgICAgICAgIHRvOiBgc2ZjLWp1bXAtJHtsb2NhbElkfWAsXG4gICAgICAgICAgICB0eXBlOiAnc2ltcGxlJyxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEJ1aWxkIGJyYW5jaGVzIGZyb20gbGluayB0b3BvbG9neVxuICBjb25zdCBicmFuY2hlczogU0ZDQnJhbmNoW10gPSBbXTtcbiAgY29uc3QgY29udkJhcklkcyA9IG5ldyBTZXQobGlua3MuZmxhdE1hcChsID0+IFtsLmZyb20sIGwudG9dKS5maWx0ZXIoaWQgPT4gL15zZmMtKHNpbUNvbnZ8c2VsQ29udiktLy50ZXN0KGlkKSkpO1xuXG4gIGZvciAoY29uc3QgbGluayBvZiBsaW5rcykge1xuICAgIGlmICghbGluay50eXBlLmluY2x1ZGVzKCdkaXZlcmdlbmNlJykpIGNvbnRpbnVlO1xuICAgIGNvbnN0IGRpdkJhcklkID0gbGluay50bztcbiAgICBpZiAoIWRpdkJhcklkLm1hdGNoKC9ec2ZjLShzaW1EaXZ8c2VsRGl2KS0vKSkgY29udGludWU7XG5cbiAgICBjb25zdCBpc1NpbXVsdGFuZW91cyA9IGRpdkJhcklkLnN0YXJ0c1dpdGgoJ3NmYy1zaW1EaXYtJyk7XG4gICAgY29uc3QgbWF0Y2hpbmdDb252UHJlZml4ID0gaXNTaW11bHRhbmVvdXMgPyAnc2ZjLXNpbUNvbnYtJyA6ICdzZmMtc2VsQ29udi0nO1xuXG4gICAgY29uc3QgdXBzdHJlYW1JZHMgPSBsaW5rcy5maWx0ZXIobCA9PiBsLnRvID09PSBkaXZCYXJJZCkubWFwKGwgPT4gbC5mcm9tKTtcbiAgICBjb25zdCBicmFuY2hIZWFkSWRzID0gbGlua3MuZmlsdGVyKGwgPT4gbC5mcm9tID09PSBkaXZCYXJJZCkubWFwKGwgPT4gbC50byk7XG5cbiAgICBjb25zdCBicmFuY2hTdGVwQXJyYXlzOiBzdHJpbmdbXVtdID0gYnJhbmNoSGVhZElkcy5tYXAoaGVhZElkID0+IHtcbiAgICAgIGNvbnN0IGNoYWluOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgbGV0IGN1ciA9IGhlYWRJZDtcbiAgICAgIGZvciAobGV0IGRlcHRoID0gMDsgZGVwdGggPCAyMDsgZGVwdGgrKykge1xuICAgICAgICBjaGFpbi5wdXNoKGN1cik7XG4gICAgICAgIGNvbnN0IG5leHQgPSBsaW5rcy5maW5kKGwgPT4gbC5mcm9tID09PSBjdXIgJiYgbC50eXBlID09PSAnc2ltcGxlJyk7XG4gICAgICAgIGlmICghbmV4dCkgYnJlYWs7XG4gICAgICAgIGN1ciA9IG5leHQudG87XG4gICAgICAgIGlmIChbLi4uY29udkJhcklkc10uc29tZShjYklkID0+IG5leHQudG8gPT09IGNiSWQpKSBicmVhaztcbiAgICAgIH1cbiAgICAgIHJldHVybiBjaGFpbi5maWx0ZXIoaWQgPT4gaWQuc3RhcnRzV2l0aCgnc2ZjLXN0ZXAtJykpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgY29udkJhcklkID0gWy4uLmNvbnZCYXJJZHNdLmZpbmQoY2JJZCA9PiBjYklkLnN0YXJ0c1dpdGgobWF0Y2hpbmdDb252UHJlZml4KSkgPz8gJyc7XG4gICAgY29uc3QgZG93bnN0cmVhbUlkcyA9IGxpbmtzLmZpbHRlcihsID0+IGwuZnJvbSA9PT0gY29udkJhcklkKS5tYXAobCA9PiBsLnRvKTtcblxuICAgIGlmICghYnJhbmNoZXMuZmluZChiID0+IGIuaWQgPT09IGBicmFuY2gtJHtkaXZCYXJJZH1gKSkge1xuICAgICAgYnJhbmNoZXMucHVzaCh7XG4gICAgICAgIGlkOiBgYnJhbmNoLSR7ZGl2QmFySWR9YCxcbiAgICAgICAgdHlwZTogaXNTaW11bHRhbmVvdXMgPyAnQU5EJyA6ICdPUicsXG4gICAgICAgIGRpdmVyZ2luZ0Zyb21UcmFuc0lkOiB1cHN0cmVhbUlkc1swXSB8fCAnJyxcbiAgICAgICAgYnJhbmNoU3RlcElkczogYnJhbmNoU3RlcEFycmF5cyxcbiAgICAgICAgY29udmVyZ2luZ1RvVHJhbnNJZDogZG93bnN0cmVhbUlkc1swXSB8fCAnJyxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7IHN0ZXBzLCB0cmFuc2l0aW9ucywgbGlua3MsIGJyYW5jaGVzLCBqdW1wcyB9O1xufVxuXG5mdW5jdGlvbiBwYXJzZUFjdGlvbnMoc3RlcEVsOiB1bmtub3duLCB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10pOiBTRkNBY3Rpb25bXSB7XG4gIGNvbnN0IGFjdGlvbnM6IFNGQ0FjdGlvbltdID0gW107XG4gIGNvbnN0IHF1YWxpZmllcnM6IEFjdGlvblF1YWxpZmllcltdID0gWydOJywnUycsJ1InLCdQJywnUDEnLCdQMCcsJ0wnLCdEJywnU0QnLCdEUycsJ1NMJ107XG4gIGZvciAoY29uc3QgYWN0aW9uRWwgb2YgY2hpbGRBcnJheShzdGVwRWwsICdhY3Rpb25CbG9jaycpLmZsYXRNYXAoYWIgPT4gY2hpbGRBcnJheShhYiwgJ2FjdGlvbicpKSkge1xuICAgIGNvbnN0IHF1YWwgPSBhdHRyKGFjdGlvbkVsLCAncXVhbGlmaWVyJykgYXMgQWN0aW9uUXVhbGlmaWVyO1xuICAgIGNvbnN0IHJlZkVsID0gY2hpbGQoYWN0aW9uRWwsICdyZWZlcmVuY2UnKTtcbiAgICBjb25zdCB0YWdOYW1lID0gYXR0cihyZWZFbCwgJ25hbWUnKSB8fCBhdHRyKGFjdGlvbkVsLCAnbmFtZScpO1xuICAgIGlmICghdGFnTmFtZSkgY29udGludWU7XG4gICAgYWN0aW9ucy5wdXNoKHtcbiAgICAgIGlkOiBgYWN0aW9uLSR7dGFnTmFtZX0tJHtxdWFsfWAsXG4gICAgICBxdWFsaWZpZXI6IHF1YWxpZmllcnMuaW5jbHVkZXMocXVhbCkgPyBxdWFsIDogJ04nLFxuICAgICAgdGFnOiB7IG5hbWU6IHRhZ05hbWUsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgIGR1cmF0aW9uOiBhdHRyKGFjdGlvbkVsLCAnZHVyYXRpb24nKSB8fCB1bmRlZmluZWQsXG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIGFjdGlvbnM7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBFeHBvcnQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBmdW5jdGlvbiBleHBvcnRQTENvcGVuKHByb2plY3Q6IE5vcm1hbGl6ZWRQcm9qZWN0KTogRXhwb3J0UmVzdWx0IHtcbiAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcblxuICBjb25zdCBwb3VzWG1sID0gcHJvamVjdC5wb3VzLm1hcChwb3UgPT4gYnVpbGRQT1VYbWwocG91LCB3YXJuaW5ncykpO1xuXG4gIGNvbnN0IGdsb2JhbFZhcnNYbWwgPSBwcm9qZWN0Lmdsb2JhbFRhZ3MubGVuZ3RoID4gMCA/IHtcbiAgICBjb25maWd1cmF0aW9uOiB7XG4gICAgICAnQF9uYW1lJzogJ0NvbmZpZzAnLFxuICAgICAgZ2xvYmFsVmFyczoge1xuICAgICAgICAnQF9uYW1lJzogJ0dWTCcsXG4gICAgICAgIHZhcmlhYmxlOiBwcm9qZWN0Lmdsb2JhbFRhZ3MubWFwKHRhZ1RvVmFyWG1sKSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSA6IHt9O1xuXG4gIGNvbnN0IG9iaiA9IHtcbiAgICBwcm9qZWN0OiB7XG4gICAgICAnQF94bWxucyc6ICdodHRwOi8vd3d3LnBsY29wZW4ub3JnL3htbC90YzZfMDIwMScsXG4gICAgICAnQF94bWxuczp4c2knOiAnaHR0cDovL3d3dy53My5vcmcvMjAwMS9YTUxTY2hlbWEtaW5zdGFuY2UnLFxuICAgICAgJ0BfeG1sbnM6eGh0bWwnOiAnaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbCcsXG4gICAgICAnQF94c2k6c2NoZW1hTG9jYXRpb24nOiAnaHR0cDovL3d3dy5wbGNvcGVuLm9yZy94bWwvdGM2XzAyMDEgaHR0cDovL3d3dy5wbGNvcGVuLm9yZy94bWwvdGM2XzAyMDEvdGM2X3htbF92MjAxLnhzZCcsXG4gICAgICBmaWxlSGVhZGVyOiB7XG4gICAgICAgICdAX2NvbXBhbnlOYW1lJzogJ1BsYXhpbycsXG4gICAgICAgICdAX3Byb2R1Y3ROYW1lJzogJ1BsYXhpbycsXG4gICAgICAgICdAX3Byb2R1Y3RWZXJzaW9uJzogJzEuMCcsXG4gICAgICAgICdAX2NyZWF0aW9uRGF0ZVRpbWUnOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICB9LFxuICAgICAgY29udGVudEhlYWRlcjoge1xuICAgICAgICAnQF9uYW1lJzogcHJvamVjdC5wcm9qZWN0TmFtZSxcbiAgICAgICAgJ0BfdmVyc2lvbic6ICcxLjAuMCcsXG4gICAgICAgIGNvb3JkaW5hdGVJbmZvOiB7XG4gICAgICAgICAgZmJkOiB7IHNjYWxpbmc6IHsgJ0BfeCc6ICcxJywgJ0BfeSc6ICcxJyB9IH0sXG4gICAgICAgICAgbGQ6ICB7IHNjYWxpbmc6IHsgJ0BfeCc6ICcxJywgJ0BfeSc6ICcxJyB9IH0sXG4gICAgICAgICAgc2ZjOiB7IHNjYWxpbmc6IHsgJ0BfeCc6ICcxJywgJ0BfeSc6ICcxJyB9IH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgdHlwZXM6IHsgcG91czogeyBwb3U6IHBvdXNYbWwgfSB9LFxuICAgICAgaW5zdGFuY2VzOiBnbG9iYWxWYXJzWG1sLFxuICAgIH0sXG4gIH07XG5cbiAgcmV0dXJuIHsgb2s6IHRydWUsIHhtbENvbnRlbnQ6IGJ1aWxkWE1MKG9iaiksIGVycm9ycywgd2FybmluZ3MgfTtcbn1cblxuZnVuY3Rpb24gYnVpbGRQT1VYbWwocG91OiBOb3JtYWxpemVkUE9VLCB3YXJuaW5nczogc3RyaW5nW10pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIGNvbnN0IHJldHVyblR5cGVUYWcgPSBwb3UubG9jYWxUYWdzLmZpbmQodCA9PiB0Lm5hbWUgPT09ICdfX3JldHVyblR5cGVfXycpO1xuICBjb25zdCBpbnRlcmZhY2VWYXJzID0gcG91LmxvY2FsVGFncy5maWx0ZXIodCA9PiB0Lm5hbWUgIT09ICdfX3JldHVyblR5cGVfXycpLm1hcCh0YWdUb1ZhclhtbCk7XG4gIGNvbnN0IGJvZHlDb250ZW50ID0gYnVpbGRCb2R5WG1sKHBvdSwgd2FybmluZ3MpO1xuXG4gIGNvbnN0IGlmYWNlOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICBsb2NhbFZhcnM6IHsgdmFyaWFibGU6IGludGVyZmFjZVZhcnMgfSxcbiAgfTtcbiAgaWYgKHJldHVyblR5cGVUYWcpIHtcbiAgICBpZmFjZS5yZXR1cm5UeXBlID0geyBbcmV0dXJuVHlwZVRhZy5kYXRhVHlwZV06IHt9IH07XG4gIH1cblxuICByZXR1cm4ge1xuICAgICdAX25hbWUnOiBwb3UubmFtZSxcbiAgICAnQF9wb3VUeXBlJzogcG91LnBvdVR5cGUgfHwgKHBvdS5sYW5ndWFnZSA9PT0gJ0ZCRCcgfHwgcG91Lmxhbmd1YWdlID09PSAnU0ZDJyA/ICdmdW5jdGlvbkJsb2NrJyA6ICdwcm9ncmFtJyksXG4gICAgaW50ZXJmYWNlOiBpZmFjZSxcbiAgICBib2R5OiBib2R5Q29udGVudCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gYnVpbGRCb2R5WG1sKHBvdTogTm9ybWFsaXplZFBPVSwgd2FybmluZ3M6IHN0cmluZ1tdKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICBpZiAocG91Lmxhbmd1YWdlID09PSAnTEQnICYmIHBvdS5sYWRkZXJQcm9ncmFtKSB7XG4gICAgcmV0dXJuIHsgTEQ6IGJ1aWxkTERYbWwocG91LmxhZGRlclByb2dyYW0pIH07XG4gIH1cbiAgaWYgKHBvdS5sYW5ndWFnZSA9PT0gJ0ZCRCcgJiYgcG91LmZiZFByb2dyYW0pIHtcbiAgICByZXR1cm4geyBGQkQ6IGJ1aWxkRkJEWG1sKHBvdS5mYmRQcm9ncmFtKSB9O1xuICB9XG4gIGlmIChwb3UubGFuZ3VhZ2UgPT09ICdTRkMnICYmIHBvdS5zZmNQcm9ncmFtKSB7XG4gICAgcmV0dXJuIHsgU0ZDOiBidWlsZFNGQ1htbChwb3Uuc2ZjUHJvZ3JhbSkgfTtcbiAgfVxuICBpZiAocG91Lmxhbmd1YWdlID09PSAnU1QnICYmIHBvdS5zdFNvdXJjZSkge1xuICAgIGNvbnN0IGxpbmVzID0gcG91LnN0U291cmNlLnNwbGl0KCdcXG4nKTtcbiAgICByZXR1cm4geyBTVDogeyAneGh0bWw6cCc6IGxpbmVzLmxlbmd0aCA9PT0gMSA/IGxpbmVzWzBdIDogbGluZXMgfSB9O1xuICB9XG4gIHdhcm5pbmdzLnB1c2goYFBPVSBcIiR7cG91Lm5hbWV9XCI6IG5vIHByb2dyYW0gZGF0YSBcdTIwMTQgZW1wdHkgYm9keWApO1xuICByZXR1cm4geyBTVDogeyAneGh0bWw6cCc6ICcoKiBlbXB0eSAqKScgfSB9O1xufVxuXG5mdW5jdGlvbiBidWlsZExEWG1sKGxhZGRlcjogTGFkZGVyUHJvZ3JhbSk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBydW5nOiBsYWRkZXIucnVuZ3MubWFwKChydW5nLCByaSkgPT4gKHtcbiAgICAgICdAX2xvY2FsSWQnOiBTdHJpbmcocmkgKyAxKSxcbiAgICAgIGNvbW1lbnQ6IHJ1bmcuY29tbWVudCB8fCB1bmRlZmluZWQsXG4gICAgICAuLi5idWlsZFJ1bmdFbGVtZW50c1htbChydW5nKSxcbiAgICB9KSksXG4gIH07XG59XG5cbmZ1bmN0aW9uIGJ1aWxkUnVuZ0VsZW1lbnRzWG1sKHJ1bmc6IFJ1bmcpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duW10+IHtcbiAgY29uc3QgY29udGFjdHM6IHVua25vd25bXSA9IFtdO1xuICBjb25zdCBjb2lsczogdW5rbm93bltdID0gW107XG4gIGNvbnN0IGJsb2NrczogdW5rbm93bltdID0gW107XG4gIC8vIGxlZnRQb3dlclJhaWwgZ2V0cyBsb2NhbElkPTE7IGVsZW1lbnRzIHN0YXJ0IGF0IDJcbiAgbGV0IGlkID0gMjtcbiAgY29uc3QgbGVmdFJhaWxMb2NhbElkID0gMTtcblxuICBmdW5jdGlvbiBlbWl0RWxlbWVudChlbDogTGFkZGVyRWxlbWVudCwgcHJldlJlZklkOiBudW1iZXIpOiBudW1iZXIge1xuICAgIGNvbnN0IGxvY2FsSWQgPSBpZCsrO1xuICAgIGlmIChlbC5raW5kID09PSAnY29udGFjdCcpIHtcbiAgICAgIGNvbnN0IGMgPSBlbCBhcyBDb250YWN0RWxlbWVudDtcbiAgICAgIGNvbnN0IG9iajogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgICAgICdAX2xvY2FsSWQnOiBTdHJpbmcobG9jYWxJZCksXG4gICAgICAgICdAX25lZ2F0ZWQnOiBjLnR5cGUgPT09ICdOQycgPyAndHJ1ZScgOiAnZmFsc2UnLFxuICAgICAgICAnQF9lZGdlJzogYy50eXBlID09PSAnUF9DT05UQUNUJyA/ICdyaXNpbmcnIDogYy50eXBlID09PSAnTl9DT05UQUNUJyA/ICdmYWxsaW5nJyA6IHVuZGVmaW5lZCxcbiAgICAgICAgdmFyaWFibGU6IGMudGFnLm5hbWUsXG4gICAgICAgIHBvc2l0aW9uOiB7ICdAX3gnOiBlbC5wb3NpdGlvbj8ueCA/PyAwLCAnQF95JzogZWwucG9zaXRpb24/LnkgPz8gMCB9LFxuICAgICAgICBjb25uZWN0aW9uUG9pbnRJbjogeyBjb25uZWN0aW9uOiB7ICdAX3JlZkxvY2FsSWQnOiBTdHJpbmcocHJldlJlZklkKSB9IH0sXG4gICAgICAgIGNvbm5lY3Rpb25Qb2ludE91dDogeyByZWxQb3NpdGlvbjogeyAnQF94JzogJzAnLCAnQF95JzogJzAnIH0gfSxcbiAgICAgIH07XG4gICAgICBjb250YWN0cy5wdXNoKG9iaik7XG4gICAgfSBlbHNlIGlmIChlbC5raW5kID09PSAnY29pbCcpIHtcbiAgICAgIGNvbnN0IGMgPSBlbCBhcyBDb2lsRWxlbWVudDtcbiAgICAgIGNvbnN0IHN0b3JhZ2UgPSBjLnR5cGUgPT09ICdzZXQnID8gJ3NldCcgOiBjLnR5cGUgPT09ICdyZXNldCcgPyAncmVzZXQnIDogYy50eXBlID09PSAnbGF0Y2gnID8gJ3JldGVudGl2ZScgOiB1bmRlZmluZWQ7XG4gICAgICBjb25zdCBlZGdlID0gKGMudHlwZSBhcyBzdHJpbmcpID09PSAncG9zaXRpdmVfdHJhbnNpdGlvbicgPyAncmlzaW5nJyA6IChjLnR5cGUgYXMgc3RyaW5nKSA9PT0gJ25lZ2F0aXZlX3RyYW5zaXRpb24nID8gJ2ZhbGxpbmcnIDogdW5kZWZpbmVkO1xuICAgICAgY29uc3Qgb2JqOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAgICAgJ0BfbG9jYWxJZCc6IFN0cmluZyhsb2NhbElkKSxcbiAgICAgICAgJ0BfbmVnYXRlZCc6IGMudHlwZSA9PT0gJ25lZ2F0ZWQnID8gJ3RydWUnIDogJ2ZhbHNlJyxcbiAgICAgICAgJ0Bfc3RvcmFnZSc6IHN0b3JhZ2UsXG4gICAgICAgICdAX2VkZ2UnOiBlZGdlLFxuICAgICAgICB2YXJpYWJsZTogYy50YWcubmFtZSxcbiAgICAgICAgcG9zaXRpb246IHsgJ0BfeCc6IGVsLnBvc2l0aW9uPy54ID8/IDAsICdAX3knOiBlbC5wb3NpdGlvbj8ueSA/PyAwIH0sXG4gICAgICAgIGNvbm5lY3Rpb25Qb2ludEluOiB7IGNvbm5lY3Rpb246IHsgJ0BfcmVmTG9jYWxJZCc6IFN0cmluZyhwcmV2UmVmSWQpIH0gfSxcbiAgICAgIH07XG4gICAgICBjb2lscy5wdXNoKG9iaik7XG4gICAgfSBlbHNlIGlmIChlbC5raW5kID09PSAnYmxvY2snKSB7XG4gICAgICBjb25zdCBiID0gZWwgYXMgQmxvY2tFbGVtZW50O1xuICAgICAgY29uc3QgZmJUeXBlTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0geyBUT046J1RPTicsVE9GOidUT0YnLFRQOidUUCcsQ1RVOidDVFUnLENURDonQ1REJyxDVFVEOidDVFVEJyxTUjonU1InLFJTOidSUycsUlRSSUc6J1JfVFJJRycsRlRSSUc6J0ZfVFJJRycgfTtcbiAgICAgIC8vIEJ1aWxkIGlucHV0VmFyaWFibGVzIC8gb3V0cHV0VmFyaWFibGVzIGZyb20gcGluc1xuICAgICAgY29uc3QgaW5wdXRWYXJzID0gT2JqZWN0LmVudHJpZXMoYi5waW5zIHx8IHt9KVxuICAgICAgICAuZmlsdGVyKChbcGluTmFtZV0pID0+ICFbJ09VVCcsJ1EnLCdRMScsJ0NWJywnRVQnXS5pbmNsdWRlcyhwaW5OYW1lKSlcbiAgICAgICAgLm1hcCgoW3Bpbk5hbWUsIHRhZ1JlZl0pID0+ICh7XG4gICAgICAgICAgdmFyaWFibGU6IHtcbiAgICAgICAgICAgICdAX2Zvcm1hbFBhcmFtZXRlcic6IHBpbk5hbWUsXG4gICAgICAgICAgICAnQF9uZWdhdGVkJzogJ2ZhbHNlJyxcbiAgICAgICAgICAgIGNvbm5lY3Rpb25Qb2ludEluOiB7IGNvbm5lY3Rpb246IHsgJ0BfcmVmTG9jYWxJZCc6IFN0cmluZyhwcmV2UmVmSWQpIH0gfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KSk7XG4gICAgICBjb25zdCBvdXRwdXRWYXJzID0gT2JqZWN0LmVudHJpZXMoYi5waW5zIHx8IHt9KVxuICAgICAgICAuZmlsdGVyKChbcGluTmFtZV0pID0+IFsnT1VUJywnUScsJ1ExJywnQ1YnLCdFVCddLmluY2x1ZGVzKHBpbk5hbWUpKVxuICAgICAgICAubWFwKChbcGluTmFtZSwgdGFnUmVmXSkgPT4gKHtcbiAgICAgICAgICB2YXJpYWJsZToge1xuICAgICAgICAgICAgJ0BfZm9ybWFsUGFyYW1ldGVyJzogcGluTmFtZSxcbiAgICAgICAgICAgICdAX25lZ2F0ZWQnOiAnZmFsc2UnLFxuICAgICAgICAgICAgY29ubmVjdGlvblBvaW50T3V0OiB7IHJlbFBvc2l0aW9uOiB7ICdAX3gnOiAnMCcsICdAX3knOiAnMCcgfSB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pKTtcbiAgICAgIGNvbnN0IG9iajogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgICAgICdAX2xvY2FsSWQnOiBTdHJpbmcobG9jYWxJZCksXG4gICAgICAgICdAX3R5cGVOYW1lJzogZmJUeXBlTWFwW2IuZmJUeXBlXSB8fCBiLmZiVHlwZSxcbiAgICAgICAgJ0BfaW5zdGFuY2VOYW1lJzogYi5pbnN0YW5jZU5hbWUsXG4gICAgICAgIHBvc2l0aW9uOiB7ICdAX3gnOiBlbC5wb3NpdGlvbj8ueCA/PyAwLCAnQF95JzogZWwucG9zaXRpb24/LnkgPz8gMCB9LFxuICAgICAgICBpbnB1dFZhcmlhYmxlczogaW5wdXRWYXJzLmxlbmd0aCA/IHsgdmFyaWFibGU6IGlucHV0VmFycy5tYXAoaXYgPT4gaXYudmFyaWFibGUpIH0gOiB1bmRlZmluZWQsXG4gICAgICAgIG91dHB1dFZhcmlhYmxlczogb3V0cHV0VmFycy5sZW5ndGggPyB7IHZhcmlhYmxlOiBvdXRwdXRWYXJzLm1hcChvdiA9PiBvdi52YXJpYWJsZSkgfSA6IHVuZGVmaW5lZCxcbiAgICAgICAgaW5PdXRWYXJpYWJsZXM6IHt9LFxuICAgICAgfTtcbiAgICAgIGJsb2Nrcy5wdXNoKG9iaik7XG4gICAgfVxuICAgIHJldHVybiBsb2NhbElkO1xuICB9XG5cbiAgLy8gRW1pdCBtYWluIGVsZW1lbnRzIGluIHNlcmllcyBzdGFydGluZyBmcm9tIGxlZnRSYWlsXG4gIGxldCBwcmV2SWQ6IG51bWJlciA9IGxlZnRSYWlsTG9jYWxJZDtcbiAgZm9yIChjb25zdCBlbCBvZiBydW5nLmVsZW1lbnRzKSB7XG4gICAgcHJldklkID0gZW1pdEVsZW1lbnQoZWwsIHByZXZJZCk7XG4gIH1cblxuICAvLyBFbWl0IGJyYW5jaCBlbGVtZW50cyBcdTIwMTQgZWFjaCBicmFuY2ggc3RhcnRzIGZyb20gdGhlIGxlZnQgcmFpbFxuICBpZiAocnVuZy5icmFuY2hlcyAmJiBydW5nLmJyYW5jaGVzLmxlbmd0aCA+IDApIHtcbiAgICBmb3IgKGNvbnN0IGJyYW5jaCBvZiBydW5nLmJyYW5jaGVzKSB7XG4gICAgICBsZXQgYnJhbmNoUHJldjogbnVtYmVyID0gbGVmdFJhaWxMb2NhbElkO1xuICAgICAgZm9yIChjb25zdCBlbCBvZiBicmFuY2guZWxlbWVudHMpIHtcbiAgICAgICAgYnJhbmNoUHJldiA9IGVtaXRFbGVtZW50KGVsLCBicmFuY2hQcmV2KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjb25zdCBsZWZ0UmFpbDogdW5rbm93biA9IHtcbiAgICAnQF9sb2NhbElkJzogU3RyaW5nKGxlZnRSYWlsTG9jYWxJZCksXG4gICAgJ0Bfd2lkdGgnOiAnMTAnLFxuICAgIHBvc2l0aW9uOiB7ICdAX3gnOiAwLCAnQF95JzogMCB9LFxuICAgIGNvbm5lY3Rpb25Qb2ludE91dDogeyBjb25uZWN0aW9uOiBbXSB9LFxuICB9O1xuXG4gIC8vIHJpZ2h0UG93ZXJSYWlsIGdldHMgdGhlIG5leHQgbG9jYWxJZDsgaXQgY29ubmVjdHMgZnJvbSB0aGUgbGFzdCBlbWl0dGVkIGNvaWwgKHByZXZJZClcbiAgY29uc3QgcmlnaHRSYWlsTG9jYWxJZCA9IGlkKys7XG4gIGNvbnN0IHJpZ2h0UmFpbDogdW5rbm93biA9IHtcbiAgICAnQF9sb2NhbElkJzogU3RyaW5nKHJpZ2h0UmFpbExvY2FsSWQpLFxuICAgICdAX3dpZHRoJzogJzEwJyxcbiAgICBwb3NpdGlvbjogeyAnQF94JzogMCwgJ0BfeSc6IDAgfSxcbiAgICBjb25uZWN0aW9uUG9pbnRJbjogeyBjb25uZWN0aW9uOiB7ICdAX3JlZkxvY2FsSWQnOiBTdHJpbmcocHJldklkKSB9IH0sXG4gIH07XG5cbiAgY29uc3QgcmVzdWx0OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duW10+ID0ge307XG4gIHJlc3VsdC5sZWZ0UG93ZXJSYWlsID0gW2xlZnRSYWlsXTtcbiAgaWYgKGNvbnRhY3RzLmxlbmd0aCkgcmVzdWx0LmNvbnRhY3QgPSBjb250YWN0cztcbiAgaWYgKGNvaWxzLmxlbmd0aCkgcmVzdWx0LmNvaWwgPSBjb2lscztcbiAgaWYgKGJsb2Nrcy5sZW5ndGgpIHJlc3VsdC5ibG9jayA9IGJsb2NrcztcbiAgcmVzdWx0LnJpZ2h0UG93ZXJSYWlsID0gW3JpZ2h0UmFpbF07XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8vIFN0cmlwIGltcG9ydC10aW1lIHByZWZpeGVzIHNvIHJlLWV4cG9ydGVkIGxvY2FsSWRzIGFyZSBjbGVhbiBpbnRlZ2Vyc1xuZnVuY3Rpb24gY2xlYW5Mb2NhbElkKGlkOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gaWQucmVwbGFjZSgvXihmYmQtdmFyLXxmYmQtYmxvY2stfGZiZC18c3QtZmJkLXZhci18c3QtZmJkLSkvLCAnJyk7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkRkJEWG1sKGZiZDogRkJEUHJvZ3JhbSk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgLy8gQnVpbGQgYSB3aXJlIGxvb2t1cDogdGFyZ2V0IG5vZGVJZCtwaW4gXHUyMTkyIHNvdXJjZSBub2RlSWQrcGluXG4gIGNvbnN0IHdpcmVzQnlUYXJnZXQgPSBuZXcgTWFwPHN0cmluZywgeyByZWZMb2NhbElkOiBzdHJpbmc7IGZvcm1hbFBhcmFtZXRlcjogc3RyaW5nIH1bXT4oKTtcbiAgZm9yIChjb25zdCB3IG9mIGZiZC53aXJlcykge1xuICAgIGNvbnN0IGtleSA9IGAke3cudG8ubm9kZUlkfTo6JHt3LnRvLnBpbn1gO1xuICAgIGlmICghd2lyZXNCeVRhcmdldC5oYXMoa2V5KSkgd2lyZXNCeVRhcmdldC5zZXQoa2V5LCBbXSk7XG4gICAgd2lyZXNCeVRhcmdldC5nZXQoa2V5KSEucHVzaCh7IHJlZkxvY2FsSWQ6IHcuZnJvbS5ub2RlSWQsIGZvcm1hbFBhcmFtZXRlcjogdy5mcm9tLnBpbiB9KTtcbiAgfVxuXG4gIGNvbnN0IGJsb2NrcyA9IGZiZC5ub2Rlc1xuICAgIC5maWx0ZXIobiA9PiBuLnR5cGUgIT09ICdJTl9WQVJJQUJMRScgJiYgbi50eXBlICE9PSAnT1VUX1ZBUklBQkxFJyAmJiBuLnR5cGUgIT09ICdJTl9PVVRfVkFSSUFCTEUnXG4gICAgICAmJiBuLnR5cGUgIT09ICdMQUJFTCcgJiYgbi50eXBlICE9PSAnSlVNUCcgJiYgbi50eXBlICE9PSAnUkVUVVJOJ1xuICAgICAgJiYgbi50eXBlICE9PSAnQ09OTkVDVE9SJyAmJiBuLnR5cGUgIT09ICdDT05USU5VQVRJT04nKVxuICAgIC5tYXAobiA9PiB7XG4gICAgICBjb25zdCBpbnB1dFZhcmlhYmxlcyA9IChuLmlucHV0cyB8fCBbXSkubWFwKHBpbiA9PiB7XG4gICAgICAgIGNvbnN0IGNvbm5zID0gd2lyZXNCeVRhcmdldC5nZXQoYCR7bi5pZH06OiR7cGluLm5hbWV9YCkgfHwgW107XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdmFyaWFibGU6IHtcbiAgICAgICAgICAgICdAX2Zvcm1hbFBhcmFtZXRlcic6IHBpbi5uYW1lLFxuICAgICAgICAgICAgJ0BfbmVnYXRlZCc6IHBpbi5uZWdhdGVkID8gJ3RydWUnIDogJ2ZhbHNlJyxcbiAgICAgICAgICAgIC4uLihjb25ucy5sZW5ndGggPiAwID8ge1xuICAgICAgICAgICAgICBjb25uZWN0aW9uUG9pbnRJbjoge1xuICAgICAgICAgICAgICAgIGNvbm5lY3Rpb246IGNvbm5zLm1hcChjID0+ICh7XG4gICAgICAgICAgICAgICAgICAnQF9yZWZMb2NhbElkJzogYy5yZWZMb2NhbElkLFxuICAgICAgICAgICAgICAgICAgJ0BfZm9ybWFsUGFyYW1ldGVyJzogYy5mb3JtYWxQYXJhbWV0ZXIsXG4gICAgICAgICAgICAgICAgfSkpLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSA6IHt9KSxcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IG91dHB1dFZhcmlhYmxlcyA9IChuLm91dHB1dHMgfHwgW10pLm1hcChwaW4gPT4gKHtcbiAgICAgICAgdmFyaWFibGU6IHtcbiAgICAgICAgICAnQF9mb3JtYWxQYXJhbWV0ZXInOiBwaW4ubmFtZSxcbiAgICAgICAgICAnQF9uZWdhdGVkJzogcGluLm5lZ2F0ZWQgPyAndHJ1ZScgOiAnZmFsc2UnLFxuICAgICAgICAgIGNvbm5lY3Rpb25Qb2ludE91dDogeyByZWxQb3NpdGlvbjogeyAnQF94JzogJzAnLCAnQF95JzogJzAnIH0gfSxcbiAgICAgICAgfSxcbiAgICAgIH0pKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgJ0BfbG9jYWxJZCc6IGNsZWFuTG9jYWxJZChuLmlkKSxcbiAgICAgICAgJ0BfdHlwZU5hbWUnOiBuLnR5cGUsXG4gICAgICAgICdAX2luc3RhbmNlTmFtZSc6IG4uaW5zdGFuY2VOYW1lIHx8IGNsZWFuTG9jYWxJZChuLmlkKSxcbiAgICAgICAgJ0BfZXhlY3V0aW9uT3JkZXJJZCc6IChuIGFzIGFueSkuZXhlY3V0aW9uT3JkZXJJZCAhPSBudWxsID8gU3RyaW5nKChuIGFzIGFueSkuZXhlY3V0aW9uT3JkZXJJZCkgOiB1bmRlZmluZWQsXG4gICAgICAgIHBvc2l0aW9uOiB7ICdAX3gnOiBuLnBvc2l0aW9uLngsICdAX3knOiBuLnBvc2l0aW9uLnkgfSxcbiAgICAgICAgaW5wdXRWYXJpYWJsZXM6IGlucHV0VmFyaWFibGVzLmxlbmd0aCA/IHsgdmFyaWFibGU6IGlucHV0VmFyaWFibGVzLm1hcChpdiA9PiBpdi52YXJpYWJsZSkgfSA6IHVuZGVmaW5lZCxcbiAgICAgICAgb3V0cHV0VmFyaWFibGVzOiBvdXRwdXRWYXJpYWJsZXMubGVuZ3RoID8geyB2YXJpYWJsZTogb3V0cHV0VmFyaWFibGVzLm1hcChvdiA9PiBvdi52YXJpYWJsZSkgfSA6IHVuZGVmaW5lZCxcbiAgICAgICAgaW5PdXRWYXJpYWJsZXM6IHt9LFxuICAgICAgfTtcbiAgICB9KTtcblxuICBjb25zdCBpblZhcnMgPSBmYmQubm9kZXNcbiAgICAuZmlsdGVyKG4gPT4gbi50eXBlID09PSAnSU5fVkFSSUFCTEUnKVxuICAgIC5tYXAobiA9PiAoe1xuICAgICAgJ0BfbG9jYWxJZCc6IGNsZWFuTG9jYWxJZChuLmlkKSxcbiAgICAgICdAX25lZ2F0ZWQnOiAobi5uZWdhdGVkID09PSB0cnVlKSA/ICd0cnVlJyA6ICdmYWxzZScsXG4gICAgICBwb3NpdGlvbjogeyAnQF94Jzogbi5wb3NpdGlvbi54LCAnQF95Jzogbi5wb3NpdGlvbi55IH0sXG4gICAgICBleHByZXNzaW9uOiBuLnRhZz8ubmFtZSB8fCAnJyxcbiAgICAgIGNvbm5lY3Rpb25Qb2ludE91dDogeyByZWxQb3NpdGlvbjogeyAnQF94JzogJzAnLCAnQF95JzogJzAnIH0gfSxcbiAgICB9KSk7XG5cbiAgY29uc3Qgb3V0VmFycyA9IGZiZC5ub2Rlc1xuICAgIC5maWx0ZXIobiA9PiBuLnR5cGUgPT09ICdPVVRfVkFSSUFCTEUnKVxuICAgIC5tYXAobiA9PiB7XG4gICAgICBjb25zdCBjb25ucyA9IHdpcmVzQnlUYXJnZXQuZ2V0KGAke24uaWR9OjpJTmApIHx8IFtdO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgJ0BfbG9jYWxJZCc6IGNsZWFuTG9jYWxJZChuLmlkKSxcbiAgICAgICAgJ0BfbmVnYXRlZCc6IChuLm5lZ2F0ZWQgPT09IHRydWUpID8gJ3RydWUnIDogJ2ZhbHNlJyxcbiAgICAgICAgcG9zaXRpb246IHsgJ0BfeCc6IG4ucG9zaXRpb24ueCwgJ0BfeSc6IG4ucG9zaXRpb24ueSB9LFxuICAgICAgICBleHByZXNzaW9uOiBuLnRhZz8ubmFtZSB8fCAnJyxcbiAgICAgICAgLi4uKGNvbm5zLmxlbmd0aCA+IDAgPyB7XG4gICAgICAgICAgY29ubmVjdGlvblBvaW50SW46IHtcbiAgICAgICAgICAgIGNvbm5lY3Rpb246IGNvbm5zLm1hcChjID0+ICh7XG4gICAgICAgICAgICAgICdAX3JlZkxvY2FsSWQnOiBjLnJlZkxvY2FsSWQsXG4gICAgICAgICAgICAgICdAX2Zvcm1hbFBhcmFtZXRlcic6IGMuZm9ybWFsUGFyYW1ldGVyLFxuICAgICAgICAgICAgfSkpLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0gOiB7fSksXG4gICAgICB9O1xuICAgIH0pO1xuXG4gIC8vIGluT3V0VmFyaWFibGUgZXhwb3J0XG4gIGNvbnN0IGluT3V0VmFycyA9IGZiZC5ub2Rlc1xuICAgIC5maWx0ZXIobiA9PiBuLnR5cGUgPT09ICdJTl9PVVRfVkFSSUFCTEUnKVxuICAgIC5tYXAobiA9PiB7XG4gICAgICBjb25zdCBjb25ucyA9IHdpcmVzQnlUYXJnZXQuZ2V0KGAke24uaWR9OjpJTmApIHx8IFtdO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgJ0BfbG9jYWxJZCc6IGNsZWFuTG9jYWxJZChuLmlkKSxcbiAgICAgICAgJ0BfbmVnYXRlZCc6ICdmYWxzZScsXG4gICAgICAgIHBvc2l0aW9uOiB7ICdAX3gnOiBuLnBvc2l0aW9uLngsICdAX3knOiBuLnBvc2l0aW9uLnkgfSxcbiAgICAgICAgZXhwcmVzc2lvbjogbi50YWc/Lm5hbWUgfHwgJycsXG4gICAgICAgIC4uLihjb25ucy5sZW5ndGggPiAwID8ge1xuICAgICAgICAgIGNvbm5lY3Rpb25Qb2ludEluOiB7XG4gICAgICAgICAgICBjb25uZWN0aW9uOiBjb25ucy5tYXAoYyA9PiAoeyAnQF9yZWZMb2NhbElkJzogYy5yZWZMb2NhbElkLCAnQF9mb3JtYWxQYXJhbWV0ZXInOiBjLmZvcm1hbFBhcmFtZXRlciB9KSksXG4gICAgICAgICAgfSxcbiAgICAgICAgfSA6IHt9KSxcbiAgICAgICAgY29ubmVjdGlvblBvaW50T3V0OiB7IHJlbFBvc2l0aW9uOiB7ICdAX3gnOiAnMCcsICdAX3knOiAnMCcgfSB9LFxuICAgICAgfTtcbiAgICB9KTtcblxuICAvLyBsYWJlbCBleHBvcnRcbiAgY29uc3QgbGFiZWxzID0gZmJkLm5vZGVzLmZpbHRlcihuID0+IG4udHlwZSA9PT0gJ0xBQkVMJyBhcyBhbnkpLm1hcChuID0+IHtcbiAgICBjb25zdCBjb25ucyA9IHdpcmVzQnlUYXJnZXQuZ2V0KGAke24uaWR9OjpJTmApIHx8IFtdO1xuICAgIHJldHVybiB7XG4gICAgICAnQF9sb2NhbElkJzogY2xlYW5Mb2NhbElkKG4uaWQpLFxuICAgICAgJ0BfbGFiZWwnOiBuLmluc3RhbmNlTmFtZSB8fCAnJyxcbiAgICAgIHBvc2l0aW9uOiB7ICdAX3gnOiBuLnBvc2l0aW9uLngsICdAX3knOiBuLnBvc2l0aW9uLnkgfSxcbiAgICAgIC4uLihjb25ucy5sZW5ndGggPiAwID8geyBjb25uZWN0aW9uUG9pbnRJbjogeyBjb25uZWN0aW9uOiBjb25ucy5tYXAoYyA9PiAoeyAnQF9yZWZMb2NhbElkJzogYy5yZWZMb2NhbElkLCAnQF9mb3JtYWxQYXJhbWV0ZXInOiBjLmZvcm1hbFBhcmFtZXRlciB9KSkgfSB9IDoge30pLFxuICAgIH07XG4gIH0pO1xuXG4gIC8vIGp1bXAgZXhwb3J0XG4gIGNvbnN0IGp1bXBzID0gZmJkLm5vZGVzLmZpbHRlcihuID0+IG4udHlwZSA9PT0gJ0pVTVAnIGFzIGFueSkubWFwKG4gPT4ge1xuICAgIGNvbnN0IGNvbm5zID0gd2lyZXNCeVRhcmdldC5nZXQoYCR7bi5pZH06OklOYCkgfHwgW107XG4gICAgcmV0dXJuIHtcbiAgICAgICdAX2xvY2FsSWQnOiBjbGVhbkxvY2FsSWQobi5pZCksXG4gICAgICAnQF9sYWJlbCc6IG4uaW5zdGFuY2VOYW1lIHx8ICcnLFxuICAgICAgcG9zaXRpb246IHsgJ0BfeCc6IG4ucG9zaXRpb24ueCwgJ0BfeSc6IG4ucG9zaXRpb24ueSB9LFxuICAgICAgLi4uKGNvbm5zLmxlbmd0aCA+IDAgPyB7IGNvbm5lY3Rpb25Qb2ludEluOiB7IGNvbm5lY3Rpb246IGNvbm5zLm1hcChjID0+ICh7ICdAX3JlZkxvY2FsSWQnOiBjLnJlZkxvY2FsSWQsICdAX2Zvcm1hbFBhcmFtZXRlcic6IGMuZm9ybWFsUGFyYW1ldGVyIH0pKSB9IH0gOiB7fSksXG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gcmV0dXJuIGV4cG9ydFxuICBjb25zdCByZXR1cm5zID0gZmJkLm5vZGVzLmZpbHRlcihuID0+IG4udHlwZSA9PT0gJ1JFVFVSTicgYXMgYW55KS5tYXAobiA9PiB7XG4gICAgY29uc3QgY29ubnMgPSB3aXJlc0J5VGFyZ2V0LmdldChgJHtuLmlkfTo6SU5gKSB8fCBbXTtcbiAgICByZXR1cm4ge1xuICAgICAgJ0BfbG9jYWxJZCc6IGNsZWFuTG9jYWxJZChuLmlkKSxcbiAgICAgIHBvc2l0aW9uOiB7ICdAX3gnOiBuLnBvc2l0aW9uLngsICdAX3knOiBuLnBvc2l0aW9uLnkgfSxcbiAgICAgIC4uLihjb25ucy5sZW5ndGggPiAwID8geyBjb25uZWN0aW9uUG9pbnRJbjogeyBjb25uZWN0aW9uOiBjb25ucy5tYXAoYyA9PiAoeyAnQF9yZWZMb2NhbElkJzogYy5yZWZMb2NhbElkLCAnQF9mb3JtYWxQYXJhbWV0ZXInOiBjLmZvcm1hbFBhcmFtZXRlciB9KSkgfSB9IDoge30pLFxuICAgIH07XG4gIH0pO1xuXG4gIC8vIGNvbm5lY3RvciBleHBvcnRcbiAgY29uc3QgY29ubmVjdG9ycyA9IGZiZC5ub2Rlcy5maWx0ZXIobiA9PiBuLnR5cGUgPT09ICdDT05ORUNUT1InIGFzIGFueSkubWFwKG4gPT4ge1xuICAgIGNvbnN0IGNvbm5zID0gd2lyZXNCeVRhcmdldC5nZXQoYCR7bi5pZH06OklOYCkgfHwgW107XG4gICAgcmV0dXJuIHtcbiAgICAgICdAX2xvY2FsSWQnOiBjbGVhbkxvY2FsSWQobi5pZCksXG4gICAgICAnQF9uYW1lJzogbi5pbnN0YW5jZU5hbWUgfHwgJycsXG4gICAgICBwb3NpdGlvbjogeyAnQF94Jzogbi5wb3NpdGlvbi54LCAnQF95Jzogbi5wb3NpdGlvbi55IH0sXG4gICAgICAuLi4oY29ubnMubGVuZ3RoID4gMCA/IHsgY29ubmVjdGlvblBvaW50SW46IHsgY29ubmVjdGlvbjogY29ubnMubWFwKGMgPT4gKHsgJ0BfcmVmTG9jYWxJZCc6IGMucmVmTG9jYWxJZCwgJ0BfZm9ybWFsUGFyYW1ldGVyJzogYy5mb3JtYWxQYXJhbWV0ZXIgfSkpIH0gfSA6IHt9KSxcbiAgICB9O1xuICB9KTtcblxuICAvLyBjb250aW51YXRpb24gZXhwb3J0XG4gIGNvbnN0IGNvbnRpbnVhdGlvbnMgPSBmYmQubm9kZXMuZmlsdGVyKG4gPT4gbi50eXBlID09PSAnQ09OVElOVUFUSU9OJyBhcyBhbnkpLm1hcChuID0+ICh7XG4gICAgJ0BfbG9jYWxJZCc6IGNsZWFuTG9jYWxJZChuLmlkKSxcbiAgICAnQF9uYW1lJzogbi5pbnN0YW5jZU5hbWUgfHwgJycsXG4gICAgcG9zaXRpb246IHsgJ0BfeCc6IG4ucG9zaXRpb24ueCwgJ0BfeSc6IG4ucG9zaXRpb24ueSB9LFxuICAgIGNvbm5lY3Rpb25Qb2ludE91dDogeyByZWxQb3NpdGlvbjogeyAnQF94JzogJzAnLCAnQF95JzogJzAnIH0gfSxcbiAgfSkpO1xuXG4gIGNvbnN0IHJlc3VsdDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fTtcbiAgaWYgKGJsb2Nrcy5sZW5ndGgpIHJlc3VsdC5ibG9jayA9IGJsb2NrcztcbiAgaWYgKGluVmFycy5sZW5ndGgpIHJlc3VsdC5pblZhcmlhYmxlID0gaW5WYXJzO1xuICBpZiAob3V0VmFycy5sZW5ndGgpIHJlc3VsdC5vdXRWYXJpYWJsZSA9IG91dFZhcnM7XG4gIGlmIChpbk91dFZhcnMubGVuZ3RoKSByZXN1bHQuaW5PdXRWYXJpYWJsZSA9IGluT3V0VmFycztcbiAgaWYgKGxhYmVscy5sZW5ndGgpIHJlc3VsdC5sYWJlbCA9IGxhYmVscztcbiAgaWYgKGp1bXBzLmxlbmd0aCkgcmVzdWx0Lmp1bXAgPSBqdW1wcztcbiAgaWYgKHJldHVybnMubGVuZ3RoKSByZXN1bHRbJ3JldHVybiddID0gcmV0dXJucztcbiAgaWYgKGNvbm5lY3RvcnMubGVuZ3RoKSByZXN1bHQuY29ubmVjdG9yID0gY29ubmVjdG9ycztcbiAgaWYgKGNvbnRpbnVhdGlvbnMubGVuZ3RoKSByZXN1bHQuY29udGludWF0aW9uID0gY29udGludWF0aW9ucztcbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gYnVpbGRTRkNYbWwoc2ZjOiBTRkNQcm9ncmFtKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICAvLyBCdWlsZCBsaW5rIGxvb2t1cDogZnJvbSBcdTIxOTIgW3RvXVxuICBjb25zdCBvdXRMaW5rcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmdbXT4oKTtcbiAgY29uc3QgaW5MaW5rcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmdbXT4oKTtcbiAgZm9yIChjb25zdCBsaW5rIG9mIHNmYy5saW5rcykge1xuICAgIGlmICghb3V0TGlua3MuaGFzKGxpbmsuZnJvbSkpIG91dExpbmtzLnNldChsaW5rLmZyb20sIFtdKTtcbiAgICBvdXRMaW5rcy5nZXQobGluay5mcm9tKSEucHVzaChsaW5rLnRvKTtcbiAgICBpZiAoIWluTGlua3MuaGFzKGxpbmsudG8pKSBpbkxpbmtzLnNldChsaW5rLnRvLCBbXSk7XG4gICAgaW5MaW5rcy5nZXQobGluay50bykhLnB1c2gobGluay5mcm9tKTtcbiAgfVxuXG4gIC8vIEJ1aWxkIGludGVnZXIgbG9jYWxJZCBtYXAgZm9yIGFsbCBub2RlIElEcyAoVEM2IHJlcXVpcmVzIHBvc2l0aXZlIGludGVnZXJzKVxuICBjb25zdCBsb2NhbElkTWFwID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgbGV0IGxvY2FsSWRDb3VudGVyID0gMTtcbiAgY29uc3QgYWxsSWRzID0gW1xuICAgIC4uLnNmYy5zdGVwcy5tYXAocyA9PiBzLmlkKSxcbiAgICAuLi5zZmMudHJhbnNpdGlvbnMubWFwKHQgPT4gdC5pZCksXG4gICAgLy8gZGl2ZXJnZW5jZS9jb252ZXJnZW5jZSBub2RlcyBmcm9tIGxpbmtzXG4gICAgLi4uc2ZjLmxpbmtzXG4gICAgICAubWFwKGwgPT4gW2wuZnJvbSwgbC50b10pXG4gICAgICAuZmxhdCgpXG4gICAgICAuZmlsdGVyKGlkID0+IC9ec2ZjLShzaW1EaXZ8c2ltQ29udnxzZWxEaXZ8c2VsQ29udiktLy50ZXN0KGlkKSksXG4gIF07XG4gIGZvciAoY29uc3QgaWQgb2YgYWxsSWRzKSB7XG4gICAgaWYgKCFsb2NhbElkTWFwLmhhcyhpZCkpIGxvY2FsSWRNYXAuc2V0KGlkLCBsb2NhbElkQ291bnRlcisrKTtcbiAgfVxuICBjb25zdCBsaWQgPSAoaWQ6IHN0cmluZyk6IHN0cmluZyA9PiBTdHJpbmcobG9jYWxJZE1hcC5nZXQoaWQpID8/IGlkKTtcblxuICBjb25zdCBzdGVwcyA9IHNmYy5zdGVwcy5tYXAocyA9PiB7XG4gICAgY29uc3QgdGFyZ2V0cyA9IChvdXRMaW5rcy5nZXQocy5pZCkgfHwgW10pO1xuICAgIGNvbnN0IHNvdXJjZXMgPSAoaW5MaW5rcy5nZXQocy5pZCkgfHwgW10pO1xuXG4gICAgY29uc3QgcmVzdWx0OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAgICdAX2xvY2FsSWQnOiBsaWQocy5pZCksXG4gICAgICAnQF9uYW1lJzogcy5uYW1lLFxuICAgICAgJ0BfaW5pdGlhbFN0ZXAnOiBTdHJpbmcocy5pc0luaXRpYWwpLFxuICAgICAgcG9zaXRpb246IHsgJ0BfeCc6IHMucG9zaXRpb24ueCwgJ0BfeSc6IHMucG9zaXRpb24ueSB9LFxuICAgIH07XG5cbiAgICAvLyBjb25uZWN0aW9uUG9pbnRJbiBmcm9tIGluY29taW5nIHRyYW5zaXRpb25zXG4gICAgaWYgKHNvdXJjZXMubGVuZ3RoID4gMCkge1xuICAgICAgcmVzdWx0LmNvbm5lY3Rpb25Qb2ludEluID0ge1xuICAgICAgICBjb25uZWN0aW9uOiBzb3VyY2VzLm1hcChzcmMgPT4gKHsgJ0BfcmVmTG9jYWxJZCc6IGxpZChzcmMpIH0pKSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gY29ubmVjdGlvblBvaW50T3V0IHRvIG91dGdvaW5nIHRyYW5zaXRpb25zXG4gICAgaWYgKHRhcmdldHMubGVuZ3RoID4gMCkge1xuICAgICAgcmVzdWx0LmNvbm5lY3Rpb25Qb2ludE91dCA9IHtcbiAgICAgICAgY29ubmVjdGlvbjogdGFyZ2V0cy5tYXAodGd0ID0+ICh7ICdAX3JlZkxvY2FsSWQnOiBsaWQodGd0KSB9KSksXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIFN0ZXBzIHRoYXQgaGF2ZSBhY3Rpb25zIGdldCBjb25uZWN0aW9uUG9pbnRPdXRBY3Rpb25cbiAgICBpZiAocy5hY3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIHJlc3VsdC5jb25uZWN0aW9uUG9pbnRPdXRBY3Rpb24gPSB7ICdAX2Zvcm1hbFBhcmFtZXRlcic6ICd4JyB9O1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0pO1xuXG4gIGNvbnN0IHRyYW5zaXRpb25zID0gc2ZjLnRyYW5zaXRpb25zLm1hcCh0ID0+IHtcbiAgICBjb25zdCB0YXJnZXRzID0gb3V0TGlua3MuZ2V0KHQuaWQpIHx8IFtdO1xuICAgIGNvbnN0IHNvdXJjZXMgPSBpbkxpbmtzLmdldCh0LmlkKSB8fCBbXTtcblxuICAgIGNvbnN0IHJlc3VsdDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgICAnQF9sb2NhbElkJzogbGlkKHQuaWQpLFxuICAgICAgJ0BfcHJpb3JpdHknOiAodCBhcyBhbnkpLnByaW9yaXR5ICE9IG51bGwgPyBTdHJpbmcoKHQgYXMgYW55KS5wcmlvcml0eSkgOiB1bmRlZmluZWQsXG4gICAgICBwb3NpdGlvbjogeyAnQF94JzogdC5wb3NpdGlvbi54LCAnQF95JzogdC5wb3NpdGlvbi55IH0sXG4gICAgICBjb25kaXRpb246IHsgU1Q6IHsgJ3hodG1sOnAnOiB0LmNvbmRpdGlvbiB9IH0sXG4gICAgfTtcblxuICAgIGlmIChzb3VyY2VzLmxlbmd0aCA+IDApIHtcbiAgICAgIHJlc3VsdC5jb25uZWN0aW9uUG9pbnRJbiA9IHtcbiAgICAgICAgY29ubmVjdGlvbjogc291cmNlcy5tYXAoc3JjID0+ICh7ICdAX3JlZkxvY2FsSWQnOiBsaWQoc3JjKSB9KSksXG4gICAgICB9O1xuICAgIH1cbiAgICBpZiAodGFyZ2V0cy5sZW5ndGggPiAwKSB7XG4gICAgICByZXN1bHQuY29ubmVjdGlvblBvaW50T3V0ID0ge1xuICAgICAgICBjb25uZWN0aW9uOiB0YXJnZXRzLm1hcCh0Z3QgPT4gKHsgJ0BfcmVmTG9jYWxJZCc6IGxpZCh0Z3QpIH0pKSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSk7XG5cbiAgLy8gRW1pdCBkaXZlcmdlbmNlL2NvbnZlcmdlbmNlIGVsZW1lbnRzIGZyb20gbGlua3Mgd2l0aCBzcGVjaWFsIHR5cGVzXG4gIGNvbnN0IHNpbXVsdGFuZW91c0RpdmVyZ2VuY2VzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdID0gW107XG4gIGNvbnN0IHNpbXVsdGFuZW91c0NvbnZlcmdlbmNlczogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSA9IFtdO1xuICBjb25zdCBzZWxlY3Rpb25EaXZlcmdlbmNlczogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSA9IFtdO1xuICBjb25zdCBzZWxlY3Rpb25Db252ZXJnZW5jZXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+W10gPSBbXTtcblxuICBjb25zdCBkaXZJZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgZm9yIChjb25zdCBsaW5rIG9mIHNmYy5saW5rcykge1xuICAgIGlmIChsaW5rLnR5cGUgPT09ICdzaW11bHRhbmVvdXMtZGl2ZXJnZW5jZScgfHwgbGluay50eXBlID09PSAnc2ltdWx0YW5lb3VzLWNvbnZlcmdlbmNlJyB8fFxuICAgICAgICBsaW5rLnR5cGUgPT09ICdzZWxlY3Rpb24tZGl2ZXJnZW5jZScgfHwgbGluay50eXBlID09PSAnc2VsZWN0aW9uLWNvbnZlcmdlbmNlJykge1xuICAgICAgLy8gRXh0cmFjdCB0aGUgZGl2ZXJnZW5jZS9jb252ZXJnZW5jZSBub2RlIGlkIGZyb20gbGluayBmcm9tL3RvXG4gICAgICBjb25zdCBkaXZNYXRjaCA9IGxpbmsuZnJvbS5tYXRjaCgvXnNmYy0oc2ltRGl2fHNpbUNvbnZ8c2VsRGl2fHNlbENvbnYpLSguKykkLyk7XG4gICAgICBjb25zdCBjb252TWF0Y2ggPSBsaW5rLnRvLm1hdGNoKC9ec2ZjLShzaW1EaXZ8c2ltQ29udnxzZWxEaXZ8c2VsQ29udiktKC4rKSQvKTtcbiAgICAgIGNvbnN0IG5vZGVJZCA9IGRpdk1hdGNoID8gbGluay5mcm9tIDogY29udk1hdGNoID8gbGluay50byA6IG51bGw7XG4gICAgICBpZiAobm9kZUlkICYmICFkaXZJZHMuaGFzKG5vZGVJZCkpIHtcbiAgICAgICAgZGl2SWRzLmFkZChub2RlSWQpO1xuICAgICAgICBjb25zdCBzb3VyY2VzID0gaW5MaW5rcy5nZXQobm9kZUlkKSB8fCBbXTtcbiAgICAgICAgY29uc3QgdGFyZ2V0cyA9IG91dExpbmtzLmdldChub2RlSWQpIHx8IFtdO1xuICAgICAgICBjb25zdCBpc0NvbnZlcmdlbmNlID0gbm9kZUlkLmluY2x1ZGVzKCdDb252Jyk7XG4gICAgICAgIGNvbnN0IGVsOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAgICAgICAnQF9sb2NhbElkJzogbGlkKG5vZGVJZCksXG4gICAgICAgICAgLy8gQ29udmVyZ2VuY2U6IG9uZSBjb25uZWN0aW9uUG9pbnRJbiBwZXIgc291cmNlOyBkaXZlcmdlbmNlOiBzaW5nbGUgY29ubmVjdGlvblBvaW50SW4gd2l0aCBhbGwgc291cmNlc1xuICAgICAgICAgIC4uLihzb3VyY2VzLmxlbmd0aCA+IDBcbiAgICAgICAgICAgID8gaXNDb252ZXJnZW5jZVxuICAgICAgICAgICAgICA/IHsgY29ubmVjdGlvblBvaW50SW46IHNvdXJjZXMubWFwKHMgPT4gKHsgY29ubmVjdGlvbjogeyAnQF9yZWZMb2NhbElkJzogbGlkKHMpIH0gfSkpIH1cbiAgICAgICAgICAgICAgOiB7IGNvbm5lY3Rpb25Qb2ludEluOiB7IGNvbm5lY3Rpb246IHNvdXJjZXMubWFwKHMgPT4gKHsgJ0BfcmVmTG9jYWxJZCc6IGxpZChzKSB9KSkgfSB9XG4gICAgICAgICAgICA6IHt9KSxcbiAgICAgICAgICAuLi4odGFyZ2V0cy5sZW5ndGggPiAwID8geyBjb25uZWN0aW9uUG9pbnRPdXQ6IHRhcmdldHMubWFwKCh0LCBpKSA9PiAoeyAnQF9mb3JtYWxQYXJhbWV0ZXInOiBTdHJpbmcoaSksIGNvbm5lY3Rpb246IHsgJ0BfcmVmTG9jYWxJZCc6IGxpZCh0KSB9IH0pKSB9IDoge30pLFxuICAgICAgICB9O1xuICAgICAgICBpZiAobGluay50eXBlID09PSAnc2ltdWx0YW5lb3VzLWRpdmVyZ2VuY2UnKSBzaW11bHRhbmVvdXNEaXZlcmdlbmNlcy5wdXNoKGVsKTtcbiAgICAgICAgZWxzZSBpZiAobGluay50eXBlID09PSAnc2ltdWx0YW5lb3VzLWNvbnZlcmdlbmNlJykgc2ltdWx0YW5lb3VzQ29udmVyZ2VuY2VzLnB1c2goZWwpO1xuICAgICAgICBlbHNlIGlmIChsaW5rLnR5cGUgPT09ICdzZWxlY3Rpb24tZGl2ZXJnZW5jZScpIHNlbGVjdGlvbkRpdmVyZ2VuY2VzLnB1c2goZWwpO1xuICAgICAgICBlbHNlIGlmIChsaW5rLnR5cGUgPT09ICdzZWxlY3Rpb24tY29udmVyZ2VuY2UnKSBzZWxlY3Rpb25Db252ZXJnZW5jZXMucHVzaChlbCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gQnVpbGQganVtcCBlbGVtZW50c1xuICBjb25zdCBqdW1wU3RlcHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+W10gPSBbXTtcbiAgZm9yIChjb25zdCBqdW1wIG9mIChzZmMuanVtcHMgPz8gW10pKSB7XG4gICAganVtcFN0ZXBzLnB1c2goe1xuICAgICAgJ0BfbG9jYWxJZCc6IFN0cmluZyhsb2NhbElkQ291bnRlcisrKSxcbiAgICAgICdAX3RhcmdldE5hbWUnOiBqdW1wLnRhcmdldFN0ZXBOYW1lLFxuICAgICAgcG9zaXRpb246IHsgJ0BfeCc6IGp1bXAucG9zaXRpb24/LnggfHwgMCwgJ0BfeSc6IGp1bXAucG9zaXRpb24/LnkgfHwgMCB9LFxuICAgICAgY29ubmVjdGlvblBvaW50SW46IHt9LFxuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgcmVzdWx0OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICBzdGVwOiBzdGVwcy5sZW5ndGggPyBzdGVwcyA6IHVuZGVmaW5lZCxcbiAgICB0cmFuc2l0aW9uOiB0cmFuc2l0aW9ucy5sZW5ndGggPyB0cmFuc2l0aW9ucyA6IHVuZGVmaW5lZCxcbiAgfTtcbiAgaWYgKHNpbXVsdGFuZW91c0RpdmVyZ2VuY2VzLmxlbmd0aCkgcmVzdWx0LnNpbXVsdGFuZW91c0RpdmVyZ2VuY2UgPSBzaW11bHRhbmVvdXNEaXZlcmdlbmNlcztcbiAgaWYgKHNpbXVsdGFuZW91c0NvbnZlcmdlbmNlcy5sZW5ndGgpIHJlc3VsdC5zaW11bHRhbmVvdXNDb252ZXJnZW5jZSA9IHNpbXVsdGFuZW91c0NvbnZlcmdlbmNlcztcbiAgaWYgKHNlbGVjdGlvbkRpdmVyZ2VuY2VzLmxlbmd0aCkgcmVzdWx0LnNlbGVjdGlvbkRpdmVyZ2VuY2UgPSBzZWxlY3Rpb25EaXZlcmdlbmNlcztcbiAgaWYgKHNlbGVjdGlvbkNvbnZlcmdlbmNlcy5sZW5ndGgpIHJlc3VsdC5zZWxlY3Rpb25Db252ZXJnZW5jZSA9IHNlbGVjdGlvbkNvbnZlcmdlbmNlcztcbiAgaWYgKGp1bXBTdGVwcy5sZW5ndGgpIHJlc3VsdC5qdW1wU3RlcCA9IGp1bXBTdGVwcztcblxuICAvLyBFbWl0IGFjdGlvbkJsb2NrcyBhcyBzaWJsaW5ncyBvZiBzdGVwcyAoQnVnIDkpXG4gIGNvbnN0IGFjdGlvbkJsb2NrczogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSA9IFtdO1xuICBmb3IgKGNvbnN0IHMgb2Ygc2ZjLnN0ZXBzKSB7XG4gICAgaWYgKHMuYWN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICBhY3Rpb25CbG9ja3MucHVzaCh7XG4gICAgICAgICdAX2xvY2FsSWQnOiBTdHJpbmcobG9jYWxJZENvdW50ZXIrKyksXG4gICAgICAgIGNvbm5lY3Rpb25Qb2ludEluOiB7IGNvbm5lY3Rpb246IHsgJ0BfcmVmTG9jYWxJZCc6IGxpZChzLmlkKSB9IH0sXG4gICAgICAgIGFjdGlvbjogcy5hY3Rpb25zLm1hcChhID0+ICh7XG4gICAgICAgICAgJ0BfcXVhbGlmaWVyJzogYS5xdWFsaWZpZXIsXG4gICAgICAgICAgJ0BfZHVyYXRpb24nOiBhLmR1cmF0aW9uIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgICByZWZlcmVuY2U6IHsgJ0BfbmFtZSc6IGEudGFnLm5hbWUgfSxcbiAgICAgICAgfSkpLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGlmIChhY3Rpb25CbG9ja3MubGVuZ3RoKSByZXN1bHQuYWN0aW9uQmxvY2sgPSBhY3Rpb25CbG9ja3M7XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gdGFnVG9WYXJYbWwodGFnOiBOb3JtYWxpemVkVGFnKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgICdAX25hbWUnOiB0YWcubmFtZSxcbiAgICAnQF9hZGRyZXNzJzogdGFnLmFkZHJlc3MgfHwgdW5kZWZpbmVkLFxuICAgIHR5cGU6IHsgW3RhZy5kYXRhVHlwZV06IHt9IH0sXG4gICAgaW5pdGlhbFZhbHVlOiB0YWcuaW5pdGlhbFZhbHVlID8geyBzaW1wbGVWYWx1ZTogeyAnQF92YWx1ZSc6IHRhZy5pbml0aWFsVmFsdWUgfSB9IDogdW5kZWZpbmVkLFxuICAgIGRvY3VtZW50YXRpb246IHRhZy5kZXNjcmlwdGlvbiB8fCB1bmRlZmluZWQsXG4gIH07XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFRQSxTQUFTLFVBQVUsVUFBVSxNQUFNLE1BQU0sT0FBTyxrQkFBa0I7QUFDbEUsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxlQUFlLDRCQUE0QjtBQUNwRCxTQUFTLGdCQUFnQixnQkFBZ0IsNEJBQTRCO0FBRXJFLFNBQVMsWUFBWSxHQUFtQjtBQUN0QyxTQUFPLEVBQUUsUUFBUSxVQUFVLEdBQUcsRUFBRSxRQUFRLFNBQVMsR0FBRyxFQUFFLFFBQVEsU0FBUyxHQUFHLEVBQUUsUUFBUSxXQUFXLEdBQUcsRUFBRSxRQUFRLFdBQVcsR0FBRztBQUM1SDtBQWVPLFNBQVMsY0FBYyxZQUFvQixVQUFnQztBQUNoRixRQUFNLFNBQW1CLENBQUM7QUFDMUIsUUFBTSxXQUFxQixDQUFDO0FBQzVCLFFBQU0sV0FBOEIsQ0FBQztBQUVyQyxNQUFJO0FBQ0osTUFBSTtBQUNGLFdBQU8sU0FBUyxVQUFVO0FBQUEsRUFDNUIsU0FBUyxHQUFHO0FBQ1YsV0FBTyxFQUFFLElBQUksT0FBTyxRQUFRLENBQUMsb0JBQW9CLENBQUMsRUFBRSxHQUFHLFVBQVUsQ0FBQyxFQUFFO0FBQUEsRUFDdEU7QUFFQSxRQUFN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
