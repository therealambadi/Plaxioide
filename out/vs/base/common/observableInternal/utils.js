import { autorun, autorunOpts, autorunWithStoreHandleChanges } from "./autorun.js";
import { BaseObservable, ConvenientObservable, _setKeepObserved, _setRecomputeInitiallyAndOnChange, observableValue, subtransaction, transaction } from "./base.js";
import { DebugNameData, getDebugName } from "./debugName.js";
import { BugIndicatingError, DisposableStore, Event, strictEquals, toDisposable } from "./commonFacade/deps.js";
import { derived, derivedOpts } from "./derived.js";
import { getLogger } from "./logging/logging.js";
function constObservable(value) {
  return new ConstObservable(value);
}
class ConstObservable extends ConvenientObservable {
  constructor(value) {
    super();
    this.value = value;
  }
  get debugName() {
    return this.toString();
  }
  get() {
    return this.value;
  }
  addObserver(observer) {
  }
  removeObserver(observer) {
  }
  log() {
    return this;
  }
  toString() {
    return `Const: ${this.value}`;
  }
}
function observableFromPromise(promise) {
  const observable = observableValue("promiseValue", {});
  promise.then((value) => {
    observable.set({ value }, void 0);
  });
  return observable;
}
function observableFromEvent(...args) {
  let owner;
  let event;
  let getValue;
  if (args.length === 3) {
    [owner, event, getValue] = args;
  } else {
    [event, getValue] = args;
  }
  return new FromEventObservable(
    new DebugNameData(owner, void 0, getValue),
    event,
    getValue,
    () => FromEventObservable.globalTransaction,
    strictEquals
  );
}
function observableFromEventOpts(options, event, getValue) {
  return new FromEventObservable(
    new DebugNameData(options.owner, options.debugName, options.debugReferenceFn ?? getValue),
    event,
    getValue,
    () => FromEventObservable.globalTransaction,
    options.equalsFn ?? strictEquals
  );
}
class FromEventObservable extends BaseObservable {
  constructor(_debugNameData, event, _getValue, _getTransaction, _equalityComparator) {
    super();
    this._debugNameData = _debugNameData;
    this.event = event;
    this._getValue = _getValue;
    this._getTransaction = _getTransaction;
    this._equalityComparator = _equalityComparator;
    this._hasValue = false;
    this.handleEvent = (args) => {
      const newValue = this._getValue(args);
      const oldValue = this._value;
      const didChange = !this._hasValue || !this._equalityComparator(oldValue, newValue);
      let didRunTransaction = false;
      if (didChange) {
        this._value = newValue;
        if (this._hasValue) {
          didRunTransaction = true;
          subtransaction(
            this._getTransaction(),
            (tx) => {
              getLogger()?.handleObservableUpdated(this, { oldValue, newValue, change: void 0, didChange, hadValue: this._hasValue });
              for (const o of this._observers) {
                tx.updateObserver(o, this);
                o.handleChange(this, void 0);
              }
            },
            () => {
              const name = this.getDebugName();
              return "Event fired" + (name ? `: ${name}` : "");
            }
          );
        }
        this._hasValue = true;
      }
      if (!didRunTransaction) {
        getLogger()?.handleObservableUpdated(this, { oldValue, newValue, change: void 0, didChange, hadValue: this._hasValue });
      }
    };
  }
  getDebugName() {
    return this._debugNameData.getDebugName(this);
  }
  get debugName() {
    const name = this.getDebugName();
    return "From Event" + (name ? `: ${name}` : "");
  }
  onFirstObserverAdded() {
    this._subscription = this.event(this.handleEvent);
  }
  onLastObserverRemoved() {
    this._subscription.dispose();
    this._subscription = void 0;
    this._hasValue = false;
    this._value = void 0;
  }
  get() {
    if (this._subscription) {
      if (!this._hasValue) {
        this.handleEvent(void 0);
      }
      return this._value;
    } else {
      const value = this._getValue(void 0);
      return value;
    }
  }
  debugSetValue(value) {
    this._value = value;
  }
}
((observableFromEvent2) => {
  observableFromEvent2.Observer = FromEventObservable;
  function batchEventsGlobally(tx, fn) {
    let didSet = false;
    if (FromEventObservable.globalTransaction === void 0) {
      FromEventObservable.globalTransaction = tx;
      didSet = true;
    }
    try {
      fn();
    } finally {
      if (didSet) {
        FromEventObservable.globalTransaction = void 0;
      }
    }
  }
  observableFromEvent2.batchEventsGlobally = batchEventsGlobally;
})(observableFromEvent || (observableFromEvent = {}));
function observableSignalFromEvent(owner, event) {
  return new FromEventObservableSignal(typeof owner === "string" ? owner : new DebugNameData(owner, void 0, void 0), event);
}
class FromEventObservableSignal extends BaseObservable {
  constructor(debugNameDataOrName, event) {
    super();
    this.event = event;
    this.handleEvent = () => {
      transaction(
        (tx) => {
          for (const o of this._observers) {
            tx.updateObserver(o, this);
            o.handleChange(this, void 0);
          }
        },
        () => this.debugName
      );
    };
    this.debugName = typeof debugNameDataOrName === "string" ? debugNameDataOrName : debugNameDataOrName.getDebugName(this) ?? "Observable Signal From Event";
  }
  onFirstObserverAdded() {
    this.subscription = this.event(this.handleEvent);
  }
  onLastObserverRemoved() {
    this.subscription.dispose();
    this.subscription = void 0;
  }
  get() {
  }
}
function observableSignal(debugNameOrOwner) {
  if (typeof debugNameOrOwner === "string") {
    return new ObservableSignal(debugNameOrOwner);
  } else {
    return new ObservableSignal(void 0, debugNameOrOwner);
  }
}
class ObservableSignal extends BaseObservable {
  constructor(_debugName, _owner) {
    super();
    this._debugName = _debugName;
    this._owner = _owner;
  }
  get debugName() {
    return new DebugNameData(this._owner, this._debugName, void 0).getDebugName(this) ?? "Observable Signal";
  }
  toString() {
    return this.debugName;
  }
  trigger(tx, change) {
    if (!tx) {
      transaction((tx2) => {
        this.trigger(tx2, change);
      }, () => `Trigger signal ${this.debugName}`);
      return;
    }
    for (const o of this._observers) {
      tx.updateObserver(o, this);
      o.handleChange(this, change);
    }
  }
  get() {
  }
}
function signalFromObservable(owner, observable) {
  return derivedOpts({
    owner,
    equalsFn: () => false
  }, (reader) => {
    observable.read(reader);
  });
}
function debouncedObservableDeprecated(observable, debounceMs, disposableStore) {
  const debouncedObservable2 = observableValue("debounced", void 0);
  let timeout = void 0;
  disposableStore.add(autorun((reader) => {
    const value = observable.read(reader);
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      transaction((tx) => {
        debouncedObservable2.set(value, tx);
      });
    }, debounceMs);
  }));
  return debouncedObservable2;
}
function debouncedObservable(observable, debounceMs) {
  let hasValue = false;
  let lastValue;
  let timeout = void 0;
  return observableFromEvent((cb) => {
    const d = autorun((reader) => {
      const value = observable.read(reader);
      if (!hasValue) {
        hasValue = true;
        lastValue = value;
      } else {
        if (timeout) {
          clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
          lastValue = value;
          cb();
        }, debounceMs);
      }
    });
    return {
      dispose() {
        d.dispose();
        hasValue = false;
        lastValue = void 0;
      }
    };
  }, () => {
    if (hasValue) {
      return lastValue;
    } else {
      return observable.get();
    }
  });
}
function wasEventTriggeredRecently(event, timeoutMs, disposableStore) {
  const observable = observableValue("triggeredRecently", false);
  let timeout = void 0;
  disposableStore.add(event(() => {
    observable.set(true, void 0);
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      observable.set(false, void 0);
    }, timeoutMs);
  }));
  return observable;
}
function keepObserved(observable) {
  const o = new KeepAliveObserver(false, void 0);
  observable.addObserver(o);
  return toDisposable(() => {
    observable.removeObserver(o);
  });
}
_setKeepObserved(keepObserved);
function recomputeInitiallyAndOnChange(observable, handleValue) {
  const o = new KeepAliveObserver(true, handleValue);
  observable.addObserver(o);
  try {
    o.beginUpdate(observable);
  } finally {
    o.endUpdate(observable);
  }
  return toDisposable(() => {
    observable.removeObserver(o);
  });
}
_setRecomputeInitiallyAndOnChange(recomputeInitiallyAndOnChange);
class KeepAliveObserver {
  constructor(_forceRecompute, _handleValue) {
    this._forceRecompute = _forceRecompute;
    this._handleValue = _handleValue;
    this._counter = 0;
  }
  beginUpdate(observable) {
    this._counter++;
  }
  endUpdate(observable) {
    if (this._counter === 1 && this._forceRecompute) {
      if (this._handleValue) {
        this._handleValue(observable.get());
      } else {
        observable.reportChanges();
      }
    }
    this._counter--;
  }
  handlePossibleChange(observable) {
  }
  handleChange(observable, change) {
  }
}
function derivedObservableWithCache(owner, computeFn) {
  let lastValue = void 0;
  const observable = derivedOpts({ owner, debugReferenceFn: computeFn }, (reader) => {
    lastValue = computeFn(reader, lastValue);
    return lastValue;
  });
  return observable;
}
function derivedObservableWithWritableCache(owner, computeFn) {
  let lastValue = void 0;
  const onChange = observableSignal("derivedObservableWithWritableCache");
  const observable = derived(owner, (reader) => {
    onChange.read(reader);
    lastValue = computeFn(reader, lastValue);
    return lastValue;
  });
  return Object.assign(observable, {
    clearCache: (tx) => {
      lastValue = void 0;
      onChange.trigger(tx);
    },
    setCache: (newValue, tx) => {
      lastValue = newValue;
      onChange.trigger(tx);
    }
  });
}
function mapObservableArrayCached(owner, items, map, keySelector) {
  let m = new ArrayMap(map, keySelector);
  const self = derivedOpts({
    debugReferenceFn: map,
    owner,
    onLastObserverRemoved: () => {
      m.dispose();
      m = new ArrayMap(map);
    }
  }, (reader) => {
    m.setItems(items.read(reader));
    return m.getItems();
  });
  return self;
}
class ArrayMap {
  constructor(_map, _keySelector) {
    this._map = _map;
    this._keySelector = _keySelector;
    this._cache = /* @__PURE__ */ new Map();
    this._items = [];
  }
  dispose() {
    this._cache.forEach((entry) => entry.store.dispose());
    this._cache.clear();
  }
  setItems(items) {
    const newItems = [];
    const itemsToRemove = new Set(this._cache.keys());
    for (const item of items) {
      const key = this._keySelector ? this._keySelector(item) : item;
      let entry = this._cache.get(key);
      if (!entry) {
        const store = new DisposableStore();
        const out = this._map(item, store);
        entry = { out, store };
        this._cache.set(key, entry);
      } else {
        itemsToRemove.delete(key);
      }
      newItems.push(entry.out);
    }
    for (const item of itemsToRemove) {
      const entry = this._cache.get(item);
      entry.store.dispose();
      this._cache.delete(item);
    }
    this._items = newItems;
  }
  getItems() {
    return this._items;
  }
}
class ValueWithChangeEventFromObservable {
  constructor(observable) {
    this.observable = observable;
  }
  get onDidChange() {
    return Event.fromObservableLight(this.observable);
  }
  get value() {
    return this.observable.get();
  }
}
function observableFromValueWithChangeEvent(owner, value) {
  if (value instanceof ValueWithChangeEventFromObservable) {
    return value.observable;
  }
  return observableFromEvent(owner, value.onDidChange, () => value.value);
}
function latestChangedValue(owner, observables) {
  if (observables.length === 0) {
    throw new BugIndicatingError();
  }
  let hasLastChangedValue = false;
  let lastChangedValue = void 0;
  const result = observableFromEvent(owner, (cb) => {
    const store = new DisposableStore();
    for (const o of observables) {
      store.add(autorunOpts({ debugName: () => getDebugName(result, new DebugNameData(owner, void 0, void 0)) + ".updateLastChangedValue" }, (reader) => {
        hasLastChangedValue = true;
        lastChangedValue = o.read(reader);
        cb();
      }));
    }
    store.add({
      dispose() {
        hasLastChangedValue = false;
        lastChangedValue = void 0;
      }
    });
    return store;
  }, () => {
    if (hasLastChangedValue) {
      return lastChangedValue;
    } else {
      return observables[observables.length - 1].get();
    }
  });
  return result;
}
function derivedConstOnceDefined(owner, fn) {
  return derivedObservableWithCache(owner, (reader, lastValue) => lastValue ?? fn(reader));
}
function runOnChange(observable, cb) {
  let _previousValue;
  return autorunWithStoreHandleChanges({
    createEmptyChangeSummary: () => ({ deltas: [], didChange: false }),
    handleChange: (context, changeSummary) => {
      if (context.didChange(observable)) {
        const e = context.change;
        if (e !== void 0) {
          changeSummary.deltas.push(e);
        }
        changeSummary.didChange = true;
      }
      return true;
    }
  }, (reader, changeSummary) => {
    const value = observable.read(reader);
    const previousValue = _previousValue;
    if (changeSummary.didChange) {
      _previousValue = value;
      cb(value, previousValue, changeSummary.deltas);
    }
  });
}
function runOnChangeWithStore(observable, cb) {
  const store = new DisposableStore();
  const disposable = runOnChange(observable, (value, previousValue, deltas) => {
    store.clear();
    cb(value, previousValue, deltas, store);
  });
  return {
    dispose() {
      disposable.dispose();
      store.dispose();
    }
  };
}
export {
  FromEventObservable,
  KeepAliveObserver,
  ValueWithChangeEventFromObservable,
  constObservable,
  debouncedObservable,
  debouncedObservableDeprecated,
  derivedConstOnceDefined,
  derivedObservableWithCache,
  derivedObservableWithWritableCache,
  keepObserved,
  latestChangedValue,
  mapObservableArrayCached,
  observableFromEvent,
  observableFromEventOpts,
  observableFromPromise,
  observableFromValueWithChangeEvent,
  observableSignal,
  observableSignalFromEvent,
  recomputeInitiallyAndOnChange,
  runOnChange,
  runOnChangeWithStore,
  signalFromObservable,
  wasEventTriggeredRecently
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlSW50ZXJuYWwvdXRpbHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBhdXRvcnVuLCBhdXRvcnVuT3B0cywgYXV0b3J1bldpdGhTdG9yZUhhbmRsZUNoYW5nZXMgfSBmcm9tICcuL2F1dG9ydW4uanMnO1xuaW1wb3J0IHsgQmFzZU9ic2VydmFibGUsIENvbnZlbmllbnRPYnNlcnZhYmxlLCBJT2JzZXJ2YWJsZSwgSU9ic2VydmFibGVXaXRoQ2hhbmdlLCBJT2JzZXJ2ZXIsIElSZWFkZXIsIElUcmFuc2FjdGlvbiwgX3NldEtlZXBPYnNlcnZlZCwgX3NldFJlY29tcHV0ZUluaXRpYWxseUFuZE9uQ2hhbmdlLCBvYnNlcnZhYmxlVmFsdWUsIHN1YnRyYW5zYWN0aW9uLCB0cmFuc2FjdGlvbiB9IGZyb20gJy4vYmFzZS5qcyc7XG5pbXBvcnQgeyBEZWJ1Z05hbWVEYXRhLCBEZWJ1Z093bmVyLCBJRGVidWdOYW1lRGF0YSwgZ2V0RGVidWdOYW1lLCB9IGZyb20gJy4vZGVidWdOYW1lLmpzJztcbmltcG9ydCB7IEJ1Z0luZGljYXRpbmdFcnJvciwgRGlzcG9zYWJsZVN0b3JlLCBFcXVhbGl0eUNvbXBhcmVyLCBFdmVudCwgSURpc3Bvc2FibGUsIElWYWx1ZVdpdGhDaGFuZ2VFdmVudCwgc3RyaWN0RXF1YWxzLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuL2NvbW1vbkZhY2FkZS9kZXBzLmpzJztcbmltcG9ydCB7IGRlcml2ZWQsIGRlcml2ZWRPcHRzIH0gZnJvbSAnLi9kZXJpdmVkLmpzJztcbmltcG9ydCB7IGdldExvZ2dlciB9IGZyb20gJy4vbG9nZ2luZy9sb2dnaW5nLmpzJztcblxuLyoqXG4gKiBSZXByZXNlbnRzIGFuIGVmZmljaWVudCBvYnNlcnZhYmxlIHdob3NlIHZhbHVlIG5ldmVyIGNoYW5nZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb25zdE9ic2VydmFibGU8VD4odmFsdWU6IFQpOiBJT2JzZXJ2YWJsZTxUPiB7XG5cdHJldHVybiBuZXcgQ29uc3RPYnNlcnZhYmxlKHZhbHVlKTtcbn1cblxuY2xhc3MgQ29uc3RPYnNlcnZhYmxlPFQ+IGV4dGVuZHMgQ29udmVuaWVudE9ic2VydmFibGU8VCwgdm9pZD4ge1xuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHZhbHVlOiBUKSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBnZXQgZGVidWdOYW1lKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMudG9TdHJpbmcoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQoKTogVCB7XG5cdFx0cmV0dXJuIHRoaXMudmFsdWU7XG5cdH1cblx0cHVibGljIGFkZE9ic2VydmVyKG9ic2VydmVyOiBJT2JzZXJ2ZXIpOiB2b2lkIHtcblx0XHQvLyBOTyBPUFxuXHR9XG5cdHB1YmxpYyByZW1vdmVPYnNlcnZlcihvYnNlcnZlcjogSU9ic2VydmVyKTogdm9pZCB7XG5cdFx0Ly8gTk8gT1Bcblx0fVxuXG5cdG92ZXJyaWRlIGxvZygpOiBJT2JzZXJ2YWJsZVdpdGhDaGFuZ2U8VCwgdm9pZD4ge1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0b3ZlcnJpZGUgdG9TdHJpbmcoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYENvbnN0OiAke3RoaXMudmFsdWV9YDtcblx0fVxufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBvYnNlcnZhYmxlRnJvbVByb21pc2U8VD4ocHJvbWlzZTogUHJvbWlzZTxUPik6IElPYnNlcnZhYmxlPHsgdmFsdWU/OiBUIH0+IHtcblx0Y29uc3Qgb2JzZXJ2YWJsZSA9IG9ic2VydmFibGVWYWx1ZTx7IHZhbHVlPzogVCB9PigncHJvbWlzZVZhbHVlJywge30pO1xuXHRwcm9taXNlLnRoZW4oKHZhbHVlKSA9PiB7XG5cdFx0b2JzZXJ2YWJsZS5zZXQoeyB2YWx1ZSB9LCB1bmRlZmluZWQpO1xuXHR9KTtcblx0cmV0dXJuIG9ic2VydmFibGU7XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIG9ic2VydmFibGVGcm9tRXZlbnQ8VCwgVEFyZ3MgPSB1bmtub3duPihcblx0b3duZXI6IERlYnVnT3duZXIsXG5cdGV2ZW50OiBFdmVudDxUQXJncz4sXG5cdGdldFZhbHVlOiAoYXJnczogVEFyZ3MgfCB1bmRlZmluZWQpID0+IFQsXG4pOiBJT2JzZXJ2YWJsZTxUPjtcbmV4cG9ydCBmdW5jdGlvbiBvYnNlcnZhYmxlRnJvbUV2ZW50PFQsIFRBcmdzID0gdW5rbm93bj4oXG5cdGV2ZW50OiBFdmVudDxUQXJncz4sXG5cdGdldFZhbHVlOiAoYXJnczogVEFyZ3MgfCB1bmRlZmluZWQpID0+IFQsXG4pOiBJT2JzZXJ2YWJsZTxUPjtcbmV4cG9ydCBmdW5jdGlvbiBvYnNlcnZhYmxlRnJvbUV2ZW50KC4uLmFyZ3M6XG5cdFtvd25lcjogRGVidWdPd25lciwgZXZlbnQ6IEV2ZW50PGFueT4sIGdldFZhbHVlOiAoYXJnczogYW55IHwgdW5kZWZpbmVkKSA9PiBhbnldXG5cdHwgW2V2ZW50OiBFdmVudDxhbnk+LCBnZXRWYWx1ZTogKGFyZ3M6IGFueSB8IHVuZGVmaW5lZCkgPT4gYW55XVxuKTogSU9ic2VydmFibGU8YW55PiB7XG5cdGxldCBvd25lcjtcblx0bGV0IGV2ZW50O1xuXHRsZXQgZ2V0VmFsdWU7XG5cdGlmIChhcmdzLmxlbmd0aCA9PT0gMykge1xuXHRcdFtvd25lciwgZXZlbnQsIGdldFZhbHVlXSA9IGFyZ3M7XG5cdH0gZWxzZSB7XG5cdFx0W2V2ZW50LCBnZXRWYWx1ZV0gPSBhcmdzO1xuXHR9XG5cdHJldHVybiBuZXcgRnJvbUV2ZW50T2JzZXJ2YWJsZShcblx0XHRuZXcgRGVidWdOYW1lRGF0YShvd25lciwgdW5kZWZpbmVkLCBnZXRWYWx1ZSksXG5cdFx0ZXZlbnQsXG5cdFx0Z2V0VmFsdWUsXG5cdFx0KCkgPT4gRnJvbUV2ZW50T2JzZXJ2YWJsZS5nbG9iYWxUcmFuc2FjdGlvbixcblx0XHRzdHJpY3RFcXVhbHNcblx0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG9ic2VydmFibGVGcm9tRXZlbnRPcHRzPFQsIFRBcmdzID0gdW5rbm93bj4oXG5cdG9wdGlvbnM6IElEZWJ1Z05hbWVEYXRhICYge1xuXHRcdGVxdWFsc0ZuPzogRXF1YWxpdHlDb21wYXJlcjxUPjtcblx0fSxcblx0ZXZlbnQ6IEV2ZW50PFRBcmdzPixcblx0Z2V0VmFsdWU6IChhcmdzOiBUQXJncyB8IHVuZGVmaW5lZCkgPT4gVCxcbik6IElPYnNlcnZhYmxlPFQ+IHtcblx0cmV0dXJuIG5ldyBGcm9tRXZlbnRPYnNlcnZhYmxlKFxuXHRcdG5ldyBEZWJ1Z05hbWVEYXRhKG9wdGlvbnMub3duZXIsIG9wdGlvbnMuZGVidWdOYW1lLCBvcHRpb25zLmRlYnVnUmVmZXJlbmNlRm4gPz8gZ2V0VmFsdWUpLFxuXHRcdGV2ZW50LFxuXHRcdGdldFZhbHVlLCAoKSA9PiBGcm9tRXZlbnRPYnNlcnZhYmxlLmdsb2JhbFRyYW5zYWN0aW9uLCBvcHRpb25zLmVxdWFsc0ZuID8/IHN0cmljdEVxdWFsc1xuXHQpO1xufVxuXG5leHBvcnQgY2xhc3MgRnJvbUV2ZW50T2JzZXJ2YWJsZTxUQXJncywgVD4gZXh0ZW5kcyBCYXNlT2JzZXJ2YWJsZTxUPiB7XG5cdHB1YmxpYyBzdGF0aWMgZ2xvYmFsVHJhbnNhY3Rpb246IElUcmFuc2FjdGlvbiB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF92YWx1ZTogVCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfaGFzVmFsdWUgPSBmYWxzZTtcblx0cHJpdmF0ZSBfc3Vic2NyaXB0aW9uOiBJRGlzcG9zYWJsZSB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kZWJ1Z05hbWVEYXRhOiBEZWJ1Z05hbWVEYXRhLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZXZlbnQ6IEV2ZW50PFRBcmdzPixcblx0XHRwdWJsaWMgcmVhZG9ubHkgX2dldFZhbHVlOiAoYXJnczogVEFyZ3MgfCB1bmRlZmluZWQpID0+IFQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZ2V0VHJhbnNhY3Rpb246ICgpID0+IElUcmFuc2FjdGlvbiB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lcXVhbGl0eUNvbXBhcmF0b3I6IEVxdWFsaXR5Q29tcGFyZXI8VD5cblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RGVidWdOYW1lKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2RlYnVnTmFtZURhdGEuZ2V0RGVidWdOYW1lKHRoaXMpO1xuXHR9XG5cblx0cHVibGljIGdldCBkZWJ1Z05hbWUoKTogc3RyaW5nIHtcblx0XHRjb25zdCBuYW1lID0gdGhpcy5nZXREZWJ1Z05hbWUoKTtcblx0XHRyZXR1cm4gJ0Zyb20gRXZlbnQnICsgKG5hbWUgPyBgOiAke25hbWV9YCA6ICcnKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBvbkZpcnN0T2JzZXJ2ZXJBZGRlZCgpOiB2b2lkIHtcblx0XHR0aGlzLl9zdWJzY3JpcHRpb24gPSB0aGlzLmV2ZW50KHRoaXMuaGFuZGxlRXZlbnQpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBoYW5kbGVFdmVudCA9IChhcmdzOiBUQXJncyB8IHVuZGVmaW5lZCkgPT4ge1xuXHRcdGNvbnN0IG5ld1ZhbHVlID0gdGhpcy5fZ2V0VmFsdWUoYXJncyk7XG5cdFx0Y29uc3Qgb2xkVmFsdWUgPSB0aGlzLl92YWx1ZTtcblxuXHRcdGNvbnN0IGRpZENoYW5nZSA9ICF0aGlzLl9oYXNWYWx1ZSB8fCAhKHRoaXMuX2VxdWFsaXR5Q29tcGFyYXRvcihvbGRWYWx1ZSEsIG5ld1ZhbHVlKSk7XG5cdFx0bGV0IGRpZFJ1blRyYW5zYWN0aW9uID0gZmFsc2U7XG5cblx0XHRpZiAoZGlkQ2hhbmdlKSB7XG5cdFx0XHR0aGlzLl92YWx1ZSA9IG5ld1ZhbHVlO1xuXG5cdFx0XHRpZiAodGhpcy5faGFzVmFsdWUpIHtcblx0XHRcdFx0ZGlkUnVuVHJhbnNhY3Rpb24gPSB0cnVlO1xuXHRcdFx0XHRzdWJ0cmFuc2FjdGlvbihcblx0XHRcdFx0XHR0aGlzLl9nZXRUcmFuc2FjdGlvbigpLFxuXHRcdFx0XHRcdCh0eCkgPT4ge1xuXHRcdFx0XHRcdFx0Z2V0TG9nZ2VyKCk/LmhhbmRsZU9ic2VydmFibGVVcGRhdGVkKHRoaXMsIHsgb2xkVmFsdWUsIG5ld1ZhbHVlLCBjaGFuZ2U6IHVuZGVmaW5lZCwgZGlkQ2hhbmdlLCBoYWRWYWx1ZTogdGhpcy5faGFzVmFsdWUgfSk7XG5cblx0XHRcdFx0XHRcdGZvciAoY29uc3QgbyBvZiB0aGlzLl9vYnNlcnZlcnMpIHtcblx0XHRcdFx0XHRcdFx0dHgudXBkYXRlT2JzZXJ2ZXIobywgdGhpcyk7XG5cdFx0XHRcdFx0XHRcdG8uaGFuZGxlQ2hhbmdlKHRoaXMsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHQoKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBuYW1lID0gdGhpcy5nZXREZWJ1Z05hbWUoKTtcblx0XHRcdFx0XHRcdHJldHVybiAnRXZlbnQgZmlyZWQnICsgKG5hbWUgPyBgOiAke25hbWV9YCA6ICcnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9oYXNWYWx1ZSA9IHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKCFkaWRSdW5UcmFuc2FjdGlvbikge1xuXHRcdFx0Z2V0TG9nZ2VyKCk/LmhhbmRsZU9ic2VydmFibGVVcGRhdGVkKHRoaXMsIHsgb2xkVmFsdWUsIG5ld1ZhbHVlLCBjaGFuZ2U6IHVuZGVmaW5lZCwgZGlkQ2hhbmdlLCBoYWRWYWx1ZTogdGhpcy5faGFzVmFsdWUgfSk7XG5cdFx0fVxuXHR9O1xuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBvbkxhc3RPYnNlcnZlclJlbW92ZWQoKTogdm9pZCB7XG5cdFx0dGhpcy5fc3Vic2NyaXB0aW9uIS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fc3Vic2NyaXB0aW9uID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX2hhc1ZhbHVlID0gZmFsc2U7XG5cdFx0dGhpcy5fdmFsdWUgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0KCk6IFQge1xuXHRcdGlmICh0aGlzLl9zdWJzY3JpcHRpb24pIHtcblx0XHRcdGlmICghdGhpcy5faGFzVmFsdWUpIHtcblx0XHRcdFx0dGhpcy5oYW5kbGVFdmVudCh1bmRlZmluZWQpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXMuX3ZhbHVlITtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gbm8gY2FjaGUsIGFzIHRoZXJlIGFyZSBubyBzdWJzY3JpYmVycyB0byBrZWVwIGl0IHVwZGF0ZWRcblx0XHRcdGNvbnN0IHZhbHVlID0gdGhpcy5fZ2V0VmFsdWUodW5kZWZpbmVkKTtcblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZGVidWdTZXRWYWx1ZSh2YWx1ZTogdW5rbm93bikge1xuXHRcdHRoaXMuX3ZhbHVlID0gdmFsdWUgYXMgYW55O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2Ugb2JzZXJ2YWJsZUZyb21FdmVudCB7XG5cdGV4cG9ydCBjb25zdCBPYnNlcnZlciA9IEZyb21FdmVudE9ic2VydmFibGU7XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGJhdGNoRXZlbnRzR2xvYmFsbHkodHg6IElUcmFuc2FjdGlvbiwgZm46ICgpID0+IHZvaWQpOiB2b2lkIHtcblx0XHRsZXQgZGlkU2V0ID0gZmFsc2U7XG5cdFx0aWYgKEZyb21FdmVudE9ic2VydmFibGUuZ2xvYmFsVHJhbnNhY3Rpb24gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0RnJvbUV2ZW50T2JzZXJ2YWJsZS5nbG9iYWxUcmFuc2FjdGlvbiA9IHR4O1xuXHRcdFx0ZGlkU2V0ID0gdHJ1ZTtcblx0XHR9XG5cdFx0dHJ5IHtcblx0XHRcdGZuKCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGlmIChkaWRTZXQpIHtcblx0XHRcdFx0RnJvbUV2ZW50T2JzZXJ2YWJsZS5nbG9iYWxUcmFuc2FjdGlvbiA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG9ic2VydmFibGVTaWduYWxGcm9tRXZlbnQoXG5cdG93bmVyOiBEZWJ1Z093bmVyIHwgc3RyaW5nLFxuXHRldmVudDogRXZlbnQ8YW55PlxuKTogSU9ic2VydmFibGU8dm9pZD4ge1xuXHRyZXR1cm4gbmV3IEZyb21FdmVudE9ic2VydmFibGVTaWduYWwodHlwZW9mIG93bmVyID09PSAnc3RyaW5nJyA/IG93bmVyIDogbmV3IERlYnVnTmFtZURhdGEob3duZXIsIHVuZGVmaW5lZCwgdW5kZWZpbmVkKSwgZXZlbnQpO1xufVxuXG5jbGFzcyBGcm9tRXZlbnRPYnNlcnZhYmxlU2lnbmFsIGV4dGVuZHMgQmFzZU9ic2VydmFibGU8dm9pZD4ge1xuXHRwcml2YXRlIHN1YnNjcmlwdGlvbjogSURpc3Bvc2FibGUgfCB1bmRlZmluZWQ7XG5cblx0cHVibGljIHJlYWRvbmx5IGRlYnVnTmFtZTogc3RyaW5nO1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRkZWJ1Z05hbWVEYXRhT3JOYW1lOiBEZWJ1Z05hbWVEYXRhIHwgc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZXZlbnQ6IEV2ZW50PGFueT4sXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5kZWJ1Z05hbWUgPSB0eXBlb2YgZGVidWdOYW1lRGF0YU9yTmFtZSA9PT0gJ3N0cmluZydcblx0XHRcdD8gZGVidWdOYW1lRGF0YU9yTmFtZVxuXHRcdFx0OiBkZWJ1Z05hbWVEYXRhT3JOYW1lLmdldERlYnVnTmFtZSh0aGlzKSA/PyAnT2JzZXJ2YWJsZSBTaWduYWwgRnJvbSBFdmVudCc7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgb25GaXJzdE9ic2VydmVyQWRkZWQoKTogdm9pZCB7XG5cdFx0dGhpcy5zdWJzY3JpcHRpb24gPSB0aGlzLmV2ZW50KHRoaXMuaGFuZGxlRXZlbnQpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBoYW5kbGVFdmVudCA9ICgpID0+IHtcblx0XHR0cmFuc2FjdGlvbihcblx0XHRcdCh0eCkgPT4ge1xuXHRcdFx0XHRmb3IgKGNvbnN0IG8gb2YgdGhpcy5fb2JzZXJ2ZXJzKSB7XG5cdFx0XHRcdFx0dHgudXBkYXRlT2JzZXJ2ZXIobywgdGhpcyk7XG5cdFx0XHRcdFx0by5oYW5kbGVDaGFuZ2UodGhpcywgdW5kZWZpbmVkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdCgpID0+IHRoaXMuZGVidWdOYW1lXG5cdFx0KTtcblx0fTtcblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgb25MYXN0T2JzZXJ2ZXJSZW1vdmVkKCk6IHZvaWQge1xuXHRcdHRoaXMuc3Vic2NyaXB0aW9uIS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5zdWJzY3JpcHRpb24gPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZ2V0KCk6IHZvaWQge1xuXHRcdC8vIE5PIE9QXG5cdH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgc2lnbmFsIHRoYXQgY2FuIGJlIHRyaWdnZXJlZCB0byBpbnZhbGlkYXRlIG9ic2VydmVycy5cbiAqIFNpZ25hbHMgZG9uJ3QgaGF2ZSBhIHZhbHVlIC0gd2hlbiB0aGV5IGFyZSB0cmlnZ2VyZWQgdGhleSBpbmRpY2F0ZSBhIGNoYW5nZS5cbiAqIEhvd2V2ZXIsIHNpZ25hbHMgY2FuIGNhcnJ5IGEgZGVsdGEgdGhhdCBpcyBwYXNzZWQgdG8gb2JzZXJ2ZXJzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gb2JzZXJ2YWJsZVNpZ25hbDxURGVsdGEgPSB2b2lkPihkZWJ1Z05hbWU6IHN0cmluZyk6IElPYnNlcnZhYmxlU2lnbmFsPFREZWx0YT47XG5leHBvcnQgZnVuY3Rpb24gb2JzZXJ2YWJsZVNpZ25hbDxURGVsdGEgPSB2b2lkPihvd25lcjogb2JqZWN0KTogSU9ic2VydmFibGVTaWduYWw8VERlbHRhPjtcbmV4cG9ydCBmdW5jdGlvbiBvYnNlcnZhYmxlU2lnbmFsPFREZWx0YSA9IHZvaWQ+KGRlYnVnTmFtZU9yT3duZXI6IHN0cmluZyB8IG9iamVjdCk6IElPYnNlcnZhYmxlU2lnbmFsPFREZWx0YT4ge1xuXHRpZiAodHlwZW9mIGRlYnVnTmFtZU9yT3duZXIgPT09ICdzdHJpbmcnKSB7XG5cdFx0cmV0dXJuIG5ldyBPYnNlcnZhYmxlU2lnbmFsPFREZWx0YT4oZGVidWdOYW1lT3JPd25lcik7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIG5ldyBPYnNlcnZhYmxlU2lnbmFsPFREZWx0YT4odW5kZWZpbmVkLCBkZWJ1Z05hbWVPck93bmVyKTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElPYnNlcnZhYmxlU2lnbmFsPFRDaGFuZ2U+IGV4dGVuZHMgSU9ic2VydmFibGVXaXRoQ2hhbmdlPHZvaWQsIFRDaGFuZ2U+IHtcblx0dHJpZ2dlcih0eDogSVRyYW5zYWN0aW9uIHwgdW5kZWZpbmVkLCBjaGFuZ2U6IFRDaGFuZ2UpOiB2b2lkO1xufVxuXG5jbGFzcyBPYnNlcnZhYmxlU2lnbmFsPFRDaGFuZ2U+IGV4dGVuZHMgQmFzZU9ic2VydmFibGU8dm9pZCwgVENoYW5nZT4gaW1wbGVtZW50cyBJT2JzZXJ2YWJsZVNpZ25hbDxUQ2hhbmdlPiB7XG5cdHB1YmxpYyBnZXQgZGVidWdOYW1lKCkge1xuXHRcdHJldHVybiBuZXcgRGVidWdOYW1lRGF0YSh0aGlzLl9vd25lciwgdGhpcy5fZGVidWdOYW1lLCB1bmRlZmluZWQpLmdldERlYnVnTmFtZSh0aGlzKSA/PyAnT2JzZXJ2YWJsZSBTaWduYWwnO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIHRvU3RyaW5nKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuZGVidWdOYW1lO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZGVidWdOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb3duZXI/OiBvYmplY3QsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRwdWJsaWMgdHJpZ2dlcih0eDogSVRyYW5zYWN0aW9uIHwgdW5kZWZpbmVkLCBjaGFuZ2U6IFRDaGFuZ2UpOiB2b2lkIHtcblx0XHRpZiAoIXR4KSB7XG5cdFx0XHR0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHRcdHRoaXMudHJpZ2dlcih0eCwgY2hhbmdlKTtcblx0XHRcdH0sICgpID0+IGBUcmlnZ2VyIHNpZ25hbCAke3RoaXMuZGVidWdOYW1lfWApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgbyBvZiB0aGlzLl9vYnNlcnZlcnMpIHtcblx0XHRcdHR4LnVwZGF0ZU9ic2VydmVyKG8sIHRoaXMpO1xuXHRcdFx0by5oYW5kbGVDaGFuZ2UodGhpcywgY2hhbmdlKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZ2V0KCk6IHZvaWQge1xuXHRcdC8vIE5PIE9QXG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNpZ25hbEZyb21PYnNlcnZhYmxlPFQ+KG93bmVyOiBEZWJ1Z093bmVyIHwgdW5kZWZpbmVkLCBvYnNlcnZhYmxlOiBJT2JzZXJ2YWJsZTxUPik6IElPYnNlcnZhYmxlPHZvaWQ+IHtcblx0cmV0dXJuIGRlcml2ZWRPcHRzKHtcblx0XHRvd25lcixcblx0XHRlcXVhbHNGbjogKCkgPT4gZmFsc2UsXG5cdH0sIHJlYWRlciA9PiB7XG5cdFx0b2JzZXJ2YWJsZS5yZWFkKHJlYWRlcik7XG5cdH0pO1xufVxuXG4vKipcbiAqIEBkZXByZWNhdGVkIFVzZSBgZGVib3VuY2VkT2JzZXJ2YWJsZWAgaW5zdGVhZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlYm91bmNlZE9ic2VydmFibGVEZXByZWNhdGVkPFQ+KG9ic2VydmFibGU6IElPYnNlcnZhYmxlPFQ+LCBkZWJvdW5jZU1zOiBudW1iZXIsIGRpc3Bvc2FibGVTdG9yZTogRGlzcG9zYWJsZVN0b3JlKTogSU9ic2VydmFibGU8VCB8IHVuZGVmaW5lZD4ge1xuXHRjb25zdCBkZWJvdW5jZWRPYnNlcnZhYmxlID0gb2JzZXJ2YWJsZVZhbHVlPFQgfCB1bmRlZmluZWQ+KCdkZWJvdW5jZWQnLCB1bmRlZmluZWQpO1xuXG5cdGxldCB0aW1lb3V0OiBhbnkgPSB1bmRlZmluZWQ7XG5cblx0ZGlzcG9zYWJsZVN0b3JlLmFkZChhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0LyoqIEBkZXNjcmlwdGlvbiBkZWJvdW5jZSAqL1xuXHRcdGNvbnN0IHZhbHVlID0gb2JzZXJ2YWJsZS5yZWFkKHJlYWRlcik7XG5cblx0XHRpZiAodGltZW91dCkge1xuXHRcdFx0Y2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuXHRcdH1cblx0XHR0aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHRcdGRlYm91bmNlZE9ic2VydmFibGUuc2V0KHZhbHVlLCB0eCk7XG5cdFx0XHR9KTtcblx0XHR9LCBkZWJvdW5jZU1zKTtcblxuXHR9KSk7XG5cblx0cmV0dXJuIGRlYm91bmNlZE9ic2VydmFibGU7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBvYnNlcnZhYmxlIHRoYXQgZGVib3VuY2VzIHRoZSBpbnB1dCBvYnNlcnZhYmxlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVib3VuY2VkT2JzZXJ2YWJsZTxUPihvYnNlcnZhYmxlOiBJT2JzZXJ2YWJsZTxUPiwgZGVib3VuY2VNczogbnVtYmVyKTogSU9ic2VydmFibGU8VD4ge1xuXHRsZXQgaGFzVmFsdWUgPSBmYWxzZTtcblx0bGV0IGxhc3RWYWx1ZTogVCB8IHVuZGVmaW5lZDtcblxuXHRsZXQgdGltZW91dDogYW55ID0gdW5kZWZpbmVkO1xuXG5cdHJldHVybiBvYnNlcnZhYmxlRnJvbUV2ZW50PFQsIHZvaWQ+KGNiID0+IHtcblx0XHRjb25zdCBkID0gYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0Y29uc3QgdmFsdWUgPSBvYnNlcnZhYmxlLnJlYWQocmVhZGVyKTtcblxuXHRcdFx0aWYgKCFoYXNWYWx1ZSkge1xuXHRcdFx0XHRoYXNWYWx1ZSA9IHRydWU7XG5cdFx0XHRcdGxhc3RWYWx1ZSA9IHZhbHVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKHRpbWVvdXQpIHtcblx0XHRcdFx0XHRjbGVhclRpbWVvdXQodGltZW91dCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdGxhc3RWYWx1ZSA9IHZhbHVlO1xuXHRcdFx0XHRcdGNiKCk7XG5cdFx0XHRcdH0sIGRlYm91bmNlTXMpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHJldHVybiB7XG5cdFx0XHRkaXNwb3NlKCkge1xuXHRcdFx0XHRkLmRpc3Bvc2UoKTtcblx0XHRcdFx0aGFzVmFsdWUgPSBmYWxzZTtcblx0XHRcdFx0bGFzdFZhbHVlID0gdW5kZWZpbmVkO1xuXHRcdFx0fSxcblx0XHR9O1xuXHR9LCAoKSA9PiB7XG5cdFx0aWYgKGhhc1ZhbHVlKSB7XG5cdFx0XHRyZXR1cm4gbGFzdFZhbHVlITtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIG9ic2VydmFibGUuZ2V0KCk7XG5cdFx0fVxuXHR9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdhc0V2ZW50VHJpZ2dlcmVkUmVjZW50bHkoZXZlbnQ6IEV2ZW50PGFueT4sIHRpbWVvdXRNczogbnVtYmVyLCBkaXNwb3NhYmxlU3RvcmU6IERpc3Bvc2FibGVTdG9yZSk6IElPYnNlcnZhYmxlPGJvb2xlYW4+IHtcblx0Y29uc3Qgb2JzZXJ2YWJsZSA9IG9ic2VydmFibGVWYWx1ZSgndHJpZ2dlcmVkUmVjZW50bHknLCBmYWxzZSk7XG5cblx0bGV0IHRpbWVvdXQ6IGFueSA9IHVuZGVmaW5lZDtcblxuXHRkaXNwb3NhYmxlU3RvcmUuYWRkKGV2ZW50KCgpID0+IHtcblx0XHRvYnNlcnZhYmxlLnNldCh0cnVlLCB1bmRlZmluZWQpO1xuXG5cdFx0aWYgKHRpbWVvdXQpIHtcblx0XHRcdGNsZWFyVGltZW91dCh0aW1lb3V0KTtcblx0XHR9XG5cdFx0dGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0b2JzZXJ2YWJsZS5zZXQoZmFsc2UsIHVuZGVmaW5lZCk7XG5cdFx0fSwgdGltZW91dE1zKTtcblx0fSkpO1xuXG5cdHJldHVybiBvYnNlcnZhYmxlO1xufVxuXG4vKipcbiAqIFRoaXMgbWFrZXMgc3VyZSB0aGUgb2JzZXJ2YWJsZSBpcyBiZWluZyBvYnNlcnZlZCBhbmQga2VlcHMgaXRzIGNhY2hlIGFsaXZlLlxuICovXG5leHBvcnQgZnVuY3Rpb24ga2VlcE9ic2VydmVkPFQ+KG9ic2VydmFibGU6IElPYnNlcnZhYmxlPFQ+KTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBvID0gbmV3IEtlZXBBbGl2ZU9ic2VydmVyKGZhbHNlLCB1bmRlZmluZWQpO1xuXHRvYnNlcnZhYmxlLmFkZE9ic2VydmVyKG8pO1xuXHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRvYnNlcnZhYmxlLnJlbW92ZU9ic2VydmVyKG8pO1xuXHR9KTtcbn1cblxuX3NldEtlZXBPYnNlcnZlZChrZWVwT2JzZXJ2ZWQpO1xuXG4vKipcbiAqIFRoaXMgY29udmVydHMgdGhlIGdpdmVuIG9ic2VydmFibGUgaW50byBhbiBhdXRvcnVuLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVjb21wdXRlSW5pdGlhbGx5QW5kT25DaGFuZ2U8VD4ob2JzZXJ2YWJsZTogSU9ic2VydmFibGU8VD4sIGhhbmRsZVZhbHVlPzogKHZhbHVlOiBUKSA9PiB2b2lkKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBvID0gbmV3IEtlZXBBbGl2ZU9ic2VydmVyKHRydWUsIGhhbmRsZVZhbHVlKTtcblx0b2JzZXJ2YWJsZS5hZGRPYnNlcnZlcihvKTtcblx0dHJ5IHtcblx0XHRvLmJlZ2luVXBkYXRlKG9ic2VydmFibGUpO1xuXHR9IGZpbmFsbHkge1xuXHRcdG8uZW5kVXBkYXRlKG9ic2VydmFibGUpO1xuXHR9XG5cblx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0b2JzZXJ2YWJsZS5yZW1vdmVPYnNlcnZlcihvKTtcblx0fSk7XG59XG5cbl9zZXRSZWNvbXB1dGVJbml0aWFsbHlBbmRPbkNoYW5nZShyZWNvbXB1dGVJbml0aWFsbHlBbmRPbkNoYW5nZSk7XG5cbmV4cG9ydCBjbGFzcyBLZWVwQWxpdmVPYnNlcnZlciBpbXBsZW1lbnRzIElPYnNlcnZlciB7XG5cdHByaXZhdGUgX2NvdW50ZXIgPSAwO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2ZvcmNlUmVjb21wdXRlOiBib29sZWFuLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2hhbmRsZVZhbHVlOiAoKHZhbHVlOiBhbnkpID0+IHZvaWQpIHwgdW5kZWZpbmVkLFxuXHQpIHsgfVxuXG5cdGJlZ2luVXBkYXRlPFQ+KG9ic2VydmFibGU6IElPYnNlcnZhYmxlPFQ+KTogdm9pZCB7XG5cdFx0dGhpcy5fY291bnRlcisrO1xuXHR9XG5cblx0ZW5kVXBkYXRlPFQ+KG9ic2VydmFibGU6IElPYnNlcnZhYmxlPFQ+KTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2NvdW50ZXIgPT09IDEgJiYgdGhpcy5fZm9yY2VSZWNvbXB1dGUpIHtcblx0XHRcdGlmICh0aGlzLl9oYW5kbGVWYWx1ZSkge1xuXHRcdFx0XHR0aGlzLl9oYW5kbGVWYWx1ZShvYnNlcnZhYmxlLmdldCgpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG9ic2VydmFibGUucmVwb3J0Q2hhbmdlcygpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9jb3VudGVyLS07XG5cdH1cblxuXHRoYW5kbGVQb3NzaWJsZUNoYW5nZTxUPihvYnNlcnZhYmxlOiBJT2JzZXJ2YWJsZTxUPik6IHZvaWQge1xuXHRcdC8vIE5PIE9QXG5cdH1cblxuXHRoYW5kbGVDaGFuZ2U8VCwgVENoYW5nZT4ob2JzZXJ2YWJsZTogSU9ic2VydmFibGVXaXRoQ2hhbmdlPFQsIFRDaGFuZ2U+LCBjaGFuZ2U6IFRDaGFuZ2UpOiB2b2lkIHtcblx0XHQvLyBOTyBPUFxuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZXJpdmVkT2JzZXJ2YWJsZVdpdGhDYWNoZTxUPihvd25lcjogRGVidWdPd25lciwgY29tcHV0ZUZuOiAocmVhZGVyOiBJUmVhZGVyLCBsYXN0VmFsdWU6IFQgfCB1bmRlZmluZWQpID0+IFQpOiBJT2JzZXJ2YWJsZTxUPiB7XG5cdGxldCBsYXN0VmFsdWU6IFQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdGNvbnN0IG9ic2VydmFibGUgPSBkZXJpdmVkT3B0cyh7IG93bmVyLCBkZWJ1Z1JlZmVyZW5jZUZuOiBjb21wdXRlRm4gfSwgcmVhZGVyID0+IHtcblx0XHRsYXN0VmFsdWUgPSBjb21wdXRlRm4ocmVhZGVyLCBsYXN0VmFsdWUpO1xuXHRcdHJldHVybiBsYXN0VmFsdWU7XG5cdH0pO1xuXHRyZXR1cm4gb2JzZXJ2YWJsZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlcml2ZWRPYnNlcnZhYmxlV2l0aFdyaXRhYmxlQ2FjaGU8VD4ob3duZXI6IG9iamVjdCwgY29tcHV0ZUZuOiAocmVhZGVyOiBJUmVhZGVyLCBsYXN0VmFsdWU6IFQgfCB1bmRlZmluZWQpID0+IFQpOiBJT2JzZXJ2YWJsZTxUPlxuXHQmIHsgY2xlYXJDYWNoZSh0cmFuc2FjdGlvbjogSVRyYW5zYWN0aW9uKTogdm9pZDsgc2V0Q2FjaGUobmV3VmFsdWU6IFQgfCB1bmRlZmluZWQsIHR4OiBJVHJhbnNhY3Rpb24gfCB1bmRlZmluZWQpOiB2b2lkIH0ge1xuXHRsZXQgbGFzdFZhbHVlOiBUIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRjb25zdCBvbkNoYW5nZSA9IG9ic2VydmFibGVTaWduYWwoJ2Rlcml2ZWRPYnNlcnZhYmxlV2l0aFdyaXRhYmxlQ2FjaGUnKTtcblx0Y29uc3Qgb2JzZXJ2YWJsZSA9IGRlcml2ZWQob3duZXIsIHJlYWRlciA9PiB7XG5cdFx0b25DaGFuZ2UucmVhZChyZWFkZXIpO1xuXHRcdGxhc3RWYWx1ZSA9IGNvbXB1dGVGbihyZWFkZXIsIGxhc3RWYWx1ZSk7XG5cdFx0cmV0dXJuIGxhc3RWYWx1ZTtcblx0fSk7XG5cdHJldHVybiBPYmplY3QuYXNzaWduKG9ic2VydmFibGUsIHtcblx0XHRjbGVhckNhY2hlOiAodHg6IElUcmFuc2FjdGlvbikgPT4ge1xuXHRcdFx0bGFzdFZhbHVlID0gdW5kZWZpbmVkO1xuXHRcdFx0b25DaGFuZ2UudHJpZ2dlcih0eCk7XG5cdFx0fSxcblx0XHRzZXRDYWNoZTogKG5ld1ZhbHVlOiBUIHwgdW5kZWZpbmVkLCB0eDogSVRyYW5zYWN0aW9uIHwgdW5kZWZpbmVkKSA9PiB7XG5cdFx0XHRsYXN0VmFsdWUgPSBuZXdWYWx1ZTtcblx0XHRcdG9uQ2hhbmdlLnRyaWdnZXIodHgpO1xuXHRcdH1cblx0fSk7XG59XG5cbi8qKlxuICogV2hlbiB0aGUgaXRlbXMgYXJyYXkgY2hhbmdlcywgcmVmZXJlbnRpYWwgZXF1YWwgaXRlbXMgYXJlIG5vdCBtYXBwZWQgYWdhaW4uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYXBPYnNlcnZhYmxlQXJyYXlDYWNoZWQ8VEluLCBUT3V0LCBUS2V5ID0gVEluPihvd25lcjogRGVidWdPd25lciwgaXRlbXM6IElPYnNlcnZhYmxlPHJlYWRvbmx5IFRJbltdPiwgbWFwOiAoaW5wdXQ6IFRJbiwgc3RvcmU6IERpc3Bvc2FibGVTdG9yZSkgPT4gVE91dCwga2V5U2VsZWN0b3I/OiAoaW5wdXQ6IFRJbikgPT4gVEtleSk6IElPYnNlcnZhYmxlPHJlYWRvbmx5IFRPdXRbXT4ge1xuXHRsZXQgbSA9IG5ldyBBcnJheU1hcChtYXAsIGtleVNlbGVjdG9yKTtcblx0Y29uc3Qgc2VsZiA9IGRlcml2ZWRPcHRzKHtcblx0XHRkZWJ1Z1JlZmVyZW5jZUZuOiBtYXAsXG5cdFx0b3duZXIsXG5cdFx0b25MYXN0T2JzZXJ2ZXJSZW1vdmVkOiAoKSA9PiB7XG5cdFx0XHRtLmRpc3Bvc2UoKTtcblx0XHRcdG0gPSBuZXcgQXJyYXlNYXAobWFwKTtcblx0XHR9XG5cdH0sIChyZWFkZXIpID0+IHtcblx0XHRtLnNldEl0ZW1zKGl0ZW1zLnJlYWQocmVhZGVyKSk7XG5cdFx0cmV0dXJuIG0uZ2V0SXRlbXMoKTtcblx0fSk7XG5cdHJldHVybiBzZWxmO1xufVxuXG5jbGFzcyBBcnJheU1hcDxUSW4sIFRPdXQsIFRLZXk+IGltcGxlbWVudHMgSURpc3Bvc2FibGUge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jYWNoZSA9IG5ldyBNYXA8VEtleSwgeyBvdXQ6IFRPdXQ7IHN0b3JlOiBEaXNwb3NhYmxlU3RvcmUgfT4oKTtcblx0cHJpdmF0ZSBfaXRlbXM6IFRPdXRbXSA9IFtdO1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9tYXA6IChpbnB1dDogVEluLCBzdG9yZTogRGlzcG9zYWJsZVN0b3JlKSA9PiBUT3V0LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2tleVNlbGVjdG9yPzogKGlucHV0OiBUSW4pID0+IFRLZXksXG5cdCkge1xuXHR9XG5cblx0cHVibGljIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fY2FjaGUuZm9yRWFjaChlbnRyeSA9PiBlbnRyeS5zdG9yZS5kaXNwb3NlKCkpO1xuXHRcdHRoaXMuX2NhY2hlLmNsZWFyKCk7XG5cdH1cblxuXHRwdWJsaWMgc2V0SXRlbXMoaXRlbXM6IHJlYWRvbmx5IFRJbltdKTogdm9pZCB7XG5cdFx0Y29uc3QgbmV3SXRlbXM6IFRPdXRbXSA9IFtdO1xuXHRcdGNvbnN0IGl0ZW1zVG9SZW1vdmUgPSBuZXcgU2V0KHRoaXMuX2NhY2hlLmtleXMoKSk7XG5cblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcblx0XHRcdGNvbnN0IGtleSA9IHRoaXMuX2tleVNlbGVjdG9yID8gdGhpcy5fa2V5U2VsZWN0b3IoaXRlbSkgOiBpdGVtIGFzIHVua25vd24gYXMgVEtleTtcblxuXHRcdFx0bGV0IGVudHJ5ID0gdGhpcy5fY2FjaGUuZ2V0KGtleSk7XG5cdFx0XHRpZiAoIWVudHJ5KSB7XG5cdFx0XHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0XHRjb25zdCBvdXQgPSB0aGlzLl9tYXAoaXRlbSwgc3RvcmUpO1xuXHRcdFx0XHRlbnRyeSA9IHsgb3V0LCBzdG9yZSB9O1xuXHRcdFx0XHR0aGlzLl9jYWNoZS5zZXQoa2V5LCBlbnRyeSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpdGVtc1RvUmVtb3ZlLmRlbGV0ZShrZXkpO1xuXHRcdFx0fVxuXHRcdFx0bmV3SXRlbXMucHVzaChlbnRyeS5vdXQpO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgaXRlbSBvZiBpdGVtc1RvUmVtb3ZlKSB7XG5cdFx0XHRjb25zdCBlbnRyeSA9IHRoaXMuX2NhY2hlLmdldChpdGVtKSE7XG5cdFx0XHRlbnRyeS5zdG9yZS5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9jYWNoZS5kZWxldGUoaXRlbSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5faXRlbXMgPSBuZXdJdGVtcztcblx0fVxuXG5cdHB1YmxpYyBnZXRJdGVtcygpOiBUT3V0W10ge1xuXHRcdHJldHVybiB0aGlzLl9pdGVtcztcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVmFsdWVXaXRoQ2hhbmdlRXZlbnRGcm9tT2JzZXJ2YWJsZTxUPiBpbXBsZW1lbnRzIElWYWx1ZVdpdGhDaGFuZ2VFdmVudDxUPiB7XG5cdGNvbnN0cnVjdG9yKHB1YmxpYyByZWFkb25seSBvYnNlcnZhYmxlOiBJT2JzZXJ2YWJsZTxUPikge1xuXHR9XG5cblx0Z2V0IG9uRGlkQ2hhbmdlKCk6IEV2ZW50PHZvaWQ+IHtcblx0XHRyZXR1cm4gRXZlbnQuZnJvbU9ic2VydmFibGVMaWdodCh0aGlzLm9ic2VydmFibGUpO1xuXHR9XG5cblx0Z2V0IHZhbHVlKCk6IFQge1xuXHRcdHJldHVybiB0aGlzLm9ic2VydmFibGUuZ2V0KCk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG9ic2VydmFibGVGcm9tVmFsdWVXaXRoQ2hhbmdlRXZlbnQ8VD4ob3duZXI6IERlYnVnT3duZXIsIHZhbHVlOiBJVmFsdWVXaXRoQ2hhbmdlRXZlbnQ8VD4pOiBJT2JzZXJ2YWJsZTxUPiB7XG5cdGlmICh2YWx1ZSBpbnN0YW5jZW9mIFZhbHVlV2l0aENoYW5nZUV2ZW50RnJvbU9ic2VydmFibGUpIHtcblx0XHRyZXR1cm4gdmFsdWUub2JzZXJ2YWJsZTtcblx0fVxuXHRyZXR1cm4gb2JzZXJ2YWJsZUZyb21FdmVudChvd25lciwgdmFsdWUub25EaWRDaGFuZ2UsICgpID0+IHZhbHVlLnZhbHVlKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIG9ic2VydmFibGUgdGhhdCBoYXMgdGhlIGxhdGVzdCBjaGFuZ2VkIHZhbHVlIG9mIHRoZSBnaXZlbiBvYnNlcnZhYmxlcy5cbiAqIEluaXRpYWxseSAoYW5kIHdoZW4gbm90IG9ic2VydmVkKSwgaXQgaGFzIHRoZSB2YWx1ZSBvZiB0aGUgbGFzdCBvYnNlcnZhYmxlLlxuICogV2hlbiBvYnNlcnZlZCBhbmQgYW55IG9mIHRoZSBvYnNlcnZhYmxlcyBjaGFuZ2UsIGl0IGhhcyB0aGUgdmFsdWUgb2YgdGhlIGxhc3QgY2hhbmdlZCBvYnNlcnZhYmxlLlxuICogSWYgbXVsdGlwbGUgb2JzZXJ2YWJsZXMgY2hhbmdlIGluIHRoZSBzYW1lIHRyYW5zYWN0aW9uLCB0aGUgbGFzdCBvYnNlcnZhYmxlIHdpbnMuXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIGxhdGVzdENoYW5nZWRWYWx1ZTxUIGV4dGVuZHMgSU9ic2VydmFibGU8YW55PltdPihvd25lcjogRGVidWdPd25lciwgb2JzZXJ2YWJsZXM6IFQpOiBJT2JzZXJ2YWJsZTxSZXR1cm5UeXBlPFRbbnVtYmVyXVsnZ2V0J10+PiB7XG5cdGlmIChvYnNlcnZhYmxlcy5sZW5ndGggPT09IDApIHtcblx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCk7XG5cdH1cblxuXHRsZXQgaGFzTGFzdENoYW5nZWRWYWx1ZSA9IGZhbHNlO1xuXHRsZXQgbGFzdENoYW5nZWRWYWx1ZTogYW55ID0gdW5kZWZpbmVkO1xuXG5cdGNvbnN0IHJlc3VsdCA9IG9ic2VydmFibGVGcm9tRXZlbnQ8YW55LCB2b2lkPihvd25lciwgY2IgPT4ge1xuXHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGZvciAoY29uc3QgbyBvZiBvYnNlcnZhYmxlcykge1xuXHRcdFx0c3RvcmUuYWRkKGF1dG9ydW5PcHRzKHsgZGVidWdOYW1lOiAoKSA9PiBnZXREZWJ1Z05hbWUocmVzdWx0LCBuZXcgRGVidWdOYW1lRGF0YShvd25lciwgdW5kZWZpbmVkLCB1bmRlZmluZWQpKSArICcudXBkYXRlTGFzdENoYW5nZWRWYWx1ZScgfSwgcmVhZGVyID0+IHtcblx0XHRcdFx0aGFzTGFzdENoYW5nZWRWYWx1ZSA9IHRydWU7XG5cdFx0XHRcdGxhc3RDaGFuZ2VkVmFsdWUgPSBvLnJlYWQocmVhZGVyKTtcblx0XHRcdFx0Y2IoKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cdFx0c3RvcmUuYWRkKHtcblx0XHRcdGRpc3Bvc2UoKSB7XG5cdFx0XHRcdGhhc0xhc3RDaGFuZ2VkVmFsdWUgPSBmYWxzZTtcblx0XHRcdFx0bGFzdENoYW5nZWRWYWx1ZSA9IHVuZGVmaW5lZDtcblx0XHRcdH0sXG5cdFx0fSk7XG5cdFx0cmV0dXJuIHN0b3JlO1xuXHR9LCAoKSA9PiB7XG5cdFx0aWYgKGhhc0xhc3RDaGFuZ2VkVmFsdWUpIHtcblx0XHRcdHJldHVybiBsYXN0Q2hhbmdlZFZhbHVlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gb2JzZXJ2YWJsZXNbb2JzZXJ2YWJsZXMubGVuZ3RoIC0gMV0uZ2V0KCk7XG5cdFx0fVxuXHR9KTtcblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBXb3JrcyBsaWtlIGEgZGVyaXZlZC5cbiAqIEhvd2V2ZXIsIGlmIHRoZSB2YWx1ZSBpcyBub3QgdW5kZWZpbmVkLCBpdCBpcyBjYWNoZWQgYW5kIHdpbGwgbm90IGJlIHJlY29tcHV0ZWQgYW55bW9yZS5cbiAqIEluIHRoYXQgY2FzZSwgdGhlIGRlcml2ZWQgd2lsbCB1bnN1YnNjcmliZSBmcm9tIGl0cyBkZXBlbmRlbmNpZXMuXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIGRlcml2ZWRDb25zdE9uY2VEZWZpbmVkPFQ+KG93bmVyOiBEZWJ1Z093bmVyLCBmbjogKHJlYWRlcjogSVJlYWRlcikgPT4gVCk6IElPYnNlcnZhYmxlPFQgfCB1bmRlZmluZWQ+IHtcblx0cmV0dXJuIGRlcml2ZWRPYnNlcnZhYmxlV2l0aENhY2hlPFQgfCB1bmRlZmluZWQ+KG93bmVyLCAocmVhZGVyLCBsYXN0VmFsdWUpID0+IGxhc3RWYWx1ZSA/PyBmbihyZWFkZXIpKTtcbn1cblxudHlwZSBSZW1vdmVVbmRlZmluZWQ8VD4gPSBUIGV4dGVuZHMgdW5kZWZpbmVkID8gbmV2ZXIgOiBUO1xuXG5leHBvcnQgZnVuY3Rpb24gcnVuT25DaGFuZ2U8VCwgVENoYW5nZT4ob2JzZXJ2YWJsZTogSU9ic2VydmFibGVXaXRoQ2hhbmdlPFQsIFRDaGFuZ2U+LCBjYjogKHZhbHVlOiBULCBwcmV2aW91c1ZhbHVlOiB1bmRlZmluZWQgfCBULCBkZWx0YXM6IFJlbW92ZVVuZGVmaW5lZDxUQ2hhbmdlPltdKSA9PiB2b2lkKTogSURpc3Bvc2FibGUge1xuXHRsZXQgX3ByZXZpb3VzVmFsdWU6IFQgfCB1bmRlZmluZWQ7XG5cdHJldHVybiBhdXRvcnVuV2l0aFN0b3JlSGFuZGxlQ2hhbmdlcyh7XG5cdFx0Y3JlYXRlRW1wdHlDaGFuZ2VTdW1tYXJ5OiAoKSA9PiAoeyBkZWx0YXM6IFtdIGFzIFJlbW92ZVVuZGVmaW5lZDxUQ2hhbmdlPltdLCBkaWRDaGFuZ2U6IGZhbHNlIH0pLFxuXHRcdGhhbmRsZUNoYW5nZTogKGNvbnRleHQsIGNoYW5nZVN1bW1hcnkpID0+IHtcblx0XHRcdGlmIChjb250ZXh0LmRpZENoYW5nZShvYnNlcnZhYmxlKSkge1xuXHRcdFx0XHRjb25zdCBlID0gY29udGV4dC5jaGFuZ2U7XG5cdFx0XHRcdGlmIChlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRjaGFuZ2VTdW1tYXJ5LmRlbHRhcy5wdXNoKGUgYXMgUmVtb3ZlVW5kZWZpbmVkPFRDaGFuZ2U+KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjaGFuZ2VTdW1tYXJ5LmRpZENoYW5nZSA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9LFxuXHR9LCAocmVhZGVyLCBjaGFuZ2VTdW1tYXJ5KSA9PiB7XG5cdFx0Y29uc3QgdmFsdWUgPSBvYnNlcnZhYmxlLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBwcmV2aW91c1ZhbHVlID0gX3ByZXZpb3VzVmFsdWU7XG5cdFx0aWYgKGNoYW5nZVN1bW1hcnkuZGlkQ2hhbmdlKSB7XG5cdFx0XHRfcHJldmlvdXNWYWx1ZSA9IHZhbHVlO1xuXHRcdFx0Y2IodmFsdWUsIHByZXZpb3VzVmFsdWUsIGNoYW5nZVN1bW1hcnkuZGVsdGFzKTtcblx0XHR9XG5cdH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcnVuT25DaGFuZ2VXaXRoU3RvcmU8VCwgVENoYW5nZT4ob2JzZXJ2YWJsZTogSU9ic2VydmFibGVXaXRoQ2hhbmdlPFQsIFRDaGFuZ2U+LCBjYjogKHZhbHVlOiBULCBwcmV2aW91c1ZhbHVlOiB1bmRlZmluZWQgfCBULCBkZWx0YXM6IFJlbW92ZVVuZGVmaW5lZDxUQ2hhbmdlPltdLCBzdG9yZTogRGlzcG9zYWJsZVN0b3JlKSA9PiB2b2lkKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0Y29uc3QgZGlzcG9zYWJsZSA9IHJ1bk9uQ2hhbmdlKG9ic2VydmFibGUsICh2YWx1ZSwgcHJldmlvdXNWYWx1ZTogdW5kZWZpbmVkIHwgVCwgZGVsdGFzKSA9PiB7XG5cdFx0c3RvcmUuY2xlYXIoKTtcblx0XHRjYih2YWx1ZSwgcHJldmlvdXNWYWx1ZSwgZGVsdGFzLCBzdG9yZSk7XG5cdH0pO1xuXHRyZXR1cm4ge1xuXHRcdGRpc3Bvc2UoKSB7XG5cdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdHN0b3JlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH07XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLFNBQVMsYUFBYSxxQ0FBcUM7QUFDcEUsU0FBUyxnQkFBZ0Isc0JBQTRGLGtCQUFrQixtQ0FBbUMsaUJBQWlCLGdCQUFnQixtQkFBbUI7QUFDOU4sU0FBUyxlQUEyQyxvQkFBcUI7QUFDekUsU0FBUyxvQkFBb0IsaUJBQW1DLE9BQTJDLGNBQWMsb0JBQW9CO0FBQzdJLFNBQVMsU0FBUyxtQkFBbUI7QUFDckMsU0FBUyxpQkFBaUI7QUFLbkIsU0FBUyxnQkFBbUIsT0FBMEI7QUFDNUQsU0FBTyxJQUFJLGdCQUFnQixLQUFLO0FBQ2pDO0FBRUEsTUFBTSx3QkFBMkIscUJBQThCO0FBQUEsRUFDOUQsWUFBNkIsT0FBVTtBQUN0QyxVQUFNO0FBRHNCO0FBQUEsRUFFN0I7QUFBQSxFQUVBLElBQW9CLFlBQW9CO0FBQ3ZDLFdBQU8sS0FBSyxTQUFTO0FBQUEsRUFDdEI7QUFBQSxFQUVPLE1BQVM7QUFDZixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFD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O0FBQ3RCLDJCQUFtQixFQUFFLEtBQUssTUFBTTtBQUNoQyxXQUFHO0FBQUEsTUFDSixDQUFDLENBQUM7QUFBQSxJQUNIO0FBQ0EsVUFBTSxJQUFJO0FBQUEsTUFDVCxVQUFVO0FBQ1QsOEJBQXNCO0FBQ3RCLDJCQUFtQjtBQUFBLE1BQ3BCO0FBQUEsSUFDRCxDQUFDO0FBQ0QsV0FBTztBQUFBLEVBQ1IsR0FBRyxNQUFNO0FBQ1IsUUFBSSxxQkFBcUI7QUFDeEIsYUFBTztBQUFBLElBQ1IsT0FBTztBQUNOLGFBQU8sWUFBWSxZQUFZLFNBQVMsQ0FBQyxFQUFFLElBQUk7QUFBQSxJQUNoRDtBQUFBLEVBQ0QsQ0FBQztBQUNELFNBQU87QUFDUjtBQU9PLFNBQVMsd0JBQTJCLE9BQW1CLElBQXdEO0FBQ3JILFNBQU8sMkJBQTBDLE9BQU8sQ0FBQyxRQUFRLGNBQWMsYUFBYSxHQUFHLE1BQU0sQ0FBQztBQUN2RztBQUlPLFNBQVMsWUFBd0IsWUFBK0MsSUFBdUc7QUFDN0wsTUFBSTtBQUNKLFNBQU8sOEJBQThCO0FBQUEsSUFDcEMsMEJBQTBCLE9BQU8sRUFBRSxRQUFRLENBQUMsR0FBaUMsV0FBVyxNQUFNO0FBQUEsSUFDOUYsY0FBYyxDQUFDLFNBQVMsa0JBQWtCO0FBQ3pDLFVBQUksUUFBUSxVQUFVLFVBQVUsR0FBRztBQUNsQyxjQUFNLElBQUksUUFBUTtBQUNsQixZQUFJLE1BQU0sUUFBVztBQUNwQix3QkFBYyxPQUFPLEtBQUssQ0FBNkI7QUFBQSxRQUN4RDtBQUNBLHNCQUFjLFlBQVk7QUFBQSxNQUMzQjtBQUNBLGFBQU87QUFBQSxJQUNSO0FBQUEsRUFDRCxHQUFHLENBQUMsUUFBUSxrQkFBa0I7QUFDN0IsVUFBTSxRQUFRLFdBQVcsS0FBSyxNQUFNO0FBQ3BDLFVBQU0sZ0JBQWdCO0FBQ3RCLFFBQUksY0FBYyxXQUFXO0FBQzVCLHVCQUFpQjtBQUNqQixTQUFHLE9BQU8sZUFBZSxjQUFjLE1BQU07QUFBQSxJQUM5QztBQUFBLEVBQ0QsQ0FBQztBQUNGO0FBRU8sU0FBUyxxQkFBaUMsWUFBK0MsSUFBK0g7QUFDOU4sUUFBTSxRQUFRLElBQUksZ0JBQWdCO0FBQ2xDLFFBQU0sYUFBYSxZQUFZLFlBQVksQ0FBQyxPQUFPLGVBQThCLFdBQVc7QUFDM0YsVUFBTSxNQUFNO0FBQ1osT0FBRyxPQUFPLGVBQWUsUUFBUSxLQUFLO0FBQUEsRUFDdkMsQ0FBQztBQUNELFNBQU87QUFBQSxJQUNOLFVBQVU7QUFDVCxpQkFBVyxRQUFRO0FBQ25CLFlBQU0sUUFBUTtBQUFBLElBQ2Y7QUFBQSxFQUNEO0FBQ0Q7IiwKICAibmFtZXMiOiBbIm9ic2VydmFibGVGcm9tRXZlbnQiLCAidHgiLCAiZGVib3VuY2VkT2JzZXJ2YWJsZSJdCn0K
