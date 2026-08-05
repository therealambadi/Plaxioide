import assert from "assert";
import { Emitter } from "../../common/event.js";
import { DisposableStore, dispose, markAsSingleton, ReferenceCollection, SafeDisposable, thenIfNotDisposed, toDisposable } from "../../common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite, throwIfDisposablesAreLeaked } from "./utils.js";
class Disposable {
  constructor() {
    this.isDisposed = false;
  }
  dispose() {
    this.isDisposed = true;
  }
}
suite("Lifecycle", () => {
  test("dispose single disposable", () => {
    const disposable = new Disposable();
    assert(!disposable.isDisposed);
    dispose(disposable);
    assert(disposable.isDisposed);
  });
  test("dispose disposable array", () => {
    const disposable = new Disposable();
    const disposable2 = new Disposable();
    assert(!disposable.isDisposed);
    assert(!disposable2.isDisposed);
    dispose([disposable, disposable2]);
    assert(disposable.isDisposed);
    assert(disposable2.isDisposed);
  });
  test("dispose disposables", () => {
    const disposable = new Disposable();
    const disposable2 = new Disposable();
    assert(!disposable.isDisposed);
    assert(!disposable2.isDisposed);
    dispose(disposable);
    dispose(disposable2);
    assert(disposable.isDisposed);
    assert(disposable2.isDisposed);
  });
  test("dispose array should dispose all if a child throws on dispose", () => {
    const disposedValues = /* @__PURE__ */ new Set();
    let thrownError;
    try {
      dispose([
        toDisposable(() => {
          disposedValues.add(1);
        }),
        toDisposable(() => {
          throw new Error("I am error");
        }),
        toDisposable(() => {
          disposedValues.add(3);
        })
      ]);
    } catch (e) {
      thrownError = e;
    }
    assert.ok(disposedValues.has(1));
    assert.ok(disposedValues.has(3));
    assert.strictEqual(thrownError.message, "I am error");
  });
  test("dispose array should rethrow composite error if multiple entries throw on dispose", () => {
    const disposedValues = /* @__PURE__ */ new Set();
    let thrownError;
    try {
      dispose([
        toDisposable(() => {
          disposedValues.add(1);
        }),
        toDisposable(() => {
          throw new Error("I am error 1");
        }),
        toDisposable(() => {
          throw new Error("I am error 2");
        }),
        toDisposable(() => {
          disposedValues.add(4);
        })
      ]);
    } catch (e) {
      thrownError = e;
    }
    assert.ok(disposedValues.has(1));
    assert.ok(disposedValues.has(4));
    assert.ok(thrownError instanceof AggregateError);
    assert.strictEqual(thrownError.errors.length, 2);
    assert.strictEqual(thrownError.errors[0].message, "I am error 1");
    assert.strictEqual(thrownError.errors[1].message, "I am error 2");
  });
  test("Action bar has broken accessibility #100273", function() {
    const array = [{ dispose() {
    } }, { dispose() {
    } }];
    const array2 = dispose(array);
    assert.strictEqual(array.length, 2);
    assert.strictEqual(array2.length, 0);
    assert.ok(array !== array2);
    const set = /* @__PURE__ */ new Set([{ dispose() {
    } }, { dispose() {
    } }]);
    const setValues = set.values();
    const setValues2 = dispose(setValues);
    assert.ok(setValues === setValues2);
  });
  test("SafeDisposable, dispose", function() {
    let disposed = 0;
    const actual = () => disposed += 1;
    const d = new SafeDisposable();
    d.set(actual);
    d.dispose();
    assert.strictEqual(disposed, 1);
  });
  test("SafeDisposable, unset", function() {
    let disposed = 0;
    const actual = () => disposed += 1;
    const d = new SafeDisposable();
    d.set(actual);
    d.unset();
    d.dispose();
    assert.strictEqual(disposed, 0);
  });
});
suite("DisposableStore", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("dispose should call all child disposes even if a child throws on dispose", () => {
    const disposedValues = /* @__PURE__ */ new Set();
    const store = new DisposableStore();
    store.add(toDisposable(() => {
      disposedValues.add(1);
    }));
    store.add(toDisposable(() => {
      throw new Error("I am error");
    }));
    store.add(toDisposable(() => {
      disposedValues.add(3);
    }));
    let thrownError;
    try {
      store.dispose();
    } catch (e) {
      thrownError = e;
    }
    assert.ok(disposedValues.has(1));
    assert.ok(disposedValues.has(3));
    assert.strictEqual(thrownError.message, "I am error");
  });
  test("dispose should throw composite error if multiple children throw on dispose", () => {
    const disposedValues = /* @__PURE__ */ new Set();
    const store = new DisposableStore();
    store.add(toDisposable(() => {
      disposedValues.add(1);
    }));
    store.add(toDisposable(() => {
      throw new Error("I am error 1");
    }));
    store.add(toDisposable(() => {
      throw new Error("I am error 2");
    }));
    store.add(toDisposable(() => {
      disposedValues.add(4);
    }));
    let thrownError;
    try {
      store.dispose();
    } catch (e) {
      thrownError = e;
    }
    assert.ok(disposedValues.has(1));
    assert.ok(disposedValues.has(4));
    assert.ok(thrownError instanceof AggregateError);
    assert.strictEqual(thrownError.errors.length, 2);
    assert.strictEqual(thrownError.errors[0].message, "I am error 1");
    assert.strictEqual(thrownError.errors[1].message, "I am error 2");
  });
  test("delete should evict and dispose of the disposables", () => {
    const disposedValues = /* @__PURE__ */ new Set();
    const disposables = [
      toDisposable(() => {
        disposedValues.add(1);
      }),
      toDisposable(() => {
        disposedValues.add(2);
      })
    ];
    const store = new DisposableStore();
    store.add(disposables[0]);
    store.add(disposables[1]);
    store.delete(disposables[0]);
    assert.ok(disposedValues.has(1));
    assert.ok(!disposedValues.has(2));
    store.dispose();
    assert.ok(disposedValues.has(1));
    assert.ok(disposedValues.has(2));
  });
  test("deleteAndLeak should evict and not dispose of the disposables", () => {
    const disposedValues = /* @__PURE__ */ new Set();
    const disposables = [
      toDisposable(() => {
        disposedValues.add(1);
      }),
      toDisposable(() => {
        disposedValues.add(2);
      })
    ];
    const store = new DisposableStore();
    store.add(disposables[0]);
    store.add(disposables[1]);
    store.deleteAndLeak(disposables[0]);
    assert.ok(!disposedValues.has(1));
    assert.ok(!disposedValues.has(2));
    store.dispose();
    assert.ok(!disposedValues.has(1));
    assert.ok(disposedValues.has(2));
    disposables[0].dispose();
  });
});
suite("Reference Collection", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  class Collection extends ReferenceCollection {
    constructor() {
      super(...arguments);
      this._count = 0;
    }
    get count() {
      return this._count;
    }
    createReferencedObject(key) {
      this._count++;
      return key.length;
    }
    destroyReferencedObject(key, object) {
      this._count--;
    }
  }
  test("simple", () => {
    const collection = new Collection();
    const ref1 = collection.acquire("test");
    assert(ref1);
    assert.strictEqual(ref1.object, 4);
    assert.strictEqual(collection.count, 1);
    ref1.dispose();
    assert.strictEqual(collection.count, 0);
    const ref2 = collection.acquire("test");
    const ref3 = collection.acquire("test");
    assert.strictEqual(ref2.object, ref3.object);
    assert.strictEqual(collection.count, 1);
    const ref4 = collection.acquire("monkey");
    assert.strictEqual(ref4.object, 6);
    assert.strictEqual(collection.count, 2);
    ref2.dispose();
    assert.strictEqual(collection.count, 2);
    ref3.dispose();
    assert.strictEqual(collection.count, 1);
    ref4.dispose();
    assert.strictEqual(collection.count, 0);
  });
});
function assertThrows(fn, test2) {
  try {
    fn();
    assert.fail("Expected function to throw, but it did not.");
  } catch (e) {
    assert.ok(test2(e));
  }
}
suite("No Leakage Utilities", () => {
  suite("throwIfDisposablesAreLeaked", () => {
    test("throws if an event subscription is not cleaned up", () => {
      const eventEmitter = new Emitter();
      assertThrows(() => {
        throwIfDisposablesAreLeaked(() => {
          eventEmitter.event(() => {
          });
        }, false);
      }, (e) => e.message.indexOf("undisposed disposables") !== -1);
    });
    test("throws if a disposable is not disposed", () => {
      assertThrows(() => {
        throwIfDisposablesAreLeaked(() => {
          new DisposableStore();
        }, false);
      }, (e) => e.message.indexOf("undisposed disposables") !== -1);
    });
    test("does not throw if all event subscriptions are cleaned up", () => {
      const eventEmitter = new Emitter();
      throwIfDisposablesAreLeaked(() => {
        eventEmitter.event(() => {
        }).dispose();
      });
    });
    test("does not throw if all disposables are disposed", () => {
      toDisposable(() => {
      });
      throwIfDisposablesAreLeaked(() => {
        markAsSingleton(toDisposable(() => {
        }));
        const disposableStore = new DisposableStore();
        disposableStore.add(toDisposable(() => {
        }));
        markAsSingleton(disposableStore);
        toDisposable(() => {
        }).dispose();
      });
    });
  });
  suite("ensureNoDisposablesAreLeakedInTest", () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test("Basic Test", () => {
      toDisposable(() => {
      }).dispose();
    });
  });
  suite("thenIfNotDisposed", () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    test("normal case", async () => {
      let called = false;
      store.add(thenIfNotDisposed(Promise.resolve(123), (result) => {
        assert.strictEqual(result, 123);
        called = true;
      }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(called, true);
    });
    test("disposed before promise resolves", async () => {
      let called = false;
      const disposable = thenIfNotDisposed(Promise.resolve(123), () => {
        called = true;
      });
      disposable.dispose();
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(called, false);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvY29tbW9uL2xpZmVjeWNsZS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UsIElEaXNwb3NhYmxlLCBtYXJrQXNTaW5nbGV0b24sIFJlZmVyZW5jZUNvbGxlY3Rpb24sIFNhZmVEaXNwb3NhYmxlLCB0aGVuSWZOb3REaXNwb3NlZCwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUsIHRocm93SWZEaXNwb3NhYmxlc0FyZUxlYWtlZCB9IGZyb20gJy4vdXRpbHMuanMnO1xuXG5jbGFzcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSURpc3Bvc2FibGUge1xuXHRpc0Rpc3Bvc2VkID0gZmFsc2U7XG5cdGRpc3Bvc2UoKSB7IHRoaXMuaXNEaXNwb3NlZCA9IHRydWU7IH1cbn1cblxuLy8gTGVha3MgYXJlIGFsbG93ZWQgaGVyZSBzaW5jZSB3ZSB0ZXN0IGxpZmVjeWNsZSBzdHVmZjpcbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBsb2NhbC9jb2RlLWVuc3VyZS1uby1kaXNwb3NhYmxlcy1sZWFrLWluLXRlc3RcbnN1aXRlKCdMaWZlY3ljbGUnLCAoKSA9PiB7XG5cdHRlc3QoJ2Rpc3Bvc2Ugc2luZ2xlIGRpc3Bvc2FibGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IG5ldyBEaXNwb3NhYmxlKCk7XG5cblx0XHRhc3NlcnQoIWRpc3Bvc2FibGUuaXNEaXNwb3NlZCk7XG5cblx0XHRkaXNwb3NlKGRpc3Bvc2FibGUpO1xuXG5cdFx0YXNzZXJ0KGRpc3Bvc2FibGUuaXNEaXNwb3NlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Rpc3Bvc2UgZGlzcG9zYWJsZSBhcnJheScsICgpID0+IHtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gbmV3IERpc3Bvc2FibGUoKTtcblx0XHRjb25zdCBkaXNwb3NhYmxlMiA9IG5ldyBEaXNwb3NhYmxlKCk7XG5cblx0XHRhc3NlcnQoIWRpc3Bvc2FibGUuaXNEaXNwb3NlZCk7XG5cdFx0YXNzZXJ0KCFkaXNwb3NhYmxlMi5pc0Rpc3Bvc2VkKTtcblxuXHRcdGRpc3Bvc2UoW2Rpc3Bvc2FibGUsIGRpc3Bvc2FibGUyXSk7XG5cblx0XHRhc3NlcnQoZGlzcG9zYWJsZS5pc0Rpc3Bvc2VkKTtcblx0XHRhc3NlcnQoZGlzcG9zYWJsZTIuaXNEaXNwb3NlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Rpc3Bvc2UgZGlzcG9zYWJsZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IG5ldyBEaXNwb3NhYmxlKCk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZTIgPSBuZXcgRGlzcG9zYWJsZSgpO1xuXG5cdFx0YXNzZXJ0KCFkaXNwb3NhYmxlLmlzRGlzcG9zZWQpO1xuXHRcdGFzc2VydCghZGlzcG9zYWJsZTIuaXNEaXNwb3NlZCk7XG5cblx0XHRkaXNwb3NlKGRpc3Bvc2FibGUpO1xuXHRcdGRpc3Bvc2UoZGlzcG9zYWJsZTIpO1xuXG5cdFx0YXNzZXJ0KGRpc3Bvc2FibGUuaXNEaXNwb3NlZCk7XG5cdFx0YXNzZXJ0KGRpc3Bvc2FibGUyLmlzRGlzcG9zZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdkaXNwb3NlIGFycmF5IHNob3VsZCBkaXNwb3NlIGFsbCBpZiBhIGNoaWxkIHRocm93cyBvbiBkaXNwb3NlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGRpc3Bvc2VkVmFsdWVzID0gbmV3IFNldDxudW1iZXI+KCk7XG5cblx0XHRsZXQgdGhyb3duRXJyb3I6IGFueTtcblx0XHR0cnkge1xuXHRcdFx0ZGlzcG9zZShbXG5cdFx0XHRcdHRvRGlzcG9zYWJsZSgoKSA9PiB7IGRpc3Bvc2VkVmFsdWVzLmFkZCgxKTsgfSksXG5cdFx0XHRcdHRvRGlzcG9zYWJsZSgoKSA9PiB7IHRocm93IG5ldyBFcnJvcignSSBhbSBlcnJvcicpOyB9KSxcblx0XHRcdFx0dG9EaXNwb3NhYmxlKCgpID0+IHsgZGlzcG9zZWRWYWx1ZXMuYWRkKDMpOyB9KSxcblx0XHRcdF0pO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRocm93bkVycm9yID0gZTtcblx0XHR9XG5cblx0XHRhc3NlcnQub2soZGlzcG9zZWRWYWx1ZXMuaGFzKDEpKTtcblx0XHRhc3NlcnQub2soZGlzcG9zZWRWYWx1ZXMuaGFzKDMpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhyb3duRXJyb3IubWVzc2FnZSwgJ0kgYW0gZXJyb3InKTtcblx0fSk7XG5cblx0dGVzdCgnZGlzcG9zZSBhcnJheSBzaG91bGQgcmV0aHJvdyBjb21wb3NpdGUgZXJyb3IgaWYgbXVsdGlwbGUgZW50cmllcyB0aHJvdyBvbiBkaXNwb3NlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGRpc3Bvc2VkVmFsdWVzID0gbmV3IFNldDxudW1iZXI+KCk7XG5cblx0XHRsZXQgdGhyb3duRXJyb3I6IGFueTtcblx0XHR0cnkge1xuXHRcdFx0ZGlzcG9zZShbXG5cdFx0XHRcdHRvRGlzcG9zYWJsZSgoKSA9PiB7IGRpc3Bvc2VkVmFsdWVzLmFkZCgxKTsgfSksXG5cdFx0XHRcdHRvRGlzcG9zYWJsZSgoKSA9PiB7IHRocm93IG5ldyBFcnJvcignSSBhbSBlcnJvciAxJyk7IH0pLFxuXHRcdFx0XHR0b0Rpc3Bvc2FibGUoKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ0kgYW0gZXJyb3IgMicpOyB9KSxcblx0XHRcdFx0dG9EaXNwb3NhYmxlKCgpID0+IHsgZGlzcG9zZWRWYWx1ZXMuYWRkKDQpOyB9KSxcblx0XHRcdF0pO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRocm93bkVycm9yID0gZTtcblx0XHR9XG5cblx0XHRhc3NlcnQub2soZGlzcG9zZWRWYWx1ZXMuaGFzKDEpKTtcblx0XHRhc3NlcnQub2soZGlzcG9zZWRWYWx1ZXMuaGFzKDQpKTtcblx0XHRhc3NlcnQub2sodGhyb3duRXJyb3IgaW5zdGFuY2VvZiBBZ2dyZWdhdGVFcnJvcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCh0aHJvd25FcnJvciBhcyBBZ2dyZWdhdGVFcnJvcikuZXJyb3JzLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCh0aHJvd25FcnJvciBhcyBBZ2dyZWdhdGVFcnJvcikuZXJyb3JzWzBdLm1lc3NhZ2UsICdJIGFtIGVycm9yIDEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKHRocm93bkVycm9yIGFzIEFnZ3JlZ2F0ZUVycm9yKS5lcnJvcnNbMV0ubWVzc2FnZSwgJ0kgYW0gZXJyb3IgMicpO1xuXHR9KTtcblxuXHR0ZXN0KCdBY3Rpb24gYmFyIGhhcyBicm9rZW4gYWNjZXNzaWJpbGl0eSAjMTAwMjczJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGFycmF5ID0gW3sgZGlzcG9zZSgpIHsgfSB9LCB7IGRpc3Bvc2UoKSB7IH0gfV07XG5cdFx0Y29uc3QgYXJyYXkyID0gZGlzcG9zZShhcnJheSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXJyYXkubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXJyYXkyLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0Lm9rKGFycmF5ICE9PSBhcnJheTIpO1xuXG5cdFx0Y29uc3Qgc2V0ID0gbmV3IFNldDxJRGlzcG9zYWJsZT4oW3sgZGlzcG9zZSgpIHsgfSB9LCB7IGRpc3Bvc2UoKSB7IH0gfV0pO1xuXHRcdGNvbnN0IHNldFZhbHVlcyA9IHNldC52YWx1ZXMoKTtcblx0XHRjb25zdCBzZXRWYWx1ZXMyID0gZGlzcG9zZShzZXRWYWx1ZXMpO1xuXHRcdGFzc2VydC5vayhzZXRWYWx1ZXMgPT09IHNldFZhbHVlczIpO1xuXHR9KTtcblxuXHR0ZXN0KCdTYWZlRGlzcG9zYWJsZSwgZGlzcG9zZScsIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgZGlzcG9zZWQgPSAwO1xuXHRcdGNvbnN0IGFjdHVhbCA9ICgpID0+IGRpc3Bvc2VkICs9IDE7XG5cdFx0Y29uc3QgZCA9IG5ldyBTYWZlRGlzcG9zYWJsZSgpO1xuXHRcdGQuc2V0KGFjdHVhbCk7XG5cdFx0ZC5kaXNwb3NlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpc3Bvc2VkLCAxKTtcblx0fSk7XG5cblx0dGVzdCgnU2FmZURpc3Bvc2FibGUsIHVuc2V0JywgZnVuY3Rpb24gKCkge1xuXHRcdGxldCBkaXNwb3NlZCA9IDA7XG5cdFx0Y29uc3QgYWN0dWFsID0gKCkgPT4gZGlzcG9zZWQgKz0gMTtcblx0XHRjb25zdCBkID0gbmV3IFNhZmVEaXNwb3NhYmxlKCk7XG5cdFx0ZC5zZXQoYWN0dWFsKTtcblx0XHRkLnVuc2V0KCk7XG5cdFx0ZC5kaXNwb3NlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpc3Bvc2VkLCAwKTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ0Rpc3Bvc2FibGVTdG9yZScsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnZGlzcG9zZSBzaG91bGQgY2FsbCBhbGwgY2hpbGQgZGlzcG9zZXMgZXZlbiBpZiBhIGNoaWxkIHRocm93cyBvbiBkaXNwb3NlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGRpc3Bvc2VkVmFsdWVzID0gbmV3IFNldDxudW1iZXI+KCk7XG5cblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRzdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHsgZGlzcG9zZWRWYWx1ZXMuYWRkKDEpOyB9KSk7XG5cdFx0c3RvcmUuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7IHRocm93IG5ldyBFcnJvcignSSBhbSBlcnJvcicpOyB9KSk7XG5cdFx0c3RvcmUuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7IGRpc3Bvc2VkVmFsdWVzLmFkZCgzKTsgfSkpO1xuXG5cdFx0bGV0IHRocm93bkVycm9yOiBhbnk7XG5cdFx0dHJ5IHtcblx0XHRcdHN0b3JlLmRpc3Bvc2UoKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aHJvd25FcnJvciA9IGU7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0Lm9rKGRpc3Bvc2VkVmFsdWVzLmhhcygxKSk7XG5cdFx0YXNzZXJ0Lm9rKGRpc3Bvc2VkVmFsdWVzLmhhcygzKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRocm93bkVycm9yLm1lc3NhZ2UsICdJIGFtIGVycm9yJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Rpc3Bvc2Ugc2hvdWxkIHRocm93IGNvbXBvc2l0ZSBlcnJvciBpZiBtdWx0aXBsZSBjaGlsZHJlbiB0aHJvdyBvbiBkaXNwb3NlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGRpc3Bvc2VkVmFsdWVzID0gbmV3IFNldDxudW1iZXI+KCk7XG5cblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRzdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHsgZGlzcG9zZWRWYWx1ZXMuYWRkKDEpOyB9KSk7XG5cdFx0c3RvcmUuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7IHRocm93IG5ldyBFcnJvcignSSBhbSBlcnJvciAxJyk7IH0pKTtcblx0XHRzdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdJIGFtIGVycm9yIDInKTsgfSkpO1xuXHRcdHN0b3JlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4geyBkaXNwb3NlZFZhbHVlcy5hZGQoNCk7IH0pKTtcblxuXHRcdGxldCB0aHJvd25FcnJvcjogYW55O1xuXHRcdHRyeSB7XG5cdFx0XHRzdG9yZS5kaXNwb3NlKCk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhyb3duRXJyb3IgPSBlO1xuXHRcdH1cblxuXHRcdGFzc2VydC5vayhkaXNwb3NlZFZhbHVlcy5oYXMoMSkpO1xuXHRcdGFzc2VydC5vayhkaXNwb3NlZFZhbHVlcy5oYXMoNCkpO1xuXHRcdGFzc2VydC5vayh0aHJvd25FcnJvciBpbnN0YW5jZW9mIEFnZ3JlZ2F0ZUVycm9yKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKHRocm93bkVycm9yIGFzIEFnZ3JlZ2F0ZUVycm9yKS5lcnJvcnMubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKHRocm93bkVycm9yIGFzIEFnZ3JlZ2F0ZUVycm9yKS5lcnJvcnNbMF0ubWVzc2FnZSwgJ0kgYW0gZXJyb3IgMScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgodGhyb3duRXJyb3IgYXMgQWdncmVnYXRlRXJyb3IpLmVycm9yc1sxXS5tZXNzYWdlLCAnSSBhbSBlcnJvciAyJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZSBzaG91bGQgZXZpY3QgYW5kIGRpc3Bvc2Ugb2YgdGhlIGRpc3Bvc2FibGVzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGRpc3Bvc2VkVmFsdWVzID0gbmV3IFNldDxudW1iZXI+KCk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXM6IElEaXNwb3NhYmxlW10gPSBbXG5cdFx0XHR0b0Rpc3Bvc2FibGUoKCkgPT4geyBkaXNwb3NlZFZhbHVlcy5hZGQoMSk7IH0pLFxuXHRcdFx0dG9EaXNwb3NhYmxlKCgpID0+IHsgZGlzcG9zZWRWYWx1ZXMuYWRkKDIpOyB9KVxuXHRcdF07XG5cblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRzdG9yZS5hZGQoZGlzcG9zYWJsZXNbMF0pO1xuXHRcdHN0b3JlLmFkZChkaXNwb3NhYmxlc1sxXSk7XG5cblx0XHRzdG9yZS5kZWxldGUoZGlzcG9zYWJsZXNbMF0pO1xuXG5cdFx0YXNzZXJ0Lm9rKGRpc3Bvc2VkVmFsdWVzLmhhcygxKSk7XG5cdFx0YXNzZXJ0Lm9rKCFkaXNwb3NlZFZhbHVlcy5oYXMoMikpO1xuXG5cdFx0c3RvcmUuZGlzcG9zZSgpO1xuXG5cdFx0YXNzZXJ0Lm9rKGRpc3Bvc2VkVmFsdWVzLmhhcygxKSk7XG5cdFx0YXNzZXJ0Lm9rKGRpc3Bvc2VkVmFsdWVzLmhhcygyKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZUFuZExlYWsgc2hvdWxkIGV2aWN0IGFuZCBub3QgZGlzcG9zZSBvZiB0aGUgZGlzcG9zYWJsZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZGlzcG9zZWRWYWx1ZXMgPSBuZXcgU2V0PG51bWJlcj4oKTtcblx0XHRjb25zdCBkaXNwb3NhYmxlczogSURpc3Bvc2FibGVbXSA9IFtcblx0XHRcdHRvRGlzcG9zYWJsZSgoKSA9PiB7IGRpc3Bvc2VkVmFsdWVzLmFkZCgxKTsgfSksXG5cdFx0XHR0b0Rpc3Bvc2FibGUoKCkgPT4geyBkaXNwb3NlZFZhbHVlcy5hZGQoMik7IH0pXG5cdFx0XTtcblxuXHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHN0b3JlLmFkZChkaXNwb3NhYmxlc1swXSk7XG5cdFx0c3RvcmUuYWRkKGRpc3Bvc2FibGVzWzFdKTtcblxuXHRcdHN0b3JlLmRlbGV0ZUFuZExlYWsoZGlzcG9zYWJsZXNbMF0pO1xuXG5cdFx0YXNzZXJ0Lm9rKCFkaXNwb3NlZFZhbHVlcy5oYXMoMSkpO1xuXHRcdGFzc2VydC5vayghZGlzcG9zZWRWYWx1ZXMuaGFzKDIpKTtcblxuXHRcdHN0b3JlLmRpc3Bvc2UoKTtcblxuXHRcdGFzc2VydC5vayghZGlzcG9zZWRWYWx1ZXMuaGFzKDEpKTtcblx0XHRhc3NlcnQub2soZGlzcG9zZWRWYWx1ZXMuaGFzKDIpKTtcblxuXHRcdGRpc3Bvc2FibGVzWzBdLmRpc3Bvc2UoKTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ1JlZmVyZW5jZSBDb2xsZWN0aW9uJywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRjbGFzcyBDb2xsZWN0aW9uIGV4dGVuZHMgUmVmZXJlbmNlQ29sbGVjdGlvbjxudW1iZXI+IHtcblx0XHRwcml2YXRlIF9jb3VudCA9IDA7XG5cdFx0Z2V0IGNvdW50KCkgeyByZXR1cm4gdGhpcy5fY291bnQ7IH1cblx0XHRwcm90ZWN0ZWQgY3JlYXRlUmVmZXJlbmNlZE9iamVjdChrZXk6IHN0cmluZyk6IG51bWJlciB7IHRoaXMuX2NvdW50Kys7IHJldHVybiBrZXkubGVuZ3RoOyB9XG5cdFx0cHJvdGVjdGVkIGRlc3Ryb3lSZWZlcmVuY2VkT2JqZWN0KGtleTogc3RyaW5nLCBvYmplY3Q6IG51bWJlcik6IHZvaWQgeyB0aGlzLl9jb3VudC0tOyB9XG5cdH1cblxuXHR0ZXN0KCdzaW1wbGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29sbGVjdGlvbiA9IG5ldyBDb2xsZWN0aW9uKCk7XG5cblx0XHRjb25zdCByZWYxID0gY29sbGVjdGlvbi5hY3F1aXJlKCd0ZXN0Jyk7XG5cdFx0YXNzZXJ0KHJlZjEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZWYxLm9iamVjdCwgNCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbGxlY3Rpb24uY291bnQsIDEpO1xuXHRcdHJlZjEuZGlzcG9zZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb2xsZWN0aW9uLmNvdW50LCAwKTtcblxuXHRcdGNvbnN0IHJlZjIgPSBjb2xsZWN0aW9uLmFjcXVpcmUoJ3Rlc3QnKTtcblx0XHRjb25zdCByZWYzID0gY29sbGVjdGlvbi5hY3F1aXJlKCd0ZXN0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZjIub2JqZWN0LCByZWYzLm9iamVjdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbGxlY3Rpb24uY291bnQsIDEpO1xuXG5cdFx0Y29uc3QgcmVmNCA9IGNvbGxlY3Rpb24uYWNxdWlyZSgnbW9ua2V5Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZjQub2JqZWN0LCA2KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29sbGVjdGlvbi5jb3VudCwgMik7XG5cblx0XHRyZWYyLmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29sbGVjdGlvbi5jb3VudCwgMik7XG5cblx0XHRyZWYzLmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29sbGVjdGlvbi5jb3VudCwgMSk7XG5cblx0XHRyZWY0LmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29sbGVjdGlvbi5jb3VudCwgMCk7XG5cdH0pO1xufSk7XG5cbmZ1bmN0aW9uIGFzc2VydFRocm93cyhmbjogKCkgPT4gdm9pZCwgdGVzdDogKGVycm9yOiBhbnkpID0+IHZvaWQpIHtcblx0dHJ5IHtcblx0XHRmbigpO1xuXHRcdGFzc2VydC5mYWlsKCdFeHBlY3RlZCBmdW5jdGlvbiB0byB0aHJvdywgYnV0IGl0IGRpZCBub3QuJyk7XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHRhc3NlcnQub2sodGVzdChlKSk7XG5cdH1cbn1cblxuc3VpdGUoJ05vIExlYWthZ2UgVXRpbGl0aWVzJywgKCkgPT4ge1xuXHRzdWl0ZSgndGhyb3dJZkRpc3Bvc2FibGVzQXJlTGVha2VkJywgKCkgPT4ge1xuXHRcdHRlc3QoJ3Rocm93cyBpZiBhbiBldmVudCBzdWJzY3JpcHRpb24gaXMgbm90IGNsZWFuZWQgdXAnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBldmVudEVtaXR0ZXIgPSBuZXcgRW1pdHRlcigpO1xuXG5cdFx0XHRhc3NlcnRUaHJvd3MoKCkgPT4ge1xuXHRcdFx0XHR0aHJvd0lmRGlzcG9zYWJsZXNBcmVMZWFrZWQoKCkgPT4ge1xuXHRcdFx0XHRcdGV2ZW50RW1pdHRlci5ldmVudCgoKSA9PiB7XG5cdFx0XHRcdFx0XHQvLyBub29wXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0sIGZhbHNlKTtcblx0XHRcdH0sIGUgPT4gZS5tZXNzYWdlLmluZGV4T2YoJ3VuZGlzcG9zZWQgZGlzcG9zYWJsZXMnKSAhPT0gLTEpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgndGhyb3dzIGlmIGEgZGlzcG9zYWJsZSBpcyBub3QgZGlzcG9zZWQnLCAoKSA9PiB7XG5cdFx0XHRhc3NlcnRUaHJvd3MoKCkgPT4ge1xuXHRcdFx0XHR0aHJvd0lmRGlzcG9zYWJsZXNBcmVMZWFrZWQoKCkgPT4ge1xuXHRcdFx0XHRcdG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdFx0fSwgZmFsc2UpO1xuXHRcdFx0fSwgZSA9PiBlLm1lc3NhZ2UuaW5kZXhPZigndW5kaXNwb3NlZCBkaXNwb3NhYmxlcycpICE9PSAtMSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdkb2VzIG5vdCB0aHJvdyBpZiBhbGwgZXZlbnQgc3Vic2NyaXB0aW9ucyBhcmUgY2xlYW5lZCB1cCcsICgpID0+IHtcblx0XHRcdGNvbnN0IGV2ZW50RW1pdHRlciA9IG5ldyBFbWl0dGVyKCk7XG5cdFx0XHR0aHJvd0lmRGlzcG9zYWJsZXNBcmVMZWFrZWQoKCkgPT4ge1xuXHRcdFx0XHRldmVudEVtaXR0ZXIuZXZlbnQoKCkgPT4ge1xuXHRcdFx0XHRcdC8vIG5vb3Bcblx0XHRcdFx0fSkuZGlzcG9zZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdkb2VzIG5vdCB0aHJvdyBpZiBhbGwgZGlzcG9zYWJsZXMgYXJlIGRpc3Bvc2VkJywgKCkgPT4ge1xuXHRcdFx0Ly8gVGhpcyBkaXNwb3NhYmxlIGlzIHJlcG9ydGVkIGJlZm9yZSB0aGUgdGVzdCBhbmQgbm90IHRyYWNrZWQuXG5cdFx0XHR0b0Rpc3Bvc2FibGUoKCkgPT4geyB9KTtcblxuXHRcdFx0dGhyb3dJZkRpc3Bvc2FibGVzQXJlTGVha2VkKCgpID0+IHtcblx0XHRcdFx0Ly8gVGhpcyBkaXNwb3NhYmxlIGlzIG1hcmtlZCBhcyBzaW5nbGV0b25cblx0XHRcdFx0bWFya0FzU2luZ2xldG9uKHRvRGlzcG9zYWJsZSgoKSA9PiB7IH0pKTtcblxuXHRcdFx0XHQvLyBUaGVzZSBkaXNwb3NhYmxlcyBhcmUgYWxzbyBtYXJrZWQgYXMgc2luZ2xldG9uXG5cdFx0XHRcdGNvbnN0IGRpc3Bvc2FibGVTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdFx0ZGlzcG9zYWJsZVN0b3JlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4geyB9KSk7XG5cdFx0XHRcdG1hcmtBc1NpbmdsZXRvbihkaXNwb3NhYmxlU3RvcmUpO1xuXG5cdFx0XHRcdHRvRGlzcG9zYWJsZSgoKSA9PiB7IH0pLmRpc3Bvc2UoKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdCcsICgpID0+IHtcblx0XHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRcdHRlc3QoJ0Jhc2ljIFRlc3QnLCAoKSA9PiB7XG5cdFx0XHR0b0Rpc3Bvc2FibGUoKCkgPT4geyB9KS5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCd0aGVuSWZOb3REaXNwb3NlZCcsICgpID0+IHtcblx0XHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdFx0dGVzdCgnbm9ybWFsIGNhc2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRsZXQgY2FsbGVkID0gZmFsc2U7XG5cdFx0XHRzdG9yZS5hZGQodGhlbklmTm90RGlzcG9zZWQoUHJvbWlzZS5yZXNvbHZlKDEyMyksIChyZXN1bHQ6IG51bWJlcikgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAxMjMpO1xuXHRcdFx0XHRjYWxsZWQgPSB0cnVlO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMCkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxlZCwgdHJ1ZSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdkaXNwb3NlZCBiZWZvcmUgcHJvbWlzZSByZXNvbHZlcycsIGFzeW5jICgpID0+IHtcblx0XHRcdGxldCBjYWxsZWQgPSBmYWxzZTtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSB0aGVuSWZOb3REaXNwb3NlZChQcm9taXNlLnJlc29sdmUoMTIzKSwgKCkgPT4ge1xuXHRcdFx0XHRjYWxsZWQgPSB0cnVlO1xuXHRcdFx0fSk7XG5cblx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDApKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxsZWQsIGZhbHNlKTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxpQkFBaUIsU0FBc0IsaUJBQWlCLHFCQUFxQixnQkFBZ0IsbUJBQW1CLG9CQUFvQjtBQUM3SSxTQUFTLHlDQUF5QyxtQ0FBbUM7QUFFckYsTUFBTSxXQUFrQztBQUFBLEVBQXhDO0FBQ0Msc0JBQWE7QUFBQTtBQUFBLEVBQ2IsVUFBVTtBQUFFLFNBQUssYUFBYTtBQUFB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
