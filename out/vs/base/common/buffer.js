import { Lazy } from "./lazy.js";
import * as streams from "./stream.js";
const hasBuffer = typeof Buffer !== "undefined";
const indexOfTable = new Lazy(() => new Uint8Array(256));
let textEncoder;
let textDecoder;
class VSBuffer {
  /**
   * When running in a nodejs context, the backing store for the returned `VSBuffer` instance
   * might use a nodejs Buffer allocated from node's Buffer pool, which is not transferrable.
   */
  static alloc(byteLength) {
    if (hasBuffer) {
      return new VSBuffer(Buffer.allocUnsafe(byteLength));
    } else {
      return new VSBuffer(new Uint8Array(byteLength));
    }
  }
  /**
   * When running in a nodejs context, if `actual` is not a nodejs Buffer, the backing store for
   * the returned `VSBuffer` instance might use a nodejs Buffer allocated from node's Buffer pool,
   * which is not transferrable.
   */
  static wrap(actual) {
    if (hasBuffer && !Buffer.isBuffer(actual)) {
      actual = Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength);
    }
    return new VSBuffer(actual);
  }
  /**
   * When running in a nodejs context, the backing store for the returned `VSBuffer` instance
   * might use a nodejs Buffer allocated from node's Buffer pool, which is not transferrable.
   */
  static fromString(source, options) {
    const dontUseNodeBuffer = options?.dontUseNodeBuffer || false;
    if (!dontUseNodeBuffer && hasBuffer) {
      return new VSBuffer(Buffer.from(source));
    } else {
      if (!textEncoder) {
        textEncoder = new TextEncoder();
      }
      return new VSBuffer(textEncoder.encode(source));
    }
  }
  /**
   * When running in a nodejs context, the backing store for the returned `VSBuffer` instance
   * might use a nodejs Buffer allocated from node's Buffer pool, which is not transferrable.
   */
  static fromByteArray(source) {
    const result = VSBuffer.alloc(source.length);
    for (let i = 0, len = source.length; i < len; i++) {
      result.buffer[i] = source[i];
    }
    return result;
  }
  /**
   * When running in a nodejs context, the backing store for the returned `VSBuffer` instance
   * might use a nodejs Buffer allocated from node's Buffer pool, which is not transferrable.
   */
  static concat(buffers, totalLength) {
    if (typeof totalLength === "undefined") {
      totalLength = 0;
      for (let i = 0, len = buffers.length; i < len; i++) {
        totalLength += buffers[i].byteLength;
      }
    }
    const ret = VSBuffer.alloc(totalLength);
    let offset = 0;
    for (let i = 0, len = buffers.length; i < len; i++) {
      const element = buffers[i];
      ret.set(element, offset);
      offset += element.byteLength;
    }
    return ret;
  }
  constructor(buffer) {
    this.buffer = buffer;
    this.byteLength = this.buffer.byteLength;
  }
  /**
   * When running in a nodejs context, the backing store for the returned `VSBuffer` instance
   * might use a nodejs Buffer allocated from node's Buffer pool, which is not transferrable.
   */
  clone() {
    const result = VSBuffer.alloc(this.byteLength);
    result.set(this);
    return result;
  }
  toString() {
    if (hasBuffer) {
      return this.buffer.toString();
    } else {
      if (!textDecoder) {
        textDecoder = new TextDecoder();
      }
      return textDecoder.decode(this.buffer);
    }
  }
  slice(start, end) {
    return new VSBuffer(this.buffer.subarray(start, end));
  }
  set(array, offset) {
    if (array instanceof VSBuffer) {
      this.buffer.set(array.buffer, offset);
    } else if (array instanceof Uint8Array) {
      this.buffer.set(array, offset);
    } else if (array instanceof ArrayBuffer) {
      this.buffer.set(new Uint8Array(array), offset);
    } else if (ArrayBuffer.isView(array)) {
      this.buffer.set(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), offset);
    } else {
      throw new Error(`Unknown argument 'array'`);
    }
  }
  readUInt32BE(offset) {
    return readUInt32BE(this.buffer, offset);
  }
  writeUInt32BE(value, offset) {
    writeUInt32BE(this.buffer, value, offset);
  }
  readUInt32LE(offset) {
    return readUInt32LE(this.buffer, offset);
  }
  writeUInt32LE(value, offset) {
    writeUInt32LE(this.buffer, value, offset);
  }
  readUInt8(offset) {
    return readUInt8(this.buffer, offset);
  }
  writeUInt8(value, offset) {
    writeUInt8(this.buffer, value, offset);
  }
  indexOf(subarray, offset = 0) {
    return binaryIndexOf(this.buffer, subarray instanceof VSBuffer ? subarray.buffer : subarray, offset);
  }
  equals(other) {
    if (this === other) {
      return true;
    }
    if (this.byteLength !== other.byteLength) {
      return false;
    }
    return this.buffer.every((value, index) => value === other.buffer[index]);
  }
}
function binaryIndexOf(haystack, needle, offset = 0) {
  const needleLen = needle.byteLength;
  const haystackLen = haystack.byteLength;
  if (needleLen === 0) {
    return 0;
  }
  if (needleLen === 1) {
    return haystack.indexOf(needle[0]);
  }
  if (needleLen > haystackLen - offset) {
    return -1;
  }
  const table = indexOfTable.value;
  table.fill(needle.length);
  for (let i2 = 0; i2 < needle.length; i2++) {
    table[needle[i2]] = needle.length - i2 - 1;
  }
  let i = offset + needle.length - 1;
  let j = i;
  let result = -1;
  while (i < haystackLen) {
    if (haystack[i] === needle[j]) {
      if (j === 0) {
        result = i;
        break;
      }
      i--;
      j--;
    } else {
      i += Math.max(needle.length - j, table[haystack[i]]);
      j = needle.length - 1;
    }
  }
  return result;
}
function readUInt16LE(source, offset) {
  return source[offset + 0] << 0 >>> 0 | source[offset + 1] << 8 >>> 0;
}
function writeUInt16LE(destination, value, offset) {
  destination[offset + 0] = value & 255;
  value = value >>> 8;
  destination[offset + 1] = value & 255;
}
function readUInt32BE(source, offset) {
  return source[offset] * 2 ** 24 + source[offset + 1] * 2 ** 16 + source[offset + 2] * 2 ** 8 + source[offset + 3];
}
function writeUInt32BE(destination, value, offset) {
  destination[offset + 3] = value;
  value = value >>> 8;
  destination[offset + 2] = value;
  value = value >>> 8;
  destination[offset + 1] = value;
  value = value >>> 8;
  destination[offset] = value;
}
function readUInt32LE(source, offset) {
  return source[offset + 0] << 0 >>> 0 | source[offset + 1] << 8 >>> 0 | source[offset + 2] << 16 >>> 0 | source[offset + 3] << 24 >>> 0;
}
function writeUInt32LE(destination, value, offset) {
  destination[offset + 0] = value & 255;
  value = value >>> 8;
  destination[offset + 1] = value & 255;
  value = value >>> 8;
  destination[offset + 2] = value & 255;
  value = value >>> 8;
  destination[offset + 3] = value & 255;
}
function readUInt8(source, offset) {
  return source[offset];
}
function writeUInt8(destination, value, offset) {
  destination[offset] = value;
}
function readableToBuffer(readable) {
  return streams.consumeReadable(readable, (chunks) => VSBuffer.concat(chunks));
}
function bufferToReadable(buffer) {
  return streams.toReadable(buffer);
}
function streamToBuffer(stream) {
  return streams.consumeStream(stream, (chunks) => VSBuffer.concat(chunks));
}
async function bufferedStreamToBuffer(bufferedStream) {
  if (bufferedStream.ended) {
    return VSBuffer.concat(bufferedStream.buffer);
  }
  return VSBuffer.concat([
    // Include already read chunks...
    ...bufferedStream.buffer,
    // ...and all additional chunks
    await streamToBuffer(bufferedStream.stream)
  ]);
}
function bufferToStream(buffer) {
  return streams.toStream(buffer, (chunks) => VSBuffer.concat(chunks));
}
function streamToBufferReadableStream(stream) {
  return streams.transform(stream, { data: (data) => typeof data === "string" ? VSBuffer.fromString(data) : VSBuffer.wrap(data) }, (chunks) => VSBuffer.concat(chunks));
}
function newWriteableBufferStream(options) {
  return streams.newWriteableStream((chunks) => VSBuffer.concat(chunks), options);
}
function prefixedBufferReadable(prefix, readable) {
  return streams.prefixedReadable(prefix, readable, (chunks) => VSBuffer.concat(chunks));
}
function prefixedBufferStream(prefix, stream) {
  return streams.prefixedStream(prefix, stream, (chunks) => VSBuffer.concat(chunks));
}
function decodeBase64(encoded) {
  let building = 0;
  let remainder = 0;
  let bufi = 0;
  const buffer = new Uint8Array(Math.floor(encoded.length / 4 * 3));
  const append = (value) => {
    switch (remainder) {
      case 3:
        buffer[bufi++] = building | value;
        remainder = 0;
        break;
      case 2:
        buffer[bufi++] = building | value >>> 2;
        building = value << 6;
        remainder = 3;
        break;
      case 1:
        buffer[bufi++] = building | value >>> 4;
        building = value << 4;
        remainder = 2;
        break;
      default:
        building = value << 2;
        remainder = 1;
    }
  };
  for (let i = 0; i < encoded.length; i++) {
    const code = encoded.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      append(code - 65);
    } else if (code >= 97 && code <= 122) {
      append(code - 97 + 26);
    } else if (code >= 48 && code <= 57) {
      append(code - 48 + 52);
    } else if (code === 43 || code === 45) {
      append(62);
    } else if (code === 47 || code === 95) {
      append(63);
    } else if (code === 61) {
      break;
    } else {
      throw new SyntaxError(`Unexpected base64 character ${encoded[i]}`);
    }
  }
  const unpadded = bufi;
  while (remainder > 0) {
    append(0);
  }
  return VSBuffer.wrap(buffer).slice(0, unpadded);
}
const base64Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const base64UrlSafeAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function encodeBase64({ buffer }, padded = true, urlSafe = false) {
  const dictionary = urlSafe ? base64UrlSafeAlphabet : base64Alphabet;
  let output = "";
  const remainder = buffer.byteLength % 3;
  let i = 0;
  for (; i < buffer.byteLength - remainder; i += 3) {
    const a = buffer[i + 0];
    const b = buffer[i + 1];
    const c = buffer[i + 2];
    output += dictionary[a >>> 2];
    output += dictionary[(a << 4 | b >>> 4) & 63];
    output += dictionary[(b << 2 | c >>> 6) & 63];
    output += dictionary[c & 63];
  }
  if (remainder === 1) {
    const a = buffer[i + 0];
    output += dictionary[a >>> 2];
    output += dictionary[a << 4 & 63];
    if (padded) {
      output += "==";
    }
  } else if (remainder === 2) {
    const a = buffer[i + 0];
    const b = buffer[i + 1];
    output += dictionary[a >>> 2];
    output += dictionary[(a << 4 | b >>> 4) & 63];
    output += dictionary[b << 2 & 63];
    if (padded) {
      output += "=";
    }
  }
  return output;
}
export {
  VSBuffer,
  binaryIndexOf,
  bufferToReadable,
  bufferToStream,
  bufferedStreamToBuffer,
  decodeBase64,
  encodeBase64,
  newWriteableBufferStream,
  prefixedBufferReadable,
  prefixedBufferStream,
  readUInt16LE,
  readUInt32BE,
  readUInt32LE,
  readUInt8,
  readableToBuffer,
  streamToBuffer,
  streamToBufferReadableStream,
  writeUInt16LE,
  writeUInt32BE,
  writeUInt32LE,
  writeUInt8
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9idWZmZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBMYXp5IH0gZnJvbSAnLi9sYXp5LmpzJztcbmltcG9ydCAqIGFzIHN0cmVhbXMgZnJvbSAnLi9zdHJlYW0uanMnO1xuXG5kZWNsYXJlIGNvbnN0IEJ1ZmZlcjogYW55O1xuXG5jb25zdCBoYXNCdWZmZXIgPSAodHlwZW9mIEJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcpO1xuY29uc3QgaW5kZXhPZlRhYmxlID0gbmV3IExhenkoKCkgPT4gbmV3IFVpbnQ4QXJyYXkoMjU2KSk7XG5cbmxldCB0ZXh0RW5jb2RlcjogVGV4dEVuY29kZXIgfCBudWxsO1xubGV0IHRleHREZWNvZGVyOiBUZXh0RGVjb2RlciB8IG51bGw7XG5cbmV4cG9ydCBjbGFzcyBWU0J1ZmZlciB7XG5cblx0LyoqXG5cdCAqIFdoZW4gcnVubmluZyBpbiBhIG5vZGVqcyBjb250ZXh0LCB0aGUgYmFja2luZyBzdG9yZSBmb3IgdGhlIHJldHVybmVkIGBWU0J1ZmZlcmAgaW5zdGFuY2Vcblx0ICogbWlnaHQgdXNlIGEgbm9kZWpzIEJ1ZmZlciBhbGxvY2F0ZWQgZnJvbSBub2RlJ3MgQnVmZmVyIHBvb2wsIHdoaWNoIGlzIG5vdCB0cmFuc2ZlcnJhYmxlLlxuXHQgKi9cblx0c3RhdGljIGFsbG9jKGJ5dGVMZW5ndGg6IG51bWJlcik6IFZTQnVmZmVyIHtcblx0XHRpZiAoaGFzQnVmZmVyKSB7XG5cdFx0XHRyZXR1cm4gbmV3IFZTQnVmZmVyKEJ1ZmZlci5hbGxvY1Vuc2FmZShieXRlTGVuZ3RoKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBuZXcgVlNCdWZmZXIobmV3IFVpbnQ4QXJyYXkoYnl0ZUxlbmd0aCkpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBXaGVuIHJ1bm5pbmcgaW4gYSBub2RlanMgY29udGV4dCwgaWYgYGFjdHVhbGAgaXMgbm90IGEgbm9kZWpzIEJ1ZmZlciwgdGhlIGJhY2tpbmcgc3RvcmUgZm9yXG5cdCAqIHRoZSByZXR1cm5lZCBgVlNCdWZmZXJgIGluc3RhbmNlIG1pZ2h0IHVzZSBhIG5vZGVqcyBCdWZmZXIgYWxsb2NhdGVkIGZyb20gbm9kZSdzIEJ1ZmZlciBwb29sLFxuXHQgKiB3aGljaCBpcyBub3QgdHJhbnNmZXJyYWJsZS5cblx0ICovXG5cdHN0YXRpYyB3cmFwKGFjdHVhbDogVWludDhBcnJheSk6IFZTQnVmZmVyIHtcblx0XHRpZiAoaGFzQnVmZmVyICYmICEoQnVmZmVyLmlzQnVmZmVyKGFjdHVhbCkpKSB7XG5cdFx0XHQvLyBodHRwczovL25vZGVqcy5vcmcvZGlzdC9sYXRlc3QtdjEwLngvZG9jcy9hcGkvYnVmZmVyLmh0bWwjYnVmZmVyX2NsYXNzX21ldGhvZF9idWZmZXJfZnJvbV9hcnJheWJ1ZmZlcl9ieXRlb2Zmc2V0X2xlbmd0aFxuXHRcdFx0Ly8gQ3JlYXRlIGEgemVyby1jb3B5IEJ1ZmZlciB3cmFwcGVyIGFyb3VuZCB0aGUgQXJyYXlCdWZmZXIgcG9pbnRlZCB0byBieSB0aGUgVWludDhBcnJheVxuXHRcdFx0YWN0dWFsID0gQnVmZmVyLmZyb20oYWN0dWFsLmJ1ZmZlciwgYWN0dWFsLmJ5dGVPZmZzZXQsIGFjdHVhbC5ieXRlTGVuZ3RoKTtcblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBWU0J1ZmZlcihhY3R1YWwpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFdoZW4gcnVubmluZyBpbiBhIG5vZGVqcyBjb250ZXh0LCB0aGUgYmFja2luZyBzdG9yZSBmb3IgdGhlIHJldHVybmVkIGBWU0J1ZmZlcmAgaW5zdGFuY2Vcblx0ICogbWlnaHQgdXNlIGEgbm9kZWpzIEJ1ZmZlciBhbGxvY2F0ZWQgZnJvbSBub2RlJ3MgQnVmZmVyIHBvb2wsIHdoaWNoIGlzIG5vdCB0cmFuc2ZlcnJhYmxlLlxuXHQgKi9cblx0c3RhdGljIGZyb21TdHJpbmcoc291cmNlOiBzdHJpbmcsIG9wdGlvbnM/OiB7IGRvbnRVc2VOb2RlQnVmZmVyPzogYm9vbGVhbiB9KTogVlNCdWZmZXIge1xuXHRcdGNvbnN0IGRvbnRVc2VOb2RlQnVmZmVyID0gb3B0aW9ucz8uZG9udFVzZU5vZGVCdWZmZXIgfHwgZmFsc2U7XG5cdFx0aWYgKCFkb250VXNlTm9kZUJ1ZmZlciAmJiBoYXNCdWZmZXIpIHtcblx0XHRcdHJldHVybiBuZXcgVlNCdWZmZXIoQnVmZmVyLmZyb20oc291cmNlKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICghdGV4dEVuY29kZXIpIHtcblx0XHRcdFx0dGV4dEVuY29kZXIgPSBuZXcgVGV4dEVuY29kZXIoKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBuZXcgVlNCdWZmZXIodGV4dEVuY29kZXIuZW5jb2RlKHNvdXJjZSkpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBXaGVuIHJ1bm5pbmcgaW4gYSBub2RlanMgY29udGV4dCwgdGhlIGJhY2tpbmcgc3RvcmUgZm9yIHRoZSByZXR1cm5lZCBgVlNCdWZmZXJgIGluc3RhbmNlXG5cdCAqIG1pZ2h0IHVzZSBhIG5vZGVqcyBCdWZmZXIgYWxsb2NhdGVkIGZyb20gbm9kZSdzIEJ1ZmZlciBwb29sLCB3aGljaCBpcyBub3QgdHJhbnNmZXJyYWJsZS5cblx0ICovXG5cdHN0YXRpYyBmcm9tQnl0ZUFycmF5KHNvdXJjZTogbnVtYmVyW10pOiBWU0J1ZmZlciB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gVlNCdWZmZXIuYWxsb2Moc291cmNlLmxlbmd0aCk7XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHNvdXJjZS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0cmVzdWx0LmJ1ZmZlcltpXSA9IHNvdXJjZVtpXTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdC8qKlxuXHQgKiBXaGVuIHJ1bm5pbmcgaW4gYSBub2RlanMgY29udGV4dCwgdGhlIGJhY2tpbmcgc3RvcmUgZm9yIHRoZSByZXR1cm5lZCBgVlNCdWZmZXJgIGluc3RhbmNlXG5cdCAqIG1pZ2h0IHVzZSBhIG5vZGVqcyBCdWZmZXIgYWxsb2NhdGVkIGZyb20gbm9kZSdzIEJ1ZmZlciBwb29sLCB3aGljaCBpcyBub3QgdHJhbnNmZXJyYWJsZS5cblx0ICovXG5cdHN0YXRpYyBjb25jYXQoYnVmZmVyczogVlNCdWZmZXJbXSwgdG90YWxMZW5ndGg/OiBudW1iZXIpOiBWU0J1ZmZlciB7XG5cdFx0aWYgKHR5cGVvZiB0b3RhbExlbmd0aCA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHRvdGFsTGVuZ3RoID0gMDtcblx0XHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBidWZmZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdHRvdGFsTGVuZ3RoICs9IGJ1ZmZlcnNbaV0uYnl0ZUxlbmd0aDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCByZXQgPSBWU0J1ZmZlci5hbGxvYyh0b3RhbExlbmd0aCk7XG5cdFx0bGV0IG9mZnNldCA9IDA7XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGJ1ZmZlcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGVsZW1lbnQgPSBidWZmZXJzW2ldO1xuXHRcdFx0cmV0LnNldChlbGVtZW50LCBvZmZzZXQpO1xuXHRcdFx0b2Zmc2V0ICs9IGVsZW1lbnQuYnl0ZUxlbmd0aDtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmV0O1xuXHR9XG5cblx0cmVhZG9ubHkgYnVmZmVyOiBVaW50OEFycmF5O1xuXHRyZWFkb25seSBieXRlTGVuZ3RoOiBudW1iZXI7XG5cblx0cHJpdmF0ZSBjb25zdHJ1Y3RvcihidWZmZXI6IFVpbnQ4QXJyYXkpIHtcblx0XHR0aGlzLmJ1ZmZlciA9IGJ1ZmZlcjtcblx0XHR0aGlzLmJ5dGVMZW5ndGggPSB0aGlzLmJ1ZmZlci5ieXRlTGVuZ3RoO1xuXHR9XG5cblx0LyoqXG5cdCAqIFdoZW4gcnVubmluZyBpbiBhIG5vZGVqcyBjb250ZXh0LCB0aGUgYmFja2luZyBzdG9yZSBmb3IgdGhlIHJldHVybmVkIGBWU0J1ZmZlcmAgaW5zdGFuY2Vcblx0ICogbWlnaHQgdXNlIGEgbm9kZWpzIEJ1ZmZlciBhbGxvY2F0ZWQgZnJvbSBub2RlJ3MgQnVmZmVyIHBvb2wsIHdoaWNoIGlzIG5vdCB0cmFuc2ZlcnJhYmxlLlxuXHQgKi9cblx0Y2xvbmUoKTogVlNCdWZmZXIge1xuXHRcdGNvbnN0IHJlc3VsdCA9IFZTQnVmZmVyLmFsbG9jKHRoaXMuYnl0ZUxlbmd0aCk7XG5cdFx0cmVzdWx0LnNldCh0aGlzKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0dG9TdHJpbmcoKTogc3RyaW5nIHtcblx0XHRpZiAoaGFzQnVmZmVyKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5idWZmZXIudG9TdHJpbmcoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKCF0ZXh0RGVjb2Rlcikge1xuXHRcdFx0XHR0ZXh0RGVjb2RlciA9IG5ldyBUZXh0RGVjb2RlcigpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRleHREZWNvZGVyLmRlY29kZSh0aGlzLmJ1ZmZlcik7XG5cdFx0fVxuXHR9XG5cblx0c2xpY2Uoc3RhcnQ/OiBudW1iZXIsIGVuZD86IG51bWJlcik6IFZTQnVmZmVyIHtcblx0XHQvLyBJTVBPUlRBTlQ6IHVzZSBzdWJhcnJheSBpbnN0ZWFkIG9mIHNsaWNlIGJlY2F1c2UgVHlwZWRBcnJheSNzbGljZVxuXHRcdC8vIGNyZWF0ZXMgc2hhbGxvdyBjb3B5IGFuZCBOb2RlQnVmZmVyI3NsaWNlIGRvZXNuJ3QuIFRoZSB1c2Ugb2Ygc3ViYXJyYXlcblx0XHQvLyBlbnN1cmVzIHRoZSBzYW1lLCBwZXJmb3JtYW5jZSwgYmVoYXZpb3VyLlxuXHRcdHJldHVybiBuZXcgVlNCdWZmZXIodGhpcy5idWZmZXIuc3ViYXJyYXkoc3RhcnQsIGVuZCkpO1xuXHR9XG5cblx0c2V0KGFycmF5OiBWU0J1ZmZlciwgb2Zmc2V0PzogbnVtYmVyKTogdm9pZDtcblx0c2V0KGFycmF5OiBVaW50OEFycmF5LCBvZmZzZXQ/OiBudW1iZXIpOiB2b2lkO1xuXHRzZXQoYXJyYXk6IEFycmF5QnVmZmVyLCBvZmZzZXQ/OiBudW1iZXIpOiB2b2lkO1xuXHRzZXQoYXJyYXk6IEFycmF5QnVmZmVyVmlldywgb2Zmc2V0PzogbnVtYmVyKTogdm9pZDtcblx0c2V0KGFycmF5OiBWU0J1ZmZlciB8IFVpbnQ4QXJyYXkgfCBBcnJheUJ1ZmZlciB8IEFycmF5QnVmZmVyVmlldywgb2Zmc2V0PzogbnVtYmVyKTogdm9pZDtcblx0c2V0KGFycmF5OiBWU0J1ZmZlciB8IFVpbnQ4QXJyYXkgfCBBcnJheUJ1ZmZlciB8IEFycmF5QnVmZmVyVmlldywgb2Zmc2V0PzogbnVtYmVyKTogdm9pZCB7XG5cdFx0aWYgKGFycmF5IGluc3RhbmNlb2YgVlNCdWZmZXIpIHtcblx0XHRcdHRoaXMuYnVmZmVyLnNldChhcnJheS5idWZmZXIsIG9mZnNldCk7XG5cdFx0fSBlbHNlIGlmIChhcnJheSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHtcblx0XHRcdHRoaXMuYnVmZmVyLnNldChhcnJheSwgb2Zmc2V0KTtcblx0XHR9IGVsc2UgaWYgKGFycmF5IGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcblx0XHRcdHRoaXMuYnVmZmVyLnNldChuZXcgVWludDhBcnJheShhcnJheSksIG9mZnNldCk7XG5cdFx0fSBlbHNlIGlmIChBcnJheUJ1ZmZlci5pc1ZpZXcoYXJyYXkpKSB7XG5cdFx0XHR0aGlzLmJ1ZmZlci5zZXQobmV3IFVpbnQ4QXJyYXkoYXJyYXkuYnVmZmVyLCBhcnJheS5ieXRlT2Zmc2V0LCBhcnJheS5ieXRlTGVuZ3RoKSwgb2Zmc2V0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGFyZ3VtZW50ICdhcnJheSdgKTtcblx0XHR9XG5cdH1cblxuXHRyZWFkVUludDMyQkUob2Zmc2V0OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiByZWFkVUludDMyQkUodGhpcy5idWZmZXIsIG9mZnNldCk7XG5cdH1cblxuXHR3cml0ZVVJbnQzMkJFKHZhbHVlOiBudW1iZXIsIG9mZnNldDogbnVtYmVyKTogdm9pZCB7XG5cdFx0d3JpdGVVSW50MzJCRSh0aGlzLmJ1ZmZlciwgdmFsdWUsIG9mZnNldCk7XG5cdH1cblxuXHRyZWFkVUludDMyTEUob2Zmc2V0OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiByZWFkVUludDMyTEUodGhpcy5idWZmZXIsIG9mZnNldCk7XG5cdH1cblxuXHR3cml0ZVVJbnQzMkxFKHZhbHVlOiBudW1iZXIsIG9mZnNldDogbnVtYmVyKTogdm9pZCB7XG5cdFx0d3JpdGVVSW50MzJMRSh0aGlzLmJ1ZmZlciwgdmFsdWUsIG9mZnNldCk7XG5cdH1cblxuXHRyZWFkVUludDgob2Zmc2V0OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiByZWFkVUludDgodGhpcy5idWZmZXIsIG9mZnNldCk7XG5cdH1cblxuXHR3cml0ZVVJbnQ4KHZhbHVlOiBudW1iZXIsIG9mZnNldDogbnVtYmVyKTogdm9pZCB7XG5cdFx0d3JpdGVVSW50OCh0aGlzLmJ1ZmZlciwgdmFsdWUsIG9mZnNldCk7XG5cdH1cblxuXHRpbmRleE9mKHN1YmFycmF5OiBWU0J1ZmZlciB8IFVpbnQ4QXJyYXksIG9mZnNldCA9IDApIHtcblx0XHRyZXR1cm4gYmluYXJ5SW5kZXhPZih0aGlzLmJ1ZmZlciwgc3ViYXJyYXkgaW5zdGFuY2VvZiBWU0J1ZmZlciA/IHN1YmFycmF5LmJ1ZmZlciA6IHN1YmFycmF5LCBvZmZzZXQpO1xuXHR9XG5cblx0ZXF1YWxzKG90aGVyOiBWU0J1ZmZlcik6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzID09PSBvdGhlcikge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuYnl0ZUxlbmd0aCAhPT0gb3RoZXIuYnl0ZUxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmJ1ZmZlci5ldmVyeSgodmFsdWUsIGluZGV4KSA9PiB2YWx1ZSA9PT0gb3RoZXIuYnVmZmVyW2luZGV4XSk7XG5cdH1cbn1cblxuLyoqXG4gKiBMaWtlIFN0cmluZy5pbmRleE9mLCBidXQgd29ya3Mgb24gVWludDhBcnJheXMuXG4gKiBVc2VzIHRoZSBib3llci1tb29yZS1ob3JzcG9vbCBhbGdvcml0aG0gdG8gYmUgcmVhc29uYWJseSBzcGVlZHkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBiaW5hcnlJbmRleE9mKGhheXN0YWNrOiBVaW50OEFycmF5LCBuZWVkbGU6IFVpbnQ4QXJyYXksIG9mZnNldCA9IDApOiBudW1iZXIge1xuXHRjb25zdCBuZWVkbGVMZW4gPSBuZWVkbGUuYnl0ZUxlbmd0aDtcblx0Y29uc3QgaGF5c3RhY2tMZW4gPSBoYXlzdGFjay5ieXRlTGVuZ3RoO1xuXG5cdGlmIChuZWVkbGVMZW4gPT09IDApIHtcblx0XHRyZXR1cm4gMDtcblx0fVxuXG5cdGlmIChuZWVkbGVMZW4gPT09IDEpIHtcblx0XHRyZXR1cm4gaGF5c3RhY2suaW5kZXhPZihuZWVkbGVbMF0pO1xuXHR9XG5cblx0aWYgKG5lZWRsZUxlbiA+IGhheXN0YWNrTGVuIC0gb2Zmc2V0KSB7XG5cdFx0cmV0dXJuIC0xO1xuXHR9XG5cblx0Ly8gZmluZCBpbmRleCBvZiB0aGUgc3ViYXJyYXkgdXNpbmcgYm95ZXItbW9vcmUtaG9yc3Bvb2wgYWxnb3JpdGhtXG5cdGNvbnN0IHRhYmxlID0gaW5kZXhPZlRhYmxlLnZhbHVlO1xuXHR0YWJsZS5maWxsKG5lZWRsZS5sZW5ndGgpO1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IG5lZWRsZS5sZW5ndGg7IGkrKykge1xuXHRcdHRhYmxlW25lZWRsZVtpXV0gPSBuZWVkbGUubGVuZ3RoIC0gaSAtIDE7XG5cdH1cblxuXHRsZXQgaSA9IG9mZnNldCArIG5lZWRsZS5sZW5ndGggLSAxO1xuXHRsZXQgaiA9IGk7XG5cdGxldCByZXN1bHQgPSAtMTtcblx0d2hpbGUgKGkgPCBoYXlzdGFja0xlbikge1xuXHRcdGlmIChoYXlzdGFja1tpXSA9PT0gbmVlZGxlW2pdKSB7XG5cdFx0XHRpZiAoaiA9PT0gMCkge1xuXHRcdFx0XHRyZXN1bHQgPSBpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0aS0tO1xuXHRcdFx0ai0tO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpICs9IE1hdGgubWF4KG5lZWRsZS5sZW5ndGggLSBqLCB0YWJsZVtoYXlzdGFja1tpXV0pO1xuXHRcdFx0aiA9IG5lZWRsZS5sZW5ndGggLSAxO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWFkVUludDE2TEUoc291cmNlOiBVaW50OEFycmF5LCBvZmZzZXQ6IG51bWJlcik6IG51bWJlciB7XG5cdHJldHVybiAoXG5cdFx0KChzb3VyY2Vbb2Zmc2V0ICsgMF0gPDwgMCkgPj4+IDApIHxcblx0XHQoKHNvdXJjZVtvZmZzZXQgKyAxXSA8PCA4KSA+Pj4gMClcblx0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlVUludDE2TEUoZGVzdGluYXRpb246IFVpbnQ4QXJyYXksIHZhbHVlOiBudW1iZXIsIG9mZnNldDogbnVtYmVyKTogdm9pZCB7XG5cdGRlc3RpbmF0aW9uW29mZnNldCArIDBdID0gKHZhbHVlICYgMGIxMTExMTExMSk7XG5cdHZhbHVlID0gdmFsdWUgPj4+IDg7XG5cdGRlc3RpbmF0aW9uW29mZnNldCArIDFdID0gKHZhbHVlICYgMGIxMTExMTExMSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWFkVUludDMyQkUoc291cmNlOiBVaW50OEFycmF5LCBvZmZzZXQ6IG51bWJlcik6IG51bWJlciB7XG5cdHJldHVybiAoXG5cdFx0c291cmNlW29mZnNldF0gKiAyICoqIDI0XG5cdFx0KyBzb3VyY2Vbb2Zmc2V0ICsgMV0gKiAyICoqIDE2XG5cdFx0KyBzb3VyY2Vbb2Zmc2V0ICsgMl0gKiAyICoqIDhcblx0XHQrIHNvdXJjZVtvZmZzZXQgKyAzXVxuXHQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVVSW50MzJCRShkZXN0aW5hdGlvbjogVWludDhBcnJheSwgdmFsdWU6IG51bWJlciwgb2Zmc2V0OiBudW1iZXIpOiB2b2lkIHtcblx0ZGVzdGluYXRpb25bb2Zmc2V0ICsgM10gPSB2YWx1ZTtcblx0dmFsdWUgPSB2YWx1ZSA+Pj4gODtcblx0ZGVzdGluYXRpb25bb2Zmc2V0ICsgMl0gPSB2YWx1ZTtcblx0dmFsdWUgPSB2YWx1ZSA+Pj4gODtcblx0ZGVzdGluYXRpb25bb2Zmc2V0ICsgMV0gPSB2YWx1ZTtcblx0dmFsdWUgPSB2YWx1ZSA+Pj4gODtcblx0ZGVzdGluYXRpb25bb2Zmc2V0XSA9IHZhbHVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVhZFVJbnQzMkxFKHNvdXJjZTogVWludDhBcnJheSwgb2Zmc2V0OiBudW1iZXIpOiBudW1iZXIge1xuXHRyZXR1cm4gKFxuXHRcdCgoc291cmNlW29mZnNldCArIDBdIDw8IDApID4+PiAwKSB8XG5cdFx0KChzb3VyY2Vbb2Zmc2V0ICsgMV0gPDwgOCkgPj4+IDApIHxcblx0XHQoKHNvdXJjZVtvZmZzZXQgKyAyXSA8PCAxNikgPj4+IDApIHxcblx0XHQoKHNvdXJjZVtvZmZzZXQgKyAzXSA8PCAyNCkgPj4+IDApXG5cdCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVVJbnQzMkxFKGRlc3RpbmF0aW9uOiBVaW50OEFycmF5LCB2YWx1ZTogbnVtYmVyLCBvZmZzZXQ6IG51bWJlcik6IHZvaWQge1xuXHRkZXN0aW5hdGlvbltvZmZzZXQgKyAwXSA9ICh2YWx1ZSAmIDBiMTExMTExMTEpO1xuXHR2YWx1ZSA9IHZhbHVlID4+PiA4O1xuXHRkZXN0aW5hdGlvbltvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDBiMTExMTExMTEpO1xuXHR2YWx1ZSA9IHZhbHVlID4+PiA4O1xuXHRkZXN0aW5hdGlvbltvZmZzZXQgKyAyXSA9ICh2YWx1ZSAmIDBiMTExMTExMTEpO1xuXHR2YWx1ZSA9IHZhbHVlID4+PiA4O1xuXHRkZXN0aW5hdGlvbltvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDBiMTExMTExMTEpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVhZFVJbnQ4KHNvdXJjZTogVWludDhBcnJheSwgb2Zmc2V0OiBudW1iZXIpOiBudW1iZXIge1xuXHRyZXR1cm4gc291cmNlW29mZnNldF07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVVJbnQ4KGRlc3RpbmF0aW9uOiBVaW50OEFycmF5LCB2YWx1ZTogbnVtYmVyLCBvZmZzZXQ6IG51bWJlcik6IHZvaWQge1xuXHRkZXN0aW5hdGlvbltvZmZzZXRdID0gdmFsdWU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVlNCdWZmZXJSZWFkYWJsZSBleHRlbmRzIHN0cmVhbXMuUmVhZGFibGU8VlNCdWZmZXI+IHsgfVxuXG5leHBvcnQgaW50ZXJmYWNlIFZTQnVmZmVyUmVhZGFibGVTdHJlYW0gZXh0ZW5kcyBzdHJlYW1zLlJlYWRhYmxlU3RyZWFtPFZTQnVmZmVyPiB7IH1cblxuZXhwb3J0IGludGVyZmFjZSBWU0J1ZmZlcldyaXRlYWJsZVN0cmVhbSBleHRlbmRzIHN0cmVhbXMuV3JpdGVhYmxlU3RyZWFtPFZTQnVmZmVyPiB7IH1cblxuZXhwb3J0IGludGVyZmFjZSBWU0J1ZmZlclJlYWRhYmxlQnVmZmVyZWRTdHJlYW0gZXh0ZW5kcyBzdHJlYW1zLlJlYWRhYmxlQnVmZmVyZWRTdHJlYW08VlNCdWZmZXI+IHsgfVxuXG5leHBvcnQgZnVuY3Rpb24gcmVhZGFibGVUb0J1ZmZlcihyZWFkYWJsZTogVlNCdWZmZXJSZWFkYWJsZSk6IFZTQnVmZmVyIHtcblx0cmV0dXJuIHN0cmVhbXMuY29uc3VtZVJlYWRhYmxlPFZTQnVmZmVyPihyZWFkYWJsZSwgY2h1bmtzID0+IFZTQnVmZmVyLmNvbmNhdChjaHVua3MpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJ1ZmZlclRvUmVhZGFibGUoYnVmZmVyOiBWU0J1ZmZlcik6IFZTQnVmZmVyUmVhZGFibGUge1xuXHRyZXR1cm4gc3RyZWFtcy50b1JlYWRhYmxlPFZTQnVmZmVyPihidWZmZXIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3RyZWFtVG9CdWZmZXIoc3RyZWFtOiBzdHJlYW1zLlJlYWRhYmxlU3RyZWFtPFZTQnVmZmVyPik6IFByb21pc2U8VlNCdWZmZXI+IHtcblx0cmV0dXJuIHN0cmVhbXMuY29uc3VtZVN0cmVhbTxWU0J1ZmZlcj4oc3RyZWFtLCBjaHVua3MgPT4gVlNCdWZmZXIuY29uY2F0KGNodW5rcykpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYnVmZmVyZWRTdHJlYW1Ub0J1ZmZlcihidWZmZXJlZFN0cmVhbTogc3RyZWFtcy5SZWFkYWJsZUJ1ZmZlcmVkU3RyZWFtPFZTQnVmZmVyPik6IFByb21pc2U8VlNCdWZmZXI+IHtcblx0aWYgKGJ1ZmZlcmVkU3RyZWFtLmVuZGVkKSB7XG5cdFx0cmV0dXJuIFZTQnVmZmVyLmNvbmNhdChidWZmZXJlZFN0cmVhbS5idWZmZXIpO1xuXHR9XG5cblx0cmV0dXJuIFZTQnVmZmVyLmNvbmNhdChbXG5cblx0XHQvLyBJbmNsdWRlIGFscmVhZHkgcmVhZCBjaHVua3MuLi5cblx0XHQuLi5idWZmZXJlZFN0cmVhbS5idWZmZXIsXG5cblx0XHQvLyAuLi5hbmQgYWxsIGFkZGl0aW9uYWwgY2h1bmtzXG5cdFx0YXdhaXQgc3RyZWFtVG9CdWZmZXIoYnVmZmVyZWRTdHJlYW0uc3RyZWFtKVxuXHRdKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJ1ZmZlclRvU3RyZWFtKGJ1ZmZlcjogVlNCdWZmZXIpOiBzdHJlYW1zLlJlYWRhYmxlU3RyZWFtPFZTQnVmZmVyPiB7XG5cdHJldHVybiBzdHJlYW1zLnRvU3RyZWFtPFZTQnVmZmVyPihidWZmZXIsIGNodW5rcyA9PiBWU0J1ZmZlci5jb25jYXQoY2h1bmtzKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHJlYW1Ub0J1ZmZlclJlYWRhYmxlU3RyZWFtKHN0cmVhbTogc3RyZWFtcy5SZWFkYWJsZVN0cmVhbUV2ZW50czxVaW50OEFycmF5IHwgc3RyaW5nPik6IHN0cmVhbXMuUmVhZGFibGVTdHJlYW08VlNCdWZmZXI+IHtcblx0cmV0dXJuIHN0cmVhbXMudHJhbnNmb3JtPFVpbnQ4QXJyYXkgfCBzdHJpbmcsIFZTQnVmZmVyPihzdHJlYW0sIHsgZGF0YTogZGF0YSA9PiB0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycgPyBWU0J1ZmZlci5mcm9tU3RyaW5nKGRhdGEpIDogVlNCdWZmZXIud3JhcChkYXRhKSB9LCBjaHVua3MgPT4gVlNCdWZmZXIuY29uY2F0KGNodW5rcykpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbmV3V3JpdGVhYmxlQnVmZmVyU3RyZWFtKG9wdGlvbnM/OiBzdHJlYW1zLldyaXRlYWJsZVN0cmVhbU9wdGlvbnMpOiBzdHJlYW1zLldyaXRlYWJsZVN0cmVhbTxWU0J1ZmZlcj4ge1xuXHRyZXR1cm4gc3RyZWFtcy5uZXdXcml0ZWFibGVTdHJlYW08VlNCdWZmZXI+KGNodW5rcyA9PiBWU0J1ZmZlci5jb25jYXQoY2h1bmtzKSwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVmaXhlZEJ1ZmZlclJlYWRhYmxlKHByZWZpeDogVlNCdWZmZXIsIHJlYWRhYmxlOiBWU0J1ZmZlclJlYWRhYmxlKTogVlNCdWZmZXJSZWFkYWJsZSB7XG5cdHJldHVybiBzdHJlYW1zLnByZWZpeGVkUmVhZGFibGUocHJlZml4LCByZWFkYWJsZSwgY2h1bmtzID0+IFZTQnVmZmVyLmNvbmNhdChjaHVua3MpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByZWZpeGVkQnVmZmVyU3RyZWFtKHByZWZpeDogVlNCdWZmZXIsIHN0cmVhbTogVlNCdWZmZXJSZWFkYWJsZVN0cmVhbSk6IFZTQnVmZmVyUmVhZGFibGVTdHJlYW0ge1xuXHRyZXR1cm4gc3RyZWFtcy5wcmVmaXhlZFN0cmVhbShwcmVmaXgsIHN0cmVhbSwgY2h1bmtzID0+IFZTQnVmZmVyLmNvbmNhdChjaHVua3MpKTtcbn1cblxuLyoqIERlY29kZXMgYmFzZTY0IHRvIGEgdWludDggYXJyYXkuIFVSTC1lbmNvZGVkIGFuZCB1bnBhZGRlZCBiYXNlNjQgaXMgYWxsb3dlZC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWNvZGVCYXNlNjQoZW5jb2RlZDogc3RyaW5nKSB7XG5cdGxldCBidWlsZGluZyA9IDA7XG5cdGxldCByZW1haW5kZXIgPSAwO1xuXHRsZXQgYnVmaSA9IDA7XG5cblx0Ly8gVGhlIHNpbXBsZXIgd2F5IHRvIGRvIHRoaXMgaXMgYFVpbnQ4QXJyYXkuZnJvbShhdG9iKHN0ciksIGMgPT4gYy5jaGFyQ29kZUF0KDApKWAsXG5cdC8vIGJ1dCB0aGF0J3MgYWJvdXQgMTAtMjB4IHNsb3dlciB0aGFuIHRoaXMgZnVuY3Rpb24gaW4gY3VycmVudCBDaHJvbWl1bSB2ZXJzaW9ucy5cblxuXHRjb25zdCBidWZmZXIgPSBuZXcgVWludDhBcnJheShNYXRoLmZsb29yKGVuY29kZWQubGVuZ3RoIC8gNCAqIDMpKTtcblx0Y29uc3QgYXBwZW5kID0gKHZhbHVlOiBudW1iZXIpID0+IHtcblx0XHRzd2l0Y2ggKHJlbWFpbmRlcikge1xuXHRcdFx0Y2FzZSAzOlxuXHRcdFx0XHRidWZmZXJbYnVmaSsrXSA9IGJ1aWxkaW5nIHwgdmFsdWU7XG5cdFx0XHRcdHJlbWFpbmRlciA9IDA7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAyOlxuXHRcdFx0XHRidWZmZXJbYnVmaSsrXSA9IGJ1aWxkaW5nIHwgKHZhbHVlID4+PiAyKTtcblx0XHRcdFx0YnVpbGRpbmcgPSB2YWx1ZSA8PCA2O1xuXHRcdFx0XHRyZW1haW5kZXIgPSAzO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0YnVmZmVyW2J1ZmkrK10gPSBidWlsZGluZyB8ICh2YWx1ZSA+Pj4gNCk7XG5cdFx0XHRcdGJ1aWxkaW5nID0gdmFsdWUgPDwgNDtcblx0XHRcdFx0cmVtYWluZGVyID0gMjtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRidWlsZGluZyA9IHZhbHVlIDw8IDI7XG5cdFx0XHRcdHJlbWFpbmRlciA9IDE7XG5cdFx0fVxuXHR9O1xuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgZW5jb2RlZC5sZW5ndGg7IGkrKykge1xuXHRcdGNvbnN0IGNvZGUgPSBlbmNvZGVkLmNoYXJDb2RlQXQoaSk7XG5cdFx0Ly8gU2VlIGh0dHBzOi8vZGF0YXRyYWNrZXIuaWV0Zi5vcmcvZG9jL2h0bWwvcmZjNDY0OCNzZWN0aW9uLTRcblx0XHQvLyBUaGlzIGJyYW5jaHkgY29kZSBpcyBhYm91dCAzeCBmYXN0ZXIgdGhhbiBhbiBpbmRleE9mIG9uIGEgYmFzZTY0IGNoYXIgc3RyaW5nLlxuXHRcdGlmIChjb2RlID49IDY1ICYmIGNvZGUgPD0gOTApIHtcblx0XHRcdGFwcGVuZChjb2RlIC0gNjUpOyAvLyBBLVogc3RhcnRzIHJhbmdlcyBmcm9tIGNoYXIgY29kZSA2NSB0byA5MFxuXHRcdH0gZWxzZSBpZiAoY29kZSA+PSA5NyAmJiBjb2RlIDw9IDEyMikge1xuXHRcdFx0YXBwZW5kKGNvZGUgLSA5NyArIDI2KTsgLy8gYS16IHN0YXJ0cyByYW5nZXMgZnJvbSBjaGFyIGNvZGUgOTcgdG8gMTIyLCBzdGFydGluZyBhdCBieXRlIDI2XG5cdFx0fSBlbHNlIGlmIChjb2RlID49IDQ4ICYmIGNvZGUgPD0gNTcpIHtcblx0XHRcdGFwcGVuZChjb2RlIC0gNDggKyA1Mik7IC8vIDAtOSBzdGFydHMgcmFuZ2VzIGZyb20gY2hhciBjb2RlIDQ4IHRvIDU4LCBzdGFydGluZyBhdCBieXRlIDUyXG5cdFx0fSBlbHNlIGlmIChjb2RlID09PSA0MyB8fCBjb2RlID09PSA0NSkge1xuXHRcdFx0YXBwZW5kKDYyKTsgLy8gXCIrXCIgb3IgXCItXCIgZm9yIFVSTFNcblx0XHR9IGVsc2UgaWYgKGNvZGUgPT09IDQ3IHx8IGNvZGUgPT09IDk1KSB7XG5cdFx0XHRhcHBlbmQoNjMpOyAvLyBcIi9cIiBvciBcIl9cIiBmb3IgVVJMU1xuXHRcdH0gZWxzZSBpZiAoY29kZSA9PT0gNjEpIHtcblx0XHRcdGJyZWFrOyAvLyBcIj1cIlxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVuZXhwZWN0ZWQgYmFzZTY0IGNoYXJhY3RlciAke2VuY29kZWRbaV19YCk7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgdW5wYWRkZWQgPSBidWZpO1xuXHR3aGlsZSAocmVtYWluZGVyID4gMCkge1xuXHRcdGFwcGVuZCgwKTtcblx0fVxuXG5cdC8vIHNsaWNlIGlzIG5lZWRlZCB0byBhY2NvdW50IGZvciBvdmVyZXN0aW1hdGlvbiBkdWUgdG8gcGFkZGluZ1xuXHRyZXR1cm4gVlNCdWZmZXIud3JhcChidWZmZXIpLnNsaWNlKDAsIHVucGFkZGVkKTtcbn1cblxuY29uc3QgYmFzZTY0QWxwaGFiZXQgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLyc7XG5jb25zdCBiYXNlNjRVcmxTYWZlQWxwaGFiZXQgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODktXyc7XG5cbi8qKiBFbmNvZGVzIGEgYnVmZmVyIHRvIGEgYmFzZTY0IHN0cmluZy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmNvZGVCYXNlNjQoeyBidWZmZXIgfTogVlNCdWZmZXIsIHBhZGRlZCA9IHRydWUsIHVybFNhZmUgPSBmYWxzZSkge1xuXHRjb25zdCBkaWN0aW9uYXJ5ID0gdXJsU2FmZSA/IGJhc2U2NFVybFNhZmVBbHBoYWJldCA6IGJhc2U2NEFscGhhYmV0O1xuXHRsZXQgb3V0cHV0ID0gJyc7XG5cblx0Y29uc3QgcmVtYWluZGVyID0gYnVmZmVyLmJ5dGVMZW5ndGggJSAzO1xuXG5cdGxldCBpID0gMDtcblx0Zm9yICg7IGkgPCBidWZmZXIuYnl0ZUxlbmd0aCAtIHJlbWFpbmRlcjsgaSArPSAzKSB7XG5cdFx0Y29uc3QgYSA9IGJ1ZmZlcltpICsgMF07XG5cdFx0Y29uc3QgYiA9IGJ1ZmZlcltpICsgMV07XG5cdFx0Y29uc3QgYyA9IGJ1ZmZlcltpICsgMl07XG5cblx0XHRvdXRwdXQgKz0gZGljdGlvbmFyeVthID4+PiAyXTtcblx0XHRvdXRwdXQgKz0gZGljdGlvbmFyeVsoYSA8PCA0IHwgYiA+Pj4gNCkgJiAwYjExMTExMV07XG5cdFx0b3V0cHV0ICs9IGRpY3Rpb25hcnlbKGIgPDwgMiB8IGMgPj4+IDYpICYgMGIxMTExMTFdO1xuXHRcdG91dHB1dCArPSBkaWN0aW9uYXJ5W2MgJiAwYjExMTExMV07XG5cdH1cblxuXHRpZiAocmVtYWluZGVyID09PSAxKSB7XG5cdFx0Y29uc3QgYSA9IGJ1ZmZlcltpICsgMF07XG5cdFx0b3V0cHV0ICs9IGRpY3Rpb25hcnlbYSA+Pj4gMl07XG5cdFx0b3V0cHV0ICs9IGRpY3Rpb25hcnlbKGEgPDwgNCkgJiAwYjExMTExMV07XG5cdFx0aWYgKHBhZGRlZCkgeyBvdXRwdXQgKz0gJz09JzsgfVxuXHR9IGVsc2UgaWYgKHJlbWFpbmRlciA9PT0gMikge1xuXHRcdGNvbnN0IGEgPSBidWZmZXJbaSArIDBdO1xuXHRcdGNvbnN0IGIgPSBidWZmZXJbaSArIDFdO1xuXHRcdG91dHB1dCArPSBkaWN0aW9uYXJ5W2EgPj4+IDJdO1xuXHRcdG91dHB1dCArPSBkaWN0aW9uYXJ5WyhhIDw8IDQgfCBiID4+PiA0KSAmIDBiMTExMTExXTtcblx0XHRvdXRwdXQgKz0gZGljdGlvbmFyeVsoYiA8PCAyKSAmIDBiMTExMTExXTtcblx0XHRpZiAocGFkZGVkKSB7IG91dHB1dCArPSAnPSc7IH1cblx0fVxuXG5cdHJldHVybiBvdXRwdXQ7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLFlBQVk7QUFDckIsWUFBWSxhQUFhO0FBSXpCLE1BQU0sWUFBYSxPQUFPLFdBQVc7QUFDckMsTUFBTSxlQUFlLElBQUksS0FBSyxNQUFNLElBQUksV0FBVyxHQUFHLENBQUM7QUFFdkQsSUFBSTtBQUNKLElBQUk7QUFFRyxNQUFNLFNBQVM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTXJCLE9BQU8sTUFBTSxZQUE4QjtBQUMxQyxRQUFJLFdBQVc7QUFDZCxhQUFPLElBQUksU0FBUyxPQUFPLFlBQVksVUFBVSxDQUFDO0FBQUEsSUFDbkQsT0FBTztBQUNOLGFBQU8sSUFBSSxTQUFTLElBQUksV0FBVyxVQUFVLENBQUM7QUFBQSxJQUMvQztBQUFBLEVBQ0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFPQSxPQUFPLEtBQUssUUFBOEI7QUFDekMsUUFBSSxhQUFhLENBQUUsT0FBTyxTQUFTLE1BQU0sR0FBSTtBQUc1QyxlQUFTLE9BQU8sS0FBSyxPQUFPLFFBQVEsT0FBTyxZQUFZLE9BQU8sVUFBVTtBQUFBLElBQ3pFO0FBQ0EsV0FBTyxJQUFJLFNBQVMsTUFBTTtBQUFBLEVBQzNCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1BLE9BQU8sV0FBVyxRQUFnQixTQUFxRDtBQUN0RixVQUFNLG9CQUFvQixTQUFTLHFCQUFxQjtBQUN4RCxRQUFJLENBQUMscUJBQXFCLFdBQVc7QUFDcEMsYUFBTyxJQUFJLFNBQVMsT0FBTyxLQUFLLE1BQU0sQ0FBQztBQUFBLElBQ3hDLE9BQU87QUFDTixVQUFJLENB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
