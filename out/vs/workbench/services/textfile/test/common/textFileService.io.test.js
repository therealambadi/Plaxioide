import assert from "assert";
import { snapshotToString, TextFileOperationResult, stringToSnapshot } from "../../common/textfiles.js";
import { URI } from "../../../../../base/common/uri.js";
import { join, basename } from "../../../../../base/common/path.js";
import { UTF16le, UTF8_with_bom, UTF16be, UTF8, UTF16le_BOM, UTF16be_BOM, UTF8_BOM } from "../../common/encoding.js";
import { bufferToStream, VSBuffer } from "../../../../../base/common/buffer.js";
import { createTextModel } from "../../../../../editor/test/common/testTextModel.js";
import { DefaultEndOfLine } from "../../../../../editor/common/model.js";
import { isWindows } from "../../../../../base/common/platform.js";
import { createTextBufferFactoryFromStream } from "../../../../../editor/common/model/textModel.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
function createSuite(params) {
  let service;
  let testDir = "";
  const { exists, stat, readFile, detectEncodingByBOM } = params;
  const disposables = new DisposableStore();
  setup(async () => {
    const result = await params.setup();
    service = result.service;
    testDir = result.testDir;
  });
  teardown(async () => {
    await params.teardown();
    disposables.clear();
  });
  test("create - no encoding - content empty", async () => {
    const resource = URI.file(join(testDir, "small_new.txt"));
    await service.create([{ resource }]);
    const res = await readFile(resource.fsPath);
    assert.strictEqual(
      res.byteLength,
      0
      /* no BOM */
    );
  });
  test("create - no encoding - content provided (string)", async () => {
    const resource = URI.file(join(testDir, "small_new.txt"));
    await service.create([{ resource, value: "Hello World" }]);
    const res = await readFile(resource.fsPath);
    assert.strictEqual(res.toString(), "Hello World");
    assert.strictEqual(res.byteLength, "Hello World".length);
  });
  test("create - no encoding - content provided (snapshot)", async () => {
    const resource = URI.file(join(testDir, "small_new.txt"));
    await service.create([{ resource, value: stringToSnapshot("Hello World") }]);
    const res = await readFile(resource.fsPath);
    assert.strictEqual(res.toString(), "Hello World");
    assert.strictEqual(res.byteLength, "Hello World".length);
  });
  test("create - UTF 16 LE - no content", async () => {
    const resource = URI.file(join(testDir, "small_new.utf16le"));
    await service.create([{ resource }]);
    assert.strictEqual(await exists(resource.fsPath), true);
    const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, UTF16le);
    const res = await readFile(resource.fsPath);
    assert.strictEqual(res.byteLength, UTF16le_BOM.length);
  });
  test("create - UTF 16 LE - content provided", async () => {
    const resource = URI.file(join(testDir, "small_new.utf16le"));
    await service.create([{ resource, value: "Hello World" }]);
    assert.strictEqual(await exists(resource.fsPath), true);
    const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, UTF16le);
    const res = await readFile(resource.fsPath);
    assert.strictEqual(res.byteLength, "Hello World".length * 2 + UTF16le_BOM.length);
  });
  test("create - UTF 16 BE - no content", async () => {
    const resource = URI.file(join(testDir, "small_new.utf16be"));
    await service.create([{ resource }]);
    assert.strictEqual(await exists(resource.fsPath), true);
    const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, UTF16be);
    const res = await readFile(resource.fsPath);
    assert.strictEqual(res.byteLength, UTF16le_BOM.length);
  });
  test("create - UTF 16 BE - content provided", async () => {
    const resource = URI.file(join(testDir, "small_new.utf16be"));
    await service.create([{ resource, value: "Hello World" }]);
    assert.strictEqual(await exists(resource.fsPath), true);
    const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, UTF16be);
    const res = await readFile(resource.fsPath);
    assert.strictEqual(res.byteLength, "Hello World".length * 2 + UTF16be_BOM.length);
  });
  test("create - UTF 8 BOM - no content", async () => {
    const resource = URI.file(join(testDir, "small_new.utf8bom"));
    await service.create([{ resource }]);
    assert.strictEqual(await exists(resource.fsPath), true);
    const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, UTF8_with_bom);
    const res = await readFile(resource.fsPath);
    assert.strictEqual(res.byteLength, UTF8_BOM.length);
  });
  test("create - UTF 8 BOM - content provided", async () => {
    const resource = URI.file(join(testDir, "small_new.utf8bom"));
    await service.create([{ resource, value: "Hello World" }]);
    assert.strictEqual(await exists(resource.fsPath), true);
    const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, UTF8_with_bom);
    const res = await readFile(resource.fsPath);
    assert.strictEqual(res.byteLength, "Hello World".length + UTF8_BOM.length);
  });
  function createTextModelSnapshot(text, preserveBOM) {
    const textModel = disposables.add(createTextModel(text));
    const snapshot = textModel.createSnapshot(preserveBOM);
    return snapshot;
  }
  test("create - UTF 8 BOM - empty content - snapshot", async () => {
    const resource = URI.file(join(testDir, "small_new.utf8bom"));
    await service.create([{ resource, value: createTextModelSnapshot("") }]);
    assert.strictEqual(await exists(resource.fsPath), true);
    const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, UTF8_with_bom);
    const res = await readFile(resource.fsPath);
    assert.strictEqual(res.byteLength, UTF8_BOM.length);
  });
  test("create - UTF 8 BOM - content provided - snapshot", async () => {
    const resource = URI.file(join(testDir, "small_new.utf8bom"));
    await service.create([{ resource, value: createTextModelSnapshot("Hello World") }]);
    assert.strictEqual(await exists(resource.fsPath), true);
    const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, UTF8_with_bom);
    const res = await readFile(resource.fsPath);
    assert.strictEqual(res.byteLength, "Hello World".length + UTF8_BOM.length);
  });
  test("write - use encoding (UTF 16 BE) - small content as string", async () => {
    await testEncoding(URI.file(join(testDir, "small.txt")), UTF16be, "Hello\nWorld", "Hello\nWorld");
  });
  test("write - use encoding (UTF 16 BE) - small content as snapshot", async () => {
    await testEncoding(URI.file(join(testDir, "small.txt")), UTF16be, createTextModelSnapshot("Hello\nWorld"), "Hello\nWorld");
  });
  test("write - use encoding (UTF 16 BE) - large content as string", async () => {
    await testEncoding(URI.file(join(testDir, "lorem.txt")), UTF16be, "Hello\nWorld", "Hello\nWorld");
  });
  test("write - use encoding (UTF 16 BE) - large content as snapshot", async () => {
    await testEncoding(URI.file(join(testDir, "lorem.txt")), UTF16be, createTextModelSnapshot("Hello\nWorld"), "Hello\nWorld");
  });
  async function testEncoding(resource, encoding, content, expectedContent) {
    await service.write(resource, content, { encoding });
    const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, encoding);
    const resolved = await service.readStream(resource);
    assert.strictEqual(resolved.encoding, encoding);
    const textBuffer = disposables.add(resolved.value.create(isWindows ? DefaultEndOfLine.CRLF : DefaultEndOfLine.LF).textBuffer);
    assert.strictEqual(snapshotToString(textBuffer.createSnapshot(false)), expectedContent);
  }
  test("write - use encoding (cp1252)", async () => {
    const filePath = join(testDir, "some_cp1252.txt");
    const contents = await readFile(filePath, "utf8");
    const eol = /\r\n/.test(contents) ? "\r\n" : "\n";
    await testEncodingKeepsData(URI.file(filePath), "cp1252", ['ObjectCount = LoadObjects("\xD6ffentlicher Ordner");', "", 'Private = "Pers\xF6nliche Information"', ""].join(eol));
  });
  test("write - use encoding (shiftjis)", async () => {
    await testEncodingKeepsData(URI.file(join(testDir, "some_shiftjis.txt")), "shiftjis", "\u4E2D\u6587abc");
  });
  test("write - use encoding (gbk)", async () => {
    await testEncodingKeepsData(URI.file(join(testDir, "some_gbk.txt")), "gbk", "\u4E2D\u56FDabc");
  });
  test("write - use encoding (cyrillic)", async () => {
    await testEncodingKeepsData(URI.file(join(testDir, "some_cyrillic.txt")), "cp866", "\u0410\u0411\u0412\u0413\u0414\u0415\u0416\u0417\u0418\u0419\u041A\u041B\u041C\u041D\u041E\u041F\u0420\u0421\u0422\u0423\u0424\u0425\u0426\u0427\u0428\u0429\u042A\u042B\u042C\u042D\u042E\u042F\u0430\u0431\u0432\u0433\u0434\u0435\u0436\u0437\u0438\u0439\u043A\u043B\u043C\u043D\u043E\u043F\u0440\u0441\u0442\u0443\u0444\u0445\u0446\u0447\u0448\u0449\u044A\u044B\u044C\u044D\u044E\u044F");
  });
  test("write - use encoding (big5)", async () => {
    await testEncodingKeepsData(URI.file(join(testDir, "some_big5.txt")), "cp950", "\u4E2D\u6587abc");
  });
  async function testEncodingKeepsData(resource, encoding, expected) {
    let resolved = await service.readStream(resource, { encoding });
    const textBuffer = disposables.add(resolved.value.create(isWindows ? DefaultEndOfLine.CRLF : DefaultEndOfLine.LF).textBuffer);
    const content = snapshotToString(textBuffer.createSnapshot(false));
    assert.strictEqual(content, expected);
    await service.write(resource, content, { encoding });
    resolved = await service.readStream(resource, { encoding });
    const textBuffer2 = disposables.add(resolved.value.create(DefaultEndOfLine.CRLF).textBuffer);
    assert.strictEqual(snapshotToString(textBuffer2.createSnapshot(false)), content);
    await service.write(resource, createTextModelSnapshot(content), { encoding });
    resolved = await service.readStream(resource, { encoding });
    const textBuffer3 = disposables.add(resolved.value.create(DefaultEndOfLine.CRLF).textBuffer);
    assert.strictEqual(snapshotToString(textBuffer3.createSnapshot(false)), content);
  }
  test("write - no encoding - content as string", async () => {
    const resource = URI.file(join(testDir, "small.txt"));
    const content = (await readFile(resource.fsPath)).toString();
    await service.write(resource, content);
    const resolved = await service.readStream(resource);
    assert.strictEqual(resolved.value.getFirstLineText(999999), content);
  });
  test("write - no encoding - content as snapshot", async () => {
    const resource = URI.file(join(testDir, "small.txt"));
    const content = (await readFile(resource.fsPath)).toString();
    await service.write(resource, createTextModelSnapshot(content));
    const resolved = await service.readStream(resource);
    assert.strictEqual(resolved.value.getFirstLineText(999999), content);
  });
  test("write - encoding preserved (UTF 16 LE) - content as string", async () => {
    const resource = URI.file(join(testDir, "some_utf16le.css"));
    const resolved = await service.readStream(resource);
    assert.strictEqual(resolved.encoding, UTF16le);
    await testEncoding(URI.file(join(testDir, "some_utf16le.css")), UTF16le, "Hello\nWorld", "Hello\nWorld");
  });
  test("write - encoding preserved (UTF 16 LE) - content as snapshot", async () => {
    const resource = URI.file(join(testDir, "some_utf16le.css"));
    const resolved = await service.readStream(resource);
    assert.strictEqual(resolved.encoding, UTF16le);
    await testEncoding(URI.file(join(testDir, "some_utf16le.css")), UTF16le, createTextModelSnapshot("Hello\nWorld"), "Hello\nWorld");
  });
  test("write - UTF8 variations - content as string", async () => {
    const resource = URI.file(join(testDir, "index.html"));
    let detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, null);
    const content = (await readFile(resource.fsPath)).toString() + "updates";
    await service.write(resource, content, { encoding: UTF8_with_bom });
    detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, UTF8_with_bom);
    await service.write(resource, content, { encoding: UTF8_with_bom });
    detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, UTF8_with_bom);
    await service.write(resource, content, { encoding: UTF8 });
    detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, null);
    await service.write(resource, content, { encoding: UTF8 });
    detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, null);
  });
  test("write - UTF8 variations - content as snapshot", async () => {
    const resource = URI.file(join(testDir, "index.html"));
    let detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, null);
    const model = disposables.add(createTextModel((await readFile(resource.fsPath)).toString() + "updates"));
    await service.write(resource, model.createSnapshot(), { encoding: UTF8_with_bom });
    detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, UTF8_with_bom);
    await service.write(resource, model.createSnapshot(), { encoding: UTF8_with_bom });
    detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, UTF8_with_bom);
    await service.write(resource, model.createSnapshot(), { encoding: UTF8 });
    detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, null);
    await service.write(resource, model.createSnapshot(), { encoding: UTF8 });
    detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, null);
  });
  test("write - preserve UTF8 BOM - content as string", async () => {
    const resource = URI.file(join(testDir, "some_utf8_bom.txt"));
    let detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, UTF8_with_bom);
    await service.write(resource, "Hello World", { encoding: detectedEncoding });
    detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, UTF8_with_bom);
  });
  test("write - ensure BOM in empty file - content as string", async () => {
    const resource = URI.file(join(testDir, "small.txt"));
    await service.write(resource, "", { encoding: UTF8_with_bom });
    const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, UTF8_with_bom);
  });
  test("write - ensure BOM in empty file - content as snapshot", async () => {
    const resource = URI.file(join(testDir, "small.txt"));
    await service.write(resource, createTextModelSnapshot(""), { encoding: UTF8_with_bom });
    const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
    assert.strictEqual(detectedEncoding, UTF8_with_bom);
  });
  test("readStream - small text", async () => {
    const resource = URI.file(join(testDir, "small.txt"));
    await testReadStream(resource);
  });
  test("readStream - large text", async () => {
    const resource = URI.file(join(testDir, "lorem.txt"));
    await testReadStream(resource);
  });
  async function testReadStream(resource) {
    const result = await service.readStream(resource);
    assert.strictEqual(result.name, basename(resource.fsPath));
    assert.strictEqual(result.size, (await stat(resource.fsPath)).size);
    const content = (await readFile(resource.fsPath)).toString();
    const textBuffer = disposables.add(result.value.create(DefaultEndOfLine.LF).textBuffer);
    assert.strictEqual(
      snapshotToString(textBuffer.createSnapshot(false)),
      snapshotToString(createTextModelSnapshot(content, false))
    );
  }
  test("read - small text", async () => {
    const resource = URI.file(join(testDir, "small.txt"));
    await testRead(resource);
  });
  test("read - large text", async () => {
    const resource = URI.file(join(testDir, "lorem.txt"));
    await testRead(resource);
  });
  async function testRead(resource) {
    const result = await service.read(resource);
    assert.strictEqual(result.name, basename(resource.fsPath));
    assert.strictEqual(result.size, (await stat(resource.fsPath)).size);
    assert.strictEqual(result.value, (await readFile(resource.fsPath)).toString());
  }
  test("readStream - encoding picked up (CP1252)", async () => {
    const resource = URI.file(join(testDir, "some_small_cp1252.txt"));
    const encoding = "windows1252";
    const result = await service.readStream(resource, { encoding });
    assert.strictEqual(result.encoding, encoding);
    assert.strictEqual(result.value.getFirstLineText(999999), 'Private = "Pers\xF6nliche\xDF Information"');
  });
  test("read - encoding picked up (CP1252)", async () => {
    const resource = URI.file(join(testDir, "some_small_cp1252.txt"));
    const encoding = "windows1252";
    const result = await service.read(resource, { encoding });
    assert.strictEqual(result.encoding, encoding);
    assert.strictEqual(result.value, 'Private = "Pers\xF6nliche\xDF Information"');
  });
  test("read - encoding picked up (binary)", async () => {
    const resource = URI.file(join(testDir, "some_small_cp1252.txt"));
    const encoding = "binary";
    const result = await service.read(resource, { encoding });
    assert.strictEqual(result.encoding, encoding);
    assert.strictEqual(result.value, 'Private = "Pers\xF6nliche\xDF Information"');
  });
  test("read - encoding picked up (base64)", async () => {
    const resource = URI.file(join(testDir, "some_small_cp1252.txt"));
    const encoding = "base64";
    const result = await service.read(resource, { encoding });
    assert.strictEqual(result.encoding, encoding);
    assert.strictEqual(result.value, btoa('Private = "Pers\xF6nliche\xDF Information"'));
  });
  test("readStream - user overrides BOM", async () => {
    const resource = URI.file(join(testDir, "some_utf16le.css"));
    const result = await service.readStream(resource, { encoding: "windows1252" });
    assert.strictEqual(result.encoding, "windows1252");
  });
  test("readStream - BOM removed", async () => {
    const resource = URI.file(join(testDir, "some_utf8_bom.txt"));
    const result = await service.readStream(resource);
    assert.strictEqual(result.value.getFirstLineText(999999), "This is some UTF 8 with BOM file.");
  });
  test("readStream - invalid encoding", async () => {
    const resource = URI.file(join(testDir, "index.html"));
    const result = await service.readStream(resource, { encoding: "superduper" });
    assert.strictEqual(result.encoding, "utf8");
  });
  test("readStream - encoding override", async () => {
    const resource = URI.file(join(testDir, "some.utf16le"));
    const result = await service.readStream(resource, { encoding: "windows1252" });
    assert.strictEqual(result.encoding, "utf16le");
    assert.strictEqual(result.value.getFirstLineText(999999), "This is some UTF 16 with BOM file.");
  });
  test("readStream - large Big5", async () => {
    await testLargeEncoding("big5", "\u4E2D\u6587abc");
  });
  test("readStream - large CP1252", async () => {
    await testLargeEncoding("cp1252", "\xF6\xE4\xFC\xDF");
  });
  test("readStream - large Cyrillic", async () => {
    await testLargeEncoding("cp866", "\u0410\u0411\u0412\u0413\u0414\u0415\u0416\u0417\u0418\u0419\u041A\u041B\u041C\u041D\u041E\u041F\u0420\u0421\u0422\u0423\u0424\u0425\u0426\u0427\u0428\u0429\u042A\u042B\u042C\u042D\u042E\u042F\u0430\u0431\u0432\u0433\u0434\u0435\u0436\u0437\u0438\u0439\u043A\u043B\u043C\u043D\u043E\u043F\u0440\u0441\u0442\u0443\u0444\u0445\u0446\u0447\u0448\u0449\u044A\u044B\u044C\u044D\u044E\u044F");
  });
  test("readStream - large GBK", async () => {
    await testLargeEncoding("gbk", "\u4E2D\u56FDabc");
  });
  test("readStream - large ShiftJIS", async () => {
    await testLargeEncoding("shiftjis", "\u4E2D\u6587abc");
  });
  test("readStream - large UTF8 BOM", async () => {
    await testLargeEncoding("utf8bom", "\xF6\xE4\xFC\xDF");
  });
  test("readStream - large UTF16 LE", async () => {
    await testLargeEncoding("utf16le", "\xF6\xE4\xFC\xDF");
  });
  test("readStream - large UTF16 BE", async () => {
    await testLargeEncoding("utf16be", "\xF6\xE4\xFC\xDF");
  });
  async function testLargeEncoding(encoding, needle) {
    const resource = URI.file(join(testDir, `lorem_${encoding}.txt`));
    const result = await service.readStream(resource, { encoding });
    assert.strictEqual(result.encoding, encoding);
    const textBuffer = disposables.add(result.value.create(DefaultEndOfLine.LF).textBuffer);
    let contents = snapshotToString(textBuffer.createSnapshot(false));
    assert.strictEqual(contents.indexOf(needle), 0);
    assert.ok(contents.indexOf(needle, 10) > 0);
    const rawFile = await params.readFile(resource.fsPath);
    let rawFileVSBuffer;
    if (rawFile instanceof VSBuffer) {
      rawFileVSBuffer = rawFile;
    } else {
      rawFileVSBuffer = VSBuffer.wrap(rawFile);
    }
    const factory = await createTextBufferFactoryFromStream(await service.getDecodedStream(resource, bufferToStream(rawFileVSBuffer), { encoding }));
    const textBuffer2 = disposables.add(factory.create(DefaultEndOfLine.LF).textBuffer);
    contents = snapshotToString(textBuffer2.createSnapshot(false));
    assert.strictEqual(contents.indexOf(needle), 0);
    assert.ok(contents.indexOf(needle, 10) > 0);
  }
  test("readStream - UTF16 LE (no BOM)", async () => {
    const resource = URI.file(join(testDir, "utf16_le_nobom.txt"));
    const result = await service.readStream(resource);
    assert.strictEqual(result.encoding, "utf16le");
  });
  test("readStream - UTF16 BE (no BOM)", async () => {
    const resource = URI.file(join(testDir, "utf16_be_nobom.txt"));
    const result = await service.readStream(resource);
    assert.strictEqual(result.encoding, "utf16be");
  });
  test("readStream - autoguessEncoding", async () => {
    const resource = URI.file(join(testDir, "some_cp1252.txt"));
    const result = await service.readStream(resource, { autoGuessEncoding: true });
    assert.strictEqual(result.encoding, "windows1252");
  });
  test("readStream - autoguessEncoding (candidateGuessEncodings)", async () => {
    const resource = URI.file(join(testDir, "some.shiftjis.1.txt"));
    const result = await service.readStream(resource, { autoGuessEncoding: true, candidateGuessEncodings: ["utf-8", "shiftjis", "euc-jp"] });
    assert.strictEqual(result.encoding, "shiftjis");
  });
  test("readStream - autoguessEncoding (candidateGuessEncodings is Empty)", async () => {
    const resource = URI.file(join(testDir, "some_cp1252.txt"));
    const result = await service.readStream(resource, { autoGuessEncoding: true, candidateGuessEncodings: [] });
    assert.strictEqual(result.encoding, "windows1252");
  });
  test("readStream - FILE_IS_BINARY", async () => {
    const resource = URI.file(join(testDir, "binary.txt"));
    let error = void 0;
    try {
      await service.readStream(resource, { acceptTextOnly: true });
    } catch (err) {
      error = err;
    }
    assert.ok(error);
    assert.strictEqual(error.textFileOperationResult, TextFileOperationResult.FILE_IS_BINARY);
    const result = await service.readStream(URI.file(join(testDir, "small.txt")), { acceptTextOnly: true });
    assert.strictEqual(result.name, "small.txt");
  });
  test("read - FILE_IS_BINARY", async () => {
    const resource = URI.file(join(testDir, "binary.txt"));
    let error = void 0;
    try {
      await service.read(resource, { acceptTextOnly: true });
    } catch (err) {
      error = err;
    }
    assert.ok(error);
    assert.strictEqual(error.textFileOperationResult, TextFileOperationResult.FILE_IS_BINARY);
    const result = await service.read(URI.file(join(testDir, "small.txt")), { acceptTextOnly: true });
    assert.strictEqual(result.name, "small.txt");
  });
}
export {
  createSuite as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGV4dGZpbGUvdGVzdC9jb21tb24vdGV4dEZpbGVTZXJ2aWNlLmlvLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBJVGV4dEZpbGVTZXJ2aWNlLCBzbmFwc2hvdFRvU3RyaW5nLCBUZXh0RmlsZU9wZXJhdGlvbkVycm9yLCBUZXh0RmlsZU9wZXJhdGlvblJlc3VsdCwgc3RyaW5nVG9TbmFwc2hvdCB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXh0ZmlsZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGpvaW4sIGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBVVEYxNmxlLCBVVEY4X3dpdGhfYm9tLCBVVEYxNmJlLCBVVEY4LCBVVEYxNmxlX0JPTSwgVVRGMTZiZV9CT00sIFVURjhfQk9NIH0gZnJvbSAnLi4vLi4vY29tbW9uL2VuY29kaW5nLmpzJztcbmltcG9ydCB7IGJ1ZmZlclRvU3RyZWFtLCBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvdGVzdC9jb21tb24vdGVzdFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJVGV4dFNuYXBzaG90LCBEZWZhdWx0RW5kT2ZMaW5lIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0QnVmZmVyRmFjdG9yeUZyb21TdHJlYW0gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsL3RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFBhcmFtcyB7XG5cdHNldHVwKCk6IFByb21pc2U8e1xuXHRcdHNlcnZpY2U6IElUZXh0RmlsZVNlcnZpY2U7XG5cdFx0dGVzdERpcjogc3RyaW5nO1xuXHR9Pjtcblx0dGVhcmRvd24oKTogUHJvbWlzZTx2b2lkPjtcblxuXHRleGlzdHMoZnNQYXRoOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+O1xuXHRzdGF0KGZzUGF0aDogc3RyaW5nKTogUHJvbWlzZTx7IHNpemU6IG51bWJlciB9Pjtcblx0cmVhZEZpbGUoZnNQYXRoOiBzdHJpbmcpOiBQcm9taXNlPFZTQnVmZmVyIHwgQnVmZmVyPjtcblx0cmVhZEZpbGUoZnNQYXRoOiBzdHJpbmcsIGVuY29kaW5nOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz47XG5cdHJlYWRGaWxlKGZzUGF0aDogc3RyaW5nLCBlbmNvZGluZz86IHN0cmluZyk6IFByb21pc2U8VlNCdWZmZXIgfCBCdWZmZXIgfCBzdHJpbmc+O1xuXHRkZXRlY3RFbmNvZGluZ0J5Qk9NKGZzUGF0aDogc3RyaW5nKTogUHJvbWlzZTx0eXBlb2YgVVRGMTZiZSB8IHR5cGVvZiBVVEYxNmxlIHwgdHlwZW9mIFVURjhfd2l0aF9ib20gfCBudWxsPjtcbn1cblxuLyoqXG4gKiBBbGxvd3MgdXMgdG8gcmV1c2UgdGVzdCBzdWl0ZSBhY3Jvc3MgZGlmZmVyZW50IGVudmlyb25tZW50cy5cbiAqXG4gKiBJdCBpbnRyb2R1Y2VzIGEgYml0IG9mIGNvbXBsZXhpdHkgd2l0aCBzZXR1cCBhbmQgdGVhcmRvd24sIGhvd2V2ZXJcbiAqIGl0IGhlbHBzIHVzIHRvIGVuc3VyZSB0aGF0IHRlc3RzIGFyZSBhZGRlZCBmb3IgYWxsIGVudmlyb25tZW50cyBhdCBvbmNlLFxuICogaGVuY2UgaGVscHMgdXMgY2F0Y2ggYnVncyBiZXR0ZXIuXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGNyZWF0ZVN1aXRlKHBhcmFtczogUGFyYW1zKSB7XG5cdGxldCBzZXJ2aWNlOiBJVGV4dEZpbGVTZXJ2aWNlO1xuXHRsZXQgdGVzdERpciA9ICcnO1xuXHRjb25zdCB7IGV4aXN0cywgc3RhdCwgcmVhZEZpbGUsIGRldGVjdEVuY29kaW5nQnlCT00gfSA9IHBhcmFtcztcblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhcmFtcy5zZXR1cCgpO1xuXHRcdHNlcnZpY2UgPSByZXN1bHQuc2VydmljZTtcblx0XHR0ZXN0RGlyID0gcmVzdWx0LnRlc3REaXI7XG5cdH0pO1xuXG5cdHRlYXJkb3duKGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBwYXJhbXMudGVhcmRvd24oKTtcblx0XHRkaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGUgLSBubyBlbmNvZGluZyAtIGNvbnRlbnQgZW1wdHknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZShqb2luKHRlc3REaXIsICdzbWFsbF9uZXcudHh0JykpO1xuXG5cdFx0YXdhaXQgc2VydmljZS5jcmVhdGUoW3sgcmVzb3VyY2UgfV0pO1xuXG5cdFx0Y29uc3QgcmVzID0gYXdhaXQgcmVhZEZpbGUocmVzb3VyY2UuZnNQYXRoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLmJ5dGVMZW5ndGgsIDAgLyogbm8gQk9NICovKTtcblx0fSk7XG5cblx0dGVzdCgnY3JlYXRlIC0gbm8gZW5jb2RpbmcgLSBjb250ZW50IHByb3ZpZGVkIChzdHJpbmcpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoam9pbih0ZXN0RGlyLCAnc21hbGxfbmV3LnR4dCcpKTtcblxuXHRcdGF3YWl0IHNlcnZpY2UuY3JlYXRlKFt7IHJlc291cmNlLCB2YWx1ZTogJ0hlbGxvIFdvcmxkJyB9XSk7XG5cblx0XHRjb25zdCByZXMgPSBhd2FpdCByZWFkRmlsZShyZXNvdXJjZS5mc1BhdGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMudG9TdHJpbmcoKSwgJ0hlbGxvIFdvcmxkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5ieXRlTGVuZ3RoLCAnSGVsbG8gV29ybGQnLmxlbmd0aCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NyZWF0ZSAtIG5vIGVuY29kaW5nIC0gY29udGVudCBwcm92aWRlZCAoc25hcHNob3QpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoam9pbih0ZXN0RGlyLCAnc21hbGxfbmV3LnR4dCcpKTtcblxuXHRcdGF3YWl0IHNlcnZpY2UuY3JlYXRlKFt7IHJlc291cmNlLCB2YWx1ZTogc3RyaW5nVG9TbmFwc2hvdCgnSGVsbG8gV29ybGQnKSB9XSk7XG5cblx0XHRjb25zdCByZXMgPSBhd2FpdCByZWFkRmlsZShyZXNvdXJjZS5mc1BhdGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMudG9TdHJpbmcoKSwgJ0hlbGxvIFdvcmxkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5ieXRlTGVuZ3RoLCAnSGVsbG8gV29ybGQnLmxlbmd0aCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NyZWF0ZSAtIFVURiAxNiBMRSAtIG5vIGNvbnRlbnQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZShqb2luKHRlc3REaXIsICdzbWFsbF9uZXcudXRmMTZsZScpKTtcblxuXHRcdGF3YWl0IHNlcnZpY2UuY3JlYXRlKFt7IHJlc291cmNlIH1dKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBleGlzdHMocmVzb3VyY2UuZnNQYXRoKSwgdHJ1ZSk7XG5cblx0XHRjb25zdCBkZXRlY3RlZEVuY29kaW5nID0gYXdhaXQgZGV0ZWN0RW5jb2RpbmdCeUJPTShyZXNvdXJjZS5mc1BhdGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXRlY3RlZEVuY29kaW5nLCBVVEYxNmxlKTtcblxuXHRcdGNvbnN0IHJlcyA9IGF3YWl0IHJlYWRGaWxlKHJlc291cmNlLmZzUGF0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5ieXRlTGVuZ3RoLCBVVEYxNmxlX0JPTS5sZW5ndGgpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGUgLSBVVEYgMTYgTEUgLSBjb250ZW50IHByb3ZpZGVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoam9pbih0ZXN0RGlyLCAnc21hbGxfbmV3LnV0ZjE2bGUnKSk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLmNyZWF0ZShbeyByZXNvdXJjZSwgdmFsdWU6ICdIZWxsbyBXb3JsZCcgfV0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IGV4aXN0cyhyZXNvdXJjZS5mc1BhdGgpLCB0cnVlKTtcblxuXHRcdGNvbnN0IGRldGVjdGVkRW5jb2RpbmcgPSBhd2FpdCBkZXRlY3RFbmNvZGluZ0J5Qk9NKHJlc291cmNlLmZzUGF0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRldGVjdGVkRW5jb2RpbmcsIFVURjE2bGUpO1xuXG5cdFx0Y29uc3QgcmVzID0gYXdhaXQgcmVhZEZpbGUocmVzb3VyY2UuZnNQYXRoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLmJ5dGVMZW5ndGgsICdIZWxsbyBXb3JsZCcubGVuZ3RoICogMiAvKiBVVEYxNiAyYnl0ZXMgcGVyIGNoYXIgKi8gKyBVVEYxNmxlX0JPTS5sZW5ndGgpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGUgLSBVVEYgMTYgQkUgLSBubyBjb250ZW50JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoam9pbih0ZXN0RGlyLCAnc21hbGxfbmV3LnV0ZjE2YmUnKSk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLmNyZWF0ZShbeyByZXNvdXJjZSB9XSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgZXhpc3RzKHJlc291cmNlLmZzUGF0aCksIHRydWUpO1xuXG5cdFx0Y29uc3QgZGV0ZWN0ZWRFbmNvZGluZyA9IGF3YWl0IGRldGVjdEVuY29kaW5nQnlCT00ocmVzb3VyY2UuZnNQYXRoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGV0ZWN0ZWRFbmNvZGluZywgVVRGMTZiZSk7XG5cblx0XHRjb25zdCByZXMgPSBhd2FpdCByZWFkRmlsZShyZXNvdXJjZS5mc1BhdGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMuYnl0ZUxlbmd0aCwgVVRGMTZsZV9CT00ubGVuZ3RoKTtcblx0fSk7XG5cblx0dGVzdCgnY3JlYXRlIC0gVVRGIDE2IEJFIC0gY29udGVudCBwcm92aWRlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKGpvaW4odGVzdERpciwgJ3NtYWxsX25ldy51dGYxNmJlJykpO1xuXG5cdFx0YXdhaXQgc2VydmljZS5jcmVhdGUoW3sgcmVzb3VyY2UsIHZhbHVlOiAnSGVsbG8gV29ybGQnIH1dKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBleGlzdHMocmVzb3VyY2UuZnNQYXRoKSwgdHJ1ZSk7XG5cblx0XHRjb25zdCBkZXRlY3RlZEVuY29kaW5nID0gYXdhaXQgZGV0ZWN0RW5jb2RpbmdCeUJPTShyZXNvdXJjZS5mc1BhdGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXRlY3RlZEVuY29kaW5nLCBVVEYxNmJlKTtcblxuXHRcdGNvbnN0IHJlcyA9IGF3YWl0IHJlYWRGaWxlKHJlc291cmNlLmZzUGF0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5ieXRlTGVuZ3RoLCAnSGVsbG8gV29ybGQnLmxlbmd0aCAqIDIgLyogVVRGMTYgMmJ5dGVzIHBlciBjaGFyICovICsgVVRGMTZiZV9CT00ubGVuZ3RoKTtcblx0fSk7XG5cblx0dGVzdCgnY3JlYXRlIC0gVVRGIDggQk9NIC0gbm8gY29udGVudCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKGpvaW4odGVzdERpciwgJ3NtYWxsX25ldy51dGY4Ym9tJykpO1xuXG5cdFx0YXdhaXQgc2VydmljZS5jcmVhdGUoW3sgcmVzb3VyY2UgfV0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IGV4aXN0cyhyZXNvdXJjZS5mc1BhdGgpLCB0cnVlKTtcblxuXHRcdGNvbnN0IGRldGVjdGVkRW5jb2RpbmcgPSBhd2FpdCBkZXRlY3RFbmNvZGluZ0J5Qk9NKHJlc291cmNlLmZzUGF0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRldGVjdGVkRW5jb2RpbmcsIFVURjhfd2l0aF9ib20pO1xuXG5cdFx0Y29uc3QgcmVzID0gYXdhaXQgcmVhZEZpbGUocmVzb3VyY2UuZnNQYXRoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLmJ5dGVMZW5ndGgsIFVURjhfQk9NLmxlbmd0aCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NyZWF0ZSAtIFVURiA4IEJPTSAtIGNvbnRlbnQgcHJvdmlkZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZShqb2luKHRlc3REaXIsICdzbWFsbF9uZXcudXRmOGJvbScpKTtcblxuXHRcdGF3YWl0IHNlcnZpY2UuY3JlYXRlKFt7IHJlc291cmNlLCB2YWx1ZTogJ0hlbGxvIFdvcmxkJyB9XSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgZXhpc3RzKHJlc291cmNlLmZzUGF0aCksIHRydWUpO1xuXG5cdFx0Y29uc3QgZGV0ZWN0ZWRFbmNvZGluZyA9IGF3YWl0IGRldGVjdEVuY29kaW5nQnlCT00ocmVzb3VyY2UuZnNQYXRoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGV0ZWN0ZWRFbmNvZGluZywgVVRGOF93aXRoX2JvbSk7XG5cblx0XHRjb25zdCByZXMgPSBhd2FpdCByZWFkRmlsZShyZXNvdXJjZS5mc1BhdGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMuYnl0ZUxlbmd0aCwgJ0hlbGxvIFdvcmxkJy5sZW5ndGggKyBVVEY4X0JPTS5sZW5ndGgpO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBjcmVhdGVUZXh0TW9kZWxTbmFwc2hvdCh0ZXh0OiBzdHJpbmcsIHByZXNlcnZlQk9NPzogYm9vbGVhbik6IElUZXh0U25hcHNob3Qge1xuXHRcdGNvbnN0IHRleHRNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChjcmVhdGVUZXh0TW9kZWwodGV4dCkpO1xuXHRcdGNvbnN0IHNuYXBzaG90ID0gdGV4dE1vZGVsLmNyZWF0ZVNuYXBzaG90KHByZXNlcnZlQk9NKTtcblxuXHRcdHJldHVybiBzbmFwc2hvdDtcblx0fVxuXG5cdHRlc3QoJ2NyZWF0ZSAtIFVURiA4IEJPTSAtIGVtcHR5IGNvbnRlbnQgLSBzbmFwc2hvdCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKGpvaW4odGVzdERpciwgJ3NtYWxsX25ldy51dGY4Ym9tJykpO1xuXG5cdFx0YXdhaXQgc2VydmljZS5jcmVhdGUoW3sgcmVzb3VyY2UsIHZhbHVlOiBjcmVhdGVUZXh0TW9kZWxTbmFwc2hvdCgnJykgfV0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IGV4aXN0cyhyZXNvdXJjZS5mc1BhdGgpLCB0cnVlKTtcblxuXHRcdGNvbnN0IGRldGVjdGVkRW5jb2RpbmcgPSBhd2FpdCBkZXRlY3RFbmNvZGluZ0J5Qk9NKHJlc291cmNlLmZzUGF0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRldGVjdGVkRW5jb2RpbmcsIFVURjhfd2l0aF9ib20pO1xuXG5cdFx0Y29uc3QgcmVzID0gYXdhaXQgcmVhZEZpbGUocmVzb3VyY2UuZnNQYXRoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLmJ5dGVMZW5ndGgsIFVURjhfQk9NLmxlbmd0aCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NyZWF0ZSAtIFVURiA4IEJPTSAtIGNvbnRlbnQgcHJvdmlkZWQgLSBzbmFwc2hvdCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKGpvaW4odGVzdERpciwgJ3NtYWxsX25ldy51dGY4Ym9tJykpO1xuXG5cdFx0YXdhaXQgc2VydmljZS5jcmVhdGUoW3sgcmVzb3VyY2UsIHZhbHVlOiBjcmVhdGVUZXh0TW9kZWxTbmFwc2hvdCgnSGVsbG8gV29ybGQnKSB9XSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgZXhpc3RzKHJlc291cmNlLmZzUGF0aCksIHRydWUpO1xuXG5cdFx0Y29uc3QgZGV0ZWN0ZWRFbmNvZGluZyA9IGF3YWl0IGRldGVjdEVuY29kaW5nQnlCT00ocmVzb3VyY2UuZnNQYXRoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGV0ZWN0ZWRFbmNvZGluZywgVVRGOF93aXRoX2JvbSk7XG5cblx0XHRjb25zdCByZXMgPSBhd2FpdCByZWFkRmlsZShyZXNvdXJjZS5mc1BhdGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMuYnl0ZUxlbmd0aCwgJ0hlbGxvIFdvcmxkJy5sZW5ndGggKyBVVEY4X0JPTS5sZW5ndGgpO1xuXHR9KTtcblxuXHR0ZXN0KCd3cml0ZSAtIHVzZSBlbmNvZGluZyAoVVRGIDE2IEJFKSAtIHNtYWxsIGNvbnRlbnQgYXMgc3RyaW5nJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RFbmNvZGluZyhVUkkuZmlsZShqb2luKHRlc3REaXIsICdzbWFsbC50eHQnKSksIFVURjE2YmUsICdIZWxsb1xcbldvcmxkJywgJ0hlbGxvXFxuV29ybGQnKTtcblx0fSk7XG5cblx0dGVzdCgnd3JpdGUgLSB1c2UgZW5jb2RpbmcgKFVURiAxNiBCRSkgLSBzbWFsbCBjb250ZW50IGFzIHNuYXBzaG90JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RFbmNvZGluZyhVUkkuZmlsZShqb2luKHRlc3REaXIsICdzbWFsbC50eHQnKSksIFVURjE2YmUsIGNyZWF0ZVRleHRNb2RlbFNuYXBzaG90KCdIZWxsb1xcbldvcmxkJyksICdIZWxsb1xcbldvcmxkJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dyaXRlIC0gdXNlIGVuY29kaW5nIChVVEYgMTYgQkUpIC0gbGFyZ2UgY29udGVudCBhcyBzdHJpbmcnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdGVzdEVuY29kaW5nKFVSSS5maWxlKGpvaW4odGVzdERpciwgJ2xvcmVtLnR4dCcpKSwgVVRGMTZiZSwgJ0hlbGxvXFxuV29ybGQnLCAnSGVsbG9cXG5Xb3JsZCcpO1xuXHR9KTtcblxuXHR0ZXN0KCd3cml0ZSAtIHVzZSBlbmNvZGluZyAoVVRGIDE2IEJFKSAtIGxhcmdlIGNvbnRlbnQgYXMgc25hcHNob3QnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdGVzdEVuY29kaW5nKFVSSS5maWxlKGpvaW4odGVzdERpciwgJ2xvcmVtLnR4dCcpKSwgVVRGMTZiZSwgY3JlYXRlVGV4dE1vZGVsU25hcHNob3QoJ0hlbGxvXFxuV29ybGQnKSwgJ0hlbGxvXFxuV29ybGQnKTtcblx0fSk7XG5cblx0YXN5bmMgZnVuY3Rpb24gdGVzdEVuY29kaW5nKHJlc291cmNlOiBVUkksIGVuY29kaW5nOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyB8IElUZXh0U25hcHNob3QsIGV4cGVjdGVkQ29udGVudDogc3RyaW5nKSB7XG5cdFx0YXdhaXQgc2VydmljZS53cml0ZShyZXNvdXJjZSwgY29udGVudCwgeyBlbmNvZGluZyB9KTtcblxuXHRcdGNvbnN0IGRldGVjdGVkRW5jb2RpbmcgPSBhd2FpdCBkZXRlY3RFbmNvZGluZ0J5Qk9NKHJlc291cmNlLmZzUGF0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRldGVjdGVkRW5jb2RpbmcsIGVuY29kaW5nKTtcblxuXHRcdGNvbnN0IHJlc29sdmVkID0gYXdhaXQgc2VydmljZS5yZWFkU3RyZWFtKHJlc291cmNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzb2x2ZWQuZW5jb2RpbmcsIGVuY29kaW5nKTtcblxuXHRcdGNvbnN0IHRleHRCdWZmZXIgPSBkaXNwb3NhYmxlcy5hZGQocmVzb2x2ZWQudmFsdWUuY3JlYXRlKGlzV2luZG93cyA/IERlZmF1bHRFbmRPZkxpbmUuQ1JMRiA6IERlZmF1bHRFbmRPZkxpbmUuTEYpLnRleHRCdWZmZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmFwc2hvdFRvU3RyaW5nKHRleHRCdWZmZXIuY3JlYXRlU25hcHNob3QoZmFsc2UpKSwgZXhwZWN0ZWRDb250ZW50KTtcblx0fVxuXG5cdHRlc3QoJ3dyaXRlIC0gdXNlIGVuY29kaW5nIChjcDEyNTIpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpbGVQYXRoID0gam9pbih0ZXN0RGlyLCAnc29tZV9jcDEyNTIudHh0Jyk7XG5cdFx0Y29uc3QgY29udGVudHMgPSBhd2FpdCByZWFkRmlsZShmaWxlUGF0aCwgJ3V0ZjgnKTtcblx0XHRjb25zdCBlb2wgPSAvXFxyXFxuLy50ZXN0KGNvbnRlbnRzKSA/ICdcXHJcXG4nIDogJ1xcbic7XG5cdFx0YXdhaXQgdGVzdEVuY29kaW5nS2VlcHNEYXRhKFVSSS5maWxlKGZpbGVQYXRoKSwgJ2NwMTI1MicsIFsnT2JqZWN0Q291bnQgPSBMb2FkT2JqZWN0cyhcIlx1MDBENmZmZW50bGljaGVyIE9yZG5lclwiKTsnLCAnJywgJ1ByaXZhdGUgPSBcIlBlcnNcdTAwRjZubGljaGUgSW5mb3JtYXRpb25cIicsICcnXS5qb2luKGVvbCkpO1xuXHR9KTtcblxuXHR0ZXN0KCd3cml0ZSAtIHVzZSBlbmNvZGluZyAoc2hpZnRqaXMpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RFbmNvZGluZ0tlZXBzRGF0YShVUkkuZmlsZShqb2luKHRlc3REaXIsICdzb21lX3NoaWZ0amlzLnR4dCcpKSwgJ3NoaWZ0amlzJywgJ1x1NEUyRFx1NjU4N2FiYycpO1xuXHR9KTtcblxuXHR0ZXN0KCd3cml0ZSAtIHVzZSBlbmNvZGluZyAoZ2JrKScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB0ZXN0RW5jb2RpbmdLZWVwc0RhdGEoVVJJLmZpbGUoam9pbih0ZXN0RGlyLCAnc29tZV9nYmsudHh0JykpLCAnZ2JrJywgJ1x1NEUyRFx1NTZGRGFiYycpO1xuXHR9KTtcblxuXHR0ZXN0KCd3cml0ZSAtIHVzZSBlbmNvZGluZyAoY3lyaWxsaWMpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RFbmNvZGluZ0tlZXBzRGF0YShVUkkuZmlsZShqb2luKHRlc3REaXIsICdzb21lX2N5cmlsbGljLnR4dCcpKSwgJ2NwODY2JywgJ1x1MDQxMFx1MDQxMVx1MDQxMlx1MDQxM1x1MDQxNFx1MDQxNVx1MDQxNlx1MDQxN1x1MDQxOFx1MDQxOVx1MDQxQVx1MDQxQlx1MDQxQ1x1MDQxRFx1MDQxRVx1MDQxRlx1MDQyMFx1MDQyMVx1MDQyMlx1MDQyM1x1MDQyNFx1MDQyNVx1MDQyNlx1MDQyN1x1MDQyOFx1MDQyOVx1MDQyQVx1MDQyQlx1MDQyQ1x1MDQyRFx1MDQyRVx1MDQyRlx1MDQzMFx1MDQzMVx1MDQzMlx1MDQzM1x1MDQzNFx1MDQzNVx1MDQzNlx1MDQzN1x1MDQzOFx1MDQzOVx1MDQzQVx1MDQzQlx1MDQzQ1x1MDQzRFx1MDQzRVx1MDQzRlx1MDQ0MFx1MDQ0MVx1MDQ0Mlx1MDQ0M1x1MDQ0NFx1MDQ0NVx1MDQ0Nlx1MDQ0N1x1MDQ0OFx1MDQ0OVx1MDQ0QVx1MDQ0Qlx1MDQ0Q1x1MDQ0RFx1MDQ0RVx1MDQ0RicpO1xuXHR9KTtcblxuXHR0ZXN0KCd3cml0ZSAtIHVzZSBlbmNvZGluZyAoYmlnNSknLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdGVzdEVuY29kaW5nS2VlcHNEYXRhKFVSSS5maWxlKGpvaW4odGVzdERpciwgJ3NvbWVfYmlnNS50eHQnKSksICdjcDk1MCcsICdcdTRFMkRcdTY1ODdhYmMnKTtcblx0fSk7XG5cblx0YXN5bmMgZnVuY3Rpb24gdGVzdEVuY29kaW5nS2VlcHNEYXRhKHJlc291cmNlOiBVUkksIGVuY29kaW5nOiBzdHJpbmcsIGV4cGVjdGVkOiBzdHJpbmcpIHtcblx0XHRsZXQgcmVzb2x2ZWQgPSBhd2FpdCBzZXJ2aWNlLnJlYWRTdHJlYW0ocmVzb3VyY2UsIHsgZW5jb2RpbmcgfSk7XG5cdFx0Y29uc3QgdGV4dEJ1ZmZlciA9IGRpc3Bvc2FibGVzLmFkZChyZXNvbHZlZC52YWx1ZS5jcmVhdGUoaXNXaW5kb3dzID8gRGVmYXVsdEVuZE9mTGluZS5DUkxGIDogRGVmYXVsdEVuZE9mTGluZS5MRikudGV4dEJ1ZmZlcik7XG5cdFx0Y29uc3QgY29udGVudCA9IHNuYXBzaG90VG9TdHJpbmcodGV4dEJ1ZmZlci5jcmVhdGVTbmFwc2hvdChmYWxzZSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZW50LCBleHBlY3RlZCk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLndyaXRlKHJlc291cmNlLCBjb250ZW50LCB7IGVuY29kaW5nIH0pO1xuXG5cdFx0cmVzb2x2ZWQgPSBhd2FpdCBzZXJ2aWNlLnJlYWRTdHJlYW0ocmVzb3VyY2UsIHsgZW5jb2RpbmcgfSk7XG5cdFx0Y29uc3QgdGV4dEJ1ZmZlcjIgPSBkaXNwb3NhYmxlcy5hZGQocmVzb2x2ZWQudmFsdWUuY3JlYXRlKERlZmF1bHRFbmRPZkxpbmUuQ1JMRikudGV4dEJ1ZmZlcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNuYXBzaG90VG9TdHJpbmcodGV4dEJ1ZmZlcjIuY3JlYXRlU25hcHNob3QoZmFsc2UpKSwgY29udGVudCk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLndyaXRlKHJlc291cmNlLCBjcmVhdGVUZXh0TW9kZWxTbmFwc2hvdChjb250ZW50KSwgeyBlbmNvZGluZyB9KTtcblxuXHRcdHJlc29sdmVkID0gYXdhaXQgc2VydmljZS5yZWFkU3RyZWFtKHJlc291cmNlLCB7IGVuY29kaW5nIH0pO1xuXHRcdGNvbnN0IHRleHRCdWZmZXIzID0gZGlzcG9zYWJsZXMuYWRkKHJlc29sdmVkLnZhbHVlLmNyZWF0ZShEZWZhdWx0RW5kT2ZMaW5lLkNSTEYpLnRleHRCdWZmZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmFwc2hvdFRvU3RyaW5nKHRleHRCdWZmZXIzLmNyZWF0ZVNuYXBzaG90KGZhbHNlKSksIGNvbnRlbnQpO1xuXHR9XG5cblx0dGVzdCgnd3JpdGUgLSBubyBlbmNvZGluZyAtIGNvbnRlbnQgYXMgc3RyaW5nJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoam9pbih0ZXN0RGlyLCAnc21hbGwudHh0JykpO1xuXG5cdFx0Y29uc3QgY29udGVudCA9IChhd2FpdCByZWFkRmlsZShyZXNvdXJjZS5mc1BhdGgpKS50b1N0cmluZygpO1xuXG5cdFx0YXdhaXQgc2VydmljZS53cml0ZShyZXNvdXJjZSwgY29udGVudCk7XG5cblx0XHRjb25zdCByZXNvbHZlZCA9IGF3YWl0IHNlcnZpY2UucmVhZFN0cmVhbShyZXNvdXJjZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc29sdmVkLnZhbHVlLmdldEZpcnN0TGluZVRleHQoOTk5OTk5KSwgY29udGVudCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dyaXRlIC0gbm8gZW5jb2RpbmcgLSBjb250ZW50IGFzIHNuYXBzaG90JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoam9pbih0ZXN0RGlyLCAnc21hbGwudHh0JykpO1xuXG5cdFx0Y29uc3QgY29udGVudCA9IChhd2FpdCByZWFkRmlsZShyZXNvdXJjZS5mc1BhdGgpKS50b1N0cmluZygpO1xuXG5cdFx0YXdhaXQgc2VydmljZS53cml0ZShyZXNvdXJjZSwgY3JlYXRlVGV4dE1vZGVsU25hcHNob3QoY29udGVudCkpO1xuXG5cdFx0Y29uc3QgcmVzb2x2ZWQgPSBhd2FpdCBzZXJ2aWNlLnJlYWRTdHJlYW0ocmVzb3VyY2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNvbHZlZC52YWx1ZS5nZXRGaXJzdExpbmVUZXh0KDk5OTk5OSksIGNvbnRlbnQpO1xuXHR9KTtcblxuXHR0ZXN0KCd3cml0ZSAtIGVuY29kaW5nIHByZXNlcnZlZCAoVVRGIDE2IExFKSAtIGNvbnRlbnQgYXMgc3RyaW5nJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoam9pbih0ZXN0RGlyLCAnc29tZV91dGYxNmxlLmNzcycpKTtcblxuXHRcdGNvbnN0IHJlc29sdmVkID0gYXdhaXQgc2VydmljZS5yZWFkU3RyZWFtKHJlc291cmNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzb2x2ZWQuZW5jb2RpbmcsIFVURjE2bGUpO1xuXG5cdFx0YXdhaXQgdGVzdEVuY29kaW5nKFVSSS5maWxlKGpvaW4odGVzdERpciwgJ3NvbWVfdXRmMTZsZS5jc3MnKSksIFVURjE2bGUsICdIZWxsb1xcbldvcmxkJywgJ0hlbGxvXFxuV29ybGQnKTtcblx0fSk7XG5cblx0dGVzdCgnd3JpdGUgLSBlbmNvZGluZyBwcmVzZXJ2ZWQgKFVURiAxNiBMRSkgLSBjb250ZW50IGFzIHNuYXBzaG90JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoam9pbih0ZXN0RGlyLCAnc29tZV91dGYxNmxlLmNzcycpKTtcblxuXHRcdGNvbnN0IHJlc29sdmVkID0gYXdhaXQgc2VydmljZS5yZWFkU3RyZWFtKHJlc291cmNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzb2x2ZWQuZW5jb2RpbmcsIFVURjE2bGUpO1xuXG5cdFx0YXdhaXQgdGVzdEVuY29kaW5nKFVSSS5maWxlKGpvaW4odGVzdERpciwgJ3NvbWVfdXRmMTZsZS5jc3MnKSksIFVURjE2bGUsIGNyZWF0ZVRleHRNb2RlbFNuYXBzaG90KCdIZWxsb1xcbldvcmxkJyksICdIZWxsb1xcbldvcmxkJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dyaXRlIC0gVVRGOCB2YXJpYXRpb25zIC0gY29udGVudCBhcyBzdHJpbmcnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZShqb2luKHRlc3REaXIsICdpbmRleC5odG1sJykpO1xuXG5cdFx0bGV0IGRldGVjdGVkRW5jb2RpbmcgPSBhd2FpdCBkZXRlY3RFbmNvZGluZ0J5Qk9NKHJlc291cmNlLmZzUGF0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRldGVjdGVkRW5jb2RpbmcsIG51bGwpO1xuXG5cdFx0Y29uc3QgY29udGVudCA9IChhd2FpdCByZWFkRmlsZShyZXNvdXJjZS5mc1BhdGgpKS50b1N0cmluZygpICsgJ3VwZGF0ZXMnO1xuXHRcdGF3YWl0IHNlcnZpY2Uud3JpdGUocmVzb3VyY2UsIGNvbnRlbnQsIHsgZW5jb2Rpbmc6IFVURjhfd2l0aF9ib20gfSk7XG5cblx0XHRkZXRlY3RlZEVuY29kaW5nID0gYXdhaXQgZGV0ZWN0RW5jb2RpbmdCeUJPTShyZXNvdXJjZS5mc1BhdGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXRlY3RlZEVuY29kaW5nLCBVVEY4X3dpdGhfYm9tKTtcblxuXHRcdC8vIGVuc3VyZSBCT00gcHJlc2VydmVkIGlmIGVuZm9yY2VkXG5cdFx0YXdhaXQgc2VydmljZS53cml0ZShyZXNvdXJjZSwgY29udGVudCwgeyBlbmNvZGluZzogVVRGOF93aXRoX2JvbSB9KTtcblx0XHRkZXRlY3RlZEVuY29kaW5nID0gYXdhaXQgZGV0ZWN0RW5jb2RpbmdCeUJPTShyZXNvdXJjZS5mc1BhdGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXRlY3RlZEVuY29kaW5nLCBVVEY4X3dpdGhfYm9tKTtcblxuXHRcdC8vIGFsbG93IHRvIHJlbW92ZSBCT01cblx0XHRhd2FpdCBzZXJ2aWNlLndyaXRlKHJlc291cmNlLCBjb250ZW50LCB7IGVuY29kaW5nOiBVVEY4IH0pO1xuXHRcdGRldGVjdGVkRW5jb2RpbmcgPSBhd2FpdCBkZXRlY3RFbmNvZGluZ0J5Qk9NKHJlc291cmNlLmZzUGF0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRldGVjdGVkRW5jb2RpbmcsIG51bGwpO1xuXG5cdFx0Ly8gQk9NIGRvZXMgbm90IGNvbWUgYmFja1xuXHRcdGF3YWl0IHNlcnZpY2Uud3JpdGUocmVzb3VyY2UsIGNvbnRlbnQsIHsgZW5jb2Rpbmc6IFVURjggfSk7XG5cdFx0ZGV0ZWN0ZWRFbmNvZGluZyA9IGF3YWl0IGRldGVjdEVuY29kaW5nQnlCT00ocmVzb3VyY2UuZnNQYXRoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGV0ZWN0ZWRFbmNvZGluZywgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dyaXRlIC0gVVRGOCB2YXJpYXRpb25zIC0gY29udGVudCBhcyBzbmFwc2hvdCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKGpvaW4odGVzdERpciwgJ2luZGV4Lmh0bWwnKSk7XG5cblx0XHRsZXQgZGV0ZWN0ZWRFbmNvZGluZyA9IGF3YWl0IGRldGVjdEVuY29kaW5nQnlCT00ocmVzb3VyY2UuZnNQYXRoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGV0ZWN0ZWRFbmNvZGluZywgbnVsbCk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChjcmVhdGVUZXh0TW9kZWwoKGF3YWl0IHJlYWRGaWxlKHJlc291cmNlLmZzUGF0aCkpLnRvU3RyaW5nKCkgKyAndXBkYXRlcycpKTtcblx0XHRhd2FpdCBzZXJ2aWNlLndyaXRlKHJlc291cmNlLCBtb2RlbC5jcmVhdGVTbmFwc2hvdCgpLCB7IGVuY29kaW5nOiBVVEY4X3dpdGhfYm9tIH0pO1xuXG5cdFx0ZGV0ZWN0ZWRFbmNvZGluZyA9IGF3YWl0IGRldGVjdEVuY29kaW5nQnlCT00ocmVzb3VyY2UuZnNQYXRoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGV0ZWN0ZWRFbmNvZGluZywgVVRGOF93aXRoX2JvbSk7XG5cblx0XHQvLyBlbnN1cmUgQk9NIHByZXNlcnZlZCBpZiBlbmZvcmNlZFxuXHRcdGF3YWl0IHNlcnZpY2Uud3JpdGUocmVzb3VyY2UsIG1vZGVsLmNyZWF0ZVNuYXBzaG90KCksIHsgZW5jb2Rpbmc6IFVURjhfd2l0aF9ib20gfSk7XG5cdFx0ZGV0ZWN0ZWRFbmNvZGluZyA9IGF3YWl0IGRldGVjdEVuY29kaW5nQnlCT00ocmVzb3VyY2UuZnNQYXRoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGV0ZWN0ZWRFbmNvZGluZywgVVRGOF93aXRoX2JvbSk7XG5cblx0XHQvLyBhbGxvdyB0byByZW1vdmUgQk9NXG5cdFx0YXdhaXQgc2VydmljZS53cml0ZShyZXNvdXJjZSwgbW9kZWwuY3JlYXRlU25hcHNob3QoKSwgeyBlbmNvZGluZzogVVRGOCB9KTtcblx0XHRkZXRlY3RlZEVuY29kaW5nID0gYXdhaXQgZGV0ZWN0RW5jb2RpbmdCeUJPTShyZXNvdXJjZS5mc1BhdGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXRlY3RlZEVuY29kaW5nLCBudWxsKTtcblxuXHRcdC8vIEJPTSBkb2VzIG5vdCBjb21lIGJhY2tcblx0XHRhd2FpdCBzZXJ2aWNlLndyaXRlKHJlc291cmNlLCBtb2RlbC5jcmVhdGVTbmFwc2hvdCgpLCB7IGVuY29kaW5nOiBVVEY4IH0pO1xuXHRcdGRldGVjdGVkRW5jb2RpbmcgPSBhd2FpdCBkZXRlY3RFbmNvZGluZ0J5Qk9NKHJlc291cmNlLmZzUGF0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRldGVjdGVkRW5jb2RpbmcsIG51bGwpO1xuXHR9KTtcblxuXHR0ZXN0KCd3cml0ZSAtIHByZXNlcnZlIFVURjggQk9NIC0gY29udGVudCBhcyBzdHJpbmcnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZShqb2luKHRlc3REaXIsICdzb21lX3V0ZjhfYm9tLnR4dCcpKTtcblxuXHRcdGxldCBkZXRlY3RlZEVuY29kaW5nID0gYXdhaXQgZGV0ZWN0RW5jb2RpbmdCeUJPTShyZXNvdXJjZS5mc1BhdGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXRlY3RlZEVuY29kaW5nLCBVVEY4X3dpdGhfYm9tKTtcblxuXHRcdGF3YWl0IHNlcnZpY2Uud3JpdGUocmVzb3VyY2UsICdIZWxsbyBXb3JsZCcsIHsgZW5jb2Rpbmc6IGRldGVjdGVkRW5jb2RpbmcgfSk7XG5cdFx0ZGV0ZWN0ZWRFbmNvZGluZyA9IGF3YWl0IGRldGVjdEVuY29kaW5nQnlCT00ocmVzb3VyY2UuZnNQYXRoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGV0ZWN0ZWRFbmNvZGluZywgVVRGOF93aXRoX2JvbSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dyaXRlIC0gZW5zdXJlIEJPTSBpbiBlbXB0eSBmaWxlIC0gY29udGVudCBhcyBzdHJpbmcnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZShqb2luKHRlc3REaXIsICdzbWFsbC50eHQnKSk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLndyaXRlKHJlc291cmNlLCAnJywgeyBlbmNvZGluZzogVVRGOF93aXRoX2JvbSB9KTtcblxuXHRcdGNvbnN0IGRldGVjdGVkRW5jb2RpbmcgPSBhd2FpdCBkZXRlY3RFbmNvZGluZ0J5Qk9NKHJlc291cmNlLmZzUGF0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRldGVjdGVkRW5jb2RpbmcsIFVURjhfd2l0aF9ib20pO1xuXHR9KTtcblxuXHR0ZXN0KCd3cml0ZSAtIGVuc3VyZSBCT00gaW4gZW1wdHkgZmlsZSAtIGNvbnRlbnQgYXMgc25hcHNob3QnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZShqb2luKHRlc3REaXIsICdzbWFsbC50eHQnKSk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLndyaXRlKHJlc291cmNlLCBjcmVhdGVUZXh0TW9kZWxTbmFwc2hvdCgnJyksIHsgZW5jb2Rpbmc6IFVURjhfd2l0aF9ib20gfSk7XG5cblx0XHRjb25zdCBkZXRlY3RlZEVuY29kaW5nID0gYXdhaXQgZGV0ZWN0RW5jb2RpbmdCeUJPTShyZXNvdXJjZS5mc1BhdGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXRlY3RlZEVuY29kaW5nLCBVVEY4X3dpdGhfYm9tKTtcblx0fSk7XG5cblx0dGVzdCgncmVhZFN0cmVhbSAtIHNtYWxsIHRleHQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZShqb2luKHRlc3REaXIsICdzbWFsbC50eHQnKSk7XG5cblx0XHRhd2FpdCB0ZXN0UmVhZFN0cmVhbShyZXNvdXJjZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlYWRTdHJlYW0gLSBsYXJnZSB0ZXh0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoam9pbih0ZXN0RGlyLCAnbG9yZW0udHh0JykpO1xuXG5cdFx0YXdhaXQgdGVzdFJlYWRTdHJlYW0ocmVzb3VyY2UpO1xuXHR9KTtcblxuXHRhc3luYyBmdW5jdGlvbiB0ZXN0UmVhZFN0cmVhbShyZXNvdXJjZTogVVJJKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgc2VydmljZS5yZWFkU3RyZWFtKHJlc291cmNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQubmFtZSwgYmFzZW5hbWUocmVzb3VyY2UuZnNQYXRoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zaXplLCAoYXdhaXQgc3RhdChyZXNvdXJjZS5mc1BhdGgpKS5zaXplKTtcblxuXHRcdGNvbnN0IGNvbnRlbnQgPSAoYXdhaXQgcmVhZEZpbGUocmVzb3VyY2UuZnNQYXRoKSkudG9TdHJpbmcoKTtcblx0XHRjb25zdCB0ZXh0QnVmZmVyID0gZGlzcG9zYWJsZXMuYWRkKHJlc3VsdC52YWx1ZS5jcmVhdGUoRGVmYXVsdEVuZE9mTGluZS5MRikudGV4dEJ1ZmZlcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0c25hcHNob3RUb1N0cmluZyh0ZXh0QnVmZmVyLmNyZWF0ZVNuYXBzaG90KGZhbHNlKSksXG5cdFx0XHRzbmFwc2hvdFRvU3RyaW5nKGNyZWF0ZVRleHRNb2RlbFNuYXBzaG90KGNvbnRlbnQsIGZhbHNlKSkpO1xuXHR9XG5cblx0dGVzdCgncmVhZCAtIHNtYWxsIHRleHQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZShqb2luKHRlc3REaXIsICdzbWFsbC50eHQnKSk7XG5cblx0XHRhd2FpdCB0ZXN0UmVhZChyZXNvdXJjZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlYWQgLSBsYXJnZSB0ZXh0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoam9pbih0ZXN0RGlyLCAnbG9yZW0udHh0JykpO1xuXG5cdFx0YXdhaXQgdGVzdFJlYWQocmVzb3VyY2UpO1xuXHR9KTtcblxuXHRhc3luYyBmdW5jdGlvbiB0ZXN0UmVhZChyZXNvdXJjZTogVVJJKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgc2VydmljZS5yZWFkKHJlc291cmNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQubmFtZSwgYmFzZW5hbWUocmVzb3VyY2UuZnNQYXRoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5zaXplLCAoYXdhaXQgc3RhdChyZXNvdXJjZS5mc1BhdGgpKS5zaXplKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnZhbHVlLCAoYXdhaXQgcmVhZEZpbGUocmVzb3VyY2UuZnNQYXRoKSkudG9TdHJpbmcoKSk7XG5cdH1cblxuXHR0ZXN0KCdyZWFkU3RyZWFtIC0gZW5jb2RpbmcgcGlja2VkIHVwIChDUDEyNTIpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoam9pbih0ZXN0RGlyLCAnc29tZV9zbWFsbF9jcDEyNTIudHh0JykpO1xuXHRcdGNvbnN0IGVuY29kaW5nID0gJ3dpbmRvd3MxMjUyJztcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNlcnZpY2UucmVhZFN0cmVhbShyZXNvdXJjZSwgeyBlbmNvZGluZyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmVuY29kaW5nLCBlbmNvZGluZyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC52YWx1ZS5nZXRGaXJzdExpbmVUZXh0KDk5OTk5OSksICdQcml2YXRlID0gXCJQZXJzXHUwMEY2bmxpY2hlXHUwMERGIEluZm9ybWF0aW9uXCInKTtcblx0fSk7XG5cblx0dGVzdCgncmVhZCAtIGVuY29kaW5nIHBpY2tlZCB1cCAoQ1AxMjUyKScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKGpvaW4odGVzdERpciwgJ3NvbWVfc21hbGxfY3AxMjUyLnR4dCcpKTtcblx0XHRjb25zdCBlbmNvZGluZyA9ICd3aW5kb3dzMTI1Mic7XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBzZXJ2aWNlLnJlYWQocmVzb3VyY2UsIHsgZW5jb2RpbmcgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5lbmNvZGluZywgZW5jb2RpbmcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQudmFsdWUsICdQcml2YXRlID0gXCJQZXJzXHUwMEY2bmxpY2hlXHUwMERGIEluZm9ybWF0aW9uXCInKTtcblx0fSk7XG5cblx0dGVzdCgncmVhZCAtIGVuY29kaW5nIHBpY2tlZCB1cCAoYmluYXJ5KScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKGpvaW4odGVzdERpciwgJ3NvbWVfc21hbGxfY3AxMjUyLnR4dCcpKTtcblx0XHRjb25zdCBlbmNvZGluZyA9ICdiaW5hcnknO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgc2VydmljZS5yZWFkKHJlc291cmNlLCB7IGVuY29kaW5nIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZW5jb2RpbmcsIGVuY29kaW5nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnZhbHVlLCAnUHJpdmF0ZSA9IFwiUGVyc1x1MDBGNm5saWNoZVx1MDBERiBJbmZvcm1hdGlvblwiJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlYWQgLSBlbmNvZGluZyBwaWNrZWQgdXAgKGJhc2U2NCknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZShqb2luKHRlc3REaXIsICdzb21lX3NtYWxsX2NwMTI1Mi50eHQnKSk7XG5cdFx0Y29uc3QgZW5jb2RpbmcgPSAnYmFzZTY0JztcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNlcnZpY2UucmVhZChyZXNvdXJjZSwgeyBlbmNvZGluZyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmVuY29kaW5nLCBlbmNvZGluZyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC52YWx1ZSwgYnRvYSgnUHJpdmF0ZSA9IFwiUGVyc1x1MDBGNm5saWNoZVx1MDBERiBJbmZvcm1hdGlvblwiJykpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWFkU3RyZWFtIC0gdXNlciBvdmVycmlkZXMgQk9NJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoam9pbih0ZXN0RGlyLCAnc29tZV91dGYxNmxlLmNzcycpKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNlcnZpY2UucmVhZFN0cmVhbShyZXNvdXJjZSwgeyBlbmNvZGluZzogJ3dpbmRvd3MxMjUyJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmVuY29kaW5nLCAnd2luZG93czEyNTInKTtcblx0fSk7XG5cblx0dGVzdCgncmVhZFN0cmVhbSAtIEJPTSByZW1vdmVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoam9pbih0ZXN0RGlyLCAnc29tZV91dGY4X2JvbS50eHQnKSk7XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBzZXJ2aWNlLnJlYWRTdHJlYW0ocmVzb3VyY2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQudmFsdWUuZ2V0Rmlyc3RMaW5lVGV4dCg5OTk5OTkpLCAnVGhpcyBpcyBzb21lIFVURiA4IHdpdGggQk9NIGZpbGUuJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlYWRTdHJlYW0gLSBpbnZhbGlkIGVuY29kaW5nJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoam9pbih0ZXN0RGlyLCAnaW5kZXguaHRtbCcpKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNlcnZpY2UucmVhZFN0cmVhbShyZXNvdXJjZSwgeyBlbmNvZGluZzogJ3N1cGVyZHVwZXInIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZW5jb2RpbmcsICd1dGY4Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlYWRTdHJlYW0gLSBlbmNvZGluZyBvdmVycmlkZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKGpvaW4odGVzdERpciwgJ3NvbWUudXRmMTZsZScpKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNlcnZpY2UucmVhZFN0cmVhbShyZXNvdXJjZSwgeyBlbmNvZGluZzogJ3dpbmRvd3MxMjUyJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmVuY29kaW5nLCAndXRmMTZsZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQudmFsdWUuZ2V0Rmlyc3RMaW5lVGV4dCg5OTk5OTkpLCAnVGhpcyBpcyBzb21lIFVURiAxNiB3aXRoIEJPTSBmaWxlLicpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWFkU3RyZWFtIC0gbGFyZ2UgQmlnNScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB0ZXN0TGFyZ2VFbmNvZGluZygnYmlnNScsICdcdTRFMkRcdTY1ODdhYmMnKTtcblx0fSk7XG5cblx0dGVzdCgncmVhZFN0cmVhbSAtIGxhcmdlIENQMTI1MicsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB0ZXN0TGFyZ2VFbmNvZGluZygnY3AxMjUyJywgJ1x1MDBGNlx1MDBFNFx1MDBGQ1x1MDBERicpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWFkU3RyZWFtIC0gbGFyZ2UgQ3lyaWxsaWMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdGVzdExhcmdlRW5jb2RpbmcoJ2NwODY2JywgJ1x1MDQxMFx1MDQxMVx1MDQxMlx1MDQxM1x1MDQxNFx1MDQxNVx1MDQxNlx1MDQxN1x1MDQxOFx1MDQxOVx1MDQxQVx1MDQxQlx1MDQxQ1x1MDQxRFx1MDQxRVx1MDQxRlx1MDQyMFx1MDQyMVx1MDQyMlx1MDQyM1x1MDQyNFx1MDQyNVx1MDQyNlx1MDQyN1x1MDQyOFx1MDQyOVx1MDQyQVx1MDQyQlx1MDQyQ1x1MDQyRFx1MDQyRVx1MDQyRlx1MDQzMFx1MDQzMVx1MDQzMlx1MDQzM1x1MDQzNFx1MDQzNVx1MDQzNlx1MDQzN1x1MDQzOFx1MDQzOVx1MDQzQVx1MDQzQlx1MDQzQ1x1MDQzRFx1MDQzRVx1MDQzRlx1MDQ0MFx1MDQ0MVx1MDQ0Mlx1MDQ0M1x1MDQ0NFx1MDQ0NVx1MDQ0Nlx1MDQ0N1x1MDQ0OFx1MDQ0OVx1MDQ0QVx1MDQ0Qlx1MDQ0Q1x1MDQ0RFx1MDQ0RVx1MDQ0RicpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWFkU3RyZWFtIC0gbGFyZ2UgR0JLJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RMYXJnZUVuY29kaW5nKCdnYmsnLCAnXHU0RTJEXHU1NkZEYWJjJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlYWRTdHJlYW0gLSBsYXJnZSBTaGlmdEpJUycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB0ZXN0TGFyZ2VFbmNvZGluZygnc2hpZnRqaXMnLCAnXHU0RTJEXHU2NTg3YWJjJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlYWRTdHJlYW0gLSBsYXJnZSBVVEY4IEJPTScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB0ZXN0TGFyZ2VFbmNvZGluZygndXRmOGJvbScsICdcdTAwRjZcdTAwRTRcdTAwRkNcdTAwREYnKTtcblx0fSk7XG5cblx0dGVzdCgncmVhZFN0cmVhbSAtIGxhcmdlIFVURjE2IExFJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RMYXJnZUVuY29kaW5nKCd1dGYxNmxlJywgJ1x1MDBGNlx1MDBFNFx1MDBGQ1x1MDBERicpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWFkU3RyZWFtIC0gbGFyZ2UgVVRGMTYgQkUnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdGVzdExhcmdlRW5jb2RpbmcoJ3V0ZjE2YmUnLCAnXHUwMEY2XHUwMEU0XHUwMEZDXHUwMERGJyk7XG5cdH0pO1xuXG5cdGFzeW5jIGZ1bmN0aW9uIHRlc3RMYXJnZUVuY29kaW5nKGVuY29kaW5nOiBzdHJpbmcsIG5lZWRsZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZShqb2luKHRlc3REaXIsIGBsb3JlbV8ke2VuY29kaW5nfS50eHRgKSk7XG5cblx0XHQvLyBWZXJpZnkgdmlhIGBJVGV4dEZpbGVTZXJ2aWNlLnJlYWRTdHJlYW1gXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgc2VydmljZS5yZWFkU3RyZWFtKHJlc291cmNlLCB7IGVuY29kaW5nIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZW5jb2RpbmcsIGVuY29kaW5nKTtcblxuXHRcdGNvbnN0IHRleHRCdWZmZXIgPSBkaXNwb3NhYmxlcy5hZGQocmVzdWx0LnZhbHVlLmNyZWF0ZShEZWZhdWx0RW5kT2ZMaW5lLkxGKS50ZXh0QnVmZmVyKTtcblx0XHRsZXQgY29udGVudHMgPSBzbmFwc2hvdFRvU3RyaW5nKHRleHRCdWZmZXIuY3JlYXRlU25hcHNob3QoZmFsc2UpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZW50cy5pbmRleE9mKG5lZWRsZSksIDApO1xuXHRcdGFzc2VydC5vayhjb250ZW50cy5pbmRleE9mKG5lZWRsZSwgMTApID4gMCk7XG5cblx0XHQvLyBWZXJpZnkgdmlhIGBJVGV4dEZpbGVTZXJ2aWNlLmdldERlY29kZWRUZXh0RmFjdG9yeWBcblx0XHRjb25zdCByYXdGaWxlID0gYXdhaXQgcGFyYW1zLnJlYWRGaWxlKHJlc291cmNlLmZzUGF0aCk7XG5cdFx0bGV0IHJhd0ZpbGVWU0J1ZmZlcjogVlNCdWZmZXI7XG5cdFx0aWYgKHJhd0ZpbGUgaW5zdGFuY2VvZiBWU0J1ZmZlcikge1xuXHRcdFx0cmF3RmlsZVZTQnVmZmVyID0gcmF3RmlsZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmF3RmlsZVZTQnVmZmVyID0gVlNCdWZmZXIud3JhcChyYXdGaWxlKTtcblx0XHR9XG5cblx0XHRjb25zdCBmYWN0b3J5ID0gYXdhaXQgY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnlGcm9tU3RyZWFtKGF3YWl0IHNlcnZpY2UuZ2V0RGVjb2RlZFN0cmVhbShyZXNvdXJjZSwgYnVmZmVyVG9TdHJlYW0ocmF3RmlsZVZTQnVmZmVyKSwgeyBlbmNvZGluZyB9KSk7XG5cblx0XHRjb25zdCB0ZXh0QnVmZmVyMiA9IGRpc3Bvc2FibGVzLmFkZChmYWN0b3J5LmNyZWF0ZShEZWZhdWx0RW5kT2ZMaW5lLkxGKS50ZXh0QnVmZmVyKTtcblx0XHRjb250ZW50cyA9IHNuYXBzaG90VG9TdHJpbmcodGV4dEJ1ZmZlcjIuY3JlYXRlU25hcHNob3QoZmFsc2UpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZW50cy5pbmRleE9mKG5lZWRsZSksIDApO1xuXHRcdGFzc2VydC5vayhjb250ZW50cy5pbmRleE9mKG5lZWRsZSwgMTApID4gMCk7XG5cdH1cblxuXHR0ZXN0KCdyZWFkU3RyZWFtIC0gVVRGMTYgTEUgKG5vIEJPTSknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZShqb2luKHRlc3REaXIsICd1dGYxNl9sZV9ub2JvbS50eHQnKSk7XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBzZXJ2aWNlLnJlYWRTdHJlYW0ocmVzb3VyY2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZW5jb2RpbmcsICd1dGYxNmxlJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlYWRTdHJlYW0gLSBVVEYxNiBCRSAobm8gQk9NKScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKGpvaW4odGVzdERpciwgJ3V0ZjE2X2JlX25vYm9tLnR4dCcpKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNlcnZpY2UucmVhZFN0cmVhbShyZXNvdXJjZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5lbmNvZGluZywgJ3V0ZjE2YmUnKTtcblx0fSk7XG5cblx0dGVzdCgncmVhZFN0cmVhbSAtIGF1dG9ndWVzc0VuY29kaW5nJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoam9pbih0ZXN0RGlyLCAnc29tZV9jcDEyNTIudHh0JykpO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgc2VydmljZS5yZWFkU3RyZWFtKHJlc291cmNlLCB7IGF1dG9HdWVzc0VuY29kaW5nOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZW5jb2RpbmcsICd3aW5kb3dzMTI1MicpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWFkU3RyZWFtIC0gYXV0b2d1ZXNzRW5jb2RpbmcgKGNhbmRpZGF0ZUd1ZXNzRW5jb2RpbmdzKScsIGFzeW5jICgpID0+IHtcblx0XHQvLyBUaGlzIGZpbGUgaXMgZGV0ZXJtaW5lZCB0byBiZSBXaW5kb3dzLTEyNTIgdW5sZXNzIGNhbmRpZGF0ZURldGVjdEVuY29kaW5nIGlzIHNldC5cblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKGpvaW4odGVzdERpciwgJ3NvbWUuc2hpZnRqaXMuMS50eHQnKSk7XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBzZXJ2aWNlLnJlYWRTdHJlYW0ocmVzb3VyY2UsIHsgYXV0b0d1ZXNzRW5jb2Rpbmc6IHRydWUsIGNhbmRpZGF0ZUd1ZXNzRW5jb2RpbmdzOiBbJ3V0Zi04JywgJ3NoaWZ0amlzJywgJ2V1Yy1qcCddIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZW5jb2RpbmcsICdzaGlmdGppcycpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWFkU3RyZWFtIC0gYXV0b2d1ZXNzRW5jb2RpbmcgKGNhbmRpZGF0ZUd1ZXNzRW5jb2RpbmdzIGlzIEVtcHR5KScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKGpvaW4odGVzdERpciwgJ3NvbWVfY3AxMjUyLnR4dCcpKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNlcnZpY2UucmVhZFN0cmVhbShyZXNvdXJjZSwgeyBhdXRvR3Vlc3NFbmNvZGluZzogdHJ1ZSwgY2FuZGlkYXRlR3Vlc3NFbmNvZGluZ3M6IFtdIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZW5jb2RpbmcsICd3aW5kb3dzMTI1MicpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWFkU3RyZWFtIC0gRklMRV9JU19CSU5BUlknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZShqb2luKHRlc3REaXIsICdiaW5hcnkudHh0JykpO1xuXG5cdFx0bGV0IGVycm9yOiBUZXh0RmlsZU9wZXJhdGlvbkVycm9yIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBzZXJ2aWNlLnJlYWRTdHJlYW0ocmVzb3VyY2UsIHsgYWNjZXB0VGV4dE9ubHk6IHRydWUgfSk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRlcnJvciA9IGVycjtcblx0XHR9XG5cblx0XHRhc3NlcnQub2soZXJyb3IpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnJvci50ZXh0RmlsZU9wZXJhdGlvblJlc3VsdCwgVGV4dEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9JU19CSU5BUlkpO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgc2VydmljZS5yZWFkU3RyZWFtKFVSSS5maWxlKGpvaW4odGVzdERpciwgJ3NtYWxsLnR4dCcpKSwgeyBhY2NlcHRUZXh0T25seTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lm5hbWUsICdzbWFsbC50eHQnKTtcblx0fSk7XG5cblx0dGVzdCgncmVhZCAtIEZJTEVfSVNfQklOQVJZJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoam9pbih0ZXN0RGlyLCAnYmluYXJ5LnR4dCcpKTtcblxuXHRcdGxldCBlcnJvcjogVGV4dEZpbGVPcGVyYXRpb25FcnJvciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgc2VydmljZS5yZWFkKHJlc291cmNlLCB7IGFjY2VwdFRleHRPbmx5OiB0cnVlIH0pO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0ZXJyb3IgPSBlcnI7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0Lm9rKGVycm9yKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXJyb3IudGV4dEZpbGVPcGVyYXRpb25SZXN1bHQsIFRleHRGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfSVNfQklOQVJZKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNlcnZpY2UucmVhZChVUkkuZmlsZShqb2luKHRlc3REaXIsICdzbWFsbC50eHQnKSksIHsgYWNjZXB0VGV4dE9ubHk6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5uYW1lLCAnc21hbGwudHh0Jyk7XG5cdH0pO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQTJCLGtCQUEwQyx5QkFBeUIsd0JBQXdCO0FBQ3RILFNBQVMsV0FBVztBQUNwQixTQUFTLE1BQU0sZ0JBQWdCO0FBQy9CLFNBQVMsU0FBUyxlQUFlLFNBQVMsTUFBTSxhQUFhLGFBQWEsZ0JBQWdCO0FBQzFGLFNBQVMsZ0JBQWdCLGdCQUFnQjtBQUN6QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUF3Qix3QkFBd0I7QUFDaEQsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyx5Q0FBeUM7QUFDbEQsU0FBUyx1QkFBdUI7QUF3QmpCLFNBQVIsWUFBNkIsUUFBZ0I7QUFDbkQsTUFBSTtBQUNKLE1BQUksVUFBVTtBQUNkLFFBQU0sRUFBRSxRQUFRLE1BQU0sVUFBVSxvQkFBb0IsSUFBSTtBQUN4RCxRQUFNLGNBQWMsSUFBSSxnQkFBZ0I7QUFFeEMsUUFBTSxZQUFZO0FBQ2pCLFVBQU0sU0FBUyxNQUFNLE9BQU8sTUFBTTtBQUNsQyxjQUFVLE9BQU87QUFDakIs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
