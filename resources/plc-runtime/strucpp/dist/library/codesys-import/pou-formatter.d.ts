/**
 * POU Formatter — shared by V2.3 and V3 parsers.
 *
 * Converts ExtractedPOU intermediate representations into clean .st source text.
 */
import type { ExtractedPOU } from "./types.js";
/**
 * Format a single ExtractedPOU into a complete .st source string.
 * Normalizes line endings, trims whitespace, and adds proper END markers.
 */
export declare function formatPOU(pou: ExtractedPOU): string;
/**
 * Convert an array of ExtractedPOUs into source file entries suitable
 * for `compileStlib()`. The POU's `category` (folder path inside the
 * source library) and `documentation` (variables-pane doc block) are
 * forwarded so the compiler can attach them to the resulting manifest
 * entries — sources stay flat in the archive, but the manifest carries
 * the metadata the upstream binary preserved.
 */
export declare function pouToSources(pous: ExtractedPOU[]): Array<{
    fileName: string;
    source: string;
    category?: string;
    documentation?: string;
}>;
//# sourceMappingURL=pou-formatter.d.ts.map