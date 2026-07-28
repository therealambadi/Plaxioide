/*
 * PLCopen XML Adapter (TC6 schema, namespace http://www.plcopen.org/xml/tc6_0201)
 * Handles Mitsubishi iQ-Works, CODESYS, Beckhoff TwinCAT, and any TC6-compliant tool.
 *
 * Import: PLCopen XML → NormalizedProject
 * Export: NormalizedProject → PLCopen XML
 */

import { parseXML, buildXML, attr, text, child, childArray } from '../xmlUtils.js';
import { plcopenTypeToIEC } from '../dataTypeMap.js';
import { buildResolver, VariableTypeResolver } from '../variableTypeResolver.js';
import { getPinDataType, buildTypedPins, buildTypedTagRefPins } from '../pinSignatures.js';

function unescapeXML(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
import type {
  ImportResult, ExportResult, NormalizedProject, NormalizedPOU, NormalizedTag,
  VendorMetadataSidecar, UnmappedElement,
} from '../types.js';
import type {
  LadderProgram, FBDProgram, SFCProgram, Rung, LadderElement,
  ContactElement, CoilElement, BlockElement, ContactType, CoilType,
  FBDNode, FBDWire, FBDBlockType, Pin,
  SFCStep, SFCTransition, SFCLink, SFCAction, ActionQualifier, SFCJump, SFCBranch,
  TagRef, IECDataType,
} from '../../logicStore.js';

// ─── Import ───────────────────────────────────────────────────────────────────

export function importPLCopen(xmlContent: string, filePath: string): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const unmapped: UnmappedElement[] = [];

  let root: Record<string, unknown>;
  try {
    root = parseXML(xmlContent);
  } catch (e) {
    return { ok: false, errors: [`XML parse error: ${e}`], warnings: [] };
  }

  const project = child(root, 'project') as Record<string, unknown> | undefined;
  if (!project) {
    return { ok: false, errors: ['No <project> root element found'], warnings: [] };
  }

  const fileInfo = child(project, 'fileHeader') as Record<string, unknown> | undefined;
  const projectName = attr(fileInfo, 'projectName') || attr(project, 'projectName') || 'Imported Project';
  const version = attr(fileInfo, 'productVersion') || '1.0';

  // Global variable lists
  const globalTags: NormalizedTag[] = [];
  const typesNode = child(project, 'types');
  if (typesNode) {
    // Extract global vars declared at the types level (outside individual POUs)
    childArray(typesNode, 'globalVars').forEach(gvList => {
      childArray(gvList, 'variable').forEach(v => {
        const tag = parseVariable(v, unmapped);
        if (tag) globalTags.push(tag);
      });
    });
  }

  const instancesNode = child(project, 'instances');
  if (instancesNode) {
    childArray(instancesNode, 'configurations').forEach(config => {
      childArray(config, 'globalVars').forEach(gvList => {
        childArray(gvList, 'variable').forEach(v => {
          const tag = parseVariable(v, unmapped);
          if (tag) globalTags.push(tag);
        });
      });
    });
  }

  // POUs
  const pous: NormalizedPOU[] = [];
  const typesEl = child(project, 'types') as Record<string, unknown> | undefined;
  const poisEl = typesEl ? child(typesEl, 'pous') : undefined;
  const pouList = childArray(poisEl ?? typesEl, 'pou');

  for (const pouEl of pouList) {
    const pou = parsePOU(pouEl, unmapped, warnings);
    if (pou) pous.push(pou);
  }

  if (pous.length === 0) {
    errors.push('No POUs found in file');
    return { ok: false, errors, warnings };
  }

  const sidecar: VendorMetadataSidecar = {
    sourceVendor: 'plcopen_xml',
    sourceFileVersion: version,
    originalFilePath: filePath,
    unmappedElements: unmapped,
    organizerTreeLayout: child(project, 'instances'),
  };

  return {
    ok: true,
    project: { projectName, pous, globalTags, sidecar },
    errors,
    warnings,
  };
}

function parseVariable(v: unknown, unmapped: UnmappedElement[]): NormalizedTag | null {
  if (!v || typeof v !== 'object') return null;
  const name = attr(v, 'name');
  if (!name) return null;
  const typeEl = child(v, 'type');
  const dataType = inferType(typeEl, unmapped, name);
  const initEl = child(v, 'initialValue');
  const doc = child(v, 'documentation');
  return {
    name,
    dataType,
    // TC6: <simpleValue value="0"/> — value is an attribute, not text content
    initialValue: initEl
      ? (attr(child(initEl, 'simpleValue'), 'value') || text(child(initEl, 'simpleValue')) || text(initEl) || undefined)
      : undefined,
    description: doc ? text(doc) : undefined,
    address: attr(v, 'address') || undefined,
  };
}

function inferType(typeEl: unknown, unmapped: UnmappedElement[], hint: string): IECDataType {
  if (!typeEl || typeof typeEl !== 'object') return 'BOOL';
  const t = typeEl as Record<string, unknown>;
  // <BOOL/>, <INT/>, <REAL/> etc.
  for (const key of Object.keys(t)) {
    if (key.startsWith('@_')) continue;
    return plcopenTypeToIEC(key);
  }
  unmapped.push({ clmNodeId: null, vendorSpecificData: typeEl, reason: `Unknown type for ${hint}` });
  return 'DINT';
}

function parsePOU(pouEl: unknown, unmapped: UnmappedElement[], warnings: string[]): NormalizedPOU | null {
  if (!pouEl || typeof pouEl !== 'object') return null;
  const name = attr(pouEl, 'name');
  if (!name) return null;
  const pouType = attr(pouEl, 'pouType'); // program, functionBlock, function

  const localTags: NormalizedTag[] = [];
  const interfaceEl = child(pouEl, 'interface');
  if (interfaceEl) {
    for (const section of ['localVars', 'inputVars', 'outputVars', 'inOutVars', 'externalVars', 'tempVars', 'globalVars']) {
      childArray(interfaceEl, section).forEach(sec => {
        childArray(sec, 'variable').forEach(v => {
          const tag = parseVariable(v, unmapped);
          if (tag) localTags.push(tag);
        });
      });
    }
    // Also accept <variable> directly in <interface>
    childArray(interfaceEl, 'variable').forEach(v => {
      const tag = parseVariable(v, unmapped);
      if (tag) localTags.push(tag);
    });
    // returnType — store as a special tag so it can be round-tripped
    const retTypeEl = child(interfaceEl, 'returnType');
    if (retTypeEl) {
      const retType = inferType(retTypeEl, unmapped, `${name}_returnType`);
      localTags.push({ name: '__returnType__', dataType: retType });
    }
  }

  const normalizedPouType = pouType as NormalizedPOU['pouType'];

  const bodyEl = child(pouEl, 'body');
  if (!bodyEl) {
    warnings.push(`POU "${name}" has no body — imported as empty`);
    return { id: `pou-${name}`, name, pouType: normalizedPouType, language: 'LD', ladderProgram: { rungs: [] }, localTags };
  }

  // Build a resolver so parsers can look up variable types from declarations
  const resolver = buildResolver(localTags, []);

  // Determine language from body
  if (child(bodyEl, 'LD')) {
    const ld = parseLDBody(child(bodyEl, 'LD'), name, unmapped, resolver);
    return { id: `pou-${name}`, name, pouType: normalizedPouType, language: 'LD', ladderProgram: ld, localTags };
  }
  if (child(bodyEl, 'FBD')) {
    const fbd = parseFBDBody(child(bodyEl, 'FBD'), name, unmapped, resolver);
    return { id: `pou-${name}`, name, pouType: normalizedPouType, language: 'FBD', fbdProgram: fbd, localTags };
  }
  if (child(bodyEl, 'SFC')) {
    const sfc = parseSFCBody(child(bodyEl, 'SFC'), name, unmapped);
    return { id: `pou-${name}`, name, pouType: normalizedPouType, language: 'SFC', sfcProgram: sfc, localTags };
  }
  if (child(bodyEl, 'ST')) {
    const stEl = child(bodyEl, 'ST') as Record<string, unknown>;
    // Handle multiple xhtml:p elements (one per line) or single element
    const pEls = childArray(stEl, 'xhtml:p');
    let rawSrc: string;
    if (pEls.length > 0) {
      rawSrc = pEls.map(p => text(p) || '').join('\n');
    } else {
      rawSrc = text(child(stEl, 'xhtml') ?? stEl) || '';
    }
    const src = rawSrc ? unescapeXML(rawSrc) : rawSrc;
    return { id: `pou-${name}`, name, pouType: normalizedPouType, language: 'ST', stSource: src, localTags };
  }
  if (child(bodyEl, 'IL')) {
    unmapped.push({ clmNodeId: `pou-${name}`, vendorSpecificData: bodyEl, reason: 'IL language not supported' });
    return { id: `pou-${name}`, name, pouType: normalizedPouType, language: 'ST', stSource: '(* IL import not supported *)', localTags };
  }

  unmapped.push({ clmNodeId: `pou-${name}`, vendorSpecificData: bodyEl, reason: 'Unknown body language' });
  return { id: `pou-${name}`, name, pouType: normalizedPouType, language: 'LD', ladderProgram: { rungs: [] }, localTags };
}

