/**
 * STruC++ CST to AST Builder
 *
 * This module converts the Chevrotain Concrete Syntax Tree (CST) produced by
 * the parser into the Abstract Syntax Tree (AST) defined in ast.ts.
 */
import type { CstNode } from "chevrotain";
import type { CompilationUnit, ProgramDeclaration, FunctionDeclaration, FunctionBlockDeclaration, InterfaceDeclaration, MethodDeclaration, PropertyDeclaration, TypeDeclaration, TypeDefinition, StructDefinition, EnumDefinition, EnumMember, ArrayDefinition, ArrayDimension, SubrangeDefinition, ConfigurationDeclaration, ResourceDeclaration, TaskDeclaration, ProgramInstance, VarBlock, VarDeclaration, TypeReference, Statement, Expression, LiteralExpression, VariableExpression, AssignmentStatement, RefAssignStatement, RefExpression, DrefExpression, NewExpression, DeleteStatement, FunctionCallExpression, MethodCallExpression, FunctionCallStatement, Argument, IfStatement, ForStatement, WhileStatement, RepeatStatement, CaseStatement, CaseElement, CaseLabel, ExitStatement, ReturnStatement, ExternalCodePragma } from "./ast.js";
/**
 * Builds an AST from a Chevrotain CST.
 */
