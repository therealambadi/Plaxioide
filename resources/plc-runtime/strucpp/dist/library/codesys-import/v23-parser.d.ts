/**
 * CODESYS V2.3 .lib file parser.
 *
 * Extracts POU / GVL / data-type source from the binary container format used by
 * CODESYS 2.3 (magic "CoDeSys+"). The container is an MFC-style serialized object
 * graph: each text artefact (a POU declaration, an implementation body, a global
 * variable list, a data-type definition, an object name) is stored as a
 * **length-prefixed string** — a 4-byte little-endian length immediately followed by
 * exactly that many latin1 bytes. Objects are separated by class descriptors, 0xCD
 * uninitialised-memory filler and null padding.
 *
 * Per POU the layout is:
 *   [4-byte LE decl-length] [declaration text]
 *   [0x12 separator] [4-byte LE impl-length] [implementation text]
 * GVLs and data types are a single length-prefixed declaration with no body.
 *
 * We locate each artefact by scanning for its leading ST keyword and then reading the
 * length prefix that sits immediately before it, extracting EXACTLY that many bytes.
 * This is what keeps the extraction clean: an earlier approach regex-scanned the whole
 * latin1-decoded blob for `VAR_GLOBAL … END_VAR`, which let the match run past the real
 * end of a (often empty) GVL and swallow the surrounding container framing — null
 * padding and 0xCD filler. Reading the length-prefixed record bounds the text exactly,
 * and a final printable-text guard rejects any misread that still straddles binary.
 */
import type { ExtractedPOU } from "./types.js";
/**
 * Validate that a buffer starts with the CODESYS V2.3 magic bytes.
 */
export declare function isV23Library(data: Uint8Array): boolean;
/**
 * Parse a CODESYS V2.3 .lib buffer and extract all POUs / GVLs / data types.
 *
 * @param data - Raw binary content of the .lib file
 * @returns Array of extracted artefacts sorted by offset
 */
export declare function parseV23Library(data: Uint8Array): {
    pous: ExtractedPOU[];
    warnings: string[];
};
//# sourceMappingURL=v23-parser.d.ts.map