/**
 * STruC++ Library Compiler
 *
 * Compiles ST source files into a library: manifest + C++ output.
 * Libraries expose their functions, FBs, and types for use by other compilations.
 */
import type { LibraryCompileResult, StlibCompileResult, StlibArchive } from "./library-manifest.js";
/**
 * Compile ST source files into a library.
 *
 * @param sources - Array of ST source files
 * @param options - Library metadata
 * @returns The compiled library with manifest and C++ code
 */
export declare function compileLibrary(sources: Array<{
    source: string;
    fileName: string;
    category?: string;
    documentation?: string;
}>, options: {
    name: string;
    version: string;
    namespace: string;
    /** Library archives this library depends on */
    dependencies?: StlibArchive[];
    /** Global constants available during compilation (e.g., STRING_LENGTH) */
    globalConstants?: Record<string, number>;
}): LibraryCompileResult;
/**
 * Compile ST source files into a single `.stlib` archive.
 *
 * Wraps `compileLibrary()` and packages the result into a `StlibArchive`
 * with extracted namespace bodies for the C++ code.
 *
 * @param sources - Array of ST source files
 * @param options - Library metadata and compilation options
 * @returns The compiled `.stlib` archive result
 */
export declare function compileStlib(sources: Array<{
    source: string;
    fileName: string;
    category?: string;
    documentation?: string;
}>, options: {
    name: string;
    version: string;
    namespace: string;
    noSource?: boolean;
    /** Mark this library as a built-in runtime library */
    builtin?: boolean;
    /** Library archives this library depends on */
    dependencies?: StlibArchive[];
    /** Global constants available during compilation (e.g., STRING_LENGTH) */
    globalConstants?: Record<string, number>;
}): StlibCompileResult;
//# sourceMappingURL=library-compiler.d.ts.map