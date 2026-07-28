/*
 * Schneider Electric XEF/ZEF Adapter (Control Expert / EcoStruxure Machine Expert)
 * Parses .XEF (XML-based) and .ZEF (ZIP-compressed XEF) project files.
 *
 * Fixes applied:
 * - Edge contacts (P/N type) properly mapped
 * - SFC step actions fully parsed
 * - FBD standalone variable nodes imported
 * - FBD block pin details populated
 * - SFC link direction corrected (step vs transition detection)
 * - ZEF decompression support
 */

import { parseXML, buildXML, attr, text, child, childArray } from '../xmlUtils.js';
import { schneiderTypeToIEC } from '../dataTypeMap.js';
import { buildResolver, VariableTypeResolver } from '../variableTypeResolver.js';
import { getPinDataType, buildTypedPins, buildTypedTagRefPins } from '../pinSignatures.js';
import type {
  ImportResult, ExportResult, NormalizedProject, NormalizedPOU, NormalizedTag,
  VendorMetadataSidecar, UnmappedElement,
} from '../types.js';
import type {
  LadderProgram, FBDProgram, SFCProgram, Rung, LadderElement,
  ContactElement, CoilElement, BlockElement, ContactType, CoilType,
  FBDNode, FBDWire, FBDBlockType, Pin,
  SFCStep, SFCTransition, SFCLink, SFCAction, ActionQualifier,
} from '../../logicStore.js';

let _uid = 0;
function uid(prefix: string): string { return `${prefix}-${++_uid}-${Math.random().toString(36).slice(2, 8)}`; }

function unescapeXML(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

// ─── ZEF Decompression ───────────────────────────────────────────────────────

async function decompressZEF(data: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(data);

  // Check for ZIP magic header (PK\x03\x04)
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4B)) {
    // Not a ZIP — treat as plain XML
    return new TextDecoder().decode(data);
  }

  // ZIP file — iterate all local file headers to find the XEF/XML entry
  // Local file header layout: sig(4) + minVer(2) + flags(2) + method(2) + modTime(2) + modDate(2)
  //   + crc32(4) + compSize(4) + uncompSize(4) + fnLen(2) + extraLen(2) + filename(fnLen) + extra(extraLen) + data
  let pos = 0;
  let bestXmlEntry: { start: number; compSize: number; uncompSize: number; method: number; name: string } | null = null;

  while (pos + 30 <= bytes.length) {
    const sig = bytes[pos] | (bytes[pos+1] << 8) | (bytes[pos+2] << 16) | (bytes[pos+3] << 24);
    if (sig !== 0x04034b50) break; // Not a local file header — stop scanning

    const method = bytes[pos+8] | (bytes[pos+9] << 8);
    const compSize = bytes[pos+18] | (bytes[pos+19] << 8) | (bytes[pos+20] << 16) | (bytes[pos+21] << 24);
    const uncompSize = bytes[pos+22] | (bytes[pos+23] << 8) | (bytes[pos+24] << 16) | (bytes[pos+25] << 24);
    const fnLen = bytes[pos+26] | (bytes[pos+27] << 8);
    const extraLen = bytes[pos+28] | (bytes[pos+29] << 8);
    const fnBytes = bytes.slice(pos + 30, pos + 30 + fnLen);
    const fileName = new TextDecoder().decode(fnBytes).toLowerCase();
    const dataStart = pos + 30 + fnLen + extraLen;

    // Prefer the .xef or .xml entry; skip directory entries and DTM files
    if ((fileName.endsWith('.xef') || fileName.endsWith('.xml')) && !fileName.includes('fdtdtm') && compSize > 0) {
      bestXmlEntry = { start: dataStart, compSize, uncompSize, method, name: fileName };
      break; // First matching entry is usually the main project
    }

    pos = dataStart + (compSize > 0 ? compSize : uncompSize);
  }

  if (!bestXmlEntry) {
    // No XML entry found — fall back to trying first entry
    const fnLen = bytes[26] | (bytes[27] << 8);
    const extraLen = bytes[28] | (bytes[29] << 8);
    bestXmlEntry = {
      start: 30 + fnLen + extraLen,
      compSize: bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24),
      uncompSize: bytes[22] | (bytes[23] << 8) | (bytes[24] << 16) | (bytes[25] << 24),
      method: bytes[8] | (bytes[9] << 8),
      name: 'fallback',
    };
  }

  // Method 0 = stored (no compression)
  if (bestXmlEntry.method === 0) {
    return new TextDecoder().decode(bytes.slice(bestXmlEntry.start, bestXmlEntry.start + bestXmlEntry.uncompSize));
  }

  // Method 8 = deflate
  try {
    const ds = new DecompressionStream('deflate-raw');
    const compressedData = bytes.slice(bestXmlEntry.start, bestXmlEntry.start + bestXmlEntry.compSize);
    const blob = new Blob([compressedData]);
    const stream = blob.stream().pipeThrough(ds);
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return new TextDecoder().decode(result);
  } catch {
    // Fallback: gzip wrapper
    try {
      const ds = new DecompressionStream('deflate');
      const blob = new Blob([bytes.slice(bestXmlEntry.start, bestXmlEntry.start + bestXmlEntry.compSize)]);
      const stream = blob.stream().pipeThrough(ds);
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
      const totalLen = chunks.reduce((s, c) => s + c.length, 0);
      const result = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
      return new TextDecoder().decode(result);
    } catch {
      throw new Error(`Failed to decompress ZEF file entry "${bestXmlEntry.name}"`);
    }
  }
}

// ─── Import ───────────────────────────────────────────────────────────────────

