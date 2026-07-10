/**
 * Node-only file-shaped wrappers around the pure library-loader.
 *
 * Browser / worker consumers fetch bytes themselves and use the
 * pure `loadStlibArchive` / `loadStlibFromString` /
 * `loadStlibFromBuffer` / `loadLibraryManifest` helpers exported
 * from `strucpp`.  This module provides the convenience surface
 * for tooling that runs on disk — the CLI, the openplc-editor
 * compile pipeline, the rebuild scripts.
 */
import type { LibraryManifest, StlibArchive } from "../library/library-manifest.js";
/**
 * Load a library manifest from a `.stlib.json` file on disk.
 */
export declare function loadLibraryFromFile(manifestPath: string): LibraryManifest;
/**
 * Discover and load all library manifests (`*.stlib.json`) in a directory.
 */
export declare function discoverLibraries(dirPath: string): LibraryManifest[];
/**
 * Load a `.stlib` archive from a file on disk.
 */
export declare function loadStlibFromFile(path: string): StlibArchive;
/**
 * Discover and load all `.stlib` archives in a directory (non-recursive).
 */
export declare function discoverStlibs(dirPath: string): StlibArchive[];
//# sourceMappingURL=library-loader.d.ts.map