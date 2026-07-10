/**
 * Node-only build orchestration helpers.
 *
 * These spawn external processes (`xcrun`, `g++`) and probe the
 * filesystem to locate the strucpp runtime headers and bundled
 * library archives.  They're used by the CLI and by editor
 * integrations that orchestrate C++ compilation; the browser LSP
 * doesn't compile to binaries and never needs any of this.
 *
 * Pure C++ flag parsing (`splitCxxFlags`, `extractIncludePaths`)
 * lives in `src/cxx-flags.ts` — re-exported here for convenience
 * so Node consumers can grab the whole surface from one place.
 */
export { extractIncludePaths, splitCxxFlags } from "../cxx-flags.js";
/**
 * On macOS, newer Xcode CLT versions move libc++ headers to the SDK.
 * Returns an env object with CPLUS_INCLUDE_PATH set so g++ can find them.
 */
export declare function getCxxEnv(): NodeJS.ProcessEnv | undefined;
/**
 * Check whether a compiler is available by probing with --version.
 * Returns true if the command executes successfully, false otherwise.
 */
export declare function isCompilerAvailable(command: string): boolean;
/**
 * Locate the runtime include directory by auto-discovery or from --cxx-flags.
 * Returns the resolved path or null if not found.
 */
export declare function findRuntimeIncludeDir(cxxFlags: string): string | null;
/**
 * Locate the bundled libs directory containing .stlib files.
 * Similar to how gcc auto-discovers system libraries from known paths.
 * Returns the resolved path or null if not found.
 */
export declare function findBundledLibsDir(): string | null;
//# sourceMappingURL=build-utils.d.ts.map