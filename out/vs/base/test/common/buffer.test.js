import assert from "assert";
import { timeout } from "../../common/async.js";
import { bufferedStreamToBuffer, bufferToReadable, bufferToStream, decodeBase64, encodeBase64, newWriteableBufferStream, readableToBuffer, streamToBuffer, VSBuffer } from "../../common/buffer.js";
import { peekStream } from "../../common/stream.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "./utils.js";
suite("Buffer", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("issue #71993 - VSBuffer#toString returns numbers", () => {
    const data = new Uint8Array([1, 2, 3, "h".charCodeAt(0), "i".charCodeAt(0), 4, 5]).buffer;
    const buffer = VSBuffer.wrap(new Uint8Array(data, 3, 2));
    assert.deepStrictEqual(buffer.toString(), "hi");
  });
  test("bufferToReadable / readableToBuffer", () => {
    const content = "Hello World";
    const readable = bufferToReadable(VSBuffer.fromString(content));
    assert.strictEqual(readableToBuffer(readable).toString(), content);
  });
  test("bufferToStream / streamToBuffer", async () => {
    const content = "Hello World";
    const stream = bufferToStream(VSBuffer.fromString(content));
    assert.strictEqual((await streamToBuffer(stream)).toString(), content);
  });
  test("bufferedStreamToBuffer", async () => {
    const content = "Hello World";
    const stream = await peekStream(bufferToStream(VSBuffer.fromString(content)), 1);
    assert.strictEqual((await bufferedStreamToBuffer(stream)).toString(), content);
  });
  test("bufferWriteableStream - basics (no error)", async () => {
    const stream = newWriteableBufferStream();
    const chunks = [];
    stream.on("data", (data) => {
      chunks.push(data);
    });
    let ended = false;
    stream.on("end", () => {
      ended = true;
    });
    const errors = [];
    stream.on("error", (error) => {
      errors.push(error);
    });
    await timeout(0);
    stream.write(VSBuffer.fromString("Hello"));
    await timeout(0);
    stream.end(VSBuffer.fromString("World"));
    assert.strictEqual(chunks.length, 2);
    assert.strictEqual(chunks[0].toString(), "Hello");
    assert.strictEqual(chunks[1].toString(), "World");
    assert.strictEqual(ended, true);
    assert.strictEqual(errors.length, 0);
  });
  test("bufferWriteableStream - basics (error)", async () => {
    const stream = newWriteableBufferStream();
    const chunks = [];
    stream.on("data", (data) => {
      chunks.push(data);
    });
    let ended = false;
    stream.on("end", () => {
      ended = true;
    });
    const errors = [];
    stream.on("error", (error) => {
      errors.push(error);
    });
    await timeout(0);
    stream.write(VSBuffer.fromString("Hello"));
    await timeout(0);
    stream.error(new Error());
    stream.end();
    assert.strictEqual(chunks.length, 1);
    assert.strictEqual(chunks[0].toString(), "Hello");
    assert.strictEqual(ended, true);
    assert.strictEqual(errors.length, 1);
  });
  test("bufferWriteableStream - buffers data when no listener", async () => {
    const stream = newWriteableBufferStream();
    await timeout(0);
    stream.write(VSBuffer.fromString("Hello"));
    await timeout(0);
    stream.end(VSBuffer.fromString("World"));
    const chunks = [];
    stream.on("data", (data) => {
      chunks.push(data);
    });
    let ended = false;
    stream.on("end", () => {
      ended = true;
    });
    const errors = [];
    stream.on("error", (error) => {
      errors.push(error);
    });
    assert.strictEqual(chunks.length, 1);
    assert.strictEqual(chunks[0].toString(), "HelloWorld");
    assert.strictEqual(ended, true);
    assert.strictEqual(errors.length, 0);
  });
  test("bufferWriteableStream - buffers errors when no listener", async () => {
    const stream = newWriteableBufferStream();
    await timeout(0);
    stream.write(VSBuffer.fromString("Hello"));
    await timeout(0);
    stream.error(new Error());
    const chunks = [];
    stream.on("data", (data) => {
      chunks.push(data);
    });
    const errors = [];
    stream.on("error", (error) => {
      errors.push(error);
    });
    let ended = false;
    stream.on("end", () => {
      ended = true;
    });
    stream.end();
    assert.strictEqual(chunks.length, 1);
    assert.strictEqual(chunks[0].toString(), "Hello");
    assert.strictEqual(ended, true);
    assert.strictEqual(errors.length, 1);
  });
  test("bufferWriteableStream - buffers end when no listener", async () => {
    const stream = newWriteableBufferStream();
    await timeout(0);
    stream.write(VSBuffer.fromString("Hello"));
    await timeout(0);
    stream.end(VSBuffer.fromString("World"));
    let ended = false;
    stream.on("end", () => {
      ended = true;
    });
    const chunks = [];
    stream.on("data", (data) => {
      chunks.push(data);
    });
    const errors = [];
    stream.on("error", (error) => {
      errors.push(error);
    });
    assert.strictEqual(chunks.length, 1);
    assert.strictEqual(chunks[0].toString(), "HelloWorld");
    assert.strictEqual(ended, true);
    assert.strictEqual(errors.length, 0);
  });
  test("bufferWriteableStream - nothing happens after end()", async () => {
    const stream = newWriteableBufferStream();
    const chunks = [];
    stream.on("data", (data) => {
      chunks.push(data);
    });
    await timeout(0);
    stream.write(VSBuffer.fromString("Hello"));
    await timeout(0);
    stream.end(VSBuffer.fromString("World"));
    let dataCalledAfterEnd = false;
    stream.on("data", (data) => {
      dataCalledAfterEnd = true;
    });
    let errorCalledAfterEnd = false;
    stream.on("error", (error) => {
      errorCalledAfterEnd = true;
    });
    let endCalledAfterEnd = false;
    stream.on("end", () => {
      endCalledAfterEnd = true;
    });
    await timeout(0);
    stream.write(VSBuffer.fromString("Hello"));
    await timeout(0);
    stream.error(new Error());
    await timeout(0);
    stream.end(VSBuffer.fromString("World"));
    assert.strictEqual(dataCalledAfterEnd, false);
    assert.strictEqual(errorCalledAfterEnd, false);
    assert.strictEqual(endCalledAfterEnd, false);
    assert.strictEqual(chunks.length, 2);
    assert.strictEqual(chunks[0].toString(), "Hello");
    assert.strictEqual(chunks[1].toString(), "World");
  });
  test("bufferWriteableStream - pause/resume (simple)", async () => {
    const stream = newWriteableBufferStream();
    const chunks = [];
    stream.on("data", (data) => {
      chunks.push(data);
    });
    let ended = false;
    stream.on("end", () => {
      ended = true;
    });
    const errors = [];
    stream.on("error", (error) => {
      errors.push(error);
    });
    stream.pause();
    await timeout(0);
    stream.write(VSBuffer.fromString("Hello"));
    await timeout(0);
    stream.end(VSBuffer.fromString("World"));
    assert.strictEqual(chunks.length, 0);
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(ended, false);
    stream.resume();
    assert.strictEqual(chunks.length, 1);
    assert.strictEqual(chunks[0].toString(), "HelloWorld");
    assert.strictEqual(ended, true);
    assert.strictEqual(errors.length, 0);
  });
  test("bufferWriteableStream - pause/resume (pause after first write)", async () => {
    const stream = newWriteableBufferStream();
    const chunks = [];
    stream.on("data", (data) => {
      chunks.push(data);
    });
    let ended = false;
    stream.on("end", () => {
      ended = true;
    });
    const errors = [];
    stream.on("error", (error) => {
      errors.push(error);
    });
    await timeout(0);
    stream.write(VSBuffer.fromString("Hello"));
    stream.pause();
    await timeout(0);
    stream.end(VSBuffer.fromString("World"));
    assert.strictEqual(chunks.length, 1);
    assert.strictEqual(chunks[0].toString(), "Hello");
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(ended, false);
    stream.resume();
    assert.strictEqual(chunks.length, 2);
    assert.strictEqual(chunks[0].toString(), "Hello");
    assert.strictEqual(chunks[1].toString(), "World");
    assert.strictEqual(ended, true);
    assert.strictEqual(errors.length, 0);
  });
  test("bufferWriteableStream - pause/resume (error)", async () => {
    const stream = newWriteableBufferStream();
    const chunks = [];
    stream.on("data", (data) => {
      chunks.push(data);
    });
    let ended = false;
    stream.on("end", () => {
      ended = true;
    });
    const errors = [];
    stream.on("error", (error) => {
      errors.push(error);
    });
    stream.pause();
    await timeout(0);
    stream.write(VSBuffer.fromString("Hello"));
    await timeout(0);
    stream.error(new Error());
    stream.end();
    assert.strictEqual(chunks.length, 0);
    assert.strictEqual(ended, false);
    assert.strictEqual(errors.length, 0);
    stream.resume();
    assert.strictEqual(chunks.length, 1);
    assert.strictEqual(chunks[0].toString(), "Hello");
    assert.strictEqual(ended, true);
    assert.strictEqual(errors.length, 1);
  });
  test("bufferWriteableStream - destroy", async () => {
    const stream = newWriteableBufferStream();
    const chunks = [];
    stream.on("data", (data) => {
      chunks.push(data);
    });
    let ended = false;
    stream.on("end", () => {
      ended = true;
    });
    const errors = [];
    stream.on("error", (error) => {
      errors.push(error);
    });
    stream.destroy();
    await timeout(0);
    stream.write(VSBuffer.fromString("Hello"));
    await timeout(0);
    stream.end(VSBuffer.fromString("World"));
    assert.strictEqual(chunks.length, 0);
    assert.strictEqual(ended, false);
    assert.strictEqual(errors.length, 0);
  });
  test("Performance issue with VSBuffer#slice #76076", function() {
    if (typeof Buffer !== "undefined") {
      const buff = Buffer.from([10, 20, 30, 40]);
      const b2 = buff.slice(1, 3);
      assert.strictEqual(buff[1], 20);
      assert.strictEqual(b2[0], 20);
      buff[1] = 17;
      assert.strictEqual(buff[1], 17);
      assert.strictEqual(b2[0], 17);
    }
    {
      const unit = new Uint8Array([10, 20, 30, 40]);
      const u2 = unit.slice(1, 3);
      assert.strictEqual(unit[1], 20);
      assert.strictEqual(u2[0], 20);
      unit[1] = 17;
      assert.strictEqual(unit[1], 17);
      assert.strictEqual(u2[0], 20);
    }
    {
      const unit = new Uint8Array([10, 20, 30, 40]);
      const u2 = unit.subarray(1, 3);
      assert.strictEqual(unit[1], 20);
      assert.strictEqual(u2[0], 20);
      unit[1] = 17;
      assert.strictEqual(unit[1], 17);
      assert.strictEqual(u2[0], 17);
    }
  });
  test("indexOf", () => {
    const haystack = VSBuffer.fromString("abcaabbccaaabbbccc");
    assert.strictEqual(haystack.indexOf(VSBuffer.fromString("")), 0);
    assert.strictEqual(haystack.indexOf(VSBuffer.fromString("a".repeat(100))), -1);
    assert.strictEqual(haystack.indexOf(VSBuffer.fromString("a")), 0);
    assert.strictEqual(haystack.indexOf(VSBuffer.fromString("c")), 2);
    assert.strictEqual(haystack.indexOf(VSBuffer.fromString("abcaa")), 0);
    assert.strictEqual(haystack.indexOf(VSBuffer.fromString("caaab")), 8);
    assert.strictEqual(haystack.indexOf(VSBuffer.fromString("ccc")), 15);
    assert.strictEqual(haystack.indexOf(VSBuffer.fromString("cccb")), -1);
  });
  test("wrap", () => {
    const actual = new Uint8Array([1, 2, 3]);
    const wrapped = VSBuffer.wrap(actual);
    assert.strictEqual(wrapped.byteLength, 3);
    assert.deepStrictEqual(Array.from(wrapped.buffer), [1, 2, 3]);
  });
  test("fromString", () => {
    const value = "Hello World";
    const buff = VSBuffer.fromString(value);
    assert.strictEqual(buff.toString(), value);
  });
  test("fromByteArray", () => {
    const array = [1, 2, 3, 4, 5];
    const buff = VSBuffer.fromByteArray(array);
    assert.strictEqual(buff.byteLength, array.length);
    assert.deepStrictEqual(Array.from(buff.buffer), array);
  });
  test("concat", () => {
    const chunks = [
      VSBuffer.fromString("abc"),
      VSBuffer.fromString("def"),
      VSBuffer.fromString("ghi")
    ];
    const result1 = VSBuffer.concat(chunks);
    assert.strictEqual(result1.toString(), "abcdefghi");
    const result2 = VSBuffer.concat(chunks, 9);
    assert.strictEqual(result2.toString(), "abcdefghi");
  });
  test("clone", () => {
    const original = VSBuffer.fromString("test");
    const clone = original.clone();
    assert.notStrictEqual(original.buffer, clone.buffer);
    assert.deepStrictEqual(Array.from(original.buffer), Array.from(clone.buffer));
  });
  test("slice", () => {
    const buff = VSBuffer.fromString("Hello World");
    const slice1 = buff.slice(0, 5);
    assert.strictEqual(slice1.toString(), "Hello");
    const slice2 = buff.slice(6);
    assert.strictEqual(slice2.toString(), "World");
  });
  test("set", () => {
    const buff = VSBuffer.alloc(5);
    buff.set(VSBuffer.fromString("ab"), 0);
    assert.strictEqual(buff.toString().substring(0, 2), "ab");
    buff.set(new Uint8Array([99, 100]), 2);
    assert.strictEqual(buff.toString().substring(2, 4), "cd");
    assert.throws(() => {
      buff.set({});
    });
  });
  test("equals", () => {
    const buff1 = VSBuffer.fromString("test");
    const buff2 = VSBuffer.fromString("test");
    const buff3 = VSBuffer.fromString("different");
    const buff4 = VSBuffer.fromString("tes1");
    assert.strictEqual(buff1.equals(buff1), true);
    assert.strictEqual(buff1.equals(buff2), true);
    assert.strictEqual(buff1.equals(buff3), false);
    assert.strictEqual(buff1.equals(buff4), false);
  });
  test("read/write methods", () => {
    const buff = VSBuffer.alloc(8);
    buff.writeUInt32BE(305419896, 0);
    assert.strictEqual(buff.readUInt32BE(0), 305419896);
    buff.writeUInt32LE(305419896, 4);
    assert.strictEqual(buff.readUInt32LE(4), 305419896);
    const buff2 = VSBuffer.alloc(1);
    buff2.writeUInt8(123, 0);
    assert.strictEqual(buff2.readUInt8(0), 123);
  });
  suite("base64", () => {
    const testCases = [
      [new Uint8Array([]), ""],
      [new Uint8Array([56]), "OA=="],
      [new Uint8Array([209, 4]), "0QQ="],
      [new Uint8Array([19, 57, 119]), "Ezl3"],
      [new Uint8Array([199, 237, 207, 112]), "x+3PcA=="],
      [new Uint8Array([59, 193, 173, 26, 242]), "O8GtGvI="],
      [new Uint8Array([81, 226, 95, 231, 116, 126]), "UeJf53R+"],
      [new Uint8Array([11, 164, 253, 85, 8, 6, 56]), "C6T9VQgGOA=="],
      [new Uint8Array([164, 16, 88, 88, 224, 173, 144, 114]), "pBBYWOCtkHI="],
      [new Uint8Array([0, 196, 99, 12, 21, 229, 78, 101, 13]), "AMRjDBXlTmUN"],
      [new Uint8Array([167, 114, 225, 116, 226, 83, 51, 48, 88, 114]), "p3LhdOJTMzBYcg=="],
      [new Uint8Array([75, 33, 118, 10, 77, 5, 168, 194, 59, 47, 59]), "SyF2Ck0FqMI7Lzs="],
      [new Uint8Array([203, 182, 165, 51, 208, 27, 123, 223, 112, 198, 127, 147]), "y7alM9Abe99wxn+T"],
      [new Uint8Array([154, 93, 222, 41, 117, 234, 250, 85, 95, 144, 16, 94, 18]), "ml3eKXXq+lVfkBBeEg=="],
      [new Uint8Array([246, 186, 88, 105, 192, 57, 25, 168, 183, 164, 103, 162, 243, 56]), "9rpYacA5Gai3pGei8zg="],
      [new Uint8Array([149, 240, 155, 96, 30, 55, 162, 172, 191, 187, 33, 124, 169, 183, 254]), "lfCbYB43oqy/uyF8qbf+"]
    ];
    test("encodes", () => {
      for (const [bytes, expected] of testCases) {
        assert.strictEqual(encodeBase64(VSBuffer.wrap(bytes)), expected);
      }
    });
    test("decodes", () => {
      for (const [expected, encoded] of testCases) {
        assert.deepStrictEqual(new Uint8Array(decodeBase64(encoded).buffer), expected);
      }
    });
    test("throws error on invalid encoding", () => {
      assert.throws(() => decodeBase64("invalid!"));
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvY29tbW9uL2J1ZmZlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBidWZmZXJlZFN0cmVhbVRvQnVmZmVyLCBidWZmZXJUb1JlYWRhYmxlLCBidWZmZXJUb1N0cmVhbSwgZGVjb2RlQmFzZTY0LCBlbmNvZGVCYXNlNjQsIG5ld1dyaXRlYWJsZUJ1ZmZlclN0cmVhbSwgcmVhZGFibGVUb0J1ZmZlciwgc3RyZWFtVG9CdWZmZXIsIFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBwZWVrU3RyZWFtIH0gZnJvbSAnLi4vLi4vY29tbW9uL3N0cmVhbS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuL3V0aWxzLmpzJztcblxuc3VpdGUoJ0J1ZmZlcicsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdpc3N1ZSAjNzE5OTMgLSBWU0J1ZmZlciN0b1N0cmluZyByZXR1cm5zIG51bWJlcnMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZGF0YSA9IG5ldyBVaW50OEFycmF5KFsxLCAyLCAzLCAnaCcuY2hhckNvZGVBdCgwKSwgJ2knLmNoYXJDb2RlQXQoMCksIDQsIDVdKS5idWZmZXI7XG5cdFx0Y29uc3QgYnVmZmVyID0gVlNCdWZmZXIud3JhcChuZXcgVWludDhBcnJheShkYXRhLCAzLCAyKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChidWZmZXIudG9TdHJpbmcoKSwgJ2hpJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2J1ZmZlclRvUmVhZGFibGUgLyByZWFkYWJsZVRvQnVmZmVyJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbnRlbnQgPSAnSGVsbG8gV29ybGQnO1xuXHRcdGNvbnN0IHJlYWRhYmxlID0gYnVmZmVyVG9SZWFkYWJsZShWU0J1ZmZlci5mcm9tU3RyaW5nKGNvbnRlbnQpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZWFkYWJsZVRvQnVmZmVyKHJlYWRhYmxlKS50b1N0cmluZygpLCBjb250ZW50KTtcblx0fSk7XG5cblx0dGVzdCgnYnVmZmVyVG9TdHJlYW0gLyBzdHJlYW1Ub0J1ZmZlcicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjb250ZW50ID0gJ0hlbGxvIFdvcmxkJztcblx0XHRjb25zdCBzdHJlYW0gPSBidWZmZXJUb1N0cmVhbShWU0J1ZmZlci5mcm9tU3RyaW5nKGNvbnRlbnQpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgc3RyZWFtVG9CdWZmZXIoc3RyZWFtKSkudG9TdHJpbmcoKSwgY29udGVudCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2J1ZmZlcmVkU3RyZWFtVG9CdWZmZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGVudCA9ICdIZWxsbyBXb3JsZCc7XG5cdFx0Y29uc3Qgc3RyZWFtID0gYXdhaXQgcGVla1N0cmVhbShidWZmZXJUb1N0cmVhbShWU0J1ZmZlci5mcm9tU3RyaW5nKGNvbnRlbnQpKSwgMSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGJ1ZmZlcmVkU3RyZWFtVG9CdWZmZXIoc3RyZWFtKSkudG9TdHJpbmcoKSwgY29udGVudCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2J1ZmZlcldyaXRlYWJsZVN0cmVhbSAtIGJhc2ljcyAobm8gZXJyb3IpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHN0cmVhbSA9IG5ld1dyaXRlYWJsZUJ1ZmZlclN0cmVhbSgpO1xuXG5cdFx0Y29uc3QgY2h1bmtzOiBWU0J1ZmZlcltdID0gW107XG5cdFx0c3RyZWFtLm9uKCdkYXRhJywgZGF0YSA9PiB7XG5cdFx0XHRjaHVua3MucHVzaChkYXRhKTtcblx0XHR9KTtcblxuXHRcdGxldCBlbmRlZCA9IGZhbHNlO1xuXHRcdHN0cmVhbS5vbignZW5kJywgKCkgPT4ge1xuXHRcdFx0ZW5kZWQgPSB0cnVlO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZXJyb3JzOiBFcnJvcltdID0gW107XG5cdFx0c3RyZWFtLm9uKCdlcnJvcicsIGVycm9yID0+IHtcblx0XHRcdGVycm9ycy5wdXNoKGVycm9yKTtcblx0XHR9KTtcblxuXHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0c3RyZWFtLndyaXRlKFZTQnVmZmVyLmZyb21TdHJpbmcoJ0hlbGxvJykpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0c3RyZWFtLmVuZChWU0J1ZmZlci5mcm9tU3RyaW5nKCdXb3JsZCcpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaHVua3MubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2h1bmtzWzBdLnRvU3RyaW5nKCksICdIZWxsbycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaHVua3NbMV0udG9TdHJpbmcoKSwgJ1dvcmxkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVuZGVkLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXJyb3JzLmxlbmd0aCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2J1ZmZlcldyaXRlYWJsZVN0cmVhbSAtIGJhc2ljcyAoZXJyb3IpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHN0cmVhbSA9IG5ld1dyaXRlYWJsZUJ1ZmZlclN0cmVhbSgpO1xuXG5cdFx0Y29uc3QgY2h1bmtzOiBWU0J1ZmZlcltdID0gW107XG5cdFx0c3RyZWFtLm9uKCdkYXRhJywgZGF0YSA9PiB7XG5cdFx0XHRjaHVua3MucHVzaChkYXRhKTtcblx0XHR9KTtcblxuXHRcdGxldCBlbmRlZCA9IGZhbHNlO1xuXHRcdHN0cmVhbS5vbignZW5kJywgKCkgPT4ge1xuXHRcdFx0ZW5kZWQgPSB0cnVlO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZXJyb3JzOiBFcnJvcltdID0gW107XG5cdFx0c3RyZWFtLm9uKCdlcnJvcicsIGVycm9yID0+IHtcblx0XHRcdGVycm9ycy5wdXNoKGVycm9yKTtcblx0XHR9KTtcblxuXHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0c3RyZWFtLndyaXRlKFZTQnVmZmVyLmZyb21TdHJpbmcoJ0hlbGxvJykpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0c3RyZWFtLmVycm9yKG5ldyBFcnJvcigpKTtcblx0XHRzdHJlYW0uZW5kKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2h1bmtzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNodW5rc1swXS50b1N0cmluZygpLCAnSGVsbG8nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW5kZWQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnJvcnMubGVuZ3RoLCAxKTtcblx0fSk7XG5cblx0dGVzdCgnYnVmZmVyV3JpdGVhYmxlU3RyZWFtIC0gYnVmZmVycyBkYXRhIHdoZW4gbm8gbGlzdGVuZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc3RyZWFtID0gbmV3V3JpdGVhYmxlQnVmZmVyU3RyZWFtKCk7XG5cblx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdHN0cmVhbS53cml0ZShWU0J1ZmZlci5mcm9tU3RyaW5nKCdIZWxsbycpKTtcblx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdHN0cmVhbS5lbmQoVlNCdWZmZXIuZnJvbVN0cmluZygnV29ybGQnKSk7XG5cblx0XHRjb25zdCBjaHVua3M6IFZTQnVmZmVyW10gPSBbXTtcblx0XHRzdHJlYW0ub24oJ2RhdGEnLCBkYXRhID0+IHtcblx0XHRcdGNodW5rcy5wdXNoKGRhdGEpO1xuXHRcdH0pO1xuXG5cdFx0bGV0IGVuZGVkID0gZmFsc2U7XG5cdFx0c3RyZWFtLm9uKCdlbmQnLCAoKSA9PiB7XG5cdFx0XHRlbmRlZCA9IHRydWU7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBlcnJvcnM6IEVycm9yW10gPSBbXTtcblx0XHRzdHJlYW0ub24oJ2Vycm9yJywgZXJyb3IgPT4ge1xuXHRcdFx0ZXJyb3JzLnB1c2goZXJyb3IpO1xuXHRcdH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNodW5rcy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaHVua3NbMF0udG9TdHJpbmcoKSwgJ0hlbGxvV29ybGQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW5kZWQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnJvcnMubGVuZ3RoLCAwKTtcblx0fSk7XG5cblx0dGVzdCgnYnVmZmVyV3JpdGVhYmxlU3RyZWFtIC0gYnVmZmVycyBlcnJvcnMgd2hlbiBubyBsaXN0ZW5lcicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzdHJlYW0gPSBuZXdXcml0ZWFibGVCdWZmZXJTdHJlYW0oKTtcblxuXHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0c3RyZWFtLndyaXRlKFZTQnVmZmVyLmZyb21TdHJpbmcoJ0hlbGxvJykpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0c3RyZWFtLmVycm9yKG5ldyBFcnJvcigpKTtcblxuXHRcdGNvbnN0IGNodW5rczogVlNCdWZmZXJbXSA9IFtdO1xuXHRcdHN0cmVhbS5vbignZGF0YScsIGRhdGEgPT4ge1xuXHRcdFx0Y2h1bmtzLnB1c2goZGF0YSk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBlcnJvcnM6IEVycm9yW10gPSBbXTtcblx0XHRzdHJlYW0ub24oJ2Vycm9yJywgZXJyb3IgPT4ge1xuXHRcdFx0ZXJyb3JzLnB1c2goZXJyb3IpO1xuXHRcdH0pO1xuXG5cdFx0bGV0IGVuZGVkID0gZmFsc2U7XG5cdFx0c3RyZWFtLm9uKCdlbmQnLCAoKSA9PiB7XG5cdFx0XHRlbmRlZCA9IHRydWU7XG5cdFx0fSk7XG5cblx0XHRzdHJlYW0uZW5kKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2h1bmtzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNodW5rc1swXS50b1N0cmluZygpLCAnSGVsbG8nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW5kZWQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnJvcnMubGVuZ3RoLCAxKTtcblx0fSk7XG5cblx0dGVzdCgnYnVmZmVyV3JpdGVhYmxlU3RyZWFtIC0gYnVmZmVycyBlbmQgd2hlbiBubyBsaXN0ZW5lcicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzdHJlYW0gPSBuZXdXcml0ZWFibGVCdWZmZXJTdHJlYW0oKTtcblxuXHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0c3RyZWFtLndyaXRlKFZTQnVmZmVyLmZyb21TdHJpbmcoJ0hlbGxvJykpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0c3RyZWFtLmVuZChWU0J1ZmZlci5mcm9tU3RyaW5nKCdXb3JsZCcpKTtcblxuXHRcdGxldCBlbmRlZCA9IGZhbHNlO1xuXHRcdHN0cmVhbS5vbignZW5kJywgKCkgPT4ge1xuXHRcdFx0ZW5kZWQgPSB0cnVlO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgY2h1bmtzOiBWU0J1ZmZlcltdID0gW107XG5cdFx0c3RyZWFtLm9uKCdkYXRhJywgZGF0YSA9PiB7XG5cdFx0XHRjaHVua3MucHVzaChkYXRhKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGVycm9yczogRXJyb3JbXSA9IFtdO1xuXHRcdHN0cmVhbS5vbignZXJyb3InLCBlcnJvciA9PiB7XG5cdFx0XHRlcnJvcnMucHVzaChlcnJvcik7XG5cdFx0fSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2h1bmtzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNodW5rc1swXS50b1N0cmluZygpLCAnSGVsbG9Xb3JsZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbmRlZCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVycm9ycy5sZW5ndGgsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdidWZmZXJXcml0ZWFibGVTdHJlYW0gLSBub3RoaW5nIGhhcHBlbnMgYWZ0ZXIgZW5kKCknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc3RyZWFtID0gbmV3V3JpdGVhYmxlQnVmZmVyU3RyZWFtKCk7XG5cblx0XHRjb25zdCBjaHVua3M6IFZTQnVmZmVyW10gPSBbXTtcblx0XHRzdHJlYW0ub24oJ2RhdGEnLCBkYXRhID0+IHtcblx0XHRcdGNodW5rcy5wdXNoKGRhdGEpO1xuXHRcdH0pO1xuXG5cdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRzdHJlYW0ud3JpdGUoVlNCdWZmZXIuZnJvbVN0cmluZygnSGVsbG8nKSk7XG5cdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRzdHJlYW0uZW5kKFZTQnVmZmVyLmZyb21TdHJpbmcoJ1dvcmxkJykpO1xuXG5cdFx0bGV0IGRhdGFDYWxsZWRBZnRlckVuZCA9IGZhbHNlO1xuXHRcdHN0cmVhbS5vbignZGF0YScsIGRhdGEgPT4ge1xuXHRcdFx0ZGF0YUNhbGxlZEFmdGVyRW5kID0gdHJ1ZTtcblx0XHR9KTtcblxuXHRcdGxldCBlcnJvckNhbGxlZEFmdGVyRW5kID0gZmFsc2U7XG5cdFx0c3RyZWFtLm9uKCdlcnJvcicsIGVycm9yID0+IHtcblx0XHRcdGVycm9yQ2FsbGVkQWZ0ZXJFbmQgPSB0cnVlO1xuXHRcdH0pO1xuXG5cdFx0bGV0IGVuZENhbGxlZEFmdGVyRW5kID0gZmFsc2U7XG5cdFx0c3RyZWFtLm9uKCdlbmQnLCAoKSA9PiB7XG5cdFx0XHRlbmRDYWxsZWRBZnRlckVuZCA9IHRydWU7XG5cdFx0fSk7XG5cblx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdHN0cmVhbS53cml0ZShWU0J1ZmZlci5mcm9tU3RyaW5nKCdIZWxsbycpKTtcblx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdHN0cmVhbS5lcnJvcihuZXcgRXJyb3IoKSk7XG5cdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRzdHJlYW0uZW5kKFZTQnVmZmVyLmZyb21TdHJpbmcoJ1dvcmxkJykpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRhdGFDYWxsZWRBZnRlckVuZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnJvckNhbGxlZEFmdGVyRW5kLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVuZENhbGxlZEFmdGVyRW5kLCBmYWxzZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2h1bmtzLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNodW5rc1swXS50b1N0cmluZygpLCAnSGVsbG8nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2h1bmtzWzFdLnRvU3RyaW5nKCksICdXb3JsZCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdidWZmZXJXcml0ZWFibGVTdHJlYW0gLSBwYXVzZS9yZXN1bWUgKHNpbXBsZSknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc3RyZWFtID0gbmV3V3JpdGVhYmxlQnVmZmVyU3RyZWFtKCk7XG5cblx0XHRjb25zdCBjaHVua3M6IFZTQnVmZmVyW10gPSBbXTtcblx0XHRzdHJlYW0ub24oJ2RhdGEnLCBkYXRhID0+IHtcblx0XHRcdGNodW5rcy5wdXNoKGRhdGEpO1xuXHRcdH0pO1xuXG5cdFx0bGV0IGVuZGVkID0gZmFsc2U7XG5cdFx0c3RyZWFtLm9uKCdlbmQnLCAoKSA9PiB7XG5cdFx0XHRlbmRlZCA9IHRydWU7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBlcnJvcnM6IEVycm9yW10gPSBbXTtcblx0XHRzdHJlYW0ub24oJ2Vycm9yJywgZXJyb3IgPT4ge1xuXHRcdFx0ZXJyb3JzLnB1c2goZXJyb3IpO1xuXHRcdH0pO1xuXG5cdFx0c3RyZWFtLnBhdXNlKCk7XG5cblx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdHN0cmVhbS53cml0ZShWU0J1ZmZlci5mcm9tU3RyaW5nKCdIZWxsbycpKTtcblx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdHN0cmVhbS5lbmQoVlNCdWZmZXIuZnJvbVN0cmluZygnV29ybGQnKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2h1bmtzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVycm9ycy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbmRlZCwgZmFsc2UpO1xuXG5cdFx0c3RyZWFtLnJlc3VtZSgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNodW5rcy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaHVua3NbMF0udG9TdHJpbmcoKSwgJ0hlbGxvV29ybGQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW5kZWQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnJvcnMubGVuZ3RoLCAwKTtcblx0fSk7XG5cblx0dGVzdCgnYnVmZmVyV3JpdGVhYmxlU3RyZWFtIC0gcGF1c2UvcmVzdW1lIChwYXVzZSBhZnRlciBmaXJzdCB3cml0ZSknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc3RyZWFtID0gbmV3V3JpdGVhYmxlQnVmZmVyU3RyZWFtKCk7XG5cblx0XHRjb25zdCBjaHVua3M6IFZTQnVmZmVyW10gPSBbXTtcblx0XHRzdHJlYW0ub24oJ2RhdGEnLCBkYXRhID0+IHtcblx0XHRcdGNodW5rcy5wdXNoKGRhdGEpO1xuXHRcdH0pO1xuXG5cdFx0bGV0IGVuZGVkID0gZmFsc2U7XG5cdFx0c3RyZWFtLm9uKCdlbmQnLCAoKSA9PiB7XG5cdFx0XHRlbmRlZCA9IHRydWU7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBlcnJvcnM6IEVycm9yW10gPSBbXTtcblx0XHRzdHJlYW0ub24oJ2Vycm9yJywgZXJyb3IgPT4ge1xuXHRcdFx0ZXJyb3JzLnB1c2goZXJyb3IpO1xuXHRcdH0pO1xuXG5cdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRzdHJlYW0ud3JpdGUoVlNCdWZmZXIuZnJvbVN0cmluZygnSGVsbG8nKSk7XG5cblx0XHRzdHJlYW0ucGF1c2UoKTtcblxuXHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0c3RyZWFtLmVuZChWU0J1ZmZlci5mcm9tU3RyaW5nKCdXb3JsZCcpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaHVua3MubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2h1bmtzWzBdLnRvU3RyaW5nKCksICdIZWxsbycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnJvcnMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW5kZWQsIGZhbHNlKTtcblxuXHRcdHN0cmVhbS5yZXN1bWUoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaHVua3MubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2h1bmtzWzBdLnRvU3RyaW5nKCksICdIZWxsbycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaHVua3NbMV0udG9TdHJpbmcoKSwgJ1dvcmxkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVuZGVkLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXJyb3JzLmxlbmd0aCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2J1ZmZlcldyaXRlYWJsZVN0cmVhbSAtIHBhdXNlL3Jlc3VtZSAoZXJyb3IpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHN0cmVhbSA9IG5ld1dyaXRlYWJsZUJ1ZmZlclN0cmVhbSgpO1xuXG5cdFx0Y29uc3QgY2h1bmtzOiBWU0J1ZmZlcltdID0gW107XG5cdFx0c3RyZWFtLm9uKCdkYXRhJywgZGF0YSA9PiB7XG5cdFx0XHRjaHVua3MucHVzaChkYXRhKTtcblx0XHR9KTtcblxuXHRcdGxldCBlbmRlZCA9IGZhbHNlO1xuXHRcdHN0cmVhbS5vbignZW5kJywgKCkgPT4ge1xuXHRcdFx0ZW5kZWQgPSB0cnVlO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZXJyb3JzOiBFcnJvcltdID0gW107XG5cdFx0c3RyZWFtLm9uKCdlcnJvcicsIGVycm9yID0+IHtcblx0XHRcdGVycm9ycy5wdXNoKGVycm9yKTtcblx0XHR9KTtcblxuXHRcdHN0cmVhbS5wYXVzZSgpO1xuXG5cdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRzdHJlYW0ud3JpdGUoVlNCdWZmZXIuZnJvbVN0cmluZygnSGVsbG8nKSk7XG5cdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRzdHJlYW0uZXJyb3IobmV3IEVycm9yKCkpO1xuXHRcdHN0cmVhbS5lbmQoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaHVua3MubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW5kZWQsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXJyb3JzLmxlbmd0aCwgMCk7XG5cblx0XHRzdHJlYW0ucmVzdW1lKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2h1bmtzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNodW5rc1swXS50b1N0cmluZygpLCAnSGVsbG8nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW5kZWQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnJvcnMubGVuZ3RoLCAxKTtcblx0fSk7XG5cblx0dGVzdCgnYnVmZmVyV3JpdGVhYmxlU3RyZWFtIC0gZGVzdHJveScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzdHJlYW0gPSBuZXdXcml0ZWFibGVCdWZmZXJTdHJlYW0oKTtcblxuXHRcdGNvbnN0IGNodW5rczogVlNCdWZmZXJbXSA9IFtdO1xuXHRcdHN0cmVhbS5vbignZGF0YScsIGRhdGEgPT4ge1xuXHRcdFx0Y2h1bmtzLnB1c2goZGF0YSk7XG5cdFx0fSk7XG5cblx0XHRsZXQgZW5kZWQgPSBmYWxzZTtcblx0XHRzdHJlYW0ub24oJ2VuZCcsICgpID0+IHtcblx0XHRcdGVuZGVkID0gdHJ1ZTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGVycm9yczogRXJyb3JbXSA9IFtdO1xuXHRcdHN0cmVhbS5vbignZXJyb3InLCBlcnJvciA9PiB7XG5cdFx0XHRlcnJvcnMucHVzaChlcnJvcik7XG5cdFx0fSk7XG5cblx0XHRzdHJlYW0uZGVzdHJveSgpO1xuXG5cdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRzdHJlYW0ud3JpdGUoVlNCdWZmZXIuZnJvbVN0cmluZygnSGVsbG8nKSk7XG5cdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRzdHJlYW0uZW5kKFZTQnVmZmVyLmZyb21TdHJpbmcoJ1dvcmxkJykpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNodW5rcy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbmRlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnJvcnMubGVuZ3RoLCAwKTtcblx0fSk7XG5cblx0dGVzdCgnUGVyZm9ybWFuY2UgaXNzdWUgd2l0aCBWU0J1ZmZlciNzbGljZSAjNzYwNzYnLCBmdW5jdGlvbiAoKSB7IC8vIFRPRE9AYWxleGRpbWEgdGhpcyB0ZXN0IHNlZW1zIHRvIGZhaWwgaW4gd2ViIChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTE0MDQyKVxuXHRcdC8vIEJ1ZmZlciNzbGljZSBjcmVhdGVzIGEgdmlld1xuXHRcdGlmICh0eXBlb2YgQnVmZmVyICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0Y29uc3QgYnVmZiA9IEJ1ZmZlci5mcm9tKFsxMCwgMjAsIDMwLCA0MF0pO1xuXHRcdFx0Y29uc3QgYjIgPSBidWZmLnNsaWNlKDEsIDMpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJ1ZmZbMV0sIDIwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiMlswXSwgMjApO1xuXG5cdFx0XHRidWZmWzFdID0gMTc7IC8vIG1vZGlmeSBidWZmIEFORCBiMlxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJ1ZmZbMV0sIDE3KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiMlswXSwgMTcpO1xuXHRcdH1cblxuXHRcdC8vIFR5cGVkQXJyYXkjc2xpY2UgY3JlYXRlcyBhIGNvcHlcblx0XHR7XG5cdFx0XHRjb25zdCB1bml0ID0gbmV3IFVpbnQ4QXJyYXkoWzEwLCAyMCwgMzAsIDQwXSk7XG5cdFx0XHRjb25zdCB1MiA9IHVuaXQuc2xpY2UoMSwgMyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5pdFsxXSwgMjApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHUyWzBdLCAyMCk7XG5cblx0XHRcdHVuaXRbMV0gPSAxNzsgLy8gbW9kaWZ5IHVuaXQsIE5PVCBiMlxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuaXRbMV0sIDE3KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1MlswXSwgMjApO1xuXHRcdH1cblxuXHRcdC8vIFR5cGVkQXJyYXkjc3ViYXJyYXkgY3JlYXRlcyBhIHZpZXdcblx0XHR7XG5cdFx0XHRjb25zdCB1bml0ID0gbmV3IFVpbnQ4QXJyYXkoWzEwLCAyMCwgMzAsIDQwXSk7XG5cdFx0XHRjb25zdCB1MiA9IHVuaXQuc3ViYXJyYXkoMSwgMyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5pdFsxXSwgMjApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHUyWzBdLCAyMCk7XG5cblx0XHRcdHVuaXRbMV0gPSAxNzsgLy8gbW9kaWZ5IHVuaXQgQU5EIGIyXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5pdFsxXSwgMTcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHUyWzBdLCAxNyk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdpbmRleE9mJywgKCkgPT4ge1xuXHRcdGNvbnN0IGhheXN0YWNrID0gVlNCdWZmZXIuZnJvbVN0cmluZygnYWJjYWFiYmNjYWFhYmJiY2NjJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhheXN0YWNrLmluZGV4T2YoVlNCdWZmZXIuZnJvbVN0cmluZygnJykpLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGF5c3RhY2suaW5kZXhPZihWU0J1ZmZlci5mcm9tU3RyaW5nKCdhJy5yZXBlYXQoMTAwKSkpLCAtMSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGF5c3RhY2suaW5kZXhPZihWU0J1ZmZlci5mcm9tU3RyaW5nKCdhJykpLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGF5c3RhY2suaW5kZXhPZihWU0J1ZmZlci5mcm9tU3RyaW5nKCdjJykpLCAyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXlzdGFjay5pbmRleE9mKFZTQnVmZmVyLmZyb21TdHJpbmcoJ2FiY2FhJykpLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGF5c3RhY2suaW5kZXhPZihWU0J1ZmZlci5mcm9tU3RyaW5nKCdjYWFhYicpKSwgOCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhheXN0YWNrLmluZGV4T2YoVlNCdWZmZXIuZnJvbVN0cmluZygnY2NjJykpLCAxNSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGF5c3RhY2suaW5kZXhPZihWU0J1ZmZlci5mcm9tU3RyaW5nKCdjY2NiJykpLCAtMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dyYXAnLCAoKSA9PiB7XG5cdFx0Y29uc3QgYWN0dWFsID0gbmV3IFVpbnQ4QXJyYXkoWzEsIDIsIDNdKTtcblx0XHRjb25zdCB3cmFwcGVkID0gVlNCdWZmZXIud3JhcChhY3R1YWwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3cmFwcGVkLmJ5dGVMZW5ndGgsIDMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoQXJyYXkuZnJvbSh3cmFwcGVkLmJ1ZmZlciksIFsxLCAyLCAzXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Zyb21TdHJpbmcnLCAoKSA9PiB7XG5cdFx0Y29uc3QgdmFsdWUgPSAnSGVsbG8gV29ybGQnO1xuXHRcdGNvbnN0IGJ1ZmYgPSBWU0J1ZmZlci5mcm9tU3RyaW5nKHZhbHVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYnVmZi50b1N0cmluZygpLCB2YWx1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Zyb21CeXRlQXJyYXknLCAoKSA9PiB7XG5cdFx0Y29uc3QgYXJyYXkgPSBbMSwgMiwgMywgNCwgNV07XG5cdFx0Y29uc3QgYnVmZiA9IFZTQnVmZmVyLmZyb21CeXRlQXJyYXkoYXJyYXkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChidWZmLmJ5dGVMZW5ndGgsIGFycmF5Lmxlbmd0aCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChBcnJheS5mcm9tKGJ1ZmYuYnVmZmVyKSwgYXJyYXkpO1xuXHR9KTtcblxuXHR0ZXN0KCdjb25jYXQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY2h1bmtzID0gW1xuXHRcdFx0VlNCdWZmZXIuZnJvbVN0cmluZygnYWJjJyksXG5cdFx0XHRWU0J1ZmZlci5mcm9tU3RyaW5nKCdkZWYnKSxcblx0XHRcdFZTQnVmZmVyLmZyb21TdHJpbmcoJ2doaScpXG5cdFx0XTtcblxuXHRcdC8vIFRlc3Qgd2l0aG91dCB0b3RhbCBsZW5ndGhcblx0XHRjb25zdCByZXN1bHQxID0gVlNCdWZmZXIuY29uY2F0KGNodW5rcyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdDEudG9TdHJpbmcoKSwgJ2FiY2RlZmdoaScpO1xuXG5cdFx0Ly8gVGVzdCB3aXRoIHRvdGFsIGxlbmd0aFxuXHRcdGNvbnN0IHJlc3VsdDIgPSBWU0J1ZmZlci5jb25jYXQoY2h1bmtzLCA5KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Mi50b1N0cmluZygpLCAnYWJjZGVmZ2hpJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Nsb25lJywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gVlNCdWZmZXIuZnJvbVN0cmluZygndGVzdCcpO1xuXHRcdGNvbnN0IGNsb25lID0gb3JpZ2luYWwuY2xvbmUoKTtcblxuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChvcmlnaW5hbC5idWZmZXIsIGNsb25lLmJ1ZmZlcik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChBcnJheS5mcm9tKG9yaWdpbmFsLmJ1ZmZlciksIEFycmF5LmZyb20oY2xvbmUuYnVmZmVyKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NsaWNlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGJ1ZmYgPSBWU0J1ZmZlci5mcm9tU3RyaW5nKCdIZWxsbyBXb3JsZCcpO1xuXG5cdFx0Y29uc3Qgc2xpY2UxID0gYnVmZi5zbGljZSgwLCA1KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2xpY2UxLnRvU3RyaW5nKCksICdIZWxsbycpO1xuXG5cdFx0Y29uc3Qgc2xpY2UyID0gYnVmZi5zbGljZSg2KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2xpY2UyLnRvU3RyaW5nKCksICdXb3JsZCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdzZXQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgYnVmZiA9IFZTQnVmZmVyLmFsbG9jKDUpO1xuXG5cdFx0Ly8gVGVzdCBzZXR0aW5nIGZyb20gVlNCdWZmZXJcblx0XHRidWZmLnNldChWU0J1ZmZlci5mcm9tU3RyaW5nKCdhYicpLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYnVmZi50b1N0cmluZygpLnN1YnN0cmluZygwLCAyKSwgJ2FiJyk7XG5cblx0XHQvLyBUZXN0IHNldHRpbmcgZnJvbSBVaW50OEFycmF5XG5cdFx0YnVmZi5zZXQobmV3IFVpbnQ4QXJyYXkoWzk5LCAxMDBdKSwgMik7IC8vICdjZCdcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYnVmZi50b1N0cmluZygpLnN1YnN0cmluZygyLCA0KSwgJ2NkJyk7XG5cblx0XHQvLyBUZXN0IGludmFsaWQgaW5wdXRcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdGJ1ZmYuc2V0KHt9IGFzIGFueSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2VxdWFscycsICgpID0+IHtcblx0XHRjb25zdCBidWZmMSA9IFZTQnVmZmVyLmZyb21TdHJpbmcoJ3Rlc3QnKTtcblx0XHRjb25zdCBidWZmMiA9IFZTQnVmZmVyLmZyb21TdHJpbmcoJ3Rlc3QnKTtcblx0XHRjb25zdCBidWZmMyA9IFZTQnVmZmVyLmZyb21TdHJpbmcoJ2RpZmZlcmVudCcpO1xuXHRcdGNvbnN0IGJ1ZmY0ID0gVlNCdWZmZXIuZnJvbVN0cmluZygndGVzMScpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJ1ZmYxLmVxdWFscyhidWZmMSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChidWZmMS5lcXVhbHMoYnVmZjIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYnVmZjEuZXF1YWxzKGJ1ZmYzKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChidWZmMS5lcXVhbHMoYnVmZjQpLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlYWQvd3JpdGUgbWV0aG9kcycsICgpID0+IHtcblx0XHRjb25zdCBidWZmID0gVlNCdWZmZXIuYWxsb2MoOCk7XG5cblx0XHQvLyBUZXN0IFVJbnQzMkJFXG5cdFx0YnVmZi53cml0ZVVJbnQzMkJFKDB4MTIzNDU2NzgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChidWZmLnJlYWRVSW50MzJCRSgwKSwgMHgxMjM0NTY3OCk7XG5cblx0XHQvLyBUZXN0IFVJbnQzMkxFXG5cdFx0YnVmZi53cml0ZVVJbnQzMkxFKDB4MTIzNDU2NzgsIDQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChidWZmLnJlYWRVSW50MzJMRSg0KSwgMHgxMjM0NTY3OCk7XG5cblx0XHQvLyBUZXN0IFVJbnQ4XG5cdFx0Y29uc3QgYnVmZjIgPSBWU0J1ZmZlci5hbGxvYygxKTtcblx0XHRidWZmMi53cml0ZVVJbnQ4KDEyMywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJ1ZmYyLnJlYWRVSW50OCgwKSwgMTIzKTtcblx0fSk7XG5cblx0c3VpdGUoJ2Jhc2U2NCcsICgpID0+IHtcblx0XHQvKlxuXHRcdEdlbmVyYXRlZCB3aXRoOlxuXG5cdFx0Y29uc3QgY3J5cHRvID0gcmVxdWlyZSgnY3J5cHRvJyk7XG5cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDE2OyBpKyspIHtcblx0XHRcdGNvbnN0IGJ1ZiA9ICBjcnlwdG8ucmFuZG9tQnl0ZXMoaSk7XG5cdFx0XHRjb25zb2xlLmxvZyhgW25ldyBVaW50OEFycmF5KFske0FycmF5LmZyb20oYnVmKS5qb2luKCcsICcpfV0pLCAnJHtidWYudG9TdHJpbmcoJ2Jhc2U2NCcpfSddLGApXG5cdFx0fVxuXG5cdFx0Ki9cblxuXHRcdGNvbnN0IHRlc3RDYXNlczogW1VpbnQ4QXJyYXksIHN0cmluZ11bXSA9IFtcblx0XHRcdFtuZXcgVWludDhBcnJheShbXSksICcnXSxcblx0XHRcdFtuZXcgVWludDhBcnJheShbNTZdKSwgJ09BPT0nXSxcblx0XHRcdFtuZXcgVWludDhBcnJheShbMjA5LCA0XSksICcwUVE9J10sXG5cdFx0XHRbbmV3IFVpbnQ4QXJyYXkoWzE5LCA1NywgMTE5XSksICdFemwzJ10sXG5cdFx0XHRbbmV3IFVpbnQ4QXJyYXkoWzE5OSwgMjM3LCAyMDcsIDExMl0pLCAneCszUGNBPT0nXSxcblx0XHRcdFtuZXcgVWludDhBcnJheShbNTksIDE5MywgMTczLCAyNiwgMjQyXSksICdPOEd0R3ZJPSddLFxuXHRcdFx0W25ldyBVaW50OEFycmF5KFs4MSwgMjI2LCA5NSwgMjMxLCAxMTYsIDEyNl0pLCAnVWVKZjUzUisnXSxcblx0XHRcdFtuZXcgVWludDhBcnJheShbMTEsIDE2NCwgMjUzLCA4NSwgOCwgNiwgNTZdKSwgJ0M2VDlWUWdHT0E9PSddLFxuXHRcdFx0W25ldyBVaW50OEFycmF5KFsxNjQsIDE2LCA4OCwgODgsIDIyNCwgMTczLCAxNDQsIDExNF0pLCAncEJCWVdPQ3RrSEk9J10sXG5cdFx0XHRbbmV3IFVpbnQ4QXJyYXkoWzAsIDE5NiwgOTksIDEyLCAyMSwgMjI5LCA3OCwgMTAxLCAxM10pLCAnQU1SakRCWGxUbVVOJ10sXG5cdFx0XHRbbmV3IFVpbnQ4QXJyYXkoWzE2NywgMTE0LCAyMjUsIDExNiwgMjI2LCA4MywgNTEsIDQ4LCA4OCwgMTE0XSksICdwM0xoZE9KVE16QlljZz09J10sXG5cdFx0XHRbbmV3IFVpbnQ4QXJyYXkoWzc1LCAzMywgMTE4LCAxMCwgNzcsIDUsIDE2OCwgMTk0LCA1OSwgNDcsIDU5XSksICdTeUYyQ2swRnFNSTdMenM9J10sXG5cdFx0XHRbbmV3IFVpbnQ4QXJyYXkoWzIwMywgMTgyLCAxNjUsIDUxLCAyMDgsIDI3LCAxMjMsIDIyMywgMTEyLCAxOTgsIDEyNywgMTQ3XSksICd5N2FsTTlBYmU5OXd4bitUJ10sXG5cdFx0XHRbbmV3IFVpbnQ4QXJyYXkoWzE1NCwgOTMsIDIyMiwgNDEsIDExNywgMjM0LCAyNTAsIDg1LCA5NSwgMTQ0LCAxNiwgOTQsIDE4XSksICdtbDNlS1hYcStsVmZrQkJlRWc9PSddLFxuXHRcdFx0W25ldyBVaW50OEFycmF5KFsyNDYsIDE4NiwgODgsIDEwNSwgMTkyLCA1NywgMjUsIDE2OCwgMTgzLCAxNjQsIDEwMywgMTYyLCAyNDMsIDU2XSksICc5cnBZYWNBNUdhaTNwR2VpOHpnPSddLFxuXHRcdFx0W25ldyBVaW50OEFycmF5KFsxNDksIDI0MCwgMTU1LCA5NiwgMzAsIDU1LCAxNjIsIDE3MiwgMTkxLCAxODcsIDMzLCAxMjQsIDE2OSwgMTgzLCAyNTRdKSwgJ2xmQ2JZQjQzb3F5L3V5RjhxYmYrJ10sXG5cdFx0XTtcblxuXHRcdHRlc3QoJ2VuY29kZXMnLCAoKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IFtieXRlcywgZXhwZWN0ZWRdIG9mIHRlc3RDYXNlcykge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW5jb2RlQmFzZTY0KFZTQnVmZmVyLndyYXAoYnl0ZXMpKSwgZXhwZWN0ZWQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZGVjb2RlcycsICgpID0+IHtcblx0XHRcdGZvciAoY29uc3QgW2V4cGVjdGVkLCBlbmNvZGVkXSBvZiB0ZXN0Q2FzZXMpIHtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXcgVWludDhBcnJheShkZWNvZGVCYXNlNjQoZW5jb2RlZCkuYnVmZmVyKSwgZXhwZWN0ZWQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGVzdCgndGhyb3dzIGVycm9yIG9uIGludmFsaWQgZW5jb2RpbmcnLCAoKSA9PiB7XG5cdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IGRlY29kZUJhc2U2NCgnaW52YWxpZCEnKSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsd0JBQXdCLGtCQUFrQixnQkFBZ0IsY0FBYyxjQUFjLDBCQUEwQixrQkFBa0IsZ0JBQWdCLGdCQUFnQjtBQUMzSyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLCtDQUErQztBQUV4RCxNQUFNLFVBQVUsTUFBTTtBQUVyQiwwQ0FBd0M7QUFFeEMsT0FBSyxvREFBb0QsTUFB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
