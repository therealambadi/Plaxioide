import assert from "assert";
import { mockObject } from "./mock.js";
import { typeCheck } from "../../../../../base/common/types.js";
import { randomInt } from "../../../../../base/common/numbers.js";
import { randomBoolean } from "../../../../../base/test/common/testUtils.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
suite("mock", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  suite("\u2022 mockObject", () => {
    test("\u2022 overrides properties and functions", () => {
      const mock = mockObject({
        bar: "oh hi!",
        baz: 42,
        anotherMethod(arg) {
          return isNaN(arg);
        }
      });
      typeCheck(mock);
      assert.strictEqual(
        mock.bar,
        "oh hi!",
        "bar should be overriden"
      );
      assert.strictEqual(
        mock.baz,
        42,
        "baz should be overriden"
      );
      assert(
        !mock.anotherMethod(randomInt(100)),
        "Must execute overriden method correctly 1."
      );
      assert(
        mock.anotherMethod(NaN),
        "Must execute overriden method correctly 2."
      );
      assert.throws(() => {
        mock.foo;
      });
      assert.throws(() => {
        mock.someMethod(randomBoolean());
      });
    });
    test("\u2022 immutability of the overrides object", () => {
      const overrides = {
        baz: 4
      };
      const mock = mockObject(overrides);
      typeCheck(mock);
      assert.strictEqual(
        mock.baz,
        4,
        "baz should be overriden"
      );
      assert.throws(() => {
        overrides.foo = "test";
      });
      assert.throws(() => {
        overrides.someMethod = (arg) => {
          return `${arg}__${arg}`;
        };
      });
    });
  });
  suite("\u2022 mockService", () => {
    test("\u2022 overrides properties and functions", () => {
      const mock = mockObject({
        id: "ciao!",
        counter: 74,
        testMethod2(arg) {
          return !isNaN(arg);
        }
      });
      typeCheck(mock);
      assert.strictEqual(
        mock.id,
        "ciao!",
        "id should be overriden"
      );
      assert.strictEqual(
        mock.counter,
        74,
        "counter should be overriden"
      );
      assert(
        mock.testMethod2(randomInt(100)),
        "Must execute overriden method correctly 1."
      );
      assert(
        !mock.testMethod2(NaN),
        "Must execute overriden method correctly 2."
      );
      assert.throws(() => {
        mock.prop1;
      });
      assert.throws(() => {
        mock.method1(randomBoolean());
      });
    });
    test("\u2022 immutability of the overrides object", () => {
      const overrides = {
        baz: false
      };
      const mock = mockObject(overrides);
      typeCheck(mock);
      assert.strictEqual(
        mock.baz,
        false,
        "baz should be overriden"
      );
      assert.throws(() => {
        overrides.foo = "test";
      });
      assert.throws(() => {
        overrides.someMethod = (arg) => {
          return `${arg}__${arg}`;
        };
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9wcm9tcHRzL3Rlc3QvY29tbW9uL3V0aWxzL21vY2sudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IG1vY2tPYmplY3QgfSBmcm9tICcuL21vY2suanMnO1xuaW1wb3J0IHsgdHlwZUNoZWNrIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgcmFuZG9tSW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbnVtYmVycy5qcyc7XG5pbXBvcnQgeyByYW5kb21Cb29sZWFuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi90ZXN0VXRpbHMuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cbnN1aXRlKCdtb2NrJywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRzdWl0ZSgnXHUyMDIyIG1vY2tPYmplY3QnLCAoKSA9PiB7XG5cdFx0dGVzdCgnXHUyMDIyIG92ZXJyaWRlcyBwcm9wZXJ0aWVzIGFuZCBmdW5jdGlvbnMnLCAoKSA9PiB7XG5cdFx0XHRpbnRlcmZhY2UgSVRlc3RPYmplY3Qge1xuXHRcdFx0XHRmb286IHN0cmluZztcblx0XHRcdFx0YmFyOiBzdHJpbmc7XG5cdFx0XHRcdHJlYWRvbmx5IGJhejogbnVtYmVyO1xuXHRcdFx0XHRzb21lTWV0aG9kKGFyZzogYm9vbGVhbik6IHN0cmluZztcblx0XHRcdFx0YW5vdGhlck1ldGhvZChhcmc6IG51bWJlcik6IGJvb2xlYW47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG1vY2sgPSBtb2NrT2JqZWN0PElUZXN0T2JqZWN0Pih7XG5cdFx0XHRcdGJhcjogJ29oIGhpIScsXG5cdFx0XHRcdGJhejogNDIsXG5cdFx0XHRcdGFub3RoZXJNZXRob2QoYXJnOiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRcdFx0XHRyZXR1cm4gaXNOYU4oYXJnKTtcblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXG5cdFx0XHR0eXBlQ2hlY2s8SVRlc3RPYmplY3Q+KG1vY2spO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRcdG1vY2suYmFyLFxuXHRcdFx0XHQnb2ggaGkhJyxcblx0XHRcdFx0J2JhciBzaG91bGQgYmUgb3ZlcnJpZGVuJyxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdFx0bW9jay5iYXosXG5cdFx0XHRcdDQyLFxuXHRcdFx0XHQnYmF6IHNob3VsZCBiZSBvdmVycmlkZW4nLFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHQhKG1vY2suYW5vdGhlck1ldGhvZChyYW5kb21JbnQoMTAwKSkpLFxuXHRcdFx0XHQnTXVzdCBleGVjdXRlIG92ZXJyaWRlbiBtZXRob2QgY29ycmVjdGx5IDEuJyxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydChcblx0XHRcdFx0bW9jay5hbm90aGVyTWV0aG9kKE5hTiksXG5cdFx0XHRcdCdNdXN0IGV4ZWN1dGUgb3ZlcnJpZGVuIG1ldGhvZCBjb3JyZWN0bHkgMi4nLFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRcdC8vIHByb3BlcnR5IGlzIG5vdCBvdmVycmlkZW4gc28gbXVzdCB0aHJvd1xuXHRcdFx0XHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbG9jYWwvY29kZS1uby11bnVzZWQtZXhwcmVzc2lvbnNcblx0XHRcdFx0bW9jay5mb287XG5cdFx0XHR9KTtcblxuXHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRcdC8vIGZ1bmN0aW9uIGlzIG5vdCBvdmVycmlkZW4gc28gbXVzdCB0aHJvd1xuXHRcdFx0XHRtb2NrLnNvbWVNZXRob2QocmFuZG9tQm9vbGVhbigpKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnXHUyMDIyIGltbXV0YWJpbGl0eSBvZiB0aGUgb3ZlcnJpZGVzIG9iamVjdCcsICgpID0+IHtcblx0XHRcdGludGVyZmFjZSBJVGVzdE9iamVjdCB7XG5cdFx0XHRcdGZvbzogc3RyaW5nO1xuXHRcdFx0XHRiYXI6IHN0cmluZztcblx0XHRcdFx0cmVhZG9ubHkgYmF6OiBudW1iZXI7XG5cdFx0XHRcdHNvbWVNZXRob2QoYXJnOiBib29sZWFuKTogc3RyaW5nO1xuXHRcdFx0XHRhbm90aGVyTWV0aG9kKGFyZzogbnVtYmVyKTogYm9vbGVhbjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgb3ZlcnJpZGVzOiBQYXJ0aWFsPElUZXN0T2JqZWN0PiA9IHtcblx0XHRcdFx0YmF6OiA0LFxuXHRcdFx0fTtcblx0XHRcdGNvbnN0IG1vY2sgPSBtb2NrT2JqZWN0PElUZXN0T2JqZWN0PihvdmVycmlkZXMpO1xuXHRcdFx0dHlwZUNoZWNrPElUZXN0T2JqZWN0Pihtb2NrKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0XHRtb2NrLmJheixcblx0XHRcdFx0NCxcblx0XHRcdFx0J2JheiBzaG91bGQgYmUgb3ZlcnJpZGVuJyxcblx0XHRcdCk7XG5cblx0XHRcdC8vIG92ZXJyaWRlcyBvYmplY3QgbXVzdCBiZSBpbW11dGFibGVcblx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRvdmVycmlkZXMuZm9vID0gJ3Rlc3QnO1xuXHRcdFx0fSk7XG5cblx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRvdmVycmlkZXMuc29tZU1ldGhvZCA9IChhcmc6IGJvb2xlYW4pID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gYCR7YXJnfV9fJHthcmd9YDtcblx0XHRcdFx0fTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnXHUyMDIyIG1vY2tTZXJ2aWNlJywgKCkgPT4ge1xuXHRcdHRlc3QoJ1x1MjAyMiBvdmVycmlkZXMgcHJvcGVydGllcyBhbmQgZnVuY3Rpb25zJywgKCkgPT4ge1xuXHRcdFx0aW50ZXJmYWNlIElUZXN0U2VydmljZSB7XG5cdFx0XHRcdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0XHRcdFx0cHJvcDE6IHN0cmluZztcblx0XHRcdFx0aWQ6IHN0cmluZztcblx0XHRcdFx0cmVhZG9ubHkgY291bnRlcjogbnVtYmVyO1xuXHRcdFx0XHRtZXRob2QxKGFyZzogYm9vbGVhbik6IHN0cmluZztcblx0XHRcdFx0dGVzdE1ldGhvZDIoYXJnOiBudW1iZXIpOiBib29sZWFuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtb2NrID0gbW9ja09iamVjdDxJVGVzdFNlcnZpY2U+KHtcblx0XHRcdFx0aWQ6ICdjaWFvIScsXG5cdFx0XHRcdGNvdW50ZXI6IDc0LFxuXHRcdFx0XHR0ZXN0TWV0aG9kMihhcmc6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdFx0XHRcdHJldHVybiAhaXNOYU4oYXJnKTtcblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXG5cdFx0XHR0eXBlQ2hlY2s8SVRlc3RTZXJ2aWNlPihtb2NrKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0XHRtb2NrLmlkLFxuXHRcdFx0XHQnY2lhbyEnLFxuXHRcdFx0XHQnaWQgc2hvdWxkIGJlIG92ZXJyaWRlbicsXG5cdFx0XHQpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRcdG1vY2suY291bnRlcixcblx0XHRcdFx0NzQsXG5cdFx0XHRcdCdjb3VudGVyIHNob3VsZCBiZSBvdmVycmlkZW4nLFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRtb2NrLnRlc3RNZXRob2QyKHJhbmRvbUludCgxMDApKSxcblx0XHRcdFx0J011c3QgZXhlY3V0ZSBvdmVycmlkZW4gbWV0aG9kIGNvcnJlY3RseSAxLicsXG5cdFx0XHQpO1xuXG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdCEobW9jay50ZXN0TWV0aG9kMihOYU4pKSxcblx0XHRcdFx0J011c3QgZXhlY3V0ZSBvdmVycmlkZW4gbWV0aG9kIGNvcnJlY3RseSAyLicsXG5cdFx0XHQpO1xuXG5cdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0Ly8gcHJvcGVydHkgaXMgbm90IG92ZXJyaWRlbiBzbyBtdXN0IHRocm93XG5cdFx0XHRcdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBsb2NhbC9jb2RlLW5vLXVudXNlZC1leHByZXNzaW9uc1xuXHRcdFx0XHRtb2NrLnByb3AxO1xuXHRcdFx0fSk7XG5cblx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHQvLyBmdW5jdGlvbiBpcyBub3Qgb3ZlcnJpZGVuIHNvIG11c3QgdGhyb3dcblx0XHRcdFx0bW9jay5tZXRob2QxKHJhbmRvbUJvb2xlYW4oKSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ1x1MjAyMiBpbW11dGFiaWxpdHkgb2YgdGhlIG92ZXJyaWRlcyBvYmplY3QnLCAoKSA9PiB7XG5cdFx0XHRpbnRlcmZhY2UgSVRlc3RTZXJ2aWNlIHtcblx0XHRcdFx0Zm9vOiBzdHJpbmc7XG5cdFx0XHRcdGJhcjogc3RyaW5nO1xuXHRcdFx0XHRyZWFkb25seSBiYXo6IGJvb2xlYW47XG5cdFx0XHRcdHNvbWVNZXRob2QoYXJnOiBib29sZWFuKTogc3RyaW5nO1xuXHRcdFx0XHRhbm90aGVyTWV0aG9kKGFyZzogbnVtYmVyKTogYm9vbGVhbjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgb3ZlcnJpZGVzOiBQYXJ0aWFsPElUZXN0U2VydmljZT4gPSB7XG5cdFx0XHRcdGJhejogZmFsc2UsXG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgbW9jayA9IG1vY2tPYmplY3Q8SVRlc3RTZXJ2aWNlPihvdmVycmlkZXMpO1xuXHRcdFx0dHlwZUNoZWNrPElUZXN0U2VydmljZT4obW9jayk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdFx0bW9jay5iYXosXG5cdFx0XHRcdGZhbHNlLFxuXHRcdFx0XHQnYmF6IHNob3VsZCBiZSBvdmVycmlkZW4nLFxuXHRcdFx0KTtcblxuXHRcdFx0Ly8gb3ZlcnJpZGVzIG9iamVjdCBtdXN0IGJlIGltbXV0YWJsZVxuXHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRcdG92ZXJyaWRlcy5mb28gPSAndGVzdCc7XG5cdFx0XHR9KTtcblxuXHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRcdG92ZXJyaWRlcy5zb21lTWV0aG9kID0gKGFyZzogYm9vbGVhbikgPT4ge1xuXHRcdFx0XHRcdHJldHVybiBgJHthcmd9X18ke2FyZ31gO1xuXHRcdFx0XHR9O1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxrQkFBa0I7QUFDM0IsU0FB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
