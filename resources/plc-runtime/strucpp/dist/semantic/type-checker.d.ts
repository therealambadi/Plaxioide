/**
 * STruC++ Type Checker
 *
 * Performs type checking and type inference on the AST.
 * Validates IEC 61131-3 type rules and resolves types for expressions.
 *
 * Sub-Phase B: Walks all POUs and resolves every expression's type (sets resolvedType on AST nodes).
 * Sub-Phase C: Validates type rules (assignment compatibility, conditions, FOR vars, function args).
 */
import type { Expression, IECType, CompilationUnit } from "../frontend/ast.js";
import type { SymbolTables, Scope } from "./symbol-table.js";
import type { StdFunctionRegistry } from "./std-function-registry.js";
import type { CompileError } from "../types.js";
export { ELEMENTARY_TYPES, TYPE_CATEGORIES } from "./type-utils.js";
export type { TypeCategory } from "./type-utils.js";
/**
 * Type checker for IEC 61131-3 programs.
 */
export declare class TypeChecker {
    private symbolTables;
    private stdRegistry?;
    private errors;
    private warnings;
    private ast;
    constructor(symbolTables: SymbolTables, stdRegistry?: StdFunctionRegistry | undefined);
    /**
     * Check types for a complete compilation unit.
     * Walks all POUs, resolves expression types, and validates type rules.
     */
    check(ast: CompilationUnit): {
        errors: CompileError[];
        warnings: CompileError[];
    };
    /**
     * Resolve the type of an expression, setting resolvedType on the AST node.
     * Public so codegen can call it for standalone expressions.
     */
    resolveExprType(expr: Expression, scope: Scope): IECType | undefined;
    /**
     * Resolve a struct/FB/program field's declared type name, consulting the local
     * compilation unit first and then the dependency libraries' symbol entries.
     *
     * The members of an FB whose type is defined in an imported `.stlib` (e.g.
     * `rmp : _RMP_NEXT` where `_RMP_NEXT` lives in oscat-basic) are not in the local
     * AST, so the AST-only `resolveFieldType` returns undefined for `rmp.DN`. That
     * left the member access untyped, which only surfaced as a hard error when an
     * overloaded bitwise std-function (e.g. `NOT`/`OR` from the IEC functions library)
     * propagated the missing type as the generic `ANY_BIT` into a condition. Falling
     * back to the FB symbol's registered inputs/outputs/inouts/locals fixes the root
     * cause: `rmp.DN` now resolves to its real `BOOL` type.
     */
    private resolveFieldTypeAnywhere;
    /**
     * Resolve a type *name* to its IECType: an elementary type, else a registered
     * type (struct/FB/enum from the local AST or a dependency library), else a
     * minimal elementary placeholder. Using the registered type (rather than always
     * wrapping the name in a placeholder elementary) keeps member/array-element
     * access consistent with how a variable's declared type resolves — otherwise
     * `event := prog[pos]` where both are a library struct would compare a real
     * StructType against a placeholder elementary and be wrongly rejected.
     */
    private resolveNamedType;
    /**
     * Infer the type of an expression.
     */
    inferType(expr: Expression, scope: Scope): IECType | undefined;
    /**
     * Infer type of a literal expression.
     */
    private inferLiteralType;
    /**
     * Infer type of a variable expression, including access chain resolution.
     */
    private inferVariableType;
    /**
     * Infer type of a binary expression.
     */
    private inferBinaryType;
    /**
     * Infer type of a unary expression.
     */
    private inferUnaryType;
    /**
     * Infer type of a function call expression.
     */
    private inferFunctionCallType;
    /**
     * Infer type of a method call expression (e.g., fb.method(args)).
     */
    private inferMethodCallType;
    /**
     * Walk variable declarations and validate every initialiser against the
     * declared type. Without this pass, nonsense like `WSTRING := 'foo'`
     * (STRING literal into a WSTRING variable) reaches codegen unchecked,
     * surfacing as a confusing C++ "no matching function for call to
     * IECWStringVar(const char[N])" instead of a proper IEC type error
     * pointing at the declaration.
     *
     * The check delegates to the same `validateAssignment` used for
     * assignment statements — no separate compatibility rules — so anything
     * the standard considers an implicit assignment also passes here.
     */
    private checkVarBlocks;
    /**
     * Walk statements, resolve all sub-expressions, and validate type rules.
     */
    private checkStatements;
    private checkStatement;
    private validateAssignment;
    /**
     * Check if an expression is an untyped numeric literal (no explicit type prefix).
     * These are polymorphic and can be assigned to any compatible numeric type.
     */
    private isUntypedNumericLiteral;
    /**
     * Check if a type name refers to a known function block or struct type.
     */
    private isKnownCompositeType;
    private validateCondition;
    private validateCaseSelector;
    private validateFunctionCallArgs;
    /**
     * Check if a type can be implicitly widened to match a constraint.
     * E.g., INT can match ANY_REAL because INT→REAL is a valid widening.
     */
    private canWidenToConstraint;
    /**
     * Check if a type belongs to a category.
     * Delegates to type-utils.
     */
    isTypeInCategory(type: IECType, category: import("./type-utils.js").TypeCategory): boolean;
    /**
     * Check if two types are compatible for assignment.
     * Delegates to type-utils isAssignable.
     */
    areTypesCompatible(target: IECType, source: IECType): boolean;
    /**
     * Add an error message.
     */
    private addError;
    /**
     * Add a warning message.
     */
    protected addWarning(message: string, line: number, column: number, file?: string): void;
}
//# sourceMappingURL=type-checker.d.ts.map