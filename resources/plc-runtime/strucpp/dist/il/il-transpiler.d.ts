/**
 * STruC++ IL Transpiler — Public API
 *
 * Detects IL bodies in a source file, parses them, converts to ST,
 * and reassembles the source with IL bodies replaced by ST equivalents.
 */
import type { ILTranspileResult } from "./il-types.js";
/**
 * Transpile any IL bodies in the source to ST.
 *
 * Scans the source for POU regions, detects which have IL bodies,
 * and replaces those bodies with equivalent ST code. Non-IL POUs
 * and text outside POUs are left untouched.
 *
 * @param source - The full source text (may contain mixed IL and ST POUs)
 * @param fileName - Optional file name for error reporting
 * @returns Transpilation result with the ST source and any errors
 */
export declare function transpileILSource(source: string, fileName?: string): ILTranspileResult;
//# sourceMappingURL=il-transpiler.d.ts.map