// ─── LD body parser ────────────────────────────────────────────────────────────

function parseLDBody(ldEl: unknown, pouName: string, unmapped: UnmappedElement[], resolver: VariableTypeResolver = new VariableTypeResolver()): LadderProgram {
  const rungs: Rung[] = [];
  if (!ldEl) return { rungs };

  // Some exporters use flat LD body without <rung> wrappers — treat the whole LD as one rung
  let rungElements = childArray(ldEl, 'rung');
  if (rungElements.length === 0) {
    // Treat the entire LD element as a single implicit rung
    rungElements = [ldEl as Record<string, unknown>];
  }

  let rungIdx = 0;
  for (const networkEl of rungElements) {
    rungIdx++;
    const comment = text(child(networkEl, 'comment') ?? child(networkEl, 'documentation'));
    const allElements: LadderElement[] = [];
    const localIdMap = new Map<string, LadderElement>();

    for (const contact of childArray(networkEl, 'contact')) {
      const el = parseLDContact(contact, allElements.length, resolver);
      if (el) {
        allElements.push(el);
        const lid = attr(contact, 'localId');
        if (lid) localIdMap.set(lid, el);
      }
    }
    for (const coil of childArray(networkEl, 'coil')) {
      const el = parseLDCoil(coil, allElements.length, resolver);
      if (el) {
        allElements.push(el);
        const lid = attr(coil, 'localId');
        if (lid) localIdMap.set(lid, el);
      }
    }
    for (const block of childArray(networkEl, 'block')) {
      const el = parseLDBlock(block, allElements.length, unmapped, resolver);
      if (el) {
        allElements.push(el);
        const lid = attr(block, 'localId');
        if (lid) localIdMap.set(lid, el);
      }
    }

    // Build wire graph from connectionPointIn references
    const incomingEdges = new Map<string, string[]>(); // localId → [source localIds]
    for (const elTag of [...childArray(networkEl, 'contact'), ...childArray(networkEl, 'coil'), ...childArray(networkEl, 'block')]) {
      const localId = attr(elTag, 'localId');
      if (!localId) continue;
      const cpIn = child(elTag, 'connectionPointIn');
      if (!cpIn) continue;
      const conns = childArray(cpIn, 'connection');
      const sources = conns.map(c => attr(c, 'refLocalId')).filter(Boolean) as string[];
      if (sources.length > 0) incomingEdges.set(localId, sources);
    }

    // Detect fan-out (one source → multiple targets): indicates branching
    const outgoing = new Map<string, string[]>(); // sourceId → [targetIds]
    for (const [target, sources] of incomingEdges) {
      for (const src of sources) {
        if (!outgoing.has(src)) outgoing.set(src, []);
        outgoing.get(src)!.push(target);
      }
    }

    // Find branch points (any source with > 1 outgoing)
    const branchPoints = new Set<string>();
    for (const [src, targets] of outgoing) {
      if (targets.length > 1) branchPoints.add(src);
    }

    // Build branches from the topology
    const branches: import('../../logicStore.js').Branch[] = [];
    const branchElements = new Set<string>();

    if (branchPoints.size > 0) {
      for (const branchSrc of branchPoints) {
        const targets = outgoing.get(branchSrc) || [];
        // First target is the main path, remaining are branches
        for (let bi = 1; bi < targets.length; bi++) {
          const branchPath: LadderElement[] = [];
          let current: string | undefined = targets[bi];
          const visited = new Set<string>();
          while (current && !visited.has(current)) {
            visited.add(current);
            const el = localIdMap.get(current);
            if (el) {
              branchPath.push(el);
              branchElements.add(current);
            }
            // Follow the single outgoing from this element
            const nextTargets = outgoing.get(current) || [];
            current = nextTargets.length === 1 ? nextTargets[0] : undefined;
          }
          if (branchPath.length > 0) {
            branches.push({
              id: `${pouName}-rung-${rungIdx}-branch-${bi}`,
              startNodeId: branchSrc,
              endNodeId: branchPath[branchPath.length - 1].id,
              elements: branchPath,
            });
          }
        }
      }
    }

    // Main elements = all elements minus those consumed by branches
    const mainElements = allElements.filter(el => {
      const lid = [...localIdMap.entries()].find(([_, v]) => v === el)?.[0];
      return !lid || !branchElements.has(lid);
    });

    mainElements.sort((a, b) => a.position.x - b.position.x);

    rungs.push({ id: `${pouName}-rung-${rungIdx}`, number: rungIdx, comment, elements: mainElements, branches });
  }

  return { rungs };
}

function parseLDContact(contactEl: unknown, idx: number, resolver: VariableTypeResolver = new VariableTypeResolver()): ContactElement | null {
  if (!contactEl || typeof contactEl !== 'object') return null;
  const localId = attr(contactEl, 'localId');
  const negated = attr(contactEl, 'negated') === 'true';
  const edgeModifier = attr(contactEl, 'edge'); // 'rising' | 'falling'
  const varEl = child(contactEl, 'variable');
  const tagName = varEl ? text(varEl) : attr(contactEl, 'variable');
  if (!tagName) return null;

  let type: ContactType = negated ? 'NC' : 'NO';
  if (edgeModifier === 'rising') type = 'P_CONTACT';
  if (edgeModifier === 'falling') type = 'N_CONTACT';

  const posEl = child(contactEl, 'position');

  return {
    kind: 'contact',
    id: `ld-contact-${localId || idx}`,
    type,
    tag: { name: tagName, dataType: resolver.resolve(tagName) },
    position: { x: Number(attr(posEl, 'x')) || idx * 60, y: Number(attr(posEl, 'y')) || 0 },
  };
}

function parseLDCoil(coilEl: unknown, idx: number, resolver: VariableTypeResolver = new VariableTypeResolver()): CoilElement | null {
  if (!coilEl || typeof coilEl !== 'object') return null;
  const localId = attr(coilEl, 'localId');
  const negated = attr(coilEl, 'negated') === 'true';
  const storage = attr(coilEl, 'storage'); // 'set' | 'reset' | 'retentive'
  const edgeModifier = attr(coilEl, 'edge'); // 'rising' | 'falling'
  const varEl = child(coilEl, 'variable');
  const tagName = varEl ? text(varEl) : attr(coilEl, 'variable');
  if (!tagName) return null;

  let type: CoilType = 'normal';
  if (negated) type = 'negated';
  if (storage === 'set') type = 'set';
  if (storage === 'reset') type = 'reset';
  if (storage === 'retentive') type = 'latch';
  if (edgeModifier === 'rising') type = 'positive_transition' as CoilType;
  if (edgeModifier === 'falling') type = 'negative_transition' as CoilType;

  const posEl = child(coilEl, 'position');

  return {
    kind: 'coil',
    id: `ld-coil-${localId || idx}`,
    type,
    tag: { name: tagName, dataType: resolver.resolve(tagName) },
    position: { x: Number(attr(posEl, 'x')) || (idx + 1) * 60, y: Number(attr(posEl, 'y')) || 0 },
  };
}

