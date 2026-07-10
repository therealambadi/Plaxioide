/**
 * CODESYS V3 .library file parser.
 *
 * Extracts POU source code from CODESYS V3 .library files (ZIP archives).
 *
 * Format overview (reverse-engineered, undocumented):
 * - ZIP archive containing GUID-named .meta/.object pairs + auxiliary files.
 * - String table: __shared_data_storage_string_table__.auxiliary
 *   All source text stored as sequential LEB128-indexed UTF-8 entries.
 *   Strings are added to the table in the order POUs are saved, so the
 *   indices for any single POU's lines tend to form a contiguous
 *   monotonically-increasing range. Common lines like "ELSE", "END_IF;",
 *   "" (empty), "*)" reuse low-varint shared entries — this matters
 *   because filtering rows by varint range would drop legitimate source
 *   that happens to use a shared string.
 * - Object files: UUID.object — per-POU binary with two sub-objects:
 *   1) Implementation (code body): records 1..boundary
 *   2) Declaration (header + VAR blocks + comment): records after boundary
 *   Records are varint tuples delimited by 8 zero bytes.
 *
 * Object file binary layout:
 *   [20-byte header: magic 02200928 + 12 zeros + uint32LE data length]
 *   [Record 0 — metadata, n=9: varint[5] = total impl line count]
 *   [Records 1..N-1 — thin impl rows, n=3: col 0 = line content]
 *   [Boundary record — fat row-packed overflow, holds remaining impl lines]
 *   [Header record — col 0 (or col 1 for n=4) = "FUNCTION_BLOCK X" / etc.]
 *   [Decl thin records — col 0 = decl line]
 *   [Final record — variable, no terminator]
 *
 * Boundary record (fat) row layout:
 *   The boundary record packs the trailing impl-section lines that didn't
 *   fit in thin records. Each "row" begins with the line-content varint at
 *   col 0, followed by 0+ non-zero metadata varints, followed by exactly
 *   7+ zero varints as padding. The next row's col 0 starts immediately
 *   after the zero run. We don't rely on a fixed stride: per-row width
 *   varies (observed 10 cols for short impls, 11 cols partway through long
 *   ones — the extra column appears once additional row metadata kicks in
 *   for the trailing comment block). A zero-run delimiter is the only
 *   reliable boundary, and the total row count is bounded by R0[5] minus
 *   the thin record count, which lets us stop before any post-impl junk.
 *
 * For very short impls (boundary record n in [4..16]), the boundary
 * record's col 0 is simply the last impl line (often "*)" closing a
 * trailing block comment) and the row detector terminates after one row.
 *
 * Folder hierarchy:
 *   The ZIP also contains every POU's matching `<UUID>.meta` file plus
 *   "folder placeholder" entries (tiny `.meta` + 23-byte `.object` pairs)
 *   that describe the project explorer tree (CODESYS Library Manager
 *   shows them as `POUs/Time&Date/DCF77` etc.). Each .meta carries the
 *   own GUID, a parent-folder GUID, and a display-name string-table
 *   index, so walking the parent chain from any POU's .meta resolves to
 *   a slash-separated path that we surface as `ExtractedPOU.category`.
 *   Library-root and namespace-scope GUIDs (which appear in *every* meta
 *   and would otherwise be misread as a parent) are filtered out by
 *   reference-frequency: they're the most-referenced GUIDs in the file.
 */
import type { ExtractedPOU } from "./types.js";
/**
 * Read a LEB128 (unsigned) variable-length integer from a buffer.
 * Returns the decoded value and the new offset.
 * Limited to 28-bit shift to stay within JS 32-bit signed integer range.
 */
export declare function readLEB128(data: Uint8Array, offset: number): [number, number];
/**
 * Parse the string table auxiliary file.
 *
 * Format:
 *   [0xFA 0x53] [flag byte] [GUID length byte] [GUID ASCII string]
 *   Repeated: [LEB128 index] [LEB128 length] [UTF-8 string bytes]
 */
export declare function parseStringTable(data: Uint8Array): {
    strings: Map<number, string>;
    guid: string;
};
/**
 * Decode all LEB128-encoded values from a binary buffer.
 */
export declare function decodeObjectIndices(data: Uint8Array): number[];
/**
 * Parse a `VAR_GLOBAL CONSTANT` block and return the integer constants it
 * declares. Used to promote constants like OSCAT's STRING_LENGTH /
 * LIST_LENGTH into compile-time values that can be used as C++ template
 * parameters; the GVL itself is dropped to avoid a duplicate definition.
 *
 * Returns null if the declaration isn't a CONSTANT block, or if any
 * non-integer / non-numeric entries are present (the caller keeps the
 * GVL as a runtime variable in that case).
 */
export declare function extractConstantGlobals(declaration: string): Record<string, number> | null;
/**
 * Parse a CODESYS V3 .library buffer and extract all POUs.
 *
 * Uses object file record parsing for complete extraction of:
 * - POU headers, VAR_INPUT/VAR_OUTPUT/VAR blocks, documentation
 * - Full implementation code
 *
 * @param data - Raw binary content of the .library ZIP archive
 * @returns Array of extracted POUs, library GUID, and any warnings
 */
export declare function parseV3Library(data: Uint8Array): Promise<{
    pous: ExtractedPOU[];
    guid: string;
    globalConstants: Record<string, number>;
    warnings: string[];
}>;
//# sourceMappingURL=v3-parser.d.ts.map