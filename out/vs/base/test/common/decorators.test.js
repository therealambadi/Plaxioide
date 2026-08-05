var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
import assert from "assert";
import * as sinon from "sinon";
import { memoize, throttle } from "../../common/decorators.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "./utils.js";
suite("Decorators", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("memoize should memoize methods", () => {
    class Foo {
      constructor(_answer) {
        this._answer = _answer;
        this.count = 0;
      }
      answer() {
        this.count++;
        return this._answer;
      }
    }
    __decorateClass([
      memoize
    ], Foo.prototype, "answer", 1);
    const foo = new Foo(42);
    assert.strictEqual(foo.count, 0);
    assert.strictEqual(foo.answer(), 42);
    assert.strictEqual(foo.count, 1);
    assert.strictEqual(foo.answer(), 42);
    assert.strictEqual(foo.count, 1);
    const foo2 = new Foo(1337);
    assert.strictEqual(foo2.count, 0);
    assert.strictEqual(foo2.answer(), 1337);
    assert.strictEqual(foo2.count, 1);
    assert.strictEqual(foo2.answer(), 1337);
    assert.strictEqual(foo2.count, 1);
    assert.strictEqual(foo.answer(), 42);
    assert.strictEqual(foo.count, 1);
    const foo3 = new Foo(null);
    assert.strictEqual(foo3.count, 0);
    assert.strictEqual(foo3.answer(), null);
    assert.strictEqual(foo3.count, 1);
    assert.strictEqual(foo3.answer(), null);
    assert.strictEqual(foo3.count, 1);
    const foo4 = new Foo(void 0);
    assert.strictEqual(foo4.count, 0);
    assert.strictEqual(foo4.answer(), void 0);
    assert.strictEqual(foo4.count, 1);
    assert.strictEqual(foo4.answer(), void 0);
    assert.strictEqual(foo4.count, 1);
  });
  test("memoize should memoize getters", () => {
    class Foo {
      constructor(_answer) {
        this._answer = _answer;
        this.count = 0;
      }
      get answer() {
        this.count++;
        return this._answer;
      }
    }
    __decorateClass([
      memoize
    ], Foo.prototype, "answer", 1);
    const foo = new Foo(42);
    assert.strictEqual(foo.count, 0);
    assert.strictEqual(foo.answer, 42);
    assert.strictEqual(foo.count, 1);
    assert.strictEqual(foo.answer, 42);
    assert.strictEqual(foo.count, 1);
    const foo2 = new Foo(1337);
    assert.strictEqual(foo2.count, 0);
    assert.strictEqual(foo2.answer, 1337);
    assert.strictEqual(foo2.count, 1);
    assert.strictEqual(foo2.answer, 1337);
    assert.strictEqual(foo2.count, 1);
    assert.strictEqual(foo.answer, 42);
    assert.strictEqual(foo.count, 1);
    const foo3 = new Foo(null);
    assert.strictEqual(foo3.count, 0);
    assert.strictEqual(foo3.answer, null);
    assert.strictEqual(foo3.count, 1);
    assert.strictEqual(foo3.answer, null);
    assert.strictEqual(foo3.count, 1);
    const foo4 = new Foo(void 0);
    assert.strictEqual(foo4.count, 0);
    assert.strictEqual(foo4.answer, void 0);
    assert.strictEqual(foo4.count, 1);
    assert.strictEqual(foo4.answer, void 0);
    assert.strictEqual(foo4.count, 1);
  });
  test("memoized property should not be enumerable", () => {
    class Foo {
      get answer() {
        return 42;
      }
    }
    __decorateClass([
      memoize
    ], Foo.prototype, "answer", 1);
    const foo = new Foo();
    assert.strictEqual(foo.answer, 42);
    assert(!Object.keys(foo).some((k) => /\$memoize\$/.test(k)));
  });
  test("memoized property should not be writable", () => {
    class Foo {
      get answer() {
        return 42;
      }
    }
    __decorateClass([
      memoize
    ], Foo.prototype, "answer", 1);
    const foo = new Foo();
    assert.strictEqual(foo.answer, 42);
    try {
      foo["$memoize$answer"] = 1337;
      assert(false);
    } catch (e) {
      assert.strictEqual(foo.answer, 42);
    }
  });
  test("throttle", () => {
    const spy = sinon.spy();
    const clock = sinon.useFakeTimers();
    try {
      class ThrottleTest {
        constructor(fn) {
          this._handle = fn;
        }
        report(p) {
          this._handle(p);
        }
      }
      __decorateClass([
        throttle(
          100,
          (a, b) => a + b,
          () => 0
        )
      ], ThrottleTest.prototype, "report", 1);
      const t = new ThrottleTest(spy);
      t.report(1);
      t.report(2);
      t.report(3);
      assert.deepStrictEqual(spy.args, [[1]]);
      clock.tick(200);
      assert.deepStrictEqual(spy.args, [[1], [5]]);
      spy.resetHistory();
      t.report(4);
      t.report(5);
      clock.tick(50);
      t.report(6);
      assert.deepStrictEqual(spy.args, [[4]]);
      clock.tick(60);
      assert.deepStrictEqual(spy.args, [[4], [11]]);
    } finally {
      clock.restore();
    }
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvY29tbW9uL2RlY29yYXRvcnMudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCAqIGFzIHNpbm9uIGZyb20gJ3Npbm9uJztcbmltcG9ydCB7IG1lbW9pemUsIHRocm90dGxlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2RlY29yYXRvcnMuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi91dGlscy5qcyc7XG5cbnN1aXRlKCdEZWNvcmF0b3JzJywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdtZW1vaXplIHNob3VsZCBtZW1vaXplIG1ldGhvZHMnLCAoKSA9PiB7XG5cdFx0Y2xhc3MgRm9vIHtcblx0XHRcdGNvdW50ID0gMDtcblxuXHRcdFx0Y29uc3RydWN0b3IocHJpdmF0ZSBfYW5zd2VyOiBudW1iZXIgfCBudWxsIHwgdW5kZWZpbmVkKSB7IH1cblxuXHRcdFx0QG1lbW9pemVcblx0XHRcdGFuc3dlcigpIHtcblx0XHRcdFx0dGhpcy5jb3VudCsrO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fYW5zd2VyO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGZvbyA9IG5ldyBGb28oNDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb28uY291bnQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb28uYW5zd2VyKCksIDQyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9vLmNvdW50LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9vLmFuc3dlcigpLCA0Mik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvby5jb3VudCwgMSk7XG5cblx0XHRjb25zdCBmb28yID0gbmV3IEZvbygxMzM3KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9vMi5jb3VudCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbzIuYW5zd2VyKCksIDEzMzcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb28yLmNvdW50LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9vMi5hbnN3ZXIoKSwgMTMzNyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbzIuY291bnQsIDEpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvby5hbnN3ZXIoKSwgNDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb28uY291bnQsIDEpO1xuXG5cdFx0Y29uc3QgZm9vMyA9IG5ldyBGb28obnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbzMuY291bnQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb28zLmFuc3dlcigpLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9vMy5jb3VudCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbzMuYW5zd2VyKCksIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb28zLmNvdW50LCAxKTtcblxuXHRcdGNvbnN0IGZvbzQgPSBuZXcgRm9vKHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbzQuY291bnQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb280LmFuc3dlcigpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb280LmNvdW50LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9vNC5hbnN3ZXIoKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9vNC5jb3VudCwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lbW9pemUgc2hvdWxkIG1lbW9pemUgZ2V0dGVycycsICgpID0+IHtcblx0XHRjbGFzcyBGb28ge1xuXHRcdFx0Y291bnQgPSAwO1xuXG5cdFx0XHRjb25zdHJ1Y3Rvcihwcml2YXRlIF9hbnN3ZXI6IG51bWJlciB8IG51bGwgfCB1bmRlZmluZWQpIHsgfVxuXG5cdFx0XHRAbWVtb2l6ZVxuXHRcdFx0Z2V0IGFuc3dlcigpIHtcblx0XHRcdFx0dGhpcy5jb3VudCsrO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fYW5zd2VyO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGZvbyA9IG5ldyBGb28oNDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb28uY291bnQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb28uYW5zd2VyLCA0Mik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvby5jb3VudCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvby5hbnN3ZXIsIDQyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9vLmNvdW50LCAxKTtcblxuXHRcdGNvbnN0IGZvbzIgPSBuZXcgRm9vKDEzMzcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb28yLmNvdW50LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9vMi5hbnN3ZXIsIDEzMzcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb28yLmNvdW50LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9vMi5hbnN3ZXIsIDEzMzcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb28yLmNvdW50LCAxKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb28uYW5zd2VyLCA0Mik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvby5jb3VudCwgMSk7XG5cblx0XHRjb25zdCBmb28zID0gbmV3IEZvbyhudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9vMy5jb3VudCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbzMuYW5zd2VyLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9vMy5jb3VudCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbzMuYW5zd2VyLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9vMy5jb3VudCwgMSk7XG5cblx0XHRjb25zdCBmb280ID0gbmV3IEZvbyh1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb280LmNvdW50LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9vNC5hbnN3ZXIsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbzQuY291bnQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb280LmFuc3dlciwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9vNC5jb3VudCwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lbW9pemVkIHByb3BlcnR5IHNob3VsZCBub3QgYmUgZW51bWVyYWJsZScsICgpID0+IHtcblx0XHRjbGFzcyBGb28ge1xuXHRcdFx0QG1lbW9pemVcblx0XHRcdGdldCBhbnN3ZXIoKSB7XG5cdFx0XHRcdHJldHVybiA0Mjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBmb28gPSBuZXcgRm9vKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvby5hbnN3ZXIsIDQyKTtcblxuXHRcdGFzc2VydCghT2JqZWN0LmtleXMoZm9vKS5zb21lKGsgPT4gL1xcJG1lbW9pemVcXCQvLnRlc3QoaykpKTtcblx0fSk7XG5cblx0dGVzdCgnbWVtb2l6ZWQgcHJvcGVydHkgc2hvdWxkIG5vdCBiZSB3cml0YWJsZScsICgpID0+IHtcblx0XHRjbGFzcyBGb28ge1xuXHRcdFx0QG1lbW9pemVcblx0XHRcdGdldCBhbnN3ZXIoKSB7XG5cdFx0XHRcdHJldHVybiA0Mjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBmb28gPSBuZXcgRm9vKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvby5hbnN3ZXIsIDQyKTtcblxuXHRcdHRyeSB7XG5cdFx0XHQoZm9vIGFzIGFueSlbJyRtZW1vaXplJGFuc3dlciddID0gMTMzNztcblx0XHRcdGFzc2VydChmYWxzZSk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvby5hbnN3ZXIsIDQyKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ3Rocm90dGxlJywgKCkgPT4ge1xuXHRcdGNvbnN0IHNweSA9IHNpbm9uLnNweSgpO1xuXHRcdGNvbnN0IGNsb2NrID0gc2lub24udXNlRmFrZVRpbWVycygpO1xuXHRcdHRyeSB7XG5cdFx0XHRjbGFzcyBUaHJvdHRsZVRlc3Qge1xuXHRcdFx0XHRwcml2YXRlIF9oYW5kbGU6IEZ1bmN0aW9uO1xuXG5cdFx0XHRcdGNvbnN0cnVjdG9yKGZuOiBGdW5jdGlvbikge1xuXHRcdFx0XHRcdHRoaXMuX2hhbmRsZSA9IGZuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0QHRocm90dGxlKFxuXHRcdFx0XHRcdDEwMCxcblx0XHRcdFx0XHQoYTogbnVtYmVyLCBiOiBudW1iZXIpID0+IGEgKyBiLFxuXHRcdFx0XHRcdCgpID0+IDBcblx0XHRcdFx0KVxuXHRcdFx0XHRyZXBvcnQocDogbnVtYmVyKTogdm9pZCB7XG5cdFx0XHRcdFx0dGhpcy5faGFuZGxlKHApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHQgPSBuZXcgVGhyb3R0bGVUZXN0KHNweSk7XG5cblx0XHRcdHQucmVwb3J0KDEpO1xuXHRcdFx0dC5yZXBvcnQoMik7XG5cdFx0XHR0LnJlcG9ydCgzKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3B5LmFyZ3MsIFtbMV1dKTtcblxuXHRcdFx0Y2xvY2sudGljaygyMDApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzcHkuYXJncywgW1sxXSwgWzVdXSk7XG5cdFx0XHRzcHkucmVzZXRIaXN0b3J5KCk7XG5cblx0XHRcdHQucmVwb3J0KDQpO1xuXHRcdFx0dC5yZXBvcnQoNSk7XG5cdFx0XHRjbG9jay50aWNrKDUwKTtcblx0XHRcdHQucmVwb3J0KDYpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNweS5hcmdzLCBbWzRdXSk7XG5cdFx0XHRjbG9jay50aWNrKDYwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3B5LmFyZ3MsIFtbNF0sIFsxMV1dKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Y2xvY2sucmVzdG9yZSgpO1xuXHRcdH1cblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7QUFLQSxPQUFPLFlBQVk7QUFDbkIsWUFBWSxXQUFXO0FBQ3ZCLFNBQVMsU0FBUyxnQkFBZ0I7QUFDbEMsU0FBUywrQ0FBK0M7QUFFeEQsTUFBTSxjQUFjLE1BQU07QUFDekIsMENBQXdDO0FBRXhDLE9BQUssa0NBQWtDLE1BQU07QUFBQSxJQUM1QyxNQUFNLElBQUk7QUFBQSxNQUdULFlBQW9CLFNBQW9DO0FBQXBDO0FBRnBCLHFCQUFRO0FBQUEsTUFFa0Q7QUFBQSxNQUcxRCxTQUFTO0FBQ1IsYUFBSztBQUNMLGVBQU8sS0FBSztBQUFBLE1BQ2I7QUFBQSxJQUNEO0FBSkM7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