function parseLDBlock(blockEl: unknown, idx: number, unmapped: UnmappedElement[], resolver: VariableTypeResolver = new VariableTypeResolver()): BlockElement | null {
  if (!blockEl || typeof blockEl !== 'object') return null;
  const localId = attr(blockEl, 'localId');
  const typeName = attr(blockEl, 'typeName') || '';
  const instanceName = attr(blockEl, 'instanceName') || typeName;
  const fbTypeMap: Record<string, string> = {
    TON:'TON',TOF:'TOF',TP:'TP',CTU:'CTU',CTD:'CTD',CTUD:'CTUD',
    SR:'SR',RS:'RS',R_TRIG:'RTRIG',F_TRIG:'FTRIG',
    ADD:'ADD',SUB:'SUB',MUL:'MUL',DIV:'DIV',MOD:'MOD',
    GT:'GT',GE:'GE',LT:'LT',LE:'LE',EQ:'EQ',NE:'NE',
    SEL:'SEL',MUX:'MUX',LIMIT:'LIMIT',MOVE:'MOVE',
    AND:'AND',OR:'OR',XOR:'XOR',NOT:'NOT',
    ABS:'ABS',SQRT:'SQRT',LN:'LN',LOG:'LOG',EXP:'EXP',
    SIN:'SIN',COS:'COS',TAN:'TAN',ASIN:'ASIN',ACOS:'ACOS',ATAN:'ATAN',
    MAX:'MAX',MIN:'MIN',
  };
  const fbType = fbTypeMap[typeName.toUpperCase()] || typeName;

  // Collect raw pin→variable-name mappings from the XML
  const rawPins: Record<string, string> = {};
  for (const varEl of childArray(blockEl, 'inputVariable').concat(childArray(blockEl, 'outputVariable'))) {
    const pinName = attr(varEl, 'formalParameter');
    const connEl = child(varEl, 'connectionPointIn') ?? child(varEl, 'connectionPointOut');
    const connChild = child(connEl, 'connection');
    const connName = attr(connChild, 'refLocalId') || text(connChild) || attr(varEl, 'formalParameter') || '';
    if (pinName) rawPins[pinName] = connName;
  }

  // Build typed pins: canonical types from pinSignatures, resolved variable types as fallback
  const typedPins = buildTypedTagRefPins(fbType, rawPins);
  // Override canonical type with resolver type where we have a concrete variable name
  const pins: Record<string, TagRef> = {};
  for (const [pinName, pinDef] of Object.entries(typedPins)) {
    const varName = pinDef.name;
    const resolvedType = varName ? resolver.resolve(varName) : null;
    pins[pinName] = {
      name: varName,
      // Use resolved variable type when it's more specific than BOOL canonical default
      dataType: (resolvedType && resolvedType !== 'BOOL') ? resolvedType : pinDef.dataType,
    };
  }

  const posEl = child(blockEl, 'position');
  const px = Number(attr(posEl, 'x')) || idx * 60;
  const py = Number(attr(posEl, 'y')) || 0;

  return {
    kind: 'block',
    id: `ld-block-${localId || idx}`,
    fbType: fbType as any,
    instanceName,
    pins,
    position: { x: px, y: py },
  };
}

// ─── FBD body parser ───────────────────────────────────────────────────────────

