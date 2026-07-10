/**
 * STruC++ Test Main Generator
 *
 * Generates test_main.cpp from parsed test files and compiled source.
 * Each TEST block becomes a bool test_N(TestContext&) function.
 * The generated main() registers all tests and calls runner.run().
 *
 * All ST→C++ translation is delegated to TestCodeGenerator (which extends
 * the production CodeGenerator) to avoid divergence. Only test-specific
 * logic (asserts, mocks, setup/teardown, runner registration) lives here.
 */
import type { TestFile } from "../testing/test-model.js";
import type { CompilationUnit } from "../frontend/ast.js";
import type { StlibArchive } from "../library/library-manifest.js";
/**
 * Information about a POU (Program Organization Unit) from compilation.
 */
export interface POUInfo {
    name: string;
    kind: "program" | "functionBlock" | "function";
    /** C++ class name (e.g., "Program_Counter" for programs, "Debounce" for FBs) */
    cppClassName: string;
    /** Variable declarations with types */
    variables: Map<string, string>;
}
/**
 * Information about a function for mock dispatch generation.
 * @deprecated Use `ast` option instead — FunctionInfo loses maxLength, blockType, and VAR_OUTPUT info.
 */
export interface FunctionInfo {
    name: string;
    returnType: string;
    parameters: Array<{
        name: string;
        type: string;
    }>;
}
/**
 * Options for test main generation.
 */
export interface TestMainGenOptions {
    /** Header filename to include */
    headerFileName: string;
    /** Known POUs from the source compilation */
    pous: POUInfo[];
    /** Whether this is a test build (enables mock infrastructure) */
    isTestBuild?: boolean;
    /** Source AST — primary way to pass type and function info (preferred over `functions`) */
    ast?: CompilationUnit;
    /** Resolved library archives (stdlib + user) — used to register FB types */
    libraryArchives?: StlibArchive[];
    /**
     * Known functions for mock dispatch generation.
     * @deprecated Use `ast` instead for correct type resolution.
     */
    functions?: FunctionInfo[];
}
/**
 * Build POUInfo from a CompilationUnit AST.
 * Shared helper used by CLI, integration tests, and validation suite.
 */
export declare function buildPOUInfoFromAST(ast: CompilationUnit): {
    pous: POUInfo[];
};
/**
 * Generate the test_main.cpp source code.
 *
 * @param testFiles - Parsed test files
 * @param options - Generation options
 * @returns The generated C++ source code
 */
export declare function generateTestMain(testFiles: TestFile[], options: TestMainGenOptions): string;
//# sourceMappingURL=test-main-gen.d.ts.map