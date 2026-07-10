/**
 * STruC++ Standard Function Registry
 *
 * Maps IEC 61131-3 standard function names to their C++ runtime implementations.
 * Used for type checking (argument/return type validation) and codegen name mapping.
 */
/**
 * Type constraint for function parameters and return types.
 * Matches IEC 61131-3 generic type categories.
 */
export type TypeConstraint = "ANY" | "ANY_NUM" | "ANY_INT" | "ANY_REAL" | "ANY_BIT" | "ANY_ELEMENTARY" | "ANY_STRING" | "BOOL" | "specific";
/**
 * Descriptor for a standard function parameter.
 */
export interface StdFunctionParam {
    name: string;
    constraint: TypeConstraint;
    specificType?: string;
    isByRef: boolean;
}
/**
 * Descriptor for a standard function.
 */
export interface StdFunctionDescriptor {
    /** IEC function name (e.g., "ABS") */
    name: string;
    /** C++ function name (may differ, e.g., "DELETE" -> "DELETE_STR") */
    cppName: string;
    /** Return type constraint */
    returnConstraint: TypeConstraint;
    /** Whether return type matches the first parameter's type */
    returnMatchesFirstParam: boolean;
    /** Specific return type name (when returnConstraint is "specific") */
    specificReturnType?: string;
    /** Parameter descriptors */
    params: StdFunctionParam[];
    /** Whether the function accepts variadic arguments (2+) */
    isVariadic: boolean;
    /** Minimum argument count for variadic functions */
    minArgs?: number;
    /** Whether this is a type conversion function */
    isConversion: boolean;
    /** Function category */
    category: "numeric" | "trig" | "selection" | "comparison" | "bitwise" | "bitshift" | "conversion" | "arithmetic" | "string" | "time" | "system";
}
/**
 * Resolved conversion function info.
 */
export interface ConversionInfo {
    fromType: string;
    toType: string;
    cppName: string;
}
/**
 * Registry of IEC 61131-3 standard functions.
 * Maps function names (case-insensitive) to their descriptors.
 */
export declare class StdFunctionRegistry {
    private functions;
    constructor();
    /**
     * Look up a standard function by name (case-insensitive).
     */
    lookup(name: string): StdFunctionDescriptor | undefined;
    /**
     * Check whether a name is a standard function.
     */
    isStandardFunction(name: string): boolean;
    /**
     * Resolve a *_TO_* conversion function name.
     * Returns undefined if not a valid conversion pattern.
     */
    resolveConversion(name: string): ConversionInfo | undefined;
    /**
     * Get all registered functions.
     */
    getAll(): StdFunctionDescriptor[];
    private register;
    private registerAll;
    private registerNumericFunctions;
    private registerTrigFunctions;
    private registerArithmeticFunctions;
    private registerSelectionFunctions;
    private registerComparisonFunctions;
    private registerBitwiseFunctions;
    private registerBitshiftFunctions;
    private registerConversionFunctions;
    private registerStringFunctions;
    private registerTimeFunctions;
    private registerSystemFunctions;
}
//# sourceMappingURL=std-function-registry.d.ts.map