function parseFBDBody(fbdEl: unknown, pouName: string, unmapped: UnmappedElement[], resolver: VariableTypeResolver = new VariableTypeResolver()): FBDProgram {
  const nodes: FBDNode[] = [];
  const wires: FBDWire[] = [];
  if (!fbdEl) return { nodes, wires };

  // Parse label elements (jump targets in FBD)
  for (const labelEl of childArray(fbdEl, 'label')) {
    const localId = attr(labelEl, 'localId');
    const posEl = child(labelEl, 'position');
    const labelName = attr(labelEl, 'label') || '';
    nodes.push({
      id: `fbd-${localId}`,
      type: 'LABEL' as FBDBlockType,
      instanceName: labelName,
      position: { x: Number(attr(posEl, 'x')) || 0, y: Number(attr(posEl, 'y')) || 0 },
      inputs: [{ id: `label-${localId}-in`, name: 'IN', dataType: 'BOOL' }],
      outputs: [],
    });
    const cpIn = child(labelEl, 'connectionPointIn');
    if (cpIn) {
      for (const conn of childArray(cpIn, 'connection')) {
        const refId = attr(conn, 'refLocalId');
        const fromPin = attr(conn, 'formalParameter') || 'OUT';
        if (refId) {
          wires.push({ id: `wire-${refId}-to-label-${localId}`, from: { nodeId: `fbd-${refId}`, pin: fromPin }, to: { nodeId: `fbd-${localId}`, pin: 'IN' } });
        }
      }
    }
  }

  // Parse jump elements (unconditional jump to label in FBD)
  for (const jumpEl of childArray(fbdEl, 'jump')) {
    const localId = attr(jumpEl, 'localId');
    const posEl = child(jumpEl, 'position');
    const labelName = attr(jumpEl, 'label') || '';
    nodes.push({
      id: `fbd-${localId}`,
      type: 'JUMP' as FBDBlockType,
      instanceName: labelName,
      position: { x: Number(attr(posEl, 'x')) || 0, y: Number(attr(posEl, 'y')) || 0 },
      inputs: [{ id: `jump-${localId}-in`, name: 'IN', dataType: 'BOOL' }],
      outputs: [],
    });
    const cpIn = child(jumpEl, 'connectionPointIn');
    if (cpIn) {
      for (const conn of childArray(cpIn, 'connection')) {
        const refId = attr(conn, 'refLocalId');
        const fromPin = attr(conn, 'formalParameter') || 'OUT';
        if (refId) {
          wires.push({ id: `wire-${refId}-to-jump-${localId}`, from: { nodeId: `fbd-${refId}`, pin: fromPin }, to: { nodeId: `fbd-${localId}`, pin: 'IN' } });
        }
      }
    }
  }

  // Parse return elements
  for (const retEl of childArray(fbdEl, 'return')) {
    const localId = attr(retEl, 'localId');
    const posEl = child(retEl, 'position');
    nodes.push({
      id: `fbd-${localId}`,
      type: 'RETURN' as FBDBlockType,
      instanceName: 'RETURN',
      position: { x: Number(attr(posEl, 'x')) || 0, y: Number(attr(posEl, 'y')) || 0 },
      inputs: [{ id: `return-${localId}-in`, name: 'IN', dataType: 'BOOL' }],
      outputs: [],
    });
    const cpIn = child(retEl, 'connectionPointIn');
    if (cpIn) {
      for (const conn of childArray(cpIn, 'connection')) {
        const refId = attr(conn, 'refLocalId');
        const fromPin = attr(conn, 'formalParameter') || 'OUT';
        if (refId) {
          wires.push({ id: `wire-${refId}-to-return-${localId}`, from: { nodeId: `fbd-${refId}`, pin: fromPin }, to: { nodeId: `fbd-${localId}`, pin: 'IN' } });
        }
      }
    }
  }

  // Parse connector elements (named signal sink — pairs with continuation)
  for (const connEl of childArray(fbdEl, 'connector')) {
    const localId = attr(connEl, 'localId');
    const posEl = child(connEl, 'position');
    const connName = attr(connEl, 'name') || '';
    nodes.push({
      id: `fbd-${localId}`,
      type: 'CONNECTOR' as FBDBlockType,
      instanceName: connName,
      position: { x: Number(attr(posEl, 'x')) || 0, y: Number(attr(posEl, 'y')) || 0 },
      inputs: [{ id: `connector-${localId}-in`, name: 'IN', dataType: 'BOOL' }],
      outputs: [],
    });
    const cpIn = child(connEl, 'connectionPointIn');
    if (cpIn) {
      for (const conn of childArray(cpIn, 'connection')) {
        const refId = attr(conn, 'refLocalId');
        const fromPin = attr(conn, 'formalParameter') || 'OUT';
        if (refId) {
          wires.push({ id: `wire-${refId}-to-connector-${localId}`, from: { nodeId: `fbd-${refId}`, pin: fromPin }, to: { nodeId: `fbd-${localId}`, pin: 'IN' } });
        }
      }
    }
  }

  // Parse continuation elements (named signal source — pairs with connector)
  for (const contEl of childArray(fbdEl, 'continuation')) {
    const localId = attr(contEl, 'localId');
    const posEl = child(contEl, 'position');
    const contName = attr(contEl, 'name') || '';
    nodes.push({
      id: `fbd-${localId}`,
      type: 'CONTINUATION' as FBDBlockType,
      instanceName: contName,
      position: { x: Number(attr(posEl, 'x')) || 0, y: Number(attr(posEl, 'y')) || 0 },
      inputs: [],
      outputs: [{ id: `continuation-${localId}-out`, name: 'OUT', dataType: 'BOOL' }],
    });
  }

  const wireMap = new Map<string, { nodeId: string; pin: string }>(); // connectionId → source pin

  for (const blockEl of childArray(fbdEl, 'block')) {
    const localId = attr(blockEl, 'localId');
    const typeName = attr(blockEl, 'typeName') || '';
    const instanceName = attr(blockEl, 'instanceName') || `${typeName}_${localId}`;
    const posEl = child(blockEl, 'position');
    const x = Number(attr(posEl, 'x')) || 0;
    const y = Number(attr(posEl, 'y')) || 0;

    // Build typed pin arrays from canonical signature
    const { inputs: sigInputs, outputs: sigOutputs } = buildTypedPins(typeName, [], `fbd-${localId}`);
    // Build a lookup so we can override with actual negated flags from XML
    const inputsByName = new Map(sigInputs.map(p => [p.name, { ...p }]));
    const outputsByName = new Map(sigOutputs.map(p => [p.name, { ...p }]));

    // Some tools (CODESYS, Beckhoff) omit the inputVariables wrapper
    const directVars = childArray(blockEl, 'variable');
    const inputVarEls = (childArray(blockEl, 'inputVariables').flatMap(iv => childArray(iv, 'variable')))
      .concat(directVars.filter(v => child(v, 'connectionPointIn') !== null && child(v, 'connectionPointIn') !== undefined));

    for (const inVar of inputVarEls) {
      const pinName = attr(inVar, 'formalParameter') || '';
      const negated = attr(inVar, 'negated') === 'true';
      const connId = attr(child(inVar, 'connectionPointIn'), 'refLocalId') || attr(inVar, 'localId');
      // Get canonical type; fall back to BOOL for unknown blocks/pins
      const canonicalType = getPinDataType(typeName, pinName, 'input');
      if (inputsByName.has(pinName)) {
        inputsByName.get(pinName)!.negated = negated;
      } else {
        inputsByName.set(pinName, { id: `${localId}-in-${pinName}`, name: pinName, dataType: canonicalType, negated });
      }
      if (connId) wireMap.set(connId, { nodeId: `fbd-${localId}`, pin: pinName });
    }

    for (const outVar of childArray(blockEl, 'outputVariables').flatMap(ov => childArray(ov, 'variable'))) {
      const pinName = attr(outVar, 'formalParameter') || '';
      const negated = attr(outVar, 'negated') === 'true';
      const canonicalType = getPinDataType(typeName, pinName, 'output');
      if (outputsByName.has(pinName)) {
        outputsByName.get(pinName)!.negated = negated;
      } else {
        outputsByName.set(pinName, { id: `${localId}-out-${pinName}`, name: pinName, dataType: canonicalType, negated });
      }
    }

    const execOrder = attr(blockEl, 'executionOrderId');
    nodes.push({
      id: `fbd-${localId}`,
      type: typeName.toUpperCase() as FBDBlockType,
      instanceName,
      position: { x, y },
      inputs: [...inputsByName.values()],
      outputs: [...outputsByName.values()],
      executionOrderId: execOrder ? Number(execOrder) : undefined,
    });
  }

  // inOutVariable elements (both input and output connections)
  for (const varEl of childArray(fbdEl, 'inOutVariable')) {
    const localId = attr(varEl, 'localId');
    const posEl = child(varEl, 'position');
    const x = Number(attr(posEl, 'x')) || 0;
    const y = Number(attr(posEl, 'y')) || 0;
    const varName = text(child(varEl, 'expression') ?? varEl) || '';
    const varType = resolver.resolve(varName);
    nodes.push({
      id: `fbd-var-${localId}`,
      type: 'IN_OUT_VARIABLE' as FBDBlockType,
      tag: { name: varName, dataType: varType },
      position: { x, y },
      inputs: [{ id: `var-${localId}-in`, name: 'IN', dataType: varType }],
      outputs: [{ id: `var-${localId}-out`, name: 'OUT', dataType: varType }],
    });
    // Build wires from connectionPointIn connections
    const cpIn = child(varEl, 'connectionPointIn');
    if (cpIn) {
      for (const conn of childArray(cpIn, 'connection')) {
        const refId = attr(conn, 'refLocalId');
        const fromPin = attr(conn, 'formalParameter') || 'OUT';
        if (refId) {
          wires.push({
            id: `wire-${refId}-to-var-${localId}`,
            from: { nodeId: `fbd-${refId}`, pin: fromPin },
            to: { nodeId: `fbd-var-${localId}`, pin: 'IN' },
          });
        }
      }
    }
  }

  // Variable (IN_VARIABLE / OUT_VARIABLE)
  const outVarEls = new Set(childArray(fbdEl, 'outVariable'));
  for (const varEl of childArray(fbdEl, 'inVariable').concat(childArray(fbdEl, 'outVariable'))) {
    const localId = attr(varEl, 'localId');
    const isOut = outVarEls.has(varEl);
    const posEl = child(varEl, 'position');
    const x = Number(attr(posEl, 'x')) || 0;
    const y = Number(attr(posEl, 'y')) || 0;
    const varName = text(child(varEl, 'expression') ?? varEl) || '';
    const varType = resolver.resolve(varName);
    nodes.push({
      id: `fbd-var-${localId}`,
      type: isOut ? 'OUT_VARIABLE' : 'IN_VARIABLE',
      tag: { name: varName, dataType: varType },
      position: { x, y },
      inputs: isOut ? [{ id: `var-${localId}-in`, name: 'IN', dataType: varType }] : [],
      outputs: isOut ? [] : [{ id: `var-${localId}-out`, name: 'OUT', dataType: varType }],
    });
  }

  // Build wires by traversing connectionPointIn on each block's input variables
  for (const blockEl of childArray(fbdEl, 'block')) {
    const blockLocalId = attr(blockEl, 'localId');
    for (const inVar of childArray(blockEl, 'inputVariables').flatMap(iv => childArray(iv, 'variable'))) {
      const pinName = attr(inVar, 'formalParameter');
      const cpIn = child(inVar, 'connectionPointIn');
      if (!cpIn) continue;
      for (const conn of childArray(cpIn, 'connection')) {
        const refId = attr(conn, 'refLocalId');
        const fromPin = attr(conn, 'formalParameter') || 'OUT';
        if (refId) {
          wires.push({
            id: `wire-${refId}-to-${blockLocalId}-${pinName}`,
            from: { nodeId: `fbd-${refId}`, pin: fromPin },
            to: { nodeId: `fbd-${blockLocalId}`, pin: pinName },
          });
        }
      }
    }
  }

  // Build wires for outVariable elements (they receive connections)
  for (const varEl of childArray(fbdEl, 'outVariable')) {
    const localId = attr(varEl, 'localId');
    const cpIn = child(varEl, 'connectionPointIn');
    if (!cpIn) continue;
    for (const conn of childArray(cpIn, 'connection')) {
      const refId = attr(conn, 'refLocalId');
      const fromPin = attr(conn, 'formalParameter') || 'OUT';
      if (refId) {
        wires.push({
          id: `wire-${refId}-to-var-${localId}`,
          from: { nodeId: `fbd-${refId}`, pin: fromPin },
          to: { nodeId: `fbd-var-${localId}`, pin: 'IN' },
        });
      }
    }
  }

  // Build wires for inVariable connectionPointIn (rare but possible in some exporters)
  for (const varEl of childArray(fbdEl, 'inVariable')) {
    const localId = attr(varEl, 'localId');
    const cpIn = child(varEl, 'connectionPointIn');
    if (!cpIn) continue;
    for (const conn of childArray(cpIn, 'connection')) {
      const refId = attr(conn, 'refLocalId');
      const fromPin = attr(conn, 'formalParameter') || 'OUT';
      if (refId) {
        wires.push({
          id: `wire-${refId}-to-var-${localId}`,
          from: { nodeId: `fbd-${refId}`, pin: fromPin },
          to: { nodeId: `fbd-var-${localId}`, pin: 'IN' },
        });
      }
    }
  }

  return { nodes, wires };
}

// ─── SFC body parser ───────────────────────────────────────────────────────────

