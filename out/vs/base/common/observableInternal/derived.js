import { BaseObservable, _setDerivedOpts } from "./base.js";
import { DebugNameData } from "./debugName.js";
import { BugIndicatingError, DisposableStore, assertFn, onBugIndicatingError, strictEquals } from "./commonFacade/deps.js";
import { getLogger } from "./logging/logging.js";
function derived(computeFnOrOwner, computeFn) {
  if (computeFn !== void 0) {
    return new Derived(
      new DebugNameData(computeFnOrOwner, void 0, computeFn),
      computeFn,
      void 0,
      void 0,
      void 0,
      strictEquals
    );
  }
  return new Derived(
    new DebugNameData(void 0, void 0, computeFnOrOwner),
    computeFnOrOwner,
    void 0,
    void 0,
    void 0,
    strictEquals
  );
}
function derivedWithSetter(owner, computeFn, setter) {
  return new DerivedWithSetter(
    new DebugNameData(owner, void 0, computeFn),
    computeFn,
    void 0,
    void 0,
    void 0,
    strictEquals,
    setter
  );
}
function derivedOpts(options, computeFn) {
  return new Derived(
    new DebugNameData(options.owner, options.debugName, options.debugReferenceFn),
    computeFn,
    void 0,
    void 0,
    options.onLastObserverRemoved,
    options.equalsFn ?? strictEquals
  );
}
_setDerivedOpts(derivedOpts);
function derivedHandleChanges(options, computeFn) {
  return new Derived(
    new DebugNameData(options.owner, options.debugName, void 0),
    computeFn,
    options.createEmptyChangeSummary,
    options.handleChange,
    void 0,
    options.equalityComparer ?? strictEquals
  );
}
function derivedWithStore(computeFnOrOwner, computeFnOrUndefined) {
  let computeFn;
  let owner;
  if (computeFnOrUndefined === void 0) {
    computeFn = computeFnOrOwner;
    owner = void 0;
  } else {
    owner = computeFnOrOwner;
    computeFn = computeFnOrUndefined;
  }
  let store = new DisposableStore();
  return new Derived(
    new DebugNameData(owner, void 0, computeFn),
    (r) => {
      if (store.isDisposed) {
        store = new DisposableStore();
      } else {
        store.clear();
      }
      return computeFn(r, store);
    },
    void 0,
    void 0,
    () => store.dispose(),
    strictEquals
  );
}
function derivedDisposable(computeFnOrOwner, computeFnOrUndefined) {
  let computeFn;
  let owner;
  if (computeFnOrUndefined === void 0) {
    computeFn = computeFnOrOwner;
    owner = void 0;
  } else {
    owner = computeFnOrOwner;
    computeFn = computeFnOrUndefined;
  }
  let store = void 0;
  return new Derived(
    new DebugNameData(owner, void 0, computeFn),
    (r) => {
      if (!store) {
        store = new DisposableStore();
      } else {
        store.clear();
      }
      const result = computeFn(r);
      if (result) {
        store.add(result);
      }
      return result;
    },
    void 0,
    void 0,
    () => {
      if (store) {
        store.dispose();
        store = void 0;
      }
    },
    strictEquals
  );
}
var DerivedState = /* @__PURE__ */ ((DerivedState2) => {
  DerivedState2[DerivedState2["initial"] = 0] = "initial";
  DerivedState2[DerivedState2["dependenciesMightHaveChanged"] = 1] = "dependenciesMightHaveChanged";
  DerivedState2[DerivedState2["stale"] = 2] = "stale";
  DerivedState2[DerivedState2["upToDate"] = 3] = "upToDate";
  return DerivedState2;
})(DerivedState || {});
class Derived extends BaseObservable {
  constructor(_debugNameData, _computeFn, createChangeSummary, _handleChange, _handleLastObserverRemoved = void 0, _equalityComparator) {
    super();
    this._debugNameData = _debugNameData;
    this._computeFn = _computeFn;
    this.createChangeSummary = createChangeSummary;
    this._handleChange = _handleChange;
    this._handleLastObserverRemoved = _handleLastObserverRemoved;
    this._equalityComparator = _equalityComparator;
    this._state = 0 /* initial */;
    this._value = void 0;
    this._updateCount = 0;
    this._dependencies = /* @__PURE__ */ new Set();
    this._dependenciesToBeRemoved = /* @__PURE__ */ new Set();
    this._changeSummary = void 0;
    this._isUpdating = false;
    this._isComputing = false;
    this._removedObserverToCallEndUpdateOn = null;
    // IReader Implementation
    this._isReaderValid = false;
    this._changeSummary = this.createChangeSummary?.();
  }
  get debugName() {
    return this._debugNameData.getDebugName(this) ?? "(anonymous)";
  }
  onLastObserverRemoved() {
    this._state = 0 /* initial */;
    this._value = void 0;
    getLogger()?.handleDerivedCleared(this);
    for (const d of this._dependencies) {
      d.removeObserver(this);
    }
    this._dependencies.clear();
    this._handleLastObserverRemoved?.();
  }
  get() {
    const checkEnabled = false;
    if (this._isComputing && checkEnabled) {
      throw new BugIndicatingError("Cyclic deriveds are not supported yet!");
    }
    if (this._observers.size === 0) {
      let result;
      try {
        this._isReaderValid = true;
        result = this._computeFn(this, this.createChangeSummary?.());
      } finally {
        this._isReaderValid = false;
      }
      this.onLastObserverRemoved();
      return result;
    } else {
      do {
        if (this._state === 1 /* dependenciesMightHaveChanged */) {
          for (const d of this._dependencies) {
            d.reportChanges();
            if (this._state === 2 /* stale */) {
              break;
            }
          }
        }
        if (this._state === 1 /* dependenciesMightHaveChanged */) {
          this._state = 3 /* upToDate */;
        }
        if (this._state !== 3 /* upToDate */) {
          this._recompute();
        }
      } while (this._state !== 3 /* upToDate */);
      return this._value;
    }
  }
  _recompute() {
    const emptySet = this._dependenciesToBeRemoved;
    this._dependenciesToBeRemoved = this._dependencies;
    this._dependencies = emptySet;
    const hadValue = this._state !== 0 /* initial */;
    const oldValue = this._value;
    this._state = 3 /* upToDate */;
    let didChange = false;
    this._isComputing = true;
    try {
      const changeSummary = this._changeSummary;
      this._changeSummary = this.createChangeSummary?.();
      try {
        this._isReaderValid = true;
        this._value = this._computeFn(this, changeSummary);
      } finally {
        this._isReaderValid = false;
        for (const o of this._dependenciesToBeRemoved) {
          o.removeObserver(this);
        }
        this._dependenciesToBeRemoved.clear();
      }
      didChange = hadValue && !this._equalityComparator(oldValue, this._value);
      getLogger()?.handleObservableUpdated(this, {
        oldValue,
        newValue: this._value,
        change: void 0,
        didChange,
        hadValue
      });
    } catch (e) {
      onBugIndicatingError(e);
    }
    this._isComputing = false;
    if (didChange) {
      for (const r of this._observers) {
        r.handleChange(this, void 0);
      }
    }
  }
  toString() {
    return `LazyDerived<${this.debugName}>`;
  }
  // IObserver Implementation
  beginUpdate(_observable) {
    if (this._isUpdating) {
      throw new BugIndicatingError("Cyclic deriveds are not supported yet!");
    }
    this._updateCount++;
    this._isUpdating = true;
    try {
      const propagateBeginUpdate = this._updateCount === 1;
      if (this._state === 3 /* upToDate */) {
        this._state = 1 /* dependenciesMightHaveChanged */;
        if (!propagateBeginUpdate) {
          for (const r of this._observers) {
            r.handlePossibleChange(this);
          }
        }
      }
      if (propagateBeginUpdate) {
        for (const r of this._observers) {
          r.beginUpdate(this);
        }
      }
    } finally {
      this._isUpdating = false;
    }
  }
  endUpdate(_observable) {
    this._updateCount--;
    if (this._updateCount === 0) {
      const observers = [...this._observers];
      for (const r of observers) {
        r.endUpdate(this);
      }
      if (this._removedObserverToCallEndUpdateOn) {
        const observers2 = [...this._removedObserverToCallEndUpdateOn];
        this._removedObserverToCallEndUpdateOn = null;
        for (const r of observers2) {
          r.endUpdate(this);
        }
      }
    }
    assertFn(() => this._updateCount >= 0);
  }
  handlePossibleChange(observable) {
    if (this._state === 3 /* upToDate */ && this._dependencies.has(observable) && !this._dependenciesToBeRemoved.has(observable)) {
      this._state = 1 /* dependenciesMightHaveChanged */;
      for (const r of this._observers) {
        r.handlePossibleChange(this);
      }
    }
  }
  handleChange(observable, change) {
    if (this._dependencies.has(observable) && !this._dependenciesToBeRemoved.has(observable)) {
      getLogger()?.handleDerivedDependencyChanged(this, observable, change);
      let shouldReact = false;
      try {
        shouldReact = this._handleChange ? this._handleChange({
          changedObservable: observable,
          change,
          didChange: (o) => o === observable
        }, this._changeSummary) : true;
      } catch (e) {
        onBugIndicatingError(e);
      }
      const wasUpToDate = this._state === 3 /* upToDate */;
      if (shouldReact && (this._state === 1 /* dependenciesMightHaveChanged */ || wasUpToDate)) {
        this._state = 2 /* stale */;
        if (wasUpToDate) {
          for (const r of this._observers) {
            r.handlePossibleChange(this);
          }
        }
      }
    }
  }
  readObservable(observable) {
    if (!this._isReaderValid) {
      throw new BugIndicatingError("The reader object cannot be used outside its compute function!");
    }
    observable.addObserver(this);
    const value = observable.get();
    this._dependencies.add(observable);
    this._dependenciesToBeRemoved.delete(observable);
    return value;
  }
  addObserver(observer) {
    const shouldCallBeginUpdate = !this._observers.has(observer) && this._updateCount > 0;
    super.addObserver(observer);
    if (shouldCallBeginUpdate) {
      if (this._removedObserverToCallEndUpdateOn && this._removedObserverToCallEndUpdateOn.has(observer)) {
        this._removedObserverToCallEndUpdateOn.delete(observer);
      } else {
        observer.beginUpdate(this);
      }
    }
  }
  removeObserver(observer) {
    if (this._observers.has(observer) && this._updateCount > 0) {
      if (!this._removedObserverToCallEndUpdateOn) {
        this._removedObserverToCallEndUpdateOn = /* @__PURE__ */ new Set();
      }
      this._removedObserverToCallEndUpdateOn.add(observer);
    }
    super.removeObserver(observer);
  }
  debugGetState() {
    return {
      state: this._state,
      updateCount: this._updateCount,
      isComputing: this._isComputing,
      dependencies: this._dependencies,
      value: this._value
    };
  }
  debugSetValue(newValue) {
    this._value = newValue;
  }
}
class DerivedWithSetter extends Derived {
  constructor(debugNameData, computeFn, createChangeSummary, handleChange, handleLastObserverRemoved = void 0, equalityComparator, set) {
    super(
      debugNameData,
      computeFn,
      createChangeSummary,
      handleChange,
      handleLastObserverRemoved,
      equalityComparator
    );
    this.set = set;
  }
}
export {
  Derived,
  DerivedState,
  DerivedWithSetter,
  derived,
  derivedDisposable,
  derivedHandleChanges,
  derivedOpts,
  derivedWithSetter,
  derivedWithStore
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlSW50ZXJuYWwvZGVyaXZlZC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEJhc2VPYnNlcnZhYmxlLCBJQ2hhbmdlQ29udGV4dCwgSU9ic2VydmFibGUsIElPYnNlcnZhYmxlV2l0aENoYW5nZSwgSU9ic2VydmVyLCBJUmVhZGVyLCBJU2V0dGFibGVPYnNlcnZhYmxlLCBJVHJhbnNhY3Rpb24sIF9zZXREZXJpdmVkT3B0cywgfSBmcm9tICcuL2Jhc2UuanMnO1xuaW1wb3J0IHsgRGVidWdOYW1lRGF0YSwgRGVidWdPd25lciwgSURlYnVnTmFtZURhdGEgfSBmcm9tICcuL2RlYnVnTmFtZS5qcyc7XG5pbXBvcnQgeyBCdWdJbmRpY2F0aW5nRXJyb3IsIERpc3Bvc2FibGVTdG9yZSwgRXF1YWxpdHlDb21wYXJlciwgSURpc3Bvc2FibGUsIGFzc2VydEZuLCBvbkJ1Z0luZGljYXRpbmdFcnJvciwgc3RyaWN0RXF1YWxzIH0gZnJvbSAnLi9jb21tb25GYWNhZGUvZGVwcy5qcyc7XG5pbXBvcnQgeyBnZXRMb2dnZXIgfSBmcm9tICcuL2xvZ2dpbmcvbG9nZ2luZy5qcyc7XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBvYnNlcnZhYmxlIHRoYXQgaXMgZGVyaXZlZCBmcm9tIG90aGVyIG9ic2VydmFibGVzLlxuICogVGhlIHZhbHVlIGlzIG9ubHkgcmVjb21wdXRlZCB3aGVuIGFic29sdXRlbHkgbmVlZGVkLlxuICpcbiAqIHtAbGluayBjb21wdXRlRm59IHNob3VsZCBzdGFydCB3aXRoIGEgSlMgRG9jIHVzaW5nIGBAZGVzY3JpcHRpb25gIHRvIG5hbWUgdGhlIGRlcml2ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZXJpdmVkPFQ+KGNvbXB1dGVGbjogKHJlYWRlcjogSVJlYWRlcikgPT4gVCk6IElPYnNlcnZhYmxlPFQ+O1xuZXhwb3J0IGZ1bmN0aW9uIGRlcml2ZWQ8VD4ob3duZXI6IERlYnVnT3duZXIsIGNvbXB1dGVGbjogKHJlYWRlcjogSVJlYWRlcikgPT4gVCk6IElPYnNlcnZhYmxlPFQ+O1xuZXhwb3J0IGZ1bmN0aW9uIGRlcml2ZWQ8VD4oY29tcHV0ZUZuT3JPd25lcjogKChyZWFkZXI6IElSZWFkZXIpID0+IFQpIHwgRGVidWdPd25lciwgY29tcHV0ZUZuPzogKChyZWFkZXI6IElSZWFkZXIpID0+IFQpIHwgdW5kZWZpbmVkKTogSU9ic2VydmFibGU8VD4ge1xuXHRpZiAoY29tcHV0ZUZuICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gbmV3IERlcml2ZWQoXG5cdFx0XHRuZXcgRGVidWdOYW1lRGF0YShjb21wdXRlRm5Pck93bmVyLCB1bmRlZmluZWQsIGNvbXB1dGVGbiksXG5cdFx0XHRjb21wdXRlRm4sXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRzdHJpY3RFcXVhbHNcblx0XHQpO1xuXHR9XG5cdHJldHVybiBuZXcgRGVyaXZlZChcblx0XHRuZXcgRGVidWdOYW1lRGF0YSh1bmRlZmluZWQsIHVuZGVmaW5lZCwgY29tcHV0ZUZuT3JPd25lciBhcyBhbnkpLFxuXHRcdGNvbXB1dGVGbk9yT3duZXIgYXMgYW55LFxuXHRcdHVuZGVmaW5lZCxcblx0XHR1bmRlZmluZWQsXG5cdFx0dW5kZWZpbmVkLFxuXHRcdHN0cmljdEVxdWFsc1xuXHQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVyaXZlZFdpdGhTZXR0ZXI8VD4ob3duZXI6IERlYnVnT3duZXIgfCB1bmRlZmluZWQsIGNvbXB1dGVGbjogKHJlYWRlcjogSVJlYWRlcikgPT4gVCwgc2V0dGVyOiAodmFsdWU6IFQsIHRyYW5zYWN0aW9uOiBJVHJhbnNhY3Rpb24gfCB1bmRlZmluZWQpID0+IHZvaWQpOiBJU2V0dGFibGVPYnNlcnZhYmxlPFQ+IHtcblx0cmV0dXJuIG5ldyBEZXJpdmVkV2l0aFNldHRlcihcblx0XHRuZXcgRGVidWdOYW1lRGF0YShvd25lciwgdW5kZWZpbmVkLCBjb21wdXRlRm4pLFxuXHRcdGNvbXB1dGVGbixcblx0XHR1bmRlZmluZWQsXG5cdFx0dW5kZWZpbmVkLFxuXHRcdHVuZGVmaW5lZCxcblx0XHRzdHJpY3RFcXVhbHMsXG5cdFx0c2V0dGVyLFxuXHQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVyaXZlZE9wdHM8VD4oXG5cdG9wdGlvbnM6IElEZWJ1Z05hbWVEYXRhICYge1xuXHRcdGVxdWFsc0ZuPzogRXF1YWxpdHlDb21wYXJlcjxUPjtcblx0XHRvbkxhc3RPYnNlcnZlclJlbW92ZWQ/OiAoKCkgPT4gdm9pZCk7XG5cdH0sXG5cdGNvbXB1dGVGbjogKHJlYWRlcjogSVJlYWRlcikgPT4gVFxuKTogSU9ic2VydmFibGU8VD4ge1xuXHRyZXR1cm4gbmV3IERlcml2ZWQoXG5cdFx0bmV3IERlYnVnTmFtZURhdGEob3B0aW9ucy5vd25lciwgb3B0aW9ucy5kZWJ1Z05hbWUsIG9wdGlvbnMuZGVidWdSZWZlcmVuY2VGbiksXG5cdFx0Y29tcHV0ZUZuLFxuXHRcdHVuZGVmaW5lZCxcblx0XHR1bmRlZmluZWQsXG5cdFx0b3B0aW9ucy5vbkxhc3RPYnNlcnZlclJlbW92ZWQsXG5cdFx0b3B0aW9ucy5lcXVhbHNGbiA/PyBzdHJpY3RFcXVhbHNcblx0KTtcbn1cblxuX3NldERlcml2ZWRPcHRzKGRlcml2ZWRPcHRzKTtcblxuLyoqXG4gKiBSZXByZXNlbnRzIGFuIG9ic2VydmFibGUgdGhhdCBpcyBkZXJpdmVkIGZyb20gb3RoZXIgb2JzZXJ2YWJsZXMuXG4gKiBUaGUgdmFsdWUgaXMgb25seSByZWNvbXB1dGVkIHdoZW4gYWJzb2x1dGVseSBuZWVkZWQuXG4gKlxuICoge0BsaW5rIGNvbXB1dGVGbn0gc2hvdWxkIHN0YXJ0IHdpdGggYSBKUyBEb2MgdXNpbmcgYEBkZXNjcmlwdGlvbmAgdG8gbmFtZSB0aGUgZGVyaXZlZC5cbiAqXG4gKiBVc2UgYGNyZWF0ZUVtcHR5Q2hhbmdlU3VtbWFyeWAgdG8gY3JlYXRlIGEgXCJjaGFuZ2Ugc3VtbWFyeVwiIHRoYXQgY2FuIGNvbGxlY3QgdGhlIGNoYW5nZXMuXG4gKiBVc2UgYGhhbmRsZUNoYW5nZWAgdG8gYWRkIGEgcmVwb3J0ZWQgY2hhbmdlIHRvIHRoZSBjaGFuZ2Ugc3VtbWFyeS5cbiAqIFRoZSBjb21wdXRlIGZ1bmN0aW9uIGlzIGdpdmVuIHRoZSBsYXN0IGNoYW5nZSBzdW1tYXJ5LlxuICogVGhlIGNoYW5nZSBzdW1tYXJ5IGlzIGRpc2NhcmRlZCBhZnRlciB0aGUgY29tcHV0ZSBmdW5jdGlvbiB3YXMgY2FsbGVkLlxuICpcbiAqIEBzZWUgZGVyaXZlZFxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVyaXZlZEhhbmRsZUNoYW5nZXM8VCwgVENoYW5nZVN1bW1hcnk+KFxuXHRvcHRpb25zOiBJRGVidWdOYW1lRGF0YSAmIHtcblx0XHRjcmVhdGVFbXB0eUNoYW5nZVN1bW1hcnk6ICgpID0+IFRDaGFuZ2VTdW1tYXJ5O1xuXHRcdGhhbmRsZUNoYW5nZTogKGNvbnRleHQ6IElDaGFuZ2VDb250ZXh0LCBjaGFuZ2VTdW1tYXJ5OiBUQ2hhbmdlU3VtbWFyeSkgPT4gYm9vbGVhbjtcblx0XHRlcXVhbGl0eUNvbXBhcmVyPzogRXF1YWxpdHlDb21wYXJlcjxUPjtcblx0fSxcblx0Y29tcHV0ZUZuOiAocmVhZGVyOiBJUmVhZGVyLCBjaGFuZ2VTdW1tYXJ5OiBUQ2hhbmdlU3VtbWFyeSkgPT4gVFxuKTogSU9ic2VydmFibGU8VD4ge1xuXHRyZXR1cm4gbmV3IERlcml2ZWQoXG5cdFx0bmV3IERlYnVnTmFtZURhdGEob3B0aW9ucy5vd25lciwgb3B0aW9ucy5kZWJ1Z05hbWUsIHVuZGVmaW5lZCksXG5cdFx0Y29tcHV0ZUZuLFxuXHRcdG9wdGlvbnMuY3JlYXRlRW1wdHlDaGFuZ2VTdW1tYXJ5LFxuXHRcdG9wdGlvbnMuaGFuZGxlQ2hhbmdlLFxuXHRcdHVuZGVmaW5lZCxcblx0XHRvcHRpb25zLmVxdWFsaXR5Q29tcGFyZXIgPz8gc3RyaWN0RXF1YWxzXG5cdCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZXJpdmVkV2l0aFN0b3JlPFQ+KGNvbXB1dGVGbjogKHJlYWRlcjogSVJlYWRlciwgc3RvcmU6IERpc3Bvc2FibGVTdG9yZSkgPT4gVCk6IElPYnNlcnZhYmxlPFQ+O1xuZXhwb3J0IGZ1bmN0aW9uIGRlcml2ZWRXaXRoU3RvcmU8VD4ob3duZXI6IERlYnVnT3duZXIsIGNvbXB1dGVGbjogKHJlYWRlcjogSVJlYWRlciwgc3RvcmU6IERpc3Bvc2FibGVTdG9yZSkgPT4gVCk6IElPYnNlcnZhYmxlPFQ+O1xuZXhwb3J0IGZ1bmN0aW9uIGRlcml2ZWRXaXRoU3RvcmU8VD4oY29tcHV0ZUZuT3JPd25lcjogKChyZWFkZXI6IElSZWFkZXIsIHN0b3JlOiBEaXNwb3NhYmxlU3RvcmUpID0+IFQpIHwgRGVidWdPd25lciwgY29tcHV0ZUZuT3JVbmRlZmluZWQ/OiAoKHJlYWRlcjogSVJlYWRlciwgc3RvcmU6IERpc3Bvc2FibGVTdG9yZSkgPT4gVCkpOiBJT2JzZXJ2YWJsZTxUPiB7XG5cdGxldCBjb21wdXRlRm46IChyZWFkZXI6IElSZWFkZXIsIHN0b3JlOiBEaXNwb3NhYmxlU3RvcmUpID0+IFQ7XG5cdGxldCBvd25lcjogRGVidWdPd25lcjtcblx0aWYgKGNvbXB1dGVGbk9yVW5kZWZpbmVkID09PSB1bmRlZmluZWQpIHtcblx0XHRjb21wdXRlRm4gPSBjb21wdXRlRm5Pck93bmVyIGFzIGFueTtcblx0XHRvd25lciA9IHVuZGVmaW5lZDtcblx0fSBlbHNlIHtcblx0XHRvd25lciA9IGNvbXB1dGVGbk9yT3duZXI7XG5cdFx0Y29tcHV0ZUZuID0gY29tcHV0ZUZuT3JVbmRlZmluZWQgYXMgYW55O1xuXHR9XG5cblx0Ly8gSW50ZW50aW9uYWxseSByZS1hc3NpZ25lZCBpbiBjYXNlIGFuIGluYWN0aXZlIG9ic2VydmFibGUgaXMgcmUtdXNlZCBsYXRlclxuXHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbG9jYWwvY29kZS1uby1wb3RlbnRpYWxseS11bnNhZmUtZGlzcG9zYWJsZXNcblx0bGV0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdHJldHVybiBuZXcgRGVyaXZlZChcblx0XHRuZXcgRGVidWdOYW1lRGF0YShvd25lciwgdW5kZWZpbmVkLCBjb21wdXRlRm4pLFxuXHRcdHIgPT4ge1xuXHRcdFx0aWYgKHN0b3JlLmlzRGlzcG9zZWQpIHtcblx0XHRcdFx0c3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzdG9yZS5jbGVhcigpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGNvbXB1dGVGbihyLCBzdG9yZSk7XG5cdFx0fSwgdW5kZWZpbmVkLFxuXHRcdHVuZGVmaW5lZCxcblx0XHQoKSA9PiBzdG9yZS5kaXNwb3NlKCksXG5cdFx0c3RyaWN0RXF1YWxzLFxuXHQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVyaXZlZERpc3Bvc2FibGU8VCBleHRlbmRzIElEaXNwb3NhYmxlIHwgdW5kZWZpbmVkPihjb21wdXRlRm46IChyZWFkZXI6IElSZWFkZXIpID0+IFQpOiBJT2JzZXJ2YWJsZTxUPjtcbmV4cG9ydCBmdW5jdGlvbiBkZXJpdmVkRGlzcG9zYWJsZTxUIGV4dGVuZHMgSURpc3Bvc2FibGUgfCB1bmRlZmluZWQ+KG93bmVyOiBEZWJ1Z093bmVyLCBjb21wdXRlRm46IChyZWFkZXI6IElSZWFkZXIpID0+IFQpOiBJT2JzZXJ2YWJsZTxUPjtcbmV4cG9ydCBmdW5jdGlvbiBkZXJpdmVkRGlzcG9zYWJsZTxUIGV4dGVuZHMgSURpc3Bvc2FibGUgfCB1bmRlZmluZWQ+KGNvbXB1dGVGbk9yT3duZXI6ICgocmVhZGVyOiBJUmVhZGVyKSA9PiBUKSB8IERlYnVnT3duZXIsIGNvbXB1dGVGbk9yVW5kZWZpbmVkPzogKChyZWFkZXI6IElSZWFkZXIpID0+IFQpKTogSU9ic2VydmFibGU8VD4ge1xuXHRsZXQgY29tcHV0ZUZuOiAocmVhZGVyOiBJUmVhZGVyKSA9PiBUO1xuXHRsZXQgb3duZXI6IERlYnVnT3duZXI7XG5cdGlmIChjb21wdXRlRm5PclVuZGVmaW5lZCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0Y29tcHV0ZUZuID0gY29tcHV0ZUZuT3JPd25lciBhcyBhbnk7XG5cdFx0b3duZXIgPSB1bmRlZmluZWQ7XG5cdH0gZWxzZSB7XG5cdFx0b3duZXIgPSBjb21wdXRlRm5Pck93bmVyO1xuXHRcdGNvbXB1dGVGbiA9IGNvbXB1dGVGbk9yVW5kZWZpbmVkIGFzIGFueTtcblx0fVxuXG5cdGxldCBzdG9yZTogRGlzcG9zYWJsZVN0b3JlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRyZXR1cm4gbmV3IERlcml2ZWQoXG5cdFx0bmV3IERlYnVnTmFtZURhdGEob3duZXIsIHVuZGVmaW5lZCwgY29tcHV0ZUZuKSxcblx0XHRyID0+IHtcblx0XHRcdGlmICghc3RvcmUpIHtcblx0XHRcdFx0c3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzdG9yZS5jbGVhcigpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gY29tcHV0ZUZuKHIpO1xuXHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRzdG9yZS5hZGQocmVzdWx0KTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fSwgdW5kZWZpbmVkLFxuXHRcdHVuZGVmaW5lZCxcblx0XHQoKSA9PiB7XG5cdFx0XHRpZiAoc3RvcmUpIHtcblx0XHRcdFx0c3RvcmUuZGlzcG9zZSgpO1xuXHRcdFx0XHRzdG9yZSA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9LFxuXHRcdHN0cmljdEVxdWFsc1xuXHQpO1xufVxuXG5leHBvcnQgY29uc3QgZW51bSBEZXJpdmVkU3RhdGUge1xuXHQvKiogSW5pdGlhbCBzdGF0ZSwgbm8gcHJldmlvdXMgdmFsdWUsIHJlY29tcHV0YXRpb24gbmVlZGVkICovXG5cdGluaXRpYWwgPSAwLFxuXG5cdC8qKlxuXHQgKiBBIGRlcGVuZGVuY3kgY291bGQgaGF2ZSBjaGFuZ2VkLlxuXHQgKiBXZSBuZWVkIHRvIGV4cGxpY2l0bHkgYXNrIHRoZW0gaWYgYXQgbGVhc3Qgb25lIGRlcGVuZGVuY3kgY2hhbmdlZC5cblx0ICovXG5cdGRlcGVuZGVuY2llc01pZ2h0SGF2ZUNoYW5nZWQgPSAxLFxuXG5cdC8qKlxuXHQgKiBBIGRlcGVuZGVuY3kgY2hhbmdlZCBhbmQgd2UgbmVlZCB0byByZWNvbXB1dGUuXG5cdCAqIEFmdGVyIHJlY29tcHV0YXRpb24sIHdlIG5lZWQgdG8gY2hlY2sgdGhlIHByZXZpb3VzIHZhbHVlIHRvIHNlZSBpZiB3ZSBjaGFuZ2VkIGFzIHdlbGwuXG5cdCAqL1xuXHRzdGFsZSA9IDIsXG5cblx0LyoqXG5cdCAqIE5vIGNoYW5nZSByZXBvcnRlZCwgb3VyIGNhY2hlZCB2YWx1ZSBpcyB1cCB0byBkYXRlLlxuXHQgKi9cblx0dXBUb0RhdGUgPSAzLFxufVxuXG5leHBvcnQgY2xhc3MgRGVyaXZlZDxULCBUQ2hhbmdlU3VtbWFyeSA9IGFueT4gZXh0ZW5kcyBCYXNlT2JzZXJ2YWJsZTxULCB2b2lkPiBpbXBsZW1lbnRzIElSZWFkZXIsIElPYnNlcnZlciB7XG5cdHByaXZhdGUgX3N0YXRlID0gRGVyaXZlZFN0YXRlLmluaXRpYWw7XG5cdHByaXZhdGUgX3ZhbHVlOiBUIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIF91cGRhdGVDb3VudCA9IDA7XG5cdHByaXZhdGUgX2RlcGVuZGVuY2llcyA9IG5ldyBTZXQ8SU9ic2VydmFibGU8YW55Pj4oKTtcblx0cHJpdmF0ZSBfZGVwZW5kZW5jaWVzVG9CZVJlbW92ZWQgPSBuZXcgU2V0PElPYnNlcnZhYmxlPGFueT4+KCk7XG5cdHByaXZhdGUgX2NoYW5nZVN1bW1hcnk6IFRDaGFuZ2VTdW1tYXJ5IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9pc1VwZGF0aW5nID0gZmFsc2U7XG5cdHByaXZhdGUgX2lzQ29tcHV0aW5nID0gZmFsc2U7XG5cblx0cHVibGljIG92ZXJyaWRlIGdldCBkZWJ1Z05hbWUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5fZGVidWdOYW1lRGF0YS5nZXREZWJ1Z05hbWUodGhpcykgPz8gJyhhbm9ueW1vdXMpJztcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBfZGVidWdOYW1lRGF0YTogRGVidWdOYW1lRGF0YSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgX2NvbXB1dGVGbjogKHJlYWRlcjogSVJlYWRlciwgY2hhbmdlU3VtbWFyeTogVENoYW5nZVN1bW1hcnkpID0+IFQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjcmVhdGVDaGFuZ2VTdW1tYXJ5OiAoKCkgPT4gVENoYW5nZVN1bW1hcnkpIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2hhbmRsZUNoYW5nZTogKChjb250ZXh0OiBJQ2hhbmdlQ29udGV4dCwgc3VtbWFyeTogVENoYW5nZVN1bW1hcnkpID0+IGJvb2xlYW4pIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2hhbmRsZUxhc3RPYnNlcnZlclJlbW92ZWQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lcXVhbGl0eUNvbXBhcmF0b3I6IEVxdWFsaXR5Q29tcGFyZXI8VD4sXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fY2hhbmdlU3VtbWFyeSA9IHRoaXMuY3JlYXRlQ2hhbmdlU3VtbWFyeT8uKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgb25MYXN0T2JzZXJ2ZXJSZW1vdmVkKCk6IHZvaWQge1xuXHRcdC8qKlxuXHRcdCAqIFdlIGFyZSBub3QgdHJhY2tpbmcgY2hhbmdlcyBhbnltb3JlLCB0aHVzIHdlIGhhdmUgdG8gYXNzdW1lXG5cdFx0ICogdGhhdCBvdXIgY2FjaGUgaXMgaW52YWxpZC5cblx0XHQgKi9cblx0XHR0aGlzLl9zdGF0ZSA9IERlcml2ZWRTdGF0ZS5pbml0aWFsO1xuXHRcdHRoaXMuX3ZhbHVlID0gdW5kZWZpbmVkO1xuXHRcdGdldExvZ2dlcigpPy5oYW5kbGVEZXJpdmVkQ2xlYXJlZCh0aGlzKTtcblx0XHRmb3IgKGNvbnN0IGQgb2YgdGhpcy5fZGVwZW5kZW5jaWVzKSB7XG5cdFx0XHRkLnJlbW92ZU9ic2VydmVyKHRoaXMpO1xuXHRcdH1cblx0XHR0aGlzLl9kZXBlbmRlbmNpZXMuY2xlYXIoKTtcblxuXHRcdHRoaXMuX2hhbmRsZUxhc3RPYnNlcnZlclJlbW92ZWQ/LigpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGdldCgpOiBUIHtcblx0XHRjb25zdCBjaGVja0VuYWJsZWQgPSBmYWxzZTsgLy8gVE9ETyBzZXQgdG8gdHJ1ZVxuXHRcdGlmICh0aGlzLl9pc0NvbXB1dGluZyAmJiBjaGVja0VuYWJsZWQpIHtcblx0XHRcdC8vIGludmVzdGlnYXRlIHdoeSB0aGlzIGZhaWxzIGluIHRoZSBkaWZmIGVkaXRvciFcblx0XHRcdHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoJ0N5Y2xpYyBkZXJpdmVkcyBhcmUgbm90IHN1cHBvcnRlZCB5ZXQhJyk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX29ic2VydmVycy5zaXplID09PSAwKSB7XG5cdFx0XHRsZXQgcmVzdWx0O1xuXHRcdFx0Ly8gV2l0aG91dCBvYnNlcnZlcnMsIHdlIGRvbid0IGtub3cgd2hlbiB0byBjbGVhbiB1cCBzdHVmZi5cblx0XHRcdC8vIFRodXMsIHdlIGRvbid0IGNhY2hlIGFueXRoaW5nIHRvIHByZXZlbnQgbWVtb3J5IGxlYWtzLlxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGhpcy5faXNSZWFkZXJWYWxpZCA9IHRydWU7XG5cdFx0XHRcdHJlc3VsdCA9IHRoaXMuX2NvbXB1dGVGbih0aGlzLCB0aGlzLmNyZWF0ZUNoYW5nZVN1bW1hcnk/LigpISk7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHR0aGlzLl9pc1JlYWRlclZhbGlkID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHQvLyBDbGVhciBuZXcgZGVwZW5kZW5jaWVzXG5cdFx0XHR0aGlzLm9uTGFzdE9ic2VydmVyUmVtb3ZlZCgpO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblxuXHRcdH0gZWxzZSB7XG5cdFx0XHRkbyB7XG5cdFx0XHRcdC8vIFdlIG1pZ2h0IG5vdCBnZXQgYSBub3RpZmljYXRpb24gZm9yIGEgZGVwZW5kZW5jeSB0aGF0IGNoYW5nZWQgd2hpbGUgaXQgaXMgdXBkYXRpbmcsXG5cdFx0XHRcdC8vIHRodXMgd2UgYWxzbyBoYXZlIHRvIGFzayBhbGwgb3VyIGRlcGVkZW5jaWVzIGlmIHRoZXkgY2hhbmdlZCBpbiB0aGlzIGNhc2UuXG5cdFx0XHRcdGlmICh0aGlzLl9zdGF0ZSA9PT0gRGVyaXZlZFN0YXRlLmRlcGVuZGVuY2llc01pZ2h0SGF2ZUNoYW5nZWQpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGQgb2YgdGhpcy5fZGVwZW5kZW5jaWVzKSB7XG5cdFx0XHRcdFx0XHQvKiogbWlnaHQgY2FsbCB7QGxpbmsgaGFuZGxlQ2hhbmdlfSBpbmRpcmVjdGx5LCB3aGljaCBjb3VsZCBtYWtlIHVzIHN0YWxlICovXG5cdFx0XHRcdFx0XHRkLnJlcG9ydENoYW5nZXMoKTtcblxuXHRcdFx0XHRcdFx0aWYgKHRoaXMuX3N0YXRlIGFzIERlcml2ZWRTdGF0ZSA9PT0gRGVyaXZlZFN0YXRlLnN0YWxlKSB7XG5cdFx0XHRcdFx0XHRcdC8vIFRoZSBvdGhlciBkZXBlbmRlbmNpZXMgd2lsbCByZWZyZXNoIG9uIGRlbWFuZCwgc28gZWFybHkgYnJlYWtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gV2UgY2FsbGVkIHJlcG9ydCBjaGFuZ2VzIG9mIGFsbCBkZXBlbmRlbmNpZXMuXG5cdFx0XHRcdC8vIElmIHdlIGFyZSBzdGlsbCBub3Qgc3RhbGUsIHdlIGNhbiBhc3N1bWUgdG8gYmUgdXAgdG8gZGF0ZSBhZ2Fpbi5cblx0XHRcdFx0aWYgKHRoaXMuX3N0YXRlID09PSBEZXJpdmVkU3RhdGUuZGVwZW5kZW5jaWVzTWlnaHRIYXZlQ2hhbmdlZCkge1xuXHRcdFx0XHRcdHRoaXMuX3N0YXRlID0gRGVyaXZlZFN0YXRlLnVwVG9EYXRlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHRoaXMuX3N0YXRlICE9PSBEZXJpdmVkU3RhdGUudXBUb0RhdGUpIHtcblx0XHRcdFx0XHR0aGlzLl9yZWNvbXB1dGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBJbiBjYXNlIHJlY29tcHV0YXRpb24gY2hhbmdlZCBvbmUgb2Ygb3VyIGRlcGVuZGVuY2llcywgd2UgbmVlZCB0byByZWNvbXB1dGUgYWdhaW4uXG5cdFx0XHR9IHdoaWxlICh0aGlzLl9zdGF0ZSAhPT0gRGVyaXZlZFN0YXRlLnVwVG9EYXRlKTtcblx0XHRcdHJldHVybiB0aGlzLl92YWx1ZSE7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVjb21wdXRlKCkge1xuXHRcdGNvbnN0IGVtcHR5U2V0ID0gdGhpcy5fZGVwZW5kZW5jaWVzVG9CZVJlbW92ZWQ7XG5cdFx0dGhpcy5fZGVwZW5kZW5jaWVzVG9CZVJlbW92ZWQgPSB0aGlzLl9kZXBlbmRlbmNpZXM7XG5cdFx0dGhpcy5fZGVwZW5kZW5jaWVzID0gZW1wdHlTZXQ7XG5cblx0XHRjb25zdCBoYWRWYWx1ZSA9IHRoaXMuX3N0YXRlICE9PSBEZXJpdmVkU3RhdGUuaW5pdGlhbDtcblx0XHRjb25zdCBvbGRWYWx1ZSA9IHRoaXMuX3ZhbHVlO1xuXHRcdHRoaXMuX3N0YXRlID0gRGVyaXZlZFN0YXRlLnVwVG9EYXRlO1xuXG5cdFx0bGV0IGRpZENoYW5nZSA9IGZhbHNlO1xuXG5cdFx0dGhpcy5faXNDb21wdXRpbmcgPSB0cnVlO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGNoYW5nZVN1bW1hcnkgPSB0aGlzLl9jaGFuZ2VTdW1tYXJ5ITtcblx0XHRcdHRoaXMuX2NoYW5nZVN1bW1hcnkgPSB0aGlzLmNyZWF0ZUNoYW5nZVN1bW1hcnk/LigpO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGhpcy5faXNSZWFkZXJWYWxpZCA9IHRydWU7XG5cdFx0XHRcdC8qKiBtaWdodCBjYWxsIHtAbGluayBoYW5kbGVDaGFuZ2V9IGluZGlyZWN0bHksIHdoaWNoIGNvdWxkIGludmFsaWRhdGUgdXMgKi9cblx0XHRcdFx0dGhpcy5fdmFsdWUgPSB0aGlzLl9jb21wdXRlRm4odGhpcywgY2hhbmdlU3VtbWFyeSk7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHR0aGlzLl9pc1JlYWRlclZhbGlkID0gZmFsc2U7XG5cdFx0XHRcdC8vIFdlIGRvbid0IHdhbnQgb3VyIG9ic2VydmVkIG9ic2VydmFibGVzIHRvIHRoaW5rIHRoYXQgdGhleSBhcmUgKG5vdCBldmVuIHRlbXBvcmFyaWx5KSBub3QgYmVpbmcgb2JzZXJ2ZWQuXG5cdFx0XHRcdC8vIFRodXMsIHdlIG9ubHkgdW5zdWJzY3JpYmUgZnJvbSBvYnNlcnZhYmxlcyB0aGF0IGFyZSBkZWZpbml0ZWx5IG5vdCByZWFkIGFueW1vcmUuXG5cdFx0XHRcdGZvciAoY29uc3QgbyBvZiB0aGlzLl9kZXBlbmRlbmNpZXNUb0JlUmVtb3ZlZCkge1xuXHRcdFx0XHRcdG8ucmVtb3ZlT2JzZXJ2ZXIodGhpcyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fZGVwZW5kZW5jaWVzVG9CZVJlbW92ZWQuY2xlYXIoKTtcblx0XHRcdH1cblxuXHRcdFx0ZGlkQ2hhbmdlID0gaGFkVmFsdWUgJiYgISh0aGlzLl9lcXVhbGl0eUNvbXBhcmF0b3Iob2xkVmFsdWUhLCB0aGlzLl92YWx1ZSkpO1xuXG5cdFx0XHRnZXRMb2dnZXIoKT8uaGFuZGxlT2JzZXJ2YWJsZVVwZGF0ZWQodGhpcywge1xuXHRcdFx0XHRvbGRWYWx1ZSxcblx0XHRcdFx0bmV3VmFsdWU6IHRoaXMuX3ZhbHVlLFxuXHRcdFx0XHRjaGFuZ2U6IHVuZGVmaW5lZCxcblx0XHRcdFx0ZGlkQ2hhbmdlLFxuXHRcdFx0XHRoYWRWYWx1ZSxcblx0XHRcdH0pO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdG9uQnVnSW5kaWNhdGluZ0Vycm9yKGUpO1xuXHRcdH1cblxuXHRcdHRoaXMuX2lzQ29tcHV0aW5nID0gZmFsc2U7XG5cblx0XHRpZiAoZGlkQ2hhbmdlKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHIgb2YgdGhpcy5fb2JzZXJ2ZXJzKSB7XG5cdFx0XHRcdHIuaGFuZGxlQ2hhbmdlKHRoaXMsIHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIHRvU3RyaW5nKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGBMYXp5RGVyaXZlZDwke3RoaXMuZGVidWdOYW1lfT5gO1xuXHR9XG5cblx0Ly8gSU9ic2VydmVyIEltcGxlbWVudGF0aW9uXG5cblx0cHVibGljIGJlZ2luVXBkYXRlPFQ+KF9vYnNlcnZhYmxlOiBJT2JzZXJ2YWJsZTxUPik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9pc1VwZGF0aW5nKSB7XG5cdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCdDeWNsaWMgZGVyaXZlZHMgYXJlIG5vdCBzdXBwb3J0ZWQgeWV0IScpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3VwZGF0ZUNvdW50Kys7XG5cdFx0dGhpcy5faXNVcGRhdGluZyA9IHRydWU7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHByb3BhZ2F0ZUJlZ2luVXBkYXRlID0gdGhpcy5fdXBkYXRlQ291bnQgPT09IDE7XG5cdFx0XHRpZiAodGhpcy5fc3RhdGUgPT09IERlcml2ZWRTdGF0ZS51cFRvRGF0ZSkge1xuXHRcdFx0XHR0aGlzLl9zdGF0ZSA9IERlcml2ZWRTdGF0ZS5kZXBlbmRlbmNpZXNNaWdodEhhdmVDaGFuZ2VkO1xuXHRcdFx0XHQvLyBJZiB3ZSBwcm9wYWdhdGUgYmVnaW4gdXBkYXRlLCB0aGF0IHdpbGwgYWxyZWFkeSBzaWduYWwgYSBwb3NzaWJsZSBjaGFuZ2UuXG5cdFx0XHRcdGlmICghcHJvcGFnYXRlQmVnaW5VcGRhdGUpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IHIgb2YgdGhpcy5fb2JzZXJ2ZXJzKSB7XG5cdFx0XHRcdFx0XHRyLmhhbmRsZVBvc3NpYmxlQ2hhbmdlKHRoaXMpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKHByb3BhZ2F0ZUJlZ2luVXBkYXRlKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgciBvZiB0aGlzLl9vYnNlcnZlcnMpIHtcblx0XHRcdFx0XHRyLmJlZ2luVXBkYXRlKHRoaXMpOyAvLyBUaGlzIHNpZ25hbHMgYSBwb3NzaWJsZSBjaGFuZ2Vcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLl9pc1VwZGF0aW5nID0gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVtb3ZlZE9ic2VydmVyVG9DYWxsRW5kVXBkYXRlT246IFNldDxJT2JzZXJ2ZXI+IHwgbnVsbCA9IG51bGw7XG5cblx0cHVibGljIGVuZFVwZGF0ZTxUPihfb2JzZXJ2YWJsZTogSU9ic2VydmFibGU8VD4pOiB2b2lkIHtcblx0XHR0aGlzLl91cGRhdGVDb3VudC0tO1xuXHRcdGlmICh0aGlzLl91cGRhdGVDb3VudCA9PT0gMCkge1xuXHRcdFx0Ly8gRW5kIHVwZGF0ZSBjb3VsZCBjaGFuZ2UgdGhlIG9ic2VydmVyIGxpc3QuXG5cdFx0XHRjb25zdCBvYnNlcnZlcnMgPSBbLi4udGhpcy5fb2JzZXJ2ZXJzXTtcblx0XHRcdGZvciAoY29uc3QgciBvZiBvYnNlcnZlcnMpIHtcblx0XHRcdFx0ci5lbmRVcGRhdGUodGhpcyk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5fcmVtb3ZlZE9ic2VydmVyVG9DYWxsRW5kVXBkYXRlT24pIHtcblx0XHRcdFx0Y29uc3Qgb2JzZXJ2ZXJzID0gWy4uLnRoaXMuX3JlbW92ZWRPYnNlcnZlclRvQ2FsbEVuZFVwZGF0ZU9uXTtcblx0XHRcdFx0dGhpcy5fcmVtb3ZlZE9ic2VydmVyVG9DYWxsRW5kVXBkYXRlT24gPSBudWxsO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHIgb2Ygb2JzZXJ2ZXJzKSB7XG5cdFx0XHRcdFx0ci5lbmRVcGRhdGUodGhpcyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0YXNzZXJ0Rm4oKCkgPT4gdGhpcy5fdXBkYXRlQ291bnQgPj0gMCk7XG5cdH1cblxuXHRwdWJsaWMgaGFuZGxlUG9zc2libGVDaGFuZ2U8VD4ob2JzZXJ2YWJsZTogSU9ic2VydmFibGU8VD4pOiB2b2lkIHtcblx0XHQvLyBJbiBhbGwgb3RoZXIgc3RhdGVzLCBvYnNlcnZlcnMgYWxyZWFkeSBrbm93IHRoYXQgd2UgbWlnaHQgaGF2ZSBjaGFuZ2VkLlxuXHRcdGlmICh0aGlzLl9zdGF0ZSA9PT0gRGVyaXZlZFN0YXRlLnVwVG9EYXRlICYmIHRoaXMuX2RlcGVuZGVuY2llcy5oYXMob2JzZXJ2YWJsZSkgJiYgIXRoaXMuX2RlcGVuZGVuY2llc1RvQmVSZW1vdmVkLmhhcyhvYnNlcnZhYmxlKSkge1xuXHRcdFx0dGhpcy5fc3RhdGUgPSBEZXJpdmVkU3RhdGUuZGVwZW5kZW5jaWVzTWlnaHRIYXZlQ2hhbmdlZDtcblx0XHRcdGZvciAoY29uc3QgciBvZiB0aGlzLl9vYnNlcnZlcnMpIHtcblx0XHRcdFx0ci5oYW5kbGVQb3NzaWJsZUNoYW5nZSh0aGlzKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgaGFuZGxlQ2hhbmdlPFQsIFRDaGFuZ2U+KG9ic2VydmFibGU6IElPYnNlcnZhYmxlV2l0aENoYW5nZTxULCBUQ2hhbmdlPiwgY2hhbmdlOiBUQ2hhbmdlKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2RlcGVuZGVuY2llcy5oYXMob2JzZXJ2YWJsZSkgJiYgIXRoaXMuX2RlcGVuZGVuY2llc1RvQmVSZW1vdmVkLmhhcyhvYnNlcnZhYmxlKSkge1xuXHRcdFx0Z2V0TG9nZ2VyKCk/LmhhbmRsZURlcml2ZWREZXBlbmRlbmN5Q2hhbmdlZCh0aGlzLCBvYnNlcnZhYmxlLCBjaGFuZ2UpO1xuXG5cdFx0XHRsZXQgc2hvdWxkUmVhY3QgPSBmYWxzZTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHNob3VsZFJlYWN0ID0gdGhpcy5faGFuZGxlQ2hhbmdlID8gdGhpcy5faGFuZGxlQ2hhbmdlKHtcblx0XHRcdFx0XHRjaGFuZ2VkT2JzZXJ2YWJsZTogb2JzZXJ2YWJsZSxcblx0XHRcdFx0XHRjaGFuZ2UsXG5cdFx0XHRcdFx0ZGlkQ2hhbmdlOiAobyk6IHRoaXMgaXMgYW55ID0+IG8gPT09IG9ic2VydmFibGUgYXMgYW55LFxuXHRcdFx0XHR9LCB0aGlzLl9jaGFuZ2VTdW1tYXJ5ISkgOiB0cnVlO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRvbkJ1Z0luZGljYXRpbmdFcnJvcihlKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgd2FzVXBUb0RhdGUgPSB0aGlzLl9zdGF0ZSA9PT0gRGVyaXZlZFN0YXRlLnVwVG9EYXRlO1xuXHRcdFx0aWYgKHNob3VsZFJlYWN0ICYmICh0aGlzLl9zdGF0ZSA9PT0gRGVyaXZlZFN0YXRlLmRlcGVuZGVuY2llc01pZ2h0SGF2ZUNoYW5nZWQgfHwgd2FzVXBUb0RhdGUpKSB7XG5cdFx0XHRcdHRoaXMuX3N0YXRlID0gRGVyaXZlZFN0YXRlLnN0YWxlO1xuXHRcdFx0XHRpZiAod2FzVXBUb0RhdGUpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IHIgb2YgdGhpcy5fb2JzZXJ2ZXJzKSB7XG5cdFx0XHRcdFx0XHRyLmhhbmRsZVBvc3NpYmxlQ2hhbmdlKHRoaXMpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIElSZWFkZXIgSW1wbGVtZW50YXRpb25cblx0cHJpdmF0ZSBfaXNSZWFkZXJWYWxpZCA9IGZhbHNlO1xuXG5cdHB1YmxpYyByZWFkT2JzZXJ2YWJsZTxUPihvYnNlcnZhYmxlOiBJT2JzZXJ2YWJsZTxUPik6IFQge1xuXHRcdGlmICghdGhpcy5faXNSZWFkZXJWYWxpZCkgeyB0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCdUaGUgcmVhZGVyIG9iamVjdCBjYW5ub3QgYmUgdXNlZCBvdXRzaWRlIGl0cyBjb21wdXRlIGZ1bmN0aW9uIScpOyB9XG5cblx0XHQvLyBTdWJzY3JpYmUgYmVmb3JlIGdldHRpbmcgdGhlIHZhbHVlIHRvIGVuYWJsZSBjYWNoaW5nXG5cdFx0b2JzZXJ2YWJsZS5hZGRPYnNlcnZlcih0aGlzKTtcblx0XHQvKiogVGhpcyBtaWdodCBjYWxsIHtAbGluayBoYW5kbGVDaGFuZ2V9IGluZGlyZWN0bHksIHdoaWNoIGNvdWxkIGludmFsaWRhdGUgdXMgKi9cblx0XHRjb25zdCB2YWx1ZSA9IG9ic2VydmFibGUuZ2V0KCk7XG5cdFx0Ly8gV2hpY2ggaXMgd2h5IHdlIG9ubHkgYWRkIHRoZSBvYnNlcnZhYmxlIHRvIHRoZSBkZXBlbmRlbmNpZXMgbm93LlxuXHRcdHRoaXMuX2RlcGVuZGVuY2llcy5hZGQob2JzZXJ2YWJsZSk7XG5cdFx0dGhpcy5fZGVwZW5kZW5jaWVzVG9CZVJlbW92ZWQuZGVsZXRlKG9ic2VydmFibGUpO1xuXHRcdHJldHVybiB2YWx1ZTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBhZGRPYnNlcnZlcihvYnNlcnZlcjogSU9ic2VydmVyKTogdm9pZCB7XG5cdFx0Y29uc3Qgc2hvdWxkQ2FsbEJlZ2luVXBkYXRlID0gIXRoaXMuX29ic2VydmVycy5oYXMob2JzZXJ2ZXIpICYmIHRoaXMuX3VwZGF0ZUNvdW50ID4gMDtcblx0XHRzdXBlci5hZGRPYnNlcnZlcihvYnNlcnZlcik7XG5cblx0XHRpZiAoc2hvdWxkQ2FsbEJlZ2luVXBkYXRlKSB7XG5cdFx0XHRpZiAodGhpcy5fcmVtb3ZlZE9ic2VydmVyVG9DYWxsRW5kVXBkYXRlT24gJiYgdGhpcy5fcmVtb3ZlZE9ic2VydmVyVG9DYWxsRW5kVXBkYXRlT24uaGFzKG9ic2VydmVyKSkge1xuXHRcdFx0XHR0aGlzLl9yZW1vdmVkT2JzZXJ2ZXJUb0NhbGxFbmRVcGRhdGVPbi5kZWxldGUob2JzZXJ2ZXIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b2JzZXJ2ZXIuYmVnaW5VcGRhdGUodGhpcyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIHJlbW92ZU9ic2VydmVyKG9ic2VydmVyOiBJT2JzZXJ2ZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fb2JzZXJ2ZXJzLmhhcyhvYnNlcnZlcikgJiYgdGhpcy5fdXBkYXRlQ291bnQgPiAwKSB7XG5cdFx0XHRpZiAoIXRoaXMuX3JlbW92ZWRPYnNlcnZlclRvQ2FsbEVuZFVwZGF0ZU9uKSB7XG5cdFx0XHRcdHRoaXMuX3JlbW92ZWRPYnNlcnZlclRvQ2FsbEVuZFVwZGF0ZU9uID0gbmV3IFNldCgpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fcmVtb3ZlZE9ic2VydmVyVG9DYWxsRW5kVXBkYXRlT24uYWRkKG9ic2VydmVyKTtcblx0XHR9XG5cdFx0c3VwZXIucmVtb3ZlT2JzZXJ2ZXIob2JzZXJ2ZXIpO1xuXHR9XG5cblx0cHVibGljIGRlYnVnR2V0U3RhdGUoKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHN0YXRlOiB0aGlzLl9zdGF0ZSxcblx0XHRcdHVwZGF0ZUNvdW50OiB0aGlzLl91cGRhdGVDb3VudCxcblx0XHRcdGlzQ29tcHV0aW5nOiB0aGlzLl9pc0NvbXB1dGluZyxcblx0XHRcdGRlcGVuZGVuY2llczogdGhpcy5fZGVwZW5kZW5jaWVzLFxuXHRcdFx0dmFsdWU6IHRoaXMuX3ZhbHVlLFxuXHRcdH07XG5cdH1cblxuXHRwdWJsaWMgZGVidWdTZXRWYWx1ZShuZXdWYWx1ZTogdW5rbm93bikge1xuXHRcdHRoaXMuX3ZhbHVlID0gbmV3VmFsdWUgYXMgYW55O1xuXHR9XG5cbn1cblxuXG5leHBvcnQgY2xhc3MgRGVyaXZlZFdpdGhTZXR0ZXI8VCwgVENoYW5nZVN1bW1hcnkgPSBhbnk+IGV4dGVuZHMgRGVyaXZlZDxULCBUQ2hhbmdlU3VtbWFyeT4gaW1wbGVtZW50cyBJU2V0dGFibGVPYnNlcnZhYmxlPFQ+IHtcblx0Y29uc3RydWN0b3IoXG5cdFx0ZGVidWdOYW1lRGF0YTogRGVidWdOYW1lRGF0YSxcblx0XHRjb21wdXRlRm46IChyZWFkZXI6IElSZWFkZXIsIGNoYW5nZVN1bW1hcnk6IFRDaGFuZ2VTdW1tYXJ5KSA9PiBULFxuXHRcdGNyZWF0ZUNoYW5nZVN1bW1hcnk6ICgoKSA9PiBUQ2hhbmdlU3VtbWFyeSkgfCB1bmRlZmluZWQsXG5cdFx0aGFuZGxlQ2hhbmdlOiAoKGNvbnRleHQ6IElDaGFuZ2VDb250ZXh0LCBzdW1tYXJ5OiBUQ2hhbmdlU3VtbWFyeSkgPT4gYm9vbGVhbikgfCB1bmRlZmluZWQsXG5cdFx0aGFuZGxlTGFzdE9ic2VydmVyUmVtb3ZlZDogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkLFxuXHRcdGVxdWFsaXR5Q29tcGFyYXRvcjogRXF1YWxpdHlDb21wYXJlcjxUPixcblx0XHRwdWJsaWMgcmVhZG9ubHkgc2V0OiAodmFsdWU6IFQsIHR4OiBJVHJhbnNhY3Rpb24gfCB1bmRlZmluZWQpID0+IHZvaWQsXG5cdCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0ZGVidWdOYW1lRGF0YSxcblx0XHRcdGNvbXB1dGVGbixcblx0XHRcdGNyZWF0ZUNoYW5nZVN1bW1hcnksXG5cdFx0XHRoYW5kbGVDaGFuZ2UsXG5cdFx0XHRoYW5kbGVMYXN0T2JzZXJ2ZXJSZW1vdmVkLFxuXHRcdFx0ZXF1YWxpdHlDb21wYXJhdG9yLFxuXHRcdCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZ0JBQTJILHVCQUF3QjtBQUM1SixTQUFTLHFCQUFpRDtBQUMxRCxTQUFTLG9CQUFvQixpQkFBZ0QsVUFBVSxzQkFBc0Isb0JBQW9CO0FBQ2pJLFNBQVMsaUJBQWlCO0FBVW5CLFNBQVMsUUFBVyxrQkFBeUQsV0FBa0U7QUFDckosTUFBSSxjQUFjLFFBQVc7QUFDNUIsV0FBTyxJQUFJO0FBQUEsTUFDVixJQUFJLGNBQWMsa0JBQWtCLFFBQVcsU0FBUztBQUFBLE1BQ3hEO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0EsU0FBTyxJQUFJO0FBQUEsSUFDVixJQUFJLGNBQWMsUUFBVyxRQUFXLGdCQUF1QjtBQUFBLElBQy9EO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLEVBQ0Q7QUFDRDtBQUVPLFNBQVMsa0JBQXFCLE9BQStCLFdBQW1DLFFBQTJGO0FBQ2pNLFNBQU8sSUFBSTtBQUFBLElBQ1YsSUFBSSxjQUFjLE9BQU8sUUFBVyxTQUFTO0FBQUEsSUFDN0M7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLEVBQ0Q7QUFDRDtBQUVPLFNBQVMsWUFDZixTQUlBLFdBQ2lCO0FBQ2pCLFNBQU8sSUFBSTtBQUFBLElBQ1YsSUFBSSxjQUFjLFFBQVEsT0FBTyxRQUFRLFdBQVcsUUFBUSxnQkFBZ0I7QUFBQSxJQUM1RTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQSxRQUFRO0FBQUEsSUFDUixRQUFRLFlBQVk7QUFBQSxFQUNyQjtBQUNEO0FB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
