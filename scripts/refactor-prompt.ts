#!/usr/bin/env ts-node
/**
 * Refactoring script for conditional PLC prompt assembly
 * Run this to apply the changes to both src/ and out/ files
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');

// Read original src/prompts.ts
const srcPromptsPath = path.join(ROOT, 'src/vs/workbench/contrib/void/common/prompt/prompts.ts');
let srcContent = fs.readFileSync(srcPromptsPath, 'utf-8');

// Find the plcPrompt variable (starts at line ~539, ends at line ~1968)
const plcPromptStart = srcContent.indexOf('const plcPrompt = `');
const plcPromptEnd = srcContent.indexOf('═══════════════════════════════════════════════════════`', plcPromptStart + 1000) + '═══════════════════════════════════════════════════════`'.length;

const originalPlcPrompt = srcContent.substring(plcPromptStart, plcPromptEnd);

// Extract the content inside the template literal
const plcPromptContentStart = plcPromptStart + 'const plcPrompt = `'.length;
const plcPromptContent = srcContent.substring(plcPromptContentStart, plcPromptEnd - 1); // -1 to exclude closing `

// Now split into sections (line numbers are approximate markers in the content)
// We'll use string markers to split

const sections = {
  base: extractSection(plcPromptContent, 0, 'IEC 61131-3 SAFETY RULES'),
  safety: extractSection(plcPromptContent, 'IEC 61131-3 SAFETY RULES', 'STRUCTURED TEXT (ST)'),
  st: extractSection(plcPromptContent, 'STRUCTURED TEXT (ST)', '.ld.json — EXACT SCHEMA'),
  ld: extractSection(plcPromptContent, '.ld.json — EXACT SCHEMA', '.fbd.json — EXACT SCHEMA'),
  fbd: extractSection(plcPromptContent, '.fbd.json — EXACT SCHEMA', '.sfc.json — EXACT SCHEMA'),
  sfc: extractSection(plcPromptContent, '.sfc.json — EXACT SCHEMA', 'PLC TOOL WORKFLOW'),
  workflow: extractSection(plcPromptContent, 'PLC TOOL WORKFLOW', 'QUALITY CHECKLIST'),
  quality: extractSection(plcPromptContent, 'QUALITY CHECKLIST', 'FULL AUTO-IMPORT WORKFLOW'),
  autoImport: extractSection(plcPromptContent, 'FULL AUTO-IMPORT WORKFLOW', 'Plaxio Simulator'),
  fuxa: extractSection(plcPromptContent, 'Plaxio Simulator', null),
};

function extractSection(content: string, startMarker: string | number, endMarker: string | null): string {
  const start = typeof startMarker === 'number' ? startMarker : content.indexOf(startMarker);
  if (start === -1) throw new Error(`Start marker not found: ${startMarker}`);

  if (endMarker === null) {
    return content.substring(start).trim();
  }

  const end = content.indexOf(endMarker, start + 1);
  if (end === -1) throw new Error(`End marker not found: ${endMarker}`);

  return content.substring(start, end).trim();
}

// Build the new constants
const newConstants = `
// Helper function to extract file extension from URI path
const extractExtension = (uriPath: string | undefined): string | undefined => {
	if (!uriPath) return undefined;
	const match = uriPath.match(/(\.[^/.]+)$/);
	return match ? match[1] : undefined;
};

// Split the monolithic plcPrompt into named sections
const plcBaseInstructions = \`${sections.base}\`;

const plcSafetyRules = \`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${sections.safety}\`;

const plcStRules = \`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${sections.st}\`;

const plcLdSchema = \`
═══════════════════════════════════════════════════════
${sections.ld}
═══════════════════════════════════════════════════════\`;

const plcFbdSchema = \`
═══════════════════════════════════════════════════════
${sections.fbd}
═══════════════════════════════════════════════════════\`;

const plcSfcSchema = \`
═══════════════════════════════════════════════════════
${sections.sfc}
═══════════════════════════════════════════════════════\`;

const plcToolWorkflow = \`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${sections.workflow}\`;

const plcQualityChecklist = \`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${sections.quality}\`;

const plcAutoImportWorkflow = \`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${sections.autoImport}\`;

const plcFuxaHmiBlock = \`
═══════════════════════════════════════════════════════
${sections.fuxa}
═══════════════════════════════════════════════════════\`;

// Conditional prompt builder
export function buildConditionalPlcPrompt(context: {
	activeFileExtension?: string;
	userMessage?: string;
	chatMode: string;
}): string {
	const sections: string[] = [];

	// Always include
	sections.push(plcBaseInstructions, plcSafetyRules, plcToolWorkflow);

	const ext = context.activeFileExtension?.toLowerCase();
	const msg = context.userMessage?.toLowerCase() || '';

	// LD
	if (ext === '.ld.json' || msg.includes('ladder') || msg.includes('ld')) {
		sections.push(plcLdSchema, plcQualityChecklist);
	}

	// FBD
	if (ext === '.fbd.json' || msg.includes('fbd') || msg.includes('function block')) {
		sections.push(plcFbdSchema, plcQualityChecklist);
	}

	// SFC
	if (ext === '.sfc.json' || msg.includes('sfc') || msg.includes('sequential')) {
		sections.push(plcSfcSchema, plcQualityChecklist);
	}

	// ST
	if (ext === '.st' || msg.includes('structured text') || msg.includes('st program')) {
		sections.push(plcStRules);
	}

	// Import
	if (msg.includes('import') || msg.includes('vendor') || msg.includes('l5x') ||
			msg.includes('simatic') || msg.includes('upload') || msg.match(/attach(ed|ment)?/)) {
		sections.push(plcAutoImportWorkflow);
	}

	// Simulation
	if (msg.includes('simulation') || msg.includes('hmi') || msg.includes('fuxa') ||
			msg.includes('scada') || msg.includes('animate') || msg.includes('dashboard') ||
			msg.includes('view')) {
		sections.push(plcFuxaHmiBlock);
	}

	// General generation (all schemas)
	if (msg.includes('create') || msg.includes('generate') || msg.includes('new program') ||
			msg.includes('write a')) {
		if (!sections.includes(plcLdSchema)) sections.push(plcLdSchema);
		if (!sections.includes(plcFbdSchema)) sections.push(plcFbdSchema);
		if (!sections.includes(plcSfcSchema)) sections.push(plcSfcSchema);
		if (!sections.includes(plcQualityChecklist)) sections.push(plcQualityChecklist);
	}

	// Agent/gather mode always gets quality checklist
	if (context.chatMode === 'agent' || context.chatMode === 'gather') {
		if (!sections.includes(plcQualityChecklist)) sections.push(plcQualityChecklist);
	}

	return sections.join('\\n\\n');
}
`;

console.log('Refactoring script complete - sections extracted.');
console.log('You can now manually apply these changes or adjust the script to write the files.');