export declare class ASTBuilder {
    /**
     * Map of constant names to their integer values, populated per POU.
     * Used by extractIntegerFromExpression to resolve array dimension bounds
     * that reference VAR CONSTANT declarations (e.g., ARRAY[0..n] where n is a constant).
     * Global constants (from compile options) are seeded first and persist across POUs.
     */
    private currentConstantMap;
    /** Global constants that persist across POU scans (never cleared). */
    private globalConstantMap;
    /** Seed a global constant for dimension resolution. */
    setGlobalConstant(name: string, value: number): void;
    /**
     * Scan raw CST varBlock nodes for CONSTANT declarations and populate
     * currentConstantMap with their integer values.
     */
    private scanVarBlocksForConstants;
    /**
     * Build a CompilationUnit from the root CST node.
     */
    buildCompilationUnit(cst: CstNode): CompilationUnit;
    /**
     * Build a ProgramDeclaration from a CST node.
     */
    buildProgramDeclaration(node: CstNode): ProgramDeclaration;
    /**
     * Build a FunctionDeclaration from a CST node.
     */
    buildFunctionDeclaration(node: CstNode): FunctionDeclaration;
    /**
     * Build a FunctionBlockDeclaration from a CST node.
     */
    buildFunctionBlockDeclaration(node: CstNode): FunctionBlockDeclaration;
    /**
     * Build an InterfaceDeclaration from a CST node.
     */
    buildInterfaceDeclaration(node: CstNode): InterfaceDeclaration;
    /**
     * Build a MethodDeclaration from an interface method CST node.
     * Interface methods are implicitly public and abstract.
     */
    buildInterfaceMethodDeclaration(node: CstNode): MethodDeclaration;
    /**
     * Build a MethodDeclaration from a methodDeclaration CST node.
     */
    buildMethodDeclaration(node: CstNode): MethodDeclaration;
    /**
     * Build a VarBlock from a methodVarBlock CST node (supports VAR_INST).
     */
    buildMethodVarBlock(node: CstNode): VarBlock;
    /**
     * Build a PropertyDeclaration from a propertyDeclaration CST node.
     */
    buildPropertyDeclaration(node: CstNode): PropertyDeclaration;
    /**
     * Build TypeDeclarations from a TYPE...END_TYPE block CST node.
     * A single TYPE block can contain multiple type declarations.
     */
    buildTypeDeclarationBlock(node: CstNode): TypeDeclaration[];
    /**
     * Build a single TypeDeclaration from a singleTypeDeclaration CST node.
     */
    buildSingleTypeDeclaration(node: CstNode): TypeDeclaration;
    /**
     * Build a TypeDefinition from a singleTypeDeclaration CST node.
     * Handles struct, enum (simple or typed), array, subrange, and alias types.
     */
    buildTypeDefinition(node: CstNode): TypeDefinition;
    /**
     * Build a StructDefinition from a structType CST node.
     */
    buildStructDefinition(node: CstNode): StructDefinition;
    /**
     * Build an EnumDefinition from a simpleEnumType CST node.
     * Handles: (RED, YELLOW, GREEN) or (A := 0, B := 1)
     */
    buildSimpleEnumDefinition(node: CstNode): EnumDefinition;
    /**
     * Build an EnumMember from an enumMember CST node.
     */
    buildEnumMember(node: CstNode): EnumMember;
    /**
     * Build an ArrayDefinition from an arrayType CST node.
     */
    buildArrayDefinition(node: CstNode): ArrayDefinition;
    /**
     * Build a TypeReference for POINTER TO ARRAY[...] OF T in TYPE declarations.
     * Represents the pointer-to-array as a TypeReference with arrayDimensions,
     * matching the representation used by varDeclaration for inline array types.
     */
    buildPointerToArrayTypeReference(arrayNode: CstNode): TypeReference;
    /**
     * Build an ArrayDimension from an arrayDimension CST node.
     */
    buildArrayDimension(node: CstNode): ArrayDimension;
    /**
     * Build a TypeDefinition from a typedEnumOrSubrangeOrAlias CST node.
     * Handles:
     * - Typed enum: INT (IDLE := 0, RUNNING := 1)
     * - Subrange: INT(0..100)
     * - Alias: INT
     */
    buildTypedEnumOrSubrangeOrAlias(node: CstNode): TypeDefinition;
    /**
     * Build a SubrangeDefinition from a subrangeBounds CST node.
     */
    buildSubrangeDefinition(node: CstNode, baseType: TypeReference): SubrangeDefinition;
    /**
     * Build a ConfigurationDeclaration from a CST node.
     */
    buildConfigurationDeclaration(node: CstNode): ConfigurationDeclaration;
    /**
     * Build a ResourceDeclaration from a CST node.
     */
    buildResourceDeclaration(node: CstNode): ResourceDeclaration;
    /**
     * Build a TaskDeclaration from a CST node.
     */
    buildTaskDeclaration(node: CstNode): TaskDeclaration;
    /**
     * Build a ProgramInstance from a CST node.
     */
    buildProgramInstance(node: CstNode): ProgramInstance;
    /**
     * Build a VarBlock from a CST node.
     */
    buildVarBlock(node: CstNode): VarBlock;
    /**
     * Build a VarDeclaration from a CST node.
     */
    buildVarDeclaration(node: CstNode): VarDeclaration;
    /**
     * Build a TypeReference from a CST node.
     */
    buildTypeReference(node: CstNode): TypeReference;
    /**
     * Build a TypeReference for an inline ARRAY type.
     * For VLA: ARRAY[*] OF INT → name "__VLA_1D_INT"
     * For fixed: ARRAY[1..10] OF INT → name "__INLINE_ARRAY_INT"
     */
    private buildInlineArrayTypeReference;
    /**
     * Build a Statement from a CST node.
     */
    buildStatement(node: CstNode): Statement | Statement[] | undefined;
    /**
     * Build a RefAssignStatement from a CST node.
     */
    buildRefAssignStatement(node: CstNode): RefAssignStatement;
    /**
     * Build an AssignmentStatement from a CST node.
     */
    buildAssignmentStatement(node: CstNode): AssignmentStatement[];
    /**
     * Build an IfStatement from a CST node.
     */
    buildIfStatement(node: CstNode): IfStatement;
    /**
     * Build a ForStatement from a CST node.
     */
    buildForStatement(node: CstNode): ForStatement;
    /**
     * Build a WhileStatement from a CST node.
     */
    buildWhileStatement(node: CstNode): WhileStatement;
    /**
     * Build a RepeatStatement from a CST node.
     */
    buildRepeatStatement(node: CstNode): RepeatStatement;
    /**
     * Build a CaseStatement from a CST node.
     */
    buildCaseStatement(node: CstNode): CaseStatement;
    /**
     * Build a CaseElement from a CST node.
     */
    buildCaseElement(node: CstNode): CaseElement;
    /**
     * Build a CaseLabel from a CST node.
     */
    buildCaseLabel(node: CstNode): CaseLabel;
    /**
     * Build an ExitStatement from a CST node.
     */
    buildExitStatement(node: CstNode): ExitStatement;
    /**
     * Build a ReturnStatement from a CST node.
     */
    buildReturnStatement(node: CstNode): ReturnStatement;
    /**
     * Build an ExternalCodePragma from a CST node.
     * Extracts the raw C/C++ code from the {external ...} pragma.
     */
    buildExternalCodePragma(node: CstNode): ExternalCodePragma;
    /**
     * Build an Expression from a CST node.
     */
    buildExpression(node: CstNode): Expression | undefined;
    /**
     * Build an OR expression (handles binary operators).
     */
    buildOrExpression(node: CstNode): Expression | undefined;
    /**
     * Build an XOR expression.
     */
    buildXorExpression(node: CstNode): Expression | undefined;
    /**
     * Build an AND expression.
     */
    buildAndExpression(node: CstNode): Expression | undefined;
    /**
     * Build a comparison expression.
     */
    buildComparisonExpression(node: CstNode): Expression | undefined;
    /**
     * Build an addition expression.
     */
    buildAddExpression(node: CstNode): Expression | undefined;
    /**
     * Build a multiplication expression.
     */
    buildMulExpression(node: CstNode): Expression | undefined;
    /**
     * Build a power expression.
     */
    buildPowerExpression(node: CstNode): Expression | undefined;
    /**
     * Build a unary expression.
     */
    buildUnaryExpression(node: CstNode): Expression | undefined;
    /**
     * Build a primary expression.
     */
    buildPrimaryExpression(node: CstNode): Expression | undefined;
    /**
     * Build a RefExpression from a CST node.
     */
    buildRefExpression(node: CstNode): RefExpression;
    /**
     * Build a DrefExpression from a CST node.
     */
    buildDrefExpression(node: CstNode): DrefExpression;
    /**
     * Build a NewExpression from a CST node.
     * Handles: __NEW(dataType) or __NEW(dataType, expression)
     */
    buildNewExpression(node: CstNode): NewExpression;
    /**
     * Build a DeleteStatement from a CST node.
     * Handles: __DELETE(expression)
     */
    buildDeleteStatement(node: CstNode): DeleteStatement;
    /**
     * Try to build an expression directly from tokens.
     */
    tryBuildDirectExpression(node: CstNode): Expression | undefined;
    /**
     * Build a LiteralExpression from a CST node.
     */
    buildLiteralExpression(node: CstNode): LiteralExpression;
    /**
     * Build a VariableExpression from a CST node.
     */
    buildVariableExpression(node: CstNode): VariableExpression;
    /**
     * Build an ordered access chain from variable CST children.
     * Sorts Dot tokens, LBracket tokens, and Caret tokens by source offset
     * to reconstruct the correct interleaving order.
     */
    private buildAccessChain;
    /**
     * Build a THIS access expression from a thisAccess CST node.
     * THIS.member -> VariableExpression { name: "THIS", fieldAccess: ["member"] }
     * THIS.method(args) -> FunctionCallExpression { functionName: "THIS.method", ... }
     */
    buildThisAccessExpression(node: CstNode): Expression;
    /**
     * Build a SUPER access expression from a superAccess CST node.
     * SUPER.method(args) -> FunctionCallExpression { functionName: "SUPER.method", ... }
     * SUPER.member -> VariableExpression { name: "SUPER", fieldAccess: ["member"] }
     */
    buildSuperAccessExpression(node: CstNode): Expression;
    /**
     * Build a method call expression: instance.method(args)
     * Maps to FunctionCallExpression with functionName = "instance.method"
     */
    buildMethodCallExpression(node: CstNode): FunctionCallExpression | MethodCallExpression;
    /**
     * Build a FunctionCallExpression from a functionCall CST node.
     */
    buildFunctionCallExpression(node: CstNode): FunctionCallExpression;
    /**
     * Build a MethodCallExpression from a chainedMethodCall CST node.
     * Wraps the previous expression as the object of the chained call.
     */
    private buildChainedCall;
    /**
     * Build an Argument from an argument CST node.
     */
    buildArgument(node: CstNode): Argument;
    /**
     * Build a FunctionCallStatement from a functionCallStatement CST node.
     */
    buildFunctionCallStatement(node: CstNode): FunctionCallStatement;
    /**
     * Build a method call statement: instance.method(args);
     * Maps to FunctionCallStatement with functionName = "instance.method"
     */
    buildMethodCallStatement(node: CstNode): FunctionCallStatement;
    /**
     * Build a THIS statement: THIS.member := expr; or THIS.method(args);
     * Assignment maps to AssignmentStatement; method call maps to FunctionCallStatement.
     */
    buildThisStatement(node: CstNode): Statement;
    /**
     * Build a SUPER call statement: SUPER^(); or SUPER^.method(args);
     * Body call → functionName = "SUPER"; method call → functionName = "SUPER.method"
     */
    buildSuperCallStatement(node: CstNode): FunctionCallStatement;
    /**
     * Create a dummy variable expression for error recovery.
     */
    private createDummyVariable;
    /**
     * Try to extract an integer value from a simple expression CST node.
     * Handles integer literals and unary minus on integer literals.
     */
    private extractIntegerFromExpression;
    /**
     * Evaluate a constant expression that may reference VAR CONSTANT values.
     * Supports basic integer arithmetic (+, -, *).
     */
    private evaluateConstantExpr;
    /**
     * Extract statements from a statementList CST node.
     */
    private extractStatementsFromList;
    private createDummyLiteral;
    /**
     * Build a TestFile from the testFile CST node.
     */
    buildTestFile(cst: CstNode): import("./ast.js").TestFile;
    /**
     * Build a SetupBlock from a setupBlock CST node.
     */
    buildSetupBlock(cst: CstNode): import("./ast.js").SetupBlock;
    /**
     * Build a TeardownBlock from a teardownBlock CST node.
     */
    buildTeardownBlock(cst: CstNode): import("./ast.js").TeardownBlock;
    /**
     * Build a TestCase from a testCase CST node.
     */
    buildTestCase(cst: CstNode): import("./ast.js").TestCase;
    /**
     * Build a list of test statements from a testStatementList CST node.
     */
    buildTestStatementList(cst: CstNode): import("./ast.js").TestStatement[];
    /**
     * Build a single test statement (assert call, mock statement, or regular statement).
     */
    buildTestStatement(cst: CstNode): import("./ast.js").TestStatement;
    /**
     * Build an AdvanceTimeStatement from an advanceTimeStatement CST node.
     */
    buildAdvanceTimeStatement(cst: CstNode): import("./ast.js").AdvanceTimeStatement;
    /**
     * Extract a qualified identifier path (Identifier.Identifier...) from a qualifiedIdentifier CST node.
     */
    private buildQualifiedIdentifier;
    /**
     * Build a MockFBStatement or MockFunctionStatement from a mockStatement CST node.
     */
    buildMockStatement(cst: CstNode): import("./ast.js").MockFBStatement | import("./ast.js").MockFunctionStatement;
    /**
     * Build a MockVerifyCalledStatement or MockVerifyCallCountStatement.
     */
    buildMockVerifyStatement(cst: CstNode): import("./ast.js").MockVerifyCalledStatement | import("./ast.js").MockVerifyCallCountStatement;
    /**
     * Build an AssertCall from an assertCall CST node.
     */
    buildAssertCall(cst: CstNode): import("./ast.js").AssertCall;
    /**
     * Returns the minimum required argument count for an assert type.
     */
    private getMinAssertArgs;
}
/**
 * Build an AST from a CST.
 * Convenience function that creates a builder and builds the AST.
 * @param cst - The Chevrotain CST root node
 * @param fileName - Optional source file name to set on all sourceSpan.file fields
 */
export declare function buildAST(cst: CstNode, fileName?: string, globalConstants?: Record<string, number>): CompilationUnit;
/**
 * Build a TestFile AST from a test file CST.
 * Convenience function that creates a builder and builds the test AST.
 * @param cst - The Chevrotain CST root node from parseTestSource()
 * @param fileName - The test file name
 */
export declare function buildTestAST(cst: CstNode, fileName: string): import("./ast.js").TestFile;
//# sourceMappingURL=ast-builder.d.ts.map