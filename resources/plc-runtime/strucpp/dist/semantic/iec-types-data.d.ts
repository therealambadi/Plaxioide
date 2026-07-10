/**
 * STruC++ Canonical IEC Base Type Metadata
 *
 * Single source of truth for every IEC 61131-3 elementary type strucpp
 * recognizes. Every other consumer — strucpp's own type-checker /
 * codegen, the OpenPLC Editor's variables table / debugger / XML
 * emitter, future tooling — derives its type knowledge from this list
 * (or, for external repos, from the `libs/iec-types.json` artifact this
 * file is built into).
 *
 * Adding a new elementary type goes here first, then a downstream
 * artifact rebuild (`npm run build`) refreshes `libs/iec-types.json`.
 *
 * Aliases (TIME_OF_DAY/TOD, DATE_AND_TIME/DT) are listed under their
 * canonical entry rather than getting their own row. The parser
 * accepts either spelling; everything downstream sees only canonical
 * names.
 */
/**
 * Wire format identifier — keys a small dispatcher in editor runtime
 * tooling that maps a strucpp type to byte-decoding (debugger watch
 * panel) and byte-encoding (force value) logic. Adding a new format
 * here means handling it on both ends; that's intentional friction.
 */
export type IECWireFormat = "bool" | "int8" | "uint8" | "int16" | "uint16" | "int32" | "uint32" | "int64" | "uint64" | "float32" | "float64"
/** TIME — int64 nanoseconds duration, formatted as `T#…` */
 | "duration-ns-i64"
/** DT — int64 nanoseconds since Unix epoch, formatted as `DT#…` */
 | "datetime-ns-i64"
/** DATE — int64 nanoseconds since Unix epoch (date portion only),
 *  formatted as `D#YYYY-MM-DD` */
 | "date-ns-i64"
/** TOD — int64 nanoseconds since midnight, formatted as `TOD#…` */
 | "tod-ns-i64"
/** STRING — 1 length byte + 126 UTF-8 bytes (strucpp default cap). */
 | "len8-utf8"
/** WSTRING — 1 length byte + 126 UTF-16 LE code units. */
 | "len8-utf16le";
/**
 * Single elementary type entry. Keep field order stable — it's what
 * gets serialised into `libs/iec-types.json` for downstream consumers.
 */
export interface IECTypeMetadata {
    /** Canonical IEC 61131-3 name (uppercase). */
    name: string;
    /** Alternate names the parser accepts as the same type. Empty if
     *  the canonical name is the only spelling. */
    aliases: readonly string[];
    /** Byte width on the wire / in memory. `0` for variable-width
     *  string types (where the actual width is determined by the
     *  STRING_LENGTH global constant or per-declaration override). */
    byteSize: number;
    /** Logical IEC bit width — equals `byteSize * 8` for every type
     *  except BOOL, which is `1` bit logically but stored as a single
     *  byte on the wire (`byteSize: 1`). `0` for variable-width strings.
     *
     *  Type-checker widening / compatibility rules read this rather
     *  than `byteSize` so a SINT-into-BOOL coercion (8 logical bits to
     *  1) gets caught the same way the IEC spec calls it out. */
    bits: number;
    /** True ⇒ signed integer / IEC duration. False ⇒ unsigned. `null`
     *  for non-numeric types (BOOL, STRING, WSTRING). */
    signed: boolean | null;
    /** C++ type alias from `runtime/include/iec_types.hpp`. Generated
     *  code emits `strucpp::<cppType>` for variables of this type. */
    cppType: string;
    /** Wire format identifier — see {@link IECWireFormat}. */
    wireFormat: IECWireFormat;
    /** PLCopen TC6 v0201 XML mapping. */
    xml: {
        /** Element name in PLCopen TC6 wire shape. Lowercase for
         *  parameterized types (`string`, `wstring`), uppercase
         *  otherwise. Editors should emit `<elementName/>` for
         *  PLCopen-standard types and `<derived name="X"/>` for
         *  everything else. */
        elementName: string;
        /** True iff this type is in the PLCopen TC6 XSD elementaryTypes
         *  group (a closed `<choice>`, no extension allowed). False ⇒
         *  emit `<derived/>` instead. */
        plcopenStandard: boolean;
    };
    /** Hint for editors / pretty-printers showing literals of this
     *  type. Optional — only set where it's specific enough to be
     *  useful (e.g. `"TRUE/FALSE"` for BOOL, `"T#1d2h3m"` for TIME). */
    literalDisplay?: string;
}
/**
 * The full set of strucpp-recognised IEC 61131-3 elementary types.
 *
 * Order is intentional: groups bit-strings, signed ints, unsigned
 * ints, reals, time/date, strings — same flow as the IEC standard
 * tables and the iec_types.hpp typedef order. Editors that surface
 * this as a dropdown should preserve the order for user familiarity.
 */
export declare const IEC_BASE_TYPES: readonly IECTypeMetadata[];
/**
 * Resolve a type name (canonical or alias, any case) to its metadata
 * entry. Returns `undefined` for non-elementary names so callers can
 * disambiguate between "elementary type unknown to strucpp" and
 * "user-defined type that's expected to look unknown".
 */
export declare function lookupBaseType(name: string): IECTypeMetadata | undefined;
/**
 * Whether a name (canonical or alias) refers to an IEC elementary type.
 */
export declare function isBaseTypeName(name: string): boolean;
//# sourceMappingURL=iec-types-data.d.ts.map