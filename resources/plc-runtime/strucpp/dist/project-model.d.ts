/**
 * STruC++ Project Model
 *
 * This module defines the project model interfaces and provides a builder
 * that constructs the project model from the AST. It also performs validation
 * of the project structure, including VAR_GLOBAL and VAR_EXTERNAL resolution.
 */
import type { CompilationUnit } from "./frontend/ast.js";
import type { CompileError } from "./types.js";
/**
 * Library reference with namespace information.
 */
export interface LibraryReference {
    /** Library name */
    name: string;
    /** Namespace identifier for the library */
    namespace: string;
    /** Optional path to library files */
    path?: string;
}
/**
 * Project configuration for namespace and library management.
 */
export interface ProjectConfig {
    /** Project name */
    name: string;
    /** Namespace identifier (defaults to project name if not specified) */
    namespace?: string;
    /** Referenced libraries */
    libraries: LibraryReference[];
}
/**
 * Time value representation for task intervals.
 */
export interface TimeValue {
    /** Time in nanoseconds */
    nanoseconds: number;
    /** Original string representation */
    rawValue: string;
}
/**
 * Variable declaration in the project model.
 */
export interface ProjectVarDeclaration {
    name: string;
    typeName: string;
    maxLength?: number | string;
    initialValue?: string;
    isConstant: boolean;
    isRetain: boolean;
    address?: string;
    /** For inline ARRAY types (typeName like __INLINE_ARRAY_<T>) — bounds carried
     *  through so codegen can reconstruct Array1D<T, L, U>. Without this, a
     *  variable typed __INLINE_ARRAY_DINT emits as IEC___INLINE_ARRAY_DINT
     *  (an undefined type) because the bounds were dropped. */
    arrayDimensions?: Array<{
        start: number;
        end: number;
    }>;
    /** Element type for inline arrays (e.g. "DINT"). */
    elementTypeName?: string;
    /** Pointer/reference qualifier carried through from the AST TypeReference. */
    referenceKind?: string;
}
/**
 * External variable declaration (reference to global).
 *
 * Carries the same type-shape metadata as ProjectVarDeclaration so codegen
 * can reconstruct Array1D<...> / IEC_Ptr<...> for VAR_EXTERNAL references
 * to inline-array or pointer globals. Without these, codegen falls through
 * to mapVarTypeToCpp's IEC_${name} default and emits broken types like
 * IEC___INLINE_ARRAY_DINT.
 */
export interface VarExternalDeclaration {
    name: string;
    typeName: string;
    maxLength?: number | string;
    arrayDimensions?: Array<{
        start: number;
        end: number;
    }>;
    elementTypeName?: string;
    referenceKind?: string;
}
/**
 * Program declaration in the project model.
 */
export interface ProgramDecl {
    name: string;
    varDeclarations: ProjectVarDeclaration[];
    varExternal: VarExternalDeclaration[];
    hasBody: boolean;
}
/**
 * Program instance declaration.
 */
export interface ProgramInstanceDecl {
    instanceName: string;
    programType: string;
    taskName?: string;
}
/**
 * Task declaration in the project model.
 */
export interface TaskDecl {
    name: string;
    interval?: TimeValue;
    priority?: number;
    programInstances: ProgramInstanceDecl[];
}
/**
 * Resource declaration in the project model.
 */
export interface ResourceDecl {
    name: string;
    processor: string;
    tasks: TaskDecl[];
}
/**
 * Configuration declaration in the project model.
 */
export interface ConfigurationDecl {
    name: string;
    globalVars: ProjectVarDeclaration[];
    resources: ResourceDecl[];
}
/**
 * Function declaration in the project model.
 */
export interface FunctionDecl {
    name: string;
    returnType: string;
    parameters: ProjectVarDeclaration[];
}
/**
 * Function block declaration in the project model.
 */
export interface FunctionBlockDecl {
    name: string;
    inputs: ProjectVarDeclaration[];
    outputs: ProjectVarDeclaration[];
    inouts: ProjectVarDeclaration[];
    locals: ProjectVarDeclaration[];
}
/**
 * The complete project model.
 */
export interface ProjectModel {
    configurations: ConfigurationDecl[];
    programs: Map<string, ProgramDecl>;
    functions: Map<string, FunctionDecl>;
    functionBlocks: Map<string, FunctionBlockDecl>;
    /** Project configuration (optional, for namespace support) */
    config?: ProjectConfig;
}
/**
 * Get the effective namespace for a project model.
 * Returns the configured namespace, or the project name, or "strucpp" as fallback.
 */
