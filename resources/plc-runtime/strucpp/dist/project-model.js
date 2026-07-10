// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2025 Autonomy / OpenPLC Project
/**
 * STruC++ Project Model
 *
 * This module defines the project model interfaces and provides a builder
 * that constructs the project model from the AST. It also performs validation
 * of the project structure, including VAR_GLOBAL and VAR_EXTERNAL resolution.
 */
/**
 * Get the effective namespace for a project model.
 * Returns the configured namespace, or the project name, or "strucpp" as fallback.
 */
export function getProjectNamespace(model) {
    if (model.config?.namespace) {
        return model.config.namespace;
    }
    if (model.config?.name) {
        return model.config.name;
    }
    return "strucpp";
}
/**
 * Resolve a qualified name to its namespace and local name.
 * Returns undefined if the name is not qualified.
 */
export function resolveQualifiedName(name) {
    const dotIndex = name.indexOf(".");
    if (dotIndex === -1) {
        return undefined;
    }
    return {
        namespace: name.substring(0, dotIndex),
        localName: name.substring(dotIndex + 1),
    };
}
/**
 * Convert an IEC qualified name to C++ qualified name.
 * Replaces dots with double colons.
 */
export function toQualifiedCppName(name) {
    return name.replace(/\./g, "::");
}
// =============================================================================
// Time Literal Parsing
// =============================================================================
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
export function parseDateLiteralToDays(literal) {
    const stripped = literal.replace(/^(D|DATE)#/i, "");
    const m = stripped.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m)
        return 0n;
    const MS_PER_DAY = 86400000n;
    const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return BigInt(ms) / MS_PER_DAY;
}
/**
 * Parse an IEC TIME_OF_DAY literal (`TOD#HH:MM:SS[.fff]` /
 * `TIME_OF_DAY#…`) into nanoseconds since midnight. The optional
 * fractional-seconds tail is treated as a decimal fraction of a
 * second, capped at sub-nanosecond precision (extra digits beyond
 * 9 are truncated, not rounded — there's no IEC-standardised
 * rounding mode). Returns 0 for unparsable input.
 */
export function parseTodLiteralToNs(literal) {
    const stripped = literal.replace(/^(TOD|TIME_OF_DAY)#/i, "");
    const m = stripped.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d+))?)?$/);
    if (!m)
        return 0n;
    const hh = m[1] ?? "0";
    const mm = m[2] ?? "0";
    const ss = m[3] ?? "0";
    const frac = m[4] ?? "";
    const NS_PER_SEC = 1000000000n;
    const NS_PER_MIN = 60n * NS_PER_SEC;
    const NS_PER_HOUR = 60n * NS_PER_MIN;
    const fracPadded = (frac + "000000000").slice(0, 9);
    return (BigInt(hh) * NS_PER_HOUR +
        BigInt(mm) * NS_PER_MIN +
        BigInt(ss) * NS_PER_SEC +
        BigInt(fracPadded || "0"));
}
/**
 * Parse an IEC DATE_AND_TIME literal (`DT#YYYY-MM-DD-HH:MM:SS[.fff]`
 * / `DATE_AND_TIME#…`) into nanoseconds since the Unix epoch (UTC).
 * Returns 0 for unparsable input.
 */
