import { compareBy, numberComparator } from "./arrays.js";
import { groupBy } from "./collections.js";
import { SetMap } from "./map.js";
import { createSingleCallFunction } from "./functional.js";
import { Iterable } from "./iterator.js";
const TRACK_DISPOSABLES = false;
let disposableTracker = null;
class GCBasedDisposableTracker {
  constructor() {
    this._registry = new FinalizationRegistry((heldValue) => {
      console.warn(`[LEAKED DISPOSABLE] ${heldValue}`);
    });
  }
  trackDisposable(disposable) {
    const stack = new Error("CREATED via:").stack;
    this._registry.register(disposable, stack, disposable);
  }
  setParent(child, parent) {
    if (parent) {
      this._registry.unregister(child);
    } else {
      this.trackDisposable(child);
    }
  }
  markAsDisposed(disposable) {
    this._registry.unregister(disposable);
  }
  markAsSingleton(disposable) {
    this._registry.unregister(disposable);
  }
}
const _DisposableTracker = class _DisposableTracker {
  constructor() {
    this.livingDisposables = /* @__PURE__ */ new Map();
  }
  getDisposableData(d) {
    let val = this.livingDisposables.get(d);
    if (!val) {
      val = { parent: null, source: null, isSingleton: false, value: d, idx: _DisposableTracker.idx++ };
      this.livingDisposables.set(d, val);
    }
    return val;
  }
  trackDisposable(d) {
    const data = this.getDisposableData(d);
    if (!data.source) {
      data.source = new Error().stack;
    }
  }
  setParent(child, parent) {
    const data = this.getDisposableData(child);
    data.parent = parent;
  }
  markAsDisposed(x) {
    this.livingDisposables.delete(x);
  }
  markAsSingleton(disposable) {
    this.getDisposableData(disposable).isSingleton = true;
  }
  getRootParent(data, cache) {
    const cacheValue = cache.get(data);
    if (cacheValue) {
      return cacheValue;
    }
    const result = data.parent ? this.getRootParent(this.getDisposableData(data.parent), cache) : data;
    cache.set(data, result);
    return result;
  }
  getTrackedDisposables() {
    const rootParentCache = /* @__PURE__ */ new Map();
    const leaking = [...this.livingDisposables.entries()].filter(([, v]) => v.source !== null && !this.getRootParent(v, rootParentCache).isSingleton).flatMap(([k]) => k);
    return leaking;
  }
  computeLeakingDisposables(maxReported = 10, preComputedLeaks) {
    let uncoveredLeakingObjs;
    if (preComputedLeaks) {
      uncoveredLeakingObjs = preComputedLeaks;
    } else {
      const rootParentCache = /* @__PURE__ */ new Map();
      const leakingObjects = [...this.livingDisposables.values()].filter((info) => info.source !== null && !this.getRootParent(info, rootParentCache).isSingleton);
      if (leakingObjects.length === 0) {
        return;
      }
      const leakingObjsSet = new Set(leakingObjects.map((o) => o.value));
      uncoveredLeakingObjs = leakingObjects.filter((l) => {
        return !(l.parent && leakingObjsSet.has(l.parent));
      });
      if (uncoveredLeakingObjs.length === 0) {
        throw new Error("There are cyclic diposable chains!");
      }
    }
    if (!uncoveredLeakingObjs) {
      return void 0;
    }
    function getStackTracePath(leaking) {
      function removePrefix(array, linesToRemove) {
        while (array.length > 0 && linesToRemove.some((regexp) => typeof regexp === "string" ? regexp === array[0] : array[0].match(regexp))) {
          array.shift();
        }
      }
      const lines = leaking.source.split("\n").map((p) => p.trim().replace("at ", "")).filter((l) => l !== "");
      removePrefix(lines, ["Error", /^trackDisposable \(.*\)$/, /^DisposableTracker.trackDisposable \(.*\)$/]);
      return lines.reverse();
    }
    const stackTraceStarts = new SetMap();
    for (const leaking of uncoveredLeakingObjs) {
      const stackTracePath = getStackTracePath(leaking);
      for (let i2 = 0; i2 <= stackTracePath.length; i2++) {
        stackTraceStarts.add(stackTracePath.slice(0, i2).join("\n"), leaking);
      }
    }
    uncoveredLeakingObjs.sort(compareBy((l) => l.idx, numberComparator));
    let message = "";
    let i = 0;
    for (const leaking of uncoveredLeakingObjs.slice(0, maxReported)) {
      i++;
      const stackTracePath = getStackTracePath(leaking);
      const stackTraceFormattedLines = [];
      for (let i2 = 0; i2 < stackTracePath.length; i2++) {
        let line = stackTracePath[i2];
        const starts = stackTraceStarts.get(stackTracePath.slice(0, i2 + 1).join("\n"));
        line = `(shared with ${starts.size}/${uncoveredLeakingObjs.length} leaks) at ${line}`;
        const prevStarts = stackTraceStarts.get(stackTracePath.slice(0, i2).join("\n"));
        const continuations = groupBy([...prevStarts].map((d) => getStackTracePath(d)[i2]), (v) => v);
        delete continuations[stackTracePath[i2]];
        for (const [cont, set] of Object.entries(continuations)) {
          stackTraceFormattedLines.unshift(`    - stacktraces of ${set.length} other leaks continue with ${cont}`);
        }
        stackTraceFormattedLines.unshift(line);
      }
      message += `


==================== Leaking disposable ${i}/${uncoveredLeakingObjs.length}: ${leaking.value.constructor.name} ====================
${stackTraceFormattedLines.join("\n")}
============================================================

`;
    }
    if (uncoveredLeakingObjs.length > maxReported) {
      message += `


... and ${uncoveredLeakingObjs.length - maxReported} more leaking disposables

`;
    }
    return { leaks: uncoveredLeakingObjs, details: message };
  }
};
_DisposableTracker.idx = 0;
let DisposableTracker = _DisposableTracker;
function setDisposableTracker(tracker) {
  disposableTracker = tracker;
}
if (TRACK_DISPOSABLES) {
  const __is_disposable_tracked__ = "__is_disposable_tracked__";
  setDisposableTracker(new class {
    trackDisposable(x) {
      const stack = new Error("Potentially leaked disposable").stack;
      setTimeout(() => {
        if (!x[__is_disposable_tracked__]) {
          console.log(stack);
        }
      }, 3e3);
    }
    setParent(child, parent) {
      if (child && child !== Disposable.None) {
        try {
          child[__is_disposable_tracked__] = true;
        } catch {
        }
      }
    }
    markAsDisposed(disposable) {
      if (disposable && disposable !== Disposable.None) {
        try {
          disposable[__is_disposable_tracked__] = true;
        } catch {
        }
      }
    }
    markAsSingleton(disposable) {
    }
  }());
}
function trackDisposable(x) {
  disposableTracker?.trackDisposable(x);
  return x;
}
function markAsDisposed(disposable) {
  disposableTracker?.markAsDisposed(disposable);
}
function setParentOfDisposable(child, parent) {
  disposableTracker?.setParent(child, parent);
}
function setParentOfDisposables(children, parent) {
  if (!disposableTracker) {
    return;
  }
  for (const child of children) {
    disposableTracker.setParent(child, parent);
  }
}
function markAsSingleton(singleton) {
  disposableTracker?.markAsSingleton(singleton);
  return singleton;
}
function isDisposable(thing) {
  return typeof thing === "object" && thing !== null && typeof thing.dispose === "function" && thing.dispose.length === 0;
}
function dispose(arg) {
  if (Iterable.is(arg)) {
    const errors = [];
    for (const d of arg) {
      if (d) {
        try {
          d.dispose();
        } catch (e) {
          errors.push(e);
        }
      }
    }
    if (errors.length === 1) {
      throw errors[0];
    } else if (errors.length > 1) {
      throw new AggregateError(errors, "Encountered errors while disposing of store");
    }
    return Array.isArray(arg) ? [] : arg;
  } else if (arg) {
    arg.dispose();
    return arg;
  }
}
function disposeIfDisposable(disposables) {
  for (const d of disposables) {
    if (isDisposable(d)) {
      d.dispose();
    }
  }
  return [];
}
function combinedDisposable(...disposables) {
  const parent = toDisposable(() => dispose(disposables));
  setParentOfDisposables(disposables, parent);
  return parent;
}
function toDisposable(fn) {
  const self = trackDisposable({
    dispose: createSingleCallFunction(() => {
      markAsDisposed(self);
      fn();
    })
  });
  return self;
}
const _DisposableStore = class _DisposableStore {
  constructor() {
    this._toDispose = /* @__PURE__ */ new Set();
    this._isDisposed = false;
    trackDisposable(this);
  }
  /**
   * Dispose of all registered disposables and mark this object as disposed.
   *
   * Any future disposables added to this object will be disposed of on `add`.
   */
  dispose() {
    if (this._isDisposed) {
      return;
    }
    markAsDisposed(this);
    this._isDisposed = true;
    this.clear();
  }
  /**
   * @return `true` if this object has been disposed of.
   */
  get isDisposed() {
    return this._isDisposed;
  }
  /**
   * Dispose of all registered disposables but do not mark this object as disposed.
   */
  clear() {
    if (this._toDispose.size === 0) {
      return;
    }
    try {
      dispose(this._toDispose);
    } finally {
      this._toDispose.clear();
    }
  }
  /**
   * Add a new {@link IDisposable disposable} to the collection.
   */
  add(o) {
    if (!o) {
      return o;
    }
    if (o === this) {
      throw new Error("Cannot register a disposable on itself!");
    }
    setParentOfDisposable(o, this);
    if (this._isDisposed) {
      if (!_DisposableStore.DISABLE_DISPOSED_WARNING) {
        console.warn(new Error("Trying to add a disposable to a DisposableStore that has already been disposed of. The added object will be leaked!").stack);
      }
    } else {
      this._toDispose.add(o);
    }
    return o;
  }
  /**
   * Deletes a disposable from store and disposes of it. This will not throw or warn and proceed to dispose the
   * disposable even when the disposable is not part in the store.
   */
  delete(o) {
    if (!o) {
      return;
    }
    if (o === this) {
      throw new Error("Cannot dispose a disposable on itself!");
    }
    this._toDispose.delete(o);
    o.dispose();
  }
  /**
   * Deletes the value from the store, but does not dispose it.
   */
  deleteAndLeak(o) {
    if (!o) {
      return;
    }
    if (this._toDispose.has(o)) {
      this._toDispose.delete(o);
      setParentOfDisposable(o, null);
    }
  }
};
_DisposableStore.DISABLE_DISPOSED_WARNING = false;
let DisposableStore = _DisposableStore;
class Disposable {
  constructor() {
    this._store = new DisposableStore();
    trackDisposable(this);
    setParentOfDisposable(this._store, this);
  }
  dispose() {
    markAsDisposed(this);
    this._store.dispose();
  }
  /**
   * Adds `o` to the collection of disposables managed by this object.
   */
  _register(o) {
    if (o === this) {
      throw new Error("Cannot register a disposable on itself!");
    }
    return this._store.add(o);
  }
}
/**
 * A disposable that does nothing when it is disposed of.
 *
 * TODO: This should not be a static property.
 */
