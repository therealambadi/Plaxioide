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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjMi9wbGMtZWRpdG9yLXRzeC92ZW5kb3IvYWRhcHRlcnMvcGxjb3BlbkFkYXB0ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qXG4gKiBQTENvcGVuIFhNTCBBZGFwdGVyIChUQzYgc2NoZW1hLCBuYW1lc3BhY2UgaHR0cDovL3d3dy5wbGNvcGVuLm9yZy94bWwvdGM2XzAyMDEpXG4gKiBIYW5kbGVzIE1pdHN1YmlzaGkgaVEtV29ya3MsIENPREVTWVMsIEJlY2tob2ZmIFR3aW5DQVQsIGFuZCBhbnkgVEM2LWNvbXBsaWFudCB0b29sLlxuICpcbiAqIEltcG9ydDogUExDb3BlbiBYTUwgXHUyMTkyIE5vcm1hbGl6ZWRQcm9qZWN0XG4gKiBFeHBvcnQ6IE5vcm1hbGl6ZWRQcm9qZWN0IFx1MjE5MiBQTENvcGVuIFhNTFxuICovXG5cbmltcG9ydCB7IHBhcnNlWE1MLCBidWlsZFhNTCwgYXR0ciwgdGV4dCwgY2hpbGQsIGNoaWxkQXJyYXkgfSBmcm9tICcuLi94bWxVdGlscy5qcyc7XG5pbXBvcnQgeyBwbGNvcGVuVHlwZVRvSUVDIH0gZnJvbSAnLi4vZGF0YVR5cGVNYXAuanMnO1xuaW1wb3J0IHsgYnVpbGRSZXNvbHZlciwgVmFyaWFibGVUeXBlUmVzb2x2ZXIgfSBmcm9tICcuLi92YXJpYWJsZVR5cGVSZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBnZXRQaW5EYXRhVHlwZSwgYnVpbGRUeXBlZFBpbnMsIGJ1aWxkVHlwZWRUYWdSZWZQaW5zIH0gZnJvbSAnLi4vcGluU2lnbmF0dXJlcy5qcyc7XG5cbmZ1bmN0aW9uIHVuZXNjYXBlWE1MKHM6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzLnJlcGxhY2UoLyZhbXA7L2csICcmJykucmVwbGFjZSgvJmx0Oy9nLCAnPCcpLnJlcGxhY2UoLyZndDsvZywgJz4nKS5yZXBsYWNlKC8mcXVvdDsvZywgJ1wiJykucmVwbGFjZSgvJmFwb3M7L2csIFwiJ1wiKTtcbn1cbmltcG9ydCB0eXBlIHtcbiAgSW1wb3J0UmVzdWx0LCBFeHBvcnRSZXN1bHQsIE5vcm1hbGl6ZWRQcm9qZWN0LCBOb3JtYWxpemVkUE9VLCBOb3JtYWxpemVkVGFnLFxuICBWZW5kb3JNZXRhZGF0YVNpZGVjYXIsIFVubWFwcGVkRWxlbWVudCxcbn0gZnJvbSAnLi4vdHlwZXMuanMnO1xuaW1wb3J0IHR5cGUge1xuICBMYWRkZXJQcm9ncmFtLCBGQkRQcm9ncmFtLCBTRkNQcm9ncmFtLCBSdW5nLCBMYWRkZXJFbGVtZW50LFxuICBDb250YWN0RWxlbWVudCwgQ29pbEVsZW1lbnQsIEJsb2NrRWxlbWVudCwgQ29udGFjdFR5cGUsIENvaWxUeXBlLFxuICBGQkROb2RlLCBGQkRXaXJlLCBGQkRCbG9ja1R5cGUsIFBpbixcbiAgU0ZDU3RlcCwgU0ZDVHJhbnNpdGlvbiwgU0ZDTGluaywgU0ZDQWN0aW9uLCBBY3Rpb25RdWFsaWZpZXIsIFNGQ0p1bXAsIFNGQ0JyYW5jaCxcbiAgVGFnUmVmLCBJRUNEYXRhVHlwZSxcbn0gZnJvbSAnLi4vLi4vbG9naWNTdG9yZS5qcyc7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBJbXBvcnQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBmdW5jdGlvbiBpbXBvcnRQTENvcGVuKHhtbENvbnRlbnQ6IHN0cmluZywgZmlsZVBhdGg6IHN0cmluZyk6IEltcG9ydFJlc3VsdCB7XG4gIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHVubWFwcGVkOiBVbm1hcHBlZEVsZW1lbnRbXSA9IFtdO1xuXG4gIGxldCByb290OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbiAgdHJ5IHtcbiAgICByb290ID0gcGFyc2VYTUwoeG1sQ29udGVudCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9yczogW2BYTUwgcGFyc2UgZXJyb3I6ICR7ZX1gXSwgd2FybmluZ3M6IFtdIH07XG4gIH1cblxuICBjb25zdCBwcm9qZWN0ID0gY2hpbGQocm9vdCwgJ3Byb2plY3QnKSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IHVuZGVmaW5lZDtcbiAgaWYgKCFwcm9qZWN0KSB7XG4gICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcnM6IFsnTm8gPHByb2plY3Q+IHJvb3QgZWxlbWVudCBmb3VuZCddLCB3YXJuaW5nczogW10gfTtcbiAgfVxuXG4gIGNvbnN0IGZpbGVJbmZvID0gY2hpbGQocHJvamVjdCwgJ2ZpbGVIZWFkZXInKSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IHVuZGVmaW5lZDtcbiAgY29uc3QgcHJvamVjdE5hbWUgPSBhdHRyKGZpbGVJbmZvLCAncHJvamVjdE5hbWUnKSB8fCBhdHRyKHByb2plY3QsICdwcm9qZWN0TmFtZScpIHx8ICdJbXBvcnRlZCBQcm9qZWN0JztcbiAgY29uc3QgdmVyc2lvbiA9IGF0dHIoZmlsZUluZm8sICdwcm9kdWN0VmVyc2lvbicpIHx8ICcxLjAnO1xuXG4gIC8vIEdsb2JhbCB2YXJpYWJsZSBsaXN0c1xuICBjb25zdCBnbG9iYWxUYWdzOiBOb3JtYWxpemVkVGFnW10gPSBbXTtcbiAgY29uc3QgdHlwZXNOb2RlID0gY2hpbGQocHJvamVjdCwgJ3R5cGVzJyk7XG4gIGlmICh0eXBlc05vZGUpIHtcbiAgICAvLyBFeHRyYWN0IGdsb2JhbCB2YXJzIGRlY2xhcmVkIGF0IHRoZSB0eXBlcyBsZXZlbCAob3V0c2lkZSBpbmRpdmlkdWFsIFBPVXMpXG4gICAgY2hpbGRBcnJheSh0eXBlc05vZGUsICdnbG9iYWxWYXJzJykuZm9yRWFjaChndkxpc3QgPT4ge1xuICAgICAgY2hpbGRBcnJheShndkxpc3QsICd2YXJpYWJsZScpLmZvckVhY2godiA9PiB7XG4gICAgICAgIGNvbnN0IHRhZyA9IHBhcnNlVmFyaWFibGUodiwgdW5tYXBwZWQpO1xuICAgICAgICBpZiAodGFnKSBnbG9iYWxUYWdzLnB1c2godGFnKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgaW5zdGFuY2VzTm9kZSA9IGNoaWxkKHByb2plY3QsICdpbnN0YW5jZXMnKTtcbiAgaWYgKGluc3RhbmNlc05vZGUpIHtcbiAgICBjaGlsZEFycmF5KGluc3RhbmNlc05vZGUsICdjb25maWd1cmF0aW9ucycpLmZvckVhY2goY29uZmlnID0+IHtcbiAgICAgIGNoaWxkQXJyYXkoY29uZmlnLCAnZ2xvYmFsVmFycycpLmZvckVhY2goZ3ZMaXN0ID0+IHtcbiAgICAgICAgY2hpbGRBcnJheShndkxpc3QsICd2YXJpYWJsZScpLmZvckVhY2godiA9PiB7XG4gICAgICAgICAgY29uc3QgdGFnID0gcGFyc2VWYXJpYWJsZSh2LCB1bm1hcHBlZCk7XG4gICAgICAgICAgaWYgKHRhZykgZ2xvYmFsVGFncy5wdXNoKHRhZyk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBQT1VzXG4gIGNvbnN0IHBvdXM6IE5vcm1hbGl6ZWRQT1VbXSA9IFtdO1xuICBjb25zdCB0eXBlc0VsID0gY2hpbGQocHJvamVjdCwgJ3R5cGVzJykgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCB1bmRlZmluZWQ7XG4gIGNvbnN0IHBvaXNFbCA9IHR5cGVzRWwgPyBjaGlsZCh0eXBlc0VsLCAncG91cycpIDogdW5kZWZpbmVkO1xuICBjb25zdCBwb3VMaXN0ID0gY2hpbGRBcnJheShwb2lzRWwgPz8gdHlwZXNFbCwgJ3BvdScpO1xuXG4gIGZvciAoY29uc3QgcG91RWwgb2YgcG91TGlzdCkge1xuICAgIGNvbnN0IHBvdSA9IHBhcnNlUE9VKHBvdUVsLCB1bm1hcHBlZCwgd2FybmluZ3MpO1xuICAgIGlmIChwb3UpIHBvdXMucHVzaChwb3UpO1xuICB9XG5cbiAgaWYgKHBvdXMubGVuZ3RoID09PSAwKSB7XG4gICAgZXJyb3JzLnB1c2goJ05vIFBPVXMgZm91bmQgaW4gZmlsZScpO1xuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3JzLCB3YXJuaW5ncyB9O1xuICB9XG5cbiAgY29uc3Qgc2lkZWNhcjogVmVuZG9yTWV0YWRhdGFTaWRlY2FyID0ge1xuICAgIHNvdXJjZVZlbmRvcjogJ3BsY29wZW5feG1sJyxcbiAgICBzb3VyY2VGaWxlVmVyc2lvbjogdmVyc2lvbixcbiAgICBvcmlnaW5hbEZpbGVQYXRoOiBmaWxlUGF0aCxcbiAgICB1bm1hcHBlZEVsZW1lbnRzOiB1bm1hcHBlZCxcbiAgICBvcmdhbml6ZXJUcmVlTGF5b3V0OiBjaGlsZChwcm9qZWN0LCAnaW5zdGFuY2VzJyksXG4gIH07XG5cbiAgcmV0dXJuIHtcbiAgICBvazogdHJ1ZSxcbiAgICBwcm9qZWN0OiB7IHByb2plY3ROYW1lLCBwb3VzLCBnbG9iYWxUYWdzLCBzaWRlY2FyIH0sXG4gICAgZXJyb3JzLFxuICAgIHdhcm5pbmdzLFxuICB9O1xufVxuXG5mdW5jdGlvbiBwYXJzZVZhcmlhYmxlKHY6IHVua25vd24sIHVubWFwcGVkOiBVbm1hcHBlZEVsZW1lbnRbXSk6IE5vcm1hbGl6ZWRUYWcgfCBudWxsIHtcbiAgaWYgKCF2IHx8IHR5cGVvZiB2ICE9PSAnb2JqZWN0JykgcmV0dXJuIG51bGw7XG4gIGNvbnN0IG5hbWUgPSBhdHRyKHYsICduYW1lJyk7XG4gIGlmICghbmFtZSkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHR5cGVFbCA9IGNoaWxkKHYsICd0eXBlJyk7XG4gIGNvbnN0IGRhdGFUeXBlID0gaW5mZXJUeXBlKHR5cGVFbCwgdW5tYXBwZWQsIG5hbWUpO1xuICBjb25zdCBpbml0RWwgPSBjaGlsZCh2LCAnaW5pdGlhbFZhbHVlJyk7XG4gIGNvbnN0IGRvYyA9IGNoaWxkKHYsICdkb2N1bWVudGF0aW9uJyk7XG4gIHJldHVybiB7XG4gICAgbmFtZSxcbiAgICBkYXRhVHlwZSxcbiAgICAvLyBUQzY6IDxzaW1wbGVWYWx1ZSB2YWx1ZT1cIjBcIi8+IFx1MjAxNCB2YWx1ZSBpcyBhbiBhdHRyaWJ1dGUsIG5vdCB0ZXh0IGNvbnRlbnRcbiAgICBpbml0aWFsVmFsdWU6IGluaXRFbFxuICAgICAgPyAoYXR0cihjaGlsZChpbml0RWwsICdzaW1wbGVWYWx1ZScpLCAndmFsdWUnKSB8fCB0ZXh0KGNoaWxkKGluaXRFbCwgJ3NpbXBsZVZhbHVlJykpIHx8IHRleHQoaW5pdEVsKSB8fCB1bmRlZmluZWQpXG4gICAgICA6IHVuZGVmaW5lZCxcbiAgICBkZXNjcmlwdGlvbjogZG9jID8gdGV4dChkb2MpIDogdW5kZWZpbmVkLFxuICAgIGFkZHJlc3M6IGF0dHIodiwgJ2FkZHJlc3MnKSB8fCB1bmRlZmluZWQsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGluZmVyVHlwZSh0eXBlRWw6IHVua25vd24sIHVubWFwcGVkOiBVbm1hcHBlZEVsZW1lbnRbXSwgaGludDogc3RyaW5nKTogSUVDRGF0YVR5cGUge1xuICBpZiAoIXR5cGVFbCB8fCB0eXBlb2YgdHlwZUVsICE9PSAnb2JqZWN0JykgcmV0dXJuICdCT09MJztcbiAgY29uc3QgdCA9IHR5cGVFbCBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbiAgLy8gPEJPT0wvPiwgPElOVC8+LCA8UkVBTC8+IGV0Yy5cbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXModCkpIHtcbiAgICBpZiAoa2V5LnN0YXJ0c1dpdGgoJ0BfJykpIGNvbnRpbnVlO1xuICAgIHJldHVybiBwbGNvcGVuVHlwZVRvSUVDKGtleSk7XG4gIH1cbiAgdW5tYXBwZWQucHVzaCh7IGNsbU5vZGVJZDogbnVsbCwgdmVuZG9yU3BlY2lmaWNEYXRhOiB0eXBlRWwsIHJlYXNvbjogYFVua25vd24gdHlwZSBmb3IgJHtoaW50fWAgfSk7XG4gIHJldHVybiAnRElOVCc7XG59XG5cbmZ1bmN0aW9uIHBhcnNlUE9VKHBvdUVsOiB1bmtub3duLCB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10sIHdhcm5pbmdzOiBzdHJpbmdbXSk6IE5vcm1hbGl6ZWRQT1UgfCBudWxsIHtcbiAgaWYgKCFwb3VFbCB8fCB0eXBlb2YgcG91RWwgIT09ICdvYmplY3QnKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgbmFtZSA9IGF0dHIocG91RWwsICduYW1lJyk7XG4gIGlmICghbmFtZSkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHBvdVR5cGUgPSBhdHRyKHBvdUVsLCAncG91VHlwZScpOyAvLyBwcm9ncmFtLCBmdW5jdGlvbkJsb2NrLCBmdW5jdGlvblxuXG4gIGNvbnN0IGxvY2FsVGFnczogTm9ybWFsaXplZFRhZ1tdID0gW107XG4gIGNvbnN0IGludGVyZmFjZUVsID0gY2hpbGQocG91RWwsICdpbnRlcmZhY2UnKTtcbiAgaWYgKGludGVyZmFjZUVsKSB7XG4gICAgZm9yIChjb25zdCBzZWN0aW9uIG9mIFsnbG9jYWxWYXJzJywgJ2lucHV0VmFycycsICdvdXRwdXRWYXJzJywgJ2luT3V0VmFycycsICdleHRlcm5hbFZhcnMnLCAndGVtcFZhcnMnLCAnZ2xvYmFsVmFycyddKSB7XG4gICAgICBjaGlsZEFycmF5KGludGVyZmFjZUVsLCBzZWN0aW9uKS5mb3JFYWNoKHNlYyA9PiB7XG4gICAgICAgIGNoaWxkQXJyYXkoc2VjLCAndmFyaWFibGUnKS5mb3JFYWNoKHYgPT4ge1xuICAgICAgICAgIGNvbnN0IHRhZyA9IHBhcnNlVmFyaWFibGUodiwgdW5tYXBwZWQpO1xuICAgICAgICAgIGlmICh0YWcpIGxvY2FsVGFncy5wdXNoKHRhZyk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICAgIC8vIEFsc28gYWNjZXB0IDx2YXJpYWJsZT4gZGlyZWN0bHkgaW4gPGludGVyZmFjZT5cbiAgICBjaGlsZEFycmF5KGludGVyZmFjZUVsLCAndmFyaWFibGUnKS5mb3JFYWNoKHYgPT4ge1xuICAgICAgY29uc3QgdGFnID0gcGFyc2VWYXJpYWJsZSh2LCB1bm1hcHBlZCk7XG4gICAgICBpZiAodGFnKSBsb2NhbFRhZ3MucHVzaCh0YWcpO1xuICAgIH0pO1xuICAgIC8vIHJldHVyblR5cGUgXHUyMDE0IHN0b3JlIGFzIGEgc3BlY2lhbCB0YWcgc28gaXQgY2FuIGJlIHJvdW5kLXRyaXBwZWRcbiAgICBjb25zdCByZXRUeXBlRWwgPSBjaGlsZChpbnRlcmZhY2VFbCwgJ3JldHVyblR5cGUnKTtcbiAgICBpZiAocmV0VHlwZUVsKSB7XG4gICAgICBjb25zdCByZXRUeXBlID0gaW5mZXJUeXBlKHJldFR5cGVFbCwgdW5tYXBwZWQsIGAke25hbWV9X3JldHVyblR5cGVgKTtcbiAgICAgIGxvY2FsVGFncy5wdXNoKHsgbmFtZTogJ19fcmV0dXJuVHlwZV9fJywgZGF0YVR5cGU6IHJldFR5cGUgfSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3Qgbm9ybWFsaXplZFBvdVR5cGUgPSBwb3VUeXBlIGFzIE5vcm1hbGl6ZWRQT1VbJ3BvdVR5cGUnXTtcblxuICBjb25zdCBib2R5RWwgPSBjaGlsZChwb3VFbCwgJ2JvZHknKTtcbiAgaWYgKCFib2R5RWwpIHtcbiAgICB3YXJuaW5ncy5wdXNoKGBQT1UgXCIke25hbWV9XCIgaGFzIG5vIGJvZHkgXHUyMDE0IGltcG9ydGVkIGFzIGVtcHR5YCk7XG4gICAgcmV0dXJuIHsgaWQ6IGBwb3UtJHtuYW1lfWAsIG5hbWUsIHBvdVR5cGU6IG5vcm1hbGl6ZWRQb3VUeXBlLCBsYW5ndWFnZTogJ0xEJywgbGFkZGVyUHJvZ3JhbTogeyBydW5nczogW10gfSwgbG9jYWxUYWdzIH07XG4gIH1cblxuICAvLyBCdWlsZCBhIHJlc29sdmVyIHNvIHBhcnNlcnMgY2FuIGxvb2sgdXAgdmFyaWFibGUgdHlwZXMgZnJvbSBkZWNsYXJhdGlvbnNcbiAgY29uc3QgcmVzb2x2ZXIgPSBidWlsZFJlc29sdmVyKGxvY2FsVGFncywgW10pO1xuXG4gIC8vIERldGVybWluZSBsYW5ndWFnZSBmcm9tIGJvZHlcbiAgaWYgKGNoaWxkKGJvZHlFbCwgJ0xEJykpIHtcbiAgICBjb25zdCBsZCA9IHBhcnNlTERCb2R5KGNoaWxkKGJvZHlFbCwgJ0xEJyksIG5hbWUsIHVubWFwcGVkLCByZXNvbHZlcik7XG4gICAgcmV0dXJuIHsgaWQ6IGBwb3UtJHtuYW1lfWAsIG5hbWUsIHBvdVR5cGU6IG5vcm1hbGl6ZWRQb3VUeXBlLCBsYW5ndWFnZTogJ0xEJywgbGFkZGVyUHJvZ3JhbTogbGQsIGxvY2FsVGFncyB9O1xuICB9XG4gIGlmIChjaGlsZChib2R5RWwsICdGQkQnKSkge1xuICAgIGNvbnN0IGZiZCA9IHBhcnNlRkJEQm9keShjaGlsZChib2R5RWwsICdGQkQnKSwgbmFtZSwgdW5tYXBwZWQsIHJlc29sdmVyKTtcbiAgICByZXR1cm4geyBpZDogYHBvdS0ke25hbWV9YCwgbmFtZSwgcG91VHlwZTogbm9ybWFsaXplZFBvdVR5cGUsIGxhbmd1YWdlOiAnRkJEJywgZmJkUHJvZ3JhbTogZmJkLCBsb2NhbFRhZ3MgfTtcbiAgfVxuICBpZiAoY2hpbGQoYm9keUVsLCAnU0ZDJykpIHtcbiAgICBjb25zdCBzZmMgPSBwYXJzZVNGQ0JvZHkoY2hpbGQoYm9keUVsLCAnU0ZDJyksIG5hbWUsIHVubWFwcGVkKTtcbiAgICByZXR1cm4geyBpZDogYHBvdS0ke25hbWV9YCwgbmFtZSwgcG91VHlwZTogbm9ybWFsaXplZFBvdVR5cGUsIGxhbmd1YWdlOiAnU0ZDJywgc2ZjUHJvZ3JhbTogc2ZjLCBsb2NhbFRhZ3MgfTtcbiAgfVxuICBpZiAoY2hpbGQoYm9keUVsLCAnU1QnKSkge1xuICAgIGNvbnN0IHN0RWwgPSBjaGlsZChib2R5RWwsICdTVCcpIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICAgIC8vIEhhbmRsZSBtdWx0aXBsZSB4aHRtbDpwIGVsZW1lbnRzIChvbmUgcGVyIGxpbmUpIG9yIHNpbmdsZSBlbGVtZW50XG4gICAgY29uc3QgcEVscyA9IGNoaWxkQXJyYXkoc3RFbCwgJ3hodG1sOnAnKTtcbiAgICBsZXQgcmF3U3JjOiBzdHJpbmc7XG4gICAgaWYgKHBFbHMubGVuZ3RoID4gMCkge1xuICAgICAgcmF3U3JjID0gcEVscy5tYXAocCA9PiB0ZXh0KHApIHx8ICcnKS5qb2luKCdcXG4nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmF3U3JjID0gdGV4dChjaGlsZChzdEVsLCAneGh0bWwnKSA/PyBzdEVsKSB8fCAnJztcbiAgICB9XG4gICAgY29uc3Qgc3JjID0gcmF3U3JjID8gdW5lc2NhcGVYTUwocmF3U3JjKSA6IHJhd1NyYztcbiAgICByZXR1cm4geyBpZDogYHBvdS0ke25hbWV9YCwgbmFtZSwgcG91VHlwZTogbm9ybWFsaXplZFBvdVR5cGUsIGxhbmd1YWdlOiAnU1QnLCBzdFNvdXJjZTogc3JjLCBsb2NhbFRhZ3MgfTtcbiAgfVxuICBpZiAoY2hpbGQoYm9keUVsLCAnSUwnKSkge1xuICAgIHVubWFwcGVkLnB1c2goeyBjbG1Ob2RlSWQ6IGBwb3UtJHtuYW1lfWAsIHZlbmRvclNwZWNpZmljRGF0YTogYm9keUVsLCByZWFzb246ICdJTCBsYW5ndWFnZSBub3Qgc3VwcG9ydGVkJyB9KTtcbiAgICByZXR1cm4geyBpZDogYHBvdS0ke25hbWV9YCwgbmFtZSwgcG91VHlwZTogbm9ybWFsaXplZFBvdVR5cGUsIGxhbmd1YWdlOiAnU1QnLCBzdFNvdXJjZTogJygqIElMIGltcG9ydCBub3Qgc3VwcG9ydGVkICopJywgbG9jYWxUYWdzIH07XG4gIH1cblxuICB1bm1hcHBlZC5wdXNoKHsgY2xtTm9kZUlkOiBgcG91LSR7bmFtZX1gLCB2ZW5kb3JTcGVjaWZpY0RhdGE6IGJvZHlFbCwgcmVhc29uOiAnVW5rbm93biBib2R5IGxhbmd1YWdlJyB9KTtcbiAgcmV0dXJuIHsgaWQ6IGBwb3UtJHtuYW1lfWAsIG5hbWUsIHBvdVR5cGU6IG5vcm1hbGl6ZWRQb3VUeXBlLCBsYW5ndWFnZTogJ0xEJywgbGFkZGVyUHJvZ3JhbTogeyBydW5nczogW10gfSwgbG9jYWxUYWdzIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBMRCBib2R5IHBhcnNlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gcGFyc2VMREJvZHkobGRFbDogdW5rbm93biwgcG91TmFtZTogc3RyaW5nLCB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10sIHJlc29sdmVyOiBWYXJpYWJsZVR5cGVSZXNvbHZlciA9IG5ldyBWYXJpYWJsZVR5cGVSZXNvbHZlcigpKTogTGFkZGVyUHJvZ3JhbSB7XG4gIGNvbnN0IHJ1bmdzOiBSdW5nW10gPSBbXTtcbiAgaWYgKCFsZEVsKSByZXR1cm4geyBydW5ncyB9O1xuXG4gIC8vIFNvbWUgZXhwb3J0ZXJzIHVzZSBmbGF0IExEIGJvZHkgd2l0aG91dCA8cnVuZz4gd3JhcHBlcnMgXHUyMDE0IHRyZWF0IHRoZSB3aG9sZSBMRCBhcyBvbmUgcnVuZ1xuICBsZXQgcnVuZ0VsZW1lbnRzID0gY2hpbGRBcnJheShsZEVsLCAncnVuZycpO1xuICBpZiAocnVuZ0VsZW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIC8vIFRyZWF0IHRoZSBlbnRpcmUgTEQgZWxlbWVudCBhcyBhIHNpbmdsZSBpbXBsaWNpdCBydW5nXG4gICAgcnVuZ0VsZW1lbnRzID0gW2xkRWwgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj5dO1xuICB9XG5cbiAgbGV0IHJ1bmdJZHggPSAwO1xuICBmb3IgKGNvbnN0IG5ldHdvcmtFbCBvZiBydW5nRWxlbWVudHMpIHtcbiAgICBydW5nSWR4Kys7XG4gICAgY29uc3QgY29tbWVudCA9IHRleHQoY2hpbGQobmV0d29ya0VsLCAnY29tbWVudCcpID8/IGNoaWxkKG5ldHdvcmtFbCwgJ2RvY3VtZW50YXRpb24nKSk7XG4gICAgY29uc3QgYWxsRWxlbWVudHM6IExhZGRlckVsZW1lbnRbXSA9IFtdO1xuICAgIGNvbnN0IGxvY2FsSWRNYXAgPSBuZXcgTWFwPHN0cmluZywgTGFkZGVyRWxlbWVudD4oKTtcblxuICAgIGZvciAoY29uc3QgY29udGFjdCBvZiBjaGlsZEFycmF5KG5ldHdvcmtFbCwgJ2NvbnRhY3QnKSkge1xuICAgICAgY29uc3QgZWwgPSBwYXJzZUxEQ29udGFjdChjb250YWN0LCBhbGxFbGVtZW50cy5sZW5ndGgsIHJlc29sdmVyKTtcbiAgICAgIGlmIChlbCkge1xuICAgICAgICBhbGxFbGVtZW50cy5wdXNoKGVsKTtcbiAgICAgICAgY29uc3QgbGlkID0gYXR0cihjb250YWN0LCAnbG9jYWxJZCcpO1xuICAgICAgICBpZiAobGlkKSBsb2NhbElkTWFwLnNldChsaWQsIGVsKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBjb2lsIG9mIGNoaWxkQXJyYXkobmV0d29ya0VsLCAnY29pbCcpKSB7XG4gICAgICBjb25zdCBlbCA9IHBhcnNlTERDb2lsKGNvaWwsIGFsbEVsZW1lbnRzLmxlbmd0aCwgcmVzb2x2ZXIpO1xuICAgICAgaWYgKGVsKSB7XG4gICAgICAgIGFsbEVsZW1lbnRzLnB1c2goZWwpO1xuICAgICAgICBjb25zdCBsaWQgPSBhdHRyKGNvaWwsICdsb2NhbElkJyk7XG4gICAgICAgIGlmIChsaWQpIGxvY2FsSWRNYXAuc2V0KGxpZCwgZWwpO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGJsb2NrIG9mIGNoaWxkQXJyYXkobmV0d29ya0VsLCAnYmxvY2snKSkge1xuICAgICAgY29uc3QgZWwgPSBwYXJzZUxEQmxvY2soYmxvY2ssIGFsbEVsZW1lbnRzLmxlbmd0aCwgdW5tYXBwZWQsIHJlc29sdmVyKTtcbiAgICAgIGlmIChlbCkge1xuICAgICAgICBhbGxFbGVtZW50cy5wdXNoKGVsKTtcbiAgICAgICAgY29uc3QgbGlkID0gYXR0cihibG9jaywgJ2xvY2FsSWQnKTtcbiAgICAgICAgaWYgKGxpZCkgbG9jYWxJZE1hcC5zZXQobGlkLCBlbCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQnVpbGQgd2lyZSBncmFwaCBmcm9tIGNvbm5lY3Rpb25Qb2ludEluIHJlZmVyZW5jZXNcbiAgICBjb25zdCBpbmNvbWluZ0VkZ2VzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZ1tdPigpOyAvLyBsb2NhbElkIFx1MjE5MiBbc291cmNlIGxvY2FsSWRzXVxuICAgIGZvciAoY29uc3QgZWxUYWcgb2YgWy4uLmNoaWxkQXJyYXkobmV0d29ya0VsLCAnY29udGFjdCcpLCAuLi5jaGlsZEFycmF5KG5ldHdvcmtFbCwgJ2NvaWwnKSwgLi4uY2hpbGRBcnJheShuZXR3b3JrRWwsICdibG9jaycpXSkge1xuICAgICAgY29uc3QgbG9jYWxJZCA9IGF0dHIoZWxUYWcsICdsb2NhbElkJyk7XG4gICAgICBpZiAoIWxvY2FsSWQpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgY3BJbiA9IGNoaWxkKGVsVGFnLCAnY29ubmVjdGlvblBvaW50SW4nKTtcbiAgICAgIGlmICghY3BJbikgY29udGludWU7XG4gICAgICBjb25zdCBjb25ucyA9IGNoaWxkQXJyYXkoY3BJbiwgJ2Nvbm5lY3Rpb24nKTtcbiAgICAgIGNvbnN0IHNvdXJjZXMgPSBjb25ucy5tYXAoYyA9PiBhdHRyKGMsICdyZWZMb2NhbElkJykpLmZpbHRlcihCb29sZWFuKSBhcyBzdHJpbmdbXTtcbiAgICAgIGlmIChzb3VyY2VzLmxlbmd0aCA+IDApIGluY29taW5nRWRnZXMuc2V0KGxvY2FsSWQsIHNvdXJjZXMpO1xuICAgIH1cblxuICAgIC8vIERldGVjdCBmYW4tb3V0IChvbmUgc291cmNlIFx1MjE5MiBtdWx0aXBsZSB0YXJnZXRzKTogaW5kaWNhdGVzIGJyYW5jaGluZ1xuICAgIGNvbnN0IG91dGdvaW5nID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZ1tdPigpOyAvLyBzb3VyY2VJZCBcdTIxOTIgW3RhcmdldElkc11cbiAgICBmb3IgKGNvbnN0IFt0YXJnZXQsIHNvdXJjZXNdIG9mIGluY29taW5nRWRnZXMpIHtcbiAgICAgIGZvciAoY29uc3Qgc3JjIG9mIHNvdXJjZXMpIHtcbiAgICAgICAgaWYgKCFvdXRnb2luZy5oYXMoc3JjKSkgb3V0Z29pbmcuc2V0KHNyYywgW10pO1xuICAgICAgICBvdXRnb2luZy5nZXQoc3JjKSEucHVzaCh0YXJnZXQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEZpbmQgYnJhbmNoIHBvaW50cyAoYW55IHNvdXJjZSB3aXRoID4gMSBvdXRnb2luZylcbiAgICBjb25zdCBicmFuY2hQb2ludHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBmb3IgKGNvbnN0IFtzcmMsIHRhcmdldHNdIG9mIG91dGdvaW5nKSB7XG4gICAgICBpZiAodGFyZ2V0cy5sZW5ndGggPiAxKSBicmFuY2hQb2ludHMuYWRkKHNyYyk7XG4gICAgfVxuXG4gICAgLy8gQnVpbGQgYnJhbmNoZXMgZnJvbSB0aGUgdG9wb2xvZ3lcbiAgICBjb25zdCBicmFuY2hlczogaW1wb3J0KCcuLi8uLi9sb2dpY1N0b3JlLmpzJykuQnJhbmNoW10gPSBbXTtcbiAgICBjb25zdCBicmFuY2hFbGVtZW50cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gICAgaWYgKGJyYW5jaFBvaW50cy5zaXplID4gMCkge1xuICAgICAgZm9yIChjb25zdCBicmFuY2hTcmMgb2YgYnJhbmNoUG9pbnRzKSB7XG4gICAgICAgIGNvbnN0IHRhcmdldHMgPSBvdXRnb2luZy5nZXQoYnJhbmNoU3JjKSB8fCBbXTtcbiAgICAgICAgLy8gRmlyc3QgdGFyZ2V0IGlzIHRoZSBtYWluIHBhdGgsIHJlbWFpbmluZyBhcmUgYnJhbmNoZXNcbiAgICAgICAgZm9yIChsZXQgYmkgPSAxOyBiaSA8IHRhcmdldHMubGVuZ3RoOyBiaSsrKSB7XG4gICAgICAgICAgY29uc3QgYnJhbmNoUGF0aDogTGFkZGVyRWxlbWVudFtdID0gW107XG4gICAgICAgICAgbGV0IGN1cnJlbnQ6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHRhcmdldHNbYmldO1xuICAgICAgICAgIGNvbnN0IHZpc2l0ZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICAgICAgICB3aGlsZSAoY3VycmVudCAmJiAhdmlzaXRlZC5oYXMoY3VycmVudCkpIHtcbiAgICAgICAgICAgIHZpc2l0ZWQuYWRkKGN1cnJlbnQpO1xuICAgICAgICAgICAgY29uc3QgZWwgPSBsb2NhbElkTWFwLmdldChjdXJyZW50KTtcbiAgICAgICAgICAgIGlmIChlbCkge1xuICAgICAgICAgICAgICBicmFuY2hQYXRoLnB1c2goZWwpO1xuICAgICAgICAgICAgICBicmFuY2hFbGVtZW50cy5hZGQoY3VycmVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBGb2xsb3cgdGhlIHNpbmdsZSBvdXRnb2luZyBmcm9tIHRoaXMgZWxlbWVudFxuICAgICAgICAgICAgY29uc3QgbmV4dFRhcmdldHMgPSBvdXRnb2luZy5nZXQoY3VycmVudCkgfHwgW107XG4gICAgICAgICAgICBjdXJyZW50ID0gbmV4dFRhcmdldHMubGVuZ3RoID09PSAxID8gbmV4dFRhcmdldHNbMF0gOiB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChicmFuY2hQYXRoLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGJyYW5jaGVzLnB1c2goe1xuICAgICAgICAgICAgICBpZDogYCR7cG91TmFtZX0tcnVuZy0ke3J1bmdJZHh9LWJyYW5jaC0ke2JpfWAsXG4gICAgICAgICAgICAgIHN0YXJ0Tm9kZUlkOiBicmFuY2hTcmMsXG4gICAgICAgICAgICAgIGVuZE5vZGVJZDogYnJhbmNoUGF0aFticmFuY2hQYXRoLmxlbmd0aCAtIDFdLmlkLFxuICAgICAgICAgICAgICBlbGVtZW50czogYnJhbmNoUGF0aCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1haW4gZWxlbWVudHMgPSBhbGwgZWxlbWVudHMgbWludXMgdGhvc2UgY29uc3VtZWQgYnkgYnJhbmNoZXNcbiAgICBjb25zdCBtYWluRWxlbWVudHMgPSBhbGxFbGVtZW50cy5maWx0ZXIoZWwgPT4ge1xuICAgICAgY29uc3QgbGlkID0gWy4uLmxvY2FsSWRNYXAuZW50cmllcygpXS5maW5kKChbXywgdl0pID0+IHYgPT09IGVsKT8uWzBdO1xuICAgICAgcmV0dXJuICFsaWQgfHwgIWJyYW5jaEVsZW1lbnRzLmhhcyhsaWQpO1xuICAgIH0pO1xuXG4gICAgbWFpbkVsZW1lbnRzLnNvcnQoKGEsIGIpID0+IGEucG9zaXRpb24ueCAtIGIucG9zaXRpb24ueCk7XG5cbiAgICBydW5ncy5wdXNoKHsgaWQ6IGAke3BvdU5hbWV9LXJ1bmctJHtydW5nSWR4fWAsIG51bWJlcjogcnVuZ0lkeCwgY29tbWVudCwgZWxlbWVudHM6IG1haW5FbGVtZW50cywgYnJhbmNoZXMgfSk7XG4gIH1cblxuICByZXR1cm4geyBydW5ncyB9O1xufVxuXG5mdW5jdGlvbiBwYXJzZUxEQ29udGFjdChjb250YWN0RWw6IHVua25vd24sIGlkeDogbnVtYmVyLCByZXNvbHZlcjogVmFyaWFibGVUeXBlUmVzb2x2ZXIgPSBuZXcgVmFyaWFibGVUeXBlUmVzb2x2ZXIoKSk6IENvbnRhY3RFbGVtZW50IHwgbnVsbCB7XG4gIGlmICghY29udGFjdEVsIHx8IHR5cGVvZiBjb250YWN0RWwgIT09ICdvYmplY3QnKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgbG9jYWxJZCA9IGF0dHIoY29udGFjdEVsLCAnbG9jYWxJZCcpO1xuICBjb25zdCBuZWdhdGVkID0gYXR0cihjb250YWN0RWwsICduZWdhdGVkJykgPT09ICd0cnVlJztcbiAgY29uc3QgZWRnZU1vZGlmaWVyID0gYXR0cihjb250YWN0RWwsICdlZGdlJyk7IC8vICdyaXNpbmcnIHwgJ2ZhbGxpbmcnXG4gIGNvbnN0IHZhckVsID0gY2hpbGQoY29udGFjdEVsLCAndmFyaWFibGUnKTtcbiAgY29uc3QgdGFnTmFtZSA9IHZhckVsID8gdGV4dCh2YXJFbCkgOiBhdHRyKGNvbnRhY3RFbCwgJ3ZhcmlhYmxlJyk7XG4gIGlmICghdGFnTmFtZSkgcmV0dXJuIG51bGw7XG5cbiAgbGV0IHR5cGU6IENvbnRhY3RUeXBlID0gbmVnYXRlZCA/ICdOQycgOiAnTk8nO1xuICBpZiAoZWRnZU1vZGlmaWVyID09PSAncmlzaW5nJykgdHlwZSA9ICdQX0NPTlRBQ1QnO1xuICBpZiAoZWRnZU1vZGlmaWVyID09PSAnZmFsbGluZycpIHR5cGUgPSAnTl9DT05UQUNUJztcblxuICBjb25zdCBwb3NFbCA9IGNoaWxkKGNvbnRhY3RFbCwgJ3Bvc2l0aW9uJyk7XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAnY29udGFjdCcsXG4gICAgaWQ6IGBsZC1jb250YWN0LSR7bG9jYWxJZCB8fCBpZHh9YCxcbiAgICB0eXBlLFxuICAgIHRhZzogeyBuYW1lOiB0YWdOYW1lLCBkYXRhVHlwZTogcmVzb2x2ZXIucmVzb2x2ZSh0YWdOYW1lKSB9LFxuICAgIHBvc2l0aW9uOiB7IHg6IE51bWJlcihhdHRyKHBvc0VsLCAneCcpKSB8fCBpZHggKiA2MCwgeTogTnVtYmVyKGF0dHIocG9zRWwsICd5JykpIHx8IDAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gcGFyc2VMRENvaWwoY29pbEVsOiB1bmtub3duLCBpZHg6IG51bWJlciwgcmVzb2x2ZXI6IFZhcmlhYmxlVHlwZVJlc29sdmVyID0gbmV3IFZhcmlhYmxlVHlwZVJlc29sdmVyKCkpOiBDb2lsRWxlbWVudCB8IG51bGwge1xuICBpZiAoIWNvaWxFbCB8fCB0eXBlb2YgY29pbEVsICE9PSAnb2JqZWN0JykgcmV0dXJuIG51bGw7XG4gIGNvbnN0IGxvY2FsSWQgPSBhdHRyKGNvaWxFbCwgJ2xvY2FsSWQnKTtcbiAgY29uc3QgbmVnYXRlZCA9IGF0dHIoY29pbEVsLCAnbmVnYXRlZCcpID09PSAndHJ1ZSc7XG4gIGNvbnN0IHN0b3JhZ2UgPSBhdHRyKGNvaWxFbCwgJ3N0b3JhZ2UnKTsgLy8gJ3NldCcgfCAncmVzZXQnIHwgJ3JldGVudGl2ZSdcbiAgY29uc3QgZWRnZU1vZGlmaWVyID0gYXR0cihjb2lsRWwsICdlZGdlJyk7IC8vICdyaXNpbmcnIHwgJ2ZhbGxpbmcnXG4gIGNvbnN0IHZhckVsID0gY2hpbGQoY29pbEVsLCAndmFyaWFibGUnKTtcbiAgY29uc3QgdGFnTmFtZSA9IHZhckVsID8gdGV4dCh2YXJFbCkgOiBhdHRyKGNvaWxFbCwgJ3ZhcmlhYmxlJyk7XG4gIGlmICghdGFnTmFtZSkgcmV0dXJuIG51bGw7XG5cbiAgbGV0IHR5cGU6IENvaWxUeXBlID0gJ25vcm1hbCc7XG4gIGlmIChuZWdhdGVkKSB0eXBlID0gJ25lZ2F0ZWQnO1xuICBpZiAoc3RvcmFnZSA9PT0gJ3NldCcpIHR5cGUgPSAnc2V0JztcbiAgaWYgKHN0b3JhZ2UgPT09ICdyZXNldCcpIHR5cGUgPSAncmVzZXQnO1xuICBpZiAoc3RvcmFnZSA9PT0gJ3JldGVudGl2ZScpIHR5cGUgPSAnbGF0Y2gnO1xuICBpZiAoZWRnZU1vZGlmaWVyID09PSAncmlzaW5nJykgdHlwZSA9ICdwb3NpdGl2ZV90cmFuc2l0aW9uJyBhcyBDb2lsVHlwZTtcbiAgaWYgKGVkZ2VNb2RpZmllciA9PT0gJ2ZhbGxpbmcnKSB0eXBlID0gJ25lZ2F0aXZlX3RyYW5zaXRpb24nIGFzIENvaWxUeXBlO1xuXG4gIGNvbnN0IHBvc0VsID0gY2hpbGQoY29pbEVsLCAncG9zaXRpb24nKTtcblxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICdjb2lsJyxcbiAgICBpZDogYGxkLWNvaWwtJHtsb2NhbElkIHx8IGlkeH1gLFxuICAgIHR5cGUsXG4gICAgdGFnOiB7IG5hbWU6IHRhZ05hbWUsIGRhdGFUeXBlOiByZXNvbHZlci5yZXNvbHZlKHRhZ05hbWUpIH0sXG4gICAgcG9zaXRpb246IHsgeDogTnVtYmVyKGF0dHIocG9zRWwsICd4JykpIHx8IChpZHggKyAxKSAqIDYwLCB5OiBOdW1iZXIoYXR0cihwb3NFbCwgJ3knKSkgfHwgMCB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBwYXJzZUxEQmxvY2soYmxvY2tFbDogdW5rbm93biwgaWR4OiBudW1iZXIsIHVubWFwcGVkOiBVbm1hcHBlZEVsZW1lbnRbXSwgcmVzb2x2ZXI6IFZhcmlhYmxlVHlwZVJlc29sdmVyID0gbmV3IFZhcmlhYmxlVHlwZVJlc29sdmVyKCkpOiBCbG9ja0VsZW1lbnQgfCBudWxsIHtcbiAgaWYgKCFibG9ja0VsIHx8IHR5cGVvZiBibG9ja0VsICE9PSAnb2JqZWN0JykgcmV0dXJuIG51bGw7XG4gIGNvbnN0IGxvY2FsSWQgPSBhdHRyKGJsb2NrRWwsICdsb2NhbElkJyk7XG4gIGNvbnN0IHR5cGVOYW1lID0gYXR0cihibG9ja0VsLCAndHlwZU5hbWUnKSB8fCAnJztcbiAgY29uc3QgaW5zdGFuY2VOYW1lID0gYXR0cihibG9ja0VsLCAnaW5zdGFuY2VOYW1lJykgfHwgdHlwZU5hbWU7XG4gIGNvbnN0IGZiVHlwZU1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICBUT046J1RPTicsVE9GOidUT0YnLFRQOidUUCcsQ1RVOidDVFUnLENURDonQ1REJyxDVFVEOidDVFVEJyxcbiAgICBTUjonU1InLFJTOidSUycsUl9UUklHOidSVFJJRycsRl9UUklHOidGVFJJRycsXG4gICAgQUREOidBREQnLFNVQjonU1VCJyxNVUw6J01VTCcsRElWOidESVYnLE1PRDonTU9EJyxcbiAgICBHVDonR1QnLEdFOidHRScsTFQ6J0xUJyxMRTonTEUnLEVROidFUScsTkU6J05FJyxcbiAgICBTRUw6J1NFTCcsTVVYOidNVVgnLExJTUlUOidMSU1JVCcsTU9WRTonTU9WRScsXG4gICAgQU5EOidBTkQnLE9SOidPUicsWE9SOidYT1InLE5PVDonTk9UJyxcbiAgICBBQlM6J0FCUycsU1FSVDonU1FSVCcsTE46J0xOJyxMT0c6J0xPRycsRVhQOidFWFAnLFxuICAgIFNJTjonU0lOJyxDT1M6J0NPUycsVEFOOidUQU4nLEFTSU46J0FTSU4nLEFDT1M6J0FDT1MnLEFUQU46J0FUQU4nLFxuICAgIE1BWDonTUFYJyxNSU46J01JTicsXG4gIH07XG4gIGNvbnN0IGZiVHlwZSA9IGZiVHlwZU1hcFt0eXBlTmFtZS50b1VwcGVyQ2FzZSgpXSB8fCB0eXBlTmFtZTtcblxuICAvLyBDb2xsZWN0IHJhdyBwaW5cdTIxOTJ2YXJpYWJsZS1uYW1lIG1hcHBpbmdzIGZyb20gdGhlIFhNTFxuICBjb25zdCByYXdQaW5zOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gIGZvciAoY29uc3QgdmFyRWwgb2YgY2hpbGRBcnJheShibG9ja0VsLCAnaW5wdXRWYXJpYWJsZScpLmNvbmNhdChjaGlsZEFycmF5KGJsb2NrRWwsICdvdXRwdXRWYXJpYWJsZScpKSkge1xuICAgIGNvbnN0IHBpbk5hbWUgPSBhdHRyKHZhckVsLCAnZm9ybWFsUGFyYW1ldGVyJyk7XG4gICAgY29uc3QgY29ubkVsID0gY2hpbGQodmFyRWwsICdjb25uZWN0aW9uUG9pbnRJbicpID8/IGNoaWxkKHZhckVsLCAnY29ubmVjdGlvblBvaW50T3V0Jyk7XG4gICAgY29uc3QgY29ubkNoaWxkID0gY2hpbGQoY29ubkVsLCAnY29ubmVjdGlvbicpO1xuICAgIGNvbnN0IGNvbm5OYW1lID0gYXR0cihjb25uQ2hpbGQsICdyZWZMb2NhbElkJykgfHwgdGV4dChjb25uQ2hpbGQpIHx8IGF0dHIodmFyRWwsICdmb3JtYWxQYXJhbWV0ZXInKSB8fCAnJztcbiAgICBpZiAocGluTmFtZSkgcmF3UGluc1twaW5OYW1lXSA9IGNvbm5OYW1lO1xuICB9XG5cbiAgLy8gQnVpbGQgdHlwZWQgcGluczogY2Fub25pY2FsIHR5cGVzIGZyb20gcGluU2lnbmF0dXJlcywgcmVzb2x2ZWQgdmFyaWFibGUgdHlwZXMgYXMgZmFsbGJhY2tcbiAgY29uc3QgdHlwZWRQaW5zID0gYnVpbGRUeXBlZFRhZ1JlZlBpbnMoZmJUeXBlLCByYXdQaW5zKTtcbiAgLy8gT3ZlcnJpZGUgY2Fub25pY2FsIHR5cGUgd2l0aCByZXNvbHZlciB0eXBlIHdoZXJlIHdlIGhhdmUgYSBjb25jcmV0ZSB2YXJpYWJsZSBuYW1lXG4gIGNvbnN0IHBpbnM6IFJlY29yZDxzdHJpbmcsIFRhZ1JlZj4gPSB7fTtcbiAgZm9yIChjb25zdCBbcGluTmFtZSwgcGluRGVmXSBvZiBPYmplY3QuZW50cmllcyh0eXBlZFBpbnMpKSB7XG4gICAgY29uc3QgdmFyTmFtZSA9IHBpbkRlZi5uYW1lO1xuICAgIGNvbnN0IHJlc29sdmVkVHlwZSA9IHZhck5hbWUgPyByZXNvbHZlci5yZXNvbHZlKHZhck5hbWUpIDogbnVsbDtcbiAgICBwaW5zW3Bpbk5hbWVdID0ge1xuICAgICAgbmFtZTogdmFyTmFtZSxcbiAgICAgIC8vIFVzZSByZXNvbHZlZCB2YXJpYWJsZSB0eXBlIHdoZW4gaXQncyBtb3JlIHNwZWNpZmljIHRoYW4gQk9PTCBjYW5vbmljYWwgZGVmYXVsdFxuICAgICAgZGF0YVR5cGU6IChyZXNvbHZlZFR5cGUgJiYgcmVzb2x2ZWRUeXBlICE9PSAnQk9PTCcpID8gcmVzb2x2ZWRUeXBlIDogcGluRGVmLmRhdGFUeXBlLFxuICAgIH07XG4gIH1cblxuICBjb25zdCBwb3NFbCA9IGNoaWxkKGJsb2NrRWwsICdwb3NpdGlvbicpO1xuICBjb25zdCBweCA9IE51bWJlcihhdHRyKHBvc0VsLCAneCcpKSB8fCBpZHggKiA2MDtcbiAgY29uc3QgcHkgPSBOdW1iZXIoYXR0cihwb3NFbCwgJ3knKSkgfHwgMDtcblxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICdibG9jaycsXG4gICAgaWQ6IGBsZC1ibG9jay0ke2xvY2FsSWQgfHwgaWR4fWAsXG4gICAgZmJUeXBlOiBmYlR5cGUgYXMgYW55LFxuICAgIGluc3RhbmNlTmFtZSxcbiAgICBwaW5zLFxuICAgIHBvc2l0aW9uOiB7IHg6IHB4LCB5OiBweSB9LFxuICB9O1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgRkJEIGJvZHkgcGFyc2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBwYXJzZUZCREJvZHkoZmJkRWw6IHVua25vd24sIHBvdU5hbWU6IHN0cmluZywgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdLCByZXNvbHZlcjogVmFyaWFibGVUeXBlUmVzb2x2ZXIgPSBuZXcgVmFyaWFibGVUeXBlUmVzb2x2ZXIoKSk6IEZCRFByb2dyYW0ge1xuICBjb25zdCBub2RlczogRkJETm9kZVtdID0gW107XG4gIGNvbnN0IHdpcmVzOiBGQkRXaXJlW10gPSBbXTtcbiAgaWYgKCFmYmRFbCkgcmV0dXJuIHsgbm9kZXMsIHdpcmVzIH07XG5cbiAgLy8gUGFyc2UgbGFiZWwgZWxlbWVudHMgKGp1bXAgdGFyZ2V0cyBpbiBGQkQpXG4gIGZvciAoY29uc3QgbGFiZWxFbCBvZiBjaGlsZEFycmF5KGZiZEVsLCAnbGFiZWwnKSkge1xuICAgIGNvbnN0IGxvY2FsSWQgPSBhdHRyKGxhYmVsRWwsICdsb2NhbElkJyk7XG4gICAgY29uc3QgcG9zRWwgPSBjaGlsZChsYWJlbEVsLCAncG9zaXRpb24nKTtcbiAgICBjb25zdCBsYWJlbE5hbWUgPSBhdHRyKGxhYmVsRWwsICdsYWJlbCcpIHx8ICcnO1xuICAgIG5vZGVzLnB1c2goe1xuICAgICAgaWQ6IGBmYmQtJHtsb2NhbElkfWAsXG4gICAgICB0eXBlOiAnTEFCRUwnIGFzIEZCREJsb2NrVHlwZSxcbiAgICAgIGluc3RhbmNlTmFtZTogbGFiZWxOYW1lLFxuICAgICAgcG9zaXRpb246IHsgeDogTnVtYmVyKGF0dHIocG9zRWwsICd4JykpIHx8IDAsIHk6IE51bWJlcihhdHRyKHBvc0VsLCAneScpKSB8fCAwIH0sXG4gICAgICBpbnB1dHM6IFt7IGlkOiBgbGFiZWwtJHtsb2NhbElkfS1pbmAsIG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgICBvdXRwdXRzOiBbXSxcbiAgICB9KTtcbiAgICBjb25zdCBjcEluID0gY2hpbGQobGFiZWxFbCwgJ2Nvbm5lY3Rpb25Qb2ludEluJyk7XG4gICAgaWYgKGNwSW4pIHtcbiAgICAgIGZvciAoY29uc3QgY29ubiBvZiBjaGlsZEFycmF5KGNwSW4sICdjb25uZWN0aW9uJykpIHtcbiAgICAgICAgY29uc3QgcmVmSWQgPSBhdHRyKGNvbm4sICdyZWZMb2NhbElkJyk7XG4gICAgICAgIGNvbnN0IGZyb21QaW4gPSBhdHRyKGNvbm4sICdmb3JtYWxQYXJhbWV0ZXInKSB8fCAnT1VUJztcbiAgICAgICAgaWYgKHJlZklkKSB7XG4gICAgICAgICAgd2lyZXMucHVzaCh7IGlkOiBgd2lyZS0ke3JlZklkfS10by1sYWJlbC0ke2xvY2FsSWR9YCwgZnJvbTogeyBub2RlSWQ6IGBmYmQtJHtyZWZJZH1gLCBwaW46IGZyb21QaW4gfSwgdG86IHsgbm9kZUlkOiBgZmJkLSR7bG9jYWxJZH1gLCBwaW46ICdJTicgfSB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFBhcnNlIGp1bXAgZWxlbWVudHMgKHVuY29uZGl0aW9uYWwganVtcCB0byBsYWJlbCBpbiBGQkQpXG4gIGZvciAoY29uc3QganVtcEVsIG9mIGNoaWxkQXJyYXkoZmJkRWwsICdqdW1wJykpIHtcbiAgICBjb25zdCBsb2NhbElkID0gYXR0cihqdW1wRWwsICdsb2NhbElkJyk7XG4gICAgY29uc3QgcG9zRWwgPSBjaGlsZChqdW1wRWwsICdwb3NpdGlvbicpO1xuICAgIGNvbnN0IGxhYmVsTmFtZSA9IGF0dHIoanVtcEVsLCAnbGFiZWwnKSB8fCAnJztcbiAgICBub2Rlcy5wdXNoKHtcbiAgICAgIGlkOiBgZmJkLSR7bG9jYWxJZH1gLFxuICAgICAgdHlwZTogJ0pVTVAnIGFzIEZCREJsb2NrVHlwZSxcbiAgICAgIGluc3RhbmNlTmFtZTogbGFiZWxOYW1lLFxuICAgICAgcG9zaXRpb246IHsgeDogTnVtYmVyKGF0dHIocG9zRWwsICd4JykpIHx8IDAsIHk6IE51bWJlcihhdHRyKHBvc0VsLCAneScpKSB8fCAwIH0sXG4gICAgICBpbnB1dHM6IFt7IGlkOiBganVtcC0ke2xvY2FsSWR9LWluYCwgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdCT09MJyB9XSxcbiAgICAgIG91dHB1dHM6IFtdLFxuICAgIH0pO1xuICAgIGNvbnN0IGNwSW4gPSBjaGlsZChqdW1wRWwsICdjb25uZWN0aW9uUG9pbnRJbicpO1xuICAgIGlmIChjcEluKSB7XG4gICAgICBmb3IgKGNvbnN0IGNvbm4gb2YgY2hpbGRBcnJheShjcEluLCAnY29ubmVjdGlvbicpKSB7XG4gICAgICAgIGNvbnN0IHJlZklkID0gYXR0cihjb25uLCAncmVmTG9jYWxJZCcpO1xuICAgICAgICBjb25zdCBmcm9tUGluID0gYXR0cihjb25uLCAnZm9ybWFsUGFyYW1ldGVyJykgfHwgJ09VVCc7XG4gICAgICAgIGlmIChyZWZJZCkge1xuICAgICAgICAgIHdpcmVzLnB1c2goeyBpZDogYHdpcmUtJHtyZWZJZH0tdG8tanVtcC0ke2xvY2FsSWR9YCwgZnJvbTogeyBub2RlSWQ6IGBmYmQtJHtyZWZJZH1gLCBwaW46IGZyb21QaW4gfSwgdG86IHsgbm9kZUlkOiBgZmJkLSR7bG9jYWxJZH1gLCBwaW46ICdJTicgfSB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFBhcnNlIHJldHVybiBlbGVtZW50c1xuICBmb3IgKGNvbnN0IHJldEVsIG9mIGNoaWxkQXJyYXkoZmJkRWwsICdyZXR1cm4nKSkge1xuICAgIGNvbnN0IGxvY2FsSWQgPSBhdHRyKHJldEVsLCAnbG9jYWxJZCcpO1xuICAgIGNvbnN0IHBvc0VsID0gY2hpbGQocmV0RWwsICdwb3NpdGlvbicpO1xuICAgIG5vZGVzLnB1c2goe1xuICAgICAgaWQ6IGBmYmQtJHtsb2NhbElkfWAsXG4gICAgICB0eXBlOiAnUkVUVVJOJyBhcyBGQkRCbG9ja1R5cGUsXG4gICAgICBpbnN0YW5jZU5hbWU6ICdSRVRVUk4nLFxuICAgICAgcG9zaXRpb246IHsgeDogTnVtYmVyKGF0dHIocG9zRWwsICd4JykpIHx8IDAsIHk6IE51bWJlcihhdHRyKHBvc0VsLCAneScpKSB8fCAwIH0sXG4gICAgICBpbnB1dHM6IFt7IGlkOiBgcmV0dXJuLSR7bG9jYWxJZH0taW5gLCBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICAgICAgb3V0cHV0czogW10sXG4gICAgfSk7XG4gICAgY29uc3QgY3BJbiA9IGNoaWxkKHJldEVsLCAnY29ubmVjdGlvblBvaW50SW4nKTtcbiAgICBpZiAoY3BJbikge1xuICAgICAgZm9yIChjb25zdCBjb25uIG9mIGNoaWxkQXJyYXkoY3BJbiwgJ2Nvbm5lY3Rpb24nKSkge1xuICAgICAgICBjb25zdCByZWZJZCA9IGF0dHIoY29ubiwgJ3JlZkxvY2FsSWQnKTtcbiAgICAgICAgY29uc3QgZnJvbVBpbiA9IGF0dHIoY29ubiwgJ2Zvcm1hbFBhcmFtZXRlcicpIHx8ICdPVVQnO1xuICAgICAgICBpZiAocmVmSWQpIHtcbiAgICAgICAgICB3aXJlcy5wdXNoKHsgaWQ6IGB3aXJlLSR7cmVmSWR9LXRvLXJldHVybi0ke2xvY2FsSWR9YCwgZnJvbTogeyBub2RlSWQ6IGBmYmQtJHtyZWZJZH1gLCBwaW46IGZyb21QaW4gfSwgdG86IHsgbm9kZUlkOiBgZmJkLSR7bG9jYWxJZH1gLCBwaW46ICdJTicgfSB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFBhcnNlIGNvbm5lY3RvciBlbGVtZW50cyAobmFtZWQgc2lnbmFsIHNpbmsgXHUyMDE0IHBhaXJzIHdpdGggY29udGludWF0aW9uKVxuICBmb3IgKGNvbnN0IGNvbm5FbCBvZiBjaGlsZEFycmF5KGZiZEVsLCAnY29ubmVjdG9yJykpIHtcbiAgICBjb25zdCBsb2NhbElkID0gYXR0cihjb25uRWwsICdsb2NhbElkJyk7XG4gICAgY29uc3QgcG9zRWwgPSBjaGlsZChjb25uRWwsICdwb3NpdGlvbicpO1xuICAgIGNvbnN0IGNvbm5OYW1lID0gYXR0cihjb25uRWwsICduYW1lJykgfHwgJyc7XG4gICAgbm9kZXMucHVzaCh7XG4gICAgICBpZDogYGZiZC0ke2xvY2FsSWR9YCxcbiAgICAgIHR5cGU6ICdDT05ORUNUT1InIGFzIEZCREJsb2NrVHlwZSxcbiAgICAgIGluc3RhbmNlTmFtZTogY29ubk5hbWUsXG4gICAgICBwb3NpdGlvbjogeyB4OiBOdW1iZXIoYXR0cihwb3NFbCwgJ3gnKSkgfHwgMCwgeTogTnVtYmVyKGF0dHIocG9zRWwsICd5JykpIHx8IDAgfSxcbiAgICAgIGlucHV0czogW3sgaWQ6IGBjb25uZWN0b3ItJHtsb2NhbElkfS1pbmAsIG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgICBvdXRwdXRzOiBbXSxcbiAgICB9KTtcbiAgICBjb25zdCBjcEluID0gY2hpbGQoY29ubkVsLCAnY29ubmVjdGlvblBvaW50SW4nKTtcbiAgICBpZiAoY3BJbikge1xuICAgICAgZm9yIChjb25zdCBjb25uIG9mIGNoaWxkQXJyYXkoY3BJbiwgJ2Nvbm5lY3Rpb24nKSkge1xuICAgICAgICBjb25zdCByZWZJZCA9IGF0dHIoY29ubiwgJ3JlZkxvY2FsSWQnKTtcbiAgICAgICAgY29uc3QgZnJvbVBpbiA9IGF0dHIoY29ubiwgJ2Zvcm1hbFBhcmFtZXRlcicpIHx8ICdPVVQnO1xuICAgICAgICBpZiAocmVmSWQpIHtcbiAgICAgICAgICB3aXJlcy5wdXNoKHsgaWQ6IGB3aXJlLSR7cmVmSWR9LXRvLWNvbm5lY3Rvci0ke2xvY2FsSWR9YCwgZnJvbTogeyBub2RlSWQ6IGBmYmQtJHtyZWZJZH1gLCBwaW46IGZyb21QaW4gfSwgdG86IHsgbm9kZUlkOiBgZmJkLSR7bG9jYWxJZH1gLCBwaW46ICdJTicgfSB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFBhcnNlIGNvbnRpbnVhdGlvbiBlbGVtZW50cyAobmFtZWQgc2lnbmFsIHNvdXJjZSBcdTIwMTQgcGFpcnMgd2l0aCBjb25uZWN0b3IpXG4gIGZvciAoY29uc3QgY29udEVsIG9mIGNoaWxkQXJyYXkoZmJkRWwsICdjb250aW51YXRpb24nKSkge1xuICAgIGNvbnN0IGxvY2FsSWQgPSBhdHRyKGNvbnRFbCwgJ2xvY2FsSWQnKTtcbiAgICBjb25zdCBwb3NFbCA9IGNoaWxkKGNvbnRFbCwgJ3Bvc2l0aW9uJyk7XG4gICAgY29uc3QgY29udE5hbWUgPSBhdHRyKGNvbnRFbCwgJ25hbWUnKSB8fCAnJztcbiAgICBub2Rlcy5wdXNoKHtcbiAgICAgIGlkOiBgZmJkLSR7bG9jYWxJZH1gLFxuICAgICAgdHlwZTogJ0NPTlRJTlVBVElPTicgYXMgRkJEQmxvY2tUeXBlLFxuICAgICAgaW5zdGFuY2VOYW1lOiBjb250TmFtZSxcbiAgICAgIHBvc2l0aW9uOiB7IHg6IE51bWJlcihhdHRyKHBvc0VsLCAneCcpKSB8fCAwLCB5OiBOdW1iZXIoYXR0cihwb3NFbCwgJ3knKSkgfHwgMCB9LFxuICAgICAgaW5wdXRzOiBbXSxcbiAgICAgIG91dHB1dHM6IFt7IGlkOiBgY29udGludWF0aW9uLSR7bG9jYWxJZH0tb3V0YCwgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgfSk7XG4gIH1cblxuICBjb25zdCB3aXJlTWFwID0gbmV3IE1hcDxzdHJpbmcsIHsgbm9kZUlkOiBzdHJpbmc7IHBpbjogc3RyaW5nIH0+KCk7IC8vIGNvbm5lY3Rpb25JZCBcdTIxOTIgc291cmNlIHBpblxuXG4gIGZvciAoY29uc3QgYmxvY2tFbCBvZiBjaGlsZEFycmF5KGZiZEVsLCAnYmxvY2snKSkge1xuICAgIGNvbnN0IGxvY2FsSWQgPSBhdHRyKGJsb2NrRWwsICdsb2NhbElkJyk7XG4gICAgY29uc3QgdHlwZU5hbWUgPSBhdHRyKGJsb2NrRWwsICd0eXBlTmFtZScpIHx8ICcnO1xuICAgIGNvbnN0IGluc3RhbmNlTmFtZSA9IGF0dHIoYmxvY2tFbCwgJ2luc3RhbmNlTmFtZScpIHx8IGAke3R5cGVOYW1lfV8ke2xvY2FsSWR9YDtcbiAgICBjb25zdCBwb3NFbCA9IGNoaWxkKGJsb2NrRWwsICdwb3NpdGlvbicpO1xuICAgIGNvbnN0IHggPSBOdW1iZXIoYXR0cihwb3NFbCwgJ3gnKSkgfHwgMDtcbiAgICBjb25zdCB5ID0gTnVtYmVyKGF0dHIocG9zRWwsICd5JykpIHx8IDA7XG5cbiAgICAvLyBCdWlsZCB0eXBlZCBwaW4gYXJyYXlzIGZyb20gY2Fub25pY2FsIHNpZ25hdHVyZVxuICAgIGNvbnN0IHsgaW5wdXRzOiBzaWdJbnB1dHMsIG91dHB1dHM6IHNpZ091dHB1dHMgfSA9IGJ1aWxkVHlwZWRQaW5zKHR5cGVOYW1lLCBbXSwgYGZiZC0ke2xvY2FsSWR9YCk7XG4gICAgLy8gQnVpbGQgYSBsb29rdXAgc28gd2UgY2FuIG92ZXJyaWRlIHdpdGggYWN0dWFsIG5lZ2F0ZWQgZmxhZ3MgZnJvbSBYTUxcbiAgICBjb25zdCBpbnB1dHNCeU5hbWUgPSBuZXcgTWFwKHNpZ0lucHV0cy5tYXAocCA9PiBbcC5uYW1lLCB7IC4uLnAgfV0pKTtcbiAgICBjb25zdCBvdXRwdXRzQnlOYW1lID0gbmV3IE1hcChzaWdPdXRwdXRzLm1hcChwID0+IFtwLm5hbWUsIHsgLi4ucCB9XSkpO1xuXG4gICAgLy8gU29tZSB0b29scyAoQ09ERVNZUywgQmVja2hvZmYpIG9taXQgdGhlIGlucHV0VmFyaWFibGVzIHdyYXBwZXJcbiAgICBjb25zdCBkaXJlY3RWYXJzID0gY2hpbGRBcnJheShibG9ja0VsLCAndmFyaWFibGUnKTtcbiAgICBjb25zdCBpbnB1dFZhckVscyA9IChjaGlsZEFycmF5KGJsb2NrRWwsICdpbnB1dFZhcmlhYmxlcycpLmZsYXRNYXAoaXYgPT4gY2hpbGRBcnJheShpdiwgJ3ZhcmlhYmxlJykpKVxuICAgICAgLmNvbmNhdChkaXJlY3RWYXJzLmZpbHRlcih2ID0+IGNoaWxkKHYsICdjb25uZWN0aW9uUG9pbnRJbicpICE9PSBudWxsICYmIGNoaWxkKHYsICdjb25uZWN0aW9uUG9pbnRJbicpICE9PSB1bmRlZmluZWQpKTtcblxuICAgIGZvciAoY29uc3QgaW5WYXIgb2YgaW5wdXRWYXJFbHMpIHtcbiAgICAgIGNvbnN0IHBpbk5hbWUgPSBhdHRyKGluVmFyLCAnZm9ybWFsUGFyYW1ldGVyJykgfHwgJyc7XG4gICAgICBjb25zdCBuZWdhdGVkID0gYXR0cihpblZhciwgJ25lZ2F0ZWQnKSA9PT0gJ3RydWUnO1xuICAgICAgY29uc3QgY29ubklkID0gYXR0cihjaGlsZChpblZhciwgJ2Nvbm5lY3Rpb25Qb2ludEluJyksICdyZWZMb2NhbElkJykgfHwgYXR0cihpblZhciwgJ2xvY2FsSWQnKTtcbiAgICAgIC8vIEdldCBjYW5vbmljYWwgdHlwZTsgZmFsbCBiYWNrIHRvIEJPT0wgZm9yIHVua25vd24gYmxvY2tzL3BpbnNcbiAgICAgIGNvbnN0IGNhbm9uaWNhbFR5cGUgPSBnZXRQaW5EYXRhVHlwZSh0eXBlTmFtZSwgcGluTmFtZSwgJ2lucHV0Jyk7XG4gICAgICBpZiAoaW5wdXRzQnlOYW1lLmhhcyhwaW5OYW1lKSkge1xuICAgICAgICBpbnB1dHNCeU5hbWUuZ2V0KHBpbk5hbWUpIS5uZWdhdGVkID0gbmVnYXRlZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlucHV0c0J5TmFtZS5zZXQocGluTmFtZSwgeyBpZDogYCR7bG9jYWxJZH0taW4tJHtwaW5OYW1lfWAsIG5hbWU6IHBpbk5hbWUsIGRhdGFUeXBlOiBjYW5vbmljYWxUeXBlLCBuZWdhdGVkIH0pO1xuICAgICAgfVxuICAgICAgaWYgKGNvbm5JZCkgd2lyZU1hcC5zZXQoY29ubklkLCB7IG5vZGVJZDogYGZiZC0ke2xvY2FsSWR9YCwgcGluOiBwaW5OYW1lIH0pO1xuICAgIH1cblxuICAgIGZvciAoY29uc3Qgb3V0VmFyIG9mIGNoaWxkQXJyYXkoYmxvY2tFbCwgJ291dHB1dFZhcmlhYmxlcycpLmZsYXRNYXAob3YgPT4gY2hpbGRBcnJheShvdiwgJ3ZhcmlhYmxlJykpKSB7XG4gICAgICBjb25zdCBwaW5OYW1lID0gYXR0cihvdXRWYXIsICdmb3JtYWxQYXJhbWV0ZXInKSB8fCAnJztcbiAgICAgIGNvbnN0IG5lZ2F0ZWQgPSBhdHRyKG91dFZhciwgJ25lZ2F0ZWQnKSA9PT0gJ3RydWUnO1xuICAgICAgY29uc3QgY2Fub25pY2FsVHlwZSA9IGdldFBpbkRhdGFUeXBlKHR5cGVOYW1lLCBwaW5OYW1lLCAnb3V0cHV0Jyk7XG4gICAgICBpZiAob3V0cHV0c0J5TmFtZS5oYXMocGluTmFtZSkpIHtcbiAgICAgICAgb3V0cHV0c0J5TmFtZS5nZXQocGluTmFtZSkhLm5lZ2F0ZWQgPSBuZWdhdGVkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0cHV0c0J5TmFtZS5zZXQocGluTmFtZSwgeyBpZDogYCR7bG9jYWxJZH0tb3V0LSR7cGluTmFtZX1gLCBuYW1lOiBwaW5OYW1lLCBkYXRhVHlwZTogY2Fub25pY2FsVHlwZSwgbmVnYXRlZCB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBleGVjT3JkZXIgPSBhdHRyKGJsb2NrRWwsICdleGVjdXRpb25PcmRlcklkJyk7XG4gICAgbm9kZXMucHVzaCh7XG4gICAgICBpZDogYGZiZC0ke2xvY2FsSWR9YCxcbiAgICAgIHR5cGU6IHR5cGVOYW1lLnRvVXBwZXJDYXNlKCkgYXMgRkJEQmxvY2tUeXBlLFxuICAgICAgaW5zdGFuY2VOYW1lLFxuICAgICAgcG9zaXRpb246IHsgeCwgeSB9LFxuICAgICAgaW5wdXRzOiBbLi4uaW5wdXRzQnlOYW1lLnZhbHVlcygpXSxcbiAgICAgIG91dHB1dHM6IFsuLi5vdXRwdXRzQnlOYW1lLnZhbHVlcygpXSxcbiAgICAgIGV4ZWN1dGlvbk9yZGVySWQ6IGV4ZWNPcmRlciA/IE51bWJlcihleGVjT3JkZXIpIDogdW5kZWZpbmVkLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gaW5PdXRWYXJpYWJsZSBlbGVtZW50cyAoYm90aCBpbnB1dCBhbmQgb3V0cHV0IGNvbm5lY3Rpb25zKVxuICBmb3IgKGNvbnN0IHZhckVsIG9mIGNoaWxkQXJyYXkoZmJkRWwsICdpbk91dFZhcmlhYmxlJykpIHtcbiAgICBjb25zdCBsb2NhbElkID0gYXR0cih2YXJFbCwgJ2xvY2FsSWQnKTtcbiAgICBjb25zdCBwb3NFbCA9IGNoaWxkKHZhckVsLCAncG9zaXRpb24nKTtcbiAgICBjb25zdCB4ID0gTnVtYmVyKGF0dHIocG9zRWwsICd4JykpIHx8IDA7XG4gICAgY29uc3QgeSA9IE51bWJlcihhdHRyKHBvc0VsLCAneScpKSB8fCAwO1xuICAgIGNvbnN0IHZhck5hbWUgPSB0ZXh0KGNoaWxkKHZhckVsLCAnZXhwcmVzc2lvbicpID8/IHZhckVsKSB8fCAnJztcbiAgICBjb25zdCB2YXJUeXBlID0gcmVzb2x2ZXIucmVzb2x2ZSh2YXJOYW1lKTtcbiAgICBub2Rlcy5wdXNoKHtcbiAgICAgIGlkOiBgZmJkLXZhci0ke2xvY2FsSWR9YCxcbiAgICAgIHR5cGU6ICdJTl9PVVRfVkFSSUFCTEUnIGFzIEZCREJsb2NrVHlwZSxcbiAgICAgIHRhZzogeyBuYW1lOiB2YXJOYW1lLCBkYXRhVHlwZTogdmFyVHlwZSB9LFxuICAgICAgcG9zaXRpb246IHsgeCwgeSB9LFxuICAgICAgaW5wdXRzOiBbeyBpZDogYHZhci0ke2xvY2FsSWR9LWluYCwgbmFtZTogJ0lOJywgZGF0YVR5cGU6IHZhclR5cGUgfV0sXG4gICAgICBvdXRwdXRzOiBbeyBpZDogYHZhci0ke2xvY2FsSWR9LW91dGAsIG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogdmFyVHlwZSB9XSxcbiAgICB9KTtcbiAgICAvLyBCdWlsZCB3aXJlcyBmcm9tIGNvbm5lY3Rpb25Qb2ludEluIGNvbm5lY3Rpb25zXG4gICAgY29uc3QgY3BJbiA9IGNoaWxkKHZhckVsLCAnY29ubmVjdGlvblBvaW50SW4nKTtcbiAgICBpZiAoY3BJbikge1xuICAgICAgZm9yIChjb25zdCBjb25uIG9mIGNoaWxkQXJyYXkoY3BJbiwgJ2Nvbm5lY3Rpb24nKSkge1xuICAgICAgICBjb25zdCByZWZJZCA9IGF0dHIoY29ubiwgJ3JlZkxvY2FsSWQnKTtcbiAgICAgICAgY29uc3QgZnJvbVBpbiA9IGF0dHIoY29ubiwgJ2Zvcm1hbFBhcmFtZXRlcicpIHx8ICdPVVQnO1xuICAgICAgICBpZiAocmVmSWQpIHtcbiAgICAgICAgICB3aXJlcy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiBgd2lyZS0ke3JlZklkfS10by12YXItJHtsb2NhbElkfWAsXG4gICAgICAgICAgICBmcm9tOiB7IG5vZGVJZDogYGZiZC0ke3JlZklkfWAsIHBpbjogZnJvbVBpbiB9LFxuICAgICAgICAgICAgdG86IHsgbm9kZUlkOiBgZmJkLXZhci0ke2xvY2FsSWR9YCwgcGluOiAnSU4nIH0sXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBWYXJpYWJsZSAoSU5fVkFSSUFCTEUgLyBPVVRfVkFSSUFCTEUpXG4gIGNvbnN0IG91dFZhckVscyA9IG5ldyBTZXQoY2hpbGRBcnJheShmYmRFbCwgJ291dFZhcmlhYmxlJykpO1xuICBmb3IgKGNvbnN0IHZhckVsIG9mIGNoaWxkQXJyYXkoZmJkRWwsICdpblZhcmlhYmxlJykuY29uY2F0KGNoaWxkQXJyYXkoZmJkRWwsICdvdXRWYXJpYWJsZScpKSkge1xuICAgIGNvbnN0IGxvY2FsSWQgPSBhdHRyKHZhckVsLCAnbG9jYWxJZCcpO1xuICAgIGNvbnN0IGlzT3V0ID0gb3V0VmFyRWxzLmhhcyh2YXJFbCk7XG4gICAgY29uc3QgcG9zRWwgPSBjaGlsZCh2YXJFbCwgJ3Bvc2l0aW9uJyk7XG4gICAgY29uc3QgeCA9IE51bWJlcihhdHRyKHBvc0VsLCAneCcpKSB8fCAwO1xuICAgIGNvbnN0IHkgPSBOdW1iZXIoYXR0cihwb3NFbCwgJ3knKSkgfHwgMDtcbiAgICBjb25zdCB2YXJOYW1lID0gdGV4dChjaGlsZCh2YXJFbCwgJ2V4cHJlc3Npb24nKSA/PyB2YXJFbCkgfHwgJyc7XG4gICAgY29uc3QgdmFyVHlwZSA9IHJlc29sdmVyLnJlc29sdmUodmFyTmFtZSk7XG4gICAgbm9kZXMucHVzaCh7XG4gICAgICBpZDogYGZiZC12YXItJHtsb2NhbElkfWAsXG4gICAgICB0eXBlOiBpc091dCA/ICdPVVRfVkFSSUFCTEUnIDogJ0lOX1ZBUklBQkxFJyxcbiAgICAgIHRhZzogeyBuYW1lOiB2YXJOYW1lLCBkYXRhVHlwZTogdmFyVHlwZSB9LFxuICAgICAgcG9zaXRpb246IHsgeCwgeSB9LFxuICAgICAgaW5wdXRzOiBpc091dCA/IFt7IGlkOiBgdmFyLSR7bG9jYWxJZH0taW5gLCBuYW1lOiAnSU4nLCBkYXRhVHlwZTogdmFyVHlwZSB9XSA6IFtdLFxuICAgICAgb3V0cHV0czogaXNPdXQgPyBbXSA6IFt7IGlkOiBgdmFyLSR7bG9jYWxJZH0tb3V0YCwgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiB2YXJUeXBlIH1dLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gQnVpbGQgd2lyZXMgYnkgdHJhdmVyc2luZyBjb25uZWN0aW9uUG9pbnRJbiBvbiBlYWNoIGJsb2NrJ3MgaW5wdXQgdmFyaWFibGVzXG4gIGZvciAoY29uc3QgYmxvY2tFbCBvZiBjaGlsZEFycmF5KGZiZEVsLCAnYmxvY2snKSkge1xuICAgIGNvbnN0IGJsb2NrTG9jYWxJZCA9IGF0dHIoYmxvY2tFbCwgJ2xvY2FsSWQnKTtcbiAgICBmb3IgKGNvbnN0IGluVmFyIG9mIGNoaWxkQXJyYXkoYmxvY2tFbCwgJ2lucHV0VmFyaWFibGVzJykuZmxhdE1hcChpdiA9PiBjaGlsZEFycmF5KGl2LCAndmFyaWFibGUnKSkpIHtcbiAgICAgIGNvbnN0IHBpbk5hbWUgPSBhdHRyKGluVmFyLCAnZm9ybWFsUGFyYW1ldGVyJyk7XG4gICAgICBjb25zdCBjcEluID0gY2hpbGQoaW5WYXIsICdjb25uZWN0aW9uUG9pbnRJbicpO1xuICAgICAgaWYgKCFjcEluKSBjb250aW51ZTtcbiAgICAgIGZvciAoY29uc3QgY29ubiBvZiBjaGlsZEFycmF5KGNwSW4sICdjb25uZWN0aW9uJykpIHtcbiAgICAgICAgY29uc3QgcmVmSWQgPSBhdHRyKGNvbm4sICdyZWZMb2NhbElkJyk7XG4gICAgICAgIGNvbnN0IGZyb21QaW4gPSBhdHRyKGNvbm4sICdmb3JtYWxQYXJhbWV0ZXInKSB8fCAnT1VUJztcbiAgICAgICAgaWYgKHJlZklkKSB7XG4gICAgICAgICAgd2lyZXMucHVzaCh7XG4gICAgICAgICAgICBpZDogYHdpcmUtJHtyZWZJZH0tdG8tJHtibG9ja0xvY2FsSWR9LSR7cGluTmFtZX1gLFxuICAgICAgICAgICAgZnJvbTogeyBub2RlSWQ6IGBmYmQtJHtyZWZJZH1gLCBwaW46IGZyb21QaW4gfSxcbiAgICAgICAgICAgIHRvOiB7IG5vZGVJZDogYGZiZC0ke2Jsb2NrTG9jYWxJZH1gLCBwaW46IHBpbk5hbWUgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEJ1aWxkIHdpcmVzIGZvciBvdXRWYXJpYWJsZSBlbGVtZW50cyAodGhleSByZWNlaXZlIGNvbm5lY3Rpb25zKVxuICBmb3IgKGNvbnN0IHZhckVsIG9mIGNoaWxkQXJyYXkoZmJkRWwsICdvdXRWYXJpYWJsZScpKSB7XG4gICAgY29uc3QgbG9jYWxJZCA9IGF0dHIodmFyRWwsICdsb2NhbElkJyk7XG4gICAgY29uc3QgY3BJbiA9IGNoaWxkKHZhckVsLCAnY29ubmVjdGlvblBvaW50SW4nKTtcbiAgICBpZiAoIWNwSW4pIGNvbnRpbnVlO1xuICAgIGZvciAoY29uc3QgY29ubiBvZiBjaGlsZEFycmF5KGNwSW4sICdjb25uZWN0aW9uJykpIHtcbiAgICAgIGNvbnN0IHJlZklkID0gYXR0cihjb25uLCAncmVmTG9jYWxJZCcpO1xuICAgICAgY29uc3QgZnJvbVBpbiA9IGF0dHIoY29ubiwgJ2Zvcm1hbFBhcmFtZXRlcicpIHx8ICdPVVQnO1xuICAgICAgaWYgKHJlZklkKSB7XG4gICAgICAgIHdpcmVzLnB1c2goe1xuICAgICAgICAgIGlkOiBgd2lyZS0ke3JlZklkfS10by12YXItJHtsb2NhbElkfWAsXG4gICAgICAgICAgZnJvbTogeyBub2RlSWQ6IGBmYmQtJHtyZWZJZH1gLCBwaW46IGZyb21QaW4gfSxcbiAgICAgICAgICB0bzogeyBub2RlSWQ6IGBmYmQtdmFyLSR7bG9jYWxJZH1gLCBwaW46ICdJTicgfSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gQnVpbGQgd2lyZXMgZm9yIGluVmFyaWFibGUgY29ubmVjdGlvblBvaW50SW4gKHJhcmUgYnV0IHBvc3NpYmxlIGluIHNvbWUgZXhwb3J0ZXJzKVxuICBmb3IgKGNvbnN0IHZhckVsIG9mIGNoaWxkQXJyYXkoZmJkRWwsICdpblZhcmlhYmxlJykpIHtcbiAgICBjb25zdCBsb2NhbElkID0gYXR0cih2YXJFbCwgJ2xvY2FsSWQnKTtcbiAgICBjb25zdCBjcEluID0gY2hpbGQodmFyRWwsICdjb25uZWN0aW9uUG9pbnRJbicpO1xuICAgIGlmICghY3BJbikgY29udGludWU7XG4gICAgZm9yIChjb25zdCBjb25uIG9mIGNoaWxkQXJyYXkoY3BJbiwgJ2Nvbm5lY3Rpb24nKSkge1xuICAgICAgY29uc3QgcmVmSWQgPSBhdHRyKGNvbm4sICdyZWZMb2NhbElkJyk7XG4gICAgICBjb25zdCBmcm9tUGluID0gYXR0cihjb25uLCAnZm9ybWFsUGFyYW1ldGVyJykgfHwgJ09VVCc7XG4gICAgICBpZiAocmVmSWQpIHtcbiAgICAgICAgd2lyZXMucHVzaCh7XG4gICAgICAgICAgaWQ6IGB3aXJlLSR7cmVmSWR9LXRvLXZhci0ke2xvY2FsSWR9YCxcbiAgICAgICAgICBmcm9tOiB7IG5vZGVJZDogYGZiZC0ke3JlZklkfWAsIHBpbjogZnJvbVBpbiB9LFxuICAgICAgICAgIHRvOiB7IG5vZGVJZDogYGZiZC12YXItJHtsb2NhbElkfWAsIHBpbjogJ0lOJyB9LFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBub2Rlcywgd2lyZXMgfTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFNGQyBib2R5IHBhcnNlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gcGFyc2VTRkNCb2R5KHNmY0VsOiB1bmtub3duLCBwb3VOYW1lOiBzdHJpbmcsIHVubWFwcGVkOiBVbm1hcHBlZEVsZW1lbnRbXSk6IFNGQ1Byb2dyYW0ge1xuICBjb25zdCBzdGVwczogU0ZDU3RlcFtdID0gW107XG4gIGNvbnN0IHRyYW5zaXRpb25zOiBTRkNUcmFuc2l0aW9uW10gPSBbXTtcbiAgY29uc3QgbGlua3M6IFNGQ0xpbmtbXSA9IFtdO1xuXG4gIGNvbnN0IGp1bXBzOiBTRkNKdW1wW10gPSBbXTtcbiAgaWYgKCFzZmNFbCkgcmV0dXJuIHsgc3RlcHMsIHRyYW5zaXRpb25zLCBsaW5rcywgYnJhbmNoZXM6IFtdLCBqdW1wcyB9O1xuXG4gIC8vIFByZS1idWlsZCBhIG1hcCBmcm9tIHN0ZXAgbG9jYWxJZCBcdTIxOTIgYWN0aW9ucyBmcm9tIHNpYmxpbmcgYWN0aW9uQmxvY2sgZWxlbWVudHNcbiAgY29uc3Qgc3RlcEFjdGlvbk1hcCA9IG5ldyBNYXA8c3RyaW5nLCBTRkNBY3Rpb25bXT4oKTtcbiAgZm9yIChjb25zdCBhYkVsIG9mIGNoaWxkQXJyYXkoc2ZjRWwsICdhY3Rpb25CbG9jaycpKSB7XG4gICAgY29uc3QgY3BJbiA9IGNoaWxkKGFiRWwsICdjb25uZWN0aW9uUG9pbnRJbicpO1xuICAgIGNvbnN0IHJlZlN0ZXBJZCA9IGNwSW4gPyAoYXR0cihjaGlsZChjcEluLCAnY29ubmVjdGlvbicpLCAncmVmTG9jYWxJZCcpIHx8ICcnKSA6ICcnO1xuICAgIGlmICghcmVmU3RlcElkKSBjb250aW51ZTtcbiAgICBjb25zdCBxdWFsaWZpZXJzOiBBY3Rpb25RdWFsaWZpZXJbXSA9IFsnTicsJ1MnLCdSJywnUCcsJ1AxJywnUDAnLCdMJywnRCcsJ1NEJywnRFMnLCdTTCddO1xuICAgIGZvciAoY29uc3QgYWN0aW9uRWwgb2YgY2hpbGRBcnJheShhYkVsLCAnYWN0aW9uJykpIHtcbiAgICAgIGNvbnN0IHF1YWwgPSBhdHRyKGFjdGlvbkVsLCAncXVhbGlmaWVyJykgYXMgQWN0aW9uUXVhbGlmaWVyO1xuICAgICAgY29uc3QgcmVmRWwgPSBjaGlsZChhY3Rpb25FbCwgJ3JlZmVyZW5jZScpO1xuICAgICAgLy8gQnVnIDggZml4OiByZWFkIG5hbWUgYXR0cmlidXRlIGZpcnN0LCBub3QgdGV4dCBjb250ZW50XG4gICAgICBjb25zdCB0YWdOYW1lID0gYXR0cihyZWZFbCwgJ25hbWUnKSB8fCBhdHRyKGFjdGlvbkVsLCAnbmFtZScpO1xuICAgICAgaWYgKCF0YWdOYW1lKSBjb250aW51ZTtcbiAgICAgIGlmICghc3RlcEFjdGlvbk1hcC5oYXMocmVmU3RlcElkKSkgc3RlcEFjdGlvbk1hcC5zZXQocmVmU3RlcElkLCBbXSk7XG4gICAgICBzdGVwQWN0aW9uTWFwLmdldChyZWZTdGVwSWQpIS5wdXNoKHtcbiAgICAgICAgaWQ6IGBhY3Rpb24tJHt0YWdOYW1lfS0ke3F1YWx9YCxcbiAgICAgICAgcXVhbGlmaWVyOiBxdWFsaWZpZXJzLmluY2x1ZGVzKHF1YWwpID8gcXVhbCA6ICdOJyxcbiAgICAgICAgdGFnOiB7IG5hbWU6IHRhZ05hbWUsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgICAgZHVyYXRpb246IGF0dHIoYWN0aW9uRWwsICdkdXJhdGlvbicpIHx8IHVuZGVmaW5lZCxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGxldCBzdGVwSWR4ID0gMDtcbiAgZm9yIChjb25zdCBzdGVwRWwgb2YgY2hpbGRBcnJheShzZmNFbCwgJ3N0ZXAnKSkge1xuICAgIGNvbnN0IGxvY2FsSWQgPSBhdHRyKHN0ZXBFbCwgJ2xvY2FsSWQnKTtcbiAgICBjb25zdCBuYW1lID0gYXR0cihzdGVwRWwsICduYW1lJykgfHwgYFN0ZXAke3N0ZXBJZHh9YDtcbiAgICBjb25zdCBpc0luaXRpYWwgPSBhdHRyKHN0ZXBFbCwgJ2luaXRpYWxTdGVwJykgPT09ICd0cnVlJztcbiAgICBjb25zdCBwb3NFbCA9IGNoaWxkKHN0ZXBFbCwgJ3Bvc2l0aW9uJyk7XG4gICAgc3RlcElkeCsrO1xuICAgIC8vIEFjdGlvbnMgZnJvbSBzaWJsaW5nIGFjdGlvbkJsb2NrcyAocHJlZmVycmVkKSBvciBpbmxpbmUgc3RlcCBjaGlsZHJlblxuICAgIGNvbnN0IHNpYmxpbmdBY3Rpb25zID0gc3RlcEFjdGlvbk1hcC5nZXQobG9jYWxJZCB8fCAnJykgfHwgW107XG4gICAgY29uc3QgaW5saW5lQWN0aW9ucyA9IHNpYmxpbmdBY3Rpb25zLmxlbmd0aCA9PT0gMCA/IHBhcnNlQWN0aW9ucyhzdGVwRWwsIHVubWFwcGVkKSA6IFtdO1xuICAgIHN0ZXBzLnB1c2goe1xuICAgICAgaWQ6IGBzZmMtc3RlcC0ke2xvY2FsSWR9YCxcbiAgICAgIG5hbWUsXG4gICAgICBpc0luaXRpYWwsXG4gICAgICBhY3Rpb25zOiBzaWJsaW5nQWN0aW9ucy5sZW5ndGggPiAwID8gc2libGluZ0FjdGlvbnMgOiBpbmxpbmVBY3Rpb25zLFxuICAgICAgcG9zaXRpb246IHsgeDogTnVtYmVyKGF0dHIocG9zRWwsICd4JykpIHx8IDAsIHk6IE51bWJlcihhdHRyKHBvc0VsLCAneScpKSB8fCAwIH0sXG4gICAgfSk7XG4gIH1cblxuICBsZXQgdHJhbnNJZHggPSAwO1xuICBmb3IgKGNvbnN0IHRyYW5zRWwgb2YgY2hpbGRBcnJheShzZmNFbCwgJ3RyYW5zaXRpb24nKSkge1xuICAgIGNvbnN0IGxvY2FsSWQgPSBhdHRyKHRyYW5zRWwsICdsb2NhbElkJyk7XG4gICAgY29uc3QgcG9zRWwgPSBjaGlsZCh0cmFuc0VsLCAncG9zaXRpb24nKTtcbiAgICBjb25zdCBjb25kRWwgPSBjaGlsZCh0cmFuc0VsLCAnY29uZGl0aW9uJyk7XG4gICAgY29uc3Qgc3RFbCA9IGNoaWxkKGNvbmRFbCwgJ1NUJykgPz8gY2hpbGQodHJhbnNFbCwgJ3JlZmVyZW5jZScpID8/IGNvbmRFbDtcbiAgICBjb25zdCBjb25kaXRpb24gPSBzdEVsID8gdGV4dChjaGlsZChzdEVsIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+LCAneGh0bWw6cCcpID8/IGNoaWxkKHN0RWwgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4sICd4aHRtbCcpID8/IHN0RWwpIDogJ1RSVUUnO1xuICAgIGNvbnN0IHByaW9yaXR5ID0gYXR0cih0cmFuc0VsLCAncHJpb3JpdHknKTtcbiAgICB0cmFuc0lkeCsrO1xuICAgIHRyYW5zaXRpb25zLnB1c2goe1xuICAgICAgaWQ6IGBzZmMtdHJhbnMtJHtsb2NhbElkfWAsXG4gICAgICBjb25kaXRpb246IGNvbmRpdGlvbiB8fCAnVFJVRScsXG4gICAgICBwcmlvcml0eTogcHJpb3JpdHkgPyBOdW1iZXIocHJpb3JpdHkpIDogdW5kZWZpbmVkLFxuICAgICAgcG9zaXRpb246IHsgeDogTnVtYmVyKGF0dHIocG9zRWwsICd4JykpIHx8IDAsIHk6IE51bWJlcihhdHRyKHBvc0VsLCAneScpKSB8fCAwIH0sXG4gICAgfSk7XG4gIH1cblxuICAvLyBCdWlsZCBsaW5rcyBmcm9tIGNvbm5lY3Rpb24gcG9pbnRzXG4gIGZvciAoY29uc3Qgc3RlcEVsIG9mIGNoaWxkQXJyYXkoc2ZjRWwsICdzdGVwJykpIHtcbiAgICBjb25zdCBzdGVwSWQgPSBgc2ZjLXN0ZXAtJHthdHRyKHN0ZXBFbCwgJ2xvY2FsSWQnKX1gO1xuICAgIGZvciAoY29uc3QgY29ubiBvZiBjaGlsZEFycmF5KGNoaWxkKHN0ZXBFbCwgJ2Nvbm5lY3Rpb25Qb2ludE91dCcpLCAnY29ubmVjdGlvbicpKSB7XG4gICAgICBjb25zdCB0b0lkID0gYXR0cihjb25uLCAncmVmTG9jYWxJZCcpO1xuICAgICAgaWYgKHRvSWQpIHtcbiAgICAgICAgbGlua3MucHVzaCh7XG4gICAgICAgICAgaWQ6IGBsaW5rLSR7c3RlcElkfS0ke3RvSWR9YCxcbiAgICAgICAgICBmcm9tOiBzdGVwSWQsXG4gICAgICAgICAgdG86IGBzZmMtdHJhbnMtJHt0b0lkfWAsXG4gICAgICAgICAgdHlwZTogJ3NpbXBsZScsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBmb3IgKGNvbnN0IHRyYW5zRWwgb2YgY2hpbGRBcnJheShzZmNFbCwgJ3RyYW5zaXRpb24nKSkge1xuICAgIGNvbnN0IHRyYW5zSWQgPSBgc2ZjLXRyYW5zLSR7YXR0cih0cmFuc0VsLCAnbG9jYWxJZCcpfWA7XG4gICAgZm9yIChjb25zdCBjb25uIG9mIGNoaWxkQXJyYXkoY2hpbGQodHJhbnNFbCwgJ2Nvbm5lY3Rpb25Qb2ludE91dCcpLCAnY29ubmVjdGlvbicpKSB7XG4gICAgICBjb25zdCB0b0lkID0gYXR0cihjb25uLCAncmVmTG9jYWxJZCcpO1xuICAgICAgaWYgKHRvSWQpIHtcbiAgICAgICAgbGlua3MucHVzaCh7XG4gICAgICAgICAgaWQ6IGBsaW5rLSR7dHJhbnNJZH0tJHt0b0lkfWAsXG4gICAgICAgICAgZnJvbTogdHJhbnNJZCxcbiAgICAgICAgICB0bzogYHNmYy1zdGVwLSR7dG9JZH1gLFxuICAgICAgICAgIHR5cGU6ICdzaW1wbGUnLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBTaW11bHRhbmVvdXMgZGl2ZXJnZW5jZS9jb252ZXJnZW5jZSAoQU5ELXNwbGl0L2pvaW4pXG4gIGZvciAoY29uc3QgZGl2RWwgb2YgY2hpbGRBcnJheShzZmNFbCwgJ3NpbXVsdGFuZW91c0RpdmVyZ2VuY2UnKSkge1xuICAgIGNvbnN0IGRpdklkID0gYXR0cihkaXZFbCwgJ2xvY2FsSWQnKTtcbiAgICAvLyBjb25uZWN0aW9uUG9pbnRJbjogd2hlcmUgdGhlIGRpdmVyZ2VuY2UgcmVjZWl2ZXMgZnJvbVxuICAgIGNvbnN0IGNwSW4gPSBjaGlsZChkaXZFbCwgJ2Nvbm5lY3Rpb25Qb2ludEluJyk7XG4gICAgaWYgKGNwSW4pIHtcbiAgICAgIGZvciAoY29uc3QgY29ubiBvZiBjaGlsZEFycmF5KGNwSW4sICdjb25uZWN0aW9uJykpIHtcbiAgICAgICAgY29uc3QgcmVmSWQgPSBhdHRyKGNvbm4sICdyZWZMb2NhbElkJyk7XG4gICAgICAgIGlmIChyZWZJZCkge1xuICAgICAgICAgIGxpbmtzLnB1c2goeyBpZDogYGxpbmstJHtyZWZJZH0tc2ltRGl2LSR7ZGl2SWR9YCwgZnJvbTogYHNmYy10cmFucy0ke3JlZklkfWAsIHRvOiBgc2ZjLXNpbURpdi0ke2RpdklkfWAsIHR5cGU6ICdzaW11bHRhbmVvdXMtZGl2ZXJnZW5jZScgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gY29ubmVjdGlvblBvaW50T3V0OiBicmFuY2hlcyBnb2luZyB0byBzdGVwcy90cmFuc2l0aW9uc1xuICAgIGZvciAoY29uc3QgY3BPdXQgb2YgY2hpbGRBcnJheShkaXZFbCwgJ2Nvbm5lY3Rpb25Qb2ludE91dCcpKSB7XG4gICAgICBmb3IgKGNvbnN0IGNvbm4gb2YgY2hpbGRBcnJheShjcE91dCwgJ2Nvbm5lY3Rpb24nKSkge1xuICAgICAgICBjb25zdCByZWZJZCA9IGF0dHIoY29ubiwgJ3JlZkxvY2FsSWQnKTtcbiAgICAgICAgaWYgKHJlZklkKSB7XG4gICAgICAgICAgbGlua3MucHVzaCh7IGlkOiBgbGluay1zaW1EaXYtJHtkaXZJZH0tJHtyZWZJZH1gLCBmcm9tOiBgc2ZjLXNpbURpdi0ke2RpdklkfWAsIHRvOiBgc2ZjLXN0ZXAtJHtyZWZJZH1gLCB0eXBlOiAnc2ltdWx0YW5lb3VzLWRpdmVyZ2VuY2UnIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCBjb252RWwgb2YgY2hpbGRBcnJheShzZmNFbCwgJ3NpbXVsdGFuZW91c0NvbnZlcmdlbmNlJykpIHtcbiAgICBjb25zdCBjb252SWQgPSBhdHRyKGNvbnZFbCwgJ2xvY2FsSWQnKTtcbiAgICBmb3IgKGNvbnN0IGNwSW4gb2YgY2hpbGRBcnJheShjb252RWwsICdjb25uZWN0aW9uUG9pbnRJbicpKSB7XG4gICAgICBmb3IgKGNvbnN0IGNvbm4gb2YgY2hpbGRBcnJheShjcEluLCAnY29ubmVjdGlvbicpKSB7XG4gICAgICAgIGNvbnN0IHJlZklkID0gYXR0cihjb25uLCAncmVmTG9jYWxJZCcpO1xuICAgICAgICBpZiAocmVmSWQpIHtcbiAgICAgICAgICBsaW5rcy5wdXNoKHsgaWQ6IGBsaW5rLSR7cmVmSWR9LXNpbUNvbnYtJHtjb252SWR9YCwgZnJvbTogYHNmYy10cmFucy0ke3JlZklkfWAsIHRvOiBgc2ZjLXNpbUNvbnYtJHtjb252SWR9YCwgdHlwZTogJ3NpbXVsdGFuZW91cy1jb252ZXJnZW5jZScgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBjcE91dCBvZiBjaGlsZEFycmF5KGNvbnZFbCwgJ2Nvbm5lY3Rpb25Qb2ludE91dCcpKSB7XG4gICAgICBmb3IgKGNvbnN0IGNvbm4gb2YgY2hpbGRBcnJheShjcE91dCwgJ2Nvbm5lY3Rpb24nKSkge1xuICAgICAgICBjb25zdCByZWZJZCA9IGF0dHIoY29ubiwgJ3JlZkxvY2FsSWQnKTtcbiAgICAgICAgaWYgKHJlZklkKSB7XG4gICAgICAgICAgbGlua3MucHVzaCh7IGlkOiBgbGluay1zaW1Db252LSR7Y29udklkfS0ke3JlZklkfWAsIGZyb206IGBzZmMtc2ltQ29udi0ke2NvbnZJZH1gLCB0bzogYHNmYy1zdGVwLSR7cmVmSWR9YCwgdHlwZTogJ3NpbXVsdGFuZW91cy1jb252ZXJnZW5jZScgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBTZWxlY3Rpb24gZGl2ZXJnZW5jZS9jb252ZXJnZW5jZSAoT1Itc3BsaXQvam9pbilcbiAgZm9yIChjb25zdCBkaXZFbCBvZiBjaGlsZEFycmF5KHNmY0VsLCAnc2VsZWN0aW9uRGl2ZXJnZW5jZScpKSB7XG4gICAgY29uc3QgZGl2SWQgPSBhdHRyKGRpdkVsLCAnbG9jYWxJZCcpO1xuICAgIGNvbnN0IGNwSW4gPSBjaGlsZChkaXZFbCwgJ2Nvbm5lY3Rpb25Qb2ludEluJyk7XG4gICAgaWYgKGNwSW4pIHtcbiAgICAgIGZvciAoY29uc3QgY29ubiBvZiBjaGlsZEFycmF5KGNwSW4sICdjb25uZWN0aW9uJykpIHtcbiAgICAgICAgY29uc3QgcmVmSWQgPSBhdHRyKGNvbm4sICdyZWZMb2NhbElkJyk7XG4gICAgICAgIGlmIChyZWZJZCkge1xuICAgICAgICAgIGxpbmtzLnB1c2goeyBpZDogYGxpbmstJHtyZWZJZH0tc2VsRGl2LSR7ZGl2SWR9YCwgZnJvbTogYHNmYy1zdGVwLSR7cmVmSWR9YCwgdG86IGBzZmMtc2VsRGl2LSR7ZGl2SWR9YCwgdHlwZTogJ3NlbGVjdGlvbi1kaXZlcmdlbmNlJyB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGNwT3V0IG9mIGNoaWxkQXJyYXkoZGl2RWwsICdjb25uZWN0aW9uUG9pbnRPdXQnKSkge1xuICAgICAgZm9yIChjb25zdCBjb25uIG9mIGNoaWxkQXJyYXkoY3BPdXQsICdjb25uZWN0aW9uJykpIHtcbiAgICAgICAgY29uc3QgcmVmSWQgPSBhdHRyKGNvbm4sICdyZWZMb2NhbElkJyk7XG4gICAgICAgIGlmIChyZWZJZCkge1xuICAgICAgICAgIGxpbmtzLnB1c2goeyBpZDogYGxpbmstc2VsRGl2LSR7ZGl2SWR9LSR7cmVmSWR9YCwgZnJvbTogYHNmYy1zZWxEaXYtJHtkaXZJZH1gLCB0bzogYHNmYy10cmFucy0ke3JlZklkfWAsIHR5cGU6ICdzZWxlY3Rpb24tZGl2ZXJnZW5jZScgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IGNvbnZFbCBvZiBjaGlsZEFycmF5KHNmY0VsLCAnc2VsZWN0aW9uQ29udmVyZ2VuY2UnKSkge1xuICAgIGNvbnN0IGNvbnZJZCA9IGF0dHIoY29udkVsLCAnbG9jYWxJZCcpO1xuICAgIGZvciAoY29uc3QgY3BJbiBvZiBjaGlsZEFycmF5KGNvbnZFbCwgJ2Nvbm5lY3Rpb25Qb2ludEluJykpIHtcbiAgICAgIGZvciAoY29uc3QgY29ubiBvZiBjaGlsZEFycmF5KGNwSW4sICdjb25uZWN0aW9uJykpIHtcbiAgICAgICAgY29uc3QgcmVmSWQgPSBhdHRyKGNvbm4sICdyZWZMb2NhbElkJyk7XG4gICAgICAgIGlmIChyZWZJZCkge1xuICAgICAgICAgIGxpbmtzLnB1c2goeyBpZDogYGxpbmstJHtyZWZJZH0tc2VsQ29udi0ke2NvbnZJZH1gLCBmcm9tOiBgc2ZjLXRyYW5zLSR7cmVmSWR9YCwgdG86IGBzZmMtc2VsQ29udi0ke2NvbnZJZH1gLCB0eXBlOiAnc2VsZWN0aW9uLWNvbnZlcmdlbmNlJyB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGNwT3V0IG9mIGNoaWxkQXJyYXkoY29udkVsLCAnY29ubmVjdGlvblBvaW50T3V0JykpIHtcbiAgICAgIGZvciAoY29uc3QgY29ubiBvZiBjaGlsZEFycmF5KGNwT3V0LCAnY29ubmVjdGlvbicpKSB7XG4gICAgICAgIGNvbnN0IHJlZklkID0gYXR0cihjb25uLCAncmVmTG9jYWxJZCcpO1xuICAgICAgICBpZiAocmVmSWQpIHtcbiAgICAgICAgICBsaW5rcy5wdXNoKHsgaWQ6IGBsaW5rLXNlbENvbnYtJHtjb252SWR9LSR7cmVmSWR9YCwgZnJvbTogYHNmYy1zZWxDb252LSR7Y29udklkfWAsIHRvOiBgc2ZjLXN0ZXAtJHtyZWZJZH1gLCB0eXBlOiAnc2VsZWN0aW9uLWNvbnZlcmdlbmNlJyB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFBhcnNlIGp1bXBTdGVwIGVsZW1lbnRzXG4gIGZvciAoY29uc3QganVtcEVsIG9mIGNoaWxkQXJyYXkoc2ZjRWwsICdqdW1wU3RlcCcpKSB7XG4gICAgY29uc3QgbG9jYWxJZCA9IGF0dHIoanVtcEVsLCAnbG9jYWxJZCcpO1xuICAgIGNvbnN0IHRhcmdldE5hbWUgPSBhdHRyKGp1bXBFbCwgJ3RhcmdldE5hbWUnKSB8fCAnJztcbiAgICBjb25zdCBwb3NFbCA9IGNoaWxkKGp1bXBFbCwgJ3Bvc2l0aW9uJyk7XG4gICAganVtcHMucHVzaCh7XG4gICAgICBpZDogYHNmYy1qdW1wLSR7bG9jYWxJZH1gLFxuICAgICAgdGFyZ2V0U3RlcE5hbWU6IHRhcmdldE5hbWUsXG4gICAgICBwb3NpdGlvbjogeyB4OiBOdW1iZXIoYXR0cihwb3NFbCwgJ3gnKSkgfHwgMCwgeTogTnVtYmVyKGF0dHIocG9zRWwsICd5JykpIHx8IDAgfSxcbiAgICB9KTtcbiAgICAvLyBXaXJlIGluY29taW5nIGNvbm5lY3Rpb25zIHRvIHRoZSBqdW1wU3RlcFxuICAgIGNvbnN0IGNwSW4gPSBjaGlsZChqdW1wRWwsICdjb25uZWN0aW9uUG9pbnRJbicpO1xuICAgIGlmIChjcEluKSB7XG4gICAgICBmb3IgKGNvbnN0IGNvbm4gb2YgY2hpbGRBcnJheShjcEluLCAnY29ubmVjdGlvbicpKSB7XG4gICAgICAgIGNvbnN0IHJlZklkID0gYXR0cihjb25uLCAncmVmTG9jYWxJZCcpO1xuICAgICAgICBpZiAocmVmSWQpIHtcbiAgICAgICAgICBsaW5rcy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiBgbGluay0ke3JlZklkfS1qdW1wLSR7bG9jYWxJZH1gLFxuICAgICAgICAgICAgZnJvbTogYHNmYy10cmFucy0ke3JlZklkfWAsXG4gICAgICAgICAgICB0bzogYHNmYy1qdW1wLSR7bG9jYWxJZH1gLFxuICAgICAgICAgICAgdHlwZTogJ3NpbXBsZScsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBCdWlsZCBicmFuY2hlcyBmcm9tIGxpbmsgdG9wb2xvZ3lcbiAgY29uc3QgYnJhbmNoZXM6IFNGQ0JyYW5jaFtdID0gW107XG4gIGNvbnN0IGNvbnZCYXJJZHMgPSBuZXcgU2V0KGxpbmtzLmZsYXRNYXAobCA9PiBbbC5mcm9tLCBsLnRvXSkuZmlsdGVyKGlkID0+IC9ec2ZjLShzaW1Db252fHNlbENvbnYpLS8udGVzdChpZCkpKTtcblxuICBmb3IgKGNvbnN0IGxpbmsgb2YgbGlua3MpIHtcbiAgICBpZiAoIWxpbmsudHlwZS5pbmNsdWRlcygnZGl2ZXJnZW5jZScpKSBjb250aW51ZTtcbiAgICBjb25zdCBkaXZCYXJJZCA9IGxpbmsudG87XG4gICAgaWYgKCFkaXZCYXJJZC5tYXRjaCgvXnNmYy0oc2ltRGl2fHNlbERpdiktLykpIGNvbnRpbnVlO1xuXG4gICAgY29uc3QgaXNTaW11bHRhbmVvdXMgPSBkaXZCYXJJZC5zdGFydHNXaXRoKCdzZmMtc2ltRGl2LScpO1xuICAgIGNvbnN0IG1hdGNoaW5nQ29udlByZWZpeCA9IGlzU2ltdWx0YW5lb3VzID8gJ3NmYy1zaW1Db252LScgOiAnc2ZjLXNlbENvbnYtJztcblxuICAgIGNvbnN0IHVwc3RyZWFtSWRzID0gbGlua3MuZmlsdGVyKGwgPT4gbC50byA9PT0gZGl2QmFySWQpLm1hcChsID0+IGwuZnJvbSk7XG4gICAgY29uc3QgYnJhbmNoSGVhZElkcyA9IGxpbmtzLmZpbHRlcihsID0+IGwuZnJvbSA9PT0gZGl2QmFySWQpLm1hcChsID0+IGwudG8pO1xuXG4gICAgY29uc3QgYnJhbmNoU3RlcEFycmF5czogc3RyaW5nW11bXSA9IGJyYW5jaEhlYWRJZHMubWFwKGhlYWRJZCA9PiB7XG4gICAgICBjb25zdCBjaGFpbjogc3RyaW5nW10gPSBbXTtcbiAgICAgIGxldCBjdXIgPSBoZWFkSWQ7XG4gICAgICBmb3IgKGxldCBkZXB0aCA9IDA7IGRlcHRoIDwgMjA7IGRlcHRoKyspIHtcbiAgICAgICAgY2hhaW4ucHVzaChjdXIpO1xuICAgICAgICBjb25zdCBuZXh0ID0gbGlua3MuZmluZChsID0+IGwuZnJvbSA9PT0gY3VyICYmIGwudHlwZSA9PT0gJ3NpbXBsZScpO1xuICAgICAgICBpZiAoIW5leHQpIGJyZWFrO1xuICAgICAgICBjdXIgPSBuZXh0LnRvO1xuICAgICAgICBpZiAoWy4uLmNvbnZCYXJJZHNdLnNvbWUoY2JJZCA9PiBuZXh0LnRvID09PSBjYklkKSkgYnJlYWs7XG4gICAgICB9XG4gICAgICByZXR1cm4gY2hhaW4uZmlsdGVyKGlkID0+IGlkLnN0YXJ0c1dpdGgoJ3NmYy1zdGVwLScpKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvbnZCYXJJZCA9IFsuLi5jb252QmFySWRzXS5maW5kKGNiSWQgPT4gY2JJZC5zdGFydHNXaXRoKG1hdGNoaW5nQ29udlByZWZpeCkpID8/ICcnO1xuICAgIGNvbnN0IGRvd25zdHJlYW1JZHMgPSBsaW5rcy5maWx0ZXIobCA9PiBsLmZyb20gPT09IGNvbnZCYXJJZCkubWFwKGwgPT4gbC50byk7XG5cbiAgICBpZiAoIWJyYW5jaGVzLmZpbmQoYiA9PiBiLmlkID09PSBgYnJhbmNoLSR7ZGl2QmFySWR9YCkpIHtcbiAgICAgIGJyYW5jaGVzLnB1c2goe1xuICAgICAgICBpZDogYGJyYW5jaC0ke2RpdkJhcklkfWAsXG4gICAgICAgIHR5cGU6IGlzU2ltdWx0YW5lb3VzID8gJ0FORCcgOiAnT1InLFxuICAgICAgICBkaXZlcmdpbmdGcm9tVHJhbnNJZDogdXBzdHJlYW1JZHNbMF0gfHwgJycsXG4gICAgICAgIGJyYW5jaFN0ZXBJZHM6IGJyYW5jaFN0ZXBBcnJheXMsXG4gICAgICAgIGNvbnZlcmdpbmdUb1RyYW5zSWQ6IGRvd25zdHJlYW1JZHNbMF0gfHwgJycsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBzdGVwcywgdHJhbnNpdGlvbnMsIGxpbmtzLCBicmFuY2hlcywganVtcHMgfTtcbn1cblxuZnVuY3Rpb24gcGFyc2VBY3Rpb25zKHN0ZXBFbDogdW5rbm93biwgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdKTogU0ZDQWN0aW9uW10ge1xuICBjb25zdCBhY3Rpb25zOiBTRkNBY3Rpb25bXSA9IFtdO1xuICBjb25zdCBxdWFsaWZpZXJzOiBBY3Rpb25RdWFsaWZpZXJbXSA9IFsnTicsJ1MnLCdSJywnUCcsJ1AxJywnUDAnLCdMJywnRCcsJ1NEJywnRFMnLCdTTCddO1xuICBmb3IgKGNvbnN0IGFjdGlvbkVsIG9mIGNoaWxkQXJyYXkoc3RlcEVsLCAnYWN0aW9uQmxvY2snKS5mbGF0TWFwKGFiID0+IGNoaWxkQXJyYXkoYWIsICdhY3Rpb24nKSkpIHtcbiAgICBjb25zdCBxdWFsID0gYXR0cihhY3Rpb25FbCwgJ3F1YWxpZmllcicpIGFzIEFjdGlvblF1YWxpZmllcjtcbiAgICBjb25zdCByZWZFbCA9IGNoaWxkKGFjdGlvbkVsLCAncmVmZXJlbmNlJyk7XG4gICAgY29uc3QgdGFnTmFtZSA9IGF0dHIocmVmRWwsICduYW1lJykgfHwgYXR0cihhY3Rpb25FbCwgJ25hbWUnKTtcbiAgICBpZiAoIXRhZ05hbWUpIGNvbnRpbnVlO1xuICAgIGFjdGlvbnMucHVzaCh7XG4gICAgICBpZDogYGFjdGlvbi0ke3RhZ05hbWV9LSR7cXVhbH1gLFxuICAgICAgcXVhbGlmaWVyOiBxdWFsaWZpZXJzLmluY2x1ZGVzKHF1YWwpID8gcXVhbCA6ICdOJyxcbiAgICAgIHRhZzogeyBuYW1lOiB0YWdOYW1lLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICBkdXJhdGlvbjogYXR0cihhY3Rpb25FbCwgJ2R1cmF0aW9uJykgfHwgdW5kZWZpbmVkLFxuICAgIH0pO1xuICB9XG4gIHJldHVybiBhY3Rpb25zO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgRXhwb3J0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgZnVuY3Rpb24gZXhwb3J0UExDb3Blbihwcm9qZWN0OiBOb3JtYWxpemVkUHJvamVjdCk6IEV4cG9ydFJlc3VsdCB7XG4gIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG5cbiAgY29uc3QgcG91c1htbCA9IHByb2plY3QucG91cy5tYXAocG91ID0+IGJ1aWxkUE9VWG1sKHBvdSwgd2FybmluZ3MpKTtcblxuICBjb25zdCBnbG9iYWxWYXJzWG1sID0gcHJvamVjdC5nbG9iYWxUYWdzLmxlbmd0aCA+IDAgPyB7XG4gICAgY29uZmlndXJhdGlvbjoge1xuICAgICAgJ0BfbmFtZSc6ICdDb25maWcwJyxcbiAgICAgIGdsb2JhbFZhcnM6IHtcbiAgICAgICAgJ0BfbmFtZSc6ICdHVkwnLFxuICAgICAgICB2YXJpYWJsZTogcHJvamVjdC5nbG9iYWxUYWdzLm1hcCh0YWdUb1ZhclhtbCksXG4gICAgICB9LFxuICAgIH0sXG4gIH0gOiB7fTtcblxuICBjb25zdCBvYmogPSB7XG4gICAgcHJvamVjdDoge1xuICAgICAgJ0BfeG1sbnMnOiAnaHR0cDovL3d3dy5wbGNvcGVuLm9yZy94bWwvdGM2XzAyMDEnLFxuICAgICAgJ0BfeG1sbnM6eHNpJzogJ2h0dHA6Ly93d3cudzMub3JnLzIwMDEvWE1MU2NoZW1hLWluc3RhbmNlJyxcbiAgICAgICdAX3htbG5zOnhodG1sJzogJ2h0dHA6Ly93d3cudzMub3JnLzE5OTkveGh0bWwnLFxuICAgICAgJ0BfeHNpOnNjaGVtYUxvY2F0aW9uJzogJ2h0dHA6Ly93d3cucGxjb3Blbi5vcmcveG1sL3RjNl8wMjAxIGh0dHA6Ly93d3cucGxjb3Blbi5vcmcveG1sL3RjNl8wMjAxL3RjNl94bWxfdjIwMS54c2QnLFxuICAgICAgZmlsZUhlYWRlcjoge1xuICAgICAgICAnQF9jb21wYW55TmFtZSc6ICdQbGF4aW8nLFxuICAgICAgICAnQF9wcm9kdWN0TmFtZSc6ICdQbGF4aW8nLFxuICAgICAgICAnQF9wcm9kdWN0VmVyc2lvbic6ICcxLjAnLFxuICAgICAgICAnQF9jcmVhdGlvbkRhdGVUaW1lJzogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgfSxcbiAgICAgIGNvbnRlbnRIZWFkZXI6IHtcbiAgICAgICAgJ0BfbmFtZSc6IHByb2plY3QucHJvamVjdE5hbWUsXG4gICAgICAgICdAX3ZlcnNpb24nOiAnMS4wLjAnLFxuICAgICAgICBjb29yZGluYXRlSW5mbzoge1xuICAgICAgICAgIGZiZDogeyBzY2FsaW5nOiB7ICdAX3gnOiAnMScsICdAX3knOiAnMScgfSB9LFxuICAgICAgICAgIGxkOiAgeyBzY2FsaW5nOiB7ICdAX3gnOiAnMScsICdAX3knOiAnMScgfSB9LFxuICAgICAgICAgIHNmYzogeyBzY2FsaW5nOiB7ICdAX3gnOiAnMScsICdAX3knOiAnMScgfSB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHR5cGVzOiB7IHBvdXM6IHsgcG91OiBwb3VzWG1sIH0gfSxcbiAgICAgIGluc3RhbmNlczogZ2xvYmFsVmFyc1htbCxcbiAgICB9LFxuICB9O1xuXG4gIHJldHVybiB7IG9rOiB0cnVlLCB4bWxDb250ZW50OiBidWlsZFhNTChvYmopLCBlcnJvcnMsIHdhcm5pbmdzIH07XG59XG5cbmZ1bmN0aW9uIGJ1aWxkUE9VWG1sKHBvdTogTm9ybWFsaXplZFBPVSwgd2FybmluZ3M6IHN0cmluZ1tdKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICBjb25zdCByZXR1cm5UeXBlVGFnID0gcG91LmxvY2FsVGFncy5maW5kKHQgPT4gdC5uYW1lID09PSAnX19yZXR1cm5UeXBlX18nKTtcbiAgY29uc3QgaW50ZXJmYWNlVmFycyA9IHBvdS5sb2NhbFRhZ3MuZmlsdGVyKHQgPT4gdC5uYW1lICE9PSAnX19yZXR1cm5UeXBlX18nKS5tYXAodGFnVG9WYXJYbWwpO1xuICBjb25zdCBib2R5Q29udGVudCA9IGJ1aWxkQm9keVhtbChwb3UsIHdhcm5pbmdzKTtcblxuICBjb25zdCBpZmFjZTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgbG9jYWxWYXJzOiB7IHZhcmlhYmxlOiBpbnRlcmZhY2VWYXJzIH0sXG4gIH07XG4gIGlmIChyZXR1cm5UeXBlVGFnKSB7XG4gICAgaWZhY2UucmV0dXJuVHlwZSA9IHsgW3JldHVyblR5cGVUYWcuZGF0YVR5cGVdOiB7fSB9O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICAnQF9uYW1lJzogcG91Lm5hbWUsXG4gICAgJ0BfcG91VHlwZSc6IHBvdS5wb3VUeXBlIHx8IChwb3UubGFuZ3VhZ2UgPT09ICdGQkQnIHx8IHBvdS5sYW5ndWFnZSA9PT0gJ1NGQycgPyAnZnVuY3Rpb25CbG9jaycgOiAncHJvZ3JhbScpLFxuICAgIGludGVyZmFjZTogaWZhY2UsXG4gICAgYm9keTogYm9keUNvbnRlbnQsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGJ1aWxkQm9keVhtbChwb3U6IE5vcm1hbGl6ZWRQT1UsIHdhcm5pbmdzOiBzdHJpbmdbXSk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgaWYgKHBvdS5sYW5ndWFnZSA9PT0gJ0xEJyAmJiBwb3UubGFkZGVyUHJvZ3JhbSkge1xuICAgIHJldHVybiB7IExEOiBidWlsZExEWG1sKHBvdS5sYWRkZXJQcm9ncmFtKSB9O1xuICB9XG4gIGlmIChwb3UubGFuZ3VhZ2UgPT09ICdGQkQnICYmIHBvdS5mYmRQcm9ncmFtKSB7XG4gICAgcmV0dXJuIHsgRkJEOiBidWlsZEZCRFhtbChwb3UuZmJkUHJvZ3JhbSkgfTtcbiAgfVxuICBpZiAocG91Lmxhbmd1YWdlID09PSAnU0ZDJyAmJiBwb3Uuc2ZjUHJvZ3JhbSkge1xuICAgIHJldHVybiB7IFNGQzogYnVpbGRTRkNYbWwocG91LnNmY1Byb2dyYW0pIH07XG4gIH1cbiAgaWYgKHBvdS5sYW5ndWFnZSA9PT0gJ1NUJyAmJiBwb3Uuc3RTb3VyY2UpIHtcbiAgICBjb25zdCBsaW5lcyA9IHBvdS5zdFNvdXJjZS5zcGxpdCgnXFxuJyk7XG4gICAgcmV0dXJuIHsgU1Q6IHsgJ3hodG1sOnAnOiBsaW5lcy5sZW5ndGggPT09IDEgPyBsaW5lc1swXSA6IGxpbmVzIH0gfTtcbiAgfVxuICB3YXJuaW5ncy5wdXNoKGBQT1UgXCIke3BvdS5uYW1lfVwiOiBubyBwcm9ncmFtIGRhdGEgXHUyMDE0IGVtcHR5IGJvZHlgKTtcbiAgcmV0dXJuIHsgU1Q6IHsgJ3hodG1sOnAnOiAnKCogZW1wdHkgKiknIH0gfTtcbn1cblxuZnVuY3Rpb24gYnVpbGRMRFhtbChsYWRkZXI6IExhZGRlclByb2dyYW0pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgcnVuZzogbGFkZGVyLnJ1bmdzLm1hcCgocnVuZywgcmkpID0+ICh7XG4gICAgICAnQF9sb2NhbElkJzogU3RyaW5nKHJpICsgMSksXG4gICAgICBjb21tZW50OiBydW5nLmNvbW1lbnQgfHwgdW5kZWZpbmVkLFxuICAgICAgLi4uYnVpbGRSdW5nRWxlbWVudHNYbWwocnVuZyksXG4gICAgfSkpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZFJ1bmdFbGVtZW50c1htbChydW5nOiBSdW5nKTogUmVjb3JkPHN0cmluZywgdW5rbm93bltdPiB7XG4gIGNvbnN0IGNvbnRhY3RzOiB1bmtub3duW10gPSBbXTtcbiAgY29uc3QgY29pbHM6IHVua25vd25bXSA9IFtdO1xuICBjb25zdCBibG9ja3M6IHVua25vd25bXSA9IFtdO1xuICAvLyBsZWZ0UG93ZXJSYWlsIGdldHMgbG9jYWxJZD0xOyBlbGVtZW50cyBzdGFydCBhdCAyXG4gIGxldCBpZCA9IDI7XG4gIGNvbnN0IGxlZnRSYWlsTG9jYWxJZCA9IDE7XG5cbiAgZnVuY3Rpb24gZW1pdEVsZW1lbnQoZWw6IExhZGRlckVsZW1lbnQsIHByZXZSZWZJZDogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCBsb2NhbElkID0gaWQrKztcbiAgICBpZiAoZWwua2luZCA9PT0gJ2NvbnRhY3QnKSB7XG4gICAgICBjb25zdCBjID0gZWwgYXMgQ29udGFjdEVsZW1lbnQ7XG4gICAgICBjb25zdCBvYmo6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xuICAgICAgICAnQF9sb2NhbElkJzogU3RyaW5nKGxvY2FsSWQpLFxuICAgICAgICAnQF9uZWdhdGVkJzogYy50eXBlID09PSAnTkMnID8gJ3RydWUnIDogJ2ZhbHNlJyxcbiAgICAgICAgJ0BfZWRnZSc6IGMudHlwZSA9PT0gJ1BfQ09OVEFDVCcgPyAncmlzaW5nJyA6IGMudHlwZSA9PT0gJ05fQ09OVEFDVCcgPyAnZmFsbGluZycgOiB1bmRlZmluZWQsXG4gICAgICAgIHZhcmlhYmxlOiBjLnRhZy5uYW1lLFxuICAgICAgICBwb3NpdGlvbjogeyAnQF94JzogZWwucG9zaXRpb24/LnggPz8gMCwgJ0BfeSc6IGVsLnBvc2l0aW9uPy55ID8/IDAgfSxcbiAgICAgICAgY29ubmVjdGlvblBvaW50SW46IHsgY29ubmVjdGlvbjogeyAnQF9yZWZMb2NhbElkJzogU3RyaW5nKHByZXZSZWZJZCkgfSB9LFxuICAgICAgICBjb25uZWN0aW9uUG9pbnRPdXQ6IHsgcmVsUG9zaXRpb246IHsgJ0BfeCc6ICcwJywgJ0BfeSc6ICcwJyB9IH0sXG4gICAgICB9O1xuICAgICAgY29udGFjdHMucHVzaChvYmopO1xuICAgIH0gZWxzZSBpZiAoZWwua2luZCA9PT0gJ2NvaWwnKSB7XG4gICAgICBjb25zdCBjID0gZWwgYXMgQ29pbEVsZW1lbnQ7XG4gICAgICBjb25zdCBzdG9yYWdlID0gYy50eXBlID09PSAnc2V0JyA/ICdzZXQnIDogYy50eXBlID09PSAncmVzZXQnID8gJ3Jlc2V0JyA6IGMudHlwZSA9PT0gJ2xhdGNoJyA/ICdyZXRlbnRpdmUnIDogdW5kZWZpbmVkO1xuICAgICAgY29uc3QgZWRnZSA9IChjLnR5cGUgYXMgc3RyaW5nKSA9PT0gJ3Bvc2l0aXZlX3RyYW5zaXRpb24nID8gJ3Jpc2luZycgOiAoYy50eXBlIGFzIHN0cmluZykgPT09ICduZWdhdGl2ZV90cmFuc2l0aW9uJyA/ICdmYWxsaW5nJyA6IHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IG9iajogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgICAgICdAX2xvY2FsSWQnOiBTdHJpbmcobG9jYWxJZCksXG4gICAgICAgICdAX25lZ2F0ZWQnOiBjLnR5cGUgPT09ICduZWdhdGVkJyA/ICd0cnVlJyA6ICdmYWxzZScsXG4gICAgICAgICdAX3N0b3JhZ2UnOiBzdG9yYWdlLFxuICAgICAgICAnQF9lZGdlJzogZWRnZSxcbiAgICAgICAgdmFyaWFibGU6IGMudGFnLm5hbWUsXG4gICAgICAgIHBvc2l0aW9uOiB7ICdAX3gnOiBlbC5wb3NpdGlvbj8ueCA/PyAwLCAnQF95JzogZWwucG9zaXRpb24/LnkgPz8gMCB9LFxuICAgICAgICBjb25uZWN0aW9uUG9pbnRJbjogeyBjb25uZWN0aW9uOiB7ICdAX3JlZkxvY2FsSWQnOiBTdHJpbmcocHJldlJlZklkKSB9IH0sXG4gICAgICB9O1xuICAgICAgY29pbHMucHVzaChvYmopO1xuICAgIH0gZWxzZSBpZiAoZWwua2luZCA9PT0gJ2Jsb2NrJykge1xuICAgICAgY29uc3QgYiA9IGVsIGFzIEJsb2NrRWxlbWVudDtcbiAgICAgIGNvbnN0IGZiVHlwZU1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsgVE9OOidUT04nLFRPRjonVE9GJyxUUDonVFAnLENUVTonQ1RVJyxDVEQ6J0NURCcsQ1RVRDonQ1RVRCcsU1I6J1NSJyxSUzonUlMnLFJUUklHOidSX1RSSUcnLEZUUklHOidGX1RSSUcnIH07XG4gICAgICAvLyBCdWlsZCBpbnB1dFZhcmlhYmxlcyAvIG91dHB1dFZhcmlhYmxlcyBmcm9tIHBpbnNcbiAgICAgIGNvbnN0IGlucHV0VmFycyA9IE9iamVjdC5lbnRyaWVzKGIucGlucyB8fCB7fSlcbiAgICAgICAgLmZpbHRlcigoW3Bpbk5hbWVdKSA9PiAhWydPVVQnLCdRJywnUTEnLCdDVicsJ0VUJ10uaW5jbHVkZXMocGluTmFtZSkpXG4gICAgICAgIC5tYXAoKFtwaW5OYW1lLCB0YWdSZWZdKSA9PiAoe1xuICAgICAgICAgIHZhcmlhYmxlOiB7XG4gICAgICAgICAgICAnQF9mb3JtYWxQYXJhbWV0ZXInOiBwaW5OYW1lLFxuICAgICAgICAgICAgJ0BfbmVnYXRlZCc6ICdmYWxzZScsXG4gICAgICAgICAgICBjb25uZWN0aW9uUG9pbnRJbjogeyBjb25uZWN0aW9uOiB7ICdAX3JlZkxvY2FsSWQnOiBTdHJpbmcocHJldlJlZklkKSB9IH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSkpO1xuICAgICAgY29uc3Qgb3V0cHV0VmFycyA9IE9iamVjdC5lbnRyaWVzKGIucGlucyB8fCB7fSlcbiAgICAgICAgLmZpbHRlcigoW3Bpbk5hbWVdKSA9PiBbJ09VVCcsJ1EnLCdRMScsJ0NWJywnRVQnXS5pbmNsdWRlcyhwaW5OYW1lKSlcbiAgICAgICAgLm1hcCgoW3Bpbk5hbWUsIHRhZ1JlZl0pID0+ICh7XG4gICAgICAgICAgdmFyaWFibGU6IHtcbiAgICAgICAgICAgICdAX2Zvcm1hbFBhcmFtZXRlcic6IHBpbk5hbWUsXG4gICAgICAgICAgICAnQF9uZWdhdGVkJzogJ2ZhbHNlJyxcbiAgICAgICAgICAgIGNvbm5lY3Rpb25Qb2ludE91dDogeyByZWxQb3NpdGlvbjogeyAnQF94JzogJzAnLCAnQF95JzogJzAnIH0gfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KSk7XG4gICAgICBjb25zdCBvYmo6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xuICAgICAgICAnQF9sb2NhbElkJzogU3RyaW5nKGxvY2FsSWQpLFxuICAgICAgICAnQF90eXBlTmFtZSc6IGZiVHlwZU1hcFtiLmZiVHlwZV0gfHwgYi5mYlR5cGUsXG4gICAgICAgICdAX2luc3RhbmNlTmFtZSc6IGIuaW5zdGFuY2VOYW1lLFxuICAgICAgICBwb3NpdGlvbjogeyAnQF94JzogZWwucG9zaXRpb24/LnggPz8gMCwgJ0BfeSc6IGVsLnBvc2l0aW9uPy55ID8/IDAgfSxcbiAgICAgICAgaW5wdXRWYXJpYWJsZXM6IGlucHV0VmFycy5sZW5ndGggPyB7IHZhcmlhYmxlOiBpbnB1dFZhcnMubWFwKGl2ID0+IGl2LnZhcmlhYmxlKSB9IDogdW5kZWZpbmVkLFxuICAgICAgICBvdXRwdXRWYXJpYWJsZXM6IG91dHB1dFZhcnMubGVuZ3RoID8geyB2YXJpYWJsZTogb3V0cHV0VmFycy5tYXAob3YgPT4gb3YudmFyaWFibGUpIH0gOiB1bmRlZmluZWQsXG4gICAgICAgIGluT3V0VmFyaWFibGVzOiB7fSxcbiAgICAgIH07XG4gICAgICBibG9ja3MucHVzaChvYmopO1xuICAgIH1cbiAgICByZXR1cm4gbG9jYWxJZDtcbiAgfVxuXG4gIC8vIEVtaXQgbWFpbiBlbGVtZW50cyBpbiBzZXJpZXMgc3RhcnRpbmcgZnJvbSBsZWZ0UmFpbFxuICBsZXQgcHJldklkOiBudW1iZXIgPSBsZWZ0UmFpbExvY2FsSWQ7XG4gIGZvciAoY29uc3QgZWwgb2YgcnVuZy5lbGVtZW50cykge1xuICAgIHByZXZJZCA9IGVtaXRFbGVtZW50KGVsLCBwcmV2SWQpO1xuICB9XG5cbiAgLy8gRW1pdCBicmFuY2ggZWxlbWVudHMgXHUyMDE0IGVhY2ggYnJhbmNoIHN0YXJ0cyBmcm9tIHRoZSBsZWZ0IHJhaWxcbiAgaWYgKHJ1bmcuYnJhbmNoZXMgJiYgcnVuZy5icmFuY2hlcy5sZW5ndGggPiAwKSB7XG4gICAgZm9yIChjb25zdCBicmFuY2ggb2YgcnVuZy5icmFuY2hlcykge1xuICAgICAgbGV0IGJyYW5jaFByZXY6IG51bWJlciA9IGxlZnRSYWlsTG9jYWxJZDtcbiAgICAgIGZvciAoY29uc3QgZWwgb2YgYnJhbmNoLmVsZW1lbnRzKSB7XG4gICAgICAgIGJyYW5jaFByZXYgPSBlbWl0RWxlbWVudChlbCwgYnJhbmNoUHJldik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY29uc3QgbGVmdFJhaWw6IHVua25vd24gPSB7XG4gICAgJ0BfbG9jYWxJZCc6IFN0cmluZyhsZWZ0UmFpbExvY2FsSWQpLFxuICAgICdAX3dpZHRoJzogJzEwJyxcbiAgICBwb3NpdGlvbjogeyAnQF94JzogMCwgJ0BfeSc6IDAgfSxcbiAgICBjb25uZWN0aW9uUG9pbnRPdXQ6IHsgY29ubmVjdGlvbjogW10gfSxcbiAgfTtcblxuICAvLyByaWdodFBvd2VyUmFpbCBnZXRzIHRoZSBuZXh0IGxvY2FsSWQ7IGl0IGNvbm5lY3RzIGZyb20gdGhlIGxhc3QgZW1pdHRlZCBjb2lsIChwcmV2SWQpXG4gIGNvbnN0IHJpZ2h0UmFpbExvY2FsSWQgPSBpZCsrO1xuICBjb25zdCByaWdodFJhaWw6IHVua25vd24gPSB7XG4gICAgJ0BfbG9jYWxJZCc6IFN0cmluZyhyaWdodFJhaWxMb2NhbElkKSxcbiAgICAnQF93aWR0aCc6ICcxMCcsXG4gICAgcG9zaXRpb246IHsgJ0BfeCc6IDAsICdAX3knOiAwIH0sXG4gICAgY29ubmVjdGlvblBvaW50SW46IHsgY29ubmVjdGlvbjogeyAnQF9yZWZMb2NhbElkJzogU3RyaW5nKHByZXZJZCkgfSB9LFxuICB9O1xuXG4gIGNvbnN0IHJlc3VsdDogUmVjb3JkPHN0cmluZywgdW5rbm93bltdPiA9IHt9O1xuICByZXN1bHQubGVmdFBvd2VyUmFpbCA9IFtsZWZ0UmFpbF07XG4gIGlmIChjb250YWN0cy5sZW5ndGgpIHJlc3VsdC5jb250YWN0ID0gY29udGFjdHM7XG4gIGlmIChjb2lscy5sZW5ndGgpIHJlc3VsdC5jb2lsID0gY29pbHM7XG4gIGlmIChibG9ja3MubGVuZ3RoKSByZXN1bHQuYmxvY2sgPSBibG9ja3M7XG4gIHJlc3VsdC5yaWdodFBvd2VyUmFpbCA9IFtyaWdodFJhaWxdO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vLyBTdHJpcCBpbXBvcnQtdGltZSBwcmVmaXhlcyBzbyByZS1leHBvcnRlZCBsb2NhbElkcyBhcmUgY2xlYW4gaW50ZWdlcnNcbmZ1bmN0aW9uIGNsZWFuTG9jYWxJZChpZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGlkLnJlcGxhY2UoL14oZmJkLXZhci18ZmJkLWJsb2NrLXxmYmQtfHN0LWZiZC12YXItfHN0LWZiZC0pLywgJycpO1xufVxuXG5mdW5jdGlvbiBidWlsZEZCRFhtbChmYmQ6IEZCRFByb2dyYW0pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIC8vIEJ1aWxkIGEgd2lyZSBsb29rdXA6IHRhcmdldCBub2RlSWQrcGluIFx1MjE5MiBzb3VyY2Ugbm9kZUlkK3BpblxuICBjb25zdCB3aXJlc0J5VGFyZ2V0ID0gbmV3IE1hcDxzdHJpbmcsIHsgcmVmTG9jYWxJZDogc3RyaW5nOyBmb3JtYWxQYXJhbWV0ZXI6IHN0cmluZyB9W10+KCk7XG4gIGZvciAoY29uc3QgdyBvZiBmYmQud2lyZXMpIHtcbiAgICBjb25zdCBrZXkgPSBgJHt3LnRvLm5vZGVJZH06OiR7dy50by5waW59YDtcbiAgICBpZiAoIXdpcmVzQnlUYXJnZXQuaGFzKGtleSkpIHdpcmVzQnlUYXJnZXQuc2V0KGtleSwgW10pO1xuICAgIHdpcmVzQnlUYXJnZXQuZ2V0KGtleSkhLnB1c2goeyByZWZMb2NhbElkOiB3LmZyb20ubm9kZUlkLCBmb3JtYWxQYXJhbWV0ZXI6IHcuZnJvbS5waW4gfSk7XG4gIH1cblxuICBjb25zdCBibG9ja3MgPSBmYmQubm9kZXNcbiAgICAuZmlsdGVyKG4gPT4gbi50eXBlICE9PSAnSU5fVkFSSUFCTEUnICYmIG4udHlwZSAhPT0gJ09VVF9WQVJJQUJMRScgJiYgbi50eXBlICE9PSAnSU5fT1VUX1ZBUklBQkxFJ1xuICAgICAgJiYgbi50eXBlICE9PSAnTEFCRUwnICYmIG4udHlwZSAhPT0gJ0pVTVAnICYmIG4udHlwZSAhPT0gJ1JFVFVSTidcbiAgICAgICYmIG4udHlwZSAhPT0gJ0NPTk5FQ1RPUicgJiYgbi50eXBlICE9PSAnQ09OVElOVUFUSU9OJylcbiAgICAubWFwKG4gPT4ge1xuICAgICAgY29uc3QgaW5wdXRWYXJpYWJsZXMgPSAobi5pbnB1dHMgfHwgW10pLm1hcChwaW4gPT4ge1xuICAgICAgICBjb25zdCBjb25ucyA9IHdpcmVzQnlUYXJnZXQuZ2V0KGAke24uaWR9Ojoke3Bpbi5uYW1lfWApIHx8IFtdO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHZhcmlhYmxlOiB7XG4gICAgICAgICAgICAnQF9mb3JtYWxQYXJhbWV0ZXInOiBwaW4ubmFtZSxcbiAgICAgICAgICAgICdAX25lZ2F0ZWQnOiBwaW4ubmVnYXRlZCA/ICd0cnVlJyA6ICdmYWxzZScsXG4gICAgICAgICAgICAuLi4oY29ubnMubGVuZ3RoID4gMCA/IHtcbiAgICAgICAgICAgICAgY29ubmVjdGlvblBvaW50SW46IHtcbiAgICAgICAgICAgICAgICBjb25uZWN0aW9uOiBjb25ucy5tYXAoYyA9PiAoe1xuICAgICAgICAgICAgICAgICAgJ0BfcmVmTG9jYWxJZCc6IGMucmVmTG9jYWxJZCxcbiAgICAgICAgICAgICAgICAgICdAX2Zvcm1hbFBhcmFtZXRlcic6IGMuZm9ybWFsUGFyYW1ldGVyLFxuICAgICAgICAgICAgICAgIH0pKSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0gOiB7fSksXG4gICAgICAgICAgfSxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBvdXRwdXRWYXJpYWJsZXMgPSAobi5vdXRwdXRzIHx8IFtdKS5tYXAocGluID0+ICh7XG4gICAgICAgIHZhcmlhYmxlOiB7XG4gICAgICAgICAgJ0BfZm9ybWFsUGFyYW1ldGVyJzogcGluLm5hbWUsXG4gICAgICAgICAgJ0BfbmVnYXRlZCc6IHBpbi5uZWdhdGVkID8gJ3RydWUnIDogJ2ZhbHNlJyxcbiAgICAgICAgICBjb25uZWN0aW9uUG9pbnRPdXQ6IHsgcmVsUG9zaXRpb246IHsgJ0BfeCc6ICcwJywgJ0BfeSc6ICcwJyB9IH0sXG4gICAgICAgIH0sXG4gICAgICB9KSk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgICdAX2xvY2FsSWQnOiBjbGVhbkxvY2FsSWQobi5pZCksXG4gICAgICAgICdAX3R5cGVOYW1lJzogbi50eXBlLFxuICAgICAgICAnQF9pbnN0YW5jZU5hbWUnOiBuLmluc3RhbmNlTmFtZSB8fCBjbGVhbkxvY2FsSWQobi5pZCksXG4gICAgICAgICdAX2V4ZWN1dGlvbk9yZGVySWQnOiAobiBhcyBhbnkpLmV4ZWN1dGlvbk9yZGVySWQgIT0gbnVsbCA/IFN0cmluZygobiBhcyBhbnkpLmV4ZWN1dGlvbk9yZGVySWQpIDogdW5kZWZpbmVkLFxuICAgICAgICBwb3NpdGlvbjogeyAnQF94Jzogbi5wb3NpdGlvbi54LCAnQF95Jzogbi5wb3NpdGlvbi55IH0sXG4gICAgICAgIGlucHV0VmFyaWFibGVzOiBpbnB1dFZhcmlhYmxlcy5sZW5ndGggPyB7IHZhcmlhYmxlOiBpbnB1dFZhcmlhYmxlcy5tYXAoaXYgPT4gaXYudmFyaWFibGUpIH0gOiB1bmRlZmluZWQsXG4gICAgICAgIG91dHB1dFZhcmlhYmxlczogb3V0cHV0VmFyaWFibGVzLmxlbmd0aCA/IHsgdmFyaWFibGU6IG91dHB1dFZhcmlhYmxlcy5tYXAob3YgPT4gb3YudmFyaWFibGUpIH0gOiB1bmRlZmluZWQsXG4gICAgICAgIGluT3V0VmFyaWFibGVzOiB7fSxcbiAgICAgIH07XG4gICAgfSk7XG5cbiAgY29uc3QgaW5WYXJzID0gZmJkLm5vZGVzXG4gICAgLmZpbHRlcihuID0+IG4udHlwZSA9PT0gJ0lOX1ZBUklBQkxFJylcbiAgICAubWFwKG4gPT4gKHtcbiAgICAgICdAX2xvY2FsSWQnOiBjbGVhbkxvY2FsSWQobi5pZCksXG4gICAgICAnQF9uZWdhdGVkJzogKG4ubmVnYXRlZCA9PT0gdHJ1ZSkgPyAndHJ1ZScgOiAnZmFsc2UnLFxuICAgICAgcG9zaXRpb246IHsgJ0BfeCc6IG4ucG9zaXRpb24ueCwgJ0BfeSc6IG4ucG9zaXRpb24ueSB9LFxuICAgICAgZXhwcmVzc2lvbjogbi50YWc/Lm5hbWUgfHwgJycsXG4gICAgICBjb25uZWN0aW9uUG9pbnRPdXQ6IHsgcmVsUG9zaXRpb246IHsgJ0BfeCc6ICcwJywgJ0BfeSc6ICcwJyB9IH0sXG4gICAgfSkpO1xuXG4gIGNvbnN0IG91dFZhcnMgPSBmYmQubm9kZXNcbiAgICAuZmlsdGVyKG4gPT4gbi50eXBlID09PSAnT1VUX1ZBUklBQkxFJylcbiAgICAubWFwKG4gPT4ge1xuICAgICAgY29uc3QgY29ubnMgPSB3aXJlc0J5VGFyZ2V0LmdldChgJHtuLmlkfTo6SU5gKSB8fCBbXTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgICdAX2xvY2FsSWQnOiBjbGVhbkxvY2FsSWQobi5pZCksXG4gICAgICAgICdAX25lZ2F0ZWQnOiAobi5uZWdhdGVkID09PSB0cnVlKSA/ICd0cnVlJyA6ICdmYWxzZScsXG4gICAgICAgIHBvc2l0aW9uOiB7ICdAX3gnOiBuLnBvc2l0aW9uLngsICdAX3knOiBuLnBvc2l0aW9uLnkgfSxcbiAgICAgICAgZXhwcmVzc2lvbjogbi50YWc/Lm5hbWUgfHwgJycsXG4gICAgICAgIC4uLihjb25ucy5sZW5ndGggPiAwID8ge1xuICAgICAgICAgIGNvbm5lY3Rpb25Qb2ludEluOiB7XG4gICAgICAgICAgICBjb25uZWN0aW9uOiBjb25ucy5tYXAoYyA9PiAoe1xuICAgICAgICAgICAgICAnQF9yZWZMb2NhbElkJzogYy5yZWZMb2NhbElkLFxuICAgICAgICAgICAgICAnQF9mb3JtYWxQYXJhbWV0ZXInOiBjLmZvcm1hbFBhcmFtZXRlcixcbiAgICAgICAgICAgIH0pKSxcbiAgICAgICAgICB9LFxuICAgICAgICB9IDoge30pLFxuICAgICAgfTtcbiAgICB9KTtcblxuICAvLyBpbk91dFZhcmlhYmxlIGV4cG9ydFxuICBjb25zdCBpbk91dFZhcnMgPSBmYmQubm9kZXNcbiAgICAuZmlsdGVyKG4gPT4gbi50eXBlID09PSAnSU5fT1VUX1ZBUklBQkxFJylcbiAgICAubWFwKG4gPT4ge1xuICAgICAgY29uc3QgY29ubnMgPSB3aXJlc0J5VGFyZ2V0LmdldChgJHtuLmlkfTo6SU5gKSB8fCBbXTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgICdAX2xvY2FsSWQnOiBjbGVhbkxvY2FsSWQobi5pZCksXG4gICAgICAgICdAX25lZ2F0ZWQnOiAnZmFsc2UnLFxuICAgICAgICBwb3NpdGlvbjogeyAnQF94Jzogbi5wb3NpdGlvbi54LCAnQF95Jzogbi5wb3NpdGlvbi55IH0sXG4gICAgICAgIGV4cHJlc3Npb246IG4udGFnPy5uYW1lIHx8ICcnLFxuICAgICAgICAuLi4oY29ubnMubGVuZ3RoID4gMCA/IHtcbiAgICAgICAgICBjb25uZWN0aW9uUG9pbnRJbjoge1xuICAgICAgICAgICAgY29ubmVjdGlvbjogY29ubnMubWFwKGMgPT4gKHsgJ0BfcmVmTG9jYWxJZCc6IGMucmVmTG9jYWxJZCwgJ0BfZm9ybWFsUGFyYW1ldGVyJzogYy5mb3JtYWxQYXJhbWV0ZXIgfSkpLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0gOiB7fSksXG4gICAgICAgIGNvbm5lY3Rpb25Qb2ludE91dDogeyByZWxQb3NpdGlvbjogeyAnQF94JzogJzAnLCAnQF95JzogJzAnIH0gfSxcbiAgICAgIH07XG4gICAgfSk7XG5cbiAgLy8gbGFiZWwgZXhwb3J0XG4gIGNvbnN0IGxhYmVscyA9IGZiZC5ub2Rlcy5maWx0ZXIobiA9PiBuLnR5cGUgPT09ICdMQUJFTCcgYXMgYW55KS5tYXAobiA9PiB7XG4gICAgY29uc3QgY29ubnMgPSB3aXJlc0J5VGFyZ2V0LmdldChgJHtuLmlkfTo6SU5gKSB8fCBbXTtcbiAgICByZXR1cm4ge1xuICAgICAgJ0BfbG9jYWxJZCc6IGNsZWFuTG9jYWxJZChuLmlkKSxcbiAgICAgICdAX2xhYmVsJzogbi5pbnN0YW5jZU5hbWUgfHwgJycsXG4gICAgICBwb3NpdGlvbjogeyAnQF94Jzogbi5wb3NpdGlvbi54LCAnQF95Jzogbi5wb3NpdGlvbi55IH0sXG4gICAgICAuLi4oY29ubnMubGVuZ3RoID4gMCA/IHsgY29ubmVjdGlvblBvaW50SW46IHsgY29ubmVjdGlvbjogY29ubnMubWFwKGMgPT4gKHsgJ0BfcmVmTG9jYWxJZCc6IGMucmVmTG9jYWxJZCwgJ0BfZm9ybWFsUGFyYW1ldGVyJzogYy5mb3JtYWxQYXJhbWV0ZXIgfSkpIH0gfSA6IHt9KSxcbiAgICB9O1xuICB9KTtcblxuICAvLyBqdW1wIGV4cG9ydFxuICBjb25zdCBqdW1wcyA9IGZiZC5ub2Rlcy5maWx0ZXIobiA9PiBuLnR5cGUgPT09ICdKVU1QJyBhcyBhbnkpLm1hcChuID0+IHtcbiAgICBjb25zdCBjb25ucyA9IHdpcmVzQnlUYXJnZXQuZ2V0KGAke24uaWR9OjpJTmApIHx8IFtdO1xuICAgIHJldHVybiB7XG4gICAgICAnQF9sb2NhbElkJzogY2xlYW5Mb2NhbElkKG4uaWQpLFxuICAgICAgJ0BfbGFiZWwnOiBuLmluc3RhbmNlTmFtZSB8fCAnJyxcbiAgICAgIHBvc2l0aW9uOiB7ICdAX3gnOiBuLnBvc2l0aW9uLngsICdAX3knOiBuLnBvc2l0aW9uLnkgfSxcbiAgICAgIC4uLihjb25ucy5sZW5ndGggPiAwID8geyBjb25uZWN0aW9uUG9pbnRJbjogeyBjb25uZWN0aW9uOiBjb25ucy5tYXAoYyA9PiAoeyAnQF9yZWZMb2NhbElkJzogYy5yZWZMb2NhbElkLCAnQF9mb3JtYWxQYXJhbWV0ZXInOiBjLmZvcm1hbFBhcmFtZXRlciB9KSkgfSB9IDoge30pLFxuICAgIH07XG4gIH0pO1xuXG4gIC8vIHJldHVybiBleHBvcnRcbiAgY29uc3QgcmV0dXJucyA9IGZiZC5ub2Rlcy5maWx0ZXIobiA9PiBuLnR5cGUgPT09ICdSRVRVUk4nIGFzIGFueSkubWFwKG4gPT4ge1xuICAgIGNvbnN0IGNvbm5zID0gd2lyZXNCeVRhcmdldC5nZXQoYCR7bi5pZH06OklOYCkgfHwgW107XG4gICAgcmV0dXJuIHtcbiAgICAgICdAX2xvY2FsSWQnOiBjbGVhbkxvY2FsSWQobi5pZCksXG4gICAgICBwb3NpdGlvbjogeyAnQF94Jzogbi5wb3NpdGlvbi54LCAnQF95Jzogbi5wb3NpdGlvbi55IH0sXG4gICAgICAuLi4oY29ubnMubGVuZ3RoID4gMCA/IHsgY29ubmVjdGlvblBvaW50SW46IHsgY29ubmVjdGlvbjogY29ubnMubWFwKGMgPT4gKHsgJ0BfcmVmTG9jYWxJZCc6IGMucmVmTG9jYWxJZCwgJ0BfZm9ybWFsUGFyYW1ldGVyJzogYy5mb3JtYWxQYXJhbWV0ZXIgfSkpIH0gfSA6IHt9KSxcbiAgICB9O1xuICB9KTtcblxuICAvLyBjb25uZWN0b3IgZXhwb3J0XG4gIGNvbnN0IGNvbm5lY3RvcnMgPSBmYmQubm9kZXMuZmlsdGVyKG4gPT4gbi50eXBlID09PSAnQ09OTkVDVE9SJyBhcyBhbnkpLm1hcChuID0+IHtcbiAgICBjb25zdCBjb25ucyA9IHdpcmVzQnlUYXJnZXQuZ2V0KGAke24uaWR9OjpJTmApIHx8IFtdO1xuICAgIHJldHVybiB7XG4gICAgICAnQF9sb2NhbElkJzogY2xlYW5Mb2NhbElkKG4uaWQpLFxuICAgICAgJ0BfbmFtZSc6IG4uaW5zdGFuY2VOYW1lIHx8ICcnLFxuICAgICAgcG9zaXRpb246IHsgJ0BfeCc6IG4ucG9zaXRpb24ueCwgJ0BfeSc6IG4ucG9zaXRpb24ueSB9LFxuICAgICAgLi4uKGNvbm5zLmxlbmd0aCA+IDAgPyB7IGNvbm5lY3Rpb25Qb2ludEluOiB7IGNvbm5lY3Rpb246IGNvbm5zLm1hcChjID0+ICh7ICdAX3JlZkxvY2FsSWQnOiBjLnJlZkxvY2FsSWQsICdAX2Zvcm1hbFBhcmFtZXRlcic6IGMuZm9ybWFsUGFyYW1ldGVyIH0pKSB9IH0gOiB7fSksXG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gY29udGludWF0aW9uIGV4cG9ydFxuICBjb25zdCBjb250aW51YXRpb25zID0gZmJkLm5vZGVzLmZpbHRlcihuID0+IG4udHlwZSA9PT0gJ0NPTlRJTlVBVElPTicgYXMgYW55KS5tYXAobiA9PiAoe1xuICAgICdAX2xvY2FsSWQnOiBjbGVhbkxvY2FsSWQobi5pZCksXG4gICAgJ0BfbmFtZSc6IG4uaW5zdGFuY2VOYW1lIHx8ICcnLFxuICAgIHBvc2l0aW9uOiB7ICdAX3gnOiBuLnBvc2l0aW9uLngsICdAX3knOiBuLnBvc2l0aW9uLnkgfSxcbiAgICBjb25uZWN0aW9uUG9pbnRPdXQ6IHsgcmVsUG9zaXRpb246IHsgJ0BfeCc6ICcwJywgJ0BfeSc6ICcwJyB9IH0sXG4gIH0pKTtcblxuICBjb25zdCByZXN1bHQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XG4gIGlmIChibG9ja3MubGVuZ3RoKSByZXN1bHQuYmxvY2sgPSBibG9ja3M7XG4gIGlmIChpblZhcnMubGVuZ3RoKSByZXN1bHQuaW5WYXJpYWJsZSA9IGluVmFycztcbiAgaWYgKG91dFZhcnMubGVuZ3RoKSByZXN1bHQub3V0VmFyaWFibGUgPSBvdXRWYXJzO1xuICBpZiAoaW5PdXRWYXJzLmxlbmd0aCkgcmVzdWx0LmluT3V0VmFyaWFibGUgPSBpbk91dFZhcnM7XG4gIGlmIChsYWJlbHMubGVuZ3RoKSByZXN1bHQubGFiZWwgPSBsYWJlbHM7XG4gIGlmIChqdW1wcy5sZW5ndGgpIHJlc3VsdC5qdW1wID0ganVtcHM7XG4gIGlmIChyZXR1cm5zLmxlbmd0aCkgcmVzdWx0WydyZXR1cm4nXSA9IHJldHVybnM7XG4gIGlmIChjb25uZWN0b3JzLmxlbmd0aCkgcmVzdWx0LmNvbm5lY3RvciA9IGNvbm5lY3RvcnM7XG4gIGlmIChjb250aW51YXRpb25zLmxlbmd0aCkgcmVzdWx0LmNvbnRpbnVhdGlvbiA9IGNvbnRpbnVhdGlvbnM7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkU0ZDWG1sKHNmYzogU0ZDUHJvZ3JhbSk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgLy8gQnVpbGQgbGluayBsb29rdXA6IGZyb20gXHUyMTkyIFt0b11cbiAgY29uc3Qgb3V0TGlua3MgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nW10+KCk7XG4gIGNvbnN0IGluTGlua3MgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nW10+KCk7XG4gIGZvciAoY29uc3QgbGluayBvZiBzZmMubGlua3MpIHtcbiAgICBpZiAoIW91dExpbmtzLmhhcyhsaW5rLmZyb20pKSBvdXRMaW5rcy5zZXQobGluay5mcm9tLCBbXSk7XG4gICAgb3V0TGlua3MuZ2V0KGxpbmsuZnJvbSkhLnB1c2gobGluay50byk7XG4gICAgaWYgKCFpbkxpbmtzLmhhcyhsaW5rLnRvKSkgaW5MaW5rcy5zZXQobGluay50bywgW10pO1xuICAgIGluTGlua3MuZ2V0KGxpbmsudG8pIS5wdXNoKGxpbmsuZnJvbSk7XG4gIH1cblxuICAvLyBCdWlsZCBpbnRlZ2VyIGxvY2FsSWQgbWFwIGZvciBhbGwgbm9kZSBJRHMgKFRDNiByZXF1aXJlcyBwb3NpdGl2ZSBpbnRlZ2VycylcbiAgY29uc3QgbG9jYWxJZE1hcCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gIGxldCBsb2NhbElkQ291bnRlciA9IDE7XG4gIGNvbnN0IGFsbElkcyA9IFtcbiAgICAuLi5zZmMuc3RlcHMubWFwKHMgPT4gcy5pZCksXG4gICAgLi4uc2ZjLnRyYW5zaXRpb25zLm1hcCh0ID0+IHQuaWQpLFxuICAgIC8vIGRpdmVyZ2VuY2UvY29udmVyZ2VuY2Ugbm9kZXMgZnJvbSBsaW5rc1xuICAgIC4uLnNmYy5saW5rc1xuICAgICAgLm1hcChsID0+IFtsLmZyb20sIGwudG9dKVxuICAgICAgLmZsYXQoKVxuICAgICAgLmZpbHRlcihpZCA9PiAvXnNmYy0oc2ltRGl2fHNpbUNvbnZ8c2VsRGl2fHNlbENvbnYpLS8udGVzdChpZCkpLFxuICBdO1xuICBmb3IgKGNvbnN0IGlkIG9mIGFsbElkcykge1xuICAgIGlmICghbG9jYWxJZE1hcC5oYXMoaWQpKSBsb2NhbElkTWFwLnNldChpZCwgbG9jYWxJZENvdW50ZXIrKyk7XG4gIH1cbiAgY29uc3QgbGlkID0gKGlkOiBzdHJpbmcpOiBzdHJpbmcgPT4gU3RyaW5nKGxvY2FsSWRNYXAuZ2V0KGlkKSA/PyBpZCk7XG5cbiAgY29uc3Qgc3RlcHMgPSBzZmMuc3RlcHMubWFwKHMgPT4ge1xuICAgIGNvbnN0IHRhcmdldHMgPSAob3V0TGlua3MuZ2V0KHMuaWQpIHx8IFtdKTtcbiAgICBjb25zdCBzb3VyY2VzID0gKGluTGlua3MuZ2V0KHMuaWQpIHx8IFtdKTtcblxuICAgIGNvbnN0IHJlc3VsdDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgICAnQF9sb2NhbElkJzogbGlkKHMuaWQpLFxuICAgICAgJ0BfbmFtZSc6IHMubmFtZSxcbiAgICAgICdAX2luaXRpYWxTdGVwJzogU3RyaW5nKHMuaXNJbml0aWFsKSxcbiAgICAgIHBvc2l0aW9uOiB7ICdAX3gnOiBzLnBvc2l0aW9uLngsICdAX3knOiBzLnBvc2l0aW9uLnkgfSxcbiAgICB9O1xuXG4gICAgLy8gY29ubmVjdGlvblBvaW50SW4gZnJvbSBpbmNvbWluZyB0cmFuc2l0aW9uc1xuICAgIGlmIChzb3VyY2VzLmxlbmd0aCA+IDApIHtcbiAgICAgIHJlc3VsdC5jb25uZWN0aW9uUG9pbnRJbiA9IHtcbiAgICAgICAgY29ubmVjdGlvbjogc291cmNlcy5tYXAoc3JjID0+ICh7ICdAX3JlZkxvY2FsSWQnOiBsaWQoc3JjKSB9KSksXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIGNvbm5lY3Rpb25Qb2ludE91dCB0byBvdXRnb2luZyB0cmFuc2l0aW9uc1xuICAgIGlmICh0YXJnZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHJlc3VsdC5jb25uZWN0aW9uUG9pbnRPdXQgPSB7XG4gICAgICAgIGNvbm5lY3Rpb246IHRhcmdldHMubWFwKHRndCA9PiAoeyAnQF9yZWZMb2NhbElkJzogbGlkKHRndCkgfSkpLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBTdGVwcyB0aGF0IGhhdmUgYWN0aW9ucyBnZXQgY29ubmVjdGlvblBvaW50T3V0QWN0aW9uXG4gICAgaWYgKHMuYWN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICByZXN1bHQuY29ubmVjdGlvblBvaW50T3V0QWN0aW9uID0geyAnQF9mb3JtYWxQYXJhbWV0ZXInOiAneCcgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9KTtcblxuICBjb25zdCB0cmFuc2l0aW9ucyA9IHNmYy50cmFuc2l0aW9ucy5tYXAodCA9PiB7XG4gICAgY29uc3QgdGFyZ2V0cyA9IG91dExpbmtzLmdldCh0LmlkKSB8fCBbXTtcbiAgICBjb25zdCBzb3VyY2VzID0gaW5MaW5rcy5nZXQodC5pZCkgfHwgW107XG5cbiAgICBjb25zdCByZXN1bHQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xuICAgICAgJ0BfbG9jYWxJZCc6IGxpZCh0LmlkKSxcbiAgICAgICdAX3ByaW9yaXR5JzogKHQgYXMgYW55KS5wcmlvcml0eSAhPSBudWxsID8gU3RyaW5nKCh0IGFzIGFueSkucHJpb3JpdHkpIDogdW5kZWZpbmVkLFxuICAgICAgcG9zaXRpb246IHsgJ0BfeCc6IHQucG9zaXRpb24ueCwgJ0BfeSc6IHQucG9zaXRpb24ueSB9LFxuICAgICAgY29uZGl0aW9uOiB7IFNUOiB7ICd4aHRtbDpwJzogdC5jb25kaXRpb24gfSB9LFxuICAgIH07XG5cbiAgICBpZiAoc291cmNlcy5sZW5ndGggPiAwKSB7XG4gICAgICByZXN1bHQuY29ubmVjdGlvblBvaW50SW4gPSB7XG4gICAgICAgIGNvbm5lY3Rpb246IHNvdXJjZXMubWFwKHNyYyA9PiAoeyAnQF9yZWZMb2NhbElkJzogbGlkKHNyYykgfSkpLFxuICAgICAgfTtcbiAgICB9XG4gICAgaWYgKHRhcmdldHMubGVuZ3RoID4gMCkge1xuICAgICAgcmVzdWx0LmNvbm5lY3Rpb25Qb2ludE91dCA9IHtcbiAgICAgICAgY29ubmVjdGlvbjogdGFyZ2V0cy5tYXAodGd0ID0+ICh7ICdAX3JlZkxvY2FsSWQnOiBsaWQodGd0KSB9KSksXG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0pO1xuXG4gIC8vIEVtaXQgZGl2ZXJnZW5jZS9jb252ZXJnZW5jZSBlbGVtZW50cyBmcm9tIGxpbmtzIHdpdGggc3BlY2lhbCB0eXBlc1xuICBjb25zdCBzaW11bHRhbmVvdXNEaXZlcmdlbmNlczogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSA9IFtdO1xuICBjb25zdCBzaW11bHRhbmVvdXNDb252ZXJnZW5jZXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+W10gPSBbXTtcbiAgY29uc3Qgc2VsZWN0aW9uRGl2ZXJnZW5jZXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+W10gPSBbXTtcbiAgY29uc3Qgc2VsZWN0aW9uQ29udmVyZ2VuY2VzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdID0gW107XG5cbiAgY29uc3QgZGl2SWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGZvciAoY29uc3QgbGluayBvZiBzZmMubGlua3MpIHtcbiAgICBpZiAobGluay50eXBlID09PSAnc2ltdWx0YW5lb3VzLWRpdmVyZ2VuY2UnIHx8IGxpbmsudHlwZSA9PT0gJ3NpbXVsdGFuZW91cy1jb252ZXJnZW5jZScgfHxcbiAgICAgICAgbGluay50eXBlID09PSAnc2VsZWN0aW9uLWRpdmVyZ2VuY2UnIHx8IGxpbmsudHlwZSA9PT0gJ3NlbGVjdGlvbi1jb252ZXJnZW5jZScpIHtcbiAgICAgIC8vIEV4dHJhY3QgdGhlIGRpdmVyZ2VuY2UvY29udmVyZ2VuY2Ugbm9kZSBpZCBmcm9tIGxpbmsgZnJvbS90b1xuICAgICAgY29uc3QgZGl2TWF0Y2ggPSBsaW5rLmZyb20ubWF0Y2goL15zZmMtKHNpbURpdnxzaW1Db252fHNlbERpdnxzZWxDb252KS0oLispJC8pO1xuICAgICAgY29uc3QgY29udk1hdGNoID0gbGluay50by5tYXRjaCgvXnNmYy0oc2ltRGl2fHNpbUNvbnZ8c2VsRGl2fHNlbENvbnYpLSguKykkLyk7XG4gICAgICBjb25zdCBub2RlSWQgPSBkaXZNYXRjaCA/IGxpbmsuZnJvbSA6IGNvbnZNYXRjaCA/IGxpbmsudG8gOiBudWxsO1xuICAgICAgaWYgKG5vZGVJZCAmJiAhZGl2SWRzLmhhcyhub2RlSWQpKSB7XG4gICAgICAgIGRpdklkcy5hZGQobm9kZUlkKTtcbiAgICAgICAgY29uc3Qgc291cmNlcyA9IGluTGlua3MuZ2V0KG5vZGVJZCkgfHwgW107XG4gICAgICAgIGNvbnN0IHRhcmdldHMgPSBvdXRMaW5rcy5nZXQobm9kZUlkKSB8fCBbXTtcbiAgICAgICAgY29uc3QgaXNDb252ZXJnZW5jZSA9IG5vZGVJZC5pbmNsdWRlcygnQ29udicpO1xuICAgICAgICBjb25zdCBlbDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgICAgICAgJ0BfbG9jYWxJZCc6IGxpZChub2RlSWQpLFxuICAgICAgICAgIC8vIENvbnZlcmdlbmNlOiBvbmUgY29ubmVjdGlvblBvaW50SW4gcGVyIHNvdXJjZTsgZGl2ZXJnZW5jZTogc2luZ2xlIGNvbm5lY3Rpb25Qb2ludEluIHdpdGggYWxsIHNvdXJjZXNcbiAgICAgICAgICAuLi4oc291cmNlcy5sZW5ndGggPiAwXG4gICAgICAgICAgICA/IGlzQ29udmVyZ2VuY2VcbiAgICAgICAgICAgICAgPyB7IGNvbm5lY3Rpb25Qb2ludEluOiBzb3VyY2VzLm1hcChzID0+ICh7IGNvbm5lY3Rpb246IHsgJ0BfcmVmTG9jYWxJZCc6IGxpZChzKSB9IH0pKSB9XG4gICAgICAgICAgICAgIDogeyBjb25uZWN0aW9uUG9pbnRJbjogeyBjb25uZWN0aW9uOiBzb3VyY2VzLm1hcChzID0+ICh7ICdAX3JlZkxvY2FsSWQnOiBsaWQocykgfSkpIH0gfVxuICAgICAgICAgICAgOiB7fSksXG4gICAgICAgICAgLi4uKHRhcmdldHMubGVuZ3RoID4gMCA/IHsgY29ubmVjdGlvblBvaW50T3V0OiB0YXJnZXRzLm1hcCgodCwgaSkgPT4gKHsgJ0BfZm9ybWFsUGFyYW1ldGVyJzogU3RyaW5nKGkpLCBjb25uZWN0aW9uOiB7ICdAX3JlZkxvY2FsSWQnOiBsaWQodCkgfSB9KSkgfSA6IHt9KSxcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKGxpbmsudHlwZSA9PT0gJ3NpbXVsdGFuZW91cy1kaXZlcmdlbmNlJykgc2ltdWx0YW5lb3VzRGl2ZXJnZW5jZXMucHVzaChlbCk7XG4gICAgICAgIGVsc2UgaWYgKGxpbmsudHlwZSA9PT0gJ3NpbXVsdGFuZW91cy1jb252ZXJnZW5jZScpIHNpbXVsdGFuZW91c0NvbnZlcmdlbmNlcy5wdXNoKGVsKTtcbiAgICAgICAgZWxzZSBpZiAobGluay50eXBlID09PSAnc2VsZWN0aW9uLWRpdmVyZ2VuY2UnKSBzZWxlY3Rpb25EaXZlcmdlbmNlcy5wdXNoKGVsKTtcbiAgICAgICAgZWxzZSBpZiAobGluay50eXBlID09PSAnc2VsZWN0aW9uLWNvbnZlcmdlbmNlJykgc2VsZWN0aW9uQ29udmVyZ2VuY2VzLnB1c2goZWwpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEJ1aWxkIGp1bXAgZWxlbWVudHNcbiAgY29uc3QganVtcFN0ZXBzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdID0gW107XG4gIGZvciAoY29uc3QganVtcCBvZiAoc2ZjLmp1bXBzID8/IFtdKSkge1xuICAgIGp1bXBTdGVwcy5wdXNoKHtcbiAgICAgICdAX2xvY2FsSWQnOiBTdHJpbmcobG9jYWxJZENvdW50ZXIrKyksXG4gICAgICAnQF90YXJnZXROYW1lJzoganVtcC50YXJnZXRTdGVwTmFtZSxcbiAgICAgIHBvc2l0aW9uOiB7ICdAX3gnOiBqdW1wLnBvc2l0aW9uPy54IHx8IDAsICdAX3knOiBqdW1wLnBvc2l0aW9uPy55IHx8IDAgfSxcbiAgICAgIGNvbm5lY3Rpb25Qb2ludEluOiB7fSxcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IHJlc3VsdDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgc3RlcDogc3RlcHMubGVuZ3RoID8gc3RlcHMgOiB1bmRlZmluZWQsXG4gICAgdHJhbnNpdGlvbjogdHJhbnNpdGlvbnMubGVuZ3RoID8gdHJhbnNpdGlvbnMgOiB1bmRlZmluZWQsXG4gIH07XG4gIGlmIChzaW11bHRhbmVvdXNEaXZlcmdlbmNlcy5sZW5ndGgpIHJlc3VsdC5zaW11bHRhbmVvdXNEaXZlcmdlbmNlID0gc2ltdWx0YW5lb3VzRGl2ZXJnZW5jZXM7XG4gIGlmIChzaW11bHRhbmVvdXNDb252ZXJnZW5jZXMubGVuZ3RoKSByZXN1bHQuc2ltdWx0YW5lb3VzQ29udmVyZ2VuY2UgPSBzaW11bHRhbmVvdXNDb252ZXJnZW5jZXM7XG4gIGlmIChzZWxlY3Rpb25EaXZlcmdlbmNlcy5sZW5ndGgpIHJlc3VsdC5zZWxlY3Rpb25EaXZlcmdlbmNlID0gc2VsZWN0aW9uRGl2ZXJnZW5jZXM7XG4gIGlmIChzZWxlY3Rpb25Db252ZXJnZW5jZXMubGVuZ3RoKSByZXN1bHQuc2VsZWN0aW9uQ29udmVyZ2VuY2UgPSBzZWxlY3Rpb25Db252ZXJnZW5jZXM7XG4gIGlmIChqdW1wU3RlcHMubGVuZ3RoKSByZXN1bHQuanVtcFN0ZXAgPSBqdW1wU3RlcHM7XG5cbiAgLy8gRW1pdCBhY3Rpb25CbG9ja3MgYXMgc2libGluZ3Mgb2Ygc3RlcHMgKEJ1ZyA5KVxuICBjb25zdCBhY3Rpb25CbG9ja3M6IFJlY29yZDxzdHJpbmcsIHVua25vd24+W10gPSBbXTtcbiAgZm9yIChjb25zdCBzIG9mIHNmYy5zdGVwcykge1xuICAgIGlmIChzLmFjdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgYWN0aW9uQmxvY2tzLnB1c2goe1xuICAgICAgICAnQF9sb2NhbElkJzogU3RyaW5nKGxvY2FsSWRDb3VudGVyKyspLFxuICAgICAgICBjb25uZWN0aW9uUG9pbnRJbjogeyBjb25uZWN0aW9uOiB7ICdAX3JlZkxvY2FsSWQnOiBsaWQocy5pZCkgfSB9LFxuICAgICAgICBhY3Rpb246IHMuYWN0aW9ucy5tYXAoYSA9PiAoe1xuICAgICAgICAgICdAX3F1YWxpZmllcic6IGEucXVhbGlmaWVyLFxuICAgICAgICAgICdAX2R1cmF0aW9uJzogYS5kdXJhdGlvbiB8fCB1bmRlZmluZWQsXG4gICAgICAgICAgcmVmZXJlbmNlOiB7ICdAX25hbWUnOiBhLnRhZy5uYW1lIH0sXG4gICAgICAgIH0pKSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBpZiAoYWN0aW9uQmxvY2tzLmxlbmd0aCkgcmVzdWx0LmFjdGlvbkJsb2NrID0gYWN0aW9uQmxvY2tzO1xuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHRhZ1RvVmFyWG1sKHRhZzogTm9ybWFsaXplZFRhZyk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICAnQF9uYW1lJzogdGFnLm5hbWUsXG4gICAgJ0BfYWRkcmVzcyc6IHRhZy5hZGRyZXNzIHx8IHVuZGVmaW5lZCxcbiAgICB0eXBlOiB7IFt0YWcuZGF0YVR5cGVdOiB7fSB9LFxuICAgIGluaXRpYWxWYWx1ZTogdGFnLmluaXRpYWxWYWx1ZSA/IHsgc2ltcGxlVmFsdWU6IHsgJ0BfdmFsdWUnOiB0YWcuaW5pdGlhbFZhbHVlIH0gfSA6IHVuZGVmaW5lZCxcbiAgICBkb2N1bWVudGF0aW9uOiB0YWcuZGVzY3JpcHRpb24gfHwgdW5kZWZpbmVkLFxuICB9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBUUEsU0FBUyxVQUFVLFVBQVUsTUFBTSxNQUFNLE9BQU8sa0JBQWtCO0FBQ2xFLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsZUFBZSw0QkFBNEI7QUFDcEQsU0FBUyxnQkFBZ0IsZ0JBQWdCLDRCQUE0QjtBQUVyRSxTQUFTLFlBQVksR0FBbUI7QUFDdEMsU0FBTyxFQUFFLFFBQVEsVUFBVSxHQUFHLEVBQUUsUUFBUSxTQUFTLEdBQUcsRUFBRSxRQUFRLFNBQVMsR0FBRyxFQUFFLFFBQVEsV0FBVyxHQUFHLEVBQUUsUUFBUSxXQUFXLEdBQUc7QUFDNUg7QUFlTyxTQUFTLGNBQWMsWUFBb0IsVUFBZ0M7QUFDaEYsUUFBTSxTQUFtQixDQUFDO0FBQzFCLFFBQU0sV0FBcUIsQ0FBQztBQUM1QixRQUFNLFdBQThCLENBQUM7QUFFckMsTUFBSTtBQUNKLE1BQUk7QUFDRixXQUFPLFNBQVMsVUFBVTtBQUFBLEVBQzVCLFNBQVMsR0FBRztBQUNWLFdBQU8sRUFBRSxJQUFJLE9BQU8sUUFBUSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsR0FBRyxVQUFVLENBQUMsRUFBRTtBQUFBLEVBQ3RFO0FBRUEsUUFB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
