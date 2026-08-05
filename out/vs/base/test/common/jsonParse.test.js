import assert from "assert";
import { parse, stripComments } from "../../common/jsonc.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "./utils.js";
suite("JSON Parse", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("Line comment", () => {
    const content = [
      "{",
      '  "prop": 10 // a comment',
      "}"
    ].join("\n");
    const expected = [
      "{",
      '  "prop": 10 ',
      "}"
    ].join("\n");
    assert.deepEqual(parse(content), JSON.parse(expected));
  });
  test("Line comment - EOF", () => {
    const content = [
      "{",
      "}",
      "// a comment"
    ].join("\n");
    const expected = [
      "{",
      "}",
      ""
    ].join("\n");
    assert.deepEqual(parse(content), JSON.parse(expected));
  });
  test("Line comment - \\r\\n", () => {
    const content = [
      "{",
      '  "prop": 10 // a comment',
      "}"
    ].join("\r\n");
    const expected = [
      "{",
      '  "prop": 10 ',
      "}"
    ].join("\r\n");
    assert.deepEqual(parse(content), JSON.parse(expected));
  });
  test("Line comment - EOF - \\r\\n", () => {
    const content = [
      "{",
      "}",
      "// a comment"
    ].join("\r\n");
    const expected = [
      "{",
      "}",
      ""
    ].join("\r\n");
    assert.deepEqual(parse(content), JSON.parse(expected));
  });
  test("Block comment - single line", () => {
    const content = [
      "{",
      '  /* before */"prop": 10/* after */',
      "}"
    ].join("\n");
    const expected = [
      "{",
      '  "prop": 10',
      "}"
    ].join("\n");
    assert.deepEqual(parse(content), JSON.parse(expected));
  });
  test("Block comment - multi line", () => {
    const content = [
      "{",
      "  /**",
      "   * Some comment",
      "   */",
      '  "prop": 10',
      "}"
    ].join("\n");
    const expected = [
      "{",
      "  ",
      '  "prop": 10',
      "}"
    ].join("\n");
    assert.deepEqual(parse(content), JSON.parse(expected));
  });
  test("Block comment - shortest match", () => {
    const content = "/* abc */ */";
    const expected = " */";
    assert.strictEqual(stripComments(content), expected);
  });
  test("No strings - double quote", () => {
    const content = [
      "{",
      '  "/* */": 10',
      "}"
    ].join("\n");
    const expected = [
      "{",
      '  "/* */": 10',
      "}"
    ].join("\n");
    assert.deepEqual(parse(content), JSON.parse(expected));
  });
  test("No strings - single quote", () => {
    const content = [
      "{",
      "  '/* */': 10",
      "}"
    ].join("\n");
    const expected = [
      "{",
      "  '/* */': 10",
      "}"
    ].join("\n");
    assert.strictEqual(stripComments(content), expected);
  });
  test("Trailing comma in object", () => {
    const content = [
      "{",
      `  "a": 10,`,
      "}"
    ].join("\n");
    const expected = [
      "{",
      `  "a": 10`,
      "}"
    ].join("\n");
    assert.deepEqual(parse(content), JSON.parse(expected));
  });
  test("Trailing comma in array", () => {
    const content = [
      `[ "a", "b", "c", ]`
    ].join("\n");
    const expected = [
      `[ "a", "b", "c" ]`
    ].join("\n");
    assert.deepEqual(parse(content), JSON.parse(expected));
  });
  test("Trailing comma", () => {
    const content = [
      "{",
      '  "propA": 10, // a comment',
      '  "propB": false, // a trailing comma',
      "}"
    ].join("\n");
    const expected = [
      "{",
      '  "propA": 10,',
      '  "propB": false',
      "}"
    ].join("\n");
    assert.deepEqual(parse(content), JSON.parse(expected));
  });
  test("Trailing comma - EOF", () => {
    const content = `
// This configuration file allows you to pass permanent command line arguments to VS Code.
// Only a subset of arguments is currently supported to reduce the likelihood of breaking
// the installation.
//
// PLEASE DO NOT CHANGE WITHOUT UNDERSTANDING THE IMPACT
//
// NOTE: Changing this file requires a restart of VS Code.
{
	// Use software rendering instead of hardware accelerated rendering.
	// This can help in cases where you see rendering issues in VS Code.
	// "disable-hardware-acceleration": true,
	// Allows to disable crash reporting.
	// Should restart the app if the value is changed.
	"enable-crash-reporter": true,
	// Unique id used for correlating crash reports sent from this instance.
	// Do not edit this value.
	"crash-reporter-id": "aaaaab31-7453-4506-97d0-93411b2c21c7",
	"locale": "en",
	// "log-level": "trace"
}
`;
    assert.deepEqual(parse(content), {
      "enable-crash-reporter": true,
      "crash-reporter-id": "aaaaab31-7453-4506-97d0-93411b2c21c7",
      "locale": "en"
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvY29tbW9uL2pzb25QYXJzZS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcblxuaW1wb3J0IHsgcGFyc2UsIHN0cmlwQ29tbWVudHMgfSBmcm9tICcuLi8uLi9jb21tb24vanNvbmMuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi91dGlscy5qcyc7XG5cbnN1aXRlKCdKU09OIFBhcnNlJywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdMaW5lIGNvbW1lbnQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGVudDogc3RyaW5nID0gW1xuXHRcdFx0XCJ7XCIsXG5cdFx0XHRcIiAgXFxcInByb3BcXFwiOiAxMCAvLyBhIGNvbW1lbnRcIixcblx0XHRcdFwifVwiLFxuXHRcdF0uam9pbignXFxuJyk7XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRcIntcIixcblx0XHRcdFwiICBcXFwicHJvcFxcXCI6IDEwIFwiLFxuXHRcdFx0XCJ9XCIsXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKHBhcnNlKGNvbnRlbnQpLCBKU09OLnBhcnNlKGV4cGVjdGVkKSk7XG5cdH0pO1xuXHR0ZXN0KCdMaW5lIGNvbW1lbnQgLSBFT0YnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGVudDogc3RyaW5nID0gW1xuXHRcdFx0XCJ7XCIsXG5cdFx0XHRcIn1cIixcblx0XHRcdFwiLy8gYSBjb21tZW50XCJcblx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0XCJ7XCIsXG5cdFx0XHRcIn1cIixcblx0XHRcdFwiXCJcblx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwocGFyc2UoY29udGVudCksIEpTT04ucGFyc2UoZXhwZWN0ZWQpKTtcblx0fSk7XG5cdHRlc3QoJ0xpbmUgY29tbWVudCAtIFxcXFxyXFxcXG4nLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGVudDogc3RyaW5nID0gW1xuXHRcdFx0XCJ7XCIsXG5cdFx0XHRcIiAgXFxcInByb3BcXFwiOiAxMCAvLyBhIGNvbW1lbnRcIixcblx0XHRcdFwifVwiLFxuXHRcdF0uam9pbignXFxyXFxuJyk7XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRcIntcIixcblx0XHRcdFwiICBcXFwicHJvcFxcXCI6IDEwIFwiLFxuXHRcdFx0XCJ9XCIsXG5cdFx0XS5qb2luKCdcXHJcXG4nKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKHBhcnNlKGNvbnRlbnQpLCBKU09OLnBhcnNlKGV4cGVjdGVkKSk7XG5cdH0pO1xuXHR0ZXN0KCdMaW5lIGNvbW1lbnQgLSBFT0YgLSBcXFxcclxcXFxuJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbnRlbnQ6IHN0cmluZyA9IFtcblx0XHRcdFwie1wiLFxuXHRcdFx0XCJ9XCIsXG5cdFx0XHRcIi8vIGEgY29tbWVudFwiXG5cdFx0XS5qb2luKCdcXHJcXG4nKTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdFwie1wiLFxuXHRcdFx0XCJ9XCIsXG5cdFx0XHRcIlwiXG5cdFx0XS5qb2luKCdcXHJcXG4nKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKHBhcnNlKGNvbnRlbnQpLCBKU09OLnBhcnNlKGV4cGVjdGVkKSk7XG5cdH0pO1xuXHR0ZXN0KCdCbG9jayBjb21tZW50IC0gc2luZ2xlIGxpbmUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGVudDogc3RyaW5nID0gW1xuXHRcdFx0XCJ7XCIsXG5cdFx0XHRcIiAgLyogYmVmb3JlICovXFxcInByb3BcXFwiOiAxMC8qIGFmdGVyICovXCIsXG5cdFx0XHRcIn1cIixcblx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0XCJ7XCIsXG5cdFx0XHRcIiAgXFxcInByb3BcXFwiOiAxMFwiLFxuXHRcdFx0XCJ9XCIsXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKHBhcnNlKGNvbnRlbnQpLCBKU09OLnBhcnNlKGV4cGVjdGVkKSk7XG5cdH0pO1xuXHR0ZXN0KCdCbG9jayBjb21tZW50IC0gbXVsdGkgbGluZScsICgpID0+IHtcblx0XHRjb25zdCBjb250ZW50OiBzdHJpbmcgPSBbXG5cdFx0XHRcIntcIixcblx0XHRcdFwiICAvKipcIixcblx0XHRcdFwiICAgKiBTb21lIGNvbW1lbnRcIixcblx0XHRcdFwiICAgKi9cIixcblx0XHRcdFwiICBcXFwicHJvcFxcXCI6IDEwXCIsXG5cdFx0XHRcIn1cIixcblx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0XCJ7XCIsXG5cdFx0XHRcIiAgXCIsXG5cdFx0XHRcIiAgXFxcInByb3BcXFwiOiAxMFwiLFxuXHRcdFx0XCJ9XCIsXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKHBhcnNlKGNvbnRlbnQpLCBKU09OLnBhcnNlKGV4cGVjdGVkKSk7XG5cdH0pO1xuXHR0ZXN0KCdCbG9jayBjb21tZW50IC0gc2hvcnRlc3QgbWF0Y2gnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGVudCA9IFwiLyogYWJjICovICovXCI7XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBcIiAqL1wiO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHJpcENvbW1lbnRzKGNvbnRlbnQpLCBleHBlY3RlZCk7XG5cdH0pO1xuXHR0ZXN0KCdObyBzdHJpbmdzIC0gZG91YmxlIHF1b3RlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbnRlbnQ6IHN0cmluZyA9IFtcblx0XHRcdFwie1wiLFxuXHRcdFx0XCIgIFxcXCIvKiAqL1xcXCI6IDEwXCIsXG5cdFx0XHRcIn1cIlxuXHRcdF0uam9pbignXFxuJyk7XG5cdFx0Y29uc3QgZXhwZWN0ZWQ6IHN0cmluZyA9IFtcblx0XHRcdFwie1wiLFxuXHRcdFx0XCIgIFxcXCIvKiAqL1xcXCI6IDEwXCIsXG5cdFx0XHRcIn1cIlxuXHRcdF0uam9pbignXFxuJyk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChwYXJzZShjb250ZW50KSwgSlNPTi5wYXJzZShleHBlY3RlZCkpO1xuXHR9KTtcblx0dGVzdCgnTm8gc3RyaW5ncyAtIHNpbmdsZSBxdW90ZScsICgpID0+IHtcblx0XHRjb25zdCBjb250ZW50OiBzdHJpbmcgPSBbXG5cdFx0XHRcIntcIixcblx0XHRcdFwiICAnLyogKi8nOiAxMFwiLFxuXHRcdFx0XCJ9XCJcblx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdGNvbnN0IGV4cGVjdGVkOiBzdHJpbmcgPSBbXG5cdFx0XHRcIntcIixcblx0XHRcdFwiICAnLyogKi8nOiAxMFwiLFxuXHRcdFx0XCJ9XCJcblx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHJpcENvbW1lbnRzKGNvbnRlbnQpLCBleHBlY3RlZCk7XG5cdH0pO1xuXHR0ZXN0KCdUcmFpbGluZyBjb21tYSBpbiBvYmplY3QnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGVudDogc3RyaW5nID0gW1xuXHRcdFx0XCJ7XCIsXG5cdFx0XHRgICBcImFcIjogMTAsYCxcblx0XHRcdFwifVwiXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRjb25zdCBleHBlY3RlZDogc3RyaW5nID0gW1xuXHRcdFx0XCJ7XCIsXG5cdFx0XHRgICBcImFcIjogMTBgLFxuXHRcdFx0XCJ9XCJcblx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwocGFyc2UoY29udGVudCksIEpTT04ucGFyc2UoZXhwZWN0ZWQpKTtcblx0fSk7XG5cdHRlc3QoJ1RyYWlsaW5nIGNvbW1hIGluIGFycmF5JywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbnRlbnQ6IHN0cmluZyA9IFtcblx0XHRcdGBbIFwiYVwiLCBcImJcIiwgXCJjXCIsIF1gXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRjb25zdCBleHBlY3RlZDogc3RyaW5nID0gW1xuXHRcdFx0YFsgXCJhXCIsIFwiYlwiLCBcImNcIiBdYFxuXHRcdF0uam9pbignXFxuJyk7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChwYXJzZShjb250ZW50KSwgSlNPTi5wYXJzZShleHBlY3RlZCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdUcmFpbGluZyBjb21tYScsICgpID0+IHtcblx0XHRjb25zdCBjb250ZW50OiBzdHJpbmcgPSBbXG5cdFx0XHRcIntcIixcblx0XHRcdFwiICBcXFwicHJvcEFcXFwiOiAxMCwgLy8gYSBjb21tZW50XCIsXG5cdFx0XHRcIiAgXFxcInByb3BCXFxcIjogZmFsc2UsIC8vIGEgdHJhaWxpbmcgY29tbWFcIixcblx0XHRcdFwifVwiLFxuXHRcdF0uam9pbignXFxuJyk7XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRcIntcIixcblx0XHRcdFwiICBcXFwicHJvcEFcXFwiOiAxMCxcIixcblx0XHRcdFwiICBcXFwicHJvcEJcXFwiOiBmYWxzZVwiLFxuXHRcdFx0XCJ9XCIsXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKHBhcnNlKGNvbnRlbnQpLCBKU09OLnBhcnNlKGV4cGVjdGVkKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RyYWlsaW5nIGNvbW1hIC0gRU9GJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbnRlbnQgPSBgXG4vLyBUaGlzIGNvbmZpZ3VyYXRpb24gZmlsZSBhbGxvd3MgeW91IHRvIHBhc3MgcGVybWFuZW50IGNvbW1hbmQgbGluZSBhcmd1bWVudHMgdG8gVlMgQ29kZS5cbi8vIE9ubHkgYSBzdWJzZXQgb2YgYXJndW1lbnRzIGlzIGN1cnJlbnRseSBzdXBwb3J0ZWQgdG8gcmVkdWNlIHRoZSBsaWtlbGlob29kIG9mIGJyZWFraW5nXG4vLyB0aGUgaW5zdGFsbGF0aW9uLlxuLy9cbi8vIFBMRUFTRSBETyBOT1QgQ0hBTkdFIFdJVEhPVVQgVU5ERVJTVEFORElORyBUSEUgSU1QQUNUXG4vL1xuLy8gTk9URTogQ2hhbmdpbmcgdGhpcyBmaWxlIHJlcXVpcmVzIGEgcmVzdGFydCBvZiBWUyBDb2RlLlxue1xuXHQvLyBVc2Ugc29mdHdhcmUgcmVuZGVyaW5nIGluc3RlYWQgb2YgaGFyZHdhcmUgYWNjZWxlcmF0ZWQgcmVuZGVyaW5nLlxuXHQvLyBUaGlzIGNhbiBoZWxwIGluIGNhc2VzIHdoZXJlIHlvdSBzZWUgcmVuZGVyaW5nIGlzc3VlcyBpbiBWUyBDb2RlLlxuXHQvLyBcImRpc2FibGUtaGFyZHdhcmUtYWNjZWxlcmF0aW9uXCI6IHRydWUsXG5cdC8vIEFsbG93cyB0byBkaXNhYmxlIGNyYXNoIHJlcG9ydGluZy5cblx0Ly8gU2hvdWxkIHJlc3RhcnQgdGhlIGFwcCBpZiB0aGUgdmFsdWUgaXMgY2hhbmdlZC5cblx0XCJlbmFibGUtY3Jhc2gtcmVwb3J0ZXJcIjogdHJ1ZSxcblx0Ly8gVW5pcXVlIGlkIHVzZWQgZm9yIGNvcnJlbGF0aW5nIGNyYXNoIHJlcG9ydHMgc2VudCBmcm9tIHRoaXMgaW5zdGFuY2UuXG5cdC8vIERvIG5vdCBlZGl0IHRoaXMgdmFsdWUuXG5cdFwiY3Jhc2gtcmVwb3J0ZXItaWRcIjogXCJhYWFhYWIzMS03NDUzLTQ1MDYtOTdkMC05MzQxMWIyYzIxYzdcIixcblx0XCJsb2NhbGVcIjogXCJlblwiLFxuXHQvLyBcImxvZy1sZXZlbFwiOiBcInRyYWNlXCJcbn1cbmA7XG5cdFx0YXNzZXJ0LmRlZXBFcXVhbChwYXJzZShjb250ZW50KSwge1xuXHRcdFx0XCJlbmFibGUtY3Jhc2gtcmVwb3J0ZXJcIjogdHJ1ZSxcblx0XHRcdFwiY3Jhc2gtcmVwb3J0ZXItaWRcIjogXCJhYWFhYWIzMS03NDUzLTQ1MDYtOTdkMC05MzQxMWIyYzIxYzdcIixcblx0XHRcdFwibG9jYWxlXCI6IFwiZW5cIlxuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBSUEsT0FBTyxZQUFZO0FBRW5CLFNBQVMsT0FBTyxxQkFBcUI7QUFDckMsU0FBUywrQ0FBK0M7QUFFeEQsTUFBTSxjQUFjLE1BQU07QUFDekIsMENBQXdDO0FBRXhDLE9BQUssZ0JBQWdCLE1BQU07QUFDMUIsVUFBTSxVQUFrQjtBQUFBLE1BQ3ZCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELEVBQUUsS0FBSyxJQUFJO0FBQ1gsVUFBTSxXQUFXO0FBQUEsTUFDaEI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsRUFBRSxLQUFLLElBQUk7QUFDWCxXQUFPLFVBQVUsTUFBTSxPQUFPLEdBQUcsS0FBSyxNQUFNLFFBQVEsQ0FBQztBQUFBLEVBQ3RELENBQUM7QUFDRCxPQUFLLHNCQUFzQixNQUFNO0FBQ2hDLFVBQU0sVUFBa0I7QUFBQSxNQUN2QjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxFQUFFLEtBQUssSUFBSTtBQUNYLFVBQU0sV0FBVztBQUFBLE1BQ2hCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELEVBQUUsS0FBSyxJQUFJO0FBQ1gsV0FBTyxVQUFVLE1BQU0sT0FBTyxHQUFHLEtBQUssTUFBTSxRQUFRLENBQUM7QUFBQSxFQUN0RCxDQUFDO0FBQ0QsT0FBSyx5QkFBeUIsTUFBTTtBQUNuQyxVQUFNLFVBQWtCO0FBQUEsTUFDdkI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsRUFBRSxLQUFLLE1BQU07QUFDYixVQUFNLFdBQVc7QUFBQSxNQUNoQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxFQUFFLEtBQUssTUFBTTtBQUNiLFdBQU8sVUFBVSxNQUFNLE9BQU8sR0FBRyxLQUFLLE1BQU0sUUFBUSxDQUFDO0FBQUEsRUFDdEQsQ0FBQztBQUNELE9BQUssK0JBQStCLE1BQU07QUFDekMsVUFBTSxVQUFrQjtBQUFBLE1BQ3ZCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELEVBQUUsS0FBSyxNQUFNO0FBQ2IsVUFBTSxXQUFXO0FBQUEsTUFDaEI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsRUFBRSxLQUFLLE1BQU07QUFDYixXQUFPLFVBQVUsTUFBTSxPQUFPLEdBQUcsS0FBSyxNQUFNLFFBQVEsQ0FBQztBQUFBLEVBQ3RELENBQUM7QUFDRCxPQUFLLCtCQUErQixNQUFNO0FBQ3pDLFVBQU0sVUFBa0I7QUFBQSxNQUN2QjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxFQUFFLEtBQUssSUFBSTtBQUNYLFVBQU0sV0FBVztBQUFBLE1BQ2hCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELEVBQUUsS0FBSyxJQUFJO0FBQ1gsV0FBTyxVQUFVLE1BQU0sT0FBTyxHQUFHLEtBQUssTUFBTSxRQUFRLENBQUM7QUFBQSxFQUN0RCxDQUFDO0FBQ0QsT0FBSyw4QkFBOEIsTUFBTTtBQUN4QyxVQUFNLFVBQWtCO0FBQUEsTUFDdkI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsRUFBRSxLQUFLLElBQUk7QUFDWCxVQUFNLFdBQVc7QUFBQSxNQUNoQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsRUFBRSxLQUFLLElBQUk7QUFDWCxXQUFPLFVBQVUsTUFBTSxPQUFPLEdBQUcsS0FBSyxNQUFNLFFBQVEsQ0FBQztBQUFBLEVBQ3RELENBQUM7QUFDRCxPQUFLLGtDQUFrQyxNQUFNO0FBQzVDLFVBQU0sVUFBVTtBQUNoQixVQUFNLFdBQVc7QUFDakIsV0FBTyxZQUFZLGNBQWMsT0FBTyxHQUFHLFFBQVE7QUFBQSxFQUNwRCxDQUFDO0FBQ0QsT0FBSyw2QkFBNkIsTUFBTTtBQUN2QyxVQUFNLFVBQWtCO0FBQUEsTUFDdkI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsRUFBRSxLQUFLLElBQUk7QUFDWCxVQUFNLFdBQW1CO0FBQUEsTUFDeEI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsRUFBRSxLQUFLLElBQUk7QUFDWCxXQUFPLFVBQVUsTUFBTSxPQUFPLEdBQUcsS0FBSyxNQUFNLFFBQVEsQ0FBQztBQUFBLEVBQ3RELENBQUM7QUFDRCxPQUFLLDZCQUE2QixNQUFNO0FBQ3ZDLFVBQU0sVUFBa0I7QUFBQSxNQUN2QjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxFQUFFLEtBQUssSUFBSTtBQUNYLFVBQU0sV0FBbUI7QUFBQSxNQUN4QjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxFQUFFLEtBQUssSUFBSTtBQUNYLFdBQU8sWUFBWSxjQUFjLE9BQU8sR0FBRyxRQUFRO0FBQUEsRUFDcEQsQ0FBQztBQUNELE9BQUssNEJBQTRCLE1BQU07QUFDdEMsVUFBTSxVQUFrQjtBQUFBLE1BQ3ZCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELEVBQUUsS0FBSyxJQUFJO0FBQ1gsVUFBTSxXQUFtQjtBQUFBLE1BQ3hCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELEVBQUUsS0FBSyxJQUFJO0FBQ1gsV0FBTyxVQUFVLE1BQU0sT0FBTyxHQUFHLEtBQUssTUFBTSxRQUFRLENBQUM7QUFBQSxFQUN0RCxDQUFDO0FBQ0QsT0FBSywyQkFBMkIsTUFBTTtBQUNyQyxVQUFNLFVBQWtCO0FBQUEsTUFDdkI7QUFBQSxJQUNELEVBQUUsS0FBSyxJQUFJO0FBQ1gsVUFBTSxXQUFtQjtBQUFBLE1BQ3hCO0FBQUEsSUFDRCxFQUFFLEtBQUssSUFBSTtBQUNYLFdBQU8sVUFBVSxNQUFNLE9BQU8sR0FBRyxLQUFLLE1BQU0sUUFBUSxDQUFDO0FBQUEsRUFDdEQsQ0FBQztBQUVELE9BQUssa0JBQWtCLE1BQU07QUFDNUIsVUFBTSxVQUFrQjtBQUFBLE1BQ3ZCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxFQUFFLEtBQUssSUFBSTtBQUNYLFVBQU0sV0FBVztBQUFBLE1BQ2hCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxFQUFFLEtBQUssSUFBSTtBQUNYLFdBQU8sVUFBVSxNQUFNLE9BQU8sR0FBRyxLQUFLLE1BQU0sUUFBUSxDQUFDO0FBQUEsRUFDdEQsQ0FBQztBQUVELE9BQUssd0JBQXdCLE1BQU07QUFDbEMsVUFBTSxVQUFVO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBc0JoQixXQUFPLFVBQVUsTUFBTSxPQUFPLEdBQUc7QUFBQSxNQUNoQyx5QkFBeUI7QUFBQSxNQUN6QixxQkFBcUI7QUFBQSxNQUNyQixVQUFVO0FBQUEsSUFDWCxDQUFDO0FBQUEsRUFDRixDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
