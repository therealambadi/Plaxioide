import { parseXML, buildXML, attr, text, child, childArray } from "../xmlUtils.js";
import { schneiderTypeToIEC } from "../dataTypeMap.js";
import { buildResolver, VariableTypeResolver } from "../variableTypeResolver.js";
import { getPinDataType, buildTypedPins, buildTypedTagRefPins } from "../pinSignatures.js";
let _uid = 0;
function uid(prefix) {
  return `${prefix}-${++_uid}-${Math.random().toString(36).slice(2, 8)}`;
}
function unescapeXML(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
async function decompressZEF(data) {
  const bytes = new Uint8Array(data);
  if (!(bytes[0] === 80 && bytes[1] === 75)) {
    return new TextDecoder().decode(data);
  }
  let pos = 0;
  let bestXmlEntry = null;
  while (pos + 30 <= bytes.length) {
    const sig = bytes[pos] | bytes[pos + 1] << 8 | bytes[pos + 2] << 16 | bytes[pos + 3] << 24;
    if (sig !== 67324752) break;
    const method = bytes[pos + 8] | bytes[pos + 9] << 8;
    const compSize = bytes[pos + 18] | bytes[pos + 19] << 8 | bytes[pos + 20] << 16 | bytes[pos + 21] << 24;
    const uncompSize = bytes[pos + 22] | bytes[pos + 23] << 8 | bytes[pos + 24] << 16 | bytes[pos + 25] << 24;
    const fnLen = bytes[pos + 26] | bytes[pos + 27] << 8;
    const extraLen = bytes[pos + 28] | bytes[pos + 29] << 8;
    const fnBytes = bytes.slice(pos + 30, pos + 30 + fnLen);
    const fileName = new TextDecoder().decode(fnBytes).toLowerCase();
    const dataStart = pos + 30 + fnLen + extraLen;
    if ((fileName.endsWith(".xef") || fileName.endsWith(".xml")) && !fileName.includes("fdtdtm") && compSize > 0) {
      bestXmlEntry = { start: dataStart, compSize, uncompSize, method, name: fileName };
      break;
    }
    pos = dataStart + (compSize > 0 ? compSize : uncompSize);
  }
  if (!bestXmlEntry) {
    const fnLen = bytes[26] | bytes[27] << 8;
    const extraLen = bytes[28] | bytes[29] << 8;
    bestXmlEntry = {
      start: 30 + fnLen + extraLen,
      compSize: bytes[18] | bytes[19] << 8 | bytes[20] << 16 | bytes[21] << 24,
      uncompSize: bytes[22] | bytes[23] << 8 | bytes[24] << 16 | bytes[25] << 24,
      method: bytes[8] | bytes[9] << 8,
      name: "fallback"
    };
  }
  if (bestXmlEntry.method === 0) {
    return new TextDecoder().decode(bytes.slice(bestXmlEntry.start, bestXmlEntry.start + bestXmlEntry.uncompSize));
  }
  try {
    const ds = new DecompressionStream("deflate-raw");
    const compressedData = bytes.slice(bestXmlEntry.start, bestXmlEntry.start + bestXmlEntry.compSize);
    const blob = new Blob([compressedData]);
    const stream = blob.stream().pipeThrough(ds);
    const reader = stream.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder().decode(result);
  } catch {
    try {
      const ds = new DecompressionStream("deflate");
      const blob = new Blob([bytes.slice(bestXmlEntry.start, bestXmlEntry.start + bestXmlEntry.compSize)]);
      const stream = blob.stream().pipeThrough(ds);
      const reader = stream.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLen = chunks.reduce((s, c) => s + c.length, 0);
      const result = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return new TextDecoder().decode(result);
    } catch {
      throw new Error(`Failed to decompress ZEF file entry "${bestXmlEntry.name}"`);
    }
  }
}
function importSchneider(xmlContent, filePath) {
  _uid = 0;
  const errors = [];
  const warnings = [];
  const unmapped = [];
  let root;
  try {
    root = parseXML(xmlContent);
  } catch (e) {
    return { ok: false, errors: [`XML parse error: ${e}`], warnings: [] };
  }
  const fefRoot = child(root, "FEFExchangeFile") ?? child(root, "ProjectFile") ?? child(root, "project");
  if (!fefRoot) {
    return { ok: false, errors: ["No <FEFExchangeFile> or <ProjectFile> root found in XEF file"], warnings: [] };
  }
  const projectFile = fefRoot;
  const projectName = attr(projectFile, "Name") || attr(projectFile, "name") || "Schneider Import";
  const version = attr(projectFile, "Version") || "1.0";
  const globalTags = [];
  const pous = [];
  const dataBlock = child(fefRoot, "dataBlock");
  if (dataBlock) {
    for (const varEl of childArray(dataBlock, "variables")) {
      const tag = parseXEFVariable(varEl, unmapped);
      if (tag) globalTags.push(tag);
    }
  } else {
    const dataEl = child(projectFile, "Data") ?? projectFile;
    const globalSection = child(dataEl, "GlobalSection") ?? child(projectFile, "Global");
    if (globalSection) {
      for (const varEl of childArray(globalSection, "Variable").concat(childArray(globalSection, "Var")).concat(childArray(globalSection, "variables"))) {
        const tag = parseXEFVariable(varEl, unmapped);
        if (tag) globalTags.push(tag);
      }
    }
  }
  for (const fbSrc of childArray(fefRoot, "FBSource")) {
    const fbTypeName = attr(fbSrc, "nameOfFBType") || "FB";
    const localTags = [];
    for (const v of childArray(child(fbSrc, "inputParameters"), "variables")) {
      const tag = parseXEFVariable(v, unmapped);
      if (tag) {
        tag._paramDir = "input";
        localTags.push(tag);
      }
    }
    for (const v of childArray(child(fbSrc, "outputParameters"), "variables")) {
      const tag = parseXEFVariable(v, unmapped);
      if (tag) {
        tag._paramDir = "output";
        localTags.push(tag);
      }
    }
    for (const v of childArray(child(fbSrc, "inOutParameters"), "variables")) {
      const tag = parseXEFVariable(v, unmapped);
      if (tag) {
        tag._paramDir = "inout";
        localTags.push(tag);
      }
    }
    for (const v of childArray(child(fbSrc, "publicLocalVariables"), "variables")) {
      const tag = parseXEFVariable(v, unmapped);
      if (tag) localTags.push(tag);
    }
    for (const v of childArray(child(fbSrc, "privateLocalVariables"), "variables")) {
      const tag = parseXEFVariable(v, unmapped);
      if (tag) localTags.push(tag);
    }
    const fbProgEl = child(fbSrc, "FBProgram");
    if (fbProgEl) {
      const fbdSourceEl = child(fbProgEl, "FBDSource");
      if (fbdSourceEl) {
        const resolver = buildResolver(localTags, []);
        const bodyEl = child(fbdSourceEl, "networkFBD") ?? fbdSourceEl;
        const fbd = parseXEFFBD(bodyEl, fbTypeName, unmapped, resolver);
        const nbRows = attr(fbdSourceEl, "nbRows");
        const nbColumns = attr(fbdSourceEl, "nbColumns");
        if (nbRows || nbColumns) fbd._xefGrid = { nbRows, nbColumns };
        pous.push({ id: `pou-${fbTypeName}`, name: fbTypeName, language: "FBD", fbdProgram: fbd, localTags, pouType: "functionBlock" });
      } else {
        const stSrc = text(child(fbProgEl, "STSource") ?? fbProgEl);
        pous.push({ id: `pou-${fbTypeName}`, name: fbTypeName, language: "ST", stSource: stSrc ? unescapeXML(stSrc) : "", localTags, pouType: "functionBlock" });
      }
    }
  }
  const directPrograms = childArray(fefRoot, "program");
  if (directPrograms.length > 0) {
    for (const programEl of directPrograms) {
      const pou = parseXEFProgramFEF(programEl, unmapped, warnings);
      if (pou) pous.push(pou);
    }
  } else {
    const dataEl = child(projectFile, "Data") ?? projectFile;
    const programsEl = child(dataEl, "Programs") ?? child(projectFile, "Programs");
    for (const programEl of childArray(programsEl, "Program").concat(childArray(programsEl, "POU"))) {
      const pou = parseXEFProgram(programEl, unmapped, warnings);
      if (pou) pous.push(pou);
    }
  }
  const _dataElForSections = child(projectFile, "Data") ?? projectFile;
  for (const section of childArray(_dataElForSections, "Section").concat(childArray(projectFile, "Section"))) {
    const sectionType = attr(section, "Type") || attr(section, "language") || "";
    const sectionName = attr(section, "Name") || attr(section, "name") || "Section";
    if (sectionType.toUpperCase() === "LD" || sectionType.toUpperCase() === "LADDER") {
      const ladder = parseXEFLadder(section, sectionName, unmapped);
      pous.push({ id: `pou-${sectionName}`, name: sectionName, language: "LD", ladderProgram: ladder, localTags: [] });
    } else if (sectionType.toUpperCase() === "FBD") {
      const fbd = parseXEFFBD(section, sectionName, unmapped);
      pous.push({ id: `pou-${sectionName}`, name: sectionName, language: "FBD", fbdProgram: fbd, localTags: [] });
    } else if (sectionType.toUpperCase() === "SFC") {
      const sfc = parseXEFSFC(section, sectionName, unmapped);
      pous.push({ id: `pou-${sectionName}`, name: sectionName, language: "SFC", sfcProgram: sfc, localTags: [] });
    } else if (sectionType.toUpperCase() === "ST" || sectionType.toUpperCase() === "IL") {
      const rawStSrc = text(child(section, "Body") ?? section);
      const stSrc = rawStSrc ? unescapeXML(rawStSrc) : rawStSrc;
      if (sectionType.toUpperCase() === "IL") {
        warnings.push(`Section "${sectionName}" uses IL \u2014 importing as ST text (review required)`);
      }
      pous.push({ id: `pou-${sectionName}`, name: sectionName, language: "ST", stSource: stSrc, localTags: [] });
    } else if (sectionType) {
      unmapped.push({ clmNodeId: null, vendorSpecificData: section, reason: `Unknown section type: ${sectionType}` });
    }
  }
  if (pous.length === 0 && globalTags.length === 0) {
    errors.push("No programs, POUs, or tags found in XEF file");
    return { ok: false, errors, warnings };
  }
  const sidecar = {
    sourceVendor: "schneider_xef",
    sourceFileVersion: version,
    originalFilePath: filePath,
    unmappedElements: unmapped,
    organizerTreeLayout: fefRoot,
    vendorSpecificGlobals: { version, projectName: attr(projectFile, "Name") }
  };
  return { ok: true, project: { projectName, pous, globalTags, sidecar }, errors, warnings };
}
function parseXEFVariable(varEl, unmapped) {
  if (!varEl || typeof varEl !== "object") return null;
  const name = attr(varEl, "name") || attr(varEl, "Name");
  if (!name) return null;
  const typeStr = attr(varEl, "typeName") || attr(varEl, "Type") || attr(varEl, "type") || "BOOL";
  const dataType = schneiderTypeToIEC(typeStr);
  const address = attr(varEl, "topologicalAddress") || attr(varEl, "Address") || attr(varEl, "Topological") || void 0;
  const initVal = attr(child(varEl, "variableInit"), "value") || attr(varEl, "InitialValue") || text(child(varEl, "InitialValue")) || void 0;
  const desc = text(child(varEl, "comment") ?? child(varEl, "Comment") ?? child(varEl, "Description")) || void 0;
  const attributes = [];
  for (const attrEl of childArray(varEl, "attribute")) {
    const attrName = attr(attrEl, "name");
    const attrValue = attr(attrEl, "value");
    if (attrName) attributes.push({ name: attrName, value: attrValue || "" });
  }
  if (typeStr.toUpperCase() === "EBOOL") {
    unmapped.push({ clmNodeId: name, vendorSpecificData: { originalType: "EBOOL" }, reason: "EBOOL mapped to BOOL (edge bit semantics lost)" });
  }
  const tag = { name, dataType, initialValue: initVal, description: desc, address };
  if (attributes.length > 0 || typeStr.toUpperCase() === "EBOOL") {
    tag._xefMeta = { originalType: typeStr, attributes };
  }
  return tag;
}
function parseXEFProgram(programEl, unmapped, warnings) {
  if (!programEl || typeof programEl !== "object") return null;
  const name = attr(programEl, "Name") || attr(programEl, "name") || "Program";
  const language = (attr(programEl, "Language") || attr(programEl, "language") || "LD").toUpperCase();
  const localTags = [];
  const varsEl = child(programEl, "Variables") ?? child(programEl, "LocalVars");
  for (const v of childArray(varsEl, "Variable").concat(childArray(varsEl, "Var"))) {
    const tag = parseXEFVariable(v, unmapped);
    if (tag) localTags.push(tag);
  }
  const bodyEl = child(programEl, "Body") ?? programEl;
  const resolver = buildResolver(localTags, []);
  if (language === "LD" || language === "LADDER") {
    const ladder = parseXEFLadder(bodyEl, name, unmapped, resolver);
    return { id: `pou-${name}`, name, language: "LD", ladderProgram: ladder, localTags, pouType: "program" };
  }
  if (language === "FBD") {
    const fbd = parseXEFFBD(bodyEl, name, unmapped, resolver);
    return { id: `pou-${name}`, name, language: "FBD", fbdProgram: fbd, localTags, pouType: "program" };
  }
  if (language === "SFC") {
    const sfc = parseXEFSFC(bodyEl, name, unmapped);
    return { id: `pou-${name}`, name, language: "SFC", sfcProgram: sfc, localTags, pouType: "program" };
  }
  if (language === "ST") {
    const rawSrc = text(bodyEl);
    const src = rawSrc ? unescapeXML(rawSrc) : rawSrc;
    return { id: `pou-${name}`, name, language: "ST", stSource: src, localTags, pouType: "program" };
  }
  if (language === "IL") {
    warnings.push(`Program "${name}": IL language \u2014 importing as ST comment`);
    return { id: `pou-${name}`, name, language: "ST", stSource: `(* IL: ${text(bodyEl)} *)`, localTags, pouType: "program" };
  }
  unmapped.push({ clmNodeId: null, vendorSpecificData: programEl, reason: `Program "${name}": unknown language ${language}` });
  return null;
}
function parseXEFProgramFEF(programEl, unmapped, warnings) {
  if (!programEl || typeof programEl !== "object") return null;
  const identEl = child(programEl, "identProgram");
  const name = attr(identEl, "name") || attr(programEl, "Name") || attr(programEl, "name") || "Program";
  const task = attr(identEl, "task") || "MAST";
  const sectionType = attr(identEl, "type") || "section";
  const language = child(programEl, "FBDSource") ? "FBD" : child(programEl, "LDSource") ? "LD" : child(programEl, "SFCSource") ? "SFC" : child(programEl, "STSource") ? "ST" : "ST";
  const localTags = [];
  const publicVars = child(programEl, "publicLocalVariables");
  const privateVars = child(programEl, "privateLocalVariables");
  const localVarEls = [
    ...publicVars ? childArray(publicVars, "variables") : [],
    ...privateVars ? childArray(privateVars, "variables") : []
  ];
  for (const v of localVarEls) {
    const tag = parseXEFVariable(v, unmapped);
    if (tag) localTags.push(tag);
  }
  const resolver = buildResolver(localTags, []);
  if (language === "FBD") {
    const fbdSourceEl = child(programEl, "FBDSource");
    const bodyEl = child(fbdSourceEl, "networkFBD") ?? fbdSourceEl;
    const fbd = parseXEFFBD(bodyEl, name, unmapped, resolver);
    const nbRows = attr(fbdSourceEl, "nbRows");
    const nbColumns = attr(fbdSourceEl, "nbColumns");
    if (nbRows || nbColumns) {
      fbd._xefGrid = { nbRows, nbColumns };
    }
    const pou = { id: `pou-${name}`, name, language: "FBD", fbdProgram: fbd, localTags, pouType: "program" };
    pou._xefMeta = { task, sectionType };
    return pou;
  }
  if (language === "LD") {
    const ldSourceEl = child(programEl, "LDSource");
    const ladder = parseXEFLadder(ldSourceEl ?? programEl, name, unmapped, resolver);
    const pou = { id: `pou-${name}`, name, language: "LD", ladderProgram: ladder, localTags, pouType: "program" };
    pou._xefMeta = { task, sectionType };
    return pou;
  }
  if (language === "SFC") {
    const sfcSourceEl = child(programEl, "SFCSource");
    const sfc = parseXEFSFC(sfcSourceEl ?? programEl, name, unmapped);
    const pou = { id: `pou-${name}`, name, language: "SFC", sfcProgram: sfc, localTags, pouType: "program" };
    pou._xefMeta = { task, sectionType };
    return pou;
  }
  if (language === "ST") {
    const stSourceEl = child(programEl, "STSource");
    const rawSrc = text(stSourceEl ?? programEl);
    const src = rawSrc ? unescapeXML(rawSrc) : rawSrc;
    const pou = { id: `pou-${name}`, name, language: "ST", stSource: src, localTags, pouType: "program" };
    pou._xefMeta = { task, sectionType };
    return pou;
  }
  warnings.push(`Program "${name}": unrecognised language "${language}" \u2014 skipped`);
  return null;
}
function parseXEFLadder(bodyEl, pouName, unmapped, resolver = new VariableTypeResolver()) {
  const rungs = [];
  let rungIdx = 0;
  for (const rungEl of childArray(bodyEl, "Rung").concat(childArray(bodyEl, "Network"))) {
    rungIdx++;
    const comment = text(child(rungEl, "Comment")) || "";
    const elements = [];
    let posX = 0;
    for (const ctEl of childArray(rungEl, "Contact").concat(childArray(rungEl, "CT"))) {
      const tagName = attr(ctEl, "Variable") || attr(ctEl, "name") || `TAG_${posX}`;
      const ctType = (attr(ctEl, "Type") || attr(ctEl, "type") || "").toUpperCase();
      const negated = attr(ctEl, "Negated") === "true" || ctType === "NC";
      let contactType = negated ? "NC" : "NO";
      if (ctType === "P" || ctType === "RE" || ctType === "RISING") contactType = "P_CONTACT";
      if (ctType === "N" || ctType === "FE" || ctType === "FALLING") contactType = "N_CONTACT";
      elements.push({
        kind: "contact",
        id: uid(`xef-ct-${rungIdx}`),
        type: contactType,
        tag: { name: tagName, dataType: resolver.resolve(tagName) },
        position: { x: posX, y: 0 }
      });
      posX += 60;
    }
    for (const coilEl of childArray(rungEl, "Coil").concat(childArray(rungEl, "CL"))) {
      const tagName = attr(coilEl, "Variable") || attr(coilEl, "name") || `COIL_${posX}`;
      const coilType = (attr(coilEl, "Type") || attr(coilEl, "type") || "").toUpperCase();
      let type = "normal";
      if (coilType === "SET" || coilType === "S") type = "set";
      if (coilType === "RESET" || coilType === "R") type = "reset";
      if (coilType === "NEGATED" || coilType === "/") type = "negated";
      if (coilType === "LATCH" || coilType === "L") type = "latch";
      if (coilType === "UNLATCH" || coilType === "U") type = "unlatch";
      elements.push({
        kind: "coil",
        id: uid(`xef-coil-${rungIdx}`),
        type,
        tag: { name: tagName, dataType: resolver.resolve(tagName) },
        position: { x: posX, y: 0 }
      });
      posX += 60;
    }
    for (const fbEl of childArray(rungEl, "FunctionBlock").concat(childArray(rungEl, "Operator"))) {
      const typeName = attr(fbEl, "Type") || attr(fbEl, "typeName") || "";
      const instanceName = attr(fbEl, "Instance") || attr(fbEl, "name") || typeName;
      const xefFBMap = {
        TON: "TON",
        TOF: "TOF",
        TP: "TP",
        CTU: "CTU",
        CTD: "CTD",
        CTUD: "CTUD",
        SR: "SR",
        RS: "RS",
        R_TRIG: "RTRIG",
        F_TRIG: "FTRIG"
      };
      const fbType = xefFBMap[typeName.toUpperCase()] || typeName;
      const rawPins = {};
      for (const pinEl of childArray(fbEl, "InputPin").concat(childArray(fbEl, "Pin"))) {
        const pinName = attr(pinEl, "Name") || attr(pinEl, "name") || `IN${Object.keys(rawPins).length}`;
        rawPins[pinName] = attr(pinEl, "Variable") || attr(pinEl, "value") || pinName;
      }
      for (const pinEl of childArray(fbEl, "OutputPin")) {
        const pinName = attr(pinEl, "Name") || attr(pinEl, "name") || `OUT${Object.keys(rawPins).length}`;
        rawPins[pinName] = attr(pinEl, "Variable") || attr(pinEl, "value") || pinName;
      }
      const typedPins = buildTypedTagRefPins(fbType, rawPins);
      const pins = {};
      for (const [pinName, pinDef] of Object.entries(typedPins)) {
        const varName = pinDef.name;
        const resolvedType = varName ? resolver.resolve(varName) : null;
        pins[pinName] = { name: varName, dataType: resolvedType && resolvedType !== "BOOL" ? resolvedType : pinDef.dataType };
      }
      elements.push({
        kind: "block",
        id: uid(`xef-fb-${rungIdx}`),
        fbType,
        instanceName,
        pins,
        position: { x: posX, y: 0 }
      });
      posX += 60;
    }
    const branches = [];
    for (const branchEl of childArray(rungEl, "Branch").concat(childArray(rungEl, "Parallel"))) {
      const branchElements = [];
      let bPosX = 0;
      for (const ctEl of childArray(branchEl, "Contact").concat(childArray(branchEl, "CT"))) {
        const tagName = attr(ctEl, "Variable") || attr(ctEl, "name") || `TAG_${bPosX}`;
        const ctType = (attr(ctEl, "Type") || attr(ctEl, "type") || "").toUpperCase();
        const negated = attr(ctEl, "Negated") === "true" || ctType === "NC";
        let contactType = negated ? "NC" : "NO";
        if (ctType === "P" || ctType === "RE" || ctType === "RISING") contactType = "P_CONTACT";
        if (ctType === "N" || ctType === "FE" || ctType === "FALLING") contactType = "N_CONTACT";
        branchElements.push({
          kind: "contact",
          id: uid(`xef-br-ct-${rungIdx}`),
          type: contactType,
          tag: { name: tagName, dataType: resolver.resolve(tagName) },
          position: { x: bPosX, y: 0 }
        });
        bPosX += 60;
      }
      for (const fbEl of childArray(branchEl, "FunctionBlock").concat(childArray(branchEl, "Operator"))) {
        const typeName = attr(fbEl, "Type") || attr(fbEl, "typeName") || "";
        const instanceName = attr(fbEl, "Instance") || attr(fbEl, "name") || typeName;
        const xefFBMap = {
          TON: "TON",
          TOF: "TOF",
          TP: "TP",
          CTU: "CTU",
          CTD: "CTD",
          CTUD: "CTUD",
          SR: "SR",
          RS: "RS",
          R_TRIG: "RTRIG",
          F_TRIG: "FTRIG"
        };
        const fbType = xefFBMap[typeName.toUpperCase()] || typeName;
        const brRawPins = {};
        for (const pinEl of childArray(fbEl, "InputPin").concat(childArray(fbEl, "Pin"))) {
          const pinName = attr(pinEl, "Name") || attr(pinEl, "name") || `IN${Object.keys(brRawPins).length}`;
          brRawPins[pinName] = attr(pinEl, "Variable") || attr(pinEl, "value") || pinName;
        }
        const brTypedPins = buildTypedTagRefPins(fbType, brRawPins);
        const brPins = {};
        for (const [pn, pd] of Object.entries(brTypedPins)) {
          const vn = pd.name;
          const rt = vn ? resolver.resolve(vn) : null;
          brPins[pn] = { name: vn, dataType: rt && rt !== "BOOL" ? rt : pd.dataType };
        }
        branchElements.push({
          kind: "block",
          id: uid(`xef-br-fb-${rungIdx}`),
          fbType,
          instanceName,
          pins: brPins,
          position: { x: bPosX, y: 0 }
        });
        bPosX += 60;
      }
      for (const coilEl of childArray(branchEl, "Coil").concat(childArray(branchEl, "CL"))) {
        const tagName = attr(coilEl, "Variable") || attr(coilEl, "name") || `COIL_${bPosX}`;
        const coilType = (attr(coilEl, "Type") || attr(coilEl, "type") || "").toUpperCase();
        let type = "normal";
        if (coilType === "SET" || coilType === "S") type = "set";
        if (coilType === "RESET" || coilType === "R") type = "reset";
        if (coilType === "NEGATED" || coilType === "/") type = "negated";
        if (coilType === "LATCH" || coilType === "L") type = "latch";
        if (coilType === "UNLATCH" || coilType === "U") type = "unlatch";
        branchElements.push({
          kind: "coil",
          id: uid(`xef-br-coil-${rungIdx}`),
          type,
          tag: { name: tagName, dataType: resolver.resolve(tagName) },
          position: { x: bPosX, y: 0 }
        });
        bPosX += 60;
      }
      if (branchElements.length > 0) {
        branches.push({
          id: uid(`xef-branch-${rungIdx}`),
          startNodeId: elements[0]?.id || "",
          endNodeId: branchElements[branchElements.length - 1].id,
          elements: branchElements
        });
      }
    }
    rungs.push({ id: `${pouName}-rung-${rungIdx}`, number: rungIdx, comment, elements, branches });
  }
  return { rungs };
}
function parseXEFFBD(bodyEl, pouName, unmapped, resolver = new VariableTypeResolver()) {
  const nodes = [];
  const wires = [];
  let idx = 0;
  const instanceNameToNodeId = /* @__PURE__ */ new Map();
  const allBlockEls = childArray(bodyEl, "FFBBlock").concat(childArray(bodyEl, "FBDObject")).concat(childArray(bodyEl, "Block"));
  for (const blockEl of allBlockEls) {
    const typeName = attr(blockEl, "typeName") || attr(blockEl, "Type") || attr(blockEl, "type") || "BLOCK";
    const instanceName = attr(blockEl, "instanceName") || attr(blockEl, "Instance") || attr(blockEl, "name") || typeName;
    const id = instanceName || attr(blockEl, "Id") || String(idx++);
    const nodeId = `xef-fbd-${id}-${idx++}`;
    if (instanceName) instanceNameToNodeId.set(instanceName, nodeId);
    const posEl = child(blockEl, "objPosition") ?? child(blockEl, "Position");
    const x = Number(attr(posEl, "posX") || attr(posEl, "X") || attr(blockEl, "X") || attr(blockEl, "x")) || idx * 120;
    const y = Number(attr(posEl, "posY") || attr(posEl, "Y") || attr(blockEl, "Y") || attr(blockEl, "y")) || 0;
    const additionnalPinNumber = attr(blockEl, "additionnalPinNumber") || attr(blockEl, "additionalPinNumber");
    const enEnO = attr(blockEl, "enEnO");
    const blockWidth = attr(blockEl, "width");
    const blockHeight = attr(blockEl, "height");
    const { inputs: sigInputs, outputs: sigOutputs } = buildTypedPins(typeName, [], nodeId);
    const inputsByName = new Map(sigInputs.map((p) => [p.name, { ...p }]));
    const outputsByName = new Map(sigOutputs.map((p) => [p.name, { ...p }]));
    const descFFB = child(blockEl, "descriptionFFB");
    const execAfter = attr(descFFB, "execAfter") || void 0;
    const inputPinEls = descFFB ? childArray(descFFB, "inputVariable") : [];
    const outputPinEls = descFFB ? childArray(descFFB, "outputVariable") : [];
    for (const pinEl of inputPinEls.concat(childArray(blockEl, "InputPin")).concat(childArray(blockEl, "Input"))) {
      const pinName = attr(pinEl, "formalParameter") || attr(pinEl, "Name") || attr(pinEl, "name") || `IN${inputsByName.size}`;
      const negated = attr(pinEl, "Negated") === "true" || attr(pinEl, "invertedPin") === "true";
      const effectiveParameter = attr(pinEl, "effectiveParameter") || void 0;
      const canonicalType = getPinDataType(typeName, pinName, "input");
      const pin = { id: uid("pin"), name: pinName, dataType: canonicalType, negated };
      if (effectiveParameter) pin.value = effectiveParameter;
      inputsByName.set(pinName, pin);
    }
    for (const pinEl of outputPinEls.concat(childArray(blockEl, "OutputPin")).concat(childArray(blockEl, "Output"))) {
      const pinName = attr(pinEl, "formalParameter") || attr(pinEl, "Name") || attr(pinEl, "name") || `OUT${outputsByName.size}`;
      const negated = attr(pinEl, "invertedPin") === "true";
      const effectiveParameter = attr(pinEl, "effectiveParameter") || void 0;
      const canonicalType = getPinDataType(typeName, pinName, "output");
      const pin = { id: uid("pin"), name: pinName, dataType: canonicalType };
      if (negated) pin.negated = true;
      if (effectiveParameter) pin.value = effectiveParameter;
      outputsByName.set(pinName, pin);
    }
    const inputs = [...inputsByName.values()];
    const outputs = [...outputsByName.values()];
    if (inputs.length === 0) inputs.push({ id: uid("pin"), name: "IN", dataType: "BOOL" });
    if (outputs.length === 0) outputs.push({ id: uid("pin"), name: "OUT", dataType: "BOOL" });
    const node = {
      id: nodeId,
      type: mapSchneiderFBDType(typeName),
      instanceName,
      position: { x, y },
      inputs,
      outputs
    };
    node._xefBlock = {
      originalTypeName: typeName,
      additionnalPinNumber,
      enEnO,
      width: blockWidth,
      height: blockHeight,
      execAfter
    };
    nodes.push(node);
  }
  for (const varEl of childArray(bodyEl, "InVariable").concat(childArray(bodyEl, "inVariable"))) {
    const id = attr(varEl, "Id") || String(idx++);
    const varName = attr(varEl, "Expression") || attr(varEl, "Variable") || attr(varEl, "name") || "";
    const x = Number(attr(child(varEl, "Position"), "X")) || idx * 120;
    const y = Number(attr(child(varEl, "Position"), "Y")) || 0;
    const varType = resolver.resolve(varName);
    nodes.push({
      id: `xef-fbd-${id}`,
      type: "IN_VARIABLE",
      tag: { name: varName, dataType: varType },
      position: { x, y },
      inputs: [],
      outputs: [{ id: uid("pin"), name: "OUT", dataType: varType }]
    });
  }
  for (const varEl of childArray(bodyEl, "OutVariable").concat(childArray(bodyEl, "outVariable"))) {
    const id = attr(varEl, "Id") || String(idx++);
    const varName = attr(varEl, "Expression") || attr(varEl, "Variable") || attr(varEl, "name") || "";
    const x = Number(attr(child(varEl, "Position"), "X")) || idx * 120;
    const y = Number(attr(child(varEl, "Position"), "Y")) || 0;
    const varType = resolver.resolve(varName);
    nodes.push({
      id: `xef-fbd-${id}`,
      type: "OUT_VARIABLE",
      tag: { name: varName, dataType: varType },
      position: { x, y },
      inputs: [{ id: uid("pin"), name: "IN", dataType: varType }],
      outputs: []
    });
  }
  for (const varEl of childArray(bodyEl, "InOutVariable").concat(childArray(bodyEl, "inOutVariable"))) {
    const id = attr(varEl, "Id") || String(idx++);
    const varName = attr(varEl, "Expression") || attr(varEl, "Variable") || attr(varEl, "name") || "";
    const x = Number(attr(child(varEl, "Position"), "X")) || idx * 120;
    const y = Number(attr(child(varEl, "Position"), "Y")) || 0;
    const varType = resolver.resolve(varName);
    nodes.push({
      id: `xef-fbd-${id}`,
      type: "INOUT_VARIABLE",
      tag: { name: varName, dataType: varType },
      position: { x, y },
      inputs: [{ id: uid("pin"), name: "IN", dataType: varType }],
      outputs: [{ id: uid("pin"), name: "OUT", dataType: varType }]
    });
  }
  for (const jmpEl of childArray(bodyEl, "jumpObject")) {
    const label = attr(jmpEl, "label") || "";
    const posEl = child(jmpEl, "objPosition");
    const x = Number(attr(posEl, "posX")) || 0;
    const y = Number(attr(posEl, "posY")) || 0;
    const nodeId = uid("xef-jump");
    nodes.push({ id: nodeId, type: "MOVE", instanceName: `>>>${label}`, position: { x, y }, inputs: [{ id: uid("pin"), name: "IN", dataType: "BOOL" }], outputs: [] });
    nodes[nodes.length - 1]._xefJump = { label };
  }
  for (const lblEl of childArray(bodyEl, "labelObject")) {
    const label = attr(lblEl, "label") || "";
    const posEl = child(lblEl, "objPosition");
    const x = Number(attr(posEl, "posX")) || 0;
    const y = Number(attr(posEl, "posY")) || 0;
    const nodeId = uid("xef-label");
    nodes.push({ id: nodeId, type: "MOVE", instanceName: `<<<${label}`, position: { x, y }, inputs: [], outputs: [{ id: uid("pin"), name: "OUT", dataType: "BOOL" }] });
    nodes[nodes.length - 1]._xefLabel = { label };
  }
  for (const linkFBEl of childArray(bodyEl, "linkFB")) {
    const src = child(linkFBEl, "linkSource");
    const dst = child(linkFBEl, "linkDestination");
    const fromInstanceName = attr(src, "parentObjectName");
    const fromPin = attr(src, "pinName") || "OUT";
    const toInstanceName = attr(dst, "parentObjectName");
    const toPin = attr(dst, "pinName") || "IN";
    if (fromInstanceName && toInstanceName) {
      const fromNodeId = instanceNameToNodeId.get(fromInstanceName) || `xef-fbd-${fromInstanceName}`;
      const toNodeId = instanceNameToNodeId.get(toInstanceName) || `xef-fbd-${toInstanceName}`;
      const srcPos = child(src, "objPosition");
      const dstPos = child(dst, "objPosition");
      const gridPositions = [];
      for (const gp of childArray(linkFBEl, "gridObjPosition")) {
        const gpx = attr(gp, "posX");
        const gpy = attr(gp, "posY");
        if (gpx && gpy) gridPositions.push({ posX: gpx, posY: gpy });
      }
      const wire = {
        id: uid("wire"),
        from: { nodeId: fromNodeId, pin: fromPin },
        to: { nodeId: toNodeId, pin: toPin }
      };
      wire._xefRoute = {
        srcPos: srcPos ? { posX: attr(srcPos, "posX"), posY: attr(srcPos, "posY") } : void 0,
        dstPos: dstPos ? { posX: attr(dstPos, "posX"), posY: attr(dstPos, "posY") } : void 0,
        gridPositions: gridPositions.length > 0 ? gridPositions : void 0
      };
      wires.push(wire);
    }
  }
  for (const linkEl of childArray(bodyEl, "Link").concat(childArray(bodyEl, "Connection"))) {
    const fromId = attr(linkEl, "SourceId") || attr(linkEl, "from");
    const toId = attr(linkEl, "TargetId") || attr(linkEl, "to");
    const fromPin = attr(linkEl, "SourcePin") || attr(linkEl, "FromPin") || "OUT";
    const toPin = attr(linkEl, "TargetPin") || attr(linkEl, "ToPin") || "IN";
    if (fromId && toId) {
      wires.push({
        id: uid("wire"),
        from: { nodeId: `xef-fbd-${fromId}`, pin: fromPin },
        to: { nodeId: `xef-fbd-${toId}`, pin: toPin }
      });
    }
  }
  return { nodes, wires };
}
function mapSchneiderFBDType(typeName) {
  const map = {
    AND: "AND",
    OR: "OR",
    NOT: "NOT",
    XOR: "XOR",
    NAND: "NAND",
    NOR: "NOR",
    ADD: "ADD",
    SUB: "SUB",
    MUL: "MUL",
    DIV: "DIV",
    MOD: "MOD",
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
    MOV: "MOVE",
    ABS: "ABS",
    SQRT: "SQRT",
    MIN: "MIN",
    MAX: "MAX"
  };
  return map[typeName.toUpperCase()] || "MOVE";
}
function parseXEFSFC(bodyEl, pouName, unmapped) {
  const steps = [];
  const transitions = [];
  const links = [];
  const stepIds = /* @__PURE__ */ new Set();
  const transitionIds = /* @__PURE__ */ new Set();
  for (const stepEl of childArray(bodyEl, "Step")) {
    const id = attr(stepEl, "Id") || attr(stepEl, "Name");
    if (id) stepIds.add(id);
    const name = attr(stepEl, "Name") || id;
    const isInitial = attr(stepEl, "Initial") === "true" || attr(stepEl, "IsInitial") === "true";
    const actions = [];
    const validQualifiers = ["N", "S", "R", "P", "P1", "P0", "L", "D", "SD", "DS", "SL"];
    const actionBlocks = childArray(stepEl, "ActionBlock");
    const directActions = childArray(stepEl, "Action");
    const allActionEls = actionBlocks.flatMap((ab) => childArray(ab, "Action")).concat(directActions);
    for (const actionEl of allActionEls) {
      const qualifier = (attr(actionEl, "Qualifier") || attr(actionEl, "qualifier") || "N").toUpperCase();
      const actionName = attr(actionEl, "Name") || attr(actionEl, "ActionName") || attr(actionEl, "name") || "";
      const body = text(child(actionEl, "Body") ?? child(actionEl, "ST") ?? actionEl) || void 0;
      const duration = attr(actionEl, "Duration") || attr(actionEl, "duration") || void 0;
      if (actionName || body) {
        actions.push({
          id: uid(`action-${id}`),
          qualifier: validQualifiers.includes(qualifier) ? qualifier : "N",
          tag: { name: actionName || `${name}_Action`, dataType: "BOOL" },
          duration
        });
      }
    }
    steps.push({
      id: `xef-step-${id}`,
      name: name || `Step_${id}`,
      isInitial,
      actions,
      position: {
        x: Number(attr(child(stepEl, "Position"), "X")) || 0,
        y: Number(attr(child(stepEl, "Position"), "Y")) || 0
      }
    });
  }
  for (const transEl of childArray(bodyEl, "Transition")) {
    const id = attr(transEl, "Id") || attr(transEl, "Name");
    if (id) transitionIds.add(id);
    const condition = text(child(transEl, "Condition") ?? transEl) || "TRUE";
    const priority = Number(attr(transEl, "Priority")) || void 0;
    transitions.push({
      id: `xef-trans-${id}`,
      condition,
      priority,
      position: {
        x: Number(attr(child(transEl, "Position"), "X")) || 0,
        y: Number(attr(child(transEl, "Position"), "Y")) || 0
      }
    });
  }
  for (const linkEl of childArray(bodyEl, "TransitionLink").concat(childArray(bodyEl, "Link"))) {
    const from = attr(linkEl, "SourceId") || attr(linkEl, "from");
    const to = attr(linkEl, "TargetId") || attr(linkEl, "to");
    if (!from || !to) continue;
    const fromIsStep = stepIds.has(from);
    const fromIsTrans = transitionIds.has(from);
    const toIsStep = stepIds.has(to);
    const toIsTrans = transitionIds.has(to);
    let fromId;
    let toId;
    if (fromIsStep) fromId = `xef-step-${from}`;
    else if (fromIsTrans) fromId = `xef-trans-${from}`;
    else fromId = `xef-step-${from}`;
    if (toIsStep) toId = `xef-step-${to}`;
    else if (toIsTrans) toId = `xef-trans-${to}`;
    else toId = `xef-trans-${to}`;
    links.push({ id: uid(`link-${from}-${to}`), from: fromId, to: toId, type: "simple" });
  }
  return { steps, transitions, links, branches: [] };
}
function exportSchneider(project) {
  const errors = [];
  const warnings = [];
  const sidecar = project.sidecar;
  const globalVars = project.globalTags.map(tagToXEFVariable);
  const programs = project.pous.map((pou) => pouToXEFProgram(pou, warnings));
  const now = /* @__PURE__ */ new Date();
  const dtStr = `date_and_time#${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
  const obj = {
    FEFExchangeFile: {
      fileHeader: {
        "@_company": "Plaxio",
        "@_product": "Plaxio PLC Editor",
        "@_dateTime": dtStr,
        "@_content": "Project source file",
        "@_DTDVersion": "41"
      },
      contentHeader: {
        "@_name": project.projectName,
        "@_version": sidecar.vendorSpecificGlobals?.["version"] ?? "0.0.1",
        "@_dateTime": dtStr
      },
      dataBlock: {
        variables: globalVars.length ? globalVars : void 0
      },
      program: programs
    }
  };
  return { ok: true, xmlContent: buildXML(obj), errors, warnings };
}
function tagToXEFVariable(tag) {
  const meta = tag._xefMeta;
  const typeName = meta?.originalType || tag.dataType;
  const result = {
    "@_name": tag.name,
    "@_typeName": typeName
  };
  if (tag.address) result["@_topologicalAddress"] = tag.address;
  if (tag.description) result["comment"] = tag.description;
  if (tag.initialValue) result["variableInit"] = { "@_value": tag.initialValue };
  if (meta?.attributes && meta.attributes.length > 0) {
    result["attribute"] = meta.attributes.map((a) => ({ "@_name": a.name, "@_value": a.value }));
  }
  return result;
}
function pouToXEFProgram(pou, warnings) {
  const localVars = pou.localTags.map(tagToXEFVariable);
  const localVarsSection = localVars.length > 0 ? { publicLocalVariables: { variables: localVars } } : {};
  let bodySection = {};
  if (pou.language === "LD" && pou.ladderProgram) {
    const ldBody = {
      Rung: pou.ladderProgram.rungs.map((rung, ri) => {
        const rungObj = {
          "@_Number": String(ri + 1),
          Comment: rung.comment || void 0,
          ...buildXEFRungElements(rung.elements)
        };
        if (rung.branches && rung.branches.length > 0) {
          rungObj.Branch = rung.branches.map((branch) => buildXEFRungElements(branch.elements));
        }
        return rungObj;
      })
    };
    bodySection = { LDSource: ldBody };
  } else if (pou.language === "FBD" && pou.fbdProgram) {
    bodySection = { FBDSource: buildXEFFBDExport(pou.fbdProgram) };
  } else if (pou.language === "SFC" && pou.sfcProgram) {
    bodySection = { SFCSource: buildXEFSFCExport(pou.sfcProgram) };
  } else if (pou.language === "ST" && pou.stSource) {
    bodySection = { STSource: { "#text": pou.stSource } };
  } else {
    warnings.push(`POU "${pou.name}": ${pou.language} export \u2014 empty body`);
  }
  const pouMeta = pou._xefMeta;
  return {
    identProgram: {
      "@_name": pou.name,
      "@_type": pouMeta?.sectionType || "section",
      "@_task": pouMeta?.task || "MAST"
    },
    ...localVarsSection,
    ...bodySection
  };
}
function buildXEFRungElements(elements) {
  const contacts = [];
  const coils = [];
  const blocks = [];
  for (const el of elements) {
    if (el.kind === "contact") {
      const c = el;
      const typeMap = { NO: "", NC: "NC", P_CONTACT: "P", N_CONTACT: "N" };
      contacts.push({ "@_Variable": c.tag.name, "@_Type": typeMap[c.type] || "" });
    } else if (el.kind === "coil") {
      const c = el;
      const typeMap = { normal: "Normal", negated: "Negated", set: "Set", reset: "Reset", latch: "Latch", unlatch: "Unlatch" };
      coils.push({ "@_Variable": c.tag.name, "@_Type": typeMap[c.type] || "Normal" });
    } else if (el.kind === "block") {
      const b = el;
      const inputPins = Object.entries(b.pins || {}).map(([name, ref]) => ({
        "@_Name": name,
        "@_Variable": ref.name
      }));
      blocks.push({
        "@_Type": b.fbType,
        "@_Instance": b.instanceName,
        ...inputPins.length > 0 ? { InputPin: inputPins } : {}
      });
    }
  }
  const result = {};
  if (contacts.length) result.Contact = contacts;
  if (coils.length) result.Coil = coils;
  if (blocks.length) result.FunctionBlock = blocks;
  return result;
}
function buildXEFFBDExport(fbd) {
  const grid = fbd._xefGrid;
  const jumpObjects = fbd.nodes.filter((n) => n._xefJump).map((n) => ({
    "@_label": n._xefJump.label,
    objPosition: { "@_posX": String(n.position.x), "@_posY": String(n.position.y) }
  }));
  const labelObjects = fbd.nodes.filter((n) => n._xefLabel).map((n) => ({
    "@_label": n._xefLabel.label,
    objPosition: { "@_posX": String(n.position.x), "@_posY": String(n.position.y) }
  }));
  const blocks = fbd.nodes.filter((n) => n.type !== "IN_VARIABLE" && n.type !== "OUT_VARIABLE" && n.type !== "INOUT_VARIABLE" && !n._xefJump && !n._xefLabel).map((n) => {
    const xb = n._xefBlock;
    const inputVars = (n.inputs || []).map((p) => {
      const iv = { "@_formalParameter": p.name };
      iv["@_invertedPin"] = p.negated ? "true" : "false";
      if (p.value) iv["@_effectiveParameter"] = p.value;
      return iv;
    });
    const outputVars = (n.outputs || []).map((p) => {
      const ov = { "@_formalParameter": p.name };
      ov["@_invertedPin"] = p.negated ? "true" : "false";
      if (p.value) ov["@_effectiveParameter"] = p.value;
      return ov;
    });
    const blockObj = {
      "@_instanceName": n.instanceName || n.id,
      "@_typeName": xb?.originalTypeName || n.type
    };
    if (xb?.additionnalPinNumber != null) blockObj["@_additionnalPinNumber"] = xb.additionnalPinNumber;
    if (xb?.enEnO != null) blockObj["@_enEnO"] = xb.enEnO;
    if (xb?.width != null) blockObj["@_width"] = xb.width;
    if (xb?.height != null) blockObj["@_height"] = xb.height;
    blockObj["objPosition"] = { "@_posX": String(n.position.x), "@_posY": String(n.position.y) };
    if (inputVars.length > 0 || outputVars.length > 0) {
      const descFFB = {};
      if (xb?.execAfter != null) descFFB["@_execAfter"] = xb.execAfter;
      if (inputVars.length > 0) descFFB["inputVariable"] = inputVars;
      if (outputVars.length > 0) descFFB["outputVariable"] = outputVars;
      blockObj["descriptionFFB"] = descFFB;
    }
    return blockObj;
  });
  const inVars = fbd.nodes.filter((n) => n.type === "IN_VARIABLE").map((n) => ({
    "@_Id": n.id,
    "@_Expression": n.tag?.name || "",
    Position: { "@_X": String(n.position.x), "@_Y": String(n.position.y) }
  }));
  const outVars = fbd.nodes.filter((n) => n.type === "OUT_VARIABLE").map((n) => ({
    "@_Id": n.id,
    "@_Expression": n.tag?.name || "",
    Position: { "@_X": String(n.position.x), "@_Y": String(n.position.y) }
  }));
  const linkFBs = fbd.wires.map((w) => {
    const route = w._xefRoute;
    const linkObj = {
      linkSource: {
        "@_parentObjectName": w.from.nodeId,
        "@_pinName": w.from.pin,
        ...route?.srcPos ? { objPosition: { "@_posX": route.srcPos.posX, "@_posY": route.srcPos.posY } } : {}
      },
      linkDestination: {
        "@_parentObjectName": w.to.nodeId,
        "@_pinName": w.to.pin,
        ...route?.dstPos ? { objPosition: { "@_posX": route.dstPos.posX, "@_posY": route.dstPos.posY } } : {}
      }
    };
    if (route?.gridPositions) {
      linkObj["gridObjPosition"] = route.gridPositions.map((gp) => ({ "@_posX": gp.posX, "@_posY": gp.posY }));
    }
    return linkObj;
  });
  const fbdSource = {};
  if (grid?.nbRows) fbdSource["@_nbRows"] = grid.nbRows;
  if (grid?.nbColumns) fbdSource["@_nbColumns"] = grid.nbColumns;
  fbdSource["networkFBD"] = {
    jumpObject: jumpObjects.length ? jumpObjects : void 0,
    labelObject: labelObjects.length ? labelObjects : void 0,
    FFBBlock: blocks.length ? blocks : void 0,
    InVariable: inVars.length ? inVars : void 0,
    OutVariable: outVars.length ? outVars : void 0,
    linkFB: linkFBs.length ? linkFBs : void 0
  };
  return fbdSource;
}
function buildXEFSFCExport(sfc) {
  const steps = sfc.steps.map((s) => ({
    "@_Id": s.id.replace("xef-step-", ""),
    "@_Name": s.name,
    "@_Initial": String(s.isInitial),
    Position: { "@_X": String(s.position.x), "@_Y": String(s.position.y) },
    ...s.actions.length > 0 ? {
      ActionBlock: {
        Action: s.actions.map((a) => ({
          "@_Qualifier": a.qualifier,
          "@_Name": a.tag.name,
          "@_Duration": a.duration || void 0
        }))
      }
    } : {}
  }));
  const transitions = sfc.transitions.map((t) => ({
    "@_Id": t.id.replace("xef-trans-", ""),
    "@_Name": t.id,
    Condition: t.condition,
    Position: { "@_X": String(t.position.x), "@_Y": String(t.position.y) }
  }));
  const links = sfc.links.map((l) => ({
    "@_SourceId": l.from.replace(/^xef-(step|trans)-/, ""),
    "@_TargetId": l.to.replace(/^xef-(step|trans)-/, "")
  }));
  return {
    Step: steps.length ? steps : void 0,
    Transition: transitions.length ? transitions : void 0,
    TransitionLink: links.length ? links : void 0
  };
}
export {
  decompressZEF,
  exportSchneider,
  importSchneider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjL3BsYy1lZGl0b3ItdHN4L3ZlbmRvci9hZGFwdGVycy9zY2huZWlkZXJBZGFwdGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKlxuICogU2NobmVpZGVyIEVsZWN0cmljIFhFRi9aRUYgQWRhcHRlciAoQ29udHJvbCBFeHBlcnQgLyBFY29TdHJ1eHVyZSBNYWNoaW5lIEV4cGVydClcbiAqIFBhcnNlcyAuWEVGIChYTUwtYmFzZWQpIGFuZCAuWkVGIChaSVAtY29tcHJlc3NlZCBYRUYpIHByb2plY3QgZmlsZXMuXG4gKlxuICogRml4ZXMgYXBwbGllZDpcbiAqIC0gRWRnZSBjb250YWN0cyAoUC9OIHR5cGUpIHByb3Blcmx5IG1hcHBlZFxuICogLSBTRkMgc3RlcCBhY3Rpb25zIGZ1bGx5IHBhcnNlZFxuICogLSBGQkQgc3RhbmRhbG9uZSB2YXJpYWJsZSBub2RlcyBpbXBvcnRlZFxuICogLSBGQkQgYmxvY2sgcGluIGRldGFpbHMgcG9wdWxhdGVkXG4gKiAtIFNGQyBsaW5rIGRpcmVjdGlvbiBjb3JyZWN0ZWQgKHN0ZXAgdnMgdHJhbnNpdGlvbiBkZXRlY3Rpb24pXG4gKiAtIFpFRiBkZWNvbXByZXNzaW9uIHN1cHBvcnRcbiAqL1xuXG5pbXBvcnQgeyBwYXJzZVhNTCwgYnVpbGRYTUwsIGF0dHIsIHRleHQsIGNoaWxkLCBjaGlsZEFycmF5IH0gZnJvbSAnLi4veG1sVXRpbHMuanMnO1xuaW1wb3J0IHsgc2NobmVpZGVyVHlwZVRvSUVDIH0gZnJvbSAnLi4vZGF0YVR5cGVNYXAuanMnO1xuaW1wb3J0IHsgYnVpbGRSZXNvbHZlciwgVmFyaWFibGVUeXBlUmVzb2x2ZXIgfSBmcm9tICcuLi92YXJpYWJsZVR5cGVSZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBnZXRQaW5EYXRhVHlwZSwgYnVpbGRUeXBlZFBpbnMsIGJ1aWxkVHlwZWRUYWdSZWZQaW5zIH0gZnJvbSAnLi4vcGluU2lnbmF0dXJlcy5qcyc7XG5pbXBvcnQgdHlwZSB7XG4gIEltcG9ydFJlc3VsdCwgRXhwb3J0UmVzdWx0LCBOb3JtYWxpemVkUHJvamVjdCwgTm9ybWFsaXplZFBPVSwgTm9ybWFsaXplZFRhZyxcbiAgVmVuZG9yTWV0YWRhdGFTaWRlY2FyLCBVbm1hcHBlZEVsZW1lbnQsXG59IGZyb20gJy4uL3R5cGVzLmpzJztcbmltcG9ydCB0eXBlIHtcbiAgTGFkZGVyUHJvZ3JhbSwgRkJEUHJvZ3JhbSwgU0ZDUHJvZ3JhbSwgUnVuZywgTGFkZGVyRWxlbWVudCxcbiAgQ29udGFjdEVsZW1lbnQsIENvaWxFbGVtZW50LCBCbG9ja0VsZW1lbnQsIENvbnRhY3RUeXBlLCBDb2lsVHlwZSxcbiAgRkJETm9kZSwgRkJEV2lyZSwgRkJEQmxvY2tUeXBlLCBQaW4sXG4gIFNGQ1N0ZXAsIFNGQ1RyYW5zaXRpb24sIFNGQ0xpbmssIFNGQ0FjdGlvbiwgQWN0aW9uUXVhbGlmaWVyLFxufSBmcm9tICcuLi8uLi9sb2dpY1N0b3JlLmpzJztcblxubGV0IF91aWQgPSAwO1xuZnVuY3Rpb24gdWlkKHByZWZpeDogc3RyaW5nKTogc3RyaW5nIHsgcmV0dXJuIGAke3ByZWZpeH0tJHsrK191aWR9LSR7TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMiwgOCl9YDsgfVxuXG5mdW5jdGlvbiB1bmVzY2FwZVhNTChzOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gcy5yZXBsYWNlKC8mYW1wOy9nLCAnJicpLnJlcGxhY2UoLyZsdDsvZywgJzwnKS5yZXBsYWNlKC8mZ3Q7L2csICc+JykucmVwbGFjZSgvJnF1b3Q7L2csICdcIicpLnJlcGxhY2UoLyZhcG9zOy9nLCBcIidcIik7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBaRUYgRGVjb21wcmVzc2lvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuYXN5bmMgZnVuY3Rpb24gZGVjb21wcmVzc1pFRihkYXRhOiBBcnJheUJ1ZmZlcik6IFByb21pc2U8c3RyaW5nPiB7XG4gIGNvbnN0IGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoZGF0YSk7XG5cbiAgLy8gQ2hlY2sgZm9yIFpJUCBtYWdpYyBoZWFkZXIgKFBLXFx4MDNcXHgwNClcbiAgaWYgKCEoYnl0ZXNbMF0gPT09IDB4NTAgJiYgYnl0ZXNbMV0gPT09IDB4NEIpKSB7XG4gICAgLy8gTm90IGEgWklQIFx1MjAxNCB0cmVhdCBhcyBwbGFpbiBYTUxcbiAgICByZXR1cm4gbmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKGRhdGEpO1xuICB9XG5cbiAgLy8gWklQIGZpbGUgXHUyMDE0IGl0ZXJhdGUgYWxsIGxvY2FsIGZpbGUgaGVhZGVycyB0byBmaW5kIHRoZSBYRUYvWE1MIGVudHJ5XG4gIC8vIExvY2FsIGZpbGUgaGVhZGVyIGxheW91dDogc2lnKDQpICsgbWluVmVyKDIpICsgZmxhZ3MoMikgKyBtZXRob2QoMikgKyBtb2RUaW1lKDIpICsgbW9kRGF0ZSgyKVxuICAvLyAgICsgY3JjMzIoNCkgKyBjb21wU2l6ZSg0KSArIHVuY29tcFNpemUoNCkgKyBmbkxlbigyKSArIGV4dHJhTGVuKDIpICsgZmlsZW5hbWUoZm5MZW4pICsgZXh0cmEoZXh0cmFMZW4pICsgZGF0YVxuICBsZXQgcG9zID0gMDtcbiAgbGV0IGJlc3RYbWxFbnRyeTogeyBzdGFydDogbnVtYmVyOyBjb21wU2l6ZTogbnVtYmVyOyB1bmNvbXBTaXplOiBudW1iZXI7IG1ldGhvZDogbnVtYmVyOyBuYW1lOiBzdHJpbmcgfSB8IG51bGwgPSBudWxsO1xuXG4gIHdoaWxlIChwb3MgKyAzMCA8PSBieXRlcy5sZW5ndGgpIHtcbiAgICBjb25zdCBzaWcgPSBieXRlc1twb3NdIHwgKGJ5dGVzW3BvcysxXSA8PCA4KSB8IChieXRlc1twb3MrMl0gPDwgMTYpIHwgKGJ5dGVzW3BvcyszXSA8PCAyNCk7XG4gICAgaWYgKHNpZyAhPT0gMHgwNDAzNGI1MCkgYnJlYWs7IC8vIE5vdCBhIGxvY2FsIGZpbGUgaGVhZGVyIFx1MjAxNCBzdG9wIHNjYW5uaW5nXG5cbiAgICBjb25zdCBtZXRob2QgPSBieXRlc1twb3MrOF0gfCAoYnl0ZXNbcG9zKzldIDw8IDgpO1xuICAgIGNvbnN0IGNvbXBTaXplID0gYnl0ZXNbcG9zKzE4XSB8IChieXRlc1twb3MrMTldIDw8IDgpIHwgKGJ5dGVzW3BvcysyMF0gPDwgMTYpIHwgKGJ5dGVzW3BvcysyMV0gPDwgMjQpO1xuICAgIGNvbnN0IHVuY29tcFNpemUgPSBieXRlc1twb3MrMjJdIHwgKGJ5dGVzW3BvcysyM10gPDwgOCkgfCAoYnl0ZXNbcG9zKzI0XSA8PCAxNikgfCAoYnl0ZXNbcG9zKzI1XSA8PCAyNCk7XG4gICAgY29uc3QgZm5MZW4gPSBieXRlc1twb3MrMjZdIHwgKGJ5dGVzW3BvcysyN10gPDwgOCk7XG4gICAgY29uc3QgZXh0cmFMZW4gPSBieXRlc1twb3MrMjhdIHwgKGJ5dGVzW3BvcysyOV0gPDwgOCk7XG4gICAgY29uc3QgZm5CeXRlcyA9IGJ5dGVzLnNsaWNlKHBvcyArIDMwLCBwb3MgKyAzMCArIGZuTGVuKTtcbiAgICBjb25zdCBmaWxlTmFtZSA9IG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShmbkJ5dGVzKS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IGRhdGFTdGFydCA9IHBvcyArIDMwICsgZm5MZW4gKyBleHRyYUxlbjtcblxuICAgIC8vIFByZWZlciB0aGUgLnhlZiBvciAueG1sIGVudHJ5OyBza2lwIGRpcmVjdG9yeSBlbnRyaWVzIGFuZCBEVE0gZmlsZXNcbiAgICBpZiAoKGZpbGVOYW1lLmVuZHNXaXRoKCcueGVmJykgfHwgZmlsZU5hbWUuZW5kc1dpdGgoJy54bWwnKSkgJiYgIWZpbGVOYW1lLmluY2x1ZGVzKCdmZHRkdG0nKSAmJiBjb21wU2l6ZSA+IDApIHtcbiAgICAgIGJlc3RYbWxFbnRyeSA9IHsgc3RhcnQ6IGRhdGFTdGFydCwgY29tcFNpemUsIHVuY29tcFNpemUsIG1ldGhvZCwgbmFtZTogZmlsZU5hbWUgfTtcbiAgICAgIGJyZWFrOyAvLyBGaXJzdCBtYXRjaGluZyBlbnRyeSBpcyB1c3VhbGx5IHRoZSBtYWluIHByb2plY3RcbiAgICB9XG5cbiAgICBwb3MgPSBkYXRhU3RhcnQgKyAoY29tcFNpemUgPiAwID8gY29tcFNpemUgOiB1bmNvbXBTaXplKTtcbiAgfVxuXG4gIGlmICghYmVzdFhtbEVudHJ5KSB7XG4gICAgLy8gTm8gWE1MIGVudHJ5IGZvdW5kIFx1MjAxNCBmYWxsIGJhY2sgdG8gdHJ5aW5nIGZpcnN0IGVudHJ5XG4gICAgY29uc3QgZm5MZW4gPSBieXRlc1syNl0gfCAoYnl0ZXNbMjddIDw8IDgpO1xuICAgIGNvbnN0IGV4dHJhTGVuID0gYnl0ZXNbMjhdIHwgKGJ5dGVzWzI5XSA8PCA4KTtcbiAgICBiZXN0WG1sRW50cnkgPSB7XG4gICAgICBzdGFydDogMzAgKyBmbkxlbiArIGV4dHJhTGVuLFxuICAgICAgY29tcFNpemU6IGJ5dGVzWzE4XSB8IChieXRlc1sxOV0gPDwgOCkgfCAoYnl0ZXNbMjBdIDw8IDE2KSB8IChieXRlc1syMV0gPDwgMjQpLFxuICAgICAgdW5jb21wU2l6ZTogYnl0ZXNbMjJdIHwgKGJ5dGVzWzIzXSA8PCA4KSB8IChieXRlc1syNF0gPDwgMTYpIHwgKGJ5dGVzWzI1XSA8PCAyNCksXG4gICAgICBtZXRob2Q6IGJ5dGVzWzhdIHwgKGJ5dGVzWzldIDw8IDgpLFxuICAgICAgbmFtZTogJ2ZhbGxiYWNrJyxcbiAgICB9O1xuICB9XG5cbiAgLy8gTWV0aG9kIDAgPSBzdG9yZWQgKG5vIGNvbXByZXNzaW9uKVxuICBpZiAoYmVzdFhtbEVudHJ5Lm1ldGhvZCA9PT0gMCkge1xuICAgIHJldHVybiBuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUoYnl0ZXMuc2xpY2UoYmVzdFhtbEVudHJ5LnN0YXJ0LCBiZXN0WG1sRW50cnkuc3RhcnQgKyBiZXN0WG1sRW50cnkudW5jb21wU2l6ZSkpO1xuICB9XG5cbiAgLy8gTWV0aG9kIDggPSBkZWZsYXRlXG4gIHRyeSB7XG4gICAgY29uc3QgZHMgPSBuZXcgRGVjb21wcmVzc2lvblN0cmVhbSgnZGVmbGF0ZS1yYXcnKTtcbiAgICBjb25zdCBjb21wcmVzc2VkRGF0YSA9IGJ5dGVzLnNsaWNlKGJlc3RYbWxFbnRyeS5zdGFydCwgYmVzdFhtbEVudHJ5LnN0YXJ0ICsgYmVzdFhtbEVudHJ5LmNvbXBTaXplKTtcbiAgICBjb25zdCBibG9iID0gbmV3IEJsb2IoW2NvbXByZXNzZWREYXRhXSk7XG4gICAgY29uc3Qgc3RyZWFtID0gYmxvYi5zdHJlYW0oKS5waXBlVGhyb3VnaChkcyk7XG4gICAgY29uc3QgcmVhZGVyID0gc3RyZWFtLmdldFJlYWRlcigpO1xuICAgIGNvbnN0IGNodW5rczogVWludDhBcnJheVtdID0gW107XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IHsgZG9uZSwgdmFsdWUgfSA9IGF3YWl0IHJlYWRlci5yZWFkKCk7XG4gICAgICBpZiAoZG9uZSkgYnJlYWs7XG4gICAgICBjaHVua3MucHVzaCh2YWx1ZSk7XG4gICAgfVxuICAgIGNvbnN0IHRvdGFsTGVuID0gY2h1bmtzLnJlZHVjZSgoc3VtLCBjKSA9PiBzdW0gKyBjLmxlbmd0aCwgMCk7XG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkodG90YWxMZW4pO1xuICAgIGxldCBvZmZzZXQgPSAwO1xuICAgIGZvciAoY29uc3QgY2h1bmsgb2YgY2h1bmtzKSB7IHJlc3VsdC5zZXQoY2h1bmssIG9mZnNldCk7IG9mZnNldCArPSBjaHVuay5sZW5ndGg7IH1cbiAgICByZXR1cm4gbmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKHJlc3VsdCk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIEZhbGxiYWNrOiBnemlwIHdyYXBwZXJcbiAgICB0cnkge1xuICAgICAgY29uc3QgZHMgPSBuZXcgRGVjb21wcmVzc2lvblN0cmVhbSgnZGVmbGF0ZScpO1xuICAgICAgY29uc3QgYmxvYiA9IG5ldyBCbG9iKFtieXRlcy5zbGljZShiZXN0WG1sRW50cnkuc3RhcnQsIGJlc3RYbWxFbnRyeS5zdGFydCArIGJlc3RYbWxFbnRyeS5jb21wU2l6ZSldKTtcbiAgICAgIGNvbnN0IHN0cmVhbSA9IGJsb2Iuc3RyZWFtKCkucGlwZVRocm91Z2goZHMpO1xuICAgICAgY29uc3QgcmVhZGVyID0gc3RyZWFtLmdldFJlYWRlcigpO1xuICAgICAgY29uc3QgY2h1bmtzOiBVaW50OEFycmF5W10gPSBbXTtcbiAgICAgIHdoaWxlICh0cnVlKSB7IGNvbnN0IHsgZG9uZSwgdmFsdWUgfSA9IGF3YWl0IHJlYWRlci5yZWFkKCk7IGlmIChkb25lKSBicmVhazsgY2h1bmtzLnB1c2godmFsdWUpOyB9XG4gICAgICBjb25zdCB0b3RhbExlbiA9IGNodW5rcy5yZWR1Y2UoKHMsIGMpID0+IHMgKyBjLmxlbmd0aCwgMCk7XG4gICAgICBjb25zdCByZXN1bHQgPSBuZXcgVWludDhBcnJheSh0b3RhbExlbik7XG4gICAgICBsZXQgb2Zmc2V0ID0gMDtcbiAgICAgIGZvciAoY29uc3QgY2h1bmsgb2YgY2h1bmtzKSB7IHJlc3VsdC5zZXQoY2h1bmssIG9mZnNldCk7IG9mZnNldCArPSBjaHVuay5sZW5ndGg7IH1cbiAgICAgIHJldHVybiBuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUocmVzdWx0KTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGRlY29tcHJlc3MgWkVGIGZpbGUgZW50cnkgXCIke2Jlc3RYbWxFbnRyeS5uYW1lfVwiYCk7XG4gICAgfVxuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBJbXBvcnQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBmdW5jdGlvbiBpbXBvcnRTY2huZWlkZXIoeG1sQ29udGVudDogc3RyaW5nLCBmaWxlUGF0aDogc3RyaW5nKTogSW1wb3J0UmVzdWx0IHtcbiAgX3VpZCA9IDA7XG4gIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHVubWFwcGVkOiBVbm1hcHBlZEVsZW1lbnRbXSA9IFtdO1xuXG4gIGxldCByb290OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbiAgdHJ5IHtcbiAgICByb290ID0gcGFyc2VYTUwoeG1sQ29udGVudCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9yczogW2BYTUwgcGFyc2UgZXJyb3I6ICR7ZX1gXSwgd2FybmluZ3M6IFtdIH07XG4gIH1cblxuICAvLyBYRUYgcm9vdDogPEZFRkV4Y2hhbmdlRmlsZT4gKHJlYWwgWEVGKSwgPFByb2plY3RGaWxlPiwgb3IgPHByb2plY3Q+XG4gIGNvbnN0IGZlZlJvb3QgPSBjaGlsZChyb290LCAnRkVGRXhjaGFuZ2VGaWxlJykgPz8gY2hpbGQocm9vdCwgJ1Byb2plY3RGaWxlJykgPz8gY2hpbGQocm9vdCwgJ3Byb2plY3QnKSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IHVuZGVmaW5lZDtcbiAgaWYgKCFmZWZSb290KSB7XG4gICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcnM6IFsnTm8gPEZFRkV4Y2hhbmdlRmlsZT4gb3IgPFByb2plY3RGaWxlPiByb290IGZvdW5kIGluIFhFRiBmaWxlJ10sIHdhcm5pbmdzOiBbXSB9O1xuICB9XG4gIC8vIEZvciBiYWNrd2FyZC1jb21wYXQgd2l0aCBvbGQgY29kZSBwYXRocywgYWxpYXMgcHJvamVjdEZpbGUgLT4gZmVmUm9vdFxuICBjb25zdCBwcm9qZWN0RmlsZSA9IGZlZlJvb3Q7XG5cbiAgY29uc3QgcHJvamVjdE5hbWUgPSBhdHRyKHByb2plY3RGaWxlLCAnTmFtZScpIHx8IGF0dHIocHJvamVjdEZpbGUsICduYW1lJykgfHwgJ1NjaG5laWRlciBJbXBvcnQnO1xuICBjb25zdCB2ZXJzaW9uID0gYXR0cihwcm9qZWN0RmlsZSwgJ1ZlcnNpb24nKSB8fCAnMS4wJztcblxuICBjb25zdCBnbG9iYWxUYWdzOiBOb3JtYWxpemVkVGFnW10gPSBbXTtcbiAgY29uc3QgcG91czogTm9ybWFsaXplZFBPVVtdID0gW107XG5cbiAgLy8gQnVnIDI6IEdsb2JhbCB2YXJpYWJsZXMgXHUyMDE0IHJlYWwgWEVGIHVzZXMgPGRhdGFCbG9jaz48dmFyaWFibGVzIC4uLj5cbiAgY29uc3QgZGF0YUJsb2NrID0gY2hpbGQoZmVmUm9vdCwgJ2RhdGFCbG9jaycpO1xuICBpZiAoZGF0YUJsb2NrKSB7XG4gICAgZm9yIChjb25zdCB2YXJFbCBvZiBjaGlsZEFycmF5KGRhdGFCbG9jaywgJ3ZhcmlhYmxlcycpKSB7XG4gICAgICBjb25zdCB0YWcgPSBwYXJzZVhFRlZhcmlhYmxlKHZhckVsLCB1bm1hcHBlZCk7XG4gICAgICBpZiAodGFnKSBnbG9iYWxUYWdzLnB1c2godGFnKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IG9sZGVyIGZvcm1hdCB3aXRoIEdsb2JhbFNlY3Rpb25cbiAgICBjb25zdCBkYXRhRWwgPSBjaGlsZChwcm9qZWN0RmlsZSwgJ0RhdGEnKSA/PyBwcm9qZWN0RmlsZTtcbiAgICBjb25zdCBnbG9iYWxTZWN0aW9uID0gY2hpbGQoZGF0YUVsLCAnR2xvYmFsU2VjdGlvbicpID8/IGNoaWxkKHByb2plY3RGaWxlLCAnR2xvYmFsJyk7XG4gICAgaWYgKGdsb2JhbFNlY3Rpb24pIHtcbiAgICAgIGZvciAoY29uc3QgdmFyRWwgb2YgY2hpbGRBcnJheShnbG9iYWxTZWN0aW9uLCAnVmFyaWFibGUnKS5jb25jYXQoY2hpbGRBcnJheShnbG9iYWxTZWN0aW9uLCAnVmFyJykpLmNvbmNhdChjaGlsZEFycmF5KGdsb2JhbFNlY3Rpb24sICd2YXJpYWJsZXMnKSkpIHtcbiAgICAgICAgY29uc3QgdGFnID0gcGFyc2VYRUZWYXJpYWJsZSh2YXJFbCwgdW5tYXBwZWQpO1xuICAgICAgICBpZiAodGFnKSBnbG9iYWxUYWdzLnB1c2godGFnKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBQYXJzZSBGQlNvdXJjZSAoZnVuY3Rpb24gYmxvY2sgdHlwZSBkZWZpbml0aW9ucykgYXMgZnVuY3Rpb24tYmxvY2sgUE9Vc1xuICBmb3IgKGNvbnN0IGZiU3JjIG9mIGNoaWxkQXJyYXkoZmVmUm9vdCwgJ0ZCU291cmNlJykpIHtcbiAgICBjb25zdCBmYlR5cGVOYW1lID0gYXR0cihmYlNyYywgJ25hbWVPZkZCVHlwZScpIHx8ICdGQic7XG4gICAgY29uc3QgbG9jYWxUYWdzOiBOb3JtYWxpemVkVGFnW10gPSBbXTtcbiAgICAvLyBJbnB1dC9vdXRwdXQvbG9jYWwgcGFyYW1ldGVyc1xuICAgIGZvciAoY29uc3QgdiBvZiBjaGlsZEFycmF5KGNoaWxkKGZiU3JjLCAnaW5wdXRQYXJhbWV0ZXJzJyksICd2YXJpYWJsZXMnKSkge1xuICAgICAgY29uc3QgdGFnID0gcGFyc2VYRUZWYXJpYWJsZSh2LCB1bm1hcHBlZCk7XG4gICAgICBpZiAodGFnKSB7ICh0YWcgYXMgYW55KS5fcGFyYW1EaXIgPSAnaW5wdXQnOyBsb2NhbFRhZ3MucHVzaCh0YWcpOyB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgdiBvZiBjaGlsZEFycmF5KGNoaWxkKGZiU3JjLCAnb3V0cHV0UGFyYW1ldGVycycpLCAndmFyaWFibGVzJykpIHtcbiAgICAgIGNvbnN0IHRhZyA9IHBhcnNlWEVGVmFyaWFibGUodiwgdW5tYXBwZWQpO1xuICAgICAgaWYgKHRhZykgeyAodGFnIGFzIGFueSkuX3BhcmFtRGlyID0gJ291dHB1dCc7IGxvY2FsVGFncy5wdXNoKHRhZyk7IH1cbiAgICB9XG4gICAgZm9yIChjb25zdCB2IG9mIGNoaWxkQXJyYXkoY2hpbGQoZmJTcmMsICdpbk91dFBhcmFtZXRlcnMnKSwgJ3ZhcmlhYmxlcycpKSB7XG4gICAgICBjb25zdCB0YWcgPSBwYXJzZVhFRlZhcmlhYmxlKHYsIHVubWFwcGVkKTtcbiAgICAgIGlmICh0YWcpIHsgKHRhZyBhcyBhbnkpLl9wYXJhbURpciA9ICdpbm91dCc7IGxvY2FsVGFncy5wdXNoKHRhZyk7IH1cbiAgICB9XG4gICAgZm9yIChjb25zdCB2IG9mIGNoaWxkQXJyYXkoY2hpbGQoZmJTcmMsICdwdWJsaWNMb2NhbFZhcmlhYmxlcycpLCAndmFyaWFibGVzJykpIHtcbiAgICAgIGNvbnN0IHRhZyA9IHBhcnNlWEVGVmFyaWFibGUodiwgdW5tYXBwZWQpO1xuICAgICAgaWYgKHRhZykgbG9jYWxUYWdzLnB1c2godGFnKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB2IG9mIGNoaWxkQXJyYXkoY2hpbGQoZmJTcmMsICdwcml2YXRlTG9jYWxWYXJpYWJsZXMnKSwgJ3ZhcmlhYmxlcycpKSB7XG4gICAgICBjb25zdCB0YWcgPSBwYXJzZVhFRlZhcmlhYmxlKHYsIHVubWFwcGVkKTtcbiAgICAgIGlmICh0YWcpIGxvY2FsVGFncy5wdXNoKHRhZyk7XG4gICAgfVxuICAgIC8vIFBhcnNlIEZCUHJvZ3JhbSBib2R5XG4gICAgY29uc3QgZmJQcm9nRWwgPSBjaGlsZChmYlNyYywgJ0ZCUHJvZ3JhbScpO1xuICAgIGlmIChmYlByb2dFbCkge1xuICAgICAgY29uc3QgZmJkU291cmNlRWwgPSBjaGlsZChmYlByb2dFbCwgJ0ZCRFNvdXJjZScpO1xuICAgICAgaWYgKGZiZFNvdXJjZUVsKSB7XG4gICAgICAgIGNvbnN0IHJlc29sdmVyID0gYnVpbGRSZXNvbHZlcihsb2NhbFRhZ3MsIFtdKTtcbiAgICAgICAgY29uc3QgYm9keUVsID0gY2hpbGQoZmJkU291cmNlRWwsICduZXR3b3JrRkJEJykgPz8gZmJkU291cmNlRWw7XG4gICAgICAgIGNvbnN0IGZiZCA9IHBhcnNlWEVGRkJEKGJvZHlFbCwgZmJUeXBlTmFtZSwgdW5tYXBwZWQsIHJlc29sdmVyKTtcbiAgICAgICAgY29uc3QgbmJSb3dzID0gYXR0cihmYmRTb3VyY2VFbCwgJ25iUm93cycpO1xuICAgICAgICBjb25zdCBuYkNvbHVtbnMgPSBhdHRyKGZiZFNvdXJjZUVsLCAnbmJDb2x1bW5zJyk7XG4gICAgICAgIGlmIChuYlJvd3MgfHwgbmJDb2x1bW5zKSAoZmJkIGFzIGFueSkuX3hlZkdyaWQgPSB7IG5iUm93cywgbmJDb2x1bW5zIH07XG4gICAgICAgIHBvdXMucHVzaCh7IGlkOiBgcG91LSR7ZmJUeXBlTmFtZX1gLCBuYW1lOiBmYlR5cGVOYW1lLCBsYW5ndWFnZTogJ0ZCRCcsIGZiZFByb2dyYW06IGZiZCwgbG9jYWxUYWdzLCBwb3VUeXBlOiAnZnVuY3Rpb25CbG9jaycgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBzdFNyYyA9IHRleHQoY2hpbGQoZmJQcm9nRWwsICdTVFNvdXJjZScpID8/IGZiUHJvZ0VsKTtcbiAgICAgICAgcG91cy5wdXNoKHsgaWQ6IGBwb3UtJHtmYlR5cGVOYW1lfWAsIG5hbWU6IGZiVHlwZU5hbWUsIGxhbmd1YWdlOiAnU1QnLCBzdFNvdXJjZTogc3RTcmMgPyB1bmVzY2FwZVhNTChzdFNyYykgOiAnJywgbG9jYWxUYWdzLCBwb3VUeXBlOiAnZnVuY3Rpb25CbG9jaycgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gQnVnIDQ6IFByb2dyYW1zIFx1MjAxNCByZWFsIFhFRiBoYXMgPHByb2dyYW0+IGRpcmVjdGx5IHVuZGVyIDxGRUZFeGNoYW5nZUZpbGU+LCBubyB3cmFwcGVyXG4gIGNvbnN0IGRpcmVjdFByb2dyYW1zID0gY2hpbGRBcnJheShmZWZSb290LCAncHJvZ3JhbScpO1xuICBpZiAoZGlyZWN0UHJvZ3JhbXMubGVuZ3RoID4gMCkge1xuICAgIGZvciAoY29uc3QgcHJvZ3JhbUVsIG9mIGRpcmVjdFByb2dyYW1zKSB7XG4gICAgICBjb25zdCBwb3UgPSBwYXJzZVhFRlByb2dyYW1GRUYocHJvZ3JhbUVsLCB1bm1hcHBlZCwgd2FybmluZ3MpO1xuICAgICAgaWYgKHBvdSkgcG91cy5wdXNoKHBvdSk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBvbGRlciBmb3JtYXQgd2l0aCBQcm9ncmFtcyB3cmFwcGVyXG4gICAgY29uc3QgZGF0YUVsID0gY2hpbGQocHJvamVjdEZpbGUsICdEYXRhJykgPz8gcHJvamVjdEZpbGU7XG4gICAgY29uc3QgcHJvZ3JhbXNFbCA9IGNoaWxkKGRhdGFFbCwgJ1Byb2dyYW1zJykgPz8gY2hpbGQocHJvamVjdEZpbGUsICdQcm9ncmFtcycpO1xuICAgIGZvciAoY29uc3QgcHJvZ3JhbUVsIG9mIGNoaWxkQXJyYXkocHJvZ3JhbXNFbCwgJ1Byb2dyYW0nKS5jb25jYXQoY2hpbGRBcnJheShwcm9ncmFtc0VsLCAnUE9VJykpKSB7XG4gICAgICBjb25zdCBwb3UgPSBwYXJzZVhFRlByb2dyYW0ocHJvZ3JhbUVsLCB1bm1hcHBlZCwgd2FybmluZ3MpO1xuICAgICAgaWYgKHBvdSkgcG91cy5wdXNoKHBvdSk7XG4gICAgfVxuICB9XG5cbiAgLy8gQWxzbyBjaGVjayBkaXJlY3Qgc2VjdGlvbnMgKGxlZ2FjeSBmb3JtYXQpXG4gIGNvbnN0IF9kYXRhRWxGb3JTZWN0aW9ucyA9IGNoaWxkKHByb2plY3RGaWxlLCAnRGF0YScpID8/IHByb2plY3RGaWxlO1xuICBmb3IgKGNvbnN0IHNlY3Rpb24gb2YgY2hpbGRBcnJheShfZGF0YUVsRm9yU2VjdGlvbnMsICdTZWN0aW9uJykuY29uY2F0KGNoaWxkQXJyYXkocHJvamVjdEZpbGUsICdTZWN0aW9uJykpKSB7XG4gICAgY29uc3Qgc2VjdGlvblR5cGUgPSBhdHRyKHNlY3Rpb24sICdUeXBlJykgfHwgYXR0cihzZWN0aW9uLCAnbGFuZ3VhZ2UnKSB8fCAnJztcbiAgICBjb25zdCBzZWN0aW9uTmFtZSA9IGF0dHIoc2VjdGlvbiwgJ05hbWUnKSB8fCBhdHRyKHNlY3Rpb24sICduYW1lJykgfHwgJ1NlY3Rpb24nO1xuXG4gICAgaWYgKHNlY3Rpb25UeXBlLnRvVXBwZXJDYXNlKCkgPT09ICdMRCcgfHwgc2VjdGlvblR5cGUudG9VcHBlckNhc2UoKSA9PT0gJ0xBRERFUicpIHtcbiAgICAgIGNvbnN0IGxhZGRlciA9IHBhcnNlWEVGTGFkZGVyKHNlY3Rpb24sIHNlY3Rpb25OYW1lLCB1bm1hcHBlZCk7XG4gICAgICBwb3VzLnB1c2goeyBpZDogYHBvdS0ke3NlY3Rpb25OYW1lfWAsIG5hbWU6IHNlY3Rpb25OYW1lLCBsYW5ndWFnZTogJ0xEJywgbGFkZGVyUHJvZ3JhbTogbGFkZGVyLCBsb2NhbFRhZ3M6IFtdIH0pO1xuICAgIH0gZWxzZSBpZiAoc2VjdGlvblR5cGUudG9VcHBlckNhc2UoKSA9PT0gJ0ZCRCcpIHtcbiAgICAgIGNvbnN0IGZiZCA9IHBhcnNlWEVGRkJEKHNlY3Rpb24sIHNlY3Rpb25OYW1lLCB1bm1hcHBlZCk7XG4gICAgICBwb3VzLnB1c2goeyBpZDogYHBvdS0ke3NlY3Rpb25OYW1lfWAsIG5hbWU6IHNlY3Rpb25OYW1lLCBsYW5ndWFnZTogJ0ZCRCcsIGZiZFByb2dyYW06IGZiZCwgbG9jYWxUYWdzOiBbXSB9KTtcbiAgICB9IGVsc2UgaWYgKHNlY3Rpb25UeXBlLnRvVXBwZXJDYXNlKCkgPT09ICdTRkMnKSB7XG4gICAgICBjb25zdCBzZmMgPSBwYXJzZVhFRlNGQyhzZWN0aW9uLCBzZWN0aW9uTmFtZSwgdW5tYXBwZWQpO1xuICAgICAgcG91cy5wdXNoKHsgaWQ6IGBwb3UtJHtzZWN0aW9uTmFtZX1gLCBuYW1lOiBzZWN0aW9uTmFtZSwgbGFuZ3VhZ2U6ICdTRkMnLCBzZmNQcm9ncmFtOiBzZmMsIGxvY2FsVGFnczogW10gfSk7XG4gICAgfSBlbHNlIGlmIChzZWN0aW9uVHlwZS50b1VwcGVyQ2FzZSgpID09PSAnU1QnIHx8IHNlY3Rpb25UeXBlLnRvVXBwZXJDYXNlKCkgPT09ICdJTCcpIHtcbiAgICAgIGNvbnN0IHJhd1N0U3JjID0gdGV4dChjaGlsZChzZWN0aW9uLCAnQm9keScpID8/IHNlY3Rpb24pO1xuICAgICAgY29uc3Qgc3RTcmMgPSByYXdTdFNyYyA/IHVuZXNjYXBlWE1MKHJhd1N0U3JjKSA6IHJhd1N0U3JjO1xuICAgICAgaWYgKHNlY3Rpb25UeXBlLnRvVXBwZXJDYXNlKCkgPT09ICdJTCcpIHtcbiAgICAgICAgd2FybmluZ3MucHVzaChgU2VjdGlvbiBcIiR7c2VjdGlvbk5hbWV9XCIgdXNlcyBJTCBcdTIwMTQgaW1wb3J0aW5nIGFzIFNUIHRleHQgKHJldmlldyByZXF1aXJlZClgKTtcbiAgICAgIH1cbiAgICAgIHBvdXMucHVzaCh7IGlkOiBgcG91LSR7c2VjdGlvbk5hbWV9YCwgbmFtZTogc2VjdGlvbk5hbWUsIGxhbmd1YWdlOiAnU1QnLCBzdFNvdXJjZTogc3RTcmMsIGxvY2FsVGFnczogW10gfSk7XG4gICAgfSBlbHNlIGlmIChzZWN0aW9uVHlwZSkge1xuICAgICAgdW5tYXBwZWQucHVzaCh7IGNsbU5vZGVJZDogbnVsbCwgdmVuZG9yU3BlY2lmaWNEYXRhOiBzZWN0aW9uLCByZWFzb246IGBVbmtub3duIHNlY3Rpb24gdHlwZTogJHtzZWN0aW9uVHlwZX1gIH0pO1xuICAgIH1cbiAgfVxuXG4gIGlmIChwb3VzLmxlbmd0aCA9PT0gMCAmJiBnbG9iYWxUYWdzLmxlbmd0aCA9PT0gMCkge1xuICAgIGVycm9ycy5wdXNoKCdObyBwcm9ncmFtcywgUE9Vcywgb3IgdGFncyBmb3VuZCBpbiBYRUYgZmlsZScpO1xuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3JzLCB3YXJuaW5ncyB9O1xuICB9XG5cbiAgY29uc3Qgc2lkZWNhcjogVmVuZG9yTWV0YWRhdGFTaWRlY2FyID0ge1xuICAgIHNvdXJjZVZlbmRvcjogJ3NjaG5laWRlcl94ZWYnLFxuICAgIHNvdXJjZUZpbGVWZXJzaW9uOiB2ZXJzaW9uLFxuICAgIG9yaWdpbmFsRmlsZVBhdGg6IGZpbGVQYXRoLFxuICAgIHVubWFwcGVkRWxlbWVudHM6IHVubWFwcGVkLFxuICAgIG9yZ2FuaXplclRyZWVMYXlvdXQ6IGZlZlJvb3QsXG4gICAgdmVuZG9yU3BlY2lmaWNHbG9iYWxzOiB7IHZlcnNpb24sIHByb2plY3ROYW1lOiBhdHRyKHByb2plY3RGaWxlLCAnTmFtZScpIH0sXG4gIH07XG5cbiAgcmV0dXJuIHsgb2s6IHRydWUsIHByb2plY3Q6IHsgcHJvamVjdE5hbWUsIHBvdXMsIGdsb2JhbFRhZ3MsIHNpZGVjYXIgfSwgZXJyb3JzLCB3YXJuaW5ncyB9O1xufVxuXG4vLyBFeHBvcnRlZCBmb3IgWkVGIGZpbGVzIFx1MjAxNCBjYWxsIHdpdGggcHJlLWRlY29tcHJlc3NlZCBjb250ZW50XG5leHBvcnQgeyBkZWNvbXByZXNzWkVGIH07XG5cbmZ1bmN0aW9uIHBhcnNlWEVGVmFyaWFibGUodmFyRWw6IHVua25vd24sIHVubWFwcGVkOiBVbm1hcHBlZEVsZW1lbnRbXSk6IE5vcm1hbGl6ZWRUYWcgfCBudWxsIHtcbiAgaWYgKCF2YXJFbCB8fCB0eXBlb2YgdmFyRWwgIT09ICdvYmplY3QnKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgbmFtZSA9IGF0dHIodmFyRWwsICduYW1lJykgfHwgYXR0cih2YXJFbCwgJ05hbWUnKTtcbiAgaWYgKCFuYW1lKSByZXR1cm4gbnVsbDtcbiAgLy8gQnVnIDM6IHR5cGVOYW1lIGZpcnN0IChyZWFsIFhFRiksIHRoZW4gbGVnYWN5IFR5cGUvdHlwZVxuICBjb25zdCB0eXBlU3RyID0gYXR0cih2YXJFbCwgJ3R5cGVOYW1lJykgfHwgYXR0cih2YXJFbCwgJ1R5cGUnKSB8fCBhdHRyKHZhckVsLCAndHlwZScpIHx8ICdCT09MJztcbiAgY29uc3QgZGF0YVR5cGUgPSBzY2huZWlkZXJUeXBlVG9JRUModHlwZVN0cik7XG4gIC8vIEJ1ZyAzOiB0b3BvbG9naWNhbEFkZHJlc3MgZmlyc3QgKHJlYWwgWEVGKSwgdGhlbiBsZWdhY3lcbiAgY29uc3QgYWRkcmVzcyA9IGF0dHIodmFyRWwsICd0b3BvbG9naWNhbEFkZHJlc3MnKSB8fCBhdHRyKHZhckVsLCAnQWRkcmVzcycpIHx8IGF0dHIodmFyRWwsICdUb3BvbG9naWNhbCcpIHx8IHVuZGVmaW5lZDtcbiAgLy8gQnVnIDM6IHZhcmlhYmxlSW5pdCBjaGlsZCB2YWx1ZSBmaXJzdCwgdGhlbiBsZWdhY3lcbiAgY29uc3QgaW5pdFZhbCA9IGF0dHIoY2hpbGQodmFyRWwsICd2YXJpYWJsZUluaXQnKSwgJ3ZhbHVlJykgfHwgYXR0cih2YXJFbCwgJ0luaXRpYWxWYWx1ZScpIHx8IHRleHQoY2hpbGQodmFyRWwsICdJbml0aWFsVmFsdWUnKSkgfHwgdW5kZWZpbmVkO1xuICAvLyBCdWcgMzogbG93ZXJjYXNlIGNvbW1lbnQgZmlyc3QgKHJlYWwgWEVGKSwgdGhlbiBsZWdhY3lcbiAgY29uc3QgZGVzYyA9IHRleHQoY2hpbGQodmFyRWwsICdjb21tZW50JykgPz8gY2hpbGQodmFyRWwsICdDb21tZW50JykgPz8gY2hpbGQodmFyRWwsICdEZXNjcmlwdGlvbicpKSB8fCB1bmRlZmluZWQ7XG5cbiAgLy8gUHJlc2VydmUgYXR0cmlidXRlIGNoaWxkcmVuIChUaW1lU3RhbXBTb3VyY2UsIEREVFNvdXJjZSwgUG9zaXRpb25QaW4sIGV0Yy4pXG4gIGNvbnN0IGF0dHJpYnV0ZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz5bXSA9IFtdO1xuICBmb3IgKGNvbnN0IGF0dHJFbCBvZiBjaGlsZEFycmF5KHZhckVsLCAnYXR0cmlidXRlJykpIHtcbiAgICBjb25zdCBhdHRyTmFtZSA9IGF0dHIoYXR0ckVsLCAnbmFtZScpO1xuICAgIGNvbnN0IGF0dHJWYWx1ZSA9IGF0dHIoYXR0ckVsLCAndmFsdWUnKTtcbiAgICBpZiAoYXR0ck5hbWUpIGF0dHJpYnV0ZXMucHVzaCh7IG5hbWU6IGF0dHJOYW1lLCB2YWx1ZTogYXR0clZhbHVlIHx8ICcnIH0pO1xuICB9XG5cbiAgaWYgKHR5cGVTdHIudG9VcHBlckNhc2UoKSA9PT0gJ0VCT09MJykge1xuICAgIHVubWFwcGVkLnB1c2goeyBjbG1Ob2RlSWQ6IG5hbWUsIHZlbmRvclNwZWNpZmljRGF0YTogeyBvcmlnaW5hbFR5cGU6ICdFQk9PTCcgfSwgcmVhc29uOiAnRUJPT0wgbWFwcGVkIHRvIEJPT0wgKGVkZ2UgYml0IHNlbWFudGljcyBsb3N0KScgfSk7XG4gIH1cblxuICBjb25zdCB0YWc6IE5vcm1hbGl6ZWRUYWcgPSB7IG5hbWUsIGRhdGFUeXBlLCBpbml0aWFsVmFsdWU6IGluaXRWYWwsIGRlc2NyaXB0aW9uOiBkZXNjLCBhZGRyZXNzIH07XG4gIC8vIFN0YXNoIHZlbmRvci1zcGVjaWZpYyBhdHRyaWJ1dGVzIGZvciByb3VuZC10cmlwXG4gIGlmIChhdHRyaWJ1dGVzLmxlbmd0aCA+IDAgfHwgdHlwZVN0ci50b1VwcGVyQ2FzZSgpID09PSAnRUJPT0wnKSB7XG4gICAgKHRhZyBhcyBhbnkpLl94ZWZNZXRhID0geyBvcmlnaW5hbFR5cGU6IHR5cGVTdHIsIGF0dHJpYnV0ZXMgfTtcbiAgfVxuICByZXR1cm4gdGFnO1xufVxuXG5mdW5jdGlvbiBwYXJzZVhFRlByb2dyYW0ocHJvZ3JhbUVsOiB1bmtub3duLCB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10sIHdhcm5pbmdzOiBzdHJpbmdbXSk6IE5vcm1hbGl6ZWRQT1UgfCBudWxsIHtcbiAgaWYgKCFwcm9ncmFtRWwgfHwgdHlwZW9mIHByb2dyYW1FbCAhPT0gJ29iamVjdCcpIHJldHVybiBudWxsO1xuICBjb25zdCBuYW1lID0gYXR0cihwcm9ncmFtRWwsICdOYW1lJykgfHwgYXR0cihwcm9ncmFtRWwsICduYW1lJykgfHwgJ1Byb2dyYW0nO1xuICBjb25zdCBsYW5ndWFnZSA9IChhdHRyKHByb2dyYW1FbCwgJ0xhbmd1YWdlJykgfHwgYXR0cihwcm9ncmFtRWwsICdsYW5ndWFnZScpIHx8ICdMRCcpLnRvVXBwZXJDYXNlKCk7XG5cbiAgY29uc3QgbG9jYWxUYWdzOiBOb3JtYWxpemVkVGFnW10gPSBbXTtcbiAgY29uc3QgdmFyc0VsID0gY2hpbGQocHJvZ3JhbUVsLCAnVmFyaWFibGVzJykgPz8gY2hpbGQocHJvZ3JhbUVsLCAnTG9jYWxWYXJzJyk7XG4gIGZvciAoY29uc3QgdiBvZiBjaGlsZEFycmF5KHZhcnNFbCwgJ1ZhcmlhYmxlJykuY29uY2F0KGNoaWxkQXJyYXkodmFyc0VsLCAnVmFyJykpKSB7XG4gICAgY29uc3QgdGFnID0gcGFyc2VYRUZWYXJpYWJsZSh2LCB1bm1hcHBlZCk7XG4gICAgaWYgKHRhZykgbG9jYWxUYWdzLnB1c2godGFnKTtcbiAgfVxuXG4gIGNvbnN0IGJvZHlFbCA9IGNoaWxkKHByb2dyYW1FbCwgJ0JvZHknKSA/PyBwcm9ncmFtRWw7XG5cbiAgY29uc3QgcmVzb2x2ZXIgPSBidWlsZFJlc29sdmVyKGxvY2FsVGFncywgW10pO1xuXG4gIGlmIChsYW5ndWFnZSA9PT0gJ0xEJyB8fCBsYW5ndWFnZSA9PT0gJ0xBRERFUicpIHtcbiAgICBjb25zdCBsYWRkZXIgPSBwYXJzZVhFRkxhZGRlcihib2R5RWwsIG5hbWUsIHVubWFwcGVkLCByZXNvbHZlcik7XG4gICAgcmV0dXJuIHsgaWQ6IGBwb3UtJHtuYW1lfWAsIG5hbWUsIGxhbmd1YWdlOiAnTEQnLCBsYWRkZXJQcm9ncmFtOiBsYWRkZXIsIGxvY2FsVGFncywgcG91VHlwZTogJ3Byb2dyYW0nIH07XG4gIH1cbiAgaWYgKGxhbmd1YWdlID09PSAnRkJEJykge1xuICAgIGNvbnN0IGZiZCA9IHBhcnNlWEVGRkJEKGJvZHlFbCwgbmFtZSwgdW5tYXBwZWQsIHJlc29sdmVyKTtcbiAgICByZXR1cm4geyBpZDogYHBvdS0ke25hbWV9YCwgbmFtZSwgbGFuZ3VhZ2U6ICdGQkQnLCBmYmRQcm9ncmFtOiBmYmQsIGxvY2FsVGFncywgcG91VHlwZTogJ3Byb2dyYW0nIH07XG4gIH1cbiAgaWYgKGxhbmd1YWdlID09PSAnU0ZDJykge1xuICAgIGNvbnN0IHNmYyA9IHBhcnNlWEVGU0ZDKGJvZHlFbCwgbmFtZSwgdW5tYXBwZWQpO1xuICAgIHJldHVybiB7IGlkOiBgcG91LSR7bmFtZX1gLCBuYW1lLCBsYW5ndWFnZTogJ1NGQycsIHNmY1Byb2dyYW06IHNmYywgbG9jYWxUYWdzLCBwb3VUeXBlOiAncHJvZ3JhbScgfTtcbiAgfVxuICBpZiAobGFuZ3VhZ2UgPT09ICdTVCcpIHtcbiAgICBjb25zdCByYXdTcmMgPSB0ZXh0KGJvZHlFbCk7XG4gICAgY29uc3Qgc3JjID0gcmF3U3JjID8gdW5lc2NhcGVYTUwocmF3U3JjKSA6IHJhd1NyYztcbiAgICByZXR1cm4geyBpZDogYHBvdS0ke25hbWV9YCwgbmFtZSwgbGFuZ3VhZ2U6ICdTVCcsIHN0U291cmNlOiBzcmMsIGxvY2FsVGFncywgcG91VHlwZTogJ3Byb2dyYW0nIH07XG4gIH1cbiAgaWYgKGxhbmd1YWdlID09PSAnSUwnKSB7XG4gICAgd2FybmluZ3MucHVzaChgUHJvZ3JhbSBcIiR7bmFtZX1cIjogSUwgbGFuZ3VhZ2UgXHUyMDE0IGltcG9ydGluZyBhcyBTVCBjb21tZW50YCk7XG4gICAgcmV0dXJuIHsgaWQ6IGBwb3UtJHtuYW1lfWAsIG5hbWUsIGxhbmd1YWdlOiAnU1QnLCBzdFNvdXJjZTogYCgqIElMOiAke3RleHQoYm9keUVsKX0gKilgLCBsb2NhbFRhZ3MsIHBvdVR5cGU6ICdwcm9ncmFtJyB9O1xuICB9XG5cbiAgdW5tYXBwZWQucHVzaCh7IGNsbU5vZGVJZDogbnVsbCwgdmVuZG9yU3BlY2lmaWNEYXRhOiBwcm9ncmFtRWwsIHJlYXNvbjogYFByb2dyYW0gXCIke25hbWV9XCI6IHVua25vd24gbGFuZ3VhZ2UgJHtsYW5ndWFnZX1gIH0pO1xuICByZXR1cm4gbnVsbDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEZFRiAocmVhbCBYRUYpIHByb2dyYW0gcGFyc2VyIFx1MjAxNCBCdWdzIDQsIDUsIDYsIDEzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBwYXJzZVhFRlByb2dyYW1GRUYocHJvZ3JhbUVsOiB1bmtub3duLCB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10sIHdhcm5pbmdzOiBzdHJpbmdbXSk6IE5vcm1hbGl6ZWRQT1UgfCBudWxsIHtcbiAgaWYgKCFwcm9ncmFtRWwgfHwgdHlwZW9mIHByb2dyYW1FbCAhPT0gJ29iamVjdCcpIHJldHVybiBudWxsO1xuXG4gIC8vIEJ1ZyA0OiBpZGVudGl0eSBjb21lcyBmcm9tIDxpZGVudFByb2dyYW0+IGNoaWxkXG4gIGNvbnN0IGlkZW50RWwgPSBjaGlsZChwcm9ncmFtRWwsICdpZGVudFByb2dyYW0nKTtcbiAgY29uc3QgbmFtZSA9IGF0dHIoaWRlbnRFbCwgJ25hbWUnKSB8fCBhdHRyKHByb2dyYW1FbCwgJ05hbWUnKSB8fCBhdHRyKHByb2dyYW1FbCwgJ25hbWUnKSB8fCAnUHJvZ3JhbSc7XG4gIGNvbnN0IHRhc2sgPSBhdHRyKGlkZW50RWwsICd0YXNrJykgfHwgJ01BU1QnO1xuICBjb25zdCBzZWN0aW9uVHlwZSA9IGF0dHIoaWRlbnRFbCwgJ3R5cGUnKSB8fCAnc2VjdGlvbic7XG5cbiAgLy8gQnVnIDU6IGRldGVjdCBsYW5ndWFnZSBmcm9tIGJvZHkgZWxlbWVudCBwcmVzZW5jZVxuICBjb25zdCBsYW5ndWFnZSA9IGNoaWxkKHByb2dyYW1FbCwgJ0ZCRFNvdXJjZScpID8gJ0ZCRCdcbiAgICA6IGNoaWxkKHByb2dyYW1FbCwgJ0xEU291cmNlJykgPyAnTEQnXG4gICAgOiBjaGlsZChwcm9ncmFtRWwsICdTRkNTb3VyY2UnKSA/ICdTRkMnXG4gICAgOiBjaGlsZChwcm9ncmFtRWwsICdTVFNvdXJjZScpID8gJ1NUJ1xuICAgIDogJ1NUJztcblxuICAvLyBCdWcgMTM6IGxvY2FsIHZhcmlhYmxlcyBmcm9tIHB1YmxpY0xvY2FsVmFyaWFibGVzIGFuZCBwcml2YXRlTG9jYWxWYXJpYWJsZXNcbiAgY29uc3QgbG9jYWxUYWdzOiBOb3JtYWxpemVkVGFnW10gPSBbXTtcbiAgY29uc3QgcHVibGljVmFycyA9IGNoaWxkKHByb2dyYW1FbCwgJ3B1YmxpY0xvY2FsVmFyaWFibGVzJyk7XG4gIGNvbnN0IHByaXZhdGVWYXJzID0gY2hpbGQocHJvZ3JhbUVsLCAncHJpdmF0ZUxvY2FsVmFyaWFibGVzJyk7XG4gIGNvbnN0IGxvY2FsVmFyRWxzID0gW1xuICAgIC4uLihwdWJsaWNWYXJzID8gY2hpbGRBcnJheShwdWJsaWNWYXJzLCAndmFyaWFibGVzJykgOiBbXSksXG4gICAgLi4uKHByaXZhdGVWYXJzID8gY2hpbGRBcnJheShwcml2YXRlVmFycywgJ3ZhcmlhYmxlcycpIDogW10pLFxuICBdO1xuICBmb3IgKGNvbnN0IHYgb2YgbG9jYWxWYXJFbHMpIHtcbiAgICBjb25zdCB0YWcgPSBwYXJzZVhFRlZhcmlhYmxlKHYsIHVubWFwcGVkKTtcbiAgICBpZiAodGFnKSBsb2NhbFRhZ3MucHVzaCh0YWcpO1xuICB9XG5cbiAgY29uc3QgcmVzb2x2ZXIgPSBidWlsZFJlc29sdmVyKGxvY2FsVGFncywgW10pO1xuXG4gIGlmIChsYW5ndWFnZSA9PT0gJ0ZCRCcpIHtcbiAgICAvLyBCdWcgNjogdW53cmFwIEZCRFNvdXJjZSAtPiBuZXR3b3JrRkJEXG4gICAgY29uc3QgZmJkU291cmNlRWwgPSBjaGlsZChwcm9ncmFtRWwsICdGQkRTb3VyY2UnKTtcbiAgICBjb25zdCBib2R5RWwgPSBjaGlsZChmYmRTb3VyY2VFbCwgJ25ldHdvcmtGQkQnKSA/PyBmYmRTb3VyY2VFbDtcbiAgICBjb25zdCBmYmQgPSBwYXJzZVhFRkZCRChib2R5RWwsIG5hbWUsIHVubWFwcGVkLCByZXNvbHZlcik7XG4gICAgLy8gUHJlc2VydmUgRkJEU291cmNlIGdyaWQgZGltZW5zaW9ucyBmb3Igcm91bmQtdHJpcFxuICAgIGNvbnN0IG5iUm93cyA9IGF0dHIoZmJkU291cmNlRWwsICduYlJvd3MnKTtcbiAgICBjb25zdCBuYkNvbHVtbnMgPSBhdHRyKGZiZFNvdXJjZUVsLCAnbmJDb2x1bW5zJyk7XG4gICAgaWYgKG5iUm93cyB8fCBuYkNvbHVtbnMpIHtcbiAgICAgIChmYmQgYXMgYW55KS5feGVmR3JpZCA9IHsgbmJSb3dzLCBuYkNvbHVtbnMgfTtcbiAgICB9XG4gICAgY29uc3QgcG91OiBOb3JtYWxpemVkUE9VID0geyBpZDogYHBvdS0ke25hbWV9YCwgbmFtZSwgbGFuZ3VhZ2U6ICdGQkQnLCBmYmRQcm9ncmFtOiBmYmQsIGxvY2FsVGFncywgcG91VHlwZTogJ3Byb2dyYW0nIH07XG4gICAgKHBvdSBhcyBhbnkpLl94ZWZNZXRhID0geyB0YXNrLCBzZWN0aW9uVHlwZSB9O1xuICAgIHJldHVybiBwb3U7XG4gIH1cbiAgaWYgKGxhbmd1YWdlID09PSAnTEQnKSB7XG4gICAgY29uc3QgbGRTb3VyY2VFbCA9IGNoaWxkKHByb2dyYW1FbCwgJ0xEU291cmNlJyk7XG4gICAgY29uc3QgbGFkZGVyID0gcGFyc2VYRUZMYWRkZXIobGRTb3VyY2VFbCA/PyBwcm9ncmFtRWwsIG5hbWUsIHVubWFwcGVkLCByZXNvbHZlcik7XG4gICAgY29uc3QgcG91OiBOb3JtYWxpemVkUE9VID0geyBpZDogYHBvdS0ke25hbWV9YCwgbmFtZSwgbGFuZ3VhZ2U6ICdMRCcsIGxhZGRlclByb2dyYW06IGxhZGRlciwgbG9jYWxUYWdzLCBwb3VUeXBlOiAncHJvZ3JhbScgfTtcbiAgICAocG91IGFzIGFueSkuX3hlZk1ldGEgPSB7IHRhc2ssIHNlY3Rpb25UeXBlIH07XG4gICAgcmV0dXJuIHBvdTtcbiAgfVxuICBpZiAobGFuZ3VhZ2UgPT09ICdTRkMnKSB7XG4gICAgY29uc3Qgc2ZjU291cmNlRWwgPSBjaGlsZChwcm9ncmFtRWwsICdTRkNTb3VyY2UnKTtcbiAgICBjb25zdCBzZmMgPSBwYXJzZVhFRlNGQyhzZmNTb3VyY2VFbCA/PyBwcm9ncmFtRWwsIG5hbWUsIHVubWFwcGVkKTtcbiAgICBjb25zdCBwb3U6IE5vcm1hbGl6ZWRQT1UgPSB7IGlkOiBgcG91LSR7bmFtZX1gLCBuYW1lLCBsYW5ndWFnZTogJ1NGQycsIHNmY1Byb2dyYW06IHNmYywgbG9jYWxUYWdzLCBwb3VUeXBlOiAncHJvZ3JhbScgfTtcbiAgICAocG91IGFzIGFueSkuX3hlZk1ldGEgPSB7IHRhc2ssIHNlY3Rpb25UeXBlIH07XG4gICAgcmV0dXJuIHBvdTtcbiAgfVxuICBpZiAobGFuZ3VhZ2UgPT09ICdTVCcpIHtcbiAgICBjb25zdCBzdFNvdXJjZUVsID0gY2hpbGQocHJvZ3JhbUVsLCAnU1RTb3VyY2UnKTtcbiAgICBjb25zdCByYXdTcmMgPSB0ZXh0KHN0U291cmNlRWwgPz8gcHJvZ3JhbUVsKTtcbiAgICBjb25zdCBzcmMgPSByYXdTcmMgPyB1bmVzY2FwZVhNTChyYXdTcmMpIDogcmF3U3JjO1xuICAgIGNvbnN0IHBvdTogTm9ybWFsaXplZFBPVSA9IHsgaWQ6IGBwb3UtJHtuYW1lfWAsIG5hbWUsIGxhbmd1YWdlOiAnU1QnLCBzdFNvdXJjZTogc3JjLCBsb2NhbFRhZ3MsIHBvdVR5cGU6ICdwcm9ncmFtJyB9O1xuICAgIChwb3UgYXMgYW55KS5feGVmTWV0YSA9IHsgdGFzaywgc2VjdGlvblR5cGUgfTtcbiAgICByZXR1cm4gcG91O1xuICB9XG5cbiAgd2FybmluZ3MucHVzaChgUHJvZ3JhbSBcIiR7bmFtZX1cIjogdW5yZWNvZ25pc2VkIGxhbmd1YWdlIFwiJHtsYW5ndWFnZX1cIiBcdTIwMTQgc2tpcHBlZGApO1xuICByZXR1cm4gbnVsbDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFhFRiBMYWRkZXIgcGFyc2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBwYXJzZVhFRkxhZGRlcihib2R5RWw6IHVua25vd24sIHBvdU5hbWU6IHN0cmluZywgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdLCByZXNvbHZlcjogVmFyaWFibGVUeXBlUmVzb2x2ZXIgPSBuZXcgVmFyaWFibGVUeXBlUmVzb2x2ZXIoKSk6IExhZGRlclByb2dyYW0ge1xuICBjb25zdCBydW5nczogUnVuZ1tdID0gW107XG4gIGxldCBydW5nSWR4ID0gMDtcblxuICBmb3IgKGNvbnN0IHJ1bmdFbCBvZiBjaGlsZEFycmF5KGJvZHlFbCwgJ1J1bmcnKS5jb25jYXQoY2hpbGRBcnJheShib2R5RWwsICdOZXR3b3JrJykpKSB7XG4gICAgcnVuZ0lkeCsrO1xuICAgIGNvbnN0IGNvbW1lbnQgPSB0ZXh0KGNoaWxkKHJ1bmdFbCwgJ0NvbW1lbnQnKSkgfHwgJyc7XG4gICAgY29uc3QgZWxlbWVudHM6IExhZGRlckVsZW1lbnRbXSA9IFtdO1xuICAgIGxldCBwb3NYID0gMDtcblxuICAgIC8vIENvbnRhY3RzIFx1MjAxNCB3aXRoIGVkZ2UgZGV0ZWN0aW9uIHN1cHBvcnRcbiAgICBmb3IgKGNvbnN0IGN0RWwgb2YgY2hpbGRBcnJheShydW5nRWwsICdDb250YWN0JykuY29uY2F0KGNoaWxkQXJyYXkocnVuZ0VsLCAnQ1QnKSkpIHtcbiAgICAgIGNvbnN0IHRhZ05hbWUgPSBhdHRyKGN0RWwsICdWYXJpYWJsZScpIHx8IGF0dHIoY3RFbCwgJ25hbWUnKSB8fCBgVEFHXyR7cG9zWH1gO1xuICAgICAgY29uc3QgY3RUeXBlID0gKGF0dHIoY3RFbCwgJ1R5cGUnKSB8fCBhdHRyKGN0RWwsICd0eXBlJykgfHwgJycpLnRvVXBwZXJDYXNlKCk7XG4gICAgICBjb25zdCBuZWdhdGVkID0gYXR0cihjdEVsLCAnTmVnYXRlZCcpID09PSAndHJ1ZScgfHwgY3RUeXBlID09PSAnTkMnO1xuXG4gICAgICBsZXQgY29udGFjdFR5cGU6IENvbnRhY3RUeXBlID0gbmVnYXRlZCA/ICdOQycgOiAnTk8nO1xuICAgICAgaWYgKGN0VHlwZSA9PT0gJ1AnIHx8IGN0VHlwZSA9PT0gJ1JFJyB8fCBjdFR5cGUgPT09ICdSSVNJTkcnKSBjb250YWN0VHlwZSA9ICdQX0NPTlRBQ1QnO1xuICAgICAgaWYgKGN0VHlwZSA9PT0gJ04nIHx8IGN0VHlwZSA9PT0gJ0ZFJyB8fCBjdFR5cGUgPT09ICdGQUxMSU5HJykgY29udGFjdFR5cGUgPSAnTl9DT05UQUNUJztcblxuICAgICAgZWxlbWVudHMucHVzaCh7XG4gICAgICAgIGtpbmQ6ICdjb250YWN0JyxcbiAgICAgICAgaWQ6IHVpZChgeGVmLWN0LSR7cnVuZ0lkeH1gKSxcbiAgICAgICAgdHlwZTogY29udGFjdFR5cGUsXG4gICAgICAgIHRhZzogeyBuYW1lOiB0YWdOYW1lLCBkYXRhVHlwZTogcmVzb2x2ZXIucmVzb2x2ZSh0YWdOYW1lKSB9LFxuICAgICAgICBwb3NpdGlvbjogeyB4OiBwb3NYLCB5OiAwIH0sXG4gICAgICB9KTtcbiAgICAgIHBvc1ggKz0gNjA7XG4gICAgfVxuXG4gICAgLy8gQ29pbHNcbiAgICBmb3IgKGNvbnN0IGNvaWxFbCBvZiBjaGlsZEFycmF5KHJ1bmdFbCwgJ0NvaWwnKS5jb25jYXQoY2hpbGRBcnJheShydW5nRWwsICdDTCcpKSkge1xuICAgICAgY29uc3QgdGFnTmFtZSA9IGF0dHIoY29pbEVsLCAnVmFyaWFibGUnKSB8fCBhdHRyKGNvaWxFbCwgJ25hbWUnKSB8fCBgQ09JTF8ke3Bvc1h9YDtcbiAgICAgIGNvbnN0IGNvaWxUeXBlID0gKGF0dHIoY29pbEVsLCAnVHlwZScpIHx8IGF0dHIoY29pbEVsLCAndHlwZScpIHx8ICcnKS50b1VwcGVyQ2FzZSgpO1xuICAgICAgbGV0IHR5cGU6IENvaWxUeXBlID0gJ25vcm1hbCc7XG4gICAgICBpZiAoY29pbFR5cGUgPT09ICdTRVQnIHx8IGNvaWxUeXBlID09PSAnUycpIHR5cGUgPSAnc2V0JztcbiAgICAgIGlmIChjb2lsVHlwZSA9PT0gJ1JFU0VUJyB8fCBjb2lsVHlwZSA9PT0gJ1InKSB0eXBlID0gJ3Jlc2V0JztcbiAgICAgIGlmIChjb2lsVHlwZSA9PT0gJ05FR0FURUQnIHx8IGNvaWxUeXBlID09PSAnLycpIHR5cGUgPSAnbmVnYXRlZCc7XG4gICAgICBpZiAoY29pbFR5cGUgPT09ICdMQVRDSCcgfHwgY29pbFR5cGUgPT09ICdMJykgdHlwZSA9ICdsYXRjaCc7XG4gICAgICBpZiAoY29pbFR5cGUgPT09ICdVTkxBVENIJyB8fCBjb2lsVHlwZSA9PT0gJ1UnKSB0eXBlID0gJ3VubGF0Y2gnO1xuICAgICAgZWxlbWVudHMucHVzaCh7XG4gICAgICAgIGtpbmQ6ICdjb2lsJyxcbiAgICAgICAgaWQ6IHVpZChgeGVmLWNvaWwtJHtydW5nSWR4fWApLFxuICAgICAgICB0eXBlLFxuICAgICAgICB0YWc6IHsgbmFtZTogdGFnTmFtZSwgZGF0YVR5cGU6IHJlc29sdmVyLnJlc29sdmUodGFnTmFtZSkgfSxcbiAgICAgICAgcG9zaXRpb246IHsgeDogcG9zWCwgeTogMCB9LFxuICAgICAgfSk7XG4gICAgICBwb3NYICs9IDYwO1xuICAgIH1cblxuICAgIC8vIEZ1bmN0aW9uIGJsb2Nrc1xuICAgIGZvciAoY29uc3QgZmJFbCBvZiBjaGlsZEFycmF5KHJ1bmdFbCwgJ0Z1bmN0aW9uQmxvY2snKS5jb25jYXQoY2hpbGRBcnJheShydW5nRWwsICdPcGVyYXRvcicpKSkge1xuICAgICAgY29uc3QgdHlwZU5hbWUgPSBhdHRyKGZiRWwsICdUeXBlJykgfHwgYXR0cihmYkVsLCAndHlwZU5hbWUnKSB8fCAnJztcbiAgICAgIGNvbnN0IGluc3RhbmNlTmFtZSA9IGF0dHIoZmJFbCwgJ0luc3RhbmNlJykgfHwgYXR0cihmYkVsLCAnbmFtZScpIHx8IHR5cGVOYW1lO1xuICAgICAgY29uc3QgeGVmRkJNYXA6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgICAgIFRPTjogJ1RPTicsIFRPRjogJ1RPRicsIFRQOiAnVFAnLCBDVFU6ICdDVFUnLCBDVEQ6ICdDVEQnLCBDVFVEOiAnQ1RVRCcsXG4gICAgICAgIFNSOiAnU1InLCBSUzogJ1JTJywgUl9UUklHOiAnUlRSSUcnLCBGX1RSSUc6ICdGVFJJRycsXG4gICAgICB9O1xuICAgICAgY29uc3QgZmJUeXBlID0geGVmRkJNYXBbdHlwZU5hbWUudG9VcHBlckNhc2UoKV0gfHwgdHlwZU5hbWU7XG5cbiAgICAgIC8vIEJ1aWxkIHJhdyBwaW5cdTIxOTJ2YXJpYWJsZSBtYXAgdGhlbiBhcHBseSBjYW5vbmljYWwgdHlwZXNcbiAgICAgIGNvbnN0IHJhd1BpbnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgICAgIGZvciAoY29uc3QgcGluRWwgb2YgY2hpbGRBcnJheShmYkVsLCAnSW5wdXRQaW4nKS5jb25jYXQoY2hpbGRBcnJheShmYkVsLCAnUGluJykpKSB7XG4gICAgICAgIGNvbnN0IHBpbk5hbWUgPSBhdHRyKHBpbkVsLCAnTmFtZScpIHx8IGF0dHIocGluRWwsICduYW1lJykgfHwgYElOJHtPYmplY3Qua2V5cyhyYXdQaW5zKS5sZW5ndGh9YDtcbiAgICAgICAgcmF3UGluc1twaW5OYW1lXSA9IGF0dHIocGluRWwsICdWYXJpYWJsZScpIHx8IGF0dHIocGluRWwsICd2YWx1ZScpIHx8IHBpbk5hbWU7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IHBpbkVsIG9mIGNoaWxkQXJyYXkoZmJFbCwgJ091dHB1dFBpbicpKSB7XG4gICAgICAgIGNvbnN0IHBpbk5hbWUgPSBhdHRyKHBpbkVsLCAnTmFtZScpIHx8IGF0dHIocGluRWwsICduYW1lJykgfHwgYE9VVCR7T2JqZWN0LmtleXMocmF3UGlucykubGVuZ3RofWA7XG4gICAgICAgIHJhd1BpbnNbcGluTmFtZV0gPSBhdHRyKHBpbkVsLCAnVmFyaWFibGUnKSB8fCBhdHRyKHBpbkVsLCAndmFsdWUnKSB8fCBwaW5OYW1lO1xuICAgICAgfVxuICAgICAgY29uc3QgdHlwZWRQaW5zID0gYnVpbGRUeXBlZFRhZ1JlZlBpbnMoZmJUeXBlLCByYXdQaW5zKTtcbiAgICAgIGNvbnN0IHBpbnM6IFJlY29yZDxzdHJpbmcsIHsgbmFtZTogc3RyaW5nOyBkYXRhVHlwZTogc3RyaW5nIH0+ID0ge307XG4gICAgICBmb3IgKGNvbnN0IFtwaW5OYW1lLCBwaW5EZWZdIG9mIE9iamVjdC5lbnRyaWVzKHR5cGVkUGlucykpIHtcbiAgICAgICAgY29uc3QgdmFyTmFtZSA9IHBpbkRlZi5uYW1lO1xuICAgICAgICBjb25zdCByZXNvbHZlZFR5cGUgPSB2YXJOYW1lID8gcmVzb2x2ZXIucmVzb2x2ZSh2YXJOYW1lKSA6IG51bGw7XG4gICAgICAgIHBpbnNbcGluTmFtZV0gPSB7IG5hbWU6IHZhck5hbWUsIGRhdGFUeXBlOiAocmVzb2x2ZWRUeXBlICYmIHJlc29sdmVkVHlwZSAhPT0gJ0JPT0wnKSA/IHJlc29sdmVkVHlwZSA6IHBpbkRlZi5kYXRhVHlwZSB9O1xuICAgICAgfVxuXG4gICAgICBlbGVtZW50cy5wdXNoKHtcbiAgICAgICAga2luZDogJ2Jsb2NrJyxcbiAgICAgICAgaWQ6IHVpZChgeGVmLWZiLSR7cnVuZ0lkeH1gKSxcbiAgICAgICAgZmJUeXBlOiBmYlR5cGUgYXMgYW55LFxuICAgICAgICBpbnN0YW5jZU5hbWUsXG4gICAgICAgIHBpbnMsXG4gICAgICAgIHBvc2l0aW9uOiB7IHg6IHBvc1gsIHk6IDAgfSxcbiAgICAgIH0pO1xuICAgICAgcG9zWCArPSA2MDtcbiAgICB9XG5cbiAgICAvLyBQYXJzZSBicmFuY2ggZWxlbWVudHMgKHBhcmFsbGVsIHBhdGhzKVxuICAgIGNvbnN0IGJyYW5jaGVzOiBpbXBvcnQoJy4uLy4uL2xvZ2ljU3RvcmUuanMnKS5CcmFuY2hbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgYnJhbmNoRWwgb2YgY2hpbGRBcnJheShydW5nRWwsICdCcmFuY2gnKS5jb25jYXQoY2hpbGRBcnJheShydW5nRWwsICdQYXJhbGxlbCcpKSkge1xuICAgICAgY29uc3QgYnJhbmNoRWxlbWVudHM6IExhZGRlckVsZW1lbnRbXSA9IFtdO1xuICAgICAgbGV0IGJQb3NYID0gMDtcblxuICAgICAgZm9yIChjb25zdCBjdEVsIG9mIGNoaWxkQXJyYXkoYnJhbmNoRWwsICdDb250YWN0JykuY29uY2F0KGNoaWxkQXJyYXkoYnJhbmNoRWwsICdDVCcpKSkge1xuICAgICAgICBjb25zdCB0YWdOYW1lID0gYXR0cihjdEVsLCAnVmFyaWFibGUnKSB8fCBhdHRyKGN0RWwsICduYW1lJykgfHwgYFRBR18ke2JQb3NYfWA7XG4gICAgICAgIGNvbnN0IGN0VHlwZSA9IChhdHRyKGN0RWwsICdUeXBlJykgfHwgYXR0cihjdEVsLCAndHlwZScpIHx8ICcnKS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICBjb25zdCBuZWdhdGVkID0gYXR0cihjdEVsLCAnTmVnYXRlZCcpID09PSAndHJ1ZScgfHwgY3RUeXBlID09PSAnTkMnO1xuICAgICAgICBsZXQgY29udGFjdFR5cGU6IENvbnRhY3RUeXBlID0gbmVnYXRlZCA/ICdOQycgOiAnTk8nO1xuICAgICAgICBpZiAoY3RUeXBlID09PSAnUCcgfHwgY3RUeXBlID09PSAnUkUnIHx8IGN0VHlwZSA9PT0gJ1JJU0lORycpIGNvbnRhY3RUeXBlID0gJ1BfQ09OVEFDVCc7XG4gICAgICAgIGlmIChjdFR5cGUgPT09ICdOJyB8fCBjdFR5cGUgPT09ICdGRScgfHwgY3RUeXBlID09PSAnRkFMTElORycpIGNvbnRhY3RUeXBlID0gJ05fQ09OVEFDVCc7XG4gICAgICAgIGJyYW5jaEVsZW1lbnRzLnB1c2goe1xuICAgICAgICAgIGtpbmQ6ICdjb250YWN0JyxcbiAgICAgICAgICBpZDogdWlkKGB4ZWYtYnItY3QtJHtydW5nSWR4fWApLFxuICAgICAgICAgIHR5cGU6IGNvbnRhY3RUeXBlLFxuICAgICAgICAgIHRhZzogeyBuYW1lOiB0YWdOYW1lLCBkYXRhVHlwZTogcmVzb2x2ZXIucmVzb2x2ZSh0YWdOYW1lKSB9LFxuICAgICAgICAgIHBvc2l0aW9uOiB7IHg6IGJQb3NYLCB5OiAwIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBiUG9zWCArPSA2MDtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgZmJFbCBvZiBjaGlsZEFycmF5KGJyYW5jaEVsLCAnRnVuY3Rpb25CbG9jaycpLmNvbmNhdChjaGlsZEFycmF5KGJyYW5jaEVsLCAnT3BlcmF0b3InKSkpIHtcbiAgICAgICAgY29uc3QgdHlwZU5hbWUgPSBhdHRyKGZiRWwsICdUeXBlJykgfHwgYXR0cihmYkVsLCAndHlwZU5hbWUnKSB8fCAnJztcbiAgICAgICAgY29uc3QgaW5zdGFuY2VOYW1lID0gYXR0cihmYkVsLCAnSW5zdGFuY2UnKSB8fCBhdHRyKGZiRWwsICduYW1lJykgfHwgdHlwZU5hbWU7XG4gICAgICAgIGNvbnN0IHhlZkZCTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgICAgIFRPTjogJ1RPTicsIFRPRjogJ1RPRicsIFRQOiAnVFAnLCBDVFU6ICdDVFUnLCBDVEQ6ICdDVEQnLCBDVFVEOiAnQ1RVRCcsXG4gICAgICAgICAgU1I6ICdTUicsIFJTOiAnUlMnLCBSX1RSSUc6ICdSVFJJRycsIEZfVFJJRzogJ0ZUUklHJyxcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgZmJUeXBlID0geGVmRkJNYXBbdHlwZU5hbWUudG9VcHBlckNhc2UoKV0gfHwgdHlwZU5hbWU7XG4gICAgICAgIGNvbnN0IGJyUmF3UGluczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IHBpbkVsIG9mIGNoaWxkQXJyYXkoZmJFbCwgJ0lucHV0UGluJykuY29uY2F0KGNoaWxkQXJyYXkoZmJFbCwgJ1BpbicpKSkge1xuICAgICAgICAgIGNvbnN0IHBpbk5hbWUgPSBhdHRyKHBpbkVsLCAnTmFtZScpIHx8IGF0dHIocGluRWwsICduYW1lJykgfHwgYElOJHtPYmplY3Qua2V5cyhiclJhd1BpbnMpLmxlbmd0aH1gO1xuICAgICAgICAgIGJyUmF3UGluc1twaW5OYW1lXSA9IGF0dHIocGluRWwsICdWYXJpYWJsZScpIHx8IGF0dHIocGluRWwsICd2YWx1ZScpIHx8IHBpbk5hbWU7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYnJUeXBlZFBpbnMgPSBidWlsZFR5cGVkVGFnUmVmUGlucyhmYlR5cGUsIGJyUmF3UGlucyk7XG4gICAgICAgIGNvbnN0IGJyUGluczogUmVjb3JkPHN0cmluZywgeyBuYW1lOiBzdHJpbmc7IGRhdGFUeXBlOiBzdHJpbmcgfT4gPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBbcG4sIHBkXSBvZiBPYmplY3QuZW50cmllcyhiclR5cGVkUGlucykpIHtcbiAgICAgICAgICBjb25zdCB2biA9IHBkLm5hbWU7XG4gICAgICAgICAgY29uc3QgcnQgPSB2biA/IHJlc29sdmVyLnJlc29sdmUodm4pIDogbnVsbDtcbiAgICAgICAgICBiclBpbnNbcG5dID0geyBuYW1lOiB2biwgZGF0YVR5cGU6IChydCAmJiBydCAhPT0gJ0JPT0wnKSA/IHJ0IDogcGQuZGF0YVR5cGUgfTtcbiAgICAgICAgfVxuICAgICAgICBicmFuY2hFbGVtZW50cy5wdXNoKHtcbiAgICAgICAgICBraW5kOiAnYmxvY2snLCBpZDogdWlkKGB4ZWYtYnItZmItJHtydW5nSWR4fWApLFxuICAgICAgICAgIGZiVHlwZTogZmJUeXBlIGFzIGFueSwgaW5zdGFuY2VOYW1lLCBwaW5zOiBiclBpbnMsXG4gICAgICAgICAgcG9zaXRpb246IHsgeDogYlBvc1gsIHk6IDAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGJQb3NYICs9IDYwO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBjb2lsRWwgb2YgY2hpbGRBcnJheShicmFuY2hFbCwgJ0NvaWwnKS5jb25jYXQoY2hpbGRBcnJheShicmFuY2hFbCwgJ0NMJykpKSB7XG4gICAgICAgIGNvbnN0IHRhZ05hbWUgPSBhdHRyKGNvaWxFbCwgJ1ZhcmlhYmxlJykgfHwgYXR0cihjb2lsRWwsICduYW1lJykgfHwgYENPSUxfJHtiUG9zWH1gO1xuICAgICAgICBjb25zdCBjb2lsVHlwZSA9IChhdHRyKGNvaWxFbCwgJ1R5cGUnKSB8fCBhdHRyKGNvaWxFbCwgJ3R5cGUnKSB8fCAnJykudG9VcHBlckNhc2UoKTtcbiAgICAgICAgbGV0IHR5cGU6IENvaWxUeXBlID0gJ25vcm1hbCc7XG4gICAgICAgIGlmIChjb2lsVHlwZSA9PT0gJ1NFVCcgfHwgY29pbFR5cGUgPT09ICdTJykgdHlwZSA9ICdzZXQnO1xuICAgICAgICBpZiAoY29pbFR5cGUgPT09ICdSRVNFVCcgfHwgY29pbFR5cGUgPT09ICdSJykgdHlwZSA9ICdyZXNldCc7XG4gICAgICAgIGlmIChjb2lsVHlwZSA9PT0gJ05FR0FURUQnIHx8IGNvaWxUeXBlID09PSAnLycpIHR5cGUgPSAnbmVnYXRlZCc7XG4gICAgICAgIGlmIChjb2lsVHlwZSA9PT0gJ0xBVENIJyB8fCBjb2lsVHlwZSA9PT0gJ0wnKSB0eXBlID0gJ2xhdGNoJztcbiAgICAgICAgaWYgKGNvaWxUeXBlID09PSAnVU5MQVRDSCcgfHwgY29pbFR5cGUgPT09ICdVJykgdHlwZSA9ICd1bmxhdGNoJztcbiAgICAgICAgYnJhbmNoRWxlbWVudHMucHVzaCh7XG4gICAgICAgICAga2luZDogJ2NvaWwnLFxuICAgICAgICAgIGlkOiB1aWQoYHhlZi1ici1jb2lsLSR7cnVuZ0lkeH1gKSxcbiAgICAgICAgICB0eXBlLFxuICAgICAgICAgIHRhZzogeyBuYW1lOiB0YWdOYW1lLCBkYXRhVHlwZTogcmVzb2x2ZXIucmVzb2x2ZSh0YWdOYW1lKSB9LFxuICAgICAgICAgIHBvc2l0aW9uOiB7IHg6IGJQb3NYLCB5OiAwIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBiUG9zWCArPSA2MDtcbiAgICAgIH1cblxuICAgICAgaWYgKGJyYW5jaEVsZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgYnJhbmNoZXMucHVzaCh7XG4gICAgICAgICAgaWQ6IHVpZChgeGVmLWJyYW5jaC0ke3J1bmdJZHh9YCksXG4gICAgICAgICAgc3RhcnROb2RlSWQ6IGVsZW1lbnRzWzBdPy5pZCB8fCAnJyxcbiAgICAgICAgICBlbmROb2RlSWQ6IGJyYW5jaEVsZW1lbnRzW2JyYW5jaEVsZW1lbnRzLmxlbmd0aCAtIDFdLmlkLFxuICAgICAgICAgIGVsZW1lbnRzOiBicmFuY2hFbGVtZW50cyxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcnVuZ3MucHVzaCh7IGlkOiBgJHtwb3VOYW1lfS1ydW5nLSR7cnVuZ0lkeH1gLCBudW1iZXI6IHJ1bmdJZHgsIGNvbW1lbnQsIGVsZW1lbnRzLCBicmFuY2hlcyB9KTtcbiAgfVxuXG4gIHJldHVybiB7IHJ1bmdzIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBYRUYgRkJEIHBhcnNlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gcGFyc2VYRUZGQkQoYm9keUVsOiB1bmtub3duLCBwb3VOYW1lOiBzdHJpbmcsIHVubWFwcGVkOiBVbm1hcHBlZEVsZW1lbnRbXSwgcmVzb2x2ZXI6IFZhcmlhYmxlVHlwZVJlc29sdmVyID0gbmV3IFZhcmlhYmxlVHlwZVJlc29sdmVyKCkpOiBGQkRQcm9ncmFtIHtcbiAgY29uc3Qgbm9kZXM6IEZCRE5vZGVbXSA9IFtdO1xuICBjb25zdCB3aXJlczogRkJEV2lyZVtdID0gW107XG4gIGxldCBpZHggPSAwO1xuXG4gIC8vIEJ1ZyAxMTogbWFwIGluc3RhbmNlTmFtZSAtPiBnZW5lcmF0ZWQgbm9kZUlkIGZvciB3aXJlIHJlc29sdXRpb25cbiAgY29uc3QgaW5zdGFuY2VOYW1lVG9Ob2RlSWQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG4gIC8vIEJ1ZyA3OiBGRkJCbG9jayAocmVhbCBYRUYpIGZpcnN0LCB0aGVuIEZCRE9iamVjdC9CbG9jayAobGVnYWN5KVxuICBjb25zdCBhbGxCbG9ja0VscyA9IGNoaWxkQXJyYXkoYm9keUVsLCAnRkZCQmxvY2snKVxuICAgIC5jb25jYXQoY2hpbGRBcnJheShib2R5RWwsICdGQkRPYmplY3QnKSlcbiAgICAuY29uY2F0KGNoaWxkQXJyYXkoYm9keUVsLCAnQmxvY2snKSk7XG5cbiAgZm9yIChjb25zdCBibG9ja0VsIG9mIGFsbEJsb2NrRWxzKSB7XG4gICAgLy8gQnVnIDg6IHR5cGVOYW1lIGZpcnN0IChyZWFsIFhFRiksIHRoZW4gbGVnYWN5IFR5cGVcbiAgICBjb25zdCB0eXBlTmFtZSA9IGF0dHIoYmxvY2tFbCwgJ3R5cGVOYW1lJykgfHwgYXR0cihibG9ja0VsLCAnVHlwZScpIHx8IGF0dHIoYmxvY2tFbCwgJ3R5cGUnKSB8fCAnQkxPQ0snO1xuICAgIC8vIEJ1ZyA4OiBpbnN0YW5jZU5hbWUgZmlyc3QgKHJlYWwgWEVGKSwgdGhlbiBsZWdhY3lcbiAgICBjb25zdCBpbnN0YW5jZU5hbWUgPSBhdHRyKGJsb2NrRWwsICdpbnN0YW5jZU5hbWUnKSB8fCBhdHRyKGJsb2NrRWwsICdJbnN0YW5jZScpIHx8IGF0dHIoYmxvY2tFbCwgJ25hbWUnKSB8fCB0eXBlTmFtZTtcbiAgICBjb25zdCBpZCA9IGluc3RhbmNlTmFtZSB8fCBhdHRyKGJsb2NrRWwsICdJZCcpIHx8IFN0cmluZyhpZHgrKyk7XG4gICAgY29uc3Qgbm9kZUlkID0gYHhlZi1mYmQtJHtpZH0tJHtpZHgrK31gO1xuXG4gICAgLy8gQnVnIDExOiByZWdpc3RlciBpbnN0YW5jZU5hbWUgLT4gbm9kZUlkXG4gICAgaWYgKGluc3RhbmNlTmFtZSkgaW5zdGFuY2VOYW1lVG9Ob2RlSWQuc2V0KGluc3RhbmNlTmFtZSwgbm9kZUlkKTtcblxuICAgIC8vIEJ1ZyA5OiBvYmpQb3NpdGlvbiBmaXJzdCAocmVhbCBYRUYpLCB0aGVuIFBvc2l0aW9uIChsZWdhY3kpXG4gICAgY29uc3QgcG9zRWwgPSBjaGlsZChibG9ja0VsLCAnb2JqUG9zaXRpb24nKSA/PyBjaGlsZChibG9ja0VsLCAnUG9zaXRpb24nKTtcbiAgICAvLyBCdWcgOTogcG9zWC9wb3NZIGZpcnN0IChyZWFsIFhFRiksIHRoZW4gWC9ZIChsZWdhY3kpXG4gICAgY29uc3QgeCA9IE51bWJlcihhdHRyKHBvc0VsLCAncG9zWCcpIHx8IGF0dHIocG9zRWwsICdYJykgfHwgYXR0cihibG9ja0VsLCAnWCcpIHx8IGF0dHIoYmxvY2tFbCwgJ3gnKSkgfHwgaWR4ICogMTIwO1xuICAgIGNvbnN0IHkgPSBOdW1iZXIoYXR0cihwb3NFbCwgJ3Bvc1knKSB8fCBhdHRyKHBvc0VsLCAnWScpIHx8IGF0dHIoYmxvY2tFbCwgJ1knKSB8fCBhdHRyKGJsb2NrRWwsICd5JykpIHx8IDA7XG5cbiAgICAvLyBQcmVzZXJ2ZSBGRkJCbG9jay1sZXZlbCBhdHRyaWJ1dGVzIGZvciByb3VuZC10cmlwXG4gICAgY29uc3QgYWRkaXRpb25uYWxQaW5OdW1iZXIgPSBhdHRyKGJsb2NrRWwsICdhZGRpdGlvbm5hbFBpbk51bWJlcicpIHx8IGF0dHIoYmxvY2tFbCwgJ2FkZGl0aW9uYWxQaW5OdW1iZXInKTtcbiAgICBjb25zdCBlbkVuTyA9IGF0dHIoYmxvY2tFbCwgJ2VuRW5PJyk7XG4gICAgY29uc3QgYmxvY2tXaWR0aCA9IGF0dHIoYmxvY2tFbCwgJ3dpZHRoJyk7XG4gICAgY29uc3QgYmxvY2tIZWlnaHQgPSBhdHRyKGJsb2NrRWwsICdoZWlnaHQnKTtcblxuICAgIC8vIFN0YXJ0IGZyb20gY2Fub25pY2FsIHNpZ25hdHVyZSBwaW5zLCB0aGVuIHN1cHBsZW1lbnQgd2l0aCBYTUwtZGVjbGFyZWQgcGluc1xuICAgIGNvbnN0IHsgaW5wdXRzOiBzaWdJbnB1dHMsIG91dHB1dHM6IHNpZ091dHB1dHMgfSA9IGJ1aWxkVHlwZWRQaW5zKHR5cGVOYW1lLCBbXSwgbm9kZUlkKTtcbiAgICBjb25zdCBpbnB1dHNCeU5hbWUgPSBuZXcgTWFwKHNpZ0lucHV0cy5tYXAocCA9PiBbcC5uYW1lLCB7IC4uLnAgfV0pKTtcbiAgICBjb25zdCBvdXRwdXRzQnlOYW1lID0gbmV3IE1hcChzaWdPdXRwdXRzLm1hcChwID0+IFtwLm5hbWUsIHsgLi4ucCB9XSkpO1xuXG4gICAgLy8gQnVnIDEwOiBkZXNjcmlwdGlvbkZGQiAtPiBpbnB1dFZhcmlhYmxlL291dHB1dFZhcmlhYmxlIChyZWFsIFhFRilcbiAgICBjb25zdCBkZXNjRkZCID0gY2hpbGQoYmxvY2tFbCwgJ2Rlc2NyaXB0aW9uRkZCJyk7XG4gICAgY29uc3QgZXhlY0FmdGVyID0gYXR0cihkZXNjRkZCLCAnZXhlY0FmdGVyJykgfHwgdW5kZWZpbmVkO1xuICAgIGNvbnN0IGlucHV0UGluRWxzID0gZGVzY0ZGQiA/IGNoaWxkQXJyYXkoZGVzY0ZGQiwgJ2lucHV0VmFyaWFibGUnKSA6IFtdO1xuICAgIGNvbnN0IG91dHB1dFBpbkVscyA9IGRlc2NGRkIgPyBjaGlsZEFycmF5KGRlc2NGRkIsICdvdXRwdXRWYXJpYWJsZScpIDogW107XG5cbiAgICBmb3IgKGNvbnN0IHBpbkVsIG9mIGlucHV0UGluRWxzLmNvbmNhdChjaGlsZEFycmF5KGJsb2NrRWwsICdJbnB1dFBpbicpKS5jb25jYXQoY2hpbGRBcnJheShibG9ja0VsLCAnSW5wdXQnKSkpIHtcbiAgICAgIC8vIEJ1ZyAxMDogZm9ybWFsUGFyYW1ldGVyIGZpcnN0IChyZWFsIFhFRiksIHRoZW4gTmFtZSAobGVnYWN5KVxuICAgICAgY29uc3QgcGluTmFtZSA9IGF0dHIocGluRWwsICdmb3JtYWxQYXJhbWV0ZXInKSB8fCBhdHRyKHBpbkVsLCAnTmFtZScpIHx8IGF0dHIocGluRWwsICduYW1lJykgfHwgYElOJHtpbnB1dHNCeU5hbWUuc2l6ZX1gO1xuICAgICAgY29uc3QgbmVnYXRlZCA9IGF0dHIocGluRWwsICdOZWdhdGVkJykgPT09ICd0cnVlJyB8fCBhdHRyKHBpbkVsLCAnaW52ZXJ0ZWRQaW4nKSA9PT0gJ3RydWUnO1xuICAgICAgY29uc3QgZWZmZWN0aXZlUGFyYW1ldGVyID0gYXR0cihwaW5FbCwgJ2VmZmVjdGl2ZVBhcmFtZXRlcicpIHx8IHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IGNhbm9uaWNhbFR5cGUgPSBnZXRQaW5EYXRhVHlwZSh0eXBlTmFtZSwgcGluTmFtZSwgJ2lucHV0Jyk7XG4gICAgICBjb25zdCBwaW46IGFueSA9IHsgaWQ6IHVpZCgncGluJyksIG5hbWU6IHBpbk5hbWUsIGRhdGFUeXBlOiBjYW5vbmljYWxUeXBlLCBuZWdhdGVkIH07XG4gICAgICBpZiAoZWZmZWN0aXZlUGFyYW1ldGVyKSBwaW4udmFsdWUgPSBlZmZlY3RpdmVQYXJhbWV0ZXI7XG4gICAgICBpbnB1dHNCeU5hbWUuc2V0KHBpbk5hbWUsIHBpbik7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGluRWwgb2Ygb3V0cHV0UGluRWxzLmNvbmNhdChjaGlsZEFycmF5KGJsb2NrRWwsICdPdXRwdXRQaW4nKSkuY29uY2F0KGNoaWxkQXJyYXkoYmxvY2tFbCwgJ091dHB1dCcpKSkge1xuICAgICAgLy8gQnVnIDEwOiBmb3JtYWxQYXJhbWV0ZXIgZmlyc3QgKHJlYWwgWEVGKSwgdGhlbiBOYW1lIChsZWdhY3kpXG4gICAgICBjb25zdCBwaW5OYW1lID0gYXR0cihwaW5FbCwgJ2Zvcm1hbFBhcmFtZXRlcicpIHx8IGF0dHIocGluRWwsICdOYW1lJykgfHwgYXR0cihwaW5FbCwgJ25hbWUnKSB8fCBgT1VUJHtvdXRwdXRzQnlOYW1lLnNpemV9YDtcbiAgICAgIGNvbnN0IG5lZ2F0ZWQgPSBhdHRyKHBpbkVsLCAnaW52ZXJ0ZWRQaW4nKSA9PT0gJ3RydWUnO1xuICAgICAgY29uc3QgZWZmZWN0aXZlUGFyYW1ldGVyID0gYXR0cihwaW5FbCwgJ2VmZmVjdGl2ZVBhcmFtZXRlcicpIHx8IHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IGNhbm9uaWNhbFR5cGUgPSBnZXRQaW5EYXRhVHlwZSh0eXBlTmFtZSwgcGluTmFtZSwgJ291dHB1dCcpO1xuICAgICAgY29uc3QgcGluOiBhbnkgPSB7IGlkOiB1aWQoJ3BpbicpLCBuYW1lOiBwaW5OYW1lLCBkYXRhVHlwZTogY2Fub25pY2FsVHlwZSB9O1xuICAgICAgaWYgKG5lZ2F0ZWQpIHBpbi5uZWdhdGVkID0gdHJ1ZTtcbiAgICAgIGlmIChlZmZlY3RpdmVQYXJhbWV0ZXIpIHBpbi52YWx1ZSA9IGVmZmVjdGl2ZVBhcmFtZXRlcjtcbiAgICAgIG91dHB1dHNCeU5hbWUuc2V0KHBpbk5hbWUsIHBpbik7XG4gICAgfVxuXG4gICAgY29uc3QgaW5wdXRzID0gWy4uLmlucHV0c0J5TmFtZS52YWx1ZXMoKV07XG4gICAgY29uc3Qgb3V0cHV0cyA9IFsuLi5vdXRwdXRzQnlOYW1lLnZhbHVlcygpXTtcbiAgICBpZiAoaW5wdXRzLmxlbmd0aCA9PT0gMCkgaW5wdXRzLnB1c2goeyBpZDogdWlkKCdwaW4nKSwgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdCT09MJyB9KTtcbiAgICBpZiAob3V0cHV0cy5sZW5ndGggPT09IDApIG91dHB1dHMucHVzaCh7IGlkOiB1aWQoJ3BpbicpLCBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9KTtcblxuICAgIGNvbnN0IG5vZGU6IGFueSA9IHtcbiAgICAgIGlkOiBub2RlSWQsXG4gICAgICB0eXBlOiBtYXBTY2huZWlkZXJGQkRUeXBlKHR5cGVOYW1lKSxcbiAgICAgIGluc3RhbmNlTmFtZSxcbiAgICAgIHBvc2l0aW9uOiB7IHgsIHkgfSxcbiAgICAgIGlucHV0cyxcbiAgICAgIG91dHB1dHMsXG4gICAgfTtcbiAgICAvLyBTdGFzaCB2ZW5kb3Itc3BlY2lmaWMgYmxvY2sgYXR0cmlidXRlcyBmb3Igcm91bmQtdHJpcFxuICAgIG5vZGUuX3hlZkJsb2NrID0ge1xuICAgICAgb3JpZ2luYWxUeXBlTmFtZTogdHlwZU5hbWUsXG4gICAgICBhZGRpdGlvbm5hbFBpbk51bWJlcixcbiAgICAgIGVuRW5PLFxuICAgICAgd2lkdGg6IGJsb2NrV2lkdGgsXG4gICAgICBoZWlnaHQ6IGJsb2NrSGVpZ2h0LFxuICAgICAgZXhlY0FmdGVyLFxuICAgIH07XG4gICAgbm9kZXMucHVzaChub2RlKTtcbiAgfVxuXG4gIC8vIFBhcnNlIHN0YW5kYWxvbmUgdmFyaWFibGUgbm9kZXMgKEluVmFyaWFibGUsIE91dFZhcmlhYmxlLCBJbk91dFZhcmlhYmxlKVxuICBmb3IgKGNvbnN0IHZhckVsIG9mIGNoaWxkQXJyYXkoYm9keUVsLCAnSW5WYXJpYWJsZScpLmNvbmNhdChjaGlsZEFycmF5KGJvZHlFbCwgJ2luVmFyaWFibGUnKSkpIHtcbiAgICBjb25zdCBpZCA9IGF0dHIodmFyRWwsICdJZCcpIHx8IFN0cmluZyhpZHgrKyk7XG4gICAgY29uc3QgdmFyTmFtZSA9IGF0dHIodmFyRWwsICdFeHByZXNzaW9uJykgfHwgYXR0cih2YXJFbCwgJ1ZhcmlhYmxlJykgfHwgYXR0cih2YXJFbCwgJ25hbWUnKSB8fCAnJztcbiAgICBjb25zdCB4ID0gTnVtYmVyKGF0dHIoY2hpbGQodmFyRWwsICdQb3NpdGlvbicpLCAnWCcpKSB8fCBpZHggKiAxMjA7XG4gICAgY29uc3QgeSA9IE51bWJlcihhdHRyKGNoaWxkKHZhckVsLCAnUG9zaXRpb24nKSwgJ1knKSkgfHwgMDtcbiAgICBjb25zdCB2YXJUeXBlID0gcmVzb2x2ZXIucmVzb2x2ZSh2YXJOYW1lKTtcbiAgICBub2Rlcy5wdXNoKHtcbiAgICAgIGlkOiBgeGVmLWZiZC0ke2lkfWAsXG4gICAgICB0eXBlOiAnSU5fVkFSSUFCTEUnLFxuICAgICAgdGFnOiB7IG5hbWU6IHZhck5hbWUsIGRhdGFUeXBlOiB2YXJUeXBlIH0sXG4gICAgICBwb3NpdGlvbjogeyB4LCB5IH0sXG4gICAgICBpbnB1dHM6IFtdLFxuICAgICAgb3V0cHV0czogW3sgaWQ6IHVpZCgncGluJyksIG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogdmFyVHlwZSB9XSxcbiAgICB9KTtcbiAgfVxuXG4gIGZvciAoY29uc3QgdmFyRWwgb2YgY2hpbGRBcnJheShib2R5RWwsICdPdXRWYXJpYWJsZScpLmNvbmNhdChjaGlsZEFycmF5KGJvZHlFbCwgJ291dFZhcmlhYmxlJykpKSB7XG4gICAgY29uc3QgaWQgPSBhdHRyKHZhckVsLCAnSWQnKSB8fCBTdHJpbmcoaWR4KyspO1xuICAgIGNvbnN0IHZhck5hbWUgPSBhdHRyKHZhckVsLCAnRXhwcmVzc2lvbicpIHx8IGF0dHIodmFyRWwsICdWYXJpYWJsZScpIHx8IGF0dHIodmFyRWwsICduYW1lJykgfHwgJyc7XG4gICAgY29uc3QgeCA9IE51bWJlcihhdHRyKGNoaWxkKHZhckVsLCAnUG9zaXRpb24nKSwgJ1gnKSkgfHwgaWR4ICogMTIwO1xuICAgIGNvbnN0IHkgPSBOdW1iZXIoYXR0cihjaGlsZCh2YXJFbCwgJ1Bvc2l0aW9uJyksICdZJykpIHx8IDA7XG4gICAgY29uc3QgdmFyVHlwZSA9IHJlc29sdmVyLnJlc29sdmUodmFyTmFtZSk7XG4gICAgbm9kZXMucHVzaCh7XG4gICAgICBpZDogYHhlZi1mYmQtJHtpZH1gLFxuICAgICAgdHlwZTogJ09VVF9WQVJJQUJMRScsXG4gICAgICB0YWc6IHsgbmFtZTogdmFyTmFtZSwgZGF0YVR5cGU6IHZhclR5cGUgfSxcbiAgICAgIHBvc2l0aW9uOiB7IHgsIHkgfSxcbiAgICAgIGlucHV0czogW3sgaWQ6IHVpZCgncGluJyksIG5hbWU6ICdJTicsIGRhdGFUeXBlOiB2YXJUeXBlIH1dLFxuICAgICAgb3V0cHV0czogW10sXG4gICAgfSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IHZhckVsIG9mIGNoaWxkQXJyYXkoYm9keUVsLCAnSW5PdXRWYXJpYWJsZScpLmNvbmNhdChjaGlsZEFycmF5KGJvZHlFbCwgJ2luT3V0VmFyaWFibGUnKSkpIHtcbiAgICBjb25zdCBpZCA9IGF0dHIodmFyRWwsICdJZCcpIHx8IFN0cmluZyhpZHgrKyk7XG4gICAgY29uc3QgdmFyTmFtZSA9IGF0dHIodmFyRWwsICdFeHByZXNzaW9uJykgfHwgYXR0cih2YXJFbCwgJ1ZhcmlhYmxlJykgfHwgYXR0cih2YXJFbCwgJ25hbWUnKSB8fCAnJztcbiAgICBjb25zdCB4ID0gTnVtYmVyKGF0dHIoY2hpbGQodmFyRWwsICdQb3NpdGlvbicpLCAnWCcpKSB8fCBpZHggKiAxMjA7XG4gICAgY29uc3QgeSA9IE51bWJlcihhdHRyKGNoaWxkKHZhckVsLCAnUG9zaXRpb24nKSwgJ1knKSkgfHwgMDtcbiAgICBjb25zdCB2YXJUeXBlID0gcmVzb2x2ZXIucmVzb2x2ZSh2YXJOYW1lKTtcbiAgICBub2Rlcy5wdXNoKHtcbiAgICAgIGlkOiBgeGVmLWZiZC0ke2lkfWAsXG4gICAgICB0eXBlOiAnSU5PVVRfVkFSSUFCTEUnIGFzIEZCREJsb2NrVHlwZSxcbiAgICAgIHRhZzogeyBuYW1lOiB2YXJOYW1lLCBkYXRhVHlwZTogdmFyVHlwZSB9LFxuICAgICAgcG9zaXRpb246IHsgeCwgeSB9LFxuICAgICAgaW5wdXRzOiBbeyBpZDogdWlkKCdwaW4nKSwgbmFtZTogJ0lOJywgZGF0YVR5cGU6IHZhclR5cGUgfV0sXG4gICAgICBvdXRwdXRzOiBbeyBpZDogdWlkKCdwaW4nKSwgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiB2YXJUeXBlIH1dLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gUGFyc2UganVtcE9iamVjdC9sYWJlbE9iamVjdCBhcyBzcGVjaWFsIG5vZGVzIChYRUYgR09UTyBjb25zdHJ1Y3RzKVxuICBmb3IgKGNvbnN0IGptcEVsIG9mIGNoaWxkQXJyYXkoYm9keUVsLCAnanVtcE9iamVjdCcpKSB7XG4gICAgY29uc3QgbGFiZWwgPSBhdHRyKGptcEVsLCAnbGFiZWwnKSB8fCAnJztcbiAgICBjb25zdCBwb3NFbCA9IGNoaWxkKGptcEVsLCAnb2JqUG9zaXRpb24nKTtcbiAgICBjb25zdCB4ID0gTnVtYmVyKGF0dHIocG9zRWwsICdwb3NYJykpIHx8IDA7XG4gICAgY29uc3QgeSA9IE51bWJlcihhdHRyKHBvc0VsLCAncG9zWScpKSB8fCAwO1xuICAgIGNvbnN0IG5vZGVJZCA9IHVpZCgneGVmLWp1bXAnKTtcbiAgICBub2Rlcy5wdXNoKHsgaWQ6IG5vZGVJZCwgdHlwZTogJ01PVkUnIGFzIEZCREJsb2NrVHlwZSwgaW5zdGFuY2VOYW1lOiBgPj4+JHtsYWJlbH1gLCBwb3NpdGlvbjogeyB4LCB5IH0sIGlucHV0czogW3sgaWQ6IHVpZCgncGluJyksIG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnQk9PTCcgfV0sIG91dHB1dHM6IFtdIH0pO1xuICAgIChub2Rlc1tub2Rlcy5sZW5ndGggLSAxXSBhcyBhbnkpLl94ZWZKdW1wID0geyBsYWJlbCB9O1xuICB9XG4gIGZvciAoY29uc3QgbGJsRWwgb2YgY2hpbGRBcnJheShib2R5RWwsICdsYWJlbE9iamVjdCcpKSB7XG4gICAgY29uc3QgbGFiZWwgPSBhdHRyKGxibEVsLCAnbGFiZWwnKSB8fCAnJztcbiAgICBjb25zdCBwb3NFbCA9IGNoaWxkKGxibEVsLCAnb2JqUG9zaXRpb24nKTtcbiAgICBjb25zdCB4ID0gTnVtYmVyKGF0dHIocG9zRWwsICdwb3NYJykpIHx8IDA7XG4gICAgY29uc3QgeSA9IE51bWJlcihhdHRyKHBvc0VsLCAncG9zWScpKSB8fCAwO1xuICAgIGNvbnN0IG5vZGVJZCA9IHVpZCgneGVmLWxhYmVsJyk7XG4gICAgbm9kZXMucHVzaCh7IGlkOiBub2RlSWQsIHR5cGU6ICdNT1ZFJyBhcyBGQkRCbG9ja1R5cGUsIGluc3RhbmNlTmFtZTogYDw8PCR7bGFiZWx9YCwgcG9zaXRpb246IHsgeCwgeSB9LCBpbnB1dHM6IFtdLCBvdXRwdXRzOiBbeyBpZDogdWlkKCdwaW4nKSwgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcgfV0gfSk7XG4gICAgKG5vZGVzW25vZGVzLmxlbmd0aCAtIDFdIGFzIGFueSkuX3hlZkxhYmVsID0geyBsYWJlbCB9O1xuICB9XG5cbiAgLy8gQnVnIDEyOiBwYXJzZSB3aXJlIGNvbm5lY3Rpb25zIFx1MjAxNCBsaW5rRkIgKHJlYWwgWEVGKSBmaXJzdCwgdGhlbiBsZWdhY3kgTGluay9Db25uZWN0aW9uXG4gIGZvciAoY29uc3QgbGlua0ZCRWwgb2YgY2hpbGRBcnJheShib2R5RWwsICdsaW5rRkInKSkge1xuICAgIGNvbnN0IHNyYyA9IGNoaWxkKGxpbmtGQkVsLCAnbGlua1NvdXJjZScpO1xuICAgIGNvbnN0IGRzdCA9IGNoaWxkKGxpbmtGQkVsLCAnbGlua0Rlc3RpbmF0aW9uJyk7XG4gICAgY29uc3QgZnJvbUluc3RhbmNlTmFtZSA9IGF0dHIoc3JjLCAncGFyZW50T2JqZWN0TmFtZScpO1xuICAgIGNvbnN0IGZyb21QaW4gPSBhdHRyKHNyYywgJ3Bpbk5hbWUnKSB8fCAnT1VUJztcbiAgICBjb25zdCB0b0luc3RhbmNlTmFtZSA9IGF0dHIoZHN0LCAncGFyZW50T2JqZWN0TmFtZScpO1xuICAgIGNvbnN0IHRvUGluID0gYXR0cihkc3QsICdwaW5OYW1lJykgfHwgJ0lOJztcbiAgICBpZiAoZnJvbUluc3RhbmNlTmFtZSAmJiB0b0luc3RhbmNlTmFtZSkge1xuICAgICAgY29uc3QgZnJvbU5vZGVJZCA9IGluc3RhbmNlTmFtZVRvTm9kZUlkLmdldChmcm9tSW5zdGFuY2VOYW1lKSB8fCBgeGVmLWZiZC0ke2Zyb21JbnN0YW5jZU5hbWV9YDtcbiAgICAgIGNvbnN0IHRvTm9kZUlkID0gaW5zdGFuY2VOYW1lVG9Ob2RlSWQuZ2V0KHRvSW5zdGFuY2VOYW1lKSB8fCBgeGVmLWZiZC0ke3RvSW5zdGFuY2VOYW1lfWA7XG4gICAgICAvLyBQcmVzZXJ2ZSB3aXJlIHJvdXRpbmcgcG9zaXRpb25zIGZvciByb3VuZC10cmlwXG4gICAgICBjb25zdCBzcmNQb3MgPSBjaGlsZChzcmMsICdvYmpQb3NpdGlvbicpO1xuICAgICAgY29uc3QgZHN0UG9zID0gY2hpbGQoZHN0LCAnb2JqUG9zaXRpb24nKTtcbiAgICAgIGNvbnN0IGdyaWRQb3NpdGlvbnM6IHsgcG9zWDogc3RyaW5nOyBwb3NZOiBzdHJpbmcgfVtdID0gW107XG4gICAgICBmb3IgKGNvbnN0IGdwIG9mIGNoaWxkQXJyYXkobGlua0ZCRWwsICdncmlkT2JqUG9zaXRpb24nKSkge1xuICAgICAgICBjb25zdCBncHggPSBhdHRyKGdwLCAncG9zWCcpO1xuICAgICAgICBjb25zdCBncHkgPSBhdHRyKGdwLCAncG9zWScpO1xuICAgICAgICBpZiAoZ3B4ICYmIGdweSkgZ3JpZFBvc2l0aW9ucy5wdXNoKHsgcG9zWDogZ3B4LCBwb3NZOiBncHkgfSk7XG4gICAgICB9XG4gICAgICBjb25zdCB3aXJlOiBhbnkgPSB7XG4gICAgICAgIGlkOiB1aWQoJ3dpcmUnKSxcbiAgICAgICAgZnJvbTogeyBub2RlSWQ6IGZyb21Ob2RlSWQsIHBpbjogZnJvbVBpbiB9LFxuICAgICAgICB0bzogeyBub2RlSWQ6IHRvTm9kZUlkLCBwaW46IHRvUGluIH0sXG4gICAgICB9O1xuICAgICAgd2lyZS5feGVmUm91dGUgPSB7XG4gICAgICAgIHNyY1Bvczogc3JjUG9zID8geyBwb3NYOiBhdHRyKHNyY1BvcywgJ3Bvc1gnKSwgcG9zWTogYXR0cihzcmNQb3MsICdwb3NZJykgfSA6IHVuZGVmaW5lZCxcbiAgICAgICAgZHN0UG9zOiBkc3RQb3MgPyB7IHBvc1g6IGF0dHIoZHN0UG9zLCAncG9zWCcpLCBwb3NZOiBhdHRyKGRzdFBvcywgJ3Bvc1knKSB9IDogdW5kZWZpbmVkLFxuICAgICAgICBncmlkUG9zaXRpb25zOiBncmlkUG9zaXRpb25zLmxlbmd0aCA+IDAgPyBncmlkUG9zaXRpb25zIDogdW5kZWZpbmVkLFxuICAgICAgfTtcbiAgICAgIHdpcmVzLnB1c2god2lyZSk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgbGlua0VsIG9mIGNoaWxkQXJyYXkoYm9keUVsLCAnTGluaycpLmNvbmNhdChjaGlsZEFycmF5KGJvZHlFbCwgJ0Nvbm5lY3Rpb24nKSkpIHtcbiAgICBjb25zdCBmcm9tSWQgPSBhdHRyKGxpbmtFbCwgJ1NvdXJjZUlkJykgfHwgYXR0cihsaW5rRWwsICdmcm9tJyk7XG4gICAgY29uc3QgdG9JZCA9IGF0dHIobGlua0VsLCAnVGFyZ2V0SWQnKSB8fCBhdHRyKGxpbmtFbCwgJ3RvJyk7XG4gICAgY29uc3QgZnJvbVBpbiA9IGF0dHIobGlua0VsLCAnU291cmNlUGluJykgfHwgYXR0cihsaW5rRWwsICdGcm9tUGluJykgfHwgJ09VVCc7XG4gICAgY29uc3QgdG9QaW4gPSBhdHRyKGxpbmtFbCwgJ1RhcmdldFBpbicpIHx8IGF0dHIobGlua0VsLCAnVG9QaW4nKSB8fCAnSU4nO1xuICAgIGlmIChmcm9tSWQgJiYgdG9JZCkge1xuICAgICAgd2lyZXMucHVzaCh7XG4gICAgICAgIGlkOiB1aWQoJ3dpcmUnKSxcbiAgICAgICAgZnJvbTogeyBub2RlSWQ6IGB4ZWYtZmJkLSR7ZnJvbUlkfWAsIHBpbjogZnJvbVBpbiB9LFxuICAgICAgICB0bzogeyBub2RlSWQ6IGB4ZWYtZmJkLSR7dG9JZH1gLCBwaW46IHRvUGluIH0sXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBub2Rlcywgd2lyZXMgfTtcbn1cblxuZnVuY3Rpb24gbWFwU2NobmVpZGVyRkJEVHlwZSh0eXBlTmFtZTogc3RyaW5nKTogRkJEQmxvY2tUeXBlIHtcbiAgY29uc3QgbWFwOiBSZWNvcmQ8c3RyaW5nLCBGQkRCbG9ja1R5cGU+ID0ge1xuICAgIEFORDogJ0FORCcsIE9SOiAnT1InLCBOT1Q6ICdOT1QnLCBYT1I6ICdYT1InLCBOQU5EOiAnTkFORCcsIE5PUjogJ05PUicsXG4gICAgQUREOiAnQUREJywgU1VCOiAnU1VCJywgTVVMOiAnTVVMJywgRElWOiAnRElWJywgTU9EOiAnTU9EJyxcbiAgICBUT046ICdUT04nLCBUT0Y6ICdUT0YnLCBUUDogJ1RQJywgQ1RVOiAnQ1RVJywgQ1REOiAnQ1REJywgQ1RVRDogJ0NUVUQnLFxuICAgIFNSOiAnU1InLCBSUzogJ1JTJywgUl9UUklHOiAnUlRSSUcnLCBGX1RSSUc6ICdGVFJJRycsXG4gICAgR1Q6ICdHVCcsIEdFOiAnR0UnLCBMVDogJ0xUJywgTEU6ICdMRScsIEVROiAnRVEnLCBORTogJ05FJyxcbiAgICBTRUw6ICdTRUwnLCBNVVg6ICdNVVgnLCBMSU1JVDogJ0xJTUlUJywgTU9WRTogJ01PVkUnLCBNT1Y6ICdNT1ZFJyxcbiAgICBBQlM6ICdBQlMnLCBTUVJUOiAnU1FSVCcsIE1JTjogJ01JTicsIE1BWDogJ01BWCcsXG4gIH07XG4gIHJldHVybiBtYXBbdHlwZU5hbWUudG9VcHBlckNhc2UoKV0gfHwgJ01PVkUnO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgWEVGIFNGQyBwYXJzZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHBhcnNlWEVGU0ZDKGJvZHlFbDogdW5rbm93biwgcG91TmFtZTogc3RyaW5nLCB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10pOiBTRkNQcm9ncmFtIHtcbiAgY29uc3Qgc3RlcHM6IFNGQ1N0ZXBbXSA9IFtdO1xuICBjb25zdCB0cmFuc2l0aW9uczogU0ZDVHJhbnNpdGlvbltdID0gW107XG4gIGNvbnN0IGxpbmtzOiBTRkNMaW5rW10gPSBbXTtcblxuICAvLyBCdWlsZCBsb29rdXAgc2V0cyBmb3Igc3RlcC90cmFuc2l0aW9uIElEcyB0byBmaXggbGluayBkaXJlY3Rpb25cbiAgY29uc3Qgc3RlcElkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCB0cmFuc2l0aW9uSWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgZm9yIChjb25zdCBzdGVwRWwgb2YgY2hpbGRBcnJheShib2R5RWwsICdTdGVwJykpIHtcbiAgICBjb25zdCBpZCA9IGF0dHIoc3RlcEVsLCAnSWQnKSB8fCBhdHRyKHN0ZXBFbCwgJ05hbWUnKTtcbiAgICBpZiAoaWQpIHN0ZXBJZHMuYWRkKGlkKTtcbiAgICBjb25zdCBuYW1lID0gYXR0cihzdGVwRWwsICdOYW1lJykgfHwgaWQ7XG4gICAgY29uc3QgaXNJbml0aWFsID0gYXR0cihzdGVwRWwsICdJbml0aWFsJykgPT09ICd0cnVlJyB8fCBhdHRyKHN0ZXBFbCwgJ0lzSW5pdGlhbCcpID09PSAndHJ1ZSc7XG5cbiAgICAvLyBQYXJzZSBzdGVwIGFjdGlvbnNcbiAgICBjb25zdCBhY3Rpb25zOiBTRkNBY3Rpb25bXSA9IFtdO1xuICAgIGNvbnN0IHZhbGlkUXVhbGlmaWVyczogQWN0aW9uUXVhbGlmaWVyW10gPSBbJ04nLCAnUycsICdSJywgJ1AnLCAnUDEnLCAnUDAnLCAnTCcsICdEJywgJ1NEJywgJ0RTJywgJ1NMJ107XG5cbiAgICAvLyBBY3Rpb25zIGNhbiBiZSBpbiA8QWN0aW9uQmxvY2s+PEFjdGlvbj4gb3IgZGlyZWN0bHkgYXMgPEFjdGlvbj4gY2hpbGRyZW5cbiAgICBjb25zdCBhY3Rpb25CbG9ja3MgPSBjaGlsZEFycmF5KHN0ZXBFbCwgJ0FjdGlvbkJsb2NrJyk7XG4gICAgY29uc3QgZGlyZWN0QWN0aW9ucyA9IGNoaWxkQXJyYXkoc3RlcEVsLCAnQWN0aW9uJyk7XG4gICAgY29uc3QgYWxsQWN0aW9uRWxzID0gYWN0aW9uQmxvY2tzLmZsYXRNYXAoYWIgPT4gY2hpbGRBcnJheShhYiwgJ0FjdGlvbicpKS5jb25jYXQoZGlyZWN0QWN0aW9ucyk7XG5cbiAgICBmb3IgKGNvbnN0IGFjdGlvbkVsIG9mIGFsbEFjdGlvbkVscykge1xuICAgICAgY29uc3QgcXVhbGlmaWVyID0gKGF0dHIoYWN0aW9uRWwsICdRdWFsaWZpZXInKSB8fCBhdHRyKGFjdGlvbkVsLCAncXVhbGlmaWVyJykgfHwgJ04nKS50b1VwcGVyQ2FzZSgpIGFzIEFjdGlvblF1YWxpZmllcjtcbiAgICAgIGNvbnN0IGFjdGlvbk5hbWUgPSBhdHRyKGFjdGlvbkVsLCAnTmFtZScpIHx8IGF0dHIoYWN0aW9uRWwsICdBY3Rpb25OYW1lJykgfHwgYXR0cihhY3Rpb25FbCwgJ25hbWUnKSB8fCAnJztcbiAgICAgIGNvbnN0IGJvZHkgPSB0ZXh0KGNoaWxkKGFjdGlvbkVsLCAnQm9keScpID8/IGNoaWxkKGFjdGlvbkVsLCAnU1QnKSA/PyBhY3Rpb25FbCkgfHwgdW5kZWZpbmVkO1xuICAgICAgY29uc3QgZHVyYXRpb24gPSBhdHRyKGFjdGlvbkVsLCAnRHVyYXRpb24nKSB8fCBhdHRyKGFjdGlvbkVsLCAnZHVyYXRpb24nKSB8fCB1bmRlZmluZWQ7XG5cbiAgICAgIGlmIChhY3Rpb25OYW1lIHx8IGJvZHkpIHtcbiAgICAgICAgYWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogdWlkKGBhY3Rpb24tJHtpZH1gKSxcbiAgICAgICAgICBxdWFsaWZpZXI6IHZhbGlkUXVhbGlmaWVycy5pbmNsdWRlcyhxdWFsaWZpZXIpID8gcXVhbGlmaWVyIDogJ04nLFxuICAgICAgICAgIHRhZzogeyBuYW1lOiBhY3Rpb25OYW1lIHx8IGAke25hbWV9X0FjdGlvbmAsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgICAgICBkdXJhdGlvbixcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgc3RlcHMucHVzaCh7XG4gICAgICBpZDogYHhlZi1zdGVwLSR7aWR9YCxcbiAgICAgIG5hbWU6IG5hbWUgfHwgYFN0ZXBfJHtpZH1gLFxuICAgICAgaXNJbml0aWFsLFxuICAgICAgYWN0aW9ucyxcbiAgICAgIHBvc2l0aW9uOiB7XG4gICAgICAgIHg6IE51bWJlcihhdHRyKGNoaWxkKHN0ZXBFbCwgJ1Bvc2l0aW9uJyksICdYJykpIHx8IDAsXG4gICAgICAgIHk6IE51bWJlcihhdHRyKGNoaWxkKHN0ZXBFbCwgJ1Bvc2l0aW9uJyksICdZJykpIHx8IDAsXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgZm9yIChjb25zdCB0cmFuc0VsIG9mIGNoaWxkQXJyYXkoYm9keUVsLCAnVHJhbnNpdGlvbicpKSB7XG4gICAgY29uc3QgaWQgPSBhdHRyKHRyYW5zRWwsICdJZCcpIHx8IGF0dHIodHJhbnNFbCwgJ05hbWUnKTtcbiAgICBpZiAoaWQpIHRyYW5zaXRpb25JZHMuYWRkKGlkKTtcbiAgICBjb25zdCBjb25kaXRpb24gPSB0ZXh0KGNoaWxkKHRyYW5zRWwsICdDb25kaXRpb24nKSA/PyB0cmFuc0VsKSB8fCAnVFJVRSc7XG4gICAgY29uc3QgcHJpb3JpdHkgPSBOdW1iZXIoYXR0cih0cmFuc0VsLCAnUHJpb3JpdHknKSkgfHwgdW5kZWZpbmVkO1xuICAgIHRyYW5zaXRpb25zLnB1c2goe1xuICAgICAgaWQ6IGB4ZWYtdHJhbnMtJHtpZH1gLFxuICAgICAgY29uZGl0aW9uLFxuICAgICAgcHJpb3JpdHksXG4gICAgICBwb3NpdGlvbjoge1xuICAgICAgICB4OiBOdW1iZXIoYXR0cihjaGlsZCh0cmFuc0VsLCAnUG9zaXRpb24nKSwgJ1gnKSkgfHwgMCxcbiAgICAgICAgeTogTnVtYmVyKGF0dHIoY2hpbGQodHJhbnNFbCwgJ1Bvc2l0aW9uJyksICdZJykpIHx8IDAsXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgLy8gQnVpbGQgbGlua3Mgd2l0aCBjb3JyZWN0IGRpcmVjdGlvbiBkZXRlY3Rpb25cbiAgZm9yIChjb25zdCBsaW5rRWwgb2YgY2hpbGRBcnJheShib2R5RWwsICdUcmFuc2l0aW9uTGluaycpLmNvbmNhdChjaGlsZEFycmF5KGJvZHlFbCwgJ0xpbmsnKSkpIHtcbiAgICBjb25zdCBmcm9tID0gYXR0cihsaW5rRWwsICdTb3VyY2VJZCcpIHx8IGF0dHIobGlua0VsLCAnZnJvbScpO1xuICAgIGNvbnN0IHRvID0gYXR0cihsaW5rRWwsICdUYXJnZXRJZCcpIHx8IGF0dHIobGlua0VsLCAndG8nKTtcbiAgICBpZiAoIWZyb20gfHwgIXRvKSBjb250aW51ZTtcblxuICAgIC8vIERldGVybWluZSBjb3JyZWN0IHByZWZpeCBiYXNlZCBvbiB3aGV0aGVyIGVhY2ggSUQgaXMgYSBzdGVwIG9yIHRyYW5zaXRpb25cbiAgICBjb25zdCBmcm9tSXNTdGVwID0gc3RlcElkcy5oYXMoZnJvbSk7XG4gICAgY29uc3QgZnJvbUlzVHJhbnMgPSB0cmFuc2l0aW9uSWRzLmhhcyhmcm9tKTtcbiAgICBjb25zdCB0b0lzU3RlcCA9IHN0ZXBJZHMuaGFzKHRvKTtcbiAgICBjb25zdCB0b0lzVHJhbnMgPSB0cmFuc2l0aW9uSWRzLmhhcyh0byk7XG5cbiAgICBsZXQgZnJvbUlkOiBzdHJpbmc7XG4gICAgbGV0IHRvSWQ6IHN0cmluZztcblxuICAgIGlmIChmcm9tSXNTdGVwKSBmcm9tSWQgPSBgeGVmLXN0ZXAtJHtmcm9tfWA7XG4gICAgZWxzZSBpZiAoZnJvbUlzVHJhbnMpIGZyb21JZCA9IGB4ZWYtdHJhbnMtJHtmcm9tfWA7XG4gICAgZWxzZSBmcm9tSWQgPSBgeGVmLXN0ZXAtJHtmcm9tfWA7IC8vIGRlZmF1bHQgYXNzdW1wdGlvblxuXG4gICAgaWYgKHRvSXNTdGVwKSB0b0lkID0gYHhlZi1zdGVwLSR7dG99YDtcbiAgICBlbHNlIGlmICh0b0lzVHJhbnMpIHRvSWQgPSBgeGVmLXRyYW5zLSR7dG99YDtcbiAgICBlbHNlIHRvSWQgPSBgeGVmLXRyYW5zLSR7dG99YDsgLy8gZGVmYXVsdCBhc3N1bXB0aW9uXG5cbiAgICBsaW5rcy5wdXNoKHsgaWQ6IHVpZChgbGluay0ke2Zyb219LSR7dG99YCksIGZyb206IGZyb21JZCwgdG86IHRvSWQsIHR5cGU6ICdzaW1wbGUnIH0pO1xuICB9XG5cbiAgcmV0dXJuIHsgc3RlcHMsIHRyYW5zaXRpb25zLCBsaW5rcywgYnJhbmNoZXM6IFtdIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBFeHBvcnQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBmdW5jdGlvbiBleHBvcnRTY2huZWlkZXIocHJvamVjdDogTm9ybWFsaXplZFByb2plY3QpOiBFeHBvcnRSZXN1bHQge1xuICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBzaWRlY2FyID0gcHJvamVjdC5zaWRlY2FyO1xuXG4gIGNvbnN0IGdsb2JhbFZhcnMgPSBwcm9qZWN0Lmdsb2JhbFRhZ3MubWFwKHRhZ1RvWEVGVmFyaWFibGUpO1xuICBjb25zdCBwcm9ncmFtcyA9IHByb2plY3QucG91cy5tYXAocG91ID0+IHBvdVRvWEVGUHJvZ3JhbShwb3UsIHdhcm5pbmdzKSk7XG5cbiAgLy8gQnVnIDE2OiBleHBvcnQgdXNlcyByZWFsIFhFRiBzdHJ1Y3R1cmUgXHUyMDE0IEZFRkV4Y2hhbmdlRmlsZSByb290LCBkYXRhQmxvY2sgZm9yIGdsb2JhbHMsIDxwcm9ncmFtPiBhcnJheVxuICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xuICBjb25zdCBkdFN0ciA9IGBkYXRlX2FuZF90aW1lIyR7bm93LmdldEZ1bGxZZWFyKCl9LSR7bm93LmdldE1vbnRoKCkrMX0tJHtub3cuZ2V0RGF0ZSgpfS0ke25vdy5nZXRIb3VycygpfToke25vdy5nZXRNaW51dGVzKCl9OiR7bm93LmdldFNlY29uZHMoKX1gO1xuICBjb25zdCBvYmogPSB7XG4gICAgRkVGRXhjaGFuZ2VGaWxlOiB7XG4gICAgICBmaWxlSGVhZGVyOiB7XG4gICAgICAgICdAX2NvbXBhbnknOiAnUGxheGlvJyxcbiAgICAgICAgJ0BfcHJvZHVjdCc6ICdQbGF4aW8gUExDIEVkaXRvcicsXG4gICAgICAgICdAX2RhdGVUaW1lJzogZHRTdHIsXG4gICAgICAgICdAX2NvbnRlbnQnOiAnUHJvamVjdCBzb3VyY2UgZmlsZScsXG4gICAgICAgICdAX0RURFZlcnNpb24nOiAnNDEnLFxuICAgICAgfSxcbiAgICAgIGNvbnRlbnRIZWFkZXI6IHtcbiAgICAgICAgJ0BfbmFtZSc6IHByb2plY3QucHJvamVjdE5hbWUsXG4gICAgICAgICdAX3ZlcnNpb24nOiBzaWRlY2FyLnZlbmRvclNwZWNpZmljR2xvYmFscz8uWyd2ZXJzaW9uJ10gPz8gJzAuMC4xJyxcbiAgICAgICAgJ0BfZGF0ZVRpbWUnOiBkdFN0cixcbiAgICAgIH0sXG4gICAgICBkYXRhQmxvY2s6IHtcbiAgICAgICAgdmFyaWFibGVzOiBnbG9iYWxWYXJzLmxlbmd0aCA/IGdsb2JhbFZhcnMgOiB1bmRlZmluZWQsXG4gICAgICB9LFxuICAgICAgcHJvZ3JhbTogcHJvZ3JhbXMsXG4gICAgfSxcbiAgfTtcblxuICByZXR1cm4geyBvazogdHJ1ZSwgeG1sQ29udGVudDogYnVpbGRYTUwob2JqKSwgZXJyb3JzLCB3YXJuaW5ncyB9O1xufVxuXG5mdW5jdGlvbiB0YWdUb1hFRlZhcmlhYmxlKHRhZzogTm9ybWFsaXplZFRhZyk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgY29uc3QgbWV0YSA9ICh0YWcgYXMgYW55KS5feGVmTWV0YSBhcyB7IG9yaWdpbmFsVHlwZT86IHN0cmluZzsgYXR0cmlidXRlcz86IHsgbmFtZTogc3RyaW5nOyB2YWx1ZTogc3RyaW5nIH1bXSB9IHwgdW5kZWZpbmVkO1xuICBjb25zdCB0eXBlTmFtZSA9IG1ldGE/Lm9yaWdpbmFsVHlwZSB8fCB0YWcuZGF0YVR5cGU7XG4gIGNvbnN0IHJlc3VsdDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgJ0BfbmFtZSc6IHRhZy5uYW1lLFxuICAgICdAX3R5cGVOYW1lJzogdHlwZU5hbWUsXG4gIH07XG4gIGlmICh0YWcuYWRkcmVzcykgcmVzdWx0WydAX3RvcG9sb2dpY2FsQWRkcmVzcyddID0gdGFnLmFkZHJlc3M7XG4gIGlmICh0YWcuZGVzY3JpcHRpb24pIHJlc3VsdFsnY29tbWVudCddID0gdGFnLmRlc2NyaXB0aW9uO1xuICBpZiAodGFnLmluaXRpYWxWYWx1ZSkgcmVzdWx0Wyd2YXJpYWJsZUluaXQnXSA9IHsgJ0BfdmFsdWUnOiB0YWcuaW5pdGlhbFZhbHVlIH07XG4gIC8vIEVtaXQgYXR0cmlidXRlIGNoaWxkcmVuIGZvciByb3VuZC10cmlwXG4gIGlmIChtZXRhPy5hdHRyaWJ1dGVzICYmIG1ldGEuYXR0cmlidXRlcy5sZW5ndGggPiAwKSB7XG4gICAgcmVzdWx0WydhdHRyaWJ1dGUnXSA9IG1ldGEuYXR0cmlidXRlcy5tYXAoYSA9PiAoeyAnQF9uYW1lJzogYS5uYW1lLCAnQF92YWx1ZSc6IGEudmFsdWUgfSkpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHBvdVRvWEVGUHJvZ3JhbShwb3U6IE5vcm1hbGl6ZWRQT1UsIHdhcm5pbmdzOiBzdHJpbmdbXSk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgY29uc3QgbG9jYWxWYXJzID0gcG91LmxvY2FsVGFncy5tYXAodGFnVG9YRUZWYXJpYWJsZSk7XG5cbiAgLy8gQnVnIDE2OiBsb2NhbCB2YXJzIGluIHB1YmxpY0xvY2FsVmFyaWFibGVzXG4gIGNvbnN0IGxvY2FsVmFyc1NlY3Rpb24gPSBsb2NhbFZhcnMubGVuZ3RoID4gMFxuICAgID8geyBwdWJsaWNMb2NhbFZhcmlhYmxlczogeyB2YXJpYWJsZXM6IGxvY2FsVmFycyB9IH1cbiAgICA6IHt9O1xuXG4gIGxldCBib2R5U2VjdGlvbjogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fTtcblxuICBpZiAocG91Lmxhbmd1YWdlID09PSAnTEQnICYmIHBvdS5sYWRkZXJQcm9ncmFtKSB7XG4gICAgLy8gQnVnIDE2OiB3cmFwIExEIGJvZHkgaW4gTERTb3VyY2VcbiAgICBjb25zdCBsZEJvZHkgPSB7XG4gICAgICBSdW5nOiBwb3UubGFkZGVyUHJvZ3JhbS5ydW5ncy5tYXAoKHJ1bmcsIHJpKSA9PiB7XG4gICAgICAgIGNvbnN0IHJ1bmdPYmo6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xuICAgICAgICAgICdAX051bWJlcic6IFN0cmluZyhyaSArIDEpLFxuICAgICAgICAgIENvbW1lbnQ6IHJ1bmcuY29tbWVudCB8fCB1bmRlZmluZWQsXG4gICAgICAgICAgLi4uYnVpbGRYRUZSdW5nRWxlbWVudHMocnVuZy5lbGVtZW50cyksXG4gICAgICAgIH07XG4gICAgICAgIGlmIChydW5nLmJyYW5jaGVzICYmIHJ1bmcuYnJhbmNoZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHJ1bmdPYmouQnJhbmNoID0gcnVuZy5icmFuY2hlcy5tYXAoYnJhbmNoID0+IGJ1aWxkWEVGUnVuZ0VsZW1lbnRzKGJyYW5jaC5lbGVtZW50cykpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBydW5nT2JqO1xuICAgICAgfSksXG4gICAgfTtcbiAgICBib2R5U2VjdGlvbiA9IHsgTERTb3VyY2U6IGxkQm9keSB9O1xuICB9IGVsc2UgaWYgKHBvdS5sYW5ndWFnZSA9PT0gJ0ZCRCcgJiYgcG91LmZiZFByb2dyYW0pIHtcbiAgICAvLyBCdWcgMTY6IEZCRCBib2R5IHdyYXBwZWQgaW4gRkJEU291cmNlIChuZXR3b3JrRkJEIHdyYXBwZWQgaW5zaWRlIGJ1aWxkWEVGRkJERXhwb3J0KVxuICAgIGJvZHlTZWN0aW9uID0geyBGQkRTb3VyY2U6IGJ1aWxkWEVGRkJERXhwb3J0KHBvdS5mYmRQcm9ncmFtKSB9O1xuICB9IGVsc2UgaWYgKHBvdS5sYW5ndWFnZSA9PT0gJ1NGQycgJiYgcG91LnNmY1Byb2dyYW0pIHtcbiAgICBib2R5U2VjdGlvbiA9IHsgU0ZDU291cmNlOiBidWlsZFhFRlNGQ0V4cG9ydChwb3Uuc2ZjUHJvZ3JhbSkgfTtcbiAgfSBlbHNlIGlmIChwb3UubGFuZ3VhZ2UgPT09ICdTVCcgJiYgcG91LnN0U291cmNlKSB7XG4gICAgYm9keVNlY3Rpb24gPSB7IFNUU291cmNlOiB7ICcjdGV4dCc6IHBvdS5zdFNvdXJjZSB9IH07XG4gIH0gZWxzZSB7XG4gICAgd2FybmluZ3MucHVzaChgUE9VIFwiJHtwb3UubmFtZX1cIjogJHtwb3UubGFuZ3VhZ2V9IGV4cG9ydCBcdTIwMTQgZW1wdHkgYm9keWApO1xuICB9XG5cbiAgLy8gQnVnIDE2OiBlbWl0IDxwcm9ncmFtPjxpZGVudFByb2dyYW0gbmFtZT1cIi4uLlwiIHR5cGU9XCJzZWN0aW9uXCIgdGFzaz1cIk1BU1RcIj5cbiAgY29uc3QgcG91TWV0YSA9IChwb3UgYXMgYW55KS5feGVmTWV0YSBhcyB7IHRhc2s/OiBzdHJpbmc7IHNlY3Rpb25UeXBlPzogc3RyaW5nIH0gfCB1bmRlZmluZWQ7XG4gIHJldHVybiB7XG4gICAgaWRlbnRQcm9ncmFtOiB7XG4gICAgICAnQF9uYW1lJzogcG91Lm5hbWUsXG4gICAgICAnQF90eXBlJzogcG91TWV0YT8uc2VjdGlvblR5cGUgfHwgJ3NlY3Rpb24nLFxuICAgICAgJ0BfdGFzayc6IHBvdU1ldGE/LnRhc2sgfHwgJ01BU1QnLFxuICAgIH0sXG4gICAgLi4ubG9jYWxWYXJzU2VjdGlvbixcbiAgICAuLi5ib2R5U2VjdGlvbixcbiAgfTtcbn1cblxuZnVuY3Rpb24gYnVpbGRYRUZSdW5nRWxlbWVudHMoZWxlbWVudHM6IExhZGRlckVsZW1lbnRbXSk6IFJlY29yZDxzdHJpbmcsIHVua25vd25bXT4ge1xuICBjb25zdCBjb250YWN0czogdW5rbm93bltdID0gW107XG4gIGNvbnN0IGNvaWxzOiB1bmtub3duW10gPSBbXTtcbiAgY29uc3QgYmxvY2tzOiB1bmtub3duW10gPSBbXTtcbiAgZm9yIChjb25zdCBlbCBvZiBlbGVtZW50cykge1xuICAgIGlmIChlbC5raW5kID09PSAnY29udGFjdCcpIHtcbiAgICAgIGNvbnN0IGMgPSBlbCBhcyBDb250YWN0RWxlbWVudDtcbiAgICAgIGNvbnN0IHR5cGVNYXA6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7IE5POiAnJywgTkM6ICdOQycsIFBfQ09OVEFDVDogJ1AnLCBOX0NPTlRBQ1Q6ICdOJyB9O1xuICAgICAgY29udGFjdHMucHVzaCh7ICdAX1ZhcmlhYmxlJzogYy50YWcubmFtZSwgJ0BfVHlwZSc6IHR5cGVNYXBbYy50eXBlXSB8fCAnJyB9KTtcbiAgICB9IGVsc2UgaWYgKGVsLmtpbmQgPT09ICdjb2lsJykge1xuICAgICAgY29uc3QgYyA9IGVsIGFzIENvaWxFbGVtZW50O1xuICAgICAgY29uc3QgdHlwZU1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsgbm9ybWFsOiAnTm9ybWFsJywgbmVnYXRlZDogJ05lZ2F0ZWQnLCBzZXQ6ICdTZXQnLCByZXNldDogJ1Jlc2V0JywgbGF0Y2g6ICdMYXRjaCcsIHVubGF0Y2g6ICdVbmxhdGNoJyB9O1xuICAgICAgY29pbHMucHVzaCh7ICdAX1ZhcmlhYmxlJzogYy50YWcubmFtZSwgJ0BfVHlwZSc6IHR5cGVNYXBbYy50eXBlXSB8fCAnTm9ybWFsJyB9KTtcbiAgICB9IGVsc2UgaWYgKGVsLmtpbmQgPT09ICdibG9jaycpIHtcbiAgICAgIGNvbnN0IGIgPSBlbCBhcyBCbG9ja0VsZW1lbnQ7XG4gICAgICBjb25zdCBpbnB1dFBpbnMgPSBPYmplY3QuZW50cmllcyhiLnBpbnMgfHwge30pLm1hcCgoW25hbWUsIHJlZl0pID0+ICh7XG4gICAgICAgICdAX05hbWUnOiBuYW1lLFxuICAgICAgICAnQF9WYXJpYWJsZSc6IChyZWYgYXMgYW55KS5uYW1lLFxuICAgICAgfSkpO1xuICAgICAgYmxvY2tzLnB1c2goe1xuICAgICAgICAnQF9UeXBlJzogYi5mYlR5cGUsXG4gICAgICAgICdAX0luc3RhbmNlJzogYi5pbnN0YW5jZU5hbWUsXG4gICAgICAgIC4uLihpbnB1dFBpbnMubGVuZ3RoID4gMCA/IHsgSW5wdXRQaW46IGlucHV0UGlucyB9IDoge30pLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGNvbnN0IHJlc3VsdDogUmVjb3JkPHN0cmluZywgdW5rbm93bltdPiA9IHt9O1xuICBpZiAoY29udGFjdHMubGVuZ3RoKSByZXN1bHQuQ29udGFjdCA9IGNvbnRhY3RzO1xuICBpZiAoY29pbHMubGVuZ3RoKSByZXN1bHQuQ29pbCA9IGNvaWxzO1xuICBpZiAoYmxvY2tzLmxlbmd0aCkgcmVzdWx0LkZ1bmN0aW9uQmxvY2sgPSBibG9ja3M7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkWEVGRkJERXhwb3J0KGZiZDogRkJEUHJvZ3JhbSk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgY29uc3QgZ3JpZCA9IChmYmQgYXMgYW55KS5feGVmR3JpZCBhcyB7IG5iUm93cz86IHN0cmluZzsgbmJDb2x1bW5zPzogc3RyaW5nIH0gfCB1bmRlZmluZWQ7XG5cbiAgLy8gRW1pdCBqdW1wT2JqZWN0L2xhYmVsT2JqZWN0XG4gIGNvbnN0IGp1bXBPYmplY3RzID0gZmJkLm5vZGVzLmZpbHRlcihuID0+IChuIGFzIGFueSkuX3hlZkp1bXApLm1hcChuID0+ICh7XG4gICAgJ0BfbGFiZWwnOiAobiBhcyBhbnkpLl94ZWZKdW1wLmxhYmVsLFxuICAgIG9ialBvc2l0aW9uOiB7ICdAX3Bvc1gnOiBTdHJpbmcobi5wb3NpdGlvbi54KSwgJ0BfcG9zWSc6IFN0cmluZyhuLnBvc2l0aW9uLnkpIH0sXG4gIH0pKTtcbiAgY29uc3QgbGFiZWxPYmplY3RzID0gZmJkLm5vZGVzLmZpbHRlcihuID0+IChuIGFzIGFueSkuX3hlZkxhYmVsKS5tYXAobiA9PiAoe1xuICAgICdAX2xhYmVsJzogKG4gYXMgYW55KS5feGVmTGFiZWwubGFiZWwsXG4gICAgb2JqUG9zaXRpb246IHsgJ0BfcG9zWCc6IFN0cmluZyhuLnBvc2l0aW9uLngpLCAnQF9wb3NZJzogU3RyaW5nKG4ucG9zaXRpb24ueSkgfSxcbiAgfSkpO1xuXG4gIC8vIEJ1ZyAxNDogZW1pdCBGRkJCbG9jayB3aXRoIGluc3RhbmNlTmFtZSwgdHlwZU5hbWUsIG9ialBvc2l0aW9uLCBkZXNjcmlwdGlvbkZGQlxuICBjb25zdCBibG9ja3MgPSBmYmQubm9kZXNcbiAgICAuZmlsdGVyKG4gPT4gbi50eXBlICE9PSAnSU5fVkFSSUFCTEUnICYmIG4udHlwZSAhPT0gJ09VVF9WQVJJQUJMRScgJiYgbi50eXBlICE9PSAnSU5PVVRfVkFSSUFCTEUnICYmICEobiBhcyBhbnkpLl94ZWZKdW1wICYmICEobiBhcyBhbnkpLl94ZWZMYWJlbClcbiAgICAubWFwKG4gPT4ge1xuICAgICAgY29uc3QgeGIgPSAobiBhcyBhbnkpLl94ZWZCbG9jayBhcyB7IG9yaWdpbmFsVHlwZU5hbWU/OiBzdHJpbmc7IGFkZGl0aW9ubmFsUGluTnVtYmVyPzogc3RyaW5nOyBlbkVuTz86IHN0cmluZzsgd2lkdGg/OiBzdHJpbmc7IGhlaWdodD86IHN0cmluZzsgZXhlY0FmdGVyPzogc3RyaW5nIH0gfCB1bmRlZmluZWQ7XG4gICAgICBjb25zdCBpbnB1dFZhcnMgPSAobi5pbnB1dHMgfHwgW10pLm1hcCgocDogYW55KSA9PiB7XG4gICAgICAgIGNvbnN0IGl2OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0geyAnQF9mb3JtYWxQYXJhbWV0ZXInOiBwLm5hbWUgfTtcbiAgICAgICAgaXZbJ0BfaW52ZXJ0ZWRQaW4nXSA9IHAubmVnYXRlZCA/ICd0cnVlJyA6ICdmYWxzZSc7XG4gICAgICAgIGlmIChwLnZhbHVlKSBpdlsnQF9lZmZlY3RpdmVQYXJhbWV0ZXInXSA9IHAudmFsdWU7XG4gICAgICAgIHJldHVybiBpdjtcbiAgICAgIH0pO1xuICAgICAgY29uc3Qgb3V0cHV0VmFycyA9IChuLm91dHB1dHMgfHwgW10pLm1hcCgocDogYW55KSA9PiB7XG4gICAgICAgIGNvbnN0IG92OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0geyAnQF9mb3JtYWxQYXJhbWV0ZXInOiBwLm5hbWUgfTtcbiAgICAgICAgb3ZbJ0BfaW52ZXJ0ZWRQaW4nXSA9IHAubmVnYXRlZCA/ICd0cnVlJyA6ICdmYWxzZSc7XG4gICAgICAgIGlmIChwLnZhbHVlKSBvdlsnQF9lZmZlY3RpdmVQYXJhbWV0ZXInXSA9IHAudmFsdWU7XG4gICAgICAgIHJldHVybiBvdjtcbiAgICAgIH0pO1xuICAgICAgY29uc3QgYmxvY2tPYmo6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xuICAgICAgICAnQF9pbnN0YW5jZU5hbWUnOiBuLmluc3RhbmNlTmFtZSB8fCBuLmlkLFxuICAgICAgICAnQF90eXBlTmFtZSc6IHhiPy5vcmlnaW5hbFR5cGVOYW1lIHx8IG4udHlwZSxcbiAgICAgIH07XG4gICAgICBpZiAoeGI/LmFkZGl0aW9ubmFsUGluTnVtYmVyICE9IG51bGwpIGJsb2NrT2JqWydAX2FkZGl0aW9ubmFsUGluTnVtYmVyJ10gPSB4Yi5hZGRpdGlvbm5hbFBpbk51bWJlcjtcbiAgICAgIGlmICh4Yj8uZW5Fbk8gIT0gbnVsbCkgYmxvY2tPYmpbJ0BfZW5Fbk8nXSA9IHhiLmVuRW5PO1xuICAgICAgaWYgKHhiPy53aWR0aCAhPSBudWxsKSBibG9ja09ialsnQF93aWR0aCddID0geGIud2lkdGg7XG4gICAgICBpZiAoeGI/LmhlaWdodCAhPSBudWxsKSBibG9ja09ialsnQF9oZWlnaHQnXSA9IHhiLmhlaWdodDtcbiAgICAgIGJsb2NrT2JqWydvYmpQb3NpdGlvbiddID0geyAnQF9wb3NYJzogU3RyaW5nKG4ucG9zaXRpb24ueCksICdAX3Bvc1knOiBTdHJpbmcobi5wb3NpdGlvbi55KSB9O1xuICAgICAgaWYgKGlucHV0VmFycy5sZW5ndGggPiAwIHx8IG91dHB1dFZhcnMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBkZXNjRkZCOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHt9O1xuICAgICAgICBpZiAoeGI/LmV4ZWNBZnRlciAhPSBudWxsKSBkZXNjRkZCWydAX2V4ZWNBZnRlciddID0geGIuZXhlY0FmdGVyO1xuICAgICAgICBpZiAoaW5wdXRWYXJzLmxlbmd0aCA+IDApIGRlc2NGRkJbJ2lucHV0VmFyaWFibGUnXSA9IGlucHV0VmFycztcbiAgICAgICAgaWYgKG91dHB1dFZhcnMubGVuZ3RoID4gMCkgZGVzY0ZGQlsnb3V0cHV0VmFyaWFibGUnXSA9IG91dHB1dFZhcnM7XG4gICAgICAgIGJsb2NrT2JqWydkZXNjcmlwdGlvbkZGQiddID0gZGVzY0ZGQjtcbiAgICAgIH1cbiAgICAgIHJldHVybiBibG9ja09iajtcbiAgICB9KTtcblxuICBjb25zdCBpblZhcnMgPSBmYmQubm9kZXMuZmlsdGVyKG4gPT4gbi50eXBlID09PSAnSU5fVkFSSUFCTEUnKS5tYXAobiA9PiAoe1xuICAgICdAX0lkJzogbi5pZCxcbiAgICAnQF9FeHByZXNzaW9uJzogbi50YWc/Lm5hbWUgfHwgJycsXG4gICAgUG9zaXRpb246IHsgJ0BfWCc6IFN0cmluZyhuLnBvc2l0aW9uLngpLCAnQF9ZJzogU3RyaW5nKG4ucG9zaXRpb24ueSkgfSxcbiAgfSkpO1xuXG4gIGNvbnN0IG91dFZhcnMgPSBmYmQubm9kZXMuZmlsdGVyKG4gPT4gbi50eXBlID09PSAnT1VUX1ZBUklBQkxFJykubWFwKG4gPT4gKHtcbiAgICAnQF9JZCc6IG4uaWQsXG4gICAgJ0BfRXhwcmVzc2lvbic6IG4udGFnPy5uYW1lIHx8ICcnLFxuICAgIFBvc2l0aW9uOiB7ICdAX1gnOiBTdHJpbmcobi5wb3NpdGlvbi54KSwgJ0BfWSc6IFN0cmluZyhuLnBvc2l0aW9uLnkpIH0sXG4gIH0pKTtcblxuICAvLyBCdWcgMTU6IGVtaXQgbGlua0ZCIHdpdGggbGlua1NvdXJjZS9saW5rRGVzdGluYXRpb24gYW5kIHJvdXRpbmdcbiAgY29uc3QgbGlua0ZCcyA9IGZiZC53aXJlcy5tYXAodyA9PiB7XG4gICAgY29uc3Qgcm91dGUgPSAodyBhcyBhbnkpLl94ZWZSb3V0ZSBhcyB7IHNyY1Bvcz86IHsgcG9zWDogc3RyaW5nOyBwb3NZOiBzdHJpbmcgfTsgZHN0UG9zPzogeyBwb3NYOiBzdHJpbmc7IHBvc1k6IHN0cmluZyB9OyBncmlkUG9zaXRpb25zPzogeyBwb3NYOiBzdHJpbmc7IHBvc1k6IHN0cmluZyB9W10gfSB8IHVuZGVmaW5lZDtcbiAgICBjb25zdCBsaW5rT2JqOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAgIGxpbmtTb3VyY2U6IHtcbiAgICAgICAgJ0BfcGFyZW50T2JqZWN0TmFtZSc6IHcuZnJvbS5ub2RlSWQsXG4gICAgICAgICdAX3Bpbk5hbWUnOiB3LmZyb20ucGluLFxuICAgICAgICAuLi4ocm91dGU/LnNyY1BvcyA/IHsgb2JqUG9zaXRpb246IHsgJ0BfcG9zWCc6IHJvdXRlLnNyY1Bvcy5wb3NYLCAnQF9wb3NZJzogcm91dGUuc3JjUG9zLnBvc1kgfSB9IDoge30pLFxuICAgICAgfSxcbiAgICAgIGxpbmtEZXN0aW5hdGlvbjoge1xuICAgICAgICAnQF9wYXJlbnRPYmplY3ROYW1lJzogdy50by5ub2RlSWQsXG4gICAgICAgICdAX3Bpbk5hbWUnOiB3LnRvLnBpbixcbiAgICAgICAgLi4uKHJvdXRlPy5kc3RQb3MgPyB7IG9ialBvc2l0aW9uOiB7ICdAX3Bvc1gnOiByb3V0ZS5kc3RQb3MucG9zWCwgJ0BfcG9zWSc6IHJvdXRlLmRzdFBvcy5wb3NZIH0gfSA6IHt9KSxcbiAgICAgIH0sXG4gICAgfTtcbiAgICBpZiAocm91dGU/LmdyaWRQb3NpdGlvbnMpIHtcbiAgICAgIGxpbmtPYmpbJ2dyaWRPYmpQb3NpdGlvbiddID0gcm91dGUuZ3JpZFBvc2l0aW9ucy5tYXAoZ3AgPT4gKHsgJ0BfcG9zWCc6IGdwLnBvc1gsICdAX3Bvc1knOiBncC5wb3NZIH0pKTtcbiAgICB9XG4gICAgcmV0dXJuIGxpbmtPYmo7XG4gIH0pO1xuXG4gIC8vIFdyYXAgaW4gbmV0d29ya0ZCRCB3aXRoIG9wdGlvbmFsIGdyaWQgZGltZW5zaW9uc1xuICBjb25zdCBmYmRTb3VyY2U6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XG4gIGlmIChncmlkPy5uYlJvd3MpIGZiZFNvdXJjZVsnQF9uYlJvd3MnXSA9IGdyaWQubmJSb3dzO1xuICBpZiAoZ3JpZD8ubmJDb2x1bW5zKSBmYmRTb3VyY2VbJ0BfbmJDb2x1bW5zJ10gPSBncmlkLm5iQ29sdW1ucztcbiAgZmJkU291cmNlWyduZXR3b3JrRkJEJ10gPSB7XG4gICAganVtcE9iamVjdDoganVtcE9iamVjdHMubGVuZ3RoID8ganVtcE9iamVjdHMgOiB1bmRlZmluZWQsXG4gICAgbGFiZWxPYmplY3Q6IGxhYmVsT2JqZWN0cy5sZW5ndGggPyBsYWJlbE9iamVjdHMgOiB1bmRlZmluZWQsXG4gICAgRkZCQmxvY2s6IGJsb2Nrcy5sZW5ndGggPyBibG9ja3MgOiB1bmRlZmluZWQsXG4gICAgSW5WYXJpYWJsZTogaW5WYXJzLmxlbmd0aCA/IGluVmFycyA6IHVuZGVmaW5lZCxcbiAgICBPdXRWYXJpYWJsZTogb3V0VmFycy5sZW5ndGggPyBvdXRWYXJzIDogdW5kZWZpbmVkLFxuICAgIGxpbmtGQjogbGlua0ZCcy5sZW5ndGggPyBsaW5rRkJzIDogdW5kZWZpbmVkLFxuICB9O1xuICByZXR1cm4gZmJkU291cmNlO1xufVxuXG5mdW5jdGlvbiBidWlsZFhFRlNGQ0V4cG9ydChzZmM6IFNGQ1Byb2dyYW0pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIGNvbnN0IHN0ZXBzID0gc2ZjLnN0ZXBzLm1hcChzID0+ICh7XG4gICAgJ0BfSWQnOiBzLmlkLnJlcGxhY2UoJ3hlZi1zdGVwLScsICcnKSxcbiAgICAnQF9OYW1lJzogcy5uYW1lLFxuICAgICdAX0luaXRpYWwnOiBTdHJpbmcocy5pc0luaXRpYWwpLFxuICAgIFBvc2l0aW9uOiB7ICdAX1gnOiBTdHJpbmcocy5wb3NpdGlvbi54KSwgJ0BfWSc6IFN0cmluZyhzLnBvc2l0aW9uLnkpIH0sXG4gICAgLi4uKHMuYWN0aW9ucy5sZW5ndGggPiAwID8ge1xuICAgICAgQWN0aW9uQmxvY2s6IHtcbiAgICAgICAgQWN0aW9uOiBzLmFjdGlvbnMubWFwKGEgPT4gKHtcbiAgICAgICAgICAnQF9RdWFsaWZpZXInOiBhLnF1YWxpZmllcixcbiAgICAgICAgICAnQF9OYW1lJzogYS50YWcubmFtZSxcbiAgICAgICAgICAnQF9EdXJhdGlvbic6IGEuZHVyYXRpb24gfHwgdW5kZWZpbmVkLFxuICAgICAgICB9KSksXG4gICAgICB9LFxuICAgIH0gOiB7fSksXG4gIH0pKTtcblxuICBjb25zdCB0cmFuc2l0aW9ucyA9IHNmYy50cmFuc2l0aW9ucy5tYXAodCA9PiAoe1xuICAgICdAX0lkJzogdC5pZC5yZXBsYWNlKCd4ZWYtdHJhbnMtJywgJycpLFxuICAgICdAX05hbWUnOiB0LmlkLFxuICAgIENvbmRpdGlvbjogdC5jb25kaXRpb24sXG4gICAgUG9zaXRpb246IHsgJ0BfWCc6IFN0cmluZyh0LnBvc2l0aW9uLngpLCAnQF9ZJzogU3RyaW5nKHQucG9zaXRpb24ueSkgfSxcbiAgfSkpO1xuXG4gIGNvbnN0IGxpbmtzID0gc2ZjLmxpbmtzLm1hcChsID0+ICh7XG4gICAgJ0BfU291cmNlSWQnOiBsLmZyb20ucmVwbGFjZSgvXnhlZi0oc3RlcHx0cmFucyktLywgJycpLFxuICAgICdAX1RhcmdldElkJzogbC50by5yZXBsYWNlKC9eeGVmLShzdGVwfHRyYW5zKS0vLCAnJyksXG4gIH0pKTtcblxuICByZXR1cm4ge1xuICAgIFN0ZXA6IHN0ZXBzLmxlbmd0aCA/IHN0ZXBzIDogdW5kZWZpbmVkLFxuICAgIFRyYW5zaXRpb246IHRyYW5zaXRpb25zLmxlbmd0aCA/IHRyYW5zaXRpb25zIDogdW5kZWZpbmVkLFxuICAgIFRyYW5zaXRpb25MaW5rOiBsaW5rcy5sZW5ndGggPyBsaW5rcyA6IHVuZGVmaW5lZCxcbiAgfTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQWFBLFNBQVMsVUFBVSxVQUFVLE1BQU0sTUFBTSxPQUFPLGtCQUFrQjtBQUNsRSxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGVBQWUsNEJBQTRCO0FBQ3BELFNBQVMsZ0JBQWdCLGdCQUFnQiw0QkFBNEI7QUFZckUsSUFBSSxPQUFPO0FBQ1gsU0FBUyxJQUFJLFFBQXdCO0FBQUUsU0FBTyxHQUFHLE1BQU0sSUFBSSxFQUFFLElBQUksSUFB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