function parseSFCBody(sfcEl: unknown, pouName: string, unmapped: UnmappedElement[]): SFCProgram {
  const steps: SFCStep[] = [];
  const transitions: SFCTransition[] = [];
  const links: SFCLink[] = [];

  const jumps: SFCJump[] = [];
  if (!sfcEl) return { steps, transitions, links, branches: [], jumps };

  // Pre-build a map from step localId → actions from sibling actionBlock elements
  const stepActionMap = new Map<string, SFCAction[]>();
  for (const abEl of childArray(sfcEl, 'actionBlock')) {
    const cpIn = child(abEl, 'connectionPointIn');
    const refStepId = cpIn ? (attr(child(cpIn, 'connection'), 'refLocalId') || '') : '';
    if (!refStepId) continue;
    const qualifiers: ActionQualifier[] = ['N','S','R','P','P1','P0','L','D','SD','DS','SL'];
    for (const actionEl of childArray(abEl, 'action')) {
      const qual = attr(actionEl, 'qualifier') as ActionQualifier;
      const refEl = child(actionEl, 'reference');
      // Bug 8 fix: read name attribute first, not text content
      const tagName = attr(refEl, 'name') || attr(actionEl, 'name');
      if (!tagName) continue;
      if (!stepActionMap.has(refStepId)) stepActionMap.set(refStepId, []);
      stepActionMap.get(refStepId)!.push({
        id: `action-${tagName}-${qual}`,
        qualifier: qualifiers.includes(qual) ? qual : 'N',
        tag: { name: tagName, dataType: 'BOOL' },
        duration: attr(actionEl, 'duration') || undefined,
      });
    }
  }

  let stepIdx = 0;
  for (const stepEl of childArray(sfcEl, 'step')) {
    const localId = attr(stepEl, 'localId');
    const name = attr(stepEl, 'name') || `Step${stepIdx}`;
    const isInitial = attr(stepEl, 'initialStep') === 'true';
    const posEl = child(stepEl, 'position');
    stepIdx++;
    // Actions from sibling actionBlocks (preferred) or inline step children
    const siblingActions = stepActionMap.get(localId || '') || [];
    const inlineActions = siblingActions.length === 0 ? parseActions(stepEl, unmapped) : [];
    steps.push({
      id: `sfc-step-${localId}`,
      name,
      isInitial,
      actions: siblingActions.length > 0 ? siblingActions : inlineActions,
      position: { x: Number(attr(posEl, 'x')) || 0, y: Number(attr(posEl, 'y')) || 0 },
    });
  }

  let transIdx = 0;
  for (const transEl of childArray(sfcEl, 'transition')) {
    const localId = attr(transEl, 'localId');
    const posEl = child(transEl, 'position');
    const condEl = child(transEl, 'condition');
    const stEl = child(condEl, 'ST') ?? child(transEl, 'reference') ?? condEl;
    const condition = stEl ? text(child(stEl as Record<string, unknown>, 'xhtml:p') ?? child(stEl as Record<string, unknown>, 'xhtml') ?? stEl) : 'TRUE';
    const priority = attr(transEl, 'priority');
    transIdx++;
    transitions.push({
      id: `sfc-trans-${localId}`,
      condition: condition || 'TRUE',
      priority: priority ? Number(priority) : undefined,
      position: { x: Number(attr(posEl, 'x')) || 0, y: Number(attr(posEl, 'y')) || 0 },
    });
  }

  // Build links from connection points
  for (const stepEl of childArray(sfcEl, 'step')) {
    const stepId = `sfc-step-${attr(stepEl, 'localId')}`;
    for (const conn of childArray(child(stepEl, 'connectionPointOut'), 'connection')) {
      const toId = attr(conn, 'refLocalId');
      if (toId) {
        links.push({
          id: `link-${stepId}-${toId}`,
          from: stepId,
          to: `sfc-trans-${toId}`,
          type: 'simple',
        });
      }
    }
  }
  for (const transEl of childArray(sfcEl, 'transition')) {
    const transId = `sfc-trans-${attr(transEl, 'localId')}`;
    for (const conn of childArray(child(transEl, 'connectionPointOut'), 'connection')) {
      const toId = attr(conn, 'refLocalId');
      if (toId) {
        links.push({
          id: `link-${transId}-${toId}`,
          from: transId,
          to: `sfc-step-${toId}`,
          type: 'simple',
        });
      }
    }
  }

  // Simultaneous divergence/convergence (AND-split/join)
  for (const divEl of childArray(sfcEl, 'simultaneousDivergence')) {
    const divId = attr(divEl, 'localId');
    // connectionPointIn: where the divergence receives from
    const cpIn = child(divEl, 'connectionPointIn');
    if (cpIn) {
      for (const conn of childArray(cpIn, 'connection')) {
        const refId = attr(conn, 'refLocalId');
        if (refId) {
          links.push({ id: `link-${refId}-simDiv-${divId}`, from: `sfc-trans-${refId}`, to: `sfc-simDiv-${divId}`, type: 'simultaneous-divergence' });
        }
      }
    }
    // connectionPointOut: branches going to steps/transitions
    for (const cpOut of childArray(divEl, 'connectionPointOut')) {
      for (const conn of childArray(cpOut, 'connection')) {
        const refId = attr(conn, 'refLocalId');
        if (refId) {
          links.push({ id: `link-simDiv-${divId}-${refId}`, from: `sfc-simDiv-${divId}`, to: `sfc-step-${refId}`, type: 'simultaneous-divergence' });
        }
      }
    }
  }

  for (const convEl of childArray(sfcEl, 'simultaneousConvergence')) {
    const convId = attr(convEl, 'localId');
    for (const cpIn of childArray(convEl, 'connectionPointIn')) {
      for (const conn of childArray(cpIn, 'connection')) {
        const refId = attr(conn, 'refLocalId');
        if (refId) {
          links.push({ id: `link-${refId}-simConv-${convId}`, from: `sfc-trans-${refId}`, to: `sfc-simConv-${convId}`, type: 'simultaneous-convergence' });
        }
      }
    }
    for (const cpOut of childArray(convEl, 'connectionPointOut')) {
      for (const conn of childArray(cpOut, 'connection')) {
        const refId = attr(conn, 'refLocalId');
        if (refId) {
          links.push({ id: `link-simConv-${convId}-${refId}`, from: `sfc-simConv-${convId}`, to: `sfc-step-${refId}`, type: 'simultaneous-convergence' });
        }
      }
    }
  }

  // Selection divergence/convergence (OR-split/join)
  for (const divEl of childArray(sfcEl, 'selectionDivergence')) {
    const divId = attr(divEl, 'localId');
    const cpIn = child(divEl, 'connectionPointIn');
    if (cpIn) {
      for (const conn of childArray(cpIn, 'connection')) {
        const refId = attr(conn, 'refLocalId');
        if (refId) {
          links.push({ id: `link-${refId}-selDiv-${divId}`, from: `sfc-step-${refId}`, to: `sfc-selDiv-${divId}`, type: 'selection-divergence' });
        }
      }
    }
    for (const cpOut of childArray(divEl, 'connectionPointOut')) {
      for (const conn of childArray(cpOut, 'connection')) {
        const refId = attr(conn, 'refLocalId');
        if (refId) {
          links.push({ id: `link-selDiv-${divId}-${refId}`, from: `sfc-selDiv-${divId}`, to: `sfc-trans-${refId}`, type: 'selection-divergence' });
        }
      }
    }
  }

  for (const convEl of childArray(sfcEl, 'selectionConvergence')) {
    const convId = attr(convEl, 'localId');
    for (const cpIn of childArray(convEl, 'connectionPointIn')) {
      for (const conn of childArray(cpIn, 'connection')) {
        const refId = attr(conn, 'refLocalId');
        if (refId) {
          links.push({ id: `link-${refId}-selConv-${convId}`, from: `sfc-trans-${refId}`, to: `sfc-selConv-${convId}`, type: 'selection-convergence' });
        }
      }
    }
    for (const cpOut of childArray(convEl, 'connectionPointOut')) {
      for (const conn of childArray(cpOut, 'connection')) {
        const refId = attr(conn, 'refLocalId');
        if (refId) {
          links.push({ id: `link-selConv-${convId}-${refId}`, from: `sfc-selConv-${convId}`, to: `sfc-step-${refId}`, type: 'selection-convergence' });
        }
      }
    }
  }

  // Parse jumpStep elements
  for (const jumpEl of childArray(sfcEl, 'jumpStep')) {
    const localId = attr(jumpEl, 'localId');
    const targetName = attr(jumpEl, 'targetName') || '';
    const posEl = child(jumpEl, 'position');
    jumps.push({
      id: `sfc-jump-${localId}`,
      targetStepName: targetName,
      position: { x: Number(attr(posEl, 'x')) || 0, y: Number(attr(posEl, 'y')) || 0 },
    });
    // Wire incoming connections to the jumpStep
    const cpIn = child(jumpEl, 'connectionPointIn');
    if (cpIn) {
      for (const conn of childArray(cpIn, 'connection')) {
        const refId = attr(conn, 'refLocalId');
        if (refId) {
          links.push({
            id: `link-${refId}-jump-${localId}`,
            from: `sfc-trans-${refId}`,
            to: `sfc-jump-${localId}`,
            type: 'simple',
          });
        }
      }
    }
  }

  // Build branches from link topology
  const branches: SFCBranch[] = [];
  const convBarIds = new Set(links.flatMap(l => [l.from, l.to]).filter(id => /^sfc-(simConv|selConv)-/.test(id)));

  for (const link of links) {
    if (!link.type.includes('divergence')) continue;
    const divBarId = link.to;
    if (!divBarId.match(/^sfc-(simDiv|selDiv)-/)) continue;

    const isSimultaneous = divBarId.startsWith('sfc-simDiv-');
    const matchingConvPrefix = isSimultaneous ? 'sfc-simConv-' : 'sfc-selConv-';

    const upstreamIds = links.filter(l => l.to === divBarId).map(l => l.from);
    const branchHeadIds = links.filter(l => l.from === divBarId).map(l => l.to);

    const branchStepArrays: string[][] = branchHeadIds.map(headId => {
      const chain: string[] = [];
      let cur = headId;
      for (let depth = 0; depth < 20; depth++) {
        chain.push(cur);
        const next = links.find(l => l.from === cur && l.type === 'simple');
        if (!next) break;
        cur = next.to;
        if ([...convBarIds].some(cbId => next.to === cbId)) break;
      }
      return chain.filter(id => id.startsWith('sfc-step-'));
    });

    const convBarId = [...convBarIds].find(cbId => cbId.startsWith(matchingConvPrefix)) ?? '';
    const downstreamIds = links.filter(l => l.from === convBarId).map(l => l.to);

    if (!branches.find(b => b.id === `branch-${divBarId}`)) {
      branches.push({
        id: `branch-${divBarId}`,
        type: isSimultaneous ? 'AND' : 'OR',
        divergingFromTransId: upstreamIds[0] || '',
        branchStepIds: branchStepArrays,
        convergingToTransId: downstreamIds[0] || '',
      });
    }
  }

  return { steps, transitions, links, branches, jumps };
}

