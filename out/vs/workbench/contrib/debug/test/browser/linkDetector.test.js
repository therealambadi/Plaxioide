import assert from "assert";
import { isHTMLAnchorElement } from "../../../../../base/browser/dom.js";
import { isWindows } from "../../../../../base/common/platform.js";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { ITunnelService } from "../../../../../platform/tunnel/common/tunnel.js";
import { WorkspaceFolder } from "../../../../../platform/workspace/common/workspace.js";
import { LinkDetector } from "../../browser/linkDetector.js";
import { workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
suite("Debug - Link Detector", () => {
  const disposables = ensureNoDisposablesAreLeakedInTestSuite();
  let linkDetector;
  setup(() => {
    const instantiationService = workbenchInstantiationService(void 0, disposables);
    instantiationService.stub(ITunnelService, { canTunnel: () => false });
    linkDetector = instantiationService.createInstance(LinkDetector);
  });
  function assertElementIsLink(element) {
    assert(isHTMLAnchorElement(element));
  }
  test("noLinks", () => {
    const input = "I am a string";
    const expectedOutput = "<span>I am a string</span>";
    const output = linkDetector.linkify(input);
    assert.strictEqual(0, output.children.length);
    assert.strictEqual("SPAN", output.tagName);
    assert.strictEqual(expectedOutput, output.outerHTML);
  });
  test("trailingNewline", () => {
    const input = "I am a string\n";
    const expectedOutput = "<span>I am a string\n</span>";
    const output = linkDetector.linkify(input);
    assert.strictEqual(0, output.children.length);
    assert.strictEqual("SPAN", output.tagName);
    assert.strictEqual(expectedOutput, output.outerHTML);
  });
  test("trailingNewlineSplit", () => {
    const input = "I am a string\n";
    const expectedOutput = "<span>I am a string\n</span>";
    const output = linkDetector.linkify(input, true);
    assert.strictEqual(0, output.children.length);
    assert.strictEqual("SPAN", output.tagName);
    assert.strictEqual(expectedOutput, output.outerHTML);
  });
  test("singleLineLink", () => {
    const input = isWindows ? "C:\\foo\\bar.js:12:34" : "/Users/foo/bar.js:12:34";
    const expectedOutput = isWindows ? '<span><a tabindex="0">C:\\foo\\bar.js:12:34</a></span>' : '<span><a tabindex="0">/Users/foo/bar.js:12:34</a></span>';
    const output = linkDetector.linkify(input);
    assert.strictEqual(1, output.children.length);
    assert.strictEqual("SPAN", output.tagName);
    assert.strictEqual("A", output.firstElementChild.tagName);
    assert.strictEqual(expectedOutput, output.outerHTML);
    assertElementIsLink(output.firstElementChild);
    assert.strictEqual(isWindows ? "C:\\foo\\bar.js:12:34" : "/Users/foo/bar.js:12:34", output.firstElementChild.textContent);
  });
  test("relativeLink", () => {
    const input = "./foo/bar.js";
    const expectedOutput = "<span>./foo/bar.js</span>";
    const output = linkDetector.linkify(input);
    assert.strictEqual(0, output.children.length);
    assert.strictEqual("SPAN", output.tagName);
    assert.strictEqual(expectedOutput, output.outerHTML);
  });
  test("relativeLinkWithWorkspace", async () => {
    const input = "./foo/bar.js";
    const output = linkDetector.linkify(input, false, new WorkspaceFolder({ uri: URI.file("/path/to/workspace"), name: "ws", index: 0 }));
    assert.strictEqual("SPAN", output.tagName);
    assert.ok(output.outerHTML.indexOf("link") >= 0);
  });
  test("singleLineLinkAndText", function() {
    const input = isWindows ? "The link: C:/foo/bar.js:12:34" : "The link: /Users/foo/bar.js:12:34";
    const expectedOutput = /^<span>The link: <a tabindex="0">.*\/foo\/bar.js:12:34<\/a><\/span>$/;
    const output = linkDetector.linkify(input);
    assert.strictEqual(1, output.children.length);
    assert.strictEqual("SPAN", output.tagName);
    assert.strictEqual("A", output.children[0].tagName);
    assert(expectedOutput.test(output.outerHTML));
    assertElementIsLink(output.children[0]);
    assert.strictEqual(isWindows ? "C:/foo/bar.js:12:34" : "/Users/foo/bar.js:12:34", output.children[0].textContent);
  });
  test("singleLineMultipleLinks", () => {
    const input = isWindows ? "Here is a link C:/foo/bar.js:12:34 and here is another D:/boo/far.js:56:78" : "Here is a link /Users/foo/bar.js:12:34 and here is another /Users/boo/far.js:56:78";
    const expectedOutput = /^<span>Here is a link <a tabindex="0">.*\/foo\/bar.js:12:34<\/a> and here is another <a tabindex="0">.*\/boo\/far.js:56:78<\/a><\/span>$/;
    const output = linkDetector.linkify(input);
    assert.strictEqual(2, output.children.length);
    assert.strictEqual("SPAN", output.tagName);
    assert.strictEqual("A", output.children[0].tagName);
    assert.strictEqual("A", output.children[1].tagName);
    assert(expectedOutput.test(output.outerHTML));
    assertElementIsLink(output.children[0]);
    assertElementIsLink(output.children[1]);
    assert.strictEqual(isWindows ? "C:/foo/bar.js:12:34" : "/Users/foo/bar.js:12:34", output.children[0].textContent);
    assert.strictEqual(isWindows ? "D:/boo/far.js:56:78" : "/Users/boo/far.js:56:78", output.children[1].textContent);
  });
  test("multilineNoLinks", () => {
    const input = "Line one\nLine two\nLine three";
    const expectedOutput = /^<span><span>Line one\n<\/span><span>Line two\n<\/span><span>Line three<\/span><\/span>$/;
    const output = linkDetector.linkify(input, true);
    assert.strictEqual(3, output.children.length);
    assert.strictEqual("SPAN", output.tagName);
    assert.strictEqual("SPAN", output.children[0].tagName);
    assert.strictEqual("SPAN", output.children[1].tagName);
    assert.strictEqual("SPAN", output.children[2].tagName);
    assert(expectedOutput.test(output.outerHTML));
  });
  test("multilineTrailingNewline", () => {
    const input = "I am a string\nAnd I am another\n";
    const expectedOutput = "<span><span>I am a string\n</span><span>And I am another\n</span></span>";
    const output = linkDetector.linkify(input, true);
    assert.strictEqual(2, output.children.length);
    assert.strictEqual("SPAN", output.tagName);
    assert.strictEqual("SPAN", output.children[0].tagName);
    assert.strictEqual("SPAN", output.children[1].tagName);
    assert.strictEqual(expectedOutput, output.outerHTML);
  });
  test("multilineWithLinks", () => {
    const input = isWindows ? "I have a link for you\nHere it is: C:/foo/bar.js:12:34\nCool, huh?" : "I have a link for you\nHere it is: /Users/foo/bar.js:12:34\nCool, huh?";
    const expectedOutput = /^<span><span>I have a link for you\n<\/span><span>Here it is: <a tabindex="0">.*\/foo\/bar.js:12:34<\/a>\n<\/span><span>Cool, huh\?<\/span><\/span>$/;
    const output = linkDetector.linkify(input, true);
    assert.strictEqual(3, output.children.length);
    assert.strictEqual("SPAN", output.tagName);
    assert.strictEqual("SPAN", output.children[0].tagName);
    assert.strictEqual("SPAN", output.children[1].tagName);
    assert.strictEqual("SPAN", output.children[2].tagName);
    assert.strictEqual("A", output.children[1].children[0].tagName);
    assert(expectedOutput.test(output.outerHTML));
    assertElementIsLink(output.children[1].children[0]);
    assert.strictEqual(isWindows ? "C:/foo/bar.js:12:34" : "/Users/foo/bar.js:12:34", output.children[1].children[0].textContent);
  });
  test("highlightNoLinks", () => {
    const input = "I am a string";
    const highlights = [{ start: 2, end: 5 }];
    const expectedOutput = '<span>I <span class="highlight">am </span>a string</span>';
    const output = linkDetector.linkify(input, false, void 0, false, void 0, highlights);
    assert.strictEqual(1, output.children.length);
    assert.strictEqual("SPAN", output.tagName);
    assert.strictEqual(expectedOutput, output.outerHTML);
  });
  test("highlightWithLink", () => {
    const input = isWindows ? "C:\\foo\\bar.js:12:34" : "/Users/foo/bar.js:12:34";
    const highlights = [{ start: 0, end: 5 }];
    const expectedOutput = isWindows ? '<span><a tabindex="0"><span class="highlight">C:\\fo</span>o\\bar.js:12:34</a></span>' : '<span><a tabindex="0"><span class="highlight">/User</span>s/foo/bar.js:12:34</a></span>';
    const output = linkDetector.linkify(input, false, void 0, false, void 0, highlights);
    assert.strictEqual(1, output.children.length);
    assert.strictEqual("SPAN", output.tagName);
    assert.strictEqual("A", output.firstElementChild.tagName);
    assert.strictEqual(expectedOutput, output.outerHTML);
    assertElementIsLink(output.firstElementChild);
  });
  test("highlightOverlappingLinkStart", () => {
    const input = isWindows ? "C:\\foo\\bar.js:12:34" : "/Users/foo/bar.js:12:34";
    const highlights = [{ start: 0, end: 10 }];
    const expectedOutput = isWindows ? '<span><a tabindex="0"><span class="highlight">C:\\foo\\bar</span>.js:12:34</a></span>' : '<span><a tabindex="0"><span class="highlight">/Users/foo</span>/bar.js:12:34</a></span>';
    const output = linkDetector.linkify(input, false, void 0, false, void 0, highlights);
    assert.strictEqual(1, output.children.length);
    assert.strictEqual("SPAN", output.tagName);
    assert.strictEqual("A", output.firstElementChild.tagName);
    assert.strictEqual(expectedOutput, output.outerHTML);
    assertElementIsLink(output.firstElementChild);
  });
  test("highlightOverlappingLinkEnd", () => {
    const input = isWindows ? "C:\\foo\\bar.js:12:34" : "/Users/foo/bar.js:12:34";
    const highlights = [{ start: 10, end: 20 }];
    const expectedOutput = isWindows ? '<span><a tabindex="0">C:\\foo\\bar<span class="highlight">.js:12:34</span></a></span>' : '<span><a tabindex="0">/Users/foo<span class="highlight">/bar.js:12</span>:34</a></span>';
    const output = linkDetector.linkify(input, false, void 0, false, void 0, highlights);
    assert.strictEqual(1, output.children.length);
    assert.strictEqual("SPAN", output.tagName);
    assert.strictEqual("A", output.firstElementChild.tagName);
    assert.strictEqual(expectedOutput, output.outerHTML);
    assertElementIsLink(output.firstElementChild);
  });
  test("highlightOverlappingLinkStartAndEnd", () => {
    const input = isWindows ? "C:\\foo\\bar.js:12:34" : "/Users/foo/bar.js:12:34";
    const highlights = [{ start: 5, end: 15 }];
    const expectedOutput = isWindows ? '<span><a tabindex="0">C:\\fo<span class="highlight">o\\bar.js:1</span>2:34</a></span>' : '<span><a tabindex="0">/User<span class="highlight">s/foo/bar.</span>js:12:34</a></span>';
    const output = linkDetector.linkify(input, false, void 0, false, void 0, highlights);
    assert.strictEqual(1, output.children.length);
    assert.strictEqual("SPAN", output.tagName);
    assert.strictEqual("A", output.firstElementChild.tagName);
    assert.strictEqual(expectedOutput, output.outerHTML);
    assertElementIsLink(output.firstElementChild);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy90ZXN0L2Jyb3dzZXIvbGlua0RldGVjdG9yLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBpc0hUTUxBbmNob3JFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBJVHVubmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3R1bm5lbC9jb21tb24vdHVubmVsLmpzJztcbmltcG9ydCB7IFdvcmtzcGFjZUZvbGRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IExpbmtEZXRlY3RvciB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvbGlua0RldGVjdG9yLmpzJztcbmltcG9ydCB7IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBJSGlnaGxpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hpZ2hsaWdodGVkbGFiZWwvaGlnaGxpZ2h0ZWRMYWJlbC5qcyc7XG5cbnN1aXRlKCdEZWJ1ZyAtIExpbmsgRGV0ZWN0b3InLCAoKSA9PiB7XG5cblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblx0bGV0IGxpbmtEZXRlY3RvcjogTGlua0RldGVjdG9yO1xuXG5cdC8qKlxuXHQgKiBJbnN0YW50aWF0ZSBhIHtAbGluayBMaW5rRGV0ZWN0b3J9IGZvciB1c2UgYnkgdGhlIGZ1bmN0aW9ucyBiZWluZyB0ZXN0ZWQuXG5cdCAqL1xuXHRzZXR1cCgoKSA9PiB7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSA9IDxUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U+d29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBkaXNwb3NhYmxlcyk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVHVubmVsU2VydmljZSwgeyBjYW5UdW5uZWw6ICgpID0+IGZhbHNlIH0pO1xuXHRcdGxpbmtEZXRlY3RvciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKExpbmtEZXRlY3Rvcik7XG5cdH0pO1xuXG5cdC8qKlxuXHQgKiBBc3NlcnQgdGhhdCBhIGdpdmVuIEVsZW1lbnQgaXMgYW4gYW5jaG9yIGVsZW1lbnQuXG5cdCAqXG5cdCAqIEBwYXJhbSBlbGVtZW50IFRoZSBFbGVtZW50IHRvIHZlcmlmeS5cblx0ICovXG5cdGZ1bmN0aW9uIGFzc2VydEVsZW1lbnRJc0xpbmsoZWxlbWVudDogRWxlbWVudCkge1xuXHRcdGFzc2VydChpc0hUTUxBbmNob3JFbGVtZW50KGVsZW1lbnQpKTtcblx0fVxuXG5cdHRlc3QoJ25vTGlua3MnLCAoKSA9PiB7XG5cdFx0Y29uc3QgaW5wdXQgPSAnSSBhbSBhIHN0cmluZyc7XG5cdFx0Y29uc3QgZXhwZWN0ZWRPdXRwdXQgPSAnPHNwYW4+SSBhbSBhIHN0cmluZzwvc3Bhbj4nO1xuXHRcdGNvbnN0IG91dHB1dCA9IGxpbmtEZXRlY3Rvci5saW5raWZ5KGlucHV0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgwLCBvdXRwdXQuY2hpbGRyZW4ubGVuZ3RoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoJ1NQQU4nLCBvdXRwdXQudGFnTmFtZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4cGVjdGVkT3V0cHV0LCBvdXRwdXQub3V0ZXJIVE1MKTtcblx0fSk7XG5cblx0dGVzdCgndHJhaWxpbmdOZXdsaW5lJywgKCkgPT4ge1xuXHRcdGNvbnN0IGlucHV0ID0gJ0kgYW0gYSBzdHJpbmdcXG4nO1xuXHRcdGNvbnN0IGV4cGVjdGVkT3V0cHV0ID0gJzxzcGFuPkkgYW0gYSBzdHJpbmdcXG48L3NwYW4+Jztcblx0XHRjb25zdCBvdXRwdXQgPSBsaW5rRGV0ZWN0b3IubGlua2lmeShpbnB1dCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMCwgb3V0cHV0LmNoaWxkcmVuLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCdTUEFOJywgb3V0cHV0LnRhZ05hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHBlY3RlZE91dHB1dCwgb3V0cHV0Lm91dGVySFRNTCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3RyYWlsaW5nTmV3bGluZVNwbGl0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGlucHV0ID0gJ0kgYW0gYSBzdHJpbmdcXG4nO1xuXHRcdGNvbnN0IGV4cGVjdGVkT3V0cHV0ID0gJzxzcGFuPkkgYW0gYSBzdHJpbmdcXG48L3NwYW4+Jztcblx0XHRjb25zdCBvdXRwdXQgPSBsaW5rRGV0ZWN0b3IubGlua2lmeShpbnB1dCwgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMCwgb3V0cHV0LmNoaWxkcmVuLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCdTUEFOJywgb3V0cHV0LnRhZ05hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHBlY3RlZE91dHB1dCwgb3V0cHV0Lm91dGVySFRNTCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NpbmdsZUxpbmVMaW5rJywgKCkgPT4ge1xuXHRcdGNvbnN0IGlucHV0ID0gaXNXaW5kb3dzID8gJ0M6XFxcXGZvb1xcXFxiYXIuanM6MTI6MzQnIDogJy9Vc2Vycy9mb28vYmFyLmpzOjEyOjM0Jztcblx0XHRjb25zdCBleHBlY3RlZE91dHB1dCA9IGlzV2luZG93cyA/ICc8c3Bhbj48YSB0YWJpbmRleD1cIjBcIj5DOlxcXFxmb29cXFxcYmFyLmpzOjEyOjM0PFxcL2E+PFxcL3NwYW4+JyA6ICc8c3Bhbj48YSB0YWJpbmRleD1cIjBcIj4vVXNlcnMvZm9vL2Jhci5qczoxMjozNDxcXC9hPjxcXC9zcGFuPic7XG5cdFx0Y29uc3Qgb3V0cHV0ID0gbGlua0RldGVjdG9yLmxpbmtpZnkoaW5wdXQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDEsIG91dHB1dC5jaGlsZHJlbi5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgnU1BBTicsIG91dHB1dC50YWdOYW1lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoJ0EnLCBvdXRwdXQuZmlyc3RFbGVtZW50Q2hpbGQhLnRhZ05hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHBlY3RlZE91dHB1dCwgb3V0cHV0Lm91dGVySFRNTCk7XG5cdFx0YXNzZXJ0RWxlbWVudElzTGluayhvdXRwdXQuZmlyc3RFbGVtZW50Q2hpbGQhKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNXaW5kb3dzID8gJ0M6XFxcXGZvb1xcXFxiYXIuanM6MTI6MzQnIDogJy9Vc2Vycy9mb28vYmFyLmpzOjEyOjM0Jywgb3V0cHV0LmZpcnN0RWxlbWVudENoaWxkIS50ZXh0Q29udGVudCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlbGF0aXZlTGluaycsICgpID0+IHtcblx0XHRjb25zdCBpbnB1dCA9ICdcXC4vZm9vL2Jhci5qcyc7XG5cdFx0Y29uc3QgZXhwZWN0ZWRPdXRwdXQgPSAnPHNwYW4+XFwuL2Zvby9iYXIuanM8L3NwYW4+Jztcblx0XHRjb25zdCBvdXRwdXQgPSBsaW5rRGV0ZWN0b3IubGlua2lmeShpbnB1dCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMCwgb3V0cHV0LmNoaWxkcmVuLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCdTUEFOJywgb3V0cHV0LnRhZ05hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHBlY3RlZE91dHB1dCwgb3V0cHV0Lm91dGVySFRNTCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlbGF0aXZlTGlua1dpdGhXb3Jrc3BhY2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaW5wdXQgPSAnXFwuL2Zvby9iYXIuanMnO1xuXHRcdGNvbnN0IG91dHB1dCA9IGxpbmtEZXRlY3Rvci5saW5raWZ5KGlucHV0LCBmYWxzZSwgbmV3IFdvcmtzcGFjZUZvbGRlcih7IHVyaTogVVJJLmZpbGUoJy9wYXRoL3RvL3dvcmtzcGFjZScpLCBuYW1lOiAnd3MnLCBpbmRleDogMCB9KSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCdTUEFOJywgb3V0cHV0LnRhZ05hbWUpO1xuXHRcdGFzc2VydC5vayhvdXRwdXQub3V0ZXJIVE1MLmluZGV4T2YoJ2xpbmsnKSA+PSAwKTtcblx0fSk7XG5cblx0dGVzdCgnc2luZ2xlTGluZUxpbmtBbmRUZXh0JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGlucHV0ID0gaXNXaW5kb3dzID8gJ1RoZSBsaW5rOiBDOi9mb28vYmFyLmpzOjEyOjM0JyA6ICdUaGUgbGluazogL1VzZXJzL2Zvby9iYXIuanM6MTI6MzQnO1xuXHRcdGNvbnN0IGV4cGVjdGVkT3V0cHV0ID0gL148c3Bhbj5UaGUgbGluazogPGEgdGFiaW5kZXg9XCIwXCI+LipcXC9mb29cXC9iYXIuanM6MTI6MzQ8XFwvYT48XFwvc3Bhbj4kLztcblx0XHRjb25zdCBvdXRwdXQgPSBsaW5rRGV0ZWN0b3IubGlua2lmeShpbnB1dCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMSwgb3V0cHV0LmNoaWxkcmVuLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCdTUEFOJywgb3V0cHV0LnRhZ05hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgnQScsIG91dHB1dC5jaGlsZHJlblswXS50YWdOYW1lKTtcblx0XHRhc3NlcnQoZXhwZWN0ZWRPdXRwdXQudGVzdChvdXRwdXQub3V0ZXJIVE1MKSk7XG5cdFx0YXNzZXJ0RWxlbWVudElzTGluayhvdXRwdXQuY2hpbGRyZW5bMF0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc1dpbmRvd3MgPyAnQzovZm9vL2Jhci5qczoxMjozNCcgOiAnL1VzZXJzL2Zvby9iYXIuanM6MTI6MzQnLCBvdXRwdXQuY2hpbGRyZW5bMF0udGV4dENvbnRlbnQpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaW5nbGVMaW5lTXVsdGlwbGVMaW5rcycsICgpID0+IHtcblx0XHRjb25zdCBpbnB1dCA9IGlzV2luZG93cyA/ICdIZXJlIGlzIGEgbGluayBDOi9mb28vYmFyLmpzOjEyOjM0IGFuZCBoZXJlIGlzIGFub3RoZXIgRDovYm9vL2Zhci5qczo1Njo3OCcgOlxuXHRcdFx0J0hlcmUgaXMgYSBsaW5rIC9Vc2Vycy9mb28vYmFyLmpzOjEyOjM0IGFuZCBoZXJlIGlzIGFub3RoZXIgL1VzZXJzL2Jvby9mYXIuanM6NTY6NzgnO1xuXHRcdGNvbnN0IGV4cGVjdGVkT3V0cHV0ID0gL148c3Bhbj5IZXJlIGlzIGEgbGluayA8YSB0YWJpbmRleD1cIjBcIj4uKlxcL2Zvb1xcL2Jhci5qczoxMjozNDxcXC9hPiBhbmQgaGVyZSBpcyBhbm90aGVyIDxhIHRhYmluZGV4PVwiMFwiPi4qXFwvYm9vXFwvZmFyLmpzOjU2Ojc4PFxcL2E+PFxcL3NwYW4+JC87XG5cdFx0Y29uc3Qgb3V0cHV0ID0gbGlua0RldGVjdG9yLmxpbmtpZnkoaW5wdXQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDIsIG91dHB1dC5jaGlsZHJlbi5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgnU1BBTicsIG91dHB1dC50YWdOYW1lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoJ0EnLCBvdXRwdXQuY2hpbGRyZW5bMF0udGFnTmFtZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCdBJywgb3V0cHV0LmNoaWxkcmVuWzFdLnRhZ05hbWUpO1xuXHRcdGFzc2VydChleHBlY3RlZE91dHB1dC50ZXN0KG91dHB1dC5vdXRlckhUTUwpKTtcblx0XHRhc3NlcnRFbGVtZW50SXNMaW5rKG91dHB1dC5jaGlsZHJlblswXSk7XG5cdFx0YXNzZXJ0RWxlbWVudElzTGluayhvdXRwdXQuY2hpbGRyZW5bMV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc1dpbmRvd3MgPyAnQzovZm9vL2Jhci5qczoxMjozNCcgOiAnL1VzZXJzL2Zvby9iYXIuanM6MTI6MzQnLCBvdXRwdXQuY2hpbGRyZW5bMF0udGV4dENvbnRlbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc1dpbmRvd3MgPyAnRDovYm9vL2Zhci5qczo1Njo3OCcgOiAnL1VzZXJzL2Jvby9mYXIuanM6NTY6NzgnLCBvdXRwdXQuY2hpbGRyZW5bMV0udGV4dENvbnRlbnQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtdWx0aWxpbmVOb0xpbmtzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGlucHV0ID0gJ0xpbmUgb25lXFxuTGluZSB0d29cXG5MaW5lIHRocmVlJztcblx0XHRjb25zdCBleHBlY3RlZE91dHB1dCA9IC9ePHNwYW4+PHNwYW4+TGluZSBvbmVcXG48XFwvc3Bhbj48c3Bhbj5MaW5lIHR3b1xcbjxcXC9zcGFuPjxzcGFuPkxpbmUgdGhyZWU8XFwvc3Bhbj48XFwvc3Bhbj4kLztcblx0XHRjb25zdCBvdXRwdXQgPSBsaW5rRGV0ZWN0b3IubGlua2lmeShpbnB1dCwgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMywgb3V0cHV0LmNoaWxkcmVuLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCdTUEFOJywgb3V0cHV0LnRhZ05hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgnU1BBTicsIG91dHB1dC5jaGlsZHJlblswXS50YWdOYW1lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoJ1NQQU4nLCBvdXRwdXQuY2hpbGRyZW5bMV0udGFnTmFtZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCdTUEFOJywgb3V0cHV0LmNoaWxkcmVuWzJdLnRhZ05hbWUpO1xuXHRcdGFzc2VydChleHBlY3RlZE91dHB1dC50ZXN0KG91dHB1dC5vdXRlckhUTUwpKTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGlsaW5lVHJhaWxpbmdOZXdsaW5lJywgKCkgPT4ge1xuXHRcdGNvbnN0IGlucHV0ID0gJ0kgYW0gYSBzdHJpbmdcXG5BbmQgSSBhbSBhbm90aGVyXFxuJztcblx0XHRjb25zdCBleHBlY3RlZE91dHB1dCA9ICc8c3Bhbj48c3Bhbj5JIGFtIGEgc3RyaW5nXFxuPFxcL3NwYW4+PHNwYW4+QW5kIEkgYW0gYW5vdGhlclxcbjxcXC9zcGFuPjxcXC9zcGFuPic7XG5cdFx0Y29uc3Qgb3V0cHV0ID0gbGlua0RldGVjdG9yLmxpbmtpZnkoaW5wdXQsIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDIsIG91dHB1dC5jaGlsZHJlbi5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgnU1BBTicsIG91dHB1dC50YWdOYW1lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoJ1NQQU4nLCBvdXRwdXQuY2hpbGRyZW5bMF0udGFnTmFtZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCdTUEFOJywgb3V0cHV0LmNoaWxkcmVuWzFdLnRhZ05hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHBlY3RlZE91dHB1dCwgb3V0cHV0Lm91dGVySFRNTCk7XG5cdH0pO1xuXG5cdHRlc3QoJ211bHRpbGluZVdpdGhMaW5rcycsICgpID0+IHtcblx0XHRjb25zdCBpbnB1dCA9IGlzV2luZG93cyA/ICdJIGhhdmUgYSBsaW5rIGZvciB5b3VcXG5IZXJlIGl0IGlzOiBDOi9mb28vYmFyLmpzOjEyOjM0XFxuQ29vbCwgaHVoPycgOlxuXHRcdFx0J0kgaGF2ZSBhIGxpbmsgZm9yIHlvdVxcbkhlcmUgaXQgaXM6IC9Vc2Vycy9mb28vYmFyLmpzOjEyOjM0XFxuQ29vbCwgaHVoPyc7XG5cdFx0Y29uc3QgZXhwZWN0ZWRPdXRwdXQgPSAvXjxzcGFuPjxzcGFuPkkgaGF2ZSBhIGxpbmsgZm9yIHlvdVxcbjxcXC9zcGFuPjxzcGFuPkhlcmUgaXQgaXM6IDxhIHRhYmluZGV4PVwiMFwiPi4qXFwvZm9vXFwvYmFyLmpzOjEyOjM0PFxcL2E+XFxuPFxcL3NwYW4+PHNwYW4+Q29vbCwgaHVoXFw/PFxcL3NwYW4+PFxcL3NwYW4+JC87XG5cdFx0Y29uc3Qgb3V0cHV0ID0gbGlua0RldGVjdG9yLmxpbmtpZnkoaW5wdXQsIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDMsIG91dHB1dC5jaGlsZHJlbi5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgnU1BBTicsIG91dHB1dC50YWdOYW1lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoJ1NQQU4nLCBvdXRwdXQuY2hpbGRyZW5bMF0udGFnTmFtZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCdTUEFOJywgb3V0cHV0LmNoaWxkcmVuWzFdLnRhZ05hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgnU1BBTicsIG91dHB1dC5jaGlsZHJlblsyXS50YWdOYW1lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoJ0EnLCBvdXRwdXQuY2hpbGRyZW5bMV0uY2hpbGRyZW5bMF0udGFnTmFtZSk7XG5cdFx0YXNzZXJ0KGV4cGVjdGVkT3V0cHV0LnRlc3Qob3V0cHV0Lm91dGVySFRNTCkpO1xuXHRcdGFzc2VydEVsZW1lbnRJc0xpbmsob3V0cHV0LmNoaWxkcmVuWzFdLmNoaWxkcmVuWzBdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNXaW5kb3dzID8gJ0M6L2Zvby9iYXIuanM6MTI6MzQnIDogJy9Vc2Vycy9mb28vYmFyLmpzOjEyOjM0Jywgb3V0cHV0LmNoaWxkcmVuWzFdLmNoaWxkcmVuWzBdLnRleHRDb250ZW50KTtcblx0fSk7XG5cblx0dGVzdCgnaGlnaGxpZ2h0Tm9MaW5rcycsICgpID0+IHtcblx0XHRjb25zdCBpbnB1dCA9ICdJIGFtIGEgc3RyaW5nJztcblx0XHRjb25zdCBoaWdobGlnaHRzOiBJSGlnaGxpZ2h0W10gPSBbeyBzdGFydDogMiwgZW5kOiA1IH1dO1xuXHRcdGNvbnN0IGV4cGVjdGVkT3V0cHV0ID0gJzxzcGFuPkkgPHNwYW4gY2xhc3M9XCJoaWdobGlnaHRcIj5hbSA8L3NwYW4+YSBzdHJpbmc8L3NwYW4+Jztcblx0XHRjb25zdCBvdXRwdXQgPSBsaW5rRGV0ZWN0b3IubGlua2lmeShpbnB1dCwgZmFsc2UsIHVuZGVmaW5lZCwgZmFsc2UsIHVuZGVmaW5lZCwgaGlnaGxpZ2h0cyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMSwgb3V0cHV0LmNoaWxkcmVuLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCdTUEFOJywgb3V0cHV0LnRhZ05hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHBlY3RlZE91dHB1dCwgb3V0cHV0Lm91dGVySFRNTCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2hpZ2hsaWdodFdpdGhMaW5rJywgKCkgPT4ge1xuXHRcdGNvbnN0IGlucHV0ID0gaXNXaW5kb3dzID8gJ0M6XFxcXGZvb1xcXFxiYXIuanM6MTI6MzQnIDogJy9Vc2Vycy9mb28vYmFyLmpzOjEyOjM0Jztcblx0XHRjb25zdCBoaWdobGlnaHRzOiBJSGlnaGxpZ2h0W10gPSBbeyBzdGFydDogMCwgZW5kOiA1IH1dO1xuXHRcdGNvbnN0IGV4cGVjdGVkT3V0cHV0ID0gaXNXaW5kb3dzID8gJzxzcGFuPjxhIHRhYmluZGV4PVwiMFwiPjxzcGFuIGNsYXNzPVwiaGlnaGxpZ2h0XCI+QzpcXFxcZm88L3NwYW4+b1xcXFxiYXIuanM6MTI6MzQ8L2E+PC9zcGFuPicgOiAnPHNwYW4+PGEgdGFiaW5kZXg9XCIwXCI+PHNwYW4gY2xhc3M9XCJoaWdobGlnaHRcIj4vVXNlcjwvc3Bhbj5zL2Zvby9iYXIuanM6MTI6MzQ8L2E+PC9zcGFuPic7XG5cdFx0Y29uc3Qgb3V0cHV0ID0gbGlua0RldGVjdG9yLmxpbmtpZnkoaW5wdXQsIGZhbHNlLCB1bmRlZmluZWQsIGZhbHNlLCB1bmRlZmluZWQsIGhpZ2hsaWdodHMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDEsIG91dHB1dC5jaGlsZHJlbi5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgnU1BBTicsIG91dHB1dC50YWdOYW1lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoJ0EnLCBvdXRwdXQuZmlyc3RFbGVtZW50Q2hpbGQhLnRhZ05hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHBlY3RlZE91dHB1dCwgb3V0cHV0Lm91dGVySFRNTCk7XG5cdFx0YXNzZXJ0RWxlbWVudElzTGluayhvdXRwdXQuZmlyc3RFbGVtZW50Q2hpbGQhKTtcblx0fSk7XG5cblx0dGVzdCgnaGlnaGxpZ2h0T3ZlcmxhcHBpbmdMaW5rU3RhcnQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgaW5wdXQgPSBpc1dpbmRvd3MgPyAnQzpcXFxcZm9vXFxcXGJhci5qczoxMjozNCcgOiAnL1VzZXJzL2Zvby9iYXIuanM6MTI6MzQnO1xuXHRcdGNvbnN0IGhpZ2hsaWdodHM6IElIaWdobGlnaHRbXSA9IFt7IHN0YXJ0OiAwLCBlbmQ6IDEwIH1dO1xuXHRcdGNvbnN0IGV4cGVjdGVkT3V0cHV0ID0gaXNXaW5kb3dzID8gJzxzcGFuPjxhIHRhYmluZGV4PVwiMFwiPjxzcGFuIGNsYXNzPVwiaGlnaGxpZ2h0XCI+QzpcXFxcZm9vXFxcXGJhcjwvc3Bhbj4uanM6MTI6MzQ8L2E+PC9zcGFuPicgOiAnPHNwYW4+PGEgdGFiaW5kZXg9XCIwXCI+PHNwYW4gY2xhc3M9XCJoaWdobGlnaHRcIj4vVXNlcnMvZm9vPC9zcGFuPi9iYXIuanM6MTI6MzQ8L2E+PC9zcGFuPic7XG5cdFx0Y29uc3Qgb3V0cHV0ID0gbGlua0RldGVjdG9yLmxpbmtpZnkoaW5wdXQsIGZhbHNlLCB1bmRlZmluZWQsIGZhbHNlLCB1bmRlZmluZWQsIGhpZ2hsaWdodHMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDEsIG91dHB1dC5jaGlsZHJlbi5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgnU1BBTicsIG91dHB1dC50YWdOYW1lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoJ0EnLCBvdXRwdXQuZmlyc3RFbGVtZW50Q2hpbGQhLnRhZ05hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHBlY3RlZE91dHB1dCwgb3V0cHV0Lm91dGVySFRNTCk7XG5cdFx0YXNzZXJ0RWxlbWVudElzTGluayhvdXRwdXQuZmlyc3RFbGVtZW50Q2hpbGQhKTtcblx0fSk7XG5cblx0dGVzdCgnaGlnaGxpZ2h0T3ZlcmxhcHBpbmdMaW5rRW5kJywgKCkgPT4ge1xuXHRcdGNvbnN0IGlucHV0ID0gaXNXaW5kb3dzID8gJ0M6XFxcXGZvb1xcXFxiYXIuanM6MTI6MzQnIDogJy9Vc2Vycy9mb28vYmFyLmpzOjEyOjM0Jztcblx0XHRjb25zdCBoaWdobGlnaHRzOiBJSGlnaGxpZ2h0W10gPSBbeyBzdGFydDogMTAsIGVuZDogMjAgfV07XG5cdFx0Y29uc3QgZXhwZWN0ZWRPdXRwdXQgPSBpc1dpbmRvd3MgPyAnPHNwYW4+PGEgdGFiaW5kZXg9XCIwXCI+QzpcXFxcZm9vXFxcXGJhcjxzcGFuIGNsYXNzPVwiaGlnaGxpZ2h0XCI+LmpzOjEyOjM0PC9zcGFuPjwvYT48L3NwYW4+JyA6ICc8c3Bhbj48YSB0YWJpbmRleD1cIjBcIj4vVXNlcnMvZm9vPHNwYW4gY2xhc3M9XCJoaWdobGlnaHRcIj4vYmFyLmpzOjEyPC9zcGFuPjozNDwvYT48L3NwYW4+Jztcblx0XHRjb25zdCBvdXRwdXQgPSBsaW5rRGV0ZWN0b3IubGlua2lmeShpbnB1dCwgZmFsc2UsIHVuZGVmaW5lZCwgZmFsc2UsIHVuZGVmaW5lZCwgaGlnaGxpZ2h0cyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMSwgb3V0cHV0LmNoaWxkcmVuLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCdTUEFOJywgb3V0cHV0LnRhZ05hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgnQScsIG91dHB1dC5maXJzdEVsZW1lbnRDaGlsZCEudGFnTmFtZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4cGVjdGVkT3V0cHV0LCBvdXRwdXQub3V0ZXJIVE1MKTtcblx0XHRhc3NlcnRFbGVtZW50SXNMaW5rKG91dHB1dC5maXJzdEVsZW1lbnRDaGlsZCEpO1xuXHR9KTtcblxuXHR0ZXN0KCdoaWdobGlnaHRPdmVybGFwcGluZ0xpbmtTdGFydEFuZEVuZCcsICgpID0+IHtcblx0XHRjb25zdCBpbnB1dCA9IGlzV2luZG93cyA/ICdDOlxcXFxmb29cXFxcYmFyLmpzOjEyOjM0JyA6ICcvVXNlcnMvZm9vL2Jhci5qczoxMjozNCc7XG5cdFx0Y29uc3QgaGlnaGxpZ2h0czogSUhpZ2hsaWdodFtdID0gW3sgc3RhcnQ6IDUsIGVuZDogMTUgfV07XG5cdFx0Y29uc3QgZXhwZWN0ZWRPdXRwdXQgPSBpc1dpbmRvd3MgPyAnPHNwYW4+PGEgdGFiaW5kZXg9XCIwXCI+QzpcXFxcZm88c3BhbiBjbGFzcz1cImhpZ2hsaWdodFwiPm9cXFxcYmFyLmpzOjE8L3NwYW4+MjozNDwvYT48L3NwYW4+JyA6ICc8c3Bhbj48YSB0YWJpbmRleD1cIjBcIj4vVXNlcjxzcGFuIGNsYXNzPVwiaGlnaGxpZ2h0XCI+cy9mb28vYmFyLjwvc3Bhbj5qczoxMjozNDwvYT48L3NwYW4+Jztcblx0XHRjb25zdCBvdXRwdXQgPSBsaW5rRGV0ZWN0b3IubGlua2lmeShpbnB1dCwgZmFsc2UsIHVuZGVmaW5lZCwgZmFsc2UsIHVuZGVmaW5lZCwgaGlnaGxpZ2h0cyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMSwgb3V0cHV0LmNoaWxkcmVuLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCdTUEFOJywgb3V0cHV0LnRhZ05hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgnQScsIG91dHB1dC5maXJzdEVsZW1lbnRDaGlsZCEudGFnTmFtZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4cGVjdGVkT3V0cHV0LCBvdXRwdXQub3V0ZXJIVE1MKTtcblx0XHRhc3NlcnRFbGVtZW50SXNMaW5rKG91dHB1dC5maXJzdEVsZW1lbnRDaGlsZCEpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsV0FBVztBQUNwQixTQUFTLCtD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
