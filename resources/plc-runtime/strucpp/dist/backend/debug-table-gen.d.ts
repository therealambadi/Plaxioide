/**
 * STruC++ Debug Table Generator
 *
 * Emits two artifacts alongside the normal compile() output:
 *
 *   1. `debugTableCpp` — contents for generated_debug.cpp, the per-project
 *      pointer tables consumed by strucpp::debug::handle_*() in the runtime
 *      header debug_dispatch.hpp.
 *
 *   2. `debugMap` — a JSON-serializable manifest the editor uses to translate
 *      variable paths (e.g. "INSTANCE0.speeds[5]") into the (arrayIdx,
 *      elemIdx) address pairs the target expects.
 *
 * Every leaf variable — including array elements, struct fields, and FB
 * input/output/inout members — gets its own entry. Leaves are packed into
 * arrays capped at 8,000 entries to stay below AVR GCC's 32,767-byte
 * single-object limit. A new array is also started at each program-instance
 * boundary so per-program edits don't cascade down the table.
 */
import type { CompilationUnit } from "../frontend/ast.js";
import type { ProjectModel } from "../project-model.js";
import type { SymbolTables } from "../semantic/symbol-table.js";
export declare const TAG: {
    readonly BOOL: 0;
    readonly SINT: 1;
    readonly USINT: 2;
    readonly INT: 3;
    readonly UINT: 4;
    readonly DINT: 5;
    readonly UDINT: 6;
    readonly LINT: 7;
    readonly ULINT: 8;
    readonly REAL: 9;
    readonly LREAL: 10;
    readonly BYTE: 11;
    readonly WORD: 12;
    readonly DWORD: 13;
    readonly LWORD: 14;
    readonly TIME: 15;
    readonly DATE: 16;
    readonly TOD: 17;
    readonly DT: 18;
    readonly STRING: 19;
    readonly WSTRING: 20;
};
export type TagName = keyof typeof TAG;
export interface DebugLeaf {
    arrayIdx: number;
    elemIdx: number;
    /** Path from instance root, e.g. "INSTANCE0.SPEEDS[5]" or
     *  "INSTANCE0.FB_INST.COUNTER". */
    path: string;
    /** IEC type tag name (e.g. "INT", "BOOL", "REAL"). */
    type: string;
    /** Byte size of the leaf (matches type_ops[].size in the runtime). */
    size: number;
}
export interface DebugMapV2 {
    version: 2;
    md5: string;
    typeTags: Record<string, number>;
    arrays: Array<{
        index: number;
        count: number;
    }>;
    leaves: DebugLeaf[];
}
export interface DebugTableResult {
    /** Contents for generated_debug.cpp (ready to write to disk). */
    debugTableCpp: string;
    /** Structured manifest for the editor (ready to JSON.stringify). */
    debugMap: DebugMapV2;
    /** Any leaves that couldn't be classified (unsupported type construct,
     *  user-defined enum, reference, etc.). Useful for warnings. */
    skipped: Array<{
        path: string;
        reason: string;
    }>;
}
export interface DebugTableGenOptions {
    /** Max entries per debug array. Default 8000 — safe under AVR's 32767-byte
     *  per-object limit assuming sizeof(Entry) == 4. */
    maxEntriesPerArray?: number;
    /** Name of the global configuration instance the generated table references.
     *  The sketch / runtime must declare this with external linkage. */
    configGlobalName?: string;
    /** MD5 to embed in the debug map. Caller computes over (program.st,
     *  strucpp version, projectModel) so the editor can detect staleness. */
    md5?: string;
}
export declare function generateDebugTable(ast: CompilationUnit, projectModel: ProjectModel, symbolTables: SymbolTables, opts?: DebugTableGenOptions): DebugTableResult;
export declare function tagNameForTypeName(name: string): TagName | undefined;
export declare function sizeForTypeName(name: string): number;
/** For debugging / testing: reverse lookup tag → name. */
export declare function tagNameByValue(tag: number): TagName | undefined;
//# sourceMappingURL=debug-table-gen.d.ts.map