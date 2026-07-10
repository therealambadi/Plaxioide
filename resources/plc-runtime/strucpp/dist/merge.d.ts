/**
 * STruC++ AST Merge Utility
 *
 * Merges multiple CompilationUnits (from separate ST source files)
 * into a single CompilationUnit for unified semantic analysis and codegen.
 */
import type { CompilationUnit } from "./frontend/ast.js";
/**
 * Merge multiple CompilationUnits into a single unit.
 * Concatenates all programs, functions, function blocks, types, and configurations.
 * Duplicate detection is deferred to semantic analysis.
 */
export declare function mergeCompilationUnits(units: CompilationUnit[]): CompilationUnit;
//# sourceMappingURL=merge.d.ts.map