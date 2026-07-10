// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2025 Autonomy / OpenPLC Project
/**
 * TestCodeGenerator — subclass of CodeGenerator for test main generation.
 *
 * Delegates all ST→C++ translation to the production codegen, adding only:
 * - "s." prefix for SETUP variables
 * - ".run()" invocation for program POUs
 * - POU type resolution from POUInfo metadata
 * - AST-aware type/signature generation via initFromAST()
 */
import { CodeGenerator } from "./codegen.js";
import { buildEnumMemberMap } from "../semantic/type-utils.js";
export class TestCodeGenerator extends CodeGenerator {
    pouMap;
    setupVarNames = new Set();
    /** User-defined function names (upper case) — skip std registry for these */
    userFunctionNames = new Set();
    constructor(pous, options = {}) {
        super(undefined, options);
        this.pouMap = new Map();
        for (const pou of pous) {
            this.pouMap.set(pou.name.toUpperCase(), pou);
            if (pou.kind === "functionBlock") {
                this.knownFBTypes.add(pou.name.toUpperCase());
            }
            if (pou.kind === "program") {
                this.knownProgramTypes.add(pou.name.toUpperCase());
            }
            if (pou.kind === "function") {
                this.userFunctionNames.add(pou.name.toUpperCase());
            }
        }
    }
    /**
     * Populate known type sets from the AST.
     * Mirrors what CodeGenerator.generate() does at startup so that
     * isUserDefinedType(), mapVarTypeToCpp() etc. work correctly for
     * struct/interface/FB types.
     */
    initFromAST(ast) {
        this.ast = ast;
        // Interfaces first — needed for FB interface method name resolution
        for (const iface of ast.interfaces) {
            this.knownInterfaceTypes.add(iface.name.toUpperCase());
            const ifaceMethods = new Set();
            for (const method of iface.methods) {
                this.methodNameMap.set(`${iface.name.toUpperCase()}.${method.name.toUpperCase()}`, method.name);
                ifaceMethods.add(method.name.toUpperCase());
            }
            this.interfaceMethodsByInterface.set(iface.name.toUpperCase(), ifaceMethods);
        }
        for (const fb of ast.functionBlocks) {
            this.knownFBTypes.add(fb.name.toUpperCase());
            for (const method of fb.methods) {
                this.methodNameMap.set(`${fb.name.toUpperCase()}.${method.name.toUpperCase()}`, method.name);
            }
            for (const prop of fb.properties) {
                this.propertyNameMap.set(`${fb.name.toUpperCase()}.${prop.name.toUpperCase()}`, prop.name);
            }
            // Precompute interface method names for field access mangling
            const ifaceMethods = this.getInterfaceMethodNames(fb);
            if (ifaceMethods.size > 0) {
                this.fbInterfaceMethodNames.set(fb.name.toUpperCase(), ifaceMethods);
            }
        }
        const enumDescriptors = [];
        for (const td of ast.types) {
            this.knownStructTypes.add(td.name.toUpperCase());
            if (td.definition?.kind === "EnumDefinition") {
                const memberNames = td.definition.members.map((m) => m.name);
                const members = new Set(memberNames.map((m) => m.toUpperCase()));
                this.enumTypeMembers.set(td.name.toUpperCase(), members);
                enumDescriptors.push({ name: td.name, members: memberNames });
            }
        }
        this.enumMemberToType = buildEnumMemberMap(enumDescriptors);
        for (const prog of ast.programs) {
            this.knownProgramTypes.add(prog.name.toUpperCase());
        }
        for (const func of ast.functions) {
            this.userFunctionNames.add(func.name.toUpperCase());
        }
    }
    /**
     * Generate a function signature using production codegen methods.
     * Returns the C++ return type and parameter strings.
     */
    generateFunctionSignature(func) {
        return {
            returnType: this.mapTypeRefToCpp(func.returnType),
            params: this.generateFunctionParams(func),
        };
    }
    /** Set names of SETUP variables that need "s." prefix. */
    setSetupVars(names) {
        this.setupVarNames = new Set(names);
    }
    /** Clear SETUP variable tracking. */
    clearSetupVars() {
        this.setupVarNames.clear();
    }
    /** Populate the scope's variable→type map for POU invocation detection. */
    setScopeFromVarTypes(varTypes) {
        this.currentScopeVarTypes.clear();
        for (const [name, typeName] of varTypes) {
            this.currentScopeVarTypes.set(name.toUpperCase(), typeName);
        }
    }
    /**
     * Resolve a dot-separated member access path, applying name mangling
     * where a member name collides with its type name in a class context.
     * E.g., ["CTRL", "SENSOR"] → "CTRL.SENSOR_" when SENSOR is type Sensor in Controller.
     */
    resolveMemberPath(path, prefix) {
        if (path.length === 0)
            return prefix;
        const parts = [];
        // First element is the root variable
        const rootName = path[0];
        parts.push(prefix + rootName);
        let currentType = this.currentScopeVarTypes.get(rootName.toUpperCase());
        for (let i = 1; i < path.length; i++) {
            const field = path[i];
            if (currentType && this.ast) {
                const memberType = this.resolveMemberType(currentType, field);
                // Check for field name vs type name collision
                const typeCollision = memberType &&
                    this.isUserDefinedType(memberType) &&
                    field.toUpperCase() === memberType.toUpperCase();
                // Check for field name vs interface method name collision
                const ifaceCollision = this.fbInterfaceMethodNames
                    .get(currentType.toUpperCase())
                    ?.has(field.toUpperCase()) ?? false;
                if (typeCollision || ifaceCollision) {
                    parts.push(`${field}_`);
                }
                else {
                    parts.push(field);
                }
                currentType = memberType;
            }
            else {
                parts.push(field);
            }
        }
        return parts.join(".");
    }
    /** Generate a C++ expression string from an AST Expression. */
    emitExpression(expr) {
        return this.generateExpression(expr);
    }
    /** Generate C++ statement(s) and append to output buffer. */
    emitStatement(stmt, indent) {
        this.generateStatement(stmt, indent);
    }
    /** Get the accumulated output lines. */
    getOutput() {
        return this.output;
    }
    /** Clear the accumulated output buffer. */
    clearOutput() {
        this.output.length = 0;
    }
    /**
     * Resolve a type to its C++ equivalent.
     * Accepts either a string type name or a TypeReference (preserving maxLength).
     * For POUs, maps to the C++ class name. For elementary types, delegates to base.
     */
    resolveType(typeOrName) {
        if (typeof typeOrName === "string") {
            const pou = this.pouMap.get(typeOrName.toUpperCase());
            if (pou)
                return pou.cppClassName;
            return this.mapVarTypeToCpp(typeOrName);
        }
        const pou = this.pouMap.get(typeOrName.name.toUpperCase());
        if (pou)
            return pou.cppClassName;
        // Use mapTypeRefToCpp to handle inline array types (__INLINE_ARRAY_*)
        // with arrayDimensions and elementTypeName
        return this.mapTypeRefToCpp(typeOrName);
    }
    // --- Hook overrides ---
    resolveVariableBaseName(name) {
        if (this.setupVarNames.has(name)) {
            return `s.${name}`;
        }
        return name;
    }
    /**
     * Override function call generation to skip std registry for user-defined functions.
     * In test context, user-defined functions like Add() should not be mapped to standard
     * library ADD() because the std library templates expect IECVar-wrapped arguments.
     */
    generateFunctionCallExpression(expr) {
        if (this.userFunctionNames.has(expr.functionName.toUpperCase())) {
            const args = expr.arguments
                .map((arg) => this.generateExpression(arg.value))
                .join(", ");
            return `${expr.functionName}(${args})`;
        }
        return super.generateFunctionCallExpression(expr);
    }
    emitPOUCallLine(instanceName, rawName, indent) {
        const varType = this.currentScopeVarTypes.get(rawName.toUpperCase());
        if (varType && this.knownProgramTypes.has(varType.toUpperCase())) {
            this.emit(`${indent}${instanceName}.run();`);
        }
        else {
            this.emit(`${indent}${instanceName}();`);
        }
    }
}
//# sourceMappingURL=test-codegen.js.map