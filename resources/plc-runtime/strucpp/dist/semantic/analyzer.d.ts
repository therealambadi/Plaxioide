/**
 * STruC++ Semantic Analyzer
 *
 * Coordinates semantic analysis passes over the AST.
 * Builds symbol tables, performs type checking, and validates IEC semantics.
 */
import type { CompilationUnit, TestFile } from "../frontend/ast.js";
import type { CompileError } from "../types.js";
import { SymbolTables } from "./symbol-table.js";
/**
 * Result of semantic analysis.
 */
export interface SemanticAnalysisResult {
    /** Whether analysis was successful (no errors) */
    success: boolean;
    /** Symbol tables built during analysis */
    symbolTables: SymbolTables;
    /** Errors found during analysis */
    errors: CompileError[];
    /** Warnings found during analysis */
    warnings: CompileError[];
}
export declare class SemanticAnalyzer {
    private symbolTables;
    private typeChecker;
    private stdRegistry;
    private enumMemberMap;
    private errors;
    private warnings;
    /** Track all located variables for duplicate detection */
    private locatedVars;
    constructor();
    /**
     * Analyze a compilation unit.
     * @param ast The compilation unit to analyze
     * @param existingSymbolTables Optional pre-populated symbol tables (e.g., with library symbols)
     */
    analyze(ast: CompilationUnit, existingSymbolTables?: SymbolTables): SemanticAnalysisResult;
    /**
     * Resolve a type name to its registered type (preserves enum typeKind)
     * or fall back to a generic elementary type for unknown/user-defined types.
     */
    private resolveVarType;
    /**
     * Build symbol tables from the AST.
     */
    private buildSymbolTables;
    /**
     * Build symbols from variable blocks.
     */
    private buildVarBlockSymbols;
    /**
     * Validate IEC 61131-3 semantic rules.
     */
    private validateSemantics;
    /**
     * Validate that no assignments target CONSTANT variables.
     */
    private validateConstantAssignments;
    /**
     * Walk statements and check for assignments to CONSTANT variables.
     */
    private validateStatementsForConstantAssignment;
    /**
     * Validate located variables for IEC 61131-3 compliance.
     * Checks:
     * - Located variables not allowed in function blocks
     * - No duplicate addresses
     * - Type must be compatible with address size
     * - Bit index must be 0-7 for bit addresses
     */
    private validateLocatedVariables;
    /**
     * Validate variable block modifiers (CONSTANT, RETAIN).
     * Checks:
     * - RETAIN + CONSTANT mutual exclusion
     * - CONSTANT requires initializer
     * - Block type restrictions for CONSTANT
     * - Block type restrictions for RETAIN
     */
    private validateVarModifiers;
    /**
     * Add an error message.
     */
    private addError;
    /**
     * Validate that property names don't collide with member variable names
     * within the same function block. A collision causes the setter parameter
     * to silently shadow the member variable.
     */
    private validatePropertyNameCollisions;
    /**
     * Validate OOP modifier contradictions on function blocks and methods.
     */
    private validateOOPModifiers;
    /**
     * Collect all methods from the parent chain of a function block.
     * Returns a map of uppercase method name → nearest parent MethodDeclaration.
     */
    private collectParentMethods;
    /**
     * Validate that an OVERRIDE method has the same signature as the parent method.
     */
    private validateOverrideSignature;
    /**
     * Extract VAR_INPUT parameter names and types from a method declaration.
     */
    private extractMethodParams;
    /**
     * Validate that abstract function blocks are not instantiated directly.
     */
    private validateAbstractInstantiation;
    /**
     * Check var blocks for instantiation of abstract FBs.
     */
    private checkVarBlocksForAbstractInstantiation;
    /**
     * Validate that properties without setters are not written to.
     * Best-effort check for direct `x.Property := value;` assignments.
     */
    private validatePropertyAccess;
    /**
     * Build a map of variable name (uppercase) → type name (uppercase) from var blocks.
     */
    private buildVarTypeMap;
    /**
     * Walk statements looking for assignments to read-only properties.
     */
    private walkStatementsForPropertyWrites;
    /**
     * Recurse into control flow statements for property write checks.
     */
    private recurseStatementsForPropertyWrites;
    /**
     * Validate expressions across all programs, functions, and FBs.
     * Checks std function argument counts, bit access bounds, and ADR l-value targets.
     */
    private validateExpressions;
    /**
     * Walk statements checking expressions for bit access bounds and ADR l-value issues.
     */
    private walkStatementsForExpressionValidation;
    /**
     * Recurse into control flow statements for expression validation.
     */
    private recurseStatementsForExpressionValidation;
    /**
     * Validate a single expression recursively for std function args, bit access, and ADR issues.
     */
    private validateExpression;
    /**
     * Check if an expression is a valid l-value (can have its address taken).
     */
    private isLValue;
    /**
     * Validate standard function argument counts and special constraints (e.g., ADR l-value).
     * Covers all registered std functions and *_TO_* conversion functions.
     *
     * EN and ENO are implicit IEC 61131-3 pins — they gate execution and signal
     * success around the call site, but they are not part of any function's
     * declared signature. Strip them before counting against the registry.
     */
    private checkStdFunctionArgs;
    /**
     * Ordered input parameters of a function, each flagged optional when it
     * declares an initial value. Handles both symbol shapes:
     *   - Library functions carry resolved `parameters` (a VariableSymbol per
     *     param; its `initialValue` string marks an optional input).
     *   - User-defined functions carry their VAR_INPUT declarations on
     *     `declaration.varBlocks` (an AST `initialValue` marks an optional one).
     */
    private functionInputParams;
    /**
     * Option A: every input without an initial value is mandatory. Resolve the
     * call's named/positional arguments to parameter slots (mirroring the
     * codegen's argument reordering) and error if any mandatory input is left
     * unsupplied.
     */
    private checkRequiredFunctionInputs;
    /**
     * Check bit access bounds on a variable expression.
     * Detects patterns like `var.31` where 31 exceeds the bit width of var's type.
     */
    private checkBitAccess;
    /**
     * Validate access modifier enforcement for method calls.
     * PRIVATE methods only callable from within same FB.
     * PROTECTED only from same FB or derived FBs.
     */
    private validateAccessModifiers;
    /**
     * Walk statements looking for method calls that violate access modifiers.
     */
    private walkStatementsForAccessViolations;
    /**
     * Walk an expression tree looking for method calls that violate access modifiers.
     */
    private walkExpressionForAccessViolations;
    /**
     * Check a dotted FunctionCallExpression (e.g., functionName="m.InternalCalc")
     * for access modifier violations.
     */
    private checkDottedFunctionCallAccess;
    /**
     * Check a single method call for access modifier violations.
     */
    private checkMethodCallAccess;
    /**
     * Recurse into control flow statements for access violation checks.
     */
    private recurseStatementsForAccessViolations;
    /**
     * Check if a type name is known (registered in symbol tables or a synthetic internal type).
     */
    private isKnownType;
    /**
     * Validate a single TypeReference node. Reports an error if the referenced type is unknown.
     */
    private validateSingleTypeReference;
    /**
     * Validate all type references in the AST.
     * Walks variable declarations, return types, EXTENDS/IMPLEMENTS clauses,
     * method parameters, properties, global var blocks, and type definitions.
     */
    private validateTypeReferences;
    /**
     * Validate type references within a type definition (struct fields, array elements, etc.).
     */
    private validateTypeDefinitionReferences;
    /**
     * Validate that all variable references in POU bodies refer to declared variables.
     */
    private validateUndeclaredVariables;
    /**
     * Walk statements checking for undeclared variable usage.
     */
    private walkStatementsForUndeclaredVars;
    /**
     * Recursively check an expression for undeclared variable usage.
     */
    private checkExpressionForUndeclaredVars;
    /**
     * Reject `Type.member` patterns where `Type` is a type-level
     * symbol (function block, program, or user-defined TYPE) rather
     * than an instance.  In IEC 61131-3 a function block can only be
     * accessed through an instance variable — `VAR x : MyFB;` then
     * `x.member` — never via the FB name directly.  Strucpp's codegen
     * emits the FB name as a C++ struct type, so `MyFB.member` lands
     * in g++ as `expected unqualified-id before '.' token`; catching
     * it here lets the diagnostic point at the actual ST line.
     *
     * Locally-shadowed names (a `VAR foo : Foo;` declaration of the
     * same identifier) are honoured because `scope.lookup` walks the
     * chain — the shadowing variable wins and no error fires.
     *
     * `enumValue` symbols also live in the global scope (for
     * autocomplete) but they're values, not types; member access on
     * them is rejected by the type system elsewhere, so we skip them
     * here.
     */
    private checkInstanceAccess;
    /**
     * Check whether a name is declared in the current scope chain or context.
     */
    private checkNameDeclared;
    /**
     * Analyze a parsed test file against source symbol tables.
     * Validates type references in var blocks and undeclared variable usage
     * in SETUP, TEARDOWN, and TEST bodies.
     */
    analyzeTestFile(testFile: TestFile, sourceSymbolTables: SymbolTables): {
        errors: CompileError[];
        warnings: CompileError[];
    };
    /**
     * Validate type references in test var blocks.
     */
    private validateTestVarBlocks;
    /**
     * Build a Scope from test var blocks, parented to the given parent scope.
     */
    private buildTestScope;
    /**
     * Walk test statements checking for undeclared variable usage.
     * Handles test-specific statement kinds (AssertCall, AdvanceTime, Mock*).
     */
    private walkTestStatementsForUndeclaredVars;
    /**
     * Validate assert call argument count matches the expected count for each assert type.
     */
    private validateAssertArgCount;
    /**
     * Validate MOCK_FUNCTION target exists in global scope or std function registry.
     */
    private validateMockFunction;
    /**
     * Validate that the first segment of a MOCK/MOCK_VERIFY instance path is a declared variable.
     */
    private validateMockInstancePath;
    /**
     * Add a warning message.
     * Used in Phase 3+ for semantic validation warnings.
     */
    protected addWarning(message: string, line: number, column: number, file?: string): void;
}
/**
 * Analyze a compilation unit.
 * Convenience function that creates an analyzer and runs analysis.
 */
export declare function analyze(ast: CompilationUnit, existingSymbolTables?: SymbolTables): SemanticAnalysisResult;
/**
 * Analyze a test file against source symbol tables.
 * Convenience function that creates an analyzer and runs test file analysis.
 */
export declare function analyzeTestFile(testFile: TestFile, sourceSymbolTables: SymbolTables): {
    errors: CompileError[];
    warnings: CompileError[];
};
//# sourceMappingURL=analyzer.d.ts.map