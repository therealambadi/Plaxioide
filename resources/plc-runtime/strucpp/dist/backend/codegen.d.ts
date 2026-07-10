/**
 * STruC++ Code Generator
 *
 * Generates C++ code from the typed AST or IR.
 * Produces readable, debuggable C++ that maintains line correspondence with ST source.
 */
import type { CompilationUnit, Statement, Expression, FunctionCallExpression } from "../frontend/ast.js";
import type { SymbolTables } from "../semantic/symbol-table.js";
import type { LineMapEntry } from "../types.js";
import type { ProjectModel } from "../project-model.js";
import type { StlibArchive } from "../library/library-manifest.js";
import { type EnumMemberEntry } from "../semantic/type-utils.js";
/**
 * Options for code generation.
 */
export interface CodeGenOptions {
    /** Include #line directives for debugging */
    lineDirectives: boolean;
    /** Include ST source as comments */
    sourceComments: boolean;
    /** Indentation string (default: 4 spaces) */
    indent: string;
    /** Line ending (default: \n) */
    lineEnding: string;
    /** Header filename to use in #include directive (default: "generated.hpp") */
    headerFileName: string;
    /** Additional library headers to include in the generated header */
    libraryHeaders: string[];
    /** Extra `#include "..."` lines to emit at the top of every per-POU
     *  translation unit (after the shared header include). Used by the
     *  editor to plumb in `c_blocks.h` so POU bodies that reference
     *  user-defined C/C++ block structs and extern functions resolve. */
    pouIncludes: string[];
    /** Whether this is a test build (adds mock infrastructure to FB classes) */
    isTestBuild: boolean;
    /** Global constants injected as constexpr into the header preamble (before namespace) */
    globalConstants: Record<string, number>;
    /** ST source filename for #line directives (default: "main.st") */
    fileName: string;
    /** Override filename used in #line directives (absolute path for debugger).
     *  Falls back to fileName when not set. */
    lineDirectiveFileName?: string;
    /** Emit `//@chunk:begin/end:<kind>:<NAME>` comment markers around each
     *  top-level declaration in both header and cpp output. The library
     *  compiler uses these to slice emitted code into per-symbol chunks
     *  for function-level tree-shaking. Off by default — production
     *  compiles produce identical output regardless. */
    emitChunkMarkers?: boolean;
}
/**
 * Default code generation options.
 */
export declare const defaultCodeGenOptions: CodeGenOptions;
/**
 * Result of code generation.
 */
export interface CodeGenResult {
    /**
     * One emit bucket per output file. Always contains
     * `configuration.cpp` (library preambles, located-var defs,
     * configuration glue) plus one `pou_<NAME>.cpp` per program/FB/
     * function. The single-string `cppCode` is the legacy concatenated
     * view — derived from this map by the public `compile()` wrapper.
     */
    cppFiles: Array<{
        name: string;
        content: string;
    }>;
    /** Generated C++ implementation code (concatenation of cppFiles). */
    cppCode: string;
    /** Generated C++ header code */
    headerCode: string;
    /** Line mapping from ST to C++ implementation lines */
    lineMap: Map<number, LineMapEntry>;
    /** Line mapping from ST to C++ header lines */
    headerLineMap: Map<number, LineMapEntry>;
    /** Warnings emitted during code generation */
    warnings: Array<{
        message: string;
        line?: number;
        column?: number;
        file?: string;
    }>;
}
/**
 * C++ code generator for IEC 61131-3 programs.
 */