export function importSchneider(xmlContent: string, filePath: string): ImportResult {
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

  // XEF root: <FEFExchangeFile> (real XEF), <ProjectFile>, or <project>
  const fefRoot = child(root, 'FEFExchangeFile') ?? child(root, 'ProjectFile') ?? child(root, 'project') as Record<string, unknown> | undefined;
  if (!fefRoot) {
    return { ok: false, errors: ['No <FEFExchangeFile> or <ProjectFile> root found in XEF file'], warnings: [] };
  }
  // For backward-compat with old code paths, alias projectFile -> fefRoot
  const projectFile = fefRoot;

  const projectName = attr(projectFile, 'Name') || attr(projectFile, 'name') || 'Schneider Import';
  const version = attr(projectFile, 'Version') || '1.0';

  const globalTags: NormalizedTag[] = [];
  const pous: NormalizedPOU[] = [];

  // Bug 2: Global variables — real XEF uses <dataBlock><variables ...>
  const dataBlock = child(fefRoot, 'dataBlock');
  if (dataBlock) {
    for (const varEl of childArray(dataBlock, 'variables')) {
      const tag = parseXEFVariable(varEl, unmapped);
      if (tag) globalTags.push(tag);
    }
  } else {
    // Fallback: older format with GlobalSection
    const dataEl = child(projectFile, 'Data') ?? projectFile;
    const globalSection = child(dataEl, 'GlobalSection') ?? child(projectFile, 'Global');
    if (globalSection) {
      for (const varEl of childArray(globalSection, 'Variable').concat(childArray(globalSection, 'Var')).concat(childArray(globalSection, 'variables'))) {
        const tag = parseXEFVariable(varEl, unmapped);
        if (tag) globalTags.push(tag);
      }
    }
  }

  // Parse FBSource (function block type definitions) as function-block POUs
  for (const fbSrc of childArray(fefRoot, 'FBSource')) {
    const fbTypeName = attr(fbSrc, 'nameOfFBType') || 'FB';
    const localTags: NormalizedTag[] = [];
    // Input/output/local parameters
    for (const v of childArray(child(fbSrc, 'inputParameters'), 'variables')) {
      const tag = parseXEFVariable(v, unmapped);
      if (tag) { (tag as any)._paramDir = 'input'; localTags.push(tag); }
    }
    for (const v of childArray(child(fbSrc, 'outputParameters'), 'variables')) {
      const tag = parseXEFVariable(v, unmapped);
      if (tag) { (tag as any)._paramDir = 'output'; localTags.push(tag); }
    }
    for (const v of childArray(child(fbSrc, 'inOutParameters'), 'variables')) {
      const tag = parseXEFVariable(v, unmapped);
      if (tag) { (tag as any)._paramDir = 'inout'; localTags.push(tag); }
    }
    for (const v of childArray(child(fbSrc, 'publicLocalVariables'), 'variables')) {
      const tag = parseXEFVariable(v, unmapped);
      if (tag) localTags.push(tag);
    }
    for (const v of childArray(child(fbSrc, 'privateLocalVariables'), 'variables')) {
      const tag = parseXEFVariable(v, unmapped);
      if (tag) localTags.push(tag);
    }
    // Parse FBProgram body
    const fbProgEl = child(fbSrc, 'FBProgram');
    if (fbProgEl) {
      const fbdSourceEl = child(fbProgEl, 'FBDSource');
      if (fbdSourceEl) {
        const resolver = buildResolver(localTags, []);
        const bodyEl = child(fbdSourceEl, 'networkFBD') ?? fbdSourceEl;
        const fbd = parseXEFFBD(bodyEl, fbTypeName, unmapped, resolver);
        const nbRows = attr(fbdSourceEl, 'nbRows');
        const nbColumns = attr(fbdSourceEl, 'nbColumns');
        if (nbRows || nbColumns) (fbd as any)._xefGrid = { nbRows, nbColumns };
        pous.push({ id: `pou-${fbTypeName}`, name: fbTypeName, language: 'FBD', fbdProgram: fbd, localTags, pouType: 'functionBlock' });
      } else {
        const stSrc = text(child(fbProgEl, 'STSource') ?? fbProgEl);
        pous.push({ id: `pou-${fbTypeName}`, name: fbTypeName, language: 'ST', stSource: stSrc ? unescapeXML(stSrc) : '', localTags, pouType: 'functionBlock' });
      }
    }
  }

  // Bug 4: Programs — real XEF has <program> directly under <FEFExchangeFile>, no wrapper
  const directPrograms = childArray(fefRoot, 'program');
  if (directPrograms.length > 0) {
    for (const programEl of directPrograms) {
      const pou = parseXEFProgramFEF(programEl, unmapped, warnings);
      if (pou) pous.push(pou);
    }
  } else {
    // Fallback: older format with Programs wrapper
    const dataEl = child(projectFile, 'Data') ?? projectFile;
    const programsEl = child(dataEl, 'Programs') ?? child(projectFile, 'Programs');
    for (const programEl of childArray(programsEl, 'Program').concat(childArray(programsEl, 'POU'))) {
      const pou = parseXEFProgram(programEl, unmapped, warnings);
      if (pou) pous.push(pou);
    }
  }

  // Also check direct sections (legacy format)
  const _dataElForSections = child(projectFile, 'Data') ?? projectFile;
  for (const section of childArray(_dataElForSections, 'Section').concat(childArray(projectFile, 'Section'))) {
    const sectionType = attr(section, 'Type') || attr(section, 'language') || '';
    const sectionName = attr(section, 'Name') || attr(section, 'name') || 'Section';

    if (sectionType.toUpperCase() === 'LD' || sectionType.toUpperCase() === 'LADDER') {
      const ladder = parseXEFLadder(section, sectionName, unmapped);
      pous.push({ id: `pou-${sectionName}`, name: sectionName, language: 'LD', ladderProgram: ladder, localTags: [] });
    } else if (sectionType.toUpperCase() === 'FBD') {
      const fbd = parseXEFFBD(section, sectionName, unmapped);
      pous.push({ id: `pou-${sectionName}`, name: sectionName, language: 'FBD', fbdProgram: fbd, localTags: [] });
    } else if (sectionType.toUpperCase() === 'SFC') {
      const sfc = parseXEFSFC(section, sectionName, unmapped);
      pous.push({ id: `pou-${sectionName}`, name: sectionName, language: 'SFC', sfcProgram: sfc, localTags: [] });
    } else if (sectionType.toUpperCase() === 'ST' || sectionType.toUpperCase() === 'IL') {
      const rawStSrc = text(child(section, 'Body') ?? section);
      const stSrc = rawStSrc ? unescapeXML(rawStSrc) : rawStSrc;
      if (sectionType.toUpperCase() === 'IL') {
        warnings.push(`Section "${sectionName}" uses IL — importing as ST text (review required)`);
      }
      pous.push({ id: `pou-${sectionName}`, name: sectionName, language: 'ST', stSource: stSrc, localTags: [] });
    } else if (sectionType) {
      unmapped.push({ clmNodeId: null, vendorSpecificData: section, reason: `Unknown section type: ${sectionType}` });
    }
  }

  if (pous.length === 0 && globalTags.length === 0) {
    errors.push('No programs, POUs, or tags found in XEF file');
    return { ok: false, errors, warnings };
  }

  const sidecar: VendorMetadataSidecar = {
    sourceVendor: 'schneider_xef',
    sourceFileVersion: version,
    originalFilePath: filePath,
    unmappedElements: unmapped,
    organizerTreeLayout: fefRoot,
    vendorSpecificGlobals: { version, projectName: attr(projectFile, 'Name') },
  };

  return { ok: true, project: { projectName, pous, globalTags, sidecar }, errors, warnings };
}

// Exported for ZEF files — call with pre-decompressed content
export { decompressZEF };

function parseXEFVariable(varEl: unknown, unmapped: UnmappedElement[]): NormalizedTag | null {
  if (!varEl || typeof varEl !== 'object') return null;
  const name = attr(varEl, 'name') || attr(varEl, 'Name');
  if (!name) return null;
  // Bug 3: typeName first (real XEF), then legacy Type/type
  const typeStr = attr(varEl, 'typeName') || attr(varEl, 'Type') || attr(varEl, 'type') || 'BOOL';
  const dataType = schneiderTypeToIEC(typeStr);
  // Bug 3: topologicalAddress first (real XEF), then legacy
  const address = attr(varEl, 'topologicalAddress') || attr(varEl, 'Address') || attr(varEl, 'Topological') || undefined;
  // Bug 3: variableInit child value first, then legacy
  const initVal = attr(child(varEl, 'variableInit'), 'value') || attr(varEl, 'InitialValue') || text(child(varEl, 'InitialValue')) || undefined;
  // Bug 3: lowercase comment first (real XEF), then legacy
  const desc = text(child(varEl, 'comment') ?? child(varEl, 'Comment') ?? child(varEl, 'Description')) || undefined;

  // Preserve attribute children (TimeStampSource, DDTSource, PositionPin, etc.)
  const attributes: Record<string, string>[] = [];
  for (const attrEl of childArray(varEl, 'attribute')) {
    const attrName = attr(attrEl, 'name');
    const attrValue = attr(attrEl, 'value');
    if (attrName) attributes.push({ name: attrName, value: attrValue || '' });
  }

  if (typeStr.toUpperCase() === 'EBOOL') {
    unmapped.push({ clmNodeId: name, vendorSpecificData: { originalType: 'EBOOL' }, reason: 'EBOOL mapped to BOOL (edge bit semantics lost)' });
  }

  const tag: NormalizedTag = { name, dataType, initialValue: initVal, description: desc, address };
  // Stash vendor-specific attributes for round-trip
  if (attributes.length > 0 || typeStr.toUpperCase() === 'EBOOL') {
    (tag as any)._xefMeta = { originalType: typeStr, attributes };
  }
  return tag;
}