function parseActions(stepEl: unknown, unmapped: UnmappedElement[]): SFCAction[] {
  const actions: SFCAction[] = [];
  const qualifiers: ActionQualifier[] = ['N','S','R','P','P1','P0','L','D','SD','DS','SL'];
  for (const actionEl of childArray(stepEl, 'actionBlock').flatMap(ab => childArray(ab, 'action'))) {
    const qual = attr(actionEl, 'qualifier') as ActionQualifier;
    const refEl = child(actionEl, 'reference');
    const tagName = attr(refEl, 'name') || attr(actionEl, 'name');
    if (!tagName) continue;
    actions.push({
      id: `action-${tagName}-${qual}`,
      qualifier: qualifiers.includes(qual) ? qual : 'N',
      tag: { name: tagName, dataType: 'BOOL' },
      duration: attr(actionEl, 'duration') || undefined,
    });
  }
  return actions;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function exportPLCopen(project: NormalizedProject): ExportResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const pousXml = project.pous.map(pou => buildPOUXml(pou, warnings));

  const globalVarsXml = project.globalTags.length > 0 ? {
    configuration: {
      '@_name': 'Config0',
      globalVars: {
        '@_name': 'GVL',
        variable: project.globalTags.map(tagToVarXml),
      },
    },
  } : {};

  const obj = {
    project: {
      '@_xmlns': 'http://www.plcopen.org/xml/tc6_0201',
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      '@_xmlns:xhtml': 'http://www.w3.org/1999/xhtml',
      '@_xsi:schemaLocation': 'http://www.plcopen.org/xml/tc6_0201 http://www.plcopen.org/xml/tc6_0201/tc6_xml_v201.xsd',
      fileHeader: {
        '@_companyName': 'Plaxio',
        '@_productName': 'Plaxio',
        '@_productVersion': '1.0',
        '@_creationDateTime': new Date().toISOString(),
      },
      contentHeader: {
        '@_name': project.projectName,
        '@_version': '1.0.0',
        coordinateInfo: {
          fbd: { scaling: { '@_x': '1', '@_y': '1' } },
          ld:  { scaling: { '@_x': '1', '@_y': '1' } },
          sfc: { scaling: { '@_x': '1', '@_y': '1' } },
        },
      },
      types: { pous: { pou: pousXml } },
      instances: globalVarsXml,
    },
  };

  return { ok: true, xmlContent: buildXML(obj), errors, warnings };
}

function buildPOUXml(pou: NormalizedPOU, warnings: string[]): Record<string, unknown> {
  const returnTypeTag = pou.localTags.find(t => t.name === '__returnType__');
  const interfaceVars = pou.localTags.filter(t => t.name !== '__returnType__').map(tagToVarXml);
  const bodyContent = buildBodyXml(pou, warnings);

  const iface: Record<string, unknown> = {
    localVars: { variable: interfaceVars },
  };
  if (returnTypeTag) {
    iface.returnType = { [returnTypeTag.dataType]: {} };
  }

  return {
    '@_name': pou.name,
    '@_pouType': pou.pouType || (pou.language === 'FBD' || pou.language === 'SFC' ? 'functionBlock' : 'program'),
    interface: iface,
    body: bodyContent,
  };
}

function buildBodyXml(pou: NormalizedPOU, warnings: string[]): Record<string, unknown> {
  if (pou.language === 'LD' && pou.ladderProgram) {
    return { LD: buildLDXml(pou.ladderProgram) };
  }
  if (pou.language === 'FBD' && pou.fbdProgram) {
    return { FBD: buildFBDXml(pou.fbdProgram) };
  }
  if (pou.language === 'SFC' && pou.sfcProgram) {
    return { SFC: buildSFCXml(pou.sfcProgram) };
  }
  if (pou.language === 'ST' && pou.stSource) {
    const lines = pou.stSource.split('\n');
    return { ST: { 'xhtml:p': lines.length === 1 ? lines[0] : lines } };
  }
  warnings.push(`POU "${pou.name}": no program data — empty body`);
  return { ST: { 'xhtml:p': '(* empty *)' } };
}

function buildLDXml(ladder: LadderProgram): Record<string, unknown> {
  return {
    rung: ladder.rungs.map((rung, ri) => ({
      '@_localId': String(ri + 1),
      comment: rung.comment || undefined,
      ...buildRungElementsXml(rung),
    })),
  };
}

function buildRungElementsXml(rung: Rung): Record<string, unknown[]> {
  const contacts: unknown[] = [];
  const coils: unknown[] = [];
  const blocks: unknown[] = [];
  // leftPowerRail gets localId=1; elements start at 2
  let id = 2;
  const leftRailLocalId = 1;

  function emitElement(el: LadderElement, prevRefId: number): number {
    const localId = id++;
    if (el.kind === 'contact') {
      const c = el as ContactElement;
      const obj: Record<string, unknown> = {
        '@_localId': String(localId),
        '@_negated': c.type === 'NC' ? 'true' : 'false',
        '@_edge': c.type === 'P_CONTACT' ? 'rising' : c.type === 'N_CONTACT' ? 'falling' : undefined,
        variable: c.tag.name,
        position: { '@_x': el.position?.x ?? 0, '@_y': el.position?.y ?? 0 },
        connectionPointIn: { connection: { '@_refLocalId': String(prevRefId) } },
        connectionPointOut: { relPosition: { '@_x': '0', '@_y': '0' } },
      };
      contacts.push(obj);
    } else if (el.kind === 'coil') {
      const c = el as CoilElement;
      const storage = c.type === 'set' ? 'set' : c.type === 'reset' ? 'reset' : c.type === 'latch' ? 'retentive' : undefined;
      const edge = (c.type as string) === 'positive_transition' ? 'rising' : (c.type as string) === 'negative_transition' ? 'falling' : undefined;
      const obj: Record<string, unknown> = {
        '@_localId': String(localId),
        '@_negated': c.type === 'negated' ? 'true' : 'false',
        '@_storage': storage,
        '@_edge': edge,
        variable: c.tag.name,
        position: { '@_x': el.position?.x ?? 0, '@_y': el.position?.y ?? 0 },
        connectionPointIn: { connection: { '@_refLocalId': String(prevRefId) } },
      };
      coils.push(obj);
    } else if (el.kind === 'block') {
      const b = el as BlockElement;
      const fbTypeMap: Record<string, string> = { TON:'TON',TOF:'TOF',TP:'TP',CTU:'CTU',CTD:'CTD',CTUD:'CTUD',SR:'SR',RS:'RS',RTRIG:'R_TRIG',FTRIG:'F_TRIG' };
      // Build inputVariables / outputVariables from pins
      const inputVars = Object.entries(b.pins || {})
        .filter(([pinName]) => !['OUT','Q','Q1','CV','ET'].includes(pinName))
        .map(([pinName, tagRef]) => ({
          variable: {
            '@_formalParameter': pinName,
            '@_negated': 'false',
            connectionPointIn: { connection: { '@_refLocalId': String(prevRefId) } },
          },
        }));
      const outputVars = Object.entries(b.pins || {})
        .filter(([pinName]) => ['OUT','Q','Q1','CV','ET'].includes(pinName))
        .map(([pinName, tagRef]) => ({
          variable: {
            '@_formalParameter': pinName,
            '@_negated': 'false',
            connectionPointOut: { relPosition: { '@_x': '0', '@_y': '0' } },
          },
        }));
      const obj: Record<string, unknown> = {
        '@_localId': String(localId),
        '@_typeName': fbTypeMap[b.fbType] || b.fbType,
        '@_instanceName': b.instanceName,
        position: { '@_x': el.position?.x ?? 0, '@_y': el.position?.y ?? 0 },
        inputVariables: inputVars.length ? { variable: inputVars.map(iv => iv.variable) } : undefined,
        outputVariables: outputVars.length ? { variable: outputVars.map(ov => ov.variable) } : undefined,
        inOutVariables: {},
      };
      blocks.push(obj);
    }
    return localId;
  }

  // Emit main elements in series starting from leftRail
  let prevId: number = leftRailLocalId;
  for (const el of rung.elements) {
    prevId = emitElement(el, prevId);
  }

  // Emit branch elements — each branch starts from the left rail
  if (rung.branches && rung.branches.length > 0) {
    for (const branch of rung.branches) {
      let branchPrev: number = leftRailLocalId;
      for (const el of branch.elements) {
        branchPrev = emitElement(el, branchPrev);
      }
    }
  }

  const leftRail: unknown = {
    '@_localId': String(leftRailLocalId),
    '@_width': '10',
    position: { '@_x': 0, '@_y': 0 },
    connectionPointOut: { connection: [] },
  };

  // rightPowerRail gets the next localId; it connects from the last emitted coil (prevId)
  const rightRailLocalId = id++;
  const rightRail: unknown = {
    '@_localId': String(rightRailLocalId),
    '@_width': '10',
    position: { '@_x': 0, '@_y': 0 },
    connectionPointIn: { connection: { '@_refLocalId': String(prevId) } },
  };

  const result: Record<string, unknown[]> = {};
  result.leftPowerRail = [leftRail];
  if (contacts.length) result.contact = contacts;
  if (coils.length) result.coil = coils;
  if (blocks.length) result.block = blocks;
  result.rightPowerRail = [rightRail];
  return result;
}

