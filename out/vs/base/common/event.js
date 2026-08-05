import { diffSets } from "./collections.js";
import { onUnexpectedError } from "./errors.js";
import { createSingleCallFunction } from "./functional.js";
import { combinedDisposable, Disposable, DisposableMap, DisposableStore, toDisposable } from "./lifecycle.js";
import { LinkedList } from "./linkedList.js";
import { StopWatch } from "./stopwatch.js";
const _enableDisposeWithListenerWarning = false;
const _enableSnapshotPotentialLeakWarning = false;
var Event;
((Event2) => {
  Event2.None = () => Disposable.None;
  function _addLeakageTraceLogic(options) {
    if (_enableSnapshotPotentialLeakWarning) {
      const { onDidAddListener: origListenerDidAdd } = options;
      const stack = Stacktrace.create();
      let count = 0;
      options.onDidAddListener = () => {
        if (++count === 2) {
          console.warn("snapshotted emitter LIKELY used public and SHOULD HAVE BEEN created with DisposableStore. snapshotted here");
          stack.print();
        }
        origListenerDidAdd?.();
      };
    }
  }
  function defer(event, disposable) {
    return debounce(event, () => void 0, 0, void 0, true, void 0, disposable);
  }
  Event2.defer = defer;
  function once(event) {
    return (listener, thisArgs = null, disposables) => {
      let didFire = false;
      let result = void 0;
      result = event((e) => {
        if (didFire) {
          return;
        } else if (result) {
          result.dispose();
        } else {
          didFire = true;
        }
        return listener.call(thisArgs, e);
      }, null, disposables);
      if (didFire) {
        result.dispose();
      }
      return result;
    };
  }
  Event2.once = once;
  function onceIf(event, condition) {
    return Event2.once(Event2.filter(event, condition));
  }
  Event2.onceIf = onceIf;
  function map(event, map2, disposable) {
    return snapshot((listener, thisArgs = null, disposables) => event((i) => listener.call(thisArgs, map2(i)), null, disposables), disposable);
  }
  Event2.map = map;
  function forEach(event, each, disposable) {
    return snapshot((listener, thisArgs = null, disposables) => event((i) => {
      each(i);
      listener.call(thisArgs, i);
    }, null, disposables), disposable);
  }
  Event2.forEach = forEach;
  function filter(event, filter2, disposable) {
    return snapshot((listener, thisArgs = null, disposables) => event((e) => filter2(e) && listener.call(thisArgs, e), null, disposables), disposable);
  }
  Event2.filter = filter;
  function signal(event) {
    return event;
  }
  Event2.signal = signal;
  function any(...events) {
    return (listener, thisArgs = null, disposables) => {
      const disposable = combinedDisposable(...events.map((event) => event((e) => listener.call(thisArgs, e))));
      return addAndReturnDisposable(disposable, disposables);
    };
  }
  Event2.any = any;
  function reduce(event, merge, initial, disposable) {
    let output = initial;
    return map(event, (e) => {
      output = merge(output, e);
      return output;
    }, disposable);
  }
  Event2.reduce = reduce;
  function snapshot(event, disposable) {
    let listener;
    const options = {
      onWillAddFirstListener() {
        listener = event(emitter.fire, emitter);
      },
      onDidRemoveLastListener() {
        listener?.dispose();
      }
    };
    if (!disposable) {
      _addLeakageTraceLogic(options);
    }
    const emitter = new Emitter(options);
    disposable?.add(emitter);
    return emitter.event;
  }
  function addAndReturnDisposable(d, store) {
    if (store instanceof Array) {
      store.push(d);
    } else if (store) {
      store.add(d);
    }
    return d;
  }
  function debounce(event, merge, delay = 100, leading = false, flushOnListenerRemove = false, leakWarningThreshold, disposable) {
    let subscription;
    let output = void 0;
    let handle = void 0;
    let numDebouncedCalls = 0;
    let doFire;
    const options = {
      leakWarningThreshold,
      onWillAddFirstListener() {
        subscription = event((cur) => {
          numDebouncedCalls++;
          output = merge(output, cur);
          if (leading && !handle) {
            emitter.fire(output);
            output = void 0;
          }
          doFire = () => {
            const _output = output;
            output = void 0;
            handle = void 0;
            if (!leading || numDebouncedCalls > 1) {
              emitter.fire(_output);
            }
            numDebouncedCalls = 0;
          };
          if (typeof delay === "number") {
            clearTimeout(handle);
            handle = setTimeout(doFire, delay);
          } else {
            if (handle === void 0) {
              handle = 0;
              queueMicrotask(doFire);
            }
          }
        });
      },
      onWillRemoveListener() {
        if (flushOnListenerRemove && numDebouncedCalls > 0) {
          doFire?.();
        }
      },
      onDidRemoveLastListener() {
        doFire = void 0;
        subscription.dispose();
      }
    };
    if (!disposable) {
      _addLeakageTraceLogic(options);
    }
    const emitter = new Emitter(options);
    disposable?.add(emitter);
    return emitter.event;
  }
  Event2.debounce = debounce;
  function accumulate(event, delay = 0, disposable) {
    return Event2.debounce(event, (last, e) => {
      if (!last) {
        return [e];
      }
      last.push(e);
      return last;
    }, delay, void 0, true, void 0, disposable);
  }
  Event2.accumulate = accumulate;
  function latch(event, equals = (a, b) => a === b, disposable) {
    let firstCall = true;
    let cache;
    return filter(event, (value) => {
      const shouldEmit = firstCall || !equals(value, cache);
      firstCall = false;
      cache = value;
      return shouldEmit;
    }, disposable);
  }
  Event2.latch = latch;
  function split(event, isT, disposable) {
    return [
      Event2.filter(event, isT, disposable),
      Event2.filter(event, (e) => !isT(e), disposable)
    ];
  }
  Event2.split = split;
  function buffer(event, flushAfterTimeout = false, _buffer = [], disposable) {
    let buffer2 = _buffer.slice();
    let listener = event((e) => {
      if (buffer2) {
        buffer2.push(e);
      } else {
        emitter.fire(e);
      }
    });
    if (disposable) {
      disposable.add(listener);
    }
    const flush = () => {
      buffer2?.forEach((e) => emitter.fire(e));
      buffer2 = null;
    };
    const emitter = new Emitter({
      onWillAddFirstListener() {
        if (!listener) {
          listener = event((e) => emitter.fire(e));
          if (disposable) {
            disposable.add(listener);
          }
        }
      },
      onDidAddFirstListener() {
        if (buffer2) {
          if (flushAfterTimeout) {
            setTimeout(flush);
          } else {
            flush();
          }
        }
      },
      onDidRemoveLastListener() {
        if (listener) {
          listener.dispose();
        }
        listener = null;
      }
    });
    if (disposable) {
      disposable.add(emitter);
    }
    return emitter.event;
  }
  Event2.buffer = buffer;
  function chain(event, sythensize) {
    const fn = (listener, thisArgs, disposables) => {
      const cs = sythensize(new ChainableSynthesis());
      return event(function(value) {
        const result = cs.evaluate(value);
        if (result !== HaltChainable) {
          listener.call(thisArgs, result);
        }
      }, void 0, disposables);
    };
    return fn;
  }
  Event2.chain = chain;
  const HaltChainable = Symbol("HaltChainable");
  class ChainableSynthesis {
    constructor() {
      this.steps = [];
    }
    map(fn) {
      this.steps.push(fn);
      return this;
    }
    forEach(fn) {
      this.steps.push((v) => {
        fn(v);
        return v;
      });
      return this;
    }
    filter(fn) {
      this.steps.push((v) => fn(v) ? v : HaltChainable);
      return this;
    }
    reduce(merge, initial) {
      let last = initial;
      this.steps.push((v) => {
        last = merge(last, v);
        return last;
      });
      return this;
    }
    latch(equals = (a, b) => a === b) {
      let firstCall = true;
      let cache;
      this.steps.push((value) => {
        const shouldEmit = firstCall || !equals(value, cache);
        firstCall = false;
        cache = value;
        return shouldEmit ? value : HaltChainable;
      });
      return this;
    }
    evaluate(value) {
      for (const step of this.steps) {
        value = step(value);
        if (value === HaltChainable) {
          break;
        }
      }
      return value;
    }
  }
  function fromNodeEventEmitter(emitter, eventName, map2 = (id2) => id2) {
    const fn = (...args) => result.fire(map2(...args));
    const onFirstListenerAdd = () => emitter.on(eventName, fn);
    const onLastListenerRemove = () => emitter.removeListener(eventName, fn);
    const result = new Emitter({ onWillAddFirstListener: onFirstListenerAdd, onDidRemoveLastListener: onLastListenerRemove });
    return result.event;
  }
  Event2.fromNodeEventEmitter = fromNodeEventEmitter;
  function fromDOMEventEmitter(emitter, eventName, map2 = (id2) => id2) {
    const fn = (...args) => result.fire(map2(...args));
    const onFirstListenerAdd = () => emitter.addEventListener(eventName, fn);
    const onLastListenerRemove = () => emitter.removeEventListener(eventName, fn);
    const result = new Emitter({ onWillAddFirstListener: onFirstListenerAdd, onDidRemoveLastListener: onLastListenerRemove });
    return result.event;
  }
  Event2.fromDOMEventEmitter = fromDOMEventEmitter;
  function toPromise(event, disposables) {
    return new Promise((resolve) => once(event)(resolve, null, disposables));
  }
  Event2.toPromise = toPromise;
  function fromPromise(promise) {
    const result = new Emitter();
    promise.then((res) => {
      result.fire(res);
    }, () => {
      result.fire(void 0);
    }).finally(() => {
      result.dispose();
    });
    return result.event;
  }
  Event2.fromPromise = fromPromise;
  function forward(from, to) {
    return from((e) => to.fire(e));
  }
  Event2.forward = forward;
  function runAndSubscribe(event, handler, initial) {
    handler(initial);
    return event((e) => handler(e));
  }
  Event2.runAndSubscribe = runAndSubscribe;
  class EmitterObserver {
    constructor(_observable, store) {
      this._observable = _observable;
      this._counter = 0;
      this._hasChanged = false;
      const options = {
        onWillAddFirstListener: () => {
          _observable.addObserver(this);
          this._observable.reportChanges();
        },
        onDidRemoveLastListener: () => {
          _observable.removeObserver(this);
        }
      };
      if (!store) {
        _addLeakageTraceLogic(options);
      }
      this.emitter = new Emitter(options);
      if (store) {
        store.add(this.emitter);
      }
    }
    beginUpdate(_observable) {
      this._counter++;
    }
    handlePossibleChange(_observable) {
    }
    handleChange(_observable, _change) {
      this._hasChanged = true;
    }
    endUpdate(_observable) {
      this._counter--;
      if (this._counter === 0) {
        this._observable.reportChanges();
        if (this._hasChanged) {
          this._hasChanged = false;
          this.emitter.fire(this._observable.get());
        }
      }
    }
  }
  function fromObservable(obs, store) {
    const observer = new EmitterObserver(obs, store);
    return observer.emitter.event;
  }
  Event2.fromObservable = fromObservable;
  function fromObservableLight(observable) {
    return (listener, thisArgs, disposables) => {
      let count = 0;
      let didChange = false;
      const observer = {
        beginUpdate() {
          count++;
        },
        endUpdate() {
          count--;
          if (count === 0) {
            observable.reportChanges();
            if (didChange) {
              didChange = false;
              listener.call(thisArgs);
            }
          }
        },
        handlePossibleChange() {
        },
        handleChange() {
          didChange = true;
        }
      };
      observable.addObserver(observer);
      observable.reportChanges();
      const disposable = {
        dispose() {
          observable.removeObserver(observer);
        }
      };
      if (disposables instanceof DisposableStore) {
        disposables.add(disposable);
      } else if (Array.isArray(disposables)) {
        disposables.push(disposable);
      }
      return disposable;
    };
  }
  Event2.fromObservableLight = fromObservableLight;
})(Event || (Event = {}));
const _EventProfiling = class _EventProfiling {
  constructor(name) {
    this.listenerCount = 0;
    this.invocationCount = 0;
    this.elapsedOverall = 0;
    this.durations = [];
    this.name = `${name}_${_EventProfiling._idPool++}`;
    _EventProfiling.all.add(this);
  }
  start(listenerCount) {
    this._stopWatch = new StopWatch();
    this.listenerCount = listenerCount;
  }
  stop() {
    if (this._stopWatch) {
      const elapsed = this._stopWatch.elapsed();
      this.durations.push(elapsed);
      this.elapsedOverall += elapsed;
      this.invocationCount += 1;
      this._stopWatch = void 0;
    }
  }
};
_EventProfiling.all = /* @__PURE__ */ new Set();
_EventProfiling._idPool = 0;
let EventProfiling = _EventProfiling;
let _globalLeakWarningThreshold = -1;
function setGlobalLeakWarningThreshold(n) {
  const oldValue = _globalLeakWarningThreshold;
  _globalLeakWarningThreshold = n;
  return {
    dispose() {
      _globalLeakWarningThreshold = oldValue;
    }
  };
}
const _LeakageMonitor = class _LeakageMonitor {
  constructor(_errorHandler, threshold, name = (_LeakageMonitor._idPool++).toString(16).padStart(3, "0")) {
    this._errorHandler = _errorHandler;
    this.threshold = threshold;
    this.name = name;
    this._warnCountdown = 0;
  }
  dispose() {
    this._stacks?.clear();
  }
  check(stack, listenerCount) {
    const threshold = this.threshold;
    if (threshold <= 0 || listenerCount < threshold) {
      return void 0;
    }
    if (!this._stacks) {
      this._stacks = /* @__PURE__ */ new Map();
    }
    const count = this._stacks.get(stack.value) || 0;
    this._stacks.set(stack.value, count + 1);
    this._warnCountdown -= 1;
    if (this._warnCountdown <= 0) {
      this._warnCountdown = threshold * 0.5;
      const [topStack, topCount] = this.getMostFrequentStack();
      const message = `[${this.name}] potential listener LEAK detected, having ${listenerCount} listeners already. MOST frequent listener (${topCount}):`;
      console.warn(message);
      console.warn(topStack);
      const error = new ListenerLeakError(message, topStack);
      this._errorHandler(error);
    }
    return () => {
      const count2 = this._stacks.get(stack.value) || 0;
      this._stacks.set(stack.value, count2 - 1);
    };
  }
  getMostFrequentStack() {
    if (!this._stacks) {
      return void 0;
    }
    let topStack;
    let topCount = 0;
    for (const [stack, count] of this._stacks) {
      if (!topStack || topCount < count) {
        topStack = [stack, count];
        topCount = count;
      }
    }
    return topStack;
  }
};
_LeakageMonitor._idPool = 1;
let LeakageMonitor = _LeakageMonitor;
class Stacktrace {
  constructor(value) {
    this.value = value;
  }
  static create() {
    const err = new Error();
    return new Stacktrace(err.stack ?? "");
  }
  print() {
    console.warn(this.value.split("\n").slice(2).join("\n"));
  }
}
class ListenerLeakError extends Error {
  constructor(message, stack) {
    super(message);
    this.name = "ListenerLeakError";
    this.stack = stack;
  }
}
class ListenerRefusalError extends Error {
  constructor(message, stack) {
    super(message);
    this.name = "ListenerRefusalError";
    this.stack = stack;
  }
}
let id = 0;
class UniqueContainer {
  constructor(value) {
    this.value = value;
    this.id = id++;
  }
}
const compactionThreshold = 2;
const forEachListener = (listeners, fn) => {
  if (listeners instanceof UniqueContainer) {
    fn(listeners);
  } else {
    for (let i = 0; i < listeners.length; i++) {
      const l = listeners[i];
      if (l) {
        fn(l);
      }
    }
  }
};
class Emitter {
  constructor(options) {
    this._size = 0;
    this._options = options;
    this._leakageMon = _globalLeakWarningThreshold > 0 || this._options?.leakWarningThreshold ? new LeakageMonitor(options?.onListenerError ?? onUnexpectedError, this._options?.leakWarningThreshold ?? _globalLeakWarningThreshold) : void 0;
    this._perfMon = this._options?._profName ? new EventProfiling(this._options._profName) : void 0;
    this._deliveryQueue = this._options?.deliveryQueue;
  }
  dispose() {
    if (!this._disposed) {
      this._disposed = true;
      if (this._deliveryQueue?.current === this) {
        this._deliveryQueue.reset();
      }
      if (this._listeners) {
        if (_enableDisposeWithListenerWarning) {
          const listeners = this._listeners;
          queueMicrotask(() => {
            forEachListener(listeners, (l) => l.stack?.print());
          });
        }
        this._listeners = void 0;
        this._size = 0;
      }
      this._options?.onDidRemoveLastListener?.();
      this._leakageMon?.dispose();
    }
  }
  /**
   * For the public to allow to subscribe
   * to events from this Emitter
   */
  get event() {
    this._event ??= (callback, thisArgs, disposables) => {
      if (this._leakageMon && this._size > this._leakageMon.threshold ** 2) {
        const message = `[${this._leakageMon.name}] REFUSES to accept new listeners because it exceeded its threshold by far (${this._size} vs ${this._leakageMon.threshold})`;
        console.warn(message);
        const tuple = this._leakageMon.getMostFrequentStack() ?? ["UNKNOWN stack", -1];
        const error = new ListenerRefusalError(`${message}. HINT: Stack shows most frequent listener (${tuple[1]}-times)`, tuple[0]);
        const errorHandler = this._options?.onListenerError || onUnexpectedError;
        errorHandler(error);
        return Disposable.None;
      }
      if (this._disposed) {
        return Disposable.None;
      }
      if (thisArgs) {
        callback = callback.bind(thisArgs);
      }
      const contained = new UniqueContainer(callback);
      let removeMonitor;
      let stack;
      if (this._leakageMon && this._size >= Math.ceil(this._leakageMon.threshold * 0.2)) {
        contained.stack = Stacktrace.create();
        removeMonitor = this._leakageMon.check(contained.stack, this._size + 1);
      }
      if (_enableDisposeWithListenerWarning) {
        contained.stack = stack ?? Stacktrace.create();
      }
      if (!this._listeners) {
        this._options?.onWillAddFirstListener?.(this);
        this._listeners = contained;
        this._options?.onDidAddFirstListener?.(this);
      } else if (this._listeners instanceof UniqueContainer) {
        this._deliveryQueue ??= new EventDeliveryQueuePrivate();
        this._listeners = [this._listeners, contained];
      } else {
        this._listeners.push(contained);
      }
      this._options?.onDidAddListener?.(this);
      this._size++;
      const result = toDisposable(() => {
        removeMonitor?.();
        this._removeListener(contained);
      });
      if (disposables instanceof DisposableStore) {
        disposables.add(result);
      } else if (Array.isArray(disposables)) {
        disposables.push(result);
      }
      return result;
    };
    return this._event;
  }
  _removeListener(listener) {
    this._options?.onWillRemoveListener?.(this);
    if (!this._listeners) {
      return;
    }
    if (this._size === 1) {
      this._listeners = void 0;
      this._options?.onDidRemoveLastListener?.(this);
      this._size = 0;
      return;
    }
    const listeners = this._listeners;
    const index = listeners.indexOf(listener);
    if (index === -1) {
      console.log("disposed?", this._disposed);
      console.log("size?", this._size);
      console.log("arr?", JSON.stringify(this._listeners));
      throw new Error("Attempted to dispose unknown listener");
    }
    this._size--;
    listeners[index] = void 0;
    const adjustDeliveryQueue = this._deliveryQueue.current === this;
    if (this._size * compactionThreshold <= listeners.length) {
      let n = 0;
      for (let i = 0; i < listeners.length; i++) {
        if (listeners[i]) {
          listeners[n++] = listeners[i];
        } else if (adjustDeliveryQueue && n < this._deliveryQueue.end) {
          this._deliveryQueue.end--;
          if (n < this._deliveryQueue.i) {
            this._deliveryQueue.i--;
          }
        }
      }
      listeners.length = n;
    }
  }
  _deliver(listener, value) {
    if (!listener) {
      return;
    }
    const errorHandler = this._options?.onListenerError || onUnexpectedError;
    if (!errorHandler) {
      listener.value(value);
      return;
    }
    try {
      listener.value(value);
    } catch (e) {
      errorHandler(e);
    }
  }
  /** Delivers items in the queue. Assumes the queue is ready to go. */
  _deliverQueue(dq) {
    const listeners = dq.current._listeners;
    while (dq.i < dq.end) {
      this._deliver(listeners[dq.i++], dq.value);
    }
    dq.reset();
  }
  /**
   * To be kept private to fire an event to
   * subscribers
   */
  fire(event) {
    if (this._deliveryQueue?.current) {
      this._deliverQueue(this._deliveryQueue);
      this._perfMon?.stop();
    }
    this._perfMon?.start(this._size);
    if (!this._listeners) {
    } else if (this._listeners instanceof UniqueContainer) {
      this._deliver(this._listeners, event);
    } else {
      const dq = this._deliveryQueue;
      dq.enqueue(this, event, this._listeners.length);
      this._deliverQueue(dq);
    }
    this._perfMon?.stop();
  }
  hasListeners() {
    return this._size > 0;
  }
}
const createEventDeliveryQueue = () => new EventDeliveryQueuePrivate();
class EventDeliveryQueuePrivate {
  constructor() {
    /**
     * Index in current's listener list.
     */
    this.i = -1;
    /**
     * The last index in the listener's list to deliver.
     */
    this.end = 0;
  }
  enqueue(emitter, value, end) {
    this.i = 0;
    this.end = end;
    this.current = emitter;
    this.value = value;
  }
  reset() {
    this.i = this.end;
    this.current = void 0;
    this.value = void 0;
  }
}
class AsyncEmitter extends Emitter {
  async fireAsync(data, token, promiseJoin) {
    if (!this._listeners) {
      return;
    }
    if (!this._asyncDeliveryQueue) {
      this._asyncDeliveryQueue = new LinkedList();
    }
    forEachListener(this._listeners, (listener) => this._asyncDeliveryQueue.push([listener.value, data]));
    while (this._asyncDeliveryQueue.size > 0 && !token.isCancellationRequested) {
      const [listener, data2] = this._asyncDeliveryQueue.shift();
      const thenables = [];
      const event = {
        ...data2,
        token,
        waitUntil: (p) => {
          if (Object.isFrozen(thenables)) {
            throw new Error("waitUntil can NOT be called asynchronous");
          }
          if (promiseJoin) {
            p = promiseJoin(p, listener);
          }
          thenables.push(p);
        }
      };
      try {
        listener(event);
      } catch (e) {
        onUnexpectedError(e);
        continue;
      }
      Object.freeze(thenables);
      await Promise.allSettled(thenables).then((values) => {
        for (const value of values) {
          if (value.status === "rejected") {
            onUnexpectedError(value.reason);
          }
        }
      });
    }
  }
}
class PauseableEmitter extends Emitter {
  constructor(options) {
    super(options);
    this._isPaused = 0;
    this._eventQueue = new LinkedList();
    this._mergeFn = options?.merge;
  }
  get isPaused() {
    return this._isPaused !== 0;
  }
  pause() {
    this._isPaused++;
  }
  resume() {
    if (this._isPaused !== 0 && --this._isPaused === 0) {
      if (this._mergeFn) {
        if (this._eventQueue.size > 0) {
          const events = Array.from(this._eventQueue);
          this._eventQueue.clear();
          super.fire(this._mergeFn(events));
        }
      } else {
        while (!this._isPaused && this._eventQueue.size !== 0) {
          super.fire(this._eventQueue.shift());
        }
      }
    }
  }
  fire(event) {
    if (this._size) {
      if (this._isPaused !== 0) {
        this._eventQueue.push(event);
      } else {
        super.fire(event);
      }
    }
  }
}
class DebounceEmitter extends PauseableEmitter {
  constructor(options) {
    super(options);
    this._delay = options.delay ?? 100;
  }
  fire(event) {
    if (!this._handle) {
      this.pause();
      this._handle = setTimeout(() => {
        this._handle = void 0;
        this.resume();
      }, this._delay);
    }
    super.fire(event);
  }
}
class MicrotaskEmitter extends Emitter {
  constructor(options) {
    super(options);
    this._queuedEvents = [];
    this._mergeFn = options?.merge;
  }
  fire(event) {
    if (!this.hasListeners()) {
      return;
    }
    this._queuedEvents.push(event);
    if (this._queuedEvents.length === 1) {
      queueMicrotask(() => {
        if (this._mergeFn) {
          super.fire(this._mergeFn(this._queuedEvents));
        } else {
          this._queuedEvents.forEach((e) => super.fire(e));
        }
        this._queuedEvents = [];
      });
    }
  }
}
class EventMultiplexer {
  constructor() {
    this.hasListeners = false;
    this.events = [];
    this.emitter = new Emitter({
      onWillAddFirstListener: () => this.onFirstListenerAdd(),
      onDidRemoveLastListener: () => this.onLastListenerRemove()
    });
  }
  get event() {
    return this.emitter.event;
  }
  add(event) {
    const e = { event, listener: null };
    this.events.push(e);
    if (this.hasListeners) {
      this.hook(e);
    }
    const dispose = () => {
      if (this.hasListeners) {
        this.unhook(e);
      }
      const idx = this.events.indexOf(e);
      this.events.splice(idx, 1);
    };
    return toDisposable(createSingleCallFunction(dispose));
  }
  onFirstListenerAdd() {
    this.hasListeners = true;
    this.events.forEach((e) => this.hook(e));
  }
  onLastListenerRemove() {
    this.hasListeners = false;
    this.events.forEach((e) => this.unhook(e));
  }
  hook(e) {
    e.listener = e.event((r) => this.emitter.fire(r));
  }
  unhook(e) {
    e.listener?.dispose();
    e.listener = null;
  }
  dispose() {
    this.emitter.dispose();
    for (const e of this.events) {
      e.listener?.dispose();
    }
    this.events = [];
  }
}
class DynamicListEventMultiplexer {
  constructor(items, onAddItem, onRemoveItem, getEvent) {
    this._store = new DisposableStore();
    const multiplexer = this._store.add(new EventMultiplexer());
    const itemListeners = this._store.add(new DisposableMap());
    function addItem(instance) {
      itemListeners.set(instance, multiplexer.add(getEvent(instance)));
    }
    for (const instance of items) {
      addItem(instance);
    }
    this._store.add(onAddItem((instance) => {
      addItem(instance);
    }));
    this._store.add(onRemoveItem((instance) => {
      itemListeners.deleteAndDispose(instance);
    }));
    this.event = multiplexer.event;
  }
  dispose() {
    this._store.dispose();
  }
}
class EventBufferer {
  constructor() {
    this.data = [];
  }
  wrapEvent(event, reduce, initial) {
    return (listener, thisArgs, disposables) => {
      return event((i) => {
        const data = this.data[this.data.length - 1];
        if (!reduce) {
          if (data) {
            data.buffers.push(() => listener.call(thisArgs, i));
          } else {
            listener.call(thisArgs, i);
          }
          return;
        }
        const reduceData = data;
        if (!reduceData) {
          listener.call(thisArgs, reduce(initial, i));
          return;
        }
        reduceData.items ??= [];
        reduceData.items.push(i);
        if (reduceData.buffers.length === 0) {
          data.buffers.push(() => {
            reduceData.reducedResult ??= initial ? reduceData.items.reduce(reduce, initial) : reduceData.items.reduce(reduce);
            listener.call(thisArgs, reduceData.reducedResult);
          });
        }
      }, void 0, disposables);
    };
  }
  bufferEvents(fn) {
    const data = { buffers: new Array() };
    this.data.push(data);
    const r = fn();
    this.data.pop();
    data.buffers.forEach((flush) => flush());
    return r;
  }
}
class Relay {
  constructor() {
    this.listening = false;
    this.inputEvent = Event.None;
    this.inputEventListener = Disposable.None;
    this.emitter = new Emitter({
      onDidAddFirstListener: () => {
        this.listening = true;
        this.inputEventListener = this.inputEvent(this.emitter.fire, this.emitter);
      },
      onDidRemoveLastListener: () => {
        this.listening = false;
        this.inputEventListener.dispose();
      }
    });
    this.event = this.emitter.event;
  }
  set input(event) {
    this.inputEvent = event;
    if (this.listening) {
      this.inputEventListener.dispose();
      this.inputEventListener = event(this.emitter.fire, this.emitter);
    }
  }
  dispose() {
    this.inputEventListener.dispose();
    this.emitter.dispose();
  }
}
class ValueWithChangeEvent {
  constructor(_value) {
    this._value = _value;
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
  }
  static const(value) {
    return new ConstValueWithChangeEvent(value);
  }
  get value() {
    return this._value;
  }
  set value(value) {
    if (value !== this._value) {
      this._value = value;
      this._onDidChange.fire(void 0);
    }
  }
}
class ConstValueWithChangeEvent {
  constructor(value) {
    this.value = value;
    this.onDidChange = Event.None;
  }
}
function trackSetChanges(getData, onDidChangeData, handleItem) {
  const map = new DisposableMap();
  let oldData = new Set(getData());
  for (const d of oldData) {
    map.set(d, handleItem(d));
  }
  const store = new DisposableStore();
  store.add(onDidChangeData(() => {
    const newData = getData();
    const diff = diffSets(oldData, newData);
    for (const r of diff.removed) {
      map.deleteAndDispose(r);
    }
    for (const a of diff.added) {
      map.set(a, handleItem(a));
    }
    oldData = new Set(newData);
  }));
  store.add(map);
  return store;
}
export {
  AsyncEmitter,
  DebounceEmitter,
  DynamicListEventMultiplexer,
  Emitter,
  Event,
  EventBufferer,
  EventMultiplexer,
  EventProfiling,
  ListenerLeakError,
  ListenerRefusalError,
  MicrotaskEmitter,
  PauseableEmitter,
  Relay,
  ValueWithChangeEvent,
  createEventDeliveryQueue,
  setGlobalLeakWarningThreshold,
  trackSetChanges
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9ldmVudC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgZGlmZlNldHMgfSBmcm9tICcuL2NvbGxlY3Rpb25zLmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgY3JlYXRlU2luZ2xlQ2FsbEZ1bmN0aW9uIH0gZnJvbSAnLi9mdW5jdGlvbmFsLmpzJztcbmltcG9ydCB7IGNvbWJpbmVkRGlzcG9zYWJsZSwgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZU1hcCwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTGlua2VkTGlzdCB9IGZyb20gJy4vbGlua2VkTGlzdC5qcyc7XG5pbXBvcnQgeyBJT2JzZXJ2YWJsZSwgSU9ic2VydmFibGVXaXRoQ2hhbmdlLCBJT2JzZXJ2ZXIgfSBmcm9tICcuL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgU3RvcFdhdGNoIH0gZnJvbSAnLi9zdG9wd2F0Y2guanMnO1xuaW1wb3J0IHsgTWljcm90YXNrRGVsYXkgfSBmcm9tICcuL3N5bWJvbHMuanMnO1xuXG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBVbmNvbW1lbnQgdGhlIG5leHQgbGluZSB0byBwcmludCB3YXJuaW5ncyB3aGVuZXZlciBhbiBlbWl0dGVyIHdpdGggbGlzdGVuZXJzIGlzIGRpc3Bvc2VkLiBUaGF0IGlzIGEgc2lnbiBvZiBjb2RlIHNtZWxsLlxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbmNvbnN0IF9lbmFibGVEaXNwb3NlV2l0aExpc3RlbmVyV2FybmluZyA9IGZhbHNlXG5cdC8vIHx8IEJvb2xlYW4oXCJUUlVFXCIpIC8vIGNhdXNlcyBhIGxpbnRlciB3YXJuaW5nIHNvIHRoYXQgaXQgY2Fubm90IGJlIHB1c2hlZFxuXHQ7XG5cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIFVuY29tbWVudCB0aGUgbmV4dCBsaW5lIHRvIHByaW50IHdhcm5pbmdzIHdoZW5ldmVyIGEgc25hcHNob3R0ZWQgZXZlbnQgaXMgdXNlZCByZXBlYXRlZGx5IHdpdGhvdXQgY2xlYW51cC5cbi8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTQyODUxXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuY29uc3QgX2VuYWJsZVNuYXBzaG90UG90ZW50aWFsTGVha1dhcm5pbmcgPSBmYWxzZVxuXHQvLyB8fCBCb29sZWFuKFwiVFJVRVwiKSAvLyBjYXVzZXMgYSBsaW50ZXIgd2FybmluZyBzbyB0aGF0IGl0IGNhbm5vdCBiZSBwdXNoZWRcblx0O1xuXG4vKipcbiAqIEFuIGV2ZW50IHdpdGggemVybyBvciBvbmUgcGFyYW1ldGVycyB0aGF0IGNhbiBiZSBzdWJzY3JpYmVkIHRvLiBUaGUgZXZlbnQgaXMgYSBmdW5jdGlvbiBpdHNlbGYuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRXZlbnQ8VD4ge1xuXHQobGlzdGVuZXI6IChlOiBUKSA9PiB1bmtub3duLCB0aGlzQXJncz86IGFueSwgZGlzcG9zYWJsZXM/OiBJRGlzcG9zYWJsZVtdIHwgRGlzcG9zYWJsZVN0b3JlKTogSURpc3Bvc2FibGU7XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgRXZlbnQge1xuXHRleHBvcnQgY29uc3QgTm9uZTogRXZlbnQ8YW55PiA9ICgpID0+IERpc3Bvc2FibGUuTm9uZTtcblxuXHRmdW5jdGlvbiBfYWRkTGVha2FnZVRyYWNlTG9naWMob3B0aW9uczogRW1pdHRlck9wdGlvbnMpIHtcblx0XHRpZiAoX2VuYWJsZVNuYXBzaG90UG90ZW50aWFsTGVha1dhcm5pbmcpIHtcblx0XHRcdGNvbnN0IHsgb25EaWRBZGRMaXN0ZW5lcjogb3JpZ0xpc3RlbmVyRGlkQWRkIH0gPSBvcHRpb25zO1xuXHRcdFx0Y29uc3Qgc3RhY2sgPSBTdGFja3RyYWNlLmNyZWF0ZSgpO1xuXHRcdFx0bGV0IGNvdW50ID0gMDtcblx0XHRcdG9wdGlvbnMub25EaWRBZGRMaXN0ZW5lciA9ICgpID0+IHtcblx0XHRcdFx0aWYgKCsrY291bnQgPT09IDIpIHtcblx0XHRcdFx0XHRjb25zb2xlLndhcm4oJ3NuYXBzaG90dGVkIGVtaXR0ZXIgTElLRUxZIHVzZWQgcHVibGljIGFuZCBTSE9VTEQgSEFWRSBCRUVOIGNyZWF0ZWQgd2l0aCBEaXNwb3NhYmxlU3RvcmUuIHNuYXBzaG90dGVkIGhlcmUnKTtcblx0XHRcdFx0XHRzdGFjay5wcmludCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG9yaWdMaXN0ZW5lckRpZEFkZD8uKCk7XG5cdFx0XHR9O1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBHaXZlbiBhbiBldmVudCwgcmV0dXJucyBhbm90aGVyIGV2ZW50IHdoaWNoIGRlYm91bmNlcyBjYWxscyBhbmQgZGVmZXJzIHRoZSBsaXN0ZW5lcnMgdG8gYSBsYXRlciB0YXNrIHZpYSBhIHNoYXJlZFxuXHQgKiBgc2V0VGltZW91dGAuIFRoZSBldmVudCBpcyBjb252ZXJ0ZWQgaW50byBhIHNpZ25hbCAoYEV2ZW50PHZvaWQ+YCkgdG8gYXZvaWQgYWRkaXRpb25hbCBvYmplY3QgY3JlYXRpb24gYXMgYVxuXHQgKiByZXN1bHQgb2YgbWVyZ2luZyBldmVudHMgYW5kIHRvIHRyeSBwcmV2ZW50IHJhY2UgY29uZGl0aW9ucyB0aGF0IGNvdWxkIGFyaXNlIHdoZW4gdXNpbmcgcmVsYXRlZCBkZWZlcnJlZCBhbmRcblx0ICogbm9uLWRlZmVycmVkIGV2ZW50cy5cblx0ICpcblx0ICogVGhpcyBpcyB1c2VmdWwgZm9yIGRlZmVycmluZyBub24tY3JpdGljYWwgd29yayAoZWcuIGdlbmVyYWwgVUkgdXBkYXRlcykgdG8gZW5zdXJlIGl0IGRvZXMgbm90IGJsb2NrIGNyaXRpY2FsIHdvcmtcblx0ICogKGVnLiBsYXRlbmN5IG9mIGtleXByZXNzIHRvIHRleHQgcmVuZGVyZWQpLlxuXHQgKlxuXHQgKiAqTk9URSogdGhhdCB0aGlzIGZ1bmN0aW9uIHJldHVybnMgYW4gYEV2ZW50YCBhbmQgaXQgTVVTVCBiZSBjYWxsZWQgd2l0aCBhIGBEaXNwb3NhYmxlU3RvcmVgIHdoZW5ldmVyIHRoZSByZXR1cm5lZFxuXHQgKiBldmVudCBpcyBhY2Nlc3NpYmxlIHRvIFwidGhpcmQgcGFydGllc1wiLCBlLmcgdGhlIGV2ZW50IGlzIGEgcHVibGljIHByb3BlcnR5LiBPdGhlcndpc2UgYSBsZWFrZWQgbGlzdGVuZXIgb24gdGhlXG5cdCAqIHJldHVybmVkIGV2ZW50IGNhdXNlcyB0aGlzIHV0aWxpdHkgdG8gbGVhayBhIGxpc3RlbmVyIG9uIHRoZSBvcmlnaW5hbCBldmVudC5cblx0ICpcblx0ICogQHBhcmFtIGV2ZW50IFRoZSBldmVudCBzb3VyY2UgZm9yIHRoZSBuZXcgZXZlbnQuXG5cdCAqIEBwYXJhbSBkaXNwb3NhYmxlIEEgZGlzcG9zYWJsZSBzdG9yZSB0byBhZGQgdGhlIG5ldyBFdmVudEVtaXR0ZXIgdG8uXG5cdCAqL1xuXHRleHBvcnQgZnVuY3Rpb24gZGVmZXIoZXZlbnQ6IEV2ZW50PHVua25vd24+LCBkaXNwb3NhYmxlPzogRGlzcG9zYWJsZVN0b3JlKTogRXZlbnQ8dm9pZD4ge1xuXHRcdHJldHVybiBkZWJvdW5jZTx1bmtub3duLCB2b2lkPihldmVudCwgKCkgPT4gdm9pZCAwLCAwLCB1bmRlZmluZWQsIHRydWUsIHVuZGVmaW5lZCwgZGlzcG9zYWJsZSk7XG5cdH1cblxuXHQvKipcblx0ICogR2l2ZW4gYW4gZXZlbnQsIHJldHVybnMgYW5vdGhlciBldmVudCB3aGljaCBvbmx5IGZpcmVzIG9uY2UuXG5cdCAqXG5cdCAqIEBwYXJhbSBldmVudCBUaGUgZXZlbnQgc291cmNlIGZvciB0aGUgbmV3IGV2ZW50LlxuXHQgKi9cblx0ZXhwb3J0IGZ1bmN0aW9uIG9uY2U8VD4oZXZlbnQ6IEV2ZW50PFQ+KTogRXZlbnQ8VD4ge1xuXHRcdHJldHVybiAobGlzdGVuZXIsIHRoaXNBcmdzID0gbnVsbCwgZGlzcG9zYWJsZXM/KSA9PiB7XG5cdFx0XHQvLyB3ZSBuZWVkIHRoaXMsIGluIGNhc2UgdGhlIGV2ZW50IGZpcmVzIGR1cmluZyB0aGUgbGlzdGVuZXIgY2FsbFxuXHRcdFx0bGV0IGRpZEZpcmUgPSBmYWxzZTtcblx0XHRcdGxldCByZXN1bHQ6IElEaXNwb3NhYmxlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0cmVzdWx0ID0gZXZlbnQoZSA9PiB7XG5cdFx0XHRcdGlmIChkaWRGaXJlKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHJlc3VsdCkge1xuXHRcdFx0XHRcdHJlc3VsdC5kaXNwb3NlKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZGlkRmlyZSA9IHRydWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gbGlzdGVuZXIuY2FsbCh0aGlzQXJncywgZSk7XG5cdFx0XHR9LCBudWxsLCBkaXNwb3NhYmxlcyk7XG5cblx0XHRcdGlmIChkaWRGaXJlKSB7XG5cdFx0XHRcdHJlc3VsdC5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHaXZlbiBhbiBldmVudCwgcmV0dXJucyBhbm90aGVyIGV2ZW50IHdoaWNoIG9ubHkgZmlyZXMgb25jZSwgYW5kIG9ubHkgd2hlbiB0aGUgY29uZGl0aW9uIGlzIG1ldC5cblx0ICpcblx0ICogQHBhcmFtIGV2ZW50IFRoZSBldmVudCBzb3VyY2UgZm9yIHRoZSBuZXcgZXZlbnQuXG5cdCAqL1xuXHRleHBvcnQgZnVuY3Rpb24gb25jZUlmPFQ+KGV2ZW50OiBFdmVudDxUPiwgY29uZGl0aW9uOiAoZTogVCkgPT4gYm9vbGVhbik6IEV2ZW50PFQ+IHtcblx0XHRyZXR1cm4gRXZlbnQub25jZShFdmVudC5maWx0ZXIoZXZlbnQsIGNvbmRpdGlvbikpO1xuXHR9XG5cblx0LyoqXG5cdCAqIE1hcHMgYW4gZXZlbnQgb2Ygb25lIHR5cGUgaW50byBhbiBldmVudCBvZiBhbm90aGVyIHR5cGUgdXNpbmcgYSBtYXBwaW5nIGZ1bmN0aW9uLCBzaW1pbGFyIHRvIGhvd1xuXHQgKiBgQXJyYXkucHJvdG90eXBlLm1hcGAgd29ya3MuXG5cdCAqXG5cdCAqICpOT1RFKiB0aGF0IHRoaXMgZnVuY3Rpb24gcmV0dXJucyBhbiBgRXZlbnRgIGFuZCBpdCBNVVNUIGJlIGNhbGxlZCB3aXRoIGEgYERpc3Bvc2FibGVTdG9yZWAgd2hlbmV2ZXIgdGhlIHJldHVybmVkXG5cdCAqIGV2ZW50IGlzIGFjY2Vzc2libGUgdG8gXCJ0aGlyZCBwYXJ0aWVzXCIsIGUuZyB0aGUgZXZlbnQgaXMgYSBwdWJsaWMgcHJvcGVydHkuIE90aGVyd2lzZSBhIGxlYWtlZCBsaXN0ZW5lciBvbiB0aGVcblx0ICogcmV0dXJuZWQgZXZlbnQgY2F1c2VzIHRoaXMgdXRpbGl0eSB0byBsZWFrIGEgbGlzdGVuZXIgb24gdGhlIG9yaWdpbmFsIGV2ZW50LlxuXHQgKlxuXHQgKiBAcGFyYW0gZXZlbnQgVGhlIGV2ZW50IHNvdXJjZSBmb3IgdGhlIG5ldyBldmVudC5cblx0ICogQHBhcmFtIG1hcCBUaGUgbWFwcGluZyBmdW5jdGlvbi5cblx0ICogQHBhcmFtIGRpc3Bvc2FibGUgQSBkaXNwb3NhYmxlIHN0b3JlIHRvIGFkZCB0aGUgbmV3IEV2ZW50RW1pdHRlciB0by5cblx0ICovXG5cdGV4cG9ydCBmdW5jdGlvbiBtYXA8SSwgTz4oZXZlbnQ6IEV2ZW50PEk+LCBtYXA6IChpOiBJKSA9PiBPLCBkaXNwb3NhYmxlPzogRGlzcG9zYWJsZVN0b3JlKTogRXZlbnQ8Tz4ge1xuXHRcdHJldHVybiBzbmFwc2hvdCgobGlzdGVuZXIsIHRoaXNBcmdzID0gbnVsbCwgZGlzcG9zYWJsZXM/KSA9PiBldmVudChpID0+IGxpc3RlbmVyLmNhbGwodGhpc0FyZ3MsIG1hcChpKSksIG51bGwsIGRpc3Bvc2FibGVzKSwgZGlzcG9zYWJsZSk7XG5cdH1cblxuXHQvKipcblx0ICogV3JhcHMgYW4gZXZlbnQgaW4gYW5vdGhlciBldmVudCB0aGF0IHBlcmZvcm1zIHNvbWUgZnVuY3Rpb24gb24gdGhlIGV2ZW50IG9iamVjdCBiZWZvcmUgZmlyaW5nLlxuXHQgKlxuXHQgKiAqTk9URSogdGhhdCB0aGlzIGZ1bmN0aW9uIHJldHVybnMgYW4gYEV2ZW50YCBhbmQgaXQgTVVTVCBiZSBjYWxsZWQgd2l0aCBhIGBEaXNwb3NhYmxlU3RvcmVgIHdoZW5ldmVyIHRoZSByZXR1cm5lZFxuXHQgKiBldmVudCBpcyBhY2Nlc3NpYmxlIHRvIFwidGhpcmQgcGFydGllc1wiLCBlLmcgdGhlIGV2ZW50IGlzIGEgcHVibGljIHByb3BlcnR5LiBPdGhlcndpc2UgYSBsZWFrZWQgbGlzdGVuZXIgb24gdGhlXG5cdCAqIHJldHVybmVkIGV2ZW50IGNhdXNlcyB0aGlzIHV0aWxpdHkgdG8gbGVhayBhIGxpc3RlbmVyIG9uIHRoZSBvcmlnaW5hbCBldmVudC5cblx0ICpcblx0ICogQHBhcmFtIGV2ZW50IFRoZSBldmVudCBzb3VyY2UgZm9yIHRoZSBuZXcgZXZlbnQuXG5cdCAqIEBwYXJhbSBlYWNoIFRoZSBmdW5jdGlvbiB0byBwZXJmb3JtIG9uIHRoZSBldmVudCBvYmplY3QuXG5cdCAqIEBwYXJhbSBkaXNwb3NhYmxlIEEgZGlzcG9zYWJsZSBzdG9yZSB0byBhZGQgdGhlIG5ldyBFdmVudEVtaXR0ZXIgdG8uXG5cdCAqL1xuXHRleHBvcnQgZnVuY3Rpb24gZm9yRWFjaDxJPihldmVudDogRXZlbnQ8ST4sIGVhY2g6IChpOiBJKSA9PiB2b2lkLCBkaXNwb3NhYmxlPzogRGlzcG9zYWJsZVN0b3JlKTogRXZlbnQ8ST4ge1xuXHRcdHJldHVybiBzbmFwc2hvdCgobGlzdGVuZXIsIHRoaXNBcmdzID0gbnVsbCwgZGlzcG9zYWJsZXM/KSA9PiBldmVudChpID0+IHsgZWFjaChpKTsgbGlzdGVuZXIuY2FsbCh0aGlzQXJncywgaSk7IH0sIG51bGwsIGRpc3Bvc2FibGVzKSwgZGlzcG9zYWJsZSk7XG5cdH1cblxuXHQvKipcblx0ICogV3JhcHMgYW4gZXZlbnQgaW4gYW5vdGhlciBldmVudCB0aGF0IGZpcmVzIG9ubHkgd2hlbiBzb21lIGNvbmRpdGlvbiBpcyBtZXQuXG5cdCAqXG5cdCAqICpOT1RFKiB0aGF0IHRoaXMgZnVuY3Rpb24gcmV0dXJucyBhbiBgRXZlbnRgIGFuZCBpdCBNVVNUIGJlIGNhbGxlZCB3aXRoIGEgYERpc3Bvc2FibGVTdG9yZWAgd2hlbmV2ZXIgdGhlIHJldHVybmVkXG5cdCAqIGV2ZW50IGlzIGFjY2Vzc2libGUgdG8gXCJ0aGlyZCBwYXJ0aWVzXCIsIGUuZyB0aGUgZXZlbnQgaXMgYSBwdWJsaWMgcHJvcGVydHkuIE90aGVyd2lzZSBhIGxlYWtlZCBsaXN0ZW5lciBvbiB0aGVcblx0ICogcmV0dXJuZWQgZXZlbnQgY2F1c2VzIHRoaXMgdXRpbGl0eSB0byBsZWFrIGEgbGlzdGVuZXIgb24gdGhlIG9yaWdpbmFsIGV2ZW50LlxuXHQgKlxuXHQgKiBAcGFyYW0gZXZlbnQgVGhlIGV2ZW50IHNvdXJjZSBmb3IgdGhlIG5ldyBldmVudC5cblx0ICogQHBhcmFtIGZpbHRlciBUaGUgZmlsdGVyIGZ1bmN0aW9uIHRoYXQgZGVmaW5lcyB0aGUgY29uZGl0aW9uLiBUaGUgZXZlbnQgd2lsbCBmaXJlIGZvciB0aGUgb2JqZWN0IGlmIHRoaXMgZnVuY3Rpb25cblx0ICogcmV0dXJucyB0cnVlLlxuXHQgKiBAcGFyYW0gZGlzcG9zYWJsZSBBIGRpc3Bvc2FibGUgc3RvcmUgdG8gYWRkIHRoZSBuZXcgRXZlbnRFbWl0dGVyIHRvLlxuXHQgKi9cblx0ZXhwb3J0IGZ1bmN0aW9uIGZpbHRlcjxULCBVPihldmVudDogRXZlbnQ8VCB8IFU+LCBmaWx0ZXI6IChlOiBUIHwgVSkgPT4gZSBpcyBULCBkaXNwb3NhYmxlPzogRGlzcG9zYWJsZVN0b3JlKTogRXZlbnQ8VD47XG5cdGV4cG9ydCBmdW5jdGlvbiBmaWx0ZXI8VD4oZXZlbnQ6IEV2ZW50PFQ+LCBmaWx0ZXI6IChlOiBUKSA9PiBib29sZWFuLCBkaXNwb3NhYmxlPzogRGlzcG9zYWJsZVN0b3JlKTogRXZlbnQ8VD47XG5cdGV4cG9ydCBmdW5jdGlvbiBmaWx0ZXI8VCwgUj4oZXZlbnQ6IEV2ZW50PFQgfCBSPiwgZmlsdGVyOiAoZTogVCB8IFIpID0+IGUgaXMgUiwgZGlzcG9zYWJsZT86IERpc3Bvc2FibGVTdG9yZSk6IEV2ZW50PFI+O1xuXHRleHBvcnQgZnVuY3Rpb24gZmlsdGVyPFQ+KGV2ZW50OiBFdmVudDxUPiwgZmlsdGVyOiAoZTogVCkgPT4gYm9vbGVhbiwgZGlzcG9zYWJsZT86IERpc3Bvc2FibGVTdG9yZSk6IEV2ZW50PFQ+IHtcblx0XHRyZXR1cm4gc25hcHNob3QoKGxpc3RlbmVyLCB0aGlzQXJncyA9IG51bGwsIGRpc3Bvc2FibGVzPykgPT4gZXZlbnQoZSA9PiBmaWx0ZXIoZSkgJiYgbGlzdGVuZXIuY2FsbCh0aGlzQXJncywgZSksIG51bGwsIGRpc3Bvc2FibGVzKSwgZGlzcG9zYWJsZSk7XG5cdH1cblxuXHQvKipcblx0ICogR2l2ZW4gYW4gZXZlbnQsIHJldHVybnMgdGhlIHNhbWUgZXZlbnQgYnV0IHR5cGVkIGFzIGBFdmVudDx2b2lkPmAuXG5cdCAqL1xuXHRleHBvcnQgZnVuY3Rpb24gc2lnbmFsPFQ+KGV2ZW50OiBFdmVudDxUPik6IEV2ZW50PHZvaWQ+IHtcblx0XHRyZXR1cm4gZXZlbnQgYXMgRXZlbnQ8YW55PiBhcyBFdmVudDx2b2lkPjtcblx0fVxuXG5cdC8qKlxuXHQgKiBHaXZlbiBhIGNvbGxlY3Rpb24gb2YgZXZlbnRzLCByZXR1cm5zIGEgc2luZ2xlIGV2ZW50IHdoaWNoIGVtaXRzIHdoZW5ldmVyIGFueSBvZiB0aGUgcHJvdmlkZWQgZXZlbnRzIGVtaXQuXG5cdCAqL1xuXHRleHBvcnQgZnVuY3Rpb24gYW55PFQ+KC4uLmV2ZW50czogRXZlbnQ8VD5bXSk6IEV2ZW50PFQ+O1xuXHRleHBvcnQgZnVuY3Rpb24gYW55KC4uLmV2ZW50czogRXZlbnQ8YW55PltdKTogRXZlbnQ8dm9pZD47XG5cdGV4cG9ydCBmdW5jdGlvbiBhbnk8VD4oLi4uZXZlbnRzOiBFdmVudDxUPltdKTogRXZlbnQ8VD4ge1xuXHRcdHJldHVybiAobGlzdGVuZXIsIHRoaXNBcmdzID0gbnVsbCwgZGlzcG9zYWJsZXM/KSA9PiB7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlID0gY29tYmluZWREaXNwb3NhYmxlKC4uLmV2ZW50cy5tYXAoZXZlbnQgPT4gZXZlbnQoZSA9PiBsaXN0ZW5lci5jYWxsKHRoaXNBcmdzLCBlKSkpKTtcblx0XHRcdHJldHVybiBhZGRBbmRSZXR1cm5EaXNwb3NhYmxlKGRpc3Bvc2FibGUsIGRpc3Bvc2FibGVzKTtcblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqICpOT1RFKiB0aGF0IHRoaXMgZnVuY3Rpb24gcmV0dXJucyBhbiBgRXZlbnRgIGFuZCBpdCBNVVNUIGJlIGNhbGxlZCB3aXRoIGEgYERpc3Bvc2FibGVTdG9yZWAgd2hlbmV2ZXIgdGhlIHJldHVybmVkXG5cdCAqIGV2ZW50IGlzIGFjY2Vzc2libGUgdG8gXCJ0aGlyZCBwYXJ0aWVzXCIsIGUuZyB0aGUgZXZlbnQgaXMgYSBwdWJsaWMgcHJvcGVydHkuIE90aGVyd2lzZSBhIGxlYWtlZCBsaXN0ZW5lciBvbiB0aGVcblx0ICogcmV0dXJuZWQgZXZlbnQgY2F1c2VzIHRoaXMgdXRpbGl0eSB0byBsZWFrIGEgbGlzdGVuZXIgb24gdGhlIG9yaWdpbmFsIGV2ZW50LlxuXHQgKi9cblx0ZXhwb3J0IGZ1bmN0aW9uIHJlZHVjZTxJLCBPPihldmVudDogRXZlbnQ8ST4sIG1lcmdlOiAobGFzdDogTyB8IHVuZGVmaW5lZCwgZXZlbnQ6IEkpID0+IE8sIGluaXRpYWw/OiBPLCBkaXNwb3NhYmxlPzogRGlzcG9zYWJsZVN0b3JlKTogRXZlbnQ8Tz4ge1xuXHRcdGxldCBvdXRwdXQ6IE8gfCB1bmRlZmluZWQgPSBpbml0aWFsO1xuXG5cdFx0cmV0dXJuIG1hcDxJLCBPPihldmVudCwgZSA9PiB7XG5cdFx0XHRvdXRwdXQgPSBtZXJnZShvdXRwdXQsIGUpO1xuXHRcdFx0cmV0dXJuIG91dHB1dDtcblx0XHR9LCBkaXNwb3NhYmxlKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHNuYXBzaG90PFQ+KGV2ZW50OiBFdmVudDxUPiwgZGlzcG9zYWJsZTogRGlzcG9zYWJsZVN0b3JlIHwgdW5kZWZpbmVkKTogRXZlbnQ8VD4ge1xuXHRcdGxldCBsaXN0ZW5lcjogSURpc3Bvc2FibGUgfCB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBvcHRpb25zOiBFbWl0dGVyT3B0aW9ucyB8IHVuZGVmaW5lZCA9IHtcblx0XHRcdG9uV2lsbEFkZEZpcnN0TGlzdGVuZXIoKSB7XG5cdFx0XHRcdGxpc3RlbmVyID0gZXZlbnQoZW1pdHRlci5maXJlLCBlbWl0dGVyKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZFJlbW92ZUxhc3RMaXN0ZW5lcigpIHtcblx0XHRcdFx0bGlzdGVuZXI/LmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0aWYgKCFkaXNwb3NhYmxlKSB7XG5cdFx0XHRfYWRkTGVha2FnZVRyYWNlTG9naWMob3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZW1pdHRlciA9IG5ldyBFbWl0dGVyPFQ+KG9wdGlvbnMpO1xuXG5cdFx0ZGlzcG9zYWJsZT8uYWRkKGVtaXR0ZXIpO1xuXG5cdFx0cmV0dXJuIGVtaXR0ZXIuZXZlbnQ7XG5cdH1cblxuXHQvKipcblx0ICogQWRkcyB0aGUgSURpc3Bvc2FibGUgdG8gdGhlIHN0b3JlIGlmIGl0J3Mgc2V0LCBhbmQgcmV0dXJucyBpdC4gVXNlZnVsIHRvXG5cdCAqIEV2ZW50IGZ1bmN0aW9uIGltcGxlbWVudGF0aW9uLlxuXHQgKi9cblx0ZnVuY3Rpb24gYWRkQW5kUmV0dXJuRGlzcG9zYWJsZTxUIGV4dGVuZHMgSURpc3Bvc2FibGU+KGQ6IFQsIHN0b3JlOiBEaXNwb3NhYmxlU3RvcmUgfCBJRGlzcG9zYWJsZVtdIHwgdW5kZWZpbmVkKTogVCB7XG5cdFx0aWYgKHN0b3JlIGluc3RhbmNlb2YgQXJyYXkpIHtcblx0XHRcdHN0b3JlLnB1c2goZCk7XG5cdFx0fSBlbHNlIGlmIChzdG9yZSkge1xuXHRcdFx0c3RvcmUuYWRkKGQpO1xuXHRcdH1cblx0XHRyZXR1cm4gZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBHaXZlbiBhbiBldmVudCwgY3JlYXRlcyBhIG5ldyBlbWl0dGVyIHRoYXQgZXZlbnQgdGhhdCB3aWxsIGRlYm91bmNlIGV2ZW50cyBiYXNlZCBvbiB7QGxpbmsgZGVsYXl9IGFuZCBnaXZlIGFuXG5cdCAqIGFycmF5IGV2ZW50IG9iamVjdCBvZiBhbGwgZXZlbnRzIHRoYXQgZmlyZWQuXG5cdCAqXG5cdCAqICpOT1RFKiB0aGF0IHRoaXMgZnVuY3Rpb24gcmV0dXJucyBhbiBgRXZlbnRgIGFuZCBpdCBNVVNUIGJlIGNhbGxlZCB3aXRoIGEgYERpc3Bvc2FibGVTdG9yZWAgd2hlbmV2ZXIgdGhlIHJldHVybmVkXG5cdCAqIGV2ZW50IGlzIGFjY2Vzc2libGUgdG8gXCJ0aGlyZCBwYXJ0aWVzXCIsIGUuZyB0aGUgZXZlbnQgaXMgYSBwdWJsaWMgcHJvcGVydHkuIE90aGVyd2lzZSBhIGxlYWtlZCBsaXN0ZW5lciBvbiB0aGVcblx0ICogcmV0dXJuZWQgZXZlbnQgY2F1c2VzIHRoaXMgdXRpbGl0eSB0byBsZWFrIGEgbGlzdGVuZXIgb24gdGhlIG9yaWdpbmFsIGV2ZW50LlxuXHQgKlxuXHQgKiBAcGFyYW0gZXZlbnQgVGhlIG9yaWdpbmFsIGV2ZW50IHRvIGRlYm91bmNlLlxuXHQgKiBAcGFyYW0gbWVyZ2UgQSBmdW5jdGlvbiB0aGF0IHJlZHVjZXMgYWxsIGV2ZW50cyBpbnRvIGEgc2luZ2xlIGV2ZW50LlxuXHQgKiBAcGFyYW0gZGVsYXkgVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgdG8gZGVib3VuY2UuXG5cdCAqIEBwYXJhbSBsZWFkaW5nIFdoZXRoZXIgdG8gZmlyZSBhIGxlYWRpbmcgZXZlbnQgd2l0aG91dCBkZWJvdW5jaW5nLlxuXHQgKiBAcGFyYW0gZmx1c2hPbkxpc3RlbmVyUmVtb3ZlIFdoZXRoZXIgdG8gZmlyZSBhbGwgZGVib3VuY2VkIGV2ZW50cyB3aGVuIGEgbGlzdGVuZXIgaXMgcmVtb3ZlZC4gSWYgdGhpcyBpcyBub3Rcblx0ICogc3BlY2lmaWVkLCBzb21lIGV2ZW50cyBjb3VsZCBnbyBtaXNzaW5nLiBVc2UgdGhpcyBpZiBpdCdzIGltcG9ydGFudCB0aGF0IGFsbCBldmVudHMgYXJlIHByb2Nlc3NlZCwgZXZlbiBpZiB0aGVcblx0ICogbGlzdGVuZXIgZ2V0cyBkaXNwb3NlZCBiZWZvcmUgdGhlIGRlYm91bmNlZCBldmVudCBmaXJlcy5cblx0ICogQHBhcmFtIGxlYWtXYXJuaW5nVGhyZXNob2xkIFNlZSB7QGxpbmsgRW1pdHRlck9wdGlvbnMubGVha1dhcm5pbmdUaHJlc2hvbGR9LlxuXHQgKiBAcGFyYW0gZGlzcG9zYWJsZSBBIGRpc3Bvc2FibGUgc3RvcmUgdG8gcmVnaXN0ZXIgdGhlIGRlYm91bmNlIGVtaXR0ZXIgdG8uXG5cdCAqL1xuXHRleHBvcnQgZnVuY3Rpb24gZGVib3VuY2U8VD4oZXZlbnQ6IEV2ZW50PFQ+LCBtZXJnZTogKGxhc3Q6IFQgfCB1bmRlZmluZWQsIGV2ZW50OiBUKSA9PiBULCBkZWxheT86IG51bWJlciB8IHR5cGVvZiBNaWNyb3Rhc2tEZWxheSwgbGVhZGluZz86IGJvb2xlYW4sIGZsdXNoT25MaXN0ZW5lclJlbW92ZT86IGJvb2xlYW4sIGxlYWtXYXJuaW5nVGhyZXNob2xkPzogbnVtYmVyLCBkaXNwb3NhYmxlPzogRGlzcG9zYWJsZVN0b3JlKTogRXZlbnQ8VD47XG5cdGV4cG9ydCBmdW5jdGlvbiBkZWJvdW5jZTxJLCBPPihldmVudDogRXZlbnQ8ST4sIG1lcmdlOiAobGFzdDogTyB8IHVuZGVmaW5lZCwgZXZlbnQ6IEkpID0+IE8sIGRlbGF5PzogbnVtYmVyIHwgdHlwZW9mIE1pY3JvdGFza0RlbGF5LCBsZWFkaW5nPzogYm9vbGVhbiwgZmx1c2hPbkxpc3RlbmVyUmVtb3ZlPzogYm9vbGVhbiwgbGVha1dhcm5pbmdUaHJlc2hvbGQ/OiBudW1iZXIsIGRpc3Bvc2FibGU/OiBEaXNwb3NhYmxlU3RvcmUpOiBFdmVudDxPPjtcblx0ZXhwb3J0IGZ1bmN0aW9uIGRlYm91bmNlPEksIE8+KGV2ZW50OiBFdmVudDxJPiwgbWVyZ2U6IChsYXN0OiBPIHwgdW5kZWZpbmVkLCBldmVudDogSSkgPT4gTywgZGVsYXk6IG51bWJlciB8IHR5cGVvZiBNaWNyb3Rhc2tEZWxheSA9IDEwMCwgbGVhZGluZyA9IGZhbHNlLCBmbHVzaE9uTGlzdGVuZXJSZW1vdmUgPSBmYWxzZSwgbGVha1dhcm5pbmdUaHJlc2hvbGQ/OiBudW1iZXIsIGRpc3Bvc2FibGU/OiBEaXNwb3NhYmxlU3RvcmUpOiBFdmVudDxPPiB7XG5cdFx0bGV0IHN1YnNjcmlwdGlvbjogSURpc3Bvc2FibGU7XG5cdFx0bGV0IG91dHB1dDogTyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRsZXQgaGFuZGxlOiBhbnkgPSB1bmRlZmluZWQ7XG5cdFx0bGV0IG51bURlYm91bmNlZENhbGxzID0gMDtcblx0XHRsZXQgZG9GaXJlOiAoKCkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBvcHRpb25zOiBFbWl0dGVyT3B0aW9ucyB8IHVuZGVmaW5lZCA9IHtcblx0XHRcdGxlYWtXYXJuaW5nVGhyZXNob2xkLFxuXHRcdFx0b25XaWxsQWRkRmlyc3RMaXN0ZW5lcigpIHtcblx0XHRcdFx0c3Vic2NyaXB0aW9uID0gZXZlbnQoY3VyID0+IHtcblx0XHRcdFx0XHRudW1EZWJvdW5jZWRDYWxscysrO1xuXHRcdFx0XHRcdG91dHB1dCA9IG1lcmdlKG91dHB1dCwgY3VyKTtcblxuXHRcdFx0XHRcdGlmIChsZWFkaW5nICYmICFoYW5kbGUpIHtcblx0XHRcdFx0XHRcdGVtaXR0ZXIuZmlyZShvdXRwdXQpO1xuXHRcdFx0XHRcdFx0b3V0cHV0ID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGRvRmlyZSA9ICgpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IF9vdXRwdXQgPSBvdXRwdXQ7XG5cdFx0XHRcdFx0XHRvdXRwdXQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRoYW5kbGUgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRpZiAoIWxlYWRpbmcgfHwgbnVtRGVib3VuY2VkQ2FsbHMgPiAxKSB7XG5cdFx0XHRcdFx0XHRcdGVtaXR0ZXIuZmlyZShfb3V0cHV0ISk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRudW1EZWJvdW5jZWRDYWxscyA9IDA7XG5cdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdGlmICh0eXBlb2YgZGVsYXkgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0XHRjbGVhclRpbWVvdXQoaGFuZGxlKTtcblx0XHRcdFx0XHRcdGhhbmRsZSA9IHNldFRpbWVvdXQoZG9GaXJlLCBkZWxheSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGlmIChoYW5kbGUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0XHRoYW5kbGUgPSAwO1xuXHRcdFx0XHRcdFx0XHRxdWV1ZU1pY3JvdGFzayhkb0ZpcmUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9LFxuXHRcdFx0b25XaWxsUmVtb3ZlTGlzdGVuZXIoKSB7XG5cdFx0XHRcdGlmIChmbHVzaE9uTGlzdGVuZXJSZW1vdmUgJiYgbnVtRGVib3VuY2VkQ2FsbHMgPiAwKSB7XG5cdFx0XHRcdFx0ZG9GaXJlPy4oKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdG9uRGlkUmVtb3ZlTGFzdExpc3RlbmVyKCkge1xuXHRcdFx0XHRkb0ZpcmUgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHN1YnNjcmlwdGlvbi5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGlmICghZGlzcG9zYWJsZSkge1xuXHRcdFx0X2FkZExlYWthZ2VUcmFjZUxvZ2ljKG9wdGlvbnMpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVtaXR0ZXIgPSBuZXcgRW1pdHRlcjxPPihvcHRpb25zKTtcblxuXHRcdGRpc3Bvc2FibGU/LmFkZChlbWl0dGVyKTtcblxuXHRcdHJldHVybiBlbWl0dGVyLmV2ZW50O1xuXHR9XG5cblx0LyoqXG5cdCAqIERlYm91bmNlcyBhbiBldmVudCwgZmlyaW5nIGFmdGVyIHNvbWUgZGVsYXkgKGRlZmF1bHQ9MCkgd2l0aCBhbiBhcnJheSBvZiBhbGwgZXZlbnQgb3JpZ2luYWwgb2JqZWN0cy5cblx0ICpcblx0ICogKk5PVEUqIHRoYXQgdGhpcyBmdW5jdGlvbiByZXR1cm5zIGFuIGBFdmVudGAgYW5kIGl0IE1VU1QgYmUgY2FsbGVkIHdpdGggYSBgRGlzcG9zYWJsZVN0b3JlYCB3aGVuZXZlciB0aGUgcmV0dXJuZWRcblx0ICogZXZlbnQgaXMgYWNjZXNzaWJsZSB0byBcInRoaXJkIHBhcnRpZXNcIiwgZS5nIHRoZSBldmVudCBpcyBhIHB1YmxpYyBwcm9wZXJ0eS4gT3RoZXJ3aXNlIGEgbGVha2VkIGxpc3RlbmVyIG9uIHRoZVxuXHQgKiByZXR1cm5lZCBldmVudCBjYXVzZXMgdGhpcyB1dGlsaXR5IHRvIGxlYWsgYSBsaXN0ZW5lciBvbiB0aGUgb3JpZ2luYWwgZXZlbnQuXG5cdCAqL1xuXHRleHBvcnQgZnVuY3Rpb24gYWNjdW11bGF0ZTxUPihldmVudDogRXZlbnQ8VD4sIGRlbGF5OiBudW1iZXIgPSAwLCBkaXNwb3NhYmxlPzogRGlzcG9zYWJsZVN0b3JlKTogRXZlbnQ8VFtdPiB7XG5cdFx0cmV0dXJuIEV2ZW50LmRlYm91bmNlPFQsIFRbXT4oZXZlbnQsIChsYXN0LCBlKSA9PiB7XG5cdFx0XHRpZiAoIWxhc3QpIHtcblx0XHRcdFx0cmV0dXJuIFtlXTtcblx0XHRcdH1cblx0XHRcdGxhc3QucHVzaChlKTtcblx0XHRcdHJldHVybiBsYXN0O1xuXHRcdH0sIGRlbGF5LCB1bmRlZmluZWQsIHRydWUsIHVuZGVmaW5lZCwgZGlzcG9zYWJsZSk7XG5cdH1cblxuXHQvKipcblx0ICogRmlsdGVycyBhbiBldmVudCBzdWNoIHRoYXQgc29tZSBjb25kaXRpb24gaXMgX25vdF8gbWV0IG1vcmUgdGhhbiBvbmNlIGluIGEgcm93LCBlZmZlY3RpdmVseSBlbnN1cmluZyBkdXBsaWNhdGVcblx0ICogZXZlbnQgb2JqZWN0cyBmcm9tIGRpZmZlcmVudCBzb3VyY2VzIGRvIG5vdCBmaXJlIHRoZSBzYW1lIGV2ZW50IG9iamVjdC5cblx0ICpcblx0ICogKk5PVEUqIHRoYXQgdGhpcyBmdW5jdGlvbiByZXR1cm5zIGFuIGBFdmVudGAgYW5kIGl0IE1VU1QgYmUgY2FsbGVkIHdpdGggYSBgRGlzcG9zYWJsZVN0b3JlYCB3aGVuZXZlciB0aGUgcmV0dXJuZWRcblx0ICogZXZlbnQgaXMgYWNjZXNzaWJsZSB0byBcInRoaXJkIHBhcnRpZXNcIiwgZS5nIHRoZSBldmVudCBpcyBhIHB1YmxpYyBwcm9wZXJ0eS4gT3RoZXJ3aXNlIGEgbGVha2VkIGxpc3RlbmVyIG9uIHRoZVxuXHQgKiByZXR1cm5lZCBldmVudCBjYXVzZXMgdGhpcyB1dGlsaXR5IHRvIGxlYWsgYSBsaXN0ZW5lciBvbiB0aGUgb3JpZ2luYWwgZXZlbnQuXG5cdCAqXG5cdCAqIEBwYXJhbSBldmVudCBUaGUgZXZlbnQgc291cmNlIGZvciB0aGUgbmV3IGV2ZW50LlxuXHQgKiBAcGFyYW0gZXF1YWxzIFRoZSBlcXVhbGl0eSBjb25kaXRpb24uXG5cdCAqIEBwYXJhbSBkaXNwb3NhYmxlIEEgZGlzcG9zYWJsZSBzdG9yZSB0byBhZGQgdGhlIG5ldyBFdmVudEVtaXR0ZXIgdG8uXG5cdCAqXG5cdCAqIEBleGFtcGxlXG5cdCAqIGBgYFxuXHQgKiAvLyBGaXJlIG9ubHkgb25lIHRpbWUgd2hlbiBhIHNpbmdsZSB3aW5kb3cgaXMgb3BlbmVkIG9yIGZvY3VzZWRcblx0ICogRXZlbnQubGF0Y2goRXZlbnQuYW55KG9uRGlkT3BlbldpbmRvdywgb25EaWRGb2N1c1dpbmRvdykpXG5cdCAqIGBgYFxuXHQgKi9cblx0ZXhwb3J0IGZ1bmN0aW9uIGxhdGNoPFQ+KGV2ZW50OiBFdmVudDxUPiwgZXF1YWxzOiAoYTogVCwgYjogVCkgPT4gYm9vbGVhbiA9IChhLCBiKSA9PiBhID09PSBiLCBkaXNwb3NhYmxlPzogRGlzcG9zYWJsZVN0b3JlKTogRXZlbnQ8VD4ge1xuXHRcdGxldCBmaXJzdENhbGwgPSB0cnVlO1xuXHRcdGxldCBjYWNoZTogVDtcblxuXHRcdHJldHVybiBmaWx0ZXIoZXZlbnQsIHZhbHVlID0+IHtcblx0XHRcdGNvbnN0IHNob3VsZEVtaXQgPSBmaXJzdENhbGwgfHwgIWVxdWFscyh2YWx1ZSwgY2FjaGUpO1xuXHRcdFx0Zmlyc3RDYWxsID0gZmFsc2U7XG5cdFx0XHRjYWNoZSA9IHZhbHVlO1xuXHRcdFx0cmV0dXJuIHNob3VsZEVtaXQ7XG5cdFx0fSwgZGlzcG9zYWJsZSk7XG5cdH1cblxuXHQvKipcblx0ICogU3BsaXRzIGFuIGV2ZW50IHdob3NlIHBhcmFtZXRlciBpcyBhIHVuaW9uIHR5cGUgaW50byAyIHNlcGFyYXRlIGV2ZW50cyBmb3IgZWFjaCB0eXBlIGluIHRoZSB1bmlvbi5cblx0ICpcblx0ICogKk5PVEUqIHRoYXQgdGhpcyBmdW5jdGlvbiByZXR1cm5zIGFuIGBFdmVudGAgYW5kIGl0IE1VU1QgYmUgY2FsbGVkIHdpdGggYSBgRGlzcG9zYWJsZVN0b3JlYCB3aGVuZXZlciB0aGUgcmV0dXJuZWRcblx0ICogZXZlbnQgaXMgYWNjZXNzaWJsZSB0byBcInRoaXJkIHBhcnRpZXNcIiwgZS5nIHRoZSBldmVudCBpcyBhIHB1YmxpYyBwcm9wZXJ0eS4gT3RoZXJ3aXNlIGEgbGVha2VkIGxpc3RlbmVyIG9uIHRoZVxuXHQgKiByZXR1cm5lZCBldmVudCBjYXVzZXMgdGhpcyB1dGlsaXR5IHRvIGxlYWsgYSBsaXN0ZW5lciBvbiB0aGUgb3JpZ2luYWwgZXZlbnQuXG5cdCAqXG5cdCAqIEBleGFtcGxlXG5cdCAqIGBgYFxuXHQgKiBjb25zdCBldmVudCA9IG5ldyBFdmVudEVtaXR0ZXI8bnVtYmVyIHwgdW5kZWZpbmVkPigpLmV2ZW50O1xuXHQgKiBjb25zdCBbbnVtYmVyRXZlbnQsIHVuZGVmaW5lZEV2ZW50XSA9IEV2ZW50LnNwbGl0KGV2ZW50LCBpc1VuZGVmaW5lZCk7XG5cdCAqIGBgYFxuXHQgKlxuXHQgKiBAcGFyYW0gZXZlbnQgVGhlIGV2ZW50IHNvdXJjZSBmb3IgdGhlIG5ldyBldmVudC5cblx0ICogQHBhcmFtIGlzVCBBIGZ1bmN0aW9uIHRoYXQgZGV0ZXJtaW5lcyB3aGF0IGV2ZW50IGlzIG9mIHRoZSBmaXJzdCB0eXBlLlxuXHQgKiBAcGFyYW0gZGlzcG9zYWJsZSBBIGRpc3Bvc2FibGUgc3RvcmUgdG8gYWRkIHRoZSBuZXcgRXZlbnRFbWl0dGVyIHRvLlxuXHQgKi9cblx0ZXhwb3J0IGZ1bmN0aW9uIHNwbGl0PFQsIFU+KGV2ZW50OiBFdmVudDxUIHwgVT4sIGlzVDogKGU6IFQgfCBVKSA9PiBlIGlzIFQsIGRpc3Bvc2FibGU/OiBEaXNwb3NhYmxlU3RvcmUpOiBbRXZlbnQ8VD4sIEV2ZW50PFU+XSB7XG5cdFx0cmV0dXJuIFtcblx0XHRcdEV2ZW50LmZpbHRlcihldmVudCwgaXNULCBkaXNwb3NhYmxlKSxcblx0XHRcdEV2ZW50LmZpbHRlcihldmVudCwgZSA9PiAhaXNUKGUpLCBkaXNwb3NhYmxlKSBhcyBFdmVudDxVPixcblx0XHRdO1xuXHR9XG5cblx0LyoqXG5cdCAqIEJ1ZmZlcnMgYW4gZXZlbnQgdW50aWwgaXQgaGFzIGEgbGlzdGVuZXIgYXR0YWNoZWQuXG5cdCAqXG5cdCAqICpOT1RFKiB0aGF0IHRoaXMgZnVuY3Rpb24gcmV0dXJucyBhbiBgRXZlbnRgIGFuZCBpdCBNVVNUIGJlIGNhbGxlZCB3aXRoIGEgYERpc3Bvc2FibGVTdG9yZWAgd2hlbmV2ZXIgdGhlIHJldHVybmVkXG5cdCAqIGV2ZW50IGlzIGFjY2Vzc2libGUgdG8gXCJ0aGlyZCBwYXJ0aWVzXCIsIGUuZyB0aGUgZXZlbnQgaXMgYSBwdWJsaWMgcHJvcGVydHkuIE90aGVyd2lzZSBhIGxlYWtlZCBsaXN0ZW5lciBvbiB0aGVcblx0ICogcmV0dXJuZWQgZXZlbnQgY2F1c2VzIHRoaXMgdXRpbGl0eSB0byBsZWFrIGEgbGlzdGVuZXIgb24gdGhlIG9yaWdpbmFsIGV2ZW50LlxuXHQgKlxuXHQgKiBAcGFyYW0gZXZlbnQgVGhlIGV2ZW50IHNvdXJjZSBmb3IgdGhlIG5ldyBldmVudC5cblx0ICogQHBhcmFtIGZsdXNoQWZ0ZXJUaW1lb3V0IERldGVybWluZXMgd2hldGhlciB0byBmbHVzaCB0aGUgYnVmZmVyIGFmdGVyIGEgdGltZW91dCBpbW1lZGlhdGVseSBvciBhZnRlciBhXG5cdCAqIGBzZXRUaW1lb3V0YCB3aGVuIHRoZSBmaXJzdCBldmVudCBsaXN0ZW5lciBpcyBhZGRlZC5cblx0ICogQHBhcmFtIF9idWZmZXIgSW50ZXJuYWw6IEEgc291cmNlIGV2ZW50IGFycmF5IHVzZWQgZm9yIHRlc3RzLlxuXHQgKlxuXHQgKiBAZXhhbXBsZVxuXHQgKiBgYGBcblx0ICogLy8gU3RhcnQgYWNjdW11bGF0aW5nIGV2ZW50cywgd2hlbiB0aGUgZmlyc3QgbGlzdGVuZXIgaXMgYXR0YWNoZWQsIGZsdXNoXG5cdCAqIC8vIHRoZSBldmVudCBhZnRlciBhIHRpbWVvdXQgc3VjaCB0aGF0IG11bHRpcGxlIGxpc3RlbmVycyBhdHRhY2hlZCBiZWZvcmVcblx0ICogLy8gdGhlIHRpbWVvdXQgd291bGQgcmVjZWl2ZSB0aGUgZXZlbnRcblx0ICogdGhpcy5vbkluc3RhbGxFeHRlbnNpb24gPSBFdmVudC5idWZmZXIoc2VydmljZS5vbkluc3RhbGxFeHRlbnNpb24sIHRydWUpO1xuXHQgKiBgYGBcblx0ICovXG5cdGV4cG9ydCBmdW5jdGlvbiBidWZmZXI8VD4oZXZlbnQ6IEV2ZW50PFQ+LCBmbHVzaEFmdGVyVGltZW91dCA9IGZhbHNlLCBfYnVmZmVyOiBUW10gPSBbXSwgZGlzcG9zYWJsZT86IERpc3Bvc2FibGVTdG9yZSk6IEV2ZW50PFQ+IHtcblx0XHRsZXQgYnVmZmVyOiBUW10gfCBudWxsID0gX2J1ZmZlci5zbGljZSgpO1xuXG5cdFx0bGV0IGxpc3RlbmVyOiBJRGlzcG9zYWJsZSB8IG51bGwgPSBldmVudChlID0+IHtcblx0XHRcdGlmIChidWZmZXIpIHtcblx0XHRcdFx0YnVmZmVyLnB1c2goZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRlbWl0dGVyLmZpcmUoZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRpZiAoZGlzcG9zYWJsZSkge1xuXHRcdFx0ZGlzcG9zYWJsZS5hZGQobGlzdGVuZXIpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZsdXNoID0gKCkgPT4ge1xuXHRcdFx0YnVmZmVyPy5mb3JFYWNoKGUgPT4gZW1pdHRlci5maXJlKGUpKTtcblx0XHRcdGJ1ZmZlciA9IG51bGw7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGVtaXR0ZXIgPSBuZXcgRW1pdHRlcjxUPih7XG5cdFx0XHRvbldpbGxBZGRGaXJzdExpc3RlbmVyKCkge1xuXHRcdFx0XHRpZiAoIWxpc3RlbmVyKSB7XG5cdFx0XHRcdFx0bGlzdGVuZXIgPSBldmVudChlID0+IGVtaXR0ZXIuZmlyZShlKSk7XG5cdFx0XHRcdFx0aWYgKGRpc3Bvc2FibGUpIHtcblx0XHRcdFx0XHRcdGRpc3Bvc2FibGUuYWRkKGxpc3RlbmVyKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cblx0XHRcdG9uRGlkQWRkRmlyc3RMaXN0ZW5lcigpIHtcblx0XHRcdFx0aWYgKGJ1ZmZlcikge1xuXHRcdFx0XHRcdGlmIChmbHVzaEFmdGVyVGltZW91dCkge1xuXHRcdFx0XHRcdFx0c2V0VGltZW91dChmbHVzaCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGZsdXNoKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHRvbkRpZFJlbW92ZUxhc3RMaXN0ZW5lcigpIHtcblx0XHRcdFx0aWYgKGxpc3RlbmVyKSB7XG5cdFx0XHRcdFx0bGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxpc3RlbmVyID0gbnVsbDtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGlmIChkaXNwb3NhYmxlKSB7XG5cdFx0XHRkaXNwb3NhYmxlLmFkZChlbWl0dGVyKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZW1pdHRlci5ldmVudDtcblx0fVxuXHQvKipcblx0ICogV3JhcHMgdGhlIGV2ZW50IGluIGFuIHtAbGluayBJQ2hhaW5hYmxlRXZlbnR9LCBhbGxvd2luZyBhIG1vcmUgZnVuY3Rpb25hbCBwcm9ncmFtbWluZyBzdHlsZS5cblx0ICpcblx0ICogQGV4YW1wbGVcblx0ICogYGBgXG5cdCAqIC8vIE5vcm1hbFxuXHQgKiBjb25zdCBvbkVudGVyUHJlc3NOb3JtYWwgPSBFdmVudC5maWx0ZXIoXG5cdCAqICAgRXZlbnQubWFwKG9uS2V5UHJlc3MuZXZlbnQsIGUgPT4gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKSksXG5cdCAqICAgZS5rZXlDb2RlID09PSBLZXlDb2RlLkVudGVyXG5cdCAqICkuZXZlbnQ7XG5cdCAqXG5cdCAqIC8vIFVzaW5nIGNoYWluXG5cdCAqIGNvbnN0IG9uRW50ZXJQcmVzc0NoYWluID0gRXZlbnQuY2hhaW4ob25LZXlQcmVzcy5ldmVudCwgJCA9PiAkXG5cdCAqICAgLm1hcChlID0+IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSkpXG5cdCAqICAgLmZpbHRlcihlID0+IGUua2V5Q29kZSA9PT0gS2V5Q29kZS5FbnRlcilcblx0ICogKTtcblx0ICogYGBgXG5cdCAqL1xuXHRleHBvcnQgZnVuY3Rpb24gY2hhaW48VCwgUj4oZXZlbnQ6IEV2ZW50PFQ+LCBzeXRoZW5zaXplOiAoJDogSUNoYWluYWJsZVN5dGhlbnNpczxUPikgPT4gSUNoYWluYWJsZVN5dGhlbnNpczxSPik6IEV2ZW50PFI+IHtcblx0XHRjb25zdCBmbjogRXZlbnQ8Uj4gPSAobGlzdGVuZXIsIHRoaXNBcmdzLCBkaXNwb3NhYmxlcykgPT4ge1xuXHRcdFx0Y29uc3QgY3MgPSBzeXRoZW5zaXplKG5ldyBDaGFpbmFibGVTeW50aGVzaXMoKSkgYXMgQ2hhaW5hYmxlU3ludGhlc2lzO1xuXHRcdFx0cmV0dXJuIGV2ZW50KGZ1bmN0aW9uICh2YWx1ZSkge1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBjcy5ldmFsdWF0ZSh2YWx1ZSk7XG5cdFx0XHRcdGlmIChyZXN1bHQgIT09IEhhbHRDaGFpbmFibGUpIHtcblx0XHRcdFx0XHRsaXN0ZW5lci5jYWxsKHRoaXNBcmdzLCByZXN1bHQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCB1bmRlZmluZWQsIGRpc3Bvc2FibGVzKTtcblx0XHR9O1xuXG5cdFx0cmV0dXJuIGZuO1xuXHR9XG5cblx0Y29uc3QgSGFsdENoYWluYWJsZSA9IFN5bWJvbCgnSGFsdENoYWluYWJsZScpO1xuXG5cdGNsYXNzIENoYWluYWJsZVN5bnRoZXNpcyBpbXBsZW1lbnRzIElDaGFpbmFibGVTeXRoZW5zaXM8YW55PiB7XG5cdFx0cHJpdmF0ZSByZWFkb25seSBzdGVwczogKChpbnB1dDogYW55KSA9PiB1bmtub3duKVtdID0gW107XG5cblx0XHRtYXA8Tz4oZm46IChpOiBhbnkpID0+IE8pOiB0aGlzIHtcblx0XHRcdHRoaXMuc3RlcHMucHVzaChmbik7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cblx0XHRmb3JFYWNoKGZuOiAoaTogYW55KSA9PiB2b2lkKTogdGhpcyB7XG5cdFx0XHR0aGlzLnN0ZXBzLnB1c2godiA9PiB7XG5cdFx0XHRcdGZuKHYpO1xuXHRcdFx0XHRyZXR1cm4gdjtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXG5cdFx0ZmlsdGVyKGZuOiAoZTogYW55KSA9PiBib29sZWFuKTogdGhpcyB7XG5cdFx0XHR0aGlzLnN0ZXBzLnB1c2godiA9PiBmbih2KSA/IHYgOiBIYWx0Q2hhaW5hYmxlKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblxuXHRcdHJlZHVjZTxSPihtZXJnZTogKGxhc3Q6IFIgfCB1bmRlZmluZWQsIGV2ZW50OiBhbnkpID0+IFIsIGluaXRpYWw/OiBSIHwgdW5kZWZpbmVkKTogdGhpcyB7XG5cdFx0XHRsZXQgbGFzdCA9IGluaXRpYWw7XG5cdFx0XHR0aGlzLnN0ZXBzLnB1c2godiA9PiB7XG5cdFx0XHRcdGxhc3QgPSBtZXJnZShsYXN0LCB2KTtcblx0XHRcdFx0cmV0dXJuIGxhc3Q7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblxuXHRcdGxhdGNoKGVxdWFsczogKGE6IGFueSwgYjogYW55KSA9PiBib29sZWFuID0gKGEsIGIpID0+IGEgPT09IGIpOiBDaGFpbmFibGVTeW50aGVzaXMge1xuXHRcdFx0bGV0IGZpcnN0Q2FsbCA9IHRydWU7XG5cdFx0XHRsZXQgY2FjaGU6IGFueTtcblx0XHRcdHRoaXMuc3RlcHMucHVzaCh2YWx1ZSA9PiB7XG5cdFx0XHRcdGNvbnN0IHNob3VsZEVtaXQgPSBmaXJzdENhbGwgfHwgIWVxdWFscyh2YWx1ZSwgY2FjaGUpO1xuXHRcdFx0XHRmaXJzdENhbGwgPSBmYWxzZTtcblx0XHRcdFx0Y2FjaGUgPSB2YWx1ZTtcblx0XHRcdFx0cmV0dXJuIHNob3VsZEVtaXQgPyB2YWx1ZSA6IEhhbHRDaGFpbmFibGU7XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXG5cdFx0cHVibGljIGV2YWx1YXRlKHZhbHVlOiBhbnkpIHtcblx0XHRcdGZvciAoY29uc3Qgc3RlcCBvZiB0aGlzLnN0ZXBzKSB7XG5cdFx0XHRcdHZhbHVlID0gc3RlcCh2YWx1ZSk7XG5cdFx0XHRcdGlmICh2YWx1ZSA9PT0gSGFsdENoYWluYWJsZSkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9XG5cdH1cblxuXHRleHBvcnQgaW50ZXJmYWNlIElDaGFpbmFibGVTeXRoZW5zaXM8VD4ge1xuXHRcdG1hcDxPPihmbjogKGk6IFQpID0+IE8pOiBJQ2hhaW5hYmxlU3l0aGVuc2lzPE8+O1xuXHRcdGZvckVhY2goZm46IChpOiBUKSA9PiB2b2lkKTogSUNoYWluYWJsZVN5dGhlbnNpczxUPjtcblx0XHRmaWx0ZXI8UiBleHRlbmRzIFQ+KGZuOiAoZTogVCkgPT4gZSBpcyBSKTogSUNoYWluYWJsZVN5dGhlbnNpczxSPjtcblx0XHRmaWx0ZXIoZm46IChlOiBUKSA9PiBib29sZWFuKTogSUNoYWluYWJsZVN5dGhlbnNpczxUPjtcblx0XHRyZWR1Y2U8Uj4obWVyZ2U6IChsYXN0OiBSLCBldmVudDogVCkgPT4gUiwgaW5pdGlhbDogUik6IElDaGFpbmFibGVTeXRoZW5zaXM8Uj47XG5cdFx0cmVkdWNlPFI+KG1lcmdlOiAobGFzdDogUiB8IHVuZGVmaW5lZCwgZXZlbnQ6IFQpID0+IFIpOiBJQ2hhaW5hYmxlU3l0aGVuc2lzPFI+O1xuXHRcdGxhdGNoKGVxdWFscz86IChhOiBULCBiOiBUKSA9PiBib29sZWFuKTogSUNoYWluYWJsZVN5dGhlbnNpczxUPjtcblx0fVxuXG5cdGV4cG9ydCBpbnRlcmZhY2UgTm9kZUV2ZW50RW1pdHRlciB7XG5cdFx0b24oZXZlbnQ6IHN0cmluZyB8IHN5bWJvbCwgbGlzdGVuZXI6IEZ1bmN0aW9uKTogdW5rbm93bjtcblx0XHRyZW1vdmVMaXN0ZW5lcihldmVudDogc3RyaW5nIHwgc3ltYm9sLCBsaXN0ZW5lcjogRnVuY3Rpb24pOiB1bmtub3duO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYW4ge0BsaW5rIEV2ZW50fSBmcm9tIGEgbm9kZSBldmVudCBlbWl0dGVyLlxuXHQgKi9cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb21Ob2RlRXZlbnRFbWl0dGVyPFQ+KGVtaXR0ZXI6IE5vZGVFdmVudEVtaXR0ZXIsIGV2ZW50TmFtZTogc3RyaW5nLCBtYXA6ICguLi5hcmdzOiBhbnlbXSkgPT4gVCA9IGlkID0+IGlkKTogRXZlbnQ8VD4ge1xuXHRcdGNvbnN0IGZuID0gKC4uLmFyZ3M6IGFueVtdKSA9PiByZXN1bHQuZmlyZShtYXAoLi4uYXJncykpO1xuXHRcdGNvbnN0IG9uRmlyc3RMaXN0ZW5lckFkZCA9ICgpID0+IGVtaXR0ZXIub24oZXZlbnROYW1lLCBmbik7XG5cdFx0Y29uc3Qgb25MYXN0TGlzdGVuZXJSZW1vdmUgPSAoKSA9PiBlbWl0dGVyLnJlbW92ZUxpc3RlbmVyKGV2ZW50TmFtZSwgZm4pO1xuXHRcdGNvbnN0IHJlc3VsdCA9IG5ldyBFbWl0dGVyPFQ+KHsgb25XaWxsQWRkRmlyc3RMaXN0ZW5lcjogb25GaXJzdExpc3RlbmVyQWRkLCBvbkRpZFJlbW92ZUxhc3RMaXN0ZW5lcjogb25MYXN0TGlzdGVuZXJSZW1vdmUgfSk7XG5cblx0XHRyZXR1cm4gcmVzdWx0LmV2ZW50O1xuXHR9XG5cblx0ZXhwb3J0IGludGVyZmFjZSBET01FdmVudEVtaXR0ZXIge1xuXHRcdGFkZEV2ZW50TGlzdGVuZXIoZXZlbnQ6IHN0cmluZyB8IHN5bWJvbCwgbGlzdGVuZXI6IEZ1bmN0aW9uKTogdm9pZDtcblx0XHRyZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50OiBzdHJpbmcgfCBzeW1ib2wsIGxpc3RlbmVyOiBGdW5jdGlvbik6IHZvaWQ7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlcyBhbiB7QGxpbmsgRXZlbnR9IGZyb20gYSBET00gZXZlbnQgZW1pdHRlci5cblx0ICovXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tRE9NRXZlbnRFbWl0dGVyPFQ+KGVtaXR0ZXI6IERPTUV2ZW50RW1pdHRlciwgZXZlbnROYW1lOiBzdHJpbmcsIG1hcDogKC4uLmFyZ3M6IGFueVtdKSA9PiBUID0gaWQgPT4gaWQpOiBFdmVudDxUPiB7XG5cdFx0Y29uc3QgZm4gPSAoLi4uYXJnczogYW55W10pID0+IHJlc3VsdC5maXJlKG1hcCguLi5hcmdzKSk7XG5cdFx0Y29uc3Qgb25GaXJzdExpc3RlbmVyQWRkID0gKCkgPT4gZW1pdHRlci5hZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgZm4pO1xuXHRcdGNvbnN0IG9uTGFzdExpc3RlbmVyUmVtb3ZlID0gKCkgPT4gZW1pdHRlci5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgZm4pO1xuXHRcdGNvbnN0IHJlc3VsdCA9IG5ldyBFbWl0dGVyPFQ+KHsgb25XaWxsQWRkRmlyc3RMaXN0ZW5lcjogb25GaXJzdExpc3RlbmVyQWRkLCBvbkRpZFJlbW92ZUxhc3RMaXN0ZW5lcjogb25MYXN0TGlzdGVuZXJSZW1vdmUgfSk7XG5cblx0XHRyZXR1cm4gcmVzdWx0LmV2ZW50O1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBwcm9taXNlIG91dCBvZiBhbiBldmVudCwgdXNpbmcgdGhlIHtAbGluayBFdmVudC5vbmNlfSBoZWxwZXIuXG5cdCAqL1xuXHRleHBvcnQgZnVuY3Rpb24gdG9Qcm9taXNlPFQ+KGV2ZW50OiBFdmVudDxUPiwgZGlzcG9zYWJsZXM/OiBJRGlzcG9zYWJsZVtdIHwgRGlzcG9zYWJsZVN0b3JlKTogUHJvbWlzZTxUPiB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4gb25jZShldmVudCkocmVzb2x2ZSwgbnVsbCwgZGlzcG9zYWJsZXMpKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGFuIGV2ZW50IG91dCBvZiBhIHByb21pc2UgdGhhdCBmaXJlcyBvbmNlIHdoZW4gdGhlIHByb21pc2UgaXNcblx0ICogcmVzb2x2ZWQgd2l0aCB0aGUgcmVzdWx0IG9mIHRoZSBwcm9taXNlIG9yIGB1bmRlZmluZWRgLlxuXHQgKi9cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb21Qcm9taXNlPFQ+KHByb21pc2U6IFByb21pc2U8VD4pOiBFdmVudDxUIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IEVtaXR0ZXI8VCB8IHVuZGVmaW5lZD4oKTtcblxuXHRcdHByb21pc2UudGhlbihyZXMgPT4ge1xuXHRcdFx0cmVzdWx0LmZpcmUocmVzKTtcblx0XHR9LCAoKSA9PiB7XG5cdFx0XHRyZXN1bHQuZmlyZSh1bmRlZmluZWQpO1xuXHRcdH0pLmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0cmVzdWx0LmRpc3Bvc2UoKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiByZXN1bHQuZXZlbnQ7XG5cdH1cblxuXHQvKipcblx0ICogQSBjb252ZW5pZW5jZSBmdW5jdGlvbiBmb3IgZm9yd2FyZGluZyBhbiBldmVudCB0byBhbm90aGVyIGVtaXR0ZXIgd2hpY2hcblx0ICogaW1wcm92ZXMgcmVhZGFiaWxpdHkuXG5cdCAqXG5cdCAqIFRoaXMgaXMgc2ltaWxhciB0byB7QGxpbmsgUmVsYXl9IGJ1dCBhbGxvd3MgaW5zdGFudGlhdGluZyBhbmQgZm9yd2FyZGluZ1xuXHQgKiBvbiBhIHNpbmdsZSBsaW5lIGFuZCBhbHNvIGFsbG93cyBmb3IgbXVsdGlwbGUgc291cmNlIGV2ZW50cy5cblx0ICogQHBhcmFtIGZyb20gVGhlIGV2ZW50IHRvIGZvcndhcmQuXG5cdCAqIEBwYXJhbSB0byBUaGUgZW1pdHRlciB0byBmb3J3YXJkIHRoZSBldmVudCB0by5cblx0ICogQGV4YW1wbGVcblx0ICogRXZlbnQuZm9yd2FyZChldmVudCwgZW1pdHRlcik7XG5cdCAqIC8vIGVxdWl2YWxlbnQgdG9cblx0ICogZXZlbnQoZSA9PiBlbWl0dGVyLmZpcmUoZSkpO1xuXHQgKiAvLyBlcXVpdmFsZW50IHRvXG5cdCAqIGV2ZW50KGVtaXR0ZXIuZmlyZSwgZW1pdHRlcik7XG5cdCAqL1xuXHRleHBvcnQgZnVuY3Rpb24gZm9yd2FyZDxUPihmcm9tOiBFdmVudDxUPiwgdG86IEVtaXR0ZXI8VD4pOiBJRGlzcG9zYWJsZSB7XG5cdFx0cmV0dXJuIGZyb20oZSA9PiB0by5maXJlKGUpKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBZGRzIGEgbGlzdGVuZXIgdG8gYW4gZXZlbnQgYW5kIGNhbGxzIHRoZSBsaXN0ZW5lciBpbW1lZGlhdGVseSB3aXRoIHVuZGVmaW5lZCBhcyB0aGUgZXZlbnQgb2JqZWN0LlxuXHQgKlxuXHQgKiBAZXhhbXBsZVxuXHQgKiBgYGBcblx0ICogLy8gSW5pdGlhbGl6ZSB0aGUgVUkgYW5kIHVwZGF0ZSBpdCB3aGVuIGRhdGFDaGFuZ2VFdmVudCBmaXJlc1xuXHQgKiBydW5BbmRTdWJzY3JpYmUoZGF0YUNoYW5nZUV2ZW50LCAoKSA9PiB0aGlzLl91cGRhdGVVSSgpKTtcblx0ICogYGBgXG5cdCAqL1xuXHRleHBvcnQgZnVuY3Rpb24gcnVuQW5kU3Vic2NyaWJlPFQ+KGV2ZW50OiBFdmVudDxUPiwgaGFuZGxlcjogKGU6IFQpID0+IHVua25vd24sIGluaXRpYWw6IFQpOiBJRGlzcG9zYWJsZTtcblx0ZXhwb3J0IGZ1bmN0aW9uIHJ1bkFuZFN1YnNjcmliZTxUPihldmVudDogRXZlbnQ8VD4sIGhhbmRsZXI6IChlOiBUIHwgdW5kZWZpbmVkKSA9PiB1bmtub3duKTogSURpc3Bvc2FibGU7XG5cdGV4cG9ydCBmdW5jdGlvbiBydW5BbmRTdWJzY3JpYmU8VD4oZXZlbnQ6IEV2ZW50PFQ+LCBoYW5kbGVyOiAoZTogVCB8IHVuZGVmaW5lZCkgPT4gdW5rbm93biwgaW5pdGlhbD86IFQpOiBJRGlzcG9zYWJsZSB7XG5cdFx0aGFuZGxlcihpbml0aWFsKTtcblx0XHRyZXR1cm4gZXZlbnQoZSA9PiBoYW5kbGVyKGUpKTtcblx0fVxuXG5cdGNsYXNzIEVtaXR0ZXJPYnNlcnZlcjxUPiBpbXBsZW1lbnRzIElPYnNlcnZlciB7XG5cblx0XHRyZWFkb25seSBlbWl0dGVyOiBFbWl0dGVyPFQ+O1xuXG5cdFx0cHJpdmF0ZSBfY291bnRlciA9IDA7XG5cdFx0cHJpdmF0ZSBfaGFzQ2hhbmdlZCA9IGZhbHNlO1xuXG5cdFx0Y29uc3RydWN0b3IocmVhZG9ubHkgX29ic2VydmFibGU6IElPYnNlcnZhYmxlPFQ+LCBzdG9yZTogRGlzcG9zYWJsZVN0b3JlIHwgdW5kZWZpbmVkKSB7XG5cdFx0XHRjb25zdCBvcHRpb25zOiBFbWl0dGVyT3B0aW9ucyA9IHtcblx0XHRcdFx0b25XaWxsQWRkRmlyc3RMaXN0ZW5lcjogKCkgPT4ge1xuXHRcdFx0XHRcdF9vYnNlcnZhYmxlLmFkZE9ic2VydmVyKHRoaXMpO1xuXG5cdFx0XHRcdFx0Ly8gQ29tbXVuaWNhdGUgdG8gdGhlIG9ic2VydmFibGUgdGhhdCB3ZSByZWNlaXZlZCBpdHMgY3VycmVudCB2YWx1ZSBhbmQgd291bGQgbGlrZSB0byBiZSBub3RpZmllZCBhYm91dCBmdXR1cmUgY2hhbmdlcy5cblx0XHRcdFx0XHR0aGlzLl9vYnNlcnZhYmxlLnJlcG9ydENoYW5nZXMoKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0b25EaWRSZW1vdmVMYXN0TGlzdGVuZXI6ICgpID0+IHtcblx0XHRcdFx0XHRfb2JzZXJ2YWJsZS5yZW1vdmVPYnNlcnZlcih0aGlzKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdGlmICghc3RvcmUpIHtcblx0XHRcdFx0X2FkZExlYWthZ2VUcmFjZUxvZ2ljKG9wdGlvbnMpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5lbWl0dGVyID0gbmV3IEVtaXR0ZXI8VD4ob3B0aW9ucyk7XG5cdFx0XHRpZiAoc3RvcmUpIHtcblx0XHRcdFx0c3RvcmUuYWRkKHRoaXMuZW1pdHRlcik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0YmVnaW5VcGRhdGU8VD4oX29ic2VydmFibGU6IElPYnNlcnZhYmxlPFQ+KTogdm9pZCB7XG5cdFx0XHQvLyBhc3NlcnQoX29ic2VydmFibGUgPT09IHRoaXMub2JzKTtcblx0XHRcdHRoaXMuX2NvdW50ZXIrKztcblx0XHR9XG5cblx0XHRoYW5kbGVQb3NzaWJsZUNoYW5nZTxUPihfb2JzZXJ2YWJsZTogSU9ic2VydmFibGU8VD4pOiB2b2lkIHtcblx0XHRcdC8vIGFzc2VydChfb2JzZXJ2YWJsZSA9PT0gdGhpcy5vYnMpO1xuXHRcdH1cblxuXHRcdGhhbmRsZUNoYW5nZTxULCBUQ2hhbmdlPihfb2JzZXJ2YWJsZTogSU9ic2VydmFibGVXaXRoQ2hhbmdlPFQsIFRDaGFuZ2U+LCBfY2hhbmdlOiBUQ2hhbmdlKTogdm9pZCB7XG5cdFx0XHQvLyBhc3NlcnQoX29ic2VydmFibGUgPT09IHRoaXMub2JzKTtcblx0XHRcdHRoaXMuX2hhc0NoYW5nZWQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGVuZFVwZGF0ZTxUPihfb2JzZXJ2YWJsZTogSU9ic2VydmFibGU8VD4pOiB2b2lkIHtcblx0XHRcdC8vIGFzc2VydChfb2JzZXJ2YWJsZSA9PT0gdGhpcy5vYnMpO1xuXHRcdFx0dGhpcy5fY291bnRlci0tO1xuXHRcdFx0aWYgKHRoaXMuX2NvdW50ZXIgPT09IDApIHtcblx0XHRcdFx0dGhpcy5fb2JzZXJ2YWJsZS5yZXBvcnRDaGFuZ2VzKCk7XG5cdFx0XHRcdGlmICh0aGlzLl9oYXNDaGFuZ2VkKSB7XG5cdFx0XHRcdFx0dGhpcy5faGFzQ2hhbmdlZCA9IGZhbHNlO1xuXHRcdFx0XHRcdHRoaXMuZW1pdHRlci5maXJlKHRoaXMuX29ic2VydmFibGUuZ2V0KCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYW4gZXZlbnQgZW1pdHRlciB0aGF0IGlzIGZpcmVkIHdoZW4gdGhlIG9ic2VydmFibGUgY2hhbmdlcy5cblx0ICogRWFjaCBsaXN0ZW5lcnMgc3Vic2NyaWJlcyB0byB0aGUgZW1pdHRlci5cblx0ICovXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tT2JzZXJ2YWJsZTxUPihvYnM6IElPYnNlcnZhYmxlPFQ+LCBzdG9yZT86IERpc3Bvc2FibGVTdG9yZSk6IEV2ZW50PFQ+IHtcblx0XHRjb25zdCBvYnNlcnZlciA9IG5ldyBFbWl0dGVyT2JzZXJ2ZXIob2JzLCBzdG9yZSk7XG5cdFx0cmV0dXJuIG9ic2VydmVyLmVtaXR0ZXIuZXZlbnQ7XG5cdH1cblxuXHQvKipcblx0ICogRWFjaCBsaXN0ZW5lciBpcyBhdHRhY2hlZCB0byB0aGUgb2JzZXJ2YWJsZSBkaXJlY3RseS5cblx0ICovXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tT2JzZXJ2YWJsZUxpZ2h0KG9ic2VydmFibGU6IElPYnNlcnZhYmxlPHVua25vd24+KTogRXZlbnQ8dm9pZD4ge1xuXHRcdHJldHVybiAobGlzdGVuZXIsIHRoaXNBcmdzLCBkaXNwb3NhYmxlcykgPT4ge1xuXHRcdFx0bGV0IGNvdW50ID0gMDtcblx0XHRcdGxldCBkaWRDaGFuZ2UgPSBmYWxzZTtcblx0XHRcdGNvbnN0IG9ic2VydmVyOiBJT2JzZXJ2ZXIgPSB7XG5cdFx0XHRcdGJlZ2luVXBkYXRlKCkge1xuXHRcdFx0XHRcdGNvdW50Kys7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGVuZFVwZGF0ZSgpIHtcblx0XHRcdFx0XHRjb3VudC0tO1xuXHRcdFx0XHRcdGlmIChjb3VudCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0b2JzZXJ2YWJsZS5yZXBvcnRDaGFuZ2VzKCk7XG5cdFx0XHRcdFx0XHRpZiAoZGlkQ2hhbmdlKSB7XG5cdFx0XHRcdFx0XHRcdGRpZENoYW5nZSA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0XHRsaXN0ZW5lci5jYWxsKHRoaXNBcmdzKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGhhbmRsZVBvc3NpYmxlQ2hhbmdlKCkge1xuXHRcdFx0XHRcdC8vIG5vb3Bcblx0XHRcdFx0fSxcblx0XHRcdFx0aGFuZGxlQ2hhbmdlKCkge1xuXHRcdFx0XHRcdGRpZENoYW5nZSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRvYnNlcnZhYmxlLmFkZE9ic2VydmVyKG9ic2VydmVyKTtcblx0XHRcdG9ic2VydmFibGUucmVwb3J0Q2hhbmdlcygpO1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHtcblx0XHRcdFx0ZGlzcG9zZSgpIHtcblx0XHRcdFx0XHRvYnNlcnZhYmxlLnJlbW92ZU9ic2VydmVyKG9ic2VydmVyKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0aWYgKGRpc3Bvc2FibGVzIGluc3RhbmNlb2YgRGlzcG9zYWJsZVN0b3JlKSB7XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChkaXNwb3NhYmxlKTtcblx0XHRcdH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShkaXNwb3NhYmxlcykpIHtcblx0XHRcdFx0ZGlzcG9zYWJsZXMucHVzaChkaXNwb3NhYmxlKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGRpc3Bvc2FibGU7XG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEVtaXR0ZXJPcHRpb25zIHtcblx0LyoqXG5cdCAqIE9wdGlvbmFsIGZ1bmN0aW9uIHRoYXQncyBjYWxsZWQgKmJlZm9yZSogdGhlIHZlcnkgZmlyc3QgbGlzdGVuZXIgaXMgYWRkZWRcblx0ICovXG5cdG9uV2lsbEFkZEZpcnN0TGlzdGVuZXI/OiBGdW5jdGlvbjtcblx0LyoqXG5cdCAqIE9wdGlvbmFsIGZ1bmN0aW9uIHRoYXQncyBjYWxsZWQgKmFmdGVyKiB0aGUgdmVyeSBmaXJzdCBsaXN0ZW5lciBpcyBhZGRlZFxuXHQgKi9cblx0b25EaWRBZGRGaXJzdExpc3RlbmVyPzogRnVuY3Rpb247XG5cdC8qKlxuXHQgKiBPcHRpb25hbCBmdW5jdGlvbiB0aGF0J3MgY2FsbGVkIGFmdGVyIGEgbGlzdGVuZXIgaXMgYWRkZWRcblx0ICovXG5cdG9uRGlkQWRkTGlzdGVuZXI/OiBGdW5jdGlvbjtcblx0LyoqXG5cdCAqIE9wdGlvbmFsIGZ1bmN0aW9uIHRoYXQncyBjYWxsZWQgKmFmdGVyKiByZW1vdmUgdGhlIHZlcnkgbGFzdCBsaXN0ZW5lclxuXHQgKi9cblx0b25EaWRSZW1vdmVMYXN0TGlzdGVuZXI/OiBGdW5jdGlvbjtcblx0LyoqXG5cdCAqIE9wdGlvbmFsIGZ1bmN0aW9uIHRoYXQncyBjYWxsZWQgKmJlZm9yZSogYSBsaXN0ZW5lciBpcyByZW1vdmVkXG5cdCAqL1xuXHRvbldpbGxSZW1vdmVMaXN0ZW5lcj86IEZ1bmN0aW9uO1xuXHQvKipcblx0ICogT3B0aW9uYWwgZnVuY3Rpb24gdGhhdCdzIGNhbGxlZCB3aGVuIGEgbGlzdGVuZXIgdGhyb3dzIGFuIGVycm9yLiBEZWZhdWx0cyB0b1xuXHQgKiB7QGxpbmsgb25VbmV4cGVjdGVkRXJyb3J9XG5cdCAqL1xuXHRvbkxpc3RlbmVyRXJyb3I/OiAoZTogYW55KSA9PiB2b2lkO1xuXHQvKipcblx0ICogTnVtYmVyIG9mIGxpc3RlbmVycyB0aGF0IGFyZSBhbGxvd2VkIGJlZm9yZSBhc3N1bWluZyBhIGxlYWsuIERlZmF1bHQgdG9cblx0ICogYSBnbG9iYWxseSBjb25maWd1cmVkIHZhbHVlXG5cdCAqXG5cdCAqIEBzZWUgc2V0R2xvYmFsTGVha1dhcm5pbmdUaHJlc2hvbGRcblx0ICovXG5cdGxlYWtXYXJuaW5nVGhyZXNob2xkPzogbnVtYmVyO1xuXHQvKipcblx0ICogUGFzcyBpbiBhIGRlbGl2ZXJ5IHF1ZXVlLCB3aGljaCBpcyB1c2VmdWwgZm9yIGVuc3VyaW5nXG5cdCAqIGluIG9yZGVyIGV2ZW50IGRlbGl2ZXJ5IGFjcm9zcyBtdWx0aXBsZSBlbWl0dGVycy5cblx0ICovXG5cdGRlbGl2ZXJ5UXVldWU/OiBFdmVudERlbGl2ZXJ5UXVldWU7XG5cblx0LyoqIE9OTFkgZW5hYmxlIHRoaXMgZHVyaW5nIGRldmVsb3BtZW50ICovXG5cdF9wcm9mTmFtZT86IHN0cmluZztcbn1cblxuXG5leHBvcnQgY2xhc3MgRXZlbnRQcm9maWxpbmcge1xuXG5cdHN0YXRpYyByZWFkb25seSBhbGwgPSBuZXcgU2V0PEV2ZW50UHJvZmlsaW5nPigpO1xuXG5cdHByaXZhdGUgc3RhdGljIF9pZFBvb2wgPSAwO1xuXG5cdHJlYWRvbmx5IG5hbWU6IHN0cmluZztcblx0cHVibGljIGxpc3RlbmVyQ291bnQ6IG51bWJlciA9IDA7XG5cdHB1YmxpYyBpbnZvY2F0aW9uQ291bnQgPSAwO1xuXHRwdWJsaWMgZWxhcHNlZE92ZXJhbGwgPSAwO1xuXHRwdWJsaWMgZHVyYXRpb25zOiBudW1iZXJbXSA9IFtdO1xuXG5cdHByaXZhdGUgX3N0b3BXYXRjaD86IFN0b3BXYXRjaDtcblxuXHRjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcpIHtcblx0XHR0aGlzLm5hbWUgPSBgJHtuYW1lfV8ke0V2ZW50UHJvZmlsaW5nLl9pZFBvb2wrK31gO1xuXHRcdEV2ZW50UHJvZmlsaW5nLmFsbC5hZGQodGhpcyk7XG5cdH1cblxuXHRzdGFydChsaXN0ZW5lckNvdW50OiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9zdG9wV2F0Y2ggPSBuZXcgU3RvcFdhdGNoKCk7XG5cdFx0dGhpcy5saXN0ZW5lckNvdW50ID0gbGlzdGVuZXJDb3VudDtcblx0fVxuXG5cdHN0b3AoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3N0b3BXYXRjaCkge1xuXHRcdFx0Y29uc3QgZWxhcHNlZCA9IHRoaXMuX3N0b3BXYXRjaC5lbGFwc2VkKCk7XG5cdFx0XHR0aGlzLmR1cmF0aW9ucy5wdXNoKGVsYXBzZWQpO1xuXHRcdFx0dGhpcy5lbGFwc2VkT3ZlcmFsbCArPSBlbGFwc2VkO1xuXHRcdFx0dGhpcy5pbnZvY2F0aW9uQ291bnQgKz0gMTtcblx0XHRcdHRoaXMuX3N0b3BXYXRjaCA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cbn1cblxubGV0IF9nbG9iYWxMZWFrV2FybmluZ1RocmVzaG9sZCA9IC0xO1xuZXhwb3J0IGZ1bmN0aW9uIHNldEdsb2JhbExlYWtXYXJuaW5nVGhyZXNob2xkKG46IG51bWJlcik6IElEaXNwb3NhYmxlIHtcblx0Y29uc3Qgb2xkVmFsdWUgPSBfZ2xvYmFsTGVha1dhcm5pbmdUaHJlc2hvbGQ7XG5cdF9nbG9iYWxMZWFrV2FybmluZ1RocmVzaG9sZCA9IG47XG5cdHJldHVybiB7XG5cdFx0ZGlzcG9zZSgpIHtcblx0XHRcdF9nbG9iYWxMZWFrV2FybmluZ1RocmVzaG9sZCA9IG9sZFZhbHVlO1xuXHRcdH1cblx0fTtcbn1cblxuY2xhc3MgTGVha2FnZU1vbml0b3Ige1xuXG5cdHByaXZhdGUgc3RhdGljIF9pZFBvb2wgPSAxO1xuXG5cdHByaXZhdGUgX3N0YWNrczogTWFwPHN0cmluZywgbnVtYmVyPiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfd2FybkNvdW50ZG93bjogbnVtYmVyID0gMDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lcnJvckhhbmRsZXI6IChlcnI6IEVycm9yKSA9PiB2b2lkLFxuXHRcdHJlYWRvbmx5IHRocmVzaG9sZDogbnVtYmVyLFxuXHRcdHJlYWRvbmx5IG5hbWU6IHN0cmluZyA9IChMZWFrYWdlTW9uaXRvci5faWRQb29sKyspLnRvU3RyaW5nKDE2KS5wYWRTdGFydCgzLCAnMCcpXG5cdCkgeyB9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9zdGFja3M/LmNsZWFyKCk7XG5cdH1cblxuXHRjaGVjayhzdGFjazogU3RhY2t0cmFjZSwgbGlzdGVuZXJDb3VudDogbnVtYmVyKTogdW5kZWZpbmVkIHwgKCgpID0+IHZvaWQpIHtcblxuXHRcdGNvbnN0IHRocmVzaG9sZCA9IHRoaXMudGhyZXNob2xkO1xuXHRcdGlmICh0aHJlc2hvbGQgPD0gMCB8fCBsaXN0ZW5lckNvdW50IDwgdGhyZXNob2xkKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fc3RhY2tzKSB7XG5cdFx0XHR0aGlzLl9zdGFja3MgPSBuZXcgTWFwKCk7XG5cdFx0fVxuXHRcdGNvbnN0IGNvdW50ID0gKHRoaXMuX3N0YWNrcy5nZXQoc3RhY2sudmFsdWUpIHx8IDApO1xuXHRcdHRoaXMuX3N0YWNrcy5zZXQoc3RhY2sudmFsdWUsIGNvdW50ICsgMSk7XG5cdFx0dGhpcy5fd2FybkNvdW50ZG93biAtPSAxO1xuXG5cdFx0aWYgKHRoaXMuX3dhcm5Db3VudGRvd24gPD0gMCkge1xuXHRcdFx0Ly8gb25seSB3YXJuIG9uIGZpcnN0IGV4Y2VlZCBhbmQgdGhlbiBldmVyeSB0aW1lIHRoZSBsaW1pdFxuXHRcdFx0Ly8gaXMgZXhjZWVkZWQgYnkgNTAlIGFnYWluXG5cdFx0XHR0aGlzLl93YXJuQ291bnRkb3duID0gdGhyZXNob2xkICogMC41O1xuXG5cdFx0XHRjb25zdCBbdG9wU3RhY2ssIHRvcENvdW50XSA9IHRoaXMuZ2V0TW9zdEZyZXF1ZW50U3RhY2soKSE7XG5cdFx0XHRjb25zdCBtZXNzYWdlID0gYFske3RoaXMubmFtZX1dIHBvdGVudGlhbCBsaXN0ZW5lciBMRUFLIGRldGVjdGVkLCBoYXZpbmcgJHtsaXN0ZW5lckNvdW50fSBsaXN0ZW5lcnMgYWxyZWFkeS4gTU9TVCBmcmVxdWVudCBsaXN0ZW5lciAoJHt0b3BDb3VudH0pOmA7XG5cdFx0XHRjb25zb2xlLndhcm4obWVzc2FnZSk7XG5cdFx0XHRjb25zb2xlLndhcm4odG9wU3RhY2shKTtcblxuXHRcdFx0Y29uc3QgZXJyb3IgPSBuZXcgTGlzdGVuZXJMZWFrRXJyb3IobWVzc2FnZSwgdG9wU3RhY2spO1xuXHRcdFx0dGhpcy5fZXJyb3JIYW5kbGVyKGVycm9yKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gKCkgPT4ge1xuXHRcdFx0Y29uc3QgY291bnQgPSAodGhpcy5fc3RhY2tzIS5nZXQoc3RhY2sudmFsdWUpIHx8IDApO1xuXHRcdFx0dGhpcy5fc3RhY2tzIS5zZXQoc3RhY2sudmFsdWUsIGNvdW50IC0gMSk7XG5cdFx0fTtcblx0fVxuXG5cdGdldE1vc3RGcmVxdWVudFN0YWNrKCk6IFtzdHJpbmcsIG51bWJlcl0gfCB1bmRlZmluZWQge1xuXHRcdGlmICghdGhpcy5fc3RhY2tzKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRsZXQgdG9wU3RhY2s6IFtzdHJpbmcsIG51bWJlcl0gfCB1bmRlZmluZWQ7XG5cdFx0bGV0IHRvcENvdW50OiBudW1iZXIgPSAwO1xuXHRcdGZvciAoY29uc3QgW3N0YWNrLCBjb3VudF0gb2YgdGhpcy5fc3RhY2tzKSB7XG5cdFx0XHRpZiAoIXRvcFN0YWNrIHx8IHRvcENvdW50IDwgY291bnQpIHtcblx0XHRcdFx0dG9wU3RhY2sgPSBbc3RhY2ssIGNvdW50XTtcblx0XHRcdFx0dG9wQ291bnQgPSBjb3VudDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRvcFN0YWNrO1xuXHR9XG59XG5cbmNsYXNzIFN0YWNrdHJhY2Uge1xuXG5cdHN0YXRpYyBjcmVhdGUoKSB7XG5cdFx0Y29uc3QgZXJyID0gbmV3IEVycm9yKCk7XG5cdFx0cmV0dXJuIG5ldyBTdGFja3RyYWNlKGVyci5zdGFjayA/PyAnJyk7XG5cdH1cblxuXHRwcml2YXRlIGNvbnN0cnVjdG9yKHJlYWRvbmx5IHZhbHVlOiBzdHJpbmcpIHsgfVxuXG5cdHByaW50KCkge1xuXHRcdGNvbnNvbGUud2Fybih0aGlzLnZhbHVlLnNwbGl0KCdcXG4nKS5zbGljZSgyKS5qb2luKCdcXG4nKSk7XG5cdH1cbn1cblxuLy8gZXJyb3IgdGhhdCBpcyBsb2dnZWQgd2hlbiBnb2luZyBvdmVyIHRoZSBjb25maWd1cmVkIGxpc3RlbmVyIHRocmVzaG9sZFxuZXhwb3J0IGNsYXNzIExpc3RlbmVyTGVha0Vycm9yIGV4dGVuZHMgRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcsIHN0YWNrOiBzdHJpbmcpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLm5hbWUgPSAnTGlzdGVuZXJMZWFrRXJyb3InO1xuXHRcdHRoaXMuc3RhY2sgPSBzdGFjaztcblx0fVxufVxuXG4vLyBTRVZFUkUgZXJyb3IgdGhhdCBpcyBsb2dnZWQgd2hlbiBoYXZpbmcgZ29uZSB3YXkgb3ZlciB0aGUgY29uZmlndXJlZCBsaXN0ZW5lclxuLy8gdGhyZXNob2xkIHNvIHRoYXQgdGhlIGVtaXR0ZXIgcmVmdXNlcyB0byBhY2NlcHQgbW9yZSBsaXN0ZW5lcnNcbmV4cG9ydCBjbGFzcyBMaXN0ZW5lclJlZnVzYWxFcnJvciBleHRlbmRzIEVycm9yIHtcblx0Y29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nLCBzdGFjazogc3RyaW5nKSB7XG5cdFx0c3VwZXIobWVzc2FnZSk7XG5cdFx0dGhpcy5uYW1lID0gJ0xpc3RlbmVyUmVmdXNhbEVycm9yJztcblx0XHR0aGlzLnN0YWNrID0gc3RhY2s7XG5cdH1cbn1cblxubGV0IGlkID0gMDtcbmNsYXNzIFVuaXF1ZUNvbnRhaW5lcjxUPiB7XG5cdHN0YWNrPzogU3RhY2t0cmFjZTtcblx0cHVibGljIGlkID0gaWQrKztcblx0Y29uc3RydWN0b3IocHVibGljIHJlYWRvbmx5IHZhbHVlOiBUKSB7IH1cbn1cbmNvbnN0IGNvbXBhY3Rpb25UaHJlc2hvbGQgPSAyO1xuXG50eXBlIExpc3RlbmVyQ29udGFpbmVyPFQ+ID0gVW5pcXVlQ29udGFpbmVyPChkYXRhOiBUKSA9PiB2b2lkPjtcbnR5cGUgTGlzdGVuZXJPckxpc3RlbmVyczxUPiA9IChMaXN0ZW5lckNvbnRhaW5lcjxUPiB8IHVuZGVmaW5lZClbXSB8IExpc3RlbmVyQ29udGFpbmVyPFQ+O1xuXG5jb25zdCBmb3JFYWNoTGlzdGVuZXIgPSA8VD4obGlzdGVuZXJzOiBMaXN0ZW5lck9yTGlzdGVuZXJzPFQ+LCBmbjogKGM6IExpc3RlbmVyQ29udGFpbmVyPFQ+KSA9PiB2b2lkKSA9PiB7XG5cdGlmIChsaXN0ZW5lcnMgaW5zdGFuY2VvZiBVbmlxdWVDb250YWluZXIpIHtcblx0XHRmbihsaXN0ZW5lcnMpO1xuXHR9IGVsc2Uge1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBsID0gbGlzdGVuZXJzW2ldO1xuXHRcdFx0aWYgKGwpIHtcblx0XHRcdFx0Zm4obCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59O1xuXG4vKipcbiAqIFRoZSBFbWl0dGVyIGNhbiBiZSB1c2VkIHRvIGV4cG9zZSBhbiBFdmVudCB0byB0aGUgcHVibGljXG4gKiB0byBmaXJlIGl0IGZyb20gdGhlIGluc2lkZXMuXG4gKiBTYW1wbGU6XG5cdGNsYXNzIERvY3VtZW50IHtcblxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlID0gbmV3IEVtaXR0ZXI8KHZhbHVlOnN0cmluZyk9PmFueT4oKTtcblxuXHRcdHB1YmxpYyBvbkRpZENoYW5nZSA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdFx0Ly8gZ2V0dGVyLXN0eWxlXG5cdFx0Ly8gZ2V0IG9uRGlkQ2hhbmdlKCk6IEV2ZW50PCh2YWx1ZTpzdHJpbmcpPT5hbnk+IHtcblx0XHQvLyBcdHJldHVybiB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblx0XHQvLyB9XG5cblx0XHRwcml2YXRlIF9kb0l0KCkge1xuXHRcdFx0Ly8uLi5cblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUodmFsdWUpO1xuXHRcdH1cblx0fVxuICovXG5leHBvcnQgY2xhc3MgRW1pdHRlcjxUPiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb3B0aW9ucz86IEVtaXR0ZXJPcHRpb25zO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9sZWFrYWdlTW9uPzogTGVha2FnZU1vbml0b3I7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3BlcmZNb24/OiBFdmVudFByb2ZpbGluZztcblx0cHJpdmF0ZSBfZGlzcG9zZWQ/OiB0cnVlO1xuXHRwcml2YXRlIF9ldmVudD86IEV2ZW50PFQ+O1xuXG5cdC8qKlxuXHQgKiBBIGxpc3RlbmVyLCBvciBsaXN0IG9mIGxpc3RlbmVycy4gQSBzaW5nbGUgbGlzdGVuZXIgaXMgdGhlIG1vc3QgY29tbW9uXG5cdCAqIGZvciBldmVudCBlbWl0dGVycyAoIzE4NTc4OSksIHNvIHdlIG9wdGltaXplIHRoYXQgc3BlY2lhbCBjYXNlIHRvIGF2b2lkXG5cdCAqIHdyYXBwaW5nIGl0IGluIGFuIGFycmF5IChqdXN0IGxpa2UgTm9kZS5qcyBpdHNlbGYuKVxuXHQgKlxuXHQgKiBBIGxpc3Qgb2YgbGlzdGVuZXJzIG5ldmVyICdkb3duZ3JhZGVzJyBiYWNrIHRvIGEgcGxhaW4gZnVuY3Rpb24gaWZcblx0ICogbGlzdGVuZXJzIGFyZSByZW1vdmVkLCBmb3IgdHdvIHJlYXNvbnM6XG5cdCAqXG5cdCAqICAxLiBUaGF0J3MgY29tcGxpY2F0ZWQgKGVzcGVjaWFsbHkgd2l0aCB0aGUgZGVsaXZlcnlRdWV1ZSlcblx0ICogIDIuIEEgbGlzdGVuZXIgd2l0aCA+MSBsaXN0ZW5lciBpcyBsaWtlbHkgdG8gaGF2ZSA+MSBsaXN0ZW5lciBhZ2FpbiBhdFxuXHQgKiAgICAgc29tZSBwb2ludCwgYW5kIHN3YXBwaW5nIGJldHdlZW4gYXJyYXlzIGFuZCBmdW5jdGlvbnMgbWF5W2NpdGF0aW9uIG5lZWRlZF1cblx0ICogICAgIGludHJvZHVjZSB1bm5lY2Vzc2FyeSB3b3JrIGFuZCBnYXJiYWdlLlxuXHQgKlxuXHQgKiBUaGUgYXJyYXkgbGlzdGVuZXJzIGNhbiBiZSAnc3BhcnNlJywgdG8gYXZvaWQgcmVhbGxvY2F0aW5nIHRoZSBhcnJheVxuXHQgKiB3aGVuZXZlciBhbnkgbGlzdGVuZXIgaXMgYWRkZWQgb3IgcmVtb3ZlZC4gSWYgbW9yZSB0aGFuIGAxIC8gY29tcGFjdGlvblRocmVzaG9sZGBcblx0ICogb2YgdGhlIGFycmF5IGlzIGVtcHR5LCBvbmx5IHRoZW4gaXMgaXQgcmVzaXplZC5cblx0ICovXG5cdHByb3RlY3RlZCBfbGlzdGVuZXJzPzogTGlzdGVuZXJPckxpc3RlbmVyczxUPjtcblxuXHQvKipcblx0ICogQWx3YXlzIHRvIGJlIGRlZmluZWQgaWYgX2xpc3RlbmVycyBpcyBhbiBhcnJheS4gSXQncyBubyBsb25nZXIgYSB0cnVlXG5cdCAqIHF1ZXVlLCBidXQgaG9sZHMgdGhlIGRpc3BhdGNoaW5nICdzdGF0ZScuIElmIGBmaXJlKClgIGlzIGNhbGxlZCBvbiBhblxuXHQgKiBlbWl0dGVyLCBhbnkgd29yayBsZWZ0IGluIHRoZSBfZGVsaXZlcnlRdWV1ZSBpcyBmaW5pc2hlZCBmaXJzdC5cblx0ICovXG5cdHByaXZhdGUgX2RlbGl2ZXJ5UXVldWU/OiBFdmVudERlbGl2ZXJ5UXVldWVQcml2YXRlO1xuXHRwcm90ZWN0ZWQgX3NpemUgPSAwO1xuXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnM/OiBFbWl0dGVyT3B0aW9ucykge1xuXHRcdHRoaXMuX29wdGlvbnMgPSBvcHRpb25zO1xuXHRcdHRoaXMuX2xlYWthZ2VNb24gPSAoX2dsb2JhbExlYWtXYXJuaW5nVGhyZXNob2xkID4gMCB8fCB0aGlzLl9vcHRpb25zPy5sZWFrV2FybmluZ1RocmVzaG9sZClcblx0XHRcdD8gbmV3IExlYWthZ2VNb25pdG9yKG9wdGlvbnM/Lm9uTGlzdGVuZXJFcnJvciA/PyBvblVuZXhwZWN0ZWRFcnJvciwgdGhpcy5fb3B0aW9ucz8ubGVha1dhcm5pbmdUaHJlc2hvbGQgPz8gX2dsb2JhbExlYWtXYXJuaW5nVGhyZXNob2xkKSA6XG5cdFx0XHR1bmRlZmluZWQ7XG5cdFx0dGhpcy5fcGVyZk1vbiA9IHRoaXMuX29wdGlvbnM/Ll9wcm9mTmFtZSA/IG5ldyBFdmVudFByb2ZpbGluZyh0aGlzLl9vcHRpb25zLl9wcm9mTmFtZSkgOiB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fZGVsaXZlcnlRdWV1ZSA9IHRoaXMuX29wdGlvbnM/LmRlbGl2ZXJ5UXVldWUgYXMgRXZlbnREZWxpdmVyeVF1ZXVlUHJpdmF0ZSB8IHVuZGVmaW5lZDtcblx0fVxuXG5cdGRpc3Bvc2UoKSB7XG5cdFx0aWYgKCF0aGlzLl9kaXNwb3NlZCkge1xuXHRcdFx0dGhpcy5fZGlzcG9zZWQgPSB0cnVlO1xuXG5cdFx0XHQvLyBJdCBpcyBiYWQgdG8gaGF2ZSBsaXN0ZW5lcnMgYXQgdGhlIHRpbWUgb2YgZGlzcG9zaW5nIGFuIGVtaXR0ZXIsIGl0IGlzIHdvcnN0IHRvIGhhdmUgbGlzdGVuZXJzIGtlZXAgdGhlIGVtaXR0ZXJcblx0XHRcdC8vIGFsaXZlIHZpYSB0aGUgcmVmZXJlbmNlIHRoYXQncyBlbWJlZGRlZCBpbiB0aGVpciBkaXNwb3NhYmxlcy4gVGhlcmVmb3JlIHdlIGxvb3Agb3ZlciBhbGwgcmVtYWluaW5nIGxpc3RlbmVycyBhbmRcblx0XHRcdC8vIHVuc2V0IHRoZWlyIHN1YnNjcmlwdGlvbnMvZGlzcG9zYWJsZXMuIExvb3BpbmcgYW5kIGJsYW1pbmcgcmVtYWluaW5nIGxpc3RlbmVycyBpcyBkb25lIG9uIG5leHQgdGljayBiZWNhdXNlIHRoZVxuXHRcdFx0Ly8gdGhlIGZvbGxvd2luZyBwcm9ncmFtbWluZyBwYXR0ZXJuIGlzIHZlcnkgcG9wdWxhcjpcblx0XHRcdC8vXG5cdFx0XHQvLyBjb25zdCBzb21lTW9kZWwgPSB0aGlzLl9kaXNwb3NhYmxlcy5hZGQobmV3IE1vZGVsT2JqZWN0KCkpOyAvLyAoMSkgY3JlYXRlIGFuZCByZWdpc3RlciBtb2RlbFxuXHRcdFx0Ly8gdGhpcy5fZGlzcG9zYWJsZXMuYWRkKHNvbWVNb2RlbC5vbkRpZENoYW5nZSgoKSA9PiB7IC4uLiB9KTsgLy8gKDIpIHN1YnNjcmliZSBhbmQgcmVnaXN0ZXIgbW9kZWwtZXZlbnQgbGlzdGVuZXJcblx0XHRcdC8vIC4uLmxhdGVyLi4uXG5cdFx0XHQvLyB0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7IGRpc3Bvc2VzICgxKSB0aGVuICgyKTogZG9uJ3Qgd2FybiBhZnRlciAoMSkgYnV0IGFmdGVyIHRoZSBcIm92ZXJhbGwgZGlzcG9zZVwiIGlzIGRvbmVcblxuXHRcdFx0aWYgKHRoaXMuX2RlbGl2ZXJ5UXVldWU/LmN1cnJlbnQgPT09IHRoaXMpIHtcblx0XHRcdFx0dGhpcy5fZGVsaXZlcnlRdWV1ZS5yZXNldCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuX2xpc3RlbmVycykge1xuXHRcdFx0XHRpZiAoX2VuYWJsZURpc3Bvc2VXaXRoTGlzdGVuZXJXYXJuaW5nKSB7XG5cdFx0XHRcdFx0Y29uc3QgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xuXHRcdFx0XHRcdHF1ZXVlTWljcm90YXNrKCgpID0+IHtcblx0XHRcdFx0XHRcdGZvckVhY2hMaXN0ZW5lcihsaXN0ZW5lcnMsIGwgPT4gbC5zdGFjaz8ucHJpbnQoKSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLl9saXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMuX3NpemUgPSAwO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fb3B0aW9ucz8ub25EaWRSZW1vdmVMYXN0TGlzdGVuZXI/LigpO1xuXHRcdFx0dGhpcy5fbGVha2FnZU1vbj8uZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBGb3IgdGhlIHB1YmxpYyB0byBhbGxvdyB0byBzdWJzY3JpYmVcblx0ICogdG8gZXZlbnRzIGZyb20gdGhpcyBFbWl0dGVyXG5cdCAqL1xuXHRnZXQgZXZlbnQoKTogRXZlbnQ8VD4ge1xuXHRcdHRoaXMuX2V2ZW50ID8/PSAoY2FsbGJhY2s6IChlOiBUKSA9PiB1bmtub3duLCB0aGlzQXJncz86IGFueSwgZGlzcG9zYWJsZXM/OiBJRGlzcG9zYWJsZVtdIHwgRGlzcG9zYWJsZVN0b3JlKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fbGVha2FnZU1vbiAmJiB0aGlzLl9zaXplID4gdGhpcy5fbGVha2FnZU1vbi50aHJlc2hvbGQgKiogMikge1xuXHRcdFx0XHRjb25zdCBtZXNzYWdlID0gYFske3RoaXMuX2xlYWthZ2VNb24ubmFtZX1dIFJFRlVTRVMgdG8gYWNjZXB0IG5ldyBsaXN0ZW5lcnMgYmVjYXVzZSBpdCBleGNlZWRlZCBpdHMgdGhyZXNob2xkIGJ5IGZhciAoJHt0aGlzLl9zaXplfSB2cyAke3RoaXMuX2xlYWthZ2VNb24udGhyZXNob2xkfSlgO1xuXHRcdFx0XHRjb25zb2xlLndhcm4obWVzc2FnZSk7XG5cblx0XHRcdFx0Y29uc3QgdHVwbGUgPSB0aGlzLl9sZWFrYWdlTW9uLmdldE1vc3RGcmVxdWVudFN0YWNrKCkgPz8gWydVTktOT1dOIHN0YWNrJywgLTFdO1xuXHRcdFx0XHRjb25zdCBlcnJvciA9IG5ldyBMaXN0ZW5lclJlZnVzYWxFcnJvcihgJHttZXNzYWdlfS4gSElOVDogU3RhY2sgc2hvd3MgbW9zdCBmcmVxdWVudCBsaXN0ZW5lciAoJHt0dXBsZVsxXX0tdGltZXMpYCwgdHVwbGVbMF0pO1xuXHRcdFx0XHRjb25zdCBlcnJvckhhbmRsZXIgPSB0aGlzLl9vcHRpb25zPy5vbkxpc3RlbmVyRXJyb3IgfHwgb25VbmV4cGVjdGVkRXJyb3I7XG5cdFx0XHRcdGVycm9ySGFuZGxlcihlcnJvcik7XG5cblx0XHRcdFx0cmV0dXJuIERpc3Bvc2FibGUuTm9uZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuX2Rpc3Bvc2VkKSB7XG5cdFx0XHRcdC8vIHRvZG86IHNob3VsZCB3ZSB3YXJuIGlmIGEgbGlzdGVuZXIgaXMgYWRkZWQgdG8gYSBkaXNwb3NlZCBlbWl0dGVyPyBUaGlzIGhhcHBlbnMgb2Z0ZW5cblx0XHRcdFx0cmV0dXJuIERpc3Bvc2FibGUuTm9uZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXNBcmdzKSB7XG5cdFx0XHRcdGNhbGxiYWNrID0gY2FsbGJhY2suYmluZCh0aGlzQXJncyk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNvbnRhaW5lZCA9IG5ldyBVbmlxdWVDb250YWluZXIoY2FsbGJhY2spO1xuXG5cdFx0XHRsZXQgcmVtb3ZlTW9uaXRvcjogRnVuY3Rpb24gfCB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgc3RhY2s6IFN0YWNrdHJhY2UgfCB1bmRlZmluZWQ7XG5cdFx0XHRpZiAodGhpcy5fbGVha2FnZU1vbiAmJiB0aGlzLl9zaXplID49IE1hdGguY2VpbCh0aGlzLl9sZWFrYWdlTW9uLnRocmVzaG9sZCAqIDAuMikpIHtcblx0XHRcdFx0Ly8gY2hlY2sgYW5kIHJlY29yZCB0aGlzIGVtaXR0ZXIgZm9yIHBvdGVudGlhbCBsZWFrYWdlXG5cdFx0XHRcdGNvbnRhaW5lZC5zdGFjayA9IFN0YWNrdHJhY2UuY3JlYXRlKCk7XG5cdFx0XHRcdHJlbW92ZU1vbml0b3IgPSB0aGlzLl9sZWFrYWdlTW9uLmNoZWNrKGNvbnRhaW5lZC5zdGFjaywgdGhpcy5fc2l6ZSArIDEpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoX2VuYWJsZURpc3Bvc2VXaXRoTGlzdGVuZXJXYXJuaW5nKSB7XG5cdFx0XHRcdGNvbnRhaW5lZC5zdGFjayA9IHN0YWNrID8/IFN0YWNrdHJhY2UuY3JlYXRlKCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdGhpcy5fbGlzdGVuZXJzKSB7XG5cdFx0XHRcdHRoaXMuX29wdGlvbnM/Lm9uV2lsbEFkZEZpcnN0TGlzdGVuZXI/Lih0aGlzKTtcblx0XHRcdFx0dGhpcy5fbGlzdGVuZXJzID0gY29udGFpbmVkO1xuXHRcdFx0XHR0aGlzLl9vcHRpb25zPy5vbkRpZEFkZEZpcnN0TGlzdGVuZXI/Lih0aGlzKTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5fbGlzdGVuZXJzIGluc3RhbmNlb2YgVW5pcXVlQ29udGFpbmVyKSB7XG5cdFx0XHRcdHRoaXMuX2RlbGl2ZXJ5UXVldWUgPz89IG5ldyBFdmVudERlbGl2ZXJ5UXVldWVQcml2YXRlKCk7XG5cdFx0XHRcdHRoaXMuX2xpc3RlbmVycyA9IFt0aGlzLl9saXN0ZW5lcnMsIGNvbnRhaW5lZF07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9saXN0ZW5lcnMucHVzaChjb250YWluZWQpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fb3B0aW9ucz8ub25EaWRBZGRMaXN0ZW5lcj8uKHRoaXMpO1xuXG5cdFx0XHR0aGlzLl9zaXplKys7XG5cblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdFx0cmVtb3ZlTW9uaXRvcj8uKCk7XG5cdFx0XHRcdHRoaXMuX3JlbW92ZUxpc3RlbmVyKGNvbnRhaW5lZCk7XG5cdFx0XHR9KTtcblx0XHRcdGlmIChkaXNwb3NhYmxlcyBpbnN0YW5jZW9mIERpc3Bvc2FibGVTdG9yZSkge1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQocmVzdWx0KTtcblx0XHRcdH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShkaXNwb3NhYmxlcykpIHtcblx0XHRcdFx0ZGlzcG9zYWJsZXMucHVzaChyZXN1bHQpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH07XG5cblx0XHRyZXR1cm4gdGhpcy5fZXZlbnQ7XG5cdH1cblxuXHRwcml2YXRlIF9yZW1vdmVMaXN0ZW5lcihsaXN0ZW5lcjogTGlzdGVuZXJDb250YWluZXI8VD4pIHtcblx0XHR0aGlzLl9vcHRpb25zPy5vbldpbGxSZW1vdmVMaXN0ZW5lcj8uKHRoaXMpO1xuXG5cdFx0aWYgKCF0aGlzLl9saXN0ZW5lcnMpIHtcblx0XHRcdHJldHVybjsgLy8gZXhwZWN0ZWQgaWYgYSBsaXN0ZW5lciBnZXRzIGRpc3Bvc2VkXG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX3NpemUgPT09IDEpIHtcblx0XHRcdHRoaXMuX2xpc3RlbmVycyA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX29wdGlvbnM/Lm9uRGlkUmVtb3ZlTGFzdExpc3RlbmVyPy4odGhpcyk7XG5cdFx0XHR0aGlzLl9zaXplID0gMDtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBzaXplID4gMSB3aGljaCByZXF1aXJlcyB0aGF0IGxpc3RlbmVycyBiZSBhIGxpc3Q6XG5cdFx0Y29uc3QgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzIGFzIChMaXN0ZW5lckNvbnRhaW5lcjxUPiB8IHVuZGVmaW5lZClbXTtcblxuXHRcdGNvbnN0IGluZGV4ID0gbGlzdGVuZXJzLmluZGV4T2YobGlzdGVuZXIpO1xuXHRcdGlmIChpbmRleCA9PT0gLTEpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdkaXNwb3NlZD8nLCB0aGlzLl9kaXNwb3NlZCk7XG5cdFx0XHRjb25zb2xlLmxvZygnc2l6ZT8nLCB0aGlzLl9zaXplKTtcblx0XHRcdGNvbnNvbGUubG9nKCdhcnI/JywgSlNPTi5zdHJpbmdpZnkodGhpcy5fbGlzdGVuZXJzKSk7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0F0dGVtcHRlZCB0byBkaXNwb3NlIHVua25vd24gbGlzdGVuZXInKTtcblx0XHR9XG5cblx0XHR0aGlzLl9zaXplLS07XG5cdFx0bGlzdGVuZXJzW2luZGV4XSA9IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IGFkanVzdERlbGl2ZXJ5UXVldWUgPSB0aGlzLl9kZWxpdmVyeVF1ZXVlIS5jdXJyZW50ID09PSB0aGlzO1xuXHRcdGlmICh0aGlzLl9zaXplICogY29tcGFjdGlvblRocmVzaG9sZCA8PSBsaXN0ZW5lcnMubGVuZ3RoKSB7XG5cdFx0XHRsZXQgbiA9IDA7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGxpc3RlbmVycy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpZiAobGlzdGVuZXJzW2ldKSB7XG5cdFx0XHRcdFx0bGlzdGVuZXJzW24rK10gPSBsaXN0ZW5lcnNbaV07XG5cdFx0XHRcdH0gZWxzZSBpZiAoYWRqdXN0RGVsaXZlcnlRdWV1ZSAmJiBuIDwgdGhpcy5fZGVsaXZlcnlRdWV1ZSEuZW5kKSB7XG5cdFx0XHRcdFx0dGhpcy5fZGVsaXZlcnlRdWV1ZSEuZW5kLS07XG5cdFx0XHRcdFx0aWYgKG4gPCB0aGlzLl9kZWxpdmVyeVF1ZXVlIS5pKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9kZWxpdmVyeVF1ZXVlIS5pLS07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRsaXN0ZW5lcnMubGVuZ3RoID0gbjtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9kZWxpdmVyKGxpc3RlbmVyOiB1bmRlZmluZWQgfCBVbmlxdWVDb250YWluZXI8KHZhbHVlOiBUKSA9PiB2b2lkPiwgdmFsdWU6IFQpIHtcblx0XHRpZiAoIWxpc3RlbmVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXJyb3JIYW5kbGVyID0gdGhpcy5fb3B0aW9ucz8ub25MaXN0ZW5lckVycm9yIHx8IG9uVW5leHBlY3RlZEVycm9yO1xuXHRcdGlmICghZXJyb3JIYW5kbGVyKSB7XG5cdFx0XHRsaXN0ZW5lci52YWx1ZSh2YWx1ZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGxpc3RlbmVyLnZhbHVlKHZhbHVlKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRlcnJvckhhbmRsZXIoZSk7XG5cdFx0fVxuXHR9XG5cblx0LyoqIERlbGl2ZXJzIGl0ZW1zIGluIHRoZSBxdWV1ZS4gQXNzdW1lcyB0aGUgcXVldWUgaXMgcmVhZHkgdG8gZ28uICovXG5cdHByaXZhdGUgX2RlbGl2ZXJRdWV1ZShkcTogRXZlbnREZWxpdmVyeVF1ZXVlUHJpdmF0ZSkge1xuXHRcdGNvbnN0IGxpc3RlbmVycyA9IGRxLmN1cnJlbnQhLl9saXN0ZW5lcnMhIGFzIChMaXN0ZW5lckNvbnRhaW5lcjxUPiB8IHVuZGVmaW5lZClbXTtcblx0XHR3aGlsZSAoZHEuaSA8IGRxLmVuZCkge1xuXHRcdFx0Ly8gaW1wb3J0YW50OiBkcS5pIGlzIGluY3JlbWVudGVkIGJlZm9yZSBjYWxsaW5nIGRlbGl2ZXIoKSBiZWNhdXNlIGl0IG1pZ2h0IHJlZW50ZXIgZGVsaXZlclF1ZXVlKClcblx0XHRcdHRoaXMuX2RlbGl2ZXIobGlzdGVuZXJzW2RxLmkrK10sIGRxLnZhbHVlIGFzIFQpO1xuXHRcdH1cblx0XHRkcS5yZXNldCgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRvIGJlIGtlcHQgcHJpdmF0ZSB0byBmaXJlIGFuIGV2ZW50IHRvXG5cdCAqIHN1YnNjcmliZXJzXG5cdCAqL1xuXHRmaXJlKGV2ZW50OiBUKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2RlbGl2ZXJ5UXVldWU/LmN1cnJlbnQpIHtcblx0XHRcdHRoaXMuX2RlbGl2ZXJRdWV1ZSh0aGlzLl9kZWxpdmVyeVF1ZXVlKTtcblx0XHRcdHRoaXMuX3BlcmZNb24/LnN0b3AoKTsgLy8gbGFzdCBmaXJlKCkgd2lsbCBoYXZlIHN0YXJ0aW5nIHBlcmZtb24sIHN0b3AgaXQgYmVmb3JlIHN0YXJ0aW5nIHRoZSBuZXh0IGRpc3BhdGNoXG5cdFx0fVxuXG5cdFx0dGhpcy5fcGVyZk1vbj8uc3RhcnQodGhpcy5fc2l6ZSk7XG5cblx0XHRpZiAoIXRoaXMuX2xpc3RlbmVycykge1xuXHRcdFx0Ly8gbm8tb3Bcblx0XHR9IGVsc2UgaWYgKHRoaXMuX2xpc3RlbmVycyBpbnN0YW5jZW9mIFVuaXF1ZUNvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5fZGVsaXZlcih0aGlzLl9saXN0ZW5lcnMsIGV2ZW50KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgZHEgPSB0aGlzLl9kZWxpdmVyeVF1ZXVlITtcblx0XHRcdGRxLmVucXVldWUodGhpcywgZXZlbnQsIHRoaXMuX2xpc3RlbmVycy5sZW5ndGgpO1xuXHRcdFx0dGhpcy5fZGVsaXZlclF1ZXVlKGRxKTtcblx0XHR9XG5cblx0XHR0aGlzLl9wZXJmTW9uPy5zdG9wKCk7XG5cdH1cblxuXHRoYXNMaXN0ZW5lcnMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3NpemUgPiAwO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXZlbnREZWxpdmVyeVF1ZXVlIHtcblx0X2lzRXZlbnREZWxpdmVyeVF1ZXVlOiB0cnVlO1xufVxuXG5leHBvcnQgY29uc3QgY3JlYXRlRXZlbnREZWxpdmVyeVF1ZXVlID0gKCk6IEV2ZW50RGVsaXZlcnlRdWV1ZSA9PiBuZXcgRXZlbnREZWxpdmVyeVF1ZXVlUHJpdmF0ZSgpO1xuXG5jbGFzcyBFdmVudERlbGl2ZXJ5UXVldWVQcml2YXRlIGltcGxlbWVudHMgRXZlbnREZWxpdmVyeVF1ZXVlIHtcblx0ZGVjbGFyZSBfaXNFdmVudERlbGl2ZXJ5UXVldWU6IHRydWU7XG5cblx0LyoqXG5cdCAqIEluZGV4IGluIGN1cnJlbnQncyBsaXN0ZW5lciBsaXN0LlxuXHQgKi9cblx0cHVibGljIGkgPSAtMTtcblxuXHQvKipcblx0ICogVGhlIGxhc3QgaW5kZXggaW4gdGhlIGxpc3RlbmVyJ3MgbGlzdCB0byBkZWxpdmVyLlxuXHQgKi9cblx0cHVibGljIGVuZCA9IDA7XG5cblx0LyoqXG5cdCAqIEVtaXR0ZXIgY3VycmVudGx5IGJlaW5nIGRpc3BhdGNoZWQgb24uIEVtaXR0ZXIuX2xpc3RlbmVycyBpcyBhbHdheXMgYW4gYXJyYXkuXG5cdCAqL1xuXHRwdWJsaWMgY3VycmVudD86IEVtaXR0ZXI8YW55Pjtcblx0LyoqXG5cdCAqIEN1cnJlbnRseSBlbWl0dGluZyB2YWx1ZS4gRGVmaW5lZCB3aGVuZXZlciBgY3VycmVudGAgaXMuXG5cdCAqL1xuXHRwdWJsaWMgdmFsdWU/OiB1bmtub3duO1xuXG5cdHB1YmxpYyBlbnF1ZXVlPFQ+KGVtaXR0ZXI6IEVtaXR0ZXI8VD4sIHZhbHVlOiBULCBlbmQ6IG51bWJlcikge1xuXHRcdHRoaXMuaSA9IDA7XG5cdFx0dGhpcy5lbmQgPSBlbmQ7XG5cdFx0dGhpcy5jdXJyZW50ID0gZW1pdHRlcjtcblx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdH1cblxuXHRwdWJsaWMgcmVzZXQoKSB7XG5cdFx0dGhpcy5pID0gdGhpcy5lbmQ7IC8vIGZvcmNlIGFueSBjdXJyZW50IGVtaXNzaW9uIGxvb3AgdG8gc3RvcCwgbWFpbmx5IGZvciBkdXJpbmcgZGlzcG9zZVxuXHRcdHRoaXMuY3VycmVudCA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLnZhbHVlID0gdW5kZWZpbmVkO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVdhaXRVbnRpbCB7XG5cdHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbjtcblx0d2FpdFVudGlsKHRoZW5hYmxlOiBQcm9taXNlPHVua25vd24+KTogdm9pZDtcbn1cblxuZXhwb3J0IHR5cGUgSVdhaXRVbnRpbERhdGE8VD4gPSBPbWl0PE9taXQ8VCwgJ3dhaXRVbnRpbCc+LCAndG9rZW4nPjtcblxuZXhwb3J0IGNsYXNzIEFzeW5jRW1pdHRlcjxUIGV4dGVuZHMgSVdhaXRVbnRpbD4gZXh0ZW5kcyBFbWl0dGVyPFQ+IHtcblxuXHRwcml2YXRlIF9hc3luY0RlbGl2ZXJ5UXVldWU/OiBMaW5rZWRMaXN0PFsoZXY6IFQpID0+IHZvaWQsIElXYWl0VW50aWxEYXRhPFQ+XT47XG5cblx0YXN5bmMgZmlyZUFzeW5jKGRhdGE6IElXYWl0VW50aWxEYXRhPFQ+LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIHByb21pc2VKb2luPzogKHA6IFByb21pc2U8dW5rbm93bj4sIGxpc3RlbmVyOiBGdW5jdGlvbikgPT4gUHJvbWlzZTx1bmtub3duPik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5fbGlzdGVuZXJzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl9hc3luY0RlbGl2ZXJ5UXVldWUpIHtcblx0XHRcdHRoaXMuX2FzeW5jRGVsaXZlcnlRdWV1ZSA9IG5ldyBMaW5rZWRMaXN0KCk7XG5cdFx0fVxuXG5cdFx0Zm9yRWFjaExpc3RlbmVyKHRoaXMuX2xpc3RlbmVycywgbGlzdGVuZXIgPT4gdGhpcy5fYXN5bmNEZWxpdmVyeVF1ZXVlIS5wdXNoKFtsaXN0ZW5lci52YWx1ZSwgZGF0YV0pKTtcblxuXHRcdHdoaWxlICh0aGlzLl9hc3luY0RlbGl2ZXJ5UXVldWUuc2l6ZSA+IDAgJiYgIXRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cblx0XHRcdGNvbnN0IFtsaXN0ZW5lciwgZGF0YV0gPSB0aGlzLl9hc3luY0RlbGl2ZXJ5UXVldWUuc2hpZnQoKSE7XG5cdFx0XHRjb25zdCB0aGVuYWJsZXM6IFByb21pc2U8dW5rbm93bj5bXSA9IFtdO1xuXG5cdFx0XHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbG9jYWwvY29kZS1uby1kYW5nZXJvdXMtdHlwZS1hc3NlcnRpb25zXG5cdFx0XHRjb25zdCBldmVudCA9IDxUPntcblx0XHRcdFx0Li4uZGF0YSxcblx0XHRcdFx0dG9rZW4sXG5cdFx0XHRcdHdhaXRVbnRpbDogKHA6IFByb21pc2U8dW5rbm93bj4pOiB2b2lkID0+IHtcblx0XHRcdFx0XHRpZiAoT2JqZWN0LmlzRnJvemVuKHRoZW5hYmxlcykpIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignd2FpdFVudGlsIGNhbiBOT1QgYmUgY2FsbGVkIGFzeW5jaHJvbm91cycpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAocHJvbWlzZUpvaW4pIHtcblx0XHRcdFx0XHRcdHAgPSBwcm9taXNlSm9pbihwLCBsaXN0ZW5lcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoZW5hYmxlcy5wdXNoKHApO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRsaXN0ZW5lcihldmVudCk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGUpO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gZnJlZXplIHRoZW5hYmxlcy1jb2xsZWN0aW9uIHRvIGVuZm9yY2Ugc3luYy1jYWxscyB0b1xuXHRcdFx0Ly8gd2FpdCB1bnRpbCBhbmQgdGhlbiB3YWl0IGZvciBhbGwgdGhlbmFibGVzIHRvIHJlc29sdmVcblx0XHRcdE9iamVjdC5mcmVlemUodGhlbmFibGVzKTtcblxuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKHRoZW5hYmxlcykudGhlbih2YWx1ZXMgPT4ge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHZhbHVlIG9mIHZhbHVlcykge1xuXHRcdFx0XHRcdGlmICh2YWx1ZS5zdGF0dXMgPT09ICdyZWplY3RlZCcpIHtcblx0XHRcdFx0XHRcdG9uVW5leHBlY3RlZEVycm9yKHZhbHVlLnJlYXNvbik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cbn1cblxuXG5leHBvcnQgY2xhc3MgUGF1c2VhYmxlRW1pdHRlcjxUPiBleHRlbmRzIEVtaXR0ZXI8VD4ge1xuXG5cdHByaXZhdGUgX2lzUGF1c2VkID0gMDtcblx0cHJvdGVjdGVkIF9ldmVudFF1ZXVlID0gbmV3IExpbmtlZExpc3Q8VD4oKTtcblx0cHJpdmF0ZSBfbWVyZ2VGbj86IChpbnB1dDogVFtdKSA9PiBUO1xuXG5cdHB1YmxpYyBnZXQgaXNQYXVzZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2lzUGF1c2VkICE9PSAwO1xuXHR9XG5cblx0Y29uc3RydWN0b3Iob3B0aW9ucz86IEVtaXR0ZXJPcHRpb25zICYgeyBtZXJnZT86IChpbnB1dDogVFtdKSA9PiBUIH0pIHtcblx0XHRzdXBlcihvcHRpb25zKTtcblx0XHR0aGlzLl9tZXJnZUZuID0gb3B0aW9ucz8ubWVyZ2U7XG5cdH1cblxuXHRwYXVzZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9pc1BhdXNlZCsrO1xuXHR9XG5cblx0cmVzdW1lKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9pc1BhdXNlZCAhPT0gMCAmJiAtLXRoaXMuX2lzUGF1c2VkID09PSAwKSB7XG5cdFx0XHRpZiAodGhpcy5fbWVyZ2VGbikge1xuXHRcdFx0XHQvLyB1c2UgdGhlIG1lcmdlIGZ1bmN0aW9uIHRvIGNyZWF0ZSBhIHNpbmdsZSBjb21wb3NpdGVcblx0XHRcdFx0Ly8gZXZlbnQuIG1ha2UgYSBjb3B5IGluIGNhc2UgZmlyaW5nIHBhdXNlcyB0aGlzIGVtaXR0ZXJcblx0XHRcdFx0aWYgKHRoaXMuX2V2ZW50UXVldWUuc2l6ZSA+IDApIHtcblx0XHRcdFx0XHRjb25zdCBldmVudHMgPSBBcnJheS5mcm9tKHRoaXMuX2V2ZW50UXVldWUpO1xuXHRcdFx0XHRcdHRoaXMuX2V2ZW50UXVldWUuY2xlYXIoKTtcblx0XHRcdFx0XHRzdXBlci5maXJlKHRoaXMuX21lcmdlRm4oZXZlbnRzKSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gbm8gbWVyZ2luZywgZmlyZSBlYWNoIGV2ZW50IGluZGl2aWR1YWxseSBhbmQgdGVzdFxuXHRcdFx0XHQvLyB0aGF0IHRoaXMgZW1pdHRlciBpc24ndCBwYXVzZWQgaGFsZndheSB0aHJvdWdoXG5cdFx0XHRcdHdoaWxlICghdGhpcy5faXNQYXVzZWQgJiYgdGhpcy5fZXZlbnRRdWV1ZS5zaXplICE9PSAwKSB7XG5cdFx0XHRcdFx0c3VwZXIuZmlyZSh0aGlzLl9ldmVudFF1ZXVlLnNoaWZ0KCkhKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGZpcmUoZXZlbnQ6IFQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fc2l6ZSkge1xuXHRcdFx0aWYgKHRoaXMuX2lzUGF1c2VkICE9PSAwKSB7XG5cdFx0XHRcdHRoaXMuX2V2ZW50UXVldWUucHVzaChldmVudCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzdXBlci5maXJlKGV2ZW50KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIERlYm91bmNlRW1pdHRlcjxUPiBleHRlbmRzIFBhdXNlYWJsZUVtaXR0ZXI8VD4ge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlbGF5OiBudW1iZXI7XG5cdHByaXZhdGUgX2hhbmRsZTogYW55IHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnM6IEVtaXR0ZXJPcHRpb25zICYgeyBtZXJnZTogKGlucHV0OiBUW10pID0+IFQ7IGRlbGF5PzogbnVtYmVyIH0pIHtcblx0XHRzdXBlcihvcHRpb25zKTtcblx0XHR0aGlzLl9kZWxheSA9IG9wdGlvbnMuZGVsYXkgPz8gMTAwO1xuXHR9XG5cblx0b3ZlcnJpZGUgZmlyZShldmVudDogVCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5faGFuZGxlKSB7XG5cdFx0XHR0aGlzLnBhdXNlKCk7XG5cdFx0XHR0aGlzLl9oYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0dGhpcy5faGFuZGxlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR0aGlzLnJlc3VtZSgpO1xuXHRcdFx0fSwgdGhpcy5fZGVsYXkpO1xuXHRcdH1cblx0XHRzdXBlci5maXJlKGV2ZW50KTtcblx0fVxufVxuXG4vKipcbiAqIEFuIGVtaXR0ZXIgd2hpY2ggcXVldWUgYWxsIGV2ZW50cyBhbmQgdGhlbiBwcm9jZXNzIHRoZW0gYXQgdGhlXG4gKiBlbmQgb2YgdGhlIGV2ZW50IGxvb3AuXG4gKi9cbmV4cG9ydCBjbGFzcyBNaWNyb3Rhc2tFbWl0dGVyPFQ+IGV4dGVuZHMgRW1pdHRlcjxUPiB7XG5cdHByaXZhdGUgX3F1ZXVlZEV2ZW50czogVFtdID0gW107XG5cdHByaXZhdGUgX21lcmdlRm4/OiAoaW5wdXQ6IFRbXSkgPT4gVDtcblxuXHRjb25zdHJ1Y3RvcihvcHRpb25zPzogRW1pdHRlck9wdGlvbnMgJiB7IG1lcmdlPzogKGlucHV0OiBUW10pID0+IFQgfSkge1xuXHRcdHN1cGVyKG9wdGlvbnMpO1xuXHRcdHRoaXMuX21lcmdlRm4gPSBvcHRpb25zPy5tZXJnZTtcblx0fVxuXHRvdmVycmlkZSBmaXJlKGV2ZW50OiBUKTogdm9pZCB7XG5cblx0XHRpZiAoIXRoaXMuaGFzTGlzdGVuZXJzKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9xdWV1ZWRFdmVudHMucHVzaChldmVudCk7XG5cdFx0aWYgKHRoaXMuX3F1ZXVlZEV2ZW50cy5sZW5ndGggPT09IDEpIHtcblx0XHRcdHF1ZXVlTWljcm90YXNrKCgpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuX21lcmdlRm4pIHtcblx0XHRcdFx0XHRzdXBlci5maXJlKHRoaXMuX21lcmdlRm4odGhpcy5fcXVldWVkRXZlbnRzKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fcXVldWVkRXZlbnRzLmZvckVhY2goZSA9PiBzdXBlci5maXJlKGUpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9xdWV1ZWRFdmVudHMgPSBbXTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufVxuXG4vKipcbiAqIEFuIGV2ZW50IGVtaXR0ZXIgdGhhdCBtdWx0aXBsZXhlcyBtYW55IGV2ZW50cyBpbnRvIGEgc2luZ2xlIGV2ZW50LlxuICpcbiAqIEBleGFtcGxlIExpc3RlbiB0byB0aGUgYG9uRGF0YWAgZXZlbnQgb2YgYWxsIGBUaGluZ2BzLCBkeW5hbWljYWxseSBhZGRpbmcgYW5kIHJlbW92aW5nIGBUaGluZ2BzXG4gKiB0byB0aGUgbXVsdGlwbGV4ZXIgYXMgbmVlZGVkLlxuICpcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGNvbnN0IGFueXRoaW5nRGF0YU11bHRpcGxleGVyID0gbmV3IEV2ZW50TXVsdGlwbGV4ZXI8eyBkYXRhOiBzdHJpbmcgfT4oKTtcbiAqXG4gKiBjb25zdCB0aGluZ0xpc3RlbmVycyA9IERpc3Bvc2FibGVNYXA8VGhpbmcsIElEaXNwb3NhYmxlPigpO1xuICpcbiAqIHRoaW5nU2VydmljZS5vbkRpZEFkZFRoaW5nKHRoaW5nID0+IHtcbiAqICAgdGhpbmdMaXN0ZW5lcnMuc2V0KHRoaW5nLCBhbnl0aGluZ0RhdGFNdWx0aXBsZXhlci5hZGQodGhpbmcub25EYXRhKTtcbiAqIH0pO1xuICogdGhpbmdTZXJ2aWNlLm9uRGlkUmVtb3ZlVGhpbmcodGhpbmcgPT4ge1xuICogICB0aGluZ0xpc3RlbmVycy5kZWxldGVBbmREaXNwb3NlKHRoaW5nKTtcbiAqIH0pO1xuICpcbiAqIGFueXRoaW5nRGF0YU11bHRpcGxleGVyLmV2ZW50KGUgPT4ge1xuICogICBjb25zb2xlLmxvZygnU29tZXRoaW5nIGZpcmVkIGRhdGEgJyArIGUuZGF0YSlcbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBFdmVudE11bHRpcGxleGVyPFQ+IGltcGxlbWVudHMgSURpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZW1pdHRlcjogRW1pdHRlcjxUPjtcblx0cHJpdmF0ZSBoYXNMaXN0ZW5lcnMgPSBmYWxzZTtcblx0cHJpdmF0ZSBldmVudHM6IHsgZXZlbnQ6IEV2ZW50PFQ+OyBsaXN0ZW5lcjogSURpc3Bvc2FibGUgfCBudWxsIH1bXSA9IFtdO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMuZW1pdHRlciA9IG5ldyBFbWl0dGVyPFQ+KHtcblx0XHRcdG9uV2lsbEFkZEZpcnN0TGlzdGVuZXI6ICgpID0+IHRoaXMub25GaXJzdExpc3RlbmVyQWRkKCksXG5cdFx0XHRvbkRpZFJlbW92ZUxhc3RMaXN0ZW5lcjogKCkgPT4gdGhpcy5vbkxhc3RMaXN0ZW5lclJlbW92ZSgpXG5cdFx0fSk7XG5cdH1cblxuXHRnZXQgZXZlbnQoKTogRXZlbnQ8VD4ge1xuXHRcdHJldHVybiB0aGlzLmVtaXR0ZXIuZXZlbnQ7XG5cdH1cblxuXHRhZGQoZXZlbnQ6IEV2ZW50PFQ+KTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGUgPSB7IGV2ZW50OiBldmVudCwgbGlzdGVuZXI6IG51bGwgfTtcblx0XHR0aGlzLmV2ZW50cy5wdXNoKGUpO1xuXG5cdFx0aWYgKHRoaXMuaGFzTGlzdGVuZXJzKSB7XG5cdFx0XHR0aGlzLmhvb2soZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGlzcG9zZSA9ICgpID0+IHtcblx0XHRcdGlmICh0aGlzLmhhc0xpc3RlbmVycykge1xuXHRcdFx0XHR0aGlzLnVuaG9vayhlKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgaWR4ID0gdGhpcy5ldmVudHMuaW5kZXhPZihlKTtcblx0XHRcdHRoaXMuZXZlbnRzLnNwbGljZShpZHgsIDEpO1xuXHRcdH07XG5cblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKGNyZWF0ZVNpbmdsZUNhbGxGdW5jdGlvbihkaXNwb3NlKSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRmlyc3RMaXN0ZW5lckFkZCgpOiB2b2lkIHtcblx0XHR0aGlzLmhhc0xpc3RlbmVycyA9IHRydWU7XG5cdFx0dGhpcy5ldmVudHMuZm9yRWFjaChlID0+IHRoaXMuaG9vayhlKSk7XG5cdH1cblxuXHRwcml2YXRlIG9uTGFzdExpc3RlbmVyUmVtb3ZlKCk6IHZvaWQge1xuXHRcdHRoaXMuaGFzTGlzdGVuZXJzID0gZmFsc2U7XG5cdFx0dGhpcy5ldmVudHMuZm9yRWFjaChlID0+IHRoaXMudW5ob29rKGUpKTtcblx0fVxuXG5cdHByaXZhdGUgaG9vayhlOiB7IGV2ZW50OiBFdmVudDxUPjsgbGlzdGVuZXI6IElEaXNwb3NhYmxlIHwgbnVsbCB9KTogdm9pZCB7XG5cdFx0ZS5saXN0ZW5lciA9IGUuZXZlbnQociA9PiB0aGlzLmVtaXR0ZXIuZmlyZShyKSk7XG5cdH1cblxuXHRwcml2YXRlIHVuaG9vayhlOiB7IGV2ZW50OiBFdmVudDxUPjsgbGlzdGVuZXI6IElEaXNwb3NhYmxlIHwgbnVsbCB9KTogdm9pZCB7XG5cdFx0ZS5saXN0ZW5lcj8uZGlzcG9zZSgpO1xuXHRcdGUubGlzdGVuZXIgPSBudWxsO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmVtaXR0ZXIuZGlzcG9zZSgpO1xuXG5cdFx0Zm9yIChjb25zdCBlIG9mIHRoaXMuZXZlbnRzKSB7XG5cdFx0XHRlLmxpc3RlbmVyPy5kaXNwb3NlKCk7XG5cdFx0fVxuXHRcdHRoaXMuZXZlbnRzID0gW107XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRHluYW1pY0xpc3RFdmVudE11bHRpcGxleGVyPFRFdmVudFR5cGU+IGV4dGVuZHMgSURpc3Bvc2FibGUge1xuXHRyZWFkb25seSBldmVudDogRXZlbnQ8VEV2ZW50VHlwZT47XG59XG5leHBvcnQgY2xhc3MgRHluYW1pY0xpc3RFdmVudE11bHRpcGxleGVyPFRJdGVtLCBURXZlbnRUeXBlPiBpbXBsZW1lbnRzIElEeW5hbWljTGlzdEV2ZW50TXVsdGlwbGV4ZXI8VEV2ZW50VHlwZT4ge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRyZWFkb25seSBldmVudDogRXZlbnQ8VEV2ZW50VHlwZT47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0aXRlbXM6IFRJdGVtW10sXG5cdFx0b25BZGRJdGVtOiBFdmVudDxUSXRlbT4sXG5cdFx0b25SZW1vdmVJdGVtOiBFdmVudDxUSXRlbT4sXG5cdFx0Z2V0RXZlbnQ6IChpdGVtOiBUSXRlbSkgPT4gRXZlbnQ8VEV2ZW50VHlwZT5cblx0KSB7XG5cdFx0Y29uc3QgbXVsdGlwbGV4ZXIgPSB0aGlzLl9zdG9yZS5hZGQobmV3IEV2ZW50TXVsdGlwbGV4ZXI8VEV2ZW50VHlwZT4oKSk7XG5cdFx0Y29uc3QgaXRlbUxpc3RlbmVycyA9IHRoaXMuX3N0b3JlLmFkZChuZXcgRGlzcG9zYWJsZU1hcDxUSXRlbSwgSURpc3Bvc2FibGU+KCkpO1xuXG5cdFx0ZnVuY3Rpb24gYWRkSXRlbShpbnN0YW5jZTogVEl0ZW0pIHtcblx0XHRcdGl0ZW1MaXN0ZW5lcnMuc2V0KGluc3RhbmNlLCBtdWx0aXBsZXhlci5hZGQoZ2V0RXZlbnQoaW5zdGFuY2UpKSk7XG5cdFx0fVxuXG5cdFx0Ly8gRXhpc3RpbmcgaXRlbXNcblx0XHRmb3IgKGNvbnN0IGluc3RhbmNlIG9mIGl0ZW1zKSB7XG5cdFx0XHRhZGRJdGVtKGluc3RhbmNlKTtcblx0XHR9XG5cblx0XHQvLyBBZGRlZCBpdGVtc1xuXHRcdHRoaXMuX3N0b3JlLmFkZChvbkFkZEl0ZW0oaW5zdGFuY2UgPT4ge1xuXHRcdFx0YWRkSXRlbShpbnN0YW5jZSk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gUmVtb3ZlZCBpdGVtc1xuXHRcdHRoaXMuX3N0b3JlLmFkZChvblJlbW92ZUl0ZW0oaW5zdGFuY2UgPT4ge1xuXHRcdFx0aXRlbUxpc3RlbmVycy5kZWxldGVBbmREaXNwb3NlKGluc3RhbmNlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLmV2ZW50ID0gbXVsdGlwbGV4ZXIuZXZlbnQ7XG5cdH1cblxuXHRkaXNwb3NlKCkge1xuXHRcdHRoaXMuX3N0b3JlLmRpc3Bvc2UoKTtcblx0fVxufVxuXG4vKipcbiAqIFRoZSBFdmVudEJ1ZmZlcmVyIGlzIHVzZWZ1bCBpbiBzaXR1YXRpb25zIGluIHdoaWNoIHlvdSB3YW50XG4gKiB0byBkZWxheSBmaXJpbmcgeW91ciBldmVudHMgZHVyaW5nIHNvbWUgY29kZS5cbiAqIFlvdSBjYW4gd3JhcCB0aGF0IGNvZGUgYW5kIGJlIHN1cmUgdGhhdCB0aGUgZXZlbnQgd2lsbCBub3RcbiAqIGJlIGZpcmVkIGR1cmluZyB0aGF0IHdyYXAuXG4gKlxuICogYGBgXG4gKiBjb25zdCBlbWl0dGVyOiBFbWl0dGVyO1xuICogY29uc3QgZGVsYXllciA9IG5ldyBFdmVudERlbGF5ZXIoKTtcbiAqIGNvbnN0IGRlbGF5ZWRFdmVudCA9IGRlbGF5ZXIud3JhcEV2ZW50KGVtaXR0ZXIuZXZlbnQpO1xuICpcbiAqIGRlbGF5ZWRFdmVudChjb25zb2xlLmxvZyk7XG4gKlxuICogZGVsYXllci5idWZmZXJFdmVudHMoKCkgPT4ge1xuICogICBlbWl0dGVyLmZpcmUoKTsgLy8gZXZlbnQgd2lsbCBub3QgYmUgZmlyZWQgeWV0XG4gKiB9KTtcbiAqXG4gKiAvLyBldmVudCB3aWxsIG9ubHkgYmUgZmlyZWQgYXQgdGhpcyBwb2ludFxuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBFdmVudEJ1ZmZlcmVyIHtcblxuXHRwcml2YXRlIGRhdGE6IHsgYnVmZmVyczogRnVuY3Rpb25bXSB9W10gPSBbXTtcblxuXHR3cmFwRXZlbnQ8VD4oZXZlbnQ6IEV2ZW50PFQ+KTogRXZlbnQ8VD47XG5cdHdyYXBFdmVudDxUPihldmVudDogRXZlbnQ8VD4sIHJlZHVjZTogKGxhc3Q6IFQgfCB1bmRlZmluZWQsIGV2ZW50OiBUKSA9PiBUKTogRXZlbnQ8VD47XG5cdHdyYXBFdmVudDxULCBPPihldmVudDogRXZlbnQ8VD4sIHJlZHVjZTogKGxhc3Q6IE8gfCB1bmRlZmluZWQsIGV2ZW50OiBUKSA9PiBPLCBpbml0aWFsOiBPKTogRXZlbnQ8Tz47XG5cdHdyYXBFdmVudDxULCBPPihldmVudDogRXZlbnQ8VD4sIHJlZHVjZT86IChsYXN0OiBUIHwgTyB8IHVuZGVmaW5lZCwgZXZlbnQ6IFQpID0+IFQgfCBPLCBpbml0aWFsPzogTyk6IEV2ZW50PE8gfCBUPiB7XG5cdFx0cmV0dXJuIChsaXN0ZW5lciwgdGhpc0FyZ3M/LCBkaXNwb3NhYmxlcz8pID0+IHtcblx0XHRcdHJldHVybiBldmVudChpID0+IHtcblx0XHRcdFx0Y29uc3QgZGF0YSA9IHRoaXMuZGF0YVt0aGlzLmRhdGEubGVuZ3RoIC0gMV07XG5cblx0XHRcdFx0Ly8gTm9uLXJlZHVjZSBzY2VuYXJpb1xuXHRcdFx0XHRpZiAoIXJlZHVjZSkge1xuXHRcdFx0XHRcdC8vIEJ1ZmZlcmluZyBjYXNlXG5cdFx0XHRcdFx0aWYgKGRhdGEpIHtcblx0XHRcdFx0XHRcdGRhdGEuYnVmZmVycy5wdXNoKCgpID0+IGxpc3RlbmVyLmNhbGwodGhpc0FyZ3MsIGkpKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly8gTm90IGJ1ZmZlcmluZyBjYXNlXG5cdFx0XHRcdFx0XHRsaXN0ZW5lci5jYWxsKHRoaXNBcmdzLCBpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gUmVkdWNlIHNjZW5hcmlvXG5cdFx0XHRcdGNvbnN0IHJlZHVjZURhdGEgPSBkYXRhIGFzIHR5cGVvZiBkYXRhICYge1xuXHRcdFx0XHRcdC8qKlxuXHRcdFx0XHRcdCAqIFRoZSBhY2N1bXVsYXRlZCBpdGVtcyB0aGF0IHdpbGwgYmUgcmVkdWNlZC5cblx0XHRcdFx0XHQgKi9cblx0XHRcdFx0XHRpdGVtcz86IFRbXTtcblx0XHRcdFx0XHQvKipcblx0XHRcdFx0XHQgKiBUaGUgcmVkdWNlZCByZXN1bHQgY2FjaGVkIHRvIGJlIHNoYXJlZCB3aXRoIG90aGVyIGxpc3RlbmVycy5cblx0XHRcdFx0XHQgKi9cblx0XHRcdFx0XHRyZWR1Y2VkUmVzdWx0PzogVCB8IE87XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0Ly8gTm90IGJ1ZmZlcmluZyBjYXNlXG5cdFx0XHRcdGlmICghcmVkdWNlRGF0YSkge1xuXHRcdFx0XHRcdC8vIFRPRE86IElzIHRoZXJlIGEgd2F5IHRvIGNhY2hlIHRoaXMgcmVkdWNlIGNhbGwgZm9yIGFsbCBsaXN0ZW5lcnM/XG5cdFx0XHRcdFx0bGlzdGVuZXIuY2FsbCh0aGlzQXJncywgcmVkdWNlKGluaXRpYWwsIGkpKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBCdWZmZXJpbmcgY2FzZVxuXHRcdFx0XHRyZWR1Y2VEYXRhLml0ZW1zID8/PSBbXTtcblx0XHRcdFx0cmVkdWNlRGF0YS5pdGVtcy5wdXNoKGkpO1xuXHRcdFx0XHRpZiAocmVkdWNlRGF0YS5idWZmZXJzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdC8vIEluY2x1ZGUgYSBzaW5nbGUgYnVmZmVyZWQgZnVuY3Rpb24gdGhhdCB3aWxsIHJlZHVjZSBhbGwgZXZlbnRzIHdoZW4gd2UncmUgZG9uZSBidWZmZXJpbmcgZXZlbnRzXG5cdFx0XHRcdFx0ZGF0YS5idWZmZXJzLnB1c2goKCkgPT4ge1xuXHRcdFx0XHRcdFx0Ly8gY2FjaGUgdGhlIHJlZHVjZWQgcmVzdWx0IHNvIHRoYXQgdGhlIHZhbHVlIGNhbiBiZSBzaGFyZWQgYWNyb3NzIGFsbCBsaXN0ZW5lcnNcblx0XHRcdFx0XHRcdHJlZHVjZURhdGEucmVkdWNlZFJlc3VsdCA/Pz0gaW5pdGlhbFxuXHRcdFx0XHRcdFx0XHQ/IHJlZHVjZURhdGEuaXRlbXMhLnJlZHVjZShyZWR1Y2UgYXMgKGxhc3Q6IE8gfCB1bmRlZmluZWQsIGV2ZW50OiBUKSA9PiBPLCBpbml0aWFsKVxuXHRcdFx0XHRcdFx0XHQ6IHJlZHVjZURhdGEuaXRlbXMhLnJlZHVjZShyZWR1Y2UgYXMgKGxhc3Q6IFQgfCB1bmRlZmluZWQsIGV2ZW50OiBUKSA9PiBUKTtcblx0XHRcdFx0XHRcdGxpc3RlbmVyLmNhbGwodGhpc0FyZ3MsIHJlZHVjZURhdGEucmVkdWNlZFJlc3VsdCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIHVuZGVmaW5lZCwgZGlzcG9zYWJsZXMpO1xuXHRcdH07XG5cdH1cblxuXHRidWZmZXJFdmVudHM8UiA9IHZvaWQ+KGZuOiAoKSA9PiBSKTogUiB7XG5cdFx0Y29uc3QgZGF0YSA9IHsgYnVmZmVyczogbmV3IEFycmF5PEZ1bmN0aW9uPigpIH07XG5cdFx0dGhpcy5kYXRhLnB1c2goZGF0YSk7XG5cdFx0Y29uc3QgciA9IGZuKCk7XG5cdFx0dGhpcy5kYXRhLnBvcCgpO1xuXHRcdGRhdGEuYnVmZmVycy5mb3JFYWNoKGZsdXNoID0+IGZsdXNoKCkpO1xuXHRcdHJldHVybiByO1xuXHR9XG59XG5cbi8qKlxuICogQSBSZWxheSBpcyBhbiBldmVudCBmb3J3YXJkZXIgd2hpY2ggZnVuY3Rpb25zIGFzIGEgcmVwbHVnYWJibGUgZXZlbnQgcGlwZS5cbiAqIE9uY2UgY3JlYXRlZCwgeW91IGNhbiBjb25uZWN0IGFuIGlucHV0IGV2ZW50IHRvIGl0IGFuZCBpdCB3aWxsIHNpbXBseSBmb3J3YXJkXG4gKiBldmVudHMgZnJvbSB0aGF0IGlucHV0IGV2ZW50IHRocm91Z2ggaXRzIG93biBgZXZlbnRgIHByb3BlcnR5LiBUaGUgYGlucHV0YFxuICogY2FuIGJlIGNoYW5nZWQgYXQgYW55IHBvaW50IGluIHRpbWUuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZWxheTxUPiBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIGxpc3RlbmluZyA9IGZhbHNlO1xuXHRwcml2YXRlIGlucHV0RXZlbnQ6IEV2ZW50PFQ+ID0gRXZlbnQuTm9uZTtcblx0cHJpdmF0ZSBpbnB1dEV2ZW50TGlzdGVuZXI6IElEaXNwb3NhYmxlID0gRGlzcG9zYWJsZS5Ob25lO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZW1pdHRlciA9IG5ldyBFbWl0dGVyPFQ+KHtcblx0XHRvbkRpZEFkZEZpcnN0TGlzdGVuZXI6ICgpID0+IHtcblx0XHRcdHRoaXMubGlzdGVuaW5nID0gdHJ1ZTtcblx0XHRcdHRoaXMuaW5wdXRFdmVudExpc3RlbmVyID0gdGhpcy5pbnB1dEV2ZW50KHRoaXMuZW1pdHRlci5maXJlLCB0aGlzLmVtaXR0ZXIpO1xuXHRcdH0sXG5cdFx0b25EaWRSZW1vdmVMYXN0TGlzdGVuZXI6ICgpID0+IHtcblx0XHRcdHRoaXMubGlzdGVuaW5nID0gZmFsc2U7XG5cdFx0XHR0aGlzLmlucHV0RXZlbnRMaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWFkb25seSBldmVudDogRXZlbnQ8VD4gPSB0aGlzLmVtaXR0ZXIuZXZlbnQ7XG5cblx0c2V0IGlucHV0KGV2ZW50OiBFdmVudDxUPikge1xuXHRcdHRoaXMuaW5wdXRFdmVudCA9IGV2ZW50O1xuXG5cdFx0aWYgKHRoaXMubGlzdGVuaW5nKSB7XG5cdFx0XHR0aGlzLmlucHV0RXZlbnRMaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLmlucHV0RXZlbnRMaXN0ZW5lciA9IGV2ZW50KHRoaXMuZW1pdHRlci5maXJlLCB0aGlzLmVtaXR0ZXIpO1xuXHRcdH1cblx0fVxuXG5cdGRpc3Bvc2UoKSB7XG5cdFx0dGhpcy5pbnB1dEV2ZW50TGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMuZW1pdHRlci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVmFsdWVXaXRoQ2hhbmdlRXZlbnQ8VD4ge1xuXHRyZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8dm9pZD47XG5cdGdldCB2YWx1ZSgpOiBUO1xufVxuXG5leHBvcnQgY2xhc3MgVmFsdWVXaXRoQ2hhbmdlRXZlbnQ8VD4gaW1wbGVtZW50cyBJVmFsdWVXaXRoQ2hhbmdlRXZlbnQ8VD4ge1xuXHRwdWJsaWMgc3RhdGljIGNvbnN0PFQ+KHZhbHVlOiBUKTogSVZhbHVlV2l0aENoYW5nZUV2ZW50PFQ+IHtcblx0XHRyZXR1cm4gbmV3IENvbnN0VmFsdWVXaXRoQ2hhbmdlRXZlbnQodmFsdWUpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2UgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIF92YWx1ZTogVCkgeyB9XG5cblx0Z2V0IHZhbHVlKCk6IFQge1xuXHRcdHJldHVybiB0aGlzLl92YWx1ZTtcblx0fVxuXG5cdHNldCB2YWx1ZSh2YWx1ZTogVCkge1xuXHRcdGlmICh2YWx1ZSAhPT0gdGhpcy5fdmFsdWUpIHtcblx0XHRcdHRoaXMuX3ZhbHVlID0gdmFsdWU7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIENvbnN0VmFsdWVXaXRoQ2hhbmdlRXZlbnQ8VD4gaW1wbGVtZW50cyBJVmFsdWVXaXRoQ2hhbmdlRXZlbnQ8VD4ge1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PHZvaWQ+ID0gRXZlbnQuTm9uZTtcblxuXHRjb25zdHJ1Y3RvcihyZWFkb25seSB2YWx1ZTogVCkgeyB9XG59XG5cbi8qKlxuICogQHBhcmFtIGhhbmRsZUl0ZW0gSXMgY2FsbGVkIGZvciBlYWNoIGl0ZW0gaW4gdGhlIHNldCAoYnV0IG9ubHkgdGhlIGZpcnN0IHRpbWUgdGhlIGl0ZW0gaXMgc2VlbiBpbiB0aGUgc2V0KS5cbiAqIFx0VGhlIHJldHVybmVkIGRpc3Bvc2FibGUgaXMgZGlzcG9zZWQgaWYgdGhlIGl0ZW0gaXMgbm8gbG9uZ2VyIGluIHRoZSBzZXQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmFja1NldENoYW5nZXM8VD4oZ2V0RGF0YTogKCkgPT4gUmVhZG9ubHlTZXQ8VD4sIG9uRGlkQ2hhbmdlRGF0YTogRXZlbnQ8dW5rbm93bj4sIGhhbmRsZUl0ZW06IChkOiBUKSA9PiBJRGlzcG9zYWJsZSk6IElEaXNwb3NhYmxlIHtcblx0Y29uc3QgbWFwID0gbmV3IERpc3Bvc2FibGVNYXA8VCwgSURpc3Bvc2FibGU+KCk7XG5cdGxldCBvbGREYXRhID0gbmV3IFNldChnZXREYXRhKCkpO1xuXHRmb3IgKGNvbnN0IGQgb2Ygb2xkRGF0YSkge1xuXHRcdG1hcC5zZXQoZCwgaGFuZGxlSXRlbShkKSk7XG5cdH1cblxuXHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0c3RvcmUuYWRkKG9uRGlkQ2hhbmdlRGF0YSgoKSA9PiB7XG5cdFx0Y29uc3QgbmV3RGF0YSA9IGdldERhdGEoKTtcblx0XHRjb25zdCBkaWZmID0gZGlmZlNldHMob2xkRGF0YSwgbmV3RGF0YSk7XG5cdFx0Zm9yIChjb25zdCByIG9mIGRpZmYucmVtb3ZlZCkge1xuXHRcdFx0bWFwLmRlbGV0ZUFuZERpc3Bvc2Uocik7XG5cdFx0fVxuXHRcdGZvciAoY29uc3QgYSBvZiBkaWZmLmFkZGVkKSB7XG5cdFx0XHRtYXAuc2V0KGEsIGhhbmRsZUl0ZW0oYSkpO1xuXHRcdH1cblx0XHRvbGREYXRhID0gbmV3IFNldChuZXdEYXRhKTtcblx0fSkpO1xuXHRzdG9yZS5hZGQobWFwKTtcblx0cmV0dXJuIHN0b3JlO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBTUEsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxvQkFBb0IsWUFBWSxlQUFlLGlCQUE4QixvQkFBb0I7QUFDMUcsU0FBUyxrQkFBa0I7QUFFM0IsU0FBUyxpQkFBaUI7QUFPMUIsTUFBTSxvQ0FBb0M7QUFTMUMsTUFBTSxzQ0FBc0M7QUFXckMsSUFBVTtBQUFBLENBQVYsQ0FBVUEsV0FBVjtBQUNDLEVBQU1BLE9BQUEsT0FBbUIsTUFBTSxXQUFXO0FBRWpELFdBQVMsc0JBQXNCLFNBQXlCO0FBQ3ZELFFBQUkscUNBQXFDO0FBQ3hDLFlBQU0sRUFBRSxrQkFBa0IsbUJBQW1CLElBQUk7QUFDakQsWUFBTSxRQUFRLFdBQVcsT0FBTztBQUNoQyxVQUFJLFFBQVE7QUFDWixjQUFRLG1CQUFtQixNQUFNO0FBQ2hDLFlBQUksRUFBRSxVQUFVLEdBQUc7QUFDbEIsa0JBQVEsS0FBSyw0R0FBNEc7QUFDekgsZ0JBQU0sTUFBTTtBQUFBLFFBQ2I7QUFDQSw2QkFBcUI7QUFBQSxNQUN0QjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBa0JPLFdBQVMsTUFBTSxPQUF1QixZQUEyQztBQUN2RixXQUFPLFNBQXdCLE9BQU8sTUFBTSxRQUFRLEdBQUcsUUFBVyxNQUFNLFFBQVcsVUFBVTtBQUFBLEVBQzlGO0FBRk8sRUFBQUEsT0FBUztBQVNULFdBQVMsS0FBUSxPQUEyQjtBQUNsRCxXQUFPLENBQUMsVUFBVSxXQUFXLE1BQU0sZ0JBQWlCO0FBRW5ELFVBQUksVUFBVTtBQUNkLFVBQUksU0FBa0M7QUFDdEMsZUFBUyxNQUFNLE9BQUs7QUFDbkIsWUFBSSxTQUFTO0FBQ1o7QUFBQSxRQUNELFdBQVcsUUFBUTtBQUNsQixpQkFBTyxRQUFRO0FBQUEsUUFDaEIsT0FBTztBQUNOLG9CQUFVO0FBQUEsUUFDWDtBQUVBLGVBQU8sU0FBUyxLQUFLLFVBQVUsQ0FBQztBQUFBLE1BQ2pDLEdBQUcsTUFBTSxXQUFXO0FBRXBCLFVBQUksU0FBUztBQUNaLGVBQU8sUUFBUTtBQUFBLE1BQ2hCO0FBRUEsYUFBTztBQUFBLElBQ1I7QUFBQSxFQUNEO0FBdkJPLEVBQUFBLE9BQVM7QUE4QlQsV0FBUyxPQUFVLE9BQWlCLFdBQXdDO0FBQ2xGLFdBQU9BLE9BQU0sS0FBS0EsT0FBTSxPQUFPLE9BQU8sU0FBUyxDQUFDO0FBQUEsRUFDakQ7QUFGTyxFQUFBQSxPQUFTO0FBZ0JULFdBQVMsSUFBVSxPQUFpQkMsTUFBa0IsWUFBd0M7QUFDcEcsV0FBTyxTQUFTLENBQUMsVUFBVSxXQUFXLE1BQU0sZ0JBQWlCLE1BQU0sT0FBSyxTQUFTLEtBQUssVUFBVUEsS0FBSSxDQUFDLENBQUMsR0FBRyxNQUFNLFdBQVcsR0FBRyxVQUFVO0FBQUEsRUFDeEk7QUFGTyxFQUFBRCxPQUFTO0FBZVQsV0FBUyxRQUFXLE9BQWlCLE1BQXNCLFlBQXdDO0FBQ3pHLFdBQU8sU0FBUyxDQUFDLFVBQVUsV0FBVyxNQUFNLGdCQUFpQixNQUFNLE9BQUs7QUFBRSxXQUFLLENBQUM7QUFBRyxlQUFTLEtBQUssVUFBVSxDQUFDO0FBQUEsSUFBRyxHQUFHLE1BQU0sV0FBVyxHQUFHLFVBQVU7QUFBQSxFQUNqSjtBQUZPLEVBQUFBLE9BQVM7QUFtQlQsV0FBUyxPQUFVLE9BQWlCRSxTQUEyQixZQUF3QztBQUM3RyxXQUFPLFNBQVMsQ0FBQyxVQUFVLFdBQVcsTUFBTSxnQkFBaUIsTUFBTSxPQUFLQSxRQUFPLENBQUMsS0FBSyxTQUFTLEtBQUssVUFBVSxDQUFDLEdBQUcsTUFBTSxXQUFXLEdBQUcsVUFBVTtBQUFBLEVBQ2hKO0FBRk8sRUFBQUYsT0FBUztBQU9ULFdBQVMsT0FBVSxPQUE4QjtBQUN2RCxXQUFPO0FBQUEsRUFDUjtBQUZPLEVBQUFBLE9BQVM7QUFTVCxXQUFTLE9BQVUsUUFBOEI7QUFDdkQsV0FBTyxDQUFDLFVBQVUsV0FBVyxNQUFNLGdCQUFpQjtBQUNuRCxZQUFNLGFBQWEsbUJBQW1CLEdBQUcsT0FBTyxJQUFJLFdBQVMsTUFBTSxPQUFLLFNBQVMsS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEcsYUFBTyx1QkFBdUIsWUFBWSxXQUFXO0FBQUEsSUFDdEQ7QUFBQSxFQUNEO0FBTE8sRUFBQUEsT0FBUztBQVlULFdBQVMsT0FBYSxPQUFpQixPQUE2QyxTQUFhLFlBQXdDO0FBQy9JLFFBQUksU0FBd0I7QUFFNUIsV0FBTyxJQUFVLE9BQU8sT0FBSztBQUM1QixlQUFTLE1BQU0sUUFBUSxDQUFDO0FBQ3hCLGFBQU87QUFBQSxJQUNSLEdBQUcsVUFBVTtBQUFBLEVBQ2Q7QUFQTyxFQUFBQSxPQUFTO0FBU2hCLFdBQVMsU0FBWSxPQUFpQixZQUFtRDtBQUN4RixRQUFJO0FBRUosVUFBTSxVQUFzQztBQUFBLE1BQzNDLHlCQUF5QjtBQUN4QixtQkFBVyxNQUFNLFFBQVEsTUFBTSxPQUFPO0FBQUEsTUFDdkM7QUFBQSxNQUNBLDBCQUEwQjtBQUN6QixrQkFBVSxRQUFRO0FBQUEsTUFDbkI7QUFBQSxJQUNEO0FBRUEsUUFBSSxDQUFDLFlBQVk7QUFDaEIsNEJBQXNCLE9BQU87QUFBQSxJQUM5QjtBQUVBLFVBQU0sVUFBVSxJQUFJLFFBQVcsT0FBTztBQUV0QyxnQkFBWSxJQUFJLE9BQU87QUFFdkIsV0FBTyxRQUFRO0FBQUEsRUFDaEI7QUFNQSxXQUFTLHVCQUE4QyxHQUFNLE9BQXVEO0FBQ25ILFFBQUksaUJBQWlCLE9BQU87QUFDM0IsWUFBTSxLQUFLLENBQUM7QUFBQSxJQUNiLFdBQVcsT0FBTztBQUNqQixZQUFNLElBQUksQ0FBQztBQUFBLElBQ1o7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQXNCTyxXQUFTLFNBQWUsT0FBaUIsT0FBNkMsUUFBd0MsS0FBSyxVQUFVLE9BQU8sd0JBQXdCLE9BQU8sc0JBQStCLFlBQXdDO0FBQ2hRLFFBQUk7QUFDSixRQUFJLFNBQXdCO0FBQzVCLFFBQUksU0FBYztBQUNsQixRQUFJLG9CQUFvQjtBQUN4QixRQUFJO0FBRUosVUFBTSxVQUFzQztBQUFBLE1BQzNDO0FBQUEsTUFDQSx5QkFBeUI7QUFDeEIsdUJBQWUsTUFBTSxTQUFPO0FBQzNCO0FBQ0EsbUJBQVMsTUFBTSxRQUFRLEdBQUc7QUFFMUIsY0FBSSxXQUFXLENBQUMsUUFBUTtBQUN2QixvQkFBUSxLQUFLLE1BQU07QUFDbkIscUJBQVM7QUFBQSxVQUNWO0FBRUEsbUJBQVMsTUFBTTtBQUNkLGtCQUFNLFVBQVU7QUFDaEIscUJBQVM7QUFDVCxxQkFBUztBQUNULGdCQUFJLENBQUMsV0FBVyxvQkFBb0IsR0FBRztBQUN0QyxzQkFBUSxLQUFLLE9BQVE7QUFBQSxZQUN0QjtBQUNBLGdDQUFvQjtBQUFBLFVBQ3JCO0FBRUEsY0FBSSxPQUFPLFVBQVUsVUFBVTtBQUM5Qix5QkFBYSxNQUFNO0FBQ25CLHFCQUFTLFdBQVcsUUFBUSxLQUFLO0FBQUEsVUFDbEMsT0FBTztBQUNOLGdCQUFJLFdBQVcsUUFBVztBQUN6Qix1QkFBUztBQUNULDZCQUFlLE1BQU07QUFBQSxZQUN0QjtBQUFBLFVBQ0Q7QUFBQSxRQUNELENBQUM7QUFBQSxNQUNGO0FBQUEsTUFDQSx1QkFBdUI7QUFDdEIsWUFBSSx5QkFBeUIsb0JBQW9CLEdBQUc7QUFDbkQsbUJBQVM7QUFBQSxRQUNWO0FBQUEsTUFDRDtBQUFBLE1BQ0EsMEJBQTBCO0FBQ3pCLGlCQUFTO0FBQ1QscUJBQWEsUUFBUTtBQUFBLE1BQ3RCO0FBQUEsSUFDRDtBQUVBLFFBQUksQ0FBQyxZQUFZO0FBQ2hCLDRCQUFzQixPQUFPO0FBQUEsSUFDOUI7QUFFQSxVQUFNLFVBQVUsSUFBSSxRQUFXLE9BQU87QUFFdEMsZ0JBQVksSUFBSSxPQUFPO0FBRXZCLFdBQU8sUUFBUTtBQUFBLEVBQ2hCO0FBNURPLEVBQUFBLE9BQVM7QUFxRVQsV0FBUyxXQUFjLE9BQWlCLFFBQWdCLEdBQUcsWUFBMEM7QUFDM0csV0FBT0EsT0FBTSxTQUFpQixPQUFPLENBQUMsTUFBTSxNQUFNO0FBQ2pELFVBQUksQ0FBQyxNQUFNO0FBQ1YsZUFBTyxDQUFDLENBQUM7QUFBQSxNQUNWO0FBQ0EsV0FBSyxLQUFLLENBQUM7QUFDWCxhQUFPO0FBQUEsSUFDUixHQUFHLE9BQU8sUUFBVyxNQUFNLFFBQVcsVUFBVTtBQUFBLEVBQ2pEO0FBUk8sRUFBQUEsT0FBUztBQTRCVCxXQUFTLE1BQVMsT0FBaUIsU0FBa0MsQ0FBQyxHQUFHLE1BQU0sTUFBTSxHQUFHLFlBQXdDO0FBQ3RJLFFBQUksWUFBWTtBQUNoQixRQUFJO0FBRUosV0FBTyxPQUFPLE9BQU8sV0FBUztBQUM3QixZQUFNLGFBQWEsYUFBYSxDQUFDLE9BQU8sT0FBTyxLQUFLO0FBQ3BELGtCQUFZO0FBQ1osY0FBUTtBQUNSLGFBQU87QUFBQSxJQUNSLEdBQUcsVUFBVTtBQUFBLEVBQ2Q7QUFWTyxFQUFBQSxPQUFTO0FBNkJULFdBQVMsTUFBWSxPQUFxQixLQUEyQixZQUFvRDtBQUMvSCxXQUFPO0FBQUEsTUFDTkEsT0FBTSxPQUFPLE9BQU8sS0FBSyxVQUFVO0FBQUEsTUFDbkNBLE9BQU0sT0FBTyxPQUFPLE9BQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxVQUFVO0FBQUEsSUFDN0M7QUFBQSxFQUNEO0FBTE8sRUFBQUEsT0FBUztBQTJCVCxXQUFTLE9BQVUsT0FBaUIsb0JBQW9CLE9BQU8sVUFBZSxDQUFDLEdBQUcsWUFBd0M7QUFDaEksUUFBSUcsVUFBcUIsUUFBUSxNQUFNO0FBRXZDLFFBQUksV0FBK0IsTUFBTSxPQUFLO0FBQzdDLFVBQUlBLFNBQVE7QUFDWCxRQUFBQSxRQUFPLEtBQUssQ0FBQztBQUFBLE1BQ2QsT0FBTztBQUNOLGdCQUFRLEtBQUssQ0FBQztBQUFBLE1BQ2Y7QUFBQSxJQUNELENBQUM7QUFFRCxRQUFJLFlBQVk7QUFDZixpQkFBVyxJQUFJLFFBQVE7QUFBQSxJQUN4QjtBQUVBLFVBQU0sUUFBUSxNQUFNO0FBQ25CLE1BQUFBLFNBQVEsUUFBUSxPQUFLLFFBQVEsS0FBSyxDQUFDLENBQUM7QUFDcEMsTUFBQUEsVUFBUztBQUFBLElBQ1Y7QUFFQSxVQUFNLFVBQVUsSUFBSSxRQUFXO0FBQUEsTUFDOUIseUJBQXlCO0FBQ3hCLFlBQUksQ0FBQyxVQUFVO0FBQ2QscUJBQVcsTUFBTSxPQUFLLFFBQVEsS0FBSyxDQUFDLENBQUM7QUFDckMsY0FBSSxZQUFZO0FBQ2YsdUJBQVcsSUFBSSxRQUFRO0FBQUEsVUFDeEI7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLE1BRUEsd0JBQXdCO0FBQ3ZCLFlBQUlBLFNBQVE7QUFDWCxjQUFJLG1CQUFtQjtBQUN0Qix1QkFBVyxLQUFLO0FBQUEsVUFDakIsT0FBTztBQUNOLGtCQUFNO0FBQUEsVUFDUDtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsTUFFQSwwQkFBMEI7QUFDekIsWUFBSSxVQUFVO0FBQ2IsbUJBQVMsUUFBUTtBQUFBLFFBQ2xCO0FBQ0EsbUJBQVc7QUFBQSxNQUNaO0FBQUEsSUFDRCxDQUFDO0FBRUQsUUFBSSxZQUFZO0FBQ2YsaUJBQVcsSUFBSSxPQUFPO0FBQUEsSUFDdkI7QUFFQSxXQUFPLFFBQVE7QUFBQSxFQUNoQjtBQXJETyxFQUFBSCxPQUFTO0FBd0VULFdBQVMsTUFBWSxPQUFpQixZQUE2RTtBQUN6SCxVQUFNLEtBQWUsQ0FBQyxVQUFVLFVBQVUsZ0JBQWdCO0FBQ3pELFlBQU0sS0FBSyxXQUFXLElBQUksbUJBQW1CLENBQUM7QUFDOUMsYUFBTyxNQUFNLFNBQVUsT0FBTztBQUM3QixjQUFNLFNBQVMsR0FBRyxTQUFTLEtBQUs7QUFDaEMsWUFBSSxXQUFXLGVBQWU7QUFDN0IsbUJBQVMsS0FBSyxVQUFVLE1BQU07QUFBQSxRQUMvQjtBQUFBLE1BQ0QsR0FBRyxRQUFXLFdBQVc7QUFBQSxJQUMxQjtBQUVBLFdBQU87QUFBQSxFQUNSO0FBWk8sRUFBQUEsT0FBUztBQWNoQixRQUFNLGdCQUFnQixPQUFPLGVBQWU7QUFBQSxFQUU1QyxNQUFNLG1CQUF1RDtBQUFBLElBQTdEO0FBQ0MsV0FBaUIsUUFBcUMsQ0FBQztBQUFBO0FBQUEsSUFFdkQsSUFBTyxJQUF5QjtBQUMvQixXQUFLLE1BQU0sS0FBSyxFQUFFO0FBQ2xCLGFBQU87QUFBQSxJQUNSO0FBQUEsSUFFQSxRQUFRLElBQTRCO0FBQ25DLFdBQUssTUFBTSxLQUFLLE9BQUs7QUFDcEIsV0FBRyxDQUFDO0FBQ0osZUFBTztBQUFBLE1BQ1IsQ0FBQztBQUNELGFBQU87QUFBQSxJQUNSO0FBQUEsSUFFQSxPQUFPLElBQStCO0FBQ3JDLFdBQUssTUFBTSxLQUFLLE9BQUssR0FBRyxDQUFDLElBQUksSUFBSSxhQUFhO0FBQzlDLGFBQU87QUFBQSxJQUNSO0FBQUEsSUFFQSxPQUFVLE9BQStDLFNBQStCO0FBQ3ZGLFVBQUksT0FBTztBQUNYLFdBQUssTUFBTSxLQUFLLE9BQUs7QUFDcEIsZUFBTyxNQUFNLE1BQU0sQ0FBQztBQUNwQixlQUFPO0FBQUEsTUFDUixDQUFDO0FBQ0QsYUFBTztBQUFBLElBQ1I7QUFBQSxJQUVBLE1BQU0sU0FBc0MsQ0FBQyxHQUFHLE1BQU0sTUFBTSxHQUF1QjtBQUNsRixVQUFJLFlBQVk7QUFDaEIsVUFBSTtBQUNKLFdBQUssTUFBTSxLQUFLLFdBQVM7QUFDeEIsY0FBTSxhQUFhLGFBQWEsQ0FBQyxPQUFPLE9BQU8sS0FBSztBQUNwRCxvQkFBWTtBQUNaLGdCQUFRO0FBQ1IsZUFBTyxhQUFhLFFBQVE7QUFBQSxNQUM3QixDQUFDO0FBRUQsYUFBTztBQUFBLElBQ1I7QUFBQSxJQUVPLFNBQVMsT0FBWTtBQUMzQixpQkFBVyxRQUFRLEtBQUssT0FBTztBQUM5QixnQkFBUSxLQUFLLEtBQUs7QUFDbEIsWUFBSSxVQUFVLGVBQWU7QUFDNUI7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUVBLGFBQU87QUFBQSxJQUNSO0FBQUEsRUFDRDtBQW9CTyxXQUFTLHFCQUF3QixTQUEyQixXQUFtQkMsT0FBNkIsQ0FBQUcsUUFBTUEsS0FBYztBQUN0SSxVQUFNLEtBQUssSUFBSSxTQUFnQixPQUFPLEtBQUtILEtBQUksR0FBRyxJQUFJLENBQUM7QUFDdkQsVUFBTSxxQkFBcUIsTUFBTSxRQUFRLEdBQUcsV0FBVyxFQUFFO0FBQ3pELFVBQU0sdUJBQXVCLE1BQU0sUUFBUSxlQUFlLFdBQVcsRUFBRTtBQUN2RSxVQUFNLFNBQVMsSUFBSSxRQUFXLEVBQUUsd0JBQXdCLG9CQUFvQix5QkFBeUIscUJBQXFCLENBQUM7QUFFM0gsV0FBTyxPQUFPO0FBQUEsRUFDZjtBQVBPLEVBQUFELE9BQVM7QUFpQlQsV0FBUyxvQkFBdUIsU0FBMEIsV0FBbUJDLE9BQTZCLENBQUFHLFFBQU1BLEtBQWM7QUFDcEksVUFBTSxLQUFLLElBQUksU0FBZ0IsT0FBTyxLQUFLSCxLQUFJLEdBQUcsSUFBSSxDQUFDO0FBQ3ZELFVBQU0scUJBQXFCLE1BQU0sUUFBUSxpQkFBaUIsV0FBVyxFQUFFO0FBQ3ZFLFVBQU0sdUJBQXVCLE1BQU0sUUFBUSxvQkFBb0IsV0FBVyxFQUFFO0FBQzVFLFVBQU0sU0FBUyxJQUFJLFFBQVcsRUFBRSx3QkFBd0Isb0JBQW9CLHlCQUF5QixxQkFBcUIsQ0FBQztBQUUzSCxXQUFPLE9BQU87QUFBQSxFQUNmO0FBUE8sRUFBQUQsT0FBUztBQVlULFdBQVMsVUFBYSxPQUFpQixhQUEyRDtBQUN4RyxXQUFPLElBQUksUUFBUSxhQUFXLEtBQUssS0FBSyxFQUFFLFNBQVMsTUFBTSxXQUFXLENBQUM7QUFBQSxFQUN0RTtBQUZPLEVBQUFBLE9BQVM7QUFRVCxXQUFTLFlBQWUsU0FBMkM7QUFDekUsVUFBTSxTQUFTLElBQUksUUFBdUI7QUFFMUMsWUFBUSxLQUFLLFNBQU87QUFDbkIsYUFBTyxLQUFLLEdBQUc7QUFBQSxJQUNoQixHQUFHLE1BQU07QUFDUixhQUFPLEtBQUssTUFBUztBQUFBLElBQ3RCLENBQUMsRUFBRSxRQUFRLE1BQU07QUFDaEIsYUFBTyxRQUFRO0FBQUEsSUFDaEIsQ0FBQztBQUVELFdBQU8sT0FBTztBQUFBLEVBQ2Y7QUFaTyxFQUFBQSxPQUFTO0FBNkJULFdBQVMsUUFBVyxNQUFnQixJQUE2QjtBQUN2RSxXQUFPLEtBQUssT0FBSyxHQUFHLEtBQUssQ0FBQyxDQUFDO0FBQUEsRUFDNUI7QUFGTyxFQUFBQSxPQUFTO0FBZVQsV0FBUyxnQkFBbUIsT0FBaUIsU0FBd0MsU0FBMEI7QUFDckgsWUFBUSxPQUFPO0FBQ2YsV0FBTyxNQUFNLE9BQUssUUFBUSxDQUFDLENBQUM7QUFBQSxFQUM3QjtBQUhPLEVBQUFBLE9BQVM7QUFBQSxFQUtoQixNQUFNLGdCQUF3QztBQUFBLElBTzdDLFlBQXFCLGFBQTZCLE9BQW9DO0FBQWpFO0FBSHJCLFdBQVEsV0FBVztBQUNuQixXQUFRLGNBQWM7QUFHckIsWUFBTSxVQUEwQjtBQUFBLFFBQy9CLHdCQUF3QixNQUFNO0FBQzdCLHNCQUFZLFlBQVksSUFBSTtBQUc1QixlQUFLLFlBQVksY0FBYztBQUFBLFFBQ2hDO0FBQUEsUUFDQSx5QkFBeUIsTUFBTTtBQUM5QixzQkFBWSxlQUFlLElBQUk7QUFBQSxRQUNoQztBQUFBLE1BQ0Q7QUFDQSxVQUFJLENBQUMsT0FBTztBQUNYLDhCQUFzQixPQUFPO0FBQUEsTUFDOUI7QUFDQSxXQUFLLFVBQVUsSUFBSSxRQUFXLE9BQU87QUFDckMsVUFBSSxPQUFPO0FBQ1YsY0FBTSxJQUFJLEtBQUssT0FBTztBQUFBLE1BQ3ZCO0FBQUEsSUFDRDtBQUFBLElBRUEsWUFBZSxhQUFtQztBQUVqRCxXQUFLO0FBQUEsSUFDTjtBQUFBLElBRUEscUJBQXdCLGFBQW1DO0FBQUEsSUFFM0Q7QUFBQSxJQUVBLGFBQXlCLGFBQWdELFNBQXdCO0FBRWhHLFdBQUssY0FBYztBQUFBLElBQ3BCO0FBQUEsSUFFQSxVQUFhLGFBQW1DO0FBRS9DLFdBQUs7QUFDTCxVQUFJLEtBQUssYUFBYSxHQUFHO0FBQ3hCLGFBQUssWUFBWSxjQUFjO0FBQy9CLFlBQUksS0FBSyxhQUFhO0FBQ3JCLGVBQUssY0FBYztBQUNuQixlQUFLLFFBQVEsS0FBSyxLQUFLLFlBQVksSUFBSSxDQUFDO0FBQUEsUUFDekM7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFNTyxXQUFTLGVBQWtCLEtBQXFCLE9BQW1DO0FBQ3pGLFVBQU0sV0FBVyxJQUFJLGdCQUFnQixLQUFLLEtBQUs7QUFDL0MsV0FBTyxTQUFTLFFBQVE7QUFBQSxFQUN6QjtBQUhPLEVBQUFBLE9BQVM7QUFRVCxXQUFTLG9CQUFvQixZQUErQztBQUNsRixXQUFPLENBQUMsVUFBVSxVQUFVLGdCQUFnQjtBQUMzQyxVQUFJLFFBQVE7QUFDWixVQUFJLFlBQVk7QUFDaEIsWUFBTSxXQUFzQjtBQUFBLFFBQzNCLGNBQWM7QUFDYjtBQUFBLFFBQ0Q7QUFBQSxRQUNBLFlBQVk7QUFDWDtBQUNBLGNBQUksVUFBVSxHQUFHO0FBQ2hCLHVCQUFXLGNBQWM7QUFDekIsZ0JBQUksV0FBVztBQUNkLDBCQUFZO0FBQ1osdUJBQVMsS0FBSyxRQUFRO0FBQUEsWUFDdkI7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLFFBQ0EsdUJBQXVCO0FBQUEsUUFFdkI7QUFBQSxRQUNBLGVBQWU7QUFDZCxzQkFBWTtBQUFBLFFBQ2I7QUFBQSxNQUNEO0FBQ0EsaUJBQVcsWUFBWSxRQUFRO0FBQy9CLGlCQUFXLGNBQWM7QUFDekIsWUFBTSxhQUFhO0FBQUEsUUFDbEIsVUFBVTtBQUNULHFCQUFXLGVBQWUsUUFBUTtBQUFBLFFBQ25DO0FBQUEsTUFDRDtBQUVBLFVBQUksdUJBQXVCLGlCQUFpQjtBQUMzQyxvQkFBWSxJQUFJLFVBQVU7QUFBQSxNQUMzQixXQUFXLE1BQU0sUUFBUSxXQUFXLEdBQUc7QUFDdEMsb0JBQVksS0FBSyxVQUFVO0FBQUEsTUFDNUI7QUFFQSxhQUFPO0FBQUEsSUFDUjtBQUFBLEVBQ0Q7QUF6Q08sRUFBQUEsT0FBUztBQUFBLEdBM3FCQTtBQW13QlYsTUFBTSxrQkFBTixNQUFNLGdCQUFlO0FBQUEsRUFjM0IsWUFBWSxNQUFjO0FBUDFCLFNBQU8sZ0JBQXdCO0FBQy9CLFNBQU8sa0JBQWtCO0FBQ3pCLFNBQU8saUJBQWlCO0FBQ3hCLFNBQU8sWUFBc0IsQ0FBQztBQUs3QixTQUFLLE9BQU8sR0FBRyxJQUFJLElBQUksZ0JBQWUsU0FBUztBQUMvQyxvQkFBZSxJQUFJLElBQUksSUFBSTtBQUFBLEVBQzVCO0FBQUEsRUFFQSxNQUFNLGVBQTZCO0FBQ2xDLFNBQUssYUFBYSxJQUFJLFVBQVU7QUFDaEMsU0FBSyxnQkFBZ0I7QUFBQSxFQUN0QjtBQUFBLEVBRUEsT0FBYTtBQUNaLFFBQUksS0FBSyxZQUFZO0FBQ3BCLFlBQU0sVUFBVSxLQUFLLFdBQVcsUUFBUTtBQUN4QyxXQUFLLFVBQVUsS0FBSyxPQUFPO0FBQzNCLFdBQUssa0JBQWtCO0FBQ3ZCLFdBQUssbUJBQW1CO0FBQ3hCLFdBQUssYUFBYTtBQUFBLElBQ25CO0FBQUEsRUFDRDtBQUNEO0FBakNhLGdCQUVJLE1BQU0sb0JBQUksSUFBb0I7QUFGbEMsZ0JBSUcsVUFBVTtBQUpuQixJQUFNLGlCQUFOO0FBbUNQLElBQUksOEJBQThCO0FBQzNCLFNBQVMsOEJBQThCLEdBQXdCO0FBQ3JFLFFBQU0sV0FBVztBQUNqQixnQ0FBOEI7QUFDOUIsU0FBTztBQUFBLElBQ04sVUFBVTtBQUNULG9DQUE4QjtBQUFBLElBQy9CO0FBQUEsRUFDRDtBQUNEO0FBRUEsTUFBTSxrQkFBTixNQUFNLGdCQUFlO0FBQUEsRUFPcEIsWUFDa0IsZUFDUixXQUNBLFFBQWdCLGdCQUFlLFdBQVcsU0FBUyxFQUFFLEVBQUUsU0FBUyxHQUFHLEdBQUcsR0FDOUU7QUFIZ0I7QUFDUjtBQUNBO0FBTFYsU0FBUSxpQkFBeUI7QUFBQSxFQU03QjtBQUFBLEVBRUosVUFBZ0I7QUFDZixTQUFLLFNBQVMsTUFBTTtBQUFBLEVBQ3JCO0FBQUEsRUFFQSxNQUFNLE9BQW1CLGVBQWlEO0FBRXpFLFVBQU0sWUFBWSxLQUFLO0FBQ3ZCLFFBQUksYUFBYSxLQUFLLGdCQUFnQixXQUFXO0FBQ2hELGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxDQUFDLEtBQUssU0FBUztBQUNsQixXQUFLLFVBQVUsb0JBQUksSUFBSTtBQUFBLElBQ3hCO0FBQ0EsVUFBTSxRQUFTLEtBQUssUUFBUSxJQUFJLE1BQU0sS0FBSyxLQUFLO0FBQ2hELFNBQUssUUFBUSxJQUFJLE1BQU0sT0FBTyxRQUFRLENBQUM7QUFDdkMsU0FBSyxrQkFBa0I7QUFFdkIsUUFBSSxLQUFLLGtCQUFrQixHQUFHO0FBRzdCLFdBQUssaUJBQWlCLFlBQVk7QUFFbEMsWUFBTSxDQUFDLFVBQVUsUUFBUSxJQUFJLEtBQUsscUJBQXFCO0FBQ3ZELFlBQU0sVUFBVSxJQUFJLEtBQUssSUFBSSw4Q0FBOEMsYUFBYSwrQ0FBK0MsUUFBUTtBQUMvSSxjQUFRLEtBQUssT0FBTztBQUNwQixjQUFRLEtBQUssUUFBUztBQUV0QixZQUFNLFFBQVEsSUFBSSxrQkFBa0IsU0FBUyxRQUFRO0FBQ3JELFdBQUssY0FBYyxLQUFLO0FBQUEsSUFDekI7QUFFQSxXQUFPLE1BQU07QUFDWixZQUFNSyxTQUFTLEtBQUssUUFBUyxJQUFJLE1BQU0sS0FBSyxLQUFLO0FBQ2pELFdBQUssUUFBUyxJQUFJLE1BQU0sT0FBT0EsU0FBUSxDQUFDO0FBQUEsSUFDekM7QUFBQSxFQUNEO0FBQUEsRUFFQSx1QkFBcUQ7QUFDcEQsUUFBSSxDQUFDLEtBQUssU0FBUztBQUNsQixhQUFPO0FBQUEsSUFDUjtBQUNBLFFBQUk7QUFDSixRQUFJLFdBQW1CO0FBQ3ZCLGVBQVcsQ0FBQyxPQUFPLEtBQUssS0FBSyxLQUFLLFNBQVM7QUFDMUMsVUFBSSxDQUFDLFlBQVksV0FBVyxPQUFPO0FBQ2xDLG1CQUFXLENBQUMsT0FBTyxLQUFLO0FBQ3hCLG1CQUFXO0FBQUEsTUFDWjtBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBakVNLGdCQUVVLFVBQVU7QUFGMUIsSUFBTSxpQkFBTjtBQW1FQSxNQUFNLFdBQVc7QUFBQSxFQU9SLFlBQXFCLE9BQWU7QUFBZjtBQUFBLEVBQWlCO0FBQUEsRUFMOUMsT0FBTyxTQUFTO0FBQ2YsVUFBTSxNQUFNLElBQUksTUFBTTtBQUN0QixXQUFPLElBQUksV0FBVyxJQUFJLFNBQVMsRUFBRTtBQUFBLEVBQ3RDO0FBQUEsRUFJQSxRQUFRO0FBQ1AsWUFBUSxLQUFLLEtBQUssTUFBTSxNQUFNLElBQUksRUFBRSxNQUFNLENBQUMsRUFBRSxLQUFLLElBQUksQ0FBQztBQUFBLEVBQ3hEO0FBQ0Q7QUFHTyxNQUFNLDBCQUEwQixNQUFNO0FBQUEsRUFDNUMsWUFBWSxTQUFpQixPQUFlO0FBQzNDLFVBQU0sT0FBTztBQUNiLFNBQUssT0FBTztBQUNaLFNBQUssUUFBUTtBQUFBLEVBQ2Q7QUFDRDtBQUlPLE1BQU0sNkJBQTZCLE1BQU07QUFBQSxFQUMvQyxZQUFZLFNBQWlCLE9BQWU7QUFDM0MsVUFBTSxPQUFPO0FBQ2IsU0FBSyxPQUFPO0FBQ1osU0FBSyxRQUFRO0FBQUEsRUFDZDtBQUNEO0FBRUEsSUFBSSxLQUFLO0FBQ1QsTUFBTSxnQkFBbUI7QUFBQSxFQUd4QixZQUE0QixPQUFVO0FBQVY7QUFENUIsU0FBTyxLQUFLO0FBQUEsRUFDNEI7QUFDekM7QUFDQSxNQUFNLHNCQUFzQjtBQUs1QixNQUFNLGtCQUFrQixDQUFJLFdBQW1DLE9BQTBDO0FBQ3hHLE1BQUkscUJBQXFCLGlCQUFpQjtBQUN6QyxPQUFHLFNBQVM7QUFBQSxFQUNiLE9BQU87QUFDTixhQUFTLElBQUksR0FBRyxJQUFJLFVBQVUsUUFBUSxLQUFLO0FBQzFDLFlBQU0sSUFBSSxVQUFVLENBQUM7QUFDckIsVUFBSSxHQUFHO0FBQ04sV0FBRyxDQUFDO0FBQUEsTUFDTDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0Q7QUF1Qk8sTUFBTSxRQUFXO0FBQUEsRUFtQ3ZCLFlBQVksU0FBMEI7QUFGdEMsU0FBVSxRQUFRO0FBR2pCLFNBQUssV0FBVztBQUNoQixTQUFLLGNBQWUsOEJBQThCLEtBQUssS0FBSyxVQUFVLHVCQUNuRSxJQUFJLGVBQWUsU0FBUyxtQkFBbUIsbUJBQW1CLEtBQUssVUFBVSx3QkFBd0IsMkJBQTJCLElBQ3RJO0FBQ0QsU0FBSyxXQUFXLEtBQUssVUFBVSxZQUFZLElBQUksZUFBZSxLQUFLLFNBQVMsU0FBUyxJQUFJO0FBQ3pGLFNBQUssaUJBQWlCLEtBQUssVUFBVTtBQUFBLEVBQ3RDO0FBQUEsRUFFQSxVQUFVO0FBQ1QsUUFBSSxDQUFDLEtBQUssV0FBVztBQUNwQixXQUFLLFlBQVk7QUFZakIsVUFBSSxLQUFLLGdCQUFnQixZQUFZLE1BQU07QUFDMUMsYUFBSyxlQUFlLE1BQU07QUFBQSxNQUMzQjtBQUNBLFVBQUksS0FBSyxZQUFZO0FBQ3BCLFlBQUksbUNBQW1DO0FBQ3RDLGdCQUFNLFlBQVksS0FBSztBQUN2Qix5QkFBZSxNQUFNO0FBQ3BCLDRCQUFnQixXQUFXLE9BQUssRUFBRSxPQUFPLE1BQU0sQ0FBQztBQUFBLFVBQ2pELENBQUM7QUFBQSxRQUNGO0FBRUEsYUFBSyxhQUFhO0FBQ2xCLGFBQUssUUFBUTtBQUFBLE1BQ2Q7QUFDQSxXQUFLLFVBQVUsMEJBQTBCO0FBQ3pDLFdBQUssYUFBYSxRQUFRO0FBQUEsSUFDM0I7QUFBQSxFQUNEO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1BLElBQUksUUFBa0I7QUFDckIsU0FBSyxXQUFXLENBQUMsVUFBNkIsVUFBZ0IsZ0JBQWtEO0FBQy9HLFVBQUksS0FBSyxlQUFlLEtBQUssUUFBUSxLQUFLLFlBQVksYUFBYSxHQUFHO0FBQ3JFLGNBQU0sVUFBVSxJQUFJLEtBQUssWUFBWSxJQUFJLCtFQUErRSxLQUFLLEtBQUssT0FBTyxLQUFLLFlBQVksU0FBUztBQUNuSyxnQkFBUSxLQUFLLE9BQU87QUFFcEIsY0FBTSxRQUFRLEtBQUssWUFBWSxxQkFBcUIsS0FBSyxDQUFDLGlCQUFpQixFQUFFO0FBQzdFLGNBQU0sUUFBUSxJQUFJLHFCQUFxQixHQUFHLE9BQU8sK0NBQStDLE1BQU0sQ0FBQyxDQUFDLFdBQVcsTUFBTSxDQUFDLENBQUM7QUFDM0gsY0FBTSxlQUFlLEtBQUssVUFBVSxtQkFBbUI7QUFDdkQscUJBQWEsS0FBSztBQUVsQixlQUFPLFdBQVc7QUFBQSxNQUNuQjtBQUVBLFVBQUksS0FBSyxXQUFXO0FBRW5CLGVBQU8sV0FBVztBQUFBLE1BQ25CO0FBRUEsVUFBSSxVQUFVO0FBQ2IsbUJBQVcsU0FBUyxLQUFLLFFBQVE7QUFBQSxNQUNsQztBQUVBLFlBQU0sWUFBWSxJQUFJLGdCQUFnQixRQUFRO0FBRTlDLFVBQUk7QUFDSixVQUFJO0FBQ0osVUFBSSxLQUFLLGVBQWUsS0FBSyxTQUFTLEtBQUssS0FBSyxLQUFLLFlBQVksWUFBWSxHQUFHLEdBQUc7QUFFbEYsa0JBQVUsUUFBUSxXQUFXLE9BQU87QUFDcEMsd0JBQWdCLEtBQUssWUFBWSxNQUFNLFVBQVUsT0FBTyxLQUFLLFFBQVEsQ0FBQztBQUFBLE1BQ3ZFO0FBRUEsVUFBSSxtQ0FBbUM7QUFDdEMsa0JBQVUsUUFBUSxTQUFTLFdBQVcsT0FBTztBQUFBLE1BQzlDO0FBRUEsVUFBSSxDQUFDLEtBQUssWUFBWTtBQUNyQixhQUFLLFVBQVUseUJBQXlCLElBQUk7QUFDNUMsYUFBSyxhQUFhO0FBQ2xCLGFBQUssVUFBVSx3QkFBd0IsSUFBSTtBQUFBLE1BQzVDLFdBQVcsS0FBSyxzQkFBc0IsaUJBQWlCO0FBQ3RELGFBQUssbUJBQW1CLElBQUksMEJBQTBCO0FBQ3RELGFBQUssYUFBYSxDQUFDLEtBQUssWUFBWSxTQUFTO0FBQUEsTUFDOUMsT0FBTztBQUNOLGFBQUssV0FBVyxLQUFLLFNBQVM7QUFBQSxNQUMvQjtBQUNBLFdBQUssVUFBVSxtQkFBbUIsSUFBSTtBQUV0QyxXQUFLO0FBR0wsWUFBTSxTQUFTLGFBQWEsTUFBTTtBQUNqQyx3QkFBZ0I7QUFDaEIsYUFBSyxnQkFBZ0IsU0FBUztBQUFBLE1BQy9CLENBQUM7QUFDRCxVQUFJLHVCQUF1QixpQkFBaUI7QUFDM0Msb0JBQVksSUFBSSxNQUFNO0FBQUEsTUFDdkIsV0FBVyxNQUFNLFFBQVEsV0FBVyxHQUFHO0FBQ3RDLG9CQUFZLEtBQUssTUFBTTtBQUFBLE1BQ3hCO0FBRUEsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFUSxnQkFBZ0IsVUFBZ0M7QUFDdkQsU0FBSyxVQUFVLHVCQUF1QixJQUFJO0FBRTFDLFFBQUksQ0FBQyxLQUFLLFlBQVk7QUFDckI7QUFBQSxJQUNEO0FBRUEsUUFBSSxLQUFLLFVBQVUsR0FBRztBQUNyQixXQUFLLGFBQWE7QUFDbEIsV0FBSyxVQUFVLDBCQUEwQixJQUFJO0FBQzdDLFdBQUssUUFBUTtBQUNiO0FBQUEsSUFDRDtBQUdBLFVBQU0sWUFBWSxLQUFLO0FBRXZCLFVBQU0sUUFBUSxVQUFVLFFBQVEsUUFBUTtBQUN4QyxRQUFJLFVBQVUsSUFBSTtBQUNqQixjQUFRLElBQUksYUFBYSxLQUFLLFNBQVM7QUFDdkMsY0FBUSxJQUFJLFNBQVMsS0FBSyxLQUFLO0FBQy9CLGNBQVEsSUFBSSxRQUFRLEtBQUssVUFBVSxLQUFLLFVBQVUsQ0FBQztBQUNuRCxZQUFNLElBQUksTUFBTSx1Q0FBdUM7QUFBQSxJQUN4RDtBQUVBLFNBQUs7QUFDTCxjQUFVLEtBQUssSUFBSTtBQUVuQixVQUFNLHNCQUFzQixLQUFLLGVBQWdCLFlBQVk7QUFDN0QsUUFBSSxLQUFLLFFBQVEsdUJBQXVCLFVBQVUsUUFBUTtBQUN6RCxVQUFJLElBQUk7QUFDUixlQUFTLElBQUksR0FBRyxJQUFJLFVBQVUsUUFBUSxLQUFLO0FBQzFDLFlBQUksVUFBVSxDQUFDLEdBQUc7QUFDakIsb0JBQVUsR0FBRyxJQUFJLFVBQVUsQ0FBQztBQUFBLFFBQzdCLFdBQVcsdUJBQXVCLElBQUksS0FBSyxlQUFnQixLQUFLO0FBQy9ELGVBQUssZUFBZ0I7QUFDckIsY0FBSSxJQUFJLEtBQUssZUFBZ0IsR0FBRztBQUMvQixpQkFBSyxlQUFnQjtBQUFBLFVBQ3RCO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFDQSxnQkFBVSxTQUFTO0FBQUEsSUFDcEI7QUFBQSxFQUNEO0FBQUEsRUFFUSxTQUFTLFVBQTJELE9BQVU7QUFDckYsUUFBSSxDQUFDLFVBQVU7QUFDZDtBQUFBLElBQ0Q7QUFFQSxVQUFNLGVBQWUsS0FBSyxVQUFVLG1CQUFtQjtBQUN2RCxRQUFJLENBQUMsY0FBYztBQUNsQixlQUFTLE1BQU0sS0FBSztBQUNwQjtBQUFBLElBQ0Q7QUFFQSxRQUFJO0FBQ0gsZUFBUyxNQUFNLEtBQUs7QUFBQSxJQUNyQixTQUFTLEdBQUc7QUFDWCxtQkFBYSxDQUFDO0FBQUEsSUFDZjtBQUFBLEVBQ0Q7QUFBQTtBQUFBLEVBR1EsY0FBYyxJQUErQjtBQUNwRCxVQUFNLFlBQVksR0FBRyxRQUFTO0FBQzlCLFdBQU8sR0FBRyxJQUFJLEdBQUcsS0FBSztBQUVyQixXQUFLLFNBQVMsVUFBVSxHQUFHLEdBQUcsR0FBRyxHQUFHLEtBQVU7QUFBQSxJQUMvQztBQUNBLE9BQUcsTUFBTTtBQUFBLEVBQ1Y7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTUEsS0FBSyxPQUFnQjtBQUNwQixRQUFJLEtBQUssZ0JBQWdCLFNBQVM7QUFDakMsV0FBSyxjQUFjLEtBQUssY0FBYztBQUN0QyxXQUFLLFVBQVUsS0FBSztBQUFBLElBQ3JCO0FBRUEsU0FBSyxVQUFVLE1BQU0sS0FBSyxLQUFLO0FBRS9CLFFBQUksQ0FBQyxLQUFLLFlBQVk7QUFBQSxJQUV0QixXQUFXLEtBQUssc0JBQXNCLGlCQUFpQjtBQUN0RCxXQUFLLFNBQVMsS0FBSyxZQUFZLEtBQUs7QUFBQSxJQUNyQyxPQUFPO0FBQ04sWUFBTSxLQUFLLEtBQUs7QUFDaEIsU0FBRyxRQUFRLE1BQU0sT0FBTyxLQUFLLFdBQVcsTUFBTTtBQUM5QyxXQUFLLGNBQWMsRUFBRTtBQUFBLElBQ3RCO0FBRUEsU0FBSyxVQUFVLEtBQUs7QUFBQSxFQUNyQjtBQUFBLEVBRUEsZUFBd0I7QUFDdkIsV0FBTyxLQUFLLFFBQVE7QUFBQSxFQUNyQjtBQUNEO0FBTU8sTUFBTSwyQkFBMkIsTUFBMEIsSUFBSSwwQkFBMEI7QUFFaEcsTUFBTSwwQkFBd0Q7QUFBQSxFQUE5RDtBQU1DO0FBQUE7QUFBQTtBQUFBLFNBQU8sSUFBSTtBQUtYO0FBQUE7QUFBQTtBQUFBLFNBQU8sTUFBTTtBQUFBO0FBQUEsRUFXTixRQUFXLFNBQXFCLE9BQVUsS0FBYTtBQUM3RCxTQUFLLElBQUk7QUFDVCxTQUFLLE1BQU07QUFDWCxTQUFLLFVBQVU7QUFDZixTQUFLLFFBQVE7QUFBQSxFQUNkO0FBQUEsRUFFTyxRQUFRO0FBQ2QsU0FBSyxJQUFJLEtBQUs7QUFDZCxTQUFLLFVBQVU7QUFDZixTQUFLLFFBQVE7QUFBQSxFQUNkO0FBQ0Q7QUFTTyxNQUFNLHFCQUEyQyxRQUFXO0FBQUEsRUFJbEUsTUFBTSxVQUFVLE1BQXlCLE9BQTBCLGFBQTRGO0FBQzlKLFFBQUksQ0FBQyxLQUFLLFlBQVk7QUFDckI7QUFBQSxJQUNEO0FBRUEsUUFBSSxDQUFDLEtBQUsscUJBQXFCO0FBQzlCLFdBQUssc0JBQXNCLElBQUksV0FBVztBQUFBLElBQzNDO0FBRUEsb0JBQWdCLEtBQUssWUFBWSxjQUFZLEtBQUssb0JBQXFCLEtBQUssQ0FBQyxTQUFTLE9BQU8sSUFBSSxDQUFDLENBQUM7QUFFbkcsV0FBTyxLQUFLLG9CQUFvQixPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QjtBQUUzRSxZQUFNLENBQUMsVUFBVUMsS0FBSSxJQUFJLEtBQUssb0JBQW9CLE1BQU07QUFDeEQsWUFBTSxZQUFnQyxDQUFDO0FBR3ZDLFlBQU0sUUFBVztBQUFBLFFBQ2hCLEdBQUdBO0FBQUEsUUFDSDtBQUFBLFFBQ0EsV0FBVyxDQUFDLE1BQThCO0FBQ3pDLGNBQUksT0FBTyxTQUFTLFNBQVMsR0FBRztBQUMvQixrQkFBTSxJQUFJLE1BQU0sMENBQTBDO0FBQUEsVUFDM0Q7QUFDQSxjQUFJLGFBQWE7QUFDaEIsZ0JBQUksWUFBWSxHQUFHLFFBQVE7QUFBQSxVQUM1QjtBQUNBLG9CQUFVLEtBQUssQ0FBQztBQUFBLFFBQ2pCO0FBQUEsTUFDRDtBQUVBLFVBQUk7QUFDSCxpQkFBUyxLQUFLO0FBQUEsTUFDZixTQUFTLEdBQUc7QUFDWCwwQkFBa0IsQ0FBQztBQUNuQjtBQUFBLE1BQ0Q7QUFJQSxhQUFPLE9BQU8sU0FBUztBQUV2QixZQUFNLFFBQVEsV0FBVyxTQUFTLEVBQUUsS0FBSyxZQUFVO0FBQ2xELG1CQUFXLFNBQVMsUUFBUTtBQUMzQixjQUFJLE1BQU0sV0FBVyxZQUFZO0FBQ2hDLDhCQUFrQixNQUFNLE1BQU07QUFBQSxVQUMvQjtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGO0FBQUEsRUFDRDtBQUNEO0FBR08sTUFBTSx5QkFBNEIsUUFBVztBQUFBLEVBVW5ELFlBQVksU0FBMEQ7QUFDckUsVUFBTSxPQUFPO0FBVGQsU0FBUSxZQUFZO0FBQ3BCLFNBQVUsY0FBYyxJQUFJLFdBQWM7QUFTekMsU0FBSyxXQUFXLFNBQVM7QUFBQSxFQUMxQjtBQUFBLEVBUEEsSUFBVyxXQUFvQjtBQUM5QixXQUFPLEtBQUssY0FBYztBQUFBLEVBQzNCO0FBQUEsRUFPQSxRQUFjO0FBQ2IsU0FBSztBQUFBLEVBQ047QUFBQSxFQUVBLFNBQWU7QUFDZCxRQUFJLEtBQUssY0FBYyxLQUFLLEVBQUUsS0FBSyxjQUFjLEdBQUc7QUFDbkQsVUFBSSxLQUFLLFVBQVU7QUFHbEIsWUFBSSxLQUFLLFlBQVksT0FBTyxHQUFHO0FBQzlCLGdCQUFNLFNBQVMsTUFBTSxLQUFLLEtBQUssV0FBVztBQUMxQyxlQUFLLFlBQVksTUFBTTtBQUN2QixnQkFBTSxLQUFLLEtBQUssU0FBUyxNQUFNLENBQUM7QUFBQSxRQUNqQztBQUFBLE1BRUQsT0FBTztBQUdOLGVBQU8sQ0FBQyxLQUFLLGFBQWEsS0FBSyxZQUFZLFNBQVMsR0FBRztBQUN0RCxnQkFBTSxLQUFLLEtBQUssWUFBWSxNQUFNLENBQUU7QUFBQSxRQUNyQztBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRVMsS0FBSyxPQUFnQjtBQUM3QixRQUFJLEtBQUssT0FBTztBQUNmLFVBQUksS0FBSyxjQUFjLEdBQUc7QUFDekIsYUFBSyxZQUFZLEtBQUssS0FBSztBQUFBLE1BQzVCLE9BQU87QUFDTixjQUFNLEtBQUssS0FBSztBQUFBLE1BQ2pCO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQUVPLE1BQU0sd0JBQTJCLGlCQUFvQjtBQUFBLEVBSzNELFlBQVksU0FBd0U7QUFDbkYsVUFBTSxPQUFPO0FBQ2IsU0FBSyxTQUFTLFFBQVEsU0FBUztBQUFBLEVBQ2hDO0FBQUEsRUFFUyxLQUFLLE9BQWdCO0FBQzdCLFFBQUksQ0FBQyxLQUFLLFNBQVM7QUFDbEIsV0FBSyxNQUFNO0FBQ1gsV0FBSyxVQUFVLFdBQVcsTUFBTTtBQUMvQixhQUFLLFVBQVU7QUFDZixhQUFLLE9BQU87QUFBQSxNQUNiLEdBQUcsS0FBSyxNQUFNO0FBQUEsSUFDZjtBQUNBLFVBQU0sS0FBSyxLQUFLO0FBQUEsRUFDakI7QUFDRDtBQU1PLE1BQU0seUJBQTRCLFFBQVc7QUFBQSxFQUluRCxZQUFZLFNBQTBEO0FBQ3JFLFVBQU0sT0FBTztBQUpkLFNBQVEsZ0JBQXFCLENBQUM7QUFLN0IsU0FBSyxXQUFXLFNBQVM7QUFBQSxFQUMxQjtBQUFBLEVBQ1MsS0FBSyxPQUFnQjtBQUU3QixRQUFJLENBQUMsS0FBSyxhQUFhLEdBQUc7QUFDekI7QUFBQSxJQUNEO0FBRUEsU0FBSyxjQUFjLEtBQUssS0FBSztBQUM3QixRQUFJLEtBQUssY0FBYyxXQUFXLEdBQUc7QUFDcEMscUJBQWUsTUFBTTtBQUNwQixZQUFJLEtBQUssVUFBVTtBQUNsQixnQkFBTSxLQUFLLEtBQUssU0FBUyxLQUFLLGFBQWEsQ0FBQztBQUFBLFFBQzdDLE9BQU87QUFDTixlQUFLLGNBQWMsUUFBUSxPQUFLLE1BQU0sS0FBSyxDQUFDLENBQUM7QUFBQSxRQUM5QztBQUNBLGFBQUssZ0JBQWdCLENBQUM7QUFBQSxNQUN2QixDQUFDO0FBQUEsSUFDRjtBQUFBLEVBQ0Q7QUFDRDtBQXlCTyxNQUFNLGlCQUEyQztBQUFBLEVBTXZELGNBQWM7QUFIZCxTQUFRLGVBQWU7QUFDdkIsU0FBUSxTQUE4RCxDQUFDO0FBR3RFLFNBQUssVUFBVSxJQUFJLFFBQVc7QUFBQSxNQUM3Qix3QkFBd0IsTUFBTSxLQUFLLG1CQUFtQjtBQUFBLE1BQ3RELHlCQUF5QixNQUFNLEtBQUsscUJBQXFCO0FBQUEsSUFDMUQsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLElBQUksUUFBa0I7QUFDckIsV0FBTyxLQUFLLFFBQVE7QUFBQSxFQUNyQjtBQUFBLEVBRUEsSUFBSSxPQUE4QjtBQUNqQyxVQUFNLElBQUksRUFBRSxPQUFjLFVBQVUsS0FBSztBQUN6QyxTQUFLLE9BQU8sS0FBSyxDQUFDO0FBRWxCLFFBQUksS0FBSyxjQUFjO0FBQ3RCLFdBQUssS0FBSyxDQUFDO0FBQUEsSUFDWjtBQUVBLFVBQU0sVUFBVSxNQUFNO0FBQ3JCLFVBQUksS0FBSyxjQUFjO0FBQ3RCLGFBQUssT0FBTyxDQUFDO0FBQUEsTUFDZDtBQUVBLFlBQU0sTUFBTSxLQUFLLE9BQU8sUUFBUSxDQUFDO0FBQ2pDLFdBQUssT0FBTyxPQUFPLEtBQUssQ0FBQztBQUFBLElBQzFCO0FBRUEsV0FBTyxhQUFhLHlCQUF5QixPQUFPLENBQUM7QUFBQSxFQUN0RDtBQUFBLEVBRVEscUJBQTJCO0FBQ2xDLFNBQUssZUFBZTtBQUNwQixTQUFLLE9BQU8sUUFBUSxPQUFLLEtBQUssS0FBSyxDQUFDLENBQUM7QUFBQSxFQUN0QztBQUFBLEVBRVEsdUJBQTZCO0FBQ3BDLFNBQUssZUFBZTtBQUNwQixTQUFLLE9BQU8sUUFBUSxPQUFLLEtBQUssT0FBTyxDQUFDLENBQUM7QUFBQSxFQUN4QztBQUFBLEVBRVEsS0FBSyxHQUE0RDtBQUN4RSxNQUFFLFdBQVcsRUFBRSxNQUFNLE9BQUssS0FBSyxRQUFRLEtBQUssQ0FBQyxDQUFDO0FBQUEsRUFDL0M7QUFBQSxFQUVRLE9BQU8sR0FBNEQ7QUFDMUUsTUFBRSxVQUFVLFFBQVE7QUFDcEIsTUFBRSxXQUFXO0FBQUEsRUFDZDtBQUFBLEVBRUEsVUFBZ0I7QUFDZixTQUFLLFFBQVEsUUFBUTtBQUVyQixlQUFXLEtBQUssS0FBSyxRQUFRO0FBQzVCLFFBQUUsVUFBVSxRQUFRO0FBQUEsSUFDckI7QUFDQSxTQUFLLFNBQVMsQ0FBQztBQUFBLEVBQ2hCO0FBQ0Q7QUFLTyxNQUFNLDRCQUFtRztBQUFBLEVBSy9HLFlBQ0MsT0FDQSxXQUNBLGNBQ0EsVUFDQztBQVRGLFNBQWlCLFNBQVMsSUFBSSxnQkFBZ0I7QUFVN0MsVUFBTSxjQUFjLEtBQUssT0FBTyxJQUFJLElBQUksaUJBQTZCLENBQUM7QUFDdEUsVUFBTSxnQkFBZ0IsS0FBSyxPQUFPLElBQUksSUFBSSxjQUFrQyxDQUFDO0FBRTdFLGFBQVMsUUFBUSxVQUFpQjtBQUNqQyxvQkFBYyxJQUFJLFVBQVUsWUFBWSxJQUFJLFNBQVMsUUFBUSxDQUFDLENBQUM7QUFBQSxJQUNoRTtBQUdBLGVBQVcsWUFBWSxPQUFPO0FBQzdCLGNBQVEsUUFBUTtBQUFBLElBQ2pCO0FBR0EsU0FBSyxPQUFPLElBQUksVUFBVSxjQUFZO0FBQ3JDLGNBQVEsUUFBUTtBQUFBLElBQ2pCLENBQUMsQ0FBQztBQUdGLFNBQUssT0FBTyxJQUFJLGFBQWEsY0FBWTtBQUN4QyxvQkFBYyxpQkFBaUIsUUFBUTtBQUFBLElBQ3hDLENBQUMsQ0FBQztBQUVGLFNBQUssUUFBUSxZQUFZO0FBQUEsRUFDMUI7QUFBQSxFQUVBLFVBQVU7QUFDVCxTQUFLLE9BQU8sUUFBUTtBQUFBLEVBQ3JCO0FBQ0Q7QUFzQk8sTUFBTSxjQUFjO0FBQUEsRUFBcEI7QUFFTixTQUFRLE9BQWtDLENBQUM7QUFBQTtBQUFBLEVBSzNDLFVBQWdCLE9BQWlCLFFBQXVELFNBQTJCO0FBQ2xILFdBQU8sQ0FBQyxVQUFVLFVBQVcsZ0JBQWlCO0FBQzdDLGFBQU8sTUFBTSxPQUFLO0FBQ2pCLGNBQU0sT0FBTyxLQUFLLEtBQUssS0FBSyxLQUFLLFNBQVMsQ0FBQztBQUczQyxZQUFJLENBQUMsUUFBUTtBQUVaLGNBQUksTUFBTTtBQUNULGlCQUFLLFFBQVEsS0FBSyxNQUFNLFNBQVMsS0FBSyxVQUFVLENBQUMsQ0FBQztBQUFBLFVBQ25ELE9BQU87QUFFTixxQkFBUyxLQUFLLFVBQVUsQ0FBQztBQUFBLFVBQzFCO0FBQ0E7QUFBQSxRQUNEO0FBR0EsY0FBTSxhQUFhO0FBWW5CLFlBQUksQ0FBQyxZQUFZO0FBRWhCLG1CQUFTLEtBQUssVUFBVSxPQUFPLFNBQVMsQ0FBQyxDQUFDO0FBQzFDO0FBQUEsUUFDRDtBQUdBLG1CQUFXLFVBQVUsQ0FBQztBQUN0QixtQkFBVyxNQUFNLEtBQUssQ0FBQztBQUN2QixZQUFJLFdBQVcsUUFBUSxXQUFXLEdBQUc7QUFFcEMsZUFBSyxRQUFRLEtBQUssTUFBTTtBQUV2Qix1QkFBVyxrQkFBa0IsVUFDMUIsV0FBVyxNQUFPLE9BQU8sUUFBZ0QsT0FBTyxJQUNoRixXQUFXLE1BQU8sT0FBTyxNQUE4QztBQUMxRSxxQkFBUyxLQUFLLFVBQVUsV0FBVyxhQUFhO0FBQUEsVUFDakQsQ0FBQztBQUFBLFFBQ0Y7QUFBQSxNQUNELEdBQUcsUUFBVyxXQUFXO0FBQUEsSUFDMUI7QUFBQSxFQUNEO0FBQUEsRUFFQSxhQUF1QixJQUFnQjtBQUN0QyxVQUFNLE9BQU8sRUFBRSxTQUFTLElBQUksTUFBZ0IsRUFBRTtBQUM5QyxTQUFLLEtBQUssS0FBSyxJQUFJO0FBQ25CLFVBQU0sSUFBSSxHQUFHO0FBQ2IsU0FBSyxLQUFLLElBQUk7QUFDZCxTQUFLLFFBQVEsUUFBUSxXQUFTLE1BQU0sQ0FBQztBQUNyQyxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBUU8sTUFBTSxNQUFnQztBQUFBLEVBQXRDO0FBRU4sU0FBUSxZQUFZO0FBQ3BCLFNBQVEsYUFBdUIsTUFBTTtBQUNyQyxTQUFRLHFCQUFrQyxXQUFXO0FBRXJELFNBQWlCLFVBQVUsSUFBSSxRQUFXO0FBQUEsTUFDekMsdUJBQXVCLE1BQU07QUFDNUIsYUFBSyxZQUFZO0FBQ2pCLGFBQUsscUJBQXFCLEtBQUssV0FBVyxLQUFLLFFBQVEsTUFBTSxLQUFLLE9BQU87QUFBQSxNQUMxRTtBQUFBLE1BQ0EseUJBQXlCLE1BQU07QUFDOUIsYUFBSyxZQUFZO0FBQ2pCLGFBQUssbUJBQW1CLFFBQVE7QUFBQSxNQUNqQztBQUFBLElBQ0QsQ0FBQztBQUVELFNBQVMsUUFBa0IsS0FBSyxRQUFRO0FBQUE7QUFBQSxFQUV4QyxJQUFJLE1BQU0sT0FBaUI7QUFDMUIsU0FBSyxhQUFhO0FBRWxCLFFBQUksS0FBSyxXQUFXO0FBQ25CLFdBQUssbUJBQW1CLFFBQVE7QUFDaEMsV0FBSyxxQkFBcUIsTUFBTSxLQUFLLFFBQVEsTUFBTSxLQUFLLE9BQU87QUFBQSxJQUNoRTtBQUFBLEVBQ0Q7QUFBQSxFQUVBLFVBQVU7QUFDVCxTQUFLLG1CQUFtQixRQUFRO0FBQ2hDLFNBQUssUUFBUSxRQUFRO0FBQUEsRUFDdEI7QUFDRDtBQU9PLE1BQU0scUJBQTREO0FBQUEsRUFReEUsWUFBb0IsUUFBVztBQUFYO0FBSHBCLFNBQWlCLGVBQWUsSUFBSSxRQUFjO0FBQ2xELFNBQVMsY0FBMkIsS0FBSyxhQUFhO0FBQUEsRUFFckI7QUFBQSxFQVBqQyxPQUFjLE1BQVMsT0FBb0M7QUFDMUQsV0FBTyxJQUFJLDBCQUEwQixLQUFLO0FBQUEsRUFDM0M7QUFBQSxFQU9BLElBQUksUUFBVztBQUNkLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVBLElBQUksTUFBTSxPQUFVO0FBQ25CLFFBQUksVUFBVSxLQUFLLFFBQVE7QUFDMUIsV0FBSyxTQUFTO0FBQ2QsV0FBSyxhQUFhLEtBQUssTUFBUztBQUFBLElBQ2pDO0FBQUEsRUFDRDtBQUNEO0FBRUEsTUFBTSwwQkFBaUU7QUFBQSxFQUd0RSxZQUFxQixPQUFVO0FBQVY7QUFGckIsU0FBZ0IsY0FBMkIsTUFBTTtBQUFBLEVBRWhCO0FBQ2xDO0FBTU8sU0FBUyxnQkFBbUIsU0FBK0IsaUJBQWlDLFlBQWdEO0FBQ2xKLFFBQU0sTUFBTSxJQUFJLGNBQThCO0FBQzlDLE1BQUksVUFBVSxJQUFJLElBQUksUUFBUSxDQUFDO0FBQy9CLGFBQVcsS0FBSyxTQUFTO0FBQ3hCLFFBQUksSUFBSSxHQUFHLFdBQVcsQ0FBQyxDQUFDO0FBQUEsRUFDekI7QUFFQSxRQUFNLFFBQVEsSUFBSSxnQkFBZ0I7QUFDbEMsUUFBTSxJQUFJLGdCQUFnQixNQUFNO0FBQy9CLFVBQU0sVUFBVSxRQUFRO0FBQ3hCLFVBQU0sT0FBTyxTQUFTLFNBQVMsT0FBTztBQUN0QyxlQUFXLEtBQUssS0FBSyxTQUFTO0FBQzdCLFVBQUksaUJBQWlCLENBQUM7QUFBQSxJQUN2QjtBQUNBLGVBQVcsS0FBSyxLQUFLLE9BQU87QUFDM0IsVUFBSSxJQUFJLEdBQUcsV0FBVyxDQUFDLENBQUM7QUFBQSxJQUN6QjtBQUNBLGNBQVUsSUFBSSxJQUFJLE9BQU87QUFBQSxFQUMxQixDQUFDLENBQUM7QUFDRixRQUFNLElBQUksR0FBRztBQUNiLFNBQU87QUFDUjsiLAogICJuYW1lcyI6IFsiRXZlbnQiLCAibWFwIiwgImZpbHRlciIsICJidWZmZXIiLCAiaWQiLCAiY291bnQiLCAiZGF0YSJdCn0K