function parseXEFProgram(programEl: unknown, unmapped: UnmappedElement[], warnings: string[]): NormalizedPOU | null {
  if (!programEl || typeof programEl !== 'object') return null;
  const name = attr(programEl, 'Name') || attr(programEl, 'name') || 'Program';
  const language = (attr(programEl, 'Language') || attr(programEl, 'language') || 'LD').toUpperCase();

  const localTags: NormalizedTag[] = [];
  const varsEl = child(programEl, 'Variables') ?? child(programEl, 'LocalVars');
  for (const v of childArray(varsEl, 'Variable').concat(childArray(varsEl, 'Var'))) {
    const tag = parseXEFVariable(v, unmapped);
    if (tag) localTags.push(tag);
  }

  const bodyEl = child(programEl, 'Body') ?? programEl;

  const resolver = buildResolver(localTags, []);

  if (language === 'LD' || language === 'LADDER') {
    const ladder = parseXEFLadder(bodyEl, name, unmapped, resolver);
    return { id: `pou-${name}`, name, language: 'LD', ladderProgram: ladder, localTags, pouType: 'program' };
  }
  if (language === 'FBD') {
    const fbd = parseXEFFBD(bodyEl, name, unmapped, resolver);
    return { id: `pou-${name}`, name, language: 'FBD', fbdProgram: fbd, localTags, pouType: 'program' };
  }
  if (language === 'SFC') {
    const sfc = parseXEFSFC(bodyEl, name, unmapped);
    return { id: `pou-${name}`, name, language: 'SFC', sfcProgram: sfc, localTags, pouType: 'program' };
  }
  if (language === 'ST') {
    const rawSrc = text(bodyEl);
    const src = rawSrc ? unescapeXML(rawSrc) : rawSrc;
    return { id: `pou-${name}`, name, language: 'ST', stSource: src, localTags, pouType: 'program' };
  }
  if (language === 'IL') {
    warnings.push(`Program "${name}": IL language — importing as ST comment`);
    return { id: `pou-${name}`, name, language: 'ST', stSource: `(* IL: ${text(bodyEl)} *)`, localTags, pouType: 'program' };
  }

  unmapped.push({ clmNodeId: null, vendorSpecificData: programEl, reason: `Program "${name}": unknown language ${language}` });
  return null;
}

// ─── FEF (real XEF) program parser — Bugs 4, 5, 6, 13 ───────────────────────

function parseXEFProgramFEF(programEl: unknown, unmapped: UnmappedElement[], warnings: string[]): NormalizedPOU | null {
  if (!programEl || typeof programEl !== 'object') return null;

  // Bug 4: identity comes from <identProgram> child
  const identEl = child(programEl, 'identProgram');
  const name = attr(identEl, 'name') || attr(programEl, 'Name') || attr(programEl, 'name') || 'Program';
  const task = attr(identEl, 'task') || 'MAST';
  const sectionType = attr(identEl, 'type') || 'section';

  // Bug 5: detect language from body element presence
  const language = child(programEl, 'FBDSource') ? 'FBD'
    : child(programEl, 'LDSource') ? 'LD'
    : child(programEl, 'SFCSource') ? 'SFC'
    : child(programEl, 'STSource') ? 'ST'
    : 'ST';

  // Bug 13: local variables from publicLocalVariables and privateLocalVariables
  const localTags: NormalizedTag[] = [];
  const publicVars = child(programEl, 'publicLocalVariables');
  const privateVars = child(programEl, 'privateLocalVariables');
  const localVarEls = [
    ...(publicVars ? childArray(publicVars, 'variables') : []),
    ...(privateVars ? childArray(privateVars, 'variables') : []),
  ];
  for (const v of localVarEls) {
    const tag = parseXEFVariable(v, unmapped);
    if (tag) localTags.push(tag);
  }

  const resolver = buildResolver(localTags, []);

  if (language === 'FBD') {
    // Bug 6: unwrap FBDSource -> networkFBD
    const fbdSourceEl = child(programEl, 'FBDSource');
    const bodyEl = child(fbdSourceEl, 'networkFBD') ?? fbdSourceEl;
    const fbd = parseXEFFBD(bodyEl, name, unmapped, resolver);
    // Preserve FBDSource grid dimensions for round-trip
    const nbRows = attr(fbdSourceEl, 'nbRows');
    const nbColumns = attr(fbdSourceEl, 'nbColumns');
    if (nbRows || nbColumns) {
      (fbd as any)._xefGrid = { nbRows, nbColumns };
    }
    const pou: NormalizedPOU = { id: `pou-${name}`, name, language: 'FBD', fbdProgram: fbd, localTags, pouType: 'program' };
    (pou as any)._xefMeta = { task, sectionType };
    return pou;
  }
  if (language === 'LD') {
    const ldSourceEl = child(programEl, 'LDSource');
    const ladder = parseXEFLadder(ldSourceEl ?? programEl, name, unmapped, resolver);
    const pou: NormalizedPOU = { id: `pou-${name}`, name, language: 'LD', ladderProgram: ladder, localTags, pouType: 'program' };
    (pou as any)._xefMeta = { task, sectionType };
    return pou;
  }
  if (language === 'SFC') {
    const sfcSourceEl = child(programEl, 'SFCSource');
    const sfc = parseXEFSFC(sfcSourceEl ?? programEl, name, unmapped);
    const pou: NormalizedPOU = { id: `pou-${name}`, name, language: 'SFC', sfcProgram: sfc, localTags, pouType: 'program' };
    (pou as any)._xefMeta = { task, sectionType };
    return pou;
  }
  if (language === 'ST') {
    const stSourceEl = child(programEl, 'STSource');
    const rawSrc = text(stSourceEl ?? programEl);
    const src = rawSrc ? unescapeXML(rawSrc) : rawSrc;
    const pou: NormalizedPOU = { id: `pou-${name}`, name, language: 'ST', stSource: src, localTags, pouType: 'program' };
    (pou as any)._xefMeta = { task, sectionType };
    return pou;
  }

  warnings.push(`Program "${name}": unrecognised language "${language}" — skipped`);
  return null;
}

// ─── XEF Ladder parser ────────────────────────────────────────────────────────

