/**
 * Shared utility functions for C++ code generation.
 */
/**
 * Convert an IEC 61131-3 based numeric string to a C++ literal string.
 * Handles 16#FF → 0xFF, 8#77 → 077, 2#1010 → 0b1010, and plain decimals.
 * Strips IEC underscore separators.
 */
export declare function iecBaseToCppLiteral(raw: string): string;
/**
 * Format an array type string from element type and dimension bounds.
 *
 * - 1D → `Array1D<E, start, end>`
 * - 2D → `Array2D<E, s1, e1, s2, e2>`
 * - 3D → `Array3D<E, s1, e1, s2, e2, s3, e3>`
 * - 4+ → nested `Array1D<Array1D<..., s, e>, s, e>`
 */
export declare function formatArrayType(elemCpp: string, dimensions: Array<{
    start: number;
    end: number;
}>): string;
//# sourceMappingURL=codegen-utils.d.ts.map