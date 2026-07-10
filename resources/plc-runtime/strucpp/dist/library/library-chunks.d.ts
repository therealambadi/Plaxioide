/**
 * Per-symbol chunk extraction from codegen output.
 *
 * The codegen emits chunk-boundary markers (`//@chunk:begin/end:<kind>:<NAME>`)
 * around each top-level declaration when `emitChunkMarkers` is enabled. This
 * module slices the emitted header / cpp text into per-symbol chunks and
 * extracts the cross-symbol dep graph from the AST, producing the
 * `LibraryChunk[]` array stored in a `.stlib` archive.
 *
 * The chunked representation is what enables function-level tree-shaking
 * in the consumer codegen: only chunks reachable from the user's AST get
 * emitted into the final `generated.hpp` / `generated.cpp`.
 */
import type { CompilationUnit } from "../frontend/ast.js";
import type { LibraryChunk, StlibArchive } from "./library-manifest.js";
type ChunkKind = LibraryChunk["kind"];
interface ChunkSlice {
    kind: ChunkKind;
    name: string;
    text: string;
    /** Position in the input stream — used for stable ordering when
     *  merging header and cpp slices that may not appear in the same
     *  sequence. */
    order: number;
}
/**
 * Slice codegen output into per-symbol chunks.
 *
 * Returns the parsed slices keyed by `<kind>:<NAME>` plus the
 * marker-stripped text. The stripped text equals the input verbatim
 * minus the marker lines, suitable for use as the legacy library-wide
 * `headerCode` / `cppCode` blob (kept on `StlibArchive` through the
 * migration; retired in Phase 4 when chunks become authoritative).
 */
export declare function extractChunkSlices(code: string, lineEnding: string): {
    slices: Map<string, ChunkSlice>;
    stripped: string;
};
/**
 * Build the full chunk list for a compiled library.
 *
 * Combines header-side and cpp-side chunk slices (an FB produces both;
 * a type produces only a header chunk; an inline global same) and
 * computes dep edges per chunk. The chunk ordering follows the
 * header-slice declaration order, with cpp-only chunks (none today,
 * defensive) tacked on after.
 */
export declare function buildChunks(headerCode: string, cppCode: string, lineEnding: string, ast: CompilationUnit, ownLibraryName: string, dependencies: StlibArchive[]): {
    chunks: LibraryChunk[];
    cleanHeader: string;
    cleanCpp: string;
};
export type { ChunkKind };
//# sourceMappingURL=library-chunks.d.ts.map