Disposable.None = Object.freeze({ dispose() {
} });
class MutableDisposable {
  constructor() {
    this._isDisposed = false;
    trackDisposable(this);
  }
  get value() {
    return this._isDisposed ? void 0 : this._value;
  }
  set value(value) {
    if (this._isDisposed || value === this._value) {
      return;
    }
    this._value?.dispose();
    if (value) {
      setParentOfDisposable(value, this);
    }
    this._value = value;
  }
  /**
   * Resets the stored value and disposed of the previously stored value.
   */
  clear() {
    this.value = void 0;
  }
  dispose() {
    this._isDisposed = true;
    markAsDisposed(this);
    this._value?.dispose();
    this._value = void 0;
  }
  /**
   * Clears the value, but does not dispose it.
   * The old value is returned.
  */
  clearAndLeak() {
    const oldValue = this._value;
    this._value = void 0;
    if (oldValue) {
      setParentOfDisposable(oldValue, null);
    }
    return oldValue;
  }
}
class MandatoryMutableDisposable {
  constructor(initialValue) {
    this._disposable = new MutableDisposable();
    this._isDisposed = false;
    this._disposable.value = initialValue;
  }
  get value() {
    return this._disposable.value;
  }
  set value(value) {
    if (this._isDisposed || value === this._disposable.value) {
      return;
    }
    this._disposable.value = value;
  }
  dispose() {
    this._isDisposed = true;
    this._disposable.dispose();
  }
}
class RefCountedDisposable {
  constructor(_disposable) {
    this._disposable = _disposable;
    this._counter = 1;
  }
  acquire() {
    this._counter++;
    return this;
  }
  release() {
    if (--this._counter === 0) {
      this._disposable.dispose();
    }
    return this;
  }
}
class SafeDisposable {
  constructor() {
    this.dispose = () => {
    };
    this.unset = () => {
    };
    this.isset = () => false;
    trackDisposable(this);
  }
  set(fn) {
    let callback = fn;
    this.unset = () => callback = void 0;
    this.isset = () => callback !== void 0;
    this.dispose = () => {
      if (callback) {
        callback();
        callback = void 0;
        markAsDisposed(this);
      }
    };
    return this;
  }
}
class ReferenceCollection {
  constructor() {
    this.references = /* @__PURE__ */ new Map();
  }
  acquire(key, ...args) {
    let reference = this.references.get(key);
    if (!reference) {
      reference = { counter: 0, object: this.createReferencedObject(key, ...args) };
      this.references.set(key, reference);
    }
    const { object } = reference;
    const dispose2 = createSingleCallFunction(() => {
      if (--reference.counter === 0) {
        this.destroyReferencedObject(key, reference.object);
        this.references.delete(key);
      }
    });
    reference.counter++;
    return { object, dispose: dispose2 };
  }
}
class AsyncReferenceCollection {
  constructor(referenceCollection) {
    this.referenceCollection = referenceCollection;
  }
  async acquire(key, ...args) {
    const ref = this.referenceCollection.acquire(key, ...args);
    try {
      const object = await ref.object;
      return {
        object,
        dispose: () => ref.dispose()
      };
    } catch (error) {
      ref.dispose();
      throw error;
    }
  }
}
class ImmortalReference {
  constructor(object) {
    this.object = object;
  }
  dispose() {
  }
}
function disposeOnReturn(fn) {
  const store = new DisposableStore();
  try {
    fn(store);
  } finally {
    store.dispose();
  }
}
class DisposableMap {
  constructor() {
    this._store = /* @__PURE__ */ new Map();
    this._isDisposed = false;
    trackDisposable(this);
  }
  /**
   * Disposes of all stored values and mark this object as disposed.
   *
   * Trying to use this object after it has been disposed of is an error.
   */
  dispose() {
    markAsDisposed(this);
    this._isDisposed = true;
    this.clearAndDisposeAll();
  }
  /**
   * Disposes of all stored values and clear the map, but DO NOT mark this object as disposed.
   */
  clearAndDisposeAll() {
    if (!this._store.size) {
      return;
    }
    try {
      dispose(this._store.values());
    } finally {
      this._store.clear();
    }
  }
  has(key) {
    return this._store.has(key);
  }
  get size() {
    return this._store.size;
  }
  get(key) {
    return this._store.get(key);
  }
  set(key, value, skipDisposeOnOverwrite = false) {
    if (this._isDisposed) {
      console.warn(new Error("Trying to add a disposable to a DisposableMap that has already been disposed of. The added object will be leaked!").stack);
    }
    if (!skipDisposeOnOverwrite) {
      this._store.get(key)?.dispose();
    }
    this._store.set(key, value);
  }
  /**
   * Delete the value stored for `key` from this map and also dispose of it.
   */
  deleteAndDispose(key) {
    this._store.get(key)?.dispose();
    this._store.delete(key);
  }
  /**
   * Delete the value stored for `key` from this map but return it. The caller is
   * responsible for disposing of the value.
   */
  deleteAndLeak(key) {
    const value = this._store.get(key);
    this._store.delete(key);
    return value;
  }
  keys() {
    return this._store.keys();
  }
  values() {
    return this._store.values();
  }
  [Symbol.iterator]() {
    return this._store[Symbol.iterator]();
  }
}
function thenIfNotDisposed(promise, then) {
  let disposed = false;
  promise.then((result) => {
    if (disposed) {
      return;
    }
    then(result);
  });
  return toDisposable(() => {
    disposed = true;
  });
}
export {
  AsyncReferenceCollection,
  Disposable,
  DisposableMap,
  DisposableStore,
  DisposableTracker,
  GCBasedDisposableTracker,
  ImmortalReference,
  MandatoryMutableDisposable,
  MutableDisposable,
  RefCountedDisposable,
  ReferenceCollection,
  SafeDisposable,
  combinedDisposable,
  dispose,
  disposeIfDisposable,
  disposeOnReturn,
  isDisposable,
  markAsDisposed,
  markAsSingleton,
  setDisposableTracker,
  thenIfNotDisposed,
  toDisposable,
  trackDisposable
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9saWZlY3ljbGUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBjb21wYXJlQnksIG51bWJlckNvbXBhcmF0b3IgfSBmcm9tICcuL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBncm91cEJ5IH0gZnJvbSAnLi9jb2xsZWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBTZXRNYXAgfSBmcm9tICcuL21hcC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTaW5nbGVDYWxsRnVuY3Rpb24gfSBmcm9tICcuL2Z1bmN0aW9uYWwuanMnO1xuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuL2l0ZXJhdG9yLmpzJztcblxuLy8gI3JlZ2lvbiBEaXNwb3NhYmxlIFRyYWNraW5nXG5cbi8qKlxuICogRW5hYmxlcyBsb2dnaW5nIG9mIHBvdGVudGlhbGx5IGxlYWtlZCBkaXNwb3NhYmxlcy5cbiAqXG4gKiBBIGRpc3Bvc2FibGUgaXMgY29uc2lkZXJlZCBsZWFrZWQgaWYgaXQgaXMgbm90IGRpc3Bvc2VkIG9yIG5vdCByZWdpc3RlcmVkIGFzIHRoZSBjaGlsZCBvZlxuICogYW5vdGhlciBkaXNwb3NhYmxlLiBUaGlzIHRyYWNraW5nIGlzIHZlcnkgc2ltcGxlIGFuIG9ubHkgd29ya3MgZm9yIGNsYXNzZXMgdGhhdCBlaXRoZXJcbiAqIGV4dGVuZCBEaXNwb3NhYmxlIG9yIHVzZSBhIERpc3Bvc2FibGVTdG9yZS4gVGhpcyBtZWFucyB0aGVyZSBhcmUgYSBsb3Qgb2YgZmFsc2UgcG9zaXRpdmVzLlxuICovXG5jb25zdCBUUkFDS19ESVNQT1NBQkxFUyA9IGZhbHNlO1xubGV0IGRpc3Bvc2FibGVUcmFja2VyOiBJRGlzcG9zYWJsZVRyYWNrZXIgfCBudWxsID0gbnVsbDtcblxuZXhwb3J0IGludGVyZmFjZSBJRGlzcG9zYWJsZVRyYWNrZXIge1xuXHQvKipcblx0ICogSXMgY2FsbGVkIG9uIGNvbnN0cnVjdGlvbiBvZiBhIGRpc3Bvc2FibGUuXG5cdCovXG5cdHRyYWNrRGlzcG9zYWJsZShkaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSk6IHZvaWQ7XG5cblx0LyoqXG5cdCAqIElzIGNhbGxlZCB3aGVuIGEgZGlzcG9zYWJsZSBpcyByZWdpc3RlcmVkIGFzIGNoaWxkIG9mIGFub3RoZXIgZGlzcG9zYWJsZSAoZS5nLiB7QGxpbmsgRGlzcG9zYWJsZVN0b3JlfSkuXG5cdCAqIElmIHBhcmVudCBpcyBgbnVsbGAsIHRoZSBkaXNwb3NhYmxlIGlzIHJlbW92ZWQgZnJvbSBpdHMgZm9ybWVyIHBhcmVudC5cblx0Ki9cblx0c2V0UGFyZW50KGNoaWxkOiBJRGlzcG9zYWJsZSwgcGFyZW50OiBJRGlzcG9zYWJsZSB8IG51bGwpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBJcyBjYWxsZWQgYWZ0ZXIgYSBkaXNwb3NhYmxlIGlzIGRpc3Bvc2VkLlxuXHQqL1xuXHRtYXJrQXNEaXNwb3NlZChkaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSk6IHZvaWQ7XG5cblx0LyoqXG5cdCAqIEluZGljYXRlcyB0aGF0IHRoZSBnaXZlbiBvYmplY3QgaXMgYSBzaW5nbGV0b24gd2hpY2ggZG9lcyBub3QgbmVlZCB0byBiZSBkaXNwb3NlZC5cblx0Ki9cblx0bWFya0FzU2luZ2xldG9uKGRpc3Bvc2FibGU6IElEaXNwb3NhYmxlKTogdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIEdDQmFzZWREaXNwb3NhYmxlVHJhY2tlciBpbXBsZW1lbnRzIElEaXNwb3NhYmxlVHJhY2tlciB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcmVnaXN0cnkgPSBuZXcgRmluYWxpemF0aW9uUmVnaXN0cnk8c3RyaW5nPihoZWxkVmFsdWUgPT4ge1xuXHRcdGNvbnNvbGUud2FybihgW0xFQUtFRCBESVNQT1NBQkxFXSAke2hlbGRWYWx1ZX1gKTtcblx0fSk7XG5cblx0dHJhY2tEaXNwb3NhYmxlKGRpc3Bvc2FibGU6IElEaXNwb3NhYmxlKTogdm9pZCB7XG5cdFx0Y29uc3Qgc3RhY2sgPSBuZXcgRXJyb3IoJ0NSRUFURUQgdmlhOicpLnN0YWNrITtcblx0XHR0aGlzLl9yZWdpc3RyeS5yZWdpc3RlcihkaXNwb3NhYmxlLCBzdGFjaywgZGlzcG9zYWJsZSk7XG5cdH1cblxuXHRzZXRQYXJlbnQoY2hpbGQ6IElEaXNwb3NhYmxlLCBwYXJlbnQ6IElEaXNwb3NhYmxlIHwgbnVsbCk6IHZvaWQge1xuXHRcdGlmIChwYXJlbnQpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdHJ5LnVucmVnaXN0ZXIoY2hpbGQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnRyYWNrRGlzcG9zYWJsZShjaGlsZCk7XG5cdFx0fVxuXHR9XG5cblx0bWFya0FzRGlzcG9zZWQoZGlzcG9zYWJsZTogSURpc3Bvc2FibGUpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3RyeS51bnJlZ2lzdGVyKGRpc3Bvc2FibGUpO1xuXHR9XG5cblx0bWFya0FzU2luZ2xldG9uKGRpc3Bvc2FibGU6IElEaXNwb3NhYmxlKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0cnkudW5yZWdpc3RlcihkaXNwb3NhYmxlKTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIERpc3Bvc2FibGVJbmZvIHtcblx0dmFsdWU6IElEaXNwb3NhYmxlO1xuXHRzb3VyY2U6IHN0cmluZyB8IG51bGw7XG5cdHBhcmVudDogSURpc3Bvc2FibGUgfCBudWxsO1xuXHRpc1NpbmdsZXRvbjogYm9vbGVhbjtcblx0aWR4OiBudW1iZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBEaXNwb3NhYmxlVHJhY2tlciBpbXBsZW1lbnRzIElEaXNwb3NhYmxlVHJhY2tlciB7XG5cdHByaXZhdGUgc3RhdGljIGlkeCA9IDA7XG5cblx0cHJpdmF0ZSByZWFkb25seSBsaXZpbmdEaXNwb3NhYmxlcyA9IG5ldyBNYXA8SURpc3Bvc2FibGUsIERpc3Bvc2FibGVJbmZvPigpO1xuXG5cdHByaXZhdGUgZ2V0RGlzcG9zYWJsZURhdGEoZDogSURpc3Bvc2FibGUpOiBEaXNwb3NhYmxlSW5mbyB7XG5cdFx0bGV0IHZhbCA9IHRoaXMubGl2aW5nRGlzcG9zYWJsZXMuZ2V0KGQpO1xuXHRcdGlmICghdmFsKSB7XG5cdFx0XHR2YWwgPSB7IHBhcmVudDogbnVsbCwgc291cmNlOiBudWxsLCBpc1NpbmdsZXRvbjogZmFsc2UsIHZhbHVlOiBkLCBpZHg6IERpc3Bvc2FibGVUcmFja2VyLmlkeCsrIH07XG5cdFx0XHR0aGlzLmxpdmluZ0Rpc3Bvc2FibGVzLnNldChkLCB2YWwpO1xuXHRcdH1cblx0XHRyZXR1cm4gdmFsO1xuXHR9XG5cblx0dHJhY2tEaXNwb3NhYmxlKGQ6IElEaXNwb3NhYmxlKTogdm9pZCB7XG5cdFx0Y29uc3QgZGF0YSA9IHRoaXMuZ2V0RGlzcG9zYWJsZURhdGEoZCk7XG5cdFx0aWYgKCFkYXRhLnNvdXJjZSkge1xuXHRcdFx0ZGF0YS5zb3VyY2UgPVxuXHRcdFx0XHRuZXcgRXJyb3IoKS5zdGFjayE7XG5cdFx0fVxuXHR9XG5cblx0c2V0UGFyZW50KGNoaWxkOiBJRGlzcG9zYWJsZSwgcGFyZW50OiBJRGlzcG9zYWJsZSB8IG51bGwpOiB2b2lkIHtcblx0XHRjb25zdCBkYXRhID0gdGhpcy5nZXREaXNwb3NhYmxlRGF0YShjaGlsZCk7XG5cdFx0ZGF0YS5wYXJlbnQgPSBwYXJlbnQ7XG5cdH1cblxuXHRtYXJrQXNEaXNwb3NlZCh4OiBJRGlzcG9zYWJsZSk6IHZvaWQge1xuXHRcdHRoaXMubGl2aW5nRGlzcG9zYWJsZXMuZGVsZXRlKHgpO1xuXHR9XG5cblx0bWFya0FzU2luZ2xldG9uKGRpc3Bvc2FibGU6IElEaXNwb3NhYmxlKTogdm9pZCB7XG5cdFx0dGhpcy5nZXREaXNwb3NhYmxlRGF0YShkaXNwb3NhYmxlKS5pc1NpbmdsZXRvbiA9IHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGdldFJvb3RQYXJlbnQoZGF0YTogRGlzcG9zYWJsZUluZm8sIGNhY2hlOiBNYXA8RGlzcG9zYWJsZUluZm8sIERpc3Bvc2FibGVJbmZvPik6IERpc3Bvc2FibGVJbmZvIHtcblx0XHRjb25zdCBjYWNoZVZhbHVlID0gY2FjaGUuZ2V0KGRhdGEpO1xuXHRcdGlmIChjYWNoZVZhbHVlKSB7XG5cdFx0XHRyZXR1cm4gY2FjaGVWYWx1ZTtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQgPSBkYXRhLnBhcmVudCA/IHRoaXMuZ2V0Um9vdFBhcmVudCh0aGlzLmdldERpc3Bvc2FibGVEYXRhKGRhdGEucGFyZW50KSwgY2FjaGUpIDogZGF0YTtcblx0XHRjYWNoZS5zZXQoZGF0YSwgcmVzdWx0KTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0Z2V0VHJhY2tlZERpc3Bvc2FibGVzKCk6IElEaXNwb3NhYmxlW10ge1xuXHRcdGNvbnN0IHJvb3RQYXJlbnRDYWNoZSA9IG5ldyBNYXA8RGlzcG9zYWJsZUluZm8sIERpc3Bvc2FibGVJbmZvPigpO1xuXG5cdFx0Y29uc3QgbGVha2luZyA9IFsuLi50aGlzLmxpdmluZ0Rpc3Bvc2FibGVzLmVudHJpZXMoKV1cblx0XHRcdC5maWx0ZXIoKFssIHZdKSA9PiB2LnNvdXJjZSAhPT0gbnVsbCAmJiAhdGhpcy5nZXRSb290UGFyZW50KHYsIHJvb3RQYXJlbnRDYWNoZSkuaXNTaW5nbGV0b24pXG5cdFx0XHQuZmxhdE1hcCgoW2tdKSA9PiBrKTtcblxuXHRcdHJldHVybiBsZWFraW5nO1xuXHR9XG5cblx0Y29tcHV0ZUxlYWtpbmdEaXNwb3NhYmxlcyhtYXhSZXBvcnRlZCA9IDEwLCBwcmVDb21wdXRlZExlYWtzPzogRGlzcG9zYWJsZUluZm9bXSk6IHsgbGVha3M6IERpc3Bvc2FibGVJbmZvW107IGRldGFpbHM6IHN0cmluZyB9IHwgdW5kZWZpbmVkIHtcblx0XHRsZXQgdW5jb3ZlcmVkTGVha2luZ09ianM6IERpc3Bvc2FibGVJbmZvW10gfCB1bmRlZmluZWQ7XG5cdFx0aWYgKHByZUNvbXB1dGVkTGVha3MpIHtcblx0XHRcdHVuY292ZXJlZExlYWtpbmdPYmpzID0gcHJlQ29tcHV0ZWRMZWFrcztcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3Qgcm9vdFBhcmVudENhY2hlID0gbmV3IE1hcDxEaXNwb3NhYmxlSW5mbywgRGlzcG9zYWJsZUluZm8+KCk7XG5cblx0XHRcdGNvbnN0IGxlYWtpbmdPYmplY3RzID0gWy4uLnRoaXMubGl2aW5nRGlzcG9zYWJsZXMudmFsdWVzKCldXG5cdFx0XHRcdC5maWx0ZXIoKGluZm8pID0+IGluZm8uc291cmNlICE9PSBudWxsICYmICF0aGlzLmdldFJvb3RQYXJlbnQoaW5mbywgcm9vdFBhcmVudENhY2hlKS5pc1NpbmdsZXRvbik7XG5cblx0XHRcdGlmIChsZWFraW5nT2JqZWN0cy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgbGVha2luZ09ianNTZXQgPSBuZXcgU2V0KGxlYWtpbmdPYmplY3RzLm1hcChvID0+IG8udmFsdWUpKTtcblxuXHRcdFx0Ly8gUmVtb3ZlIGFsbCBvYmplY3RzIHRoYXQgYXJlIGEgY2hpbGQgb2Ygb3RoZXIgbGVha2luZyBvYmplY3RzLiBBc3N1bWVzIHRoZXJlIGFyZSBubyBjeWNsZXMuXG5cdFx0XHR1bmNvdmVyZWRMZWFraW5nT2JqcyA9IGxlYWtpbmdPYmplY3RzLmZpbHRlcihsID0+IHtcblx0XHRcdFx0cmV0dXJuICEobC5wYXJlbnQgJiYgbGVha2luZ09ianNTZXQuaGFzKGwucGFyZW50KSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKHVuY292ZXJlZExlYWtpbmdPYmpzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1RoZXJlIGFyZSBjeWNsaWMgZGlwb3NhYmxlIGNoYWlucyEnKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIXVuY292ZXJlZExlYWtpbmdPYmpzKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldFN0YWNrVHJhY2VQYXRoKGxlYWtpbmc6IERpc3Bvc2FibGVJbmZvKTogc3RyaW5nW10ge1xuXHRcdFx0ZnVuY3Rpb24gcmVtb3ZlUHJlZml4KGFycmF5OiBzdHJpbmdbXSwgbGluZXNUb1JlbW92ZTogKHN0cmluZyB8IFJlZ0V4cClbXSkge1xuXHRcdFx0XHR3aGlsZSAoYXJyYXkubGVuZ3RoID4gMCAmJiBsaW5lc1RvUmVtb3ZlLnNvbWUocmVnZXhwID0+IHR5cGVvZiByZWdleHAgPT09ICdzdHJpbmcnID8gcmVnZXhwID09PSBhcnJheVswXSA6IGFycmF5WzBdLm1hdGNoKHJlZ2V4cCkpKSB7XG5cdFx0XHRcdFx0YXJyYXkuc2hpZnQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBsaW5lcyA9IGxlYWtpbmcuc291cmNlIS5zcGxpdCgnXFxuJykubWFwKHAgPT4gcC50cmltKCkucmVwbGFjZSgnYXQgJywgJycpKS5maWx0ZXIobCA9PiBsICE9PSAnJyk7XG5cdFx0XHRyZW1vdmVQcmVmaXgobGluZXMsIFsnRXJyb3InLCAvXnRyYWNrRGlzcG9zYWJsZSBcXCguKlxcKSQvLCAvXkRpc3Bvc2FibGVUcmFja2VyLnRyYWNrRGlzcG9zYWJsZSBcXCguKlxcKSQvXSk7XG5cdFx0XHRyZXR1cm4gbGluZXMucmV2ZXJzZSgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0YWNrVHJhY2VTdGFydHMgPSBuZXcgU2V0TWFwPHN0cmluZywgRGlzcG9zYWJsZUluZm8+KCk7XG5cdFx0Zm9yIChjb25zdCBsZWFraW5nIG9mIHVuY292ZXJlZExlYWtpbmdPYmpzKSB7XG5cdFx0XHRjb25zdCBzdGFja1RyYWNlUGF0aCA9IGdldFN0YWNrVHJhY2VQYXRoKGxlYWtpbmcpO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPD0gc3RhY2tUcmFjZVBhdGgubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0c3RhY2tUcmFjZVN0YXJ0cy5hZGQoc3RhY2tUcmFjZVBhdGguc2xpY2UoMCwgaSkuam9pbignXFxuJyksIGxlYWtpbmcpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFB1dCBlYXJsaWVyIGxlYWtzIGZpcnN0XG5cdFx0dW5jb3ZlcmVkTGVha2luZ09ianMuc29ydChjb21wYXJlQnkobCA9PiBsLmlkeCwgbnVtYmVyQ29tcGFyYXRvcikpO1xuXG5cdFx0bGV0IG1lc3NhZ2UgPSAnJztcblxuXHRcdGxldCBpID0gMDtcblx0XHRmb3IgKGNvbnN0IGxlYWtpbmcgb2YgdW5jb3ZlcmVkTGVha2luZ09ianMuc2xpY2UoMCwgbWF4UmVwb3J0ZWQpKSB7XG5cdFx0XHRpKys7XG5cdFx0XHRjb25zdCBzdGFja1RyYWNlUGF0aCA9IGdldFN0YWNrVHJhY2VQYXRoKGxlYWtpbmcpO1xuXHRcdFx0Y29uc3Qgc3RhY2tUcmFjZUZvcm1hdHRlZExpbmVzID0gW107XG5cblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgc3RhY2tUcmFjZVBhdGgubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0bGV0IGxpbmUgPSBzdGFja1RyYWNlUGF0aFtpXTtcblx0XHRcdFx0Y29uc3Qgc3RhcnRzID0gc3RhY2tUcmFjZVN0YXJ0cy5nZXQoc3RhY2tUcmFjZVBhdGguc2xpY2UoMCwgaSArIDEpLmpvaW4oJ1xcbicpKTtcblx0XHRcdFx0bGluZSA9IGAoc2hhcmVkIHdpdGggJHtzdGFydHMuc2l6ZX0vJHt1bmNvdmVyZWRMZWFraW5nT2Jqcy5sZW5ndGh9IGxlYWtzKSBhdCAke2xpbmV9YDtcblxuXHRcdFx0XHRjb25zdCBwcmV2U3RhcnRzID0gc3RhY2tUcmFjZVN0YXJ0cy5nZXQoc3RhY2tUcmFjZVBhdGguc2xpY2UoMCwgaSkuam9pbignXFxuJykpO1xuXHRcdFx0XHRjb25zdCBjb250aW51YXRpb25zID0gZ3JvdXBCeShbLi4ucHJldlN0YXJ0c10ubWFwKGQgPT4gZ2V0U3RhY2tUcmFjZVBhdGgoZClbaV0pLCB2ID0+IHYpO1xuXHRcdFx0XHRkZWxldGUgY29udGludWF0aW9uc1tzdGFja1RyYWNlUGF0aFtpXV07XG5cdFx0XHRcdGZvciAoY29uc3QgW2NvbnQsIHNldF0gb2YgT2JqZWN0LmVudHJpZXMoY29udGludWF0aW9ucykpIHtcblx0XHRcdFx0XHRzdGFja1RyYWNlRm9ybWF0dGVkTGluZXMudW5zaGlmdChgICAgIC0gc3RhY2t0cmFjZXMgb2YgJHtzZXQubGVuZ3RofSBvdGhlciBsZWFrcyBjb250aW51ZSB3aXRoICR7Y29udH1gKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHN0YWNrVHJhY2VGb3JtYXR0ZWRMaW5lcy51bnNoaWZ0KGxpbmUpO1xuXHRcdFx0fVxuXG5cdFx0XHRtZXNzYWdlICs9IGBcXG5cXG5cXG49PT09PT09PT09PT09PT09PT09PSBMZWFraW5nIGRpc3Bvc2FibGUgJHtpfS8ke3VuY292ZXJlZExlYWtpbmdPYmpzLmxlbmd0aH06ICR7bGVha2luZy52YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lfSA9PT09PT09PT09PT09PT09PT09PVxcbiR7c3RhY2tUcmFjZUZvcm1hdHRlZExpbmVzLmpvaW4oJ1xcbicpfVxcbj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxcblxcbmA7XG5cdFx0fVxuXG5cdFx0aWYgKHVuY292ZXJlZExlYWtpbmdPYmpzLmxlbmd0aCA+IG1heFJlcG9ydGVkKSB7XG5cdFx0XHRtZXNzYWdlICs9IGBcXG5cXG5cXG4uLi4gYW5kICR7dW5jb3ZlcmVkTGVha2luZ09ianMubGVuZ3RoIC0gbWF4UmVwb3J0ZWR9IG1vcmUgbGVha2luZyBkaXNwb3NhYmxlc1xcblxcbmA7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgbGVha3M6IHVuY292ZXJlZExlYWtpbmdPYmpzLCBkZXRhaWxzOiBtZXNzYWdlIH07XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldERpc3Bvc2FibGVUcmFja2VyKHRyYWNrZXI6IElEaXNwb3NhYmxlVHJhY2tlciB8IG51bGwpOiB2b2lkIHtcblx0ZGlzcG9zYWJsZVRyYWNrZXIgPSB0cmFja2VyO1xufVxuXG5pZiAoVFJBQ0tfRElTUE9TQUJMRVMpIHtcblx0Y29uc3QgX19pc19kaXNwb3NhYmxlX3RyYWNrZWRfXyA9ICdfX2lzX2Rpc3Bvc2FibGVfdHJhY2tlZF9fJztcblx0c2V0RGlzcG9zYWJsZVRyYWNrZXIobmV3IGNsYXNzIGltcGxlbWVudHMgSURpc3Bvc2FibGVUcmFja2VyIHtcblx0XHR0cmFja0Rpc3Bvc2FibGUoeDogSURpc3Bvc2FibGUpOiB2b2lkIHtcblx0XHRcdGNvbnN0IHN0YWNrID0gbmV3IEVycm9yKCdQb3RlbnRpYWxseSBsZWFrZWQgZGlzcG9zYWJsZScpLnN0YWNrITtcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRpZiAoISh4IGFzIGFueSlbX19pc19kaXNwb3NhYmxlX3RyYWNrZWRfX10pIHtcblx0XHRcdFx0XHRjb25zb2xlLmxvZyhzdGFjayk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIDMwMDApO1xuXHRcdH1cblxuXHRcdHNldFBhcmVudChjaGlsZDogSURpc3Bvc2FibGUsIHBhcmVudDogSURpc3Bvc2FibGUgfCBudWxsKTogdm9pZCB7XG5cdFx0XHRpZiAoY2hpbGQgJiYgY2hpbGQgIT09IERpc3Bvc2FibGUuTm9uZSkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdChjaGlsZCBhcyBhbnkpW19faXNfZGlzcG9zYWJsZV90cmFja2VkX19dID0gdHJ1ZTtcblx0XHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdFx0Ly8gbm9vcFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bWFya0FzRGlzcG9zZWQoZGlzcG9zYWJsZTogSURpc3Bvc2FibGUpOiB2b2lkIHtcblx0XHRcdGlmIChkaXNwb3NhYmxlICYmIGRpc3Bvc2FibGUgIT09IERpc3Bvc2FibGUuTm9uZSkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdChkaXNwb3NhYmxlIGFzIGFueSlbX19pc19kaXNwb3NhYmxlX3RyYWNrZWRfX10gPSB0cnVlO1xuXHRcdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0XHQvLyBub29wXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0bWFya0FzU2luZ2xldG9uKGRpc3Bvc2FibGU6IElEaXNwb3NhYmxlKTogdm9pZCB7IH1cblx0fSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmFja0Rpc3Bvc2FibGU8VCBleHRlbmRzIElEaXNwb3NhYmxlPih4OiBUKTogVCB7XG5cdGRpc3Bvc2FibGVUcmFja2VyPy50cmFja0Rpc3Bvc2FibGUoeCk7XG5cdHJldHVybiB4O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWFya0FzRGlzcG9zZWQoZGlzcG9zYWJsZTogSURpc3Bvc2FibGUpOiB2b2lkIHtcblx0ZGlzcG9zYWJsZVRyYWNrZXI/Lm1hcmtBc0Rpc3Bvc2VkKGRpc3Bvc2FibGUpO1xufVxuXG5mdW5jdGlvbiBzZXRQYXJlbnRPZkRpc3Bvc2FibGUoY2hpbGQ6IElEaXNwb3NhYmxlLCBwYXJlbnQ6IElEaXNwb3NhYmxlIHwgbnVsbCk6IHZvaWQge1xuXHRkaXNwb3NhYmxlVHJhY2tlcj8uc2V0UGFyZW50KGNoaWxkLCBwYXJlbnQpO1xufVxuXG5mdW5jdGlvbiBzZXRQYXJlbnRPZkRpc3Bvc2FibGVzKGNoaWxkcmVuOiBJRGlzcG9zYWJsZVtdLCBwYXJlbnQ6IElEaXNwb3NhYmxlIHwgbnVsbCk6IHZvaWQge1xuXHRpZiAoIWRpc3Bvc2FibGVUcmFja2VyKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cdGZvciAoY29uc3QgY2hpbGQgb2YgY2hpbGRyZW4pIHtcblx0XHRkaXNwb3NhYmxlVHJhY2tlci5zZXRQYXJlbnQoY2hpbGQsIHBhcmVudCk7XG5cdH1cbn1cblxuLyoqXG4gKiBJbmRpY2F0ZXMgdGhhdCB0aGUgZ2l2ZW4gb2JqZWN0IGlzIGEgc2luZ2xldG9uIHdoaWNoIGRvZXMgbm90IG5lZWQgdG8gYmUgZGlzcG9zZWQuXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIG1hcmtBc1NpbmdsZXRvbjxUIGV4dGVuZHMgSURpc3Bvc2FibGU+KHNpbmdsZXRvbjogVCk6IFQge1xuXHRkaXNwb3NhYmxlVHJhY2tlcj8ubWFya0FzU2luZ2xldG9uKHNpbmdsZXRvbik7XG5cdHJldHVybiBzaW5nbGV0b247XG59XG5cbi8vICNlbmRyZWdpb25cblxuLyoqXG4gKiBBbiBvYmplY3QgdGhhdCBwZXJmb3JtcyBhIGNsZWFudXAgb3BlcmF0aW9uIHdoZW4gYC5kaXNwb3NlKClgIGlzIGNhbGxlZC5cbiAqXG4gKiBTb21lIGV4YW1wbGVzIG9mIGhvdyBkaXNwb3NhYmxlcyBhcmUgdXNlZDpcbiAqXG4gKiAtIEFuIGV2ZW50IGxpc3RlbmVyIHRoYXQgcmVtb3ZlcyBpdHNlbGYgd2hlbiBgLmRpc3Bvc2UoKWAgaXMgY2FsbGVkLlxuICogLSBBIHJlc291cmNlIHN1Y2ggYXMgYSBmaWxlIHN5c3RlbSB3YXRjaGVyIHRoYXQgY2xlYW5zIHVwIHRoZSByZXNvdXJjZSB3aGVuIGAuZGlzcG9zZSgpYCBpcyBjYWxsZWQuXG4gKiAtIFRoZSByZXR1cm4gdmFsdWUgZnJvbSByZWdpc3RlcmluZyBhIHByb3ZpZGVyLiBXaGVuIGAuZGlzcG9zZSgpYCBpcyBjYWxsZWQsIHRoZSBwcm92aWRlciBpcyB1bnJlZ2lzdGVyZWQuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSURpc3Bvc2FibGUge1xuXHRkaXNwb3NlKCk6IHZvaWQ7XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgYHRoaW5nYCBpcyB7QGxpbmsgSURpc3Bvc2FibGUgZGlzcG9zYWJsZX0uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0Rpc3Bvc2FibGU8RSBleHRlbmRzIGFueT4odGhpbmc6IEUpOiB0aGluZyBpcyBFICYgSURpc3Bvc2FibGUge1xuXHRyZXR1cm4gdHlwZW9mIHRoaW5nID09PSAnb2JqZWN0JyAmJiB0aGluZyAhPT0gbnVsbCAmJiB0eXBlb2YgKDxJRGlzcG9zYWJsZT48YW55PnRoaW5nKS5kaXNwb3NlID09PSAnZnVuY3Rpb24nICYmICg8SURpc3Bvc2FibGU+PGFueT50aGluZykuZGlzcG9zZS5sZW5ndGggPT09IDA7XG59XG5cbi8qKlxuICogRGlzcG9zZXMgb2YgdGhlIHZhbHVlKHMpIHBhc3NlZCBpbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpc3Bvc2U8VCBleHRlbmRzIElEaXNwb3NhYmxlPihkaXNwb3NhYmxlOiBUKTogVDtcbmV4cG9ydCBmdW5jdGlvbiBkaXNwb3NlPFQgZXh0ZW5kcyBJRGlzcG9zYWJsZT4oZGlzcG9zYWJsZTogVCB8IHVuZGVmaW5lZCk6IFQgfCB1bmRlZmluZWQ7XG5leHBvcnQgZnVuY3Rpb24gZGlzcG9zZTxUIGV4dGVuZHMgSURpc3Bvc2FibGUsIEEgZXh0ZW5kcyBJdGVyYWJsZTxUPiA9IEl0ZXJhYmxlPFQ+PihkaXNwb3NhYmxlczogQSk6IEE7XG5leHBvcnQgZnVuY3Rpb24gZGlzcG9zZTxUIGV4dGVuZHMgSURpc3Bvc2FibGU+KGRpc3Bvc2FibGVzOiBBcnJheTxUPik6IEFycmF5PFQ+O1xuZXhwb3J0IGZ1bmN0aW9uIGRpc3Bvc2U8VCBleHRlbmRzIElEaXNwb3NhYmxlPihkaXNwb3NhYmxlczogUmVhZG9ubHlBcnJheTxUPik6IFJlYWRvbmx5QXJyYXk8VD47XG5leHBvcnQgZnVuY3Rpb24gZGlzcG9zZTxUIGV4dGVuZHMgSURpc3Bvc2FibGU+KGFyZzogVCB8IEl0ZXJhYmxlPFQ+IHwgdW5kZWZpbmVkKTogYW55IHtcblx0aWYgKEl0ZXJhYmxlLmlzKGFyZykpIHtcblx0XHRjb25zdCBlcnJvcnM6IGFueVtdID0gW107XG5cblx0XHRmb3IgKGNvbnN0IGQgb2YgYXJnKSB7XG5cdFx0XHRpZiAoZCkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGQuZGlzcG9zZSgpO1xuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0ZXJyb3JzLnB1c2goZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoZXJyb3JzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0dGhyb3cgZXJyb3JzWzBdO1xuXHRcdH0gZWxzZSBpZiAoZXJyb3JzLmxlbmd0aCA+IDEpIHtcblx0XHRcdHRocm93IG5ldyBBZ2dyZWdhdGVFcnJvcihlcnJvcnMsICdFbmNvdW50ZXJlZCBlcnJvcnMgd2hpbGUgZGlzcG9zaW5nIG9mIHN0b3JlJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIEFycmF5LmlzQXJyYXkoYXJnKSA/IFtdIDogYXJnO1xuXHR9IGVsc2UgaWYgKGFyZykge1xuXHRcdGFyZy5kaXNwb3NlKCk7XG5cdFx0cmV0dXJuIGFyZztcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZGlzcG9zZUlmRGlzcG9zYWJsZTxUIGV4dGVuZHMgSURpc3Bvc2FibGUgfCBvYmplY3Q+KGRpc3Bvc2FibGVzOiBBcnJheTxUPik6IEFycmF5PFQ+IHtcblx0Zm9yIChjb25zdCBkIG9mIGRpc3Bvc2FibGVzKSB7XG5cdFx0aWYgKGlzRGlzcG9zYWJsZShkKSkge1xuXHRcdFx0ZC5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBbXTtcbn1cblxuLyoqXG4gKiBDb21iaW5lIG11bHRpcGxlIGRpc3Bvc2FibGUgdmFsdWVzIGludG8gYSBzaW5nbGUge0BsaW5rIElEaXNwb3NhYmxlfS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbWJpbmVkRGlzcG9zYWJsZSguLi5kaXNwb3NhYmxlczogSURpc3Bvc2FibGVbXSk6IElEaXNwb3NhYmxlIHtcblx0Y29uc3QgcGFyZW50ID0gdG9EaXNwb3NhYmxlKCgpID0+IGRpc3Bvc2UoZGlzcG9zYWJsZXMpKTtcblx0c2V0UGFyZW50T2ZEaXNwb3NhYmxlcyhkaXNwb3NhYmxlcywgcGFyZW50KTtcblx0cmV0dXJuIHBhcmVudDtcbn1cblxuLyoqXG4gKiBUdXJuIGEgZnVuY3Rpb24gdGhhdCBpbXBsZW1lbnRzIGRpc3Bvc2UgaW50byBhbiB7QGxpbmsgSURpc3Bvc2FibGV9LlxuICpcbiAqIEBwYXJhbSBmbiBDbGVhbiB1cCBmdW5jdGlvbiwgZ3VhcmFudGVlZCB0byBiZSBjYWxsZWQgb25seSAqKm9uY2UqKi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvRGlzcG9zYWJsZShmbjogKCkgPT4gdm9pZCk6IElEaXNwb3NhYmxlIHtcblx0Y29uc3Qgc2VsZiA9IHRyYWNrRGlzcG9zYWJsZSh7XG5cdFx0ZGlzcG9zZTogY3JlYXRlU2luZ2xlQ2FsbEZ1bmN0aW9uKCgpID0+IHtcblx0XHRcdG1hcmtBc0Rpc3Bvc2VkKHNlbGYpO1xuXHRcdFx0Zm4oKTtcblx0XHR9KVxuXHR9KTtcblx0cmV0dXJuIHNlbGY7XG59XG5cbi8qKlxuICogTWFuYWdlcyBhIGNvbGxlY3Rpb24gb2YgZGlzcG9zYWJsZSB2YWx1ZXMuXG4gKlxuICogVGhpcyBpcyB0aGUgcHJlZmVycmVkIHdheSB0byBtYW5hZ2UgbXVsdGlwbGUgZGlzcG9zYWJsZXMuIEEgYERpc3Bvc2FibGVTdG9yZWAgaXMgc2FmZXIgdG8gd29yayB3aXRoIHRoYW4gYW5cbiAqIGBJRGlzcG9zYWJsZVtdYCBhcyBpdCBjb25zaWRlcnMgZWRnZSBjYXNlcywgc3VjaCBhcyByZWdpc3RlcmluZyB0aGUgc2FtZSB2YWx1ZSBtdWx0aXBsZSB0aW1lcyBvciBhZGRpbmcgYW4gaXRlbSB0byBhXG4gKiBzdG9yZSB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gZGlzcG9zZWQgb2YuXG4gKi9cbmV4cG9ydCBjbGFzcyBEaXNwb3NhYmxlU3RvcmUgaW1wbGVtZW50cyBJRGlzcG9zYWJsZSB7XG5cblx0c3RhdGljIERJU0FCTEVfRElTUE9TRURfV0FSTklORyA9IGZhbHNlO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3RvRGlzcG9zZSA9IG5ldyBTZXQ8SURpc3Bvc2FibGU+KCk7XG5cdHByaXZhdGUgX2lzRGlzcG9zZWQgPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHR0cmFja0Rpc3Bvc2FibGUodGhpcyk7XG5cdH1cblxuXHQvKipcblx0ICogRGlzcG9zZSBvZiBhbGwgcmVnaXN0ZXJlZCBkaXNwb3NhYmxlcyBhbmQgbWFyayB0aGlzIG9iamVjdCBhcyBkaXNwb3NlZC5cblx0ICpcblx0ICogQW55IGZ1dHVyZSBkaXNwb3NhYmxlcyBhZGRlZCB0byB0aGlzIG9iamVjdCB3aWxsIGJlIGRpc3Bvc2VkIG9mIG9uIGBhZGRgLlxuXHQgKi9cblx0cHVibGljIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2lzRGlzcG9zZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRtYXJrQXNEaXNwb3NlZCh0aGlzKTtcblx0XHR0aGlzLl9pc0Rpc3Bvc2VkID0gdHJ1ZTtcblx0XHR0aGlzLmNsZWFyKCk7XG5cdH1cblxuXHQvKipcblx0ICogQHJldHVybiBgdHJ1ZWAgaWYgdGhpcyBvYmplY3QgaGFzIGJlZW4gZGlzcG9zZWQgb2YuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0IGlzRGlzcG9zZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2lzRGlzcG9zZWQ7XG5cdH1cblxuXHQvKipcblx0ICogRGlzcG9zZSBvZiBhbGwgcmVnaXN0ZXJlZCBkaXNwb3NhYmxlcyBidXQgZG8gbm90IG1hcmsgdGhpcyBvYmplY3QgYXMgZGlzcG9zZWQuXG5cdCAqL1xuXHRwdWJsaWMgY2xlYXIoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3RvRGlzcG9zZS5zaXplID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGRpc3Bvc2UodGhpcy5fdG9EaXNwb3NlKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5fdG9EaXNwb3NlLmNsZWFyKCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEFkZCBhIG5ldyB7QGxpbmsgSURpc3Bvc2FibGUgZGlzcG9zYWJsZX0gdG8gdGhlIGNvbGxlY3Rpb24uXG5cdCAqL1xuXHRwdWJsaWMgYWRkPFQgZXh0ZW5kcyBJRGlzcG9zYWJsZT4obzogVCk6IFQge1xuXHRcdGlmICghbykge1xuXHRcdFx0cmV0dXJuIG87XG5cdFx0fVxuXHRcdGlmICgobyBhcyB1bmtub3duIGFzIERpc3Bvc2FibGVTdG9yZSkgPT09IHRoaXMpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IHJlZ2lzdGVyIGEgZGlzcG9zYWJsZSBvbiBpdHNlbGYhJyk7XG5cdFx0fVxuXG5cdFx0c2V0UGFyZW50T2ZEaXNwb3NhYmxlKG8sIHRoaXMpO1xuXHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRpZiAoIURpc3Bvc2FibGVTdG9yZS5ESVNBQkxFX0RJU1BPU0VEX1dBUk5JTkcpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKG5ldyBFcnJvcignVHJ5aW5nIHRvIGFkZCBhIGRpc3Bvc2FibGUgdG8gYSBEaXNwb3NhYmxlU3RvcmUgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIGRpc3Bvc2VkIG9mLiBUaGUgYWRkZWQgb2JqZWN0IHdpbGwgYmUgbGVha2VkIScpLnN0YWNrKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fdG9EaXNwb3NlLmFkZChvKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbztcblx0fVxuXG5cdC8qKlxuXHQgKiBEZWxldGVzIGEgZGlzcG9zYWJsZSBmcm9tIHN0b3JlIGFuZCBkaXNwb3NlcyBvZiBpdC4gVGhpcyB3aWxsIG5vdCB0aHJvdyBvciB3YXJuIGFuZCBwcm9jZWVkIHRvIGRpc3Bvc2UgdGhlXG5cdCAqIGRpc3Bvc2FibGUgZXZlbiB3aGVuIHRoZSBkaXNwb3NhYmxlIGlzIG5vdCBwYXJ0IGluIHRoZSBzdG9yZS5cblx0ICovXG5cdHB1YmxpYyBkZWxldGU8VCBleHRlbmRzIElEaXNwb3NhYmxlPihvOiBUKTogdm9pZCB7XG5cdFx0aWYgKCFvKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICgobyBhcyB1bmtub3duIGFzIERpc3Bvc2FibGVTdG9yZSkgPT09IHRoaXMpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IGRpc3Bvc2UgYSBkaXNwb3NhYmxlIG9uIGl0c2VsZiEnKTtcblx0XHR9XG5cdFx0dGhpcy5fdG9EaXNwb3NlLmRlbGV0ZShvKTtcblx0XHRvLmRpc3Bvc2UoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBEZWxldGVzIHRoZSB2YWx1ZSBmcm9tIHRoZSBzdG9yZSwgYnV0IGRvZXMgbm90IGRpc3Bvc2UgaXQuXG5cdCAqL1xuXHRwdWJsaWMgZGVsZXRlQW5kTGVhazxUIGV4dGVuZHMgSURpc3Bvc2FibGU+KG86IFQpOiB2b2lkIHtcblx0XHRpZiAoIW8pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX3RvRGlzcG9zZS5oYXMobykpIHtcblx0XHRcdHRoaXMuX3RvRGlzcG9zZS5kZWxldGUobyk7XG5cdFx0XHRzZXRQYXJlbnRPZkRpc3Bvc2FibGUobywgbnVsbCk7XG5cdFx0fVxuXHR9XG59XG5cbi8qKlxuICogQWJzdHJhY3QgYmFzZSBjbGFzcyBmb3IgYSB7QGxpbmsgSURpc3Bvc2FibGUgZGlzcG9zYWJsZX0gb2JqZWN0LlxuICpcbiAqIFN1YmNsYXNzZXMgY2FuIHtAbGlua2NvZGUgX3JlZ2lzdGVyfSBkaXNwb3NhYmxlcyB0aGF0IHdpbGwgYmUgYXV0b21hdGljYWxseSBjbGVhbmVkIHVwIHdoZW4gdGhpcyBvYmplY3QgaXMgZGlzcG9zZWQgb2YuXG4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSURpc3Bvc2FibGUge1xuXG5cdC8qKlxuXHQgKiBBIGRpc3Bvc2FibGUgdGhhdCBkb2VzIG5vdGhpbmcgd2hlbiBpdCBpcyBkaXNwb3NlZCBvZi5cblx0ICpcblx0ICogVE9ETzogVGhpcyBzaG91bGQgbm90IGJlIGEgc3RhdGljIHByb3BlcnR5LlxuXHQgKi9cblx0c3RhdGljIHJlYWRvbmx5IE5vbmUgPSBPYmplY3QuZnJlZXplPElEaXNwb3NhYmxlPih7IGRpc3Bvc2UoKSB7IH0gfSk7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9zdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHR0cmFja0Rpc3Bvc2FibGUodGhpcyk7XG5cdFx0c2V0UGFyZW50T2ZEaXNwb3NhYmxlKHRoaXMuX3N0b3JlLCB0aGlzKTtcblx0fVxuXG5cdHB1YmxpYyBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdG1hcmtBc0Rpc3Bvc2VkKHRoaXMpO1xuXG5cdFx0dGhpcy5fc3RvcmUuZGlzcG9zZSgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFkZHMgYG9gIHRvIHRoZSBjb2xsZWN0aW9uIG9mIGRpc3Bvc2FibGVzIG1hbmFnZWQgYnkgdGhpcyBvYmplY3QuXG5cdCAqL1xuXHRwcm90ZWN0ZWQgX3JlZ2lzdGVyPFQgZXh0ZW5kcyBJRGlzcG9zYWJsZT4obzogVCk6IFQge1xuXHRcdGlmICgobyBhcyB1bmtub3duIGFzIERpc3Bvc2FibGUpID09PSB0aGlzKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCByZWdpc3RlciBhIGRpc3Bvc2FibGUgb24gaXRzZWxmIScpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fc3RvcmUuYWRkKG8pO1xuXHR9XG59XG5cbi8qKlxuICogTWFuYWdlcyB0aGUgbGlmZWN5Y2xlIG9mIGEgZGlzcG9zYWJsZSB2YWx1ZSB0aGF0IG1heSBiZSBjaGFuZ2VkLlxuICpcbiAqIFRoaXMgZW5zdXJlcyB0aGF0IHdoZW4gdGhlIGRpc3Bvc2FibGUgdmFsdWUgaXMgY2hhbmdlZCwgdGhlIHByZXZpb3VzbHkgaGVsZCBkaXNwb3NhYmxlIGlzIGRpc3Bvc2VkIG9mLiBZb3UgY2FuXG4gKiBhbHNvIHJlZ2lzdGVyIGEgYE11dGFibGVEaXNwb3NhYmxlYCBvbiBhIGBEaXNwb3NhYmxlYCB0byBlbnN1cmUgaXQgaXMgYXV0b21hdGljYWxseSBjbGVhbmVkIHVwLlxuICovXG5leHBvcnQgY2xhc3MgTXV0YWJsZURpc3Bvc2FibGU8VCBleHRlbmRzIElEaXNwb3NhYmxlPiBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSBfdmFsdWU/OiBUO1xuXHRwcml2YXRlIF9pc0Rpc3Bvc2VkID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dHJhY2tEaXNwb3NhYmxlKHRoaXMpO1xuXHR9XG5cblx0Z2V0IHZhbHVlKCk6IFQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9pc0Rpc3Bvc2VkID8gdW5kZWZpbmVkIDogdGhpcy5fdmFsdWU7XG5cdH1cblxuXHRzZXQgdmFsdWUodmFsdWU6IFQgfCB1bmRlZmluZWQpIHtcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCB8fCB2YWx1ZSA9PT0gdGhpcy5fdmFsdWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl92YWx1ZT8uZGlzcG9zZSgpO1xuXHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0c2V0UGFyZW50T2ZEaXNwb3NhYmxlKHZhbHVlLCB0aGlzKTtcblx0XHR9XG5cdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXNldHMgdGhlIHN0b3JlZCB2YWx1ZSBhbmQgZGlzcG9zZWQgb2YgdGhlIHByZXZpb3VzbHkgc3RvcmVkIHZhbHVlLlxuXHQgKi9cblx0Y2xlYXIoKTogdm9pZCB7XG5cdFx0dGhpcy52YWx1ZSA9IHVuZGVmaW5lZDtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5faXNEaXNwb3NlZCA9IHRydWU7XG5cdFx0bWFya0FzRGlzcG9zZWQodGhpcyk7XG5cdFx0dGhpcy5fdmFsdWU/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl92YWx1ZSA9IHVuZGVmaW5lZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBDbGVhcnMgdGhlIHZhbHVlLCBidXQgZG9lcyBub3QgZGlzcG9zZSBpdC5cblx0ICogVGhlIG9sZCB2YWx1ZSBpcyByZXR1cm5lZC5cblx0Ki9cblx0Y2xlYXJBbmRMZWFrKCk6IFQgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IG9sZFZhbHVlID0gdGhpcy5fdmFsdWU7XG5cdFx0dGhpcy5fdmFsdWUgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKG9sZFZhbHVlKSB7XG5cdFx0XHRzZXRQYXJlbnRPZkRpc3Bvc2FibGUob2xkVmFsdWUsIG51bGwpO1xuXHRcdH1cblx0XHRyZXR1cm4gb2xkVmFsdWU7XG5cdH1cbn1cblxuLyoqXG4gKiBNYW5hZ2VzIHRoZSBsaWZlY3ljbGUgb2YgYSBkaXNwb3NhYmxlIHZhbHVlIHRoYXQgbWF5IGJlIGNoYW5nZWQgbGlrZSB7QGxpbmsgTXV0YWJsZURpc3Bvc2FibGV9LCBidXQgdGhlIHZhbHVlIG11c3RcbiAqIGV4aXN0IGFuZCBjYW5ub3QgYmUgdW5kZWZpbmVkLlxuICovXG5leHBvcnQgY2xhc3MgTWFuZGF0b3J5TXV0YWJsZURpc3Bvc2FibGU8VCBleHRlbmRzIElEaXNwb3NhYmxlPiBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZSA9IG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxUPigpO1xuXHRwcml2YXRlIF9pc0Rpc3Bvc2VkID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoaW5pdGlhbFZhbHVlOiBUKSB7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZS52YWx1ZSA9IGluaXRpYWxWYWx1ZTtcblx0fVxuXG5cdGdldCB2YWx1ZSgpOiBUIHtcblx0XHRyZXR1cm4gdGhpcy5fZGlzcG9zYWJsZS52YWx1ZSE7XG5cdH1cblxuXHRzZXQgdmFsdWUodmFsdWU6IFQpIHtcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCB8fCB2YWx1ZSA9PT0gdGhpcy5fZGlzcG9zYWJsZS52YWx1ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9kaXNwb3NhYmxlLnZhbHVlID0gdmFsdWU7XG5cdH1cblxuXHRkaXNwb3NlKCkge1xuXHRcdHRoaXMuX2lzRGlzcG9zZWQgPSB0cnVlO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBSZWZDb3VudGVkRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBfY291bnRlcjogbnVtYmVyID0gMTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSxcblx0KSB7IH1cblxuXHRhY3F1aXJlKCkge1xuXHRcdHRoaXMuX2NvdW50ZXIrKztcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdHJlbGVhc2UoKSB7XG5cdFx0aWYgKC0tdGhpcy5fY291bnRlciA9PT0gMCkge1xuXHRcdFx0dGhpcy5fZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9XG59XG5cbi8qKlxuICogQSBzYWZlIGRpc3Bvc2FibGUgY2FuIGJlIGB1bnNldGAgc28gdGhhdCBhIGxlYWtlZCByZWZlcmVuY2UgKGxpc3RlbmVyKVxuICogY2FuIGJlIGN1dC1vZmYuXG4gKi9cbmV4cG9ydCBjbGFzcyBTYWZlRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblxuXHRkaXNwb3NlOiAoKSA9PiB2b2lkID0gKCkgPT4geyB9O1xuXHR1bnNldDogKCkgPT4gdm9pZCA9ICgpID0+IHsgfTtcblx0aXNzZXQ6ICgpID0+IGJvb2xlYW4gPSAoKSA9PiBmYWxzZTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHR0cmFja0Rpc3Bvc2FibGUodGhpcyk7XG5cdH1cblxuXHRzZXQoZm46IEZ1bmN0aW9uKSB7XG5cdFx0bGV0IGNhbGxiYWNrOiBGdW5jdGlvbiB8IHVuZGVmaW5lZCA9IGZuO1xuXHRcdHRoaXMudW5zZXQgPSAoKSA9PiBjYWxsYmFjayA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLmlzc2V0ID0gKCkgPT4gY2FsbGJhY2sgIT09IHVuZGVmaW5lZDtcblx0XHR0aGlzLmRpc3Bvc2UgPSAoKSA9PiB7XG5cdFx0XHRpZiAoY2FsbGJhY2spIHtcblx0XHRcdFx0Y2FsbGJhY2soKTtcblx0XHRcdFx0Y2FsbGJhY2sgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdG1hcmtBc0Rpc3Bvc2VkKHRoaXMpO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUmVmZXJlbmNlPFQ+IGV4dGVuZHMgSURpc3Bvc2FibGUge1xuXHRyZWFkb25seSBvYmplY3Q6IFQ7XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBSZWZlcmVuY2VDb2xsZWN0aW9uPFQ+IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHJlZmVyZW5jZXM6IE1hcDxzdHJpbmcsIHsgcmVhZG9ubHkgb2JqZWN0OiBUOyBjb3VudGVyOiBudW1iZXIgfT4gPSBuZXcgTWFwKCk7XG5cblx0YWNxdWlyZShrZXk6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBJUmVmZXJlbmNlPFQ+IHtcblx0XHRsZXQgcmVmZXJlbmNlID0gdGhpcy5yZWZlcmVuY2VzLmdldChrZXkpO1xuXG5cdFx0aWYgKCFyZWZlcmVuY2UpIHtcblx0XHRcdHJlZmVyZW5jZSA9IHsgY291bnRlcjogMCwgb2JqZWN0OiB0aGlzLmNyZWF0ZVJlZmVyZW5jZWRPYmplY3Qoa2V5LCAuLi5hcmdzKSB9O1xuXHRcdFx0dGhpcy5yZWZlcmVuY2VzLnNldChrZXksIHJlZmVyZW5jZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBvYmplY3QgfSA9IHJlZmVyZW5jZTtcblx0XHRjb25zdCBkaXNwb3NlID0gY3JlYXRlU2luZ2xlQ2FsbEZ1bmN0aW9uKCgpID0+IHtcblx0XHRcdGlmICgtLXJlZmVyZW5jZS5jb3VudGVyID09PSAwKSB7XG5cdFx0XHRcdHRoaXMuZGVzdHJveVJlZmVyZW5jZWRPYmplY3Qoa2V5LCByZWZlcmVuY2Uub2JqZWN0KTtcblx0XHRcdFx0dGhpcy5yZWZlcmVuY2VzLmRlbGV0ZShrZXkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmVmZXJlbmNlLmNvdW50ZXIrKztcblxuXHRcdHJldHVybiB7IG9iamVjdCwgZGlzcG9zZSB9O1xuXHR9XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IGNyZWF0ZVJlZmVyZW5jZWRPYmplY3Qoa2V5OiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogVDtcblx0cHJvdGVjdGVkIGFic3RyYWN0IGRlc3Ryb3lSZWZlcmVuY2VkT2JqZWN0KGtleTogc3RyaW5nLCBvYmplY3Q6IFQpOiB2b2lkO1xufVxuXG4vKipcbiAqIFVud3JhcHMgYSByZWZlcmVuY2UgY29sbGVjdGlvbiBvZiBwcm9taXNlZCB2YWx1ZXMuIE1ha2VzIHN1cmVcbiAqIHJlZmVyZW5jZXMgYXJlIGRpc3Bvc2VkIHdoZW5ldmVyIHByb21pc2VzIGdldCByZWplY3RlZC5cbiAqL1xuZXhwb3J0IGNsYXNzIEFzeW5jUmVmZXJlbmNlQ29sbGVjdGlvbjxUPiB7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWZlcmVuY2VDb2xsZWN0aW9uOiBSZWZlcmVuY2VDb2xsZWN0aW9uPFByb21pc2U8VD4+KSB7IH1cblxuXHRhc3luYyBhY3F1aXJlKGtleTogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8SVJlZmVyZW5jZTxUPj4ge1xuXHRcdGNvbnN0IHJlZiA9IHRoaXMucmVmZXJlbmNlQ29sbGVjdGlvbi5hY3F1aXJlKGtleSwgLi4uYXJncyk7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3Qgb2JqZWN0ID0gYXdhaXQgcmVmLm9iamVjdDtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0b2JqZWN0LFxuXHRcdFx0XHRkaXNwb3NlOiAoKSA9PiByZWYuZGlzcG9zZSgpXG5cdFx0XHR9O1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRyZWYuZGlzcG9zZSgpO1xuXHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBJbW1vcnRhbFJlZmVyZW5jZTxUPiBpbXBsZW1lbnRzIElSZWZlcmVuY2U8VD4ge1xuXHRjb25zdHJ1Y3RvcihwdWJsaWMgb2JqZWN0OiBUKSB7IH1cblx0ZGlzcG9zZSgpOiB2b2lkIHsgLyogbm9vcCAqLyB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkaXNwb3NlT25SZXR1cm4oZm46IChzdG9yZTogRGlzcG9zYWJsZVN0b3JlKSA9PiB2b2lkKTogdm9pZCB7XG5cdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHR0cnkge1xuXHRcdGZuKHN0b3JlKTtcblx0fSBmaW5hbGx5IHtcblx0XHRzdG9yZS5kaXNwb3NlKCk7XG5cdH1cbn1cblxuLyoqXG4gKiBBIG1hcCB0aGUgbWFuYWdlcyB0aGUgbGlmZWN5Y2xlIG9mIHRoZSB2YWx1ZXMgdGhhdCBpdCBzdG9yZXMuXG4gKi9cbmV4cG9ydCBjbGFzcyBEaXNwb3NhYmxlTWFwPEssIFYgZXh0ZW5kcyBJRGlzcG9zYWJsZSA9IElEaXNwb3NhYmxlPiBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zdG9yZSA9IG5ldyBNYXA8SywgVj4oKTtcblx0cHJpdmF0ZSBfaXNEaXNwb3NlZCA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRyYWNrRGlzcG9zYWJsZSh0aGlzKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBEaXNwb3NlcyBvZiBhbGwgc3RvcmVkIHZhbHVlcyBhbmQgbWFyayB0aGlzIG9iamVjdCBhcyBkaXNwb3NlZC5cblx0ICpcblx0ICogVHJ5aW5nIHRvIHVzZSB0aGlzIG9iamVjdCBhZnRlciBpdCBoYXMgYmVlbiBkaXNwb3NlZCBvZiBpcyBhbiBlcnJvci5cblx0ICovXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0bWFya0FzRGlzcG9zZWQodGhpcyk7XG5cdFx0dGhpcy5faXNEaXNwb3NlZCA9IHRydWU7XG5cdFx0dGhpcy5jbGVhckFuZERpc3Bvc2VBbGwoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBEaXNwb3NlcyBvZiBhbGwgc3RvcmVkIHZhbHVlcyBhbmQgY2xlYXIgdGhlIG1hcCwgYnV0IERPIE5PVCBtYXJrIHRoaXMgb2JqZWN0IGFzIGRpc3Bvc2VkLlxuXHQgKi9cblx0Y2xlYXJBbmREaXNwb3NlQWxsKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fc3RvcmUuc2l6ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRkaXNwb3NlKHRoaXMuX3N0b3JlLnZhbHVlcygpKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5fc3RvcmUuY2xlYXIoKTtcblx0XHR9XG5cdH1cblxuXHRoYXMoa2V5OiBLKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0b3JlLmhhcyhrZXkpO1xuXHR9XG5cblx0Z2V0IHNpemUoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RvcmUuc2l6ZTtcblx0fVxuXG5cdGdldChrZXk6IEspOiBWIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RvcmUuZ2V0KGtleSk7XG5cdH1cblxuXHRzZXQoa2V5OiBLLCB2YWx1ZTogViwgc2tpcERpc3Bvc2VPbk92ZXJ3cml0ZSA9IGZhbHNlKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2lzRGlzcG9zZWQpIHtcblx0XHRcdGNvbnNvbGUud2FybihuZXcgRXJyb3IoJ1RyeWluZyB0byBhZGQgYSBkaXNwb3NhYmxlIHRvIGEgRGlzcG9zYWJsZU1hcCB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gZGlzcG9zZWQgb2YuIFRoZSBhZGRlZCBvYmplY3Qgd2lsbCBiZSBsZWFrZWQhJykuc3RhY2spO1xuXHRcdH1cblxuXHRcdGlmICghc2tpcERpc3Bvc2VPbk92ZXJ3cml0ZSkge1xuXHRcdFx0dGhpcy5fc3RvcmUuZ2V0KGtleSk/LmRpc3Bvc2UoKTtcblx0XHR9XG5cblx0XHR0aGlzLl9zdG9yZS5zZXQoa2V5LCB2YWx1ZSk7XG5cdH1cblxuXHQvKipcblx0ICogRGVsZXRlIHRoZSB2YWx1ZSBzdG9yZWQgZm9yIGBrZXlgIGZyb20gdGhpcyBtYXAgYW5kIGFsc28gZGlzcG9zZSBvZiBpdC5cblx0ICovXG5cdGRlbGV0ZUFuZERpc3Bvc2Uoa2V5OiBLKTogdm9pZCB7XG5cdFx0dGhpcy5fc3RvcmUuZ2V0KGtleSk/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9zdG9yZS5kZWxldGUoa2V5KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBEZWxldGUgdGhlIHZhbHVlIHN0b3JlZCBmb3IgYGtleWAgZnJvbSB0aGlzIG1hcCBidXQgcmV0dXJuIGl0LiBUaGUgY2FsbGVyIGlzXG5cdCAqIHJlc3BvbnNpYmxlIGZvciBkaXNwb3Npbmcgb2YgdGhlIHZhbHVlLlxuXHQgKi9cblx0ZGVsZXRlQW5kTGVhayhrZXk6IEspOiBWIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCB2YWx1ZSA9IHRoaXMuX3N0b3JlLmdldChrZXkpO1xuXHRcdHRoaXMuX3N0b3JlLmRlbGV0ZShrZXkpO1xuXHRcdHJldHVybiB2YWx1ZTtcblx0fVxuXG5cdGtleXMoKTogSXRlcmFibGVJdGVyYXRvcjxLPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0b3JlLmtleXMoKTtcblx0fVxuXG5cdHZhbHVlcygpOiBJdGVyYWJsZUl0ZXJhdG9yPFY+IHtcblx0XHRyZXR1cm4gdGhpcy5fc3RvcmUudmFsdWVzKCk7XG5cdH1cblxuXHRbU3ltYm9sLml0ZXJhdG9yXSgpOiBJdGVyYWJsZUl0ZXJhdG9yPFtLLCBWXT4ge1xuXHRcdHJldHVybiB0aGlzLl9zdG9yZVtTeW1ib2wuaXRlcmF0b3JdKCk7XG5cdH1cbn1cblxuLyoqXG4gKiBDYWxsIGB0aGVuYCBvbiBhIFByb21pc2UsIHVubGVzcyB0aGUgcmV0dXJuZWQgZGlzcG9zYWJsZSBpcyBkaXNwb3NlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRoZW5JZk5vdERpc3Bvc2VkPFQ+KHByb21pc2U6IFByb21pc2U8VD4sIHRoZW46IChyZXN1bHQ6IFQpID0+IHZvaWQpOiBJRGlzcG9zYWJsZSB7XG5cdGxldCBkaXNwb3NlZCA9IGZhbHNlO1xuXHRwcm9taXNlLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRpZiAoZGlzcG9zZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhlbihyZXN1bHQpO1xuXHR9KTtcblx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0ZGlzcG9zZWQgPSB0cnVlO1xuXHR9KTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsV0FBVyx3QkFBd0I7QUFDNUMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsY0FBYztBQUN2QixTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGdCQUFnQjtBQVd6QixNQUFNLG9CQUFvQjtBQUMxQixJQUFJLG9CQUErQztBQXlCNUMsTUFBTSx5QkFBdUQ7QUFBQSxFQUE3RDtBQUVOLFNBQWlCLFlBQVksSUFBSSxxQkFBNkIsZUFBYTtBQUMxRSxjQUFRLEtBQUssdUJBQXVCLFNBQVMsRUFBRTtBQUFBLElBQ2hELENBQUM7QUFBQTtBQUFBLEVBRUQsZ0JBQWdCLFlBQStCO0FBQzlDLFVBQU0sUUFBUSxJQUFJLE1BQU0sY0FBYyxFQUFFO0FBQ3hDLFNBQUssVUFBVSxTQUFTLFlBQVksT0FBTyxVQUFVO0FBQUEsRUFDdEQ7QUFBQSxFQUVBLFVBQVUsT0FBb0IsUUFBa0M7QUFDL0QsUUFBSSxRQUFRO0FBQ1gsV0FBSyxVQUFVLFdBQVcsS0FBSztBQUFBLElBQ2hDLE9BQU87QUFDTixXQUFLLGdCQUFnQixLQUFLO0FBQUEsSUFDM0I7QUFBQSxFQUNEO0FBQUEsRUFFQSxlQUFlLFlBQStCO0FBQzdDLFNBQUssVUFBVSxXQUFXLFVBQVU7QUFBQSxFQUNyQztBQUFBLEVBRUEsZ0JBQWdCLFlBQStCO0FB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