// Strip import-time prefixes so re-exported localIds are clean integers
function cleanLocalId(id: string): string {
  return id.replace(/^(fbd-var-|fbd-block-|fbd-|st-fbd-var-|st-fbd-)/, '');
}

function buildFBDXml(fbd: FBDProgram): Record<string, unknown> {
  // Build a wire lookup: target nodeId+pin → source nodeId+pin
  const wiresByTarget = new Map<string, { refLocalId: string; formalParameter: string }[]>();
  for (const w of fbd.wires) {
    const key = `${w.to.nodeId}::${w.to.pin}`;
    if (!wiresByTarget.has(key)) wiresByTarget.set(key, []);
    wiresByTarget.get(key)!.push({ refLocalId: w.from.nodeId, formalParameter: w.from.pin });
  }

  const blocks = fbd.nodes
    .filter(n => n.type !== 'IN_VARIABLE' && n.type !== 'OUT_VARIABLE' && n.type !== 'IN_OUT_VARIABLE'
      && n.type !== 'LABEL' && n.type !== 'JUMP' && n.type !== 'RETURN'
      && n.type !== 'CONNECTOR' && n.type !== 'CONTINUATION')
    .map(n => {
      const inputVariables = (n.inputs || []).map(pin => {
        const conns = wiresByTarget.get(`${n.id}::${pin.name}`) || [];
        return {
          variable: {
            '@_formalParameter': pin.name,
            '@_negated': pin.negated ? 'true' : 'false',
            ...(conns.length > 0 ? {
              connectionPointIn: {
                connection: conns.map(c => ({
                  '@_refLocalId': c.refLocalId,
                  '@_formalParameter': c.formalParameter,
                })),
              },
            } : {}),
          },
        };
      });

      const outputVariables = (n.outputs || []).map(pin => ({
        variable: {
          '@_formalParameter': pin.name,
          '@_negated': pin.negated ? 'true' : 'false',
          connectionPointOut: { relPosition: { '@_x': '0', '@_y': '0' } },
        },
      }));

      return {
        '@_localId': cleanLocalId(n.id),
        '@_typeName': n.type,
        '@_instanceName': n.instanceName || cleanLocalId(n.id),
        '@_executionOrderId': (n as any).executionOrderId != null ? String((n as any).executionOrderId) : undefined,
        position: { '@_x': n.position.x, '@_y': n.position.y },
        inputVariables: inputVariables.length ? { variable: inputVariables.map(iv => iv.variable) } : undefined,
        outputVariables: outputVariables.length ? { variable: outputVariables.map(ov => ov.variable) } : undefined,
        inOutVariables: {},
      };
    });

  const inVars = fbd.nodes
    .filter(n => n.type === 'IN_VARIABLE')
    .map(n => ({
      '@_localId': cleanLocalId(n.id),
      '@_negated': (n.negated === true) ? 'true' : 'false',
      position: { '@_x': n.position.x, '@_y': n.position.y },
      expression: n.tag?.name || '',
      connectionPointOut: { relPosition: { '@_x': '0', '@_y': '0' } },
    }));

  const outVars = fbd.nodes
    .filter(n => n.type === 'OUT_VARIABLE')
    .map(n => {
      const conns = wiresByTarget.get(`${n.id}::IN`) || [];
      return {
        '@_localId': cleanLocalId(n.id),
        '@_negated': (n.negated === true) ? 'true' : 'false',
        position: { '@_x': n.position.x, '@_y': n.position.y },
        expression: n.tag?.name || '',
        ...(conns.length > 0 ? {
          connectionPointIn: {
            connection: conns.map(c => ({
              '@_refLocalId': c.refLocalId,
              '@_formalParameter': c.formalParameter,
            })),
          },
        } : {}),
      };
    });

  // inOutVariable export
  const inOutVars = fbd.nodes
    .filter(n => n.type === 'IN_OUT_VARIABLE')
    .map(n => {
      const conns = wiresByTarget.get(`${n.id}::IN`) || [];
      return {
        '@_localId': cleanLocalId(n.id),
        '@_negated': 'false',
        position: { '@_x': n.position.x, '@_y': n.position.y },
        expression: n.tag?.name || '',
        ...(conns.length > 0 ? {
          connectionPointIn: {
            connection: conns.map(c => ({ '@_refLocalId': c.refLocalId, '@_formalParameter': c.formalParameter })),
          },
        } : {}),
        connectionPointOut: { relPosition: { '@_x': '0', '@_y': '0' } },
      };
    });

  // label export
  const labels = fbd.nodes.filter(n => n.type === 'LABEL' as any).map(n => {
    const conns = wiresByTarget.get(`${n.id}::IN`) || [];
    return {
      '@_localId': cleanLocalId(n.id),
      '@_label': n.instanceName || '',
      position: { '@_x': n.position.x, '@_y': n.position.y },
      ...(conns.length > 0 ? { connectionPointIn: { connection: conns.map(c => ({ '@_refLocalId': c.refLocalId, '@_formalParameter': c.formalParameter })) } } : {}),
    };
  });

  // jump export
  const jumps = fbd.nodes.filter(n => n.type === 'JUMP' as any).map(n => {
    const conns = wiresByTarget.get(`${n.id}::IN`) || [];
    return {
      '@_localId': cleanLocalId(n.id),
      '@_label': n.instanceName || '',
      position: { '@_x': n.position.x, '@_y': n.position.y },
      ...(conns.length > 0 ? { connectionPointIn: { connection: conns.map(c => ({ '@_refLocalId': c.refLocalId, '@_formalParameter': c.formalParameter })) } } : {}),
    };
  });

  // return export
  const returns = fbd.nodes.filter(n => n.type === 'RETURN' as any).map(n => {
    const conns = wiresByTarget.get(`${n.id}::IN`) || [];
    return {
      '@_localId': cleanLocalId(n.id),
      position: { '@_x': n.position.x, '@_y': n.position.y },
      ...(conns.length > 0 ? { connectionPointIn: { connection: conns.map(c => ({ '@_refLocalId': c.refLocalId, '@_formalParameter': c.formalParameter })) } } : {}),
    };
  });

  // connector export
  const connectors = fbd.nodes.filter(n => n.type === 'CONNECTOR' as any).map(n => {
    const conns = wiresByTarget.get(`${n.id}::IN`) || [];
    return {
      '@_localId': cleanLocalId(n.id),
      '@_name': n.instanceName || '',
      position: { '@_x': n.position.x, '@_y': n.position.y },
      ...(conns.length > 0 ? { connectionPointIn: { connection: conns.map(c => ({ '@_refLocalId': c.refLocalId, '@_formalParameter': c.formalParameter })) } } : {}),
    };
  });

  // continuation export
  const continuations = fbd.nodes.filter(n => n.type === 'CONTINUATION' as any).map(n => ({
    '@_localId': cleanLocalId(n.id),
    '@_name': n.instanceName || '',
    position: { '@_x': n.position.x, '@_y': n.position.y },
    connectionPointOut: { relPosition: { '@_x': '0', '@_y': '0' } },
  }));

  const result: Record<string, unknown> = {};
  if (blocks.length) result.block = blocks;
  if (inVars.length) result.inVariable = inVars;
  if (outVars.length) result.outVariable = outVars;
  if (inOutVars.length) result.inOutVariable = inOutVars;
  if (labels.length) result.label = labels;
  if (jumps.length) result.jump = jumps;
  if (returns.length) result['return'] = returns;
  if (connectors.length) result.connector = connectors;
  if (continuations.length) result.continuation = continuations;
  return result;
}

