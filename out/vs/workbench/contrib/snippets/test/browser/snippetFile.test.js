import assert from "assert";
import { SnippetFile, Snippet, SnippetSource } from "../../browser/snippetsFile.js";
import { URI } from "../../../../../base/common/uri.js";
import { SnippetParser } from "../../../../../editor/contrib/snippet/browser/snippetParser.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
suite("Snippets", function() {
  ensureNoDisposablesAreLeakedInTestSuite();
  class TestSnippetFile extends SnippetFile {
    constructor(filepath, snippets) {
      super(SnippetSource.Extension, filepath, void 0, void 0, void 0, void 0);
      this.data.push(...snippets);
    }
  }
  test("SnippetFile#select", () => {
    let file = new TestSnippetFile(URI.file("somepath/foo.code-snippets"), []);
    let bucket = [];
    file.select("", bucket);
    assert.strictEqual(bucket.length, 0);
    file = new TestSnippetFile(URI.file("somepath/foo.code-snippets"), [
      new Snippet(false, ["foo"], "FooSnippet1", "foo", "", "snippet", "test", SnippetSource.User, generateUuid()),
      new Snippet(false, ["foo"], "FooSnippet2", "foo", "", "snippet", "test", SnippetSource.User, generateUuid()),
      new Snippet(false, ["bar"], "BarSnippet1", "foo", "", "snippet", "test", SnippetSource.User, generateUuid()),
      new Snippet(false, ["bar.comment"], "BarSnippet2", "foo", "", "snippet", "test", SnippetSource.User, generateUuid()),
      new Snippet(false, ["bar.strings"], "BarSnippet2", "foo", "", "snippet", "test", SnippetSource.User, generateUuid()),
      new Snippet(false, ["bazz", "bazz"], "BazzSnippet1", "foo", "", "snippet", "test", SnippetSource.User, generateUuid())
    ]);
    bucket = [];
    file.select("foo", bucket);
    assert.strictEqual(bucket.length, 2);
    bucket = [];
    file.select("fo", bucket);
    assert.strictEqual(bucket.length, 0);
    bucket = [];
    file.select("bar", bucket);
    assert.strictEqual(bucket.length, 1);
    bucket = [];
    file.select("bar.comment", bucket);
    assert.strictEqual(bucket.length, 2);
    bucket = [];
    file.select("bazz", bucket);
    assert.strictEqual(bucket.length, 1);
  });
  test("SnippetFile#select - any scope", function() {
    const file = new TestSnippetFile(URI.file("somepath/foo.code-snippets"), [
      new Snippet(false, [], "AnySnippet1", "foo", "", "snippet", "test", SnippetSource.User, generateUuid()),
      new Snippet(false, ["foo"], "FooSnippet1", "foo", "", "snippet", "test", SnippetSource.User, generateUuid())
    ]);
    const bucket = [];
    file.select("foo", bucket);
    assert.strictEqual(bucket.length, 2);
  });
  test("Snippet#needsClipboard", function() {
    function assertNeedsClipboard(body, expected) {
      const snippet = new Snippet(false, ["foo"], "FooSnippet1", "foo", "", body, "test", SnippetSource.User, generateUuid());
      assert.strictEqual(snippet.needsClipboard, expected);
      assert.strictEqual(SnippetParser.guessNeedsClipboard(body), expected);
    }
    assertNeedsClipboard("foo$CLIPBOARD", true);
    assertNeedsClipboard("${CLIPBOARD}", true);
    assertNeedsClipboard("foo${CLIPBOARD}bar", true);
    assertNeedsClipboard("foo$clipboard", false);
    assertNeedsClipboard("foo${clipboard}", false);
    assertNeedsClipboard("baba", false);
  });
  test("Snippet#isTrivial", function() {
    function assertIsTrivial(body, expected) {
      const snippet = new Snippet(false, ["foo"], "FooSnippet1", "foo", "", body, "test", SnippetSource.User, generateUuid());
      assert.strictEqual(snippet.isTrivial, expected);
    }
    assertIsTrivial("foo", true);
    assertIsTrivial("foo$0", true);
    assertIsTrivial("foo$0bar", false);
    assertIsTrivial("foo$1", false);
    assertIsTrivial("foo$1$0", false);
    assertIsTrivial("${1:foo}", false);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zbmlwcGV0cy90ZXN0L2Jyb3dzZXIvc25pcHBldEZpbGUudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFNuaXBwZXRGaWxlLCBTbmlwcGV0LCBTbmlwcGV0U291cmNlIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9zbmlwcGV0c0ZpbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IFNuaXBwZXRQYXJzZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zbmlwcGV0L2Jyb3dzZXIvc25pcHBldFBhcnNlci5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5zdWl0ZSgnU25pcHBldHMnLCBmdW5jdGlvbiAoKSB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0Y2xhc3MgVGVzdFNuaXBwZXRGaWxlIGV4dGVuZHMgU25pcHBldEZpbGUge1xuXHRcdGNvbnN0cnVjdG9yKGZpbGVwYXRoOiBVUkksIHNuaXBwZXRzOiBTbmlwcGV0W10pIHtcblx0XHRcdHN1cGVyKFNuaXBwZXRTb3VyY2UuRXh0ZW5zaW9uLCBmaWxlcGF0aCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCEsIHVuZGVmaW5lZCEpO1xuXHRcdFx0dGhpcy5kYXRhLnB1c2goLi4uc25pcHBldHMpO1xuXHRcdH1cblx0fVxuXG5cdHRlc3QoJ1NuaXBwZXRGaWxlI3NlbGVjdCcsICgpID0+IHtcblx0XHRsZXQgZmlsZSA9IG5ldyBUZXN0U25pcHBldEZpbGUoVVJJLmZpbGUoJ3NvbWVwYXRoL2Zvby5jb2RlLXNuaXBwZXRzJyksIFtdKTtcblx0XHRsZXQgYnVja2V0OiBTbmlwcGV0W10gPSBbXTtcblx0XHRmaWxlLnNlbGVjdCgnJywgYnVja2V0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYnVja2V0Lmxlbmd0aCwgMCk7XG5cblx0XHRmaWxlID0gbmV3IFRlc3RTbmlwcGV0RmlsZShVUkkuZmlsZSgnc29tZXBhdGgvZm9vLmNvZGUtc25pcHBldHMnKSwgW1xuXHRcdFx0bmV3IFNuaXBwZXQoZmFsc2UsIFsnZm9vJ10sICdGb29TbmlwcGV0MScsICdmb28nLCAnJywgJ3NuaXBwZXQnLCAndGVzdCcsIFNuaXBwZXRTb3VyY2UuVXNlciwgZ2VuZXJhdGVVdWlkKCkpLFxuXHRcdFx0bmV3IFNuaXBwZXQoZmFsc2UsIFsnZm9vJ10sICdGb29TbmlwcGV0MicsICdmb28nLCAnJywgJ3NuaXBwZXQnLCAndGVzdCcsIFNuaXBwZXRTb3VyY2UuVXNlciwgZ2VuZXJhdGVVdWlkKCkpLFxuXHRcdFx0bmV3IFNuaXBwZXQoZmFsc2UsIFsnYmFyJ10sICdCYXJTbmlwcGV0MScsICdmb28nLCAnJywgJ3NuaXBwZXQnLCAndGVzdCcsIFNuaXBwZXRTb3VyY2UuVXNlciwgZ2VuZXJhdGVVdWlkKCkpLFxuXHRcdFx0bmV3IFNuaXBwZXQoZmFsc2UsIFsnYmFyLmNvbW1lbnQnXSwgJ0JhclNuaXBwZXQyJywgJ2ZvbycsICcnLCAnc25pcHBldCcsICd0ZXN0JywgU25pcHBldFNvdXJjZS5Vc2VyLCBnZW5lcmF0ZVV1aWQoKSksXG5cdFx0XHRuZXcgU25pcHBldChmYWxzZSwgWydiYXIuc3RyaW5ncyddLCAnQmFyU25pcHBldDInLCAnZm9vJywgJycsICdzbmlwcGV0JywgJ3Rlc3QnLCBTbmlwcGV0U291cmNlLlVzZXIsIGdlbmVyYXRlVXVpZCgpKSxcblx0XHRcdG5ldyBTbmlwcGV0KGZhbHNlLCBbJ2JhenonLCAnYmF6eiddLCAnQmF6elNuaXBwZXQxJywgJ2ZvbycsICcnLCAnc25pcHBldCcsICd0ZXN0JywgU25pcHBldFNvdXJjZS5Vc2VyLCBnZW5lcmF0ZVV1aWQoKSksXG5cdFx0XSk7XG5cblx0XHRidWNrZXQgPSBbXTtcblx0XHRmaWxlLnNlbGVjdCgnZm9vJywgYnVja2V0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYnVja2V0Lmxlbmd0aCwgMik7XG5cblx0XHRidWNrZXQgPSBbXTtcblx0XHRmaWxlLnNlbGVjdCgnZm8nLCBidWNrZXQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChidWNrZXQubGVuZ3RoLCAwKTtcblxuXHRcdGJ1Y2tldCA9IFtdO1xuXHRcdGZpbGUuc2VsZWN0KCdiYXInLCBidWNrZXQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChidWNrZXQubGVuZ3RoLCAxKTtcblxuXHRcdGJ1Y2tldCA9IFtdO1xuXHRcdGZpbGUuc2VsZWN0KCdiYXIuY29tbWVudCcsIGJ1Y2tldCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJ1Y2tldC5sZW5ndGgsIDIpO1xuXG5cdFx0YnVja2V0ID0gW107XG5cdFx0ZmlsZS5zZWxlY3QoJ2JhenonLCBidWNrZXQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChidWNrZXQubGVuZ3RoLCAxKTtcblx0fSk7XG5cblx0dGVzdCgnU25pcHBldEZpbGUjc2VsZWN0IC0gYW55IHNjb3BlJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgZmlsZSA9IG5ldyBUZXN0U25pcHBldEZpbGUoVVJJLmZpbGUoJ3NvbWVwYXRoL2Zvby5jb2RlLXNuaXBwZXRzJyksIFtcblx0XHRcdG5ldyBTbmlwcGV0KGZhbHNlLCBbXSwgJ0FueVNuaXBwZXQxJywgJ2ZvbycsICcnLCAnc25pcHBldCcsICd0ZXN0JywgU25pcHBldFNvdXJjZS5Vc2VyLCBnZW5lcmF0ZVV1aWQoKSksXG5cdFx0XHRuZXcgU25pcHBldChmYWxzZSwgWydmb28nXSwgJ0Zvb1NuaXBwZXQxJywgJ2ZvbycsICcnLCAnc25pcHBldCcsICd0ZXN0JywgU25pcHBldFNvdXJjZS5Vc2VyLCBnZW5lcmF0ZVV1aWQoKSksXG5cdFx0XSk7XG5cblx0XHRjb25zdCBidWNrZXQ6IFNuaXBwZXRbXSA9IFtdO1xuXHRcdGZpbGUuc2VsZWN0KCdmb28nLCBidWNrZXQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChidWNrZXQubGVuZ3RoLCAyKTtcblxuXHR9KTtcblxuXHR0ZXN0KCdTbmlwcGV0I25lZWRzQ2xpcGJvYXJkJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0ZnVuY3Rpb24gYXNzZXJ0TmVlZHNDbGlwYm9hcmQoYm9keTogc3RyaW5nLCBleHBlY3RlZDogYm9vbGVhbik6IHZvaWQge1xuXHRcdFx0Y29uc3Qgc25pcHBldCA9IG5ldyBTbmlwcGV0KGZhbHNlLCBbJ2ZvbyddLCAnRm9vU25pcHBldDEnLCAnZm9vJywgJycsIGJvZHksICd0ZXN0JywgU25pcHBldFNvdXJjZS5Vc2VyLCBnZW5lcmF0ZVV1aWQoKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25pcHBldC5uZWVkc0NsaXBib2FyZCwgZXhwZWN0ZWQpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoU25pcHBldFBhcnNlci5ndWVzc05lZWRzQ2xpcGJvYXJkKGJvZHkpLCBleHBlY3RlZCk7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0TmVlZHNDbGlwYm9hcmQoJ2ZvbyRDTElQQk9BUkQnLCB0cnVlKTtcblx0XHRhc3NlcnROZWVkc0NsaXBib2FyZCgnJHtDTElQQk9BUkR9JywgdHJ1ZSk7XG5cdFx0YXNzZXJ0TmVlZHNDbGlwYm9hcmQoJ2ZvbyR7Q0xJUEJPQVJEfWJhcicsIHRydWUpO1xuXHRcdGFzc2VydE5lZWRzQ2xpcGJvYXJkKCdmb28kY2xpcGJvYXJkJywgZmFsc2UpO1xuXHRcdGFzc2VydE5lZWRzQ2xpcGJvYXJkKCdmb28ke2NsaXBib2FyZH0nLCBmYWxzZSk7XG5cdFx0YXNzZXJ0TmVlZHNDbGlwYm9hcmQoJ2JhYmEnLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NuaXBwZXQjaXNUcml2aWFsJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0ZnVuY3Rpb24gYXNzZXJ0SXNUcml2aWFsKGJvZHk6IHN0cmluZywgZXhwZWN0ZWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRcdGNvbnN0IHNuaXBwZXQgPSBuZXcgU25pcHBldChmYWxzZSwgWydmb28nXSwgJ0Zvb1NuaXBwZXQxJywgJ2ZvbycsICcnLCBib2R5LCAndGVzdCcsIFNuaXBwZXRTb3VyY2UuVXNlciwgZ2VuZXJhdGVVdWlkKCkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNuaXBwZXQuaXNUcml2aWFsLCBleHBlY3RlZCk7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0SXNUcml2aWFsKCdmb28nLCB0cnVlKTtcblx0XHRhc3NlcnRJc1RyaXZpYWwoJ2ZvbyQwJywgdHJ1ZSk7XG5cdFx0YXNzZXJ0SXNUcml2aWFsKCdmb28kMGJhcicsIGZhbHNlKTtcblx0XHRhc3NlcnRJc1RyaXZpYWwoJ2ZvbyQxJywgZmFsc2UpO1xuXHRcdGFzc2VydElzVHJpdmlhbCgnZm9vJDEkMCcsIGZhbHNlKTtcblx0XHRhc3NlcnRJc1RyaXZpYWwoJyR7MTpmb299JywgZmFsc2UpO1xuXHR9KTtcblxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxhQUFhLFNBQVMscUJBQXFCO0FBQ3BELFNBQVMsV0FBVztBQUNwQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLCtDQUErQztBQUV4RCxNQUFNLFlBQVksV0FBWTtBQUU3QiwwQ0FBd0M7QUFBQSxFQUV4QyxNQUFNLHdCQUF3QixZQUFZO0FBQUEsSUFDekMsWUFBWSxVQUFlLFVBQXFCO0FBQy9DLFlBQU0sY0FBYyxXQUFXLFVBQVUsUUFBVyxRQUFXLFFBQVksTUFBVTtBQUNyRixXQUFLLEtBQUssS0FBSyxHQUFHLFFBQVE7QUFBQSxJQUMzQjtBQUFBLEVBQ0Q7QUFFQSxPQUFLLHNCQUFzQixNQUFNO0FBQ2hDLFFBQUksT0FBTyxJQUFJLGdCQUFnQixJQUFJLEtBQUssNEJBQTRCLEdBQUcsQ0FBQyxDQUFDO0FBQ3pFLFFBQUksU0FBb0IsQ0FBQztBQUN6QixTQUFLLE9BQU8sSUFBSSxNQUFNO0FBQ3RCLFdBQU8sWUFBWSxPQUFPLFFBQVEsQ0FBQztBQUVuQyxXQUFPLElBQUksZ0JBQWdCLElBQUksS0FBSyw0QkFBNEIsR0FBRztBQUFBLE1BQ2xFLElBQUksUUFBUSxPQUFPLENBQUMsS0FBSyxHQUFHLGVBQWUsT0FBTyxJQUFJLFdBQVcsUUFBUSxjQUFjLE1BQU0sYUFBYSxDQUFDO0FBQUEsTUFDM0csSUFBSSxRQUFRLE9BQU8sQ0FBQyxLQUFLLEdBQUcsZUFBZSxPQUFPLElBQUksV0FBVyxRQUFRLGNBQWMsTUFBTSxhQUFhLENBQUM7QUFBQSxNQUMzRyxJQUFJLFFBQVEsT0FBTyxDQUFDLEtBQUssR0FBRyxlQUFlLE9BQU8sSUFBSSxXQUFXLFFBQVEsY0FBYyxNQUFNLGFBQWEsQ0FBQztBQUFBLE1BQzNHLElBQUksUUFBUSxPQUFPLENB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
