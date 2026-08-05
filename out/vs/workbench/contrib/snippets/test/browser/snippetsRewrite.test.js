import assert from "assert";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Snippet, SnippetSource } from "../../browser/snippetsFile.js";
suite("SnippetRewrite", function() {
  ensureNoDisposablesAreLeakedInTestSuite();
  function assertRewrite(input, expected) {
    const actual = new Snippet(false, ["foo"], "foo", "foo", "foo", input, "foo", SnippetSource.User, generateUuid());
    if (typeof expected === "boolean") {
      assert.strictEqual(actual.codeSnippet, input);
    } else {
      assert.strictEqual(actual.codeSnippet, expected);
    }
  }
  test("bogous variable rewrite", function() {
    assertRewrite("foo", false);
    assertRewrite("hello $1 world$0", false);
    assertRewrite("$foo and $foo", "${1:foo} and ${1:foo}");
    assertRewrite("$1 and $SELECTION and $foo", "$1 and ${SELECTION} and ${2:foo}");
    assertRewrite(
      [
        "for (var ${index} = 0; ${index} < ${array}.length; ${index}++) {",
        "	var ${element} = ${array}[${index}];",
        "	$0",
        "}"
      ].join("\n"),
      [
        "for (var ${1:index} = 0; ${1:index} < ${2:array}.length; ${1:index}++) {",
        "	var ${3:element} = ${2:array}[${1:index}];",
        "	$0",
        "\\}"
      ].join("\n")
    );
  });
  test("Snippet choices: unable to escape comma and pipe, #31521", function() {
    assertRewrite("console.log(${1|not\\, not, five, 5, 1   23|});", false);
  });
  test("lazy bogous variable rewrite", function() {
    const snippet = new Snippet(false, ["fooLang"], "foo", "prefix", "desc", "This is ${bogous} because it is a ${var}", "source", SnippetSource.Extension, generateUuid());
    assert.strictEqual(snippet.body, "This is ${bogous} because it is a ${var}");
    assert.strictEqual(snippet.codeSnippet, "This is ${1:bogous} because it is a ${2:var}");
    assert.strictEqual(snippet.isBogous, true);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zbmlwcGV0cy90ZXN0L2Jyb3dzZXIvc25pcHBldHNSZXdyaXRlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgU25pcHBldCwgU25pcHBldFNvdXJjZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc25pcHBldHNGaWxlLmpzJztcblxuc3VpdGUoJ1NuaXBwZXRSZXdyaXRlJywgZnVuY3Rpb24gKCkge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGZ1bmN0aW9uIGFzc2VydFJld3JpdGUoaW5wdXQ6IHN0cmluZywgZXhwZWN0ZWQ6IHN0cmluZyB8IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCBhY3R1YWwgPSBuZXcgU25pcHBldChmYWxzZSwgWydmb28nXSwgJ2ZvbycsICdmb28nLCAnZm9vJywgaW5wdXQsICdmb28nLCBTbmlwcGV0U291cmNlLlVzZXIsIGdlbmVyYXRlVXVpZCgpKTtcblx0XHRpZiAodHlwZW9mIGV4cGVjdGVkID09PSAnYm9vbGVhbicpIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuY29kZVNuaXBwZXQsIGlucHV0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5jb2RlU25pcHBldCwgZXhwZWN0ZWQpO1xuXHRcdH1cblx0fVxuXG5cdHRlc3QoJ2JvZ291cyB2YXJpYWJsZSByZXdyaXRlJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0YXNzZXJ0UmV3cml0ZSgnZm9vJywgZmFsc2UpO1xuXHRcdGFzc2VydFJld3JpdGUoJ2hlbGxvICQxIHdvcmxkJDAnLCBmYWxzZSk7XG5cblx0XHRhc3NlcnRSZXdyaXRlKCckZm9vIGFuZCAkZm9vJywgJyR7MTpmb299IGFuZCAkezE6Zm9vfScpO1xuXHRcdGFzc2VydFJld3JpdGUoJyQxIGFuZCAkU0VMRUNUSU9OIGFuZCAkZm9vJywgJyQxIGFuZCAke1NFTEVDVElPTn0gYW5kICR7Mjpmb299Jyk7XG5cblxuXHRcdGFzc2VydFJld3JpdGUoXG5cdFx0XHRbXG5cdFx0XHRcdCdmb3IgKHZhciAke2luZGV4fSA9IDA7ICR7aW5kZXh9IDwgJHthcnJheX0ubGVuZ3RoOyAke2luZGV4fSsrKSB7Jyxcblx0XHRcdFx0J1xcdHZhciAke2VsZW1lbnR9ID0gJHthcnJheX1bJHtpbmRleH1dOycsXG5cdFx0XHRcdCdcXHQkMCcsXG5cdFx0XHRcdCd9J1xuXHRcdFx0XS5qb2luKCdcXG4nKSxcblx0XHRcdFtcblx0XHRcdFx0J2ZvciAodmFyICR7MTppbmRleH0gPSAwOyAkezE6aW5kZXh9IDwgJHsyOmFycmF5fS5sZW5ndGg7ICR7MTppbmRleH0rKykgeycsXG5cdFx0XHRcdCdcXHR2YXIgJHszOmVsZW1lbnR9ID0gJHsyOmFycmF5fVskezE6aW5kZXh9XTsnLFxuXHRcdFx0XHQnXFx0JDAnLFxuXHRcdFx0XHQnXFxcXH0nXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnU25pcHBldCBjaG9pY2VzOiB1bmFibGUgdG8gZXNjYXBlIGNvbW1hIGFuZCBwaXBlLCAjMzE1MjEnLCBmdW5jdGlvbiAoKSB7XG5cdFx0YXNzZXJ0UmV3cml0ZSgnY29uc29sZS5sb2coJHsxfG5vdFxcXFwsIG5vdCwgZml2ZSwgNSwgMSAgIDIzfH0pOycsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnbGF6eSBib2dvdXMgdmFyaWFibGUgcmV3cml0ZScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBzbmlwcGV0ID0gbmV3IFNuaXBwZXQoZmFsc2UsIFsnZm9vTGFuZyddLCAnZm9vJywgJ3ByZWZpeCcsICdkZXNjJywgJ1RoaXMgaXMgJHtib2dvdXN9IGJlY2F1c2UgaXQgaXMgYSAke3Zhcn0nLCAnc291cmNlJywgU25pcHBldFNvdXJjZS5FeHRlbnNpb24sIGdlbmVyYXRlVXVpZCgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25pcHBldC5ib2R5LCAnVGhpcyBpcyAke2JvZ291c30gYmVjYXVzZSBpdCBpcyBhICR7dmFyfScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmlwcGV0LmNvZGVTbmlwcGV0LCAnVGhpcyBpcyAkezE6Ym9nb3VzfSBiZWNhdXNlIGl0IGlzIGEgJHsyOnZhcn0nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25pcHBldC5pc0JvZ291cywgdHJ1ZSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxTQUFTLHFCQUFxQjtBQUV2QyxNQUFNLGtCQUFrQixXQUFZO0FBRW5DLDBDQUF3QztBQUV4QyxXQUFTLGNBQWMsT0FBZSxVQUFrQztBQUN2RSxVQUFNLFNBQVMsSUFBSSxRQUFRLE9BQU8sQ0FBQyxLQUFLLEdBQUcsT0FBTyxPQUFPLE9BQU8sT0FBTyxPQUFPLGNBQWMsTUFBTSxhQUFhLENBQUM7QUFDaEgsUUFBSSxPQUFPLGFBQWEsV0FBVztBQUNsQyxhQUFPLFlBQVksT0FBTyxhQUFhLEtBQUs7QUFBQSxJQUM3QyxPQUFPO0FBQ04sYUFBTyxZQUFZLE9BQU8sYUFBYSxRQUFRO0FBQUEsSUFDaEQ7QUFBQSxFQUNEO0FBRUEsT0FBSywyQkFBMkIsV0FBWTtBQUUzQyxrQkFBYyxPQUFPLEtBQUs7QUFDMUIsa0JBQWMsb0JBQW9CLEtBQUs7QUFFdkMsa0JBQWMsaUJBQWlCLHVCQUF1QjtBQUN0RCxrQkFBYyw4QkFBOEIsa0NBQWtDO0FBRzlFO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNELEVBQUUsS0FBSyxJQUFJO0FBQUEsTUFDWDtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNELEVBQUUsS0FBSyxJQUFJO0FBQUEsSUFDWjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssNERBQTRELFdBQVk7QUFDNUUsa0JBQWMsbURBQW1ELEtBQUs7QUFBQSxFQUN2RSxDQUFDO0FBRUQsT0FBSyxnQ0FBZ0MsV0FBWTtBQUNoRCxVQUFNLFVBQVUsSUFBSSxRQUFRLE9BQU8sQ0FBQyxTQUFTLEdBQUcsT0FBTyxVQUFVLFFBQVEsNENBQTRDLFVBQVUsY0FBYyxXQUFXLGFBQWEsQ0FBQztBQUN0SyxXQUFPLFlBQVksUUFBUSxNQUFNLDBDQUEwQztBQUMzRSxXQUFPLFlBQVksUUFBUSxhQUFhLDhDQUE4QztBQUN0RixXQUFPLFlBQVksUUFBUSxVQUFVLElBQUk7QUFBQSxFQUMxQyxDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
