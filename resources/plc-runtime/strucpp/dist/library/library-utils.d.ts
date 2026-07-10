/**
 * STruC++ Library Utilities — pure helpers.
 *
 * The Node-only `discoverSTFiles(dir)` helper lives in
 * `src/node/library-utils.ts`.  This module stays browser-safe.
 */
/**
 * Extract the body inside `namespace ... { ... }` from generated C++ code.
 * Strips includes, pragma once, and the namespace wrapper.
 *
 * Handles multiple namespace blocks in the same input — the codegen
 * splits implementation across one TU per POU plus a shared
 * configuration TU, and library-compiler concatenates all .cpp files
 * before extracting. Each block contributes its body; the closing `}`
 * of one block ends extraction for that block, and we keep scanning
 * for further `namespace ... {` openings.
 */
export declare function extractNamespaceBody(code: string): string;
//# sourceMappingURL=library-utils.d.ts.map