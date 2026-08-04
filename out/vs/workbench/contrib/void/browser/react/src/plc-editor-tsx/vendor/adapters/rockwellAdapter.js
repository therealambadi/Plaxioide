import { parseXML, buildXML, attr, text, child, childArray } from "../xmlUtils.js";
import { rockwellTypeToIEC, iecTypeToRockwell } from "../dataTypeMap.js";
import { buildResolver, VariableTypeResolver } from "../variableTypeResolver.js";
import { getPinDataType, buildTypedPins } from "../pinSignatures.js";
let _uid = 0;
function uid(prefix) {
  return `${prefix}-${++_uid}-${Math.random().toString(36).slice(2, 8)}`;
}
function unescapeXML(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
function importRockwell(xmlContent, filePath) {
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
  const content = child(root, "RSLogix5000Content");
  if (!content) {
    return { ok: false, errors: ["No <RSLogix5000Content> root found"], warnings: [] };
  }
  const schemaRevision = attr(content, "SchemaRevision");
  const controller = child(content, "Controller");
  if (!controller) {
    return { ok: false, errors: ["No <Controller> element found"], warnings: [] };
  }
  const projectName = attr(controller, "Name") || "L5X Import";
  const globalTags = [];
  const tagsEl = child(controller, "Tags");
  const tagsRetain = tagsEl ? attr(tagsEl, "Use") === "Retain" : false;
  for (const tagEl of childArray(tagsEl, "Tag")) {
    const tag = parseL5XTag(tagEl, tagsRetain, unmapped);
    if (tag) globalTags.push(tag);
  }
  for (const udtEl of childArray(child(controller, "DataTypes"), "DataType")) {
    unmapped.push({
      clmNodeId: null,
      vendorSpecificData: udtEl,
      reason: `User-Defined Type "${attr(udtEl, "Name")}" \u2014 preserved in sidecar`
    });
  }
  const pous = [];
  for (const programEl of childArray(child(controller, "Programs"), "Program")) {
    const pouList = parseL5XProgram(programEl, unmapped, warnings);
    pous.push(...pouList);
  }
  const modulesEl = child(controller, "Modules");
  if (modulesEl) {
    unmapped.push({ clmNodeId: null, vendorSpecificData: modulesEl, reason: "Modules element" });
  }
  const tasksEl = child(controller, "Tasks");
  if (tasksEl) {
    unmapped.push({ clmNodeId: null, vendorSpecificData: tasksEl, reason: "Tasks element" });
  }
  for (const aoiEl of childArray(child(controller, "AddOnInstructionDefinitions"), "AddOnInstructionDefinition")) {
    const name = attr(aoiEl, "Name");
    warnings.push(`Add-On Instruction "${name}" cannot be converted to standard IEC blocks \u2014 preserved in sidecar.`);
    unmapped.push({ clmNodeId: null, vendorSpecificData: aoiEl, reason: `AOI: ${name}` });
  }
  if (pous.length === 0) {
    errors.push("No programs or routines found in L5X file");
    return { ok: false, errors, warnings };
  }
  const sidecar = {
    sourceVendor: "rockwell_l5x",
    sourceFileVersion: schemaRevision || "1.0",
    originalFilePath: filePath,
    unmappedElements: unmapped,
    organizerTreeLayout: child(controller, "Programs"),
    vendorSpecificGlobals: {
      schemaRevision: attr(content, "SchemaRevision") || "1.0",
      softwareRevision: attr(content, "SoftwareRevision") || "32.0",
      controllerName: attr(controller, "Name") || "",
      processorType: attr(controller, "ProcessorType") || "1769-L33ER"
    }
  };
  return { ok: true, project: { projectName, pous, globalTags, sidecar }, errors, warnings };
}
function parseL5XTag(tagEl, parentRetain, unmapped) {
  if (!tagEl || typeof tagEl !== "object") return null;
  const name = attr(tagEl, "Name");
  if (!name) return null;
  const typeStr = attr(tagEl, "DataType");
  const dataType = rockwellTypeToIEC(typeStr);
  const desc = text(child(child(tagEl, "Description"), "#cdata") ?? child(tagEl, "Description"));
  if (dataType === "STRUCT" && !["TIMER", "COUNTER", "CONTROL"].includes(typeStr.toUpperCase())) {
    unmapped.push({ clmNodeId: null, vendorSpecificData: tagEl, reason: `Non-standard struct type: ${typeStr}` });
  }
  const aliasFor = attr(tagEl, "AliasFor");
  const address = aliasFor || void 0;
  const retain = parentRetain || false;
  return {
    name,
    dataType,
    description: desc || void 0,
    address,
    initialValue: parseL5XValue(child(tagEl, "DefaultData") ?? child(tagEl, "Data")),
    retain
  };
}
function parseL5XValue(dataEl) {
  if (!dataEl) return void 0;
  const v = text(dataEl);
  return v || void 0;
}
function parseL5XProgram(programEl, unmapped, warnings) {
  if (!programEl || typeof programEl !== "object") return [];
  const programName = attr(programEl, "Name");
  const localTags = [];
  const progTagsEl = child(programEl, "Tags");
  const progRetain = progTagsEl ? attr(progTagsEl, "Use") === "Retain" : false;
  for (const tagEl of childArray(progTagsEl, "Tag")) {
    const tag = parseL5XTag(tagEl, progRetain, unmapped);
    if (tag) localTags.push(tag);
  }
  const pous = [];
  for (const routineEl of childArray(child(programEl, "Routines"), "Routine")) {
    const routineName = attr(routineEl, "Name");
    const routineType = attr(routineEl, "Type") || "RLL";
    const resolver = buildResolver(localTags, []);
    if (routineType === "RLL") {
      const ladder = parseL5XRLL(routineEl, unmapped, warnings);
      pous.push({
        id: `pou-${programName}-${routineName}`,
        name: `${programName}_${routineName}`,
        language: "LD",
        ladderProgram: ladder,
        localTags,
        pouType: "program"
      });
    } else if (routineType === "FBD") {
      const fbd = parseL5XFBD(routineEl, unmapped, warnings, resolver);
      if (fbd) {
        pous.push({
          id: `pou-${programName}-${routineName}`,
          name: `${programName}_${routineName}`,
          language: "FBD",
          fbdProgram: fbd,
          localTags,
          pouType: "program"
        });
      } else {
        warnings.push(`Routine "${routineName}" is FBD \u2014 preserved in sidecar.`);
        unmapped.push({ clmNodeId: null, vendorSpecificData: routineEl, reason: `FBD routine: ${routineName}` });
      }
    } else if (routineType === "ST") {
      const stContentEl = child(routineEl, "STContent");
      let stSource = "";
      if (stContentEl) {
        const lines = childArray(stContentEl, "Line");
        if (lines.length > 0) {
          const lineMap = /* @__PURE__ */ new Map();
          let maxLine = 0;
          for (const lineEl of lines) {
            const num = Number(attr(lineEl, "Number")) || 0;
            const lineText = text(lineEl) || "";
            lineMap.set(num, unescapeXML(lineText));
            if (num > maxLine) maxLine = num;
          }
          const stLines = [];
          for (let n = 0; n <= maxLine; n++) {
            stLines.push(lineMap.get(n) ?? "");
          }
          stSource = stLines.join("\n");
        } else {
          const rawSt = text(stContentEl);
          stSource = rawSt ? unescapeXML(rawSt) : "";
        }
      }
      pous.push({
        id: `pou-${programName}-${routineName}`,
        name: `${programName}_${routineName}`,
        language: "ST",
        stSource,
        localTags,
        pouType: "program"
      });
    } else if (routineType === "SFC") {
      const sfcContentEl = child(routineEl, "SFCContent");
      const stLines = [];
      if (sfcContentEl) {
        for (const transEl of childArray(sfcContentEl, "Transition")) {
          const condEl = child(transEl, "Condition");
          const condStEl = condEl ? child(condEl, "STContent") : null;
          if (condStEl) {
            const condLines = childArray(condStEl, "Line");
            for (const lineEl of condLines) {
              const lt = text(lineEl) || "";
              if (lt) stLines.push(unescapeXML(lt));
            }
          }
        }
      }
      unmapped.push({ clmNodeId: null, vendorSpecificData: routineEl, reason: `SFC routine: ${routineName}` });
      pous.push({
        id: `pou-${programName}-${routineName}`,
        name: `${programName}_${routineName}`,
        language: "ST",
        stSource: stLines.length > 0 ? `// SFC Transition conditions from ${routineName}
${stLines.join("\n")}` : `// SFC routine: ${routineName} (structure preserved in sidecar)`,
        localTags,
        pouType: "program"
      });
    } else {
      unmapped.push({ clmNodeId: null, vendorSpecificData: routineEl, reason: `Unsupported routine type: ${routineType}` });
    }
  }
  return pous;
}
function parseL5XRLL(routineEl, unmapped, warnings) {
  const rungs = [];
  const rllEl = child(routineEl, "RLLContent");
  for (const rungEl of childArray(rllEl, "Rung")) {
    const number = Number(attr(rungEl, "Number")) || rungs.length;
    const rungType = attr(rungEl, "Type") || "N";
    const comment = text(child(rungEl, "Comment"));
    const textContent = text(child(rungEl, "Text"));
    const { elements, branches } = parseRungText(textContent, number, unmapped, warnings);
    rungs.push({
      id: `rung-${number}`,
      number,
      comment: comment || "",
      elements,
      branches,
      vendorType: rungType
    });
  }
  return { rungs };
}
function parseRungText(rungText, rungNumber, unmapped, warnings) {
  if (!rungText) return { elements: [], branches: [] };
  const stripped = rungText.trim().replace(/;$/, "");
  return parseBracketBranchText(stripped, rungNumber, unmapped, warnings);
}
function tokenizeRungText(text2) {
  const tokens = [];
  const tokenPattern = /([A-Za-z_][A-Za-z0-9_]*)(?:\(([^)]*(?:\([^)]*\)[^)]*)*)\))?/g;
  let match;
  while ((match = tokenPattern.exec(text2)) !== null) {
    const instr = match[1].toUpperCase();
    const argsStr = match[2] ?? "";
    const args = argsStr ? splitArgs(argsStr) : [];
    tokens.push({ instr, args });
  }
  return tokens;
}
function splitArgs(argsStr) {
  const args = [];
  let current = "";
  let depth = 0;
  for (const ch of argsStr) {
    if (ch === "(" || ch === "[") {
      depth++;
      current += ch;
    } else if (ch === ")" || ch === "]") {
      depth--;
      current += ch;
    } else if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}
function parseBracketBranchText(text2, rungNumber, unmapped, warnings) {
  const allElements = [];
  const allBranches = [];
  let posX = 0;
  let i = 0;
  while (i < text2.length) {
    let parenDepth = 0;
    let bracketStart = -1;
    for (let j = i; j < text2.length; j++) {
      const ch = text2[j];
      if (ch === "(") parenDepth++;
      else if (ch === ")") parenDepth--;
      else if (ch === "[" && parenDepth === 0) {
        bracketStart = j;
        break;
      }
    }
    if (bracketStart === -1) {
      const mainPart = text2.slice(i).trim();
      if (mainPart) {
        const tokens = tokenizeRungText(mainPart);
        for (const tok of tokens) {
          const el = mapL5XInstruction(tok.instr, tok.args, posX, rungNumber, unmapped, warnings);
          if (el) {
            allElements.push(el);
            posX += 60;
          }
        }
      }
      break;
    }
    const prePart = text2.slice(i, bracketStart).trim();
    if (prePart) {
      const tokens = tokenizeRungText(prePart);
      for (const tok of tokens) {
        const el = mapL5XInstruction(tok.instr, tok.args, posX, rungNumber, unmapped, warnings);
        if (el) {
          allElements.push(el);
          posX += 60;
        }
      }
    }
    let depth = 0;
    let parenD = 0;
    let bracketEnd = -1;
    for (let j = bracketStart; j < text2.length; j++) {
      const ch = text2[j];
      if (ch === "(") parenD++;
      else if (ch === ")") parenD--;
      else if (ch === "[" && parenD === 0) depth++;
      else if (ch === "]" && parenD === 0) {
        depth--;
        if (depth === 0) {
          bracketEnd = j;
          break;
        }
      }
    }
    if (bracketEnd === -1) {
      i = bracketStart + 1;
      continue;
    }
    const bracketContent = text2.slice(bracketStart + 1, bracketEnd);
    const legs = [];
    let legStart = 0;
    let pd = 0;
    let bd = 0;
    for (let j = 0; j < bracketContent.length; j++) {
      const ch = bracketContent[j];
      if (ch === "(") pd++;
      else if (ch === ")") pd--;
      else if (ch === "[") bd++;
      else if (ch === "]") bd--;
      else if (ch === "," && pd === 0 && bd === 0) {
        legs.push(bracketContent.slice(legStart, j).trim());
        legStart = j + 1;
      }
    }
    legs.push(bracketContent.slice(legStart).trim());
    const joinNodeId = allElements.length > 0 ? allElements[allElements.length - 1].id : `rung${rungNumber}-rail`;
    const legElements = legs.map((leg) => {
      const legTokens = tokenizeRungText(leg);
      const elements = [];
      let lx = posX;
      for (const tok of legTokens) {
        const el = mapL5XInstruction(tok.instr, tok.args, lx, rungNumber, unmapped, warnings);
        if (el) {
          elements.push(el);
          lx += 60;
        }
      }
      return elements;
    });
    for (const el of legElements[0] ?? []) {
      allElements.push(el);
    }
    if (legElements[0]?.length) posX += legElements[0].length * 60;
    for (let li = 1; li < legElements.length; li++) {
      const legEls = legElements[li];
      if (legEls.length > 0) {
        allBranches.push({
          id: `rung${rungNumber}-branch-${allBranches.length}`,
          startNodeId: joinNodeId,
          endNodeId: legEls[legEls.length - 1].id,
          elements: legEls
        });
      }
    }
    i = bracketEnd + 1;
  }
  return { elements: allElements, branches: allBranches };
}
function parseTokensWithBranches(tokens, rungNumber, unmapped, warnings) {
  const mainElements = [];
  const branches = [];
  let posX = 0;
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.instr === "BST") {
      const branchSet = parseBranchSet(tokens, i, rungNumber, unmapped, warnings);
      branches.push(...branchSet.branches);
      i = branchSet.endIndex;
      posX += 60;
    } else {
      const el = mapL5XInstruction(token.instr, token.args, posX, rungNumber, unmapped, warnings);
      if (el) {
        mainElements.push(el);
        posX += 60;
      }
      i++;
    }
  }
  return { elements: mainElements, branches };
}
function parseBranchSet(tokens, startIdx, rungNumber, unmapped, warnings) {
  const branches = [];
  let i = startIdx + 1;
  let currentBranchElements = [];
  let branchPosX = 0;
  let branchCount = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.instr === "NXB") {
      if (currentBranchElements.length > 0) {
        branches.push({
          id: uid(`branch-r${rungNumber}`),
          startNodeId: `rung-${rungNumber}-branch-start-${branchCount}`,
          endNodeId: `rung-${rungNumber}-branch-end-${branchCount}`,
          elements: currentBranchElements
        });
      }
      branchCount++;
      currentBranchElements = [];
      branchPosX = 0;
      i++;
    } else if (token.instr === "BND") {
      if (currentBranchElements.length > 0) {
        branches.push({
          id: uid(`branch-r${rungNumber}`),
          startNodeId: `rung-${rungNumber}-branch-start-${branchCount}`,
          endNodeId: `rung-${rungNumber}-branch-end-${branchCount}`,
          elements: currentBranchElements
        });
      }
      i++;
      break;
    } else if (token.instr === "BST") {
      const nested = parseBranchSet(tokens, i, rungNumber, unmapped, warnings);
      for (const nb of nested.branches) {
        currentBranchElements.push(...nb.elements);
      }
      i = nested.endIndex;
    } else {
      const el = mapL5XInstruction(token.instr, token.args, branchPosX, rungNumber, unmapped, warnings);
      if (el) {
        currentBranchElements.push(el);
        branchPosX += 60;
      }
      i++;
    }
  }
  if (currentBranchElements.length > 0) {
    branches.push({
      id: uid(`branch-r${rungNumber}`),
      startNodeId: `rung-${rungNumber}-branch-start-${branchCount}`,
      endNodeId: `rung-${rungNumber}-branch-end-${branchCount}`,
      elements: currentBranchElements
    });
  }
  return { branches, endIndex: i };
}
const L5X_CONTACT_MAP = {
  XIC: "NO",
  XIO: "NC",
  OSR: "P_CONTACT",
  OSF: "N_CONTACT",
  ONS: "P_CONTACT"
  // One-Shot — maps to rising edge contact
};
const L5X_COIL_MAP = {
  OTE: "normal",
  OTL: "latch",
  OTU: "unlatch",
  OTN: "negated"
};
const L5X_TIMER_MAP = {
  TON: "TON",
  TOF: "TOF",
  RTO: "TON",
  TP: "TP",
  TONR: "TONR"
};
const L5X_COUNTER_MAP = {
  CTU: "CTU",
  CTD: "CTD",
  CTUD: "CTUD"
};
const L5X_COMPARE_MAP = {
  EQU: "EQ",
  NEQ: "NE",
  GRT: "GT",
  GEQ: "GE",
  LES: "LT",
  LEQ: "LE",
  LIM: "LIMIT",
  MEQ: "EQ",
  // Short aliases used in some L5X exports
  EQ: "EQ",
  NE: "NE",
  GT: "GT",
  GE: "GE",
  LT: "LT",
  LE: "LE",
  // CMP — generic compare with expression string
  CMP: "EQ"
};
const L5X_MATH_MAP = {
  ADD: "ADD",
  SUB: "SUB",
  MUL: "MUL",
  DIV: "DIV",
  MOD: "MOD",
  ABS: "ABS",
  SQR: "SQRT",
  SQRT: "SQRT",
  NEG: "NEG",
  // Trig / advanced math
  SIN: "SIN",
  COS: "COS",
  TAN: "TAN",
  ATN: "ATAN",
  ATAN: "ATAN",
  ASN: "ASIN",
  ACS: "ACOS",
  LN: "LN",
  LOG: "LOG",
  // CPT — Compute expression into destination (represent as ADD placeholder)
  CPT: "ADD"
};
const L5X_MOVE_MAP = {
  MOV: "MOVE",
  MOVE: "MOVE",
  COP: "MOVE",
  CPS: "MOVE",
  FLL: "MOVE",
  BTD: "BTD",
  SIZE: "SIZE"
};
const L5X_BITWISE_MAP = {
  AND: "AND",
  OR: "OR",
  NOT: "NOT",
  XOR: "XOR",
  BAND: "AND",
  BOR: "OR",
  BNOT: "NOT",
  BXOR: "XOR"
};
const L5X_SELECT_MAP = {
  SEL: "SEL",
  MUX: "MUX",
  LIMIT: "LIMIT",
  MIN: "MIN",
  MAX: "MAX",
  LIM: "LIMIT",
  MEQ: "EQ",
  // Type conversion
  TRUNC: "TRUNC",
  ROUND: "ROUND",
  INT_TO_REAL: "INT_TO_REAL",
  REAL_TO_INT: "REAL_TO_INT",
  DINT_TO_REAL: "DINT_TO_REAL",
  REAL_TO_DINT: "REAL_TO_DINT",
  // Scaling
  SCL: "SCALE",
  SCP: "SCALE",
  // Bit shift
  SHL: "MOVE",
  SHR: "MOVE",
  ROL: "MOVE",
  ROR: "MOVE",
  BSL: "MOVE",
  BSR: "MOVE"
};
const L5X_FIFO_MAP = {
  FFL: "FFL",
  FFU: "FFU",
  LFL: "LFL",
  LFU: "LFU"
};
const L5X_SEQ_MAP = {
  SQO: "SQO",
  SQI: "SQI",
  SQL: "SQL"
};
const L5X_PID_MAP = {
  PID: "PID",
  PIDE: "PID",
  PIDAT: "PID"
};
const L5X_STRING_MAP = {
  // Length / concat / compare
  LEN: "LEN",
  CONCAT: "CONCAT",
  FIND: "FIND",
  INSERT: "INSERT",
  DELETE: "DELETE",
  MID: "MID",
  UPPER: "UPPER_CASE",
  LOWER: "LOWER_CASE",
  LEFT: "LEFT",
  RIGHT: "RIGHT",
  // String comparison
  STRCMP: "EQ",
  STRICMP: "EQ",
  // String to number / number to string
  STOD: "MOVE",
  DTOS: "MOVE"
};
const L5X_MOTION_SET = /* @__PURE__ */ new Set([
  "MAJ",
  "MAM",
  "MAS",
  "MAOC",
  "MAAT",
  "MAFR",
  "MAHD",
  "MARP",
  "MARW",
  // MAR — Motion Axis Registration: MAR(axis, registration, edge, ...)
  "MAR",
  "MCD",
  "MCT",
  "MCCD",
  "MCTD",
  "MCP",
  "MCM",
  "GSV",
  "SSV",
  "MSG"
]);
const L5X_DIAG_SET = /* @__PURE__ */ new Set([
  "EOT",
  "EFS",
  "UID",
  "UIE",
  "ONS",
  // handled above as contact, but guard here too
  "RESD",
  "SETD"
]);
function makeBlock(instr, fbType, instanceSuffix, rungNumber, pins, posX) {
  return {
    kind: "block",
    id: uid(`r${rungNumber}-${instr}`),
    fbType,
    instanceName: `${instr}_${instanceSuffix}`,
    pins,
    position: { x: posX, y: 0 },
    vendorOriginalName: instr !== fbType ? instr : void 0
  };
}
function mapL5XInstruction(instr, args, posX, rungNumber, unmapped, warnings) {
  if (L5X_CONTACT_MAP[instr]) {
    const tagName = args[0] || `TAG_${posX}`;
    const extraTag = (instr === "OSR" || instr === "OSF") && args[1] ? args[1] : void 0;
    return {
      kind: "contact",
      id: uid(`r${rungNumber}-${instr}`),
      type: L5X_CONTACT_MAP[instr],
      tag: { name: tagName, dataType: "BOOL" },
      position: { x: posX, y: 0 },
      vendorArgs: extraTag ? [tagName, extraTag] : void 0
    };
  }
  if (L5X_COIL_MAP[instr]) {
    const tagName = args[0] || `TAG_${posX}`;
    return {
      kind: "coil",
      id: uid(`r${rungNumber}-${instr}`),
      type: L5X_COIL_MAP[instr],
      tag: { name: tagName, dataType: "BOOL" },
      position: { x: posX, y: 0 }
    };
  }
  if (L5X_TIMER_MAP[instr]) {
    const instanceName = args[0] && args[0] !== "?" ? args[0] : `${instr}_${posX}`;
    const preset = args[1] && args[1] !== "?" ? args[1] : `${instanceName}.PRE`;
    return makeBlock(instr, L5X_TIMER_MAP[instr], posX, rungNumber, {
      EN: { name: instanceName + ".EN", dataType: "BOOL" },
      PT: { name: preset, dataType: "DINT" },
      Q: { name: instanceName + ".DN", dataType: "BOOL" },
      ET: { name: instanceName + ".ACC", dataType: "DINT" }
    }, posX);
  }
  if (L5X_COUNTER_MAP[instr]) {
    const instanceName = args[0] && args[0] !== "?" ? args[0] : `${instr}_${posX}`;
    const preset = args[1] && args[1] !== "?" ? args[1] : `${instanceName}.PRE`;
    return makeBlock(instr, L5X_COUNTER_MAP[instr], posX, rungNumber, {
      CU: { name: instanceName + ".CU", dataType: "BOOL" },
      PV: { name: preset, dataType: "DINT" },
      QU: { name: instanceName + ".DN", dataType: "BOOL" },
      CV: { name: instanceName + ".ACC", dataType: "DINT" }
    }, posX);
  }
  if (L5X_MATH_MAP[instr]) {
    const dest = args[args.length - 1] || `RESULT_${posX}`;
    const sourceA = args[0] || "0";
    const sourceB = args.length >= 3 ? args[1] : "0";
    return makeBlock(instr, L5X_MATH_MAP[instr], posX, rungNumber, {
      IN1: { name: sourceA, dataType: "REAL" },
      IN2: { name: sourceB, dataType: "REAL" },
      OUT: { name: dest, dataType: "REAL" }
    }, posX);
  }
  if (L5X_COMPARE_MAP[instr]) {
    if (instr === "LIM") {
      const low = args[0] || "0";
      const test = args[1] || "0";
      const high = args[2] || "0";
      return makeBlock(instr, "LIMIT", posX, rungNumber, {
        MN: { name: low, dataType: "DINT" },
        IN: { name: test, dataType: "DINT" },
        MX: { name: high, dataType: "DINT" },
        OUT: { name: `_LIM_${posX}`, dataType: "BOOL" }
      }, posX);
    }
    if (instr === "MEQ") {
      const src = args[0] || "0";
      const mask = args[1] || "0";
      const cmp = args[2] || "0";
      return makeBlock(instr, "EQ", posX, rungNumber, {
        IN1: { name: src, dataType: "DINT" },
        MASK: { name: mask, dataType: "DWORD" },
        IN2: { name: cmp, dataType: "DINT" },
        OUT: { name: `_MEQ_${posX}`, dataType: "BOOL" }
      }, posX);
    }
    const sourceA = args[0] || "0";
    const sourceB = args[1] || "0";
    return makeBlock(instr, L5X_COMPARE_MAP[instr], posX, rungNumber, {
      IN1: { name: sourceA, dataType: "DINT" },
      IN2: { name: sourceB, dataType: "DINT" },
      OUT: { name: `_CMP_${posX}`, dataType: "BOOL" }
    }, posX);
  }
  if (L5X_MOVE_MAP[instr]) {
    const source = args[0] || "0";
    const dest = args[1] || `DEST_${posX}`;
    if (instr === "BTD") {
      return makeBlock(instr, "BTD", posX, rungNumber, {
        IN: { name: source, dataType: "DINT" },
        SRC_BIT: { name: args[1] || "0", dataType: "DINT" },
        OUT: { name: args[2] || dest, dataType: "DINT" },
        DST_BIT: { name: args[3] || "0", dataType: "DINT" },
        LEN: { name: args[4] || "1", dataType: "DINT" }
      }, posX);
    }
    if (instr === "SIZE") {
      return makeBlock(instr, "SIZE", posX, rungNumber, {
        IN: { name: source, dataType: "DINT" },
        DIM: { name: args[1] || "0", dataType: "DINT" },
        OUT: { name: args[2] || `DEST_${posX}`, dataType: "DINT" }
      }, posX);
    }
    return makeBlock(instr, L5X_MOVE_MAP[instr], posX, rungNumber, {
      IN: { name: source, dataType: "DINT" },
      OUT: { name: dest, dataType: "DINT" }
    }, posX);
  }
  if (L5X_BITWISE_MAP[instr]) {
    const src1 = args[0] || "0";
    const src2 = args.length >= 3 ? args[1] : "0";
    const dest = args[args.length - 1] || `RESULT_${posX}`;
    return makeBlock(instr, L5X_BITWISE_MAP[instr], posX, rungNumber, {
      IN1: { name: src1, dataType: "DINT" },
      IN2: { name: src2, dataType: "DINT" },
      OUT: { name: dest, dataType: "DINT" }
    }, posX);
  }
  if (L5X_SELECT_MAP[instr]) {
    if (instr === "SEL") {
      const sel = args[0] || "0";
      const in1 = args[1] || "0";
      const in2 = args[2] || "0";
      const dest2 = args[3] || `DEST_${posX}`;
      return makeBlock(instr, "SEL", posX, rungNumber, {
        G: { name: sel, dataType: "BOOL" },
        IN0: { name: in1, dataType: "DINT" },
        IN1: { name: in2, dataType: "DINT" },
        OUT: { name: dest2, dataType: "DINT" }
      }, posX);
    }
    if (instr === "MUX") {
      const sel = args[0] || "0";
      const dest2 = args[args.length - 1] || `DEST_${posX}`;
      const inputPins = { K: { name: sel, dataType: "DINT" } };
      args.slice(1, args.length - 1).forEach((a, i) => {
        inputPins[`IN${i}`] = { name: a, dataType: "DINT" };
      });
      inputPins["OUT"] = { name: dest2, dataType: "DINT" };
      return makeBlock(instr, "MUX", posX, rungNumber, inputPins, posX);
    }
    if (instr === "LIMIT" || instr === "LIM") {
      return makeBlock(instr, "LIMIT", posX, rungNumber, {
        MN: { name: args[0] || "0", dataType: "DINT" },
        IN: { name: args[1] || "0", dataType: "DINT" },
        MX: { name: args[2] || "0", dataType: "DINT" },
        OUT: { name: `_LIM_${posX}`, dataType: "BOOL" }
      }, posX);
    }
    if (instr === "MIN" || instr === "MAX") {
      return makeBlock(instr, L5X_SELECT_MAP[instr], posX, rungNumber, {
        IN1: { name: args[0] || "0", dataType: "REAL" },
        IN2: { name: args[1] || "0", dataType: "REAL" },
        OUT: { name: args[2] || `DEST_${posX}`, dataType: "REAL" }
      }, posX);
    }
    if (instr === "SCL" || instr === "SCP") {
      return makeBlock(instr, "SCALE", posX, rungNumber, {
        IN: { name: args[0] || "0", dataType: "DINT" },
        InMin: { name: args[1] || "0", dataType: "DINT" },
        InMax: { name: args[2] || "0", dataType: "DINT" },
        OUT: { name: args[3] || `DEST_${posX}`, dataType: "REAL" }
      }, posX);
    }
    const src = args[0] || "0";
    const dest = args[args.length - 1] || `DEST_${posX}`;
    return makeBlock(instr, L5X_SELECT_MAP[instr], posX, rungNumber, {
      IN: { name: src, dataType: "DINT" },
      OUT: { name: dest, dataType: "DINT" }
    }, posX);
  }
  if (L5X_FIFO_MAP[instr]) {
    const isFill = instr === "FFL" || instr === "LFL";
    const validArg = (a) => !a || a === "?" ? void 0 : a;
    if (isFill) {
      const ctrl = validArg(args[2]) || `${instr}_CTRL`;
      return makeBlock(instr, L5X_FIFO_MAP[instr], posX, rungNumber, {
        IN: { name: validArg(args[0]) || "0", dataType: "DINT" },
        FIFO: { name: validArg(args[1]) || `${instr}_Q`, dataType: "DINT" },
        CTRL: { name: ctrl, dataType: "CONTROL" },
        LEN: { name: `${ctrl}.LEN`, dataType: "DINT" },
        POS: { name: `${ctrl}.POS`, dataType: "DINT" },
        EM: { name: `${ctrl}.EM`, dataType: "BOOL" },
        DN: { name: `${ctrl}.DN`, dataType: "BOOL" }
      }, posX);
    } else {
      const ctrl = validArg(args[2]) || `${instr}_CTRL`;
      return makeBlock(instr, L5X_FIFO_MAP[instr], posX, rungNumber, {
        FIFO: { name: validArg(args[0]) || `${instr}_Q`, dataType: "DINT" },
        OUT: { name: validArg(args[1]) || `DEST_${posX}`, dataType: "DINT" },
        CTRL: { name: ctrl, dataType: "CONTROL" },
        LEN: { name: `${ctrl}.LEN`, dataType: "DINT" },
        POS: { name: `${ctrl}.POS`, dataType: "DINT" },
        EM: { name: `${ctrl}.EM`, dataType: "BOOL" },
        DN: { name: `${ctrl}.DN`, dataType: "BOOL" }
      }, posX);
    }
  }
  if (L5X_SEQ_MAP[instr]) {
    return makeBlock(instr, L5X_SEQ_MAP[instr], posX, rungNumber, {
      FILE: { name: args[0] || `${instr}_FILE`, dataType: "DINT" },
      MASK: { name: args[1] || "0", dataType: "DWORD" },
      DEST: { name: args[2] || `DEST_${posX}`, dataType: "DINT" },
      CTRL: { name: args[3] || `${instr}_CTRL`, dataType: "DINT" },
      LEN: { name: args[4] || "0", dataType: "DINT" },
      POS: { name: args[5] || "0", dataType: "DINT" },
      DN: { name: `${args[3] || instr}.DN`, dataType: "BOOL" },
      ER: { name: `${args[3] || instr}.ER`, dataType: "BOOL" }
    }, posX);
  }
  if (L5X_PID_MAP[instr]) {
    return makeBlock(instr, L5X_PID_MAP[instr], posX, rungNumber, {
      IN: { name: args[1] || `PV_${posX}`, dataType: "REAL" },
      SP: { name: `${args[0] || instr}.SP`, dataType: "REAL" },
      OUT: { name: args[3] || `CV_${posX}`, dataType: "REAL" },
      KP: { name: `${args[0] || instr}.KP`, dataType: "REAL" },
      KI: { name: `${args[0] || instr}.KI`, dataType: "REAL" },
      KD: { name: `${args[0] || instr}.KD`, dataType: "REAL" },
      EN: { name: `${args[0] || instr}.EN`, dataType: "BOOL" }
    }, posX);
  }
  if (L5X_STRING_MAP[instr]) {
    const src1 = args[0] || `STR_${posX}`;
    const src2 = args.length >= 3 ? args[1] : "";
    const dest = args[args.length - 1] || `DEST_${posX}`;
    if (instr === "MID") {
      return makeBlock(instr, "MID", posX, rungNumber, {
        IN: { name: src1, dataType: "STRING" },
        LEN: { name: args[1] || "1", dataType: "DINT" },
        START: { name: args[2] || "1", dataType: "DINT" },
        OUT: { name: dest, dataType: "STRING" }
      }, posX);
    }
    if (instr === "CONCAT") {
      return makeBlock(instr, "CONCAT", posX, rungNumber, {
        IN1: { name: src1, dataType: "STRING" },
        IN2: { name: src2 || "", dataType: "STRING" },
        OUT: { name: dest, dataType: "STRING" }
      }, posX);
    }
    if (instr === "FIND") {
      return makeBlock(instr, "FIND", posX, rungNumber, {
        IN1: { name: src1, dataType: "STRING" },
        IN2: { name: src2 || "", dataType: "STRING" },
        OUT: { name: dest, dataType: "DINT" }
      }, posX);
    }
    if (instr === "INSERT") {
      return makeBlock(instr, "INSERT", posX, rungNumber, {
        IN1: { name: src1, dataType: "STRING" },
        IN2: { name: src2 || "", dataType: "STRING" },
        POS: { name: args[2] || "1", dataType: "DINT" },
        OUT: { name: dest, dataType: "STRING" }
      }, posX);
    }
    if (instr === "DELETE") {
      return makeBlock(instr, "DELETE", posX, rungNumber, {
        IN: { name: src1, dataType: "STRING" },
        LEN: { name: args[1] || "1", dataType: "DINT" },
        START: { name: args[2] || "1", dataType: "DINT" },
        OUT: { name: dest, dataType: "STRING" }
      }, posX);
    }
    return makeBlock(instr, L5X_STRING_MAP[instr], posX, rungNumber, {
      IN: { name: src1, dataType: "STRING" },
      OUT: { name: dest, dataType: instr === "LEN" ? "DINT" : "STRING" }
    }, posX);
  }
  if (L5X_MOTION_SET.has(instr)) {
    const instanceName = args[0] || `${instr}_${posX}`;
    const block = makeBlock(instr, "MOVE", posX, rungNumber, {
      IN: { name: instanceName, dataType: "DINT" }
    }, posX);
    unmapped.push({
      clmNodeId: block.id,
      vendorSpecificData: { instr, args },
      reason: `Motion/GSV/MSG instruction (canvas placeholder): ${instr}(${args.join(",")})`
    });
    return block;
  }
  if (instr === "RES") {
    const tagName = args[0] || `TAG_${posX}`;
    return {
      kind: "coil",
      id: uid(`r${rungNumber}-RES`),
      type: "reset",
      tag: { name: tagName, dataType: "DINT" },
      position: { x: posX, y: 0 }
    };
  }
  if (L5X_DIAG_SET.has(instr)) {
    if (instr === "UID" || instr === "UIE") return null;
    return makeBlock(instr, "MOVE", posX, rungNumber, {}, posX);
  }
  if (instr === "EVENT") {
    const taskName = args[0] || "EVENT_TASK";
    return {
      kind: "coil",
      id: uid(`r${rungNumber}-EVENT`),
      type: "normal",
      tag: { name: `_EVENT_${taskName}`, dataType: "BOOL" },
      position: { x: posX, y: 0 }
    };
  }
  if (instr === "JSR") {
    const routineName = args[0] || "UNKNOWN";
    return makeBlock(instr, "MOVE", posX, rungNumber, {
      ROUTINE: { name: routineName, dataType: "STRING" },
      IN: { name: args[1] || "0", dataType: "DINT" },
      OUT: { name: args[2] || "0", dataType: "DINT" }
    }, posX);
  }
  if (instr === "RET") {
    return {
      kind: "coil",
      id: uid(`r${rungNumber}-RET`),
      type: "normal",
      tag: { name: "_RET", dataType: "BOOL" },
      position: { x: posX, y: 0 }
    };
  }
  if (instr === "SBR") return null;
  if (instr === "AFI") {
    return {
      kind: "contact",
      id: uid(`r${rungNumber}-AFI`),
      type: "NC",
      tag: { name: "_ALWAYS_FALSE", dataType: "BOOL" },
      position: { x: posX, y: 0 }
    };
  }
  if (instr === "NOP") return null;
  if (instr === "JMP") {
    const label = args[0] || "LBL0";
    return makeBlock(instr, "MOVE", posX, rungNumber, {
      LABEL: { name: label, dataType: "STRING" }
    }, posX);
  }
  if (instr === "LBL") {
    const label = args[0] || "LBL0";
    return makeBlock(instr, "MOVE", posX, rungNumber, {
      LABEL: { name: label, dataType: "STRING" }
    }, posX);
  }
  if (instr === "MCR") return null;
  if (instr === "TND") {
    return {
      kind: "coil",
      id: uid(`r${rungNumber}-TND`),
      type: "normal",
      tag: { name: "_TND", dataType: "BOOL" },
      position: { x: posX, y: 0 }
    };
  }
  if (instr === "FOR") {
    return makeBlock(instr, "MOVE", posX, rungNumber, {
      ROUTINE: { name: args[0] || "LOOP", dataType: "STRING" },
      INDEX: { name: args[1] || "0", dataType: "DINT" },
      INIT: { name: args[2] || "0", dataType: "DINT" },
      TERM: { name: args[3] || "0", dataType: "DINT" },
      STEP: { name: args[4] || "1", dataType: "DINT" }
    }, posX);
  }
  if (instr === "NEXT") return null;
  if (instr === "BRK") return null;
  if (instr === "FAL" || instr === "FSC") {
    const ctrl = args[0] || `${instr}_CTRL`;
    return makeBlock(instr, "MOVE", posX, rungNumber, {
      CTRL: { name: ctrl, dataType: "CONTROL" },
      LEN: { name: args[1] || "0", dataType: "DINT" },
      POS: { name: args[2] || "0", dataType: "DINT" },
      MODE: { name: args[3] || "0", dataType: "DINT" },
      DEST: { name: args[4] || "0", dataType: "DINT" },
      EXPR: { name: args[5] || "0", dataType: "DINT" }
    }, posX);
  }
  if (instr === "AVE" || instr === "SRT" || instr === "STD") {
    const ctrl = args[1] || `${instr}_CTRL`;
    return makeBlock(instr, "MOVE", posX, rungNumber, {
      ARRAY: { name: args[0] || "0", dataType: "DINT" },
      CTRL: { name: ctrl, dataType: "CONTROL" },
      DEST: { name: args[2] || "0", dataType: "REAL" },
      LEN: { name: args[3] || "0", dataType: "DINT" },
      POS: { name: args[4] || "0", dataType: "DINT" }
    }, posX);
  }
  unmapped.push({
    clmNodeId: null,
    vendorSpecificData: { instr, args },
    reason: `Unsupported Rockwell instruction: ${instr}(${args.join(",")})`
  });
  return null;
}
function parseL5XFBD(routineEl, unmapped, warnings, resolver = new VariableTypeResolver()) {
  const sheets = childArray(routineEl, "Sheet") ?? childArray(child(routineEl, "FBDContent"), "Sheet");
  if (!sheets || sheets.length === 0) return null;
  const nodes = [];
  const wires = [];
  for (const sheet of sheets) {
    for (const blockEl of childArray(sheet, "Block").concat(childArray(sheet, "FBD_Block"))) {
      const id = attr(blockEl, "ID") || uid("fbd-block");
      const typeName = attr(blockEl, "Type") || "UNKNOWN";
      const x = Number(attr(blockEl, "X")) || 0;
      const y = Number(attr(blockEl, "Y")) || 0;
      const instanceName = attr(blockEl, "Operand") || attr(blockEl, "Name") || "";
      const blockType = mapRockwellFBDType(typeName);
      const inputs = [];
      const outputs = [];
      const visiblePinsAttr = attr(blockEl, "VisiblePins") || "";
      if (visiblePinsAttr) {
        const pinNames = visiblePinsAttr.split(/\s+/).filter(Boolean);
        for (const pinName of pinNames) {
          const asInput = getPinDataType(typeName, pinName, "input");
          const asOutput = getPinDataType(typeName, pinName, "output");
          const isOutput = asOutput !== "BOOL" || pinName === "Out" || pinName === "Dest" || /^(Out|Dest|Q[UDN]?|Result|DN|EN_O|ENO)$/i.test(pinName);
          if (isOutput) {
            outputs.push({ id: uid("pin"), name: pinName, dataType: asOutput });
          } else {
            inputs.push({ id: uid("pin"), name: pinName, dataType: asInput });
          }
        }
      }
      if (inputs.length === 0 && outputs.length === 0) {
        for (const pinEl of childArray(blockEl, "FBD_BlockPin")) {
          const pinName = attr(pinEl, "Name") || `pin${inputs.length + outputs.length}`;
          const pinId = attr(pinEl, "ID") || uid("pin");
          const use = attr(pinEl, "Use") || "";
          if (use === "Output") {
            outputs.push({ id: pinId, name: pinName, dataType: getPinDataType(typeName, pinName, "output") });
          } else {
            inputs.push({ id: pinId, name: pinName, dataType: getPinDataType(typeName, pinName, "input") });
          }
        }
        for (const pinEl of childArray(blockEl, "InputPin")) {
          const pinName = attr(pinEl, "Name") || `in${inputs.length}`;
          const pinId = attr(pinEl, "ID") || uid("pin");
          inputs.push({ id: pinId, name: pinName, dataType: getPinDataType(typeName, pinName, "input") });
        }
        for (const pinEl of childArray(blockEl, "OutputPin")) {
          const pinName = attr(pinEl, "Name") || `out${outputs.length}`;
          const pinId = attr(pinEl, "ID") || uid("pin");
          outputs.push({ id: pinId, name: pinName, dataType: getPinDataType(typeName, pinName, "output") });
        }
      }
      if (inputs.length === 0 && outputs.length === 0) {
        const { inputs: sigIn, outputs: sigOut } = buildTypedPins(typeName, [], id);
        inputs.push(...sigIn);
        outputs.push(...sigOut);
      } else {
        if (inputs.length === 0) inputs.push({ id: uid("pin"), name: "EN", dataType: "BOOL" });
        if (outputs.length === 0) outputs.push({ id: uid("pin"), name: "OUT", dataType: "BOOL" });
      }
      nodes.push({
        id,
        type: blockType,
        instanceName: instanceName || void 0,
        position: { x, y },
        inputs,
        outputs
      });
    }
    for (const aoiEl of childArray(sheet, "AddOnInstruction")) {
      const id = attr(aoiEl, "ID") || uid("aoi");
      const typeName = attr(aoiEl, "Name") || "AOI";
      const x = Number(attr(aoiEl, "X")) || 0;
      const y = Number(attr(aoiEl, "Y")) || 0;
      const instanceName = attr(aoiEl, "Operand") || "";
      const visiblePinsAttr = attr(aoiEl, "VisiblePins") || "";
      const pinNames = visiblePinsAttr.split(/\s+/).filter(Boolean);
      const aoiInputs = [];
      const aoiOutputs = [];
      for (const pinName of pinNames) {
        const isOutput = /^(EnableOut|ENO|Out\d*|Dest\d*)$/i.test(pinName);
        if (isOutput) aoiOutputs.push({ id: uid("pin"), name: pinName, dataType: "BOOL" });
        else aoiInputs.push({ id: uid("pin"), name: pinName, dataType: "BOOL" });
      }
      for (const iopEl of childArray(aoiEl, "InOutParameter")) {
        const pName = attr(iopEl, "Name") || "";
        aoiInputs.push({ id: uid("pin"), name: pName, dataType: "DINT" });
      }
      if (aoiInputs.length === 0) aoiInputs.push({ id: uid("pin"), name: "EnableIn", dataType: "BOOL" });
      if (aoiOutputs.length === 0) aoiOutputs.push({ id: uid("pin"), name: "EnableOut", dataType: "BOOL" });
      const blockType = mapRockwellFBDType(typeName);
      nodes.push({
        id,
        type: blockType,
        instanceName: instanceName || void 0,
        position: { x, y },
        inputs: aoiInputs,
        outputs: aoiOutputs,
        vendorOriginalName: typeName
      });
      unmapped.push({
        clmNodeId: id,
        vendorSpecificData: aoiEl,
        reason: `AOI call in FBD sheet: ${typeName}(${instanceName})`
      });
    }
    for (const irefEl of childArray(sheet, "IRef")) {
      const id = attr(irefEl, "ID") || uid("iref");
      const operand = attr(irefEl, "Operand") || "";
      const x = Number(attr(irefEl, "X")) || 0;
      const y = Number(attr(irefEl, "Y")) || 0;
      const irefType = resolver.resolve(operand);
      nodes.push({
        id,
        type: "IN_VARIABLE",
        position: { x, y },
        inputs: [],
        outputs: [{ id: uid("pin"), name: "OUT", dataType: irefType }],
        tag: { name: operand, dataType: irefType }
      });
    }
    for (const orefEl of childArray(sheet, "ORef")) {
      const id = attr(orefEl, "ID") || uid("oref");
      const operand = attr(orefEl, "Operand") || "";
      const x = Number(attr(orefEl, "X")) || 0;
      const y = Number(attr(orefEl, "Y")) || 0;
      const orefType = resolver.resolve(operand);
      nodes.push({
        id,
        type: "OUT_VARIABLE",
        position: { x, y },
        inputs: [{ id: uid("pin"), name: "IN", dataType: orefType }],
        outputs: [],
        tag: { name: operand, dataType: orefType }
      });
    }
    for (const iconEl of childArray(sheet, "ICon")) {
      const id = attr(iconEl, "ID") || uid("icon");
      const name = attr(iconEl, "Name") || "";
      const x = Number(attr(iconEl, "X")) || 0;
      const y = Number(attr(iconEl, "Y")) || 0;
      nodes.push({
        id,
        type: "IN_VARIABLE",
        position: { x, y },
        inputs: [],
        outputs: [{ id: uid("pin"), name: "", dataType: "BOOL" }],
        tag: { name, dataType: "BOOL" }
      });
    }
    for (const oconEl of childArray(sheet, "OCon")) {
      const id = attr(oconEl, "ID") || uid("ocon");
      const name = attr(oconEl, "Name") || "";
      const x = Number(attr(oconEl, "X")) || 0;
      const y = Number(attr(oconEl, "Y")) || 0;
      nodes.push({
        id,
        type: "OUT_VARIABLE",
        position: { x, y },
        inputs: [{ id: uid("pin"), name: "", dataType: "BOOL" }],
        outputs: [],
        tag: { name, dataType: "BOOL" }
      });
    }
    for (const tbEl of childArray(sheet, "TextBox")) {
      unmapped.push({ clmNodeId: null, vendorSpecificData: tbEl, reason: `FBD TextBox` });
    }
    for (const wireEl of childArray(sheet, "Wire")) {
      const fromId = attr(wireEl, "FromID") || "";
      const toId = attr(wireEl, "ToID") || "";
      const fromPin = attr(wireEl, "FromParam") ?? "";
      const toPin = attr(wireEl, "ToParam") ?? "";
      if (fromId && toId) {
        wires.push({
          id: uid("wire"),
          from: { nodeId: fromId, pin: fromPin },
          to: { nodeId: toId, pin: toPin }
        });
      }
    }
  }
  if (nodes.length === 0) return null;
  return { nodes, wires };
}
function mapRockwellFBDType(typeName) {
  const upper = typeName.toUpperCase();
  const map = {
    // Boolean gates (Rockwell BAND/BOR/BNOT/BXOR and IEC names)
    AND: "AND",
    OR: "OR",
    NOT: "NOT",
    XOR: "XOR",
    BAND: "AND",
    BOR: "OR",
    BNOT: "NOT",
    BXOR: "XOR",
    // Arithmetic
    ADD: "ADD",
    SUB: "SUB",
    MUL: "MUL",
    DIV: "DIV",
    MOD: "MOD",
    ABS: "ABS",
    SQR: "SQRT",
    SQRT: "SQRT",
    NEG: "NEG",
    SIN: "SIN",
    COS: "COS",
    TAN: "TAN",
    ATN: "ATAN",
    ATAN: "ATAN",
    ASN: "ASIN",
    ACS: "ACOS",
    LN: "LN",
    LOG: "LOG",
    // Timers
    TON: "TON",
    TOF: "TOF",
    RTO: "TON",
    TP: "TP",
    TONR: "TONR",
    // Counters
    CTU: "CTU",
    CTD: "CTD",
    CTUD: "CTUD",
    // Bistable / edge
    SR: "SR",
    RS: "RS",
    // Comparison (Rockwell mnemonics → IEC)
    EQU: "EQ",
    NEQ: "NE",
    GRT: "GT",
    GEQ: "GE",
    LES: "LT",
    LEQ: "LE",
    GT: "GT",
    GE: "GE",
    LT: "LT",
    LE: "LE",
    EQ: "EQ",
    NE: "NE",
    LIM: "LIMIT",
    MEQ: "EQ",
    CMP: "EQ",
    // Data / selection
    MOVE: "MOVE",
    MOV: "MOVE",
    COP: "MOVE",
    CPS: "MOVE",
    FLL: "MOVE",
    SEL: "SEL",
    MUX: "MUX",
    LIMIT: "LIMIT",
    MIN: "MIN",
    MAX: "MAX",
    // Scaling / conversion
    SCL: "SCALE",
    SCP: "SCALE",
    TRUNC: "TRUNC",
    ROUND: "ROUND",
    INT_TO_REAL: "INT_TO_REAL",
    REAL_TO_INT: "REAL_TO_INT",
    DINT_TO_REAL: "DINT_TO_REAL",
    REAL_TO_DINT: "REAL_TO_DINT",
    // Bitwise
    BTD: "BTD",
    SIZE: "SIZE",
    // FIFO / LIFO / Sequencer
    FFL: "FFL",
    FFU: "FFU",
    LFL: "LFL",
    LFU: "LFU",
    SQO: "SQO",
    SQI: "SQI",
    SQL: "SQL",
    // PID
    PID: "PID",
    PIDE: "PID",
    PIDAT: "PID",
    // String functions
    LEN: "LEN",
    LEFT: "LEFT",
    RIGHT: "RIGHT",
    MID: "MID",
    CONCAT: "CONCAT",
    FIND: "FIND",
    INSERT: "INSERT",
    DELETE: "DELETE",
    UPPER: "UPPER_CASE",
    LOWER: "LOWER_CASE",
    // MSG / GSV / SSV / Motion — canvas placeholder
    MSG: "MOVE",
    GSV: "MOVE",
    SSV: "MOVE",
    MAJ: "MOVE",
    MAM: "MOVE",
    MAS: "MOVE"
  };
  return map[upper] || "MOVE";
}
function exportRockwell(project) {
  const errors = [];
  const warnings = [];
  const sidecar = project.sidecar;
  const controllerTags = project.globalTags.map((tag) => tagToL5XTag(tag));
  const programs = project.pous.map((pou) => pouToL5XProgram(pou, warnings));
  const preservedDataTypes = sidecar.unmappedElements.filter((u) => u.reason.startsWith("User-Defined Type")).map((u) => u.vendorSpecificData);
  const preservedAOIs = sidecar.unmappedElements.filter((u) => u.reason.startsWith("AOI:")).map((u) => u.vendorSpecificData);
  const preservedModules = sidecar.unmappedElements.find((u) => u.reason === "Modules element")?.vendorSpecificData;
  const preservedTasks = sidecar.unmappedElements.find((u) => u.reason === "Tasks element")?.vendorSpecificData;
  const controllerObj = {
    "@_Name": sidecar.vendorSpecificGlobals?.["controllerName"] ?? project.projectName,
    "@_ProcessorType": sidecar.vendorSpecificGlobals?.["processorType"] ?? "1769-L33ER",
    "@_MajorRev": "32",
    "@_MinorRev": "0"
  };
  if (preservedDataTypes.length) {
    controllerObj["DataTypes"] = { DataType: preservedDataTypes };
  }
  if (preservedModules) {
    controllerObj["Modules"] = preservedModules;
  }
  if (preservedAOIs.length) {
    controllerObj["AddOnInstructionDefinitions"] = { AddOnInstructionDefinition: preservedAOIs };
  }
  controllerObj["Tags"] = { Tag: controllerTags };
  controllerObj["Programs"] = { Program: programs };
  if (preservedTasks) {
    controllerObj["Tasks"] = preservedTasks;
  } else {
    controllerObj["Tasks"] = {
      Task: [{
        "@_Name": sidecar.vendorSpecificGlobals?.["mainTaskName"] ?? "MainTask",
        "@_Type": sidecar.vendorSpecificGlobals?.["mainTaskType"] ?? "Continuous",
        "@_Priority": "10",
        "@_Watchdog": "500",
        "@_DisableUpdateOutputs": "false",
        "@_InhibitTask": "false",
        ScheduledPrograms: {
          ScheduledProgram: project.pous.map((p) => ({
            "@_Name": p.name.includes("_") ? p.name.split("_")[0] : p.name
          }))
        }
      }]
    };
  }
  controllerObj["CST"] = { "@_MasterID": "0" };
  controllerObj["WallClockTime"] = { "@_LocalTimeAdjustment": "0", "@_TimeZone": "0" };
  controllerObj["Trends"] = {};
  controllerObj["DataLogs"] = {};
  controllerObj["TimeSynchronize"] = { "@_Priority1": "128", "@_Priority2": "128", "@_PTPEnable": "false" };
  const obj = {
    RSLogix5000Content: {
      "@_SchemaRevision": sidecar.vendorSpecificGlobals?.["schemaRevision"] ?? "1.0",
      "@_SoftwareRevision": "32.0",
      "@_TargetName": project.projectName,
      "@_TargetType": "Controller",
      "@_ContainsContext": "true",
      Controller: controllerObj
    }
  };
  return { ok: true, xmlContent: buildXML(obj), errors, warnings };
}
function tagToL5XTag(tag) {
  return {
    "@_Name": tag.name,
    "@_TagType": "Base",
    "@_DataType": iecTypeToRockwell(tag.dataType),
    "@_Radix": "Decimal",
    "@_ExternalAccess": "Read/Write",
    Description: tag.description ? { "#cdata": tag.description } : void 0
  };
}
function pouToL5XProgram(pou, warnings) {
  const localTags = pou.localTags.map(tagToL5XTag);
  let routine;
  if (pou.language === "LD" && pou.ladderProgram) {
    routine = {
      "@_Name": "MainRoutine",
      "@_Type": "RLL",
      RLLContent: {
        Rung: pou.ladderProgram.rungs.map((rung) => ({
          "@_Number": String(rung.number),
          "@_Type": rung.vendorType || "N",
          Comment: rung.comment ? { "#cdata": rung.comment } : void 0,
          Text: { "#cdata": buildRungText(rung) }
        }))
      }
    };
  } else if (pou.language === "FBD" && pou.fbdProgram) {
    routine = buildRockwellFBDRoutine(pou.fbdProgram);
  } else if (pou.language === "ST" && pou.stSource) {
    const stLines = pou.stSource.split("\n");
    routine = {
      "@_Name": "MainRoutine",
      "@_Type": "ST",
      STContent: {
        Line: stLines.map((line, idx) => ({
          "@_Number": String(idx),
          "#cdata": line
        }))
      }
    };
  } else {
    warnings.push(`POU "${pou.name}": language ${pou.language} \u2014 exporting as empty RLL routine`);
    routine = {
      "@_Name": "MainRoutine",
      "@_Type": "RLL",
      RLLContent: { Rung: [{ "@_Number": "0", "@_Type": "N", Text: { "#cdata": "NOP();" } }] }
    };
  }
  return {
    "@_Name": pou.name,
    "@_Type": "Normal",
    "@_MainRoutineName": "MainRoutine",
    Tags: { Tag: localTags },
    Routines: { Routine: routine }
  };
}
function buildRungText(rung) {
  const parts = [];
  for (const el of rung.elements) {
    parts.push(elementToRungText(el));
  }
  if (rung.branches.length > 0) {
    const coilInstrs = /* @__PURE__ */ new Set(["OTE", "OTL", "OTU", "OTN", "RES"]);
    const firstCoilIdx = parts.findIndex((p) => coilInstrs.has(p.split("(")[0]));
    const insertAt = firstCoilIdx >= 0 ? firstCoilIdx : parts.length;
    const legStrings = [];
    for (const branch of rung.branches) {
      const legParts = [];
      for (const el of branch.elements) {
        legParts.push(elementToRungText(el));
      }
      legStrings.push(legParts.join(""));
    }
    const mainLeg = parts.splice(0, insertAt).join("");
    const allLegs = [mainLeg, ...legStrings];
    const bracketBlock = "[" + allLegs[0] + allLegs.slice(1).map((l) => " ," + l).join("") + " ]";
    parts.unshift(bracketBlock);
  }
  return parts.join("") + ";";
}
function elementToRungText(el) {
  if (el.kind === "contact") {
    const c = el;
    const instrMap = { NO: "XIC", NC: "XIO", P_CONTACT: "OSR", N_CONTACT: "OSF" };
    const instrName = instrMap[c.type] || "XIC";
    const vendorArgs = el.vendorArgs;
    if (vendorArgs && vendorArgs.length > 1) {
      return `${instrName}(${vendorArgs.join(",")})`;
    }
    return `${instrName}(${c.tag.name})`;
  } else if (el.kind === "coil") {
    const c = el;
    const instrMap = { normal: "OTE", negated: "OTN", set: "OTL", reset: "RES", latch: "OTL", unlatch: "OTU" };
    return `${instrMap[c.type] || "OTE"}(${c.tag.name})`;
  } else if (el.kind === "block") {
    const b = el;
    if (b.vendorOriginalName) {
      if (b.pins && Object.keys(b.pins).length > 0) {
        const pinVals = Object.values(b.pins).map((p) => p.name || "");
        return `${b.vendorOriginalName}(${pinVals.join(",")})`;
      }
      return `${b.vendorOriginalName}(${b.instanceName})`;
    }
    const instrMap = {
      // Timers
      TON: "TON",
      TOF: "TOF",
      TP: "TON",
      TONR: "TONR",
      RTO: "RTO",
      // Counters
      CTU: "CTU",
      CTD: "CTD",
      CTUD: "CTUD",
      // Bistable / edge
      SR: "OTL",
      RS: "OTU",
      RTRIG: "OSR",
      FTRIG: "OSF",
      // Math
      ADD: "ADD",
      SUB: "SUB",
      MUL: "MUL",
      DIV: "DIV",
      MOD: "MOD",
      ABS: "ABS",
      SQRT: "SQR",
      NEG: "NEG",
      SIN: "SIN",
      COS: "COS",
      TAN: "TAN",
      ATAN: "ATN",
      ASIN: "ASN",
      ACOS: "ACS",
      LN: "LN",
      LOG: "LOG",
      // Comparison
      EQ: "EQU",
      NE: "NEQ",
      GT: "GRT",
      GE: "GEQ",
      LT: "LES",
      LE: "LEQ",
      LIMIT: "LIM",
      // Data / selection
      MOVE: "MOV",
      SEL: "SEL",
      MUX: "MUX",
      MIN: "MIN",
      MAX: "MAX",
      // Scaling
      SCALE: "SCL",
      // Bitwise
      AND: "AND",
      OR: "OR",
      NOT: "NOT",
      XOR: "XOR",
      BTD: "BTD",
      SIZE: "SIZE",
      // FIFO / Sequencer
      FFL: "FFL",
      FFU: "FFU",
      LFL: "LFL",
      LFU: "LFU",
      SQO: "SQO",
      SQI: "SQI",
      SQL: "SQL",
      // PID
      PID: "PID",
      // String
      LEN: "LEN",
      LEFT: "LEFT",
      RIGHT: "RIGHT",
      MID: "MID",
      CONCAT: "CONCAT",
      FIND: "FIND",
      INSERT: "INSERT",
      DELETE: "DELETE",
      UPPER_CASE: "UPPER",
      LOWER_CASE: "LOWER"
    };
    const instr = instrMap[b.fbType] || b.fbType;
    if (b.pins && Object.keys(b.pins).length > 0) {
      const pinVals = Object.values(b.pins).map((p) => p.name || "");
      return `${instr}(${pinVals.join(",")})`;
    }
    return `${instr}(${b.instanceName})`;
  }
  return "";
}
function buildRockwellFBDRoutine(fbd) {
  const fbdBlocks = [];
  const irefs = [];
  const orefs = [];
  const wires = [];
  const iecToRockwellBlock = {
    // Boolean gates
    AND: "BAND",
    OR: "BOR",
    NOT: "BNOT",
    XOR: "BXOR",
    // Arithmetic
    ADD: "ADD",
    SUB: "SUB",
    MUL: "MUL",
    DIV: "DIV",
    MOD: "MOD",
    ABS: "ABS",
    SQRT: "SQR",
    NEG: "NEG",
    SIN: "SIN",
    COS: "COS",
    TAN: "TAN",
    ATAN: "ATN",
    ASIN: "ASN",
    ACOS: "ACS",
    LN: "LN",
    LOG: "LOG",
    // Timers / counters
    TON: "TON",
    TOF: "TOF",
    TP: "TP",
    TONR: "TONR",
    CTU: "CTU",
    CTD: "CTD",
    CTUD: "CTUD",
    // Bistable / edge
    SR: "SR",
    RS: "RS",
    RTRIG: "OSR",
    FTRIG: "OSF",
    // Comparison
    GT: "GRT",
    GE: "GEQ",
    LT: "LES",
    LE: "LEQ",
    EQ: "EQU",
    NE: "NEQ",
    LIMIT: "LIM",
    // Data / selection
    MOVE: "MOV",
    SEL: "SEL",
    MUX: "MUX",
    MIN: "MIN",
    MAX: "MAX",
    // Scaling
    SCALE: "SCL",
    UNSCALE: "SCP",
    // Conversion
    TRUNC: "TRUNC",
    ROUND: "ROUND",
    INT_TO_REAL: "INT_TO_REAL",
    REAL_TO_INT: "REAL_TO_INT",
    DINT_TO_REAL: "DINT_TO_REAL",
    REAL_TO_DINT: "REAL_TO_DINT",
    // Bitwise
    BTD: "BTD",
    SIZE: "SIZE",
    // FIFO / Sequencer
    FFL: "FFL",
    FFU: "FFU",
    LFL: "LFL",
    LFU: "LFU",
    SQO: "SQO",
    SQI: "SQI",
    SQL: "SQL",
    // PID
    PID: "PID",
    // String
    LEN: "LEN",
    LEFT: "LEFT",
    RIGHT: "RIGHT",
    MID: "MID",
    CONCAT: "CONCAT",
    FIND: "FIND",
    INSERT: "INSERT",
    DELETE: "DELETE",
    UPPER_CASE: "UPPER",
    LOWER_CASE: "LOWER"
  };
  for (const node of fbd.nodes) {
    if (node.type === "IN_VARIABLE") {
      irefs.push({
        "@_ID": node.id,
        "@_X": String(node.position.x),
        "@_Y": String(node.position.y),
        "@_Operand": node.tag?.name || ""
      });
    } else if (node.type === "OUT_VARIABLE") {
      orefs.push({
        "@_ID": node.id,
        "@_X": String(node.position.x),
        "@_Y": String(node.position.y),
        "@_Operand": node.tag?.name || ""
      });
    } else {
      const rockType = node.vendorOriginalName || iecToRockwellBlock[node.type] || node.type;
      const visiblePins = [
        ...(node.inputs || []).map((p) => p.name),
        ...(node.outputs || []).map((p) => p.name)
      ].join(" ");
      fbdBlocks.push({
        "@_Type": rockType,
        "@_ID": node.id,
        "@_X": String(node.position.x),
        "@_Y": String(node.position.y),
        "@_Operand": node.instanceName || "",
        "@_VisiblePins": visiblePins
      });
    }
  }
  const nodeTypeMap = /* @__PURE__ */ new Map();
  for (const node of fbd.nodes) {
    nodeTypeMap.set(node.id, node.type);
  }
  for (const wire of fbd.wires) {
    const fromNodeType = nodeTypeMap.get(wire.from.nodeId) || "";
    const toNodeType = nodeTypeMap.get(wire.to.nodeId) || "";
    const wireObj = {
      "@_FromID": wire.from.nodeId,
      "@_ToID": wire.to.nodeId
    };
    if (fromNodeType !== "IN_VARIABLE") {
      wireObj["@_FromParam"] = wire.from.pin;
    } else {
      wireObj["@_FromParam"] = "";
    }
    if (toNodeType !== "OUT_VARIABLE") {
      wireObj["@_ToParam"] = wire.to.pin;
    } else {
      wireObj["@_ToParam"] = "";
    }
    wires.push(wireObj);
  }
  return {
    "@_Name": "MainRoutine",
    "@_Type": "FBD",
    FBDContent: {
      "@_SheetSize": "Letter (8.5x11in)",
      "@_SheetOrientation": "Landscape",
      Sheet: {
        "@_Number": "1",
        Block: fbdBlocks.length ? fbdBlocks : void 0,
        IRef: irefs.length ? irefs : void 0,
        ORef: orefs.length ? orefs : void 0,
        Wire: wires.length ? wires : void 0
      }
    }
  };
}
export {
  exportRockwell,
  importRockwell
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjL3BsYy1lZGl0b3ItdHN4L3ZlbmRvci9hZGFwdGVycy9yb2Nrd2VsbEFkYXB0ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qXG4gKiBSb2Nrd2VsbCBMNVggQWRhcHRlclxuICogUGFyc2VzIFJTTG9naXggNTAwMCAvIFN0dWRpbyA1MDAwIExvZ2l4IERlc2lnbmVyIC5MNVggZXhwb3J0IGZpbGVzLlxuICogU2NoZW1hOiA8UlNMb2dpeDUwMDBDb250ZW50PiAvIENvbnRyb2xsZXIgLyBQcm9ncmFtcyAvIFByb2dyYW0gLyBSb3V0aW5lcyAvIFJvdXRpbmUgLyBSTExDb250ZW50IC8gUnVuZ1xuICpcbiAqIFN1cHBvcnRzOiBSTEwgKGxhZGRlcikgd2l0aCBmdWxsIGJyYW5jaCBwYXJzaW5nIChCU1QvTlhCL0JORCksIEZCRCBTaGVldCBpbXBvcnQsXG4gKiAgICAgICAgICAgY29tcHJlaGVuc2l2ZSBpbnN0cnVjdGlvbiBzZXQgKE1PViwgQ01QLCBtYXRoLCBjb3VudGVycywgb25lLXNob3RzKS5cbiAqL1xuXG5pbXBvcnQgeyBwYXJzZVhNTCwgYnVpbGRYTUwsIGF0dHIsIHRleHQsIGNoaWxkLCBjaGlsZEFycmF5IH0gZnJvbSAnLi4veG1sVXRpbHMuanMnO1xuaW1wb3J0IHsgcm9ja3dlbGxUeXBlVG9JRUMsIGllY1R5cGVUb1JvY2t3ZWxsIH0gZnJvbSAnLi4vZGF0YVR5cGVNYXAuanMnO1xuaW1wb3J0IHsgYnVpbGRSZXNvbHZlciwgVmFyaWFibGVUeXBlUmVzb2x2ZXIgfSBmcm9tICcuLi92YXJpYWJsZVR5cGVSZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBnZXRQaW5EYXRhVHlwZSwgYnVpbGRUeXBlZFBpbnMgfSBmcm9tICcuLi9waW5TaWduYXR1cmVzLmpzJztcbmltcG9ydCB0eXBlIHtcbiAgSW1wb3J0UmVzdWx0LCBFeHBvcnRSZXN1bHQsIE5vcm1hbGl6ZWRQcm9qZWN0LCBOb3JtYWxpemVkUE9VLCBOb3JtYWxpemVkVGFnLFxuICBWZW5kb3JNZXRhZGF0YVNpZGVjYXIsIFVubWFwcGVkRWxlbWVudCxcbn0gZnJvbSAnLi4vdHlwZXMuanMnO1xuaW1wb3J0IHR5cGUge1xuICBMYWRkZXJQcm9ncmFtLCBSdW5nLCBMYWRkZXJFbGVtZW50LCBDb250YWN0RWxlbWVudCwgQ29pbEVsZW1lbnQsIEJsb2NrRWxlbWVudCwgQnJhbmNoLFxuICBDb250YWN0VHlwZSwgQ29pbFR5cGUsIEZCVHlwZSwgVGFnUmVmLFxuICBGQkRQcm9ncmFtLCBGQkROb2RlLCBGQkRXaXJlLCBGQkRCbG9ja1R5cGUsXG59IGZyb20gJy4uLy4uL2xvZ2ljU3RvcmUuanMnO1xuXG5sZXQgX3VpZCA9IDA7XG5mdW5jdGlvbiB1aWQocHJlZml4OiBzdHJpbmcpOiBzdHJpbmcgeyByZXR1cm4gYCR7cHJlZml4fS0keysrX3VpZH0tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyLCA4KX1gOyB9XG5cbmZ1bmN0aW9uIHVuZXNjYXBlWE1MKHM6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzLnJlcGxhY2UoLyZhbXA7L2csICcmJykucmVwbGFjZSgvJmx0Oy9nLCAnPCcpLnJlcGxhY2UoLyZndDsvZywgJz4nKS5yZXBsYWNlKC8mcXVvdDsvZywgJ1wiJykucmVwbGFjZSgvJmFwb3M7L2csIFwiJ1wiKTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEltcG9ydCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGZ1bmN0aW9uIGltcG9ydFJvY2t3ZWxsKHhtbENvbnRlbnQ6IHN0cmluZywgZmlsZVBhdGg6IHN0cmluZyk6IEltcG9ydFJlc3VsdCB7XG4gIF91aWQgPSAwO1xuICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10gPSBbXTtcblxuICBsZXQgcm9vdDogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIHRyeSB7XG4gICAgcm9vdCA9IHBhcnNlWE1MKHhtbENvbnRlbnQpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcnM6IFtgWE1MIHBhcnNlIGVycm9yOiAke2V9YF0sIHdhcm5pbmdzOiBbXSB9O1xuICB9XG5cbiAgY29uc3QgY29udGVudCA9IGNoaWxkKHJvb3QsICdSU0xvZ2l4NTAwMENvbnRlbnQnKSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IHVuZGVmaW5lZDtcbiAgaWYgKCFjb250ZW50KSB7XG4gICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcnM6IFsnTm8gPFJTTG9naXg1MDAwQ29udGVudD4gcm9vdCBmb3VuZCddLCB3YXJuaW5nczogW10gfTtcbiAgfVxuXG4gIGNvbnN0IHNjaGVtYVJldmlzaW9uID0gYXR0cihjb250ZW50LCAnU2NoZW1hUmV2aXNpb24nKTtcbiAgY29uc3QgY29udHJvbGxlciA9IGNoaWxkKGNvbnRlbnQsICdDb250cm9sbGVyJykgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCB1bmRlZmluZWQ7XG4gIGlmICghY29udHJvbGxlcikge1xuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3JzOiBbJ05vIDxDb250cm9sbGVyPiBlbGVtZW50IGZvdW5kJ10sIHdhcm5pbmdzOiBbXSB9O1xuICB9XG5cbiAgY29uc3QgcHJvamVjdE5hbWUgPSBhdHRyKGNvbnRyb2xsZXIsICdOYW1lJykgfHwgJ0w1WCBJbXBvcnQnO1xuXG4gIC8vIEdsb2JhbC9jb250cm9sbGVyLXNjb3BlIHRhZ3NcbiAgY29uc3QgZ2xvYmFsVGFnczogTm9ybWFsaXplZFRhZ1tdID0gW107XG4gIGNvbnN0IHRhZ3NFbCA9IGNoaWxkKGNvbnRyb2xsZXIsICdUYWdzJykgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCB1bmRlZmluZWQ7XG4gIGNvbnN0IHRhZ3NSZXRhaW4gPSB0YWdzRWwgPyBhdHRyKHRhZ3NFbCwgJ1VzZScpID09PSAnUmV0YWluJyA6IGZhbHNlO1xuICBmb3IgKGNvbnN0IHRhZ0VsIG9mIGNoaWxkQXJyYXkodGFnc0VsLCAnVGFnJykpIHtcbiAgICBjb25zdCB0YWcgPSBwYXJzZUw1WFRhZyh0YWdFbCwgdGFnc1JldGFpbiwgdW5tYXBwZWQpO1xuICAgIGlmICh0YWcpIGdsb2JhbFRhZ3MucHVzaCh0YWcpO1xuICB9XG5cbiAgLy8gVURUcyBcdTIxOTIgbWFyayBhcyBzdHJ1Y3QgaW4gdW5tYXBwZWQgKHByZXNlcnZlIGZvciByb3VuZC10cmlwKVxuICBmb3IgKGNvbnN0IHVkdEVsIG9mIGNoaWxkQXJyYXkoY2hpbGQoY29udHJvbGxlciwgJ0RhdGFUeXBlcycpLCAnRGF0YVR5cGUnKSkge1xuICAgIHVubWFwcGVkLnB1c2goe1xuICAgICAgY2xtTm9kZUlkOiBudWxsLFxuICAgICAgdmVuZG9yU3BlY2lmaWNEYXRhOiB1ZHRFbCxcbiAgICAgIHJlYXNvbjogYFVzZXItRGVmaW5lZCBUeXBlIFwiJHthdHRyKHVkdEVsLCAnTmFtZScpfVwiIFx1MjAxNCBwcmVzZXJ2ZWQgaW4gc2lkZWNhcmAsXG4gICAgfSk7XG4gIH1cblxuICAvLyBQcm9ncmFtc1xuICBjb25zdCBwb3VzOiBOb3JtYWxpemVkUE9VW10gPSBbXTtcbiAgZm9yIChjb25zdCBwcm9ncmFtRWwgb2YgY2hpbGRBcnJheShjaGlsZChjb250cm9sbGVyLCAnUHJvZ3JhbXMnKSwgJ1Byb2dyYW0nKSkge1xuICAgIGNvbnN0IHBvdUxpc3QgPSBwYXJzZUw1WFByb2dyYW0ocHJvZ3JhbUVsLCB1bm1hcHBlZCwgd2FybmluZ3MpO1xuICAgIHBvdXMucHVzaCguLi5wb3VMaXN0KTtcbiAgfVxuXG4gIC8vIE1vZHVsZXMgXHUyMTkyIHByZXNlcnZlIGZvciByb3VuZC10cmlwXG4gIGNvbnN0IG1vZHVsZXNFbCA9IGNoaWxkKGNvbnRyb2xsZXIsICdNb2R1bGVzJyk7XG4gIGlmIChtb2R1bGVzRWwpIHtcbiAgICB1bm1hcHBlZC5wdXNoKHsgY2xtTm9kZUlkOiBudWxsLCB2ZW5kb3JTcGVjaWZpY0RhdGE6IG1vZHVsZXNFbCwgcmVhc29uOiAnTW9kdWxlcyBlbGVtZW50JyB9KTtcbiAgfVxuXG4gIC8vIFRhc2tzIFx1MjE5MiBwcmVzZXJ2ZSBmb3Igcm91bmQtdHJpcFxuICBjb25zdCB0YXNrc0VsID0gY2hpbGQoY29udHJvbGxlciwgJ1Rhc2tzJyk7XG4gIGlmICh0YXNrc0VsKSB7XG4gICAgdW5tYXBwZWQucHVzaCh7IGNsbU5vZGVJZDogbnVsbCwgdmVuZG9yU3BlY2lmaWNEYXRhOiB0YXNrc0VsLCByZWFzb246ICdUYXNrcyBlbGVtZW50JyB9KTtcbiAgfVxuXG4gIC8vIEFkZC1PbiBJbnN0cnVjdGlvbnMgXHUyMTkyIHdhcm4sIHByZXNlcnZlXG4gIGZvciAoY29uc3QgYW9pRWwgb2YgY2hpbGRBcnJheShjaGlsZChjb250cm9sbGVyLCAnQWRkT25JbnN0cnVjdGlvbkRlZmluaXRpb25zJyksICdBZGRPbkluc3RydWN0aW9uRGVmaW5pdGlvbicpKSB7XG4gICAgY29uc3QgbmFtZSA9IGF0dHIoYW9pRWwsICdOYW1lJyk7XG4gICAgd2FybmluZ3MucHVzaChgQWRkLU9uIEluc3RydWN0aW9uIFwiJHtuYW1lfVwiIGNhbm5vdCBiZSBjb252ZXJ0ZWQgdG8gc3RhbmRhcmQgSUVDIGJsb2NrcyBcdTIwMTQgcHJlc2VydmVkIGluIHNpZGVjYXIuYCk7XG4gICAgdW5tYXBwZWQucHVzaCh7IGNsbU5vZGVJZDogbnVsbCwgdmVuZG9yU3BlY2lmaWNEYXRhOiBhb2lFbCwgcmVhc29uOiBgQU9JOiAke25hbWV9YCB9KTtcbiAgfVxuXG4gIGlmIChwb3VzLmxlbmd0aCA9PT0gMCkge1xuICAgIGVycm9ycy5wdXNoKCdObyBwcm9ncmFtcyBvciByb3V0aW5lcyBmb3VuZCBpbiBMNVggZmlsZScpO1xuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3JzLCB3YXJuaW5ncyB9O1xuICB9XG5cbiAgY29uc3Qgc2lkZWNhcjogVmVuZG9yTWV0YWRhdGFTaWRlY2FyID0ge1xuICAgIHNvdXJjZVZlbmRvcjogJ3JvY2t3ZWxsX2w1eCcsXG4gICAgc291cmNlRmlsZVZlcnNpb246IHNjaGVtYVJldmlzaW9uIHx8ICcxLjAnLFxuICAgIG9yaWdpbmFsRmlsZVBhdGg6IGZpbGVQYXRoLFxuICAgIHVubWFwcGVkRWxlbWVudHM6IHVubWFwcGVkLFxuICAgIG9yZ2FuaXplclRyZWVMYXlvdXQ6IGNoaWxkKGNvbnRyb2xsZXIsICdQcm9ncmFtcycpLFxuICAgIHZlbmRvclNwZWNpZmljR2xvYmFsczoge1xuICAgICAgc2NoZW1hUmV2aXNpb246IGF0dHIoY29udGVudCwgJ1NjaGVtYVJldmlzaW9uJykgfHwgJzEuMCcsXG4gICAgICBzb2Z0d2FyZVJldmlzaW9uOiBhdHRyKGNvbnRlbnQsICdTb2Z0d2FyZVJldmlzaW9uJykgfHwgJzMyLjAnLFxuICAgICAgY29udHJvbGxlck5hbWU6IGF0dHIoY29udHJvbGxlciwgJ05hbWUnKSB8fCAnJyxcbiAgICAgIHByb2Nlc3NvclR5cGU6IGF0dHIoY29udHJvbGxlciwgJ1Byb2Nlc3NvclR5cGUnKSB8fCAnMTc2OS1MMzNFUicsXG4gICAgfSxcbiAgfTtcblxuICByZXR1cm4geyBvazogdHJ1ZSwgcHJvamVjdDogeyBwcm9qZWN0TmFtZSwgcG91cywgZ2xvYmFsVGFncywgc2lkZWNhciB9LCBlcnJvcnMsIHdhcm5pbmdzIH07XG59XG5cbmZ1bmN0aW9uIHBhcnNlTDVYVGFnKHRhZ0VsOiB1bmtub3duLCBwYXJlbnRSZXRhaW46IGJvb2xlYW4sIHVubWFwcGVkOiBVbm1hcHBlZEVsZW1lbnRbXSk6IE5vcm1hbGl6ZWRUYWcgfCBudWxsIHtcbiAgaWYgKCF0YWdFbCB8fCB0eXBlb2YgdGFnRWwgIT09ICdvYmplY3QnKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgbmFtZSA9IGF0dHIodGFnRWwsICdOYW1lJyk7XG4gIGlmICghbmFtZSkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHR5cGVTdHIgPSBhdHRyKHRhZ0VsLCAnRGF0YVR5cGUnKTtcbiAgY29uc3QgZGF0YVR5cGUgPSByb2Nrd2VsbFR5cGVUb0lFQyh0eXBlU3RyKTtcbiAgY29uc3QgZGVzYyA9IHRleHQoY2hpbGQoY2hpbGQodGFnRWwsICdEZXNjcmlwdGlvbicpLCAnI2NkYXRhJykgPz8gY2hpbGQodGFnRWwsICdEZXNjcmlwdGlvbicpKTtcblxuICBpZiAoZGF0YVR5cGUgPT09ICdTVFJVQ1QnICYmICFbJ1RJTUVSJywgJ0NPVU5URVInLCAnQ09OVFJPTCddLmluY2x1ZGVzKHR5cGVTdHIudG9VcHBlckNhc2UoKSkpIHtcbiAgICB1bm1hcHBlZC5wdXNoKHsgY2xtTm9kZUlkOiBudWxsLCB2ZW5kb3JTcGVjaWZpY0RhdGE6IHRhZ0VsLCByZWFzb246IGBOb24tc3RhbmRhcmQgc3RydWN0IHR5cGU6ICR7dHlwZVN0cn1gIH0pO1xuICB9XG5cbiAgLy8gQWRkcmVzczogTDVYIHRhZ3MgZG9uJ3QgaGF2ZSBJRUMgaGFyZHdhcmUgYWRkcmVzc2VzIFx1MjAxNCB1c2UgQWxpYXNGb3IgaWYgcHJlc2VudFxuICBjb25zdCBhbGlhc0ZvciA9IGF0dHIodGFnRWwsICdBbGlhc0ZvcicpO1xuICBjb25zdCBhZGRyZXNzID0gYWxpYXNGb3IgfHwgdW5kZWZpbmVkO1xuXG4gIC8vIFJldGFpbjogZGV0ZXJtaW5lZCBieSBwYXJlbnQgPFRhZ3MgVXNlPVwiUmV0YWluXCI+IG9yIGluZGl2aWR1YWwgdGFnJ3MgQ29uc3RhbnQgYXR0cmlidXRlXG4gIGNvbnN0IHJldGFpbiA9IHBhcmVudFJldGFpbiB8fCBmYWxzZTtcblxuICByZXR1cm4ge1xuICAgIG5hbWUsXG4gICAgZGF0YVR5cGUsXG4gICAgZGVzY3JpcHRpb246IGRlc2MgfHwgdW5kZWZpbmVkLFxuICAgIGFkZHJlc3MsXG4gICAgaW5pdGlhbFZhbHVlOiBwYXJzZUw1WFZhbHVlKGNoaWxkKHRhZ0VsLCAnRGVmYXVsdERhdGEnKSA/PyBjaGlsZCh0YWdFbCwgJ0RhdGEnKSksXG4gICAgcmV0YWluLFxuICB9O1xufVxuXG5mdW5jdGlvbiBwYXJzZUw1WFZhbHVlKGRhdGFFbDogdW5rbm93bik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIGlmICghZGF0YUVsKSByZXR1cm4gdW5kZWZpbmVkO1xuICBjb25zdCB2ID0gdGV4dChkYXRhRWwpO1xuICByZXR1cm4gdiB8fCB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIHBhcnNlTDVYUHJvZ3JhbShwcm9ncmFtRWw6IHVua25vd24sIHVubWFwcGVkOiBVbm1hcHBlZEVsZW1lbnRbXSwgd2FybmluZ3M6IHN0cmluZ1tdKTogTm9ybWFsaXplZFBPVVtdIHtcbiAgaWYgKCFwcm9ncmFtRWwgfHwgdHlwZW9mIHByb2dyYW1FbCAhPT0gJ29iamVjdCcpIHJldHVybiBbXTtcbiAgY29uc3QgcHJvZ3JhbU5hbWUgPSBhdHRyKHByb2dyYW1FbCwgJ05hbWUnKTtcblxuICAvLyBQcm9ncmFtLXNjb3BlIHRhZ3NcbiAgY29uc3QgbG9jYWxUYWdzOiBOb3JtYWxpemVkVGFnW10gPSBbXTtcbiAgY29uc3QgcHJvZ1RhZ3NFbCA9IGNoaWxkKHByb2dyYW1FbCwgJ1RhZ3MnKSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IHVuZGVmaW5lZDtcbiAgY29uc3QgcHJvZ1JldGFpbiA9IHByb2dUYWdzRWwgPyBhdHRyKHByb2dUYWdzRWwsICdVc2UnKSA9PT0gJ1JldGFpbicgOiBmYWxzZTtcbiAgZm9yIChjb25zdCB0YWdFbCBvZiBjaGlsZEFycmF5KHByb2dUYWdzRWwsICdUYWcnKSkge1xuICAgIGNvbnN0IHRhZyA9IHBhcnNlTDVYVGFnKHRhZ0VsLCBwcm9nUmV0YWluLCB1bm1hcHBlZCk7XG4gICAgaWYgKHRhZykgbG9jYWxUYWdzLnB1c2godGFnKTtcbiAgfVxuXG4gIGNvbnN0IHBvdXM6IE5vcm1hbGl6ZWRQT1VbXSA9IFtdO1xuICBmb3IgKGNvbnN0IHJvdXRpbmVFbCBvZiBjaGlsZEFycmF5KGNoaWxkKHByb2dyYW1FbCwgJ1JvdXRpbmVzJyksICdSb3V0aW5lJykpIHtcbiAgICBjb25zdCByb3V0aW5lTmFtZSA9IGF0dHIocm91dGluZUVsLCAnTmFtZScpO1xuICAgIGNvbnN0IHJvdXRpbmVUeXBlID0gYXR0cihyb3V0aW5lRWwsICdUeXBlJykgfHwgJ1JMTCc7XG5cbiAgICAvLyBCdWlsZCByZXNvbHZlciBvbmNlIFx1MjAxNCBzaGFyZWQgYnkgYWxsIHJvdXRpbmVzIGluIHRoaXMgcHJvZ3JhbVxuICAgIGNvbnN0IHJlc29sdmVyID0gYnVpbGRSZXNvbHZlcihsb2NhbFRhZ3MsIFtdKTtcblxuICAgIGlmIChyb3V0aW5lVHlwZSA9PT0gJ1JMTCcpIHtcbiAgICAgIGNvbnN0IGxhZGRlciA9IHBhcnNlTDVYUkxMKHJvdXRpbmVFbCwgdW5tYXBwZWQsIHdhcm5pbmdzKTtcbiAgICAgIHBvdXMucHVzaCh7XG4gICAgICAgIGlkOiBgcG91LSR7cHJvZ3JhbU5hbWV9LSR7cm91dGluZU5hbWV9YCxcbiAgICAgICAgbmFtZTogYCR7cHJvZ3JhbU5hbWV9XyR7cm91dGluZU5hbWV9YCxcbiAgICAgICAgbGFuZ3VhZ2U6ICdMRCcsXG4gICAgICAgIGxhZGRlclByb2dyYW06IGxhZGRlcixcbiAgICAgICAgbG9jYWxUYWdzLFxuICAgICAgICBwb3VUeXBlOiAncHJvZ3JhbScsXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKHJvdXRpbmVUeXBlID09PSAnRkJEJykge1xuICAgICAgY29uc3QgZmJkID0gcGFyc2VMNVhGQkQocm91dGluZUVsLCB1bm1hcHBlZCwgd2FybmluZ3MsIHJlc29sdmVyKTtcbiAgICAgIGlmIChmYmQpIHtcbiAgICAgICAgcG91cy5wdXNoKHtcbiAgICAgICAgICBpZDogYHBvdS0ke3Byb2dyYW1OYW1lfS0ke3JvdXRpbmVOYW1lfWAsXG4gICAgICAgICAgbmFtZTogYCR7cHJvZ3JhbU5hbWV9XyR7cm91dGluZU5hbWV9YCxcbiAgICAgICAgICBsYW5ndWFnZTogJ0ZCRCcsXG4gICAgICAgICAgZmJkUHJvZ3JhbTogZmJkLFxuICAgICAgICAgIGxvY2FsVGFncyxcbiAgICAgICAgICBwb3VUeXBlOiAncHJvZ3JhbScsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgd2FybmluZ3MucHVzaChgUm91dGluZSBcIiR7cm91dGluZU5hbWV9XCIgaXMgRkJEIFx1MjAxNCBwcmVzZXJ2ZWQgaW4gc2lkZWNhci5gKTtcbiAgICAgICAgdW5tYXBwZWQucHVzaCh7IGNsbU5vZGVJZDogbnVsbCwgdmVuZG9yU3BlY2lmaWNEYXRhOiByb3V0aW5lRWwsIHJlYXNvbjogYEZCRCByb3V0aW5lOiAke3JvdXRpbmVOYW1lfWAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChyb3V0aW5lVHlwZSA9PT0gJ1NUJykge1xuICAgICAgY29uc3Qgc3RDb250ZW50RWwgPSBjaGlsZChyb3V0aW5lRWwsICdTVENvbnRlbnQnKTtcbiAgICAgIGxldCBzdFNvdXJjZSA9ICcnO1xuICAgICAgaWYgKHN0Q29udGVudEVsKSB7XG4gICAgICAgIC8vIFJlYWwgTDVYIGZvcm1hdDogPExpbmUgTnVtYmVyPVwiTlwiPjwhW0NEQVRBW2NvZGVdXT48L0xpbmU+IGVsZW1lbnRzXG4gICAgICAgIGNvbnN0IGxpbmVzID0gY2hpbGRBcnJheShzdENvbnRlbnRFbCwgJ0xpbmUnKTtcbiAgICAgICAgaWYgKGxpbmVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAvLyBQYXJzZSBsaW5lLWJ5LWxpbmUsIHByZXNlcnZpbmcgbGluZSBudW1iZXJzIChnYXBzIGJlY29tZSBlbXB0eSBsaW5lcylcbiAgICAgICAgICBjb25zdCBsaW5lTWFwOiBNYXA8bnVtYmVyLCBzdHJpbmc+ID0gbmV3IE1hcCgpO1xuICAgICAgICAgIGxldCBtYXhMaW5lID0gMDtcbiAgICAgICAgICBmb3IgKGNvbnN0IGxpbmVFbCBvZiBsaW5lcykge1xuICAgICAgICAgICAgY29uc3QgbnVtID0gTnVtYmVyKGF0dHIobGluZUVsLCAnTnVtYmVyJykpIHx8IDA7XG4gICAgICAgICAgICBjb25zdCBsaW5lVGV4dCA9IHRleHQobGluZUVsKSB8fCAnJztcbiAgICAgICAgICAgIGxpbmVNYXAuc2V0KG51bSwgdW5lc2NhcGVYTUwobGluZVRleHQpKTtcbiAgICAgICAgICAgIGlmIChudW0gPiBtYXhMaW5lKSBtYXhMaW5lID0gbnVtO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBzdExpbmVzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgIGZvciAobGV0IG4gPSAwOyBuIDw9IG1heExpbmU7IG4rKykge1xuICAgICAgICAgICAgc3RMaW5lcy5wdXNoKGxpbmVNYXAuZ2V0KG4pID8/ICcnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3RTb3VyY2UgPSBzdExpbmVzLmpvaW4oJ1xcbicpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEZhbGxiYWNrOiBzaW5nbGUgQ0RBVEEgdGV4dCBibG9iXG4gICAgICAgICAgY29uc3QgcmF3U3QgPSB0ZXh0KHN0Q29udGVudEVsKTtcbiAgICAgICAgICBzdFNvdXJjZSA9IHJhd1N0ID8gdW5lc2NhcGVYTUwocmF3U3QpIDogJyc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHBvdXMucHVzaCh7XG4gICAgICAgIGlkOiBgcG91LSR7cHJvZ3JhbU5hbWV9LSR7cm91dGluZU5hbWV9YCxcbiAgICAgICAgbmFtZTogYCR7cHJvZ3JhbU5hbWV9XyR7cm91dGluZU5hbWV9YCxcbiAgICAgICAgbGFuZ3VhZ2U6ICdTVCcsXG4gICAgICAgIHN0U291cmNlLFxuICAgICAgICBsb2NhbFRhZ3MsXG4gICAgICAgIHBvdVR5cGU6ICdwcm9ncmFtJyxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAocm91dGluZVR5cGUgPT09ICdTRkMnKSB7XG4gICAgICAvLyBQYXJzZSBTRkMgcm91dGluZSBcdTIwMTQgcHJlc2VydmUgc3RydWN0dXJlIGluIHNpZGVjYXIgYnV0IGFsc28gY3JlYXRlIGEgUE9VXG4gICAgICBjb25zdCBzZmNDb250ZW50RWwgPSBjaGlsZChyb3V0aW5lRWwsICdTRkNDb250ZW50Jyk7XG4gICAgICAvLyBFeHRyYWN0IGFueSBTVCBjb2RlIGZyb20gdHJhbnNpdGlvbiBjb25kaXRpb25zIGFzIGNvbWJpbmVkIFNUIHNvdXJjZVxuICAgICAgY29uc3Qgc3RMaW5lczogc3RyaW5nW10gPSBbXTtcbiAgICAgIGlmIChzZmNDb250ZW50RWwpIHtcbiAgICAgICAgZm9yIChjb25zdCB0cmFuc0VsIG9mIGNoaWxkQXJyYXkoc2ZjQ29udGVudEVsLCAnVHJhbnNpdGlvbicpKSB7XG4gICAgICAgICAgY29uc3QgY29uZEVsID0gY2hpbGQodHJhbnNFbCwgJ0NvbmRpdGlvbicpO1xuICAgICAgICAgIGNvbnN0IGNvbmRTdEVsID0gY29uZEVsID8gY2hpbGQoY29uZEVsLCAnU1RDb250ZW50JykgOiBudWxsO1xuICAgICAgICAgIGlmIChjb25kU3RFbCkge1xuICAgICAgICAgICAgY29uc3QgY29uZExpbmVzID0gY2hpbGRBcnJheShjb25kU3RFbCwgJ0xpbmUnKTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgbGluZUVsIG9mIGNvbmRMaW5lcykge1xuICAgICAgICAgICAgICBjb25zdCBsdCA9IHRleHQobGluZUVsKSB8fCAnJztcbiAgICAgICAgICAgICAgaWYgKGx0KSBzdExpbmVzLnB1c2godW5lc2NhcGVYTUwobHQpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIFN0b3JlIHRoZSBmdWxsIFNGQyBYTUwgaW4gdW5tYXBwZWQgZm9yIGxvc3NsZXNzIHJvdW5kLXRyaXBcbiAgICAgIHVubWFwcGVkLnB1c2goeyBjbG1Ob2RlSWQ6IG51bGwsIHZlbmRvclNwZWNpZmljRGF0YTogcm91dGluZUVsLCByZWFzb246IGBTRkMgcm91dGluZTogJHtyb3V0aW5lTmFtZX1gIH0pO1xuICAgICAgcG91cy5wdXNoKHtcbiAgICAgICAgaWQ6IGBwb3UtJHtwcm9ncmFtTmFtZX0tJHtyb3V0aW5lTmFtZX1gLFxuICAgICAgICBuYW1lOiBgJHtwcm9ncmFtTmFtZX1fJHtyb3V0aW5lTmFtZX1gLFxuICAgICAgICBsYW5ndWFnZTogJ1NUJyxcbiAgICAgICAgc3RTb3VyY2U6IHN0TGluZXMubGVuZ3RoID4gMCA/IGAvLyBTRkMgVHJhbnNpdGlvbiBjb25kaXRpb25zIGZyb20gJHtyb3V0aW5lTmFtZX1cXG4ke3N0TGluZXMuam9pbignXFxuJyl9YCA6IGAvLyBTRkMgcm91dGluZTogJHtyb3V0aW5lTmFtZX0gKHN0cnVjdHVyZSBwcmVzZXJ2ZWQgaW4gc2lkZWNhcilgLFxuICAgICAgICBsb2NhbFRhZ3MsXG4gICAgICAgIHBvdVR5cGU6ICdwcm9ncmFtJyxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB1bm1hcHBlZC5wdXNoKHsgY2xtTm9kZUlkOiBudWxsLCB2ZW5kb3JTcGVjaWZpY0RhdGE6IHJvdXRpbmVFbCwgcmVhc29uOiBgVW5zdXBwb3J0ZWQgcm91dGluZSB0eXBlOiAke3JvdXRpbmVUeXBlfWAgfSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHBvdXM7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBSTEwgKFJlbGF5IExhZGRlciBMb2dpYykgcGFyc2VyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBwYXJzZUw1WFJMTChyb3V0aW5lRWw6IHVua25vd24sIHVubWFwcGVkOiBVbm1hcHBlZEVsZW1lbnRbXSwgd2FybmluZ3M6IHN0cmluZ1tdKTogTGFkZGVyUHJvZ3JhbSB7XG4gIGNvbnN0IHJ1bmdzOiBSdW5nW10gPSBbXTtcbiAgY29uc3QgcmxsRWwgPSBjaGlsZChyb3V0aW5lRWwsICdSTExDb250ZW50Jyk7XG5cbiAgZm9yIChjb25zdCBydW5nRWwgb2YgY2hpbGRBcnJheShybGxFbCwgJ1J1bmcnKSkge1xuICAgIGNvbnN0IG51bWJlciA9IE51bWJlcihhdHRyKHJ1bmdFbCwgJ051bWJlcicpKSB8fCBydW5ncy5sZW5ndGg7XG4gICAgY29uc3QgcnVuZ1R5cGUgPSBhdHRyKHJ1bmdFbCwgJ1R5cGUnKSB8fCAnTic7XG4gICAgY29uc3QgY29tbWVudCA9IHRleHQoY2hpbGQocnVuZ0VsLCAnQ29tbWVudCcpKTtcbiAgICBjb25zdCB0ZXh0Q29udGVudCA9IHRleHQoY2hpbGQocnVuZ0VsLCAnVGV4dCcpKTtcblxuICAgIGNvbnN0IHsgZWxlbWVudHMsIGJyYW5jaGVzIH0gPSBwYXJzZVJ1bmdUZXh0KHRleHRDb250ZW50LCBudW1iZXIsIHVubWFwcGVkLCB3YXJuaW5ncyk7XG4gICAgcnVuZ3MucHVzaCh7XG4gICAgICBpZDogYHJ1bmctJHtudW1iZXJ9YCxcbiAgICAgIG51bWJlcixcbiAgICAgIGNvbW1lbnQ6IGNvbW1lbnQgfHwgJycsXG4gICAgICBlbGVtZW50cyxcbiAgICAgIGJyYW5jaGVzLFxuICAgICAgdmVuZG9yVHlwZTogcnVuZ1R5cGUsXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4geyBydW5ncyB9O1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgUnVuZyB0ZXh0IHBhcnNlciB3aXRoIEJTVC9OWEIvQk5EIGJyYW5jaCBzdXBwb3J0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5pbnRlcmZhY2UgUGFyc2VkUnVuZyB7XG4gIGVsZW1lbnRzOiBMYWRkZXJFbGVtZW50W107XG4gIGJyYW5jaGVzOiBCcmFuY2hbXTtcbn1cblxuZnVuY3Rpb24gcGFyc2VSdW5nVGV4dChcbiAgcnVuZ1RleHQ6IHN0cmluZyxcbiAgcnVuZ051bWJlcjogbnVtYmVyLFxuICB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10sXG4gIHdhcm5pbmdzOiBzdHJpbmdbXVxuKTogUGFyc2VkUnVuZyB7XG4gIGlmICghcnVuZ1RleHQpIHJldHVybiB7IGVsZW1lbnRzOiBbXSwgYnJhbmNoZXM6IFtdIH07XG5cbiAgY29uc3Qgc3RyaXBwZWQgPSBydW5nVGV4dC50cmltKCkucmVwbGFjZSgvOyQvLCAnJyk7XG5cbiAgLy8gTDVYIG5ldXRyYWwgdGV4dCB1c2VzIFtsZWcxICxsZWcyIF1jb250aW51YXRpb24gYnJhY2tldCBzeW50YXggZm9yIHBhcmFsbGVsIGJyYW5jaGVzLlxuICAvLyBQcmUtcHJvY2VzcyB0byBzcGxpdCBpbnRvOiBwcmUtYnJhbmNoIG1haW4gZWxlbWVudHMgKyBwYXJhbGxlbCBsZWdzICsgcG9zdC1icmFuY2ggZWxlbWVudHMuXG4gIHJldHVybiBwYXJzZUJyYWNrZXRCcmFuY2hUZXh0KHN0cmlwcGVkLCBydW5nTnVtYmVyLCB1bm1hcHBlZCwgd2FybmluZ3MpO1xufVxuXG5pbnRlcmZhY2UgSW5zdHJUb2tlbiB7XG4gIGluc3RyOiBzdHJpbmc7XG4gIGFyZ3M6IHN0cmluZ1tdO1xufVxuXG5mdW5jdGlvbiB0b2tlbml6ZVJ1bmdUZXh0KHRleHQ6IHN0cmluZyk6IEluc3RyVG9rZW5bXSB7XG4gIGNvbnN0IHRva2VuczogSW5zdHJUb2tlbltdID0gW107XG4gIC8vIE1hdGNoIGluc3RydWN0aW9ucyBcdTIwMTQgc3VwcG9ydHMgbWl4ZWQgY2FzZSwgbnVtYmVycywgdW5kZXJzY29yZXMgaW4gaW5zdHJ1Y3Rpb24gbmFtZXNcbiAgLy8gYW5kIGhhbmRsZXMgbmVzdGVkIHBhcmVucyBmb3IgYXJyYXkgc3Vic2NyaXB0cyBsaWtlIE1PVE9SWzBdLlNwZWVkXG4gIGNvbnN0IHRva2VuUGF0dGVybiA9IC8oW0EtWmEtel9dW0EtWmEtejAtOV9dKikoPzpcXCgoW14pXSooPzpcXChbXildKlxcKVteKV0qKSopXFwpKT8vZztcbiAgbGV0IG1hdGNoOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xuXG4gIHdoaWxlICgobWF0Y2ggPSB0b2tlblBhdHRlcm4uZXhlYyh0ZXh0KSkgIT09IG51bGwpIHtcbiAgICBjb25zdCBpbnN0ciA9IG1hdGNoWzFdLnRvVXBwZXJDYXNlKCk7XG4gICAgY29uc3QgYXJnc1N0ciA9IG1hdGNoWzJdID8/ICcnO1xuICAgIGNvbnN0IGFyZ3MgPSBhcmdzU3RyID8gc3BsaXRBcmdzKGFyZ3NTdHIpIDogW107XG4gICAgdG9rZW5zLnB1c2goeyBpbnN0ciwgYXJncyB9KTtcbiAgfVxuICByZXR1cm4gdG9rZW5zO1xufVxuXG5mdW5jdGlvbiBzcGxpdEFyZ3MoYXJnc1N0cjogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBhcmdzOiBzdHJpbmdbXSA9IFtdO1xuICBsZXQgY3VycmVudCA9ICcnO1xuICBsZXQgZGVwdGggPSAwO1xuICBmb3IgKGNvbnN0IGNoIG9mIGFyZ3NTdHIpIHtcbiAgICBpZiAoY2ggPT09ICcoJyB8fCBjaCA9PT0gJ1snKSB7IGRlcHRoKys7IGN1cnJlbnQgKz0gY2g7IH1cbiAgICBlbHNlIGlmIChjaCA9PT0gJyknIHx8IGNoID09PSAnXScpIHsgZGVwdGgtLTsgY3VycmVudCArPSBjaDsgfVxuICAgIGVsc2UgaWYgKGNoID09PSAnLCcgJiYgZGVwdGggPT09IDApIHsgYXJncy5wdXNoKGN1cnJlbnQudHJpbSgpKTsgY3VycmVudCA9ICcnOyB9XG4gICAgZWxzZSB7IGN1cnJlbnQgKz0gY2g7IH1cbiAgfVxuICBpZiAoY3VycmVudC50cmltKCkpIGFyZ3MucHVzaChjdXJyZW50LnRyaW0oKSk7XG4gIHJldHVybiBhcmdzO1xufVxuXG4vLyBQYXJzZSBMNVggbmV1dHJhbCB0ZXh0IHJ1bmcgd2l0aCBbbGVnMSAsbGVnMiBdIGJyYWNrZXQgYnJhbmNoIHN5bnRheC5cbi8vIEhhbmRsZXMgbmVzdGVkIGJyYWNrZXRzIChicmFuY2hlcyB3aXRoaW4gYnJhbmNoZXMpIGJ5IHByb2Nlc3Npbmcgb3V0ZXJtb3N0IGZpcnN0LlxuZnVuY3Rpb24gcGFyc2VCcmFja2V0QnJhbmNoVGV4dChcbiAgdGV4dDogc3RyaW5nLFxuICBydW5nTnVtYmVyOiBudW1iZXIsXG4gIHVubWFwcGVkOiBVbm1hcHBlZEVsZW1lbnRbXSxcbiAgd2FybmluZ3M6IHN0cmluZ1tdXG4pOiBQYXJzZWRSdW5nIHtcbiAgLy8gRmluZCBvdXRlcm1vc3QgWyBdIGJyYWNrZXQgZ3JvdXBzLCByZXNwZWN0aW5nIHBhcmVuIG5lc3RpbmcgaW5zaWRlXG4gIGNvbnN0IGFsbEVsZW1lbnRzOiBMYWRkZXJFbGVtZW50W10gPSBbXTtcbiAgY29uc3QgYWxsQnJhbmNoZXM6IEJyYW5jaFtdID0gW107XG4gIGxldCBwb3NYID0gMDtcbiAgbGV0IGkgPSAwO1xuXG4gIHdoaWxlIChpIDwgdGV4dC5sZW5ndGgpIHtcbiAgICAvLyBGaW5kIG5leHQgWyB0aGF0IGlzIG5vdCBpbnNpZGUgcGFyZW50aGVzZXNcbiAgICBsZXQgcGFyZW5EZXB0aCA9IDA7XG4gICAgbGV0IGJyYWNrZXRTdGFydCA9IC0xO1xuICAgIGZvciAobGV0IGogPSBpOyBqIDwgdGV4dC5sZW5ndGg7IGorKykge1xuICAgICAgY29uc3QgY2ggPSB0ZXh0W2pdO1xuICAgICAgaWYgKGNoID09PSAnKCcpIHBhcmVuRGVwdGgrKztcbiAgICAgIGVsc2UgaWYgKGNoID09PSAnKScpIHBhcmVuRGVwdGgtLTtcbiAgICAgIGVsc2UgaWYgKGNoID09PSAnWycgJiYgcGFyZW5EZXB0aCA9PT0gMCkgeyBicmFja2V0U3RhcnQgPSBqOyBicmVhazsgfVxuICAgIH1cblxuICAgIGlmIChicmFja2V0U3RhcnQgPT09IC0xKSB7XG4gICAgICAvLyBObyBtb3JlIGJyYWNrZXRzIFx1MjAxNCB0b2tlbml6ZSByZW1haW5pbmcgdGV4dCBhcyBtYWluIGVsZW1lbnRzXG4gICAgICBjb25zdCBtYWluUGFydCA9IHRleHQuc2xpY2UoaSkudHJpbSgpO1xuICAgICAgaWYgKG1haW5QYXJ0KSB7XG4gICAgICAgIGNvbnN0IHRva2VucyA9IHRva2VuaXplUnVuZ1RleHQobWFpblBhcnQpO1xuICAgICAgICBmb3IgKGNvbnN0IHRvayBvZiB0b2tlbnMpIHtcbiAgICAgICAgICBjb25zdCBlbCA9IG1hcEw1WEluc3RydWN0aW9uKHRvay5pbnN0ciwgdG9rLmFyZ3MsIHBvc1gsIHJ1bmdOdW1iZXIsIHVubWFwcGVkLCB3YXJuaW5ncyk7XG4gICAgICAgICAgaWYgKGVsKSB7IGFsbEVsZW1lbnRzLnB1c2goZWwpOyBwb3NYICs9IDYwOyB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIFRva2VuaXplIHRoZSB0ZXh0IGJlZm9yZSB0aGUgYnJhY2tldCBhcyBtYWluIGVsZW1lbnRzXG4gICAgY29uc3QgcHJlUGFydCA9IHRleHQuc2xpY2UoaSwgYnJhY2tldFN0YXJ0KS50cmltKCk7XG4gICAgaWYgKHByZVBhcnQpIHtcbiAgICAgIGNvbnN0IHRva2VucyA9IHRva2VuaXplUnVuZ1RleHQocHJlUGFydCk7XG4gICAgICBmb3IgKGNvbnN0IHRvayBvZiB0b2tlbnMpIHtcbiAgICAgICAgY29uc3QgZWwgPSBtYXBMNVhJbnN0cnVjdGlvbih0b2suaW5zdHIsIHRvay5hcmdzLCBwb3NYLCBydW5nTnVtYmVyLCB1bm1hcHBlZCwgd2FybmluZ3MpO1xuICAgICAgICBpZiAoZWwpIHsgYWxsRWxlbWVudHMucHVzaChlbCk7IHBvc1ggKz0gNjA7IH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBGaW5kIHRoZSBtYXRjaGluZyBjbG9zaW5nIGJyYWNrZXQsIHJlc3BlY3RpbmcgbmVzdGVkIHBhcmVucyBBTkQgbmVzdGVkIGJyYWNrZXRzXG4gICAgbGV0IGRlcHRoID0gMDtcbiAgICBsZXQgcGFyZW5EID0gMDtcbiAgICBsZXQgYnJhY2tldEVuZCA9IC0xO1xuICAgIGZvciAobGV0IGogPSBicmFja2V0U3RhcnQ7IGogPCB0ZXh0Lmxlbmd0aDsgaisrKSB7XG4gICAgICBjb25zdCBjaCA9IHRleHRbal07XG4gICAgICBpZiAoY2ggPT09ICcoJykgcGFyZW5EKys7XG4gICAgICBlbHNlIGlmIChjaCA9PT0gJyknKSBwYXJlbkQtLTtcbiAgICAgIGVsc2UgaWYgKGNoID09PSAnWycgJiYgcGFyZW5EID09PSAwKSBkZXB0aCsrO1xuICAgICAgZWxzZSBpZiAoY2ggPT09ICddJyAmJiBwYXJlbkQgPT09IDApIHsgZGVwdGgtLTsgaWYgKGRlcHRoID09PSAwKSB7IGJyYWNrZXRFbmQgPSBqOyBicmVhazsgfSB9XG4gICAgfVxuICAgIGlmIChicmFja2V0RW5kID09PSAtMSkgeyBpID0gYnJhY2tldFN0YXJ0ICsgMTsgY29udGludWU7IH1cblxuICAgIC8vIFNwbGl0IHRoZSBicmFja2V0IGNvbnRlbnRzIGJ5IHRvcC1sZXZlbCBjb21tYXMgKHBhcmFsbGVsIGxlZ3MpXG4gICAgY29uc3QgYnJhY2tldENvbnRlbnQgPSB0ZXh0LnNsaWNlKGJyYWNrZXRTdGFydCArIDEsIGJyYWNrZXRFbmQpO1xuICAgIGNvbnN0IGxlZ3M6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IGxlZ1N0YXJ0ID0gMDtcbiAgICBsZXQgcGQgPSAwOyBsZXQgYmQgPSAwO1xuICAgIGZvciAobGV0IGogPSAwOyBqIDwgYnJhY2tldENvbnRlbnQubGVuZ3RoOyBqKyspIHtcbiAgICAgIGNvbnN0IGNoID0gYnJhY2tldENvbnRlbnRbal07XG4gICAgICBpZiAoY2ggPT09ICcoJykgcGQrKztcbiAgICAgIGVsc2UgaWYgKGNoID09PSAnKScpIHBkLS07XG4gICAgICBlbHNlIGlmIChjaCA9PT0gJ1snKSBiZCsrO1xuICAgICAgZWxzZSBpZiAoY2ggPT09ICddJykgYmQtLTtcbiAgICAgIGVsc2UgaWYgKGNoID09PSAnLCcgJiYgcGQgPT09IDAgJiYgYmQgPT09IDApIHtcbiAgICAgICAgbGVncy5wdXNoKGJyYWNrZXRDb250ZW50LnNsaWNlKGxlZ1N0YXJ0LCBqKS50cmltKCkpO1xuICAgICAgICBsZWdTdGFydCA9IGogKyAxO1xuICAgICAgfVxuICAgIH1cbiAgICBsZWdzLnB1c2goYnJhY2tldENvbnRlbnQuc2xpY2UobGVnU3RhcnQpLnRyaW0oKSk7XG5cbiAgICAvLyBGaXJzdCBsZWcgPSBjb250aW51YXRpb24gb2YgbWFpbiBwYXRoLCByZW1haW5pbmcgbGVncyA9IEJyYW5jaCBlbGVtZW50c1xuICAgIGNvbnN0IGpvaW5Ob2RlSWQgPSBhbGxFbGVtZW50cy5sZW5ndGggPiAwID8gYWxsRWxlbWVudHNbYWxsRWxlbWVudHMubGVuZ3RoIC0gMV0uaWQgOiBgcnVuZyR7cnVuZ051bWJlcn0tcmFpbGA7XG4gICAgY29uc3QgbGVnRWxlbWVudHM6IExhZGRlckVsZW1lbnRbXVtdID0gbGVncy5tYXAobGVnID0+IHtcbiAgICAgIGNvbnN0IGxlZ1Rva2VucyA9IHRva2VuaXplUnVuZ1RleHQobGVnKTtcbiAgICAgIGNvbnN0IGVsZW1lbnRzOiBMYWRkZXJFbGVtZW50W10gPSBbXTtcbiAgICAgIGxldCBseCA9IHBvc1g7XG4gICAgICBmb3IgKGNvbnN0IHRvayBvZiBsZWdUb2tlbnMpIHtcbiAgICAgICAgY29uc3QgZWwgPSBtYXBMNVhJbnN0cnVjdGlvbih0b2suaW5zdHIsIHRvay5hcmdzLCBseCwgcnVuZ051bWJlciwgdW5tYXBwZWQsIHdhcm5pbmdzKTtcbiAgICAgICAgaWYgKGVsKSB7IGVsZW1lbnRzLnB1c2goZWwpOyBseCArPSA2MDsgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGVsZW1lbnRzO1xuICAgIH0pO1xuXG4gICAgLy8gUHVzaCBmaXJzdCBsZWcgZWxlbWVudHMgaW50byBtYWluIHBhdGhcbiAgICBmb3IgKGNvbnN0IGVsIG9mIGxlZ0VsZW1lbnRzWzBdID8/IFtdKSB7IGFsbEVsZW1lbnRzLnB1c2goZWwpOyB9XG4gICAgaWYgKGxlZ0VsZW1lbnRzWzBdPy5sZW5ndGgpIHBvc1ggKz0gbGVnRWxlbWVudHNbMF0ubGVuZ3RoICogNjA7XG5cbiAgICAvLyBSZW1haW5pbmcgbGVncyBhcmUgYnJhbmNoZXNcbiAgICBmb3IgKGxldCBsaSA9IDE7IGxpIDwgbGVnRWxlbWVudHMubGVuZ3RoOyBsaSsrKSB7XG4gICAgICBjb25zdCBsZWdFbHMgPSBsZWdFbGVtZW50c1tsaV07XG4gICAgICBpZiAobGVnRWxzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgYWxsQnJhbmNoZXMucHVzaCh7XG4gICAgICAgICAgaWQ6IGBydW5nJHtydW5nTnVtYmVyfS1icmFuY2gtJHthbGxCcmFuY2hlcy5sZW5ndGh9YCxcbiAgICAgICAgICBzdGFydE5vZGVJZDogam9pbk5vZGVJZCxcbiAgICAgICAgICBlbmROb2RlSWQ6IGxlZ0Vsc1tsZWdFbHMubGVuZ3RoIC0gMV0uaWQsXG4gICAgICAgICAgZWxlbWVudHM6IGxlZ0VscyxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaSA9IGJyYWNrZXRFbmQgKyAxO1xuICB9XG5cbiAgcmV0dXJuIHsgZWxlbWVudHM6IGFsbEVsZW1lbnRzLCBicmFuY2hlczogYWxsQnJhbmNoZXMgfTtcbn1cblxuZnVuY3Rpb24gcGFyc2VUb2tlbnNXaXRoQnJhbmNoZXMoXG4gIHRva2VuczogSW5zdHJUb2tlbltdLFxuICBydW5nTnVtYmVyOiBudW1iZXIsXG4gIHVubWFwcGVkOiBVbm1hcHBlZEVsZW1lbnRbXSxcbiAgd2FybmluZ3M6IHN0cmluZ1tdXG4pOiBQYXJzZWRSdW5nIHtcbiAgY29uc3QgbWFpbkVsZW1lbnRzOiBMYWRkZXJFbGVtZW50W10gPSBbXTtcbiAgY29uc3QgYnJhbmNoZXM6IEJyYW5jaFtdID0gW107XG4gIGxldCBwb3NYID0gMDtcbiAgbGV0IGkgPSAwO1xuXG4gIHdoaWxlIChpIDwgdG9rZW5zLmxlbmd0aCkge1xuICAgIGNvbnN0IHRva2VuID0gdG9rZW5zW2ldO1xuXG4gICAgaWYgKHRva2VuLmluc3RyID09PSAnQlNUJykge1xuICAgICAgLy8gU3RhcnQgb2YgYSBicmFuY2ggc2V0IFx1MjAxNCBjb2xsZWN0IGFsbCBicmFuY2hlcyB1bnRpbCBCTkRcbiAgICAgIGNvbnN0IGJyYW5jaFNldCA9IHBhcnNlQnJhbmNoU2V0KHRva2VucywgaSwgcnVuZ051bWJlciwgdW5tYXBwZWQsIHdhcm5pbmdzKTtcbiAgICAgIGJyYW5jaGVzLnB1c2goLi4uYnJhbmNoU2V0LmJyYW5jaGVzKTtcbiAgICAgIGkgPSBicmFuY2hTZXQuZW5kSW5kZXg7XG4gICAgICBwb3NYICs9IDYwO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBlbCA9IG1hcEw1WEluc3RydWN0aW9uKHRva2VuLmluc3RyLCB0b2tlbi5hcmdzLCBwb3NYLCBydW5nTnVtYmVyLCB1bm1hcHBlZCwgd2FybmluZ3MpO1xuICAgICAgaWYgKGVsKSB7XG4gICAgICAgIG1haW5FbGVtZW50cy5wdXNoKGVsKTtcbiAgICAgICAgcG9zWCArPSA2MDtcbiAgICAgIH1cbiAgICAgIGkrKztcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBlbGVtZW50czogbWFpbkVsZW1lbnRzLCBicmFuY2hlcyB9O1xufVxuXG5pbnRlcmZhY2UgQnJhbmNoU2V0UmVzdWx0IHtcbiAgYnJhbmNoZXM6IEJyYW5jaFtdO1xuICBlbmRJbmRleDogbnVtYmVyO1xufVxuXG5mdW5jdGlvbiBwYXJzZUJyYW5jaFNldChcbiAgdG9rZW5zOiBJbnN0clRva2VuW10sXG4gIHN0YXJ0SWR4OiBudW1iZXIsXG4gIHJ1bmdOdW1iZXI6IG51bWJlcixcbiAgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdLFxuICB3YXJuaW5nczogc3RyaW5nW11cbik6IEJyYW5jaFNldFJlc3VsdCB7XG4gIGNvbnN0IGJyYW5jaGVzOiBCcmFuY2hbXSA9IFtdO1xuICBsZXQgaSA9IHN0YXJ0SWR4ICsgMTsgLy8gc2tpcCBCU1RcbiAgbGV0IGN1cnJlbnRCcmFuY2hFbGVtZW50czogTGFkZGVyRWxlbWVudFtdID0gW107XG4gIGxldCBicmFuY2hQb3NYID0gMDtcbiAgbGV0IGJyYW5jaENvdW50ID0gMDtcblxuICAvLyBUaGUgZmlyc3QgYnJhbmNoIHN0YXJ0cyBpbW1lZGlhdGVseSBhZnRlciBCU1RcbiAgd2hpbGUgKGkgPCB0b2tlbnMubGVuZ3RoKSB7XG4gICAgY29uc3QgdG9rZW4gPSB0b2tlbnNbaV07XG5cbiAgICBpZiAodG9rZW4uaW5zdHIgPT09ICdOWEInKSB7XG4gICAgICAvLyBFbmQgY3VycmVudCBicmFuY2gsIHN0YXJ0IG5leHRcbiAgICAgIGlmIChjdXJyZW50QnJhbmNoRWxlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICBicmFuY2hlcy5wdXNoKHtcbiAgICAgICAgICBpZDogdWlkKGBicmFuY2gtciR7cnVuZ051bWJlcn1gKSxcbiAgICAgICAgICBzdGFydE5vZGVJZDogYHJ1bmctJHtydW5nTnVtYmVyfS1icmFuY2gtc3RhcnQtJHticmFuY2hDb3VudH1gLFxuICAgICAgICAgIGVuZE5vZGVJZDogYHJ1bmctJHtydW5nTnVtYmVyfS1icmFuY2gtZW5kLSR7YnJhbmNoQ291bnR9YCxcbiAgICAgICAgICBlbGVtZW50czogY3VycmVudEJyYW5jaEVsZW1lbnRzLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGJyYW5jaENvdW50Kys7XG4gICAgICBjdXJyZW50QnJhbmNoRWxlbWVudHMgPSBbXTtcbiAgICAgIGJyYW5jaFBvc1ggPSAwO1xuICAgICAgaSsrO1xuICAgIH0gZWxzZSBpZiAodG9rZW4uaW5zdHIgPT09ICdCTkQnKSB7XG4gICAgICAvLyBFbmQgb2YgYnJhbmNoIHNldCBcdTIwMTQgY2xvc2UgbGFzdCBicmFuY2hcbiAgICAgIGlmIChjdXJyZW50QnJhbmNoRWxlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICBicmFuY2hlcy5wdXNoKHtcbiAgICAgICAgICBpZDogdWlkKGBicmFuY2gtciR7cnVuZ051bWJlcn1gKSxcbiAgICAgICAgICBzdGFydE5vZGVJZDogYHJ1bmctJHtydW5nTnVtYmVyfS1icmFuY2gtc3RhcnQtJHticmFuY2hDb3VudH1gLFxuICAgICAgICAgIGVuZE5vZGVJZDogYHJ1bmctJHtydW5nTnVtYmVyfS1icmFuY2gtZW5kLSR7YnJhbmNoQ291bnR9YCxcbiAgICAgICAgICBlbGVtZW50czogY3VycmVudEJyYW5jaEVsZW1lbnRzLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGkrKzsgLy8gY29uc3VtZSBCTkRcbiAgICAgIGJyZWFrO1xuICAgIH0gZWxzZSBpZiAodG9rZW4uaW5zdHIgPT09ICdCU1QnKSB7XG4gICAgICAvLyBOZXN0ZWQgYnJhbmNoIFx1MjAxNCByZWN1cnNlXG4gICAgICBjb25zdCBuZXN0ZWQgPSBwYXJzZUJyYW5jaFNldCh0b2tlbnMsIGksIHJ1bmdOdW1iZXIsIHVubWFwcGVkLCB3YXJuaW5ncyk7XG4gICAgICAvLyBGbGF0dGVuIG5lc3RlZCBicmFuY2hlcyBpbnRvIGN1cnJlbnQgYnJhbmNoIChuZXN0ZWQgcGFyYWxsZWwgaXMgcmFyZSBidXQgdmFsaWQpXG4gICAgICBmb3IgKGNvbnN0IG5iIG9mIG5lc3RlZC5icmFuY2hlcykge1xuICAgICAgICBjdXJyZW50QnJhbmNoRWxlbWVudHMucHVzaCguLi5uYi5lbGVtZW50cyk7XG4gICAgICB9XG4gICAgICBpID0gbmVzdGVkLmVuZEluZGV4O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBlbCA9IG1hcEw1WEluc3RydWN0aW9uKHRva2VuLmluc3RyLCB0b2tlbi5hcmdzLCBicmFuY2hQb3NYLCBydW5nTnVtYmVyLCB1bm1hcHBlZCwgd2FybmluZ3MpO1xuICAgICAgaWYgKGVsKSB7XG4gICAgICAgIGN1cnJlbnRCcmFuY2hFbGVtZW50cy5wdXNoKGVsKTtcbiAgICAgICAgYnJhbmNoUG9zWCArPSA2MDtcbiAgICAgIH1cbiAgICAgIGkrKztcbiAgICB9XG4gIH1cblxuICAvLyBJZiB3ZSByYW4gb3V0IG9mIHRva2VucyB3aXRob3V0IEJORCAobWFsZm9ybWVkKSwgc3RpbGwgY2xvc2VcbiAgaWYgKGN1cnJlbnRCcmFuY2hFbGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgYnJhbmNoZXMucHVzaCh7XG4gICAgICBpZDogdWlkKGBicmFuY2gtciR7cnVuZ051bWJlcn1gKSxcbiAgICAgIHN0YXJ0Tm9kZUlkOiBgcnVuZy0ke3J1bmdOdW1iZXJ9LWJyYW5jaC1zdGFydC0ke2JyYW5jaENvdW50fWAsXG4gICAgICBlbmROb2RlSWQ6IGBydW5nLSR7cnVuZ051bWJlcn0tYnJhbmNoLWVuZC0ke2JyYW5jaENvdW50fWAsXG4gICAgICBlbGVtZW50czogY3VycmVudEJyYW5jaEVsZW1lbnRzLFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHsgYnJhbmNoZXMsIGVuZEluZGV4OiBpIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBJbnN0cnVjdGlvbiBtYXBwaW5nIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jb25zdCBMNVhfQ09OVEFDVF9NQVA6IFJlY29yZDxzdHJpbmcsIENvbnRhY3RUeXBlPiA9IHtcbiAgWElDOiAnTk8nLFxuICBYSU86ICdOQycsXG4gIE9TUjogJ1BfQ09OVEFDVCcsXG4gIE9TRjogJ05fQ09OVEFDVCcsXG4gIE9OUzogJ1BfQ09OVEFDVCcsICAvLyBPbmUtU2hvdCBcdTIwMTQgbWFwcyB0byByaXNpbmcgZWRnZSBjb250YWN0XG59O1xuXG5jb25zdCBMNVhfQ09JTF9NQVA6IFJlY29yZDxzdHJpbmcsIENvaWxUeXBlPiA9IHtcbiAgT1RFOiAnbm9ybWFsJyxcbiAgT1RMOiAnbGF0Y2gnLFxuICBPVFU6ICd1bmxhdGNoJyxcbiAgT1ROOiAnbmVnYXRlZCcsXG59O1xuXG5jb25zdCBMNVhfVElNRVJfTUFQOiBSZWNvcmQ8c3RyaW5nLCBGQlR5cGU+ID0ge1xuICBUT046ICdUT04nLCBUT0Y6ICdUT0YnLCBSVE86ICdUT04nLCBUUDogJ1RQJywgVE9OUjogJ1RPTlInLFxufTtcblxuY29uc3QgTDVYX0NPVU5URVJfTUFQOiBSZWNvcmQ8c3RyaW5nLCBGQlR5cGU+ID0ge1xuICBDVFU6ICdDVFUnLCBDVEQ6ICdDVEQnLCBDVFVEOiAnQ1RVRCcsXG59O1xuXG4vLyBDb21wYXJpc29uIGluc3RydWN0aW9uczogdGhlc2UgYWN0IGFzIGNvbnRhY3RzIHRoYXQgZW5lcmdpemUgd2hlbiBjb25kaXRpb24gaXMgdHJ1ZVxuY29uc3QgTDVYX0NPTVBBUkVfTUFQOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBFUVU6ICdFUScsIE5FUTogJ05FJywgR1JUOiAnR1QnLCBHRVE6ICdHRScsIExFUzogJ0xUJywgTEVROiAnTEUnLFxuICBMSU06ICdMSU1JVCcsIE1FUTogJ0VRJyxcbiAgLy8gU2hvcnQgYWxpYXNlcyB1c2VkIGluIHNvbWUgTDVYIGV4cG9ydHNcbiAgRVE6ICdFUScsIE5FOiAnTkUnLCBHVDogJ0dUJywgR0U6ICdHRScsIExUOiAnTFQnLCBMRTogJ0xFJyxcbiAgLy8gQ01QIFx1MjAxNCBnZW5lcmljIGNvbXBhcmUgd2l0aCBleHByZXNzaW9uIHN0cmluZ1xuICBDTVA6ICdFUScsXG59O1xuXG4vLyBNYXRoIGluc3RydWN0aW9uczogdGhlc2UgbWFwIHRvIGZ1bmN0aW9uIGJsb2NrcyB3aXRoIGlucHV0cy9vdXRwdXRcbmNvbnN0IEw1WF9NQVRIX01BUDogUmVjb3JkPHN0cmluZywgRkJUeXBlPiA9IHtcbiAgQUREOiAnQUREJywgU1VCOiAnU1VCJywgTVVMOiAnTVVMJywgRElWOiAnRElWJywgTU9EOiAnTU9EJyxcbiAgQUJTOiAnQUJTJywgU1FSOiAnU1FSVCcsIFNRUlQ6ICdTUVJUJywgTkVHOiAnTkVHJyxcbiAgLy8gVHJpZyAvIGFkdmFuY2VkIG1hdGhcbiAgU0lOOiAnU0lOJywgQ09TOiAnQ09TJywgVEFOOiAnVEFOJywgQVROOiAnQVRBTicsIEFUQU46ICdBVEFOJyxcbiAgQVNOOiAnQVNJTicsIEFDUzogJ0FDT1MnLCBMTjogJ0xOJywgTE9HOiAnTE9HJyxcbiAgLy8gQ1BUIFx1MjAxNCBDb21wdXRlIGV4cHJlc3Npb24gaW50byBkZXN0aW5hdGlvbiAocmVwcmVzZW50IGFzIEFERCBwbGFjZWhvbGRlcilcbiAgQ1BUOiAnQUREJyxcbn07XG5cbi8vIE1vdmUgLyBkYXRhLWNvcHkgaW5zdHJ1Y3Rpb25zXG5jb25zdCBMNVhfTU9WRV9NQVA6IFJlY29yZDxzdHJpbmcsIEZCVHlwZT4gPSB7XG4gIE1PVjogJ01PVkUnLCBNT1ZFOiAnTU9WRScsIENPUDogJ01PVkUnLCBDUFM6ICdNT1ZFJywgRkxMOiAnTU9WRScsXG4gIEJURDogJ0JURCcsIFNJWkU6ICdTSVpFJyxcbn07XG5cbi8vIEJpdHdpc2UgLyBsb2dpY2FsIGluc3RydWN0aW9ucyBcdTIxOTIgbWFwIHRvIGJvb2xlYW4gZ2F0ZSBibG9ja3NcbmNvbnN0IEw1WF9CSVRXSVNFX01BUDogUmVjb3JkPHN0cmluZywgRkJUeXBlPiA9IHtcbiAgQU5EOiAnQU5EJywgT1I6ICdPUicsIE5PVDogJ05PVCcsIFhPUjogJ1hPUicsXG4gIEJBTkQ6ICdBTkQnLCBCT1I6ICdPUicsIEJOT1Q6ICdOT1QnLCBCWE9SOiAnWE9SJyxcbn07XG5cbi8vIFNlbGVjdGlvbiAvIGNvbnZlcnNpb24gaW5zdHJ1Y3Rpb25zXG5jb25zdCBMNVhfU0VMRUNUX01BUDogUmVjb3JkPHN0cmluZywgRkJUeXBlPiA9IHtcbiAgU0VMOiAnU0VMJywgTVVYOiAnTVVYJywgTElNSVQ6ICdMSU1JVCcsIE1JTjogJ01JTicsIE1BWDogJ01BWCcsXG4gIExJTTogJ0xJTUlUJywgTUVROiAnRVEnLFxuICAvLyBUeXBlIGNvbnZlcnNpb25cbiAgVFJVTkM6ICdUUlVOQycsIFJPVU5EOiAnUk9VTkQnLFxuICBJTlRfVE9fUkVBTDogJ0lOVF9UT19SRUFMJywgUkVBTF9UT19JTlQ6ICdSRUFMX1RPX0lOVCcsXG4gIERJTlRfVE9fUkVBTDogJ0RJTlRfVE9fUkVBTCcsIFJFQUxfVE9fRElOVDogJ1JFQUxfVE9fRElOVCcsXG4gIC8vIFNjYWxpbmdcbiAgU0NMOiAnU0NBTEUnLCBTQ1A6ICdTQ0FMRScsXG4gIC8vIEJpdCBzaGlmdFxuICBTSEw6ICdNT1ZFJywgU0hSOiAnTU9WRScsIFJPTDogJ01PVkUnLCBST1I6ICdNT1ZFJyxcbiAgQlNMOiAnTU9WRScsIEJTUjogJ01PVkUnLFxufTtcblxuLy8gRklGTyAvIExJRk8gcXVldWUgaW5zdHJ1Y3Rpb25zXG5jb25zdCBMNVhfRklGT19NQVA6IFJlY29yZDxzdHJpbmcsIEZCVHlwZT4gPSB7XG4gIEZGTDogJ0ZGTCcsIEZGVTogJ0ZGVScsIExGTDogJ0xGTCcsIExGVTogJ0xGVScsXG59O1xuXG4vLyBTZXF1ZW5jZXIgaW5zdHJ1Y3Rpb25zXG5jb25zdCBMNVhfU0VRX01BUDogUmVjb3JkPHN0cmluZywgRkJUeXBlPiA9IHtcbiAgU1FPOiAnU1FPJywgU1FJOiAnU1FJJywgU1FMOiAnU1FMJyxcbn07XG5cbi8vIFBJRCBhbmQgcHJvY2VzcyBjb250cm9sXG5jb25zdCBMNVhfUElEX01BUDogUmVjb3JkPHN0cmluZywgRkJUeXBlPiA9IHtcbiAgUElEOiAnUElEJywgUElERTogJ1BJRCcsIFBJREFUOiAnUElEJyxcbn07XG5cbi8vIFN0cmluZyBpbnN0cnVjdGlvbnNcbmNvbnN0IEw1WF9TVFJJTkdfTUFQOiBSZWNvcmQ8c3RyaW5nLCBGQlR5cGU+ID0ge1xuICAvLyBMZW5ndGggLyBjb25jYXQgLyBjb21wYXJlXG4gIExFTjogJ0xFTicsIENPTkNBVDogJ0NPTkNBVCcsIEZJTkQ6ICdGSU5EJywgSU5TRVJUOiAnSU5TRVJUJyxcbiAgREVMRVRFOiAnREVMRVRFJywgTUlEOiAnTUlEJywgVVBQRVI6ICdVUFBFUl9DQVNFJywgTE9XRVI6ICdMT1dFUl9DQVNFJyxcbiAgTEVGVDogJ0xFRlQnLCBSSUdIVDogJ1JJR0hUJyxcbiAgLy8gU3RyaW5nIGNvbXBhcmlzb25cbiAgU1RSQ01QOiAnRVEnLCBTVFJJQ01QOiAnRVEnLFxuICAvLyBTdHJpbmcgdG8gbnVtYmVyIC8gbnVtYmVyIHRvIHN0cmluZ1xuICBTVE9EOiAnTU9WRScsIERUT1M6ICdNT1ZFJyxcbn07XG5cbi8vIE1vdGlvbiBpbnN0cnVjdGlvbnMgXHUyMDE0IGFsd2F5cyB1bm1hcHBlZCB3aXRoIG1ldGFkYXRhLCBidXQgd2UgZ2l2ZSB0aGVtIGEgYmxvY2sgc2hhcGVcbi8vIHNvIHRoZXkgYXBwZWFyIGFzIGJsb2NrcyBpbiB0aGUgY2FudmFzIChub3Qgc2lsZW50bHkgZHJvcHBlZClcbmNvbnN0IEw1WF9NT1RJT05fU0VUID0gbmV3IFNldChbXG4gICdNQUonLCAnTUFNJywgJ01BUycsICdNQU9DJywgJ01BQVQnLCAnTUFGUicsICdNQUhEJywgJ01BUlAnLCAnTUFSVycsXG4gIC8vIE1BUiBcdTIwMTQgTW90aW9uIEF4aXMgUmVnaXN0cmF0aW9uOiBNQVIoYXhpcywgcmVnaXN0cmF0aW9uLCBlZGdlLCAuLi4pXG4gICdNQVInLFxuICAnTUNEJywgJ01DVCcsICdNQ0NEJywgJ01DVEQnLCAnTUNQJywgJ01DTScsXG4gICdHU1YnLCAnU1NWJyxcbiAgJ01TRycsXG5dKTtcblxuLy8gRGlhZ25vc3RpYyAvIHByb2dyYW0gY29udHJvbCBpbnN0cnVjdGlvbnMgXHUyMDE0IGtlcHQgYXMgcGFzcy10aHJvdWdoIGJsb2Nrc1xuY29uc3QgTDVYX0RJQUdfU0VUID0gbmV3IFNldChbXG4gICdFT1QnLCAnRUZTJyxcbiAgJ1VJRCcsICdVSUUnLFxuICAnT05TJywgLy8gaGFuZGxlZCBhYm92ZSBhcyBjb250YWN0LCBidXQgZ3VhcmQgaGVyZSB0b29cbiAgJ1JFU0QnLCAnU0VURCcsXG5dKTtcblxuLy8gSGVscGVyOiBidWlsZCBhIG1pbmltYWwgMi1vcGVyYW5kIGJsb2NrIChJTiwgT1VUKVxuZnVuY3Rpb24gbWFrZUJsb2NrKFxuICBpbnN0cjogc3RyaW5nLFxuICBmYlR5cGU6IEZCVHlwZSxcbiAgaW5zdGFuY2VTdWZmaXg6IHN0cmluZyB8IG51bWJlcixcbiAgcnVuZ051bWJlcjogbnVtYmVyLFxuICBwaW5zOiBSZWNvcmQ8c3RyaW5nLCBUYWdSZWY+LFxuICBwb3NYOiBudW1iZXJcbik6IEJsb2NrRWxlbWVudCB7XG4gIHJldHVybiB7XG4gICAga2luZDogJ2Jsb2NrJyxcbiAgICBpZDogdWlkKGByJHtydW5nTnVtYmVyfS0ke2luc3RyfWApLFxuICAgIGZiVHlwZSxcbiAgICBpbnN0YW5jZU5hbWU6IGAke2luc3RyfV8ke2luc3RhbmNlU3VmZml4fWAsXG4gICAgcGlucyxcbiAgICBwb3NpdGlvbjogeyB4OiBwb3NYLCB5OiAwIH0sXG4gICAgdmVuZG9yT3JpZ2luYWxOYW1lOiBpbnN0ciAhPT0gKGZiVHlwZSBhcyBzdHJpbmcpID8gaW5zdHIgOiB1bmRlZmluZWQsXG4gIH0gYXMgQmxvY2tFbGVtZW50O1xufVxuXG5mdW5jdGlvbiBtYXBMNVhJbnN0cnVjdGlvbihcbiAgaW5zdHI6IHN0cmluZyxcbiAgYXJnczogc3RyaW5nW10sXG4gIHBvc1g6IG51bWJlcixcbiAgcnVuZ051bWJlcjogbnVtYmVyLFxuICB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10sXG4gIHdhcm5pbmdzOiBzdHJpbmdbXVxuKTogTGFkZGVyRWxlbWVudCB8IG51bGwge1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBDb250YWN0IGluc3RydWN0aW9ucyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgaWYgKEw1WF9DT05UQUNUX01BUFtpbnN0cl0pIHtcbiAgICBjb25zdCB0YWdOYW1lID0gYXJnc1swXSB8fCBgVEFHXyR7cG9zWH1gO1xuICAgIC8vIE9TUi9PU0YgdGFrZSAyIGFyZ3M6IE9TUihzdG9yYWdlQml0LCBvdXRwdXRCaXQpIFx1MjAxNCBzdG9yZSBib3RoIGZvciByb3VuZC10cmlwXG4gICAgY29uc3QgZXh0cmFUYWcgPSAoaW5zdHIgPT09ICdPU1InIHx8IGluc3RyID09PSAnT1NGJykgJiYgYXJnc1sxXSA/IGFyZ3NbMV0gOiB1bmRlZmluZWQ7XG4gICAgcmV0dXJuIHtcbiAgICAgIGtpbmQ6ICdjb250YWN0JyxcbiAgICAgIGlkOiB1aWQoYHIke3J1bmdOdW1iZXJ9LSR7aW5zdHJ9YCksXG4gICAgICB0eXBlOiBMNVhfQ09OVEFDVF9NQVBbaW5zdHJdLFxuICAgICAgdGFnOiB7IG5hbWU6IHRhZ05hbWUsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgIHBvc2l0aW9uOiB7IHg6IHBvc1gsIHk6IDAgfSxcbiAgICAgIHZlbmRvckFyZ3M6IGV4dHJhVGFnID8gW3RhZ05hbWUsIGV4dHJhVGFnXSA6IHVuZGVmaW5lZCxcbiAgICB9IGFzIGFueTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBDb2lsIGluc3RydWN0aW9ucyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgaWYgKEw1WF9DT0lMX01BUFtpbnN0cl0pIHtcbiAgICBjb25zdCB0YWdOYW1lID0gYXJnc1swXSB8fCBgVEFHXyR7cG9zWH1gO1xuICAgIHJldHVybiB7XG4gICAgICBraW5kOiAnY29pbCcsXG4gICAgICBpZDogdWlkKGByJHtydW5nTnVtYmVyfS0ke2luc3RyfWApLFxuICAgICAgdHlwZTogTDVYX0NPSUxfTUFQW2luc3RyXSxcbiAgICAgIHRhZzogeyBuYW1lOiB0YWdOYW1lLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICBwb3NpdGlvbjogeyB4OiBwb3NYLCB5OiAwIH0sXG4gICAgfTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBUaW1lciBpbnN0cnVjdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIC8vIFRPTih0aW1lciwgcHJlc2V0LCBhY2N1bSkgLyBUT0YgLyBSVE8gLyBUUCAvIFRPTlJcbiAgLy8gJz8nIGFyZ3MgbWVhbiB0aGUgdmFsdWUgaXMgZW1iZWRkZWQgaW4gdGhlIFRJTUVSIHN0cnVjdCAoTG9naXggY29udmVudGlvbilcbiAgaWYgKEw1WF9USU1FUl9NQVBbaW5zdHJdKSB7XG4gICAgY29uc3QgaW5zdGFuY2VOYW1lID0gYXJnc1swXSAmJiBhcmdzWzBdICE9PSAnPycgPyBhcmdzWzBdIDogYCR7aW5zdHJ9XyR7cG9zWH1gO1xuICAgIGNvbnN0IHByZXNldCA9IGFyZ3NbMV0gJiYgYXJnc1sxXSAhPT0gJz8nID8gYXJnc1sxXSA6IGAke2luc3RhbmNlTmFtZX0uUFJFYDtcbiAgICByZXR1cm4gbWFrZUJsb2NrKGluc3RyLCBMNVhfVElNRVJfTUFQW2luc3RyXSwgcG9zWCwgcnVuZ051bWJlciwge1xuICAgICAgRU46ICB7IG5hbWU6IGluc3RhbmNlTmFtZSArICcuRU4nLCAgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgUFQ6ICB7IG5hbWU6IHByZXNldCwgICAgICAgICAgICAgICBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICBROiAgIHsgbmFtZTogaW5zdGFuY2VOYW1lICsgJy5ETicsICBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICBFVDogIHsgbmFtZTogaW5zdGFuY2VOYW1lICsgJy5BQ0MnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgfSwgcG9zWCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgQ291bnRlciBpbnN0cnVjdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIC8vIENUVShjb3VudGVyLCBwcmVzZXQsIGFjY3VtKSAvIENURCAvIENUVURcbiAgaWYgKEw1WF9DT1VOVEVSX01BUFtpbnN0cl0pIHtcbiAgICBjb25zdCBpbnN0YW5jZU5hbWUgPSBhcmdzWzBdICYmIGFyZ3NbMF0gIT09ICc/JyA/IGFyZ3NbMF0gOiBgJHtpbnN0cn1fJHtwb3NYfWA7XG4gICAgY29uc3QgcHJlc2V0ID0gYXJnc1sxXSAmJiBhcmdzWzFdICE9PSAnPycgPyBhcmdzWzFdIDogYCR7aW5zdGFuY2VOYW1lfS5QUkVgO1xuICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsIEw1WF9DT1VOVEVSX01BUFtpbnN0cl0sIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgIENVOiB7IG5hbWU6IGluc3RhbmNlTmFtZSArICcuQ1UnLCAgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgUFY6IHsgbmFtZTogcHJlc2V0LCAgICAgICAgICAgICAgIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgIFFVOiB7IG5hbWU6IGluc3RhbmNlTmFtZSArICcuRE4nLCAgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgQ1Y6IHsgbmFtZTogaW5zdGFuY2VOYW1lICsgJy5BQ0MnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgfSwgcG9zWCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgTWF0aCBpbnN0cnVjdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIC8vIEFERChzcmMxLCBzcmMyLCBkZXN0KSAvIFNVQiAvIE1VTCAvIERJViAvIE1PRCAvIEFCUyAvIFNRUiAvIHRyaWcgLyBDUFQgXHUyMDI2XG4gIGlmIChMNVhfTUFUSF9NQVBbaW5zdHJdKSB7XG4gICAgY29uc3QgZGVzdCAgICA9IGFyZ3NbYXJncy5sZW5ndGggLSAxXSB8fCBgUkVTVUxUXyR7cG9zWH1gO1xuICAgIGNvbnN0IHNvdXJjZUEgPSBhcmdzWzBdIHx8ICcwJztcbiAgICBjb25zdCBzb3VyY2VCID0gYXJncy5sZW5ndGggPj0gMyA/IGFyZ3NbMV0gOiAnMCc7XG4gICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgTDVYX01BVEhfTUFQW2luc3RyXSwgcG9zWCwgcnVuZ051bWJlciwge1xuICAgICAgSU4xOiB7IG5hbWU6IHNvdXJjZUEsIGRhdGFUeXBlOiAnUkVBTCcgfSxcbiAgICAgIElOMjogeyBuYW1lOiBzb3VyY2VCLCBkYXRhVHlwZTogJ1JFQUwnIH0sXG4gICAgICBPVVQ6IHsgbmFtZTogZGVzdCwgICAgZGF0YVR5cGU6ICdSRUFMJyB9LFxuICAgIH0sIHBvc1gpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIENvbXBhcmlzb24gaW5zdHJ1Y3Rpb25zIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAvLyBFUVUoc3JjMSwgc3JjMikgXHUyMTkyIEVRIGJsb2NrOyBMSU0obG93LCB0ZXN0LCBoaWdoKSBcdTIxOTIgTElNSVQgYmxvY2tcbiAgaWYgKEw1WF9DT01QQVJFX01BUFtpbnN0cl0pIHtcbiAgICBpZiAoaW5zdHIgPT09ICdMSU0nKSB7XG4gICAgICBjb25zdCBsb3cgID0gYXJnc1swXSB8fCAnMCc7XG4gICAgICBjb25zdCB0ZXN0ID0gYXJnc1sxXSB8fCAnMCc7XG4gICAgICBjb25zdCBoaWdoID0gYXJnc1syXSB8fCAnMCc7XG4gICAgICByZXR1cm4gbWFrZUJsb2NrKGluc3RyLCAnTElNSVQnIGFzIEZCVHlwZSwgcG9zWCwgcnVuZ051bWJlciwge1xuICAgICAgICBNTjogIHsgbmFtZTogbG93LCAgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBJTjogIHsgbmFtZTogdGVzdCwgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBNWDogIHsgbmFtZTogaGlnaCwgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBPVVQ6IHsgbmFtZTogYF9MSU1fJHtwb3NYfWAsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgIH0sIHBvc1gpO1xuICAgIH1cbiAgICBpZiAoaW5zdHIgPT09ICdNRVEnKSB7XG4gICAgICBjb25zdCBzcmMgID0gYXJnc1swXSB8fCAnMCc7XG4gICAgICBjb25zdCBtYXNrID0gYXJnc1sxXSB8fCAnMCc7XG4gICAgICBjb25zdCBjbXAgID0gYXJnc1syXSB8fCAnMCc7XG4gICAgICByZXR1cm4gbWFrZUJsb2NrKGluc3RyLCAnRVEnIGFzIEZCVHlwZSwgcG9zWCwgcnVuZ051bWJlciwge1xuICAgICAgICBJTjE6ICB7IG5hbWU6IHNyYywgIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgTUFTSzogeyBuYW1lOiBtYXNrLCBkYXRhVHlwZTogJ0RXT1JEJyB9LFxuICAgICAgICBJTjI6ICB7IG5hbWU6IGNtcCwgIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgT1VUOiAgeyBuYW1lOiBgX01FUV8ke3Bvc1h9YCwgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgfSwgcG9zWCk7XG4gICAgfVxuICAgIGNvbnN0IHNvdXJjZUEgPSBhcmdzWzBdIHx8ICcwJztcbiAgICBjb25zdCBzb3VyY2VCID0gYXJnc1sxXSB8fCAnMCc7XG4gICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgTDVYX0NPTVBBUkVfTUFQW2luc3RyXSBhcyBGQlR5cGUsIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgIElOMTogeyBuYW1lOiBzb3VyY2VBLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICBJTjI6IHsgbmFtZTogc291cmNlQiwgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgT1VUOiB7IG5hbWU6IGBfQ01QXyR7cG9zWH1gLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgfSwgcG9zWCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgTW92ZSAvIGRhdGEtY29weSBpbnN0cnVjdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIC8vIE1PVihzcmMsIGRlc3QpIC8gQ09QKHNyYywgZGVzdCwgbGVuKSAvIENQUyAvIEZMTCh2YWx1ZSwgZGVzdCwgbGVuKVxuICBpZiAoTDVYX01PVkVfTUFQW2luc3RyXSkge1xuICAgIGNvbnN0IHNvdXJjZSA9IGFyZ3NbMF0gfHwgJzAnO1xuICAgIGNvbnN0IGRlc3QgICA9IGFyZ3NbMV0gfHwgYERFU1RfJHtwb3NYfWA7XG4gICAgaWYgKGluc3RyID09PSAnQlREJykge1xuICAgICAgLy8gQml0IGZpZWxkIGRpc3RyaWJ1dGU6IEJURChzcmMsIHNyY0JpdCwgZGVzdCwgZGVzdEJpdCwgbGVuKVxuICAgICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgJ0JURCcsIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgICAgSU46ICAgICAgeyBuYW1lOiBzb3VyY2UsICAgICAgIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgU1JDX0JJVDogeyBuYW1lOiBhcmdzWzFdIHx8ICcwJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBPVVQ6ICAgICB7IG5hbWU6IGFyZ3NbMl0gfHwgZGVzdCwgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBEU1RfQklUOiB7IG5hbWU6IGFyZ3NbM10gfHwgJzAnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIExFTjogICAgIHsgbmFtZTogYXJnc1s0XSB8fCAnMScsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgIH0sIHBvc1gpO1xuICAgIH1cbiAgICBpZiAoaW5zdHIgPT09ICdTSVpFJykge1xuICAgICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgJ1NJWkUnLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICAgIElOOiAgeyBuYW1lOiBzb3VyY2UsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgRElNOiB7IG5hbWU6IGFyZ3NbMV0gfHwgJzAnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIE9VVDogeyBuYW1lOiBhcmdzWzJdIHx8IGBERVNUXyR7cG9zWH1gLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICB9LCBwb3NYKTtcbiAgICB9XG4gICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgTDVYX01PVkVfTUFQW2luc3RyXSwgcG9zWCwgcnVuZ051bWJlciwge1xuICAgICAgSU46ICB7IG5hbWU6IHNvdXJjZSwgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgT1VUOiB7IG5hbWU6IGRlc3QsICAgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgIH0sIHBvc1gpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIEJpdHdpc2UgLyBsb2dpY2FsIGluc3RydWN0aW9ucyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgLy8gQU5EKHNyYzEsIHNyYzIsIGRlc3QpIC8gT1IgLyBOT1Qoc3JjLCBkZXN0KSAvIFhPUlxuICBpZiAoTDVYX0JJVFdJU0VfTUFQW2luc3RyXSkge1xuICAgIGNvbnN0IHNyYzEgPSBhcmdzWzBdIHx8ICcwJztcbiAgICBjb25zdCBzcmMyID0gYXJncy5sZW5ndGggPj0gMyA/IGFyZ3NbMV0gOiAnMCc7XG4gICAgY29uc3QgZGVzdCA9IGFyZ3NbYXJncy5sZW5ndGggLSAxXSB8fCBgUkVTVUxUXyR7cG9zWH1gO1xuICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsIEw1WF9CSVRXSVNFX01BUFtpbnN0cl0sIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgIElOMTogeyBuYW1lOiBzcmMxLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICBJTjI6IHsgbmFtZTogc3JjMiwgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgT1VUOiB7IG5hbWU6IGRlc3QsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICB9LCBwb3NYKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBTZWxlY3Rpb24gLyBjb252ZXJzaW9uIGluc3RydWN0aW9ucyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgaWYgKEw1WF9TRUxFQ1RfTUFQW2luc3RyXSkge1xuICAgIGlmIChpbnN0ciA9PT0gJ1NFTCcpIHtcbiAgICAgIGNvbnN0IHNlbCAgPSBhcmdzWzBdIHx8ICcwJztcbiAgICAgIGNvbnN0IGluMSAgPSBhcmdzWzFdIHx8ICcwJztcbiAgICAgIGNvbnN0IGluMiAgPSBhcmdzWzJdIHx8ICcwJztcbiAgICAgIGNvbnN0IGRlc3QgPSBhcmdzWzNdIHx8IGBERVNUXyR7cG9zWH1gO1xuICAgICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgJ1NFTCcsIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgICAgRzogICB7IG5hbWU6IHNlbCwgIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgICAgSU4wOiB7IG5hbWU6IGluMSwgIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgSU4xOiB7IG5hbWU6IGluMiwgIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgT1VUOiB7IG5hbWU6IGRlc3QsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgIH0sIHBvc1gpO1xuICAgIH1cbiAgICBpZiAoaW5zdHIgPT09ICdNVVgnKSB7XG4gICAgICBjb25zdCBzZWwgID0gYXJnc1swXSB8fCAnMCc7XG4gICAgICBjb25zdCBkZXN0ID0gYXJnc1thcmdzLmxlbmd0aCAtIDFdIHx8IGBERVNUXyR7cG9zWH1gO1xuICAgICAgY29uc3QgaW5wdXRQaW5zOiBSZWNvcmQ8c3RyaW5nLCBUYWdSZWY+ID0geyBLOiB7IG5hbWU6IHNlbCwgZGF0YVR5cGU6ICdESU5UJyB9IH07XG4gICAgICBhcmdzLnNsaWNlKDEsIGFyZ3MubGVuZ3RoIC0gMSkuZm9yRWFjaCgoYSwgaSkgPT4ge1xuICAgICAgICBpbnB1dFBpbnNbYElOJHtpfWBdID0geyBuYW1lOiBhLCBkYXRhVHlwZTogJ0RJTlQnIH07XG4gICAgICB9KTtcbiAgICAgIGlucHV0UGluc1snT1VUJ10gPSB7IG5hbWU6IGRlc3QsIGRhdGFUeXBlOiAnRElOVCcgfTtcbiAgICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsICdNVVgnLCBwb3NYLCBydW5nTnVtYmVyLCBpbnB1dFBpbnMsIHBvc1gpO1xuICAgIH1cbiAgICBpZiAoaW5zdHIgPT09ICdMSU1JVCcgfHwgaW5zdHIgPT09ICdMSU0nKSB7XG4gICAgICByZXR1cm4gbWFrZUJsb2NrKGluc3RyLCAnTElNSVQnLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICAgIE1OOiAgeyBuYW1lOiBhcmdzWzBdIHx8ICcwJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBJTjogIHsgbmFtZTogYXJnc1sxXSB8fCAnMCcsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgTVg6ICB7IG5hbWU6IGFyZ3NbMl0gfHwgJzAnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIE9VVDogeyBuYW1lOiBgX0xJTV8ke3Bvc1h9YCwgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgfSwgcG9zWCk7XG4gICAgfVxuICAgIGlmIChpbnN0ciA9PT0gJ01JTicgfHwgaW5zdHIgPT09ICdNQVgnKSB7XG4gICAgICByZXR1cm4gbWFrZUJsb2NrKGluc3RyLCBMNVhfU0VMRUNUX01BUFtpbnN0cl0sIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgICAgSU4xOiB7IG5hbWU6IGFyZ3NbMF0gfHwgJzAnLCBkYXRhVHlwZTogJ1JFQUwnIH0sXG4gICAgICAgIElOMjogeyBuYW1lOiBhcmdzWzFdIHx8ICcwJywgZGF0YVR5cGU6ICdSRUFMJyB9LFxuICAgICAgICBPVVQ6IHsgbmFtZTogYXJnc1syXSB8fCBgREVTVF8ke3Bvc1h9YCwgZGF0YVR5cGU6ICdSRUFMJyB9LFxuICAgICAgfSwgcG9zWCk7XG4gICAgfVxuICAgIGlmIChpbnN0ciA9PT0gJ1NDTCcgfHwgaW5zdHIgPT09ICdTQ1AnKSB7XG4gICAgICByZXR1cm4gbWFrZUJsb2NrKGluc3RyLCAnU0NBTEUnLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICAgIElOOiAgICB7IG5hbWU6IGFyZ3NbMF0gfHwgJzAnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIEluTWluOiB7IG5hbWU6IGFyZ3NbMV0gfHwgJzAnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIEluTWF4OiB7IG5hbWU6IGFyZ3NbMl0gfHwgJzAnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIE9VVDogICB7IG5hbWU6IGFyZ3NbM10gfHwgYERFU1RfJHtwb3NYfWAsIGRhdGFUeXBlOiAnUkVBTCcgfSxcbiAgICAgIH0sIHBvc1gpO1xuICAgIH1cbiAgICAvLyBHZW5lcmljIHNlbGVjdGlvbiAvIGNvbnZlcnNpb24gZmFsbHRocm91Z2hcbiAgICBjb25zdCBzcmMgID0gYXJnc1swXSB8fCAnMCc7XG4gICAgY29uc3QgZGVzdCA9IGFyZ3NbYXJncy5sZW5ndGggLSAxXSB8fCBgREVTVF8ke3Bvc1h9YDtcbiAgICByZXR1cm4gbWFrZUJsb2NrKGluc3RyLCBMNVhfU0VMRUNUX01BUFtpbnN0cl0sIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgIElOOiAgeyBuYW1lOiBzcmMsICBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICBPVVQ6IHsgbmFtZTogZGVzdCwgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgIH0sIHBvc1gpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIEZJRk8gLyBMSUZPIHF1ZXVlIGluc3RydWN0aW9ucyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgLy8gUmVhbCBzeW50YXg6IEZGTChzb3VyY2UsIEZJRk9fYXJyYXksIENUUkxfc3RydWN0LCA/LCA/KVxuICAvLyAgICAgICAgICAgICAgRkZVKEZJRk9fYXJyYXksIGRlc3QsIENUUkxfc3RydWN0LCA/LCA/KVxuICAvLyBUaGUgJz8nIGFyZ3MgYXJlIGxlbi9wb3MgZW1iZWRkZWQgaW4gdGhlIENUUkwgc3RydWN0IFx1MjAxNCB0cmVhdCBhcyB1bmtub3duXG4gIGlmIChMNVhfRklGT19NQVBbaW5zdHJdKSB7XG4gICAgY29uc3QgaXNGaWxsID0gaW5zdHIgPT09ICdGRkwnIHx8IGluc3RyID09PSAnTEZMJztcbiAgICBjb25zdCB2YWxpZEFyZyA9IChhOiBzdHJpbmcgfCB1bmRlZmluZWQpID0+ICghYSB8fCBhID09PSAnPycpID8gdW5kZWZpbmVkIDogYTtcbiAgICBpZiAoaXNGaWxsKSB7XG4gICAgICBjb25zdCBjdHJsID0gdmFsaWRBcmcoYXJnc1syXSkgfHwgYCR7aW5zdHJ9X0NUUkxgO1xuICAgICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgTDVYX0ZJRk9fTUFQW2luc3RyXSwgcG9zWCwgcnVuZ051bWJlciwge1xuICAgICAgICBJTjogICB7IG5hbWU6IHZhbGlkQXJnKGFyZ3NbMF0pIHx8ICcwJywgICAgICAgICAgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBGSUZPOiB7IG5hbWU6IHZhbGlkQXJnKGFyZ3NbMV0pIHx8IGAke2luc3RyfV9RYCwgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBDVFJMOiB7IG5hbWU6IGN0cmwsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVR5cGU6ICdDT05UUk9MJyB9LFxuICAgICAgICBMRU46ICB7IG5hbWU6IGAke2N0cmx9LkxFTmAsICAgICAgICAgICAgICAgICAgICBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIFBPUzogIHsgbmFtZTogYCR7Y3RybH0uUE9TYCwgICAgICAgICAgICAgICAgICAgIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgRU06ICAgeyBuYW1lOiBgJHtjdHJsfS5FTWAsICAgICAgICAgICAgICAgICAgICAgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgICBETjogICB7IG5hbWU6IGAke2N0cmx9LkROYCwgICAgICAgICAgICAgICAgICAgICBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICB9LCBwb3NYKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgY3RybCA9IHZhbGlkQXJnKGFyZ3NbMl0pIHx8IGAke2luc3RyfV9DVFJMYDtcbiAgICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsIEw1WF9GSUZPX01BUFtpbnN0cl0sIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgICAgRklGTzogeyBuYW1lOiB2YWxpZEFyZyhhcmdzWzBdKSB8fCBgJHtpbnN0cn1fUWAsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgT1VUOiAgeyBuYW1lOiB2YWxpZEFyZyhhcmdzWzFdKSB8fCBgREVTVF8ke3Bvc1h9YCwgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBDVFJMOiB7IG5hbWU6IGN0cmwsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVR5cGU6ICdDT05UUk9MJyB9LFxuICAgICAgICBMRU46ICB7IG5hbWU6IGAke2N0cmx9LkxFTmAsICAgICAgICAgICAgICAgICAgICBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIFBPUzogIHsgbmFtZTogYCR7Y3RybH0uUE9TYCwgICAgICAgICAgICAgICAgICAgIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgRU06ICAgeyBuYW1lOiBgJHtjdHJsfS5FTWAsICAgICAgICAgICAgICAgICAgICAgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgICBETjogICB7IG5hbWU6IGAke2N0cmx9LkROYCwgICAgICAgICAgICAgICAgICAgICBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICB9LCBwb3NYKTtcbiAgICB9XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgU2VxdWVuY2VyIGluc3RydWN0aW9ucyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgLy8gU1FPKGZpbGUsIG1hc2ssIGRlc3QsIGNvbnRyb2wsIGxlbiwgcG9zKVxuICAvLyBTUUkoZmlsZSwgbWFzaywgc3JjLCBjb250cm9sLCBsZW4sIHBvcylcbiAgLy8gU1FMKGZpbGUsIGRlc3QsIGNvbnRyb2wsIGxlbiwgcG9zKVxuICBpZiAoTDVYX1NFUV9NQVBbaW5zdHJdKSB7XG4gICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgTDVYX1NFUV9NQVBbaW5zdHJdLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICBGSUxFOiB7IG5hbWU6IGFyZ3NbMF0gfHwgYCR7aW5zdHJ9X0ZJTEVgLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICBNQVNLOiB7IG5hbWU6IGFyZ3NbMV0gfHwgJzAnLCAgICAgICAgICAgICBkYXRhVHlwZTogJ0RXT1JEJyB9LFxuICAgICAgREVTVDogeyBuYW1lOiBhcmdzWzJdIHx8IGBERVNUXyR7cG9zWH1gLCAgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgQ1RSTDogeyBuYW1lOiBhcmdzWzNdIHx8IGAke2luc3RyfV9DVFJMYCwgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgTEVOOiAgeyBuYW1lOiBhcmdzWzRdIHx8ICcwJywgICAgICAgICAgICAgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgUE9TOiAgeyBuYW1lOiBhcmdzWzVdIHx8ICcwJywgICAgICAgICAgICAgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgRE46ICAgeyBuYW1lOiBgJHthcmdzWzNdIHx8IGluc3RyfS5ETmAsICAgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgRVI6ICAgeyBuYW1lOiBgJHthcmdzWzNdIHx8IGluc3RyfS5FUmAsICAgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgIH0sIHBvc1gpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFBJRCAvIFByb2Nlc3MgY29udHJvbCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgLy8gUElEKFBJRCwgcHJvY2VzcywgdGllYmFjaywgY29udHJvbCwgUElEX2RhdGEpXG4gIGlmIChMNVhfUElEX01BUFtpbnN0cl0pIHtcbiAgICByZXR1cm4gbWFrZUJsb2NrKGluc3RyLCBMNVhfUElEX01BUFtpbnN0cl0sIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgIElOOiAgICAgeyBuYW1lOiBhcmdzWzFdIHx8IGBQVl8ke3Bvc1h9YCwgICBkYXRhVHlwZTogJ1JFQUwnIH0sXG4gICAgICBTUDogICAgIHsgbmFtZTogYCR7YXJnc1swXSB8fCBpbnN0cn0uU1BgLCAgZGF0YVR5cGU6ICdSRUFMJyB9LFxuICAgICAgT1VUOiAgICB7IG5hbWU6IGFyZ3NbM10gfHwgYENWXyR7cG9zWH1gLCAgIGRhdGFUeXBlOiAnUkVBTCcgfSxcbiAgICAgIEtQOiAgICAgeyBuYW1lOiBgJHthcmdzWzBdIHx8IGluc3RyfS5LUGAsICBkYXRhVHlwZTogJ1JFQUwnIH0sXG4gICAgICBLSTogICAgIHsgbmFtZTogYCR7YXJnc1swXSB8fCBpbnN0cn0uS0lgLCAgZGF0YVR5cGU6ICdSRUFMJyB9LFxuICAgICAgS0Q6ICAgICB7IG5hbWU6IGAke2FyZ3NbMF0gfHwgaW5zdHJ9LktEYCwgIGRhdGFUeXBlOiAnUkVBTCcgfSxcbiAgICAgIEVOOiAgICAgeyBuYW1lOiBgJHthcmdzWzBdIHx8IGluc3RyfS5FTmAsICBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgfSwgcG9zWCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgU3RyaW5nIGluc3RydWN0aW9ucyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgaWYgKEw1WF9TVFJJTkdfTUFQW2luc3RyXSkge1xuICAgIGNvbnN0IHNyYzEgPSBhcmdzWzBdIHx8IGBTVFJfJHtwb3NYfWA7XG4gICAgY29uc3Qgc3JjMiA9IGFyZ3MubGVuZ3RoID49IDMgPyBhcmdzWzFdIDogJyc7XG4gICAgY29uc3QgZGVzdCA9IGFyZ3NbYXJncy5sZW5ndGggLSAxXSB8fCBgREVTVF8ke3Bvc1h9YDtcbiAgICBpZiAoaW5zdHIgPT09ICdNSUQnKSB7XG4gICAgICByZXR1cm4gbWFrZUJsb2NrKGluc3RyLCAnTUlEJywgcG9zWCwgcnVuZ051bWJlciwge1xuICAgICAgICBJTjogICAgeyBuYW1lOiBzcmMxLCAgICAgICAgICAgZGF0YVR5cGU6ICdTVFJJTkcnIH0sXG4gICAgICAgIExFTjogICB7IG5hbWU6IGFyZ3NbMV0gfHwgJzEnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIFNUQVJUOiB7IG5hbWU6IGFyZ3NbMl0gfHwgJzEnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIE9VVDogICB7IG5hbWU6IGRlc3QsICAgICAgICAgICBkYXRhVHlwZTogJ1NUUklORycgfSxcbiAgICAgIH0sIHBvc1gpO1xuICAgIH1cbiAgICBpZiAoaW5zdHIgPT09ICdDT05DQVQnKSB7XG4gICAgICByZXR1cm4gbWFrZUJsb2NrKGluc3RyLCAnQ09OQ0FUJywgcG9zWCwgcnVuZ051bWJlciwge1xuICAgICAgICBJTjE6IHsgbmFtZTogc3JjMSwgZGF0YVR5cGU6ICdTVFJJTkcnIH0sXG4gICAgICAgIElOMjogeyBuYW1lOiBzcmMyIHx8ICcnLCBkYXRhVHlwZTogJ1NUUklORycgfSxcbiAgICAgICAgT1VUOiB7IG5hbWU6IGRlc3QsIGRhdGFUeXBlOiAnU1RSSU5HJyB9LFxuICAgICAgfSwgcG9zWCk7XG4gICAgfVxuICAgIGlmIChpbnN0ciA9PT0gJ0ZJTkQnKSB7XG4gICAgICByZXR1cm4gbWFrZUJsb2NrKGluc3RyLCAnRklORCcsIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgICAgSU4xOiB7IG5hbWU6IHNyYzEsICAgICAgICAgICBkYXRhVHlwZTogJ1NUUklORycgfSxcbiAgICAgICAgSU4yOiB7IG5hbWU6IHNyYzIgfHwgJycsICAgICBkYXRhVHlwZTogJ1NUUklORycgfSxcbiAgICAgICAgT1VUOiB7IG5hbWU6IGRlc3QsICAgICAgICAgICBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICB9LCBwb3NYKTtcbiAgICB9XG4gICAgaWYgKGluc3RyID09PSAnSU5TRVJUJykge1xuICAgICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgJ0lOU0VSVCcsIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgICAgSU4xOiB7IG5hbWU6IHNyYzEsICAgICAgICAgICBkYXRhVHlwZTogJ1NUUklORycgfSxcbiAgICAgICAgSU4yOiB7IG5hbWU6IHNyYzIgfHwgJycsICAgICBkYXRhVHlwZTogJ1NUUklORycgfSxcbiAgICAgICAgUE9TOiB7IG5hbWU6IGFyZ3NbMl0gfHwgJzEnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIE9VVDogeyBuYW1lOiBkZXN0LCAgICAgICAgICAgZGF0YVR5cGU6ICdTVFJJTkcnIH0sXG4gICAgICB9LCBwb3NYKTtcbiAgICB9XG4gICAgaWYgKGluc3RyID09PSAnREVMRVRFJykge1xuICAgICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgJ0RFTEVURScsIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgICAgSU46ICAgIHsgbmFtZTogc3JjMSwgICAgICAgICAgIGRhdGFUeXBlOiAnU1RSSU5HJyB9LFxuICAgICAgICBMRU46ICAgeyBuYW1lOiBhcmdzWzFdIHx8ICcxJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBTVEFSVDogeyBuYW1lOiBhcmdzWzJdIHx8ICcxJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBPVVQ6ICAgeyBuYW1lOiBkZXN0LCAgICAgICAgICAgZGF0YVR5cGU6ICdTVFJJTkcnIH0sXG4gICAgICB9LCBwb3NYKTtcbiAgICB9XG4gICAgLy8gTEVOIC8gTEVGVCAvIFJJR0hUIC8gVVBQRVIgLyBMT1dFUiBcdTIwMTQgZ2VuZXJpYyBzaW5nbGUtc291cmNlXG4gICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgTDVYX1NUUklOR19NQVBbaW5zdHJdLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICBJTjogIHsgbmFtZTogc3JjMSwgZGF0YVR5cGU6ICdTVFJJTkcnIH0sXG4gICAgICBPVVQ6IHsgbmFtZTogZGVzdCwgZGF0YVR5cGU6IGluc3RyID09PSAnTEVOJyA/ICdESU5UJyA6ICdTVFJJTkcnIH0sXG4gICAgfSwgcG9zWCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgTW90aW9uIGluc3RydWN0aW9ucyBcdTIwMTQgYWx3YXlzIHVubWFwcGVkLCBidXQgZW1pdCBhIGJsb2NrIHBsYWNlaG9sZGVyIFx1MjUwMFx1MjUwMFx1MjUwMFxuICAvLyBzbyB0aGV5IGFwcGVhciBvbiB0aGUgY2FudmFzIGFuZCBhcmUgcHJlc2VydmVkIHRocm91Z2ggc2lkZWNhclxuICBpZiAoTDVYX01PVElPTl9TRVQuaGFzKGluc3RyKSkge1xuICAgIGNvbnN0IGluc3RhbmNlTmFtZSA9IGFyZ3NbMF0gfHwgYCR7aW5zdHJ9XyR7cG9zWH1gO1xuICAgIGNvbnN0IGJsb2NrID0gbWFrZUJsb2NrKGluc3RyLCAnTU9WRScgYXMgRkJUeXBlLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICBJTjogeyBuYW1lOiBpbnN0YW5jZU5hbWUsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICB9LCBwb3NYKTtcbiAgICB1bm1hcHBlZC5wdXNoKHtcbiAgICAgIGNsbU5vZGVJZDogYmxvY2suaWQsXG4gICAgICB2ZW5kb3JTcGVjaWZpY0RhdGE6IHsgaW5zdHIsIGFyZ3MgfSxcbiAgICAgIHJlYXNvbjogYE1vdGlvbi9HU1YvTVNHIGluc3RydWN0aW9uIChjYW52YXMgcGxhY2Vob2xkZXIpOiAke2luc3RyfSgke2FyZ3Muam9pbignLCcpfSlgLFxuICAgIH0pO1xuICAgIHJldHVybiBibG9jaztcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBSRVMgXHUyMDE0IGNvdW50ZXIvdGltZXIgcmVzZXQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGlmIChpbnN0ciA9PT0gJ1JFUycpIHtcbiAgICBjb25zdCB0YWdOYW1lID0gYXJnc1swXSB8fCBgVEFHXyR7cG9zWH1gO1xuICAgIHJldHVybiB7XG4gICAgICBraW5kOiAnY29pbCcsXG4gICAgICBpZDogdWlkKGByJHtydW5nTnVtYmVyfS1SRVNgKSxcbiAgICAgIHR5cGU6ICdyZXNldCcsXG4gICAgICB0YWc6IHsgbmFtZTogdGFnTmFtZSwgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgcG9zaXRpb246IHsgeDogcG9zWCwgeTogMCB9LFxuICAgIH07XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgRGlhZ25vc3RpYyAvIHByb2dyYW0gY29udHJvbCBcdTIwMTQgZW1pdCBuby1vcCBibG9jayBwbGFjZWhvbGRlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGlmIChMNVhfRElBR19TRVQuaGFzKGluc3RyKSkge1xuICAgIC8vIFVJRC9VSUUgZGlzYWJsZS9lbmFibGUgaW50ZXJydXB0IFx1MjAxNCBza2lwIHNpbGVudGx5ICh0aGV5IGhhdmUgbm8gdmlzdWFsIHNoYXBlKVxuICAgIGlmIChpbnN0ciA9PT0gJ1VJRCcgfHwgaW5zdHIgPT09ICdVSUUnKSByZXR1cm4gbnVsbDtcbiAgICAvLyBPdGhlcnMgYmVjb21lIGEgbGFiZWxlZCBibG9jayBwbGFjZWhvbGRlciAocHJlc2VydmVzIHJvdW5kLXRyaXAgcG9zaXRpb24pXG4gICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgJ01PVkUnIGFzIEZCVHlwZSwgcG9zWCwgcnVuZ051bWJlciwge30sIHBvc1gpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIEVWRU5UIFx1MjAxNCB0cmlnZ2VyIGV2ZW50IHRhc2sgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGlmIChpbnN0ciA9PT0gJ0VWRU5UJykge1xuICAgIGNvbnN0IHRhc2tOYW1lID0gYXJnc1swXSB8fCAnRVZFTlRfVEFTSyc7XG4gICAgcmV0dXJuIHtcbiAgICAgIGtpbmQ6ICdjb2lsJyxcbiAgICAgIGlkOiB1aWQoYHIke3J1bmdOdW1iZXJ9LUVWRU5UYCksXG4gICAgICB0eXBlOiAnbm9ybWFsJyxcbiAgICAgIHRhZzogeyBuYW1lOiBgX0VWRU5UXyR7dGFza05hbWV9YCwgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgcG9zaXRpb246IHsgeDogcG9zWCwgeTogMCB9LFxuICAgIH07XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgSlNSIFx1MjAxNCBKdW1wIHRvIFN1YnJvdXRpbmUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGlmIChpbnN0ciA9PT0gJ0pTUicpIHtcbiAgICBjb25zdCByb3V0aW5lTmFtZSA9IGFyZ3NbMF0gfHwgJ1VOS05PV04nO1xuICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsICdNT1ZFJyBhcyBGQlR5cGUsIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgIFJPVVRJTkU6IHsgbmFtZTogcm91dGluZU5hbWUsIGRhdGFUeXBlOiAnU1RSSU5HJyB9LFxuICAgICAgSU46ICAgICAgeyBuYW1lOiBhcmdzWzFdIHx8ICcwJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgT1VUOiAgICAgeyBuYW1lOiBhcmdzWzJdIHx8ICcwJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgIH0sIHBvc1gpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFJFVCBcdTIwMTQgUmV0dXJuIGZyb20gc3Vicm91dGluZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgaWYgKGluc3RyID09PSAnUkVUJykge1xuICAgIHJldHVybiB7XG4gICAgICBraW5kOiAnY29pbCcsXG4gICAgICBpZDogdWlkKGByJHtydW5nTnVtYmVyfS1SRVRgKSxcbiAgICAgIHR5cGU6ICdub3JtYWwnLFxuICAgICAgdGFnOiB7IG5hbWU6ICdfUkVUJywgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgcG9zaXRpb246IHsgeDogcG9zWCwgeTogMCB9LFxuICAgIH07XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgU0JSIFx1MjAxNCBTdWJyb3V0aW5lIGRlY2xhcmF0aW9uOiBza2lwIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBpZiAoaW5zdHIgPT09ICdTQlInKSByZXR1cm4gbnVsbDtcblxuICAvLyBcdTI1MDBcdTI1MDAgQUZJIFx1MjAxNCBBbHdheXMgRmFsc2UgSW5zdHJ1Y3Rpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGlmIChpbnN0ciA9PT0gJ0FGSScpIHtcbiAgICByZXR1cm4ge1xuICAgICAga2luZDogJ2NvbnRhY3QnLFxuICAgICAgaWQ6IHVpZChgciR7cnVuZ051bWJlcn0tQUZJYCksXG4gICAgICB0eXBlOiAnTkMnLFxuICAgICAgdGFnOiB7IG5hbWU6ICdfQUxXQVlTX0ZBTFNFJywgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgcG9zaXRpb246IHsgeDogcG9zWCwgeTogMCB9LFxuICAgIH07XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgTk9QIFx1MjAxNCBObyBPcGVyYXRpb246IHNraXAgc2lsZW50bHkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGlmIChpbnN0ciA9PT0gJ05PUCcpIHJldHVybiBudWxsO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBKTVAgXHUyMDE0IEp1bXAgdG8gbGFiZWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGlmIChpbnN0ciA9PT0gJ0pNUCcpIHtcbiAgICBjb25zdCBsYWJlbCA9IGFyZ3NbMF0gfHwgJ0xCTDAnO1xuICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsICdNT1ZFJyBhcyBGQlR5cGUsIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgIExBQkVMOiB7IG5hbWU6IGxhYmVsLCBkYXRhVHlwZTogJ1NUUklORycgfSxcbiAgICB9LCBwb3NYKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBMQkwgXHUyMDE0IExhYmVsIHRhcmdldCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgaWYgKGluc3RyID09PSAnTEJMJykge1xuICAgIGNvbnN0IGxhYmVsID0gYXJnc1swXSB8fCAnTEJMMCc7XG4gICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgJ01PVkUnIGFzIEZCVHlwZSwgcG9zWCwgcnVuZ051bWJlciwge1xuICAgICAgTEFCRUw6IHsgbmFtZTogbGFiZWwsIGRhdGFUeXBlOiAnU1RSSU5HJyB9LFxuICAgIH0sIHBvc1gpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIE1DUiBcdTIwMTQgTWFzdGVyIENvbnRyb2wgUmVzZXQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGlmIChpbnN0ciA9PT0gJ01DUicpIHJldHVybiBudWxsOyAvLyBNQ1IgaXMgem9uZSBkZWxpbWl0ZXIsIG5vIHZpc3VhbCBlbGVtZW50XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFRORCBcdTIwMTQgVGVtcG9yYXJ5IEVuZCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgaWYgKGluc3RyID09PSAnVE5EJykge1xuICAgIHJldHVybiB7XG4gICAgICBraW5kOiAnY29pbCcsXG4gICAgICBpZDogdWlkKGByJHtydW5nTnVtYmVyfS1UTkRgKSxcbiAgICAgIHR5cGU6ICdub3JtYWwnLFxuICAgICAgdGFnOiB7IG5hbWU6ICdfVE5EJywgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgcG9zaXRpb246IHsgeDogcG9zWCwgeTogMCB9LFxuICAgIH07XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgRk9SIC8gTkVYVCAvIEJSSyBcdTIwMTQgbG9vcCBjb250cm9sIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBpZiAoaW5zdHIgPT09ICdGT1InKSB7XG4gICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgJ01PVkUnIGFzIEZCVHlwZSwgcG9zWCwgcnVuZ051bWJlciwge1xuICAgICAgUk9VVElORTogeyBuYW1lOiBhcmdzWzBdIHx8ICdMT09QJywgZGF0YVR5cGU6ICdTVFJJTkcnIH0sXG4gICAgICBJTkRFWDogICB7IG5hbWU6IGFyZ3NbMV0gfHwgJzAnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICBJTklUOiAgICB7IG5hbWU6IGFyZ3NbMl0gfHwgJzAnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICBURVJNOiAgICB7IG5hbWU6IGFyZ3NbM10gfHwgJzAnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICBTVEVQOiAgICB7IG5hbWU6IGFyZ3NbNF0gfHwgJzEnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgfSwgcG9zWCk7XG4gIH1cbiAgaWYgKGluc3RyID09PSAnTkVYVCcpIHJldHVybiBudWxsO1xuICBpZiAoaW5zdHIgPT09ICdCUksnKSByZXR1cm4gbnVsbDtcblxuICAvLyBcdTI1MDBcdTI1MDAgRkFMIC8gRlNDIFx1MjAxNCBmaWxlIGFyaXRobWV0aWMvc2VhcmNoL2NvbXBhcmUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGlmIChpbnN0ciA9PT0gJ0ZBTCcgfHwgaW5zdHIgPT09ICdGU0MnKSB7XG4gICAgY29uc3QgY3RybCA9IGFyZ3NbMF0gfHwgYCR7aW5zdHJ9X0NUUkxgO1xuICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsICdNT1ZFJyBhcyBGQlR5cGUsIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgIENUUkw6ICB7IG5hbWU6IGN0cmwsIGRhdGFUeXBlOiAnQ09OVFJPTCcgfSxcbiAgICAgIExFTjogICB7IG5hbWU6IGFyZ3NbMV0gfHwgJzAnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICBQT1M6ICAgeyBuYW1lOiBhcmdzWzJdIHx8ICcwJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgTU9ERTogIHsgbmFtZTogYXJnc1szXSB8fCAnMCcsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgIERFU1Q6ICB7IG5hbWU6IGFyZ3NbNF0gfHwgJzAnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICBFWFBSOiAgeyBuYW1lOiBhcmdzWzVdIHx8ICcwJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgIH0sIHBvc1gpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIEFWRSAvIFNSVCAvIFNURCBcdTIwMTQgZmlsZSBzdGF0aXN0aWNzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBpZiAoaW5zdHIgPT09ICdBVkUnIHx8IGluc3RyID09PSAnU1JUJyB8fCBpbnN0ciA9PT0gJ1NURCcpIHtcbiAgICBjb25zdCBjdHJsID0gYXJnc1sxXSB8fCBgJHtpbnN0cn1fQ1RSTGA7XG4gICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgJ01PVkUnIGFzIEZCVHlwZSwgcG9zWCwgcnVuZ051bWJlciwge1xuICAgICAgQVJSQVk6IHsgbmFtZTogYXJnc1swXSB8fCAnMCcsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgIENUUkw6ICB7IG5hbWU6IGN0cmwsIGRhdGFUeXBlOiAnQ09OVFJPTCcgfSxcbiAgICAgIERFU1Q6ICB7IG5hbWU6IGFyZ3NbMl0gfHwgJzAnLCBkYXRhVHlwZTogJ1JFQUwnIH0sXG4gICAgICBMRU46ICAgeyBuYW1lOiBhcmdzWzNdIHx8ICcwJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgUE9TOiAgIHsgbmFtZTogYXJnc1s0XSB8fCAnMCcsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICB9LCBwb3NYKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBVbmtub3duIGluc3RydWN0aW9uIFx1MjE5MiBwcmVzZXJ2ZSBpbiB1bm1hcHBlZCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgdW5tYXBwZWQucHVzaCh7XG4gICAgY2xtTm9kZUlkOiBudWxsLFxuICAgIHZlbmRvclNwZWNpZmljRGF0YTogeyBpbnN0ciwgYXJncyB9LFxuICAgIHJlYXNvbjogYFVuc3VwcG9ydGVkIFJvY2t3ZWxsIGluc3RydWN0aW9uOiAke2luc3RyfSgke2FyZ3Muam9pbignLCcpfSlgLFxuICB9KTtcbiAgcmV0dXJuIG51bGw7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBGQkQgKEZ1bmN0aW9uIEJsb2NrIERpYWdyYW0pIHBhcnNlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gcGFyc2VMNVhGQkQocm91dGluZUVsOiB1bmtub3duLCB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10sIHdhcm5pbmdzOiBzdHJpbmdbXSwgcmVzb2x2ZXI6IFZhcmlhYmxlVHlwZVJlc29sdmVyID0gbmV3IFZhcmlhYmxlVHlwZVJlc29sdmVyKCkpOiBGQkRQcm9ncmFtIHwgbnVsbCB7XG4gIGNvbnN0IHNoZWV0cyA9IGNoaWxkQXJyYXkocm91dGluZUVsLCAnU2hlZXQnKSA/PyBjaGlsZEFycmF5KGNoaWxkKHJvdXRpbmVFbCwgJ0ZCRENvbnRlbnQnKSwgJ1NoZWV0Jyk7XG4gIGlmICghc2hlZXRzIHx8IHNoZWV0cy5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuXG4gIGNvbnN0IG5vZGVzOiBGQkROb2RlW10gPSBbXTtcbiAgY29uc3Qgd2lyZXM6IEZCRFdpcmVbXSA9IFtdO1xuXG4gIGZvciAoY29uc3Qgc2hlZXQgb2Ygc2hlZXRzKSB7XG4gICAgLy8gUGFyc2UgQmxvY2sgZWxlbWVudHMgXHUyMDE0IHJlYWwgTDVYIGZvcm1hdDogPEJsb2NrIFR5cGU9XCJUT05cIiBWaXNpYmxlUGlucz1cIklOIFBUIFEgRVRcIiBPcGVyYW5kPVwiVGltZXIxXCIvPlxuICAgIGZvciAoY29uc3QgYmxvY2tFbCBvZiBjaGlsZEFycmF5KHNoZWV0LCAnQmxvY2snKS5jb25jYXQoY2hpbGRBcnJheShzaGVldCwgJ0ZCRF9CbG9jaycpKSkge1xuICAgICAgY29uc3QgaWQgPSBhdHRyKGJsb2NrRWwsICdJRCcpIHx8IHVpZCgnZmJkLWJsb2NrJyk7XG4gICAgICBjb25zdCB0eXBlTmFtZSA9IGF0dHIoYmxvY2tFbCwgJ1R5cGUnKSB8fCAnVU5LTk9XTic7XG4gICAgICBjb25zdCB4ID0gTnVtYmVyKGF0dHIoYmxvY2tFbCwgJ1gnKSkgfHwgMDtcbiAgICAgIGNvbnN0IHkgPSBOdW1iZXIoYXR0cihibG9ja0VsLCAnWScpKSB8fCAwO1xuICAgICAgY29uc3QgaW5zdGFuY2VOYW1lID0gYXR0cihibG9ja0VsLCAnT3BlcmFuZCcpIHx8IGF0dHIoYmxvY2tFbCwgJ05hbWUnKSB8fCAnJztcblxuICAgICAgY29uc3QgYmxvY2tUeXBlID0gbWFwUm9ja3dlbGxGQkRUeXBlKHR5cGVOYW1lKTtcbiAgICAgIGNvbnN0IGlucHV0czogeyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmc7IGRhdGFUeXBlOiBzdHJpbmc7IG5lZ2F0ZWQ/OiBib29sZWFuIH1bXSA9IFtdO1xuICAgICAgY29uc3Qgb3V0cHV0czogeyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmc7IGRhdGFUeXBlOiBzdHJpbmcgfVtdID0gW107XG5cbiAgICAgIC8vIFByaW1hcnkgZm9ybWF0OiBWaXNpYmxlUGlucyBhdHRyaWJ1dGUgaXMgYSBzcGFjZS1zZXBhcmF0ZWQgbGlzdCBvZiB2aXNpYmxlIHBpbiBuYW1lcy5cbiAgICAgIC8vIFVzZSBwaW5TaWduYXR1cmVzIHRvIGNsYXNzaWZ5IGVhY2ggcGluIGFzIGlucHV0IG9yIG91dHB1dC5cbiAgICAgIGNvbnN0IHZpc2libGVQaW5zQXR0ciA9IGF0dHIoYmxvY2tFbCwgJ1Zpc2libGVQaW5zJykgfHwgJyc7XG4gICAgICBpZiAodmlzaWJsZVBpbnNBdHRyKSB7XG4gICAgICAgIGNvbnN0IHBpbk5hbWVzID0gdmlzaWJsZVBpbnNBdHRyLnNwbGl0KC9cXHMrLykuZmlsdGVyKEJvb2xlYW4pO1xuICAgICAgICBmb3IgKGNvbnN0IHBpbk5hbWUgb2YgcGluTmFtZXMpIHtcbiAgICAgICAgICBjb25zdCBhc0lucHV0ICA9IGdldFBpbkRhdGFUeXBlKHR5cGVOYW1lLCBwaW5OYW1lLCAnaW5wdXQnKTtcbiAgICAgICAgICBjb25zdCBhc091dHB1dCA9IGdldFBpbkRhdGFUeXBlKHR5cGVOYW1lLCBwaW5OYW1lLCAnb3V0cHV0Jyk7XG4gICAgICAgICAgLy8gSGV1cmlzdGljOiBpZiBwaW5TaWduYXR1cmVzIGdpdmVzIGEgcmVhbCB0eXBlIGZvciBvdXRwdXQsIHRyZWF0IGFzIG91dHB1dFxuICAgICAgICAgIGNvbnN0IGlzT3V0cHV0ID0gYXNPdXRwdXQgIT09ICdCT09MJyB8fCBwaW5OYW1lID09PSAnT3V0JyB8fCBwaW5OYW1lID09PSAnRGVzdCcgfHxcbiAgICAgICAgICAgIC9eKE91dHxEZXN0fFFbVUROXT98UmVzdWx0fEROfEVOX098RU5PKSQvaS50ZXN0KHBpbk5hbWUpO1xuICAgICAgICAgIGlmIChpc091dHB1dCkge1xuICAgICAgICAgICAgb3V0cHV0cy5wdXNoKHsgaWQ6IHVpZCgncGluJyksIG5hbWU6IHBpbk5hbWUsIGRhdGFUeXBlOiBhc091dHB1dCB9KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaW5wdXRzLnB1c2goeyBpZDogdWlkKCdwaW4nKSwgbmFtZTogcGluTmFtZSwgZGF0YVR5cGU6IGFzSW5wdXQgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEZhbGxiYWNrOiBsZWdhY3kgRkJEX0Jsb2NrUGluIC8gSW5wdXRQaW4gLyBPdXRwdXRQaW4gY2hpbGQgZWxlbWVudHNcbiAgICAgIGlmIChpbnB1dHMubGVuZ3RoID09PSAwICYmIG91dHB1dHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGZvciAoY29uc3QgcGluRWwgb2YgY2hpbGRBcnJheShibG9ja0VsLCAnRkJEX0Jsb2NrUGluJykpIHtcbiAgICAgICAgICBjb25zdCBwaW5OYW1lID0gYXR0cihwaW5FbCwgJ05hbWUnKSB8fCBgcGluJHtpbnB1dHMubGVuZ3RoICsgb3V0cHV0cy5sZW5ndGh9YDtcbiAgICAgICAgICBjb25zdCBwaW5JZCA9IGF0dHIocGluRWwsICdJRCcpIHx8IHVpZCgncGluJyk7XG4gICAgICAgICAgY29uc3QgdXNlID0gYXR0cihwaW5FbCwgJ1VzZScpIHx8ICcnO1xuICAgICAgICAgIGlmICh1c2UgPT09ICdPdXRwdXQnKSB7XG4gICAgICAgICAgICBvdXRwdXRzLnB1c2goeyBpZDogcGluSWQsIG5hbWU6IHBpbk5hbWUsIGRhdGFUeXBlOiBnZXRQaW5EYXRhVHlwZSh0eXBlTmFtZSwgcGluTmFtZSwgJ291dHB1dCcpIH0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpbnB1dHMucHVzaCh7IGlkOiBwaW5JZCwgbmFtZTogcGluTmFtZSwgZGF0YVR5cGU6IGdldFBpbkRhdGFUeXBlKHR5cGVOYW1lLCBwaW5OYW1lLCAnaW5wdXQnKSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBwaW5FbCBvZiBjaGlsZEFycmF5KGJsb2NrRWwsICdJbnB1dFBpbicpKSB7XG4gICAgICAgICAgY29uc3QgcGluTmFtZSA9IGF0dHIocGluRWwsICdOYW1lJykgfHwgYGluJHtpbnB1dHMubGVuZ3RofWA7XG4gICAgICAgICAgY29uc3QgcGluSWQgPSBhdHRyKHBpbkVsLCAnSUQnKSB8fCB1aWQoJ3BpbicpO1xuICAgICAgICAgIGlucHV0cy5wdXNoKHsgaWQ6IHBpbklkLCBuYW1lOiBwaW5OYW1lLCBkYXRhVHlwZTogZ2V0UGluRGF0YVR5cGUodHlwZU5hbWUsIHBpbk5hbWUsICdpbnB1dCcpIH0pO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgcGluRWwgb2YgY2hpbGRBcnJheShibG9ja0VsLCAnT3V0cHV0UGluJykpIHtcbiAgICAgICAgICBjb25zdCBwaW5OYW1lID0gYXR0cihwaW5FbCwgJ05hbWUnKSB8fCBgb3V0JHtvdXRwdXRzLmxlbmd0aH1gO1xuICAgICAgICAgIGNvbnN0IHBpbklkID0gYXR0cihwaW5FbCwgJ0lEJykgfHwgdWlkKCdwaW4nKTtcbiAgICAgICAgICBvdXRwdXRzLnB1c2goeyBpZDogcGluSWQsIG5hbWU6IHBpbk5hbWUsIGRhdGFUeXBlOiBnZXRQaW5EYXRhVHlwZSh0eXBlTmFtZSwgcGluTmFtZSwgJ291dHB1dCcpIH0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIElmIHN0aWxsIG5vIHBpbnMsIGdlbmVyYXRlIGZyb20gY2Fub25pY2FsIHNpZ25hdHVyZVxuICAgICAgaWYgKGlucHV0cy5sZW5ndGggPT09IDAgJiYgb3V0cHV0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY29uc3QgeyBpbnB1dHM6IHNpZ0luLCBvdXRwdXRzOiBzaWdPdXQgfSA9IGJ1aWxkVHlwZWRQaW5zKHR5cGVOYW1lLCBbXSwgaWQpO1xuICAgICAgICBpbnB1dHMucHVzaCguLi5zaWdJbik7XG4gICAgICAgIG91dHB1dHMucHVzaCguLi5zaWdPdXQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGlucHV0cy5sZW5ndGggPT09IDApIGlucHV0cy5wdXNoKHsgaWQ6IHVpZCgncGluJyksIG5hbWU6ICdFTicsIGRhdGFUeXBlOiAnQk9PTCcgfSk7XG4gICAgICAgIGlmIChvdXRwdXRzLmxlbmd0aCA9PT0gMCkgb3V0cHV0cy5wdXNoKHsgaWQ6IHVpZCgncGluJyksIG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0JPT0wnIH0pO1xuICAgICAgfVxuXG4gICAgICBub2Rlcy5wdXNoKHtcbiAgICAgICAgaWQsXG4gICAgICAgIHR5cGU6IGJsb2NrVHlwZSxcbiAgICAgICAgaW5zdGFuY2VOYW1lOiBpbnN0YW5jZU5hbWUgfHwgdW5kZWZpbmVkLFxuICAgICAgICBwb3NpdGlvbjogeyB4LCB5IH0sXG4gICAgICAgIGlucHV0cyxcbiAgICAgICAgb3V0cHV0cyxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEFkZE9uSW5zdHJ1Y3Rpb24gdXNhZ2UgaW4gRkJEIHNoZWV0cyAoTk9UIGRlZmluaXRpb24gXHUyMDE0IHRoaXMgaXMgYSBjYWxsIHNpdGUpXG4gICAgZm9yIChjb25zdCBhb2lFbCBvZiBjaGlsZEFycmF5KHNoZWV0LCAnQWRkT25JbnN0cnVjdGlvbicpKSB7XG4gICAgICBjb25zdCBpZCA9IGF0dHIoYW9pRWwsICdJRCcpIHx8IHVpZCgnYW9pJyk7XG4gICAgICBjb25zdCB0eXBlTmFtZSA9IGF0dHIoYW9pRWwsICdOYW1lJykgfHwgJ0FPSSc7XG4gICAgICBjb25zdCB4ID0gTnVtYmVyKGF0dHIoYW9pRWwsICdYJykpIHx8IDA7XG4gICAgICBjb25zdCB5ID0gTnVtYmVyKGF0dHIoYW9pRWwsICdZJykpIHx8IDA7XG4gICAgICBjb25zdCBpbnN0YW5jZU5hbWUgPSBhdHRyKGFvaUVsLCAnT3BlcmFuZCcpIHx8ICcnO1xuICAgICAgY29uc3QgdmlzaWJsZVBpbnNBdHRyID0gYXR0cihhb2lFbCwgJ1Zpc2libGVQaW5zJykgfHwgJyc7XG4gICAgICBjb25zdCBwaW5OYW1lcyA9IHZpc2libGVQaW5zQXR0ci5zcGxpdCgvXFxzKy8pLmZpbHRlcihCb29sZWFuKTtcbiAgICAgIC8vIEZvciBBT0lzLCB0cmVhdCBhbGwgcGlucyBleGNlcHQgRW5hYmxlSW4vRW5hYmxlT3V0IGFzIGlucHV0cyB1bmxlc3MgdGhleSBtYXRjaCBvdXRwdXQgcGF0dGVybnNcbiAgICAgIGNvbnN0IGFvaUlucHV0czogeyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmc7IGRhdGFUeXBlOiBzdHJpbmcgfVtdID0gW107XG4gICAgICBjb25zdCBhb2lPdXRwdXRzOiB7IGlkOiBzdHJpbmc7IG5hbWU6IHN0cmluZzsgZGF0YVR5cGU6IHN0cmluZyB9W10gPSBbXTtcbiAgICAgIGZvciAoY29uc3QgcGluTmFtZSBvZiBwaW5OYW1lcykge1xuICAgICAgICBjb25zdCBpc091dHB1dCA9IC9eKEVuYWJsZU91dHxFTk98T3V0XFxkKnxEZXN0XFxkKikkL2kudGVzdChwaW5OYW1lKTtcbiAgICAgICAgaWYgKGlzT3V0cHV0KSBhb2lPdXRwdXRzLnB1c2goeyBpZDogdWlkKCdwaW4nKSwgbmFtZTogcGluTmFtZSwgZGF0YVR5cGU6ICdCT09MJyB9KTtcbiAgICAgICAgZWxzZSBhb2lJbnB1dHMucHVzaCh7IGlkOiB1aWQoJ3BpbicpLCBuYW1lOiBwaW5OYW1lLCBkYXRhVHlwZTogJ0JPT0wnIH0pO1xuICAgICAgfVxuICAgICAgLy8gQWxzbyBwYXJzZSBJbk91dFBhcmFtZXRlciBjaGlsZHJlblxuICAgICAgZm9yIChjb25zdCBpb3BFbCBvZiBjaGlsZEFycmF5KGFvaUVsLCAnSW5PdXRQYXJhbWV0ZXInKSkge1xuICAgICAgICBjb25zdCBwTmFtZSA9IGF0dHIoaW9wRWwsICdOYW1lJykgfHwgJyc7XG4gICAgICAgIGFvaUlucHV0cy5wdXNoKHsgaWQ6IHVpZCgncGluJyksIG5hbWU6IHBOYW1lLCBkYXRhVHlwZTogJ0RJTlQnIH0pO1xuICAgICAgfVxuICAgICAgaWYgKGFvaUlucHV0cy5sZW5ndGggPT09IDApIGFvaUlucHV0cy5wdXNoKHsgaWQ6IHVpZCgncGluJyksIG5hbWU6ICdFbmFibGVJbicsIGRhdGFUeXBlOiAnQk9PTCcgfSk7XG4gICAgICBpZiAoYW9pT3V0cHV0cy5sZW5ndGggPT09IDApIGFvaU91dHB1dHMucHVzaCh7IGlkOiB1aWQoJ3BpbicpLCBuYW1lOiAnRW5hYmxlT3V0JywgZGF0YVR5cGU6ICdCT09MJyB9KTtcbiAgICAgIGNvbnN0IGJsb2NrVHlwZSA9IG1hcFJvY2t3ZWxsRkJEVHlwZSh0eXBlTmFtZSk7XG4gICAgICBub2Rlcy5wdXNoKHtcbiAgICAgICAgaWQsIHR5cGU6IGJsb2NrVHlwZSxcbiAgICAgICAgaW5zdGFuY2VOYW1lOiBpbnN0YW5jZU5hbWUgfHwgdW5kZWZpbmVkLFxuICAgICAgICBwb3NpdGlvbjogeyB4LCB5IH0sXG4gICAgICAgIGlucHV0czogYW9pSW5wdXRzLFxuICAgICAgICBvdXRwdXRzOiBhb2lPdXRwdXRzLFxuICAgICAgICB2ZW5kb3JPcmlnaW5hbE5hbWU6IHR5cGVOYW1lLFxuICAgICAgfSBhcyBhbnkpO1xuICAgICAgdW5tYXBwZWQucHVzaCh7XG4gICAgICAgIGNsbU5vZGVJZDogaWQsXG4gICAgICAgIHZlbmRvclNwZWNpZmljRGF0YTogYW9pRWwsXG4gICAgICAgIHJlYXNvbjogYEFPSSBjYWxsIGluIEZCRCBzaGVldDogJHt0eXBlTmFtZX0oJHtpbnN0YW5jZU5hbWV9KWAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBQYXJzZSBJUmVmIChpbnB1dCByZWZlcmVuY2UgXHUyMDE0IHZhcmlhYmxlIG5vZGVzKVxuICAgIGZvciAoY29uc3QgaXJlZkVsIG9mIGNoaWxkQXJyYXkoc2hlZXQsICdJUmVmJykpIHtcbiAgICAgIGNvbnN0IGlkID0gYXR0cihpcmVmRWwsICdJRCcpIHx8IHVpZCgnaXJlZicpO1xuICAgICAgY29uc3Qgb3BlcmFuZCA9IGF0dHIoaXJlZkVsLCAnT3BlcmFuZCcpIHx8ICcnO1xuICAgICAgY29uc3QgeCA9IE51bWJlcihhdHRyKGlyZWZFbCwgJ1gnKSkgfHwgMDtcbiAgICAgIGNvbnN0IHkgPSBOdW1iZXIoYXR0cihpcmVmRWwsICdZJykpIHx8IDA7XG5cbiAgICAgIGNvbnN0IGlyZWZUeXBlID0gcmVzb2x2ZXIucmVzb2x2ZShvcGVyYW5kKTtcbiAgICAgIG5vZGVzLnB1c2goe1xuICAgICAgICBpZCxcbiAgICAgICAgdHlwZTogJ0lOX1ZBUklBQkxFJyxcbiAgICAgICAgcG9zaXRpb246IHsgeCwgeSB9LFxuICAgICAgICBpbnB1dHM6IFtdLFxuICAgICAgICBvdXRwdXRzOiBbeyBpZDogdWlkKCdwaW4nKSwgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiBpcmVmVHlwZSB9XSxcbiAgICAgICAgdGFnOiB7IG5hbWU6IG9wZXJhbmQsIGRhdGFUeXBlOiBpcmVmVHlwZSB9LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gUGFyc2UgT1JlZiAob3V0cHV0IHJlZmVyZW5jZSBcdTIwMTQgdmFyaWFibGUgbm9kZXMpXG4gICAgZm9yIChjb25zdCBvcmVmRWwgb2YgY2hpbGRBcnJheShzaGVldCwgJ09SZWYnKSkge1xuICAgICAgY29uc3QgaWQgPSBhdHRyKG9yZWZFbCwgJ0lEJykgfHwgdWlkKCdvcmVmJyk7XG4gICAgICBjb25zdCBvcGVyYW5kID0gYXR0cihvcmVmRWwsICdPcGVyYW5kJykgfHwgJyc7XG4gICAgICBjb25zdCB4ID0gTnVtYmVyKGF0dHIob3JlZkVsLCAnWCcpKSB8fCAwO1xuICAgICAgY29uc3QgeSA9IE51bWJlcihhdHRyKG9yZWZFbCwgJ1knKSkgfHwgMDtcbiAgICAgIGNvbnN0IG9yZWZUeXBlID0gcmVzb2x2ZXIucmVzb2x2ZShvcGVyYW5kKTtcblxuICAgICAgbm9kZXMucHVzaCh7XG4gICAgICAgIGlkLFxuICAgICAgICB0eXBlOiAnT1VUX1ZBUklBQkxFJyxcbiAgICAgICAgcG9zaXRpb246IHsgeCwgeSB9LFxuICAgICAgICBpbnB1dHM6IFt7IGlkOiB1aWQoJ3BpbicpLCBuYW1lOiAnSU4nLCBkYXRhVHlwZTogb3JlZlR5cGUgfV0sXG4gICAgICAgIG91dHB1dHM6IFtdLFxuICAgICAgICB0YWc6IHsgbmFtZTogb3BlcmFuZCwgZGF0YVR5cGU6IG9yZWZUeXBlIH0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBQYXJzZSBJQ29uIFx1MjAxNCB3aXJlIGlucHV0IGNvbm5lY3RvciAoY3Jvc3Mtc2hlZXQgc2lnbmFsIHNvdXJjZSlcbiAgICBmb3IgKGNvbnN0IGljb25FbCBvZiBjaGlsZEFycmF5KHNoZWV0LCAnSUNvbicpKSB7XG4gICAgICBjb25zdCBpZCA9IGF0dHIoaWNvbkVsLCAnSUQnKSB8fCB1aWQoJ2ljb24nKTtcbiAgICAgIGNvbnN0IG5hbWUgPSBhdHRyKGljb25FbCwgJ05hbWUnKSB8fCAnJztcbiAgICAgIGNvbnN0IHggPSBOdW1iZXIoYXR0cihpY29uRWwsICdYJykpIHx8IDA7XG4gICAgICBjb25zdCB5ID0gTnVtYmVyKGF0dHIoaWNvbkVsLCAnWScpKSB8fCAwO1xuICAgICAgbm9kZXMucHVzaCh7XG4gICAgICAgIGlkLCB0eXBlOiAnSU5fVkFSSUFCTEUnIGFzIEZCREJsb2NrVHlwZSxcbiAgICAgICAgcG9zaXRpb246IHsgeCwgeSB9LFxuICAgICAgICBpbnB1dHM6IFtdLFxuICAgICAgICBvdXRwdXRzOiBbeyBpZDogdWlkKCdwaW4nKSwgbmFtZTogJycsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgICAgIHRhZzogeyBuYW1lLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gUGFyc2UgT0NvbiBcdTIwMTQgd2lyZSBvdXRwdXQgY29ubmVjdG9yIChjcm9zcy1zaGVldCBzaWduYWwgc2luaylcbiAgICBmb3IgKGNvbnN0IG9jb25FbCBvZiBjaGlsZEFycmF5KHNoZWV0LCAnT0NvbicpKSB7XG4gICAgICBjb25zdCBpZCA9IGF0dHIob2NvbkVsLCAnSUQnKSB8fCB1aWQoJ29jb24nKTtcbiAgICAgIGNvbnN0IG5hbWUgPSBhdHRyKG9jb25FbCwgJ05hbWUnKSB8fCAnJztcbiAgICAgIGNvbnN0IHggPSBOdW1iZXIoYXR0cihvY29uRWwsICdYJykpIHx8IDA7XG4gICAgICBjb25zdCB5ID0gTnVtYmVyKGF0dHIob2NvbkVsLCAnWScpKSB8fCAwO1xuICAgICAgbm9kZXMucHVzaCh7XG4gICAgICAgIGlkLCB0eXBlOiAnT1VUX1ZBUklBQkxFJyBhcyBGQkRCbG9ja1R5cGUsXG4gICAgICAgIHBvc2l0aW9uOiB7IHgsIHkgfSxcbiAgICAgICAgaW5wdXRzOiBbeyBpZDogdWlkKCdwaW4nKSwgbmFtZTogJycsIGRhdGFUeXBlOiAnQk9PTCcgfV0sXG4gICAgICAgIG91dHB1dHM6IFtdLFxuICAgICAgICB0YWc6IHsgbmFtZSwgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gUGFyc2UgVGV4dEJveCBlbGVtZW50cyBcdTIwMTQgcHJlc2VydmUgaW4gdW5tYXBwZWQgZm9yIHJvdW5kLXRyaXBcbiAgICBmb3IgKGNvbnN0IHRiRWwgb2YgY2hpbGRBcnJheShzaGVldCwgJ1RleHRCb3gnKSkge1xuICAgICAgdW5tYXBwZWQucHVzaCh7IGNsbU5vZGVJZDogbnVsbCwgdmVuZG9yU3BlY2lmaWNEYXRhOiB0YkVsLCByZWFzb246IGBGQkQgVGV4dEJveGAgfSk7XG4gICAgfVxuXG4gICAgLy8gUGFyc2UgV2lyZSBlbGVtZW50c1xuICAgIGZvciAoY29uc3Qgd2lyZUVsIG9mIGNoaWxkQXJyYXkoc2hlZXQsICdXaXJlJykpIHtcbiAgICAgIGNvbnN0IGZyb21JZCA9IGF0dHIod2lyZUVsLCAnRnJvbUlEJykgfHwgJyc7XG4gICAgICBjb25zdCB0b0lkID0gYXR0cih3aXJlRWwsICdUb0lEJykgfHwgJyc7XG4gICAgICBjb25zdCBmcm9tUGluID0gYXR0cih3aXJlRWwsICdGcm9tUGFyYW0nKSA/PyAnJztcbiAgICAgIGNvbnN0IHRvUGluID0gYXR0cih3aXJlRWwsICdUb1BhcmFtJykgPz8gJyc7XG5cbiAgICAgIGlmIChmcm9tSWQgJiYgdG9JZCkge1xuICAgICAgICB3aXJlcy5wdXNoKHtcbiAgICAgICAgICBpZDogdWlkKCd3aXJlJyksXG4gICAgICAgICAgZnJvbTogeyBub2RlSWQ6IGZyb21JZCwgcGluOiBmcm9tUGluIH0sXG4gICAgICAgICAgdG86IHsgbm9kZUlkOiB0b0lkLCBwaW46IHRvUGluIH0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmIChub2Rlcy5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuICByZXR1cm4geyBub2Rlcywgd2lyZXMgfTtcbn1cblxuZnVuY3Rpb24gbWFwUm9ja3dlbGxGQkRUeXBlKHR5cGVOYW1lOiBzdHJpbmcpOiBGQkRCbG9ja1R5cGUge1xuICBjb25zdCB1cHBlciA9IHR5cGVOYW1lLnRvVXBwZXJDYXNlKCk7XG4gIGNvbnN0IG1hcDogUmVjb3JkPHN0cmluZywgRkJEQmxvY2tUeXBlPiA9IHtcbiAgICAvLyBCb29sZWFuIGdhdGVzIChSb2Nrd2VsbCBCQU5EL0JPUi9CTk9UL0JYT1IgYW5kIElFQyBuYW1lcylcbiAgICBBTkQ6ICdBTkQnLCBPUjogJ09SJywgTk9UOiAnTk9UJywgWE9SOiAnWE9SJyxcbiAgICBCQU5EOiAnQU5EJywgQk9SOiAnT1InLCBCTk9UOiAnTk9UJywgQlhPUjogJ1hPUicsXG4gICAgLy8gQXJpdGhtZXRpY1xuICAgIEFERDogJ0FERCcsIFNVQjogJ1NVQicsIE1VTDogJ01VTCcsIERJVjogJ0RJVicsIE1PRDogJ01PRCcsXG4gICAgQUJTOiAnQUJTJywgU1FSOiAnU1FSVCcsIFNRUlQ6ICdTUVJUJywgTkVHOiAnTkVHJyxcbiAgICBTSU46ICdTSU4nLCBDT1M6ICdDT1MnLCBUQU46ICdUQU4nLCBBVE46ICdBVEFOJywgQVRBTjogJ0FUQU4nLFxuICAgIEFTTjogJ0FTSU4nLCBBQ1M6ICdBQ09TJywgTE46ICdMTicsIExPRzogJ0xPRycsXG4gICAgLy8gVGltZXJzXG4gICAgVE9OOiAnVE9OJywgVE9GOiAnVE9GJywgUlRPOiAnVE9OJywgVFA6ICdUUCcsIFRPTlI6ICdUT05SJyxcbiAgICAvLyBDb3VudGVyc1xuICAgIENUVTogJ0NUVScsIENURDogJ0NURCcsIENUVUQ6ICdDVFVEJyxcbiAgICAvLyBCaXN0YWJsZSAvIGVkZ2VcbiAgICBTUjogJ1NSJywgUlM6ICdSUycsXG4gICAgLy8gQ29tcGFyaXNvbiAoUm9ja3dlbGwgbW5lbW9uaWNzIFx1MjE5MiBJRUMpXG4gICAgRVFVOiAnRVEnLCBORVE6ICdORScsIEdSVDogJ0dUJywgR0VROiAnR0UnLCBMRVM6ICdMVCcsIExFUTogJ0xFJyxcbiAgICBHVDogJ0dUJywgR0U6ICdHRScsIExUOiAnTFQnLCBMRTogJ0xFJywgRVE6ICdFUScsIE5FOiAnTkUnLFxuICAgIExJTTogJ0xJTUlUJywgTUVROiAnRVEnLCBDTVA6ICdFUScsXG4gICAgLy8gRGF0YSAvIHNlbGVjdGlvblxuICAgIE1PVkU6ICdNT1ZFJywgTU9WOiAnTU9WRScsIENPUDogJ01PVkUnLCBDUFM6ICdNT1ZFJywgRkxMOiAnTU9WRScsXG4gICAgU0VMOiAnU0VMJywgTVVYOiAnTVVYJywgTElNSVQ6ICdMSU1JVCcsIE1JTjogJ01JTicsIE1BWDogJ01BWCcsXG4gICAgLy8gU2NhbGluZyAvIGNvbnZlcnNpb25cbiAgICBTQ0w6ICdTQ0FMRScsIFNDUDogJ1NDQUxFJyxcbiAgICBUUlVOQzogJ1RSVU5DJywgUk9VTkQ6ICdST1VORCcsXG4gICAgSU5UX1RPX1JFQUw6ICdJTlRfVE9fUkVBTCcsIFJFQUxfVE9fSU5UOiAnUkVBTF9UT19JTlQnLFxuICAgIERJTlRfVE9fUkVBTDogJ0RJTlRfVE9fUkVBTCcsIFJFQUxfVE9fRElOVDogJ1JFQUxfVE9fRElOVCcsXG4gICAgLy8gQml0d2lzZVxuICAgIEJURDogJ0JURCcsIFNJWkU6ICdTSVpFJyxcbiAgICAvLyBGSUZPIC8gTElGTyAvIFNlcXVlbmNlclxuICAgIEZGTDogJ0ZGTCcsIEZGVTogJ0ZGVScsIExGTDogJ0xGTCcsIExGVTogJ0xGVScsXG4gICAgU1FPOiAnU1FPJywgU1FJOiAnU1FJJywgU1FMOiAnU1FMJyxcbiAgICAvLyBQSURcbiAgICBQSUQ6ICdQSUQnLCBQSURFOiAnUElEJywgUElEQVQ6ICdQSUQnLFxuICAgIC8vIFN0cmluZyBmdW5jdGlvbnNcbiAgICBMRU46ICdMRU4nLCBMRUZUOiAnTEVGVCcsIFJJR0hUOiAnUklHSFQnLCBNSUQ6ICdNSUQnLFxuICAgIENPTkNBVDogJ0NPTkNBVCcsIEZJTkQ6ICdGSU5EJywgSU5TRVJUOiAnSU5TRVJUJywgREVMRVRFOiAnREVMRVRFJyxcbiAgICBVUFBFUjogJ1VQUEVSX0NBU0UnLCBMT1dFUjogJ0xPV0VSX0NBU0UnLFxuICAgIC8vIE1TRyAvIEdTViAvIFNTViAvIE1vdGlvbiBcdTIwMTQgY2FudmFzIHBsYWNlaG9sZGVyXG4gICAgTVNHOiAnTU9WRScsIEdTVjogJ01PVkUnLCBTU1Y6ICdNT1ZFJyxcbiAgICBNQUo6ICdNT1ZFJywgTUFNOiAnTU9WRScsIE1BUzogJ01PVkUnLFxuICB9O1xuICByZXR1cm4gbWFwW3VwcGVyXSB8fCAnTU9WRSc7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBFeHBvcnQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBmdW5jdGlvbiBleHBvcnRSb2Nrd2VsbChwcm9qZWN0OiBOb3JtYWxpemVkUHJvamVjdCk6IEV4cG9ydFJlc3VsdCB7XG4gIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHNpZGVjYXIgPSBwcm9qZWN0LnNpZGVjYXI7XG5cbiAgY29uc3QgY29udHJvbGxlclRhZ3MgPSBwcm9qZWN0Lmdsb2JhbFRhZ3MubWFwKHRhZyA9PiB0YWdUb0w1WFRhZyh0YWcpKTtcbiAgY29uc3QgcHJvZ3JhbXMgPSBwcm9qZWN0LnBvdXMubWFwKHBvdSA9PiBwb3VUb0w1WFByb2dyYW0ocG91LCB3YXJuaW5ncykpO1xuXG4gIC8vIFJlc3RvcmUgcHJlc2VydmVkIFVEVC9BT0kgZGF0YSBmcm9tIHNpZGVjYXJcbiAgY29uc3QgcHJlc2VydmVkRGF0YVR5cGVzID0gc2lkZWNhci51bm1hcHBlZEVsZW1lbnRzXG4gICAgLmZpbHRlcih1ID0+IHUucmVhc29uLnN0YXJ0c1dpdGgoJ1VzZXItRGVmaW5lZCBUeXBlJykpXG4gICAgLm1hcCh1ID0+IHUudmVuZG9yU3BlY2lmaWNEYXRhKTtcblxuICBjb25zdCBwcmVzZXJ2ZWRBT0lzID0gc2lkZWNhci51bm1hcHBlZEVsZW1lbnRzXG4gICAgLmZpbHRlcih1ID0+IHUucmVhc29uLnN0YXJ0c1dpdGgoJ0FPSTonKSlcbiAgICAubWFwKHUgPT4gdS52ZW5kb3JTcGVjaWZpY0RhdGEpO1xuXG4gIGNvbnN0IHByZXNlcnZlZE1vZHVsZXMgPSBzaWRlY2FyLnVubWFwcGVkRWxlbWVudHMuZmluZCh1ID0+IHUucmVhc29uID09PSAnTW9kdWxlcyBlbGVtZW50Jyk/LnZlbmRvclNwZWNpZmljRGF0YTtcbiAgY29uc3QgcHJlc2VydmVkVGFza3MgPSBzaWRlY2FyLnVubWFwcGVkRWxlbWVudHMuZmluZCh1ID0+IHUucmVhc29uID09PSAnVGFza3MgZWxlbWVudCcpPy52ZW5kb3JTcGVjaWZpY0RhdGE7XG5cbiAgLy8gQnVpbGQgQ29udHJvbGxlciBjaGlsZHJlbiBpbiBYU0QtbWFuZGF0ZWQgb3JkZXI6XG4gIC8vIERhdGFUeXBlcyBcdTIxOTIgTW9kdWxlcyBcdTIxOTIgQWRkT25JbnN0cnVjdGlvbkRlZmluaXRpb25zIFx1MjE5MiBUYWdzIFx1MjE5MiBQcm9ncmFtcyBcdTIxOTIgVGFza3MgXHUyMTkyIENTVCBcdTIxOTIgV2FsbENsb2NrVGltZSBcdTIxOTIgVHJlbmRzIFx1MjE5MiBEYXRhTG9ncyBcdTIxOTIgVGltZVN5bmNocm9uaXplXG4gIGNvbnN0IGNvbnRyb2xsZXJPYmo6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xuICAgICdAX05hbWUnOiBzaWRlY2FyLnZlbmRvclNwZWNpZmljR2xvYmFscz8uWydjb250cm9sbGVyTmFtZSddID8/IHByb2plY3QucHJvamVjdE5hbWUsXG4gICAgJ0BfUHJvY2Vzc29yVHlwZSc6IHNpZGVjYXIudmVuZG9yU3BlY2lmaWNHbG9iYWxzPy5bJ3Byb2Nlc3NvclR5cGUnXSA/PyAnMTc2OS1MMzNFUicsXG4gICAgJ0BfTWFqb3JSZXYnOiAnMzInLFxuICAgICdAX01pbm9yUmV2JzogJzAnLFxuICB9O1xuXG4gIC8vIDEuIERhdGFUeXBlc1xuICBpZiAocHJlc2VydmVkRGF0YVR5cGVzLmxlbmd0aCkge1xuICAgIGNvbnRyb2xsZXJPYmpbJ0RhdGFUeXBlcyddID0geyBEYXRhVHlwZTogcHJlc2VydmVkRGF0YVR5cGVzIH07XG4gIH1cblxuICAvLyAyLiBNb2R1bGVzIChyZXN0b3JlZCBmcm9tIHNpZGVjYXIgaWYgYXZhaWxhYmxlKVxuICBpZiAocHJlc2VydmVkTW9kdWxlcykge1xuICAgIGNvbnRyb2xsZXJPYmpbJ01vZHVsZXMnXSA9IHByZXNlcnZlZE1vZHVsZXM7XG4gIH1cblxuICAvLyAzLiBBZGRPbkluc3RydWN0aW9uRGVmaW5pdGlvbnNcbiAgaWYgKHByZXNlcnZlZEFPSXMubGVuZ3RoKSB7XG4gICAgY29udHJvbGxlck9ialsnQWRkT25JbnN0cnVjdGlvbkRlZmluaXRpb25zJ10gPSB7IEFkZE9uSW5zdHJ1Y3Rpb25EZWZpbml0aW9uOiBwcmVzZXJ2ZWRBT0lzIH07XG4gIH1cblxuICAvLyA0LiBUYWdzXG4gIGNvbnRyb2xsZXJPYmpbJ1RhZ3MnXSA9IHsgVGFnOiBjb250cm9sbGVyVGFncyB9O1xuXG4gIC8vIDUuIFByb2dyYW1zXG4gIGNvbnRyb2xsZXJPYmpbJ1Byb2dyYW1zJ10gPSB7IFByb2dyYW06IHByb2dyYW1zIH07XG5cbiAgLy8gNi4gVGFza3MgKHVzZSBwcmVzZXJ2ZWQgaWYgYXZhaWxhYmxlKVxuICBpZiAocHJlc2VydmVkVGFza3MpIHtcbiAgICBjb250cm9sbGVyT2JqWydUYXNrcyddID0gcHJlc2VydmVkVGFza3M7XG4gIH0gZWxzZSB7XG4gICAgY29udHJvbGxlck9ialsnVGFza3MnXSA9IHtcbiAgICAgIFRhc2s6IFt7XG4gICAgICAgICdAX05hbWUnOiBzaWRlY2FyLnZlbmRvclNwZWNpZmljR2xvYmFscz8uWydtYWluVGFza05hbWUnXSA/PyAnTWFpblRhc2snLFxuICAgICAgICAnQF9UeXBlJzogc2lkZWNhci52ZW5kb3JTcGVjaWZpY0dsb2JhbHM/LlsnbWFpblRhc2tUeXBlJ10gPz8gJ0NvbnRpbnVvdXMnLFxuICAgICAgICAnQF9Qcmlvcml0eSc6ICcxMCcsXG4gICAgICAgICdAX1dhdGNoZG9nJzogJzUwMCcsXG4gICAgICAgICdAX0Rpc2FibGVVcGRhdGVPdXRwdXRzJzogJ2ZhbHNlJyxcbiAgICAgICAgJ0BfSW5oaWJpdFRhc2snOiAnZmFsc2UnLFxuICAgICAgICBTY2hlZHVsZWRQcm9ncmFtczoge1xuICAgICAgICAgIFNjaGVkdWxlZFByb2dyYW06IHByb2plY3QucG91cy5tYXAocCA9PiAoe1xuICAgICAgICAgICAgJ0BfTmFtZSc6IHAubmFtZS5pbmNsdWRlcygnXycpID8gcC5uYW1lLnNwbGl0KCdfJylbMF0gOiBwLm5hbWVcbiAgICAgICAgICB9KSlcbiAgICAgICAgfVxuICAgICAgfV1cbiAgICB9O1xuICB9XG5cbiAgLy8gNy0xMS4gQ1NULCBXYWxsQ2xvY2tUaW1lLCBUcmVuZHMsIERhdGFMb2dzLCBUaW1lU3luY2hyb25pemVcbiAgY29udHJvbGxlck9ialsnQ1NUJ10gPSB7ICdAX01hc3RlcklEJzogJzAnIH07XG4gIGNvbnRyb2xsZXJPYmpbJ1dhbGxDbG9ja1RpbWUnXSA9IHsgJ0BfTG9jYWxUaW1lQWRqdXN0bWVudCc6ICcwJywgJ0BfVGltZVpvbmUnOiAnMCcgfTtcbiAgY29udHJvbGxlck9ialsnVHJlbmRzJ10gPSB7fTtcbiAgY29udHJvbGxlck9ialsnRGF0YUxvZ3MnXSA9IHt9O1xuICBjb250cm9sbGVyT2JqWydUaW1lU3luY2hyb25pemUnXSA9IHsgJ0BfUHJpb3JpdHkxJzogJzEyOCcsICdAX1ByaW9yaXR5Mic6ICcxMjgnLCAnQF9QVFBFbmFibGUnOiAnZmFsc2UnIH07XG5cbiAgY29uc3Qgb2JqID0ge1xuICAgIFJTTG9naXg1MDAwQ29udGVudDoge1xuICAgICAgJ0BfU2NoZW1hUmV2aXNpb24nOiBzaWRlY2FyLnZlbmRvclNwZWNpZmljR2xvYmFscz8uWydzY2hlbWFSZXZpc2lvbiddID8/ICcxLjAnLFxuICAgICAgJ0BfU29mdHdhcmVSZXZpc2lvbic6ICczMi4wJyxcbiAgICAgICdAX1RhcmdldE5hbWUnOiBwcm9qZWN0LnByb2plY3ROYW1lLFxuICAgICAgJ0BfVGFyZ2V0VHlwZSc6ICdDb250cm9sbGVyJyxcbiAgICAgICdAX0NvbnRhaW5zQ29udGV4dCc6ICd0cnVlJyxcbiAgICAgIENvbnRyb2xsZXI6IGNvbnRyb2xsZXJPYmosXG4gICAgfSxcbiAgfTtcblxuICByZXR1cm4geyBvazogdHJ1ZSwgeG1sQ29udGVudDogYnVpbGRYTUwob2JqKSwgZXJyb3JzLCB3YXJuaW5ncyB9O1xufVxuXG5mdW5jdGlvbiB0YWdUb0w1WFRhZyh0YWc6IE5vcm1hbGl6ZWRUYWcpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgJ0BfTmFtZSc6IHRhZy5uYW1lLFxuICAgICdAX1RhZ1R5cGUnOiAnQmFzZScsXG4gICAgJ0BfRGF0YVR5cGUnOiBpZWNUeXBlVG9Sb2Nrd2VsbCh0YWcuZGF0YVR5cGUpLFxuICAgICdAX1JhZGl4JzogJ0RlY2ltYWwnLFxuICAgICdAX0V4dGVybmFsQWNjZXNzJzogJ1JlYWQvV3JpdGUnLFxuICAgIERlc2NyaXB0aW9uOiB0YWcuZGVzY3JpcHRpb24gPyB7ICcjY2RhdGEnOiB0YWcuZGVzY3JpcHRpb24gfSA6IHVuZGVmaW5lZCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gcG91VG9MNVhQcm9ncmFtKHBvdTogTm9ybWFsaXplZFBPVSwgd2FybmluZ3M6IHN0cmluZ1tdKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICBjb25zdCBsb2NhbFRhZ3MgPSBwb3UubG9jYWxUYWdzLm1hcCh0YWdUb0w1WFRhZyk7XG4gIGxldCByb3V0aW5lOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcblxuICBpZiAocG91Lmxhbmd1YWdlID09PSAnTEQnICYmIHBvdS5sYWRkZXJQcm9ncmFtKSB7XG4gICAgcm91dGluZSA9IHtcbiAgICAgICdAX05hbWUnOiAnTWFpblJvdXRpbmUnLFxuICAgICAgJ0BfVHlwZSc6ICdSTEwnLFxuICAgICAgUkxMQ29udGVudDoge1xuICAgICAgICBSdW5nOiBwb3UubGFkZGVyUHJvZ3JhbS5ydW5ncy5tYXAocnVuZyA9PiAoe1xuICAgICAgICAgICdAX051bWJlcic6IFN0cmluZyhydW5nLm51bWJlciksXG4gICAgICAgICAgJ0BfVHlwZSc6IHJ1bmcudmVuZG9yVHlwZSB8fCAnTicsXG4gICAgICAgICAgQ29tbWVudDogcnVuZy5jb21tZW50ID8geyAnI2NkYXRhJzogcnVuZy5jb21tZW50IH0gOiB1bmRlZmluZWQsXG4gICAgICAgICAgVGV4dDogeyAnI2NkYXRhJzogYnVpbGRSdW5nVGV4dChydW5nKSB9LFxuICAgICAgICB9KSksXG4gICAgICB9LFxuICAgIH07XG4gIH0gZWxzZSBpZiAocG91Lmxhbmd1YWdlID09PSAnRkJEJyAmJiBwb3UuZmJkUHJvZ3JhbSkge1xuICAgIHJvdXRpbmUgPSBidWlsZFJvY2t3ZWxsRkJEUm91dGluZShwb3UuZmJkUHJvZ3JhbSk7XG4gIH0gZWxzZSBpZiAocG91Lmxhbmd1YWdlID09PSAnU1QnICYmIHBvdS5zdFNvdXJjZSkge1xuICAgIC8vIEV4cG9ydCBTVCBhcyBsaW5lLWJ5LWxpbmUgPExpbmUgTnVtYmVyPVwiTlwiPjwhW0NEQVRBWy4uLl1dPjwvTGluZT4gcGVyIEw1WCBzcGVjXG4gICAgY29uc3Qgc3RMaW5lcyA9IHBvdS5zdFNvdXJjZS5zcGxpdCgnXFxuJyk7XG4gICAgcm91dGluZSA9IHtcbiAgICAgICdAX05hbWUnOiAnTWFpblJvdXRpbmUnLFxuICAgICAgJ0BfVHlwZSc6ICdTVCcsXG4gICAgICBTVENvbnRlbnQ6IHtcbiAgICAgICAgTGluZTogc3RMaW5lcy5tYXAoKGxpbmUsIGlkeCkgPT4gKHtcbiAgICAgICAgICAnQF9OdW1iZXInOiBTdHJpbmcoaWR4KSxcbiAgICAgICAgICAnI2NkYXRhJzogbGluZSxcbiAgICAgICAgfSkpLFxuICAgICAgfSxcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIHdhcm5pbmdzLnB1c2goYFBPVSBcIiR7cG91Lm5hbWV9XCI6IGxhbmd1YWdlICR7cG91Lmxhbmd1YWdlfSBcdTIwMTQgZXhwb3J0aW5nIGFzIGVtcHR5IFJMTCByb3V0aW5lYCk7XG4gICAgcm91dGluZSA9IHtcbiAgICAgICdAX05hbWUnOiAnTWFpblJvdXRpbmUnLFxuICAgICAgJ0BfVHlwZSc6ICdSTEwnLFxuICAgICAgUkxMQ29udGVudDogeyBSdW5nOiBbeyAnQF9OdW1iZXInOiAnMCcsICdAX1R5cGUnOiAnTicsIFRleHQ6IHsgJyNjZGF0YSc6ICdOT1AoKTsnIH0gfV0gfSxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICAnQF9OYW1lJzogcG91Lm5hbWUsXG4gICAgJ0BfVHlwZSc6ICdOb3JtYWwnLFxuICAgICdAX01haW5Sb3V0aW5lTmFtZSc6ICdNYWluUm91dGluZScsXG4gICAgVGFnczogeyBUYWc6IGxvY2FsVGFncyB9LFxuICAgIFJvdXRpbmVzOiB7IFJvdXRpbmU6IHJvdXRpbmUgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gYnVpbGRSdW5nVGV4dChydW5nOiBSdW5nKTogc3RyaW5nIHtcbiAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gW107XG5cbiAgLy8gRW1pdCBtYWluIGVsZW1lbnRzXG4gIGZvciAoY29uc3QgZWwgb2YgcnVuZy5lbGVtZW50cykge1xuICAgIHBhcnRzLnB1c2goZWxlbWVudFRvUnVuZ1RleHQoZWwpKTtcbiAgfVxuXG4gIC8vIEVtaXQgYnJhbmNoZXMgYXMgWyBsZWcxICxsZWcyIF0gYnJhY2tldCBzeW50YXggKEw1WCBuZXV0cmFsIHRleHQgZm9ybWF0KVxuICBpZiAocnVuZy5icmFuY2hlcy5sZW5ndGggPiAwKSB7XG4gICAgLy8gQ29sbGVjdCB0aGUgbWFpbi1wYXRoIGVsZW1lbnRzIHRoYXQgYXJlIGNvbnRhY3RzIChiZWZvcmUgY29pbHMpIGFzIGZpcnN0IGxlZ1xuICAgIGNvbnN0IGNvaWxJbnN0cnMgPSBuZXcgU2V0KFsnT1RFJywgJ09UTCcsICdPVFUnLCAnT1ROJywgJ1JFUyddKTtcbiAgICBjb25zdCBmaXJzdENvaWxJZHggPSBwYXJ0cy5maW5kSW5kZXgocCA9PiBjb2lsSW5zdHJzLmhhcyhwLnNwbGl0KCcoJylbMF0pKTtcbiAgICBjb25zdCBpbnNlcnRBdCA9IGZpcnN0Q29pbElkeCA+PSAwID8gZmlyc3RDb2lsSWR4IDogcGFydHMubGVuZ3RoO1xuXG4gICAgLy8gQnVpbGQgbGVnczogZmlyc3QgbGVnIGlzIGVtcHR5IChtYWluIHBhdGggY29udGludWVzKSwgcmVtYWluaW5nIGxlZ3MgYXJlIGJyYW5jaGVzXG4gICAgY29uc3QgbGVnU3RyaW5nczogc3RyaW5nW10gPSBbXTtcbiAgICAvLyBGaXJzdCBsZWc6IGVsZW1lbnRzIGFscmVhZHkgb24gbWFpbiBwYXRoIGJlZm9yZSB0aGUgY29pbCAobm9uZSB0byBhZGQgXHUyMDE0IHRoZXkncmUgYWxyZWFkeSBpbiBwYXJ0cylcbiAgICAvLyBGb3IgYnJhY2tldCBmb3JtYXQsIGVhY2ggYnJhbmNoIGJlY29tZXMgYSBsZWdcbiAgICBmb3IgKGNvbnN0IGJyYW5jaCBvZiBydW5nLmJyYW5jaGVzKSB7XG4gICAgICBjb25zdCBsZWdQYXJ0czogc3RyaW5nW10gPSBbXTtcbiAgICAgIGZvciAoY29uc3QgZWwgb2YgYnJhbmNoLmVsZW1lbnRzKSB7XG4gICAgICAgIGxlZ1BhcnRzLnB1c2goZWxlbWVudFRvUnVuZ1RleHQoZWwpKTtcbiAgICAgIH1cbiAgICAgIGxlZ1N0cmluZ3MucHVzaChsZWdQYXJ0cy5qb2luKCcnKSk7XG4gICAgfVxuXG4gICAgLy8gQnVpbGQgYnJhY2tldCBibG9jazogW2ZpcnN0TGVnICxsZWcyICxsZWczIC4uLl1cbiAgICAvLyBUaGUgXCJmaXJzdCBsZWdcIiBpcyB0aGUgbWFpbiBwYXRoIHNlZ21lbnQgdGhhdCB3YXMgYWxyZWFkeSBlbWl0dGVkIFx1MjAxNFxuICAgIC8vIGV4dHJhY3QgaXQgZnJvbSBwYXJ0c1swLi5pbnNlcnRBdC0xXSBhbmQgcGxhY2UgaXQgYXMgZmlyc3QgbGVnXG4gICAgY29uc3QgbWFpbkxlZyA9IHBhcnRzLnNwbGljZSgwLCBpbnNlcnRBdCkuam9pbignJyk7XG4gICAgY29uc3QgYWxsTGVncyA9IFttYWluTGVnLCAuLi5sZWdTdHJpbmdzXTtcbiAgICBjb25zdCBicmFja2V0QmxvY2sgPSAnWycgKyBhbGxMZWdzWzBdICsgYWxsTGVncy5zbGljZSgxKS5tYXAobCA9PiAnICwnICsgbCkuam9pbignJykgKyAnIF0nO1xuICAgIHBhcnRzLnVuc2hpZnQoYnJhY2tldEJsb2NrKTtcbiAgfVxuXG4gIHJldHVybiBwYXJ0cy5qb2luKCcnKSArICc7Jztcbn1cblxuZnVuY3Rpb24gZWxlbWVudFRvUnVuZ1RleHQoZWw6IExhZGRlckVsZW1lbnQpOiBzdHJpbmcge1xuICBpZiAoZWwua2luZCA9PT0gJ2NvbnRhY3QnKSB7XG4gICAgY29uc3QgYyA9IGVsIGFzIENvbnRhY3RFbGVtZW50O1xuICAgIGNvbnN0IGluc3RyTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0geyBOTzogJ1hJQycsIE5DOiAnWElPJywgUF9DT05UQUNUOiAnT1NSJywgTl9DT05UQUNUOiAnT1NGJyB9O1xuICAgIGNvbnN0IGluc3RyTmFtZSA9IGluc3RyTWFwW2MudHlwZV0gfHwgJ1hJQyc7XG4gICAgLy8gT1NSL09TRiB3aXRoIHZlbmRvckFyZ3M6IGVtaXQgYm90aCBhcmdzIGZvciBsb3NzbGVzcyByb3VuZC10cmlwXG4gICAgY29uc3QgdmVuZG9yQXJncyA9IChlbCBhcyBhbnkpLnZlbmRvckFyZ3MgYXMgc3RyaW5nW10gfCB1bmRlZmluZWQ7XG4gICAgaWYgKHZlbmRvckFyZ3MgJiYgdmVuZG9yQXJncy5sZW5ndGggPiAxKSB7XG4gICAgICByZXR1cm4gYCR7aW5zdHJOYW1lfSgke3ZlbmRvckFyZ3Muam9pbignLCcpfSlgO1xuICAgIH1cbiAgICByZXR1cm4gYCR7aW5zdHJOYW1lfSgke2MudGFnLm5hbWV9KWA7XG4gIH0gZWxzZSBpZiAoZWwua2luZCA9PT0gJ2NvaWwnKSB7XG4gICAgY29uc3QgYyA9IGVsIGFzIENvaWxFbGVtZW50O1xuICAgIGNvbnN0IGluc3RyTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0geyBub3JtYWw6ICdPVEUnLCBuZWdhdGVkOiAnT1ROJywgc2V0OiAnT1RMJywgcmVzZXQ6ICdSRVMnLCBsYXRjaDogJ09UTCcsIHVubGF0Y2g6ICdPVFUnIH07XG4gICAgcmV0dXJuIGAke2luc3RyTWFwW2MudHlwZV0gfHwgJ09URSd9KCR7Yy50YWcubmFtZX0pYDtcbiAgfSBlbHNlIGlmIChlbC5raW5kID09PSAnYmxvY2snKSB7XG4gICAgY29uc3QgYiA9IGVsIGFzIEJsb2NrRWxlbWVudDtcbiAgICAvLyBVc2UgdmVuZG9yT3JpZ2luYWxOYW1lIGZvciBsb3NzbGVzcyByb3VuZC10cmlwIHdoZW4gYXZhaWxhYmxlXG4gICAgaWYgKGIudmVuZG9yT3JpZ2luYWxOYW1lKSB7XG4gICAgICBpZiAoYi5waW5zICYmIE9iamVjdC5rZXlzKGIucGlucykubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBwaW5WYWxzID0gT2JqZWN0LnZhbHVlcyhiLnBpbnMpLm1hcCgocDogYW55KSA9PiBwLm5hbWUgfHwgJycpO1xuICAgICAgICByZXR1cm4gYCR7Yi52ZW5kb3JPcmlnaW5hbE5hbWV9KCR7cGluVmFscy5qb2luKCcsJyl9KWA7XG4gICAgICB9XG4gICAgICByZXR1cm4gYCR7Yi52ZW5kb3JPcmlnaW5hbE5hbWV9KCR7Yi5pbnN0YW5jZU5hbWV9KWA7XG4gICAgfVxuICAgIGNvbnN0IGluc3RyTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgLy8gVGltZXJzXG4gICAgICBUT046ICdUT04nLCBUT0Y6ICdUT0YnLCBUUDogJ1RPTicsIFRPTlI6ICdUT05SJywgUlRPOiAnUlRPJyxcbiAgICAgIC8vIENvdW50ZXJzXG4gICAgICBDVFU6ICdDVFUnLCBDVEQ6ICdDVEQnLCBDVFVEOiAnQ1RVRCcsXG4gICAgICAvLyBCaXN0YWJsZSAvIGVkZ2VcbiAgICAgIFNSOiAnT1RMJywgUlM6ICdPVFUnLCBSVFJJRzogJ09TUicsIEZUUklHOiAnT1NGJyxcbiAgICAgIC8vIE1hdGhcbiAgICAgIEFERDogJ0FERCcsIFNVQjogJ1NVQicsIE1VTDogJ01VTCcsIERJVjogJ0RJVicsIE1PRDogJ01PRCcsXG4gICAgICBBQlM6ICdBQlMnLCBTUVJUOiAnU1FSJywgTkVHOiAnTkVHJyxcbiAgICAgIFNJTjogJ1NJTicsIENPUzogJ0NPUycsIFRBTjogJ1RBTicsIEFUQU46ICdBVE4nLCBBU0lOOiAnQVNOJywgQUNPUzogJ0FDUycsXG4gICAgICBMTjogJ0xOJywgTE9HOiAnTE9HJyxcbiAgICAgIC8vIENvbXBhcmlzb25cbiAgICAgIEVROiAnRVFVJywgTkU6ICdORVEnLCBHVDogJ0dSVCcsIEdFOiAnR0VRJywgTFQ6ICdMRVMnLCBMRTogJ0xFUScsXG4gICAgICBMSU1JVDogJ0xJTScsXG4gICAgICAvLyBEYXRhIC8gc2VsZWN0aW9uXG4gICAgICBNT1ZFOiAnTU9WJywgU0VMOiAnU0VMJywgTVVYOiAnTVVYJywgTUlOOiAnTUlOJywgTUFYOiAnTUFYJyxcbiAgICAgIC8vIFNjYWxpbmdcbiAgICAgIFNDQUxFOiAnU0NMJyxcbiAgICAgIC8vIEJpdHdpc2VcbiAgICAgIEFORDogJ0FORCcsIE9SOiAnT1InLCBOT1Q6ICdOT1QnLCBYT1I6ICdYT1InLCBCVEQ6ICdCVEQnLCBTSVpFOiAnU0laRScsXG4gICAgICAvLyBGSUZPIC8gU2VxdWVuY2VyXG4gICAgICBGRkw6ICdGRkwnLCBGRlU6ICdGRlUnLCBMRkw6ICdMRkwnLCBMRlU6ICdMRlUnLFxuICAgICAgU1FPOiAnU1FPJywgU1FJOiAnU1FJJywgU1FMOiAnU1FMJyxcbiAgICAgIC8vIFBJRFxuICAgICAgUElEOiAnUElEJyxcbiAgICAgIC8vIFN0cmluZ1xuICAgICAgTEVOOiAnTEVOJywgTEVGVDogJ0xFRlQnLCBSSUdIVDogJ1JJR0hUJywgTUlEOiAnTUlEJyxcbiAgICAgIENPTkNBVDogJ0NPTkNBVCcsIEZJTkQ6ICdGSU5EJywgSU5TRVJUOiAnSU5TRVJUJywgREVMRVRFOiAnREVMRVRFJyxcbiAgICAgIFVQUEVSX0NBU0U6ICdVUFBFUicsIExPV0VSX0NBU0U6ICdMT1dFUicsXG4gICAgfTtcbiAgICBjb25zdCBpbnN0ciA9IGluc3RyTWFwW2IuZmJUeXBlXSB8fCBiLmZiVHlwZTtcbiAgICBpZiAoYi5waW5zICYmIE9iamVjdC5rZXlzKGIucGlucykubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgcGluVmFscyA9IE9iamVjdC52YWx1ZXMoYi5waW5zKS5tYXAoKHA6IGFueSkgPT4gcC5uYW1lIHx8ICcnKTtcbiAgICAgIHJldHVybiBgJHtpbnN0cn0oJHtwaW5WYWxzLmpvaW4oJywnKX0pYDtcbiAgICB9XG4gICAgcmV0dXJuIGAke2luc3RyfSgke2IuaW5zdGFuY2VOYW1lfSlgO1xuICB9XG4gIHJldHVybiAnJztcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEZCRCBFeHBvcnQgKFNoZWV0L0ZCRF9CbG9jay9JUmVmL09SZWYvV2lyZSkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGJ1aWxkUm9ja3dlbGxGQkRSb3V0aW5lKGZiZDogRkJEUHJvZ3JhbSk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgY29uc3QgZmJkQmxvY2tzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdID0gW107XG4gIGNvbnN0IGlyZWZzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdID0gW107XG4gIGNvbnN0IG9yZWZzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdID0gW107XG4gIGNvbnN0IHdpcmVzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdID0gW107XG5cbiAgY29uc3QgaWVjVG9Sb2Nrd2VsbEJsb2NrOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgIC8vIEJvb2xlYW4gZ2F0ZXNcbiAgICBBTkQ6ICdCQU5EJywgT1I6ICdCT1InLCBOT1Q6ICdCTk9UJywgWE9SOiAnQlhPUicsXG4gICAgLy8gQXJpdGhtZXRpY1xuICAgIEFERDogJ0FERCcsIFNVQjogJ1NVQicsIE1VTDogJ01VTCcsIERJVjogJ0RJVicsIE1PRDogJ01PRCcsXG4gICAgQUJTOiAnQUJTJywgU1FSVDogJ1NRUicsIE5FRzogJ05FRycsXG4gICAgU0lOOiAnU0lOJywgQ09TOiAnQ09TJywgVEFOOiAnVEFOJywgQVRBTjogJ0FUTicsIEFTSU46ICdBU04nLCBBQ09TOiAnQUNTJyxcbiAgICBMTjogJ0xOJywgTE9HOiAnTE9HJyxcbiAgICAvLyBUaW1lcnMgLyBjb3VudGVyc1xuICAgIFRPTjogJ1RPTicsIFRPRjogJ1RPRicsIFRQOiAnVFAnLCBUT05SOiAnVE9OUicsXG4gICAgQ1RVOiAnQ1RVJywgQ1REOiAnQ1REJywgQ1RVRDogJ0NUVUQnLFxuICAgIC8vIEJpc3RhYmxlIC8gZWRnZVxuICAgIFNSOiAnU1InLCBSUzogJ1JTJywgUlRSSUc6ICdPU1InLCBGVFJJRzogJ09TRicsXG4gICAgLy8gQ29tcGFyaXNvblxuICAgIEdUOiAnR1JUJywgR0U6ICdHRVEnLCBMVDogJ0xFUycsIExFOiAnTEVRJywgRVE6ICdFUVUnLCBORTogJ05FUScsXG4gICAgTElNSVQ6ICdMSU0nLFxuICAgIC8vIERhdGEgLyBzZWxlY3Rpb25cbiAgICBNT1ZFOiAnTU9WJywgU0VMOiAnU0VMJywgTVVYOiAnTVVYJywgTUlOOiAnTUlOJywgTUFYOiAnTUFYJyxcbiAgICAvLyBTY2FsaW5nXG4gICAgU0NBTEU6ICdTQ0wnLCBVTlNDQUxFOiAnU0NQJyxcbiAgICAvLyBDb252ZXJzaW9uXG4gICAgVFJVTkM6ICdUUlVOQycsIFJPVU5EOiAnUk9VTkQnLFxuICAgIElOVF9UT19SRUFMOiAnSU5UX1RPX1JFQUwnLCBSRUFMX1RPX0lOVDogJ1JFQUxfVE9fSU5UJyxcbiAgICBESU5UX1RPX1JFQUw6ICdESU5UX1RPX1JFQUwnLCBSRUFMX1RPX0RJTlQ6ICdSRUFMX1RPX0RJTlQnLFxuICAgIC8vIEJpdHdpc2VcbiAgICBCVEQ6ICdCVEQnLCBTSVpFOiAnU0laRScsXG4gICAgLy8gRklGTyAvIFNlcXVlbmNlclxuICAgIEZGTDogJ0ZGTCcsIEZGVTogJ0ZGVScsIExGTDogJ0xGTCcsIExGVTogJ0xGVScsXG4gICAgU1FPOiAnU1FPJywgU1FJOiAnU1FJJywgU1FMOiAnU1FMJyxcbiAgICAvLyBQSURcbiAgICBQSUQ6ICdQSUQnLFxuICAgIC8vIFN0cmluZ1xuICAgIExFTjogJ0xFTicsIExFRlQ6ICdMRUZUJywgUklHSFQ6ICdSSUdIVCcsIE1JRDogJ01JRCcsXG4gICAgQ09OQ0FUOiAnQ09OQ0FUJywgRklORDogJ0ZJTkQnLCBJTlNFUlQ6ICdJTlNFUlQnLCBERUxFVEU6ICdERUxFVEUnLFxuICAgIFVQUEVSX0NBU0U6ICdVUFBFUicsIExPV0VSX0NBU0U6ICdMT1dFUicsXG4gIH07XG5cbiAgZm9yIChjb25zdCBub2RlIG9mIGZiZC5ub2Rlcykge1xuICAgIGlmIChub2RlLnR5cGUgPT09ICdJTl9WQVJJQUJMRScpIHtcbiAgICAgIGlyZWZzLnB1c2goe1xuICAgICAgICAnQF9JRCc6IG5vZGUuaWQsXG4gICAgICAgICdAX1gnOiBTdHJpbmcobm9kZS5wb3NpdGlvbi54KSxcbiAgICAgICAgJ0BfWSc6IFN0cmluZyhub2RlLnBvc2l0aW9uLnkpLFxuICAgICAgICAnQF9PcGVyYW5kJzogbm9kZS50YWc/Lm5hbWUgfHwgJycsXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKG5vZGUudHlwZSA9PT0gJ09VVF9WQVJJQUJMRScpIHtcbiAgICAgIG9yZWZzLnB1c2goe1xuICAgICAgICAnQF9JRCc6IG5vZGUuaWQsXG4gICAgICAgICdAX1gnOiBTdHJpbmcobm9kZS5wb3NpdGlvbi54KSxcbiAgICAgICAgJ0BfWSc6IFN0cmluZyhub2RlLnBvc2l0aW9uLnkpLFxuICAgICAgICAnQF9PcGVyYW5kJzogbm9kZS50YWc/Lm5hbWUgfHwgJycsXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3Qgcm9ja1R5cGUgPSBub2RlLnZlbmRvck9yaWdpbmFsTmFtZSB8fCBpZWNUb1JvY2t3ZWxsQmxvY2tbbm9kZS50eXBlXSB8fCBub2RlLnR5cGU7XG4gICAgICAvLyBSZWFsIEw1WCBmb3JtYXQ6IDxCbG9jayBUeXBlPVwiVE9OXCIgVmlzaWJsZVBpbnM9XCJJTiBQVCBRIEVUXCIgT3BlcmFuZD1cIlRpbWVyMVwiLz5cbiAgICAgIGNvbnN0IHZpc2libGVQaW5zID0gW1xuICAgICAgICAuLi4obm9kZS5pbnB1dHMgfHwgW10pLm1hcChwID0+IHAubmFtZSksXG4gICAgICAgIC4uLihub2RlLm91dHB1dHMgfHwgW10pLm1hcChwID0+IHAubmFtZSksXG4gICAgICBdLmpvaW4oJyAnKTtcbiAgICAgIGZiZEJsb2Nrcy5wdXNoKHtcbiAgICAgICAgJ0BfVHlwZSc6IHJvY2tUeXBlLFxuICAgICAgICAnQF9JRCc6IG5vZGUuaWQsXG4gICAgICAgICdAX1gnOiBTdHJpbmcobm9kZS5wb3NpdGlvbi54KSxcbiAgICAgICAgJ0BfWSc6IFN0cmluZyhub2RlLnBvc2l0aW9uLnkpLFxuICAgICAgICAnQF9PcGVyYW5kJzogbm9kZS5pbnN0YW5jZU5hbWUgfHwgJycsXG4gICAgICAgICdAX1Zpc2libGVQaW5zJzogdmlzaWJsZVBpbnMsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvLyBCdWlsZCBhIG5vZGVJZCBcdTIxOTIgbm9kZS50eXBlIG1hcCBmb3IgSVJlZi9PUmVmIHBpbiBjb252ZW50aW9uXG4gIGNvbnN0IG5vZGVUeXBlTWFwID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgZm9yIChjb25zdCBub2RlIG9mIGZiZC5ub2Rlcykge1xuICAgIG5vZGVUeXBlTWFwLnNldChub2RlLmlkLCBub2RlLnR5cGUpO1xuICB9XG5cbiAgZm9yIChjb25zdCB3aXJlIG9mIGZiZC53aXJlcykge1xuICAgIGNvbnN0IGZyb21Ob2RlVHlwZSA9IG5vZGVUeXBlTWFwLmdldCh3aXJlLmZyb20ubm9kZUlkKSB8fCAnJztcbiAgICBjb25zdCB0b05vZGVUeXBlID0gbm9kZVR5cGVNYXAuZ2V0KHdpcmUudG8ubm9kZUlkKSB8fCAnJztcbiAgICBjb25zdCB3aXJlT2JqOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgJ0BfRnJvbUlEJzogd2lyZS5mcm9tLm5vZGVJZCxcbiAgICAgICdAX1RvSUQnOiB3aXJlLnRvLm5vZGVJZCxcbiAgICB9O1xuICAgIC8vIElSZWYgKElOX1ZBUklBQkxFKSBcdTIxOTIgRnJvbVBhcmFtIHNob3VsZCBiZSAnJyBwZXIgc3BlY1xuICAgIGlmIChmcm9tTm9kZVR5cGUgIT09ICdJTl9WQVJJQUJMRScpIHtcbiAgICAgIHdpcmVPYmpbJ0BfRnJvbVBhcmFtJ10gPSB3aXJlLmZyb20ucGluO1xuICAgIH0gZWxzZSB7XG4gICAgICB3aXJlT2JqWydAX0Zyb21QYXJhbSddID0gJyc7XG4gICAgfVxuICAgIC8vIE9SZWYgKE9VVF9WQVJJQUJMRSkgXHUyMTkyIFRvUGFyYW0gc2hvdWxkIGJlICcnIHBlciBzcGVjXG4gICAgaWYgKHRvTm9kZVR5cGUgIT09ICdPVVRfVkFSSUFCTEUnKSB7XG4gICAgICB3aXJlT2JqWydAX1RvUGFyYW0nXSA9IHdpcmUudG8ucGluO1xuICAgIH0gZWxzZSB7XG4gICAgICB3aXJlT2JqWydAX1RvUGFyYW0nXSA9ICcnO1xuICAgIH1cbiAgICB3aXJlcy5wdXNoKHdpcmVPYmopO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICAnQF9OYW1lJzogJ01haW5Sb3V0aW5lJyxcbiAgICAnQF9UeXBlJzogJ0ZCRCcsXG4gICAgRkJEQ29udGVudDoge1xuICAgICAgJ0BfU2hlZXRTaXplJzogJ0xldHRlciAoOC41eDExaW4pJyxcbiAgICAgICdAX1NoZWV0T3JpZW50YXRpb24nOiAnTGFuZHNjYXBlJyxcbiAgICAgIFNoZWV0OiB7XG4gICAgICAgICdAX051bWJlcic6ICcxJyxcbiAgICAgICAgQmxvY2s6IGZiZEJsb2Nrcy5sZW5ndGggPyBmYmRCbG9ja3MgOiB1bmRlZmluZWQsXG4gICAgICAgIElSZWY6IGlyZWZzLmxlbmd0aCA/IGlyZWZzIDogdW5kZWZpbmVkLFxuICAgICAgICBPUmVmOiBvcmVmcy5sZW5ndGggPyBvcmVmcyA6IHVuZGVmaW5lZCxcbiAgICAgICAgV2lyZTogd2lyZXMubGVuZ3RoID8gd2lyZXMgOiB1bmRlZmluZWQsXG4gICAgICB9LFxuICAgIH0sXG4gIH07XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFTQSxTQUFTLFVBQVUsVUFBVSxNQUFNLE1BQU0sT0FBTyxrQkFB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RUFBTSxLQUFLO0FBQUEsRUFBTSxLQUFLO0FBQUEsRUFBTSxLQUFLO0FBQUEsRUFBTSxLQUFLO0FBQUEsRUFDNUQsS0FBSztBQUFBLEVBQVMsS0FBSztBQUFBO0FBQUEsRUFFbkIsSUFBSTtBQUFBLEVBQU0sSUFBSTtBQUFBLEVBQU0sSUFBSTtBQUFBLEVBQU0sSUFBSTtBQUFBLEVBQU0sSUFBSTtBQUFBLEVBQU0sSUFBSTtBQUFBO0FBQUEsRUFFdEQsS0FBSztBQUNQO0FBR0EsTUFBTSxlQUF1QztBQUFBLEVBQzNDLEtBQUs7QUFBQSxFQUFPLEtBQUs7QUFBQSxFQUFPLEtBQUs7QUFBQSxFQUFPLEtBQUs7QUFBQSxFQUFPLEtBQUs7QUFBQSxFQUNyRCxLQUFLO0FBQUEsRUFBTyxLQUFLO0FBQUEsRUFBUSxNQUFNO0FBQUEsRUFBUSxLQUFLO0FBQUE7QUFBQSxFQUU1QyxLQUFLO0FBQUEsRUFBTyxLQUFLO0FBQUEsRUFBTyxLQUFLO0FBQUEsRUFBTyxLQUFLO0FBQUEsRUFBUSxNQUFNO0FBQUEsRUFDdkQsS0FBSztBQUFBLEVBQVEsS0FBSztBQUFBLEVBQVEsSUFBSTtBQUFBLEVBQU0sS0FBSztBQUFBO0FBQUEsRUFFekMsS0FBSztBQUNQO0FBR0EsTUFBTSxlQUF1QztBQUFBLEVBQzNDLEtBQUs7QUFBQSxFQUFRLE1BQU07QUFBQSxFQUFRLEtBQUs7QUFBQSxFQUFRLEtBQUs7QUFBQSxFQUFRLEtBQUs7QUFBQSxFQUMxRCxLQUFLO0FBQUEsRUFBTyxNQUFNO0FBQ3BCO0FBR0EsTUFBTSxrQkFBMEM7QUFBQSxFQUM5QyxLQUFLO0FBQUEsRUFBTyxJQUFJO0FBQUEsRUFBTSxLQUFLO0FBQUEsRUFBTyxLQUFLO0FBQUEsRUFDdkMsTUFBTTtBQUFBLEVBQU8sS0FBSztBQUFBLEVBQU0sTUFBTTtBQUFBLEVBQU8sTUFBTTtBQUM3QztBQUdBLE1BQU0saUJBQXlDO0FBQUEsRUFDN0MsS0FBSztBQUFBLEVBQU8sS0FBSztBQUFBLEVBQU8sT0FBTztBQUFBLEVBQVMsS0FBSztBQUFBLEVBQU8sS0FBSztBQUFBLEVBQ3pELEtBQUs7QUFBQSxFQUFTLEtBQUs7QUFBQTtBQUFBLEVBRW5CLE9BQU87QUFBQSxFQUFTLE9BQU87QUFBQSxFQUN2QixhQUFhO0FBQUEsRUFBZSxhQUFhO0FBQUEsRUFDekMsY0FBYztBQUFBLEVBQWdCLGNBQWM7QUFBQTtBQUFBLEVBRTVDLEtBQUs7QUFBQSxFQUFTLEtBQUs7QUFBQTtBQUFBLEVBRW5CLEtBQUs7QUFBQSxFQUFRLEtBQUs7QUFBQSxFQUFRLEtBQUs7QUFBQSxFQUFRLEtBQUs7QUFBQSxFQUM1QyxLQUFLO0FBQUEsRUFBUSxLQUFLO0FBQ3BCO0FBR0EsTUFBTSxlQUF1QztBQUFBLEVBQzNDLEtBQUs7QUFBQSxFQUFPLEtBQUs7QUFBQSxFQUFPLEtBQUs7QUFBQSxFQUFPLEtBQUs7QUFDM0M7QUFHQSxNQUFNLGNBQXNDO0FBQUEsRUFDMUMsS0FBSztBQUFBLEVBQU8sS0FBSztBQUFBLEVBQU8sS0FBSztBQUMvQjtBQUdBLE1BQU0sY0FBc0M7QUFBQSxFQUMxQyxLQUFLO0FBQUEsRUFBTyxNQUFNO0FBQUEsRUFBTyxPQUFPO0FBQ2xDO0FBR0EsTUFBTSxpQkFBeUM7QUFBQTtBQUFBLEVBRTdDLEtBQUs7QUFBQSxFQUFPLFFBQVE7QUFBQSxFQUFVLE1BQU07QUFBQSxFQUFRLFFBQVE7QUFBQSxFQUNwRCxRQUFRO0FBQUEsRUFBVSxLQUFLO0FBQUEsRUFBTyxPQUFPO0FBQUEsRUFBYyxPQUFPO0FBQUEsRUFDMUQsTUFBTTtBQUFBLEVBQVEsT0FBTztBQUFBO0FBQUEsRUFFckIsUUFBUTtBQUFBLEVBQU0sU0FBUztBQUFBO0FBQUEsRUFFdkIsTUFBTTtBQUFBLEVBQVEsTUFBTTtBQUN0QjtBQUlBLE1BQU0saUJBQWlCLG9CQUFJLElBQUk7QUFBQSxFQUM3QjtBQUFBLEVBQU87QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQVE7QUFBQSxFQUFRO0FBQUEsRUFBUTtBQUFBLEVBQVE7QUFBQSxFQUFRO0FBQUE7QUFBQSxFQUU3RDtBQUFBLEVBQ0E7QUFBQSxFQUFPO0FBQUEsRUFBTztBQUFBLEVBQVE7QUFBQSxFQUFRO0FBQUEsRUFBTztBQUFBLEVBQ3JDO0FBQUEsRUFBTztBQUFBLEVBQ1A7QUFDRixDQUFDO0FBR0QsTUFBTSxlQUFlLG9CQUFJLElBQUk7QUFBQSxFQUMzQjtBQUFBLEVBQU87QUFBQSxFQUNQO0FBQUEsRUFBTztBQUFBLEVBQ1A7QUFBQTtBQUFBLEVBQ0E7QUFBQSxFQUFRO0FBQ1YsQ0FBQztBQUdELFNBQVMsVUFDUCxPQUNBLFFBQ0EsZ0JBQ0EsWUFDQSxNQUNBLE1BQ2M7QUFDZCxTQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixJQUFJLElBQUksSUFBSSxVQUFVLElBQUksS0FBSyxFQUFFO0FBQUEsSUFDakM7QUFBQSxJQUNBLGNBQWMsR0FBRyxLQUFLLElBQUksY0FBYztBQUFBLElBQ3hDO0FBQUEsSUFDQSxVQUFVLEVBQUUsR0FBRyxNQUFNLEdBQUcsRUFBRTtBQUFBLElBQzFCLG9CQUFvQixVQUFXLFNBQW9CLFFBQVE7QUFBQSxFQUM3RDtBQUNGO0FBRUEsU0FBUyxrQkFDUCxPQUNBLE1BQ0EsTUFDQSxZQUNBLFVBQ0EsVUFDc0I7QUFHdEIsTUFBSSxnQkFBZ0IsS0FBSyxHQUFHO0FBQzFCLFVBQU0sVUFBVSxLQUFLLENBQUMsS0FBSyxPQUFPLElBQUk7QUFFdEMsVUFBTSxZQUFZLFVBQVUsU0FBUyxVQUFVLFVBQVUsS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUk7QUFDN0UsV0FBTztBQUFBLE1BQ0wsTUFBTTtBQUFBLE1BQ04sSUFBSSxJQUFJLElBQUksVUFBVSxJQUFJLEtBQUssRUFBRTtBQUFBLE1BQ2pDLE1BQU0sZ0JBQWdCLEtBQUs7QUFBQSxNQUMzQixLQUFLLEVBQUUsTUFBTSxTQUFTLFVBQVUsT0FBTztBQUFBLE1BQ3ZDLFVBQVUsRUFBRSxHQUFHLE1BQU0sR0FBRyxFQUFFO0FBQUEsTUFDMUIsWUFBWSxXQUFXLENBQUMsU0FBUyxRQUFRLElBQUk7QUFBQSxJQUMvQztBQUFBLEVBQ0Y7QUFHQSxNQUFJLGFBQWEsS0FBSyxHQUFHO0FBQ3ZCLFVBQU0sVUFBVSxLQUFLLENBQUMsS0FBSyxPQUFPLElBQUk7QUFDdEMsV0FBTztBQUFBLE1BQ0wsTUFBTTtBQUFBLE1BQ04sSUFBSSxJQUFJLElBQUksVUFBVSxJQUFJLEtBQUssRUFBRTtBQUFBLE1BQ2pDLE1BQU0sYUFBYSxLQUFLO0FBQUEsTUFDeEIsS0FBSyxFQUFFLE1BQU0sU0FBUyxVQUFVLE9BQU87QUFBQSxNQUN2QyxVQUFVLEVBQUUsR0FBRyxNQUFNLEdBQUcsRUFBRTtBQUFBLElBQzVCO0FBQUEsRUFDRjtBQUtBLE1BQUksY0FBYyxLQUFLLEdBQUc7QUFDeEIsVUFBTSxlQUFlLEtBQUssQ0FBQyxLQUFLLEtBQUssQ0FBQyxNQUFNLE1BQU0sS0FBSyxDQUFDLElBQUksR0FBRyxLQUFLLElBQUksSUFBSTtBQUM1RSxVQUFNLFNBQVMsS0FBSyxDQUFDLEtBQUssS0FBSyxDQUFDLE1BQU0sTUFBTSxLQUFLLENBQUMsSUFBSSxHQUFHLFlBQVk7QUFDckUsV0FBTyxVQUFVLE9BQU8sY0FBYyxLQUFLLEdBQUcsTUFBTSxZQUFZO0FBQUEsTUFDOUQsSUFBSyxFQUFFLE1BQU0sZUFBZSxPQUFRLFVBQVUsT0FBTztBQUFBLE1BQ3JELElBQUssRUFBRSxNQUFNLFFBQXNCLFVBQVUsT0FBTztBQUFBLE1BQ3BELEdBQUssRUFBRSxNQUFNLGVBQWUsT0FBUSxVQUFVLE9BQU87QUFBQSxNQUNyRCxJQUFLLEVBQUUsTUFBTSxlQUFlLFFBQVEsVUFBVSxPQUFPO0FBQUEsSUFDdkQsR0FBRyxJQUFJO0FBQUEsRUFDVDtBQUlBLE1BQUksZ0JBQWdCLEtBQUssR0FBRztBQUMxQixVQUFNLGVBQWUsS0FBSyxDQUFDLEtBQUssS0FBSyxDQUFDLE1BQU0sTUFBTSxLQUFLLENBQUMsSUFBSSxHQUFHLEtBQUssSUFBSSxJQUFJO0FBQzVFLFVBQU0sU0FBUyxLQUFLLENBQUMsS0FBSyxLQUFLLENBQUMsTUFBTSxNQUFNLEtBQUssQ0FBQyxJQUFJLEdBQUcsWUFBWTtBQUNyRSxXQUFPLFVBQVUsT0FBTyxnQkFBZ0IsS0FBSyxHQUFHLE1BQU0sWUFBWTtBQUFBLE1BQ2hFLElBQUksRUFBRSxNQUFNLGVBQWUsT0FBUSxVQUFVLE9BQU87QUFBQSxNQUNwRCxJQUFJLEVBQUUsTUFBTSxRQUFzQixVQUFVLE9BQU87QUFBQSxNQUNuRCxJQUFJLEVBQUUsTUFBTSxlQUFlLE9BQVEsVUFBVSxPQUFPO0FBQUEsTUFDcEQsSUFBSSxFQUFFLE1BQU0sZUFBZSxRQUFRLFVBQVUsT0FBTztBQUFBLElBQ3RELEdBQUcsSUFBSTtBQUFBLEVBQ1Q7QUFJQSxNQUFJLGFBQWEsS0FBSyxHQUFHO0FBQ3ZCLFVBQU0sT0FBVSxLQUFLLEtBQUssU0FBUyxDQUFDLEtBQUssVUFBVSxJQUFJO0FBQ3ZELFVBQU0sVUFBVSxLQUFLLENBQUMsS0FBSztBQUMzQixVQUFNLFVBQVUsS0FBSyxVQUFVLElBQUksS0FBSyxDQUFDLElBQUk7QUFDN0MsV0FBTyxVQUFVLE9BQU8sYUFBYSxLQUFLLEdBQUcsTUFBTSxZQUFZO0FBQUEsTUFDN0QsS0FBSyxFQUFFLE1BQU0sU0FBUyxVQUFVLE9BQU87QUFBQSxNQUN2QyxLQUFLLEVBQUUsTUFBTSxTQUFTLFVBQVUsT0FBTztBQUFBLE1BQ3ZDLEtBQUssRUFBRSxNQUFNLE1BQVMsVUFBVSxPQUFPO0FBQUEsSUFDekMsR0FBRyxJQUFJO0FBQUEsRUFDVDtBQUlBLE1BQUksZ0JBQWdCLEtBQUssR0FBRztBQUMxQixRQUFJLFVBQVUsT0FBTztBQUNuQixZQUFNLE1BQU8sS0FBSyxDQUFDLEtBQUs7QUFDeEIsWUFBTSxPQUFPLEtBQUssQ0FBQyxLQUFLO0FBQ3hCLFlBQU0sT0FBTyxLQUFLLENBQUMsS0FBSztBQUN4QixhQUFPLFVBQVUsT0FBTyxTQUFtQixNQUFNLFlBQVk7QUFBQSxRQUMzRCxJQUFLLEVBQUUsTUFBTSxLQUFNLFVBQVUsT0FBTztBQUFBLFFBQ3BDLElBQUssRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPO0FBQUEsUUFDcEMsSUFBSyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU87QUFBQSxRQUNwQyxLQUFLLEVBQUUsTUFBTSxRQUFRLElBQUksSUFBSSxVQUFVLE9BQU87QUFBQSxNQUNoRCxHQUFHLElBQUk7QUFBQSxJQUNUO0FBQ0EsUUFBSSxVQUFVLE9BQU87QUFDbkIsWUFBTSxNQUFPLEtBQUssQ0FBQyxLQUFLO0FBQ3hCLFlBQU0sT0FBTyxLQUFLLENBQUMsS0FBSztBQUN4QixZQUFNLE1BQU8sS0FBSyxDQUFDLEtBQUs7QUFDeEIsYUFBTyxVQUFVLE9BQU8sTUFBZ0IsTUFBTSxZQUFZO0FBQUEsUUFDeEQsS0FBTSxFQUFFLE1BQU0sS0FBTSxVQUFVLE9BQU87QUFBQSxRQUNyQyxNQUFNLEVBQUUsTUFBTSxNQUFNLFVBQVUsUUFBUTtBQUFBLFFBQ3RDLEtBQU0sRUFBRSxNQUFNLEtBQU0sVUFBVSxPQUFPO0FBQUEsUUFDckMsS0FBTSxFQUFFLE1BQU0sUUFBUSxJQUFJLElBQUksVUFBVSxPQUFPO0FBQUEsTUFDakQsR0FBRyxJQUFJO0FBQUEsSUFDVDtBQUNBLFVBQU0sVUFBVSxLQUFLLENBQUMsS0FBSztBQUMzQixVQUFNLFVBQVUsS0FBSyxDQUFDLEtBQUs7QUFDM0IsV0FBTyxVQUFVLE9BQU8sZ0JBQWdCLEtBQUssR0FBYSxNQUFNLFlBQVk7QUFBQSxNQUMxRSxLQUFLLEVBQUUsTUFBTSxTQUFTLFVBQVUsT0FBTztBQUFBLE1BQ3ZDLEtBQUssRUFBRSxNQUFNLFNBQVMsVUFBVSxPQUFPO0FBQUEsTUFDdkMsS0FBSyxFQUFFLE1BQU0sUUFBUSxJQUFJLElBQUksVUFBVSxPQUFPO0FBQUEsSUFDaEQsR0FBRyxJQUFJO0FBQUEsRUFDVDtBQUlBLE1BQUksYUFBYSxLQUFLLEdBQUc7QUFDdkIsVUFBTSxTQUFTLEtBQUssQ0FBQyxLQUFLO0FBQzFCLFVBQU0sT0FBUyxLQUFLLENBQUMsS0FBSyxRQUFRLElBQUk7QUFDdEMsUUFBSSxVQUFVLE9BQU87QUFFbkIsYUFBTyxVQUFVLE9BQU8sT0FBTyxNQUFNLFlBQVk7QUFBQSxRQUMvQyxJQUFTLEVBQUUsTUFBTSxRQUFjLFVBQVUsT0FBTztBQUFBLFFBQ2hELFNBQVMsRUFBRSxNQUFNLEtBQUssQ0FBQyxLQUFLLEtBQUssVUFBVSxPQUFPO0FBQUEsUUFDbEQsS0FBUyxFQUFFLE1BQU0sS0FBSyxDQUFDLEtBQUssTUFBTSxVQUFVLE9BQU87QUFBQSxRQUNuRCxTQUFTLEVBQUUsTUFBTSxLQUFLLENBQUMsS0FBSyxLQUFLLFVBQVUsT0FBTztBQUFBLFFBQ2xELEtBQVMsRUFBRSxNQUFNLEtBQUssQ0FBQyxLQUFLLEtBQUssVUFBVSxPQUFPO0FBQUEsTUFDcEQsR0FBRyxJQUFJO0FBQUEsSUFDVDtBQUNBLFFBQUksVUFBVSxRQUFRO0FBQ3BCLGFBQU8sVUFBVSxPQUFPLFFBQVEsTUFBTSxZQUFZO0FBQUEsUUFDaEQsSUFBSyxFQUFFLE1BQU0sUUFBUSxVQUFVLE9BQU87QUFBQSxRQUN0QyxLQUFLLEVBQUUsTUFBTSxLQUFLLENBQUMsS0FBSyxLQUFLLFVBQVUsT0FBTztBQUFBLFFBQzlDLEtBQUssRUFBRSxNQUFNLEtBQUssQ0FBQyxLQUFLLFFBQVEsSUFBSSxJQUFJLFVBQVUsT0FBTztBQUFBLE1BQzNELEdBQUcsSUFBSTtBQUFBLElBQ1Q7QUFDQSxXQUFPLFVBQVUsT0FBTyxhQUFhLEtBQUssR0FBRyxNQUFNLFlBQVk7QUFBQSxNQUM3RCxJQUFLLEVBQUUsTUFBTSxRQUFRLFVBQVUsT0FBTztBQUFBLE1BQ3RDLEtBQUssRUFBRSxNQUFNLE1BQVEsVUFBVSxPQUFPO0FBQUEsSUFDeEMsR0FBRyxJQUFJO0FBQUEsRUFDVDtBQUlBLE1BQUksZ0JBQWdCLEtBQUssR0FBRztBQUMxQixVQUFNLE9BQU8sS0FBSyxDQUFDLEtBQUs7QUFDeEIsVUFBTSxPQUFPLEtBQUssVUFBVSxJQUFJLEtBQUssQ0FBQyxJQUFJO0FBQzFDLFVBQU0sT0FBTyxLQUFLLEtBQUssU0FBUyxDQUFDLEtBQUssVUFBVSxJQUFJO0FBQ3BELFdBQU8sVUFBVSxPQUFPLGdCQUFnQixLQUFLLEdBQUcsTUFBTSxZQUFZO0FBQUEsTUFDaEUsS0FBSyxFQUFFLE1BQU0sTUFBTSxVQUFVLE9BQU87QUFBQSxNQUNwQyxLQUFLLEVBQUUsTUFBTSxNQUFNLFVBQVUsT0FBTztBQUFBLE1BQ3BDLEtBQUssRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPO0FBQUEsSUFDdEMsR0FBRyxJQUFJO0FBQUEsRUFDVDtBQUdBLE1BQUksZUFBZSxLQUFLLEdBQUc7QUFDekIsUUFBSSxVQUFVLE9BQU87QUFDbkIsWUFBTSxNQUFPLEtBQUssQ0FBQyxLQUFLO0FBQ3hCLFlBQU0sTUFBTyxLQUFLLENBQUMsS0FBSztBQUN4QixZQUFNLE1BQU8sS0FBSyxDQUFDLEtBQUs7QUFDeEIsWUFBTUMsUUFBTyxLQUFLLENBQUMsS0FBSyxRQUFRLElBQUk7QUFDcEMsYUFBTyxVQUFVLE9BQU8sT0FBTyxNQUFNLFlBQVk7QUFBQSxRQUMvQyxHQUFLLEVBQUUsTUFBTSxLQUFNLFVBQVUsT0FBTztBQUFBLFFBQ3BDLEtBQUssRUFBRSxNQUFNLEtBQU0sVUFBVSxPQUFPO0FBQUEsUUFDcEMsS0FBSyxFQUFFLE1BQU0sS0FBTSxVQUFVLE9BQU87QUFBQSxRQUNwQyxLQUFLLEVBQUUsTUFBTUEsT0FBTSxVQUFVLE9BQU87QUFBQSxNQUN0QyxHQUFHLElBQUk7QUFBQSxJQUNUO0FBQ0EsUUFBSSxVQUFVLE9BQU87QUFDbkIsWUFBTSxNQUFPLEtBQUssQ0FBQyxLQUFLO0FBQ3hCLFlBQU1BLFFBQU8sS0FBSyxLQUFLLFNBQVMsQ0FBQyxLQUFLLFFBQVEsSUFBSTtBQUNsRCxZQUFNLFlBQW9DLEVBQUUsR0FBRyxFQUFFLE1BQU0sS0FBSyxVQUFVLE9BQU8sRUFBRTtBQUMvRSxXQUFLLE1BQU0sR0FBRyxLQUFLLFNBQVMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxHQUFHLE1BQU07QUFDL0Msa0JBQVUsS0FBSyxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sR0FBRyxVQUFVLE9BQU87QUFBQSxNQUNwRCxDQUFDO0FBQ0QsZ0JBQVUsS0FBSyxJQUFJLEVBQUUsTUFBTUEsT0FBTSxVQUFVLE9BQU87QUFDbEQsYUFBTyxVQUFVLE9BQU8sT0FBTyxNQUFNLFlBQVksV0FBVyxJQUFJO0FBQUEsSUFDbEU7QUFDQSxRQUFJLFVBQVUsV0FBVyxVQUFVLE9BQU87QUFDeEMsYUFBTyxVQUFVLE9BQU8sU0FBUyxNQUFNLFlBQVk7QUFBQSxRQUNqRCxJQUFLLEVBQUUsTUFBTSxLQUFLLENBQUMsS0FBSyxLQUFLLFVBQVUsT0FBTztBQUFBLFFBQzlDLElBQUssRUFBRSxNQUFNLEtBQUssQ0FBQyxLQUFLLEtBQUssVUFBVSxPQUFPO0FBQUEsUUFDOUMsSUFBSyxFQUFFLE1BQU0sS0FBSyxDQUFDLEtBQUssS0FBSyxVQUFVLE9BQU87QUFBQSxRQUM5QyxLQUFLLEVBQUUsTUFBTSxRQUFRLElBQUksSUFBSSxVQUFVLE9BQU87QUFBQSxNQUNoRCxHQUFHLElBQUk7QUFBQSxJQUNUO0FBQ0EsUUFBSSxVQUFVLFNBQVMsVUFBVSxPQUFPO0FBQ3RDLGFBQU8sVUFBVSxPQUFPLGVBQWUsS0FBSyxHQUFHLE1BQU0sWUFBWTtBQUFBLFFBQy9ELEtBQUssRUFBRSxNQUFNLEtBQUssQ0FBQyxLQUFLLEtBQUssVUFBVSxPQUFPO0FBQUEsUUFDOUMsS0FBSyxFQUFFLE1BQU0sS0FBSyxDQUFDLEtBQUssS0FBSyxVQUFVLE9BQU87QUFBQSxRQUM5QyxLQUFLLEVBQUUsTUFBTSxLQUFLLENBQUMsS0FBSyxRQUFRLElBQUksSUFBSSxVQUFVLE9BQU87QUFBQSxNQUMzRCxHQUFHLElBQUk7QUFBQSxJQUNUO0FBQ0EsUUFBSSxVQUFVLFNBQVMsVUFBVSxPQUFPO0FBQ3RDLGFBQU8sVUFBVSxPQUFPLFNBQVMsTUFBTSxZQUFZO0FBQUEsUUFDakQsSUFBTyxFQUFFLE1BQU0sS0FBSyxDQUFDLEtBQUssS0FBSyxVQUFVLE9BQU87QUFBQSxRQUNoRCxPQUFPLEVBQUUsTUFBTSxLQUFLLENBQUMsS0FBSyxLQUFLLFVBQVUsT0FBTztBQUFBLFFBQ2hELE9BQU8sRUFBRSxNQUFNLEtBQUssQ0FBQyxLQUFLLEtBQUssVUFBVSxPQUFPO0FBQUEsUUFDaEQsS0FBTyxFQUFFLE1BQU0sS0FBSyxDQUFDLEtBQUssUUFBUSxJQUFJLElBQUksVUFBVSxPQUFPO0FBQUEsTUFDN0QsR0FBRyxJQUFJO0FBQUEsSUFDVDtBQUVBLFVBQU0sTUFBTyxLQUFLLENBQUMsS0FBSztBQUN4QixVQUFNLE9BQU8sS0FBSyxLQUFLLFNBQVMsQ0FBQyxLQUFLLFFBQVEsSUFBSTtBQUNsRCxXQUFPLFVBQVUsT0FBTyxlQUFlLEtBQUssR0FBRyxNQUFNLFlBQVk7QUFBQSxNQUMvRCxJQUFLLEVBQUUsTUFBTSxLQUFNLFVBQVUsT0FBTztBQUFBLE1BQ3BDLEtBQUssRUFBRSxNQUFNLE1BQU0sVUFBVSxPQUFPO0FBQUEsSUFDdEMsR0FBRyxJQUFJO0FBQUEsRUFDVDtBQU1BLE1BQUksYUFBYSxLQUFLLEdBQUc7QUFDdkIsVUFBTSxTQUFTLFVBQVUsU0FBUyxVQUFVO0FBQzVDLFVBQU0sV0FBVyxDQUFDLE1BQTJCLENBQUMsS0FBSyxNQUFNLE1BQU8sU0FBWTtBQUM1RSxRQUFJLFFBQVE7QUFDVixZQUFNLE9BQU8sU0FBUyxLQUFLLENBQUMsQ0FBQyxLQUFLLEdBQUcsS0FBSztBQUMxQyxhQUFPLFVBQVUsT0FBTyxhQUFhLEtBQUssR0FBRyxNQUFNLFlBQVk7QUFBQSxRQUM3RCxJQUFNLEVBQUUsTUFBTSxTQUFTLEtBQUssQ0FBQyxDQUFDLEtBQUssS0FBYyxVQUFVLE9BQU87QUFBQSxRQUNsRSxNQUFNLEVBQUUsTUFBTSxTQUFTLEtBQUssQ0FBQyxDQUFDLEtBQUssR0FBRyxLQUFLLE1BQU0sVUFBVSxPQUFPO0FBQUEsUUFDbEUsTUFBTSxFQUFFLE1BQU0sTUFBbUMsVUFBVSxVQUFVO0FBQUEsUUFDckUsS0FBTSxFQUFFLE1BQU0sR0FBRyxJQUFJLFFBQTJCLFVBQVUsT0FBTztBQUFBLFFBQ2pFLEtBQU0sRUFBRSxNQUFNLEdBQUcsSUFBSSxRQUEyQixVQUFVLE9BQU87QUFBQSxRQUNqRSxJQUFNLEVBQUUsTUFBTSxHQUFHLElBQUksT0FBMkIsVUFBVSxPQUFPO0FBQUEsUUFDakUsSUFBTSxFQUFFLE1BQU0sR0FBRyxJQUFJLE9BQTJCLFVBQVUsT0FBTztBQUFBLE1BQ25FLEdBQUcsSUFBSTtBQUFBLElBQ1QsT0FBTztBQUNMLFlBQU0sT0FBTyxTQUFTLEtBQUssQ0FBQyxDQUFDLEtBQUssR0FBRyxLQUFLO0FBQzFDLGFBQU8sVUFBVSxPQUFPLGFBQWEsS0FBSyxHQUFHLE1BQU0sWUFBWTtBQUFBLFFBQzdELE1BQU0sRUFBRSxNQUFNLFNBQVMsS0FBSyxDQUFDLENBQUMsS0FBSyxHQUFHLEtBQUssTUFBTSxVQUFVLE9BQU87QUFBQSxRQUNsRSxLQUFNLEVBQUUsTUFBTSxTQUFTLEtBQUssQ0FBQyxDQUFDLEtBQUssUUFBUSxJQUFJLElBQUksVUFBVSxPQUFPO0FBQUEsUUFDcEUsTUFBTSxFQUFFLE1BQU0sTUFBbUMsVUFBVSxVQUFVO0FBQUEsUUFDckUsS0FBTSxFQUFFLE1BQU0sR0FBRyxJQUFJLFFBQTJCLFVBQVUsT0FBTztBQUFBLFFBQ2pFLEtBQU0sRUFBRSxNQUFNLEdBQUcsSUFBSSxRQUEyQixVQUFVLE9BQU87QUFBQSxRQUNqRSxJQUFNLEVBQUUsTUFBTSxHQUFHLElBQUksT0FBMkIsVUFBVSxPQUFPO0FBQUEsUUFDakUsSUFBTSxFQUFFLE1BQU0sR0FBRyxJQUFJLE9BQTJCLFVBQVUsT0FBTztBQUFBLE1BQ25FLEdBQUcsSUFBSTtBQUFBLElBQ1Q7QUFBQSxFQUNGO0FBTUEsTUFBSSxZQUFZLEtBQUssR0FBRztBQUN0QixXQUFPLFVBQVUsT0FBTyxZQUFZLEtBQUssR0FBRyxNQUFNLFlBQVk7QUFBQSxNQUM1RCxNQUFNLEVBQUUsTUFBTSxLQUFLLENBQUMsS0FBSyxHQUFHLEtBQUssU0FBUyxVQUFVLE9BQU87QUFBQSxNQUMzRCxNQUFNLEVBQUUsTUFBTSxLQUFLLENBQUMsS0FBSyxLQUFpQixVQUFVLFFBQVE7QUFBQSxNQUM1RCxNQUFNLEVBQUUsTUFBTSxLQUFLLENBQUMsS0FBSyxRQUFRLElBQUksSUFBSyxVQUFVLE9BQU87QUFBQSxNQUMzRCxNQUFNLEVBQUUsTUFBTSxLQUFLLENBQUMsS0FBSyxHQUFHLEtBQUssU0FBUyxVQUFVLE9BQU87QUFBQSxNQUMzRCxLQUFNLEVBQUUsTUFBTSxLQUFLLENBQUMsS0FBSyxLQUFpQixVQUFVLE9BQU87QUFBQSxNQUMzRCxLQUFNLEVBQUUsTUFBTSxLQUFLLENBQUMsS0FBSyxLQUFpQixVQUFVLE9BQU87QUFBQSxNQUMzRCxJQUFNLEVBQUUsTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLEtBQUssT0FBUyxVQUFVLE9BQU87QUFBQSxNQUMzRCxJQUFNLEVBQUUsTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLEtBQUssT0FBUyxVQUFVLE9BQU87QUFBQSxJQUM3RCxHQUFHLElBQUk7QUFBQSxFQUNUO0FBSUEsTUFBSSxZQUFZLEtBQUssR0FBRztBQUN0QixXQUFPLFVBQVUsT0FBTyxZQUFZLEtBQUssR0FBRyxNQUFNLFlBQVk7QUFBQSxNQUM1RCxJQUFRLEVBQUUsTUFBTSxLQUFLLENBQUMsS0FBSyxNQUFNLElBQUksSUFBTSxVQUFVLE9BQU87QUFBQSxNQUM1RCxJQUFRLEVBQUUsTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLEtBQUssT0FBUSxVQUFVLE9BQU87QUFBQSxNQUM1RCxLQUFRLEVBQUUsTUFBTSxLQUFLLENBQUMsS0FBSyxNQUFNLElBQUksSUFBTSxVQUFVLE9BQU87QUFBQSxNQUM1RCxJQUFRLEVBQUUsTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLEtBQUssT0FBUSxVQUFVLE9BQU87QUFBQSxNQUM1RCxJQUFRLEVBQUUsTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLEtBQUssT0FBUSxVQUFVLE9BQU87QUFBQSxNQUM1RCxJQUFRLEVBQUUsTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLEtBQUssT0FBUSxVQUFVLE9BQU87QUFBQSxNQUM1RCxJQUFRLEVBQUUsTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLEtBQUssT0FBUSxVQUFVLE9BQU87QUFBQSxJQUM5RCxHQUFHLElBQUk7QUFBQSxFQUNUO0FBR0EsTUFBSSxlQUFlLEtBQUssR0FBRztBQUN6QixVQUFNLE9BQU8sS0FBSyxDQUFDLEtB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VyxDQUFDLEdBQUcsSUFBSSxPQUFLLEVBQUUsSUFBSTtBQUFBLE1BQ3pDLEVBQUUsS0FBSyxHQUFHO0FBQ1YsZ0JBQVUsS0FBSztBQUFBLFFBQ2IsVUFBVTtBQUFBLFFBQ1YsUUFBUSxLQUFLO0FBQUEsUUFDYixPQUFPLE9BQU8sS0FBSyxTQUFTLENBQUM7QUFBQSxRQUM3QixPQUFPLE9BQU8sS0FBSyxTQUFTLENBQUM7QUFBQSxRQUM3QixhQUFhLEtBQUssZ0JBQWdCO0FBQUEsUUFDbEMsaUJBQWlCO0FBQUEsTUFDbkIsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBR0EsUUFBTSxjQUFjLG9CQUFJLElBQW9CO0FBQzVDLGFBQVcsUUFBUSxJQUFJLE9BQU87QUFDNUIsZ0JBQVksSUFBSSxLQUFLLElBQUksS0FBSyxJQUFJO0FBQUEsRUFDcEM7QUFFQSxhQUFXLFFBQVEsSUFBSSxPQUFPO0FBQzVCLFVBQU0sZUFBZSxZQUFZLElBQUksS0FBSyxLQUFLLE1BQU0sS0FBSztBQUMxRCxVQUFNLGFBQWEsWUFBWSxJQUFJLEtBQUssR0FBRyxNQUFNLEtBQUs7QUFDdEQsVUFBTSxVQUFrQztBQUFBLE1BQ3RDLFlBQVksS0FBSyxLQUFLO0FBQUEsTUFDdEIsVUFBVSxLQUFLLEdBQUc7QUFBQSxJQUNwQjtBQUVBLFFBQUksaUJBQWlCLGVBQWU7QUFDbEMsY0FBUSxhQUFhLElBQUksS0FBSyxLQUFLO0FBQUEsSUFDckMsT0FBTztBQUNMLGNBQVEsYUFBYSxJQUFJO0FBQUEsSUFDM0I7QUFFQSxRQUFJLGVBQWUsZ0JBQWdCO0FBQ2pDLGNBQVEsV0FBVyxJQUFJLEtBQUssR0FBRztBQUFBLElBQ2pDLE9BQU87QUFDTCxjQUFRLFdBQVcsSUFBSTtBQUFBLElBQ3pCO0FBQ0EsVUFBTSxLQUFLLE9BQU87QUFBQSxFQUNwQjtBQUVBLFNBQU87QUFBQSxJQUNMLFVBQVU7QUFBQSxJQUNWLFVBQVU7QUFBQSxJQUNWLFlBQVk7QUFBQSxNQUNWLGVBQWU7QUFBQSxNQUNmLHNCQUFzQjtBQUFBLE1BQ3RCLE9BQU87QUFBQSxRQUNMLFlBQVk7QUFBQSxRQUNaLE9BQU8sVUFBVSxTQUFTLFlBQVk7QUFBQSxRQUN0QyxNQUFNLE1BQU0sU0FBUyxRQUFRO0FBQUEsUUFDN0IsTUFBTSxNQUFNLFNBQVMsUUFBUTtBQUFBLFFBQzdCLE1BQU0sTUFBTSxTQUFTLFFBQVE7QUFBQSxNQUMvQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0Y7IiwKICAibmFtZXMiOiBbInRleHQiLCAiZGVzdCJdCn0K
