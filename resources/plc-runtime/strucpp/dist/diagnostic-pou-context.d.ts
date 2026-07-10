/**
 * Diagnostic POU context — annotate `CompileError` records with the
 * POU + section that contains them, plus a body-relative line number
 * for body errors.
 *
 * Why a post-pass instead of populating the fields where each error is
 * created: errors are emitted from many places (parser, AST builder,
 * project model, semantic analyzer, codegen) and they all already carry
 * `(line, column, file)`.  A single post-pass walks the AST once,
 * builds an interval table per `(file, line)`, and decorates every
 * collected error in O(errors × log POUs) — much cheaper than threading
 * POU/section state through every diagnostic site.
 *
 * Standalone CLI use of strucpp doesn't read these fields; they're only
 * surfaced through the programmatic API to consumers like the OpenPLC
 * Editor that need to remap from "line in monolithic program.st" to
 * "line in the user's POU body view".
 */
import type { CompilationUnit } from "./frontend/ast.js";
import type { CompileError } from "./types.js";
/**
 * Mutate `errors` in place, populating `pouName` / `pouKind` /
 * `section` / `bodyLine` on every record that maps into one of the
 * POU ranges built from `ast`.  Errors with no `line` (or `line === 0`,
 * which we use as a sentinel for diagnostics not tied to a source
 * location) are left untouched.
 *
 * Errors whose `file` doesn't match any POU's source file (e.g. the
 * synthetic `_types.st` / `_config.st` chunks the editor splits out)
 * also fall through unchanged — those map to non-POU sections in the
 * editor and don't need POU-relative location.
 */
export declare function annotateErrorsWithPouContext(errors: CompileError[], ast: CompilationUnit): void;
//# sourceMappingURL=diagnostic-pou-context.d.ts.map