function parseXEFLadder(bodyEl: unknown, pouName: string, unmapped: UnmappedElement[], resolver: VariableTypeResolver = new VariableTypeResolver()): LadderProgram {
  const rungs: Rung[] = [];
  let rungIdx = 0;

  for (const rungEl of childArray(bodyEl, 'Rung').concat(childArray(bodyEl, 'Network'))) {
    rungIdx++;
    const comment = text(child(rungEl, 'Comment')) || '';
    const elements: LadderElement[] = [];
    let posX = 0;

    // Contacts — with edge detection support
    for (const ctEl of childArray(rungEl, 'Contact').concat(childArray(rungEl, 'CT'))) {
      const tagName = attr(ctEl, 'Variable') || attr(ctEl, 'name') || `TAG_${posX}`;
      const ctType = (attr(ctEl, 'Type') || attr(ctEl, 'type') || '').toUpperCase();
      const negated = attr(ctEl, 'Negated') === 'true' || ctType === 'NC';

      let contactType: ContactType = negated ? 'NC' : 'NO';
      if (ctType === 'P' || ctType === 'RE' || ctType === 'RISING') contactType = 'P_CONTACT';
      if (ctType === 'N' || ctType === 'FE' || ctType === 'FALLING') contactType = 'N_CONTACT';

      elements.push({
        kind: 'contact',
        id: uid(`xef-ct-${rungIdx}`),
        type: contactType,
        tag: { name: tagName, dataType: resolver.resolve(tagName) },
        position: { x: posX, y: 0 },
      });
      posX += 60;
    }

    // Coils
    for (const coilEl of childArray(rungEl, 'Coil').concat(childArray(rungEl, 'CL'))) {
      const tagName = attr(coilEl, 'Variable') || attr(coilEl, 'name') || `COIL_${posX}`;
      const coilType = (attr(coilEl, 'Type') || attr(coilEl, 'type') || '').toUpperCase();
      let type: CoilType = 'normal';
      if (coilType === 'SET' || coilType === 'S') type = 'set';
      if (coilType === 'RESET' || coilType === 'R') type = 'reset';
      if (coilType === 'NEGATED' || coilType === '/') type = 'negated';
      if (coilType === 'LATCH' || coilType === 'L') type = 'latch';
      if (coilType === 'UNLATCH' || coilType === 'U') type = 'unlatch';
      elements.push({
        kind: 'coil',
        id: uid(`xef-coil-${rungIdx}`),
        type,
        tag: { name: tagName, dataType: resolver.resolve(tagName) },
        position: { x: posX, y: 0 },
      });
      posX += 60;
    }

    // Function blocks
    for (const fbEl of childArray(rungEl, 'FunctionBlock').concat(childArray(rungEl, 'Operator'))) {
      const typeName = attr(fbEl, 'Type') || attr(fbEl, 'typeName') || '';
      const instanceName = attr(fbEl, 'Instance') || attr(fbEl, 'name') || typeName;
      const xefFBMap: Record<string, string> = {
        TON: 'TON', TOF: 'TOF', TP: 'TP', CTU: 'CTU', CTD: 'CTD', CTUD: 'CTUD',
        SR: 'SR', RS: 'RS', R_TRIG: 'RTRIG', F_TRIG: 'FTRIG',
      };
      const fbType = xefFBMap[typeName.toUpperCase()] || typeName;

      // Build raw pin→variable map then apply canonical types
      const rawPins: Record<string, string> = {};
      for (const pinEl of childArray(fbEl, 'InputPin').concat(childArray(fbEl, 'Pin'))) {
        const pinName = attr(pinEl, 'Name') || attr(pinEl, 'name') || `IN${Object.keys(rawPins).length}`;
        rawPins[pinName] = attr(pinEl, 'Variable') || attr(pinEl, 'value') || pinName;
      }
      for (const pinEl of childArray(fbEl, 'OutputPin')) {
        const pinName = attr(pinEl, 'Name') || attr(pinEl, 'name') || `OUT${Object.keys(rawPins).length}`;
        rawPins[pinName] = attr(pinEl, 'Variable') || attr(pinEl, 'value') || pinName;
      }
      const typedPins = buildTypedTagRefPins(fbType, rawPins);
      const pins: Record<string, { name: string; dataType: string }> = {};
      for (const [pinName, pinDef] of Object.entries(typedPins)) {
        const varName = pinDef.name;
        const resolvedType = varName ? resolver.resolve(varName) : null;
        pins[pinName] = { name: varName, dataType: (resolvedType && resolvedType !== 'BOOL') ? resolvedType : pinDef.dataType };
      }

      elements.push({
        kind: 'block',
        id: uid(`xef-fb-${rungIdx}`),
        fbType: fbType as any,
        instanceName,
        pins,
        position: { x: posX, y: 0 },
      });
      posX += 60;
    }

    // Parse branch elements (parallel paths)
    const branches: import('../../logicStore.js').Branch[] = [];
    for (const branchEl of childArray(rungEl, 'Branch').concat(childArray(rungEl, 'Parallel'))) {
      const branchElements: LadderElement[] = [];
      let bPosX = 0;

      for (const ctEl of childArray(branchEl, 'Contact').concat(childArray(branchEl, 'CT'))) {
        const tagName = attr(ctEl, 'Variable') || attr(ctEl, 'name') || `TAG_${bPosX}`;
        const ctType = (attr(ctEl, 'Type') || attr(ctEl, 'type') || '').toUpperCase();
        const negated = attr(ctEl, 'Negated') === 'true' || ctType === 'NC';
        let contactType: ContactType = negated ? 'NC' : 'NO';
        if (ctType === 'P' || ctType === 'RE' || ctType === 'RISING') contactType = 'P_CONTACT';
        if (ctType === 'N' || ctType === 'FE' || ctType === 'FALLING') contactType = 'N_CONTACT';
        branchElements.push({
          kind: 'contact',
          id: uid(`xef-br-ct-${rungIdx}`),
          type: contactType,
          tag: { name: tagName, dataType: resolver.resolve(tagName) },
          position: { x: bPosX, y: 0 },
        });
        bPosX += 60;
      }
      for (const fbEl of childArray(branchEl, 'FunctionBlock').concat(childArray(branchEl, 'Operator'))) {
        const typeName = attr(fbEl, 'Type') || attr(fbEl, 'typeName') || '';
        const instanceName = attr(fbEl, 'Instance') || attr(fbEl, 'name') || typeName;
        const xefFBMap: Record<string, string> = {
          TON: 'TON', TOF: 'TOF', TP: 'TP', CTU: 'CTU', CTD: 'CTD', CTUD: 'CTUD',
          SR: 'SR', RS: 'RS', R_TRIG: 'RTRIG', F_TRIG: 'FTRIG',
        };
        const fbType = xefFBMap[typeName.toUpperCase()] || typeName;
        const brRawPins: Record<string, string> = {};
        for (const pinEl of childArray(fbEl, 'InputPin').concat(childArray(fbEl, 'Pin'))) {
          const pinName = attr(pinEl, 'Name') || attr(pinEl, 'name') || `IN${Object.keys(brRawPins).length}`;
          brRawPins[pinName] = attr(pinEl, 'Variable') || attr(pinEl, 'value') || pinName;
        }
        const brTypedPins = buildTypedTagRefPins(fbType, brRawPins);
        const brPins: Record<string, { name: string; dataType: string }> = {};
        for (const [pn, pd] of Object.entries(brTypedPins)) {
          const vn = pd.name;
          const rt = vn ? resolver.resolve(vn) : null;
          brPins[pn] = { name: vn, dataType: (rt && rt !== 'BOOL') ? rt : pd.dataType };
        }
        branchElements.push({
          kind: 'block', id: uid(`xef-br-fb-${rungIdx}`),
          fbType: fbType as any, instanceName, pins: brPins,
          position: { x: bPosX, y: 0 },
        });
        bPosX += 60;
      }
      for (const coilEl of childArray(branchEl, 'Coil').concat(childArray(branchEl, 'CL'))) {
        const tagName = attr(coilEl, 'Variable') || attr(coilEl, 'name') || `COIL_${bPosX}`;
        const coilType = (attr(coilEl, 'Type') || attr(coilEl, 'type') || '').toUpperCase();
        let type: CoilType = 'normal';
        if (coilType === 'SET' || coilType === 'S') type = 'set';
        if (coilType === 'RESET' || coilType === 'R') type = 'reset';
        if (coilType === 'NEGATED' || coilType === '/') type = 'negated';
        if (coilType === 'LATCH' || coilType === 'L') type = 'latch';
        if (coilType === 'UNLATCH' || coilType === 'U') type = 'unlatch';
        branchElements.push({
          kind: 'coil',
          id: uid(`xef-br-coil-${rungIdx}`),
          type,
          tag: { name: tagName, dataType: resolver.resolve(tagName) },
          position: { x: bPosX, y: 0 },
        });
        bPosX += 60;
      }

      if (branchElements.length > 0) {
        branches.push({
          id: uid(`xef-branch-${rungIdx}`),
          startNodeId: elements[0]?.id || '',
          endNodeId: branchElements[branchElements.length - 1].id,
          elements: branchElements,
        });
      }
    }

    rungs.push({ id: `${pouName}-rung-${rungIdx}`, number: rungIdx, comment, elements, branches });
  }

  return { rungs };
}

