/**
 * AST Traversal Utilities
 *
 * General-purpose utilities for walking and querying the AST.
 * Used by the LSP server for hover, go-to-definition, find references, etc.
 */
import type { ASTNode, CompilationUnit, Expression, Argument } from "./frontend/ast.js";
/**
 * Predicate: is this argument the implicit IEC EN input (`EN := <bool>`)?
 * EN gates whether the call body executes — it is not part of the function's
 * declared signature, so callers that validate or type-check arg counts
 * against a signature must filter it out first.
 */
export declare function isEnArgument(arg: Argument): boolean;
/**
 * Predicate: is this argument the implicit IEC ENO output (`ENO => <var>`)?
 * Same reasoning as `isEnArgument`: ENO is bound by the runtime wrapper,
 * not by the function itself.
 */
export declare function isEnoArgument(arg: Argument): boolean;
/**
 * Predicate: either EN input or ENO output.
 */
export declare function isEnEnoArgument(arg: Argument): boolean;
/**
 * Filter EN/ENO out of an argument list. Returns the user-supplied arguments
 * that the function's declared parameters should be matched against.
 */
export declare function stripEnEno(args: Argument[]): Argument[];
/**
 * Recursively walk an AST subtree, calling visitor for each node.
 * If visitor returns false, children of that node are skipped.
 */
export declare function walkAST(node: ASTNode, visitor: (node: ASTNode) => boolean | void): void;
/**
 * Find the deepest AST node whose sourceSpan contains the given position.
 */
export declare function findNodeAtPosition(ast: CompilationUnit, file: string, line: number, column: number): ASTNode | undefined;
/**
 * Find the innermost Expression node at the given position.
 */
export declare function findInnermostExpression(ast: CompilationUnit, file: string, line: number, column: number): Expression | undefined;
/**
 * Collect all AST nodes that reference a given symbol name.
 * Optionally filter by scope (e.g., "MyProgram" or "MyFB").
 *
 * Uses a scope stack to correctly handle nested scopes (methods inside FBs).
 * When code appears in a FB body after method declarations, the scope is the
 * FB — not the last-visited method.
 */
export declare function collectReferences(ast: CompilationUnit, symbolName: string, scope?: string): ASTNode[];
export interface EnclosingScope {
    kind: "program" | "function" | "functionBlock" | "method" | "global";
    name: string;
    parentName?: string;
}
/**
 * Determine which POU contains a given source position.
 * Returns the most specific match (method > FB > function > program > global).
 */
export declare function findEnclosingPOU(ast: CompilationUnit, file: string, line: number, column: number): EnclosingScope;
//# sourceMappingURL=ast-utils.d.ts.map