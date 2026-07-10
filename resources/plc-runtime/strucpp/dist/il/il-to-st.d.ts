/**
 * STruC++ IL to ST Converter
 *
 * Converts parsed IL instructions into Structured Text source code.
 * Uses expression threading for straight-line IL (no accumulator variable)
 * and a CASE state machine for IL with labels/jumps.
 */
import type { ILElement } from "./il-types.js";
/** Conversion error. */
export interface ILConvertError {
    message: string;
    line: number;
    column: number;
}
/** Result of IL→ST conversion. */
export interface ILConvertResult {
    /** Generated ST body text */
    stBody: string;
    /** Conversion errors */
    errors: ILConvertError[];
    /** Whether extra VAR declarations are needed (for state machine) */
    extraVars?: string;
}
/**
 * Convert parsed IL instructions to ST body text.
 *
 * For straight-line IL (no jumps/labels), uses expression threading
 * which produces clean ST without accumulator variables.
 *
 * For IL with jumps/labels, generates a CASE-based state machine.
 */
export declare function convertILToST(elements: ILElement[], hasControlFlow: boolean): ILConvertResult;
//# sourceMappingURL=il-to-st.d.ts.map