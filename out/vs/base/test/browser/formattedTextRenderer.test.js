import assert from "assert";
import { renderFormattedText, renderText } from "../../browser/formattedTextRenderer.js";
import { DisposableStore } from "../../common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../common/utils.js";
suite("FormattedTextRenderer", () => {
  const store = new DisposableStore();
  setup(() => {
    store.clear();
  });
  teardown(() => {
    store.clear();
  });
  test("render simple element", () => {
    const result = renderText("testing");
    assert.strictEqual(result.nodeType, document.ELEMENT_NODE);
    assert.strictEqual(result.textContent, "testing");
    assert.strictEqual(result.tagName, "DIV");
  });
  test("render element with class", () => {
    const result = renderText("testing", {
      className: "testClass"
    });
    assert.strictEqual(result.nodeType, document.ELEMENT_NODE);
    assert.strictEqual(result.className, "testClass");
  });
  test("simple formatting", () => {
    let result = renderFormattedText("**bold**");
    assert.strictEqual(result.children.length, 1);
    assert.strictEqual(result.firstChild.textContent, "bold");
    assert.strictEqual(result.firstChild.tagName, "B");
    assert.strictEqual(result.innerHTML, "<b>bold</b>");
    result = renderFormattedText("__italics__");
    assert.strictEqual(result.innerHTML, "<i>italics</i>");
    result = renderFormattedText("``code``");
    assert.strictEqual(result.innerHTML, "``code``");
    result = renderFormattedText("``code``", { renderCodeSegments: true });
    assert.strictEqual(result.innerHTML, "<code>code</code>");
    result = renderFormattedText("this string has **bold**, __italics__, and ``code``!!", { renderCodeSegments: true });
    assert.strictEqual(result.innerHTML, "this string has <b>bold</b>, <i>italics</i>, and <code>code</code>!!");
  });
  test("no formatting", () => {
    const result = renderFormattedText("this is just a string");
    assert.strictEqual(result.innerHTML, "this is just a string");
  });
  test("preserve newlines", () => {
    const result = renderFormattedText("line one\nline two");
    assert.strictEqual(result.innerHTML, "line one<br>line two");
  });
  test("action", () => {
    let callbackCalled = false;
    const result = renderFormattedText("[[action]]", {
      actionHandler: {
        callback(content) {
          assert.strictEqual(content, "0");
          callbackCalled = true;
        },
        disposables: store
      }
    });
    assert.strictEqual(result.innerHTML, "<a>action</a>");
    const event = document.createEvent("MouseEvent");
    event.initEvent("click", true, true);
    result.firstChild.dispatchEvent(event);
    assert.strictEqual(callbackCalled, true);
  });
  test("fancy action", () => {
    let callbackCalled = false;
    const result = renderFormattedText("__**[[action]]**__", {
      actionHandler: {
        callback(content) {
          assert.strictEqual(content, "0");
          callbackCalled = true;
        },
        disposables: store
      }
    });
    assert.strictEqual(result.innerHTML, "<i><b><a>action</a></b></i>");
    const event = document.createEvent("MouseEvent");
    event.initEvent("click", true, true);
    result.firstChild.firstChild.firstChild.dispatchEvent(event);
    assert.strictEqual(callbackCalled, true);
  });
  test("fancier action", () => {
    let callbackCalled = false;
    const result = renderFormattedText("``__**[[action]]**__``", {
      renderCodeSegments: true,
      actionHandler: {
        callback(content) {
          assert.strictEqual(content, "0");
          callbackCalled = true;
        },
        disposables: store
      }
    });
    assert.strictEqual(result.innerHTML, "<code><i><b><a>action</a></b></i></code>");
    const event = document.createEvent("MouseEvent");
    event.initEvent("click", true, true);
    result.firstChild.firstChild.firstChild.firstChild.dispatchEvent(event);
    assert.strictEqual(callbackCalled, true);
  });
  test("escaped formatting", () => {
    const result = renderFormattedText("\\*\\*bold\\*\\*");
    assert.strictEqual(result.children.length, 0);
    assert.strictEqual(result.innerHTML, "**bold**");
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvYnJvd3Nlci9mb3JtYXR0ZWRUZXh0UmVuZGVyZXIudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IHJlbmRlckZvcm1hdHRlZFRleHQsIHJlbmRlclRleHQgfSBmcm9tICcuLi8uLi9icm93c2VyL2Zvcm1hdHRlZFRleHRSZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uL2NvbW1vbi91dGlscy5qcyc7XG5cbnN1aXRlKCdGb3JtYXR0ZWRUZXh0UmVuZGVyZXInLCAoKSA9PiB7XG5cdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdHNldHVwKCgpID0+IHtcblx0XHRzdG9yZS5jbGVhcigpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0c3RvcmUuY2xlYXIoKTtcblx0fSk7XG5cblx0dGVzdCgncmVuZGVyIHNpbXBsZSBlbGVtZW50JywgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc3VsdDogSFRNTEVsZW1lbnQgPSByZW5kZXJUZXh0KCd0ZXN0aW5nJyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lm5vZGVUeXBlLCBkb2N1bWVudC5FTEVNRU5UX05PREUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQudGV4dENvbnRlbnQsICd0ZXN0aW5nJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC50YWdOYW1lLCAnRElWJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlbmRlciBlbGVtZW50IHdpdGggY2xhc3MnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzdWx0OiBIVE1MRWxlbWVudCA9IHJlbmRlclRleHQoJ3Rlc3RpbmcnLCB7XG5cdFx0XHRjbGFzc05hbWU6ICd0ZXN0Q2xhc3MnXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5ub2RlVHlwZSwgZG9jdW1lbnQuRUxFTUVOVF9OT0RFKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmNsYXNzTmFtZSwgJ3Rlc3RDbGFzcycpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaW1wbGUgZm9ybWF0dGluZycsICgpID0+IHtcblx0XHRsZXQgcmVzdWx0OiBIVE1MRWxlbWVudCA9IHJlbmRlckZvcm1hdHRlZFRleHQoJyoqYm9sZCoqJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5jaGlsZHJlbi5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZmlyc3RDaGlsZCEudGV4dENvbnRlbnQsICdib2xkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCg8SFRNTEVsZW1lbnQ+cmVzdWx0LmZpcnN0Q2hpbGQpLnRhZ05hbWUsICdCJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5pbm5lckhUTUwsICc8Yj5ib2xkPC9iPicpO1xuXG5cdFx0cmVzdWx0ID0gcmVuZGVyRm9ybWF0dGVkVGV4dCgnX19pdGFsaWNzX18nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmlubmVySFRNTCwgJzxpPml0YWxpY3M8L2k+Jyk7XG5cblx0XHRyZXN1bHQgPSByZW5kZXJGb3JtYXR0ZWRUZXh0KCdgYGNvZGVgYCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuaW5uZXJIVE1MLCAnYGBjb2RlYGAnKTtcblxuXHRcdHJlc3VsdCA9IHJlbmRlckZvcm1hdHRlZFRleHQoJ2BgY29kZWBgJywgeyByZW5kZXJDb2RlU2VnbWVudHM6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5pbm5lckhUTUwsICc8Y29kZT5jb2RlPC9jb2RlPicpO1xuXG5cdFx0cmVzdWx0ID0gcmVuZGVyRm9ybWF0dGVkVGV4dCgndGhpcyBzdHJpbmcgaGFzICoqYm9sZCoqLCBfX2l0YWxpY3NfXywgYW5kIGBgY29kZWBgISEnLCB7IHJlbmRlckNvZGVTZWdtZW50czogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmlubmVySFRNTCwgJ3RoaXMgc3RyaW5nIGhhcyA8Yj5ib2xkPC9iPiwgPGk+aXRhbGljczwvaT4sIGFuZCA8Y29kZT5jb2RlPC9jb2RlPiEhJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ25vIGZvcm1hdHRpbmcnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzdWx0OiBIVE1MRWxlbWVudCA9IHJlbmRlckZvcm1hdHRlZFRleHQoJ3RoaXMgaXMganVzdCBhIHN0cmluZycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuaW5uZXJIVE1MLCAndGhpcyBpcyBqdXN0IGEgc3RyaW5nJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3ByZXNlcnZlIG5ld2xpbmVzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc3VsdDogSFRNTEVsZW1lbnQgPSByZW5kZXJGb3JtYXR0ZWRUZXh0KCdsaW5lIG9uZVxcbmxpbmUgdHdvJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5pbm5lckhUTUwsICdsaW5lIG9uZTxicj5saW5lIHR3bycpO1xuXHR9KTtcblxuXHR0ZXN0KCdhY3Rpb24nLCAoKSA9PiB7XG5cdFx0bGV0IGNhbGxiYWNrQ2FsbGVkID0gZmFsc2U7XG5cdFx0Y29uc3QgcmVzdWx0OiBIVE1MRWxlbWVudCA9IHJlbmRlckZvcm1hdHRlZFRleHQoJ1tbYWN0aW9uXV0nLCB7XG5cdFx0XHRhY3Rpb25IYW5kbGVyOiB7XG5cdFx0XHRcdGNhbGxiYWNrKGNvbnRlbnQpIHtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGVudCwgJzAnKTtcblx0XHRcdFx0XHRjYWxsYmFja0NhbGxlZCA9IHRydWU7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGRpc3Bvc2FibGVzOiBzdG9yZVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuaW5uZXJIVE1MLCAnPGE+YWN0aW9uPC9hPicpO1xuXG5cdFx0Y29uc3QgZXZlbnQ6IE1vdXNlRXZlbnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudCgnTW91c2VFdmVudCcpO1xuXHRcdGV2ZW50LmluaXRFdmVudCgnY2xpY2snLCB0cnVlLCB0cnVlKTtcblx0XHRyZXN1bHQuZmlyc3RDaGlsZCEuZGlzcGF0Y2hFdmVudChldmVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxiYWNrQ2FsbGVkLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnZmFuY3kgYWN0aW9uJywgKCkgPT4ge1xuXHRcdGxldCBjYWxsYmFja0NhbGxlZCA9IGZhbHNlO1xuXHRcdGNvbnN0IHJlc3VsdDogSFRNTEVsZW1lbnQgPSByZW5kZXJGb3JtYXR0ZWRUZXh0KCdfXyoqW1thY3Rpb25dXSoqX18nLCB7XG5cdFx0XHRhY3Rpb25IYW5kbGVyOiB7XG5cdFx0XHRcdGNhbGxiYWNrKGNvbnRlbnQpIHtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGVudCwgJzAnKTtcblx0XHRcdFx0XHRjYWxsYmFja0NhbGxlZCA9IHRydWU7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGRpc3Bvc2FibGVzOiBzdG9yZVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuaW5uZXJIVE1MLCAnPGk+PGI+PGE+YWN0aW9uPC9hPjwvYj48L2k+Jyk7XG5cblx0XHRjb25zdCBldmVudDogTW91c2VFdmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCdNb3VzZUV2ZW50Jyk7XG5cdFx0ZXZlbnQuaW5pdEV2ZW50KCdjbGljaycsIHRydWUsIHRydWUpO1xuXHRcdHJlc3VsdC5maXJzdENoaWxkIS5maXJzdENoaWxkIS5maXJzdENoaWxkIS5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbGJhY2tDYWxsZWQsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdmYW5jaWVyIGFjdGlvbicsICgpID0+IHtcblx0XHRsZXQgY2FsbGJhY2tDYWxsZWQgPSBmYWxzZTtcblx0XHRjb25zdCByZXN1bHQ6IEhUTUxFbGVtZW50ID0gcmVuZGVyRm9ybWF0dGVkVGV4dCgnYGBfXyoqW1thY3Rpb25dXSoqX19gYCcsIHtcblx0XHRcdHJlbmRlckNvZGVTZWdtZW50czogdHJ1ZSxcblx0XHRcdGFjdGlvbkhhbmRsZXI6IHtcblx0XHRcdFx0Y2FsbGJhY2soY29udGVudCkge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZW50LCAnMCcpO1xuXHRcdFx0XHRcdGNhbGxiYWNrQ2FsbGVkID0gdHJ1ZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0ZGlzcG9zYWJsZXM6IHN0b3JlXG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5pbm5lckhUTUwsICc8Y29kZT48aT48Yj48YT5hY3Rpb248L2E+PC9iPjwvaT48L2NvZGU+Jyk7XG5cblx0XHRjb25zdCBldmVudDogTW91c2VFdmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCdNb3VzZUV2ZW50Jyk7XG5cdFx0ZXZlbnQuaW5pdEV2ZW50KCdjbGljaycsIHRydWUsIHRydWUpO1xuXHRcdHJlc3VsdC5maXJzdENoaWxkIS5maXJzdENoaWxkIS5maXJzdENoaWxkIS5maXJzdENoaWxkIS5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbGJhY2tDYWxsZWQsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdlc2NhcGVkIGZvcm1hdHRpbmcnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzdWx0OiBIVE1MRWxlbWVudCA9IHJlbmRlckZvcm1hdHRlZFRleHQoJ1xcXFwqXFxcXCpib2xkXFxcXCpcXFxcKicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuY2hpbGRyZW4ubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmlubmVySFRNTCwgJyoqYm9sZCoqJyk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxxQkFBcUIsa0JBQWtCO0FBQ2hELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsK0NBQStDO0FBRXhELE1BQU0seUJBQXlCLE1BQU07QUFDcEMsUUFBTSxRQUFRLElBQUksZ0JBQWdCO0FBRWxDLFFBQU0sTUFBTTtBQUNYLFVBQU0sTUFBTTtBQUFBLEVBQ2IsQ0FBQztBQUVELFdBQVMsTUFBTTtBQUNkLFVBQU0sTUFBTTtBQUFBLEVBQ2IsQ0FBQztBQUVELE9BQUsseUJBQXlCLE1BQU07QUFDbkMsVUFBTSxTQUFzQixXQUFXLFNBQVM7QUFFaEQsV0FBTyxZQUFZLE9BQU8sVUFBVSxTQUFTLFlBQVk7QUFDekQsV0FBTyxZQUFZLE9BQU8s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
