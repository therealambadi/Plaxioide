import * as matchers from "../../common/problemMatcher.js";
import assert from "assert";
import { ValidationState, ValidationStatus } from "../../../../../base/common/parsers.js";
class ProblemReporter {
  constructor() {
    this._validationStatus = new ValidationStatus();
    this._messages = [];
  }
  info(message) {
    this._messages.push(message);
    this._validationStatus.state = ValidationState.Info;
  }
  warn(message) {
    this._messages.push(message);
    this._validationStatus.state = ValidationState.Warning;
  }
  error(message) {
    this._messages.push(message);
    this._validationStatus.state = ValidationState.Error;
  }
  fatal(message) {
    this._messages.push(message);
    this._validationStatus.state = ValidationState.Fatal;
  }
  hasMessage(message) {
    return this._messages.indexOf(message) !== null;
  }
  get messages() {
    return this._messages;
  }
  get state() {
    return this._validationStatus.state;
  }
  isOK() {
    return this._validationStatus.isOK();
  }
  get status() {
    return this._validationStatus;
  }
}
suite("ProblemPatternParser", () => {
  let reporter;
  let parser;
  const testRegexp = new RegExp("test");
  setup(() => {
    reporter = new ProblemReporter();
    parser = new matchers.ProblemPatternParser(reporter);
  });
  suite("single-pattern definitions", () => {
    test("parses a pattern defined by only a regexp", () => {
      const problemPattern = {
        regexp: "test"
      };
      const parsed = parser.parse(problemPattern);
      assert(reporter.isOK());
      assert.deepStrictEqual(parsed, {
        regexp: testRegexp,
        kind: matchers.ProblemLocationKind.Location,
        file: 1,
        line: 2,
        character: 3,
        message: 0
      });
    });
    test("does not sets defaults for line and character if kind is File", () => {
      const problemPattern = {
        regexp: "test",
        kind: "file"
      };
      const parsed = parser.parse(problemPattern);
      assert.deepStrictEqual(parsed, {
        regexp: testRegexp,
        kind: matchers.ProblemLocationKind.File,
        file: 1,
        message: 0
      });
    });
  });
  suite("multi-pattern definitions", () => {
    test("defines a pattern based on regexp and property fields, with file/line location", () => {
      const problemPattern = [
        { regexp: "test", file: 3, line: 4, column: 5, message: 6 }
      ];
      const parsed = parser.parse(problemPattern);
      assert(reporter.isOK());
      assert.deepStrictEqual(
        parsed,
        [{
          regexp: testRegexp,
          kind: matchers.ProblemLocationKind.Location,
          file: 3,
          line: 4,
          character: 5,
          message: 6
        }]
      );
    });
    test("defines a pattern bsaed on regexp and property fields, with location", () => {
      const problemPattern = [
        { regexp: "test", file: 3, location: 4, message: 6 }
      ];
      const parsed = parser.parse(problemPattern);
      assert(reporter.isOK());
      assert.deepStrictEqual(
        parsed,
        [{
          regexp: testRegexp,
          kind: matchers.ProblemLocationKind.Location,
          file: 3,
          location: 4,
          message: 6
        }]
      );
    });
    test("accepts a pattern that provides the fields from multiple entries", () => {
      const problemPattern = [
        { regexp: "test", file: 3 },
        { regexp: "test1", line: 4 },
        { regexp: "test2", column: 5 },
        { regexp: "test3", message: 6 }
      ];
      const parsed = parser.parse(problemPattern);
      assert(reporter.isOK());
      assert.deepStrictEqual(parsed, [
        { regexp: testRegexp, kind: matchers.ProblemLocationKind.Location, file: 3 },
        { regexp: new RegExp("test1"), line: 4 },
        { regexp: new RegExp("test2"), character: 5 },
        { regexp: new RegExp("test3"), message: 6 }
      ]);
    });
    test("forbids setting the loop flag outside of the last element in the array", () => {
      const problemPattern = [
        { regexp: "test", file: 3, loop: true },
        { regexp: "test1", line: 4 }
      ];
      const parsed = parser.parse(problemPattern);
      assert.strictEqual(null, parsed);
      assert.strictEqual(ValidationState.Error, reporter.state);
      assert(reporter.hasMessage("The loop property is only supported on the last line matcher."));
    });
    test("forbids setting the kind outside of the first element of the array", () => {
      const problemPattern = [
        { regexp: "test", file: 3 },
        { regexp: "test1", kind: "file", line: 4 }
      ];
      const parsed = parser.parse(problemPattern);
      assert.strictEqual(null, parsed);
      assert.strictEqual(ValidationState.Error, reporter.state);
      assert(reporter.hasMessage("The problem pattern is invalid. The kind property must be provided only in the first element"));
    });
    test("kind: Location requires a regexp", () => {
      const problemPattern = [
        { file: 0, line: 1, column: 20, message: 0 }
      ];
      const parsed = parser.parse(problemPattern);
      assert.strictEqual(null, parsed);
      assert.strictEqual(ValidationState.Error, reporter.state);
      assert(reporter.hasMessage("The problem pattern is missing a regular expression."));
    });
    test("kind: Location requires a regexp on every entry", () => {
      const problemPattern = [
        { regexp: "test", file: 3 },
        { line: 4 },
        { regexp: "test2", column: 5 },
        { regexp: "test3", message: 6 }
      ];
      const parsed = parser.parse(problemPattern);
      assert.strictEqual(null, parsed);
      assert.strictEqual(ValidationState.Error, reporter.state);
      assert(reporter.hasMessage("The problem pattern is missing a regular expression."));
    });
    test("kind: Location requires a message", () => {
      const problemPattern = [
        { regexp: "test", file: 0, line: 1, column: 20 }
      ];
      const parsed = parser.parse(problemPattern);
      assert.strictEqual(null, parsed);
      assert.strictEqual(ValidationState.Error, reporter.state);
      assert(reporter.hasMessage("The problem pattern is invalid. It must have at least have a file and a message."));
    });
    test("kind: Location requires a file", () => {
      const problemPattern = [
        { regexp: "test", line: 1, column: 20, message: 0 }
      ];
      const parsed = parser.parse(problemPattern);
      assert.strictEqual(null, parsed);
      assert.strictEqual(ValidationState.Error, reporter.state);
      assert(reporter.hasMessage('The problem pattern is invalid. It must either have kind: "file" or have a line or location match group.'));
    });
    test("kind: Location requires either a line or location", () => {
      const problemPattern = [
        { regexp: "test", file: 1, column: 20, message: 0 }
      ];
      const parsed = parser.parse(problemPattern);
      assert.strictEqual(null, parsed);
      assert.strictEqual(ValidationState.Error, reporter.state);
      assert(reporter.hasMessage('The problem pattern is invalid. It must either have kind: "file" or have a line or location match group.'));
    });
    test("kind: File accepts a regexp, file and message", () => {
      const problemPattern = [
        { regexp: "test", file: 2, kind: "file", message: 6 }
      ];
      const parsed = parser.parse(problemPattern);
      assert(reporter.isOK());
      assert.deepStrictEqual(
        parsed,
        [{
          regexp: testRegexp,
          kind: matchers.ProblemLocationKind.File,
          file: 2,
          message: 6
        }]
      );
    });
    test("kind: File requires a file", () => {
      const problemPattern = [
        { regexp: "test", kind: "file", message: 6 }
      ];
      const parsed = parser.parse(problemPattern);
      assert.strictEqual(null, parsed);
      assert.strictEqual(ValidationState.Error, reporter.state);
      assert(reporter.hasMessage("The problem pattern is invalid. It must have at least have a file and a message."));
    });
    test("kind: File requires a message", () => {
      const problemPattern = [
        { regexp: "test", kind: "file", file: 6 }
      ];
      const parsed = parser.parse(problemPattern);
      assert.strictEqual(null, parsed);
      assert.strictEqual(ValidationState.Error, reporter.state);
      assert(reporter.hasMessage("The problem pattern is invalid. It must have at least have a file and a message."));
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy90ZXN0L2NvbW1vbi9wcm9ibGVtTWF0Y2hlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCAqIGFzIG1hdGNoZXJzIGZyb20gJy4uLy4uL2NvbW1vbi9wcm9ibGVtTWF0Y2hlci5qcyc7XG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFZhbGlkYXRpb25TdGF0ZSwgSVByb2JsZW1SZXBvcnRlciwgVmFsaWRhdGlvblN0YXR1cyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhcnNlcnMuanMnO1xuXG5jbGFzcyBQcm9ibGVtUmVwb3J0ZXIgaW1wbGVtZW50cyBJUHJvYmxlbVJlcG9ydGVyIHtcblx0cHJpdmF0ZSBfdmFsaWRhdGlvblN0YXR1czogVmFsaWRhdGlvblN0YXR1cztcblx0cHJpdmF0ZSBfbWVzc2FnZXM6IHN0cmluZ1tdO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMuX3ZhbGlkYXRpb25TdGF0dXMgPSBuZXcgVmFsaWRhdGlvblN0YXR1cygpO1xuXHRcdHRoaXMuX21lc3NhZ2VzID0gW107XG5cdH1cblxuXHRwdWJsaWMgaW5mbyhtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9tZXNzYWdlcy5wdXNoKG1lc3NhZ2UpO1xuXHRcdHRoaXMuX3ZhbGlkYXRpb25TdGF0dXMuc3RhdGUgPSBWYWxpZGF0aW9uU3RhdGUuSW5mbztcblx0fVxuXG5cdHB1YmxpYyB3YXJuKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX21lc3NhZ2VzLnB1c2gobWVzc2FnZSk7XG5cdFx0dGhpcy5fdmFsaWRhdGlvblN0YXR1cy5zdGF0ZSA9IFZhbGlkYXRpb25TdGF0ZS5XYXJuaW5nO1xuXHR9XG5cblx0cHVibGljIGVycm9yKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX21lc3NhZ2VzLnB1c2gobWVzc2FnZSk7XG5cdFx0dGhpcy5fdmFsaWRhdGlvblN0YXR1cy5zdGF0ZSA9IFZhbGlkYXRpb25TdGF0ZS5FcnJvcjtcblx0fVxuXG5cdHB1YmxpYyBmYXRhbChtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9tZXNzYWdlcy5wdXNoKG1lc3NhZ2UpO1xuXHRcdHRoaXMuX3ZhbGlkYXRpb25TdGF0dXMuc3RhdGUgPSBWYWxpZGF0aW9uU3RhdGUuRmF0YWw7XG5cdH1cblxuXHRwdWJsaWMgaGFzTWVzc2FnZShtZXNzYWdlOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fbWVzc2FnZXMuaW5kZXhPZihtZXNzYWdlKSAhPT0gbnVsbDtcblx0fVxuXHRwdWJsaWMgZ2V0IG1lc3NhZ2VzKCk6IHN0cmluZ1tdIHtcblx0XHRyZXR1cm4gdGhpcy5fbWVzc2FnZXM7XG5cdH1cblx0cHVibGljIGdldCBzdGF0ZSgpOiBWYWxpZGF0aW9uU3RhdGUge1xuXHRcdHJldHVybiB0aGlzLl92YWxpZGF0aW9uU3RhdHVzLnN0YXRlO1xuXHR9XG5cblx0cHVibGljIGlzT0soKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3ZhbGlkYXRpb25TdGF0dXMuaXNPSygpO1xuXHR9XG5cblx0cHVibGljIGdldCBzdGF0dXMoKTogVmFsaWRhdGlvblN0YXR1cyB7XG5cdFx0cmV0dXJuIHRoaXMuX3ZhbGlkYXRpb25TdGF0dXM7XG5cdH1cbn1cblxuc3VpdGUoJ1Byb2JsZW1QYXR0ZXJuUGFyc2VyJywgKCkgPT4ge1xuXHRsZXQgcmVwb3J0ZXI6IFByb2JsZW1SZXBvcnRlcjtcblx0bGV0IHBhcnNlcjogbWF0Y2hlcnMuUHJvYmxlbVBhdHRlcm5QYXJzZXI7XG5cdGNvbnN0IHRlc3RSZWdleHAgPSBuZXcgUmVnRXhwKCd0ZXN0Jyk7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdHJlcG9ydGVyID0gbmV3IFByb2JsZW1SZXBvcnRlcigpO1xuXHRcdHBhcnNlciA9IG5ldyBtYXRjaGVycy5Qcm9ibGVtUGF0dGVyblBhcnNlcihyZXBvcnRlcik7XG5cdH0pO1xuXG5cdHN1aXRlKCdzaW5nbGUtcGF0dGVybiBkZWZpbml0aW9ucycsICgpID0+IHtcblx0XHR0ZXN0KCdwYXJzZXMgYSBwYXR0ZXJuIGRlZmluZWQgYnkgb25seSBhIHJlZ2V4cCcsICgpID0+IHtcblx0XHRcdGNvbnN0IHByb2JsZW1QYXR0ZXJuOiBtYXRjaGVycy5Db25maWcuSVByb2JsZW1QYXR0ZXJuID0ge1xuXHRcdFx0XHRyZWdleHA6ICd0ZXN0J1xuXHRcdFx0fTtcblx0XHRcdGNvbnN0IHBhcnNlZCA9IHBhcnNlci5wYXJzZShwcm9ibGVtUGF0dGVybik7XG5cdFx0XHRhc3NlcnQocmVwb3J0ZXIuaXNPSygpKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGFyc2VkLCB7XG5cdFx0XHRcdHJlZ2V4cDogdGVzdFJlZ2V4cCxcblx0XHRcdFx0a2luZDogbWF0Y2hlcnMuUHJvYmxlbUxvY2F0aW9uS2luZC5Mb2NhdGlvbixcblx0XHRcdFx0ZmlsZTogMSxcblx0XHRcdFx0bGluZTogMixcblx0XHRcdFx0Y2hhcmFjdGVyOiAzLFxuXHRcdFx0XHRtZXNzYWdlOiAwXG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHR0ZXN0KCdkb2VzIG5vdCBzZXRzIGRlZmF1bHRzIGZvciBsaW5lIGFuZCBjaGFyYWN0ZXIgaWYga2luZCBpcyBGaWxlJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHJvYmxlbVBhdHRlcm46IG1hdGNoZXJzLkNvbmZpZy5JUHJvYmxlbVBhdHRlcm4gPSB7XG5cdFx0XHRcdHJlZ2V4cDogJ3Rlc3QnLFxuXHRcdFx0XHRraW5kOiAnZmlsZSdcblx0XHRcdH07XG5cdFx0XHRjb25zdCBwYXJzZWQgPSBwYXJzZXIucGFyc2UocHJvYmxlbVBhdHRlcm4pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwYXJzZWQsIHtcblx0XHRcdFx0cmVnZXhwOiB0ZXN0UmVnZXhwLFxuXHRcdFx0XHRraW5kOiBtYXRjaGVycy5Qcm9ibGVtTG9jYXRpb25LaW5kLkZpbGUsXG5cdFx0XHRcdGZpbGU6IDEsXG5cdFx0XHRcdG1lc3NhZ2U6IDBcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnbXVsdGktcGF0dGVybiBkZWZpbml0aW9ucycsICgpID0+IHtcblx0XHR0ZXN0KCdkZWZpbmVzIGEgcGF0dGVybiBiYXNlZCBvbiByZWdleHAgYW5kIHByb3BlcnR5IGZpZWxkcywgd2l0aCBmaWxlL2xpbmUgbG9jYXRpb24nLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBwcm9ibGVtUGF0dGVybjogbWF0Y2hlcnMuQ29uZmlnLk11bHRpTGluZVByb2JsZW1QYXR0ZXJuID0gW1xuXHRcdFx0XHR7IHJlZ2V4cDogJ3Rlc3QnLCBmaWxlOiAzLCBsaW5lOiA0LCBjb2x1bW46IDUsIG1lc3NhZ2U6IDYgfVxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IHBhcnNlZCA9IHBhcnNlci5wYXJzZShwcm9ibGVtUGF0dGVybik7XG5cdFx0XHRhc3NlcnQocmVwb3J0ZXIuaXNPSygpKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocGFyc2VkLFxuXHRcdFx0XHRbe1xuXHRcdFx0XHRcdHJlZ2V4cDogdGVzdFJlZ2V4cCxcblx0XHRcdFx0XHRraW5kOiBtYXRjaGVycy5Qcm9ibGVtTG9jYXRpb25LaW5kLkxvY2F0aW9uLFxuXHRcdFx0XHRcdGZpbGU6IDMsXG5cdFx0XHRcdFx0bGluZTogNCxcblx0XHRcdFx0XHRjaGFyYWN0ZXI6IDUsXG5cdFx0XHRcdFx0bWVzc2FnZTogNlxuXHRcdFx0XHR9XVxuXHRcdFx0KTtcblx0XHR9KTtcblx0XHR0ZXN0KCdkZWZpbmVzIGEgcGF0dGVybiBic2FlZCBvbiByZWdleHAgYW5kIHByb3BlcnR5IGZpZWxkcywgd2l0aCBsb2NhdGlvbicsICgpID0+IHtcblx0XHRcdGNvbnN0IHByb2JsZW1QYXR0ZXJuOiBtYXRjaGVycy5Db25maWcuTXVsdGlMaW5lUHJvYmxlbVBhdHRlcm4gPSBbXG5cdFx0XHRcdHsgcmVnZXhwOiAndGVzdCcsIGZpbGU6IDMsIGxvY2F0aW9uOiA0LCBtZXNzYWdlOiA2IH1cblx0XHRcdF07XG5cdFx0XHRjb25zdCBwYXJzZWQgPSBwYXJzZXIucGFyc2UocHJvYmxlbVBhdHRlcm4pO1xuXHRcdFx0YXNzZXJ0KHJlcG9ydGVyLmlzT0soKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBhcnNlZCxcblx0XHRcdFx0W3tcblx0XHRcdFx0XHRyZWdleHA6IHRlc3RSZWdleHAsXG5cdFx0XHRcdFx0a2luZDogbWF0Y2hlcnMuUHJvYmxlbUxvY2F0aW9uS2luZC5Mb2NhdGlvbixcblx0XHRcdFx0XHRmaWxlOiAzLFxuXHRcdFx0XHRcdGxvY2F0aW9uOiA0LFxuXHRcdFx0XHRcdG1lc3NhZ2U6IDZcblx0XHRcdFx0fV1cblx0XHRcdCk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnYWNjZXB0cyBhIHBhdHRlcm4gdGhhdCBwcm92aWRlcyB0aGUgZmllbGRzIGZyb20gbXVsdGlwbGUgZW50cmllcycsICgpID0+IHtcblx0XHRcdGNvbnN0IHByb2JsZW1QYXR0ZXJuOiBtYXRjaGVycy5Db25maWcuTXVsdGlMaW5lUHJvYmxlbVBhdHRlcm4gPSBbXG5cdFx0XHRcdHsgcmVnZXhwOiAndGVzdCcsIGZpbGU6IDMgfSxcblx0XHRcdFx0eyByZWdleHA6ICd0ZXN0MScsIGxpbmU6IDQgfSxcblx0XHRcdFx0eyByZWdleHA6ICd0ZXN0MicsIGNvbHVtbjogNSB9LFxuXHRcdFx0XHR7IHJlZ2V4cDogJ3Rlc3QzJywgbWVzc2FnZTogNiB9XG5cdFx0XHRdO1xuXHRcdFx0Y29uc3QgcGFyc2VkID0gcGFyc2VyLnBhcnNlKHByb2JsZW1QYXR0ZXJuKTtcblx0XHRcdGFzc2VydChyZXBvcnRlci5pc09LKCkpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwYXJzZWQsIFtcblx0XHRcdFx0eyByZWdleHA6IHRlc3RSZWdleHAsIGtpbmQ6IG1hdGNoZXJzLlByb2JsZW1Mb2NhdGlvbktpbmQuTG9jYXRpb24sIGZpbGU6IDMgfSxcblx0XHRcdFx0eyByZWdleHA6IG5ldyBSZWdFeHAoJ3Rlc3QxJyksIGxpbmU6IDQgfSxcblx0XHRcdFx0eyByZWdleHA6IG5ldyBSZWdFeHAoJ3Rlc3QyJyksIGNoYXJhY3RlcjogNSB9LFxuXHRcdFx0XHR7IHJlZ2V4cDogbmV3IFJlZ0V4cCgndGVzdDMnKSwgbWVzc2FnZTogNiB9XG5cdFx0XHRdKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdmb3JiaWRzIHNldHRpbmcgdGhlIGxvb3AgZmxhZyBvdXRzaWRlIG9mIHRoZSBsYXN0IGVsZW1lbnQgaW4gdGhlIGFycmF5JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHJvYmxlbVBhdHRlcm46IG1hdGNoZXJzLkNvbmZpZy5NdWx0aUxpbmVQcm9ibGVtUGF0dGVybiA9IFtcblx0XHRcdFx0eyByZWdleHA6ICd0ZXN0JywgZmlsZTogMywgbG9vcDogdHJ1ZSB9LFxuXHRcdFx0XHR7IHJlZ2V4cDogJ3Rlc3QxJywgbGluZTogNCB9XG5cdFx0XHRdO1xuXHRcdFx0Y29uc3QgcGFyc2VkID0gcGFyc2VyLnBhcnNlKHByb2JsZW1QYXR0ZXJuKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChudWxsLCBwYXJzZWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFZhbGlkYXRpb25TdGF0ZS5FcnJvciwgcmVwb3J0ZXIuc3RhdGUpO1xuXHRcdFx0YXNzZXJ0KHJlcG9ydGVyLmhhc01lc3NhZ2UoJ1RoZSBsb29wIHByb3BlcnR5IGlzIG9ubHkgc3VwcG9ydGVkIG9uIHRoZSBsYXN0IGxpbmUgbWF0Y2hlci4nKSk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnZm9yYmlkcyBzZXR0aW5nIHRoZSBraW5kIG91dHNpZGUgb2YgdGhlIGZpcnN0IGVsZW1lbnQgb2YgdGhlIGFycmF5JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHJvYmxlbVBhdHRlcm46IG1hdGNoZXJzLkNvbmZpZy5NdWx0aUxpbmVQcm9ibGVtUGF0dGVybiA9IFtcblx0XHRcdFx0eyByZWdleHA6ICd0ZXN0JywgZmlsZTogMyB9LFxuXHRcdFx0XHR7IHJlZ2V4cDogJ3Rlc3QxJywga2luZDogJ2ZpbGUnLCBsaW5lOiA0IH1cblx0XHRcdF07XG5cdFx0XHRjb25zdCBwYXJzZWQgPSBwYXJzZXIucGFyc2UocHJvYmxlbVBhdHRlcm4pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG51bGwsIHBhcnNlZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoVmFsaWRhdGlvblN0YXRlLkVycm9yLCByZXBvcnRlci5zdGF0ZSk7XG5cdFx0XHRhc3NlcnQocmVwb3J0ZXIuaGFzTWVzc2FnZSgnVGhlIHByb2JsZW0gcGF0dGVybiBpcyBpbnZhbGlkLiBUaGUga2luZCBwcm9wZXJ0eSBtdXN0IGJlIHByb3ZpZGVkIG9ubHkgaW4gdGhlIGZpcnN0IGVsZW1lbnQnKSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdraW5kOiBMb2NhdGlvbiByZXF1aXJlcyBhIHJlZ2V4cCcsICgpID0+IHtcblx0XHRcdGNvbnN0IHByb2JsZW1QYXR0ZXJuOiBtYXRjaGVycy5Db25maWcuTXVsdGlMaW5lUHJvYmxlbVBhdHRlcm4gPSBbXG5cdFx0XHRcdHsgZmlsZTogMCwgbGluZTogMSwgY29sdW1uOiAyMCwgbWVzc2FnZTogMCB9XG5cdFx0XHRdO1xuXHRcdFx0Y29uc3QgcGFyc2VkID0gcGFyc2VyLnBhcnNlKHByb2JsZW1QYXR0ZXJuKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChudWxsLCBwYXJzZWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFZhbGlkYXRpb25TdGF0ZS5FcnJvciwgcmVwb3J0ZXIuc3RhdGUpO1xuXHRcdFx0YXNzZXJ0KHJlcG9ydGVyLmhhc01lc3NhZ2UoJ1RoZSBwcm9ibGVtIHBhdHRlcm4gaXMgbWlzc2luZyBhIHJlZ3VsYXIgZXhwcmVzc2lvbi4nKSk7XG5cdFx0fSk7XG5cdFx0dGVzdCgna2luZDogTG9jYXRpb24gcmVxdWlyZXMgYSByZWdleHAgb24gZXZlcnkgZW50cnknLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBwcm9ibGVtUGF0dGVybjogbWF0Y2hlcnMuQ29uZmlnLk11bHRpTGluZVByb2JsZW1QYXR0ZXJuID0gW1xuXHRcdFx0XHR7IHJlZ2V4cDogJ3Rlc3QnLCBmaWxlOiAzIH0sXG5cdFx0XHRcdHsgbGluZTogNCB9LFxuXHRcdFx0XHR7IHJlZ2V4cDogJ3Rlc3QyJywgY29sdW1uOiA1IH0sXG5cdFx0XHRcdHsgcmVnZXhwOiAndGVzdDMnLCBtZXNzYWdlOiA2IH1cblx0XHRcdF07XG5cdFx0XHRjb25zdCBwYXJzZWQgPSBwYXJzZXIucGFyc2UocHJvYmxlbVBhdHRlcm4pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG51bGwsIHBhcnNlZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoVmFsaWRhdGlvblN0YXRlLkVycm9yLCByZXBvcnRlci5zdGF0ZSk7XG5cdFx0XHRhc3NlcnQocmVwb3J0ZXIuaGFzTWVzc2FnZSgnVGhlIHByb2JsZW0gcGF0dGVybiBpcyBtaXNzaW5nIGEgcmVndWxhciBleHByZXNzaW9uLicpKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdraW5kOiBMb2NhdGlvbiByZXF1aXJlcyBhIG1lc3NhZ2UnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBwcm9ibGVtUGF0dGVybjogbWF0Y2hlcnMuQ29uZmlnLk11bHRpTGluZVByb2JsZW1QYXR0ZXJuID0gW1xuXHRcdFx0XHR7IHJlZ2V4cDogJ3Rlc3QnLCBmaWxlOiAwLCBsaW5lOiAxLCBjb2x1bW46IDIwIH1cblx0XHRcdF07XG5cdFx0XHRjb25zdCBwYXJzZWQgPSBwYXJzZXIucGFyc2UocHJvYmxlbVBhdHRlcm4pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG51bGwsIHBhcnNlZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoVmFsaWRhdGlvblN0YXRlLkVycm9yLCByZXBvcnRlci5zdGF0ZSk7XG5cdFx0XHRhc3NlcnQocmVwb3J0ZXIuaGFzTWVzc2FnZSgnVGhlIHByb2JsZW0gcGF0dGVybiBpcyBpbnZhbGlkLiBJdCBtdXN0IGhhdmUgYXQgbGVhc3QgaGF2ZSBhIGZpbGUgYW5kIGEgbWVzc2FnZS4nKSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdraW5kOiBMb2NhdGlvbiByZXF1aXJlcyBhIGZpbGUnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBwcm9ibGVtUGF0dGVybjogbWF0Y2hlcnMuQ29uZmlnLk11bHRpTGluZVByb2JsZW1QYXR0ZXJuID0gW1xuXHRcdFx0XHR7IHJlZ2V4cDogJ3Rlc3QnLCBsaW5lOiAxLCBjb2x1bW46IDIwLCBtZXNzYWdlOiAwIH1cblx0XHRcdF07XG5cdFx0XHRjb25zdCBwYXJzZWQgPSBwYXJzZXIucGFyc2UocHJvYmxlbVBhdHRlcm4pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG51bGwsIHBhcnNlZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoVmFsaWRhdGlvblN0YXRlLkVycm9yLCByZXBvcnRlci5zdGF0ZSk7XG5cdFx0XHRhc3NlcnQocmVwb3J0ZXIuaGFzTWVzc2FnZSgnVGhlIHByb2JsZW0gcGF0dGVybiBpcyBpbnZhbGlkLiBJdCBtdXN0IGVpdGhlciBoYXZlIGtpbmQ6IFwiZmlsZVwiIG9yIGhhdmUgYSBsaW5lIG9yIGxvY2F0aW9uIG1hdGNoIGdyb3VwLicpKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2tpbmQ6IExvY2F0aW9uIHJlcXVpcmVzIGVpdGhlciBhIGxpbmUgb3IgbG9jYXRpb24nLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBwcm9ibGVtUGF0dGVybjogbWF0Y2hlcnMuQ29uZmlnLk11bHRpTGluZVByb2JsZW1QYXR0ZXJuID0gW1xuXHRcdFx0XHR7IHJlZ2V4cDogJ3Rlc3QnLCBmaWxlOiAxLCBjb2x1bW46IDIwLCBtZXNzYWdlOiAwIH1cblx0XHRcdF07XG5cdFx0XHRjb25zdCBwYXJzZWQgPSBwYXJzZXIucGFyc2UocHJvYmxlbVBhdHRlcm4pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG51bGwsIHBhcnNlZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoVmFsaWRhdGlvblN0YXRlLkVycm9yLCByZXBvcnRlci5zdGF0ZSk7XG5cdFx0XHRhc3NlcnQocmVwb3J0ZXIuaGFzTWVzc2FnZSgnVGhlIHByb2JsZW0gcGF0dGVybiBpcyBpbnZhbGlkLiBJdCBtdXN0IGVpdGhlciBoYXZlIGtpbmQ6IFwiZmlsZVwiIG9yIGhhdmUgYSBsaW5lIG9yIGxvY2F0aW9uIG1hdGNoIGdyb3VwLicpKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2tpbmQ6IEZpbGUgYWNjZXB0cyBhIHJlZ2V4cCwgZmlsZSBhbmQgbWVzc2FnZScsICgpID0+IHtcblx0XHRcdGNvbnN0IHByb2JsZW1QYXR0ZXJuOiBtYXRjaGVycy5Db25maWcuTXVsdGlMaW5lUHJvYmxlbVBhdHRlcm4gPSBbXG5cdFx0XHRcdHsgcmVnZXhwOiAndGVzdCcsIGZpbGU6IDIsIGtpbmQ6ICdmaWxlJywgbWVzc2FnZTogNiB9XG5cdFx0XHRdO1xuXHRcdFx0Y29uc3QgcGFyc2VkID0gcGFyc2VyLnBhcnNlKHByb2JsZW1QYXR0ZXJuKTtcblx0XHRcdGFzc2VydChyZXBvcnRlci5pc09LKCkpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwYXJzZWQsXG5cdFx0XHRcdFt7XG5cdFx0XHRcdFx0cmVnZXhwOiB0ZXN0UmVnZXhwLFxuXHRcdFx0XHRcdGtpbmQ6IG1hdGNoZXJzLlByb2JsZW1Mb2NhdGlvbktpbmQuRmlsZSxcblx0XHRcdFx0XHRmaWxlOiAyLFxuXHRcdFx0XHRcdG1lc3NhZ2U6IDZcblx0XHRcdFx0fV1cblx0XHRcdCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdraW5kOiBGaWxlIHJlcXVpcmVzIGEgZmlsZScsICgpID0+IHtcblx0XHRcdGNvbnN0IHByb2JsZW1QYXR0ZXJuOiBtYXRjaGVycy5Db25maWcuTXVsdGlMaW5lUHJvYmxlbVBhdHRlcm4gPSBbXG5cdFx0XHRcdHsgcmVnZXhwOiAndGVzdCcsIGtpbmQ6ICdmaWxlJywgbWVzc2FnZTogNiB9XG5cdFx0XHRdO1xuXHRcdFx0Y29uc3QgcGFyc2VkID0gcGFyc2VyLnBhcnNlKHByb2JsZW1QYXR0ZXJuKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChudWxsLCBwYXJzZWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFZhbGlkYXRpb25TdGF0ZS5FcnJvciwgcmVwb3J0ZXIuc3RhdGUpO1xuXHRcdFx0YXNzZXJ0KHJlcG9ydGVyLmhhc01lc3NhZ2UoJ1RoZSBwcm9ibGVtIHBhdHRlcm4gaXMgaW52YWxpZC4gSXQgbXVzdCBoYXZlIGF0IGxlYXN0IGhhdmUgYSBmaWxlIGFuZCBhIG1lc3NhZ2UuJykpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgna2luZDogRmlsZSByZXF1aXJlcyBhIG1lc3NhZ2UnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBwcm9ibGVtUGF0dGVybjogbWF0Y2hlcnMuQ29uZmlnLk11bHRpTGluZVByb2JsZW1QYXR0ZXJuID0gW1xuXHRcdFx0XHR7IHJlZ2V4cDogJ3Rlc3QnLCBraW5kOiAnZmlsZScsIGZpbGU6IDYgfVxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IHBhcnNlZCA9IHBhcnNlci5wYXJzZShwcm9ibGVtUGF0dGVybik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobnVsbCwgcGFyc2VkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChWYWxpZGF0aW9uU3RhdGUuRXJyb3IsIHJlcG9ydGVyLnN0YXRlKTtcblx0XHRcdGFzc2VydChyZXBvcnRlci5oYXNNZXNzYWdlKCdUaGUgcHJvYmxlbSBwYXR0ZXJuIGlzIGludmFsaWQuIEl0IG11c3QgaGF2ZSBhdCBsZWFzdCBoYXZlIGEgZmlsZSBhbmQgYSBtZXNzYWdlLicpKTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUlBLFlBQVksY0FBYztBQUUxQixPQUFPLFlBQVk7QUFDbkIsU0FBUyxpQkFBbUMsd0JBQXdCO0FBRXBFLE1BQU0sZ0JBQTRDO0FBQUEsRUFJakQsY0FBYztBQUNiLFNBQUssb0JBQW9CLElBQUksaUJBQWlCO0FBQzlDLFNBQUssWUFBWSxDQUFDO0FBQUEsRUFDbkI7QUFBQSxFQUVPLEtBQUssU0FBdUI7QUFDbEMsU0FBSyxVQUFVLEtBQUssT0FBTztBQUMzQixTQUFLLGtCQUFrQixRQUFRLGdCQUFnQjtBQUFBLEVBQ2hEO0FBQUEsRUFFTyxLQUFLLFNBQXVCO0FBQ2xDLFNBQUssVUFBVSxLQUFLLE9BQU87QUFDM0IsU0FBSyxrQkFBa0IsUUFBUSxnQkFBZ0I7QUFBQSxFQUNoRDtBQUFBLEVBRU8sTUFBTSxTQUF1QjtBQUNuQyxTQUFLLFVBQVUsS0FBSyxPQUFPO0FBQzNCLFNBQUssa0JBQWtCLFFBQVEsZ0JBQWdCO0FBQUEsRUFDaEQ7QUFBQSxFQUVPLE1BQU0sU0FBdUI7QUFDbkMsU0FBSyxVQUFVLEtBQUssT0FBTztBQUMzQixTQUFLLGtCQUFrQixRQUFRLGdCQUFnQjtBQUFBLEVBQ2hEO0FBQUEsRUFFTyxXQUFXLFNBQTBCO0FBQzNDLFdBQU8sS0FBSyxVQUFVLFFBQVEsT0FBTyxNQUFNO0FBQUEsRUFDNUM7QUFB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