export function parseDtLiteralToNs(literal) {
    const stripped = literal.replace(/^(DT|DATE_AND_TIME)#/i, "");
    const m = stripped.match(/^(\d{4})-(\d{1,2})-(\d{1,2})-(\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d+))?)?$/);
    if (!m)
        return 0n;
    const y = m[1] ?? "0";
    const mo = m[2] ?? "0";
    const d = m[3] ?? "0";
    const hh = m[4] ?? "0";
    const mm = m[5] ?? "0";
    const ss = m[6] ?? "0";
    const frac = m[7] ?? "";
    const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    const fracPadded = (frac + "000000000").slice(0, 9);
    return BigInt(ms) * 1000000n + BigInt(fracPadded || "0");
}
export function parseTimeLiteral(literal) {
    const rawValue = literal;
    let nanoseconds = 0;
    // Remove T# or TIME# prefix (case insensitive)
    let value = literal.replace(/^(T|TIME)#/i, "");
    // Parse components: d (days), h (hours), m (minutes), s (seconds), ms (milliseconds), us (microseconds), ns (nanoseconds)
    const patterns = [
        { regex: /(\d+(?:\.\d+)?)d/i, multiplier: 24 * 60 * 60 * 1_000_000_000 },
        { regex: /(\d+(?:\.\d+)?)h/i, multiplier: 60 * 60 * 1_000_000_000 },
        { regex: /(\d+(?:\.\d+)?)m(?!s)/i, multiplier: 60 * 1_000_000_000 },
        { regex: /(\d+(?:\.\d+)?)s(?!$)/i, multiplier: 1_000_000_000 },
        { regex: /(\d+(?:\.\d+)?)ms/i, multiplier: 1_000_000 },
        { regex: /(\d+(?:\.\d+)?)us/i, multiplier: 1_000 },
        { regex: /(\d+(?:\.\d+)?)ns/i, multiplier: 1 },
        // Handle bare seconds at the end (e.g., T#1s)
        { regex: /(\d+(?:\.\d+)?)s$/i, multiplier: 1_000_000_000 },
    ];
    for (const { regex, multiplier } of patterns) {
        const match = value.match(regex);
        if (match && match[1] !== undefined) {
            nanoseconds += parseFloat(match[1]) * multiplier;
            value = value.replace(regex, "");
        }
    }
    return { nanoseconds, rawValue };
}
// =============================================================================
// Project Model Builder
// =============================================================================
/**
 * Builds a ProjectModel from a CompilationUnit AST.
 */
export class ProjectModelBuilder {
    errors = [];
    warnings = [];
    programs = new Map();
    functions = new Map();
    functionBlocks = new Map();
    configurations = [];
    /**
     * Build the project model from an AST.
     */
    build(ast) {
        this.errors = [];
        this.warnings = [];
        this.programs = new Map();
        this.functions = new Map();
        this.functionBlocks = new Map();
        this.configurations = [];
        // First pass: collect all program, function, and function block declarations
        for (const prog of ast.programs) {
            this.processProgram(prog);
        }
        for (const func of ast.functions) {
            this.processFunction(func);
        }
        for (const fb of ast.functionBlocks) {
            this.processFunctionBlock(fb);
        }
        // Second pass: process configurations and validate references
        for (const config of ast.configurations) {
            this.processConfiguration(config);
        }
        // Third pass: validate VAR_EXTERNAL references
        this.validateExternalReferences();
        return {
            success: this.errors.length === 0,
            model: {
                configurations: this.configurations,
                programs: this.programs,
                functions: this.functions,
                functionBlocks: this.functionBlocks,
            },
            errors: this.errors,
            warnings: this.warnings,
        };
    }
    /**
     * Process a program declaration.
     */
    processProgram(prog) {
        const name = prog.name.toUpperCase();
        if (this.programs.has(name)) {
            this.addError(`Duplicate program declaration: ${prog.name}`, prog.sourceSpan.startLine, prog.sourceSpan.startCol);
            return;
        }
        const varDeclarations = [];
        const varExternal = [];
        for (const block of prog.varBlocks) {
            if (block.blockType === "VAR_EXTERNAL") {
                for (const decl of block.declarations) {
                    for (const varName of decl.names) {
                        // Carry type-shape metadata through so codegen can rebuild
                        // Array1D<...> / IEC_Ptr<...> instead of falling through to
                        // mapVarTypeToCpp's IEC_${name} default.
                        varExternal.push({
                            name: varName,
                            typeName: decl.type.name,
                            ...(decl.type.maxLength !== undefined
                                ? { maxLength: decl.type.maxLength }
                                : {}),
                            ...(decl.type.arrayDimensions !== undefined
                                ? { arrayDimensions: decl.type.arrayDimensions }
                                : {}),
                            ...(decl.type.elementTypeName !== undefined
                                ? { elementTypeName: decl.type.elementTypeName }
                                : {}),
                            ...(decl.type.referenceKind !== undefined &&
                                decl.type.referenceKind !== "none"
                                ? { referenceKind: decl.type.referenceKind }
                                : {}),
                        });
                    }
                }
            }
            else {
                for (const decl of block.declarations) {
                    for (const varName of decl.names) {
                        varDeclarations.push(this.convertVarDeclaration(varName, decl, block));
                    }
                }
            }
        }
        this.programs.set(name, {
            name: prog.name,
            varDeclarations,
            varExternal,
            hasBody: prog.body.length > 0,
        });
    }
    /**
     * Process a function declaration.
     */
    processFunction(func) {
        const name = func.name.toUpperCase();
        if (this.functions.has(name)) {
            this.addError(`Duplicate function declaration: ${func.name}`, func.sourceSpan.startLine, func.sourceSpan.startCol);
            return;
        }
        const parameters = [];
        for (const block of func.varBlocks) {
            if (block.blockType === "VAR_INPUT") {
                for (const decl of block.declarations) {
                    for (const varName of decl.names) {
                        parameters.push(this.convertVarDeclaration(varName, decl, block));
                    }
                }
            }
        }
        this.functions.set(name, {
            name: func.name,
            returnType: func.returnType.name,
            parameters,
        });
    }
    /**
     * Process a function block declaration.
     */
    processFunctionBlock(fb) {
        const name = fb.name.toUpperCase();
        if (this.functionBlocks.has(name)) {
            this.addError(`Duplicate function block declaration: ${fb.name}`, fb.sourceSpan.startLine, fb.sourceSpan.startCol);
            return;
        }
        const inputs = [];
        const outputs = [];
        const inouts = [];
        const locals = [];
        for (const block of fb.varBlocks) {
            const target = block.blockType === "VAR_INPUT"
                ? inputs
                : block.blockType === "VAR_OUTPUT"
                    ? outputs
                    : block.blockType === "VAR_IN_OUT"
                        ? inouts
                        : locals;
            for (const decl of block.declarations) {
                for (const varName of decl.names) {
                    target.push(this.convertVarDeclaration(varName, decl, block));
                }
            }
        }
        this.functionBlocks.set(name, {
            name: fb.name,
            inputs,
            outputs,
            inouts,
            locals,
        });
    }
    /**
     * Process a configuration declaration.
     */
    processConfiguration(config) {
        const globalVars = [];
        // Collect VAR_GLOBAL declarations
        for (const block of config.varBlocks) {
            if (block.blockType === "VAR_GLOBAL") {
                for (const decl of block.declarations) {
                    for (const varName of decl.names) {
                        globalVars.push(this.convertVarDeclaration(varName, decl, block));
                    }
                }
            }
        }
        const resources = [];
        for (const resource of config.resources) {
            resources.push(this.processResource(resource, config.name));
        }
        this.configurations.push({
            name: config.name,
            globalVars,
            resources,
        });
    }
    /**
     * Process a resource declaration.
     */
    processResource(resource, configName) {
        const tasks = [];
        // First, collect all tasks
        const taskMap = new Map();
        for (const task of resource.tasks) {
            const taskDecl = this.processTask(task);
            taskMap.set(task.name.toUpperCase(), taskDecl);
            tasks.push(taskDecl);
        }
        // Then, assign program instances to tasks
        for (const instance of resource.programInstances) {
            const instanceDecl = this.processProgramInstance(instance, configName);
            // Validate program type exists
            if (!this.programs.has(instance.programType.toUpperCase())) {
                this.addError(`Unknown program type '${instance.programType}' in program instance '${instance.instanceName}'`, instance.sourceSpan.startLine, instance.sourceSpan.startCol);
            }
            // Add to appropriate task
            if (instance.taskName) {
                const task = taskMap.get(instance.taskName.toUpperCase());
                if (task) {
                    task.programInstances.push(instanceDecl);
                }
                else {
                    this.addError(`Unknown task '${instance.taskName}' in program instance '${instance.instanceName}'`, instance.sourceSpan.startLine, instance.sourceSpan.startCol);
                }
            }
            else {
                // Program instance without task - add to first task or create warning
                const firstTask = tasks[0];
                if (firstTask !== undefined) {
                    firstTask.programInstances.push(instanceDecl);
                    this.addWarning(`Program instance '${instance.instanceName}' has no task assignment, assigned to '${firstTask.name}'`, instance.sourceSpan.startLine, instance.sourceSpan.startCol);
                }
            }
        }
        return {
            name: resource.name,
            processor: resource.onType,
            tasks,
        };
    }
    /**
     * Process a task declaration.
     */
    processTask(task) {
        let interval;
        let priority;
        // Extract INTERVAL and PRIORITY from properties
        for (const [propName, expr] of task.properties) {
            const upperName = propName.toUpperCase();
            if (upperName === "INTERVAL") {
                interval = this.extractTimeValue(expr);
            }
            else if (upperName === "PRIORITY") {
                priority = this.extractIntValue(expr);
            }
        }
        // Use conditional spreading for optional properties to comply with exactOptionalPropertyTypes
        return {
            name: task.name,
            programInstances: [],
            ...(interval !== undefined ? { interval } : {}),
            ...(priority !== undefined ? { priority } : {}),
        };
    }
    /**
     * Process a program instance.
     */
    processProgramInstance(instance, _configName) {
        // Use conditional spreading for optional taskName to comply with exactOptionalPropertyTypes
        return {
            instanceName: instance.instanceName,
            programType: instance.programType,
            ...(instance.taskName !== undefined
                ? { taskName: instance.taskName }
                : {}),
        };
    }
    /**
     * Validate VAR_EXTERNAL references against VAR_GLOBAL declarations.
     */
    validateExternalReferences() {
        // Build a map of all global variables across all configurations
        const globalVarMap = new Map();
        for (const config of this.configurations) {
            for (const globalVar of config.globalVars) {
                const key = globalVar.name.toUpperCase();
                if (globalVarMap.has(key)) {
                    // Global variable defined in multiple configurations - this is allowed
                    // but we should check type consistency
                    const existing = globalVarMap.get(key);
                    if (existing.typeName.toUpperCase() !== globalVar.typeName.toUpperCase()) {
                        this.addWarning(`Global variable '${globalVar.name}' has different types in configurations '${existing.configName}' (${existing.typeName}) and '${config.name}' (${globalVar.typeName})`, 0, 0);
                    }
                }
                else {
                    globalVarMap.set(key, {
                        typeName: globalVar.typeName,
                        configName: config.name,
                    });
                }
            }
        }
        // Check each program's VAR_EXTERNAL references
        for (const prog of this.programs.values()) {
            for (const ext of prog.varExternal) {
                const key = ext.name.toUpperCase();
                const globalVar = globalVarMap.get(key);
                if (!globalVar) {
                    this.addError(`VAR_EXTERNAL '${ext.name}' in program '${prog.name}' has no matching VAR_GLOBAL declaration`, 0, 0);
                }
                else if (globalVar.typeName.toUpperCase() !== ext.typeName.toUpperCase()) {
                    this.addError(`Type mismatch for VAR_EXTERNAL '${ext.name}' in program '${prog.name}': expected '${globalVar.typeName}' but found '${ext.typeName}'`, 0, 0);
                }
            }
        }
    }
    /**
     * Convert an AST VarDeclaration to a ProjectVarDeclaration.
     */
    convertVarDeclaration(name, decl, block) {
        let initialValue;
        if (decl.initialValue) {
            initialValue = this.expressionToString(decl.initialValue);
        }
        // Use conditional spreading for optional properties to comply with exactOptionalPropertyTypes
        return {
            name,
            typeName: decl.type.name,
            isConstant: block.isConstant,
            isRetain: block.isRetain,
            ...(initialValue !== undefined ? { initialValue } : {}),
            ...(decl.address !== undefined ? { address: decl.address } : {}),
            ...(decl.type.maxLength !== undefined
                ? { maxLength: decl.type.maxLength }
                : {}),
            // Carry inline-array metadata through so codegen can rebuild
            // Array1D<T, L, U> instead of falling through to mapVarTypeToCpp's
            // IEC_${name} branch (which produces IEC___INLINE_ARRAY_<T>).
            ...(decl.type.arrayDimensions !== undefined
                ? { arrayDimensions: decl.type.arrayDimensions }
                : {}),
            ...(decl.type.elementTypeName !== undefined
                ? { elementTypeName: decl.type.elementTypeName }
                : {}),
            ...(decl.type.referenceKind !== undefined &&
                decl.type.referenceKind !== "none"
                ? { referenceKind: decl.type.referenceKind }
                : {}),
        };
    }
    /**
     * Extract a TIME value from an expression.
     */
    extractTimeValue(expr) {
        if (expr.kind === "LiteralExpression") {
            const lit = expr;
            if (lit.literalType === "TIME" && typeof lit.value === "string") {
                return parseTimeLiteral(lit.value);
            }
            // Handle raw string that might be a time literal
            if (typeof lit.rawValue === "string" &&
                lit.rawValue.match(/^T#|^TIME#/i)) {
                return parseTimeLiteral(lit.rawValue);
            }
        }
        return undefined;
    }
    /**
     * Extract an integer value from an expression.
     */
    extractIntValue(expr) {
        if (expr.kind === "LiteralExpression") {
            const lit = expr;
            if (typeof lit.value === "number") {
                return Math.floor(lit.value);
            }
        }
        return undefined;
    }
    /**
     * Convert an expression to a string representation.
     */
    expressionToString(expr) {
        if (expr.kind === "LiteralExpression") {
            const lit = expr;
            return lit.rawValue;
        }
        if (expr.kind === "UnaryExpression" &&
            (expr.operator === "-" || expr.operator === "+")) {
            // Preserve the sign on numeric literal initialisers (e.g. -5).
            // Without this the operand is dropped and the initialiser silently
            // falls back to the type's default (0). Codegen lowers the result.
            const inner = this.expressionToString(expr.operand);
            return inner === "" ? "" : `${expr.operator}${inner}`;
        }
        if (expr.kind === "VariableExpression") {
            if (expr.fieldAccess.length > 0) {
                return `${expr.name}.${expr.fieldAccess.join(".")}`;
            }
            return expr.name;
        }
        return "";
    }
    /**
     * Add an error message.
     */
    addError(message, line, column) {
        this.errors.push({
            message,
            line,
            column,
            severity: "error",
        });
    }
    /**
     * Add a warning message.
     */
    addWarning(message, line, column) {
        this.warnings.push({
            message,
            line,
            column,
            severity: "warning",
        });
    }
}
/**
 * Build a project model from an AST.
 * Convenience function that creates a builder and builds the model.
 */
export function buildProjectModel(ast) {
    const builder = new ProjectModelBuilder();
    return builder.build(ast);
}
//# sourceMappingURL=project-model.js.map