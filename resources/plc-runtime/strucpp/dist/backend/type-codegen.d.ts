/**
 * STruC++ Type Code Generator
 *
 * Generates C++ type definitions from user-defined types (TYPE...END_TYPE blocks).
 * Handles structs, enums, arrays, subranges, and type aliases.
 */
import type { TypeDeclaration } from "../frontend/ast.js";
import { TypeRegistry } from "../semantic/type-registry.js";
/**
 * Options for type code generation
 */
export interface TypeCodeGenOptions {
    indent: string;
    lineEnding: string;
    /** Wrap each generated type's emission with `//@chunk:begin/end:type:<NAME>`
     *  marker comments. Off by default; the library compiler enables it so
     *  it can slice per-symbol chunks for tree-shaking. See
     *  `CodeGenOptions.emitChunkMarkers`. */
    emitChunkMarkers: boolean;
}
/**
 * Default type code generation options
 */
export declare const defaultTypeCodeGenOptions: TypeCodeGenOptions;
/**
 * Map IEC elementary type names to their IECVar-wrapped C++ type names.
 * Used for struct fields and array elements that need per-element forcing.
 */
export declare const IEC_TO_CPP_VAR_TYPE: Record<string, string>;
/**
 * Type Code Generator for user-defined types
 */
export declare class TypeCodeGenerator {
    private options;
    private output;
    /** Track known enum type names (uppercase) so struct fields can use IEC_ wrapper */
    private knownEnumNames;
    /** Reverse map: enum member name (upper case) → owning enum type */
    private enumMemberToType;
    constructor(options?: Partial<TypeCodeGenOptions>);
    /**
     * Generate C++ type definitions from a type registry.
     * Types are generated in dependency order.
     */
    generateFromRegistry(registry: TypeRegistry): string;
    /**
     * Generate C++ type definitions from an array of type declarations.
     * Assumes types are already in dependency order.
     */
    generateTypes(types: TypeDeclaration[]): string;
    /**
     * Generate a single type declaration
     */
    private generateTypeDeclaration;
    /**
     * Generate IEC_ wrapper for a type alias
     */
    private generateIecWrapperForAlias;
    /**
     * Generate IEC_ wrapper for a subrange type
     */
    private generateIecWrapperForSubrange;
    /**
     * Generate a struct type definition
     *
     * ST:
     *   MyStruct : STRUCT
     *     x : INT;
     *     y : REAL;
     *   END_STRUCT;
     *
     * C++:
     *   struct MyStruct {
     *       INT_t x;
     *       REAL_t y;
     *   };
     */
    private generateStructType;
    /**
     * Generate an enum type definition
     *
     * Simple enum:
     *   TrafficLight : (RED, YELLOW, GREEN);
     * C++:
     *   enum class TrafficLight { RED, YELLOW, GREEN };
     *
     * Typed enum with explicit values:
     *   State : INT (IDLE := 0, RUNNING := 1, STOPPED := 2);
     * C++:
     *   enum class State : INT_t { IDLE = 0, RUNNING = 1, STOPPED = 2 };
     */
    private generateEnumType;
    /**
     * Generate an array type definition
     *
     * ST:
     *   IntArray : ARRAY[0..9] OF INT;
     *   Matrix : ARRAY[0..2, 0..2] OF REAL;
     *   OffsetArray : ARRAY[3..7] OF INT;
     *
     * C++:
     *   using IntArray = Array1D<INT_t, 0, 9>;
     *   using Matrix = Array2D<REAL_t, 0, 2, 0, 2>;
     *   using OffsetArray = Array1D<INT_t, 3, 7>;
     *
     * Uses Array1D/2D/3D templates which preserve index bounds for proper
     * IEC 61131-3 array semantics (arrays can have arbitrary start indices).
     */
    private generateArrayType;
    /**
     * Generate a subrange type definition
     *
     * ST:
     *   Percentage : INT(0..100);
     *
     * C++:
     *   using Percentage = INT_t;
     *
     * Note: Runtime bounds checking would be implemented separately.
     * For now, we just create a type alias.
     */
    private generateSubrangeType;
    /**
     * Generate a type alias
     *
     * ST:
     *   MyInt : INT;
     *
     * C++:
     *   using MyInt = INT_t;
     */
    private generateTypeAlias;
    /**
     * Map an IEC type name to its C++ equivalent (raw/unwrapped)
     */
    mapTypeToCpp(typeName: string): string;
    /**
     * Map a type name to its IECVar-wrapped C++ equivalent for struct fields
     * and array elements. Wraps elementary types with IECVar for per-field forcing.
     * Composites (structs, arrays, FBs) use bare names since their fields
     * already contain IECVar leaves.
     */
    mapStructFieldTypeToCpp(typeName: string, maxLength?: number | string): string;
    /**
     * Convert an AST expression to C++ code
     */
    private expressionToCpp;
    private literalToCpp;
    private variableToCpp;
    private binaryExprToCpp;
    private unaryExprToCpp;
    /**
     * Evaluate a constant expression to a number.
     * Used for array dimension calculations.
     */
    private evaluateConstantExpression;
    /**
     * Emit a line of output
     */
    private emit;
}
/**
 * Generate C++ type definitions from a type registry
 */
export declare function generateTypeCode(registry: TypeRegistry, options?: Partial<TypeCodeGenOptions>): string;
//# sourceMappingURL=type-codegen.d.ts.map