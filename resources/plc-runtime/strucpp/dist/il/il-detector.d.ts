/**
 * STruC++ IL Detector
 *
 * Identifies POU regions in a source file and determines whether each
 * POU's body uses Instruction List (IL) or Structured Text (ST).
 */
import type { POURegion } from "./il-types.js";
/** Diagnostic emitted by extractPOURegions when a POU is malformed. */
export interface POURegionError {
    message: string;
    line: number;
    column: number;
}
export interface ExtractPOURegionsResult {
    regions: POURegion[];
    errors: POURegionError[];
}
/**
 * Replace every comment ((* ... *) and // ... to end of line) and every
 * string literal ('...' and "...") in the source with same-length spaces.
 * This preserves byte offsets and line numbers so subsequent regex scans
 * report correct positions while no longer false-matching POU keywords
 * inside comments or strings. Newlines inside multi-line comments are
 * preserved so line counters stay accurate.
 */
export declare function maskCommentsAndStrings(source: string): string;
/**
 * Detect whether a POU body contains IL or ST.
 *
 * Heuristic: examine the first non-blank, non-comment line of the body.
 * - If it matches an IL operator pattern (with no semicolons), it's IL.
 * - Otherwise it's ST.
 */
export declare function isILBody(bodyText: string): boolean;
/**
 * Extract POU regions from a source file.
 *
 * Each region includes the header (POU keyword through last END_VAR),
 * the body (executable code), and the closing keyword. The body is
 * tested for IL vs ST.
 */
export declare function extractPOURegions(source: string): ExtractPOURegionsResult;
//# sourceMappingURL=il-detector.d.ts.map