/**
 * STruC++ - IEC 61131-3 Structured Text to C++ Compiler
 *
 * Main entry point for the STruC++ compiler library.
 * This module exports the public API for programmatic usage.
 */
import { CompileOptions, CompileResult, CompileError, AnalysisResult } from "./types.js";
import type { CompilationUnit } from "./frontend/ast.js";
/**
 * Default compilation options
 */
export declare const defaultOptions: CompileOptions;
/**
 * Compile IEC 61131-3 Structured Text source code to C++.
 *
 * @param source - The ST source code to compile
 * @param options - Compilation options
 * @returns The compilation result containing C++ code and metadata
 *
 * @example
 * ```typescript
 * import { compile } from 'strucpp';
 *
 * const stSource = `
 * PROGRAM Main
 *   VAR counter : INT; END_VAR
 *   counter := counter + 1;
 * END_PROGRAM
 * `;
 *
 * const result = compile(stSource, { debug: true, lineMapping: true });
 * console.log(result.cppCode);
 * console.log(result.lineMap);
 * ```
 */
export declare function compile(source: string, options?: Partial<CompileOptions>): CompileResult;
/**
 * Analyze ST source code without code generation.
 * Unlike compile(), returns partial results (AST, symbol tables, project model)
 * even when errors are present, making it suitable for IDE/LSP integration.
 *
 * @param source - The ST source code to analyze
 * @param options - Compilation options (codegen options are ignored)
 * @returns Analysis result with AST, symbol tables, and diagnostics
 */
export declare function analyze(source: string, options?: Partial<CompileOptions>): AnalysisResult;
/**
 * Parse ST source code and return the AST without code generation.
 * Useful for syntax checking and IDE integration.
 *
 * @param source - The ST source code to parse
 * @returns The parsed AST or parse errors
 */
export declare function parse(source: string): {
    ast?: CompilationUnit;
    errors: CompileError[];
};
export declare function getVersion(): string;
export type { CompileOptions, CompileResult, CompileError, AnalysisResult, } from "./types.js";
export type { SourceSpan, LineMapEntry, Severity } from "./types.js";
export { buildSourceMap, formatDiagnostic, formatDiagnostics, } from "./diagnostic-formatter.js";
export type { DiagnosticSource } from "./diagnostic-formatter.js";
export type { ASTNode, TypedNode, CompilationUnit, ProgramDeclaration, FunctionDeclaration, FunctionBlockDeclaration, InterfaceDeclaration, MethodDeclaration, PropertyDeclaration, TypeDeclaration, VarDeclaration, VarBlock, VarBlockType, Statement, Expression, VariableExpression, FunctionCallExpression, MethodCallExpression, LiteralExpression, TypeReference, IECType, ElementaryType, ArrayType, StructType, EnumType, ReferenceType, FunctionBlockType, AccessStep, StructDefinition, EnumDefinition, EnumMember, } from "./frontend/ast.js";
export { SymbolTables, Scope } from "./semantic/symbol-table.js";
export type { AnySymbol, VariableSymbol, ConstantSymbol, FunctionSymbol, FunctionBlockSymbol, ProgramSymbol, TypeSymbol, EnumValueSymbol, SymbolKind, } from "./semantic/symbol-table.js";
export { StdFunctionRegistry } from "./semantic/std-function-registry.js";
export type { StdFunctionDescriptor, StdFunctionParam, TypeConstraint, } from "./semantic/std-function-registry.js";
export { typeName, resolveFieldType, resolveArrayElementType, ELEMENTARY_TYPES, TYPE_CATEGORIES, matchesConstraint, isAssignable, isImplicitlyConvertible, getCommonType, } from "./semantic/type-utils.js";
export { isElementaryType } from "./semantic/type-registry.js";
export { IEC_BASE_TYPES, lookupBaseType, isBaseTypeName, } from "./semantic/iec-types-data.js";
export type { IECTypeMetadata, IECWireFormat, } from "./semantic/iec-types-data.js";
export type { ProjectModel } from "./project-model.js";
export { walkAST, findNodeAtPosition, findInnermostExpression, collectReferences, findEnclosingPOU, } from "./ast-utils.js";
export type { EnclosingScope } from "./ast-utils.js";
export { compileLibrary, compileStlib } from "./library/library-compiler.js";
export { loadLibraryManifest, loadStlibArchive, loadStlibFromBuffer, loadStlibFromString, registerLibrarySymbols, LibraryManifestError, } from "./library/library-loader.js";
export { getBuiltinStdlibManifest } from "./library/builtin-stdlib.js";
export { extractNamespaceBody } from "./library/library-utils.js";
export type { LibraryManifest, LibraryCompileResult, StlibArchive, StlibCompileResult, LibraryFunctionEntry, LibraryFBEntry, LibraryTypeEntry, } from "./library/library-manifest.js";
export { detectFormat, importCodesysLibraryFromBytes, } from "./library/codesys-import/index.js";
export type { CodesysFormat, CodesysImportResult, } from "./library/codesys-import/index.js";
export { generateReplMain } from "./backend/repl-main-gen.js";
export type { ReplMainGenOptions } from "./backend/repl-main-gen.js";
export { extractIncludePaths, splitCxxFlags } from "./cxx-flags.js";
export { parseTestFile } from "./testing/test-parser.js";
export { analyzeTestFile } from "./semantic/analyzer.js";
export { generateTestMain, buildPOUInfoFromAST, } from "./backend/test-main-gen.js";
export type { TestMainGenOptions, POUInfo } from "./backend/test-main-gen.js";
export type { TestFile, TestCase, SetupBlock, TeardownBlock, AssertType, AssertCall, TestStatement, } from "./testing/test-model.js";
//# sourceMappingURL=index.d.ts.map