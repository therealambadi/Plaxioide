// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2025 Autonomy / OpenPLC Project
/**
 * STruC++ Abstract Syntax Tree Definitions
 *
 * This module defines the AST node types used throughout the compiler.
 * The AST is produced by the CST visitor from the parser output.
 */
// =============================================================================
// Factory Functions
// =============================================================================
/**
 * Create a default source span for nodes without location info.
 */
export function createDefaultSourceSpan() {
    return {
        file: "",
        startLine: 0,
        endLine: 0,
        startCol: 0,
        endCol: 0,
    };
}
/**
 * Create an empty compilation unit.
 */
export function createCompilationUnit() {
    return {
        kind: "CompilationUnit",
        sourceSpan: createDefaultSourceSpan(),
        programs: [],
        functions: [],
        functionBlocks: [],
        interfaces: [],
        types: [],
        configurations: [],
        globalVarBlocks: [],
    };
}
//# sourceMappingURL=ast.js.map