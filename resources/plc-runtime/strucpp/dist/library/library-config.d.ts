/**
 * Library configuration file (`library.json`).
 *
 * Each library on disk lives in `libs/sources/<lib-name>/` and ships a
 * `library.json` next to its `.st` source files. The JSON carries every
 * field of the .stlib manifest that ISN'T derivable from the ST sources:
 *
 *   - identity (name, version, namespace)
 *   - human-readable description
 *   - the `isBuiltin` flag
 *   - block-level documentation prose (one entry per FUNCTION_BLOCK)
 *   - function-level documentation prose (one entry per FUNCTION)
 *
 * The build flow is:
 *
 *   1. Read library.json from the library's source directory
 *      (loadLibraryConfig).
 *   2. Read all .st files alongside it.
 *   3. Call compileStlib(sources, options-from-config).
 *   4. Merge per-block / per-function documentation into the resulting
 *      manifest entries (applyLibraryConfigDocumentation), validating
 *      that every doc'd name actually appears in the compiled output.
 *
 * library.json is the single source of truth for library metadata.
 * Build scripts may still hardcode defaults for libraries that haven't
 * been migrated yet — loadLibraryConfig returns null when the file is
 * absent, and the caller falls back to its own constants.
 */
import type { StlibArchive } from "./library-manifest.js";
/**
 * Parsed shape of a `library.json` file.
 *
 * Required fields mirror the corresponding `.stlib` manifest fields so a
 * library with no .st sources at all (purely-imported lib, e.g. OSCAT)
 * could in theory ship just a `library.json` + `.stlib` archive.
 *
 * `blocks` and `functions` are name-keyed maps so the JSON file reads
 * naturally — one block per top-level entry — and the build script can
 * cross-check each name against the compiled manifest's `functionBlocks[]`
 * / `functions[]`.
 */
export interface LibraryConfig {
    /** Library identity. Must match what the consumer references. */
    name: string;
    /** Optional human-readable name for tooling display (editor library
     *  trees, package manager UIs). Falls back to `name` when unset. */
    displayName?: string;
    /** SemVer-like version string. */
    version: string;
    /** C++ namespace the compiled archive lives in. */
    namespace: string;
    /** Human-readable summary surfaced in tooling. */
    description?: string;
    /** Marks the library as a built-in runtime library (vs. user-installed). */
    isBuiltin?: boolean;
    /** Compile-time integer constants the library's ST sources reference
     *  (e.g. OSCAT's STRING_LENGTH and LIST_LENGTH). Forwarded to
     *  compileStlib's `globalConstants` option. */
    globalConstants?: Record<string, number>;
    /** Path (relative to the library's source directory) to a CODESYS
     *  binary library file (.lib for V2.3, .library for V3) that the build
     *  script should run through the codesys-importer instead of compiling
     *  hand-authored .st files. When set, the lib's source directory should
     *  not contain .st files — the importer produces them at build time. */
    codesysSource?: string;
    /** Block-level documentation, keyed by FB name. */
    blocks?: Record<string, {
        documentation: string;
    }>;
    /** Function-level documentation, keyed by function name. */
    functions?: Record<string, {
        documentation: string;
    }>;
}
/**
 * Parse a `library.json` payload that the caller has already
 * obtained from somewhere (disk, HTTP fetch, IPC, …).  `sourceLabel`
 * rides on diagnostics so a malformed config still points at a
 * meaningful location.
 *
 * Throws on parse errors and on schema violations so build failures
 * are loud and pinpoint the misconfigured input.
 */
export declare function loadLibraryConfigFromString(json: string, sourceLabel: string): LibraryConfig;
/**
 * Result of merging documentation into a compiled archive.
 * `unknownBlockDocs` / `unknownFunctionDocs` carry names that appeared
 * in `library.json` but don't exist in the compiled manifest — usually
 * a typo or a stale entry left behind when an FB was renamed. Build
 * scripts should treat this as a hard error.
 */
export interface ApplyDocumentationResult {
    /** Number of FBs that received documentation. */
    blocksDocumented: number;
    /** Number of functions that received documentation. */
    functionsDocumented: number;
    /** Block names doc'd in library.json but absent from the manifest. */
    unknownBlockDocs: string[];
    /** Function names doc'd in library.json but absent from the manifest. */
    unknownFunctionDocs: string[];
}
/**
 * Merge `LibraryConfig.blocks` and `.functions` documentation into the
 * compiled archive's manifest, in place. Returns a report of what was
 * applied and what was unmatched so the caller can fail the build on
 * mismatch.
 *
 * Names are matched case-sensitively — STruC++ FB / function names are
 * uppercased by the parser before they reach the manifest, so the
 * library.json keys must use the same casing the source declares.
 */
export declare function applyLibraryConfigDocumentation(archive: StlibArchive, config: LibraryConfig): ApplyDocumentationResult;
//# sourceMappingURL=library-config.d.ts.map