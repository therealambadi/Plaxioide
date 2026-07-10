/**
 * Node-only file-shaped wrappers around the pure library-config
 * parsers.  Browser / worker consumers fetch the JSON text
 * themselves and call `loadLibraryConfigFromString` directly.
 */
import { type LibraryConfig } from "../library/library-config.js";
/**
 * Read `<sourcesDir>/library.json` and parse it.  Returns `null` if
 * the file is absent — callers fall back to their own defaults.
 */
export declare function loadLibraryConfig(sourcesDir: string): LibraryConfig | null;
//# sourceMappingURL=library-config.d.ts.map