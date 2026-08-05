import assert from "assert";
import { spy } from "sinon";
import { ObjectCache } from "../../common/objectCache.js";
import { wait } from "../../../base/test/common/testUtils.js";
import { ObservableDisposable } from "../../common/observableDisposable.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../base/test/common/utils.js";
class TestObject extends ObservableDisposable {
  constructor(ID) {
    super();
    this.ID = ID;
  }
  /**
   * Check if this object is equal to another one.
   */
  equal(other) {
    return this.ID === other.ID;
  }
}
suite("ObjectCache", function() {
  const disposables = ensureNoDisposablesAreLeakedInTestSuite();
  suite("get", () => {
    const testCoreLogic = async (key1, key2) => {
      const factory = spy((key) => {
        const result = new TestObject(key);
        result.assertNotDisposed(
          "Object must not be disposed."
        );
        return result;
      });
      const cache = disposables.add(new ObjectCache(factory));
      const obj1 = cache.get(key1);
      assert(
        factory.calledOnceWithExactly(key1),
        "[obj1] Must be called once with the correct arguments."
      );
      assert(
        obj1.ID === key1,
        "[obj1] Returned object must have the correct ID."
      );
      const obj2 = cache.get(key1);
      assert(
        factory.calledOnceWithExactly(key1),
        "[obj2] Must be called once with the correct arguments."
      );
      assert(
        obj2.ID === key1,
        "[obj2] Returned object must have the correct ID."
      );
      assert(
        obj1 === obj2 && obj1.equal(obj2),
        "[obj2] Returned object must be the same instance."
      );
      factory.resetHistory();
      const obj3 = cache.get(key2);
      assert(
        factory.calledOnceWithExactly(key2),
        "[obj3] Must be called once with the correct arguments."
      );
      assert(
        obj3.ID === key2,
        "[obj3] Returned object must have the correct ID."
      );
      factory.resetHistory();
      const obj4 = cache.get(key1);
      assert(
        factory.notCalled,
        "[obj4] Factory must not be called."
      );
      assert(
        obj4.ID === key1,
        "[obj4] Returned object must have the correct ID."
      );
      assert(
        obj1 === obj4 && obj1.equal(obj4),
        "[obj4] Returned object must be the same instance."
      );
      factory.resetHistory();
      obj3.dispose();
      await wait(5);
      const obj5 = cache.get(key1);
      assert(
        factory.notCalled,
        "[obj5] Factory must not be called."
      );
      assert(
        obj5.ID === key1,
        "[obj5] Returned object must have the correct ID."
      );
      assert(
        obj1 === obj5 && obj1.equal(obj5),
        "[obj5] Returned object must be the same instance."
      );
      factory.resetHistory();
      const obj6 = cache.get(key2);
      assert(
        factory.calledOnceWithExactly(key2),
        "[obj6] Must be called once with the correct arguments."
      );
      assert(
        obj6.ID === key2,
        "[obj6] Returned object must have the correct ID."
      );
    };
    test("strings as keys", async function() {
      await testCoreLogic("key1", "key2");
    });
    test("numbers as keys", async function() {
      await testCoreLogic(10, 17065);
    });
    test("objects as keys", async function() {
      await testCoreLogic(
        disposables.add(new TestObject({})),
        disposables.add(new TestObject({}))
      );
    });
  });
  suite("remove", () => {
    const testRemoveLogic = async (key1, key2, disposeOnRemove) => {
      const factory = spy((key) => {
        const result = new TestObject(key);
        result.assertNotDisposed(
          "Object must not be disposed."
        );
        return result;
      });
      const cache = disposables.add(new ObjectCache(factory));
      const obj1 = cache.get(key1);
      assert(
        factory.calledOnceWithExactly(key1),
        "[obj1] Must be called once with the correct arguments."
      );
      assert(
        obj1.ID === key1,
        "[obj1] Returned object must have the correct ID."
      );
      factory.resetHistory();
      const obj2 = cache.get(key2);
      assert(
        factory.calledOnceWithExactly(key2),
        "[obj2] Must be called once with the correct arguments."
      );
      assert(
        obj2.ID === key2,
        "[obj2] Returned object must have the correct ID."
      );
      cache.remove(key2, disposeOnRemove);
      const object2Disposed = obj2.disposed;
      if (!obj2.disposed) {
        obj2.dispose();
      }
      assert(
        object2Disposed === disposeOnRemove,
        `[obj2] Removed object must be disposed: ${disposeOnRemove}.`
      );
      factory.resetHistory();
      assert(
        !obj1.disposed,
        "[obj1] Object must not be disposed."
      );
      const obj3 = cache.get(key1);
      assert(
        factory.notCalled,
        "[obj3] Factory must not be called."
      );
      assert(
        obj3.ID === key1,
        "[obj3] Returned object must have the correct ID."
      );
      assert(
        obj1 === obj3 && obj1.equal(obj3),
        "[obj3] Returned object must be the same instance."
      );
      factory.resetHistory();
    };
    test("strings as keys", async function() {
      await testRemoveLogic("key1", "key2", false);
      await testRemoveLogic("some-key", "another-key", true);
    });
    test("numbers as keys", async function() {
      await testRemoveLogic(7, 2400700, false);
      await testRemoveLogic(1090, 2654, true);
    });
    test("objects as keys", async function() {
      await testRemoveLogic(
        disposables.add(new TestObject(1)),
        disposables.add(new TestObject(1)),
        false
      );
      await testRemoveLogic(
        disposables.add(new TestObject(2)),
        disposables.add(new TestObject(2)),
        true
      );
    });
  });
  test("throws if factory returns a disposed object", async function() {
    const factory = (key) => {
      const result = new TestObject(key);
      if (key === "key2") {
        result.dispose();
      }
      return result;
    };
    const cache = disposables.add(new ObjectCache(factory));
    assert.doesNotThrow(() => {
      cache.get("key1");
    });
    assert.throws(() => {
      cache.get("key2");
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvY29tbW9uL29iamVjdENhY2hlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBzcHkgfSBmcm9tICdzaW5vbic7XG5pbXBvcnQgeyBPYmplY3RDYWNoZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9vYmplY3RDYWNoZS5qcyc7XG5pbXBvcnQgeyB3YWl0IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi90ZXN0VXRpbHMuanMnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi9jb21tb24vb2JzZXJ2YWJsZURpc3Bvc2FibGUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cbi8qKlxuICogVGVzdCBvYmplY3QgY2xhc3MuXG4gKi9cbmNsYXNzIFRlc3RPYmplY3Q8VEtleSBleHRlbmRzIE5vbk51bGxhYmxlPHVua25vd24+ID0gc3RyaW5nPiBleHRlbmRzIE9ic2VydmFibGVEaXNwb3NhYmxlIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IElEOiBUS2V5LFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENoZWNrIGlmIHRoaXMgb2JqZWN0IGlzIGVxdWFsIHRvIGFub3RoZXIgb25lLlxuXHQgKi9cblx0cHVibGljIGVxdWFsKG90aGVyOiBUZXN0T2JqZWN0PE5vbk51bGxhYmxlPHVua25vd24+Pik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLklEID09PSBvdGhlci5JRDtcblx0fVxufVxuXG5zdWl0ZSgnT2JqZWN0Q2FjaGUnLCBmdW5jdGlvbiAoKSB7XG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0c3VpdGUoJ2dldCcsICgpID0+IHtcblx0XHQvKipcblx0XHQgKiBDb21tb24gdGVzdCBmdW50aW9uIHRvIHRlc3QgY29yZSBsb2dpYyBvZiB0aGUgY2FjaGVcblx0XHQgKiB3aXRoIHByb3ZpZGVyIHRlc3QgSUQga2V5cyBvZiBzb21lIHNwZWNpZmljIHR5cGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ga2V5MSBUZXN0IGtleTEuXG5cdFx0ICogQHBhcmFtIGtleTIgVGVzdCBrZXkyLlxuXHRcdCAqL1xuXHRcdGNvbnN0IHRlc3RDb3JlTG9naWMgPSBhc3luYyA8VEtleSBleHRlbmRzIE5vbk51bGxhYmxlPHVua25vd24+PihrZXkxOiBUS2V5LCBrZXkyOiBUS2V5KSA9PiB7XG5cdFx0XHRjb25zdCBmYWN0b3J5ID0gc3B5KChcblx0XHRcdFx0a2V5OiBUS2V5LFxuXHRcdFx0KSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdDogVGVzdE9iamVjdDxUS2V5PiA9IG5ldyBUZXN0T2JqZWN0KGtleSk7XG5cblx0XHRcdFx0cmVzdWx0LmFzc2VydE5vdERpc3Bvc2VkKFxuXHRcdFx0XHRcdCdPYmplY3QgbXVzdCBub3QgYmUgZGlzcG9zZWQuJyxcblx0XHRcdFx0KTtcblxuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IGNhY2hlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBPYmplY3RDYWNoZShmYWN0b3J5KSk7XG5cblx0XHRcdC8qKlxuXHRcdFx0ICogVGVzdCB0aGUgY29yZSBsb2dpYyBvZiB0aGUgY2FjaGUgdXNpbmcgMiBvYmplY3RzLlxuXHRcdFx0ICovXG5cblx0XHRcdGNvbnN0IG9iajEgPSBjYWNoZS5nZXQoa2V5MSk7XG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdGZhY3RvcnkuY2FsbGVkT25jZVdpdGhFeGFjdGx5KGtleTEpLFxuXHRcdFx0XHQnW29iajFdIE11c3QgYmUgY2FsbGVkIG9uY2Ugd2l0aCB0aGUgY29ycmVjdCBhcmd1bWVudHMuJyxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydChcblx0XHRcdFx0b2JqMS5JRCA9PT0ga2V5MSxcblx0XHRcdFx0J1tvYmoxXSBSZXR1cm5lZCBvYmplY3QgbXVzdCBoYXZlIHRoZSBjb3JyZWN0IElELicsXG5cdFx0XHQpO1xuXG5cdFx0XHRjb25zdCBvYmoyID0gY2FjaGUuZ2V0KGtleTEpO1xuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRmYWN0b3J5LmNhbGxlZE9uY2VXaXRoRXhhY3RseShrZXkxKSxcblx0XHRcdFx0J1tvYmoyXSBNdXN0IGJlIGNhbGxlZCBvbmNlIHdpdGggdGhlIGNvcnJlY3QgYXJndW1lbnRzLicsXG5cdFx0XHQpO1xuXG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdG9iajIuSUQgPT09IGtleTEsXG5cdFx0XHRcdCdbb2JqMl0gUmV0dXJuZWQgb2JqZWN0IG11c3QgaGF2ZSB0aGUgY29ycmVjdCBJRC4nLFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRvYmoxID09PSBvYmoyICYmIG9iajEuZXF1YWwob2JqMiksXG5cdFx0XHRcdCdbb2JqMl0gUmV0dXJuZWQgb2JqZWN0IG11c3QgYmUgdGhlIHNhbWUgaW5zdGFuY2UuJyxcblx0XHRcdCk7XG5cblx0XHRcdGZhY3RvcnkucmVzZXRIaXN0b3J5KCk7XG5cblx0XHRcdGNvbnN0IG9iajMgPSBjYWNoZS5nZXQoa2V5Mik7XG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdGZhY3RvcnkuY2FsbGVkT25jZVdpdGhFeGFjdGx5KGtleTIpLFxuXHRcdFx0XHQnW29iajNdIE11c3QgYmUgY2FsbGVkIG9uY2Ugd2l0aCB0aGUgY29ycmVjdCBhcmd1bWVudHMuJyxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydChcblx0XHRcdFx0b2JqMy5JRCA9PT0ga2V5Mixcblx0XHRcdFx0J1tvYmozXSBSZXR1cm5lZCBvYmplY3QgbXVzdCBoYXZlIHRoZSBjb3JyZWN0IElELicsXG5cdFx0XHQpO1xuXG5cdFx0XHRmYWN0b3J5LnJlc2V0SGlzdG9yeSgpO1xuXG5cdFx0XHRjb25zdCBvYmo0ID0gY2FjaGUuZ2V0KGtleTEpO1xuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRmYWN0b3J5Lm5vdENhbGxlZCxcblx0XHRcdFx0J1tvYmo0XSBGYWN0b3J5IG11c3Qgbm90IGJlIGNhbGxlZC4nLFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRvYmo0LklEID09PSBrZXkxLFxuXHRcdFx0XHQnW29iajRdIFJldHVybmVkIG9iamVjdCBtdXN0IGhhdmUgdGhlIGNvcnJlY3QgSUQuJyxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydChcblx0XHRcdFx0b2JqMSA9PT0gb2JqNCAmJiBvYmoxLmVxdWFsKG9iajQpLFxuXHRcdFx0XHQnW29iajRdIFJldHVybmVkIG9iamVjdCBtdXN0IGJlIHRoZSBzYW1lIGluc3RhbmNlLicsXG5cdFx0XHQpO1xuXG5cdFx0XHRmYWN0b3J5LnJlc2V0SGlzdG9yeSgpO1xuXG5cdFx0XHQvKipcblx0XHRcdCAqIE5vdyB0ZXN0IHRoYXQgdGhlIG9iamVjdCBpcyByZW1vdmVkIGF1dG9tYXRpY2FsbHkgZnJvbVxuXHRcdFx0ICogdGhlIGNhY2hlIHdoZW4gaXQgaXMgZGlzcG9zZWQuXG5cdFx0XHQgKi9cblxuXHRcdFx0b2JqMy5kaXNwb3NlKCk7XG5cdFx0XHQvLyB0aGUgb2JqZWN0IGlzIHJlbW92ZWQgZnJvbSB0aGUgY2FjaGUgYXN5bmNocm9ub3VzbHlcblx0XHRcdC8vIHNvIGFkZCBhIHNtYWxsIGRlbGF5IHRvIGVuc3VyZSB0aGUgb2JqZWN0IGlzIHJlbW92ZWRcblx0XHRcdGF3YWl0IHdhaXQoNSk7XG5cblx0XHRcdGNvbnN0IG9iajUgPSBjYWNoZS5nZXQoa2V5MSk7XG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdGZhY3Rvcnkubm90Q2FsbGVkLFxuXHRcdFx0XHQnW29iajVdIEZhY3RvcnkgbXVzdCBub3QgYmUgY2FsbGVkLicsXG5cdFx0XHQpO1xuXG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdG9iajUuSUQgPT09IGtleTEsXG5cdFx0XHRcdCdbb2JqNV0gUmV0dXJuZWQgb2JqZWN0IG11c3QgaGF2ZSB0aGUgY29ycmVjdCBJRC4nLFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRvYmoxID09PSBvYmo1ICYmIG9iajEuZXF1YWwob2JqNSksXG5cdFx0XHRcdCdbb2JqNV0gUmV0dXJuZWQgb2JqZWN0IG11c3QgYmUgdGhlIHNhbWUgaW5zdGFuY2UuJyxcblx0XHRcdCk7XG5cblx0XHRcdGZhY3RvcnkucmVzZXRIaXN0b3J5KCk7XG5cblx0XHRcdC8qKlxuXHRcdFx0ICogVGVzdCB0aGF0IHRoZSBwcmV2aW91c2x5IGRpc3Bvc2VkIG9iamVjdCBpcyByZWNyZWF0ZWRcblx0XHRcdCAqIG9uIHRoZSBuZXcgcmV0cmlldmFsIGNhbGwuXG5cdFx0XHQgKi9cblxuXHRcdFx0Y29uc3Qgb2JqNiA9IGNhY2hlLmdldChrZXkyKTtcblx0XHRcdGFzc2VydChcblx0XHRcdFx0ZmFjdG9yeS5jYWxsZWRPbmNlV2l0aEV4YWN0bHkoa2V5MiksXG5cdFx0XHRcdCdbb2JqNl0gTXVzdCBiZSBjYWxsZWQgb25jZSB3aXRoIHRoZSBjb3JyZWN0IGFyZ3VtZW50cy4nLFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRvYmo2LklEID09PSBrZXkyLFxuXHRcdFx0XHQnW29iajZdIFJldHVybmVkIG9iamVjdCBtdXN0IGhhdmUgdGhlIGNvcnJlY3QgSUQuJyxcblx0XHRcdCk7XG5cdFx0fTtcblxuXHRcdHRlc3QoJ3N0cmluZ3MgYXMga2V5cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRcdGF3YWl0IHRlc3RDb3JlTG9naWMoJ2tleTEnLCAna2V5MicpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnbnVtYmVycyBhcyBrZXlzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdFx0YXdhaXQgdGVzdENvcmVMb2dpYygxMCwgMTcwNjUpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnb2JqZWN0cyBhcyBrZXlzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdFx0YXdhaXQgdGVzdENvcmVMb2dpYyhcblx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0T2JqZWN0KHt9KSksXG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdE9iamVjdCh7fSkpLFxuXHRcdFx0KTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ3JlbW92ZScsICgpID0+IHtcblx0XHQvKipcblx0XHQgKiBDb21tb24gdGVzdCBmdW50aW9uIHRvIHRlc3QgcmVtb3ZlIGxvZ2ljIG9mIHRoZSBjYWNoZVxuXHRcdCAqIHdpdGggcHJvdmlkZXIgdGVzdCBJRCBrZXlzIG9mIHNvbWUgc3BlY2lmaWMgdHlwZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSBrZXkxIFRlc3Qga2V5MS5cblx0XHQgKiBAcGFyYW0ga2V5MiBUZXN0IGtleTIuXG5cdFx0ICovXG5cdFx0Y29uc3QgdGVzdFJlbW92ZUxvZ2ljID0gYXN5bmMgPFRLZXkgZXh0ZW5kcyBOb25OdWxsYWJsZTx1bmtub3duPj4oXG5cdFx0XHRrZXkxOiBUS2V5LFxuXHRcdFx0a2V5MjogVEtleSxcblx0XHRcdGRpc3Bvc2VPblJlbW92ZTogYm9vbGVhbixcblx0XHQpID0+IHtcblx0XHRcdGNvbnN0IGZhY3RvcnkgPSBzcHkoKFxuXHRcdFx0XHRrZXk6IFRLZXksXG5cdFx0XHQpID0+IHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0OiBUZXN0T2JqZWN0PFRLZXk+ID0gbmV3IFRlc3RPYmplY3Qoa2V5KTtcblxuXHRcdFx0XHRyZXN1bHQuYXNzZXJ0Tm90RGlzcG9zZWQoXG5cdFx0XHRcdFx0J09iamVjdCBtdXN0IG5vdCBiZSBkaXNwb3NlZC4nLFxuXHRcdFx0XHQpO1xuXG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gT2JqZWN0Q2FjaGU8VGVzdE9iamVjdDxUS2V5PiwgVEtleT5cblx0XHRcdGNvbnN0IGNhY2hlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBPYmplY3RDYWNoZShmYWN0b3J5KSk7XG5cblx0XHRcdC8qKlxuXHRcdFx0ICogVGVzdCB0aGUgY29yZSBsb2dpYyBvZiB0aGUgY2FjaGUuXG5cdFx0XHQgKi9cblxuXHRcdFx0Y29uc3Qgb2JqMSA9IGNhY2hlLmdldChrZXkxKTtcblx0XHRcdGFzc2VydChcblx0XHRcdFx0ZmFjdG9yeS5jYWxsZWRPbmNlV2l0aEV4YWN0bHkoa2V5MSksXG5cdFx0XHRcdCdbb2JqMV0gTXVzdCBiZSBjYWxsZWQgb25jZSB3aXRoIHRoZSBjb3JyZWN0IGFyZ3VtZW50cy4nLFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRvYmoxLklEID09PSBrZXkxLFxuXHRcdFx0XHQnW29iajFdIFJldHVybmVkIG9iamVjdCBtdXN0IGhhdmUgdGhlIGNvcnJlY3QgSUQuJyxcblx0XHRcdCk7XG5cblx0XHRcdGZhY3RvcnkucmVzZXRIaXN0b3J5KCk7XG5cblx0XHRcdGNvbnN0IG9iajIgPSBjYWNoZS5nZXQoa2V5Mik7XG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdGZhY3RvcnkuY2FsbGVkT25jZVdpdGhFeGFjdGx5KGtleTIpLFxuXHRcdFx0XHQnW29iajJdIE11c3QgYmUgY2FsbGVkIG9uY2Ugd2l0aCB0aGUgY29ycmVjdCBhcmd1bWVudHMuJyxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydChcblx0XHRcdFx0b2JqMi5JRCA9PT0ga2V5Mixcblx0XHRcdFx0J1tvYmoyXSBSZXR1cm5lZCBvYmplY3QgbXVzdCBoYXZlIHRoZSBjb3JyZWN0IElELicsXG5cdFx0XHQpO1xuXG5cdFx0XHRjYWNoZS5yZW1vdmUoa2V5MiwgZGlzcG9zZU9uUmVtb3ZlKTtcblxuXHRcdFx0Y29uc3Qgb2JqZWN0MkRpc3Bvc2VkID0gb2JqMi5kaXNwb3NlZDtcblxuXHRcdFx0Ly8gZW5zdXJlIHdlIGRvbid0IGxlYWsgdW5kaXNwb3NlZCBvYmplY3QgaW4gdGhlIHRlc3RzXG5cdFx0XHRpZiAoIW9iajIuZGlzcG9zZWQpIHtcblx0XHRcdFx0b2JqMi5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cblx0XHRcdGFzc2VydChcblx0XHRcdFx0b2JqZWN0MkRpc3Bvc2VkID09PSBkaXNwb3NlT25SZW1vdmUsXG5cdFx0XHRcdGBbb2JqMl0gUmVtb3ZlZCBvYmplY3QgbXVzdCBiZSBkaXNwb3NlZDogJHtkaXNwb3NlT25SZW1vdmV9LmAsXG5cdFx0XHQpO1xuXG5cdFx0XHRmYWN0b3J5LnJlc2V0SGlzdG9yeSgpO1xuXG5cdFx0XHQvKipcblx0XHRcdCAqIFZhbGlkYXRlIHRoYXQgYW5vdGhlciBvYmplY3QgaXMgbm90IGRpc3Bvc2VkLlxuXHRcdFx0ICovXG5cblx0XHRcdGFzc2VydChcblx0XHRcdFx0IW9iajEuZGlzcG9zZWQsXG5cdFx0XHRcdCdbb2JqMV0gT2JqZWN0IG11c3Qgbm90IGJlIGRpc3Bvc2VkLicsXG5cdFx0XHQpO1xuXG5cdFx0XHRjb25zdCBvYmozID0gY2FjaGUuZ2V0KGtleTEpO1xuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRmYWN0b3J5Lm5vdENhbGxlZCxcblx0XHRcdFx0J1tvYmozXSBGYWN0b3J5IG11c3Qgbm90IGJlIGNhbGxlZC4nLFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRvYmozLklEID09PSBrZXkxLFxuXHRcdFx0XHQnW29iajNdIFJldHVybmVkIG9iamVjdCBtdXN0IGhhdmUgdGhlIGNvcnJlY3QgSUQuJyxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydChcblx0XHRcdFx0b2JqMSA9PT0gb2JqMyAmJiBvYmoxLmVxdWFsKG9iajMpLFxuXHRcdFx0XHQnW29iajNdIFJldHVybmVkIG9iamVjdCBtdXN0IGJlIHRoZSBzYW1lIGluc3RhbmNlLicsXG5cdFx0XHQpO1xuXG5cdFx0XHRmYWN0b3J5LnJlc2V0SGlzdG9yeSgpO1xuXHRcdH07XG5cblx0XHR0ZXN0KCdzdHJpbmdzIGFzIGtleXMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRhd2FpdCB0ZXN0UmVtb3ZlTG9naWMoJ2tleTEnLCAna2V5MicsIGZhbHNlKTtcblx0XHRcdGF3YWl0IHRlc3RSZW1vdmVMb2dpYygnc29tZS1rZXknLCAnYW5vdGhlci1rZXknLCB0cnVlKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ251bWJlcnMgYXMga2V5cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRcdGF3YWl0IHRlc3RSZW1vdmVMb2dpYyg3LCAyNDAwNzAwLCBmYWxzZSk7XG5cdFx0XHRhd2FpdCB0ZXN0UmVtb3ZlTG9naWMoMTA5MCwgMjY1NCwgdHJ1ZSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdvYmplY3RzIGFzIGtleXMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRhd2FpdCB0ZXN0UmVtb3ZlTG9naWMoXG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdE9iamVjdCgxKSksXG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdE9iamVjdCgxKSksXG5cdFx0XHRcdGZhbHNlLFxuXHRcdFx0KTtcblxuXHRcdFx0YXdhaXQgdGVzdFJlbW92ZUxvZ2ljKFxuXHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RPYmplY3QoMikpLFxuXHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RPYmplY3QoMikpLFxuXHRcdFx0XHR0cnVlLFxuXHRcdFx0KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgndGhyb3dzIGlmIGZhY3RvcnkgcmV0dXJucyBhIGRpc3Bvc2VkIG9iamVjdCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBmYWN0b3J5ID0gKFxuXHRcdFx0a2V5OiBzdHJpbmcsXG5cdFx0KSA9PiB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBuZXcgVGVzdE9iamVjdChrZXkpO1xuXG5cdFx0XHRpZiAoa2V5ID09PSAna2V5MicpIHtcblx0XHRcdFx0cmVzdWx0LmRpc3Bvc2UoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gY2F1dGlvbiEgZXhwbGljaXQgdHlwZSBjYXN0aW5nIGJlbG93IVxuXHRcdFx0cmV0dXJuIHJlc3VsdCBhcyBUZXN0T2JqZWN0PHN0cmluZz4gJiB7IGRpc3Bvc2VkOiBmYWxzZSB9O1xuXHRcdH07XG5cblx0XHQvLyBPYmplY3RDYWNoZTxUZXN0T2JqZWN0PlxuXHRcdGNvbnN0IGNhY2hlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBPYmplY3RDYWNoZShmYWN0b3J5KSk7XG5cblx0XHRhc3NlcnQuZG9lc05vdFRocm93KCgpID0+IHtcblx0XHRcdGNhY2hlLmdldCgna2V5MScpO1xuXHRcdH0pO1xuXG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRjYWNoZS5nZXQoJ2tleTInKTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLFdBQVc7QUFDcEIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsK0NBQStDO0FBS3hELE1BQU0sbUJBQStELHFC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