export declare function getProjectNamespace(model: ProjectModel): string;
/**
 * Resolve a qualified name to its namespace and local name.
 * Returns undefined if the name is not qualified.
 */
export declare function resolveQualifiedName(name: string): {
    namespace: string;
    localName: string;
} | undefined;
/**
 * Convert an IEC qualified name to C++ qualified name.
 * Replaces dots with double colons.
 */
export declare function toQualifiedCppName(name: string): string;
/**
 * Result of building the project model.
 */
export interface ProjectModelResult {
    success: boolean;
    model: ProjectModel;
    errors: CompileError[];
    warnings: CompileError[];
}
/**
 * Parse a TIME literal string to nanoseconds.
 * Supports formats like T#20ms, T#1s, T#100us, TIME#1h2m3s, etc.
 */
/**
 * Parse an IEC 61131-3 DATE literal (`D#YYYY-MM-DD` /
 * `DATE#YYYY-MM-DD`) into **days since the Unix epoch (UTC)**.
 *
 * Why days and not nanoseconds: `iec_date.hpp` stores `IEC_DATE` as
 * signed days, and helpers like `DT_FROM_DATE_AND_TOD` multiply the
 * raw stored value by `DT_NS_PER_DAY` to compose a DT — that math
 * only works if DATE is days.  An earlier version of this helper
 * lowered to nanoseconds, which silently broke `DATE_TO_DAYS`,
 * `DT_FROM_DATE_AND_TOD`, and every `TO_<int>(DATE)` conversion
 * (they'd return the raw ns count instead of the day count).
 *
 * Returns `0n` (Unix epoch) for any unparsable input rather than
 * throwing, mirroring `parseTimeLiteral`.
 */
export declare function parseDateLiteralToDays(literal: string): bigint;
/**
 * Parse an IEC TIME_OF_DAY literal (`TOD#HH:MM:SS[.fff]` /
 * `TIME_OF_DAY#…`) into nanoseconds since midnight. The optional
 * fractional-seconds tail is treated as a decimal fraction of a
 * second, capped at sub-nanosecond precision (extra digits beyond
 * 9 are truncated, not rounded — there's no IEC-standardised
 * rounding mode). Returns 0 for unparsable input.
 */
export declare function parseTodLiteralToNs(literal: string): bigint;
/**
 * Parse an IEC DATE_AND_TIME literal (`DT#YYYY-MM-DD-HH:MM:SS[.fff]`
 * / `DATE_AND_TIME#…`) into nanoseconds since the Unix epoch (UTC).
 * Returns 0 for unparsable input.
 */
export declare function parseDtLiteralToNs(literal: string): bigint;
export declare function parseTimeLiteral(literal: string): TimeValue;
/**
 * Builds a ProjectModel from a CompilationUnit AST.
 */
export declare class ProjectModelBuilder {
    private errors;
    private warnings;
    private programs;
    private functions;
    private functionBlocks;
    private configurations;
    /**
     * Build the project model from an AST.
     */
    build(ast: CompilationUnit): ProjectModelResult;
    /**
     * Process a program declaration.
     */
    private processProgram;
    /**
     * Process a function declaration.
     */
    private processFunction;
    /**
     * Process a function block declaration.
     */
    private processFunctionBlock;
    /**
     * Process a configuration declaration.
     */
    private processConfiguration;
    /**
     * Process a resource declaration.
     */
    private processResource;
    /**
     * Process a task declaration.
     */
    private processTask;
    /**
     * Process a program instance.
     */
    private processProgramInstance;
    /**
     * Validate VAR_EXTERNAL references against VAR_GLOBAL declarations.
     */
    private validateExternalReferences;
    /**
     * Convert an AST VarDeclaration to a ProjectVarDeclaration.
     */
    private convertVarDeclaration;
    /**
     * Extract a TIME value from an expression.
     */
    private extractTimeValue;
    /**
     * Extract an integer value from an expression.
     */
    private extractIntValue;
    /**
     * Convert an expression to a string representation.
     */
    private expressionToString;
    /**
     * Add an error message.
     */
    private addError;
    /**
     * Add a warning message.
     */
    private addWarning;
}
/**
 * Build a project model from an AST.
 * Convenience function that creates a builder and builds the model.
 */
export declare function buildProjectModel(ast: CompilationUnit): ProjectModelResult;
//# sourceMappingURL=project-model.d.ts.map