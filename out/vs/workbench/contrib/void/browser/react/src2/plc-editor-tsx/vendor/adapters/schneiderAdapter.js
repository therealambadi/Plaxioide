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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjMi9wbGMtZWRpdG9yLXRzeC92ZW5kb3IvYWRhcHRlcnMvc2NobmVpZGVyQWRhcHRlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLypcbiAqIFNjaG5laWRlciBFbGVjdHJpYyBYRUYvWkVGIEFkYXB0ZXIgKENvbnRyb2wgRXhwZXJ0IC8gRWNvU3RydXh1cmUgTWFjaGluZSBFeHBlcnQpXG4gKiBQYXJzZXMgLlhFRiAoWE1MLWJhc2VkKSBhbmQgLlpFRiAoWklQLWNvbXByZXNzZWQgWEVGKSBwcm9qZWN0IGZpbGVzLlxuICpcbiAqIEZpeGVzIGFwcGxpZWQ6XG4gKiAtIEVkZ2UgY29udGFjdHMgKFAvTiB0eXBlKSBwcm9wZXJseSBtYXBwZWRcbiAqIC0gU0ZDIHN0ZXAgYWN0aW9ucyBmdWxseSBwYXJzZWRcbiAqIC0gRkJEIHN0YW5kYWxvbmUgdmFyaWFibGUgbm9kZXMgaW1wb3J0ZWRcbiAqIC0gRkJEIGJsb2NrIHBpbiBkZXRhaWxzIHBvcHVsYXRlZFxuICogLSBTRkMgbGluayBkaXJlY3Rpb24gY29ycmVjdGVkIChzdGVwIHZzIHRyYW5zaXRpb24gZGV0ZWN0aW9uKVxuICogLSBaRUYgZGVjb21wcmVzc2lvbiBzdXBwb3J0XG4gKi9cblxuaW1wb3J0IHsgcGFyc2VYTUwsIGJ1aWxkWE1MLCBhdHRyLCB0ZXh0LCBjaGlsZCwgY2hpbGRBcnJheSB9IGZyb20gJy4uL3htbFV0aWxzLmpzJztcbmltcG9ydCB7IHNjaG5laWRlclR5cGVUb0lFQyB9IGZyb20gJy4uL2RhdGFUeXBlTWFwLmpzJztcbmltcG9ydCB7IGJ1aWxkUmVzb2x2ZXIsIFZhcmlhYmxlVHlwZVJlc29sdmVyIH0gZnJvbSAnLi4vdmFyaWFibGVUeXBlUmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgZ2V0UGluRGF0YVR5cGUsIGJ1aWxkVHlwZWRQaW5zLCBidWlsZFR5cGVkVGFnUmVmUGlucyB9IGZyb20gJy4uL3BpblNpZ25hdHVyZXMuanMnO1xuaW1wb3J0IHR5cGUge1xuICBJbXBvcnRSZXN1bHQsIEV4cG9ydFJlc3VsdCwgTm9ybWFsaXplZFByb2plY3QsIE5vcm1hbGl6ZWRQT1UsIE5vcm1hbGl6ZWRUYWcsXG4gIFZlbmRvck1ldGFkYXRhU2lkZWNhciwgVW5tYXBwZWRFbGVtZW50LFxufSBmcm9tICcuLi90eXBlcy5qcyc7XG5pbXBvcnQgdHlwZSB7XG4gIExhZGRlclByb2dyYW0sIEZCRFByb2dyYW0sIFNGQ1Byb2dyYW0sIFJ1bmcsIExhZGRlckVsZW1lbnQsXG4gIENvbnRhY3RFbGVtZW50LCBDb2lsRWxlbWVudCwgQmxvY2tFbGVtZW50LCBDb250YWN0VHlwZSwgQ29pbFR5cGUsXG4gIEZCRE5vZGUsIEZCRFdpcmUsIEZCREJsb2NrVHlwZSwgUGluLFxuICBTRkNTdGVwLCBTRkNUcmFuc2l0aW9uLCBTRkNMaW5rLCBTRkNBY3Rpb24sIEFjdGlvblF1YWxpZmllcixcbn0gZnJvbSAnLi4vLi4vbG9naWNTdG9yZS5qcyc7XG5cbmxldCBfdWlkID0gMDtcbmZ1bmN0aW9uIHVpZChwcmVmaXg6IHN0cmluZyk6IHN0cmluZyB7IHJldHVybiBgJHtwcmVmaXh9LSR7KytfdWlkfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIsIDgpfWA7IH1cblxuZnVuY3Rpb24gdW5lc2NhcGVYTUwoczogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHMucmVwbGFjZSgvJmFtcDsvZywgJyYnKS5yZXBsYWNlKC8mbHQ7L2csICc8JykucmVwbGFjZSgvJmd0Oy9nLCAnPicpLnJlcGxhY2UoLyZxdW90Oy9nLCAnXCInKS5yZXBsYWNlKC8mYXBvczsvZywgXCInXCIpO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgWkVGIERlY29tcHJlc3Npb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmFzeW5jIGZ1bmN0aW9uIGRlY29tcHJlc3NaRUYoZGF0YTogQXJyYXlCdWZmZXIpOiBQcm9taXNlPHN0cmluZz4ge1xuICBjb25zdCBieXRlcyA9IG5ldyBVaW50OEFycmF5KGRhdGEpO1xuXG4gIC8vIENoZWNrIGZvciBaSVAgbWFnaWMgaGVhZGVyIChQS1xceDAzXFx4MDQpXG4gIGlmICghKGJ5dGVzWzBdID09PSAweDUwICYmIGJ5dGVzWzFdID09PSAweDRCKSkge1xuICAgIC8vIE5vdCBhIFpJUCBcdTIwMTQgdHJlYXQgYXMgcGxhaW4gWE1MXG4gICAgcmV0dXJuIG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShkYXRhKTtcbiAgfVxuXG4gIC8vIFpJUCBmaWxlIFx1MjAxNCBpdGVyYXRlIGFsbCBsb2NhbCBmaWxlIGhlYWRlcnMgdG8gZmluZCB0aGUgWEVGL1hNTCBlbnRyeVxuICAvLyBMb2NhbCBmaWxlIGhlYWRlciBsYXlvdXQ6IHNpZyg0KSArIG1pblZlcigyKSArIGZsYWdzKDIpICsgbWV0aG9kKDIpICsgbW9kVGltZSgyKSArIG1vZERhdGUoMilcbiAgLy8gICArIGNyYzMyKDQpICsgY29tcFNpemUoNCkgKyB1bmNvbXBTaXplKDQpICsgZm5MZW4oMikgKyBleHRyYUxlbigyKSArIGZpbGVuYW1lKGZuTGVuKSArIGV4dHJhKGV4dHJhTGVuKSArIGRhdGFcbiAgbGV0IHBvcyA9IDA7XG4gIGxldCBiZXN0WG1sRW50cnk6IHsgc3RhcnQ6IG51bWJlcjsgY29tcFNpemU6IG51bWJlcjsgdW5jb21wU2l6ZTogbnVtYmVyOyBtZXRob2Q6IG51bWJlcjsgbmFtZTogc3RyaW5nIH0gfCBudWxsID0gbnVsbDtcblxuICB3aGlsZSAocG9zICsgMzAgPD0gYnl0ZXMubGVuZ3RoKSB7XG4gICAgY29uc3Qgc2lnID0gYnl0ZXNbcG9zXSB8IChieXRlc1twb3MrMV0gPDwgOCkgfCAoYnl0ZXNbcG9zKzJdIDw8IDE2KSB8IChieXRlc1twb3MrM10gPDwgMjQpO1xuICAgIGlmIChzaWcgIT09IDB4MDQwMzRiNTApIGJyZWFrOyAvLyBOb3QgYSBsb2NhbCBmaWxlIGhlYWRlciBcdTIwMTQgc3RvcCBzY2FubmluZ1xuXG4gICAgY29uc3QgbWV0aG9kID0gYnl0ZXNbcG9zKzhdIHwgKGJ5dGVzW3Bvcys5XSA8PCA4KTtcbiAgICBjb25zdCBjb21wU2l6ZSA9IGJ5dGVzW3BvcysxOF0gfCAoYnl0ZXNbcG9zKzE5XSA8PCA4KSB8IChieXRlc1twb3MrMjBdIDw8IDE2KSB8IChieXRlc1twb3MrMjFdIDw8IDI0KTtcbiAgICBjb25zdCB1bmNvbXBTaXplID0gYnl0ZXNbcG9zKzIyXSB8IChieXRlc1twb3MrMjNdIDw8IDgpIHwgKGJ5dGVzW3BvcysyNF0gPDwgMTYpIHwgKGJ5dGVzW3BvcysyNV0gPDwgMjQpO1xuICAgIGNvbnN0IGZuTGVuID0gYnl0ZXNbcG9zKzI2XSB8IChieXRlc1twb3MrMjddIDw8IDgpO1xuICAgIGNvbnN0IGV4dHJhTGVuID0gYnl0ZXNbcG9zKzI4XSB8IChieXRlc1twb3MrMjldIDw8IDgpO1xuICAgIGNvbnN0IGZuQnl0ZXMgPSBieXRlcy5zbGljZShwb3MgKyAzMCwgcG9zICsgMzAgKyBmbkxlbik7XG4gICAgY29uc3QgZmlsZU5hbWUgPSBuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUoZm5CeXRlcykudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCBkYXRhU3RhcnQgPSBwb3MgKyAzMCArIGZuTGVuICsgZXh0cmFMZW47XG5cbiAgICAvLyBQcmVmZXIgdGhlIC54ZWYgb3IgLnhtbCBlbnRyeTsgc2tpcCBkaXJlY3RvcnkgZW50cmllcyBhbmQgRFRNIGZpbGVzXG4gICAgaWYgKChmaWxlTmFtZS5lbmRzV2l0aCgnLnhlZicpIHx8IGZpbGVOYW1lLmVuZHNXaXRoKCcueG1sJykpICYmICFmaWxlTmFtZS5pbmNsdWRlcygnZmR0ZHRtJykgJiYgY29tcFNpemUgPiAwKSB7XG4gICAgICBiZXN0WG1sRW50cnkgPSB7IHN0YXJ0OiBkYXRhU3RhcnQsIGNvbXBTaXplLCB1bmNvbXBTaXplLCBtZXRob2QsIG5hbWU6IGZpbGVOYW1lIH07XG4gICAgICBicmVhazsgLy8gRmlyc3QgbWF0Y2hpbmcgZW50cnkgaXMgdXN1YWxseSB0aGUgbWFpbiBwcm9qZWN0XG4gICAgfVxuXG4gICAgcG9zID0gZGF0YVN0YXJ0ICsgKGNvbXBTaXplID4gMCA/IGNvbXBTaXplIDogdW5jb21wU2l6ZSk7XG4gIH1cblxuICBpZiAoIWJlc3RYbWxFbnRyeSkge1xuICAgIC8vIE5vIFhNTCBlbnRyeSBmb3VuZCBcdTIwMTQgZmFsbCBiYWNrIHRvIHRyeWluZyBmaXJzdCBlbnRyeVxuICAgIGNvbnN0IGZuTGVuID0gYnl0ZXNbMjZdIHwgKGJ5dGVzWzI3XSA8PCA4KTtcbiAgICBjb25zdCBleHRyYUxlbiA9IGJ5dGVzWzI4XSB8IChieXRlc1syOV0gPDwgOCk7XG4gICAgYmVzdFhtbEVudHJ5ID0ge1xuICAgICAgc3RhcnQ6IDMwICsgZm5MZW4gKyBleHRyYUxlbixcbiAgICAgIGNvbXBTaXplOiBieXRlc1sxOF0gfCAoYnl0ZXNbMTldIDw8IDgpIHwgKGJ5dGVzWzIwXSA8PCAxNikgfCAoYnl0ZXNbMjFdIDw8IDI0KSxcbiAgICAgIHVuY29tcFNpemU6IGJ5dGVzWzIyXSB8IChieXRlc1syM10gPDwgOCkgfCAoYnl0ZXNbMjRdIDw8IDE2KSB8IChieXRlc1syNV0gPDwgMjQpLFxuICAgICAgbWV0aG9kOiBieXRlc1s4XSB8IChieXRlc1s5XSA8PCA4KSxcbiAgICAgIG5hbWU6ICdmYWxsYmFjaycsXG4gICAgfTtcbiAgfVxuXG4gIC8vIE1ldGhvZCAwID0gc3RvcmVkIChubyBjb21wcmVzc2lvbilcbiAgaWYgKGJlc3RYbWxFbnRyeS5tZXRob2QgPT09IDApIHtcbiAgICByZXR1cm4gbmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKGJ5dGVzLnNsaWNlKGJlc3RYbWxFbnRyeS5zdGFydCwgYmVzdFhtbEVudHJ5LnN0YXJ0ICsgYmVzdFhtbEVudHJ5LnVuY29tcFNpemUpKTtcbiAgfVxuXG4gIC8vIE1ldGhvZCA4ID0gZGVmbGF0ZVxuICB0cnkge1xuICAgIGNvbnN0IGRzID0gbmV3IERlY29tcHJlc3Npb25TdHJlYW0oJ2RlZmxhdGUtcmF3Jyk7XG4gICAgY29uc3QgY29tcHJlc3NlZERhdGEgPSBieXRlcy5zbGljZShiZXN0WG1sRW50cnkuc3RhcnQsIGJlc3RYbWxFbnRyeS5zdGFydCArIGJlc3RYbWxFbnRyeS5jb21wU2l6ZSk7XG4gICAgY29uc3QgYmxvYiA9IG5ldyBCbG9iKFtjb21wcmVzc2VkRGF0YV0pO1xuICAgIGNvbnN0IHN0cmVhbSA9IGJsb2Iuc3RyZWFtKCkucGlwZVRocm91Z2goZHMpO1xuICAgIGNvbnN0IHJlYWRlciA9IHN0cmVhbS5nZXRSZWFkZXIoKTtcbiAgICBjb25zdCBjaHVua3M6IFVpbnQ4QXJyYXlbXSA9IFtdO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBjb25zdCB7IGRvbmUsIHZhbHVlIH0gPSBhd2FpdCByZWFkZXIucmVhZCgpO1xuICAgICAgaWYgKGRvbmUpIGJyZWFrO1xuICAgICAgY2h1bmtzLnB1c2godmFsdWUpO1xuICAgIH1cbiAgICBjb25zdCB0b3RhbExlbiA9IGNodW5rcy5yZWR1Y2UoKHN1bSwgYykgPT4gc3VtICsgYy5sZW5ndGgsIDApO1xuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KHRvdGFsTGVuKTtcbiAgICBsZXQgb2Zmc2V0ID0gMDtcbiAgICBmb3IgKGNvbnN0IGNodW5rIG9mIGNodW5rcykgeyByZXN1bHQuc2V0KGNodW5rLCBvZmZzZXQpOyBvZmZzZXQgKz0gY2h1bmsubGVuZ3RoOyB9XG4gICAgcmV0dXJuIG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShyZXN1bHQpO1xuICB9IGNhdGNoIHtcbiAgICAvLyBGYWxsYmFjazogZ3ppcCB3cmFwcGVyXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGRzID0gbmV3IERlY29tcHJlc3Npb25TdHJlYW0oJ2RlZmxhdGUnKTtcbiAgICAgIGNvbnN0IGJsb2IgPSBuZXcgQmxvYihbYnl0ZXMuc2xpY2UoYmVzdFhtbEVudHJ5LnN0YXJ0LCBiZXN0WG1sRW50cnkuc3RhcnQgKyBiZXN0WG1sRW50cnkuY29tcFNpemUpXSk7XG4gICAgICBjb25zdCBzdHJlYW0gPSBibG9iLnN0cmVhbSgpLnBpcGVUaHJvdWdoKGRzKTtcbiAgICAgIGNvbnN0IHJlYWRlciA9IHN0cmVhbS5nZXRSZWFkZXIoKTtcbiAgICAgIGNvbnN0IGNodW5rczogVWludDhBcnJheVtdID0gW107XG4gICAgICB3aGlsZSAodHJ1ZSkgeyBjb25zdCB7IGRvbmUsIHZhbHVlIH0gPSBhd2FpdCByZWFkZXIucmVhZCgpOyBpZiAoZG9uZSkgYnJlYWs7IGNodW5rcy5wdXNoKHZhbHVlKTsgfVxuICAgICAgY29uc3QgdG90YWxMZW4gPSBjaHVua3MucmVkdWNlKChzLCBjKSA9PiBzICsgYy5sZW5ndGgsIDApO1xuICAgICAgY29uc3QgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkodG90YWxMZW4pO1xuICAgICAgbGV0IG9mZnNldCA9IDA7XG4gICAgICBmb3IgKGNvbnN0IGNodW5rIG9mIGNodW5rcykgeyByZXN1bHQuc2V0KGNodW5rLCBvZmZzZXQpOyBvZmZzZXQgKz0gY2h1bmsubGVuZ3RoOyB9XG4gICAgICByZXR1cm4gbmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKHJlc3VsdCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBkZWNvbXByZXNzIFpFRiBmaWxlIGVudHJ5IFwiJHtiZXN0WG1sRW50cnkubmFtZX1cImApO1xuICAgIH1cbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgSW1wb3J0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgZnVuY3Rpb24gaW1wb3J0U2NobmVpZGVyKHhtbENvbnRlbnQ6IHN0cmluZywgZmlsZVBhdGg6IHN0cmluZyk6IEltcG9ydFJlc3VsdCB7XG4gIF91aWQgPSAwO1xuICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10gPSBbXTtcblxuICBsZXQgcm9vdDogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIHRyeSB7XG4gICAgcm9vdCA9IHBhcnNlWE1MKHhtbENvbnRlbnQpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcnM6IFtgWE1MIHBhcnNlIGVycm9yOiAke2V9YF0sIHdhcm5pbmdzOiBbXSB9O1xuICB9XG5cbiAgLy8gWEVGIHJvb3Q6IDxGRUZFeGNoYW5nZUZpbGU+IChyZWFsIFhFRiksIDxQcm9qZWN0RmlsZT4sIG9yIDxwcm9qZWN0PlxuICBjb25zdCBmZWZSb290ID0gY2hpbGQocm9vdCwgJ0ZFRkV4Y2hhbmdlRmlsZScpID8/IGNoaWxkKHJvb3QsICdQcm9qZWN0RmlsZScpID8/IGNoaWxkKHJvb3QsICdwcm9qZWN0JykgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCB1bmRlZmluZWQ7XG4gIGlmICghZmVmUm9vdCkge1xuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3JzOiBbJ05vIDxGRUZFeGNoYW5nZUZpbGU+IG9yIDxQcm9qZWN0RmlsZT4gcm9vdCBmb3VuZCBpbiBYRUYgZmlsZSddLCB3YXJuaW5nczogW10gfTtcbiAgfVxuICAvLyBGb3IgYmFja3dhcmQtY29tcGF0IHdpdGggb2xkIGNvZGUgcGF0aHMsIGFsaWFzIHByb2plY3RGaWxlIC0+IGZlZlJvb3RcbiAgY29uc3QgcHJvamVjdEZpbGUgPSBmZWZSb290O1xuXG4gIGNvbnN0IHByb2plY3ROYW1lID0gYXR0cihwcm9qZWN0RmlsZSwgJ05hbWUnKSB8fCBhdHRyKHByb2plY3RGaWxlLCAnbmFtZScpIHx8ICdTY2huZWlkZXIgSW1wb3J0JztcbiAgY29uc3QgdmVyc2lvbiA9IGF0dHIocHJvamVjdEZpbGUsICdWZXJzaW9uJykgfHwgJzEuMCc7XG5cbiAgY29uc3QgZ2xvYmFsVGFnczogTm9ybWFsaXplZFRhZ1tdID0gW107XG4gIGNvbnN0IHBvdXM6IE5vcm1hbGl6ZWRQT1VbXSA9IFtdO1xuXG4gIC8vIEJ1ZyAyOiBHbG9iYWwgdmFyaWFibGVzIFx1MjAxNCByZWFsIFhFRiB1c2VzIDxkYXRhQmxvY2s+PHZhcmlhYmxlcyAuLi4+XG4gIGNvbnN0IGRhdGFCbG9jayA9IGNoaWxkKGZlZlJvb3QsICdkYXRhQmxvY2snKTtcbiAgaWYgKGRhdGFCbG9jaykge1xuICAgIGZvciAoY29uc3QgdmFyRWwgb2YgY2hpbGRBcnJheShkYXRhQmxvY2ssICd2YXJpYWJsZXMnKSkge1xuICAgICAgY29uc3QgdGFnID0gcGFyc2VYRUZWYXJpYWJsZSh2YXJFbCwgdW5tYXBwZWQpO1xuICAgICAgaWYgKHRhZykgZ2xvYmFsVGFncy5wdXNoKHRhZyk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBvbGRlciBmb3JtYXQgd2l0aCBHbG9iYWxTZWN0aW9uXG4gICAgY29uc3QgZGF0YUVsID0gY2hpbGQocHJvamVjdEZpbGUsICdEYXRhJykgPz8gcHJvamVjdEZpbGU7XG4gICAgY29uc3QgZ2xvYmFsU2VjdGlvbiA9IGNoaWxkKGRhdGFFbCwgJ0dsb2JhbFNlY3Rpb24nKSA/PyBjaGlsZChwcm9qZWN0RmlsZSwgJ0dsb2JhbCcpO1xuICAgIGlmIChnbG9iYWxTZWN0aW9uKSB7XG4gICAgICBmb3IgKGNvbnN0IHZhckVsIG9mIGNoaWxkQXJyYXkoZ2xvYmFsU2VjdGlvbiwgJ1ZhcmlhYmxlJykuY29uY2F0KGNoaWxkQXJyYXkoZ2xvYmFsU2VjdGlvbiwgJ1ZhcicpKS5jb25jYXQoY2hpbGRBcnJheShnbG9iYWxTZWN0aW9uLCAndmFyaWFibGVzJykpKSB7XG4gICAgICAgIGNvbnN0IHRhZyA9IHBhcnNlWEVGVmFyaWFibGUodmFyRWwsIHVubWFwcGVkKTtcbiAgICAgICAgaWYgKHRhZykgZ2xvYmFsVGFncy5wdXNoKHRhZyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gUGFyc2UgRkJTb3VyY2UgKGZ1bmN0aW9uIGJsb2NrIHR5cGUgZGVmaW5pdGlvbnMpIGFzIGZ1bmN0aW9uLWJsb2NrIFBPVXNcbiAgZm9yIChjb25zdCBmYlNyYyBvZiBjaGlsZEFycmF5KGZlZlJvb3QsICdGQlNvdXJjZScpKSB7XG4gICAgY29uc3QgZmJUeXBlTmFtZSA9IGF0dHIoZmJTcmMsICduYW1lT2ZGQlR5cGUnKSB8fCAnRkInO1xuICAgIGNvbnN0IGxvY2FsVGFnczogTm9ybWFsaXplZFRhZ1tdID0gW107XG4gICAgLy8gSW5wdXQvb3V0cHV0L2xvY2FsIHBhcmFtZXRlcnNcbiAgICBmb3IgKGNvbnN0IHYgb2YgY2hpbGRBcnJheShjaGlsZChmYlNyYywgJ2lucHV0UGFyYW1ldGVycycpLCAndmFyaWFibGVzJykpIHtcbiAgICAgIGNvbnN0IHRhZyA9IHBhcnNlWEVGVmFyaWFibGUodiwgdW5tYXBwZWQpO1xuICAgICAgaWYgKHRhZykgeyAodGFnIGFzIGFueSkuX3BhcmFtRGlyID0gJ2lucHV0JzsgbG9jYWxUYWdzLnB1c2godGFnKTsgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IHYgb2YgY2hpbGRBcnJheShjaGlsZChmYlNyYywgJ291dHB1dFBhcmFtZXRlcnMnKSwgJ3ZhcmlhYmxlcycpKSB7XG4gICAgICBjb25zdCB0YWcgPSBwYXJzZVhFRlZhcmlhYmxlKHYsIHVubWFwcGVkKTtcbiAgICAgIGlmICh0YWcpIHsgKHRhZyBhcyBhbnkpLl9wYXJhbURpciA9ICdvdXRwdXQnOyBsb2NhbFRhZ3MucHVzaCh0YWcpOyB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgdiBvZiBjaGlsZEFycmF5KGNoaWxkKGZiU3JjLCAnaW5PdXRQYXJhbWV0ZXJzJyksICd2YXJpYWJsZXMnKSkge1xuICAgICAgY29uc3QgdGFnID0gcGFyc2VYRUZWYXJpYWJsZSh2LCB1bm1hcHBlZCk7XG4gICAgICBpZiAodGFnKSB7ICh0YWcgYXMgYW55KS5fcGFyYW1EaXIgPSAnaW5vdXQnOyBsb2NhbFRhZ3MucHVzaCh0YWcpOyB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgdiBvZiBjaGlsZEFycmF5KGNoaWxkKGZiU3JjLCAncHVibGljTG9jYWxWYXJpYWJsZXMnKSwgJ3ZhcmlhYmxlcycpKSB7XG4gICAgICBjb25zdCB0YWcgPSBwYXJzZVhFRlZhcmlhYmxlKHYsIHVubWFwcGVkKTtcbiAgICAgIGlmICh0YWcpIGxvY2FsVGFncy5wdXNoKHRhZyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdiBvZiBjaGlsZEFycmF5KGNoaWxkKGZiU3JjLCAncHJpdmF0ZUxvY2FsVmFyaWFibGVzJyksICd2YXJpYWJsZXMnKSkge1xuICAgICAgY29uc3QgdGFnID0gcGFyc2VYRUZWYXJpYWJsZSh2LCB1bm1hcHBlZCk7XG4gICAgICBpZiAodGFnKSBsb2NhbFRhZ3MucHVzaCh0YWcpO1xuICAgIH1cbiAgICAvLyBQYXJzZSBGQlByb2dyYW0gYm9keVxuICAgIGNvbnN0IGZiUHJvZ0VsID0gY2hpbGQoZmJTcmMsICdGQlByb2dyYW0nKTtcbiAgICBpZiAoZmJQcm9nRWwpIHtcbiAgICAgIGNvbnN0IGZiZFNvdXJjZUVsID0gY2hpbGQoZmJQcm9nRWwsICdGQkRTb3VyY2UnKTtcbiAgICAgIGlmIChmYmRTb3VyY2VFbCkge1xuICAgICAgICBjb25zdCByZXNvbHZlciA9IGJ1aWxkUmVzb2x2ZXIobG9jYWxUYWdzLCBbXSk7XG4gICAgICAgIGNvbnN0IGJvZHlFbCA9IGNoaWxkKGZiZFNvdXJjZUVsLCAnbmV0d29ya0ZCRCcpID8/IGZiZFNvdXJjZUVsO1xuICAgICAgICBjb25zdCBmYmQgPSBwYXJzZVhFRkZCRChib2R5RWwsIGZiVHlwZU5hbWUsIHVubWFwcGVkLCByZXNvbHZlcik7XG4gICAgICAgIGNvbnN0IG5iUm93cyA9IGF0dHIoZmJkU291cmNlRWwsICduYlJvd3MnKTtcbiAgICAgICAgY29uc3QgbmJDb2x1bW5zID0gYXR0cihmYmRTb3VyY2VFbCwgJ25iQ29sdW1ucycpO1xuICAgICAgICBpZiAobmJSb3dzIHx8IG5iQ29sdW1ucykgKGZiZCBhcyBhbnkpLl94ZWZHcmlkID0geyBuYlJvd3MsIG5iQ29sdW1ucyB9O1xuICAgICAgICBwb3VzLnB1c2goeyBpZDogYHBvdS0ke2ZiVHlwZU5hbWV9YCwgbmFtZTogZmJUeXBlTmFtZSwgbGFuZ3VhZ2U6ICdGQkQnLCBmYmRQcm9ncmFtOiBmYmQsIGxvY2FsVGFncywgcG91VHlwZTogJ2Z1bmN0aW9uQmxvY2snIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3Qgc3RTcmMgPSB0ZXh0KGNoaWxkKGZiUHJvZ0VsLCAnU1RTb3VyY2UnKSA/PyBmYlByb2dFbCk7XG4gICAgICAgIHBvdXMucHVzaCh7IGlkOiBgcG91LSR7ZmJUeXBlTmFtZX1gLCBuYW1lOiBmYlR5cGVOYW1lLCBsYW5ndWFnZTogJ1NUJywgc3RTb3VyY2U6IHN0U3JjID8gdW5lc2NhcGVYTUwoc3RTcmMpIDogJycsIGxvY2FsVGFncywgcG91VHlwZTogJ2Z1bmN0aW9uQmxvY2snIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEJ1ZyA0OiBQcm9ncmFtcyBcdTIwMTQgcmVhbCBYRUYgaGFzIDxwcm9ncmFtPiBkaXJlY3RseSB1bmRlciA8RkVGRXhjaGFuZ2VGaWxlPiwgbm8gd3JhcHBlclxuICBjb25zdCBkaXJlY3RQcm9ncmFtcyA9IGNoaWxkQXJyYXkoZmVmUm9vdCwgJ3Byb2dyYW0nKTtcbiAgaWYgKGRpcmVjdFByb2dyYW1zLmxlbmd0aCA+IDApIHtcbiAgICBmb3IgKGNvbnN0IHByb2dyYW1FbCBvZiBkaXJlY3RQcm9ncmFtcykge1xuICAgICAgY29uc3QgcG91ID0gcGFyc2VYRUZQcm9ncmFtRkVGKHByb2dyYW1FbCwgdW5tYXBwZWQsIHdhcm5pbmdzKTtcbiAgICAgIGlmIChwb3UpIHBvdXMucHVzaChwb3UpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogb2xkZXIgZm9ybWF0IHdpdGggUHJvZ3JhbXMgd3JhcHBlclxuICAgIGNvbnN0IGRhdGFFbCA9IGNoaWxkKHByb2plY3RGaWxlLCAnRGF0YScpID8/IHByb2plY3RGaWxlO1xuICAgIGNvbnN0IHByb2dyYW1zRWwgPSBjaGlsZChkYXRhRWwsICdQcm9ncmFtcycpID8/IGNoaWxkKHByb2plY3RGaWxlLCAnUHJvZ3JhbXMnKTtcbiAgICBmb3IgKGNvbnN0IHByb2dyYW1FbCBvZiBjaGlsZEFycmF5KHByb2dyYW1zRWwsICdQcm9ncmFtJykuY29uY2F0KGNoaWxkQXJyYXkocHJvZ3JhbXNFbCwgJ1BPVScpKSkge1xuICAgICAgY29uc3QgcG91ID0gcGFyc2VYRUZQcm9ncmFtKHByb2dyYW1FbCwgdW5tYXBwZWQsIHdhcm5pbmdzKTtcbiAgICAgIGlmIChwb3UpIHBvdXMucHVzaChwb3UpO1xuICAgIH1cbiAgfVxuXG4gIC8vIEFsc28gY2hlY2sgZGlyZWN0IHNlY3Rpb25zIChsZWdhY3kgZm9ybWF0KVxuICBjb25zdCBfZGF0YUVsRm9yU2VjdGlvbnMgPSBjaGlsZChwcm9qZWN0RmlsZSwgJ0RhdGEnKSA/PyBwcm9qZWN0RmlsZTtcbiAgZm9yIChjb25zdCBzZWN0aW9uIG9mIGNoaWxkQXJyYXkoX2RhdGFFbEZvclNlY3Rpb25zLCAnU2VjdGlvbicpLmNvbmNhdChjaGlsZEFycmF5KHByb2plY3RGaWxlLCAnU2VjdGlvbicpKSkge1xuICAgIGNvbnN0IHNlY3Rpb25UeXBlID0gYXR0cihzZWN0aW9uLCAnVHlwZScpIHx8IGF0dHIoc2VjdGlvbiwgJ2xhbmd1YWdlJykgfHwgJyc7XG4gICAgY29uc3Qgc2VjdGlvbk5hbWUgPSBhdHRyKHNlY3Rpb24sICdOYW1lJykgfHwgYXR0cihzZWN0aW9uLCAnbmFtZScpIHx8ICdTZWN0aW9uJztcblxuICAgIGlmIChzZWN0aW9uVHlwZS50b1VwcGVyQ2FzZSgpID09PSAnTEQnIHx8IHNlY3Rpb25UeXBlLnRvVXBwZXJDYXNlKCkgPT09ICdMQURERVInKSB7XG4gICAgICBjb25zdCBsYWRkZXIgPSBwYXJzZVhFRkxhZGRlcihzZWN0aW9uLCBzZWN0aW9uTmFtZSwgdW5tYXBwZWQpO1xuICAgICAgcG91cy5wdXNoKHsgaWQ6IGBwb3UtJHtzZWN0aW9uTmFtZX1gLCBuYW1lOiBzZWN0aW9uTmFtZSwgbGFuZ3VhZ2U6ICdMRCcsIGxhZGRlclByb2dyYW06IGxhZGRlciwgbG9jYWxUYWdzOiBbXSB9KTtcbiAgICB9IGVsc2UgaWYgKHNlY3Rpb25UeXBlLnRvVXBwZXJDYXNlKCkgPT09ICdGQkQnKSB7XG4gICAgICBjb25zdCBmYmQgPSBwYXJzZVhFRkZCRChzZWN0aW9uLCBzZWN0aW9uTmFtZSwgdW5tYXBwZWQpO1xuICAgICAgcG91cy5wdXNoKHsgaWQ6IGBwb3UtJHtzZWN0aW9uTmFtZX1gLCBuYW1lOiBzZWN0aW9uTmFtZSwgbGFuZ3VhZ2U6ICdGQkQnLCBmYmRQcm9ncmFtOiBmYmQsIGxvY2FsVGFnczogW10gfSk7XG4gICAgfSBlbHNlIGlmIChzZWN0aW9uVHlwZS50b1VwcGVyQ2FzZSgpID09PSAnU0ZDJykge1xuICAgICAgY29uc3Qgc2ZjID0gcGFyc2VYRUZTRkMoc2VjdGlvbiwgc2VjdGlvbk5hbWUsIHVubWFwcGVkKTtcbiAgICAgIHBvdXMucHVzaCh7IGlkOiBgcG91LSR7c2VjdGlvbk5hbWV9YCwgbmFtZTogc2VjdGlvbk5hbWUsIGxhbmd1YWdlOiAnU0ZDJywgc2ZjUHJvZ3JhbTogc2ZjLCBsb2NhbFRhZ3M6IFtdIH0pO1xuICAgIH0gZWxzZSBpZiAoc2VjdGlvblR5cGUudG9VcHBlckNhc2UoKSA9PT0gJ1NUJyB8fCBzZWN0aW9uVHlwZS50b1VwcGVyQ2FzZSgpID09PSAnSUwnKSB7XG4gICAgICBjb25zdCByYXdTdFNyYyA9IHRleHQoY2hpbGQoc2VjdGlvbiwgJ0JvZHknKSA/PyBzZWN0aW9uKTtcbiAgICAgIGNvbnN0IHN0U3JjID0gcmF3U3RTcmMgPyB1bmVzY2FwZVhNTChyYXdTdFNyYykgOiByYXdTdFNyYztcbiAgICAgIGlmIChzZWN0aW9uVHlwZS50b1VwcGVyQ2FzZSgpID09PSAnSUwnKSB7XG4gICAgICAgIHdhcm5pbmdzLnB1c2goYFNlY3Rpb24gXCIke3NlY3Rpb25OYW1lfVwiIHVzZXMgSUwgXHUyMDE0IGltcG9ydGluZyBhcyBTVCB0ZXh0IChyZXZpZXcgcmVxdWlyZWQpYCk7XG4gICAgICB9XG4gICAgICBwb3VzLnB1c2goeyBpZDogYHBvdS0ke3NlY3Rpb25OYW1lfWAsIG5hbWU6IHNlY3Rpb25OYW1lLCBsYW5ndWFnZTogJ1NUJywgc3RTb3VyY2U6IHN0U3JjLCBsb2NhbFRhZ3M6IFtdIH0pO1xuICAgIH0gZWxzZSBpZiAoc2VjdGlvblR5cGUpIHtcbiAgICAgIHVubWFwcGVkLnB1c2goeyBjbG1Ob2RlSWQ6IG51bGwsIHZlbmRvclNwZWNpZmljRGF0YTogc2VjdGlvbiwgcmVhc29uOiBgVW5rbm93biBzZWN0aW9uIHR5cGU6ICR7c2VjdGlvblR5cGV9YCB9KTtcbiAgICB9XG4gIH1cblxuICBpZiAocG91cy5sZW5ndGggPT09IDAgJiYgZ2xvYmFsVGFncy5sZW5ndGggPT09IDApIHtcbiAgICBlcnJvcnMucHVzaCgnTm8gcHJvZ3JhbXMsIFBPVXMsIG9yIHRhZ3MgZm91bmQgaW4gWEVGIGZpbGUnKTtcbiAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9ycywgd2FybmluZ3MgfTtcbiAgfVxuXG4gIGNvbnN0IHNpZGVjYXI6IFZlbmRvck1ldGFkYXRhU2lkZWNhciA9IHtcbiAgICBzb3VyY2VWZW5kb3I6ICdzY2huZWlkZXJfeGVmJyxcbiAgICBzb3VyY2VGaWxlVmVyc2lvbjogdmVyc2lvbixcbiAgICBvcmlnaW5hbEZpbGVQYXRoOiBmaWxlUGF0aCxcbiAgICB1bm1hcHBlZEVsZW1lbnRzOiB1bm1hcHBlZCxcbiAgICBvcmdhbml6ZXJUcmVlTGF5b3V0OiBmZWZSb290LFxuICAgIHZlbmRvclNwZWNpZmljR2xvYmFsczogeyB2ZXJzaW9uLCBwcm9qZWN0TmFtZTogYXR0cihwcm9qZWN0RmlsZSwgJ05hbWUnKSB9LFxuICB9O1xuXG4gIHJldHVybiB7IG9rOiB0cnVlLCBwcm9qZWN0OiB7IHByb2plY3ROYW1lLCBwb3VzLCBnbG9iYWxUYWdzLCBzaWRlY2FyIH0sIGVycm9ycywgd2FybmluZ3MgfTtcbn1cblxuLy8gRXhwb3J0ZWQgZm9yIFpFRiBmaWxlcyBcdTIwMTQgY2FsbCB3aXRoIHByZS1kZWNvbXByZXNzZWQgY29udGVudFxuZXhwb3J0IHsgZGVjb21wcmVzc1pFRiB9O1xuXG5mdW5jdGlvbiBwYXJzZVhFRlZhcmlhYmxlKHZhckVsOiB1bmtub3duLCB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10pOiBOb3JtYWxpemVkVGFnIHwgbnVsbCB7XG4gIGlmICghdmFyRWwgfHwgdHlwZW9mIHZhckVsICE9PSAnb2JqZWN0JykgcmV0dXJuIG51bGw7XG4gIGNvbnN0IG5hbWUgPSBhdHRyKHZhckVsLCAnbmFtZScpIHx8IGF0dHIodmFyRWwsICdOYW1lJyk7XG4gIGlmICghbmFtZSkgcmV0dXJuIG51bGw7XG4gIC8vIEJ1ZyAzOiB0eXBlTmFtZSBmaXJzdCAocmVhbCBYRUYpLCB0aGVuIGxlZ2FjeSBUeXBlL3R5cGVcbiAgY29uc3QgdHlwZVN0ciA9IGF0dHIodmFyRWwsICd0eXBlTmFtZScpIHx8IGF0dHIodmFyRWwsICdUeXBlJykgfHwgYXR0cih2YXJFbCwgJ3R5cGUnKSB8fCAnQk9PTCc7XG4gIGNvbnN0IGRhdGFUeXBlID0gc2NobmVpZGVyVHlwZVRvSUVDKHR5cGVTdHIpO1xuICAvLyBCdWcgMzogdG9wb2xvZ2ljYWxBZGRyZXNzIGZpcnN0IChyZWFsIFhFRiksIHRoZW4gbGVnYWN5XG4gIGNvbnN0IGFkZHJlc3MgPSBhdHRyKHZhckVsLCAndG9wb2xvZ2ljYWxBZGRyZXNzJykgfHwgYXR0cih2YXJFbCwgJ0FkZHJlc3MnKSB8fCBhdHRyKHZhckVsLCAnVG9wb2xvZ2ljYWwnKSB8fCB1bmRlZmluZWQ7XG4gIC8vIEJ1ZyAzOiB2YXJpYWJsZUluaXQgY2hpbGQgdmFsdWUgZmlyc3QsIHRoZW4gbGVnYWN5XG4gIGNvbnN0IGluaXRWYWwgPSBhdHRyKGNoaWxkKHZhckVsLCAndmFyaWFibGVJbml0JyksICd2YWx1ZScpIHx8IGF0dHIodmFyRWwsICdJbml0aWFsVmFsdWUnKSB8fCB0ZXh0KGNoaWxkKHZhckVsLCAnSW5pdGlhbFZhbHVlJykpIHx8IHVuZGVmaW5lZDtcbiAgLy8gQnVnIDM6IGxvd2VyY2FzZSBjb21tZW50IGZpcnN0IChyZWFsIFhFRiksIHRoZW4gbGVnYWN5XG4gIGNvbnN0IGRlc2MgPSB0ZXh0KGNoaWxkKHZhckVsLCAnY29tbWVudCcpID8/IGNoaWxkKHZhckVsLCAnQ29tbWVudCcpID8/IGNoaWxkKHZhckVsLCAnRGVzY3JpcHRpb24nKSkgfHwgdW5kZWZpbmVkO1xuXG4gIC8vIFByZXNlcnZlIGF0dHJpYnV0ZSBjaGlsZHJlbiAoVGltZVN0YW1wU291cmNlLCBERFRTb3VyY2UsIFBvc2l0aW9uUGluLCBldGMuKVxuICBjb25zdCBhdHRyaWJ1dGVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+W10gPSBbXTtcbiAgZm9yIChjb25zdCBhdHRyRWwgb2YgY2hpbGRBcnJheSh2YXJFbCwgJ2F0dHJpYnV0ZScpKSB7XG4gICAgY29uc3QgYXR0ck5hbWUgPSBhdHRyKGF0dHJFbCwgJ25hbWUnKTtcbiAgICBjb25zdCBhdHRyVmFsdWUgPSBhdHRyKGF0dHJFbCwgJ3ZhbHVlJyk7XG4gICAgaWYgKGF0dHJOYW1lKSBhdHRyaWJ1dGVzLnB1c2goeyBuYW1lOiBhdHRyTmFtZSwgdmFsdWU6IGF0dHJWYWx1ZSB8fCAnJyB9KTtcbiAgfVxuXG4gIGlmICh0eXBlU3RyLnRvVXBwZXJDYXNlKCkgPT09ICdFQk9PTCcpIHtcbiAgICB1bm1hcHBlZC5wdXNoKHsgY2xtTm9kZUlkOiBuYW1lLCB2ZW5kb3JTcGVjaWZpY0RhdGE6IHsgb3JpZ2luYWxUeXBlOiAnRUJPT0wnIH0sIHJlYXNvbjogJ0VCT09MIG1hcHBlZCB0byBCT09MIChlZGdlIGJpdCBzZW1hbnRpY3MgbG9zdCknIH0pO1xuICB9XG5cbiAgY29uc3QgdGFnOiBOb3JtYWxpemVkVGFnID0geyBuYW1lLCBkYXRhVHlwZSwgaW5pdGlhbFZhbHVlOiBpbml0VmFsLCBkZXNjcmlwdGlvbjogZGVzYywgYWRkcmVzcyB9O1xuICAvLyBTdGFzaCB2ZW5kb3Itc3BlY2lmaWMgYXR0cmlidXRlcyBmb3Igcm91bmQtdHJpcFxuICBpZiAoYXR0cmlidXRlcy5sZW5ndGggPiAwIHx8IHR5cGVTdHIudG9VcHBlckNhc2UoKSA9PT0gJ0VCT09MJykge1xuICAgICh0YWcgYXMgYW55KS5feGVmTWV0YSA9IHsgb3JpZ2luYWxUeXBlOiB0eXBlU3RyLCBhdHRyaWJ1dGVzIH07XG4gIH1cbiAgcmV0dXJuIHRhZztcbn1cblxuZnVuY3Rpb24gcGFyc2VYRUZQcm9ncmFtKHByb2dyYW1FbDogdW5rbm93biwgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdLCB3YXJuaW5nczogc3RyaW5nW10pOiBOb3JtYWxpemVkUE9VIHwgbnVsbCB7XG4gIGlmICghcHJvZ3JhbUVsIHx8IHR5cGVvZiBwcm9ncmFtRWwgIT09ICdvYmplY3QnKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgbmFtZSA9IGF0dHIocHJvZ3JhbUVsLCAnTmFtZScpIHx8IGF0dHIocHJvZ3JhbUVsLCAnbmFtZScpIHx8ICdQcm9ncmFtJztcbiAgY29uc3QgbGFuZ3VhZ2UgPSAoYXR0cihwcm9ncmFtRWwsICdMYW5ndWFnZScpIHx8IGF0dHIocHJvZ3JhbUVsLCAnbGFuZ3VhZ2UnKSB8fCAnTEQnKS50b1VwcGVyQ2FzZSgpO1xuXG4gIGNvbnN0IGxvY2FsVGFnczogTm9ybWFsaXplZFRhZ1tdID0gW107XG4gIGNvbnN0IHZhcnNFbCA9IGNoaWxkKHByb2dyYW1FbCwgJ1ZhcmlhYmxlcycpID8/IGNoaWxkKHByb2dyYW1FbCwgJ0xvY2FsVmFycycpO1xuICBmb3IgKGNvbnN0IHYgb2YgY2hpbGRBcnJheSh2YXJzRWwsICdWYXJpYWJsZScpLmNvbmNhdChjaGlsZEFycmF5KHZhcnNFbCwgJ1ZhcicpKSkge1xuICAgIGNvbnN0IHRhZyA9IHBhcnNlWEVGVmFyaWFibGUodiwgdW5tYXBwZWQpO1xuICAgIGlmICh0YWcpIGxvY2FsVGFncy5wdXNoKHRhZyk7XG4gIH1cblxuICBjb25zdCBib2R5RWwgPSBjaGlsZChwcm9ncmFtRWwsICdCb2R5JykgPz8gcHJvZ3JhbUVsO1xuXG4gIGNvbnN0IHJlc29sdmVyID0gYnVpbGRSZXNvbHZlcihsb2NhbFRhZ3MsIFtdKTtcblxuICBpZiAobGFuZ3VhZ2UgPT09ICdMRCcgfHwgbGFuZ3VhZ2UgPT09ICdMQURERVInKSB7XG4gICAgY29uc3QgbGFkZGVyID0gcGFyc2VYRUZMYWRkZXIoYm9keUVsLCBuYW1lLCB1bm1hcHBlZCwgcmVzb2x2ZXIpO1xuICAgIHJldHVybiB7IGlkOiBgcG91LSR7bmFtZX1gLCBuYW1lLCBsYW5ndWFnZTogJ0xEJywgbGFkZGVyUHJvZ3JhbTogbGFkZGVyLCBsb2NhbFRhZ3MsIHBvdVR5cGU6ICdwcm9ncmFtJyB9O1xuICB9XG4gIGlmIChsYW5ndWFnZSA9PT0gJ0ZCRCcpIHtcbiAgICBjb25zdCBmYmQgPSBwYXJzZVhFRkZCRChib2R5RWwsIG5hbWUsIHVubWFwcGVkLCByZXNvbHZlcik7XG4gICAgcmV0dXJuIHsgaWQ6IGBwb3UtJHtuYW1lfWAsIG5hbWUsIGxhbmd1YWdlOiAnRkJEJywgZmJkUHJvZ3JhbTogZmJkLCBsb2NhbFRhZ3MsIHBvdVR5cGU6ICdwcm9ncmFtJyB9O1xuICB9XG4gIGlmIChsYW5ndWFnZSA9PT0gJ1NGQycpIHtcbiAgICBjb25zdCBzZmMgPSBwYXJzZVhFRlNGQyhib2R5RWwsIG5hbWUsIHVubWFwcGVkKTtcbiAgICByZXR1cm4geyBpZDogYHBvdS0ke25hbWV9YCwgbmFtZSwgbGFuZ3VhZ2U6ICdTRkMnLCBzZmNQcm9ncmFtOiBzZmMsIGxvY2FsVGFncywgcG91VHlwZTogJ3Byb2dyYW0nIH07XG4gIH1cbiAgaWYgKGxhbmd1YWdlID09PSAnU1QnKSB7XG4gICAgY29uc3QgcmF3U3JjID0gdGV4dChib2R5RWwpO1xuICAgIGNvbnN0IHNyYyA9IHJhd1NyYyA/IHVuZXNjYXBlWE1MKHJhd1NyYykgOiByYXdTcmM7XG4gICAgcmV0dXJuIHsgaWQ6IGBwb3UtJHtuYW1lfWAsIG5hbWUsIGxhbmd1YWdlOiAnU1QnLCBzdFNvdXJjZTogc3JjLCBsb2NhbFRhZ3MsIHBvdVR5cGU6ICdwcm9ncmFtJyB9O1xuICB9XG4gIGlmIChsYW5ndWFnZSA9PT0gJ0lMJykge1xuICAgIHdhcm5pbmdzLnB1c2goYFByb2dyYW0gXCIke25hbWV9XCI6IElMIGxhbmd1YWdlIFx1MjAxNCBpbXBvcnRpbmcgYXMgU1QgY29tbWVudGApO1xuICAgIHJldHVybiB7IGlkOiBgcG91LSR7bmFtZX1gLCBuYW1lLCBsYW5ndWFnZTogJ1NUJywgc3RTb3VyY2U6IGAoKiBJTDogJHt0ZXh0KGJvZHlFbCl9ICopYCwgbG9jYWxUYWdzLCBwb3VUeXBlOiAncHJvZ3JhbScgfTtcbiAgfVxuXG4gIHVubWFwcGVkLnB1c2goeyBjbG1Ob2RlSWQ6IG51bGwsIHZlbmRvclNwZWNpZmljRGF0YTogcHJvZ3JhbUVsLCByZWFzb246IGBQcm9ncmFtIFwiJHtuYW1lfVwiOiB1bmtub3duIGxhbmd1YWdlICR7bGFuZ3VhZ2V9YCB9KTtcbiAgcmV0dXJuIG51bGw7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBGRUYgKHJlYWwgWEVGKSBwcm9ncmFtIHBhcnNlciBcdTIwMTQgQnVncyA0LCA1LCA2LCAxMyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gcGFyc2VYRUZQcm9ncmFtRkVGKHByb2dyYW1FbDogdW5rbm93biwgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdLCB3YXJuaW5nczogc3RyaW5nW10pOiBOb3JtYWxpemVkUE9VIHwgbnVsbCB7XG4gIGlmICghcHJvZ3JhbUVsIHx8IHR5cGVvZiBwcm9ncmFtRWwgIT09ICdvYmplY3QnKSByZXR1cm4gbnVsbDtcblxuICAvLyBCdWcgNDogaWRlbnRpdHkgY29tZXMgZnJvbSA8aWRlbnRQcm9ncmFtPiBjaGlsZFxuICBjb25zdCBpZGVudEVsID0gY2hpbGQocHJvZ3JhbUVsLCAnaWRlbnRQcm9ncmFtJyk7XG4gIGNvbnN0IG5hbWUgPSBhdHRyKGlkZW50RWwsICduYW1lJykgfHwgYXR0cihwcm9ncmFtRWwsICdOYW1lJykgfHwgYXR0cihwcm9ncmFtRWwsICduYW1lJykgfHwgJ1Byb2dyYW0nO1xuICBjb25zdCB0YXNrID0gYXR0cihpZGVudEVsLCAndGFzaycpIHx8ICdNQVNUJztcbiAgY29uc3Qgc2VjdGlvblR5cGUgPSBhdHRyKGlkZW50RWwsICd0eXBlJykgfHwgJ3NlY3Rpb24nO1xuXG4gIC8vIEJ1ZyA1OiBkZXRlY3QgbGFuZ3VhZ2UgZnJvbSBib2R5IGVsZW1lbnQgcHJlc2VuY2VcbiAgY29uc3QgbGFuZ3VhZ2UgPSBjaGlsZChwcm9ncmFtRWwsICdGQkRTb3VyY2UnKSA/ICdGQkQnXG4gICAgOiBjaGlsZChwcm9ncmFtRWwsICdMRFNvdXJjZScpID8gJ0xEJ1xuICAgIDogY2hpbGQocHJvZ3JhbUVsLCAnU0ZDU291cmNlJykgPyAnU0ZDJ1xuICAgIDogY2hpbGQocHJvZ3JhbUVsLCAnU1RTb3VyY2UnKSA/ICdTVCdcbiAgICA6ICdTVCc7XG5cbiAgLy8gQnVnIDEzOiBsb2NhbCB2YXJpYWJsZXMgZnJvbSBwdWJsaWNMb2NhbFZhcmlhYmxlcyBhbmQgcHJpdmF0ZUxvY2FsVmFyaWFibGVzXG4gIGNvbnN0IGxvY2FsVGFnczogTm9ybWFsaXplZFRhZ1tdID0gW107XG4gIGNvbnN0IHB1YmxpY1ZhcnMgPSBjaGlsZChwcm9ncmFtRWwsICdwdWJsaWNMb2NhbFZhcmlhYmxlcycpO1xuICBjb25zdCBwcml2YXRlVmFycyA9IGNoaWxkKHByb2dyYW1FbCwgJ3ByaXZhdGVMb2NhbFZhcmlhYmxlcycpO1xuICBjb25zdCBsb2NhbFZhckVscyA9IFtcbiAgICAuLi4ocHVibGljVmFycyA/IGNoaWxkQXJyYXkocHVibGljVmFycywgJ3ZhcmlhYmxlcycpIDogW10pLFxuICAgIC4uLihwcml2YXRlVmFycyA/IGNoaWxkQXJyYXkocHJpdmF0ZVZhcnMsICd2YXJpYWJsZXMnKSA6IFtdKSxcbiAgXTtcbiAgZm9yIChjb25zdCB2IG9mIGxvY2FsVmFyRWxzKSB7XG4gICAgY29uc3QgdGFnID0gcGFyc2VYRUZWYXJpYWJsZSh2LCB1bm1hcHBlZCk7XG4gICAgaWYgKHRhZykgbG9jYWxUYWdzLnB1c2godGFnKTtcbiAgfVxuXG4gIGNvbnN0IHJlc29sdmVyID0gYnVpbGRSZXNvbHZlcihsb2NhbFRhZ3MsIFtdKTtcblxuICBpZiAobGFuZ3VhZ2UgPT09ICdGQkQnKSB7XG4gICAgLy8gQnVnIDY6IHVud3JhcCBGQkRTb3VyY2UgLT4gbmV0d29ya0ZCRFxuICAgIGNvbnN0IGZiZFNvdXJjZUVsID0gY2hpbGQocHJvZ3JhbUVsLCAnRkJEU291cmNlJyk7XG4gICAgY29uc3QgYm9keUVsID0gY2hpbGQoZmJkU291cmNlRWwsICduZXR3b3JrRkJEJykgPz8gZmJkU291cmNlRWw7XG4gICAgY29uc3QgZmJkID0gcGFyc2VYRUZGQkQoYm9keUVsLCBuYW1lLCB1bm1hcHBlZCwgcmVzb2x2ZXIpO1xuICAgIC8vIFByZXNlcnZlIEZCRFNvdXJjZSBncmlkIGRpbWVuc2lvbnMgZm9yIHJvdW5kLXRyaXBcbiAgICBjb25zdCBuYlJvd3MgPSBhdHRyKGZiZFNvdXJjZUVsLCAnbmJSb3dzJyk7XG4gICAgY29uc3QgbmJDb2x1bW5zID0gYXR0cihmYmRTb3VyY2VFbCwgJ25iQ29sdW1ucycpO1xuICAgIGlmIChuYlJvd3MgfHwgbmJDb2x1bW5zKSB7XG4gICAgICAoZmJkIGFzIGFueSkuX3hlZkdyaWQgPSB7IG5iUm93cywgbmJDb2x1bW5zIH07XG4gICAgfVxuICAgIGNvbnN0IHBvdTogTm9ybWFsaXplZFBPVSA9IHsgaWQ6IGBwb3UtJHtuYW1lfWAsIG5hbWUsIGxhbmd1YWdlOiAnRkJEJywgZmJkUHJvZ3JhbTogZmJkLCBsb2NhbFRhZ3MsIHBvdVR5cGU6ICdwcm9ncmFtJyB9O1xuICAgIChwb3UgYXMgYW55KS5feGVmTWV0YSA9IHsgdGFzaywgc2VjdGlvblR5cGUgfTtcbiAgICByZXR1cm4gcG91O1xuICB9XG4gIGlmIChsYW5ndWFnZSA9PT0gJ0xEJykge1xuICAgIGNvbnN0IGxkU291cmNlRWwgPSBjaGlsZChwcm9ncmFtRWwsICdMRFNvdXJjZScpO1xuICAgIGNvbnN0IGxhZGRlciA9IHBhcnNlWEVGTGFkZGVyKGxkU291cmNlRWwgPz8gcHJvZ3JhbUVsLCBuYW1lLCB1bm1hcHBlZCwgcmVzb2x2ZXIpO1xuICAgIGNvbnN0IHBvdTogTm9ybWFsaXplZFBPVSA9IHsgaWQ6IGBwb3UtJHtuYW1lfWAsIG5hbWUsIGxhbmd1YWdlOiAnTEQnLCBsYWRkZXJQcm9ncmFtOiBsYWRkZXIsIGxvY2FsVGFncywgcG91VHlwZTogJ3Byb2dyYW0nIH07XG4gICAgKHBvdSBhcyBhbnkpLl94ZWZNZXRhID0geyB0YXNrLCBzZWN0aW9uVHlwZSB9O1xuICAgIHJldHVybiBwb3U7XG4gIH1cbiAgaWYgKGxhbmd1YWdlID09PSAnU0ZDJykge1xuICAgIGNvbnN0IHNmY1NvdXJjZUVsID0gY2hpbGQocHJvZ3JhbUVsLCAnU0ZDU291cmNlJyk7XG4gICAgY29uc3Qgc2ZjID0gcGFyc2VYRUZTRkMoc2ZjU291cmNlRWwgPz8gcHJvZ3JhbUVsLCBuYW1lLCB1bm1hcHBlZCk7XG4gICAgY29uc3QgcG91OiBOb3JtYWxpemVkUE9VID0geyBpZDogYHBvdS0ke25hbWV9YCwgbmFtZSwgbGFuZ3VhZ2U6ICdTRkMnLCBzZmNQcm9ncmFtOiBzZmMsIGxvY2FsVGFncywgcG91VHlwZTogJ3Byb2dyYW0nIH07XG4gICAgKHBvdSBhcyBhbnkpLl94ZWZNZXRhID0geyB0YXNrLCBzZWN0aW9uVHlwZSB9O1xuICAgIHJldHVybiBwb3U7XG4gIH1cbiAgaWYgKGxhbmd1YWdlID09PSAnU1QnKSB7XG4gICAgY29uc3Qgc3RTb3VyY2VFbCA9IGNoaWxkKHByb2dyYW1FbCwgJ1NUU291cmNlJyk7XG4gICAgY29uc3QgcmF3U3JjID0gdGV4dChzdFNvdXJjZUVsID8/IHByb2dyYW1FbCk7XG4gICAgY29uc3Qgc3JjID0gcmF3U3JjID8gdW5lc2NhcGVYTUwocmF3U3JjKSA6IHJhd1NyYztcbiAgICBjb25zdCBwb3U6IE5vcm1hbGl6ZWRQT1UgPSB7IGlkOiBgcG91LSR7bmFtZX1gLCBuYW1lLCBsYW5ndWFnZTogJ1NUJywgc3RTb3VyY2U6IHNyYywgbG9jYWxUYWdzLCBwb3VUeXBlOiAncHJvZ3JhbScgfTtcbiAgICAocG91IGFzIGFueSkuX3hlZk1ldGEgPSB7IHRhc2ssIHNlY3Rpb25UeXBlIH07XG4gICAgcmV0dXJuIHBvdTtcbiAgfVxuXG4gIHdhcm5pbmdzLnB1c2goYFByb2dyYW0gXCIke25hbWV9XCI6IHVucmVjb2duaXNlZCBsYW5ndWFnZSBcIiR7bGFuZ3VhZ2V9XCIgXHUyMDE0IHNraXBwZWRgKTtcbiAgcmV0dXJuIG51bGw7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBYRUYgTGFkZGVyIHBhcnNlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gcGFyc2VYRUZMYWRkZXIoYm9keUVsOiB1bmtub3duLCBwb3VOYW1lOiBzdHJpbmcsIHVubWFwcGVkOiBVbm1hcHBlZEVsZW1lbnRbXSwgcmVzb2x2ZXI6IFZhcmlhYmxlVHlwZVJlc29sdmVyID0gbmV3IFZhcmlhYmxlVHlwZVJlc29sdmVyKCkpOiBMYWRkZXJQcm9ncmFtIHtcbiAgY29uc3QgcnVuZ3M6IFJ1bmdbXSA9IFtdO1xuICBsZXQgcnVuZ0lkeCA9IDA7XG5cbiAgZm9yIChjb25zdCBydW5nRWwgb2YgY2hpbGRBcnJheShib2R5RWwsICdSdW5nJykuY29uY2F0KGNoaWxkQXJyYXkoYm9keUVsLCAnTmV0d29yaycpKSkge1xuICAgIHJ1bmdJZHgrKztcbiAgICBjb25zdCBjb21tZW50ID0gdGV4dChjaGlsZChydW5nRWwsICdDb21tZW50JykpIHx8ICcnO1xuICAgIGNvbnN0IGVsZW1lbnRzOiBMYWRkZXJFbGVtZW50W10gPSBbXTtcbiAgICBsZXQgcG9zWCA9IDA7XG5cbiAgICAvLyBDb250YWN0cyBcdTIwMTQgd2l0aCBlZGdlIGRldGVjdGlvbiBzdXBwb3J0XG4gICAgZm9yIChjb25zdCBjdEVsIG9mIGNoaWxkQXJyYXkocnVuZ0VsLCAnQ29udGFjdCcpLmNvbmNhdChjaGlsZEFycmF5KHJ1bmdFbCwgJ0NUJykpKSB7XG4gICAgICBjb25zdCB0YWdOYW1lID0gYXR0cihjdEVsLCAnVmFyaWFibGUnKSB8fCBhdHRyKGN0RWwsICduYW1lJykgfHwgYFRBR18ke3Bvc1h9YDtcbiAgICAgIGNvbnN0IGN0VHlwZSA9IChhdHRyKGN0RWwsICdUeXBlJykgfHwgYXR0cihjdEVsLCAndHlwZScpIHx8ICcnKS50b1VwcGVyQ2FzZSgpO1xuICAgICAgY29uc3QgbmVnYXRlZCA9IGF0dHIoY3RFbCwgJ05lZ2F0ZWQnKSA9PT0gJ3RydWUnIHx8IGN0VHlwZSA9PT0gJ05DJztcblxuICAgICAgbGV0IGNvbnRhY3RUeXBlOiBDb250YWN0VHlwZSA9IG5lZ2F0ZWQgPyAnTkMnIDogJ05PJztcbiAgICAgIGlmIChjdFR5cGUgPT09ICdQJyB8fCBjdFR5cGUgPT09ICdSRScgfHwgY3RUeXBlID09PSAnUklTSU5HJykgY29udGFjdFR5cGUgPSAnUF9DT05UQUNUJztcbiAgICAgIGlmIChjdFR5cGUgPT09ICdOJyB8fCBjdFR5cGUgPT09ICdGRScgfHwgY3RUeXBlID09PSAnRkFMTElORycpIGNvbnRhY3RUeXBlID0gJ05fQ09OVEFDVCc7XG5cbiAgICAgIGVsZW1lbnRzLnB1c2goe1xuICAgICAgICBraW5kOiAnY29udGFjdCcsXG4gICAgICAgIGlkOiB1aWQoYHhlZi1jdC0ke3J1bmdJZHh9YCksXG4gICAgICAgIHR5cGU6IGNvbnRhY3RUeXBlLFxuICAgICAgICB0YWc6IHsgbmFtZTogdGFnTmFtZSwgZGF0YVR5cGU6IHJlc29sdmVyLnJlc29sdmUodGFnTmFtZSkgfSxcbiAgICAgICAgcG9zaXRpb246IHsgeDogcG9zWCwgeTogMCB9LFxuICAgICAgfSk7XG4gICAgICBwb3NYICs9IDYwO1xuICAgIH1cblxuICAgIC8vIENvaWxzXG4gICAgZm9yIChjb25zdCBjb2lsRWwgb2YgY2hpbGRBcnJheShydW5nRWwsICdDb2lsJykuY29uY2F0KGNoaWxkQXJyYXkocnVuZ0VsLCAnQ0wnKSkpIHtcbiAgICAgIGNvbnN0IHRhZ05hbWUgPSBhdHRyKGNvaWxFbCwgJ1ZhcmlhYmxlJykgfHwgYXR0cihjb2lsRWwsICduYW1lJykgfHwgYENPSUxfJHtwb3NYfWA7XG4gICAgICBjb25zdCBjb2lsVHlwZSA9IChhdHRyKGNvaWxFbCwgJ1R5cGUnKSB8fCBhdHRyKGNvaWxFbCwgJ3R5cGUnKSB8fCAnJykudG9VcHBlckNhc2UoKTtcbiAgICAgIGxldCB0eXBlOiBDb2lsVHlwZSA9ICdub3JtYWwnO1xuICAgICAgaWYgKGNvaWxUeXBlID09PSAnU0VUJyB8fCBjb2lsVHlwZSA9PT0gJ1MnKSB0eXBlID0gJ3NldCc7XG4gICAgICBpZiAoY29pbFR5cGUgPT09ICdSRVNFVCcgfHwgY29pbFR5cGUgPT09ICdSJykgdHlwZSA9ICdyZXNldCc7XG4gICAgICBpZiAoY29pbFR5cGUgPT09ICdORUdBVEVEJyB8fCBjb2lsVHlwZSA9PT0gJy8nKSB0eXBlID0gJ25lZ2F0ZWQnO1xuICAgICAgaWYgKGNvaWxUeXBlID09PSAnTEFUQ0gnIHx8IGNvaWxUeXBlID09PSAnTCcpIHR5cGUgPSAnbGF0Y2gnO1xuICAgICAgaWYgKGNvaWxUeXBlID09PSAnVU5MQVRDSCcgfHwgY29pbFR5cGUgPT09ICdVJykgdHlwZSA9ICd1bmxhdGNoJztcbiAgICAgIGVsZW1lbnRzLnB1c2goe1xuICAgICAgICBraW5kOiAnY29pbCcsXG4gICAgICAgIGlkOiB1aWQoYHhlZi1jb2lsLSR7cnVuZ0lkeH1gKSxcbiAgICAgICAgdHlwZSxcbiAgICAgICAgdGFnOiB7IG5hbWU6IHRhZ05hbWUsIGRhdGFUeXBlOiByZXNvbHZlci5yZXNvbHZlKHRhZ05hbWUpIH0sXG4gICAgICAgIHBvc2l0aW9uOiB7IHg6IHBvc1gsIHk6IDAgfSxcbiAgICAgIH0pO1xuICAgICAgcG9zWCArPSA2MDtcbiAgICB9XG5cbiAgICAvLyBGdW5jdGlvbiBibG9ja3NcbiAgICBmb3IgKGNvbnN0IGZiRWwgb2YgY2hpbGRBcnJheShydW5nRWwsICdGdW5jdGlvbkJsb2NrJykuY29uY2F0KGNoaWxkQXJyYXkocnVuZ0VsLCAnT3BlcmF0b3InKSkpIHtcbiAgICAgIGNvbnN0IHR5cGVOYW1lID0gYXR0cihmYkVsLCAnVHlwZScpIHx8IGF0dHIoZmJFbCwgJ3R5cGVOYW1lJykgfHwgJyc7XG4gICAgICBjb25zdCBpbnN0YW5jZU5hbWUgPSBhdHRyKGZiRWwsICdJbnN0YW5jZScpIHx8IGF0dHIoZmJFbCwgJ25hbWUnKSB8fCB0eXBlTmFtZTtcbiAgICAgIGNvbnN0IHhlZkZCTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgICBUT046ICdUT04nLCBUT0Y6ICdUT0YnLCBUUDogJ1RQJywgQ1RVOiAnQ1RVJywgQ1REOiAnQ1REJywgQ1RVRDogJ0NUVUQnLFxuICAgICAgICBTUjogJ1NSJywgUlM6ICdSUycsIFJfVFJJRzogJ1JUUklHJywgRl9UUklHOiAnRlRSSUcnLFxuICAgICAgfTtcbiAgICAgIGNvbnN0IGZiVHlwZSA9IHhlZkZCTWFwW3R5cGVOYW1lLnRvVXBwZXJDYXNlKCldIHx8IHR5cGVOYW1lO1xuXG4gICAgICAvLyBCdWlsZCByYXcgcGluXHUyMTkydmFyaWFibGUgbWFwIHRoZW4gYXBwbHkgY2Fub25pY2FsIHR5cGVzXG4gICAgICBjb25zdCByYXdQaW5zOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gICAgICBmb3IgKGNvbnN0IHBpbkVsIG9mIGNoaWxkQXJyYXkoZmJFbCwgJ0lucHV0UGluJykuY29uY2F0KGNoaWxkQXJyYXkoZmJFbCwgJ1BpbicpKSkge1xuICAgICAgICBjb25zdCBwaW5OYW1lID0gYXR0cihwaW5FbCwgJ05hbWUnKSB8fCBhdHRyKHBpbkVsLCAnbmFtZScpIHx8IGBJTiR7T2JqZWN0LmtleXMocmF3UGlucykubGVuZ3RofWA7XG4gICAgICAgIHJhd1BpbnNbcGluTmFtZV0gPSBhdHRyKHBpbkVsLCAnVmFyaWFibGUnKSB8fCBhdHRyKHBpbkVsLCAndmFsdWUnKSB8fCBwaW5OYW1lO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBwaW5FbCBvZiBjaGlsZEFycmF5KGZiRWwsICdPdXRwdXRQaW4nKSkge1xuICAgICAgICBjb25zdCBwaW5OYW1lID0gYXR0cihwaW5FbCwgJ05hbWUnKSB8fCBhdHRyKHBpbkVsLCAnbmFtZScpIHx8IGBPVVQke09iamVjdC5rZXlzKHJhd1BpbnMpLmxlbmd0aH1gO1xuICAgICAgICByYXdQaW5zW3Bpbk5hbWVdID0gYXR0cihwaW5FbCwgJ1ZhcmlhYmxlJykgfHwgYXR0cihwaW5FbCwgJ3ZhbHVlJykgfHwgcGluTmFtZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHR5cGVkUGlucyA9IGJ1aWxkVHlwZWRUYWdSZWZQaW5zKGZiVHlwZSwgcmF3UGlucyk7XG4gICAgICBjb25zdCBwaW5zOiBSZWNvcmQ8c3RyaW5nLCB7IG5hbWU6IHN0cmluZzsgZGF0YVR5cGU6IHN0cmluZyB9PiA9IHt9O1xuICAgICAgZm9yIChjb25zdCBbcGluTmFtZSwgcGluRGVmXSBvZiBPYmplY3QuZW50cmllcyh0eXBlZFBpbnMpKSB7XG4gICAgICAgIGNvbnN0IHZhck5hbWUgPSBwaW5EZWYubmFtZTtcbiAgICAgICAgY29uc3QgcmVzb2x2ZWRUeXBlID0gdmFyTmFtZSA/IHJlc29sdmVyLnJlc29sdmUodmFyTmFtZSkgOiBudWxsO1xuICAgICAgICBwaW5zW3Bpbk5hbWVdID0geyBuYW1lOiB2YXJOYW1lLCBkYXRhVHlwZTogKHJlc29sdmVkVHlwZSAmJiByZXNvbHZlZFR5cGUgIT09ICdCT09MJykgPyByZXNvbHZlZFR5cGUgOiBwaW5EZWYuZGF0YVR5cGUgfTtcbiAgICAgIH1cblxuICAgICAgZWxlbWVudHMucHVzaCh7XG4gICAgICAgIGtpbmQ6ICdibG9jaycsXG4gICAgICAgIGlkOiB1aWQoYHhlZi1mYi0ke3J1bmdJZHh9YCksXG4gICAgICAgIGZiVHlwZTogZmJUeXBlIGFzIGFueSxcbiAgICAgICAgaW5zdGFuY2VOYW1lLFxuICAgICAgICBwaW5zLFxuICAgICAgICBwb3NpdGlvbjogeyB4OiBwb3NYLCB5OiAwIH0sXG4gICAgICB9KTtcbiAgICAgIHBvc1ggKz0gNjA7XG4gICAgfVxuXG4gICAgLy8gUGFyc2UgYnJhbmNoIGVsZW1lbnRzIChwYXJhbGxlbCBwYXRocylcbiAgICBjb25zdCBicmFuY2hlczogaW1wb3J0KCcuLi8uLi9sb2dpY1N0b3JlLmpzJykuQnJhbmNoW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IGJyYW5jaEVsIG9mIGNoaWxkQXJyYXkocnVuZ0VsLCAnQnJhbmNoJykuY29uY2F0KGNoaWxkQXJyYXkocnVuZ0VsLCAnUGFyYWxsZWwnKSkpIHtcbiAgICAgIGNvbnN0IGJyYW5jaEVsZW1lbnRzOiBMYWRkZXJFbGVtZW50W10gPSBbXTtcbiAgICAgIGxldCBiUG9zWCA9IDA7XG5cbiAgICAgIGZvciAoY29uc3QgY3RFbCBvZiBjaGlsZEFycmF5KGJyYW5jaEVsLCAnQ29udGFjdCcpLmNvbmNhdChjaGlsZEFycmF5KGJyYW5jaEVsLCAnQ1QnKSkpIHtcbiAgICAgICAgY29uc3QgdGFnTmFtZSA9IGF0dHIoY3RFbCwgJ1ZhcmlhYmxlJykgfHwgYXR0cihjdEVsLCAnbmFtZScpIHx8IGBUQUdfJHtiUG9zWH1gO1xuICAgICAgICBjb25zdCBjdFR5cGUgPSAoYXR0cihjdEVsLCAnVHlwZScpIHx8IGF0dHIoY3RFbCwgJ3R5cGUnKSB8fCAnJykudG9VcHBlckNhc2UoKTtcbiAgICAgICAgY29uc3QgbmVnYXRlZCA9IGF0dHIoY3RFbCwgJ05lZ2F0ZWQnKSA9PT0gJ3RydWUnIHx8IGN0VHlwZSA9PT0gJ05DJztcbiAgICAgICAgbGV0IGNvbnRhY3RUeXBlOiBDb250YWN0VHlwZSA9IG5lZ2F0ZWQgPyAnTkMnIDogJ05PJztcbiAgICAgICAgaWYgKGN0VHlwZSA9PT0gJ1AnIHx8IGN0VHlwZSA9PT0gJ1JFJyB8fCBjdFR5cGUgPT09ICdSSVNJTkcnKSBjb250YWN0VHlwZSA9ICdQX0NPTlRBQ1QnO1xuICAgICAgICBpZiAoY3RUeXBlID09PSAnTicgfHwgY3RUeXBlID09PSAnRkUnIHx8IGN0VHlwZSA9PT0gJ0ZBTExJTkcnKSBjb250YWN0VHlwZSA9ICdOX0NPTlRBQ1QnO1xuICAgICAgICBicmFuY2hFbGVtZW50cy5wdXNoKHtcbiAgICAgICAgICBraW5kOiAnY29udGFjdCcsXG4gICAgICAgICAgaWQ6IHVpZChgeGVmLWJyLWN0LSR7cnVuZ0lkeH1gKSxcbiAgICAgICAgICB0eXBlOiBjb250YWN0VHlwZSxcbiAgICAgICAgICB0YWc6IHsgbmFtZTogdGFnTmFtZSwgZGF0YVR5cGU6IHJlc29sdmVyLnJlc29sdmUodGFnTmFtZSkgfSxcbiAgICAgICAgICBwb3NpdGlvbjogeyB4OiBiUG9zWCwgeTogMCB9LFxuICAgICAgICB9KTtcbiAgICAgICAgYlBvc1ggKz0gNjA7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGZiRWwgb2YgY2hpbGRBcnJheShicmFuY2hFbCwgJ0Z1bmN0aW9uQmxvY2snKS5jb25jYXQoY2hpbGRBcnJheShicmFuY2hFbCwgJ09wZXJhdG9yJykpKSB7XG4gICAgICAgIGNvbnN0IHR5cGVOYW1lID0gYXR0cihmYkVsLCAnVHlwZScpIHx8IGF0dHIoZmJFbCwgJ3R5cGVOYW1lJykgfHwgJyc7XG4gICAgICAgIGNvbnN0IGluc3RhbmNlTmFtZSA9IGF0dHIoZmJFbCwgJ0luc3RhbmNlJykgfHwgYXR0cihmYkVsLCAnbmFtZScpIHx8IHR5cGVOYW1lO1xuICAgICAgICBjb25zdCB4ZWZGQk1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICAgICBUT046ICdUT04nLCBUT0Y6ICdUT0YnLCBUUDogJ1RQJywgQ1RVOiAnQ1RVJywgQ1REOiAnQ1REJywgQ1RVRDogJ0NUVUQnLFxuICAgICAgICAgIFNSOiAnU1InLCBSUzogJ1JTJywgUl9UUklHOiAnUlRSSUcnLCBGX1RSSUc6ICdGVFJJRycsXG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGZiVHlwZSA9IHhlZkZCTWFwW3R5cGVOYW1lLnRvVXBwZXJDYXNlKCldIHx8IHR5cGVOYW1lO1xuICAgICAgICBjb25zdCBiclJhd1BpbnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBwaW5FbCBvZiBjaGlsZEFycmF5KGZiRWwsICdJbnB1dFBpbicpLmNvbmNhdChjaGlsZEFycmF5KGZiRWwsICdQaW4nKSkpIHtcbiAgICAgICAgICBjb25zdCBwaW5OYW1lID0gYXR0cihwaW5FbCwgJ05hbWUnKSB8fCBhdHRyKHBpbkVsLCAnbmFtZScpIHx8IGBJTiR7T2JqZWN0LmtleXMoYnJSYXdQaW5zKS5sZW5ndGh9YDtcbiAgICAgICAgICBiclJhd1BpbnNbcGluTmFtZV0gPSBhdHRyKHBpbkVsLCAnVmFyaWFibGUnKSB8fCBhdHRyKHBpbkVsLCAndmFsdWUnKSB8fCBwaW5OYW1lO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGJyVHlwZWRQaW5zID0gYnVpbGRUeXBlZFRhZ1JlZlBpbnMoZmJUeXBlLCBiclJhd1BpbnMpO1xuICAgICAgICBjb25zdCBiclBpbnM6IFJlY29yZDxzdHJpbmcsIHsgbmFtZTogc3RyaW5nOyBkYXRhVHlwZTogc3RyaW5nIH0+ID0ge307XG4gICAgICAgIGZvciAoY29uc3QgW3BuLCBwZF0gb2YgT2JqZWN0LmVudHJpZXMoYnJUeXBlZFBpbnMpKSB7XG4gICAgICAgICAgY29uc3Qgdm4gPSBwZC5uYW1lO1xuICAgICAgICAgIGNvbnN0IHJ0ID0gdm4gPyByZXNvbHZlci5yZXNvbHZlKHZuKSA6IG51bGw7XG4gICAgICAgICAgYnJQaW5zW3BuXSA9IHsgbmFtZTogdm4sIGRhdGFUeXBlOiAocnQgJiYgcnQgIT09ICdCT09MJykgPyBydCA6IHBkLmRhdGFUeXBlIH07XG4gICAgICAgIH1cbiAgICAgICAgYnJhbmNoRWxlbWVudHMucHVzaCh7XG4gICAgICAgICAga2luZDogJ2Jsb2NrJywgaWQ6IHVpZChgeGVmLWJyLWZiLSR7cnVuZ0lkeH1gKSxcbiAgICAgICAgICBmYlR5cGU6IGZiVHlwZSBhcyBhbnksIGluc3RhbmNlTmFtZSwgcGluczogYnJQaW5zLFxuICAgICAgICAgIHBvc2l0aW9uOiB7IHg6IGJQb3NYLCB5OiAwIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBiUG9zWCArPSA2MDtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgY29pbEVsIG9mIGNoaWxkQXJyYXkoYnJhbmNoRWwsICdDb2lsJykuY29uY2F0KGNoaWxkQXJyYXkoYnJhbmNoRWwsICdDTCcpKSkge1xuICAgICAgICBjb25zdCB0YWdOYW1lID0gYXR0cihjb2lsRWwsICdWYXJpYWJsZScpIHx8IGF0dHIoY29pbEVsLCAnbmFtZScpIHx8IGBDT0lMXyR7YlBvc1h9YDtcbiAgICAgICAgY29uc3QgY29pbFR5cGUgPSAoYXR0cihjb2lsRWwsICdUeXBlJykgfHwgYXR0cihjb2lsRWwsICd0eXBlJykgfHwgJycpLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgIGxldCB0eXBlOiBDb2lsVHlwZSA9ICdub3JtYWwnO1xuICAgICAgICBpZiAoY29pbFR5cGUgPT09ICdTRVQnIHx8IGNvaWxUeXBlID09PSAnUycpIHR5cGUgPSAnc2V0JztcbiAgICAgICAgaWYgKGNvaWxUeXBlID09PSAnUkVTRVQnIHx8IGNvaWxUeXBlID09PSAnUicpIHR5cGUgPSAncmVzZXQnO1xuICAgICAgICBpZiAoY29pbFR5cGUgPT09ICdORUdBVEVEJyB8fCBjb2lsVHlwZSA9PT0gJy8nKSB0eXBlID0gJ25lZ2F0ZWQnO1xuICAgICAgICBpZiAoY29pbFR5cGUgPT09ICdMQVRDSCcgfHwgY29pbFR5cGUgPT09ICdMJykgdHlwZSA9ICdsYXRjaCc7XG4gICAgICAgIGlmIChjb2lsVHlwZSA9PT0gJ1VOTEFUQ0gnIHx8IGNvaWxUeXBlID09PSAnVScpIHR5cGUgPSAndW5sYXRjaCc7XG4gICAgICAgIGJyYW5jaEVsZW1lbnRzLnB1c2goe1xuICAgICAgICAgIGtpbmQ6ICdjb2lsJyxcbiAgICAgICAgICBpZDogdWlkKGB4ZWYtYnItY29pbC0ke3J1bmdJZHh9YCksXG4gICAgICAgICAgdHlwZSxcbiAgICAgICAgICB0YWc6IHsgbmFtZTogdGFnTmFtZSwgZGF0YVR5cGU6IHJlc29sdmVyLnJlc29sdmUodGFnTmFtZSkgfSxcbiAgICAgICAgICBwb3NpdGlvbjogeyB4OiBiUG9zWCwgeTogMCB9LFxuICAgICAgICB9KTtcbiAgICAgICAgYlBvc1ggKz0gNjA7XG4gICAgICB9XG5cbiAgICAgIGlmIChicmFuY2hFbGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGJyYW5jaGVzLnB1c2goe1xuICAgICAgICAgIGlkOiB1aWQoYHhlZi1icmFuY2gtJHtydW5nSWR4fWApLFxuICAgICAgICAgIHN0YXJ0Tm9kZUlkOiBlbGVtZW50c1swXT8uaWQgfHwgJycsXG4gICAgICAgICAgZW5kTm9kZUlkOiBicmFuY2hFbGVtZW50c1ticmFuY2hFbGVtZW50cy5sZW5ndGggLSAxXS5pZCxcbiAgICAgICAgICBlbGVtZW50czogYnJhbmNoRWxlbWVudHMsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJ1bmdzLnB1c2goeyBpZDogYCR7cG91TmFtZX0tcnVuZy0ke3J1bmdJZHh9YCwgbnVtYmVyOiBydW5nSWR4LCBjb21tZW50LCBlbGVtZW50cywgYnJhbmNoZXMgfSk7XG4gIH1cblxuICByZXR1cm4geyBydW5ncyB9O1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgWEVGIEZCRCBwYXJzZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHBhcnNlWEVGRkJEKGJvZHlFbDogdW5rbm93biwgcG91TmFtZTogc3RyaW5nLCB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10sIHJlc29sdmVyOiBWYXJpYWJsZVR5cGVSZXNvbHZlciA9IG5ldyBWYXJpYWJsZVR5cGVSZXNvbHZlcigpKTogRkJEUHJvZ3JhbSB7XG4gIGNvbnN0IG5vZGVzOiBGQkROb2RlW10gPSBbXTtcbiAgY29uc3Qgd2lyZXM6IEZCRFdpcmVbXSA9IFtdO1xuICBsZXQgaWR4ID0gMDtcblxuICAvLyBCdWcgMTE6IG1hcCBpbnN0YW5jZU5hbWUgLT4gZ2VuZXJhdGVkIG5vZGVJZCBmb3Igd2lyZSByZXNvbHV0aW9uXG4gIGNvbnN0IGluc3RhbmNlTmFtZVRvTm9kZUlkID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblxuICAvLyBCdWcgNzogRkZCQmxvY2sgKHJlYWwgWEVGKSBmaXJzdCwgdGhlbiBGQkRPYmplY3QvQmxvY2sgKGxlZ2FjeSlcbiAgY29uc3QgYWxsQmxvY2tFbHMgPSBjaGlsZEFycmF5KGJvZHlFbCwgJ0ZGQkJsb2NrJylcbiAgICAuY29uY2F0KGNoaWxkQXJyYXkoYm9keUVsLCAnRkJET2JqZWN0JykpXG4gICAgLmNvbmNhdChjaGlsZEFycmF5KGJvZHlFbCwgJ0Jsb2NrJykpO1xuXG4gIGZvciAoY29uc3QgYmxvY2tFbCBvZiBhbGxCbG9ja0Vscykge1xuICAgIC8vIEJ1ZyA4OiB0eXBlTmFtZSBmaXJzdCAocmVhbCBYRUYpLCB0aGVuIGxlZ2FjeSBUeXBlXG4gICAgY29uc3QgdHlwZU5hbWUgPSBhdHRyKGJsb2NrRWwsICd0eXBlTmFtZScpIHx8IGF0dHIoYmxvY2tFbCwgJ1R5cGUnKSB8fCBhdHRyKGJsb2NrRWwsICd0eXBlJykgfHwgJ0JMT0NLJztcbiAgICAvLyBCdWcgODogaW5zdGFuY2VOYW1lIGZpcnN0IChyZWFsIFhFRiksIHRoZW4gbGVnYWN5XG4gICAgY29uc3QgaW5zdGFuY2VOYW1lID0gYXR0cihibG9ja0VsLCAnaW5zdGFuY2VOYW1lJykgfHwgYXR0cihibG9ja0VsLCAnSW5zdGFuY2UnKSB8fCBhdHRyKGJsb2NrRWwsICduYW1lJykgfHwgdHlwZU5hbWU7XG4gICAgY29uc3QgaWQgPSBpbnN0YW5jZU5hbWUgfHwgYXR0cihibG9ja0VsLCAnSWQnKSB8fCBTdHJpbmcoaWR4KyspO1xuICAgIGNvbnN0IG5vZGVJZCA9IGB4ZWYtZmJkLSR7aWR9LSR7aWR4Kyt9YDtcblxuICAgIC8vIEJ1ZyAxMTogcmVnaXN0ZXIgaW5zdGFuY2VOYW1lIC0+IG5vZGVJZFxuICAgIGlmIChpbnN0YW5jZU5hbWUpIGluc3RhbmNlTmFtZVRvTm9kZUlkLnNldChpbnN0YW5jZU5hbWUsIG5vZGVJZCk7XG5cbiAgICAvLyBCdWcgOTogb2JqUG9zaXRpb24gZmlyc3QgKHJlYWwgWEVGKSwgdGhlbiBQb3NpdGlvbiAobGVnYWN5KVxuICAgIGNvbnN0IHBvc0VsID0gY2hpbGQoYmxvY2tFbCwgJ29ialBvc2l0aW9uJykgPz8gY2hpbGQoYmxvY2tFbCwgJ1Bvc2l0aW9uJyk7XG4gICAgLy8gQnVnIDk6IHBvc1gvcG9zWSBmaXJzdCAocmVhbCBYRUYpLCB0aGVuIFgvWSAobGVnYWN5KVxuICAgIGNvbnN0IHggPSBOdW1iZXIoYXR0cihwb3NFbCwgJ3Bvc1gnKSB8fCBhdHRyKHBvc0VsLCAnWCcpIHx8IGF0dHIoYmxvY2tFbCwgJ1gnKSB8fCBhdHRyKGJsb2NrRWwsICd4JykpIHx8IGlkeCAqIDEyMDtcbiAgICBjb25zdCB5ID0gTnVtYmVyKGF0dHIocG9zRWwsICdwb3NZJykgfHwgYXR0cihwb3NFbCwgJ1knKSB8fCBhdHRyKGJsb2NrRWwsICdZJykgfHwgYXR0cihibG9ja0VsLCAneScpKSB8fCAwO1xuXG4gICAgLy8gUHJlc2VydmUgRkZCQmxvY2stbGV2ZWwgYXR0cmlidXRlcyBmb3Igcm91bmQtdHJpcFxuICAgIGNvbnN0IGFkZGl0aW9ubmFsUGluTnVtYmVyID0gYXR0cihibG9ja0VsLCAnYWRkaXRpb25uYWxQaW5OdW1iZXInKSB8fCBhdHRyKGJsb2NrRWwsICdhZGRpdGlvbmFsUGluTnVtYmVyJyk7XG4gICAgY29uc3QgZW5Fbk8gPSBhdHRyKGJsb2NrRWwsICdlbkVuTycpO1xuICAgIGNvbnN0IGJsb2NrV2lkdGggPSBhdHRyKGJsb2NrRWwsICd3aWR0aCcpO1xuICAgIGNvbnN0IGJsb2NrSGVpZ2h0ID0gYXR0cihibG9ja0VsLCAnaGVpZ2h0Jyk7XG5cbiAgICAvLyBTdGFydCBmcm9tIGNhbm9uaWNhbCBzaWduYXR1cmUgcGlucywgdGhlbiBzdXBwbGVtZW50IHdpdGggWE1MLWRlY2xhcmVkIHBpbnNcbiAgICBjb25zdCB7IGlucHV0czogc2lnSW5wdXRzLCBvdXRwdXRzOiBzaWdPdXRwdXRzIH0gPSBidWlsZFR5cGVkUGlucyh0eXBlTmFtZSwgW10sIG5vZGVJZCk7XG4gICAgY29uc3QgaW5wdXRzQnlOYW1lID0gbmV3IE1hcChzaWdJbnB1dHMubWFwKHAgPT4gW3AubmFtZSwgeyAuLi5wIH1dKSk7XG4gICAgY29uc3Qgb3V0cHV0c0J5TmFtZSA9IG5ldyBNYXAoc2lnT3V0cHV0cy5tYXAocCA9PiBbcC5uYW1lLCB7IC4uLnAgfV0pKTtcblxuICAgIC8vIEJ1ZyAxMDogZGVzY3JpcHRpb25GRkIgLT4gaW5wdXRWYXJpYWJsZS9vdXRwdXRWYXJpYWJsZSAocmVhbCBYRUYpXG4gICAgY29uc3QgZGVzY0ZGQiA9IGNoaWxkKGJsb2NrRWwsICdkZXNjcmlwdGlvbkZGQicpO1xuICAgIGNvbnN0IGV4ZWNBZnRlciA9IGF0dHIoZGVzY0ZGQiwgJ2V4ZWNBZnRlcicpIHx8IHVuZGVmaW5lZDtcbiAgICBjb25zdCBpbnB1dFBpbkVscyA9IGRlc2NGRkIgPyBjaGlsZEFycmF5KGRlc2NGRkIsICdpbnB1dFZhcmlhYmxlJykgOiBbXTtcbiAgICBjb25zdCBvdXRwdXRQaW5FbHMgPSBkZXNjRkZCID8gY2hpbGRBcnJheShkZXNjRkZCLCAnb3V0cHV0VmFyaWFibGUnKSA6IFtdO1xuXG4gICAgZm9yIChjb25zdCBwaW5FbCBvZiBpbnB1dFBpbkVscy5jb25jYXQoY2hpbGRBcnJheShibG9ja0VsLCAnSW5wdXRQaW4nKSkuY29uY2F0KGNoaWxkQXJyYXkoYmxvY2tFbCwgJ0lucHV0JykpKSB7XG4gICAgICAvLyBCdWcgMTA6IGZvcm1hbFBhcmFtZXRlciBmaXJzdCAocmVhbCBYRUYpLCB0aGVuIE5hbWUgKGxlZ2FjeSlcbiAgICAgIGNvbnN0IHBpbk5hbWUgPSBhdHRyKHBpbkVsLCAnZm9ybWFsUGFyYW1ldGVyJykgfHwgYXR0cihwaW5FbCwgJ05hbWUnKSB8fCBhdHRyKHBpbkVsLCAnbmFtZScpIHx8IGBJTiR7aW5wdXRzQnlOYW1lLnNpemV9YDtcbiAgICAgIGNvbnN0IG5lZ2F0ZWQgPSBhdHRyKHBpbkVsLCAnTmVnYXRlZCcpID09PSAndHJ1ZScgfHwgYXR0cihwaW5FbCwgJ2ludmVydGVkUGluJykgPT09ICd0cnVlJztcbiAgICAgIGNvbnN0IGVmZmVjdGl2ZVBhcmFtZXRlciA9IGF0dHIocGluRWwsICdlZmZlY3RpdmVQYXJhbWV0ZXInKSB8fCB1bmRlZmluZWQ7XG4gICAgICBjb25zdCBjYW5vbmljYWxUeXBlID0gZ2V0UGluRGF0YVR5cGUodHlwZU5hbWUsIHBpbk5hbWUsICdpbnB1dCcpO1xuICAgICAgY29uc3QgcGluOiBhbnkgPSB7IGlkOiB1aWQoJ3BpbicpLCBuYW1lOiBwaW5OYW1lLCBkYXRhVHlwZTogY2Fub25pY2FsVHlwZSwgbmVnYXRlZCB9O1xuICAgICAgaWYgKGVmZmVjdGl2ZVBhcmFtZXRlcikgcGluLnZhbHVlID0gZWZmZWN0aXZlUGFyYW1ldGVyO1xuICAgICAgaW5wdXRzQnlOYW1lLnNldChwaW5OYW1lLCBwaW4pO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBpbkVsIG9mIG91dHB1dFBpbkVscy5jb25jYXQoY2hpbGRBcnJheShibG9ja0VsLCAnT3V0cHV0UGluJykpLmNvbmNhdChjaGlsZEFycmF5KGJsb2NrRWwsICdPdXRwdXQnKSkpIHtcbiAgICAgIC8vIEJ1ZyAxMDogZm9ybWFsUGFyYW1ldGVyIGZpcnN0IChyZWFsIFhFRiksIHRoZW4gTmFtZSAobGVnYWN5KVxuICAgICAgY29uc3QgcGluTmFtZSA9IGF0dHIocGluRWwsICdmb3JtYWxQYXJhbWV0ZXInKSB8fCBhdHRyKHBpbkVsLCAnTmFtZScpIHx8IGF0dHIocGluRWwsICduYW1lJykgfHwgYE9VVCR7b3V0cHV0c0J5TmFtZS5zaXplfWA7XG4gICAgICBjb25zdCBuZWdhdGVkID0gYXR0cihwaW5FbCwgJ2ludmVydGVkUGluJykgPT09ICd0cnVlJztcbiAgICAgIGNvbnN0IGVmZmVjdGl2ZVBhcmFtZXRlciA9IGF0dHIocGluRWwsICdlZmZlY3RpdmVQYXJhbWV0ZXInKSB8fCB1bmRlZmluZWQ7XG4gICAgICBjb25zdCBjYW5vbmljYWxUeXBlID0gZ2V0UGluRGF0YVR5cGUodHlwZU5hbWUsIHBpbk5hbWUsICdvdXRwdXQnKTtcbiAgICAgIGNvbnN0IHBpbjogYW55ID0geyBpZDogdWlkKCdwaW4nKSwgbmFtZTogcGluTmFtZSwgZGF0YVR5cGU6IGNhbm9uaWNhbFR5cGUgfTtcbiAgICAgIGlmIChuZWdhdGVkKSBwaW4ubmVnYXRlZCA9IHRydWU7XG4gICAgICBpZiAoZWZmZWN0aXZlUGFyYW1ldGVyKSBwaW4udmFsdWUgPSBlZmZlY3RpdmVQYXJhbWV0ZXI7XG4gICAgICBvdXRwdXRzQnlOYW1lLnNldChwaW5OYW1lLCBwaW4pO1xuICAgIH1cblxuICAgIGNvbnN0IGlucHV0cyA9IFsuLi5pbnB1dHNCeU5hbWUudmFsdWVzKCldO1xuICAgIGNvbnN0IG91dHB1dHMgPSBbLi4ub3V0cHV0c0J5TmFtZS52YWx1ZXMoKV07XG4gICAgaWYgKGlucHV0cy5sZW5ndGggPT09IDApIGlucHV0cy5wdXNoKHsgaWQ6IHVpZCgncGluJyksIG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnQk9PTCcgfSk7XG4gICAgaWYgKG91dHB1dHMubGVuZ3RoID09PSAwKSBvdXRwdXRzLnB1c2goeyBpZDogdWlkKCdwaW4nKSwgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcgfSk7XG5cbiAgICBjb25zdCBub2RlOiBhbnkgPSB7XG4gICAgICBpZDogbm9kZUlkLFxuICAgICAgdHlwZTogbWFwU2NobmVpZGVyRkJEVHlwZSh0eXBlTmFtZSksXG4gICAgICBpbnN0YW5jZU5hbWUsXG4gICAgICBwb3NpdGlvbjogeyB4LCB5IH0sXG4gICAgICBpbnB1dHMsXG4gICAgICBvdXRwdXRzLFxuICAgIH07XG4gICAgLy8gU3Rhc2ggdmVuZG9yLXNwZWNpZmljIGJsb2NrIGF0dHJpYnV0ZXMgZm9yIHJvdW5kLXRyaXBcbiAgICBub2RlLl94ZWZCbG9jayA9IHtcbiAgICAgIG9yaWdpbmFsVHlwZU5hbWU6IHR5cGVOYW1lLFxuICAgICAgYWRkaXRpb25uYWxQaW5OdW1iZXIsXG4gICAgICBlbkVuTyxcbiAgICAgIHdpZHRoOiBibG9ja1dpZHRoLFxuICAgICAgaGVpZ2h0OiBibG9ja0hlaWdodCxcbiAgICAgIGV4ZWNBZnRlcixcbiAgICB9O1xuICAgIG5vZGVzLnB1c2gobm9kZSk7XG4gIH1cblxuICAvLyBQYXJzZSBzdGFuZGFsb25lIHZhcmlhYmxlIG5vZGVzIChJblZhcmlhYmxlLCBPdXRWYXJpYWJsZSwgSW5PdXRWYXJpYWJsZSlcbiAgZm9yIChjb25zdCB2YXJFbCBvZiBjaGlsZEFycmF5KGJvZHlFbCwgJ0luVmFyaWFibGUnKS5jb25jYXQoY2hpbGRBcnJheShib2R5RWwsICdpblZhcmlhYmxlJykpKSB7XG4gICAgY29uc3QgaWQgPSBhdHRyKHZhckVsLCAnSWQnKSB8fCBTdHJpbmcoaWR4KyspO1xuICAgIGNvbnN0IHZhck5hbWUgPSBhdHRyKHZhckVsLCAnRXhwcmVzc2lvbicpIHx8IGF0dHIodmFyRWwsICdWYXJpYWJsZScpIHx8IGF0dHIodmFyRWwsICduYW1lJykgfHwgJyc7XG4gICAgY29uc3QgeCA9IE51bWJlcihhdHRyKGNoaWxkKHZhckVsLCAnUG9zaXRpb24nKSwgJ1gnKSkgfHwgaWR4ICogMTIwO1xuICAgIGNvbnN0IHkgPSBOdW1iZXIoYXR0cihjaGlsZCh2YXJFbCwgJ1Bvc2l0aW9uJyksICdZJykpIHx8IDA7XG4gICAgY29uc3QgdmFyVHlwZSA9IHJlc29sdmVyLnJlc29sdmUodmFyTmFtZSk7XG4gICAgbm9kZXMucHVzaCh7XG4gICAgICBpZDogYHhlZi1mYmQtJHtpZH1gLFxuICAgICAgdHlwZTogJ0lOX1ZBUklBQkxFJyxcbiAgICAgIHRhZzogeyBuYW1lOiB2YXJOYW1lLCBkYXRhVHlwZTogdmFyVHlwZSB9LFxuICAgICAgcG9zaXRpb246IHsgeCwgeSB9LFxuICAgICAgaW5wdXRzOiBbXSxcbiAgICAgIG91dHB1dHM6IFt7IGlkOiB1aWQoJ3BpbicpLCBuYW1lOiAnT1VUJywgZGF0YVR5cGU6IHZhclR5cGUgfV0sXG4gICAgfSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IHZhckVsIG9mIGNoaWxkQXJyYXkoYm9keUVsLCAnT3V0VmFyaWFibGUnKS5jb25jYXQoY2hpbGRBcnJheShib2R5RWwsICdvdXRWYXJpYWJsZScpKSkge1xuICAgIGNvbnN0IGlkID0gYXR0cih2YXJFbCwgJ0lkJykgfHwgU3RyaW5nKGlkeCsrKTtcbiAgICBjb25zdCB2YXJOYW1lID0gYXR0cih2YXJFbCwgJ0V4cHJlc3Npb24nKSB8fCBhdHRyKHZhckVsLCAnVmFyaWFibGUnKSB8fCBhdHRyKHZhckVsLCAnbmFtZScpIHx8ICcnO1xuICAgIGNvbnN0IHggPSBOdW1iZXIoYXR0cihjaGlsZCh2YXJFbCwgJ1Bvc2l0aW9uJyksICdYJykpIHx8IGlkeCAqIDEyMDtcbiAgICBjb25zdCB5ID0gTnVtYmVyKGF0dHIoY2hpbGQodmFyRWwsICdQb3NpdGlvbicpLCAnWScpKSB8fCAwO1xuICAgIGNvbnN0IHZhclR5cGUgPSByZXNvbHZlci5yZXNvbHZlKHZhck5hbWUpO1xuICAgIG5vZGVzLnB1c2goe1xuICAgICAgaWQ6IGB4ZWYtZmJkLSR7aWR9YCxcbiAgICAgIHR5cGU6ICdPVVRfVkFSSUFCTEUnLFxuICAgICAgdGFnOiB7IG5hbWU6IHZhck5hbWUsIGRhdGFUeXBlOiB2YXJUeXBlIH0sXG4gICAgICBwb3NpdGlvbjogeyB4LCB5IH0sXG4gICAgICBpbnB1dHM6IFt7IGlkOiB1aWQoJ3BpbicpLCBuYW1lOiAnSU4nLCBkYXRhVHlwZTogdmFyVHlwZSB9XSxcbiAgICAgIG91dHB1dHM6IFtdLFxuICAgIH0pO1xuICB9XG5cbiAgZm9yIChjb25zdCB2YXJFbCBvZiBjaGlsZEFycmF5KGJvZHlFbCwgJ0luT3V0VmFyaWFibGUnKS5jb25jYXQoY2hpbGRBcnJheShib2R5RWwsICdpbk91dFZhcmlhYmxlJykpKSB7XG4gICAgY29uc3QgaWQgPSBhdHRyKHZhckVsLCAnSWQnKSB8fCBTdHJpbmcoaWR4KyspO1xuICAgIGNvbnN0IHZhck5hbWUgPSBhdHRyKHZhckVsLCAnRXhwcmVzc2lvbicpIHx8IGF0dHIodmFyRWwsICdWYXJpYWJsZScpIHx8IGF0dHIodmFyRWwsICduYW1lJykgfHwgJyc7XG4gICAgY29uc3QgeCA9IE51bWJlcihhdHRyKGNoaWxkKHZhckVsLCAnUG9zaXRpb24nKSwgJ1gnKSkgfHwgaWR4ICogMTIwO1xuICAgIGNvbnN0IHkgPSBOdW1iZXIoYXR0cihjaGlsZCh2YXJFbCwgJ1Bvc2l0aW9uJyksICdZJykpIHx8IDA7XG4gICAgY29uc3QgdmFyVHlwZSA9IHJlc29sdmVyLnJlc29sdmUodmFyTmFtZSk7XG4gICAgbm9kZXMucHVzaCh7XG4gICAgICBpZDogYHhlZi1mYmQtJHtpZH1gLFxuICAgICAgdHlwZTogJ0lOT1VUX1ZBUklBQkxFJyBhcyBGQkRCbG9ja1R5cGUsXG4gICAgICB0YWc6IHsgbmFtZTogdmFyTmFtZSwgZGF0YVR5cGU6IHZhclR5cGUgfSxcbiAgICAgIHBvc2l0aW9uOiB7IHgsIHkgfSxcbiAgICAgIGlucHV0czogW3sgaWQ6IHVpZCgncGluJyksIG5hbWU6ICdJTicsIGRhdGFUeXBlOiB2YXJUeXBlIH1dLFxuICAgICAgb3V0cHV0czogW3sgaWQ6IHVpZCgncGluJyksIG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogdmFyVHlwZSB9XSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFBhcnNlIGp1bXBPYmplY3QvbGFiZWxPYmplY3QgYXMgc3BlY2lhbCBub2RlcyAoWEVGIEdPVE8gY29uc3RydWN0cylcbiAgZm9yIChjb25zdCBqbXBFbCBvZiBjaGlsZEFycmF5KGJvZHlFbCwgJ2p1bXBPYmplY3QnKSkge1xuICAgIGNvbnN0IGxhYmVsID0gYXR0cihqbXBFbCwgJ2xhYmVsJykgfHwgJyc7XG4gICAgY29uc3QgcG9zRWwgPSBjaGlsZChqbXBFbCwgJ29ialBvc2l0aW9uJyk7XG4gICAgY29uc3QgeCA9IE51bWJlcihhdHRyKHBvc0VsLCAncG9zWCcpKSB8fCAwO1xuICAgIGNvbnN0IHkgPSBOdW1iZXIoYXR0cihwb3NFbCwgJ3Bvc1knKSkgfHwgMDtcbiAgICBjb25zdCBub2RlSWQgPSB1aWQoJ3hlZi1qdW1wJyk7XG4gICAgbm9kZXMucHVzaCh7IGlkOiBub2RlSWQsIHR5cGU6ICdNT1ZFJyBhcyBGQkRCbG9ja1R5cGUsIGluc3RhbmNlTmFtZTogYD4+PiR7bGFiZWx9YCwgcG9zaXRpb246IHsgeCwgeSB9LCBpbnB1dHM6IFt7IGlkOiB1aWQoJ3BpbicpLCBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ0JPT0wnIH1dLCBvdXRwdXRzOiBbXSB9KTtcbiAgICAobm9kZXNbbm9kZXMubGVuZ3RoIC0gMV0gYXMgYW55KS5feGVmSnVtcCA9IHsgbGFiZWwgfTtcbiAgfVxuICBmb3IgKGNvbnN0IGxibEVsIG9mIGNoaWxkQXJyYXkoYm9keUVsLCAnbGFiZWxPYmplY3QnKSkge1xuICAgIGNvbnN0IGxhYmVsID0gYXR0cihsYmxFbCwgJ2xhYmVsJykgfHwgJyc7XG4gICAgY29uc3QgcG9zRWwgPSBjaGlsZChsYmxFbCwgJ29ialBvc2l0aW9uJyk7XG4gICAgY29uc3QgeCA9IE51bWJlcihhdHRyKHBvc0VsLCAncG9zWCcpKSB8fCAwO1xuICAgIGNvbnN0IHkgPSBOdW1iZXIoYXR0cihwb3NFbCwgJ3Bvc1knKSkgfHwgMDtcbiAgICBjb25zdCBub2RlSWQgPSB1aWQoJ3hlZi1sYWJlbCcpO1xuICAgIG5vZGVzLnB1c2goeyBpZDogbm9kZUlkLCB0eXBlOiAnTU9WRScgYXMgRkJEQmxvY2tUeXBlLCBpbnN0YW5jZU5hbWU6IGA8PDwke2xhYmVsfWAsIHBvc2l0aW9uOiB7IHgsIHkgfSwgaW5wdXRzOiBbXSwgb3V0cHV0czogW3sgaWQ6IHVpZCgncGluJyksIG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0JPT0wnIH1dIH0pO1xuICAgIChub2Rlc1tub2Rlcy5sZW5ndGggLSAxXSBhcyBhbnkpLl94ZWZMYWJlbCA9IHsgbGFiZWwgfTtcbiAgfVxuXG4gIC8vIEJ1ZyAxMjogcGFyc2Ugd2lyZSBjb25uZWN0aW9ucyBcdTIwMTQgbGlua0ZCIChyZWFsIFhFRikgZmlyc3QsIHRoZW4gbGVnYWN5IExpbmsvQ29ubmVjdGlvblxuICBmb3IgKGNvbnN0IGxpbmtGQkVsIG9mIGNoaWxkQXJyYXkoYm9keUVsLCAnbGlua0ZCJykpIHtcbiAgICBjb25zdCBzcmMgPSBjaGlsZChsaW5rRkJFbCwgJ2xpbmtTb3VyY2UnKTtcbiAgICBjb25zdCBkc3QgPSBjaGlsZChsaW5rRkJFbCwgJ2xpbmtEZXN0aW5hdGlvbicpO1xuICAgIGNvbnN0IGZyb21JbnN0YW5jZU5hbWUgPSBhdHRyKHNyYywgJ3BhcmVudE9iamVjdE5hbWUnKTtcbiAgICBjb25zdCBmcm9tUGluID0gYXR0cihzcmMsICdwaW5OYW1lJykgfHwgJ09VVCc7XG4gICAgY29uc3QgdG9JbnN0YW5jZU5hbWUgPSBhdHRyKGRzdCwgJ3BhcmVudE9iamVjdE5hbWUnKTtcbiAgICBjb25zdCB0b1BpbiA9IGF0dHIoZHN0LCAncGluTmFtZScpIHx8ICdJTic7XG4gICAgaWYgKGZyb21JbnN0YW5jZU5hbWUgJiYgdG9JbnN0YW5jZU5hbWUpIHtcbiAgICAgIGNvbnN0IGZyb21Ob2RlSWQgPSBpbnN0YW5jZU5hbWVUb05vZGVJZC5nZXQoZnJvbUluc3RhbmNlTmFtZSkgfHwgYHhlZi1mYmQtJHtmcm9tSW5zdGFuY2VOYW1lfWA7XG4gICAgICBjb25zdCB0b05vZGVJZCA9IGluc3RhbmNlTmFtZVRvTm9kZUlkLmdldCh0b0luc3RhbmNlTmFtZSkgfHwgYHhlZi1mYmQtJHt0b0luc3RhbmNlTmFtZX1gO1xuICAgICAgLy8gUHJlc2VydmUgd2lyZSByb3V0aW5nIHBvc2l0aW9ucyBmb3Igcm91bmQtdHJpcFxuICAgICAgY29uc3Qgc3JjUG9zID0gY2hpbGQoc3JjLCAnb2JqUG9zaXRpb24nKTtcbiAgICAgIGNvbnN0IGRzdFBvcyA9IGNoaWxkKGRzdCwgJ29ialBvc2l0aW9uJyk7XG4gICAgICBjb25zdCBncmlkUG9zaXRpb25zOiB7IHBvc1g6IHN0cmluZzsgcG9zWTogc3RyaW5nIH1bXSA9IFtdO1xuICAgICAgZm9yIChjb25zdCBncCBvZiBjaGlsZEFycmF5KGxpbmtGQkVsLCAnZ3JpZE9ialBvc2l0aW9uJykpIHtcbiAgICAgICAgY29uc3QgZ3B4ID0gYXR0cihncCwgJ3Bvc1gnKTtcbiAgICAgICAgY29uc3QgZ3B5ID0gYXR0cihncCwgJ3Bvc1knKTtcbiAgICAgICAgaWYgKGdweCAmJiBncHkpIGdyaWRQb3NpdGlvbnMucHVzaCh7IHBvc1g6IGdweCwgcG9zWTogZ3B5IH0pO1xuICAgICAgfVxuICAgICAgY29uc3Qgd2lyZTogYW55ID0ge1xuICAgICAgICBpZDogdWlkKCd3aXJlJyksXG4gICAgICAgIGZyb206IHsgbm9kZUlkOiBmcm9tTm9kZUlkLCBwaW46IGZyb21QaW4gfSxcbiAgICAgICAgdG86IHsgbm9kZUlkOiB0b05vZGVJZCwgcGluOiB0b1BpbiB9LFxuICAgICAgfTtcbiAgICAgIHdpcmUuX3hlZlJvdXRlID0ge1xuICAgICAgICBzcmNQb3M6IHNyY1BvcyA/IHsgcG9zWDogYXR0cihzcmNQb3MsICdwb3NYJyksIHBvc1k6IGF0dHIoc3JjUG9zLCAncG9zWScpIH0gOiB1bmRlZmluZWQsXG4gICAgICAgIGRzdFBvczogZHN0UG9zID8geyBwb3NYOiBhdHRyKGRzdFBvcywgJ3Bvc1gnKSwgcG9zWTogYXR0cihkc3RQb3MsICdwb3NZJykgfSA6IHVuZGVmaW5lZCxcbiAgICAgICAgZ3JpZFBvc2l0aW9uczogZ3JpZFBvc2l0aW9ucy5sZW5ndGggPiAwID8gZ3JpZFBvc2l0aW9ucyA6IHVuZGVmaW5lZCxcbiAgICAgIH07XG4gICAgICB3aXJlcy5wdXNoKHdpcmUpO1xuICAgIH1cbiAgfVxuICBmb3IgKGNvbnN0IGxpbmtFbCBvZiBjaGlsZEFycmF5KGJvZHlFbCwgJ0xpbmsnKS5jb25jYXQoY2hpbGRBcnJheShib2R5RWwsICdDb25uZWN0aW9uJykpKSB7XG4gICAgY29uc3QgZnJvbUlkID0gYXR0cihsaW5rRWwsICdTb3VyY2VJZCcpIHx8IGF0dHIobGlua0VsLCAnZnJvbScpO1xuICAgIGNvbnN0IHRvSWQgPSBhdHRyKGxpbmtFbCwgJ1RhcmdldElkJykgfHwgYXR0cihsaW5rRWwsICd0bycpO1xuICAgIGNvbnN0IGZyb21QaW4gPSBhdHRyKGxpbmtFbCwgJ1NvdXJjZVBpbicpIHx8IGF0dHIobGlua0VsLCAnRnJvbVBpbicpIHx8ICdPVVQnO1xuICAgIGNvbnN0IHRvUGluID0gYXR0cihsaW5rRWwsICdUYXJnZXRQaW4nKSB8fCBhdHRyKGxpbmtFbCwgJ1RvUGluJykgfHwgJ0lOJztcbiAgICBpZiAoZnJvbUlkICYmIHRvSWQpIHtcbiAgICAgIHdpcmVzLnB1c2goe1xuICAgICAgICBpZDogdWlkKCd3aXJlJyksXG4gICAgICAgIGZyb206IHsgbm9kZUlkOiBgeGVmLWZiZC0ke2Zyb21JZH1gLCBwaW46IGZyb21QaW4gfSxcbiAgICAgICAgdG86IHsgbm9kZUlkOiBgeGVmLWZiZC0ke3RvSWR9YCwgcGluOiB0b1BpbiB9LFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgbm9kZXMsIHdpcmVzIH07XG59XG5cbmZ1bmN0aW9uIG1hcFNjaG5laWRlckZCRFR5cGUodHlwZU5hbWU6IHN0cmluZyk6IEZCREJsb2NrVHlwZSB7XG4gIGNvbnN0IG1hcDogUmVjb3JkPHN0cmluZywgRkJEQmxvY2tUeXBlPiA9IHtcbiAgICBBTkQ6ICdBTkQnLCBPUjogJ09SJywgTk9UOiAnTk9UJywgWE9SOiAnWE9SJywgTkFORDogJ05BTkQnLCBOT1I6ICdOT1InLFxuICAgIEFERDogJ0FERCcsIFNVQjogJ1NVQicsIE1VTDogJ01VTCcsIERJVjogJ0RJVicsIE1PRDogJ01PRCcsXG4gICAgVE9OOiAnVE9OJywgVE9GOiAnVE9GJywgVFA6ICdUUCcsIENUVTogJ0NUVScsIENURDogJ0NURCcsIENUVUQ6ICdDVFVEJyxcbiAgICBTUjogJ1NSJywgUlM6ICdSUycsIFJfVFJJRzogJ1JUUklHJywgRl9UUklHOiAnRlRSSUcnLFxuICAgIEdUOiAnR1QnLCBHRTogJ0dFJywgTFQ6ICdMVCcsIExFOiAnTEUnLCBFUTogJ0VRJywgTkU6ICdORScsXG4gICAgU0VMOiAnU0VMJywgTVVYOiAnTVVYJywgTElNSVQ6ICdMSU1JVCcsIE1PVkU6ICdNT1ZFJywgTU9WOiAnTU9WRScsXG4gICAgQUJTOiAnQUJTJywgU1FSVDogJ1NRUlQnLCBNSU46ICdNSU4nLCBNQVg6ICdNQVgnLFxuICB9O1xuICByZXR1cm4gbWFwW3R5cGVOYW1lLnRvVXBwZXJDYXNlKCldIHx8ICdNT1ZFJztcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFhFRiBTRkMgcGFyc2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBwYXJzZVhFRlNGQyhib2R5RWw6IHVua25vd24sIHBvdU5hbWU6IHN0cmluZywgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdKTogU0ZDUHJvZ3JhbSB7XG4gIGNvbnN0IHN0ZXBzOiBTRkNTdGVwW10gPSBbXTtcbiAgY29uc3QgdHJhbnNpdGlvbnM6IFNGQ1RyYW5zaXRpb25bXSA9IFtdO1xuICBjb25zdCBsaW5rczogU0ZDTGlua1tdID0gW107XG5cbiAgLy8gQnVpbGQgbG9va3VwIHNldHMgZm9yIHN0ZXAvdHJhbnNpdGlvbiBJRHMgdG8gZml4IGxpbmsgZGlyZWN0aW9uXG4gIGNvbnN0IHN0ZXBJZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgY29uc3QgdHJhbnNpdGlvbklkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gIGZvciAoY29uc3Qgc3RlcEVsIG9mIGNoaWxkQXJyYXkoYm9keUVsLCAnU3RlcCcpKSB7XG4gICAgY29uc3QgaWQgPSBhdHRyKHN0ZXBFbCwgJ0lkJykgfHwgYXR0cihzdGVwRWwsICdOYW1lJyk7XG4gICAgaWYgKGlkKSBzdGVwSWRzLmFkZChpZCk7XG4gICAgY29uc3QgbmFtZSA9IGF0dHIoc3RlcEVsLCAnTmFtZScpIHx8IGlkO1xuICAgIGNvbnN0IGlzSW5pdGlhbCA9IGF0dHIoc3RlcEVsLCAnSW5pdGlhbCcpID09PSAndHJ1ZScgfHwgYXR0cihzdGVwRWwsICdJc0luaXRpYWwnKSA9PT0gJ3RydWUnO1xuXG4gICAgLy8gUGFyc2Ugc3RlcCBhY3Rpb25zXG4gICAgY29uc3QgYWN0aW9uczogU0ZDQWN0aW9uW10gPSBbXTtcbiAgICBjb25zdCB2YWxpZFF1YWxpZmllcnM6IEFjdGlvblF1YWxpZmllcltdID0gWydOJywgJ1MnLCAnUicsICdQJywgJ1AxJywgJ1AwJywgJ0wnLCAnRCcsICdTRCcsICdEUycsICdTTCddO1xuXG4gICAgLy8gQWN0aW9ucyBjYW4gYmUgaW4gPEFjdGlvbkJsb2NrPjxBY3Rpb24+IG9yIGRpcmVjdGx5IGFzIDxBY3Rpb24+IGNoaWxkcmVuXG4gICAgY29uc3QgYWN0aW9uQmxvY2tzID0gY2hpbGRBcnJheShzdGVwRWwsICdBY3Rpb25CbG9jaycpO1xuICAgIGNvbnN0IGRpcmVjdEFjdGlvbnMgPSBjaGlsZEFycmF5KHN0ZXBFbCwgJ0FjdGlvbicpO1xuICAgIGNvbnN0IGFsbEFjdGlvbkVscyA9IGFjdGlvbkJsb2Nrcy5mbGF0TWFwKGFiID0+IGNoaWxkQXJyYXkoYWIsICdBY3Rpb24nKSkuY29uY2F0KGRpcmVjdEFjdGlvbnMpO1xuXG4gICAgZm9yIChjb25zdCBhY3Rpb25FbCBvZiBhbGxBY3Rpb25FbHMpIHtcbiAgICAgIGNvbnN0IHF1YWxpZmllciA9IChhdHRyKGFjdGlvbkVsLCAnUXVhbGlmaWVyJykgfHwgYXR0cihhY3Rpb25FbCwgJ3F1YWxpZmllcicpIHx8ICdOJykudG9VcHBlckNhc2UoKSBhcyBBY3Rpb25RdWFsaWZpZXI7XG4gICAgICBjb25zdCBhY3Rpb25OYW1lID0gYXR0cihhY3Rpb25FbCwgJ05hbWUnKSB8fCBhdHRyKGFjdGlvbkVsLCAnQWN0aW9uTmFtZScpIHx8IGF0dHIoYWN0aW9uRWwsICduYW1lJykgfHwgJyc7XG4gICAgICBjb25zdCBib2R5ID0gdGV4dChjaGlsZChhY3Rpb25FbCwgJ0JvZHknKSA/PyBjaGlsZChhY3Rpb25FbCwgJ1NUJykgPz8gYWN0aW9uRWwpIHx8IHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IGR1cmF0aW9uID0gYXR0cihhY3Rpb25FbCwgJ0R1cmF0aW9uJykgfHwgYXR0cihhY3Rpb25FbCwgJ2R1cmF0aW9uJykgfHwgdW5kZWZpbmVkO1xuXG4gICAgICBpZiAoYWN0aW9uTmFtZSB8fCBib2R5KSB7XG4gICAgICAgIGFjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IHVpZChgYWN0aW9uLSR7aWR9YCksXG4gICAgICAgICAgcXVhbGlmaWVyOiB2YWxpZFF1YWxpZmllcnMuaW5jbHVkZXMocXVhbGlmaWVyKSA/IHF1YWxpZmllciA6ICdOJyxcbiAgICAgICAgICB0YWc6IHsgbmFtZTogYWN0aW9uTmFtZSB8fCBgJHtuYW1lfV9BY3Rpb25gLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICAgICAgZHVyYXRpb24sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHN0ZXBzLnB1c2goe1xuICAgICAgaWQ6IGB4ZWYtc3RlcC0ke2lkfWAsXG4gICAgICBuYW1lOiBuYW1lIHx8IGBTdGVwXyR7aWR9YCxcbiAgICAgIGlzSW5pdGlhbCxcbiAgICAgIGFjdGlvbnMsXG4gICAgICBwb3NpdGlvbjoge1xuICAgICAgICB4OiBOdW1iZXIoYXR0cihjaGlsZChzdGVwRWwsICdQb3NpdGlvbicpLCAnWCcpKSB8fCAwLFxuICAgICAgICB5OiBOdW1iZXIoYXR0cihjaGlsZChzdGVwRWwsICdQb3NpdGlvbicpLCAnWScpKSB8fCAwLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIGZvciAoY29uc3QgdHJhbnNFbCBvZiBjaGlsZEFycmF5KGJvZHlFbCwgJ1RyYW5zaXRpb24nKSkge1xuICAgIGNvbnN0IGlkID0gYXR0cih0cmFuc0VsLCAnSWQnKSB8fCBhdHRyKHRyYW5zRWwsICdOYW1lJyk7XG4gICAgaWYgKGlkKSB0cmFuc2l0aW9uSWRzLmFkZChpZCk7XG4gICAgY29uc3QgY29uZGl0aW9uID0gdGV4dChjaGlsZCh0cmFuc0VsLCAnQ29uZGl0aW9uJykgPz8gdHJhbnNFbCkgfHwgJ1RSVUUnO1xuICAgIGNvbnN0IHByaW9yaXR5ID0gTnVtYmVyKGF0dHIodHJhbnNFbCwgJ1ByaW9yaXR5JykpIHx8IHVuZGVmaW5lZDtcbiAgICB0cmFuc2l0aW9ucy5wdXNoKHtcbiAgICAgIGlkOiBgeGVmLXRyYW5zLSR7aWR9YCxcbiAgICAgIGNvbmRpdGlvbixcbiAgICAgIHByaW9yaXR5LFxuICAgICAgcG9zaXRpb246IHtcbiAgICAgICAgeDogTnVtYmVyKGF0dHIoY2hpbGQodHJhbnNFbCwgJ1Bvc2l0aW9uJyksICdYJykpIHx8IDAsXG4gICAgICAgIHk6IE51bWJlcihhdHRyKGNoaWxkKHRyYW5zRWwsICdQb3NpdGlvbicpLCAnWScpKSB8fCAwLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIEJ1aWxkIGxpbmtzIHdpdGggY29ycmVjdCBkaXJlY3Rpb24gZGV0ZWN0aW9uXG4gIGZvciAoY29uc3QgbGlua0VsIG9mIGNoaWxkQXJyYXkoYm9keUVsLCAnVHJhbnNpdGlvbkxpbmsnKS5jb25jYXQoY2hpbGRBcnJheShib2R5RWwsICdMaW5rJykpKSB7XG4gICAgY29uc3QgZnJvbSA9IGF0dHIobGlua0VsLCAnU291cmNlSWQnKSB8fCBhdHRyKGxpbmtFbCwgJ2Zyb20nKTtcbiAgICBjb25zdCB0byA9IGF0dHIobGlua0VsLCAnVGFyZ2V0SWQnKSB8fCBhdHRyKGxpbmtFbCwgJ3RvJyk7XG4gICAgaWYgKCFmcm9tIHx8ICF0bykgY29udGludWU7XG5cbiAgICAvLyBEZXRlcm1pbmUgY29ycmVjdCBwcmVmaXggYmFzZWQgb24gd2hldGhlciBlYWNoIElEIGlzIGEgc3RlcCBvciB0cmFuc2l0aW9uXG4gICAgY29uc3QgZnJvbUlzU3RlcCA9IHN0ZXBJZHMuaGFzKGZyb20pO1xuICAgIGNvbnN0IGZyb21Jc1RyYW5zID0gdHJhbnNpdGlvbklkcy5oYXMoZnJvbSk7XG4gICAgY29uc3QgdG9Jc1N0ZXAgPSBzdGVwSWRzLmhhcyh0byk7XG4gICAgY29uc3QgdG9Jc1RyYW5zID0gdHJhbnNpdGlvbklkcy5oYXModG8pO1xuXG4gICAgbGV0IGZyb21JZDogc3RyaW5nO1xuICAgIGxldCB0b0lkOiBzdHJpbmc7XG5cbiAgICBpZiAoZnJvbUlzU3RlcCkgZnJvbUlkID0gYHhlZi1zdGVwLSR7ZnJvbX1gO1xuICAgIGVsc2UgaWYgKGZyb21Jc1RyYW5zKSBmcm9tSWQgPSBgeGVmLXRyYW5zLSR7ZnJvbX1gO1xuICAgIGVsc2UgZnJvbUlkID0gYHhlZi1zdGVwLSR7ZnJvbX1gOyAvLyBkZWZhdWx0IGFzc3VtcHRpb25cblxuICAgIGlmICh0b0lzU3RlcCkgdG9JZCA9IGB4ZWYtc3RlcC0ke3RvfWA7XG4gICAgZWxzZSBpZiAodG9Jc1RyYW5zKSB0b0lkID0gYHhlZi10cmFucy0ke3RvfWA7XG4gICAgZWxzZSB0b0lkID0gYHhlZi10cmFucy0ke3RvfWA7IC8vIGRlZmF1bHQgYXNzdW1wdGlvblxuXG4gICAgbGlua3MucHVzaCh7IGlkOiB1aWQoYGxpbmstJHtmcm9tfS0ke3RvfWApLCBmcm9tOiBmcm9tSWQsIHRvOiB0b0lkLCB0eXBlOiAnc2ltcGxlJyB9KTtcbiAgfVxuXG4gIHJldHVybiB7IHN0ZXBzLCB0cmFuc2l0aW9ucywgbGlua3MsIGJyYW5jaGVzOiBbXSB9O1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgRXhwb3J0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgZnVuY3Rpb24gZXhwb3J0U2NobmVpZGVyKHByb2plY3Q6IE5vcm1hbGl6ZWRQcm9qZWN0KTogRXhwb3J0UmVzdWx0IHtcbiAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3Qgc2lkZWNhciA9IHByb2plY3Quc2lkZWNhcjtcblxuICBjb25zdCBnbG9iYWxWYXJzID0gcHJvamVjdC5nbG9iYWxUYWdzLm1hcCh0YWdUb1hFRlZhcmlhYmxlKTtcbiAgY29uc3QgcHJvZ3JhbXMgPSBwcm9qZWN0LnBvdXMubWFwKHBvdSA9PiBwb3VUb1hFRlByb2dyYW0ocG91LCB3YXJuaW5ncykpO1xuXG4gIC8vIEJ1ZyAxNjogZXhwb3J0IHVzZXMgcmVhbCBYRUYgc3RydWN0dXJlIFx1MjAxNCBGRUZFeGNoYW5nZUZpbGUgcm9vdCwgZGF0YUJsb2NrIGZvciBnbG9iYWxzLCA8cHJvZ3JhbT4gYXJyYXlcbiAgY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcbiAgY29uc3QgZHRTdHIgPSBgZGF0ZV9hbmRfdGltZSMke25vdy5nZXRGdWxsWWVhcigpfS0ke25vdy5nZXRNb250aCgpKzF9LSR7bm93LmdldERhdGUoKX0tJHtub3cuZ2V0SG91cnMoKX06JHtub3cuZ2V0TWludXRlcygpfToke25vdy5nZXRTZWNvbmRzKCl9YDtcbiAgY29uc3Qgb2JqID0ge1xuICAgIEZFRkV4Y2hhbmdlRmlsZToge1xuICAgICAgZmlsZUhlYWRlcjoge1xuICAgICAgICAnQF9jb21wYW55JzogJ1BsYXhpbycsXG4gICAgICAgICdAX3Byb2R1Y3QnOiAnUGxheGlvIFBMQyBFZGl0b3InLFxuICAgICAgICAnQF9kYXRlVGltZSc6IGR0U3RyLFxuICAgICAgICAnQF9jb250ZW50JzogJ1Byb2plY3Qgc291cmNlIGZpbGUnLFxuICAgICAgICAnQF9EVERWZXJzaW9uJzogJzQxJyxcbiAgICAgIH0sXG4gICAgICBjb250ZW50SGVhZGVyOiB7XG4gICAgICAgICdAX25hbWUnOiBwcm9qZWN0LnByb2plY3ROYW1lLFxuICAgICAgICAnQF92ZXJzaW9uJzogc2lkZWNhci52ZW5kb3JTcGVjaWZpY0dsb2JhbHM/LlsndmVyc2lvbiddID8/ICcwLjAuMScsXG4gICAgICAgICdAX2RhdGVUaW1lJzogZHRTdHIsXG4gICAgICB9LFxuICAgICAgZGF0YUJsb2NrOiB7XG4gICAgICAgIHZhcmlhYmxlczogZ2xvYmFsVmFycy5sZW5ndGggPyBnbG9iYWxWYXJzIDogdW5kZWZpbmVkLFxuICAgICAgfSxcbiAgICAgIHByb2dyYW06IHByb2dyYW1zLFxuICAgIH0sXG4gIH07XG5cbiAgcmV0dXJuIHsgb2s6IHRydWUsIHhtbENvbnRlbnQ6IGJ1aWxkWE1MKG9iaiksIGVycm9ycywgd2FybmluZ3MgfTtcbn1cblxuZnVuY3Rpb24gdGFnVG9YRUZWYXJpYWJsZSh0YWc6IE5vcm1hbGl6ZWRUYWcpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIGNvbnN0IG1ldGEgPSAodGFnIGFzIGFueSkuX3hlZk1ldGEgYXMgeyBvcmlnaW5hbFR5cGU/OiBzdHJpbmc7IGF0dHJpYnV0ZXM/OiB7IG5hbWU6IHN0cmluZzsgdmFsdWU6IHN0cmluZyB9W10gfSB8IHVuZGVmaW5lZDtcbiAgY29uc3QgdHlwZU5hbWUgPSBtZXRhPy5vcmlnaW5hbFR5cGUgfHwgdGFnLmRhdGFUeXBlO1xuICBjb25zdCByZXN1bHQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xuICAgICdAX25hbWUnOiB0YWcubmFtZSxcbiAgICAnQF90eXBlTmFtZSc6IHR5cGVOYW1lLFxuICB9O1xuICBpZiAodGFnLmFkZHJlc3MpIHJlc3VsdFsnQF90b3BvbG9naWNhbEFkZHJlc3MnXSA9IHRhZy5hZGRyZXNzO1xuICBpZiAodGFnLmRlc2NyaXB0aW9uKSByZXN1bHRbJ2NvbW1lbnQnXSA9IHRhZy5kZXNjcmlwdGlvbjtcbiAgaWYgKHRhZy5pbml0aWFsVmFsdWUpIHJlc3VsdFsndmFyaWFibGVJbml0J10gPSB7ICdAX3ZhbHVlJzogdGFnLmluaXRpYWxWYWx1ZSB9O1xuICAvLyBFbWl0IGF0dHJpYnV0ZSBjaGlsZHJlbiBmb3Igcm91bmQtdHJpcFxuICBpZiAobWV0YT8uYXR0cmlidXRlcyAmJiBtZXRhLmF0dHJpYnV0ZXMubGVuZ3RoID4gMCkge1xuICAgIHJlc3VsdFsnYXR0cmlidXRlJ10gPSBtZXRhLmF0dHJpYnV0ZXMubWFwKGEgPT4gKHsgJ0BfbmFtZSc6IGEubmFtZSwgJ0BfdmFsdWUnOiBhLnZhbHVlIH0pKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBwb3VUb1hFRlByb2dyYW0ocG91OiBOb3JtYWxpemVkUE9VLCB3YXJuaW5nczogc3RyaW5nW10pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIGNvbnN0IGxvY2FsVmFycyA9IHBvdS5sb2NhbFRhZ3MubWFwKHRhZ1RvWEVGVmFyaWFibGUpO1xuXG4gIC8vIEJ1ZyAxNjogbG9jYWwgdmFycyBpbiBwdWJsaWNMb2NhbFZhcmlhYmxlc1xuICBjb25zdCBsb2NhbFZhcnNTZWN0aW9uID0gbG9jYWxWYXJzLmxlbmd0aCA+IDBcbiAgICA/IHsgcHVibGljTG9jYWxWYXJpYWJsZXM6IHsgdmFyaWFibGVzOiBsb2NhbFZhcnMgfSB9XG4gICAgOiB7fTtcblxuICBsZXQgYm9keVNlY3Rpb246IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XG5cbiAgaWYgKHBvdS5sYW5ndWFnZSA9PT0gJ0xEJyAmJiBwb3UubGFkZGVyUHJvZ3JhbSkge1xuICAgIC8vIEJ1ZyAxNjogd3JhcCBMRCBib2R5IGluIExEU291cmNlXG4gICAgY29uc3QgbGRCb2R5ID0ge1xuICAgICAgUnVuZzogcG91LmxhZGRlclByb2dyYW0ucnVuZ3MubWFwKChydW5nLCByaSkgPT4ge1xuICAgICAgICBjb25zdCBydW5nT2JqOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAgICAgICAnQF9OdW1iZXInOiBTdHJpbmcocmkgKyAxKSxcbiAgICAgICAgICBDb21tZW50OiBydW5nLmNvbW1lbnQgfHwgdW5kZWZpbmVkLFxuICAgICAgICAgIC4uLmJ1aWxkWEVGUnVuZ0VsZW1lbnRzKHJ1bmcuZWxlbWVudHMpLFxuICAgICAgICB9O1xuICAgICAgICBpZiAocnVuZy5icmFuY2hlcyAmJiBydW5nLmJyYW5jaGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBydW5nT2JqLkJyYW5jaCA9IHJ1bmcuYnJhbmNoZXMubWFwKGJyYW5jaCA9PiBidWlsZFhFRlJ1bmdFbGVtZW50cyhicmFuY2guZWxlbWVudHMpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcnVuZ09iajtcbiAgICAgIH0pLFxuICAgIH07XG4gICAgYm9keVNlY3Rpb24gPSB7IExEU291cmNlOiBsZEJvZHkgfTtcbiAgfSBlbHNlIGlmIChwb3UubGFuZ3VhZ2UgPT09ICdGQkQnICYmIHBvdS5mYmRQcm9ncmFtKSB7XG4gICAgLy8gQnVnIDE2OiBGQkQgYm9keSB3cmFwcGVkIGluIEZCRFNvdXJjZSAobmV0d29ya0ZCRCB3cmFwcGVkIGluc2lkZSBidWlsZFhFRkZCREV4cG9ydClcbiAgICBib2R5U2VjdGlvbiA9IHsgRkJEU291cmNlOiBidWlsZFhFRkZCREV4cG9ydChwb3UuZmJkUHJvZ3JhbSkgfTtcbiAgfSBlbHNlIGlmIChwb3UubGFuZ3VhZ2UgPT09ICdTRkMnICYmIHBvdS5zZmNQcm9ncmFtKSB7XG4gICAgYm9keVNlY3Rpb24gPSB7IFNGQ1NvdXJjZTogYnVpbGRYRUZTRkNFeHBvcnQocG91LnNmY1Byb2dyYW0pIH07XG4gIH0gZWxzZSBpZiAocG91Lmxhbmd1YWdlID09PSAnU1QnICYmIHBvdS5zdFNvdXJjZSkge1xuICAgIGJvZHlTZWN0aW9uID0geyBTVFNvdXJjZTogeyAnI3RleHQnOiBwb3Uuc3RTb3VyY2UgfSB9O1xuICB9IGVsc2Uge1xuICAgIHdhcm5pbmdzLnB1c2goYFBPVSBcIiR7cG91Lm5hbWV9XCI6ICR7cG91Lmxhbmd1YWdlfSBleHBvcnQgXHUyMDE0IGVtcHR5IGJvZHlgKTtcbiAgfVxuXG4gIC8vIEJ1ZyAxNjogZW1pdCA8cHJvZ3JhbT48aWRlbnRQcm9ncmFtIG5hbWU9XCIuLi5cIiB0eXBlPVwic2VjdGlvblwiIHRhc2s9XCJNQVNUXCI+XG4gIGNvbnN0IHBvdU1ldGEgPSAocG91IGFzIGFueSkuX3hlZk1ldGEgYXMgeyB0YXNrPzogc3RyaW5nOyBzZWN0aW9uVHlwZT86IHN0cmluZyB9IHwgdW5kZWZpbmVkO1xuICByZXR1cm4ge1xuICAgIGlkZW50UHJvZ3JhbToge1xuICAgICAgJ0BfbmFtZSc6IHBvdS5uYW1lLFxuICAgICAgJ0BfdHlwZSc6IHBvdU1ldGE/LnNlY3Rpb25UeXBlIHx8ICdzZWN0aW9uJyxcbiAgICAgICdAX3Rhc2snOiBwb3VNZXRhPy50YXNrIHx8ICdNQVNUJyxcbiAgICB9LFxuICAgIC4uLmxvY2FsVmFyc1NlY3Rpb24sXG4gICAgLi4uYm9keVNlY3Rpb24sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGJ1aWxkWEVGUnVuZ0VsZW1lbnRzKGVsZW1lbnRzOiBMYWRkZXJFbGVtZW50W10pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duW10+IHtcbiAgY29uc3QgY29udGFjdHM6IHVua25vd25bXSA9IFtdO1xuICBjb25zdCBjb2lsczogdW5rbm93bltdID0gW107XG4gIGNvbnN0IGJsb2NrczogdW5rbm93bltdID0gW107XG4gIGZvciAoY29uc3QgZWwgb2YgZWxlbWVudHMpIHtcbiAgICBpZiAoZWwua2luZCA9PT0gJ2NvbnRhY3QnKSB7XG4gICAgICBjb25zdCBjID0gZWwgYXMgQ29udGFjdEVsZW1lbnQ7XG4gICAgICBjb25zdCB0eXBlTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0geyBOTzogJycsIE5DOiAnTkMnLCBQX0NPTlRBQ1Q6ICdQJywgTl9DT05UQUNUOiAnTicgfTtcbiAgICAgIGNvbnRhY3RzLnB1c2goeyAnQF9WYXJpYWJsZSc6IGMudGFnLm5hbWUsICdAX1R5cGUnOiB0eXBlTWFwW2MudHlwZV0gfHwgJycgfSk7XG4gICAgfSBlbHNlIGlmIChlbC5raW5kID09PSAnY29pbCcpIHtcbiAgICAgIGNvbnN0IGMgPSBlbCBhcyBDb2lsRWxlbWVudDtcbiAgICAgIGNvbnN0IHR5cGVNYXA6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7IG5vcm1hbDogJ05vcm1hbCcsIG5lZ2F0ZWQ6ICdOZWdhdGVkJywgc2V0OiAnU2V0JywgcmVzZXQ6ICdSZXNldCcsIGxhdGNoOiAnTGF0Y2gnLCB1bmxhdGNoOiAnVW5sYXRjaCcgfTtcbiAgICAgIGNvaWxzLnB1c2goeyAnQF9WYXJpYWJsZSc6IGMudGFnLm5hbWUsICdAX1R5cGUnOiB0eXBlTWFwW2MudHlwZV0gfHwgJ05vcm1hbCcgfSk7XG4gICAgfSBlbHNlIGlmIChlbC5raW5kID09PSAnYmxvY2snKSB7XG4gICAgICBjb25zdCBiID0gZWwgYXMgQmxvY2tFbGVtZW50O1xuICAgICAgY29uc3QgaW5wdXRQaW5zID0gT2JqZWN0LmVudHJpZXMoYi5waW5zIHx8IHt9KS5tYXAoKFtuYW1lLCByZWZdKSA9PiAoe1xuICAgICAgICAnQF9OYW1lJzogbmFtZSxcbiAgICAgICAgJ0BfVmFyaWFibGUnOiAocmVmIGFzIGFueSkubmFtZSxcbiAgICAgIH0pKTtcbiAgICAgIGJsb2Nrcy5wdXNoKHtcbiAgICAgICAgJ0BfVHlwZSc6IGIuZmJUeXBlLFxuICAgICAgICAnQF9JbnN0YW5jZSc6IGIuaW5zdGFuY2VOYW1lLFxuICAgICAgICAuLi4oaW5wdXRQaW5zLmxlbmd0aCA+IDAgPyB7IElucHV0UGluOiBpbnB1dFBpbnMgfSA6IHt9KSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBjb25zdCByZXN1bHQ6IFJlY29yZDxzdHJpbmcsIHVua25vd25bXT4gPSB7fTtcbiAgaWYgKGNvbnRhY3RzLmxlbmd0aCkgcmVzdWx0LkNvbnRhY3QgPSBjb250YWN0cztcbiAgaWYgKGNvaWxzLmxlbmd0aCkgcmVzdWx0LkNvaWwgPSBjb2lscztcbiAgaWYgKGJsb2Nrcy5sZW5ndGgpIHJlc3VsdC5GdW5jdGlvbkJsb2NrID0gYmxvY2tzO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBidWlsZFhFRkZCREV4cG9ydChmYmQ6IEZCRFByb2dyYW0pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIGNvbnN0IGdyaWQgPSAoZmJkIGFzIGFueSkuX3hlZkdyaWQgYXMgeyBuYlJvd3M/OiBzdHJpbmc7IG5iQ29sdW1ucz86IHN0cmluZyB9IHwgdW5kZWZpbmVkO1xuXG4gIC8vIEVtaXQganVtcE9iamVjdC9sYWJlbE9iamVjdFxuICBjb25zdCBqdW1wT2JqZWN0cyA9IGZiZC5ub2Rlcy5maWx0ZXIobiA9PiAobiBhcyBhbnkpLl94ZWZKdW1wKS5tYXAobiA9PiAoe1xuICAgICdAX2xhYmVsJzogKG4gYXMgYW55KS5feGVmSnVtcC5sYWJlbCxcbiAgICBvYmpQb3NpdGlvbjogeyAnQF9wb3NYJzogU3RyaW5nKG4ucG9zaXRpb24ueCksICdAX3Bvc1knOiBTdHJpbmcobi5wb3NpdGlvbi55KSB9LFxuICB9KSk7XG4gIGNvbnN0IGxhYmVsT2JqZWN0cyA9IGZiZC5ub2Rlcy5maWx0ZXIobiA9PiAobiBhcyBhbnkpLl94ZWZMYWJlbCkubWFwKG4gPT4gKHtcbiAgICAnQF9sYWJlbCc6IChuIGFzIGFueSkuX3hlZkxhYmVsLmxhYmVsLFxuICAgIG9ialBvc2l0aW9uOiB7ICdAX3Bvc1gnOiBTdHJpbmcobi5wb3NpdGlvbi54KSwgJ0BfcG9zWSc6IFN0cmluZyhuLnBvc2l0aW9uLnkpIH0sXG4gIH0pKTtcblxuICAvLyBCdWcgMTQ6IGVtaXQgRkZCQmxvY2sgd2l0aCBpbnN0YW5jZU5hbWUsIHR5cGVOYW1lLCBvYmpQb3NpdGlvbiwgZGVzY3JpcHRpb25GRkJcbiAgY29uc3QgYmxvY2tzID0gZmJkLm5vZGVzXG4gICAgLmZpbHRlcihuID0+IG4udHlwZSAhPT0gJ0lOX1ZBUklBQkxFJyAmJiBuLnR5cGUgIT09ICdPVVRfVkFSSUFCTEUnICYmIG4udHlwZSAhPT0gJ0lOT1VUX1ZBUklBQkxFJyAmJiAhKG4gYXMgYW55KS5feGVmSnVtcCAmJiAhKG4gYXMgYW55KS5feGVmTGFiZWwpXG4gICAgLm1hcChuID0+IHtcbiAgICAgIGNvbnN0IHhiID0gKG4gYXMgYW55KS5feGVmQmxvY2sgYXMgeyBvcmlnaW5hbFR5cGVOYW1lPzogc3RyaW5nOyBhZGRpdGlvbm5hbFBpbk51bWJlcj86IHN0cmluZzsgZW5Fbk8/OiBzdHJpbmc7IHdpZHRoPzogc3RyaW5nOyBoZWlnaHQ/OiBzdHJpbmc7IGV4ZWNBZnRlcj86IHN0cmluZyB9IHwgdW5kZWZpbmVkO1xuICAgICAgY29uc3QgaW5wdXRWYXJzID0gKG4uaW5wdXRzIHx8IFtdKS5tYXAoKHA6IGFueSkgPT4ge1xuICAgICAgICBjb25zdCBpdjogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsgJ0BfZm9ybWFsUGFyYW1ldGVyJzogcC5uYW1lIH07XG4gICAgICAgIGl2WydAX2ludmVydGVkUGluJ10gPSBwLm5lZ2F0ZWQgPyAndHJ1ZScgOiAnZmFsc2UnO1xuICAgICAgICBpZiAocC52YWx1ZSkgaXZbJ0BfZWZmZWN0aXZlUGFyYW1ldGVyJ10gPSBwLnZhbHVlO1xuICAgICAgICByZXR1cm4gaXY7XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IG91dHB1dFZhcnMgPSAobi5vdXRwdXRzIHx8IFtdKS5tYXAoKHA6IGFueSkgPT4ge1xuICAgICAgICBjb25zdCBvdjogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsgJ0BfZm9ybWFsUGFyYW1ldGVyJzogcC5uYW1lIH07XG4gICAgICAgIG92WydAX2ludmVydGVkUGluJ10gPSBwLm5lZ2F0ZWQgPyAndHJ1ZScgOiAnZmFsc2UnO1xuICAgICAgICBpZiAocC52YWx1ZSkgb3ZbJ0BfZWZmZWN0aXZlUGFyYW1ldGVyJ10gPSBwLnZhbHVlO1xuICAgICAgICByZXR1cm4gb3Y7XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGJsb2NrT2JqOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAgICAgJ0BfaW5zdGFuY2VOYW1lJzogbi5pbnN0YW5jZU5hbWUgfHwgbi5pZCxcbiAgICAgICAgJ0BfdHlwZU5hbWUnOiB4Yj8ub3JpZ2luYWxUeXBlTmFtZSB8fCBuLnR5cGUsXG4gICAgICB9O1xuICAgICAgaWYgKHhiPy5hZGRpdGlvbm5hbFBpbk51bWJlciAhPSBudWxsKSBibG9ja09ialsnQF9hZGRpdGlvbm5hbFBpbk51bWJlciddID0geGIuYWRkaXRpb25uYWxQaW5OdW1iZXI7XG4gICAgICBpZiAoeGI/LmVuRW5PICE9IG51bGwpIGJsb2NrT2JqWydAX2VuRW5PJ10gPSB4Yi5lbkVuTztcbiAgICAgIGlmICh4Yj8ud2lkdGggIT0gbnVsbCkgYmxvY2tPYmpbJ0Bfd2lkdGgnXSA9IHhiLndpZHRoO1xuICAgICAgaWYgKHhiPy5oZWlnaHQgIT0gbnVsbCkgYmxvY2tPYmpbJ0BfaGVpZ2h0J10gPSB4Yi5oZWlnaHQ7XG4gICAgICBibG9ja09ialsnb2JqUG9zaXRpb24nXSA9IHsgJ0BfcG9zWCc6IFN0cmluZyhuLnBvc2l0aW9uLngpLCAnQF9wb3NZJzogU3RyaW5nKG4ucG9zaXRpb24ueSkgfTtcbiAgICAgIGlmIChpbnB1dFZhcnMubGVuZ3RoID4gMCB8fCBvdXRwdXRWYXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgZGVzY0ZGQjogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fTtcbiAgICAgICAgaWYgKHhiPy5leGVjQWZ0ZXIgIT0gbnVsbCkgZGVzY0ZGQlsnQF9leGVjQWZ0ZXInXSA9IHhiLmV4ZWNBZnRlcjtcbiAgICAgICAgaWYgKGlucHV0VmFycy5sZW5ndGggPiAwKSBkZXNjRkZCWydpbnB1dFZhcmlhYmxlJ10gPSBpbnB1dFZhcnM7XG4gICAgICAgIGlmIChvdXRwdXRWYXJzLmxlbmd0aCA+IDApIGRlc2NGRkJbJ291dHB1dFZhcmlhYmxlJ10gPSBvdXRwdXRWYXJzO1xuICAgICAgICBibG9ja09ialsnZGVzY3JpcHRpb25GRkInXSA9IGRlc2NGRkI7XG4gICAgICB9XG4gICAgICByZXR1cm4gYmxvY2tPYmo7XG4gICAgfSk7XG5cbiAgY29uc3QgaW5WYXJzID0gZmJkLm5vZGVzLmZpbHRlcihuID0+IG4udHlwZSA9PT0gJ0lOX1ZBUklBQkxFJykubWFwKG4gPT4gKHtcbiAgICAnQF9JZCc6IG4uaWQsXG4gICAgJ0BfRXhwcmVzc2lvbic6IG4udGFnPy5uYW1lIHx8ICcnLFxuICAgIFBvc2l0aW9uOiB7ICdAX1gnOiBTdHJpbmcobi5wb3NpdGlvbi54KSwgJ0BfWSc6IFN0cmluZyhuLnBvc2l0aW9uLnkpIH0sXG4gIH0pKTtcblxuICBjb25zdCBvdXRWYXJzID0gZmJkLm5vZGVzLmZpbHRlcihuID0+IG4udHlwZSA9PT0gJ09VVF9WQVJJQUJMRScpLm1hcChuID0+ICh7XG4gICAgJ0BfSWQnOiBuLmlkLFxuICAgICdAX0V4cHJlc3Npb24nOiBuLnRhZz8ubmFtZSB8fCAnJyxcbiAgICBQb3NpdGlvbjogeyAnQF9YJzogU3RyaW5nKG4ucG9zaXRpb24ueCksICdAX1knOiBTdHJpbmcobi5wb3NpdGlvbi55KSB9LFxuICB9KSk7XG5cbiAgLy8gQnVnIDE1OiBlbWl0IGxpbmtGQiB3aXRoIGxpbmtTb3VyY2UvbGlua0Rlc3RpbmF0aW9uIGFuZCByb3V0aW5nXG4gIGNvbnN0IGxpbmtGQnMgPSBmYmQud2lyZXMubWFwKHcgPT4ge1xuICAgIGNvbnN0IHJvdXRlID0gKHcgYXMgYW55KS5feGVmUm91dGUgYXMgeyBzcmNQb3M/OiB7IHBvc1g6IHN0cmluZzsgcG9zWTogc3RyaW5nIH07IGRzdFBvcz86IHsgcG9zWDogc3RyaW5nOyBwb3NZOiBzdHJpbmcgfTsgZ3JpZFBvc2l0aW9ucz86IHsgcG9zWDogc3RyaW5nOyBwb3NZOiBzdHJpbmcgfVtdIH0gfCB1bmRlZmluZWQ7XG4gICAgY29uc3QgbGlua09iajogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgICBsaW5rU291cmNlOiB7XG4gICAgICAgICdAX3BhcmVudE9iamVjdE5hbWUnOiB3LmZyb20ubm9kZUlkLFxuICAgICAgICAnQF9waW5OYW1lJzogdy5mcm9tLnBpbixcbiAgICAgICAgLi4uKHJvdXRlPy5zcmNQb3MgPyB7IG9ialBvc2l0aW9uOiB7ICdAX3Bvc1gnOiByb3V0ZS5zcmNQb3MucG9zWCwgJ0BfcG9zWSc6IHJvdXRlLnNyY1Bvcy5wb3NZIH0gfSA6IHt9KSxcbiAgICAgIH0sXG4gICAgICBsaW5rRGVzdGluYXRpb246IHtcbiAgICAgICAgJ0BfcGFyZW50T2JqZWN0TmFtZSc6IHcudG8ubm9kZUlkLFxuICAgICAgICAnQF9waW5OYW1lJzogdy50by5waW4sXG4gICAgICAgIC4uLihyb3V0ZT8uZHN0UG9zID8geyBvYmpQb3NpdGlvbjogeyAnQF9wb3NYJzogcm91dGUuZHN0UG9zLnBvc1gsICdAX3Bvc1knOiByb3V0ZS5kc3RQb3MucG9zWSB9IH0gOiB7fSksXG4gICAgICB9LFxuICAgIH07XG4gICAgaWYgKHJvdXRlPy5ncmlkUG9zaXRpb25zKSB7XG4gICAgICBsaW5rT2JqWydncmlkT2JqUG9zaXRpb24nXSA9IHJvdXRlLmdyaWRQb3NpdGlvbnMubWFwKGdwID0+ICh7ICdAX3Bvc1gnOiBncC5wb3NYLCAnQF9wb3NZJzogZ3AucG9zWSB9KSk7XG4gICAgfVxuICAgIHJldHVybiBsaW5rT2JqO1xuICB9KTtcblxuICAvLyBXcmFwIGluIG5ldHdvcmtGQkQgd2l0aCBvcHRpb25hbCBncmlkIGRpbWVuc2lvbnNcbiAgY29uc3QgZmJkU291cmNlOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHt9O1xuICBpZiAoZ3JpZD8ubmJSb3dzKSBmYmRTb3VyY2VbJ0BfbmJSb3dzJ10gPSBncmlkLm5iUm93cztcbiAgaWYgKGdyaWQ/Lm5iQ29sdW1ucykgZmJkU291cmNlWydAX25iQ29sdW1ucyddID0gZ3JpZC5uYkNvbHVtbnM7XG4gIGZiZFNvdXJjZVsnbmV0d29ya0ZCRCddID0ge1xuICAgIGp1bXBPYmplY3Q6IGp1bXBPYmplY3RzLmxlbmd0aCA/IGp1bXBPYmplY3RzIDogdW5kZWZpbmVkLFxuICAgIGxhYmVsT2JqZWN0OiBsYWJlbE9iamVjdHMubGVuZ3RoID8gbGFiZWxPYmplY3RzIDogdW5kZWZpbmVkLFxuICAgIEZGQkJsb2NrOiBibG9ja3MubGVuZ3RoID8gYmxvY2tzIDogdW5kZWZpbmVkLFxuICAgIEluVmFyaWFibGU6IGluVmFycy5sZW5ndGggPyBpblZhcnMgOiB1bmRlZmluZWQsXG4gICAgT3V0VmFyaWFibGU6IG91dFZhcnMubGVuZ3RoID8gb3V0VmFycyA6IHVuZGVmaW5lZCxcbiAgICBsaW5rRkI6IGxpbmtGQnMubGVuZ3RoID8gbGlua0ZCcyA6IHVuZGVmaW5lZCxcbiAgfTtcbiAgcmV0dXJuIGZiZFNvdXJjZTtcbn1cblxuZnVuY3Rpb24gYnVpbGRYRUZTRkNFeHBvcnQoc2ZjOiBTRkNQcm9ncmFtKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICBjb25zdCBzdGVwcyA9IHNmYy5zdGVwcy5tYXAocyA9PiAoe1xuICAgICdAX0lkJzogcy5pZC5yZXBsYWNlKCd4ZWYtc3RlcC0nLCAnJyksXG4gICAgJ0BfTmFtZSc6IHMubmFtZSxcbiAgICAnQF9Jbml0aWFsJzogU3RyaW5nKHMuaXNJbml0aWFsKSxcbiAgICBQb3NpdGlvbjogeyAnQF9YJzogU3RyaW5nKHMucG9zaXRpb24ueCksICdAX1knOiBTdHJpbmcocy5wb3NpdGlvbi55KSB9LFxuICAgIC4uLihzLmFjdGlvbnMubGVuZ3RoID4gMCA/IHtcbiAgICAgIEFjdGlvbkJsb2NrOiB7XG4gICAgICAgIEFjdGlvbjogcy5hY3Rpb25zLm1hcChhID0+ICh7XG4gICAgICAgICAgJ0BfUXVhbGlmaWVyJzogYS5xdWFsaWZpZXIsXG4gICAgICAgICAgJ0BfTmFtZSc6IGEudGFnLm5hbWUsXG4gICAgICAgICAgJ0BfRHVyYXRpb24nOiBhLmR1cmF0aW9uIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgfSkpLFxuICAgICAgfSxcbiAgICB9IDoge30pLFxuICB9KSk7XG5cbiAgY29uc3QgdHJhbnNpdGlvbnMgPSBzZmMudHJhbnNpdGlvbnMubWFwKHQgPT4gKHtcbiAgICAnQF9JZCc6IHQuaWQucmVwbGFjZSgneGVmLXRyYW5zLScsICcnKSxcbiAgICAnQF9OYW1lJzogdC5pZCxcbiAgICBDb25kaXRpb246IHQuY29uZGl0aW9uLFxuICAgIFBvc2l0aW9uOiB7ICdAX1gnOiBTdHJpbmcodC5wb3NpdGlvbi54KSwgJ0BfWSc6IFN0cmluZyh0LnBvc2l0aW9uLnkpIH0sXG4gIH0pKTtcblxuICBjb25zdCBsaW5rcyA9IHNmYy5saW5rcy5tYXAobCA9PiAoe1xuICAgICdAX1NvdXJjZUlkJzogbC5mcm9tLnJlcGxhY2UoL154ZWYtKHN0ZXB8dHJhbnMpLS8sICcnKSxcbiAgICAnQF9UYXJnZXRJZCc6IGwudG8ucmVwbGFjZSgvXnhlZi0oc3RlcHx0cmFucyktLywgJycpLFxuICB9KSk7XG5cbiAgcmV0dXJuIHtcbiAgICBTdGVwOiBzdGVwcy5sZW5ndGggPyBzdGVwcyA6IHVuZGVmaW5lZCxcbiAgICBUcmFuc2l0aW9uOiB0cmFuc2l0aW9ucy5sZW5ndGggPyB0cmFuc2l0aW9ucyA6IHVuZGVmaW5lZCxcbiAgICBUcmFuc2l0aW9uTGluazogbGlua3MubGVuZ3RoID8gbGlua3MgOiB1bmRlZmluZWQsXG4gIH07XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFhQSxTQUFTLFVBQVUsVUFBVSxNQUFNLE1BQU0sT0FBTyxrQkFBa0I7QUFDbEUsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxlQUFlLDRCQUE0QjtBQUNwRCxTQUFTLGdCQUFnQixnQkFBZ0IsNEJBQTRCO0FBWXJFLElBQUksT0FBTztBQUNYLFNBQVMsSUFBSSxRQUF3QjtBQUFFLFNBQU8sR0FBRyxNQUFNLElBQUksRUFBRSxJQUFJLElB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
