/*
 * Siemens SimaticML Adapter (TIA Portal export via TIA Openness)
 * Parses SW.Blocks.CompileUnit / SW.CodeBlock XML exported by TIA Portal.
 *
 * Fixes applied:
 * - LAD wires used to determine connectivity and parallel branches
 * - Set/Reset coils properly detected (<SetCoil>/<ResetCoil>)
 * - SCL source text properly extracted
 * - GRAPH (SFC) language handled
 * - Cross-DB references (dot-path) resolved correctly
 * - Instance DBs (SW.Blocks.DB / SW.Blocks.InstanceDB) imported
 * - Interface section type preserved on tags for correct re-export
 */

import { parseXML, buildXML, attr, text, child, childArray } from '../xmlUtils.js';
import { siemensTypeToIEC, iecTypeToSimatic } from '../dataTypeMap.js';
import { buildResolver, VariableTypeResolver } from '../variableTypeResolver.js';
import { getPinDataType, buildTypedPins } from '../pinSignatures.js';
import type {
  ImportResult, ExportResult, NormalizedProject, NormalizedPOU, NormalizedTag,
  VendorMetadataSidecar, UnmappedElement,
} from '../types.js';
import type {
  LadderProgram, FBDProgram, SFCProgram, Rung, LadderElement, Branch,
  ContactElement, CoilElement, BlockElement, ContactType, CoilType, FBType,
  FBDNode, FBDWire, Pin, FBDBlockType,
  SFCStep, SFCTransition, SFCLink, SFCAction, ActionQualifier, SFCJump, SFCBranch,
} from '../../logicStore.js';

let _uid = 0;
function genId(prefix: string): string { return `${prefix}-${++_uid}-${Math.random().toString(36).slice(2, 8)}`; }

