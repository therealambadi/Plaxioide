/**
 * STruC++ Built-in Standard Library Manifest
 *
 * Provides a LibraryManifest describing the C++ runtime standard functions
 * (ABS, SQRT, LEN, etc.) that are implemented in the runtime headers.
 *
 * Note: The IEC standard function block library (TON, CTU, R_TRIG, etc.)
 * is a regular .stlib archive loaded via libraryPaths like any other library.
 */
import type { LibraryManifest } from "./library-manifest.js";
/**
 * Generate a LibraryManifest for the built-in standard library.
 * This manifest describes all standard functions for documentation and
 * library discovery purposes. The actual implementations live in the
 * C++ runtime headers.
 */
export declare function getBuiltinStdlibManifest(): LibraryManifest;
//# sourceMappingURL=builtin-stdlib.d.ts.map