// ─── XEF FBD parser ───────────────────────────────────────────────────────────

function parseXEFFBD(bodyEl: unknown, pouName: string, unmapped: UnmappedElement[], resolver: VariableTypeResolver = new VariableTypeResolver()): FBDProgram {
  const nodes: FBDNode[] = [];
  const wires: FBDWire[] = [];
  let idx = 0;

  // Bug 11: map instanceName -> generated nodeId for wire resolution
  const instanceNameToNodeId = new Map<string, string>();

  // Bug 7: FFBBlock (real XEF) first, then FBDObject/Block (legacy)
  const allBlockEls = childArray(bodyEl, 'FFBBlock')
    .concat(childArray(bodyEl, 'FBDObject'))
    .concat(childArray(bodyEl, 'Block'));

  for (const blockEl of allBlockEls) {
    // Bug 8: typeName first (real XEF), then legacy Type
    const typeName = attr(blockEl, 'typeName') || attr(blockEl, 'Type') || attr(blockEl, 'type') || 'BLOCK';
    // Bug 8: instanceName first (real XEF), then legacy
    const instanceName = attr(blockEl, 'instanceName') || attr(blockEl, 'Instance') || attr(blockEl, 'name') || typeName;
    const id = instanceName || attr(blockEl, 'Id') || String(idx++);
    const nodeId = `xef-fbd-${id}-${idx++}`;

    // Bug 11: register instanceName -> nodeId
    if (instanceName) instanceNameToNodeId.set(instanceName, nodeId);

    // Bug 9: objPosition first (real XEF), then Position (legacy)
    const posEl = child(blockEl, 'objPosition') ?? child(blockEl, 'Position');
    // Bug 9: posX/posY first (real XEF), then X/Y (legacy)
    const x = Number(attr(posEl, 'posX') || attr(posEl, 'X') || attr(blockEl, 'X') || attr(blockEl, 'x')) || idx * 120;
    const y = Number(attr(posEl, 'posY') || attr(posEl, 'Y') || attr(blockEl, 'Y') || attr(blockEl, 'y')) || 0;

    // Preserve FFBBlock-level attributes for round-trip
    const additionnalPinNumber = attr(blockEl, 'additionnalPinNumber') || attr(blockEl, 'additionalPinNumber');
    const enEnO = attr(blockEl, 'enEnO');
    const blockWidth = attr(blockEl, 'width');
    const blockHeight = attr(blockEl, 'height');

    // Start from canonical signature pins, then supplement with XML-declared pins
    const { inputs: sigInputs, outputs: sigOutputs } = buildTypedPins(typeName, [], nodeId);
    const inputsByName = new Map(sigInputs.map(p => [p.name, { ...p }]));
    const outputsByName = new Map(sigOutputs.map(p => [p.name, { ...p }]));

    // Bug 10: descriptionFFB -> inputVariable/outputVariable (real XEF)
    const descFFB = child(blockEl, 'descriptionFFB');
    const execAfter = attr(descFFB, 'execAfter') || undefined;
    const inputPinEls = descFFB ? childArray(descFFB, 'inputVariable') : [];
    const outputPinEls = descFFB ? childArray(descFFB, 'outputVariable') : [];

    for (const pinEl of inputPinEls.concat(childArray(blockEl, 'InputPin')).concat(childArray(blockEl, 'Input'))) {
      // Bug 10: formalParameter first (real XEF), then Name (legacy)
      const pinName = attr(pinEl, 'formalParameter') || attr(pinEl, 'Name') || attr(pinEl, 'name') || `IN${inputsByName.size}`;
      const negated = attr(pinEl, 'Negated') === 'true' || attr(pinEl, 'invertedPin') === 'true';
      const effectiveParameter = attr(pinEl, 'effectiveParameter') || undefined;
      const canonicalType = getPinDataType(typeName, pinName, 'input');
      const pin: any = { id: uid('pin'), name: pinName, dataType: canonicalType, negated };
      if (effectiveParameter) pin.value = effectiveParameter;
      inputsByName.set(pinName, pin);
    }
    for (const pinEl of outputPinEls.concat(childArray(blockEl, 'OutputPin')).concat(childArray(blockEl, 'Output'))) {
      // Bug 10: formalParameter first (real XEF), then Name (legacy)
      const pinName = attr(pinEl, 'formalParameter') || attr(pinEl, 'Name') || attr(pinEl, 'name') || `OUT${outputsByName.size}`;
      const negated = attr(pinEl, 'invertedPin') === 'true';
      const effectiveParameter = attr(pinEl, 'effectiveParameter') || undefined;
      const canonicalType = getPinDataType(typeName, pinName, 'output');
      const pin: any = { id: uid('pin'), name: pinName, dataType: canonicalType };
      if (negated) pin.negated = true;
      if (effectiveParameter) pin.value = effectiveParameter;
      outputsByName.set(pinName, pin);
    }

    const inputs = [...inputsByName.values()];
    const outputs = [...outputsByName.values()];
    if (inputs.length === 0) inputs.push({ id: uid('pin'), name: 'IN', dataType: 'BOOL' });
    if (outputs.length === 0) outputs.push({ id: uid('pin'), name: 'OUT', dataType: 'BOOL' });

    const node: any = {
      id: nodeId,
      type: mapSchneiderFBDType(typeName),
      instanceName,
      position: { x, y },
      inputs,
      outputs,
    };
    // Stash vendor-specific block attributes for round-trip
    node._xefBlock = {
      originalTypeName: typeName,
      additionnalPinNumber,
      enEnO,
      width: blockWidth,
      height: blockHeight,
      execAfter,
    };
    nodes.push(node);
  }

  // Parse standalone variable nodes (InVariable, OutVariable, InOutVariable)
  for (const varEl of childArray(bodyEl, 'InVariable').concat(childArray(bodyEl, 'inVariable'))) {
    const id = attr(varEl, 'Id') || String(idx++);
    const varName = attr(varEl, 'Expression') || attr(varEl, 'Variable') || attr(varEl, 'name') || '';
    const x = Number(attr(child(varEl, 'Position'), 'X')) || idx * 120;
    const y = Number(attr(child(varEl, 'Position'), 'Y')) || 0;
    const varType = resolver.resolve(varName);
    nodes.push({
      id: `xef-fbd-${id}`,
      type: 'IN_VARIABLE',
      tag: { name: varName, dataType: varType },
      position: { x, y },
      inputs: [],
      outputs: [{ id: uid('pin'), name: 'OUT', dataType: varType }],
    });
  }

  for (const varEl of childArray(bodyEl, 'OutVariable').concat(childArray(bodyEl, 'outVariable'))) {
    const id = attr(varEl, 'Id') || String(idx++);
    const varName = attr(varEl, 'Expression') || attr(varEl, 'Variable') || attr(varEl, 'name') || '';
    const x = Number(attr(child(varEl, 'Position'), 'X')) || idx * 120;
    const y = Number(attr(child(varEl, 'Position'), 'Y')) || 0;
    const varType = resolver.resolve(varName);
    nodes.push({
      id: `xef-fbd-${id}`,
      type: 'OUT_VARIABLE',
      tag: { name: varName, dataType: varType },
      position: { x, y },
      inputs: [{ id: uid('pin'), name: 'IN', dataType: varType }],
      outputs: [],
    });
  }

  for (const varEl of childArray(bodyEl, 'InOutVariable').concat(childArray(bodyEl, 'inOutVariable'))) {
    const id = attr(varEl, 'Id') || String(idx++);
    const varName = attr(varEl, 'Expression') || attr(varEl, 'Variable') || attr(varEl, 'name') || '';
    const x = Number(attr(child(varEl, 'Position'), 'X')) || idx * 120;
    const y = Number(attr(child(varEl, 'Position'), 'Y')) || 0;
    const varType = resolver.resolve(varName);
    nodes.push({
      id: `xef-fbd-${id}`,
      type: 'INOUT_VARIABLE' as FBDBlockType,
      tag: { name: varName, dataType: varType },
      position: { x, y },
      inputs: [{ id: uid('pin'), name: 'IN', dataType: varType }],
      outputs: [{ id: uid('pin'), name: 'OUT', dataType: varType }],
    });
  }

  // Parse jumpObject/labelObject as special nodes (XEF GOTO constructs)
  for (const jmpEl of childArray(bodyEl, 'jumpObject')) {
    const label = attr(jmpEl, 'label') || '';
    const posEl = child(jmpEl, 'objPosition');
    const x = Number(attr(posEl, 'posX')) || 0;
    const y = Number(attr(posEl, 'posY')) || 0;
    const nodeId = uid('xef-jump');
    nodes.push({ id: nodeId, type: 'MOVE' as FBDBlockType, instanceName: `>>>${label}`, position: { x, y }, inputs: [{ id: uid('pin'), name: 'IN', dataType: 'BOOL' }], outputs: [] });
    (nodes[nodes.length - 1] as any)._xefJump = { label };
  }
  for (const lblEl of childArray(bodyEl, 'labelObject')) {
    const label = attr(lblEl, 'label') || '';
    const posEl = child(lblEl, 'objPosition');
    const x = Number(attr(posEl, 'posX')) || 0;
    const y = Number(attr(posEl, 'posY')) || 0;
    const nodeId = uid('xef-label');
    nodes.push({ id: nodeId, type: 'MOVE' as FBDBlockType, instanceName: `<<<${label}`, position: { x, y }, inputs: [], outputs: [{ id: uid('pin'), name: 'OUT', dataType: 'BOOL' }] });
    (nodes[nodes.length - 1] as any)._xefLabel = { label };
  }

  // Bug 12: parse wire connections — linkFB (real XEF) first, then legacy Link/Connection
  for (const linkFBEl of childArray(bodyEl, 'linkFB')) {
    const src = child(linkFBEl, 'linkSource');
    const dst = child(linkFBEl, 'linkDestination');
    const fromInstanceName = attr(src, 'parentObjectName');
    const fromPin = attr(src, 'pinName') || 'OUT';
    const toInstanceName = attr(dst, 'parentObjectName');
    const toPin = attr(dst, 'pinName') || 'IN';
    if (fromInstanceName && toInstanceName) {
      const fromNodeId = instanceNameToNodeId.get(fromInstanceName) || `xef-fbd-${fromInstanceName}`;
      const toNodeId = instanceNameToNodeId.get(toInstanceName) || `xef-fbd-${toInstanceName}`;
      // Preserve wire routing positions for round-trip
      const srcPos = child(src, 'objPosition');
      const dstPos = child(dst, 'objPosition');
      const gridPositions: { posX: string; posY: string }[] = [];
      for (const gp of childArray(linkFBEl, 'gridObjPosition')) {
        const gpx = attr(gp, 'posX');
        const gpy = attr(gp, 'posY');
        if (gpx && gpy) gridPositions.push({ posX: gpx, posY: gpy });
      }
      const wire: any = {
        id: uid('wire'),
        from: { nodeId: fromNodeId, pin: fromPin },
        to: { nodeId: toNodeId, pin: toPin },
      };
      wire._xefRoute = {
        srcPos: srcPos ? { posX: attr(srcPos, 'posX'), posY: attr(srcPos, 'posY') } : undefined,
        dstPos: dstPos ? { posX: attr(dstPos, 'posX'), posY: attr(dstPos, 'posY') } : undefined,
        gridPositions: gridPositions.length > 0 ? gridPositions : undefined,
      };
      wires.push(wire);
    }
  }
  for (const linkEl of childArray(bodyEl, 'Link').concat(childArray(bodyEl, 'Connection'))) {
    const fromId = attr(linkEl, 'SourceId') || attr(linkEl, 'from');
    const toId = attr(linkEl, 'TargetId') || attr(linkEl, 'to');
    const fromPin = attr(linkEl, 'SourcePin') || attr(linkEl, 'FromPin') || 'OUT';
    const toPin = attr(linkEl, 'TargetPin') || attr(linkEl, 'ToPin') || 'IN';
    if (fromId && toId) {
      wires.push({
        id: uid('wire'),
        from: { nodeId: `xef-fbd-${fromId}`, pin: fromPin },
        to: { nodeId: `xef-fbd-${toId}`, pin: toPin },
      });
    }
  }

  return { nodes, wires };
}

