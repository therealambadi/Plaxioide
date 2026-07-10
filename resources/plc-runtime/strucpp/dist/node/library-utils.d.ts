/**
 * Node-only library utilities.  Browser / worker consumers don't
 * need filesystem walking — they either fetch source files
 * individually or receive them already loaded.
 */
/**
 * Recursively discover all `.st` and `.il` files in a directory.
 *
 * @param dir - Directory to scan
 * @returns Array of absolute paths to `.st` and `.il` files
 */
export declare function discoverSTFiles(dir: string): string[];
//# sourceMappingURL=library-utils.d.ts.map