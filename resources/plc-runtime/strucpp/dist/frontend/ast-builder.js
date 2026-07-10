// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2025 Autonomy / OpenPLC Project
/**
 * STruC++ CST to AST Builder
 *
 * This module converts the Chevrotain Concrete Syntax Tree (CST) produced by
 * the parser into the Abstract Syntax Tree (AST) defined in ast.ts.
 */
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Create a source span from a token.
 */
function tokenToSourceSpan(token) {
    return {
        file: "",
        startLine: token.startLine ?? 0,
        endLine: token.endLine ?? 0,
        startCol: token.startColumn ?? 0,
        endCol: token.endColumn ?? 0,
    };
}
/**
 * Create a source span from a CST node.
 */
function nodeToSourceSpan(node) {
    const children = node.children;
    let startLine = Number.MAX_SAFE_INTEGER;
    let endLine = 0;
    let startCol = Number.MAX_SAFE_INTEGER;
    let endCol = 0;
    for (const key of Object.keys(children)) {
        const childArray = children[key];
        if (!childArray)
            continue;
        for (const child of childArray) {
            if ("image" in child) {
                // It's a token
                const sl = child.startLine;
                const sc = child.startColumn ?? 0;
                if (sl !== undefined &&
                    (sl < startLine || (sl === startLine && sc < startCol))) {
                    startLine = sl;
                    startCol = sc;
                }
                const el = child.endLine;
                const ec = child.endColumn ?? 0;
                if (el !== undefined &&
                    (el > endLine || (el === endLine && ec > endCol))) {
                    endLine = el;
                    endCol = ec;
                }
            }
            else {
                // It's a CstNode — recurse to find nested tokens
                const subSpan = nodeToSourceSpan(child);
                if (subSpan.startLine > 0 &&
                    (subSpan.startLine < startLine ||
                        (subSpan.startLine === startLine && subSpan.startCol < startCol))) {
                    startLine = subSpan.startLine;
                    startCol = subSpan.startCol;
                }
                if (subSpan.endLine > endLine ||
                    (subSpan.endLine === endLine && subSpan.endCol > endCol)) {
                    endLine = subSpan.endLine;
                    endCol = subSpan.endCol;
                }
            }
        }
    }
    return {
        file: "",
        startLine: startLine === Number.MAX_SAFE_INTEGER ? 0 : startLine,
        endLine,
        startCol: startCol === Number.MAX_SAFE_INTEGER ? 0 : startCol,
        endCol,
    };
}
/**
 * Get the first token from a CST node children array.
 */
function getFirstToken(items) {
    if (!items || items.length === 0)
        return undefined;
    const first = items[0];
    if (first && "image" in first)
        return first;
    return undefined;
}
/**
 * Get the first CST node from a children array.
 */
function getFirstNode(items) {
    if (!items || items.length === 0)
        return undefined;
    const first = items[0];
    if (first && "children" in first)
        return first;
    return undefined;
}
/**
 * Get all CST nodes from a children array.
 */
function getAllNodes(items) {
    if (!items)
        return [];
    return items.filter((item) => "children" in item);
}
/**
 * Get all tokens from a children array.
 */
function getAllTokens(items) {
    if (!items)
        return [];
    return items.filter((item) => "image" in item);
}
/**
 * Get the start offset of a CST node by finding its earliest token.
 */
function getNodeStartOffset(node) {
    const children = node.children;
    let minOffset = Number.MAX_SAFE_INTEGER;
    for (const key of Object.keys(children)) {
        const childArray = children[key];
        if (!childArray)
            continue;
        for (const child of childArray) {
            if ("image" in child) {
                // It's a token
                if (child.startOffset < minOffset)
                    minOffset = child.startOffset;
            }
            else if ("children" in child) {
                // It's a CST node — recurse
                const childOffset = getNodeStartOffset(child);
                if (childOffset < minOffset)
                    minOffset = childOffset;
            }
        }
    }
    return minOffset;
}
/**
 * Extract the identifier string from an identifierOrKeyword CST node.
 * The node contains either an Identifier token or one of the contextual keyword tokens
 * (SET, GET, ON, OVERRIDE, ABSTRACT, FINAL).
 */
function getIdentifierOrKeywordImage(node) {
    const children = node.children;
    // Check Identifier first (most common case)
    const identToken = getFirstToken(children.Identifier);
    if (identToken)
        return identToken.image;
    // Check each contextual keyword token
    for (const key of [
        "SET",
        "GET",
        "ON",
        "OVERRIDE",
        "ABSTRACT",
        "FINAL",
        "AND",
        "OR",
        "XOR",
        "NOT",
        "MOD",
    ]) {
        const kwToken = getFirstToken(children[key]);
        if (kwToken)
            return kwToken.image;
    }
    return "";
}
/**
 * Extract all identifier strings from an array of identifierOrKeyword CST nodes.
 */
function getAllIdentifierOrKeywordImages(items) {
    if (!items)
        return [];
    const nodes = items.filter((item) => "children" in item);
    return nodes.map(getIdentifierOrKeywordImage);
}
/**
 * Parse an IEC 61131-3 integer literal that may use based notation (16#FF, 8#77, 2#1010).
 */
function parseIECInteger(raw) {
    const upper = raw.toUpperCase().replace(/_/g, "");
    if (upper.startsWith("16#"))
        return parseInt(upper.slice(3), 16);
    if (upper.startsWith("8#"))
        return parseInt(upper.slice(2), 8);
    if (upper.startsWith("2#"))
        return parseInt(upper.slice(2), 2);
    return parseInt(upper, 10);
}
/**
 * Parse an IEC 61131-3 numeric literal (integer or real) that may use based notation.
 * Handles 16#FF, 8#77, 2#1010, plain integers, and real literals (1.5, 1.5E10).
 */
function parseIECNumeric(raw) {
    if (raw.includes(".") || /[eE]/.test(raw)) {
        return parseFloat(raw.replace(/_/g, ""));
    }
    return parseIECInteger(raw);
}
// =============================================================================
// AST Builder Class
// =============================================================================
/**
 * Builds an AST from a Chevrotain CST.
 */
