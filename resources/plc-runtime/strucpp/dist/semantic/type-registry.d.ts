/**
 * STruC++ Type Registry
 *
 * This module provides a registry for user-defined types (TYPE...END_TYPE blocks).
 * It handles type storage, lookup, dependency resolution, and validation.
 */
import type { TypeDeclaration } from "../frontend/ast.js";
/**
 * Result of type registry validation
 */
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
/**
 * Validation error
 */
export interface ValidationError {
    typeName: string;
    message: string;
}
/**
 * Validation warning
 */
export interface ValidationWarning {
    typeName: string;
    message: string;
}
/**
 * Check if a type name is an elementary type
 *
 * Delegates to the canonical IEC type registry
 * (`./iec-types-data.ts`), which is also the source emitted as
 * `libs/iec-types.json`. Single source of truth — adding a new
 * elementary type happens in one place.
 */
export declare function isElementaryType(name: string): boolean;
/**
 * Type Registry for managing user-defined types
 */
export declare class TypeRegistry {
    private types;
    /**
     * Register a user-defined type
     */
    registerType(type: TypeDeclaration): void;
    /**
     * Register multiple types at once
     */
    registerTypes(types: TypeDeclaration[]): void;
    /**
     * Look up a type by name
     */
    lookupType(name: string): TypeDeclaration | undefined;
    /**
     * Check if a type exists
     */
    hasType(name: string): boolean;
    /**
     * Get all registered types
     */
    getAllTypes(): TypeDeclaration[];
    /**
     * Get the number of registered types
     */
    get size(): number;
    /**
     * Clear all registered types
     */
    clear(): void;
    /**
     * Get types in dependency order (topological sort)
     * Types that depend on other types come after their dependencies.
     * This is essential for C++ code generation where types must be declared
     * before they are used.
     */
    getTypesInDependencyOrder(): TypeDeclaration[];
    /**
     * Get the direct dependencies of a type (other user-defined types it references)
     */
    getTypeDependencies(type: TypeDeclaration): string[];
    /**
     * Recursively collect type dependencies from a type definition
     */
    private collectDependencies;
    private collectStructDependencies;
    private collectVarDeclDependencies;
    private collectEnumDependencies;
    private collectArrayDependencies;
    private collectSubrangeDependencies;
    private collectTypeRefDependencies;
    /**
     * Validate all registered types
     * Checks for:
     * - Undefined type references
     * - Circular dependencies
     * - Invalid type definitions
     */
    validate(): ValidationResult;
    /**
     * Validate a single type declaration
     */
    private validateType;
    /**
     * Validate a type definition
     */
    private validateTypeDefinition;
    /**
     * Detect circular dependencies in type definitions
     */
    private detectCycles;
}
//# sourceMappingURL=type-registry.d.ts.map