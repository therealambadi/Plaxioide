/**
 * STruC++ Test File Parser
 *
 * Parses test ST files into TestFile models. Uses the test lexer (which
 * recognizes TEST/END_TEST/ASSERT_* tokens) and the shared parser's
 * testFile entry point.
 */
import type { TestFile } from "./test-model.js";
import type { CompileError } from "../types.js";
/**
 * Parse a test file source string into a TestFile model.
 *
 * @param source - The test file source code
 * @param fileName - The test file name (for error reporting and output)
 * @returns The parsed TestFile and any errors
 */
export declare function parseTestFile(source: string, fileName: string): {
    testFile?: TestFile;
    errors: CompileError[];
};
//# sourceMappingURL=test-parser.d.ts.map