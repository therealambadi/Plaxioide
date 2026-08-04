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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjMi9wbGMtZWRpdG9yLXRzeC92ZW5kb3IvYWRhcHRlcnMvcm9ja3dlbGxBZGFwdGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKlxuICogUm9ja3dlbGwgTDVYIEFkYXB0ZXJcbiAqIFBhcnNlcyBSU0xvZ2l4IDUwMDAgLyBTdHVkaW8gNTAwMCBMb2dpeCBEZXNpZ25lciAuTDVYIGV4cG9ydCBmaWxlcy5cbiAqIFNjaGVtYTogPFJTTG9naXg1MDAwQ29udGVudD4gLyBDb250cm9sbGVyIC8gUHJvZ3JhbXMgLyBQcm9ncmFtIC8gUm91dGluZXMgLyBSb3V0aW5lIC8gUkxMQ29udGVudCAvIFJ1bmdcbiAqXG4gKiBTdXBwb3J0czogUkxMIChsYWRkZXIpIHdpdGggZnVsbCBicmFuY2ggcGFyc2luZyAoQlNUL05YQi9CTkQpLCBGQkQgU2hlZXQgaW1wb3J0LFxuICogICAgICAgICAgIGNvbXByZWhlbnNpdmUgaW5zdHJ1Y3Rpb24gc2V0IChNT1YsIENNUCwgbWF0aCwgY291bnRlcnMsIG9uZS1zaG90cykuXG4gKi9cblxuaW1wb3J0IHsgcGFyc2VYTUwsIGJ1aWxkWE1MLCBhdHRyLCB0ZXh0LCBjaGlsZCwgY2hpbGRBcnJheSB9IGZyb20gJy4uL3htbFV0aWxzLmpzJztcbmltcG9ydCB7IHJvY2t3ZWxsVHlwZVRvSUVDLCBpZWNUeXBlVG9Sb2Nrd2VsbCB9IGZyb20gJy4uL2RhdGFUeXBlTWFwLmpzJztcbmltcG9ydCB7IGJ1aWxkUmVzb2x2ZXIsIFZhcmlhYmxlVHlwZVJlc29sdmVyIH0gZnJvbSAnLi4vdmFyaWFibGVUeXBlUmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgZ2V0UGluRGF0YVR5cGUsIGJ1aWxkVHlwZWRQaW5zIH0gZnJvbSAnLi4vcGluU2lnbmF0dXJlcy5qcyc7XG5pbXBvcnQgdHlwZSB7XG4gIEltcG9ydFJlc3VsdCwgRXhwb3J0UmVzdWx0LCBOb3JtYWxpemVkUHJvamVjdCwgTm9ybWFsaXplZFBPVSwgTm9ybWFsaXplZFRhZyxcbiAgVmVuZG9yTWV0YWRhdGFTaWRlY2FyLCBVbm1hcHBlZEVsZW1lbnQsXG59IGZyb20gJy4uL3R5cGVzLmpzJztcbmltcG9ydCB0eXBlIHtcbiAgTGFkZGVyUHJvZ3JhbSwgUnVuZywgTGFkZGVyRWxlbWVudCwgQ29udGFjdEVsZW1lbnQsIENvaWxFbGVtZW50LCBCbG9ja0VsZW1lbnQsIEJyYW5jaCxcbiAgQ29udGFjdFR5cGUsIENvaWxUeXBlLCBGQlR5cGUsIFRhZ1JlZixcbiAgRkJEUHJvZ3JhbSwgRkJETm9kZSwgRkJEV2lyZSwgRkJEQmxvY2tUeXBlLFxufSBmcm9tICcuLi8uLi9sb2dpY1N0b3JlLmpzJztcblxubGV0IF91aWQgPSAwO1xuZnVuY3Rpb24gdWlkKHByZWZpeDogc3RyaW5nKTogc3RyaW5nIHsgcmV0dXJuIGAke3ByZWZpeH0tJHsrK191aWR9LSR7TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMiwgOCl9YDsgfVxuXG5mdW5jdGlvbiB1bmVzY2FwZVhNTChzOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gcy5yZXBsYWNlKC8mYW1wOy9nLCAnJicpLnJlcGxhY2UoLyZsdDsvZywgJzwnKS5yZXBsYWNlKC8mZ3Q7L2csICc+JykucmVwbGFjZSgvJnF1b3Q7L2csICdcIicpLnJlcGxhY2UoLyZhcG9zOy9nLCBcIidcIik7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBJbXBvcnQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBmdW5jdGlvbiBpbXBvcnRSb2Nrd2VsbCh4bWxDb250ZW50OiBzdHJpbmcsIGZpbGVQYXRoOiBzdHJpbmcpOiBJbXBvcnRSZXN1bHQge1xuICBfdWlkID0gMDtcbiAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdID0gW107XG5cbiAgbGV0IHJvb3Q6IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICB0cnkge1xuICAgIHJvb3QgPSBwYXJzZVhNTCh4bWxDb250ZW50KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3JzOiBbYFhNTCBwYXJzZSBlcnJvcjogJHtlfWBdLCB3YXJuaW5nczogW10gfTtcbiAgfVxuXG4gIGNvbnN0IGNvbnRlbnQgPSBjaGlsZChyb290LCAnUlNMb2dpeDUwMDBDb250ZW50JykgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCB1bmRlZmluZWQ7XG4gIGlmICghY29udGVudCkge1xuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3JzOiBbJ05vIDxSU0xvZ2l4NTAwMENvbnRlbnQ+IHJvb3QgZm91bmQnXSwgd2FybmluZ3M6IFtdIH07XG4gIH1cblxuICBjb25zdCBzY2hlbWFSZXZpc2lvbiA9IGF0dHIoY29udGVudCwgJ1NjaGVtYVJldmlzaW9uJyk7XG4gIGNvbnN0IGNvbnRyb2xsZXIgPSBjaGlsZChjb250ZW50LCAnQ29udHJvbGxlcicpIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgdW5kZWZpbmVkO1xuICBpZiAoIWNvbnRyb2xsZXIpIHtcbiAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9yczogWydObyA8Q29udHJvbGxlcj4gZWxlbWVudCBmb3VuZCddLCB3YXJuaW5nczogW10gfTtcbiAgfVxuXG4gIGNvbnN0IHByb2plY3ROYW1lID0gYXR0cihjb250cm9sbGVyLCAnTmFtZScpIHx8ICdMNVggSW1wb3J0JztcblxuICAvLyBHbG9iYWwvY29udHJvbGxlci1zY29wZSB0YWdzXG4gIGNvbnN0IGdsb2JhbFRhZ3M6IE5vcm1hbGl6ZWRUYWdbXSA9IFtdO1xuICBjb25zdCB0YWdzRWwgPSBjaGlsZChjb250cm9sbGVyLCAnVGFncycpIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgdW5kZWZpbmVkO1xuICBjb25zdCB0YWdzUmV0YWluID0gdGFnc0VsID8gYXR0cih0YWdzRWwsICdVc2UnKSA9PT0gJ1JldGFpbicgOiBmYWxzZTtcbiAgZm9yIChjb25zdCB0YWdFbCBvZiBjaGlsZEFycmF5KHRhZ3NFbCwgJ1RhZycpKSB7XG4gICAgY29uc3QgdGFnID0gcGFyc2VMNVhUYWcodGFnRWwsIHRhZ3NSZXRhaW4sIHVubWFwcGVkKTtcbiAgICBpZiAodGFnKSBnbG9iYWxUYWdzLnB1c2godGFnKTtcbiAgfVxuXG4gIC8vIFVEVHMgXHUyMTkyIG1hcmsgYXMgc3RydWN0IGluIHVubWFwcGVkIChwcmVzZXJ2ZSBmb3Igcm91bmQtdHJpcClcbiAgZm9yIChjb25zdCB1ZHRFbCBvZiBjaGlsZEFycmF5KGNoaWxkKGNvbnRyb2xsZXIsICdEYXRhVHlwZXMnKSwgJ0RhdGFUeXBlJykpIHtcbiAgICB1bm1hcHBlZC5wdXNoKHtcbiAgICAgIGNsbU5vZGVJZDogbnVsbCxcbiAgICAgIHZlbmRvclNwZWNpZmljRGF0YTogdWR0RWwsXG4gICAgICByZWFzb246IGBVc2VyLURlZmluZWQgVHlwZSBcIiR7YXR0cih1ZHRFbCwgJ05hbWUnKX1cIiBcdTIwMTQgcHJlc2VydmVkIGluIHNpZGVjYXJgLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gUHJvZ3JhbXNcbiAgY29uc3QgcG91czogTm9ybWFsaXplZFBPVVtdID0gW107XG4gIGZvciAoY29uc3QgcHJvZ3JhbUVsIG9mIGNoaWxkQXJyYXkoY2hpbGQoY29udHJvbGxlciwgJ1Byb2dyYW1zJyksICdQcm9ncmFtJykpIHtcbiAgICBjb25zdCBwb3VMaXN0ID0gcGFyc2VMNVhQcm9ncmFtKHByb2dyYW1FbCwgdW5tYXBwZWQsIHdhcm5pbmdzKTtcbiAgICBwb3VzLnB1c2goLi4ucG91TGlzdCk7XG4gIH1cblxuICAvLyBNb2R1bGVzIFx1MjE5MiBwcmVzZXJ2ZSBmb3Igcm91bmQtdHJpcFxuICBjb25zdCBtb2R1bGVzRWwgPSBjaGlsZChjb250cm9sbGVyLCAnTW9kdWxlcycpO1xuICBpZiAobW9kdWxlc0VsKSB7XG4gICAgdW5tYXBwZWQucHVzaCh7IGNsbU5vZGVJZDogbnVsbCwgdmVuZG9yU3BlY2lmaWNEYXRhOiBtb2R1bGVzRWwsIHJlYXNvbjogJ01vZHVsZXMgZWxlbWVudCcgfSk7XG4gIH1cblxuICAvLyBUYXNrcyBcdTIxOTIgcHJlc2VydmUgZm9yIHJvdW5kLXRyaXBcbiAgY29uc3QgdGFza3NFbCA9IGNoaWxkKGNvbnRyb2xsZXIsICdUYXNrcycpO1xuICBpZiAodGFza3NFbCkge1xuICAgIHVubWFwcGVkLnB1c2goeyBjbG1Ob2RlSWQ6IG51bGwsIHZlbmRvclNwZWNpZmljRGF0YTogdGFza3NFbCwgcmVhc29uOiAnVGFza3MgZWxlbWVudCcgfSk7XG4gIH1cblxuICAvLyBBZGQtT24gSW5zdHJ1Y3Rpb25zIFx1MjE5MiB3YXJuLCBwcmVzZXJ2ZVxuICBmb3IgKGNvbnN0IGFvaUVsIG9mIGNoaWxkQXJyYXkoY2hpbGQoY29udHJvbGxlciwgJ0FkZE9uSW5zdHJ1Y3Rpb25EZWZpbml0aW9ucycpLCAnQWRkT25JbnN0cnVjdGlvbkRlZmluaXRpb24nKSkge1xuICAgIGNvbnN0IG5hbWUgPSBhdHRyKGFvaUVsLCAnTmFtZScpO1xuICAgIHdhcm5pbmdzLnB1c2goYEFkZC1PbiBJbnN0cnVjdGlvbiBcIiR7bmFtZX1cIiBjYW5ub3QgYmUgY29udmVydGVkIHRvIHN0YW5kYXJkIElFQyBibG9ja3MgXHUyMDE0IHByZXNlcnZlZCBpbiBzaWRlY2FyLmApO1xuICAgIHVubWFwcGVkLnB1c2goeyBjbG1Ob2RlSWQ6IG51bGwsIHZlbmRvclNwZWNpZmljRGF0YTogYW9pRWwsIHJlYXNvbjogYEFPSTogJHtuYW1lfWAgfSk7XG4gIH1cblxuICBpZiAocG91cy5sZW5ndGggPT09IDApIHtcbiAgICBlcnJvcnMucHVzaCgnTm8gcHJvZ3JhbXMgb3Igcm91dGluZXMgZm91bmQgaW4gTDVYIGZpbGUnKTtcbiAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9ycywgd2FybmluZ3MgfTtcbiAgfVxuXG4gIGNvbnN0IHNpZGVjYXI6IFZlbmRvck1ldGFkYXRhU2lkZWNhciA9IHtcbiAgICBzb3VyY2VWZW5kb3I6ICdyb2Nrd2VsbF9sNXgnLFxuICAgIHNvdXJjZUZpbGVWZXJzaW9uOiBzY2hlbWFSZXZpc2lvbiB8fCAnMS4wJyxcbiAgICBvcmlnaW5hbEZpbGVQYXRoOiBmaWxlUGF0aCxcbiAgICB1bm1hcHBlZEVsZW1lbnRzOiB1bm1hcHBlZCxcbiAgICBvcmdhbml6ZXJUcmVlTGF5b3V0OiBjaGlsZChjb250cm9sbGVyLCAnUHJvZ3JhbXMnKSxcbiAgICB2ZW5kb3JTcGVjaWZpY0dsb2JhbHM6IHtcbiAgICAgIHNjaGVtYVJldmlzaW9uOiBhdHRyKGNvbnRlbnQsICdTY2hlbWFSZXZpc2lvbicpIHx8ICcxLjAnLFxuICAgICAgc29mdHdhcmVSZXZpc2lvbjogYXR0cihjb250ZW50LCAnU29mdHdhcmVSZXZpc2lvbicpIHx8ICczMi4wJyxcbiAgICAgIGNvbnRyb2xsZXJOYW1lOiBhdHRyKGNvbnRyb2xsZXIsICdOYW1lJykgfHwgJycsXG4gICAgICBwcm9jZXNzb3JUeXBlOiBhdHRyKGNvbnRyb2xsZXIsICdQcm9jZXNzb3JUeXBlJykgfHwgJzE3NjktTDMzRVInLFxuICAgIH0sXG4gIH07XG5cbiAgcmV0dXJuIHsgb2s6IHRydWUsIHByb2plY3Q6IHsgcHJvamVjdE5hbWUsIHBvdXMsIGdsb2JhbFRhZ3MsIHNpZGVjYXIgfSwgZXJyb3JzLCB3YXJuaW5ncyB9O1xufVxuXG5mdW5jdGlvbiBwYXJzZUw1WFRhZyh0YWdFbDogdW5rbm93biwgcGFyZW50UmV0YWluOiBib29sZWFuLCB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10pOiBOb3JtYWxpemVkVGFnIHwgbnVsbCB7XG4gIGlmICghdGFnRWwgfHwgdHlwZW9mIHRhZ0VsICE9PSAnb2JqZWN0JykgcmV0dXJuIG51bGw7XG4gIGNvbnN0IG5hbWUgPSBhdHRyKHRhZ0VsLCAnTmFtZScpO1xuICBpZiAoIW5hbWUpIHJldHVybiBudWxsO1xuICBjb25zdCB0eXBlU3RyID0gYXR0cih0YWdFbCwgJ0RhdGFUeXBlJyk7XG4gIGNvbnN0IGRhdGFUeXBlID0gcm9ja3dlbGxUeXBlVG9JRUModHlwZVN0cik7XG4gIGNvbnN0IGRlc2MgPSB0ZXh0KGNoaWxkKGNoaWxkKHRhZ0VsLCAnRGVzY3JpcHRpb24nKSwgJyNjZGF0YScpID8/IGNoaWxkKHRhZ0VsLCAnRGVzY3JpcHRpb24nKSk7XG5cbiAgaWYgKGRhdGFUeXBlID09PSAnU1RSVUNUJyAmJiAhWydUSU1FUicsICdDT1VOVEVSJywgJ0NPTlRST0wnXS5pbmNsdWRlcyh0eXBlU3RyLnRvVXBwZXJDYXNlKCkpKSB7XG4gICAgdW5tYXBwZWQucHVzaCh7IGNsbU5vZGVJZDogbnVsbCwgdmVuZG9yU3BlY2lmaWNEYXRhOiB0YWdFbCwgcmVhc29uOiBgTm9uLXN0YW5kYXJkIHN0cnVjdCB0eXBlOiAke3R5cGVTdHJ9YCB9KTtcbiAgfVxuXG4gIC8vIEFkZHJlc3M6IEw1WCB0YWdzIGRvbid0IGhhdmUgSUVDIGhhcmR3YXJlIGFkZHJlc3NlcyBcdTIwMTQgdXNlIEFsaWFzRm9yIGlmIHByZXNlbnRcbiAgY29uc3QgYWxpYXNGb3IgPSBhdHRyKHRhZ0VsLCAnQWxpYXNGb3InKTtcbiAgY29uc3QgYWRkcmVzcyA9IGFsaWFzRm9yIHx8IHVuZGVmaW5lZDtcblxuICAvLyBSZXRhaW46IGRldGVybWluZWQgYnkgcGFyZW50IDxUYWdzIFVzZT1cIlJldGFpblwiPiBvciBpbmRpdmlkdWFsIHRhZydzIENvbnN0YW50IGF0dHJpYnV0ZVxuICBjb25zdCByZXRhaW4gPSBwYXJlbnRSZXRhaW4gfHwgZmFsc2U7XG5cbiAgcmV0dXJuIHtcbiAgICBuYW1lLFxuICAgIGRhdGFUeXBlLFxuICAgIGRlc2NyaXB0aW9uOiBkZXNjIHx8IHVuZGVmaW5lZCxcbiAgICBhZGRyZXNzLFxuICAgIGluaXRpYWxWYWx1ZTogcGFyc2VMNVhWYWx1ZShjaGlsZCh0YWdFbCwgJ0RlZmF1bHREYXRhJykgPz8gY2hpbGQodGFnRWwsICdEYXRhJykpLFxuICAgIHJldGFpbixcbiAgfTtcbn1cblxuZnVuY3Rpb24gcGFyc2VMNVhWYWx1ZShkYXRhRWw6IHVua25vd24pOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICBpZiAoIWRhdGFFbCkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgY29uc3QgdiA9IHRleHQoZGF0YUVsKTtcbiAgcmV0dXJuIHYgfHwgdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBwYXJzZUw1WFByb2dyYW0ocHJvZ3JhbUVsOiB1bmtub3duLCB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10sIHdhcm5pbmdzOiBzdHJpbmdbXSk6IE5vcm1hbGl6ZWRQT1VbXSB7XG4gIGlmICghcHJvZ3JhbUVsIHx8IHR5cGVvZiBwcm9ncmFtRWwgIT09ICdvYmplY3QnKSByZXR1cm4gW107XG4gIGNvbnN0IHByb2dyYW1OYW1lID0gYXR0cihwcm9ncmFtRWwsICdOYW1lJyk7XG5cbiAgLy8gUHJvZ3JhbS1zY29wZSB0YWdzXG4gIGNvbnN0IGxvY2FsVGFnczogTm9ybWFsaXplZFRhZ1tdID0gW107XG4gIGNvbnN0IHByb2dUYWdzRWwgPSBjaGlsZChwcm9ncmFtRWwsICdUYWdzJykgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCB1bmRlZmluZWQ7XG4gIGNvbnN0IHByb2dSZXRhaW4gPSBwcm9nVGFnc0VsID8gYXR0cihwcm9nVGFnc0VsLCAnVXNlJykgPT09ICdSZXRhaW4nIDogZmFsc2U7XG4gIGZvciAoY29uc3QgdGFnRWwgb2YgY2hpbGRBcnJheShwcm9nVGFnc0VsLCAnVGFnJykpIHtcbiAgICBjb25zdCB0YWcgPSBwYXJzZUw1WFRhZyh0YWdFbCwgcHJvZ1JldGFpbiwgdW5tYXBwZWQpO1xuICAgIGlmICh0YWcpIGxvY2FsVGFncy5wdXNoKHRhZyk7XG4gIH1cblxuICBjb25zdCBwb3VzOiBOb3JtYWxpemVkUE9VW10gPSBbXTtcbiAgZm9yIChjb25zdCByb3V0aW5lRWwgb2YgY2hpbGRBcnJheShjaGlsZChwcm9ncmFtRWwsICdSb3V0aW5lcycpLCAnUm91dGluZScpKSB7XG4gICAgY29uc3Qgcm91dGluZU5hbWUgPSBhdHRyKHJvdXRpbmVFbCwgJ05hbWUnKTtcbiAgICBjb25zdCByb3V0aW5lVHlwZSA9IGF0dHIocm91dGluZUVsLCAnVHlwZScpIHx8ICdSTEwnO1xuXG4gICAgLy8gQnVpbGQgcmVzb2x2ZXIgb25jZSBcdTIwMTQgc2hhcmVkIGJ5IGFsbCByb3V0aW5lcyBpbiB0aGlzIHByb2dyYW1cbiAgICBjb25zdCByZXNvbHZlciA9IGJ1aWxkUmVzb2x2ZXIobG9jYWxUYWdzLCBbXSk7XG5cbiAgICBpZiAocm91dGluZVR5cGUgPT09ICdSTEwnKSB7XG4gICAgICBjb25zdCBsYWRkZXIgPSBwYXJzZUw1WFJMTChyb3V0aW5lRWwsIHVubWFwcGVkLCB3YXJuaW5ncyk7XG4gICAgICBwb3VzLnB1c2goe1xuICAgICAgICBpZDogYHBvdS0ke3Byb2dyYW1OYW1lfS0ke3JvdXRpbmVOYW1lfWAsXG4gICAgICAgIG5hbWU6IGAke3Byb2dyYW1OYW1lfV8ke3JvdXRpbmVOYW1lfWAsXG4gICAgICAgIGxhbmd1YWdlOiAnTEQnLFxuICAgICAgICBsYWRkZXJQcm9ncmFtOiBsYWRkZXIsXG4gICAgICAgIGxvY2FsVGFncyxcbiAgICAgICAgcG91VHlwZTogJ3Byb2dyYW0nLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmIChyb3V0aW5lVHlwZSA9PT0gJ0ZCRCcpIHtcbiAgICAgIGNvbnN0IGZiZCA9IHBhcnNlTDVYRkJEKHJvdXRpbmVFbCwgdW5tYXBwZWQsIHdhcm5pbmdzLCByZXNvbHZlcik7XG4gICAgICBpZiAoZmJkKSB7XG4gICAgICAgIHBvdXMucHVzaCh7XG4gICAgICAgICAgaWQ6IGBwb3UtJHtwcm9ncmFtTmFtZX0tJHtyb3V0aW5lTmFtZX1gLFxuICAgICAgICAgIG5hbWU6IGAke3Byb2dyYW1OYW1lfV8ke3JvdXRpbmVOYW1lfWAsXG4gICAgICAgICAgbGFuZ3VhZ2U6ICdGQkQnLFxuICAgICAgICAgIGZiZFByb2dyYW06IGZiZCxcbiAgICAgICAgICBsb2NhbFRhZ3MsXG4gICAgICAgICAgcG91VHlwZTogJ3Byb2dyYW0nLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHdhcm5pbmdzLnB1c2goYFJvdXRpbmUgXCIke3JvdXRpbmVOYW1lfVwiIGlzIEZCRCBcdTIwMTQgcHJlc2VydmVkIGluIHNpZGVjYXIuYCk7XG4gICAgICAgIHVubWFwcGVkLnB1c2goeyBjbG1Ob2RlSWQ6IG51bGwsIHZlbmRvclNwZWNpZmljRGF0YTogcm91dGluZUVsLCByZWFzb246IGBGQkQgcm91dGluZTogJHtyb3V0aW5lTmFtZX1gIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAocm91dGluZVR5cGUgPT09ICdTVCcpIHtcbiAgICAgIGNvbnN0IHN0Q29udGVudEVsID0gY2hpbGQocm91dGluZUVsLCAnU1RDb250ZW50Jyk7XG4gICAgICBsZXQgc3RTb3VyY2UgPSAnJztcbiAgICAgIGlmIChzdENvbnRlbnRFbCkge1xuICAgICAgICAvLyBSZWFsIEw1WCBmb3JtYXQ6IDxMaW5lIE51bWJlcj1cIk5cIj48IVtDREFUQVtjb2RlXV0+PC9MaW5lPiBlbGVtZW50c1xuICAgICAgICBjb25zdCBsaW5lcyA9IGNoaWxkQXJyYXkoc3RDb250ZW50RWwsICdMaW5lJyk7XG4gICAgICAgIGlmIChsaW5lcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgLy8gUGFyc2UgbGluZS1ieS1saW5lLCBwcmVzZXJ2aW5nIGxpbmUgbnVtYmVycyAoZ2FwcyBiZWNvbWUgZW1wdHkgbGluZXMpXG4gICAgICAgICAgY29uc3QgbGluZU1hcDogTWFwPG51bWJlciwgc3RyaW5nPiA9IG5ldyBNYXAoKTtcbiAgICAgICAgICBsZXQgbWF4TGluZSA9IDA7XG4gICAgICAgICAgZm9yIChjb25zdCBsaW5lRWwgb2YgbGluZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IG51bSA9IE51bWJlcihhdHRyKGxpbmVFbCwgJ051bWJlcicpKSB8fCAwO1xuICAgICAgICAgICAgY29uc3QgbGluZVRleHQgPSB0ZXh0KGxpbmVFbCkgfHwgJyc7XG4gICAgICAgICAgICBsaW5lTWFwLnNldChudW0sIHVuZXNjYXBlWE1MKGxpbmVUZXh0KSk7XG4gICAgICAgICAgICBpZiAobnVtID4gbWF4TGluZSkgbWF4TGluZSA9IG51bTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3Qgc3RMaW5lczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICBmb3IgKGxldCBuID0gMDsgbiA8PSBtYXhMaW5lOyBuKyspIHtcbiAgICAgICAgICAgIHN0TGluZXMucHVzaChsaW5lTWFwLmdldChuKSA/PyAnJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHN0U291cmNlID0gc3RMaW5lcy5qb2luKCdcXG4nKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBGYWxsYmFjazogc2luZ2xlIENEQVRBIHRleHQgYmxvYlxuICAgICAgICAgIGNvbnN0IHJhd1N0ID0gdGV4dChzdENvbnRlbnRFbCk7XG4gICAgICAgICAgc3RTb3VyY2UgPSByYXdTdCA/IHVuZXNjYXBlWE1MKHJhd1N0KSA6ICcnO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBwb3VzLnB1c2goe1xuICAgICAgICBpZDogYHBvdS0ke3Byb2dyYW1OYW1lfS0ke3JvdXRpbmVOYW1lfWAsXG4gICAgICAgIG5hbWU6IGAke3Byb2dyYW1OYW1lfV8ke3JvdXRpbmVOYW1lfWAsXG4gICAgICAgIGxhbmd1YWdlOiAnU1QnLFxuICAgICAgICBzdFNvdXJjZSxcbiAgICAgICAgbG9jYWxUYWdzLFxuICAgICAgICBwb3VUeXBlOiAncHJvZ3JhbScsXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKHJvdXRpbmVUeXBlID09PSAnU0ZDJykge1xuICAgICAgLy8gUGFyc2UgU0ZDIHJvdXRpbmUgXHUyMDE0IHByZXNlcnZlIHN0cnVjdHVyZSBpbiBzaWRlY2FyIGJ1dCBhbHNvIGNyZWF0ZSBhIFBPVVxuICAgICAgY29uc3Qgc2ZjQ29udGVudEVsID0gY2hpbGQocm91dGluZUVsLCAnU0ZDQ29udGVudCcpO1xuICAgICAgLy8gRXh0cmFjdCBhbnkgU1QgY29kZSBmcm9tIHRyYW5zaXRpb24gY29uZGl0aW9ucyBhcyBjb21iaW5lZCBTVCBzb3VyY2VcbiAgICAgIGNvbnN0IHN0TGluZXM6IHN0cmluZ1tdID0gW107XG4gICAgICBpZiAoc2ZjQ29udGVudEVsKSB7XG4gICAgICAgIGZvciAoY29uc3QgdHJhbnNFbCBvZiBjaGlsZEFycmF5KHNmY0NvbnRlbnRFbCwgJ1RyYW5zaXRpb24nKSkge1xuICAgICAgICAgIGNvbnN0IGNvbmRFbCA9IGNoaWxkKHRyYW5zRWwsICdDb25kaXRpb24nKTtcbiAgICAgICAgICBjb25zdCBjb25kU3RFbCA9IGNvbmRFbCA/IGNoaWxkKGNvbmRFbCwgJ1NUQ29udGVudCcpIDogbnVsbDtcbiAgICAgICAgICBpZiAoY29uZFN0RWwpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbmRMaW5lcyA9IGNoaWxkQXJyYXkoY29uZFN0RWwsICdMaW5lJyk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGxpbmVFbCBvZiBjb25kTGluZXMpIHtcbiAgICAgICAgICAgICAgY29uc3QgbHQgPSB0ZXh0KGxpbmVFbCkgfHwgJyc7XG4gICAgICAgICAgICAgIGlmIChsdCkgc3RMaW5lcy5wdXNoKHVuZXNjYXBlWE1MKGx0KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBTdG9yZSB0aGUgZnVsbCBTRkMgWE1MIGluIHVubWFwcGVkIGZvciBsb3NzbGVzcyByb3VuZC10cmlwXG4gICAgICB1bm1hcHBlZC5wdXNoKHsgY2xtTm9kZUlkOiBudWxsLCB2ZW5kb3JTcGVjaWZpY0RhdGE6IHJvdXRpbmVFbCwgcmVhc29uOiBgU0ZDIHJvdXRpbmU6ICR7cm91dGluZU5hbWV9YCB9KTtcbiAgICAgIHBvdXMucHVzaCh7XG4gICAgICAgIGlkOiBgcG91LSR7cHJvZ3JhbU5hbWV9LSR7cm91dGluZU5hbWV9YCxcbiAgICAgICAgbmFtZTogYCR7cHJvZ3JhbU5hbWV9XyR7cm91dGluZU5hbWV9YCxcbiAgICAgICAgbGFuZ3VhZ2U6ICdTVCcsXG4gICAgICAgIHN0U291cmNlOiBzdExpbmVzLmxlbmd0aCA+IDAgPyBgLy8gU0ZDIFRyYW5zaXRpb24gY29uZGl0aW9ucyBmcm9tICR7cm91dGluZU5hbWV9XFxuJHtzdExpbmVzLmpvaW4oJ1xcbicpfWAgOiBgLy8gU0ZDIHJvdXRpbmU6ICR7cm91dGluZU5hbWV9IChzdHJ1Y3R1cmUgcHJlc2VydmVkIGluIHNpZGVjYXIpYCxcbiAgICAgICAgbG9jYWxUYWdzLFxuICAgICAgICBwb3VUeXBlOiAncHJvZ3JhbScsXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdW5tYXBwZWQucHVzaCh7IGNsbU5vZGVJZDogbnVsbCwgdmVuZG9yU3BlY2lmaWNEYXRhOiByb3V0aW5lRWwsIHJlYXNvbjogYFVuc3VwcG9ydGVkIHJvdXRpbmUgdHlwZTogJHtyb3V0aW5lVHlwZX1gIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwb3VzO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgUkxMIChSZWxheSBMYWRkZXIgTG9naWMpIHBhcnNlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gcGFyc2VMNVhSTEwocm91dGluZUVsOiB1bmtub3duLCB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10sIHdhcm5pbmdzOiBzdHJpbmdbXSk6IExhZGRlclByb2dyYW0ge1xuICBjb25zdCBydW5nczogUnVuZ1tdID0gW107XG4gIGNvbnN0IHJsbEVsID0gY2hpbGQocm91dGluZUVsLCAnUkxMQ29udGVudCcpO1xuXG4gIGZvciAoY29uc3QgcnVuZ0VsIG9mIGNoaWxkQXJyYXkocmxsRWwsICdSdW5nJykpIHtcbiAgICBjb25zdCBudW1iZXIgPSBOdW1iZXIoYXR0cihydW5nRWwsICdOdW1iZXInKSkgfHwgcnVuZ3MubGVuZ3RoO1xuICAgIGNvbnN0IHJ1bmdUeXBlID0gYXR0cihydW5nRWwsICdUeXBlJykgfHwgJ04nO1xuICAgIGNvbnN0IGNvbW1lbnQgPSB0ZXh0KGNoaWxkKHJ1bmdFbCwgJ0NvbW1lbnQnKSk7XG4gICAgY29uc3QgdGV4dENvbnRlbnQgPSB0ZXh0KGNoaWxkKHJ1bmdFbCwgJ1RleHQnKSk7XG5cbiAgICBjb25zdCB7IGVsZW1lbnRzLCBicmFuY2hlcyB9ID0gcGFyc2VSdW5nVGV4dCh0ZXh0Q29udGVudCwgbnVtYmVyLCB1bm1hcHBlZCwgd2FybmluZ3MpO1xuICAgIHJ1bmdzLnB1c2goe1xuICAgICAgaWQ6IGBydW5nLSR7bnVtYmVyfWAsXG4gICAgICBudW1iZXIsXG4gICAgICBjb21tZW50OiBjb21tZW50IHx8ICcnLFxuICAgICAgZWxlbWVudHMsXG4gICAgICBicmFuY2hlcyxcbiAgICAgIHZlbmRvclR5cGU6IHJ1bmdUeXBlLFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHsgcnVuZ3MgfTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFJ1bmcgdGV4dCBwYXJzZXIgd2l0aCBCU1QvTlhCL0JORCBicmFuY2ggc3VwcG9ydCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuaW50ZXJmYWNlIFBhcnNlZFJ1bmcge1xuICBlbGVtZW50czogTGFkZGVyRWxlbWVudFtdO1xuICBicmFuY2hlczogQnJhbmNoW107XG59XG5cbmZ1bmN0aW9uIHBhcnNlUnVuZ1RleHQoXG4gIHJ1bmdUZXh0OiBzdHJpbmcsXG4gIHJ1bmdOdW1iZXI6IG51bWJlcixcbiAgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdLFxuICB3YXJuaW5nczogc3RyaW5nW11cbik6IFBhcnNlZFJ1bmcge1xuICBpZiAoIXJ1bmdUZXh0KSByZXR1cm4geyBlbGVtZW50czogW10sIGJyYW5jaGVzOiBbXSB9O1xuXG4gIGNvbnN0IHN0cmlwcGVkID0gcnVuZ1RleHQudHJpbSgpLnJlcGxhY2UoLzskLywgJycpO1xuXG4gIC8vIEw1WCBuZXV0cmFsIHRleHQgdXNlcyBbbGVnMSAsbGVnMiBdY29udGludWF0aW9uIGJyYWNrZXQgc3ludGF4IGZvciBwYXJhbGxlbCBicmFuY2hlcy5cbiAgLy8gUHJlLXByb2Nlc3MgdG8gc3BsaXQgaW50bzogcHJlLWJyYW5jaCBtYWluIGVsZW1lbnRzICsgcGFyYWxsZWwgbGVncyArIHBvc3QtYnJhbmNoIGVsZW1lbnRzLlxuICByZXR1cm4gcGFyc2VCcmFja2V0QnJhbmNoVGV4dChzdHJpcHBlZCwgcnVuZ051bWJlciwgdW5tYXBwZWQsIHdhcm5pbmdzKTtcbn1cblxuaW50ZXJmYWNlIEluc3RyVG9rZW4ge1xuICBpbnN0cjogc3RyaW5nO1xuICBhcmdzOiBzdHJpbmdbXTtcbn1cblxuZnVuY3Rpb24gdG9rZW5pemVSdW5nVGV4dCh0ZXh0OiBzdHJpbmcpOiBJbnN0clRva2VuW10ge1xuICBjb25zdCB0b2tlbnM6IEluc3RyVG9rZW5bXSA9IFtdO1xuICAvLyBNYXRjaCBpbnN0cnVjdGlvbnMgXHUyMDE0IHN1cHBvcnRzIG1peGVkIGNhc2UsIG51bWJlcnMsIHVuZGVyc2NvcmVzIGluIGluc3RydWN0aW9uIG5hbWVzXG4gIC8vIGFuZCBoYW5kbGVzIG5lc3RlZCBwYXJlbnMgZm9yIGFycmF5IHN1YnNjcmlwdHMgbGlrZSBNT1RPUlswXS5TcGVlZFxuICBjb25zdCB0b2tlblBhdHRlcm4gPSAvKFtBLVphLXpfXVtBLVphLXowLTlfXSopKD86XFwoKFteKV0qKD86XFwoW14pXSpcXClbXildKikqKVxcKSk/L2c7XG4gIGxldCBtYXRjaDogUmVnRXhwRXhlY0FycmF5IHwgbnVsbDtcblxuICB3aGlsZSAoKG1hdGNoID0gdG9rZW5QYXR0ZXJuLmV4ZWModGV4dCkpICE9PSBudWxsKSB7XG4gICAgY29uc3QgaW5zdHIgPSBtYXRjaFsxXS50b1VwcGVyQ2FzZSgpO1xuICAgIGNvbnN0IGFyZ3NTdHIgPSBtYXRjaFsyXSA/PyAnJztcbiAgICBjb25zdCBhcmdzID0gYXJnc1N0ciA/IHNwbGl0QXJncyhhcmdzU3RyKSA6IFtdO1xuICAgIHRva2Vucy5wdXNoKHsgaW5zdHIsIGFyZ3MgfSk7XG4gIH1cbiAgcmV0dXJuIHRva2Vucztcbn1cblxuZnVuY3Rpb24gc3BsaXRBcmdzKGFyZ3NTdHI6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgY29uc3QgYXJnczogc3RyaW5nW10gPSBbXTtcbiAgbGV0IGN1cnJlbnQgPSAnJztcbiAgbGV0IGRlcHRoID0gMDtcbiAgZm9yIChjb25zdCBjaCBvZiBhcmdzU3RyKSB7XG4gICAgaWYgKGNoID09PSAnKCcgfHwgY2ggPT09ICdbJykgeyBkZXB0aCsrOyBjdXJyZW50ICs9IGNoOyB9XG4gICAgZWxzZSBpZiAoY2ggPT09ICcpJyB8fCBjaCA9PT0gJ10nKSB7IGRlcHRoLS07IGN1cnJlbnQgKz0gY2g7IH1cbiAgICBlbHNlIGlmIChjaCA9PT0gJywnICYmIGRlcHRoID09PSAwKSB7IGFyZ3MucHVzaChjdXJyZW50LnRyaW0oKSk7IGN1cnJlbnQgPSAnJzsgfVxuICAgIGVsc2UgeyBjdXJyZW50ICs9IGNoOyB9XG4gIH1cbiAgaWYgKGN1cnJlbnQudHJpbSgpKSBhcmdzLnB1c2goY3VycmVudC50cmltKCkpO1xuICByZXR1cm4gYXJncztcbn1cblxuLy8gUGFyc2UgTDVYIG5ldXRyYWwgdGV4dCBydW5nIHdpdGggW2xlZzEgLGxlZzIgXSBicmFja2V0IGJyYW5jaCBzeW50YXguXG4vLyBIYW5kbGVzIG5lc3RlZCBicmFja2V0cyAoYnJhbmNoZXMgd2l0aGluIGJyYW5jaGVzKSBieSBwcm9jZXNzaW5nIG91dGVybW9zdCBmaXJzdC5cbmZ1bmN0aW9uIHBhcnNlQnJhY2tldEJyYW5jaFRleHQoXG4gIHRleHQ6IHN0cmluZyxcbiAgcnVuZ051bWJlcjogbnVtYmVyLFxuICB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10sXG4gIHdhcm5pbmdzOiBzdHJpbmdbXVxuKTogUGFyc2VkUnVuZyB7XG4gIC8vIEZpbmQgb3V0ZXJtb3N0IFsgXSBicmFja2V0IGdyb3VwcywgcmVzcGVjdGluZyBwYXJlbiBuZXN0aW5nIGluc2lkZVxuICBjb25zdCBhbGxFbGVtZW50czogTGFkZGVyRWxlbWVudFtdID0gW107XG4gIGNvbnN0IGFsbEJyYW5jaGVzOiBCcmFuY2hbXSA9IFtdO1xuICBsZXQgcG9zWCA9IDA7XG4gIGxldCBpID0gMDtcblxuICB3aGlsZSAoaSA8IHRleHQubGVuZ3RoKSB7XG4gICAgLy8gRmluZCBuZXh0IFsgdGhhdCBpcyBub3QgaW5zaWRlIHBhcmVudGhlc2VzXG4gICAgbGV0IHBhcmVuRGVwdGggPSAwO1xuICAgIGxldCBicmFja2V0U3RhcnQgPSAtMTtcbiAgICBmb3IgKGxldCBqID0gaTsgaiA8IHRleHQubGVuZ3RoOyBqKyspIHtcbiAgICAgIGNvbnN0IGNoID0gdGV4dFtqXTtcbiAgICAgIGlmIChjaCA9PT0gJygnKSBwYXJlbkRlcHRoKys7XG4gICAgICBlbHNlIGlmIChjaCA9PT0gJyknKSBwYXJlbkRlcHRoLS07XG4gICAgICBlbHNlIGlmIChjaCA9PT0gJ1snICYmIHBhcmVuRGVwdGggPT09IDApIHsgYnJhY2tldFN0YXJ0ID0gajsgYnJlYWs7IH1cbiAgICB9XG5cbiAgICBpZiAoYnJhY2tldFN0YXJ0ID09PSAtMSkge1xuICAgICAgLy8gTm8gbW9yZSBicmFja2V0cyBcdTIwMTQgdG9rZW5pemUgcmVtYWluaW5nIHRleHQgYXMgbWFpbiBlbGVtZW50c1xuICAgICAgY29uc3QgbWFpblBhcnQgPSB0ZXh0LnNsaWNlKGkpLnRyaW0oKTtcbiAgICAgIGlmIChtYWluUGFydCkge1xuICAgICAgICBjb25zdCB0b2tlbnMgPSB0b2tlbml6ZVJ1bmdUZXh0KG1haW5QYXJ0KTtcbiAgICAgICAgZm9yIChjb25zdCB0b2sgb2YgdG9rZW5zKSB7XG4gICAgICAgICAgY29uc3QgZWwgPSBtYXBMNVhJbnN0cnVjdGlvbih0b2suaW5zdHIsIHRvay5hcmdzLCBwb3NYLCBydW5nTnVtYmVyLCB1bm1hcHBlZCwgd2FybmluZ3MpO1xuICAgICAgICAgIGlmIChlbCkgeyBhbGxFbGVtZW50cy5wdXNoKGVsKTsgcG9zWCArPSA2MDsgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyBUb2tlbml6ZSB0aGUgdGV4dCBiZWZvcmUgdGhlIGJyYWNrZXQgYXMgbWFpbiBlbGVtZW50c1xuICAgIGNvbnN0IHByZVBhcnQgPSB0ZXh0LnNsaWNlKGksIGJyYWNrZXRTdGFydCkudHJpbSgpO1xuICAgIGlmIChwcmVQYXJ0KSB7XG4gICAgICBjb25zdCB0b2tlbnMgPSB0b2tlbml6ZVJ1bmdUZXh0KHByZVBhcnQpO1xuICAgICAgZm9yIChjb25zdCB0b2sgb2YgdG9rZW5zKSB7XG4gICAgICAgIGNvbnN0IGVsID0gbWFwTDVYSW5zdHJ1Y3Rpb24odG9rLmluc3RyLCB0b2suYXJncywgcG9zWCwgcnVuZ051bWJlciwgdW5tYXBwZWQsIHdhcm5pbmdzKTtcbiAgICAgICAgaWYgKGVsKSB7IGFsbEVsZW1lbnRzLnB1c2goZWwpOyBwb3NYICs9IDYwOyB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRmluZCB0aGUgbWF0Y2hpbmcgY2xvc2luZyBicmFja2V0LCByZXNwZWN0aW5nIG5lc3RlZCBwYXJlbnMgQU5EIG5lc3RlZCBicmFja2V0c1xuICAgIGxldCBkZXB0aCA9IDA7XG4gICAgbGV0IHBhcmVuRCA9IDA7XG4gICAgbGV0IGJyYWNrZXRFbmQgPSAtMTtcbiAgICBmb3IgKGxldCBqID0gYnJhY2tldFN0YXJ0OyBqIDwgdGV4dC5sZW5ndGg7IGorKykge1xuICAgICAgY29uc3QgY2ggPSB0ZXh0W2pdO1xuICAgICAgaWYgKGNoID09PSAnKCcpIHBhcmVuRCsrO1xuICAgICAgZWxzZSBpZiAoY2ggPT09ICcpJykgcGFyZW5ELS07XG4gICAgICBlbHNlIGlmIChjaCA9PT0gJ1snICYmIHBhcmVuRCA9PT0gMCkgZGVwdGgrKztcbiAgICAgIGVsc2UgaWYgKGNoID09PSAnXScgJiYgcGFyZW5EID09PSAwKSB7IGRlcHRoLS07IGlmIChkZXB0aCA9PT0gMCkgeyBicmFja2V0RW5kID0gajsgYnJlYWs7IH0gfVxuICAgIH1cbiAgICBpZiAoYnJhY2tldEVuZCA9PT0gLTEpIHsgaSA9IGJyYWNrZXRTdGFydCArIDE7IGNvbnRpbnVlOyB9XG5cbiAgICAvLyBTcGxpdCB0aGUgYnJhY2tldCBjb250ZW50cyBieSB0b3AtbGV2ZWwgY29tbWFzIChwYXJhbGxlbCBsZWdzKVxuICAgIGNvbnN0IGJyYWNrZXRDb250ZW50ID0gdGV4dC5zbGljZShicmFja2V0U3RhcnQgKyAxLCBicmFja2V0RW5kKTtcbiAgICBjb25zdCBsZWdzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGxldCBsZWdTdGFydCA9IDA7XG4gICAgbGV0IHBkID0gMDsgbGV0IGJkID0gMDtcbiAgICBmb3IgKGxldCBqID0gMDsgaiA8IGJyYWNrZXRDb250ZW50Lmxlbmd0aDsgaisrKSB7XG4gICAgICBjb25zdCBjaCA9IGJyYWNrZXRDb250ZW50W2pdO1xuICAgICAgaWYgKGNoID09PSAnKCcpIHBkKys7XG4gICAgICBlbHNlIGlmIChjaCA9PT0gJyknKSBwZC0tO1xuICAgICAgZWxzZSBpZiAoY2ggPT09ICdbJykgYmQrKztcbiAgICAgIGVsc2UgaWYgKGNoID09PSAnXScpIGJkLS07XG4gICAgICBlbHNlIGlmIChjaCA9PT0gJywnICYmIHBkID09PSAwICYmIGJkID09PSAwKSB7XG4gICAgICAgIGxlZ3MucHVzaChicmFja2V0Q29udGVudC5zbGljZShsZWdTdGFydCwgaikudHJpbSgpKTtcbiAgICAgICAgbGVnU3RhcnQgPSBqICsgMTtcbiAgICAgIH1cbiAgICB9XG4gICAgbGVncy5wdXNoKGJyYWNrZXRDb250ZW50LnNsaWNlKGxlZ1N0YXJ0KS50cmltKCkpO1xuXG4gICAgLy8gRmlyc3QgbGVnID0gY29udGludWF0aW9uIG9mIG1haW4gcGF0aCwgcmVtYWluaW5nIGxlZ3MgPSBCcmFuY2ggZWxlbWVudHNcbiAgICBjb25zdCBqb2luTm9kZUlkID0gYWxsRWxlbWVudHMubGVuZ3RoID4gMCA/IGFsbEVsZW1lbnRzW2FsbEVsZW1lbnRzLmxlbmd0aCAtIDFdLmlkIDogYHJ1bmcke3J1bmdOdW1iZXJ9LXJhaWxgO1xuICAgIGNvbnN0IGxlZ0VsZW1lbnRzOiBMYWRkZXJFbGVtZW50W11bXSA9IGxlZ3MubWFwKGxlZyA9PiB7XG4gICAgICBjb25zdCBsZWdUb2tlbnMgPSB0b2tlbml6ZVJ1bmdUZXh0KGxlZyk7XG4gICAgICBjb25zdCBlbGVtZW50czogTGFkZGVyRWxlbWVudFtdID0gW107XG4gICAgICBsZXQgbHggPSBwb3NYO1xuICAgICAgZm9yIChjb25zdCB0b2sgb2YgbGVnVG9rZW5zKSB7XG4gICAgICAgIGNvbnN0IGVsID0gbWFwTDVYSW5zdHJ1Y3Rpb24odG9rLmluc3RyLCB0b2suYXJncywgbHgsIHJ1bmdOdW1iZXIsIHVubWFwcGVkLCB3YXJuaW5ncyk7XG4gICAgICAgIGlmIChlbCkgeyBlbGVtZW50cy5wdXNoKGVsKTsgbHggKz0gNjA7IH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBlbGVtZW50cztcbiAgICB9KTtcblxuICAgIC8vIFB1c2ggZmlyc3QgbGVnIGVsZW1lbnRzIGludG8gbWFpbiBwYXRoXG4gICAgZm9yIChjb25zdCBlbCBvZiBsZWdFbGVtZW50c1swXSA/PyBbXSkgeyBhbGxFbGVtZW50cy5wdXNoKGVsKTsgfVxuICAgIGlmIChsZWdFbGVtZW50c1swXT8ubGVuZ3RoKSBwb3NYICs9IGxlZ0VsZW1lbnRzWzBdLmxlbmd0aCAqIDYwO1xuXG4gICAgLy8gUmVtYWluaW5nIGxlZ3MgYXJlIGJyYW5jaGVzXG4gICAgZm9yIChsZXQgbGkgPSAxOyBsaSA8IGxlZ0VsZW1lbnRzLmxlbmd0aDsgbGkrKykge1xuICAgICAgY29uc3QgbGVnRWxzID0gbGVnRWxlbWVudHNbbGldO1xuICAgICAgaWYgKGxlZ0Vscy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGFsbEJyYW5jaGVzLnB1c2goe1xuICAgICAgICAgIGlkOiBgcnVuZyR7cnVuZ051bWJlcn0tYnJhbmNoLSR7YWxsQnJhbmNoZXMubGVuZ3RofWAsXG4gICAgICAgICAgc3RhcnROb2RlSWQ6IGpvaW5Ob2RlSWQsXG4gICAgICAgICAgZW5kTm9kZUlkOiBsZWdFbHNbbGVnRWxzLmxlbmd0aCAtIDFdLmlkLFxuICAgICAgICAgIGVsZW1lbnRzOiBsZWdFbHMsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGkgPSBicmFja2V0RW5kICsgMTtcbiAgfVxuXG4gIHJldHVybiB7IGVsZW1lbnRzOiBhbGxFbGVtZW50cywgYnJhbmNoZXM6IGFsbEJyYW5jaGVzIH07XG59XG5cbmZ1bmN0aW9uIHBhcnNlVG9rZW5zV2l0aEJyYW5jaGVzKFxuICB0b2tlbnM6IEluc3RyVG9rZW5bXSxcbiAgcnVuZ051bWJlcjogbnVtYmVyLFxuICB1bm1hcHBlZDogVW5tYXBwZWRFbGVtZW50W10sXG4gIHdhcm5pbmdzOiBzdHJpbmdbXVxuKTogUGFyc2VkUnVuZyB7XG4gIGNvbnN0IG1haW5FbGVtZW50czogTGFkZGVyRWxlbWVudFtdID0gW107XG4gIGNvbnN0IGJyYW5jaGVzOiBCcmFuY2hbXSA9IFtdO1xuICBsZXQgcG9zWCA9IDA7XG4gIGxldCBpID0gMDtcblxuICB3aGlsZSAoaSA8IHRva2Vucy5sZW5ndGgpIHtcbiAgICBjb25zdCB0b2tlbiA9IHRva2Vuc1tpXTtcblxuICAgIGlmICh0b2tlbi5pbnN0ciA9PT0gJ0JTVCcpIHtcbiAgICAgIC8vIFN0YXJ0IG9mIGEgYnJhbmNoIHNldCBcdTIwMTQgY29sbGVjdCBhbGwgYnJhbmNoZXMgdW50aWwgQk5EXG4gICAgICBjb25zdCBicmFuY2hTZXQgPSBwYXJzZUJyYW5jaFNldCh0b2tlbnMsIGksIHJ1bmdOdW1iZXIsIHVubWFwcGVkLCB3YXJuaW5ncyk7XG4gICAgICBicmFuY2hlcy5wdXNoKC4uLmJyYW5jaFNldC5icmFuY2hlcyk7XG4gICAgICBpID0gYnJhbmNoU2V0LmVuZEluZGV4O1xuICAgICAgcG9zWCArPSA2MDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZWwgPSBtYXBMNVhJbnN0cnVjdGlvbih0b2tlbi5pbnN0ciwgdG9rZW4uYXJncywgcG9zWCwgcnVuZ051bWJlciwgdW5tYXBwZWQsIHdhcm5pbmdzKTtcbiAgICAgIGlmIChlbCkge1xuICAgICAgICBtYWluRWxlbWVudHMucHVzaChlbCk7XG4gICAgICAgIHBvc1ggKz0gNjA7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgZWxlbWVudHM6IG1haW5FbGVtZW50cywgYnJhbmNoZXMgfTtcbn1cblxuaW50ZXJmYWNlIEJyYW5jaFNldFJlc3VsdCB7XG4gIGJyYW5jaGVzOiBCcmFuY2hbXTtcbiAgZW5kSW5kZXg6IG51bWJlcjtcbn1cblxuZnVuY3Rpb24gcGFyc2VCcmFuY2hTZXQoXG4gIHRva2VuczogSW5zdHJUb2tlbltdLFxuICBzdGFydElkeDogbnVtYmVyLFxuICBydW5nTnVtYmVyOiBudW1iZXIsXG4gIHVubWFwcGVkOiBVbm1hcHBlZEVsZW1lbnRbXSxcbiAgd2FybmluZ3M6IHN0cmluZ1tdXG4pOiBCcmFuY2hTZXRSZXN1bHQge1xuICBjb25zdCBicmFuY2hlczogQnJhbmNoW10gPSBbXTtcbiAgbGV0IGkgPSBzdGFydElkeCArIDE7IC8vIHNraXAgQlNUXG4gIGxldCBjdXJyZW50QnJhbmNoRWxlbWVudHM6IExhZGRlckVsZW1lbnRbXSA9IFtdO1xuICBsZXQgYnJhbmNoUG9zWCA9IDA7XG4gIGxldCBicmFuY2hDb3VudCA9IDA7XG5cbiAgLy8gVGhlIGZpcnN0IGJyYW5jaCBzdGFydHMgaW1tZWRpYXRlbHkgYWZ0ZXIgQlNUXG4gIHdoaWxlIChpIDwgdG9rZW5zLmxlbmd0aCkge1xuICAgIGNvbnN0IHRva2VuID0gdG9rZW5zW2ldO1xuXG4gICAgaWYgKHRva2VuLmluc3RyID09PSAnTlhCJykge1xuICAgICAgLy8gRW5kIGN1cnJlbnQgYnJhbmNoLCBzdGFydCBuZXh0XG4gICAgICBpZiAoY3VycmVudEJyYW5jaEVsZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgYnJhbmNoZXMucHVzaCh7XG4gICAgICAgICAgaWQ6IHVpZChgYnJhbmNoLXIke3J1bmdOdW1iZXJ9YCksXG4gICAgICAgICAgc3RhcnROb2RlSWQ6IGBydW5nLSR7cnVuZ051bWJlcn0tYnJhbmNoLXN0YXJ0LSR7YnJhbmNoQ291bnR9YCxcbiAgICAgICAgICBlbmROb2RlSWQ6IGBydW5nLSR7cnVuZ051bWJlcn0tYnJhbmNoLWVuZC0ke2JyYW5jaENvdW50fWAsXG4gICAgICAgICAgZWxlbWVudHM6IGN1cnJlbnRCcmFuY2hFbGVtZW50cyxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBicmFuY2hDb3VudCsrO1xuICAgICAgY3VycmVudEJyYW5jaEVsZW1lbnRzID0gW107XG4gICAgICBicmFuY2hQb3NYID0gMDtcbiAgICAgIGkrKztcbiAgICB9IGVsc2UgaWYgKHRva2VuLmluc3RyID09PSAnQk5EJykge1xuICAgICAgLy8gRW5kIG9mIGJyYW5jaCBzZXQgXHUyMDE0IGNsb3NlIGxhc3QgYnJhbmNoXG4gICAgICBpZiAoY3VycmVudEJyYW5jaEVsZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgYnJhbmNoZXMucHVzaCh7XG4gICAgICAgICAgaWQ6IHVpZChgYnJhbmNoLXIke3J1bmdOdW1iZXJ9YCksXG4gICAgICAgICAgc3RhcnROb2RlSWQ6IGBydW5nLSR7cnVuZ051bWJlcn0tYnJhbmNoLXN0YXJ0LSR7YnJhbmNoQ291bnR9YCxcbiAgICAgICAgICBlbmROb2RlSWQ6IGBydW5nLSR7cnVuZ051bWJlcn0tYnJhbmNoLWVuZC0ke2JyYW5jaENvdW50fWAsXG4gICAgICAgICAgZWxlbWVudHM6IGN1cnJlbnRCcmFuY2hFbGVtZW50cyxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBpKys7IC8vIGNvbnN1bWUgQk5EXG4gICAgICBicmVhaztcbiAgICB9IGVsc2UgaWYgKHRva2VuLmluc3RyID09PSAnQlNUJykge1xuICAgICAgLy8gTmVzdGVkIGJyYW5jaCBcdTIwMTQgcmVjdXJzZVxuICAgICAgY29uc3QgbmVzdGVkID0gcGFyc2VCcmFuY2hTZXQodG9rZW5zLCBpLCBydW5nTnVtYmVyLCB1bm1hcHBlZCwgd2FybmluZ3MpO1xuICAgICAgLy8gRmxhdHRlbiBuZXN0ZWQgYnJhbmNoZXMgaW50byBjdXJyZW50IGJyYW5jaCAobmVzdGVkIHBhcmFsbGVsIGlzIHJhcmUgYnV0IHZhbGlkKVxuICAgICAgZm9yIChjb25zdCBuYiBvZiBuZXN0ZWQuYnJhbmNoZXMpIHtcbiAgICAgICAgY3VycmVudEJyYW5jaEVsZW1lbnRzLnB1c2goLi4ubmIuZWxlbWVudHMpO1xuICAgICAgfVxuICAgICAgaSA9IG5lc3RlZC5lbmRJbmRleDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZWwgPSBtYXBMNVhJbnN0cnVjdGlvbih0b2tlbi5pbnN0ciwgdG9rZW4uYXJncywgYnJhbmNoUG9zWCwgcnVuZ051bWJlciwgdW5tYXBwZWQsIHdhcm5pbmdzKTtcbiAgICAgIGlmIChlbCkge1xuICAgICAgICBjdXJyZW50QnJhbmNoRWxlbWVudHMucHVzaChlbCk7XG4gICAgICAgIGJyYW5jaFBvc1ggKz0gNjA7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG5cbiAgLy8gSWYgd2UgcmFuIG91dCBvZiB0b2tlbnMgd2l0aG91dCBCTkQgKG1hbGZvcm1lZCksIHN0aWxsIGNsb3NlXG4gIGlmIChjdXJyZW50QnJhbmNoRWxlbWVudHMubGVuZ3RoID4gMCkge1xuICAgIGJyYW5jaGVzLnB1c2goe1xuICAgICAgaWQ6IHVpZChgYnJhbmNoLXIke3J1bmdOdW1iZXJ9YCksXG4gICAgICBzdGFydE5vZGVJZDogYHJ1bmctJHtydW5nTnVtYmVyfS1icmFuY2gtc3RhcnQtJHticmFuY2hDb3VudH1gLFxuICAgICAgZW5kTm9kZUlkOiBgcnVuZy0ke3J1bmdOdW1iZXJ9LWJyYW5jaC1lbmQtJHticmFuY2hDb3VudH1gLFxuICAgICAgZWxlbWVudHM6IGN1cnJlbnRCcmFuY2hFbGVtZW50cyxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB7IGJyYW5jaGVzLCBlbmRJbmRleDogaSB9O1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgSW5zdHJ1Y3Rpb24gbWFwcGluZyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY29uc3QgTDVYX0NPTlRBQ1RfTUFQOiBSZWNvcmQ8c3RyaW5nLCBDb250YWN0VHlwZT4gPSB7XG4gIFhJQzogJ05PJyxcbiAgWElPOiAnTkMnLFxuICBPU1I6ICdQX0NPTlRBQ1QnLFxuICBPU0Y6ICdOX0NPTlRBQ1QnLFxuICBPTlM6ICdQX0NPTlRBQ1QnLCAgLy8gT25lLVNob3QgXHUyMDE0IG1hcHMgdG8gcmlzaW5nIGVkZ2UgY29udGFjdFxufTtcblxuY29uc3QgTDVYX0NPSUxfTUFQOiBSZWNvcmQ8c3RyaW5nLCBDb2lsVHlwZT4gPSB7XG4gIE9URTogJ25vcm1hbCcsXG4gIE9UTDogJ2xhdGNoJyxcbiAgT1RVOiAndW5sYXRjaCcsXG4gIE9UTjogJ25lZ2F0ZWQnLFxufTtcblxuY29uc3QgTDVYX1RJTUVSX01BUDogUmVjb3JkPHN0cmluZywgRkJUeXBlPiA9IHtcbiAgVE9OOiAnVE9OJywgVE9GOiAnVE9GJywgUlRPOiAnVE9OJywgVFA6ICdUUCcsIFRPTlI6ICdUT05SJyxcbn07XG5cbmNvbnN0IEw1WF9DT1VOVEVSX01BUDogUmVjb3JkPHN0cmluZywgRkJUeXBlPiA9IHtcbiAgQ1RVOiAnQ1RVJywgQ1REOiAnQ1REJywgQ1RVRDogJ0NUVUQnLFxufTtcblxuLy8gQ29tcGFyaXNvbiBpbnN0cnVjdGlvbnM6IHRoZXNlIGFjdCBhcyBjb250YWN0cyB0aGF0IGVuZXJnaXplIHdoZW4gY29uZGl0aW9uIGlzIHRydWVcbmNvbnN0IEw1WF9DT01QQVJFX01BUDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgRVFVOiAnRVEnLCBORVE6ICdORScsIEdSVDogJ0dUJywgR0VROiAnR0UnLCBMRVM6ICdMVCcsIExFUTogJ0xFJyxcbiAgTElNOiAnTElNSVQnLCBNRVE6ICdFUScsXG4gIC8vIFNob3J0IGFsaWFzZXMgdXNlZCBpbiBzb21lIEw1WCBleHBvcnRzXG4gIEVROiAnRVEnLCBORTogJ05FJywgR1Q6ICdHVCcsIEdFOiAnR0UnLCBMVDogJ0xUJywgTEU6ICdMRScsXG4gIC8vIENNUCBcdTIwMTQgZ2VuZXJpYyBjb21wYXJlIHdpdGggZXhwcmVzc2lvbiBzdHJpbmdcbiAgQ01QOiAnRVEnLFxufTtcblxuLy8gTWF0aCBpbnN0cnVjdGlvbnM6IHRoZXNlIG1hcCB0byBmdW5jdGlvbiBibG9ja3Mgd2l0aCBpbnB1dHMvb3V0cHV0XG5jb25zdCBMNVhfTUFUSF9NQVA6IFJlY29yZDxzdHJpbmcsIEZCVHlwZT4gPSB7XG4gIEFERDogJ0FERCcsIFNVQjogJ1NVQicsIE1VTDogJ01VTCcsIERJVjogJ0RJVicsIE1PRDogJ01PRCcsXG4gIEFCUzogJ0FCUycsIFNRUjogJ1NRUlQnLCBTUVJUOiAnU1FSVCcsIE5FRzogJ05FRycsXG4gIC8vIFRyaWcgLyBhZHZhbmNlZCBtYXRoXG4gIFNJTjogJ1NJTicsIENPUzogJ0NPUycsIFRBTjogJ1RBTicsIEFUTjogJ0FUQU4nLCBBVEFOOiAnQVRBTicsXG4gIEFTTjogJ0FTSU4nLCBBQ1M6ICdBQ09TJywgTE46ICdMTicsIExPRzogJ0xPRycsXG4gIC8vIENQVCBcdTIwMTQgQ29tcHV0ZSBleHByZXNzaW9uIGludG8gZGVzdGluYXRpb24gKHJlcHJlc2VudCBhcyBBREQgcGxhY2Vob2xkZXIpXG4gIENQVDogJ0FERCcsXG59O1xuXG4vLyBNb3ZlIC8gZGF0YS1jb3B5IGluc3RydWN0aW9uc1xuY29uc3QgTDVYX01PVkVfTUFQOiBSZWNvcmQ8c3RyaW5nLCBGQlR5cGU+ID0ge1xuICBNT1Y6ICdNT1ZFJywgTU9WRTogJ01PVkUnLCBDT1A6ICdNT1ZFJywgQ1BTOiAnTU9WRScsIEZMTDogJ01PVkUnLFxuICBCVEQ6ICdCVEQnLCBTSVpFOiAnU0laRScsXG59O1xuXG4vLyBCaXR3aXNlIC8gbG9naWNhbCBpbnN0cnVjdGlvbnMgXHUyMTkyIG1hcCB0byBib29sZWFuIGdhdGUgYmxvY2tzXG5jb25zdCBMNVhfQklUV0lTRV9NQVA6IFJlY29yZDxzdHJpbmcsIEZCVHlwZT4gPSB7XG4gIEFORDogJ0FORCcsIE9SOiAnT1InLCBOT1Q6ICdOT1QnLCBYT1I6ICdYT1InLFxuICBCQU5EOiAnQU5EJywgQk9SOiAnT1InLCBCTk9UOiAnTk9UJywgQlhPUjogJ1hPUicsXG59O1xuXG4vLyBTZWxlY3Rpb24gLyBjb252ZXJzaW9uIGluc3RydWN0aW9uc1xuY29uc3QgTDVYX1NFTEVDVF9NQVA6IFJlY29yZDxzdHJpbmcsIEZCVHlwZT4gPSB7XG4gIFNFTDogJ1NFTCcsIE1VWDogJ01VWCcsIExJTUlUOiAnTElNSVQnLCBNSU46ICdNSU4nLCBNQVg6ICdNQVgnLFxuICBMSU06ICdMSU1JVCcsIE1FUTogJ0VRJyxcbiAgLy8gVHlwZSBjb252ZXJzaW9uXG4gIFRSVU5DOiAnVFJVTkMnLCBST1VORDogJ1JPVU5EJyxcbiAgSU5UX1RPX1JFQUw6ICdJTlRfVE9fUkVBTCcsIFJFQUxfVE9fSU5UOiAnUkVBTF9UT19JTlQnLFxuICBESU5UX1RPX1JFQUw6ICdESU5UX1RPX1JFQUwnLCBSRUFMX1RPX0RJTlQ6ICdSRUFMX1RPX0RJTlQnLFxuICAvLyBTY2FsaW5nXG4gIFNDTDogJ1NDQUxFJywgU0NQOiAnU0NBTEUnLFxuICAvLyBCaXQgc2hpZnRcbiAgU0hMOiAnTU9WRScsIFNIUjogJ01PVkUnLCBST0w6ICdNT1ZFJywgUk9SOiAnTU9WRScsXG4gIEJTTDogJ01PVkUnLCBCU1I6ICdNT1ZFJyxcbn07XG5cbi8vIEZJRk8gLyBMSUZPIHF1ZXVlIGluc3RydWN0aW9uc1xuY29uc3QgTDVYX0ZJRk9fTUFQOiBSZWNvcmQ8c3RyaW5nLCBGQlR5cGU+ID0ge1xuICBGRkw6ICdGRkwnLCBGRlU6ICdGRlUnLCBMRkw6ICdMRkwnLCBMRlU6ICdMRlUnLFxufTtcblxuLy8gU2VxdWVuY2VyIGluc3RydWN0aW9uc1xuY29uc3QgTDVYX1NFUV9NQVA6IFJlY29yZDxzdHJpbmcsIEZCVHlwZT4gPSB7XG4gIFNRTzogJ1NRTycsIFNRSTogJ1NRSScsIFNRTDogJ1NRTCcsXG59O1xuXG4vLyBQSUQgYW5kIHByb2Nlc3MgY29udHJvbFxuY29uc3QgTDVYX1BJRF9NQVA6IFJlY29yZDxzdHJpbmcsIEZCVHlwZT4gPSB7XG4gIFBJRDogJ1BJRCcsIFBJREU6ICdQSUQnLCBQSURBVDogJ1BJRCcsXG59O1xuXG4vLyBTdHJpbmcgaW5zdHJ1Y3Rpb25zXG5jb25zdCBMNVhfU1RSSU5HX01BUDogUmVjb3JkPHN0cmluZywgRkJUeXBlPiA9IHtcbiAgLy8gTGVuZ3RoIC8gY29uY2F0IC8gY29tcGFyZVxuICBMRU46ICdMRU4nLCBDT05DQVQ6ICdDT05DQVQnLCBGSU5EOiAnRklORCcsIElOU0VSVDogJ0lOU0VSVCcsXG4gIERFTEVURTogJ0RFTEVURScsIE1JRDogJ01JRCcsIFVQUEVSOiAnVVBQRVJfQ0FTRScsIExPV0VSOiAnTE9XRVJfQ0FTRScsXG4gIExFRlQ6ICdMRUZUJywgUklHSFQ6ICdSSUdIVCcsXG4gIC8vIFN0cmluZyBjb21wYXJpc29uXG4gIFNUUkNNUDogJ0VRJywgU1RSSUNNUDogJ0VRJyxcbiAgLy8gU3RyaW5nIHRvIG51bWJlciAvIG51bWJlciB0byBzdHJpbmdcbiAgU1RPRDogJ01PVkUnLCBEVE9TOiAnTU9WRScsXG59O1xuXG4vLyBNb3Rpb24gaW5zdHJ1Y3Rpb25zIFx1MjAxNCBhbHdheXMgdW5tYXBwZWQgd2l0aCBtZXRhZGF0YSwgYnV0IHdlIGdpdmUgdGhlbSBhIGJsb2NrIHNoYXBlXG4vLyBzbyB0aGV5IGFwcGVhciBhcyBibG9ja3MgaW4gdGhlIGNhbnZhcyAobm90IHNpbGVudGx5IGRyb3BwZWQpXG5jb25zdCBMNVhfTU9USU9OX1NFVCA9IG5ldyBTZXQoW1xuICAnTUFKJywgJ01BTScsICdNQVMnLCAnTUFPQycsICdNQUFUJywgJ01BRlInLCAnTUFIRCcsICdNQVJQJywgJ01BUlcnLFxuICAvLyBNQVIgXHUyMDE0IE1vdGlvbiBBeGlzIFJlZ2lzdHJhdGlvbjogTUFSKGF4aXMsIHJlZ2lzdHJhdGlvbiwgZWRnZSwgLi4uKVxuICAnTUFSJyxcbiAgJ01DRCcsICdNQ1QnLCAnTUNDRCcsICdNQ1REJywgJ01DUCcsICdNQ00nLFxuICAnR1NWJywgJ1NTVicsXG4gICdNU0cnLFxuXSk7XG5cbi8vIERpYWdub3N0aWMgLyBwcm9ncmFtIGNvbnRyb2wgaW5zdHJ1Y3Rpb25zIFx1MjAxNCBrZXB0IGFzIHBhc3MtdGhyb3VnaCBibG9ja3NcbmNvbnN0IEw1WF9ESUFHX1NFVCA9IG5ldyBTZXQoW1xuICAnRU9UJywgJ0VGUycsXG4gICdVSUQnLCAnVUlFJyxcbiAgJ09OUycsIC8vIGhhbmRsZWQgYWJvdmUgYXMgY29udGFjdCwgYnV0IGd1YXJkIGhlcmUgdG9vXG4gICdSRVNEJywgJ1NFVEQnLFxuXSk7XG5cbi8vIEhlbHBlcjogYnVpbGQgYSBtaW5pbWFsIDItb3BlcmFuZCBibG9jayAoSU4sIE9VVClcbmZ1bmN0aW9uIG1ha2VCbG9jayhcbiAgaW5zdHI6IHN0cmluZyxcbiAgZmJUeXBlOiBGQlR5cGUsXG4gIGluc3RhbmNlU3VmZml4OiBzdHJpbmcgfCBudW1iZXIsXG4gIHJ1bmdOdW1iZXI6IG51bWJlcixcbiAgcGluczogUmVjb3JkPHN0cmluZywgVGFnUmVmPixcbiAgcG9zWDogbnVtYmVyXG4pOiBCbG9ja0VsZW1lbnQge1xuICByZXR1cm4ge1xuICAgIGtpbmQ6ICdibG9jaycsXG4gICAgaWQ6IHVpZChgciR7cnVuZ051bWJlcn0tJHtpbnN0cn1gKSxcbiAgICBmYlR5cGUsXG4gICAgaW5zdGFuY2VOYW1lOiBgJHtpbnN0cn1fJHtpbnN0YW5jZVN1ZmZpeH1gLFxuICAgIHBpbnMsXG4gICAgcG9zaXRpb246IHsgeDogcG9zWCwgeTogMCB9LFxuICAgIHZlbmRvck9yaWdpbmFsTmFtZTogaW5zdHIgIT09IChmYlR5cGUgYXMgc3RyaW5nKSA/IGluc3RyIDogdW5kZWZpbmVkLFxuICB9IGFzIEJsb2NrRWxlbWVudDtcbn1cblxuZnVuY3Rpb24gbWFwTDVYSW5zdHJ1Y3Rpb24oXG4gIGluc3RyOiBzdHJpbmcsXG4gIGFyZ3M6IHN0cmluZ1tdLFxuICBwb3NYOiBudW1iZXIsXG4gIHJ1bmdOdW1iZXI6IG51bWJlcixcbiAgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdLFxuICB3YXJuaW5nczogc3RyaW5nW11cbik6IExhZGRlckVsZW1lbnQgfCBudWxsIHtcblxuICAvLyBcdTI1MDBcdTI1MDAgQ29udGFjdCBpbnN0cnVjdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGlmIChMNVhfQ09OVEFDVF9NQVBbaW5zdHJdKSB7XG4gICAgY29uc3QgdGFnTmFtZSA9IGFyZ3NbMF0gfHwgYFRBR18ke3Bvc1h9YDtcbiAgICAvLyBPU1IvT1NGIHRha2UgMiBhcmdzOiBPU1Ioc3RvcmFnZUJpdCwgb3V0cHV0Qml0KSBcdTIwMTQgc3RvcmUgYm90aCBmb3Igcm91bmQtdHJpcFxuICAgIGNvbnN0IGV4dHJhVGFnID0gKGluc3RyID09PSAnT1NSJyB8fCBpbnN0ciA9PT0gJ09TRicpICYmIGFyZ3NbMV0gPyBhcmdzWzFdIDogdW5kZWZpbmVkO1xuICAgIHJldHVybiB7XG4gICAgICBraW5kOiAnY29udGFjdCcsXG4gICAgICBpZDogdWlkKGByJHtydW5nTnVtYmVyfS0ke2luc3RyfWApLFxuICAgICAgdHlwZTogTDVYX0NPTlRBQ1RfTUFQW2luc3RyXSxcbiAgICAgIHRhZzogeyBuYW1lOiB0YWdOYW1lLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICBwb3NpdGlvbjogeyB4OiBwb3NYLCB5OiAwIH0sXG4gICAgICB2ZW5kb3JBcmdzOiBleHRyYVRhZyA/IFt0YWdOYW1lLCBleHRyYVRhZ10gOiB1bmRlZmluZWQsXG4gICAgfSBhcyBhbnk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgQ29pbCBpbnN0cnVjdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGlmIChMNVhfQ09JTF9NQVBbaW5zdHJdKSB7XG4gICAgY29uc3QgdGFnTmFtZSA9IGFyZ3NbMF0gfHwgYFRBR18ke3Bvc1h9YDtcbiAgICByZXR1cm4ge1xuICAgICAga2luZDogJ2NvaWwnLFxuICAgICAgaWQ6IHVpZChgciR7cnVuZ051bWJlcn0tJHtpbnN0cn1gKSxcbiAgICAgIHR5cGU6IEw1WF9DT0lMX01BUFtpbnN0cl0sXG4gICAgICB0YWc6IHsgbmFtZTogdGFnTmFtZSwgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgcG9zaXRpb246IHsgeDogcG9zWCwgeTogMCB9LFxuICAgIH07XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgVGltZXIgaW5zdHJ1Y3Rpb25zIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAvLyBUT04odGltZXIsIHByZXNldCwgYWNjdW0pIC8gVE9GIC8gUlRPIC8gVFAgLyBUT05SXG4gIC8vICc/JyBhcmdzIG1lYW4gdGhlIHZhbHVlIGlzIGVtYmVkZGVkIGluIHRoZSBUSU1FUiBzdHJ1Y3QgKExvZ2l4IGNvbnZlbnRpb24pXG4gIGlmIChMNVhfVElNRVJfTUFQW2luc3RyXSkge1xuICAgIGNvbnN0IGluc3RhbmNlTmFtZSA9IGFyZ3NbMF0gJiYgYXJnc1swXSAhPT0gJz8nID8gYXJnc1swXSA6IGAke2luc3RyfV8ke3Bvc1h9YDtcbiAgICBjb25zdCBwcmVzZXQgPSBhcmdzWzFdICYmIGFyZ3NbMV0gIT09ICc/JyA/IGFyZ3NbMV0gOiBgJHtpbnN0YW5jZU5hbWV9LlBSRWA7XG4gICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgTDVYX1RJTUVSX01BUFtpbnN0cl0sIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgIEVOOiAgeyBuYW1lOiBpbnN0YW5jZU5hbWUgKyAnLkVOJywgIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgIFBUOiAgeyBuYW1lOiBwcmVzZXQsICAgICAgICAgICAgICAgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgUTogICB7IG5hbWU6IGluc3RhbmNlTmFtZSArICcuRE4nLCAgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgRVQ6ICB7IG5hbWU6IGluc3RhbmNlTmFtZSArICcuQUNDJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgIH0sIHBvc1gpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIENvdW50ZXIgaW5zdHJ1Y3Rpb25zIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAvLyBDVFUoY291bnRlciwgcHJlc2V0LCBhY2N1bSkgLyBDVEQgLyBDVFVEXG4gIGlmIChMNVhfQ09VTlRFUl9NQVBbaW5zdHJdKSB7XG4gICAgY29uc3QgaW5zdGFuY2VOYW1lID0gYXJnc1swXSAmJiBhcmdzWzBdICE9PSAnPycgPyBhcmdzWzBdIDogYCR7aW5zdHJ9XyR7cG9zWH1gO1xuICAgIGNvbnN0IHByZXNldCA9IGFyZ3NbMV0gJiYgYXJnc1sxXSAhPT0gJz8nID8gYXJnc1sxXSA6IGAke2luc3RhbmNlTmFtZX0uUFJFYDtcbiAgICByZXR1cm4gbWFrZUJsb2NrKGluc3RyLCBMNVhfQ09VTlRFUl9NQVBbaW5zdHJdLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICBDVTogeyBuYW1lOiBpbnN0YW5jZU5hbWUgKyAnLkNVJywgIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgIFBWOiB7IG5hbWU6IHByZXNldCwgICAgICAgICAgICAgICBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICBRVTogeyBuYW1lOiBpbnN0YW5jZU5hbWUgKyAnLkROJywgIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgIENWOiB7IG5hbWU6IGluc3RhbmNlTmFtZSArICcuQUNDJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgIH0sIHBvc1gpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIE1hdGggaW5zdHJ1Y3Rpb25zIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAvLyBBREQoc3JjMSwgc3JjMiwgZGVzdCkgLyBTVUIgLyBNVUwgLyBESVYgLyBNT0QgLyBBQlMgLyBTUVIgLyB0cmlnIC8gQ1BUIFx1MjAyNlxuICBpZiAoTDVYX01BVEhfTUFQW2luc3RyXSkge1xuICAgIGNvbnN0IGRlc3QgICAgPSBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gfHwgYFJFU1VMVF8ke3Bvc1h9YDtcbiAgICBjb25zdCBzb3VyY2VBID0gYXJnc1swXSB8fCAnMCc7XG4gICAgY29uc3Qgc291cmNlQiA9IGFyZ3MubGVuZ3RoID49IDMgPyBhcmdzWzFdIDogJzAnO1xuICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsIEw1WF9NQVRIX01BUFtpbnN0cl0sIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgIElOMTogeyBuYW1lOiBzb3VyY2VBLCBkYXRhVHlwZTogJ1JFQUwnIH0sXG4gICAgICBJTjI6IHsgbmFtZTogc291cmNlQiwgZGF0YVR5cGU6ICdSRUFMJyB9LFxuICAgICAgT1VUOiB7IG5hbWU6IGRlc3QsICAgIGRhdGFUeXBlOiAnUkVBTCcgfSxcbiAgICB9LCBwb3NYKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBDb21wYXJpc29uIGluc3RydWN0aW9ucyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgLy8gRVFVKHNyYzEsIHNyYzIpIFx1MjE5MiBFUSBibG9jazsgTElNKGxvdywgdGVzdCwgaGlnaCkgXHUyMTkyIExJTUlUIGJsb2NrXG4gIGlmIChMNVhfQ09NUEFSRV9NQVBbaW5zdHJdKSB7XG4gICAgaWYgKGluc3RyID09PSAnTElNJykge1xuICAgICAgY29uc3QgbG93ICA9IGFyZ3NbMF0gfHwgJzAnO1xuICAgICAgY29uc3QgdGVzdCA9IGFyZ3NbMV0gfHwgJzAnO1xuICAgICAgY29uc3QgaGlnaCA9IGFyZ3NbMl0gfHwgJzAnO1xuICAgICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgJ0xJTUlUJyBhcyBGQlR5cGUsIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgICAgTU46ICB7IG5hbWU6IGxvdywgIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgSU46ICB7IG5hbWU6IHRlc3QsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgTVg6ICB7IG5hbWU6IGhpZ2gsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgT1VUOiB7IG5hbWU6IGBfTElNXyR7cG9zWH1gLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICB9LCBwb3NYKTtcbiAgICB9XG4gICAgaWYgKGluc3RyID09PSAnTUVRJykge1xuICAgICAgY29uc3Qgc3JjICA9IGFyZ3NbMF0gfHwgJzAnO1xuICAgICAgY29uc3QgbWFzayA9IGFyZ3NbMV0gfHwgJzAnO1xuICAgICAgY29uc3QgY21wICA9IGFyZ3NbMl0gfHwgJzAnO1xuICAgICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgJ0VRJyBhcyBGQlR5cGUsIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgICAgSU4xOiAgeyBuYW1lOiBzcmMsICBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIE1BU0s6IHsgbmFtZTogbWFzaywgZGF0YVR5cGU6ICdEV09SRCcgfSxcbiAgICAgICAgSU4yOiAgeyBuYW1lOiBjbXAsICBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIE9VVDogIHsgbmFtZTogYF9NRVFfJHtwb3NYfWAsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgIH0sIHBvc1gpO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VBID0gYXJnc1swXSB8fCAnMCc7XG4gICAgY29uc3Qgc291cmNlQiA9IGFyZ3NbMV0gfHwgJzAnO1xuICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsIEw1WF9DT01QQVJFX01BUFtpbnN0cl0gYXMgRkJUeXBlLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICBJTjE6IHsgbmFtZTogc291cmNlQSwgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgSU4yOiB7IG5hbWU6IHNvdXJjZUIsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgIE9VVDogeyBuYW1lOiBgX0NNUF8ke3Bvc1h9YCwgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgIH0sIHBvc1gpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIE1vdmUgLyBkYXRhLWNvcHkgaW5zdHJ1Y3Rpb25zIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAvLyBNT1Yoc3JjLCBkZXN0KSAvIENPUChzcmMsIGRlc3QsIGxlbikgLyBDUFMgLyBGTEwodmFsdWUsIGRlc3QsIGxlbilcbiAgaWYgKEw1WF9NT1ZFX01BUFtpbnN0cl0pIHtcbiAgICBjb25zdCBzb3VyY2UgPSBhcmdzWzBdIHx8ICcwJztcbiAgICBjb25zdCBkZXN0ICAgPSBhcmdzWzFdIHx8IGBERVNUXyR7cG9zWH1gO1xuICAgIGlmIChpbnN0ciA9PT0gJ0JURCcpIHtcbiAgICAgIC8vIEJpdCBmaWVsZCBkaXN0cmlidXRlOiBCVEQoc3JjLCBzcmNCaXQsIGRlc3QsIGRlc3RCaXQsIGxlbilcbiAgICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsICdCVEQnLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICAgIElOOiAgICAgIHsgbmFtZTogc291cmNlLCAgICAgICBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIFNSQ19CSVQ6IHsgbmFtZTogYXJnc1sxXSB8fCAnMCcsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgT1VUOiAgICAgeyBuYW1lOiBhcmdzWzJdIHx8IGRlc3QsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgRFNUX0JJVDogeyBuYW1lOiBhcmdzWzNdIHx8ICcwJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBMRU46ICAgICB7IG5hbWU6IGFyZ3NbNF0gfHwgJzEnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICB9LCBwb3NYKTtcbiAgICB9XG4gICAgaWYgKGluc3RyID09PSAnU0laRScpIHtcbiAgICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsICdTSVpFJywgcG9zWCwgcnVuZ051bWJlciwge1xuICAgICAgICBJTjogIHsgbmFtZTogc291cmNlLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIERJTTogeyBuYW1lOiBhcmdzWzFdIHx8ICcwJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBPVVQ6IHsgbmFtZTogYXJnc1syXSB8fCBgREVTVF8ke3Bvc1h9YCwgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgfSwgcG9zWCk7XG4gICAgfVxuICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsIEw1WF9NT1ZFX01BUFtpbnN0cl0sIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgIElOOiAgeyBuYW1lOiBzb3VyY2UsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgIE9VVDogeyBuYW1lOiBkZXN0LCAgIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICB9LCBwb3NYKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBCaXR3aXNlIC8gbG9naWNhbCBpbnN0cnVjdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIC8vIEFORChzcmMxLCBzcmMyLCBkZXN0KSAvIE9SIC8gTk9UKHNyYywgZGVzdCkgLyBYT1JcbiAgaWYgKEw1WF9CSVRXSVNFX01BUFtpbnN0cl0pIHtcbiAgICBjb25zdCBzcmMxID0gYXJnc1swXSB8fCAnMCc7XG4gICAgY29uc3Qgc3JjMiA9IGFyZ3MubGVuZ3RoID49IDMgPyBhcmdzWzFdIDogJzAnO1xuICAgIGNvbnN0IGRlc3QgPSBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gfHwgYFJFU1VMVF8ke3Bvc1h9YDtcbiAgICByZXR1cm4gbWFrZUJsb2NrKGluc3RyLCBMNVhfQklUV0lTRV9NQVBbaW5zdHJdLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICBJTjE6IHsgbmFtZTogc3JjMSwgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgSU4yOiB7IG5hbWU6IHNyYzIsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgIE9VVDogeyBuYW1lOiBkZXN0LCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgfSwgcG9zWCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgU2VsZWN0aW9uIC8gY29udmVyc2lvbiBpbnN0cnVjdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGlmIChMNVhfU0VMRUNUX01BUFtpbnN0cl0pIHtcbiAgICBpZiAoaW5zdHIgPT09ICdTRUwnKSB7XG4gICAgICBjb25zdCBzZWwgID0gYXJnc1swXSB8fCAnMCc7XG4gICAgICBjb25zdCBpbjEgID0gYXJnc1sxXSB8fCAnMCc7XG4gICAgICBjb25zdCBpbjIgID0gYXJnc1syXSB8fCAnMCc7XG4gICAgICBjb25zdCBkZXN0ID0gYXJnc1szXSB8fCBgREVTVF8ke3Bvc1h9YDtcbiAgICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsICdTRUwnLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICAgIEc6ICAgeyBuYW1lOiBzZWwsICBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICAgIElOMDogeyBuYW1lOiBpbjEsICBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIElOMTogeyBuYW1lOiBpbjIsICBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIE9VVDogeyBuYW1lOiBkZXN0LCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICB9LCBwb3NYKTtcbiAgICB9XG4gICAgaWYgKGluc3RyID09PSAnTVVYJykge1xuICAgICAgY29uc3Qgc2VsICA9IGFyZ3NbMF0gfHwgJzAnO1xuICAgICAgY29uc3QgZGVzdCA9IGFyZ3NbYXJncy5sZW5ndGggLSAxXSB8fCBgREVTVF8ke3Bvc1h9YDtcbiAgICAgIGNvbnN0IGlucHV0UGluczogUmVjb3JkPHN0cmluZywgVGFnUmVmPiA9IHsgSzogeyBuYW1lOiBzZWwsIGRhdGFUeXBlOiAnRElOVCcgfSB9O1xuICAgICAgYXJncy5zbGljZSgxLCBhcmdzLmxlbmd0aCAtIDEpLmZvckVhY2goKGEsIGkpID0+IHtcbiAgICAgICAgaW5wdXRQaW5zW2BJTiR7aX1gXSA9IHsgbmFtZTogYSwgZGF0YVR5cGU6ICdESU5UJyB9O1xuICAgICAgfSk7XG4gICAgICBpbnB1dFBpbnNbJ09VVCddID0geyBuYW1lOiBkZXN0LCBkYXRhVHlwZTogJ0RJTlQnIH07XG4gICAgICByZXR1cm4gbWFrZUJsb2NrKGluc3RyLCAnTVVYJywgcG9zWCwgcnVuZ051bWJlciwgaW5wdXRQaW5zLCBwb3NYKTtcbiAgICB9XG4gICAgaWYgKGluc3RyID09PSAnTElNSVQnIHx8IGluc3RyID09PSAnTElNJykge1xuICAgICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgJ0xJTUlUJywgcG9zWCwgcnVuZ051bWJlciwge1xuICAgICAgICBNTjogIHsgbmFtZTogYXJnc1swXSB8fCAnMCcsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgSU46ICB7IG5hbWU6IGFyZ3NbMV0gfHwgJzAnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIE1YOiAgeyBuYW1lOiBhcmdzWzJdIHx8ICcwJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBPVVQ6IHsgbmFtZTogYF9MSU1fJHtwb3NYfWAsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgIH0sIHBvc1gpO1xuICAgIH1cbiAgICBpZiAoaW5zdHIgPT09ICdNSU4nIHx8IGluc3RyID09PSAnTUFYJykge1xuICAgICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgTDVYX1NFTEVDVF9NQVBbaW5zdHJdLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICAgIElOMTogeyBuYW1lOiBhcmdzWzBdIHx8ICcwJywgZGF0YVR5cGU6ICdSRUFMJyB9LFxuICAgICAgICBJTjI6IHsgbmFtZTogYXJnc1sxXSB8fCAnMCcsIGRhdGFUeXBlOiAnUkVBTCcgfSxcbiAgICAgICAgT1VUOiB7IG5hbWU6IGFyZ3NbMl0gfHwgYERFU1RfJHtwb3NYfWAsIGRhdGFUeXBlOiAnUkVBTCcgfSxcbiAgICAgIH0sIHBvc1gpO1xuICAgIH1cbiAgICBpZiAoaW5zdHIgPT09ICdTQ0wnIHx8IGluc3RyID09PSAnU0NQJykge1xuICAgICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgJ1NDQUxFJywgcG9zWCwgcnVuZ051bWJlciwge1xuICAgICAgICBJTjogICAgeyBuYW1lOiBhcmdzWzBdIHx8ICcwJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBJbk1pbjogeyBuYW1lOiBhcmdzWzFdIHx8ICcwJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBJbk1heDogeyBuYW1lOiBhcmdzWzJdIHx8ICcwJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBPVVQ6ICAgeyBuYW1lOiBhcmdzWzNdIHx8IGBERVNUXyR7cG9zWH1gLCBkYXRhVHlwZTogJ1JFQUwnIH0sXG4gICAgICB9LCBwb3NYKTtcbiAgICB9XG4gICAgLy8gR2VuZXJpYyBzZWxlY3Rpb24gLyBjb252ZXJzaW9uIGZhbGx0aHJvdWdoXG4gICAgY29uc3Qgc3JjICA9IGFyZ3NbMF0gfHwgJzAnO1xuICAgIGNvbnN0IGRlc3QgPSBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gfHwgYERFU1RfJHtwb3NYfWA7XG4gICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgTDVYX1NFTEVDVF9NQVBbaW5zdHJdLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICBJTjogIHsgbmFtZTogc3JjLCAgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgT1VUOiB7IG5hbWU6IGRlc3QsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICB9LCBwb3NYKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBGSUZPIC8gTElGTyBxdWV1ZSBpbnN0cnVjdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIC8vIFJlYWwgc3ludGF4OiBGRkwoc291cmNlLCBGSUZPX2FycmF5LCBDVFJMX3N0cnVjdCwgPywgPylcbiAgLy8gICAgICAgICAgICAgIEZGVShGSUZPX2FycmF5LCBkZXN0LCBDVFJMX3N0cnVjdCwgPywgPylcbiAgLy8gVGhlICc/JyBhcmdzIGFyZSBsZW4vcG9zIGVtYmVkZGVkIGluIHRoZSBDVFJMIHN0cnVjdCBcdTIwMTQgdHJlYXQgYXMgdW5rbm93blxuICBpZiAoTDVYX0ZJRk9fTUFQW2luc3RyXSkge1xuICAgIGNvbnN0IGlzRmlsbCA9IGluc3RyID09PSAnRkZMJyB8fCBpbnN0ciA9PT0gJ0xGTCc7XG4gICAgY29uc3QgdmFsaWRBcmcgPSAoYTogc3RyaW5nIHwgdW5kZWZpbmVkKSA9PiAoIWEgfHwgYSA9PT0gJz8nKSA/IHVuZGVmaW5lZCA6IGE7XG4gICAgaWYgKGlzRmlsbCkge1xuICAgICAgY29uc3QgY3RybCA9IHZhbGlkQXJnKGFyZ3NbMl0pIHx8IGAke2luc3RyfV9DVFJMYDtcbiAgICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsIEw1WF9GSUZPX01BUFtpbnN0cl0sIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgICAgSU46ICAgeyBuYW1lOiB2YWxpZEFyZyhhcmdzWzBdKSB8fCAnMCcsICAgICAgICAgIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgRklGTzogeyBuYW1lOiB2YWxpZEFyZyhhcmdzWzFdKSB8fCBgJHtpbnN0cn1fUWAsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgQ1RSTDogeyBuYW1lOiBjdHJsLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFUeXBlOiAnQ09OVFJPTCcgfSxcbiAgICAgICAgTEVOOiAgeyBuYW1lOiBgJHtjdHJsfS5MRU5gLCAgICAgICAgICAgICAgICAgICAgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBQT1M6ICB7IG5hbWU6IGAke2N0cmx9LlBPU2AsICAgICAgICAgICAgICAgICAgICBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIEVNOiAgIHsgbmFtZTogYCR7Y3RybH0uRU1gLCAgICAgICAgICAgICAgICAgICAgIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgICAgRE46ICAgeyBuYW1lOiBgJHtjdHJsfS5ETmAsICAgICAgICAgICAgICAgICAgICAgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgfSwgcG9zWCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGN0cmwgPSB2YWxpZEFyZyhhcmdzWzJdKSB8fCBgJHtpbnN0cn1fQ1RSTGA7XG4gICAgICByZXR1cm4gbWFrZUJsb2NrKGluc3RyLCBMNVhfRklGT19NQVBbaW5zdHJdLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICAgIEZJRk86IHsgbmFtZTogdmFsaWRBcmcoYXJnc1swXSkgfHwgYCR7aW5zdHJ9X1FgLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIE9VVDogIHsgbmFtZTogdmFsaWRBcmcoYXJnc1sxXSkgfHwgYERFU1RfJHtwb3NYfWAsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgQ1RSTDogeyBuYW1lOiBjdHJsLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFUeXBlOiAnQ09OVFJPTCcgfSxcbiAgICAgICAgTEVOOiAgeyBuYW1lOiBgJHtjdHJsfS5MRU5gLCAgICAgICAgICAgICAgICAgICAgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBQT1M6ICB7IG5hbWU6IGAke2N0cmx9LlBPU2AsICAgICAgICAgICAgICAgICAgICBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICAgIEVNOiAgIHsgbmFtZTogYCR7Y3RybH0uRU1gLCAgICAgICAgICAgICAgICAgICAgIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgICAgRE46ICAgeyBuYW1lOiBgJHtjdHJsfS5ETmAsICAgICAgICAgICAgICAgICAgICAgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgfSwgcG9zWCk7XG4gICAgfVxuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFNlcXVlbmNlciBpbnN0cnVjdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIC8vIFNRTyhmaWxlLCBtYXNrLCBkZXN0LCBjb250cm9sLCBsZW4sIHBvcylcbiAgLy8gU1FJKGZpbGUsIG1hc2ssIHNyYywgY29udHJvbCwgbGVuLCBwb3MpXG4gIC8vIFNRTChmaWxlLCBkZXN0LCBjb250cm9sLCBsZW4sIHBvcylcbiAgaWYgKEw1WF9TRVFfTUFQW2luc3RyXSkge1xuICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsIEw1WF9TRVFfTUFQW2luc3RyXSwgcG9zWCwgcnVuZ051bWJlciwge1xuICAgICAgRklMRTogeyBuYW1lOiBhcmdzWzBdIHx8IGAke2luc3RyfV9GSUxFYCwgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgTUFTSzogeyBuYW1lOiBhcmdzWzFdIHx8ICcwJywgICAgICAgICAgICAgZGF0YVR5cGU6ICdEV09SRCcgfSxcbiAgICAgIERFU1Q6IHsgbmFtZTogYXJnc1syXSB8fCBgREVTVF8ke3Bvc1h9YCwgIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgIENUUkw6IHsgbmFtZTogYXJnc1szXSB8fCBgJHtpbnN0cn1fQ1RSTGAsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgIExFTjogIHsgbmFtZTogYXJnc1s0XSB8fCAnMCcsICAgICAgICAgICAgIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgIFBPUzogIHsgbmFtZTogYXJnc1s1XSB8fCAnMCcsICAgICAgICAgICAgIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgIEROOiAgIHsgbmFtZTogYCR7YXJnc1szXSB8fCBpbnN0cn0uRE5gLCAgIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgIEVSOiAgIHsgbmFtZTogYCR7YXJnc1szXSB8fCBpbnN0cn0uRVJgLCAgIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICB9LCBwb3NYKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBQSUQgLyBQcm9jZXNzIGNvbnRyb2wgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIC8vIFBJRChQSUQsIHByb2Nlc3MsIHRpZWJhY2ssIGNvbnRyb2wsIFBJRF9kYXRhKVxuICBpZiAoTDVYX1BJRF9NQVBbaW5zdHJdKSB7XG4gICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgTDVYX1BJRF9NQVBbaW5zdHJdLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICBJTjogICAgIHsgbmFtZTogYXJnc1sxXSB8fCBgUFZfJHtwb3NYfWAsICAgZGF0YVR5cGU6ICdSRUFMJyB9LFxuICAgICAgU1A6ICAgICB7IG5hbWU6IGAke2FyZ3NbMF0gfHwgaW5zdHJ9LlNQYCwgIGRhdGFUeXBlOiAnUkVBTCcgfSxcbiAgICAgIE9VVDogICAgeyBuYW1lOiBhcmdzWzNdIHx8IGBDVl8ke3Bvc1h9YCwgICBkYXRhVHlwZTogJ1JFQUwnIH0sXG4gICAgICBLUDogICAgIHsgbmFtZTogYCR7YXJnc1swXSB8fCBpbnN0cn0uS1BgLCAgZGF0YVR5cGU6ICdSRUFMJyB9LFxuICAgICAgS0k6ICAgICB7IG5hbWU6IGAke2FyZ3NbMF0gfHwgaW5zdHJ9LktJYCwgIGRhdGFUeXBlOiAnUkVBTCcgfSxcbiAgICAgIEtEOiAgICAgeyBuYW1lOiBgJHthcmdzWzBdIHx8IGluc3RyfS5LRGAsICBkYXRhVHlwZTogJ1JFQUwnIH0sXG4gICAgICBFTjogICAgIHsgbmFtZTogYCR7YXJnc1swXSB8fCBpbnN0cn0uRU5gLCAgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgIH0sIHBvc1gpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFN0cmluZyBpbnN0cnVjdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGlmIChMNVhfU1RSSU5HX01BUFtpbnN0cl0pIHtcbiAgICBjb25zdCBzcmMxID0gYXJnc1swXSB8fCBgU1RSXyR7cG9zWH1gO1xuICAgIGNvbnN0IHNyYzIgPSBhcmdzLmxlbmd0aCA+PSAzID8gYXJnc1sxXSA6ICcnO1xuICAgIGNvbnN0IGRlc3QgPSBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gfHwgYERFU1RfJHtwb3NYfWA7XG4gICAgaWYgKGluc3RyID09PSAnTUlEJykge1xuICAgICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgJ01JRCcsIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgICAgSU46ICAgIHsgbmFtZTogc3JjMSwgICAgICAgICAgIGRhdGFUeXBlOiAnU1RSSU5HJyB9LFxuICAgICAgICBMRU46ICAgeyBuYW1lOiBhcmdzWzFdIHx8ICcxJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBTVEFSVDogeyBuYW1lOiBhcmdzWzJdIHx8ICcxJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBPVVQ6ICAgeyBuYW1lOiBkZXN0LCAgICAgICAgICAgZGF0YVR5cGU6ICdTVFJJTkcnIH0sXG4gICAgICB9LCBwb3NYKTtcbiAgICB9XG4gICAgaWYgKGluc3RyID09PSAnQ09OQ0FUJykge1xuICAgICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgJ0NPTkNBVCcsIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgICAgSU4xOiB7IG5hbWU6IHNyYzEsIGRhdGFUeXBlOiAnU1RSSU5HJyB9LFxuICAgICAgICBJTjI6IHsgbmFtZTogc3JjMiB8fCAnJywgZGF0YVR5cGU6ICdTVFJJTkcnIH0sXG4gICAgICAgIE9VVDogeyBuYW1lOiBkZXN0LCBkYXRhVHlwZTogJ1NUUklORycgfSxcbiAgICAgIH0sIHBvc1gpO1xuICAgIH1cbiAgICBpZiAoaW5zdHIgPT09ICdGSU5EJykge1xuICAgICAgcmV0dXJuIG1ha2VCbG9jayhpbnN0ciwgJ0ZJTkQnLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICAgIElOMTogeyBuYW1lOiBzcmMxLCAgICAgICAgICAgZGF0YVR5cGU6ICdTVFJJTkcnIH0sXG4gICAgICAgIElOMjogeyBuYW1lOiBzcmMyIHx8ICcnLCAgICAgZGF0YVR5cGU6ICdTVFJJTkcnIH0sXG4gICAgICAgIE9VVDogeyBuYW1lOiBkZXN0LCAgICAgICAgICAgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgfSwgcG9zWCk7XG4gICAgfVxuICAgIGlmIChpbnN0ciA9PT0gJ0lOU0VSVCcpIHtcbiAgICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsICdJTlNFUlQnLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICAgIElOMTogeyBuYW1lOiBzcmMxLCAgICAgICAgICAgZGF0YVR5cGU6ICdTVFJJTkcnIH0sXG4gICAgICAgIElOMjogeyBuYW1lOiBzcmMyIHx8ICcnLCAgICAgZGF0YVR5cGU6ICdTVFJJTkcnIH0sXG4gICAgICAgIFBPUzogeyBuYW1lOiBhcmdzWzJdIHx8ICcxJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgICBPVVQ6IHsgbmFtZTogZGVzdCwgICAgICAgICAgIGRhdGFUeXBlOiAnU1RSSU5HJyB9LFxuICAgICAgfSwgcG9zWCk7XG4gICAgfVxuICAgIGlmIChpbnN0ciA9PT0gJ0RFTEVURScpIHtcbiAgICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsICdERUxFVEUnLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICAgIElOOiAgICB7IG5hbWU6IHNyYzEsICAgICAgICAgICBkYXRhVHlwZTogJ1NUUklORycgfSxcbiAgICAgICAgTEVOOiAgIHsgbmFtZTogYXJnc1sxXSB8fCAnMScsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgU1RBUlQ6IHsgbmFtZTogYXJnc1syXSB8fCAnMScsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgICAgT1VUOiAgIHsgbmFtZTogZGVzdCwgICAgICAgICAgIGRhdGFUeXBlOiAnU1RSSU5HJyB9LFxuICAgICAgfSwgcG9zWCk7XG4gICAgfVxuICAgIC8vIExFTiAvIExFRlQgLyBSSUdIVCAvIFVQUEVSIC8gTE9XRVIgXHUyMDE0IGdlbmVyaWMgc2luZ2xlLXNvdXJjZVxuICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsIEw1WF9TVFJJTkdfTUFQW2luc3RyXSwgcG9zWCwgcnVuZ051bWJlciwge1xuICAgICAgSU46ICB7IG5hbWU6IHNyYzEsIGRhdGFUeXBlOiAnU1RSSU5HJyB9LFxuICAgICAgT1VUOiB7IG5hbWU6IGRlc3QsIGRhdGFUeXBlOiBpbnN0ciA9PT0gJ0xFTicgPyAnRElOVCcgOiAnU1RSSU5HJyB9LFxuICAgIH0sIHBvc1gpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIE1vdGlvbiBpbnN0cnVjdGlvbnMgXHUyMDE0IGFsd2F5cyB1bm1hcHBlZCwgYnV0IGVtaXQgYSBibG9jayBwbGFjZWhvbGRlciBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgLy8gc28gdGhleSBhcHBlYXIgb24gdGhlIGNhbnZhcyBhbmQgYXJlIHByZXNlcnZlZCB0aHJvdWdoIHNpZGVjYXJcbiAgaWYgKEw1WF9NT1RJT05fU0VULmhhcyhpbnN0cikpIHtcbiAgICBjb25zdCBpbnN0YW5jZU5hbWUgPSBhcmdzWzBdIHx8IGAke2luc3RyfV8ke3Bvc1h9YDtcbiAgICBjb25zdCBibG9jayA9IG1ha2VCbG9jayhpbnN0ciwgJ01PVkUnIGFzIEZCVHlwZSwgcG9zWCwgcnVuZ051bWJlciwge1xuICAgICAgSU46IHsgbmFtZTogaW5zdGFuY2VOYW1lLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgfSwgcG9zWCk7XG4gICAgdW5tYXBwZWQucHVzaCh7XG4gICAgICBjbG1Ob2RlSWQ6IGJsb2NrLmlkLFxuICAgICAgdmVuZG9yU3BlY2lmaWNEYXRhOiB7IGluc3RyLCBhcmdzIH0sXG4gICAgICByZWFzb246IGBNb3Rpb24vR1NWL01TRyBpbnN0cnVjdGlvbiAoY2FudmFzIHBsYWNlaG9sZGVyKTogJHtpbnN0cn0oJHthcmdzLmpvaW4oJywnKX0pYCxcbiAgICB9KTtcbiAgICByZXR1cm4gYmxvY2s7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgUkVTIFx1MjAxNCBjb3VudGVyL3RpbWVyIHJlc2V0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBpZiAoaW5zdHIgPT09ICdSRVMnKSB7XG4gICAgY29uc3QgdGFnTmFtZSA9IGFyZ3NbMF0gfHwgYFRBR18ke3Bvc1h9YDtcbiAgICByZXR1cm4ge1xuICAgICAga2luZDogJ2NvaWwnLFxuICAgICAgaWQ6IHVpZChgciR7cnVuZ051bWJlcn0tUkVTYCksXG4gICAgICB0eXBlOiAncmVzZXQnLFxuICAgICAgdGFnOiB7IG5hbWU6IHRhZ05hbWUsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgIHBvc2l0aW9uOiB7IHg6IHBvc1gsIHk6IDAgfSxcbiAgICB9O1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIERpYWdub3N0aWMgLyBwcm9ncmFtIGNvbnRyb2wgXHUyMDE0IGVtaXQgbm8tb3AgYmxvY2sgcGxhY2Vob2xkZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBpZiAoTDVYX0RJQUdfU0VULmhhcyhpbnN0cikpIHtcbiAgICAvLyBVSUQvVUlFIGRpc2FibGUvZW5hYmxlIGludGVycnVwdCBcdTIwMTQgc2tpcCBzaWxlbnRseSAodGhleSBoYXZlIG5vIHZpc3VhbCBzaGFwZSlcbiAgICBpZiAoaW5zdHIgPT09ICdVSUQnIHx8IGluc3RyID09PSAnVUlFJykgcmV0dXJuIG51bGw7XG4gICAgLy8gT3RoZXJzIGJlY29tZSBhIGxhYmVsZWQgYmxvY2sgcGxhY2Vob2xkZXIgKHByZXNlcnZlcyByb3VuZC10cmlwIHBvc2l0aW9uKVxuICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsICdNT1ZFJyBhcyBGQlR5cGUsIHBvc1gsIHJ1bmdOdW1iZXIsIHt9LCBwb3NYKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBFVkVOVCBcdTIwMTQgdHJpZ2dlciBldmVudCB0YXNrIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBpZiAoaW5zdHIgPT09ICdFVkVOVCcpIHtcbiAgICBjb25zdCB0YXNrTmFtZSA9IGFyZ3NbMF0gfHwgJ0VWRU5UX1RBU0snO1xuICAgIHJldHVybiB7XG4gICAgICBraW5kOiAnY29pbCcsXG4gICAgICBpZDogdWlkKGByJHtydW5nTnVtYmVyfS1FVkVOVGApLFxuICAgICAgdHlwZTogJ25vcm1hbCcsXG4gICAgICB0YWc6IHsgbmFtZTogYF9FVkVOVF8ke3Rhc2tOYW1lfWAsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgIHBvc2l0aW9uOiB7IHg6IHBvc1gsIHk6IDAgfSxcbiAgICB9O1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIEpTUiBcdTIwMTQgSnVtcCB0byBTdWJyb3V0aW5lIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBpZiAoaW5zdHIgPT09ICdKU1InKSB7XG4gICAgY29uc3Qgcm91dGluZU5hbWUgPSBhcmdzWzBdIHx8ICdVTktOT1dOJztcbiAgICByZXR1cm4gbWFrZUJsb2NrKGluc3RyLCAnTU9WRScgYXMgRkJUeXBlLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICBST1VUSU5FOiB7IG5hbWU6IHJvdXRpbmVOYW1lLCBkYXRhVHlwZTogJ1NUUklORycgfSxcbiAgICAgIElOOiAgICAgIHsgbmFtZTogYXJnc1sxXSB8fCAnMCcsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgIE9VVDogICAgIHsgbmFtZTogYXJnc1syXSB8fCAnMCcsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICB9LCBwb3NYKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBSRVQgXHUyMDE0IFJldHVybiBmcm9tIHN1YnJvdXRpbmUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGlmIChpbnN0ciA9PT0gJ1JFVCcpIHtcbiAgICByZXR1cm4ge1xuICAgICAga2luZDogJ2NvaWwnLFxuICAgICAgaWQ6IHVpZChgciR7cnVuZ051bWJlcn0tUkVUYCksXG4gICAgICB0eXBlOiAnbm9ybWFsJyxcbiAgICAgIHRhZzogeyBuYW1lOiAnX1JFVCcsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgIHBvc2l0aW9uOiB7IHg6IHBvc1gsIHk6IDAgfSxcbiAgICB9O1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFNCUiBcdTIwMTQgU3Vicm91dGluZSBkZWNsYXJhdGlvbjogc2tpcCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgaWYgKGluc3RyID09PSAnU0JSJykgcmV0dXJuIG51bGw7XG5cbiAgLy8gXHUyNTAwXHUyNTAwIEFGSSBcdTIwMTQgQWx3YXlzIEZhbHNlIEluc3RydWN0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBpZiAoaW5zdHIgPT09ICdBRkknKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGtpbmQ6ICdjb250YWN0JyxcbiAgICAgIGlkOiB1aWQoYHIke3J1bmdOdW1iZXJ9LUFGSWApLFxuICAgICAgdHlwZTogJ05DJyxcbiAgICAgIHRhZzogeyBuYW1lOiAnX0FMV0FZU19GQUxTRScsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgIHBvc2l0aW9uOiB7IHg6IHBvc1gsIHk6IDAgfSxcbiAgICB9O1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIE5PUCBcdTIwMTQgTm8gT3BlcmF0aW9uOiBza2lwIHNpbGVudGx5IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBpZiAoaW5zdHIgPT09ICdOT1AnKSByZXR1cm4gbnVsbDtcblxuICAvLyBcdTI1MDBcdTI1MDAgSk1QIFx1MjAxNCBKdW1wIHRvIGxhYmVsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBpZiAoaW5zdHIgPT09ICdKTVAnKSB7XG4gICAgY29uc3QgbGFiZWwgPSBhcmdzWzBdIHx8ICdMQkwwJztcbiAgICByZXR1cm4gbWFrZUJsb2NrKGluc3RyLCAnTU9WRScgYXMgRkJUeXBlLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICBMQUJFTDogeyBuYW1lOiBsYWJlbCwgZGF0YVR5cGU6ICdTVFJJTkcnIH0sXG4gICAgfSwgcG9zWCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgTEJMIFx1MjAxNCBMYWJlbCB0YXJnZXQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGlmIChpbnN0ciA9PT0gJ0xCTCcpIHtcbiAgICBjb25zdCBsYWJlbCA9IGFyZ3NbMF0gfHwgJ0xCTDAnO1xuICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsICdNT1ZFJyBhcyBGQlR5cGUsIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgIExBQkVMOiB7IG5hbWU6IGxhYmVsLCBkYXRhVHlwZTogJ1NUUklORycgfSxcbiAgICB9LCBwb3NYKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBNQ1IgXHUyMDE0IE1hc3RlciBDb250cm9sIFJlc2V0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBpZiAoaW5zdHIgPT09ICdNQ1InKSByZXR1cm4gbnVsbDsgLy8gTUNSIGlzIHpvbmUgZGVsaW1pdGVyLCBubyB2aXN1YWwgZWxlbWVudFxuXG4gIC8vIFx1MjUwMFx1MjUwMCBUTkQgXHUyMDE0IFRlbXBvcmFyeSBFbmQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGlmIChpbnN0ciA9PT0gJ1RORCcpIHtcbiAgICByZXR1cm4ge1xuICAgICAga2luZDogJ2NvaWwnLFxuICAgICAgaWQ6IHVpZChgciR7cnVuZ051bWJlcn0tVE5EYCksXG4gICAgICB0eXBlOiAnbm9ybWFsJyxcbiAgICAgIHRhZzogeyBuYW1lOiAnX1RORCcsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgIHBvc2l0aW9uOiB7IHg6IHBvc1gsIHk6IDAgfSxcbiAgICB9O1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIEZPUiAvIE5FWFQgLyBCUksgXHUyMDE0IGxvb3AgY29udHJvbCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgaWYgKGluc3RyID09PSAnRk9SJykge1xuICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsICdNT1ZFJyBhcyBGQlR5cGUsIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgIFJPVVRJTkU6IHsgbmFtZTogYXJnc1swXSB8fCAnTE9PUCcsIGRhdGFUeXBlOiAnU1RSSU5HJyB9LFxuICAgICAgSU5ERVg6ICAgeyBuYW1lOiBhcmdzWzFdIHx8ICcwJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgSU5JVDogICAgeyBuYW1lOiBhcmdzWzJdIHx8ICcwJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgVEVSTTogICAgeyBuYW1lOiBhcmdzWzNdIHx8ICcwJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgU1RFUDogICAgeyBuYW1lOiBhcmdzWzRdIHx8ICcxJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgIH0sIHBvc1gpO1xuICB9XG4gIGlmIChpbnN0ciA9PT0gJ05FWFQnKSByZXR1cm4gbnVsbDtcbiAgaWYgKGluc3RyID09PSAnQlJLJykgcmV0dXJuIG51bGw7XG5cbiAgLy8gXHUyNTAwXHUyNTAwIEZBTCAvIEZTQyBcdTIwMTQgZmlsZSBhcml0aG1ldGljL3NlYXJjaC9jb21wYXJlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBpZiAoaW5zdHIgPT09ICdGQUwnIHx8IGluc3RyID09PSAnRlNDJykge1xuICAgIGNvbnN0IGN0cmwgPSBhcmdzWzBdIHx8IGAke2luc3RyfV9DVFJMYDtcbiAgICByZXR1cm4gbWFrZUJsb2NrKGluc3RyLCAnTU9WRScgYXMgRkJUeXBlLCBwb3NYLCBydW5nTnVtYmVyLCB7XG4gICAgICBDVFJMOiAgeyBuYW1lOiBjdHJsLCBkYXRhVHlwZTogJ0NPTlRST0wnIH0sXG4gICAgICBMRU46ICAgeyBuYW1lOiBhcmdzWzFdIHx8ICcwJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgUE9TOiAgIHsgbmFtZTogYXJnc1syXSB8fCAnMCcsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgIE1PREU6ICB7IG5hbWU6IGFyZ3NbM10gfHwgJzAnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICBERVNUOiAgeyBuYW1lOiBhcmdzWzRdIHx8ICcwJywgZGF0YVR5cGU6ICdESU5UJyB9LFxuICAgICAgRVhQUjogIHsgbmFtZTogYXJnc1s1XSB8fCAnMCcsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICB9LCBwb3NYKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBBVkUgLyBTUlQgLyBTVEQgXHUyMDE0IGZpbGUgc3RhdGlzdGljcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgaWYgKGluc3RyID09PSAnQVZFJyB8fCBpbnN0ciA9PT0gJ1NSVCcgfHwgaW5zdHIgPT09ICdTVEQnKSB7XG4gICAgY29uc3QgY3RybCA9IGFyZ3NbMV0gfHwgYCR7aW5zdHJ9X0NUUkxgO1xuICAgIHJldHVybiBtYWtlQmxvY2soaW5zdHIsICdNT1ZFJyBhcyBGQlR5cGUsIHBvc1gsIHJ1bmdOdW1iZXIsIHtcbiAgICAgIEFSUkFZOiB7IG5hbWU6IGFyZ3NbMF0gfHwgJzAnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgICBDVFJMOiAgeyBuYW1lOiBjdHJsLCBkYXRhVHlwZTogJ0NPTlRST0wnIH0sXG4gICAgICBERVNUOiAgeyBuYW1lOiBhcmdzWzJdIHx8ICcwJywgZGF0YVR5cGU6ICdSRUFMJyB9LFxuICAgICAgTEVOOiAgIHsgbmFtZTogYXJnc1szXSB8fCAnMCcsIGRhdGFUeXBlOiAnRElOVCcgfSxcbiAgICAgIFBPUzogICB7IG5hbWU6IGFyZ3NbNF0gfHwgJzAnLCBkYXRhVHlwZTogJ0RJTlQnIH0sXG4gICAgfSwgcG9zWCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgVW5rbm93biBpbnN0cnVjdGlvbiBcdTIxOTIgcHJlc2VydmUgaW4gdW5tYXBwZWQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIHVubWFwcGVkLnB1c2goe1xuICAgIGNsbU5vZGVJZDogbnVsbCxcbiAgICB2ZW5kb3JTcGVjaWZpY0RhdGE6IHsgaW5zdHIsIGFyZ3MgfSxcbiAgICByZWFzb246IGBVbnN1cHBvcnRlZCBSb2Nrd2VsbCBpbnN0cnVjdGlvbjogJHtpbnN0cn0oJHthcmdzLmpvaW4oJywnKX0pYCxcbiAgfSk7XG4gIHJldHVybiBudWxsO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgRkJEIChGdW5jdGlvbiBCbG9jayBEaWFncmFtKSBwYXJzZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHBhcnNlTDVYRkJEKHJvdXRpbmVFbDogdW5rbm93biwgdW5tYXBwZWQ6IFVubWFwcGVkRWxlbWVudFtdLCB3YXJuaW5nczogc3RyaW5nW10sIHJlc29sdmVyOiBWYXJpYWJsZVR5cGVSZXNvbHZlciA9IG5ldyBWYXJpYWJsZVR5cGVSZXNvbHZlcigpKTogRkJEUHJvZ3JhbSB8IG51bGwge1xuICBjb25zdCBzaGVldHMgPSBjaGlsZEFycmF5KHJvdXRpbmVFbCwgJ1NoZWV0JykgPz8gY2hpbGRBcnJheShjaGlsZChyb3V0aW5lRWwsICdGQkRDb250ZW50JyksICdTaGVldCcpO1xuICBpZiAoIXNoZWV0cyB8fCBzaGVldHMubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcblxuICBjb25zdCBub2RlczogRkJETm9kZVtdID0gW107XG4gIGNvbnN0IHdpcmVzOiBGQkRXaXJlW10gPSBbXTtcblxuICBmb3IgKGNvbnN0IHNoZWV0IG9mIHNoZWV0cykge1xuICAgIC8vIFBhcnNlIEJsb2NrIGVsZW1lbnRzIFx1MjAxNCByZWFsIEw1WCBmb3JtYXQ6IDxCbG9jayBUeXBlPVwiVE9OXCIgVmlzaWJsZVBpbnM9XCJJTiBQVCBRIEVUXCIgT3BlcmFuZD1cIlRpbWVyMVwiLz5cbiAgICBmb3IgKGNvbnN0IGJsb2NrRWwgb2YgY2hpbGRBcnJheShzaGVldCwgJ0Jsb2NrJykuY29uY2F0KGNoaWxkQXJyYXkoc2hlZXQsICdGQkRfQmxvY2snKSkpIHtcbiAgICAgIGNvbnN0IGlkID0gYXR0cihibG9ja0VsLCAnSUQnKSB8fCB1aWQoJ2ZiZC1ibG9jaycpO1xuICAgICAgY29uc3QgdHlwZU5hbWUgPSBhdHRyKGJsb2NrRWwsICdUeXBlJykgfHwgJ1VOS05PV04nO1xuICAgICAgY29uc3QgeCA9IE51bWJlcihhdHRyKGJsb2NrRWwsICdYJykpIHx8IDA7XG4gICAgICBjb25zdCB5ID0gTnVtYmVyKGF0dHIoYmxvY2tFbCwgJ1knKSkgfHwgMDtcbiAgICAgIGNvbnN0IGluc3RhbmNlTmFtZSA9IGF0dHIoYmxvY2tFbCwgJ09wZXJhbmQnKSB8fCBhdHRyKGJsb2NrRWwsICdOYW1lJykgfHwgJyc7XG5cbiAgICAgIGNvbnN0IGJsb2NrVHlwZSA9IG1hcFJvY2t3ZWxsRkJEVHlwZSh0eXBlTmFtZSk7XG4gICAgICBjb25zdCBpbnB1dHM6IHsgaWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nOyBkYXRhVHlwZTogc3RyaW5nOyBuZWdhdGVkPzogYm9vbGVhbiB9W10gPSBbXTtcbiAgICAgIGNvbnN0IG91dHB1dHM6IHsgaWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nOyBkYXRhVHlwZTogc3RyaW5nIH1bXSA9IFtdO1xuXG4gICAgICAvLyBQcmltYXJ5IGZvcm1hdDogVmlzaWJsZVBpbnMgYXR0cmlidXRlIGlzIGEgc3BhY2Utc2VwYXJhdGVkIGxpc3Qgb2YgdmlzaWJsZSBwaW4gbmFtZXMuXG4gICAgICAvLyBVc2UgcGluU2lnbmF0dXJlcyB0byBjbGFzc2lmeSBlYWNoIHBpbiBhcyBpbnB1dCBvciBvdXRwdXQuXG4gICAgICBjb25zdCB2aXNpYmxlUGluc0F0dHIgPSBhdHRyKGJsb2NrRWwsICdWaXNpYmxlUGlucycpIHx8ICcnO1xuICAgICAgaWYgKHZpc2libGVQaW5zQXR0cikge1xuICAgICAgICBjb25zdCBwaW5OYW1lcyA9IHZpc2libGVQaW5zQXR0ci5zcGxpdCgvXFxzKy8pLmZpbHRlcihCb29sZWFuKTtcbiAgICAgICAgZm9yIChjb25zdCBwaW5OYW1lIG9mIHBpbk5hbWVzKSB7XG4gICAgICAgICAgY29uc3QgYXNJbnB1dCAgPSBnZXRQaW5EYXRhVHlwZSh0eXBlTmFtZSwgcGluTmFtZSwgJ2lucHV0Jyk7XG4gICAgICAgICAgY29uc3QgYXNPdXRwdXQgPSBnZXRQaW5EYXRhVHlwZSh0eXBlTmFtZSwgcGluTmFtZSwgJ291dHB1dCcpO1xuICAgICAgICAgIC8vIEhldXJpc3RpYzogaWYgcGluU2lnbmF0dXJlcyBnaXZlcyBhIHJlYWwgdHlwZSBmb3Igb3V0cHV0LCB0cmVhdCBhcyBvdXRwdXRcbiAgICAgICAgICBjb25zdCBpc091dHB1dCA9IGFzT3V0cHV0ICE9PSAnQk9PTCcgfHwgcGluTmFtZSA9PT0gJ091dCcgfHwgcGluTmFtZSA9PT0gJ0Rlc3QnIHx8XG4gICAgICAgICAgICAvXihPdXR8RGVzdHxRW1VETl0/fFJlc3VsdHxETnxFTl9PfEVOTykkL2kudGVzdChwaW5OYW1lKTtcbiAgICAgICAgICBpZiAoaXNPdXRwdXQpIHtcbiAgICAgICAgICAgIG91dHB1dHMucHVzaCh7IGlkOiB1aWQoJ3BpbicpLCBuYW1lOiBwaW5OYW1lLCBkYXRhVHlwZTogYXNPdXRwdXQgfSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlucHV0cy5wdXNoKHsgaWQ6IHVpZCgncGluJyksIG5hbWU6IHBpbk5hbWUsIGRhdGFUeXBlOiBhc0lucHV0IH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBGYWxsYmFjazogbGVnYWN5IEZCRF9CbG9ja1BpbiAvIElucHV0UGluIC8gT3V0cHV0UGluIGNoaWxkIGVsZW1lbnRzXG4gICAgICBpZiAoaW5wdXRzLmxlbmd0aCA9PT0gMCAmJiBvdXRwdXRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBmb3IgKGNvbnN0IHBpbkVsIG9mIGNoaWxkQXJyYXkoYmxvY2tFbCwgJ0ZCRF9CbG9ja1BpbicpKSB7XG4gICAgICAgICAgY29uc3QgcGluTmFtZSA9IGF0dHIocGluRWwsICdOYW1lJykgfHwgYHBpbiR7aW5wdXRzLmxlbmd0aCArIG91dHB1dHMubGVuZ3RofWA7XG4gICAgICAgICAgY29uc3QgcGluSWQgPSBhdHRyKHBpbkVsLCAnSUQnKSB8fCB1aWQoJ3BpbicpO1xuICAgICAgICAgIGNvbnN0IHVzZSA9IGF0dHIocGluRWwsICdVc2UnKSB8fCAnJztcbiAgICAgICAgICBpZiAodXNlID09PSAnT3V0cHV0Jykge1xuICAgICAgICAgICAgb3V0cHV0cy5wdXNoKHsgaWQ6IHBpbklkLCBuYW1lOiBwaW5OYW1lLCBkYXRhVHlwZTogZ2V0UGluRGF0YVR5cGUodHlwZU5hbWUsIHBpbk5hbWUsICdvdXRwdXQnKSB9KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaW5wdXRzLnB1c2goeyBpZDogcGluSWQsIG5hbWU6IHBpbk5hbWUsIGRhdGFUeXBlOiBnZXRQaW5EYXRhVHlwZSh0eXBlTmFtZSwgcGluTmFtZSwgJ2lucHV0JykgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgcGluRWwgb2YgY2hpbGRBcnJheShibG9ja0VsLCAnSW5wdXRQaW4nKSkge1xuICAgICAgICAgIGNvbnN0IHBpbk5hbWUgPSBhdHRyKHBpbkVsLCAnTmFtZScpIHx8IGBpbiR7aW5wdXRzLmxlbmd0aH1gO1xuICAgICAgICAgIGNvbnN0IHBpbklkID0gYXR0cihwaW5FbCwgJ0lEJykgfHwgdWlkKCdwaW4nKTtcbiAgICAgICAgICBpbnB1dHMucHVzaCh7IGlkOiBwaW5JZCwgbmFtZTogcGluTmFtZSwgZGF0YVR5cGU6IGdldFBpbkRhdGFUeXBlKHR5cGVOYW1lLCBwaW5OYW1lLCAnaW5wdXQnKSB9KTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IHBpbkVsIG9mIGNoaWxkQXJyYXkoYmxvY2tFbCwgJ091dHB1dFBpbicpKSB7XG4gICAgICAgICAgY29uc3QgcGluTmFtZSA9IGF0dHIocGluRWwsICdOYW1lJykgfHwgYG91dCR7b3V0cHV0cy5sZW5ndGh9YDtcbiAgICAgICAgICBjb25zdCBwaW5JZCA9IGF0dHIocGluRWwsICdJRCcpIHx8IHVpZCgncGluJyk7XG4gICAgICAgICAgb3V0cHV0cy5wdXNoKHsgaWQ6IHBpbklkLCBuYW1lOiBwaW5OYW1lLCBkYXRhVHlwZTogZ2V0UGluRGF0YVR5cGUodHlwZU5hbWUsIHBpbk5hbWUsICdvdXRwdXQnKSB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBJZiBzdGlsbCBubyBwaW5zLCBnZW5lcmF0ZSBmcm9tIGNhbm9uaWNhbCBzaWduYXR1cmVcbiAgICAgIGlmIChpbnB1dHMubGVuZ3RoID09PSAwICYmIG91dHB1dHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNvbnN0IHsgaW5wdXRzOiBzaWdJbiwgb3V0cHV0czogc2lnT3V0IH0gPSBidWlsZFR5cGVkUGlucyh0eXBlTmFtZSwgW10sIGlkKTtcbiAgICAgICAgaW5wdXRzLnB1c2goLi4uc2lnSW4pO1xuICAgICAgICBvdXRwdXRzLnB1c2goLi4uc2lnT3V0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChpbnB1dHMubGVuZ3RoID09PSAwKSBpbnB1dHMucHVzaCh7IGlkOiB1aWQoJ3BpbicpLCBuYW1lOiAnRU4nLCBkYXRhVHlwZTogJ0JPT0wnIH0pO1xuICAgICAgICBpZiAob3V0cHV0cy5sZW5ndGggPT09IDApIG91dHB1dHMucHVzaCh7IGlkOiB1aWQoJ3BpbicpLCBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9KTtcbiAgICAgIH1cblxuICAgICAgbm9kZXMucHVzaCh7XG4gICAgICAgIGlkLFxuICAgICAgICB0eXBlOiBibG9ja1R5cGUsXG4gICAgICAgIGluc3RhbmNlTmFtZTogaW5zdGFuY2VOYW1lIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgcG9zaXRpb246IHsgeCwgeSB9LFxuICAgICAgICBpbnB1dHMsXG4gICAgICAgIG91dHB1dHMsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBBZGRPbkluc3RydWN0aW9uIHVzYWdlIGluIEZCRCBzaGVldHMgKE5PVCBkZWZpbml0aW9uIFx1MjAxNCB0aGlzIGlzIGEgY2FsbCBzaXRlKVxuICAgIGZvciAoY29uc3QgYW9pRWwgb2YgY2hpbGRBcnJheShzaGVldCwgJ0FkZE9uSW5zdHJ1Y3Rpb24nKSkge1xuICAgICAgY29uc3QgaWQgPSBhdHRyKGFvaUVsLCAnSUQnKSB8fCB1aWQoJ2FvaScpO1xuICAgICAgY29uc3QgdHlwZU5hbWUgPSBhdHRyKGFvaUVsLCAnTmFtZScpIHx8ICdBT0knO1xuICAgICAgY29uc3QgeCA9IE51bWJlcihhdHRyKGFvaUVsLCAnWCcpKSB8fCAwO1xuICAgICAgY29uc3QgeSA9IE51bWJlcihhdHRyKGFvaUVsLCAnWScpKSB8fCAwO1xuICAgICAgY29uc3QgaW5zdGFuY2VOYW1lID0gYXR0cihhb2lFbCwgJ09wZXJhbmQnKSB8fCAnJztcbiAgICAgIGNvbnN0IHZpc2libGVQaW5zQXR0ciA9IGF0dHIoYW9pRWwsICdWaXNpYmxlUGlucycpIHx8ICcnO1xuICAgICAgY29uc3QgcGluTmFtZXMgPSB2aXNpYmxlUGluc0F0dHIuc3BsaXQoL1xccysvKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICAvLyBGb3IgQU9JcywgdHJlYXQgYWxsIHBpbnMgZXhjZXB0IEVuYWJsZUluL0VuYWJsZU91dCBhcyBpbnB1dHMgdW5sZXNzIHRoZXkgbWF0Y2ggb3V0cHV0IHBhdHRlcm5zXG4gICAgICBjb25zdCBhb2lJbnB1dHM6IHsgaWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nOyBkYXRhVHlwZTogc3RyaW5nIH1bXSA9IFtdO1xuICAgICAgY29uc3QgYW9pT3V0cHV0czogeyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmc7IGRhdGFUeXBlOiBzdHJpbmcgfVtdID0gW107XG4gICAgICBmb3IgKGNvbnN0IHBpbk5hbWUgb2YgcGluTmFtZXMpIHtcbiAgICAgICAgY29uc3QgaXNPdXRwdXQgPSAvXihFbmFibGVPdXR8RU5PfE91dFxcZCp8RGVzdFxcZCopJC9pLnRlc3QocGluTmFtZSk7XG4gICAgICAgIGlmIChpc091dHB1dCkgYW9pT3V0cHV0cy5wdXNoKHsgaWQ6IHVpZCgncGluJyksIG5hbWU6IHBpbk5hbWUsIGRhdGFUeXBlOiAnQk9PTCcgfSk7XG4gICAgICAgIGVsc2UgYW9pSW5wdXRzLnB1c2goeyBpZDogdWlkKCdwaW4nKSwgbmFtZTogcGluTmFtZSwgZGF0YVR5cGU6ICdCT09MJyB9KTtcbiAgICAgIH1cbiAgICAgIC8vIEFsc28gcGFyc2UgSW5PdXRQYXJhbWV0ZXIgY2hpbGRyZW5cbiAgICAgIGZvciAoY29uc3QgaW9wRWwgb2YgY2hpbGRBcnJheShhb2lFbCwgJ0luT3V0UGFyYW1ldGVyJykpIHtcbiAgICAgICAgY29uc3QgcE5hbWUgPSBhdHRyKGlvcEVsLCAnTmFtZScpIHx8ICcnO1xuICAgICAgICBhb2lJbnB1dHMucHVzaCh7IGlkOiB1aWQoJ3BpbicpLCBuYW1lOiBwTmFtZSwgZGF0YVR5cGU6ICdESU5UJyB9KTtcbiAgICAgIH1cbiAgICAgIGlmIChhb2lJbnB1dHMubGVuZ3RoID09PSAwKSBhb2lJbnB1dHMucHVzaCh7IGlkOiB1aWQoJ3BpbicpLCBuYW1lOiAnRW5hYmxlSW4nLCBkYXRhVHlwZTogJ0JPT0wnIH0pO1xuICAgICAgaWYgKGFvaU91dHB1dHMubGVuZ3RoID09PSAwKSBhb2lPdXRwdXRzLnB1c2goeyBpZDogdWlkKCdwaW4nKSwgbmFtZTogJ0VuYWJsZU91dCcsIGRhdGFUeXBlOiAnQk9PTCcgfSk7XG4gICAgICBjb25zdCBibG9ja1R5cGUgPSBtYXBSb2Nrd2VsbEZCRFR5cGUodHlwZU5hbWUpO1xuICAgICAgbm9kZXMucHVzaCh7XG4gICAgICAgIGlkLCB0eXBlOiBibG9ja1R5cGUsXG4gICAgICAgIGluc3RhbmNlTmFtZTogaW5zdGFuY2VOYW1lIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgcG9zaXRpb246IHsgeCwgeSB9LFxuICAgICAgICBpbnB1dHM6IGFvaUlucHV0cyxcbiAgICAgICAgb3V0cHV0czogYW9pT3V0cHV0cyxcbiAgICAgICAgdmVuZG9yT3JpZ2luYWxOYW1lOiB0eXBlTmFtZSxcbiAgICAgIH0gYXMgYW55KTtcbiAgICAgIHVubWFwcGVkLnB1c2goe1xuICAgICAgICBjbG1Ob2RlSWQ6IGlkLFxuICAgICAgICB2ZW5kb3JTcGVjaWZpY0RhdGE6IGFvaUVsLFxuICAgICAgICByZWFzb246IGBBT0kgY2FsbCBpbiBGQkQgc2hlZXQ6ICR7dHlwZU5hbWV9KCR7aW5zdGFuY2VOYW1lfSlgLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gUGFyc2UgSVJlZiAoaW5wdXQgcmVmZXJlbmNlIFx1MjAxNCB2YXJpYWJsZSBub2RlcylcbiAgICBmb3IgKGNvbnN0IGlyZWZFbCBvZiBjaGlsZEFycmF5KHNoZWV0LCAnSVJlZicpKSB7XG4gICAgICBjb25zdCBpZCA9IGF0dHIoaXJlZkVsLCAnSUQnKSB8fCB1aWQoJ2lyZWYnKTtcbiAgICAgIGNvbnN0IG9wZXJhbmQgPSBhdHRyKGlyZWZFbCwgJ09wZXJhbmQnKSB8fCAnJztcbiAgICAgIGNvbnN0IHggPSBOdW1iZXIoYXR0cihpcmVmRWwsICdYJykpIHx8IDA7XG4gICAgICBjb25zdCB5ID0gTnVtYmVyKGF0dHIoaXJlZkVsLCAnWScpKSB8fCAwO1xuXG4gICAgICBjb25zdCBpcmVmVHlwZSA9IHJlc29sdmVyLnJlc29sdmUob3BlcmFuZCk7XG4gICAgICBub2Rlcy5wdXNoKHtcbiAgICAgICAgaWQsXG4gICAgICAgIHR5cGU6ICdJTl9WQVJJQUJMRScsXG4gICAgICAgIHBvc2l0aW9uOiB7IHgsIHkgfSxcbiAgICAgICAgaW5wdXRzOiBbXSxcbiAgICAgICAgb3V0cHV0czogW3sgaWQ6IHVpZCgncGluJyksIG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogaXJlZlR5cGUgfV0sXG4gICAgICAgIHRhZzogeyBuYW1lOiBvcGVyYW5kLCBkYXRhVHlwZTogaXJlZlR5cGUgfSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFBhcnNlIE9SZWYgKG91dHB1dCByZWZlcmVuY2UgXHUyMDE0IHZhcmlhYmxlIG5vZGVzKVxuICAgIGZvciAoY29uc3Qgb3JlZkVsIG9mIGNoaWxkQXJyYXkoc2hlZXQsICdPUmVmJykpIHtcbiAgICAgIGNvbnN0IGlkID0gYXR0cihvcmVmRWwsICdJRCcpIHx8IHVpZCgnb3JlZicpO1xuICAgICAgY29uc3Qgb3BlcmFuZCA9IGF0dHIob3JlZkVsLCAnT3BlcmFuZCcpIHx8ICcnO1xuICAgICAgY29uc3QgeCA9IE51bWJlcihhdHRyKG9yZWZFbCwgJ1gnKSkgfHwgMDtcbiAgICAgIGNvbnN0IHkgPSBOdW1iZXIoYXR0cihvcmVmRWwsICdZJykpIHx8IDA7XG4gICAgICBjb25zdCBvcmVmVHlwZSA9IHJlc29sdmVyLnJlc29sdmUob3BlcmFuZCk7XG5cbiAgICAgIG5vZGVzLnB1c2goe1xuICAgICAgICBpZCxcbiAgICAgICAgdHlwZTogJ09VVF9WQVJJQUJMRScsXG4gICAgICAgIHBvc2l0aW9uOiB7IHgsIHkgfSxcbiAgICAgICAgaW5wdXRzOiBbeyBpZDogdWlkKCdwaW4nKSwgbmFtZTogJ0lOJywgZGF0YVR5cGU6IG9yZWZUeXBlIH1dLFxuICAgICAgICBvdXRwdXRzOiBbXSxcbiAgICAgICAgdGFnOiB7IG5hbWU6IG9wZXJhbmQsIGRhdGFUeXBlOiBvcmVmVHlwZSB9LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gUGFyc2UgSUNvbiBcdTIwMTQgd2lyZSBpbnB1dCBjb25uZWN0b3IgKGNyb3NzLXNoZWV0IHNpZ25hbCBzb3VyY2UpXG4gICAgZm9yIChjb25zdCBpY29uRWwgb2YgY2hpbGRBcnJheShzaGVldCwgJ0lDb24nKSkge1xuICAgICAgY29uc3QgaWQgPSBhdHRyKGljb25FbCwgJ0lEJykgfHwgdWlkKCdpY29uJyk7XG4gICAgICBjb25zdCBuYW1lID0gYXR0cihpY29uRWwsICdOYW1lJykgfHwgJyc7XG4gICAgICBjb25zdCB4ID0gTnVtYmVyKGF0dHIoaWNvbkVsLCAnWCcpKSB8fCAwO1xuICAgICAgY29uc3QgeSA9IE51bWJlcihhdHRyKGljb25FbCwgJ1knKSkgfHwgMDtcbiAgICAgIG5vZGVzLnB1c2goe1xuICAgICAgICBpZCwgdHlwZTogJ0lOX1ZBUklBQkxFJyBhcyBGQkRCbG9ja1R5cGUsXG4gICAgICAgIHBvc2l0aW9uOiB7IHgsIHkgfSxcbiAgICAgICAgaW5wdXRzOiBbXSxcbiAgICAgICAgb3V0cHV0czogW3sgaWQ6IHVpZCgncGluJyksIG5hbWU6ICcnLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICAgICAgICB0YWc6IHsgbmFtZSwgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgfSk7XG4gICAgfVxuICAgIC8vIFBhcnNlIE9Db24gXHUyMDE0IHdpcmUgb3V0cHV0IGNvbm5lY3RvciAoY3Jvc3Mtc2hlZXQgc2lnbmFsIHNpbmspXG4gICAgZm9yIChjb25zdCBvY29uRWwgb2YgY2hpbGRBcnJheShzaGVldCwgJ09Db24nKSkge1xuICAgICAgY29uc3QgaWQgPSBhdHRyKG9jb25FbCwgJ0lEJykgfHwgdWlkKCdvY29uJyk7XG4gICAgICBjb25zdCBuYW1lID0gYXR0cihvY29uRWwsICdOYW1lJykgfHwgJyc7XG4gICAgICBjb25zdCB4ID0gTnVtYmVyKGF0dHIob2NvbkVsLCAnWCcpKSB8fCAwO1xuICAgICAgY29uc3QgeSA9IE51bWJlcihhdHRyKG9jb25FbCwgJ1knKSkgfHwgMDtcbiAgICAgIG5vZGVzLnB1c2goe1xuICAgICAgICBpZCwgdHlwZTogJ09VVF9WQVJJQUJMRScgYXMgRkJEQmxvY2tUeXBlLFxuICAgICAgICBwb3NpdGlvbjogeyB4LCB5IH0sXG4gICAgICAgIGlucHV0czogW3sgaWQ6IHVpZCgncGluJyksIG5hbWU6ICcnLCBkYXRhVHlwZTogJ0JPT0wnIH1dLFxuICAgICAgICBvdXRwdXRzOiBbXSxcbiAgICAgICAgdGFnOiB7IG5hbWUsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFBhcnNlIFRleHRCb3ggZWxlbWVudHMgXHUyMDE0IHByZXNlcnZlIGluIHVubWFwcGVkIGZvciByb3VuZC10cmlwXG4gICAgZm9yIChjb25zdCB0YkVsIG9mIGNoaWxkQXJyYXkoc2hlZXQsICdUZXh0Qm94JykpIHtcbiAgICAgIHVubWFwcGVkLnB1c2goeyBjbG1Ob2RlSWQ6IG51bGwsIHZlbmRvclNwZWNpZmljRGF0YTogdGJFbCwgcmVhc29uOiBgRkJEIFRleHRCb3hgIH0pO1xuICAgIH1cblxuICAgIC8vIFBhcnNlIFdpcmUgZWxlbWVudHNcbiAgICBmb3IgKGNvbnN0IHdpcmVFbCBvZiBjaGlsZEFycmF5KHNoZWV0LCAnV2lyZScpKSB7XG4gICAgICBjb25zdCBmcm9tSWQgPSBhdHRyKHdpcmVFbCwgJ0Zyb21JRCcpIHx8ICcnO1xuICAgICAgY29uc3QgdG9JZCA9IGF0dHIod2lyZUVsLCAnVG9JRCcpIHx8ICcnO1xuICAgICAgY29uc3QgZnJvbVBpbiA9IGF0dHIod2lyZUVsLCAnRnJvbVBhcmFtJykgPz8gJyc7XG4gICAgICBjb25zdCB0b1BpbiA9IGF0dHIod2lyZUVsLCAnVG9QYXJhbScpID8/ICcnO1xuXG4gICAgICBpZiAoZnJvbUlkICYmIHRvSWQpIHtcbiAgICAgICAgd2lyZXMucHVzaCh7XG4gICAgICAgICAgaWQ6IHVpZCgnd2lyZScpLFxuICAgICAgICAgIGZyb206IHsgbm9kZUlkOiBmcm9tSWQsIHBpbjogZnJvbVBpbiB9LFxuICAgICAgICAgIHRvOiB7IG5vZGVJZDogdG9JZCwgcGluOiB0b1BpbiB9LFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAobm9kZXMubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIHsgbm9kZXMsIHdpcmVzIH07XG59XG5cbmZ1bmN0aW9uIG1hcFJvY2t3ZWxsRkJEVHlwZSh0eXBlTmFtZTogc3RyaW5nKTogRkJEQmxvY2tUeXBlIHtcbiAgY29uc3QgdXBwZXIgPSB0eXBlTmFtZS50b1VwcGVyQ2FzZSgpO1xuICBjb25zdCBtYXA6IFJlY29yZDxzdHJpbmcsIEZCREJsb2NrVHlwZT4gPSB7XG4gICAgLy8gQm9vbGVhbiBnYXRlcyAoUm9ja3dlbGwgQkFORC9CT1IvQk5PVC9CWE9SIGFuZCBJRUMgbmFtZXMpXG4gICAgQU5EOiAnQU5EJywgT1I6ICdPUicsIE5PVDogJ05PVCcsIFhPUjogJ1hPUicsXG4gICAgQkFORDogJ0FORCcsIEJPUjogJ09SJywgQk5PVDogJ05PVCcsIEJYT1I6ICdYT1InLFxuICAgIC8vIEFyaXRobWV0aWNcbiAgICBBREQ6ICdBREQnLCBTVUI6ICdTVUInLCBNVUw6ICdNVUwnLCBESVY6ICdESVYnLCBNT0Q6ICdNT0QnLFxuICAgIEFCUzogJ0FCUycsIFNRUjogJ1NRUlQnLCBTUVJUOiAnU1FSVCcsIE5FRzogJ05FRycsXG4gICAgU0lOOiAnU0lOJywgQ09TOiAnQ09TJywgVEFOOiAnVEFOJywgQVROOiAnQVRBTicsIEFUQU46ICdBVEFOJyxcbiAgICBBU046ICdBU0lOJywgQUNTOiAnQUNPUycsIExOOiAnTE4nLCBMT0c6ICdMT0cnLFxuICAgIC8vIFRpbWVyc1xuICAgIFRPTjogJ1RPTicsIFRPRjogJ1RPRicsIFJUTzogJ1RPTicsIFRQOiAnVFAnLCBUT05SOiAnVE9OUicsXG4gICAgLy8gQ291bnRlcnNcbiAgICBDVFU6ICdDVFUnLCBDVEQ6ICdDVEQnLCBDVFVEOiAnQ1RVRCcsXG4gICAgLy8gQmlzdGFibGUgLyBlZGdlXG4gICAgU1I6ICdTUicsIFJTOiAnUlMnLFxuICAgIC8vIENvbXBhcmlzb24gKFJvY2t3ZWxsIG1uZW1vbmljcyBcdTIxOTIgSUVDKVxuICAgIEVRVTogJ0VRJywgTkVROiAnTkUnLCBHUlQ6ICdHVCcsIEdFUTogJ0dFJywgTEVTOiAnTFQnLCBMRVE6ICdMRScsXG4gICAgR1Q6ICdHVCcsIEdFOiAnR0UnLCBMVDogJ0xUJywgTEU6ICdMRScsIEVROiAnRVEnLCBORTogJ05FJyxcbiAgICBMSU06ICdMSU1JVCcsIE1FUTogJ0VRJywgQ01QOiAnRVEnLFxuICAgIC8vIERhdGEgLyBzZWxlY3Rpb25cbiAgICBNT1ZFOiAnTU9WRScsIE1PVjogJ01PVkUnLCBDT1A6ICdNT1ZFJywgQ1BTOiAnTU9WRScsIEZMTDogJ01PVkUnLFxuICAgIFNFTDogJ1NFTCcsIE1VWDogJ01VWCcsIExJTUlUOiAnTElNSVQnLCBNSU46ICdNSU4nLCBNQVg6ICdNQVgnLFxuICAgIC8vIFNjYWxpbmcgLyBjb252ZXJzaW9uXG4gICAgU0NMOiAnU0NBTEUnLCBTQ1A6ICdTQ0FMRScsXG4gICAgVFJVTkM6ICdUUlVOQycsIFJPVU5EOiAnUk9VTkQnLFxuICAgIElOVF9UT19SRUFMOiAnSU5UX1RPX1JFQUwnLCBSRUFMX1RPX0lOVDogJ1JFQUxfVE9fSU5UJyxcbiAgICBESU5UX1RPX1JFQUw6ICdESU5UX1RPX1JFQUwnLCBSRUFMX1RPX0RJTlQ6ICdSRUFMX1RPX0RJTlQnLFxuICAgIC8vIEJpdHdpc2VcbiAgICBCVEQ6ICdCVEQnLCBTSVpFOiAnU0laRScsXG4gICAgLy8gRklGTyAvIExJRk8gLyBTZXF1ZW5jZXJcbiAgICBGRkw6ICdGRkwnLCBGRlU6ICdGRlUnLCBMRkw6ICdMRkwnLCBMRlU6ICdMRlUnLFxuICAgIFNRTzogJ1NRTycsIFNRSTogJ1NRSScsIFNRTDogJ1NRTCcsXG4gICAgLy8gUElEXG4gICAgUElEOiAnUElEJywgUElERTogJ1BJRCcsIFBJREFUOiAnUElEJyxcbiAgICAvLyBTdHJpbmcgZnVuY3Rpb25zXG4gICAgTEVOOiAnTEVOJywgTEVGVDogJ0xFRlQnLCBSSUdIVDogJ1JJR0hUJywgTUlEOiAnTUlEJyxcbiAgICBDT05DQVQ6ICdDT05DQVQnLCBGSU5EOiAnRklORCcsIElOU0VSVDogJ0lOU0VSVCcsIERFTEVURTogJ0RFTEVURScsXG4gICAgVVBQRVI6ICdVUFBFUl9DQVNFJywgTE9XRVI6ICdMT1dFUl9DQVNFJyxcbiAgICAvLyBNU0cgLyBHU1YgLyBTU1YgLyBNb3Rpb24gXHUyMDE0IGNhbnZhcyBwbGFjZWhvbGRlclxuICAgIE1TRzogJ01PVkUnLCBHU1Y6ICdNT1ZFJywgU1NWOiAnTU9WRScsXG4gICAgTUFKOiAnTU9WRScsIE1BTTogJ01PVkUnLCBNQVM6ICdNT1ZFJyxcbiAgfTtcbiAgcmV0dXJuIG1hcFt1cHBlcl0gfHwgJ01PVkUnO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgRXhwb3J0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgZnVuY3Rpb24gZXhwb3J0Um9ja3dlbGwocHJvamVjdDogTm9ybWFsaXplZFByb2plY3QpOiBFeHBvcnRSZXN1bHQge1xuICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBzaWRlY2FyID0gcHJvamVjdC5zaWRlY2FyO1xuXG4gIGNvbnN0IGNvbnRyb2xsZXJUYWdzID0gcHJvamVjdC5nbG9iYWxUYWdzLm1hcCh0YWcgPT4gdGFnVG9MNVhUYWcodGFnKSk7XG4gIGNvbnN0IHByb2dyYW1zID0gcHJvamVjdC5wb3VzLm1hcChwb3UgPT4gcG91VG9MNVhQcm9ncmFtKHBvdSwgd2FybmluZ3MpKTtcblxuICAvLyBSZXN0b3JlIHByZXNlcnZlZCBVRFQvQU9JIGRhdGEgZnJvbSBzaWRlY2FyXG4gIGNvbnN0IHByZXNlcnZlZERhdGFUeXBlcyA9IHNpZGVjYXIudW5tYXBwZWRFbGVtZW50c1xuICAgIC5maWx0ZXIodSA9PiB1LnJlYXNvbi5zdGFydHNXaXRoKCdVc2VyLURlZmluZWQgVHlwZScpKVxuICAgIC5tYXAodSA9PiB1LnZlbmRvclNwZWNpZmljRGF0YSk7XG5cbiAgY29uc3QgcHJlc2VydmVkQU9JcyA9IHNpZGVjYXIudW5tYXBwZWRFbGVtZW50c1xuICAgIC5maWx0ZXIodSA9PiB1LnJlYXNvbi5zdGFydHNXaXRoKCdBT0k6JykpXG4gICAgLm1hcCh1ID0+IHUudmVuZG9yU3BlY2lmaWNEYXRhKTtcblxuICBjb25zdCBwcmVzZXJ2ZWRNb2R1bGVzID0gc2lkZWNhci51bm1hcHBlZEVsZW1lbnRzLmZpbmQodSA9PiB1LnJlYXNvbiA9PT0gJ01vZHVsZXMgZWxlbWVudCcpPy52ZW5kb3JTcGVjaWZpY0RhdGE7XG4gIGNvbnN0IHByZXNlcnZlZFRhc2tzID0gc2lkZWNhci51bm1hcHBlZEVsZW1lbnRzLmZpbmQodSA9PiB1LnJlYXNvbiA9PT0gJ1Rhc2tzIGVsZW1lbnQnKT8udmVuZG9yU3BlY2lmaWNEYXRhO1xuXG4gIC8vIEJ1aWxkIENvbnRyb2xsZXIgY2hpbGRyZW4gaW4gWFNELW1hbmRhdGVkIG9yZGVyOlxuICAvLyBEYXRhVHlwZXMgXHUyMTkyIE1vZHVsZXMgXHUyMTkyIEFkZE9uSW5zdHJ1Y3Rpb25EZWZpbml0aW9ucyBcdTIxOTIgVGFncyBcdTIxOTIgUHJvZ3JhbXMgXHUyMTkyIFRhc2tzIFx1MjE5MiBDU1QgXHUyMTkyIFdhbGxDbG9ja1RpbWUgXHUyMTkyIFRyZW5kcyBcdTIxOTIgRGF0YUxvZ3MgXHUyMTkyIFRpbWVTeW5jaHJvbml6ZVxuICBjb25zdCBjb250cm9sbGVyT2JqOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAnQF9OYW1lJzogc2lkZWNhci52ZW5kb3JTcGVjaWZpY0dsb2JhbHM/LlsnY29udHJvbGxlck5hbWUnXSA/PyBwcm9qZWN0LnByb2plY3ROYW1lLFxuICAgICdAX1Byb2Nlc3NvclR5cGUnOiBzaWRlY2FyLnZlbmRvclNwZWNpZmljR2xvYmFscz8uWydwcm9jZXNzb3JUeXBlJ10gPz8gJzE3NjktTDMzRVInLFxuICAgICdAX01ham9yUmV2JzogJzMyJyxcbiAgICAnQF9NaW5vclJldic6ICcwJyxcbiAgfTtcblxuICAvLyAxLiBEYXRhVHlwZXNcbiAgaWYgKHByZXNlcnZlZERhdGFUeXBlcy5sZW5ndGgpIHtcbiAgICBjb250cm9sbGVyT2JqWydEYXRhVHlwZXMnXSA9IHsgRGF0YVR5cGU6IHByZXNlcnZlZERhdGFUeXBlcyB9O1xuICB9XG5cbiAgLy8gMi4gTW9kdWxlcyAocmVzdG9yZWQgZnJvbSBzaWRlY2FyIGlmIGF2YWlsYWJsZSlcbiAgaWYgKHByZXNlcnZlZE1vZHVsZXMpIHtcbiAgICBjb250cm9sbGVyT2JqWydNb2R1bGVzJ10gPSBwcmVzZXJ2ZWRNb2R1bGVzO1xuICB9XG5cbiAgLy8gMy4gQWRkT25JbnN0cnVjdGlvbkRlZmluaXRpb25zXG4gIGlmIChwcmVzZXJ2ZWRBT0lzLmxlbmd0aCkge1xuICAgIGNvbnRyb2xsZXJPYmpbJ0FkZE9uSW5zdHJ1Y3Rpb25EZWZpbml0aW9ucyddID0geyBBZGRPbkluc3RydWN0aW9uRGVmaW5pdGlvbjogcHJlc2VydmVkQU9JcyB9O1xuICB9XG5cbiAgLy8gNC4gVGFnc1xuICBjb250cm9sbGVyT2JqWydUYWdzJ10gPSB7IFRhZzogY29udHJvbGxlclRhZ3MgfTtcblxuICAvLyA1LiBQcm9ncmFtc1xuICBjb250cm9sbGVyT2JqWydQcm9ncmFtcyddID0geyBQcm9ncmFtOiBwcm9ncmFtcyB9O1xuXG4gIC8vIDYuIFRhc2tzICh1c2UgcHJlc2VydmVkIGlmIGF2YWlsYWJsZSlcbiAgaWYgKHByZXNlcnZlZFRhc2tzKSB7XG4gICAgY29udHJvbGxlck9ialsnVGFza3MnXSA9IHByZXNlcnZlZFRhc2tzO1xuICB9IGVsc2Uge1xuICAgIGNvbnRyb2xsZXJPYmpbJ1Rhc2tzJ10gPSB7XG4gICAgICBUYXNrOiBbe1xuICAgICAgICAnQF9OYW1lJzogc2lkZWNhci52ZW5kb3JTcGVjaWZpY0dsb2JhbHM/LlsnbWFpblRhc2tOYW1lJ10gPz8gJ01haW5UYXNrJyxcbiAgICAgICAgJ0BfVHlwZSc6IHNpZGVjYXIudmVuZG9yU3BlY2lmaWNHbG9iYWxzPy5bJ21haW5UYXNrVHlwZSddID8/ICdDb250aW51b3VzJyxcbiAgICAgICAgJ0BfUHJpb3JpdHknOiAnMTAnLFxuICAgICAgICAnQF9XYXRjaGRvZyc6ICc1MDAnLFxuICAgICAgICAnQF9EaXNhYmxlVXBkYXRlT3V0cHV0cyc6ICdmYWxzZScsXG4gICAgICAgICdAX0luaGliaXRUYXNrJzogJ2ZhbHNlJyxcbiAgICAgICAgU2NoZWR1bGVkUHJvZ3JhbXM6IHtcbiAgICAgICAgICBTY2hlZHVsZWRQcm9ncmFtOiBwcm9qZWN0LnBvdXMubWFwKHAgPT4gKHtcbiAgICAgICAgICAgICdAX05hbWUnOiBwLm5hbWUuaW5jbHVkZXMoJ18nKSA/IHAubmFtZS5zcGxpdCgnXycpWzBdIDogcC5uYW1lXG4gICAgICAgICAgfSkpXG4gICAgICAgIH1cbiAgICAgIH1dXG4gICAgfTtcbiAgfVxuXG4gIC8vIDctMTEuIENTVCwgV2FsbENsb2NrVGltZSwgVHJlbmRzLCBEYXRhTG9ncywgVGltZVN5bmNocm9uaXplXG4gIGNvbnRyb2xsZXJPYmpbJ0NTVCddID0geyAnQF9NYXN0ZXJJRCc6ICcwJyB9O1xuICBjb250cm9sbGVyT2JqWydXYWxsQ2xvY2tUaW1lJ10gPSB7ICdAX0xvY2FsVGltZUFkanVzdG1lbnQnOiAnMCcsICdAX1RpbWVab25lJzogJzAnIH07XG4gIGNvbnRyb2xsZXJPYmpbJ1RyZW5kcyddID0ge307XG4gIGNvbnRyb2xsZXJPYmpbJ0RhdGFMb2dzJ10gPSB7fTtcbiAgY29udHJvbGxlck9ialsnVGltZVN5bmNocm9uaXplJ10gPSB7ICdAX1ByaW9yaXR5MSc6ICcxMjgnLCAnQF9Qcmlvcml0eTInOiAnMTI4JywgJ0BfUFRQRW5hYmxlJzogJ2ZhbHNlJyB9O1xuXG4gIGNvbnN0IG9iaiA9IHtcbiAgICBSU0xvZ2l4NTAwMENvbnRlbnQ6IHtcbiAgICAgICdAX1NjaGVtYVJldmlzaW9uJzogc2lkZWNhci52ZW5kb3JTcGVjaWZpY0dsb2JhbHM/Llsnc2NoZW1hUmV2aXNpb24nXSA/PyAnMS4wJyxcbiAgICAgICdAX1NvZnR3YXJlUmV2aXNpb24nOiAnMzIuMCcsXG4gICAgICAnQF9UYXJnZXROYW1lJzogcHJvamVjdC5wcm9qZWN0TmFtZSxcbiAgICAgICdAX1RhcmdldFR5cGUnOiAnQ29udHJvbGxlcicsXG4gICAgICAnQF9Db250YWluc0NvbnRleHQnOiAndHJ1ZScsXG4gICAgICBDb250cm9sbGVyOiBjb250cm9sbGVyT2JqLFxuICAgIH0sXG4gIH07XG5cbiAgcmV0dXJuIHsgb2s6IHRydWUsIHhtbENvbnRlbnQ6IGJ1aWxkWE1MKG9iaiksIGVycm9ycywgd2FybmluZ3MgfTtcbn1cblxuZnVuY3Rpb24gdGFnVG9MNVhUYWcodGFnOiBOb3JtYWxpemVkVGFnKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgICdAX05hbWUnOiB0YWcubmFtZSxcbiAgICAnQF9UYWdUeXBlJzogJ0Jhc2UnLFxuICAgICdAX0RhdGFUeXBlJzogaWVjVHlwZVRvUm9ja3dlbGwodGFnLmRhdGFUeXBlKSxcbiAgICAnQF9SYWRpeCc6ICdEZWNpbWFsJyxcbiAgICAnQF9FeHRlcm5hbEFjY2Vzcyc6ICdSZWFkL1dyaXRlJyxcbiAgICBEZXNjcmlwdGlvbjogdGFnLmRlc2NyaXB0aW9uID8geyAnI2NkYXRhJzogdGFnLmRlc2NyaXB0aW9uIH0gOiB1bmRlZmluZWQsXG4gIH07XG59XG5cbmZ1bmN0aW9uIHBvdVRvTDVYUHJvZ3JhbShwb3U6IE5vcm1hbGl6ZWRQT1UsIHdhcm5pbmdzOiBzdHJpbmdbXSk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgY29uc3QgbG9jYWxUYWdzID0gcG91LmxvY2FsVGFncy5tYXAodGFnVG9MNVhUYWcpO1xuICBsZXQgcm91dGluZTogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG5cbiAgaWYgKHBvdS5sYW5ndWFnZSA9PT0gJ0xEJyAmJiBwb3UubGFkZGVyUHJvZ3JhbSkge1xuICAgIHJvdXRpbmUgPSB7XG4gICAgICAnQF9OYW1lJzogJ01haW5Sb3V0aW5lJyxcbiAgICAgICdAX1R5cGUnOiAnUkxMJyxcbiAgICAgIFJMTENvbnRlbnQ6IHtcbiAgICAgICAgUnVuZzogcG91LmxhZGRlclByb2dyYW0ucnVuZ3MubWFwKHJ1bmcgPT4gKHtcbiAgICAgICAgICAnQF9OdW1iZXInOiBTdHJpbmcocnVuZy5udW1iZXIpLFxuICAgICAgICAgICdAX1R5cGUnOiBydW5nLnZlbmRvclR5cGUgfHwgJ04nLFxuICAgICAgICAgIENvbW1lbnQ6IHJ1bmcuY29tbWVudCA/IHsgJyNjZGF0YSc6IHJ1bmcuY29tbWVudCB9IDogdW5kZWZpbmVkLFxuICAgICAgICAgIFRleHQ6IHsgJyNjZGF0YSc6IGJ1aWxkUnVuZ1RleHQocnVuZykgfSxcbiAgICAgICAgfSkpLFxuICAgICAgfSxcbiAgICB9O1xuICB9IGVsc2UgaWYgKHBvdS5sYW5ndWFnZSA9PT0gJ0ZCRCcgJiYgcG91LmZiZFByb2dyYW0pIHtcbiAgICByb3V0aW5lID0gYnVpbGRSb2Nrd2VsbEZCRFJvdXRpbmUocG91LmZiZFByb2dyYW0pO1xuICB9IGVsc2UgaWYgKHBvdS5sYW5ndWFnZSA9PT0gJ1NUJyAmJiBwb3Uuc3RTb3VyY2UpIHtcbiAgICAvLyBFeHBvcnQgU1QgYXMgbGluZS1ieS1saW5lIDxMaW5lIE51bWJlcj1cIk5cIj48IVtDREFUQVsuLi5dXT48L0xpbmU+IHBlciBMNVggc3BlY1xuICAgIGNvbnN0IHN0TGluZXMgPSBwb3Uuc3RTb3VyY2Uuc3BsaXQoJ1xcbicpO1xuICAgIHJvdXRpbmUgPSB7XG4gICAgICAnQF9OYW1lJzogJ01haW5Sb3V0aW5lJyxcbiAgICAgICdAX1R5cGUnOiAnU1QnLFxuICAgICAgU1RDb250ZW50OiB7XG4gICAgICAgIExpbmU6IHN0TGluZXMubWFwKChsaW5lLCBpZHgpID0+ICh7XG4gICAgICAgICAgJ0BfTnVtYmVyJzogU3RyaW5nKGlkeCksXG4gICAgICAgICAgJyNjZGF0YSc6IGxpbmUsXG4gICAgICAgIH0pKSxcbiAgICAgIH0sXG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICB3YXJuaW5ncy5wdXNoKGBQT1UgXCIke3BvdS5uYW1lfVwiOiBsYW5ndWFnZSAke3BvdS5sYW5ndWFnZX0gXHUyMDE0IGV4cG9ydGluZyBhcyBlbXB0eSBSTEwgcm91dGluZWApO1xuICAgIHJvdXRpbmUgPSB7XG4gICAgICAnQF9OYW1lJzogJ01haW5Sb3V0aW5lJyxcbiAgICAgICdAX1R5cGUnOiAnUkxMJyxcbiAgICAgIFJMTENvbnRlbnQ6IHsgUnVuZzogW3sgJ0BfTnVtYmVyJzogJzAnLCAnQF9UeXBlJzogJ04nLCBUZXh0OiB7ICcjY2RhdGEnOiAnTk9QKCk7JyB9IH1dIH0sXG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgJ0BfTmFtZSc6IHBvdS5uYW1lLFxuICAgICdAX1R5cGUnOiAnTm9ybWFsJyxcbiAgICAnQF9NYWluUm91dGluZU5hbWUnOiAnTWFpblJvdXRpbmUnLFxuICAgIFRhZ3M6IHsgVGFnOiBsb2NhbFRhZ3MgfSxcbiAgICBSb3V0aW5lczogeyBSb3V0aW5lOiByb3V0aW5lIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGJ1aWxkUnVuZ1RleHQocnVuZzogUnVuZyk6IHN0cmluZyB7XG4gIGNvbnN0IHBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIC8vIEVtaXQgbWFpbiBlbGVtZW50c1xuICBmb3IgKGNvbnN0IGVsIG9mIHJ1bmcuZWxlbWVudHMpIHtcbiAgICBwYXJ0cy5wdXNoKGVsZW1lbnRUb1J1bmdUZXh0KGVsKSk7XG4gIH1cblxuICAvLyBFbWl0IGJyYW5jaGVzIGFzIFsgbGVnMSAsbGVnMiBdIGJyYWNrZXQgc3ludGF4IChMNVggbmV1dHJhbCB0ZXh0IGZvcm1hdClcbiAgaWYgKHJ1bmcuYnJhbmNoZXMubGVuZ3RoID4gMCkge1xuICAgIC8vIENvbGxlY3QgdGhlIG1haW4tcGF0aCBlbGVtZW50cyB0aGF0IGFyZSBjb250YWN0cyAoYmVmb3JlIGNvaWxzKSBhcyBmaXJzdCBsZWdcbiAgICBjb25zdCBjb2lsSW5zdHJzID0gbmV3IFNldChbJ09URScsICdPVEwnLCAnT1RVJywgJ09UTicsICdSRVMnXSk7XG4gICAgY29uc3QgZmlyc3RDb2lsSWR4ID0gcGFydHMuZmluZEluZGV4KHAgPT4gY29pbEluc3Rycy5oYXMocC5zcGxpdCgnKCcpWzBdKSk7XG4gICAgY29uc3QgaW5zZXJ0QXQgPSBmaXJzdENvaWxJZHggPj0gMCA/IGZpcnN0Q29pbElkeCA6IHBhcnRzLmxlbmd0aDtcblxuICAgIC8vIEJ1aWxkIGxlZ3M6IGZpcnN0IGxlZyBpcyBlbXB0eSAobWFpbiBwYXRoIGNvbnRpbnVlcyksIHJlbWFpbmluZyBsZWdzIGFyZSBicmFuY2hlc1xuICAgIGNvbnN0IGxlZ1N0cmluZ3M6IHN0cmluZ1tdID0gW107XG4gICAgLy8gRmlyc3QgbGVnOiBlbGVtZW50cyBhbHJlYWR5IG9uIG1haW4gcGF0aCBiZWZvcmUgdGhlIGNvaWwgKG5vbmUgdG8gYWRkIFx1MjAxNCB0aGV5J3JlIGFscmVhZHkgaW4gcGFydHMpXG4gICAgLy8gRm9yIGJyYWNrZXQgZm9ybWF0LCBlYWNoIGJyYW5jaCBiZWNvbWVzIGEgbGVnXG4gICAgZm9yIChjb25zdCBicmFuY2ggb2YgcnVuZy5icmFuY2hlcykge1xuICAgICAgY29uc3QgbGVnUGFydHM6IHN0cmluZ1tdID0gW107XG4gICAgICBmb3IgKGNvbnN0IGVsIG9mIGJyYW5jaC5lbGVtZW50cykge1xuICAgICAgICBsZWdQYXJ0cy5wdXNoKGVsZW1lbnRUb1J1bmdUZXh0KGVsKSk7XG4gICAgICB9XG4gICAgICBsZWdTdHJpbmdzLnB1c2gobGVnUGFydHMuam9pbignJykpO1xuICAgIH1cblxuICAgIC8vIEJ1aWxkIGJyYWNrZXQgYmxvY2s6IFtmaXJzdExlZyAsbGVnMiAsbGVnMyAuLi5dXG4gICAgLy8gVGhlIFwiZmlyc3QgbGVnXCIgaXMgdGhlIG1haW4gcGF0aCBzZWdtZW50IHRoYXQgd2FzIGFscmVhZHkgZW1pdHRlZCBcdTIwMTRcbiAgICAvLyBleHRyYWN0IGl0IGZyb20gcGFydHNbMC4uaW5zZXJ0QXQtMV0gYW5kIHBsYWNlIGl0IGFzIGZpcnN0IGxlZ1xuICAgIGNvbnN0IG1haW5MZWcgPSBwYXJ0cy5zcGxpY2UoMCwgaW5zZXJ0QXQpLmpvaW4oJycpO1xuICAgIGNvbnN0IGFsbExlZ3MgPSBbbWFpbkxlZywgLi4ubGVnU3RyaW5nc107XG4gICAgY29uc3QgYnJhY2tldEJsb2NrID0gJ1snICsgYWxsTGVnc1swXSArIGFsbExlZ3Muc2xpY2UoMSkubWFwKGwgPT4gJyAsJyArIGwpLmpvaW4oJycpICsgJyBdJztcbiAgICBwYXJ0cy51bnNoaWZ0KGJyYWNrZXRCbG9jayk7XG4gIH1cblxuICByZXR1cm4gcGFydHMuam9pbignJykgKyAnOyc7XG59XG5cbmZ1bmN0aW9uIGVsZW1lbnRUb1J1bmdUZXh0KGVsOiBMYWRkZXJFbGVtZW50KTogc3RyaW5nIHtcbiAgaWYgKGVsLmtpbmQgPT09ICdjb250YWN0Jykge1xuICAgIGNvbnN0IGMgPSBlbCBhcyBDb250YWN0RWxlbWVudDtcbiAgICBjb25zdCBpbnN0ck1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsgTk86ICdYSUMnLCBOQzogJ1hJTycsIFBfQ09OVEFDVDogJ09TUicsIE5fQ09OVEFDVDogJ09TRicgfTtcbiAgICBjb25zdCBpbnN0ck5hbWUgPSBpbnN0ck1hcFtjLnR5cGVdIHx8ICdYSUMnO1xuICAgIC8vIE9TUi9PU0Ygd2l0aCB2ZW5kb3JBcmdzOiBlbWl0IGJvdGggYXJncyBmb3IgbG9zc2xlc3Mgcm91bmQtdHJpcFxuICAgIGNvbnN0IHZlbmRvckFyZ3MgPSAoZWwgYXMgYW55KS52ZW5kb3JBcmdzIGFzIHN0cmluZ1tdIHwgdW5kZWZpbmVkO1xuICAgIGlmICh2ZW5kb3JBcmdzICYmIHZlbmRvckFyZ3MubGVuZ3RoID4gMSkge1xuICAgICAgcmV0dXJuIGAke2luc3RyTmFtZX0oJHt2ZW5kb3JBcmdzLmpvaW4oJywnKX0pYDtcbiAgICB9XG4gICAgcmV0dXJuIGAke2luc3RyTmFtZX0oJHtjLnRhZy5uYW1lfSlgO1xuICB9IGVsc2UgaWYgKGVsLmtpbmQgPT09ICdjb2lsJykge1xuICAgIGNvbnN0IGMgPSBlbCBhcyBDb2lsRWxlbWVudDtcbiAgICBjb25zdCBpbnN0ck1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsgbm9ybWFsOiAnT1RFJywgbmVnYXRlZDogJ09UTicsIHNldDogJ09UTCcsIHJlc2V0OiAnUkVTJywgbGF0Y2g6ICdPVEwnLCB1bmxhdGNoOiAnT1RVJyB9O1xuICAgIHJldHVybiBgJHtpbnN0ck1hcFtjLnR5cGVdIHx8ICdPVEUnfSgke2MudGFnLm5hbWV9KWA7XG4gIH0gZWxzZSBpZiAoZWwua2luZCA9PT0gJ2Jsb2NrJykge1xuICAgIGNvbnN0IGIgPSBlbCBhcyBCbG9ja0VsZW1lbnQ7XG4gICAgLy8gVXNlIHZlbmRvck9yaWdpbmFsTmFtZSBmb3IgbG9zc2xlc3Mgcm91bmQtdHJpcCB3aGVuIGF2YWlsYWJsZVxuICAgIGlmIChiLnZlbmRvck9yaWdpbmFsTmFtZSkge1xuICAgICAgaWYgKGIucGlucyAmJiBPYmplY3Qua2V5cyhiLnBpbnMpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgcGluVmFscyA9IE9iamVjdC52YWx1ZXMoYi5waW5zKS5tYXAoKHA6IGFueSkgPT4gcC5uYW1lIHx8ICcnKTtcbiAgICAgICAgcmV0dXJuIGAke2IudmVuZG9yT3JpZ2luYWxOYW1lfSgke3BpblZhbHMuam9pbignLCcpfSlgO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGAke2IudmVuZG9yT3JpZ2luYWxOYW1lfSgke2IuaW5zdGFuY2VOYW1lfSlgO1xuICAgIH1cbiAgICBjb25zdCBpbnN0ck1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgIC8vIFRpbWVyc1xuICAgICAgVE9OOiAnVE9OJywgVE9GOiAnVE9GJywgVFA6ICdUT04nLCBUT05SOiAnVE9OUicsIFJUTzogJ1JUTycsXG4gICAgICAvLyBDb3VudGVyc1xuICAgICAgQ1RVOiAnQ1RVJywgQ1REOiAnQ1REJywgQ1RVRDogJ0NUVUQnLFxuICAgICAgLy8gQmlzdGFibGUgLyBlZGdlXG4gICAgICBTUjogJ09UTCcsIFJTOiAnT1RVJywgUlRSSUc6ICdPU1InLCBGVFJJRzogJ09TRicsXG4gICAgICAvLyBNYXRoXG4gICAgICBBREQ6ICdBREQnLCBTVUI6ICdTVUInLCBNVUw6ICdNVUwnLCBESVY6ICdESVYnLCBNT0Q6ICdNT0QnLFxuICAgICAgQUJTOiAnQUJTJywgU1FSVDogJ1NRUicsIE5FRzogJ05FRycsXG4gICAgICBTSU46ICdTSU4nLCBDT1M6ICdDT1MnLCBUQU46ICdUQU4nLCBBVEFOOiAnQVROJywgQVNJTjogJ0FTTicsIEFDT1M6ICdBQ1MnLFxuICAgICAgTE46ICdMTicsIExPRzogJ0xPRycsXG4gICAgICAvLyBDb21wYXJpc29uXG4gICAgICBFUTogJ0VRVScsIE5FOiAnTkVRJywgR1Q6ICdHUlQnLCBHRTogJ0dFUScsIExUOiAnTEVTJywgTEU6ICdMRVEnLFxuICAgICAgTElNSVQ6ICdMSU0nLFxuICAgICAgLy8gRGF0YSAvIHNlbGVjdGlvblxuICAgICAgTU9WRTogJ01PVicsIFNFTDogJ1NFTCcsIE1VWDogJ01VWCcsIE1JTjogJ01JTicsIE1BWDogJ01BWCcsXG4gICAgICAvLyBTY2FsaW5nXG4gICAgICBTQ0FMRTogJ1NDTCcsXG4gICAgICAvLyBCaXR3aXNlXG4gICAgICBBTkQ6ICdBTkQnLCBPUjogJ09SJywgTk9UOiAnTk9UJywgWE9SOiAnWE9SJywgQlREOiAnQlREJywgU0laRTogJ1NJWkUnLFxuICAgICAgLy8gRklGTyAvIFNlcXVlbmNlclxuICAgICAgRkZMOiAnRkZMJywgRkZVOiAnRkZVJywgTEZMOiAnTEZMJywgTEZVOiAnTEZVJyxcbiAgICAgIFNRTzogJ1NRTycsIFNRSTogJ1NRSScsIFNRTDogJ1NRTCcsXG4gICAgICAvLyBQSURcbiAgICAgIFBJRDogJ1BJRCcsXG4gICAgICAvLyBTdHJpbmdcbiAgICAgIExFTjogJ0xFTicsIExFRlQ6ICdMRUZUJywgUklHSFQ6ICdSSUdIVCcsIE1JRDogJ01JRCcsXG4gICAgICBDT05DQVQ6ICdDT05DQVQnLCBGSU5EOiAnRklORCcsIElOU0VSVDogJ0lOU0VSVCcsIERFTEVURTogJ0RFTEVURScsXG4gICAgICBVUFBFUl9DQVNFOiAnVVBQRVInLCBMT1dFUl9DQVNFOiAnTE9XRVInLFxuICAgIH07XG4gICAgY29uc3QgaW5zdHIgPSBpbnN0ck1hcFtiLmZiVHlwZV0gfHwgYi5mYlR5cGU7XG4gICAgaWYgKGIucGlucyAmJiBPYmplY3Qua2V5cyhiLnBpbnMpLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IHBpblZhbHMgPSBPYmplY3QudmFsdWVzKGIucGlucykubWFwKChwOiBhbnkpID0+IHAubmFtZSB8fCAnJyk7XG4gICAgICByZXR1cm4gYCR7aW5zdHJ9KCR7cGluVmFscy5qb2luKCcsJyl9KWA7XG4gICAgfVxuICAgIHJldHVybiBgJHtpbnN0cn0oJHtiLmluc3RhbmNlTmFtZX0pYDtcbiAgfVxuICByZXR1cm4gJyc7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBGQkQgRXhwb3J0IChTaGVldC9GQkRfQmxvY2svSVJlZi9PUmVmL1dpcmUpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBidWlsZFJvY2t3ZWxsRkJEUm91dGluZShmYmQ6IEZCRFByb2dyYW0pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIGNvbnN0IGZiZEJsb2NrczogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSA9IFtdO1xuICBjb25zdCBpcmVmczogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSA9IFtdO1xuICBjb25zdCBvcmVmczogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSA9IFtdO1xuICBjb25zdCB3aXJlczogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSA9IFtdO1xuXG4gIGNvbnN0IGllY1RvUm9ja3dlbGxCbG9jazogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAvLyBCb29sZWFuIGdhdGVzXG4gICAgQU5EOiAnQkFORCcsIE9SOiAnQk9SJywgTk9UOiAnQk5PVCcsIFhPUjogJ0JYT1InLFxuICAgIC8vIEFyaXRobWV0aWNcbiAgICBBREQ6ICdBREQnLCBTVUI6ICdTVUInLCBNVUw6ICdNVUwnLCBESVY6ICdESVYnLCBNT0Q6ICdNT0QnLFxuICAgIEFCUzogJ0FCUycsIFNRUlQ6ICdTUVInLCBORUc6ICdORUcnLFxuICAgIFNJTjogJ1NJTicsIENPUzogJ0NPUycsIFRBTjogJ1RBTicsIEFUQU46ICdBVE4nLCBBU0lOOiAnQVNOJywgQUNPUzogJ0FDUycsXG4gICAgTE46ICdMTicsIExPRzogJ0xPRycsXG4gICAgLy8gVGltZXJzIC8gY291bnRlcnNcbiAgICBUT046ICdUT04nLCBUT0Y6ICdUT0YnLCBUUDogJ1RQJywgVE9OUjogJ1RPTlInLFxuICAgIENUVTogJ0NUVScsIENURDogJ0NURCcsIENUVUQ6ICdDVFVEJyxcbiAgICAvLyBCaXN0YWJsZSAvIGVkZ2VcbiAgICBTUjogJ1NSJywgUlM6ICdSUycsIFJUUklHOiAnT1NSJywgRlRSSUc6ICdPU0YnLFxuICAgIC8vIENvbXBhcmlzb25cbiAgICBHVDogJ0dSVCcsIEdFOiAnR0VRJywgTFQ6ICdMRVMnLCBMRTogJ0xFUScsIEVROiAnRVFVJywgTkU6ICdORVEnLFxuICAgIExJTUlUOiAnTElNJyxcbiAgICAvLyBEYXRhIC8gc2VsZWN0aW9uXG4gICAgTU9WRTogJ01PVicsIFNFTDogJ1NFTCcsIE1VWDogJ01VWCcsIE1JTjogJ01JTicsIE1BWDogJ01BWCcsXG4gICAgLy8gU2NhbGluZ1xuICAgIFNDQUxFOiAnU0NMJywgVU5TQ0FMRTogJ1NDUCcsXG4gICAgLy8gQ29udmVyc2lvblxuICAgIFRSVU5DOiAnVFJVTkMnLCBST1VORDogJ1JPVU5EJyxcbiAgICBJTlRfVE9fUkVBTDogJ0lOVF9UT19SRUFMJywgUkVBTF9UT19JTlQ6ICdSRUFMX1RPX0lOVCcsXG4gICAgRElOVF9UT19SRUFMOiAnRElOVF9UT19SRUFMJywgUkVBTF9UT19ESU5UOiAnUkVBTF9UT19ESU5UJyxcbiAgICAvLyBCaXR3aXNlXG4gICAgQlREOiAnQlREJywgU0laRTogJ1NJWkUnLFxuICAgIC8vIEZJRk8gLyBTZXF1ZW5jZXJcbiAgICBGRkw6ICdGRkwnLCBGRlU6ICdGRlUnLCBMRkw6ICdMRkwnLCBMRlU6ICdMRlUnLFxuICAgIFNRTzogJ1NRTycsIFNRSTogJ1NRSScsIFNRTDogJ1NRTCcsXG4gICAgLy8gUElEXG4gICAgUElEOiAnUElEJyxcbiAgICAvLyBTdHJpbmdcbiAgICBMRU46ICdMRU4nLCBMRUZUOiAnTEVGVCcsIFJJR0hUOiAnUklHSFQnLCBNSUQ6ICdNSUQnLFxuICAgIENPTkNBVDogJ0NPTkNBVCcsIEZJTkQ6ICdGSU5EJywgSU5TRVJUOiAnSU5TRVJUJywgREVMRVRFOiAnREVMRVRFJyxcbiAgICBVUFBFUl9DQVNFOiAnVVBQRVInLCBMT1dFUl9DQVNFOiAnTE9XRVInLFxuICB9O1xuXG4gIGZvciAoY29uc3Qgbm9kZSBvZiBmYmQubm9kZXMpIHtcbiAgICBpZiAobm9kZS50eXBlID09PSAnSU5fVkFSSUFCTEUnKSB7XG4gICAgICBpcmVmcy5wdXNoKHtcbiAgICAgICAgJ0BfSUQnOiBub2RlLmlkLFxuICAgICAgICAnQF9YJzogU3RyaW5nKG5vZGUucG9zaXRpb24ueCksXG4gICAgICAgICdAX1knOiBTdHJpbmcobm9kZS5wb3NpdGlvbi55KSxcbiAgICAgICAgJ0BfT3BlcmFuZCc6IG5vZGUudGFnPy5uYW1lIHx8ICcnLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmIChub2RlLnR5cGUgPT09ICdPVVRfVkFSSUFCTEUnKSB7XG4gICAgICBvcmVmcy5wdXNoKHtcbiAgICAgICAgJ0BfSUQnOiBub2RlLmlkLFxuICAgICAgICAnQF9YJzogU3RyaW5nKG5vZGUucG9zaXRpb24ueCksXG4gICAgICAgICdAX1knOiBTdHJpbmcobm9kZS5wb3NpdGlvbi55KSxcbiAgICAgICAgJ0BfT3BlcmFuZCc6IG5vZGUudGFnPy5uYW1lIHx8ICcnLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHJvY2tUeXBlID0gbm9kZS52ZW5kb3JPcmlnaW5hbE5hbWUgfHwgaWVjVG9Sb2Nrd2VsbEJsb2NrW25vZGUudHlwZV0gfHwgbm9kZS50eXBlO1xuICAgICAgLy8gUmVhbCBMNVggZm9ybWF0OiA8QmxvY2sgVHlwZT1cIlRPTlwiIFZpc2libGVQaW5zPVwiSU4gUFQgUSBFVFwiIE9wZXJhbmQ9XCJUaW1lcjFcIi8+XG4gICAgICBjb25zdCB2aXNpYmxlUGlucyA9IFtcbiAgICAgICAgLi4uKG5vZGUuaW5wdXRzIHx8IFtdKS5tYXAocCA9PiBwLm5hbWUpLFxuICAgICAgICAuLi4obm9kZS5vdXRwdXRzIHx8IFtdKS5tYXAocCA9PiBwLm5hbWUpLFxuICAgICAgXS5qb2luKCcgJyk7XG4gICAgICBmYmRCbG9ja3MucHVzaCh7XG4gICAgICAgICdAX1R5cGUnOiByb2NrVHlwZSxcbiAgICAgICAgJ0BfSUQnOiBub2RlLmlkLFxuICAgICAgICAnQF9YJzogU3RyaW5nKG5vZGUucG9zaXRpb24ueCksXG4gICAgICAgICdAX1knOiBTdHJpbmcobm9kZS5wb3NpdGlvbi55KSxcbiAgICAgICAgJ0BfT3BlcmFuZCc6IG5vZGUuaW5zdGFuY2VOYW1lIHx8ICcnLFxuICAgICAgICAnQF9WaXNpYmxlUGlucyc6IHZpc2libGVQaW5zLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gQnVpbGQgYSBub2RlSWQgXHUyMTkyIG5vZGUudHlwZSBtYXAgZm9yIElSZWYvT1JlZiBwaW4gY29udmVudGlvblxuICBjb25zdCBub2RlVHlwZU1hcCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIGZvciAoY29uc3Qgbm9kZSBvZiBmYmQubm9kZXMpIHtcbiAgICBub2RlVHlwZU1hcC5zZXQobm9kZS5pZCwgbm9kZS50eXBlKTtcbiAgfVxuXG4gIGZvciAoY29uc3Qgd2lyZSBvZiBmYmQud2lyZXMpIHtcbiAgICBjb25zdCBmcm9tTm9kZVR5cGUgPSBub2RlVHlwZU1hcC5nZXQod2lyZS5mcm9tLm5vZGVJZCkgfHwgJyc7XG4gICAgY29uc3QgdG9Ob2RlVHlwZSA9IG5vZGVUeXBlTWFwLmdldCh3aXJlLnRvLm5vZGVJZCkgfHwgJyc7XG4gICAgY29uc3Qgd2lyZU9iajogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICdAX0Zyb21JRCc6IHdpcmUuZnJvbS5ub2RlSWQsXG4gICAgICAnQF9Ub0lEJzogd2lyZS50by5ub2RlSWQsXG4gICAgfTtcbiAgICAvLyBJUmVmIChJTl9WQVJJQUJMRSkgXHUyMTkyIEZyb21QYXJhbSBzaG91bGQgYmUgJycgcGVyIHNwZWNcbiAgICBpZiAoZnJvbU5vZGVUeXBlICE9PSAnSU5fVkFSSUFCTEUnKSB7XG4gICAgICB3aXJlT2JqWydAX0Zyb21QYXJhbSddID0gd2lyZS5mcm9tLnBpbjtcbiAgICB9IGVsc2Uge1xuICAgICAgd2lyZU9ialsnQF9Gcm9tUGFyYW0nXSA9ICcnO1xuICAgIH1cbiAgICAvLyBPUmVmIChPVVRfVkFSSUFCTEUpIFx1MjE5MiBUb1BhcmFtIHNob3VsZCBiZSAnJyBwZXIgc3BlY1xuICAgIGlmICh0b05vZGVUeXBlICE9PSAnT1VUX1ZBUklBQkxFJykge1xuICAgICAgd2lyZU9ialsnQF9Ub1BhcmFtJ10gPSB3aXJlLnRvLnBpbjtcbiAgICB9IGVsc2Uge1xuICAgICAgd2lyZU9ialsnQF9Ub1BhcmFtJ10gPSAnJztcbiAgICB9XG4gICAgd2lyZXMucHVzaCh3aXJlT2JqKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgJ0BfTmFtZSc6ICdNYWluUm91dGluZScsXG4gICAgJ0BfVHlwZSc6ICdGQkQnLFxuICAgIEZCRENvbnRlbnQ6IHtcbiAgICAgICdAX1NoZWV0U2l6ZSc6ICdMZXR0ZXIgKDguNXgxMWluKScsXG4gICAgICAnQF9TaGVldE9yaWVudGF0aW9uJzogJ0xhbmRzY2FwZScsXG4gICAgICBTaGVldDoge1xuICAgICAgICAnQF9OdW1iZXInOiAnMScsXG4gICAgICAgIEJsb2NrOiBmYmRCbG9ja3MubGVuZ3RoID8gZmJkQmxvY2tzIDogdW5kZWZpbmVkLFxuICAgICAgICBJUmVmOiBpcmVmcy5sZW5ndGggPyBpcmVmcyA6IHVuZGVmaW5lZCxcbiAgICAgICAgT1JlZjogb3JlZnMubGVuZ3RoID8gb3JlZnMgOiB1bmRlZmluZWQsXG4gICAgICAgIFdpcmU6IHdpcmVzLmxlbmd0aCA/IHdpcmVzIDogdW5kZWZpbmVkLFxuICAgICAgfSxcbiAgICB9LFxuICB9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBU0EsU0FBUyxVQUFVLFVBQVUsTUFBTSxNQUFNLE9BQU8sa0JB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VSxPQUFPO0FBQUEsTUFDM0QsS0FBTSxFQUFFLE1BQU0sS0FBSyxDQUFDLEtBQUssS0FBaUIsVUFBVSxPQUFPO0FBQUEsTUFDM0QsS0FBTSxFQUFFLE1BQU0sS0FBSyxDQUFDLEtBQUssS0FBaUIsVUFBVSxPQUFPO0FBQUEsTUFDM0QsSUFBTSxFQUFFLE1BQU0sR0FBRyxLQUFLLENBQUMsS0FBSyxLQUFLLE9BQVMsVUFBVSxPQUFPO0FBQUEsTUFDM0QsSUFBTSxFQUFFLE1BQU0sR0FBRyxLQUFLLENBQUMsS0FBSyxLQUFLLE9BQVMsVUFBVSxPQUFPO0FBQUEsSUFDN0QsR0FBRyxJQUFJO0FBQUEsRUFDVDtBQUlBLE1BQUksWUFBWSxLQUFLLEdBQUc7QUFDdEIsV0FBTyxVQUFVLE9BQU8sWUFBWSxLQUFLLEdBQUcsTUFBTSxZQUFZO0FBQUEsTUFDNUQsSUFBUSxFQUFFLE1BQU0sS0FBSyxDQUFDLEtBQUssTUFBTSxJQUFJLElBQU0sVUFBVSxPQUFPO0FBQUEsTUFDNUQsSUFBUSxFQUFFLE1BQU0sR0FBRyxLQUFLLENBQUMsS0FBSyxLQUFLLE9BQVEsVUFBVSxPQUFPO0FBQUEsTUFDNUQsS0FBUSxFQUFFLE1BQU0sS0FBSyxDQUFDLEtBQUssTUFBTSxJQUFJLElBQU0sVUFBVSxPQUFPO0FBQUEsTUFDNUQsSUFBUSxFQUFFLE1BQU0sR0FBRyxLQUFLLENBQUMsS0FBSyxLQUFLLE9BQVEsVUFBVSxPQUFPO0FBQUEsTUFDNUQsSUFBUSxFQUFFLE1BQU0sR0FBRyxLQUFLLENBQUMsS0FBSyxLQUFLLE9BQVEsVUFBVSxPQUFPO0FBQUEsTUFDNUQsSUFBUSxFQUFFLE1BQU0sR0FBRyxLQUFLLENBQUMsS0FBSyxLQUFLLE9BQVEsVUFBVSxPQUFPO0FBQUEsTUFDNUQsSUFBUSxFQUFFLE1BQU0sR0FBRyxLQUFLLENBQUMsS0FBSyxLQUFLLE9BQVEsVUFBVSxPQUFPO0FBQUEsSUFDOUQsR0FBRyxJQUFJO0FBQUEsRUFDVDtBQUdBLE1BQUksZUFBZSxLQUFLLEdBQUc7QUFDekIsVUFBTSxPQUFPLEtBQUssQ0FBQyxL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QVcsQ0FBQyxHQUFHLElBQUksT0FBSyxFQUFFLElBQUk7QUFBQSxNQUN6QyxFQUFFLEtBQUssR0FBRztBQUNWLGdCQUFVLEtBQUs7QUFBQSxRQUNiLFVBQVU7QUFBQSxRQUNWLFFBQVEsS0FBSztBQUFBLFFBQ2IsT0FBTyxPQUFPLEtBQUssU0FBUyxDQUFDO0FBQUEsUUFDN0IsT0FBTyxPQUFPLEtBQUssU0FBUyxDQUFDO0FBQUEsUUFDN0IsYUFBYSxLQUFLLGdCQUFnQjtBQUFBLFFBQ2xDLGlCQUFpQjtBQUFBLE1BQ25CLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRjtBQUdBLFFBQU0sY0FBYyxvQkFBSSxJQUFvQjtBQUM1QyxhQUFXLFFBQVEsSUFBSSxPQUFPO0FBQzVCLGdCQUFZLElBQUksS0FBSyxJQUFJLEtBQUssSUFBSTtBQUFBLEVBQ3BDO0FBRUEsYUFBVyxRQUFRLElBQUksT0FBTztBQUM1QixVQUFNLGVBQWUsWUFBWSxJQUFJLEtBQUssS0FBSyxNQUFNLEtBQUs7QUFDMUQsVUFBTSxhQUFhLFlBQVksSUFBSSxLQUFLLEdBQUcsTUFBTSxLQUFLO0FBQ3RELFVBQU0sVUFBa0M7QUFBQSxNQUN0QyxZQUFZLEtBQUssS0FBSztBQUFBLE1BQ3RCLFVBQVUsS0FBSyxHQUFHO0FBQUEsSUFDcEI7QUFFQSxRQUFJLGlCQUFpQixlQUFlO0FBQ2xDLGNBQVEsYUFBYSxJQUFJLEtBQUssS0FBSztBQUFBLElBQ3JDLE9BQU87QUFDTCxjQUFRLGFBQWEsSUFBSTtBQUFBLElBQzNCO0FBRUEsUUFBSSxlQUFlLGdCQUFnQjtBQUNqQyxjQUFRLFdBQVcsSUFBSSxLQUFLLEdBQUc7QUFBQSxJQUNqQyxPQUFPO0FBQ0wsY0FBUSxXQUFXLElBQUk7QUFBQSxJQUN6QjtBQUNBLFVBQU0sS0FBSyxPQUFPO0FBQUEsRUFDcEI7QUFFQSxTQUFPO0FBQUEsSUFDTCxVQUFVO0FBQUEsSUFDVixVQUFVO0FBQUEsSUFDVixZQUFZO0FBQUEsTUFDVixlQUFlO0FBQUEsTUFDZixzQkFBc0I7QUFBQSxNQUN0QixPQUFPO0FBQUEsUUFDTCxZQUFZO0FBQUEsUUFDWixPQUFPLFVBQVUsU0FBUyxZQUFZO0FBQUEsUUFDdEMsTUFBTSxNQUFNLFNBQVMsUUFBUTtBQUFBLFFBQzdCLE1BQU0sTUFBTSxTQUFTLFFBQVE7QUFBQSxRQUM3QixNQUFNLE1BQU0sU0FBUyxRQUFRO0FBQUEsTUFDL0I7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGOyIsCiAgIm5hbWVzIjogWyJ0ZXh0IiwgImRlc3QiXQp9Cg==