function unescapeXML(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

// TIA Portal uses nested MultilingualText structure for comments/titles.
// Extract the English text (or first available text) from the nested structure.
function extractMultilingualText(el: unknown): string {
  if (!el) return '';
  // Try plain text first (Plaxio round-trip format and some TIA versions)
  const plain = text(el);
  if (plain && plain.trim()) return plain.trim();
  // TIA Portal nested: Comment/MultilingualText/ObjectList/MultilingualTextItem/AttributeList/Text
  for (const mlEl of childArray(el, 'MultilingualText')) {
    for (const itemEl of childArray(child(mlEl, 'ObjectList'), 'MultilingualTextItem')) {
      const culture = text(child(child(itemEl, 'AttributeList'), 'Culture')) || '';
      const t = text(child(child(itemEl, 'AttributeList'), 'Text')) || '';
      if (t && (culture.startsWith('en') || !culture)) return t;
    }
    // If no en- culture found, return first available
    for (const itemEl of childArray(child(mlEl, 'ObjectList'), 'MultilingualTextItem')) {
      const t = text(child(child(itemEl, 'AttributeList'), 'Text')) || '';
      if (t) return t;
    }
  }
  return '';
}

// Extended NormalizedTag with section info for lossless re-export
interface SiemensTag extends NormalizedTag {
  section?: 'Input' | 'Output' | 'InOut' | 'Static' | 'Temp' | 'Constant' | 'Return';
}

// ─── Import ───────────────────────────────────────────────────────────────────

export function importSiemens(xmlContent: string, filePath: string): ImportResult {
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

  const document = child(root, 'Document') as Record<string, unknown> | undefined;
  if (!document) {
    return { ok: false, errors: ['No <Document> root found in SimaticML file'], warnings: [] };
  }

  const docInfo = child(document, 'DocumentInfo') as Record<string, unknown> | undefined;
  const projectName = text(child(docInfo, 'ProjectName')) || 'Siemens Import';
  // TIA version: prefer DocumentInfo.TiaVersion, fall back to Engineering[version] attribute
  const version = text(child(docInfo, 'TiaVersion'))
    || attr(child(document, 'Engineering'), 'version')
    || '1.0';

  const pous: NormalizedPOU[] = [];
  const globalTags: NormalizedTag[] = [];

  const swBlocks = child(document, 'SW.Blocks') ?? document;

  // Parse compile units
  for (const blockEl of childArray(swBlocks, 'SW.Blocks.CompileUnit').concat(childArray(swBlocks, 'SW.CodeBlock'))) {
    const pou = parseCompileUnit(blockEl, unmapped, warnings);
    if (pou) pous.push(pou);
  }

  // Top-level blocks (OB, FB, FC)
  for (const key of ['SW.Blocks.OB', 'SW.Blocks.FB', 'SW.Blocks.FC']) {
    for (const blockEl of childArray(swBlocks, key)) {
      const pou = parseTopLevelBlock(blockEl, key, unmapped, warnings);
      if (pou) pous.push(pou);
    }
  }

  // Global DB tags
  for (const dbEl of childArray(swBlocks, 'SW.Blocks.GlobalDB')) {
    const dbName = text(child(child(dbEl, 'AttributeList'), 'Name')) || 'GlobalDB';
    const interfaceEl = child(child(dbEl, 'AttributeList'), 'Interface');
    if (interfaceEl) {
      const sectionTags = parseSiemensInterface(interfaceEl, unmapped);
      globalTags.push(...sectionTags.map(t => ({ ...t, address: `${dbName}.${t.name}` })));
    }
  }

  // Instance DBs
  for (const dbEl of childArray(swBlocks, 'SW.Blocks.DB').concat(childArray(swBlocks, 'SW.Blocks.InstanceDB'))) {
    const dbName = text(child(child(dbEl, 'AttributeList'), 'Name')) || 'DB';
    const interfaceEl = child(child(dbEl, 'AttributeList'), 'Interface');
    if (interfaceEl) {
      const sectionTags = parseSiemensInterface(interfaceEl, unmapped);
      globalTags.push(...sectionTags.map(t => ({ ...t, address: `${dbName}.${t.name}` })));
    }
  }

  if (pous.length === 0) {
    errors.push('No program blocks (OB/FB/FC) found');
    return { ok: false, errors, warnings };
  }

  const sidecar: VendorMetadataSidecar = {
    sourceVendor: 'siemens_simatic_ml',
    sourceFileVersion: version,
    originalFilePath: filePath,
    unmappedElements: unmapped,
    organizerTreeLayout: document,
    vendorSpecificGlobals: { tiaVersion: version, projectName },
  };

  return { ok: true, project: { projectName, pous, globalTags, sidecar }, errors, warnings };
}

function parseTopLevelBlock(
  blockEl: unknown,
  blockType: string,
  unmapped: UnmappedElement[],
  warnings: string[]
): NormalizedPOU | null {
  if (!blockEl || typeof blockEl !== 'object') return null;
  const attrList = child(blockEl, 'AttributeList') as Record<string, unknown> | undefined;
  const blockName = text(child(attrList, 'Name')) || 'Block';
  const language = (text(child(attrList, 'ProgrammingLanguage')) || 'LAD').toUpperCase();

  const localTags: SiemensTag[] = [];
  const interfaceEl = child(attrList, 'Interface');
  if (interfaceEl) {
    localTags.push(...parseSiemensInterface(interfaceEl, unmapped));
  }

  const networks: unknown[] = [];
  for (const netEl of childArray(child(blockEl, 'ObjectList'), 'SW.Blocks.CompileUnit')) {
    networks.push(netEl);
  }

  const pouType = blockType.includes('FB') ? 'functionBlock' as const
    : blockType.includes('FC') ? 'function' as const
    : 'program' as const;

  const resolver = buildResolver(localTags as NormalizedTag[], []);

  if (language === 'LAD' || language === 'LD') {
    const ladder = parseNetworksToLD(networks, blockName, unmapped, warnings, resolver);
    return { id: `pou-${blockName}`, name: blockName, language: 'LD', ladderProgram: ladder, localTags, pouType };
  }
  if (language === 'FBD') {
    const fbd = parseNetworksToFBD(networks, blockName, unmapped, warnings, resolver);
    return { id: `pou-${blockName}`, name: blockName, language: 'FBD', fbdProgram: fbd, localTags, pouType };
  }
  if (language === 'SCL' || language === 'STL') {
    const scl = extractSCLSource(blockEl, attrList);
    return { id: `pou-${blockName}`, name: blockName, language: 'ST', stSource: scl, localTags, pouType };
  }
  if (language === 'GRAPH') {
    const sfc = parseNetworksToSFC(networks, blockName, unmapped, warnings);
    return { id: `pou-${blockName}`, name: blockName, language: 'SFC', sfcProgram: sfc, localTags, pouType };
  }

  unmapped.push({ clmNodeId: null, vendorSpecificData: blockEl, reason: `Block "${blockName}": unsupported language ${language}` });
  return null;
}

function extractSCLSource(blockEl: unknown, attrList: unknown): string {
  // Try multiple locations where SCL source is stored in TIA exports
  const sclSource = text(child(attrList, 'SCLSourceInformation'));
  if (sclSource && sclSource.trim() !== '(* SCL *)') return unescapeXML(sclSource);

  // Try StructuredText element inside compile units
  const objectList = child(blockEl, 'ObjectList');
  for (const cu of childArray(objectList, 'SW.Blocks.CompileUnit')) {
    const cuAttr = child(cu, 'AttributeList');
    const src = text(child(cuAttr, 'NetworkSource'));
    if (src && src.trim()) return unescapeXML(src);
    const stEl = child(cuAttr, 'StructuredText');
    if (stEl) {
      const stText = text(stEl);
      if (stText && stText.trim()) return unescapeXML(stText);
      // TIA V17+: SCL encoded as Token/Blank children instead of text node
      const tokens = childArray(stEl, 'Token').concat(childArray(stEl, 'Blank'));
      if (tokens.length > 0) {
        const reconstructed = tokens.map(t => attr(t, 'Text') ?? ' ').join('');
        if (reconstructed.trim()) return unescapeXML(reconstructed);
      }
    }
  }

  // Try ExternalSource
  for (const ext of childArray(objectList, 'SW.ExternalSource')) {
    const src = text(ext);
    if (src && src.trim()) return unescapeXML(src);
  }

  return '(* SCL source not found in export *)';
}

function parseCompileUnit(
  cuEl: unknown,
  unmapped: UnmappedElement[],
  warnings: string[]
): NormalizedPOU | null {
  if (!cuEl || typeof cuEl !== 'object') return null;
  const attrList = child(cuEl, 'AttributeList') as Record<string, unknown> | undefined;
  const id = attr(cuEl, 'ID') || attr(attrList, 'ID') || 'cu';
  const language = (text(child(attrList, 'ProgrammingLanguage')) || 'LAD').toUpperCase();
  const title = text(child(child(cuEl, 'ObjectList'), 'MultilingualText')) || `Network_${id}`;

  const networks = [cuEl];

  if (language === 'LAD' || language === 'LD') {
    const ladder = parseNetworksToLD(networks, id, unmapped, warnings);
    return { id: `pou-${id}`, name: title, language: 'LD', ladderProgram: ladder, localTags: [] };
  }
  if (language === 'FBD') {
    const fbd = parseNetworksToFBD(networks, id, unmapped, warnings);
    return { id: `pou-${id}`, name: title, language: 'FBD', fbdProgram: fbd, localTags: [] };
  }
  if (language === 'GRAPH') {
    const sfc = parseNetworksToSFC(networks, id, unmapped, warnings);
    return { id: `pou-${id}`, name: title, language: 'SFC', sfcProgram: sfc, localTags: [] };
  }

  unmapped.push({ clmNodeId: null, vendorSpecificData: cuEl, reason: `CompileUnit "${title}": unsupported language ${language}` });
  return null;
}

// ─── Siemens Interface parser (with section preservation) ────────────────────

function parseSiemensInterface(interfaceEl: unknown, unmapped: UnmappedElement[]): SiemensTag[] {
  const tags: SiemensTag[] = [];
  const sections = child(interfaceEl, 'Sections') ?? interfaceEl;

  function parseSectionsRecursive(sectionsEl: unknown): void {
    for (const section of childArray(sectionsEl, 'Section')) {
      const rawSectionName = attr(section, 'Name');
      const sectionName = rawSectionName as SiemensTag['section'] || 'Static';
      // GRAPH "Base" section contains nested Sections — recurse
      if (rawSectionName === 'Base' || rawSectionName === 'None') {
        const nestedSections = child(section, 'Sections');
        if (nestedSections) {
          parseSectionsRecursive(nestedSections);
          continue;
        }
      }
      for (const memberEl of childArray(section, 'Member')) {
        const name = attr(memberEl, 'Name');
        const typeStr = attr(memberEl, 'Datatype');
        if (!name) continue;
        const dataType = siemensTypeToIEC(typeStr);
        const startValue = text(child(memberEl, 'StartValue'));
        // Comment may be a direct text node or wrapped in MultiLanguageText children
        const commentEl = child(memberEl, 'Comment');
        const comment = text(child(commentEl, 'MultiLanguageText')) || text(commentEl) || '';
        tags.push({
          name,
          dataType,
          initialValue: startValue || undefined,
          description: comment || undefined,
          section: sectionName,
        });
      }
    }
  }

  parseSectionsRecursive(sections);
  return tags;
}

// ─── LAD network → Ladder rung (with wire-based ordering + branches) ─────────

interface WireConnection {
  fromUId: string;
  fromPin: string;
  toUId: string;
  toPin: string;
}

function parseNetworksToLD(
  networks: unknown[],
  pouId: string,
  unmapped: UnmappedElement[],
  warnings: string[],
  resolver: VariableTypeResolver = new VariableTypeResolver()
): LadderProgram {
  const rungs: Rung[] = [];
  let rungIdx = 0;

  for (const netEl of networks) {
    rungIdx++;
    const attrList = child(netEl, 'AttributeList');
    // Fix 10: network comment may live in ObjectList/MultilingualText as well as AttributeList
    const objectListEl = child(netEl, 'ObjectList');
    const commentMlt = childArray(objectListEl, 'MultilingualText').find(m => attr(m, 'CompositionName') === 'Comment');
    const titleMlt = childArray(objectListEl, 'MultilingualText').find(m => attr(m, 'CompositionName') === 'Title');
    const commentEl = child(attrList, 'Comment') ?? child(attrList, 'Title');
    const comment = extractMultilingualText(commentMlt) || extractMultilingualText(titleMlt) || extractMultilingualText(commentEl) || '';

    const partsEl = child(attrList, 'NetworkSource');
    const flgNet = child(partsEl, 'FlgNet') ?? partsEl;
    const partsNode = child(flgNet, 'Parts') ?? flgNet;
    const wiresNode = child(flgNet, 'Wires');

    // Build element map by UId
    const uidToElement = new Map<string, LadderElement>();
    let posX = 0;

    // Build wire map first so we can resolve operands for Part-based contacts/coils
    // UId → Access element for variable resolution
    const uidToAccess = new Map<string, unknown>();
    const rawWires: unknown[] = wiresNode ? childArray(wiresNode, 'Wire') : [];
    for (const wireEl of rawWires) {
      const identCons = childArray(wireEl, 'IdentCon');
      for (const ic of identCons) {
        const uid = attr(ic, 'UId');
        if (uid) {
          // Find the Access element with this UId in partsNode
          for (const accEl of childArray(partsNode, 'Access')) {
            if (attr(accEl, 'UId') === uid) { uidToAccess.set(uid, accEl); break; }
          }
        }
      }
    }

    // Helper: resolve tag name for a Part element via its wire-connected Access
    function resolvePartTag(partUId: string): string {
      // First try inline Access child (element-based format)
      const directAccess = childArray(partsNode, 'Access').find(a => {
        // Access elements with same UId as part — unlikely but check
        return false; // Parts and Access have different UIds
      });
      // Wire-based: find wire with NameCon UId=partUId Name="operand" → IdentCon → Access
      for (const wireEl of rawWires) {
        const nameCons = childArray(wireEl, 'NameCon');
        const identCons = childArray(wireEl, 'IdentCon');
        for (const nc of nameCons) {
          if (attr(nc, 'UId') === partUId && attr(nc, 'Name') === 'operand') {
            // The connected IdentCon has the Access UId
            for (const ic of identCons) {
              const accessUId = attr(ic, 'UId');
              const accEl = uidToAccess.get(accessUId);
              if (accEl) return parseAccessTag(accEl);
            }
          }
        }
      }
      return 'UNKNOWN_TAG';
    }

    // Helper: check if Part element is negated
    function isPartNegated(partEl: unknown): boolean {
      return childArray(partEl, 'Negated').length > 0
        || attr(partEl, 'Negated') === 'true'
        || childArray(partEl, 'NegatedResult').length > 0;
    }

    // Track which UIds are left power rail origins (Powerrail elements)
    const powerrailUIds = new Set<string>();

    // Parse all elements — handle both element-name form (Contact, Coil) and
    // attribute-name form (Part Name="Contact") used in newer TIA Portal exports
    const allPartEls = [
      ...childArray(partsNode, 'Contact'),
      ...childArray(partsNode, 'Coil'),
      ...childArray(partsNode, 'SetCoil'),
      ...childArray(partsNode, 'ResetCoil'),
      ...childArray(partsNode, 'Part'),  // TIA V16+ uses Part Name="Contact" etc.
      ...childArray(partsNode, 'Call'),
      ...childArray(partsNode, 'Powerrail'),
      ...childArray(partsNode, 'OpenCon'),
    ];

    for (const partEl of allPartEls) {
      const partUId = attr(partEl, 'UId');
      if (!partUId) continue;

      // Determine element semantic type
      const elemTagName = (partEl as any)['#name'] || '';
      const partName = attr(partEl, 'Name') || elemTagName;
      const upperName = partName.toUpperCase();

      // Powerrail = left power rail; mark as synthetic root
      if (upperName === 'POWERRAIL' || elemTagName === 'Powerrail') {
        powerrailUIds.add(partUId);
        continue;
      }
      if (upperName === 'OPENCON' || elemTagName === 'OpenCon') continue;

      // SCoil (Set Coil) — TIA V16+ uses Part Name="SCoil"
      if (upperName === 'SCOIL') {
        const directAcc = childArray(partEl, 'Access')[0];
        const tagName = directAcc ? parseAccessTag(directAcc) : resolvePartTag(partUId);
        uidToElement.set(partUId, { kind: 'coil', id: `siemens-${partUId}`, type: 'set', tag: { name: tagName, dataType: resolver.resolve(tagName) }, position: { x: posX, y: 0 } } as CoilElement);
        posX += 60; continue;
      }

      // RCoil (Reset Coil) — TIA V16+ uses Part Name="RCoil"
      if (upperName === 'RCOIL') {
        const directAcc = childArray(partEl, 'Access')[0];
        const tagName = directAcc ? parseAccessTag(directAcc) : resolvePartTag(partUId);
        uidToElement.set(partUId, { kind: 'coil', id: `siemens-${partUId}`, type: 'reset', tag: { name: tagName, dataType: resolver.resolve(tagName) }, position: { x: posX, y: 0 } } as CoilElement);
        posX += 60; continue;
      }

      // Contact-type elements
      if (upperName === 'CONTACT' || elemTagName === 'Contact') {
        const negated = isPartNegated(partEl);
        const directAcc = childArray(partEl, 'Access')[0];
        const tagName = directAcc ? parseAccessTag(directAcc) : resolvePartTag(partUId);
        const el: ContactElement = {
          kind: 'contact',
          id: `siemens-${partUId}`,
          type: negated ? 'NC' : 'NO',
          tag: { name: tagName, dataType: resolver.resolve(tagName) },
          position: { x: posX, y: 0 },
        };
        uidToElement.set(partUId, el);
        posX += 60;
        continue;
      }

      // P_CONTACT / N_CONTACT (edge detection contacts)
      if (upperName === 'P_CONTACT' || upperName === 'PCONTACT') {
        const tagName = resolvePartTag(partUId);
        uidToElement.set(partUId, { kind: 'contact', id: `siemens-${partUId}`, type: 'P_CONTACT', tag: { name: tagName, dataType: resolver.resolve(tagName) }, position: { x: posX, y: 0 } } as ContactElement);
        posX += 60; continue;
      }
      if (upperName === 'N_CONTACT' || upperName === 'NCONTACT') {
        const tagName = resolvePartTag(partUId);
        uidToElement.set(partUId, { kind: 'contact', id: `siemens-${partUId}`, type: 'N_CONTACT', tag: { name: tagName, dataType: resolver.resolve(tagName) }, position: { x: posX, y: 0 } } as ContactElement);
        posX += 60; continue;
      }

      // Coil-type elements
      if (upperName === 'COIL' || elemTagName === 'Coil') {
        const negated = isPartNegated(partEl);
        const directAcc = childArray(partEl, 'Access')[0];
        const tagName = directAcc ? parseAccessTag(directAcc) : resolvePartTag(partUId);
        uidToElement.set(partUId, { kind: 'coil', id: `siemens-${partUId}`, type: negated ? 'negated' : 'normal', tag: { name: tagName, dataType: resolver.resolve(tagName) }, position: { x: posX, y: 0 } } as CoilElement);
        posX += 60; continue;
      }

      if (upperName === 'SETCOIL' || elemTagName === 'SetCoil') {
        const directAcc = childArray(partEl, 'Access')[0];
        const tagName = directAcc ? parseAccessTag(directAcc) : resolvePartTag(partUId);
        uidToElement.set(partUId, { kind: 'coil', id: `siemens-${partUId}`, type: 'set', tag: { name: tagName, dataType: resolver.resolve(tagName) }, position: { x: posX, y: 0 } } as CoilElement);
        posX += 60; continue;
      }

      if (upperName === 'RESETCOIL' || elemTagName === 'ResetCoil') {
        const directAcc = childArray(partEl, 'Access')[0];
        const tagName = directAcc ? parseAccessTag(directAcc) : resolvePartTag(partUId);
        uidToElement.set(partUId, { kind: 'coil', id: `siemens-${partUId}`, type: 'reset', tag: { name: tagName, dataType: resolver.resolve(tagName) }, position: { x: posX, y: 0 } } as CoilElement);
        posX += 60; continue;
      }

      // Call / IEC function blocks
      if (elemTagName === 'Call' || upperName === 'CALL') {
        const callInfo = child(partEl, 'CallInfo');
        const blockName = attr(callInfo, 'Name') || '';
        const blockType = attr(callInfo, 'BlockType') || ''; // FB, FC, etc.
        const meta = mapSiemensFBTypeWithMeta(blockName);
        // For FB/FC calls that don't map to IEC standard blocks, treat as generic MOVE placeholder
        const fbType = meta ? meta.fbType : 'MOVE' as FBType;
        const storeOriginal = meta ? meta.storeOriginal : true;
        // Instance can be either Name attribute or Component child
        const instanceEl = child(callInfo, 'Instance');
        const instanceComponent = child(instanceEl, 'Component');
        const instanceName = attr(instanceComponent, 'Name') || attr(instanceEl, 'Name') || blockName;
        const blk: BlockElement = { kind: 'block', id: `siemens-${partUId}`, fbType, instanceName, pins: {}, position: { x: posX, y: 0 } };
        if (storeOriginal) blk.vendorOriginalName = blockName;
        // Store BlockType and Parameter info for round-trip
        (blk as any).vendorBlockType = blockType;
        // Extract parameter declarations for pin mapping (store as TagRef for type compat)
        const params = childArray(callInfo, 'Parameter');
        for (const param of params) {
          const pName = attr(param, 'Name') || '';
          const pSection = attr(param, 'Section') || '';
          const pType = attr(param, 'Type') || 'Bool';
          if (pName) {
            blk.pins[pName] = { name: pName, dataType: siemensTypeToIEC(pType) };
          }
        }
        uidToElement.set(partUId, blk);
        posX += 60; continue;
      }

      // Part Name="TON" etc — IEC FB as Part element (TIA V16+)
      if (elemTagName === 'Part') {
        const meta = mapSiemensFBTypeWithMeta(partName);
        if (meta) {
          const instanceName = resolvePartTag(partUId) || partName;
          const blk: BlockElement = { kind: 'block', id: `siemens-${partUId}`, fbType: meta.fbType, instanceName, pins: {}, position: { x: posX, y: 0 } };
          if (meta.storeOriginal) blk.vendorOriginalName = partName;
          uidToElement.set(partUId, blk);
          posX += 60; continue;
        }
        // Unknown Part — skip silently (Access/variable nodes, etc.)
      }
    }

    // Parse wires to determine ordering and parallel branches
    const wireConns: WireConnection[] = [];
    if (wiresNode) {
      for (const wireEl of rawWires) {
        const nameCons = childArray(wireEl, 'NameCon');
        const identCons = childArray(wireEl, 'IdentCon');
        // Powerrail element in wire acts as left-rail source
        const hasPowerrail = childArray(wireEl, 'Powerrail').length > 0;
        const allCons = [...nameCons, ...identCons];
        if (hasPowerrail && allCons.length >= 1) {
          // Treat powerrail as synthetic source uid 'powerrail'
          wireConns.push({ fromUId: 'powerrail', fromPin: 'out', toUId: attr(allCons[0], 'UId') || '', toPin: attr(allCons[0], 'Name') || 'in' });
          for (let wi = 1; wi < allCons.length; wi++) {
            wireConns.push({ fromUId: 'powerrail', fromPin: 'out', toUId: attr(allCons[wi], 'UId') || '', toPin: 'in' });
          }
          continue;
        }

        if (allCons.length >= 2) {
          const fromEl = allCons[0];
          const toEl = allCons[1];
          wireConns.push({
            fromUId: attr(fromEl, 'UId') || '',
            fromPin: attr(fromEl, 'Name') || 'out',
            toUId: attr(toEl, 'UId') || '',
            toPin: attr(toEl, 'Name') || 'in',
          });
          // If there are more than 2 connections on a wire, it's a branch point
          for (let wi = 2; wi < allCons.length; wi++) {
            wireConns.push({
              fromUId: attr(fromEl, 'UId') || '',
              fromPin: attr(fromEl, 'Name') || 'out',
              toUId: attr(allCons[wi], 'UId') || '',
              toPin: attr(allCons[wi], 'Name') || 'in',
            });
          }
        }
      }
    }

    // Use wires to order elements: BFS from powerrail (or elements with no incoming)
    // Elements connected from powerrail are explicit roots even if they appear in hasIncoming
    const powerrailTargets = new Set(wireConns.filter(w => w.fromUId === 'powerrail').map(w => w.toUId));
    const hasIncoming = new Set(wireConns.filter(w => w.fromUId !== 'powerrail').map(w => w.toUId));
    const roots = [...uidToElement.keys()].filter(uid => !hasIncoming.has(uid) || powerrailTargets.has(uid));
    const outEdges = new Map<string, string[]>();
    for (const w of wireConns) {
      if (!outEdges.has(w.fromUId)) outEdges.set(w.fromUId, []);
      outEdges.get(w.fromUId)!.push(w.toUId);
    }

    // Detect branches: if a single source has multiple outgoing connections, those form parallel paths
    const branches: Branch[] = [];
    const mainElements: LadderElement[] = [];
    const visited = new Set<string>();

    function walkChain(startUId: string): LadderElement[] {
      const chain: LadderElement[] = [];
      let current = startUId;
      while (current && !visited.has(current)) {
        visited.add(current);
        const el = uidToElement.get(current);
        if (el) chain.push(el);
        const nexts = outEdges.get(current) || [];
        if (nexts.length === 1) {
          current = nexts[0];
        } else if (nexts.length > 1) {
          // Branch point — create branches for each path
          for (const nextUId of nexts) {
            if (!visited.has(nextUId)) {
              const branchElements = walkChain(nextUId);
              if (branchElements.length > 0) {
                branches.push({
                  id: genId(`branch-${pouId}-r${rungIdx}`),
                  startNodeId: current,
                  endNodeId: branchElements[branchElements.length - 1]?.id || current,
                  elements: branchElements,
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
    }

    if (roots.length > 0) {
      for (const rootUId of roots) {
        if (!visited.has(rootUId)) {
          mainElements.push(...walkChain(rootUId));
        }
      }
    } else {
      // No clear root — use all elements in map order
      mainElements.push(...uidToElement.values());
    }

    // Add any remaining unvisited elements
    for (const [uid, el] of uidToElement) {
      if (!visited.has(uid)) mainElements.push(el);
    }

    rungs.push({
      id: `${pouId}-rung-${rungIdx}`,
      number: rungIdx,
      comment,
      elements: mainElements,
      branches,
    });
  }

  return { rungs };
}

function parseAccessTag(accessEl: unknown): string {
  if (!accessEl || typeof accessEl !== 'object') return 'UNKNOWN_TAG';
  const symbolEl = child(accessEl, 'Symbol');
  if (symbolEl) {
    const components = childArray(symbolEl, 'Component');
    if (components.length > 0) {
      return components.map(c => attr(c, 'Name')).filter(Boolean).join('.');
    }
    const name = attr(symbolEl, 'Name');
    if (name) return name;
  }
  // Fallback to Name attribute on Access element itself
  return attr(accessEl, 'Name') || 'TAG';
}

// ─── Siemens → CLM FB type maps ───────────────────────────────────────────────
//
// SIEMENS_FB_MAP: used for LAD blocks (returns FBType, used in BlockElement.fbType)
// SIEMENS_FBD_MAP: used for FBD blocks (returns FBDBlockType, used in FBDNode.type)
//
// Strategy:
//   - Direct IEC equivalents → map to the IEC canonical name
//   - Siemens-specific types now in the extended FBType/FBDBlockType union → map directly
//   - Types with no CLM representation → map to closest semantic equivalent
//     AND set vendorOriginalName so the export can reconstruct the original name
//
// All lookups are case-insensitive (caller does .toUpperCase()).

const SIEMENS_FB_MAP: Record<string, FBType> = {

  // ── Standard IEC timers ────────────────────────────────────────────────
  TON: 'TON', TOF: 'TOF', TP: 'TP',
  // Retentive timer (Siemens extension, now first-class)
  TONR: 'TONR',
  // Generic IEC timer instance names TIA Portal uses
  IEC_TIMER: 'IEC_TIMER', IEC_LTIMER: 'IEC_LTIMER',
  // TIA Portal V17+ name aliases
  'SFB3': 'TON', 'SFB4': 'TOF', 'SFB5': 'TP',

  // ── Standard IEC counters ──────────────────────────────────────────────
  CTU: 'CTU', CTD: 'CTD', CTUD: 'CTUD',
  IEC_COUNTER: 'IEC_COUNTER', IEC_LCOUNTER: 'IEC_LCOUNTER',
  // IEC timer contact (timer output contact used in TIA Portal GRAPH)
  IEC_TC: 'IEC_TC',

  // ── Bistable latches / edge detection ─────────────────────────────────
  SR: 'SR', RS: 'RS',
  R_TRIG: 'RTRIG', F_TRIG: 'FTRIG',
  RTRIG: 'RTRIG', FTRIG: 'FTRIG',

  // ── Boolean gate FBs (used in FBD-style LAD on S7-300/400) ────────────
  AND: 'AND', OR: 'OR', NOT: 'NOT', XOR: 'XOR',

  // ── Arithmetic ─────────────────────────────────────────────────────────
  ADD: 'ADD', SUB: 'SUB', MUL: 'MUL', DIV: 'DIV', MOD: 'MOD',
  ABS: 'ABS', SQRT: 'SQRT', NEG: 'NEG',
  LN: 'LN', LOG: 'LOG', EXP: 'EXP',
  SIN: 'SIN', COS: 'COS', TAN: 'TAN',
  ASIN: 'ASIN', ACOS: 'ACOS', ATAN: 'ATAN',
  ATN: 'ATAN', ASN: 'ASIN', ACS: 'ACOS',  // alternate spellings

  // ── Comparison ─────────────────────────────────────────────────────────
  GT: 'GT', GE: 'GE', LT: 'LT', LE: 'LE', EQ: 'EQ', NE: 'NE',
  CMP: 'EQ',  // generic compare → EQ

  // ── Data / selection ───────────────────────────────────────────────────
  MOVE: 'MOVE', SEL: 'SEL', MUX: 'SEL', LIMIT: 'LIMIT',
  MIN: 'MIN', MAX: 'MAX',

  // ── Blink / oscillator ─────────────────────────────────────────────────
  BLINK: 'BLINK',

  // ── Analog scaling / normalisation (Siemens-specific, now first-class) ─
  SCALE: 'SCALE', UNSCALE: 'UNSCALE',
  NORM_X: 'NORM_X', SCALE_X: 'SCALE_X',
  // Older S7 SFB names
  FC105: 'SCALE', FC106: 'UNSCALE',

  // ── String functions ───────────────────────────────────────────────────
  LEN: 'LEN', LEFT: 'LEFT', RIGHT: 'RIGHT', MID: 'MID',
  CONCAT: 'CONCAT', FIND: 'FIND', INSERT: 'INSERT', DELETE: 'DELETE', REPLACE: 'REPLACE',
  UPPER_CASE: 'UPPER_CASE', LOWER_CASE: 'LOWER_CASE',
  // Siemens S_xxx string FB names (S7 classic)
  S_LEN: 'LEN', S_LEFT: 'LEFT', S_RIGHT: 'RIGHT', S_MID: 'MID',
  S_FIND: 'FIND', S_CONV: 'MOVE', S_CONCAT: 'CONCAT',

  // ── Communication FBs ─────────────────────────────────────────────────
  // Map to the extended FBType members added above
  SEND: 'SEND', RECV: 'RECV',
  RDREC: 'RDREC', WRREC: 'WRREC',
  // Common Siemens Profinet / Industrial Ethernet FB names
  TSEND: 'SEND', TRCV: 'RECV', TCON: 'SEND', TDISCON: 'RECV',
  'TSEND_C': 'SEND', 'TRCV_C': 'RECV',
  'DPRD_DAT': 'RDREC', 'DPWR_DAT': 'WRREC',
  'FB65': 'SEND', 'FB66': 'RECV',

  // ── Type conversion FBs ────────────────────────────────────────────────
  // Siemens uses CONVERT with template types; map generically
  CONVERT: 'MOVE',
  ROUND: 'MOVE', TRUNC: 'MOVE', CEIL: 'MOVE', FLOOR: 'MOVE',
  // Explicit type conversions
  INT_TO_REAL: 'MOVE', REAL_TO_INT: 'MOVE', DINT_TO_REAL: 'MOVE', REAL_TO_DINT: 'MOVE',
  INT_TO_DINT: 'MOVE', BOOL_TO_INT: 'MOVE', INT_TO_BOOL: 'MOVE',
  WORD_TO_INT: 'MOVE', INT_TO_WORD: 'MOVE', DWORD_TO_DINT: 'MOVE', DINT_TO_DWORD: 'MOVE',
  TIME_TO_DINT: 'MOVE', DINT_TO_TIME: 'MOVE',

  // ── Diagnostic / system FBs ────────────────────────────────────────────
  // Map to MOVE as a safe placeholder (preserves block shape, vendorOriginalName stored)
  ALARM: 'MOVE', ALARM_8: 'MOVE', ALARM_8P: 'MOVE', NOTIFY: 'MOVE',
  AR_SEND: 'MOVE', BLKMOV: 'MOVE',
  READ_DBL: 'RDREC', WRIT_DBL: 'WRREC',
};

function mapSiemensFBType(name: string): FBType | null {
  const upper = name.toUpperCase();
  const mapped = SIEMENS_FB_MAP[upper];
  if (mapped) return mapped;
  // Unknown — return null so caller can decide (unmapped vs passthrough)
  return null;
}

// Reverse map: CLM FBType → canonical Siemens name for export
// Only needs entries where the CLM name differs from the Siemens name
const CLM_TO_SIEMENS: Partial<Record<FBType, string>> = {
  RTRIG: 'R_TRIG', FTRIG: 'F_TRIG',
  TONR: 'TONR', IEC_TIMER: 'IEC_TIMER', IEC_LTIMER: 'IEC_LTIMER',
  IEC_COUNTER: 'IEC_COUNTER', IEC_LCOUNTER: 'IEC_LCOUNTER', IEC_TC: 'IEC_TC',
  NORM_X: 'NORM_X', SCALE_X: 'SCALE_X',
  UPPER_CASE: 'UPPER_CASE', LOWER_CASE: 'LOWER_CASE',
};

function clmFBTypeToSiemens(fbType: FBType): string {
  return CLM_TO_SIEMENS[fbType] || fbType;
}

// Returns the mapped FBType AND whether vendorOriginalName should be stored
// (needed when the mapping is lossy — i.e. original name differs from CLM type name)
function mapSiemensFBTypeWithMeta(name: string): { fbType: FBType; storeOriginal: boolean } | null {
  const fbType = mapSiemensFBType(name);
  if (!fbType) return null;
  // Store original when the CLM type name differs from the vendor name
  const storeOriginal = fbType !== name.toUpperCase() && fbType !== name;
  return { fbType, storeOriginal };
}

// ─── FBD network parser ───────────────────────────────────────────────────────

function parseNetworksToFBD(
  networks: unknown[],
  pouId: string,
  unmapped: UnmappedElement[],
  warnings: string[],
  resolver: VariableTypeResolver = new VariableTypeResolver()
): FBDProgram {
  const nodes: FBDNode[] = [];
  const wires: FBDWire[] = [];
  let nodeIdx = 0;

  for (const netEl of networks) {
    const attrList = child(netEl, 'AttributeList');
    const partsEl = child(attrList, 'NetworkSource');
    const flgNet = child(partsEl, 'FlgNet') ?? partsEl;
    const partsNode = child(flgNet, 'Parts') ?? flgNet;
    const wiresNode = child(flgNet, 'Wires');

    // Build a set of UIds that appear as wire targets (used to determine IN vs OUT variable)
    const wireTargetUIds = new Set<string>();
    if (wiresNode) {
      for (const wireEl of childArray(wiresNode, 'Wire')) {
        const allCons = [...childArray(wireEl, 'NameCon'), ...childArray(wireEl, 'IdentCon')];
        // Last connector(s) on the wire are targets
        for (let wi = 1; wi < allCons.length; wi++) {
          const tUId = attr(allCons[wi], 'UId');
          const tPin = (attr(allCons[wi], 'Name') || '').toLowerCase();
          if (tUId && (tPin === 'in' || tPin === '' || tPin === 'in1')) wireTargetUIds.add(tUId);
        }
      }
    }

    // Parse blocks (Call and Part elements)
    for (const blockEl of childArray(partsNode, 'Call').concat(childArray(partsNode, 'Part'))) {
      const uid = attr(blockEl, 'UId');
      const name = attr(blockEl, 'Name') || attr(child(blockEl, 'CallInfo'), 'Name') || 'BLOCK';
      nodeIdx++;
      const syntheticX = (nodeIdx % 5) * 140;
      const syntheticY = Math.floor(nodeIdx / 5) * 100;
      const x = Number(attr(blockEl, 'X') || attr(blockEl, 'x')) || syntheticX;
      const y = Number(attr(blockEl, 'Y') || attr(blockEl, 'y')) || syntheticY;

      // Build canonical typed pins from signature; supplement with Access children for direction
      const { inputs: sigInputs, outputs: sigOutputs } = buildTypedPins(name, [], `fbd-${uid}`);
      const inputs: Pin[] = [...sigInputs];
      const outputs: Pin[] = [...sigOutputs];

      // Override with Access children where the XML provides direction overrides
      for (const accEl of childArray(blockEl, 'Access')) {
        const dir = attr(accEl, 'Direction');
        const pinName = attr(accEl, 'Name') || parseAccessTag(accEl);
        const canonicalType = getPinDataType(name, pinName, dir === 'Out' || dir === 'Output' ? 'output' : 'input');
        if (dir === 'Out' || dir === 'Output') {
          if (!outputs.find(p => p.name === pinName)) {
            outputs.push({ id: genId('pin'), name: pinName, dataType: canonicalType });
          }
        } else {
          if (!inputs.find(p => p.name === pinName)) {
            inputs.push({ id: genId('pin'), name: pinName, dataType: canonicalType });
          }
        }
      }
      if (inputs.length === 0) inputs.push({ id: genId('pin'), name: 'EN', dataType: 'BOOL' });
      if (outputs.length === 0) outputs.push({ id: genId('pin'), name: 'OUT', dataType: 'BOOL' });

      const mappedFBDType = mapSiemensFBDType(name);
      const fbdNode: FBDNode = {
        id: `fbd-${uid}`,
        type: mappedFBDType,
        instanceName: `${name}_${uid}`,
        position: { x, y },
        inputs,
        outputs,
      };
      if (mappedFBDType !== name && mappedFBDType !== name.toUpperCase()) {
        fbdNode.vendorOriginalName = name;
      }
      nodes.push(fbdNode);
    }

    // Parse Access elements as variable nodes
    for (const accEl of childArray(partsNode, 'Access')) {
      const uid = attr(accEl, 'UId');
      if (!uid) continue;
      const tagName = parseAccessTag(accEl);
      nodeIdx++;
      const syntheticX = (nodeIdx % 5) * 140;
      const syntheticY = Math.floor(nodeIdx / 5) * 100;
      const x = Number(attr(accEl, 'X') || attr(accEl, 'x')) || syntheticX;
      const y = Number(attr(accEl, 'Y') || attr(accEl, 'y')) || syntheticY;
      const isInput = wireTargetUIds.has(uid);
      const accessType = resolver.resolve(tagName);
      nodes.push({
        id: `fbd-${uid}`,
        type: isInput ? 'IN_VARIABLE' : 'OUT_VARIABLE',
        tag: { name: tagName, dataType: accessType },
        position: { x, y },
        inputs: isInput ? [] : [{ id: genId('pin'), name: 'IN', dataType: accessType }],
        outputs: isInput ? [{ id: genId('pin'), name: 'OUT', dataType: accessType }] : [],
      });
    }

    // Parse wires
    if (wiresNode) {
      for (const wireEl of childArray(wiresNode, 'Wire')) {
        const nameCons = childArray(wireEl, 'NameCon');
        const identCons = childArray(wireEl, 'IdentCon');
        const allCons = [...nameCons, ...identCons];

        if (allCons.length >= 2) {
          const fromEl = allCons[0];
          const toEl = allCons[1];
          const fromUId = attr(fromEl, 'UId') || '';
          const toUId = attr(toEl, 'UId') || '';
          const fromPin = attr(fromEl, 'Name') || 'OUT';
          const toPin = attr(toEl, 'Name') || 'IN';

          if (fromUId && toUId) {
            wires.push({
              id: genId('wire'),
              from: { nodeId: `fbd-${fromUId}`, pin: fromPin },
              to: { nodeId: `fbd-${toUId}`, pin: toPin },
            });
          }

          // Additional connections on same wire (fan-out)
          for (let wi = 2; wi < allCons.length; wi++) {
            const extraUId = attr(allCons[wi], 'UId') || '';
            const extraPin = attr(allCons[wi], 'Name') || 'IN';
            if (fromUId && extraUId) {
              wires.push({
                id: genId('wire'),
                from: { nodeId: `fbd-${fromUId}`, pin: fromPin },
                to: { nodeId: `fbd-${extraUId}`, pin: extraPin },
              });
            }
          }
        }
      }
    }
  }

  return { nodes, wires };
}

function mapSiemensFBDType(name: string): FBDBlockType {
  const upper = name.toUpperCase();

  // ── Boolean gates ──────────────────────────────────────────────────────
  const BOOL_GATES: Record<string, FBDBlockType> = {
    AND: 'AND', OR: 'OR', NOT: 'NOT', XOR: 'XOR', NAND: 'NAND', NOR: 'NOR',
  };
  if (BOOL_GATES[upper]) return BOOL_GATES[upper];

  // ── Standard IEC timers ────────────────────────────────────────────────
  const TIMERS: Record<string, FBDBlockType> = {
    TON: 'TON', TOF: 'TOF', TP: 'TP',
    TONR: 'TONR',
    IEC_TIMER: 'IEC_TIMER', IEC_LTIMER: 'IEC_LTIMER',
    SFB3: 'TON', SFB4: 'TOF', SFB5: 'TP',
    IEC_TC: 'IEC_TC',
  };
  if (TIMERS[upper]) return TIMERS[upper];

  // ── Standard IEC counters ──────────────────────────────────────────────
  const COUNTERS: Record<string, FBDBlockType> = {
    CTU: 'CTU', CTD: 'CTD', CTUD: 'CTUD',
    IEC_COUNTER: 'IEC_COUNTER', IEC_LCOUNTER: 'IEC_LCOUNTER',
  };
  if (COUNTERS[upper]) return COUNTERS[upper];

  // ── Bistable / edge ────────────────────────────────────────────────────
  const BISTABLE: Record<string, FBDBlockType> = {
    SR: 'SR', RS: 'RS',
    R_TRIG: 'RTRIG', F_TRIG: 'FTRIG', RTRIG: 'RTRIG', FTRIG: 'FTRIG',
  };
  if (BISTABLE[upper]) return BISTABLE[upper];

  // ── Arithmetic ─────────────────────────────────────────────────────────
  const ARITH: Record<string, FBDBlockType> = {
    ADD: 'ADD', SUB: 'SUB', MUL: 'MUL', DIV: 'DIV', MOD: 'MOD',
    ABS: 'ABS', SQRT: 'SQRT', NEG: 'NEG',
    LN: 'LN', LOG: 'LOG', EXP: 'EXP',
    SIN: 'SIN', COS: 'COS', TAN: 'TAN',
    ASIN: 'ASIN', ACOS: 'ACOS', ATAN: 'ATAN',
    ATN: 'ATAN', ASN: 'ASIN', ACS: 'ACOS',
  };
  if (ARITH[upper]) return ARITH[upper];

  // ── Comparison ─────────────────────────────────────────────────────────
  const CMP: Record<string, FBDBlockType> = {
    GT: 'GT', GE: 'GE', LT: 'LT', LE: 'LE', EQ: 'EQ', NE: 'NE',
  };
  if (CMP[upper]) return CMP[upper];

  // ── Data / selection ───────────────────────────────────────────────────
  const DATA: Record<string, FBDBlockType> = {
    MOVE: 'MOVE', SEL: 'SEL', MUX: 'MUX', LIMIT: 'LIMIT', MIN: 'MIN', MAX: 'MAX',
    BLINK: 'BLINK',
  };
  if (DATA[upper]) return DATA[upper];

  // ── Analog scaling / normalisation ────────────────────────────────────
  const SCALE: Record<string, FBDBlockType> = {
    SCALE: 'SCALE', UNSCALE: 'UNSCALE', NORM_X: 'NORM_X', SCALE_X: 'SCALE_X',
    FC105: 'SCALE', FC106: 'UNSCALE',
  };
  if (SCALE[upper]) return SCALE[upper];

  // ── String functions ───────────────────────────────────────────────────
  const STRFNS: Record<string, FBDBlockType> = {
    LEN: 'LEN', LEFT: 'LEFT', RIGHT: 'RIGHT', MID: 'MID',
    CONCAT: 'CONCAT', FIND: 'FIND', INSERT: 'INSERT', DELETE: 'DELETE', REPLACE: 'REPLACE',
    UPPER_CASE: 'UPPER_CASE', LOWER_CASE: 'LOWER_CASE',
    S_LEN: 'S_LEN', S_LEFT: 'S_LEFT', S_RIGHT: 'S_RIGHT', S_MID: 'S_MID',
    S_FIND: 'S_FIND', S_CONV: 'S_CONV', S_CONCAT: 'S_CONCAT',
  };
  if (STRFNS[upper]) return STRFNS[upper];

  // ── Type conversions ───────────────────────────────────────────────────
  const CONV: Record<string, FBDBlockType> = {
    CONVERT: 'CONVERT', ROUND: 'ROUND', TRUNC: 'TRUNC', CEIL: 'CEIL', FLOOR: 'FLOOR',
    INT_TO_REAL: 'INT_TO_REAL', REAL_TO_INT: 'REAL_TO_INT',
    DINT_TO_REAL: 'DINT_TO_REAL', REAL_TO_DINT: 'REAL_TO_DINT',
    INT_TO_DINT: 'INT_TO_DINT', BOOL_TO_INT: 'BOOL_TO_INT', INT_TO_BOOL: 'INT_TO_BOOL',
    WORD_TO_INT: 'WORD_TO_INT', INT_TO_WORD: 'INT_TO_WORD',
    DWORD_TO_DINT: 'DWORD_TO_DINT', DINT_TO_DWORD: 'DINT_TO_DWORD',
    TIME_TO_DINT: 'TIME_TO_DINT', DINT_TO_TIME: 'DINT_TO_TIME',
  };
  if (CONV[upper]) return CONV[upper];

  // ── Communication FBs ─────────────────────────────────────────────────
  const COMMS: Record<string, FBDBlockType> = {
    SEND: 'SEND', RECV: 'RECV', RDREC: 'RDREC', WRREC: 'WRREC',
    TSEND: 'SEND', TRCV: 'RECV', TCON: 'SEND', TDISCON: 'RECV',
    TSEND_C: 'SEND', TRCV_C: 'RECV',
    DPRD_DAT: 'RDREC', DPWR_DAT: 'WRREC',
    FB65: 'SEND', FB66: 'RECV',
  };
  if (COMMS[upper]) return COMMS[upper];

  // Unknown — use MOVE as a safe placeholder (shape is preserved, original name in vendorOriginalName)
  return 'MOVE';
}

// ─── GRAPH (SFC) parser ──────────────────────────────────────────────────────

function parseNetworksToSFC(
  networks: unknown[],
  pouId: string,
  unmapped: UnmappedElement[],
  warnings: string[]
): SFCProgram {
  const steps: SFCStep[] = [];
  const transitions: SFCTransition[] = [];
  const links: SFCLink[] = [];
  const jumps: SFCJump[] = [];

  // Tracks all step/transition Numbers seen, for jump-target resolution
  const stepNumSet = new Set<string>();
  const transNumSet = new Set<string>();

  // Branch metadata: Number → { type, cardinality }
  interface BranchMeta { type: 'AltBegin' | 'AltEnd' | 'SimBegin' | 'SimEnd'; cardinality: number; }
  const branchMap = new Map<string, BranchMeta>();

  for (const netEl of networks) {
    const attrList = child(netEl, 'AttributeList');
    const partsEl = child(attrList, 'NetworkSource');
    // Real TIA Portal GRAPH: NetworkSource/Graph/Sequence
    const graphEl = child(partsEl, 'Graph');
    const sequenceEl = graphEl ? child(graphEl, 'Sequence') : null;
    // Fallback to old FlgNet-style if no Graph element
    const seqOrNet = sequenceEl ?? child(partsEl, 'FlgNet') ?? partsEl;

    const stepsEl     = child(seqOrNet, 'Steps');
    const transitionsEl = child(seqOrNet, 'Transitions');
    const branchesEl  = child(seqOrNet, 'Branches');
    const connectionsEl = child(seqOrNet, 'Connections');

    const validQualifiers: ActionQualifier[] = ['N', 'S', 'R', 'P', 'P1', 'P0', 'L', 'D', 'SD', 'DS', 'SL'];

    // Steps
    for (const stepEl of childArray(stepsEl ?? seqOrNet, 'Step')) {
      const num = attr(stepEl, 'Number') || attr(stepEl, 'UId') || '';
      const name = attr(stepEl, 'Name') || `S${num}`;
      const isInitial = attr(stepEl, 'Init') === 'true' || attr(stepEl, 'InitialStep') === 'true';
      stepNumSet.add(num);

      const actions: SFCAction[] = [];
      // Fix 9: look for Action elements inside Actions wrapper first, then directly on step
      const actionsContainer = child(stepEl, 'Actions') ?? stepEl;
      // Real TIA GRAPH: Actions contains <Title><MultiLanguageText.../></Title>
      // and step body actions are in Supervisions/Interlocks with FlgNet
      const actionsTitleEl = child(actionsContainer, 'Title');
      if (actionsTitleEl) {
        // Extract action title as a named action with N qualifier
        const mlTexts = childArray(actionsTitleEl, 'MultiLanguageText');
        const titleText = mlTexts.length > 0
          ? (attr(mlTexts[0], 'Lang')?.startsWith('en') ? text(mlTexts[0]) : text(mlTexts[0])) || ''
          : text(actionsTitleEl) || '';
        if (titleText) {
          actions.push({
            id: genId(`action-${num}`),
            qualifier: 'N' as ActionQualifier,
            tag: { name: titleText, dataType: 'BOOL' },
          });
        }
      }
      // Also handle IEC-style <Action Qualifier="N" Name="..."/> elements
      for (const actionEl of childArray(actionsContainer, 'Action')) {
        const qualifier = (attr(actionEl, 'Qualifier') || 'N').toUpperCase() as ActionQualifier;
        const actionName = attr(actionEl, 'Name') || text(child(actionEl, 'Name')) || '';
        const duration = attr(actionEl, 'Duration') || undefined;
        if (actionName) {
          actions.push({
            id: genId(`action-${num}`),
            qualifier: validQualifiers.includes(qualifier) ? qualifier : 'N',
            tag: { name: actionName, dataType: 'BOOL' },
            duration,
          });
        }
      }

      steps.push({
        id: `siemens-step-${num}`,
        name,
        isInitial,
        actions,
        position: { x: 0, y: 0 },
      });
    }

    // Transitions — condition is either:
    // 1. Inline <FlgNet> (real TIA GRAPH transitions have LAD/FBD conditions)
    // 2. <Condition> text child
    // 3. Name attribute as fallback
    for (const transEl of childArray(transitionsEl ?? seqOrNet, 'Transition')) {
      const num = attr(transEl, 'Number') || attr(transEl, 'UId') || '';
      const name = attr(transEl, 'Name') || `T${num}`;
      const progLang = attr(transEl, 'ProgrammingLanguage') || '';
      transNumSet.add(num);

      // Try inline FlgNet first (real TIA GRAPH format)
      const flgNetEl = child(transEl, 'FlgNet');
      let condition = name;
      if (flgNetEl) {
        // Extract Access/variable names from the FlgNet as a simple text condition
        const flgParts = child(flgNetEl, 'Parts');
        const accessEls = childArray(flgParts, 'Access');
        if (accessEls.length > 0) {
          condition = accessEls.map(a => parseAccessTag(a)).filter(t => t !== 'UNKNOWN_TAG').join(' AND ') || name;
        } else {
          // FlgNet with only Parts like TrCoil (always-true transition)
          condition = 'TRUE';
        }
      } else {
        const conditionEl = child(transEl, 'Condition');
        if (conditionEl) {
          condition = text(conditionEl) || 'TRUE';
        }
      }

      transitions.push({
        id: `siemens-trans-${num}`,
        condition,
        position: { x: 0, y: 0 },
      });
    }

    // Branches — AltBegin/AltEnd = selection (OR), SimBegin/SimEnd = simultaneous (AND)
    for (const branchEl of childArray(branchesEl ?? seqOrNet, 'Branch')) {
      const num = attr(branchEl, 'Number') || '';
      const type = (attr(branchEl, 'Type') || 'AltBegin') as BranchMeta['type'];
      const cardinality = Number(attr(branchEl, 'Cardinality') || '2');
      branchMap.set(num, { type, cardinality });
    }

    // Connections — NodeFrom/NodeTo each contain StepRef, TransitionRef, or BranchRef
    const resolveNode = (nodeEl: unknown): { id: string; branchNum?: string; branchPort?: number; isEnd?: boolean } | null => {
      if (!nodeEl) return null;
      const stepRef = child(nodeEl, 'StepRef');
      const transRef = child(nodeEl, 'TransitionRef');
      const branchRef = child(nodeEl, 'BranchRef');
      const endConn = child(nodeEl, 'EndConnection');
      if (stepRef) return { id: `siemens-step-${attr(stepRef, 'Number')}` };
      if (transRef) return { id: `siemens-trans-${attr(transRef, 'Number')}` };
      if (branchRef) {
        const num = attr(branchRef, 'Number') || '';
        const inPort = attr(branchRef, 'In');
        const outPort = attr(branchRef, 'Out');
        const port = inPort !== '' ? Number(inPort) : Number(outPort || '0');
        return { id: `siemens-branch-${num}`, branchNum: num, branchPort: port };
      }
      if (endConn !== undefined && endConn !== null) return { id: 'siemens-end', isEnd: true };
      return null;
    };

    for (const connEl of childArray(connectionsEl ?? seqOrNet, 'Connection')) {
      const linkTypeAttr = text(child(connEl, 'LinkType')) || 'Direct';
      const fromNode = resolveNode(child(connEl, 'NodeFrom'));
      const toNode   = resolveNode(child(connEl, 'NodeTo'));
      if (!fromNode || !toNode) continue;

      // Classify link type based on branch involvement
      let fromId = fromNode.id;
      let toId   = toNode.id;
      const isJumpLink = linkTypeAttr === 'Jump';
      let sfcLinkType: SFCLink['type'] = 'simple';

      if (fromNode.branchNum !== undefined) {
        const meta = branchMap.get(fromNode.branchNum);
        const isSimultaneous = meta?.type === 'SimBegin' || meta?.type === 'SimEnd';
        sfcLinkType = isSimultaneous ? 'simultaneous-divergence' : 'selection-divergence';
      } else if (toNode.branchNum !== undefined) {
        const meta = branchMap.get(toNode.branchNum);
        const isSimultaneous = meta?.type === 'SimBegin' || meta?.type === 'SimEnd';
        // "In" ports = convergence side, "Out" ports = divergence side
        const isInPort = child(child(connEl, 'NodeTo'), 'BranchRef') !== undefined &&
          attr(child(child(connEl, 'NodeTo'), 'BranchRef'), 'In') !== '';
        sfcLinkType = isInPort
          ? (isSimultaneous ? 'simultaneous-convergence' : 'selection-convergence')
          : (isSimultaneous ? 'simultaneous-divergence' : 'selection-divergence');
      }

      // Handle EndConnection: sequence terminates, skip creating a link
      if (toNode.isEnd) {
        // EndConnection = sequence end; no link created (implicit termination)
        continue;
      }

      // Handle jump links: create a SFCJump entry and a link to it
      if (isJumpLink) {
        const targetStepId = toId;
        const targetStepNum = targetStepId.replace('siemens-step-', '');
        const targetStep = steps.find(s => s.id === targetStepId);
        const jumpId = genId(`jump-${fromId}`);
        jumps.push({
          id: jumpId,
          targetStepName: targetStep?.name || `S${targetStepNum}`,
          position: { x: 0, y: 0 },
        });
        links.push({
          id: genId(`link-${fromId}-jump`),
          from: fromId,
          to: jumpId,
          type: 'simple',
        });
        continue;
      }

      links.push({
        id: genId(`link-${fromId}-${toId}`),
        from: fromId,
        to: toId,
        type: sfcLinkType,
      });
    }
  }

  // Derive branches from link topology
  const branches: SFCBranch[] = [];
  const allBranchIds = new Set(links.flatMap(l => [l.from, l.to]).filter(id => id.startsWith('siemens-branch-')));

  for (const barId of allBranchIds) {
    const branchNum = barId.replace('siemens-branch-', '');
    const meta = branchMap.get(branchNum);
    if (!meta) continue;
    // Only process "Begin" branches (divergence side) once
    if (meta.type !== 'AltBegin' && meta.type !== 'SimBegin') continue;

    const isSimultaneous = meta.type === 'SimBegin';
    const upstreamIds = links.filter(l => l.to === barId).map(l => l.from);
    const branchHeadIds = links.filter(l => l.from === barId).map(l => l.to);

    // Find corresponding End bar (convergence)
    const convBarId = [...allBranchIds].find(bid => {
      const bNum = bid.replace('siemens-branch-', '');
      const bMeta = branchMap.get(bNum);
      return bMeta && (isSimultaneous ? bMeta.type === 'SimEnd' : bMeta.type === 'AltEnd');
    }) ?? '';

    const downstreamIds = links.filter(l => l.from === convBarId).map(l => l.to);

    const branchStepArrays: string[][] = branchHeadIds.map(headId => {
      const chain: string[] = [];
      let cur = headId;
      for (let depth = 0; depth < 30; depth++) {
        if (cur.startsWith('siemens-step-')) chain.push(cur);
        const next = links.find(l => l.from === cur && l.type === 'simple' && !allBranchIds.has(l.to));
        if (!next || allBranchIds.has(next.to)) break;
        cur = next.to;
      }
      return chain;
    });

    if (!branches.find(b => b.id === `branch-${barId}`)) {
      branches.push({
        id: `branch-${barId}`,
        type: isSimultaneous ? 'AND' : 'OR',
        divergingFromTransId: upstreamIds[0] || '',
        branchStepIds: branchStepArrays,
        convergingToTransId: downstreamIds[0] || '',
      });
    }
  }

  return { steps, transitions, links, branches, jumps };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function exportSiemens(project: NormalizedProject): ExportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sidecar = project.sidecar;

  let uidCounter = 1;
  const nextUId = () => String(uidCounter++);

  const blocks = project.pous.map(pou => buildSimaticBlock(pou, nextUId, warnings, sidecar));

  // Fix 1 & 2: blocks are direct children of Document (not inside SW.Blocks wrapper),
  // Engineering version element added as sibling.
  const documentObj: Record<string, unknown> = {
    DocumentInfo: {
      Created: new Date().toISOString(),
      ExportSetting: 'WithDefaults',
      InstalledProducts: {},
      ProjectName: project.projectName,
      TiaVersion: sidecar.vendorSpecificGlobals?.['tiaVersion'] ?? '17.0',
    },
    Engineering: { '@_version': 'V14 SP1' },
  };

  const obs: Record<string, unknown>[] = [];
  const fbs: Record<string, unknown>[] = [];
  const fcs: Record<string, unknown>[] = [];
  project.pous.forEach((pou, i) => {
    const block = { ...blocks[i], '@_ID': '0' };
    if (pou.pouType === 'functionBlock') fbs.push(block);
    else if (pou.pouType === 'function') fcs.push(block);
    else obs.push(block);
  });
  if (obs.length > 0) documentObj['SW.Blocks.OB'] = obs;
  if (fbs.length > 0) documentObj['SW.Blocks.FB'] = fbs;
  if (fcs.length > 0) documentObj['SW.Blocks.FC'] = fcs;

  const obj = { Document: documentObj };

  return { ok: true, xmlContent: buildXML(obj), errors, warnings };
}

function buildSimaticBlock(
  pou: NormalizedPOU,
  nextUId: () => string,
  warnings: string[],
  sidecar: VendorMetadataSidecar
): Record<string, unknown> {
  const networks = buildSimaticNetworks(pou, nextUId, warnings);

  return {
    '@_ID': nextUId(),
    AttributeList: {
      AutoNumber: 'true',
      HeaderAuthor: 'Plaxio',
      HeaderFamily: '',
      HeaderName: pou.name,
      HeaderVersion: '1.0',
      Interface: buildSimaticInterface(pou.localTags as SiemensTag[]),
      IsIECCheckEnabled: 'false',
      MemoryLayout: 'Optimized',
      Name: pou.name,
      Namespace: '',
      ProgrammingLanguage: pou.language === 'FBD' ? 'FBD' : pou.language === 'SFC' ? 'GRAPH' : pou.language === 'ST' ? 'SCL' : 'LAD',
    },
    // Fix 7: ObjectList with MultilingualText Title alongside CompileUnits
    ObjectList: {
      'MultilingualText': {
        '@_ID': '1',
        '@_CompositionName': 'Title',
        ObjectList: {
          MultilingualTextItem: {
            '@_ID': '2',
            '@_CompositionName': 'Items',
            AttributeList: { Culture: 'en-US', Text: pou.name },
          },
        },
      },
      // Fix 6: CompileUnit needs CompositionName attribute
      'SW.Blocks.CompileUnit': networks.map(n => ({ '@_CompositionName': 'CompileUnits', ...n as Record<string, unknown> })),
    },
  };
}

function buildSimaticInterface(tags: SiemensTag[]): Record<string, unknown> {
  // Group tags by their stored section (preserved from import)
  const sections: Record<string, SiemensTag[]> = {
    Input: [], Output: [], InOut: [], Static: [], Temp: [], Constant: [], Return: [],
  };

  for (const tag of tags) {
    const sec = tag.section || 'Static';
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(tag);
  }

  const sectionEntries = Object.entries(sections)
    .filter(([_, tags]) => tags.length > 0)
    .map(([name, tags]) => ({
      '@_Name': name,
      Member: tags.map(t => tagToSimaticMember(t)),
    }));

  // Ensure at least Input/Output/Static exist for valid export
  if (sectionEntries.length === 0) {
    sectionEntries.push({ '@_Name': 'Static', Member: [] });
  }

  // Fix 3: Sections needs xmlns namespace attribute
  return { Sections: { '@_xmlns': 'http://www.siemens.com/automation/Openness/SW/Interface/v2', Section: sectionEntries } };
}

function tagToSimaticMember(tag: NormalizedTag): Record<string, unknown> {
  return {
    '@_Name': tag.name,
    '@_Datatype': iecTypeToSimatic(tag.dataType),
    '@_Accessibility': 'Public',
    StartValue: tag.initialValue || undefined,
    // Fix 4: Member Comment needs Lang attribute and Informative attribute
    Comment: tag.description ? {
      '@_Informative': 'true',
      MultiLanguageText: { '@_Lang': 'en-US', '#text': tag.description },
    } : undefined,
  };
}

function buildSimaticNetworks(
  pou: NormalizedPOU,
  nextUId: () => string,
  warnings: string[]
): Record<string, unknown>[] {
  if (pou.language === 'LD' && pou.ladderProgram) {
    return pou.ladderProgram.rungs.map(rung => buildSimaticLADNetwork(rung, nextUId));
  }
  if (pou.language === 'FBD' && pou.fbdProgram) {
    return [buildSimaticFBDNetwork(pou.fbdProgram, nextUId)];
  }
  if (pou.language === 'SFC' && pou.sfcProgram) {
    return buildSimaticGRAPHNetworks(pou.sfcProgram, nextUId);
  }
  if (pou.language === 'ST' && pou.stSource) {
    return [{
      '@_ID': nextUId(),
      AttributeList: {
        ProgrammingLanguage: 'SCL',
        NetworkSource: {
          StructuredText: pou.stSource || '',
        },
      },
    }];
  }
  warnings.push(`POU "${pou.name}": language ${pou.language} — export as empty network`);
  return [{ '@_ID': nextUId(), AttributeList: { ProgrammingLanguage: 'LAD', NetworkSource: {} } }];
}

function buildSimaticLADNetwork(rung: Rung, nextUId: () => string): Record<string, unknown> {
  // Real TIA Portal FlgNet structure:
  // Parts contains: Access elements (variables) + Part elements (instructions) + Call elements
  // Wires contains: Wire elements with Powerrail, NameCon, IdentCon children
  // Access and Part are SEPARATE — Part references its operand via a wire with IdentCon→NameCon(operand)

  const accesses: Record<string, unknown>[] = [];
  const parts: Record<string, unknown>[] = [];
  const calls: Record<string, unknown>[] = [];
  const wires: Record<string, unknown>[] = [];

  // Collect all elements (main + branches) for export
  const allElements = [...rung.elements];
  for (const branch of rung.branches) {
    allElements.push(...branch.elements);
  }

  // First pass: create Part + Access UIDs for each element
  interface PartInfo { partUId: string; accessUId: string; partName: string; }
  const elementPartInfos: PartInfo[] = [];
  let firstPartUId = '';

  for (const el of allElements) {
    if (el.kind === 'contact') {
      const c = el as ContactElement;
      const partUId = nextUId();
      const accessUId = nextUId();
      if (!firstPartUId) firstPartUId = partUId;

      // Determine Part Name
      let partName = 'Contact';
      if (c.type === 'P_CONTACT') partName = 'PContact';
      else if (c.type === 'N_CONTACT') partName = 'NContact';

      // Access element (variable reference)
      const tagParts = c.tag.name.split('.');
      const symbolComponent = tagParts.length === 1
        ? { Component: { '@_Name': tagParts[0] } }
        : { Component: tagParts.map(p => ({ '@_Name': p })) };
      accesses.push({ '@_Scope': 'LocalVariable', '@_UId': accessUId, Symbol: symbolComponent });

      // Part element (instruction)
      const partObj: Record<string, unknown> = { '@_Name': partName, '@_UId': partUId };
      if (c.type === 'NC') partObj['@_Negated'] = 'true';
      parts.push(partObj);

      elementPartInfos.push({ partUId, accessUId, partName });
    } else if (el.kind === 'coil') {
      const c = el as CoilElement;
      const partUId = nextUId();
      const accessUId = nextUId();
      if (!firstPartUId) firstPartUId = partUId;

      let partName = 'Coil';
      if (c.type === 'set' || c.type === 'latch') partName = 'SCoil';
      else if (c.type === 'reset' || c.type === 'unlatch') partName = 'RCoil';

      const tagParts = c.tag.name.split('.');
      const symbolComponent = tagParts.length === 1
        ? { Component: { '@_Name': tagParts[0] } }
        : { Component: tagParts.map(p => ({ '@_Name': p })) };
      accesses.push({ '@_Scope': 'LocalVariable', '@_UId': accessUId, Symbol: symbolComponent });

      const partObj: Record<string, unknown> = { '@_Name': partName, '@_UId': partUId };
      if (c.type === 'negated') partObj['@_Negated'] = 'true';
      parts.push(partObj);

      elementPartInfos.push({ partUId, accessUId, partName });
    } else if (el.kind === 'block') {
      const b = el as BlockElement;
      const callUId = nextUId();
      if (!firstPartUId) firstPartUId = callUId;
      const exportName = b.vendorOriginalName || clmFBTypeToSiemens(b.fbType);
      const instanceUId = nextUId();

      const tagParts = b.instanceName.split('.');
      const instanceComponent = tagParts.length === 1
        ? { '@_Name': tagParts[0] }
        : tagParts.map(p => ({ '@_Name': p }));

      const callObj: Record<string, unknown> = {
        '@_UId': callUId,
        CallInfo: {
          '@_Name': exportName,
          '@_BlockType': (b as any).vendorBlockType || 'FB',
          Instance: {
            '@_Scope': 'LocalVariable',
            '@_UId': instanceUId,
            Component: instanceComponent,
          },
        },
      };
      calls.push(callObj);
      elementPartInfos.push({ partUId: callUId, accessUId: '', partName: 'Call' });
    }
  }

  // Second pass: generate wires (Powerrail→first.in, out→in chains, operand wires)
  // Process main rung elements
  let prevPartUId = '';
  let mainIdx = 0;
  for (let i = 0; i < rung.elements.length; i++) {
    const info = elementPartInfos[mainIdx];
    mainIdx++;
    const el = rung.elements[i];

    if (el.kind === 'block') {
      // Powerrail or prev → en pin
      if (prevPartUId === '') {
        wires.push({ '@_UId': nextUId(), Powerrail: {}, NameCon: { '@_UId': info.partUId, '@_Name': 'en' } });
      } else {
        wires.push({ '@_UId': nextUId(), NameCon: [{ '@_UId': prevPartUId, '@_Name': 'out' }, { '@_UId': info.partUId, '@_Name': 'en' }] });
      }
      prevPartUId = info.partUId;
    } else {
      // Contact/Coil: Powerrail or prev → in pin
      if (prevPartUId === '') {
        wires.push({ '@_UId': nextUId(), Powerrail: {}, NameCon: { '@_UId': info.partUId, '@_Name': 'in' } });
      } else {
        wires.push({ '@_UId': nextUId(), NameCon: [{ '@_UId': prevPartUId, '@_Name': 'out' }, { '@_UId': info.partUId, '@_Name': 'in' }] });
      }
      // Operand wire: IdentCon(accessUId) → NameCon(partUId, operand)
      if (info.accessUId) {
        wires.push({ '@_UId': nextUId(), IdentCon: { '@_UId': info.accessUId }, NameCon: { '@_UId': info.partUId, '@_Name': 'operand' } });
      }
      prevPartUId = info.partUId;
    }
  }

  // Branch elements — each branch starts from powerrail or a branch point
  for (const branch of rung.branches) {
    let branchPrevPartUId = '';
    for (let i = 0; i < branch.elements.length; i++) {
      const info = elementPartInfos[mainIdx];
      mainIdx++;
      const el = branch.elements[i];

      if (el.kind === 'block') {
        if (branchPrevPartUId === '') {
          wires.push({ '@_UId': nextUId(), Powerrail: {}, NameCon: { '@_UId': info.partUId, '@_Name': 'en' } });
        } else {
          wires.push({ '@_UId': nextUId(), NameCon: [{ '@_UId': branchPrevPartUId, '@_Name': 'out' }, { '@_UId': info.partUId, '@_Name': 'en' }] });
        }
        branchPrevPartUId = info.partUId;
      } else {
        if (branchPrevPartUId === '') {
          wires.push({ '@_UId': nextUId(), Powerrail: {}, NameCon: { '@_UId': info.partUId, '@_Name': 'in' } });
        } else {
          wires.push({ '@_UId': nextUId(), NameCon: [{ '@_UId': branchPrevPartUId, '@_Name': 'out' }, { '@_UId': info.partUId, '@_Name': 'in' }] });
        }
        if (info.accessUId) {
          wires.push({ '@_UId': nextUId(), IdentCon: { '@_UId': info.accessUId }, NameCon: { '@_UId': info.partUId, '@_Name': 'operand' } });
        }
        branchPrevPartUId = info.partUId;
      }
    }
  }

  // Build Parts object: Access elements first, then Part elements, then Call elements
  const partsObj: Record<string, unknown> = {};
  if (accesses.length) partsObj.Access = accesses;
  if (parts.length) partsObj.Part = parts;
  if (calls.length) partsObj.Call = calls;

  // Build ObjectList with Comment and Title MultilingualText
  const objectListItems: Record<string, unknown> = {};
  if (rung.comment) {
    objectListItems['MultilingualText'] = [
      {
        '@_ID': nextUId(),
        '@_CompositionName': 'Comment',
        ObjectList: {
          MultilingualTextItem: {
            '@_ID': nextUId(),
            '@_CompositionName': 'Items',
            AttributeList: { Culture: 'en-US', Text: rung.comment },
          },
        },
      },
      {
        '@_ID': nextUId(),
        '@_CompositionName': 'Title',
        ObjectList: {
          MultilingualTextItem: {
            '@_ID': nextUId(),
            '@_CompositionName': 'Items',
            AttributeList: { Culture: 'en-US', Text: '' },
          },
        },
      },
    ];
  }

  return {
    '@_ID': nextUId(),
    '@_CompositionName': 'CompileUnits',
    AttributeList: {
      NetworkSource: {
        FlgNet: {
          '@_xmlns': 'http://www.siemens.com/automation/Openness/SW/NetworkSource/FlgNet/v4',
          Parts: partsObj,
          Wires: { Wire: wires },
        },
      },
      ProgrammingLanguage: 'LAD',
    },
    ObjectList: Object.keys(objectListItems).length > 0 ? objectListItems : {
      MultilingualText: [
        {
          '@_ID': nextUId(),
          '@_CompositionName': 'Comment',
          ObjectList: { MultilingualTextItem: { '@_ID': nextUId(), '@_CompositionName': 'Items', AttributeList: { Culture: 'en-US', Text: '' } } },
        },
        {
          '@_ID': nextUId(),
          '@_CompositionName': 'Title',
          ObjectList: { MultilingualTextItem: { '@_ID': nextUId(), '@_CompositionName': 'Items', AttributeList: { Culture: 'en-US', Text: '' } } },
        },
      ],
    },
  };
}

function buildSimaticFBDNetwork(fbd: FBDProgram, nextUId: () => string): Record<string, unknown> {
  const parts: Record<string, unknown>[] = [];
  const accesses: Record<string, unknown>[] = [];
  const wires: Record<string, unknown>[] = [];

  // Emit blocks as Part elements, variables as Access elements
  for (const node of fbd.nodes) {
    const uid = node.id.replace('fbd-', '') || nextUId();
    if (node.type === 'IN_VARIABLE' || node.type === 'OUT_VARIABLE') {
      // Fix 11: handle dot-path tag names using multiple Component elements
      const tagParts = (node.tag?.name || '').split('.');
      const symbolComponent = tagParts.length === 1
        ? { Component: { '@_Name': tagParts[0] } }
        : { Component: tagParts.map(p => ({ '@_Name': p })) };
      accesses.push({
        '@_UId': uid,
        '@_Scope': 'GlobalVariable',
        Symbol: symbolComponent,
      });
    } else {
      // TemplateValue specifies the SIMATIC data type for generic/polymorphic instructions
      // (e.g. ADD, MOVE). @_Type must be a SIMATIC type string like 'Int', 'Real', not a direction.
      // We emit TemplateValue only if there is a non-BOOL typed input pin to parameterize.
      const templateValues: Record<string, string>[] = [];
      for (const pin of (node.inputs || [])) {
        if (pin.dataType && pin.dataType !== 'BOOL' && (pin.dataType as string) !== 'ANY') {
          const simaticType = iecTypeToSimatic(pin.dataType as import('../../logicStore.js').IECDataType) || pin.dataType;
          templateValues.push({ '@_Name': 'Card', '@_Type': simaticType });
          break; // one TemplateValue per block is sufficient for type inference
        }
      }
      const fbdExportName = node.vendorOriginalName || clmFBTypeToSiemens(node.type as FBType);
      parts.push({
        '@_Name': fbdExportName,
        '@_UId': uid,
        ...(templateValues.length > 0 ? { TemplateValue: templateValues } : {}),
      });
    }
  }

  // Emit wires with NameCon pairs
  for (const wire of fbd.wires) {
    wires.push({
      '@_UId': nextUId(),
      NameCon: [
        { '@_UId': wire.from.nodeId.replace('fbd-', ''), '@_Name': wire.from.pin },
        { '@_UId': wire.to.nodeId.replace('fbd-', ''), '@_Name': wire.to.pin },
      ],
    });
  }

  const partsObj: Record<string, unknown> = {};
  if (parts.length) partsObj.Part = parts;
  if (accesses.length) partsObj.Access = accesses;

  return {
    '@_ID': nextUId(),
    AttributeList: {
      ProgrammingLanguage: 'FBD',
      NetworkSource: {
        FlgNet: {
          '@_xmlns': 'http://www.siemens.com/automation/Openness/SW/NetworkSource/FlgNet/v4',
          Parts: partsObj,
          Wires: { Wire: wires.length ? wires : [] },
        },
      },
    },
  };
}

// ─── GRAPH (SFC) export ─────────────────────────────────────────────────────

function buildSimaticGRAPHNetworks(
  sfc: SFCProgram,
  nextUId: () => string,
): Record<string, unknown>[] {
  // Assign stable Number attributes — extract from IDs or allocate fresh ones
  let counter = 1;
  const allocNum = (id: string, prefix: string): string => {
    const m = id.match(new RegExp(`^${prefix}(\\d+)$`));
    return m ? m[1] : String(counter++);
  };

  // Build step → Number map
  const stepNumMap = new Map<string, string>();
  for (const step of sfc.steps) {
    stepNumMap.set(step.id, allocNum(step.id, 'siemens-step-'));
  }

  // Build transition → Number map
  const transNumMap = new Map<string, string>();
  for (const trans of sfc.transitions) {
    transNumMap.set(trans.id, allocNum(trans.id, 'siemens-trans-'));
  }

  // Build exports arrays
  const exportedSteps: Record<string, unknown>[] = sfc.steps.map(step => {
    const num = stepNumMap.get(step.id) || String(counter++);
    // Real TIA GRAPH format: Actions contains Title (MultiLanguageText), not Action elements
    const actionTitle = step.actions.length > 0 ? step.actions[0].tag.name : step.name;
    // Supervisions and Interlocks use inline FlgNet with SvCoil/IlCoil Part
    const svFlgNet = { Parts: { Part: { '@_Name': 'SvCoil', '@_UId': '21' } }, Wires: { Wire: { '@_UId': '22', Powerrail: {}, NameCon: { '@_UId': '21', '@_Name': 'in' } } } };
    const ilFlgNet = { Parts: { Part: { '@_Name': 'IlCoil', '@_UId': '21' } }, Wires: { Wire: { '@_UId': '22', Powerrail: {}, NameCon: { '@_UId': '21', '@_Name': 'in' } } } };
    return {
      '@_Number': num,
      '@_Init': String(step.isInitial),
      '@_Name': step.name,
      '@_MaximumStepTime': 'T#10S',
      '@_WarningTime': 'T#7S',
      Actions: { Title: { MultiLanguageText: { '@_Lang': 'en-US', '#text': actionTitle } } },
      Supervisions: { Supervision: { '@_ProgrammingLanguage': 'LAD', FlgNet: svFlgNet } },
      Interlocks: { Interlock: { '@_ProgrammingLanguage': 'LAD', FlgNet: ilFlgNet } },
    };
  });

  const exportedTransitions: Record<string, unknown>[] = sfc.transitions.map(trans => {
    const num = transNumMap.get(trans.id) || String(counter++);
    // Build inline FlgNet for the transition condition (TIA GRAPH format)
    // Simple case: TrCoil with Powerrail connection (always-true or condition-based)
    const flgNet: Record<string, unknown> = {
      Parts: { Part: { '@_Name': 'TrCoil', '@_UId': '21' } },
      Wires: { Wire: { '@_UId': '22', Powerrail: {}, NameCon: { '@_UId': '21', '@_Name': 'in' } } },
    };
    return {
      '@_IsMissing': 'false',
      '@_Name': trans.condition,
      '@_Number': num,
      '@_ProgrammingLanguage': 'LAD',
      FlgNet: flgNet,
    };
  });

  // Branches: one AltBegin + one AltEnd (or SimBegin/SimEnd) per branch
  const exportedBranches: Record<string, unknown>[] = [];
  // branch bar IDs from links
  const branchBarIds = new Set(sfc.links.flatMap(l => [l.from, l.to]).filter(id => id.startsWith('siemens-branch-')));
  const emittedBranchNums = new Set<string>();
  let branchCounter = 1;
  const branchBarNumMap = new Map<string, string>();

  for (const barId of branchBarIds) {
    const existingNum = barId.replace('siemens-branch-', '');
    if (!branchBarNumMap.has(barId)) {
      branchBarNumMap.set(barId, /^\d+$/.test(existingNum) ? existingNum : String(branchCounter++));
    }
  }

  // Build branch declarations from SFCBranch records
  const emittedBranchDecls = new Set<string>();
  for (const branch of (sfc.branches ?? [])) {
    const isSimultaneous = branch.type === 'AND';
    const beginType = isSimultaneous ? 'SimBegin' : 'AltBegin';
    const endType   = isSimultaneous ? 'SimEnd'   : 'AltEnd';
    const cardinality = branch.branchStepIds.length;
    const beginNum = String(branchCounter++);
    const endNum   = String(branchCounter++);
    if (!emittedBranchDecls.has(branch.id)) {
      emittedBranchDecls.add(branch.id);
      exportedBranches.push({ '@_Number': beginNum, '@_Type': beginType, '@_Cardinality': String(cardinality) });
      exportedBranches.push({ '@_Number': endNum,   '@_Type': endType,   '@_Cardinality': String(cardinality) });
    }
  }

  // Connections — convert CLM SFCLink[] to TIA Connection elements
  const exportedConnections: Record<string, unknown>[] = [];

  const makeNodeFrom = (id: string): Record<string, unknown> => {
    if (id.startsWith('siemens-step-')) return { StepRef: { '@_Number': stepNumMap.get(id) || id.replace('siemens-step-', '') } };
    if (id.startsWith('siemens-trans-')) return { TransitionRef: { '@_Number': transNumMap.get(id) || id.replace('siemens-trans-', '') } };
    if (id.startsWith('siemens-branch-')) return { BranchRef: { '@_Number': branchBarNumMap.get(id) || id.replace('siemens-branch-', ''), '@_Out': '0' } };
    return { StepRef: { '@_Number': id } };
  };
  const makeNodeTo = (id: string): Record<string, unknown> => {
    if (id.startsWith('siemens-step-')) return { StepRef: { '@_Number': stepNumMap.get(id) || id.replace('siemens-step-', '') } };
    if (id.startsWith('siemens-trans-')) return { TransitionRef: { '@_Number': transNumMap.get(id) || id.replace('siemens-trans-', '') } };
    if (id.startsWith('siemens-branch-')) return { BranchRef: { '@_Number': branchBarNumMap.get(id) || id.replace('siemens-branch-', ''), '@_In': '0' } };
    if (id.startsWith('siemens-jump-')) {
      const jump = sfc.jumps?.find(j => j.id === id);
      const targetNum = stepNumMap.get(`siemens-step-${jump?.targetStepName}`) || '1';
      return { StepRef: { '@_Number': targetNum } };
    }
    return { StepRef: { '@_Number': id } };
  };

  for (const link of sfc.links) {
    const isJumpLink = link.to.startsWith('siemens-jump-');
    exportedConnections.push({
      NodeFrom: makeNodeFrom(link.from),
      NodeTo:   makeNodeTo(link.to),
      LinkType: isJumpLink ? 'Jump' : 'Direct',
    });
  }

  const sequence: Record<string, unknown> = {};
  if (exportedSteps.length)       sequence.Steps       = { Step: exportedSteps };
  if (exportedTransitions.length) sequence.Transitions = { Transition: exportedTransitions };
  if (exportedBranches.length)    sequence.Branches    = { Branch: exportedBranches };
  if (exportedConnections.length) sequence.Connections = { Connection: exportedConnections };

  // Fix 12: add PreOperations and PostOperations stubs
  const graph: Record<string, unknown> = {
    '@_xmlns': 'http://www.siemens.com/automation/Openness/SW/NetworkSource/Graph/v1',
    PreOperations: { PermanentOperation: { '@_ProgrammingLanguage': 'FBD' } },
    Sequence: sequence,
    PostOperations: { PermanentOperation: { '@_ProgrammingLanguage': 'FBD' } },
  };

  return [{
    '@_ID': nextUId(),
    AttributeList: {
      ProgrammingLanguage: 'GRAPH',
      NetworkSource: { Graph: graph },
    },
  }];
}
