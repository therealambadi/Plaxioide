/**
 * File processing utilities for chat attachments.
 * Handles PDF (text extraction), CSV/Excel (tag table parsing), and plain text.
 * No external dependencies — runs in the renderer.
 */

// ─── PDF ────────────────────────────────────────────────────────────────────

/**
 * Extract readable text from a PDF ArrayBuffer using the browser's built-in
 * PDF parsing primitives.  Falls back to a base64 blob for multimodal AI.
 */
export async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<string | null> {
	try {
		// VS Code bundles pdf.worker — try to load pdfjs via dynamic import
		// @ts-ignore — may not be available in all environments
		const pdfjsLib = await import('pdfjs-dist').catch(() => null);
		if (pdfjsLib) {
			const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
			const pdf = await loadingTask.promise;
			const pages: string[] = [];
			for (let i = 1; i <= pdf.numPages; i++) {
				const page = await pdf.getPage(i);
				const content = await page.getTextContent();
				pages.push(content.items.map((item: any) => item.str).join(' '));
			}
			return pages.join('\n\n');
		}
	} catch {
		// pdfjs not available — fall through
	}
	// Can't extract text — return null so caller sends as base64 to AI
	return null;
}

// ─── CSV ────────────────────────────────────────────────────────────────────

export interface ParsedTagRow {
	name: string;
	address: string;
	dataType: string;
	description: string;
	[key: string]: string;
}

/**
 * Parse CSV content into an array of tag rows.
 * Handles comma and semicolon delimiters, quoted fields.
 */
export function parseCSV(text: string): ParsedTagRow[] {
	const lines = text.split(/\r?\n/).filter(l => l.trim());
	if (lines.length < 2) return [];

	// Detect delimiter
	const delim = lines[0].includes(';') ? ';' : ',';

	const headers = splitCSVLine(lines[0], delim).map(h => h.trim().toLowerCase());
	const rows: ParsedTagRow[] = [];

	for (let i = 1; i < lines.length; i++) {
		const cells = splitCSVLine(lines[i], delim);
		const row: Record<string, string> = {};
		headers.forEach((h, idx) => { row[h] = (cells[idx] ?? '').trim(); });

		// Normalize common header names to canonical keys
		const name = row['name'] ?? row['tag name'] ?? row['tag'] ?? row['variable'] ?? '';
		const address = row['address'] ?? row['i/o address'] ?? row['io address'] ?? '';
		const dataType = row['data type'] ?? row['type'] ?? row['dtype'] ?? 'BOOL';
		const description = row['description'] ?? row['comment'] ?? row['desc'] ?? '';

		if (name) rows.push({ ...row, name, address, dataType, description });
	}
	return rows;
}

function splitCSVLine(line: string, delim: string): string[] {
	const cells: string[] = [];
	let current = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"') {
			inQuotes = !inQuotes;
		} else if (ch === delim && !inQuotes) {
			cells.push(current);
			current = '';
		} else {
			current += ch;
		}
	}
	cells.push(current);
	return cells;
}

// ─── AI context builders ─────────────────────────────────────────────────────

export function csvToAIContext(rows: ParsedTagRow[], filename: string): string {
	if (!rows.length) return `[Attached CSV: ${filename}]`;
	const header = `[Tag table from ${filename} — ${rows.length} tags]`;
	const table = rows
		.slice(0, 100) // cap at 100 rows to avoid token explosion
		.map(r => `  ${r.name} | ${r.address} | ${r.dataType} | ${r.description}`)
		.join('\n');
	const suffix = rows.length > 100 ? `\n  ... (${rows.length - 100} more rows truncated)` : '';
	return `${header}\nName | Address | Type | Description\n${table}${suffix}`;
}
