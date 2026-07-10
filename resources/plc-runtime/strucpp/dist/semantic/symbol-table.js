// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2025 Autonomy / OpenPLC Project
/**
 * STruC++ Symbol Table
 *
 * Manages symbol tables for name resolution during semantic analysis.
 * Supports nested scopes and different symbol kinds.
 */
import { ELEMENTARY_TYPES } from "./type-utils.js";
// =============================================================================
// Symbol Table
// =============================================================================
/**
 * Error thrown when a symbol is not found
 */
export class SymbolNotFoundError extends Error {
    symbolName;
    scope;
    constructor(symbolName, scope) {
        super(`Symbol '${symbolName}' not found in scope '${scope}'`);
        this.symbolName = symbolName;
        this.scope = scope;
        this.name = "SymbolNotFoundError";
    }
}
/**
 * Error thrown when a symbol is already defined
 */
export class DuplicateSymbolError extends Error {
    symbolName;
    scope;
    constructor(symbolName, scope) {
        super(`Symbol '${symbolName}' already defined in scope '${scope}'`);
        this.symbolName = symbolName;
        this.scope = scope;
        this.name = "DuplicateSymbolError";
    }
}
/**
 * A single scope in the symbol table hierarchy.
 */
export class Scope {
    name;
    parent;
    symbols = new Map();
    constructor(name, parent) {
        this.name = name;
        this.parent = parent;
    }
    /**
     * Define a symbol in this scope.
     * @throws DuplicateSymbolError if symbol already exists in this scope
     */
    define(symbol) {
        const normalizedName = symbol.name.toUpperCase();
        if (this.symbols.has(normalizedName)) {
            throw new DuplicateSymbolError(symbol.name, this.name);
        }
        this.symbols.set(normalizedName, symbol);
    }
    /**
     * Define a symbol, replacing any existing definition.
     * Used by the analyzer when user code redefines a library-registered symbol.
     */
    defineOrReplace(symbol) {
        this.symbols.set(symbol.name.toUpperCase(), symbol);
    }
    /**
     * Look up a symbol in this scope only (not parent scopes).
     */
    lookupLocal(name) {
        return this.symbols.get(name.toUpperCase());
    }
    /**
     * Look up a symbol in this scope and parent scopes.
     */
    lookup(name) {
        const normalizedName = name.toUpperCase();
        const symbol = this.symbols.get(normalizedName);
        if (symbol !== undefined) {
            return symbol;
        }
        if (this.parent !== undefined) {
            return this.parent.lookup(normalizedName);
        }
        return undefined;
    }
    /**
     * Check if a symbol exists in this scope only.
     */
    hasLocal(name) {
        return this.symbols.has(name.toUpperCase());
    }
    /**
     * Check if a symbol exists in this scope or parent scopes.
     */
    has(name) {
        return this.lookup(name) !== undefined;
    }
    /**
     * Get all symbols in this scope.
     */
    getAllSymbols() {
        return Array.from(this.symbols.values());
    }
    /**
     * Get all symbols of a specific kind.
     */
    getSymbolsByKind(kind) {
        return this.getAllSymbols().filter((s) => s.kind === kind);
    }
}
/**
 * Global symbol tables for a compilation unit.
 */
export class SymbolTables {
    /** Global scope containing types, functions, FBs, programs */
    globalScope;
    /** Map of function names to their local scopes */
    functionScopes = new Map();
    /** Map of function block names to their local scopes */
    fbScopes = new Map();
    /** Map of program names to their local scopes */
    programScopes = new Map();
    /** Map of "FBNAME.METHODNAME" to their local scopes (parent = FB scope) */
    methodScopes = new Map();
    constructor() {
        this.globalScope = new Scope("global");
        this.initializeBuiltinTypes();
    }
    /**
     * Initialize built-in IEC types.
     */
    initializeBuiltinTypes() {
        const builtinTypes = [
            "BOOL",
            "BYTE",
            "WORD",
            "DWORD",
            "LWORD",
            "SINT",
            "INT",
            "DINT",
            "LINT",
            "USINT",
            "UINT",
            "UDINT",
            "ULINT",
            "__XWORD",
            "REAL",
            "LREAL",
            "TIME",
            "DATE",
            "TIME_OF_DAY",
            "TOD",
            "DATE_AND_TIME",
            "DT",
            "STRING",
            "WSTRING",
        ];
        for (const typeName of builtinTypes) {
            this.globalScope.define({
                name: typeName,
                kind: "type",
                declaration: undefined,
                resolvedType: ELEMENTARY_TYPES[typeName] ?? {
                    typeKind: "elementary",
                    name: typeName,
                    sizeBits: 0,
                },
            });
        }
    }
    /**
     * Create a new scope for a function.
     */
    createFunctionScope(name) {
        const scope = new Scope(name, this.globalScope);
        this.functionScopes.set(name.toUpperCase(), scope);
        return scope;
    }
    /**
     * Create a new scope for a function block.
     */
    createFBScope(name) {
        const scope = new Scope(name, this.globalScope);
        this.fbScopes.set(name.toUpperCase(), scope);
        return scope;
    }
    /**
     * Create a new scope for a program.
     */
    createProgramScope(name) {
        const scope = new Scope(name, this.globalScope);
        this.programScopes.set(name.toUpperCase(), scope);
        return scope;
    }
    /**
     * Get the scope for a function.
     */
    getFunctionScope(name) {
        return this.functionScopes.get(name.toUpperCase());
    }
    /**
     * Get the scope for a function block.
     */
    getFBScope(name) {
        return this.fbScopes.get(name.toUpperCase());
    }
    /**
     * Get the scope for a program.
     */
    getProgramScope(name) {
        return this.programScopes.get(name.toUpperCase());
    }
    /**
     * Create a new scope for a method within a function block.
     * The method scope's parent is the FB scope, giving the lookup chain:
     * method locals → FB members → globals.
     */
    createMethodScope(fbName, methodName) {
        const fbScope = this.getFBScope(fbName);
        const parent = fbScope ?? this.globalScope;
        const key = `${fbName.toUpperCase()}.${methodName.toUpperCase()}`;
        const scope = new Scope(`${fbName}.${methodName}`, parent);
        this.methodScopes.set(key, scope);
        return scope;
    }
    /**
     * Get the scope for a method within a function block.
     */
    getMethodScope(fbName, methodName) {
        const key = `${fbName.toUpperCase()}.${methodName.toUpperCase()}`;
        return this.methodScopes.get(key);
    }
    /**
     * Look up a type by name.
     */
    lookupType(name) {
        const symbol = this.globalScope.lookup(name);
        if (symbol?.kind === "type") {
            return symbol;
        }
        return undefined;
    }
    /**
     * Look up a function by name.
     */
    lookupFunction(name) {
        const symbol = this.globalScope.lookup(name);
        if (symbol?.kind === "function") {
            return symbol;
        }
        return undefined;
    }
    /**
     * Look up a function block by name.
     */
    lookupFunctionBlock(name) {
        const symbol = this.globalScope.lookup(name);
        if (symbol?.kind === "functionBlock") {
            return symbol;
        }
        return undefined;
    }
    /**
     * Look up a program by name.
     */
    lookupProgram(name) {
        const symbol = this.globalScope.lookup(name);
        if (symbol?.kind === "program") {
            return symbol;
        }
        return undefined;
    }
}
//# sourceMappingURL=symbol-table.js.map