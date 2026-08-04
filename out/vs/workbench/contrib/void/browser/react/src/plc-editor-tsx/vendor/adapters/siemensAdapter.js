import { parseXML, buildXML, attr, text, child, childArray } from "../xmlUtils.js";
import { siemensTypeToIEC, iecTypeToSimatic } from "../dataTypeMap.js";
import { buildResolver, VariableTypeResolver } from "../variableTypeResolver.js";
import { getPinDataType, buildTypedPins } from "../pinSignatures.js";
let _uid = 0;
function genId(prefix) {
  return `${prefix}-${++_uid}-${Math.random().toString(36).slice(2, 8)}`;
}
function unescapeXML(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
function extractMultilingualText(el) {
  if (!el) return "";
  const plain = text(el);
  if (plain && plain.trim()) return plain.trim();
  for (const mlEl of childArray(el, "MultilingualText")) {
    for (const itemEl of childArray(child(mlEl, "ObjectList"), "MultilingualTextItem")) {
      const culture = text(child(child(itemEl, "AttributeList"), "Culture")) || "";
      const t = text(child(child(itemEl, "AttributeList"), "Text")) || "";
      if (t && (culture.startsWith("en") || !culture)) return t;
    }
    for (const itemEl of childArray(child(mlEl, "ObjectList"), "MultilingualTextItem")) {
      const t = text(child(child(itemEl, "AttributeList"), "Text")) || "";
      if (t) return t;
    }
  }
  return "";
}
function importSiemens(xmlContent, filePath) {
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
  const document = child(root, "Document");
  if (!document) {
    return { ok: false, errors: ["No <Document> root found in SimaticML file"], warnings: [] };
  }
  const docInfo = child(document, "DocumentInfo");
  const projectName = text(child(docInfo, "ProjectName")) || "Siemens Import";
  const version = text(child(docInfo, "TiaVersion")) || attr(child(document, "Engineering"), "version") || "1.0";
  const pous = [];
  const globalTags = [];
  const swBlocks = child(document, "SW.Blocks") ?? document;
  for (const blockEl of childArray(swBlocks, "SW.Blocks.CompileUnit").concat(childArray(swBlocks, "SW.CodeBlock"))) {
    const pou = parseCompileUnit(blockEl, unmapped, warnings);
    if (pou) pous.push(pou);
  }
  for (const key of ["SW.Blocks.OB", "SW.Blocks.FB", "SW.Blocks.FC"]) {
    for (const blockEl of childArray(swBlocks, key)) {
      const pou = parseTopLevelBlock(blockEl, key, unmapped, warnings);
      if (pou) pous.push(pou);
    }
  }
  for (const dbEl of childArray(swBlocks, "SW.Blocks.GlobalDB")) {
    const dbName = text(child(child(dbEl, "AttributeList"), "Name")) || "GlobalDB";
    const interfaceEl = child(child(dbEl, "AttributeList"), "Interface");
    if (interfaceEl) {
      const sectionTags = parseSiemensInterface(interfaceEl, unmapped);
      globalTags.push(...sectionTags.map((t) => ({ ...t, address: `${dbName}.${t.name}` })));
    }
  }
  for (const dbEl of childArray(swBlocks, "SW.Blocks.DB").concat(childArray(swBlocks, "SW.Blocks.InstanceDB"))) {
    const dbName = text(child(child(dbEl, "AttributeList"), "Name")) || "DB";
    const interfaceEl = child(child(dbEl, "AttributeList"), "Interface");
    if (interfaceEl) {
      const sectionTags = parseSiemensInterface(interfaceEl, unmapped);
      globalTags.push(...sectionTags.map((t) => ({ ...t, address: `${dbName}.${t.name}` })));
    }
  }
  if (pous.length === 0) {
    errors.push("No program blocks (OB/FB/FC) found");
    return { ok: false, errors, warnings };
  }
  const sidecar = {
    sourceVendor: "siemens_simatic_ml",
    sourceFileVersion: version,
    originalFilePath: filePath,
    unmappedElements: unmapped,
    organizerTreeLayout: document,
    vendorSpecificGlobals: { tiaVersion: version, projectName }
  };
  return { ok: true, project: { projectName, pous, globalTags, sidecar }, errors, warnings };
}
function parseTopLevelBlock(blockEl, blockType, unmapped, warnings) {
  if (!blockEl || typeof blockEl !== "object") return null;
  const attrList = child(blockEl, "AttributeList");
  const blockName = text(child(attrList, "Name")) || "Block";
  const language = (text(child(attrList, "ProgrammingLanguage")) || "LAD").toUpperCase();
  const localTags = [];
  const interfaceEl = child(attrList, "Interface");
  if (interfaceEl) {
    localTags.push(...parseSiemensInterface(interfaceEl, unmapped));
  }
  const networks = [];
  for (const netEl of childArray(child(blockEl, "ObjectList"), "SW.Blocks.CompileUnit")) {
    networks.push(netEl);
  }
  const pouType = blockType.includes("FB") ? "functionBlock" : blockType.includes("FC") ? "function" : "program";
  const resolver = buildResolver(localTags, []);
  if (language === "LAD" || language === "LD") {
    const ladder = parseNetworksToLD(networks, blockName, unmapped, warnings, resolver);
    return { id: `pou-${blockName}`, name: blockName, language: "LD", ladderProgram: ladder, localTags, pouType };
  }
  if (language === "FBD") {
    const fbd = parseNetworksToFBD(networks, blockName, unmapped, warnings, resolver);
    return { id: `pou-${blockName}`, name: blockName, language: "FBD", fbdProgram: fbd, localTags, pouType };
  }
  if (language === "SCL" || language === "STL") {
    const scl = extractSCLSource(blockEl, attrList);
    return { id: `pou-${blockName}`, name: blockName, language: "ST", stSource: scl, localTags, pouType };
  }
  if (language === "GRAPH") {
    const sfc = parseNetworksToSFC(networks, blockName, unmapped, warnings);
    return { id: `pou-${blockName}`, name: blockName, language: "SFC", sfcProgram: sfc, localTags, pouType };
  }
  unmapped.push({ clmNodeId: null, vendorSpecificData: blockEl, reason: `Block "${blockName}": unsupported language ${language}` });
  return null;
}
function extractSCLSource(blockEl, attrList) {
  const sclSource = text(child(attrList, "SCLSourceInformation"));
  if (sclSource && sclSource.trim() !== "(* SCL *)") return unescapeXML(sclSource);
  const objectList = child(blockEl, "ObjectList");
  for (const cu of childArray(objectList, "SW.Blocks.CompileUnit")) {
    const cuAttr = child(cu, "AttributeList");
    const src = text(child(cuAttr, "NetworkSource"));
    if (src && src.trim()) return unescapeXML(src);
    const stEl = child(cuAttr, "StructuredText");
    if (stEl) {
      const stText = text(stEl);
      if (stText && stText.trim()) return unescapeXML(stText);
      const tokens = childArray(stEl, "Token").concat(childArray(stEl, "Blank"));
      if (tokens.length > 0) {
        const reconstructed = tokens.map((t) => attr(t, "Text") ?? " ").join("");
        if (reconstructed.trim()) return unescapeXML(reconstructed);
      }
    }
  }
  for (const ext of childArray(objectList, "SW.ExternalSource")) {
    const src = text(ext);
    if (src && src.trim()) return unescapeXML(src);
  }
  return "(* SCL source not found in export *)";
}
function parseCompileUnit(cuEl, unmapped, warnings) {
  if (!cuEl || typeof cuEl !== "object") return null;
  const attrList = child(cuEl, "AttributeList");
  const id = attr(cuEl, "ID") || attr(attrList, "ID") || "cu";
  const language = (text(child(attrList, "ProgrammingLanguage")) || "LAD").toUpperCase();
  const title = text(child(child(cuEl, "ObjectList"), "MultilingualText")) || `Network_${id}`;
  const networks = [cuEl];
  if (language === "LAD" || language === "LD") {
    const ladder = parseNetworksToLD(networks, id, unmapped, warnings);
    return { id: `pou-${id}`, name: title, language: "LD", ladderProgram: ladder, localTags: [] };
  }
  if (language === "FBD") {
    const fbd = parseNetworksToFBD(networks, id, unmapped, warnings);
    return { id: `pou-${id}`, name: title, language: "FBD", fbdProgram: fbd, localTags: [] };
  }
  if (language === "GRAPH") {
    const sfc = parseNetworksToSFC(networks, id, unmapped, warnings);
    return { id: `pou-${id}`, name: title, language: "SFC", sfcProgram: sfc, localTags: [] };
  }
  unmapped.push({ clmNodeId: null, vendorSpecificData: cuEl, reason: `CompileUnit "${title}": unsupported language ${language}` });
  return null;
}
function parseSiemensInterface(interfaceEl, unmapped) {
  const tags = [];
  const sections = child(interfaceEl, "Sections") ?? interfaceEl;
  function parseSectionsRecursive(sectionsEl) {
    for (const section of childArray(sectionsEl, "Section")) {
      const rawSectionName = attr(section, "Name");
      const sectionName = rawSectionName || "Static";
      if (rawSectionName === "Base" || rawSectionName === "None") {
        const nestedSections = child(section, "Sections");
        if (nestedSections) {
          parseSectionsRecursive(nestedSections);
          continue;
        }
      }
      for (const memberEl of childArray(section, "Member")) {
        const name = attr(memberEl, "Name");
        const typeStr = attr(memberEl, "Datatype");
        if (!name) continue;
        const dataType = siemensTypeToIEC(typeStr);
        const startValue = text(child(memberEl, "StartValue"));
        const commentEl = child(memberEl, "Comment");
        const comment = text(child(commentEl, "MultiLanguageText")) || text(commentEl) || "";
        tags.push({
          name,
          dataType,
          initialValue: startValue || void 0,
          description: comment || void 0,
          section: sectionName
        });
      }
    }
  }
  parseSectionsRecursive(sections);
  return tags;
}
function parseNetworksToLD(networks, pouId, unmapped, warnings, resolver = new VariableTypeResolver()) {
  const rungs = [];
  let rungIdx = 0;
  for (const netEl of networks) {
    let resolvePartTag2 = function(partUId) {
      const directAccess = childArray(partsNode, "Access").find((a) => {
        return false;
      });
      for (const wireEl of rawWires) {
        const nameCons = childArray(wireEl, "NameCon");
        const identCons = childArray(wireEl, "IdentCon");
        for (const nc of nameCons) {
          if (attr(nc, "UId") === partUId && attr(nc, "Name") === "operand") {
            for (const ic of identCons) {
              const accessUId = attr(ic, "UId");
              const accEl = uidToAccess.get(accessUId);
              if (accEl) return parseAccessTag(accEl);
            }
          }
        }
      }
      return "UNKNOWN_TAG";
    }, isPartNegated2 = function(partEl) {
      return childArray(partEl, "Negated").length > 0 || attr(partEl, "Negated") === "true" || childArray(partEl, "NegatedResult").length > 0;
    }, walkChain2 = function(startUId) {
      const chain = [];
      let current = startUId;
      while (current && !visited.has(current)) {
        visited.add(current);
        const el = uidToElement.get(current);
        if (el) chain.push(el);
        const nexts = outEdges.get(current) || [];
        if (nexts.length === 1) {
          current = nexts[0];
        } else if (nexts.length > 1) {
          for (const nextUId of nexts) {
            if (!visited.has(nextUId)) {
              const branchElements = walkChain2(nextUId);
              if (branchElements.length > 0) {
                branches.push({
                  id: genId(`branch-${pouId}-r${rungIdx}`),
                  startNodeId: current,
                  endNodeId: branchElements[branchElements.length - 1]?.id || current,
                  elements: branchElements
                });
              }
            }
          }
          break;
        } else {
          break;
        }
      }
      return chain;
    };
    var resolvePartTag = resolvePartTag2, isPartNegated = isPartNegated2, walkChain = walkChain2;
    rungIdx++;
    const attrList = child(netEl, "AttributeList");
    const objectListEl = child(netEl, "ObjectList");
    const commentMlt = childArray(objectListEl, "MultilingualText").find((m) => attr(m, "CompositionName") === "Comment");
    const titleMlt = childArray(objectListEl, "MultilingualText").find((m) => attr(m, "CompositionName") === "Title");
    const commentEl = child(attrList, "Comment") ?? child(attrList, "Title");
    const comment = extractMultilingualText(commentMlt) || extractMultilingualText(titleMlt) || extractMultilingualText(commentEl) || "";
    const partsEl = child(attrList, "NetworkSource");
    const flgNet = child(partsEl, "FlgNet") ?? partsEl;
    const partsNode = child(flgNet, "Parts") ?? flgNet;
    const wiresNode = child(flgNet, "Wires");
    const uidToElement = /* @__PURE__ */ new Map();
    let posX = 0;
    const uidToAccess = /* @__PURE__ */ new Map();
    const rawWires = wiresNode ? childArray(wiresNode, "Wire") : [];
    for (const wireEl of rawWires) {
      const identCons = childArray(wireEl, "IdentCon");
      for (const ic of identCons) {
        const uid = attr(ic, "UId");
        if (uid) {
          for (const accEl of childArray(partsNode, "Access")) {
            if (attr(accEl, "UId") === uid) {
              uidToAccess.set(uid, accEl);
              break;
            }
          }
        }
      }
    }
    const powerrailUIds = /* @__PURE__ */ new Set();
    const allPartEls = [
      ...childArray(partsNode, "Contact"),
      ...childArray(partsNode, "Coil"),
      ...childArray(partsNode, "SetCoil"),
      ...childArray(partsNode, "ResetCoil"),
      ...childArray(partsNode, "Part"),
      // TIA V16+ uses Part Name="Contact" etc.
      ...childArray(partsNode, "Call"),
      ...childArray(partsNode, "Powerrail"),
      ...childArray(partsNode, "OpenCon")
    ];
    for (const partEl of allPartEls) {
      const partUId = attr(partEl, "UId");
      if (!partUId) continue;
      const elemTagName = partEl["#name"] || "";
      const partName = attr(partEl, "Name") || elemTagName;
      const upperName = partName.toUpperCase();
      if (upperName === "POWERRAIL" || elemTagName === "Powerrail") {
        powerrailUIds.add(partUId);
        continue;
      }
      if (upperName === "OPENCON" || elemTagName === "OpenCon") continue;
      if (upperName === "SCOIL") {
        const directAcc = childArray(partEl, "Access")[0];
        const tagName = directAcc ? parseAccessTag(directAcc) : resolvePartTag2(partUId);
        uidToElement.set(partUId, { kind: "coil", id: `siemens-${partUId}`, type: "set", tag: { name: tagName, dataType: resolver.resolve(tagName) }, position: { x: posX, y: 0 } });
        posX += 60;
        continue;
      }
      if (upperName === "RCOIL") {
        const directAcc = childArray(partEl, "Access")[0];
        const tagName = directAcc ? parseAccessTag(directAcc) : resolvePartTag2(partUId);
        uidToElement.set(partUId, { kind: "coil", id: `siemens-${partUId}`, type: "reset", tag: { name: tagName, dataType: resolver.resolve(tagName) }, position: { x: posX, y: 0 } });
        posX += 60;
        continue;
      }
      if (upperName === "CONTACT" || elemTagName === "Contact") {
        const negated = isPartNegated2(partEl);
        const directAcc = childArray(partEl, "Access")[0];
        const tagName = directAcc ? parseAccessTag(directAcc) : resolvePartTag2(partUId);
        const el = {
          kind: "contact",
          id: `siemens-${partUId}`,
          type: negated ? "NC" : "NO",
          tag: { name: tagName, dataType: resolver.resolve(tagName) },
          position: { x: posX, y: 0 }
        };
        uidToElement.set(partUId, el);
        posX += 60;
        continue;
      }
      if (upperName === "P_CONTACT" || upperName === "PCONTACT") {
        const tagName = resolvePartTag2(partUId);
        uidToElement.set(partUId, { kind: "contact", id: `siemens-${partUId}`, type: "P_CONTACT", tag: { name: tagName, dataType: resolver.resolve(tagName) }, position: { x: posX, y: 0 } });
        posX += 60;
        continue;
      }
      if (upperName === "N_CONTACT" || upperName === "NCONTACT") {
        const tagName = resolvePartTag2(partUId);
        uidToElement.set(partUId, { kind: "contact", id: `siemens-${partUId}`, type: "N_CONTACT", tag: { name: tagName, dataType: resolver.resolve(tagName) }, position: { x: posX, y: 0 } });
        posX += 60;
        continue;
      }
      if (upperName === "COIL" || elemTagName === "Coil") {
        const negated = isPartNegated2(partEl);
        const directAcc = childArray(partEl, "Access")[0];
        const tagName = directAcc ? parseAccessTag(directAcc) : resolvePartTag2(partUId);
        uidToElement.set(partUId, { kind: "coil", id: `siemens-${partUId}`, type: negated ? "negated" : "normal", tag: { name: tagName, dataType: resolver.resolve(tagName) }, position: { x: posX, y: 0 } });
        posX += 60;
        continue;
      }
      if (upperName === "SETCOIL" || elemTagName === "SetCoil") {
        const directAcc = childArray(partEl, "Access")[0];
        const tagName = directAcc ? parseAccessTag(directAcc) : resolvePartTag2(partUId);
        uidToElement.set(partUId, { kind: "coil", id: `siemens-${partUId}`, type: "set", tag: { name: tagName, dataType: resolver.resolve(tagName) }, position: { x: posX, y: 0 } });
        posX += 60;
        continue;
      }
      if (upperName === "RESETCOIL" || elemTagName === "ResetCoil") {
        const directAcc = childArray(partEl, "Access")[0];
        const tagName = directAcc ? parseAccessTag(directAcc) : resolvePartTag2(partUId);
        uidToElement.set(partUId, { kind: "coil", id: `siemens-${partUId}`, type: "reset", tag: { name: tagName, dataType: resolver.resolve(tagName) }, position: { x: posX, y: 0 } });
        posX += 60;
        continue;
      }
      if (elemTagName === "Call" || upperName === "CALL") {
        const callInfo = child(partEl, "CallInfo");
        const blockName = attr(callInfo, "Name") || "";
        const blockType = attr(callInfo, "BlockType") || "";
        const meta = mapSiemensFBTypeWithMeta(blockName);
        const fbType = meta ? meta.fbType : "MOVE";
        const storeOriginal = meta ? meta.storeOriginal : true;
        const instanceEl = child(callInfo, "Instance");
        const instanceComponent = child(instanceEl, "Component");
        const instanceName = attr(instanceComponent, "Name") || attr(instanceEl, "Name") || blockName;
        const blk = { kind: "block", id: `siemens-${partUId}`, fbType, instanceName, pins: {}, position: { x: posX, y: 0 } };
        if (storeOriginal) blk.vendorOriginalName = blockName;
        blk.vendorBlockType = blockType;
        const params = childArray(callInfo, "Parameter");
        for (const param of params) {
          const pName = attr(param, "Name") || "";
          const pSection = attr(param, "Section") || "";
          const pType = attr(param, "Type") || "Bool";
          if (pName) {
            blk.pins[pName] = { name: pName, dataType: siemensTypeToIEC(pType) };
          }
        }
        uidToElement.set(partUId, blk);
        posX += 60;
        continue;
      }
      if (elemTagName === "Part") {
        const meta = mapSiemensFBTypeWithMeta(partName);
        if (meta) {
          const instanceName = resolvePartTag2(partUId) || partName;
          const blk = { kind: "block", id: `siemens-${partUId}`, fbType: meta.fbType, instanceName, pins: {}, position: { x: posX, y: 0 } };
          if (meta.storeOriginal) blk.vendorOriginalName = partName;
          uidToElement.set(partUId, blk);
          posX += 60;
          continue;
        }
      }
    }
    const wireConns = [];
    if (wiresNode) {
      for (const wireEl of rawWires) {
        const nameCons = childArray(wireEl, "NameCon");
        const identCons = childArray(wireEl, "IdentCon");
        const hasPowerrail = childArray(wireEl, "Powerrail").length > 0;
        const allCons = [...nameCons, ...identCons];
        if (hasPowerrail && allCons.length >= 1) {
          wireConns.push({ fromUId: "powerrail", fromPin: "out", toUId: attr(allCons[0], "UId") || "", toPin: attr(allCons[0], "Name") || "in" });
          for (let wi = 1; wi < allCons.length; wi++) {
            wireConns.push({ fromUId: "powerrail", fromPin: "out", toUId: attr(allCons[wi], "UId") || "", toPin: "in" });
          }
          continue;
        }
        if (allCons.length >= 2) {
          const fromEl = allCons[0];
          const toEl = allCons[1];
          wireConns.push({
            fromUId: attr(fromEl, "UId") || "",
            fromPin: attr(fromEl, "Name") || "out",
            toUId: attr(toEl, "UId") || "",
            toPin: attr(toEl, "Name") || "in"
          });
          for (let wi = 2; wi < allCons.length; wi++) {
            wireConns.push({
              fromUId: attr(fromEl, "UId") || "",
              fromPin: attr(fromEl, "Name") || "out",
              toUId: attr(allCons[wi], "UId") || "",
              toPin: attr(allCons[wi], "Name") || "in"
            });
          }
        }
      }
    }
    const powerrailTargets = new Set(wireConns.filter((w) => w.fromUId === "powerrail").map((w) => w.toUId));
    const hasIncoming = new Set(wireConns.filter((w) => w.fromUId !== "powerrail").map((w) => w.toUId));
    const roots = [...uidToElement.keys()].filter((uid) => !hasIncoming.has(uid) || powerrailTargets.has(uid));
    const outEdges = /* @__PURE__ */ new Map();
    for (const w of wireConns) {
      if (!outEdges.has(w.fromUId)) outEdges.set(w.fromUId, []);
      outEdges.get(w.fromUId).push(w.toUId);
    }
    const branches = [];
    const mainElements = [];
    const visited = /* @__PURE__ */ new Set();
    if (roots.length > 0) {
      for (const rootUId of roots) {
        if (!visited.has(rootUId)) {
          mainElements.push(...walkChain2(rootUId));
        }
      }
    } else {
      mainElements.push(...uidToElement.values());
    }
    for (const [uid, el] of uidToElement) {
      if (!visited.has(uid)) mainElements.push(el);
    }
    rungs.push({
      id: `${pouId}-rung-${rungIdx}`,
      number: rungIdx,
      comment,
      elements: mainElements,
      branches
    });
  }
  return { rungs };
}
function parseAccessTag(accessEl) {
  if (!accessEl || typeof accessEl !== "object") return "UNKNOWN_TAG";
  const symbolEl = child(accessEl, "Symbol");
  if (symbolEl) {
    const components = childArray(symbolEl, "Component");
    if (components.length > 0) {
      return components.map((c) => attr(c, "Name")).filter(Boolean).join(".");
    }
    const name = attr(symbolEl, "Name");
    if (name) return name;
  }
  return attr(accessEl, "Name") || "TAG";
}
const SIEMENS_FB_MAP = {
  // ── Standard IEC timers ────────────────────────────────────────────────
  TON: "TON",
  TOF: "TOF",
  TP: "TP",
  // Retentive timer (Siemens extension, now first-class)
  TONR: "TONR",
  // Generic IEC timer instance names TIA Portal uses
  IEC_TIMER: "IEC_TIMER",
  IEC_LTIMER: "IEC_LTIMER",
  // TIA Portal V17+ name aliases
  "SFB3": "TON",
  "SFB4": "TOF",
  "SFB5": "TP",
  // ── Standard IEC counters ──────────────────────────────────────────────
  CTU: "CTU",
  CTD: "CTD",
  CTUD: "CTUD",
  IEC_COUNTER: "IEC_COUNTER",
  IEC_LCOUNTER: "IEC_LCOUNTER",
  // IEC timer contact (timer output contact used in TIA Portal GRAPH)
  IEC_TC: "IEC_TC",
  // ── Bistable latches / edge detection ─────────────────────────────────
  SR: "SR",
  RS: "RS",
  R_TRIG: "RTRIG",
  F_TRIG: "FTRIG",
  RTRIG: "RTRIG",
  FTRIG: "FTRIG",
  // ── Boolean gate FBs (used in FBD-style LAD on S7-300/400) ────────────
  AND: "AND",
  OR: "OR",
  NOT: "NOT",
  XOR: "XOR",
  // ── Arithmetic ─────────────────────────────────────────────────────────
  ADD: "ADD",
  SUB: "SUB",
  MUL: "MUL",
  DIV: "DIV",
  MOD: "MOD",
  ABS: "ABS",
  SQRT: "SQRT",
  NEG: "NEG",
  LN: "LN",
  LOG: "LOG",
  EXP: "EXP",
  SIN: "SIN",
  COS: "COS",
  TAN: "TAN",
  ASIN: "ASIN",
  ACOS: "ACOS",
  ATAN: "ATAN",
  ATN: "ATAN",
  ASN: "ASIN",
  ACS: "ACOS",
  // alternate spellings
  // ── Comparison ─────────────────────────────────────────────────────────
  GT: "GT",
  GE: "GE",
  LT: "LT",
  LE: "LE",
  EQ: "EQ",
  NE: "NE",
  CMP: "EQ",
  // generic compare → EQ
  // ── Data / selection ───────────────────────────────────────────────────
  MOVE: "MOVE",
  SEL: "SEL",
  MUX: "SEL",
  LIMIT: "LIMIT",
  MIN: "MIN",
  MAX: "MAX",
  // ── Blink / oscillator ─────────────────────────────────────────────────
  BLINK: "BLINK",
  // ── Analog scaling / normalisation (Siemens-specific, now first-class) ─
  SCALE: "SCALE",
  UNSCALE: "UNSCALE",
  NORM_X: "NORM_X",
  SCALE_X: "SCALE_X",
  // Older S7 SFB names
  FC105: "SCALE",
  FC106: "UNSCALE",
  // ── String functions ───────────────────────────────────────────────────
  LEN: "LEN",
  LEFT: "LEFT",
  RIGHT: "RIGHT",
  MID: "MID",
  CONCAT: "CONCAT",
  FIND: "FIND",
  INSERT: "INSERT",
  DELETE: "DELETE",
  REPLACE: "REPLACE",
  UPPER_CASE: "UPPER_CASE",
  LOWER_CASE: "LOWER_CASE",
  // Siemens S_xxx string FB names (S7 classic)
  S_LEN: "LEN",
  S_LEFT: "LEFT",
  S_RIGHT: "RIGHT",
  S_MID: "MID",
  S_FIND: "FIND",
  S_CONV: "MOVE",
  S_CONCAT: "CONCAT",
  // ── Communication FBs ─────────────────────────────────────────────────
  // Map to the extended FBType members added above
  SEND: "SEND",
  RECV: "RECV",
  RDREC: "RDREC",
  WRREC: "WRREC",
  // Common Siemens Profinet / Industrial Ethernet FB names
  TSEND: "SEND",
  TRCV: "RECV",
  TCON: "SEND",
  TDISCON: "RECV",
  "TSEND_C": "SEND",
  "TRCV_C": "RECV",
  "DPRD_DAT": "RDREC",
  "DPWR_DAT": "WRREC",
  "FB65": "SEND",
  "FB66": "RECV",
  // ── Type conversion FBs ────────────────────────────────────────────────
  // Siemens uses CONVERT with template types; map generically
  CONVERT: "MOVE",
  ROUND: "MOVE",
  TRUNC: "MOVE",
  CEIL: "MOVE",
  FLOOR: "MOVE",
  // Explicit type conversions
  INT_TO_REAL: "MOVE",
  REAL_TO_INT: "MOVE",
  DINT_TO_REAL: "MOVE",
  REAL_TO_DINT: "MOVE",
  INT_TO_DINT: "MOVE",
  BOOL_TO_INT: "MOVE",
  INT_TO_BOOL: "MOVE",
  WORD_TO_INT: "MOVE",
  INT_TO_WORD: "MOVE",
  DWORD_TO_DINT: "MOVE",
  DINT_TO_DWORD: "MOVE",
  TIME_TO_DINT: "MOVE",
  DINT_TO_TIME: "MOVE",
  // ── Diagnostic / system FBs ────────────────────────────────────────────
  // Map to MOVE as a safe placeholder (preserves block shape, vendorOriginalName stored)
  ALARM: "MOVE",
  ALARM_8: "MOVE",
  ALARM_8P: "MOVE",
  NOTIFY: "MOVE",
  AR_SEND: "MOVE",
  BLKMOV: "MOVE",
  READ_DBL: "RDREC",
  WRIT_DBL: "WRREC"
};
function mapSiemensFBType(name) {
  const upper = name.toUpperCase();
  const mapped = SIEMENS_FB_MAP[upper];
  if (mapped) return mapped;
  return null;
}
const CLM_TO_SIEMENS = {
  RTRIG: "R_TRIG",
  FTRIG: "F_TRIG",
  TONR: "TONR",
  IEC_TIMER: "IEC_TIMER",
  IEC_LTIMER: "IEC_LTIMER",
  IEC_COUNTER: "IEC_COUNTER",
  IEC_LCOUNTER: "IEC_LCOUNTER",
  IEC_TC: "IEC_TC",
  NORM_X: "NORM_X",
  SCALE_X: "SCALE_X",
  UPPER_CASE: "UPPER_CASE",
  LOWER_CASE: "LOWER_CASE"
};
function clmFBTypeToSiemens(fbType) {
  return CLM_TO_SIEMENS[fbType] || fbType;
}
function mapSiemensFBTypeWithMeta(name) {
  const fbType = mapSiemensFBType(name);
  if (!fbType) return null;
  const storeOriginal = fbType !== name.toUpperCase() && fbType !== name;
  return { fbType, storeOriginal };
}
function parseNetworksToFBD(networks, pouId, unmapped, warnings, resolver = new VariableTypeResolver()) {
  const nodes = [];
  const wires = [];
  let nodeIdx = 0;
  for (const netEl of networks) {
    const attrList = child(netEl, "AttributeList");
    const partsEl = child(attrList, "NetworkSource");
    const flgNet = child(partsEl, "FlgNet") ?? partsEl;
    const partsNode = child(flgNet, "Parts") ?? flgNet;
    const wiresNode = child(flgNet, "Wires");
    const wireTargetUIds = /* @__PURE__ */ new Set();
    if (wiresNode) {
      for (const wireEl of childArray(wiresNode, "Wire")) {
        const allCons = [...childArray(wireEl, "NameCon"), ...childArray(wireEl, "IdentCon")];
        for (let wi = 1; wi < allCons.length; wi++) {
          const tUId = attr(allCons[wi], "UId");
          const tPin = (attr(allCons[wi], "Name") || "").toLowerCase();
          if (tUId && (tPin === "in" || tPin === "" || tPin === "in1")) wireTargetUIds.add(tUId);
        }
      }
    }
    for (const blockEl of childArray(partsNode, "Call").concat(childArray(partsNode, "Part"))) {
      const uid = attr(blockEl, "UId");
      const name = attr(blockEl, "Name") || attr(child(blockEl, "CallInfo"), "Name") || "BLOCK";
      nodeIdx++;
      const syntheticX = nodeIdx % 5 * 140;
      const syntheticY = Math.floor(nodeIdx / 5) * 100;
      const x = Number(attr(blockEl, "X") || attr(blockEl, "x")) || syntheticX;
      const y = Number(attr(blockEl, "Y") || attr(blockEl, "y")) || syntheticY;
      const { inputs: sigInputs, outputs: sigOutputs } = buildTypedPins(name, [], `fbd-${uid}`);
      const inputs = [...sigInputs];
      const outputs = [...sigOutputs];
      for (const accEl of childArray(blockEl, "Access")) {
        const dir = attr(accEl, "Direction");
        const pinName = attr(accEl, "Name") || parseAccessTag(accEl);
        const canonicalType = getPinDataType(name, pinName, dir === "Out" || dir === "Output" ? "output" : "input");
        if (dir === "Out" || dir === "Output") {
          if (!outputs.find((p) => p.name === pinName)) {
            outputs.push({ id: genId("pin"), name: pinName, dataType: canonicalType });
          }
        } else {
          if (!inputs.find((p) => p.name === pinName)) {
            inputs.push({ id: genId("pin"), name: pinName, dataType: canonicalType });
          }
        }
      }
      if (inputs.length === 0) inputs.push({ id: genId("pin"), name: "EN", dataType: "BOOL" });
      if (outputs.length === 0) outputs.push({ id: genId("pin"), name: "OUT", dataType: "BOOL" });
      const mappedFBDType = mapSiemensFBDType(name);
      const fbdNode = {
        id: `fbd-${uid}`,
        type: mappedFBDType,
        instanceName: `${name}_${uid}`,
        position: { x, y },
        inputs,
        outputs
      };
      if (mappedFBDType !== name && mappedFBDType !== name.toUpperCase()) {
        fbdNode.vendorOriginalName = name;
      }
      nodes.push(fbdNode);
    }
    for (const accEl of childArray(partsNode, "Access")) {
      const uid = attr(accEl, "UId");
      if (!uid) continue;
      const tagName = parseAccessTag(accEl);
      nodeIdx++;
      const syntheticX = nodeIdx % 5 * 140;
      const syntheticY = Math.floor(nodeIdx / 5) * 100;
      const x = Number(attr(accEl, "X") || attr(accEl, "x")) || syntheticX;
      const y = Number(attr(accEl, "Y") || attr(accEl, "y")) || syntheticY;
      const isInput = wireTargetUIds.has(uid);
      const accessType = resolver.resolve(tagName);
      nodes.push({
        id: `fbd-${uid}`,
        type: isInput ? "IN_VARIABLE" : "OUT_VARIABLE",
        tag: { name: tagName, dataType: accessType },
        position: { x, y },
        inputs: isInput ? [] : [{ id: genId("pin"), name: "IN", dataType: accessType }],
        outputs: isInput ? [{ id: genId("pin"), name: "OUT", dataType: accessType }] : []
      });
    }
    if (wiresNode) {
      for (const wireEl of childArray(wiresNode, "Wire")) {
        const nameCons = childArray(wireEl, "NameCon");
        const identCons = childArray(wireEl, "IdentCon");
        const allCons = [...nameCons, ...identCons];
        if (allCons.length >= 2) {
          const fromEl = allCons[0];
          const toEl = allCons[1];
          const fromUId = attr(fromEl, "UId") || "";
          const toUId = attr(toEl, "UId") || "";
          const fromPin = attr(fromEl, "Name") || "OUT";
          const toPin = attr(toEl, "Name") || "IN";
          if (fromUId && toUId) {
            wires.push({
              id: genId("wire"),
              from: { nodeId: `fbd-${fromUId}`, pin: fromPin },
              to: { nodeId: `fbd-${toUId}`, pin: toPin }
            });
          }
          for (let wi = 2; wi < allCons.length; wi++) {
            const extraUId = attr(allCons[wi], "UId") || "";
            const extraPin = attr(allCons[wi], "Name") || "IN";
            if (fromUId && extraUId) {
              wires.push({
                id: genId("wire"),
                from: { nodeId: `fbd-${fromUId}`, pin: fromPin },
                to: { nodeId: `fbd-${extraUId}`, pin: extraPin }
              });
            }
          }
        }
      }
    }
  }
  return { nodes, wires };
}
function mapSiemensFBDType(name) {
  const upper = name.toUpperCase();
  const BOOL_GATES = {
    AND: "AND",
    OR: "OR",
    NOT: "NOT",
    XOR: "XOR",
    NAND: "NAND",
    NOR: "NOR"
  };
  if (BOOL_GATES[upper]) return BOOL_GATES[upper];
  const TIMERS = {
    TON: "TON",
    TOF: "TOF",
    TP: "TP",
    TONR: "TONR",
    IEC_TIMER: "IEC_TIMER",
    IEC_LTIMER: "IEC_LTIMER",
    SFB3: "TON",
    SFB4: "TOF",
    SFB5: "TP",
    IEC_TC: "IEC_TC"
  };
  if (TIMERS[upper]) return TIMERS[upper];
  const COUNTERS = {
    CTU: "CTU",
    CTD: "CTD",
    CTUD: "CTUD",
    IEC_COUNTER: "IEC_COUNTER",
    IEC_LCOUNTER: "IEC_LCOUNTER"
  };
  if (COUNTERS[upper]) return COUNTERS[upper];
  const BISTABLE = {
    SR: "SR",
    RS: "RS",
    R_TRIG: "RTRIG",
    F_TRIG: "FTRIG",
    RTRIG: "RTRIG",
    FTRIG: "FTRIG"
  };
  if (BISTABLE[upper]) return BISTABLE[upper];
  const ARITH = {
    ADD: "ADD",
    SUB: "SUB",
    MUL: "MUL",
    DIV: "DIV",
    MOD: "MOD",
    ABS: "ABS",
    SQRT: "SQRT",
    NEG: "NEG",
    LN: "LN",
    LOG: "LOG",
    EXP: "EXP",
    SIN: "SIN",
    COS: "COS",
    TAN: "TAN",
    ASIN: "ASIN",
    ACOS: "ACOS",
    ATAN: "ATAN",
    ATN: "ATAN",
    ASN: "ASIN",
    ACS: "ACOS"
  };
  if (ARITH[upper]) return ARITH[upper];
  const CMP = {
    GT: "GT",
    GE: "GE",
    LT: "LT",
    LE: "LE",
    EQ: "EQ",
    NE: "NE"
  };
  if (CMP[upper]) return CMP[upper];
  const DATA = {
    MOVE: "MOVE",
    SEL: "SEL",
    MUX: "MUX",
    LIMIT: "LIMIT",
    MIN: "MIN",
    MAX: "MAX",
    BLINK: "BLINK"
  };
  if (DATA[upper]) return DATA[upper];
  const SCALE = {
    SCALE: "SCALE",
    UNSCALE: "UNSCALE",
    NORM_X: "NORM_X",
    SCALE_X: "SCALE_X",
    FC105: "SCALE",
    FC106: "UNSCALE"
  };
  if (SCALE[upper]) return SCALE[upper];
  const STRFNS = {
    LEN: "LEN",
    LEFT: "LEFT",
    RIGHT: "RIGHT",
    MID: "MID",
    CONCAT: "CONCAT",
    FIND: "FIND",
    INSERT: "INSERT",
    DELETE: "DELETE",
    REPLACE: "REPLACE",
    UPPER_CASE: "UPPER_CASE",
    LOWER_CASE: "LOWER_CASE",
    S_LEN: "S_LEN",
    S_LEFT: "S_LEFT",
    S_RIGHT: "S_RIGHT",
    S_MID: "S_MID",
    S_FIND: "S_FIND",
    S_CONV: "S_CONV",
    S_CONCAT: "S_CONCAT"
  };
  if (STRFNS[upper]) return STRFNS[upper];
  const CONV = {
    CONVERT: "CONVERT",
    ROUND: "ROUND",
    TRUNC: "TRUNC",
    CEIL: "CEIL",
    FLOOR: "FLOOR",
    INT_TO_REAL: "INT_TO_REAL",
    REAL_TO_INT: "REAL_TO_INT",
    DINT_TO_REAL: "DINT_TO_REAL",
    REAL_TO_DINT: "REAL_TO_DINT",
    INT_TO_DINT: "INT_TO_DINT",
    BOOL_TO_INT: "BOOL_TO_INT",
    INT_TO_BOOL: "INT_TO_BOOL",
    WORD_TO_INT: "WORD_TO_INT",
    INT_TO_WORD: "INT_TO_WORD",
    DWORD_TO_DINT: "DWORD_TO_DINT",
    DINT_TO_DWORD: "DINT_TO_DWORD",
    TIME_TO_DINT: "TIME_TO_DINT",
    DINT_TO_TIME: "DINT_TO_TIME"
  };
  if (CONV[upper]) return CONV[upper];
  const COMMS = {
    SEND: "SEND",
    RECV: "RECV",
    RDREC: "RDREC",
    WRREC: "WRREC",
    TSEND: "SEND",
    TRCV: "RECV",
    TCON: "SEND",
    TDISCON: "RECV",
    TSEND_C: "SEND",
    TRCV_C: "RECV",
    DPRD_DAT: "RDREC",
    DPWR_DAT: "WRREC",
    FB65: "SEND",
    FB66: "RECV"
  };
  if (COMMS[upper]) return COMMS[upper];
  return "MOVE";
}
function parseNetworksToSFC(networks, pouId, unmapped, warnings) {
  const steps = [];
  const transitions = [];
  const links = [];
  const jumps = [];
  const stepNumSet = /* @__PURE__ */ new Set();
  const transNumSet = /* @__PURE__ */ new Set();
  const branchMap = /* @__PURE__ */ new Map();
  for (const netEl of networks) {
    const attrList = child(netEl, "AttributeList");
    const partsEl = child(attrList, "NetworkSource");
    const graphEl = child(partsEl, "Graph");
    const sequenceEl = graphEl ? child(graphEl, "Sequence") : null;
    const seqOrNet = sequenceEl ?? child(partsEl, "FlgNet") ?? partsEl;
    const stepsEl = child(seqOrNet, "Steps");
    const transitionsEl = child(seqOrNet, "Transitions");
    const branchesEl = child(seqOrNet, "Branches");
    const connectionsEl = child(seqOrNet, "Connections");
    const validQualifiers = ["N", "S", "R", "P", "P1", "P0", "L", "D", "SD", "DS", "SL"];
    for (const stepEl of childArray(stepsEl ?? seqOrNet, "Step")) {
      const num = attr(stepEl, "Number") || attr(stepEl, "UId") || "";
      const name = attr(stepEl, "Name") || `S${num}`;
      const isInitial = attr(stepEl, "Init") === "true" || attr(stepEl, "InitialStep") === "true";
      stepNumSet.add(num);
      const actions = [];
      const actionsContainer = child(stepEl, "Actions") ?? stepEl;
      const actionsTitleEl = child(actionsContainer, "Title");
      if (actionsTitleEl) {
        const mlTexts = childArray(actionsTitleEl, "MultiLanguageText");
        const titleText = mlTexts.length > 0 ? (attr(mlTexts[0], "Lang")?.startsWith("en") ? text(mlTexts[0]) : text(mlTexts[0])) || "" : text(actionsTitleEl) || "";
        if (titleText) {
          actions.push({
            id: genId(`action-${num}`),
            qualifier: "N",
            tag: { name: titleText, dataType: "BOOL" }
          });
        }
      }
      for (const actionEl of childArray(actionsContainer, "Action")) {
        const qualifier = (attr(actionEl, "Qualifier") || "N").toUpperCase();
        const actionName = attr(actionEl, "Name") || text(child(actionEl, "Name")) || "";
        const duration = attr(actionEl, "Duration") || void 0;
        if (actionName) {
          actions.push({
            id: genId(`action-${num}`),
            qualifier: validQualifiers.includes(qualifier) ? qualifier : "N",
            tag: { name: actionName, dataType: "BOOL" },
            duration
          });
        }
      }
      steps.push({
        id: `siemens-step-${num}`,
        name,
        isInitial,
        actions,
        position: { x: 0, y: 0 }
      });
    }
    for (const transEl of childArray(transitionsEl ?? seqOrNet, "Transition")) {
      const num = attr(transEl, "Number") || attr(transEl, "UId") || "";
      const name = attr(transEl, "Name") || `T${num}`;
      const progLang = attr(transEl, "ProgrammingLanguage") || "";
      transNumSet.add(num);
      const flgNetEl = child(transEl, "FlgNet");
      let condition = name;
      if (flgNetEl) {
        const flgParts = child(flgNetEl, "Parts");
        const accessEls = childArray(flgParts, "Access");
        if (accessEls.length > 0) {
          condition = accessEls.map((a) => parseAccessTag(a)).filter((t) => t !== "UNKNOWN_TAG").join(" AND ") || name;
        } else {
          condition = "TRUE";
        }
      } else {
        const conditionEl = child(transEl, "Condition");
        if (conditionEl) {
          condition = text(conditionEl) || "TRUE";
        }
      }
      transitions.push({
        id: `siemens-trans-${num}`,
        condition,
        position: { x: 0, y: 0 }
      });
    }
    for (const branchEl of childArray(branchesEl ?? seqOrNet, "Branch")) {
      const num = attr(branchEl, "Number") || "";
      const type = attr(branchEl, "Type") || "AltBegin";
      const cardinality = Number(attr(branchEl, "Cardinality") || "2");
      branchMap.set(num, { type, cardinality });
    }
    const resolveNode = (nodeEl) => {
      if (!nodeEl) return null;
      const stepRef = child(nodeEl, "StepRef");
      const transRef = child(nodeEl, "TransitionRef");
      const branchRef = child(nodeEl, "BranchRef");
      const endConn = child(nodeEl, "EndConnection");
      if (stepRef) return { id: `siemens-step-${attr(stepRef, "Number")}` };
      if (transRef) return { id: `siemens-trans-${attr(transRef, "Number")}` };
      if (branchRef) {
        const num = attr(branchRef, "Number") || "";
        const inPort = attr(branchRef, "In");
        const outPort = attr(branchRef, "Out");
        const port = inPort !== "" ? Number(inPort) : Number(outPort || "0");
        return { id: `siemens-branch-${num}`, branchNum: num, branchPort: port };
      }
      if (endConn !== void 0 && endConn !== null) return { id: "siemens-end", isEnd: true };
      return null;
    };
    for (const connEl of childArray(connectionsEl ?? seqOrNet, "Connection")) {
      const linkTypeAttr = text(child(connEl, "LinkType")) || "Direct";
      const fromNode = resolveNode(child(connEl, "NodeFrom"));
      const toNode = resolveNode(child(connEl, "NodeTo"));
      if (!fromNode || !toNode) continue;
      let fromId = fromNode.id;
      let toId = toNode.id;
      const isJumpLink = linkTypeAttr === "Jump";
      let sfcLinkType = "simple";
      if (fromNode.branchNum !== void 0) {
        const meta = branchMap.get(fromNode.branchNum);
        const isSimultaneous = meta?.type === "SimBegin" || meta?.type === "SimEnd";
        sfcLinkType = isSimultaneous ? "simultaneous-divergence" : "selection-divergence";
      } else if (toNode.branchNum !== void 0) {
        const meta = branchMap.get(toNode.branchNum);
        const isSimultaneous = meta?.type === "SimBegin" || meta?.type === "SimEnd";
        const isInPort = child(child(connEl, "NodeTo"), "BranchRef") !== void 0 && attr(child(child(connEl, "NodeTo"), "BranchRef"), "In") !== "";
        sfcLinkType = isInPort ? isSimultaneous ? "simultaneous-convergence" : "selection-convergence" : isSimultaneous ? "simultaneous-divergence" : "selection-divergence";
      }
      if (toNode.isEnd) {
        continue;
      }
      if (isJumpLink) {
        const targetStepId = toId;
        const targetStepNum = targetStepId.replace("siemens-step-", "");
        const targetStep = steps.find((s) => s.id === targetStepId);
        const jumpId = genId(`jump-${fromId}`);
        jumps.push({
          id: jumpId,
          targetStepName: targetStep?.name || `S${targetStepNum}`,
          position: { x: 0, y: 0 }
        });
        links.push({
          id: genId(`link-${fromId}-jump`),
          from: fromId,
          to: jumpId,
          type: "simple"
        });
        continue;
      }
      links.push({
        id: genId(`link-${fromId}-${toId}`),
        from: fromId,
        to: toId,
        type: sfcLinkType
      });
    }
  }
  const branches = [];
  const allBranchIds = new Set(links.flatMap((l) => [l.from, l.to]).filter((id) => id.startsWith("siemens-branch-")));
  for (const barId of allBranchIds) {
    const branchNum = barId.replace("siemens-branch-", "");
    const meta = branchMap.get(branchNum);
    if (!meta) continue;
    if (meta.type !== "AltBegin" && meta.type !== "SimBegin") continue;
    const isSimultaneous = meta.type === "SimBegin";
    const upstreamIds = links.filter((l) => l.to === barId).map((l) => l.from);
    const branchHeadIds = links.filter((l) => l.from === barId).map((l) => l.to);
    const convBarId = [...allBranchIds].find((bid) => {
      const bNum = bid.replace("siemens-branch-", "");
      const bMeta = branchMap.get(bNum);
      return bMeta && (isSimultaneous ? bMeta.type === "SimEnd" : bMeta.type === "AltEnd");
    }) ?? "";
    const downstreamIds = links.filter((l) => l.from === convBarId).map((l) => l.to);
    const branchStepArrays = branchHeadIds.map((headId) => {
      const chain = [];
      let cur = headId;
      for (let depth = 0; depth < 30; depth++) {
        if (cur.startsWith("siemens-step-")) chain.push(cur);
        const next = links.find((l) => l.from === cur && l.type === "simple" && !allBranchIds.has(l.to));
        if (!next || allBranchIds.has(next.to)) break;
        cur = next.to;
      }
      return chain;
    });
    if (!branches.find((b) => b.id === `branch-${barId}`)) {
      branches.push({
        id: `branch-${barId}`,
        type: isSimultaneous ? "AND" : "OR",
        divergingFromTransId: upstreamIds[0] || "",
        branchStepIds: branchStepArrays,
        convergingToTransId: downstreamIds[0] || ""
      });
    }
  }
  return { steps, transitions, links, branches, jumps };
}
function exportSiemens(project) {
  const errors = [];
  const warnings = [];
  const sidecar = project.sidecar;
  let uidCounter = 1;
  const nextUId = () => String(uidCounter++);
  const blocks = project.pous.map((pou) => buildSimaticBlock(pou, nextUId, warnings, sidecar));
  const documentObj = {
    DocumentInfo: {
      Created: (/* @__PURE__ */ new Date()).toISOString(),
      ExportSetting: "WithDefaults",
      InstalledProducts: {},
      ProjectName: project.projectName,
      TiaVersion: sidecar.vendorSpecificGlobals?.["tiaVersion"] ?? "17.0"
    },
    Engineering: { "@_version": "V14 SP1" }
  };
  const obs = [];
  const fbs = [];
  const fcs = [];
  project.pous.forEach((pou, i) => {
    const block = { ...blocks[i], "@_ID": "0" };
    if (pou.pouType === "functionBlock") fbs.push(block);
    else if (pou.pouType === "function") fcs.push(block);
    else obs.push(block);
  });
  if (obs.length > 0) documentObj["SW.Blocks.OB"] = obs;
  if (fbs.length > 0) documentObj["SW.Blocks.FB"] = fbs;
  if (fcs.length > 0) documentObj["SW.Blocks.FC"] = fcs;
  const obj = { Document: documentObj };
  return { ok: true, xmlContent: buildXML(obj), errors, warnings };
}
function buildSimaticBlock(pou, nextUId, warnings, sidecar) {
  const networks = buildSimaticNetworks(pou, nextUId, warnings);
  return {
    "@_ID": nextUId(),
    AttributeList: {
      AutoNumber: "true",
      HeaderAuthor: "Plaxio",
      HeaderFamily: "",
      HeaderName: pou.name,
      HeaderVersion: "1.0",
      Interface: buildSimaticInterface(pou.localTags),
      IsIECCheckEnabled: "false",
      MemoryLayout: "Optimized",
      Name: pou.name,
      Namespace: "",
      ProgrammingLanguage: pou.language === "FBD" ? "FBD" : pou.language === "SFC" ? "GRAPH" : pou.language === "ST" ? "SCL" : "LAD"
    },
    // Fix 7: ObjectList with MultilingualText Title alongside CompileUnits
    ObjectList: {
      "MultilingualText": {
        "@_ID": "1",
        "@_CompositionName": "Title",
        ObjectList: {
          MultilingualTextItem: {
            "@_ID": "2",
            "@_CompositionName": "Items",
            AttributeList: { Culture: "en-US", Text: pou.name }
          }
        }
      },
      // Fix 6: CompileUnit needs CompositionName attribute
      "SW.Blocks.CompileUnit": networks.map((n) => ({ "@_CompositionName": "CompileUnits", ...n }))
    }
  };
}
function buildSimaticInterface(tags) {
  const sections = {
    Input: [],
    Output: [],
    InOut: [],
    Static: [],
    Temp: [],
    Constant: [],
    Return: []
  };
  for (const tag of tags) {
    const sec = tag.section || "Static";
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(tag);
  }
  const sectionEntries = Object.entries(sections).filter(([_, tags2]) => tags2.length > 0).map(([name, tags2]) => ({
    "@_Name": name,
    Member: tags2.map((t) => tagToSimaticMember(t))
  }));
  if (sectionEntries.length === 0) {
    sectionEntries.push({ "@_Name": "Static", Member: [] });
  }
  return { Sections: { "@_xmlns": "http://www.siemens.com/automation/Openness/SW/Interface/v2", Section: sectionEntries } };
}
function tagToSimaticMember(tag) {
  return {
    "@_Name": tag.name,
    "@_Datatype": iecTypeToSimatic(tag.dataType),
    "@_Accessibility": "Public",
    StartValue: tag.initialValue || void 0,
    // Fix 4: Member Comment needs Lang attribute and Informative attribute
    Comment: tag.description ? {
      "@_Informative": "true",
      MultiLanguageText: { "@_Lang": "en-US", "#text": tag.description }
    } : void 0
  };
}
function buildSimaticNetworks(pou, nextUId, warnings) {
  if (pou.language === "LD" && pou.ladderProgram) {
    return pou.ladderProgram.rungs.map((rung) => buildSimaticLADNetwork(rung, nextUId));
  }
  if (pou.language === "FBD" && pou.fbdProgram) {
    return [buildSimaticFBDNetwork(pou.fbdProgram, nextUId)];
  }
  if (pou.language === "SFC" && pou.sfcProgram) {
    return buildSimaticGRAPHNetworks(pou.sfcProgram, nextUId);
  }
  if (pou.language === "ST" && pou.stSource) {
    return [{
      "@_ID": nextUId(),
      AttributeList: {
        ProgrammingLanguage: "SCL",
        NetworkSource: {
          StructuredText: pou.stSource || ""
        }
      }
    }];
  }
  warnings.push(`POU "${pou.name}": language ${pou.language} \u2014 export as empty network`);
  return [{ "@_ID": nextUId(), AttributeList: { ProgrammingLanguage: "LAD", NetworkSource: {} } }];
}
function buildSimaticLADNetwork(rung, nextUId) {
  const accesses = [];
  const parts = [];
  const calls = [];
  const wires = [];
  const allElements = [...rung.elements];
  for (const branch of rung.branches) {
    allElements.push(...branch.elements);
  }
  const elementPartInfos = [];
  let firstPartUId = "";
  for (const el of allElements) {
    if (el.kind === "contact") {
      const c = el;
      const partUId = nextUId();
      const accessUId = nextUId();
      if (!firstPartUId) firstPartUId = partUId;
      let partName = "Contact";
      if (c.type === "P_CONTACT") partName = "PContact";
      else if (c.type === "N_CONTACT") partName = "NContact";
      const tagParts = c.tag.name.split(".");
      const symbolComponent = tagParts.length === 1 ? { Component: { "@_Name": tagParts[0] } } : { Component: tagParts.map((p) => ({ "@_Name": p })) };
      accesses.push({ "@_Scope": "LocalVariable", "@_UId": accessUId, Symbol: symbolComponent });
      const partObj = { "@_Name": partName, "@_UId": partUId };
      if (c.type === "NC") partObj["@_Negated"] = "true";
      parts.push(partObj);
      elementPartInfos.push({ partUId, accessUId, partName });
    } else if (el.kind === "coil") {
      const c = el;
      const partUId = nextUId();
      const accessUId = nextUId();
      if (!firstPartUId) firstPartUId = partUId;
      let partName = "Coil";
      if (c.type === "set" || c.type === "latch") partName = "SCoil";
      else if (c.type === "reset" || c.type === "unlatch") partName = "RCoil";
      const tagParts = c.tag.name.split(".");
      const symbolComponent = tagParts.length === 1 ? { Component: { "@_Name": tagParts[0] } } : { Component: tagParts.map((p) => ({ "@_Name": p })) };
      accesses.push({ "@_Scope": "LocalVariable", "@_UId": accessUId, Symbol: symbolComponent });
      const partObj = { "@_Name": partName, "@_UId": partUId };
      if (c.type === "negated") partObj["@_Negated"] = "true";
      parts.push(partObj);
      elementPartInfos.push({ partUId, accessUId, partName });
    } else if (el.kind === "block") {
      const b = el;
      const callUId = nextUId();
      if (!firstPartUId) firstPartUId = callUId;
      const exportName = b.vendorOriginalName || clmFBTypeToSiemens(b.fbType);
      const instanceUId = nextUId();
      const tagParts = b.instanceName.split(".");
      const instanceComponent = tagParts.length === 1 ? { "@_Name": tagParts[0] } : tagParts.map((p) => ({ "@_Name": p }));
      const callObj = {
        "@_UId": callUId,
        CallInfo: {
          "@_Name": exportName,
          "@_BlockType": b.vendorBlockType || "FB",
          Instance: {
            "@_Scope": "LocalVariable",
            "@_UId": instanceUId,
            Component: instanceComponent
          }
        }
      };
      calls.push(callObj);
      elementPartInfos.push({ partUId: callUId, accessUId: "", partName: "Call" });
    }
  }
  let prevPartUId = "";
  let mainIdx = 0;
  for (let i = 0; i < rung.elements.length; i++) {
    const info = elementPartInfos[mainIdx];
    mainIdx++;
    const el = rung.elements[i];
    if (el.kind === "block") {
      if (prevPartUId === "") {
        wires.push({ "@_UId": nextUId(), Powerrail: {}, NameCon: { "@_UId": info.partUId, "@_Name": "en" } });
      } else {
        wires.push({ "@_UId": nextUId(), NameCon: [{ "@_UId": prevPartUId, "@_Name": "out" }, { "@_UId": info.partUId, "@_Name": "en" }] });
      }
      prevPartUId = info.partUId;
    } else {
      if (prevPartUId === "") {
        wires.push({ "@_UId": nextUId(), Powerrail: {}, NameCon: { "@_UId": info.partUId, "@_Name": "in" } });
      } else {
        wires.push({ "@_UId": nextUId(), NameCon: [{ "@_UId": prevPartUId, "@_Name": "out" }, { "@_UId": info.partUId, "@_Name": "in" }] });
      }
      if (info.accessUId) {
        wires.push({ "@_UId": nextUId(), IdentCon: { "@_UId": info.accessUId }, NameCon: { "@_UId": info.partUId, "@_Name": "operand" } });
      }
      prevPartUId = info.partUId;
    }
  }
  for (const branch of rung.branches) {
    let branchPrevPartUId = "";
    for (let i = 0; i < branch.elements.length; i++) {
      const info = elementPartInfos[mainIdx];
      mainIdx++;
      const el = branch.elements[i];
      if (el.kind === "block") {
        if (branchPrevPartUId === "") {
          wires.push({ "@_UId": nextUId(), Powerrail: {}, NameCon: { "@_UId": info.partUId, "@_Name": "en" } });
        } else {
          wires.push({ "@_UId": nextUId(), NameCon: [{ "@_UId": branchPrevPartUId, "@_Name": "out" }, { "@_UId": info.partUId, "@_Name": "en" }] });
        }
        branchPrevPartUId = info.partUId;
      } else {
        if (branchPrevPartUId === "") {
          wires.push({ "@_UId": nextUId(), Powerrail: {}, NameCon: { "@_UId": info.partUId, "@_Name": "in" } });
        } else {
          wires.push({ "@_UId": nextUId(), NameCon: [{ "@_UId": branchPrevPartUId, "@_Name": "out" }, { "@_UId": info.partUId, "@_Name": "in" }] });
        }
        if (info.accessUId) {
          wires.push({ "@_UId": nextUId(), IdentCon: { "@_UId": info.accessUId }, NameCon: { "@_UId": info.partUId, "@_Name": "operand" } });
        }
        branchPrevPartUId = info.partUId;
      }
    }
  }
  const partsObj = {};
  if (accesses.length) partsObj.Access = accesses;
  if (parts.length) partsObj.Part = parts;
  if (calls.length) partsObj.Call = calls;
  const objectListItems = {};
  if (rung.comment) {
    objectListItems["MultilingualText"] = [
      {
        "@_ID": nextUId(),
        "@_CompositionName": "Comment",
        ObjectList: {
          MultilingualTextItem: {
            "@_ID": nextUId(),
            "@_CompositionName": "Items",
            AttributeList: { Culture: "en-US", Text: rung.comment }
          }
        }
      },
      {
        "@_ID": nextUId(),
        "@_CompositionName": "Title",
        ObjectList: {
          MultilingualTextItem: {
            "@_ID": nextUId(),
            "@_CompositionName": "Items",
            AttributeList: { Culture: "en-US", Text: "" }
          }
        }
      }
    ];
  }
  return {
    "@_ID": nextUId(),
    "@_CompositionName": "CompileUnits",
    AttributeList: {
      NetworkSource: {
        FlgNet: {
          "@_xmlns": "http://www.siemens.com/automation/Openness/SW/NetworkSource/FlgNet/v4",
          Parts: partsObj,
          Wires: { Wire: wires }
        }
      },
      ProgrammingLanguage: "LAD"
    },
    ObjectList: Object.keys(objectListItems).length > 0 ? objectListItems : {
      MultilingualText: [
        {
          "@_ID": nextUId(),
          "@_CompositionName": "Comment",
          ObjectList: { MultilingualTextItem: { "@_ID": nextUId(), "@_CompositionName": "Items", AttributeList: { Culture: "en-US", Text: "" } } }
        },
        {
          "@_ID": nextUId(),
          "@_CompositionName": "Title",
          ObjectList: { MultilingualTextItem: { "@_ID": nextUId(), "@_CompositionName": "Items", AttributeList: { Culture: "en-US", Text: "" } } }
        }
      ]
    }
  };
}
function buildSimaticFBDNetwork(fbd, nextUId) {
  const parts = [];
  const accesses = [];
  const wires = [];
  for (const node of fbd.nodes) {
    const uid = node.id.replace("fbd-", "") || nextUId();
    if (node.type === "IN_VARIABLE" || node.type === "OUT_VARIABLE") {
      const tagParts = (node.tag?.name || "").split(".");
      const symbolComponent = tagParts.length === 1 ? { Component: { "@_Name": tagParts[0] } } : { Component: tagParts.map((p) => ({ "@_Name": p })) };
      accesses.push({
        "@_UId": uid,
        "@_Scope": "GlobalVariable",
        Symbol: symbolComponent
      });
    } else {
      const templateValues = [];
      for (const pin of node.inputs || []) {
        if (pin.dataType && pin.dataType !== "BOOL" && pin.dataType !== "ANY") {
          const simaticType = iecTypeToSimatic(pin.dataType) || pin.dataType;
          templateValues.push({ "@_Name": "Card", "@_Type": simaticType });
          break;
        }
      }
      const fbdExportName = node.vendorOriginalName || clmFBTypeToSiemens(node.type);
      parts.push({
        "@_Name": fbdExportName,
        "@_UId": uid,
        ...templateValues.length > 0 ? { TemplateValue: templateValues } : {}
      });
    }
  }
  for (const wire of fbd.wires) {
    wires.push({
      "@_UId": nextUId(),
      NameCon: [
        { "@_UId": wire.from.nodeId.replace("fbd-", ""), "@_Name": wire.from.pin },
        { "@_UId": wire.to.nodeId.replace("fbd-", ""), "@_Name": wire.to.pin }
      ]
    });
  }
  const partsObj = {};
  if (parts.length) partsObj.Part = parts;
  if (accesses.length) partsObj.Access = accesses;
  return {
    "@_ID": nextUId(),
    AttributeList: {
      ProgrammingLanguage: "FBD",
      NetworkSource: {
        FlgNet: {
          "@_xmlns": "http://www.siemens.com/automation/Openness/SW/NetworkSource/FlgNet/v4",
          Parts: partsObj,
          Wires: { Wire: wires.length ? wires : [] }
        }
      }
    }
  };
}
function buildSimaticGRAPHNetworks(sfc, nextUId) {
  let counter = 1;
  const allocNum = (id, prefix) => {
    const m = id.match(new RegExp(`^${prefix}(\\d+)$`));
    return m ? m[1] : String(counter++);
  };
  const stepNumMap = /* @__PURE__ */ new Map();
  for (const step of sfc.steps) {
    stepNumMap.set(step.id, allocNum(step.id, "siemens-step-"));
  }
  const transNumMap = /* @__PURE__ */ new Map();
  for (const trans of sfc.transitions) {
    transNumMap.set(trans.id, allocNum(trans.id, "siemens-trans-"));
  }
  const exportedSteps = sfc.steps.map((step) => {
    const num = stepNumMap.get(step.id) || String(counter++);
    const actionTitle = step.actions.length > 0 ? step.actions[0].tag.name : step.name;
    const svFlgNet = { Parts: { Part: { "@_Name": "SvCoil", "@_UId": "21" } }, Wires: { Wire: { "@_UId": "22", Powerrail: {}, NameCon: { "@_UId": "21", "@_Name": "in" } } } };
    const ilFlgNet = { Parts: { Part: { "@_Name": "IlCoil", "@_UId": "21" } }, Wires: { Wire: { "@_UId": "22", Powerrail: {}, NameCon: { "@_UId": "21", "@_Name": "in" } } } };
    return {
      "@_Number": num,
      "@_Init": String(step.isInitial),
      "@_Name": step.name,
      "@_MaximumStepTime": "T#10S",
      "@_WarningTime": "T#7S",
      Actions: { Title: { MultiLanguageText: { "@_Lang": "en-US", "#text": actionTitle } } },
      Supervisions: { Supervision: { "@_ProgrammingLanguage": "LAD", FlgNet: svFlgNet } },
      Interlocks: { Interlock: { "@_ProgrammingLanguage": "LAD", FlgNet: ilFlgNet } }
    };
  });
  const exportedTransitions = sfc.transitions.map((trans) => {
    const num = transNumMap.get(trans.id) || String(counter++);
    const flgNet = {
      Parts: { Part: { "@_Name": "TrCoil", "@_UId": "21" } },
      Wires: { Wire: { "@_UId": "22", Powerrail: {}, NameCon: { "@_UId": "21", "@_Name": "in" } } }
    };
    return {
      "@_IsMissing": "false",
      "@_Name": trans.condition,
      "@_Number": num,
      "@_ProgrammingLanguage": "LAD",
      FlgNet: flgNet
    };
  });
  const exportedBranches = [];
  const branchBarIds = new Set(sfc.links.flatMap((l) => [l.from, l.to]).filter((id) => id.startsWith("siemens-branch-")));
  const emittedBranchNums = /* @__PURE__ */ new Set();
  let branchCounter = 1;
  const branchBarNumMap = /* @__PURE__ */ new Map();
  for (const barId of branchBarIds) {
    const existingNum = barId.replace("siemens-branch-", "");
    if (!branchBarNumMap.has(barId)) {
      branchBarNumMap.set(barId, /^\d+$/.test(existingNum) ? existingNum : String(branchCounter++));
    }
  }
  const emittedBranchDecls = /* @__PURE__ */ new Set();
  for (const branch of sfc.branches ?? []) {
    const isSimultaneous = branch.type === "AND";
    const beginType = isSimultaneous ? "SimBegin" : "AltBegin";
    const endType = isSimultaneous ? "SimEnd" : "AltEnd";
    const cardinality = branch.branchStepIds.length;
    const beginNum = String(branchCounter++);
    const endNum = String(branchCounter++);
    if (!emittedBranchDecls.has(branch.id)) {
      emittedBranchDecls.add(branch.id);
      exportedBranches.push({ "@_Number": beginNum, "@_Type": beginType, "@_Cardinality": String(cardinality) });
      exportedBranches.push({ "@_Number": endNum, "@_Type": endType, "@_Cardinality": String(cardinality) });
    }
  }
  const exportedConnections = [];
  const makeNodeFrom = (id) => {
    if (id.startsWith("siemens-step-")) return { StepRef: { "@_Number": stepNumMap.get(id) || id.replace("siemens-step-", "") } };
    if (id.startsWith("siemens-trans-")) return { TransitionRef: { "@_Number": transNumMap.get(id) || id.replace("siemens-trans-", "") } };
    if (id.startsWith("siemens-branch-")) return { BranchRef: { "@_Number": branchBarNumMap.get(id) || id.replace("siemens-branch-", ""), "@_Out": "0" } };
    return { StepRef: { "@_Number": id } };
  };
  const makeNodeTo = (id) => {
    if (id.startsWith("siemens-step-")) return { StepRef: { "@_Number": stepNumMap.get(id) || id.replace("siemens-step-", "") } };
    if (id.startsWith("siemens-trans-")) return { TransitionRef: { "@_Number": transNumMap.get(id) || id.replace("siemens-trans-", "") } };
    if (id.startsWith("siemens-branch-")) return { BranchRef: { "@_Number": branchBarNumMap.get(id) || id.replace("siemens-branch-", ""), "@_In": "0" } };
    if (id.startsWith("siemens-jump-")) {
      const jump = sfc.jumps?.find((j) => j.id === id);
      const targetNum = stepNumMap.get(`siemens-step-${jump?.targetStepName}`) || "1";
      return { StepRef: { "@_Number": targetNum } };
    }
    return { StepRef: { "@_Number": id } };
  };
  for (const link of sfc.links) {
    const isJumpLink = link.to.startsWith("siemens-jump-");
    exportedConnections.push({
      NodeFrom: makeNodeFrom(link.from),
      NodeTo: makeNodeTo(link.to),
      LinkType: isJumpLink ? "Jump" : "Direct"
    });
  }
  const sequence = {};
  if (exportedSteps.length) sequence.Steps = { Step: exportedSteps };
  if (exportedTransitions.length) sequence.Transitions = { Transition: exportedTransitions };
  if (exportedBranches.length) sequence.Branches = { Branch: exportedBranches };
  if (exportedConnections.length) sequence.Connections = { Connection: exportedConnections };
  const graph = {
    "@_xmlns": "http://www.siemens.com/automation/Openness/SW/NetworkSource/Graph/v1",
    PreOperations: { PermanentOperation: { "@_ProgrammingLanguage": "FBD" } },
    Sequence: sequence,
    PostOperations: { PermanentOperation: { "@_ProgrammingLanguage": "FBD" } }
  };
  return [{
    "@_ID": nextUId(),
    AttributeList: {
      ProgrammingLanguage: "GRAPH",
      NetworkSource: { Graph: graph }
    }
  }];
}
export {
  exportSiemens,
  importSiemens
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjL3BsYy1lZGl0b3ItdHN4L3ZlbmRvci9hZGFwdGVycy9zaWVtZW5zQWRhcHRlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLypcbiAqIFNpZW1lbnMgU2ltYXRpY01MIEFkYXB0ZXIgKFRJQSBQb3J0YWwgZXhwb3J0IHZpYSBUSUEgT3Blbm5lc3MpXG4gKiBQYXJzZXMgU1cuQmxvY2tzLkNvbXBpbGVVbml0IC8gU1cuQ29kZUJsb2NrIFhNTCBleHBvcnRlZCBieSBUSUEgUG9ydGFsLlxuICpcbiAqIEZpeGVzIGFwcGxpZWQ6XG4gKiAtIExBRCB3aXJlcyB1c2VkIHRvIGRldGVybWluZSBjb25uZWN0aXZpdHkgYW5kIHBhcmFsbGVsIGJyYW5jaGVzXG4gKiAtIFNldC9SZXNldCBjb2lscyBwcm9wZXJseSBkZXRlY3RlZCAoPFNldENvaWw+LzxSZXNldENvaWw+KVxuICogLSBTQ0wgc291cmNlIHRleHQgcHJvcGVybHkgZXh0cmFjdGVkXG4gKiAtIEdSQVBIIChTRkMpIGxhbmd1YWdlIGhhbmRsZWRcbiAqIC0gQ3Jvc3MtREIgcmVmZXJlbmNlcyAoZG90LXBhdGgpIHJlc29sdmVkIGNvcnJlY3RseVxuICogLSBJbnN0YW5jZSBEQnMgKFNXLkJsb2Nrcy5EQiAvIFNXLkJsb2Nrcy5JbnN0YW5jZURCKSBpbXBvcnRlZFxuICogLSBJbnRlcmZhY2Ugc2VjdGlvbiB0eXBlIHByZXNlcnZlZCBvbiB0YWdzIGZvciBjb3JyZWN0IHJlLWV4cG9ydFxuICovXG5cbmltcG9ydCB7IHBhcnNlWE1MLCBidWlsZFhNTCwgYXR0ciwgdGV4dCwgY2hpbGQsIGNoaWxkQXJyYXkgfSBmcm9tICcuLi94bWxVdGlscy5qcyc7XG5pbXBvcnQgeyBzaWVtZW5zVHlwZVRvSUVDLCBpZWNUeXBlVG9TaW1hdGljIH0gZnJvbSAnLi4vZGF0YVR5cGVNYXAuanMnO1xuaW1wb3J0IHsgYnVpbGRSZXNvbHZlciwgVmFyaWFibGVUeXBlUmVzb2x2ZXIgfSBmcm9tICcuLi92YXJpYWJsZVR5cGVSZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBnZXRQaW5EYXRhVHlwZSwgYnVpbGRUeXBlZFBpbnMgfSBmcm9tICcuLi9waW5TaWduYXR1cmVzLmpzJztcbmltcG9ydCB0eXBlIHtcbiAgSW1wb3J0UmVzdWx0LCBFeHBvcnRSZXN1bHQsIE5vcm1hbGl6ZWRQcm9qZWN0LCBOb3JtYWxpemVkUE9VLCBOb3JtYWxpemVkVGFnLFxuICBWZW5kb3JNZXRhZGF0YVNpZGVjYXIsIFVubWFwcGVkRWxlbWVudCxcbn0gZnJvbSAnLi4vdHlwZXMuanMnO1xuaW1wb3J0IHR5cGUge1xuICBMYWRkZXJQcm9ncmFtLCBGQkRQcm9ncmFtLCBTRkNQcm9ncmFtLCBSdW5nLCBMYWRkZXJFbGVtZW50LCBCcmFuY2gsXG4gIENvbnRhY3RFbGVtZW50LCBDb2lsRWxlbWVudCwgQmxvY2tFbGVtZW50LCBDb250YWN0VHlwZSwgQ29pbFR5cGUsIEZCVHlwZSxcbiAgRkJETm9kZSwgRkJEV2lyZSwgUGluLCBGQkRCbG9ja1R5cGUsXG4gIFNGQ1N0ZXAsIFNGQ1RyYW5zaXRpb24sIFNGQ0xpbmssIFNGQ0FjdGlvbiwgQWN0aW9uUXVhbGlmaWVyLCBTRkNKdW1wLCBTRkNCcmFuY2gsXG59IGZyb20gJy4uLy4uL2xvZ2ljU3RvcmUuanMnO1xuXG5sZXQgX3VpZCA9IDA7XG5mdW5jdGlvbiBnZW5JZChwcmVmaXg6IHN0cmluZyk6IHN0cmluZyB7IHJldHVybiBgJHtwcmVmaXh9LSR7KytfdWlkfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIsIDgpfWA7IH1cblxuZnVuY3Rpb24gdW5lc2NhcGVYTUwoczogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHMucmVwbGFjZSgvJmFtcDsvZywgJyYnKS5yZXBsYWNlKC8mbHQ7L2csICc8JykucmVwbGFjZSgvJmd0Oy9nLCAnPicpLnJlcGxhY2UoLyZxdW90Oy9nLCAnXCInKS5yZXBsYWNlKC8mYXBvczsvZywgXCInXCIpO1xufVxuXG4vLyBUSUEgUG9ydGFsIHVzZXMgbmVzdGVkIE11bHRpbGluZ3VhbFRleHQgc3RydWN0dXJlIGZvciBjb21tZW50cy90aXRsZXMuXG4vLyBFeHRyYWN0IHRoZSBFbmdsaXNoIHRleHQgKG9yIGZpcnN0IGF2YWlsYWJsZSB0ZXh0KSBmcm9tIHRoZSBuZXN0ZWQgc3RydWN0dXJlLlxuZnVuY3Rpb24gZXh0cmFjdE11bHRpbGluZ3VhbFRleHQoZWw6IHVua25vd24pOiBzdHJpbmcge1xuICBpZiAoIWVsKSByZXR1cm4gJyc7XG4gIC8vIFRyeSBwbGFpbiB0ZXh0IGZpcnN0IChQbGF4aW8gcm91bmQtdHJpcCBmb3JtYXQgYW5kIHNvbWUgVElBIHZlcnNpb25zKVxuICBjb25zdCBwbGFpbiA9IHRleHQoZWwpO1xuICBpZiAocGxhaW4gJiYgcGxhaW4udHJpbSgpKSByZXR1cm4gcGxhaW4udHJpbSgpO1xuICAvLyBUSUEgUG9ydGFsIG5lc3RlZDogQ29tbWVudC9NdWx0aWxpbmd1YWxUZXh0L09iamVjdExpc3QvTXVsdGlsaW5ndWFsVGV4dEl0ZW0vQXR0cmlidXRlTGlzdC9UZXh0XG4gIGZvciAoY29uc3QgbWxFbCBvZiBjaGlsZEFycmF5KGVsLCAnTXVsdGlsaW5ndWFsVGV4dCcpKSB7XG4gICAgZm9yIChjb25zdCBpdGVtRWwgb2YgY2hpbGRBcnJheShjaGlsZChtbEVsLCAnT2JqZWN0TGlzdCcpLCAnTXVsdGlsaW5ndWFsVGV4dEl0ZW0nKSkge1xuICAgICAgY29uc3QgY3VsdHVyZSA9IHRleHQoY2hpbGQoY2hpbGQoaXRlbUVsLCAnQXR0cmlidXRlTGlzdCcpLCAnQ3VsdHVyZScpKSB8fCAnJztcbiAgICAgIGNvbnN0IHQgPSB0ZXh0KGNoaWxkKGNoaWxkKGl0ZW1FbCwgJ0F0dHJpYnV0ZUxpc3QnKSwgJ1RleHQnKSkgfHwgJyc7XG4gICAgICBpZiAodCAmJiAoY3VsdHVyZS5zdGFydHNXaXRoKCdlbicpIHx8ICFjdWx0dXJlKSkgcmV0dXJuIHQ7XG4gICAgfVxuICAgIC8vIElmIG5vIGVuLSBjdWx0dXJlIGZvdW5kLCByZXR1cm4gZmlyc3QgYXZhaWxhYmxlXG4gICAgZm9yIChjb25zdCBpdGVtRWwgb2YgY2hpbGRBcnJheShjaGlsZChtbEVsLCAnT2JqZWN0TGlzdCcpLCAnTXVsdGlsaW5ndWFsVGV4dEl0ZW0nKSkge1xuICAgICAgY29uc3QgdCA9IHRleHQoY2hpbGQoY2hpbGQoaXRlbUVsLCAnQXR0cmlidXRlTGlzdCcpLCAnVGV4dCcpKSB8fCAnJztcbiAgICAgIGlmICh0KSByZXR1cm4gdDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuICcnO1xufVxuXG4vLyBFeHRlbmRlZCBOb3JtYWxpemVkVGFnIHdpdGggc2VjdGlvbiBpbmZvIGZvciBsb3NzbGVzcyByZS1leHBvcnRcbmludGVyZmFjZSBTaWVtZW5zVGFnIGV4dGVuZHMgTm9ybWFsaXplZFRhZyB7XG4gIHNlY3Rpb24/OiAnSW5wdXQnIHwgJ091dHB1dCcgfCAnSW5PdXQnIHwgJ1N0YXRpYycgfCAnVGVtcCcgfCAnQ29uc3RhbnQnIHwgJ1JldHVybic7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBJbXBvcnQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBmdW5jdGlvbiBpbXBvcnRTaWVtZW5zKHhtbENvbnRlbnQ6IHN0cmluZywgZmlsZVBhdGg6IHN0cmluZyk6IEltcG9ydFJlc3VsdCB7XG4gIF91aWQgPSAwO1xuICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10gPSBbXTtcblxuICBsZXQgcm9vdDogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIHRyeSB7XG4gICAgcm9vdCA9IHBhcnNlWE1MKHhtbENvbnRlbnQpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcnM6IFtgWE1MIHBhcnNlIGVycm9yOiAke2V9YF0sIHdhcm5pbmdzOiBbXSB9O1xuICB9XG5cbiAgY29uc3QgZG9jdW1lbnQgPSBjaGlsZChyb290LCAnRG9jdW1lbnQnKSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IHVuZGVmaW5lZDtcbiAgaWYgKCFkb2N1bWVudCkge1xuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3JzOiBbJ05vIDxEb2N1bWVudD4gcm9vdCBmb3VuZCBpbiBTaW1hdGljTUwgZmlsZSddLCB3YXJuaW5nczogW10gfTtcbiAgfVxuXG4gIGNvbnN0IGRvY0luZm8gPSBjaGlsZChkb2N1bWVudCwgJ0RvY3VtZW50SW5mbycpIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgdW5kZWZpbmVkO1xuICBjb25zdCBwcm9qZWN0TmFtZSA9IHRleHQoY2hpbGQoZG9jSW5mbywgJ1Byb2plY3ROYW1lJykpIHx8ICdTaWVtZW5zIEltcG9ydCc7XG4gIC8vIFRJQSB2ZXJzaW9uOiBwcmVmZXIgRG9jdW1lbnRJbmZvLlRpYVZlcnNpb24sIGZhbGwgYmFjayB0byBFbmdpbmVlcmluZ1t2ZXJzaW9uXSBhdHRyaWJ1dGVcbiAgY29uc3QgdmVyc2lvbiA9IHRleHQoY2hpbGQoZG9jSW5mbywgJ1RpYVZlcnNpb24nKSlcbiAgICB8fCBhdHRyKGNoaWxkKGRvY3VtZW50LCAnRW5naW5lZXJpbmcnKSwgJ3ZlcnNpb24nKVxuICAgIHx8ICcxLjAnO1xuXG4gIGNvbnN0IHBvdXM6IE5vcm1hbGl6ZWRQT1VbXSA9IFtdO1xuICBjb25zdCBnbG9iYWxUYWdzOiBOb3JtYWxpemVkVGFnW10gPSBbXTtcblxuICBjb25zdCBzd0Jsb2NrcyA9IGNoaWxkKGRvY3VtZW50LCAnU1cuQmxvY2tzJykgPz8gZG9jdW1lbnQ7XG5cbiAgLy8gUGFyc2UgY29tcGlsZSB1bml0c1xuICBmb3IgKGNvbnN0IGJsb2NrRWwgb2YgY2hpbGRBcnJheShzd0Jsb2NrcywgJ1NXLkJsb2Nrcy5Db21waWxlVW5pdCcpLmNvbmNhdChjaGlsZEFycmF5KHN3QmxvY2tzLCAnU1cuQ29kZUJsb2NrJykpKSB7XG4gICAgY29uc3QgcG91ID0gcGFyc2VDb21waWxlVW5pdChibG9ja0VsLCB1bm1hcHBlZCwgd2FybmluZ3MpO1xuICAgIGlmIChwb3UpIHBvdXMucHVzaChwb3UpO1xuICB9XG5cbiAgLy8gVG9wLWxldmVsIGJsb2NrcyAoT0IsIEZCLCBGQylcbiAgZm9yIChjb25zdCBrZXkgb2YgWydTVy5CbG9ja3MuT0InLCAnU1cuQmxvY2tzLkZCJywgJ1NXLkJsb2Nrcy5GQyddKSB7XG4gICAgZm9yIChjb25zdCBibG9ja0VsIG9mIGNoaWxkQXJyYXkoc3dCbG9ja3MsIGtleSkpIHtcbiAgICAgIGNvbnN0IHBvdSA9IHBhcnNlVG9wTGV2ZWxCbG9jayhibG9ja0VsLCBrZXksIHVubWFwcGVkLCB3YXJuaW5ncyk7XG4gICAgICBpZiAocG91KSBwb3VzLnB1c2gocG91KTtcbiAgICB9XG4gIH1cblxuICAvLyBHbG9iYWwgREIgdGFnc1xuICBmb3IgKGNvbnN0IGRiRWwgb2YgY2hpbGRBcnJheShzd0Jsb2NrcywgJ1NXLkJsb2Nrcy5HbG9iYWxEQicpKSB7XG4gICAgY29uc3QgZGJOYW1lID0gdGV4dChjaGlsZChjaGlsZChkYkVsLCAnQXR0cmlidXRlTGlzdCcpLCAnTmFtZScpKSB8fCAnR2xvYmFsREInO1xuICAgIGNvbnN0IGludGVyZmFjZUVsID0gY2hpbGQoY2hpbGQoZGJFbCwgJ0F0dHJpYnV0ZUxpc3QnKSwgJ0ludGVyZmFjZScpO1xuICAgIGlmIChpbnRlcmZhY2VFbCkge1xuICAgICAgY29uc3Qgc2VjdGlvblRhZ3MgPSBwYXJzZVNpZW1lbnNJbnRlcmZhY2UoaW50ZXJmYWNlRWwsIHVubWFwcGVkKTtcbiAgICAgIGdsb2JhbFRhZ3MucHVzaCguLi5zZWN0aW9uVGFncy5tYXAodCA9PiAoeyAuLi50LCBhZGRyZXNzOiBgJHtkYk5hbWV9LiR7dC5uYW1lfWAgfSkpKTtcbiAgICB9XG4gIH1cblxuICAvLyBJbnN0YW5jZSBEQnNcbiAgZm9yIChjb25zdCBkYkVsIG9mIGNoaWxkQXJyYXkoc3dCbG9ja3MsICdTVy5CbG9ja3MuREInKS5jb25jYXQoY2hpbGRBcnJheShzd0Jsb2NrcywgJ1NXLkJsb2Nrcy5JbnN0YW5jZURCJykpKSB7XG4gICAgY29uc3QgZGJOYW1lID0gdGV4dChjaGlsZChjaGlsZChkYkVsLCAnQXR0cmlidXRlTGlzdCcpLCAnTmFtZScpKSB8fCAnREInO1xuICAgIGNvbnN0IGludGVyZmFjZUVsID0gY2hpbGQoY2hpbGQoZGJFbCwgJ0F0dHJpYnV0ZUxpc3QnKSwgJ0ludGVyZmFjZScpO1xuICAgIGlmIChpbnRlcmZhY2VFbCkge1xuICAgICAgY29uc3Qgc2VjdGlvblRhZ3MgPSBwYXJzZVNpZW1lbnNJbnRlcmZhY2UoaW50ZXJmYWNlRWwsIHVubWFwcGVkKTtcbiAgICAgIGdsb2JhbFRhZ3MucHVzaCguLi5zZWN0aW9uVGFncy5tYXAodCA9PiAoeyAuLi50LCBhZGRyZXNzOiBgJHtkYk5hbWV9LiR7dC5uYW1lfWAgfSkpKTtcbiAgICB9XG4gIH1cblxuICBpZiAocG91cy5sZW5ndGggPT09IDApIHtcbiAgICBlcnJvcnMucHVzaCgnTm8gcHJvZ3JhbSBibG9ja3MgKE9CL0ZCL0ZDKSBmb3VuZCcpO1xuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3JzLCB3YXJuaW5ncyB9O1xuICB9XG5cbiAgY29uc3Qgc2lkZWNhcjogVmVuZG9yTWV0YWRhdGFTaWRlY2FyID0ge1xuICAgIHNvdXJjZVZlbmRvcjogJ3NpZW1lbnNfc2ltYXRpY19tbCcsXG4gICAgc291cmNlRmlsZVZlcnNpb246IHZlcnNpb24sXG4gICAgb3JpZ2luYWxGaWxlUGF0aDogZmlsZVBhdGgsXG4gICAgdW5tYXBwZWRFbGVtZW50czogdW5tYXBwZWQsXG4gICAgb3JnYW5pemVyVHJlZUxheW91dDogZG9jdW1lbnQsXG4gICAgdmVuZG9yU3BlY2lmaWNHbG9iYWxzOiB7IHRpYVZlcnNpb246IHZlcnNpb24sIHByb2plY3ROYW1lIH0sXG4gIH07XG5cbiAgcmV0dXJuIHsgb2s6IHRydWUsIHByb2plY3Q6IHsgcHJvamVjdE5hbWUsIHBvdXMsIGdsb2JhbFRhZ3MsIHNpZGVjYXIgfSwgZXJyb3JzLCB3YXJuaW5ncyB9O1xufVxuXG5mdW5jdGlvbiBwYXJzZVRvcExldmVsQmxvY2soXG4gIGJsb2NrRWw6IHVua25vd24sXG4gIGJsb2NrVHlwZTogc3RyaW5nLFxuICB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10sXG4gIHdhcm5pbmdzOiBzdHJpbmdbXVxuKTogTm9ybWFsaXplZFBPVSB8IG51bGwge1xuICBpZiAoIWJsb2NrRWwgfHwgdHlwZW9mIGJsb2NrRWwgIT09ICdvYmplY3QnKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgYXR0ckxpc3QgPSBjaGlsZChibG9ja0VsLCAnQXR0cmlidXRlTGlzdCcpIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgdW5kZWZpbmVkO1xuICBjb25zdCBibG9ja05hbWUgPSB0ZXh0KGNoaWxkKGF0dHJMaXN0LCAnTmFtZScpKSB8fCAnQmxvY2snO1xuICBjb25zdCBsYW5ndWFnZSA9ICh0ZXh0KGNoaWxkKGF0dHJMaXN0LCAnUHJvZ3JhbW1pbmdMYW5ndWFnZScpKSB8fCAnTEFEJykudG9VcHBlckNhc2UoKTtcblxuICBjb25zdCBsb2NhbFRhZ3M6IFNpZW1lbnNUYWdbXSA9IFtdO1xuICBjb25zdCBpbnRlcmZhY2VFbCA9IGNoaWxkKGF0dHJMaXN0LCAnSW50ZXJmYWNlJyk7XG4gIGlmIChpbnRlcmZhY2VFbCkge1xuICAgIGxvY2FsVGFncy5wdXNoKC4uLnBhcnNlU2llbWVuc0ludGVyZmFjZShpbnRlcmZhY2VFbCwgdW5tYXBwZWQpKTtcbiAgfVxuXG4gIGNvbnN0IG5ldHdvcmtzOiB1bmtub3duW10gPSBbXTtcbiAgZm9yIChjb25zdCBuZXRFbCBvZiBjaGlsZEFycmF5KGNoaWxkKGJsb2NrRWwsICdPYmplY3RMaXN0JyksICdTVy5CbG9ja3MuQ29tcGlsZVVuaXQnKSkge1xuICAgIG5ldHdvcmtzLnB1c2gobmV0RWwpO1xuICB9XG5cbiAgY29uc3QgcG91VHlwZSA9IGJsb2NrVHlwZS5pbmNsdWRlcygnRkInKSA/ICdmdW5jdGlvbkJsb2NrJyBhcyBjb25zdFxuICAgIDogYmxvY2tUeXBlLmluY2x1ZGVzKCdGQycpID8gJ2Z1bmN0aW9uJyBhcyBjb25zdFxuICAgIDogJ3Byb2dyYW0nIGFzIGNvbnN0O1xuXG4gIGNvbnN0IHJlc29sdmVyID0gYnVpbGRSZXNvbHZlcihsb2NhbFRhZ3MgYXMgTm9ybWFsaXplZFRhZ1tdLCBbXSk7XG5cbiAgaWYgKGxhbmd1YWdlID09PSAnTEFEJyB8fCBsYW5ndWFnZSA9PT0gJ0xEJykge1xuICAgIGNvbnN0IGxhZGRlciA9IHBhcnNlTmV0d29ya3NUb0xEKG5ldHdvcmtzLCBibG9ja05hbWUsIHVubWFwcGVkLCB3YXJuaW5ncywgcmVzb2x2ZXIpO1xuICAgIHJldHVybiB7IGlkOiBgcG91LSR7YmxvY2tOYW1lfWAsIG5hbWU6IGJsb2NrTmFtZSwgbGFuZ3VhZ2U6ICdMRCcsIGxhZGRlclByb2dyYW06IGxhZGRlciwgbG9jYWxUYWdzLCBwb3VUeXBlIH07XG4gIH1cbiAgaWYgKGxhbmd1YWdlID09PSAnRkJEJykge1xuICAgIGNvbnN0IGZiZCA9IHBhcnNlTmV0d29ya3NUb0ZCRChuZXR3b3JrcywgYmxvY2tOYW1lLCB1bm1hcHBlZCwgd2FybmluZ3MsIHJlc29sdmVyKTtcbiAgICByZXR1cm4geyBpZDogYHBvdS0ke2Jsb2NrTmFtZX1gLCBuYW1lOiBibG9ja05hbWUsIGxhbmd1YWdlOiAnRkJEJywgZmJkUHJvZ3JhbTogZmJkLCBsb2NhbFRhZ3MsIHBvdVR5cGUgfTtcbiAgfVxuICBpZiAobGFuZ3VhZ2UgPT09ICdTQ0wnIHx8IGxhbmd1YWdlID09PSAnU1RMJykge1xuICAgIGNvbnN0IHNjbCA9IGV4dHJhY3RTQ0xTb3VyY2UoYmxvY2tFbCwgYXR0ckxpc3QpO1xuICAgIHJldHVybiB7IGlkOiBgcG91LSR7YmxvY2tOYW1lfWAsIG5hbWU6IGJsb2NrTmFtZSwgbGFuZ3VhZ2U6ICdTVCcsIHN0U291cmNlOiBzY2wsIGxvY2FsVGFncywgcG91VHlwZSB9O1xuICB9XG4gIGlmIChsYW5ndWFnZSA9PT0gJ0dSQVBIJykge1xuICAgIGNvbnN0IHNmYyA9IHBhcnNlTmV0d29ya3NUb1NGQyhuZXR3b3JrcywgYmxvY2tOYW1lLCB1bm1hcHBlZCwgd2FybmluZ3MpO1xuICAgIHJldHVybiB7IGlkOiBgcG91LSR7YmxvY2tOYW1lfWAsIG5hbWU6IGJsb2NrTmFtZSwgbGFuZ3VhZ2U6ICdTRkMnLCBzZmNQcm9ncmFtOiBzZmMsIGxvY2FsVGFncywgcG91VHlwZSB9O1xuICB9XG5cbiAgdW5tYXBwZWQucHVzaCh7IGNsbU5vZGVJZDogbnVsbCwgdmVuZG9yU3BlY2lmaWNEYXRhOiBibG9ja0VsLCByZWFzb246IGBCbG9jayBcIiR7YmxvY2tOYW1lfVwiOiB1bnN1cHBvcnRlZCBsYW5ndWFnZSAke2xhbmd1YWdlfWAgfSk7XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBleHRyYWN0U0NMU291cmNlKGJsb2NrRWw6IHVua25vd24sIGF0dHJMaXN0OiB1bmtub3duKTogc3RyaW5nIHtcbiAgLy8gVHJ5IG11bHRpcGxlIGxvY2F0aW9ucyB3aGVyZSBTQ0wgc291cmNlIGlzIHN0b3JlZCBpbiBUSUEgZXhwb3J0c1xuICBjb25zdCBzY2xTb3VyY2UgPSB0ZXh0KGNoaWxkKGF0dHJMaXN0LCAnU0NMU291cmNlSW5mb3JtYXRpb24nKSk7XG4gIGlmIChzY2xTb3VyY2UgJiYgc2NsU291cmNlLnRyaW0oKSAhPT0gJygqIFNDTCAqKScpIHJldHVybiB1bmVzY2FwZVhNTChzY2xTb3VyY2UpO1xuXG4gIC8vIFRyeSBTdHJ1Y3R1cmVkVGV4dCBlbGVtZW50IGluc2lkZSBjb21waWxlIHVuaXRzXG4gIGNvbnN0IG9iamVjdExpc3QgPSBjaGlsZChibG9ja0VsLCAnT2JqZWN0TGlzdCcpO1xuICBmb3IgKGNvbnN0IGN1IG9mIGNoaWxkQXJyYXkob2JqZWN0TGlzdCwgJ1NXLkJsb2Nrcy5Db21waWxlVW5pdCcpKSB7XG4gICAgY29uc3QgY3VBdHRyID0gY2hpbGQoY3UsICdBdHRyaWJ1dGVMaXN0Jyk7XG4gICAgY29uc3Qgc3JjID0gdGV4dChjaGlsZChjdUF0dHIsICdOZXR3b3JrU291cmNlJykpO1xuICAgIGlmIChzcmMgJiYgc3JjLnRyaW0oKSkgcmV0dXJuIHVuZXNjYXBlWE1MKHNyYyk7XG4gICAgY29uc3Qgc3RFbCA9IGNoaWxkKGN1QXR0ciwgJ1N0cnVjdHVyZWRUZXh0Jyk7XG4gICAgaWYgKHN0RWwpIHtcbiAgICAgIGNvbnN0IHN0VGV4dCA9IHRleHQoc3RFbCk7XG4gICAgICBpZiAoc3RUZXh0ICYmIHN0VGV4dC50cmltKCkpIHJldHVybiB1bmVzY2FwZVhNTChzdFRleHQpO1xuICAgICAgLy8gVElBIFYxNys6IFNDTCBlbmNvZGVkIGFzIFRva2VuL0JsYW5rIGNoaWxkcmVuIGluc3RlYWQgb2YgdGV4dCBub2RlXG4gICAgICBjb25zdCB0b2tlbnMgPSBjaGlsZEFycmF5KHN0RWwsICdUb2tlbicpLmNvbmNhdChjaGlsZEFycmF5KHN0RWwsICdCbGFuaycpKTtcbiAgICAgIGlmICh0b2tlbnMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCByZWNvbnN0cnVjdGVkID0gdG9rZW5zLm1hcCh0ID0+IGF0dHIodCwgJ1RleHQnKSA/PyAnICcpLmpvaW4oJycpO1xuICAgICAgICBpZiAocmVjb25zdHJ1Y3RlZC50cmltKCkpIHJldHVybiB1bmVzY2FwZVhNTChyZWNvbnN0cnVjdGVkKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBUcnkgRXh0ZXJuYWxTb3VyY2VcbiAgZm9yIChjb25zdCBleHQgb2YgY2hpbGRBcnJheShvYmplY3RMaXN0LCAnU1cuRXh0ZXJuYWxTb3VyY2UnKSkge1xuICAgIGNvbnN0IHNyYyA9IHRleHQoZXh0KTtcbiAgICBpZiAoc3JjICYmIHNyYy50cmltKCkpIHJldHVybiB1bmVzY2FwZVhNTChzcmMpO1xuICB9XG5cbiAgcmV0dXJuICcoKiBTQ0wgc291cmNlIG5vdCBmb3VuZCBpbiBleHBvcnQgKiknO1xufVxuXG5mdW5jdGlvbiBwYXJzZUNvbXBpbGVVbml0KFxuICBjdUVsOiB1bmtub3duLFxuICB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10sXG4gIHdhcm5pbmdzOiBzdHJpbmdbXVxuKTogTm9ybWFsaXplZFBPVSB8IG51bGwge1xuICBpZiAoIWN1RWwgfHwgdHlwZW9mIGN1RWwgIT09ICdvYmplY3QnKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgYXR0ckxpc3QgPSBjaGlsZChjdUVsLCAnQXR0cmlidXRlTGlzdCcpIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgdW5kZWZpbmVkO1xuICBjb25zdCBpZCA9IGF0dHIoY3VFbCwgJ0lEJykgfHwgYXR0cihhdHRyTGlzdCwgJ0lEJykgfHwgJ2N1JztcbiAgY29uc3QgbGFuZ3VhZ2UgPSAodGV4dChjaGlsZChhdHRyTGlzdCwgJ1Byb2dyYW1taW5nTGFuZ3VhZ2UnKSkgfHwgJ0xBRCcpLnRvVXBwZXJDYXNlKCk7XG4gIGNvbnN0IHRpdGxlID0gdGV4dChjaGlsZChjaGlsZChjdUVsLCAnT2JqZWN0TGlzdCcpLCAnTXVsdGlsaW5ndWFsVGV4dCcpKSB8fCBgTmV0d29ya18ke2lkfWA7XG5cbiAgY29uc3QgbmV0d29ya3MgPSBbY3VFbF07XG5cbiAgaWYgKGxhbmd1YWdlID09PSAnTEFEJyB8fCBsYW5ndWFnZSA9PT0gJ0xEJykge1xuICAgIGNvbnN0IGxhZGRlciA9IHBhcnNlTmV0d29ya3NUb0xEKG5ldHdvcmtzLCBpZCwgdW5tYXBwZWQsIHdhcm5pbmdzKTtcbiAgICByZXR1cm4geyBpZDogYHBvdS0ke2lkfWAsIG5hbWU6IHRpdGxlLCBsYW5ndWFnZTogJ0xEJywgbGFkZGVyUHJvZ3JhbTogbGFkZGVyLCBsb2NhbFRhZ3M6IFtdIH07XG4gIH1cbiAgaWYgKGxhbmd1YWdlID09PSAnRkJEJykge1xuICAgIGNvbnN0IGZiZCA9IHBhcnNlTmV0d29ya3NUb0ZCRChuZXR3b3JrcywgaWQsIHVubWFwcGVkLCB3YXJuaW5ncyk7XG4gICAgcmV0dXJuIHsgaWQ6IGBwb3UtJHtpZH1gLCBuYW1lOiB0aXRsZSwgbGFuZ3VhZ2U6ICdGQkQnLCBmYmRQcm9ncmFtOiBmYmQsIGxvY2FsVGFnczogW10gfTtcbiAgfVxuICBpZiAobGFuZ3VhZ2UgPT09ICdHUkFQSCcpIHtcbiAgICBjb25zdCBzZmMgPSBwYXJzZU5ldHdvcmtzVG9TRkMobmV0d29ya3MsIGlkLCB1bm1hcHBlZCwgd2FybmluZ3MpO1xuICAgIHJldHVybiB7IGlkOiBgcG91LSR7aWR9YCwgbmFtZTogdGl0bGUsIGxhbmd1YWdlOiAnU0ZDJywgc2ZjUHJvZ3JhbTogc2ZjLCBsb2NhbFRhZ3M6IFtdIH07XG4gIH1cblxuICB1bm1hcHBlZC5wdXNoKHsgY2xtTm9kZUlkOiBudWxsLCB2ZW5kb3JTcGVjaWZpY0RhdGE6IGN1RWwsIHJlYXNvbjogYENvbXBpbGVVbml0IFwiJHt0aXRsZX1cIjogdW5zdXBwb3J0ZWQgbGFuZ3VhZ2UgJHtsYW5ndWFnZX1gIH0pO1xuICByZXR1cm4gbnVsbDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFNpZW1lbnMgSW50ZXJmYWNlIHBhcnNlciAod2l0aCBzZWN0aW9uIHByZXNlcnZhdGlvbikgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHBhcnNlU2llbWVuc0ludGVyZmFjZShpbnRlcmZhY2VFbDogdW5rbm93biwgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdKTogU2llbWVuc1RhZ1tdIHtcbiAgY29uc3QgdGFnczogU2llbWVuc1RhZ1tdID0gW107XG4gIGNvbnN0IHNlY3Rpb25zID0gY2hpbGQoaW50ZXJmYWNlRWwsICdTZWN0aW9ucycpID8/IGludGVyZmFjZUVsO1xuXG4gIGZ1bmN0aW9uIHBhcnNlU2VjdGlvbnNSZWN1cnNpdmUoc2VjdGlvbnNFbDogdW5rbm93bik6IHZvaWQge1xuICAgIGZvciAoY29uc3Qgc2VjdGlvbiBvZiBjaGlsZEFycmF5KHNlY3Rpb25zRWwsICdTZWN0aW9uJykpIHtcbiAgICAgIGNvbnN0IHJhd1NlY3Rpb25OYW1lID0gYXR0cihzZWN0aW9uLCAnTmFtZScpO1xuICAgICAgY29uc3Qgc2VjdGlvbk5hbWUgPSByYXdTZWN0aW9uTmFtZSBhcyBTaWVtZW5zVGFnWydzZWN0aW9uJ10gfHwgJ1N0YXRpYyc7XG4gICAgICAvLyBHUkFQSCBcIkJhc2VcIiBzZWN0aW9uIGNvbnRhaW5zIG5lc3RlZCBTZWN0aW9ucyBcdTIwMTQgcmVjdXJzZVxuICAgICAgaWYgKHJhd1NlY3Rpb25OYW1lID09PSAnQmFzZScgfHwgcmF3U2VjdGlvbk5hbWUgPT09ICdOb25lJykge1xuICAgICAgICBjb25zdCBuZXN0ZWRTZWN0aW9ucyA9IGNoaWxkKHNlY3Rpb24sICdTZWN0aW9ucycpO1xuICAgICAgICBpZiAobmVzdGVkU2VjdGlvbnMpIHtcbiAgICAgICAgICBwYXJzZVNlY3Rpb25zUmVjdXJzaXZlKG5lc3RlZFNlY3Rpb25zKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBtZW1iZXJFbCBvZiBjaGlsZEFycmF5KHNlY3Rpb24sICdNZW1iZXInKSkge1xuICAgICAgICBjb25zdCBuYW1lID0gYXR0cihtZW1iZXJFbCwgJ05hbWUnKTtcbiAgICAgICAgY29uc3QgdHlwZVN0ciA9IGF0dHIobWVtYmVyRWwsICdEYXRhdHlwZScpO1xuICAgICAgICBpZiAoIW5hbWUpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBkYXRhVHlwZSA9IHNpZW1lbnNUeXBlVG9JRUModHlwZVN0cik7XG4gICAgICAgIGNvbnN0IHN0YXJ0VmFsdWUgPSB0ZXh0KGNoaWxkKG1lbWJlckVsLCAnU3RhcnRWYWx1ZScpKTtcbiAgICAgICAgLy8gQ29tbWVudCBtYXkgYmUgYSBkaXJlY3QgdGV4dCBub2RlIG9yIHdyYXBwZWQgaW4gTXVsdGlMYW5ndWFnZVRleHQgY2hpbGRyZW5cbiAgICAgICAgY29uc3QgY29tbWVudEVsID0gY2hpbGQobWVtYmVyRWwsICdDb21tZW50Jyk7XG4gICAgICAgIGNvbnN0IGNvbW1lbnQgPSB0ZXh0KGNoaWxkKGNvbW1lbnRFbCwgJ011bHRpTGFuZ3VhZ2VUZXh0JykpIHx8IHRleHQoY29tbWVudEVsKSB8fCAnJztcbiAgICAgICAgdGFncy5wdXNoKHtcbiAgICAgICAgICBuYW1lLFxuICAgICAgICAgIGRhdGFUeXBlLFxuICAgICAgICAgIGluaXRpYWxWYWx1ZTogc3RhcnRWYWx1ZSB8fCB1bmRlZmluZWQsXG4gICAgICAgICAgZGVzY3JpcHRpb246IGNvbW1lbnQgfHwgdW5kZWZpbmVkLFxuICAgICAgICAgIHNlY3Rpb246IHNlY3Rpb25OYW1lLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwYXJzZVNlY3Rpb25zUmVjdXJzaXZlKHNlY3Rpb25zKTtcbiAgcmV0dXJuIHRhZ3M7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBMQUQgbmV0d29yayBcdTIxOTIgTGFkZGVyIHJ1bmcgKHdpdGggd2lyZS1iYXNlZCBvcmRlcmluZyArIGJyYW5jaGVzKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuaW50ZXJmYWNlIFdpcmVDb25uZWN0aW9uIHtcbiAgZnJvbVVJZDogc3RyaW5nO1xuICBmcm9tUGluOiBzdHJpbmc7XG4gIHRvVUlkOiBzdHJpbmc7XG4gIHRvUGluOiBzdHJpbmc7XG59XG5cbmZ1bmN0aW9uIHBhcnNlTmV0d29ya3NUb0xEKFxuICBuZXR3b3JrczogdW5rbm93bltdLFxuICBwb3VJZDogc3RyaW5nLFxuICB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10sXG4gIHdhcm5pbmdzOiBzdHJpbmdbXSxcbiAgcmVzb2x2ZXI6IFZhcmlhYmxlVHlwZVJlc29sdmVyID0gbmV3IFZhcmlhYmxlVHlwZVJlc29sdmVyKClcbik6IExhZGRlclByb2dyYW0ge1xuICBjb25zdCBydW5nczogUnVuZ1tdID0gW107XG4gIGxldCBydW5nSWR4ID0gMDtcblxuICBmb3IgKGNvbnN0IG5ldEVsIG9mIG5ldHdvcmtzKSB7XG4gICAgcnVuZ0lkeCsrO1xuICAgIGNvbnN0IGF0dHJMaXN0ID0gY2hpbGQobmV0RWwsICdBdHRyaWJ1dGVMaXN0Jyk7XG4gICAgLy8gRml4IDEwOiBuZXR3b3JrIGNvbW1lbnQgbWF5IGxpdmUgaW4gT2JqZWN0TGlzdC9NdWx0aWxpbmd1YWxUZXh0IGFzIHdlbGwgYXMgQXR0cmlidXRlTGlzdFxuICAgIGNvbnN0IG9iamVjdExpc3RFbCA9IGNoaWxkKG5ldEVsLCAnT2JqZWN0TGlzdCcpO1xuICAgIGNvbnN0IGNvbW1lbnRNbHQgPSBjaGlsZEFycmF5KG9iamVjdExpc3RFbCwgJ011bHRpbGluZ3VhbFRleHQnKS5maW5kKG0gPT4gYXR0cihtLCAnQ29tcG9zaXRpb25OYW1lJykgPT09ICdDb21tZW50Jyk7XG4gICAgY29uc3QgdGl0bGVNbHQgPSBjaGlsZEFycmF5KG9iamVjdExpc3RFbCwgJ011bHRpbGluZ3VhbFRleHQnKS5maW5kKG0gPT4gYXR0cihtLCAnQ29tcG9zaXRpb25OYW1lJykgPT09ICdUaXRsZScpO1xuICAgIGNvbnN0IGNvbW1lbnRFbCA9IGNoaWxkKGF0dHJMaXN0LCAnQ29tbWVudCcpID8/IGNoaWxkKGF0dHJMaXN0LCAnVGl0bGUnKTtcbiAgICBjb25zdCBjb21tZW50ID0gZXh0cmFjdE11bHRpbGluZ3VhbFRleHQoY29tbWVudE1sdCkgfHwgZXh0cmFjdE11bHRpbGluZ3VhbFRleHQodGl0bGVNbHQpIHx8IGV4dHJhY3RNdWx0aWxpbmd1YWxUZXh0KGNvbW1lbnRFbCkgfHwgJyc7XG5cbiAgICBjb25zdCBwYXJ0c0VsID0gY2hpbGQoYXR0ckxpc3QsICdOZXR3b3JrU291cmNlJyk7XG4gICAgY29uc3QgZmxnTmV0ID0gY2hpbGQocGFydHNFbCwgJ0ZsZ05ldCcpID8/IHBhcnRzRWw7XG4gICAgY29uc3QgcGFydHNOb2RlID0gY2hpbGQoZmxnTmV0LCAnUGFydHMnKSA/PyBmbGdOZXQ7XG4gICAgY29uc3Qgd2lyZXNOb2RlID0gY2hpbGQoZmxnTmV0LCAnV2lyZXMnKTtcblxuICAgIC8vIEJ1aWxkIGVsZW1lbnQgbWFwIGJ5IFVJZFxuICAgIGNvbnN0IHVpZFRvRWxlbWVudCA9IG5ldyBNYXA8c3RyaW5nLCBMYWRkZXJFbGVtZW50PigpO1xuICAgIGxldCBwb3NYID0gMDtcblxuICAgIC8vIEJ1aWxkIHdpcmUgbWFwIGZpcnN0IHNvIHdlIGNhbiByZXNvbHZlIG9wZXJhbmRzIGZvciBQYXJ0LWJhc2VkIGNvbnRhY3RzL2NvaWxzXG4gICAgLy8gVUlkIFx1MjE5MiBBY2Nlc3MgZWxlbWVudCBmb3IgdmFyaWFibGUgcmVzb2x1dGlvblxuICAgIGNvbnN0IHVpZFRvQWNjZXNzID0gbmV3IE1hcDxzdHJpbmcsIHVua25vd24+KCk7XG4gICAgY29uc3QgcmF3V2lyZXM6IHVua25vd25bXSA9IHdpcmVzTm9kZSA/IGNoaWxkQXJyYXkod2lyZXNOb2RlLCAnV2lyZScpIDogW107XG4gICAgZm9yIChjb25zdCB3aXJlRWwgb2YgcmF3V2lyZXMpIHtcbiAgICAgIGNvbnN0IGlkZW50Q29ucyA9IGNoaWxkQXJyYXkod2lyZUVsLCAnSWRlbnRDb24nKTtcbiAgICAgIGZvciAoY29uc3QgaWMgb2YgaWRlbnRDb25zKSB7XG4gICAgICAgIGNvbnN0IHVpZCA9IGF0dHIoaWMsICdVSWQnKTtcbiAgICAgICAgaWYgKHVpZCkge1xuICAgICAgICAgIC8vIEZpbmQgdGhlIEFjY2VzcyBlbGVtZW50IHdpdGggdGhpcyBVSWQgaW4gcGFydHNOb2RlXG4gICAgICAgICAgZm9yIChjb25zdCBhY2NFbCBvZiBjaGlsZEFycmF5KHBhcnRzTm9kZSwgJ0FjY2VzcycpKSB7XG4gICAgICAgICAgICBpZiAoYXR0cihhY2NFbCwgJ1VJZCcpID09PSB1aWQpIHsgdWlkVG9BY2Nlc3Muc2V0KHVpZCwgYWNjRWwpOyBicmVhazsgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEhlbHBlcjogcmVzb2x2ZSB0YWcgbmFtZSBmb3IgYSBQYXJ0IGVsZW1lbnQgdmlhIGl0cyB3aXJlLWNvbm5lY3RlZCBBY2Nlc3NcbiAgICBmdW5jdGlvbiByZXNvbHZlUGFydFRhZyhwYXJ0VUlkOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgLy8gRmlyc3QgdHJ5IGlubGluZSBBY2Nlc3MgY2hpbGQgKGVsZW1lbnQtYmFzZWQgZm9ybWF0KVxuICAgICAgY29uc3QgZGlyZWN0QWNjZXNzID0gY2hpbGRBcnJheShwYXJ0c05vZGUsICdBY2Nlc3MnKS5maW5kKGEgPT4ge1xuICAgICAgICAvLyBBY2Nlc3MgZWxlbWVudHMgd2l0aCBzYW1lIFVJZCBhcyBwYXJ0IFx1MjAxNCB1bmxpa2VseSBidXQgY2hlY2tcbiAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBQYXJ0cyBhbmQgQWNjZXNzIGhhdmUgZGlmZmVyZW50IFVJZHNcbiAgICAgIH0pO1xuICAgICAgLy8gV2lyZS1iYXNlZDogZmluZCB3aXJlIHdpdGggTmFtZUNvbiBVSWQ9cGFydFVJZCBOYW1lPVwib3BlcmFuZFwiIFx1MjE5MiBJZGVudENvbiBcdTIxOTIgQWNjZXNzXG4gICAgICBmb3IgKGNvbnN0IHdpcmVFbCBvZiByYXdXaXJlcykge1xuICAgICAgICBjb25zdCBuYW1lQ29ucyA9IGNoaWxkQXJyYXkod2lyZUVsLCAnTmFtZUNvbicpO1xuICAgICAgICBjb25zdCBpZGVudENvbnMgPSBjaGlsZEFycmF5KHdpcmVFbCwgJ0lkZW50Q29uJyk7XG4gICAgICAgIGZvciAoY29uc3QgbmMgb2YgbmFtZUNvbnMpIHtcbiAgICAgICAgICBpZiAoYXR0cihuYywgJ1VJZCcpID09PSBwYXJ0VUlkICYmIGF0dHIobmMsICdOYW1lJykgPT09ICdvcGVyYW5kJykge1xuICAgICAgICAgICAgLy8gVGhlIGNvbm5lY3RlZCBJZGVudENvbiBoYXMgdGhlIEFjY2VzcyBVSWRcbiAgICAgICAgICAgIGZvciAoY29uc3QgaWMgb2YgaWRlbnRDb25zKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGFjY2Vzc1VJZCA9IGF0dHIoaWMsICdVSWQnKTtcbiAgICAgICAgICAgICAgY29uc3QgYWNjRWwgPSB1aWRUb0FjY2Vzcy5nZXQoYWNjZXNzVUlkKTtcbiAgICAgICAgICAgICAgaWYgKGFjY0VsKSByZXR1cm4gcGFyc2VBY2Nlc3NUYWcoYWNjRWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuICdVTktOT1dOX1RBRyc7XG4gICAgfVxuXG4gICAgLy8gSGVscGVyOiBjaGVjayBpZiBQYXJ0IGVsZW1lbnQgaXMgbmVnYXRlZFxuICAgIGZ1bmN0aW9uIGlzUGFydE5lZ2F0ZWQocGFydEVsOiB1bmtub3duKTogYm9vbGVhbiB7XG4gICAgICByZXR1cm4gY2hpbGRBcnJheShwYXJ0RWwsICdOZWdhdGVkJykubGVuZ3RoID4gMFxuICAgICAgICB8fCBhdHRyKHBhcnRFbCwgJ05lZ2F0ZWQnKSA9PT0gJ3RydWUnXG4gICAgICAgIHx8IGNoaWxkQXJyYXkocGFydEVsLCAnTmVnYXRlZFJlc3VsdCcpLmxlbmd0aCA+IDA7XG4gICAgfVxuXG4gICAgLy8gVHJhY2sgd2hpY2ggVUlkcyBhcmUgbGVmdCBwb3dlciByYWlsIG9yaWdpbnMgKFBvd2VycmFpbCBlbGVtZW50cylcbiAgICBjb25zdCBwb3dlcnJhaWxVSWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgICAvLyBQYXJzZSBhbGwgZWxlbWVudHMgXHUyMDE0IGhhbmRsZSBib3RoIGVsZW1lbnQtbmFtZSBmb3JtIChDb250YWN0LCBDb2lsKSBhbmRcbiAgICAvLyBhdHRyaWJ1dGUtbmFtZSBmb3JtIChQYXJ0IE5hbWU9XCJDb250YWN0XCIpIHVzZWQgaW4gbmV3ZXIgVElBIFBvcnRhbCBleHBvcnRzXG4gICAgY29uc3QgYWxsUGFydEVscyA9IFtcbiAgICAgIC4uLmNoaWxkQXJyYXkocGFydHNOb2RlLCAnQ29udGFjdCcpLFxuICAgICAgLi4uY2hpbGRBcnJheShwYXJ0c05vZGUsICdDb2lsJyksXG4gICAgICAuLi5jaGlsZEFycmF5KHBhcnRzTm9kZSwgJ1NldENvaWwnKSxcbiAgICAgIC4uLmNoaWxkQXJyYXkocGFydHNOb2RlLCAnUmVzZXRDb2lsJyksXG4gICAgICAuLi5jaGlsZEFycmF5KHBhcnRzTm9kZSwgJ1BhcnQnKSwgIC8vIFRJQSBWMTYrIHVzZXMgUGFydCBOYW1lPVwiQ29udGFjdFwiIGV0Yy5cbiAgICAgIC4uLmNoaWxkQXJyYXkocGFydHNOb2RlLCAnQ2FsbCcpLFxuICAgICAgLi4uY2hpbGRBcnJheShwYXJ0c05vZGUsICdQb3dlcnJhaWwnKSxcbiAgICAgIC4uLmNoaWxkQXJyYXkocGFydHNOb2RlLCAnT3BlbkNvbicpLFxuICAgIF07XG5cbiAgICBmb3IgKGNvbnN0IHBhcnRFbCBvZiBhbGxQYXJ0RWxzKSB7XG4gICAgICBjb25zdCBwYXJ0VUlkID0gYXR0cihwYXJ0RWwsICdVSWQnKTtcbiAgICAgIGlmICghcGFydFVJZCkgY29udGludWU7XG5cbiAgICAgIC8vIERldGVybWluZSBlbGVtZW50IHNlbWFudGljIHR5cGVcbiAgICAgIGNvbnN0IGVsZW1UYWdOYW1lID0gKHBhcnRFbCBhcyBhbnkpWycjbmFtZSddIHx8ICcnO1xuICAgICAgY29uc3QgcGFydE5hbWUgPSBhdHRyKHBhcnRFbCwgJ05hbWUnKSB8fCBlbGVtVGFnTmFtZTtcbiAgICAgIGNvbnN0IHVwcGVyTmFtZSA9IHBhcnROYW1lLnRvVXBwZXJDYXNlKCk7XG5cbiAgICAgIC8vIFBvd2VycmFpbCA9IGxlZnQgcG93ZXIgcmFpbDsgbWFyayBhcyBzeW50aGV0aWMgcm9vdFxuICAgICAgaWYgKHVwcGVyTmFtZSA9PT0gJ1BPV0VSUkFJTCcgfHwgZWxlbVRhZ05hbWUgPT09ICdQb3dlcnJhaWwnKSB7XG4gICAgICAgIHBvd2VycmFpbFVJZHMuYWRkKHBhcnRVSWQpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmICh1cHBlck5hbWUgPT09ICdPUEVOQ09OJyB8fCBlbGVtVGFnTmFtZSA9PT0gJ09wZW5Db24nKSBjb250aW51ZTtcblxuICAgICAgLy8gU0NvaWwgKFNldCBDb2lsKSBcdTIwMTQgVElBIFYxNisgdXNlcyBQYXJ0IE5hbWU9XCJTQ29pbFwiXG4gICAgICBpZiAodXBwZXJOYW1lID09PSAnU0NPSUwnKSB7XG4gICAgICAgIGNvbnN0IGRpcmVjdEFjYyA9IGNoaWxkQXJyYXkocGFydEVsLCAnQWNjZXNzJylbMF07XG4gICAgICAgIGNvbnN0IHRhZ05hbWUgPSBkaXJlY3RBY2MgPyBwYXJzZUFjY2Vzc1RhZyhkaXJlY3RBY2MpIDogcmVzb2x2ZVBhcnRUYWcocGFydFVJZCk7XG4gICAgICAgIHVpZFRvRWxlbWVudC5zZXQocGFydFVJZCwgeyBraW5kOiAnY29pbCcsIGlkOiBgc2llbWVucy0ke3BhcnRVSWR9YCwgdHlwZTogJ3NldCcsIHRhZzogeyBuYW1lOiB0YWdOYW1lLCBkYXRhVHlwZTogcmVzb2x2ZXIucmVzb2x2ZSh0YWdOYW1lKSB9LCBwb3NpdGlvbjogeyB4OiBwb3NYLCB5OiAwIH0gfSBhcyBDb2lsRWxlbWVudCk7XG4gICAgICAgIHBvc1ggKz0gNjA7IGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBSQ29pbCAoUmVzZXQgQ29pbCkgXHUyMDE0IFRJQSBWMTYrIHVzZXMgUGFydCBOYW1lPVwiUkNvaWxcIlxuICAgICAgaWYgKHVwcGVyTmFtZSA9PT0gJ1JDT0lMJykge1xuICAgICAgICBjb25zdCBkaXJlY3RBY2MgPSBjaGlsZEFycmF5KHBhcnRFbCwgJ0FjY2VzcycpWzBdO1xuICAgICAgICBjb25zdCB0YWdOYW1lID0gZGlyZWN0QWNjID8gcGFyc2VBY2Nlc3NUYWcoZGlyZWN0QWNjKSA6IHJlc29sdmVQYXJ0VGFnKHBhcnRVSWQpO1xuICAgICAgICB1aWRUb0VsZW1lbnQuc2V0KHBhcnRVSWQsIHsga2luZDogJ2NvaWwnLCBpZDogYHNpZW1lbnMtJHtwYXJ0VUlkfWAsIHR5cGU6ICdyZXNldCcsIHRhZzogeyBuYW1lOiB0YWdOYW1lLCBkYXRhVHlwZTogcmVzb2x2ZXIucmVzb2x2ZSh0YWdOYW1lKSB9LCBwb3NpdGlvbjogeyB4OiBwb3NYLCB5OiAwIH0gfSBhcyBDb2lsRWxlbWVudCk7XG4gICAgICAgIHBvc1ggKz0gNjA7IGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBDb250YWN0LXR5cGUgZWxlbWVudHNcbiAgICAgIGlmICh1cHBlck5hbWUgPT09ICdDT05UQUNUJyB8fCBlbGVtVGFnTmFtZSA9PT0gJ0NvbnRhY3QnKSB7XG4gICAgICAgIGNvbnN0IG5lZ2F0ZWQgPSBpc1BhcnROZWdhdGVkKHBhcnRFbCk7XG4gICAgICAgIGNvbnN0IGRpcmVjdEFjYyA9IGNoaWxkQXJyYXkocGFydEVsLCAnQWNjZXNzJylbMF07XG4gICAgICAgIGNvbnN0IHRhZ05hbWUgPSBkaXJlY3RBY2MgPyBwYXJzZUFjY2Vzc1RhZyhkaXJlY3RBY2MpIDogcmVzb2x2ZVBhcnRUYWcocGFydFVJZCk7XG4gICAgICAgIGNvbnN0IGVsOiBDb250YWN0RWxlbWVudCA9IHtcbiAgICAgICAgICBraW5kOiAnY29udGFjdCcsXG4gICAgICAgICAgaWQ6IGBzaWVtZW5zLSR7cGFydFVJZH1gLFxuICAgICAgICAgIHR5cGU6IG5lZ2F0ZWQgPyAnTkMnIDogJ05PJyxcbiAgICAgICAgICB0YWc6IHsgbmFtZTogdGFnTmFtZSwgZGF0YVR5cGU6IHJlc29sdmVyLnJlc29sdmUodGFnTmFtZSkgfSxcbiAgICAgICAgICBwb3NpdGlvbjogeyB4OiBwb3NYLCB5OiAwIH0sXG4gICAgICAgIH07XG4gICAgICAgIHVpZFRvRWxlbWVudC5zZXQocGFydFVJZCwgZWwpO1xuICAgICAgICBwb3NYICs9IDYwO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gUF9DT05UQUNUIC8gTl9DT05UQUNUIChlZGdlIGRldGVjdGlvbiBjb250YWN0cylcbiAgICAgIGlmICh1cHBlck5hbWUgPT09ICdQX0NPTlRBQ1QnIHx8IHVwcGVyTmFtZSA9PT0gJ1BDT05UQUNUJykge1xuICAgICAgICBjb25zdCB0YWdOYW1lID0gcmVzb2x2ZVBhcnRUYWcocGFydFVJZCk7XG4gICAgICAgIHVpZFRvRWxlbWVudC5zZXQocGFydFVJZCwgeyBraW5kOiAnY29udGFjdCcsIGlkOiBgc2llbWVucy0ke3BhcnRVSWR9YCwgdHlwZTogJ1BfQ09OVEFDVCcsIHRhZzogeyBuYW1lOiB0YWdOYW1lLCBkYXRhVHlwZTogcmVzb2x2ZXIucmVzb2x2ZSh0YWdOYW1lKSB9LCBwb3NpdGlvbjogeyB4OiBwb3NYLCB5OiAwIH0gfSBhcyBDb250YWN0RWxlbWVudCk7XG4gICAgICAgIHBvc1ggKz0gNjA7IGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaWYgKHVwcGVyTmFtZSA9PT0gJ05fQ09OVEFDVCcgfHwgdXBwZXJOYW1lID09PSAnTkNPTlRBQ1QnKSB7XG4gICAgICAgIGNvbnN0IHRhZ05hbWUgPSByZXNvbHZlUGFydFRhZyhwYXJ0VUlkKTtcbiAgICAgICAgdWlkVG9FbGVtZW50LnNldChwYXJ0VUlkLCB7IGtpbmQ6ICdjb250YWN0JywgaWQ6IGBzaWVtZW5zLSR7cGFydFVJZH1gLCB0eXBlOiAnTl9DT05UQUNUJywgdGFnOiB7IG5hbWU6IHRhZ05hbWUsIGRhdGFUeXBlOiByZXNvbHZlci5yZXNvbHZlKHRhZ05hbWUpIH0sIHBvc2l0aW9uOiB7IHg6IHBvc1gsIHk6IDAgfSB9IGFzIENvbnRhY3RFbGVtZW50KTtcbiAgICAgICAgcG9zWCArPSA2MDsgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIENvaWwtdHlwZSBlbGVtZW50c1xuICAgICAgaWYgKHVwcGVyTmFtZSA9PT0gJ0NPSUwnIHx8IGVsZW1UYWdOYW1lID09PSAnQ29pbCcpIHtcbiAgICAgICAgY29uc3QgbmVnYXRlZCA9IGlzUGFydE5lZ2F0ZWQocGFydEVsKTtcbiAgICAgICAgY29uc3QgZGlyZWN0QWNjID0gY2hpbGRBcnJheShwYXJ0RWwsICdBY2Nlc3MnKVswXTtcbiAgICAgICAgY29uc3QgdGFnTmFtZSA9IGRpcmVjdEFjYyA/IHBhcnNlQWNjZXNzVGFnKGRpcmVjdEFjYykgOiByZXNvbHZlUGFydFRhZyhwYXJ0VUlkKTtcbiAgICAgICAgdWlkVG9FbGVtZW50LnNldChwYXJ0VUlkLCB7IGtpbmQ6ICdjb2lsJywgaWQ6IGBzaWVtZW5zLSR7cGFydFVJZH1gLCB0eXBlOiBuZWdhdGVkID8gJ25lZ2F0ZWQnIDogJ25vcm1hbCcsIHRhZzogeyBuYW1lOiB0YWdOYW1lLCBkYXRhVHlwZTogcmVzb2x2ZXIucmVzb2x2ZSh0YWdOYW1lKSB9LCBwb3NpdGlvbjogeyB4OiBwb3NYLCB5OiAwIH0gfSBhcyBDb2lsRWxlbWVudCk7XG4gICAgICAgIHBvc1ggKz0gNjA7IGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAodXBwZXJOYW1lID09PSAnU0VUQ09JTCcgfHwgZWxlbVRhZ05hbWUgPT09ICdTZXRDb2lsJykge1xuICAgICAgICBjb25zdCBkaXJlY3RBY2MgPSBjaGlsZEFycmF5KHBhcnRFbCwgJ0FjY2VzcycpWzBdO1xuICAgICAgICBjb25zdCB0YWdOYW1lID0gZGlyZWN0QWNjID8gcGFyc2VBY2Nlc3NUYWcoZGlyZWN0QWNjKSA6IHJlc29sdmVQYXJ0VGFnKHBhcnRVSWQpO1xuICAgICAgICB1aWRUb0VsZW1lbnQuc2V0KHBhcnRVSWQsIHsga2luZDogJ2NvaWwnLCBpZDogYHNpZW1lbnMtJHtwYXJ0VUlkfWAsIHR5cGU6ICdzZXQnLCB0YWc6IHsgbmFtZTogdGFnTmFtZSwgZGF0YVR5cGU6IHJlc29sdmVyLnJlc29sdmUodGFnTmFtZSkgfSwgcG9zaXRpb246IHsgeDogcG9zWCwgeTogMCB9IH0gYXMgQ29pbEVsZW1lbnQpO1xuICAgICAgICBwb3NYICs9IDYwOyBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHVwcGVyTmFtZSA9PT0gJ1JFU0VUQ09JTCcgfHwgZWxlbVRhZ05hbWUgPT09ICdSZXNldENvaWwnKSB7XG4gICAgICAgIGNvbnN0IGRpcmVjdEFjYyA9IGNoaWxkQXJyYXkocGFydEVsLCAnQWNjZXNzJylbMF07XG4gICAgICAgIGNvbnN0IHRhZ05hbWUgPSBkaXJlY3RBY2MgPyBwYXJzZUFjY2Vzc1RhZyhkaXJlY3RBY2MpIDogcmVzb2x2ZVBhcnRUYWcocGFydFVJZCk7XG4gICAgICAgIHVpZFRvRWxlbWVudC5zZXQocGFydFVJZCwgeyBraW5kOiAnY29pbCcsIGlkOiBgc2llbWVucy0ke3BhcnRVSWR9YCwgdHlwZTogJ3Jlc2V0JywgdGFnOiB7IG5hbWU6IHRhZ05hbWUsIGRhdGFUeXBlOiByZXNvbHZlci5yZXNvbHZlKHRhZ05hbWUpIH0sIHBvc2l0aW9uOiB7IHg6IHBvc1gsIHk6IDAgfSB9IGFzIENvaWxFbGVtZW50KTtcbiAgICAgICAgcG9zWCArPSA2MDsgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIENhbGwgLyBJRUMgZnVuY3Rpb24gYmxvY2tzXG4gICAgICBpZiAoZWxlbVRhZ05hbWUgPT09ICdDYWxsJyB8fCB1cHBlck5hbWUgPT09ICdDQUxMJykge1xuICAgICAgICBjb25zdCBjYWxsSW5mbyA9IGNoaWxkKHBhcnRFbCwgJ0NhbGxJbmZvJyk7XG4gICAgICAgIGNvbnN0IGJsb2NrTmFtZSA9IGF0dHIoY2FsbEluZm8sICdOYW1lJykgfHwgJyc7XG4gICAgICAgIGNvbnN0IGJsb2NrVHlwZSA9IGF0dHIoY2FsbEluZm8sICdCbG9ja1R5cGUnKSB8fCAnJzsgLy8gRkIsIEZDLCBldGMuXG4gICAgICAgIGNvbnN0IG1ldGEgPSBtYXBTaWVtZW5zRkJUeXBlV2l0aE1ldGEoYmxvY2tOYW1lKTtcbiAgICAgICAgLy8gRm9yIEZCL0ZDIGNhbGxzIHRoYXQgZG9uJ3QgbWFwIHRvIElFQyBzdGFuZGFyZCBibG9ja3MsIHRyZWF0IGFzIGdlbmVyaWMgTU9WRSBwbGFjZWhvbGRlclxuICAgICAgICBjb25zdCBmYlR5cGUgPSBtZXRhID8gbWV0YS5mYlR5cGUgOiAnTU9WRScgYXMgRkJUeXBlO1xuICAgICAgICBjb25zdCBzdG9yZU9yaWdpbmFsID0gbWV0YSA/IG1ldGEuc3RvcmVPcmlnaW5hbCA6IHRydWU7XG4gICAgICAgIC8vIEluc3RhbmNlIGNhbiBiZSBlaXRoZXIgTmFtZSBhdHRyaWJ1dGUgb3IgQ29tcG9uZW50IGNoaWxkXG4gICAgICAgIGNvbnN0IGluc3RhbmNlRWwgPSBjaGlsZChjYWxsSW5mbywgJ0luc3RhbmNlJyk7XG4gICAgICAgIGNvbnN0IGluc3RhbmNlQ29tcG9uZW50ID0gY2hpbGQoaW5zdGFuY2VFbCwgJ0NvbXBvbmVudCcpO1xuICAgICAgICBjb25zdCBpbnN0YW5jZU5hbWUgPSBhdHRyKGluc3RhbmNlQ29tcG9uZW50LCAnTmFtZScpIHx8IGF0dHIoaW5zdGFuY2VFbCwgJ05hbWUnKSB8fCBibG9ja05hbWU7XG4gICAgICAgIGNvbnN0IGJsazogQmxvY2tFbGVtZW50ID0geyBraW5kOiAnYmxvY2snLCBpZDogYHNpZW1lbnMtJHtwYXJ0VUlkfWAsIGZiVHlwZSwgaW5zdGFuY2VOYW1lLCBwaW5zOiB7fSwgcG9zaXRpb246IHsgeDogcG9zWCwgeTogMCB9IH07XG4gICAgICAgIGlmIChzdG9yZU9yaWdpbmFsKSBibGsudmVuZG9yT3JpZ2luYWxOYW1lID0gYmxvY2tOYW1lO1xuICAgICAgICAvLyBTdG9yZSBCbG9ja1R5cGUgYW5kIFBhcmFtZXRlciBpbmZvIGZvciByb3VuZC10cmlwXG4gICAgICAgIChibGsgYXMgYW55KS52ZW5kb3JCbG9ja1R5cGUgPSBibG9ja1R5cGU7XG4gICAgICAgIC8vIEV4dHJhY3QgcGFyYW1ldGVyIGRlY2xhcmF0aW9ucyBmb3IgcGluIG1hcHBpbmcgKHN0b3JlIGFzIFRhZ1JlZiBmb3IgdHlwZSBjb21wYXQpXG4gICAgICAgIGNvbnN0IHBhcmFtcyA9IGNoaWxkQXJyYXkoY2FsbEluZm8sICdQYXJhbWV0ZXInKTtcbiAgICAgICAgZm9yIChjb25zdCBwYXJhbSBvZiBwYXJhbXMpIHtcbiAgICAgICAgICBjb25zdCBwTmFtZSA9IGF0dHIocGFyYW0sICdOYW1lJykgfHwgJyc7XG4gICAgICAgICAgY29uc3QgcFNlY3Rpb24gPSBhdHRyKHBhcmFtLCAnU2VjdGlvbicpIHx8ICcnO1xuICAgICAgICAgIGNvbnN0IHBUeXBlID0gYXR0cihwYXJhbSwgJ1R5cGUnKSB8fCAnQm9vbCc7XG4gICAgICAgICAgaWYgKHBOYW1lKSB7XG4gICAgICAgICAgICBibGsucGluc1twTmFtZV0gPSB7IG5hbWU6IHBOYW1lLCBkYXRhVHlwZTogc2llbWVuc1R5cGVUb0lFQyhwVHlwZSkgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdWlkVG9FbGVtZW50LnNldChwYXJ0VUlkLCBibGspO1xuICAgICAgICBwb3NYICs9IDYwOyBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gUGFydCBOYW1lPVwiVE9OXCIgZXRjIFx1MjAxNCBJRUMgRkIgYXMgUGFydCBlbGVtZW50IChUSUEgVjE2KylcbiAgICAgIGlmIChlbGVtVGFnTmFtZSA9PT0gJ1BhcnQnKSB7XG4gICAgICAgIGNvbnN0IG1ldGEgPSBtYXBTaWVtZW5zRkJUeXBlV2l0aE1ldGEocGFydE5hbWUpO1xuICAgICAgICBpZiAobWV0YSkge1xuICAgICAgICAgIGNvbnN0IGluc3RhbmNlTmFtZSA9IHJlc29sdmVQYXJ0VGFnKHBhcnRVSWQpIHx8IHBhcnROYW1lO1xuICAgICAgICAgIGNvbnN0IGJsazogQmxvY2tFbGVtZW50ID0geyBraW5kOiAnYmxvY2snLCBpZDogYHNpZW1lbnMtJHtwYXJ0VUlkfWAsIGZiVHlwZTogbWV0YS5mYlR5cGUsIGluc3RhbmNlTmFtZSwgcGluczoge30sIHBvc2l0aW9uOiB7IHg6IHBvc1gsIHk6IDAgfSB9O1xuICAgICAgICAgIGlmIChtZXRhLnN0b3JlT3JpZ2luYWwpIGJsay52ZW5kb3JPcmlnaW5hbE5hbWUgPSBwYXJ0TmFtZTtcbiAgICAgICAgICB1aWRUb0VsZW1lbnQuc2V0KHBhcnRVSWQsIGJsayk7XG4gICAgICAgICAgcG9zWCArPSA2MDsgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gVW5rbm93biBQYXJ0IFx1MjAxNCBza2lwIHNpbGVudGx5IChBY2Nlc3MvdmFyaWFibGUgbm9kZXMsIGV0Yy4pXG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gUGFyc2Ugd2lyZXMgdG8gZGV0ZXJtaW5lIG9yZGVyaW5nIGFuZCBwYXJhbGxlbCBicmFuY2hlc1xuICAgIGNvbnN0IHdpcmVDb25uczogV2lyZUNvbm5lY3Rpb25bXSA9IFtdO1xuICAgIGlmICh3aXJlc05vZGUpIHtcbiAgICAgIGZvciAoY29uc3Qgd2lyZUVsIG9mIHJhd1dpcmVzKSB7XG4gICAgICAgIGNvbnN0IG5hbWVDb25zID0gY2hpbGRBcnJheSh3aXJlRWwsICdOYW1lQ29uJyk7XG4gICAgICAgIGNvbnN0IGlkZW50Q29ucyA9IGNoaWxkQXJyYXkod2lyZUVsLCAnSWRlbnRDb24nKTtcbiAgICAgICAgLy8gUG93ZXJyYWlsIGVsZW1lbnQgaW4gd2lyZSBhY3RzIGFzIGxlZnQtcmFpbCBzb3VyY2VcbiAgICAgICAgY29uc3QgaGFzUG93ZXJyYWlsID0gY2hpbGRBcnJheSh3aXJlRWwsICdQb3dlcnJhaWwnKS5sZW5ndGggPiAwO1xuICAgICAgICBjb25zdCBhbGxDb25zID0gWy4uLm5hbWVDb25zLCAuLi5pZGVudENvbnNdO1xuICAgICAgICBpZiAoaGFzUG93ZXJyYWlsICYmIGFsbENvbnMubGVuZ3RoID49IDEpIHtcbiAgICAgICAgICAvLyBUcmVhdCBwb3dlcnJhaWwgYXMgc3ludGhldGljIHNvdXJjZSB1aWQgJ3Bvd2VycmFpbCdcbiAgICAgICAgICB3aXJlQ29ubnMucHVzaCh7IGZyb21VSWQ6ICdwb3dlcnJhaWwnLCBmcm9tUGluOiAnb3V0JywgdG9VSWQ6IGF0dHIoYWxsQ29uc1swXSwgJ1VJZCcpIHx8ICcnLCB0b1BpbjogYXR0cihhbGxDb25zWzBdLCAnTmFtZScpIHx8ICdpbicgfSk7XG4gICAgICAgICAgZm9yIChsZXQgd2kgPSAxOyB3aSA8IGFsbENvbnMubGVuZ3RoOyB3aSsrKSB7XG4gICAgICAgICAgICB3aXJlQ29ubnMucHVzaCh7IGZyb21VSWQ6ICdwb3dlcnJhaWwnLCBmcm9tUGluOiAnb3V0JywgdG9VSWQ6IGF0dHIoYWxsQ29uc1t3aV0sICdVSWQnKSB8fCAnJywgdG9QaW46ICdpbicgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFsbENvbnMubGVuZ3RoID49IDIpIHtcbiAgICAgICAgICBjb25zdCBmcm9tRWwgPSBhbGxDb25zWzBdO1xuICAgICAgICAgIGNvbnN0IHRvRWwgPSBhbGxDb25zWzFdO1xuICAgICAgICAgIHdpcmVDb25ucy5wdXNoKHtcbiAgICAgICAgICAgIGZyb21VSWQ6IGF0dHIoZnJvbUVsLCAnVUlkJykgfHwgJycsXG4gICAgICAgICAgICBmcm9tUGluOiBhdHRyKGZyb21FbCwgJ05hbWUnKSB8fCAnb3V0JyxcbiAgICAgICAgICAgIHRvVUlkOiBhdHRyKHRvRWwsICdVSWQnKSB8fCAnJyxcbiAgICAgICAgICAgIHRvUGluOiBhdHRyKHRvRWwsICdOYW1lJykgfHwgJ2luJyxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICAvLyBJZiB0aGVyZSBhcmUgbW9yZSB0aGFuIDIgY29ubmVjdGlvbnMgb24gYSB3aXJlLCBpdCdzIGEgYnJhbmNoIHBvaW50XG4gICAgICAgICAgZm9yIChsZXQgd2kgPSAyOyB3aSA8IGFsbENvbnMubGVuZ3RoOyB3aSsrKSB7XG4gICAgICAgICAgICB3aXJlQ29ubnMucHVzaCh7XG4gICAgICAgICAgICAgIGZyb21VSWQ6IGF0dHIoZnJvbUVsLCAnVUlkJykgfHwgJycsXG4gICAgICAgICAgICAgIGZyb21QaW46IGF0dHIoZnJvbUVsLCAnTmFtZScpIHx8ICdvdXQnLFxuICAgICAgICAgICAgICB0b1VJZDogYXR0cihhbGxDb25zW3dpXSwgJ1VJZCcpIHx8ICcnLFxuICAgICAgICAgICAgICB0b1BpbjogYXR0cihhbGxDb25zW3dpXSwgJ05hbWUnKSB8fCAnaW4nLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gVXNlIHdpcmVzIHRvIG9yZGVyIGVsZW1lbnRzOiBCRlMgZnJvbSBwb3dlcnJhaWwgKG9yIGVsZW1lbnRzIHdpdGggbm8gaW5jb21pbmcpXG4gICAgLy8gRWxlbWVudHMgY29ubmVjdGVkIGZyb20gcG93ZXJyYWlsIGFyZSBleHBsaWNpdCByb290cyBldmVuIGlmIHRoZXkgYXBwZWFyIGluIGhhc0luY29taW5nXG4gICAgY29uc3QgcG93ZXJyYWlsVGFyZ2V0cyA9IG5ldyBTZXQod2lyZUNvbm5zLmZpbHRlcih3ID0+IHcuZnJvbVVJZCA9PT0gJ3Bvd2VycmFpbCcpLm1hcCh3ID0+IHcudG9VSWQpKTtcbiAgICBjb25zdCBoYXNJbmNvbWluZyA9IG5ldyBTZXQod2lyZUNvbm5zLmZpbHRlcih3ID0+IHcuZnJvbVVJZCAhPT0gJ3Bvd2VycmFpbCcpLm1hcCh3ID0+IHcudG9VSWQpKTtcbiAgICBjb25zdCByb290cyA9IFsuLi51aWRUb0VsZW1lbnQua2V5cygpXS5maWx0ZXIodWlkID0+ICFoYXNJbmNvbWluZy5oYXModWlkKSB8fCBwb3dlcnJhaWxUYXJnZXRzLmhhcyh1aWQpKTtcbiAgICBjb25zdCBvdXRFZGdlcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmdbXT4oKTtcbiAgICBmb3IgKGNvbnN0IHcgb2Ygd2lyZUNvbm5zKSB7XG4gICAgICBpZiAoIW91dEVkZ2VzLmhhcyh3LmZyb21VSWQpKSBvdXRFZGdlcy5zZXQody5mcm9tVUlkLCBbXSk7XG4gICAgICBvdXRFZGdlcy5nZXQody5mcm9tVUlkKSEucHVzaCh3LnRvVUlkKTtcbiAgICB9XG5cbiAgICAvLyBEZXRlY3QgYnJhbmNoZXM6IGlmIGEgc2luZ2xlIHNvdXJjZSBoYXMgbXVsdGlwbGUgb3V0Z29pbmcgY29ubmVjdGlvbnMsIHRob3NlIGZvcm0gcGFyYWxsZWwgcGF0aHNcbiAgICBjb25zdCBicmFuY2hlczogQnJhbmNoW10gPSBbXTtcbiAgICBjb25zdCBtYWluRWxlbWVudHM6IExhZGRlckVsZW1lbnRbXSA9IFtdO1xuICAgIGNvbnN0IHZpc2l0ZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICAgIGZ1bmN0aW9uIHdhbGtDaGFpbihzdGFydFVJZDogc3RyaW5nKTogTGFkZGVyRWxlbWVudFtdIHtcbiAgICAgIGNvbnN0IGNoYWluOiBMYWRkZXJFbGVtZW50W10gPSBbXTtcbiAgICAgIGxldCBjdXJyZW50ID0gc3RhcnRVSWQ7XG4gICAgICB3aGlsZSAoY3VycmVudCAmJiAhdmlzaXRlZC5oYXMoY3VycmVudCkpIHtcbiAgICAgICAgdmlzaXRlZC5hZGQoY3VycmVudCk7XG4gICAgICAgIGNvbnN0IGVsID0gdWlkVG9FbGVtZW50LmdldChjdXJyZW50KTtcbiAgICAgICAgaWYgKGVsKSBjaGFpbi5wdXNoKGVsKTtcbiAgICAgICAgY29uc3QgbmV4dHMgPSBvdXRFZGdlcy5nZXQoY3VycmVudCkgfHwgW107XG4gICAgICAgIGlmIChuZXh0cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICBjdXJyZW50ID0gbmV4dHNbMF07XG4gICAgICAgIH0gZWxzZSBpZiAobmV4dHMubGVuZ3RoID4gMSkge1xuICAgICAgICAgIC8vIEJyYW5jaCBwb2ludCBcdTIwMTQgY3JlYXRlIGJyYW5jaGVzIGZvciBlYWNoIHBhdGhcbiAgICAgICAgICBmb3IgKGNvbnN0IG5leHRVSWQgb2YgbmV4dHMpIHtcbiAgICAgICAgICAgIGlmICghdmlzaXRlZC5oYXMobmV4dFVJZCkpIHtcbiAgICAgICAgICAgICAgY29uc3QgYnJhbmNoRWxlbWVudHMgPSB3YWxrQ2hhaW4obmV4dFVJZCk7XG4gICAgICAgICAgICAgIGlmIChicmFuY2hFbGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgYnJhbmNoZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICBpZDogZ2VuSWQoYGJyYW5jaC0ke3BvdUlkfS1yJHtydW5nSWR4fWApLFxuICAgICAgICAgICAgICAgICAgc3RhcnROb2RlSWQ6IGN1cnJlbnQsXG4gICAgICAgICAgICAgICAgICBlbmROb2RlSWQ6IGJyYW5jaEVsZW1lbnRzW2JyYW5jaEVsZW1lbnRzLmxlbmd0aCAtIDFdPy5pZCB8fCBjdXJyZW50LFxuICAgICAgICAgICAgICAgICAgZWxlbWVudHM6IGJyYW5jaEVsZW1lbnRzLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gY2hhaW47XG4gICAgfVxuXG4gICAgaWYgKHJvb3RzLmxlbmd0aCA+IDApIHtcbiAgICAgIGZvciAoY29uc3Qgcm9vdFVJZCBvZiByb290cykge1xuICAgICAgICBpZiAoIXZpc2l0ZWQuaGFzKHJvb3RVSWQpKSB7XG4gICAgICAgICAgbWFpbkVsZW1lbnRzLnB1c2goLi4ud2Fsa0NoYWluKHJvb3RVSWQpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBObyBjbGVhciByb290IFx1MjAxNCB1c2UgYWxsIGVsZW1lbnRzIGluIG1hcCBvcmRlclxuICAgICAgbWFpbkVsZW1lbnRzLnB1c2goLi4udWlkVG9FbGVtZW50LnZhbHVlcygpKTtcbiAgICB9XG5cbiAgICAvLyBBZGQgYW55IHJlbWFpbmluZyB1bnZpc2l0ZWQgZWxlbWVudHNcbiAgICBmb3IgKGNvbnN0IFt1aWQsIGVsXSBvZiB1aWRUb0VsZW1lbnQpIHtcbiAgICAgIGlmICghdmlzaXRlZC5oYXModWlkKSkgbWFpbkVsZW1lbnRzLnB1c2goZWwpO1xuICAgIH1cblxuICAgIHJ1bmdzLnB1c2goe1xuICAgICAgaWQ6IGAke3BvdUlkfS1ydW5nLSR7cnVuZ0lkeH1gLFxuICAgICAgbnVtYmVyOiBydW5nSWR4LFxuICAgICAgY29tbWVudCxcbiAgICAgIGVsZW1lbnRzOiBtYWluRWxlbWVudHMsXG4gICAgICBicmFuY2hlcyxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB7IHJ1bmdzIH07XG59XG5cbmZ1bmN0aW9uIHBhcnNlQWNjZXNzVGFnKGFjY2Vzc0VsOiB1bmtub3duKTogc3RyaW5nIHtcbiAgaWYgKCFhY2Nlc3NFbCB8fCB0eXBlb2YgYWNjZXNzRWwgIT09ICdvYmplY3QnKSByZXR1cm4gJ1VOS05PV05fVEFHJztcbiAgY29uc3Qgc3ltYm9sRWwgPSBjaGlsZChhY2Nlc3NFbCwgJ1N5bWJvbCcpO1xuICBpZiAoc3ltYm9sRWwpIHtcbiAgICBjb25zdCBjb21wb25lbnRzID0gY2hpbGRBcnJheShzeW1ib2xFbCwgJ0NvbXBvbmVudCcpO1xuICAgIGlmIChjb21wb25lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiBjb21wb25lbnRzLm1hcChjID0+IGF0dHIoYywgJ05hbWUnKSkuZmlsdGVyKEJvb2xlYW4pLmpvaW4oJy4nKTtcbiAgICB9XG4gICAgY29uc3QgbmFtZSA9IGF0dHIoc3ltYm9sRWwsICdOYW1lJyk7XG4gICAgaWYgKG5hbWUpIHJldHVybiBuYW1lO1xuICB9XG4gIC8vIEZhbGxiYWNrIHRvIE5hbWUgYXR0cmlidXRlIG9uIEFjY2VzcyBlbGVtZW50IGl0c2VsZlxuICByZXR1cm4gYXR0cihhY2Nlc3NFbCwgJ05hbWUnKSB8fCAnVEFHJztcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFNpZW1lbnMgXHUyMTkyIENMTSBGQiB0eXBlIG1hcHMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vL1xuLy8gU0lFTUVOU19GQl9NQVA6IHVzZWQgZm9yIExBRCBibG9ja3MgKHJldHVybnMgRkJUeXBlLCB1c2VkIGluIEJsb2NrRWxlbWVudC5mYlR5cGUpXG4vLyBTSUVNRU5TX0ZCRF9NQVA6IHVzZWQgZm9yIEZCRCBibG9ja3MgKHJldHVybnMgRkJEQmxvY2tUeXBlLCB1c2VkIGluIEZCRE5vZGUudHlwZSlcbi8vXG4vLyBTdHJhdGVneTpcbi8vICAgLSBEaXJlY3QgSUVDIGVxdWl2YWxlbnRzIFx1MjE5MiBtYXAgdG8gdGhlIElFQyBjYW5vbmljYWwgbmFtZVxuLy8gICAtIFNpZW1lbnMtc3BlY2lmaWMgdHlwZXMgbm93IGluIHRoZSBleHRlbmRlZCBGQlR5cGUvRkJEQmxvY2tUeXBlIHVuaW9uIFx1MjE5MiBtYXAgZGlyZWN0bHlcbi8vICAgLSBUeXBlcyB3aXRoIG5vIENMTSByZXByZXNlbnRhdGlvbiBcdTIxOTIgbWFwIHRvIGNsb3Nlc3Qgc2VtYW50aWMgZXF1aXZhbGVudFxuLy8gICAgIEFORCBzZXQgdmVuZG9yT3JpZ2luYWxOYW1lIHNvIHRoZSBleHBvcnQgY2FuIHJlY29uc3RydWN0IHRoZSBvcmlnaW5hbCBuYW1lXG4vL1xuLy8gQWxsIGxvb2t1cHMgYXJlIGNhc2UtaW5zZW5zaXRpdmUgKGNhbGxlciBkb2VzIC50b1VwcGVyQ2FzZSgpKS5cblxuY29uc3QgU0lFTUVOU19GQl9NQVA6IFJlY29yZDxzdHJpbmcsIEZCVHlwZT4gPSB7XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFN0YW5kYXJkIElFQyB0aW1lcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIFRPTjogJ1RPTicsIFRPRjogJ1RPRicsIFRQOiAnVFAnLFxuICAvLyBSZXRlbnRpdmUgdGltZXIgKFNpZW1lbnMgZXh0ZW5zaW9uLCBub3cgZmlyc3QtY2xhc3MpXG4gIFRPTlI6ICdUT05SJyxcbiAgLy8gR2VuZXJpYyBJRUMgdGltZXIgaW5zdGFuY2UgbmFtZXMgVElBIFBvcnRhbCB1c2VzXG4gIElFQ19USU1FUjogJ0lFQ19USU1FUicsIElFQ19MVElNRVI6ICdJRUNfTFRJTUVSJyxcbiAgLy8gVElBIFBvcnRhbCBWMTcrIG5hbWUgYWxpYXNlc1xuICAnU0ZCMyc6ICdUT04nLCAnU0ZCNCc6ICdUT0YnLCAnU0ZCNSc6ICdUUCcsXG5cbiAgLy8gXHUyNTAwXHUyNTAwIFN0YW5kYXJkIElFQyBjb3VudGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgQ1RVOiAnQ1RVJywgQ1REOiAnQ1REJywgQ1RVRDogJ0NUVUQnLFxuICBJRUNfQ09VTlRFUjogJ0lFQ19DT1VOVEVSJywgSUVDX0xDT1VOVEVSOiAnSUVDX0xDT1VOVEVSJyxcbiAgLy8gSUVDIHRpbWVyIGNvbnRhY3QgKHRpbWVyIG91dHB1dCBjb250YWN0IHVzZWQgaW4gVElBIFBvcnRhbCBHUkFQSClcbiAgSUVDX1RDOiAnSUVDX1RDJyxcblxuICAvLyBcdTI1MDBcdTI1MDAgQmlzdGFibGUgbGF0Y2hlcyAvIGVkZ2UgZGV0ZWN0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBTUjogJ1NSJywgUlM6ICdSUycsXG4gIFJfVFJJRzogJ1JUUklHJywgRl9UUklHOiAnRlRSSUcnLFxuICBSVFJJRzogJ1JUUklHJywgRlRSSUc6ICdGVFJJRycsXG5cbiAgLy8gXHUyNTAwXHUyNTAwIEJvb2xlYW4gZ2F0ZSBGQnMgKHVzZWQgaW4gRkJELXN0eWxlIExBRCBvbiBTNy0zMDAvNDAwKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgQU5EOiAnQU5EJywgT1I6ICdPUicsIE5PVDogJ05PVCcsIFhPUjogJ1hPUicsXG5cbiAgLy8gXHUyNTAwXHUyNTAwIEFyaXRobWV0aWMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIEFERDogJ0FERCcsIFNVQjogJ1NVQicsIE1VTDogJ01VTCcsIERJVjogJ0RJVicsIE1PRDogJ01PRCcsXG4gIEFCUzogJ0FCUycsIFNRUlQ6ICdTUVJUJywgTkVHOiAnTkVHJyxcbiAgTE46ICdMTicsIExPRzogJ0xPRycsIEVYUDogJ0VYUCcsXG4gIFNJTjogJ1NJTicsIENPUzogJ0NPUycsIFRBTjogJ1RBTicsXG4gIEFTSU46ICdBU0lOJywgQUNPUzogJ0FDT1MnLCBBVEFOOiAnQVRBTicsXG4gIEFUTjogJ0FUQU4nLCBBU046ICdBU0lOJywgQUNTOiAnQUNPUycsICAvLyBhbHRlcm5hdGUgc3BlbGxpbmdzXG5cbiAgLy8gXHUyNTAwXHUyNTAwIENvbXBhcmlzb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIEdUOiAnR1QnLCBHRTogJ0dFJywgTFQ6ICdMVCcsIExFOiAnTEUnLCBFUTogJ0VRJywgTkU6ICdORScsXG4gIENNUDogJ0VRJywgIC8vIGdlbmVyaWMgY29tcGFyZSBcdTIxOTIgRVFcblxuICAvLyBcdTI1MDBcdTI1MDAgRGF0YSAvIHNlbGVjdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgTU9WRTogJ01PVkUnLCBTRUw6ICdTRUwnLCBNVVg6ICdTRUwnLCBMSU1JVDogJ0xJTUlUJyxcbiAgTUlOOiAnTUlOJywgTUFYOiAnTUFYJyxcblxuICAvLyBcdTI1MDBcdTI1MDAgQmxpbmsgLyBvc2NpbGxhdG9yIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBCTElOSzogJ0JMSU5LJyxcblxuICAvLyBcdTI1MDBcdTI1MDAgQW5hbG9nIHNjYWxpbmcgLyBub3JtYWxpc2F0aW9uIChTaWVtZW5zLXNwZWNpZmljLCBub3cgZmlyc3QtY2xhc3MpIFx1MjUwMFxuICBTQ0FMRTogJ1NDQUxFJywgVU5TQ0FMRTogJ1VOU0NBTEUnLFxuICBOT1JNX1g6ICdOT1JNX1gnLCBTQ0FMRV9YOiAnU0NBTEVfWCcsXG4gIC8vIE9sZGVyIFM3IFNGQiBuYW1lc1xuICBGQzEwNTogJ1NDQUxFJywgRkMxMDY6ICdVTlNDQUxFJyxcblxuICAvLyBcdTI1MDBcdTI1MDAgU3RyaW5nIGZ1bmN0aW9ucyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgTEVOOiAnTEVOJywgTEVGVDogJ0xFRlQnLCBSSUdIVDogJ1JJR0hUJywgTUlEOiAnTUlEJyxcbiAgQ09OQ0FUOiAnQ09OQ0FUJywgRklORDogJ0ZJTkQnLCBJTlNFUlQ6ICdJTlNFUlQnLCBERUxFVEU6ICdERUxFVEUnLCBSRVBMQUNFOiAnUkVQTEFDRScsXG4gIFVQUEVSX0NBU0U6ICdVUFBFUl9DQVNFJywgTE9XRVJfQ0FTRTogJ0xPV0VSX0NBU0UnLFxuICAvLyBTaWVtZW5zIFNfeHh4IHN0cmluZyBGQiBuYW1lcyAoUzcgY2xhc3NpYylcbiAgU19MRU46ICdMRU4nLCBTX0xFRlQ6ICdMRUZUJywgU19SSUdIVDogJ1JJR0hUJywgU19NSUQ6ICdNSUQnLFxuICBTX0ZJTkQ6ICdGSU5EJywgU19DT05WOiAnTU9WRScsIFNfQ09OQ0FUOiAnQ09OQ0FUJyxcblxuICAvLyBcdTI1MDBcdTI1MDAgQ29tbXVuaWNhdGlvbiBGQnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIC8vIE1hcCB0byB0aGUgZXh0ZW5kZWQgRkJUeXBlIG1lbWJlcnMgYWRkZWQgYWJvdmVcbiAgU0VORDogJ1NFTkQnLCBSRUNWOiAnUkVDVicsXG4gIFJEUkVDOiAnUkRSRUMnLCBXUlJFQzogJ1dSUkVDJyxcbiAgLy8gQ29tbW9uIFNpZW1lbnMgUHJvZmluZXQgLyBJbmR1c3RyaWFsIEV0aGVybmV0IEZCIG5hbWVzXG4gIFRTRU5EOiAnU0VORCcsIFRSQ1Y6ICdSRUNWJywgVENPTjogJ1NFTkQnLCBURElTQ09OOiAnUkVDVicsXG4gICdUU0VORF9DJzogJ1NFTkQnLCAnVFJDVl9DJzogJ1JFQ1YnLFxuICAnRFBSRF9EQVQnOiAnUkRSRUMnLCAnRFBXUl9EQVQnOiAnV1JSRUMnLFxuICAnRkI2NSc6ICdTRU5EJywgJ0ZCNjYnOiAnUkVDVicsXG5cbiAgLy8gXHUyNTAwXHUyNTAwIFR5cGUgY29udmVyc2lvbiBGQnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIC8vIFNpZW1lbnMgdXNlcyBDT05WRVJUIHdpdGggdGVtcGxhdGUgdHlwZXM7IG1hcCBnZW5lcmljYWxseVxuICBDT05WRVJUOiAnTU9WRScsXG4gIFJPVU5EOiAnTU9WRScsIFRSVU5DOiAnTU9WRScsIENFSUw6ICdNT1ZFJywgRkxPT1I6ICdNT1ZFJyxcbiAgLy8gRXhwbGljaXQgdHlwZSBjb252ZXJzaW9uc1xuICBJTlRfVE9fUkVBTDogJ01PVkUnLCBSRUFMX1RPX0lOVDogJ01PVkUnLCBESU5UX1RPX1JFQUw6ICdNT1ZFJywgUkVBTF9UT19ESU5UOiAnTU9WRScsXG4gIElOVF9UT19ESU5UOiAnTU9WRScsIEJPT0xfVE9fSU5UOiAnTU9WRScsIElOVF9UT19CT09MOiAnTU9WRScsXG4gIFdPUkRfVE9fSU5UOiAnTU9WRScsIElOVF9UT19XT1JEOiAnTU9WRScsIERXT1JEX1RPX0RJTlQ6ICdNT1ZFJywgRElOVF9UT19EV09SRDogJ01PVkUnLFxuICBUSU1FX1RPX0RJTlQ6ICdNT1ZFJywgRElOVF9UT19USU1FOiAnTU9WRScsXG5cbiAgLy8gXHUyNTAwXHUyNTAwIERpYWdub3N0aWMgLyBzeXN0ZW0gRkJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAvLyBNYXAgdG8gTU9WRSBhcyBhIHNhZmUgcGxhY2Vob2xkZXIgKHByZXNlcnZlcyBibG9jayBzaGFwZSwgdmVuZG9yT3JpZ2luYWxOYW1lIHN0b3JlZClcbiAgQUxBUk06ICdNT1ZFJywgQUxBUk1fODogJ01PVkUnLCBBTEFSTV84UDogJ01PVkUnLCBOT1RJRlk6ICdNT1ZFJyxcbiAgQVJfU0VORDogJ01PVkUnLCBCTEtNT1Y6ICdNT1ZFJyxcbiAgUkVBRF9EQkw6ICdSRFJFQycsIFdSSVRfREJMOiAnV1JSRUMnLFxufTtcblxuZnVuY3Rpb24gbWFwU2llbWVuc0ZCVHlwZShuYW1lOiBzdHJpbmcpOiBGQlR5cGUgfCBudWxsIHtcbiAgY29uc3QgdXBwZXIgPSBuYW1lLnRvVXBwZXJDYXNlKCk7XG4gIGNvbnN0IG1hcHBlZCA9IFNJRU1FTlNfRkJfTUFQW3VwcGVyXTtcbiAgaWYgKG1hcHBlZCkgcmV0dXJuIG1hcHBlZDtcbiAgLy8gVW5rbm93biBcdTIwMTQgcmV0dXJuIG51bGwgc28gY2FsbGVyIGNhbiBkZWNpZGUgKHVubWFwcGVkIHZzIHBhc3N0aHJvdWdoKVxuICByZXR1cm4gbnVsbDtcbn1cblxuLy8gUmV2ZXJzZSBtYXA6IENMTSBGQlR5cGUgXHUyMTkyIGNhbm9uaWNhbCBTaWVtZW5zIG5hbWUgZm9yIGV4cG9ydFxuLy8gT25seSBuZWVkcyBlbnRyaWVzIHdoZXJlIHRoZSBDTE0gbmFtZSBkaWZmZXJzIGZyb20gdGhlIFNpZW1lbnMgbmFtZVxuY29uc3QgQ0xNX1RPX1NJRU1FTlM6IFBhcnRpYWw8UmVjb3JkPEZCVHlwZSwgc3RyaW5nPj4gPSB7XG4gIFJUUklHOiAnUl9UUklHJywgRlRSSUc6ICdGX1RSSUcnLFxuICBUT05SOiAnVE9OUicsIElFQ19USU1FUjogJ0lFQ19USU1FUicsIElFQ19MVElNRVI6ICdJRUNfTFRJTUVSJyxcbiAgSUVDX0NPVU5URVI6ICdJRUNfQ09VTlRFUicsIElFQ19MQ09VTlRFUjogJ0lFQ19MQ09VTlRFUicsIElFQ19UQzogJ0lFQ19UQycsXG4gIE5PUk1fWDogJ05PUk1fWCcsIFNDQUxFX1g6ICdTQ0FMRV9YJyxcbiAgVVBQRVJfQ0FTRTogJ1VQUEVSX0NBU0UnLCBMT1dFUl9DQVNFOiAnTE9XRVJfQ0FTRScsXG59O1xuXG5mdW5jdGlvbiBjbG1GQlR5cGVUb1NpZW1lbnMoZmJUeXBlOiBGQlR5cGUpOiBzdHJpbmcge1xuICByZXR1cm4gQ0xNX1RPX1NJRU1FTlNbZmJUeXBlXSB8fCBmYlR5cGU7XG59XG5cbi8vIFJldHVybnMgdGhlIG1hcHBlZCBGQlR5cGUgQU5EIHdoZXRoZXIgdmVuZG9yT3JpZ2luYWxOYW1lIHNob3VsZCBiZSBzdG9yZWRcbi8vIChuZWVkZWQgd2hlbiB0aGUgbWFwcGluZyBpcyBsb3NzeSBcdTIwMTQgaS5lLiBvcmlnaW5hbCBuYW1lIGRpZmZlcnMgZnJvbSBDTE0gdHlwZSBuYW1lKVxuZnVuY3Rpb24gbWFwU2llbWVuc0ZCVHlwZVdpdGhNZXRhKG5hbWU6IHN0cmluZyk6IHsgZmJUeXBlOiBGQlR5cGU7IHN0b3JlT3JpZ2luYWw6IGJvb2xlYW4gfSB8IG51bGwge1xuICBjb25zdCBmYlR5cGUgPSBtYXBTaWVtZW5zRkJUeXBlKG5hbWUpO1xuICBpZiAoIWZiVHlwZSkgcmV0dXJuIG51bGw7XG4gIC8vIFN0b3JlIG9yaWdpbmFsIHdoZW4gdGhlIENMTSB0eXBlIG5hbWUgZGlmZmVycyBmcm9tIHRoZSB2ZW5kb3IgbmFtZVxuICBjb25zdCBzdG9yZU9yaWdpbmFsID0gZmJUeXBlICE9PSBuYW1lLnRvVXBwZXJDYXNlKCkgJiYgZmJUeXBlICE9PSBuYW1lO1xuICByZXR1cm4geyBmYlR5cGUsIHN0b3JlT3JpZ2luYWwgfTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEZCRCBuZXR3b3JrIHBhcnNlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gcGFyc2VOZXR3b3Jrc1RvRkJEKFxuICBuZXR3b3JrczogdW5rbm93bltdLFxuICBwb3VJZDogc3RyaW5nLFxuICB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10sXG4gIHdhcm5pbmdzOiBzdHJpbmdbXSxcbiAgcmVzb2x2ZXI6IFZhcmlhYmxlVHlwZVJlc29sdmVyID0gbmV3IFZhcmlhYmxlVHlwZVJlc29sdmVyKClcbik6IEZCRFByb2dyYW0ge1xuICBjb25zdCBub2RlczogRkJETm9kZVtdID0gW107XG4gIGNvbnN0IHdpcmVzOiBGQkRXaXJlW10gPSBbXTtcbiAgbGV0IG5vZGVJZHggPSAwO1xuXG4gIGZvciAoY29uc3QgbmV0RWwgb2YgbmV0d29ya3MpIHtcbiAgICBjb25zdCBhdHRyTGlzdCA9IGNoaWxkKG5ldEVsLCAnQXR0cmlidXRlTGlzdCcpO1xuICAgIGNvbnN0IHBhcnRzRWwgPSBjaGlsZChhdHRyTGlzdCwgJ05ldHdvcmtTb3VyY2UnKTtcbiAgICBjb25zdCBmbGdOZXQgPSBjaGlsZChwYXJ0c0VsLCAnRmxnTmV0JykgPz8gcGFydHNFbDtcbiAgICBjb25zdCBwYXJ0c05vZGUgPSBjaGlsZChmbGdOZXQsICdQYXJ0cycpID8/IGZsZ05ldDtcbiAgICBjb25zdCB3aXJlc05vZGUgPSBjaGlsZChmbGdOZXQsICdXaXJlcycpO1xuXG4gICAgLy8gQnVpbGQgYSBzZXQgb2YgVUlkcyB0aGF0IGFwcGVhciBhcyB3aXJlIHRhcmdldHMgKHVzZWQgdG8gZGV0ZXJtaW5lIElOIHZzIE9VVCB2YXJpYWJsZSlcbiAgICBjb25zdCB3aXJlVGFyZ2V0VUlkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGlmICh3aXJlc05vZGUpIHtcbiAgICAgIGZvciAoY29uc3Qgd2lyZUVsIG9mIGNoaWxkQXJyYXkod2lyZXNOb2RlLCAnV2lyZScpKSB7XG4gICAgICAgIGNvbnN0IGFsbENvbnMgPSBbLi4uY2hpbGRBcnJheSh3aXJlRWwsICdOYW1lQ29uJyksIC4uLmNoaWxkQXJyYXkod2lyZUVsLCAnSWRlbnRDb24nKV07XG4gICAgICAgIC8vIExhc3QgY29ubmVjdG9yKHMpIG9uIHRoZSB3aXJlIGFyZSB0YXJnZXRzXG4gICAgICAgIGZvciAobGV0IHdpID0gMTsgd2kgPCBhbGxDb25zLmxlbmd0aDsgd2krKykge1xuICAgICAgICAgIGNvbnN0IHRVSWQgPSBhdHRyKGFsbENvbnNbd2ldLCAnVUlkJyk7XG4gICAgICAgICAgY29uc3QgdFBpbiA9IChhdHRyKGFsbENvbnNbd2ldLCAnTmFtZScpIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgIGlmICh0VUlkICYmICh0UGluID09PSAnaW4nIHx8IHRQaW4gPT09ICcnIHx8IHRQaW4gPT09ICdpbjEnKSkgd2lyZVRhcmdldFVJZHMuYWRkKHRVSWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gUGFyc2UgYmxvY2tzIChDYWxsIGFuZCBQYXJ0IGVsZW1lbnRzKVxuICAgIGZvciAoY29uc3QgYmxvY2tFbCBvZiBjaGlsZEFycmF5KHBhcnRzTm9kZSwgJ0NhbGwnKS5jb25jYXQoY2hpbGRBcnJheShwYXJ0c05vZGUsICdQYXJ0JykpKSB7XG4gICAgICBjb25zdCB1aWQgPSBhdHRyKGJsb2NrRWwsICdVSWQnKTtcbiAgICAgIGNvbnN0IG5hbWUgPSBhdHRyKGJsb2NrRWwsICdOYW1lJykgfHwgYXR0cihjaGlsZChibG9ja0VsLCAnQ2FsbEluZm8nKSwgJ05hbWUnKSB8fCAnQkxPQ0snO1xuICAgICAgbm9kZUlkeCsrO1xuICAgICAgY29uc3Qgc3ludGhldGljWCA9IChub2RlSWR4ICUgNSkgKiAxNDA7XG4gICAgICBjb25zdCBzeW50aGV0aWNZID0gTWF0aC5mbG9vcihub2RlSWR4IC8gNSkgKiAxMDA7XG4gICAgICBjb25zdCB4ID0gTnVtYmVyKGF0dHIoYmxvY2tFbCwgJ1gnKSB8fCBhdHRyKGJsb2NrRWwsICd4JykpIHx8IHN5bnRoZXRpY1g7XG4gICAgICBjb25zdCB5ID0gTnVtYmVyKGF0dHIoYmxvY2tFbCwgJ1knKSB8fCBhdHRyKGJsb2NrRWwsICd5JykpIHx8IHN5bnRoZXRpY1k7XG5cbiAgICAgIC8vIEJ1aWxkIGNhbm9uaWNhbCB0eXBlZCBwaW5zIGZyb20gc2lnbmF0dXJlOyBzdXBwbGVtZW50IHdpdGggQWNjZXNzIGNoaWxkcmVuIGZvciBkaXJlY3Rpb25cbiAgICAgIGNvbnN0IHsgaW5wdXRzOiBzaWdJbnB1dHMsIG91dHB1dHM6IHNpZ091dHB1dHMgfSA9IGJ1aWxkVHlwZWRQaW5zKG5hbWUsIFtdLCBgZmJkLSR7dWlkfWApO1xuICAgICAgY29uc3QgaW5wdXRzOiBQaW5bXSA9IFsuLi5zaWdJbnB1dHNdO1xuICAgICAgY29uc3Qgb3V0cHV0czogUGluW10gPSBbLi4uc2lnT3V0cHV0c107XG5cbiAgICAgIC8vIE92ZXJyaWRlIHdpdGggQWNjZXNzIGNoaWxkcmVuIHdoZXJlIHRoZSBYTUwgcHJvdmlkZXMgZGlyZWN0aW9uIG92ZXJyaWRlc1xuICAgICAgZm9yIChjb25zdCBhY2NFbCBvZiBjaGlsZEFycmF5KGJsb2NrRWwsICdBY2Nlc3MnKSkge1xuICAgICAgICBjb25zdCBkaXIgPSBhdHRyKGFjY0VsLCAnRGlyZWN0aW9uJyk7XG4gICAgICAgIGNvbnN0IHBpbk5hbWUgPSBhdHRyKGFjY0VsLCAnTmFtZScpIHx8IHBhcnNlQWNjZXNzVGFnKGFjY0VsKTtcbiAgICAgICAgY29uc3QgY2Fub25pY2FsVHlwZSA9IGdldFBpbkRhdGFUeXBlKG5hbWUsIHBpbk5hbWUsIGRpciA9PT0gJ091dCcgfHwgZGlyID09PSAnT3V0cHV0JyA/ICdvdXRwdXQnIDogJ2lucHV0Jyk7XG4gICAgICAgIGlmIChkaXIgPT09ICdPdXQnIHx8IGRpciA9PT0gJ091dHB1dCcpIHtcbiAgICAgICAgICBpZiAoIW91dHB1dHMuZmluZChwID0+IHAubmFtZSA9PT0gcGluTmFtZSkpIHtcbiAgICAgICAgICAgIG91dHB1dHMucHVzaCh7IGlkOiBnZW5JZCgncGluJyksIG5hbWU6IHBpbk5hbWUsIGRhdGFUeXBlOiBjYW5vbmljYWxUeXBlIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAoIWlucHV0cy5maW5kKHAgPT4gcC5uYW1lID09PSBwaW5OYW1lKSkge1xuICAgICAgICAgICAgaW5wdXRzLnB1c2goeyBpZDogZ2VuSWQoJ3BpbicpLCBuYW1lOiBwaW5OYW1lLCBkYXRhVHlwZTogY2Fub25pY2FsVHlwZSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChpbnB1dHMubGVuZ3RoID09PSAwKSBpbnB1dHMucHVzaCh7IGlkOiBnZW5JZCgncGluJyksIG5hbWU6ICdFTicsIGRhdGFUeXBlOiAnQk9PTCcgfSk7XG4gICAgICBpZiAob3V0cHV0cy5sZW5ndGggPT09IDApIG91dHB1dHMucHVzaCh7IGlkOiBnZW5JZCgncGluJyksIG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0JPT0wnIH0pO1xuXG4gICAgICBjb25zdCBtYXBwZWRGQkRUeXBlID0gbWFwU2llbWVuc0ZCRFR5cGUobmFtZSk7XG4gICAgICBjb25zdCBmYmROb2RlOiBGQkROb2RlID0ge1xuICAgICAgICBpZDogYGZiZC0ke3VpZH1gLFxuICAgICAgICB0eXBlOiBtYXBwZWRGQkRUeXBlLFxuICAgICAgICBpbnN0YW5jZU5hbWU6IGAke25hbWV9XyR7dWlkfWAsXG4gICAgICAgIHBvc2l0aW9uOiB7IHgsIHkgfSxcbiAgICAgICAgaW5wdXRzLFxuICAgICAgICBvdXRwdXRzLFxuICAgICAgfTtcbiAgICAgIGlmIChtYXBwZWRGQkRUeXBlICE9PSBuYW1lICYmIG1hcHBlZEZCRFR5cGUgIT09IG5hbWUudG9VcHBlckNhc2UoKSkge1xuICAgICAgICBmYmROb2RlLnZlbmRvck9yaWdpbmFsTmFtZSA9IG5hbWU7XG4gICAgICB9XG4gICAgICBub2Rlcy5wdXNoKGZiZE5vZGUpO1xuICAgIH1cblxuICAgIC8vIFBhcnNlIEFjY2VzcyBlbGVtZW50cyBhcyB2YXJpYWJsZSBub2Rlc1xuICAgIGZvciAoY29uc3QgYWNjRWwgb2YgY2hpbGRBcnJheShwYXJ0c05vZGUsICdBY2Nlc3MnKSkge1xuICAgICAgY29uc3QgdWlkID0gYXR0cihhY2NFbCwgJ1VJZCcpO1xuICAgICAgaWYgKCF1aWQpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgdGFnTmFtZSA9IHBhcnNlQWNjZXNzVGFnKGFjY0VsKTtcbiAgICAgIG5vZGVJZHgrKztcbiAgICAgIGNvbnN0IHN5bnRoZXRpY1ggPSAobm9kZUlkeCAlIDUpICogMTQwO1xuICAgICAgY29uc3Qgc3ludGhldGljWSA9IE1hdGguZmxvb3Iobm9kZUlkeCAvIDUpICogMTAwO1xuICAgICAgY29uc3QgeCA9IE51bWJlcihhdHRyKGFjY0VsLCAnWCcpIHx8IGF0dHIoYWNjRWwsICd4JykpIHx8IHN5bnRoZXRpY1g7XG4gICAgICBjb25zdCB5ID0gTnVtYmVyKGF0dHIoYWNjRWwsICdZJykgfHwgYXR0cihhY2NFbCwgJ3knKSkgfHwgc3ludGhldGljWTtcbiAgICAgIGNvbnN0IGlzSW5wdXQgPSB3aXJlVGFyZ2V0VUlkcy5oYXModWlkKTtcbiAgICAgIGNvbnN0IGFjY2Vzc1R5cGUgPSByZXNvbHZlci5yZXNvbHZlKHRhZ05hbWUpO1xuICAgICAgbm9kZXMucHVzaCh7XG4gICAgICAgIGlkOiBgZmJkLSR7dWlkfWAsXG4gICAgICAgIHR5cGU6IGlzSW5wdXQgPyAnSU5fVkFSSUFCTEUnIDogJ09VVF9WQVJJQUJMRScsXG4gICAgICAgIHRhZzogeyBuYW1lOiB0YWdOYW1lLCBkYXRhVHlwZTogYWNjZXNzVHlwZSB9LFxuICAgICAgICBwb3NpdGlvbjogeyB4LCB5IH0sXG4gICAgICAgIGlucHV0czogaXNJbnB1dCA/IFtdIDogW3sgaWQ6IGdlbklkKCdwaW4nKSwgbmFtZTogJ0lOJywgZGF0YVR5cGU6IGFjY2Vzc1R5cGUgfV0sXG4gICAgICAgIG91dHB1dHM6IGlzSW5wdXQgPyBbeyBpZDogZ2VuSWQoJ3BpbicpLCBuYW1lOiAnT1VUJywgZGF0YVR5cGU6IGFjY2Vzc1R5cGUgfV0gOiBbXSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFBhcnNlIHdpcmVzXG4gICAgaWYgKHdpcmVzTm9kZSkge1xuICAgICAgZm9yIChjb25zdCB3aXJlRWwgb2YgY2hpbGRBcnJheSh3aXJlc05vZGUsICdXaXJlJykpIHtcbiAgICAgICAgY29uc3QgbmFtZUNvbnMgPSBjaGlsZEFycmF5KHdpcmVFbCwgJ05hbWVDb24nKTtcbiAgICAgICAgY29uc3QgaWRlbnRDb25zID0gY2hpbGRBcnJheSh3aXJlRWwsICdJZGVudENvbicpO1xuICAgICAgICBjb25zdCBhbGxDb25zID0gWy4uLm5hbWVDb25zLCAuLi5pZGVudENvbnNdO1xuXG4gICAgICAgIGlmIChhbGxDb25zLmxlbmd0aCA+PSAyKSB7XG4gICAgICAgICAgY29uc3QgZnJvbUVsID0gYWxsQ29uc1swXTtcbiAgICAgICAgICBjb25zdCB0b0VsID0gYWxsQ29uc1sxXTtcbiAgICAgICAgICBjb25zdCBmcm9tVUlkID0gYXR0cihmcm9tRWwsICdVSWQnKSB8fCAnJztcbiAgICAgICAgICBjb25zdCB0b1VJZCA9IGF0dHIodG9FbCwgJ1VJZCcpIHx8ICcnO1xuICAgICAgICAgIGNvbnN0IGZyb21QaW4gPSBhdHRyKGZyb21FbCwgJ05hbWUnKSB8fCAnT1VUJztcbiAgICAgICAgICBjb25zdCB0b1BpbiA9IGF0dHIodG9FbCwgJ05hbWUnKSB8fCAnSU4nO1xuXG4gICAgICAgICAgaWYgKGZyb21VSWQgJiYgdG9VSWQpIHtcbiAgICAgICAgICAgIHdpcmVzLnB1c2goe1xuICAgICAgICAgICAgICBpZDogZ2VuSWQoJ3dpcmUnKSxcbiAgICAgICAgICAgICAgZnJvbTogeyBub2RlSWQ6IGBmYmQtJHtmcm9tVUlkfWAsIHBpbjogZnJvbVBpbiB9LFxuICAgICAgICAgICAgICB0bzogeyBub2RlSWQ6IGBmYmQtJHt0b1VJZH1gLCBwaW46IHRvUGluIH0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBBZGRpdGlvbmFsIGNvbm5lY3Rpb25zIG9uIHNhbWUgd2lyZSAoZmFuLW91dClcbiAgICAgICAgICBmb3IgKGxldCB3aSA9IDI7IHdpIDwgYWxsQ29ucy5sZW5ndGg7IHdpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dHJhVUlkID0gYXR0cihhbGxDb25zW3dpXSwgJ1VJZCcpIHx8ICcnO1xuICAgICAgICAgICAgY29uc3QgZXh0cmFQaW4gPSBhdHRyKGFsbENvbnNbd2ldLCAnTmFtZScpIHx8ICdJTic7XG4gICAgICAgICAgICBpZiAoZnJvbVVJZCAmJiBleHRyYVVJZCkge1xuICAgICAgICAgICAgICB3aXJlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBpZDogZ2VuSWQoJ3dpcmUnKSxcbiAgICAgICAgICAgICAgICBmcm9tOiB7IG5vZGVJZDogYGZiZC0ke2Zyb21VSWR9YCwgcGluOiBmcm9tUGluIH0sXG4gICAgICAgICAgICAgICAgdG86IHsgbm9kZUlkOiBgZmJkLSR7ZXh0cmFVSWR9YCwgcGluOiBleHRyYVBpbiB9LFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBub2Rlcywgd2lyZXMgfTtcbn1cblxuZnVuY3Rpb24gbWFwU2llbWVuc0ZCRFR5cGUobmFtZTogc3RyaW5nKTogRkJEQmxvY2tUeXBlIHtcbiAgY29uc3QgdXBwZXIgPSBuYW1lLnRvVXBwZXJDYXNlKCk7XG5cbiAgLy8gXHUyNTAwXHUyNTAwIEJvb2xlYW4gZ2F0ZXMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvbnN0IEJPT0xfR0FURVM6IFJlY29yZDxzdHJpbmcsIEZCREJsb2NrVHlwZT4gPSB7XG4gICAgQU5EOiAnQU5EJywgT1I6ICdPUicsIE5PVDogJ05PVCcsIFhPUjogJ1hPUicsIE5BTkQ6ICdOQU5EJywgTk9SOiAnTk9SJyxcbiAgfTtcbiAgaWYgKEJPT0xfR0FURVNbdXBwZXJdKSByZXR1cm4gQk9PTF9HQVRFU1t1cHBlcl07XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFN0YW5kYXJkIElFQyB0aW1lcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvbnN0IFRJTUVSUzogUmVjb3JkPHN0cmluZywgRkJEQmxvY2tUeXBlPiA9IHtcbiAgICBUT046ICdUT04nLCBUT0Y6ICdUT0YnLCBUUDogJ1RQJyxcbiAgICBUT05SOiAnVE9OUicsXG4gICAgSUVDX1RJTUVSOiAnSUVDX1RJTUVSJywgSUVDX0xUSU1FUjogJ0lFQ19MVElNRVInLFxuICAgIFNGQjM6ICdUT04nLCBTRkI0OiAnVE9GJywgU0ZCNTogJ1RQJyxcbiAgICBJRUNfVEM6ICdJRUNfVEMnLFxuICB9O1xuICBpZiAoVElNRVJTW3VwcGVyXSkgcmV0dXJuIFRJTUVSU1t1cHBlcl07XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFN0YW5kYXJkIElFQyBjb3VudGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgY29uc3QgQ09VTlRFUlM6IFJlY29yZDxzdHJpbmcsIEZCREJsb2NrVHlwZT4gPSB7XG4gICAgQ1RVOiAnQ1RVJywgQ1REOiAnQ1REJywgQ1RVRDogJ0NUVUQnLFxuICAgIElFQ19DT1VOVEVSOiAnSUVDX0NPVU5URVInLCBJRUNfTENPVU5URVI6ICdJRUNfTENPVU5URVInLFxuICB9O1xuICBpZiAoQ09VTlRFUlNbdXBwZXJdKSByZXR1cm4gQ09VTlRFUlNbdXBwZXJdO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBCaXN0YWJsZSAvIGVkZ2UgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvbnN0IEJJU1RBQkxFOiBSZWNvcmQ8c3RyaW5nLCBGQkRCbG9ja1R5cGU+ID0ge1xuICAgIFNSOiAnU1InLCBSUzogJ1JTJyxcbiAgICBSX1RSSUc6ICdSVFJJRycsIEZfVFJJRzogJ0ZUUklHJywgUlRSSUc6ICdSVFJJRycsIEZUUklHOiAnRlRSSUcnLFxuICB9O1xuICBpZiAoQklTVEFCTEVbdXBwZXJdKSByZXR1cm4gQklTVEFCTEVbdXBwZXJdO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBBcml0aG1ldGljIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBjb25zdCBBUklUSDogUmVjb3JkPHN0cmluZywgRkJEQmxvY2tUeXBlPiA9IHtcbiAgICBBREQ6ICdBREQnLCBTVUI6ICdTVUInLCBNVUw6ICdNVUwnLCBESVY6ICdESVYnLCBNT0Q6ICdNT0QnLFxuICAgIEFCUzogJ0FCUycsIFNRUlQ6ICdTUVJUJywgTkVHOiAnTkVHJyxcbiAgICBMTjogJ0xOJywgTE9HOiAnTE9HJywgRVhQOiAnRVhQJyxcbiAgICBTSU46ICdTSU4nLCBDT1M6ICdDT1MnLCBUQU46ICdUQU4nLFxuICAgIEFTSU46ICdBU0lOJywgQUNPUzogJ0FDT1MnLCBBVEFOOiAnQVRBTicsXG4gICAgQVROOiAnQVRBTicsIEFTTjogJ0FTSU4nLCBBQ1M6ICdBQ09TJyxcbiAgfTtcbiAgaWYgKEFSSVRIW3VwcGVyXSkgcmV0dXJuIEFSSVRIW3VwcGVyXTtcblxuICAvLyBcdTI1MDBcdTI1MDAgQ29tcGFyaXNvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgY29uc3QgQ01QOiBSZWNvcmQ8c3RyaW5nLCBGQkRCbG9ja1R5cGU+ID0ge1xuICAgIEdUOiAnR1QnLCBHRTogJ0dFJywgTFQ6ICdMVCcsIExFOiAnTEUnLCBFUTogJ0VRJywgTkU6ICdORScsXG4gIH07XG4gIGlmIChDTVBbdXBwZXJdKSByZXR1cm4gQ01QW3VwcGVyXTtcblxuICAvLyBcdTI1MDBcdTI1MDAgRGF0YSAvIHNlbGVjdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgY29uc3QgREFUQTogUmVjb3JkPHN0cmluZywgRkJEQmxvY2tUeXBlPiA9IHtcbiAgICBNT1ZFOiAnTU9WRScsIFNFTDogJ1NFTCcsIE1VWDogJ01VWCcsIExJTUlUOiAnTElNSVQnLCBNSU46ICdNSU4nLCBNQVg6ICdNQVgnLFxuICAgIEJMSU5LOiAnQkxJTksnLFxuICB9O1xuICBpZiAoREFUQVt1cHBlcl0pIHJldHVybiBEQVRBW3VwcGVyXTtcblxuICAvLyBcdTI1MDBcdTI1MDAgQW5hbG9nIHNjYWxpbmcgLyBub3JtYWxpc2F0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBjb25zdCBTQ0FMRTogUmVjb3JkPHN0cmluZywgRkJEQmxvY2tUeXBlPiA9IHtcbiAgICBTQ0FMRTogJ1NDQUxFJywgVU5TQ0FMRTogJ1VOU0NBTEUnLCBOT1JNX1g6ICdOT1JNX1gnLCBTQ0FMRV9YOiAnU0NBTEVfWCcsXG4gICAgRkMxMDU6ICdTQ0FMRScsIEZDMTA2OiAnVU5TQ0FMRScsXG4gIH07XG4gIGlmIChTQ0FMRVt1cHBlcl0pIHJldHVybiBTQ0FMRVt1cHBlcl07XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFN0cmluZyBmdW5jdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvbnN0IFNUUkZOUzogUmVjb3JkPHN0cmluZywgRkJEQmxvY2tUeXBlPiA9IHtcbiAgICBMRU46ICdMRU4nLCBMRUZUOiAnTEVGVCcsIFJJR0hUOiAnUklHSFQnLCBNSUQ6ICdNSUQnLFxuICAgIENPTkNBVDogJ0NPTkNBVCcsIEZJTkQ6ICdGSU5EJywgSU5TRVJUOiAnSU5TRVJUJywgREVMRVRFOiAnREVMRVRFJywgUkVQTEFDRTogJ1JFUExBQ0UnLFxuICAgIFVQUEVSX0NBU0U6ICdVUFBFUl9DQVNFJywgTE9XRVJfQ0FTRTogJ0xPV0VSX0NBU0UnLFxuICAgIFNfTEVOOiAnU19MRU4nLCBTX0xFRlQ6ICdTX0xFRlQnLCBTX1JJR0hUOiAnU19SSUdIVCcsIFNfTUlEOiAnU19NSUQnLFxuICAgIFNfRklORDogJ1NfRklORCcsIFNfQ09OVjogJ1NfQ09OVicsIFNfQ09OQ0FUOiAnU19DT05DQVQnLFxuICB9O1xuICBpZiAoU1RSRk5TW3VwcGVyXSkgcmV0dXJuIFNUUkZOU1t1cHBlcl07XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFR5cGUgY29udmVyc2lvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvbnN0IENPTlY6IFJlY29yZDxzdHJpbmcsIEZCREJsb2NrVHlwZT4gPSB7XG4gICAgQ09OVkVSVDogJ0NPTlZFUlQnLCBST1VORDogJ1JPVU5EJywgVFJVTkM6ICdUUlVOQycsIENFSUw6ICdDRUlMJywgRkxPT1I6ICdGTE9PUicsXG4gICAgSU5UX1RPX1JFQUw6ICdJTlRfVE9fUkVBTCcsIFJFQUxfVE9fSU5UOiAnUkVBTF9UT19JTlQnLFxuICAgIERJTlRfVE9fUkVBTDogJ0RJTlRfVE9fUkVBTCcsIFJFQUxfVE9fRElOVDogJ1JFQUxfVE9fRElOVCcsXG4gICAgSU5UX1RPX0RJTlQ6ICdJTlRfVE9fRElOVCcsIEJPT0xfVE9fSU5UOiAnQk9PTF9UT19JTlQnLCBJTlRfVE9fQk9PTDogJ0lOVF9UT19CT09MJyxcbiAgICBXT1JEX1RPX0lOVDogJ1dPUkRfVE9fSU5UJywgSU5UX1RPX1dPUkQ6ICdJTlRfVE9fV09SRCcsXG4gICAgRFdPUkRfVE9fRElOVDogJ0RXT1JEX1RPX0RJTlQnLCBESU5UX1RPX0RXT1JEOiAnRElOVF9UT19EV09SRCcsXG4gICAgVElNRV9UT19ESU5UOiAnVElNRV9UT19ESU5UJywgRElOVF9UT19USU1FOiAnRElOVF9UT19USU1FJyxcbiAgfTtcbiAgaWYgKENPTlZbdXBwZXJdKSByZXR1cm4gQ09OVlt1cHBlcl07XG5cbiAgLy8gXHUyNTAwXHUyNTAwIENvbW11bmljYXRpb24gRkJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBjb25zdCBDT01NUzogUmVjb3JkPHN0cmluZywgRkJEQmxvY2tUeXBlPiA9IHtcbiAgICBTRU5EOiAnU0VORCcsIFJFQ1Y6ICdSRUNWJywgUkRSRUM6ICdSRFJFQycsIFdSUkVDOiAnV1JSRUMnLFxuICAgIFRTRU5EOiAnU0VORCcsIFRSQ1Y6ICdSRUNWJywgVENPTjogJ1NFTkQnLCBURElTQ09OOiAnUkVDVicsXG4gICAgVFNFTkRfQzogJ1NFTkQnLCBUUkNWX0M6ICdSRUNWJyxcbiAgICBEUFJEX0RBVDogJ1JEUkVDJywgRFBXUl9EQVQ6ICdXUlJFQycsXG4gICAgRkI2NTogJ1NFTkQnLCBGQjY2OiAnUkVDVicsXG4gIH07XG4gIGlmIChDT01NU1t1cHBlcl0pIHJldHVybiBDT01NU1t1cHBlcl07XG5cbiAgLy8gVW5rbm93biBcdTIwMTQgdXNlIE1PVkUgYXMgYSBzYWZlIHBsYWNlaG9sZGVyIChzaGFwZSBpcyBwcmVzZXJ2ZWQsIG9yaWdpbmFsIG5hbWUgaW4gdmVuZG9yT3JpZ2luYWxOYW1lKVxuICByZXR1cm4gJ01PVkUnO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgR1JBUEggKFNGQykgcGFyc2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBwYXJzZU5ldHdvcmtzVG9TRkMoXG4gIG5ldHdvcmtzOiB1bmtub3duW10sXG4gIHBvdUlkOiBzdHJpbmcsXG4gIHVubWFwcGVkOiBVbm1hcHBlZEVsZW1lbnRbXSxcbiAgd2FybmluZ3M6IHN0cmluZ1tdXG4pOiBTRkNQcm9ncmFtIHtcbiAgY29uc3Qgc3RlcHM6IFNGQ1N0ZXBbXSA9IFtdO1xuICBjb25zdCB0cmFuc2l0aW9uczogU0ZDVHJhbnNpdGlvbltdID0gW107XG4gIGNvbnN0IGxpbmtzOiBTRkNMaW5rW10gPSBbXTtcbiAgY29uc3QganVtcHM6IFNGQ0p1bXBbXSA9IFtdO1xuXG4gIC8vIFRyYWNrcyBhbGwgc3RlcC90cmFuc2l0aW9uIE51bWJlcnMgc2VlbiwgZm9yIGp1bXAtdGFyZ2V0IHJlc29sdXRpb25cbiAgY29uc3Qgc3RlcE51bVNldCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCB0cmFuc051bVNldCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gIC8vIEJyYW5jaCBtZXRhZGF0YTogTnVtYmVyIFx1MjE5MiB7IHR5cGUsIGNhcmRpbmFsaXR5IH1cbiAgaW50ZXJmYWNlIEJyYW5jaE1ldGEgeyB0eXBlOiAnQWx0QmVnaW4nIHwgJ0FsdEVuZCcgfCAnU2ltQmVnaW4nIHwgJ1NpbUVuZCc7IGNhcmRpbmFsaXR5OiBudW1iZXI7IH1cbiAgY29uc3QgYnJhbmNoTWFwID0gbmV3IE1hcDxzdHJpbmcsIEJyYW5jaE1ldGE+KCk7XG5cbiAgZm9yIChjb25zdCBuZXRFbCBvZiBuZXR3b3Jrcykge1xuICAgIGNvbnN0IGF0dHJMaXN0ID0gY2hpbGQobmV0RWwsICdBdHRyaWJ1dGVMaXN0Jyk7XG4gICAgY29uc3QgcGFydHNFbCA9IGNoaWxkKGF0dHJMaXN0LCAnTmV0d29ya1NvdXJjZScpO1xuICAgIC8vIFJlYWwgVElBIFBvcnRhbCBHUkFQSDogTmV0d29ya1NvdXJjZS9HcmFwaC9TZXF1ZW5jZVxuICAgIGNvbnN0IGdyYXBoRWwgPSBjaGlsZChwYXJ0c0VsLCAnR3JhcGgnKTtcbiAgICBjb25zdCBzZXF1ZW5jZUVsID0gZ3JhcGhFbCA/IGNoaWxkKGdyYXBoRWwsICdTZXF1ZW5jZScpIDogbnVsbDtcbiAgICAvLyBGYWxsYmFjayB0byBvbGQgRmxnTmV0LXN0eWxlIGlmIG5vIEdyYXBoIGVsZW1lbnRcbiAgICBjb25zdCBzZXFPck5ldCA9IHNlcXVlbmNlRWwgPz8gY2hpbGQocGFydHNFbCwgJ0ZsZ05ldCcpID8/IHBhcnRzRWw7XG5cbiAgICBjb25zdCBzdGVwc0VsICAgICA9IGNoaWxkKHNlcU9yTmV0LCAnU3RlcHMnKTtcbiAgICBjb25zdCB0cmFuc2l0aW9uc0VsID0gY2hpbGQoc2VxT3JOZXQsICdUcmFuc2l0aW9ucycpO1xuICAgIGNvbnN0IGJyYW5jaGVzRWwgID0gY2hpbGQoc2VxT3JOZXQsICdCcmFuY2hlcycpO1xuICAgIGNvbnN0IGNvbm5lY3Rpb25zRWwgPSBjaGlsZChzZXFPck5ldCwgJ0Nvbm5lY3Rpb25zJyk7XG5cbiAgICBjb25zdCB2YWxpZFF1YWxpZmllcnM6IEFjdGlvblF1YWxpZmllcltdID0gWydOJywgJ1MnLCAnUicsICdQJywgJ1AxJywgJ1AwJywgJ0wnLCAnRCcsICdTRCcsICdEUycsICdTTCddO1xuXG4gICAgLy8gU3RlcHNcbiAgICBmb3IgKGNvbnN0IHN0ZXBFbCBvZiBjaGlsZEFycmF5KHN0ZXBzRWwgPz8gc2VxT3JOZXQsICdTdGVwJykpIHtcbiAgICAgIGNvbnN0IG51bSA9IGF0dHIoc3RlcEVsLCAnTnVtYmVyJykgfHwgYXR0cihzdGVwRWwsICdVSWQnKSB8fCAnJztcbiAgICAgIGNvbnN0IG5hbWUgPSBhdHRyKHN0ZXBFbCwgJ05hbWUnKSB8fCBgUyR7bnVtfWA7XG4gICAgICBjb25zdCBpc0luaXRpYWwgPSBhdHRyKHN0ZXBFbCwgJ0luaXQnKSA9PT0gJ3RydWUnIHx8IGF0dHIoc3RlcEVsLCAnSW5pdGlhbFN0ZXAnKSA9PT0gJ3RydWUnO1xuICAgICAgc3RlcE51bVNldC5hZGQobnVtKTtcblxuICAgICAgY29uc3QgYWN0aW9uczogU0ZDQWN0aW9uW10gPSBbXTtcbiAgICAgIC8vIEZpeCA5OiBsb29rIGZvciBBY3Rpb24gZWxlbWVudHMgaW5zaWRlIEFjdGlvbnMgd3JhcHBlciBmaXJzdCwgdGhlbiBkaXJlY3RseSBvbiBzdGVwXG4gICAgICBjb25zdCBhY3Rpb25zQ29udGFpbmVyID0gY2hpbGQoc3RlcEVsLCAnQWN0aW9ucycpID8/IHN0ZXBFbDtcbiAgICAgIC8vIFJlYWwgVElBIEdSQVBIOiBBY3Rpb25zIGNvbnRhaW5zIDxUaXRsZT48TXVsdGlMYW5ndWFnZVRleHQuLi4vPjwvVGl0bGU+XG4gICAgICAvLyBhbmQgc3RlcCBib2R5IGFjdGlvbnMgYXJlIGluIFN1cGVydmlzaW9ucy9JbnRlcmxvY2tzIHdpdGggRmxnTmV0XG4gICAgICBjb25zdCBhY3Rpb25zVGl0bGVFbCA9IGNoaWxkKGFjdGlvbnNDb250YWluZXIsICdUaXRsZScpO1xuICAgICAgaWYgKGFjdGlvbnNUaXRsZUVsKSB7XG4gICAgICAgIC8vIEV4dHJhY3QgYWN0aW9uIHRpdGxlIGFzIGEgbmFtZWQgYWN0aW9uIHdpdGggTiBxdWFsaWZpZXJcbiAgICAgICAgY29uc3QgbWxUZXh0cyA9IGNoaWxkQXJyYXkoYWN0aW9uc1RpdGxlRWwsICdNdWx0aUxhbmd1YWdlVGV4dCcpO1xuICAgICAgICBjb25zdCB0aXRsZVRleHQgPSBtbFRleHRzLmxlbmd0aCA+IDBcbiAgICAgICAgICA/IChhdHRyKG1sVGV4dHNbMF0sICdMYW5nJyk/LnN0YXJ0c1dpdGgoJ2VuJykgPyB0ZXh0KG1sVGV4dHNbMF0pIDogdGV4dChtbFRleHRzWzBdKSkgfHwgJydcbiAgICAgICAgICA6IHRleHQoYWN0aW9uc1RpdGxlRWwpIHx8ICcnO1xuICAgICAgICBpZiAodGl0bGVUZXh0KSB7XG4gICAgICAgICAgYWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiBnZW5JZChgYWN0aW9uLSR7bnVtfWApLFxuICAgICAgICAgICAgcXVhbGlmaWVyOiAnTicgYXMgQWN0aW9uUXVhbGlmaWVyLFxuICAgICAgICAgICAgdGFnOiB7IG5hbWU6IHRpdGxlVGV4dCwgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBBbHNvIGhhbmRsZSBJRUMtc3R5bGUgPEFjdGlvbiBRdWFsaWZpZXI9XCJOXCIgTmFtZT1cIi4uLlwiLz4gZWxlbWVudHNcbiAgICAgIGZvciAoY29uc3QgYWN0aW9uRWwgb2YgY2hpbGRBcnJheShhY3Rpb25zQ29udGFpbmVyLCAnQWN0aW9uJykpIHtcbiAgICAgICAgY29uc3QgcXVhbGlmaWVyID0gKGF0dHIoYWN0aW9uRWwsICdRdWFsaWZpZXInKSB8fCAnTicpLnRvVXBwZXJDYXNlKCkgYXMgQWN0aW9uUXVhbGlmaWVyO1xuICAgICAgICBjb25zdCBhY3Rpb25OYW1lID0gYXR0cihhY3Rpb25FbCwgJ05hbWUnKSB8fCB0ZXh0KGNoaWxkKGFjdGlvbkVsLCAnTmFtZScpKSB8fCAnJztcbiAgICAgICAgY29uc3QgZHVyYXRpb24gPSBhdHRyKGFjdGlvbkVsLCAnRHVyYXRpb24nKSB8fCB1bmRlZmluZWQ7XG4gICAgICAgIGlmIChhY3Rpb25OYW1lKSB7XG4gICAgICAgICAgYWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiBnZW5JZChgYWN0aW9uLSR7bnVtfWApLFxuICAgICAgICAgICAgcXVhbGlmaWVyOiB2YWxpZFF1YWxpZmllcnMuaW5jbHVkZXMocXVhbGlmaWVyKSA/IHF1YWxpZmllciA6ICdOJyxcbiAgICAgICAgICAgIHRhZzogeyBuYW1lOiBhY3Rpb25OYW1lLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICAgICAgICBkdXJhdGlvbixcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBzdGVwcy5wdXNoKHtcbiAgICAgICAgaWQ6IGBzaWVtZW5zLXN0ZXAtJHtudW19YCxcbiAgICAgICAgbmFtZSxcbiAgICAgICAgaXNJbml0aWFsLFxuICAgICAgICBhY3Rpb25zLFxuICAgICAgICBwb3NpdGlvbjogeyB4OiAwLCB5OiAwIH0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBUcmFuc2l0aW9ucyBcdTIwMTQgY29uZGl0aW9uIGlzIGVpdGhlcjpcbiAgICAvLyAxLiBJbmxpbmUgPEZsZ05ldD4gKHJlYWwgVElBIEdSQVBIIHRyYW5zaXRpb25zIGhhdmUgTEFEL0ZCRCBjb25kaXRpb25zKVxuICAgIC8vIDIuIDxDb25kaXRpb24+IHRleHQgY2hpbGRcbiAgICAvLyAzLiBOYW1lIGF0dHJpYnV0ZSBhcyBmYWxsYmFja1xuICAgIGZvciAoY29uc3QgdHJhbnNFbCBvZiBjaGlsZEFycmF5KHRyYW5zaXRpb25zRWwgPz8gc2VxT3JOZXQsICdUcmFuc2l0aW9uJykpIHtcbiAgICAgIGNvbnN0IG51bSA9IGF0dHIodHJhbnNFbCwgJ051bWJlcicpIHx8IGF0dHIodHJhbnNFbCwgJ1VJZCcpIHx8ICcnO1xuICAgICAgY29uc3QgbmFtZSA9IGF0dHIodHJhbnNFbCwgJ05hbWUnKSB8fCBgVCR7bnVtfWA7XG4gICAgICBjb25zdCBwcm9nTGFuZyA9IGF0dHIodHJhbnNFbCwgJ1Byb2dyYW1taW5nTGFuZ3VhZ2UnKSB8fCAnJztcbiAgICAgIHRyYW5zTnVtU2V0LmFkZChudW0pO1xuXG4gICAgICAvLyBUcnkgaW5saW5lIEZsZ05ldCBmaXJzdCAocmVhbCBUSUEgR1JBUEggZm9ybWF0KVxuICAgICAgY29uc3QgZmxnTmV0RWwgPSBjaGlsZCh0cmFuc0VsLCAnRmxnTmV0Jyk7XG4gICAgICBsZXQgY29uZGl0aW9uID0gbmFtZTtcbiAgICAgIGlmIChmbGdOZXRFbCkge1xuICAgICAgICAvLyBFeHRyYWN0IEFjY2Vzcy92YXJpYWJsZSBuYW1lcyBmcm9tIHRoZSBGbGdOZXQgYXMgYSBzaW1wbGUgdGV4dCBjb25kaXRpb25cbiAgICAgICAgY29uc3QgZmxnUGFydHMgPSBjaGlsZChmbGdOZXRFbCwgJ1BhcnRzJyk7XG4gICAgICAgIGNvbnN0IGFjY2Vzc0VscyA9IGNoaWxkQXJyYXkoZmxnUGFydHMsICdBY2Nlc3MnKTtcbiAgICAgICAgaWYgKGFjY2Vzc0Vscy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgY29uZGl0aW9uID0gYWNjZXNzRWxzLm1hcChhID0+IHBhcnNlQWNjZXNzVGFnKGEpKS5maWx0ZXIodCA9PiB0ICE9PSAnVU5LTk9XTl9UQUcnKS5qb2luKCcgQU5EICcpIHx8IG5hbWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gRmxnTmV0IHdpdGggb25seSBQYXJ0cyBsaWtlIFRyQ29pbCAoYWx3YXlzLXRydWUgdHJhbnNpdGlvbilcbiAgICAgICAgICBjb25kaXRpb24gPSAnVFJVRSc7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGNvbmRpdGlvbkVsID0gY2hpbGQodHJhbnNFbCwgJ0NvbmRpdGlvbicpO1xuICAgICAgICBpZiAoY29uZGl0aW9uRWwpIHtcbiAgICAgICAgICBjb25kaXRpb24gPSB0ZXh0KGNvbmRpdGlvbkVsKSB8fCAnVFJVRSc7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdHJhbnNpdGlvbnMucHVzaCh7XG4gICAgICAgIGlkOiBgc2llbWVucy10cmFucy0ke251bX1gLFxuICAgICAgICBjb25kaXRpb24sXG4gICAgICAgIHBvc2l0aW9uOiB7IHg6IDAsIHk6IDAgfSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEJyYW5jaGVzIFx1MjAxNCBBbHRCZWdpbi9BbHRFbmQgPSBzZWxlY3Rpb24gKE9SKSwgU2ltQmVnaW4vU2ltRW5kID0gc2ltdWx0YW5lb3VzIChBTkQpXG4gICAgZm9yIChjb25zdCBicmFuY2hFbCBvZiBjaGlsZEFycmF5KGJyYW5jaGVzRWwgPz8gc2VxT3JOZXQsICdCcmFuY2gnKSkge1xuICAgICAgY29uc3QgbnVtID0gYXR0cihicmFuY2hFbCwgJ051bWJlcicpIHx8ICcnO1xuICAgICAgY29uc3QgdHlwZSA9IChhdHRyKGJyYW5jaEVsLCAnVHlwZScpIHx8ICdBbHRCZWdpbicpIGFzIEJyYW5jaE1ldGFbJ3R5cGUnXTtcbiAgICAgIGNvbnN0IGNhcmRpbmFsaXR5ID0gTnVtYmVyKGF0dHIoYnJhbmNoRWwsICdDYXJkaW5hbGl0eScpIHx8ICcyJyk7XG4gICAgICBicmFuY2hNYXAuc2V0KG51bSwgeyB0eXBlLCBjYXJkaW5hbGl0eSB9KTtcbiAgICB9XG5cbiAgICAvLyBDb25uZWN0aW9ucyBcdTIwMTQgTm9kZUZyb20vTm9kZVRvIGVhY2ggY29udGFpbiBTdGVwUmVmLCBUcmFuc2l0aW9uUmVmLCBvciBCcmFuY2hSZWZcbiAgICBjb25zdCByZXNvbHZlTm9kZSA9IChub2RlRWw6IHVua25vd24pOiB7IGlkOiBzdHJpbmc7IGJyYW5jaE51bT86IHN0cmluZzsgYnJhbmNoUG9ydD86IG51bWJlcjsgaXNFbmQ/OiBib29sZWFuIH0gfCBudWxsID0+IHtcbiAgICAgIGlmICghbm9kZUVsKSByZXR1cm4gbnVsbDtcbiAgICAgIGNvbnN0IHN0ZXBSZWYgPSBjaGlsZChub2RlRWwsICdTdGVwUmVmJyk7XG4gICAgICBjb25zdCB0cmFuc1JlZiA9IGNoaWxkKG5vZGVFbCwgJ1RyYW5zaXRpb25SZWYnKTtcbiAgICAgIGNvbnN0IGJyYW5jaFJlZiA9IGNoaWxkKG5vZGVFbCwgJ0JyYW5jaFJlZicpO1xuICAgICAgY29uc3QgZW5kQ29ubiA9IGNoaWxkKG5vZGVFbCwgJ0VuZENvbm5lY3Rpb24nKTtcbiAgICAgIGlmIChzdGVwUmVmKSByZXR1cm4geyBpZDogYHNpZW1lbnMtc3RlcC0ke2F0dHIoc3RlcFJlZiwgJ051bWJlcicpfWAgfTtcbiAgICAgIGlmICh0cmFuc1JlZikgcmV0dXJuIHsgaWQ6IGBzaWVtZW5zLXRyYW5zLSR7YXR0cih0cmFuc1JlZiwgJ051bWJlcicpfWAgfTtcbiAgICAgIGlmIChicmFuY2hSZWYpIHtcbiAgICAgICAgY29uc3QgbnVtID0gYXR0cihicmFuY2hSZWYsICdOdW1iZXInKSB8fCAnJztcbiAgICAgICAgY29uc3QgaW5Qb3J0ID0gYXR0cihicmFuY2hSZWYsICdJbicpO1xuICAgICAgICBjb25zdCBvdXRQb3J0ID0gYXR0cihicmFuY2hSZWYsICdPdXQnKTtcbiAgICAgICAgY29uc3QgcG9ydCA9IGluUG9ydCAhPT0gJycgPyBOdW1iZXIoaW5Qb3J0KSA6IE51bWJlcihvdXRQb3J0IHx8ICcwJyk7XG4gICAgICAgIHJldHVybiB7IGlkOiBgc2llbWVucy1icmFuY2gtJHtudW19YCwgYnJhbmNoTnVtOiBudW0sIGJyYW5jaFBvcnQ6IHBvcnQgfTtcbiAgICAgIH1cbiAgICAgIGlmIChlbmRDb25uICE9PSB1bmRlZmluZWQgJiYgZW5kQ29ubiAhPT0gbnVsbCkgcmV0dXJuIHsgaWQ6ICdzaWVtZW5zLWVuZCcsIGlzRW5kOiB0cnVlIH07XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9O1xuXG4gICAgZm9yIChjb25zdCBjb25uRWwgb2YgY2hpbGRBcnJheShjb25uZWN0aW9uc0VsID8/IHNlcU9yTmV0LCAnQ29ubmVjdGlvbicpKSB7XG4gICAgICBjb25zdCBsaW5rVHlwZUF0dHIgPSB0ZXh0KGNoaWxkKGNvbm5FbCwgJ0xpbmtUeXBlJykpIHx8ICdEaXJlY3QnO1xuICAgICAgY29uc3QgZnJvbU5vZGUgPSByZXNvbHZlTm9kZShjaGlsZChjb25uRWwsICdOb2RlRnJvbScpKTtcbiAgICAgIGNvbnN0IHRvTm9kZSAgID0gcmVzb2x2ZU5vZGUoY2hpbGQoY29ubkVsLCAnTm9kZVRvJykpO1xuICAgICAgaWYgKCFmcm9tTm9kZSB8fCAhdG9Ob2RlKSBjb250aW51ZTtcblxuICAgICAgLy8gQ2xhc3NpZnkgbGluayB0eXBlIGJhc2VkIG9uIGJyYW5jaCBpbnZvbHZlbWVudFxuICAgICAgbGV0IGZyb21JZCA9IGZyb21Ob2RlLmlkO1xuICAgICAgbGV0IHRvSWQgICA9IHRvTm9kZS5pZDtcbiAgICAgIGNvbnN0IGlzSnVtcExpbmsgPSBsaW5rVHlwZUF0dHIgPT09ICdKdW1wJztcbiAgICAgIGxldCBzZmNMaW5rVHlwZTogU0ZDTGlua1sndHlwZSddID0gJ3NpbXBsZSc7XG5cbiAgICAgIGlmIChmcm9tTm9kZS5icmFuY2hOdW0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zdCBtZXRhID0gYnJhbmNoTWFwLmdldChmcm9tTm9kZS5icmFuY2hOdW0pO1xuICAgICAgICBjb25zdCBpc1NpbXVsdGFuZW91cyA9IG1ldGE/LnR5cGUgPT09ICdTaW1CZWdpbicgfHwgbWV0YT8udHlwZSA9PT0gJ1NpbUVuZCc7XG4gICAgICAgIHNmY0xpbmtUeXBlID0gaXNTaW11bHRhbmVvdXMgPyAnc2ltdWx0YW5lb3VzLWRpdmVyZ2VuY2UnIDogJ3NlbGVjdGlvbi1kaXZlcmdlbmNlJztcbiAgICAgIH0gZWxzZSBpZiAodG9Ob2RlLmJyYW5jaE51bSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnN0IG1ldGEgPSBicmFuY2hNYXAuZ2V0KHRvTm9kZS5icmFuY2hOdW0pO1xuICAgICAgICBjb25zdCBpc1NpbXVsdGFuZW91cyA9IG1ldGE/LnR5cGUgPT09ICdTaW1CZWdpbicgfHwgbWV0YT8udHlwZSA9PT0gJ1NpbUVuZCc7XG4gICAgICAgIC8vIFwiSW5cIiBwb3J0cyA9IGNvbnZlcmdlbmNlIHNpZGUsIFwiT3V0XCIgcG9ydHMgPSBkaXZlcmdlbmNlIHNpZGVcbiAgICAgICAgY29uc3QgaXNJblBvcnQgPSBjaGlsZChjaGlsZChjb25uRWwsICdOb2RlVG8nKSwgJ0JyYW5jaFJlZicpICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICBhdHRyKGNoaWxkKGNoaWxkKGNvbm5FbCwgJ05vZGVUbycpLCAnQnJhbmNoUmVmJyksICdJbicpICE9PSAnJztcbiAgICAgICAgc2ZjTGlua1R5cGUgPSBpc0luUG9ydFxuICAgICAgICAgID8gKGlzU2ltdWx0YW5lb3VzID8gJ3NpbXVsdGFuZW91cy1jb252ZXJnZW5jZScgOiAnc2VsZWN0aW9uLWNvbnZlcmdlbmNlJylcbiAgICAgICAgICA6IChpc1NpbXVsdGFuZW91cyA/ICdzaW11bHRhbmVvdXMtZGl2ZXJnZW5jZScgOiAnc2VsZWN0aW9uLWRpdmVyZ2VuY2UnKTtcbiAgICAgIH1cblxuICAgICAgLy8gSGFuZGxlIEVuZENvbm5lY3Rpb246IHNlcXVlbmNlIHRlcm1pbmF0ZXMsIHNraXAgY3JlYXRpbmcgYSBsaW5rXG4gICAgICBpZiAodG9Ob2RlLmlzRW5kKSB7XG4gICAgICAgIC8vIEVuZENvbm5lY3Rpb24gPSBzZXF1ZW5jZSBlbmQ7IG5vIGxpbmsgY3JlYXRlZCAoaW1wbGljaXQgdGVybWluYXRpb24pXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBIYW5kbGUganVtcCBsaW5rczogY3JlYXRlIGEgU0ZDSnVtcCBlbnRyeSBhbmQgYSBsaW5rIHRvIGl0XG4gICAgICBpZiAoaXNKdW1wTGluaykge1xuICAgICAgICBjb25zdCB0YXJnZXRTdGVwSWQgPSB0b0lkO1xuICAgICAgICBjb25zdCB0YXJnZXRTdGVwTnVtID0gdGFyZ2V0U3RlcElkLnJlcGxhY2UoJ3NpZW1lbnMtc3RlcC0nLCAnJyk7XG4gICAgICAgIGNvbnN0IHRhcmdldFN0ZXAgPSBzdGVwcy5maW5kKHMgPT4gcy5pZCA9PT0gdGFyZ2V0U3RlcElkKTtcbiAgICAgICAgY29uc3QganVtcElkID0gZ2VuSWQoYGp1bXAtJHtmcm9tSWR9YCk7XG4gICAgICAgIGp1bXBzLnB1c2goe1xuICAgICAgICAgIGlkOiBqdW1wSWQsXG4gICAgICAgICAgdGFyZ2V0U3RlcE5hbWU6IHRhcmdldFN0ZXA/Lm5hbWUgfHwgYFMke3RhcmdldFN0ZXBOdW19YCxcbiAgICAgICAgICBwb3NpdGlvbjogeyB4OiAwLCB5OiAwIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBsaW5rcy5wdXNoKHtcbiAgICAgICAgICBpZDogZ2VuSWQoYGxpbmstJHtmcm9tSWR9LWp1bXBgKSxcbiAgICAgICAgICBmcm9tOiBmcm9tSWQsXG4gICAgICAgICAgdG86IGp1bXBJZCxcbiAgICAgICAgICB0eXBlOiAnc2ltcGxlJyxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBsaW5rcy5wdXNoKHtcbiAgICAgICAgaWQ6IGdlbklkKGBsaW5rLSR7ZnJvbUlkfS0ke3RvSWR9YCksXG4gICAgICAgIGZyb206IGZyb21JZCxcbiAgICAgICAgdG86IHRvSWQsXG4gICAgICAgIHR5cGU6IHNmY0xpbmtUeXBlLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gRGVyaXZlIGJyYW5jaGVzIGZyb20gbGluayB0b3BvbG9neVxuICBjb25zdCBicmFuY2hlczogU0ZDQnJhbmNoW10gPSBbXTtcbiAgY29uc3QgYWxsQnJhbmNoSWRzID0gbmV3IFNldChsaW5rcy5mbGF0TWFwKGwgPT4gW2wuZnJvbSwgbC50b10pLmZpbHRlcihpZCA9PiBpZC5zdGFydHNXaXRoKCdzaWVtZW5zLWJyYW5jaC0nKSkpO1xuXG4gIGZvciAoY29uc3QgYmFySWQgb2YgYWxsQnJhbmNoSWRzKSB7XG4gICAgY29uc3QgYnJhbmNoTnVtID0gYmFySWQucmVwbGFjZSgnc2llbWVucy1icmFuY2gtJywgJycpO1xuICAgIGNvbnN0IG1ldGEgPSBicmFuY2hNYXAuZ2V0KGJyYW5jaE51bSk7XG4gICAgaWYgKCFtZXRhKSBjb250aW51ZTtcbiAgICAvLyBPbmx5IHByb2Nlc3MgXCJCZWdpblwiIGJyYW5jaGVzIChkaXZlcmdlbmNlIHNpZGUpIG9uY2VcbiAgICBpZiAobWV0YS50eXBlICE9PSAnQWx0QmVnaW4nICYmIG1ldGEudHlwZSAhPT0gJ1NpbUJlZ2luJykgY29udGludWU7XG5cbiAgICBjb25zdCBpc1NpbXVsdGFuZW91cyA9IG1ldGEudHlwZSA9PT0gJ1NpbUJlZ2luJztcbiAgICBjb25zdCB1cHN0cmVhbUlkcyA9IGxpbmtzLmZpbHRlcihsID0+IGwudG8gPT09IGJhcklkKS5tYXAobCA9PiBsLmZyb20pO1xuICAgIGNvbnN0IGJyYW5jaEhlYWRJZHMgPSBsaW5rcy5maWx0ZXIobCA9PiBsLmZyb20gPT09IGJhcklkKS5tYXAobCA9PiBsLnRvKTtcblxuICAgIC8vIEZpbmQgY29ycmVzcG9uZGluZyBFbmQgYmFyIChjb252ZXJnZW5jZSlcbiAgICBjb25zdCBjb252QmFySWQgPSBbLi4uYWxsQnJhbmNoSWRzXS5maW5kKGJpZCA9PiB7XG4gICAgICBjb25zdCBiTnVtID0gYmlkLnJlcGxhY2UoJ3NpZW1lbnMtYnJhbmNoLScsICcnKTtcbiAgICAgIGNvbnN0IGJNZXRhID0gYnJhbmNoTWFwLmdldChiTnVtKTtcbiAgICAgIHJldHVybiBiTWV0YSAmJiAoaXNTaW11bHRhbmVvdXMgPyBiTWV0YS50eXBlID09PSAnU2ltRW5kJyA6IGJNZXRhLnR5cGUgPT09ICdBbHRFbmQnKTtcbiAgICB9KSA/PyAnJztcblxuICAgIGNvbnN0IGRvd25zdHJlYW1JZHMgPSBsaW5rcy5maWx0ZXIobCA9PiBsLmZyb20gPT09IGNvbnZCYXJJZCkubWFwKGwgPT4gbC50byk7XG5cbiAgICBjb25zdCBicmFuY2hTdGVwQXJyYXlzOiBzdHJpbmdbXVtdID0gYnJhbmNoSGVhZElkcy5tYXAoaGVhZElkID0+IHtcbiAgICAgIGNvbnN0IGNoYWluOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgbGV0IGN1ciA9IGhlYWRJZDtcbiAgICAgIGZvciAobGV0IGRlcHRoID0gMDsgZGVwdGggPCAzMDsgZGVwdGgrKykge1xuICAgICAgICBpZiAoY3VyLnN0YXJ0c1dpdGgoJ3NpZW1lbnMtc3RlcC0nKSkgY2hhaW4ucHVzaChjdXIpO1xuICAgICAgICBjb25zdCBuZXh0ID0gbGlua3MuZmluZChsID0+IGwuZnJvbSA9PT0gY3VyICYmIGwudHlwZSA9PT0gJ3NpbXBsZScgJiYgIWFsbEJyYW5jaElkcy5oYXMobC50bykpO1xuICAgICAgICBpZiAoIW5leHQgfHwgYWxsQnJhbmNoSWRzLmhhcyhuZXh0LnRvKSkgYnJlYWs7XG4gICAgICAgIGN1ciA9IG5leHQudG87XG4gICAgICB9XG4gICAgICByZXR1cm4gY2hhaW47XG4gICAgfSk7XG5cbiAgICBpZiAoIWJyYW5jaGVzLmZpbmQoYiA9PiBiLmlkID09PSBgYnJhbmNoLSR7YmFySWR9YCkpIHtcbiAgICAgIGJyYW5jaGVzLnB1c2goe1xuICAgICAgICBpZDogYGJyYW5jaC0ke2JhcklkfWAsXG4gICAgICAgIHR5cGU6IGlzU2ltdWx0YW5lb3VzID8gJ0FORCcgOiAnT1InLFxuICAgICAgICBkaXZlcmdpbmdGcm9tVHJhbnNJZDogdXBzdHJlYW1JZHNbMF0gfHwgJycsXG4gICAgICAgIGJyYW5jaFN0ZXBJZHM6IGJyYW5jaFN0ZXBBcnJheXMsXG4gICAgICAgIGNvbnZlcmdpbmdUb1RyYW5zSWQ6IGRvd25zdHJlYW1JZHNbMF0gfHwgJycsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBzdGVwcywgdHJhbnNpdGlvbnMsIGxpbmtzLCBicmFuY2hlcywganVtcHMgfTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEV4cG9ydCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGZ1bmN0aW9uIGV4cG9ydFNpZW1lbnMocHJvamVjdDogTm9ybWFsaXplZFByb2plY3QpOiBFeHBvcnRSZXN1bHQge1xuICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBzaWRlY2FyID0gcHJvamVjdC5zaWRlY2FyO1xuXG4gIGxldCB1aWRDb3VudGVyID0gMTtcbiAgY29uc3QgbmV4dFVJZCA9ICgpID0+IFN0cmluZyh1aWRDb3VudGVyKyspO1xuXG4gIGNvbnN0IGJsb2NrcyA9IHByb2plY3QucG91cy5tYXAocG91ID0+IGJ1aWxkU2ltYXRpY0Jsb2NrKHBvdSwgbmV4dFVJZCwgd2FybmluZ3MsIHNpZGVjYXIpKTtcblxuICAvLyBGaXggMSAmIDI6IGJsb2NrcyBhcmUgZGlyZWN0IGNoaWxkcmVuIG9mIERvY3VtZW50IChub3QgaW5zaWRlIFNXLkJsb2NrcyB3cmFwcGVyKSxcbiAgLy8gRW5naW5lZXJpbmcgdmVyc2lvbiBlbGVtZW50IGFkZGVkIGFzIHNpYmxpbmcuXG4gIGNvbnN0IGRvY3VtZW50T2JqOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICBEb2N1bWVudEluZm86IHtcbiAgICAgIENyZWF0ZWQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIEV4cG9ydFNldHRpbmc6ICdXaXRoRGVmYXVsdHMnLFxuICAgICAgSW5zdGFsbGVkUHJvZHVjdHM6IHt9LFxuICAgICAgUHJvamVjdE5hbWU6IHByb2plY3QucHJvamVjdE5hbWUsXG4gICAgICBUaWFWZXJzaW9uOiBzaWRlY2FyLnZlbmRvclNwZWNpZmljR2xvYmFscz8uWyd0aWFWZXJzaW9uJ10gPz8gJzE3LjAnLFxuICAgIH0sXG4gICAgRW5naW5lZXJpbmc6IHsgJ0BfdmVyc2lvbic6ICdWMTQgU1AxJyB9LFxuICB9O1xuXG4gIGNvbnN0IG9iczogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSA9IFtdO1xuICBjb25zdCBmYnM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+W10gPSBbXTtcbiAgY29uc3QgZmNzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdID0gW107XG4gIHByb2plY3QucG91cy5mb3JFYWNoKChwb3UsIGkpID0+IHtcbiAgICBjb25zdCBibG9jayA9IHsgLi4uYmxvY2tzW2ldLCAnQF9JRCc6ICcwJyB9O1xuICAgIGlmIChwb3UucG91VHlwZSA9PT0gJ2Z1bmN0aW9uQmxvY2snKSBmYnMucHVzaChibG9jayk7XG4gICAgZWxzZSBpZiAocG91LnBvdVR5cGUgPT09ICdmdW5jdGlvbicpIGZjcy5wdXNoKGJsb2NrKTtcbiAgICBlbHNlIG9icy5wdXNoKGJsb2NrKTtcbiAgfSk7XG4gIGlmIChvYnMubGVuZ3RoID4gMCkgZG9jdW1lbnRPYmpbJ1NXLkJsb2Nrcy5PQiddID0gb2JzO1xuICBpZiAoZmJzLmxlbmd0aCA+IDApIGRvY3VtZW50T2JqWydTVy5CbG9ja3MuRkInXSA9IGZicztcbiAgaWYgKGZjcy5sZW5ndGggPiAwKSBkb2N1bWVudE9ialsnU1cuQmxvY2tzLkZDJ10gPSBmY3M7XG5cbiAgY29uc3Qgb2JqID0geyBEb2N1bWVudDogZG9jdW1lbnRPYmogfTtcblxuICByZXR1cm4geyBvazogdHJ1ZSwgeG1sQ29udGVudDogYnVpbGRYTUwob2JqKSwgZXJyb3JzLCB3YXJuaW5ncyB9O1xufVxuXG5mdW5jdGlvbiBidWlsZFNpbWF0aWNCbG9jayhcbiAgcG91OiBOb3JtYWxpemVkUE9VLFxuICBuZXh0VUlkOiAoKSA9PiBzdHJpbmcsXG4gIHdhcm5pbmdzOiBzdHJpbmdbXSxcbiAgc2lkZWNhcjogVmVuZG9yTWV0YWRhdGFTaWRlY2FyXG4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIGNvbnN0IG5ldHdvcmtzID0gYnVpbGRTaW1hdGljTmV0d29ya3MocG91LCBuZXh0VUlkLCB3YXJuaW5ncyk7XG5cbiAgcmV0dXJuIHtcbiAgICAnQF9JRCc6IG5leHRVSWQoKSxcbiAgICBBdHRyaWJ1dGVMaXN0OiB7XG4gICAgICBBdXRvTnVtYmVyOiAndHJ1ZScsXG4gICAgICBIZWFkZXJBdXRob3I6ICdQbGF4aW8nLFxuICAgICAgSGVhZGVyRmFtaWx5OiAnJyxcbiAgICAgIEhlYWRlck5hbWU6IHBvdS5uYW1lLFxuICAgICAgSGVhZGVyVmVyc2lvbjogJzEuMCcsXG4gICAgICBJbnRlcmZhY2U6IGJ1aWxkU2ltYXRpY0ludGVyZmFjZShwb3UubG9jYWxUYWdzIGFzIFNpZW1lbnNUYWdbXSksXG4gICAgICBJc0lFQ0NoZWNrRW5hYmxlZDogJ2ZhbHNlJyxcbiAgICAgIE1lbW9yeUxheW91dDogJ09wdGltaXplZCcsXG4gICAgICBOYW1lOiBwb3UubmFtZSxcbiAgICAgIE5hbWVzcGFjZTogJycsXG4gICAgICBQcm9ncmFtbWluZ0xhbmd1YWdlOiBwb3UubGFuZ3VhZ2UgPT09ICdGQkQnID8gJ0ZCRCcgOiBwb3UubGFuZ3VhZ2UgPT09ICdTRkMnID8gJ0dSQVBIJyA6IHBvdS5sYW5ndWFnZSA9PT0gJ1NUJyA/ICdTQ0wnIDogJ0xBRCcsXG4gICAgfSxcbiAgICAvLyBGaXggNzogT2JqZWN0TGlzdCB3aXRoIE11bHRpbGluZ3VhbFRleHQgVGl0bGUgYWxvbmdzaWRlIENvbXBpbGVVbml0c1xuICAgIE9iamVjdExpc3Q6IHtcbiAgICAgICdNdWx0aWxpbmd1YWxUZXh0Jzoge1xuICAgICAgICAnQF9JRCc6ICcxJyxcbiAgICAgICAgJ0BfQ29tcG9zaXRpb25OYW1lJzogJ1RpdGxlJyxcbiAgICAgICAgT2JqZWN0TGlzdDoge1xuICAgICAgICAgIE11bHRpbGluZ3VhbFRleHRJdGVtOiB7XG4gICAgICAgICAgICAnQF9JRCc6ICcyJyxcbiAgICAgICAgICAgICdAX0NvbXBvc2l0aW9uTmFtZSc6ICdJdGVtcycsXG4gICAgICAgICAgICBBdHRyaWJ1dGVMaXN0OiB7IEN1bHR1cmU6ICdlbi1VUycsIFRleHQ6IHBvdS5uYW1lIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICAvLyBGaXggNjogQ29tcGlsZVVuaXQgbmVlZHMgQ29tcG9zaXRpb25OYW1lIGF0dHJpYnV0ZVxuICAgICAgJ1NXLkJsb2Nrcy5Db21waWxlVW5pdCc6IG5ldHdvcmtzLm1hcChuID0+ICh7ICdAX0NvbXBvc2l0aW9uTmFtZSc6ICdDb21waWxlVW5pdHMnLCAuLi5uIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+IH0pKSxcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZFNpbWF0aWNJbnRlcmZhY2UodGFnczogU2llbWVuc1RhZ1tdKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICAvLyBHcm91cCB0YWdzIGJ5IHRoZWlyIHN0b3JlZCBzZWN0aW9uIChwcmVzZXJ2ZWQgZnJvbSBpbXBvcnQpXG4gIGNvbnN0IHNlY3Rpb25zOiBSZWNvcmQ8c3RyaW5nLCBTaWVtZW5zVGFnW10+ID0ge1xuICAgIElucHV0OiBbXSwgT3V0cHV0OiBbXSwgSW5PdXQ6IFtdLCBTdGF0aWM6IFtdLCBUZW1wOiBbXSwgQ29uc3RhbnQ6IFtdLCBSZXR1cm46IFtdLFxuICB9O1xuXG4gIGZvciAoY29uc3QgdGFnIG9mIHRhZ3MpIHtcbiAgICBjb25zdCBzZWMgPSB0YWcuc2VjdGlvbiB8fCAnU3RhdGljJztcbiAgICBpZiAoIXNlY3Rpb25zW3NlY10pIHNlY3Rpb25zW3NlY10gPSBbXTtcbiAgICBzZWN0aW9uc1tzZWNdLnB1c2godGFnKTtcbiAgfVxuXG4gIGNvbnN0IHNlY3Rpb25FbnRyaWVzID0gT2JqZWN0LmVudHJpZXMoc2VjdGlvbnMpXG4gICAgLmZpbHRlcigoW18sIHRhZ3NdKSA9PiB0YWdzLmxlbmd0aCA+IDApXG4gICAgLm1hcCgoW25hbWUsIHRhZ3NdKSA9PiAoe1xuICAgICAgJ0BfTmFtZSc6IG5hbWUsXG4gICAgICBNZW1iZXI6IHRhZ3MubWFwKHQgPT4gdGFnVG9TaW1hdGljTWVtYmVyKHQpKSxcbiAgICB9KSk7XG5cbiAgLy8gRW5zdXJlIGF0IGxlYXN0IElucHV0L091dHB1dC9TdGF0aWMgZXhpc3QgZm9yIHZhbGlkIGV4cG9ydFxuICBpZiAoc2VjdGlvbkVudHJpZXMubGVuZ3RoID09PSAwKSB7XG4gICAgc2VjdGlvbkVudHJpZXMucHVzaCh7ICdAX05hbWUnOiAnU3RhdGljJywgTWVtYmVyOiBbXSB9KTtcbiAgfVxuXG4gIC8vIEZpeCAzOiBTZWN0aW9ucyBuZWVkcyB4bWxucyBuYW1lc3BhY2UgYXR0cmlidXRlXG4gIHJldHVybiB7IFNlY3Rpb25zOiB7ICdAX3htbG5zJzogJ2h0dHA6Ly93d3cuc2llbWVucy5jb20vYXV0b21hdGlvbi9PcGVubmVzcy9TVy9JbnRlcmZhY2UvdjInLCBTZWN0aW9uOiBzZWN0aW9uRW50cmllcyB9IH07XG59XG5cbmZ1bmN0aW9uIHRhZ1RvU2ltYXRpY01lbWJlcih0YWc6IE5vcm1hbGl6ZWRUYWcpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgJ0BfTmFtZSc6IHRhZy5uYW1lLFxuICAgICdAX0RhdGF0eXBlJzogaWVjVHlwZVRvU2ltYXRpYyh0YWcuZGF0YVR5cGUpLFxuICAgICdAX0FjY2Vzc2liaWxpdHknOiAnUHVibGljJyxcbiAgICBTdGFydFZhbHVlOiB0YWcuaW5pdGlhbFZhbHVlIHx8IHVuZGVmaW5lZCxcbiAgICAvLyBGaXggNDogTWVtYmVyIENvbW1lbnQgbmVlZHMgTGFuZyBhdHRyaWJ1dGUgYW5kIEluZm9ybWF0aXZlIGF0dHJpYnV0ZVxuICAgIENvbW1lbnQ6IHRhZy5kZXNjcmlwdGlvbiA/IHtcbiAgICAgICdAX0luZm9ybWF0aXZlJzogJ3RydWUnLFxuICAgICAgTXVsdGlMYW5ndWFnZVRleHQ6IHsgJ0BfTGFuZyc6ICdlbi1VUycsICcjdGV4dCc6IHRhZy5kZXNjcmlwdGlvbiB9LFxuICAgIH0gOiB1bmRlZmluZWQsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGJ1aWxkU2ltYXRpY05ldHdvcmtzKFxuICBwb3U6IE5vcm1hbGl6ZWRQT1UsXG4gIG5leHRVSWQ6ICgpID0+IHN0cmluZyxcbiAgd2FybmluZ3M6IHN0cmluZ1tdXG4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdIHtcbiAgaWYgKHBvdS5sYW5ndWFnZSA9PT0gJ0xEJyAmJiBwb3UubGFkZGVyUHJvZ3JhbSkge1xuICAgIHJldHVybiBwb3UubGFkZGVyUHJvZ3JhbS5ydW5ncy5tYXAocnVuZyA9PiBidWlsZFNpbWF0aWNMQUROZXR3b3JrKHJ1bmcsIG5leHRVSWQpKTtcbiAgfVxuICBpZiAocG91Lmxhbmd1YWdlID09PSAnRkJEJyAmJiBwb3UuZmJkUHJvZ3JhbSkge1xuICAgIHJldHVybiBbYnVpbGRTaW1hdGljRkJETmV0d29yayhwb3UuZmJkUHJvZ3JhbSwgbmV4dFVJZCldO1xuICB9XG4gIGlmIChwb3UubGFuZ3VhZ2UgPT09ICdTRkMnICYmIHBvdS5zZmNQcm9ncmFtKSB7XG4gICAgcmV0dXJuIGJ1aWxkU2ltYXRpY0dSQVBITmV0d29ya3MocG91LnNmY1Byb2dyYW0sIG5leHRVSWQpO1xuICB9XG4gIGlmIChwb3UubGFuZ3VhZ2UgPT09ICdTVCcgJiYgcG91LnN0U291cmNlKSB7XG4gICAgcmV0dXJuIFt7XG4gICAgICAnQF9JRCc6IG5leHRVSWQoKSxcbiAgICAgIEF0dHJpYnV0ZUxpc3Q6IHtcbiAgICAgICAgUHJvZ3JhbW1pbmdMYW5ndWFnZTogJ1NDTCcsXG4gICAgICAgIE5ldHdvcmtTb3VyY2U6IHtcbiAgICAgICAgICBTdHJ1Y3R1cmVkVGV4dDogcG91LnN0U291cmNlIHx8ICcnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9XTtcbiAgfVxuICB3YXJuaW5ncy5wdXNoKGBQT1UgXCIke3BvdS5uYW1lfVwiOiBsYW5ndWFnZSAke3BvdS5sYW5ndWFnZX0gXHUyMDE0IGV4cG9ydCBhcyBlbXB0eSBuZXR3b3JrYCk7XG4gIHJldHVybiBbeyAnQF9JRCc6IG5leHRVSWQoKSwgQXR0cmlidXRlTGlzdDogeyBQcm9ncmFtbWluZ0xhbmd1YWdlOiAnTEFEJywgTmV0d29ya1NvdXJjZToge30gfSB9XTtcbn1cblxuZnVuY3Rpb24gYnVpbGRTaW1hdGljTEFETmV0d29yayhydW5nOiBSdW5nLCBuZXh0VUlkOiAoKSA9PiBzdHJpbmcpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIC8vIFJlYWwgVElBIFBvcnRhbCBGbGdOZXQgc3RydWN0dXJlOlxuICAvLyBQYXJ0cyBjb250YWluczogQWNjZXNzIGVsZW1lbnRzICh2YXJpYWJsZXMpICsgUGFydCBlbGVtZW50cyAoaW5zdHJ1Y3Rpb25zKSArIENhbGwgZWxlbWVudHNcbiAgLy8gV2lyZXMgY29udGFpbnM6IFdpcmUgZWxlbWVudHMgd2l0aCBQb3dlcnJhaWwsIE5hbWVDb24sIElkZW50Q29uIGNoaWxkcmVuXG4gIC8vIEFjY2VzcyBhbmQgUGFydCBhcmUgU0VQQVJBVEUgXHUyMDE0IFBhcnQgcmVmZXJlbmNlcyBpdHMgb3BlcmFuZCB2aWEgYSB3aXJlIHdpdGggSWRlbnRDb25cdTIxOTJOYW1lQ29uKG9wZXJhbmQpXG5cbiAgY29uc3QgYWNjZXNzZXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+W10gPSBbXTtcbiAgY29uc3QgcGFydHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+W10gPSBbXTtcbiAgY29uc3QgY2FsbHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+W10gPSBbXTtcbiAgY29uc3Qgd2lyZXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+W10gPSBbXTtcblxuICAvLyBDb2xsZWN0IGFsbCBlbGVtZW50cyAobWFpbiArIGJyYW5jaGVzKSBmb3IgZXhwb3J0XG4gIGNvbnN0IGFsbEVsZW1lbnRzID0gWy4uLnJ1bmcuZWxlbWVudHNdO1xuICBmb3IgKGNvbnN0IGJyYW5jaCBvZiBydW5nLmJyYW5jaGVzKSB7XG4gICAgYWxsRWxlbWVudHMucHVzaCguLi5icmFuY2guZWxlbWVudHMpO1xuICB9XG5cbiAgLy8gRmlyc3QgcGFzczogY3JlYXRlIFBhcnQgKyBBY2Nlc3MgVUlEcyBmb3IgZWFjaCBlbGVtZW50XG4gIGludGVyZmFjZSBQYXJ0SW5mbyB7IHBhcnRVSWQ6IHN0cmluZzsgYWNjZXNzVUlkOiBzdHJpbmc7IHBhcnROYW1lOiBzdHJpbmc7IH1cbiAgY29uc3QgZWxlbWVudFBhcnRJbmZvczogUGFydEluZm9bXSA9IFtdO1xuICBsZXQgZmlyc3RQYXJ0VUlkID0gJyc7XG5cbiAgZm9yIChjb25zdCBlbCBvZiBhbGxFbGVtZW50cykge1xuICAgIGlmIChlbC5raW5kID09PSAnY29udGFjdCcpIHtcbiAgICAgIGNvbnN0IGMgPSBlbCBhcyBDb250YWN0RWxlbWVudDtcbiAgICAgIGNvbnN0IHBhcnRVSWQgPSBuZXh0VUlkKCk7XG4gICAgICBjb25zdCBhY2Nlc3NVSWQgPSBuZXh0VUlkKCk7XG4gICAgICBpZiAoIWZpcnN0UGFydFVJZCkgZmlyc3RQYXJ0VUlkID0gcGFydFVJZDtcblxuICAgICAgLy8gRGV0ZXJtaW5lIFBhcnQgTmFtZVxuICAgICAgbGV0IHBhcnROYW1lID0gJ0NvbnRhY3QnO1xuICAgICAgaWYgKGMudHlwZSA9PT0gJ1BfQ09OVEFDVCcpIHBhcnROYW1lID0gJ1BDb250YWN0JztcbiAgICAgIGVsc2UgaWYgKGMudHlwZSA9PT0gJ05fQ09OVEFDVCcpIHBhcnROYW1lID0gJ05Db250YWN0JztcblxuICAgICAgLy8gQWNjZXNzIGVsZW1lbnQgKHZhcmlhYmxlIHJlZmVyZW5jZSlcbiAgICAgIGNvbnN0IHRhZ1BhcnRzID0gYy50YWcubmFtZS5zcGxpdCgnLicpO1xuICAgICAgY29uc3Qgc3ltYm9sQ29tcG9uZW50ID0gdGFnUGFydHMubGVuZ3RoID09PSAxXG4gICAgICAgID8geyBDb21wb25lbnQ6IHsgJ0BfTmFtZSc6IHRhZ1BhcnRzWzBdIH0gfVxuICAgICAgICA6IHsgQ29tcG9uZW50OiB0YWdQYXJ0cy5tYXAocCA9PiAoeyAnQF9OYW1lJzogcCB9KSkgfTtcbiAgICAgIGFjY2Vzc2VzLnB1c2goeyAnQF9TY29wZSc6ICdMb2NhbFZhcmlhYmxlJywgJ0BfVUlkJzogYWNjZXNzVUlkLCBTeW1ib2w6IHN5bWJvbENvbXBvbmVudCB9KTtcblxuICAgICAgLy8gUGFydCBlbGVtZW50IChpbnN0cnVjdGlvbilcbiAgICAgIGNvbnN0IHBhcnRPYmo6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0geyAnQF9OYW1lJzogcGFydE5hbWUsICdAX1VJZCc6IHBhcnRVSWQgfTtcbiAgICAgIGlmIChjLnR5cGUgPT09ICdOQycpIHBhcnRPYmpbJ0BfTmVnYXRlZCddID0gJ3RydWUnO1xuICAgICAgcGFydHMucHVzaChwYXJ0T2JqKTtcblxuICAgICAgZWxlbWVudFBhcnRJbmZvcy5wdXNoKHsgcGFydFVJZCwgYWNjZXNzVUlkLCBwYXJ0TmFtZSB9KTtcbiAgICB9IGVsc2UgaWYgKGVsLmtpbmQgPT09ICdjb2lsJykge1xuICAgICAgY29uc3QgYyA9IGVsIGFzIENvaWxFbGVtZW50O1xuICAgICAgY29uc3QgcGFydFVJZCA9IG5leHRVSWQoKTtcbiAgICAgIGNvbnN0IGFjY2Vzc1VJZCA9IG5leHRVSWQoKTtcbiAgICAgIGlmICghZmlyc3RQYXJ0VUlkKSBmaXJzdFBhcnRVSWQgPSBwYXJ0VUlkO1xuXG4gICAgICBsZXQgcGFydE5hbWUgPSAnQ29pbCc7XG4gICAgICBpZiAoYy50eXBlID09PSAnc2V0JyB8fCBjLnR5cGUgPT09ICdsYXRjaCcpIHBhcnROYW1lID0gJ1NDb2lsJztcbiAgICAgIGVsc2UgaWYgKGMudHlwZSA9PT0gJ3Jlc2V0JyB8fCBjLnR5cGUgPT09ICd1bmxhdGNoJykgcGFydE5hbWUgPSAnUkNvaWwnO1xuXG4gICAgICBjb25zdCB0YWdQYXJ0cyA9IGMudGFnLm5hbWUuc3BsaXQoJy4nKTtcbiAgICAgIGNvbnN0IHN5bWJvbENvbXBvbmVudCA9IHRhZ1BhcnRzLmxlbmd0aCA9PT0gMVxuICAgICAgICA/IHsgQ29tcG9uZW50OiB7ICdAX05hbWUnOiB0YWdQYXJ0c1swXSB9IH1cbiAgICAgICAgOiB7IENvbXBvbmVudDogdGFnUGFydHMubWFwKHAgPT4gKHsgJ0BfTmFtZSc6IHAgfSkpIH07XG4gICAgICBhY2Nlc3Nlcy5wdXNoKHsgJ0BfU2NvcGUnOiAnTG9jYWxWYXJpYWJsZScsICdAX1VJZCc6IGFjY2Vzc1VJZCwgU3ltYm9sOiBzeW1ib2xDb21wb25lbnQgfSk7XG5cbiAgICAgIGNvbnN0IHBhcnRPYmo6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0geyAnQF9OYW1lJzogcGFydE5hbWUsICdAX1VJZCc6IHBhcnRVSWQgfTtcbiAgICAgIGlmIChjLnR5cGUgPT09ICduZWdhdGVkJykgcGFydE9ialsnQF9OZWdhdGVkJ10gPSAndHJ1ZSc7XG4gICAgICBwYXJ0cy5wdXNoKHBhcnRPYmopO1xuXG4gICAgICBlbGVtZW50UGFydEluZm9zLnB1c2goeyBwYXJ0VUlkLCBhY2Nlc3NVSWQsIHBhcnROYW1lIH0pO1xuICAgIH0gZWxzZSBpZiAoZWwua2luZCA9PT0gJ2Jsb2NrJykge1xuICAgICAgY29uc3QgYiA9IGVsIGFzIEJsb2NrRWxlbWVudDtcbiAgICAgIGNvbnN0IGNhbGxVSWQgPSBuZXh0VUlkKCk7XG4gICAgICBpZiAoIWZpcnN0UGFydFVJZCkgZmlyc3RQYXJ0VUlkID0gY2FsbFVJZDtcbiAgICAgIGNvbnN0IGV4cG9ydE5hbWUgPSBiLnZlbmRvck9yaWdpbmFsTmFtZSB8fCBjbG1GQlR5cGVUb1NpZW1lbnMoYi5mYlR5cGUpO1xuICAgICAgY29uc3QgaW5zdGFuY2VVSWQgPSBuZXh0VUlkKCk7XG5cbiAgICAgIGNvbnN0IHRhZ1BhcnRzID0gYi5pbnN0YW5jZU5hbWUuc3BsaXQoJy4nKTtcbiAgICAgIGNvbnN0IGluc3RhbmNlQ29tcG9uZW50ID0gdGFnUGFydHMubGVuZ3RoID09PSAxXG4gICAgICAgID8geyAnQF9OYW1lJzogdGFnUGFydHNbMF0gfVxuICAgICAgICA6IHRhZ1BhcnRzLm1hcChwID0+ICh7ICdAX05hbWUnOiBwIH0pKTtcblxuICAgICAgY29uc3QgY2FsbE9iajogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgICAgICdAX1VJZCc6IGNhbGxVSWQsXG4gICAgICAgIENhbGxJbmZvOiB7XG4gICAgICAgICAgJ0BfTmFtZSc6IGV4cG9ydE5hbWUsXG4gICAgICAgICAgJ0BfQmxvY2tUeXBlJzogKGIgYXMgYW55KS52ZW5kb3JCbG9ja1R5cGUgfHwgJ0ZCJyxcbiAgICAgICAgICBJbnN0YW5jZToge1xuICAgICAgICAgICAgJ0BfU2NvcGUnOiAnTG9jYWxWYXJpYWJsZScsXG4gICAgICAgICAgICAnQF9VSWQnOiBpbnN0YW5jZVVJZCxcbiAgICAgICAgICAgIENvbXBvbmVudDogaW5zdGFuY2VDb21wb25lbnQsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH07XG4gICAgICBjYWxscy5wdXNoKGNhbGxPYmopO1xuICAgICAgZWxlbWVudFBhcnRJbmZvcy5wdXNoKHsgcGFydFVJZDogY2FsbFVJZCwgYWNjZXNzVUlkOiAnJywgcGFydE5hbWU6ICdDYWxsJyB9KTtcbiAgICB9XG4gIH1cblxuICAvLyBTZWNvbmQgcGFzczogZ2VuZXJhdGUgd2lyZXMgKFBvd2VycmFpbFx1MjE5MmZpcnN0LmluLCBvdXRcdTIxOTJpbiBjaGFpbnMsIG9wZXJhbmQgd2lyZXMpXG4gIC8vIFByb2Nlc3MgbWFpbiBydW5nIGVsZW1lbnRzXG4gIGxldCBwcmV2UGFydFVJZCA9ICcnO1xuICBsZXQgbWFpbklkeCA9IDA7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcnVuZy5lbGVtZW50cy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGluZm8gPSBlbGVtZW50UGFydEluZm9zW21haW5JZHhdO1xuICAgIG1haW5JZHgrKztcbiAgICBjb25zdCBlbCA9IHJ1bmcuZWxlbWVudHNbaV07XG5cbiAgICBpZiAoZWwua2luZCA9PT0gJ2Jsb2NrJykge1xuICAgICAgLy8gUG93ZXJyYWlsIG9yIHByZXYgXHUyMTkyIGVuIHBpblxuICAgICAgaWYgKHByZXZQYXJ0VUlkID09PSAnJykge1xuICAgICAgICB3aXJlcy5wdXNoKHsgJ0BfVUlkJzogbmV4dFVJZCgpLCBQb3dlcnJhaWw6IHt9LCBOYW1lQ29uOiB7ICdAX1VJZCc6IGluZm8ucGFydFVJZCwgJ0BfTmFtZSc6ICdlbicgfSB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHdpcmVzLnB1c2goeyAnQF9VSWQnOiBuZXh0VUlkKCksIE5hbWVDb246IFt7ICdAX1VJZCc6IHByZXZQYXJ0VUlkLCAnQF9OYW1lJzogJ291dCcgfSwgeyAnQF9VSWQnOiBpbmZvLnBhcnRVSWQsICdAX05hbWUnOiAnZW4nIH1dIH0pO1xuICAgICAgfVxuICAgICAgcHJldlBhcnRVSWQgPSBpbmZvLnBhcnRVSWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIENvbnRhY3QvQ29pbDogUG93ZXJyYWlsIG9yIHByZXYgXHUyMTkyIGluIHBpblxuICAgICAgaWYgKHByZXZQYXJ0VUlkID09PSAnJykge1xuICAgICAgICB3aXJlcy5wdXNoKHsgJ0BfVUlkJzogbmV4dFVJZCgpLCBQb3dlcnJhaWw6IHt9LCBOYW1lQ29uOiB7ICdAX1VJZCc6IGluZm8ucGFydFVJZCwgJ0BfTmFtZSc6ICdpbicgfSB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHdpcmVzLnB1c2goeyAnQF9VSWQnOiBuZXh0VUlkKCksIE5hbWVDb246IFt7ICdAX1VJZCc6IHByZXZQYXJ0VUlkLCAnQF9OYW1lJzogJ291dCcgfSwgeyAnQF9VSWQnOiBpbmZvLnBhcnRVSWQsICdAX05hbWUnOiAnaW4nIH1dIH0pO1xuICAgICAgfVxuICAgICAgLy8gT3BlcmFuZCB3aXJlOiBJZGVudENvbihhY2Nlc3NVSWQpIFx1MjE5MiBOYW1lQ29uKHBhcnRVSWQsIG9wZXJhbmQpXG4gICAgICBpZiAoaW5mby5hY2Nlc3NVSWQpIHtcbiAgICAgICAgd2lyZXMucHVzaCh7ICdAX1VJZCc6IG5leHRVSWQoKSwgSWRlbnRDb246IHsgJ0BfVUlkJzogaW5mby5hY2Nlc3NVSWQgfSwgTmFtZUNvbjogeyAnQF9VSWQnOiBpbmZvLnBhcnRVSWQsICdAX05hbWUnOiAnb3BlcmFuZCcgfSB9KTtcbiAgICAgIH1cbiAgICAgIHByZXZQYXJ0VUlkID0gaW5mby5wYXJ0VUlkO1xuICAgIH1cbiAgfVxuXG4gIC8vIEJyYW5jaCBlbGVtZW50cyBcdTIwMTQgZWFjaCBicmFuY2ggc3RhcnRzIGZyb20gcG93ZXJyYWlsIG9yIGEgYnJhbmNoIHBvaW50XG4gIGZvciAoY29uc3QgYnJhbmNoIG9mIHJ1bmcuYnJhbmNoZXMpIHtcbiAgICBsZXQgYnJhbmNoUHJldlBhcnRVSWQgPSAnJztcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJyYW5jaC5lbGVtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaW5mbyA9IGVsZW1lbnRQYXJ0SW5mb3NbbWFpbklkeF07XG4gICAgICBtYWluSWR4Kys7XG4gICAgICBjb25zdCBlbCA9IGJyYW5jaC5lbGVtZW50c1tpXTtcblxuICAgICAgaWYgKGVsLmtpbmQgPT09ICdibG9jaycpIHtcbiAgICAgICAgaWYgKGJyYW5jaFByZXZQYXJ0VUlkID09PSAnJykge1xuICAgICAgICAgIHdpcmVzLnB1c2goeyAnQF9VSWQnOiBuZXh0VUlkKCksIFBvd2VycmFpbDoge30sIE5hbWVDb246IHsgJ0BfVUlkJzogaW5mby5wYXJ0VUlkLCAnQF9OYW1lJzogJ2VuJyB9IH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHdpcmVzLnB1c2goeyAnQF9VSWQnOiBuZXh0VUlkKCksIE5hbWVDb246IFt7ICdAX1VJZCc6IGJyYW5jaFByZXZQYXJ0VUlkLCAnQF9OYW1lJzogJ291dCcgfSwgeyAnQF9VSWQnOiBpbmZvLnBhcnRVSWQsICdAX05hbWUnOiAnZW4nIH1dIH0pO1xuICAgICAgICB9XG4gICAgICAgIGJyYW5jaFByZXZQYXJ0VUlkID0gaW5mby5wYXJ0VUlkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGJyYW5jaFByZXZQYXJ0VUlkID09PSAnJykge1xuICAgICAgICAgIHdpcmVzLnB1c2goeyAnQF9VSWQnOiBuZXh0VUlkKCksIFBvd2VycmFpbDoge30sIE5hbWVDb246IHsgJ0BfVUlkJzogaW5mby5wYXJ0VUlkLCAnQF9OYW1lJzogJ2luJyB9IH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHdpcmVzLnB1c2goeyAnQF9VSWQnOiBuZXh0VUlkKCksIE5hbWVDb246IFt7ICdAX1VJZCc6IGJyYW5jaFByZXZQYXJ0VUlkLCAnQF9OYW1lJzogJ291dCcgfSwgeyAnQF9VSWQnOiBpbmZvLnBhcnRVSWQsICdAX05hbWUnOiAnaW4nIH1dIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpbmZvLmFjY2Vzc1VJZCkge1xuICAgICAgICAgIHdpcmVzLnB1c2goeyAnQF9VSWQnOiBuZXh0VUlkKCksIElkZW50Q29uOiB7ICdAX1VJZCc6IGluZm8uYWNjZXNzVUlkIH0sIE5hbWVDb246IHsgJ0BfVUlkJzogaW5mby5wYXJ0VUlkLCAnQF9OYW1lJzogJ29wZXJhbmQnIH0gfSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJhbmNoUHJldlBhcnRVSWQgPSBpbmZvLnBhcnRVSWQ7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gQnVpbGQgUGFydHMgb2JqZWN0OiBBY2Nlc3MgZWxlbWVudHMgZmlyc3QsIHRoZW4gUGFydCBlbGVtZW50cywgdGhlbiBDYWxsIGVsZW1lbnRzXG4gIGNvbnN0IHBhcnRzT2JqOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHt9O1xuICBpZiAoYWNjZXNzZXMubGVuZ3RoKSBwYXJ0c09iai5BY2Nlc3MgPSBhY2Nlc3NlcztcbiAgaWYgKHBhcnRzLmxlbmd0aCkgcGFydHNPYmouUGFydCA9IHBhcnRzO1xuICBpZiAoY2FsbHMubGVuZ3RoKSBwYXJ0c09iai5DYWxsID0gY2FsbHM7XG5cbiAgLy8gQnVpbGQgT2JqZWN0TGlzdCB3aXRoIENvbW1lbnQgYW5kIFRpdGxlIE11bHRpbGluZ3VhbFRleHRcbiAgY29uc3Qgb2JqZWN0TGlzdEl0ZW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHt9O1xuICBpZiAocnVuZy5jb21tZW50KSB7XG4gICAgb2JqZWN0TGlzdEl0ZW1zWydNdWx0aWxpbmd1YWxUZXh0J10gPSBbXG4gICAgICB7XG4gICAgICAgICdAX0lEJzogbmV4dFVJZCgpLFxuICAgICAgICAnQF9Db21wb3NpdGlvbk5hbWUnOiAnQ29tbWVudCcsXG4gICAgICAgIE9iamVjdExpc3Q6IHtcbiAgICAgICAgICBNdWx0aWxpbmd1YWxUZXh0SXRlbToge1xuICAgICAgICAgICAgJ0BfSUQnOiBuZXh0VUlkKCksXG4gICAgICAgICAgICAnQF9Db21wb3NpdGlvbk5hbWUnOiAnSXRlbXMnLFxuICAgICAgICAgICAgQXR0cmlidXRlTGlzdDogeyBDdWx0dXJlOiAnZW4tVVMnLCBUZXh0OiBydW5nLmNvbW1lbnQgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgJ0BfSUQnOiBuZXh0VUlkKCksXG4gICAgICAgICdAX0NvbXBvc2l0aW9uTmFtZSc6ICdUaXRsZScsXG4gICAgICAgIE9iamVjdExpc3Q6IHtcbiAgICAgICAgICBNdWx0aWxpbmd1YWxUZXh0SXRlbToge1xuICAgICAgICAgICAgJ0BfSUQnOiBuZXh0VUlkKCksXG4gICAgICAgICAgICAnQF9Db21wb3NpdGlvbk5hbWUnOiAnSXRlbXMnLFxuICAgICAgICAgICAgQXR0cmlidXRlTGlzdDogeyBDdWx0dXJlOiAnZW4tVVMnLCBUZXh0OiAnJyB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIF07XG4gIH1cblxuICByZXR1cm4ge1xuICAgICdAX0lEJzogbmV4dFVJZCgpLFxuICAgICdAX0NvbXBvc2l0aW9uTmFtZSc6ICdDb21waWxlVW5pdHMnLFxuICAgIEF0dHJpYnV0ZUxpc3Q6IHtcbiAgICAgIE5ldHdvcmtTb3VyY2U6IHtcbiAgICAgICAgRmxnTmV0OiB7XG4gICAgICAgICAgJ0BfeG1sbnMnOiAnaHR0cDovL3d3dy5zaWVtZW5zLmNvbS9hdXRvbWF0aW9uL09wZW5uZXNzL1NXL05ldHdvcmtTb3VyY2UvRmxnTmV0L3Y0JyxcbiAgICAgICAgICBQYXJ0czogcGFydHNPYmosXG4gICAgICAgICAgV2lyZXM6IHsgV2lyZTogd2lyZXMgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBQcm9ncmFtbWluZ0xhbmd1YWdlOiAnTEFEJyxcbiAgICB9LFxuICAgIE9iamVjdExpc3Q6IE9iamVjdC5rZXlzKG9iamVjdExpc3RJdGVtcykubGVuZ3RoID4gMCA/IG9iamVjdExpc3RJdGVtcyA6IHtcbiAgICAgIE11bHRpbGluZ3VhbFRleHQ6IFtcbiAgICAgICAge1xuICAgICAgICAgICdAX0lEJzogbmV4dFVJZCgpLFxuICAgICAgICAgICdAX0NvbXBvc2l0aW9uTmFtZSc6ICdDb21tZW50JyxcbiAgICAgICAgICBPYmplY3RMaXN0OiB7IE11bHRpbGluZ3VhbFRleHRJdGVtOiB7ICdAX0lEJzogbmV4dFVJZCgpLCAnQF9Db21wb3NpdGlvbk5hbWUnOiAnSXRlbXMnLCBBdHRyaWJ1dGVMaXN0OiB7IEN1bHR1cmU6ICdlbi1VUycsIFRleHQ6ICcnIH0gfSB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgJ0BfSUQnOiBuZXh0VUlkKCksXG4gICAgICAgICAgJ0BfQ29tcG9zaXRpb25OYW1lJzogJ1RpdGxlJyxcbiAgICAgICAgICBPYmplY3RMaXN0OiB7IE11bHRpbGluZ3VhbFRleHRJdGVtOiB7ICdAX0lEJzogbmV4dFVJZCgpLCAnQF9Db21wb3NpdGlvbk5hbWUnOiAnSXRlbXMnLCBBdHRyaWJ1dGVMaXN0OiB7IEN1bHR1cmU6ICdlbi1VUycsIFRleHQ6ICcnIH0gfSB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZFNpbWF0aWNGQkROZXR3b3JrKGZiZDogRkJEUHJvZ3JhbSwgbmV4dFVJZDogKCkgPT4gc3RyaW5nKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICBjb25zdCBwYXJ0czogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSA9IFtdO1xuICBjb25zdCBhY2Nlc3NlczogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSA9IFtdO1xuICBjb25zdCB3aXJlczogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSA9IFtdO1xuXG4gIC8vIEVtaXQgYmxvY2tzIGFzIFBhcnQgZWxlbWVudHMsIHZhcmlhYmxlcyBhcyBBY2Nlc3MgZWxlbWVudHNcbiAgZm9yIChjb25zdCBub2RlIG9mIGZiZC5ub2Rlcykge1xuICAgIGNvbnN0IHVpZCA9IG5vZGUuaWQucmVwbGFjZSgnZmJkLScsICcnKSB8fCBuZXh0VUlkKCk7XG4gICAgaWYgKG5vZGUudHlwZSA9PT0gJ0lOX1ZBUklBQkxFJyB8fCBub2RlLnR5cGUgPT09ICdPVVRfVkFSSUFCTEUnKSB7XG4gICAgICAvLyBGaXggMTE6IGhhbmRsZSBkb3QtcGF0aCB0YWcgbmFtZXMgdXNpbmcgbXVsdGlwbGUgQ29tcG9uZW50IGVsZW1lbnRzXG4gICAgICBjb25zdCB0YWdQYXJ0cyA9IChub2RlLnRhZz8ubmFtZSB8fCAnJykuc3BsaXQoJy4nKTtcbiAgICAgIGNvbnN0IHN5bWJvbENvbXBvbmVudCA9IHRhZ1BhcnRzLmxlbmd0aCA9PT0gMVxuICAgICAgICA/IHsgQ29tcG9uZW50OiB7ICdAX05hbWUnOiB0YWdQYXJ0c1swXSB9IH1cbiAgICAgICAgOiB7IENvbXBvbmVudDogdGFnUGFydHMubWFwKHAgPT4gKHsgJ0BfTmFtZSc6IHAgfSkpIH07XG4gICAgICBhY2Nlc3Nlcy5wdXNoKHtcbiAgICAgICAgJ0BfVUlkJzogdWlkLFxuICAgICAgICAnQF9TY29wZSc6ICdHbG9iYWxWYXJpYWJsZScsXG4gICAgICAgIFN5bWJvbDogc3ltYm9sQ29tcG9uZW50LFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRlbXBsYXRlVmFsdWUgc3BlY2lmaWVzIHRoZSBTSU1BVElDIGRhdGEgdHlwZSBmb3IgZ2VuZXJpYy9wb2x5bW9ycGhpYyBpbnN0cnVjdGlvbnNcbiAgICAgIC8vIChlLmcuIEFERCwgTU9WRSkuIEBfVHlwZSBtdXN0IGJlIGEgU0lNQVRJQyB0eXBlIHN0cmluZyBsaWtlICdJbnQnLCAnUmVhbCcsIG5vdCBhIGRpcmVjdGlvbi5cbiAgICAgIC8vIFdlIGVtaXQgVGVtcGxhdGVWYWx1ZSBvbmx5IGlmIHRoZXJlIGlzIGEgbm9uLUJPT0wgdHlwZWQgaW5wdXQgcGluIHRvIHBhcmFtZXRlcml6ZS5cbiAgICAgIGNvbnN0IHRlbXBsYXRlVmFsdWVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+W10gPSBbXTtcbiAgICAgIGZvciAoY29uc3QgcGluIG9mIChub2RlLmlucHV0cyB8fCBbXSkpIHtcbiAgICAgICAgaWYgKHBpbi5kYXRhVHlwZSAmJiBwaW4uZGF0YVR5cGUgIT09ICdCT09MJyAmJiAocGluLmRhdGFUeXBlIGFzIHN0cmluZykgIT09ICdBTlknKSB7XG4gICAgICAgICAgY29uc3Qgc2ltYXRpY1R5cGUgPSBpZWNUeXBlVG9TaW1hdGljKHBpbi5kYXRhVHlwZSBhcyBpbXBvcnQoJy4uLy4uL2xvZ2ljU3RvcmUuanMnKS5JRUNEYXRhVHlwZSkgfHwgcGluLmRhdGFUeXBlO1xuICAgICAgICAgIHRlbXBsYXRlVmFsdWVzLnB1c2goeyAnQF9OYW1lJzogJ0NhcmQnLCAnQF9UeXBlJzogc2ltYXRpY1R5cGUgfSk7XG4gICAgICAgICAgYnJlYWs7IC8vIG9uZSBUZW1wbGF0ZVZhbHVlIHBlciBibG9jayBpcyBzdWZmaWNpZW50IGZvciB0eXBlIGluZmVyZW5jZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCBmYmRFeHBvcnROYW1lID0gbm9kZS52ZW5kb3JPcmlnaW5hbE5hbWUgfHwgY2xtRkJUeXBlVG9TaWVtZW5zKG5vZGUudHlwZSBhcyBGQlR5cGUpO1xuICAgICAgcGFydHMucHVzaCh7XG4gICAgICAgICdAX05hbWUnOiBmYmRFeHBvcnROYW1lLFxuICAgICAgICAnQF9VSWQnOiB1aWQsXG4gICAgICAgIC4uLih0ZW1wbGF0ZVZhbHVlcy5sZW5ndGggPiAwID8geyBUZW1wbGF0ZVZhbHVlOiB0ZW1wbGF0ZVZhbHVlcyB9IDoge30pLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gRW1pdCB3aXJlcyB3aXRoIE5hbWVDb24gcGFpcnNcbiAgZm9yIChjb25zdCB3aXJlIG9mIGZiZC53aXJlcykge1xuICAgIHdpcmVzLnB1c2goe1xuICAgICAgJ0BfVUlkJzogbmV4dFVJZCgpLFxuICAgICAgTmFtZUNvbjogW1xuICAgICAgICB7ICdAX1VJZCc6IHdpcmUuZnJvbS5ub2RlSWQucmVwbGFjZSgnZmJkLScsICcnKSwgJ0BfTmFtZSc6IHdpcmUuZnJvbS5waW4gfSxcbiAgICAgICAgeyAnQF9VSWQnOiB3aXJlLnRvLm5vZGVJZC5yZXBsYWNlKCdmYmQtJywgJycpLCAnQF9OYW1lJzogd2lyZS50by5waW4gfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBwYXJ0c09iajogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fTtcbiAgaWYgKHBhcnRzLmxlbmd0aCkgcGFydHNPYmouUGFydCA9IHBhcnRzO1xuICBpZiAoYWNjZXNzZXMubGVuZ3RoKSBwYXJ0c09iai5BY2Nlc3MgPSBhY2Nlc3NlcztcblxuICByZXR1cm4ge1xuICAgICdAX0lEJzogbmV4dFVJZCgpLFxuICAgIEF0dHJpYnV0ZUxpc3Q6IHtcbiAgICAgIFByb2dyYW1taW5nTGFuZ3VhZ2U6ICdGQkQnLFxuICAgICAgTmV0d29ya1NvdXJjZToge1xuICAgICAgICBGbGdOZXQ6IHtcbiAgICAgICAgICAnQF94bWxucyc6ICdodHRwOi8vd3d3LnNpZW1lbnMuY29tL2F1dG9tYXRpb24vT3Blbm5lc3MvU1cvTmV0d29ya1NvdXJjZS9GbGdOZXQvdjQnLFxuICAgICAgICAgIFBhcnRzOiBwYXJ0c09iaixcbiAgICAgICAgICBXaXJlczogeyBXaXJlOiB3aXJlcy5sZW5ndGggPyB3aXJlcyA6IFtdIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBHUkFQSCAoU0ZDKSBleHBvcnQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGJ1aWxkU2ltYXRpY0dSQVBITmV0d29ya3MoXG4gIHNmYzogU0ZDUHJvZ3JhbSxcbiAgbmV4dFVJZDogKCkgPT4gc3RyaW5nLFxuKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSB7XG4gIC8vIEFzc2lnbiBzdGFibGUgTnVtYmVyIGF0dHJpYnV0ZXMgXHUyMDE0IGV4dHJhY3QgZnJvbSBJRHMgb3IgYWxsb2NhdGUgZnJlc2ggb25lc1xuICBsZXQgY291bnRlciA9IDE7XG4gIGNvbnN0IGFsbG9jTnVtID0gKGlkOiBzdHJpbmcsIHByZWZpeDogc3RyaW5nKTogc3RyaW5nID0+IHtcbiAgICBjb25zdCBtID0gaWQubWF0Y2gobmV3IFJlZ0V4cChgXiR7cHJlZml4fShcXFxcZCspJGApKTtcbiAgICByZXR1cm4gbSA/IG1bMV0gOiBTdHJpbmcoY291bnRlcisrKTtcbiAgfTtcblxuICAvLyBCdWlsZCBzdGVwIFx1MjE5MiBOdW1iZXIgbWFwXG4gIGNvbnN0IHN0ZXBOdW1NYXAgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBmb3IgKGNvbnN0IHN0ZXAgb2Ygc2ZjLnN0ZXBzKSB7XG4gICAgc3RlcE51bU1hcC5zZXQoc3RlcC5pZCwgYWxsb2NOdW0oc3RlcC5pZCwgJ3NpZW1lbnMtc3RlcC0nKSk7XG4gIH1cblxuICAvLyBCdWlsZCB0cmFuc2l0aW9uIFx1MjE5MiBOdW1iZXIgbWFwXG4gIGNvbnN0IHRyYW5zTnVtTWFwID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgZm9yIChjb25zdCB0cmFucyBvZiBzZmMudHJhbnNpdGlvbnMpIHtcbiAgICB0cmFuc051bU1hcC5zZXQodHJhbnMuaWQsIGFsbG9jTnVtKHRyYW5zLmlkLCAnc2llbWVucy10cmFucy0nKSk7XG4gIH1cblxuICAvLyBCdWlsZCBleHBvcnRzIGFycmF5c1xuICBjb25zdCBleHBvcnRlZFN0ZXBzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdID0gc2ZjLnN0ZXBzLm1hcChzdGVwID0+IHtcbiAgICBjb25zdCBudW0gPSBzdGVwTnVtTWFwLmdldChzdGVwLmlkKSB8fCBTdHJpbmcoY291bnRlcisrKTtcbiAgICAvLyBSZWFsIFRJQSBHUkFQSCBmb3JtYXQ6IEFjdGlvbnMgY29udGFpbnMgVGl0bGUgKE11bHRpTGFuZ3VhZ2VUZXh0KSwgbm90IEFjdGlvbiBlbGVtZW50c1xuICAgIGNvbnN0IGFjdGlvblRpdGxlID0gc3RlcC5hY3Rpb25zLmxlbmd0aCA+IDAgPyBzdGVwLmFjdGlvbnNbMF0udGFnLm5hbWUgOiBzdGVwLm5hbWU7XG4gICAgLy8gU3VwZXJ2aXNpb25zIGFuZCBJbnRlcmxvY2tzIHVzZSBpbmxpbmUgRmxnTmV0IHdpdGggU3ZDb2lsL0lsQ29pbCBQYXJ0XG4gICAgY29uc3Qgc3ZGbGdOZXQgPSB7IFBhcnRzOiB7IFBhcnQ6IHsgJ0BfTmFtZSc6ICdTdkNvaWwnLCAnQF9VSWQnOiAnMjEnIH0gfSwgV2lyZXM6IHsgV2lyZTogeyAnQF9VSWQnOiAnMjInLCBQb3dlcnJhaWw6IHt9LCBOYW1lQ29uOiB7ICdAX1VJZCc6ICcyMScsICdAX05hbWUnOiAnaW4nIH0gfSB9IH07XG4gICAgY29uc3QgaWxGbGdOZXQgPSB7IFBhcnRzOiB7IFBhcnQ6IHsgJ0BfTmFtZSc6ICdJbENvaWwnLCAnQF9VSWQnOiAnMjEnIH0gfSwgV2lyZXM6IHsgV2lyZTogeyAnQF9VSWQnOiAnMjInLCBQb3dlcnJhaWw6IHt9LCBOYW1lQ29uOiB7ICdAX1VJZCc6ICcyMScsICdAX05hbWUnOiAnaW4nIH0gfSB9IH07XG4gICAgcmV0dXJuIHtcbiAgICAgICdAX051bWJlcic6IG51bSxcbiAgICAgICdAX0luaXQnOiBTdHJpbmcoc3RlcC5pc0luaXRpYWwpLFxuICAgICAgJ0BfTmFtZSc6IHN0ZXAubmFtZSxcbiAgICAgICdAX01heGltdW1TdGVwVGltZSc6ICdUIzEwUycsXG4gICAgICAnQF9XYXJuaW5nVGltZSc6ICdUIzdTJyxcbiAgICAgIEFjdGlvbnM6IHsgVGl0bGU6IHsgTXVsdGlMYW5ndWFnZVRleHQ6IHsgJ0BfTGFuZyc6ICdlbi1VUycsICcjdGV4dCc6IGFjdGlvblRpdGxlIH0gfSB9LFxuICAgICAgU3VwZXJ2aXNpb25zOiB7IFN1cGVydmlzaW9uOiB7ICdAX1Byb2dyYW1taW5nTGFuZ3VhZ2UnOiAnTEFEJywgRmxnTmV0OiBzdkZsZ05ldCB9IH0sXG4gICAgICBJbnRlcmxvY2tzOiB7IEludGVybG9jazogeyAnQF9Qcm9ncmFtbWluZ0xhbmd1YWdlJzogJ0xBRCcsIEZsZ05ldDogaWxGbGdOZXQgfSB9LFxuICAgIH07XG4gIH0pO1xuXG4gIGNvbnN0IGV4cG9ydGVkVHJhbnNpdGlvbnM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+W10gPSBzZmMudHJhbnNpdGlvbnMubWFwKHRyYW5zID0+IHtcbiAgICBjb25zdCBudW0gPSB0cmFuc051bU1hcC5nZXQodHJhbnMuaWQpIHx8IFN0cmluZyhjb3VudGVyKyspO1xuICAgIC8vIEJ1aWxkIGlubGluZSBGbGdOZXQgZm9yIHRoZSB0cmFuc2l0aW9uIGNvbmRpdGlvbiAoVElBIEdSQVBIIGZvcm1hdClcbiAgICAvLyBTaW1wbGUgY2FzZTogVHJDb2lsIHdpdGggUG93ZXJyYWlsIGNvbm5lY3Rpb24gKGFsd2F5cy10cnVlIG9yIGNvbmRpdGlvbi1iYXNlZClcbiAgICBjb25zdCBmbGdOZXQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xuICAgICAgUGFydHM6IHsgUGFydDogeyAnQF9OYW1lJzogJ1RyQ29pbCcsICdAX1VJZCc6ICcyMScgfSB9LFxuICAgICAgV2lyZXM6IHsgV2lyZTogeyAnQF9VSWQnOiAnMjInLCBQb3dlcnJhaWw6IHt9LCBOYW1lQ29uOiB7ICdAX1VJZCc6ICcyMScsICdAX05hbWUnOiAnaW4nIH0gfSB9LFxuICAgIH07XG4gICAgcmV0dXJuIHtcbiAgICAgICdAX0lzTWlzc2luZyc6ICdmYWxzZScsXG4gICAgICAnQF9OYW1lJzogdHJhbnMuY29uZGl0aW9uLFxuICAgICAgJ0BfTnVtYmVyJzogbnVtLFxuICAgICAgJ0BfUHJvZ3JhbW1pbmdMYW5ndWFnZSc6ICdMQUQnLFxuICAgICAgRmxnTmV0OiBmbGdOZXQsXG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gQnJhbmNoZXM6IG9uZSBBbHRCZWdpbiArIG9uZSBBbHRFbmQgKG9yIFNpbUJlZ2luL1NpbUVuZCkgcGVyIGJyYW5jaFxuICBjb25zdCBleHBvcnRlZEJyYW5jaGVzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdID0gW107XG4gIC8vIGJyYW5jaCBiYXIgSURzIGZyb20gbGlua3NcbiAgY29uc3QgYnJhbmNoQmFySWRzID0gbmV3IFNldChzZmMubGlua3MuZmxhdE1hcChsID0+IFtsLmZyb20sIGwudG9dKS5maWx0ZXIoaWQgPT4gaWQuc3RhcnRzV2l0aCgnc2llbWVucy1icmFuY2gtJykpKTtcbiAgY29uc3QgZW1pdHRlZEJyYW5jaE51bXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgbGV0IGJyYW5jaENvdW50ZXIgPSAxO1xuICBjb25zdCBicmFuY2hCYXJOdW1NYXAgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG4gIGZvciAoY29uc3QgYmFySWQgb2YgYnJhbmNoQmFySWRzKSB7XG4gICAgY29uc3QgZXhpc3RpbmdOdW0gPSBiYXJJZC5yZXBsYWNlKCdzaWVtZW5zLWJyYW5jaC0nLCAnJyk7XG4gICAgaWYgKCFicmFuY2hCYXJOdW1NYXAuaGFzKGJhcklkKSkge1xuICAgICAgYnJhbmNoQmFyTnVtTWFwLnNldChiYXJJZCwgL15cXGQrJC8udGVzdChleGlzdGluZ051bSkgPyBleGlzdGluZ051bSA6IFN0cmluZyhicmFuY2hDb3VudGVyKyspKTtcbiAgICB9XG4gIH1cblxuICAvLyBCdWlsZCBicmFuY2ggZGVjbGFyYXRpb25zIGZyb20gU0ZDQnJhbmNoIHJlY29yZHNcbiAgY29uc3QgZW1pdHRlZEJyYW5jaERlY2xzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGZvciAoY29uc3QgYnJhbmNoIG9mIChzZmMuYnJhbmNoZXMgPz8gW10pKSB7XG4gICAgY29uc3QgaXNTaW11bHRhbmVvdXMgPSBicmFuY2gudHlwZSA9PT0gJ0FORCc7XG4gICAgY29uc3QgYmVnaW5UeXBlID0gaXNTaW11bHRhbmVvdXMgPyAnU2ltQmVnaW4nIDogJ0FsdEJlZ2luJztcbiAgICBjb25zdCBlbmRUeXBlICAgPSBpc1NpbXVsdGFuZW91cyA/ICdTaW1FbmQnICAgOiAnQWx0RW5kJztcbiAgICBjb25zdCBjYXJkaW5hbGl0eSA9IGJyYW5jaC5icmFuY2hTdGVwSWRzLmxlbmd0aDtcbiAgICBjb25zdCBiZWdpbk51bSA9IFN0cmluZyhicmFuY2hDb3VudGVyKyspO1xuICAgIGNvbnN0IGVuZE51bSAgID0gU3RyaW5nKGJyYW5jaENvdW50ZXIrKyk7XG4gICAgaWYgKCFlbWl0dGVkQnJhbmNoRGVjbHMuaGFzKGJyYW5jaC5pZCkpIHtcbiAgICAgIGVtaXR0ZWRCcmFuY2hEZWNscy5hZGQoYnJhbmNoLmlkKTtcbiAgICAgIGV4cG9ydGVkQnJhbmNoZXMucHVzaCh7ICdAX051bWJlcic6IGJlZ2luTnVtLCAnQF9UeXBlJzogYmVnaW5UeXBlLCAnQF9DYXJkaW5hbGl0eSc6IFN0cmluZyhjYXJkaW5hbGl0eSkgfSk7XG4gICAgICBleHBvcnRlZEJyYW5jaGVzLnB1c2goeyAnQF9OdW1iZXInOiBlbmROdW0sICAgJ0BfVHlwZSc6IGVuZFR5cGUsICAgJ0BfQ2FyZGluYWxpdHknOiBTdHJpbmcoY2FyZGluYWxpdHkpIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIENvbm5lY3Rpb25zIFx1MjAxNCBjb252ZXJ0IENMTSBTRkNMaW5rW10gdG8gVElBIENvbm5lY3Rpb24gZWxlbWVudHNcbiAgY29uc3QgZXhwb3J0ZWRDb25uZWN0aW9uczogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSA9IFtdO1xuXG4gIGNvbnN0IG1ha2VOb2RlRnJvbSA9IChpZDogc3RyaW5nKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPT4ge1xuICAgIGlmIChpZC5zdGFydHNXaXRoKCdzaWVtZW5zLXN0ZXAtJykpIHJldHVybiB7IFN0ZXBSZWY6IHsgJ0BfTnVtYmVyJzogc3RlcE51bU1hcC5nZXQoaWQpIHx8IGlkLnJlcGxhY2UoJ3NpZW1lbnMtc3RlcC0nLCAnJykgfSB9O1xuICAgIGlmIChpZC5zdGFydHNXaXRoKCdzaWVtZW5zLXRyYW5zLScpKSByZXR1cm4geyBUcmFuc2l0aW9uUmVmOiB7ICdAX051bWJlcic6IHRyYW5zTnVtTWFwLmdldChpZCkgfHwgaWQucmVwbGFjZSgnc2llbWVucy10cmFucy0nLCAnJykgfSB9O1xuICAgIGlmIChpZC5zdGFydHNXaXRoKCdzaWVtZW5zLWJyYW5jaC0nKSkgcmV0dXJuIHsgQnJhbmNoUmVmOiB7ICdAX051bWJlcic6IGJyYW5jaEJhck51bU1hcC5nZXQoaWQpIHx8IGlkLnJlcGxhY2UoJ3NpZW1lbnMtYnJhbmNoLScsICcnKSwgJ0BfT3V0JzogJzAnIH0gfTtcbiAgICByZXR1cm4geyBTdGVwUmVmOiB7ICdAX051bWJlcic6IGlkIH0gfTtcbiAgfTtcbiAgY29uc3QgbWFrZU5vZGVUbyA9IChpZDogc3RyaW5nKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPT4ge1xuICAgIGlmIChpZC5zdGFydHNXaXRoKCdzaWVtZW5zLXN0ZXAtJykpIHJldHVybiB7IFN0ZXBSZWY6IHsgJ0BfTnVtYmVyJzogc3RlcE51bU1hcC5nZXQoaWQpIHx8IGlkLnJlcGxhY2UoJ3NpZW1lbnMtc3RlcC0nLCAnJykgfSB9O1xuICAgIGlmIChpZC5zdGFydHNXaXRoKCdzaWVtZW5zLXRyYW5zLScpKSByZXR1cm4geyBUcmFuc2l0aW9uUmVmOiB7ICdAX051bWJlcic6IHRyYW5zTnVtTWFwLmdldChpZCkgfHwgaWQucmVwbGFjZSgnc2llbWVucy10cmFucy0nLCAnJykgfSB9O1xuICAgIGlmIChpZC5zdGFydHNXaXRoKCdzaWVtZW5zLWJyYW5jaC0nKSkgcmV0dXJuIHsgQnJhbmNoUmVmOiB7ICdAX051bWJlcic6IGJyYW5jaEJhck51bU1hcC5nZXQoaWQpIHx8IGlkLnJlcGxhY2UoJ3NpZW1lbnMtYnJhbmNoLScsICcnKSwgJ0BfSW4nOiAnMCcgfSB9O1xuICAgIGlmIChpZC5zdGFydHNXaXRoKCdzaWVtZW5zLWp1bXAtJykpIHtcbiAgICAgIGNvbnN0IGp1bXAgPSBzZmMuanVtcHM/LmZpbmQoaiA9PiBqLmlkID09PSBpZCk7XG4gICAgICBjb25zdCB0YXJnZXROdW0gPSBzdGVwTnVtTWFwLmdldChgc2llbWVucy1zdGVwLSR7anVtcD8udGFyZ2V0U3RlcE5hbWV9YCkgfHwgJzEnO1xuICAgICAgcmV0dXJuIHsgU3RlcFJlZjogeyAnQF9OdW1iZXInOiB0YXJnZXROdW0gfSB9O1xuICAgIH1cbiAgICByZXR1cm4geyBTdGVwUmVmOiB7ICdAX051bWJlcic6IGlkIH0gfTtcbiAgfTtcblxuICBmb3IgKGNvbnN0IGxpbmsgb2Ygc2ZjLmxpbmtzKSB7XG4gICAgY29uc3QgaXNKdW1wTGluayA9IGxpbmsudG8uc3RhcnRzV2l0aCgnc2llbWVucy1qdW1wLScpO1xuICAgIGV4cG9ydGVkQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICBOb2RlRnJvbTogbWFrZU5vZGVGcm9tKGxpbmsuZnJvbSksXG4gICAgICBOb2RlVG86ICAgbWFrZU5vZGVUbyhsaW5rLnRvKSxcbiAgICAgIExpbmtUeXBlOiBpc0p1bXBMaW5rID8gJ0p1bXAnIDogJ0RpcmVjdCcsXG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBzZXF1ZW5jZTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fTtcbiAgaWYgKGV4cG9ydGVkU3RlcHMubGVuZ3RoKSAgICAgICBzZXF1ZW5jZS5TdGVwcyAgICAgICA9IHsgU3RlcDogZXhwb3J0ZWRTdGVwcyB9O1xuICBpZiAoZXhwb3J0ZWRUcmFuc2l0aW9ucy5sZW5ndGgpIHNlcXVlbmNlLlRyYW5zaXRpb25zID0geyBUcmFuc2l0aW9uOiBleHBvcnRlZFRyYW5zaXRpb25zIH07XG4gIGlmIChleHBvcnRlZEJyYW5jaGVzLmxlbmd0aCkgICAgc2VxdWVuY2UuQnJhbmNoZXMgICAgPSB7IEJyYW5jaDogZXhwb3J0ZWRCcmFuY2hlcyB9O1xuICBpZiAoZXhwb3J0ZWRDb25uZWN0aW9ucy5sZW5ndGgpIHNlcXVlbmNlLkNvbm5lY3Rpb25zID0geyBDb25uZWN0aW9uOiBleHBvcnRlZENvbm5lY3Rpb25zIH07XG5cbiAgLy8gRml4IDEyOiBhZGQgUHJlT3BlcmF0aW9ucyBhbmQgUG9zdE9wZXJhdGlvbnMgc3R1YnNcbiAgY29uc3QgZ3JhcGg6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xuICAgICdAX3htbG5zJzogJ2h0dHA6Ly93d3cuc2llbWVucy5jb20vYXV0b21hdGlvbi9PcGVubmVzcy9TVy9OZXR3b3JrU291cmNlL0dyYXBoL3YxJyxcbiAgICBQcmVPcGVyYXRpb25zOiB7IFBlcm1hbmVudE9wZXJhdGlvbjogeyAnQF9Qcm9ncmFtbWluZ0xhbmd1YWdlJzogJ0ZCRCcgfSB9LFxuICAgIFNlcXVlbmNlOiBzZXF1ZW5jZSxcbiAgICBQb3N0T3BlcmF0aW9uczogeyBQZXJtYW5lbnRPcGVyYXRpb246IHsgJ0BfUHJvZ3JhbW1pbmdMYW5ndWFnZSc6ICdGQkQnIH0gfSxcbiAgfTtcblxuICByZXR1cm4gW3tcbiAgICAnQF9JRCc6IG5leHRVSWQoKSxcbiAgICBBdHRyaWJ1dGVMaXN0OiB7XG4gICAgICBQcm9ncmFtbWluZ0xhbmd1YWdlOiAnR1JBUEgnLFxuICAgICAgTmV0d29ya1NvdXJjZTogeyBHcmFwaDogZ3JhcGggfSxcbiAgICB9LFxuICB9XTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQWNBLFNBQVMsVUFBVSxVQUFVLE1BQU0sTUFBTSxPQUFPLGtCQUFrQjtBQUNsRSxTQUFTLGtCQUFrQix3QkFBd0I7QUFDbkQsU0FBUyxlQUFlLDRCQUE0QjtBQUNwRCxTQUFTLGdCQUFnQixzQkFBc0I7QUFZL0MsSUFBSSxPQUFPO0FBQ1gsU0FBUyxNQUFNLFFBQXdCO0FBQUUsU0FBTyxHQUFHLE1BQU0sSUFBSSxFQUFFLElBQUksSUFBSSxLQUFLLE9BQU8sRUFBRSxTQUFTLEVBQUUsRUFBRSxNQUFNLEdBQUcsQ0FBQyxDQUFDO0FBQUk7QUFFakgsU0FBUyxZQUFZLEdBQW1CO0FBQ3RDLFNBQU8sRUFBRSxRQUFRLFVBQVUsR0FBRyxFQUFFLFFBQVEsU0FBUyxHQUFHLEVBQUUsUUFBUSxTQUFTLEdBQUcsRUFBRSxRQUFRLFdBQVcsR0FBRyxFQUFFLFFBQVEsV0FBVyxHQUFHO0FBQzVIO0FBSUEsU0FBUyx3QkFBd0IsSUFBcUI7QUFDcEQsTUFBSSxDQUFDLEdBQUksUUFBTztBQUVoQixRQUFNLFFBQVEsS0FBSyxFQUFFO0FBQ3JCLE1BQUksU0FBUyxNQUFNLEtBQUssRUFBRyxRQUFPLE1BQU0sS0FBSztBQUU3QyxhQUFXLFFBQVEsV0FBVyxJQUFJLGtCQUFrQixHQUFHO0FBQ3JELGVBQVcsVUFBVSxXQUFXLE1BQU0sTUFBTSxZQUFZLEdBQUcsc0JBQXNCLEdBQUc7QUFDbEYsWUFBTSxVQUFVLEtBQUssTUFBTSxNQUFNLFFBQVEsZUFBZSxHQUFHLFNBQVMsQ0FBQyxLQUFLO0FBQzFFLFlBQU0sSUFBSSxLQUFLLE1BQU0sTUFBTSxRQUFRLGVBQWUsR0FBRyxNQUFNLENBQUMsS0FBSztBQUNqRSxVQUFJLE1BQU0sUUFBUSxXQUFXLElBQUksS0FBSyxDQUFDLFNBQVUsUUFBTztBQUFBLElBQzFEO0FBRUEsZUFBVyxVQUFVLFdBQVcsTUFBTSxNQUFNLFlBQVksR0FBRyxzQkFBc0IsR0FBRztBQUNsRixZQUFNLElBQUksS0FBSyxNQUFNLE1BQU0sUUFBUSxlQUFlLEdBQUcsTUFBTSxDQUFDLEtBQUs7QUFDakUsVUFBSSxFQUFHLFFBQU87QUFBQSxJQUNoQjtBQUFBLEVBQ0Y7QUFDQSxTQUFPO0FBQ1Q7QUFTTyxTQUFTLGNBQWMsWUFBb0IsVUFBZ0M7QUFDaEYsU0FBTztBQUNQLFFBQU0sU0FBbUIsQ0FBQztBQUMxQixRQUFNLFdBQXFCLENBQUM7QUFDNUIsUUFBTSxXQUE4QixDQUFDO0FBRXJDLE1BQUk7QUFDSixNQUFJO0FBQ0YsV0FBTyxTQUFTLFVBQVU7QUFBQSxFQUM1QixTQUFTLEdBQUc7QUFDVixXQUFPLEVBQUUsSUFBSSxPQUFPLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLEdBQUcsVUFBVSxDQUFDLEVBQUU7QUFBQSxFQUN0RTtBQUVBLFFBQU0sV0FBVyxNQUFNLE1BQU0sVUFBVTtBQUN2QyxNQUFJLENBQUMsVUFBVTtBQUNiLFdBQU8sRUFBRSxJQUFJLE9BQU8sUUFBUSxDQUFDLDRDQUE0QyxHQUFHLFVBQVUsQ0FBQyxFQUFFO0FBQUEsRUFDM0Y7QUFFQSxRQUFNLFVBQVUsTUFBTSxVQUFVLGNBQWM7QUFDOUMsUUFBTSxjQUFjLEtBQUssTUFBTSxTQUFTLGFBQWEsQ0FBQyxLQUFLO0FBRTNELFFBQU0sVUFBVSxLQUFLLE1BQU0sU0FBUyxZQUFZLENBQUMsS0FDNUMsS0FBSyxNQUFNLFVBQVUsYUFBYSxHQUFHLFNBQVMsS0FDOUM7QUFFTCxRQUFNLE9BQXdCLENBQUM7QUFDL0IsUUFBTSxhQUE4QixDQUFDO0FBRXJDLFFBQU0sV0FBVyxNQUFNLFVBQVUsV0FBVyxLQUFLO0FBR2pELGFBQVcsV0FBVyxXQUFXLFVBQVUsdUJBQXVCLEVBQUUsT0FBTyxXQUFXLFVBQVUsY0FBYyxDQUFDLEdBQUc7QUFDaEgsVUFBTSxNQUFNLGlCQUFpQixTQUFTLFVBQVUsUUFBUTtBQUN4RCxRQUFJLElBQUssTUFBSyxLQUFLLEdBQUc7QUFBQSxFQUN4QjtBQUdBLGFBQVcsT0FBTyxDQUFDLGdCQUFnQixnQkFBZ0IsY0FBYyxHQUFHO0FBQ2xFLGVBQVcsV0FBVyxXQUFXLFVBQVUsR0FBRyxHQUFHO0FBQy9DLFlBQU0sTUFBTSxtQkFBbUIsU0FBUyxLQUFLLFVBQVUsUUFBUTtBQUMvRCxVQUFJLElBQUssTUFBSyxLQUFLLEdBQUc7QUFBQSxJQUN4QjtBQUFBLEVBQ0Y7QUFHQSxhQUFXLFFBQVEsV0FBVyxVQUFVLG9CQUFvQixHQUFHO0FBQzdELFVBQU0sU0FBUyxLQUFLLE1BQU0sTUFBTSxNQUFNLGVBQWUsR0FBRyxNQUFNLENBQUMsS0FBSztBQUNwRSxVQUFNLGNBQWMsTUFBTSxNQUFNLE1BQU0sZUFBZSxHQUFHLFdBQVc7QUFDbkUsUUFBSSxhQUFhO0FBQ2YsWUFBTSxjQUFjLHNCQUFzQixhQUFhLFFBQVE7QUFDL0QsaUJBQVcsS0FBSyxHQUFHLFlBQVksSUFBSSxRQUFNLEVBQUUsR0FBRyxHQUFHLFNBQVMsR0FBRyxNQUFNLElBQUksRUFBRSxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQUEsSUFDckY7QUFBQSxFQUNGO0FBR0EsYUFBVyxRQUFRLFdBQVcsVUFBVSxjQUFjLEVBQUUsT0FBTyxXQUFXLFVBQVUsc0JBQXNCLENBQUMsR0FBRztBQUM1RyxVQUFNLFNBQVMsS0FBSyxNQUFNLE1BQU0sTUFBTSxlQUFlLEdBQUcsTUFBTSxDQUFDLEtBQUs7QUFDcEUsVUFBTSxjQUFjLE1BQU0sTUFBTSxNQUFNLGVBQWUsR0FBRyxXQUFXO0FBQ25FLFFBQUksYUFBYTtBQUNmLFlBQU0sY0FBYyxzQkFBc0IsYUFBYSxRQUFRO0FBQy9ELGlCQUFXLEtBQUssR0FBRyxZQUFZLElBQUksUUFBTSxFQUFFLEdBQUcsR0FBRyxTQUFTLEdBQUcsTUFBTSxJQUFJLEVBQUUsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUFBLElBQ3JGO0FBQUEsRUFDRjtBQUVBLE1BQUksS0FBSyxXQUFXLEdBQUc7QUFDckIsV0FBTyxLQUFLLG9DQUFvQztBQUNoRCxXQUFPLEVBQUUsSUFBSSxPQUFPLFFBQVEsU0FBUztBQUFBLEVBQ3ZDO0FBRUEsUUFBTSxVQUFpQztBQUFBLElBQ3JDLGNBQWM7QUFBQSxJQUNkLG1CQUFtQjtBQUFBLElBQ25CLGtCQUFrQjtBQUFBLElBQ2xCLGtCQUFrQjtBQUFBLElBQ2xCLHFCQUFxQjtBQUFBLElBQ3JCLHVCQUF1QixFQUFFLFlBQVksU0FBUyxZQUFZO0FBQUEsRUFDNUQ7QUFFQSxTQUFPLEVBQUUsSUFBSSxNQUFNLFNBQVMsRUFBRSxhQUFhLE1BQU0sWUFBWSxRQUFRLEdBQUcsUUFBUSxTQUFTO0FBQzNGO0FBRUEsU0FBUyxtQkFDUCxTQUNBLFdBQ0EsVUFDQSxVQUNzQjtBQUN0QixNQUFJLENBQUMsV0FBVyxPQUFPLFlBQVksU0FBVSxRQUFPO0FBQ3BELFFBQU0sV0FBVyxNQUFNLFNBQVMsZUFBZTtBQUMvQyxRQUFNLFlBQVksS0FBSyxNQUFNLFVBQVUsTUFBTSxDQUFDLEtBQUs7QUFDbkQsUUFBTSxZQUFZLEtBQUssTUFBTSxVQUFVLHFCQUFxQixDQUFDLEtBQUssT0FBTyxZQUFZO0FBRXJGLFFBQU0sWUFBMEIsQ0FBQztBQUNqQyxRQUFNLGNBQWMsTUFBTSxVQUFVLFdBQVc7QUFDL0MsTUFBSSxhQUFhO0FBQ2YsY0FBVSxLQUFLLEdBQUcsc0JBQXNCLGFBQWEsUUFBUSxDQUFDO0FBQUEsRUFDaEU7QUFFQSxRQUFNLFdBQXNCLENBQUM7QUFDN0IsYUFBVyxTQUFTLFdBQVcsTUFBTSxTQUFTLFlBQVksR0FBRyx1QkFBdUIsR0FBRztBQUNyRixhQUFTLEtBQUssS0FBSztBQUFBLEVBQ3JCO0FBRUEsUUFBTSxVQUFVLFVBQVUsU0FBUyxJQUFJLElBQUksa0JBQ3ZDLFVBQVUsU0FBUyxJQUFJLElBQUksYUFDM0I7QUFFSixRQUFNLFdBQVcsY0FBYyxXQUE4QixDQUFDLENBQUM7QUFFL0QsTUFBSSxhQUFhLFNBQVMsYUFBYSxNQUFNO0FBQzNDLFVBQU0sU0FBUyxrQkFBa0IsVUFBVSxXQUFXLFVBQVUsVUFBVSxRQUFRO0FBQ2xGLFdBQU8sRUFBRSxJQUFJLE9BQU8sU0FBUyxJQUFJLE1BQU0sV0FBVyxVQUFVLE1BQU0sZUFBZSxRQUFRLFdBQVcsUUFBUTtBQUFBLEVBQzlHO0FBQ0EsTUFBSSxhQUFhLE9BQU87QUFDdEIsVUFBTSxNQUFNLG1CQUFtQixVQUFVLFdBQVcsVUFBVSxVQUFVLFFBQVE7QUFDaEYsV0FBTyxFQUFFLElBQUksT0FBTyxTQUFTLElBQUksTUFBTSxXQUFXLFVBQVUsT0FBTyxZQUFZLEtBQUssV0FBVyxRQUFRO0FBQUEsRUFDekc7QUFDQSxNQUFJLGFBQWEsU0FBUyxhQUFhLE9BQU87QUFDNUMsVUFBTSxNQUFNLGlCQUFpQixTQUFTLFFBQVE7QUFDOUMsV0FBTyxFQUFFLElBQUksT0FBTyxTQUFTLElBQUksTUFBTSxXQUFXLFVBQVUsTUFBTSxVQUFVLEtBQUssV0FBVyxRQUFRO0FBQUEsRUFDdEc7QUFDQSxNQUFJLGFBQWEsU0FBUztBQUN4QixVQUFNLE1BQU0sbUJBQW1CLFVBQVUsV0FBVyxVQUFVLFFBQVE7QUFDdEUsV0FBTyxFQUFFLElBQUksT0FBTyxTQUFTLElBQUksTUFBTSxXQUFXLFVBQVUsT0FBTyxZQUFZLEtBQUssV0FBVyxRQUFRO0FBQUEsRUFDekc7QUFFQSxXQUFTLEtBQUssRUFBRSxXQUFXLE1BQU0sb0JBQW9CLFNBQVMsUUFBUSxVQUFVLFNBQVMsMkJBQTJCLFFBQVEsR0FBRyxDQUFDO0FBQ2hJLFNBQU87QUFDVDtBQUVBLFNBQVMsaUJBQWlCLFNBQWtCLFVBQTJCO0FBRXJFLFFBQU0sWUFBWSxLQUFLLE1BQU0sVUFBVSxzQkFBc0IsQ0FBQztBQUM5RCxNQUFJLGFBQWEsVUFBVSxLQUFLLE1BQU0sWUFBYSxRQUFPLFlBQVksU0FBUztBQUcvRSxRQUFNLGFBQWEsTUFBTSxTQUFTLFlBQVk7QUFDOUMsYUFBVyxNQUFNLFdBQVcsWUFBWSx1QkFBdUIsR0FBRztBQUNoRSxVQUFNLFNBQVMsTUFBTSxJQUFJLGVBQWU7QUFDeEMsVUFBTSxNQUFNLEtBQUssTUFBTSxRQUFRLGVBQWUsQ0FBQztBQUMvQyxRQUFJLE9BQU8sSUFBSSxLQUFLLEVBQUcsUUFBTyxZQUFZLEdBQUc7QUFDN0MsVUFBTSxPQUFPLE1BQU0sUUFBUSxnQkFBZ0I7QUFDM0MsUUFBSSxNQUFNO0FBQ1IsWUFBTSxTQUFTLEtBQUssSUFBSTtBQUN4QixVQUFJLFVBQVUsT0FBTyxLQUFLLEVBQUcsUUFBTyxZQUFZLE1BQU07QUFFdEQsWUFBTSxTQUFTLFdBQVcsTUFBTSxPQUFPLEVBQUUsT0FBTyxXQUFXLE1BQU0sT0FBTyxDQUFDO0FBQ3pFLFVBQUksT0FBTyxTQUFTLEdBQUc7QUFDckIsY0FBTSxnQkFBZ0IsT0FBTyxJQUFJLE9BQUssS0FBSyxHQUFHLE1BQU0sS0FBSyxHQUFHLEVBQUUsS0FBSyxFQUFFO0FBQ3JFLFlBQUksY0FBYyxLQUFLLEVBQUcsUUFBTyxZQUFZLGFBQWE7QUFBQSxNQUM1RDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBR0EsYUFBVyxPQUFPLFdBQVcsWUFBWSxtQkFBbUIsR0FBRztBQUM3RCxVQUFNLE1BQU0sS0FBSyxHQUFHO0FBQ3BCLFFBQUksT0FBTyxJQUFJLEtBQUssRUFBRyxRQUFPLFlBQVksR0FBRztBQUFBLEVBQy9DO0FBRUEsU0FBTztBQUNUO0FBRUEsU0FBUyxpQkFDUCxNQUNBLFVBQ0EsVUFDc0I7QUFDdEIsTUFBSSxDQUFDLFFBQVEsT0FBTyxTQUFTLFNBQVUsUUFBTztBQUM5QyxRQUFNLFdBQVcsTUFBTSxNQUFNLGVBQWU7QUFDNUMsUUFBTSxLQUFLLEtBQUssTUFBTSxJQUFJLEtBQUssS0FBSyxVQUFVLElBQUksS0FBSztBQUN2RCxRQUFNLFlBQVksS0FBSyxNQUFNLFVBQVUscUJBQXFCLENBQUMsS0FBSyxPQUFPLFlBQVk7QUFDckYsUUFBTSxRQUFRLEtBQUssTUFBTSxNQUFNLE1BQU0sWUFBWSxHQUFHLGtCQUFrQixDQUFDLEtBQUssV0FBVyxFQUFFO0FBRXpGLFFBQU0sV0FBVyxDQUFDLElBQUk7QUFFdEIsTUFBSSxhQUFhLFNBQVMsYUFBYSxNQUFNO0FBQzNDLFVBQU0sU0FBUyxrQkFBa0IsVUFBVSxJQUFJLFVBQVUsUUFBUTtBQUNqRSxXQUFPLEVBQUUsSUFBSSxPQUFPLEVBQUUsSUFBSSxNQUFNLE9BQU8sVUFBVSxNQUFNLGVBQWUsUUFBUSxXQUFXLENBQUMsRUFBRTtBQUFBLEVBQzlGO0FBQ0EsTUFBSSxhQUFhLE9BQU87QUFDdEIsVUFBTSxNQUFNLG1CQUFtQixVQUFVLElBQUksVUFBVSxRQUFRO0FBQy9ELFdBQU8sRUFBRSxJQUFJLE9BQU8sRUFBRSxJQUFJLE1BQU0sT0FBTyxVQUFVLE9BQU8sWUFBWSxLQUFLLFdBQVcsQ0FBQyxFQUFFO0FBQUEsRUFDekY7QUFDQSxNQUFJLGFBQWEsU0FBUztBQUN4QixVQUFNLE1BQU0sbUJBQW1CLFVBQVUsSUFBSSxVQUFVLFFBQVE7QUFDL0QsV0FBTyxFQUFFLElBQUksT0FBTyxFQUFFLElBQUksTUFBTSxPQUFPLFVBQVUsT0FBTyxZQUFZLEtBQUssV0FBVyxDQUFDLEVBQUU7QUFBQSxFQUN6RjtBQUVBLFdBQVMsS0FBSyxFQUFFLFdBQVcsTUFBTSxvQkFBb0IsTUFBTSxRQUFRLGdCQUFnQixLQUFLLDJCQUEyQixRQUFRLEdBQUcsQ0FBQztBQUMvSCxTQUFPO0FBQ1Q7QUFJQSxTQUFTLHNCQUFzQixhQUFzQixVQUEyQztBQUM5RixRQUFNLE9BQXFCLENBQUM7QUFDNUIsUUFBTSxXQUFXLE1BQU0sYUFBYSxVQUFVLEtBQUs7QUFFbkQsV0FBUyx1QkFBdUIsWUFBMkI7QUFDekQsZUFBVyxXQUFXLFdBQVcsWUFBWSxTQUFTLEdBQUc7QUFDdkQsWUFBTSxpQkFBaUIsS0FBSyxTQUFTLE1BQU07QUFDM0MsWUFBTSxjQUFjLGtCQUEyQztBQUUvRCxVQUFJLG1CQUFtQixVQUFVLG1CQUFtQixRQUFRO0FBQzFELGNBQU0saUJBQWlCLE1BQU0sU0FBUyxVQUFVO0FBQ2hELFlBQUksZ0JBQWdCO0FBQ2xCLGlDQUF1QixjQUFjO0FBQ3JDO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFDQSxpQkFBVyxZQUFZLFdBQVcsU0FBUyxRQUFRLEdBQUc7QUFDcEQsY0FBTSxPQUFPLEtBQUssVUFBVSxNQUFNO0FBQ2xDLGNBQU0sVUFBVSxLQUFLLFVBQVUsVUFBVTtBQUN6QyxZQUFJLENBQUMsS0FBTTtBQUNYLGNBQU0sV0FBVyxpQkFBaUIsT0FBTztBQUN6QyxjQUFNLGFBQWEsS0FBSyxNQUFNLFVBQVUsWUFBWSxDQUFDO0FBRXJELGNBQU0sWUFBWSxNQUFNLFVBQVUsU0FBUztBQUMzQyxjQUFNLFVBQVUsS0FBSyxNQUFNLFdBQVcsbUJBQW1CLENBQUMsS0FBSyxLQUFLLFNBQVMsS0FBSztBQUNsRixhQUFLLEtBQUs7QUFBQSxVQUNSO0FBQUEsVUFDQTtBQUFBLFVBQ0EsY0FBYyxjQUFjO0FBQUEsVUFDNUIsYUFBYSxXQUFXO0FBQUEsVUFDeEIsU0FBUztBQUFBLFFBQ1gsQ0FBQztBQUFBLE1BQ0g7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUVBLHlCQUF1QixRQUFRO0FBQy9CLFNBQU87QUFDVDtBQVdBLFNBQVMsa0JBQ1AsVUFDQSxPQUNBLFVBQ0EsVUFDQSxXQUFpQyxJQUFJLHFCQUFxQixHQUMzQztBQUNmLFFBQU0sUUFBZ0IsQ0FBQztBQUN2QixNQUFJLFVBQVU7QUFFZCxhQUFXLFNBQVMsVUFBVTtBQXFDNUIsUUFBU0Esa0JBQVQsU0FBd0IsU0FBeUI7QUFFL0MsWUFBTSxlQUFlLFdBQVcsV0FBVyxRQUFRLEVBQUUsS0FBSyxPQUFLO0FBRTdELGVBQU87QUFBQSxNQUNULENBQUM7QUFFRCxpQkFBVyxVQUFVLFVBQVU7QUFDN0IsY0FBTSxXQUFXLFdBQVcsUUFBUSxTQUFTO0FBQzdDLGNBQU0sWUFBWSxXQUFXLFFBQVEsVUFBVTtBQUMvQyxtQkFBVyxNQUFNLFVBQVU7QUFDekIsY0FBSSxLQUFLLElBQUksS0FBSyxNQUFNLFdBQVcsS0FBSyxJQUFJLE1BQU0sTUFBTSxXQUFXO0FBRWpFLHVCQUFXLE1BQU0sV0FBVztBQUMxQixvQkFBTSxZQUFZLEtBQUssSUFBSSxLQUFLO0FBQ2hDLG9CQUFNLFFBQVEsWUFBWSxJQUFJLFNBQVM7QUFDdkMsa0JBQUksTUFBTyxRQUFPLGVBQWUsS0FBSztBQUFBLFlBQ3hDO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQ0EsYUFBTztBQUFBLElBQ1QsR0FHU0MsaUJBQVQsU0FBdUIsUUFBMEI7QUFDL0MsYUFBTyxXQUFXLFFBQVEsU0FBUyxFQUFFLFNBQVMsS0FDekMsS0FBSyxRQUFRLFNBQVMsTUFBTSxVQUM1QixXQUFXLFFBQVEsZUFBZSxFQUFFLFNBQVM7QUFBQSxJQUNwRCxHQTJNU0MsYUFBVCxTQUFtQixVQUFtQztBQUNwRCxZQUFNLFFBQXlCLENBQUM7QUFDaEMsVUFBSSxVQUFVO0FBQ2QsYUFBTyxXQUFXLENBQUMsUUFBUSxJQUFJLE9BQU8sR0FBRztBQUN2QyxnQkFBUSxJQUFJLE9BQU87QUFDbkIsY0FBTSxLQUFLLGFBQWEsSUFBSSxPQUFPO0FBQ25DLFlBQUksR0FBSSxPQUFNLEtBQUssRUFBRTtBQUNyQixjQUFNLFFBQVEsU0FBUyxJQUFJLE9BQU8sS0FBSyxDQUFDO0FBQ3hDLFlBQUksTUFBTSxXQUFXLEdBQUc7QUFDdEIsb0JBQVUsTUFBTSxDQUFDO0FBQUEsUUFDbkIsV0FBVyxNQUFNLFNBQVMsR0FBRztBQUUzQixxQkFBVyxXQUFXLE9BQU87QUFDM0IsZ0JBQUksQ0FBQyxRQUFRLElBQUksT0FBTyxHQUFHO0FBQ3pCLG9CQUFNLGlCQUFpQkEsV0FBVSxPQUFPO0FBQ3hDLGtCQUFJLGVBQWUsU0FBUyxHQUFHO0FBQzdCLHlCQUFTLEtBQUs7QUFBQSxrQkFDWixJQUFJLE1BQU0sVUFBVSxLQUFLLEtBQUssT0FBTyxFQUFFO0FBQUEsa0JBQ3ZDLGFBQWE7QUFBQSxrQkFDYixXQUFXLGVBQWUsZUFBZSxTQUFTLENBQUMsR0FBRyxNQUFNO0FBQUEsa0JBQzVELFVBQVU7QUFBQSxnQkFDWixDQUFDO0FBQUEsY0FDSDtBQUFBLFlBQ0Y7QUFBQSxVQUNGO0FBQ0E7QUFBQSxRQUNGLE9BQU87QUFDTDtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQ0EsYUFBTztBQUFBLElBQ1Q7QUF2UVMseUJBQUFGLGlCQXlCQSxnQkFBQUMsZ0JBK01BLFlBQUFDO0FBNVFUO0FBQ0EsVUFBTSxXQUFXLE1BQU0sT0FBTyxlQUFlO0FBRTdDLFVBQU0sZUFBZSxNQUFNLE9BQU8sWUFBWTtBQUM5QyxVQUFNLGFBQWEsV0FBVyxjQUFjLGtCQUFrQixFQUFFLEtBQUssT0FBSyxLQUFLLEdBQUcsaUJBQWlCLE1BQU0sU0FBUztBQUNsSCxVQUFNLFdBQVcsV0FBVyxjQUFjLGtCQUFrQixFQUFFLEtBQUssT0FBSyxLQUFLLEdBQUcsaUJBQWlCLE1BQU0sT0FBTztBQUM5RyxVQUFNLFlBQVksTUFBTSxVQUFVLFNBQVMsS0FBSyxNQUFNLFVBQVUsT0FBTztBQUN2RSxVQUFNLFVBQVUsd0JBQXdCLFVBQVUsS0FBSyx3QkFBd0IsUUFBUSxLQUFLLHdCQUF3QixTQUFTLEtBQUs7QUFFbEksVUFBTSxVQUFVLE1BQU0sVUFBVSxlQUFlO0FBQy9DLFVBQU0sU0FBUyxNQUFNLFNBQVMsUUFBUSxLQUFLO0FBQzNDLFVBQU0sWUFBWSxNQUFNLFFBQVEsT0FBTyxLQUFLO0FBQzVDLFVBQU0sWUFBWSxNQUFNLFFBQVEsT0FBTztBQUd2QyxVQUFNLGVBQWUsb0JBQUksSUFBMkI7QUFDcEQsUUFBSSxPQUFPO0FBSVgsVUFBTSxjQUFjLG9CQUFJLElBQXFCO0FBQzdDLFVBQU0sV0FBc0IsWUFBWSxXQUFXLFdBQVcsTUFBTSxJQUFJLENBQUM7QUFDekUsZUFBVyxVQUFVLFVBQVU7QUFDN0IsWUFBTSxZQUFZLFdBQVcsUUFBUSxVQUFVO0FBQy9DLGlCQUFXLE1BQU0sV0FBVztBQUMxQixjQUFNLE1BQU0sS0FBSyxJQUFJLEtBQUs7QUFDMUIsWUFBSSxLQUFLO0FBRVAscUJBQVcsU0FBUyxXQUFXLFdBQVcsUUFBUSxHQUFHO0FBQ25ELGdCQUFJLEtBQUssT0FBTyxLQUFLLE1BQU0sS0FBSztBQUFFLDBCQUFZLElBQUksS0FBSyxLQUFLO0FBQUc7QUFBQSxZQUFPO0FBQUEsVUFDeEU7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFtQ0EsVUFBTSxnQkFBZ0Isb0JBQUksSUFBWTtBQUl0QyxVQUFNLGFBQWE7QUFBQSxNQUNqQixHQUFHLFdBQVcsV0FBVyxTQUFTO0FBQUEsTUFDbEMsR0FBRyxXQUFXLFdBQVcsTUFBTTtBQUFBLE1BQy9CLEdBQUcsV0FBVyxXQUFXLFNBQVM7QUFBQSxNQUNsQyxHQUFHLFdBQVcsV0FBVyxXQUFXO0FBQUEsTUFDcEMsR0FBRyxXQUFXLFdBQVcsTUFBTTtBQUFBO0FBQUEsTUFDL0IsR0FBRyxXQUFXLFdBQVcsTUFBTTtBQUFBLE1BQy9CLEdBQUcsV0FBVyxXQUFXLFdBQVc7QUFBQSxNQUNwQyxHQUFHLFdBQVcsV0FBVyxTQUFTO0FBQUEsSUFDcEM7QUFFQSxlQUFXLFVBQVUsWUFBWTtBQUMvQixZQUFNLFVBQVUsS0FBSyxRQUFRLEtBQUs7QUFDbEMsVUFBSSxDQUFDLFFBQVM7QUFHZCxZQUFNLGNBQWUsT0FBZSxPQUFPLEtBQUs7QUFDaEQsWUFBTSxXQUFXLEtBQUssUUFBUSxNQUFNLEtBQUs7QUFDekMsWUFBTSxZQUFZLFNBQVMsWUFBWTtBQUd2QyxVQUFJLGNBQWMsZUFBZSxnQkFBZ0IsYUFBYTtBQUM1RCxzQkFBYyxJQUFJLE9BQU87QUFDekI7QUFBQSxNQUNGO0FBQ0EsVUFBSSxjQUFjLGFBQWEsZ0JBQWdCLFVBQVc7QUFHMUQsVUFBSSxjQUFjLFNBQVM7QUFDekIsY0FBTSxZQUFZLFdBQVcsUUFBUSxRQUFRLEVBQUUsQ0FBQztBQUNoRCxjQUFNLFVBQVUsWUFBWSxlQUFlLFNBQVMsSUFBSUYsZ0JBQWUsT0FBTztBQUM5RSxxQkFBYSxJQUFJLFNBQVMsRUFBRSxNQUFNLFFBQVEsSUFBSSxXQUFXLE9BQU8sSUFBSSxNQUFNLE9BQU8sS0FBSyxFQUFFLE1BQU0sU0FBUyxVQUFVLFNBQVMsUUFBUSxPQUFPLEVBQUUsR0FBRyxVQUFVLEVBQUUsR0FBRyxNQUFNLEdBQUcsRUFBRSxFQUFFLENBQWdCO0FBQzFMLGdCQUFRO0FBQUk7QUFBQSxNQUNkO0FBR0EsVUFBSSxjQUFjLFNBQVM7QUFDekIsY0FBTSxZQUFZLFdBQVcsUUFBUSxRQUFRLEVBQUUsQ0FBQztBQUNoRCxjQUFNLFVBQVUsWUFBWSxlQUFlLFNBQVMsSUFBSUEsZ0JBQWUsT0FBTztBQUM5RSxxQkFBYSxJQUFJLFNBQVMsRUFBRSxNQUFNLFFBQVEsSUFBSSxXQUFXLE9BQU8sSUFBSSxNQUFNLFNBQVMsS0FBSyxFQUFFLE1BQU0sU0FBUyxVQUFVLFNBQVMsUUFBUSxPQUFPLEVBQUUsR0FBRyxVQUFVLEVBQUUsR0FBRyxNQUFNLEdBQUcsRUFBRSxFQUFFLENBQWdCO0FBQzVMLGdCQUFRO0FBQUk7QUFBQSxNQUNkO0FBR0EsVUFBSSxjQUFjLGFBQWEsZ0JBQWdCLFdBQVc7QUFDeEQsY0FBTSxVQUFVQyxlQUFjLE1BQU07QUFDcEMsY0FBTSxZQUFZLFdBQVcsUUFBUSxRQUFRLEVBQUUsQ0FBQztBQUNoRCxjQUFNLFVBQVUsWUFBWSxlQUFlLFNBQVMsSUFBSUQsZ0JBQWUsT0FBTztBQUM5RSxjQUFNLEtBQXFCO0FBQUEsVUFDekIsTUFBTTtBQUFBLFVBQ04sSUFBSSxXQUFXLE9BQU87QUFBQSxVQUN0QixNQUFNLFVBQVUsT0FBTztBQUFBLFVBQ3ZCLEtBQUssRUFBRSxNQUFNLFNBQVMsVUFBVSxTQUFTLFFBQVEsT0FBTyxFQUFFO0FBQUEsVUFDMUQsVUFBVSxFQUFFLEdBQUcsTUFBTSxHQUFHLEVBQUU7QUFBQSxRQUM1QjtBQUNBLHFCQUFhLElBQUksU0FBUyxFQUFFO0FBQzVCLGdCQUFRO0FBQ1I7QUFBQSxNQUNGO0FBR0EsVUFBSSxjQUFjLGVBQWUsY0FBYyxZQUFZO0FBQ3pELGNBQU0sVUFBVUEsZ0JBQWUsT0FBTztBQUN0QyxxQkFBYSxJQUFJLFNBQVMsRUFBRSxNQUFNLFdBQVcsSUFBSSxXQUFXLE9BQU8sSUFBSSxNQUFNLGFBQWEsS0FBSyxFQUFFLE1BQU0sU0FBUyxVQUFVLFNBQVMsUUFBUSxPQUFPLEVBQUUsR0FBRyxVQUFVLEVBQUUsR0FBRyxNQUFNLEdBQUcsRUFBRSxFQUFFLENBQW1CO0FBQ3RNLGdCQUFRO0FBQUk7QUFBQSxNQUNkO0FBQ0EsVUFBSSxjQUFjLGVBQWUsY0FBYyxZQUFZO0FBQ3pELGNBQU0sVUFBVUEsZ0JBQWUsT0FBTztBQUN0QyxxQkFBYSxJQUFJLFNBQVMsRUFBRSxNQUFNLFdBQVcsSUFBSSxXQUFXLE9BQU8sSUFBSSxNQUFNLGFBQWEsS0FBSyxFQUFFLE1BQU0sU0FBUyxVQUFVLFNBQVMsUUFBUSxPQUFPLEVBQUUsR0FBRyxVQUFVLEVBQUUsR0FBRyxNQUFNLEdBQUcsRUFBRSxFQUFFLENBQW1CO0FBQ3RNLGdCQUFRO0FBQUk7QUFBQSxNQUNkO0FBR0EsVUFBSSxjQUFjLFVBQVUsZ0JBQWdCLFFBQVE7QUFDbEQsY0FBTSxVQUFVQyxlQUFjLE1BQU07QUFDcEMsY0FBTSxZQUFZLFdBQVcsUUFBUSxRQUFRLEVBQUUsQ0FBQztBQUNoRCxjQUFNLFVBQVUsWUFBWSxlQUFlLFNBQVMsSUFBSUQsZ0JBQWUsT0FBTztBQUM5RSxxQkFBYSxJQUFJLFNBQVMsRUFBRSxNQUFNLFFBQVEsSUFBSSxXQUFXLE9BQU8sSUFBSSxNQUFNLFVBQVUsWUFBWSxVQUFVLEtBQUssRUFBRSxNQUFNLFNBQVMsVUFBVSxTQUFTLFFBQVEsT0FBTyxFQUFFLEdBQUcsVUFBVSxFQUFFLEdBQUcsTUFBTSxHQUFHLEVBQUUsRUFBRSxDQUFnQjtBQUNuTixnQkFBUTtBQUFJO0FBQUEsTUFDZDtBQUVBLFVBQUksY0FBYyxhQUFhLGdCQUFnQixXQUFXO0FBQ3hELGNBQU0sWUFBWSxXQUFXLFFBQVEsUUFBUSxFQUFFLENBQUM7QUFDaEQsY0FBTSxVQUFVLFlBQVksZUFBZSxTQUFTLElBQUlBLGdCQUFlLE9BQU87QUFDOUUscUJBQWEsSUFBSSxTQUFTLEVBQUUsTUFBTSxRQUFRLElBQUksV0FBVyxPQUFPLElBQUksTUFBTSxPQUFPLEtBQUssRUFBRSxNQUFNLFNBQVMsVUFBVSxTQUFTLFFBQVEsT0FBTyxFQUFFLEdBQUcsVUFBVSxFQUFFLEdBQUcsTUFBTSxHQUFHLEVBQUUsRUFBRSxDQUFnQjtBQUMxTCxnQkFBUTtBQUFJO0FBQUEsTUFDZDtBQUVBLFVBQUksY0FBYyxlQUFlLGdCQUFnQixhQUFhO0FBQzVELGNBQU0sWUFBWSxXQUFXLFFBQVEsUUFBUSxFQUFFLENBQUM7QUFDaEQsY0FBTSxVQUFVLFlBQVksZUFBZSxTQUFTLElBQUlBLGdCQUFlLE9BQU87QUFDOUUscUJBQWEsSUFBSSxTQUFTLEVBQUUsTUFBTSxRQUFRLElBQUksV0FBVyxPQUFPLElBQUksTUFBTSxTQUFTLEtBQUssRUFBRSxNQUFNLFNBQVMsVUFBVSxTQUFTLFFBQVEsT0FBTyxFQUFFLEdBQUcsVUFBVSxFQUFFLEdBQUcsTUFBTSxHQUFHLEVBQUUsRUFBRSxDQUFnQjtBQUM1TCxnQkFBUTtBQUFJO0FBQUEsTUFDZDtBQUdBLFVBQUksZ0JBQWdCLFVBQVUsY0FBYyxRQUFRO0FBQ2xELGNBQU0sV0FBVyxNQUFNLFFBQVEsVUFBVTtBQUN6QyxjQUFNLFlBQVksS0FBSyxVQUFVLE1BQU0sS0FBSztBQUM1QyxjQUFNLFlBQVksS0FBSyxVQUFVLFdBQVcsS0FBSztBQUNqRCxjQUFNLE9BQU8seUJBQXlCLFNBQVM7QUFFL0MsY0FBTSxTQUFTLE9BQU8sS0FBSyxTQUFTO0FBQ3BDLGNBQU0sZ0JBQWdCLE9BQU8sS0FBSyxnQkFBZ0I7QUFFbEQsY0FBTSxhQUFhLE1BQU0sVUFBVSxVQUFVO0FBQzdDLGNBQU0sb0JBQW9CLE1BQU0sWUFBWSxXQUFXO0FBQ3ZELGNBQU0sZUFBZSxLQUFLLG1CQUFtQixNQUFNLEtBQUssS0FBSyxZQUFZLE1BQU0sS0FBSztBQUNwRixjQUFNLE1BQW9CLEVBQUUsTUFBTSxTQUFTLElBQUksV0FBVyxPQUFPLElBQUksUUFBUSxjQUFjLE1BQU0sQ0FBQyxHQUFHLFVBQVUsRUFBRSxHQUFHLE1BQU0sR0FBRyxFQUFFLEVBQUU7QUFDakksWUFBSSxjQUFlLEtBQUkscUJBQXFCO0FBRTVDLFFBQUMsSUFBWSxrQkFBa0I7QUFFL0IsY0FBTSxTQUFTLFdBQVcsVUFBVSxXQUFXO0FBQy9DLG1CQUFXLFNBQVMsUUFBUTtBQUMxQixnQkFBTSxRQUFRLEtBQUssT0FBTyxNQUFNLEtBQUs7QUFDckMsZ0JBQU0sV0FBVyxLQUFLLE9BQU8sU0FBUyxLQUFLO0FBQzNDLGdCQUFNLFFBQVEsS0FBSyxPQUFPLE1BQU0sS0FBSztBQUNyQyxjQUFJLE9BQU87QUFDVCxnQkFBSSxLQUFLLEtBQUssSUFBSSxFQUFFLE1BQU0sT0FBTyxVQUFVLGlCQUFpQixLQUFLLEVBQUU7QUFBQSxVQUNyRTtBQUFBLFFBQ0Y7QUFDQSxxQkFBYSxJQUFJLFNBQVMsR0FBRztBQUM3QixnQkFBUTtBQUFJO0FBQUEsTUFDZDtBQUdBLFVBQUksZ0JBQWdCLFFBQVE7QUFDMUIsY0FBTSxPQUFPLHlCQUF5QixRQUFRO0FBQzlDLFlBQUksTUFBTTtBQUNSLGdCQUFNLGVBQWVBLGdCQUFlLE9BQU8sS0FBSztBQUNoRCxnQkFBTSxNQUFvQixFQUFFLE1BQU0sU0FBUyxJQUFJLFdBQVcsT0FBTyxJQUFJLFFBQVEsS0FBSyxRQUFRLGNBQWMsTUFBTSxDQUFDLEdBQUcsVUFBVSxFQUFFLEdBQUcsTUFBTSxHQUFHLEVBQUUsRUFBRTtBQUM5SSxjQUFJLEtBQUssY0FBZSxLQUFJLHFCQUFxQjtBQUNqRCx1QkFBYSxJQUFJLFNBQVMsR0FBRztBQUM3QixrQkFBUTtBQUFJO0FBQUEsUUFDZDtBQUFBLE1BRUY7QUFBQSxJQUNGO0FBR0EsVUFBTSxZQUE4QixDQUFDO0FBQ3JDLFFBQUksV0FBVztBQUNiLGlCQUFXLFVBQVUsVUFBVTtBQUM3QixjQUFNLFdBQVcsV0FBVyxRQUFRLFNBQVM7QUFDN0MsY0FBTSxZQUFZLFdBQVcsUUFBUSxVQUFVO0FBRS9DLGNBQU0sZUFBZSxXQUFXLFFBQVEsV0FBVyxFQUFFLFNBQVM7QUFDOUQsY0FBTSxVQUFVLENBQUMsR0FBRyxVQUFVLEdBQUcsU0FBUztBQUMxQyxZQUFJLGdCQUFnQixRQUFRLFVBQVUsR0FBRztBQUV2QyxvQkFBVSxLQUFLLEVBQUUsU0FBUyxhQUFhLFNBQVMsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLEdBQUcsS0FBSyxLQUFLLElBQUksT0FBTyxLQUFLLFFBQVEsQ0FBQyxHQUFHLE1BQU0sS0FBSyxLQUFLLENBQUM7QUFDdEksbUJBQVMsS0FBSyxHQUFHLEtBQUssUUFBUSxRQUFRLE1BQU07QUFDMUMsc0JBQVUsS0FBSyxFQUFFLFNBQVMsYUFBYSxTQUFTLE9BQU8sT0FBTyxLQUFLLFFBQVEsRUFBRSxHQUFHLEtBQUssS0FBSyxJQUFJLE9BQU8sS0FBSyxDQUFDO0FBQUEsVUFDN0c7QUFDQTtBQUFBLFFBQ0Y7QUFFQSxZQUFJLFFBQVEsVUFBVSxHQUFHO0FBQ3ZCLGdCQUFNLFNBQVMsUUFBUSxDQUFDO0FBQ3hCLGdCQUFNLE9BQU8sUUFBUSxDQUFDO0FBQ3RCLG9CQUFVLEtBQUs7QUFBQSxZQUNiLFNBQVMsS0FBSyxRQUFRLEtBQUssS0FBSztBQUFBLFlBQ2hDLFNBQVMsS0FBSyxRQUFRLE1BQU0sS0FBSztBQUFBLFlBQ2pDLE9BQU8sS0FBSyxNQUFNLEtBQUssS0FBSztBQUFBLFlBQzVCLE9BQU8sS0FBSyxNQUFNLE1BQU0sS0FBSztBQUFBLFVBQy9CLENBQUM7QUFFRCxtQkFBUyxLQUFLLEdBQUcsS0FBSyxRQUFRLFFBQVEsTUFBTTtBQUMxQyxzQkFBVSxLQUFLO0FBQUEsY0FDYixTQUFTLEtBQUssUUFBUSxLQUFLLEtBQUs7QUFBQSxjQUNoQyxTQUFTLEtBQUssUUFBUSxNQUFNLEtBQUs7QUFBQSxjQUNqQyxPQUFPLEtBQUssUUFBUSxFQUFFLEdBQUcsS0FBSyxLQUFLO0FBQUEsY0FDbkMsT0FBTyxLQUFLLFFBQVEsRUFBRSxHQUFHLE1BQU0sS0FBSztBQUFBLFlBQ3RDLENBQUM7QUFBQSxVQUNIO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBSUEsVUFBTSxtQkFBbUIsSUFBSSxJQUFJLFVBQVUsT0FBTyxPQUFLLEVBQUUsWUFBWSxXQUFXLEVBQUUsSUFBSSxPQUFLLEVBQUUsS0FBSyxDQUFDO0FBQ25HLFVBQU0sY0FBYyxJQUFJLElBQUksVUFBVSxPQUFPLE9BQUssRUFBRSxZQUFZLFdBQVcsRUFBRSxJQUFJLE9BQUssRUFBRSxLQUFLLENBQUM7QUFDOUYsVUFBTSxRQUFRLENBQUMsR0FBRyxhQUFhLEtBQUssQ0FBQyxFQUFFLE9BQU8sU0FBTyxDQUFDLFlBQVksSUFBSSxHQUFHLEtBQUssaUJBQWlCLElBQUksR0FBRyxDQUFDO0FBQ3ZHLFVBQU0sV0FBVyxvQkFBSSxJQUFzQjtBQUMzQyxlQUFXLEtBQUssV0FBVztBQUN6QixVQUFJLENBQUMsU0FBUyxJQUFJLEVBQUUsT0FBTyxFQUFHLFVBQVMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQ3hELGVBQVMsSUFBSSxFQUFFLE9BQU8sRUFBRyxLQUFLLEVBQUUsS0FBSztBQUFBLElBQ3ZDO0FBR0EsVUFBTSxXQUFxQixDQUFDO0FBQzVCLFVBQU0sZUFBZ0MsQ0FBQztBQUN2QyxVQUFNLFVBQVUsb0JBQUksSUFBWTtBQW1DaEMsUUFBSSxNQUFNLFNBQVMsR0FBRztBQUNwQixpQkFBVyxXQUFXLE9BQU87QUFDM0IsWUFBSSxDQUFDLFFBQVEsSUFBSSxPQUFPLEdBQUc7QUFDekIsdUJBQWEsS0FBSyxHQUFHRSxXQUFVLE9BQU8sQ0FBQztBQUFBLFFBQ3pDO0FBQUEsTUFDRjtBQUFBLElBQ0YsT0FBTztBQUVMLG1CQUFhLEtBQUssR0FBRyxhQUFhLE9BQU8sQ0FBQztBQUFBLElBQzVDO0FBR0EsZUFBVyxDQUFDLEtBQUssRUFBRSxLQUFLLGNBQWM7QUFDcEMsVUFBSSxDQUFDLFFBQVEsSUFBSSxHQUFHLEVBQUcsY0FBYSxLQUFLLEVBQUU7QUFBQSxJQUM3QztBQUVBLFVBQU0sS0FBSztBQUFBLE1BQ1QsSUFBSSxHQUFHLEtBQUssU0FBUyxPQUFPO0FBQUEsTUFDNUIsUUFBUTtBQUFBLE1BQ1I7QUFBQSxNQUNBLFVBQVU7QUFBQSxNQUNWO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUVBLFNBQU8sRUFBRSxNQUFNO0FBQ2pCO0FBRUEsU0FBUyxlQUFlLFVBQTJCO0FBQ2pELE1BQUksQ0FBQyxZQUFZLE9BQU8sYUFBYSxTQUFVLFFBQU87QUFDdEQsUUFBTSxXQUFXLE1BQU0sVUFBVSxRQUFRO0FBQ3pDLE1BQUksVUFBVTtBQUNaLFVBQU0sYUFBYSxXQUFXLFVBQVUsV0FBVztBQUNuRCxRQUFJLFdBQVcsU0FBUyxHQUFHO0FBQ3pCLGFBQU8sV0FBVyxJQUFJLE9BQUssS0FBSyxHQUFHLE1BQU0sQ0FBQyxFQUFFLE9BQU8sT0FBTyxFQUFFLEtBQUssR0FBRztBQUFBLElBQ3RFO0FBQ0EsVUFBTSxPQUFPLEtBQUssVUFBVSxNQUFNO0FBQ2xDLFFBQUksS0FBTSxRQUFPO0FBQUEsRUFDbkI7QUFFQSxTQUFPLEtBQUssVUFBVSxNQUFNLEtBQUs7QUFDbkM7QUFlQSxNQUFNLGlCQUF5QztBQUFBO0FBQUEsRUFHN0MsS0FBSztBQUFBLEVBQU8sS0FBSztBQUFBLEVBQU8sSUFBSTtBQUFBO0FBQUEsRUFFNUIsTUFBTTtBQUFBO0FBQUEsRUFFTixXQUFXO0FBQUEsRUFBYSxZQUFZO0FBQUE7QUFBQSxFQUVwQyxRQUFRO0FBQUEsRUFBTyxRQUFRO0FBQUEsRUFBTyxRQUFRO0FBQUE7QUFBQSxFQUd0QyxLQUFLO0FBQUEsRUFBTyxLQUFLO0FBQUEsRUFBTyxNQUFNO0FBQUEsRUFDOUIsYUFBYTtBQUFBLEVBQWUsY0FBYztBQUFBO0FBQUEsRUFFMUMsUUFBUTtBQUFBO0FBQUEsRUFHUixJQUFJO0FBQUEsRUFBTSxJQUFJO0FBQUEsRUFDZCxRQUFRO0FBQUEsRUFBUyxRQUFRO0FBQUEsRUFDekIsT0FBTztBQUFBLEVBQVMsT0FBTztBQUFBO0FBQUEsRUFHdkIsS0FBSztBQUFBLEVBQU8sSUFBSTtBQUFBLEVBQU0sS0FBSztBQUFBLEVBQU8sS0FBSztBQUFBO0FBQUEsRUFHdkMsS0FBSztBQUFBLEVBQU8sS0FBSztBQUFBLEVBQU8sS0FBSztBQUFBLEVBQU8sS0FBSztBQUFBLEVBQU8sS0FBSztBQUFBLEVBQ3JELEtBQUs7QUFBQSxFQUFPLE1BQU07QUFBQSxFQUFRLEtBQUs7QUFBQSxFQUMvQixJQUFJO0FBQUEsRUFBTSxLQUFLO0FBQUEsRUFBTyxLQUFLO0FBQUEsRUFDM0IsS0FBSztBQUFBLEVBQU8sS0FBSztBQUFBLEVBQU8sS0FBSztBQUFBLEVBQzdCLE1BQU07QUFBQSxFQUFRLE1BQU07QUFBQSxFQUFRLE1BQU07QUFBQSxFQUNsQyxLQUFLO0FBQUEsRUFBUSxLQUFLO0FBQUEsRUFBUSxLQUFLO0FBQUE7QUFBQTtBQUFBLEVBRy9CLElBQUk7QUFBQSxFQUFNLElBQUk7QUFBQSxFQUFNLElBQUk7QUFBQSxFQUFNLElBQUk7QUFBQSxFQUFNLElBQUk7QUFBQSxFQUFNLElBQUk7QUFBQSxFQUN0RCxLQUFLO0FBQUE7QUFBQTtBQUFBLEVBR0wsTUFBTTtBQUFBLEVBQVEsS0FBSztBQUFBLEVBQU8sS0FBSztBQUFBLEVBQU8sT0FBTztBQUFBLEVBQzdDLEtBQUs7QUFBQSxFQUFPLEtBQUs7QUFBQTtBQUFBLEVBR2pCLE9BQU87QUFBQTtBQUFBLEVBR1AsT0FBTztBQUFBLEVBQVMsU0FBUztBQUFBLEVBQ3pCLFFBQVE7QUFBQSxFQUFVLFNBQVM7QUFBQTtBQUFBLEVBRTNCLE9BQU87QUFBQSxFQUFTLE9BQU87QUFBQTtBQUFBLEVBR3ZCLEtBQUs7QUFBQSxFQUFPLE1BQU07QUFBQSxFQUFRLE9BQU87QUFBQSxFQUFTLEtBQUs7QUFBQSxFQUMvQyxRQUFRO0FBQUEsRUFBVSxNQUFNO0FBQUEsRUFBUSxRQUFRO0FBQUEsRUFBVSxRQUFRO0FBQUEsRUFBVSxTQUFTO0FBQUEsRUFDN0UsWUFBWTtBQUFBLEVBQWMsWUFBWTtBQUFBO0FBQUEsRUFFdEMsT0FBTztBQUFBLEVBQU8sUUFBUTtBQUFBLEVBQVEsU0FBUztBQUFBLEVBQVMsT0FBTztBQUFBLEVBQ3ZELFFBQVE7QUFBQSxFQUFRLFFBQVE7QUFBQSxFQUFRLFVBQVU7QUFBQTtBQUFBO0FBQUEsRUFJMUMsTUFBTTtBQUFBLEVBQVEsTUFBTTtBQUFBLEVBQ3BCLE9BQU87QUFBQSxFQUFTLE9BQU87QUFBQTtBQUFBLEVBRXZCLE9BQU87QUFBQSxFQUFRLE1BQU07QUFBQSxFQUFRLE1BQU07QUFBQSxFQUFRLFNBQVM7QUFBQSxFQUNwRCxXQUFXO0FBQUEsRUFBUSxVQUFVO0FBQUEsRUFDN0IsWUFBWTtBQUFBLEVBQVMsWUFBWTtBQUFBLEVBQ2pDLFFBQVE7QUFBQSxFQUFRLFFBQVE7QUFBQTtBQUFBO0FBQUEsRUFJeEIsU0FBUztBQUFBLEVBQ1QsT0FBTztBQUFBLEVBQVEsT0FBTztBQUFBLEVBQVEsTUFBTTtBQUFBLEVBQVEsT0FBTztBQUFBO0FBQUEsRUFFbkQsYUFBYTtBQUFBLEVBQVEsYUFBYTtBQUFBLEVBQVEsY0FBYztBQUFBLEVBQVEsY0FBYztBQUFBLEVBQzlFLGFBQWE7QUFBQSxFQUFRLGFBQWE7QUFBQSxFQUFRLGFBQWE7QUFBQSxFQUN2RCxhQUFhO0FBQUEsRUFBUSxhQUFhO0FBQUEsRUFBUSxlQUFlO0FBQUEsRUFBUSxlQUFlO0FBQUEsRUFDaEYsY0FBYztBQUFBLEVBQVEsY0FBYztBQUFBO0FBQUE7QUFBQSxFQUlwQyxPQUFPO0FBQUEsRUFBUSxTQUFTO0FBQUEsRUFBUSxVQUFVO0FBQUEsRUFBUSxRQUFRO0FBQUEsRUFDMUQsU0FBUztBQUFBLEVBQVEsUUFBUTtBQUFBLEVBQ3pCLFVBQVU7QUFBQSxFQUFTLFVBQVU7QUFDL0I7QUFFQSxTQUFTLGlCQUFpQixNQUE2QjtBQUNyRCxRQUFNLFFBQVEsS0FBSyxZQUFZO0FBQy9CLFFBQU0sU0FBUyxlQUFlLEtBQUs7QUFDbkMsTUFBSSxPQUFRLFFBQU87QUFFbkIsU0FBTztBQUNUO0FBSUEsTUFBTSxpQkFBa0Q7QUFBQSxFQUN0RCxPQUFPO0FBQUEsRUFBVSxPQUFPO0FBQUEsRUFDeEIsTUFBTTtBQUFBLEVBQVEsV0FBVztBQUFBLEVBQWEsWUFBWTtBQUFBLEVBQ2xELGFBQWE7QUFBQSxFQUFlLGNBQWM7QUFBQSxFQUFnQixRQUFRO0FBQUEsRUFDbEUsUUFBUTtBQUFBLEVBQVUsU0FBUztBQUFBLEVBQzNCLFlBQVk7QUFBQSxFQUFjLFlBQVk7QUFDeEM7QUFFQSxTQUFTLG1CQUFtQixRQUF3QjtBQUNsRCxTQUFPLGVBQWUsTUFBTSxLQUFLO0FBQ25DO0FBSUEsU0FBUyx5QkFBeUIsTUFBaUU7QUFDakcsUUFBTSxTQUFTLGlCQUFpQixJQUFJO0FBQ3BDLE1BQUksQ0FBQyxPQUFRLFFBQU87QUFFcEIsUUFBTSxnQkFBZ0IsV0FBVyxLQUFLLFlBQVksS0FBSyxXQUFXO0FBQ2xFLFNBQU8sRUFBRSxRQUFRLGNBQWM7QUFDakM7QUFJQSxTQUFTLG1CQUNQLFVBQ0EsT0FDQSxVQUNBLFVBQ0EsV0FBaUMsSUFBSSxxQkFBcUIsR0FDOUM7QUFDWixRQUFNLFFBQW1CLENBQUM7QUFDMUIsUUFBTSxRQUFtQixDQUFDO0FBQzFCLE1BQUksVUFBVTtBQUVkLGFBQVcsU0FBUyxVQUFVO0FBQzVCLFVBQU0sV0FBVyxNQUFNLE9BQU8sZUFBZTtBQUM3QyxVQUFNLFVBQVUsTUFBTSxVQUFVLGVBQWU7QUFDL0MsVUFBTSxTQUFTLE1BQU0sU0FBUyxRQUFRLEtBQUs7QUFDM0MsVUFBTSxZQUFZLE1BQU0sUUFBUSxPQUFPLEtBQUs7QUFDNUMsVUFBTSxZQUFZLE1BQU0sUUFBUSxPQUFPO0FBR3ZDLFVBQU0saUJBQWlCLG9CQUFJLElBQVk7QUFDdkMsUUFBSSxXQUFXO0FBQ2IsaUJBQVcsVUFBVSxXQUFXLFdBQVcsTUFBTSxHQUFHO0FBQ2xELGNBQU0sVUFBVSxDQUFDLEdBQUcsV0FBVyxRQUFRLFNBQVMsR0FBRyxHQUFHLFdBQVcsUUFBUSxVQUFVLENBQUM7QUFFcEYsaUJBQVMsS0FBSyxHQUFHLEtBQUssUUFBUSxRQUFRLE1BQU07QUFDMUMsZ0JBQU0sT0FBTyxLQUFLLFFBQVEsRUFBRSxHQUFHLEtBQUs7QUFDcEMsZ0JBQU0sUUFBUSxLQUFLLFFBQVEsRUFBRSxHQUFHLE1BQU0sS0FBSyxJQUFJLFlBQVk7QUFDM0QsY0FBSSxTQUFTLFNBQVMsUUFBUSxTQUFTLE1BQU0sU0FBUyxPQUFRLGdCQUFlLElBQUksSUFBSTtBQUFBLFFBQ3ZGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFHQSxlQUFXLFdBQVcsV0FBVyxXQUFXLE1BQU0sRUFBRSxPQUFPLFdBQVcsV0FBVyxNQUFNLENBQUMsR0FBRztBQUN6RixZQUFNLE1BQU0sS0FBSyxTQUFTLEtBQUs7QUFDL0IsWUFBTSxPQUFPLEtBQUssU0FBUyxNQUFNLEtBQUssS0FBSyxNQUFNLFNBQVMsVUFBVSxHQUFHLE1BQU0sS0FBSztBQUNsRjtBQUNBLFlBQU0sYUFBYyxVQUFVLElBQUs7QUFDbkMsWUFBTSxhQUFhLEtBQUssTUFBTSxVQUFVLENBQUMsSUFBSTtBQUM3QyxZQUFNLElBQUksT0FBTyxLQUFLLFNBQVMsR0FBRyxLQUFLLEtBQUssU0FBUyxHQUFHLENBQUMsS0FBSztBQUM5RCxZQUFNLElBQUksT0FBTyxLQUFLLFNBQVMsR0FBRyxLQUFLLEtBQUssU0FBUyxHQUFHLENBQUMsS0FBSztBQUc5RCxZQUFNLEVBQUUsUUFBUSxXQUFXLFNBQVMsV0FBVyxJQUFJLGVBQWUsTUFBTSxDQUFDLEdBQUcsT0FBTyxHQUFHLEVBQUU7QUFDeEYsWUFBTSxTQUFnQixDQUFDLEdBQUcsU0FBUztBQUNuQyxZQUFNLFVBQWlCLENBQUMsR0FBRyxVQUFVO0FBR3JDLGlCQUFXLFNBQVMsV0FBVyxTQUFTLFFBQVEsR0FBRztBQUNqRCxjQUFNLE1BQU0sS0FBSyxPQUFPLFdBQVc7QUFDbkMsY0FBTSxVQUFVLEtBQUssT0FBTyxNQUFNLEtBQUssZUFBZSxLQUFLO0FBQzNELGNBQU0sZ0JBQWdCLGVBQWUsTUFBTSxTQUFTLFFBQVEsU0FBUyxRQUFRLFdBQVcsV0FBVyxPQUFPO0FBQzFHLFlBQUksUUFBUSxTQUFTLFFBQVEsVUFBVTtBQUNyQyxjQUFJLENBQUMsUUFBUSxLQUFLLE9BQUssRUFBRSxTQUFTLE9BQU8sR0FBRztBQUMxQyxvQkFBUSxLQUFLLEVBQUUsSUFBSSxNQUFNLEtBQUssR0FBRyxNQUFNLFNBQVMsVUFBVSxjQUFjLENBQUM7QUFBQSxVQUMzRTtBQUFBLFFBQ0YsT0FBTztBQUNMLGNBQUksQ0FBQyxPQUFPLEtBQUssT0FBSyxFQUFFLFNBQVMsT0FBTyxHQUFHO0FBQ3pDLG1CQUFPLEtBQUssRUFBRSxJQUFJLE1BQU0sS0FBSyxHQUFHLE1BQU0sU0FBUyxVQUFVLGNBQWMsQ0FBQztBQUFBLFVBQzFFO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFDQSxVQUFJLE9BQU8sV0FBVyxFQUFHLFFBQU8sS0FBSyxFQUFFLElBQUksTUFBTSxLQUFLLEdBQUcsTUFBTSxNQUFNLFVBQVUsT0FBTyxDQUFDO0FBQ3ZGLFVBQUksUUFBUSxXQUFXLEVBQUcsU0FBUSxLQUFLLEVBQUUsSUFBSSxNQUFNLEtBQUssR0FBRyxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFFMUYsWUFBTSxnQkFBZ0Isa0JBQWtCLElBQUk7QUFDNUMsWUFBTSxVQUFtQjtBQUFBLFFBQ3ZCLElBQUksT0FBTyxHQUFHO0FBQUEsUUFDZCxNQUFNO0FBQUEsUUFDTixjQUFjLEdBQUcsSUFBSSxJQUFJLEdBQUc7QUFBQSxRQUM1QixVQUFVLEVBQUUsR0FBRyxFQUFFO0FBQUEsUUFDakI7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUNBLFVBQUksa0JBQWtCLFFBQVEsa0JBQWtCLEtBQUssWUFBWSxHQUFHO0FBQ2xFLGdCQUFRLHFCQUFxQjtBQUFBLE1BQy9CO0FBQ0EsWUFBTSxLQUFLLE9BQU87QUFBQSxJQUNwQjtBQUdBLGVBQVcsU0FBUyxXQUFXLFdBQVcsUUFBUSxHQUFHO0FBQ25ELFlBQU0sTUFBTSxLQUFLLE9BQU8sS0FBSztBQUM3QixVQUFJLENBQUMsSUFBSztBQUNWLFlBQU0sVUFBVSxlQUFlLEtBQUs7QUFDcEM7QUFDQSxZQUFNLGFBQWMsVUFBVSxJQUFLO0FBQ25DLFlBQU0sYUFBYSxLQUFLLE1BQU0sVUFBVSxDQUFDLElBQUk7QUFDN0MsWUFBTSxJQUFJLE9BQU8sS0FBSyxPQUFPLEdBQUcsS0FBSyxLQUFLLE9BQU8sR0FBRyxDQUFDLEtBQUs7QUFDMUQsWUFBTSxJQUFJLE9BQU8sS0FBSyxPQUFPLEdBQUcsS0FBSyxLQUFLLE9BQU8sR0FBRyxDQUFDLEtBQUs7QUFDMUQsWUFBTSxVQUFVLGVBQWUsSUFBSSxHQUFHO0FBQ3RDLFlBQU0sYUFBYSxTQUFTLFFBQVEsT0FBTztBQUMzQyxZQUFNLEtBQUs7QUFBQSxRQUNULElBQUksT0FBTyxHQUFHO0FBQUEsUUFDZCxNQUFNLFVBQVUsZ0JBQWdCO0FBQUEsUUFDaEMsS0FBSyxFQUFFLE1BQU0sU0FBUyxVQUFVLFdBQVc7QUFBQSxRQUMzQyxVQUFVLEVBQUUsR0FBRyxFQUFFO0FBQUEsUUFDakIsUUFBUSxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxNQUFNLEtBQUssR0FBRyxNQUFNLE1BQU0sVUFBVSxXQUFXLENBQUM7QUFBQSxRQUM5RSxTQUFTLFVBQVUsQ0FBQyxFQUFFLElBQUksTUFBTSxLQUFLLEdBQUcsTUFBTSxPQUFPLFVBQVUsV0FBVyxDQUFDLElBQUksQ0FBQztBQUFBLE1BQ2xGLENBQUM7QUFBQSxJQUNIO0FBR0EsUUFBSSxXQUFXO0FBQ2IsaUJBQVcsVUFBVSxXQUFXLFdBQVcsTUFBTSxHQUFHO0FBQ2xELGNBQU0sV0FBVyxXQUFXLFFBQVEsU0FBUztBQUM3QyxjQUFNLFlBQVksV0FBVyxRQUFRLFVBQVU7QUFDL0MsY0FBTSxVQUFVLENBQUMsR0FBRyxVQUFVLEdBQUcsU0FBUztBQUUxQyxZQUFJLFFBQVEsVUFBVSxHQUFHO0FBQ3ZCLGdCQUFNLFNBQVMsUUFBUSxDQUFDO0FBQ3hCLGdCQUFNLE9BQU8sUUFBUSxDQUFDO0FBQ3RCLGdCQUFNLFVBQVUsS0FBSyxRQUFRLEtBQUssS0FBSztBQUN2QyxnQkFBTSxRQUFRLEtBQUssTUFBTSxLQUFLLEtBQUs7QUFDbkMsZ0JBQU0sVUFBVSxLQUFLLFFBQVEsTUFBTSxLQUFLO0FBQ3hDLGdCQUFNLFFBQVEsS0FBSyxNQUFNLE1BQU0sS0FBSztBQUVwQyxjQUFJLFdBQVcsT0FBTztBQUNwQixrQkFBTSxLQUFLO0FBQUEsY0FDVCxJQUFJLE1BQU0sTUFBTTtBQUFBLGNBQ2hCLE1BQU0sRUFBRSxRQUFRLE9BQU8sT0FBTyxJQUFJLEtBQUssUUFBUTtBQUFBLGNBQy9DLElBQUksRUFBRSxRQUFRLE9BQU8sS0FBSyxJQUFJLEtBQUssTUFBTTtBQUFBLFlBQzNDLENBQUM7QUFBQSxVQUNIO0FBR0EsbUJBQVMsS0FBSyxHQUFHLEtBQUssUUFBUSxRQUFRLE1BQU07QUFDMUMsa0JBQU0sV0FBVyxLQUFLLFFBQVEsRUFBRSxHQUFHLEtBQUssS0FBSztBQUM3QyxrQkFBTSxXQUFXLEtBQUssUUFBUSxFQUFFLEdBQUcsTUFBTSxLQUFLO0FBQzlDLGdCQUFJLFdBQVcsVUFBVTtBQUN2QixvQkFBTSxLQUFLO0FBQUEsZ0JBQ1QsSUFBSSxNQUFNLE1BQU07QUFBQSxnQkFDaEIsTUFBTSxFQUFFLFFBQVEsT0FBTyxPQUFPLElBQUksS0FBSyxRQUFRO0FBQUEsZ0JBQy9DLElBQUksRUFBRSxRQUFRLE9BQU8sUUFBUSxJQUFJLEtBQUssU0FBUztBQUFBLGNBQ2pELENBQUM7QUFBQSxZQUNIO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFFQSxTQUFPLEVBQUUsT0FBTyxNQUFNO0FBQ3hCO0FBRUEsU0FBUyxrQkFBa0IsTUFBNEI7QUFDckQsUUFBTSxRQUFRLEtBQUssWUFBWTtBQUcvQixRQUFNLGFBQTJDO0FBQUEsSUFDL0MsS0FBSztBQUFBLElBQU8sSUFBSTtBQUFBLElBQU0sS0FBSztBQUFBLElBQU8sS0FBSztBQUFBLElBQU8sTUFBTTtBQUFBLElBQVEsS0FBSztBQUFBLEVBQ25FO0FBQ0EsTUFBSSxXQUFXLEtBQUssRUFBRyxRQUFPLFdBQVcsS0FBSztBQUc5QyxRQUFNLFNBQXVDO0FBQUEsSUFDM0MsS0FBSztBQUFBLElBQU8sS0FBSztBQUFBLElBQU8sSUFBSTtBQUFBLElBQzVCLE1BQU07QUFBQSxJQUNOLFdBQVc7QUFBQSxJQUFhLFlBQVk7QUFBQSxJQUNwQyxNQUFNO0FBQUEsSUFBTyxNQUFNO0FBQUEsSUFBTyxNQUFNO0FBQUEsSUFDaEMsUUFBUTtBQUFBLEVBQ1Y7QUFDQSxNQUFJLE9BQU8sS0FBSyxFQUFHLFFBQU8sT0FBTyxLQUFLO0FBR3RDLFFBQU0sV0FBeUM7QUFBQSxJQUM3QyxLQUFLO0FBQUEsSUFBTyxLQUFLO0FBQUEsSUFBTyxNQUFNO0FBQUEsSUFDOUIsYUFBYTtBQUFBLElBQWUsY0FBYztBQUFBLEVBQzVDO0FBQ0EsTUFBSSxTQUFTLEtBQUssRUFBRyxRQUFPLFNBQVMsS0FBSztBQUcxQyxRQUFNLFdBQXlDO0FBQUEsSUFDN0MsSUFBSTtBQUFBLElBQU0sSUFBSTtBQUFBLElBQ2QsUUFBUTtBQUFBLElBQVMsUUFBUTtBQUFBLElBQVMsT0FBTztBQUFBLElBQVMsT0FBTztBQUFBLEVBQzNEO0FBQ0EsTUFBSSxTQUFTLEtBQUssRUFBRyxRQUFPLFNBQVMsS0FBSztBQUcxQyxRQUFNLFFBQXNDO0FBQUEsSUFDMUMsS0FBSztBQUFBLElBQU8sS0FBSztBQUFBLElBQU8sS0FBSztBQUFBLElBQU8sS0FBSztBQUFBLElBQU8sS0FBSztBQUFBLElBQ3JELEtBQUs7QUFBQSxJQUFPLE1BQU07QUFBQSxJQUFRLEtBQUs7QUFBQSxJQUMvQixJQUFJO0FBQUEsSUFBTSxLQUFLO0FBQUEsSUFBTyxLQUFLO0FBQUEsSUFDM0IsS0FBSztBQUFBLElBQU8sS0FBSztBQUFBLElBQU8sS0FBSztBQUFBLElBQzdCLE1BQU07QUFBQSxJQUFRLE1BQU07QUFBQSxJQUFRLE1BQU07QUFBQSxJQUNsQyxLQUFLO0FBQUEsSUFBUSxLQUFLO0FBQUEsSUFBUSxLQUFLO0FBQUEsRUFDakM7QUFDQSxNQUFJLE1BQU0sS0FBSyxFQUFHLFFBQU8sTUFBTSxLQUFLO0FBR3BDLFFBQU0sTUFBb0M7QUFBQSxJQUN4QyxJQUFJO0FBQUEsSUFBTSxJQUFJO0FBQUEsSUFBTSxJQUFJO0FBQUEsSUFBTSxJQUFJO0FBQUEsSUFBTSxJQUFJO0FBQUEsSUFBTSxJQUFJO0FBQUEsRUFDeEQ7QUFDQSxNQUFJLElBQUksS0FBSyxFQUFHLFFBQU8sSUFBSSxLQUFLO0FBR2hDLFFBQU0sT0FBcUM7QUFBQSxJQUN6QyxNQUFNO0FBQUEsSUFBUSxLQUFLO0FBQUEsSUFBTyxLQUFLO0FBQUEsSUFBTyxPQUFPO0FBQUEsSUFBUyxLQUFLO0FBQUEsSUFBTyxLQUFLO0FBQUEsSUFDdkUsT0FBTztBQUFBLEVBQ1Q7QUFDQSxNQUFJLEtBQUssS0FBSyxFQUFHLFFBQU8sS0FBSyxLQUFLO0FBR2xDLFFBQU0sUUFBc0M7QUFBQSxJQUMxQyxPQUFPO0FBQUEsSUFBUyxTQUFTO0FBQUEsSUFBVyxRQUFRO0FBQUEsSUFBVSxTQUFTO0FBQUEsSUFDL0QsT0FBTztBQUFBLElBQVMsT0FBTztBQUFBLEVBQ3pCO0FBQ0EsTUFBSSxNQUFNLEtBQUssRUFBRyxRQUFPLE1BQU0sS0FBSztBQUdwQyxRQUFNLFNBQXVDO0FBQUEsSUFDM0MsS0FBSztBQUFBLElBQU8sTUFBTTtBQUFBLElBQVEsT0FBTztBQUFBLElBQVMsS0FBSztBQUFBLElBQy9DLFFBQVE7QUFBQSxJQUFVLE1BQU07QUFBQSxJQUFRLFFBQVE7QUFBQSxJQUFVLFFBQVE7QUFBQSxJQUFVLFNBQVM7QUFBQSxJQUM3RSxZQUFZO0FBQUEsSUFBYyxZQUFZO0FBQUEsSUFDdEMsT0FBTztBQUFBLElBQVMsUUFBUTtBQUFBLElBQVUsU0FBUztBQUFBLElBQVcsT0FBTztBQUFBLElBQzdELFFBQVE7QUFBQSxJQUFVLFFBQVE7QUFBQSxJQUFVLFVBQVU7QUFBQSxFQUNoRDtBQUNBLE1BQUksT0FBTyxLQUFLLEVBQUcsUUFBTyxPQUFPLEtBQUs7QUFHdEMsUUFBTSxPQUFxQztBQUFBLElBQ3pDLFNBQVM7QUFBQSxJQUFXLE9BQU87QUFBQSxJQUFTLE9BQU87QUFBQSxJQUFTLE1BQU07QUFBQSxJQUFRLE9BQU87QUFBQSxJQUN6RSxhQUFhO0FBQUEsSUFBZSxhQUFhO0FBQUEsSUFDekMsY0FBYztBQUFBLElBQWdCLGNBQWM7QUFBQSxJQUM1QyxhQUFhO0FBQUEsSUFBZSxhQUFhO0FBQUEsSUFBZSxhQUFhO0FBQUEsSUFDckUsYUFBYTtBQUFBLElBQWUsYUFBYTtBQUFBLElBQ3pDLGVBQWU7QUFBQSxJQUFpQixlQUFlO0FBQUEsSUFDL0MsY0FBYztBQUFBLElBQWdCLGNBQWM7QUFBQSxFQUM5QztBQUNBLE1BQUksS0FBSyxLQUFLLEVBQUcsUUFBTyxLQUFLLEtBQUs7QUFHbEMsUUFBTSxRQUFzQztBQUFBLElBQzFDLE1BQU07QUFBQSxJQUFRLE1BQU07QUFBQSxJQUFRLE9BQU87QUFBQSxJQUFTLE9BQU87QUFBQSxJQUNuRCxPQUFPO0FBQUEsSUFBUSxNQUFNO0FBQUEsSUFBUSxNQUFNO0FBQUEsSUFBUSxTQUFTO0FBQUEsSUFDcEQsU0FBUztBQUFBLElBQVEsUUFBUTtBQUFBLElBQ3pCLFVBQVU7QUFBQSxJQUFTLFVBQVU7QUFBQSxJQUM3QixNQUFNO0FBQUEsSUFBUSxNQUFNO0FBQUEsRUFDdEI7QUFDQSxNQUFJLE1BQU0sS0FBSyxFQUFHLFFBQU8sTUFBTSxLQUFLO0FBR3BDLFNBQU87QUFDVDtBQUlBLFNBQVMsbUJBQ1AsVUFDQSxPQUNBLFVBQ0EsVUFDWTtBQUNaLFFBQU0sUUFBbUIsQ0FBQztBQUMxQixRQUFNLGNBQStCLENBQUM7QUFDdEMsUUFBTSxRQUFtQixDQUFDO0FBQzFCLFFBQU0sUUFBbUIsQ0FBQztBQUcxQixRQUFNLGFBQWEsb0JBQUksSUFBWTtBQUNuQyxRQUFNLGNBQWMsb0JBQUksSUFBWTtBQUlwQyxRQUFNLFlBQVksb0JBQUksSUFBd0I7QUFFOUMsYUFBVyxTQUFTLFVBQVU7QUFDNUIsVUFBTSxXQUFXLE1BQU0sT0FBTyxlQUFlO0FBQzdDLFVBQU0sVUFBVSxNQUFNLFVBQVUsZUFBZTtBQUUvQyxVQUFNLFVBQVUsTUFBTSxTQUFTLE9BQU87QUFDdEMsVUFBTSxhQUFhLFVBQVUsTUFBTSxTQUFTLFVBQVUsSUFBSTtBQUUxRCxVQUFNLFdBQVcsY0FBYyxNQUFNLFNBQVMsUUFBUSxLQUFLO0FBRTNELFVBQU0sVUFBYyxNQUFNLFVBQVUsT0FBTztBQUMzQyxVQUFNLGdCQUFnQixNQUFNLFVBQVUsYUFBYTtBQUNuRCxVQUFNLGFBQWMsTUFBTSxVQUFVLFVBQVU7QUFDOUMsVUFBTSxnQkFBZ0IsTUFBTSxVQUFVLGFBQWE7QUFFbkQsVUFBTSxrQkFBcUMsQ0FBQyxLQUFLLEtBQUssS0FBSyxLQUFLLE1BQU0sTUFBTSxLQUFLLEtBQUssTUFBTSxNQUFNLElBQUk7QUFHdEcsZUFBVyxVQUFVLFdBQVcsV0FBVyxVQUFVLE1BQU0sR0FBRztBQUM1RCxZQUFNLE1BQU0sS0FBSyxRQUFRLFFBQVEsS0FBSyxLQUFLLFFBQVEsS0FBSyxLQUFLO0FBQzdELFlBQU0sT0FBTyxLQUFLLFFBQVEsTUFBTSxLQUFLLElBQUksR0FBRztBQUM1QyxZQUFNLFlBQVksS0FBSyxRQUFRLE1BQU0sTUFBTSxVQUFVLEtBQUssUUFBUSxhQUFhLE1BQU07QUFDckYsaUJBQVcsSUFBSSxHQUFHO0FBRWxCLFlBQU0sVUFBdUIsQ0FBQztBQUU5QixZQUFNLG1CQUFtQixNQUFNLFFBQVEsU0FBUyxLQUFLO0FBR3JELFlBQU0saUJBQWlCLE1BQU0sa0JBQWtCLE9BQU87QUFDdEQsVUFBSSxnQkFBZ0I7QUFFbEIsY0FBTSxVQUFVLFdBQVcsZ0JBQWdCLG1CQUFtQjtBQUM5RCxjQUFNLFlBQVksUUFBUSxTQUFTLEtBQzlCLEtBQUssUUFBUSxDQUFDLEdBQUcsTUFBTSxHQUFHLFdBQVcsSUFBSSxJQUFJLEtBQUssUUFBUSxDQUFDLENBQUMsSUFBSSxLQUFLLFFBQVEsQ0FBQyxDQUFDLE1BQU0sS0FDdEYsS0FBSyxjQUFjLEtBQUs7QUFDNUIsWUFBSSxXQUFXO0FBQ2Isa0JBQVEsS0FBSztBQUFBLFlBQ1gsSUFBSSxNQUFNLFVBQVUsR0FBRyxFQUFFO0FBQUEsWUFDekIsV0FBVztBQUFBLFlBQ1gsS0FBSyxFQUFFLE1BQU0sV0FBVyxVQUFVLE9BQU87QUFBQSxVQUMzQyxDQUFDO0FBQUEsUUFDSDtBQUFBLE1BQ0Y7QUFFQSxpQkFBVyxZQUFZLFdBQVcsa0JBQWtCLFFBQVEsR0FBRztBQUM3RCxjQUFNLGFBQWEsS0FBSyxVQUFVLFdBQVcsS0FBSyxLQUFLLFlBQVk7QUFDbkUsY0FBTSxhQUFhLEtBQUssVUFBVSxNQUFNLEtBQUssS0FBSyxNQUFNLFVBQVUsTUFBTSxDQUFDLEtBQUs7QUFDOUUsY0FBTSxXQUFXLEtBQUssVUFBVSxVQUFVLEtBQUs7QUFDL0MsWUFBSSxZQUFZO0FBQ2Qsa0JBQVEsS0FBSztBQUFBLFlBQ1gsSUFBSSxNQUFNLFVBQVUsR0FBRyxFQUFFO0FBQUEsWUFDekIsV0FBVyxnQkFBZ0IsU0FBUyxTQUFTLElBQUksWUFBWTtBQUFBLFlBQzdELEtBQUssRUFBRSxNQUFNLFlBQVksVUFBVSxPQUFPO0FBQUEsWUFDMUM7QUFBQSxVQUNGLENBQUM7QUFBQSxRQUNIO0FBQUEsTUFDRjtBQUVBLFlBQU0sS0FBSztBQUFBLFFBQ1QsSUFBSSxnQkFBZ0IsR0FBRztBQUFBLFFBQ3ZCO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBLFVBQVUsRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQUEsTUFDekIsQ0FBQztBQUFBLElBQ0g7QUFNQSxlQUFXLFdBQVcsV0FBVyxpQkFBaUIsVUFBVSxZQUFZLEdBQUc7QUFDekUsWUFBTSxNQUFNLEtBQUssU0FBUyxRQUFRLEtBQUssS0FBSyxTQUFTLEtBQUssS0FBSztBQUMvRCxZQUFNLE9BQU8sS0FBSyxTQUFTLE1BQU0sS0FBSyxJQUFJLEdBQUc7QUFDN0MsWUFBTSxXQUFXLEtBQUssU0FBUyxxQkFBcUIsS0FBSztBQUN6RCxrQkFBWSxJQUFJLEdBQUc7QUFHbkIsWUFBTSxXQUFXLE1BQU0sU0FBUyxRQUFRO0FBQ3hDLFVBQUksWUFBWTtBQUNoQixVQUFJLFVBQVU7QUFFWixjQUFNLFdBQVcsTUFBTSxVQUFVLE9BQU87QUFDeEMsY0FBTSxZQUFZLFdBQVcsVUFBVSxRQUFRO0FBQy9DLFlBQUksVUFBVSxTQUFTLEdBQUc7QUFDeEIsc0JBQVksVUFBVSxJQUFJLE9BQUssZUFBZSxDQUFDLENBQUMsRUFBRSxPQUFPLE9BQUssTUFBTSxhQUFhLEVBQUUsS0FBSyxPQUFPLEtBQUs7QUFBQSxRQUN0RyxPQUFPO0FBRUwsc0JBQVk7QUFBQSxRQUNkO0FBQUEsTUFDRixPQUFPO0FBQ0wsY0FBTSxjQUFjLE1BQU0sU0FBUyxXQUFXO0FBQzlDLFlBQUksYUFBYTtBQUNmLHNCQUFZLEtBQUssV0FBVyxLQUFLO0FBQUEsUUFDbkM7QUFBQSxNQUNGO0FBRUEsa0JBQVksS0FBSztBQUFBLFFBQ2YsSUFBSSxpQkFBaUIsR0FBRztBQUFBLFFBQ3hCO0FBQUEsUUFDQSxVQUFVLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLE1BQ3pCLENBQUM7QUFBQSxJQUNIO0FBR0EsZUFBVyxZQUFZLFdBQVcsY0FBYyxVQUFVLFFBQVEsR0FBRztBQUNuRSxZQUFNLE1BQU0sS0FBSyxVQUFVLFFBQVEsS0FBSztBQUN4QyxZQUFNLE9BQVEsS0FBSyxVQUFVLE1BQU0sS0FBSztBQUN4QyxZQUFNLGNBQWMsT0FBTyxLQUFLLFVBQVUsYUFBYSxLQUFLLEdBQUc7QUFDL0QsZ0JBQVUsSUFBSSxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFBQSxJQUMxQztBQUdBLFVBQU0sY0FBYyxDQUFDLFdBQXFHO0FBQ3hILFVBQUksQ0FBQyxPQUFRLFFBQU87QUFDcEIsWUFBTSxVQUFVLE1BQU0sUUFBUSxTQUFTO0FBQ3ZDLFlBQU0sV0FBVyxNQUFNLFFBQVEsZUFBZTtBQUM5QyxZQUFNLFlBQVksTUFBTSxRQUFRLFdBQVc7QUFDM0MsWUFBTSxVQUFVLE1BQU0sUUFBUSxlQUFlO0FBQzdDLFVBQUksUUFBUyxRQUFPLEVBQUUsSUFBSSxnQkFBZ0IsS0FBSyxTQUFTLFFBQVEsQ0FBQyxHQUFHO0FBQ3BFLFVBQUksU0FBVSxRQUFPLEVBQUUsSUFBSSxpQkFBaUIsS0FBSyxVQUFVLFFBQVEsQ0FBQyxHQUFHO0FBQ3ZFLFVBQUksV0FBVztBQUNiLGNBQU0sTUFBTSxLQUFLLFdBQVcsUUFBUSxLQUFLO0FBQ3pDLGNBQU0sU0FBUyxLQUFLLFdBQVcsSUFBSTtBQUNuQyxjQUFNLFVBQVUsS0FBSyxXQUFXLEtBQUs7QUFDckMsY0FBTSxPQUFPLFdBQVcsS0FBSyxPQUFPLE1BQU0sSUFBSSxPQUFPLFdBQVcsR0FBRztBQUNuRSxlQUFPLEVBQUUsSUFBSSxrQkFBa0IsR0FBRyxJQUFJLFdBQVcsS0FBSyxZQUFZLEtBQUs7QUFBQSxNQUN6RTtBQUNBLFVBQUksWUFBWSxVQUFhLFlBQVksS0FBTSxRQUFPLEVBQUUsSUFBSSxlQUFlLE9BQU8sS0FBSztBQUN2RixhQUFPO0FBQUEsSUFDVDtBQUVBLGVBQVcsVUFBVSxXQUFXLGlCQUFpQixVQUFVLFlBQVksR0FBRztBQUN4RSxZQUFNLGVBQWUsS0FBSyxNQUFNLFFBQVEsVUFBVSxDQUFDLEtBQUs7QUFDeEQsWUFBTSxXQUFXLFlBQVksTUFBTSxRQUFRLFVBQVUsQ0FBQztBQUN0RCxZQUFNLFNBQVcsWUFBWSxNQUFNLFFBQVEsUUFBUSxDQUFDO0FBQ3BELFVBQUksQ0FBQyxZQUFZLENBQUMsT0FBUTtBQUcxQixVQUFJLFNBQVMsU0FBUztBQUN0QixVQUFJLE9BQVMsT0FBTztBQUNwQixZQUFNLGFBQWEsaUJBQWlCO0FBQ3BDLFVBQUksY0FBK0I7QUFFbkMsVUFBSSxTQUFTLGNBQWMsUUFBVztBQUNwQyxjQUFNLE9BQU8sVUFBVSxJQUFJLFNBQVMsU0FBUztBQUM3QyxjQUFNLGlCQUFpQixNQUFNLFNBQVMsY0FBYyxNQUFNLFNBQVM7QUFDbkUsc0JBQWMsaUJBQWlCLDRCQUE0QjtBQUFBLE1BQzdELFdBQVcsT0FBTyxjQUFjLFFBQVc7QUFDekMsY0FBTSxPQUFPLFVBQVUsSUFBSSxPQUFPLFNBQVM7QUFDM0MsY0FBTSxpQkFBaUIsTUFBTSxTQUFTLGNBQWMsTUFBTSxTQUFTO0FBRW5FLGNBQU0sV0FBVyxNQUFNLE1BQU0sUUFBUSxRQUFRLEdBQUcsV0FBVyxNQUFNLFVBQy9ELEtBQUssTUFBTSxNQUFNLFFBQVEsUUFBUSxHQUFHLFdBQVcsR0FBRyxJQUFJLE1BQU07QUFDOUQsc0JBQWMsV0FDVCxpQkFBaUIsNkJBQTZCLDBCQUM5QyxpQkFBaUIsNEJBQTRCO0FBQUEsTUFDcEQ7QUFHQSxVQUFJLE9BQU8sT0FBTztBQUVoQjtBQUFBLE1BQ0Y7QUFHQSxVQUFJLFlBQVk7QUFDZCxjQUFNLGVBQWU7QUFDckIsY0FBTSxnQkFBZ0IsYUFBYSxRQUFRLGlCQUFpQixFQUFFO0FBQzlELGNBQU0sYUFBYSxNQUFNLEtBQUssT0FBSyxFQUFFLE9BQU8sWUFBWTtBQUN4RCxjQUFNLFNBQVMsTUFBTSxRQUFRLE1BQU0sRUFBRTtBQUNyQyxjQUFNLEtBQUs7QUFBQSxVQUNULElBQUk7QUFBQSxVQUNKLGdCQUFnQixZQUFZLFFBQVEsSUFBSSxhQUFhO0FBQUEsVUFDckQsVUFBVSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUN6QixDQUFDO0FBQ0QsY0FBTSxLQUFLO0FBQUEsVUFDVCxJQUFJLE1BQU0sUUFBUSxNQUFNLE9BQU87QUFBQSxVQUMvQixNQUFNO0FBQUEsVUFDTixJQUFJO0FBQUEsVUFDSixNQUFNO0FBQUEsUUFDUixDQUFDO0FBQ0Q7QUFBQSxNQUNGO0FBRUEsWUFBTSxLQUFLO0FBQUEsUUFDVCxJQUFJLE1BQU0sUUFBUSxNQUFNLElBQUksSUFBSSxFQUFFO0FBQUEsUUFDbEMsTUFBTTtBQUFBLFFBQ04sSUFBSTtBQUFBLFFBQ0osTUFBTTtBQUFBLE1BQ1IsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBR0EsUUFBTSxXQUF3QixDQUFDO0FBQy9CLFFBQU0sZUFBZSxJQUFJLElBQUksTUFBTSxRQUFRLE9BQUssQ0FBQyxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRSxPQUFPLFFBQU0sR0FBRyxXQUFXLGlCQUFpQixDQUFDLENBQUM7QUFFOUcsYUFBVyxTQUFTLGNBQWM7QUFDaEMsVUFBTSxZQUFZLE1BQU0sUUFBUSxtQkFBbUIsRUFBRTtBQUNyRCxVQUFNLE9BQU8sVUFBVSxJQUFJLFNBQVM7QUFDcEMsUUFBSSxDQUFDLEtBQU07QUFFWCxRQUFJLEtBQUssU0FBUyxjQUFjLEtBQUssU0FBUyxXQUFZO0FBRTFELFVBQU0saUJBQWlCLEtBQUssU0FBUztBQUNyQyxVQUFNLGNBQWMsTUFBTSxPQUFPLE9BQUssRUFBRSxPQUFPLEtBQUssRUFBRSxJQUFJLE9BQUssRUFBRSxJQUFJO0FBQ3JFLFVBQU0sZ0JBQWdCLE1BQU0sT0FBTyxPQUFLLEVBQUUsU0FBUyxLQUFLLEVBQUUsSUFBSSxPQUFLLEVBQUUsRUFBRTtBQUd2RSxVQUFNLFlBQVksQ0FBQyxHQUFHLFlBQVksRUFBRSxLQUFLLFNBQU87QUFDOUMsWUFBTSxPQUFPLElBQUksUUFBUSxtQkFBbUIsRUFBRTtBQUM5QyxZQUFNLFFBQVEsVUFBVSxJQUFJLElBQUk7QUFDaEMsYUFBTyxVQUFVLGlCQUFpQixNQUFNLFNBQVMsV0FBVyxNQUFNLFNBQVM7QUFBQSxJQUM3RSxDQUFDLEtBQUs7QUFFTixVQUFNLGdCQUFnQixNQUFNLE9BQU8sT0FBSyxFQUFFLFNBQVMsU0FBUyxFQUFFLElBQUksT0FBSyxFQUFFLEVBQUU7QUFFM0UsVUFBTSxtQkFBK0IsY0FBYyxJQUFJLFlBQVU7QUFDL0QsWUFBTSxRQUFrQixDQUFDO0FBQ3pCLFVBQUksTUFBTTtBQUNWLGVBQVMsUUFBUSxHQUFHLFFBQVEsSUFBSSxTQUFTO0FBQ3ZDLFlBQUksSUFBSSxXQUFXLGVBQWUsRUFBRyxPQUFNLEtBQUssR0FBRztBQUNuRCxjQUFNLE9BQU8sTUFBTSxLQUFLLE9BQUssRUFBRSxTQUFTLE9BQU8sRUFBRSxTQUFTLFlBQVksQ0FBQyxhQUFhLElBQUksRUFBRSxFQUFFLENBQUM7QUFDN0YsWUFBSSxDQUFDLFFBQVEsYUFBYSxJQUFJLEtBQUssRUFBRSxFQUFHO0FBQ3hDLGNBQU0sS0FBSztBQUFBLE1BQ2I7QUFDQSxhQUFPO0FBQUEsSUFDVCxDQUFDO0FBRUQsUUFBSSxDQUFDLFNBQVMsS0FBSyxPQUFLLEVBQUUsT0FBTyxVQUFVLEtBQUssRUFBRSxHQUFHO0FBQ25ELGVBQVMsS0FBSztBQUFBLFFBQ1osSUFBSSxVQUFVLEtBQUs7QUFBQSxRQUNuQixNQUFNLGlCQUFpQixRQUFRO0FBQUEsUUFDL0Isc0JBQXNCLFlBQVksQ0FBQyxLQUFLO0FBQUEsUUFDeEMsZUFBZTtBQUFBLFFBQ2YscUJBQXFCLGNBQWMsQ0FBQyxLQUFLO0FBQUEsTUFDM0MsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBRUEsU0FBTyxFQUFFLE9BQU8sYUFBYSxPQUFPLFVBQVUsTUFBTTtBQUN0RDtBQUlPLFNBQVMsY0FBYyxTQUEwQztBQUN0RSxRQUFNLFNBQW1CLENBQUM7QUFDMUIsUUFBTSxXQUFxQixDQUFDO0FBQzVCLFFBQU0sVUFBVSxRQUFRO0FBRXhCLE1BQUksYUFBYTtBQUNqQixRQUFNLFVBQVUsTUFBTSxPQUFPLFlBQVk7QUFFekMsUUFBTSxTQUFTLFFBQVEsS0FBSyxJQUFJLFNBQU8sa0JBQWtCLEtBQUssU0FBUyxVQUFVLE9BQU8sQ0FBQztBQUl6RixRQUFNLGNBQXVDO0FBQUEsSUFDM0MsY0FBYztBQUFBLE1BQ1osVUFBUyxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUFBLE1BQ2hDLGVBQWU7QUFBQSxNQUNmLG1CQUFtQixDQUFDO0FBQUEsTUFDcEIsYUFBYSxRQUFRO0FBQUEsTUFDckIsWUFBWSxRQUFRLHdCQUF3QixZQUFZLEtBQUs7QUFBQSxJQUMvRDtBQUFBLElBQ0EsYUFBYSxFQUFFLGFBQWEsVUFBVTtBQUFBLEVBQ3hDO0FBRUEsUUFBTSxNQUFpQyxDQUFDO0FBQ3hDLFFBQU0sTUFBaUMsQ0FBQztBQUN4QyxRQUFNLE1BQWlDLENBQUM7QUFDeEMsVUFBUSxLQUFLLFFBQVEsQ0FBQyxLQUFLLE1BQU07QUFDL0IsVUFBTSxRQUFRLEVBQUUsR0FBRyxPQUFPLENBQUMsR0FBRyxRQUFRLElBQUk7QUFDMUMsUUFBSSxJQUFJLFlBQVksZ0JBQWlCLEtBQUksS0FBSyxLQUFLO0FBQUEsYUFDMUMsSUFBSSxZQUFZLFdBQVksS0FBSSxLQUFLLEtBQUs7QUFBQSxRQUM5QyxLQUFJLEtBQUssS0FBSztBQUFBLEVBQ3JCLENBQUM7QUFDRCxNQUFJLElBQUksU0FBUyxFQUFHLGFBQVksY0FBYyxJQUFJO0FBQ2xELE1BQUksSUFBSSxTQUFTLEVBQUcsYUFBWSxjQUFjLElBQUk7QUFDbEQsTUFBSSxJQUFJLFNBQVMsRUFBRyxhQUFZLGNBQWMsSUFBSTtBQUVsRCxRQUFNLE1BQU0sRUFBRSxVQUFVLFlBQVk7QUFFcEMsU0FBTyxFQUFFLElBQUksTUFBTSxZQUFZLFNBQVMsR0FBRyxHQUFHLFFBQVEsU0FBUztBQUNqRTtBQUVBLFNBQVMsa0JBQ1AsS0FDQSxTQUNBLFVBQ0EsU0FDeUI7QUFDekIsUUFBTSxXQUFXLHFCQUFxQixLQUFLLFNBQVMsUUFBUTtBQUU1RCxTQUFPO0FBQUEsSUFDTCxRQUFRLFFBQVE7QUFBQSxJQUNoQixlQUFlO0FBQUEsTUFDYixZQUFZO0FBQUEsTUFDWixjQUFjO0FBQUEsTUFDZCxjQUFjO0FBQUEsTUFDZCxZQUFZLElBQUk7QUFBQSxNQUNoQixlQUFlO0FBQUEsTUFDZixXQUFXLHNCQUFzQixJQUFJLFNBQXlCO0FBQUEsTUFDOUQsbUJBQW1CO0FBQUEsTUFDbkIsY0FBYztBQUFBLE1BQ2QsTUFBTSxJQUFJO0FBQUEsTUFDVixXQUFXO0FBQUEsTUFDWCxxQkFBcUIsSUFBSSxhQUFhLFFBQVEsUUFBUSxJQUFJLGFBQWEsUUFBUSxVQUFVLElBQUksYUFBYSxPQUFPLFFBQVE7QUFBQSxJQUMzSDtBQUFBO0FBQUEsSUFFQSxZQUFZO0FBQUEsTUFDVixvQkFBb0I7QUFBQSxRQUNsQixRQUFRO0FBQUEsUUFDUixxQkFBcUI7QUFBQSxRQUNyQixZQUFZO0FBQUEsVUFDVixzQkFBc0I7QUFBQSxZQUNwQixRQUFRO0FBQUEsWUFDUixxQkFBcUI7QUFBQSxZQUNyQixlQUFlLEVBQUUsU0FBUyxTQUFTLE1BQU0sSUFBSSxLQUFLO0FBQUEsVUFDcEQ7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBO0FBQUEsTUFFQSx5QkFBeUIsU0FBUyxJQUFJLFFBQU0sRUFBRSxxQkFBcUIsZ0JBQWdCLEdBQUcsRUFBNkIsRUFBRTtBQUFBLElBQ3ZIO0FBQUEsRUFDRjtBQUNGO0FBRUEsU0FBUyxzQkFBc0IsTUFBNkM7QUFFMUUsUUFBTSxXQUF5QztBQUFBLElBQzdDLE9BQU8sQ0FBQztBQUFBLElBQUcsUUFBUSxDQUFDO0FBQUEsSUFBRyxPQUFPLENBQUM7QUFBQSxJQUFHLFFBQVEsQ0FBQztBQUFBLElBQUcsTUFBTSxDQUFDO0FBQUEsSUFBRyxVQUFVLENBQUM7QUFBQSxJQUFHLFFBQVEsQ0FBQztBQUFBLEVBQ2pGO0FBRUEsYUFBVyxPQUFPLE1BQU07QUFDdEIsVUFBTSxNQUFNLElBQUksV0FBVztBQUMzQixRQUFJLENBQUMsU0FBUyxHQUFHLEVBQUcsVUFBUyxHQUFHLElBQUksQ0FBQztBQUNyQyxhQUFTLEdBQUcsRUFBRSxLQUFLLEdBQUc7QUFBQSxFQUN4QjtBQUVBLFFBQU0saUJBQWlCLE9BQU8sUUFBUSxRQUFRLEVBQzNDLE9BQU8sQ0FBQyxDQUFDLEdBQUdDLEtBQUksTUFBTUEsTUFBSyxTQUFTLENBQUMsRUFDckMsSUFBSSxDQUFDLENBQUMsTUFBTUEsS0FBSSxPQUFPO0FBQUEsSUFDdEIsVUFBVTtBQUFBLElBQ1YsUUFBUUEsTUFBSyxJQUFJLE9BQUssbUJBQW1CLENBQUMsQ0FBQztBQUFBLEVBQzdDLEVBQUU7QUFHSixNQUFJLGVBQWUsV0FBVyxHQUFHO0FBQy9CLG1CQUFlLEtBQUssRUFBRSxVQUFVLFVBQVUsUUFBUSxDQUFDLEVBQUUsQ0FBQztBQUFBLEVBQ3hEO0FBR0EsU0FBTyxFQUFFLFVBQVUsRUFBRSxXQUFXLDhEQUE4RCxTQUFTLGVBQWUsRUFBRTtBQUMxSDtBQUVBLFNBQVMsbUJBQW1CLEtBQTZDO0FBQ3ZFLFNBQU87QUFBQSxJQUNMLFVBQVUsSUFBSTtBQUFBLElBQ2QsY0FBYyxpQkFBaUIsSUFBSSxRQUFRO0FBQUEsSUFDM0MsbUJBQW1CO0FBQUEsSUFDbkIsWUFBWSxJQUFJLGdCQUFnQjtBQUFBO0FBQUEsSUFFaEMsU0FBUyxJQUFJLGNBQWM7QUFBQSxNQUN6QixpQkFBaUI7QUFBQSxNQUNqQixtQkFBbUIsRUFBRSxVQUFVLFNBQVMsU0FBUyxJQUFJLFlBQVk7QUFBQSxJQUNuRSxJQUFJO0FBQUEsRUFDTjtBQUNGO0FBRUEsU0FBUyxxQkFDUCxLQUNBLFNBQ0EsVUFDMkI7QUFDM0IsTUFBSSxJQUFJLGFBQWEsUUFBUSxJQUFJLGVBQWU7QUFDOUMsV0FBTyxJQUFJLGNBQWMsTUFBTSxJQUFJLFVBQVEsdUJBQXVCLE1BQU0sT0FBTyxDQUFDO0FBQUEsRUFDbEY7QUFDQSxNQUFJLElBQUksYUFBYSxTQUFTLElBQUksWUFBWTtBQUM1QyxXQUFPLENBQUMsdUJBQXVCLElBQUksWUFBWSxPQUFPLENBQUM7QUFBQSxFQUN6RDtBQUNBLE1BQUksSUFBSSxhQUFhLFNBQVMsSUFBSSxZQUFZO0FBQzVDLFdBQU8sMEJBQTBCLElBQUksWUFBWSxPQUFPO0FBQUEsRUFDMUQ7QUFDQSxNQUFJLElBQUksYUFBYSxRQUFRLElBQUksVUFBVTtBQUN6QyxXQUFPLENBQUM7QUFBQSxNQUNOLFFBQVEsUUFBUTtBQUFBLE1BQ2hCLGVBQWU7QUFBQSxRQUNiLHFCQUFxQjtBQUFBLFFBQ3JCLGVBQWU7QUFBQSxVQUNiLGdCQUFnQixJQUFJLFlBQVk7QUFBQSxRQUNsQztBQUFBLE1BQ0Y7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBQ0EsV0FBUyxLQUFLLFFBQVEsSUFBSSxJQUFJLGVBQWUsSUFBSSxRQUFRLGlDQUE0QjtBQUNyRixTQUFPLENBQUMsRUFBRSxRQUFRLFFBQVEsR0FBRyxlQUFlLEVBQUUscUJBQXFCLE9BQU8sZUFBZSxDQUFDLEVBQUUsRUFBRSxDQUFDO0FBQ2pHO0FBRUEsU0FBUyx1QkFBdUIsTUFBWSxTQUFnRDtBQU0xRixRQUFNLFdBQXNDLENBQUM7QUFDN0MsUUFBTSxRQUFtQyxDQUFDO0FBQzFDLFFBQU0sUUFBbUMsQ0FBQztBQUMxQyxRQUFNLFFBQW1DLENBQUM7QUFHMUMsUUFBTSxjQUFjLENBQUMsR0FBRyxLQUFLLFFBQVE7QUFDckMsYUFBVyxVQUFVLEtBQUssVUFBVTtBQUNsQyxnQkFBWSxLQUFLLEdBQUcsT0FBTyxRQUFRO0FBQUEsRUFDckM7QUFJQSxRQUFNLG1CQUErQixDQUFDO0FBQ3RDLE1BQUksZUFBZTtBQUVuQixhQUFXLE1BQU0sYUFBYTtBQUM1QixRQUFJLEdBQUcsU0FBUyxXQUFXO0FBQ3pCLFlBQU0sSUFBSTtBQUNWLFlBQU0sVUFBVSxRQUFRO0FBQ3hCLFlBQU0sWUFBWSxRQUFRO0FBQzFCLFVBQUksQ0FBQyxhQUFjLGdCQUFlO0FBR2xDLFVBQUksV0FBVztBQUNmLFVBQUksRUFBRSxTQUFTLFlBQWEsWUFBVztBQUFBLGVBQzlCLEVBQUUsU0FBUyxZQUFhLFlBQVc7QUFHNUMsWUFBTSxXQUFXLEVBQUUsSUFBSSxLQUFLLE1BQU0sR0FBRztBQUNyQyxZQUFNLGtCQUFrQixTQUFTLFdBQVcsSUFDeEMsRUFBRSxXQUFXLEVBQUUsVUFBVSxTQUFTLENBQUMsRUFBRSxFQUFFLElBQ3ZDLEVBQUUsV0FBVyxTQUFTLElBQUksUUFBTSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUU7QUFDdEQsZUFBUyxLQUFLLEVBQUUsV0FBVyxpQkFBaUIsU0FBUyxXQUFXLFFBQVEsZ0JBQWdCLENBQUM7QUFHekYsWUFBTSxVQUFtQyxFQUFFLFVBQVUsVUFBVSxTQUFTLFFBQVE7QUFDaEYsVUFBSSxFQUFFLFNBQVMsS0FBTSxTQUFRLFdBQVcsSUFBSTtBQUM1QyxZQUFNLEtBQUssT0FBTztBQUVsQix1QkFBaUIsS0FBSyxFQUFFLFNBQVMsV0FBVyxTQUFTLENBQUM7QUFBQSxJQUN4RCxXQUFXLEdBQUcsU0FBUyxRQUFRO0FBQzdCLFlBQU0sSUFBSTtBQUNWLFlBQU0sVUFBVSxRQUFRO0FBQ3hCLFlBQU0sWUFBWSxRQUFRO0FBQzFCLFVBQUksQ0FBQyxhQUFjLGdCQUFlO0FBRWxDLFVBQUksV0FBVztBQUNmLFVBQUksRUFBRSxTQUFTLFNBQVMsRUFBRSxTQUFTLFFBQVMsWUFBVztBQUFBLGVBQzlDLEVBQUUsU0FBUyxXQUFXLEVBQUUsU0FBUyxVQUFXLFlBQVc7QUFFaEUsWUFBTSxXQUFXLEVBQUUsSUFBSSxLQUFLLE1BQU0sR0FBRztBQUNyQyxZQUFNLGtCQUFrQixTQUFTLFdBQVcsSUFDeEMsRUFBRSxXQUFXLEVBQUUsVUFBVSxTQUFTLENBQUMsRUFBRSxFQUFFLElBQ3ZDLEVBQUUsV0FBVyxTQUFTLElBQUksUUFBTSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUU7QUFDdEQsZUFBUyxLQUFLLEVBQUUsV0FBVyxpQkFBaUIsU0FBUyxXQUFXLFFBQVEsZ0JBQWdCLENBQUM7QUFFekYsWUFBTSxVQUFtQyxFQUFFLFVBQVUsVUFBVSxTQUFTLFFBQVE7QUFDaEYsVUFBSSxFQUFFLFNBQVMsVUFBVyxTQUFRLFdBQVcsSUFBSTtBQUNqRCxZQUFNLEtBQUssT0FBTztBQUVsQix1QkFBaUIsS0FBSyxFQUFFLFNBQVMsV0FBVyxTQUFTLENBQUM7QUFBQSxJQUN4RCxXQUFXLEdBQUcsU0FBUyxTQUFTO0FBQzlCLFlBQU0sSUFBSTtBQUNWLFlBQU0sVUFBVSxRQUFRO0FBQ3hCLFVBQUksQ0FBQyxhQUFjLGdCQUFlO0FBQ2xDLFlBQU0sYUFBYSxFQUFFLHNCQUFzQixtQkFBbUIsRUFBRSxNQUFNO0FBQ3RFLFlBQU0sY0FBYyxRQUFRO0FBRTVCLFlBQU0sV0FBVyxFQUFFLGFBQWEsTUFBTSxHQUFHO0FBQ3pDLFlBQU0sb0JBQW9CLFNBQVMsV0FBVyxJQUMxQyxFQUFFLFVBQVUsU0FBUyxDQUFDLEVBQUUsSUFDeEIsU0FBUyxJQUFJLFFBQU0sRUFBRSxVQUFVLEVBQUUsRUFBRTtBQUV2QyxZQUFNLFVBQW1DO0FBQUEsUUFDdkMsU0FBUztBQUFBLFFBQ1QsVUFBVTtBQUFBLFVBQ1IsVUFBVTtBQUFBLFVBQ1YsZUFBZ0IsRUFBVSxtQkFBbUI7QUFBQSxVQUM3QyxVQUFVO0FBQUEsWUFDUixXQUFXO0FBQUEsWUFDWCxTQUFTO0FBQUEsWUFDVCxXQUFXO0FBQUEsVUFDYjtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQ0EsWUFBTSxLQUFLLE9BQU87QUFDbEIsdUJBQWlCLEtBQUssRUFBRSxTQUFTLFNBQVMsV0FBVyxJQUFJLFVBQVUsT0FBTyxDQUFDO0FBQUEsSUFDN0U7QUFBQSxFQUNGO0FBSUEsTUFBSSxjQUFjO0FBQ2xCLE1BQUksVUFBVTtBQUNkLFdBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxTQUFTLFFBQVEsS0FBSztBQUM3QyxVQUFNLE9BQU8saUJBQWlCLE9BQU87QUFDckM7QUFDQSxVQUFNLEtBQUssS0FBSyxTQUFTLENBQUM7QUFFMUIsUUFBSSxHQUFHLFNBQVMsU0FBUztBQUV2QixVQUFJLGdCQUFnQixJQUFJO0FBQ3RCLGNBQU0sS0FBSyxFQUFFLFNBQVMsUUFBUSxHQUFHLFdBQVcsQ0FBQyxHQUFHLFNBQVMsRUFBRSxTQUFTLEtBQUssU0FBUyxVQUFVLEtBQUssRUFBRSxDQUFDO0FBQUEsTUFDdEcsT0FBTztBQUNMLGNBQU0sS0FBSyxFQUFFLFNBQVMsUUFBUSxHQUFHLFNBQVMsQ0FBQyxFQUFFLFNBQVMsYUFBYSxVQUFVLE1BQU0sR0FBRyxFQUFFLFNBQVMsS0FBSyxTQUFTLFVBQVUsS0FBSyxDQUFDLEVBQUUsQ0FBQztBQUFBLE1BQ3BJO0FBQ0Esb0JBQWMsS0FBSztBQUFBLElBQ3JCLE9BQU87QUFFTCxVQUFJLGdCQUFnQixJQUFJO0FBQ3RCLGNBQU0sS0FBSyxFQUFFLFNBQVMsUUFBUSxHQUFHLFdBQVcsQ0FBQyxHQUFHLFNBQVMsRUFBRSxTQUFTLEtBQUssU0FBUyxVQUFVLEtBQUssRUFBRSxDQUFDO0FBQUEsTUFDdEcsT0FBTztBQUNMLGNBQU0sS0FBSyxFQUFFLFNBQVMsUUFBUSxHQUFHLFNBQVMsQ0FBQyxFQUFFLFNBQVMsYUFBYSxVQUFVLE1BQU0sR0FBRyxFQUFFLFNBQVMsS0FBSyxTQUFTLFVBQVUsS0FBSyxDQUFDLEVBQUUsQ0FBQztBQUFBLE1BQ3BJO0FBRUEsVUFBSSxLQUFLLFdBQVc7QUFDbEIsY0FBTSxLQUFLLEVBQUUsU0FBUyxRQUFRLEdBQUcsVUFBVSxFQUFFLFNBQVMsS0FBSyxVQUFVLEdBQUcsU0FBUyxFQUFFLFNBQVMsS0FBSyxTQUFTLFVBQVUsVUFBVSxFQUFFLENBQUM7QUFBQSxNQUNuSTtBQUNBLG9CQUFjLEtBQUs7QUFBQSxJQUNyQjtBQUFBLEVBQ0Y7QUFHQSxhQUFXLFVBQVUsS0FBSyxVQUFVO0FBQ2xDLFFBQUksb0JBQW9CO0FBQ3hCLGFBQVMsSUFBSSxHQUFHLElBQUksT0FBTyxTQUFTLFFBQVEsS0FBSztBQUMvQyxZQUFNLE9BQU8saUJBQWlCLE9BQU87QUFDckM7QUFDQSxZQUFNLEtBQUssT0FBTyxTQUFTLENBQUM7QUFFNUIsVUFBSSxHQUFHLFNBQVMsU0FBUztBQUN2QixZQUFJLHNCQUFzQixJQUFJO0FBQzVCLGdCQUFNLEtBQUssRUFBRSxTQUFTLFFBQVEsR0FBRyxXQUFXLENBQUMsR0FBRyxTQUFTLEVBQUUsU0FBUyxLQUFLLFNBQVMsVUFBVSxLQUFLLEVBQUUsQ0FBQztBQUFBLFFBQ3RHLE9BQU87QUFDTCxnQkFBTSxLQUFLLEVBQUUsU0FBUyxRQUFRLEdBQUcsU0FBUyxDQUFDLEVBQUUsU0FBUyxtQkFBbUIsVUFBVSxNQUFNLEdBQUcsRUFBRSxTQUFTLEtBQUssU0FBUyxVQUFVLEtBQUssQ0FBQyxFQUFFLENBQUM7QUFBQSxRQUMxSTtBQUNBLDRCQUFvQixLQUFLO0FBQUEsTUFDM0IsT0FBTztBQUNMLFlBQUksc0JBQXNCLElBQUk7QUFDNUIsZ0JBQU0sS0FBSyxFQUFFLFNBQVMsUUFBUSxHQUFHLFdBQVcsQ0FBQyxHQUFHLFNBQVMsRUFBRSxTQUFTLEtBQUssU0FBUyxVQUFVLEtBQUssRUFBRSxDQUFDO0FBQUEsUUFDdEcsT0FBTztBQUNMLGdCQUFNLEtBQUssRUFBRSxTQUFTLFFBQVEsR0FBRyxTQUFTLENBQUMsRUFBRSxTQUFTLG1CQUFtQixVQUFVLE1BQU0sR0FBRyxFQUFFLFNBQVMsS0FBSyxTQUFTLFVBQVUsS0FBSyxDQUFDLEVBQUUsQ0FBQztBQUFBLFFBQzFJO0FBQ0EsWUFBSSxLQUFLLFdBQVc7QUFDbEIsZ0JBQU0sS0FBSyxFQUFFLFNBQVMsUUFBUSxHQUFHLFVBQVUsRUFBRSxTQUFTLEtBQUssVUFBVSxHQUFHLFNBQVMsRUFBRSxTQUFTLEtBQUssU0FBUyxVQUFVLFVBQVUsRUFBRSxDQUFDO0FBQUEsUUFDbkk7QUFDQSw0QkFBb0IsS0FBSztBQUFBLE1BQzNCO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFHQSxRQUFNLFdBQW9DLENBQUM7QUFDM0MsTUFBSSxTQUFTLE9BQVEsVUFBUyxTQUFTO0FBQ3ZDLE1BQUksTUFBTSxPQUFRLFVBQVMsT0FBTztBQUNsQyxNQUFJLE1BQU0sT0FBUSxVQUFTLE9BQU87QUFHbEMsUUFBTSxrQkFBMkMsQ0FBQztBQUNsRCxNQUFJLEtBQUssU0FBUztBQUNoQixvQkFBZ0Isa0JBQWtCLElBQUk7QUFBQSxNQUNwQztBQUFBLFFBQ0UsUUFBUSxRQUFRO0FBQUEsUUFDaEIscUJBQXFCO0FBQUEsUUFDckIsWUFBWTtBQUFBLFVBQ1Ysc0JBQXNCO0FBQUEsWUFDcEIsUUFBUSxRQUFRO0FBQUEsWUFDaEIscUJBQXFCO0FBQUEsWUFDckIsZUFBZSxFQUFFLFNBQVMsU0FBUyxNQUFNLEtBQUssUUFBUTtBQUFBLFVBQ3hEO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRSxRQUFRLFFBQVE7QUFBQSxRQUNoQixxQkFBcUI7QUFBQSxRQUNyQixZQUFZO0FBQUEsVUFDVixzQkFBc0I7QUFBQSxZQUNwQixRQUFRLFFBQVE7QUFBQSxZQUNoQixxQkFBcUI7QUFBQSxZQUNyQixlQUFlLEVBQUUsU0FBUyxTQUFTLE1BQU0sR0FBRztBQUFBLFVBQzlDO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUVBLFNBQU87QUFBQSxJQUNMLFFBQVEsUUFBUTtBQUFBLElBQ2hCLHFCQUFxQjtBQUFBLElBQ3JCLGVBQWU7QUFBQSxNQUNiLGVBQWU7QUFBQSxRQUNiLFFBQVE7QUFBQSxVQUNOLFdBQVc7QUFBQSxVQUNYLE9BQU87QUFBQSxVQUNQLE9BQU8sRUFBRSxNQUFNLE1BQU07QUFBQSxRQUN2QjtBQUFBLE1BQ0Y7QUFBQSxNQUNBLHFCQUFxQjtBQUFBLElBQ3ZCO0FBQUEsSUFDQSxZQUFZLE9BQU8sS0FBSyxlQUFlLEVBQUUsU0FBUyxJQUFJLGtCQUFrQjtBQUFBLE1BQ3RFLGtCQUFrQjtBQUFBLFFBQ2hCO0FBQUEsVUFDRSxRQUFRLFFBQVE7QUFBQSxVQUNoQixxQkFBcUI7QUFBQSxVQUNyQixZQUFZLEVBQUUsc0JBQXNCLEVBQUUsUUFBUSxRQUFRLEdBQUcscUJBQXFCLFNBQVMsZUFBZSxFQUFFLFNBQVMsU0FBUyxNQUFNLEdBQUcsRUFBRSxFQUFFO0FBQUEsUUFDekk7QUFBQSxRQUNBO0FBQUEsVUFDRSxRQUFRLFFBQVE7QUFBQSxVQUNoQixxQkFBcUI7QUFBQSxVQUNyQixZQUFZLEVBQUUsc0JBQXNCLEVBQUUsUUFBUSxRQUFRLEdBQUcscUJBQXFCLFNBQVMsZUFBZSxFQUFFLFNBQVMsU0FBUyxNQUFNLEdBQUcsRUFBRSxFQUFFO0FBQUEsUUFDekk7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRjtBQUVBLFNBQVMsdUJBQXVCLEtBQWlCLFNBQWdEO0FBQy9GLFFBQU0sUUFBbUMsQ0FBQztBQUMxQyxRQUFNLFdBQXNDLENBQUM7QUFDN0MsUUFBTSxRQUFtQyxDQUFDO0FBRzFDLGFBQVcsUUFBUSxJQUFJLE9BQU87QUFDNUIsVUFBTSxNQUFNLEtBQUssR0FBRyxRQUFRLFFBQVEsRUFBRSxLQUFLLFFBQVE7QUFDbkQsUUFBSSxLQUFLLFNBQVMsaUJBQWlCLEtBQUssU0FBUyxnQkFBZ0I7QUFFL0QsWUFBTSxZQUFZLEtBQUssS0FBSyxRQUFRLElBQUksTUFBTSxHQUFHO0FBQ2pELFlBQU0sa0JBQWtCLFNBQVMsV0FBVyxJQUN4QyxFQUFFLFdBQVcsRUFBRSxVQUFVLFNBQVMsQ0FBQyxFQUFFLEVBQUUsSUFDdkMsRUFBRSxXQUFXLFNBQVMsSUFBSSxRQUFNLEVBQUUsVUFBVSxFQUFFLEVBQUUsRUFBRTtBQUN0RCxlQUFTLEtBQUs7QUFBQSxRQUNaLFNBQVM7QUFBQSxRQUNULFdBQVc7QUFBQSxRQUNYLFFBQVE7QUFBQSxNQUNWLENBQUM7QUFBQSxJQUNILE9BQU87QUFJTCxZQUFNLGlCQUEyQyxDQUFDO0FBQ2xELGlCQUFXLE9BQVEsS0FBSyxVQUFVLENBQUMsR0FBSTtBQUNyQyxZQUFJLElBQUksWUFBWSxJQUFJLGFBQWEsVUFBVyxJQUFJLGFBQXdCLE9BQU87QUFDakYsZ0JBQU0sY0FBYyxpQkFBaUIsSUFBSSxRQUFxRCxLQUFLLElBQUk7QUFDdkcseUJBQWUsS0FBSyxFQUFFLFVBQVUsUUFBUSxVQUFVLFlBQVksQ0FBQztBQUMvRDtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQ0EsWUFBTSxnQkFBZ0IsS0FBSyxzQkFBc0IsbUJBQW1CLEtBQUssSUFBYztBQUN2RixZQUFNLEtBQUs7QUFBQSxRQUNULFVBQVU7QUFBQSxRQUNWLFNBQVM7QUFBQSxRQUNULEdBQUksZUFBZSxTQUFTLElBQUksRUFBRSxlQUFlLGVBQWUsSUFBSSxDQUFDO0FBQUEsTUFDdkUsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBR0EsYUFBVyxRQUFRLElBQUksT0FBTztBQUM1QixVQUFNLEtBQUs7QUFBQSxNQUNULFNBQVMsUUFBUTtBQUFBLE1BQ2pCLFNBQVM7QUFBQSxRQUNQLEVBQUUsU0FBUyxLQUFLLEtBQUssT0FBTyxRQUFRLFFBQVEsRUFBRSxHQUFHLFVBQVUsS0FBSyxLQUFLLElBQUk7QUFBQSxRQUN6RSxFQUFFLFNBQVMsS0FBSyxHQUFHLE9BQU8sUUFBUSxRQUFRLEVBQUUsR0FBRyxVQUFVLEtBQUssR0FBRyxJQUFJO0FBQUEsTUFDdkU7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBRUEsUUFBTSxXQUFvQyxDQUFDO0FBQzNDLE1BQUksTUFBTSxPQUFRLFVBQVMsT0FBTztBQUNsQyxNQUFJLFNBQVMsT0FBUSxVQUFTLFNBQVM7QUFFdkMsU0FBTztBQUFBLElBQ0wsUUFBUSxRQUFRO0FBQUEsSUFDaEIsZUFBZTtBQUFBLE1BQ2IscUJBQXFCO0FBQUEsTUFDckIsZUFBZTtBQUFBLFFBQ2IsUUFBUTtBQUFBLFVBQ04sV0FBVztBQUFBLFVBQ1gsT0FBTztBQUFBLFVBQ1AsT0FBTyxFQUFFLE1BQU0sTUFBTSxTQUFTLFFBQVEsQ0FBQyxFQUFFO0FBQUEsUUFDM0M7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRjtBQUlBLFNBQVMsMEJBQ1AsS0FDQSxTQUMyQjtBQUUzQixNQUFJLFVBQVU7QUFDZCxRQUFNLFdBQVcsQ0FBQyxJQUFZLFdBQTJCO0FBQ3ZELFVBQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxPQUFPLElBQUksTUFBTSxTQUFTLENBQUM7QUFDbEQsV0FBTyxJQUFJLEVBQUUsQ0FBQyxJQUFJLE9BQU8sU0FBUztBQUFBLEVBQ3BDO0FBR0EsUUFBTSxhQUFhLG9CQUFJLElBQW9CO0FBQzNDLGFBQVcsUUFBUSxJQUFJLE9BQU87QUFDNUIsZUFBVyxJQUFJLEtBQUssSUFBSSxTQUFTLEtBQUssSUFBSSxlQUFlLENBQUM7QUFBQSxFQUM1RDtBQUdBLFFBQU0sY0FBYyxvQkFBSSxJQUFvQjtBQUM1QyxhQUFXLFNBQVMsSUFBSSxhQUFhO0FBQ25DLGdCQUFZLElBQUksTUFBTSxJQUFJLFNBQVMsTUFBTSxJQUFJLGdCQUFnQixDQUFDO0FBQUEsRUFDaEU7QUFHQSxRQUFNLGdCQUEyQyxJQUFJLE1BQU0sSUFBSSxVQUFRO0FBQ3JFLFVBQU0sTUFBTSxXQUFXLElBQUksS0FBSyxFQUFFLEtBQUssT0FBTyxTQUFTO0FBRXZELFVBQU0sY0FBYyxLQUFLLFFBQVEsU0FBUyxJQUFJLEtBQUssUUFBUSxDQUFDLEVBQUUsSUFBSSxPQUFPLEtBQUs7QUFFOUUsVUFBTSxXQUFXLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxVQUFVLFVBQVUsU0FBUyxLQUFLLEVBQUUsR0FBRyxPQUFPLEVBQUUsTUFBTSxFQUFFLFNBQVMsTUFBTSxXQUFXLENBQUMsR0FBRyxTQUFTLEVBQUUsU0FBUyxNQUFNLFVBQVUsS0FBSyxFQUFFLEVBQUUsRUFBRTtBQUN6SyxVQUFNLFdBQVcsRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFVBQVUsVUFBVSxTQUFTLEtBQUssRUFBRSxHQUFHLE9BQU8sRUFBRSxNQUFNLEVBQUUsU0FBUyxNQUFNLFdBQVcsQ0FBQyxHQUFHLFNBQVMsRUFBRSxTQUFTLE1BQU0sVUFBVSxLQUFLLEVBQUUsRUFBRSxFQUFFO0FBQ3pLLFdBQU87QUFBQSxNQUNMLFlBQVk7QUFBQSxNQUNaLFVBQVUsT0FBTyxLQUFLLFNBQVM7QUFBQSxNQUMvQixVQUFVLEtBQUs7QUFBQSxNQUNmLHFCQUFxQjtBQUFBLE1BQ3JCLGlCQUFpQjtBQUFBLE1BQ2pCLFNBQVMsRUFBRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsVUFBVSxTQUFTLFNBQVMsWUFBWSxFQUFFLEVBQUU7QUFBQSxNQUNyRixjQUFjLEVBQUUsYUFBYSxFQUFFLHlCQUF5QixPQUFPLFFBQVEsU0FBUyxFQUFFO0FBQUEsTUFDbEYsWUFBWSxFQUFFLFdBQVcsRUFBRSx5QkFBeUIsT0FBTyxRQUFRLFNBQVMsRUFBRTtBQUFBLElBQ2hGO0FBQUEsRUFDRixDQUFDO0FBRUQsUUFBTSxzQkFBaUQsSUFBSSxZQUFZLElBQUksV0FBUztBQUNsRixVQUFNLE1BQU0sWUFBWSxJQUFJLE1BQU0sRUFBRSxLQUFLLE9BQU8sU0FBUztBQUd6RCxVQUFNLFNBQWtDO0FBQUEsTUFDdEMsT0FBTyxFQUFFLE1BQU0sRUFBRSxVQUFVLFVBQVUsU0FBUyxLQUFLLEVBQUU7QUFBQSxNQUNyRCxPQUFPLEVBQUUsTUFBTSxFQUFFLFNBQVMsTUFBTSxXQUFXLENBQUMsR0FBRyxTQUFTLEVBQUUsU0FBUyxNQUFNLFVBQVUsS0FBSyxFQUFFLEVBQUU7QUFBQSxJQUM5RjtBQUNBLFdBQU87QUFBQSxNQUNMLGVBQWU7QUFBQSxNQUNmLFVBQVUsTUFBTTtBQUFBLE1BQ2hCLFlBQVk7QUFBQSxNQUNaLHlCQUF5QjtBQUFBLE1BQ3pCLFFBQVE7QUFBQSxJQUNWO0FBQUEsRUFDRixDQUFDO0FBR0QsUUFBTSxtQkFBOEMsQ0FBQztBQUVyRCxRQUFNLGVBQWUsSUFBSSxJQUFJLElBQUksTUFBTSxRQUFRLE9BQUssQ0FBQyxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRSxPQUFPLFFBQU0sR0FBRyxXQUFXLGlCQUFpQixDQUFDLENBQUM7QUFDbEgsUUFBTSxvQkFBb0Isb0JBQUksSUFBWTtBQUMxQyxNQUFJLGdCQUFnQjtBQUNwQixRQUFNLGtCQUFrQixvQkFBSSxJQUFvQjtBQUVoRCxhQUFXLFNBQVMsY0FBYztBQUNoQyxVQUFNLGNBQWMsTUFBTSxRQUFRLG1CQUFtQixFQUFFO0FBQ3ZELFFBQUksQ0FBQyxnQkFBZ0IsSUFBSSxLQUFLLEdBQUc7QUFDL0Isc0JBQWdCLElBQUksT0FBTyxRQUFRLEtBQUssV0FBVyxJQUFJLGNBQWMsT0FBTyxlQUFlLENBQUM7QUFBQSxJQUM5RjtBQUFBLEVBQ0Y7QUFHQSxRQUFNLHFCQUFxQixvQkFBSSxJQUFZO0FBQzNDLGFBQVcsVUFBVyxJQUFJLFlBQVksQ0FBQyxHQUFJO0FBQ3pDLFVBQU0saUJBQWlCLE9BQU8sU0FBUztBQUN2QyxVQUFNLFlBQVksaUJBQWlCLGFBQWE7QUFDaEQsVUFBTSxVQUFZLGlCQUFpQixXQUFhO0FBQ2hELFVBQU0sY0FBYyxPQUFPLGNBQWM7QUFDekMsVUFBTSxXQUFXLE9BQU8sZUFBZTtBQUN2QyxVQUFNLFNBQVcsT0FBTyxlQUFlO0FBQ3ZDLFFBQUksQ0FBQyxtQkFBbUIsSUFBSSxPQUFPLEVBQUUsR0FBRztBQUN0Qyx5QkFBbUIsSUFBSSxPQUFPLEVBQUU7QUFDaEMsdUJBQWlCLEtBQUssRUFBRSxZQUFZLFVBQVUsVUFBVSxXQUFXLGlCQUFpQixPQUFPLFdBQVcsRUFBRSxDQUFDO0FBQ3pHLHVCQUFpQixLQUFLLEVBQUUsWUFBWSxRQUFVLFVBQVUsU0FBVyxpQkFBaUIsT0FBTyxXQUFXLEVBQUUsQ0FBQztBQUFBLElBQzNHO0FBQUEsRUFDRjtBQUdBLFFBQU0sc0JBQWlELENBQUM7QUFFeEQsUUFBTSxlQUFlLENBQUMsT0FBd0M7QUFDNUQsUUFBSSxHQUFHLFdBQVcsZUFBZSxFQUFHLFFBQU8sRUFBRSxTQUFTLEVBQUUsWUFBWSxXQUFXLElBQUksRUFBRSxLQUFLLEdBQUcsUUFBUSxpQkFBaUIsRUFBRSxFQUFFLEVBQUU7QUFDNUgsUUFBSSxHQUFHLFdBQVcsZ0JBQWdCLEVBQUcsUUFBTyxFQUFFLGVBQWUsRUFBRSxZQUFZLFlBQVksSUFBSSxFQUFFLEtBQUssR0FBRyxRQUFRLGtCQUFrQixFQUFFLEVBQUUsRUFBRTtBQUNySSxRQUFJLEdBQUcsV0FBVyxpQkFBaUIsRUFBRyxRQUFPLEVBQUUsV0FBVyxFQUFFLFlBQVksZ0JBQWdCLElBQUksRUFBRSxLQUFLLEdBQUcsUUFBUSxtQkFBbUIsRUFBRSxHQUFHLFNBQVMsSUFBSSxFQUFFO0FBQ3JKLFdBQU8sRUFBRSxTQUFTLEVBQUUsWUFBWSxHQUFHLEVBQUU7QUFBQSxFQUN2QztBQUNBLFFBQU0sYUFBYSxDQUFDLE9BQXdDO0FBQzFELFFBQUksR0FBRyxXQUFXLGVBQWUsRUFBRyxRQUFPLEVBQUUsU0FBUyxFQUFFLFlBQVksV0FBVyxJQUFJLEVBQUUsS0FBSyxHQUFHLFFBQVEsaUJBQWlCLEVBQUUsRUFBRSxFQUFFO0FBQzVILFFBQUksR0FBRyxXQUFXLGdCQUFnQixFQUFHLFFBQU8sRUFBRSxlQUFlLEVBQUUsWUFBWSxZQUFZLElBQUksRUFBRSxLQUFLLEdBQUcsUUFBUSxrQkFBa0IsRUFBRSxFQUFFLEVBQUU7QUFDckksUUFBSSxHQUFHLFdBQVcsaUJBQWlCLEVBQUcsUUFBTyxFQUFFLFdBQVcsRUFBRSxZQUFZLGdCQUFnQixJQUFJLEVBQUUsS0FBSyxHQUFHLFFBQVEsbUJBQW1CLEVBQUUsR0FBRyxRQUFRLElBQUksRUFBRTtBQUNwSixRQUFJLEdBQUcsV0FBVyxlQUFlLEdBQUc7QUFDbEMsWUFBTSxPQUFPLElBQUksT0FBTyxLQUFLLE9BQUssRUFBRSxPQUFPLEVBQUU7QUFDN0MsWUFBTSxZQUFZLFdBQVcsSUFBSSxnQkFBZ0IsTUFBTSxjQUFjLEVBQUUsS0FBSztBQUM1RSxhQUFPLEVBQUUsU0FBUyxFQUFFLFlBQVksVUFBVSxFQUFFO0FBQUEsSUFDOUM7QUFDQSxXQUFPLEVBQUUsU0FBUyxFQUFFLFlBQVksR0FBRyxFQUFFO0FBQUEsRUFDdkM7QUFFQSxhQUFXLFFBQVEsSUFBSSxPQUFPO0FBQzVCLFVBQU0sYUFBYSxLQUFLLEdBQUcsV0FBVyxlQUFlO0FBQ3JELHdCQUFvQixLQUFLO0FBQUEsTUFDdkIsVUFBVSxhQUFhLEtBQUssSUFBSTtBQUFBLE1BQ2hDLFFBQVUsV0FBVyxLQUFLLEVBQUU7QUFBQSxNQUM1QixVQUFVLGFBQWEsU0FBUztBQUFBLElBQ2xDLENBQUM7QUFBQSxFQUNIO0FBRUEsUUFBTSxXQUFvQyxDQUFDO0FBQzNDLE1BQUksY0FBYyxPQUFjLFVBQVMsUUFBYyxFQUFFLE1BQU0sY0FBYztBQUM3RSxNQUFJLG9CQUFvQixPQUFRLFVBQVMsY0FBYyxFQUFFLFlBQVksb0JBQW9CO0FBQ3pGLE1BQUksaUJBQWlCLE9BQVcsVUFBUyxXQUFjLEVBQUUsUUFBUSxpQkFBaUI7QUFDbEYsTUFBSSxvQkFBb0IsT0FBUSxVQUFTLGNBQWMsRUFBRSxZQUFZLG9CQUFvQjtBQUd6RixRQUFNLFFBQWlDO0FBQUEsSUFDckMsV0FBVztBQUFBLElBQ1gsZUFBZSxFQUFFLG9CQUFvQixFQUFFLHlCQUF5QixNQUFNLEVBQUU7QUFBQSxJQUN4RSxVQUFVO0FBQUEsSUFDVixnQkFBZ0IsRUFBRSxvQkFBb0IsRUFBRSx5QkFBeUIsTUFBTSxFQUFFO0FBQUEsRUFDM0U7QUFFQSxTQUFPLENBQUM7QUFBQSxJQUNOLFFBQVEsUUFBUTtBQUFBLElBQ2hCLGVBQWU7QUFBQSxNQUNiLHFCQUFxQjtBQUFBLE1BQ3JCLGVBQWUsRUFBRSxPQUFPLE1BQU07QUFBQSxJQUNoQztBQUFBLEVBQ0YsQ0FBQztBQUNIOyIsCiAgIm5hbWVzIjogWyJyZXNvbHZlUGFydFRhZyIsICJpc1BhcnROZWdhdGVkIiwgIndhbGtDaGFpbiIsICJ0YWdzIl0KfQo=
