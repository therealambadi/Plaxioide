/**
 * TestCodeGenerator — subclass of CodeGenerator for test main generation.
 *
 * Delegates all ST→C++ translation to the production codegen, adding only:
 * - "s." prefix for SETUP variables
 * - ".run()" invocation for program POUs
 * - POU type resolution from POUInfo metadata
 * - AST-aware type/signature generation via initFromAST()
 */
import type { Statement, Expression, FunctionCallExpression, CompilationUnit, FunctionDeclaration, TypeReference } from "../frontend/ast.js";
import type { POUInfo } from "./test-main-gen.js";
import { CodeGenerator } from "./codegen.js";
import type { CodeGenOptions } from "./codegen.js";
export declare class TestCodeGenerator extends CodeGenerator {
    private pouMap;
    private setupVarNames;
    /** User-defined function names (upper case) — skip std registry for these */
    private userFunctionNames;
    constructor(pous: POUInfo[], options?: Partial<CodeGenOptions>);
    /**
     * Populate known type sets from the AST.
     * Mirrors what CodeGenerator.generate() does at startup so that
     * isUserDefinedType(), mapVarTypeToCpp() etc. work correctly for
     * struct/interface/FB types.
     */
    initFromAST(ast: CompilationUnit): void;
    /**
     * Generate a function signature using production codegen methods.
     * Returns the C++ return type and parameter strings.
     */
    generateFunctionSignature(func: FunctionDeclaration): {
        returnType: string;
        params: string[];
    };
    /** Set names of SETUP variables that need "s." prefix. */
    setSetupVars(names: Iterable<string>): void;
    /** Clear SETUP variable tracking. */
    clearSetupVars(): void;
    /** Populate the scope's variable→type map for POU invocation detection. */
    setScopeFromVarTypes(varTypes: Map<string, string>): void;
    /**
     * Resolve a dot-separated member access path, applying name mangling
     * where a member name collides with its type name in a class context.
     * E.g., ["CTRL", "SENSOR"] → "CTRL.SENSOR_" when SENSOR is type Sensor in Controller.
     */
    resolveMemberPath(path: string[], prefix: string): string;
    /** Generate a C++ expression string from an AST Expression. */
    emitExpression(expr: Expression): string;
    /** Generate C++ statement(s) and append to output buffer. */
    emitStatement(stmt: Statement, indent: string): void;
    /** Get the accumulated output lines. */
    getOutput(): string[];
    /** Clear the accumulated output buffer. */
    clearOutput(): void;
    /**
     * Resolve a type to its C++ equivalent.
     * Accepts either a string type name or a TypeReference (preserving maxLength).
     * For POUs, maps to the C++ class name. For elementary types, delegates to base.
     */
    resolveType(typeOrName: TypeReference | string): string;
    protected resolveVariableBaseName(name: string): string;
    /**
     * Override function call generation to skip std registry for user-defined functions.
     * In test context, user-defined functions like Add() should not be mapped to standard
     * library ADD() because the std library templates expect IECVar-wrapped arguments.
     */
    protected generateFunctionCallExpression(expr: FunctionCallExpression): string;
    protected emitPOUCallLine(instanceName: string, rawName: string, indent: string): void;
}
//# sourceMappingURL=test-codegen.d.ts.map