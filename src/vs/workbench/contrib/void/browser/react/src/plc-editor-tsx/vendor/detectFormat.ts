/*
 * Vendor Format Detection
 * Reads the first 4KB of a file to sniff root element / namespace.
 * Never guesses — returns null when ambiguous.
 */

import type { VendorFormat } from './types.js';

// Accepts either raw XML string content or a file path string (caller decides)
export function detectVendorFormat(xmlContent: string): VendorFormat | null {
  // Read only first 4KB for speed — root element is always near the top
  const head = xmlContent.slice(0, 4096);

  // Rockwell L5X: root element is <RSLogix5000Content
  if (/<RSLogix5000Content[\s>]/.test(head)) {
    return 'rockwell_l5x';
  }

  // PLCopen XML: namespace http://www.plcopen.org/xml/tc6_0201
  if (head.includes('http://www.plcopen.org/xml/tc6_0201') ||
      /<project[\s>]/.test(head) && head.includes('plcopen')) {
    return 'plcopen_xml';
  }

  // Siemens SimaticML: any Document with SW.* namespace elements
  if (head.includes('SW.Blocks.') || head.includes('SW.Tags.') ||
      head.includes('SW.CodeBlock') ||
      (head.includes('DocumentInfo') && head.includes('SW.')) ||
      head.includes('siemens.com/automation/Openness')) {
    return 'siemens_simatic_ml';
  }

  // Schneider XEF: check for XML tags specific to Unity/EcoStruxure exports
  if (/<ProjectFile[\s>]/.test(head) ||
      (head.includes('<?xml') && (head.includes('UnityPro') || head.includes('EcoStruxure'))) ||
      /<program[\s>]/i.test(head) && /<section[\s>]/i.test(head) && /<LD[\s>]/i.test(head)) {
    return 'schneider_xef';
  }

  // IEC 61131-3 ST: look for PROGRAM/FUNCTION_BLOCK + VAR/END_VAR pattern
  if (/\b(PROGRAM|FUNCTION_BLOCK|FUNCTION)\s+\w+/.test(head) &&
      /\bVAR\b/.test(head) && /\bEND_VAR\b/.test(head)) {
    return 'iec_st';
  }

  // Ambiguous — caller must prompt user
  return null;
}

// File extension hint — fast first pass (not authoritative alone)
export function guessFormatFromExtension(filename: string): VendorFormat | null {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'l5x': return 'rockwell_l5x';
    case 'xef':
    case 'zef': return 'schneider_xef';
    case 'st':
    case 'scl': return 'iec_st';
    default: return null;
  }
}

// Combined: extension hint first, then sniff content if available
export function detectFormat(filename: string, xmlContent?: string): VendorFormat | null {
  const byExtension = guessFormatFromExtension(filename);
  if (byExtension) return byExtension;
  if (xmlContent) {
    return detectVendorFormat(xmlContent);
  }
  return null;
}