export class ASTBuilder {
    /**
     * Map of constant names to their integer values, populated per POU.
     * Used by extractIntegerFromExpression to resolve array dimension bounds
     * that reference VAR CONSTANT declarations (e.g., ARRAY[0..n] where n is a constant).
     * Global constants (from compile options) are seeded first and persist across POUs.
     */
    currentConstantMap = new Map();
    /** Global constants that persist across POU scans (never cleared). */
    globalConstantMap = new Map();
    /** Seed a global constant for dimension resolution. */
    setGlobalConstant(name, value) {
        this.globalConstantMap.set(name.toUpperCase(), value);
    }
    /**
     * Scan raw CST varBlock nodes for CONSTANT declarations and populate
     * currentConstantMap with their integer values.
     */
    scanVarBlocksForConstants(varBlockNodes) {
        this.currentConstantMap.clear();
        // Seed with global constants so they're always available
        for (const [name, value] of this.globalConstantMap) {
            this.currentConstantMap.set(name, value);
        }
        for (const vbNode of varBlockNodes) {
            const vbChildren = vbNode.children;
            if (!vbChildren.CONSTANT)
                continue;
            for (const declNode of getAllNodes(vbChildren.varDeclaration)) {
                const declChildren = declNode.children;
                const names = getAllIdentifierOrKeywordImages(declChildren.identifierOrKeyword);
                const initExprNode = getFirstNode(declChildren.initializerExpression);
                if (!initExprNode || names.length === 0)
                    continue;
                const initChildren = initExprNode.children;
                const exprNodes = getAllNodes(initChildren.expression);
                if (exprNodes.length !== 1)
                    continue;
                try {
                    const expr = this.buildExpression(exprNodes[0]);
                    if (!expr)
                        continue;
                    let val;
                    if (expr.kind === "LiteralExpression") {
                        const n = Number(expr.value);
                        if (!isNaN(n) && Number.isInteger(n))
                            val = n;
                    }
                    else if (expr.kind === "UnaryExpression" &&
                        expr.operator === "-" &&
                        expr.operand.kind === "LiteralExpression") {
                        const n = -Number(expr.operand.value);
                        if (!isNaN(n) && Number.isInteger(n))
                            val = n;
                    }
                    if (val !== undefined) {
                        for (const name of names) {
                            this.currentConstantMap.set(name.toUpperCase(), val);
                        }
                    }
                }
                catch {
                    // Skip unparseable initializers
                }
            }
        }
    }
    /**
     * Build a CompilationUnit from the root CST node.
     */
    buildCompilationUnit(cst) {
        const children = cst.children;
        const programs = [];
        const functions = [];
        const functionBlocks = [];
        const interfaces = [];
        const types = [];
        const configurations = [];
        // Process program declarations
        for (const node of getAllNodes(children.programDeclaration)) {
            programs.push(this.buildProgramDeclaration(node));
        }
        // Process function declarations
        for (const node of getAllNodes(children.functionDeclaration)) {
            functions.push(this.buildFunctionDeclaration(node));
        }
        // Process function block declarations
        for (const node of getAllNodes(children.functionBlockDeclaration)) {
            functionBlocks.push(this.buildFunctionBlockDeclaration(node));
        }
        // Process interface declarations
        for (const node of getAllNodes(children.interfaceDeclaration)) {
            interfaces.push(this.buildInterfaceDeclaration(node));
        }
        // Process type declarations (TYPE...END_TYPE blocks can contain multiple types)
        for (const node of getAllNodes(children.typeDeclaration)) {
            types.push(...this.buildTypeDeclarationBlock(node));
        }
        // Process configuration declarations
        for (const node of getAllNodes(children.configurationDeclaration)) {
            configurations.push(this.buildConfigurationDeclaration(node));
        }
        // Process top-level VAR_GLOBAL blocks (GVL files)
        const globalVarBlocks = [];
        for (const node of getAllNodes(children.varBlock)) {
            globalVarBlocks.push(this.buildVarBlock(node));
        }
        return {
            kind: "CompilationUnit",
            sourceSpan: nodeToSourceSpan(cst),
            programs,
            functions,
            functionBlocks,
            interfaces,
            types,
            configurations,
            globalVarBlocks,
        };
    }
    /**
     * Build a ProgramDeclaration from a CST node.
     */
    buildProgramDeclaration(node) {
        const children = node.children;
        const nameToken = getAllTokens(children.Identifier)[0];
        const name = nameToken?.image ?? "";
        // Scan for constants before building var blocks (for array dimension resolution)
        this.scanVarBlocksForConstants(getAllNodes(children.varBlock));
        const varBlocks = [];
        for (const varBlockNode of getAllNodes(children.varBlock)) {
            varBlocks.push(this.buildVarBlock(varBlockNode));
        }
        const body = [];
        // Statements are wrapped in a statementList node
        const stmtListNode = getFirstNode(children.statementList);
        if (stmtListNode) {
            const stmtListChildren = stmtListNode.children;
            for (const stmtNode of getAllNodes(stmtListChildren.statement)) {
                const stmt = this.buildStatement(stmtNode);
                if (stmt)
                    body.push(...(Array.isArray(stmt) ? stmt : [stmt]));
            }
        }
        return {
            kind: "ProgramDeclaration",
            sourceSpan: nodeToSourceSpan(node),
            name,
            varBlocks,
            body,
        };
    }
    /**
     * Build a FunctionDeclaration from a CST node.
     */
    buildFunctionDeclaration(node) {
        const children = node.children;
        // Function name comes from identifierOrKeyword (allows OVERRIDE etc. as names)
        const idOrKwNodes = getAllNodes(children.identifierOrKeyword);
        const name = idOrKwNodes[0]
            ? getIdentifierOrKeywordImage(idOrKwNodes[0])
            : "";
        // Get return type from the dataType subrule
        const dataTypeNode = getFirstNode(children.dataType);
        let returnType;
        if (dataTypeNode) {
            returnType = this.buildTypeReference(dataTypeNode);
        }
        else {
            // Fallback to VOID if no return type specified
            returnType = {
                kind: "TypeReference",
                sourceSpan: nodeToSourceSpan(node),
                name: "VOID",
                isReference: false,
                referenceKind: "none",
            };
        }
        // Scan for constants before building var blocks (for array dimension resolution)
        this.scanVarBlocksForConstants(getAllNodes(children.varBlock));
        const varBlocks = [];
        for (const varBlockNode of getAllNodes(children.varBlock)) {
            varBlocks.push(this.buildVarBlock(varBlockNode));
        }
        const body = [];
        // Statements are wrapped in a statementList node
        const stmtListNode = getFirstNode(children.statementList);
        if (stmtListNode) {
            const stmtListChildren = stmtListNode.children;
            for (const stmtNode of getAllNodes(stmtListChildren.statement)) {
                const stmt = this.buildStatement(stmtNode);
                if (stmt)
                    body.push(...(Array.isArray(stmt) ? stmt : [stmt]));
            }
        }
        return {
            kind: "FunctionDeclaration",
            sourceSpan: nodeToSourceSpan(node),
            name,
            returnType,
            varBlocks,
            body,
        };
    }
    /**
     * Build a FunctionBlockDeclaration from a CST node.
     */
    buildFunctionBlockDeclaration(node) {
        const children = node.children;
        // FB name comes from identifierOrKeyword subrule (allows contextual keywords as names)
        const idOrKwNodes = getAllNodes(children.identifierOrKeyword);
        const name = idOrKwNodes[0]
            ? getIdentifierOrKeywordImage(idOrKwNodes[0])
            : "";
        // Check for ABSTRACT/FINAL modifiers
        const isAbstract = !!children.ABSTRACT;
        const isFinal = !!children.FINAL;
        // Remaining Identifier tokens are for EXTENDS and IMPLEMENTS clauses
        const allIdentifiers = getAllTokens(children.Identifier);
        // Check for EXTENDS clause
        let extendsName;
        if (children.EXTENDS) {
            // The identifier after EXTENDS is the first Identifier token
            extendsName = allIdentifiers[0]?.image;
        }
        // Check for IMPLEMENTS clause (identifiers after IMPLEMENTS keyword)
        let implementsList;
        if (children.IMPLEMENTS) {
            // Skip the EXTENDS identifier if present
            const startIdx = extendsName ? 1 : 0;
            const implNames = allIdentifiers.slice(startIdx).map((t) => t.image);
            if (implNames.length > 0) {
                implementsList = implNames;
            }
        }
        // Scan for constants before building var blocks (for array dimension resolution)
        this.scanVarBlocksForConstants(getAllNodes(children.varBlock));
        const varBlocks = [];
        for (const varBlockNode of getAllNodes(children.varBlock)) {
            varBlocks.push(this.buildVarBlock(varBlockNode));
        }
        const methods = [];
        for (const methodNode of getAllNodes(children.methodDeclaration)) {
            methods.push(this.buildMethodDeclaration(methodNode));
        }
        const properties = [];
        for (const propNode of getAllNodes(children.propertyDeclaration)) {
            properties.push(this.buildPropertyDeclaration(propNode));
        }
        const body = [];
        // Statements are wrapped in a statementList node
        const stmtListNode = getFirstNode(children.statementList);
        if (stmtListNode) {
            const stmtListChildren = stmtListNode.children;
            for (const stmtNode of getAllNodes(stmtListChildren.statement)) {
                const stmt = this.buildStatement(stmtNode);
                if (stmt)
                    body.push(...(Array.isArray(stmt) ? stmt : [stmt]));
            }
        }
        return {
            kind: "FunctionBlockDeclaration",
            sourceSpan: nodeToSourceSpan(node),
            name,
            isAbstract,
            isFinal,
            varBlocks,
            methods,
            properties,
            body,
            ...(extendsName !== undefined ? { extends: extendsName } : {}),
            ...(implementsList !== undefined ? { implements: implementsList } : {}),
        };
    }
    /**
     * Build an InterfaceDeclaration from a CST node.
     */
    buildInterfaceDeclaration(node) {
        const children = node.children;
        const allIdentifiers = getAllTokens(children.Identifier);
        const name = allIdentifiers[0]?.image ?? "";
        // Check for EXTENDS clause
        let extendsList;
        if (children.EXTENDS) {
            const extNames = allIdentifiers.slice(1).map((t) => t.image);
            if (extNames.length > 0) {
                extendsList = extNames;
            }
        }
        // Build interface methods
        const methods = [];
        for (const methodNode of getAllNodes(children.interfaceMethodDeclaration)) {
            methods.push(this.buildInterfaceMethodDeclaration(methodNode));
        }
        return {
            kind: "InterfaceDeclaration",
            sourceSpan: nodeToSourceSpan(node),
            name,
            methods,
            ...(extendsList !== undefined ? { extends: extendsList } : {}),
        };
    }
    /**
     * Build a MethodDeclaration from an interface method CST node.
     * Interface methods are implicitly public and abstract.
     */
    buildInterfaceMethodDeclaration(node) {
        const children = node.children;
        const nameToken = getAllTokens(children.Identifier)[0];
        const name = nameToken?.image ?? "";
        // Optional return type
        let returnType;
        const dataTypeNode = getFirstNode(children.dataType);
        if (dataTypeNode) {
            returnType = this.buildTypeReference(dataTypeNode);
        }
        // VAR blocks (VAR_INPUT)
        const varBlocks = [];
        for (const varBlockNode of getAllNodes(children.varBlock)) {
            varBlocks.push(this.buildVarBlock(varBlockNode));
        }
        return {
            kind: "MethodDeclaration",
            sourceSpan: nodeToSourceSpan(node),
            name,
            visibility: "PUBLIC",
            isAbstract: true,
            isFinal: false,
            isOverride: false,
            varBlocks,
            body: [],
            ...(returnType !== undefined ? { returnType } : {}),
        };
    }
    /**
     * Build a MethodDeclaration from a methodDeclaration CST node.
     */
    buildMethodDeclaration(node) {
        const children = node.children;
        const nameToken = getAllTokens(children.Identifier)[0];
        const name = nameToken?.image ?? "";
        // Visibility modifier
        let visibility = "PUBLIC";
        if (children.PRIVATE)
            visibility = "PRIVATE";
        else if (children.PROTECTED)
            visibility = "PROTECTED";
        // Modifiers
        const isAbstract = !!children.ABSTRACT;
        const isFinal = !!children.FINAL;
        const isOverride = !!children.OVERRIDE;
        // Optional return type
        let returnType;
        const dataTypeNode = getFirstNode(children.dataType);
        if (dataTypeNode) {
            returnType = this.buildTypeReference(dataTypeNode);
        }
        // VAR blocks (uses methodVarBlock which supports VAR_INST)
        const varBlocks = [];
        for (const varBlockNode of getAllNodes(children.methodVarBlock)) {
            varBlocks.push(this.buildMethodVarBlock(varBlockNode));
        }
        // Method body
        const body = [];
        const stmtListNode = getFirstNode(children.statementList);
        if (stmtListNode) {
            const stmtListChildren = stmtListNode.children;
            for (const stmtNode of getAllNodes(stmtListChildren.statement)) {
                const stmt = this.buildStatement(stmtNode);
                if (stmt)
                    body.push(...(Array.isArray(stmt) ? stmt : [stmt]));
            }
        }
        return {
            kind: "MethodDeclaration",
            sourceSpan: nodeToSourceSpan(node),
            name,
            visibility,
            isAbstract,
            isFinal,
            isOverride,
            varBlocks,
            body,
            ...(returnType !== undefined ? { returnType } : {}),
        };
    }
    /**
     * Build a VarBlock from a methodVarBlock CST node (supports VAR_INST).
     */
    buildMethodVarBlock(node) {
        const children = node.children;
        let blockType = "VAR";
        if (children.VAR_INPUT)
            blockType = "VAR_INPUT";
        else if (children.VAR_OUTPUT)
            blockType = "VAR_OUTPUT";
        else if (children.VAR_IN_OUT)
            blockType = "VAR_IN_OUT";
        else if (children.VAR_TEMP)
            blockType = "VAR_TEMP";
        else if (children.VAR_INST)
            blockType = "VAR_INST";
        const isConstant = !!children.CONSTANT;
        const isRetain = !!children.RETAIN;
        const declarations = [];
        for (const declNode of getAllNodes(children.varDeclaration)) {
            declarations.push(this.buildVarDeclaration(declNode));
        }
        return {
            kind: "VarBlock",
            sourceSpan: nodeToSourceSpan(node),
            blockType,
            isConstant,
            isRetain,
            declarations,
        };
    }
    /**
     * Build a PropertyDeclaration from a propertyDeclaration CST node.
     */
    buildPropertyDeclaration(node) {
        const children = node.children;
        const nameToken = getAllTokens(children.Identifier)[0];
        const name = nameToken?.image ?? "";
        // Visibility modifier
        let visibility = "PUBLIC";
        if (children.PRIVATE)
            visibility = "PRIVATE";
        else if (children.PROTECTED)
            visibility = "PROTECTED";
        // Property type
        const dataTypeNode = getFirstNode(children.dataType);
        const type = dataTypeNode
            ? this.buildTypeReference(dataTypeNode)
            : {
                kind: "TypeReference",
                sourceSpan: nodeToSourceSpan(node),
                name: "INT",
                isReference: false,
                referenceKind: "none",
            };
        // GET block
        let getter;
        const getterNode = getFirstNode(children.propertyGetter);
        if (getterNode) {
            const getterChildren = getterNode.children;
            const getterStmtList = getFirstNode(getterChildren.statementList);
            getter = this.extractStatementsFromList(getterStmtList);
        }
        // SET block
        let setter;
        const setterNode = getFirstNode(children.propertySetter);
        if (setterNode) {
            const setterChildren = setterNode.children;
            const setterStmtList = getFirstNode(setterChildren.statementList);
            setter = this.extractStatementsFromList(setterStmtList);
        }
        return {
            kind: "PropertyDeclaration",
            sourceSpan: nodeToSourceSpan(node),
            name,
            type,
            visibility,
            ...(getter !== undefined ? { getter } : {}),
            ...(setter !== undefined ? { setter } : {}),
        };
    }
    /**
     * Build TypeDeclarations from a TYPE...END_TYPE block CST node.
     * A single TYPE block can contain multiple type declarations.
     */
    buildTypeDeclarationBlock(node) {
        const children = node.children;
        const types = [];
        for (const singleTypeNode of getAllNodes(children.singleTypeDeclaration)) {
            types.push(this.buildSingleTypeDeclaration(singleTypeNode));
        }
        return types;
    }
    /**
     * Build a single TypeDeclaration from a singleTypeDeclaration CST node.
     */
    buildSingleTypeDeclaration(node) {
        const children = node.children;
        const nameToken = getAllTokens(children.Identifier)[0];
        const name = nameToken?.image ?? "";
        const definition = this.buildTypeDefinition(node);
        return {
            kind: "TypeDeclaration",
            sourceSpan: nodeToSourceSpan(node),
            name,
            definition,
        };
    }
    /**
     * Build a TypeDefinition from a singleTypeDeclaration CST node.
     * Handles struct, enum (simple or typed), array, subrange, and alias types.
     */
    buildTypeDefinition(node) {
        const children = node.children;
        // Check for struct type
        const structNode = getFirstNode(children.structType);
        if (structNode) {
            return this.buildStructDefinition(structNode);
        }
        // Check for simple enum type: (RED, YELLOW, GREEN)
        const simpleEnumNode = getFirstNode(children.simpleEnumType);
        if (simpleEnumNode) {
            return this.buildSimpleEnumDefinition(simpleEnumNode);
        }
        // Check for array type (may include POINTER TO prefix from singleTypeDeclaration)
        const arrayNode = getFirstNode(children.arrayType);
        if (arrayNode) {
            // If POINTER TO prefix present, represent as TypeReference with arrayDimensions
            if (children.POINTER) {
                return this.buildPointerToArrayTypeReference(arrayNode);
            }
            return this.buildArrayDefinition(arrayNode);
        }
        // Check for typed enum, subrange, or alias
        const typedEnumOrSubrangeNode = getFirstNode(children.typedEnumOrSubrangeOrAlias);
        if (typedEnumOrSubrangeNode) {
            return this.buildTypedEnumOrSubrangeOrAlias(typedEnumOrSubrangeNode);
        }
        // Fallback to a simple type reference
        return {
            kind: "TypeReference",
            sourceSpan: nodeToSourceSpan(node),
            name: "INT",
            isReference: false,
            referenceKind: "none",
        };
    }
    /**
     * Build a StructDefinition from a structType CST node.
     */
    buildStructDefinition(node) {
        const children = node.children;
        const fields = [];
        for (const varDeclNode of getAllNodes(children.varDeclaration)) {
            fields.push(this.buildVarDeclaration(varDeclNode));
        }
        return {
            kind: "StructDefinition",
            sourceSpan: nodeToSourceSpan(node),
            fields,
        };
    }
    /**
     * Build an EnumDefinition from a simpleEnumType CST node.
     * Handles: (RED, YELLOW, GREEN) or (A := 0, B := 1)
     */
    buildSimpleEnumDefinition(node) {
        const children = node.children;
        const members = [];
        for (const memberNode of getAllNodes(children.enumMember)) {
            members.push(this.buildEnumMember(memberNode));
        }
        // Check for default value: := DefaultValue
        let defaultValue;
        const identifiers = getAllTokens(children.Identifier);
        if (identifiers.length > 0) {
            defaultValue = identifiers[0]?.image;
        }
        return {
            kind: "EnumDefinition",
            sourceSpan: nodeToSourceSpan(node),
            members,
            ...(defaultValue !== undefined ? { defaultValue } : {}),
        };
    }
    /**
     * Build an EnumMember from an enumMember CST node.
     */
    buildEnumMember(node) {
        const children = node.children;
        const nameToken = getAllTokens(children.Identifier)[0];
        const name = nameToken?.image ?? "";
        // Check for explicit value: := expression
        let value;
        const exprNode = getFirstNode(children.expression);
        if (exprNode) {
            const expr = this.buildExpression(exprNode);
            if (expr) {
                value = expr;
            }
        }
        return {
            kind: "EnumMember",
            sourceSpan: nodeToSourceSpan(node),
            name,
            ...(value !== undefined ? { value } : {}),
        };
    }
    /**
     * Build an ArrayDefinition from an arrayType CST node.
     */
    buildArrayDefinition(node) {
        const children = node.children;
        const dimensions = [];
        for (const dimNode of getAllNodes(children.arrayDimension)) {
            dimensions.push(this.buildArrayDimension(dimNode));
        }
        // Get element type from dataType
        const dataTypeNode = getFirstNode(children.dataType);
        const elementType = dataTypeNode
            ? this.buildTypeReference(dataTypeNode)
            : {
                kind: "TypeReference",
                sourceSpan: nodeToSourceSpan(node),
                name: "INT",
                isReference: false,
                referenceKind: "none",
            };
        return {
            kind: "ArrayDefinition",
            sourceSpan: nodeToSourceSpan(node),
            dimensions,
            elementType,
        };
    }
    /**
     * Build a TypeReference for POINTER TO ARRAY[...] OF T in TYPE declarations.
     * Represents the pointer-to-array as a TypeReference with arrayDimensions,
     * matching the representation used by varDeclaration for inline array types.
     */
    buildPointerToArrayTypeReference(arrayNode) {
        const arrayChildren = arrayNode.children;
        // Get element type from nested dataType
        const elementTypeNode = getFirstNode(arrayChildren.dataType);
        let elementTypeName = "INT";
        if (elementTypeNode) {
            const elemChildren = elementTypeNode.children;
            const elemNameToken = getFirstToken(elemChildren.Identifier);
            if (elemNameToken) {
                elementTypeName = elemNameToken.image;
            }
        }
        // Extract integer bounds from dimensions
        const dimNodes = getAllNodes(arrayChildren.arrayDimension);
        const arrayDimensions = [];
        for (const dimNode of dimNodes) {
            const dimChildren = dimNode.children;
            const exprNodes = getAllNodes(dimChildren.expression);
            if (exprNodes.length >= 2) {
                const startVal = this.extractIntegerFromExpression(exprNodes[0]);
                const endVal = this.extractIntegerFromExpression(exprNodes[1]);
                if (startVal !== undefined && endVal !== undefined) {
                    arrayDimensions.push({ start: startVal, end: endVal });
                }
            }
        }
        const result = {
            kind: "TypeReference",
            sourceSpan: nodeToSourceSpan(arrayNode),
            name: elementTypeName,
            isReference: true,
            referenceKind: "pointer_to",
        };
        if (arrayDimensions.length > 0) {
            result.arrayDimensions = arrayDimensions;
            result.elementTypeName = elementTypeName;
        }
        return result;
    }
    /**
     * Build an ArrayDimension from an arrayDimension CST node.
     */
    buildArrayDimension(node) {
        const children = node.children;
        // Check for variable-length dimension: ARRAY[*]
        const starTokens = getAllTokens(children.Star);
        if (starTokens.length > 0) {
            return {
                kind: "ArrayDimension",
                sourceSpan: nodeToSourceSpan(node),
                isVariableLength: true,
            };
        }
        // Fixed bounds: start..end
        const expressions = getAllNodes(children.expression);
        const startExpr = expressions[0]
            ? this.buildExpression(expressions[0])
            : undefined;
        const endExpr = expressions[1]
            ? this.buildExpression(expressions[1])
            : undefined;
        return {
            kind: "ArrayDimension",
            sourceSpan: nodeToSourceSpan(node),
            isVariableLength: false,
            start: startExpr ?? this.createDummyLiteral(node),
            end: endExpr ?? this.createDummyLiteral(node),
        };
    }
    /**
     * Build a TypeDefinition from a typedEnumOrSubrangeOrAlias CST node.
     * Handles:
     * - Typed enum: INT (IDLE := 0, RUNNING := 1)
     * - Subrange: INT(0..100)
     * - Alias: INT
     */
    buildTypedEnumOrSubrangeOrAlias(node) {
        const children = node.children;
        // Get the base type
        const dataTypeNode = getFirstNode(children.dataType);
        const baseType = dataTypeNode
            ? this.buildTypeReference(dataTypeNode)
            : {
                kind: "TypeReference",
                sourceSpan: nodeToSourceSpan(node),
                name: "INT",
                isReference: false,
                referenceKind: "none",
            };
        // Check for subrange bounds
        const subrangeBoundsNode = getFirstNode(children.subrangeBounds);
        if (subrangeBoundsNode) {
            return this.buildSubrangeDefinition(subrangeBoundsNode, baseType);
        }
        // Check for typed enum members
        const enumMemberNodes = getAllNodes(children.enumMember);
        if (enumMemberNodes.length > 0) {
            const members = [];
            for (const memberNode of enumMemberNodes) {
                members.push(this.buildEnumMember(memberNode));
            }
            return {
                kind: "EnumDefinition",
                sourceSpan: nodeToSourceSpan(node),
                baseType,
                members,
            };
        }
        // Simple alias - just return the type reference
        return baseType;
    }
    /**
     * Build a SubrangeDefinition from a subrangeBounds CST node.
     */
    buildSubrangeDefinition(node, baseType) {
        const children = node.children;
        const expressions = getAllNodes(children.expression);
        const lowerExpr = expressions[0]
            ? this.buildExpression(expressions[0])
            : undefined;
        const upperExpr = expressions[1]
            ? this.buildExpression(expressions[1])
            : undefined;
        const lowerBound = lowerExpr ?? this.createDummyLiteral(node);
        const upperBound = upperExpr ?? this.createDummyLiteral(node);
        return {
            kind: "SubrangeDefinition",
            sourceSpan: nodeToSourceSpan(node),
            baseType,
            lowerBound,
            upperBound,
        };
    }
    /**
     * Build a ConfigurationDeclaration from a CST node.
     */
    buildConfigurationDeclaration(node) {
        const children = node.children;
        const nameToken = getAllTokens(children.Identifier)[0];
        const name = nameToken?.image ?? "";
        const varBlocks = [];
        for (const varBlockNode of getAllNodes(children.varBlock)) {
            varBlocks.push(this.buildVarBlock(varBlockNode));
        }
        const resources = [];
        for (const resourceNode of getAllNodes(children.resourceDeclaration)) {
            resources.push(this.buildResourceDeclaration(resourceNode));
        }
        return {
            kind: "ConfigurationDeclaration",
            sourceSpan: nodeToSourceSpan(node),
            name,
            varBlocks,
            resources,
        };
    }
    /**
     * Build a ResourceDeclaration from a CST node.
     */
    buildResourceDeclaration(node) {
        const children = node.children;
        const identifiers = getAllTokens(children.Identifier);
        const name = identifiers[0]?.image ?? "";
        const onType = identifiers[1]?.image ?? "PLC";
        const tasks = [];
        for (const taskNode of getAllNodes(children.taskDeclaration)) {
            tasks.push(this.buildTaskDeclaration(taskNode));
        }
        const programInstances = [];
        for (const instanceNode of getAllNodes(children.programInstance)) {
            programInstances.push(this.buildProgramInstance(instanceNode));
        }
        return {
            kind: "ResourceDeclaration",
            sourceSpan: nodeToSourceSpan(node),
            name,
            onType,
            tasks,
            programInstances,
        };
    }
    /**
     * Build a TaskDeclaration from a CST node.
     */
    buildTaskDeclaration(node) {
        const children = node.children;
        const nameToken = getAllTokens(children.Identifier)[0];
        const name = nameToken?.image ?? "";
        // Parse task properties (INTERVAL, PRIORITY, etc.)
        const properties = new Map();
        const propIdentifiers = getAllTokens(children.Identifier);
        const expressions = getAllNodes(children.expression);
        // Skip the first identifier (task name), then pair remaining identifiers with expressions
        for (let i = 1; i < propIdentifiers.length && i - 1 < expressions.length; i++) {
            const propToken = propIdentifiers[i];
            const exprNode = expressions[i - 1];
            if (propToken && exprNode) {
                const propName = propToken.image;
                const expr = this.buildExpression(exprNode);
                if (expr) {
                    properties.set(propName, expr);
                }
            }
        }
        return {
            kind: "TaskDeclaration",
            sourceSpan: nodeToSourceSpan(node),
            name,
            properties,
        };
    }
    /**
     * Build a ProgramInstance from a CST node.
     */
    buildProgramInstance(node) {
        const children = node.children;
        const identifiers = getAllTokens(children.Identifier);
        // PROGRAM instanceName WITH taskName : programType
        // or PROGRAM instanceName : programType (no task)
        const instanceName = identifiers[0]?.image ?? "";
        let taskName;
        let programType;
        if (identifiers.length >= 3) {
            // Has WITH clause
            taskName = identifiers[1]?.image;
            programType = identifiers[2]?.image ?? "";
        }
        else {
            // No WITH clause
            programType = identifiers[1]?.image ?? "";
        }
        // Use conditional spreading for optional taskName to comply with exactOptionalPropertyTypes
        return {
            kind: "ProgramInstance",
            sourceSpan: nodeToSourceSpan(node),
            instanceName,
            programType,
            ...(taskName !== undefined ? { taskName } : {}),
        };
    }
    /**
     * Build a VarBlock from a CST node.
     */
    buildVarBlock(node) {
        const children = node.children;
        // Determine block type from keywords
        let blockType = "VAR";
        if (children.VAR_INPUT)
            blockType = "VAR_INPUT";
        else if (children.VAR_OUTPUT)
            blockType = "VAR_OUTPUT";
        else if (children.VAR_IN_OUT)
            blockType = "VAR_IN_OUT";
        else if (children.VAR_EXTERNAL)
            blockType = "VAR_EXTERNAL";
        else if (children.VAR_GLOBAL)
            blockType = "VAR_GLOBAL";
        else if (children.VAR_TEMP)
            blockType = "VAR_TEMP";
        const isConstant = !!children.CONSTANT;
        const isRetain = !!children.RETAIN;
        const declarations = [];
        for (const declNode of getAllNodes(children.varDeclaration)) {
            declarations.push(this.buildVarDeclaration(declNode));
        }
        return {
            kind: "VarBlock",
            sourceSpan: nodeToSourceSpan(node),
            blockType,
            isConstant,
            isRetain,
            declarations,
        };
    }
    /**
     * Build a VarDeclaration from a CST node.
     */
    buildVarDeclaration(node) {
        const children = node.children;
        // Variable names come from identifierOrKeyword subrule nodes (allows SET, ON, etc. as names)
        const names = getAllIdentifierOrKeywordImages(children.identifierOrKeyword);
        // Check for POINTER TO prefix at varDeclaration level (handles POINTER TO ARRAY[...] OF T)
        const hasPointerTo = !!children.POINTER;
        // Check for inline array type first (ARRAY[...] OF type)
        const arrayTypeNode = getFirstNode(children.arrayType);
        let type;
        if (arrayTypeNode) {
            type = this.buildInlineArrayTypeReference(arrayTypeNode, node);
        }
        else {
            // Get type reference from the dataType subrule
            const dataTypeNode = getFirstNode(children.dataType);
            if (dataTypeNode) {
                type = this.buildTypeReference(dataTypeNode);
            }
            else {
                // Fallback: default to INT if no type found
                type = {
                    kind: "TypeReference",
                    sourceSpan: nodeToSourceSpan(node),
                    name: "INT",
                    isReference: false,
                    referenceKind: "none",
                };
            }
        }
        // Apply POINTER TO from varDeclaration level (overrides any existing reference kind)
        if (hasPointerTo && type.referenceKind === "none") {
            type.referenceKind = "pointer_to";
            type.isReference = true;
        }
        // Get initial value if present (from initializerExpression rule)
        let initialValue;
        const initExprNode = getFirstNode(children.initializerExpression);
        if (initExprNode) {
            const initChildren = initExprNode.children;
            const exprNodes = getAllNodes(initChildren.expression);
            if (exprNodes.length > 1) {
                // Multiple expressions → ArrayLiteralExpression
                const elements = [];
                for (const en of exprNodes) {
                    const e = this.buildExpression(en);
                    if (e)
                        elements.push(e);
                }
                initialValue = {
                    kind: "ArrayLiteralExpression",
                    sourceSpan: nodeToSourceSpan(initExprNode),
                    elements,
                };
            }
            else if (exprNodes.length === 1) {
                // Single expression → use directly
                const expr = this.buildExpression(exprNodes[0]);
                if (expr) {
                    initialValue = expr;
                }
            }
        }
        // Get address if present (AT %IX0.0)
        let address;
        const atToken = getFirstToken(children.AT);
        if (atToken) {
            const directAddrToken = getFirstToken(children.DirectAddress);
            if (directAddrToken) {
                address = directAddrToken.image;
            }
        }
        // Use conditional spreading for optional properties to comply with exactOptionalPropertyTypes
        return {
            kind: "VarDeclaration",
            sourceSpan: nodeToSourceSpan(node),
            names,
            type,
            ...(initialValue !== undefined ? { initialValue } : {}),
            ...(address !== undefined ? { address } : {}),
        };
    }
    /**
     * Build a TypeReference from a CST node.
     */
    buildTypeReference(node) {
        const children = node.children;
        const nameToken = getFirstToken(children.Identifier);
        const name = nameToken?.image ?? "INT";
        const isRefTo = !!children.REF_TO;
        const isReferenceTo = !!children.REFERENCE_TO;
        const isPointerTo = !!children.POINTER;
        const isReference = isRefTo || isReferenceTo || isPointerTo;
        let referenceKind = "none";
        if (isRefTo) {
            referenceKind = "ref_to";
        }
        else if (isReferenceTo) {
            referenceKind = "reference_to";
        }
        else if (isPointerTo) {
            referenceKind = "pointer_to";
        }
        // Extract optional parameterized length: STRING(n) / WSTRING(n) / STRING(CONSTANT)
        let maxLength;
        const lengthToken = getFirstToken(children.IntegerLiteral);
        if (lengthToken) {
            maxLength = parseInt(lengthToken.image, 10);
        }
        else {
            // Check for identifier-based length (STRING(CONSTANT_NAME))
            // Note: children.Identifier[0] is the type name itself; [1] would be the length constant
            const allIdents = getAllTokens(children.Identifier);
            if (allIdents.length > 1) {
                maxLength = allIdents[1].image;
            }
        }
        const result = {
            kind: "TypeReference",
            sourceSpan: nodeToSourceSpan(node),
            name,
            isReference,
            referenceKind,
        };
        if (maxLength !== undefined) {
            result.maxLength = maxLength;
        }
        return result;
    }
    /**
     * Build a TypeReference for an inline ARRAY type.
     * For VLA: ARRAY[*] OF INT → name "__VLA_1D_INT"
     * For fixed: ARRAY[1..10] OF INT → name "__INLINE_ARRAY_INT"
     */
    buildInlineArrayTypeReference(arrayTypeNode, parentNode) {
        const arrayChildren = arrayTypeNode.children;
        // Get dimensions to check for variable-length
        const dimNodes = getAllNodes(arrayChildren.arrayDimension);
        const ndims = dimNodes.length;
        let isVLA = false;
        for (const dimNode of dimNodes) {
            const dimChildren = dimNode.children;
            if (getAllTokens(dimChildren.Star).length > 0) {
                isVLA = true;
            }
        }
        // Get element type from nested dataType
        const elementTypeNode = getFirstNode(arrayChildren.dataType);
        let elementTypeName = "INT";
        if (elementTypeNode) {
            const elemChildren = elementTypeNode.children;
            const elemNameToken = getFirstToken(elemChildren.Identifier);
            if (elemNameToken) {
                elementTypeName = elemNameToken.image;
            }
        }
        // Create synthetic name based on whether it's VLA or fixed
        const dimSuffix = ndims > 1 ? `${ndims}D` : "1D";
        const name = isVLA
            ? `__VLA_${dimSuffix}_${elementTypeName}`
            : `__INLINE_ARRAY_${elementTypeName}`;
        // For fixed arrays, extract integer bounds from dimension expressions
        let arrayDimensions;
        if (!isVLA) {
            arrayDimensions = [];
            for (const dimNode of dimNodes) {
                const dimChildren = dimNode.children;
                const exprNodes = getAllNodes(dimChildren.expression);
                if (exprNodes.length >= 2) {
                    const startVal = this.extractIntegerFromExpression(exprNodes[0]);
                    const endVal = this.extractIntegerFromExpression(exprNodes[1]);
                    if (startVal !== undefined && endVal !== undefined) {
                        arrayDimensions.push({ start: startVal, end: endVal });
                    }
                }
            }
            if (arrayDimensions.length === 0) {
                arrayDimensions = undefined;
            }
        }
        const result = {
            kind: "TypeReference",
            sourceSpan: nodeToSourceSpan(parentNode),
            name,
            isReference: false,
            referenceKind: "none",
        };
        if (arrayDimensions) {
            result.arrayDimensions = arrayDimensions;
            result.elementTypeName = elementTypeName;
        }
        return result;
    }
    /**
     * Build a Statement from a CST node.
     */
    buildStatement(node) {
        const children = node.children;
        // Check for different statement types
        if (children.refAssignStatement) {
            return this.buildRefAssignStatement(getFirstNode(children.refAssignStatement));
        }
        if (children.assignmentStatement) {
            // A chained assignment desugars into multiple statements; a plain one
            // returns a single node so existing single-statement callers still work.
            const stmts = this.buildAssignmentStatement(getFirstNode(children.assignmentStatement));
            return stmts.length === 1 ? stmts[0] : stmts;
        }
        if (children.ifStatement) {
            return this.buildIfStatement(getFirstNode(children.ifStatement));
        }
        if (children.forStatement) {
            return this.buildForStatement(getFirstNode(children.forStatement));
        }
        if (children.whileStatement) {
            return this.buildWhileStatement(getFirstNode(children.whileStatement));
        }
        if (children.repeatStatement) {
            return this.buildRepeatStatement(getFirstNode(children.repeatStatement));
        }
        if (children.caseStatement) {
            return this.buildCaseStatement(getFirstNode(children.caseStatement));
        }
        if (children.exitStatement) {
            return this.buildExitStatement(getFirstNode(children.exitStatement));
        }
        if (children.returnStatement) {
            return this.buildReturnStatement(getFirstNode(children.returnStatement));
        }
        if (children.externalCodePragma) {
            return this.buildExternalCodePragma(getFirstNode(children.externalCodePragma));
        }
        if (children.deleteStatement) {
            return this.buildDeleteStatement(getFirstNode(children.deleteStatement));
        }
        if (children.functionCallStatement) {
            return this.buildFunctionCallStatement(getFirstNode(children.functionCallStatement));
        }
        if (children.methodCallStatement) {
            return this.buildMethodCallStatement(getFirstNode(children.methodCallStatement));
        }
        if (children.thisStatement) {
            return this.buildThisStatement(getFirstNode(children.thisStatement));
        }
        if (children.superCallStatement) {
            return this.buildSuperCallStatement(getFirstNode(children.superCallStatement));
        }
        if (children.assertCall) {
            return this.buildAssertCall(getFirstNode(children.assertCall));
        }
        return undefined;
    }
    /**
     * Build a RefAssignStatement from a CST node.
     */
    buildRefAssignStatement(node) {
        const children = node.children;
        const variableNodes = getAllNodes(children.variable);
        const target = variableNodes[0]
            ? this.buildVariableExpression(variableNodes[0])
            : this.createDummyVariable(node);
        const source = variableNodes[1]
            ? this.buildVariableExpression(variableNodes[1])
            : this.createDummyVariable(node);
        return {
            kind: "RefAssignStatement",
            sourceSpan: nodeToSourceSpan(node),
            target,
            source,
        };
    }
    /**
     * Build an AssignmentStatement from a CST node.
     */
    buildAssignmentStatement(node) {
        const children = node.children;
        const exprNode = getFirstNode(children.expression);
        const value = (exprNode ? this.buildExpression(exprNode) : undefined) ??
            this.createDummyLiteral(node);
        // Targets in source order: the leading `variable`, then each chained
        // `assignTargetTail`'s `variable` (CODESYS `a := b := expr;`).
        const firstVar = getFirstNode(children.variable);
        const targetNodes = [firstVar];
        for (const tail of getAllNodes(children.assignTargetTail)) {
            targetNodes.push(getFirstNode(tail.children.variable));
        }
        const buildTarget = (n) => (n ? this.buildVariableExpression(n) : undefined) ??
            this.createDummyVariable(node);
        // Single (non-chained) assignment — the common case.
        if (targetNodes.length === 1) {
            return [
                {
                    kind: "AssignmentStatement",
                    sourceSpan: nodeToSourceSpan(node),
                    target: buildTarget(targetNodes[0]),
                    value,
                },
            ];
        }
        // Desugar `t0 := t1 := … := tn := expr;` into sequential assignments,
        // evaluated right-to-left so every target ends up holding `expr`'s value:
        //   tn := expr;  t(n-1) := tn;  …  t0 := t1;
        // (each later target is read fresh as the RHS of the next-left assignment).
        const out = [];
        for (let i = targetNodes.length - 1; i >= 0; i--) {
            out.push({
                kind: "AssignmentStatement",
                sourceSpan: nodeToSourceSpan(node),
                target: buildTarget(targetNodes[i]),
                value: i === targetNodes.length - 1
                    ? value
                    : buildTarget(targetNodes[i + 1]),
            });
        }
        return out;
    }
    /**
     * Build an IfStatement from a CST node.
     */
    buildIfStatement(node) {
        const children = node.children;
        // expressions: [0] = IF condition, [1..] = ELSIF conditions
        const expressions = getAllNodes(children.expression);
        const condition = expressions[0]
            ? this.buildExpression(expressions[0])
            : this.createDummyLiteral(node);
        // statementLists: [0] = THEN body, [1..n] = ELSIF bodies, [n+1] = ELSE body (if present)
        const statementLists = getAllNodes(children.statementList);
        const thenStatements = this.extractStatementsFromList(statementLists[0]);
        // ELSIF clauses
        const elsifTokens = getAllTokens(children.ELSIF);
        const elsifClauses = [];
        for (let i = 0; i < elsifTokens.length; i++) {
            const elsifCondition = (expressions[i + 1]
                ? this.buildExpression(expressions[i + 1])
                : undefined) ?? this.createDummyLiteral(node);
            const elsifStatements = this.extractStatementsFromList(statementLists[i + 1]);
            elsifClauses.push({
                kind: "ElsifClause",
                sourceSpan: tokenToSourceSpan(elsifTokens[i]),
                condition: elsifCondition,
                statements: elsifStatements,
            });
        }
        // ELSE body (last statementList if ELSE token is present)
        const elseTokens = getAllTokens(children.ELSE);
        const elseStatements = elseTokens.length > 0
            ? this.extractStatementsFromList(statementLists[elsifTokens.length + 1])
            : [];
        return {
            kind: "IfStatement",
            sourceSpan: nodeToSourceSpan(node),
            condition: condition,
            thenStatements,
            elsifClauses,
            elseStatements,
        };
    }
    /**
     * Build a ForStatement from a CST node.
     */
    buildForStatement(node) {
        const children = node.children;
        const identifiers = getAllTokens(children.Identifier);
        const controlVariable = identifiers[0]?.image ?? "i";
        const expressions = getAllNodes(children.expression);
        const startExpr = expressions[0]
            ? this.buildExpression(expressions[0])
            : undefined;
        const endExpr = expressions[1]
            ? this.buildExpression(expressions[1])
            : undefined;
        const stepExpr = expressions[2]
            ? this.buildExpression(expressions[2])
            : undefined;
        const stmtListNode = getFirstNode(children.statementList);
        const body = this.extractStatementsFromList(stmtListNode);
        // Use conditional spreading for optional step to comply with exactOptionalPropertyTypes
        return {
            kind: "ForStatement",
            sourceSpan: nodeToSourceSpan(node),
            controlVariable,
            start: startExpr ?? this.createDummyLiteral(node),
            end: endExpr ?? this.createDummyLiteral(node),
            body,
            ...(stepExpr !== undefined ? { step: stepExpr } : {}),
        };
    }
    /**
     * Build a WhileStatement from a CST node.
     */
    buildWhileStatement(node) {
        const children = node.children;
        const exprNode = getFirstNode(children.expression);
        const condition = exprNode
            ? this.buildExpression(exprNode)
            : this.createDummyLiteral(node);
        const stmtListNode = getFirstNode(children.statementList);
        const body = this.extractStatementsFromList(stmtListNode);
        return {
            kind: "WhileStatement",
            sourceSpan: nodeToSourceSpan(node),
            condition: condition,
            body,
        };
    }
    /**
     * Build a RepeatStatement from a CST node.
     */
    buildRepeatStatement(node) {
        const children = node.children;
        const exprNode = getFirstNode(children.expression);
        const condition = exprNode
            ? this.buildExpression(exprNode)
            : this.createDummyLiteral(node);
        const stmtListNode = getFirstNode(children.statementList);
        const body = this.extractStatementsFromList(stmtListNode);
        return {
            kind: "RepeatStatement",
            sourceSpan: nodeToSourceSpan(node),
            body,
            condition: condition,
        };
    }
    /**
     * Build a CaseStatement from a CST node.
     */
    buildCaseStatement(node) {
        const children = node.children;
        const exprNode = getFirstNode(children.expression);
        const selector = exprNode
            ? this.buildExpression(exprNode)
            : this.createDummyLiteral(node);
        // Case elements
        const cases = [];
        for (const caseNode of getAllNodes(children.caseElement)) {
            cases.push(this.buildCaseElement(caseNode));
        }
        // ELSE body
        const elseTokens = getAllTokens(children.ELSE);
        let elseStatements = [];
        if (elseTokens.length > 0) {
            const stmtListNode = getFirstNode(children.statementList);
            elseStatements = this.extractStatementsFromList(stmtListNode);
        }
        return {
            kind: "CaseStatement",
            sourceSpan: nodeToSourceSpan(node),
            selector: selector,
            cases,
            elseStatements,
        };
    }
    /**
     * Build a CaseElement from a CST node.
     */
    buildCaseElement(node) {
        const children = node.children;
        // Labels
        const labels = [];
        for (const labelNode of getAllNodes(children.caseLabel)) {
            labels.push(this.buildCaseLabel(labelNode));
        }
        // Statements (uses caseStatementList rule which has GATE to stop at case labels)
        const stmtListNode = getFirstNode(children.caseStatementList) ??
            getFirstNode(children.statementList);
        const statements = this.extractStatementsFromList(stmtListNode);
        return {
            kind: "CaseElement",
            sourceSpan: nodeToSourceSpan(node),
            labels,
            statements,
        };
    }
    /**
     * Build a CaseLabel from a CST node.
     */
    buildCaseLabel(node) {
        const children = node.children;
        const expressions = getAllNodes(children.expression);
        const start = expressions[0]
            ? this.buildExpression(expressions[0])
            : this.createDummyLiteral(node);
        const end = expressions[1]
            ? this.buildExpression(expressions[1])
            : undefined;
        return {
            kind: "CaseLabel",
            sourceSpan: nodeToSourceSpan(node),
            start: start,
            ...(end !== undefined ? { end } : {}),
        };
    }
    /**
     * Build an ExitStatement from a CST node.
     */
    buildExitStatement(node) {
        return {
            kind: "ExitStatement",
            sourceSpan: nodeToSourceSpan(node),
        };
    }
    /**
     * Build a ReturnStatement from a CST node.
     */
    buildReturnStatement(node) {
        return {
            kind: "ReturnStatement",
            sourceSpan: nodeToSourceSpan(node),
        };
    }
    /**
     * Build an ExternalCodePragma from a CST node.
     * Extracts the raw C/C++ code from the {external ...} pragma.
     */
    buildExternalCodePragma(node) {
        const children = node.children;
        const token = getFirstToken(children.ExternalPragma);
        // Extract code content from the pragma token
        // Token format: {external ... }
        let code = "";
        if (token) {
            const raw = token.image;
            // Find the position after "external" keyword and skip whitespace
            const externalKeywordEnd = raw.toLowerCase().indexOf("external") + 8;
            // Remove opening {external and closing }
            code = raw.substring(externalKeywordEnd, raw.length - 1).trim();
        }
        return {
            kind: "ExternalCodePragma",
            sourceSpan: token ? tokenToSourceSpan(token) : nodeToSourceSpan(node),
            code,
        };
    }
    /**
     * Build an Expression from a CST node.
     */
    buildExpression(node) {
        const children = node.children;
        // Check for different expression types
        if (children.orExpression) {
            return this.buildOrExpression(getFirstNode(children.orExpression));
        }
        if (children.literal) {
            return this.buildLiteralExpression(getFirstNode(children.literal));
        }
        if (children.variable) {
            return this.buildVariableExpression(getFirstNode(children.variable));
        }
        // Try to build from the node itself
        return this.buildOrExpression(node);
    }
    /**
     * Build an OR expression (handles binary operators).
     */
    buildOrExpression(node) {
        const children = node.children;
        // Check for XOR expressions
        const xorExprs = getAllNodes(children.xorExpression);
        if (xorExprs.length === 0) {
            // Try other expression types
            return this.buildXorExpression(node);
        }
        const firstXorExpr = xorExprs[0];
        if (!firstXorExpr)
            return undefined;
        let left = this.buildXorExpression(firstXorExpr);
        if (!left)
            return undefined;
        for (let i = 1; i < xorExprs.length; i++) {
            const xorExpr = xorExprs[i];
            if (!xorExpr)
                continue;
            const right = this.buildXorExpression(xorExpr);
            if (!right)
                continue;
            left = {
                kind: "BinaryExpression",
                sourceSpan: nodeToSourceSpan(node),
                operator: "OR",
                left,
                right,
            };
        }
        return left;
    }
    /**
     * Build an XOR expression.
     */
    buildXorExpression(node) {
        const children = node.children;
        const andExprs = getAllNodes(children.andExpression);
        if (andExprs.length === 0) {
            return this.buildAndExpression(node);
        }
        const firstAndExpr = andExprs[0];
        if (!firstAndExpr)
            return undefined;
        let left = this.buildAndExpression(firstAndExpr);
        if (!left)
            return undefined;
        for (let i = 1; i < andExprs.length; i++) {
            const andExpr = andExprs[i];
            if (!andExpr)
                continue;
            const right = this.buildAndExpression(andExpr);
            if (!right)
                continue;
            left = {
                kind: "BinaryExpression",
                sourceSpan: nodeToSourceSpan(node),
                operator: "XOR",
                left,
                right,
            };
        }
        return left;
    }
    /**
     * Build an AND expression.
     */
    buildAndExpression(node) {
        const children = node.children;
        const compExprs = getAllNodes(children.comparisonExpression);
        if (compExprs.length === 0) {
            return this.buildComparisonExpression(node);
        }
        const firstCompExpr = compExprs[0];
        if (!firstCompExpr)
            return undefined;
        let left = this.buildComparisonExpression(firstCompExpr);
        if (!left)
            return undefined;
        for (let i = 1; i < compExprs.length; i++) {
            const compExpr = compExprs[i];
            if (!compExpr)
                continue;
            const right = this.buildComparisonExpression(compExpr);
            if (!right)
                continue;
            left = {
                kind: "BinaryExpression",
                sourceSpan: nodeToSourceSpan(node),
                operator: "AND",
                left,
                right,
            };
        }
        return left;
    }
    /**
     * Build a comparison expression.
     */
    buildComparisonExpression(node) {
        const children = node.children;
        const addExprs = getAllNodes(children.addExpression);
        if (addExprs.length === 0) {
            return this.buildAddExpression(node);
        }
        const firstAddExpr = addExprs[0];
        if (!firstAddExpr)
            return undefined;
        let left = this.buildAddExpression(firstAddExpr);
        if (!left)
            return undefined;
        // Collect all comparison operator tokens with their operators, sorted by position
        const opTokens = [];
        for (const tok of getAllTokens(children.Equal)) {
            opTokens.push({ offset: tok.startOffset ?? 0, op: "=" });
        }
        for (const tok of getAllTokens(children.NotEqual)) {
            opTokens.push({ offset: tok.startOffset ?? 0, op: "<>" });
        }
        for (const tok of getAllTokens(children.Less)) {
            opTokens.push({ offset: tok.startOffset ?? 0, op: "<" });
        }
        for (const tok of getAllTokens(children.Greater)) {
            opTokens.push({ offset: tok.startOffset ?? 0, op: ">" });
        }
        for (const tok of getAllTokens(children.LessEqual)) {
            opTokens.push({ offset: tok.startOffset ?? 0, op: "<=" });
        }
        for (const tok of getAllTokens(children.GreaterEqual)) {
            opTokens.push({ offset: tok.startOffset ?? 0, op: ">=" });
        }
        opTokens.sort((a, b) => a.offset - b.offset);
        for (let i = 1; i < addExprs.length; i++) {
            const addExpr = addExprs[i];
            if (!addExpr)
                continue;
            const right = this.buildAddExpression(addExpr);
            if (!right)
                continue;
            const op = opTokens[i - 1]?.op ?? "=";
            left = {
                kind: "BinaryExpression",
                sourceSpan: nodeToSourceSpan(node),
                operator: op,
                left,
                right,
            };
        }
        return left;
    }
    /**
     * Build an addition expression.
     */
    buildAddExpression(node) {
        const children = node.children;
        const mulExprs = getAllNodes(children.mulExpression);
        if (mulExprs.length === 0) {
            return this.buildMulExpression(node);
        }
        const firstMulExpr = mulExprs[0];
        if (!firstMulExpr)
            return undefined;
        let left = this.buildMulExpression(firstMulExpr);
        if (!left)
            return undefined;
        // Collect all add/sub operator tokens, sorted by position
        const opTokens = [];
        for (const tok of getAllTokens(children.Plus)) {
            opTokens.push({ offset: tok.startOffset ?? 0, op: "+" });
        }
        for (const tok of getAllTokens(children.Minus)) {
            opTokens.push({ offset: tok.startOffset ?? 0, op: "-" });
        }
        opTokens.sort((a, b) => a.offset - b.offset);
        for (let i = 1; i < mulExprs.length; i++) {
            const mulExpr = mulExprs[i];
            if (!mulExpr)
                continue;
            const right = this.buildMulExpression(mulExpr);
            if (!right)
                continue;
            const op = opTokens[i - 1]?.op ?? "+";
            left = {
                kind: "BinaryExpression",
                sourceSpan: nodeToSourceSpan(node),
                operator: op,
                left,
                right,
            };
        }
        return left;
    }
    /**
     * Build a multiplication expression.
     */
    buildMulExpression(node) {
        const children = node.children;
        const powerExprs = getAllNodes(children.powerExpression);
        if (powerExprs.length === 0) {
            return this.buildPowerExpression(node);
        }
        const firstPowerExpr = powerExprs[0];
        if (!firstPowerExpr)
            return undefined;
        let left = this.buildPowerExpression(firstPowerExpr);
        if (!left)
            return undefined;
        // Collect all mul/div/mod operator tokens, sorted by position
        const opTokens = [];
        for (const tok of getAllTokens(children.Star)) {
            opTokens.push({ offset: tok.startOffset ?? 0, op: "*" });
        }
        for (const tok of getAllTokens(children.Slash)) {
            opTokens.push({ offset: tok.startOffset ?? 0, op: "/" });
        }
        for (const tok of getAllTokens(children.MOD)) {
            opTokens.push({ offset: tok.startOffset ?? 0, op: "MOD" });
        }
        opTokens.sort((a, b) => a.offset - b.offset);
        for (let i = 1; i < powerExprs.length; i++) {
            const powerExpr = powerExprs[i];
            if (!powerExpr)
                continue;
            const right = this.buildPowerExpression(powerExpr);
            if (!right)
                continue;
            const op = opTokens[i - 1]?.op ?? "*";
            left = {
                kind: "BinaryExpression",
                sourceSpan: nodeToSourceSpan(node),
                operator: op,
                left,
                right,
            };
        }
        return left;
    }
    /**
     * Build a power expression.
     */
    buildPowerExpression(node) {
        const children = node.children;
        const unaryExprs = getAllNodes(children.unaryExpression);
        if (unaryExprs.length === 0) {
            return this.buildUnaryExpression(node);
        }
        const firstUnaryExpr = unaryExprs[0];
        if (!firstUnaryExpr)
            return undefined;
        let left = this.buildUnaryExpression(firstUnaryExpr);
        if (!left)
            return undefined;
        for (let i = 1; i < unaryExprs.length; i++) {
            const unaryExpr = unaryExprs[i];
            if (!unaryExpr)
                continue;
            const right = this.buildUnaryExpression(unaryExpr);
            if (!right)
                continue;
            left = {
                kind: "BinaryExpression",
                sourceSpan: nodeToSourceSpan(node),
                operator: "**",
                left,
                right,
            };
        }
        return left;
    }
    /**
     * Build a unary expression.
     */
    buildUnaryExpression(node) {
        const children = node.children;
        // Check for unary operators
        if (children.NOT) {
            const operand = this.buildPrimaryExpression(node);
            if (operand) {
                return {
                    kind: "UnaryExpression",
                    sourceSpan: nodeToSourceSpan(node),
                    operator: "NOT",
                    operand,
                };
            }
        }
        if (children.Minus) {
            const operand = this.buildPrimaryExpression(node);
            if (operand) {
                return {
                    kind: "UnaryExpression",
                    sourceSpan: nodeToSourceSpan(node),
                    operator: "-",
                    operand,
                };
            }
        }
        if (children.Plus) {
            const operand = this.buildPrimaryExpression(node);
            if (operand) {
                return {
                    kind: "UnaryExpression",
                    sourceSpan: nodeToSourceSpan(node),
                    operator: "+",
                    operand,
                };
            }
        }
        return this.buildPrimaryExpression(node);
    }
    /**
     * Build a primary expression.
     */
    buildPrimaryExpression(node) {
        const children = node.children;
        // Check for literal
        if (children.literal) {
            return this.buildLiteralExpression(getFirstNode(children.literal));
        }
        // Check for REF(variable) expression
        if (children.refExpression) {
            return this.buildRefExpression(getFirstNode(children.refExpression));
        }
        // Check for DREF(expression) expression
        if (children.drefExpression) {
            return this.buildDrefExpression(getFirstNode(children.drefExpression));
        }
        // Check for array literal [expr, expr, ...]
        if (children.arrayLiteral) {
            const litNode = getFirstNode(children.arrayLiteral);
            const litChildren = litNode.children;
            const exprNodes = getAllNodes(litChildren.expression);
            const elements = [];
            for (const en of exprNodes) {
                const e = this.buildExpression(en);
                if (e)
                    elements.push(e);
            }
            return {
                kind: "ArrayLiteralExpression",
                sourceSpan: nodeToSourceSpan(litNode),
                elements,
            };
        }
        // Check for __NEW(type) or __NEW(type, size) expression
        if (children.newExpression) {
            return this.buildNewExpression(getFirstNode(children.newExpression));
        }
        // Check for THIS access expression
        if (children.thisAccess) {
            return this.buildThisAccessExpression(getFirstNode(children.thisAccess));
        }
        // Check for SUPER access expression
        if (children.superAccess) {
            return this.buildSuperAccessExpression(getFirstNode(children.superAccess));
        }
        // Check for method call expression: instance.method(args)
        if (children.methodCall) {
            return this.buildMethodCallExpression(getFirstNode(children.methodCall));
        }
        // Check for function call (before variable - both start with Identifier, parser disambiguates)
        if (children.functionCall) {
            return this.buildFunctionCallExpression(getFirstNode(children.functionCall));
        }
        // Check for variable
        if (children.variable) {
            return this.buildVariableExpression(getFirstNode(children.variable));
        }
        // Check for parenthesized expression
        if (children.expression) {
            const innerExpr = this.buildExpression(getFirstNode(children.expression));
            if (innerExpr) {
                return {
                    kind: "ParenthesizedExpression",
                    sourceSpan: nodeToSourceSpan(node),
                    expression: innerExpr,
                };
            }
        }
        // Check for primary expression
        if (children.primaryExpression) {
            return this.buildPrimaryExpression(getFirstNode(children.primaryExpression));
        }
        // Try to extract a literal or variable directly
        return this.tryBuildDirectExpression(node);
    }
    /**
     * Build a RefExpression from a CST node.
     */
    buildRefExpression(node) {
        const children = node.children;
        const variableNode = getFirstNode(children.variable);
        const operand = variableNode
            ? this.buildVariableExpression(variableNode)
            : this.createDummyVariable(node);
        return {
            kind: "RefExpression",
            sourceSpan: nodeToSourceSpan(node),
            operand,
        };
    }
    /**
     * Build a DrefExpression from a CST node.
     */
    buildDrefExpression(node) {
        const children = node.children;
        const exprNode = getFirstNode(children.expression);
        const operand = exprNode
            ? this.buildExpression(exprNode)
            : this.createDummyVariable(node);
        return {
            kind: "DrefExpression",
            sourceSpan: nodeToSourceSpan(node),
            operand: operand,
        };
    }
    /**
     * Build a NewExpression from a CST node.
     * Handles: __NEW(dataType) or __NEW(dataType, expression)
     */
    buildNewExpression(node) {
        const children = node.children;
        // Get the allocation type from dataType
        const dataTypeNode = getFirstNode(children.dataType);
        const allocationType = dataTypeNode
            ? this.buildTypeReference(dataTypeNode)
            : {
                kind: "TypeReference",
                sourceSpan: nodeToSourceSpan(node),
                name: "INT",
                isReference: false,
                referenceKind: "none",
            };
        // Get optional array size from expression
        let arraySize;
        const exprNode = getFirstNode(children.expression);
        if (exprNode) {
            const expr = this.buildExpression(exprNode);
            if (expr) {
                arraySize = expr;
            }
        }
        return {
            kind: "NewExpression",
            sourceSpan: nodeToSourceSpan(node),
            allocationType,
            ...(arraySize !== undefined ? { arraySize } : {}),
        };
    }
    /**
     * Build a DeleteStatement from a CST node.
     * Handles: __DELETE(expression)
     */
    buildDeleteStatement(node) {
        const children = node.children;
        const exprNode = getFirstNode(children.expression);
        const pointer = exprNode
            ? this.buildExpression(exprNode)
            : this.createDummyVariable(node);
        return {
            kind: "DeleteStatement",
            sourceSpan: nodeToSourceSpan(node),
            pointer: pointer,
        };
    }
    /**
     * Try to build an expression directly from tokens.
     */
    tryBuildDirectExpression(node) {
        const children = node.children;
        // Check for integer literal
        if (children.IntegerLiteral) {
            const token = getFirstToken(children.IntegerLiteral);
            return {
                kind: "LiteralExpression",
                sourceSpan: tokenToSourceSpan(token),
                literalType: "INT",
                value: parseIECInteger(token.image),
                rawValue: token.image,
            };
        }
        // Check for real literal
        if (children.RealLiteral) {
            const token = getFirstToken(children.RealLiteral);
            return {
                kind: "LiteralExpression",
                sourceSpan: tokenToSourceSpan(token),
                literalType: "REAL",
                value: parseFloat(token.image),
                rawValue: token.image,
            };
        }
        // Check for boolean literals
        if (children.TRUE) {
            const token = getFirstToken(children.TRUE);
            return {
                kind: "LiteralExpression",
                sourceSpan: tokenToSourceSpan(token),
                literalType: "BOOL",
                value: true,
                rawValue: "TRUE",
            };
        }
        if (children.FALSE) {
            const token = getFirstToken(children.FALSE);
            return {
                kind: "LiteralExpression",
                sourceSpan: tokenToSourceSpan(token),
                literalType: "BOOL",
                value: false,
                rawValue: "FALSE",
            };
        }
        // Check for time literal
        if (children.TimeLiteral) {
            const token = getFirstToken(children.TimeLiteral);
            return {
                kind: "LiteralExpression",
                sourceSpan: tokenToSourceSpan(token),
                literalType: "TIME",
                value: token.image,
                rawValue: token.image,
            };
        }
        // Check for identifier (variable reference)
        if (children.Identifier) {
            const token = getFirstToken(children.Identifier);
            return {
                kind: "VariableExpression",
                sourceSpan: tokenToSourceSpan(token),
                name: token.image,
                subscripts: [],
                fieldAccess: [],
                isDereference: false,
            };
        }
        return undefined;
    }
    /**
     * Build a LiteralExpression from a CST node.
     */
    buildLiteralExpression(node) {
        const children = node.children;
        // Check for different literal types
        // Typed literal: BYTE#255, DWORD#16#FF, INT#0, etc.
        if (children.TypedLiteral) {
            const token = getFirstToken(children.TypedLiteral);
            const raw = token.image;
            const hashIdx = raw.indexOf("#");
            const typePrefix = raw.substring(0, hashIdx).toUpperCase();
            const valuePart = raw.substring(hashIdx + 1);
            const numValue = parseIECNumeric(valuePart);
            const litType = typePrefix === "REAL" || typePrefix === "LREAL" ? "REAL" : "INT";
            return {
                kind: "LiteralExpression",
                sourceSpan: tokenToSourceSpan(token),
                literalType: litType,
                value: numValue,
                rawValue: raw,
                typePrefix,
            };
        }
        if (children.IntegerLiteral) {
            const token = getFirstToken(children.IntegerLiteral);
            return {
                kind: "LiteralExpression",
                sourceSpan: tokenToSourceSpan(token),
                literalType: "INT",
                value: parseIECInteger(token.image),
                rawValue: token.image,
            };
        }
        if (children.RealLiteral) {
            const token = getFirstToken(children.RealLiteral);
            return {
                kind: "LiteralExpression",
                sourceSpan: tokenToSourceSpan(token),
                literalType: "REAL",
                value: parseFloat(token.image),
                rawValue: token.image,
            };
        }
        if (children.TRUE) {
            const token = getFirstToken(children.TRUE);
            return {
                kind: "LiteralExpression",
                sourceSpan: tokenToSourceSpan(token),
                literalType: "BOOL",
                value: true,
                rawValue: "TRUE",
            };
        }
        if (children.FALSE) {
            const token = getFirstToken(children.FALSE);
            return {
                kind: "LiteralExpression",
                sourceSpan: tokenToSourceSpan(token),
                literalType: "BOOL",
                value: false,
                rawValue: "FALSE",
            };
        }
        if (children.StringLiteral) {
            const token = getFirstToken(children.StringLiteral);
            return {
                kind: "LiteralExpression",
                sourceSpan: tokenToSourceSpan(token),
                literalType: "STRING",
                value: token.image,
                rawValue: token.image,
            };
        }
        if (children.WideStringLiteral) {
            const token = getFirstToken(children.WideStringLiteral);
            return {
                kind: "LiteralExpression",
                sourceSpan: tokenToSourceSpan(token),
                literalType: "WSTRING",
                value: token.image,
                rawValue: token.image,
            };
        }
        if (children.TimeLiteral) {
            const token = getFirstToken(children.TimeLiteral);
            return {
                kind: "LiteralExpression",
                sourceSpan: tokenToSourceSpan(token),
                literalType: "TIME",
                value: token.image,
                rawValue: token.image,
            };
        }
        if (children.DateLiteral) {
            const token = getFirstToken(children.DateLiteral);
            return {
                kind: "LiteralExpression",
                sourceSpan: tokenToSourceSpan(token),
                literalType: "DATE",
                value: token.image,
                rawValue: token.image,
            };
        }
        if (children.TimeOfDayLiteral) {
            const token = getFirstToken(children.TimeOfDayLiteral);
            return {
                kind: "LiteralExpression",
                sourceSpan: tokenToSourceSpan(token),
                literalType: "TIME_OF_DAY",
                value: token.image,
                rawValue: token.image,
            };
        }
        if (children.DateTimeLiteral) {
            const token = getFirstToken(children.DateTimeLiteral);
            return {
                kind: "LiteralExpression",
                sourceSpan: tokenToSourceSpan(token),
                literalType: "DATE_AND_TIME",
                value: token.image,
                rawValue: token.image,
            };
        }
        if (children.NULL) {
            const token = getFirstToken(children.NULL);
            return {
                kind: "LiteralExpression",
                sourceSpan: tokenToSourceSpan(token),
                literalType: "NULL",
                value: "NULL",
                rawValue: "NULL",
            };
        }
        // Default fallback
        return {
            kind: "LiteralExpression",
            sourceSpan: nodeToSourceSpan(node),
            literalType: "INT",
            value: 0,
            rawValue: "0",
        };
    }
    /**
     * Build a VariableExpression from a CST node.
     */
    buildVariableExpression(node) {
        const children = node.children;
        // identifierOrKeyword subrule nodes: first is the variable name, rest are field accessors
        const idOrKwNodes = getAllNodes(children.identifierOrKeyword);
        const name = idOrKwNodes[0]
            ? getIdentifierOrKeywordImage(idOrKwNodes[0])
            : "";
        // Check for dereference operator (^)
        const isDereference = !!children.Caret;
        // Get additional field access from identifierOrKeyword nodes (index 1+)
        // Also include IntegerLiteral tokens for bit access (var.0, var.31)
        const allIntLiterals = getAllTokens(children.IntegerLiteral);
        const fieldAccess = [];
        for (let i = 1; i < idOrKwNodes.length; i++) {
            const node = idOrKwNodes[i];
            if (node)
                fieldAccess.push(getIdentifierOrKeywordImage(node));
        }
        // Bit access indices appear as IntegerLiteral tokens after Dot
        for (const intToken of allIntLiterals) {
            fieldAccess.push(intToken.image);
        }
        // Extract subscript expressions from array access: arr[i], arr[i,j], etc.
        const subscripts = [];
        for (const exprNode of getAllNodes(children.expression)) {
            const expr = this.buildExpression(exprNode);
            if (expr)
                subscripts.push(expr);
        }
        // Build ordered access chain by sorting markers by source position.
        // This preserves the interleaving of field accesses, subscripts, and dereferences.
        const accessChain = this.buildAccessChain(children);
        const varExpr = {
            kind: "VariableExpression",
            sourceSpan: nodeToSourceSpan(node),
            name,
            subscripts,
            fieldAccess,
            isDereference,
        };
        if (accessChain.length > 0) {
            varExpr.accessChain = accessChain;
        }
        return varExpr;
    }
    /**
     * Build an ordered access chain from variable CST children.
     * Sorts Dot tokens, LBracket tokens, and Caret tokens by source offset
     * to reconstruct the correct interleaving order.
     */
    buildAccessChain(children) {
        const markers = [];
        // Collect field access markers (Dot tokens followed by identifierOrKeyword or IntegerLiteral)
        const dotTokens = getAllTokens(children.Dot);
        const idOrKwNodes = getAllNodes(children.identifierOrKeyword);
        const intLiteralTokens = getAllTokens(children.IntegerLiteral);
        // Build a list of field targets sorted by offset: identifier and integer literal tokens after dots
        const fieldTargets = [];
        for (let i = 1; i < idOrKwNodes.length; i++) {
            const n = idOrKwNodes[i];
            fieldTargets.push({
                offset: getNodeStartOffset(n),
                name: getIdentifierOrKeywordImage(n),
            });
        }
        for (const t of intLiteralTokens) {
            fieldTargets.push({ offset: t.startOffset, name: t.image });
        }
        fieldTargets.sort((a, b) => a.offset - b.offset);
        // Each dot token corresponds to one field target (in order)
        const sortedDots = [...dotTokens].sort((a, b) => a.startOffset - b.startOffset);
        for (let i = 0; i < sortedDots.length && i < fieldTargets.length; i++) {
            markers.push({
                kind: "field",
                offset: sortedDots[i].startOffset,
                name: fieldTargets[i].name,
            });
        }
        // Collect subscript markers (LBracket tokens with their associated expressions)
        const lBracketTokens = getAllTokens(children.LBracket);
        const rBracketTokens = getAllTokens(children.RBracket);
        const exprNodes = getAllNodes(children.expression);
        const sortedLBrackets = [...lBracketTokens].sort((a, b) => a.startOffset - b.startOffset);
        const sortedRBrackets = [...rBracketTokens].sort((a, b) => a.startOffset - b.startOffset);
        // Build subscript groups: each [..] pair contains the expressions between them
        let exprIdx = 0;
        for (let bracketIdx = 0; bracketIdx < sortedLBrackets.length; bracketIdx++) {
            const lb = sortedLBrackets[bracketIdx];
            const rb = sortedRBrackets[bracketIdx];
            const rbOffset = rb ? rb.startOffset : Infinity;
            const indices = [];
            while (exprIdx < exprNodes.length) {
                const exprOffset = getNodeStartOffset(exprNodes[exprIdx]);
                if (exprOffset > rbOffset)
                    break;
                if (exprOffset > lb.startOffset) {
                    const expr = this.buildExpression(exprNodes[exprIdx]);
                    if (expr)
                        indices.push(expr);
                }
                exprIdx++;
            }
            markers.push({
                kind: "subscript",
                offset: lb.startOffset,
                indices,
            });
        }
        // Collect dereference markers (Caret tokens)
        const caretTokens = getAllTokens(children.Caret);
        for (const c of caretTokens) {
            markers.push({ kind: "dereference", offset: c.startOffset });
        }
        // Sort all markers by source offset
        markers.sort((a, b) => a.offset - b.offset);
        // Convert to AccessStep array
        return markers.map((m) => {
            switch (m.kind) {
                case "field":
                    return { kind: "field", name: m.name };
                case "subscript":
                    return { kind: "subscript", indices: m.indices };
                case "dereference":
                    return { kind: "dereference" };
            }
        });
    }
    /**
     * Build a THIS access expression from a thisAccess CST node.
     * THIS.member -> VariableExpression { name: "THIS", fieldAccess: ["member"] }
     * THIS.method(args) -> FunctionCallExpression { functionName: "THIS.method", ... }
     */
    buildThisAccessExpression(node) {
        const children = node.children;
        // THIS^ (dereference - return self)
        if (children.Caret) {
            return {
                kind: "VariableExpression",
                sourceSpan: nodeToSourceSpan(node),
                name: "THIS",
                subscripts: [],
                fieldAccess: [],
                isDereference: true,
            };
        }
        const idOrKwNodes = getAllNodes(children.identifierOrKeyword);
        const memberName = idOrKwNodes.length > 0
            ? getIdentifierOrKeywordImage(idOrKwNodes[0])
            : "";
        // If there's a LParen, it's a method call
        if (children.LParen) {
            const args = [];
            const argListNode = getFirstNode(children.argumentList);
            if (argListNode) {
                const argListChildren = argListNode.children;
                for (const argNode of getAllNodes(argListChildren.argument)) {
                    args.push(this.buildArgument(argNode));
                }
            }
            return {
                kind: "FunctionCallExpression",
                sourceSpan: nodeToSourceSpan(node),
                functionName: `THIS.${memberName}`,
                arguments: args,
            };
        }
        // Otherwise it's member access
        return {
            kind: "VariableExpression",
            sourceSpan: nodeToSourceSpan(node),
            name: "THIS",
            subscripts: [],
            fieldAccess: [memberName],
            isDereference: false,
        };
    }
    /**
     * Build a SUPER access expression from a superAccess CST node.
     * SUPER.method(args) -> FunctionCallExpression { functionName: "SUPER.method", ... }
     * SUPER.member -> VariableExpression { name: "SUPER", fieldAccess: ["member"] }
     */
    buildSuperAccessExpression(node) {
        const children = node.children;
        const idOrKwNodes = getAllNodes(children.identifierOrKeyword);
        // SUPER^() — parent body call (no method name)
        if (idOrKwNodes.length === 0) {
            const args = [];
            const argListNode = getFirstNode(children.argumentList);
            if (argListNode) {
                const argListChildren = argListNode.children;
                for (const argNode of getAllNodes(argListChildren.argument)) {
                    args.push(this.buildArgument(argNode));
                }
            }
            return {
                kind: "FunctionCallExpression",
                sourceSpan: nodeToSourceSpan(node),
                functionName: "SUPER",
                arguments: args,
            };
        }
        const memberName = getIdentifierOrKeywordImage(idOrKwNodes[0]);
        // SUPER^.method(args) — parent method call
        if (children.LParen) {
            const args = [];
            const argListNode = getFirstNode(children.argumentList);
            if (argListNode) {
                const argListChildren = argListNode.children;
                for (const argNode of getAllNodes(argListChildren.argument)) {
                    args.push(this.buildArgument(argNode));
                }
            }
            return {
                kind: "FunctionCallExpression",
                sourceSpan: nodeToSourceSpan(node),
                functionName: `SUPER.${memberName}`,
                arguments: args,
            };
        }
        // SUPER^.member — parent member access
        return {
            kind: "VariableExpression",
            sourceSpan: nodeToSourceSpan(node),
            name: "SUPER",
            subscripts: [],
            fieldAccess: [memberName],
            isDereference: false,
        };
    }
    /**
     * Build a method call expression: instance.method(args)
     * Maps to FunctionCallExpression with functionName = "instance.method"
     */
    buildMethodCallExpression(node) {
        const children = node.children;
        const idOrKwNodes = getAllNodes(children.identifierOrKeyword);
        const instanceName = idOrKwNodes[0]
            ? getIdentifierOrKeywordImage(idOrKwNodes[0])
            : "";
        const methodName = idOrKwNodes[1]
            ? getIdentifierOrKeywordImage(idOrKwNodes[1])
            : "";
        const args = [];
        const argListNode = getFirstNode(children.argumentList);
        if (argListNode) {
            const argListChildren = argListNode.children;
            for (const argNode of getAllNodes(argListChildren.argument)) {
                args.push(this.buildArgument(argNode));
            }
        }
        // Build the base method call as a FunctionCallExpression
        let result = {
            kind: "FunctionCallExpression",
            sourceSpan: nodeToSourceSpan(node),
            functionName: `${instanceName}.${methodName}`,
            arguments: args,
        };
        // Build chained method calls as nested MethodCallExpression nodes
        const chainedCalls = getAllNodes(children.chainedMethodCall);
        for (const chainNode of chainedCalls) {
            result = this.buildChainedCall(chainNode, result, node);
        }
        return result;
    }
    /**
     * Build a FunctionCallExpression from a functionCall CST node.
     */
    buildFunctionCallExpression(node) {
        const children = node.children;
        const idOrKwNodes = getAllNodes(children.identifierOrKeyword);
        const functionName = idOrKwNodes[0]
            ? getIdentifierOrKeywordImage(idOrKwNodes[0])
            : "";
        const args = [];
        const argListNode = getFirstNode(children.argumentList);
        if (argListNode) {
            const argListChildren = argListNode.children;
            for (const argNode of getAllNodes(argListChildren.argument)) {
                args.push(this.buildArgument(argNode));
            }
        }
        return {
            kind: "FunctionCallExpression",
            sourceSpan: nodeToSourceSpan(node),
            functionName,
            arguments: args,
        };
    }
    /**
     * Build a MethodCallExpression from a chainedMethodCall CST node.
     * Wraps the previous expression as the object of the chained call.
     */
    buildChainedCall(chainNode, objectExpr, parentNode) {
        const chainChildren = chainNode.children;
        const chainIdOrKw = getAllNodes(chainChildren.identifierOrKeyword);
        const chainMethodName = chainIdOrKw[0]
            ? getIdentifierOrKeywordImage(chainIdOrKw[0])
            : "";
        const chainArgs = [];
        const chainArgList = getFirstNode(chainChildren.argumentList);
        if (chainArgList) {
            const chainArgListChildren = chainArgList.children;
            for (const argNode of getAllNodes(chainArgListChildren.argument)) {
                chainArgs.push(this.buildArgument(argNode));
            }
        }
        return {
            kind: "MethodCallExpression",
            sourceSpan: nodeToSourceSpan(parentNode),
            object: objectExpr,
            methodName: chainMethodName,
            arguments: chainArgs,
        };
    }
    /**
     * Build an Argument from an argument CST node.
     */
    buildArgument(node) {
        const children = node.children;
        let name;
        let isOutput = false;
        // Check for named argument: identifierOrKeyword (Assign | OutputAssign)
        // Named params can use contextual keywords like SET := TRUE
        const idOrKwNode = getFirstNode(children.identifierOrKeyword);
        if (idOrKwNode) {
            // Named argument - check if it's input (:=) or output (=>)
            if (children.Assign || children.OutputAssign) {
                name = getIdentifierOrKeywordImage(idOrKwNode);
                isOutput = !!children.OutputAssign;
            }
        }
        // Build the value expression
        const exprNode = getFirstNode(children.expression);
        const value = exprNode
            ? (this.buildExpression(exprNode) ?? this.createDummyLiteral(node))
            : this.createDummyLiteral(node);
        return {
            kind: "Argument",
            sourceSpan: nodeToSourceSpan(node),
            isOutput,
            value,
            ...(name !== undefined ? { name } : {}),
        };
    }
    /**
     * Build a FunctionCallStatement from a functionCallStatement CST node.
     */
    buildFunctionCallStatement(node) {
        const children = node.children;
        const callNode = getFirstNode(children.functionCall);
        const call = callNode
            ? this.buildFunctionCallExpression(callNode)
            : {
                kind: "FunctionCallExpression",
                sourceSpan: nodeToSourceSpan(node),
                functionName: "",
                arguments: [],
            };
        return {
            kind: "FunctionCallStatement",
            sourceSpan: nodeToSourceSpan(node),
            call,
        };
    }
    /**
     * Build a method call statement: instance.method(args);
     * Maps to FunctionCallStatement with functionName = "instance.method"
     */
    buildMethodCallStatement(node) {
        const children = node.children;
        const idOrKwNodes = getAllNodes(children.identifierOrKeyword);
        const instanceName = idOrKwNodes[0]
            ? getIdentifierOrKeywordImage(idOrKwNodes[0])
            : "";
        const methodName = idOrKwNodes[1]
            ? getIdentifierOrKeywordImage(idOrKwNodes[1])
            : "";
        const args = [];
        const argListNode = getFirstNode(children.argumentList);
        if (argListNode) {
            const argListChildren = argListNode.children;
            for (const argNode of getAllNodes(argListChildren.argument)) {
                args.push(this.buildArgument(argNode));
            }
        }
        // Build the base method call
        let callExpr = {
            kind: "FunctionCallExpression",
            sourceSpan: nodeToSourceSpan(node),
            functionName: `${instanceName}.${methodName}`,
            arguments: args,
        };
        // Build chained method calls as nested MethodCallExpression nodes
        const chainedCalls = getAllNodes(children.chainedMethodCall);
        for (const chainNode of chainedCalls) {
            callExpr = this.buildChainedCall(chainNode, callExpr, node);
        }
        return {
            kind: "FunctionCallStatement",
            sourceSpan: nodeToSourceSpan(node),
            call: callExpr,
        };
    }
    /**
     * Build a THIS statement: THIS.member := expr; or THIS.method(args);
     * Assignment maps to AssignmentStatement; method call maps to FunctionCallStatement.
     */
    buildThisStatement(node) {
        const children = node.children;
        const idOrKwNodes = getAllNodes(children.identifierOrKeyword);
        const memberName = idOrKwNodes.length > 0
            ? getIdentifierOrKeywordImage(idOrKwNodes[0])
            : "";
        // Check if it's an assignment (has Assign token)
        if (children.Assign) {
            const exprNode = getFirstNode(children.expression);
            const value = exprNode
                ? (this.buildExpression(exprNode) ?? this.createDummyLiteral(node))
                : this.createDummyLiteral(node);
            const target = {
                kind: "VariableExpression",
                sourceSpan: nodeToSourceSpan(node),
                name: "THIS",
                subscripts: [],
                fieldAccess: [memberName],
                isDereference: false,
            };
            return {
                kind: "AssignmentStatement",
                sourceSpan: nodeToSourceSpan(node),
                target,
                value,
            };
        }
        // Otherwise it's a method call: THIS.method(args);
        const args = [];
        const argListNode = getFirstNode(children.argumentList);
        if (argListNode) {
            const argListChildren = argListNode.children;
            for (const argNode of getAllNodes(argListChildren.argument)) {
                args.push(this.buildArgument(argNode));
            }
        }
        return {
            kind: "FunctionCallStatement",
            sourceSpan: nodeToSourceSpan(node),
            call: {
                kind: "FunctionCallExpression",
                sourceSpan: nodeToSourceSpan(node),
                functionName: `THIS.${memberName}`,
                arguments: args,
            },
        };
    }
    /**
     * Build a SUPER call statement: SUPER^(); or SUPER^.method(args);
     * Body call → functionName = "SUPER"; method call → functionName = "SUPER.method"
     */
    buildSuperCallStatement(node) {
        const children = node.children;
        const idOrKwNodes = getAllNodes(children.identifierOrKeyword);
        const args = [];
        const argListNode = getFirstNode(children.argumentList);
        if (argListNode) {
            const argListChildren = argListNode.children;
            for (const argNode of getAllNodes(argListChildren.argument)) {
                args.push(this.buildArgument(argNode));
            }
        }
        // SUPER^() — parent body call (no method name)
        if (idOrKwNodes.length === 0) {
            return {
                kind: "FunctionCallStatement",
                sourceSpan: nodeToSourceSpan(node),
                call: {
                    kind: "FunctionCallExpression",
                    sourceSpan: nodeToSourceSpan(node),
                    functionName: "SUPER",
                    arguments: args,
                },
            };
        }
        // SUPER^.method(args) — parent method call
        const methodName = getIdentifierOrKeywordImage(idOrKwNodes[0]);
        return {
            kind: "FunctionCallStatement",
            sourceSpan: nodeToSourceSpan(node),
            call: {
                kind: "FunctionCallExpression",
                sourceSpan: nodeToSourceSpan(node),
                functionName: `SUPER.${methodName}`,
                arguments: args,
            },
        };
    }
    /**
     * Create a dummy variable expression for error recovery.
     */
    createDummyVariable(node) {
        return {
            kind: "VariableExpression",
            sourceSpan: nodeToSourceSpan(node),
            name: "_dummy",
            subscripts: [],
            fieldAccess: [],
            isDereference: false,
        };
    }
    /**
     * Try to extract an integer value from a simple expression CST node.
     * Handles integer literals and unary minus on integer literals.
     */
    extractIntegerFromExpression(exprNode) {
        // Walk down expression → orExpression → xorExpression → ... → unaryExpression → primaryExpression → literal
        // Rather than tracing through every level, build the expression AST and check if it's a literal
        try {
            const expr = this.buildExpression(exprNode);
            if (!expr)
                return undefined;
            if (expr.kind === "LiteralExpression") {
                const val = Number(expr.value);
                if (!isNaN(val) && Number.isInteger(val))
                    return val;
            }
            if (expr.kind === "UnaryExpression" &&
                expr.operator === "-" &&
                expr.operand.kind === "LiteralExpression") {
                const val = -Number(expr.operand.value);
                if (!isNaN(val) && Number.isInteger(val))
                    return val;
            }
            // Resolve constant references (e.g., ARRAY[0..n] where n is VAR CONSTANT)
            if (expr.kind === "VariableExpression" &&
                expr.fieldAccess.length === 0 &&
                expr.subscripts.length === 0) {
                const constVal = this.currentConstantMap.get(expr.name.toUpperCase());
                if (constVal !== undefined)
                    return constVal;
            }
            // Handle expressions like "constant - 1" (e.g., ARRAY[0..n-1])
            if (expr.kind === "BinaryExpression") {
                const leftVal = this.evaluateConstantExpr(expr);
                if (leftVal !== undefined)
                    return leftVal;
            }
        }
        catch {
            // Fall through
        }
        return undefined;
    }
    /**
     * Evaluate a constant expression that may reference VAR CONSTANT values.
     * Supports basic integer arithmetic (+, -, *).
     */
    evaluateConstantExpr(expr) {
        if (expr.kind === "LiteralExpression") {
            const val = Number(expr.value);
            if (!isNaN(val) && Number.isInteger(val))
                return val;
            return undefined;
        }
        if (expr.kind === "VariableExpression" &&
            expr.fieldAccess.length === 0 &&
            expr.subscripts.length === 0) {
            return this.currentConstantMap.get(expr.name.toUpperCase());
        }
        if (expr.kind === "UnaryExpression" && expr.operator === "-") {
            const val = this.evaluateConstantExpr(expr.operand);
            return val !== undefined ? -val : undefined;
        }
        if (expr.kind === "BinaryExpression") {
            const left = this.evaluateConstantExpr(expr.left);
            const right = this.evaluateConstantExpr(expr.right);
            if (left === undefined || right === undefined)
                return undefined;
            switch (expr.operator) {
                case "+":
                    return left + right;
                case "-":
                    return left - right;
                case "*":
                    return left * right;
                default:
                    return undefined;
            }
        }
        return undefined;
    }
    /**
     * Extract statements from a statementList CST node.
     */
    extractStatementsFromList(listNode) {
        const stmts = [];
        if (listNode) {
            const listChildren = listNode.children;
            for (const stmtNode of getAllNodes(listChildren.statement)) {
                const stmt = this.buildStatement(stmtNode);
                if (stmt)
                    stmts.push(...(Array.isArray(stmt) ? stmt : [stmt]));
            }
        }
        return stmts;
    }
    createDummyLiteral(node) {
        return {
            kind: "LiteralExpression",
            sourceSpan: nodeToSourceSpan(node),
            literalType: "INT",
            value: 0,
            rawValue: "0",
        };
    }
    // ===========================================================================
    // Test File AST Building
    // ===========================================================================
    /**
     * Build a TestFile from the testFile CST node.
     */
    buildTestFile(cst) {
        const children = cst.children;
        const testCases = getAllNodes(children.testCase).map((tc) => this.buildTestCase(tc));
        const result = { fileName: "", testCases };
        const setupNode = getFirstNode(children.setupBlock);
        if (setupNode) {
            result.setup = this.buildSetupBlock(setupNode);
        }
        const teardownNode = getFirstNode(children.teardownBlock);
        if (teardownNode) {
            result.teardown = this.buildTeardownBlock(teardownNode);
        }
        return result;
    }
    /**
     * Build a SetupBlock from a setupBlock CST node.
     */
    buildSetupBlock(cst) {
        const children = cst.children;
        const varBlocks = getAllNodes(children.varBlock).map((vb) => this.buildVarBlock(vb));
        const body = this.buildTestStatementList(getFirstNode(children.testStatementList));
        return { varBlocks, body, sourceSpan: nodeToSourceSpan(cst) };
    }
    /**
     * Build a TeardownBlock from a teardownBlock CST node.
     */
    buildTeardownBlock(cst) {
        const children = cst.children;
        const body = this.buildTestStatementList(getFirstNode(children.testStatementList));
        return { body, sourceSpan: nodeToSourceSpan(cst) };
    }
    /**
     * Build a TestCase from a testCase CST node.
     */
    buildTestCase(cst) {
        const children = cst.children;
        const nameToken = getFirstToken(children.StringLiteral);
        // Remove surrounding quotes from test name
        const name = nameToken ? nameToken.image.slice(1, -1) : "";
        const varBlocks = getAllNodes(children.varBlock).map((vb) => this.buildVarBlock(vb));
        const body = this.buildTestStatementList(getFirstNode(children.testStatementList));
        return {
            name,
            varBlocks,
            body,
            sourceSpan: nodeToSourceSpan(cst),
        };
    }
    /**
     * Build a list of test statements from a testStatementList CST node.
     */
    buildTestStatementList(cst) {
        const children = cst.children;
        const stmts = [];
        for (const node of getAllNodes(children.testStatement)) {
            stmts.push(this.buildTestStatement(node));
        }
        return stmts;
    }
    /**
     * Build a single test statement (assert call, mock statement, or regular statement).
     */
    buildTestStatement(cst) {
        const children = cst.children;
        const assertNode = getFirstNode(children.assertCall);
        if (assertNode) {
            return this.buildAssertCall(assertNode);
        }
        const advanceTimeNode = getFirstNode(children.advanceTimeStatement);
        if (advanceTimeNode) {
            return this.buildAdvanceTimeStatement(advanceTimeNode);
        }
        const mockNode = getFirstNode(children.mockStatement);
        if (mockNode) {
            return this.buildMockStatement(mockNode);
        }
        const mockVerifyNode = getFirstNode(children.mockVerifyStatement);
        if (mockVerifyNode) {
            return this.buildMockVerifyStatement(mockVerifyNode);
        }
        const stmtNode = getFirstNode(children.statement);
        if (stmtNode) {
            const stmt = this.buildStatement(stmtNode);
            // A test statement is a single assertion/action — if a chained assignment
            // ever desugars to several, the effective (last) one is what it asserts.
            if (stmt)
                return Array.isArray(stmt) ? stmt[stmt.length - 1] : stmt;
        }
        throw new Error("Empty test statement");
    }
    /**
     * Build an AdvanceTimeStatement from an advanceTimeStatement CST node.
     */
    buildAdvanceTimeStatement(cst) {
        const children = cst.children;
        const exprNode = getFirstNode(children.expression);
        const duration = exprNode
            ? (this.buildExpression(exprNode) ?? this.createDummyLiteral(cst))
            : this.createDummyLiteral(cst);
        return {
            kind: "AdvanceTimeStatement",
            duration,
            sourceSpan: nodeToSourceSpan(cst),
        };
    }
    /**
     * Extract a qualified identifier path (Identifier.Identifier...) from a qualifiedIdentifier CST node.
     */
    buildQualifiedIdentifier(cst) {
        const children = cst.children;
        return getAllTokens(children.Identifier).map((t) => t.image);
    }
    /**
     * Build a MockFBStatement or MockFunctionStatement from a mockStatement CST node.
     */
    buildMockStatement(cst) {
        const children = cst.children;
        // MOCK_FUNCTION FuncName RETURNS expression ;
        if (children.MOCK_FUNCTION) {
            const nameToken = getFirstToken(children.Identifier);
            const functionName = nameToken?.image ?? "";
            const exprNode = getFirstNode(children.expression);
            const returnValue = exprNode
                ? (this.buildExpression(exprNode) ?? this.createDummyLiteral(cst))
                : this.createDummyLiteral(cst);
            return {
                kind: "MockFunctionStatement",
                functionName,
                returnValue,
                sourceSpan: nodeToSourceSpan(cst),
            };
        }
        // MOCK instance.path ;
        const qidNode = getFirstNode(children.qualifiedIdentifier);
        const instancePath = qidNode ? this.buildQualifiedIdentifier(qidNode) : [];
        return {
            kind: "MockFBStatement",
            instancePath,
            sourceSpan: nodeToSourceSpan(cst),
        };
    }
    /**
     * Build a MockVerifyCalledStatement or MockVerifyCallCountStatement.
     */
    buildMockVerifyStatement(cst) {
        const children = cst.children;
        // MOCK_VERIFY_CALL_COUNT(instance.path, count)
        if (children.MOCK_VERIFY_CALL_COUNT) {
            const qidNode = getFirstNode(children.qualifiedIdentifier);
            const instancePath = qidNode
                ? this.buildQualifiedIdentifier(qidNode)
                : [];
            const exprNode = getFirstNode(children.expression);
            const expectedCount = exprNode
                ? (this.buildExpression(exprNode) ?? this.createDummyLiteral(cst))
                : this.createDummyLiteral(cst);
            return {
                kind: "MockVerifyCallCountStatement",
                instancePath,
                expectedCount,
                sourceSpan: nodeToSourceSpan(cst),
            };
        }
        // MOCK_VERIFY_CALLED(instance.path)
        const qidNode = getFirstNode(children.qualifiedIdentifier);
        const instancePath = qidNode ? this.buildQualifiedIdentifier(qidNode) : [];
        return {
            kind: "MockVerifyCalledStatement",
            instancePath,
            sourceSpan: nodeToSourceSpan(cst),
        };
    }
    /**
     * Build an AssertCall from an assertCall CST node.
     */
    buildAssertCall(cst) {
        const children = cst.children;
        // Determine assert type from which token was consumed
        let assertType;
        const tokenNames = [
            ["ASSERT_EQ", "ASSERT_EQ"],
            ["ASSERT_NEQ", "ASSERT_NEQ"],
            ["ASSERT_TRUE", "ASSERT_TRUE"],
            ["ASSERT_FALSE", "ASSERT_FALSE"],
            ["ASSERT_GT", "ASSERT_GT"],
            ["ASSERT_LT", "ASSERT_LT"],
            ["ASSERT_GE", "ASSERT_GE"],
            ["ASSERT_LE", "ASSERT_LE"],
            ["ASSERT_NEAR", "ASSERT_NEAR"],
        ];
        let found = false;
        assertType = "ASSERT_EQ"; // default, overridden below
        for (const [tokenName, type] of tokenNames) {
            if (getFirstToken(children[tokenName])) {
                assertType = type;
                found = true;
                break;
            }
        }
        if (!found) {
            throw new Error("Unknown assert type");
        }
        // Collect all expression arguments
        const allArgs = getAllNodes(children.expression)
            .map((e) => this.buildExpression(e))
            .filter((e) => e !== undefined);
        // Check for optional message (last STRING literal argument)
        let message;
        const lastArg = allArgs[allArgs.length - 1];
        const minArgs = this.getMinAssertArgs(assertType);
        if (lastArg &&
            allArgs.length > minArgs &&
            lastArg.kind === "LiteralExpression" &&
            lastArg.literalType === "STRING") {
            message = lastArg.rawValue.replace(/^'|'$/g, "");
            allArgs.pop();
        }
        const result = {
            kind: "AssertCall",
            assertType,
            args: allArgs,
            sourceSpan: nodeToSourceSpan(cst),
        };
        if (message !== undefined) {
            result.message = message;
        }
        return result;
    }
    /**
     * Returns the minimum required argument count for an assert type.
     */
    getMinAssertArgs(assertType) {
        switch (assertType) {
            case "ASSERT_TRUE":
            case "ASSERT_FALSE":
                return 1;
            case "ASSERT_EQ":
            case "ASSERT_NEQ":
            case "ASSERT_GT":
            case "ASSERT_LT":
            case "ASSERT_GE":
            case "ASSERT_LE":
                return 2;
            case "ASSERT_NEAR":
                return 3;
        }
    }
}
/**
 * Build an AST from a CST.
 * Convenience function that creates a builder and builds the AST.
 * @param cst - The Chevrotain CST root node
 * @param fileName - Optional source file name to set on all sourceSpan.file fields
 */
