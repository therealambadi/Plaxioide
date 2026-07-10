/**
 * Portable byte-handling primitives.
 *
 * The CODESYS importer and a few binary helpers used to lean on
 * Node's `Buffer` class — `Buffer.from(...)`, `.equals(...)`,
 * `.toString("utf-8")`, `.readUInt32LE(...)`, `zlib.inflateRawSync`,
 * and friends.  None of those are available in a browser worker.
 *
 * `Uint8Array` is the portable substitute that works on both
 * platforms.  This module provides the small handful of operations
 * that map directly from the Buffer surface our parsers need.  Each
 * helper is a one-liner; the point is to keep the call sites
 * readable and free of `new TextDecoder().decode(...)` ceremony.
 */
/** Compare two byte sequences for value-equality. */
export declare function bytesEqual(a: Uint8Array, b: Uint8Array): boolean;
/** Lower-case hex dump of a byte sequence (no separator, no prefix). */
export declare function bytesToHex(bytes: Uint8Array): string;
/** Decode a byte slice as UTF-8 text. */
export declare function bytesToUtf8(bytes: Uint8Array): string;
/**
 * Decode a byte slice as Latin-1 text (1:1 mapping bytes → U+0000…U+00FF).
 * Used by the CODESYS V2.3 binary parser, where POU declarations
 * are stored in an 8-bit single-byte encoding rather than UTF-8.
 */
export declare function bytesToLatin1(bytes: Uint8Array): string;
/**
 * Find the first occurrence of `needle` in `haystack` at or after
 * `offset`.  Returns the matching index, or -1 if not found.  The
 * built-in `Uint8Array#indexOf` only works on single bytes; this
 * helper handles multi-byte patterns the way Node's `Buffer#indexOf`
 * does.
 */
export declare function findSubArray(haystack: Uint8Array, needle: Uint8Array, offset?: number): number;
/** Encode a string as UTF-8 bytes. */
export declare function utf8ToBytes(text: string): Uint8Array;
/** Read a little-endian unsigned 32-bit integer at `offset`. */
export declare function readUInt32LE(bytes: Uint8Array, offset: number): number;
/** Read a little-endian unsigned 16-bit integer at `offset`. */
export declare function readUInt16LE(bytes: Uint8Array, offset: number): number;
/**
 * Inflate a raw DEFLATE (zlib) stream.
 *
 * Uses the standard `DecompressionStream` API available in modern
 * browsers (Chrome 80+, Firefox 113+, Safari 16.4+) and Node 18+.
 * Both platforms run the same code path — no fork between worker
 * and Node CLI.
 */
export declare function inflateRaw(bytes: Uint8Array): Promise<Uint8Array>;
//# sourceMappingURL=byte-utils.d.ts.map