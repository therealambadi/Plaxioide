/**
 * CODESYS Library Importer — unified public API.
 *
 * Auto-detects the library format (V2.3 or V3) and extracts ST source files
 * that can be fed directly to `compileStlib()`.
 *
 * The importer is bytes-first: callers hand in a `Uint8Array` they
 * already obtained (HTTP fetch, FileReader, Electron IPC, Node
 * `readFileSync`).  A Node-only convenience wrapper that takes a
 * file path lives in `strucpp/node`.
 */
import type { CodesysFormat, CodesysImportResult } from "./types.js";
/**
 * Detect the CODESYS library format from binary content.
 * Returns null if the format is unrecognised.
 */
export declare function detectFormat(data: Uint8Array): CodesysFormat | null;
/**
 * Import a CODESYS library from raw bytes.
 *
 * Auto-detects V2.3 (.lib) vs V3 (.library) format and extracts
 * all POUs as individual `.st` sources.  Async because V3 archives
 * use DEFLATE compression that we decompress through the platform's
 * `DecompressionStream`.
 *
 * @param data - Raw bytes of the CODESYS library file
 * @returns Import result with extracted sources ready for `compileStlib()`
 */
export declare function importCodesysLibraryFromBytes(data: Uint8Array): Promise<CodesysImportResult>;
//# sourceMappingURL=codesys-importer.d.ts.map