export function buildAST(cst, fileName, globalConstants) {
    const builder = new ASTBuilder();
    // Seed the constant map with global constants (e.g., STRING_LENGTH, LIST_LENGTH)
    // so inline array dimensions like ARRAY[0..STRING_LENGTH] resolve correctly.
    if (globalConstants) {
        for (const [name, value] of Object.entries(globalConstants)) {
            builder.setGlobalConstant(name, value);
        }
    }
    const ast = builder.buildCompilationUnit(cst);
    if (fileName) {
        setFileOnSpans(ast, fileName);
    }
    return ast;
}
/**
 * Build a TestFile AST from a test file CST.
 * Convenience function that creates a builder and builds the test AST.
 * @param cst - The Chevrotain CST root node from parseTestSource()
 * @param fileName - The test file name
 */
export function buildTestAST(cst, fileName) {
    const builder = new ASTBuilder();
    const testFile = builder.buildTestFile(cst);
    testFile.fileName = fileName;
    // Set file on all sourceSpan objects
    setFileOnSpans(testFile, fileName);
    return testFile;
}
/**
 * Recursively set the file field on all sourceSpan objects in an AST.
 */
function setFileOnSpans(node, fileName) {
    if (node === null || node === undefined || typeof node !== "object")
        return;
    const obj = node;
    if (obj.sourceSpan &&
        typeof obj.sourceSpan === "object" &&
        "file" in obj.sourceSpan) {
        obj.sourceSpan.file = fileName;
    }
    for (const value of Object.values(obj)) {
        if (Array.isArray(value)) {
            for (const item of value) {
                setFileOnSpans(item, fileName);
            }
        }
        else if (typeof value === "object" && value !== null) {
            setFileOnSpans(value, fileName);
        }
    }
}
//# sourceMappingURL=ast-builder.js.map