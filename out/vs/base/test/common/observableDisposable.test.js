import assert from "assert";
import { spy } from "sinon";
import { wait, waitRandom } from "./testUtils.js";
import { Disposable } from "../../common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "./utils.js";
import { assertNotDisposed, ObservableDisposable } from "../../common/observableDisposable.js";
suite("ObservableDisposable", () => {
  const disposables = ensureNoDisposablesAreLeakedInTestSuite();
  test("tracks `disposed` state", () => {
    const object = new class extends ObservableDisposable {
    }();
    disposables.add(object);
    assert(
      object instanceof ObservableDisposable,
      "Object must be instance of ObservableDisposable."
    );
    assert(
      object instanceof Disposable,
      "Object must be instance of Disposable."
    );
    assert(
      !object.disposed,
      "Object must not be disposed yet."
    );
    object.dispose();
    assert(
      object.disposed,
      "Object must be disposed."
    );
  });
  suite("onDispose", () => {
    test("fires the event on dispose", async () => {
      const object = new class extends ObservableDisposable {
      }();
      disposables.add(object);
      assert(
        !object.disposed,
        "Object must not be disposed yet."
      );
      const onDisposeSpy = spy(() => {
      });
      object.onDispose(onDisposeSpy);
      assert(
        onDisposeSpy.notCalled,
        "`onDispose` callback must not be called yet."
      );
      await waitRandom(10);
      assert(
        onDisposeSpy.notCalled,
        "`onDispose` callback must not be called yet."
      );
      object.dispose();
      await wait(1);
      assert(
        object.disposed,
        "Object must be disposed."
      );
      assert(
        onDisposeSpy.calledOnce,
        "`onDispose` callback must be called."
      );
      object.dispose();
      object.dispose();
      await waitRandom(10);
      object.dispose();
      assert(
        onDisposeSpy.calledOnce,
        "`onDispose` callback must not be called again."
      );
      assert(
        object.disposed,
        "Object must be disposed."
      );
    });
    test("executes callback immediately if already disposed", async () => {
      const object = new class extends ObservableDisposable {
      }();
      disposables.add(object);
      object.dispose();
      await wait(1);
      const onDisposeSpy = spy(() => {
      });
      object.onDispose(onDisposeSpy);
      assert(
        onDisposeSpy.calledOnce,
        "`onDispose` callback must be called immediately."
      );
      await waitRandom(10);
      object.onDispose(onDisposeSpy);
      assert(
        onDisposeSpy.calledTwice,
        "`onDispose` callback must be called immediately the second time."
      );
      object.dispose();
      await wait(1);
      assert(
        onDisposeSpy.calledTwice,
        "`onDispose` callback must not be called again on dispose."
      );
    });
  });
  suite("asserts", () => {
    test("not disposed (method)", async () => {
      const object = new class extends ObservableDisposable {
      }();
      disposables.add(object);
      assert.doesNotThrow(() => {
        object.assertNotDisposed("Object must not be disposed.");
      });
      await waitRandom(10);
      assert.doesNotThrow(() => {
        object.assertNotDisposed("Object must not be disposed.");
      });
      object.dispose();
      await wait(1);
      assert.throws(() => {
        object.assertNotDisposed("Object must not be disposed.");
      });
      await waitRandom(10);
      assert.throws(() => {
        object.assertNotDisposed("Object must not be disposed.");
      });
    });
    test("not disposed (function)", async () => {
      const object = new class extends ObservableDisposable {
      }();
      disposables.add(object);
      assert.doesNotThrow(() => {
        assertNotDisposed(
          object,
          "Object must not be disposed."
        );
      });
      await waitRandom(10);
      assert.doesNotThrow(() => {
        assertNotDisposed(
          object,
          "Object must not be disposed."
        );
      });
      object.dispose();
      await wait(1);
      assert.throws(() => {
        assertNotDisposed(
          object,
          "Object must not be disposed."
        );
      });
      await waitRandom(10);
      assert.throws(() => {
        assertNotDisposed(
          object,
          "Object must not be disposed."
        );
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvY29tbW9uL29ic2VydmFibGVEaXNwb3NhYmxlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgc3B5IH0gZnJvbSAnc2lub24nO1xuaW1wb3J0IHsgd2FpdCwgd2FpdFJhbmRvbSB9IGZyb20gJy4vdGVzdFV0aWxzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4vdXRpbHMuanMnO1xuaW1wb3J0IHsgYXNzZXJ0Tm90RGlzcG9zZWQsIE9ic2VydmFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vY29tbW9uL29ic2VydmFibGVEaXNwb3NhYmxlLmpzJztcblxuc3VpdGUoJ09ic2VydmFibGVEaXNwb3NhYmxlJywgKCkgPT4ge1xuXHRjb25zdCBkaXNwb3NhYmxlcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ3RyYWNrcyBgZGlzcG9zZWRgIHN0YXRlJywgKCkgPT4ge1xuXHRcdC8vIHRoaXMgaXMgYW4gYWJzdHJhY3QgY2xhc3MsIHNvIHdlIGhhdmUgdG8gY3JlYXRlXG5cdFx0Ly8gYW4gYW5vbnltb3VzIGNsYXNzIHRoYXQgZXh0ZW5kcyBpdFxuXHRcdGNvbnN0IG9iamVjdCA9IG5ldyBjbGFzcyBleHRlbmRzIE9ic2VydmFibGVEaXNwb3NhYmxlIHsgfSgpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChvYmplY3QpO1xuXG5cdFx0YXNzZXJ0KFxuXHRcdFx0b2JqZWN0IGluc3RhbmNlb2YgT2JzZXJ2YWJsZURpc3Bvc2FibGUsXG5cdFx0XHQnT2JqZWN0IG11c3QgYmUgaW5zdGFuY2Ugb2YgT2JzZXJ2YWJsZURpc3Bvc2FibGUuJyxcblx0XHQpO1xuXG5cdFx0YXNzZXJ0KFxuXHRcdFx0b2JqZWN0IGluc3RhbmNlb2YgRGlzcG9zYWJsZSxcblx0XHRcdCdPYmplY3QgbXVzdCBiZSBpbnN0YW5jZSBvZiBEaXNwb3NhYmxlLicsXG5cdFx0KTtcblxuXHRcdGFzc2VydChcblx0XHRcdCFvYmplY3QuZGlzcG9zZWQsXG5cdFx0XHQnT2JqZWN0IG11c3Qgbm90IGJlIGRpc3Bvc2VkIHlldC4nLFxuXHRcdCk7XG5cblx0XHRvYmplY3QuZGlzcG9zZSgpO1xuXG5cdFx0YXNzZXJ0KFxuXHRcdFx0b2JqZWN0LmRpc3Bvc2VkLFxuXHRcdFx0J09iamVjdCBtdXN0IGJlIGRpc3Bvc2VkLicsXG5cdFx0KTtcblx0fSk7XG5cblx0c3VpdGUoJ29uRGlzcG9zZScsICgpID0+IHtcblx0XHR0ZXN0KCdmaXJlcyB0aGUgZXZlbnQgb24gZGlzcG9zZScsIGFzeW5jICgpID0+IHtcblx0XHRcdC8vIHRoaXMgaXMgYW4gYWJzdHJhY3QgY2xhc3MsIHNvIHdlIGhhdmUgdG8gY3JlYXRlXG5cdFx0XHQvLyBhbiBhbm9ueW1vdXMgY2xhc3MgdGhhdCBleHRlbmRzIGl0XG5cdFx0XHRjb25zdCBvYmplY3QgPSBuZXcgY2xhc3MgZXh0ZW5kcyBPYnNlcnZhYmxlRGlzcG9zYWJsZSB7IH0oKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChvYmplY3QpO1xuXG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdCFvYmplY3QuZGlzcG9zZWQsXG5cdFx0XHRcdCdPYmplY3QgbXVzdCBub3QgYmUgZGlzcG9zZWQgeWV0LicsXG5cdFx0XHQpO1xuXG5cdFx0XHRjb25zdCBvbkRpc3Bvc2VTcHkgPSBzcHkoKCkgPT4geyB9KTtcblx0XHRcdG9iamVjdC5vbkRpc3Bvc2Uob25EaXNwb3NlU3B5KTtcblxuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRvbkRpc3Bvc2VTcHkubm90Q2FsbGVkLFxuXHRcdFx0XHQnYG9uRGlzcG9zZWAgY2FsbGJhY2sgbXVzdCBub3QgYmUgY2FsbGVkIHlldC4nLFxuXHRcdFx0KTtcblxuXHRcdFx0YXdhaXQgd2FpdFJhbmRvbSgxMCk7XG5cblx0XHRcdGFzc2VydChcblx0XHRcdFx0b25EaXNwb3NlU3B5Lm5vdENhbGxlZCxcblx0XHRcdFx0J2BvbkRpc3Bvc2VgIGNhbGxiYWNrIG11c3Qgbm90IGJlIGNhbGxlZCB5ZXQuJyxcblx0XHRcdCk7XG5cblx0XHRcdC8vIGRpc3Bvc2Ugb2JqZWN0IGFuZCB3YWl0IGZvciB0aGUgZXZlbnQgdG8gYmUgZmlyZWQvcmVjZWl2ZWRcblx0XHRcdG9iamVjdC5kaXNwb3NlKCk7XG5cdFx0XHRhd2FpdCB3YWl0KDEpO1xuXG5cdFx0XHQvKipcblx0XHRcdCAqIFZhbGlkYXRlIHRoYXQgdGhlIGNhbGxiYWNrIHdhcyBjYWxsZWQuXG5cdFx0XHQgKi9cblxuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRvYmplY3QuZGlzcG9zZWQsXG5cdFx0XHRcdCdPYmplY3QgbXVzdCBiZSBkaXNwb3NlZC4nLFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRvbkRpc3Bvc2VTcHkuY2FsbGVkT25jZSxcblx0XHRcdFx0J2BvbkRpc3Bvc2VgIGNhbGxiYWNrIG11c3QgYmUgY2FsbGVkLicsXG5cdFx0XHQpO1xuXG5cdFx0XHQvKipcblx0XHRcdCAqIFZhbGlkYXRlIHRoYXQgdGhlIGNhbGxiYWNrIGlzIG5vdCBjYWxsZWQgYWdhaW4uXG5cdFx0XHQgKi9cblxuXHRcdFx0b2JqZWN0LmRpc3Bvc2UoKTtcblx0XHRcdG9iamVjdC5kaXNwb3NlKCk7XG5cdFx0XHRhd2FpdCB3YWl0UmFuZG9tKDEwKTtcblx0XHRcdG9iamVjdC5kaXNwb3NlKCk7XG5cblx0XHRcdGFzc2VydChcblx0XHRcdFx0b25EaXNwb3NlU3B5LmNhbGxlZE9uY2UsXG5cdFx0XHRcdCdgb25EaXNwb3NlYCBjYWxsYmFjayBtdXN0IG5vdCBiZSBjYWxsZWQgYWdhaW4uJyxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydChcblx0XHRcdFx0b2JqZWN0LmRpc3Bvc2VkLFxuXHRcdFx0XHQnT2JqZWN0IG11c3QgYmUgZGlzcG9zZWQuJyxcblx0XHRcdCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdleGVjdXRlcyBjYWxsYmFjayBpbW1lZGlhdGVseSBpZiBhbHJlYWR5IGRpc3Bvc2VkJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Ly8gdGhpcyBpcyBhbiBhYnN0cmFjdCBjbGFzcywgc28gd2UgaGF2ZSB0byBjcmVhdGVcblx0XHRcdC8vIGFuIGFub255bW91cyBjbGFzcyB0aGF0IGV4dGVuZHMgaXRcblx0XHRcdGNvbnN0IG9iamVjdCA9IG5ldyBjbGFzcyBleHRlbmRzIE9ic2VydmFibGVEaXNwb3NhYmxlIHsgfSgpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKG9iamVjdCk7XG5cblx0XHRcdC8vIGRpc3Bvc2Ugb2JqZWN0IGFuZCB3YWl0IGZvciB0aGUgZXZlbnQgdG8gYmUgZmlyZWQvcmVjZWl2ZWRcblx0XHRcdG9iamVjdC5kaXNwb3NlKCk7XG5cdFx0XHRhd2FpdCB3YWl0KDEpO1xuXG5cdFx0XHRjb25zdCBvbkRpc3Bvc2VTcHkgPSBzcHkoKCkgPT4geyB9KTtcblx0XHRcdG9iamVjdC5vbkRpc3Bvc2Uob25EaXNwb3NlU3B5KTtcblxuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRvbkRpc3Bvc2VTcHkuY2FsbGVkT25jZSxcblx0XHRcdFx0J2BvbkRpc3Bvc2VgIGNhbGxiYWNrIG11c3QgYmUgY2FsbGVkIGltbWVkaWF0ZWx5LicsXG5cdFx0XHQpO1xuXG5cdFx0XHRhd2FpdCB3YWl0UmFuZG9tKDEwKTtcblxuXHRcdFx0b2JqZWN0Lm9uRGlzcG9zZShvbkRpc3Bvc2VTcHkpO1xuXG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdG9uRGlzcG9zZVNweS5jYWxsZWRUd2ljZSxcblx0XHRcdFx0J2BvbkRpc3Bvc2VgIGNhbGxiYWNrIG11c3QgYmUgY2FsbGVkIGltbWVkaWF0ZWx5IHRoZSBzZWNvbmQgdGltZS4nLFxuXHRcdFx0KTtcblxuXHRcdFx0Ly8gZGlzcG9zZSBvYmplY3QgYW5kIHdhaXQgZm9yIHRoZSBldmVudCB0byBiZSBmaXJlZC9yZWNlaXZlZFxuXHRcdFx0b2JqZWN0LmRpc3Bvc2UoKTtcblx0XHRcdGF3YWl0IHdhaXQoMSk7XG5cblx0XHRcdGFzc2VydChcblx0XHRcdFx0b25EaXNwb3NlU3B5LmNhbGxlZFR3aWNlLFxuXHRcdFx0XHQnYG9uRGlzcG9zZWAgY2FsbGJhY2sgbXVzdCBub3QgYmUgY2FsbGVkIGFnYWluIG9uIGRpc3Bvc2UuJyxcblx0XHRcdCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdhc3NlcnRzJywgKCkgPT4ge1xuXHRcdHRlc3QoJ25vdCBkaXNwb3NlZCAobWV0aG9kKScsIGFzeW5jICgpID0+IHtcblx0XHRcdC8vIHRoaXMgaXMgYW4gYWJzdHJhY3QgY2xhc3MsIHNvIHdlIGhhdmUgdG8gY3JlYXRlXG5cdFx0XHQvLyBhbiBhbm9ueW1vdXMgY2xhc3MgdGhhdCBleHRlbmRzIGl0XG5cdFx0XHRjb25zdCBvYmplY3Q6IE9ic2VydmFibGVEaXNwb3NhYmxlID0gbmV3IGNsYXNzIGV4dGVuZHMgT2JzZXJ2YWJsZURpc3Bvc2FibGUgeyB9KCk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQob2JqZWN0KTtcblxuXHRcdFx0YXNzZXJ0LmRvZXNOb3RUaHJvdygoKSA9PiB7XG5cdFx0XHRcdG9iamVjdC5hc3NlcnROb3REaXNwb3NlZCgnT2JqZWN0IG11c3Qgbm90IGJlIGRpc3Bvc2VkLicpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGF3YWl0IHdhaXRSYW5kb20oMTApO1xuXG5cdFx0XHRhc3NlcnQuZG9lc05vdFRocm93KCgpID0+IHtcblx0XHRcdFx0b2JqZWN0LmFzc2VydE5vdERpc3Bvc2VkKCdPYmplY3QgbXVzdCBub3QgYmUgZGlzcG9zZWQuJyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gZGlzcG9zZSBvYmplY3QgYW5kIHdhaXQgZm9yIHRoZSBldmVudCB0byBiZSBmaXJlZC9yZWNlaXZlZFxuXHRcdFx0b2JqZWN0LmRpc3Bvc2UoKTtcblx0XHRcdGF3YWl0IHdhaXQoMSk7XG5cblx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRvYmplY3QuYXNzZXJ0Tm90RGlzcG9zZWQoJ09iamVjdCBtdXN0IG5vdCBiZSBkaXNwb3NlZC4nKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRhd2FpdCB3YWl0UmFuZG9tKDEwKTtcblxuXHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRcdG9iamVjdC5hc3NlcnROb3REaXNwb3NlZCgnT2JqZWN0IG11c3Qgbm90IGJlIGRpc3Bvc2VkLicpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdub3QgZGlzcG9zZWQgKGZ1bmN0aW9uKScsIGFzeW5jICgpID0+IHtcblx0XHRcdC8vIHRoaXMgaXMgYW4gYWJzdHJhY3QgY2xhc3MsIHNvIHdlIGhhdmUgdG8gY3JlYXRlXG5cdFx0XHQvLyBhbiBhbm9ueW1vdXMgY2xhc3MgdGhhdCBleHRlbmRzIGl0XG5cdFx0XHRjb25zdCBvYmplY3Q6IE9ic2VydmFibGVEaXNwb3NhYmxlID0gbmV3IGNsYXNzIGV4dGVuZHMgT2JzZXJ2YWJsZURpc3Bvc2FibGUgeyB9KCk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQob2JqZWN0KTtcblxuXHRcdFx0YXNzZXJ0LmRvZXNOb3RUaHJvdygoKSA9PiB7XG5cdFx0XHRcdGFzc2VydE5vdERpc3Bvc2VkKFxuXHRcdFx0XHRcdG9iamVjdCxcblx0XHRcdFx0XHQnT2JqZWN0IG11c3Qgbm90IGJlIGRpc3Bvc2VkLicsXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0YXdhaXQgd2FpdFJhbmRvbSgxMCk7XG5cblx0XHRcdGFzc2VydC5kb2VzTm90VGhyb3coKCkgPT4ge1xuXHRcdFx0XHRhc3NlcnROb3REaXNwb3NlZChcblx0XHRcdFx0XHRvYmplY3QsXG5cdFx0XHRcdFx0J09iamVjdCBtdXN0IG5vdCBiZSBkaXNwb3NlZC4nLFxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIGRpc3Bvc2Ugb2JqZWN0IGFuZCB3YWl0IGZvciB0aGUgZXZlbnQgdG8gYmUgZmlyZWQvcmVjZWl2ZWRcblx0XHRcdG9iamVjdC5kaXNwb3NlKCk7XG5cdFx0XHRhd2FpdCB3YWl0KDEpO1xuXG5cdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0YXNzZXJ0Tm90RGlzcG9zZWQoXG5cdFx0XHRcdFx0b2JqZWN0LFxuXHRcdFx0XHRcdCdPYmplY3QgbXVzdCBub3QgYmUgZGlzcG9zZWQuJyxcblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRhd2FpdCB3YWl0UmFuZG9tKDEwKTtcblxuXHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRcdGFzc2VydE5vdERpc3Bvc2VkKFxuXHRcdFx0XHRcdG9iamVjdCxcblx0XHRcdFx0XHQnT2JqZWN0IG11c3Qgbm90IGJlIGRpc3Bvc2VkLicsXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUlBLE9BQU8sWUFBWTtBQUNuQixTQUFTLFdB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
