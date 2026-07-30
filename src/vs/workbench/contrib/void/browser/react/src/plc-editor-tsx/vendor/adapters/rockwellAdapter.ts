/*
 * Rockwell L5X Adapter
 * Parses RSLogix 5000 / Studio 5000 Logix Designer .L5X export files.
 * Schema: <RSLogix5000Content> / Controller / Programs / Program / Routines / Routine / RLLContent / Rung
 *
 * Supports: RLL (ladder) with full branch parsing (BST/NXB/BND), FBD Sheet import,
 *           comprehensive instruction set (MOV, CMP, math, counters, one-shots).
 */

import { parseXML, buildXML, attr, text, child, childArray } from '../xmlUtils.js';
import { rockwellTypeToIEC, iecTypeToRockwell } from '../dataTypeMap.js';
import { buildResolver, VariableTypeResolver } from '../variableTypeResolver.js';
import { getPinDataType, buildTypedPins } from '../pinSignatures.js';
import type {
  ImportResult, ExportResult, NormalizedProject, NormalizedPOU, NormalizedTag,
  VendorMetadataSidecar, UnmappedElement,
} from '../types.js';
import type {
  LadderProgram, Rung, LadderElement, ContactElement, CoilElement, BlockElement, Branch,
  ContactType, CoilType, FBType, TagRef,
  FBDProgram, FBDNode, FBDWire, FBDBlockType,
} from '../../logicStore.js';

let _uid = 0;
function uid(prefix: string): string { return `${prefix}-${++_uid}-${Math.random().toString(36).slice(2, 8)}`; }

function unescapeXML(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

// ─── Import ───────────────────────────────────────────────────────────────────

export function importRockwell(xmlContent: string, filePath: string): ImportResult {
  _uid = 0;
  const errors: string[] = [];
  const warnings: string[] = [];
  const unmapped: UnmappedElement[] = [];

  let root: Record<string, unknown>;
  try {
    root = parseXML(xmlContent);
  } catch (e) {
    return { ok: false, errors: [`XML parse error: ${e}`], warnings: [] };
  }

  const content = child(root, 'RSLogix5000Content') as Record<string, unknown> | undefined;
  if (!content) {
    return { ok: false, errors: ['No <RSLogix5000Content> root found'], warnings: [] };
  }

  const schemaRevision = attr(content, 'SchemaRevision');
  const controller = child(content, 'Controller') as Record<string, unknown> | undefined;
  if (!controller) {
    return { ok: false, errors: ['No <Controller> element found'], warnings: [] };
  }

  const projectName = attr(controller, 'Name') || 'L5X Import';

  // Global/controller-scope tags
  const globalTags: NormalizedTag[] = [];
  const tagsEl = child(controller, 'Tags') as Record<string, unknown> | undefined;
  const tagsRetain = tagsEl ? attr(tagsEl, 'Use') === 'Retain' : false;
  for (const tagEl of childArray(tagsEl, 'Tag')) {
    const tag = parseL5XTag(tagEl, tagsRetain, unmapped);
    if (tag) globalTags.push(tag);
  }

  // UDTs → mark as struct in unmapped (preserve for round-trip)
  for (const udtEl of childArray(child(controller, 'DataTypes'), 'DataType')) {
    unmapped.push({
      clmNodeId: null,
      vendorSpecificData: udtEl,
      reason: `User-Defined Type "${attr(udtEl, 'Name')}" — preserved in sidecar`,
    });
  }

  // Programs
  const pous: NormalizedPOU[] = [];
  for (const programEl of childArray(child(controller, 'Programs'), 'Program')) {
    const pouList = parseL5XProgram(programEl, unmapped, warnings);
    pous.push(...pouList);
  }

  // Modules → preserve for round-trip
  const modulesEl = child(controller, 'Modules');
  if (modulesEl) {
    unmapped.push({ clmNodeId: null, vendorSpecificData: modulesEl, reason: 'Modules element' });
  }

  // Tasks → preserve for round-trip
  const tasksEl = child(controller, 'Tasks');
  if (tasksEl) {
    unmapped.push({ clmNodeId: null, vendorSpecificData: tasksEl, reason: 'Tasks element' });
  }

  // Add-On Instructions → warn, preserve
  for (const aoiEl of childArray(child(controller, 'AddOnInstructionDefinitions'), 'AddOnInstructionDefinition')) {
    const name = attr(aoiEl, 'Name');
    warnings.push(`Add-On Instruction "${name}" cannot be converted to standard IEC blocks — preserved in sidecar.`);
    unmapped.push({ clmNodeId: null, vendorSpecificData: aoiEl, reason: `AOI: ${name}` });
  }

  if (pous.length === 0) {
    errors.push('No programs or routines found in L5X file');
    return { ok: false, errors, warnings };
  }

  const sidecar: VendorMetadataSidecar = {
    sourceVendor: 'rockwell_l5x',
    sourceFileVersion: schemaRevision || '1.0',
    originalFilePath: filePath,
    unmappedElements: unmapped,
    organizerTreeLayout: child(controller, 'Programs'),
    vendorSpecificGlobals: {
      schemaRevision: attr(content, 'SchemaRevision') || '1.0',
      softwareRevision: attr(content, 'SoftwareRevision') || '32.0',
      controllerName: attr(controller, 'Name') || '',
      processorType: attr(controller, 'ProcessorType') || '1769-L33ER',
    },
  };

  return { ok: true, project: { projectName, pous, globalTags, sidecar }, errors, warnings };
}

function parseL5XTag(tagEl: unknown, parentRetain: boolean, unmapped: UnmappedElement[]): NormalizedTag | null {
  if (!tagEl || typeof tagEl !== 'object') return null;
  const name = attr(tagEl, 'Name');
  if (!name) return null;
  const typeStr = attr(tagEl, 'DataType');
  const dataType = rockwellTypeToIEC(typeStr);
  const desc = text(child(child(tagEl, 'Description'), '#cdata') ?? child(tagEl, 'Description'));

  if (dataType === 'STRUCT' && !['TIMER', 'COUNTER', 'CONTROL'].includes(typeStr.toUpperCase())) {
    unmapped.push({ clmNodeId: null, vendorSpecificData: tagEl, reason: `Non-standard struct type: ${typeStr}` });
  }

  // Address: L5X tags don't have IEC hardware addresses — use AliasFor if present
  const aliasFor = attr(tagEl, 'AliasFor');
  const address = aliasFor || undefined;

  // Retain: determined by parent <Tags Use="Retain"> or individual tag's Constant attribute
  const retain = parentRetain || false;

  return {
    name,
    dataType,
    description: desc || undefined,
    address,
    initialValue: parseL5XValue(child(tagEl, 'DefaultData') ?? child(tagEl, 'Data')),
    retain,
  };
}

function parseL5XValue(dataEl: unknown): string | undefined {
  if (!dataEl) return undefined;
  const v = text(dataEl);
  return v || undefined;
}

function parseL5XProgram(programEl: unknown, unmapped: UnmappedElement[], warnings: string[]): NormalizedPOU[] {
  if (!programEl || typeof programEl !== 'object') return [];
  const programName = attr(programEl, 'Name');

  // Program-scope tags
  const localTags: NormalizedTag[] = [];
  const progTagsEl = child(programEl, 'Tags') as Record<string, unknown> | undefined;
  const progRetain = progTagsEl ? attr(progTagsEl, 'Use') === 'Retain' : false;
  for (const tagEl of childArray(progTagsEl, 'Tag')) {
    const tag = parseL5XTag(tagEl, progRetain, unmapped);
    if (tag) localTags.push(tag);
  }

  const pous: NormalizedPOU[] = [];
  for (const routineEl of childArray(child(programEl, 'Routines'), 'Routine')) {
    const routineName = attr(routineEl, 'Name');
    const routineType = attr(routineEl, 'Type') || 'RLL';

    // Build resolver once — shared by all routines in this program
    const resolver = buildResolver(localTags, []);

    if (routineType === 'RLL') {
      const ladder = parseL5XRLL(routineEl, unmapped, warnings);
      pous.push({
        id: `pou-${programName}-${routineName}`,
        name: `${programName}_${routineName}`,
        language: 'LD',
        ladderProgram: ladder,
        localTags,
        pouType: 'program',
      });
    } else if (routineType === 'FBD') {
      const fbd = parseL5XFBD(routineEl, unmapped, warnings, resolver);
      if (fbd) {
        pous.push({
          id: `pou-${programName}-${routineName}`,
          name: `${programName}_${routineName}`,
          language: 'FBD',
          fbdProgram: fbd,
          localTags,
          pouType: 'program',
        });
      } else {
        warnings.push(`Routine "${routineName}" is FBD — preserved in sidecar.`);
        unmapped.push({ clmNodeId: null, vendorSpecificData: routineEl, reason: `FBD routine: ${routineName}` });
      }
    } else if (routineType === 'ST') {
      const stContentEl = child(routineEl, 'STContent');
      let stSource = '';
      if (stContentEl) {
        // Real L5X format: <Line Number="N"><![CDATA[code]]></Line> elements
        const lines = childArray(stContentEl, 'Line');
        if (lines.length > 0) {
          // Parse line-by-line, preserving line numbers (gaps become empty lines)
          const lineMap: Map<number, string> = new Map();
          let maxLine = 0;
          for (const lineEl of lines) {
            const num = Number(attr(lineEl, 'Number')) || 0;
            const lineText = text(lineEl) || '';
            lineMap.set(num, unescapeXML(lineText));
            if (num > maxLine) maxLine = num;
          }
          const stLines: string[] = [];
          for (let n = 0; n <= maxLine; n++) {
            stLines.push(lineMap.get(n) ?? '');
          }
          stSource = stLines.join('\n');
        } else {
          // Fallback: single CDATA text blob
          const rawSt = text(stContentEl);
          stSource = rawSt ? unescapeXML(rawSt) : '';
        }
      }
      pous.push({
        id: `pou-${programName}-${routineName}`,
        name: `${programName}_${routineName}`,
        language: 'ST',
        stSource,
        localTags,
        pouType: 'program',
      });
    } else if (routineType === 'SFC') {
      // Parse SFC routine — preserve structure in sidecar but also create a POU
      const sfcContentEl = child(routineEl, 'SFCContent');
      // Extract any ST code from transition conditions as combined ST source
      const stLines: string[] = [];
      if (sfcContentEl) {
        for (const transEl of childArray(sfcContentEl, 'Transition')) {
          const condEl = child(transEl, 'Condition');
          const condStEl = condEl ? child(condEl, 'STContent') : null;
          if (condStEl) {
            const condLines = childArray(condStEl, 'Line');
            for (const lineEl of condLines) {
              const lt = text(lineEl) || '';
              if (lt) stLines.push(unescapeXML(lt));
            }
          }
        }
      }
      // Store the full SFC XML in unmapped for lossless round-trip
      unmapped.push({ clmNodeId: null, vendorSpecificData: routineEl, reason: `SFC routine: ${routineName}` });
      pous.push({
        id: `pou-${programName}-${routineName}`,
        name: `${programName}_${routineName}`,
        language: 'ST',
        stSource: stLines.length > 0 ? `// SFC Transition conditions from ${routineName}\n${stLines.join('\n')}` : `// SFC routine: ${routineName} (structure preserved in sidecar)`,
        localTags,
        pouType: 'program',
      });
    } else {
      unmapped.push({ clmNodeId: null, vendorSpecificData: routineEl, reason: `Unsupported routine type: ${routineType}` });
    }
  }

  return pous;
}

// ─── RLL (Relay Ladder Logic) parser ─────────────────────────────────────────

function parseL5XRLL(routineEl: unknown, unmapped: UnmappedElement[], warnings: string[]): LadderProgram {
  const rungs: Rung[] = [];
  const rllEl = child(routineEl, 'RLLContent');

  for (const rungEl of childArray(rllEl, 'Rung')) {
    const number = Number(attr(rungEl, 'Number')) || rungs.length;
    const rungType = attr(rungEl, 'Type') || 'N';
    const comment = text(child(rungEl, 'Comment'));
    const textContent = text(child(rungEl, 'Text'));

    const { elements, branches } = parseRungText(textContent, number, unmapped, warnings);
    rungs.push({
      id: `rung-${number}`,
      number,
      comment: comment || '',
      elements,
      branches,
      vendorType: rungType,
    });
  }

  return { rungs };
}

// ─── Rung text parser with BST/NXB/BND branch support ───────────────────────

interface ParsedRung {
  elements: LadderElement[];
  branches: Branch[];
}

function parseRungText(
  rungText: string,
  rungNumber: number,
  unmapped: UnmappedElement[],
  warnings: string[]
): ParsedRung {
  if (!rungText) return { elements: [], branches: [] };

  const stripped = rungText.trim().replace(/;$/, '');

  // L5X neutral text uses [leg1 ,leg2 ]continuation bracket syntax for parallel branches.
  // Pre-process to split into: pre-branch main elements + parallel legs + post-branch elements.
  return parseBracketBranchText(stripped, rungNumber, unmapped, warnings);
}

interface InstrToken {
  instr: string;
  args: string[];
}

function tokenizeRungText(text: string): InstrToken[] {
  const tokens: InstrToken[] = [];
  // Match instructions — supports mixed case, numbers, underscores in instruction names
  // and handles nested parens for array subscripts like MOTOR[0].Speed
  const tokenPattern = /([A-Za-z_][A-Za-z0-9_]*)(?:\(([^)]*(?:\([^)]*\)[^)]*)*)\))?/g;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    const instr = match[1].toUpperCase();
    const argsStr = match[2] ?? '';
    const args = argsStr ? splitArgs(argsStr) : [];
    tokens.push({ instr, args });
  }
  return tokens;
}

