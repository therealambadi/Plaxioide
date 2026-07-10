// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2025 Autonomy / OpenPLC Project
/**
 * STruC++ Type Registry
 *
 * This module provides a registry for user-defined types (TYPE...END_TYPE blocks).
 * It handles type storage, lookup, dependency resolution, and validation.
 */
import { isBaseTypeName } from "./iec-types-data.js";
/**
 * Check if a type name is an elementary type
 *
 * Delegates to the canonical IEC type registry
 * (`./iec-types-data.ts`), which is also the source emitted as
 * `libs/iec-types.json`. Single source of truth — adding a new
 * elementary type happens in one place.
 */
export function isElementaryType(name) {
    return isBaseTypeName(name);
}
/**
 * Type Registry for managing user-defined types
 */
export class TypeRegistry {
    types = new Map();
    /**
     * Register a user-defined type
     */
    registerType(type) {
        this.types.set(type.name, type);
    }
    /**
     * Register multiple types at once
     */
    registerTypes(types) {
        for (const type of types) {
            this.registerType(type);
        }
    }
    /**
     * Look up a type by name
     */
    lookupType(name) {
        return this.types.get(name);
    }
    /**
     * Check if a type exists
     */
    hasType(name) {
        return this.types.has(name);
    }
    /**
     * Get all registered types
     */
    getAllTypes() {
        return Array.from(this.types.values());
    }
    /**
     * Get the number of registered types
     */
    get size() {
        return this.types.size;
    }
    /**
     * Clear all registered types
     */
    clear() {
        this.types.clear();
    }
    /**
     * Get types in dependency order (topological sort)
     * Types that depend on other types come after their dependencies.
     * This is essential for C++ code generation where types must be declared
     * before they are used.
     */
    getTypesInDependencyOrder() {
        const visited = new Set();
        const result = [];
        const visiting = new Set();
        const visit = (typeName) => {
            if (visited.has(typeName))
                return;
            if (visiting.has(typeName)) {
                return;
            }
            const type = this.types.get(typeName);
            if (!type)
                return;
            visiting.add(typeName);
            const dependencies = this.getTypeDependencies(type);
            for (const dep of dependencies) {
                if (this.types.has(dep)) {
                    visit(dep);
                }
            }
            visiting.delete(typeName);
            visited.add(typeName);
            result.push(type);
        };
        for (const typeName of this.types.keys()) {
            visit(typeName);
        }
        return result;
    }
    /**
     * Get the direct dependencies of a type (other user-defined types it references)
     */
    getTypeDependencies(type) {
        const deps = [];
        this.collectDependencies(type.definition, deps);
        return deps.filter((dep) => !isElementaryType(dep));
    }
    /**
     * Recursively collect type dependencies from a type definition
     */
    collectDependencies(def, deps) {
        switch (def.kind) {
            case "StructDefinition":
                this.collectStructDependencies(def, deps);
                break;
            case "EnumDefinition":
                this.collectEnumDependencies(def, deps);
                break;
            case "ArrayDefinition":
                this.collectArrayDependencies(def, deps);
                break;
            case "SubrangeDefinition":
                this.collectSubrangeDependencies(def, deps);
                break;
            case "TypeReference":
                this.collectTypeRefDependencies(def, deps);
                break;
        }
    }
    collectStructDependencies(def, deps) {
        for (const field of def.fields) {
            this.collectVarDeclDependencies(field, deps);
        }
    }
    collectVarDeclDependencies(decl, deps) {
        if (!deps.includes(decl.type.name)) {
            deps.push(decl.type.name);
        }
    }
    collectEnumDependencies(def, deps) {
        if (def.baseType && !deps.includes(def.baseType.name)) {
            deps.push(def.baseType.name);
        }
    }
    collectArrayDependencies(def, deps) {
        if (!deps.includes(def.elementType.name)) {
            deps.push(def.elementType.name);
        }
    }
    collectSubrangeDependencies(def, deps) {
        if (!deps.includes(def.baseType.name)) {
            deps.push(def.baseType.name);
        }
    }
    collectTypeRefDependencies(def, deps) {
        if (!deps.includes(def.name)) {
            deps.push(def.name);
        }
    }
    /**
     * Validate all registered types
     * Checks for:
     * - Undefined type references
     * - Circular dependencies
     * - Invalid type definitions
     */
    validate() {
        const errors = [];
        const warnings = [];
        for (const type of this.types.values()) {
            this.validateType(type, errors, warnings);
        }
        const cycleErrors = this.detectCycles();
        errors.push(...cycleErrors);
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }
    /**
     * Validate a single type declaration
     */
    validateType(type, errors, warnings) {
        const deps = this.getTypeDependencies(type);
        for (const dep of deps) {
            if (!isElementaryType(dep) && !this.types.has(dep)) {
                errors.push({
                    typeName: type.name,
                    message: `References undefined type '${dep}'`,
                });
            }
        }
        this.validateTypeDefinition(type.name, type.definition, errors, warnings);
    }
    /**
     * Validate a type definition
     */
    validateTypeDefinition(typeName, def, errors, _warnings) {
        switch (def.kind) {
            case "StructDefinition":
                if (def.fields.length === 0) {
                    errors.push({
                        typeName,
                        message: "Structure has no fields",
                    });
                }
                break;
            case "EnumDefinition":
                if (def.members.length === 0) {
                    errors.push({
                        typeName,
                        message: "Enumeration has no members",
                    });
                }
                break;
            case "ArrayDefinition":
                if (def.dimensions.length === 0) {
                    errors.push({
                        typeName,
                        message: "Array has no dimensions",
                    });
                }
                break;
        }
    }
    /**
     * Detect circular dependencies in type definitions
     */
    detectCycles() {
        const errors = [];
        const visited = new Set();
        const visiting = new Set();
        const visit = (typeName, path) => {
            if (visited.has(typeName))
                return false;
            if (visiting.has(typeName)) {
                const cycleStart = path.indexOf(typeName);
                const cycle = path.slice(cycleStart).concat(typeName);
                errors.push({
                    typeName: path[0] ?? typeName,
                    message: `Circular dependency detected: ${cycle.join(" -> ")}`,
                });
                return true;
            }
            const type = this.types.get(typeName);
            if (!type)
                return false;
            visiting.add(typeName);
            path.push(typeName);
            const deps = this.getTypeDependencies(type);
            for (const dep of deps) {
                if (this.types.has(dep)) {
                    if (visit(dep, path)) {
                        visiting.delete(typeName);
                        path.pop();
                        return true;
                    }
                }
            }
            visiting.delete(typeName);
            visited.add(typeName);
            path.pop();
            return false;
        };
        for (const typeName of this.types.keys()) {
            if (!visited.has(typeName)) {
                visit(typeName, []);
            }
        }
        return errors;
    }
}
//# sourceMappingURL=type-registry.js.map