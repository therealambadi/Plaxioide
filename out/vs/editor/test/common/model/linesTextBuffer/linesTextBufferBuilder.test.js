import assert from "assert";
import * as strings from "../../../../../base/common/strings.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { DefaultEndOfLine } from "../../../../common/model.js";
import { createTextBufferFactory } from "../../../../common/model/textModel.js";
function testTextBufferFactory(text, eol, mightContainNonBasicASCII, mightContainRTL) {
  const { disposable, textBuffer } = createTextBufferFactory(text).create(DefaultEndOfLine.LF);
  assert.strictEqual(textBuffer.mightContainNonBasicASCII(), mightContainNonBasicASCII);
  assert.strictEqual(textBuffer.mightContainRTL(), mightContainRTL);
  assert.strictEqual(textBuffer.getEOL(), eol);
  disposable.dispose();
}
suite("ModelBuilder", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("t1", () => {
    testTextBufferFactory("", "\n", false, false);
  });
  test("t2", () => {
    testTextBufferFactory("Hello world", "\n", false, false);
  });
  test("t3", () => {
    testTextBufferFactory("Hello world\nHow are you?", "\n", false, false);
  });
  test("t4", () => {
    testTextBufferFactory("Hello world\nHow are you?\nIs everything good today?\nDo you enjoy the weather?", "\n", false, false);
  });
  test("carriage return detection (1 \\r\\n 2 \\n)", () => {
    testTextBufferFactory("Hello world\r\nHow are you?\nIs everything good today?\nDo you enjoy the weather?", "\n", false, false);
  });
  test("carriage return detection (2 \\r\\n 1 \\n)", () => {
    testTextBufferFactory("Hello world\r\nHow are you?\r\nIs everything good today?\nDo you enjoy the weather?", "\r\n", false, false);
  });
  test("carriage return detection (3 \\r\\n 0 \\n)", () => {
    testTextBufferFactory("Hello world\r\nHow are you?\r\nIs everything good today?\r\nDo you enjoy the weather?", "\r\n", false, false);
  });
  test("BOM handling", () => {
    testTextBufferFactory(strings.UTF8_BOM_CHARACTER + "Hello world!", "\n", false, false);
  });
  test("RTL handling 2", () => {
    testTextBufferFactory("Hello world!\u05D6\u05D5\u05D4\u05D9 \u05E2\u05D5\u05D1\u05D3\u05D4 \u05DE\u05D1\u05D5\u05E1\u05E1\u05EA \u05E9\u05D3\u05E2\u05EA\u05D5", "\n", true, true);
  });
  test("RTL handling 3", () => {
    testTextBufferFactory("Hello world!\u05D6\u05D5\u05D4\u05D9 \n\u05E2\u05D5\u05D1\u05D3\u05D4 \u05DE\u05D1\u05D5\u05E1\u05E1\u05EA \u05E9\u05D3\u05E2\u05EA\u05D5", "\n", true, true);
  });
  test("ASCII handling 1", () => {
    testTextBufferFactory("Hello world!!\nHow do you do?", "\n", false, false);
  });
  test("ASCII handling 2", () => {
    testTextBufferFactory("Hello world!!\nHow do you do?Z\xFCricha\u{1F4DA}\u{1F4DA}b", "\n", true, false);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZWwvbGluZXNUZXh0QnVmZmVyL2xpbmVzVGV4dEJ1ZmZlckJ1aWxkZXIudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IERlZmF1bHRFbmRPZkxpbmUgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnkgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcblxuZnVuY3Rpb24gdGVzdFRleHRCdWZmZXJGYWN0b3J5KHRleHQ6IHN0cmluZywgZW9sOiBzdHJpbmcsIG1pZ2h0Q29udGFpbk5vbkJhc2ljQVNDSUk6IGJvb2xlYW4sIG1pZ2h0Q29udGFpblJUTDogYm9vbGVhbik6IHZvaWQge1xuXHRjb25zdCB7IGRpc3Bvc2FibGUsIHRleHRCdWZmZXIgfSA9IGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5KHRleHQpLmNyZWF0ZShEZWZhdWx0RW5kT2ZMaW5lLkxGKTtcblxuXHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dEJ1ZmZlci5taWdodENvbnRhaW5Ob25CYXNpY0FTQ0lJKCksIG1pZ2h0Q29udGFpbk5vbkJhc2ljQVNDSUkpO1xuXHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dEJ1ZmZlci5taWdodENvbnRhaW5SVEwoKSwgbWlnaHRDb250YWluUlRMKTtcblx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRCdWZmZXIuZ2V0RU9MKCksIGVvbCk7XG5cdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xufVxuXG5zdWl0ZSgnTW9kZWxCdWlsZGVyJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ3QxJywgKCkgPT4ge1xuXHRcdHRlc3RUZXh0QnVmZmVyRmFjdG9yeSgnJywgJ1xcbicsIGZhbHNlLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3QyJywgKCkgPT4ge1xuXHRcdHRlc3RUZXh0QnVmZmVyRmFjdG9yeSgnSGVsbG8gd29ybGQnLCAnXFxuJywgZmFsc2UsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgndDMnLCAoKSA9PiB7XG5cdFx0dGVzdFRleHRCdWZmZXJGYWN0b3J5KCdIZWxsbyB3b3JsZFxcbkhvdyBhcmUgeW91PycsICdcXG4nLCBmYWxzZSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCd0NCcsICgpID0+IHtcblx0XHR0ZXN0VGV4dEJ1ZmZlckZhY3RvcnkoJ0hlbGxvIHdvcmxkXFxuSG93IGFyZSB5b3U/XFxuSXMgZXZlcnl0aGluZyBnb29kIHRvZGF5P1xcbkRvIHlvdSBlbmpveSB0aGUgd2VhdGhlcj8nLCAnXFxuJywgZmFsc2UsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnY2FycmlhZ2UgcmV0dXJuIGRldGVjdGlvbiAoMSBcXFxcclxcXFxuIDIgXFxcXG4pJywgKCkgPT4ge1xuXHRcdHRlc3RUZXh0QnVmZmVyRmFjdG9yeSgnSGVsbG8gd29ybGRcXHJcXG5Ib3cgYXJlIHlvdT9cXG5JcyBldmVyeXRoaW5nIGdvb2QgdG9kYXk/XFxuRG8geW91IGVuam95IHRoZSB3ZWF0aGVyPycsICdcXG4nLCBmYWxzZSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdjYXJyaWFnZSByZXR1cm4gZGV0ZWN0aW9uICgyIFxcXFxyXFxcXG4gMSBcXFxcbiknLCAoKSA9PiB7XG5cdFx0dGVzdFRleHRCdWZmZXJGYWN0b3J5KCdIZWxsbyB3b3JsZFxcclxcbkhvdyBhcmUgeW91P1xcclxcbklzIGV2ZXJ5dGhpbmcgZ29vZCB0b2RheT9cXG5EbyB5b3UgZW5qb3kgdGhlIHdlYXRoZXI/JywgJ1xcclxcbicsIGZhbHNlLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NhcnJpYWdlIHJldHVybiBkZXRlY3Rpb24gKDMgXFxcXHJcXFxcbiAwIFxcXFxuKScsICgpID0+IHtcblx0XHR0ZXN0VGV4dEJ1ZmZlckZhY3RvcnkoJ0hlbGxvIHdvcmxkXFxyXFxuSG93IGFyZSB5b3U/XFxyXFxuSXMgZXZlcnl0aGluZyBnb29kIHRvZGF5P1xcclxcbkRvIHlvdSBlbmpveSB0aGUgd2VhdGhlcj8nLCAnXFxyXFxuJywgZmFsc2UsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnQk9NIGhhbmRsaW5nJywgKCkgPT4ge1xuXHRcdHRlc3RUZXh0QnVmZmVyRmFjdG9yeShzdHJpbmdzLlVURjhfQk9NX0NIQVJBQ1RFUiArICdIZWxsbyB3b3JsZCEnLCAnXFxuJywgZmFsc2UsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnUlRMIGhhbmRsaW5nIDInLCAoKSA9PiB7XG5cdFx0dGVzdFRleHRCdWZmZXJGYWN0b3J5KCdIZWxsbyB3b3JsZCFcdTA1RDZcdTA1RDVcdTA1RDRcdTA1RDkgXHUwNUUyXHUwNUQ1XHUwNUQxXHUwNUQzXHUwNUQ0IFx1MDVERVx1MDVEMVx1MDVENVx1MDVFMVx1MDVFMVx1MDVFQSBcdTA1RTlcdTA1RDNcdTA1RTJcdTA1RUFcdTA1RDUnLCAnXFxuJywgdHJ1ZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1JUTCBoYW5kbGluZyAzJywgKCkgPT4ge1xuXHRcdHRlc3RUZXh0QnVmZmVyRmFjdG9yeSgnSGVsbG8gd29ybGQhXHUwNUQ2XHUwNUQ1XHUwNUQ0XHUwNUQ5IFxcblx1MDVFMlx1MDVENVx1MDVEMVx1MDVEM1x1MDVENCBcdTA1REVcdTA1RDFcdTA1RDVcdTA1RTFcdTA1RTFcdTA1RUEgXHUwNUU5XHUwNUQzXHUwNUUyXHUwNUVBXHUwNUQ1JywgJ1xcbicsIHRydWUsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdBU0NJSSBoYW5kbGluZyAxJywgKCkgPT4ge1xuXHRcdHRlc3RUZXh0QnVmZmVyRmFjdG9yeSgnSGVsbG8gd29ybGQhIVxcbkhvdyBkbyB5b3UgZG8/JywgJ1xcbicsIGZhbHNlLCBmYWxzZSk7XG5cdH0pO1xuXHR0ZXN0KCdBU0NJSSBoYW5kbGluZyAyJywgKCkgPT4ge1xuXHRcdHRlc3RUZXh0QnVmZmVyRmFjdG9yeSgnSGVsbG8gd29ybGQhIVxcbkhvdyBkbyB5b3UgZG8/Wlx1MDBGQ3JpY2hhXHVEODNEXHVEQ0RBXHVEODNEXHVEQ0RBYicsICdcXG4nLCB0cnVlLCBmYWxzZSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsWUFBWSxhQUFhO0FBQ3pCLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsK0JBQStCO0FBRXhDLFNBQVMsc0JBQXNCLE1BQWMsS0FBYSwyQkFBb0MsaUJBQWdDO0FBQzdILFFBQU0sRUFBRSxZQUFZLFdBQVcsSUFBSSx3QkFBd0IsSUFBSSxFQUFFLE9BQU8saUJBQWlCLEVBQUU7QUFFM0YsU0FBTyxZQUFZLFdBQVcsMEJBQTBCLEdBQUcseUJBQXlCO0FBQ3BGLFNBQU8sWUFBWSxXQUFXLGdCQUFnQixHQUFHLGVBQWU7QUFDaEUsU0FBTyxZQUFZLFdBQVcsT0FBTyxHQUFHLEdBQUc7QUFDM0MsYUFBVyxRQUFRO0FBQ3BCO0FBRUEsTUFBTSxnQkFBZ0IsTUFBTTtBQUUzQiwwQ0FBd0M7QUFFeEMsT0FBSyxNQUFNLE1BQU07QUFDaEIsMEJBQXNCLElBQUksTUFBTSxPQUFPLEtBQUs7QUFBQSxFQUM3QyxDQUFDO0FBRUQsT0FBSyxNQUFNLE1BQU07QUFDaEIsMEJBQXNCLGVBQWUsTUFBTSxPQUFPLEtBQUs7QUFBQSxFQUN4RCxDQUFDO0FBRUQsT0FBSyxNQUFNLE1BQU07QUFDaEIsMEJBQXNCLDZCQUE2QixNQUFNLE9BQU8sS0FBSztBQUFBLEVBQ3RFLENBQUM7QUFFRCxPQUFLLE1BQU0sTUFBTTtBQUNoQiwwQkFBc0IsbUZBQW1GLE1BQU0sT0FBTyxLQUFLO0FBQUEsRUFDNUgsQ0FBQztBQUVELE9BQUssOENBQThDLE1BQU07QUFDeEQsMEJBQXNCLHFGQUFxRixNQUFNLE9BQU8sS0FBSztBQUFBLEVBQzlILENBQUM7QUFFRCxPQUFLLDhDQUE4QyxNQUFNO0FBQ3hELDBCQUFzQix1RkFBdUYsUUFBUSxPQUFPLEtBQUs7QUFBQSxFQUNsSSxDQUFDO0FBRUQsT0FBSyw4Q0FBOEMsTUFBTTtBQUN4RCwwQkFBc0IseUZBQXlGLFFBQVEsT0FBTyxLQUFLO0FBQUEsRUFDcEksQ0FBQztBQUVELE9BQUssZ0JBQWdCLE1BQU07QUFDMUIsMEJBQXNCLFFBQVEscUJBQXFCLGdCQUFnQixNQUFNLE9BQU8sS0FBSztBQUFBLEVBQ3RGLENBQUM7QUFFRCxPQUFLLGtCQUFrQixNQUFNO0FBQzVCLDBCQUFzQiwySUFBdUMsTUFBTSxNQUFNLElBQUk7QUFBQSxFQUM5RSxDQUFDO0FBRUQsT0FBSyxrQkFBa0IsTUFBTTtBQUM1QiwwQkFBc0IsNklBQXlDLE1BQU0sTUFBTSxJQUFJO0FBQUEsRUFDaEYsQ0FBQztBQUVELE9BQUssb0JBQW9CLE1BQU07QUFDOUIsMEJBQXNCLGlDQUFpQyxNQUFNLE9BQU8sS0FBSztBQUFBLEVBQzFFLENBQUM7QUFDRCxPQUFLLG9CQUFvQixNQUFNO0FBQzlCLDBCQUFzQiw4REFBNkMsTUFBTSxNQUFNLEtBQUs7QUFBQSxFQUNyRixDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
