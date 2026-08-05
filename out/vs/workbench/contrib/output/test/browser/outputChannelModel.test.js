import * as assert from "assert";
import { parseLogEntryAt } from "../../common/outputChannelModel.js";
import { TextModel } from "../../../../../editor/common/model/textModel.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { LogLevel } from "../../../../../platform/log/common/log.js";
import { workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
suite("Logs Parsing", () => {
  const disposables = ensureNoDisposablesAreLeakedInTestSuite();
  let instantiationService;
  setup(() => {
    instantiationService = disposables.add(workbenchInstantiationService({}, disposables));
  });
  test("should parse log entry with all components", () => {
    const text = "2023-10-15 14:30:45.123 [info] [Git] Initializing repository";
    const model = createModel(text);
    const entry = parseLogEntryAt(model, 1);
    assert.strictEqual(entry?.timestamp, (/* @__PURE__ */ new Date("2023-10-15 14:30:45.123")).getTime());
    assert.strictEqual(entry?.logLevel, LogLevel.Info);
    assert.strictEqual(entry?.category, "Git");
    assert.strictEqual(model.getValueInRange(entry?.range), text);
  });
  test("should parse multi-line log entry", () => {
    const text = [
      "2023-10-15 14:30:45.123 [error] [Extension] Failed with error:",
      "Error: Could not load extension",
      "    at Object.load (/path/to/file:10:5)"
    ].join("\n");
    const model = createModel(text);
    const entry = parseLogEntryAt(model, 1);
    assert.strictEqual(entry?.timestamp, (/* @__PURE__ */ new Date("2023-10-15 14:30:45.123")).getTime());
    assert.strictEqual(entry?.logLevel, LogLevel.Error);
    assert.strictEqual(entry?.category, "Extension");
    assert.strictEqual(model.getValueInRange(entry?.range), text);
  });
  test("should parse log entry without category", () => {
    const text = "2023-10-15 14:30:45.123 [warning] System is running low on memory";
    const model = createModel(text);
    const entry = parseLogEntryAt(model, 1);
    assert.strictEqual(entry?.timestamp, (/* @__PURE__ */ new Date("2023-10-15 14:30:45.123")).getTime());
    assert.strictEqual(entry?.logLevel, LogLevel.Warning);
    assert.strictEqual(entry?.category, void 0);
    assert.strictEqual(model.getValueInRange(entry?.range), text);
  });
  test("should return null for invalid log entry", () => {
    const model = createModel("Not a valid log entry");
    const entry = parseLogEntryAt(model, 1);
    assert.strictEqual(entry, null);
  });
  test("should parse all supported log levels", () => {
    const levels = {
      info: LogLevel.Info,
      trace: LogLevel.Trace,
      debug: LogLevel.Debug,
      warning: LogLevel.Warning,
      error: LogLevel.Error
    };
    for (const [levelText, expectedLevel] of Object.entries(levels)) {
      const model = createModel(`2023-10-15 14:30:45.123 [${levelText}] Test message`);
      const entry = parseLogEntryAt(model, 1);
      assert.strictEqual(entry?.logLevel, expectedLevel, `Failed for log level: ${levelText}`);
    }
  });
  test("should parse timestamp correctly", () => {
    const timestamps = [
      "2023-01-01 00:00:00.000",
      "2023-12-31 23:59:59.999",
      "2023-06-15 12:30:45.500"
    ];
    for (const timestamp of timestamps) {
      const model = createModel(`${timestamp} [info] Test message`);
      const entry = parseLogEntryAt(model, 1);
      assert.strictEqual(entry?.timestamp, new Date(timestamp).getTime(), `Failed for timestamp: ${timestamp}`);
    }
  });
  test("should handle last line of file", () => {
    const model = createModel([
      "2023-10-15 14:30:45.123 [info] First message",
      "2023-10-15 14:30:45.124 [info] Last message",
      ""
    ].join("\n"));
    let actual = parseLogEntryAt(model, 1);
    assert.strictEqual(actual?.timestamp, (/* @__PURE__ */ new Date("2023-10-15 14:30:45.123")).getTime());
    assert.strictEqual(actual?.logLevel, LogLevel.Info);
    assert.strictEqual(actual?.category, void 0);
    assert.strictEqual(model.getValueInRange(actual?.range), "2023-10-15 14:30:45.123 [info] First message");
    actual = parseLogEntryAt(model, 2);
    assert.strictEqual(actual?.timestamp, (/* @__PURE__ */ new Date("2023-10-15 14:30:45.124")).getTime());
    assert.strictEqual(actual?.logLevel, LogLevel.Info);
    assert.strictEqual(actual?.category, void 0);
    assert.strictEqual(model.getValueInRange(actual?.range), "2023-10-15 14:30:45.124 [info] Last message");
    actual = parseLogEntryAt(model, 3);
    assert.strictEqual(actual, null);
  });
  test("should parse multi-line log entry with empty lines", () => {
    const text = [
      "2025-01-27 09:53:00.450 [info] Found with version <20.18.1>",
      "Now using node v20.18.1 (npm v10.8.2)",
      "",
      "> husky - npm run -s precommit",
      "> husky - node v20.18.1",
      "",
      "Reading git index versions..."
    ].join("\n");
    const model = createModel(text);
    const entry = parseLogEntryAt(model, 1);
    assert.strictEqual(entry?.timestamp, (/* @__PURE__ */ new Date("2025-01-27 09:53:00.450")).getTime());
    assert.strictEqual(entry?.logLevel, LogLevel.Info);
    assert.strictEqual(entry?.category, void 0);
    assert.strictEqual(model.getValueInRange(entry?.range), text);
  });
  function createModel(content) {
    return disposables.add(instantiationService.createInstance(TextModel, content, "log", TextModel.DEFAULT_CREATION_OPTIONS, null));
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9vdXRwdXQvdGVzdC9icm93c2VyL291dHB1dENoYW5uZWxNb2RlbC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBwYXJzZUxvZ0VudHJ5QXQgfSBmcm9tICcuLi8uLi9jb21tb24vb3V0cHV0Q2hhbm5lbE1vZGVsLmpzJztcbmltcG9ydCB7IFRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgTG9nTGV2ZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuXG5zdWl0ZSgnTG9ncyBQYXJzaW5nJywgKCkgPT4ge1xuXG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlKHt9LCBkaXNwb3NhYmxlcykpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaG91bGQgcGFyc2UgbG9nIGVudHJ5IHdpdGggYWxsIGNvbXBvbmVudHMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgdGV4dCA9ICcyMDIzLTEwLTE1IDE0OjMwOjQ1LjEyMyBbaW5mb10gW0dpdF0gSW5pdGlhbGl6aW5nIHJlcG9zaXRvcnknO1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlTW9kZWwodGV4dCk7XG5cdFx0Y29uc3QgZW50cnkgPSBwYXJzZUxvZ0VudHJ5QXQobW9kZWwsIDEpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVudHJ5Py50aW1lc3RhbXAsIG5ldyBEYXRlKCcyMDIzLTEwLTE1IDE0OjMwOjQ1LjEyMycpLmdldFRpbWUoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVudHJ5Py5sb2dMZXZlbCwgTG9nTGV2ZWwuSW5mbyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVudHJ5Py5jYXRlZ29yeSwgJ0dpdCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZUluUmFuZ2UoZW50cnk/LnJhbmdlKSwgdGV4dCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Nob3VsZCBwYXJzZSBtdWx0aS1saW5lIGxvZyBlbnRyeScsICgpID0+IHtcblx0XHRjb25zdCB0ZXh0ID0gW1xuXHRcdFx0JzIwMjMtMTAtMTUgMTQ6MzA6NDUuMTIzIFtlcnJvcl0gW0V4dGVuc2lvbl0gRmFpbGVkIHdpdGggZXJyb3I6Jyxcblx0XHRcdCdFcnJvcjogQ291bGQgbm90IGxvYWQgZXh0ZW5zaW9uJyxcblx0XHRcdCcgICAgYXQgT2JqZWN0LmxvYWQgKC9wYXRoL3RvL2ZpbGU6MTA6NSknXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZU1vZGVsKHRleHQpO1xuXHRcdGNvbnN0IGVudHJ5ID0gcGFyc2VMb2dFbnRyeUF0KG1vZGVsLCAxKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbnRyeT8udGltZXN0YW1wLCBuZXcgRGF0ZSgnMjAyMy0xMC0xNSAxNDozMDo0NS4xMjMnKS5nZXRUaW1lKCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbnRyeT8ubG9nTGV2ZWwsIExvZ0xldmVsLkVycm9yKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW50cnk/LmNhdGVnb3J5LCAnRXh0ZW5zaW9uJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlSW5SYW5nZShlbnRyeT8ucmFuZ2UpLCB0ZXh0KTtcblx0fSk7XG5cblx0dGVzdCgnc2hvdWxkIHBhcnNlIGxvZyBlbnRyeSB3aXRob3V0IGNhdGVnb3J5JywgKCkgPT4ge1xuXHRcdGNvbnN0IHRleHQgPSAnMjAyMy0xMC0xNSAxNDozMDo0NS4xMjMgW3dhcm5pbmddIFN5c3RlbSBpcyBydW5uaW5nIGxvdyBvbiBtZW1vcnknO1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlTW9kZWwodGV4dCk7XG5cdFx0Y29uc3QgZW50cnkgPSBwYXJzZUxvZ0VudHJ5QXQobW9kZWwsIDEpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVudHJ5Py50aW1lc3RhbXAsIG5ldyBEYXRlKCcyMDIzLTEwLTE1IDE0OjMwOjQ1LjEyMycpLmdldFRpbWUoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVudHJ5Py5sb2dMZXZlbCwgTG9nTGV2ZWwuV2FybmluZyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVudHJ5Py5jYXRlZ29yeSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWVJblJhbmdlKGVudHJ5Py5yYW5nZSksIHRleHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaG91bGQgcmV0dXJuIG51bGwgZm9yIGludmFsaWQgbG9nIGVudHJ5JywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlTW9kZWwoJ05vdCBhIHZhbGlkIGxvZyBlbnRyeScpO1xuXHRcdGNvbnN0IGVudHJ5ID0gcGFyc2VMb2dFbnRyeUF0KG1vZGVsLCAxKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbnRyeSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Nob3VsZCBwYXJzZSBhbGwgc3VwcG9ydGVkIGxvZyBsZXZlbHMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGV2ZWxzID0ge1xuXHRcdFx0aW5mbzogTG9nTGV2ZWwuSW5mbyxcblx0XHRcdHRyYWNlOiBMb2dMZXZlbC5UcmFjZSxcblx0XHRcdGRlYnVnOiBMb2dMZXZlbC5EZWJ1Zyxcblx0XHRcdHdhcm5pbmc6IExvZ0xldmVsLldhcm5pbmcsXG5cdFx0XHRlcnJvcjogTG9nTGV2ZWwuRXJyb3Jcblx0XHR9O1xuXG5cdFx0Zm9yIChjb25zdCBbbGV2ZWxUZXh0LCBleHBlY3RlZExldmVsXSBvZiBPYmplY3QuZW50cmllcyhsZXZlbHMpKSB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZU1vZGVsKGAyMDIzLTEwLTE1IDE0OjMwOjQ1LjEyMyBbJHtsZXZlbFRleHR9XSBUZXN0IG1lc3NhZ2VgKTtcblx0XHRcdGNvbnN0IGVudHJ5ID0gcGFyc2VMb2dFbnRyeUF0KG1vZGVsLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbnRyeT8ubG9nTGV2ZWwsIGV4cGVjdGVkTGV2ZWwsIGBGYWlsZWQgZm9yIGxvZyBsZXZlbDogJHtsZXZlbFRleHR9YCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdzaG91bGQgcGFyc2UgdGltZXN0YW1wIGNvcnJlY3RseScsICgpID0+IHtcblx0XHRjb25zdCB0aW1lc3RhbXBzID0gW1xuXHRcdFx0JzIwMjMtMDEtMDEgMDA6MDA6MDAuMDAwJyxcblx0XHRcdCcyMDIzLTEyLTMxIDIzOjU5OjU5Ljk5OScsXG5cdFx0XHQnMjAyMy0wNi0xNSAxMjozMDo0NS41MDAnXG5cdFx0XTtcblxuXHRcdGZvciAoY29uc3QgdGltZXN0YW1wIG9mIHRpbWVzdGFtcHMpIHtcblx0XHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlTW9kZWwoYCR7dGltZXN0YW1wfSBbaW5mb10gVGVzdCBtZXNzYWdlYCk7XG5cdFx0XHRjb25zdCBlbnRyeSA9IHBhcnNlTG9nRW50cnlBdChtb2RlbCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW50cnk/LnRpbWVzdGFtcCwgbmV3IERhdGUodGltZXN0YW1wKS5nZXRUaW1lKCksIGBGYWlsZWQgZm9yIHRpbWVzdGFtcDogJHt0aW1lc3RhbXB9YCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdzaG91bGQgaGFuZGxlIGxhc3QgbGluZSBvZiBmaWxlJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlTW9kZWwoW1xuXHRcdFx0JzIwMjMtMTAtMTUgMTQ6MzA6NDUuMTIzIFtpbmZvXSBGaXJzdCBtZXNzYWdlJyxcblx0XHRcdCcyMDIzLTEwLTE1IDE0OjMwOjQ1LjEyNCBbaW5mb10gTGFzdCBtZXNzYWdlJyxcblx0XHRcdCcnXG5cdFx0XS5qb2luKCdcXG4nKSk7XG5cblx0XHRsZXQgYWN0dWFsID0gcGFyc2VMb2dFbnRyeUF0KG1vZGVsLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsPy50aW1lc3RhbXAsIG5ldyBEYXRlKCcyMDIzLTEwLTE1IDE0OjMwOjQ1LjEyMycpLmdldFRpbWUoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbD8ubG9nTGV2ZWwsIExvZ0xldmVsLkluZm8pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWw/LmNhdGVnb3J5LCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZUluUmFuZ2UoYWN0dWFsPy5yYW5nZSksICcyMDIzLTEwLTE1IDE0OjMwOjQ1LjEyMyBbaW5mb10gRmlyc3QgbWVzc2FnZScpO1xuXG5cdFx0YWN0dWFsID0gcGFyc2VMb2dFbnRyeUF0KG1vZGVsLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsPy50aW1lc3RhbXAsIG5ldyBEYXRlKCcyMDIzLTEwLTE1IDE0OjMwOjQ1LjEyNCcpLmdldFRpbWUoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbD8ubG9nTGV2ZWwsIExvZ0xldmVsLkluZm8pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWw/LmNhdGVnb3J5LCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZUluUmFuZ2UoYWN0dWFsPy5yYW5nZSksICcyMDIzLTEwLTE1IDE0OjMwOjQ1LjEyNCBbaW5mb10gTGFzdCBtZXNzYWdlJyk7XG5cblx0XHRhY3R1YWwgPSBwYXJzZUxvZ0VudHJ5QXQobW9kZWwsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIG51bGwpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaG91bGQgcGFyc2UgbXVsdGktbGluZSBsb2cgZW50cnkgd2l0aCBlbXB0eSBsaW5lcycsICgpID0+IHtcblx0XHRjb25zdCB0ZXh0ID0gW1xuXHRcdFx0JzIwMjUtMDEtMjcgMDk6NTM6MDAuNDUwIFtpbmZvXSBGb3VuZCB3aXRoIHZlcnNpb24gPDIwLjE4LjE+Jyxcblx0XHRcdCdOb3cgdXNpbmcgbm9kZSB2MjAuMTguMSAobnBtIHYxMC44LjIpJyxcblx0XHRcdCcnLFxuXHRcdFx0Jz4gaHVza3kgLSBucG0gcnVuIC1zIHByZWNvbW1pdCcsXG5cdFx0XHQnPiBodXNreSAtIG5vZGUgdjIwLjE4LjEnLFxuXHRcdFx0JycsXG5cdFx0XHQnUmVhZGluZyBnaXQgaW5kZXggdmVyc2lvbnMuLi4nXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZU1vZGVsKHRleHQpO1xuXHRcdGNvbnN0IGVudHJ5ID0gcGFyc2VMb2dFbnRyeUF0KG1vZGVsLCAxKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbnRyeT8udGltZXN0YW1wLCBuZXcgRGF0ZSgnMjAyNS0wMS0yNyAwOTo1MzowMC40NTAnKS5nZXRUaW1lKCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbnRyeT8ubG9nTGV2ZWwsIExvZ0xldmVsLkluZm8pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbnRyeT8uY2F0ZWdvcnksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlSW5SYW5nZShlbnRyeT8ucmFuZ2UpLCB0ZXh0KTtcblxuXHR9KTtcblxuXHRmdW5jdGlvbiBjcmVhdGVNb2RlbChjb250ZW50OiBzdHJpbmcpOiBUZXh0TW9kZWwge1xuXHRcdHJldHVybiBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dE1vZGVsLCBjb250ZW50LCAnbG9nJywgVGV4dE1vZGVsLkRFRkFVTFRfQ1JFQVRJT05fT1BUSU9OUywgbnVsbCkpO1xuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksWUFBWTtBQUN4QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLCtDQUErQztBQUN4RCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHFDQUFxQztBQUc5QyxNQUFNLGdCQUFnQixNQUFNO0FBRTNCLFFBQU0sY0FBYyx3Q0FBd0M7QUFFNUQsTUFBSTtBQUVKLFFBQU0sTUFBTTtBQUNYLDJCQUF1QixZQUFZLElBQUksOEJBQThCLENBQUMsR0FBRyxXQUFXLENBQUM7QUFBQSxFQUN0RixDQUFDO0FBRUQsT0FBSyw4Q0FBOEMsTUFBTTtBQUN4RCxVQUFNLE9BQU87QUFDYixVQUFNLFFBQVEsWUFBWSxJQUFJO0FBQzlCLFVBQU0sUUFBUSxnQkFBZ0IsT0FBTyxDQUFDO0FBRXRDLFdBQU8sWUFBWSxPQUFPLFlBQVcsb0JBQUksS0FBSyx5QkFBeUIsR0FBRSxRQUFRLENBQUM7QUFDbEYsV0FBTyxZQUFZLE9BQU8sVUFBVSxTQUFTLElBQUk7QUFDakQsV0FBTyxZQUFZLE9BQU8sVUFBVSxLQUFLO0FBQ3pDLFdBQU8sWUFBWSxNQUFNLGdCQUFnQixPQUFPLEtBQUssR0FBRyxJQUFJO0FBQUEsRUFDN0QsQ0FBQztBQUVELE9BQUsscUNBQXFDLE1BQU07QUFDL0MsVUFBTSxPQUFPO0FBQUEsTUFDWjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxFQUFFLEtBQUssSUFBSTtBQUNYLFVBQU0sUUFBUSxZQUFZLElBQUk7QUFDOUIsVUFBTSxRQUFRLGdCQUFnQixPQUFPLENBQUM7QUFFdEMsV0FBTyxZQUFZLE9BQU8sWUFBVyxvQkFBSSxLQUFLLHlCQUF5QixHQUFFLFFBQVEsQ0FBQztBQUNsRixXQUFPLFlBQVksT0FBTyxVQUFVLFNBQVMsS0FBSztBQUNsRCxXQUFPLFlBQVksT0FBTyxVQUFVLFdBQVc7QUFDL0MsV0FBTyxZQUFZLE1BQU0sZ0JBQWdCLE9BQU8sS0FBSyxHQUFHLElBQUk7QUFBQSxFQUM3RCxDQUFDO0FBRUQsT0FBSywyQ0FBMkMsTUFBTTtBQUNyRCxVQUFNLE9BQU87QUFDYixVQUFNLFFBQVEsWUFBWSxJQUFJO0FBQzlCLFVBQU0sUUFBUSxnQkFBZ0IsT0FBTyxDQUFDO0FBRXRDLFdBQU8sWUFBWSxPQUFPLFlBQVcsb0JBQUksS0FBSyx5QkFBeUIsR0FBRSxRQUFRLENBQUM7QUFDbEYsV0FBTyxZQUFZLE9BQU8sVUFBVSxTQUFTLE9BQU87QUFDcEQsV0FBTyxZQUFZLE9BQU8sVUFBVSxNQUFTO0FBQzdDLFdBQU8sWUFBWSxNQUFNLGdCQUFnQixPQUFPLEtBQUssR0FBRyxJQUFJO0FBQUEsRUFDN0QsQ0FBQztBQUVELE9BQUssNENBQTRDLE1BQU07QUFDdEQsVUFBTSxRQUFRLFlBQVksdUJBQXVCO0FBQ2pELFVBQU0sUUFBUSxnQkFBZ0IsT0FBTyxDQUFDO0FBRXRDLFdBQU8sWUFBWSxPQUFPLElBQUk7QUFBQSxFQUMvQixDQUFDO0FBRUQsT0FBSyx5Q0FBeUMsTUFBTTtBQUNuRCxVQUFNLFNBQVM7QUFBQSxNQUNkLE1BQU0sU0FBUztBQUFBLE1BQ2YsT0FBTyxTQUFTO0FBQUEsTUFDaEIsT0FBTyxTQUFTO0FBQUEsTUFDaEIsU0FBUyxTQUFTO0FBQUEsTUFDbEIsT0FBTyxTQUFTO0FBQUEsSUFDakI7QUFFQSxlQUFXLENBQUMsV0FBVyxhQUFhLEtBQUssT0FBTyxRQUFRLE1BQU0sR0FBRztBQUNoRSxZQUFNLFFBQVEsWUFBWSw0QkFBNEIsU0FBUyxnQkFBZ0I7QUFDL0UsWUFBTSxRQUFRLGdCQUFnQixPQUFPLENBQUM7QUFDdEMsYUFBTyxZQUFZLE9BQU8sVUFBVSxlQUFlLHlCQUF5QixTQUFTLEVBQUU7QUFBQSxJQUN4RjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssb0NBQW9DLE1BQU07QUFDOUMsVUFBTSxhQUFhO0FBQUEsTUFDbEI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFFQSxlQUFXLGFBQWEsWUFBWTtBQUNuQyxZQUFNLFFBQVEsWUFBWSxHQUFHLFNBQVMsc0JBQXNCO0FBQzVELFlBQU0sUUFBUSxnQkFBZ0IsT0FBTyxDQUFDO0FBQ3RDLGFBQU8sWUFBWSxPQUFPLFdBQVcsSUFBSSxLQUFLLFNBQVMsRUFBRSxRQUFRLEdBQUcseUJBQXlCLFNBQVMsRUFBRTtBQUFBLElBQ3pHO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxtQ0FBbUMsTUFBTTtBQUM3QyxVQUFNLFFBQVEsWUFBWTtBQUFBLE1BQ3pCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELEVBQUUsS0FBSyxJQUFJLENBQUM7QUFFWixRQUFJLFNBQVMsZ0JBQWdCLE9BQU8sQ0FBQztBQUNyQyxXQUFPLFlBQVksUUFBUSxZQUFXLG9CQUFJLEtBQUsseUJBQXlCLEdBQUUsUUFBUSxDQUFDO0FBQ25GLFdBQU8sWUFBWSxRQUFRLFVBQVUsU0FBUyxJQUFJO0FBQ2xELFdBQU8sWUFBWSxRQUFRLFVBQVUsTUFBUztBQUM5QyxXQUFPLFlBQVksTUFBTSxnQkFBZ0IsUUFBUSxLQUFLLEdBQUcsOENBQThDO0FBRXZHLGFBQVMsZ0JBQWdCLE9BQU8sQ0FBQztBQUNqQyxXQUFPLFlBQVksUUFBUSxZQUFXLG9CQUFJLEtBQUsseUJBQXlCLEdBQUUsUUFBUSxDQUFDO0FBQ25GLFdBQU8sWUFBWSxRQUFRLFVBQVUsU0FBUyxJQUFJO0FBQ2xELFdBQU8sWUFBWSxRQUFRLFVBQVUsTUFBUztBQUM5QyxXQUFPLFlBQVksTUFBTSxnQkFBZ0IsUUFBUSxLQUFLLEdBQUcsNkNBQTZDO0FBRXRHLGFBQVMsZ0JBQWdCLE9BQU8sQ0FBQztBQUNqQyxXQUFPLFlBQVksUUFBUSxJQUFJO0FBQUEsRUFDaEMsQ0FBQztBQUVELE9BQUssc0RBQXNELE1BQU07QUFDaEUsVUFBTSxPQUFPO0FBQUEsTUFDWjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsRUFBRSxLQUFLLElBQUk7QUFDWCxVQUFNLFFBQVEsWUFBWSxJQUFJO0FBQzlCLFVBQU0sUUFBUSxnQkFBZ0IsT0FBTyxDQUFDO0FBRXRDLFdBQU8sWUFBWSxPQUFPLFlBQVcsb0JBQUksS0FBSyx5QkFBeUIsR0FBRSxRQUFRLENBQUM7QUFDbEYsV0FBTyxZQUFZLE9BQU8sVUFBVSxTQUFTLElBQUk7QUFDakQsV0FBTyxZQUFZLE9BQU8sVUFBVSxNQUFTO0FBQzdDLFdBQU8sWUFBWSxNQUFNLGdCQUFnQixPQUFPLEtBQUssR0FBRyxJQUFJO0FBQUEsRUFFN0QsQ0FBQztBQUVELFdBQVMsWUFBWSxTQUE0QjtBQUNoRCxXQUFPLFlBQVksSUFBSSxxQkFBcUIsZUFBZSxXQUFXLFNBQVMsT0FBTyxVQUFVLDBCQUEwQixJQUFJLENBQUM7QUFBQSxFQUNoSTtBQUNELENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
