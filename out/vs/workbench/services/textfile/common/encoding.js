import { newWriteableStream, listenStream } from "../../../../base/common/stream.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { importAMDNodeModule } from "../../../../amdX.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { coalesce } from "../../../../base/common/arrays.js";
const UTF8 = "utf8";
const UTF8_with_bom = "utf8bom";
const UTF16be = "utf16be";
const UTF16le = "utf16le";
function isUTFEncoding(encoding) {
  return [UTF8, UTF8_with_bom, UTF16be, UTF16le].some((utfEncoding) => utfEncoding === encoding);
}
const UTF16be_BOM = [254, 255];
const UTF16le_BOM = [255, 254];
const UTF8_BOM = [239, 187, 191];
const ZERO_BYTE_DETECTION_BUFFER_MAX_LEN = 512;
const NO_ENCODING_GUESS_MIN_BYTES = 512;
const AUTO_ENCODING_GUESS_MIN_BYTES = 512 * 8;
const AUTO_ENCODING_GUESS_MAX_BYTES = 512 * 128;
var DecodeStreamErrorKind = /* @__PURE__ */ ((DecodeStreamErrorKind2) => {
  DecodeStreamErrorKind2[DecodeStreamErrorKind2["STREAM_IS_BINARY"] = 1] = "STREAM_IS_BINARY";
  return DecodeStreamErrorKind2;
})(DecodeStreamErrorKind || {});
class DecodeStreamError extends Error {
  constructor(message, decodeStreamErrorKind) {
    super(message);
    this.decodeStreamErrorKind = decodeStreamErrorKind;
  }
}
class DecoderStream {
  constructor(iconvLiteDecoder) {
    this.iconvLiteDecoder = iconvLiteDecoder;
  }
  /**
   * This stream will only load iconv-lite lazily if the encoding
   * is not UTF-8. This ensures that for most common cases we do
   * not pay the price of loading the module from disk.
   *
   * We still need to be careful when converting UTF-8 to a string
   * though because we read the file in chunks of Buffer and thus
   * need to decode it via TextDecoder helper that is available
   * in browser and node.js environments.
   */
  static async create(encoding) {
    let decoder = void 0;
    if (encoding !== UTF8) {
      const iconv = await importAMDNodeModule("@vscode/iconv-lite-umd", "lib/iconv-lite-umd.js");
      decoder = iconv.getDecoder(toNodeEncoding(encoding));
    } else {
      const utf8TextDecoder = new TextDecoder();
      decoder = {
        write(buffer) {
          return utf8TextDecoder.decode(buffer, {
            // Signal to TextDecoder that potentially more data is coming
            // and that we are calling `decode` in the end to consume any
            // remainders
            stream: true
          });
        },
        end() {
          return utf8TextDecoder.decode();
        }
      };
    }
    return new DecoderStream(decoder);
  }
  write(buffer) {
    return this.iconvLiteDecoder.write(buffer);
  }
  end() {
    return this.iconvLiteDecoder.end();
  }
}
function toDecodeStream(source, options) {
  const minBytesRequiredForDetection = options.minBytesRequiredForDetection ?? options.guessEncoding ? AUTO_ENCODING_GUESS_MIN_BYTES : NO_ENCODING_GUESS_MIN_BYTES;
  return new Promise((resolve, reject) => {
    const target = newWriteableStream((strings) => strings.join(""));
    const bufferedChunks = [];
    let bytesBuffered = 0;
    let decoder = void 0;
    const cts = new CancellationTokenSource();
    const createDecoder = async () => {
      try {
        const detected = await detectEncodingFromBuffer({
          buffer: VSBuffer.concat(bufferedChunks),
          bytesRead: bytesBuffered
        }, options.guessEncoding, options.candidateGuessEncodings);
        if (detected.seemsBinary && options.acceptTextOnly) {
          throw new DecodeStreamError("Stream is binary but only text is accepted for decoding", 1 /* STREAM_IS_BINARY */);
        }
        detected.encoding = await options.overwriteEncoding(detected.encoding);
        decoder = await DecoderStream.create(detected.encoding);
        const decoded = decoder.write(VSBuffer.concat(bufferedChunks).buffer);
        target.write(decoded);
        bufferedChunks.length = 0;
        bytesBuffered = 0;
        resolve({
          stream: target,
          detected
        });
      } catch (error) {
        cts.cancel();
        target.destroy();
        reject(error);
      }
    };
    listenStream(source, {
      onData: async (chunk) => {
        if (decoder) {
          target.write(decoder.write(chunk.buffer));
        } else {
          bufferedChunks.push(chunk);
          bytesBuffered += chunk.byteLength;
          if (bytesBuffered >= minBytesRequiredForDetection) {
            source.pause();
            await createDecoder();
            setTimeout(() => source.resume());
          }
        }
      },
      onError: (error) => target.error(error),
      // simply forward to target
      onEnd: async () => {
        if (!decoder) {
          await createDecoder();
        }
        target.end(decoder?.end());
      }
    }, cts.token);
  });
}
async function toEncodeReadable(readable, encoding, options) {
  const iconv = await importAMDNodeModule("@vscode/iconv-lite-umd", "lib/iconv-lite-umd.js");
  const encoder = iconv.getEncoder(toNodeEncoding(encoding), options);
  let bytesWritten = false;
  let done = false;
  return {
    read() {
      if (done) {
        return null;
      }
      const chunk = readable.read();
      if (typeof chunk !== "string") {
        done = true;
        if (!bytesWritten && options?.addBOM) {
          switch (encoding) {
            case UTF8:
            case UTF8_with_bom:
              return VSBuffer.wrap(Uint8Array.from(UTF8_BOM));
            case UTF16be:
              return VSBuffer.wrap(Uint8Array.from(UTF16be_BOM));
            case UTF16le:
              return VSBuffer.wrap(Uint8Array.from(UTF16le_BOM));
          }
        }
        const leftovers = encoder.end();
        if (leftovers && leftovers.length > 0) {
          bytesWritten = true;
          return VSBuffer.wrap(leftovers);
        }
        return null;
      }
      bytesWritten = true;
      return VSBuffer.wrap(encoder.write(chunk));
    }
  };
}
async function encodingExists(encoding) {
  const iconv = await importAMDNodeModule("@vscode/iconv-lite-umd", "lib/iconv-lite-umd.js");
  return iconv.encodingExists(toNodeEncoding(encoding));
}
function toNodeEncoding(enc) {
  if (enc === UTF8_with_bom || enc === null) {
    return UTF8;
  }
  return enc;
}
function detectEncodingByBOMFromBuffer(buffer, bytesRead) {
  if (!buffer || bytesRead < UTF16be_BOM.length) {
    return null;
  }
  const b0 = buffer.readUInt8(0);
  const b1 = buffer.readUInt8(1);
  if (b0 === UTF16be_BOM[0] && b1 === UTF16be_BOM[1]) {
    return UTF16be;
  }
  if (b0 === UTF16le_BOM[0] && b1 === UTF16le_BOM[1]) {
    return UTF16le;
  }
  if (bytesRead < UTF8_BOM.length) {
    return null;
  }
  const b2 = buffer.readUInt8(2);
  if (b0 === UTF8_BOM[0] && b1 === UTF8_BOM[1] && b2 === UTF8_BOM[2]) {
    return UTF8_with_bom;
  }
  return null;
}
const IGNORE_ENCODINGS = ["ascii", "utf-16", "utf-32"];
async function guessEncodingByBuffer(buffer, candidateGuessEncodings) {
  const jschardet = await importAMDNodeModule("jschardet", "dist/jschardet.min.js");
  const limitedBuffer = buffer.slice(0, AUTO_ENCODING_GUESS_MAX_BYTES);
  const binaryString = encodeLatin1(limitedBuffer.buffer);
  if (candidateGuessEncodings) {
    candidateGuessEncodings = coalesce(candidateGuessEncodings.map((e) => toJschardetEncoding(e)));
    if (candidateGuessEncodings.length === 0) {
      candidateGuessEncodings = void 0;
    }
  }
  let guessed;
  try {
    guessed = jschardet.detect(binaryString, candidateGuessEncodings ? { detectEncodings: candidateGuessEncodings } : void 0);
  } catch (error) {
    return null;
  }
  if (!guessed || !guessed.encoding) {
    return null;
  }
  const enc = guessed.encoding.toLowerCase();
  if (0 <= IGNORE_ENCODINGS.indexOf(enc)) {
    return null;
  }
  return toIconvLiteEncoding(guessed.encoding);
}
const JSCHARDET_TO_ICONV_ENCODINGS = {
  "ibm866": "cp866",
  "big5": "cp950"
};
function normalizeEncoding(encodingName) {
  return encodingName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}
