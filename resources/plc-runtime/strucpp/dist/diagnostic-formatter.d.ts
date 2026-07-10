/**
 * gcc-style diagnostic formatter.
 *
 * Renders CompileError entries as:
 *
 *   foo.st:5:10: error: undefined variable 'x'
 *       5 |     y := x + 1;
 *         |          ^
 *
 * Multi-line spans are clamped to the first line; `endColumn`, when
 * present and on the same line as `column`, widens the underline to
 * `^~~~`.  When source text is unavailable (no map entry, line out of
 * range) the formatter falls back to the bare location/severity/message
 * line so callers can hand it any error without crashing.
 */
import type { CompileError } from "./types.js";
/** A single ST source available for snippet rendering. */
export interface DiagnosticSource {
    /** Filename that errors reference via `error.file`. Use the basename. */
    fileName: string;
    /** Full file contents. */
    source: string;
}
/**
 * Build a fast lookup map from `fileName` -> source. Pass everything the CLI
 * has read: the primary input plus any additional sources / library sources.
 */
export declare function buildSourceMap(sources: DiagnosticSource[]): Map<string, string>;
/**
 * Options for {@link formatDiagnostic}.  All fields are optional; the
 * default rendering matches the long-standing CLI / vscode-extension
 * behaviour — programmatic consumers opt in to the newer behaviours.
 */
export interface FormatDiagnosticOptions {
    /**
     * When `true`, body-attributed diagnostics (`error.section === 'body'`
     * with `error.bodyLine` set) are rendered with the body-relative
     * line number in both the header column and the snippet gutter,
     * matching what an editor like the OpenPLC Editor shows in its
     * Monaco body view.  The source content is still read from the
     * raw `error.line` in the per-POU file under the hood; only the
     * displayed numbers change.
     *
     * Default: `false` (preserves the absolute file line in every
     * field — this is what `strucpp` CLI users and the vscode
     * extension see today).
     */
    preferBodyLine?: boolean;
    /**
     * When `true`, the formatter wraps severity / location / source
     * markers in ANSI escape sequences.  Default `false` so a
     * formatter call from a browser or a test always returns plain
     * text.  The CLI flips this based on `process.env.NO_COLOR` /
     * `process.stderr.isTTY`.
     */
    enableColor?: boolean;
}
/**
 * Format a single diagnostic in gcc style. Returns a multi-line string with
 * no trailing newline.
 */
export declare function formatDiagnostic(error: CompileError, sourceMap: Map<string, string>, options?: FormatDiagnosticOptions): string;
/**
 * Format a list of diagnostics, one per entry, separated by blank lines.
 * Convenience wrapper over `formatDiagnostic`.
 */
export declare function formatDiagnostics(errors: CompileError[], sources: DiagnosticSource[], options?: FormatDiagnosticOptions): string;
//# sourceMappingURL=diagnostic-formatter.d.ts.map