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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjMi9wbGMtZWRpdG9yLXRzeC92ZW5kb3IvYWRhcHRlcnMvc2llbWVuc0FkYXB0ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qXG4gKiBTaWVtZW5zIFNpbWF0aWNNTCBBZGFwdGVyIChUSUEgUG9ydGFsIGV4cG9ydCB2aWEgVElBIE9wZW5uZXNzKVxuICogUGFyc2VzIFNXLkJsb2Nrcy5Db21waWxlVW5pdCAvIFNXLkNvZGVCbG9jayBYTUwgZXhwb3J0ZWQgYnkgVElBIFBvcnRhbC5cbiAqXG4gKiBGaXhlcyBhcHBsaWVkOlxuICogLSBMQUQgd2lyZXMgdXNlZCB0byBkZXRlcm1pbmUgY29ubmVjdGl2aXR5IGFuZCBwYXJhbGxlbCBicmFuY2hlc1xuICogLSBTZXQvUmVzZXQgY29pbHMgcHJvcGVybHkgZGV0ZWN0ZWQgKDxTZXRDb2lsPi88UmVzZXRDb2lsPilcbiAqIC0gU0NMIHNvdXJjZSB0ZXh0IHByb3Blcmx5IGV4dHJhY3RlZFxuICogLSBHUkFQSCAoU0ZDKSBsYW5ndWFnZSBoYW5kbGVkXG4gKiAtIENyb3NzLURCIHJlZmVyZW5jZXMgKGRvdC1wYXRoKSByZXNvbHZlZCBjb3JyZWN0bHlcbiAqIC0gSW5zdGFuY2UgREJzIChTVy5CbG9ja3MuREIgLyBTVy5CbG9ja3MuSW5zdGFuY2VEQikgaW1wb3J0ZWRcbiAqIC0gSW50ZXJmYWNlIHNlY3Rpb24gdHlwZSBwcmVzZXJ2ZWQgb24gdGFncyBmb3IgY29ycmVjdCByZS1leHBvcnRcbiAqL1xuXG5pbXBvcnQgeyBwYXJzZVhNTCwgYnVpbGRYTUwsIGF0dHIsIHRleHQsIGNoaWxkLCBjaGlsZEFycmF5IH0gZnJvbSAnLi4veG1sVXRpbHMuanMnO1xuaW1wb3J0IHsgc2llbWVuc1R5cGVUb0lFQywgaWVjVHlwZVRvU2ltYXRpYyB9IGZyb20gJy4uL2RhdGFUeXBlTWFwLmpzJztcbmltcG9ydCB7IGJ1aWxkUmVzb2x2ZXIsIFZhcmlhYmxlVHlwZVJlc29sdmVyIH0gZnJvbSAnLi4vdmFyaWFibGVUeXBlUmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgZ2V0UGluRGF0YVR5cGUsIGJ1aWxkVHlwZWRQaW5zIH0gZnJvbSAnLi4vcGluU2lnbmF0dXJlcy5qcyc7XG5pbXBvcnQgdHlwZSB7XG4gIEltcG9ydFJlc3VsdCwgRXhwb3J0UmVzdWx0LCBOb3JtYWxpemVkUHJvamVjdCwgTm9ybWFsaXplZFBPVSwgTm9ybWFsaXplZFRhZyxcbiAgVmVuZG9yTWV0YWRhdGFTaWRlY2FyLCBVbm1hcHBlZEVsZW1lbnQsXG59IGZyb20gJy4uL3R5cGVzLmpzJztcbmltcG9ydCB0eXBlIHtcbiAgTGFkZGVyUHJvZ3JhbSwgRkJEUHJvZ3JhbSwgU0ZDUHJvZ3JhbSwgUnVuZywgTGFkZGVyRWxlbWVudCwgQnJhbmNoLFxuICBDb250YWN0RWxlbWVudCwgQ29pbEVsZW1lbnQsIEJsb2NrRWxlbWVudCwgQ29udGFjdFR5cGUsIENvaWxUeXBlLCBGQlR5cGUsXG4gIEZCRE5vZGUsIEZCRFdpcmUsIFBpbiwgRkJEQmxvY2tUeXBlLFxuICBTRkNTdGVwLCBTRkNUcmFuc2l0aW9uLCBTRkNMaW5rLCBTRkNBY3Rpb24sIEFjdGlvblF1YWxpZmllciwgU0ZDSnVtcCwgU0ZDQnJhbmNoLFxufSBmcm9tICcuLi8uLi9sb2dpY1N0b3JlLmpzJztcblxubGV0IF91aWQgPSAwO1xuZnVuY3Rpb24gZ2VuSWQocHJlZml4OiBzdHJpbmcpOiBzdHJpbmcgeyByZXR1cm4gYCR7cHJlZml4fS0keysrX3VpZH0tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyLCA4KX1gOyB9XG5cbmZ1bmN0aW9uIHVuZXNjYXBlWE1MKHM6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzLnJlcGxhY2UoLyZhbXA7L2csICcmJykucmVwbGFjZSgvJmx0Oy9nLCAnPCcpLnJlcGxhY2UoLyZndDsvZywgJz4nKS5yZXBsYWNlKC8mcXVvdDsvZywgJ1wiJykucmVwbGFjZSgvJmFwb3M7L2csIFwiJ1wiKTtcbn1cblxuLy8gVElBIFBvcnRhbCB1c2VzIG5lc3RlZCBNdWx0aWxpbmd1YWxUZXh0IHN0cnVjdHVyZSBmb3IgY29tbWVudHMvdGl0bGVzLlxuLy8gRXh0cmFjdCB0aGUgRW5nbGlzaCB0ZXh0IChvciBmaXJzdCBhdmFpbGFibGUgdGV4dCkgZnJvbSB0aGUgbmVzdGVkIHN0cnVjdHVyZS5cbmZ1bmN0aW9uIGV4dHJhY3RNdWx0aWxpbmd1YWxUZXh0KGVsOiB1bmtub3duKTogc3RyaW5nIHtcbiAgaWYgKCFlbCkgcmV0dXJuICcnO1xuICAvLyBUcnkgcGxhaW4gdGV4dCBmaXJzdCAoUGxheGlvIHJvdW5kLXRyaXAgZm9ybWF0IGFuZCBzb21lIFRJQSB2ZXJzaW9ucylcbiAgY29uc3QgcGxhaW4gPSB0ZXh0KGVsKTtcbiAgaWYgKHBsYWluICYmIHBsYWluLnRyaW0oKSkgcmV0dXJuIHBsYWluLnRyaW0oKTtcbiAgLy8gVElBIFBvcnRhbCBuZXN0ZWQ6IENvbW1lbnQvTXVsdGlsaW5ndWFsVGV4dC9PYmplY3RMaXN0L011bHRpbGluZ3VhbFRleHRJdGVtL0F0dHJpYnV0ZUxpc3QvVGV4dFxuICBmb3IgKGNvbnN0IG1sRWwgb2YgY2hpbGRBcnJheShlbCwgJ011bHRpbGluZ3VhbFRleHQnKSkge1xuICAgIGZvciAoY29uc3QgaXRlbUVsIG9mIGNoaWxkQXJyYXkoY2hpbGQobWxFbCwgJ09iamVjdExpc3QnKSwgJ011bHRpbGluZ3VhbFRleHRJdGVtJykpIHtcbiAgICAgIGNvbnN0IGN1bHR1cmUgPSB0ZXh0KGNoaWxkKGNoaWxkKGl0ZW1FbCwgJ0F0dHJpYnV0ZUxpc3QnKSwgJ0N1bHR1cmUnKSkgfHwgJyc7XG4gICAgICBjb25zdCB0ID0gdGV4dChjaGlsZChjaGlsZChpdGVtRWwsICdBdHRyaWJ1dGVMaXN0JyksICdUZXh0JykpIHx8ICcnO1xuICAgICAgaWYgKHQgJiYgKGN1bHR1cmUuc3RhcnRzV2l0aCgnZW4nKSB8fCAhY3VsdHVyZSkpIHJldHVybiB0O1xuICAgIH1cbiAgICAvLyBJZiBubyBlbi0gY3VsdHVyZSBmb3VuZCwgcmV0dXJuIGZpcnN0IGF2YWlsYWJsZVxuICAgIGZvciAoY29uc3QgaXRlbUVsIG9mIGNoaWxkQXJyYXkoY2hpbGQobWxFbCwgJ09iamVjdExpc3QnKSwgJ011bHRpbGluZ3VhbFRleHRJdGVtJykpIHtcbiAgICAgIGNvbnN0IHQgPSB0ZXh0KGNoaWxkKGNoaWxkKGl0ZW1FbCwgJ0F0dHJpYnV0ZUxpc3QnKSwgJ1RleHQnKSkgfHwgJyc7XG4gICAgICBpZiAodCkgcmV0dXJuIHQ7XG4gICAgfVxuICB9XG4gIHJldHVybiAnJztcbn1cblxuLy8gRXh0ZW5kZWQgTm9ybWFsaXplZFRhZyB3aXRoIHNlY3Rpb24gaW5mbyBmb3IgbG9zc2xlc3MgcmUtZXhwb3J0XG5pbnRlcmZhY2UgU2llbWVuc1RhZyBleHRlbmRzIE5vcm1hbGl6ZWRUYWcge1xuICBzZWN0aW9uPzogJ0lucHV0JyB8ICdPdXRwdXQnIHwgJ0luT3V0JyB8ICdTdGF0aWMnIHwgJ1RlbXAnIHwgJ0NvbnN0YW50JyB8ICdSZXR1cm4nO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgSW1wb3J0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgZnVuY3Rpb24gaW1wb3J0U2llbWVucyh4bWxDb250ZW50OiBzdHJpbmcsIGZpbGVQYXRoOiBzdHJpbmcpOiBJbXBvcnRSZXN1bHQge1xuICBfdWlkID0gMDtcbiAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdID0gW107XG5cbiAgbGV0IHJvb3Q6IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICB0cnkge1xuICAgIHJvb3QgPSBwYXJzZVhNTCh4bWxDb250ZW50KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3JzOiBbYFhNTCBwYXJzZSBlcnJvcjogJHtlfWBdLCB3YXJuaW5nczogW10gfTtcbiAgfVxuXG4gIGNvbnN0IGRvY3VtZW50ID0gY2hpbGQocm9vdCwgJ0RvY3VtZW50JykgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCB1bmRlZmluZWQ7XG4gIGlmICghZG9jdW1lbnQpIHtcbiAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9yczogWydObyA8RG9jdW1lbnQ+IHJvb3QgZm91bmQgaW4gU2ltYXRpY01MIGZpbGUnXSwgd2FybmluZ3M6IFtdIH07XG4gIH1cblxuICBjb25zdCBkb2NJbmZvID0gY2hpbGQoZG9jdW1lbnQsICdEb2N1bWVudEluZm8nKSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IHVuZGVmaW5lZDtcbiAgY29uc3QgcHJvamVjdE5hbWUgPSB0ZXh0KGNoaWxkKGRvY0luZm8sICdQcm9qZWN0TmFtZScpKSB8fCAnU2llbWVucyBJbXBvcnQnO1xuICAvLyBUSUEgdmVyc2lvbjogcHJlZmVyIERvY3VtZW50SW5mby5UaWFWZXJzaW9uLCBmYWxsIGJhY2sgdG8gRW5naW5lZXJpbmdbdmVyc2lvbl0gYXR0cmlidXRlXG4gIGNvbnN0IHZlcnNpb24gPSB0ZXh0KGNoaWxkKGRvY0luZm8sICdUaWFWZXJzaW9uJykpXG4gICAgfHwgYXR0cihjaGlsZChkb2N1bWVudCwgJ0VuZ2luZWVyaW5nJyksICd2ZXJzaW9uJylcbiAgICB8fCAnMS4wJztcblxuICBjb25zdCBwb3VzOiBOb3JtYWxpemVkUE9VW10gPSBbXTtcbiAgY29uc3QgZ2xvYmFsVGFnczogTm9ybWFsaXplZFRhZ1tdID0gW107XG5cbiAgY29uc3Qgc3dCbG9ja3MgPSBjaGlsZChkb2N1bWVudCwgJ1NXLkJsb2NrcycpID8/IGRvY3VtZW50O1xuXG4gIC8vIFBhcnNlIGNvbXBpbGUgdW5pdHNcbiAgZm9yIChjb25zdCBibG9ja0VsIG9mIGNoaWxkQXJyYXkoc3dCbG9ja3MsICdTVy5CbG9ja3MuQ29tcGlsZVVuaXQnKS5jb25jYXQoY2hpbGRBcnJheShzd0Jsb2NrcywgJ1NXLkNvZGVCbG9jaycpKSkge1xuICAgIGNvbnN0IHBvdSA9IHBhcnNlQ29tcGlsZVVuaXQoYmxvY2tFbCwgdW5tYXBwZWQsIHdhcm5pbmdzKTtcbiAgICBpZiAocG91KSBwb3VzLnB1c2gocG91KTtcbiAgfVxuXG4gIC8vIFRvcC1sZXZlbCBibG9ja3MgKE9CLCBGQiwgRkMpXG4gIGZvciAoY29uc3Qga2V5IG9mIFsnU1cuQmxvY2tzLk9CJywgJ1NXLkJsb2Nrcy5GQicsICdTVy5CbG9ja3MuRkMnXSkge1xuICAgIGZvciAoY29uc3QgYmxvY2tFbCBvZiBjaGlsZEFycmF5KHN3QmxvY2tzLCBrZXkpKSB7XG4gICAgICBjb25zdCBwb3UgPSBwYXJzZVRvcExldmVsQmxvY2soYmxvY2tFbCwga2V5LCB1bm1hcHBlZCwgd2FybmluZ3MpO1xuICAgICAgaWYgKHBvdSkgcG91cy5wdXNoKHBvdSk7XG4gICAgfVxuICB9XG5cbiAgLy8gR2xvYmFsIERCIHRhZ3NcbiAgZm9yIChjb25zdCBkYkVsIG9mIGNoaWxkQXJyYXkoc3dCbG9ja3MsICdTVy5CbG9ja3MuR2xvYmFsREInKSkge1xuICAgIGNvbnN0IGRiTmFtZSA9IHRleHQoY2hpbGQoY2hpbGQoZGJFbCwgJ0F0dHJpYnV0ZUxpc3QnKSwgJ05hbWUnKSkgfHwgJ0dsb2JhbERCJztcbiAgICBjb25zdCBpbnRlcmZhY2VFbCA9IGNoaWxkKGNoaWxkKGRiRWwsICdBdHRyaWJ1dGVMaXN0JyksICdJbnRlcmZhY2UnKTtcbiAgICBpZiAoaW50ZXJmYWNlRWwpIHtcbiAgICAgIGNvbnN0IHNlY3Rpb25UYWdzID0gcGFyc2VTaWVtZW5zSW50ZXJmYWNlKGludGVyZmFjZUVsLCB1bm1hcHBlZCk7XG4gICAgICBnbG9iYWxUYWdzLnB1c2goLi4uc2VjdGlvblRhZ3MubWFwKHQgPT4gKHsgLi4udCwgYWRkcmVzczogYCR7ZGJOYW1lfS4ke3QubmFtZX1gIH0pKSk7XG4gICAgfVxuICB9XG5cbiAgLy8gSW5zdGFuY2UgREJzXG4gIGZvciAoY29uc3QgZGJFbCBvZiBjaGlsZEFycmF5KHN3QmxvY2tzLCAnU1cuQmxvY2tzLkRCJykuY29uY2F0KGNoaWxkQXJyYXkoc3dCbG9ja3MsICdTVy5CbG9ja3MuSW5zdGFuY2VEQicpKSkge1xuICAgIGNvbnN0IGRiTmFtZSA9IHRleHQoY2hpbGQoY2hpbGQoZGJFbCwgJ0F0dHJpYnV0ZUxpc3QnKSwgJ05hbWUnKSkgfHwgJ0RCJztcbiAgICBjb25zdCBpbnRlcmZhY2VFbCA9IGNoaWxkKGNoaWxkKGRiRWwsICdBdHRyaWJ1dGVMaXN0JyksICdJbnRlcmZhY2UnKTtcbiAgICBpZiAoaW50ZXJmYWNlRWwpIHtcbiAgICAgIGNvbnN0IHNlY3Rpb25UYWdzID0gcGFyc2VTaWVtZW5zSW50ZXJmYWNlKGludGVyZmFjZUVsLCB1bm1hcHBlZCk7XG4gICAgICBnbG9iYWxUYWdzLnB1c2goLi4uc2VjdGlvblRhZ3MubWFwKHQgPT4gKHsgLi4udCwgYWRkcmVzczogYCR7ZGJOYW1lfS4ke3QubmFtZX1gIH0pKSk7XG4gICAgfVxuICB9XG5cbiAgaWYgKHBvdXMubGVuZ3RoID09PSAwKSB7XG4gICAgZXJyb3JzLnB1c2goJ05vIHByb2dyYW0gYmxvY2tzIChPQi9GQi9GQykgZm91bmQnKTtcbiAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9ycywgd2FybmluZ3MgfTtcbiAgfVxuXG4gIGNvbnN0IHNpZGVjYXI6IFZlbmRvck1ldGFkYXRhU2lkZWNhciA9IHtcbiAgICBzb3VyY2VWZW5kb3I6ICdzaWVtZW5zX3NpbWF0aWNfbWwnLFxuICAgIHNvdXJjZUZpbGVWZXJzaW9uOiB2ZXJzaW9uLFxuICAgIG9yaWdpbmFsRmlsZVBhdGg6IGZpbGVQYXRoLFxuICAgIHVubWFwcGVkRWxlbWVudHM6IHVubWFwcGVkLFxuICAgIG9yZ2FuaXplclRyZWVMYXlvdXQ6IGRvY3VtZW50LFxuICAgIHZlbmRvclNwZWNpZmljR2xvYmFsczogeyB0aWFWZXJzaW9uOiB2ZXJzaW9uLCBwcm9qZWN0TmFtZSB9LFxuICB9O1xuXG4gIHJldHVybiB7IG9rOiB0cnVlLCBwcm9qZWN0OiB7IHByb2plY3ROYW1lLCBwb3VzLCBnbG9iYWxUYWdzLCBzaWRlY2FyIH0sIGVycm9ycywgd2FybmluZ3MgfTtcbn1cblxuZnVuY3Rpb24gcGFyc2VUb3BMZXZlbEJsb2NrKFxuICBibG9ja0VsOiB1bmtub3duLFxuICBibG9ja1R5cGU6IHN0cmluZyxcbiAgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdLFxuICB3YXJuaW5nczogc3RyaW5nW11cbik6IE5vcm1hbGl6ZWRQT1UgfCBudWxsIHtcbiAgaWYgKCFibG9ja0VsIHx8IHR5cGVvZiBibG9ja0VsICE9PSAnb2JqZWN0JykgcmV0dXJuIG51bGw7XG4gIGNvbnN0IGF0dHJMaXN0ID0gY2hpbGQoYmxvY2tFbCwgJ0F0dHJpYnV0ZUxpc3QnKSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IHVuZGVmaW5lZDtcbiAgY29uc3QgYmxvY2tOYW1lID0gdGV4dChjaGlsZChhdHRyTGlzdCwgJ05hbWUnKSkgfHwgJ0Jsb2NrJztcbiAgY29uc3QgbGFuZ3VhZ2UgPSAodGV4dChjaGlsZChhdHRyTGlzdCwgJ1Byb2dyYW1taW5nTGFuZ3VhZ2UnKSkgfHwgJ0xBRCcpLnRvVXBwZXJDYXNlKCk7XG5cbiAgY29uc3QgbG9jYWxUYWdzOiBTaWVtZW5zVGFnW10gPSBbXTtcbiAgY29uc3QgaW50ZXJmYWNlRWwgPSBjaGlsZChhdHRyTGlzdCwgJ0ludGVyZmFjZScpO1xuICBpZiAoaW50ZXJmYWNlRWwpIHtcbiAgICBsb2NhbFRhZ3MucHVzaCguLi5wYXJzZVNpZW1lbnNJbnRlcmZhY2UoaW50ZXJmYWNlRWwsIHVubWFwcGVkKSk7XG4gIH1cblxuICBjb25zdCBuZXR3b3JrczogdW5rbm93bltdID0gW107XG4gIGZvciAoY29uc3QgbmV0RWwgb2YgY2hpbGRBcnJheShjaGlsZChibG9ja0VsLCAnT2JqZWN0TGlzdCcpLCAnU1cuQmxvY2tzLkNvbXBpbGVVbml0JykpIHtcbiAgICBuZXR3b3Jrcy5wdXNoKG5ldEVsKTtcbiAgfVxuXG4gIGNvbnN0IHBvdVR5cGUgPSBibG9ja1R5cGUuaW5jbHVkZXMoJ0ZCJykgPyAnZnVuY3Rpb25CbG9jaycgYXMgY29uc3RcbiAgICA6IGJsb2NrVHlwZS5pbmNsdWRlcygnRkMnKSA/ICdmdW5jdGlvbicgYXMgY29uc3RcbiAgICA6ICdwcm9ncmFtJyBhcyBjb25zdDtcblxuICBjb25zdCByZXNvbHZlciA9IGJ1aWxkUmVzb2x2ZXIobG9jYWxUYWdzIGFzIE5vcm1hbGl6ZWRUYWdbXSwgW10pO1xuXG4gIGlmIChsYW5ndWFnZSA9PT0gJ0xBRCcgfHwgbGFuZ3VhZ2UgPT09ICdMRCcpIHtcbiAgICBjb25zdCBsYWRkZXIgPSBwYXJzZU5ldHdvcmtzVG9MRChuZXR3b3JrcywgYmxvY2tOYW1lLCB1bm1hcHBlZCwgd2FybmluZ3MsIHJlc29sdmVyKTtcbiAgICByZXR1cm4geyBpZDogYHBvdS0ke2Jsb2NrTmFtZX1gLCBuYW1lOiBibG9ja05hbWUsIGxhbmd1YWdlOiAnTEQnLCBsYWRkZXJQcm9ncmFtOiBsYWRkZXIsIGxvY2FsVGFncywgcG91VHlwZSB9O1xuICB9XG4gIGlmIChsYW5ndWFnZSA9PT0gJ0ZCRCcpIHtcbiAgICBjb25zdCBmYmQgPSBwYXJzZU5ldHdvcmtzVG9GQkQobmV0d29ya3MsIGJsb2NrTmFtZSwgdW5tYXBwZWQsIHdhcm5pbmdzLCByZXNvbHZlcik7XG4gICAgcmV0dXJuIHsgaWQ6IGBwb3UtJHtibG9ja05hbWV9YCwgbmFtZTogYmxvY2tOYW1lLCBsYW5ndWFnZTogJ0ZCRCcsIGZiZFByb2dyYW06IGZiZCwgbG9jYWxUYWdzLCBwb3VUeXBlIH07XG4gIH1cbiAgaWYgKGxhbmd1YWdlID09PSAnU0NMJyB8fCBsYW5ndWFnZSA9PT0gJ1NUTCcpIHtcbiAgICBjb25zdCBzY2wgPSBleHRyYWN0U0NMU291cmNlKGJsb2NrRWwsIGF0dHJMaXN0KTtcbiAgICByZXR1cm4geyBpZDogYHBvdS0ke2Jsb2NrTmFtZX1gLCBuYW1lOiBibG9ja05hbWUsIGxhbmd1YWdlOiAnU1QnLCBzdFNvdXJjZTogc2NsLCBsb2NhbFRhZ3MsIHBvdVR5cGUgfTtcbiAgfVxuICBpZiAobGFuZ3VhZ2UgPT09ICdHUkFQSCcpIHtcbiAgICBjb25zdCBzZmMgPSBwYXJzZU5ldHdvcmtzVG9TRkMobmV0d29ya3MsIGJsb2NrTmFtZSwgdW5tYXBwZWQsIHdhcm5pbmdzKTtcbiAgICByZXR1cm4geyBpZDogYHBvdS0ke2Jsb2NrTmFtZX1gLCBuYW1lOiBibG9ja05hbWUsIGxhbmd1YWdlOiAnU0ZDJywgc2ZjUHJvZ3JhbTogc2ZjLCBsb2NhbFRhZ3MsIHBvdVR5cGUgfTtcbiAgfVxuXG4gIHVubWFwcGVkLnB1c2goeyBjbG1Ob2RlSWQ6IG51bGwsIHZlbmRvclNwZWNpZmljRGF0YTogYmxvY2tFbCwgcmVhc29uOiBgQmxvY2sgXCIke2Jsb2NrTmFtZX1cIjogdW5zdXBwb3J0ZWQgbGFuZ3VhZ2UgJHtsYW5ndWFnZX1gIH0pO1xuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdFNDTFNvdXJjZShibG9ja0VsOiB1bmtub3duLCBhdHRyTGlzdDogdW5rbm93bik6IHN0cmluZyB7XG4gIC8vIFRyeSBtdWx0aXBsZSBsb2NhdGlvbnMgd2hlcmUgU0NMIHNvdXJjZSBpcyBzdG9yZWQgaW4gVElBIGV4cG9ydHNcbiAgY29uc3Qgc2NsU291cmNlID0gdGV4dChjaGlsZChhdHRyTGlzdCwgJ1NDTFNvdXJjZUluZm9ybWF0aW9uJykpO1xuICBpZiAoc2NsU291cmNlICYmIHNjbFNvdXJjZS50cmltKCkgIT09ICcoKiBTQ0wgKiknKSByZXR1cm4gdW5lc2NhcGVYTUwoc2NsU291cmNlKTtcblxuICAvLyBUcnkgU3RydWN0dXJlZFRleHQgZWxlbWVudCBpbnNpZGUgY29tcGlsZSB1bml0c1xuICBjb25zdCBvYmplY3RMaXN0ID0gY2hpbGQoYmxvY2tFbCwgJ09iamVjdExpc3QnKTtcbiAgZm9yIChjb25zdCBjdSBvZiBjaGlsZEFycmF5KG9iamVjdExpc3QsICdTVy5CbG9ja3MuQ29tcGlsZVVuaXQnKSkge1xuICAgIGNvbnN0IGN1QXR0ciA9IGNoaWxkKGN1LCAnQXR0cmlidXRlTGlzdCcpO1xuICAgIGNvbnN0IHNyYyA9IHRleHQoY2hpbGQoY3VBdHRyLCAnTmV0d29ya1NvdXJjZScpKTtcbiAgICBpZiAoc3JjICYmIHNyYy50cmltKCkpIHJldHVybiB1bmVzY2FwZVhNTChzcmMpO1xuICAgIGNvbnN0IHN0RWwgPSBjaGlsZChjdUF0dHIsICdTdHJ1Y3R1cmVkVGV4dCcpO1xuICAgIGlmIChzdEVsKSB7XG4gICAgICBjb25zdCBzdFRleHQgPSB0ZXh0KHN0RWwpO1xuICAgICAgaWYgKHN0VGV4dCAmJiBzdFRleHQudHJpbSgpKSByZXR1cm4gdW5lc2NhcGVYTUwoc3RUZXh0KTtcbiAgICAgIC8vIFRJQSBWMTcrOiBTQ0wgZW5jb2RlZCBhcyBUb2tlbi9CbGFuayBjaGlsZHJlbiBpbnN0ZWFkIG9mIHRleHQgbm9kZVxuICAgICAgY29uc3QgdG9rZW5zID0gY2hpbGRBcnJheShzdEVsLCAnVG9rZW4nKS5jb25jYXQoY2hpbGRBcnJheShzdEVsLCAnQmxhbmsnKSk7XG4gICAgICBpZiAodG9rZW5zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgcmVjb25zdHJ1Y3RlZCA9IHRva2Vucy5tYXAodCA9PiBhdHRyKHQsICdUZXh0JykgPz8gJyAnKS5qb2luKCcnKTtcbiAgICAgICAgaWYgKHJlY29uc3RydWN0ZWQudHJpbSgpKSByZXR1cm4gdW5lc2NhcGVYTUwocmVjb25zdHJ1Y3RlZCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gVHJ5IEV4dGVybmFsU291cmNlXG4gIGZvciAoY29uc3QgZXh0IG9mIGNoaWxkQXJyYXkob2JqZWN0TGlzdCwgJ1NXLkV4dGVybmFsU291cmNlJykpIHtcbiAgICBjb25zdCBzcmMgPSB0ZXh0KGV4dCk7XG4gICAgaWYgKHNyYyAmJiBzcmMudHJpbSgpKSByZXR1cm4gdW5lc2NhcGVYTUwoc3JjKTtcbiAgfVxuXG4gIHJldHVybiAnKCogU0NMIHNvdXJjZSBub3QgZm91bmQgaW4gZXhwb3J0ICopJztcbn1cblxuZnVuY3Rpb24gcGFyc2VDb21waWxlVW5pdChcbiAgY3VFbDogdW5rbm93bixcbiAgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdLFxuICB3YXJuaW5nczogc3RyaW5nW11cbik6IE5vcm1hbGl6ZWRQT1UgfCBudWxsIHtcbiAgaWYgKCFjdUVsIHx8IHR5cGVvZiBjdUVsICE9PSAnb2JqZWN0JykgcmV0dXJuIG51bGw7XG4gIGNvbnN0IGF0dHJMaXN0ID0gY2hpbGQoY3VFbCwgJ0F0dHJpYnV0ZUxpc3QnKSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IHVuZGVmaW5lZDtcbiAgY29uc3QgaWQgPSBhdHRyKGN1RWwsICdJRCcpIHx8IGF0dHIoYXR0ckxpc3QsICdJRCcpIHx8ICdjdSc7XG4gIGNvbnN0IGxhbmd1YWdlID0gKHRleHQoY2hpbGQoYXR0ckxpc3QsICdQcm9ncmFtbWluZ0xhbmd1YWdlJykpIHx8ICdMQUQnKS50b1VwcGVyQ2FzZSgpO1xuICBjb25zdCB0aXRsZSA9IHRleHQoY2hpbGQoY2hpbGQoY3VFbCwgJ09iamVjdExpc3QnKSwgJ011bHRpbGluZ3VhbFRleHQnKSkgfHwgYE5ldHdvcmtfJHtpZH1gO1xuXG4gIGNvbnN0IG5ldHdvcmtzID0gW2N1RWxdO1xuXG4gIGlmIChsYW5ndWFnZSA9PT0gJ0xBRCcgfHwgbGFuZ3VhZ2UgPT09ICdMRCcpIHtcbiAgICBjb25zdCBsYWRkZXIgPSBwYXJzZU5ldHdvcmtzVG9MRChuZXR3b3JrcywgaWQsIHVubWFwcGVkLCB3YXJuaW5ncyk7XG4gICAgcmV0dXJuIHsgaWQ6IGBwb3UtJHtpZH1gLCBuYW1lOiB0aXRsZSwgbGFuZ3VhZ2U6ICdMRCcsIGxhZGRlclByb2dyYW06IGxhZGRlciwgbG9jYWxUYWdzOiBbXSB9O1xuICB9XG4gIGlmIChsYW5ndWFnZSA9PT0gJ0ZCRCcpIHtcbiAgICBjb25zdCBmYmQgPSBwYXJzZU5ldHdvcmtzVG9GQkQobmV0d29ya3MsIGlkLCB1bm1hcHBlZCwgd2FybmluZ3MpO1xuICAgIHJldHVybiB7IGlkOiBgcG91LSR7aWR9YCwgbmFtZTogdGl0bGUsIGxhbmd1YWdlOiAnRkJEJywgZmJkUHJvZ3JhbTogZmJkLCBsb2NhbFRhZ3M6IFtdIH07XG4gIH1cbiAgaWYgKGxhbmd1YWdlID09PSAnR1JBUEgnKSB7XG4gICAgY29uc3Qgc2ZjID0gcGFyc2VOZXR3b3Jrc1RvU0ZDKG5ldHdvcmtzLCBpZCwgdW5tYXBwZWQsIHdhcm5pbmdzKTtcbiAgICByZXR1cm4geyBpZDogYHBvdS0ke2lkfWAsIG5hbWU6IHRpdGxlLCBsYW5ndWFnZTogJ1NGQycsIHNmY1Byb2dyYW06IHNmYywgbG9jYWxUYWdzOiBbXSB9O1xuICB9XG5cbiAgdW5tYXBwZWQucHVzaCh7IGNsbU5vZGVJZDogbnVsbCwgdmVuZG9yU3BlY2lmaWNEYXRhOiBjdUVsLCByZWFzb246IGBDb21waWxlVW5pdCBcIiR7dGl0bGV9XCI6IHVuc3VwcG9ydGVkIGxhbmd1YWdlICR7bGFuZ3VhZ2V9YCB9KTtcbiAgcmV0dXJuIG51bGw7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBTaWVtZW5zIEludGVyZmFjZSBwYXJzZXIgKHdpdGggc2VjdGlvbiBwcmVzZXJ2YXRpb24pIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBwYXJzZVNpZW1lbnNJbnRlcmZhY2UoaW50ZXJmYWNlRWw6IHVua25vd24sIHVubWFwcGVkOiBVbm1hcHBlZEVsZW1lbnRbXSk6IFNpZW1lbnNUYWdbXSB7XG4gIGNvbnN0IHRhZ3M6IFNpZW1lbnNUYWdbXSA9IFtdO1xuICBjb25zdCBzZWN0aW9ucyA9IGNoaWxkKGludGVyZmFjZUVsLCAnU2VjdGlvbnMnKSA/PyBpbnRlcmZhY2VFbDtcblxuICBmdW5jdGlvbiBwYXJzZVNlY3Rpb25zUmVjdXJzaXZlKHNlY3Rpb25zRWw6IHVua25vd24pOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IHNlY3Rpb24gb2YgY2hpbGRBcnJheShzZWN0aW9uc0VsLCAnU2VjdGlvbicpKSB7XG4gICAgICBjb25zdCByYXdTZWN0aW9uTmFtZSA9IGF0dHIoc2VjdGlvbiwgJ05hbWUnKTtcbiAgICAgIGNvbnN0IHNlY3Rpb25OYW1lID0gcmF3U2VjdGlvbk5hbWUgYXMgU2llbWVuc1RhZ1snc2VjdGlvbiddIHx8ICdTdGF0aWMnO1xuICAgICAgLy8gR1JBUEggXCJCYXNlXCIgc2VjdGlvbiBjb250YWlucyBuZXN0ZWQgU2VjdGlvbnMgXHUyMDE0IHJlY3Vyc2VcbiAgICAgIGlmIChyYXdTZWN0aW9uTmFtZSA9PT0gJ0Jhc2UnIHx8IHJhd1NlY3Rpb25OYW1lID09PSAnTm9uZScpIHtcbiAgICAgICAgY29uc3QgbmVzdGVkU2VjdGlvbnMgPSBjaGlsZChzZWN0aW9uLCAnU2VjdGlvbnMnKTtcbiAgICAgICAgaWYgKG5lc3RlZFNlY3Rpb25zKSB7XG4gICAgICAgICAgcGFyc2VTZWN0aW9uc1JlY3Vyc2l2ZShuZXN0ZWRTZWN0aW9ucyk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgbWVtYmVyRWwgb2YgY2hpbGRBcnJheShzZWN0aW9uLCAnTWVtYmVyJykpIHtcbiAgICAgICAgY29uc3QgbmFtZSA9IGF0dHIobWVtYmVyRWwsICdOYW1lJyk7XG4gICAgICAgIGNvbnN0IHR5cGVTdHIgPSBhdHRyKG1lbWJlckVsLCAnRGF0YXR5cGUnKTtcbiAgICAgICAgaWYgKCFuYW1lKSBjb250aW51ZTtcbiAgICAgICAgY29uc3QgZGF0YVR5cGUgPSBzaWVtZW5zVHlwZVRvSUVDKHR5cGVTdHIpO1xuICAgICAgICBjb25zdCBzdGFydFZhbHVlID0gdGV4dChjaGlsZChtZW1iZXJFbCwgJ1N0YXJ0VmFsdWUnKSk7XG4gICAgICAgIC8vIENvbW1lbnQgbWF5IGJlIGEgZGlyZWN0IHRleHQgbm9kZSBvciB3cmFwcGVkIGluIE11bHRpTGFuZ3VhZ2VUZXh0IGNoaWxkcmVuXG4gICAgICAgIGNvbnN0IGNvbW1lbnRFbCA9IGNoaWxkKG1lbWJlckVsLCAnQ29tbWVudCcpO1xuICAgICAgICBjb25zdCBjb21tZW50ID0gdGV4dChjaGlsZChjb21tZW50RWwsICdNdWx0aUxhbmd1YWdlVGV4dCcpKSB8fCB0ZXh0KGNvbW1lbnRFbCkgfHwgJyc7XG4gICAgICAgIHRhZ3MucHVzaCh7XG4gICAgICAgICAgbmFtZSxcbiAgICAgICAgICBkYXRhVHlwZSxcbiAgICAgICAgICBpbml0aWFsVmFsdWU6IHN0YXJ0VmFsdWUgfHwgdW5kZWZpbmVkLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBjb21tZW50IHx8IHVuZGVmaW5lZCxcbiAgICAgICAgICBzZWN0aW9uOiBzZWN0aW9uTmFtZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcGFyc2VTZWN0aW9uc1JlY3Vyc2l2ZShzZWN0aW9ucyk7XG4gIHJldHVybiB0YWdzO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgTEFEIG5ldHdvcmsgXHUyMTkyIExhZGRlciBydW5nICh3aXRoIHdpcmUtYmFzZWQgb3JkZXJpbmcgKyBicmFuY2hlcykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmludGVyZmFjZSBXaXJlQ29ubmVjdGlvbiB7XG4gIGZyb21VSWQ6IHN0cmluZztcbiAgZnJvbVBpbjogc3RyaW5nO1xuICB0b1VJZDogc3RyaW5nO1xuICB0b1Bpbjogc3RyaW5nO1xufVxuXG5mdW5jdGlvbiBwYXJzZU5ldHdvcmtzVG9MRChcbiAgbmV0d29ya3M6IHVua25vd25bXSxcbiAgcG91SWQ6IHN0cmluZyxcbiAgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdLFxuICB3YXJuaW5nczogc3RyaW5nW10sXG4gIHJlc29sdmVyOiBWYXJpYWJsZVR5cGVSZXNvbHZlciA9IG5ldyBWYXJpYWJsZVR5cGVSZXNvbHZlcigpXG4pOiBMYWRkZXJQcm9ncmFtIHtcbiAgY29uc3QgcnVuZ3M6IFJ1bmdbXSA9IFtdO1xuICBsZXQgcnVuZ0lkeCA9IDA7XG5cbiAgZm9yIChjb25zdCBuZXRFbCBvZiBuZXR3b3Jrcykge1xuICAgIHJ1bmdJZHgrKztcbiAgICBjb25zdCBhdHRyTGlzdCA9IGNoaWxkKG5ldEVsLCAnQXR0cmlidXRlTGlzdCcpO1xuICAgIC8vIEZpeCAxMDogbmV0d29yayBjb21tZW50IG1heSBsaXZlIGluIE9iamVjdExpc3QvTXVsdGlsaW5ndWFsVGV4dCBhcyB3ZWxsIGFzIEF0dHJpYnV0ZUxpc3RcbiAgICBjb25zdCBvYmplY3RMaXN0RWwgPSBjaGlsZChuZXRFbCwgJ09iamVjdExpc3QnKTtcbiAgICBjb25zdCBjb21tZW50TWx0ID0gY2hpbGRBcnJheShvYmplY3RMaXN0RWwsICdNdWx0aWxpbmd1YWxUZXh0JykuZmluZChtID0+IGF0dHIobSwgJ0NvbXBvc2l0aW9uTmFtZScpID09PSAnQ29tbWVudCcpO1xuICAgIGNvbnN0IHRpdGxlTWx0ID0gY2hpbGRBcnJheShvYmplY3RMaXN0RWwsICdNdWx0aWxpbmd1YWxUZXh0JykuZmluZChtID0+IGF0dHIobSwgJ0NvbXBvc2l0aW9uTmFtZScpID09PSAnVGl0bGUnKTtcbiAgICBjb25zdCBjb21tZW50RWwgPSBjaGlsZChhdHRyTGlzdCwgJ0NvbW1lbnQnKSA/PyBjaGlsZChhdHRyTGlzdCwgJ1RpdGxlJyk7XG4gICAgY29uc3QgY29tbWVudCA9IGV4dHJhY3RNdWx0aWxpbmd1YWxUZXh0KGNvbW1lbnRNbHQpIHx8IGV4dHJhY3RNdWx0aWxpbmd1YWxUZXh0KHRpdGxlTWx0KSB8fCBleHRyYWN0TXVsdGlsaW5ndWFsVGV4dChjb21tZW50RWwpIHx8ICcnO1xuXG4gICAgY29uc3QgcGFydHNFbCA9IGNoaWxkKGF0dHJMaXN0LCAnTmV0d29ya1NvdXJjZScpO1xuICAgIGNvbnN0IGZsZ05ldCA9IGNoaWxkKHBhcnRzRWwsICdGbGdOZXQnKSA/PyBwYXJ0c0VsO1xuICAgIGNvbnN0IHBhcnRzTm9kZSA9IGNoaWxkKGZsZ05ldCwgJ1BhcnRzJykgPz8gZmxnTmV0O1xuICAgIGNvbnN0IHdpcmVzTm9kZSA9IGNoaWxkKGZsZ05ldCwgJ1dpcmVzJyk7XG5cbiAgICAvLyBCdWlsZCBlbGVtZW50IG1hcCBieSBVSWRcbiAgICBjb25zdCB1aWRUb0VsZW1lbnQgPSBuZXcgTWFwPHN0cmluZywgTGFkZGVyRWxlbWVudD4oKTtcbiAgICBsZXQgcG9zWCA9IDA7XG5cbiAgICAvLyBCdWlsZCB3aXJlIG1hcCBmaXJzdCBzbyB3ZSBjYW4gcmVzb2x2ZSBvcGVyYW5kcyBmb3IgUGFydC1iYXNlZCBjb250YWN0cy9jb2lsc1xuICAgIC8vIFVJZCBcdTIxOTIgQWNjZXNzIGVsZW1lbnQgZm9yIHZhcmlhYmxlIHJlc29sdXRpb25cbiAgICBjb25zdCB1aWRUb0FjY2VzcyA9IG5ldyBNYXA8c3RyaW5nLCB1bmtub3duPigpO1xuICAgIGNvbnN0IHJhd1dpcmVzOiB1bmtub3duW10gPSB3aXJlc05vZGUgPyBjaGlsZEFycmF5KHdpcmVzTm9kZSwgJ1dpcmUnKSA6IFtdO1xuICAgIGZvciAoY29uc3Qgd2lyZUVsIG9mIHJhd1dpcmVzKSB7XG4gICAgICBjb25zdCBpZGVudENvbnMgPSBjaGlsZEFycmF5KHdpcmVFbCwgJ0lkZW50Q29uJyk7XG4gICAgICBmb3IgKGNvbnN0IGljIG9mIGlkZW50Q29ucykge1xuICAgICAgICBjb25zdCB1aWQgPSBhdHRyKGljLCAnVUlkJyk7XG4gICAgICAgIGlmICh1aWQpIHtcbiAgICAgICAgICAvLyBGaW5kIHRoZSBBY2Nlc3MgZWxlbWVudCB3aXRoIHRoaXMgVUlkIGluIHBhcnRzTm9kZVxuICAgICAgICAgIGZvciAoY29uc3QgYWNjRWwgb2YgY2hpbGRBcnJheShwYXJ0c05vZGUsICdBY2Nlc3MnKSkge1xuICAgICAgICAgICAgaWYgKGF0dHIoYWNjRWwsICdVSWQnKSA9PT0gdWlkKSB7IHVpZFRvQWNjZXNzLnNldCh1aWQsIGFjY0VsKTsgYnJlYWs7IH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBIZWxwZXI6IHJlc29sdmUgdGFnIG5hbWUgZm9yIGEgUGFydCBlbGVtZW50IHZpYSBpdHMgd2lyZS1jb25uZWN0ZWQgQWNjZXNzXG4gICAgZnVuY3Rpb24gcmVzb2x2ZVBhcnRUYWcocGFydFVJZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAgIC8vIEZpcnN0IHRyeSBpbmxpbmUgQWNjZXNzIGNoaWxkIChlbGVtZW50LWJhc2VkIGZvcm1hdClcbiAgICAgIGNvbnN0IGRpcmVjdEFjY2VzcyA9IGNoaWxkQXJyYXkocGFydHNOb2RlLCAnQWNjZXNzJykuZmluZChhID0+IHtcbiAgICAgICAgLy8gQWNjZXNzIGVsZW1lbnRzIHdpdGggc2FtZSBVSWQgYXMgcGFydCBcdTIwMTQgdW5saWtlbHkgYnV0IGNoZWNrXG4gICAgICAgIHJldHVybiBmYWxzZTsgLy8gUGFydHMgYW5kIEFjY2VzcyBoYXZlIGRpZmZlcmVudCBVSWRzXG4gICAgICB9KTtcbiAgICAgIC8vIFdpcmUtYmFzZWQ6IGZpbmQgd2lyZSB3aXRoIE5hbWVDb24gVUlkPXBhcnRVSWQgTmFtZT1cIm9wZXJhbmRcIiBcdTIxOTIgSWRlbnRDb24gXHUyMTkyIEFjY2Vzc1xuICAgICAgZm9yIChjb25zdCB3aXJlRWwgb2YgcmF3V2lyZXMpIHtcbiAgICAgICAgY29uc3QgbmFtZUNvbnMgPSBjaGlsZEFycmF5KHdpcmVFbCwgJ05hbWVDb24nKTtcbiAgICAgICAgY29uc3QgaWRlbnRDb25zID0gY2hpbGRBcnJheSh3aXJlRWwsICdJZGVudENvbicpO1xuICAgICAgICBmb3IgKGNvbnN0IG5jIG9mIG5hbWVDb25zKSB7XG4gICAgICAgICAgaWYgKGF0dHIobmMsICdVSWQnKSA9PT0gcGFydFVJZCAmJiBhdHRyKG5jLCAnTmFtZScpID09PSAnb3BlcmFuZCcpIHtcbiAgICAgICAgICAgIC8vIFRoZSBjb25uZWN0ZWQgSWRlbnRDb24gaGFzIHRoZSBBY2Nlc3MgVUlkXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGljIG9mIGlkZW50Q29ucykge1xuICAgICAgICAgICAgICBjb25zdCBhY2Nlc3NVSWQgPSBhdHRyKGljLCAnVUlkJyk7XG4gICAgICAgICAgICAgIGNvbnN0IGFjY0VsID0gdWlkVG9BY2Nlc3MuZ2V0KGFjY2Vzc1VJZCk7XG4gICAgICAgICAgICAgIGlmIChhY2NFbCkgcmV0dXJuIHBhcnNlQWNjZXNzVGFnKGFjY0VsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiAnVU5LTk9XTl9UQUcnO1xuICAgIH1cblxuICAgIC8vIEhlbHBlcjogY2hlY2sgaWYgUGFydCBlbGVtZW50IGlzIG5lZ2F0ZWRcbiAgICBmdW5jdGlvbiBpc1BhcnROZWdhdGVkKHBhcnRFbDogdW5rbm93bik6IGJvb2xlYW4ge1xuICAgICAgcmV0dXJuIGNoaWxkQXJyYXkocGFydEVsLCAnTmVnYXRlZCcpLmxlbmd0aCA+IDBcbiAgICAgICAgfHwgYXR0cihwYXJ0RWwsICdOZWdhdGVkJykgPT09ICd0cnVlJ1xuICAgICAgICB8fCBjaGlsZEFycmF5KHBhcnRFbCwgJ05lZ2F0ZWRSZXN1bHQnKS5sZW5ndGggPiAwO1xuICAgIH1cblxuICAgIC8vIFRyYWNrIHdoaWNoIFVJZHMgYXJlIGxlZnQgcG93ZXIgcmFpbCBvcmlnaW5zIChQb3dlcnJhaWwgZWxlbWVudHMpXG4gICAgY29uc3QgcG93ZXJyYWlsVUlkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gICAgLy8gUGFyc2UgYWxsIGVsZW1lbnRzIFx1MjAxNCBoYW5kbGUgYm90aCBlbGVtZW50LW5hbWUgZm9ybSAoQ29udGFjdCwgQ29pbCkgYW5kXG4gICAgLy8gYXR0cmlidXRlLW5hbWUgZm9ybSAoUGFydCBOYW1lPVwiQ29udGFjdFwiKSB1c2VkIGluIG5ld2VyIFRJQSBQb3J0YWwgZXhwb3J0c1xuICAgIGNvbnN0IGFsbFBhcnRFbHMgPSBbXG4gICAgICAuLi5jaGlsZEFycmF5KHBhcnRzTm9kZSwgJ0NvbnRhY3QnKSxcbiAgICAgIC4uLmNoaWxkQXJyYXkocGFydHNOb2RlLCAnQ29pbCcpLFxuICAgICAgLi4uY2hpbGRBcnJheShwYXJ0c05vZGUsICdTZXRDb2lsJyksXG4gICAgICAuLi5jaGlsZEFycmF5KHBhcnRzTm9kZSwgJ1Jlc2V0Q29pbCcpLFxuICAgICAgLi4uY2hpbGRBcnJheShwYXJ0c05vZGUsICdQYXJ0JyksICAvLyBUSUEgVjE2KyB1c2VzIFBhcnQgTmFtZT1cIkNvbnRhY3RcIiBldGMuXG4gICAgICAuLi5jaGlsZEFycmF5KHBhcnRzTm9kZSwgJ0NhbGwnKSxcbiAgICAgIC4uLmNoaWxkQXJyYXkocGFydHNOb2RlLCAnUG93ZXJyYWlsJyksXG4gICAgICAuLi5jaGlsZEFycmF5KHBhcnRzTm9kZSwgJ09wZW5Db24nKSxcbiAgICBdO1xuXG4gICAgZm9yIChjb25zdCBwYXJ0RWwgb2YgYWxsUGFydEVscykge1xuICAgICAgY29uc3QgcGFydFVJZCA9IGF0dHIocGFydEVsLCAnVUlkJyk7XG4gICAgICBpZiAoIXBhcnRVSWQpIGNvbnRpbnVlO1xuXG4gICAgICAvLyBEZXRlcm1pbmUgZWxlbWVudCBzZW1hbnRpYyB0eXBlXG4gICAgICBjb25zdCBlbGVtVGFnTmFtZSA9IChwYXJ0RWwgYXMgYW55KVsnI25hbWUnXSB8fCAnJztcbiAgICAgIGNvbnN0IHBhcnROYW1lID0gYXR0cihwYXJ0RWwsICdOYW1lJykgfHwgZWxlbVRhZ05hbWU7XG4gICAgICBjb25zdCB1cHBlck5hbWUgPSBwYXJ0TmFtZS50b1VwcGVyQ2FzZSgpO1xuXG4gICAgICAvLyBQb3dlcnJhaWwgPSBsZWZ0IHBvd2VyIHJhaWw7IG1hcmsgYXMgc3ludGhldGljIHJvb3RcbiAgICAgIGlmICh1cHBlck5hbWUgPT09ICdQT1dFUlJBSUwnIHx8IGVsZW1UYWdOYW1lID09PSAnUG93ZXJyYWlsJykge1xuICAgICAgICBwb3dlcnJhaWxVSWRzLmFkZChwYXJ0VUlkKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAodXBwZXJOYW1lID09PSAnT1BFTkNPTicgfHwgZWxlbVRhZ05hbWUgPT09ICdPcGVuQ29uJykgY29udGludWU7XG5cbiAgICAgIC8vIFNDb2lsIChTZXQgQ29pbCkgXHUyMDE0IFRJQSBWMTYrIHVzZXMgUGFydCBOYW1lPVwiU0NvaWxcIlxuICAgICAgaWYgKHVwcGVyTmFtZSA9PT0gJ1NDT0lMJykge1xuICAgICAgICBjb25zdCBkaXJlY3RBY2MgPSBjaGlsZEFycmF5KHBhcnRFbCwgJ0FjY2VzcycpWzBdO1xuICAgICAgICBjb25zdCB0YWdOYW1lID0gZGlyZWN0QWNjID8gcGFyc2VBY2Nlc3NUYWcoZGlyZWN0QWNjKSA6IHJlc29sdmVQYXJ0VGFnKHBhcnRVSWQpO1xuICAgICAgICB1aWRUb0VsZW1lbnQuc2V0KHBhcnRVSWQsIHsga2luZDogJ2NvaWwnLCBpZDogYHNpZW1lbnMtJHtwYXJ0VUlkfWAsIHR5cGU6ICdzZXQnLCB0YWc6IHsgbmFtZTogdGFnTmFtZSwgZGF0YVR5cGU6IHJlc29sdmVyLnJlc29sdmUodGFnTmFtZSkgfSwgcG9zaXRpb246IHsgeDogcG9zWCwgeTogMCB9IH0gYXMgQ29pbEVsZW1lbnQpO1xuICAgICAgICBwb3NYICs9IDYwOyBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gUkNvaWwgKFJlc2V0IENvaWwpIFx1MjAxNCBUSUEgVjE2KyB1c2VzIFBhcnQgTmFtZT1cIlJDb2lsXCJcbiAgICAgIGlmICh1cHBlck5hbWUgPT09ICdSQ09JTCcpIHtcbiAgICAgICAgY29uc3QgZGlyZWN0QWNjID0gY2hpbGRBcnJheShwYXJ0RWwsICdBY2Nlc3MnKVswXTtcbiAgICAgICAgY29uc3QgdGFnTmFtZSA9IGRpcmVjdEFjYyA/IHBhcnNlQWNjZXNzVGFnKGRpcmVjdEFjYykgOiByZXNvbHZlUGFydFRhZyhwYXJ0VUlkKTtcbiAgICAgICAgdWlkVG9FbGVtZW50LnNldChwYXJ0VUlkLCB7IGtpbmQ6ICdjb2lsJywgaWQ6IGBzaWVtZW5zLSR7cGFydFVJZH1gLCB0eXBlOiAncmVzZXQnLCB0YWc6IHsgbmFtZTogdGFnTmFtZSwgZGF0YVR5cGU6IHJlc29sdmVyLnJlc29sdmUodGFnTmFtZSkgfSwgcG9zaXRpb246IHsgeDogcG9zWCwgeTogMCB9IH0gYXMgQ29pbEVsZW1lbnQpO1xuICAgICAgICBwb3NYICs9IDYwOyBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gQ29udGFjdC10eXBlIGVsZW1lbnRzXG4gICAgICBpZiAodXBwZXJOYW1lID09PSAnQ09OVEFDVCcgfHwgZWxlbVRhZ05hbWUgPT09ICdDb250YWN0Jykge1xuICAgICAgICBjb25zdCBuZWdhdGVkID0gaXNQYXJ0TmVnYXRlZChwYXJ0RWwpO1xuICAgICAgICBjb25zdCBkaXJlY3RBY2MgPSBjaGlsZEFycmF5KHBhcnRFbCwgJ0FjY2VzcycpWzBdO1xuICAgICAgICBjb25zdCB0YWdOYW1lID0gZGlyZWN0QWNjID8gcGFyc2VBY2Nlc3NUYWcoZGlyZWN0QWNjKSA6IHJlc29sdmVQYXJ0VGFnKHBhcnRVSWQpO1xuICAgICAgICBjb25zdCBlbDogQ29udGFjdEVsZW1lbnQgPSB7XG4gICAgICAgICAga2luZDogJ2NvbnRhY3QnLFxuICAgICAgICAgIGlkOiBgc2llbWVucy0ke3BhcnRVSWR9YCxcbiAgICAgICAgICB0eXBlOiBuZWdhdGVkID8gJ05DJyA6ICdOTycsXG4gICAgICAgICAgdGFnOiB7IG5hbWU6IHRhZ05hbWUsIGRhdGFUeXBlOiByZXNvbHZlci5yZXNvbHZlKHRhZ05hbWUpIH0sXG4gICAgICAgICAgcG9zaXRpb246IHsgeDogcG9zWCwgeTogMCB9LFxuICAgICAgICB9O1xuICAgICAgICB1aWRUb0VsZW1lbnQuc2V0KHBhcnRVSWQsIGVsKTtcbiAgICAgICAgcG9zWCArPSA2MDtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIFBfQ09OVEFDVCAvIE5fQ09OVEFDVCAoZWRnZSBkZXRlY3Rpb24gY29udGFjdHMpXG4gICAgICBpZiAodXBwZXJOYW1lID09PSAnUF9DT05UQUNUJyB8fCB1cHBlck5hbWUgPT09ICdQQ09OVEFDVCcpIHtcbiAgICAgICAgY29uc3QgdGFnTmFtZSA9IHJlc29sdmVQYXJ0VGFnKHBhcnRVSWQpO1xuICAgICAgICB1aWRUb0VsZW1lbnQuc2V0KHBhcnRVSWQsIHsga2luZDogJ2NvbnRhY3QnLCBpZDogYHNpZW1lbnMtJHtwYXJ0VUlkfWAsIHR5cGU6ICdQX0NPTlRBQ1QnLCB0YWc6IHsgbmFtZTogdGFnTmFtZSwgZGF0YVR5cGU6IHJlc29sdmVyLnJlc29sdmUodGFnTmFtZSkgfSwgcG9zaXRpb246IHsgeDogcG9zWCwgeTogMCB9IH0gYXMgQ29udGFjdEVsZW1lbnQpO1xuICAgICAgICBwb3NYICs9IDYwOyBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmICh1cHBlck5hbWUgPT09ICdOX0NPTlRBQ1QnIHx8IHVwcGVyTmFtZSA9PT0gJ05DT05UQUNUJykge1xuICAgICAgICBjb25zdCB0YWdOYW1lID0gcmVzb2x2ZVBhcnRUYWcocGFydFVJZCk7XG4gICAgICAgIHVpZFRvRWxlbWVudC5zZXQocGFydFVJZCwgeyBraW5kOiAnY29udGFjdCcsIGlkOiBgc2llbWVucy0ke3BhcnRVSWR9YCwgdHlwZTogJ05fQ09OVEFDVCcsIHRhZzogeyBuYW1lOiB0YWdOYW1lLCBkYXRhVHlwZTogcmVzb2x2ZXIucmVzb2x2ZSh0YWdOYW1lKSB9LCBwb3NpdGlvbjogeyB4OiBwb3NYLCB5OiAwIH0gfSBhcyBDb250YWN0RWxlbWVudCk7XG4gICAgICAgIHBvc1ggKz0gNjA7IGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBDb2lsLXR5cGUgZWxlbWVudHNcbiAgICAgIGlmICh1cHBlck5hbWUgPT09ICdDT0lMJyB8fCBlbGVtVGFnTmFtZSA9PT0gJ0NvaWwnKSB7XG4gICAgICAgIGNvbnN0IG5lZ2F0ZWQgPSBpc1BhcnROZWdhdGVkKHBhcnRFbCk7XG4gICAgICAgIGNvbnN0IGRpcmVjdEFjYyA9IGNoaWxkQXJyYXkocGFydEVsLCAnQWNjZXNzJylbMF07XG4gICAgICAgIGNvbnN0IHRhZ05hbWUgPSBkaXJlY3RBY2MgPyBwYXJzZUFjY2Vzc1RhZyhkaXJlY3RBY2MpIDogcmVzb2x2ZVBhcnRUYWcocGFydFVJZCk7XG4gICAgICAgIHVpZFRvRWxlbWVudC5zZXQocGFydFVJZCwgeyBraW5kOiAnY29pbCcsIGlkOiBgc2llbWVucy0ke3BhcnRVSWR9YCwgdHlwZTogbmVnYXRlZCA/ICduZWdhdGVkJyA6ICdub3JtYWwnLCB0YWc6IHsgbmFtZTogdGFnTmFtZSwgZGF0YVR5cGU6IHJlc29sdmVyLnJlc29sdmUodGFnTmFtZSkgfSwgcG9zaXRpb246IHsgeDogcG9zWCwgeTogMCB9IH0gYXMgQ29pbEVsZW1lbnQpO1xuICAgICAgICBwb3NYICs9IDYwOyBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHVwcGVyTmFtZSA9PT0gJ1NFVENPSUwnIHx8IGVsZW1UYWdOYW1lID09PSAnU2V0Q29pbCcpIHtcbiAgICAgICAgY29uc3QgZGlyZWN0QWNjID0gY2hpbGRBcnJheShwYXJ0RWwsICdBY2Nlc3MnKVswXTtcbiAgICAgICAgY29uc3QgdGFnTmFtZSA9IGRpcmVjdEFjYyA/IHBhcnNlQWNjZXNzVGFnKGRpcmVjdEFjYykgOiByZXNvbHZlUGFydFRhZyhwYXJ0VUlkKTtcbiAgICAgICAgdWlkVG9FbGVtZW50LnNldChwYXJ0VUlkLCB7IGtpbmQ6ICdjb2lsJywgaWQ6IGBzaWVtZW5zLSR7cGFydFVJZH1gLCB0eXBlOiAnc2V0JywgdGFnOiB7IG5hbWU6IHRhZ05hbWUsIGRhdGFUeXBlOiByZXNvbHZlci5yZXNvbHZlKHRhZ05hbWUpIH0sIHBvc2l0aW9uOiB7IHg6IHBvc1gsIHk6IDAgfSB9IGFzIENvaWxFbGVtZW50KTtcbiAgICAgICAgcG9zWCArPSA2MDsgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmICh1cHBlck5hbWUgPT09ICdSRVNFVENPSUwnIHx8IGVsZW1UYWdOYW1lID09PSAnUmVzZXRDb2lsJykge1xuICAgICAgICBjb25zdCBkaXJlY3RBY2MgPSBjaGlsZEFycmF5KHBhcnRFbCwgJ0FjY2VzcycpWzBdO1xuICAgICAgICBjb25zdCB0YWdOYW1lID0gZGlyZWN0QWNjID8gcGFyc2VBY2Nlc3NUYWcoZGlyZWN0QWNjKSA6IHJlc29sdmVQYXJ0VGFnKHBhcnRVSWQpO1xuICAgICAgICB1aWRUb0VsZW1lbnQuc2V0KHBhcnRVSWQsIHsga2luZDogJ2NvaWwnLCBpZDogYHNpZW1lbnMtJHtwYXJ0VUlkfWAsIHR5cGU6ICdyZXNldCcsIHRhZzogeyBuYW1lOiB0YWdOYW1lLCBkYXRhVHlwZTogcmVzb2x2ZXIucmVzb2x2ZSh0YWdOYW1lKSB9LCBwb3NpdGlvbjogeyB4OiBwb3NYLCB5OiAwIH0gfSBhcyBDb2lsRWxlbWVudCk7XG4gICAgICAgIHBvc1ggKz0gNjA7IGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBDYWxsIC8gSUVDIGZ1bmN0aW9uIGJsb2Nrc1xuICAgICAgaWYgKGVsZW1UYWdOYW1lID09PSAnQ2FsbCcgfHwgdXBwZXJOYW1lID09PSAnQ0FMTCcpIHtcbiAgICAgICAgY29uc3QgY2FsbEluZm8gPSBjaGlsZChwYXJ0RWwsICdDYWxsSW5mbycpO1xuICAgICAgICBjb25zdCBibG9ja05hbWUgPSBhdHRyKGNhbGxJbmZvLCAnTmFtZScpIHx8ICcnO1xuICAgICAgICBjb25zdCBibG9ja1R5cGUgPSBhdHRyKGNhbGxJbmZvLCAnQmxvY2tUeXBlJykgfHwgJyc7IC8vIEZCLCBGQywgZXRjLlxuICAgICAgICBjb25zdCBtZXRhID0gbWFwU2llbWVuc0ZCVHlwZVdpdGhNZXRhKGJsb2NrTmFtZSk7XG4gICAgICAgIC8vIEZvciBGQi9GQyBjYWxscyB0aGF0IGRvbid0IG1hcCB0byBJRUMgc3RhbmRhcmQgYmxvY2tzLCB0cmVhdCBhcyBnZW5lcmljIE1PVkUgcGxhY2Vob2xkZXJcbiAgICAgICAgY29uc3QgZmJUeXBlID0gbWV0YSA/IG1ldGEuZmJUeXBlIDogJ01PVkUnIGFzIEZCVHlwZTtcbiAgICAgICAgY29uc3Qgc3RvcmVPcmlnaW5hbCA9IG1ldGEgPyBtZXRhLnN0b3JlT3JpZ2luYWwgOiB0cnVlO1xuICAgICAgICAvLyBJbnN0YW5jZSBjYW4gYmUgZWl0aGVyIE5hbWUgYXR0cmlidXRlIG9yIENvbXBvbmVudCBjaGlsZFxuICAgICAgICBjb25zdCBpbnN0YW5jZUVsID0gY2hpbGQoY2FsbEluZm8sICdJbnN0YW5jZScpO1xuICAgICAgICBjb25zdCBpbnN0YW5jZUNvbXBvbmVudCA9IGNoaWxkKGluc3RhbmNlRWwsICdDb21wb25lbnQnKTtcbiAgICAgICAgY29uc3QgaW5zdGFuY2VOYW1lID0gYXR0cihpbnN0YW5jZUNvbXBvbmVudCwgJ05hbWUnKSB8fCBhdHRyKGluc3RhbmNlRWwsICdOYW1lJykgfHwgYmxvY2tOYW1lO1xuICAgICAgICBjb25zdCBibGs6IEJsb2NrRWxlbWVudCA9IHsga2luZDogJ2Jsb2NrJywgaWQ6IGBzaWVtZW5zLSR7cGFydFVJZH1gLCBmYlR5cGUsIGluc3RhbmNlTmFtZSwgcGluczoge30sIHBvc2l0aW9uOiB7IHg6IHBvc1gsIHk6IDAgfSB9O1xuICAgICAgICBpZiAoc3RvcmVPcmlnaW5hbCkgYmxrLnZlbmRvck9yaWdpbmFsTmFtZSA9IGJsb2NrTmFtZTtcbiAgICAgICAgLy8gU3RvcmUgQmxvY2tUeXBlIGFuZCBQYXJhbWV0ZXIgaW5mbyBmb3Igcm91bmQtdHJpcFxuICAgICAgICAoYmxrIGFzIGFueSkudmVuZG9yQmxvY2tUeXBlID0gYmxvY2tUeXBlO1xuICAgICAgICAvLyBFeHRyYWN0IHBhcmFtZXRlciBkZWNsYXJhdGlvbnMgZm9yIHBpbiBtYXBwaW5nIChzdG9yZSBhcyBUYWdSZWYgZm9yIHR5cGUgY29tcGF0KVxuICAgICAgICBjb25zdCBwYXJhbXMgPSBjaGlsZEFycmF5KGNhbGxJbmZvLCAnUGFyYW1ldGVyJyk7XG4gICAgICAgIGZvciAoY29uc3QgcGFyYW0gb2YgcGFyYW1zKSB7XG4gICAgICAgICAgY29uc3QgcE5hbWUgPSBhdHRyKHBhcmFtLCAnTmFtZScpIHx8ICcnO1xuICAgICAgICAgIGNvbnN0IHBTZWN0aW9uID0gYXR0cihwYXJhbSwgJ1NlY3Rpb24nKSB8fCAnJztcbiAgICAgICAgICBjb25zdCBwVHlwZSA9IGF0dHIocGFyYW0sICdUeXBlJykgfHwgJ0Jvb2wnO1xuICAgICAgICAgIGlmIChwTmFtZSkge1xuICAgICAgICAgICAgYmxrLnBpbnNbcE5hbWVdID0geyBuYW1lOiBwTmFtZSwgZGF0YVR5cGU6IHNpZW1lbnNUeXBlVG9JRUMocFR5cGUpIH07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHVpZFRvRWxlbWVudC5zZXQocGFydFVJZCwgYmxrKTtcbiAgICAgICAgcG9zWCArPSA2MDsgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIFBhcnQgTmFtZT1cIlRPTlwiIGV0YyBcdTIwMTQgSUVDIEZCIGFzIFBhcnQgZWxlbWVudCAoVElBIFYxNispXG4gICAgICBpZiAoZWxlbVRhZ05hbWUgPT09ICdQYXJ0Jykge1xuICAgICAgICBjb25zdCBtZXRhID0gbWFwU2llbWVuc0ZCVHlwZVdpdGhNZXRhKHBhcnROYW1lKTtcbiAgICAgICAgaWYgKG1ldGEpIHtcbiAgICAgICAgICBjb25zdCBpbnN0YW5jZU5hbWUgPSByZXNvbHZlUGFydFRhZyhwYXJ0VUlkKSB8fCBwYXJ0TmFtZTtcbiAgICAgICAgICBjb25zdCBibGs6IEJsb2NrRWxlbWVudCA9IHsga2luZDogJ2Jsb2NrJywgaWQ6IGBzaWVtZW5zLSR7cGFydFVJZH1gLCBmYlR5cGU6IG1ldGEuZmJUeXBlLCBpbnN0YW5jZU5hbWUsIHBpbnM6IHt9LCBwb3NpdGlvbjogeyB4OiBwb3NYLCB5OiAwIH0gfTtcbiAgICAgICAgICBpZiAobWV0YS5zdG9yZU9yaWdpbmFsKSBibGsudmVuZG9yT3JpZ2luYWxOYW1lID0gcGFydE5hbWU7XG4gICAgICAgICAgdWlkVG9FbGVtZW50LnNldChwYXJ0VUlkLCBibGspO1xuICAgICAgICAgIHBvc1ggKz0gNjA7IGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIFVua25vd24gUGFydCBcdTIwMTQgc2tpcCBzaWxlbnRseSAoQWNjZXNzL3ZhcmlhYmxlIG5vZGVzLCBldGMuKVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFBhcnNlIHdpcmVzIHRvIGRldGVybWluZSBvcmRlcmluZyBhbmQgcGFyYWxsZWwgYnJhbmNoZXNcbiAgICBjb25zdCB3aXJlQ29ubnM6IFdpcmVDb25uZWN0aW9uW10gPSBbXTtcbiAgICBpZiAod2lyZXNOb2RlKSB7XG4gICAgICBmb3IgKGNvbnN0IHdpcmVFbCBvZiByYXdXaXJlcykge1xuICAgICAgICBjb25zdCBuYW1lQ29ucyA9IGNoaWxkQXJyYXkod2lyZUVsLCAnTmFtZUNvbicpO1xuICAgICAgICBjb25zdCBpZGVudENvbnMgPSBjaGlsZEFycmF5KHdpcmVFbCwgJ0lkZW50Q29uJyk7XG4gICAgICAgIC8vIFBvd2VycmFpbCBlbGVtZW50IGluIHdpcmUgYWN0cyBhcyBsZWZ0LXJhaWwgc291cmNlXG4gICAgICAgIGNvbnN0IGhhc1Bvd2VycmFpbCA9IGNoaWxkQXJyYXkod2lyZUVsLCAnUG93ZXJyYWlsJykubGVuZ3RoID4gMDtcbiAgICAgICAgY29uc3QgYWxsQ29ucyA9IFsuLi5uYW1lQ29ucywgLi4uaWRlbnRDb25zXTtcbiAgICAgICAgaWYgKGhhc1Bvd2VycmFpbCAmJiBhbGxDb25zLmxlbmd0aCA+PSAxKSB7XG4gICAgICAgICAgLy8gVHJlYXQgcG93ZXJyYWlsIGFzIHN5bnRoZXRpYyBzb3VyY2UgdWlkICdwb3dlcnJhaWwnXG4gICAgICAgICAgd2lyZUNvbm5zLnB1c2goeyBmcm9tVUlkOiAncG93ZXJyYWlsJywgZnJvbVBpbjogJ291dCcsIHRvVUlkOiBhdHRyKGFsbENvbnNbMF0sICdVSWQnKSB8fCAnJywgdG9QaW46IGF0dHIoYWxsQ29uc1swXSwgJ05hbWUnKSB8fCAnaW4nIH0pO1xuICAgICAgICAgIGZvciAobGV0IHdpID0gMTsgd2kgPCBhbGxDb25zLmxlbmd0aDsgd2krKykge1xuICAgICAgICAgICAgd2lyZUNvbm5zLnB1c2goeyBmcm9tVUlkOiAncG93ZXJyYWlsJywgZnJvbVBpbjogJ291dCcsIHRvVUlkOiBhdHRyKGFsbENvbnNbd2ldLCAnVUlkJykgfHwgJycsIHRvUGluOiAnaW4nIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhbGxDb25zLmxlbmd0aCA+PSAyKSB7XG4gICAgICAgICAgY29uc3QgZnJvbUVsID0gYWxsQ29uc1swXTtcbiAgICAgICAgICBjb25zdCB0b0VsID0gYWxsQ29uc1sxXTtcbiAgICAgICAgICB3aXJlQ29ubnMucHVzaCh7XG4gICAgICAgICAgICBmcm9tVUlkOiBhdHRyKGZyb21FbCwgJ1VJZCcpIHx8ICcnLFxuICAgICAgICAgICAgZnJvbVBpbjogYXR0cihmcm9tRWwsICdOYW1lJykgfHwgJ291dCcsXG4gICAgICAgICAgICB0b1VJZDogYXR0cih0b0VsLCAnVUlkJykgfHwgJycsXG4gICAgICAgICAgICB0b1BpbjogYXR0cih0b0VsLCAnTmFtZScpIHx8ICdpbicsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgLy8gSWYgdGhlcmUgYXJlIG1vcmUgdGhhbiAyIGNvbm5lY3Rpb25zIG9uIGEgd2lyZSwgaXQncyBhIGJyYW5jaCBwb2ludFxuICAgICAgICAgIGZvciAobGV0IHdpID0gMjsgd2kgPCBhbGxDb25zLmxlbmd0aDsgd2krKykge1xuICAgICAgICAgICAgd2lyZUNvbm5zLnB1c2goe1xuICAgICAgICAgICAgICBmcm9tVUlkOiBhdHRyKGZyb21FbCwgJ1VJZCcpIHx8ICcnLFxuICAgICAgICAgICAgICBmcm9tUGluOiBhdHRyKGZyb21FbCwgJ05hbWUnKSB8fCAnb3V0JyxcbiAgICAgICAgICAgICAgdG9VSWQ6IGF0dHIoYWxsQ29uc1t3aV0sICdVSWQnKSB8fCAnJyxcbiAgICAgICAgICAgICAgdG9QaW46IGF0dHIoYWxsQ29uc1t3aV0sICdOYW1lJykgfHwgJ2luJyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFVzZSB3aXJlcyB0byBvcmRlciBlbGVtZW50czogQkZTIGZyb20gcG93ZXJyYWlsIChvciBlbGVtZW50cyB3aXRoIG5vIGluY29taW5nKVxuICAgIC8vIEVsZW1lbnRzIGNvbm5lY3RlZCBmcm9tIHBvd2VycmFpbCBhcmUgZXhwbGljaXQgcm9vdHMgZXZlbiBpZiB0aGV5IGFwcGVhciBpbiBoYXNJbmNvbWluZ1xuICAgIGNvbnN0IHBvd2VycmFpbFRhcmdldHMgPSBuZXcgU2V0KHdpcmVDb25ucy5maWx0ZXIodyA9PiB3LmZyb21VSWQgPT09ICdwb3dlcnJhaWwnKS5tYXAodyA9PiB3LnRvVUlkKSk7XG4gICAgY29uc3QgaGFzSW5jb21pbmcgPSBuZXcgU2V0KHdpcmVDb25ucy5maWx0ZXIodyA9PiB3LmZyb21VSWQgIT09ICdwb3dlcnJhaWwnKS5tYXAodyA9PiB3LnRvVUlkKSk7XG4gICAgY29uc3Qgcm9vdHMgPSBbLi4udWlkVG9FbGVtZW50LmtleXMoKV0uZmlsdGVyKHVpZCA9PiAhaGFzSW5jb21pbmcuaGFzKHVpZCkgfHwgcG93ZXJyYWlsVGFyZ2V0cy5oYXModWlkKSk7XG4gICAgY29uc3Qgb3V0RWRnZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nW10+KCk7XG4gICAgZm9yIChjb25zdCB3IG9mIHdpcmVDb25ucykge1xuICAgICAgaWYgKCFvdXRFZGdlcy5oYXMody5mcm9tVUlkKSkgb3V0RWRnZXMuc2V0KHcuZnJvbVVJZCwgW10pO1xuICAgICAgb3V0RWRnZXMuZ2V0KHcuZnJvbVVJZCkhLnB1c2gody50b1VJZCk7XG4gICAgfVxuXG4gICAgLy8gRGV0ZWN0IGJyYW5jaGVzOiBpZiBhIHNpbmdsZSBzb3VyY2UgaGFzIG11bHRpcGxlIG91dGdvaW5nIGNvbm5lY3Rpb25zLCB0aG9zZSBmb3JtIHBhcmFsbGVsIHBhdGhzXG4gICAgY29uc3QgYnJhbmNoZXM6IEJyYW5jaFtdID0gW107XG4gICAgY29uc3QgbWFpbkVsZW1lbnRzOiBMYWRkZXJFbGVtZW50W10gPSBbXTtcbiAgICBjb25zdCB2aXNpdGVkID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgICBmdW5jdGlvbiB3YWxrQ2hhaW4oc3RhcnRVSWQ6IHN0cmluZyk6IExhZGRlckVsZW1lbnRbXSB7XG4gICAgICBjb25zdCBjaGFpbjogTGFkZGVyRWxlbWVudFtdID0gW107XG4gICAgICBsZXQgY3VycmVudCA9IHN0YXJ0VUlkO1xuICAgICAgd2hpbGUgKGN1cnJlbnQgJiYgIXZpc2l0ZWQuaGFzKGN1cnJlbnQpKSB7XG4gICAgICAgIHZpc2l0ZWQuYWRkKGN1cnJlbnQpO1xuICAgICAgICBjb25zdCBlbCA9IHVpZFRvRWxlbWVudC5nZXQoY3VycmVudCk7XG4gICAgICAgIGlmIChlbCkgY2hhaW4ucHVzaChlbCk7XG4gICAgICAgIGNvbnN0IG5leHRzID0gb3V0RWRnZXMuZ2V0KGN1cnJlbnQpIHx8IFtdO1xuICAgICAgICBpZiAobmV4dHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgY3VycmVudCA9IG5leHRzWzBdO1xuICAgICAgICB9IGVsc2UgaWYgKG5leHRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAvLyBCcmFuY2ggcG9pbnQgXHUyMDE0IGNyZWF0ZSBicmFuY2hlcyBmb3IgZWFjaCBwYXRoXG4gICAgICAgICAgZm9yIChjb25zdCBuZXh0VUlkIG9mIG5leHRzKSB7XG4gICAgICAgICAgICBpZiAoIXZpc2l0ZWQuaGFzKG5leHRVSWQpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGJyYW5jaEVsZW1lbnRzID0gd2Fsa0NoYWluKG5leHRVSWQpO1xuICAgICAgICAgICAgICBpZiAoYnJhbmNoRWxlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGJyYW5jaGVzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgaWQ6IGdlbklkKGBicmFuY2gtJHtwb3VJZH0tciR7cnVuZ0lkeH1gKSxcbiAgICAgICAgICAgICAgICAgIHN0YXJ0Tm9kZUlkOiBjdXJyZW50LFxuICAgICAgICAgICAgICAgICAgZW5kTm9kZUlkOiBicmFuY2hFbGVtZW50c1ticmFuY2hFbGVtZW50cy5sZW5ndGggLSAxXT8uaWQgfHwgY3VycmVudCxcbiAgICAgICAgICAgICAgICAgIGVsZW1lbnRzOiBicmFuY2hFbGVtZW50cyxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGNoYWluO1xuICAgIH1cblxuICAgIGlmIChyb290cy5sZW5ndGggPiAwKSB7XG4gICAgICBmb3IgKGNvbnN0IHJvb3RVSWQgb2Ygcm9vdHMpIHtcbiAgICAgICAgaWYgKCF2aXNpdGVkLmhhcyhyb290VUlkKSkge1xuICAgICAgICAgIG1haW5FbGVtZW50cy5wdXNoKC4uLndhbGtDaGFpbihyb290VUlkKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm8gY2xlYXIgcm9vdCBcdTIwMTQgdXNlIGFsbCBlbGVtZW50cyBpbiBtYXAgb3JkZXJcbiAgICAgIG1haW5FbGVtZW50cy5wdXNoKC4uLnVpZFRvRWxlbWVudC52YWx1ZXMoKSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIGFueSByZW1haW5pbmcgdW52aXNpdGVkIGVsZW1lbnRzXG4gICAgZm9yIChjb25zdCBbdWlkLCBlbF0gb2YgdWlkVG9FbGVtZW50KSB7XG4gICAgICBpZiAoIXZpc2l0ZWQuaGFzKHVpZCkpIG1haW5FbGVtZW50cy5wdXNoKGVsKTtcbiAgICB9XG5cbiAgICBydW5ncy5wdXNoKHtcbiAgICAgIGlkOiBgJHtwb3VJZH0tcnVuZy0ke3J1bmdJZHh9YCxcbiAgICAgIG51bWJlcjogcnVuZ0lkeCxcbiAgICAgIGNvbW1lbnQsXG4gICAgICBlbGVtZW50czogbWFpbkVsZW1lbnRzLFxuICAgICAgYnJhbmNoZXMsXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4geyBydW5ncyB9O1xufVxuXG5mdW5jdGlvbiBwYXJzZUFjY2Vzc1RhZyhhY2Nlc3NFbDogdW5rbm93bik6IHN0cmluZyB7XG4gIGlmICghYWNjZXNzRWwgfHwgdHlwZW9mIGFjY2Vzc0VsICE9PSAnb2JqZWN0JykgcmV0dXJuICdVTktOT1dOX1RBRyc7XG4gIGNvbnN0IHN5bWJvbEVsID0gY2hpbGQoYWNjZXNzRWwsICdTeW1ib2wnKTtcbiAgaWYgKHN5bWJvbEVsKSB7XG4gICAgY29uc3QgY29tcG9uZW50cyA9IGNoaWxkQXJyYXkoc3ltYm9sRWwsICdDb21wb25lbnQnKTtcbiAgICBpZiAoY29tcG9uZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gY29tcG9uZW50cy5tYXAoYyA9PiBhdHRyKGMsICdOYW1lJykpLmZpbHRlcihCb29sZWFuKS5qb2luKCcuJyk7XG4gICAgfVxuICAgIGNvbnN0IG5hbWUgPSBhdHRyKHN5bWJvbEVsLCAnTmFtZScpO1xuICAgIGlmIChuYW1lKSByZXR1cm4gbmFtZTtcbiAgfVxuICAvLyBGYWxsYmFjayB0byBOYW1lIGF0dHJpYnV0ZSBvbiBBY2Nlc3MgZWxlbWVudCBpdHNlbGZcbiAgcmV0dXJuIGF0dHIoYWNjZXNzRWwsICdOYW1lJykgfHwgJ1RBRyc7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBTaWVtZW5zIFx1MjE5MiBDTE0gRkIgdHlwZSBtYXBzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy9cbi8vIFNJRU1FTlNfRkJfTUFQOiB1c2VkIGZvciBMQUQgYmxvY2tzIChyZXR1cm5zIEZCVHlwZSwgdXNlZCBpbiBCbG9ja0VsZW1lbnQuZmJUeXBlKVxuLy8gU0lFTUVOU19GQkRfTUFQOiB1c2VkIGZvciBGQkQgYmxvY2tzIChyZXR1cm5zIEZCREJsb2NrVHlwZSwgdXNlZCBpbiBGQkROb2RlLnR5cGUpXG4vL1xuLy8gU3RyYXRlZ3k6XG4vLyAgIC0gRGlyZWN0IElFQyBlcXVpdmFsZW50cyBcdTIxOTIgbWFwIHRvIHRoZSBJRUMgY2Fub25pY2FsIG5hbWVcbi8vICAgLSBTaWVtZW5zLXNwZWNpZmljIHR5cGVzIG5vdyBpbiB0aGUgZXh0ZW5kZWQgRkJUeXBlL0ZCREJsb2NrVHlwZSB1bmlvbiBcdTIxOTIgbWFwIGRpcmVjdGx5XG4vLyAgIC0gVHlwZXMgd2l0aCBubyBDTE0gcmVwcmVzZW50YXRpb24gXHUyMTkyIG1hcCB0byBjbG9zZXN0IHNlbWFudGljIGVxdWl2YWxlbnRcbi8vICAgICBBTkQgc2V0IHZlbmRvck9yaWdpbmFsTmFtZSBzbyB0aGUgZXhwb3J0IGNhbiByZWNvbnN0cnVjdCB0aGUgb3JpZ2luYWwgbmFtZVxuLy9cbi8vIEFsbCBsb29rdXBzIGFyZSBjYXNlLWluc2Vuc2l0aXZlIChjYWxsZXIgZG9lcyAudG9VcHBlckNhc2UoKSkuXG5cbmNvbnN0IFNJRU1FTlNfRkJfTUFQOiBSZWNvcmQ8c3RyaW5nLCBGQlR5cGU+ID0ge1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBTdGFuZGFyZCBJRUMgdGltZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBUT046ICdUT04nLCBUT0Y6ICdUT0YnLCBUUDogJ1RQJyxcbiAgLy8gUmV0ZW50aXZlIHRpbWVyIChTaWVtZW5zIGV4dGVuc2lvbiwgbm93IGZpcnN0LWNsYXNzKVxuICBUT05SOiAnVE9OUicsXG4gIC8vIEdlbmVyaWMgSUVDIHRpbWVyIGluc3RhbmNlIG5hbWVzIFRJQSBQb3J0YWwgdXNlc1xuICBJRUNfVElNRVI6ICdJRUNfVElNRVInLCBJRUNfTFRJTUVSOiAnSUVDX0xUSU1FUicsXG4gIC8vIFRJQSBQb3J0YWwgVjE3KyBuYW1lIGFsaWFzZXNcbiAgJ1NGQjMnOiAnVE9OJywgJ1NGQjQnOiAnVE9GJywgJ1NGQjUnOiAnVFAnLFxuXG4gIC8vIFx1MjUwMFx1MjUwMCBTdGFuZGFyZCBJRUMgY291bnRlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIENUVTogJ0NUVScsIENURDogJ0NURCcsIENUVUQ6ICdDVFVEJyxcbiAgSUVDX0NPVU5URVI6ICdJRUNfQ09VTlRFUicsIElFQ19MQ09VTlRFUjogJ0lFQ19MQ09VTlRFUicsXG4gIC8vIElFQyB0aW1lciBjb250YWN0ICh0aW1lciBvdXRwdXQgY29udGFjdCB1c2VkIGluIFRJQSBQb3J0YWwgR1JBUEgpXG4gIElFQ19UQzogJ0lFQ19UQycsXG5cbiAgLy8gXHUyNTAwXHUyNTAwIEJpc3RhYmxlIGxhdGNoZXMgLyBlZGdlIGRldGVjdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgU1I6ICdTUicsIFJTOiAnUlMnLFxuICBSX1RSSUc6ICdSVFJJRycsIEZfVFJJRzogJ0ZUUklHJyxcbiAgUlRSSUc6ICdSVFJJRycsIEZUUklHOiAnRlRSSUcnLFxuXG4gIC8vIFx1MjUwMFx1MjUwMCBCb29sZWFuIGdhdGUgRkJzICh1c2VkIGluIEZCRC1zdHlsZSBMQUQgb24gUzctMzAwLzQwMCkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIEFORDogJ0FORCcsIE9SOiAnT1InLCBOT1Q6ICdOT1QnLCBYT1I6ICdYT1InLFxuXG4gIC8vIFx1MjUwMFx1MjUwMCBBcml0aG1ldGljIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBBREQ6ICdBREQnLCBTVUI6ICdTVUInLCBNVUw6ICdNVUwnLCBESVY6ICdESVYnLCBNT0Q6ICdNT0QnLFxuICBBQlM6ICdBQlMnLCBTUVJUOiAnU1FSVCcsIE5FRzogJ05FRycsXG4gIExOOiAnTE4nLCBMT0c6ICdMT0cnLCBFWFA6ICdFWFAnLFxuICBTSU46ICdTSU4nLCBDT1M6ICdDT1MnLCBUQU46ICdUQU4nLFxuICBBU0lOOiAnQVNJTicsIEFDT1M6ICdBQ09TJywgQVRBTjogJ0FUQU4nLFxuICBBVE46ICdBVEFOJywgQVNOOiAnQVNJTicsIEFDUzogJ0FDT1MnLCAgLy8gYWx0ZXJuYXRlIHNwZWxsaW5nc1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBDb21wYXJpc29uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBHVDogJ0dUJywgR0U6ICdHRScsIExUOiAnTFQnLCBMRTogJ0xFJywgRVE6ICdFUScsIE5FOiAnTkUnLFxuICBDTVA6ICdFUScsICAvLyBnZW5lcmljIGNvbXBhcmUgXHUyMTkyIEVRXG5cbiAgLy8gXHUyNTAwXHUyNTAwIERhdGEgLyBzZWxlY3Rpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIE1PVkU6ICdNT1ZFJywgU0VMOiAnU0VMJywgTVVYOiAnU0VMJywgTElNSVQ6ICdMSU1JVCcsXG4gIE1JTjogJ01JTicsIE1BWDogJ01BWCcsXG5cbiAgLy8gXHUyNTAwXHUyNTAwIEJsaW5rIC8gb3NjaWxsYXRvciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgQkxJTks6ICdCTElOSycsXG5cbiAgLy8gXHUyNTAwXHUyNTAwIEFuYWxvZyBzY2FsaW5nIC8gbm9ybWFsaXNhdGlvbiAoU2llbWVucy1zcGVjaWZpYywgbm93IGZpcnN0LWNsYXNzKSBcdTI1MDBcbiAgU0NBTEU6ICdTQ0FMRScsIFVOU0NBTEU6ICdVTlNDQUxFJyxcbiAgTk9STV9YOiAnTk9STV9YJywgU0NBTEVfWDogJ1NDQUxFX1gnLFxuICAvLyBPbGRlciBTNyBTRkIgbmFtZXNcbiAgRkMxMDU6ICdTQ0FMRScsIEZDMTA2OiAnVU5TQ0FMRScsXG5cbiAgLy8gXHUyNTAwXHUyNTAwIFN0cmluZyBmdW5jdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIExFTjogJ0xFTicsIExFRlQ6ICdMRUZUJywgUklHSFQ6ICdSSUdIVCcsIE1JRDogJ01JRCcsXG4gIENPTkNBVDogJ0NPTkNBVCcsIEZJTkQ6ICdGSU5EJywgSU5TRVJUOiAnSU5TRVJUJywgREVMRVRFOiAnREVMRVRFJywgUkVQTEFDRTogJ1JFUExBQ0UnLFxuICBVUFBFUl9DQVNFOiAnVVBQRVJfQ0FTRScsIExPV0VSX0NBU0U6ICdMT1dFUl9DQVNFJyxcbiAgLy8gU2llbWVucyBTX3h4eCBzdHJpbmcgRkIgbmFtZXMgKFM3IGNsYXNzaWMpXG4gIFNfTEVOOiAnTEVOJywgU19MRUZUOiAnTEVGVCcsIFNfUklHSFQ6ICdSSUdIVCcsIFNfTUlEOiAnTUlEJyxcbiAgU19GSU5EOiAnRklORCcsIFNfQ09OVjogJ01PVkUnLCBTX0NPTkNBVDogJ0NPTkNBVCcsXG5cbiAgLy8gXHUyNTAwXHUyNTAwIENvbW11bmljYXRpb24gRkJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAvLyBNYXAgdG8gdGhlIGV4dGVuZGVkIEZCVHlwZSBtZW1iZXJzIGFkZGVkIGFib3ZlXG4gIFNFTkQ6ICdTRU5EJywgUkVDVjogJ1JFQ1YnLFxuICBSRFJFQzogJ1JEUkVDJywgV1JSRUM6ICdXUlJFQycsXG4gIC8vIENvbW1vbiBTaWVtZW5zIFByb2ZpbmV0IC8gSW5kdXN0cmlhbCBFdGhlcm5ldCBGQiBuYW1lc1xuICBUU0VORDogJ1NFTkQnLCBUUkNWOiAnUkVDVicsIFRDT046ICdTRU5EJywgVERJU0NPTjogJ1JFQ1YnLFxuICAnVFNFTkRfQyc6ICdTRU5EJywgJ1RSQ1ZfQyc6ICdSRUNWJyxcbiAgJ0RQUkRfREFUJzogJ1JEUkVDJywgJ0RQV1JfREFUJzogJ1dSUkVDJyxcbiAgJ0ZCNjUnOiAnU0VORCcsICdGQjY2JzogJ1JFQ1YnLFxuXG4gIC8vIFx1MjUwMFx1MjUwMCBUeXBlIGNvbnZlcnNpb24gRkJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAvLyBTaWVtZW5zIHVzZXMgQ09OVkVSVCB3aXRoIHRlbXBsYXRlIHR5cGVzOyBtYXAgZ2VuZXJpY2FsbHlcbiAgQ09OVkVSVDogJ01PVkUnLFxuICBST1VORDogJ01PVkUnLCBUUlVOQzogJ01PVkUnLCBDRUlMOiAnTU9WRScsIEZMT09SOiAnTU9WRScsXG4gIC8vIEV4cGxpY2l0IHR5cGUgY29udmVyc2lvbnNcbiAgSU5UX1RPX1JFQUw6ICdNT1ZFJywgUkVBTF9UT19JTlQ6ICdNT1ZFJywgRElOVF9UT19SRUFMOiAnTU9WRScsIFJFQUxfVE9fRElOVDogJ01PVkUnLFxuICBJTlRfVE9fRElOVDogJ01PVkUnLCBCT09MX1RPX0lOVDogJ01PVkUnLCBJTlRfVE9fQk9PTDogJ01PVkUnLFxuICBXT1JEX1RPX0lOVDogJ01PVkUnLCBJTlRfVE9fV09SRDogJ01PVkUnLCBEV09SRF9UT19ESU5UOiAnTU9WRScsIERJTlRfVE9fRFdPUkQ6ICdNT1ZFJyxcbiAgVElNRV9UT19ESU5UOiAnTU9WRScsIERJTlRfVE9fVElNRTogJ01PVkUnLFxuXG4gIC8vIFx1MjUwMFx1MjUwMCBEaWFnbm9zdGljIC8gc3lzdGVtIEZCcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgLy8gTWFwIHRvIE1PVkUgYXMgYSBzYWZlIHBsYWNlaG9sZGVyIChwcmVzZXJ2ZXMgYmxvY2sgc2hhcGUsIHZlbmRvck9yaWdpbmFsTmFtZSBzdG9yZWQpXG4gIEFMQVJNOiAnTU9WRScsIEFMQVJNXzg6ICdNT1ZFJywgQUxBUk1fOFA6ICdNT1ZFJywgTk9USUZZOiAnTU9WRScsXG4gIEFSX1NFTkQ6ICdNT1ZFJywgQkxLTU9WOiAnTU9WRScsXG4gIFJFQURfREJMOiAnUkRSRUMnLCBXUklUX0RCTDogJ1dSUkVDJyxcbn07XG5cbmZ1bmN0aW9uIG1hcFNpZW1lbnNGQlR5cGUobmFtZTogc3RyaW5nKTogRkJUeXBlIHwgbnVsbCB7XG4gIGNvbnN0IHVwcGVyID0gbmFtZS50b1VwcGVyQ2FzZSgpO1xuICBjb25zdCBtYXBwZWQgPSBTSUVNRU5TX0ZCX01BUFt1cHBlcl07XG4gIGlmIChtYXBwZWQpIHJldHVybiBtYXBwZWQ7XG4gIC8vIFVua25vd24gXHUyMDE0IHJldHVybiBudWxsIHNvIGNhbGxlciBjYW4gZGVjaWRlICh1bm1hcHBlZCB2cyBwYXNzdGhyb3VnaClcbiAgcmV0dXJuIG51bGw7XG59XG5cbi8vIFJldmVyc2UgbWFwOiBDTE0gRkJUeXBlIFx1MjE5MiBjYW5vbmljYWwgU2llbWVucyBuYW1lIGZvciBleHBvcnRcbi8vIE9ubHkgbmVlZHMgZW50cmllcyB3aGVyZSB0aGUgQ0xNIG5hbWUgZGlmZmVycyBmcm9tIHRoZSBTaWVtZW5zIG5hbWVcbmNvbnN0IENMTV9UT19TSUVNRU5TOiBQYXJ0aWFsPFJlY29yZDxGQlR5cGUsIHN0cmluZz4+ID0ge1xuICBSVFJJRzogJ1JfVFJJRycsIEZUUklHOiAnRl9UUklHJyxcbiAgVE9OUjogJ1RPTlInLCBJRUNfVElNRVI6ICdJRUNfVElNRVInLCBJRUNfTFRJTUVSOiAnSUVDX0xUSU1FUicsXG4gIElFQ19DT1VOVEVSOiAnSUVDX0NPVU5URVInLCBJRUNfTENPVU5URVI6ICdJRUNfTENPVU5URVInLCBJRUNfVEM6ICdJRUNfVEMnLFxuICBOT1JNX1g6ICdOT1JNX1gnLCBTQ0FMRV9YOiAnU0NBTEVfWCcsXG4gIFVQUEVSX0NBU0U6ICdVUFBFUl9DQVNFJywgTE9XRVJfQ0FTRTogJ0xPV0VSX0NBU0UnLFxufTtcblxuZnVuY3Rpb24gY2xtRkJUeXBlVG9TaWVtZW5zKGZiVHlwZTogRkJUeXBlKTogc3RyaW5nIHtcbiAgcmV0dXJuIENMTV9UT19TSUVNRU5TW2ZiVHlwZV0gfHwgZmJUeXBlO1xufVxuXG4vLyBSZXR1cm5zIHRoZSBtYXBwZWQgRkJUeXBlIEFORCB3aGV0aGVyIHZlbmRvck9yaWdpbmFsTmFtZSBzaG91bGQgYmUgc3RvcmVkXG4vLyAobmVlZGVkIHdoZW4gdGhlIG1hcHBpbmcgaXMgbG9zc3kgXHUyMDE0IGkuZS4gb3JpZ2luYWwgbmFtZSBkaWZmZXJzIGZyb20gQ0xNIHR5cGUgbmFtZSlcbmZ1bmN0aW9uIG1hcFNpZW1lbnNGQlR5cGVXaXRoTWV0YShuYW1lOiBzdHJpbmcpOiB7IGZiVHlwZTogRkJUeXBlOyBzdG9yZU9yaWdpbmFsOiBib29sZWFuIH0gfCBudWxsIHtcbiAgY29uc3QgZmJUeXBlID0gbWFwU2llbWVuc0ZCVHlwZShuYW1lKTtcbiAgaWYgKCFmYlR5cGUpIHJldHVybiBudWxsO1xuICAvLyBTdG9yZSBvcmlnaW5hbCB3aGVuIHRoZSBDTE0gdHlwZSBuYW1lIGRpZmZlcnMgZnJvbSB0aGUgdmVuZG9yIG5hbWVcbiAgY29uc3Qgc3RvcmVPcmlnaW5hbCA9IGZiVHlwZSAhPT0gbmFtZS50b1VwcGVyQ2FzZSgpICYmIGZiVHlwZSAhPT0gbmFtZTtcbiAgcmV0dXJuIHsgZmJUeXBlLCBzdG9yZU9yaWdpbmFsIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBGQkQgbmV0d29yayBwYXJzZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHBhcnNlTmV0d29ya3NUb0ZCRChcbiAgbmV0d29ya3M6IHVua25vd25bXSxcbiAgcG91SWQ6IHN0cmluZyxcbiAgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdLFxuICB3YXJuaW5nczogc3RyaW5nW10sXG4gIHJlc29sdmVyOiBWYXJpYWJsZVR5cGVSZXNvbHZlciA9IG5ldyBWYXJpYWJsZVR5cGVSZXNvbHZlcigpXG4pOiBGQkRQcm9ncmFtIHtcbiAgY29uc3Qgbm9kZXM6IEZCRE5vZGVbXSA9IFtdO1xuICBjb25zdCB3aXJlczogRkJEV2lyZVtdID0gW107XG4gIGxldCBub2RlSWR4ID0gMDtcblxuICBmb3IgKGNvbnN0IG5ldEVsIG9mIG5ldHdvcmtzKSB7XG4gICAgY29uc3QgYXR0ckxpc3QgPSBjaGlsZChuZXRFbCwgJ0F0dHJpYnV0ZUxpc3QnKTtcbiAgICBjb25zdCBwYXJ0c0VsID0gY2hpbGQoYXR0ckxpc3QsICdOZXR3b3JrU291cmNlJyk7XG4gICAgY29uc3QgZmxnTmV0ID0gY2hpbGQocGFydHNFbCwgJ0ZsZ05ldCcpID8/IHBhcnRzRWw7XG4gICAgY29uc3QgcGFydHNOb2RlID0gY2hpbGQoZmxnTmV0LCAnUGFydHMnKSA/PyBmbGdOZXQ7XG4gICAgY29uc3Qgd2lyZXNOb2RlID0gY2hpbGQoZmxnTmV0LCAnV2lyZXMnKTtcblxuICAgIC8vIEJ1aWxkIGEgc2V0IG9mIFVJZHMgdGhhdCBhcHBlYXIgYXMgd2lyZSB0YXJnZXRzICh1c2VkIHRvIGRldGVybWluZSBJTiB2cyBPVVQgdmFyaWFibGUpXG4gICAgY29uc3Qgd2lyZVRhcmdldFVJZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBpZiAod2lyZXNOb2RlKSB7XG4gICAgICBmb3IgKGNvbnN0IHdpcmVFbCBvZiBjaGlsZEFycmF5KHdpcmVzTm9kZSwgJ1dpcmUnKSkge1xuICAgICAgICBjb25zdCBhbGxDb25zID0gWy4uLmNoaWxkQXJyYXkod2lyZUVsLCAnTmFtZUNvbicpLCAuLi5jaGlsZEFycmF5KHdpcmVFbCwgJ0lkZW50Q29uJyldO1xuICAgICAgICAvLyBMYXN0IGNvbm5lY3RvcihzKSBvbiB0aGUgd2lyZSBhcmUgdGFyZ2V0c1xuICAgICAgICBmb3IgKGxldCB3aSA9IDE7IHdpIDwgYWxsQ29ucy5sZW5ndGg7IHdpKyspIHtcbiAgICAgICAgICBjb25zdCB0VUlkID0gYXR0cihhbGxDb25zW3dpXSwgJ1VJZCcpO1xuICAgICAgICAgIGNvbnN0IHRQaW4gPSAoYXR0cihhbGxDb25zW3dpXSwgJ05hbWUnKSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICBpZiAodFVJZCAmJiAodFBpbiA9PT0gJ2luJyB8fCB0UGluID09PSAnJyB8fCB0UGluID09PSAnaW4xJykpIHdpcmVUYXJnZXRVSWRzLmFkZCh0VUlkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFBhcnNlIGJsb2NrcyAoQ2FsbCBhbmQgUGFydCBlbGVtZW50cylcbiAgICBmb3IgKGNvbnN0IGJsb2NrRWwgb2YgY2hpbGRBcnJheShwYXJ0c05vZGUsICdDYWxsJykuY29uY2F0KGNoaWxkQXJyYXkocGFydHNOb2RlLCAnUGFydCcpKSkge1xuICAgICAgY29uc3QgdWlkID0gYXR0cihibG9ja0VsLCAnVUlkJyk7XG4gICAgICBjb25zdCBuYW1lID0gYXR0cihibG9ja0VsLCAnTmFtZScpIHx8IGF0dHIoY2hpbGQoYmxvY2tFbCwgJ0NhbGxJbmZvJyksICdOYW1lJykgfHwgJ0JMT0NLJztcbiAgICAgIG5vZGVJZHgrKztcbiAgICAgIGNvbnN0IHN5bnRoZXRpY1ggPSAobm9kZUlkeCAlIDUpICogMTQwO1xuICAgICAgY29uc3Qgc3ludGhldGljWSA9IE1hdGguZmxvb3Iobm9kZUlkeCAvIDUpICogMTAwO1xuICAgICAgY29uc3QgeCA9IE51bWJlcihhdHRyKGJsb2NrRWwsICdYJykgfHwgYXR0cihibG9ja0VsLCAneCcpKSB8fCBzeW50aGV0aWNYO1xuICAgICAgY29uc3QgeSA9IE51bWJlcihhdHRyKGJsb2NrRWwsICdZJykgfHwgYXR0cihibG9ja0VsLCAneScpKSB8fCBzeW50aGV0aWNZO1xuXG4gICAgICAvLyBCdWlsZCBjYW5vbmljYWwgdHlwZWQgcGlucyBmcm9tIHNpZ25hdHVyZTsgc3VwcGxlbWVudCB3aXRoIEFjY2VzcyBjaGlsZHJlbiBmb3IgZGlyZWN0aW9uXG4gICAgICBjb25zdCB7IGlucHV0czogc2lnSW5wdXRzLCBvdXRwdXRzOiBzaWdPdXRwdXRzIH0gPSBidWlsZFR5cGVkUGlucyhuYW1lLCBbXSwgYGZiZC0ke3VpZH1gKTtcbiAgICAgIGNvbnN0IGlucHV0czogUGluW10gPSBbLi4uc2lnSW5wdXRzXTtcbiAgICAgIGNvbnN0IG91dHB1dHM6IFBpbltdID0gWy4uLnNpZ091dHB1dHNdO1xuXG4gICAgICAvLyBPdmVycmlkZSB3aXRoIEFjY2VzcyBjaGlsZHJlbiB3aGVyZSB0aGUgWE1MIHByb3ZpZGVzIGRpcmVjdGlvbiBvdmVycmlkZXNcbiAgICAgIGZvciAoY29uc3QgYWNjRWwgb2YgY2hpbGRBcnJheShibG9ja0VsLCAnQWNjZXNzJykpIHtcbiAgICAgICAgY29uc3QgZGlyID0gYXR0cihhY2NFbCwgJ0RpcmVjdGlvbicpO1xuICAgICAgICBjb25zdCBwaW5OYW1lID0gYXR0cihhY2NFbCwgJ05hbWUnKSB8fCBwYXJzZUFjY2Vzc1RhZyhhY2NFbCk7XG4gICAgICAgIGNvbnN0IGNhbm9uaWNhbFR5cGUgPSBnZXRQaW5EYXRhVHlwZShuYW1lLCBwaW5OYW1lLCBkaXIgPT09ICdPdXQnIHx8IGRpciA9PT0gJ091dHB1dCcgPyAnb3V0cHV0JyA6ICdpbnB1dCcpO1xuICAgICAgICBpZiAoZGlyID09PSAnT3V0JyB8fCBkaXIgPT09ICdPdXRwdXQnKSB7XG4gICAgICAgICAgaWYgKCFvdXRwdXRzLmZpbmQocCA9PiBwLm5hbWUgPT09IHBpbk5hbWUpKSB7XG4gICAgICAgICAgICBvdXRwdXRzLnB1c2goeyBpZDogZ2VuSWQoJ3BpbicpLCBuYW1lOiBwaW5OYW1lLCBkYXRhVHlwZTogY2Fub25pY2FsVHlwZSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKCFpbnB1dHMuZmluZChwID0+IHAubmFtZSA9PT0gcGluTmFtZSkpIHtcbiAgICAgICAgICAgIGlucHV0cy5wdXNoKHsgaWQ6IGdlbklkKCdwaW4nKSwgbmFtZTogcGluTmFtZSwgZGF0YVR5cGU6IGNhbm9uaWNhbFR5cGUgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoaW5wdXRzLmxlbmd0aCA9PT0gMCkgaW5wdXRzLnB1c2goeyBpZDogZ2VuSWQoJ3BpbicpLCBuYW1lOiAnRU4nLCBkYXRhVHlwZTogJ0JPT0wnIH0pO1xuICAgICAgaWYgKG91dHB1dHMubGVuZ3RoID09PSAwKSBvdXRwdXRzLnB1c2goeyBpZDogZ2VuSWQoJ3BpbicpLCBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9KTtcblxuICAgICAgY29uc3QgbWFwcGVkRkJEVHlwZSA9IG1hcFNpZW1lbnNGQkRUeXBlKG5hbWUpO1xuICAgICAgY29uc3QgZmJkTm9kZTogRkJETm9kZSA9IHtcbiAgICAgICAgaWQ6IGBmYmQtJHt1aWR9YCxcbiAgICAgICAgdHlwZTogbWFwcGVkRkJEVHlwZSxcbiAgICAgICAgaW5zdGFuY2VOYW1lOiBgJHtuYW1lfV8ke3VpZH1gLFxuICAgICAgICBwb3NpdGlvbjogeyB4LCB5IH0sXG4gICAgICAgIGlucHV0cyxcbiAgICAgICAgb3V0cHV0cyxcbiAgICAgIH07XG4gICAgICBpZiAobWFwcGVkRkJEVHlwZSAhPT0gbmFtZSAmJiBtYXBwZWRGQkRUeXBlICE9PSBuYW1lLnRvVXBwZXJDYXNlKCkpIHtcbiAgICAgICAgZmJkTm9kZS52ZW5kb3JPcmlnaW5hbE5hbWUgPSBuYW1lO1xuICAgICAgfVxuICAgICAgbm9kZXMucHVzaChmYmROb2RlKTtcbiAgICB9XG5cbiAgICAvLyBQYXJzZSBBY2Nlc3MgZWxlbWVudHMgYXMgdmFyaWFibGUgbm9kZXNcbiAgICBmb3IgKGNvbnN0IGFjY0VsIG9mIGNoaWxkQXJyYXkocGFydHNOb2RlLCAnQWNjZXNzJykpIHtcbiAgICAgIGNvbnN0IHVpZCA9IGF0dHIoYWNjRWwsICdVSWQnKTtcbiAgICAgIGlmICghdWlkKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHRhZ05hbWUgPSBwYXJzZUFjY2Vzc1RhZyhhY2NFbCk7XG4gICAgICBub2RlSWR4Kys7XG4gICAgICBjb25zdCBzeW50aGV0aWNYID0gKG5vZGVJZHggJSA1KSAqIDE0MDtcbiAgICAgIGNvbnN0IHN5bnRoZXRpY1kgPSBNYXRoLmZsb29yKG5vZGVJZHggLyA1KSAqIDEwMDtcbiAgICAgIGNvbnN0IHggPSBOdW1iZXIoYXR0cihhY2NFbCwgJ1gnKSB8fCBhdHRyKGFjY0VsLCAneCcpKSB8fCBzeW50aGV0aWNYO1xuICAgICAgY29uc3QgeSA9IE51bWJlcihhdHRyKGFjY0VsLCAnWScpIHx8IGF0dHIoYWNjRWwsICd5JykpIHx8IHN5bnRoZXRpY1k7XG4gICAgICBjb25zdCBpc0lucHV0ID0gd2lyZVRhcmdldFVJZHMuaGFzKHVpZCk7XG4gICAgICBjb25zdCBhY2Nlc3NUeXBlID0gcmVzb2x2ZXIucmVzb2x2ZSh0YWdOYW1lKTtcbiAgICAgIG5vZGVzLnB1c2goe1xuICAgICAgICBpZDogYGZiZC0ke3VpZH1gLFxuICAgICAgICB0eXBlOiBpc0lucHV0ID8gJ0lOX1ZBUklBQkxFJyA6ICdPVVRfVkFSSUFCTEUnLFxuICAgICAgICB0YWc6IHsgbmFtZTogdGFnTmFtZSwgZGF0YVR5cGU6IGFjY2Vzc1R5cGUgfSxcbiAgICAgICAgcG9zaXRpb246IHsgeCwgeSB9LFxuICAgICAgICBpbnB1dHM6IGlzSW5wdXQgPyBbXSA6IFt7IGlkOiBnZW5JZCgncGluJyksIG5hbWU6ICdJTicsIGRhdGFUeXBlOiBhY2Nlc3NUeXBlIH1dLFxuICAgICAgICBvdXRwdXRzOiBpc0lucHV0ID8gW3sgaWQ6IGdlbklkKCdwaW4nKSwgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiBhY2Nlc3NUeXBlIH1dIDogW10sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBQYXJzZSB3aXJlc1xuICAgIGlmICh3aXJlc05vZGUpIHtcbiAgICAgIGZvciAoY29uc3Qgd2lyZUVsIG9mIGNoaWxkQXJyYXkod2lyZXNOb2RlLCAnV2lyZScpKSB7XG4gICAgICAgIGNvbnN0IG5hbWVDb25zID0gY2hpbGRBcnJheSh3aXJlRWwsICdOYW1lQ29uJyk7XG4gICAgICAgIGNvbnN0IGlkZW50Q29ucyA9IGNoaWxkQXJyYXkod2lyZUVsLCAnSWRlbnRDb24nKTtcbiAgICAgICAgY29uc3QgYWxsQ29ucyA9IFsuLi5uYW1lQ29ucywgLi4uaWRlbnRDb25zXTtcblxuICAgICAgICBpZiAoYWxsQ29ucy5sZW5ndGggPj0gMikge1xuICAgICAgICAgIGNvbnN0IGZyb21FbCA9IGFsbENvbnNbMF07XG4gICAgICAgICAgY29uc3QgdG9FbCA9IGFsbENvbnNbMV07XG4gICAgICAgICAgY29uc3QgZnJvbVVJZCA9IGF0dHIoZnJvbUVsLCAnVUlkJykgfHwgJyc7XG4gICAgICAgICAgY29uc3QgdG9VSWQgPSBhdHRyKHRvRWwsICdVSWQnKSB8fCAnJztcbiAgICAgICAgICBjb25zdCBmcm9tUGluID0gYXR0cihmcm9tRWwsICdOYW1lJykgfHwgJ09VVCc7XG4gICAgICAgICAgY29uc3QgdG9QaW4gPSBhdHRyKHRvRWwsICdOYW1lJykgfHwgJ0lOJztcblxuICAgICAgICAgIGlmIChmcm9tVUlkICYmIHRvVUlkKSB7XG4gICAgICAgICAgICB3aXJlcy5wdXNoKHtcbiAgICAgICAgICAgICAgaWQ6IGdlbklkKCd3aXJlJyksXG4gICAgICAgICAgICAgIGZyb206IHsgbm9kZUlkOiBgZmJkLSR7ZnJvbVVJZH1gLCBwaW46IGZyb21QaW4gfSxcbiAgICAgICAgICAgICAgdG86IHsgbm9kZUlkOiBgZmJkLSR7dG9VSWR9YCwgcGluOiB0b1BpbiB9LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQWRkaXRpb25hbCBjb25uZWN0aW9ucyBvbiBzYW1lIHdpcmUgKGZhbi1vdXQpXG4gICAgICAgICAgZm9yIChsZXQgd2kgPSAyOyB3aSA8IGFsbENvbnMubGVuZ3RoOyB3aSsrKSB7XG4gICAgICAgICAgICBjb25zdCBleHRyYVVJZCA9IGF0dHIoYWxsQ29uc1t3aV0sICdVSWQnKSB8fCAnJztcbiAgICAgICAgICAgIGNvbnN0IGV4dHJhUGluID0gYXR0cihhbGxDb25zW3dpXSwgJ05hbWUnKSB8fCAnSU4nO1xuICAgICAgICAgICAgaWYgKGZyb21VSWQgJiYgZXh0cmFVSWQpIHtcbiAgICAgICAgICAgICAgd2lyZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgaWQ6IGdlbklkKCd3aXJlJyksXG4gICAgICAgICAgICAgICAgZnJvbTogeyBub2RlSWQ6IGBmYmQtJHtmcm9tVUlkfWAsIHBpbjogZnJvbVBpbiB9LFxuICAgICAgICAgICAgICAgIHRvOiB7IG5vZGVJZDogYGZiZC0ke2V4dHJhVUlkfWAsIHBpbjogZXh0cmFQaW4gfSxcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgbm9kZXMsIHdpcmVzIH07XG59XG5cbmZ1bmN0aW9uIG1hcFNpZW1lbnNGQkRUeXBlKG5hbWU6IHN0cmluZyk6IEZCREJsb2NrVHlwZSB7XG4gIGNvbnN0IHVwcGVyID0gbmFtZS50b1VwcGVyQ2FzZSgpO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBCb29sZWFuIGdhdGVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBjb25zdCBCT09MX0dBVEVTOiBSZWNvcmQ8c3RyaW5nLCBGQkRCbG9ja1R5cGU+ID0ge1xuICAgIEFORDogJ0FORCcsIE9SOiAnT1InLCBOT1Q6ICdOT1QnLCBYT1I6ICdYT1InLCBOQU5EOiAnTkFORCcsIE5PUjogJ05PUicsXG4gIH07XG4gIGlmIChCT09MX0dBVEVTW3VwcGVyXSkgcmV0dXJuIEJPT0xfR0FURVNbdXBwZXJdO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBTdGFuZGFyZCBJRUMgdGltZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBjb25zdCBUSU1FUlM6IFJlY29yZDxzdHJpbmcsIEZCREJsb2NrVHlwZT4gPSB7XG4gICAgVE9OOiAnVE9OJywgVE9GOiAnVE9GJywgVFA6ICdUUCcsXG4gICAgVE9OUjogJ1RPTlInLFxuICAgIElFQ19USU1FUjogJ0lFQ19USU1FUicsIElFQ19MVElNRVI6ICdJRUNfTFRJTUVSJyxcbiAgICBTRkIzOiAnVE9OJywgU0ZCNDogJ1RPRicsIFNGQjU6ICdUUCcsXG4gICAgSUVDX1RDOiAnSUVDX1RDJyxcbiAgfTtcbiAgaWYgKFRJTUVSU1t1cHBlcl0pIHJldHVybiBUSU1FUlNbdXBwZXJdO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBTdGFuZGFyZCBJRUMgY291bnRlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvbnN0IENPVU5URVJTOiBSZWNvcmQ8c3RyaW5nLCBGQkRCbG9ja1R5cGU+ID0ge1xuICAgIENUVTogJ0NUVScsIENURDogJ0NURCcsIENUVUQ6ICdDVFVEJyxcbiAgICBJRUNfQ09VTlRFUjogJ0lFQ19DT1VOVEVSJywgSUVDX0xDT1VOVEVSOiAnSUVDX0xDT1VOVEVSJyxcbiAgfTtcbiAgaWYgKENPVU5URVJTW3VwcGVyXSkgcmV0dXJuIENPVU5URVJTW3VwcGVyXTtcblxuICAvLyBcdTI1MDBcdTI1MDAgQmlzdGFibGUgLyBlZGdlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBjb25zdCBCSVNUQUJMRTogUmVjb3JkPHN0cmluZywgRkJEQmxvY2tUeXBlPiA9IHtcbiAgICBTUjogJ1NSJywgUlM6ICdSUycsXG4gICAgUl9UUklHOiAnUlRSSUcnLCBGX1RSSUc6ICdGVFJJRycsIFJUUklHOiAnUlRSSUcnLCBGVFJJRzogJ0ZUUklHJyxcbiAgfTtcbiAgaWYgKEJJU1RBQkxFW3VwcGVyXSkgcmV0dXJuIEJJU1RBQkxFW3VwcGVyXTtcblxuICAvLyBcdTI1MDBcdTI1MDAgQXJpdGhtZXRpYyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgY29uc3QgQVJJVEg6IFJlY29yZDxzdHJpbmcsIEZCREJsb2NrVHlwZT4gPSB7XG4gICAgQUREOiAnQUREJywgU1VCOiAnU1VCJywgTVVMOiAnTVVMJywgRElWOiAnRElWJywgTU9EOiAnTU9EJyxcbiAgICBBQlM6ICdBQlMnLCBTUVJUOiAnU1FSVCcsIE5FRzogJ05FRycsXG4gICAgTE46ICdMTicsIExPRzogJ0xPRycsIEVYUDogJ0VYUCcsXG4gICAgU0lOOiAnU0lOJywgQ09TOiAnQ09TJywgVEFOOiAnVEFOJyxcbiAgICBBU0lOOiAnQVNJTicsIEFDT1M6ICdBQ09TJywgQVRBTjogJ0FUQU4nLFxuICAgIEFUTjogJ0FUQU4nLCBBU046ICdBU0lOJywgQUNTOiAnQUNPUycsXG4gIH07XG4gIGlmIChBUklUSFt1cHBlcl0pIHJldHVybiBBUklUSFt1cHBlcl07XG5cbiAgLy8gXHUyNTAwXHUyNTAwIENvbXBhcmlzb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvbnN0IENNUDogUmVjb3JkPHN0cmluZywgRkJEQmxvY2tUeXBlPiA9IHtcbiAgICBHVDogJ0dUJywgR0U6ICdHRScsIExUOiAnTFQnLCBMRTogJ0xFJywgRVE6ICdFUScsIE5FOiAnTkUnLFxuICB9O1xuICBpZiAoQ01QW3VwcGVyXSkgcmV0dXJuIENNUFt1cHBlcl07XG5cbiAgLy8gXHUyNTAwXHUyNTAwIERhdGEgLyBzZWxlY3Rpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvbnN0IERBVEE6IFJlY29yZDxzdHJpbmcsIEZCREJsb2NrVHlwZT4gPSB7XG4gICAgTU9WRTogJ01PVkUnLCBTRUw6ICdTRUwnLCBNVVg6ICdNVVgnLCBMSU1JVDogJ0xJTUlUJywgTUlOOiAnTUlOJywgTUFYOiAnTUFYJyxcbiAgICBCTElOSzogJ0JMSU5LJyxcbiAgfTtcbiAgaWYgKERBVEFbdXBwZXJdKSByZXR1cm4gREFUQVt1cHBlcl07XG5cbiAgLy8gXHUyNTAwXHUyNTAwIEFuYWxvZyBzY2FsaW5nIC8gbm9ybWFsaXNhdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgY29uc3QgU0NBTEU6IFJlY29yZDxzdHJpbmcsIEZCREJsb2NrVHlwZT4gPSB7XG4gICAgU0NBTEU6ICdTQ0FMRScsIFVOU0NBTEU6ICdVTlNDQUxFJywgTk9STV9YOiAnTk9STV9YJywgU0NBTEVfWDogJ1NDQUxFX1gnLFxuICAgIEZDMTA1OiAnU0NBTEUnLCBGQzEwNjogJ1VOU0NBTEUnLFxuICB9O1xuICBpZiAoU0NBTEVbdXBwZXJdKSByZXR1cm4gU0NBTEVbdXBwZXJdO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBTdHJpbmcgZnVuY3Rpb25zIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBjb25zdCBTVFJGTlM6IFJlY29yZDxzdHJpbmcsIEZCREJsb2NrVHlwZT4gPSB7XG4gICAgTEVOOiAnTEVOJywgTEVGVDogJ0xFRlQnLCBSSUdIVDogJ1JJR0hUJywgTUlEOiAnTUlEJyxcbiAgICBDT05DQVQ6ICdDT05DQVQnLCBGSU5EOiAnRklORCcsIElOU0VSVDogJ0lOU0VSVCcsIERFTEVURTogJ0RFTEVURScsIFJFUExBQ0U6ICdSRVBMQUNFJyxcbiAgICBVUFBFUl9DQVNFOiAnVVBQRVJfQ0FTRScsIExPV0VSX0NBU0U6ICdMT1dFUl9DQVNFJyxcbiAgICBTX0xFTjogJ1NfTEVOJywgU19MRUZUOiAnU19MRUZUJywgU19SSUdIVDogJ1NfUklHSFQnLCBTX01JRDogJ1NfTUlEJyxcbiAgICBTX0ZJTkQ6ICdTX0ZJTkQnLCBTX0NPTlY6ICdTX0NPTlYnLCBTX0NPTkNBVDogJ1NfQ09OQ0FUJyxcbiAgfTtcbiAgaWYgKFNUUkZOU1t1cHBlcl0pIHJldHVybiBTVFJGTlNbdXBwZXJdO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBUeXBlIGNvbnZlcnNpb25zIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBjb25zdCBDT05WOiBSZWNvcmQ8c3RyaW5nLCBGQkRCbG9ja1R5cGU+ID0ge1xuICAgIENPTlZFUlQ6ICdDT05WRVJUJywgUk9VTkQ6ICdST1VORCcsIFRSVU5DOiAnVFJVTkMnLCBDRUlMOiAnQ0VJTCcsIEZMT09SOiAnRkxPT1InLFxuICAgIElOVF9UT19SRUFMOiAnSU5UX1RPX1JFQUwnLCBSRUFMX1RPX0lOVDogJ1JFQUxfVE9fSU5UJyxcbiAgICBESU5UX1RPX1JFQUw6ICdESU5UX1RPX1JFQUwnLCBSRUFMX1RPX0RJTlQ6ICdSRUFMX1RPX0RJTlQnLFxuICAgIElOVF9UT19ESU5UOiAnSU5UX1RPX0RJTlQnLCBCT09MX1RPX0lOVDogJ0JPT0xfVE9fSU5UJywgSU5UX1RPX0JPT0w6ICdJTlRfVE9fQk9PTCcsXG4gICAgV09SRF9UT19JTlQ6ICdXT1JEX1RPX0lOVCcsIElOVF9UT19XT1JEOiAnSU5UX1RPX1dPUkQnLFxuICAgIERXT1JEX1RPX0RJTlQ6ICdEV09SRF9UT19ESU5UJywgRElOVF9UT19EV09SRDogJ0RJTlRfVE9fRFdPUkQnLFxuICAgIFRJTUVfVE9fRElOVDogJ1RJTUVfVE9fRElOVCcsIERJTlRfVE9fVElNRTogJ0RJTlRfVE9fVElNRScsXG4gIH07XG4gIGlmIChDT05WW3VwcGVyXSkgcmV0dXJuIENPTlZbdXBwZXJdO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBDb21tdW5pY2F0aW9uIEZCcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgY29uc3QgQ09NTVM6IFJlY29yZDxzdHJpbmcsIEZCREJsb2NrVHlwZT4gPSB7XG4gICAgU0VORDogJ1NFTkQnLCBSRUNWOiAnUkVDVicsIFJEUkVDOiAnUkRSRUMnLCBXUlJFQzogJ1dSUkVDJyxcbiAgICBUU0VORDogJ1NFTkQnLCBUUkNWOiAnUkVDVicsIFRDT046ICdTRU5EJywgVERJU0NPTjogJ1JFQ1YnLFxuICAgIFRTRU5EX0M6ICdTRU5EJywgVFJDVl9DOiAnUkVDVicsXG4gICAgRFBSRF9EQVQ6ICdSRFJFQycsIERQV1JfREFUOiAnV1JSRUMnLFxuICAgIEZCNjU6ICdTRU5EJywgRkI2NjogJ1JFQ1YnLFxuICB9O1xuICBpZiAoQ09NTVNbdXBwZXJdKSByZXR1cm4gQ09NTVNbdXBwZXJdO1xuXG4gIC8vIFVua25vd24gXHUyMDE0IHVzZSBNT1ZFIGFzIGEgc2FmZSBwbGFjZWhvbGRlciAoc2hhcGUgaXMgcHJlc2VydmVkLCBvcmlnaW5hbCBuYW1lIGluIHZlbmRvck9yaWdpbmFsTmFtZSlcbiAgcmV0dXJuICdNT1ZFJztcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEdSQVBIIChTRkMpIHBhcnNlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gcGFyc2VOZXR3b3Jrc1RvU0ZDKFxuICBuZXR3b3JrczogdW5rbm93bltdLFxuICBwb3VJZDogc3RyaW5nLFxuICB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10sXG4gIHdhcm5pbmdzOiBzdHJpbmdbXVxuKTogU0ZDUHJvZ3JhbSB7XG4gIGNvbnN0IHN0ZXBzOiBTRkNTdGVwW10gPSBbXTtcbiAgY29uc3QgdHJhbnNpdGlvbnM6IFNGQ1RyYW5zaXRpb25bXSA9IFtdO1xuICBjb25zdCBsaW5rczogU0ZDTGlua1tdID0gW107XG4gIGNvbnN0IGp1bXBzOiBTRkNKdW1wW10gPSBbXTtcblxuICAvLyBUcmFja3MgYWxsIHN0ZXAvdHJhbnNpdGlvbiBOdW1iZXJzIHNlZW4sIGZvciBqdW1wLXRhcmdldCByZXNvbHV0aW9uXG4gIGNvbnN0IHN0ZXBOdW1TZXQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgY29uc3QgdHJhbnNOdW1TZXQgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICAvLyBCcmFuY2ggbWV0YWRhdGE6IE51bWJlciBcdTIxOTIgeyB0eXBlLCBjYXJkaW5hbGl0eSB9XG4gIGludGVyZmFjZSBCcmFuY2hNZXRhIHsgdHlwZTogJ0FsdEJlZ2luJyB8ICdBbHRFbmQnIHwgJ1NpbUJlZ2luJyB8ICdTaW1FbmQnOyBjYXJkaW5hbGl0eTogbnVtYmVyOyB9XG4gIGNvbnN0IGJyYW5jaE1hcCA9IG5ldyBNYXA8c3RyaW5nLCBCcmFuY2hNZXRhPigpO1xuXG4gIGZvciAoY29uc3QgbmV0RWwgb2YgbmV0d29ya3MpIHtcbiAgICBjb25zdCBhdHRyTGlzdCA9IGNoaWxkKG5ldEVsLCAnQXR0cmlidXRlTGlzdCcpO1xuICAgIGNvbnN0IHBhcnRzRWwgPSBjaGlsZChhdHRyTGlzdCwgJ05ldHdvcmtTb3VyY2UnKTtcbiAgICAvLyBSZWFsIFRJQSBQb3J0YWwgR1JBUEg6IE5ldHdvcmtTb3VyY2UvR3JhcGgvU2VxdWVuY2VcbiAgICBjb25zdCBncmFwaEVsID0gY2hpbGQocGFydHNFbCwgJ0dyYXBoJyk7XG4gICAgY29uc3Qgc2VxdWVuY2VFbCA9IGdyYXBoRWwgPyBjaGlsZChncmFwaEVsLCAnU2VxdWVuY2UnKSA6IG51bGw7XG4gICAgLy8gRmFsbGJhY2sgdG8gb2xkIEZsZ05ldC1zdHlsZSBpZiBubyBHcmFwaCBlbGVtZW50XG4gICAgY29uc3Qgc2VxT3JOZXQgPSBzZXF1ZW5jZUVsID8/IGNoaWxkKHBhcnRzRWwsICdGbGdOZXQnKSA/PyBwYXJ0c0VsO1xuXG4gICAgY29uc3Qgc3RlcHNFbCAgICAgPSBjaGlsZChzZXFPck5ldCwgJ1N0ZXBzJyk7XG4gICAgY29uc3QgdHJhbnNpdGlvbnNFbCA9IGNoaWxkKHNlcU9yTmV0LCAnVHJhbnNpdGlvbnMnKTtcbiAgICBjb25zdCBicmFuY2hlc0VsICA9IGNoaWxkKHNlcU9yTmV0LCAnQnJhbmNoZXMnKTtcbiAgICBjb25zdCBjb25uZWN0aW9uc0VsID0gY2hpbGQoc2VxT3JOZXQsICdDb25uZWN0aW9ucycpO1xuXG4gICAgY29uc3QgdmFsaWRRdWFsaWZpZXJzOiBBY3Rpb25RdWFsaWZpZXJbXSA9IFsnTicsICdTJywgJ1InLCAnUCcsICdQMScsICdQMCcsICdMJywgJ0QnLCAnU0QnLCAnRFMnLCAnU0wnXTtcblxuICAgIC8vIFN0ZXBzXG4gICAgZm9yIChjb25zdCBzdGVwRWwgb2YgY2hpbGRBcnJheShzdGVwc0VsID8/IHNlcU9yTmV0LCAnU3RlcCcpKSB7XG4gICAgICBjb25zdCBudW0gPSBhdHRyKHN0ZXBFbCwgJ051bWJlcicpIHx8IGF0dHIoc3RlcEVsLCAnVUlkJykgfHwgJyc7XG4gICAgICBjb25zdCBuYW1lID0gYXR0cihzdGVwRWwsICdOYW1lJykgfHwgYFMke251bX1gO1xuICAgICAgY29uc3QgaXNJbml0aWFsID0gYXR0cihzdGVwRWwsICdJbml0JykgPT09ICd0cnVlJyB8fCBhdHRyKHN0ZXBFbCwgJ0luaXRpYWxTdGVwJykgPT09ICd0cnVlJztcbiAgICAgIHN0ZXBOdW1TZXQuYWRkKG51bSk7XG5cbiAgICAgIGNvbnN0IGFjdGlvbnM6IFNGQ0FjdGlvbltdID0gW107XG4gICAgICAvLyBGaXggOTogbG9vayBmb3IgQWN0aW9uIGVsZW1lbnRzIGluc2lkZSBBY3Rpb25zIHdyYXBwZXIgZmlyc3QsIHRoZW4gZGlyZWN0bHkgb24gc3RlcFxuICAgICAgY29uc3QgYWN0aW9uc0NvbnRhaW5lciA9IGNoaWxkKHN0ZXBFbCwgJ0FjdGlvbnMnKSA/PyBzdGVwRWw7XG4gICAgICAvLyBSZWFsIFRJQSBHUkFQSDogQWN0aW9ucyBjb250YWlucyA8VGl0bGU+PE11bHRpTGFuZ3VhZ2VUZXh0Li4uLz48L1RpdGxlPlxuICAgICAgLy8gYW5kIHN0ZXAgYm9keSBhY3Rpb25zIGFyZSBpbiBTdXBlcnZpc2lvbnMvSW50ZXJsb2NrcyB3aXRoIEZsZ05ldFxuICAgICAgY29uc3QgYWN0aW9uc1RpdGxlRWwgPSBjaGlsZChhY3Rpb25zQ29udGFpbmVyLCAnVGl0bGUnKTtcbiAgICAgIGlmIChhY3Rpb25zVGl0bGVFbCkge1xuICAgICAgICAvLyBFeHRyYWN0IGFjdGlvbiB0aXRsZSBhcyBhIG5hbWVkIGFjdGlvbiB3aXRoIE4gcXVhbGlmaWVyXG4gICAgICAgIGNvbnN0IG1sVGV4dHMgPSBjaGlsZEFycmF5KGFjdGlvbnNUaXRsZUVsLCAnTXVsdGlMYW5ndWFnZVRleHQnKTtcbiAgICAgICAgY29uc3QgdGl0bGVUZXh0ID0gbWxUZXh0cy5sZW5ndGggPiAwXG4gICAgICAgICAgPyAoYXR0cihtbFRleHRzWzBdLCAnTGFuZycpPy5zdGFydHNXaXRoKCdlbicpID8gdGV4dChtbFRleHRzWzBdKSA6IHRleHQobWxUZXh0c1swXSkpIHx8ICcnXG4gICAgICAgICAgOiB0ZXh0KGFjdGlvbnNUaXRsZUVsKSB8fCAnJztcbiAgICAgICAgaWYgKHRpdGxlVGV4dCkge1xuICAgICAgICAgIGFjdGlvbnMucHVzaCh7XG4gICAgICAgICAgICBpZDogZ2VuSWQoYGFjdGlvbi0ke251bX1gKSxcbiAgICAgICAgICAgIHF1YWxpZmllcjogJ04nIGFzIEFjdGlvblF1YWxpZmllcixcbiAgICAgICAgICAgIHRhZzogeyBuYW1lOiB0aXRsZVRleHQsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gQWxzbyBoYW5kbGUgSUVDLXN0eWxlIDxBY3Rpb24gUXVhbGlmaWVyPVwiTlwiIE5hbWU9XCIuLi5cIi8+IGVsZW1lbnRzXG4gICAgICBmb3IgKGNvbnN0IGFjdGlvbkVsIG9mIGNoaWxkQXJyYXkoYWN0aW9uc0NvbnRhaW5lciwgJ0FjdGlvbicpKSB7XG4gICAgICAgIGNvbnN0IHF1YWxpZmllciA9IChhdHRyKGFjdGlvbkVsLCAnUXVhbGlmaWVyJykgfHwgJ04nKS50b1VwcGVyQ2FzZSgpIGFzIEFjdGlvblF1YWxpZmllcjtcbiAgICAgICAgY29uc3QgYWN0aW9uTmFtZSA9IGF0dHIoYWN0aW9uRWwsICdOYW1lJykgfHwgdGV4dChjaGlsZChhY3Rpb25FbCwgJ05hbWUnKSkgfHwgJyc7XG4gICAgICAgIGNvbnN0IGR1cmF0aW9uID0gYXR0cihhY3Rpb25FbCwgJ0R1cmF0aW9uJykgfHwgdW5kZWZpbmVkO1xuICAgICAgICBpZiAoYWN0aW9uTmFtZSkge1xuICAgICAgICAgIGFjdGlvbnMucHVzaCh7XG4gICAgICAgICAgICBpZDogZ2VuSWQoYGFjdGlvbi0ke251bX1gKSxcbiAgICAgICAgICAgIHF1YWxpZmllcjogdmFsaWRRdWFsaWZpZXJzLmluY2x1ZGVzKHF1YWxpZmllcikgPyBxdWFsaWZpZXIgOiAnTicsXG4gICAgICAgICAgICB0YWc6IHsgbmFtZTogYWN0aW9uTmFtZSwgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgICAgICAgZHVyYXRpb24sXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgc3RlcHMucHVzaCh7XG4gICAgICAgIGlkOiBgc2llbWVucy1zdGVwLSR7bnVtfWAsXG4gICAgICAgIG5hbWUsXG4gICAgICAgIGlzSW5pdGlhbCxcbiAgICAgICAgYWN0aW9ucyxcbiAgICAgICAgcG9zaXRpb246IHsgeDogMCwgeTogMCB9LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gVHJhbnNpdGlvbnMgXHUyMDE0IGNvbmRpdGlvbiBpcyBlaXRoZXI6XG4gICAgLy8gMS4gSW5saW5lIDxGbGdOZXQ+IChyZWFsIFRJQSBHUkFQSCB0cmFuc2l0aW9ucyBoYXZlIExBRC9GQkQgY29uZGl0aW9ucylcbiAgICAvLyAyLiA8Q29uZGl0aW9uPiB0ZXh0IGNoaWxkXG4gICAgLy8gMy4gTmFtZSBhdHRyaWJ1dGUgYXMgZmFsbGJhY2tcbiAgICBmb3IgKGNvbnN0IHRyYW5zRWwgb2YgY2hpbGRBcnJheSh0cmFuc2l0aW9uc0VsID8/IHNlcU9yTmV0LCAnVHJhbnNpdGlvbicpKSB7XG4gICAgICBjb25zdCBudW0gPSBhdHRyKHRyYW5zRWwsICdOdW1iZXInKSB8fCBhdHRyKHRyYW5zRWwsICdVSWQnKSB8fCAnJztcbiAgICAgIGNvbnN0IG5hbWUgPSBhdHRyKHRyYW5zRWwsICdOYW1lJykgfHwgYFQke251bX1gO1xuICAgICAgY29uc3QgcHJvZ0xhbmcgPSBhdHRyKHRyYW5zRWwsICdQcm9ncmFtbWluZ0xhbmd1YWdlJykgfHwgJyc7XG4gICAgICB0cmFuc051bVNldC5hZGQobnVtKTtcblxuICAgICAgLy8gVHJ5IGlubGluZSBGbGdOZXQgZmlyc3QgKHJlYWwgVElBIEdSQVBIIGZvcm1hdClcbiAgICAgIGNvbnN0IGZsZ05ldEVsID0gY2hpbGQodHJhbnNFbCwgJ0ZsZ05ldCcpO1xuICAgICAgbGV0IGNvbmRpdGlvbiA9IG5hbWU7XG4gICAgICBpZiAoZmxnTmV0RWwpIHtcbiAgICAgICAgLy8gRXh0cmFjdCBBY2Nlc3MvdmFyaWFibGUgbmFtZXMgZnJvbSB0aGUgRmxnTmV0IGFzIGEgc2ltcGxlIHRleHQgY29uZGl0aW9uXG4gICAgICAgIGNvbnN0IGZsZ1BhcnRzID0gY2hpbGQoZmxnTmV0RWwsICdQYXJ0cycpO1xuICAgICAgICBjb25zdCBhY2Nlc3NFbHMgPSBjaGlsZEFycmF5KGZsZ1BhcnRzLCAnQWNjZXNzJyk7XG4gICAgICAgIGlmIChhY2Nlc3NFbHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGNvbmRpdGlvbiA9IGFjY2Vzc0Vscy5tYXAoYSA9PiBwYXJzZUFjY2Vzc1RhZyhhKSkuZmlsdGVyKHQgPT4gdCAhPT0gJ1VOS05PV05fVEFHJykuam9pbignIEFORCAnKSB8fCBuYW1lO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEZsZ05ldCB3aXRoIG9ubHkgUGFydHMgbGlrZSBUckNvaWwgKGFsd2F5cy10cnVlIHRyYW5zaXRpb24pXG4gICAgICAgICAgY29uZGl0aW9uID0gJ1RSVUUnO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBjb25kaXRpb25FbCA9IGNoaWxkKHRyYW5zRWwsICdDb25kaXRpb24nKTtcbiAgICAgICAgaWYgKGNvbmRpdGlvbkVsKSB7XG4gICAgICAgICAgY29uZGl0aW9uID0gdGV4dChjb25kaXRpb25FbCkgfHwgJ1RSVUUnO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRyYW5zaXRpb25zLnB1c2goe1xuICAgICAgICBpZDogYHNpZW1lbnMtdHJhbnMtJHtudW19YCxcbiAgICAgICAgY29uZGl0aW9uLFxuICAgICAgICBwb3NpdGlvbjogeyB4OiAwLCB5OiAwIH0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBCcmFuY2hlcyBcdTIwMTQgQWx0QmVnaW4vQWx0RW5kID0gc2VsZWN0aW9uIChPUiksIFNpbUJlZ2luL1NpbUVuZCA9IHNpbXVsdGFuZW91cyAoQU5EKVxuICAgIGZvciAoY29uc3QgYnJhbmNoRWwgb2YgY2hpbGRBcnJheShicmFuY2hlc0VsID8/IHNlcU9yTmV0LCAnQnJhbmNoJykpIHtcbiAgICAgIGNvbnN0IG51bSA9IGF0dHIoYnJhbmNoRWwsICdOdW1iZXInKSB8fCAnJztcbiAgICAgIGNvbnN0IHR5cGUgPSAoYXR0cihicmFuY2hFbCwgJ1R5cGUnKSB8fCAnQWx0QmVnaW4nKSBhcyBCcmFuY2hNZXRhWyd0eXBlJ107XG4gICAgICBjb25zdCBjYXJkaW5hbGl0eSA9IE51bWJlcihhdHRyKGJyYW5jaEVsLCAnQ2FyZGluYWxpdHknKSB8fCAnMicpO1xuICAgICAgYnJhbmNoTWFwLnNldChudW0sIHsgdHlwZSwgY2FyZGluYWxpdHkgfSk7XG4gICAgfVxuXG4gICAgLy8gQ29ubmVjdGlvbnMgXHUyMDE0IE5vZGVGcm9tL05vZGVUbyBlYWNoIGNvbnRhaW4gU3RlcFJlZiwgVHJhbnNpdGlvblJlZiwgb3IgQnJhbmNoUmVmXG4gICAgY29uc3QgcmVzb2x2ZU5vZGUgPSAobm9kZUVsOiB1bmtub3duKTogeyBpZDogc3RyaW5nOyBicmFuY2hOdW0/OiBzdHJpbmc7IGJyYW5jaFBvcnQ/OiBudW1iZXI7IGlzRW5kPzogYm9vbGVhbiB9IHwgbnVsbCA9PiB7XG4gICAgICBpZiAoIW5vZGVFbCkgcmV0dXJuIG51bGw7XG4gICAgICBjb25zdCBzdGVwUmVmID0gY2hpbGQobm9kZUVsLCAnU3RlcFJlZicpO1xuICAgICAgY29uc3QgdHJhbnNSZWYgPSBjaGlsZChub2RlRWwsICdUcmFuc2l0aW9uUmVmJyk7XG4gICAgICBjb25zdCBicmFuY2hSZWYgPSBjaGlsZChub2RlRWwsICdCcmFuY2hSZWYnKTtcbiAgICAgIGNvbnN0IGVuZENvbm4gPSBjaGlsZChub2RlRWwsICdFbmRDb25uZWN0aW9uJyk7XG4gICAgICBpZiAoc3RlcFJlZikgcmV0dXJuIHsgaWQ6IGBzaWVtZW5zLXN0ZXAtJHthdHRyKHN0ZXBSZWYsICdOdW1iZXInKX1gIH07XG4gICAgICBpZiAodHJhbnNSZWYpIHJldHVybiB7IGlkOiBgc2llbWVucy10cmFucy0ke2F0dHIodHJhbnNSZWYsICdOdW1iZXInKX1gIH07XG4gICAgICBpZiAoYnJhbmNoUmVmKSB7XG4gICAgICAgIGNvbnN0IG51bSA9IGF0dHIoYnJhbmNoUmVmLCAnTnVtYmVyJykgfHwgJyc7XG4gICAgICAgIGNvbnN0IGluUG9ydCA9IGF0dHIoYnJhbmNoUmVmLCAnSW4nKTtcbiAgICAgICAgY29uc3Qgb3V0UG9ydCA9IGF0dHIoYnJhbmNoUmVmLCAnT3V0Jyk7XG4gICAgICAgIGNvbnN0IHBvcnQgPSBpblBvcnQgIT09ICcnID8gTnVtYmVyKGluUG9ydCkgOiBOdW1iZXIob3V0UG9ydCB8fCAnMCcpO1xuICAgICAgICByZXR1cm4geyBpZDogYHNpZW1lbnMtYnJhbmNoLSR7bnVtfWAsIGJyYW5jaE51bTogbnVtLCBicmFuY2hQb3J0OiBwb3J0IH07XG4gICAgICB9XG4gICAgICBpZiAoZW5kQ29ubiAhPT0gdW5kZWZpbmVkICYmIGVuZENvbm4gIT09IG51bGwpIHJldHVybiB7IGlkOiAnc2llbWVucy1lbmQnLCBpc0VuZDogdHJ1ZSB9O1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfTtcblxuICAgIGZvciAoY29uc3QgY29ubkVsIG9mIGNoaWxkQXJyYXkoY29ubmVjdGlvbnNFbCA/PyBzZXFPck5ldCwgJ0Nvbm5lY3Rpb24nKSkge1xuICAgICAgY29uc3QgbGlua1R5cGVBdHRyID0gdGV4dChjaGlsZChjb25uRWwsICdMaW5rVHlwZScpKSB8fCAnRGlyZWN0JztcbiAgICAgIGNvbnN0IGZyb21Ob2RlID0gcmVzb2x2ZU5vZGUoY2hpbGQoY29ubkVsLCAnTm9kZUZyb20nKSk7XG4gICAgICBjb25zdCB0b05vZGUgICA9IHJlc29sdmVOb2RlKGNoaWxkKGNvbm5FbCwgJ05vZGVUbycpKTtcbiAgICAgIGlmICghZnJvbU5vZGUgfHwgIXRvTm9kZSkgY29udGludWU7XG5cbiAgICAgIC8vIENsYXNzaWZ5IGxpbmsgdHlwZSBiYXNlZCBvbiBicmFuY2ggaW52b2x2ZW1lbnRcbiAgICAgIGxldCBmcm9tSWQgPSBmcm9tTm9kZS5pZDtcbiAgICAgIGxldCB0b0lkICAgPSB0b05vZGUuaWQ7XG4gICAgICBjb25zdCBpc0p1bXBMaW5rID0gbGlua1R5cGVBdHRyID09PSAnSnVtcCc7XG4gICAgICBsZXQgc2ZjTGlua1R5cGU6IFNGQ0xpbmtbJ3R5cGUnXSA9ICdzaW1wbGUnO1xuXG4gICAgICBpZiAoZnJvbU5vZGUuYnJhbmNoTnVtICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgbWV0YSA9IGJyYW5jaE1hcC5nZXQoZnJvbU5vZGUuYnJhbmNoTnVtKTtcbiAgICAgICAgY29uc3QgaXNTaW11bHRhbmVvdXMgPSBtZXRhPy50eXBlID09PSAnU2ltQmVnaW4nIHx8IG1ldGE/LnR5cGUgPT09ICdTaW1FbmQnO1xuICAgICAgICBzZmNMaW5rVHlwZSA9IGlzU2ltdWx0YW5lb3VzID8gJ3NpbXVsdGFuZW91cy1kaXZlcmdlbmNlJyA6ICdzZWxlY3Rpb24tZGl2ZXJnZW5jZSc7XG4gICAgICB9IGVsc2UgaWYgKHRvTm9kZS5icmFuY2hOdW0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zdCBtZXRhID0gYnJhbmNoTWFwLmdldCh0b05vZGUuYnJhbmNoTnVtKTtcbiAgICAgICAgY29uc3QgaXNTaW11bHRhbmVvdXMgPSBtZXRhPy50eXBlID09PSAnU2ltQmVnaW4nIHx8IG1ldGE/LnR5cGUgPT09ICdTaW1FbmQnO1xuICAgICAgICAvLyBcIkluXCIgcG9ydHMgPSBjb252ZXJnZW5jZSBzaWRlLCBcIk91dFwiIHBvcnRzID0gZGl2ZXJnZW5jZSBzaWRlXG4gICAgICAgIGNvbnN0IGlzSW5Qb3J0ID0gY2hpbGQoY2hpbGQoY29ubkVsLCAnTm9kZVRvJyksICdCcmFuY2hSZWYnKSAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgYXR0cihjaGlsZChjaGlsZChjb25uRWwsICdOb2RlVG8nKSwgJ0JyYW5jaFJlZicpLCAnSW4nKSAhPT0gJyc7XG4gICAgICAgIHNmY0xpbmtUeXBlID0gaXNJblBvcnRcbiAgICAgICAgICA/IChpc1NpbXVsdGFuZW91cyA/ICdzaW11bHRhbmVvdXMtY29udmVyZ2VuY2UnIDogJ3NlbGVjdGlvbi1jb252ZXJnZW5jZScpXG4gICAgICAgICAgOiAoaXNTaW11bHRhbmVvdXMgPyAnc2ltdWx0YW5lb3VzLWRpdmVyZ2VuY2UnIDogJ3NlbGVjdGlvbi1kaXZlcmdlbmNlJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIEhhbmRsZSBFbmRDb25uZWN0aW9uOiBzZXF1ZW5jZSB0ZXJtaW5hdGVzLCBza2lwIGNyZWF0aW5nIGEgbGlua1xuICAgICAgaWYgKHRvTm9kZS5pc0VuZCkge1xuICAgICAgICAvLyBFbmRDb25uZWN0aW9uID0gc2VxdWVuY2UgZW5kOyBubyBsaW5rIGNyZWF0ZWQgKGltcGxpY2l0IHRlcm1pbmF0aW9uKVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gSGFuZGxlIGp1bXAgbGlua3M6IGNyZWF0ZSBhIFNGQ0p1bXAgZW50cnkgYW5kIGEgbGluayB0byBpdFxuICAgICAgaWYgKGlzSnVtcExpbmspIHtcbiAgICAgICAgY29uc3QgdGFyZ2V0U3RlcElkID0gdG9JZDtcbiAgICAgICAgY29uc3QgdGFyZ2V0U3RlcE51bSA9IHRhcmdldFN0ZXBJZC5yZXBsYWNlKCdzaWVtZW5zLXN0ZXAtJywgJycpO1xuICAgICAgICBjb25zdCB0YXJnZXRTdGVwID0gc3RlcHMuZmluZChzID0+IHMuaWQgPT09IHRhcmdldFN0ZXBJZCk7XG4gICAgICAgIGNvbnN0IGp1bXBJZCA9IGdlbklkKGBqdW1wLSR7ZnJvbUlkfWApO1xuICAgICAgICBqdW1wcy5wdXNoKHtcbiAgICAgICAgICBpZDoganVtcElkLFxuICAgICAgICAgIHRhcmdldFN0ZXBOYW1lOiB0YXJnZXRTdGVwPy5uYW1lIHx8IGBTJHt0YXJnZXRTdGVwTnVtfWAsXG4gICAgICAgICAgcG9zaXRpb246IHsgeDogMCwgeTogMCB9LFxuICAgICAgICB9KTtcbiAgICAgICAgbGlua3MucHVzaCh7XG4gICAgICAgICAgaWQ6IGdlbklkKGBsaW5rLSR7ZnJvbUlkfS1qdW1wYCksXG4gICAgICAgICAgZnJvbTogZnJvbUlkLFxuICAgICAgICAgIHRvOiBqdW1wSWQsXG4gICAgICAgICAgdHlwZTogJ3NpbXBsZScsXG4gICAgICAgIH0pO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgbGlua3MucHVzaCh7XG4gICAgICAgIGlkOiBnZW5JZChgbGluay0ke2Zyb21JZH0tJHt0b0lkfWApLFxuICAgICAgICBmcm9tOiBmcm9tSWQsXG4gICAgICAgIHRvOiB0b0lkLFxuICAgICAgICB0eXBlOiBzZmNMaW5rVHlwZSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIERlcml2ZSBicmFuY2hlcyBmcm9tIGxpbmsgdG9wb2xvZ3lcbiAgY29uc3QgYnJhbmNoZXM6IFNGQ0JyYW5jaFtdID0gW107XG4gIGNvbnN0IGFsbEJyYW5jaElkcyA9IG5ldyBTZXQobGlua3MuZmxhdE1hcChsID0+IFtsLmZyb20sIGwudG9dKS5maWx0ZXIoaWQgPT4gaWQuc3RhcnRzV2l0aCgnc2llbWVucy1icmFuY2gtJykpKTtcblxuICBmb3IgKGNvbnN0IGJhcklkIG9mIGFsbEJyYW5jaElkcykge1xuICAgIGNvbnN0IGJyYW5jaE51bSA9IGJhcklkLnJlcGxhY2UoJ3NpZW1lbnMtYnJhbmNoLScsICcnKTtcbiAgICBjb25zdCBtZXRhID0gYnJhbmNoTWFwLmdldChicmFuY2hOdW0pO1xuICAgIGlmICghbWV0YSkgY29udGludWU7XG4gICAgLy8gT25seSBwcm9jZXNzIFwiQmVnaW5cIiBicmFuY2hlcyAoZGl2ZXJnZW5jZSBzaWRlKSBvbmNlXG4gICAgaWYgKG1ldGEudHlwZSAhPT0gJ0FsdEJlZ2luJyAmJiBtZXRhLnR5cGUgIT09ICdTaW1CZWdpbicpIGNvbnRpbnVlO1xuXG4gICAgY29uc3QgaXNTaW11bHRhbmVvdXMgPSBtZXRhLnR5cGUgPT09ICdTaW1CZWdpbic7XG4gICAgY29uc3QgdXBzdHJlYW1JZHMgPSBsaW5rcy5maWx0ZXIobCA9PiBsLnRvID09PSBiYXJJZCkubWFwKGwgPT4gbC5mcm9tKTtcbiAgICBjb25zdCBicmFuY2hIZWFkSWRzID0gbGlua3MuZmlsdGVyKGwgPT4gbC5mcm9tID09PSBiYXJJZCkubWFwKGwgPT4gbC50byk7XG5cbiAgICAvLyBGaW5kIGNvcnJlc3BvbmRpbmcgRW5kIGJhciAoY29udmVyZ2VuY2UpXG4gICAgY29uc3QgY29udkJhcklkID0gWy4uLmFsbEJyYW5jaElkc10uZmluZChiaWQgPT4ge1xuICAgICAgY29uc3QgYk51bSA9IGJpZC5yZXBsYWNlKCdzaWVtZW5zLWJyYW5jaC0nLCAnJyk7XG4gICAgICBjb25zdCBiTWV0YSA9IGJyYW5jaE1hcC5nZXQoYk51bSk7XG4gICAgICByZXR1cm4gYk1ldGEgJiYgKGlzU2ltdWx0YW5lb3VzID8gYk1ldGEudHlwZSA9PT0gJ1NpbUVuZCcgOiBiTWV0YS50eXBlID09PSAnQWx0RW5kJyk7XG4gICAgfSkgPz8gJyc7XG5cbiAgICBjb25zdCBkb3duc3RyZWFtSWRzID0gbGlua3MuZmlsdGVyKGwgPT4gbC5mcm9tID09PSBjb252QmFySWQpLm1hcChsID0+IGwudG8pO1xuXG4gICAgY29uc3QgYnJhbmNoU3RlcEFycmF5czogc3RyaW5nW11bXSA9IGJyYW5jaEhlYWRJZHMubWFwKGhlYWRJZCA9PiB7XG4gICAgICBjb25zdCBjaGFpbjogc3RyaW5nW10gPSBbXTtcbiAgICAgIGxldCBjdXIgPSBoZWFkSWQ7XG4gICAgICBmb3IgKGxldCBkZXB0aCA9IDA7IGRlcHRoIDwgMzA7IGRlcHRoKyspIHtcbiAgICAgICAgaWYgKGN1ci5zdGFydHNXaXRoKCdzaWVtZW5zLXN0ZXAtJykpIGNoYWluLnB1c2goY3VyKTtcbiAgICAgICAgY29uc3QgbmV4dCA9IGxpbmtzLmZpbmQobCA9PiBsLmZyb20gPT09IGN1ciAmJiBsLnR5cGUgPT09ICdzaW1wbGUnICYmICFhbGxCcmFuY2hJZHMuaGFzKGwudG8pKTtcbiAgICAgICAgaWYgKCFuZXh0IHx8IGFsbEJyYW5jaElkcy5oYXMobmV4dC50bykpIGJyZWFrO1xuICAgICAgICBjdXIgPSBuZXh0LnRvO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNoYWluO1xuICAgIH0pO1xuXG4gICAgaWYgKCFicmFuY2hlcy5maW5kKGIgPT4gYi5pZCA9PT0gYGJyYW5jaC0ke2JhcklkfWApKSB7XG4gICAgICBicmFuY2hlcy5wdXNoKHtcbiAgICAgICAgaWQ6IGBicmFuY2gtJHtiYXJJZH1gLFxuICAgICAgICB0eXBlOiBpc1NpbXVsdGFuZW91cyA/ICdBTkQnIDogJ09SJyxcbiAgICAgICAgZGl2ZXJnaW5nRnJvbVRyYW5zSWQ6IHVwc3RyZWFtSWRzWzBdIHx8ICcnLFxuICAgICAgICBicmFuY2hTdGVwSWRzOiBicmFuY2hTdGVwQXJyYXlzLFxuICAgICAgICBjb252ZXJnaW5nVG9UcmFuc0lkOiBkb3duc3RyZWFtSWRzWzBdIHx8ICcnLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgc3RlcHMsIHRyYW5zaXRpb25zLCBsaW5rcywgYnJhbmNoZXMsIGp1bXBzIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBFeHBvcnQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBmdW5jdGlvbiBleHBvcnRTaWVtZW5zKHByb2plY3Q6IE5vcm1hbGl6ZWRQcm9qZWN0KTogRXhwb3J0UmVzdWx0IHtcbiAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3Qgc2lkZWNhciA9IHByb2plY3Quc2lkZWNhcjtcblxuICBsZXQgdWlkQ291bnRlciA9IDE7XG4gIGNvbnN0IG5leHRVSWQgPSAoKSA9PiBTdHJpbmcodWlkQ291bnRlcisrKTtcblxuICBjb25zdCBibG9ja3MgPSBwcm9qZWN0LnBvdXMubWFwKHBvdSA9PiBidWlsZFNpbWF0aWNCbG9jayhwb3UsIG5leHRVSWQsIHdhcm5pbmdzLCBzaWRlY2FyKSk7XG5cbiAgLy8gRml4IDEgJiAyOiBibG9ja3MgYXJlIGRpcmVjdCBjaGlsZHJlbiBvZiBEb2N1bWVudCAobm90IGluc2lkZSBTVy5CbG9ja3Mgd3JhcHBlciksXG4gIC8vIEVuZ2luZWVyaW5nIHZlcnNpb24gZWxlbWVudCBhZGRlZCBhcyBzaWJsaW5nLlxuICBjb25zdCBkb2N1bWVudE9iajogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgRG9jdW1lbnRJbmZvOiB7XG4gICAgICBDcmVhdGVkOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICBFeHBvcnRTZXR0aW5nOiAnV2l0aERlZmF1bHRzJyxcbiAgICAgIEluc3RhbGxlZFByb2R1Y3RzOiB7fSxcbiAgICAgIFByb2plY3ROYW1lOiBwcm9qZWN0LnByb2plY3ROYW1lLFxuICAgICAgVGlhVmVyc2lvbjogc2lkZWNhci52ZW5kb3JTcGVjaWZpY0dsb2JhbHM/LlsndGlhVmVyc2lvbiddID8/ICcxNy4wJyxcbiAgICB9LFxuICAgIEVuZ2luZWVyaW5nOiB7ICdAX3ZlcnNpb24nOiAnVjE0IFNQMScgfSxcbiAgfTtcblxuICBjb25zdCBvYnM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+W10gPSBbXTtcbiAgY29uc3QgZmJzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdID0gW107XG4gIGNvbnN0IGZjczogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSA9IFtdO1xuICBwcm9qZWN0LnBvdXMuZm9yRWFjaCgocG91LCBpKSA9PiB7XG4gICAgY29uc3QgYmxvY2sgPSB7IC4uLmJsb2Nrc1tpXSwgJ0BfSUQnOiAnMCcgfTtcbiAgICBpZiAocG91LnBvdVR5cGUgPT09ICdmdW5jdGlvbkJsb2NrJykgZmJzLnB1c2goYmxvY2spO1xuICAgIGVsc2UgaWYgKHBvdS5wb3VUeXBlID09PSAnZnVuY3Rpb24nKSBmY3MucHVzaChibG9jayk7XG4gICAgZWxzZSBvYnMucHVzaChibG9jayk7XG4gIH0pO1xuICBpZiAob2JzLmxlbmd0aCA+IDApIGRvY3VtZW50T2JqWydTVy5CbG9ja3MuT0InXSA9IG9icztcbiAgaWYgKGZicy5sZW5ndGggPiAwKSBkb2N1bWVudE9ialsnU1cuQmxvY2tzLkZCJ10gPSBmYnM7XG4gIGlmIChmY3MubGVuZ3RoID4gMCkgZG9jdW1lbnRPYmpbJ1NXLkJsb2Nrcy5GQyddID0gZmNzO1xuXG4gIGNvbnN0IG9iaiA9IHsgRG9jdW1lbnQ6IGRvY3VtZW50T2JqIH07XG5cbiAgcmV0dXJuIHsgb2s6IHRydWUsIHhtbENvbnRlbnQ6IGJ1aWxkWE1MKG9iaiksIGVycm9ycywgd2FybmluZ3MgfTtcbn1cblxuZnVuY3Rpb24gYnVpbGRTaW1hdGljQmxvY2soXG4gIHBvdTogTm9ybWFsaXplZFBPVSxcbiAgbmV4dFVJZDogKCkgPT4gc3RyaW5nLFxuICB3YXJuaW5nczogc3RyaW5nW10sXG4gIHNpZGVjYXI6IFZlbmRvck1ldGFkYXRhU2lkZWNhclxuKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICBjb25zdCBuZXR3b3JrcyA9IGJ1aWxkU2ltYXRpY05ldHdvcmtzKHBvdSwgbmV4dFVJZCwgd2FybmluZ3MpO1xuXG4gIHJldHVybiB7XG4gICAgJ0BfSUQnOiBuZXh0VUlkKCksXG4gICAgQXR0cmlidXRlTGlzdDoge1xuICAgICAgQXV0b051bWJlcjogJ3RydWUnLFxuICAgICAgSGVhZGVyQXV0aG9yOiAnUGxheGlvJyxcbiAgICAgIEhlYWRlckZhbWlseTogJycsXG4gICAgICBIZWFkZXJOYW1lOiBwb3UubmFtZSxcbiAgICAgIEhlYWRlclZlcnNpb246ICcxLjAnLFxuICAgICAgSW50ZXJmYWNlOiBidWlsZFNpbWF0aWNJbnRlcmZhY2UocG91LmxvY2FsVGFncyBhcyBTaWVtZW5zVGFnW10pLFxuICAgICAgSXNJRUNDaGVja0VuYWJsZWQ6ICdmYWxzZScsXG4gICAgICBNZW1vcnlMYXlvdXQ6ICdPcHRpbWl6ZWQnLFxuICAgICAgTmFtZTogcG91Lm5hbWUsXG4gICAgICBOYW1lc3BhY2U6ICcnLFxuICAgICAgUHJvZ3JhbW1pbmdMYW5ndWFnZTogcG91Lmxhbmd1YWdlID09PSAnRkJEJyA/ICdGQkQnIDogcG91Lmxhbmd1YWdlID09PSAnU0ZDJyA/ICdHUkFQSCcgOiBwb3UubGFuZ3VhZ2UgPT09ICdTVCcgPyAnU0NMJyA6ICdMQUQnLFxuICAgIH0sXG4gICAgLy8gRml4IDc6IE9iamVjdExpc3Qgd2l0aCBNdWx0aWxpbmd1YWxUZXh0IFRpdGxlIGFsb25nc2lkZSBDb21waWxlVW5pdHNcbiAgICBPYmplY3RMaXN0OiB7XG4gICAgICAnTXVsdGlsaW5ndWFsVGV4dCc6IHtcbiAgICAgICAgJ0BfSUQnOiAnMScsXG4gICAgICAgICdAX0NvbXBvc2l0aW9uTmFtZSc6ICdUaXRsZScsXG4gICAgICAgIE9iamVjdExpc3Q6IHtcbiAgICAgICAgICBNdWx0aWxpbmd1YWxUZXh0SXRlbToge1xuICAgICAgICAgICAgJ0BfSUQnOiAnMicsXG4gICAgICAgICAgICAnQF9Db21wb3NpdGlvbk5hbWUnOiAnSXRlbXMnLFxuICAgICAgICAgICAgQXR0cmlidXRlTGlzdDogeyBDdWx0dXJlOiAnZW4tVVMnLCBUZXh0OiBwb3UubmFtZSB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgLy8gRml4IDY6IENvbXBpbGVVbml0IG5lZWRzIENvbXBvc2l0aW9uTmFtZSBhdHRyaWJ1dGVcbiAgICAgICdTVy5CbG9ja3MuQ29tcGlsZVVuaXQnOiBuZXR3b3Jrcy5tYXAobiA9PiAoeyAnQF9Db21wb3NpdGlvbk5hbWUnOiAnQ29tcGlsZVVuaXRzJywgLi4ubiBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB9KSksXG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gYnVpbGRTaW1hdGljSW50ZXJmYWNlKHRhZ3M6IFNpZW1lbnNUYWdbXSk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgLy8gR3JvdXAgdGFncyBieSB0aGVpciBzdG9yZWQgc2VjdGlvbiAocHJlc2VydmVkIGZyb20gaW1wb3J0KVxuICBjb25zdCBzZWN0aW9uczogUmVjb3JkPHN0cmluZywgU2llbWVuc1RhZ1tdPiA9IHtcbiAgICBJbnB1dDogW10sIE91dHB1dDogW10sIEluT3V0OiBbXSwgU3RhdGljOiBbXSwgVGVtcDogW10sIENvbnN0YW50OiBbXSwgUmV0dXJuOiBbXSxcbiAgfTtcblxuICBmb3IgKGNvbnN0IHRhZyBvZiB0YWdzKSB7XG4gICAgY29uc3Qgc2VjID0gdGFnLnNlY3Rpb24gfHwgJ1N0YXRpYyc7XG4gICAgaWYgKCFzZWN0aW9uc1tzZWNdKSBzZWN0aW9uc1tzZWNdID0gW107XG4gICAgc2VjdGlvbnNbc2VjXS5wdXNoKHRhZyk7XG4gIH1cblxuICBjb25zdCBzZWN0aW9uRW50cmllcyA9IE9iamVjdC5lbnRyaWVzKHNlY3Rpb25zKVxuICAgIC5maWx0ZXIoKFtfLCB0YWdzXSkgPT4gdGFncy5sZW5ndGggPiAwKVxuICAgIC5tYXAoKFtuYW1lLCB0YWdzXSkgPT4gKHtcbiAgICAgICdAX05hbWUnOiBuYW1lLFxuICAgICAgTWVtYmVyOiB0YWdzLm1hcCh0ID0+IHRhZ1RvU2ltYXRpY01lbWJlcih0KSksXG4gICAgfSkpO1xuXG4gIC8vIEVuc3VyZSBhdCBsZWFzdCBJbnB1dC9PdXRwdXQvU3RhdGljIGV4aXN0IGZvciB2YWxpZCBleHBvcnRcbiAgaWYgKHNlY3Rpb25FbnRyaWVzLmxlbmd0aCA9PT0gMCkge1xuICAgIHNlY3Rpb25FbnRyaWVzLnB1c2goeyAnQF9OYW1lJzogJ1N0YXRpYycsIE1lbWJlcjogW10gfSk7XG4gIH1cblxuICAvLyBGaXggMzogU2VjdGlvbnMgbmVlZHMgeG1sbnMgbmFtZXNwYWNlIGF0dHJpYnV0ZVxuICByZXR1cm4geyBTZWN0aW9uczogeyAnQF94bWxucyc6ICdodHRwOi8vd3d3LnNpZW1lbnMuY29tL2F1dG9tYXRpb24vT3Blbm5lc3MvU1cvSW50ZXJmYWNlL3YyJywgU2VjdGlvbjogc2VjdGlvbkVudHJpZXMgfSB9O1xufVxuXG5mdW5jdGlvbiB0YWdUb1NpbWF0aWNNZW1iZXIodGFnOiBOb3JtYWxpemVkVGFnKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgICdAX05hbWUnOiB0YWcubmFtZSxcbiAgICAnQF9EYXRhdHlwZSc6IGllY1R5cGVUb1NpbWF0aWModGFnLmRhdGFUeXBlKSxcbiAgICAnQF9BY2Nlc3NpYmlsaXR5JzogJ1B1YmxpYycsXG4gICAgU3RhcnRWYWx1ZTogdGFnLmluaXRpYWxWYWx1ZSB8fCB1bmRlZmluZWQsXG4gICAgLy8gRml4IDQ6IE1lbWJlciBDb21tZW50IG5lZWRzIExhbmcgYXR0cmlidXRlIGFuZCBJbmZvcm1hdGl2ZSBhdHRyaWJ1dGVcbiAgICBDb21tZW50OiB0YWcuZGVzY3JpcHRpb24gPyB7XG4gICAgICAnQF9JbmZvcm1hdGl2ZSc6ICd0cnVlJyxcbiAgICAgIE11bHRpTGFuZ3VhZ2VUZXh0OiB7ICdAX0xhbmcnOiAnZW4tVVMnLCAnI3RleHQnOiB0YWcuZGVzY3JpcHRpb24gfSxcbiAgICB9IDogdW5kZWZpbmVkLFxuICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZFNpbWF0aWNOZXR3b3JrcyhcbiAgcG91OiBOb3JtYWxpemVkUE9VLFxuICBuZXh0VUlkOiAoKSA9PiBzdHJpbmcsXG4gIHdhcm5pbmdzOiBzdHJpbmdbXVxuKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSB7XG4gIGlmIChwb3UubGFuZ3VhZ2UgPT09ICdMRCcgJiYgcG91LmxhZGRlclByb2dyYW0pIHtcbiAgICByZXR1cm4gcG91LmxhZGRlclByb2dyYW0ucnVuZ3MubWFwKHJ1bmcgPT4gYnVpbGRTaW1hdGljTEFETmV0d29yayhydW5nLCBuZXh0VUlkKSk7XG4gIH1cbiAgaWYgKHBvdS5sYW5ndWFnZSA9PT0gJ0ZCRCcgJiYgcG91LmZiZFByb2dyYW0pIHtcbiAgICByZXR1cm4gW2J1aWxkU2ltYXRpY0ZCRE5ldHdvcmsocG91LmZiZFByb2dyYW0sIG5leHRVSWQpXTtcbiAgfVxuICBpZiAocG91Lmxhbmd1YWdlID09PSAnU0ZDJyAmJiBwb3Uuc2ZjUHJvZ3JhbSkge1xuICAgIHJldHVybiBidWlsZFNpbWF0aWNHUkFQSE5ldHdvcmtzKHBvdS5zZmNQcm9ncmFtLCBuZXh0VUlkKTtcbiAgfVxuICBpZiAocG91Lmxhbmd1YWdlID09PSAnU1QnICYmIHBvdS5zdFNvdXJjZSkge1xuICAgIHJldHVybiBbe1xuICAgICAgJ0BfSUQnOiBuZXh0VUlkKCksXG4gICAgICBBdHRyaWJ1dGVMaXN0OiB7XG4gICAgICAgIFByb2dyYW1taW5nTGFuZ3VhZ2U6ICdTQ0wnLFxuICAgICAgICBOZXR3b3JrU291cmNlOiB7XG4gICAgICAgICAgU3RydWN0dXJlZFRleHQ6IHBvdS5zdFNvdXJjZSB8fCAnJyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfV07XG4gIH1cbiAgd2FybmluZ3MucHVzaChgUE9VIFwiJHtwb3UubmFtZX1cIjogbGFuZ3VhZ2UgJHtwb3UubGFuZ3VhZ2V9IFx1MjAxNCBleHBvcnQgYXMgZW1wdHkgbmV0d29ya2ApO1xuICByZXR1cm4gW3sgJ0BfSUQnOiBuZXh0VUlkKCksIEF0dHJpYnV0ZUxpc3Q6IHsgUHJvZ3JhbW1pbmdMYW5ndWFnZTogJ0xBRCcsIE5ldHdvcmtTb3VyY2U6IHt9IH0gfV07XG59XG5cbmZ1bmN0aW9uIGJ1aWxkU2ltYXRpY0xBRE5ldHdvcmsocnVuZzogUnVuZywgbmV4dFVJZDogKCkgPT4gc3RyaW5nKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICAvLyBSZWFsIFRJQSBQb3J0YWwgRmxnTmV0IHN0cnVjdHVyZTpcbiAgLy8gUGFydHMgY29udGFpbnM6IEFjY2VzcyBlbGVtZW50cyAodmFyaWFibGVzKSArIFBhcnQgZWxlbWVudHMgKGluc3RydWN0aW9ucykgKyBDYWxsIGVsZW1lbnRzXG4gIC8vIFdpcmVzIGNvbnRhaW5zOiBXaXJlIGVsZW1lbnRzIHdpdGggUG93ZXJyYWlsLCBOYW1lQ29uLCBJZGVudENvbiBjaGlsZHJlblxuICAvLyBBY2Nlc3MgYW5kIFBhcnQgYXJlIFNFUEFSQVRFIFx1MjAxNCBQYXJ0IHJlZmVyZW5jZXMgaXRzIG9wZXJhbmQgdmlhIGEgd2lyZSB3aXRoIElkZW50Q29uXHUyMTkyTmFtZUNvbihvcGVyYW5kKVxuXG4gIGNvbnN0IGFjY2Vzc2VzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdID0gW107XG4gIGNvbnN0IHBhcnRzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdID0gW107XG4gIGNvbnN0IGNhbGxzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdID0gW107XG4gIGNvbnN0IHdpcmVzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdID0gW107XG5cbiAgLy8gQ29sbGVjdCBhbGwgZWxlbWVudHMgKG1haW4gKyBicmFuY2hlcykgZm9yIGV4cG9ydFxuICBjb25zdCBhbGxFbGVtZW50cyA9IFsuLi5ydW5nLmVsZW1lbnRzXTtcbiAgZm9yIChjb25zdCBicmFuY2ggb2YgcnVuZy5icmFuY2hlcykge1xuICAgIGFsbEVsZW1lbnRzLnB1c2goLi4uYnJhbmNoLmVsZW1lbnRzKTtcbiAgfVxuXG4gIC8vIEZpcnN0IHBhc3M6IGNyZWF0ZSBQYXJ0ICsgQWNjZXNzIFVJRHMgZm9yIGVhY2ggZWxlbWVudFxuICBpbnRlcmZhY2UgUGFydEluZm8geyBwYXJ0VUlkOiBzdHJpbmc7IGFjY2Vzc1VJZDogc3RyaW5nOyBwYXJ0TmFtZTogc3RyaW5nOyB9XG4gIGNvbnN0IGVsZW1lbnRQYXJ0SW5mb3M6IFBhcnRJbmZvW10gPSBbXTtcbiAgbGV0IGZpcnN0UGFydFVJZCA9ICcnO1xuXG4gIGZvciAoY29uc3QgZWwgb2YgYWxsRWxlbWVudHMpIHtcbiAgICBpZiAoZWwua2luZCA9PT0gJ2NvbnRhY3QnKSB7XG4gICAgICBjb25zdCBjID0gZWwgYXMgQ29udGFjdEVsZW1lbnQ7XG4gICAgICBjb25zdCBwYXJ0VUlkID0gbmV4dFVJZCgpO1xuICAgICAgY29uc3QgYWNjZXNzVUlkID0gbmV4dFVJZCgpO1xuICAgICAgaWYgKCFmaXJzdFBhcnRVSWQpIGZpcnN0UGFydFVJZCA9IHBhcnRVSWQ7XG5cbiAgICAgIC8vIERldGVybWluZSBQYXJ0IE5hbWVcbiAgICAgIGxldCBwYXJ0TmFtZSA9ICdDb250YWN0JztcbiAgICAgIGlmIChjLnR5cGUgPT09ICdQX0NPTlRBQ1QnKSBwYXJ0TmFtZSA9ICdQQ29udGFjdCc7XG4gICAgICBlbHNlIGlmIChjLnR5cGUgPT09ICdOX0NPTlRBQ1QnKSBwYXJ0TmFtZSA9ICdOQ29udGFjdCc7XG5cbiAgICAgIC8vIEFjY2VzcyBlbGVtZW50ICh2YXJpYWJsZSByZWZlcmVuY2UpXG4gICAgICBjb25zdCB0YWdQYXJ0cyA9IGMudGFnLm5hbWUuc3BsaXQoJy4nKTtcbiAgICAgIGNvbnN0IHN5bWJvbENvbXBvbmVudCA9IHRhZ1BhcnRzLmxlbmd0aCA9PT0gMVxuICAgICAgICA/IHsgQ29tcG9uZW50OiB7ICdAX05hbWUnOiB0YWdQYXJ0c1swXSB9IH1cbiAgICAgICAgOiB7IENvbXBvbmVudDogdGFnUGFydHMubWFwKHAgPT4gKHsgJ0BfTmFtZSc6IHAgfSkpIH07XG4gICAgICBhY2Nlc3Nlcy5wdXNoKHsgJ0BfU2NvcGUnOiAnTG9jYWxWYXJpYWJsZScsICdAX1VJZCc6IGFjY2Vzc1VJZCwgU3ltYm9sOiBzeW1ib2xDb21wb25lbnQgfSk7XG5cbiAgICAgIC8vIFBhcnQgZWxlbWVudCAoaW5zdHJ1Y3Rpb24pXG4gICAgICBjb25zdCBwYXJ0T2JqOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHsgJ0BfTmFtZSc6IHBhcnROYW1lLCAnQF9VSWQnOiBwYXJ0VUlkIH07XG4gICAgICBpZiAoYy50eXBlID09PSAnTkMnKSBwYXJ0T2JqWydAX05lZ2F0ZWQnXSA9ICd0cnVlJztcbiAgICAgIHBhcnRzLnB1c2gocGFydE9iaik7XG5cbiAgICAgIGVsZW1lbnRQYXJ0SW5mb3MucHVzaCh7IHBhcnRVSWQsIGFjY2Vzc1VJZCwgcGFydE5hbWUgfSk7XG4gICAgfSBlbHNlIGlmIChlbC5raW5kID09PSAnY29pbCcpIHtcbiAgICAgIGNvbnN0IGMgPSBlbCBhcyBDb2lsRWxlbWVudDtcbiAgICAgIGNvbnN0IHBhcnRVSWQgPSBuZXh0VUlkKCk7XG4gICAgICBjb25zdCBhY2Nlc3NVSWQgPSBuZXh0VUlkKCk7XG4gICAgICBpZiAoIWZpcnN0UGFydFVJZCkgZmlyc3RQYXJ0VUlkID0gcGFydFVJZDtcblxuICAgICAgbGV0IHBhcnROYW1lID0gJ0NvaWwnO1xuICAgICAgaWYgKGMudHlwZSA9PT0gJ3NldCcgfHwgYy50eXBlID09PSAnbGF0Y2gnKSBwYXJ0TmFtZSA9ICdTQ29pbCc7XG4gICAgICBlbHNlIGlmIChjLnR5cGUgPT09ICdyZXNldCcgfHwgYy50eXBlID09PSAndW5sYXRjaCcpIHBhcnROYW1lID0gJ1JDb2lsJztcblxuICAgICAgY29uc3QgdGFnUGFydHMgPSBjLnRhZy5uYW1lLnNwbGl0KCcuJyk7XG4gICAgICBjb25zdCBzeW1ib2xDb21wb25lbnQgPSB0YWdQYXJ0cy5sZW5ndGggPT09IDFcbiAgICAgICAgPyB7IENvbXBvbmVudDogeyAnQF9OYW1lJzogdGFnUGFydHNbMF0gfSB9XG4gICAgICAgIDogeyBDb21wb25lbnQ6IHRhZ1BhcnRzLm1hcChwID0+ICh7ICdAX05hbWUnOiBwIH0pKSB9O1xuICAgICAgYWNjZXNzZXMucHVzaCh7ICdAX1Njb3BlJzogJ0xvY2FsVmFyaWFibGUnLCAnQF9VSWQnOiBhY2Nlc3NVSWQsIFN5bWJvbDogc3ltYm9sQ29tcG9uZW50IH0pO1xuXG4gICAgICBjb25zdCBwYXJ0T2JqOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHsgJ0BfTmFtZSc6IHBhcnROYW1lLCAnQF9VSWQnOiBwYXJ0VUlkIH07XG4gICAgICBpZiAoYy50eXBlID09PSAnbmVnYXRlZCcpIHBhcnRPYmpbJ0BfTmVnYXRlZCddID0gJ3RydWUnO1xuICAgICAgcGFydHMucHVzaChwYXJ0T2JqKTtcblxuICAgICAgZWxlbWVudFBhcnRJbmZvcy5wdXNoKHsgcGFydFVJZCwgYWNjZXNzVUlkLCBwYXJ0TmFtZSB9KTtcbiAgICB9IGVsc2UgaWYgKGVsLmtpbmQgPT09ICdibG9jaycpIHtcbiAgICAgIGNvbnN0IGIgPSBlbCBhcyBCbG9ja0VsZW1lbnQ7XG4gICAgICBjb25zdCBjYWxsVUlkID0gbmV4dFVJZCgpO1xuICAgICAgaWYgKCFmaXJzdFBhcnRVSWQpIGZpcnN0UGFydFVJZCA9IGNhbGxVSWQ7XG4gICAgICBjb25zdCBleHBvcnROYW1lID0gYi52ZW5kb3JPcmlnaW5hbE5hbWUgfHwgY2xtRkJUeXBlVG9TaWVtZW5zKGIuZmJUeXBlKTtcbiAgICAgIGNvbnN0IGluc3RhbmNlVUlkID0gbmV4dFVJZCgpO1xuXG4gICAgICBjb25zdCB0YWdQYXJ0cyA9IGIuaW5zdGFuY2VOYW1lLnNwbGl0KCcuJyk7XG4gICAgICBjb25zdCBpbnN0YW5jZUNvbXBvbmVudCA9IHRhZ1BhcnRzLmxlbmd0aCA9PT0gMVxuICAgICAgICA/IHsgJ0BfTmFtZSc6IHRhZ1BhcnRzWzBdIH1cbiAgICAgICAgOiB0YWdQYXJ0cy5tYXAocCA9PiAoeyAnQF9OYW1lJzogcCB9KSk7XG5cbiAgICAgIGNvbnN0IGNhbGxPYmo6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xuICAgICAgICAnQF9VSWQnOiBjYWxsVUlkLFxuICAgICAgICBDYWxsSW5mbzoge1xuICAgICAgICAgICdAX05hbWUnOiBleHBvcnROYW1lLFxuICAgICAgICAgICdAX0Jsb2NrVHlwZSc6IChiIGFzIGFueSkudmVuZG9yQmxvY2tUeXBlIHx8ICdGQicsXG4gICAgICAgICAgSW5zdGFuY2U6IHtcbiAgICAgICAgICAgICdAX1Njb3BlJzogJ0xvY2FsVmFyaWFibGUnLFxuICAgICAgICAgICAgJ0BfVUlkJzogaW5zdGFuY2VVSWQsXG4gICAgICAgICAgICBDb21wb25lbnQ6IGluc3RhbmNlQ29tcG9uZW50LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgICAgY2FsbHMucHVzaChjYWxsT2JqKTtcbiAgICAgIGVsZW1lbnRQYXJ0SW5mb3MucHVzaCh7IHBhcnRVSWQ6IGNhbGxVSWQsIGFjY2Vzc1VJZDogJycsIHBhcnROYW1lOiAnQ2FsbCcgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gU2Vjb25kIHBhc3M6IGdlbmVyYXRlIHdpcmVzIChQb3dlcnJhaWxcdTIxOTJmaXJzdC5pbiwgb3V0XHUyMTkyaW4gY2hhaW5zLCBvcGVyYW5kIHdpcmVzKVxuICAvLyBQcm9jZXNzIG1haW4gcnVuZyBlbGVtZW50c1xuICBsZXQgcHJldlBhcnRVSWQgPSAnJztcbiAgbGV0IG1haW5JZHggPSAwO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHJ1bmcuZWxlbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBpbmZvID0gZWxlbWVudFBhcnRJbmZvc1ttYWluSWR4XTtcbiAgICBtYWluSWR4Kys7XG4gICAgY29uc3QgZWwgPSBydW5nLmVsZW1lbnRzW2ldO1xuXG4gICAgaWYgKGVsLmtpbmQgPT09ICdibG9jaycpIHtcbiAgICAgIC8vIFBvd2VycmFpbCBvciBwcmV2IFx1MjE5MiBlbiBwaW5cbiAgICAgIGlmIChwcmV2UGFydFVJZCA9PT0gJycpIHtcbiAgICAgICAgd2lyZXMucHVzaCh7ICdAX1VJZCc6IG5leHRVSWQoKSwgUG93ZXJyYWlsOiB7fSwgTmFtZUNvbjogeyAnQF9VSWQnOiBpbmZvLnBhcnRVSWQsICdAX05hbWUnOiAnZW4nIH0gfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB3aXJlcy5wdXNoKHsgJ0BfVUlkJzogbmV4dFVJZCgpLCBOYW1lQ29uOiBbeyAnQF9VSWQnOiBwcmV2UGFydFVJZCwgJ0BfTmFtZSc6ICdvdXQnIH0sIHsgJ0BfVUlkJzogaW5mby5wYXJ0VUlkLCAnQF9OYW1lJzogJ2VuJyB9XSB9KTtcbiAgICAgIH1cbiAgICAgIHByZXZQYXJ0VUlkID0gaW5mby5wYXJ0VUlkO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBDb250YWN0L0NvaWw6IFBvd2VycmFpbCBvciBwcmV2IFx1MjE5MiBpbiBwaW5cbiAgICAgIGlmIChwcmV2UGFydFVJZCA9PT0gJycpIHtcbiAgICAgICAgd2lyZXMucHVzaCh7ICdAX1VJZCc6IG5leHRVSWQoKSwgUG93ZXJyYWlsOiB7fSwgTmFtZUNvbjogeyAnQF9VSWQnOiBpbmZvLnBhcnRVSWQsICdAX05hbWUnOiAnaW4nIH0gfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB3aXJlcy5wdXNoKHsgJ0BfVUlkJzogbmV4dFVJZCgpLCBOYW1lQ29uOiBbeyAnQF9VSWQnOiBwcmV2UGFydFVJZCwgJ0BfTmFtZSc6ICdvdXQnIH0sIHsgJ0BfVUlkJzogaW5mby5wYXJ0VUlkLCAnQF9OYW1lJzogJ2luJyB9XSB9KTtcbiAgICAgIH1cbiAgICAgIC8vIE9wZXJhbmQgd2lyZTogSWRlbnRDb24oYWNjZXNzVUlkKSBcdTIxOTIgTmFtZUNvbihwYXJ0VUlkLCBvcGVyYW5kKVxuICAgICAgaWYgKGluZm8uYWNjZXNzVUlkKSB7XG4gICAgICAgIHdpcmVzLnB1c2goeyAnQF9VSWQnOiBuZXh0VUlkKCksIElkZW50Q29uOiB7ICdAX1VJZCc6IGluZm8uYWNjZXNzVUlkIH0sIE5hbWVDb246IHsgJ0BfVUlkJzogaW5mby5wYXJ0VUlkLCAnQF9OYW1lJzogJ29wZXJhbmQnIH0gfSk7XG4gICAgICB9XG4gICAgICBwcmV2UGFydFVJZCA9IGluZm8ucGFydFVJZDtcbiAgICB9XG4gIH1cblxuICAvLyBCcmFuY2ggZWxlbWVudHMgXHUyMDE0IGVhY2ggYnJhbmNoIHN0YXJ0cyBmcm9tIHBvd2VycmFpbCBvciBhIGJyYW5jaCBwb2ludFxuICBmb3IgKGNvbnN0IGJyYW5jaCBvZiBydW5nLmJyYW5jaGVzKSB7XG4gICAgbGV0IGJyYW5jaFByZXZQYXJ0VUlkID0gJyc7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBicmFuY2guZWxlbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGluZm8gPSBlbGVtZW50UGFydEluZm9zW21haW5JZHhdO1xuICAgICAgbWFpbklkeCsrO1xuICAgICAgY29uc3QgZWwgPSBicmFuY2guZWxlbWVudHNbaV07XG5cbiAgICAgIGlmIChlbC5raW5kID09PSAnYmxvY2snKSB7XG4gICAgICAgIGlmIChicmFuY2hQcmV2UGFydFVJZCA9PT0gJycpIHtcbiAgICAgICAgICB3aXJlcy5wdXNoKHsgJ0BfVUlkJzogbmV4dFVJZCgpLCBQb3dlcnJhaWw6IHt9LCBOYW1lQ29uOiB7ICdAX1VJZCc6IGluZm8ucGFydFVJZCwgJ0BfTmFtZSc6ICdlbicgfSB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB3aXJlcy5wdXNoKHsgJ0BfVUlkJzogbmV4dFVJZCgpLCBOYW1lQ29uOiBbeyAnQF9VSWQnOiBicmFuY2hQcmV2UGFydFVJZCwgJ0BfTmFtZSc6ICdvdXQnIH0sIHsgJ0BfVUlkJzogaW5mby5wYXJ0VUlkLCAnQF9OYW1lJzogJ2VuJyB9XSB9KTtcbiAgICAgICAgfVxuICAgICAgICBicmFuY2hQcmV2UGFydFVJZCA9IGluZm8ucGFydFVJZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChicmFuY2hQcmV2UGFydFVJZCA9PT0gJycpIHtcbiAgICAgICAgICB3aXJlcy5wdXNoKHsgJ0BfVUlkJzogbmV4dFVJZCgpLCBQb3dlcnJhaWw6IHt9LCBOYW1lQ29uOiB7ICdAX1VJZCc6IGluZm8ucGFydFVJZCwgJ0BfTmFtZSc6ICdpbicgfSB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB3aXJlcy5wdXNoKHsgJ0BfVUlkJzogbmV4dFVJZCgpLCBOYW1lQ29uOiBbeyAnQF9VSWQnOiBicmFuY2hQcmV2UGFydFVJZCwgJ0BfTmFtZSc6ICdvdXQnIH0sIHsgJ0BfVUlkJzogaW5mby5wYXJ0VUlkLCAnQF9OYW1lJzogJ2luJyB9XSB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaW5mby5hY2Nlc3NVSWQpIHtcbiAgICAgICAgICB3aXJlcy5wdXNoKHsgJ0BfVUlkJzogbmV4dFVJZCgpLCBJZGVudENvbjogeyAnQF9VSWQnOiBpbmZvLmFjY2Vzc1VJZCB9LCBOYW1lQ29uOiB7ICdAX1VJZCc6IGluZm8ucGFydFVJZCwgJ0BfTmFtZSc6ICdvcGVyYW5kJyB9IH0pO1xuICAgICAgICB9XG4gICAgICAgIGJyYW5jaFByZXZQYXJ0VUlkID0gaW5mby5wYXJ0VUlkO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEJ1aWxkIFBhcnRzIG9iamVjdDogQWNjZXNzIGVsZW1lbnRzIGZpcnN0LCB0aGVuIFBhcnQgZWxlbWVudHMsIHRoZW4gQ2FsbCBlbGVtZW50c1xuICBjb25zdCBwYXJ0c09iajogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fTtcbiAgaWYgKGFjY2Vzc2VzLmxlbmd0aCkgcGFydHNPYmouQWNjZXNzID0gYWNjZXNzZXM7XG4gIGlmIChwYXJ0cy5sZW5ndGgpIHBhcnRzT2JqLlBhcnQgPSBwYXJ0cztcbiAgaWYgKGNhbGxzLmxlbmd0aCkgcGFydHNPYmouQ2FsbCA9IGNhbGxzO1xuXG4gIC8vIEJ1aWxkIE9iamVjdExpc3Qgd2l0aCBDb21tZW50IGFuZCBUaXRsZSBNdWx0aWxpbmd1YWxUZXh0XG4gIGNvbnN0IG9iamVjdExpc3RJdGVtczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fTtcbiAgaWYgKHJ1bmcuY29tbWVudCkge1xuICAgIG9iamVjdExpc3RJdGVtc1snTXVsdGlsaW5ndWFsVGV4dCddID0gW1xuICAgICAge1xuICAgICAgICAnQF9JRCc6IG5leHRVSWQoKSxcbiAgICAgICAgJ0BfQ29tcG9zaXRpb25OYW1lJzogJ0NvbW1lbnQnLFxuICAgICAgICBPYmplY3RMaXN0OiB7XG4gICAgICAgICAgTXVsdGlsaW5ndWFsVGV4dEl0ZW06IHtcbiAgICAgICAgICAgICdAX0lEJzogbmV4dFVJZCgpLFxuICAgICAgICAgICAgJ0BfQ29tcG9zaXRpb25OYW1lJzogJ0l0ZW1zJyxcbiAgICAgICAgICAgIEF0dHJpYnV0ZUxpc3Q6IHsgQ3VsdHVyZTogJ2VuLVVTJywgVGV4dDogcnVuZy5jb21tZW50IH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgICdAX0lEJzogbmV4dFVJZCgpLFxuICAgICAgICAnQF9Db21wb3NpdGlvbk5hbWUnOiAnVGl0bGUnLFxuICAgICAgICBPYmplY3RMaXN0OiB7XG4gICAgICAgICAgTXVsdGlsaW5ndWFsVGV4dEl0ZW06IHtcbiAgICAgICAgICAgICdAX0lEJzogbmV4dFVJZCgpLFxuICAgICAgICAgICAgJ0BfQ29tcG9zaXRpb25OYW1lJzogJ0l0ZW1zJyxcbiAgICAgICAgICAgIEF0dHJpYnV0ZUxpc3Q6IHsgQ3VsdHVyZTogJ2VuLVVTJywgVGV4dDogJycgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICAnQF9JRCc6IG5leHRVSWQoKSxcbiAgICAnQF9Db21wb3NpdGlvbk5hbWUnOiAnQ29tcGlsZVVuaXRzJyxcbiAgICBBdHRyaWJ1dGVMaXN0OiB7XG4gICAgICBOZXR3b3JrU291cmNlOiB7XG4gICAgICAgIEZsZ05ldDoge1xuICAgICAgICAgICdAX3htbG5zJzogJ2h0dHA6Ly93d3cuc2llbWVucy5jb20vYXV0b21hdGlvbi9PcGVubmVzcy9TVy9OZXR3b3JrU291cmNlL0ZsZ05ldC92NCcsXG4gICAgICAgICAgUGFydHM6IHBhcnRzT2JqLFxuICAgICAgICAgIFdpcmVzOiB7IFdpcmU6IHdpcmVzIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgUHJvZ3JhbW1pbmdMYW5ndWFnZTogJ0xBRCcsXG4gICAgfSxcbiAgICBPYmplY3RMaXN0OiBPYmplY3Qua2V5cyhvYmplY3RMaXN0SXRlbXMpLmxlbmd0aCA+IDAgPyBvYmplY3RMaXN0SXRlbXMgOiB7XG4gICAgICBNdWx0aWxpbmd1YWxUZXh0OiBbXG4gICAgICAgIHtcbiAgICAgICAgICAnQF9JRCc6IG5leHRVSWQoKSxcbiAgICAgICAgICAnQF9Db21wb3NpdGlvbk5hbWUnOiAnQ29tbWVudCcsXG4gICAgICAgICAgT2JqZWN0TGlzdDogeyBNdWx0aWxpbmd1YWxUZXh0SXRlbTogeyAnQF9JRCc6IG5leHRVSWQoKSwgJ0BfQ29tcG9zaXRpb25OYW1lJzogJ0l0ZW1zJywgQXR0cmlidXRlTGlzdDogeyBDdWx0dXJlOiAnZW4tVVMnLCBUZXh0OiAnJyB9IH0gfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICdAX0lEJzogbmV4dFVJZCgpLFxuICAgICAgICAgICdAX0NvbXBvc2l0aW9uTmFtZSc6ICdUaXRsZScsXG4gICAgICAgICAgT2JqZWN0TGlzdDogeyBNdWx0aWxpbmd1YWxUZXh0SXRlbTogeyAnQF9JRCc6IG5leHRVSWQoKSwgJ0BfQ29tcG9zaXRpb25OYW1lJzogJ0l0ZW1zJywgQXR0cmlidXRlTGlzdDogeyBDdWx0dXJlOiAnZW4tVVMnLCBUZXh0OiAnJyB9IH0gfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gYnVpbGRTaW1hdGljRkJETmV0d29yayhmYmQ6IEZCRFByb2dyYW0sIG5leHRVSWQ6ICgpID0+IHN0cmluZyk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgY29uc3QgcGFydHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+W10gPSBbXTtcbiAgY29uc3QgYWNjZXNzZXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+W10gPSBbXTtcbiAgY29uc3Qgd2lyZXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+W10gPSBbXTtcblxuICAvLyBFbWl0IGJsb2NrcyBhcyBQYXJ0IGVsZW1lbnRzLCB2YXJpYWJsZXMgYXMgQWNjZXNzIGVsZW1lbnRzXG4gIGZvciAoY29uc3Qgbm9kZSBvZiBmYmQubm9kZXMpIHtcbiAgICBjb25zdCB1aWQgPSBub2RlLmlkLnJlcGxhY2UoJ2ZiZC0nLCAnJykgfHwgbmV4dFVJZCgpO1xuICAgIGlmIChub2RlLnR5cGUgPT09ICdJTl9WQVJJQUJMRScgfHwgbm9kZS50eXBlID09PSAnT1VUX1ZBUklBQkxFJykge1xuICAgICAgLy8gRml4IDExOiBoYW5kbGUgZG90LXBhdGggdGFnIG5hbWVzIHVzaW5nIG11bHRpcGxlIENvbXBvbmVudCBlbGVtZW50c1xuICAgICAgY29uc3QgdGFnUGFydHMgPSAobm9kZS50YWc/Lm5hbWUgfHwgJycpLnNwbGl0KCcuJyk7XG4gICAgICBjb25zdCBzeW1ib2xDb21wb25lbnQgPSB0YWdQYXJ0cy5sZW5ndGggPT09IDFcbiAgICAgICAgPyB7IENvbXBvbmVudDogeyAnQF9OYW1lJzogdGFnUGFydHNbMF0gfSB9XG4gICAgICAgIDogeyBDb21wb25lbnQ6IHRhZ1BhcnRzLm1hcChwID0+ICh7ICdAX05hbWUnOiBwIH0pKSB9O1xuICAgICAgYWNjZXNzZXMucHVzaCh7XG4gICAgICAgICdAX1VJZCc6IHVpZCxcbiAgICAgICAgJ0BfU2NvcGUnOiAnR2xvYmFsVmFyaWFibGUnLFxuICAgICAgICBTeW1ib2w6IHN5bWJvbENvbXBvbmVudCxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUZW1wbGF0ZVZhbHVlIHNwZWNpZmllcyB0aGUgU0lNQVRJQyBkYXRhIHR5cGUgZm9yIGdlbmVyaWMvcG9seW1vcnBoaWMgaW5zdHJ1Y3Rpb25zXG4gICAgICAvLyAoZS5nLiBBREQsIE1PVkUpLiBAX1R5cGUgbXVzdCBiZSBhIFNJTUFUSUMgdHlwZSBzdHJpbmcgbGlrZSAnSW50JywgJ1JlYWwnLCBub3QgYSBkaXJlY3Rpb24uXG4gICAgICAvLyBXZSBlbWl0IFRlbXBsYXRlVmFsdWUgb25seSBpZiB0aGVyZSBpcyBhIG5vbi1CT09MIHR5cGVkIGlucHV0IHBpbiB0byBwYXJhbWV0ZXJpemUuXG4gICAgICBjb25zdCB0ZW1wbGF0ZVZhbHVlczogUmVjb3JkPHN0cmluZywgc3RyaW5nPltdID0gW107XG4gICAgICBmb3IgKGNvbnN0IHBpbiBvZiAobm9kZS5pbnB1dHMgfHwgW10pKSB7XG4gICAgICAgIGlmIChwaW4uZGF0YVR5cGUgJiYgcGluLmRhdGFUeXBlICE9PSAnQk9PTCcgJiYgKHBpbi5kYXRhVHlwZSBhcyBzdHJpbmcpICE9PSAnQU5ZJykge1xuICAgICAgICAgIGNvbnN0IHNpbWF0aWNUeXBlID0gaWVjVHlwZVRvU2ltYXRpYyhwaW4uZGF0YVR5cGUgYXMgaW1wb3J0KCcuLi8uLi9sb2dpY1N0b3JlLmpzJykuSUVDRGF0YVR5cGUpIHx8IHBpbi5kYXRhVHlwZTtcbiAgICAgICAgICB0ZW1wbGF0ZVZhbHVlcy5wdXNoKHsgJ0BfTmFtZSc6ICdDYXJkJywgJ0BfVHlwZSc6IHNpbWF0aWNUeXBlIH0pO1xuICAgICAgICAgIGJyZWFrOyAvLyBvbmUgVGVtcGxhdGVWYWx1ZSBwZXIgYmxvY2sgaXMgc3VmZmljaWVudCBmb3IgdHlwZSBpbmZlcmVuY2VcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY29uc3QgZmJkRXhwb3J0TmFtZSA9IG5vZGUudmVuZG9yT3JpZ2luYWxOYW1lIHx8IGNsbUZCVHlwZVRvU2llbWVucyhub2RlLnR5cGUgYXMgRkJUeXBlKTtcbiAgICAgIHBhcnRzLnB1c2goe1xuICAgICAgICAnQF9OYW1lJzogZmJkRXhwb3J0TmFtZSxcbiAgICAgICAgJ0BfVUlkJzogdWlkLFxuICAgICAgICAuLi4odGVtcGxhdGVWYWx1ZXMubGVuZ3RoID4gMCA/IHsgVGVtcGxhdGVWYWx1ZTogdGVtcGxhdGVWYWx1ZXMgfSA6IHt9KSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIEVtaXQgd2lyZXMgd2l0aCBOYW1lQ29uIHBhaXJzXG4gIGZvciAoY29uc3Qgd2lyZSBvZiBmYmQud2lyZXMpIHtcbiAgICB3aXJlcy5wdXNoKHtcbiAgICAgICdAX1VJZCc6IG5leHRVSWQoKSxcbiAgICAgIE5hbWVDb246IFtcbiAgICAgICAgeyAnQF9VSWQnOiB3aXJlLmZyb20ubm9kZUlkLnJlcGxhY2UoJ2ZiZC0nLCAnJyksICdAX05hbWUnOiB3aXJlLmZyb20ucGluIH0sXG4gICAgICAgIHsgJ0BfVUlkJzogd2lyZS50by5ub2RlSWQucmVwbGFjZSgnZmJkLScsICcnKSwgJ0BfTmFtZSc6IHdpcmUudG8ucGluIH0sXG4gICAgICBdLFxuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgcGFydHNPYmo6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XG4gIGlmIChwYXJ0cy5sZW5ndGgpIHBhcnRzT2JqLlBhcnQgPSBwYXJ0cztcbiAgaWYgKGFjY2Vzc2VzLmxlbmd0aCkgcGFydHNPYmouQWNjZXNzID0gYWNjZXNzZXM7XG5cbiAgcmV0dXJuIHtcbiAgICAnQF9JRCc6IG5leHRVSWQoKSxcbiAgICBBdHRyaWJ1dGVMaXN0OiB7XG4gICAgICBQcm9ncmFtbWluZ0xhbmd1YWdlOiAnRkJEJyxcbiAgICAgIE5ldHdvcmtTb3VyY2U6IHtcbiAgICAgICAgRmxnTmV0OiB7XG4gICAgICAgICAgJ0BfeG1sbnMnOiAnaHR0cDovL3d3dy5zaWVtZW5zLmNvbS9hdXRvbWF0aW9uL09wZW5uZXNzL1NXL05ldHdvcmtTb3VyY2UvRmxnTmV0L3Y0JyxcbiAgICAgICAgICBQYXJ0czogcGFydHNPYmosXG4gICAgICAgICAgV2lyZXM6IHsgV2lyZTogd2lyZXMubGVuZ3RoID8gd2lyZXMgOiBbXSB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9O1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgR1JBUEggKFNGQykgZXhwb3J0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBidWlsZFNpbWF0aWNHUkFQSE5ldHdvcmtzKFxuICBzZmM6IFNGQ1Byb2dyYW0sXG4gIG5leHRVSWQ6ICgpID0+IHN0cmluZyxcbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+W10ge1xuICAvLyBBc3NpZ24gc3RhYmxlIE51bWJlciBhdHRyaWJ1dGVzIFx1MjAxNCBleHRyYWN0IGZyb20gSURzIG9yIGFsbG9jYXRlIGZyZXNoIG9uZXNcbiAgbGV0IGNvdW50ZXIgPSAxO1xuICBjb25zdCBhbGxvY051bSA9IChpZDogc3RyaW5nLCBwcmVmaXg6IHN0cmluZyk6IHN0cmluZyA9PiB7XG4gICAgY29uc3QgbSA9IGlkLm1hdGNoKG5ldyBSZWdFeHAoYF4ke3ByZWZpeH0oXFxcXGQrKSRgKSk7XG4gICAgcmV0dXJuIG0gPyBtWzFdIDogU3RyaW5nKGNvdW50ZXIrKyk7XG4gIH07XG5cbiAgLy8gQnVpbGQgc3RlcCBcdTIxOTIgTnVtYmVyIG1hcFxuICBjb25zdCBzdGVwTnVtTWFwID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgZm9yIChjb25zdCBzdGVwIG9mIHNmYy5zdGVwcykge1xuICAgIHN0ZXBOdW1NYXAuc2V0KHN0ZXAuaWQsIGFsbG9jTnVtKHN0ZXAuaWQsICdzaWVtZW5zLXN0ZXAtJykpO1xuICB9XG5cbiAgLy8gQnVpbGQgdHJhbnNpdGlvbiBcdTIxOTIgTnVtYmVyIG1hcFxuICBjb25zdCB0cmFuc051bU1hcCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIGZvciAoY29uc3QgdHJhbnMgb2Ygc2ZjLnRyYW5zaXRpb25zKSB7XG4gICAgdHJhbnNOdW1NYXAuc2V0KHRyYW5zLmlkLCBhbGxvY051bSh0cmFucy5pZCwgJ3NpZW1lbnMtdHJhbnMtJykpO1xuICB9XG5cbiAgLy8gQnVpbGQgZXhwb3J0cyBhcnJheXNcbiAgY29uc3QgZXhwb3J0ZWRTdGVwczogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSA9IHNmYy5zdGVwcy5tYXAoc3RlcCA9PiB7XG4gICAgY29uc3QgbnVtID0gc3RlcE51bU1hcC5nZXQoc3RlcC5pZCkgfHwgU3RyaW5nKGNvdW50ZXIrKyk7XG4gICAgLy8gUmVhbCBUSUEgR1JBUEggZm9ybWF0OiBBY3Rpb25zIGNvbnRhaW5zIFRpdGxlIChNdWx0aUxhbmd1YWdlVGV4dCksIG5vdCBBY3Rpb24gZWxlbWVudHNcbiAgICBjb25zdCBhY3Rpb25UaXRsZSA9IHN0ZXAuYWN0aW9ucy5sZW5ndGggPiAwID8gc3RlcC5hY3Rpb25zWzBdLnRhZy5uYW1lIDogc3RlcC5uYW1lO1xuICAgIC8vIFN1cGVydmlzaW9ucyBhbmQgSW50ZXJsb2NrcyB1c2UgaW5saW5lIEZsZ05ldCB3aXRoIFN2Q29pbC9JbENvaWwgUGFydFxuICAgIGNvbnN0IHN2RmxnTmV0ID0geyBQYXJ0czogeyBQYXJ0OiB7ICdAX05hbWUnOiAnU3ZDb2lsJywgJ0BfVUlkJzogJzIxJyB9IH0sIFdpcmVzOiB7IFdpcmU6IHsgJ0BfVUlkJzogJzIyJywgUG93ZXJyYWlsOiB7fSwgTmFtZUNvbjogeyAnQF9VSWQnOiAnMjEnLCAnQF9OYW1lJzogJ2luJyB9IH0gfSB9O1xuICAgIGNvbnN0IGlsRmxnTmV0ID0geyBQYXJ0czogeyBQYXJ0OiB7ICdAX05hbWUnOiAnSWxDb2lsJywgJ0BfVUlkJzogJzIxJyB9IH0sIFdpcmVzOiB7IFdpcmU6IHsgJ0BfVUlkJzogJzIyJywgUG93ZXJyYWlsOiB7fSwgTmFtZUNvbjogeyAnQF9VSWQnOiAnMjEnLCAnQF9OYW1lJzogJ2luJyB9IH0gfSB9O1xuICAgIHJldHVybiB7XG4gICAgICAnQF9OdW1iZXInOiBudW0sXG4gICAgICAnQF9Jbml0JzogU3RyaW5nKHN0ZXAuaXNJbml0aWFsKSxcbiAgICAgICdAX05hbWUnOiBzdGVwLm5hbWUsXG4gICAgICAnQF9NYXhpbXVtU3RlcFRpbWUnOiAnVCMxMFMnLFxuICAgICAgJ0BfV2FybmluZ1RpbWUnOiAnVCM3UycsXG4gICAgICBBY3Rpb25zOiB7IFRpdGxlOiB7IE11bHRpTGFuZ3VhZ2VUZXh0OiB7ICdAX0xhbmcnOiAnZW4tVVMnLCAnI3RleHQnOiBhY3Rpb25UaXRsZSB9IH0gfSxcbiAgICAgIFN1cGVydmlzaW9uczogeyBTdXBlcnZpc2lvbjogeyAnQF9Qcm9ncmFtbWluZ0xhbmd1YWdlJzogJ0xBRCcsIEZsZ05ldDogc3ZGbGdOZXQgfSB9LFxuICAgICAgSW50ZXJsb2NrczogeyBJbnRlcmxvY2s6IHsgJ0BfUHJvZ3JhbW1pbmdMYW5ndWFnZSc6ICdMQUQnLCBGbGdOZXQ6IGlsRmxnTmV0IH0gfSxcbiAgICB9O1xuICB9KTtcblxuICBjb25zdCBleHBvcnRlZFRyYW5zaXRpb25zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdID0gc2ZjLnRyYW5zaXRpb25zLm1hcCh0cmFucyA9PiB7XG4gICAgY29uc3QgbnVtID0gdHJhbnNOdW1NYXAuZ2V0KHRyYW5zLmlkKSB8fCBTdHJpbmcoY291bnRlcisrKTtcbiAgICAvLyBCdWlsZCBpbmxpbmUgRmxnTmV0IGZvciB0aGUgdHJhbnNpdGlvbiBjb25kaXRpb24gKFRJQSBHUkFQSCBmb3JtYXQpXG4gICAgLy8gU2ltcGxlIGNhc2U6IFRyQ29pbCB3aXRoIFBvd2VycmFpbCBjb25uZWN0aW9uIChhbHdheXMtdHJ1ZSBvciBjb25kaXRpb24tYmFzZWQpXG4gICAgY29uc3QgZmxnTmV0OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAgIFBhcnRzOiB7IFBhcnQ6IHsgJ0BfTmFtZSc6ICdUckNvaWwnLCAnQF9VSWQnOiAnMjEnIH0gfSxcbiAgICAgIFdpcmVzOiB7IFdpcmU6IHsgJ0BfVUlkJzogJzIyJywgUG93ZXJyYWlsOiB7fSwgTmFtZUNvbjogeyAnQF9VSWQnOiAnMjEnLCAnQF9OYW1lJzogJ2luJyB9IH0gfSxcbiAgICB9O1xuICAgIHJldHVybiB7XG4gICAgICAnQF9Jc01pc3NpbmcnOiAnZmFsc2UnLFxuICAgICAgJ0BfTmFtZSc6IHRyYW5zLmNvbmRpdGlvbixcbiAgICAgICdAX051bWJlcic6IG51bSxcbiAgICAgICdAX1Byb2dyYW1taW5nTGFuZ3VhZ2UnOiAnTEFEJyxcbiAgICAgIEZsZ05ldDogZmxnTmV0LFxuICAgIH07XG4gIH0pO1xuXG4gIC8vIEJyYW5jaGVzOiBvbmUgQWx0QmVnaW4gKyBvbmUgQWx0RW5kIChvciBTaW1CZWdpbi9TaW1FbmQpIHBlciBicmFuY2hcbiAgY29uc3QgZXhwb3J0ZWRCcmFuY2hlczogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSA9IFtdO1xuICAvLyBicmFuY2ggYmFyIElEcyBmcm9tIGxpbmtzXG4gIGNvbnN0IGJyYW5jaEJhcklkcyA9IG5ldyBTZXQoc2ZjLmxpbmtzLmZsYXRNYXAobCA9PiBbbC5mcm9tLCBsLnRvXSkuZmlsdGVyKGlkID0+IGlkLnN0YXJ0c1dpdGgoJ3NpZW1lbnMtYnJhbmNoLScpKSk7XG4gIGNvbnN0IGVtaXR0ZWRCcmFuY2hOdW1zID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGxldCBicmFuY2hDb3VudGVyID0gMTtcbiAgY29uc3QgYnJhbmNoQmFyTnVtTWFwID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblxuICBmb3IgKGNvbnN0IGJhcklkIG9mIGJyYW5jaEJhcklkcykge1xuICAgIGNvbnN0IGV4aXN0aW5nTnVtID0gYmFySWQucmVwbGFjZSgnc2llbWVucy1icmFuY2gtJywgJycpO1xuICAgIGlmICghYnJhbmNoQmFyTnVtTWFwLmhhcyhiYXJJZCkpIHtcbiAgICAgIGJyYW5jaEJhck51bU1hcC5zZXQoYmFySWQsIC9eXFxkKyQvLnRlc3QoZXhpc3RpbmdOdW0pID8gZXhpc3RpbmdOdW0gOiBTdHJpbmcoYnJhbmNoQ291bnRlcisrKSk7XG4gICAgfVxuICB9XG5cbiAgLy8gQnVpbGQgYnJhbmNoIGRlY2xhcmF0aW9ucyBmcm9tIFNGQ0JyYW5jaCByZWNvcmRzXG4gIGNvbnN0IGVtaXR0ZWRCcmFuY2hEZWNscyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBmb3IgKGNvbnN0IGJyYW5jaCBvZiAoc2ZjLmJyYW5jaGVzID8/IFtdKSkge1xuICAgIGNvbnN0IGlzU2ltdWx0YW5lb3VzID0gYnJhbmNoLnR5cGUgPT09ICdBTkQnO1xuICAgIGNvbnN0IGJlZ2luVHlwZSA9IGlzU2ltdWx0YW5lb3VzID8gJ1NpbUJlZ2luJyA6ICdBbHRCZWdpbic7XG4gICAgY29uc3QgZW5kVHlwZSAgID0gaXNTaW11bHRhbmVvdXMgPyAnU2ltRW5kJyAgIDogJ0FsdEVuZCc7XG4gICAgY29uc3QgY2FyZGluYWxpdHkgPSBicmFuY2guYnJhbmNoU3RlcElkcy5sZW5ndGg7XG4gICAgY29uc3QgYmVnaW5OdW0gPSBTdHJpbmcoYnJhbmNoQ291bnRlcisrKTtcbiAgICBjb25zdCBlbmROdW0gICA9IFN0cmluZyhicmFuY2hDb3VudGVyKyspO1xuICAgIGlmICghZW1pdHRlZEJyYW5jaERlY2xzLmhhcyhicmFuY2guaWQpKSB7XG4gICAgICBlbWl0dGVkQnJhbmNoRGVjbHMuYWRkKGJyYW5jaC5pZCk7XG4gICAgICBleHBvcnRlZEJyYW5jaGVzLnB1c2goeyAnQF9OdW1iZXInOiBiZWdpbk51bSwgJ0BfVHlwZSc6IGJlZ2luVHlwZSwgJ0BfQ2FyZGluYWxpdHknOiBTdHJpbmcoY2FyZGluYWxpdHkpIH0pO1xuICAgICAgZXhwb3J0ZWRCcmFuY2hlcy5wdXNoKHsgJ0BfTnVtYmVyJzogZW5kTnVtLCAgICdAX1R5cGUnOiBlbmRUeXBlLCAgICdAX0NhcmRpbmFsaXR5JzogU3RyaW5nKGNhcmRpbmFsaXR5KSB9KTtcbiAgICB9XG4gIH1cblxuICAvLyBDb25uZWN0aW9ucyBcdTIwMTQgY29udmVydCBDTE0gU0ZDTGlua1tdIHRvIFRJQSBDb25uZWN0aW9uIGVsZW1lbnRzXG4gIGNvbnN0IGV4cG9ydGVkQ29ubmVjdGlvbnM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+W10gPSBbXTtcblxuICBjb25zdCBtYWtlTm9kZUZyb20gPSAoaWQ6IHN0cmluZyk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0+IHtcbiAgICBpZiAoaWQuc3RhcnRzV2l0aCgnc2llbWVucy1zdGVwLScpKSByZXR1cm4geyBTdGVwUmVmOiB7ICdAX051bWJlcic6IHN0ZXBOdW1NYXAuZ2V0KGlkKSB8fCBpZC5yZXBsYWNlKCdzaWVtZW5zLXN0ZXAtJywgJycpIH0gfTtcbiAgICBpZiAoaWQuc3RhcnRzV2l0aCgnc2llbWVucy10cmFucy0nKSkgcmV0dXJuIHsgVHJhbnNpdGlvblJlZjogeyAnQF9OdW1iZXInOiB0cmFuc051bU1hcC5nZXQoaWQpIHx8IGlkLnJlcGxhY2UoJ3NpZW1lbnMtdHJhbnMtJywgJycpIH0gfTtcbiAgICBpZiAoaWQuc3RhcnRzV2l0aCgnc2llbWVucy1icmFuY2gtJykpIHJldHVybiB7IEJyYW5jaFJlZjogeyAnQF9OdW1iZXInOiBicmFuY2hCYXJOdW1NYXAuZ2V0KGlkKSB8fCBpZC5yZXBsYWNlKCdzaWVtZW5zLWJyYW5jaC0nLCAnJyksICdAX091dCc6ICcwJyB9IH07XG4gICAgcmV0dXJuIHsgU3RlcFJlZjogeyAnQF9OdW1iZXInOiBpZCB9IH07XG4gIH07XG4gIGNvbnN0IG1ha2VOb2RlVG8gPSAoaWQ6IHN0cmluZyk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0+IHtcbiAgICBpZiAoaWQuc3RhcnRzV2l0aCgnc2llbWVucy1zdGVwLScpKSByZXR1cm4geyBTdGVwUmVmOiB7ICdAX051bWJlcic6IHN0ZXBOdW1NYXAuZ2V0KGlkKSB8fCBpZC5yZXBsYWNlKCdzaWVtZW5zLXN0ZXAtJywgJycpIH0gfTtcbiAgICBpZiAoaWQuc3RhcnRzV2l0aCgnc2llbWVucy10cmFucy0nKSkgcmV0dXJuIHsgVHJhbnNpdGlvblJlZjogeyAnQF9OdW1iZXInOiB0cmFuc051bU1hcC5nZXQoaWQpIHx8IGlkLnJlcGxhY2UoJ3NpZW1lbnMtdHJhbnMtJywgJycpIH0gfTtcbiAgICBpZiAoaWQuc3RhcnRzV2l0aCgnc2llbWVucy1icmFuY2gtJykpIHJldHVybiB7IEJyYW5jaFJlZjogeyAnQF9OdW1iZXInOiBicmFuY2hCYXJOdW1NYXAuZ2V0KGlkKSB8fCBpZC5yZXBsYWNlKCdzaWVtZW5zLWJyYW5jaC0nLCAnJyksICdAX0luJzogJzAnIH0gfTtcbiAgICBpZiAoaWQuc3RhcnRzV2l0aCgnc2llbWVucy1qdW1wLScpKSB7XG4gICAgICBjb25zdCBqdW1wID0gc2ZjLmp1bXBzPy5maW5kKGogPT4gai5pZCA9PT0gaWQpO1xuICAgICAgY29uc3QgdGFyZ2V0TnVtID0gc3RlcE51bU1hcC5nZXQoYHNpZW1lbnMtc3RlcC0ke2p1bXA/LnRhcmdldFN0ZXBOYW1lfWApIHx8ICcxJztcbiAgICAgIHJldHVybiB7IFN0ZXBSZWY6IHsgJ0BfTnVtYmVyJzogdGFyZ2V0TnVtIH0gfTtcbiAgICB9XG4gICAgcmV0dXJuIHsgU3RlcFJlZjogeyAnQF9OdW1iZXInOiBpZCB9IH07XG4gIH07XG5cbiAgZm9yIChjb25zdCBsaW5rIG9mIHNmYy5saW5rcykge1xuICAgIGNvbnN0IGlzSnVtcExpbmsgPSBsaW5rLnRvLnN0YXJ0c1dpdGgoJ3NpZW1lbnMtanVtcC0nKTtcbiAgICBleHBvcnRlZENvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgTm9kZUZyb206IG1ha2VOb2RlRnJvbShsaW5rLmZyb20pLFxuICAgICAgTm9kZVRvOiAgIG1ha2VOb2RlVG8obGluay50byksXG4gICAgICBMaW5rVHlwZTogaXNKdW1wTGluayA/ICdKdW1wJyA6ICdEaXJlY3QnLFxuICAgIH0pO1xuICB9XG5cbiAgY29uc3Qgc2VxdWVuY2U6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XG4gIGlmIChleHBvcnRlZFN0ZXBzLmxlbmd0aCkgICAgICAgc2VxdWVuY2UuU3RlcHMgICAgICAgPSB7IFN0ZXA6IGV4cG9ydGVkU3RlcHMgfTtcbiAgaWYgKGV4cG9ydGVkVHJhbnNpdGlvbnMubGVuZ3RoKSBzZXF1ZW5jZS5UcmFuc2l0aW9ucyA9IHsgVHJhbnNpdGlvbjogZXhwb3J0ZWRUcmFuc2l0aW9ucyB9O1xuICBpZiAoZXhwb3J0ZWRCcmFuY2hlcy5sZW5ndGgpICAgIHNlcXVlbmNlLkJyYW5jaGVzICAgID0geyBCcmFuY2g6IGV4cG9ydGVkQnJhbmNoZXMgfTtcbiAgaWYgKGV4cG9ydGVkQ29ubmVjdGlvbnMubGVuZ3RoKSBzZXF1ZW5jZS5Db25uZWN0aW9ucyA9IHsgQ29ubmVjdGlvbjogZXhwb3J0ZWRDb25uZWN0aW9ucyB9O1xuXG4gIC8vIEZpeCAxMjogYWRkIFByZU9wZXJhdGlvbnMgYW5kIFBvc3RPcGVyYXRpb25zIHN0dWJzXG4gIGNvbnN0IGdyYXBoOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAnQF94bWxucyc6ICdodHRwOi8vd3d3LnNpZW1lbnMuY29tL2F1dG9tYXRpb24vT3Blbm5lc3MvU1cvTmV0d29ya1NvdXJjZS9HcmFwaC92MScsXG4gICAgUHJlT3BlcmF0aW9uczogeyBQZXJtYW5lbnRPcGVyYXRpb246IHsgJ0BfUHJvZ3JhbW1pbmdMYW5ndWFnZSc6ICdGQkQnIH0gfSxcbiAgICBTZXF1ZW5jZTogc2VxdWVuY2UsXG4gICAgUG9zdE9wZXJhdGlvbnM6IHsgUGVybWFuZW50T3BlcmF0aW9uOiB7ICdAX1Byb2dyYW1taW5nTGFuZ3VhZ2UnOiAnRkJEJyB9IH0sXG4gIH07XG5cbiAgcmV0dXJuIFt7XG4gICAgJ0BfSUQnOiBuZXh0VUlkKCksXG4gICAgQXR0cmlidXRlTGlzdDoge1xuICAgICAgUHJvZ3JhbW1pbmdMYW5ndWFnZTogJ0dSQVBIJyxcbiAgICAgIE5ldHdvcmtTb3VyY2U6IHsgR3JhcGg6IGdyYXBoIH0sXG4gICAgfSxcbiAgfV07XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFjQSxTQUFTLFVBQVUsVUFBVSxNQUFNLE1BQU0sT0FBTyxrQkFBa0I7QUFDbEUsU0FBUyxrQkFBa0Isd0JBQXdCO0FBQ25ELFNBQVMsZUFBZSw0QkFBNEI7QUFDcEQsU0FBUyxnQkFBZ0Isc0JBQXNCO0FBWS9DLElBQUksT0FBTztBQUNYLFNBQVMsTUFBTSxRQUF3QjtBQUFFLFNBQU8sR0FBRyxNQUFNLElBQUksRUFBRSxJQUFJLElBQUksS0FBSyxPQUFPLEVBQUUsU0FBUyxFQUFFLEVBQUUs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