function toIconvLiteEncoding(encodingName) {
  const normalizedEncodingName = normalizeEncoding(encodingName);
  const mapped = JSCHARDET_TO_ICONV_ENCODINGS[normalizedEncodingName];
  return mapped || normalizedEncodingName;
}
function toJschardetEncoding(encodingName) {
  const normalizedEncodingName = normalizeEncoding(encodingName);
  const mapped = GUESSABLE_ENCODINGS[normalizedEncodingName];
  return mapped ? mapped.guessableName : void 0;
}
function encodeLatin1(buffer) {
  let result = "";
  for (let i = 0; i < buffer.length; i++) {
    result += String.fromCharCode(buffer[i]);
  }
  return result;
}
function toCanonicalName(enc) {
  switch (enc) {
    case "shiftjis":
      return "shift-jis";
    case "utf16le":
      return "utf-16le";
    case "utf16be":
      return "utf-16be";
    case "big5hkscs":
      return "big5-hkscs";
    case "eucjp":
      return "euc-jp";
    case "euckr":
      return "euc-kr";
    case "koi8r":
      return "koi8-r";
    case "koi8u":
      return "koi8-u";
    case "macroman":
      return "x-mac-roman";
    case "utf8bom":
      return "utf8";
    default: {
      const m = enc.match(/windows(\d+)/);
      if (m) {
        return "windows-" + m[1];
      }
      return enc;
    }
  }
}
function detectEncodingFromBuffer({ buffer, bytesRead }, autoGuessEncoding, candidateGuessEncodings) {
  let encoding = detectEncodingByBOMFromBuffer(buffer, bytesRead);
  let seemsBinary = false;
  if (encoding !== UTF16be && encoding !== UTF16le && buffer) {
    let couldBeUTF16LE = true;
    let couldBeUTF16BE = true;
    let containsZeroByte = false;
    for (let i = 0; i < bytesRead && i < ZERO_BYTE_DETECTION_BUFFER_MAX_LEN; i++) {
      const isEndian = i % 2 === 1;
      const isZeroByte = buffer.readUInt8(i) === 0;
      if (isZeroByte) {
        containsZeroByte = true;
      }
      if (couldBeUTF16LE && (isEndian && !isZeroByte || !isEndian && isZeroByte)) {
        couldBeUTF16LE = false;
      }
      if (couldBeUTF16BE && (isEndian && isZeroByte || !isEndian && !isZeroByte)) {
        couldBeUTF16BE = false;
      }
      if (isZeroByte && !couldBeUTF16LE && !couldBeUTF16BE) {
        break;
      }
    }
    if (containsZeroByte) {
      if (couldBeUTF16LE) {
        encoding = UTF16le;
      } else if (couldBeUTF16BE) {
        encoding = UTF16be;
      } else {
        seemsBinary = true;
      }
    }
  }
  if (autoGuessEncoding && !seemsBinary && !encoding && buffer) {
    return guessEncodingByBuffer(buffer.slice(0, bytesRead), candidateGuessEncodings).then((guessedEncoding) => {
      return {
        seemsBinary: false,
        encoding: guessedEncoding
      };
    });
  }
  return { seemsBinary, encoding };
}
const SUPPORTED_ENCODINGS = {
  utf8: {
    labelLong: "UTF-8",
    labelShort: "UTF-8",
    order: 1,
    alias: "utf8bom",
    guessableName: "UTF-8"
  },
  utf8bom: {
    labelLong: "UTF-8 with BOM",
    labelShort: "UTF-8 with BOM",
    encodeOnly: true,
    order: 2,
    alias: "utf8"
  },
  utf16le: {
    labelLong: "UTF-16 LE",
    labelShort: "UTF-16 LE",
    order: 3,
    guessableName: "UTF-16LE"
  },
  utf16be: {
    labelLong: "UTF-16 BE",
    labelShort: "UTF-16 BE",
    order: 4,
    guessableName: "UTF-16BE"
  },
  windows1252: {
    labelLong: "Western (Windows 1252)",
    labelShort: "Windows 1252",
    order: 5,
    guessableName: "windows-1252"
  },
  iso88591: {
    labelLong: "Western (ISO 8859-1)",
    labelShort: "ISO 8859-1",
    order: 6
  },
  iso88593: {
    labelLong: "Western (ISO 8859-3)",
    labelShort: "ISO 8859-3",
    order: 7
  },
  iso885915: {
    labelLong: "Western (ISO 8859-15)",
    labelShort: "ISO 8859-15",
    order: 8
  },
  macroman: {
    labelLong: "Western (Mac Roman)",
    labelShort: "Mac Roman",
    order: 9
  },
  cp437: {
    labelLong: "DOS (CP 437)",
    labelShort: "CP437",
    order: 10
  },
  windows1256: {
    labelLong: "Arabic (Windows 1256)",
    labelShort: "Windows 1256",
    order: 11
  },
  iso88596: {
    labelLong: "Arabic (ISO 8859-6)",
    labelShort: "ISO 8859-6",
    order: 12
  },
  windows1257: {
    labelLong: "Baltic (Windows 1257)",
    labelShort: "Windows 1257",
    order: 13
  },
  iso88594: {
    labelLong: "Baltic (ISO 8859-4)",
    labelShort: "ISO 8859-4",
    order: 14
  },
  iso885914: {
    labelLong: "Celtic (ISO 8859-14)",
    labelShort: "ISO 8859-14",
    order: 15
  },
  windows1250: {
    labelLong: "Central European (Windows 1250)",
    labelShort: "Windows 1250",
    order: 16,
    guessableName: "windows-1250"
  },
  iso88592: {
    labelLong: "Central European (ISO 8859-2)",
    labelShort: "ISO 8859-2",
    order: 17,
    guessableName: "ISO-8859-2"
  },
  cp852: {
    labelLong: "Central European (CP 852)",
    labelShort: "CP 852",
    order: 18
  },
  windows1251: {
    labelLong: "Cyrillic (Windows 1251)",
    labelShort: "Windows 1251",
    order: 19,
    guessableName: "windows-1251"
  },
  cp866: {
    labelLong: "Cyrillic (CP 866)",
    labelShort: "CP 866",
    order: 20,
    guessableName: "IBM866"
  },
  cp1125: {
    labelLong: "Cyrillic (CP 1125)",
    labelShort: "CP 1125",
    order: 21,
    guessableName: "IBM1125"
  },
  iso88595: {
    labelLong: "Cyrillic (ISO 8859-5)",
    labelShort: "ISO 8859-5",
    order: 22,
    guessableName: "ISO-8859-5"
  },
  koi8r: {
    labelLong: "Cyrillic (KOI8-R)",
    labelShort: "KOI8-R",
    order: 23,
    guessableName: "KOI8-R"
  },
  koi8u: {
    labelLong: "Cyrillic (KOI8-U)",
    labelShort: "KOI8-U",
    order: 24
  },
  iso885913: {
    labelLong: "Estonian (ISO 8859-13)",
    labelShort: "ISO 8859-13",
    order: 25
  },
  windows1253: {
    labelLong: "Greek (Windows 1253)",
    labelShort: "Windows 1253",
    order: 26,
    guessableName: "windows-1253"
  },
  iso88597: {
    labelLong: "Greek (ISO 8859-7)",
    labelShort: "ISO 8859-7",
    order: 27,
    guessableName: "ISO-8859-7"
  },
  windows1255: {
    labelLong: "Hebrew (Windows 1255)",
    labelShort: "Windows 1255",
    order: 28,
    guessableName: "windows-1255"
  },
  iso88598: {
    labelLong: "Hebrew (ISO 8859-8)",
    labelShort: "ISO 8859-8",
    order: 29,
    guessableName: "ISO-8859-8"
  },
  iso885910: {
    labelLong: "Nordic (ISO 8859-10)",
    labelShort: "ISO 8859-10",
    order: 30
  },
  iso885916: {
    labelLong: "Romanian (ISO 8859-16)",
    labelShort: "ISO 8859-16",
    order: 31
  },
  windows1254: {
    labelLong: "Turkish (Windows 1254)",
    labelShort: "Windows 1254",
    order: 32
  },
  iso88599: {
    labelLong: "Turkish (ISO 8859-9)",
    labelShort: "ISO 8859-9",
    order: 33
  },
  windows1258: {
    labelLong: "Vietnamese (Windows 1258)",
    labelShort: "Windows 1258",
    order: 34
  },
  gbk: {
    labelLong: "Simplified Chinese (GBK)",
    labelShort: "GBK",
    order: 35
  },
  gb18030: {
    labelLong: "Simplified Chinese (GB18030)",
    labelShort: "GB18030",
    order: 36
  },
  cp950: {
    labelLong: "Traditional Chinese (Big5)",
    labelShort: "Big5",
    order: 37,
    guessableName: "Big5"
  },
  big5hkscs: {
    labelLong: "Traditional Chinese (Big5-HKSCS)",
    labelShort: "Big5-HKSCS",
    order: 38
  },
  shiftjis: {
    labelLong: "Japanese (Shift JIS)",
    labelShort: "Shift JIS",
    order: 39,
    guessableName: "SHIFT_JIS"
  },
  eucjp: {
    labelLong: "Japanese (EUC-JP)",
    labelShort: "EUC-JP",
    order: 40,
    guessableName: "EUC-JP"
  },
  euckr: {
    labelLong: "Korean (EUC-KR)",
    labelShort: "EUC-KR",
    order: 41,
    guessableName: "EUC-KR"
  },
  windows874: {
    labelLong: "Thai (Windows 874)",
    labelShort: "Windows 874",
    order: 42
  },
  iso885911: {
    labelLong: "Latin/Thai (ISO 8859-11)",
    labelShort: "ISO 8859-11",
    order: 43
  },
  koi8ru: {
    labelLong: "Cyrillic (KOI8-RU)",
    labelShort: "KOI8-RU",
    order: 44
  },
  koi8t: {
    labelLong: "Tajik (KOI8-T)",
    labelShort: "KOI8-T",
    order: 45
  },
  gb2312: {
    labelLong: "Simplified Chinese (GB 2312)",
    labelShort: "GB 2312",
    order: 46,
    guessableName: "GB2312"
  },
  cp865: {
    labelLong: "Nordic DOS (CP 865)",
    labelShort: "CP 865",
    order: 47
  },
  cp850: {
    labelLong: "Western European DOS (CP 850)",
    labelShort: "CP 850",
    order: 48
  }
};
const GUESSABLE_ENCODINGS = (() => {
  const guessableEncodings = {};
  for (const encoding in SUPPORTED_ENCODINGS) {
    if (SUPPORTED_ENCODINGS[encoding].guessableName) {
      guessableEncodings[encoding] = SUPPORTED_ENCODINGS[encoding];
    }
  }
  return guessableEncodings;
})();
export {
  DecodeStreamError,
  DecodeStreamErrorKind,
  GUESSABLE_ENCODINGS,
  SUPPORTED_ENCODINGS,
  UTF16be,
  UTF16be_BOM,
  UTF16le,
  UTF16le_BOM,
  UTF8,
  UTF8_BOM,
  UTF8_with_bom,
  detectEncodingByBOMFromBuffer,
  detectEncodingFromBuffer,
  encodingExists,
  isUTFEncoding,
  toCanonicalName,
  toDecodeStream,
  toEncodeReadable,
  toNodeEncoding
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGV4dGZpbGUvY29tbW9uL2VuY29kaW5nLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgUmVhZGFibGUsIFJlYWRhYmxlU3RyZWFtLCBuZXdXcml0ZWFibGVTdHJlYW0sIGxpc3RlblN0cmVhbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmVhbS5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciwgVlNCdWZmZXJSZWFkYWJsZSwgVlNCdWZmZXJSZWFkYWJsZVN0cmVhbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBpbXBvcnRBTUROb2RlTW9kdWxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYW1kWC5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBjb2FsZXNjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5cbmV4cG9ydCBjb25zdCBVVEY4ID0gJ3V0ZjgnO1xuZXhwb3J0IGNvbnN0IFVURjhfd2l0aF9ib20gPSAndXRmOGJvbSc7XG5leHBvcnQgY29uc3QgVVRGMTZiZSA9ICd1dGYxNmJlJztcbmV4cG9ydCBjb25zdCBVVEYxNmxlID0gJ3V0ZjE2bGUnO1xuXG5leHBvcnQgdHlwZSBVVEZfRU5DT0RJTkcgPSB0eXBlb2YgVVRGOCB8IHR5cGVvZiBVVEY4X3dpdGhfYm9tIHwgdHlwZW9mIFVURjE2YmUgfCB0eXBlb2YgVVRGMTZsZTtcblxuZXhwb3J0IGZ1bmN0aW9uIGlzVVRGRW5jb2RpbmcoZW5jb2Rpbmc6IHN0cmluZyk6IGVuY29kaW5nIGlzIFVURl9FTkNPRElORyB7XG5cdHJldHVybiBbVVRGOCwgVVRGOF93aXRoX2JvbSwgVVRGMTZiZSwgVVRGMTZsZV0uc29tZSh1dGZFbmNvZGluZyA9PiB1dGZFbmNvZGluZyA9PT0gZW5jb2RpbmcpO1xufVxuXG5leHBvcnQgY29uc3QgVVRGMTZiZV9CT00gPSBbMHhGRSwgMHhGRl07XG5leHBvcnQgY29uc3QgVVRGMTZsZV9CT00gPSBbMHhGRiwgMHhGRV07XG5leHBvcnQgY29uc3QgVVRGOF9CT00gPSBbMHhFRiwgMHhCQiwgMHhCRl07XG5cbmNvbnN0IFpFUk9fQllURV9ERVRFQ1RJT05fQlVGRkVSX01BWF9MRU4gPSA1MTI7IFx0Ly8gbnVtYmVyIG9mIGJ5dGVzIHRvIGxvb2sgYXQgdG8gZGVjaWRlIGFib3V0IGEgZmlsZSBiZWluZyBiaW5hcnkgb3Igbm90XG5jb25zdCBOT19FTkNPRElOR19HVUVTU19NSU5fQllURVMgPSA1MTI7IFx0XHRcdC8vIHdoZW4gbm90IGF1dG8gZ3Vlc3NpbmcgdGhlIGVuY29kaW5nLCBzbWFsbCBudW1iZXIgb2YgYnl0ZXMgYXJlIGVub3VnaFxuY29uc3QgQVVUT19FTkNPRElOR19HVUVTU19NSU5fQllURVMgPSA1MTIgKiA4OyBcdFx0Ly8gd2l0aCBhdXRvIGd1ZXNzaW5nIHdlIHdhbnQgYSBsb3QgbW9yZSBjb250ZW50IHRvIGJlIHJlYWQgZm9yIGd1ZXNzaW5nXG5jb25zdCBBVVRPX0VOQ09ESU5HX0dVRVNTX01BWF9CWVRFUyA9IDUxMiAqIDEyODsgXHQvLyBzZXQgYW4gdXBwZXIgbGltaXQgZm9yIHRoZSBudW1iZXIgb2YgYnl0ZXMgd2UgcGFzcyBvbiB0byBqc2NoYXJkZXRcblxuZXhwb3J0IGludGVyZmFjZSBJRGVjb2RlU3RyZWFtT3B0aW9ucyB7XG5cdGFjY2VwdFRleHRPbmx5OiBib29sZWFuO1xuXHRndWVzc0VuY29kaW5nOiBib29sZWFuO1xuXHRjYW5kaWRhdGVHdWVzc0VuY29kaW5nczogc3RyaW5nW107XG5cdG1pbkJ5dGVzUmVxdWlyZWRGb3JEZXRlY3Rpb24/OiBudW1iZXI7XG5cblx0b3ZlcndyaXRlRW5jb2RpbmcoZGV0ZWN0ZWRFbmNvZGluZzogc3RyaW5nIHwgbnVsbCk6IFByb21pc2U8c3RyaW5nPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRGVjb2RlU3RyZWFtUmVzdWx0IHtcblx0c3RyZWFtOiBSZWFkYWJsZVN0cmVhbTxzdHJpbmc+O1xuXHRkZXRlY3RlZDogSURldGVjdGVkRW5jb2RpbmdSZXN1bHQ7XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIERlY29kZVN0cmVhbUVycm9yS2luZCB7XG5cblx0LyoqXG5cdCAqIEVycm9yIGluZGljYXRpbmcgdGhhdCB0aGUgc3RyZWFtIGlzIGJpbmFyeSBldmVuXG5cdCAqIHRob3VnaCBgYWNjZXB0VGV4dE9ubHlgIHdhcyBzcGVjaWZpZWQuXG5cdCAqL1xuXHRTVFJFQU1fSVNfQklOQVJZID0gMVxufVxuXG5leHBvcnQgY2xhc3MgRGVjb2RlU3RyZWFtRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0bWVzc2FnZTogc3RyaW5nLFxuXHRcdHJlYWRvbmx5IGRlY29kZVN0cmVhbUVycm9yS2luZDogRGVjb2RlU3RyZWFtRXJyb3JLaW5kXG5cdCkge1xuXHRcdHN1cGVyKG1lc3NhZ2UpO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSURlY29kZXJTdHJlYW0ge1xuXHR3cml0ZShidWZmZXI6IFVpbnQ4QXJyYXkpOiBzdHJpbmc7XG5cdGVuZCgpOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbmNsYXNzIERlY29kZXJTdHJlYW0gaW1wbGVtZW50cyBJRGVjb2RlclN0cmVhbSB7XG5cblx0LyoqXG5cdCAqIFRoaXMgc3RyZWFtIHdpbGwgb25seSBsb2FkIGljb252LWxpdGUgbGF6aWx5IGlmIHRoZSBlbmNvZGluZ1xuXHQgKiBpcyBub3QgVVRGLTguIFRoaXMgZW5zdXJlcyB0aGF0IGZvciBtb3N0IGNvbW1vbiBjYXNlcyB3ZSBkb1xuXHQgKiBub3QgcGF5IHRoZSBwcmljZSBvZiBsb2FkaW5nIHRoZSBtb2R1bGUgZnJvbSBkaXNrLlxuXHQgKlxuXHQgKiBXZSBzdGlsbCBuZWVkIHRvIGJlIGNhcmVmdWwgd2hlbiBjb252ZXJ0aW5nIFVURi04IHRvIGEgc3RyaW5nXG5cdCAqIHRob3VnaCBiZWNhdXNlIHdlIHJlYWQgdGhlIGZpbGUgaW4gY2h1bmtzIG9mIEJ1ZmZlciBhbmQgdGh1c1xuXHQgKiBuZWVkIHRvIGRlY29kZSBpdCB2aWEgVGV4dERlY29kZXIgaGVscGVyIHRoYXQgaXMgYXZhaWxhYmxlXG5cdCAqIGluIGJyb3dzZXIgYW5kIG5vZGUuanMgZW52aXJvbm1lbnRzLlxuXHQgKi9cblx0c3RhdGljIGFzeW5jIGNyZWF0ZShlbmNvZGluZzogc3RyaW5nKTogUHJvbWlzZTxEZWNvZGVyU3RyZWFtPiB7XG5cdFx0bGV0IGRlY29kZXI6IElEZWNvZGVyU3RyZWFtIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGlmIChlbmNvZGluZyAhPT0gVVRGOCkge1xuXHRcdFx0Y29uc3QgaWNvbnYgPSBhd2FpdCBpbXBvcnRBTUROb2RlTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0B2c2NvZGUvaWNvbnYtbGl0ZS11bWQnKT4oJ0B2c2NvZGUvaWNvbnYtbGl0ZS11bWQnLCAnbGliL2ljb252LWxpdGUtdW1kLmpzJyk7XG5cdFx0XHRkZWNvZGVyID0gaWNvbnYuZ2V0RGVjb2Rlcih0b05vZGVFbmNvZGluZyhlbmNvZGluZykpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCB1dGY4VGV4dERlY29kZXIgPSBuZXcgVGV4dERlY29kZXIoKTtcblx0XHRcdGRlY29kZXIgPSB7XG5cdFx0XHRcdHdyaXRlKGJ1ZmZlcjogVWludDhBcnJheSk6IHN0cmluZyB7XG5cdFx0XHRcdFx0cmV0dXJuIHV0ZjhUZXh0RGVjb2Rlci5kZWNvZGUoYnVmZmVyLCB7XG5cdFx0XHRcdFx0XHQvLyBTaWduYWwgdG8gVGV4dERlY29kZXIgdGhhdCBwb3RlbnRpYWxseSBtb3JlIGRhdGEgaXMgY29taW5nXG5cdFx0XHRcdFx0XHQvLyBhbmQgdGhhdCB3ZSBhcmUgY2FsbGluZyBgZGVjb2RlYCBpbiB0aGUgZW5kIHRvIGNvbnN1bWUgYW55XG5cdFx0XHRcdFx0XHQvLyByZW1haW5kZXJzXG5cdFx0XHRcdFx0XHRzdHJlYW06IHRydWVcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSxcblxuXHRcdFx0XHRlbmQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRcdFx0XHRyZXR1cm4gdXRmOFRleHREZWNvZGVyLmRlY29kZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgRGVjb2RlclN0cmVhbShkZWNvZGVyKTtcblx0fVxuXG5cdHByaXZhdGUgY29uc3RydWN0b3IocHJpdmF0ZSBpY29udkxpdGVEZWNvZGVyOiBJRGVjb2RlclN0cmVhbSkgeyB9XG5cblx0d3JpdGUoYnVmZmVyOiBVaW50OEFycmF5KTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5pY29udkxpdGVEZWNvZGVyLndyaXRlKGJ1ZmZlcik7XG5cdH1cblxuXHRlbmQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5pY29udkxpdGVEZWNvZGVyLmVuZCgpO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b0RlY29kZVN0cmVhbShzb3VyY2U6IFZTQnVmZmVyUmVhZGFibGVTdHJlYW0sIG9wdGlvbnM6IElEZWNvZGVTdHJlYW1PcHRpb25zKTogUHJvbWlzZTxJRGVjb2RlU3RyZWFtUmVzdWx0PiB7XG5cdGNvbnN0IG1pbkJ5dGVzUmVxdWlyZWRGb3JEZXRlY3Rpb24gPSBvcHRpb25zLm1pbkJ5dGVzUmVxdWlyZWRGb3JEZXRlY3Rpb24gPz8gb3B0aW9ucy5ndWVzc0VuY29kaW5nID8gQVVUT19FTkNPRElOR19HVUVTU19NSU5fQllURVMgOiBOT19FTkNPRElOR19HVUVTU19NSU5fQllURVM7XG5cblx0cmV0dXJuIG5ldyBQcm9taXNlPElEZWNvZGVTdHJlYW1SZXN1bHQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRjb25zdCB0YXJnZXQgPSBuZXdXcml0ZWFibGVTdHJlYW08c3RyaW5nPihzdHJpbmdzID0+IHN0cmluZ3Muam9pbignJykpO1xuXG5cdFx0Y29uc3QgYnVmZmVyZWRDaHVua3M6IFZTQnVmZmVyW10gPSBbXTtcblx0XHRsZXQgYnl0ZXNCdWZmZXJlZCA9IDA7XG5cblx0XHRsZXQgZGVjb2RlcjogSURlY29kZXJTdHJlYW0gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblxuXHRcdGNvbnN0IGNyZWF0ZURlY29kZXIgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHR0cnkge1xuXG5cdFx0XHRcdC8vIGRldGVjdCBlbmNvZGluZyBmcm9tIGJ1ZmZlclxuXHRcdFx0XHRjb25zdCBkZXRlY3RlZCA9IGF3YWl0IGRldGVjdEVuY29kaW5nRnJvbUJ1ZmZlcih7XG5cdFx0XHRcdFx0YnVmZmVyOiBWU0J1ZmZlci5jb25jYXQoYnVmZmVyZWRDaHVua3MpLFxuXHRcdFx0XHRcdGJ5dGVzUmVhZDogYnl0ZXNCdWZmZXJlZFxuXHRcdFx0XHR9LCBvcHRpb25zLmd1ZXNzRW5jb2RpbmcsIG9wdGlvbnMuY2FuZGlkYXRlR3Vlc3NFbmNvZGluZ3MpO1xuXG5cdFx0XHRcdC8vIHRocm93IGVhcmx5IGlmIHRoZSBzb3VyY2Ugc2VlbXMgYmluYXJ5IGFuZFxuXHRcdFx0XHQvLyB3ZSBhcmUgaW5zdHJ1Y3RlZCB0byBvbmx5IGFjY2VwdCB0ZXh0XG5cdFx0XHRcdGlmIChkZXRlY3RlZC5zZWVtc0JpbmFyeSAmJiBvcHRpb25zLmFjY2VwdFRleHRPbmx5KSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IERlY29kZVN0cmVhbUVycm9yKCdTdHJlYW0gaXMgYmluYXJ5IGJ1dCBvbmx5IHRleHQgaXMgYWNjZXB0ZWQgZm9yIGRlY29kaW5nJywgRGVjb2RlU3RyZWFtRXJyb3JLaW5kLlNUUkVBTV9JU19CSU5BUlkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gZW5zdXJlIHRvIHJlc3BlY3Qgb3ZlcndyaXRlIG9mIGVuY29kaW5nXG5cdFx0XHRcdGRldGVjdGVkLmVuY29kaW5nID0gYXdhaXQgb3B0aW9ucy5vdmVyd3JpdGVFbmNvZGluZyhkZXRlY3RlZC5lbmNvZGluZyk7XG5cblx0XHRcdFx0Ly8gZGVjb2RlIGFuZCB3cml0ZSBidWZmZXJlZCBjb250ZW50XG5cdFx0XHRcdGRlY29kZXIgPSBhd2FpdCBEZWNvZGVyU3RyZWFtLmNyZWF0ZShkZXRlY3RlZC5lbmNvZGluZyk7XG5cdFx0XHRcdGNvbnN0IGRlY29kZWQgPSBkZWNvZGVyLndyaXRlKFZTQnVmZmVyLmNvbmNhdChidWZmZXJlZENodW5rcykuYnVmZmVyKTtcblx0XHRcdFx0dGFyZ2V0LndyaXRlKGRlY29kZWQpO1xuXG5cdFx0XHRcdGJ1ZmZlcmVkQ2h1bmtzLmxlbmd0aCA9IDA7XG5cdFx0XHRcdGJ5dGVzQnVmZmVyZWQgPSAwO1xuXG5cdFx0XHRcdC8vIHNpZ25hbCB0byB0aGUgb3V0c2lkZSBvdXIgZGV0ZWN0ZWQgZW5jb2RpbmcgYW5kIGZpbmFsIGRlY29kZXIgc3RyZWFtXG5cdFx0XHRcdHJlc29sdmUoe1xuXHRcdFx0XHRcdHN0cmVhbTogdGFyZ2V0LFxuXHRcdFx0XHRcdGRldGVjdGVkXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblxuXHRcdFx0XHQvLyBTdG9wIGhhbmRsaW5nIGFueXRoaW5nIGZyb20gdGhlIHNvdXJjZSBhbmQgdGFyZ2V0XG5cdFx0XHRcdGN0cy5jYW5jZWwoKTtcblx0XHRcdFx0dGFyZ2V0LmRlc3Ryb3koKTtcblxuXHRcdFx0XHRyZWplY3QoZXJyb3IpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRsaXN0ZW5TdHJlYW0oc291cmNlLCB7XG5cdFx0XHRvbkRhdGE6IGFzeW5jIGNodW5rID0+IHtcblxuXHRcdFx0XHQvLyBpZiB0aGUgZGVjb2RlciBpcyByZWFkeSwgd2UganVzdCB3cml0ZSBkaXJlY3RseVxuXHRcdFx0XHRpZiAoZGVjb2Rlcikge1xuXHRcdFx0XHRcdHRhcmdldC53cml0ZShkZWNvZGVyLndyaXRlKGNodW5rLmJ1ZmZlcikpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gb3RoZXJ3aXNlIHdlIG5lZWQgdG8gYnVmZmVyIHRoZSBkYXRhIHVudGlsIHRoZSBzdHJlYW0gaXMgcmVhZHlcblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0YnVmZmVyZWRDaHVua3MucHVzaChjaHVuayk7XG5cdFx0XHRcdFx0Ynl0ZXNCdWZmZXJlZCArPSBjaHVuay5ieXRlTGVuZ3RoO1xuXG5cdFx0XHRcdFx0Ly8gYnVmZmVyZWQgZW5vdWdoIGRhdGEgZm9yIGVuY29kaW5nIGRldGVjdGlvbiwgY3JlYXRlIHN0cmVhbVxuXHRcdFx0XHRcdGlmIChieXRlc0J1ZmZlcmVkID49IG1pbkJ5dGVzUmVxdWlyZWRGb3JEZXRlY3Rpb24pIHtcblxuXHRcdFx0XHRcdFx0Ly8gcGF1c2Ugc3RyZWFtIGhlcmUgdW50aWwgdGhlIGRlY29kZXIgaXMgcmVhZHlcblx0XHRcdFx0XHRcdHNvdXJjZS5wYXVzZSgpO1xuXG5cdFx0XHRcdFx0XHRhd2FpdCBjcmVhdGVEZWNvZGVyKCk7XG5cblx0XHRcdFx0XHRcdC8vIHJlc3VtZSBzdHJlYW0gbm93IHRoYXQgZGVjb2RlciBpcyByZWFkeSBidXRcblx0XHRcdFx0XHRcdC8vIG91dHNpZGUgb2YgdGhpcyBzdGFjayB0byByZWR1Y2UgcmVjdXJzaW9uXG5cdFx0XHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHNvdXJjZS5yZXN1bWUoKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0b25FcnJvcjogZXJyb3IgPT4gdGFyZ2V0LmVycm9yKGVycm9yKSwgLy8gc2ltcGx5IGZvcndhcmQgdG8gdGFyZ2V0XG5cdFx0XHRvbkVuZDogYXN5bmMgKCkgPT4ge1xuXG5cdFx0XHRcdC8vIHdlIHdlcmUgc3RpbGwgd2FpdGluZyBmb3IgZGF0YSB0byBkbyB0aGUgZW5jb2Rpbmdcblx0XHRcdFx0Ly8gZGV0ZWN0aW9uLiB0aHVzLCB3cmFwIHVwIHN0YXJ0aW5nIHRoZSBzdHJlYW0gZXZlblxuXHRcdFx0XHQvLyB3aXRob3V0IGFsbCB0aGUgZGF0YSB0byBnZXQgdGhpbmdzIGdvaW5nXG5cdFx0XHRcdGlmICghZGVjb2Rlcikge1xuXHRcdFx0XHRcdGF3YWl0IGNyZWF0ZURlY29kZXIoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIGVuZCB0aGUgdGFyZ2V0IHdpdGggdGhlIHJlbWFpbmRlcnMgb2YgdGhlIGRlY29kZXJcblx0XHRcdFx0dGFyZ2V0LmVuZChkZWNvZGVyPy5lbmQoKSk7XG5cdFx0XHR9XG5cdFx0fSwgY3RzLnRva2VuKTtcblx0fSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB0b0VuY29kZVJlYWRhYmxlKHJlYWRhYmxlOiBSZWFkYWJsZTxzdHJpbmc+LCBlbmNvZGluZzogc3RyaW5nLCBvcHRpb25zPzogeyBhZGRCT00/OiBib29sZWFuIH0pOiBQcm9taXNlPFZTQnVmZmVyUmVhZGFibGU+IHtcblx0Y29uc3QgaWNvbnYgPSBhd2FpdCBpbXBvcnRBTUROb2RlTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0B2c2NvZGUvaWNvbnYtbGl0ZS11bWQnKT4oJ0B2c2NvZGUvaWNvbnYtbGl0ZS11bWQnLCAnbGliL2ljb252LWxpdGUtdW1kLmpzJyk7XG5cdGNvbnN0IGVuY29kZXIgPSBpY29udi5nZXRFbmNvZGVyKHRvTm9kZUVuY29kaW5nKGVuY29kaW5nKSwgb3B0aW9ucyk7XG5cblx0bGV0IGJ5dGVzV3JpdHRlbiA9IGZhbHNlO1xuXHRsZXQgZG9uZSA9IGZhbHNlO1xuXG5cdHJldHVybiB7XG5cdFx0cmVhZCgpIHtcblx0XHRcdGlmIChkb25lKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjaHVuayA9IHJlYWRhYmxlLnJlYWQoKTtcblx0XHRcdGlmICh0eXBlb2YgY2h1bmsgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGRvbmUgPSB0cnVlO1xuXG5cdFx0XHRcdC8vIElmIHdlIGFyZSBpbnN0cnVjdGVkIHRvIGFkZCBhIEJPTSBidXQgd2UgZGV0ZWN0IHRoYXQgbm9cblx0XHRcdFx0Ly8gYnl0ZXMgaGF2ZSBiZWVuIHdyaXR0ZW4sIHdlIG11c3QgZW5zdXJlIHRvIHJldHVybiB0aGUgQk9NXG5cdFx0XHRcdC8vIG91cnNlbHZlcyBzbyB0aGF0IHdlIGNvbXBseSB3aXRoIHRoZSBjb250cmFjdC5cblx0XHRcdFx0aWYgKCFieXRlc1dyaXR0ZW4gJiYgb3B0aW9ucz8uYWRkQk9NKSB7XG5cdFx0XHRcdFx0c3dpdGNoIChlbmNvZGluZykge1xuXHRcdFx0XHRcdFx0Y2FzZSBVVEY4OlxuXHRcdFx0XHRcdFx0Y2FzZSBVVEY4X3dpdGhfYm9tOlxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gVlNCdWZmZXIud3JhcChVaW50OEFycmF5LmZyb20oVVRGOF9CT00pKTtcblx0XHRcdFx0XHRcdGNhc2UgVVRGMTZiZTpcblx0XHRcdFx0XHRcdFx0cmV0dXJuIFZTQnVmZmVyLndyYXAoVWludDhBcnJheS5mcm9tKFVURjE2YmVfQk9NKSk7XG5cdFx0XHRcdFx0XHRjYXNlIFVURjE2bGU6XG5cdFx0XHRcdFx0XHRcdHJldHVybiBWU0J1ZmZlci53cmFwKFVpbnQ4QXJyYXkuZnJvbShVVEYxNmxlX0JPTSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGxlZnRvdmVycyA9IGVuY29kZXIuZW5kKCk7XG5cdFx0XHRcdGlmIChsZWZ0b3ZlcnMgJiYgbGVmdG92ZXJzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRieXRlc1dyaXR0ZW4gPSB0cnVlO1xuXG5cdFx0XHRcdFx0cmV0dXJuIFZTQnVmZmVyLndyYXAobGVmdG92ZXJzKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRieXRlc1dyaXR0ZW4gPSB0cnVlO1xuXG5cdFx0XHRyZXR1cm4gVlNCdWZmZXIud3JhcChlbmNvZGVyLndyaXRlKGNodW5rKSk7XG5cdFx0fVxuXHR9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZW5jb2RpbmdFeGlzdHMoZW5jb2Rpbmc6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRjb25zdCBpY29udiA9IGF3YWl0IGltcG9ydEFNRE5vZGVNb2R1bGU8dHlwZW9mIGltcG9ydCgnQHZzY29kZS9pY29udi1saXRlLXVtZCcpPignQHZzY29kZS9pY29udi1saXRlLXVtZCcsICdsaWIvaWNvbnYtbGl0ZS11bWQuanMnKTtcblxuXHRyZXR1cm4gaWNvbnYuZW5jb2RpbmdFeGlzdHModG9Ob2RlRW5jb2RpbmcoZW5jb2RpbmcpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRvTm9kZUVuY29kaW5nKGVuYzogc3RyaW5nIHwgbnVsbCk6IHN0cmluZyB7XG5cdGlmIChlbmMgPT09IFVURjhfd2l0aF9ib20gfHwgZW5jID09PSBudWxsKSB7XG5cdFx0cmV0dXJuIFVURjg7IC8vIGljb252IGRvZXMgbm90IGRpc3Rpbmd1aXNoIFVURiA4IHdpdGggb3Igd2l0aG91dCBCT00sIHNvIHdlIG5lZWQgdG8gaGVscCBpdFxuXHR9XG5cblx0cmV0dXJuIGVuYztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRldGVjdEVuY29kaW5nQnlCT01Gcm9tQnVmZmVyKGJ1ZmZlcjogVlNCdWZmZXIgfCBudWxsLCBieXRlc1JlYWQ6IG51bWJlcik6IHR5cGVvZiBVVEY4X3dpdGhfYm9tIHwgdHlwZW9mIFVURjE2bGUgfCB0eXBlb2YgVVRGMTZiZSB8IG51bGwge1xuXHRpZiAoIWJ1ZmZlciB8fCBieXRlc1JlYWQgPCBVVEYxNmJlX0JPTS5sZW5ndGgpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IGIwID0gYnVmZmVyLnJlYWRVSW50OCgwKTtcblx0Y29uc3QgYjEgPSBidWZmZXIucmVhZFVJbnQ4KDEpO1xuXG5cdC8vIFVURi0xNiBCRVxuXHRpZiAoYjAgPT09IFVURjE2YmVfQk9NWzBdICYmIGIxID09PSBVVEYxNmJlX0JPTVsxXSkge1xuXHRcdHJldHVybiBVVEYxNmJlO1xuXHR9XG5cblx0Ly8gVVRGLTE2IExFXG5cdGlmIChiMCA9PT0gVVRGMTZsZV9CT01bMF0gJiYgYjEgPT09IFVURjE2bGVfQk9NWzFdKSB7XG5cdFx0cmV0dXJuIFVURjE2bGU7XG5cdH1cblxuXHRpZiAoYnl0ZXNSZWFkIDwgVVRGOF9CT00ubGVuZ3RoKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCBiMiA9IGJ1ZmZlci5yZWFkVUludDgoMik7XG5cblx0Ly8gVVRGLThcblx0aWYgKGIwID09PSBVVEY4X0JPTVswXSAmJiBiMSA9PT0gVVRGOF9CT01bMV0gJiYgYjIgPT09IFVURjhfQk9NWzJdKSB7XG5cdFx0cmV0dXJuIFVURjhfd2l0aF9ib207XG5cdH1cblxuXHRyZXR1cm4gbnVsbDtcbn1cblxuLy8gd2UgZXhwbGljaXRseSBpZ25vcmUgYSBzcGVjaWZpYyBzZXQgb2YgZW5jb2RpbmdzIGZyb20gYXV0byBndWVzc2luZ1xuLy8gLSBBU0NJSTogd2UgbmV2ZXIgd2FudCB0aGlzIGVuY29kaW5nIChtb3N0IFVURi04IGZpbGVzIHdvdWxkIGhhcHBpbHkgZGV0ZWN0IGFzXG4vLyAgICAgICAgICBBU0NJSSBmaWxlcyBhbmQgdGhlbiB5b3UgY291bGQgbm90IHR5cGUgbm9uLUFTQ0lJIGNoYXJhY3RlcnMgYW55bW9yZSlcbi8vIC0gVVRGLTE2OiB3ZSBoYXZlIG91ciBvd24gZGV0ZWN0aW9uIGxvZ2ljIGZvciBVVEYtMTZcbi8vIC0gVVRGLTMyOiB3ZSBkbyBub3Qgc3VwcG9ydCB0aGlzIGVuY29kaW5nIGluIFZTQ29kZVxuY29uc3QgSUdOT1JFX0VOQ09ESU5HUyA9IFsnYXNjaWknLCAndXRmLTE2JywgJ3V0Zi0zMiddO1xuXG4vKipcbiAqIEd1ZXNzZXMgdGhlIGVuY29kaW5nIGZyb20gYnVmZmVyLlxuICovXG5hc3luYyBmdW5jdGlvbiBndWVzc0VuY29kaW5nQnlCdWZmZXIoYnVmZmVyOiBWU0J1ZmZlciwgY2FuZGlkYXRlR3Vlc3NFbmNvZGluZ3M/OiBzdHJpbmdbXSk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuXHRjb25zdCBqc2NoYXJkZXQgPSBhd2FpdCBpbXBvcnRBTUROb2RlTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ2pzY2hhcmRldCcpPignanNjaGFyZGV0JywgJ2Rpc3QvanNjaGFyZGV0Lm1pbi5qcycpO1xuXG5cdC8vIGVuc3VyZSB0byBsaW1pdCBidWZmZXIgZm9yIGd1ZXNzaW5nIGR1ZSB0byBodHRwczovL2dpdGh1Yi5jb20vYWFkc20vanNjaGFyZGV0L2lzc3Vlcy81M1xuXHRjb25zdCBsaW1pdGVkQnVmZmVyID0gYnVmZmVyLnNsaWNlKDAsIEFVVE9fRU5DT0RJTkdfR1VFU1NfTUFYX0JZVEVTKTtcblxuXHQvLyBiZWZvcmUgZ3Vlc3NpbmcganNjaGFyZGV0IGNhbGxzIHRvU3RyaW5nKCdiaW5hcnknKSBvbiBpbnB1dCBpZiBpdCBpcyBhIEJ1ZmZlcixcblx0Ly8gc2luY2Ugd2UgYXJlIHVzaW5nIGl0IGluc2lkZSBicm93c2VyIGVudmlyb25tZW50IGFzIHdlbGwgd2UgZG8gY29udmVyc2lvbiBvdXJzZWx2ZXNcblx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL2FhZHNtL2pzY2hhcmRldC9ibG9iL3YyLjEuMS9zcmMvaW5kZXguanMjTDM2LUw0MFxuXHRjb25zdCBiaW5hcnlTdHJpbmcgPSBlbmNvZGVMYXRpbjEobGltaXRlZEJ1ZmZlci5idWZmZXIpO1xuXG5cdC8vIGVuc3VyZSB0byBjb252ZXJ0IGNhbmRpZGF0ZSBlbmNvZGluZ3MgdG8ganNjaGFyZGV0IGVuY29kaW5nIG5hbWVzIGlmIHByb3ZpZGVkXG5cdGlmIChjYW5kaWRhdGVHdWVzc0VuY29kaW5ncykge1xuXHRcdGNhbmRpZGF0ZUd1ZXNzRW5jb2RpbmdzID0gY29hbGVzY2UoY2FuZGlkYXRlR3Vlc3NFbmNvZGluZ3MubWFwKGUgPT4gdG9Kc2NoYXJkZXRFbmNvZGluZyhlKSkpO1xuXHRcdGlmIChjYW5kaWRhdGVHdWVzc0VuY29kaW5ncy5sZW5ndGggPT09IDApIHtcblx0XHRcdGNhbmRpZGF0ZUd1ZXNzRW5jb2RpbmdzID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdGxldCBndWVzc2VkOiB7IGVuY29kaW5nOiBzdHJpbmcgfCB1bmRlZmluZWQgfSB8IHVuZGVmaW5lZDtcblx0dHJ5IHtcblx0XHRndWVzc2VkID0ganNjaGFyZGV0LmRldGVjdChiaW5hcnlTdHJpbmcsIGNhbmRpZGF0ZUd1ZXNzRW5jb2RpbmdzID8geyBkZXRlY3RFbmNvZGluZ3M6IGNhbmRpZGF0ZUd1ZXNzRW5jb2RpbmdzIH0gOiB1bmRlZmluZWQpO1xuXHR9IGNhdGNoIChlcnJvcikge1xuXHRcdHJldHVybiBudWxsOyAvLyBqc2NoYXJkZXQgdGhyb3dzIGZvciB1bmtub3duIGVuY29kaW5ncyAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIzOTkyOClcblx0fVxuXG5cdGlmICghZ3Vlc3NlZCB8fCAhZ3Vlc3NlZC5lbmNvZGluZykge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0Y29uc3QgZW5jID0gZ3Vlc3NlZC5lbmNvZGluZy50b0xvd2VyQ2FzZSgpO1xuXHRpZiAoMCA8PSBJR05PUkVfRU5DT0RJTkdTLmluZGV4T2YoZW5jKSkge1xuXHRcdHJldHVybiBudWxsOyAvLyBzZWUgY29tbWVudCBhYm92ZSB3aHkgd2UgaWdub3JlIHNvbWUgZW5jb2RpbmdzXG5cdH1cblxuXHRyZXR1cm4gdG9JY29udkxpdGVFbmNvZGluZyhndWVzc2VkLmVuY29kaW5nKTtcbn1cblxuY29uc3QgSlNDSEFSREVUX1RPX0lDT05WX0VOQ09ESU5HUzogeyBbbmFtZTogc3RyaW5nXTogc3RyaW5nIH0gPSB7XG5cdCdpYm04NjYnOiAnY3A4NjYnLFxuXHQnYmlnNSc6ICdjcDk1MCdcbn07XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUVuY29kaW5nKGVuY29kaW5nTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcblx0cmV0dXJuIGVuY29kaW5nTmFtZS5yZXBsYWNlKC9bXmEtekEtWjAtOV0vZywgJycpLnRvTG93ZXJDYXNlKCk7XG59XG5cbmZ1bmN0aW9uIHRvSWNvbnZMaXRlRW5jb2RpbmcoZW5jb2RpbmdOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRjb25zdCBub3JtYWxpemVkRW5jb2RpbmdOYW1lID0gbm9ybWFsaXplRW5jb2RpbmcoZW5jb2RpbmdOYW1lKTtcblx0Y29uc3QgbWFwcGVkID0gSlNDSEFSREVUX1RPX0lDT05WX0VOQ09ESU5HU1tub3JtYWxpemVkRW5jb2RpbmdOYW1lXTtcblxuXHRyZXR1cm4gbWFwcGVkIHx8IG5vcm1hbGl6ZWRFbmNvZGluZ05hbWU7XG59XG5cbmZ1bmN0aW9uIHRvSnNjaGFyZGV0RW5jb2RpbmcoZW5jb2RpbmdOYW1lOiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRjb25zdCBub3JtYWxpemVkRW5jb2RpbmdOYW1lID0gbm9ybWFsaXplRW5jb2RpbmcoZW5jb2RpbmdOYW1lKTtcblx0Y29uc3QgbWFwcGVkID0gR1VFU1NBQkxFX0VOQ09ESU5HU1tub3JtYWxpemVkRW5jb2RpbmdOYW1lXTtcblxuXHRyZXR1cm4gbWFwcGVkID8gbWFwcGVkLmd1ZXNzYWJsZU5hbWUgOiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGVuY29kZUxhdGluMShidWZmZXI6IFVpbnQ4QXJyYXkpOiBzdHJpbmcge1xuXHRsZXQgcmVzdWx0ID0gJyc7XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgYnVmZmVyLmxlbmd0aDsgaSsrKSB7XG5cdFx0cmVzdWx0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmZmVyW2ldKTtcblx0fVxuXG5cdHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogVGhlIGVuY29kaW5ncyB0aGF0IGFyZSBhbGxvd2VkIGluIGEgc2V0dGluZ3MgZmlsZSBkb24ndCBtYXRjaCB0aGUgY2Fub25pY2FsIGVuY29kaW5nIGxhYmVscyBzcGVjaWZpZWQgYnkgV0hBVFdHLlxuICogU2VlIGh0dHBzOi8vZW5jb2Rpbmcuc3BlYy53aGF0d2cub3JnLyNuYW1lcy1hbmQtbGFiZWxzXG4gKiBJY29udi1saXRlIHN0cmlwcyBhbGwgbm9uLWFscGhhbnVtZXJpYyBjaGFyYWN0ZXJzLCBidXQgcmlwZ3JlcCBkb2Vzbid0LiBGb3IgYmFja2NvbXBhdCwgYWxsb3cgdGhlc2UgbGFiZWxzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9DYW5vbmljYWxOYW1lKGVuYzogc3RyaW5nKTogc3RyaW5nIHtcblx0c3dpdGNoIChlbmMpIHtcblx0XHRjYXNlICdzaGlmdGppcyc6XG5cdFx0XHRyZXR1cm4gJ3NoaWZ0LWppcyc7XG5cdFx0Y2FzZSAndXRmMTZsZSc6XG5cdFx0XHRyZXR1cm4gJ3V0Zi0xNmxlJztcblx0XHRjYXNlICd1dGYxNmJlJzpcblx0XHRcdHJldHVybiAndXRmLTE2YmUnO1xuXHRcdGNhc2UgJ2JpZzVoa3Njcyc6XG5cdFx0XHRyZXR1cm4gJ2JpZzUtaGtzY3MnO1xuXHRcdGNhc2UgJ2V1Y2pwJzpcblx0XHRcdHJldHVybiAnZXVjLWpwJztcblx0XHRjYXNlICdldWNrcic6XG5cdFx0XHRyZXR1cm4gJ2V1Yy1rcic7XG5cdFx0Y2FzZSAna29pOHInOlxuXHRcdFx0cmV0dXJuICdrb2k4LXInO1xuXHRcdGNhc2UgJ2tvaTh1Jzpcblx0XHRcdHJldHVybiAna29pOC11Jztcblx0XHRjYXNlICdtYWNyb21hbic6XG5cdFx0XHRyZXR1cm4gJ3gtbWFjLXJvbWFuJztcblx0XHRjYXNlICd1dGY4Ym9tJzpcblx0XHRcdHJldHVybiAndXRmOCc7XG5cdFx0ZGVmYXVsdDoge1xuXHRcdFx0Y29uc3QgbSA9IGVuYy5tYXRjaCgvd2luZG93cyhcXGQrKS8pO1xuXHRcdFx0aWYgKG0pIHtcblx0XHRcdFx0cmV0dXJuICd3aW5kb3dzLScgKyBtWzFdO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZW5jO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElEZXRlY3RlZEVuY29kaW5nUmVzdWx0IHtcblx0ZW5jb2Rpbmc6IHN0cmluZyB8IG51bGw7XG5cdHNlZW1zQmluYXJ5OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElSZWFkUmVzdWx0IHtcblx0YnVmZmVyOiBWU0J1ZmZlciB8IG51bGw7XG5cdGJ5dGVzUmVhZDogbnVtYmVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0RW5jb2RpbmdGcm9tQnVmZmVyKHJlYWRSZXN1bHQ6IElSZWFkUmVzdWx0LCBhdXRvR3Vlc3NFbmNvZGluZz86IGZhbHNlLCBjYW5kaWRhdGVHdWVzc0VuY29kaW5ncz86IHN0cmluZ1tdKTogSURldGVjdGVkRW5jb2RpbmdSZXN1bHQ7XG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0RW5jb2RpbmdGcm9tQnVmZmVyKHJlYWRSZXN1bHQ6IElSZWFkUmVzdWx0LCBhdXRvR3Vlc3NFbmNvZGluZz86IGJvb2xlYW4sIGNhbmRpZGF0ZUd1ZXNzRW5jb2RpbmdzPzogc3RyaW5nW10pOiBQcm9taXNlPElEZXRlY3RlZEVuY29kaW5nUmVzdWx0PjtcbmV4cG9ydCBmdW5jdGlvbiBkZXRlY3RFbmNvZGluZ0Zyb21CdWZmZXIoeyBidWZmZXIsIGJ5dGVzUmVhZCB9OiBJUmVhZFJlc3VsdCwgYXV0b0d1ZXNzRW5jb2Rpbmc/OiBib29sZWFuLCBjYW5kaWRhdGVHdWVzc0VuY29kaW5ncz86IHN0cmluZ1tdKTogUHJvbWlzZTxJRGV0ZWN0ZWRFbmNvZGluZ1Jlc3VsdD4gfCBJRGV0ZWN0ZWRFbmNvZGluZ1Jlc3VsdCB7XG5cblx0Ly8gQWx3YXlzIGZpcnN0IGNoZWNrIGZvciBCT00gdG8gZmluZCBvdXQgYWJvdXQgZW5jb2Rpbmdcblx0bGV0IGVuY29kaW5nID0gZGV0ZWN0RW5jb2RpbmdCeUJPTUZyb21CdWZmZXIoYnVmZmVyLCBieXRlc1JlYWQpO1xuXG5cdC8vIERldGVjdCAwIGJ5dGVzIHRvIHNlZSBpZiBmaWxlIGlzIGJpbmFyeSBvciBVVEYtMTYgTEUvQkVcblx0Ly8gdW5sZXNzIHdlIGFscmVhZHkga25vdyB0aGF0IHRoaXMgZmlsZSBoYXMgYSBVVEYtMTYgZW5jb2Rpbmdcblx0bGV0IHNlZW1zQmluYXJ5ID0gZmFsc2U7XG5cdGlmIChlbmNvZGluZyAhPT0gVVRGMTZiZSAmJiBlbmNvZGluZyAhPT0gVVRGMTZsZSAmJiBidWZmZXIpIHtcblx0XHRsZXQgY291bGRCZVVURjE2TEUgPSB0cnVlOyAvLyBlLmcuIDB4QUEgMHgwMFxuXHRcdGxldCBjb3VsZEJlVVRGMTZCRSA9IHRydWU7IC8vIGUuZy4gMHgwMCAweEFBXG5cdFx0bGV0IGNvbnRhaW5zWmVyb0J5dGUgPSBmYWxzZTtcblxuXHRcdC8vIFRoaXMgaXMgYSBzaW1wbGlmaWVkIGd1ZXNzIHRvIGRldGVjdCBVVEYtMTYgQkUgb3IgTEUgYnkganVzdCBjaGVja2luZyBpZlxuXHRcdC8vIHRoZSBmaXJzdCA1MTIgYnl0ZXMgaGF2ZSB0aGUgMC1ieXRlIGF0IGEgc3BlY2lmaWMgbG9jYXRpb24uIEZvciBVVEYtMTYgTEVcblx0XHQvLyB0aGlzIHdvdWxkIGJlIHRoZSBvZGQgYnl0ZSBpbmRleCBhbmQgZm9yIFVURi0xNiBCRSB0aGUgZXZlbiBvbmUuXG5cdFx0Ly8gTm90ZTogdGhpcyBjYW4gcHJvZHVjZSBmYWxzZSBwb3NpdGl2ZXMgKGEgYmluYXJ5IGZpbGUgdGhhdCB1c2VzIGEgMi1ieXRlXG5cdFx0Ly8gZW5jb2Rpbmcgb2YgdGhlIHNhbWUgZm9ybWF0IGFzIFVURi0xNikgYW5kIGZhbHNlIG5lZ2F0aXZlcyAoYSBVVEYtMTYgZmlsZVxuXHRcdC8vIHRoYXQgaXMgdXNpbmcgNCBieXRlcyB0byBlbmNvZGUgYSBjaGFyYWN0ZXIpLlxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgYnl0ZXNSZWFkICYmIGkgPCBaRVJPX0JZVEVfREVURUNUSU9OX0JVRkZFUl9NQVhfTEVOOyBpKyspIHtcblx0XHRcdGNvbnN0IGlzRW5kaWFuID0gKGkgJSAyID09PSAxKTsgLy8gYXNzdW1lIDItYnl0ZSBzZXF1ZW5jZXMgdHlwaWNhbCBmb3IgVVRGLTE2XG5cdFx0XHRjb25zdCBpc1plcm9CeXRlID0gKGJ1ZmZlci5yZWFkVUludDgoaSkgPT09IDApO1xuXG5cdFx0XHRpZiAoaXNaZXJvQnl0ZSkge1xuXHRcdFx0XHRjb250YWluc1plcm9CeXRlID0gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gVVRGLTE2IExFOiBleHBlY3QgZS5nLiAweEFBIDB4MDBcblx0XHRcdGlmIChjb3VsZEJlVVRGMTZMRSAmJiAoaXNFbmRpYW4gJiYgIWlzWmVyb0J5dGUgfHwgIWlzRW5kaWFuICYmIGlzWmVyb0J5dGUpKSB7XG5cdFx0XHRcdGNvdWxkQmVVVEYxNkxFID0gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFVURi0xNiBCRTogZXhwZWN0IGUuZy4gMHgwMCAweEFBXG5cdFx0XHRpZiAoY291bGRCZVVURjE2QkUgJiYgKGlzRW5kaWFuICYmIGlzWmVyb0J5dGUgfHwgIWlzRW5kaWFuICYmICFpc1plcm9CeXRlKSkge1xuXHRcdFx0XHRjb3VsZEJlVVRGMTZCRSA9IGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBSZXR1cm4gaWYgdGhpcyBpcyBuZWl0aGVyIFVURjE2LUxFIG5vciBVVEYxNi1CRSBhbmQgdGh1cyB0cmVhdCBhcyBiaW5hcnlcblx0XHRcdGlmIChpc1plcm9CeXRlICYmICFjb3VsZEJlVVRGMTZMRSAmJiAhY291bGRCZVVURjE2QkUpIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSGFuZGxlIGNhc2Ugb2YgMC1ieXRlIGluY2x1ZGVkXG5cdFx0aWYgKGNvbnRhaW5zWmVyb0J5dGUpIHtcblx0XHRcdGlmIChjb3VsZEJlVVRGMTZMRSkge1xuXHRcdFx0XHRlbmNvZGluZyA9IFVURjE2bGU7XG5cdFx0XHR9IGVsc2UgaWYgKGNvdWxkQmVVVEYxNkJFKSB7XG5cdFx0XHRcdGVuY29kaW5nID0gVVRGMTZiZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHNlZW1zQmluYXJ5ID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBBdXRvIGd1ZXNzIGVuY29kaW5nIGlmIGNvbmZpZ3VyZWRcblx0aWYgKGF1dG9HdWVzc0VuY29kaW5nICYmICFzZWVtc0JpbmFyeSAmJiAhZW5jb2RpbmcgJiYgYnVmZmVyKSB7XG5cdFx0cmV0dXJuIGd1ZXNzRW5jb2RpbmdCeUJ1ZmZlcihidWZmZXIuc2xpY2UoMCwgYnl0ZXNSZWFkKSwgY2FuZGlkYXRlR3Vlc3NFbmNvZGluZ3MpLnRoZW4oZ3Vlc3NlZEVuY29kaW5nID0+IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHNlZW1zQmluYXJ5OiBmYWxzZSxcblx0XHRcdFx0ZW5jb2Rpbmc6IGd1ZXNzZWRFbmNvZGluZ1xuXHRcdFx0fTtcblx0XHR9KTtcblx0fVxuXG5cdHJldHVybiB7IHNlZW1zQmluYXJ5LCBlbmNvZGluZyB9O1xufVxuXG50eXBlIEVuY29kaW5nc01hcCA9IHsgW2VuY29kaW5nOiBzdHJpbmddOiB7IGxhYmVsTG9uZzogc3RyaW5nOyBsYWJlbFNob3J0OiBzdHJpbmc7IG9yZGVyOiBudW1iZXI7IGVuY29kZU9ubHk/OiBib29sZWFuOyBhbGlhcz86IHN0cmluZzsgZ3Vlc3NhYmxlTmFtZT86IHN0cmluZyB9IH07XG5cbmV4cG9ydCBjb25zdCBTVVBQT1JURURfRU5DT0RJTkdTOiBFbmNvZGluZ3NNYXAgPSB7XG5cdHV0Zjg6IHtcblx0XHRsYWJlbExvbmc6ICdVVEYtOCcsXG5cdFx0bGFiZWxTaG9ydDogJ1VURi04Jyxcblx0XHRvcmRlcjogMSxcblx0XHRhbGlhczogJ3V0Zjhib20nLFxuXHRcdGd1ZXNzYWJsZU5hbWU6ICdVVEYtOCdcblx0fSxcblx0dXRmOGJvbToge1xuXHRcdGxhYmVsTG9uZzogJ1VURi04IHdpdGggQk9NJyxcblx0XHRsYWJlbFNob3J0OiAnVVRGLTggd2l0aCBCT00nLFxuXHRcdGVuY29kZU9ubHk6IHRydWUsXG5cdFx0b3JkZXI6IDIsXG5cdFx0YWxpYXM6ICd1dGY4J1xuXHR9LFxuXHR1dGYxNmxlOiB7XG5cdFx0bGFiZWxMb25nOiAnVVRGLTE2IExFJyxcblx0XHRsYWJlbFNob3J0OiAnVVRGLTE2IExFJyxcblx0XHRvcmRlcjogMyxcblx0XHRndWVzc2FibGVOYW1lOiAnVVRGLTE2TEUnXG5cdH0sXG5cdHV0ZjE2YmU6IHtcblx0XHRsYWJlbExvbmc6ICdVVEYtMTYgQkUnLFxuXHRcdGxhYmVsU2hvcnQ6ICdVVEYtMTYgQkUnLFxuXHRcdG9yZGVyOiA0LFxuXHRcdGd1ZXNzYWJsZU5hbWU6ICdVVEYtMTZCRSdcblx0fSxcblx0d2luZG93czEyNTI6IHtcblx0XHRsYWJlbExvbmc6ICdXZXN0ZXJuIChXaW5kb3dzIDEyNTIpJyxcblx0XHRsYWJlbFNob3J0OiAnV2luZG93cyAxMjUyJyxcblx0XHRvcmRlcjogNSxcblx0XHRndWVzc2FibGVOYW1lOiAnd2luZG93cy0xMjUyJ1xuXHR9LFxuXHRpc284ODU5MToge1xuXHRcdGxhYmVsTG9uZzogJ1dlc3Rlcm4gKElTTyA4ODU5LTEpJyxcblx0XHRsYWJlbFNob3J0OiAnSVNPIDg4NTktMScsXG5cdFx0b3JkZXI6IDZcblx0fSxcblx0aXNvODg1OTM6IHtcblx0XHRsYWJlbExvbmc6ICdXZXN0ZXJuIChJU08gODg1OS0zKScsXG5cdFx0bGFiZWxTaG9ydDogJ0lTTyA4ODU5LTMnLFxuXHRcdG9yZGVyOiA3XG5cdH0sXG5cdGlzbzg4NTkxNToge1xuXHRcdGxhYmVsTG9uZzogJ1dlc3Rlcm4gKElTTyA4ODU5LTE1KScsXG5cdFx0bGFiZWxTaG9ydDogJ0lTTyA4ODU5LTE1Jyxcblx0XHRvcmRlcjogOFxuXHR9LFxuXHRtYWNyb21hbjoge1xuXHRcdGxhYmVsTG9uZzogJ1dlc3Rlcm4gKE1hYyBSb21hbiknLFxuXHRcdGxhYmVsU2hvcnQ6ICdNYWMgUm9tYW4nLFxuXHRcdG9yZGVyOiA5XG5cdH0sXG5cdGNwNDM3OiB7XG5cdFx0bGFiZWxMb25nOiAnRE9TIChDUCA0MzcpJyxcblx0XHRsYWJlbFNob3J0OiAnQ1A0MzcnLFxuXHRcdG9yZGVyOiAxMFxuXHR9LFxuXHR3aW5kb3dzMTI1Njoge1xuXHRcdGxhYmVsTG9uZzogJ0FyYWJpYyAoV2luZG93cyAxMjU2KScsXG5cdFx0bGFiZWxTaG9ydDogJ1dpbmRvd3MgMTI1NicsXG5cdFx0b3JkZXI6IDExXG5cdH0sXG5cdGlzbzg4NTk2OiB7XG5cdFx0bGFiZWxMb25nOiAnQXJhYmljIChJU08gODg1OS02KScsXG5cdFx0bGFiZWxTaG9ydDogJ0lTTyA4ODU5LTYnLFxuXHRcdG9yZGVyOiAxMlxuXHR9LFxuXHR3aW5kb3dzMTI1Nzoge1xuXHRcdGxhYmVsTG9uZzogJ0JhbHRpYyAoV2luZG93cyAxMjU3KScsXG5cdFx0bGFiZWxTaG9ydDogJ1dpbmRvd3MgMTI1NycsXG5cdFx0b3JkZXI6IDEzXG5cdH0sXG5cdGlzbzg4NTk0OiB7XG5cdFx0bGFiZWxMb25nOiAnQmFsdGljIChJU08gODg1OS00KScsXG5cdFx0bGFiZWxTaG9ydDogJ0lTTyA4ODU5LTQnLFxuXHRcdG9yZGVyOiAxNFxuXHR9LFxuXHRpc284ODU5MTQ6IHtcblx0XHRsYWJlbExvbmc6ICdDZWx0aWMgKElTTyA4ODU5LTE0KScsXG5cdFx0bGFiZWxTaG9ydDogJ0lTTyA4ODU5LTE0Jyxcblx0XHRvcmRlcjogMTVcblx0fSxcblx0d2luZG93czEyNTA6IHtcblx0XHRsYWJlbExvbmc6ICdDZW50cmFsIEV1cm9wZWFuIChXaW5kb3dzIDEyNTApJyxcblx0XHRsYWJlbFNob3J0OiAnV2luZG93cyAxMjUwJyxcblx0XHRvcmRlcjogMTYsXG5cdFx0Z3Vlc3NhYmxlTmFtZTogJ3dpbmRvd3MtMTI1MCdcblx0fSxcblx0aXNvODg1OTI6IHtcblx0XHRsYWJlbExvbmc6ICdDZW50cmFsIEV1cm9wZWFuIChJU08gODg1OS0yKScsXG5cdFx0bGFiZWxTaG9ydDogJ0lTTyA4ODU5LTInLFxuXHRcdG9yZGVyOiAxNyxcblx0XHRndWVzc2FibGVOYW1lOiAnSVNPLTg4NTktMidcblx0fSxcblx0Y3A4NTI6IHtcblx0XHRsYWJlbExvbmc6ICdDZW50cmFsIEV1cm9wZWFuIChDUCA4NTIpJyxcblx0XHRsYWJlbFNob3J0OiAnQ1AgODUyJyxcblx0XHRvcmRlcjogMThcblx0fSxcblx0d2luZG93czEyNTE6IHtcblx0XHRsYWJlbExvbmc6ICdDeXJpbGxpYyAoV2luZG93cyAxMjUxKScsXG5cdFx0bGFiZWxTaG9ydDogJ1dpbmRvd3MgMTI1MScsXG5cdFx0b3JkZXI6IDE5LFxuXHRcdGd1ZXNzYWJsZU5hbWU6ICd3aW5kb3dzLTEyNTEnXG5cdH0sXG5cdGNwODY2OiB7XG5cdFx0bGFiZWxMb25nOiAnQ3lyaWxsaWMgKENQIDg2NiknLFxuXHRcdGxhYmVsU2hvcnQ6ICdDUCA4NjYnLFxuXHRcdG9yZGVyOiAyMCxcblx0XHRndWVzc2FibGVOYW1lOiAnSUJNODY2J1xuXHR9LFxuXHRjcDExMjU6IHtcblx0XHRsYWJlbExvbmc6ICdDeXJpbGxpYyAoQ1AgMTEyNSknLFxuXHRcdGxhYmVsU2hvcnQ6ICdDUCAxMTI1Jyxcblx0XHRvcmRlcjogMjEsXG5cdFx0Z3Vlc3NhYmxlTmFtZTogJ0lCTTExMjUnXG5cdH0sXG5cdGlzbzg4NTk1OiB7XG5cdFx0bGFiZWxMb25nOiAnQ3lyaWxsaWMgKElTTyA4ODU5LTUpJyxcblx0XHRsYWJlbFNob3J0OiAnSVNPIDg4NTktNScsXG5cdFx0b3JkZXI6IDIyLFxuXHRcdGd1ZXNzYWJsZU5hbWU6ICdJU08tODg1OS01J1xuXHR9LFxuXHRrb2k4cjoge1xuXHRcdGxhYmVsTG9uZzogJ0N5cmlsbGljIChLT0k4LVIpJyxcblx0XHRsYWJlbFNob3J0OiAnS09JOC1SJyxcblx0XHRvcmRlcjogMjMsXG5cdFx0Z3Vlc3NhYmxlTmFtZTogJ0tPSTgtUidcblx0fSxcblx0a29pOHU6IHtcblx0XHRsYWJlbExvbmc6ICdDeXJpbGxpYyAoS09JOC1VKScsXG5cdFx0bGFiZWxTaG9ydDogJ0tPSTgtVScsXG5cdFx0b3JkZXI6IDI0XG5cdH0sXG5cdGlzbzg4NTkxMzoge1xuXHRcdGxhYmVsTG9uZzogJ0VzdG9uaWFuIChJU08gODg1OS0xMyknLFxuXHRcdGxhYmVsU2hvcnQ6ICdJU08gODg1OS0xMycsXG5cdFx0b3JkZXI6IDI1XG5cdH0sXG5cdHdpbmRvd3MxMjUzOiB7XG5cdFx0bGFiZWxMb25nOiAnR3JlZWsgKFdpbmRvd3MgMTI1MyknLFxuXHRcdGxhYmVsU2hvcnQ6ICdXaW5kb3dzIDEyNTMnLFxuXHRcdG9yZGVyOiAyNixcblx0XHRndWVzc2FibGVOYW1lOiAnd2luZG93cy0xMjUzJ1xuXHR9LFxuXHRpc284ODU5Nzoge1xuXHRcdGxhYmVsTG9uZzogJ0dyZWVrIChJU08gODg1OS03KScsXG5cdFx0bGFiZWxTaG9ydDogJ0lTTyA4ODU5LTcnLFxuXHRcdG9yZGVyOiAyNyxcblx0XHRndWVzc2FibGVOYW1lOiAnSVNPLTg4NTktNydcblx0fSxcblx0d2luZG93czEyNTU6IHtcblx0XHRsYWJlbExvbmc6ICdIZWJyZXcgKFdpbmRvd3MgMTI1NSknLFxuXHRcdGxhYmVsU2hvcnQ6ICdXaW5kb3dzIDEyNTUnLFxuXHRcdG9yZGVyOiAyOCxcblx0XHRndWVzc2FibGVOYW1lOiAnd2luZG93cy0xMjU1J1xuXHR9LFxuXHRpc284ODU5ODoge1xuXHRcdGxhYmVsTG9uZzogJ0hlYnJldyAoSVNPIDg4NTktOCknLFxuXHRcdGxhYmVsU2hvcnQ6ICdJU08gODg1OS04Jyxcblx0XHRvcmRlcjogMjksXG5cdFx0Z3Vlc3NhYmxlTmFtZTogJ0lTTy04ODU5LTgnXG5cdH0sXG5cdGlzbzg4NTkxMDoge1xuXHRcdGxhYmVsTG9uZzogJ05vcmRpYyAoSVNPIDg4NTktMTApJyxcblx0XHRsYWJlbFNob3J0OiAnSVNPIDg4NTktMTAnLFxuXHRcdG9yZGVyOiAzMFxuXHR9LFxuXHRpc284ODU5MTY6IHtcblx0XHRsYWJlbExvbmc6ICdSb21hbmlhbiAoSVNPIDg4NTktMTYpJyxcblx0XHRsYWJlbFNob3J0OiAnSVNPIDg4NTktMTYnLFxuXHRcdG9yZGVyOiAzMVxuXHR9LFxuXHR3aW5kb3dzMTI1NDoge1xuXHRcdGxhYmVsTG9uZzogJ1R1cmtpc2ggKFdpbmRvd3MgMTI1NCknLFxuXHRcdGxhYmVsU2hvcnQ6ICdXaW5kb3dzIDEyNTQnLFxuXHRcdG9yZGVyOiAzMlxuXHR9LFxuXHRpc284ODU5OToge1xuXHRcdGxhYmVsTG9uZzogJ1R1cmtpc2ggKElTTyA4ODU5LTkpJyxcblx0XHRsYWJlbFNob3J0OiAnSVNPIDg4NTktOScsXG5cdFx0b3JkZXI6IDMzXG5cdH0sXG5cdHdpbmRvd3MxMjU4OiB7XG5cdFx0bGFiZWxMb25nOiAnVmlldG5hbWVzZSAoV2luZG93cyAxMjU4KScsXG5cdFx0bGFiZWxTaG9ydDogJ1dpbmRvd3MgMTI1OCcsXG5cdFx0b3JkZXI6IDM0XG5cdH0sXG5cdGdiazoge1xuXHRcdGxhYmVsTG9uZzogJ1NpbXBsaWZpZWQgQ2hpbmVzZSAoR0JLKScsXG5cdFx0bGFiZWxTaG9ydDogJ0dCSycsXG5cdFx0b3JkZXI6IDM1XG5cdH0sXG5cdGdiMTgwMzA6IHtcblx0XHRsYWJlbExvbmc6ICdTaW1wbGlmaWVkIENoaW5lc2UgKEdCMTgwMzApJyxcblx0XHRsYWJlbFNob3J0OiAnR0IxODAzMCcsXG5cdFx0b3JkZXI6IDM2XG5cdH0sXG5cdGNwOTUwOiB7XG5cdFx0bGFiZWxMb25nOiAnVHJhZGl0aW9uYWwgQ2hpbmVzZSAoQmlnNSknLFxuXHRcdGxhYmVsU2hvcnQ6ICdCaWc1Jyxcblx0XHRvcmRlcjogMzcsXG5cdFx0Z3Vlc3NhYmxlTmFtZTogJ0JpZzUnXG5cdH0sXG5cdGJpZzVoa3Njczoge1xuXHRcdGxhYmVsTG9uZzogJ1RyYWRpdGlvbmFsIENoaW5lc2UgKEJpZzUtSEtTQ1MpJyxcblx0XHRsYWJlbFNob3J0OiAnQmlnNS1IS1NDUycsXG5cdFx0b3JkZXI6IDM4XG5cdH0sXG5cdHNoaWZ0amlzOiB7XG5cdFx0bGFiZWxMb25nOiAnSmFwYW5lc2UgKFNoaWZ0IEpJUyknLFxuXHRcdGxhYmVsU2hvcnQ6ICdTaGlmdCBKSVMnLFxuXHRcdG9yZGVyOiAzOSxcblx0XHRndWVzc2FibGVOYW1lOiAnU0hJRlRfSklTJ1xuXHR9LFxuXHRldWNqcDoge1xuXHRcdGxhYmVsTG9uZzogJ0phcGFuZXNlIChFVUMtSlApJyxcblx0XHRsYWJlbFNob3J0OiAnRVVDLUpQJyxcblx0XHRvcmRlcjogNDAsXG5cdFx0Z3Vlc3NhYmxlTmFtZTogJ0VVQy1KUCdcblx0fSxcblx0ZXVja3I6IHtcblx0XHRsYWJlbExvbmc6ICdLb3JlYW4gKEVVQy1LUiknLFxuXHRcdGxhYmVsU2hvcnQ6ICdFVUMtS1InLFxuXHRcdG9yZGVyOiA0MSxcblx0XHRndWVzc2FibGVOYW1lOiAnRVVDLUtSJ1xuXHR9LFxuXHR3aW5kb3dzODc0OiB7XG5cdFx0bGFiZWxMb25nOiAnVGhhaSAoV2luZG93cyA4NzQpJyxcblx0XHRsYWJlbFNob3J0OiAnV2luZG93cyA4NzQnLFxuXHRcdG9yZGVyOiA0MlxuXHR9LFxuXHRpc284ODU5MTE6IHtcblx0XHRsYWJlbExvbmc6ICdMYXRpbi9UaGFpIChJU08gODg1OS0xMSknLFxuXHRcdGxhYmVsU2hvcnQ6ICdJU08gODg1OS0xMScsXG5cdFx0b3JkZXI6IDQzXG5cdH0sXG5cdGtvaThydToge1xuXHRcdGxhYmVsTG9uZzogJ0N5cmlsbGljIChLT0k4LVJVKScsXG5cdFx0bGFiZWxTaG9ydDogJ0tPSTgtUlUnLFxuXHRcdG9yZGVyOiA0NFxuXHR9LFxuXHRrb2k4dDoge1xuXHRcdGxhYmVsTG9uZzogJ1RhamlrIChLT0k4LVQpJyxcblx0XHRsYWJlbFNob3J0OiAnS09JOC1UJyxcblx0XHRvcmRlcjogNDVcblx0fSxcblx0Z2IyMzEyOiB7XG5cdFx0bGFiZWxMb25nOiAnU2ltcGxpZmllZCBDaGluZXNlIChHQiAyMzEyKScsXG5cdFx0bGFiZWxTaG9ydDogJ0dCIDIzMTInLFxuXHRcdG9yZGVyOiA0Nixcblx0XHRndWVzc2FibGVOYW1lOiAnR0IyMzEyJ1xuXHR9LFxuXHRjcDg2NToge1xuXHRcdGxhYmVsTG9uZzogJ05vcmRpYyBET1MgKENQIDg2NSknLFxuXHRcdGxhYmVsU2hvcnQ6ICdDUCA4NjUnLFxuXHRcdG9yZGVyOiA0N1xuXHR9LFxuXHRjcDg1MDoge1xuXHRcdGxhYmVsTG9uZzogJ1dlc3Rlcm4gRXVyb3BlYW4gRE9TIChDUCA4NTApJyxcblx0XHRsYWJlbFNob3J0OiAnQ1AgODUwJyxcblx0XHRvcmRlcjogNDhcblx0fVxufTtcblxuZXhwb3J0IGNvbnN0IEdVRVNTQUJMRV9FTkNPRElOR1M6IEVuY29kaW5nc01hcCA9ICgoKSA9PiB7XG5cdGNvbnN0IGd1ZXNzYWJsZUVuY29kaW5nczogRW5jb2RpbmdzTWFwID0ge307XG5cdGZvciAoY29uc3QgZW5jb2RpbmcgaW4gU1VQUE9SVEVEX0VOQ09ESU5HUykge1xuXHRcdGlmIChTVVBQT1JURURfRU5DT0RJTkdTW2VuY29kaW5nXS5ndWVzc2FibGVOYW1lKSB7XG5cdFx0XHRndWVzc2FibGVFbmNvZGluZ3NbZW5jb2RpbmddID0gU1VQUE9SVEVEX0VOQ09ESU5HU1tlbmNvZGluZ107XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGd1ZXNzYWJsZUVuY29kaW5ncztcbn0pKCk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFtQyxvQkFBb0Isb0JBQW9CO0FBQzNFLFNBQVMsZ0JBQTBEO0FBQ25FLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsZ0JB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QSxFQUNBLFNBQVM7QUFBQSxJQUNSLFdBQVc7QUFBQSxJQUNYLFlBQVk7QUFBQSxJQUNaLE9BQU87QUFBQSxFQUNSO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTixXQUFXO0FBQUEsSUFDWCxZQUFZO0FBQUEsSUFDWixPQUFPO0FBQUEsSUFDUCxlQUFlO0FBQUEsRUFDaEI7QUFBQSxFQUNBLFdBQVc7QUFBQSxJQUNWLFdBQVc7QUFBQSxJQUNYLFlBQVk7QUFBQSxJQUNaLE9BQU87QUFBQSxFQUNSO0FBQUEsRUFDQSxVQUFVO0FBQUEsSUFDVCxXQUFXO0FBQUEsSUFDWCxZQUFZO0FBQUEsSUFDWixPQUFPO0FBQUEsSUFDUCxlQUFlO0FBQUEsRUFDaEI7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNOLFdBQVc7QUFBQSxJQUNYLFlBQVk7QUFBQSxJQUNaLE9BQU87QUFBQSxJQUNQLGVBQWU7QUFBQSxFQUNoQjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ04sV0FBVztBQUFBLElBQ1gsWUFBWTtBQUFBLElBQ1osT0FBTztBQUFBLElBQ1AsZUFBZTtBQUFBLEVBQ2hCO0FBQUEsRUFDQSxZQUFZO0FBQUEsSUFDWCxXQUFXO0FBQUEsSUFDWCxZQUFZO0FBQUEsSUFDWixPQUFPO0FBQUEsRUFDUjtBQUFBLEVBQ0EsV0FBVztBQUFBLElBQ1YsV0FBVztBQUFBLElBQ1gsWUFBWTtBQUFBLElBQ1osT0FBTztBQUFBLEVBQ1I7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNQLFdBQVc7QUFBQSxJQUNYLFlBQVk7QUFBQSxJQUNaLE9BQU87QUFBQSxFQUNSO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTixXQUFXO0FBQUEsSUFDWCxZQUFZO0FBQUEsSUFDWixPQUFPO0FBQUEsRUFDUjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ1AsV0FBVztBQUFBLElBQ1gsWUFBWTtBQUFBLElBQ1osT0FBTztBQUFBLElBQ1AsZUFBZTtBQUFBLEVBQ2hCO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTixXQUFXO0FBQUEsSUFDWCxZQUFZO0FBQUEsSUFDWixPQUFPO0FBQUEsRUFDUjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ04sV0FBVztBQUFBLElBQ1gsWUFBWTtBQUFBLElBQ1osT0FBTztBQUFBLEVBQ1I7QUFDRDtBQUVPLE1BQU0sdUJBQXFDLE1BQU07QUFDdkQsUUFBTSxxQkFBbUMsQ0FBQztBQUMxQyxhQUFXLFlBQVkscUJBQXFCO0FBQzNDLFFBQUksb0JBQW9CLFFBQVEsRUFBRSxlQUFlO0FBQ2hELHlCQUFtQixRQUFRLElBQUksb0JBQW9CLFFBQVE7QUFBQSxJQUM1RDtBQUFBLEVBQ0Q7QUFFQSxTQUFPO0FBQ1IsR0FBRzsiLAogICJuYW1lcyI6IFsiRGVjb2RlU3RyZWFtRXJyb3JLaW5kIl0KfQo=
