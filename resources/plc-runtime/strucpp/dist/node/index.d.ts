/**
 * Node-only entry point — re-exports the entire browser-safe
 * `strucpp` surface plus the filesystem and process-spawning
 * helpers that only make sense on Node.
 *
 * Consumed by:
 *   - The `strucpp` CLI (`bin/strucpp` → `dist/node/cli.js`).
 *   - openplc-editor's compile pipeline, which spawns g++ and
 *     reads `.stlib` archives off disk.
 *   - Test runners and build orchestration scripts.
 *
 * Browser consumers (the strucpp Web Worker, openplc-web) import
 * from `strucpp` — they never see the file/process helpers below
 * and the bundle stays Node-API-free.
 */
export * from "../index.js";
export { discoverLibraries, discoverStlibs, loadLibraryFromFile, loadStlibFromFile, } from "./library-loader.js";
export { loadLibraryConfig } from "./library-config.js";
export { discoverSTFiles } from "./library-utils.js";
export { importCodesysLibraryFromFile } from "./codesys-import.js";
export { findBundledLibsDir, findRuntimeIncludeDir, getCxxEnv, isCompilerAvailable, } from "./build-utils.js";
//# sourceMappingURL=index.d.ts.map