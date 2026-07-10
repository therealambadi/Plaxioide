/**
 * STruC++ Symbol Table
 *
 * Manages symbol tables for name resolution during semantic analysis.
 * Supports nested scopes and different symbol kinds.
 */
import type { FunctionDeclaration, FunctionBlockDeclaration, ProgramDeclaration, TypeDeclaration, VarDeclaration, IECType } from "../frontend/ast.js";
/**
 * Kind of symbol
 */
export type SymbolKind = "variable" | "constant" | "function" | "functionBlock" | "program" | "type" | "enumValue";
/**
 * Base interface for all symbols
 */
export interface BaseSymbol {
    /** Symbol name */
    name: string;
    /** Kind of symbol */
    kind: SymbolKind;
    /** Resolved type (if applicable) */
    type?: IECType;
}
/**
 * Variable symbol
 */
export interface VariableSymbol extends BaseSymbol {
    kind: "variable";
    declaration: VarDeclaration;
    isInput: boolean;
    isOutput: boolean;
    isInOut: boolean;
    isExternal: boolean;
    isGlobal: boolean;
    isRetain: boolean;
    address?: string | undefined;
    /** Default value as an ST expression string, for library function/FB
     *  parameters reconstructed from a manifest (whose `declaration` carries no
     *  AST initial value). Presence marks the input as OPTIONAL. User-defined
     *  POUs instead carry their default on `declaration.initialValue`. */
    initialValue?: string | undefined;
}
/**
 * Constant symbol
 */
export interface ConstantSymbol extends BaseSymbol {
    kind: "constant";
    declaration: VarDeclaration;
    value?: unknown;
}
/**
 * Function symbol
 */
export interface FunctionSymbol extends BaseSymbol {
    kind: "function";
    declaration: FunctionDeclaration;
    returnType: IECType;
    parameters: VariableSymbol[];
}
/**
 * Function block symbol
 */
export interface FunctionBlockSymbol extends BaseSymbol {
    kind: "functionBlock";
    declaration: FunctionBlockDeclaration;
    inputs: VariableSymbol[];
    outputs: VariableSymbol[];
    inouts: VariableSymbol[];
    locals: VariableSymbol[];
}
/**
 * Program symbol
 */
export interface ProgramSymbol extends BaseSymbol {
    kind: "program";
    declaration: ProgramDeclaration;
    variables: VariableSymbol[];
}
/**
 * Type symbol
 */
export interface TypeSymbol extends BaseSymbol {
    kind: "type";
    declaration: TypeDeclaration;
    resolvedType: IECType;
}
/**
 * Enum value symbol
 */
export interface EnumValueSymbol extends BaseSymbol {
    kind: "enumValue";
    enumType: string;
    value: number;
}
/**
 * Union of all symbol types
 */
export type AnySymbol = VariableSymbol | ConstantSymbol | FunctionSymbol | FunctionBlockSymbol | ProgramSymbol | TypeSymbol | EnumValueSymbol;
/**
 * Error thrown when a symbol is not found
 */
export declare class SymbolNotFoundError extends Error {
    readonly symbolName: string;
    readonly scope: string;
    constructor(symbolName: string, scope: string);
}
/**
 * Error thrown when a symbol is already defined
 */
export declare class DuplicateSymbolError extends Error {
    readonly symbolName: string;
    readonly scope: string;
    constructor(symbolName: string, scope: string);
}
/**
 * A single scope in the symbol table hierarchy.
 */
export declare class Scope {
    readonly name: string;
    readonly parent?: Scope | undefined;
    private symbols;
    constructor(name: string, parent?: Scope | undefined);
    /**
     * Define a symbol in this scope.
     * @throws DuplicateSymbolError if symbol already exists in this scope
     */
    define(symbol: AnySymbol): void;
    /**
     * Define a symbol, replacing any existing definition.
     * Used by the analyzer when user code redefines a library-registered symbol.
     */
    defineOrReplace(symbol: AnySymbol): void;
    /**
     * Look up a symbol in this scope only (not parent scopes).
     */
    lookupLocal(name: string): AnySymbol | undefined;
    /**
     * Look up a symbol in this scope and parent scopes.
     */
    lookup(name: string): AnySymbol | undefined;
    /**
     * Check if a symbol exists in this scope only.
     */
    hasLocal(name: string): boolean;
    /**
     * Check if a symbol exists in this scope or parent scopes.
     */
    has(name: string): boolean;
    /**
     * Get all symbols in this scope.
     */
    getAllSymbols(): AnySymbol[];
    /**
     * Get all symbols of a specific kind.
     */
    getSymbolsByKind<K extends SymbolKind>(kind: K): Extract<AnySymbol, {
        kind: K;
    }>[];
}
/**
 * Global symbol tables for a compilation unit.
 */
export declare class SymbolTables {
    /** Global scope containing types, functions, FBs, programs */
    readonly globalScope: Scope;
    /** Map of function names to their local scopes */
    private functionScopes;
    /** Map of function block names to their local scopes */
    private fbScopes;
    /** Map of program names to their local scopes */
    private programScopes;
    /** Map of "FBNAME.METHODNAME" to their local scopes (parent = FB scope) */
    private methodScopes;
    constructor();
    /**
     * Initialize built-in IEC types.
     */
    private initializeBuiltinTypes;
    /**
     * Create a new scope for a function.
     */
    createFunctionScope(name: string): Scope;
    /**
     * Create a new scope for a function block.
     */
    createFBScope(name: string): Scope;
    /**
     * Create a new scope for a program.
     */
    createProgramScope(name: string): Scope;
    /**
     * Get the scope for a function.
     */
    getFunctionScope(name: string): Scope | undefined;
    /**
     * Get the scope for a function block.
     */
    getFBScope(name: string): Scope | undefined;
    /**
     * Get the scope for a program.
     */
    getProgramScope(name: string): Scope | undefined;
    /**
     * Create a new scope for a method within a function block.
     * The method scope's parent is the FB scope, giving the lookup chain:
     * method locals → FB members → globals.
     */
    createMethodScope(fbName: string, methodName: string): Scope;
    /**
     * Get the scope for a method within a function block.
     */
    getMethodScope(fbName: string, methodName: string): Scope | undefined;
    /**
     * Look up a type by name.
     */
    lookupType(name: string): TypeSymbol | undefined;
    /**
     * Look up a function by name.
     */
    lookupFunction(name: string): FunctionSymbol | undefined;
    /**
     * Look up a function block by name.
     */
    lookupFunctionBlock(name: string): FunctionBlockSymbol | undefined;
    /**
     * Look up a program by name.
     */
    lookupProgram(name: string): ProgramSymbol | undefined;
}
//# sourceMappingURL=symbol-table.d.ts.map