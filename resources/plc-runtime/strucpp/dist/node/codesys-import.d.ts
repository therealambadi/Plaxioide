/**
 * Node-only file-path wrapper around the bytes-first CODESYS
 * importer.  Browser / worker consumers fetch the bytes themselves
 * and call `importCodesysLibraryFromBytes` directly.
 */
import type { CodesysImportResult } from "../library/codesys-import/index.js";
/**
 * Import a CODESYS library from a file on disk.  Auto-detects V2.3
 * vs V3 format and extracts POUs as `.st` sources.
 */
export declare function importCodesysLibraryFromFile(filePath: string): Promise<CodesysImportResult>;
//# sourceMappingURL=codesys-import.d.ts.map