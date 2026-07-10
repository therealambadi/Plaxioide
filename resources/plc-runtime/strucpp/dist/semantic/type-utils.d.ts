/**
 * STruC++ Shared Type Utilities
 *
 * Single source of truth for IEC 61131-3 type data, compatibility logic,
 * and member resolution. Pure functions and constant data — no classes, no state.
 *
 * Consolidates type information previously duplicated across:
 * - type-checker.ts (ELEMENTARY_TYPES, TYPE_CATEGORIES, areTypesCompatible)
 * - analyzer.ts (IEC_TYPE_BITS, resolveStructFieldType, resolveArrayElementType)
 * - codegen.ts (IEC_TYPE_BITS, IEC_TYPE_CAT, canImplicitWiden, resolveMemberType)
 */
import type { IECType, ElementaryType, CompilationUnit } from "../frontend/ast.js";
import type { TypeConstraint } from "./std-function-registry.js";
/**
 * Map an IEC type name to its canonical spelling, collapsing aliases
 * (`TIME_OF_DAY` → `TOD`, `DATE_AND_TIME` → `DT`). Returns the input
 * unchanged for non-elementary names. Pure passthrough for upper-cased
 * canonical names (saves the registry lookup).
 *
 * Used by assignability / implicit-conversion checks so callers don't
 * have to remember to normalise on every comparison.
 */
export declare function canonicalElementaryName(name: string): string;
/**
 * Built-in elementary types as `ElementaryType` AST nodes, indexed by
 * canonical name AND every alias the parser accepts.
 *
 * Source of truth is `IEC_BASE_TYPES` in `iec-types-data.ts` (also
 * shipped as `libs/iec-types.json`). This map is just an AST-shaped
 * projection: each entry borrows the `bits` field as `sizeBits`
 * (the IEC logical width — `1` for BOOL, `8` for SINT, …, `0` for
 * variable-width strings).
 *
 * Each alias gets its own row pointing at an ElementaryType whose
 * name matches the alias spelling — so callers that read back
 * `.name` get the same string they looked up with.
 */
export declare const ELEMENTARY_TYPES: Record<string, ElementaryType>;
/**
 * Type category for IEC 61131-3 generic types.
 */
export type TypeCategory = "ANY" | "ANY_DERIVED" | "ANY_ELEMENTARY" | "ANY_MAGNITUDE" | "ANY_NUM" | "ANY_REAL" | "ANY_INT" | "ANY_BIT" | "ANY_STRING" | "ANY_DATE";
/**
 * Map of type names to their categories.
 */
export declare const TYPE_CATEGORIES: Record<string, TypeCategory[]>;
/**
 * Get the bit width of an IEC elementary type by name.
 * Returns undefined for non-elementary or unknown types.
 */
export declare function getTypeBits(name: string): number | undefined;
/**
 * Get the bit width for bit access validation.
 * Returns undefined for types that don't support bit access (REAL, STRING, etc.).
 */
export declare function getBitAccessWidth(name: string): number | undefined;
/**
 * Get the primary widening category for an IEC type.
 * Returns "BIT", "SINT", "UINT", or "REAL" — or undefined for non-elementary types.
 */
export declare function getTypeCategory(name: string): string | undefined;
/**
 * Check if a type belongs to a given IEC type category.
 */
export declare function isTypeInCategory(type: IECType, category: TypeCategory): boolean;
/**
 * Whether a resolved type is one of the IEC generic type groups rather than a
 * concrete type. Overloaded standard functions are published with one of these
 * as their declared return type (e.g. NOT -> ANY_BIT); such a result must be
 * refined to a concrete type at the call site before it can be used.
 */
export declare function isGenericGroupType(type: IECType): boolean;
/**
 * Check if a type name matches a StdFunctionRegistry TypeConstraint.
 */
export declare function matchesConstraint(typeName: string, constraint: TypeConstraint): boolean;
/**
 * Check if a source type can be assigned to a target type.
 * Allows same type, widening conversions within numeric types,
 * and cross-category promotions (BIT→INT, INT→REAL).
 */
export declare function isAssignable(target: IECType, source: IECType): boolean;
/**
 * Check if a source type name can be implicitly converted to a target type name.
 * Covers CODESYS rules:
 * - Same-category widening (BYTE→DWORD, INT→DINT, REAL→LREAL)
 * - BIT→INT crossover (BYTE→INT, WORD→DINT)
 * - Integer/BIT→REAL promotion (INT→REAL, BYTE→REAL)
 */
export declare function isImplicitlyConvertible(source: string, target: string): boolean;
/**
 * Check if converting from source to target is a narrowing conversion.
 * A narrowing conversion loses precision or changes the value range.
 */
export declare function isNarrowingConversion(target: string, source: string): boolean;
/**
 * Get the common (wider) type for binary expressions.
 * Returns undefined if the types are incompatible for arithmetic.
 */
export declare function getCommonType(a: IECType, b: IECType): IECType | undefined;
/**
 * Resolve the type of a struct or FB field by looking up the type definition in the AST.
 */
export declare function resolveFieldType(typeName: string, fieldName: string, ast: CompilationUnit): string | undefined;
/**
 * Resolve the element type of an array type.
 * Handles __INLINE_ARRAY_* internal types and user-defined array TYPE definitions.
 */
export declare function resolveArrayElementType(typeName: string, ast: CompilationUnit): string | undefined;
/**
 * Get a display name for an IECType.
 */
export declare function typeName(type: IECType): string;
/**
 * Entry in the enum member reverse map.
 * `typeName` is the owning enum's original-case name, or `null` when the
 * member appears in more than one enum (ambiguous).
 * `conflictingTypes` lists all enum types that define this member (only
 * populated when ambiguous, for error messages).
 */
export interface EnumMemberEntry {
    typeName: string | null;
    conflictingTypes: string[];
}
/**
 * Build a reverse lookup map from enum member names to their owning enum type.
 * When a member name exists in multiple enum types the entry is marked
 * ambiguous (`typeName: null`) and `conflictingTypes` lists all owners.
 *
 * @param enumTypes Iterable of `{ name, members }` descriptors.
 *   `name` is the original-case enum type name; `members` are the
 *   original-case member names.
 * @returns Map keyed by uppercase member name.
 */
export declare function buildEnumMemberMap(enumTypes: Iterable<{
    name: string;
    members: string[];
}>): Map<string, EnumMemberEntry>;
/**
 * Render an IECType as a short human-readable string for diagnostic
 * messages. Names the offending type without leaking internal field
 * structure: "INT", "STRUCT 'MyType'", "ARRAY", "REF_TO INT", etc.
 *
 * Falls back to the typeKind tag if the variant carries no name.
 */
export declare function describeType(t: IECType): string;
//# sourceMappingURL=type-utils.d.ts.map