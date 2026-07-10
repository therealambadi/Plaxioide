/**
 * Pure C++ flag-string parsers.
 *
 * Extracted from `build-utils.ts` so the Node-only build helpers
 * can be split into `strucpp/node`.  These two functions are
 * string math — they don't touch the filesystem or spawn processes
 * and are safe to import from a browser worker.
 */
/**
 * Split a --cxx-flags string into individual arguments,
 * respecting double-quoted segments (e.g. '-I"/path with spaces"').
 */
export declare function splitCxxFlags(flags: string): string[];
/**
 * Extract `-I` include paths from a compiler flags string.
 * Handles: `-I/path`, `-I /path`, `-I"/path with spaces"`.
 */
export declare function extractIncludePaths(flags: string): string[];
//# sourceMappingURL=cxx-flags.d.ts.map