function splitArgs(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  for (const ch of argsStr) {
    if (ch === '(' || ch === '[') { depth++; current += ch; }
    else if (ch === ')' || ch === ']') { depth--; current += ch; }
    else if (ch === ',' && depth === 0) { args.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

// Parse L5X neutral text rung with [leg1 ,leg2 ] bracket branch syntax.
// Handles nested brackets (branches within branches) by processing outermost first.
function parseBracketBranchText(
  text: string,
  rungNumber: number,
  unmapped: UnmappedElement[],
  warnings: string[]
): ParsedRung {
  // Find outermost [ ] bracket groups, respecting paren nesting inside
  const allElements: LadderElement[] = [];
  const allBranches: Branch[] = [];
  let posX = 0;
  let i = 0;

  while (i < text.length) {
    // Find next [ that is not inside parentheses
    let parenDepth = 0;
    let bracketStart = -1;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth--;
      else if (ch === '[' && parenDepth === 0) { bracketStart = j; break; }
    }

    if (bracketStart === -1) {
      // No more brackets — tokenize remaining text as main elements
      const mainPart = text.slice(i).trim();
      if (mainPart) {
        const tokens = tokenizeRungText(mainPart);
        for (const tok of tokens) {
          const el = mapL5XInstruction(tok.instr, tok.args, posX, rungNumber, unmapped, warnings);
          if (el) { allElements.push(el); posX += 60; }
        }
      }
      break;
    }

    // Tokenize the text before the bracket as main elements
    const prePart = text.slice(i, bracketStart).trim();
    if (prePart) {
      const tokens = tokenizeRungText(prePart);
      for (const tok of tokens) {
        const el = mapL5XInstruction(tok.instr, tok.args, posX, rungNumber, unmapped, warnings);
        if (el) { allElements.push(el); posX += 60; }
      }
    }

    // Find the matching closing bracket, respecting nested parens AND nested brackets
    let depth = 0;
    let parenD = 0;
    let bracketEnd = -1;
    for (let j = bracketStart; j < text.length; j++) {
      const ch = text[j];
      if (ch === '(') parenD++;
      else if (ch === ')') parenD--;
      else if (ch === '[' && parenD === 0) depth++;
      else if (ch === ']' && parenD === 0) { depth--; if (depth === 0) { bracketEnd = j; break; } }
    }
    if (bracketEnd === -1) { i = bracketStart + 1; continue; }

    // Split the bracket contents by top-level commas (parallel legs)
    const bracketContent = text.slice(bracketStart + 1, bracketEnd);
    const legs: string[] = [];
    let legStart = 0;
    let pd = 0; let bd = 0;
    for (let j = 0; j < bracketContent.length; j++) {
      const ch = bracketContent[j];
      if (ch === '(') pd++;
      else if (ch === ')') pd--;
      else if (ch === '[') bd++;
      else if (ch === ']') bd--;
      else if (ch === ',' && pd === 0 && bd === 0) {
        legs.push(bracketContent.slice(legStart, j).trim());
        legStart = j + 1;
      }
    }
    legs.push(bracketContent.slice(legStart).trim());

    // First leg = continuation of main path, remaining legs = Branch elements
    const joinNodeId = allElements.length > 0 ? allElements[allElements.length - 1].id : `rung${rungNumber}-rail`;
    const legElements: LadderElement[][] = legs.map(leg => {
      const legTokens = tokenizeRungText(leg);
      const elements: LadderElement[] = [];
      let lx = posX;
      for (const tok of legTokens) {
        const el = mapL5XInstruction(tok.instr, tok.args, lx, rungNumber, unmapped, warnings);
        if (el) { elements.push(el); lx += 60; }
      }
      return elements;
    });

    // Push first leg elements into main path
    for (const el of legElements[0] ?? []) { allElements.push(el); }
    if (legElements[0]?.length) posX += legElements[0].length * 60;

    // Remaining legs are branches
    for (let li = 1; li < legElements.length; li++) {
      const legEls = legElements[li];
      if (legEls.length > 0) {
        allBranches.push({
          id: `rung${rungNumber}-branch-${allBranches.length}`,
          startNodeId: joinNodeId,
          endNodeId: legEls[legEls.length - 1].id,
          elements: legEls,
        });
      }
    }

    i = bracketEnd + 1;
  }

  return { elements: allElements, branches: allBranches };
}

function parseTokensWithBranches(
  tokens: InstrToken[],
  rungNumber: number,
  unmapped: UnmappedElement[],
  warnings: string[]
): ParsedRung {
  const mainElements: LadderElement[] = [];
  const branches: Branch[] = [];
  let posX = 0;
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.instr === 'BST') {
      // Start of a branch set — collect all branches until BND
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

interface BranchSetResult {
  branches: Branch[];
  endIndex: number;
}

function parseBranchSet(
  tokens: InstrToken[],
  startIdx: number,
  rungNumber: number,
  unmapped: UnmappedElement[],
  warnings: string[]
): BranchSetResult {
  const branches: Branch[] = [];
  let i = startIdx + 1; // skip BST
  let currentBranchElements: LadderElement[] = [];
  let branchPosX = 0;
  let branchCount = 0;

  // The first branch starts immediately after BST
  while (i < tokens.length) {
    const token = tokens[i];

    if (token.instr === 'NXB') {
      // End current branch, start next
      if (currentBranchElements.length > 0) {
        branches.push({
          id: uid(`branch-r${rungNumber}`),
          startNodeId: `rung-${rungNumber}-branch-start-${branchCount}`,
          endNodeId: `rung-${rungNumber}-branch-end-${branchCount}`,
          elements: currentBranchElements,
        });
      }
      branchCount++;
      currentBranchElements = [];
      branchPosX = 0;
      i++;
    } else if (token.instr === 'BND') {
      // End of branch set — close last branch
      if (currentBranchElements.length > 0) {
        branches.push({
          id: uid(`branch-r${rungNumber}`),
          startNodeId: `rung-${rungNumber}-branch-start-${branchCount}`,
          endNodeId: `rung-${rungNumber}-branch-end-${branchCount}`,
          elements: currentBranchElements,
        });
      }
      i++; // consume BND
      break;
    } else if (token.instr === 'BST') {
      // Nested branch — recurse
      const nested = parseBranchSet(tokens, i, rungNumber, unmapped, warnings);
      // Flatten nested branches into current branch (nested parallel is rare but valid)
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

  // If we ran out of tokens without BND (malformed), still close
  if (currentBranchElements.length > 0) {
    branches.push({
      id: uid(`branch-r${rungNumber}`),
      startNodeId: `rung-${rungNumber}-branch-start-${branchCount}`,
      endNodeId: `rung-${rungNumber}-branch-end-${branchCount}`,
      elements: currentBranchElements,
    });
  }

  return { branches, endIndex: i };
}

// ─── Instruction mapping ─────────────────────────────────────────────────────

const L5X_CONTACT_MAP: Record<string, ContactType> = {
  XIC: 'NO',
  XIO: 'NC',
  OSR: 'P_CONTACT',
  OSF: 'N_CONTACT',
  ONS: 'P_CONTACT',  // One-Shot — maps to rising edge contact
};

const L5X_COIL_MAP: Record<string, CoilType> = {
  OTE: 'normal',
  OTL: 'latch',
  OTU: 'unlatch',
  OTN: 'negated',
};

const L5X_TIMER_MAP: Record<string, FBType> = {
  TON: 'TON', TOF: 'TOF', RTO: 'TON', TP: 'TP', TONR: 'TONR',
};

const L5X_COUNTER_MAP: Record<string, FBType> = {
  CTU: 'CTU', CTD: 'CTD', CTUD: 'CTUD',
};

// Comparison instructions: these act as contacts that energize when condition is true
const L5X_COMPARE_MAP: Record<string, string> = {
  EQU: 'EQ', NEQ: 'NE', GRT: 'GT', GEQ: 'GE', LES: 'LT', LEQ: 'LE',
  LIM: 'LIMIT', MEQ: 'EQ',
  // Short aliases used in some L5X exports
  EQ: 'EQ', NE: 'NE', GT: 'GT', GE: 'GE', LT: 'LT', LE: 'LE',
  // CMP — generic compare with expression string
  CMP: 'EQ',
};

// Math instructions: these map to function blocks with inputs/output
const L5X_MATH_MAP: Record<string, FBType> = {
  ADD: 'ADD', SUB: 'SUB', MUL: 'MUL', DIV: 'DIV', MOD: 'MOD',
  ABS: 'ABS', SQR: 'SQRT', SQRT: 'SQRT', NEG: 'NEG',
  // Trig / advanced math
  SIN: 'SIN', COS: 'COS', TAN: 'TAN', ATN: 'ATAN', ATAN: 'ATAN',
  ASN: 'ASIN', ACS: 'ACOS', LN: 'LN', LOG: 'LOG',
  // CPT — Compute expression into destination (represent as ADD placeholder)
  CPT: 'ADD',
};

// Move / data-copy instructions
const L5X_MOVE_MAP: Record<string, FBType> = {
  MOV: 'MOVE', MOVE: 'MOVE', COP: 'MOVE', CPS: 'MOVE', FLL: 'MOVE',
  BTD: 'BTD', SIZE: 'SIZE',
};

// Bitwise / logical instructions → map to boolean gate blocks
const L5X_BITWISE_MAP: Record<string, FBType> = {
  AND: 'AND', OR: 'OR', NOT: 'NOT', XOR: 'XOR',
  BAND: 'AND', BOR: 'OR', BNOT: 'NOT', BXOR: 'XOR',
};

// Selection / conversion instructions
const L5X_SELECT_MAP: Record<string, FBType> = {
  SEL: 'SEL', MUX: 'MUX', LIMIT: 'LIMIT', MIN: 'MIN', MAX: 'MAX',
  LIM: 'LIMIT', MEQ: 'EQ',
  // Type conversion
  TRUNC: 'TRUNC', ROUND: 'ROUND',
  INT_TO_REAL: 'INT_TO_REAL', REAL_TO_INT: 'REAL_TO_INT',
  DINT_TO_REAL: 'DINT_TO_REAL', REAL_TO_DINT: 'REAL_TO_DINT',
  // Scaling
  SCL: 'SCALE', SCP: 'SCALE',
  // Bit shift
  SHL: 'MOVE', SHR: 'MOVE', ROL: 'MOVE', ROR: 'MOVE',
  BSL: 'MOVE', BSR: 'MOVE',
};

// FIFO / LIFO queue instructions
const L5X_FIFO_MAP: Record<string, FBType> = {
  FFL: 'FFL', FFU: 'FFU', LFL: 'LFL', LFU: 'LFU',
};

// Sequencer instructions
const L5X_SEQ_MAP: Record<string, FBType> = {
  SQO: 'SQO', SQI: 'SQI', SQL: 'SQL',
};

// PID and process control
const L5X_PID_MAP: Record<string, FBType> = {
  PID: 'PID', PIDE: 'PID', PIDAT: 'PID',
};

// String instructions
const L5X_STRING_MAP: Record<string, FBType> = {
  // Length / concat / compare
  LEN: 'LEN', CONCAT: 'CONCAT', FIND: 'FIND', INSERT: 'INSERT',
  DELETE: 'DELETE', MID: 'MID', UPPER: 'UPPER_CASE', LOWER: 'LOWER_CASE',
  LEFT: 'LEFT', RIGHT: 'RIGHT',
  // String comparison
  STRCMP: 'EQ', STRICMP: 'EQ',
  // String to number / number to string
  STOD: 'MOVE', DTOS: 'MOVE',
};

// Motion instructions — always unmapped with metadata, but we give them a block shape
// so they appear as blocks in the canvas (not silently dropped)
const L5X_MOTION_SET = new Set([
  'MAJ', 'MAM', 'MAS', 'MAOC', 'MAAT', 'MAFR', 'MAHD', 'MARP', 'MARW',
  // MAR — Motion Axis Registration: MAR(axis, registration, edge, ...)
  'MAR',
  'MCD', 'MCT', 'MCCD', 'MCTD', 'MCP', 'MCM',
  'GSV', 'SSV',
  'MSG',
]);

// Diagnostic / program control instructions — kept as pass-through blocks
const L5X_DIAG_SET = new Set([
  'EOT', 'EFS',
  'UID', 'UIE',
  'ONS', // handled above as contact, but guard here too
  'RESD', 'SETD',
]);

// Helper: build a minimal 2-operand block (IN, OUT)
function makeBlock(
  instr: string,
  fbType: FBType,
  instanceSuffix: string | number,
  rungNumber: number,
  pins: Record<string, TagRef>,
  posX: number
): BlockElement {
  return {
    kind: 'block',
    id: uid(`r${rungNumber}-${instr}`),
    fbType,
    instanceName: `${instr}_${instanceSuffix}`,
    pins,
    position: { x: posX, y: 0 },
    vendorOriginalName: instr !== (fbType as string) ? instr : undefined,
  } as BlockElement;
}

function mapL5XInstruction(
  instr: string,
  args: string[],
  posX: number,
  rungNumber: number,
  unmapped: UnmappedElement[],
  warnings: string[]
): LadderElement | null {

  // ── Contact instructions ─────────────────────────────────────────────────
  if (L5X_CONTACT_MAP[instr]) {
    const tagName = args[0] || `TAG_${posX}`;
    // OSR/OSF take 2 args: OSR(storageBit, outputBit) — store both for round-trip
    const extraTag = (instr === 'OSR' || instr === 'OSF') && args[1] ? args[1] : undefined;
    return {
      kind: 'contact',
      id: uid(`r${rungNumber}-${instr}`),
      type: L5X_CONTACT_MAP[instr],
      tag: { name: tagName, dataType: 'BOOL' },
      position: { x: posX, y: 0 },
      vendorArgs: extraTag ? [tagName, extraTag] : undefined,
    } as any;
  }

  // ── Coil instructions ─────────────────────────────────────────────────────
  if (L5X_COIL_MAP[instr]) {
    const tagName = args[0] || `TAG_${posX}`;
    return {
      kind: 'coil',
      id: uid(`r${rungNumber}-${instr}`),
      type: L5X_COIL_MAP[instr],
      tag: { name: tagName, dataType: 'BOOL' },
      position: { x: posX, y: 0 },
    };
  }

  // ── Timer instructions ────────────────────────────────────────────────────
  // TON(timer, preset, accum) / TOF / RTO / TP / TONR
  // '?' args mean the value is embedded in the TIMER struct (Logix convention)
  if (L5X_TIMER_MAP[instr]) {
    const instanceName = args[0] && args[0] !== '?' ? args[0] : `${instr}_${posX}`;
    const preset = args[1] && args[1] !== '?' ? args[1] : `${instanceName}.PRE`;
    return makeBlock(instr, L5X_TIMER_MAP[instr], posX, rungNumber, {
      EN:  { name: instanceName + '.EN',  dataType: 'BOOL' },
      PT:  { name: preset,               dataType: 'DINT' },
      Q:   { name: instanceName + '.DN',  dataType: 'BOOL' },
      ET:  { name: instanceName + '.ACC', dataType: 'DINT' },
    }, posX);
  }

  // ── Counter instructions ──────────────────────────────────────────────────
  // CTU(counter, preset, accum) / CTD / CTUD
  if (L5X_COUNTER_MAP[instr]) {
    const instanceName = args[0] && args[0] !== '?' ? args[0] : `${instr}_${posX}`;
    const preset = args[1] && args[1] !== '?' ? args[1] : `${instanceName}.PRE`;
    return makeBlock(instr, L5X_COUNTER_MAP[instr], posX, rungNumber, {
      CU: { name: instanceName + '.CU',  dataType: 'BOOL' },
      PV: { name: preset,               dataType: 'DINT' },
      QU: { name: instanceName + '.DN',  dataType: 'BOOL' },
      CV: { name: instanceName + '.ACC', dataType: 'DINT' },
    }, posX);
  }

  // ── Math instructions ─────────────────────────────────────────────────────
  // ADD(src1, src2, dest) / SUB / MUL / DIV / MOD / ABS / SQR / trig / CPT …
  if (L5X_MATH_MAP[instr]) {
    const dest    = args[args.length - 1] || `RESULT_${posX}`;
    const sourceA = args[0] || '0';
    const sourceB = args.length >= 3 ? args[1] : '0';
    return makeBlock(instr, L5X_MATH_MAP[instr], posX, rungNumber, {
      IN1: { name: sourceA, dataType: 'REAL' },
      IN2: { name: sourceB, dataType: 'REAL' },
      OUT: { name: dest,    dataType: 'REAL' },
    }, posX);
  }

  // ── Comparison instructions ───────────────────────────────────────────────
  // EQU(src1, src2) → EQ block; LIM(low, test, high) → LIMIT block
  if (L5X_COMPARE_MAP[instr]) {
    if (instr === 'LIM') {
      const low  = args[0] || '0';
      const test = args[1] || '0';
      const high = args[2] || '0';
      return makeBlock(instr, 'LIMIT' as FBType, posX, rungNumber, {
        MN:  { name: low,  dataType: 'DINT' },
        IN:  { name: test, dataType: 'DINT' },
        MX:  { name: high, dataType: 'DINT' },
        OUT: { name: `_LIM_${posX}`, dataType: 'BOOL' },
      }, posX);
    }
    if (instr === 'MEQ') {
      const src  = args[0] || '0';
      const mask = args[1] || '0';
      const cmp  = args[2] || '0';
      return makeBlock(instr, 'EQ' as FBType, posX, rungNumber, {
        IN1:  { name: src,  dataType: 'DINT' },
        MASK: { name: mask, dataType: 'DWORD' },
        IN2:  { name: cmp,  dataType: 'DINT' },
        OUT:  { name: `_MEQ_${posX}`, dataType: 'BOOL' },
      }, posX);
    }
    const sourceA = args[0] || '0';
    const sourceB = args[1] || '0';
    return makeBlock(instr, L5X_COMPARE_MAP[instr] as FBType, posX, rungNumber, {
      IN1: { name: sourceA, dataType: 'DINT' },
      IN2: { name: sourceB, dataType: 'DINT' },
      OUT: { name: `_CMP_${posX}`, dataType: 'BOOL' },
    }, posX);
  }

  // ── Move / data-copy instructions ─────────────────────────────────────────
  // MOV(src, dest) / COP(src, dest, len) / CPS / FLL(value, dest, len)
  if (L5X_MOVE_MAP[instr]) {
    const source = args[0] || '0';
    const dest   = args[1] || `DEST_${posX}`;
    if (instr === 'BTD') {
      // Bit field distribute: BTD(src, srcBit, dest, destBit, len)
      return makeBlock(instr, 'BTD', posX, rungNumber, {
        IN:      { name: source,       dataType: 'DINT' },
        SRC_BIT: { name: args[1] || '0', dataType: 'DINT' },
        OUT:     { name: args[2] || dest, dataType: 'DINT' },
        DST_BIT: { name: args[3] || '0', dataType: 'DINT' },
        LEN:     { name: args[4] || '1', dataType: 'DINT' },
      }, posX);
    }
    if (instr === 'SIZE') {
      return makeBlock(instr, 'SIZE', posX, rungNumber, {
        IN:  { name: source, dataType: 'DINT' },
        DIM: { name: args[1] || '0', dataType: 'DINT' },
        OUT: { name: args[2] || `DEST_${posX}`, dataType: 'DINT' },
      }, posX);
    }
    return makeBlock(instr, L5X_MOVE_MAP[instr], posX, rungNumber, {
      IN:  { name: source, dataType: 'DINT' },
      OUT: { name: dest,   dataType: 'DINT' },
    }, posX);
  }

  // ── Bitwise / logical instructions ────────────────────────────────────────
  // AND(src1, src2, dest) / OR / NOT(src, dest) / XOR
  if (L5X_BITWISE_MAP[instr]) {
    const src1 = args[0] || '0';
    const src2 = args.length >= 3 ? args[1] : '0';
    const dest = args[args.length - 1] || `RESULT_${posX}`;
    return makeBlock(instr, L5X_BITWISE_MAP[instr], posX, rungNumber, {
      IN1: { name: src1, dataType: 'DINT' },
      IN2: { name: src2, dataType: 'DINT' },
      OUT: { name: dest, dataType: 'DINT' },
    }, posX);
  }

  // ── Selection / conversion instructions ──────────────────────────────────
  if (L5X_SELECT_MAP[instr]) {
    if (instr === 'SEL') {
      const sel  = args[0] || '0';
      const in1  = args[1] || '0';
      const in2  = args[2] || '0';
      const dest = args[3] || `DEST_${posX}`;
      return makeBlock(instr, 'SEL', posX, rungNumber, {
        G:   { name: sel,  dataType: 'BOOL' },
        IN0: { name: in1,  dataType: 'DINT' },
        IN1: { name: in2,  dataType: 'DINT' },
        OUT: { name: dest, dataType: 'DINT' },
      }, posX);
    }
    if (instr === 'MUX') {
      const sel  = args[0] || '0';
      const dest = args[args.length - 1] || `DEST_${posX}`;
      const inputPins: Record<string, TagRef> = { K: { name: sel, dataType: 'DINT' } };
      args.slice(1, args.length - 1).forEach((a, i) => {
        inputPins[`IN${i}`] = { name: a, dataType: 'DINT' };
      });
      inputPins['OUT'] = { name: dest, dataType: 'DINT' };
      return makeBlock(instr, 'MUX', posX, rungNumber, inputPins, posX);
    }
    if (instr === 'LIMIT' || instr === 'LIM') {
      return makeBlock(instr, 'LIMIT', posX, rungNumber, {
        MN:  { name: args[0] || '0', dataType: 'DINT' },
        IN:  { name: args[1] || '0', dataType: 'DINT' },
        MX:  { name: args[2] || '0', dataType: 'DINT' },
        OUT: { name: `_LIM_${posX}`, dataType: 'BOOL' },
      }, posX);
    }
    if (instr === 'MIN' || instr === 'MAX') {
      return makeBlock(instr, L5X_SELECT_MAP[instr], posX, rungNumber, {
        IN1: { name: args[0] || '0', dataType: 'REAL' },
        IN2: { name: args[1] || '0', dataType: 'REAL' },
        OUT: { name: args[2] || `DEST_${posX}`, dataType: 'REAL' },
      }, posX);
    }
    if (instr === 'SCL' || instr === 'SCP') {
      return makeBlock(instr, 'SCALE', posX, rungNumber, {
        IN:    { name: args[0] || '0', dataType: 'DINT' },
        InMin: { name: args[1] || '0', dataType: 'DINT' },
        InMax: { name: args[2] || '0', dataType: 'DINT' },
        OUT:   { name: args[3] || `DEST_${posX}`, dataType: 'REAL' },
      }, posX);
    }
    // Generic selection / conversion fallthrough
    const src  = args[0] || '0';
    const dest = args[args.length - 1] || `DEST_${posX}`;
    return makeBlock(instr, L5X_SELECT_MAP[instr], posX, rungNumber, {
      IN:  { name: src,  dataType: 'DINT' },
      OUT: { name: dest, dataType: 'DINT' },
    }, posX);
  }

  // ── FIFO / LIFO queue instructions ────────────────────────────────────────
  // Real syntax: FFL(source, FIFO_array, CTRL_struct, ?, ?)
  //              FFU(FIFO_array, dest, CTRL_struct, ?, ?)
  // The '?' args are len/pos embedded in the CTRL struct — treat as unknown
  if (L5X_FIFO_MAP[instr]) {
    const isFill = instr === 'FFL' || instr === 'LFL';
    const validArg = (a: string | undefined) => (!a || a === '?') ? undefined : a;
    if (isFill) {
      const ctrl = validArg(args[2]) || `${instr}_CTRL`;
      return makeBlock(instr, L5X_FIFO_MAP[instr], posX, rungNumber, {
        IN:   { name: validArg(args[0]) || '0',          dataType: 'DINT' },
        FIFO: { name: validArg(args[1]) || `${instr}_Q`, dataType: 'DINT' },
        CTRL: { name: ctrl,                              dataType: 'CONTROL' },
        LEN:  { name: `${ctrl}.LEN`,                    dataType: 'DINT' },
        POS:  { name: `${ctrl}.POS`,                    dataType: 'DINT' },
        EM:   { name: `${ctrl}.EM`,                     dataType: 'BOOL' },
        DN:   { name: `${ctrl}.DN`,                     dataType: 'BOOL' },
      }, posX);
    } else {
      const ctrl = validArg(args[2]) || `${instr}_CTRL`;
      return makeBlock(instr, L5X_FIFO_MAP[instr], posX, rungNumber, {
        FIFO: { name: validArg(args[0]) || `${instr}_Q`, dataType: 'DINT' },
        OUT:  { name: validArg(args[1]) || `DEST_${posX}`, dataType: 'DINT' },
        CTRL: { name: ctrl,                              dataType: 'CONTROL' },
        LEN:  { name: `${ctrl}.LEN`,                    dataType: 'DINT' },
        POS:  { name: `${ctrl}.POS`,                    dataType: 'DINT' },
        EM:   { name: `${ctrl}.EM`,                     dataType: 'BOOL' },
        DN:   { name: `${ctrl}.DN`,                     dataType: 'BOOL' },
      }, posX);
    }
  }

  // ── Sequencer instructions ────────────────────────────────────────────────
  // SQO(file, mask, dest, control, len, pos)
  // SQI(file, mask, src, control, len, pos)
  // SQL(file, dest, control, len, pos)
  if (L5X_SEQ_MAP[instr]) {
    return makeBlock(instr, L5X_SEQ_MAP[instr], posX, rungNumber, {
      FILE: { name: args[0] || `${instr}_FILE`, dataType: 'DINT' },
      MASK: { name: args[1] || '0',             dataType: 'DWORD' },
      DEST: { name: args[2] || `DEST_${posX}`,  dataType: 'DINT' },
      CTRL: { name: args[3] || `${instr}_CTRL`, dataType: 'DINT' },
      LEN:  { name: args[4] || '0',             dataType: 'DINT' },
      POS:  { name: args[5] || '0',             dataType: 'DINT' },
      DN:   { name: `${args[3] || instr}.DN`,   dataType: 'BOOL' },
      ER:   { name: `${args[3] || instr}.ER`,   dataType: 'BOOL' },
    }, posX);
  }

  // ── PID / Process control ─────────────────────────────────────────────────
  // PID(PID, process, tieback, control, PID_data)
  if (L5X_PID_MAP[instr]) {
    return makeBlock(instr, L5X_PID_MAP[instr], posX, rungNumber, {
      IN:     { name: args[1] || `PV_${posX}`,   dataType: 'REAL' },
      SP:     { name: `${args[0] || instr}.SP`,  dataType: 'REAL' },
      OUT:    { name: args[3] || `CV_${posX}`,   dataType: 'REAL' },
      KP:     { name: `${args[0] || instr}.KP`,  dataType: 'REAL' },
      KI:     { name: `${args[0] || instr}.KI`,  dataType: 'REAL' },
      KD:     { name: `${args[0] || instr}.KD`,  dataType: 'REAL' },
      EN:     { name: `${args[0] || instr}.EN`,  dataType: 'BOOL' },
    }, posX);
  }

  // ── String instructions ───────────────────────────────────────────────────
  if (L5X_STRING_MAP[instr]) {
    const src1 = args[0] || `STR_${posX}`;
    const src2 = args.length >= 3 ? args[1] : '';
    const dest = args[args.length - 1] || `DEST_${posX}`;
    if (instr === 'MID') {
      return makeBlock(instr, 'MID', posX, rungNumber, {
        IN:    { name: src1,           dataType: 'STRING' },
        LEN:   { name: args[1] || '1', dataType: 'DINT' },
        START: { name: args[2] || '1', dataType: 'DINT' },
        OUT:   { name: dest,           dataType: 'STRING' },
      }, posX);
    }
    if (instr === 'CONCAT') {
      return makeBlock(instr, 'CONCAT', posX, rungNumber, {
        IN1: { name: src1, dataType: 'STRING' },
        IN2: { name: src2 || '', dataType: 'STRING' },
        OUT: { name: dest, dataType: 'STRING' },
      }, posX);
    }
    if (instr === 'FIND') {
      return makeBlock(instr, 'FIND', posX, rungNumber, {
        IN1: { name: src1,           dataType: 'STRING' },
        IN2: { name: src2 || '',     dataType: 'STRING' },
        OUT: { name: dest,           dataType: 'DINT' },
      }, posX);
    }
    if (instr === 'INSERT') {
      return makeBlock(instr, 'INSERT', posX, rungNumber, {
        IN1: { name: src1,           dataType: 'STRING' },
        IN2: { name: src2 || '',     dataType: 'STRING' },
        POS: { name: args[2] || '1', dataType: 'DINT' },
        OUT: { name: dest,           dataType: 'STRING' },
      }, posX);
    }
    if (instr === 'DELETE') {
      return makeBlock(instr, 'DELETE', posX, rungNumber, {
        IN:    { name: src1,           dataType: 'STRING' },
        LEN:   { name: args[1] || '1', dataType: 'DINT' },
        START: { name: args[2] || '1', dataType: 'DINT' },
        OUT:   { name: dest,           dataType: 'STRING' },
      }, posX);
    }
    // LEN / LEFT / RIGHT / UPPER / LOWER — generic single-source
    return makeBlock(instr, L5X_STRING_MAP[instr], posX, rungNumber, {
      IN:  { name: src1, dataType: 'STRING' },
      OUT: { name: dest, dataType: instr === 'LEN' ? 'DINT' : 'STRING' },
    }, posX);
  }

  // ── Motion instructions — always unmapped, but emit a block placeholder ───
  // so they appear on the canvas and are preserved through sidecar
  if (L5X_MOTION_SET.has(instr)) {
    const instanceName = args[0] || `${instr}_${posX}`;
    const block = makeBlock(instr, 'MOVE' as FBType, posX, rungNumber, {
      IN: { name: instanceName, dataType: 'DINT' },
    }, posX);
    unmapped.push({
      clmNodeId: block.id,
      vendorSpecificData: { instr, args },
      reason: `Motion/GSV/MSG instruction (canvas placeholder): ${instr}(${args.join(',')})`,
    });
    return block;
  }

  // ── RES — counter/timer reset ─────────────────────────────────────────────
  if (instr === 'RES') {
    const tagName = args[0] || `TAG_${posX}`;
    return {
      kind: 'coil',
      id: uid(`r${rungNumber}-RES`),
      type: 'reset',
      tag: { name: tagName, dataType: 'DINT' },
      position: { x: posX, y: 0 },
    };
  }

  // ── Diagnostic / program control — emit no-op block placeholders ──────────
  if (L5X_DIAG_SET.has(instr)) {
    // UID/UIE disable/enable interrupt — skip silently (they have no visual shape)
    if (instr === 'UID' || instr === 'UIE') return null;
    // Others become a labeled block placeholder (preserves round-trip position)
    return makeBlock(instr, 'MOVE' as FBType, posX, rungNumber, {}, posX);
  }

  // ── EVENT — trigger event task ────────────────────────────────────────────
  if (instr === 'EVENT') {
    const taskName = args[0] || 'EVENT_TASK';
    return {
      kind: 'coil',
      id: uid(`r${rungNumber}-EVENT`),
      type: 'normal',
      tag: { name: `_EVENT_${taskName}`, dataType: 'BOOL' },
      position: { x: posX, y: 0 },
    };
  }

  // ── JSR — Jump to Subroutine ──────────────────────────────────────────────
  if (instr === 'JSR') {
    const routineName = args[0] || 'UNKNOWN';
    return makeBlock(instr, 'MOVE' as FBType, posX, rungNumber, {
      ROUTINE: { name: routineName, dataType: 'STRING' },
      IN:      { name: args[1] || '0', dataType: 'DINT' },
      OUT:     { name: args[2] || '0', dataType: 'DINT' },
    }, posX);
  }

  // ── RET — Return from subroutine ─────────────────────────────────────────
  if (instr === 'RET') {
    return {
      kind: 'coil',
      id: uid(`r${rungNumber}-RET`),
      type: 'normal',
      tag: { name: '_RET', dataType: 'BOOL' },
      position: { x: posX, y: 0 },
    };
  }

  // ── SBR — Subroutine declaration: skip ────────────────────────────────────
  if (instr === 'SBR') return null;

  // ── AFI — Always False Instruction ───────────────────────────────────────
  if (instr === 'AFI') {
    return {
      kind: 'contact',
      id: uid(`r${rungNumber}-AFI`),
      type: 'NC',
      tag: { name: '_ALWAYS_FALSE', dataType: 'BOOL' },
      position: { x: posX, y: 0 },
    };
  }

  // ── NOP — No Operation: skip silently ─────────────────────────────────────
  if (instr === 'NOP') return null;

  // ── JMP — Jump to label ────────────────────────────────────────────────────
  if (instr === 'JMP') {
    const label = args[0] || 'LBL0';
    return makeBlock(instr, 'MOVE' as FBType, posX, rungNumber, {
      LABEL: { name: label, dataType: 'STRING' },
    }, posX);
  }

  // ── LBL — Label target ───────────────────────────────────────────────────
  if (instr === 'LBL') {
    const label = args[0] || 'LBL0';
    return makeBlock(instr, 'MOVE' as FBType, posX, rungNumber, {
      LABEL: { name: label, dataType: 'STRING' },
    }, posX);
  }

  // ── MCR — Master Control Reset ───────────────────────────────────────────
  if (instr === 'MCR') return null; // MCR is zone delimiter, no visual element

  // ── TND — Temporary End ──────────────────────────────────────────────────
  if (instr === 'TND') {
    return {
      kind: 'coil',
      id: uid(`r${rungNumber}-TND`),
      type: 'normal',
      tag: { name: '_TND', dataType: 'BOOL' },
      position: { x: posX, y: 0 },
    };
  }

  // ── FOR / NEXT / BRK — loop control ──────────────────────────────────────
  if (instr === 'FOR') {
    return makeBlock(instr, 'MOVE' as FBType, posX, rungNumber, {
      ROUTINE: { name: args[0] || 'LOOP', dataType: 'STRING' },
      INDEX:   { name: args[1] || '0', dataType: 'DINT' },
      INIT:    { name: args[2] || '0', dataType: 'DINT' },
      TERM:    { name: args[3] || '0', dataType: 'DINT' },
      STEP:    { name: args[4] || '1', dataType: 'DINT' },
    }, posX);
  }
  if (instr === 'NEXT') return null;
  if (instr === 'BRK') return null;

  // ── FAL / FSC — file arithmetic/search/compare ───────────────────────────
  if (instr === 'FAL' || instr === 'FSC') {
    const ctrl = args[0] || `${instr}_CTRL`;
    return makeBlock(instr, 'MOVE' as FBType, posX, rungNumber, {
      CTRL:  { name: ctrl, dataType: 'CONTROL' },
      LEN:   { name: args[1] || '0', dataType: 'DINT' },
      POS:   { name: args[2] || '0', dataType: 'DINT' },
      MODE:  { name: args[3] || '0', dataType: 'DINT' },
      DEST:  { name: args[4] || '0', dataType: 'DINT' },
      EXPR:  { name: args[5] || '0', dataType: 'DINT' },
    }, posX);
  }

  // ── AVE / SRT / STD — file statistics ────────────────────────────────────
  if (instr === 'AVE' || instr === 'SRT' || instr === 'STD') {
    const ctrl = args[1] || `${instr}_CTRL`;
    return makeBlock(instr, 'MOVE' as FBType, posX, rungNumber, {
      ARRAY: { name: args[0] || '0', dataType: 'DINT' },
      CTRL:  { name: ctrl, dataType: 'CONTROL' },
      DEST:  { name: args[2] || '0', dataType: 'REAL' },
      LEN:   { name: args[3] || '0', dataType: 'DINT' },
      POS:   { name: args[4] || '0', dataType: 'DINT' },
    }, posX);
  }

  // ── Unknown instruction → preserve in unmapped ────────────────────────────
  unmapped.push({
    clmNodeId: null,
    vendorSpecificData: { instr, args },
    reason: `Unsupported Rockwell instruction: ${instr}(${args.join(',')})`,
  });
  return null;
}

// ─── FBD (Function Block Diagram) parser ─────────────────────────────────────

function parseL5XFBD(routineEl: unknown, unmapped: UnmappedElement[], warnings: string[], resolver: VariableTypeResolver = new VariableTypeResolver()): FBDProgram | null {
  const sheets = childArray(routineEl, 'Sheet') ?? childArray(child(routineEl, 'FBDContent'), 'Sheet');
  if (!sheets || sheets.length === 0) return null;

  const nodes: FBDNode[] = [];
  const wires: FBDWire[] = [];

  for (const sheet of sheets) {
    // Parse Block elements — real L5X format: <Block Type="TON" VisiblePins="IN PT Q ET" Operand="Timer1"/>
    for (const blockEl of childArray(sheet, 'Block').concat(childArray(sheet, 'FBD_Block'))) {
      const id = attr(blockEl, 'ID') || uid('fbd-block');
      const typeName = attr(blockEl, 'Type') || 'UNKNOWN';
      const x = Number(attr(blockEl, 'X')) || 0;
      const y = Number(attr(blockEl, 'Y')) || 0;
      const instanceName = attr(blockEl, 'Operand') || attr(blockEl, 'Name') || '';

      const blockType = mapRockwellFBDType(typeName);
      const inputs: { id: string; name: string; dataType: string; negated?: boolean }[] = [];
      const outputs: { id: string; name: string; dataType: string }[] = [];

      // Primary format: VisiblePins attribute is a space-separated list of visible pin names.
      // Use pinSignatures to classify each pin as input or output.
      const visiblePinsAttr = attr(blockEl, 'VisiblePins') || '';
      if (visiblePinsAttr) {
        const pinNames = visiblePinsAttr.split(/\s+/).filter(Boolean);
        for (const pinName of pinNames) {
          const asInput  = getPinDataType(typeName, pinName, 'input');
          const asOutput = getPinDataType(typeName, pinName, 'output');
          // Heuristic: if pinSignatures gives a real type for output, treat as output
          const isOutput = asOutput !== 'BOOL' || pinName === 'Out' || pinName === 'Dest' ||
            /^(Out|Dest|Q[UDN]?|Result|DN|EN_O|ENO)$/i.test(pinName);
          if (isOutput) {
            outputs.push({ id: uid('pin'), name: pinName, dataType: asOutput });
          } else {
            inputs.push({ id: uid('pin'), name: pinName, dataType: asInput });
          }
        }
      }

      // Fallback: legacy FBD_BlockPin / InputPin / OutputPin child elements
      if (inputs.length === 0 && outputs.length === 0) {
        for (const pinEl of childArray(blockEl, 'FBD_BlockPin')) {
          const pinName = attr(pinEl, 'Name') || `pin${inputs.length + outputs.length}`;
          const pinId = attr(pinEl, 'ID') || uid('pin');
          const use = attr(pinEl, 'Use') || '';
          if (use === 'Output') {
            outputs.push({ id: pinId, name: pinName, dataType: getPinDataType(typeName, pinName, 'output') });
          } else {
            inputs.push({ id: pinId, name: pinName, dataType: getPinDataType(typeName, pinName, 'input') });
          }
        }
        for (const pinEl of childArray(blockEl, 'InputPin')) {
          const pinName = attr(pinEl, 'Name') || `in${inputs.length}`;
          const pinId = attr(pinEl, 'ID') || uid('pin');
          inputs.push({ id: pinId, name: pinName, dataType: getPinDataType(typeName, pinName, 'input') });
        }
        for (const pinEl of childArray(blockEl, 'OutputPin')) {
          const pinName = attr(pinEl, 'Name') || `out${outputs.length}`;
          const pinId = attr(pinEl, 'ID') || uid('pin');
          outputs.push({ id: pinId, name: pinName, dataType: getPinDataType(typeName, pinName, 'output') });
        }
      }

      // If still no pins, generate from canonical signature
      if (inputs.length === 0 && outputs.length === 0) {
        const { inputs: sigIn, outputs: sigOut } = buildTypedPins(typeName, [], id);
        inputs.push(...sigIn);
        outputs.push(...sigOut);
      } else {
        if (inputs.length === 0) inputs.push({ id: uid('pin'), name: 'EN', dataType: 'BOOL' });
        if (outputs.length === 0) outputs.push({ id: uid('pin'), name: 'OUT', dataType: 'BOOL' });
      }

      nodes.push({
        id,
        type: blockType,
        instanceName: instanceName || undefined,
        position: { x, y },
        inputs,
        outputs,
      });
    }

    // AddOnInstruction usage in FBD sheets (NOT definition — this is a call site)
    for (const aoiEl of childArray(sheet, 'AddOnInstruction')) {
      const id = attr(aoiEl, 'ID') || uid('aoi');
      const typeName = attr(aoiEl, 'Name') || 'AOI';
      const x = Number(attr(aoiEl, 'X')) || 0;
      const y = Number(attr(aoiEl, 'Y')) || 0;
      const instanceName = attr(aoiEl, 'Operand') || '';
      const visiblePinsAttr = attr(aoiEl, 'VisiblePins') || '';
      const pinNames = visiblePinsAttr.split(/\s+/).filter(Boolean);
      // For AOIs, treat all pins except EnableIn/EnableOut as inputs unless they match output patterns
      const aoiInputs: { id: string; name: string; dataType: string }[] = [];
      const aoiOutputs: { id: string; name: string; dataType: string }[] = [];
      for (const pinName of pinNames) {
        const isOutput = /^(EnableOut|ENO|Out\d*|Dest\d*)$/i.test(pinName);
        if (isOutput) aoiOutputs.push({ id: uid('pin'), name: pinName, dataType: 'BOOL' });
        else aoiInputs.push({ id: uid('pin'), name: pinName, dataType: 'BOOL' });
      }
      // Also parse InOutParameter children
      for (const iopEl of childArray(aoiEl, 'InOutParameter')) {
        const pName = attr(iopEl, 'Name') || '';
        aoiInputs.push({ id: uid('pin'), name: pName, dataType: 'DINT' });
      }
      if (aoiInputs.length === 0) aoiInputs.push({ id: uid('pin'), name: 'EnableIn', dataType: 'BOOL' });
      if (aoiOutputs.length === 0) aoiOutputs.push({ id: uid('pin'), name: 'EnableOut', dataType: 'BOOL' });
      const blockType = mapRockwellFBDType(typeName);
      nodes.push({
        id, type: blockType,
        instanceName: instanceName || undefined,
        position: { x, y },
        inputs: aoiInputs,
        outputs: aoiOutputs,
        vendorOriginalName: typeName,
      } as any);
      unmapped.push({
        clmNodeId: id,
        vendorSpecificData: aoiEl,
        reason: `AOI call in FBD sheet: ${typeName}(${instanceName})`,
      });
    }

    // Parse IRef (input reference — variable nodes)
    for (const irefEl of childArray(sheet, 'IRef')) {
      const id = attr(irefEl, 'ID') || uid('iref');
      const operand = attr(irefEl, 'Operand') || '';
      const x = Number(attr(irefEl, 'X')) || 0;
      const y = Number(attr(irefEl, 'Y')) || 0;

      const irefType = resolver.resolve(operand);
      nodes.push({
        id,
        type: 'IN_VARIABLE',
        position: { x, y },
        inputs: [],
        outputs: [{ id: uid('pin'), name: 'OUT', dataType: irefType }],
        tag: { name: operand, dataType: irefType },
      });
    }

    // Parse ORef (output reference — variable nodes)
    for (const orefEl of childArray(sheet, 'ORef')) {
      const id = attr(orefEl, 'ID') || uid('oref');
      const operand = attr(orefEl, 'Operand') || '';
      const x = Number(attr(orefEl, 'X')) || 0;
      const y = Number(attr(orefEl, 'Y')) || 0;
      const orefType = resolver.resolve(operand);

      nodes.push({
        id,
        type: 'OUT_VARIABLE',
        position: { x, y },
        inputs: [{ id: uid('pin'), name: 'IN', dataType: orefType }],
        outputs: [],
        tag: { name: operand, dataType: orefType },
      });
    }

    // Parse ICon — wire input connector (cross-sheet signal source)
    for (const iconEl of childArray(sheet, 'ICon')) {
      const id = attr(iconEl, 'ID') || uid('icon');
      const name = attr(iconEl, 'Name') || '';
      const x = Number(attr(iconEl, 'X')) || 0;
      const y = Number(attr(iconEl, 'Y')) || 0;
      nodes.push({
        id, type: 'IN_VARIABLE' as FBDBlockType,
        position: { x, y },
        inputs: [],
        outputs: [{ id: uid('pin'), name: '', dataType: 'BOOL' }],
        tag: { name, dataType: 'BOOL' },
      });
    }
    // Parse OCon — wire output connector (cross-sheet signal sink)
    for (const oconEl of childArray(sheet, 'OCon')) {
      const id = attr(oconEl, 'ID') || uid('ocon');
      const name = attr(oconEl, 'Name') || '';
      const x = Number(attr(oconEl, 'X')) || 0;
      const y = Number(attr(oconEl, 'Y')) || 0;
      nodes.push({
        id, type: 'OUT_VARIABLE' as FBDBlockType,
        position: { x, y },
        inputs: [{ id: uid('pin'), name: '', dataType: 'BOOL' }],
        outputs: [],
        tag: { name, dataType: 'BOOL' },
      });
    }

    // Parse TextBox elements — preserve in unmapped for round-trip
    for (const tbEl of childArray(sheet, 'TextBox')) {
      unmapped.push({ clmNodeId: null, vendorSpecificData: tbEl, reason: `FBD TextBox` });
    }

    // Parse Wire elements
    for (const wireEl of childArray(sheet, 'Wire')) {
      const fromId = attr(wireEl, 'FromID') || '';
      const toId = attr(wireEl, 'ToID') || '';
      const fromPin = attr(wireEl, 'FromParam') ?? '';
      const toPin = attr(wireEl, 'ToParam') ?? '';

      if (fromId && toId) {
        wires.push({
          id: uid('wire'),
          from: { nodeId: fromId, pin: fromPin },
          to: { nodeId: toId, pin: toPin },
        });
      }
    }
  }

  if (nodes.length === 0) return null;
  return { nodes, wires };
}

function mapRockwellFBDType(typeName: string): FBDBlockType {
  const upper = typeName.toUpperCase();
  const map: Record<string, FBDBlockType> = {
    // Boolean gates (Rockwell BAND/BOR/BNOT/BXOR and IEC names)
    AND: 'AND', OR: 'OR', NOT: 'NOT', XOR: 'XOR',
    BAND: 'AND', BOR: 'OR', BNOT: 'NOT', BXOR: 'XOR',
    // Arithmetic
    ADD: 'ADD', SUB: 'SUB', MUL: 'MUL', DIV: 'DIV', MOD: 'MOD',
    ABS: 'ABS', SQR: 'SQRT', SQRT: 'SQRT', NEG: 'NEG',
    SIN: 'SIN', COS: 'COS', TAN: 'TAN', ATN: 'ATAN', ATAN: 'ATAN',
    ASN: 'ASIN', ACS: 'ACOS', LN: 'LN', LOG: 'LOG',
    // Timers
    TON: 'TON', TOF: 'TOF', RTO: 'TON', TP: 'TP', TONR: 'TONR',
    // Counters
    CTU: 'CTU', CTD: 'CTD', CTUD: 'CTUD',
    // Bistable / edge
    SR: 'SR', RS: 'RS',
    // Comparison (Rockwell mnemonics → IEC)
    EQU: 'EQ', NEQ: 'NE', GRT: 'GT', GEQ: 'GE', LES: 'LT', LEQ: 'LE',
    GT: 'GT', GE: 'GE', LT: 'LT', LE: 'LE', EQ: 'EQ', NE: 'NE',
    LIM: 'LIMIT', MEQ: 'EQ', CMP: 'EQ',
    // Data / selection
    MOVE: 'MOVE', MOV: 'MOVE', COP: 'MOVE', CPS: 'MOVE', FLL: 'MOVE',
    SEL: 'SEL', MUX: 'MUX', LIMIT: 'LIMIT', MIN: 'MIN', MAX: 'MAX',
    // Scaling / conversion
    SCL: 'SCALE', SCP: 'SCALE',
    TRUNC: 'TRUNC', ROUND: 'ROUND',
    INT_TO_REAL: 'INT_TO_REAL', REAL_TO_INT: 'REAL_TO_INT',
    DINT_TO_REAL: 'DINT_TO_REAL', REAL_TO_DINT: 'REAL_TO_DINT',
    // Bitwise
    BTD: 'BTD', SIZE: 'SIZE',
    // FIFO / LIFO / Sequencer
    FFL: 'FFL', FFU: 'FFU', LFL: 'LFL', LFU: 'LFU',
    SQO: 'SQO', SQI: 'SQI', SQL: 'SQL',
    // PID
    PID: 'PID', PIDE: 'PID', PIDAT: 'PID',
    // String functions
    LEN: 'LEN', LEFT: 'LEFT', RIGHT: 'RIGHT', MID: 'MID',
    CONCAT: 'CONCAT', FIND: 'FIND', INSERT: 'INSERT', DELETE: 'DELETE',
    UPPER: 'UPPER_CASE', LOWER: 'LOWER_CASE',
    // MSG / GSV / SSV / Motion — canvas placeholder
    MSG: 'MOVE', GSV: 'MOVE', SSV: 'MOVE',
    MAJ: 'MOVE', MAM: 'MOVE', MAS: 'MOVE',
  };
  return map[upper] || 'MOVE';
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function exportRockwell(project: NormalizedProject): ExportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sidecar = project.sidecar;

  const controllerTags = project.globalTags.map(tag => tagToL5XTag(tag));
  const programs = project.pous.map(pou => pouToL5XProgram(pou, warnings));

  // Restore preserved UDT/AOI data from sidecar
  const preservedDataTypes = sidecar.unmappedElements
    .filter(u => u.reason.startsWith('User-Defined Type'))
    .map(u => u.vendorSpecificData);

  const preservedAOIs = sidecar.unmappedElements
    .filter(u => u.reason.startsWith('AOI:'))
    .map(u => u.vendorSpecificData);

  const preservedModules = sidecar.unmappedElements.find(u => u.reason === 'Modules element')?.vendorSpecificData;
  const preservedTasks = sidecar.unmappedElements.find(u => u.reason === 'Tasks element')?.vendorSpecificData;

  // Build Controller children in XSD-mandated order:
  // DataTypes → Modules → AddOnInstructionDefinitions → Tags → Programs → Tasks → CST → WallClockTime → Trends → DataLogs → TimeSynchronize
  const controllerObj: Record<string, unknown> = {
    '@_Name': sidecar.vendorSpecificGlobals?.['controllerName'] ?? project.projectName,
    '@_ProcessorType': sidecar.vendorSpecificGlobals?.['processorType'] ?? '1769-L33ER',
    '@_MajorRev': '32',
    '@_MinorRev': '0',
  };

  // 1. DataTypes
  if (preservedDataTypes.length) {
    controllerObj['DataTypes'] = { DataType: preservedDataTypes };
  }

  // 2. Modules (restored from sidecar if available)
  if (preservedModules) {
    controllerObj['Modules'] = preservedModules;
  }

  // 3. AddOnInstructionDefinitions
  if (preservedAOIs.length) {
    controllerObj['AddOnInstructionDefinitions'] = { AddOnInstructionDefinition: preservedAOIs };
  }

  // 4. Tags
  controllerObj['Tags'] = { Tag: controllerTags };

  // 5. Programs
  controllerObj['Programs'] = { Program: programs };

  // 6. Tasks (use preserved if available)
  if (preservedTasks) {
    controllerObj['Tasks'] = preservedTasks;
  } else {
    controllerObj['Tasks'] = {
      Task: [{
        '@_Name': sidecar.vendorSpecificGlobals?.['mainTaskName'] ?? 'MainTask',
        '@_Type': sidecar.vendorSpecificGlobals?.['mainTaskType'] ?? 'Continuous',
        '@_Priority': '10',
        '@_Watchdog': '500',
        '@_DisableUpdateOutputs': 'false',
        '@_InhibitTask': 'false',
        ScheduledPrograms: {
          ScheduledProgram: project.pous.map(p => ({
            '@_Name': p.name.includes('_') ? p.name.split('_')[0] : p.name
          }))
        }
      }]
    };
  }

  // 7-11. CST, WallClockTime, Trends, DataLogs, TimeSynchronize
  controllerObj['CST'] = { '@_MasterID': '0' };
  controllerObj['WallClockTime'] = { '@_LocalTimeAdjustment': '0', '@_TimeZone': '0' };
  controllerObj['Trends'] = {};
  controllerObj['DataLogs'] = {};
  controllerObj['TimeSynchronize'] = { '@_Priority1': '128', '@_Priority2': '128', '@_PTPEnable': 'false' };

  const obj = {
    RSLogix5000Content: {
      '@_SchemaRevision': sidecar.vendorSpecificGlobals?.['schemaRevision'] ?? '1.0',
      '@_SoftwareRevision': '32.0',
      '@_TargetName': project.projectName,
      '@_TargetType': 'Controller',
      '@_ContainsContext': 'true',
      Controller: controllerObj,
    },
  };

  return { ok: true, xmlContent: buildXML(obj), errors, warnings };
}

function tagToL5XTag(tag: NormalizedTag): Record<string, unknown> {
  return {
    '@_Name': tag.name,
    '@_TagType': 'Base',
    '@_DataType': iecTypeToRockwell(tag.dataType),
    '@_Radix': 'Decimal',
    '@_ExternalAccess': 'Read/Write',
    Description: tag.description ? { '#cdata': tag.description } : undefined,
  };
}

function pouToL5XProgram(pou: NormalizedPOU, warnings: string[]): Record<string, unknown> {
  const localTags = pou.localTags.map(tagToL5XTag);
  let routine: Record<string, unknown>;

  if (pou.language === 'LD' && pou.ladderProgram) {
    routine = {
      '@_Name': 'MainRoutine',
      '@_Type': 'RLL',
      RLLContent: {
        Rung: pou.ladderProgram.rungs.map(rung => ({
          '@_Number': String(rung.number),
          '@_Type': rung.vendorType || 'N',
          Comment: rung.comment ? { '#cdata': rung.comment } : undefined,
          Text: { '#cdata': buildRungText(rung) },
        })),
      },
    };
  } else if (pou.language === 'FBD' && pou.fbdProgram) {
    routine = buildRockwellFBDRoutine(pou.fbdProgram);
  } else if (pou.language === 'ST' && pou.stSource) {
    // Export ST as line-by-line <Line Number="N"><![CDATA[...]]></Line> per L5X spec
    const stLines = pou.stSource.split('\n');
    routine = {
      '@_Name': 'MainRoutine',
      '@_Type': 'ST',
      STContent: {
        Line: stLines.map((line, idx) => ({
          '@_Number': String(idx),
          '#cdata': line,
        })),
      },
    };
  } else {
    warnings.push(`POU "${pou.name}": language ${pou.language} — exporting as empty RLL routine`);
    routine = {
      '@_Name': 'MainRoutine',
      '@_Type': 'RLL',
      RLLContent: { Rung: [{ '@_Number': '0', '@_Type': 'N', Text: { '#cdata': 'NOP();' } }] },
    };
  }

  return {
    '@_Name': pou.name,
    '@_Type': 'Normal',
    '@_MainRoutineName': 'MainRoutine',
    Tags: { Tag: localTags },
    Routines: { Routine: routine },
  };
}

function buildRungText(rung: Rung): string {
  const parts: string[] = [];

  // Emit main elements
  for (const el of rung.elements) {
    parts.push(elementToRungText(el));
  }

  // Emit branches as [ leg1 ,leg2 ] bracket syntax (L5X neutral text format)
  if (rung.branches.length > 0) {
    // Collect the main-path elements that are contacts (before coils) as first leg
    const coilInstrs = new Set(['OTE', 'OTL', 'OTU', 'OTN', 'RES']);
    const firstCoilIdx = parts.findIndex(p => coilInstrs.has(p.split('(')[0]));
    const insertAt = firstCoilIdx >= 0 ? firstCoilIdx : parts.length;

    // Build legs: first leg is empty (main path continues), remaining legs are branches
    const legStrings: string[] = [];
    // First leg: elements already on main path before the coil (none to add — they're already in parts)
    // For bracket format, each branch becomes a leg
    for (const branch of rung.branches) {
      const legParts: string[] = [];
      for (const el of branch.elements) {
        legParts.push(elementToRungText(el));
      }
      legStrings.push(legParts.join(''));
    }

    // Build bracket block: [firstLeg ,leg2 ,leg3 ...]
    // The "first leg" is the main path segment that was already emitted —
    // extract it from parts[0..insertAt-1] and place it as first leg
    const mainLeg = parts.splice(0, insertAt).join('');
    const allLegs = [mainLeg, ...legStrings];
    const bracketBlock = '[' + allLegs[0] + allLegs.slice(1).map(l => ' ,' + l).join('') + ' ]';
    parts.unshift(bracketBlock);
  }

  return parts.join('') + ';';
}

function elementToRungText(el: LadderElement): string {
  if (el.kind === 'contact') {
    const c = el as ContactElement;
    const instrMap: Record<string, string> = { NO: 'XIC', NC: 'XIO', P_CONTACT: 'OSR', N_CONTACT: 'OSF' };
    const instrName = instrMap[c.type] || 'XIC';
    // OSR/OSF with vendorArgs: emit both args for lossless round-trip
    const vendorArgs = (el as any).vendorArgs as string[] | undefined;
    if (vendorArgs && vendorArgs.length > 1) {
      return `${instrName}(${vendorArgs.join(',')})`;
    }
    return `${instrName}(${c.tag.name})`;
  } else if (el.kind === 'coil') {
    const c = el as CoilElement;
    const instrMap: Record<string, string> = { normal: 'OTE', negated: 'OTN', set: 'OTL', reset: 'RES', latch: 'OTL', unlatch: 'OTU' };
    return `${instrMap[c.type] || 'OTE'}(${c.tag.name})`;
  } else if (el.kind === 'block') {
    const b = el as BlockElement;
    // Use vendorOriginalName for lossless round-trip when available
    if (b.vendorOriginalName) {
      if (b.pins && Object.keys(b.pins).length > 0) {
        const pinVals = Object.values(b.pins).map((p: any) => p.name || '');
        return `${b.vendorOriginalName}(${pinVals.join(',')})`;
      }
      return `${b.vendorOriginalName}(${b.instanceName})`;
    }
    const instrMap: Record<string, string> = {
      // Timers
      TON: 'TON', TOF: 'TOF', TP: 'TON', TONR: 'TONR', RTO: 'RTO',
      // Counters
      CTU: 'CTU', CTD: 'CTD', CTUD: 'CTUD',
      // Bistable / edge
      SR: 'OTL', RS: 'OTU', RTRIG: 'OSR', FTRIG: 'OSF',
      // Math
      ADD: 'ADD', SUB: 'SUB', MUL: 'MUL', DIV: 'DIV', MOD: 'MOD',
      ABS: 'ABS', SQRT: 'SQR', NEG: 'NEG',
      SIN: 'SIN', COS: 'COS', TAN: 'TAN', ATAN: 'ATN', ASIN: 'ASN', ACOS: 'ACS',
      LN: 'LN', LOG: 'LOG',
      // Comparison
      EQ: 'EQU', NE: 'NEQ', GT: 'GRT', GE: 'GEQ', LT: 'LES', LE: 'LEQ',
      LIMIT: 'LIM',
      // Data / selection
      MOVE: 'MOV', SEL: 'SEL', MUX: 'MUX', MIN: 'MIN', MAX: 'MAX',
      // Scaling
      SCALE: 'SCL',
      // Bitwise
      AND: 'AND', OR: 'OR', NOT: 'NOT', XOR: 'XOR', BTD: 'BTD', SIZE: 'SIZE',
      // FIFO / Sequencer
      FFL: 'FFL', FFU: 'FFU', LFL: 'LFL', LFU: 'LFU',
      SQO: 'SQO', SQI: 'SQI', SQL: 'SQL',
      // PID
      PID: 'PID',
      // String
      LEN: 'LEN', LEFT: 'LEFT', RIGHT: 'RIGHT', MID: 'MID',
      CONCAT: 'CONCAT', FIND: 'FIND', INSERT: 'INSERT', DELETE: 'DELETE',
      UPPER_CASE: 'UPPER', LOWER_CASE: 'LOWER',
    };
    const instr = instrMap[b.fbType] || b.fbType;
    if (b.pins && Object.keys(b.pins).length > 0) {
      const pinVals = Object.values(b.pins).map((p: any) => p.name || '');
      return `${instr}(${pinVals.join(',')})`;
    }
    return `${instr}(${b.instanceName})`;
  }
  return '';
}

// ─── FBD Export (Sheet/FBD_Block/IRef/ORef/Wire) ────────────────────────────

function buildRockwellFBDRoutine(fbd: FBDProgram): Record<string, unknown> {
  const fbdBlocks: Record<string, unknown>[] = [];
  const irefs: Record<string, unknown>[] = [];
  const orefs: Record<string, unknown>[] = [];
  const wires: Record<string, unknown>[] = [];

  const iecToRockwellBlock: Record<string, string> = {
    // Boolean gates
    AND: 'BAND', OR: 'BOR', NOT: 'BNOT', XOR: 'BXOR',
    // Arithmetic
    ADD: 'ADD', SUB: 'SUB', MUL: 'MUL', DIV: 'DIV', MOD: 'MOD',
    ABS: 'ABS', SQRT: 'SQR', NEG: 'NEG',
    SIN: 'SIN', COS: 'COS', TAN: 'TAN', ATAN: 'ATN', ASIN: 'ASN', ACOS: 'ACS',
    LN: 'LN', LOG: 'LOG',
    // Timers / counters
    TON: 'TON', TOF: 'TOF', TP: 'TP', TONR: 'TONR',
    CTU: 'CTU', CTD: 'CTD', CTUD: 'CTUD',
    // Bistable / edge
    SR: 'SR', RS: 'RS', RTRIG: 'OSR', FTRIG: 'OSF',
    // Comparison
    GT: 'GRT', GE: 'GEQ', LT: 'LES', LE: 'LEQ', EQ: 'EQU', NE: 'NEQ',
    LIMIT: 'LIM',
    // Data / selection
    MOVE: 'MOV', SEL: 'SEL', MUX: 'MUX', MIN: 'MIN', MAX: 'MAX',
    // Scaling
    SCALE: 'SCL', UNSCALE: 'SCP',
    // Conversion
    TRUNC: 'TRUNC', ROUND: 'ROUND',
    INT_TO_REAL: 'INT_TO_REAL', REAL_TO_INT: 'REAL_TO_INT',
    DINT_TO_REAL: 'DINT_TO_REAL', REAL_TO_DINT: 'REAL_TO_DINT',
    // Bitwise
    BTD: 'BTD', SIZE: 'SIZE',
    // FIFO / Sequencer
    FFL: 'FFL', FFU: 'FFU', LFL: 'LFL', LFU: 'LFU',
    SQO: 'SQO', SQI: 'SQI', SQL: 'SQL',
    // PID
    PID: 'PID',
    // String
    LEN: 'LEN', LEFT: 'LEFT', RIGHT: 'RIGHT', MID: 'MID',
    CONCAT: 'CONCAT', FIND: 'FIND', INSERT: 'INSERT', DELETE: 'DELETE',
    UPPER_CASE: 'UPPER', LOWER_CASE: 'LOWER',
  };

  for (const node of fbd.nodes) {
    if (node.type === 'IN_VARIABLE') {
      irefs.push({
        '@_ID': node.id,
        '@_X': String(node.position.x),
        '@_Y': String(node.position.y),
        '@_Operand': node.tag?.name || '',
      });
    } else if (node.type === 'OUT_VARIABLE') {
      orefs.push({
        '@_ID': node.id,
        '@_X': String(node.position.x),
        '@_Y': String(node.position.y),
        '@_Operand': node.tag?.name || '',
      });
    } else {
      const rockType = node.vendorOriginalName || iecToRockwellBlock[node.type] || node.type;
      // Real L5X format: <Block Type="TON" VisiblePins="IN PT Q ET" Operand="Timer1"/>
      const visiblePins = [
        ...(node.inputs || []).map(p => p.name),
        ...(node.outputs || []).map(p => p.name),
      ].join(' ');
      fbdBlocks.push({
        '@_Type': rockType,
        '@_ID': node.id,
        '@_X': String(node.position.x),
        '@_Y': String(node.position.y),
        '@_Operand': node.instanceName || '',
        '@_VisiblePins': visiblePins,
      });
    }
  }

  // Build a nodeId → node.type map for IRef/ORef pin convention
  const nodeTypeMap = new Map<string, string>();
  for (const node of fbd.nodes) {
    nodeTypeMap.set(node.id, node.type);
  }

  for (const wire of fbd.wires) {
    const fromNodeType = nodeTypeMap.get(wire.from.nodeId) || '';
    const toNodeType = nodeTypeMap.get(wire.to.nodeId) || '';
    const wireObj: Record<string, string> = {
      '@_FromID': wire.from.nodeId,
      '@_ToID': wire.to.nodeId,
    };
    // IRef (IN_VARIABLE) → FromParam should be '' per spec
    if (fromNodeType !== 'IN_VARIABLE') {
      wireObj['@_FromParam'] = wire.from.pin;
    } else {
      wireObj['@_FromParam'] = '';
    }
    // ORef (OUT_VARIABLE) → ToParam should be '' per spec
    if (toNodeType !== 'OUT_VARIABLE') {
      wireObj['@_ToParam'] = wire.to.pin;
    } else {
      wireObj['@_ToParam'] = '';
    }
    wires.push(wireObj);
  }

  return {
    '@_Name': 'MainRoutine',
    '@_Type': 'FBD',
    FBDContent: {
      '@_SheetSize': 'Letter (8.5x11in)',
      '@_SheetOrientation': 'Landscape',
      Sheet: {
        '@_Number': '1',
        Block: fbdBlocks.length ? fbdBlocks : undefined,
        IRef: irefs.length ? irefs : undefined,
        ORef: orefs.length ? orefs : undefined,
        Wire: wires.length ? wires : undefined,
      },
    },
  };
}