function mapSchneiderFBDType(typeName: string): FBDBlockType {
  const map: Record<string, FBDBlockType> = {
    AND: 'AND', OR: 'OR', NOT: 'NOT', XOR: 'XOR', NAND: 'NAND', NOR: 'NOR',
    ADD: 'ADD', SUB: 'SUB', MUL: 'MUL', DIV: 'DIV', MOD: 'MOD',
    TON: 'TON', TOF: 'TOF', TP: 'TP', CTU: 'CTU', CTD: 'CTD', CTUD: 'CTUD',
    SR: 'SR', RS: 'RS', R_TRIG: 'RTRIG', F_TRIG: 'FTRIG',
    GT: 'GT', GE: 'GE', LT: 'LT', LE: 'LE', EQ: 'EQ', NE: 'NE',
    SEL: 'SEL', MUX: 'MUX', LIMIT: 'LIMIT', MOVE: 'MOVE', MOV: 'MOVE',
    ABS: 'ABS', SQRT: 'SQRT', MIN: 'MIN', MAX: 'MAX',
  };
  return map[typeName.toUpperCase()] || 'MOVE';
}

// ─── XEF SFC parser ───────────────────────────────────────────────────────────

function parseXEFSFC(bodyEl: unknown, pouName: string, unmapped: UnmappedElement[]): SFCProgram {
  const steps: SFCStep[] = [];
  const transitions: SFCTransition[] = [];
  const links: SFCLink[] = [];

  // Build lookup sets for step/transition IDs to fix link direction
  const stepIds = new Set<string>();
  const transitionIds = new Set<string>();

  for (const stepEl of childArray(bodyEl, 'Step')) {
    const id = attr(stepEl, 'Id') || attr(stepEl, 'Name');
    if (id) stepIds.add(id);
    const name = attr(stepEl, 'Name') || id;
    const isInitial = attr(stepEl, 'Initial') === 'true' || attr(stepEl, 'IsInitial') === 'true';

    // Parse step actions
    const actions: SFCAction[] = [];
    const validQualifiers: ActionQualifier[] = ['N', 'S', 'R', 'P', 'P1', 'P0', 'L', 'D', 'SD', 'DS', 'SL'];

    // Actions can be in <ActionBlock><Action> or directly as <Action> children
    const actionBlocks = childArray(stepEl, 'ActionBlock');
    const directActions = childArray(stepEl, 'Action');
    const allActionEls = actionBlocks.flatMap(ab => childArray(ab, 'Action')).concat(directActions);

    for (const actionEl of allActionEls) {
      const qualifier = (attr(actionEl, 'Qualifier') || attr(actionEl, 'qualifier') || 'N').toUpperCase() as ActionQualifier;
      const actionName = attr(actionEl, 'Name') || attr(actionEl, 'ActionName') || attr(actionEl, 'name') || '';
      const body = text(child(actionEl, 'Body') ?? child(actionEl, 'ST') ?? actionEl) || undefined;
      const duration = attr(actionEl, 'Duration') || attr(actionEl, 'duration') || undefined;

      if (actionName || body) {
        actions.push({
          id: uid(`action-${id}`),
          qualifier: validQualifiers.includes(qualifier) ? qualifier : 'N',
          tag: { name: actionName || `${name}_Action`, dataType: 'BOOL' },
          duration,
        });
      }
    }

    steps.push({
      id: `xef-step-${id}`,
      name: name || `Step_${id}`,
      isInitial,
      actions,
      position: {
        x: Number(attr(child(stepEl, 'Position'), 'X')) || 0,
        y: Number(attr(child(stepEl, 'Position'), 'Y')) || 0,
      },
    });
  }

  for (const transEl of childArray(bodyEl, 'Transition')) {
    const id = attr(transEl, 'Id') || attr(transEl, 'Name');
    if (id) transitionIds.add(id);
    const condition = text(child(transEl, 'Condition') ?? transEl) || 'TRUE';
    const priority = Number(attr(transEl, 'Priority')) || undefined;
    transitions.push({
      id: `xef-trans-${id}`,
      condition,
      priority,
      position: {
        x: Number(attr(child(transEl, 'Position'), 'X')) || 0,
        y: Number(attr(child(transEl, 'Position'), 'Y')) || 0,
      },
    });
  }

  // Build links with correct direction detection
  for (const linkEl of childArray(bodyEl, 'TransitionLink').concat(childArray(bodyEl, 'Link'))) {
    const from = attr(linkEl, 'SourceId') || attr(linkEl, 'from');
    const to = attr(linkEl, 'TargetId') || attr(linkEl, 'to');
    if (!from || !to) continue;

    // Determine correct prefix based on whether each ID is a step or transition
    const fromIsStep = stepIds.has(from);
    const fromIsTrans = transitionIds.has(from);
    const toIsStep = stepIds.has(to);
    const toIsTrans = transitionIds.has(to);

    let fromId: string;
    let toId: string;

    if (fromIsStep) fromId = `xef-step-${from}`;
    else if (fromIsTrans) fromId = `xef-trans-${from}`;
    else fromId = `xef-step-${from}`; // default assumption

    if (toIsStep) toId = `xef-step-${to}`;
    else if (toIsTrans) toId = `xef-trans-${to}`;
    else toId = `xef-trans-${to}`; // default assumption

    links.push({ id: uid(`link-${from}-${to}`), from: fromId, to: toId, type: 'simple' });
  }

  return { steps, transitions, links, branches: [] };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function exportSchneider(project: NormalizedProject): ExportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sidecar = project.sidecar;

  const globalVars = project.globalTags.map(tagToXEFVariable);
  const programs = project.pous.map(pou => pouToXEFProgram(pou, warnings));

  // Bug 16: export uses real XEF structure — FEFExchangeFile root, dataBlock for globals, <program> array
  const now = new Date();
  const dtStr = `date_and_time#${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}-${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
  const obj = {
    FEFExchangeFile: {
      fileHeader: {
        '@_company': 'Plaxio',
        '@_product': 'Plaxio PLC Editor',
        '@_dateTime': dtStr,
        '@_content': 'Project source file',
        '@_DTDVersion': '41',
      },
      contentHeader: {
        '@_name': project.projectName,
        '@_version': sidecar.vendorSpecificGlobals?.['version'] ?? '0.0.1',
        '@_dateTime': dtStr,
      },
      dataBlock: {
        variables: globalVars.length ? globalVars : undefined,
      },
      program: programs,
    },
  };

  return { ok: true, xmlContent: buildXML(obj), errors, warnings };
}

function tagToXEFVariable(tag: NormalizedTag): Record<string, unknown> {
  const meta = (tag as any)._xefMeta as { originalType?: string; attributes?: { name: string; value: string }[] } | undefined;
  const typeName = meta?.originalType || tag.dataType;
  const result: Record<string, unknown> = {
    '@_name': tag.name,
    '@_typeName': typeName,
  };
  if (tag.address) result['@_topologicalAddress'] = tag.address;
  if (tag.description) result['comment'] = tag.description;
  if (tag.initialValue) result['variableInit'] = { '@_value': tag.initialValue };
  // Emit attribute children for round-trip
  if (meta?.attributes && meta.attributes.length > 0) {
    result['attribute'] = meta.attributes.map(a => ({ '@_name': a.name, '@_value': a.value }));
  }
  return result;
}

function pouToXEFProgram(pou: NormalizedPOU, warnings: string[]): Record<string, unknown> {
  const localVars = pou.localTags.map(tagToXEFVariable);

  // Bug 16: local vars in publicLocalVariables
  const localVarsSection = localVars.length > 0
    ? { publicLocalVariables: { variables: localVars } }
    : {};

  let bodySection: Record<string, unknown> = {};

  if (pou.language === 'LD' && pou.ladderProgram) {
    // Bug 16: wrap LD body in LDSource
    const ldBody = {
      Rung: pou.ladderProgram.rungs.map((rung, ri) => {
        const rungObj: Record<string, unknown> = {
          '@_Number': String(ri + 1),
          Comment: rung.comment || undefined,
          ...buildXEFRungElements(rung.elements),
        };
        if (rung.branches && rung.branches.length > 0) {
          rungObj.Branch = rung.branches.map(branch => buildXEFRungElements(branch.elements));
        }
        return rungObj;
      }),
    };
    bodySection = { LDSource: ldBody };
  } else if (pou.language === 'FBD' && pou.fbdProgram) {
    // Bug 16: FBD body wrapped in FBDSource (networkFBD wrapped inside buildXEFFBDExport)
    bodySection = { FBDSource: buildXEFFBDExport(pou.fbdProgram) };
  } else if (pou.language === 'SFC' && pou.sfcProgram) {
    bodySection = { SFCSource: buildXEFSFCExport(pou.sfcProgram) };
  } else if (pou.language === 'ST' && pou.stSource) {
    bodySection = { STSource: { '#text': pou.stSource } };
  } else {
    warnings.push(`POU "${pou.name}": ${pou.language} export — empty body`);
  }

  // Bug 16: emit <program><identProgram name="..." type="section" task="MAST">
  const pouMeta = (pou as any)._xefMeta as { task?: string; sectionType?: string } | undefined;
  return {
    identProgram: {
      '@_name': pou.name,
      '@_type': pouMeta?.sectionType || 'section',
      '@_task': pouMeta?.task || 'MAST',
    },
    ...localVarsSection,
    ...bodySection,
  };
}

function buildXEFRungElements(elements: LadderElement[]): Record<string, unknown[]> {
  const contacts: unknown[] = [];
  const coils: unknown[] = [];
  const blocks: unknown[] = [];
  for (const el of elements) {
    if (el.kind === 'contact') {
      const c = el as ContactElement;
      const typeMap: Record<string, string> = { NO: '', NC: 'NC', P_CONTACT: 'P', N_CONTACT: 'N' };
      contacts.push({ '@_Variable': c.tag.name, '@_Type': typeMap[c.type] || '' });
    } else if (el.kind === 'coil') {
      const c = el as CoilElement;
      const typeMap: Record<string, string> = { normal: 'Normal', negated: 'Negated', set: 'Set', reset: 'Reset', latch: 'Latch', unlatch: 'Unlatch' };
      coils.push({ '@_Variable': c.tag.name, '@_Type': typeMap[c.type] || 'Normal' });
    } else if (el.kind === 'block') {
      const b = el as BlockElement;
      const inputPins = Object.entries(b.pins || {}).map(([name, ref]) => ({
        '@_Name': name,
        '@_Variable': (ref as any).name,
      }));
      blocks.push({
        '@_Type': b.fbType,
        '@_Instance': b.instanceName,
        ...(inputPins.length > 0 ? { InputPin: inputPins } : {}),
      });
    }
  }
  const result: Record<string, unknown[]> = {};
  if (contacts.length) result.Contact = contacts;
  if (coils.length) result.Coil = coils;
  if (blocks.length) result.FunctionBlock = blocks;
  return result;
}

function buildXEFFBDExport(fbd: FBDProgram): Record<string, unknown> {
  const grid = (fbd as any)._xefGrid as { nbRows?: string; nbColumns?: string } | undefined;

  // Emit jumpObject/labelObject
  const jumpObjects = fbd.nodes.filter(n => (n as any)._xefJump).map(n => ({
    '@_label': (n as any)._xefJump.label,
    objPosition: { '@_posX': String(n.position.x), '@_posY': String(n.position.y) },
  }));
  const labelObjects = fbd.nodes.filter(n => (n as any)._xefLabel).map(n => ({
    '@_label': (n as any)._xefLabel.label,
    objPosition: { '@_posX': String(n.position.x), '@_posY': String(n.position.y) },
  }));

  // Bug 14: emit FFBBlock with instanceName, typeName, objPosition, descriptionFFB
  const blocks = fbd.nodes
    .filter(n => n.type !== 'IN_VARIABLE' && n.type !== 'OUT_VARIABLE' && n.type !== 'INOUT_VARIABLE' && !(n as any)._xefJump && !(n as any)._xefLabel)
    .map(n => {
      const xb = (n as any)._xefBlock as { originalTypeName?: string; additionnalPinNumber?: string; enEnO?: string; width?: string; height?: string; execAfter?: string } | undefined;
      const inputVars = (n.inputs || []).map((p: any) => {
        const iv: Record<string, string> = { '@_formalParameter': p.name };
        iv['@_invertedPin'] = p.negated ? 'true' : 'false';
        if (p.value) iv['@_effectiveParameter'] = p.value;
        return iv;
      });
      const outputVars = (n.outputs || []).map((p: any) => {
        const ov: Record<string, string> = { '@_formalParameter': p.name };
        ov['@_invertedPin'] = p.negated ? 'true' : 'false';
        if (p.value) ov['@_effectiveParameter'] = p.value;
        return ov;
      });
      const blockObj: Record<string, unknown> = {
        '@_instanceName': n.instanceName || n.id,
        '@_typeName': xb?.originalTypeName || n.type,
      };
      if (xb?.additionnalPinNumber != null) blockObj['@_additionnalPinNumber'] = xb.additionnalPinNumber;
      if (xb?.enEnO != null) blockObj['@_enEnO'] = xb.enEnO;
      if (xb?.width != null) blockObj['@_width'] = xb.width;
      if (xb?.height != null) blockObj['@_height'] = xb.height;
      blockObj['objPosition'] = { '@_posX': String(n.position.x), '@_posY': String(n.position.y) };
      if (inputVars.length > 0 || outputVars.length > 0) {
        const descFFB: Record<string, unknown> = {};
        if (xb?.execAfter != null) descFFB['@_execAfter'] = xb.execAfter;
        if (inputVars.length > 0) descFFB['inputVariable'] = inputVars;
        if (outputVars.length > 0) descFFB['outputVariable'] = outputVars;
        blockObj['descriptionFFB'] = descFFB;
      }
      return blockObj;
    });

  const inVars = fbd.nodes.filter(n => n.type === 'IN_VARIABLE').map(n => ({
    '@_Id': n.id,
    '@_Expression': n.tag?.name || '',
    Position: { '@_X': String(n.position.x), '@_Y': String(n.position.y) },
  }));

  const outVars = fbd.nodes.filter(n => n.type === 'OUT_VARIABLE').map(n => ({
    '@_Id': n.id,
    '@_Expression': n.tag?.name || '',
    Position: { '@_X': String(n.position.x), '@_Y': String(n.position.y) },
  }));

  // Bug 15: emit linkFB with linkSource/linkDestination and routing
  const linkFBs = fbd.wires.map(w => {
    const route = (w as any)._xefRoute as { srcPos?: { posX: string; posY: string }; dstPos?: { posX: string; posY: string }; gridPositions?: { posX: string; posY: string }[] } | undefined;
    const linkObj: Record<string, unknown> = {
      linkSource: {
        '@_parentObjectName': w.from.nodeId,
        '@_pinName': w.from.pin,
        ...(route?.srcPos ? { objPosition: { '@_posX': route.srcPos.posX, '@_posY': route.srcPos.posY } } : {}),
      },
      linkDestination: {
        '@_parentObjectName': w.to.nodeId,
        '@_pinName': w.to.pin,
        ...(route?.dstPos ? { objPosition: { '@_posX': route.dstPos.posX, '@_posY': route.dstPos.posY } } : {}),
      },
    };
    if (route?.gridPositions) {
      linkObj['gridObjPosition'] = route.gridPositions.map(gp => ({ '@_posX': gp.posX, '@_posY': gp.posY }));
    }
    return linkObj;
  });

  // Wrap in networkFBD with optional grid dimensions
  const fbdSource: Record<string, unknown> = {};
  if (grid?.nbRows) fbdSource['@_nbRows'] = grid.nbRows;
  if (grid?.nbColumns) fbdSource['@_nbColumns'] = grid.nbColumns;
  fbdSource['networkFBD'] = {
    jumpObject: jumpObjects.length ? jumpObjects : undefined,
    labelObject: labelObjects.length ? labelObjects : undefined,
    FFBBlock: blocks.length ? blocks : undefined,
    InVariable: inVars.length ? inVars : undefined,
    OutVariable: outVars.length ? outVars : undefined,
    linkFB: linkFBs.length ? linkFBs : undefined,
  };
  return fbdSource;
}

function buildXEFSFCExport(sfc: SFCProgram): Record<string, unknown> {
  const steps = sfc.steps.map(s => ({
    '@_Id': s.id.replace('xef-step-', ''),
    '@_Name': s.name,
    '@_Initial': String(s.isInitial),
    Position: { '@_X': String(s.position.x), '@_Y': String(s.position.y) },
    ...(s.actions.length > 0 ? {
      ActionBlock: {
        Action: s.actions.map(a => ({
          '@_Qualifier': a.qualifier,
          '@_Name': a.tag.name,
          '@_Duration': a.duration || undefined,
        })),
      },
    } : {}),
  }));

  const transitions = sfc.transitions.map(t => ({
    '@_Id': t.id.replace('xef-trans-', ''),
    '@_Name': t.id,
    Condition: t.condition,
    Position: { '@_X': String(t.position.x), '@_Y': String(t.position.y) },
  }));

  const links = sfc.links.map(l => ({
    '@_SourceId': l.from.replace(/^xef-(step|trans)-/, ''),
    '@_TargetId': l.to.replace(/^xef-(step|trans)-/, ''),
  }));

  return {
    Step: steps.length ? steps : undefined,
    Transition: transitions.length ? transitions : undefined,
    TransitionLink: links.length ? links : undefined,
  };
}
