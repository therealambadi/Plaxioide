/*
 * XML Utility helpers — thin wrapper around fast-xml-parser.
 * All adapters import from here so the parser config stays consistent.
 */

import { XMLParser, XMLBuilder, type XmlBuilderOptions } from 'fast-xml-parser';

// ─── Parser (XML → JS object) ─────────────────────────────────────────────────

const PARSE_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  cdataPropName: '#cdata',
  allowBooleanAttributes: true,
  parseAttributeValue: false, // keep everything as string — adapters cast themselves
  trimValues: true,
  parseTagValue: false,
  isArray: (_name: string, _jpath: string, _isLeafNode: boolean, _isAttribute: boolean) => false,
};

export function parseXML(xmlString: string): Record<string, unknown> {
  const parser = new XMLParser(PARSE_OPTIONS);
  return parser.parse(xmlString) as Record<string, unknown>;
}

// ─── Builder (JS object → XML) ────────────────────────────────────────────────

const BUILD_OPTIONS: XmlBuilderOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  cdataPropName: '#cdata',
  format: true,
  indentBy: '  ',
  suppressBooleanAttributes: false,
};

export function buildXML(obj: Record<string, unknown>, declaration = true): string {
  const builder = new XMLBuilder(BUILD_OPTIONS);
  const xml = builder.build(obj) as string;
  return declaration ? `<?xml version="1.0" encoding="UTF-8"?>\n${xml}` : xml;
}

// ─── Safe attribute/text getters ─────────────────────────────────────────────

export function attr(node: unknown, name: string): string {
  if (node && typeof node === 'object') {
    return String((node as Record<string, unknown>)[`@_${name}`] ?? '');
  }
  return '';
}

export function text(node: unknown): string {
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    // Check both #text and #cdata (CDATA sections parsed into #cdata by fast-xml-parser)
    const val = obj['#text'] ?? obj['#cdata'] ?? '';
    // #cdata can be an array if multiple CDATA sections exist
    if (Array.isArray(val)) return val.join('');
    return String(val);
  }
  if (typeof node === 'string') return node;
  return '';
}

export function child(node: unknown, key: string): unknown {
  if (node && typeof node === 'object') {
    return (node as Record<string, unknown>)[key];
  }
  return undefined;
}

// Always return an array even if the XML parser gave us a single object
export function childArray(node: unknown, key: string): unknown[] {
  const c = child(node, key);
  if (c === undefined || c === null) return [];
  if (Array.isArray(c)) return c;
  return [c];
}
