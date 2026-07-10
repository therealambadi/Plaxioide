/**
 * STruC++ Library Loader
 *
 * Loads library manifests and registers their symbols into the symbol tables
 * for cross-library function resolution.
 */
import type { LibraryManifest, StlibArchive } from "./library-manifest.js";
import type { SymbolTables } from "../semantic/symbol-table.js";
/**
 * Error thrown when a library manifest fails validation.
 */
export declare class LibraryManifestError extends Error {
    constructor(message: string);
}
/**
 * Load a library manifest from a JSON object.
 * Validates required fields and structure.
 * (In production, this would read from a .stlib.json file on disk.)
 *
 * @throws {LibraryManifestError} if required fields are missing or invalid
 */
export declare function loadLibraryManifest(json: unknown): LibraryManifest;
/**
 * Register a library's symbols into the compiler's symbol tables.
 * This makes library functions, FBs, and types available for semantic analysis.
 */
export declare function registerLibrarySymbols(manifest: LibraryManifest, symbolTables: SymbolTables): void;
/**
 * Load a `.stlib` archive from a parsed JSON object.
 * Validates the archive structure including formatVersion, manifest, headerCode,
 * cppCode, and dependencies.
 *
 * @throws {LibraryManifestError} if required fields are missing or invalid
 */
export declare function loadStlibArchive(json: unknown): StlibArchive;
/**
 * Parse and validate an stlib archive from its raw JSON text.
 *
 * Browser-safe sibling of `loadStlibFromFile` — takes a string the
 * caller already obtained (HTTP fetch, IPC, FileReader, etc.) instead
 * of touching the filesystem.  Use this in environments without `fs`.
 *
 * @param raw - JSON text of the `.stlib` archive
 * @param sourceLabel - Optional label used in error messages
 * @returns The validated archive
 * @throws {LibraryManifestError} if the JSON is malformed or invalid
 */
export declare function loadStlibFromString(raw: string, sourceLabel?: string): StlibArchive;
/**
 * Parse and validate an stlib archive from raw bytes.
 *
 * Browser-safe sibling of `loadStlibFromFile` — accepts the byte
 * payload of an `.stlib` (UTF-8 encoded JSON).  Suitable for
 * `fetch(...).then(r => r.arrayBuffer())` flows and for Electron
 * preload paths that hand the renderer a `Uint8Array` over IPC.
 *
 * @param bytes - Raw UTF-8 bytes of the `.stlib` archive
 * @param sourceLabel - Optional label used in error messages
 * @returns The validated archive
 * @throws {LibraryManifestError} if the JSON is malformed or invalid
 */
export declare function loadStlibFromBuffer(bytes: Uint8Array, sourceLabel?: string): StlibArchive;
//# sourceMappingURL=library-loader.d.ts.map