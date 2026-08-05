import assert from "assert";
import { isWindows } from "../../../../../base/common/platform.js";
import { URI as uri } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { NullLogService } from "../../../../../platform/log/common/log.js";
import { Source } from "../../common/debugSource.js";
import { mockUriIdentityService } from "./mockDebugModel.js";
suite("Debug - Source", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("from raw source", () => {
    const source = new Source({
      name: "zz",
      path: "/xx/yy/zz",
      sourceReference: 0,
      presentationHint: "emphasize"
    }, "aDebugSessionId", mockUriIdentityService, new NullLogService());
    assert.strictEqual(source.presentationHint, "emphasize");
    assert.strictEqual(source.name, "zz");
    assert.strictEqual(source.inMemory, false);
    assert.strictEqual(source.reference, 0);
    assert.strictEqual(source.uri.toString(), uri.file("/xx/yy/zz").toString());
  });
  test("from raw internal source", () => {
    const source = new Source({
      name: "internalModule.js",
      sourceReference: 11,
      presentationHint: "deemphasize"
    }, "aDebugSessionId", mockUriIdentityService, new NullLogService());
    assert.strictEqual(source.presentationHint, "deemphasize");
    assert.strictEqual(source.name, "internalModule.js");
    assert.strictEqual(source.inMemory, true);
    assert.strictEqual(source.reference, 11);
    assert.strictEqual(source.uri.toString(), "debug:internalModule.js?session%3DaDebugSessionId%26ref%3D11");
  });
  test("get encoded debug data", () => {
    const checkData = (uri2, expectedName, expectedPath, expectedSourceReference, expectedSessionId) => {
      const { name, path, sourceReference, sessionId } = Source.getEncodedDebugData(uri2);
      assert.strictEqual(name, expectedName);
      assert.strictEqual(path, expectedPath);
      assert.strictEqual(sourceReference, expectedSourceReference);
      assert.strictEqual(sessionId, expectedSessionId);
    };
    checkData(uri.file("a/b/c/d"), "d", isWindows ? "\\a\\b\\c\\d" : "/a/b/c/d", void 0, void 0);
    checkData(uri.from({ scheme: "file", path: "/my/path/test.js", query: "ref=1&session=2" }), "test.js", isWindows ? "\\my\\path\\test.js" : "/my/path/test.js", void 0, void 0);
    checkData(uri.from({ scheme: "http", authority: "www.example.com", path: "/my/path" }), "path", "http://www.example.com/my/path", void 0, void 0);
    checkData(uri.from({ scheme: "debug", authority: "www.example.com", path: "/my/path", query: "ref=100" }), "path", "/my/path", 100, void 0);
    checkData(uri.from({ scheme: "debug", path: "a/b/c/d.js", query: "session=100" }), "d.js", "a/b/c/d.js", void 0, "100");
    checkData(uri.from({ scheme: "debug", path: "a/b/c/d/foo.txt", query: "session=100&ref=10" }), "foo.txt", "a/b/c/d/foo.txt", 10, "100");
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy90ZXN0L2Jyb3dzZXIvZGVidWdTb3VyY2UudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFVSSSBhcyB1cmkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IFNvdXJjZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9kZWJ1Z1NvdXJjZS5qcyc7XG5pbXBvcnQgeyBtb2NrVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi9tb2NrRGVidWdNb2RlbC5qcyc7XG5cbnN1aXRlKCdEZWJ1ZyAtIFNvdXJjZScsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdmcm9tIHJhdyBzb3VyY2UnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgc291cmNlID0gbmV3IFNvdXJjZSh7XG5cdFx0XHRuYW1lOiAnenonLFxuXHRcdFx0cGF0aDogJy94eC95eS96eicsXG5cdFx0XHRzb3VyY2VSZWZlcmVuY2U6IDAsXG5cdFx0XHRwcmVzZW50YXRpb25IaW50OiAnZW1waGFzaXplJ1xuXHRcdH0sICdhRGVidWdTZXNzaW9uSWQnLCBtb2NrVXJpSWRlbnRpdHlTZXJ2aWNlLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc291cmNlLnByZXNlbnRhdGlvbkhpbnQsICdlbXBoYXNpemUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc291cmNlLm5hbWUsICd6eicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzb3VyY2UuaW5NZW1vcnksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc291cmNlLnJlZmVyZW5jZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNvdXJjZS51cmkudG9TdHJpbmcoKSwgdXJpLmZpbGUoJy94eC95eS96eicpLnRvU3RyaW5nKCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdmcm9tIHJhdyBpbnRlcm5hbCBzb3VyY2UnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgc291cmNlID0gbmV3IFNvdXJjZSh7XG5cdFx0XHRuYW1lOiAnaW50ZXJuYWxNb2R1bGUuanMnLFxuXHRcdFx0c291cmNlUmVmZXJlbmNlOiAxMSxcblx0XHRcdHByZXNlbnRhdGlvbkhpbnQ6ICdkZWVtcGhhc2l6ZSdcblx0XHR9LCAnYURlYnVnU2Vzc2lvbklkJywgbW9ja1VyaUlkZW50aXR5U2VydmljZSwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNvdXJjZS5wcmVzZW50YXRpb25IaW50LCAnZGVlbXBoYXNpemUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc291cmNlLm5hbWUsICdpbnRlcm5hbE1vZHVsZS5qcycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzb3VyY2UuaW5NZW1vcnksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzb3VyY2UucmVmZXJlbmNlLCAxMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNvdXJjZS51cmkudG9TdHJpbmcoKSwgJ2RlYnVnOmludGVybmFsTW9kdWxlLmpzP3Nlc3Npb24lM0RhRGVidWdTZXNzaW9uSWQlMjZyZWYlM0QxMScpO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXQgZW5jb2RlZCBkZWJ1ZyBkYXRhJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNoZWNrRGF0YSA9ICh1cmk6IHVyaSwgZXhwZWN0ZWROYW1lOiBzdHJpbmcsIGV4cGVjdGVkUGF0aDogc3RyaW5nLCBleHBlY3RlZFNvdXJjZVJlZmVyZW5jZTogbnVtYmVyIHwgdW5kZWZpbmVkLCBleHBlY3RlZFNlc3Npb25JZD86IHN0cmluZykgPT4ge1xuXHRcdFx0Y29uc3QgeyBuYW1lLCBwYXRoLCBzb3VyY2VSZWZlcmVuY2UsIHNlc3Npb25JZCB9ID0gU291cmNlLmdldEVuY29kZWREZWJ1Z0RhdGEodXJpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChuYW1lLCBleHBlY3RlZE5hbWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhdGgsIGV4cGVjdGVkUGF0aCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc291cmNlUmVmZXJlbmNlLCBleHBlY3RlZFNvdXJjZVJlZmVyZW5jZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbklkLCBleHBlY3RlZFNlc3Npb25JZCk7XG5cdFx0fTtcblxuXHRcdGNoZWNrRGF0YSh1cmkuZmlsZSgnYS9iL2MvZCcpLCAnZCcsIGlzV2luZG93cyA/ICdcXFxcYVxcXFxiXFxcXGNcXFxcZCcgOiAnL2EvYi9jL2QnLCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdFx0Y2hlY2tEYXRhKHVyaS5mcm9tKHsgc2NoZW1lOiAnZmlsZScsIHBhdGg6ICcvbXkvcGF0aC90ZXN0LmpzJywgcXVlcnk6ICdyZWY9MSZzZXNzaW9uPTInIH0pLCAndGVzdC5qcycsIGlzV2luZG93cyA/ICdcXFxcbXlcXFxccGF0aFxcXFx0ZXN0LmpzJyA6ICcvbXkvcGF0aC90ZXN0LmpzJywgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXG5cdFx0Y2hlY2tEYXRhKHVyaS5mcm9tKHsgc2NoZW1lOiAnaHR0cCcsIGF1dGhvcml0eTogJ3d3dy5leGFtcGxlLmNvbScsIHBhdGg6ICcvbXkvcGF0aCcgfSksICdwYXRoJywgJ2h0dHA6Ly93d3cuZXhhbXBsZS5jb20vbXkvcGF0aCcsIHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0XHRjaGVja0RhdGEodXJpLmZyb20oeyBzY2hlbWU6ICdkZWJ1ZycsIGF1dGhvcml0eTogJ3d3dy5leGFtcGxlLmNvbScsIHBhdGg6ICcvbXkvcGF0aCcsIHF1ZXJ5OiAncmVmPTEwMCcgfSksICdwYXRoJywgJy9teS9wYXRoJywgMTAwLCB1bmRlZmluZWQpO1xuXHRcdGNoZWNrRGF0YSh1cmkuZnJvbSh7IHNjaGVtZTogJ2RlYnVnJywgcGF0aDogJ2EvYi9jL2QuanMnLCBxdWVyeTogJ3Nlc3Npb249MTAwJyB9KSwgJ2QuanMnLCAnYS9iL2MvZC5qcycsIHVuZGVmaW5lZCwgJzEwMCcpO1xuXHRcdGNoZWNrRGF0YSh1cmkuZnJvbSh7IHNjaGVtZTogJ2RlYnVnJywgcGF0aDogJ2EvYi9jL2QvZm9vLnR4dCcsIHF1ZXJ5OiAnc2Vzc2lvbj0xMDAmcmVmPTEwJyB9KSwgJ2Zvby50eHQnLCAnYS9iL2MvZC9mb28udHh0JywgMTAsICcxMDAnKTtc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
