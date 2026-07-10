/**
 * STruC++ Parser
 *
 * Parses IEC 61131-3 Structured Text tokens into an Abstract Syntax Tree.
 * Uses Chevrotain's embedded DSL for grammar definition.
 */
import { CstParser, CstNode } from "chevrotain";
/**
 * STruC++ Parser for IEC 61131-3 Structured Text.
 *
 * This parser produces a Concrete Syntax Tree (CST) which is then
 * transformed into an Abstract Syntax Tree (AST) by the visitor.
 */
export declare class STParser extends CstParser {
    constructor(tokenVocabulary?: import("chevrotain").TokenType[]);
    /**
     * Entry point: A compilation unit contains one or more POUs or type definitions.
     */
    compilationUnit: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * PROGRAM declaration
     */
    programDeclaration: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * FUNCTION declaration
     */
    functionDeclaration: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * FUNCTION_BLOCK declaration with OOP extensions
     * Supports: ABSTRACT, FINAL, EXTENDS, IMPLEMENTS, methods, properties
     */
    functionBlockDeclaration: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * INTERFACE declaration
     */
    interfaceDeclaration: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Interface method declaration (no body, implicitly abstract)
     */
    interfaceMethodDeclaration: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * METHOD declaration within a Function Block
     */
    methodDeclaration: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Variable block inside a method (supports VAR_INST in addition to standard blocks)
     */
    methodVarBlock: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * PROPERTY declaration within a Function Block
     */
    propertyDeclaration: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Property GET accessor
     */
    propertyGetter: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Property SET accessor
     */
    propertySetter: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Identifier or contextual keyword.
     * Allows SET, GET, ON, OVERRIDE, ABSTRACT, FINAL to be used as
     * variable/parameter/function names in contexts where they are unambiguous.
     */
    identifierOrKeyword: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Variable block (VAR, VAR_INPUT, VAR_OUTPUT, etc.)
     */
    varBlock: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Single variable declaration
     *
     * IEC 61131-3 puts the `AT %X…` location directive between the
     * variable name and the colon (`v AT %QX0.0 : BOOL;`).  Several
     * real-world editors — OpenPLC among them — emit the location
     * after the type instead (`v : BOOL AT %QX0.0;`).  Accept both
     * forms so the parser doesn't bail on the second form and skip
     * every subsequent declaration in the VAR block.
     */
    varDeclaration: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Initializer expression: single expression or comma-separated list for array init.
     * Handles: x := 5; and arr := 0, 31, 59, 90, ...;
     */
    initializerExpression: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Array literal: [expr, expr, ...]
     * Bracket-enclosed comma-separated expressions for array initialization.
     */
    arrayLiteral: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * TYPE declaration block
     */
    typeDeclaration: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Single type definition
     * Supports: struct, enum (simple or typed), array, subrange, or alias
     */
    singleTypeDeclaration: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Structure type definition
     */
    structType: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Simple enumeration type definition: (RED, YELLOW, GREEN)
     * Optionally with default value: (RED, YELLOW, GREEN) := RED
     */
    simpleEnumType: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Enumeration member: NAME or NAME := value
     */
    enumMember: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Typed enumeration, subrange, or simple alias
     * - Typed enum: INT (IDLE := 0, RUNNING := 1)
     * - Subrange: INT(0..100)
     * - Alias: INT
     */
    typedEnumOrSubrangeOrAlias: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Subrange bounds: expression..expression
     */
    subrangeBounds: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Lookahead helper to detect if we're parsing a subrange (has ..)
     */
    private isSubrangeAhead;
    /**
     * Array type definition
     */
    arrayType: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Array dimension: either fixed bounds (start..end) or variable-length (*)
     */
    arrayDimension: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Data type reference (simple type, REF_TO type, or REFERENCE_TO type)
     */
    dataType: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * CONFIGURATION declaration
     */
    configurationDeclaration: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * RESOURCE declaration
     */
    resourceDeclaration: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * TASK declaration
     */
    taskDeclaration: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Program instance declaration
     */
    programInstance: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * List of statements
     */
    statementList: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Single statement
     */
    statement: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * THIS.member := expr; or THIS.method(args); statement
     */
    thisStatement: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Lookahead helper to detect if next token starts a VAR block.
     */
    private isVarBlockAhead;
    /**
     * Contextual keyword tokens that can also be used as identifiers.
     * Keep in sync with the identifierOrKeyword rule alternatives.
     */
    private static readonly CONTEXTUAL_KEYWORDS;
    /**
     * Lookahead helper to detect if a token type is an identifier or contextual keyword.
     * Used by isMethodCallAhead() for lookahead decisions.
     */
    private isIdentifierOrKeywordToken;
    /**
     * Lookahead helper to detect if the current position starts a CASE label.
     * Scans forward looking for a bare Colon (:) before finding Assign (:=),
     * Semicolon, or LParen — which would indicate a statement, not a label.
     * Handles: `42:`, `x:`, `MyEnum.RED:`, `1..5:`
     */
    private isCaseLabelStart;
    private isMethodCallAhead;
    /**
     * instance.method(args); statement
     */
    methodCallStatement: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * SUPER^(); or SUPER^.method(args); statement
     * Caret is mandatory — SUPER is a pointer to parent (CODESYS semantics).
     */
    superCallStatement: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * External code pragma: {external ... }
     * Content is passed through AS-IS to generated C++ code.
     */
    externalCodePragma: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Lookahead helper to detect if we're parsing a refAssign statement (has REF=)
     */
    private isRefAssignAhead;
    /**
     * REF= assignment statement (bind REFERENCE_TO to a variable)
     */
    refAssignStatement: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Assignment statement, including CODESYS-style chained assignment
     * `a := b := expr;` (every target on the chain receives the value).
     * Each extra `target :=` is a gated `assignTargetTail`; the BACKTRACK
     * gate distinguishes a chained target from the final RHS expression
     * (both can start with an identifier).
     */
    assignmentStatement: import("chevrotain").ParserMethod<[], CstNode>;
    /** One extra `target :=` link in a chained assignment (`… := target := …`). */
    assignTargetTail: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * IF statement
     */
    ifStatement: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * CASE statement
     */
    caseStatement: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * CASE element (one or more case labels with statements)
     */
    caseElement: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Statement list inside a CASE element.
     * Stops iterating when the next tokens look like a new case label
     * (identifier/integer followed by Colon), preventing the parser from
     * consuming the next case label as an assignment statement.
     */
    caseStatementList: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Case label (single value or range)
     */
    caseLabel: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * FOR statement
     */
    forStatement: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * WHILE statement
     */
    whileStatement: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * REPEAT statement
     */
    repeatStatement: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * EXIT statement
     */
    exitStatement: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * RETURN statement
     */
    returnStatement: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Function/FB call as statement
     */
    functionCallStatement: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * __DELETE(expression) statement - deallocate dynamic memory
     */
    deleteStatement: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Expression (entry point for expression parsing)
     */
    expression: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * OR expression
     */
    orExpression: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * XOR expression
     */
    xorExpression: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * AND expression
     */
    andExpression: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Comparison expression
     */
    comparisonExpression: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Addition/subtraction expression
     */
    addExpression: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Multiplication/division expression
     */
    mulExpression: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Power expression
     */
    powerExpression: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Unary expression
     */
    unaryExpression: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Primary expression
     */
    primaryExpression: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * instance.method(args) expression
     */
    methodCall: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Chained method call: .methodName(args)
     * Used inside methodCall/methodCallStatement for fluent interface patterns.
     */
    chainedMethodCall: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * THIS.member or THIS.method(args) access
     */
    thisAccess: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * SUPER^() or SUPER^.method(args) access
     * Caret is mandatory — SUPER is a pointer to parent (CODESYS semantics).
     */
    superAccess: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * REF(variable) expression - get reference to a variable
     */
    refExpression: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * DREF(expression) expression - dereference a reference
     */
    drefExpression: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * __NEW(dataType) or __NEW(dataType, expression) - allocate dynamic memory
     */
    newExpression: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Variable reference (with optional array subscripts and field access)
     */
    variable: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Function or FB call
     */
    functionCall: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Argument list for function calls
     */
    argumentList: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Single argument (positional or named)
     */
    argument: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Literal value
     */
    literal: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Top-level rule for test files: optional SETUP, optional TEARDOWN, then TEST blocks
     */
    testFile: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * SETUP ... END_SETUP block with optional VAR declarations and statements
     */
    setupBlock: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * TEARDOWN ... END_TEARDOWN block
     */
    teardownBlock: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Individual TEST block
     */
    testCase: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * List of statements inside a test block (includes assert calls)
     */
    testStatementList: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Single statement inside a test block: assert call, mock statement, or regular statement
     */
    testStatement: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * ADVANCE_TIME(expression) ; - Advance scan-cycle time in tests
     */
    advanceTimeStatement: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Assert function call (all assert types)
     */
    assertCall: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Lookahead helper to detect if next token is an ASSERT_* keyword
     */
    private isAssertAhead;
    /**
     * Mock statement: MOCK instance.path ; or MOCK_FUNCTION FuncName RETURNS expr ;
     */
    mockStatement: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Mock verification statements
     */
    mockVerifyStatement: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Qualified identifier: Identifier (.Identifier)*
     * Used for mock instance paths like ctrl.sensor or ctrl.subsystem.valve
     */
    qualifiedIdentifier: import("chevrotain").ParserMethod<[], CstNode>;
    /**
     * Lookahead helper to detect MOCK or MOCK_FUNCTION
     */
    private isMockAhead;
    /**
     * Lookahead helper to detect MOCK_VERIFY_CALLED or MOCK_VERIFY_CALL_COUNT
     */
    private isMockVerifyAhead;
}
/**
 * Singleton parser instance for source files.
 */
export declare const parser: STParser;
/**
 * Singleton parser instance for test files.
 * Uses the test token list which includes TEST/END_TEST/ASSERT_* tokens.
 */
export declare const testParser: STParser;
/**
 * Parse ST source code into a CST.
 *
 * @param source - The ST source code to parse
 * @returns Parse result with CST and any errors
 */
export declare function parse(source: string): {
    cst: CstNode | null;
    errors: unknown[];
};
/**
 * Parse a test file into a CST using the test lexer/parser.
 *
 * @param source - The test file source code to parse
 * @returns Parse result with CST and any errors
 */
export declare function parseTestSource(source: string): {
    cst: CstNode | null;
    errors: unknown[];
};
//# sourceMappingURL=parser.d.ts.map