function buildSFCXml(sfc: SFCProgram): Record<string, unknown> {
  // Build link lookup: from → [to]
  const outLinks = new Map<string, string[]>();
  const inLinks = new Map<string, string[]>();
  for (const link of sfc.links) {
    if (!outLinks.has(link.from)) outLinks.set(link.from, []);
    outLinks.get(link.from)!.push(link.to);
    if (!inLinks.has(link.to)) inLinks.set(link.to, []);
    inLinks.get(link.to)!.push(link.from);
  }

  // Build integer localId map for all node IDs (TC6 requires positive integers)
  const localIdMap = new Map<string, number>();
  let localIdCounter = 1;
  const allIds = [
    ...sfc.steps.map(s => s.id),
    ...sfc.transitions.map(t => t.id),
    // divergence/convergence nodes from links
    ...sfc.links
      .map(l => [l.from, l.to])
      .flat()
      .filter(id => /^sfc-(simDiv|simConv|selDiv|selConv)-/.test(id)),
  ];
  for (const id of allIds) {
    if (!localIdMap.has(id)) localIdMap.set(id, localIdCounter++);
  }
  const lid = (id: string): string => String(localIdMap.get(id) ?? id);

  const steps = sfc.steps.map(s => {
    const targets = (outLinks.get(s.id) || []);
    const sources = (inLinks.get(s.id) || []);

    const result: Record<string, unknown> = {
      '@_localId': lid(s.id),
      '@_name': s.name,
      '@_initialStep': String(s.isInitial),
      position: { '@_x': s.position.x, '@_y': s.position.y },
    };

    // connectionPointIn from incoming transitions
    if (sources.length > 0) {
      result.connectionPointIn = {
        connection: sources.map(src => ({ '@_refLocalId': lid(src) })),
      };
    }

    // connectionPointOut to outgoing transitions
    if (targets.length > 0) {
      result.connectionPointOut = {
        connection: targets.map(tgt => ({ '@_refLocalId': lid(tgt) })),
      };
    }

    // Steps that have actions get connectionPointOutAction
    if (s.actions.length > 0) {
      result.connectionPointOutAction = { '@_formalParameter': 'x' };
    }

    return result;
  });

  const transitions = sfc.transitions.map(t => {
    const targets = outLinks.get(t.id) || [];
    const sources = inLinks.get(t.id) || [];

    const result: Record<string, unknown> = {
      '@_localId': lid(t.id),
      '@_priority': (t as any).priority != null ? String((t as any).priority) : undefined,
      position: { '@_x': t.position.x, '@_y': t.position.y },
      condition: { ST: { 'xhtml:p': t.condition } },
    };

    if (sources.length > 0) {
      result.connectionPointIn = {
        connection: sources.map(src => ({ '@_refLocalId': lid(src) })),
      };
    }
    if (targets.length > 0) {
      result.connectionPointOut = {
        connection: targets.map(tgt => ({ '@_refLocalId': lid(tgt) })),
      };
    }

    return result;
  });

  // Emit divergence/convergence elements from links with special types
  const simultaneousDivergences: Record<string, unknown>[] = [];
  const simultaneousConvergences: Record<string, unknown>[] = [];
  const selectionDivergences: Record<string, unknown>[] = [];
  const selectionConvergences: Record<string, unknown>[] = [];

  const divIds = new Set<string>();
  for (const link of sfc.links) {
    if (link.type === 'simultaneous-divergence' || link.type === 'simultaneous-convergence' ||
        link.type === 'selection-divergence' || link.type === 'selection-convergence') {
      // Extract the divergence/convergence node id from link from/to
      const divMatch = link.from.match(/^sfc-(simDiv|simConv|selDiv|selConv)-(.+)$/);
      const convMatch = link.to.match(/^sfc-(simDiv|simConv|selDiv|selConv)-(.+)$/);
      const nodeId = divMatch ? link.from : convMatch ? link.to : null;
      if (nodeId && !divIds.has(nodeId)) {
        divIds.add(nodeId);
        const sources = inLinks.get(nodeId) || [];
        const targets = outLinks.get(nodeId) || [];
        const isConvergence = nodeId.includes('Conv');
        const el: Record<string, unknown> = {
          '@_localId': lid(nodeId),
          // Convergence: one connectionPointIn per source; divergence: single connectionPointIn with all sources
          ...(sources.length > 0
            ? isConvergence
              ? { connectionPointIn: sources.map(s => ({ connection: { '@_refLocalId': lid(s) } })) }
              : { connectionPointIn: { connection: sources.map(s => ({ '@_refLocalId': lid(s) })) } }
            : {}),
          ...(targets.length > 0 ? { connectionPointOut: targets.map((t, i) => ({ '@_formalParameter': String(i), connection: { '@_refLocalId': lid(t) } })) } : {}),
        };
        if (link.type === 'simultaneous-divergence') simultaneousDivergences.push(el);
        else if (link.type === 'simultaneous-convergence') simultaneousConvergences.push(el);
        else if (link.type === 'selection-divergence') selectionDivergences.push(el);
        else if (link.type === 'selection-convergence') selectionConvergences.push(el);
      }
    }
  }

  // Build jump elements
  const jumpSteps: Record<string, unknown>[] = [];
  for (const jump of (sfc.jumps ?? [])) {
    jumpSteps.push({
      '@_localId': String(localIdCounter++),
      '@_targetName': jump.targetStepName,
      position: { '@_x': jump.position?.x || 0, '@_y': jump.position?.y || 0 },
      connectionPointIn: {},
    });
  }

  const result: Record<string, unknown> = {
    step: steps.length ? steps : undefined,
    transition: transitions.length ? transitions : undefined,
  };
  if (simultaneousDivergences.length) result.simultaneousDivergence = simultaneousDivergences;
  if (simultaneousConvergences.length) result.simultaneousConvergence = simultaneousConvergences;
  if (selectionDivergences.length) result.selectionDivergence = selectionDivergences;
  if (selectionConvergences.length) result.selectionConvergence = selectionConvergences;
  if (jumpSteps.length) result.jumpStep = jumpSteps;

  // Emit actionBlocks as siblings of steps (Bug 9)
  const actionBlocks: Record<string, unknown>[] = [];
  for (const s of sfc.steps) {
    if (s.actions.length > 0) {
      actionBlocks.push({
        '@_localId': String(localIdCounter++),
        connectionPointIn: { connection: { '@_refLocalId': lid(s.id) } },
        action: s.actions.map(a => ({
          '@_qualifier': a.qualifier,
          '@_duration': a.duration || undefined,
          reference: { '@_name': a.tag.name },
        })),
      });
    }
  }
  if (actionBlocks.length) result.actionBlock = actionBlocks;

  return result;
}

function tagToVarXml(tag: NormalizedTag): Record<string, unknown> {
  return {
    '@_name': tag.name,
    '@_address': tag.address || undefined,
    type: { [tag.dataType]: {} },
    initialValue: tag.initialValue ? { simpleValue: { '@_value': tag.initialValue } } : undefined,
    documentation: tag.description || undefined,
  };
}
