import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { incrementFileName } from "../../browser/fileActions.js";
suite("Files - Increment file name simple", () => {
  test("Increment file name without any version", function() {
    const name = "test.js";
    const result = incrementFileName(name, false, "simple");
    assert.strictEqual(result, "test copy.js");
  });
  test("Increment file name with suffix version", function() {
    const name = "test copy.js";
    const result = incrementFileName(name, false, "simple");
    assert.strictEqual(result, "test copy 2.js");
  });
  test("Increment file name with suffix version with leading zeros", function() {
    const name = "test copy 005.js";
    const result = incrementFileName(name, false, "simple");
    assert.strictEqual(result, "test copy 6.js");
  });
  test("Increment file name with suffix version, too big number", function() {
    const name = "test copy 9007199254740992.js";
    const result = incrementFileName(name, false, "simple");
    assert.strictEqual(result, "test copy 9007199254740992 copy.js");
  });
  test("Increment file name with just version in name", function() {
    const name = "copy.js";
    const result = incrementFileName(name, false, "simple");
    assert.strictEqual(result, "copy copy.js");
  });
  test("Increment file name with just version in name, v2", function() {
    const name = "copy 2.js";
    const result = incrementFileName(name, false, "simple");
    assert.strictEqual(result, "copy 2 copy.js");
  });
  test("Increment file name without any extension or version", function() {
    const name = "test";
    const result = incrementFileName(name, false, "simple");
    assert.strictEqual(result, "test copy");
  });
  test("Increment file name without any extension or version, trailing dot", function() {
    const name = "test.";
    const result = incrementFileName(name, false, "simple");
    assert.strictEqual(result, "test copy.");
  });
  test("Increment file name without any extension or version, leading dot", function() {
    const name = ".test";
    const result = incrementFileName(name, false, "simple");
    assert.strictEqual(result, ".test copy");
  });
  test("Increment file name without any extension or version, leading dot v2", function() {
    const name = "..test";
    const result = incrementFileName(name, false, "simple");
    assert.strictEqual(result, ". copy.test");
  });
  test("Increment file name without any extension but with suffix version", function() {
    const name = "test copy 5";
    const result = incrementFileName(name, false, "simple");
    assert.strictEqual(result, "test copy 6");
  });
  test("Increment folder name without any version", function() {
    const name = "test";
    const result = incrementFileName(name, true, "simple");
    assert.strictEqual(result, "test copy");
  });
  test("Increment folder name with suffix version", function() {
    const name = "test copy";
    const result = incrementFileName(name, true, "simple");
    assert.strictEqual(result, "test copy 2");
  });
  test("Increment folder name with suffix version, leading zeros", function() {
    const name = "test copy 005";
    const result = incrementFileName(name, true, "simple");
    assert.strictEqual(result, "test copy 6");
  });
  test("Increment folder name with suffix version, too big number", function() {
    const name = "test copy 9007199254740992";
    const result = incrementFileName(name, true, "simple");
    assert.strictEqual(result, "test copy 9007199254740992 copy");
  });
  test("Increment folder name with just version in name", function() {
    const name = "copy";
    const result = incrementFileName(name, true, "simple");
    assert.strictEqual(result, "copy copy");
  });
  test("Increment folder name with just version in name, v2", function() {
    const name = "copy 2";
    const result = incrementFileName(name, true, "simple");
    assert.strictEqual(result, "copy 2 copy");
  });
  test('Increment folder name "with extension" but without any version', function() {
    const name = "test.js";
    const result = incrementFileName(name, true, "simple");
    assert.strictEqual(result, "test.js copy");
  });
  test('Increment folder name "with extension" and with suffix version', function() {
    const name = "test.js copy 5";
    const result = incrementFileName(name, true, "simple");
    assert.strictEqual(result, "test.js copy 6");
  });
  test("Increment file/folder name with suffix version, special case 1", function() {
    const name = "test copy 0";
    const result = incrementFileName(name, true, "simple");
    assert.strictEqual(result, "test copy");
  });
  test("Increment file/folder name with suffix version, special case 2", function() {
    const name = "test copy 1";
    const result = incrementFileName(name, true, "simple");
    assert.strictEqual(result, "test copy 2");
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
suite("Files - Increment file name smart", () => {
  test("Increment file name without any version", function() {
    const name = "test.js";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "test.1.js");
  });
  test("Increment folder name without any version", function() {
    const name = "test";
    const result = incrementFileName(name, true, "smart");
    assert.strictEqual(result, "test.1");
  });
  test("Increment file name with suffix version", function() {
    const name = "test.1.js";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "test.2.js");
  });
  test("Increment file name with suffix version with trailing zeros", function() {
    const name = "test.001.js";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "test.002.js");
  });
  test("Increment file name with suffix version with trailing zeros, changing length", function() {
    const name = "test.009.js";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "test.010.js");
  });
  test("Increment file name with suffix version with `-` as separator", function() {
    const name = "test-1.js";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "test-2.js");
  });
  test("Increment file name with suffix version with `-` as separator, trailing zeros", function() {
    const name = "test-001.js";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "test-002.js");
  });
  test("Increment file name with suffix version with `-` as separator, trailing zeros, changnig length", function() {
    const name = "test-099.js";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "test-100.js");
  });
  test("Increment file name with suffix version with `_` as separator", function() {
    const name = "test_1.js";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "test_2.js");
  });
  test("Increment folder name with suffix version", function() {
    const name = "test.1";
    const result = incrementFileName(name, true, "smart");
    assert.strictEqual(result, "test.2");
  });
  test("Increment folder name with suffix version, trailing zeros", function() {
    const name = "test.001";
    const result = incrementFileName(name, true, "smart");
    assert.strictEqual(result, "test.002");
  });
  test("Increment folder name with suffix version with `-` as separator", function() {
    const name = "test-1";
    const result = incrementFileName(name, true, "smart");
    assert.strictEqual(result, "test-2");
  });
  test("Increment folder name with suffix version with `_` as separator", function() {
    const name = "test_1";
    const result = incrementFileName(name, true, "smart");
    assert.strictEqual(result, "test_2");
  });
  test("Increment file name with suffix version, too big number", function() {
    const name = "test.9007199254740992.js";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "test.9007199254740992.1.js");
  });
  test("Increment folder name with suffix version, too big number", function() {
    const name = "test.9007199254740992";
    const result = incrementFileName(name, true, "smart");
    assert.strictEqual(result, "test.9007199254740992.1");
  });
  test("Increment file name with prefix version", function() {
    const name = "1.test.js";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "2.test.js");
  });
  test("Increment file name with just version in name", function() {
    const name = "1.js";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "2.js");
  });
  test("Increment file name with just version in name, too big number", function() {
    const name = "9007199254740992.js";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "9007199254740992.1.js");
  });
  test("Increment file name with prefix version, trailing zeros", function() {
    const name = "001.test.js";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "002.test.js");
  });
  test("Increment file name with prefix version with `-` as separator", function() {
    const name = "1-test.js";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "2-test.js");
  });
  test("Increment file name with prefix version with `_` as separator", function() {
    const name = "1_test.js";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "2_test.js");
  });
  test("Increment file name with prefix version, too big number", function() {
    const name = "9007199254740992.test.js";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "9007199254740992.test.1.js");
  });
  test("Increment file name with just version and no extension", function() {
    const name = "001004";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "001005");
  });
  test("Increment file name with just version and no extension, too big number", function() {
    const name = "9007199254740992";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "9007199254740992.1");
  });
  test("Increment file name with no extension and no version", function() {
    const name = "file";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "file1");
  });
  test("Increment file name with no extension", function() {
    const name = "file1";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "file2");
  });
  test("Increment file name with no extension, too big number", function() {
    const name = "file9007199254740992";
    const result = incrementFileName(name, false, "smart");
    assert.strictEqual(result, "file9007199254740992.1");
  });
  test("Increment folder name with prefix version", function() {
    const name = "1.test";
    const result = incrementFileName(name, true, "smart");
    assert.strictEqual(result, "2.test");
  });
  test("Increment folder name with prefix version, too big number", function() {
    const name = "9007199254740992.test";
    const result = incrementFileName(name, true, "smart");
    assert.strictEqual(result, "9007199254740992.test.1");
  });
  test("Increment folder name with prefix version, trailing zeros", function() {
    const name = "001.test";
    const result = incrementFileName(name, true, "smart");
    assert.strictEqual(result, "002.test");
  });
  test("Increment folder name with prefix version  with `-` as separator", function() {
    const name = "1-test";
    const result = incrementFileName(name, true, "smart");
    assert.strictEqual(result, "2-test");
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy90ZXN0L2Jyb3dzZXIvZmlsZUFjdGlvbnMudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgaW5jcmVtZW50RmlsZU5hbWUgfSBmcm9tICcuLi8uLi9icm93c2VyL2ZpbGVBY3Rpb25zLmpzJztcblxuc3VpdGUoJ0ZpbGVzIC0gSW5jcmVtZW50IGZpbGUgbmFtZSBzaW1wbGUnLCAoKSA9PiB7XG5cblx0dGVzdCgnSW5jcmVtZW50IGZpbGUgbmFtZSB3aXRob3V0IGFueSB2ZXJzaW9uJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG5hbWUgPSAndGVzdC5qcyc7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgZmFsc2UsICdzaW1wbGUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAndGVzdCBjb3B5LmpzJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmaWxlIG5hbWUgd2l0aCBzdWZmaXggdmVyc2lvbicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJ3Rlc3QgY29weS5qcyc7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgZmFsc2UsICdzaW1wbGUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAndGVzdCBjb3B5IDIuanMnKTtcblx0fSk7XG5cblx0dGVzdCgnSW5jcmVtZW50IGZpbGUgbmFtZSB3aXRoIHN1ZmZpeCB2ZXJzaW9uIHdpdGggbGVhZGluZyB6ZXJvcycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJ3Rlc3QgY29weSAwMDUuanMnO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGluY3JlbWVudEZpbGVOYW1lKG5hbWUsIGZhbHNlLCAnc2ltcGxlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgJ3Rlc3QgY29weSA2LmpzJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmaWxlIG5hbWUgd2l0aCBzdWZmaXggdmVyc2lvbiwgdG9vIGJpZyBudW1iZXInLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbmFtZSA9ICd0ZXN0IGNvcHkgOTAwNzE5OTI1NDc0MDk5Mi5qcyc7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgZmFsc2UsICdzaW1wbGUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAndGVzdCBjb3B5IDkwMDcxOTkyNTQ3NDA5OTIgY29weS5qcycpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbmNyZW1lbnQgZmlsZSBuYW1lIHdpdGgganVzdCB2ZXJzaW9uIGluIG5hbWUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbmFtZSA9ICdjb3B5LmpzJztcblx0XHRjb25zdCByZXN1bHQgPSBpbmNyZW1lbnRGaWxlTmFtZShuYW1lLCBmYWxzZSwgJ3NpbXBsZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsICdjb3B5IGNvcHkuanMnKTtcblx0fSk7XG5cblx0dGVzdCgnSW5jcmVtZW50IGZpbGUgbmFtZSB3aXRoIGp1c3QgdmVyc2lvbiBpbiBuYW1lLCB2MicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJ2NvcHkgMi5qcyc7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgZmFsc2UsICdzaW1wbGUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAnY29weSAyIGNvcHkuanMnKTtcblx0fSk7XG5cblx0dGVzdCgnSW5jcmVtZW50IGZpbGUgbmFtZSB3aXRob3V0IGFueSBleHRlbnNpb24gb3IgdmVyc2lvbicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJ3Rlc3QnO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGluY3JlbWVudEZpbGVOYW1lKG5hbWUsIGZhbHNlLCAnc2ltcGxlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgJ3Rlc3QgY29weScpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbmNyZW1lbnQgZmlsZSBuYW1lIHdpdGhvdXQgYW55IGV4dGVuc2lvbiBvciB2ZXJzaW9uLCB0cmFpbGluZyBkb3QnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbmFtZSA9ICd0ZXN0Lic7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgZmFsc2UsICdzaW1wbGUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAndGVzdCBjb3B5LicpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbmNyZW1lbnQgZmlsZSBuYW1lIHdpdGhvdXQgYW55IGV4dGVuc2lvbiBvciB2ZXJzaW9uLCBsZWFkaW5nIGRvdCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJy50ZXN0Jztcblx0XHRjb25zdCByZXN1bHQgPSBpbmNyZW1lbnRGaWxlTmFtZShuYW1lLCBmYWxzZSwgJ3NpbXBsZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsICcudGVzdCBjb3B5Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmaWxlIG5hbWUgd2l0aG91dCBhbnkgZXh0ZW5zaW9uIG9yIHZlcnNpb24sIGxlYWRpbmcgZG90IHYyJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG5hbWUgPSAnLi50ZXN0Jztcblx0XHRjb25zdCByZXN1bHQgPSBpbmNyZW1lbnRGaWxlTmFtZShuYW1lLCBmYWxzZSwgJ3NpbXBsZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsICcuIGNvcHkudGVzdCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbmNyZW1lbnQgZmlsZSBuYW1lIHdpdGhvdXQgYW55IGV4dGVuc2lvbiBidXQgd2l0aCBzdWZmaXggdmVyc2lvbicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJ3Rlc3QgY29weSA1Jztcblx0XHRjb25zdCByZXN1bHQgPSBpbmNyZW1lbnRGaWxlTmFtZShuYW1lLCBmYWxzZSwgJ3NpbXBsZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsICd0ZXN0IGNvcHkgNicpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbmNyZW1lbnQgZm9sZGVyIG5hbWUgd2l0aG91dCBhbnkgdmVyc2lvbicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJ3Rlc3QnO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGluY3JlbWVudEZpbGVOYW1lKG5hbWUsIHRydWUsICdzaW1wbGUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAndGVzdCBjb3B5Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmb2xkZXIgbmFtZSB3aXRoIHN1ZmZpeCB2ZXJzaW9uJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG5hbWUgPSAndGVzdCBjb3B5Jztcblx0XHRjb25zdCByZXN1bHQgPSBpbmNyZW1lbnRGaWxlTmFtZShuYW1lLCB0cnVlLCAnc2ltcGxlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgJ3Rlc3QgY29weSAyJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmb2xkZXIgbmFtZSB3aXRoIHN1ZmZpeCB2ZXJzaW9uLCBsZWFkaW5nIHplcm9zJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG5hbWUgPSAndGVzdCBjb3B5IDAwNSc7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgdHJ1ZSwgJ3NpbXBsZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsICd0ZXN0IGNvcHkgNicpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbmNyZW1lbnQgZm9sZGVyIG5hbWUgd2l0aCBzdWZmaXggdmVyc2lvbiwgdG9vIGJpZyBudW1iZXInLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbmFtZSA9ICd0ZXN0IGNvcHkgOTAwNzE5OTI1NDc0MDk5Mic7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgdHJ1ZSwgJ3NpbXBsZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsICd0ZXN0IGNvcHkgOTAwNzE5OTI1NDc0MDk5MiBjb3B5Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmb2xkZXIgbmFtZSB3aXRoIGp1c3QgdmVyc2lvbiBpbiBuYW1lJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG5hbWUgPSAnY29weSc7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgdHJ1ZSwgJ3NpbXBsZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsICdjb3B5IGNvcHknKTtcblx0fSk7XG5cblx0dGVzdCgnSW5jcmVtZW50IGZvbGRlciBuYW1lIHdpdGgganVzdCB2ZXJzaW9uIGluIG5hbWUsIHYyJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG5hbWUgPSAnY29weSAyJztcblx0XHRjb25zdCByZXN1bHQgPSBpbmNyZW1lbnRGaWxlTmFtZShuYW1lLCB0cnVlLCAnc2ltcGxlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgJ2NvcHkgMiBjb3B5Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmb2xkZXIgbmFtZSBcIndpdGggZXh0ZW5zaW9uXCIgYnV0IHdpdGhvdXQgYW55IHZlcnNpb24nLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbmFtZSA9ICd0ZXN0LmpzJztcblx0XHRjb25zdCByZXN1bHQgPSBpbmNyZW1lbnRGaWxlTmFtZShuYW1lLCB0cnVlLCAnc2ltcGxlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgJ3Rlc3QuanMgY29weScpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbmNyZW1lbnQgZm9sZGVyIG5hbWUgXCJ3aXRoIGV4dGVuc2lvblwiIGFuZCB3aXRoIHN1ZmZpeCB2ZXJzaW9uJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG5hbWUgPSAndGVzdC5qcyBjb3B5IDUnO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGluY3JlbWVudEZpbGVOYW1lKG5hbWUsIHRydWUsICdzaW1wbGUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAndGVzdC5qcyBjb3B5IDYnKTtcblx0fSk7XG5cblx0dGVzdCgnSW5jcmVtZW50IGZpbGUvZm9sZGVyIG5hbWUgd2l0aCBzdWZmaXggdmVyc2lvbiwgc3BlY2lhbCBjYXNlIDEnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbmFtZSA9ICd0ZXN0IGNvcHkgMCc7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgdHJ1ZSwgJ3NpbXBsZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsICd0ZXN0IGNvcHknKTtcblx0fSk7XG5cblx0dGVzdCgnSW5jcmVtZW50IGZpbGUvZm9sZGVyIG5hbWUgd2l0aCBzdWZmaXggdmVyc2lvbiwgc3BlY2lhbCBjYXNlIDInLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbmFtZSA9ICd0ZXN0IGNvcHkgMSc7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgdHJ1ZSwgJ3NpbXBsZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsICd0ZXN0IGNvcHkgMicpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcbn0pO1xuXG5zdWl0ZSgnRmlsZXMgLSBJbmNyZW1lbnQgZmlsZSBuYW1lIHNtYXJ0JywgKCkgPT4ge1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmaWxlIG5hbWUgd2l0aG91dCBhbnkgdmVyc2lvbicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJ3Rlc3QuanMnO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGluY3JlbWVudEZpbGVOYW1lKG5hbWUsIGZhbHNlLCAnc21hcnQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAndGVzdC4xLmpzJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmb2xkZXIgbmFtZSB3aXRob3V0IGFueSB2ZXJzaW9uJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG5hbWUgPSAndGVzdCc7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgdHJ1ZSwgJ3NtYXJ0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgJ3Rlc3QuMScpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbmNyZW1lbnQgZmlsZSBuYW1lIHdpdGggc3VmZml4IHZlcnNpb24nLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbmFtZSA9ICd0ZXN0LjEuanMnO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGluY3JlbWVudEZpbGVOYW1lKG5hbWUsIGZhbHNlLCAnc21hcnQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAndGVzdC4yLmpzJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmaWxlIG5hbWUgd2l0aCBzdWZmaXggdmVyc2lvbiB3aXRoIHRyYWlsaW5nIHplcm9zJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG5hbWUgPSAndGVzdC4wMDEuanMnO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGluY3JlbWVudEZpbGVOYW1lKG5hbWUsIGZhbHNlLCAnc21hcnQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAndGVzdC4wMDIuanMnKTtcblx0fSk7XG5cblx0dGVzdCgnSW5jcmVtZW50IGZpbGUgbmFtZSB3aXRoIHN1ZmZpeCB2ZXJzaW9uIHdpdGggdHJhaWxpbmcgemVyb3MsIGNoYW5naW5nIGxlbmd0aCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJ3Rlc3QuMDA5LmpzJztcblx0XHRjb25zdCByZXN1bHQgPSBpbmNyZW1lbnRGaWxlTmFtZShuYW1lLCBmYWxzZSwgJ3NtYXJ0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgJ3Rlc3QuMDEwLmpzJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmaWxlIG5hbWUgd2l0aCBzdWZmaXggdmVyc2lvbiB3aXRoIGAtYCBhcyBzZXBhcmF0b3InLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbmFtZSA9ICd0ZXN0LTEuanMnO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGluY3JlbWVudEZpbGVOYW1lKG5hbWUsIGZhbHNlLCAnc21hcnQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAndGVzdC0yLmpzJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmaWxlIG5hbWUgd2l0aCBzdWZmaXggdmVyc2lvbiB3aXRoIGAtYCBhcyBzZXBhcmF0b3IsIHRyYWlsaW5nIHplcm9zJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG5hbWUgPSAndGVzdC0wMDEuanMnO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGluY3JlbWVudEZpbGVOYW1lKG5hbWUsIGZhbHNlLCAnc21hcnQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAndGVzdC0wMDIuanMnKTtcblx0fSk7XG5cblx0dGVzdCgnSW5jcmVtZW50IGZpbGUgbmFtZSB3aXRoIHN1ZmZpeCB2ZXJzaW9uIHdpdGggYC1gIGFzIHNlcGFyYXRvciwgdHJhaWxpbmcgemVyb3MsIGNoYW5nbmlnIGxlbmd0aCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJ3Rlc3QtMDk5LmpzJztcblx0XHRjb25zdCByZXN1bHQgPSBpbmNyZW1lbnRGaWxlTmFtZShuYW1lLCBmYWxzZSwgJ3NtYXJ0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgJ3Rlc3QtMTAwLmpzJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmaWxlIG5hbWUgd2l0aCBzdWZmaXggdmVyc2lvbiB3aXRoIGBfYCBhcyBzZXBhcmF0b3InLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbmFtZSA9ICd0ZXN0XzEuanMnO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGluY3JlbWVudEZpbGVOYW1lKG5hbWUsIGZhbHNlLCAnc21hcnQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAndGVzdF8yLmpzJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmb2xkZXIgbmFtZSB3aXRoIHN1ZmZpeCB2ZXJzaW9uJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG5hbWUgPSAndGVzdC4xJztcblx0XHRjb25zdCByZXN1bHQgPSBpbmNyZW1lbnRGaWxlTmFtZShuYW1lLCB0cnVlLCAnc21hcnQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAndGVzdC4yJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmb2xkZXIgbmFtZSB3aXRoIHN1ZmZpeCB2ZXJzaW9uLCB0cmFpbGluZyB6ZXJvcycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJ3Rlc3QuMDAxJztcblx0XHRjb25zdCByZXN1bHQgPSBpbmNyZW1lbnRGaWxlTmFtZShuYW1lLCB0cnVlLCAnc21hcnQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAndGVzdC4wMDInKTtcblx0fSk7XG5cblx0dGVzdCgnSW5jcmVtZW50IGZvbGRlciBuYW1lIHdpdGggc3VmZml4IHZlcnNpb24gd2l0aCBgLWAgYXMgc2VwYXJhdG9yJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG5hbWUgPSAndGVzdC0xJztcblx0XHRjb25zdCByZXN1bHQgPSBpbmNyZW1lbnRGaWxlTmFtZShuYW1lLCB0cnVlLCAnc21hcnQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAndGVzdC0yJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmb2xkZXIgbmFtZSB3aXRoIHN1ZmZpeCB2ZXJzaW9uIHdpdGggYF9gIGFzIHNlcGFyYXRvcicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJ3Rlc3RfMSc7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgdHJ1ZSwgJ3NtYXJ0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgJ3Rlc3RfMicpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbmNyZW1lbnQgZmlsZSBuYW1lIHdpdGggc3VmZml4IHZlcnNpb24sIHRvbyBiaWcgbnVtYmVyJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG5hbWUgPSAndGVzdC45MDA3MTk5MjU0NzQwOTkyLmpzJztcblx0XHRjb25zdCByZXN1bHQgPSBpbmNyZW1lbnRGaWxlTmFtZShuYW1lLCBmYWxzZSwgJ3NtYXJ0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgJ3Rlc3QuOTAwNzE5OTI1NDc0MDk5Mi4xLmpzJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmb2xkZXIgbmFtZSB3aXRoIHN1ZmZpeCB2ZXJzaW9uLCB0b28gYmlnIG51bWJlcicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJ3Rlc3QuOTAwNzE5OTI1NDc0MDk5Mic7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgdHJ1ZSwgJ3NtYXJ0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgJ3Rlc3QuOTAwNzE5OTI1NDc0MDk5Mi4xJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmaWxlIG5hbWUgd2l0aCBwcmVmaXggdmVyc2lvbicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJzEudGVzdC5qcyc7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgZmFsc2UsICdzbWFydCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsICcyLnRlc3QuanMnKTtcblx0fSk7XG5cblx0dGVzdCgnSW5jcmVtZW50IGZpbGUgbmFtZSB3aXRoIGp1c3QgdmVyc2lvbiBpbiBuYW1lJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG5hbWUgPSAnMS5qcyc7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgZmFsc2UsICdzbWFydCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsICcyLmpzJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmaWxlIG5hbWUgd2l0aCBqdXN0IHZlcnNpb24gaW4gbmFtZSwgdG9vIGJpZyBudW1iZXInLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbmFtZSA9ICc5MDA3MTk5MjU0NzQwOTkyLmpzJztcblx0XHRjb25zdCByZXN1bHQgPSBpbmNyZW1lbnRGaWxlTmFtZShuYW1lLCBmYWxzZSwgJ3NtYXJ0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgJzkwMDcxOTkyNTQ3NDA5OTIuMS5qcycpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbmNyZW1lbnQgZmlsZSBuYW1lIHdpdGggcHJlZml4IHZlcnNpb24sIHRyYWlsaW5nIHplcm9zJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG5hbWUgPSAnMDAxLnRlc3QuanMnO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGluY3JlbWVudEZpbGVOYW1lKG5hbWUsIGZhbHNlLCAnc21hcnQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAnMDAyLnRlc3QuanMnKTtcblx0fSk7XG5cblx0dGVzdCgnSW5jcmVtZW50IGZpbGUgbmFtZSB3aXRoIHByZWZpeCB2ZXJzaW9uIHdpdGggYC1gIGFzIHNlcGFyYXRvcicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJzEtdGVzdC5qcyc7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgZmFsc2UsICdzbWFydCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsICcyLXRlc3QuanMnKTtcblx0fSk7XG5cblx0dGVzdCgnSW5jcmVtZW50IGZpbGUgbmFtZSB3aXRoIHByZWZpeCB2ZXJzaW9uIHdpdGggYF9gIGFzIHNlcGFyYXRvcicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJzFfdGVzdC5qcyc7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgZmFsc2UsICdzbWFydCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsICcyX3Rlc3QuanMnKTtcblx0fSk7XG5cblx0dGVzdCgnSW5jcmVtZW50IGZpbGUgbmFtZSB3aXRoIHByZWZpeCB2ZXJzaW9uLCB0b28gYmlnIG51bWJlcicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJzkwMDcxOTkyNTQ3NDA5OTIudGVzdC5qcyc7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgZmFsc2UsICdzbWFydCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsICc5MDA3MTk5MjU0NzQwOTkyLnRlc3QuMS5qcycpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbmNyZW1lbnQgZmlsZSBuYW1lIHdpdGgganVzdCB2ZXJzaW9uIGFuZCBubyBleHRlbnNpb24nLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbmFtZSA9ICcwMDEwMDQnO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGluY3JlbWVudEZpbGVOYW1lKG5hbWUsIGZhbHNlLCAnc21hcnQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAnMDAxMDA1Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmaWxlIG5hbWUgd2l0aCBqdXN0IHZlcnNpb24gYW5kIG5vIGV4dGVuc2lvbiwgdG9vIGJpZyBudW1iZXInLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbmFtZSA9ICc5MDA3MTk5MjU0NzQwOTkyJztcblx0XHRjb25zdCByZXN1bHQgPSBpbmNyZW1lbnRGaWxlTmFtZShuYW1lLCBmYWxzZSwgJ3NtYXJ0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgJzkwMDcxOTkyNTQ3NDA5OTIuMScpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbmNyZW1lbnQgZmlsZSBuYW1lIHdpdGggbm8gZXh0ZW5zaW9uIGFuZCBubyB2ZXJzaW9uJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG5hbWUgPSAnZmlsZSc7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgZmFsc2UsICdzbWFydCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsICdmaWxlMScpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbmNyZW1lbnQgZmlsZSBuYW1lIHdpdGggbm8gZXh0ZW5zaW9uJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG5hbWUgPSAnZmlsZTEnO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGluY3JlbWVudEZpbGVOYW1lKG5hbWUsIGZhbHNlLCAnc21hcnQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAnZmlsZTInKTtcblx0fSk7XG5cblx0dGVzdCgnSW5jcmVtZW50IGZpbGUgbmFtZSB3aXRoIG5vIGV4dGVuc2lvbiwgdG9vIGJpZyBudW1iZXInLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbmFtZSA9ICdmaWxlOTAwNzE5OTI1NDc0MDk5Mic7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgZmFsc2UsICdzbWFydCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsICdmaWxlOTAwNzE5OTI1NDc0MDk5Mi4xJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmb2xkZXIgbmFtZSB3aXRoIHByZWZpeCB2ZXJzaW9uJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG5hbWUgPSAnMS50ZXN0Jztcblx0XHRjb25zdCByZXN1bHQgPSBpbmNyZW1lbnRGaWxlTmFtZShuYW1lLCB0cnVlLCAnc21hcnQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAnMi50ZXN0Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmb2xkZXIgbmFtZSB3aXRoIHByZWZpeCB2ZXJzaW9uLCB0b28gYmlnIG51bWJlcicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJzkwMDcxOTkyNTQ3NDA5OTIudGVzdCc7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgdHJ1ZSwgJ3NtYXJ0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgJzkwMDcxOTkyNTQ3NDA5OTIudGVzdC4xJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luY3JlbWVudCBmb2xkZXIgbmFtZSB3aXRoIHByZWZpeCB2ZXJzaW9uLCB0cmFpbGluZyB6ZXJvcycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJzAwMS50ZXN0Jztcblx0XHRjb25zdCByZXN1bHQgPSBpbmNyZW1lbnRGaWxlTmFtZShuYW1lLCB0cnVlLCAnc21hcnQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAnMDAyLnRlc3QnKTtcblx0fSk7XG5cblx0dGVzdCgnSW5jcmVtZW50IGZvbGRlciBuYW1lIHdpdGggcHJlZml4IHZlcnNpb24gIHdpdGggYC1gIGFzIHNlcGFyYXRvcicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBuYW1lID0gJzEtdGVzdCc7XG5cdFx0Y29uc3QgcmVzdWx0ID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgdHJ1ZSwgJ3NtYXJ0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgJzItdGVzdCcpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMseUJBQXlCO0FBRWxDLE1BQU0sc0NBQXNDLE1BQU07QUFFakQsT0FBSywyQ0FBMkMsV0FBWTtBQUMzRCxVQUFNLE9BQU87QUFDYixVQUFNLFNBQVMsa0JBQWtCLE1BQU0sT0FBTyxRQUFRO0FBQ3RELFdBQU8sWUFBWSxRQUFRLGNBQWM7QUFBQSxFQUMxQyxDQUFDO0FBRUQsT0FBSywyQ0FBMkMsV0FBWTtBQUMzRCxVQUFNLE9BQU87QUFDYixVQUFNLFNBQVMsa0JBQWtCLE1BQU0sT0FBTyxRQUFRO0FBQ3RELFdBQU8sWUFBWSxRQUFRLGdCQUFnQjtBQUFBLEVBQzVDLENBQUM7QUFFRCxPQUFLLDhEQUE4RCxXQUFZO0FBQzlFLFVBQU0sT0FBTztBQUNiLFVBQU0sU0FBUyxrQkFBa0IsTUFBTSxPQUFPLFFBQVE7QUFDdEQsV0FBTyxZQUFZLFFBQVEsZ0JBQWdCO0FBQUEsRUFDNUMsQ0FBQztB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
