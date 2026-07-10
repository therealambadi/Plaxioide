/**
 * STruC++ REPL Main Generator
 *
 * Generates a main.cpp file that bootstraps the interactive PLC test REPL.
 * Takes the AST and ProjectModel to produce variable descriptors and program
 * instantiation code.
 */
import type { CompilationUnit } from "../frontend/ast.js";
import type { ProjectModel } from "../project-model.js";
import type { LineMapEntry } from "../types.js";
/**
 * Options for REPL main generation.
 */
export interface ReplMainGenOptions {
    /** Header filename to include (default: "generated.hpp") */
    headerFileName: string;
    /** Original ST source to embed in the binary for the `code` command */
    stSource?: string;
    /** Generated C++ implementation code to embed for side-by-side display */
    cppCode?: string;
    /** Generated C++ header code to embed for side-by-side display */
    headerCode?: string;
    /** Line mapping from ST to C++ implementation for side-by-side alignment */
    lineMap?: Map<number, LineMapEntry>;
    /** Line mapping from ST to C++ header for side-by-side alignment */
    headerLineMap?: Map<number, LineMapEntry>;
}
/**
 * Generate main.cpp source code for the interactive REPL.
 */
export declare function generateReplMain(ast: CompilationUnit, projectModel: ProjectModel, options?: ReplMainGenOptions): string;
//# sourceMappingURL=repl-main-gen.d.ts.map