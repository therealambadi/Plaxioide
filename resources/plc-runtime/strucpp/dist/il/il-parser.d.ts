/**
 * STruC++ IL Parser
 *
 * Parses IL body text into a sequence of ILInstruction objects.
 * IL is line-oriented: each line contains at most one instruction,
 * optionally preceded by a label.
 */
import type { ILElement } from "./il-types.js";
/** Parse error from IL parsing. */
export interface ILParseError {
    message: string;
    line: number;
    column: number;
}
/** Result of parsing an IL body. */
export interface ILParseResult {
    instructions: ILElement[];
    errors: ILParseError[];
    /** Whether any labels or jump instructions were found */
    hasControlFlow: boolean;
}
/**
 * Parse IL body text into a sequence of instructions.
 *
 * @param bodyText - The raw IL body (between END_VAR and END_*)
 * @param startLine - The 1-based line number where the body starts in the original source
 */
export declare function parseILBody(bodyText: string, startLine?: number): ILParseResult;
//# sourceMappingURL=il-parser.d.ts.map