export declare class CodeGenerator {
    private readonly _symbolTables?;
    private options;
    /**
     * One emit bucket per output .cpp file. The codegen splits POU
     * implementations across files so the runtime build can run
     * `make -j$(nproc)` and ccache can keep .o files for unchanged
     * POUs across rebuilds. `output` always points at the bucket for
     * the currently-active file; `setOutputFile` swaps it. The
     * bucket map preserves insertion order, which determines emit
     * order for the legacy `cppCode` concatenation.
     */
    private outputFiles;
    protected output: string[];
    private currentLine;
    private headerOutput;
    private lineMap;
    private headerLineMap;
    private currentHeaderLine;
    private projectModel?;
    /** Track located variables for descriptor array generation */
    private locatedVars;
    /** Track retain variables per program for table generation */
    private programRetainVars;
    /** Store AST for looking up program bodies when using project model */
    protected ast?: CompilationUnit;
    /** Current function name (for redirecting function name := to result variable) */
    private currentFunctionName;
    /** Standard function registry for name mapping and conversion resolution */
    private stdRegistry;
    /** Warnings collected during code generation */
    private codegenWarnings;
    /** Counter for generating unique temporary variable names */
    private tempVarCounter;
    /**
     * Stack of loop exit labels for EXIT codegen. C++ `break` only escapes the
     * innermost switch/loop, so `EXIT` inside a `CASE` nested in a loop must
     * goto past the loop instead. Each loop pushes a fresh label; an inner
     * `EXIT` records `used=true` so the closing emitter only writes the label
     * when something jumps to it.
     */
    private loopExitLabelStack;
    private loopExitLabelCounter;
    /** Current statement indent level (set by generateStatement before expression generation) */
    private currentStatementIndent;
    /** Set of known function block type names (upper case) for FB instance detection */
    protected knownFBTypes: Set<string>;
    /** Set of known interface type names (upper case) */
    protected knownInterfaceTypes: Set<string>;
    /** Set of known struct/UDT type names (upper case) */
    protected knownStructTypes: Set<string>;
    /** Map of enum type name (upper case) → set of member names (upper case) for :: emission */
    protected enumTypeMembers: Map<string, Set<string>>;
    /** Reverse map: enum member name (upper case) → owning enum type (for bare enum qualification) */
    protected enumMemberToType: Map<string, EnumMemberEntry>;
    /** Library FB field type map: "FBNAME.FIELDNAME" → type name (for field mangling in test codegen) */
    private libraryFBFieldTypes;
    /** Extended type metadata for library FB fields (array dims, reference kind) */
    private libraryFBFieldTypeRefs;
    /** Set of known program type names (upper case) for program invocation detection */
    protected knownProgramTypes: Set<string>;
    /** Map of variable name (upper case) → type name (original case) for current scope */
    protected currentScopeVarTypes: Map<string, string>;
    /** Map of variable name (upper case) → referenceKind ("ref_to" | "reference_to"
     *  | "pointer_to") for current scope. Only reference/pointer vars are present;
     *  used e.g. to pick the correct lowering for a REF= rebind. */
    protected currentScopeVarRefKinds: Map<string, string>;
    /** Parent class name of current FB (for SUPER resolution) */
    private currentFBExtends;
    /** When generating a method that returns an interface type, assignments to the
     *  result variable should be converted to return statements */
    private interfaceReturnMethod;
    /** Map of UPPER(typeName).UPPER(methodName) → declared method name for case normalization */
    protected methodNameMap: Map<string, string>;
    /** Map of UPPER(interfaceName) → Set of UPPER(methodName) for variable/method collision detection */
    protected interfaceMethodsByInterface: Map<string, Set<string>>;
    /** Map of UPPER(typeName).UPPER(propName) → declared property name for property access codegen */
    protected propertyNameMap: Map<string, string>;
    /** Current FB name (set during generateFBImplementation for property resolution) */
    private currentFBName;
    /** Mapping of VAR_INST names (upper case) to mangled class member names */
    private varInstMangledNames;
    /** Mapping of member names (upper case) that collide with their type name
     *  or interface method names to mangled names (e.g., SENSOR → SENSOR_) */
    private memberMangledNames;
    /** Interface method names for the current FB (UPPER case), used for variable/method collision detection */
    private currentFBInterfaceMethods;
    /** Map of UPPER(fbName) → Set of UPPER(interfaceMethodName) for external field access mangling */
    protected fbInterfaceMethodNames: Map<string, Set<string>>;
    /** Current FB's var blocks, kept so method scopes can see FB member types */
    private currentFBVarBlocks;
    /** Topologically sorted function blocks (computed once in generate(), used by header + impl) */
    private sortedFBs;
    /** Per-archive reachable-chunk emission state.
     *
     *  Built by `addLibraryChunks` — one entry per library the consumer
     *  pulled at least one chunk from. The emission loop iterates this
     *  in insertion order (= the order index.ts hands archives over,
     *  which is library load order). For each library, only chunks
     *  whose name appears in `reachable` are emitted; the array order
     *  matches the library's `chunks[]` declaration order so symbol
     *  layout in the user's `generated.hpp` is stable across builds. */
    private libraryEmissions;
    /** Map of UPPER(fbTypeName) → ordered VAR_INPUT parameter names (UPPER case).
     *  Used to resolve positional arguments in FB invocations. */
    private fbInputParams;
    constructor(_symbolTables?: SymbolTables | undefined, options?: Partial<CodeGenOptions>);
    /** TypeCodeGenerator instance for type mapping */
    private typeCodeGen;
    /** Get symbol tables (for future use in Phase 3+) */
    get symbolTables(): SymbolTables;
    /**
     * Map a variable type name to its C++ type string.
     * Handles VLA synthetic names (__VLA_1D_INT → ArrayView1D<INT_t>)
     * and regular types (INT → IEC_INT).
     */
    protected mapVarTypeToCpp(typeName: string, maxLength?: number | string): string;
    /**
     * Map a TypeReference to its C++ type string, including parameterized length
     * and pointer/reference qualifiers.
     */
    /**
     * Build a TypeReference shape suitable for emitting a parameter type.
     *
     * Preserves array/pointer metadata (so inline ARRAY parameters become
     * `Array1D<T, L, U>&` and pointer params become `IEC_Ptr<T>&`) but
     * strips STRING/WSTRING maxLength so any size string binds to the
     * &-reference — matching the previous behavior of the call sites that
     * went through `mapVarTypeToCpp(decl.type.name)` without maxLength.
     */
    protected toParamTypeRef<T extends {
        name: string;
        maxLength?: number | string;
        referenceKind?: string;
        arrayDimensions?: Array<{
            start: number;
            end: number;
        }>;
        elementTypeName?: string;
    }>(typeRef: T): {
        name: string;
        maxLength?: number | string;
        referenceKind?: string;
        arrayDimensions?: Array<{
            start: number;
            end: number;
        }>;
        elementTypeName?: string;
    };
    /**
     * Convert a project-model record (ProjectVarDeclaration /
     * VarExternalDeclaration) into a TypeReference shape suitable for
     * `mapTypeRefToCpp` / `toParamTypeRef`. Project-model records keep the
     * type name in `.typeName` and reserve `.name` for the variable name;
     * this helper rewires the fields so the shape matches what the
     * type-resolution helpers expect.
     */
    private projectVarToTypeRef;
    protected mapTypeRefToCpp(typeRef: {
        name: string;
        maxLength?: number | string;
        referenceKind?: string;
        arrayDimensions?: Array<{
            start: number;
            end: number;
        }>;
        elementTypeName?: string;
    }): string;
    /**
     * Set the project model for enhanced code generation.
     */
    setProjectModel(model: ProjectModel): void;
    /**
     * Register FB type names from libraries so codegen can distinguish
     * FB invocations from regular function calls. Private — use registerLibraryArchives().
     */
    private registerLibraryFBTypes;
    /**
     * Register type info from library manifests (enum types for :: emission,
     * struct types for known-type detection). Private — use registerLibraryArchives().
     */
    private registerLibraryTypes;
    /**
     * Register all type and FB metadata from library archives.
     * Single entry point used by both compile() and generateTestMain().
     */
    registerLibraryArchives(archives: StlibArchive[]): void;
    /**
     * Hand the codegen a library archive and the set of chunk names
     * the consumer determined to be reachable from the user's AST.
     * Only those chunks are emitted into the final header/cpp.
     *
     * Single per-call entry point: nothing else mutates
     * `libraryEmissions`. The caller (index.ts) computes the reachable
     * set via function-level tree-shake before invoking this method.
     */
    addLibraryChunks(archive: StlibArchive, reachable: Set<string>): void;
    /**
     * Emit a chunk-boundary marker in the active header stream. No-op
     * when `emitChunkMarkers` is off. See `CodeGenOptions.emitChunkMarkers`
     * — the markers exist so the library compiler can slice emitted code
     * into per-symbol chunks for function-level tree-shaking.
     */
    protected emitHeaderChunkMarker(boundary: "begin" | "end", kind: "function" | "functionBlock" | "type" | "inlineGlobal", name: string): void;
    /** Emit a chunk-boundary marker in the active cpp stream. */
    protected emitCppChunkMarker(boundary: "begin" | "end", kind: "function" | "functionBlock" | "type" | "inlineGlobal", name: string): void;
    /**
     * Switch the active emit bucket. Creates a new bucket if the file
     * name hasn't been seen before; otherwise resumes appending to the
     * existing one. Caller is responsible for emitting the per-TU
     * preamble (license, #include, namespace open) on the first switch
     * to a file via `startTranslationUnit`.
     *
     * `currentLine` keeps its global value across switches — lineMap
     * entries reference positions in the legacy concatenated `cppCode`,
     * which is what the REPL line-mapping display and gdb debug info
     * (via #line directives) consume. Splitting only affects which
     * physical .cpp file a line lands in; the logical numbering for
     * the source-map is end-to-end across all files.
     */
    private setOutputFile;
    /**
     * Begin a new translation unit. Emits the standard preamble (banner,
     * #include for the shared header, opening namespace) into the file's
     * bucket. Pair with `endTranslationUnit` after emitting POU bodies.
     */
    private startTranslationUnit;
    /**
     * Close the namespace on the currently-active translation unit.
     * Mirrors `startTranslationUnit`.
     */
    private endTranslationUnit;
    /**
     * Build a deterministic .cpp file name for a POU. Names already
     * conform to C identifier rules (the parser enforces it), so we
     * just lowercase + prefix; per-POU uniqueness is the caller's
     * concern (multiple POUs with the same name would already be a
     * semantic error caught earlier).
     */
    private pouFileName;
    /**
     * Generate C++ code from a compilation unit.
     */
    generate(ast: CompilationUnit): CodeGenResult;
    /**
     * Generate the C++ header file.
     */
    private generateHeader;
    /**
     * Generate the C++ implementation files.
     *
     * Splits across multiple translation units so the runtime build can
     * run `make -j$(nproc)` and ccache can keep .o files for unchanged
     * POUs across rebuilds:
     *
     *   configuration.cpp     library preambles, located-vars definition,
     *                         configuration glue (must be exactly one TU
     *                         to avoid duplicate symbol errors at link).
     *   pou_<NAME>.cpp        one TU per program / FB / function.
     *
     * All files share `generated.hpp`, so editing a POU's *body* leaves
     * other TUs' preprocessed source unchanged → ccache reuses them.
     * Editing a declaration invalidates the header and forces a full
     * rebuild — same as any C++ project.
     */
    private generateImplementation;
    /**
     * Generate header declaration for a function block.
     */
    private generateFBHeaderDeclaration;
    /**
     * Generate header declaration for a program.
     */
    private generateProgramHeaderDeclaration;
    /**
     * Generate header declaration for a function.
     */
    private generateFunctionHeaderDeclaration;
    /**
     * Generate function parameter list including VAR_INPUT and VAR_IN_OUT.
     * VAR_IN_OUT parameters are passed by reference.
     * VLA types use ArrayView instead of IECVar reference.
     */
    protected generateFunctionParams(func: CompilationUnit["functions"][0]): string[];
    /**
     * Generate header declaration for an interface.
     * Interfaces become abstract classes with pure virtual methods.
     */
    private generateInterfaceHeaderDeclaration;
    /**
     * Collect VAR_INST members from all methods of a function block.
     * These become name-mangled class members: __MethodName__varName
     */
    private collectVarInstMembers;
    /**
     * Generate method declarations in the class header, grouped by visibility.
     */
    private generateMethodDeclarations;
    /**
     * Generate parameter list string for a method declaration.
     * VAR_INPUT, VAR_OUTPUT (by ref), VAR_IN_OUT (by ref) become C++ params.
     */
    private generateMethodParamList;
    /**
     * Generate property getter/setter declarations in the class header.
     */
    private generatePropertyDeclarations;
    /**
     * Generate implementation for a method (in the .cpp file).
     * Follows the same return-variable pattern as functions.
     */
    private generateMethodImplementation;
    /**
     * Generate implementation for a property (getter and/or setter in the .cpp file).
     */
    private generatePropertyImplementation;
    /**
     * Generate implementation for a program.
     */
    private generateProgramImplementation;
    /**
     * Generate implementation for a function block.
     */
    private generateFBImplementation;
    /**
     * Generate implementation for a function.
     */
    private generateFunctionImplementation;
    /**
     * Generate function parameter name list (just names, no types).
     */
    private generateFunctionParamNames;
    /**
     * Generate header declaration for a program from the project model.
     * Handles VAR_EXTERNAL as reference members.
     */
    private generateProgramHeaderFromModel;
    /**
     * Generate implementation for a program from the project model.
     */
    private generateProgramImplementationFromModel;
    /**
     * Generate retain variable table for a class.
     */
    private generateRetainTable;
    /**
     * Generate header declaration for a configuration from the project model.
     */
    private generateConfigurationHeaderFromModel;
    /**
     * Generate implementation for a configuration from the project model.
     */
    private generateConfigurationImplementationFromModel;
    /**
     * Generate header declaration for a configuration from AST (fallback).
     */
    private generateConfigurationHeaderDeclaration;
    /**
     * Generate implementation for a configuration from AST (fallback).
     */
    private generateConfigurationImplementation;
    /**
     * Generate code for a statement.
     */
    protected generateStatement(stmt: Statement, indent?: string): void;
    /**
     * Generate code for an assignment statement.
     * ST: target := value;  →  C++: target = value;
     */
    private generateAssignmentStatement;
    /**
     * Generate code for a REF= rebind. The lowering depends on the target's
     * reference kind, because the two runtime wrappers expose different APIs:
     *
     *   REFERENCE TO (IEC_REFERENCE_TO)  →  target.bind(source);
     *   REF_TO       (IEC_REF_TO)        →  target = REF(source);
     *
     * IEC_REF_TO has no bind() — it rebinds via assignment from REF()/ADR() —
     * so emitting bind() unconditionally (the old behaviour) failed to compile
     * for REF_TO targets.
     */
    private generateRefAssignStatement;
    /**
     * Generate code for an external code pragma.
     * The code content is emitted AS-IS to the output.
     */
    private generateExternalCodePragma;
    /**
     * Generate code for an IF statement.
     * ST: IF/ELSIF/ELSE → C++: if/else if/else
     */
    private generateIfStatement;
    /**
     * Generate code for a CASE statement.
     * ST: CASE/OF → C++: switch/case with range expansion
     */
    private generateCaseStatement;
    /**
     * Generate code for a FOR statement.
     * ST: FOR i := start TO end BY step DO → C++: for (i = start; i <= end; i += step)
     */
    private generateForStatement;
    /**
     * Generate code for a WHILE statement.
     * ST: WHILE condition DO → C++: while (condition)
     */
    private generateWhileStatement;
    /**
     * Generate code for a REPEAT statement.
     * ST: REPEAT ... UNTIL condition → C++: do { ... } while (!(condition))
     */
    private generateRepeatStatement;
    /**
     * Generate code for a RETURN statement.
     * In functions: return functionName_result;
     * In programs/FBs: return;
     */
    private generateReturnStatement;
    /**
     * Evaluate an expression as a literal integer value (for CASE ranges and FOR step direction).
     * Returns undefined if the expression is not a compile-time integer constant.
     */
    private evaluateLiteralInt;
    /**
     * Generate code for a list of statements.
     */
    private generateStatements;
    /**
     * Generate C++ code for an expression.
     * Returns the C++ expression as a string.
     */
    protected generateExpression(expr: Expression): string;
    /**
     * Generate C++ for a literal expression.
     */
    private generateLiteralExpression;
    /**
     * Translate IEC 61131-3 $-escape sequences to C++ escape sequences.
     * Handles: $N/$n (newline), $L/$l (line feed), $R/$r (CR), $T/$t (tab),
     * $P/$p (form feed), $$ (literal $), $' (single quote), $XX (hex byte),
     * '' (doubled single quote), and C++ escaping for backslash and double-quote.
     */
    private formatIntegerLiteral;
    private translateIECString;
    /**
     * Generate C++ for a variable expression.
     */
    private generateVariableExpression;
    /**
     * Generate C++ code from an ordered access chain.
     * Handles correct interleaving of field accesses, subscripts, and dereferences.
     *
     * Key rules:
     * - field after subscript: use -> (because Array operator[] returns IECVar<T>&)
     * - field after field: use .
     * - field after dereference: use .
     * - subscript of 1 index: use [idx]
     * - subscript of 2+ indices: use (idx1, idx2) (multidim Array)
     * - dereference: wrap in (*...)
     */
    private generateAccessChain;
    /**
     * Operator mapping from ST to C++.
     */
    private static readonly BINARY_OP_MAP;
    /**
     * Generate C++ for a binary expression.
     */
    private generateBinaryExpression;
    /**
     * Generate C++ for a unary expression.
     */
    private generateUnaryExpression;
    /**
     * Generate C++ for a method call expression (chained method calls).
     * e.g., fb.method1(args).method2(args) → fb.method1(args).method2(args)
     */
    private generateMethodCallExpression;
    /**
     * Returns true when `source` can be implicitly widened to `target`.
     * Covers same-category widening (BYTE→DWORD), BIT→INT crossover (BYTE→INT),
     * and integer→REAL promotion.
     */
    private canImplicitWiden;
    /**
     * Lightweight type inference for an expression using the current scope's
     * variable type map. Returns the IEC type name (upper case) or undefined.
     */
    private inferExprType;
    /**
     * Extract ordered parameter types from a user-defined function declaration.
     * Returns undefined if function not found.
     */
    private getParamTypes;
    /**
     * Apply implicit widening casts to a list of argument strings for a
     * user-defined function call. Modifies `args` in place.
     */
    private coerceUserFuncArgs;
    /** Returns true if expr is a bare literal (no typePrefix), possibly negated */
    private isBareLiteral;
    /**
     * Wrap a temporal-typed argument with the right `*_TO_MS` helper
     * before it's handed to a numeric / bit-string `TO_*` conversion.
     *
     * Why this lives in codegen and not in the runtime:
     *  - `IEC_TIME`, `IEC_LTIME`, `IEC_TOD`, `IEC_LTOD`, `IEC_DT`,
     *    `IEC_LDT`, `IEC_DATE`, `IEC_LDATE` are all
     *    `using ... = IECVar<int64_t>` aliases in `iec_var.hpp` — they
     *    collapse to the same C++ type after preprocessing.
     *  - A runtime overload `TO_UINT(IEC_TIME)` therefore CANNOT be
     *    distinguished from `TO_UINT(IEC_DATE)` by the C++ compiler;
     *    both bind to the same generic template and the raw `int64_t`
     *    underlying value gets `static_cast`ed straight to the target
     *    integer (low 16 / 32 bits of a nanosecond count for TIME).
     *  - The IEC type label only survives at the language layer.  So
     *    the scaling has to happen at the call site, before the type
     *    identity is erased.
     *
     * Scaling chosen (matches `TO_TIME(integer)`'s established
     * "integer means milliseconds" convention from OSCAT/CODESYS):
     *  - TIME / LTIME → `TIME_TO_MS`           (ns since 0   → ms)
     *  - TOD / TIME_OF_DAY / LTOD / LTIME_OF_DAY → `TOD_TO_MS`
     *    (ns since midnight  → ms since midnight, [0, 86_400_000))
     *  - DT / DATE_AND_TIME / LDT / LDATE_AND_TIME → `DT_TO_MS`
     *    (ns since epoch  → ms since epoch)
     *  - DATE / LDATE: NOT scaled — DATE is already stored as whole
     *    days, and "days since 1970-01-01" is the natural integer
     *    answer for `DATE_TO_INT` / etc.  Callers wanting a different
     *    unit can compose with `DATE_TO_DAYS` (today, the identity).
     *
     * No wrap on temporal-target conversions (`TO_TIME(TIME)`,
     * `INT_TO_TIME(ms)`, etc.) — those are either pass-through (same
     * family) or handled by the existing `TO_TIME(integer)` runtime
     * template which scales ms→ns going the other way.  No wrap on
     * non-temporal sources either (the generic numeric path already
     * does the right thing).
     */
    private wrapTemporalArgForNumericConversion;
    /**
     * For std-lib template functions (like LIMIT, MAX, MIN) where all params
     * share the same generic constraint, harmonize argument types so C++ template
     * deduction succeeds. Casts literals to the dominant variable type, or widens
     * all args to the widest type if variables differ.
     */
    private harmonizeStdFuncArgs;
    /**
     * Generate C++ for a function call expression.
     * Handles: dotted method calls (THIS.method, SUPER.method, instance.method),
     * standard functions, *_TO_* conversions, DELETE->DELETE_STR mapping,
     * named argument reordering, and user-defined function calls.
     */
    protected generateFunctionCallExpression(expr: FunctionCallExpression): string;
    /**
     * Reorder named arguments to match function declaration parameter order.
     * Positional args are placed first (in declaration order, skipping named slots),
     * then named args fill their declared slots. Unfilled parameters get default values.
     * Returns null if function not found in AST.
     */
    private reorderNamedArguments;
    /**
     * Emit a temporary variable declaration for an omitted VAR_OUTPUT/VAR_IN_OUT argument.
     * The temp is emitted before the current statement line (since generateExpression()
     * runs before the statement's emit() call). Returns the temp variable name.
     */
    private emitOutputTempVar;
    /**
     * Check if a type name refers to a known function block type.
     */
    private isFBType;
    /**
     * When `typeName` (a member's declared type) is also the name of a sibling
     * member in the same scope, return the C++ elaborated-type-specifier keyword
     * (`class `/`struct `) needed so the bare type name isn't resolved to the data
     * member. Returns "" when there's no shadowing or the type isn't a composite.
     */
    private elaboratedTagIfShadowed;
    /**
     * Check if a type name refers to a known interface type.
     */
    private isInterfaceType;
    /**
     * Resolve the declared case of a method name given the type and method name.
     * Returns the declared name if found, or the original name if not.
     */
    private resolveMethodName;
    /**
     * Resolve method name case by searching all known types.
     * Used when the object type is not easily determined (e.g., chained calls).
     */
    private resolveMethodNameGlobal;
    /**
     * Resolve a property name from the property name map.
     * Returns the declared property name if the field is a property, undefined otherwise.
     */
    private resolvePropertyName;
    /**
     * Resolve the type of a member field on a given FB or struct type.
     * Used for chained access like ctrl.motor.Speed where we need to know
     * motor's type to check if Speed is a property.
     */
    protected resolveMemberType(typeName: string | undefined, memberName: string): string | undefined;
    /**
     * Detect if an assignment target is a property write (e.g., m.Speed := 75).
     * Returns the object code prefix and property name if so, undefined otherwise.
     */
    private detectPropertyWrite;
    /**
     * Remove the last field step from an access chain (for bit access / property trim).
     * Returns undefined if the chain becomes empty.
     */
    private trimLastFieldFromAccessChain;
    /**
     * Check if a type name refers to any user-defined type (FB, interface, or struct/UDT).
     * These types should NOT get the IEC_ prefix.
     */
    protected isUserDefinedType(typeName: string): boolean;
    /**
     * Enter a new scope for code generation. Populates currentScopeVarTypes
     * from the variable blocks of a program or function block.
     */
    private enterScope;
    /**
     * Exit the current scope, clearing variable type tracking.
     */
    private exitScope;
    /**
     * Topologically sort function blocks so that FBs containing instances of
     * other FBs are emitted after their dependencies (Kahn's algorithm).
     */
    private topologicalSortFBs;
    /**
     * Check if a function call statement is actually an FB invocation.
     * Returns the FB type name if it is, undefined otherwise.
     */
    private getFBInvocationType;
    /**
     * Generate code for an FB invocation.
     * Pattern: assign inputs → call operator() → capture outputs
     */
    /**
     * Extract implicit EN/ENO arguments from a function/FB call.
     * Returns the EN condition expression, ENO target variable, and the
     * remaining arguments with EN/ENO stripped out.
     */
    private extractEnEno;
    /**
     * Check if a function call argument list contains EN or ENO implicit parameters.
     */
    private hasEnEno;
    /**
     * Emit an EN/ENO wrapper around a body-emitting callback.
     *
     * Two ENO sinks are reflected uniformly:
     *   - `enoVar`              — the caller's `ENO => var` binding, if any.
     *   - `instanceEnoTarget`   — the FB instance's implicit ENO member
     *                             (e.g. `inst.ENO`), passed for FB calls so
     *                             `IF inst.ENO THEN ...` reads the right
     *                             value.  null for plain function calls.
     *
     * Both sinks are written every time so they can't carry stale values
     * across calls.  Per IEC 61131-3 §6.4.1.3, ENO defaults to TRUE when
     * EN is omitted — so an unguarded call writes TRUE to every sink it
     * has, which also overwrites any FALSE left behind by a prior gated
     * invocation.
     */
    private emitEnEnoWrapper;
    private generateFBInvocation;
    /**
     * Collect all interface method names (UPPER case) for a FB's IMPLEMENTS list.
     */
    protected getInterfaceMethodNames(fb: {
        implements?: string[];
    }): Set<string>;
    /**
     * If a member variable name collides with its C++ type name or an interface
     * method name (case-insensitive), append '_' to avoid C++ errors.
     * Populates memberMangledNames map and returns the (possibly mangled) name.
     */
    private mangleMemberIfNeeded;
    /**
     * Check if a field access needs mangling — true when the field name collides
     * with its type name (GCC -Wchanges-meaning) or with an interface method name.
     */
    private needsFieldMangling;
    /**
     * Resolve the base name for a variable. Subclasses can override to add
     * prefixes (e.g., "s." for SETUP variables in test codegen).
     */
    protected resolveVariableBaseName(name: string): string;
    /**
     * Emit the call line for a POU (FB or program) invocation.
     * Subclasses can override to change the call pattern (e.g., ".run()" for programs).
     */
    protected emitPOUCallLine(instanceName: string, _rawName: string, indent: string): void;
    /**
     * Get the default value for a type.
     */
    private getDefaultValue;
    /**
     * Lower an IEC numeric literal initializer string to a C++ literal.
     *
     * Handles based literals (16#FF, 8#17, 2#1010), decimals/reals with
     * IEC underscore separators (1_000, 16#FF_FF), an optional leading
     * sign (-5, +3), and an optional IEC type prefix (INT#5, BYTE#16#AB,
     * REAL#1.5). Reuses {@link iecBaseToCppLiteral}, the same helper the
     * expression path uses, so declaration initialisers and statement
     * bodies lower identically.
     *
     * Returns `null` when `raw` is not a recognised numeric literal, so
     * non-numeric initialisers (enum names, named constants) pass through
     * unchanged at the call site.
     */
    private lowerNumericInitializer;
    /**
     * Collect all program instances from a configuration.
     */
    private collectProgramInstances;
    /**
     * Count total tasks in a configuration.
     */
    private countTasks;
    /**
     * Collect a located variable for descriptor array generation.
     */
    private collectLocatedVar;
    /**
     * Collect a located variable from project model for descriptor array generation.
     */
    private collectLocatedVarFromModel;
    /**
     * Generate the located variables descriptor array in the header.
     */
    private generateLocatedVarsDeclaration;
    /**
     * Generate the located variables array definition in the implementation.
     */
    private generateLocatedVarsDefinition;
    /**
     * This program's contiguous slice [offset, offset+count) of the project-wide
     * locatedVars[] table. The table is built in program-iteration order, so a
     * single program's located vars are contiguous. Used by the STRUCPP_THREADED
     * located_range() override so the runtime can scope located I/O copy-in/out
     * to the owning task.
     */
    private locatedRangeForProgram;
    /**
     * Generate initialization code for located variable pointers.
     * Called from within a program constructor.
     */
    private generateLocatedVarPointerInit;
    /**
     * Emit a line to the implementation output.
     */
    protected emit(line: string): void;
    /**
     * Emit a line to the header output.
     */
    private emitHeader;
    /**
     * Emit a #line directive before implementation code for source-level debugging.
     */
    private emitLineDirective;
    /**
     * Emit a #line directive before header code for source-level debugging.
     */
    private emitHeaderLineDirective;
    /**
     * Record a line mapping from ST to C++.
     * Used in Phase 3+ for debugging support.
     */
    private recordLineMapping;
    private recordHeaderLineMapping;
}
/**
 * Generate C++ code from a compilation unit.
 * Convenience function that creates a generator and runs code generation.
 */
export declare function generateCode(ast: CompilationUnit, symbolTables: SymbolTables, options?: Partial<CodeGenOptions>): CodeGenResult;
//# sourceMappingURL=codegen.d.ts.map