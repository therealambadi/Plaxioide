import { CancellationTokenSource } from "./cancellation.js";
import { BugIndicatingError, CancellationError } from "./errors.js";
import { Emitter, Event } from "./event.js";
import { Disposable, DisposableMap, MutableDisposable, toDisposable } from "./lifecycle.js";
import { extUri as defaultExtUri } from "./resources.js";
import { setTimeout0 } from "./platform.js";
import { MicrotaskDelay } from "./symbols.js";
import { Lazy } from "./lazy.js";
function isThenable(obj) {
  return !!obj && typeof obj.then === "function";
}
function createCancelablePromise(callback) {
  const source = new CancellationTokenSource();
  const thenable = callback(source.token);
  const promise = new Promise((resolve, reject) => {
    const subscription = source.token.onCancellationRequested(() => {
      subscription.dispose();
      reject(new CancellationError());
    });
    Promise.resolve(thenable).then((value) => {
      subscription.dispose();
      source.dispose();
      resolve(value);
    }, (err) => {
      subscription.dispose();
      source.dispose();
      reject(err);
    });
  });
  return new class {
    cancel() {
      source.cancel();
      source.dispose();
    }
    then(resolve, reject) {
      return promise.then(resolve, reject);
    }
    catch(reject) {
      return this.then(void 0, reject);
    }
    finally(onfinally) {
      return promise.finally(onfinally);
    }
  }();
}
function raceCancellation(promise, token, defaultValue) {
  return new Promise((resolve, reject) => {
    const ref = token.onCancellationRequested(() => {
      ref.dispose();
      resolve(defaultValue);
    });
    promise.then(resolve, reject).finally(() => ref.dispose());
  });
}
function raceCancellationError(promise, token) {
  return new Promise((resolve, reject) => {
    const ref = token.onCancellationRequested(() => {
      ref.dispose();
      reject(new CancellationError());
    });
    promise.then(resolve, reject).finally(() => ref.dispose());
  });
}
async function raceCancellablePromises(cancellablePromises) {
  let resolvedPromiseIndex = -1;
  const promises = cancellablePromises.map((promise, index) => promise.then((result) => {
    resolvedPromiseIndex = index;
    return result;
  }));
  try {
    const result = await Promise.race(promises);
    return result;
  } finally {
    cancellablePromises.forEach((cancellablePromise, index) => {
      if (index !== resolvedPromiseIndex) {
        cancellablePromise.cancel();
      }
    });
  }
}
function raceTimeout(promise, timeout2, onTimeout) {
  let promiseResolve = void 0;
  const timer = setTimeout(() => {
    promiseResolve?.(void 0);
    onTimeout?.();
  }, timeout2);
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((resolve) => promiseResolve = resolve)
  ]);
}
function raceFilter(promises, filter) {
  return new Promise((resolve, reject) => {
    if (promises.length === 0) {
      resolve(void 0);
      return;
    }
    let resolved = false;
    let unresolvedCount = promises.length;
    for (const promise of promises) {
      promise.then((result) => {
        unresolvedCount--;
        if (!resolved) {
          if (filter(result)) {
            resolved = true;
            resolve(result);
          } else if (unresolvedCount === 0) {
            resolve(void 0);
          }
        }
      }).catch(reject);
    }
  });
}
function asPromise(callback) {
  return new Promise((resolve, reject) => {
    const item = callback();
    if (isThenable(item)) {
      item.then(resolve, reject);
    } else {
      resolve(item);
    }
  });
}
function promiseWithResolvers() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
class Throttler {
  constructor() {
    this.isDisposed = false;
    this.activePromise = null;
    this.queuedPromise = null;
    this.queuedPromiseFactory = null;
  }
  queue(promiseFactory) {
    if (this.isDisposed) {
      return Promise.reject(new Error("Throttler is disposed"));
    }
    if (this.activePromise) {
      this.queuedPromiseFactory = promiseFactory;
      if (!this.queuedPromise) {
        const onComplete = () => {
          this.queuedPromise = null;
          if (this.isDisposed) {
            return;
          }
          const result = this.queue(this.queuedPromiseFactory);
          this.queuedPromiseFactory = null;
          return result;
        };
        this.queuedPromise = new Promise((resolve) => {
          this.activePromise.then(onComplete, onComplete).then(resolve);
        });
      }
      return new Promise((resolve, reject) => {
        this.queuedPromise.then(resolve, reject);
      });
    }
    this.activePromise = promiseFactory();
    return new Promise((resolve, reject) => {
      this.activePromise.then((result) => {
        this.activePromise = null;
        resolve(result);
      }, (err) => {
        this.activePromise = null;
        reject(err);
      });
    });
  }
  dispose() {
    this.isDisposed = true;
  }
}
class Sequencer {
  constructor() {
    this.current = Promise.resolve(null);
  }
  queue(promiseTask) {
    return this.current = this.current.then(() => promiseTask(), () => promiseTask());
  }
}
class SequencerByKey {
  constructor() {
    this.promiseMap = /* @__PURE__ */ new Map();
  }
  queue(key, promiseTask) {
    const runningPromise = this.promiseMap.get(key) ?? Promise.resolve();
    const newPromise = runningPromise.catch(() => {
    }).then(promiseTask).finally(() => {
      if (this.promiseMap.get(key) === newPromise) {
        this.promiseMap.delete(key);
      }
    });
    this.promiseMap.set(key, newPromise);
    return newPromise;
  }
  keys() {
    return this.promiseMap.keys();
  }
}
const timeoutDeferred = (timeout2, fn) => {
  let scheduled = true;
  const handle = setTimeout(() => {
    scheduled = false;
    fn();
  }, timeout2);
  return {
    isTriggered: () => scheduled,
    dispose: () => {
      clearTimeout(handle);
      scheduled = false;
    }
  };
};
const microtaskDeferred = (fn) => {
  let scheduled = true;
  queueMicrotask(() => {
    if (scheduled) {
      scheduled = false;
      fn();
    }
  });
  return {
    isTriggered: () => scheduled,
    dispose: () => {
      scheduled = false;
    }
  };
};
class Delayer {
  constructor(defaultDelay) {
    this.defaultDelay = defaultDelay;
    this.deferred = null;
    this.completionPromise = null;
    this.doResolve = null;
    this.doReject = null;
    this.task = null;
  }
  trigger(task, delay = this.defaultDelay) {
    this.task = task;
    this.cancelTimeout();
    if (!this.completionPromise) {
      this.completionPromise = new Promise((resolve, reject) => {
        this.doResolve = resolve;
        this.doReject = reject;
      }).then(() => {
        this.completionPromise = null;
        this.doResolve = null;
        if (this.task) {
          const task2 = this.task;
          this.task = null;
          return task2();
        }
        return void 0;
      });
    }
    const fn = () => {
      this.deferred = null;
      this.doResolve?.(null);
    };
    this.deferred = delay === MicrotaskDelay ? microtaskDeferred(fn) : timeoutDeferred(delay, fn);
    return this.completionPromise;
  }
  isTriggered() {
    return !!this.deferred?.isTriggered();
  }
  cancel() {
    this.cancelTimeout();
    if (this.completionPromise) {
      this.doReject?.(new CancellationError());
      this.completionPromise = null;
    }
  }
  cancelTimeout() {
    this.deferred?.dispose();
    this.deferred = null;
  }
  dispose() {
    this.cancel();
  }
}
class ThrottledDelayer {
  constructor(defaultDelay) {
    this.delayer = new Delayer(defaultDelay);
    this.throttler = new Throttler();
  }
  trigger(promiseFactory, delay) {
    return this.delayer.trigger(() => this.throttler.queue(promiseFactory), delay);
  }
  isTriggered() {
    return this.delayer.isTriggered();
  }
  cancel() {
    this.delayer.cancel();
  }
  dispose() {
    this.delayer.dispose();
    this.throttler.dispose();
  }
}
class Barrier {
  constructor() {
    this._isOpen = false;
    this._promise = new Promise((c, e) => {
      this._completePromise = c;
    });
  }
  isOpen() {
    return this._isOpen;
  }
  open() {
    this._isOpen = true;
    this._completePromise(true);
  }
  wait() {
    return this._promise;
  }
}
class AutoOpenBarrier extends Barrier {
  constructor(autoOpenTimeMs) {
    super();
    this._timeout = setTimeout(() => this.open(), autoOpenTimeMs);
  }
  open() {
    clearTimeout(this._timeout);
    super.open();
  }
}
function timeout(millis, token) {
  if (!token) {
    return createCancelablePromise((token2) => timeout(millis, token2));
  }
  return new Promise((resolve, reject) => {
    const handle = setTimeout(() => {
      disposable.dispose();
      resolve();
    }, millis);
    const disposable = token.onCancellationRequested(() => {
      clearTimeout(handle);
      disposable.dispose();
      reject(new CancellationError());
    });
  });
}
function disposableTimeout(handler, timeout2 = 0, store) {
  const timer = setTimeout(() => {
    handler();
    if (store) {
      disposable.dispose();
    }
  }, timeout2);
  const disposable = toDisposable(() => {
    clearTimeout(timer);
    store?.delete(disposable);
  });
  store?.add(disposable);
  return disposable;
}
function sequence(promiseFactories) {
  const results = [];
  let index = 0;
  const len = promiseFactories.length;
  function next() {
    return index < len ? promiseFactories[index++]() : null;
  }
  function thenHandler(result) {
    if (result !== void 0 && result !== null) {
      results.push(result);
    }
    const n = next();
    if (n) {
      return n.then(thenHandler);
    }
    return Promise.resolve(results);
  }
  return Promise.resolve(null).then(thenHandler);
}
function first(promiseFactories, shouldStop = (t) => !!t, defaultValue = null) {
  let index = 0;
  const len = promiseFactories.length;
  const loop = () => {
    if (index >= len) {
      return Promise.resolve(defaultValue);
    }
    const factory = promiseFactories[index++];
    const promise = Promise.resolve(factory());
    return promise.then((result) => {
      if (shouldStop(result)) {
        return Promise.resolve(result);
      }
      return loop();
    });
  };
  return loop();
}
function firstParallel(promiseList, shouldStop = (t) => !!t, defaultValue = null) {
  if (promiseList.length === 0) {
    return Promise.resolve(defaultValue);
  }
  let todo = promiseList.length;
  const finish = () => {
    todo = -1;
    for (const promise of promiseList) {
      promise.cancel?.();
    }
  };
  return new Promise((resolve, reject) => {
    for (const promise of promiseList) {
      promise.then((result) => {
        if (--todo >= 0 && shouldStop(result)) {
          finish();
          resolve(result);
        } else if (todo === 0) {
          resolve(defaultValue);
        }
      }).catch((err) => {
        if (--todo >= 0) {
          finish();
          reject(err);
        }
      });
    }
  });
}
class Limiter {
  constructor(maxDegreeOfParalellism) {
    this._size = 0;
    this._isDisposed = false;
    this.maxDegreeOfParalellism = maxDegreeOfParalellism;
    this.outstandingPromises = [];
    this.runningPromises = 0;
    this._onDrained = new Emitter();
  }
  /**
   *
   * @returns A promise that resolved when all work is done (onDrained) or when
   * there is nothing to do
   */
  whenIdle() {
    return this.size > 0 ? Event.toPromise(this.onDrained) : Promise.resolve();
  }
  get onDrained() {
    return this._onDrained.event;
  }
  get size() {
    return this._size;
  }
  queue(factory) {
    if (this._isDisposed) {
      throw new Error("Object has been disposed");
    }
    this._size++;
    return new Promise((c, e) => {
      this.outstandingPromises.push({ factory, c, e });
      this.consume();
    });
  }
  consume() {
    while (this.outstandingPromises.length && this.runningPromises < this.maxDegreeOfParalellism) {
      const iLimitedTask = this.outstandingPromises.shift();
      this.runningPromises++;
      const promise = iLimitedTask.factory();
      promise.then(iLimitedTask.c, iLimitedTask.e);
      promise.then(() => this.consumed(), () => this.consumed());
    }
  }
  consumed() {
    if (this._isDisposed) {
      return;
    }
    this.runningPromises--;
    if (--this._size === 0) {
      this._onDrained.fire();
    }
    if (this.outstandingPromises.length > 0) {
      this.consume();
    }
  }
  clear() {
    if (this._isDisposed) {
      throw new Error("Object has been disposed");
    }
    this.outstandingPromises.length = 0;
    this._size = this.runningPromises;
  }
  dispose() {
    this._isDisposed = true;
    this.outstandingPromises.length = 0;
    this._size = 0;
    this._onDrained.dispose();
  }
}
class Queue extends Limiter {
  constructor() {
    super(1);
  }
}
class LimitedQueue {
  constructor() {
    this.sequentializer = new TaskSequentializer();
    this.tasks = 0;
  }
  queue(factory) {
    if (!this.sequentializer.isRunning()) {
      return this.sequentializer.run(this.tasks++, factory());
    }
    return this.sequentializer.queue(() => {
      return this.sequentializer.run(this.tasks++, factory());
    });
  }
}
class ResourceQueue {
  constructor() {
    this.queues = /* @__PURE__ */ new Map();
    this.drainers = /* @__PURE__ */ new Set();
    this.drainListeners = void 0;
    this.drainListenerCount = 0;
  }
  async whenDrained() {
    if (this.isDrained()) {
      return;
    }
    const promise = new DeferredPromise();
    this.drainers.add(promise);
    return promise.p;
  }
  isDrained() {
    for (const [, queue] of this.queues) {
      if (queue.size > 0) {
        return false;
      }
    }
    return true;
  }
  queueSize(resource, extUri = defaultExtUri) {
    const key = extUri.getComparisonKey(resource);
    return this.queues.get(key)?.size ?? 0;
  }
  queueFor(resource, factory, extUri = defaultExtUri) {
    const key = extUri.getComparisonKey(resource);
    let queue = this.queues.get(key);
    if (!queue) {
      queue = new Queue();
      const drainListenerId = this.drainListenerCount++;
      const drainListener = Event.once(queue.onDrained)(() => {
        queue?.dispose();
        this.queues.delete(key);
        this.onDidQueueDrain();
        this.drainListeners?.deleteAndDispose(drainListenerId);
        if (this.drainListeners?.size === 0) {
          this.drainListeners.dispose();
          this.drainListeners = void 0;
        }
      });
      if (!this.drainListeners) {
        this.drainListeners = new DisposableMap();
      }
      this.drainListeners.set(drainListenerId, drainListener);
      this.queues.set(key, queue);
    }
    return queue.queue(factory);
  }
  onDidQueueDrain() {
    if (!this.isDrained()) {
      return;
    }
    this.releaseDrainers();
  }
  releaseDrainers() {
    for (const drainer of this.drainers) {
      drainer.complete();
    }
    this.drainers.clear();
  }
  dispose() {
    for (const [, queue] of this.queues) {
      queue.dispose();
    }
    this.queues.clear();
    this.releaseDrainers();
    this.drainListeners?.dispose();
  }
}
class TimeoutTimer {
  constructor(runner, timeout2) {
    this._isDisposed = false;
    this._token = -1;
    if (typeof runner === "function" && typeof timeout2 === "number") {
      this.setIfNotSet(runner, timeout2);
    }
  }
  dispose() {
    this.cancel();
    this._isDisposed = true;
  }
  cancel() {
    if (this._token !== -1) {
      clearTimeout(this._token);
      this._token = -1;
    }
  }
  cancelAndSet(runner, timeout2) {
    if (this._isDisposed) {
      throw new BugIndicatingError(`Calling 'cancelAndSet' on a disposed TimeoutTimer`);
    }
    this.cancel();
    this._token = setTimeout(() => {
      this._token = -1;
      runner();
    }, timeout2);
  }
  setIfNotSet(runner, timeout2) {
    if (this._isDisposed) {
      throw new BugIndicatingError(`Calling 'setIfNotSet' on a disposed TimeoutTimer`);
    }
    if (this._token !== -1) {
      return;
    }
    this._token = setTimeout(() => {
      this._token = -1;
      runner();
    }, timeout2);
  }
}
class IntervalTimer {
  constructor() {
    this.disposable = void 0;
    this.isDisposed = false;
  }
  cancel() {
    this.disposable?.dispose();
    this.disposable = void 0;
  }
  cancelAndSet(runner, interval, context = globalThis) {
    if (this.isDisposed) {
      throw new BugIndicatingError(`Calling 'cancelAndSet' on a disposed IntervalTimer`);
    }
    this.cancel();
    const handle = context.setInterval(() => {
      runner();
    }, interval);
    this.disposable = toDisposable(() => {
      context.clearInterval(handle);
      this.disposable = void 0;
    });
  }
  dispose() {
    this.cancel();
    this.isDisposed = true;
  }
}
class RunOnceScheduler {
  constructor(runner, delay) {
    this.timeoutToken = -1;
    this.runner = runner;
    this.timeout = delay;
    this.timeoutHandler = this.onTimeout.bind(this);
  }
  /**
   * Dispose RunOnceScheduler
   */
  dispose() {
    this.cancel();
    this.runner = null;
  }
  /**
   * Cancel current scheduled runner (if any).
   */
  cancel() {
    if (this.isScheduled()) {
      clearTimeout(this.timeoutToken);
      this.timeoutToken = -1;
    }
  }
  /**
   * Cancel previous runner (if any) & schedule a new runner.
   */
  schedule(delay = this.timeout) {
    this.cancel();
    this.timeoutToken = setTimeout(this.timeoutHandler, delay);
  }
  get delay() {
    return this.timeout;
  }
  set delay(value) {
    this.timeout = value;
  }
  /**
   * Returns true if scheduled.
   */
  isScheduled() {
    return this.timeoutToken !== -1;
  }
  flush() {
    if (this.isScheduled()) {
      this.cancel();
      this.doRun();
    }
  }
  onTimeout() {
    this.timeoutToken = -1;
    if (this.runner) {
      this.doRun();
    }
  }
  doRun() {
    this.runner?.();
  }
}
class ProcessTimeRunOnceScheduler {
  constructor(runner, delay) {
    if (delay % 1e3 !== 0) {
      console.warn(`ProcessTimeRunOnceScheduler resolution is 1s, ${delay}ms is not a multiple of 1000ms.`);
    }
    this.runner = runner;
    this.timeout = delay;
    this.counter = 0;
    this.intervalToken = -1;
    this.intervalHandler = this.onInterval.bind(this);
  }
  dispose() {
    this.cancel();
    this.runner = null;
  }
  cancel() {
    if (this.isScheduled()) {
      clearInterval(this.intervalToken);
      this.intervalToken = -1;
    }
  }
  /**
   * Cancel previous runner (if any) & schedule a new runner.
   */
  schedule(delay = this.timeout) {
    if (delay % 1e3 !== 0) {
      console.warn(`ProcessTimeRunOnceScheduler resolution is 1s, ${delay}ms is not a multiple of 1000ms.`);
    }
    this.cancel();
    this.counter = Math.ceil(delay / 1e3);
    this.intervalToken = setInterval(this.intervalHandler, 1e3);
  }
  /**
   * Returns true if scheduled.
   */
  isScheduled() {
    return this.intervalToken !== -1;
  }
  onInterval() {
    this.counter--;
    if (this.counter > 0) {
      return;
    }
    clearInterval(this.intervalToken);
    this.intervalToken = -1;
    this.runner?.();
  }
}
class RunOnceWorker extends RunOnceScheduler {
  constructor(runner, timeout2) {
    super(runner, timeout2);
    this.units = [];
  }
  work(unit) {
    this.units.push(unit);
    if (!this.isScheduled()) {
      this.schedule();
    }
  }
  doRun() {
    const units = this.units;
    this.units = [];
    this.runner?.(units);
  }
  dispose() {
    this.units = [];
    super.dispose();
  }
}
class ThrottledWorker extends Disposable {
  constructor(options, handler) {
    super();
    this.options = options;
    this.handler = handler;
    this.pendingWork = [];
    this.throttler = this._register(new MutableDisposable());
    this.disposed = false;
    this.lastExecutionTime = 0;
  }
  /**
   * The number of work units that are pending to be processed.
   */
  get pending() {
    return this.pendingWork.length;
  }
  /**
   * Add units to be worked on. Use `pending` to figure out
   * how many units are not yet processed after this method
   * was called.
   *
   * @returns whether the work was accepted or not. If the
   * worker is disposed, it will not accept any more work.
   * If the number of pending units would become larger
   * than `maxPendingWork`, more work will also not be accepted.
   */
  work(units) {
    if (this.disposed) {
      return false;
    }
    if (typeof this.options.maxBufferedWork === "number") {
      if (this.throttler.value) {
        if (this.pending + units.length > this.options.maxBufferedWork) {
          return false;
        }
      } else {
        if (this.pending + units.length - this.options.maxWorkChunkSize > this.options.maxBufferedWork) {
          return false;
        }
      }
    }
    for (const unit of units) {
      this.pendingWork.push(unit);
    }
    const timeSinceLastExecution = Date.now() - this.lastExecutionTime;
    if (!this.throttler.value && (!this.options.waitThrottleDelayBetweenWorkUnits || timeSinceLastExecution >= this.options.throttleDelay)) {
      this.doWork();
    } else if (!this.throttler.value && this.options.waitThrottleDelayBetweenWorkUnits) {
      this.scheduleThrottler(Math.max(this.options.throttleDelay - timeSinceLastExecution, 0));
    } else {
    }
    return true;
  }
  doWork() {
    this.lastExecutionTime = Date.now();
    this.handler(this.pendingWork.splice(0, this.options.maxWorkChunkSize));
    if (this.pendingWork.length > 0) {
      this.scheduleThrottler();
    }
  }
  scheduleThrottler(delay = this.options.throttleDelay) {
    this.throttler.value = new RunOnceScheduler(() => {
      this.throttler.clear();
      this.doWork();
    }, delay);
    this.throttler.value.schedule();
  }
  dispose() {
    super.dispose();
    this.disposed = true;
  }
}
let runWhenGlobalIdle;
let _runWhenIdle;
(function() {
  if (typeof globalThis.requestIdleCallback !== "function" || typeof globalThis.cancelIdleCallback !== "function") {
    _runWhenIdle = (_targetWindow, runner, timeout2) => {
      setTimeout0(() => {
        if (disposed) {
          return;
        }
        const end = Date.now() + 15;
        const deadline = {
          didTimeout: true,
          timeRemaining() {
            return Math.max(0, end - Date.now());
          }
        };
        runner(Object.freeze(deadline));
      });
      let disposed = false;
      return {
        dispose() {
          if (disposed) {
            return;
          }
          disposed = true;
        }
      };
    };
  } else {
    _runWhenIdle = (targetWindow, runner, timeout2) => {
      const handle = targetWindow.requestIdleCallback(runner, typeof timeout2 === "number" ? { timeout: timeout2 } : void 0);
      let disposed = false;
      return {
        dispose() {
          if (disposed) {
            return;
          }
          disposed = true;
          targetWindow.cancelIdleCallback(handle);
        }
      };
    };
  }
  runWhenGlobalIdle = (runner, timeout2) => _runWhenIdle(globalThis, runner, timeout2);
})();
class AbstractIdleValue {
  constructor(targetWindow, executor) {
    this._didRun = false;
    this._executor = () => {
      try {
        this._value = executor();
      } catch (err) {
        this._error = err;
      } finally {
        this._didRun = true;
      }
    };
    this._handle = _runWhenIdle(targetWindow, () => this._executor());
  }
  dispose() {
    this._handle.dispose();
  }
  get value() {
    if (!this._didRun) {
      this._handle.dispose();
      this._executor();
    }
    if (this._error) {
      throw this._error;
    }
    return this._value;
  }
  get isInitialized() {
    return this._didRun;
  }
}
class GlobalIdleValue extends AbstractIdleValue {
  constructor(executor) {
    super(globalThis, executor);
  }
}
async function retry(task, delay, retries) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      await timeout(delay);
    }
  }
  throw lastError;
}
class TaskSequentializer {
  isRunning(taskId) {
    if (typeof taskId === "number") {
      return this._running?.taskId === taskId;
    }
    return !!this._running;
  }
  get running() {
    return this._running?.promise;
  }
  cancelRunning() {
    this._running?.cancel();
  }
  run(taskId, promise, onCancel) {
    this._running = { taskId, cancel: () => onCancel?.(), promise };
    promise.then(() => this.doneRunning(taskId), () => this.doneRunning(taskId));
    return promise;
  }
  doneRunning(taskId) {
    if (this._running && taskId === this._running.taskId) {
      this._running = void 0;
      this.runQueued();
    }
  }
  runQueued() {
    if (this._queued) {
      const queued = this._queued;
      this._queued = void 0;
      queued.run().then(queued.promiseResolve, queued.promiseReject);
    }
  }
  /**
   * Note: the promise to schedule as next run MUST itself call `run`.
   *       Otherwise, this sequentializer will report `false` for `isRunning`
   *       even when this task is running. Missing this detail means that
   *       suddenly multiple tasks will run in parallel.
   */
  queue(run) {
    if (!this._queued) {
      const { promise, resolve: promiseResolve, reject: promiseReject } = promiseWithResolvers();
      this._queued = {
        run,
        promise,
        promiseResolve,
        promiseReject
      };
    } else {
      this._queued.run = run;
    }
    return this._queued.promise;
  }
  hasQueued() {
    return !!this._queued;
  }
  async join() {
    return this._queued?.promise ?? this._running?.promise;
  }
}
class IntervalCounter {
  constructor(interval, nowFn = () => Date.now()) {
    this.interval = interval;
    this.nowFn = nowFn;
    this.lastIncrementTime = 0;
    this.value = 0;
  }
  increment() {
    const now = this.nowFn();
    if (now - this.lastIncrementTime > this.interval) {
      this.lastIncrementTime = now;
      this.value = 0;
    }
    this.value++;
    return this.value;
  }
}
var DeferredOutcome = /* @__PURE__ */ ((DeferredOutcome2) => {
  DeferredOutcome2[DeferredOutcome2["Resolved"] = 0] = "Resolved";
  DeferredOutcome2[DeferredOutcome2["Rejected"] = 1] = "Rejected";
  return DeferredOutcome2;
})(DeferredOutcome || {});
class DeferredPromise {
  get isRejected() {
    return this.outcome?.outcome === 1 /* Rejected */;
  }
  get isResolved() {
    return this.outcome?.outcome === 0 /* Resolved */;
  }
  get isSettled() {
    return !!this.outcome;
  }
  get value() {
    return this.outcome?.outcome === 0 /* Resolved */ ? this.outcome?.value : void 0;
  }
  constructor() {
    this.p = new Promise((c, e) => {
      this.completeCallback = c;
      this.errorCallback = e;
    });
  }
  complete(value) {
    return new Promise((resolve) => {
      this.completeCallback(value);
      this.outcome = { outcome: 0 /* Resolved */, value };
      resolve();
    });
  }
  error(err) {
    return new Promise((resolve) => {
      this.errorCallback(err);
      this.outcome = { outcome: 1 /* Rejected */, value: err };
      resolve();
    });
  }
  cancel() {
    return this.error(new CancellationError());
  }
}
var Promises;
((Promises2) => {
  async function settled(promises) {
    let firstError = void 0;
    const result = await Promise.all(promises.map((promise) => promise.then((value) => value, (error) => {
      if (!firstError) {
        firstError = error;
      }
      return void 0;
    })));
    if (typeof firstError !== "undefined") {
      throw firstError;
    }
    return result;
  }
  Promises2.settled = settled;
  function withAsyncBody(bodyFn) {
    return new Promise(async (resolve, reject) => {
      try {
        await bodyFn(resolve, reject);
      } catch (error) {
        reject(error);
      }
    });
  }
  Promises2.withAsyncBody = withAsyncBody;
})(Promises || (Promises = {}));
class StatefulPromise {
  constructor(promise) {
    this._value = void 0;
    this._error = void 0;
    this._isResolved = false;
    this.promise = promise.then(
      (value) => {
        this._value = value;
        this._isResolved = true;
        return value;
      },
      (error) => {
        this._error = error;
        this._isResolved = true;
        throw error;
      }
    );
  }
  get value() {
    return this._value;
  }
  get error() {
    return this._error;
  }
  get isResolved() {
    return this._isResolved;
  }
  /**
   * Returns the resolved value.
   * Throws if the promise is not resolved yet.
   */
  requireValue() {
    if (!this._isResolved) {
      throw new BugIndicatingError("Promise is not resolved yet");
    }
    if (this._error) {
      throw this._error;
    }
    return this._value;
  }
}
class LazyStatefulPromise {
  constructor(_compute) {
    this._compute = _compute;
    this._promise = new Lazy(() => new StatefulPromise(this._compute()));
  }
  /**
   * Returns the resolved value.
   * Throws if the promise is not resolved yet.
   */
  requireValue() {
    return this._promise.value.requireValue();
  }
  /**
   * Returns the promise (and triggers a computation of the promise if not yet done so).
   */
  getPromise() {
    return this._promise.value.promise;
  }
  /**
   * Reads the current value without triggering a computation of the promise.
   */
  get currentValue() {
    return this._promise.rawValue?.value;
  }
}
var AsyncIterableSourceState = /* @__PURE__ */ ((AsyncIterableSourceState2) => {
  AsyncIterableSourceState2[AsyncIterableSourceState2["Initial"] = 0] = "Initial";
  AsyncIterableSourceState2[AsyncIterableSourceState2["DoneOK"] = 1] = "DoneOK";
  AsyncIterableSourceState2[AsyncIterableSourceState2["DoneError"] = 2] = "DoneError";
  return AsyncIterableSourceState2;
})(AsyncIterableSourceState || {});
const _AsyncIterableObject = class _AsyncIterableObject {
  static fromArray(items) {
    return new _AsyncIterableObject((writer) => {
      writer.emitMany(items);
    });
  }
  static fromPromise(promise) {
    return new _AsyncIterableObject(async (emitter) => {
      emitter.emitMany(await promise);
    });
  }
  static fromPromisesResolveOrder(promises) {
    return new _AsyncIterableObject(async (emitter) => {
      await Promise.all(promises.map(async (p) => emitter.emitOne(await p)));
    });
  }
  static merge(iterables) {
    return new _AsyncIterableObject(async (emitter) => {
      await Promise.all(iterables.map(async (iterable) => {
        for await (const item of iterable) {
          emitter.emitOne(item);
        }
      }));
    });
  }
  constructor(executor, onReturn) {
    this._state = 0 /* Initial */;
    this._results = [];
    this._error = null;
    this._onReturn = onReturn;
    this._onStateChanged = new Emitter();
    queueMicrotask(async () => {
      const writer = {
        emitOne: (item) => this.emitOne(item),
        emitMany: (items) => this.emitMany(items),
        reject: (error) => this.reject(error)
      };
      try {
        await Promise.resolve(executor(writer));
        this.resolve();
      } catch (err) {
        this.reject(err);
      } finally {
        writer.emitOne = void 0;
        writer.emitMany = void 0;
        writer.reject = void 0;
      }
    });
  }
  [Symbol.asyncIterator]() {
    let i = 0;
    return {
      next: async () => {
        do {
          if (this._state === 2 /* DoneError */) {
            throw this._error;
          }
          if (i < this._results.length) {
            return { done: false, value: this._results[i++] };
          }
          if (this._state === 1 /* DoneOK */) {
            return { done: true, value: void 0 };
          }
          await Event.toPromise(this._onStateChanged.event);
        } while (true);
      },
      return: async () => {
        this._onReturn?.();
        return { done: true, value: void 0 };
      }
    };
  }
  static map(iterable, mapFn) {
    return new _AsyncIterableObject(async (emitter) => {
      for await (const item of iterable) {
        emitter.emitOne(mapFn(item));
      }
    });
  }
  map(mapFn) {
    return _AsyncIterableObject.map(this, mapFn);
  }
  static filter(iterable, filterFn) {
    return new _AsyncIterableObject(async (emitter) => {
      for await (const item of iterable) {
        if (filterFn(item)) {
          emitter.emitOne(item);
        }
      }
    });
  }
  filter(filterFn) {
    return _AsyncIterableObject.filter(this, filterFn);
  }
  static coalesce(iterable) {
    return _AsyncIterableObject.filter(iterable, (item) => !!item);
  }
  coalesce() {
    return _AsyncIterableObject.coalesce(this);
  }
  static async toPromise(iterable) {
    const result = [];
    for await (const item of iterable) {
      result.push(item);
    }
    return result;
  }
  toPromise() {
    return _AsyncIterableObject.toPromise(this);
  }
  /**
   * The value will be appended at the end.
   *
   * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
   */
  emitOne(value) {
    if (this._state !== 0 /* Initial */) {
      return;
    }
    this._results.push(value);
    this._onStateChanged.fire();
  }
  /**
   * The values will be appended at the end.
   *
   * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
   */
  emitMany(values) {
    if (this._state !== 0 /* Initial */) {
      return;
    }
    this._results = this._results.concat(values);
    this._onStateChanged.fire();
  }
  /**
   * Calling `resolve()` will mark the result array as complete.
   *
   * **NOTE** `resolve()` must be called, otherwise all consumers of this iterable will hang indefinitely, similar to a non-resolved promise.
   * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
   */
  resolve() {
    if (this._state !== 0 /* Initial */) {
      return;
    }
    this._state = 1 /* DoneOK */;
    this._onStateChanged.fire();
  }
  /**
   * Writing an error will permanently invalidate this iterable.
   * The current users will receive an error thrown, as will all future users.
   *
   * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
   */
  reject(error) {
    if (this._state !== 0 /* Initial */) {
      return;
    }
    this._state = 2 /* DoneError */;
    this._error = error;
    this._onStateChanged.fire();
  }
};
_AsyncIterableObject.EMPTY = _AsyncIterableObject.fromArray([]);
let AsyncIterableObject = _AsyncIterableObject;
class CancelableAsyncIterableObject extends AsyncIterableObject {
  constructor(_source, executor) {
    super(executor);
    this._source = _source;
  }
  cancel() {
    this._source.cancel();
  }
}
function createCancelableAsyncIterable(callback) {
  const source = new CancellationTokenSource();
  const innerIterable = callback(source.token);
  return new CancelableAsyncIterableObject(source, async (emitter) => {
    const subscription = source.token.onCancellationRequested(() => {
      subscription.dispose();
      source.dispose();
      emitter.reject(new CancellationError());
    });
    try {
      for await (const item of innerIterable) {
        if (source.token.isCancellationRequested) {
          return;
        }
        emitter.emitOne(item);
      }
      subscription.dispose();
      source.dispose();
    } catch (err) {
      subscription.dispose();
      source.dispose();
      emitter.reject(err);
    }
  });
}
class AsyncIterableSource {
  /**
   *
   * @param onReturn A function that will be called when consuming the async iterable
   * has finished by the consumer, e.g the for-await-loop has be existed (break, return) early.
   * This is NOT called when resolving this source by its owner.
   */
  constructor(onReturn) {
    this._deferred = new DeferredPromise();
    this._asyncIterable = new AsyncIterableObject((emitter) => {
      if (earlyError) {
        emitter.reject(earlyError);
        return;
      }
      if (earlyItems) {
        emitter.emitMany(earlyItems);
      }
      this._errorFn = (error) => emitter.reject(error);
      this._emitFn = (item) => emitter.emitOne(item);
      return this._deferred.p;
    }, onReturn);
    let earlyError;
    let earlyItems;
    this._emitFn = (item) => {
      if (!earlyItems) {
        earlyItems = [];
      }
      earlyItems.push(item);
    };
    this._errorFn = (error) => {
      if (!earlyError) {
        earlyError = error;
      }
    };
  }
  get asyncIterable() {
    return this._asyncIterable;
  }
  resolve() {
    this._deferred.complete();
  }
  reject(error) {
    this._errorFn(error);
    this._deferred.complete();
  }
  emitOne(item) {
    this._emitFn(item);
  }
}
export {
  AbstractIdleValue,
  AsyncIterableObject,
  AsyncIterableSource,
  AutoOpenBarrier,
  Barrier,
  CancelableAsyncIterableObject,
  DeferredPromise,
  Delayer,
  GlobalIdleValue,
  IntervalCounter,
  IntervalTimer,
  LazyStatefulPromise,
  LimitedQueue,
  Limiter,
  ProcessTimeRunOnceScheduler,
  Promises,
  Queue,
  ResourceQueue,
  RunOnceScheduler,
  RunOnceWorker,
  Sequencer,
  SequencerByKey,
  StatefulPromise,
  TaskSequentializer,
  ThrottledDelayer,
  ThrottledWorker,
  Throttler,
  TimeoutTimer,
  _runWhenIdle,
  asPromise,
  createCancelableAsyncIterable,
  createCancelablePromise,
  disposableTimeout,
  first,
  firstParallel,
  isThenable,
  promiseWithResolvers,
  raceCancellablePromises,
  raceCancellation,
  raceCancellationError,
  raceFilter,
  raceTimeout,
  retry,
  runWhenGlobalIdle,
  sequence,
  timeout
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9hc3luYy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IEJ1Z0luZGljYXRpbmdFcnJvciwgQ2FuY2VsbGF0aW9uRXJyb3IgfSBmcm9tICcuL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZU1hcCwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGV4dFVyaSBhcyBkZWZhdWx0RXh0VXJpLCBJRXh0VXJpIH0gZnJvbSAnLi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi91cmkuanMnO1xuaW1wb3J0IHsgc2V0VGltZW91dDAgfSBmcm9tICcuL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IE1pY3JvdGFza0RlbGF5IH0gZnJvbSAnLi9zeW1ib2xzLmpzJztcbmltcG9ydCB7IExhenkgfSBmcm9tICcuL2xhenkuanMnO1xuXG5leHBvcnQgZnVuY3Rpb24gaXNUaGVuYWJsZTxUPihvYmo6IHVua25vd24pOiBvYmogaXMgUHJvbWlzZTxUPiB7XG5cdHJldHVybiAhIW9iaiAmJiB0eXBlb2YgKG9iaiBhcyB1bmtub3duIGFzIFByb21pc2U8VD4pLnRoZW4gPT09ICdmdW5jdGlvbic7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2FuY2VsYWJsZVByb21pc2U8VD4gZXh0ZW5kcyBQcm9taXNlPFQ+IHtcblx0Y2FuY2VsKCk6IHZvaWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZTxUPihjYWxsYmFjazogKHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikgPT4gUHJvbWlzZTxUPik6IENhbmNlbGFibGVQcm9taXNlPFQ+IHtcblx0Y29uc3Qgc291cmNlID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cblx0Y29uc3QgdGhlbmFibGUgPSBjYWxsYmFjayhzb3VyY2UudG9rZW4pO1xuXHRjb25zdCBwcm9taXNlID0gbmV3IFByb21pc2U8VD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdGNvbnN0IHN1YnNjcmlwdGlvbiA9IHNvdXJjZS50b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiB7XG5cdFx0XHRzdWJzY3JpcHRpb24uZGlzcG9zZSgpO1xuXHRcdFx0cmVqZWN0KG5ldyBDYW5jZWxsYXRpb25FcnJvcigpKTtcblx0XHR9KTtcblx0XHRQcm9taXNlLnJlc29sdmUodGhlbmFibGUpLnRoZW4odmFsdWUgPT4ge1xuXHRcdFx0c3Vic2NyaXB0aW9uLmRpc3Bvc2UoKTtcblx0XHRcdHNvdXJjZS5kaXNwb3NlKCk7XG5cdFx0XHRyZXNvbHZlKHZhbHVlKTtcblx0XHR9LCBlcnIgPT4ge1xuXHRcdFx0c3Vic2NyaXB0aW9uLmRpc3Bvc2UoKTtcblx0XHRcdHNvdXJjZS5kaXNwb3NlKCk7XG5cdFx0XHRyZWplY3QoZXJyKTtcblx0XHR9KTtcblx0fSk7XG5cblx0cmV0dXJuIDxDYW5jZWxhYmxlUHJvbWlzZTxUPj5uZXcgY2xhc3Mge1xuXHRcdGNhbmNlbCgpIHtcblx0XHRcdHNvdXJjZS5jYW5jZWwoKTtcblx0XHRcdHNvdXJjZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHRcdHRoZW48VFJlc3VsdDEgPSBULCBUUmVzdWx0MiA9IG5ldmVyPihyZXNvbHZlPzogKCh2YWx1ZTogVCkgPT4gVFJlc3VsdDEgfCBQcm9taXNlPFRSZXN1bHQxPikgfCB1bmRlZmluZWQgfCBudWxsLCByZWplY3Q/OiAoKHJlYXNvbjogYW55KSA9PiBUUmVzdWx0MiB8IFByb21pc2U8VFJlc3VsdDI+KSB8IHVuZGVmaW5lZCB8IG51bGwpOiBQcm9taXNlPFRSZXN1bHQxIHwgVFJlc3VsdDI+IHtcblx0XHRcdHJldHVybiBwcm9taXNlLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcblx0XHR9XG5cdFx0Y2F0Y2g8VFJlc3VsdCA9IG5ldmVyPihyZWplY3Q/OiAoKHJlYXNvbjogYW55KSA9PiBUUmVzdWx0IHwgUHJvbWlzZTxUUmVzdWx0PikgfCB1bmRlZmluZWQgfCBudWxsKTogUHJvbWlzZTxUIHwgVFJlc3VsdD4ge1xuXHRcdFx0cmV0dXJuIHRoaXMudGhlbih1bmRlZmluZWQsIHJlamVjdCk7XG5cdFx0fVxuXHRcdGZpbmFsbHkob25maW5hbGx5PzogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkIHwgbnVsbCk6IFByb21pc2U8VD4ge1xuXHRcdFx0cmV0dXJuIHByb21pc2UuZmluYWxseShvbmZpbmFsbHkpO1xuXHRcdH1cblx0fTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggYHVuZGVmaW5lZGAgYXMgc29vbiBhcyB0aGUgcGFzc2VkIHRva2VuIGlzIGNhbmNlbGxlZC5cbiAqIEBzZWUge0BsaW5rIHJhY2VDYW5jZWxsYXRpb25FcnJvcn1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJhY2VDYW5jZWxsYXRpb248VD4ocHJvbWlzZTogUHJvbWlzZTxUPiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxUIHwgdW5kZWZpbmVkPjtcblxuLyoqXG4gKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggYGRlZmF1bHRWYWx1ZWAgYXMgc29vbiBhcyB0aGUgcGFzc2VkIHRva2VuIGlzIGNhbmNlbGxlZC5cbiAqIEBzZWUge0BsaW5rIHJhY2VDYW5jZWxsYXRpb25FcnJvcn1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJhY2VDYW5jZWxsYXRpb248VD4ocHJvbWlzZTogUHJvbWlzZTxUPiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuLCBkZWZhdWx0VmFsdWU6IFQpOiBQcm9taXNlPFQ+O1xuXG5leHBvcnQgZnVuY3Rpb24gcmFjZUNhbmNlbGxhdGlvbjxUPihwcm9taXNlOiBQcm9taXNlPFQ+LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIGRlZmF1bHRWYWx1ZT86IFQpOiBQcm9taXNlPFQgfCB1bmRlZmluZWQ+IHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRjb25zdCByZWYgPSB0b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiB7XG5cdFx0XHRyZWYuZGlzcG9zZSgpO1xuXHRcdFx0cmVzb2x2ZShkZWZhdWx0VmFsdWUpO1xuXHRcdH0pO1xuXHRcdHByb21pc2UudGhlbihyZXNvbHZlLCByZWplY3QpLmZpbmFsbHkoKCkgPT4gcmVmLmRpc3Bvc2UoKSk7XG5cdH0pO1xufVxuXG4vKipcbiAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVqZWN0cyB3aXRoIGFuIHtAQ2FuY2VsbGF0aW9uRXJyb3J9IGFzIHNvb24gYXMgdGhlIHBhc3NlZCB0b2tlbiBpcyBjYW5jZWxsZWQuXG4gKiBAc2VlIHtAbGluayByYWNlQ2FuY2VsbGF0aW9ufVxuICovXG5leHBvcnQgZnVuY3Rpb24gcmFjZUNhbmNlbGxhdGlvbkVycm9yPFQ+KHByb21pc2U6IFByb21pc2U8VD4sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8VD4ge1xuXHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdGNvbnN0IHJlZiA9IHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHtcblx0XHRcdHJlZi5kaXNwb3NlKCk7XG5cdFx0XHRyZWplY3QobmV3IENhbmNlbGxhdGlvbkVycm9yKCkpO1xuXHRcdH0pO1xuXHRcdHByb21pc2UudGhlbihyZXNvbHZlLCByZWplY3QpLmZpbmFsbHkoKCkgPT4gcmVmLmRpc3Bvc2UoKSk7XG5cdH0pO1xufVxuXG4vKipcbiAqIFJldHVybnMgYXMgc29vbiBhcyBvbmUgb2YgdGhlIHByb21pc2VzIHJlc29sdmVzIG9yIHJlamVjdHMgYW5kIGNhbmNlbHMgcmVtYWluaW5nIHByb21pc2VzXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByYWNlQ2FuY2VsbGFibGVQcm9taXNlczxUPihjYW5jZWxsYWJsZVByb21pc2VzOiBDYW5jZWxhYmxlUHJvbWlzZTxUPltdKTogUHJvbWlzZTxUPiB7XG5cdGxldCByZXNvbHZlZFByb21pc2VJbmRleCA9IC0xO1xuXHRjb25zdCBwcm9taXNlcyA9IGNhbmNlbGxhYmxlUHJvbWlzZXMubWFwKChwcm9taXNlLCBpbmRleCkgPT4gcHJvbWlzZS50aGVuKHJlc3VsdCA9PiB7IHJlc29sdmVkUHJvbWlzZUluZGV4ID0gaW5kZXg7IHJldHVybiByZXN1bHQ7IH0pKTtcblx0dHJ5IHtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBQcm9taXNlLnJhY2UocHJvbWlzZXMpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH0gZmluYWxseSB7XG5cdFx0Y2FuY2VsbGFibGVQcm9taXNlcy5mb3JFYWNoKChjYW5jZWxsYWJsZVByb21pc2UsIGluZGV4KSA9PiB7XG5cdFx0XHRpZiAoaW5kZXggIT09IHJlc29sdmVkUHJvbWlzZUluZGV4KSB7XG5cdFx0XHRcdGNhbmNlbGxhYmxlUHJvbWlzZS5jYW5jZWwoKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmFjZVRpbWVvdXQ8VD4ocHJvbWlzZTogUHJvbWlzZTxUPiwgdGltZW91dDogbnVtYmVyLCBvblRpbWVvdXQ/OiAoKSA9PiB2b2lkKTogUHJvbWlzZTxUIHwgdW5kZWZpbmVkPiB7XG5cdGxldCBwcm9taXNlUmVzb2x2ZTogKCh2YWx1ZTogVCB8IHVuZGVmaW5lZCkgPT4gdm9pZCkgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0Y29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRwcm9taXNlUmVzb2x2ZT8uKHVuZGVmaW5lZCk7XG5cdFx0b25UaW1lb3V0Py4oKTtcblx0fSwgdGltZW91dCk7XG5cblx0cmV0dXJuIFByb21pc2UucmFjZShbXG5cdFx0cHJvbWlzZS5maW5hbGx5KCgpID0+IGNsZWFyVGltZW91dCh0aW1lcikpLFxuXHRcdG5ldyBQcm9taXNlPFQgfCB1bmRlZmluZWQ+KHJlc29sdmUgPT4gcHJvbWlzZVJlc29sdmUgPSByZXNvbHZlKVxuXHRdKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJhY2VGaWx0ZXI8VD4ocHJvbWlzZXM6IFByb21pc2U8VD5bXSwgZmlsdGVyOiAocmVzdWx0OiBUKSA9PiBib29sZWFuKTogUHJvbWlzZTxUIHwgdW5kZWZpbmVkPiB7XG5cdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0aWYgKHByb21pc2VzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCByZXNvbHZlZCA9IGZhbHNlO1xuXHRcdGxldCB1bnJlc29sdmVkQ291bnQgPSBwcm9taXNlcy5sZW5ndGg7XG5cdFx0Zm9yIChjb25zdCBwcm9taXNlIG9mIHByb21pc2VzKSB7XG5cdFx0XHRwcm9taXNlLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdFx0dW5yZXNvbHZlZENvdW50LS07XG5cdFx0XHRcdGlmICghcmVzb2x2ZWQpIHtcblx0XHRcdFx0XHRpZiAoZmlsdGVyKHJlc3VsdCkpIHtcblx0XHRcdFx0XHRcdHJlc29sdmVkID0gdHJ1ZTtcblx0XHRcdFx0XHRcdHJlc29sdmUocmVzdWx0KTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHVucmVzb2x2ZWRDb3VudCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0Ly8gTGFzdCBvbmUgaGFzIHRvIHJlc29sdmUgdGhlIHByb21pc2Vcblx0XHRcdFx0XHRcdHJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pLmNhdGNoKHJlamVjdCk7XG5cdFx0fVxuXHR9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzUHJvbWlzZTxUPihjYWxsYmFjazogKCkgPT4gVCB8IFRoZW5hYmxlPFQ+KTogUHJvbWlzZTxUPiB7XG5cdHJldHVybiBuZXcgUHJvbWlzZTxUPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0Y29uc3QgaXRlbSA9IGNhbGxiYWNrKCk7XG5cdFx0aWYgKGlzVGhlbmFibGU8VD4oaXRlbSkpIHtcblx0XHRcdGl0ZW0udGhlbihyZXNvbHZlLCByZWplY3QpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXNvbHZlKGl0ZW0pO1xuXHRcdH1cblx0fSk7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbmQgcmV0dXJucyBhIG5ldyBwcm9taXNlLCBwbHVzIGl0cyBgcmVzb2x2ZWAgYW5kIGByZWplY3RgIGNhbGxiYWNrcy5cbiAqXG4gKiBSZXBsYWNlIHdpdGggc3RhbmRhcmRpemVkIFtgUHJvbWlzZS53aXRoUmVzb2x2ZXJzYF0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvUHJvbWlzZS93aXRoUmVzb2x2ZXJzKSBvbmNlIGl0IGlzIHN1cHBvcnRlZFxuICovXG5leHBvcnQgZnVuY3Rpb24gcHJvbWlzZVdpdGhSZXNvbHZlcnM8VD4oKTogeyBwcm9taXNlOiBQcm9taXNlPFQ+OyByZXNvbHZlOiAodmFsdWU6IFQgfCBQcm9taXNlTGlrZTxUPikgPT4gdm9pZDsgcmVqZWN0OiAoZXJyPzogYW55KSA9PiB2b2lkIH0ge1xuXHRsZXQgcmVzb2x2ZTogKHZhbHVlOiBUIHwgUHJvbWlzZUxpa2U8VD4pID0+IHZvaWQ7XG5cdGxldCByZWplY3Q6IChyZWFzb24/OiBhbnkpID0+IHZvaWQ7XG5cdGNvbnN0IHByb21pc2UgPSBuZXcgUHJvbWlzZTxUPigocmVzLCByZWopID0+IHtcblx0XHRyZXNvbHZlID0gcmVzO1xuXHRcdHJlamVjdCA9IHJlajtcblx0fSk7XG5cdHJldHVybiB7IHByb21pc2UsIHJlc29sdmU6IHJlc29sdmUhLCByZWplY3Q6IHJlamVjdCEgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGFzazxUPiB7XG5cdCgpOiBUO1xufVxuXG4vKipcbiAqIEEgaGVscGVyIHRvIHByZXZlbnQgYWNjdW11bGF0aW9uIG9mIHNlcXVlbnRpYWwgYXN5bmMgdGFza3MuXG4gKlxuICogSW1hZ2luZSBhIG1haWwgbWFuIHdpdGggdGhlIHNvbGUgdGFzayBvZiBkZWxpdmVyaW5nIGxldHRlcnMuIEFzIHNvb24gYXNcbiAqIGEgbGV0dGVyIHN1Ym1pdHRlZCBmb3IgZGVsaXZlcnksIGhlIGRyaXZlcyB0byB0aGUgZGVzdGluYXRpb24sIGRlbGl2ZXJzIGl0XG4gKiBhbmQgcmV0dXJucyB0byBoaXMgYmFzZS4gSW1hZ2luZSB0aGF0IGR1cmluZyB0aGUgdHJpcCwgTiBtb3JlIGxldHRlcnMgd2VyZSBzdWJtaXR0ZWQuXG4gKiBXaGVuIHRoZSBtYWlsIG1hbiByZXR1cm5zLCBoZSBwaWNrcyB0aG9zZSBOIGxldHRlcnMgYW5kIGRlbGl2ZXJzIHRoZW0gYWxsIGluIGFcbiAqIHNpbmdsZSB0cmlwLiBFdmVuIHRob3VnaCBOKzEgc3VibWlzc2lvbnMgb2NjdXJyZWQsIG9ubHkgMiBkZWxpdmVyaWVzIHdlcmUgbWFkZS5cbiAqXG4gKiBUaGUgdGhyb3R0bGVyIGltcGxlbWVudHMgdGhpcyB2aWEgdGhlIHF1ZXVlKCkgbWV0aG9kLCBieSBwcm92aWRpbmcgaXQgYSB0YXNrXG4gKiBmYWN0b3J5LiBGb2xsb3dpbmcgdGhlIGV4YW1wbGU6XG4gKlxuICogXHRcdGNvbnN0IHRocm90dGxlciA9IG5ldyBUaHJvdHRsZXIoKTtcbiAqIFx0XHRjb25zdCBsZXR0ZXJzID0gW107XG4gKlxuICogXHRcdGZ1bmN0aW9uIGRlbGl2ZXIoKSB7XG4gKiBcdFx0XHRjb25zdCBsZXR0ZXJzVG9EZWxpdmVyID0gbGV0dGVycztcbiAqIFx0XHRcdGxldHRlcnMgPSBbXTtcbiAqIFx0XHRcdHJldHVybiBtYWtlVGhlVHJpcChsZXR0ZXJzVG9EZWxpdmVyKTtcbiAqIFx0XHR9XG4gKlxuICogXHRcdGZ1bmN0aW9uIG9uTGV0dGVyUmVjZWl2ZWQobCkge1xuICogXHRcdFx0bGV0dGVycy5wdXNoKGwpO1xuICogXHRcdFx0dGhyb3R0bGVyLnF1ZXVlKGRlbGl2ZXIpO1xuICogXHRcdH1cbiAqL1xuZXhwb3J0IGNsYXNzIFRocm90dGxlciBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIGFjdGl2ZVByb21pc2U6IFByb21pc2U8YW55PiB8IG51bGw7XG5cdHByaXZhdGUgcXVldWVkUHJvbWlzZTogUHJvbWlzZTxhbnk+IHwgbnVsbDtcblx0cHJpdmF0ZSBxdWV1ZWRQcm9taXNlRmFjdG9yeTogSVRhc2s8UHJvbWlzZTxhbnk+PiB8IG51bGw7XG5cblx0cHJpdmF0ZSBpc0Rpc3Bvc2VkID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5hY3RpdmVQcm9taXNlID0gbnVsbDtcblx0XHR0aGlzLnF1ZXVlZFByb21pc2UgPSBudWxsO1xuXHRcdHRoaXMucXVldWVkUHJvbWlzZUZhY3RvcnkgPSBudWxsO1xuXHR9XG5cblx0cXVldWU8VD4ocHJvbWlzZUZhY3Rvcnk6IElUYXNrPFByb21pc2U8VD4+KTogUHJvbWlzZTxUPiB7XG5cdFx0aWYgKHRoaXMuaXNEaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignVGhyb3R0bGVyIGlzIGRpc3Bvc2VkJykpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmFjdGl2ZVByb21pc2UpIHtcblx0XHRcdHRoaXMucXVldWVkUHJvbWlzZUZhY3RvcnkgPSBwcm9taXNlRmFjdG9yeTtcblxuXHRcdFx0aWYgKCF0aGlzLnF1ZXVlZFByb21pc2UpIHtcblx0XHRcdFx0Y29uc3Qgb25Db21wbGV0ZSA9ICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLnF1ZXVlZFByb21pc2UgPSBudWxsO1xuXG5cdFx0XHRcdFx0aWYgKHRoaXMuaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMucXVldWUodGhpcy5xdWV1ZWRQcm9taXNlRmFjdG9yeSEpO1xuXHRcdFx0XHRcdHRoaXMucXVldWVkUHJvbWlzZUZhY3RvcnkgPSBudWxsO1xuXG5cdFx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdFx0fTtcblxuXHRcdFx0XHR0aGlzLnF1ZXVlZFByb21pc2UgPSBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRcdFx0XHR0aGlzLmFjdGl2ZVByb21pc2UhLnRoZW4ob25Db21wbGV0ZSwgb25Db21wbGV0ZSkudGhlbihyZXNvbHZlKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdHRoaXMucXVldWVkUHJvbWlzZSEudGhlbihyZXNvbHZlLCByZWplY3QpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5hY3RpdmVQcm9taXNlID0gcHJvbWlzZUZhY3RvcnkoKTtcblxuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHR0aGlzLmFjdGl2ZVByb21pc2UhLnRoZW4oKHJlc3VsdDogVCkgPT4ge1xuXHRcdFx0XHR0aGlzLmFjdGl2ZVByb21pc2UgPSBudWxsO1xuXHRcdFx0XHRyZXNvbHZlKHJlc3VsdCk7XG5cdFx0XHR9LCAoZXJyOiB1bmtub3duKSA9PiB7XG5cdFx0XHRcdHRoaXMuYWN0aXZlUHJvbWlzZSA9IG51bGw7XG5cdFx0XHRcdHJlamVjdChlcnIpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuaXNEaXNwb3NlZCA9IHRydWU7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNlcXVlbmNlciB7XG5cblx0cHJpdmF0ZSBjdXJyZW50OiBQcm9taXNlPHVua25vd24+ID0gUHJvbWlzZS5yZXNvbHZlKG51bGwpO1xuXG5cdHF1ZXVlPFQ+KHByb21pc2VUYXNrOiBJVGFzazxQcm9taXNlPFQ+Pik6IFByb21pc2U8VD4ge1xuXHRcdHJldHVybiB0aGlzLmN1cnJlbnQgPSB0aGlzLmN1cnJlbnQudGhlbigoKSA9PiBwcm9taXNlVGFzaygpLCAoKSA9PiBwcm9taXNlVGFzaygpKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2VxdWVuY2VyQnlLZXk8VEtleT4ge1xuXG5cdHByaXZhdGUgcHJvbWlzZU1hcCA9IG5ldyBNYXA8VEtleSwgUHJvbWlzZTx1bmtub3duPj4oKTtcblxuXHRxdWV1ZTxUPihrZXk6IFRLZXksIHByb21pc2VUYXNrOiBJVGFzazxQcm9taXNlPFQ+Pik6IFByb21pc2U8VD4ge1xuXHRcdGNvbnN0IHJ1bm5pbmdQcm9taXNlID0gdGhpcy5wcm9taXNlTWFwLmdldChrZXkpID8/IFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdGNvbnN0IG5ld1Byb21pc2UgPSBydW5uaW5nUHJvbWlzZVxuXHRcdFx0LmNhdGNoKCgpID0+IHsgfSlcblx0XHRcdC50aGVuKHByb21pc2VUYXNrKVxuXHRcdFx0LmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5wcm9taXNlTWFwLmdldChrZXkpID09PSBuZXdQcm9taXNlKSB7XG5cdFx0XHRcdFx0dGhpcy5wcm9taXNlTWFwLmRlbGV0ZShrZXkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR0aGlzLnByb21pc2VNYXAuc2V0KGtleSwgbmV3UHJvbWlzZSk7XG5cdFx0cmV0dXJuIG5ld1Byb21pc2U7XG5cdH1cblxuXHRrZXlzKCk6IEl0ZXJhYmxlSXRlcmF0b3I8VEtleT4ge1xuXHRcdHJldHVybiB0aGlzLnByb21pc2VNYXAua2V5cygpO1xuXHR9XG59XG5cbmludGVyZmFjZSBJU2NoZWR1bGVkTGF0ZXIgZXh0ZW5kcyBJRGlzcG9zYWJsZSB7XG5cdGlzVHJpZ2dlcmVkKCk6IGJvb2xlYW47XG59XG5cbmNvbnN0IHRpbWVvdXREZWZlcnJlZCA9ICh0aW1lb3V0OiBudW1iZXIsIGZuOiAoKSA9PiB2b2lkKTogSVNjaGVkdWxlZExhdGVyID0+IHtcblx0bGV0IHNjaGVkdWxlZCA9IHRydWU7XG5cdGNvbnN0IGhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdHNjaGVkdWxlZCA9IGZhbHNlO1xuXHRcdGZuKCk7XG5cdH0sIHRpbWVvdXQpO1xuXHRyZXR1cm4ge1xuXHRcdGlzVHJpZ2dlcmVkOiAoKSA9PiBzY2hlZHVsZWQsXG5cdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0Y2xlYXJUaW1lb3V0KGhhbmRsZSk7XG5cdFx0XHRzY2hlZHVsZWQgPSBmYWxzZTtcblx0XHR9LFxuXHR9O1xufTtcblxuY29uc3QgbWljcm90YXNrRGVmZXJyZWQgPSAoZm46ICgpID0+IHZvaWQpOiBJU2NoZWR1bGVkTGF0ZXIgPT4ge1xuXHRsZXQgc2NoZWR1bGVkID0gdHJ1ZTtcblx0cXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuXHRcdGlmIChzY2hlZHVsZWQpIHtcblx0XHRcdHNjaGVkdWxlZCA9IGZhbHNlO1xuXHRcdFx0Zm4oKTtcblx0XHR9XG5cdH0pO1xuXG5cdHJldHVybiB7XG5cdFx0aXNUcmlnZ2VyZWQ6ICgpID0+IHNjaGVkdWxlZCxcblx0XHRkaXNwb3NlOiAoKSA9PiB7IHNjaGVkdWxlZCA9IGZhbHNlOyB9LFxuXHR9O1xufTtcblxuLyoqXG4gKiBBIGhlbHBlciB0byBkZWxheSAoZGVib3VuY2UpIGV4ZWN1dGlvbiBvZiBhIHRhc2sgdGhhdCBpcyBiZWluZyByZXF1ZXN0ZWQgb2Z0ZW4uXG4gKlxuICogRm9sbG93aW5nIHRoZSB0aHJvdHRsZXIsIG5vdyBpbWFnaW5lIHRoZSBtYWlsIG1hbiB3YW50cyB0byBvcHRpbWl6ZSB0aGUgbnVtYmVyIG9mXG4gKiB0cmlwcyBwcm9hY3RpdmVseS4gVGhlIHRyaXAgaXRzZWxmIGNhbiBiZSBsb25nLCBzbyBoZSBkZWNpZGVzIG5vdCB0byBtYWtlIHRoZSB0cmlwXG4gKiBhcyBzb29uIGFzIGEgbGV0dGVyIGlzIHN1Ym1pdHRlZC4gSW5zdGVhZCBoZSB3YWl0cyBhIHdoaWxlLCBpbiBjYXNlIG1vcmVcbiAqIGxldHRlcnMgYXJlIHN1Ym1pdHRlZC4gQWZ0ZXIgc2FpZCB3YWl0aW5nIHBlcmlvZCwgaWYgbm8gbGV0dGVycyB3ZXJlIHN1Ym1pdHRlZCwgaGVcbiAqIGRlY2lkZXMgdG8gbWFrZSB0aGUgdHJpcC4gSW1hZ2luZSB0aGF0IE4gbW9yZSBsZXR0ZXJzIHdlcmUgc3VibWl0dGVkIGFmdGVyIHRoZSBmaXJzdFxuICogb25lLCBhbGwgd2l0aGluIGEgc2hvcnQgcGVyaW9kIG9mIHRpbWUgYmV0d2VlbiBlYWNoIG90aGVyLiBFdmVuIHRob3VnaCBOKzFcbiAqIHN1Ym1pc3Npb25zIG9jY3VycmVkLCBvbmx5IDEgZGVsaXZlcnkgd2FzIG1hZGUuXG4gKlxuICogVGhlIGRlbGF5ZXIgb2ZmZXJzIHRoaXMgYmVoYXZpb3IgdmlhIHRoZSB0cmlnZ2VyKCkgbWV0aG9kLCBpbnRvIHdoaWNoIGJvdGggdGhlIHRhc2tcbiAqIHRvIGJlIGV4ZWN1dGVkIGFuZCB0aGUgd2FpdGluZyBwZXJpb2QgKGRlbGF5KSBtdXN0IGJlIHBhc3NlZCBpbiBhcyBhcmd1bWVudHMuIEZvbGxvd2luZ1xuICogdGhlIGV4YW1wbGU6XG4gKlxuICogXHRcdGNvbnN0IGRlbGF5ZXIgPSBuZXcgRGVsYXllcihXQUlUSU5HX1BFUklPRCk7XG4gKiBcdFx0Y29uc3QgbGV0dGVycyA9IFtdO1xuICpcbiAqIFx0XHRmdW5jdGlvbiBsZXR0ZXJSZWNlaXZlZChsKSB7XG4gKiBcdFx0XHRsZXR0ZXJzLnB1c2gobCk7XG4gKiBcdFx0XHRkZWxheWVyLnRyaWdnZXIoKCkgPT4geyByZXR1cm4gbWFrZVRoZVRyaXAoKTsgfSk7XG4gKiBcdFx0fVxuICovXG5leHBvcnQgY2xhc3MgRGVsYXllcjxUPiBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIGRlZmVycmVkOiBJU2NoZWR1bGVkTGF0ZXIgfCBudWxsO1xuXHRwcml2YXRlIGNvbXBsZXRpb25Qcm9taXNlOiBQcm9taXNlPGFueT4gfCBudWxsO1xuXHRwcml2YXRlIGRvUmVzb2x2ZTogKCh2YWx1ZT86IGFueSB8IFByb21pc2U8YW55PikgPT4gdm9pZCkgfCBudWxsO1xuXHRwcml2YXRlIGRvUmVqZWN0OiAoKGVycjogYW55KSA9PiB2b2lkKSB8IG51bGw7XG5cdHByaXZhdGUgdGFzazogSVRhc2s8VCB8IFByb21pc2U8VD4+IHwgbnVsbDtcblxuXHRjb25zdHJ1Y3RvcihwdWJsaWMgZGVmYXVsdERlbGF5OiBudW1iZXIgfCB0eXBlb2YgTWljcm90YXNrRGVsYXkpIHtcblx0XHR0aGlzLmRlZmVycmVkID0gbnVsbDtcblx0XHR0aGlzLmNvbXBsZXRpb25Qcm9taXNlID0gbnVsbDtcblx0XHR0aGlzLmRvUmVzb2x2ZSA9IG51bGw7XG5cdFx0dGhpcy5kb1JlamVjdCA9IG51bGw7XG5cdFx0dGhpcy50YXNrID0gbnVsbDtcblx0fVxuXG5cdHRyaWdnZXIodGFzazogSVRhc2s8VCB8IFByb21pc2U8VD4+LCBkZWxheSA9IHRoaXMuZGVmYXVsdERlbGF5KTogUHJvbWlzZTxUPiB7XG5cdFx0dGhpcy50YXNrID0gdGFzaztcblx0XHR0aGlzLmNhbmNlbFRpbWVvdXQoKTtcblxuXHRcdGlmICghdGhpcy5jb21wbGV0aW9uUHJvbWlzZSkge1xuXHRcdFx0dGhpcy5jb21wbGV0aW9uUHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0dGhpcy5kb1Jlc29sdmUgPSByZXNvbHZlO1xuXHRcdFx0XHR0aGlzLmRvUmVqZWN0ID0gcmVqZWN0O1xuXHRcdFx0fSkudGhlbigoKSA9PiB7XG5cdFx0XHRcdHRoaXMuY29tcGxldGlvblByb21pc2UgPSBudWxsO1xuXHRcdFx0XHR0aGlzLmRvUmVzb2x2ZSA9IG51bGw7XG5cdFx0XHRcdGlmICh0aGlzLnRhc2spIHtcblx0XHRcdFx0XHRjb25zdCB0YXNrID0gdGhpcy50YXNrO1xuXHRcdFx0XHRcdHRoaXMudGFzayA9IG51bGw7XG5cdFx0XHRcdFx0cmV0dXJuIHRhc2soKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZm4gPSAoKSA9PiB7XG5cdFx0XHR0aGlzLmRlZmVycmVkID0gbnVsbDtcblx0XHRcdHRoaXMuZG9SZXNvbHZlPy4obnVsbCk7XG5cdFx0fTtcblxuXHRcdHRoaXMuZGVmZXJyZWQgPSBkZWxheSA9PT0gTWljcm90YXNrRGVsYXkgPyBtaWNyb3Rhc2tEZWZlcnJlZChmbikgOiB0aW1lb3V0RGVmZXJyZWQoZGVsYXksIGZuKTtcblxuXHRcdHJldHVybiB0aGlzLmNvbXBsZXRpb25Qcm9taXNlO1xuXHR9XG5cblx0aXNUcmlnZ2VyZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5kZWZlcnJlZD8uaXNUcmlnZ2VyZWQoKTtcblx0fVxuXG5cdGNhbmNlbCgpOiB2b2lkIHtcblx0XHR0aGlzLmNhbmNlbFRpbWVvdXQoKTtcblxuXHRcdGlmICh0aGlzLmNvbXBsZXRpb25Qcm9taXNlKSB7XG5cdFx0XHR0aGlzLmRvUmVqZWN0Py4obmV3IENhbmNlbGxhdGlvbkVycm9yKCkpO1xuXHRcdFx0dGhpcy5jb21wbGV0aW9uUHJvbWlzZSA9IG51bGw7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjYW5jZWxUaW1lb3V0KCk6IHZvaWQge1xuXHRcdHRoaXMuZGVmZXJyZWQ/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLmRlZmVycmVkID0gbnVsbDtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5jYW5jZWwoKTtcblx0fVxufVxuXG4vKipcbiAqIEEgaGVscGVyIHRvIGRlbGF5IGV4ZWN1dGlvbiBvZiBhIHRhc2sgdGhhdCBpcyBiZWluZyByZXF1ZXN0ZWQgb2Z0ZW4sIHdoaWxlXG4gKiBwcmV2ZW50aW5nIGFjY3VtdWxhdGlvbiBvZiBjb25zZWN1dGl2ZSBleGVjdXRpb25zLCB3aGlsZSB0aGUgdGFzayBydW5zLlxuICpcbiAqIFRoZSBtYWlsIG1hbiBpcyBjbGV2ZXIgYW5kIHdhaXRzIGZvciBhIGNlcnRhaW4gYW1vdW50IG9mIHRpbWUsIGJlZm9yZSBnb2luZ1xuICogb3V0IHRvIGRlbGl2ZXIgbGV0dGVycy4gV2hpbGUgdGhlIG1haWwgbWFuIGlzIGdvaW5nIG91dCwgbW9yZSBsZXR0ZXJzIGFycml2ZVxuICogYW5kIGNhbiBvbmx5IGJlIGRlbGl2ZXJlZCBvbmNlIGhlIGlzIGJhY2suIE9uY2UgaGUgaXMgYmFjayB0aGUgbWFpbCBtYW4gd2lsbFxuICogZG8gb25lIG1vcmUgdHJpcCB0byBkZWxpdmVyIHRoZSBsZXR0ZXJzIHRoYXQgaGF2ZSBhY2N1bXVsYXRlZCB3aGlsZSBoZSB3YXMgb3V0LlxuICovXG5leHBvcnQgY2xhc3MgVGhyb3R0bGVkRGVsYXllcjxUPiB7XG5cblx0cHJpdmF0ZSBkZWxheWVyOiBEZWxheWVyPFByb21pc2U8VD4+O1xuXHRwcml2YXRlIHRocm90dGxlcjogVGhyb3R0bGVyO1xuXG5cdGNvbnN0cnVjdG9yKGRlZmF1bHREZWxheTogbnVtYmVyKSB7XG5cdFx0dGhpcy5kZWxheWVyID0gbmV3IERlbGF5ZXIoZGVmYXVsdERlbGF5KTtcblx0XHR0aGlzLnRocm90dGxlciA9IG5ldyBUaHJvdHRsZXIoKTtcblx0fVxuXG5cdHRyaWdnZXIocHJvbWlzZUZhY3Rvcnk6IElUYXNrPFByb21pc2U8VD4+LCBkZWxheT86IG51bWJlcik6IFByb21pc2U8VD4ge1xuXHRcdHJldHVybiB0aGlzLmRlbGF5ZXIudHJpZ2dlcigoKSA9PiB0aGlzLnRocm90dGxlci5xdWV1ZShwcm9taXNlRmFjdG9yeSksIGRlbGF5KSBhcyB1bmtub3duIGFzIFByb21pc2U8VD47XG5cdH1cblxuXHRpc1RyaWdnZXJlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5kZWxheWVyLmlzVHJpZ2dlcmVkKCk7XG5cdH1cblxuXHRjYW5jZWwoKTogdm9pZCB7XG5cdFx0dGhpcy5kZWxheWVyLmNhbmNlbCgpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmRlbGF5ZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMudGhyb3R0bGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG4vKipcbiAqIEEgYmFycmllciB0aGF0IGlzIGluaXRpYWxseSBjbG9zZWQgYW5kIHRoZW4gYmVjb21lcyBvcGVuZWQgcGVybWFuZW50bHkuXG4gKi9cbmV4cG9ydCBjbGFzcyBCYXJyaWVyIHtcblx0cHJpdmF0ZSBfaXNPcGVuOiBib29sZWFuO1xuXHRwcml2YXRlIF9wcm9taXNlOiBQcm9taXNlPGJvb2xlYW4+O1xuXHRwcml2YXRlIF9jb21wbGV0ZVByb21pc2UhOiAodjogYm9vbGVhbikgPT4gdm9pZDtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHR0aGlzLl9pc09wZW4gPSBmYWxzZTtcblx0XHR0aGlzLl9wcm9taXNlID0gbmV3IFByb21pc2U8Ym9vbGVhbj4oKGMsIGUpID0+IHtcblx0XHRcdHRoaXMuX2NvbXBsZXRlUHJvbWlzZSA9IGM7XG5cdFx0fSk7XG5cdH1cblxuXHRpc09wZW4oKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2lzT3Blbjtcblx0fVxuXG5cdG9wZW4oKTogdm9pZCB7XG5cdFx0dGhpcy5faXNPcGVuID0gdHJ1ZTtcblx0XHR0aGlzLl9jb21wbGV0ZVByb21pc2UodHJ1ZSk7XG5cdH1cblxuXHR3YWl0KCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm9taXNlO1xuXHR9XG59XG5cbi8qKlxuICogQSBiYXJyaWVyIHRoYXQgaXMgaW5pdGlhbGx5IGNsb3NlZCBhbmQgdGhlbiBiZWNvbWVzIG9wZW5lZCBwZXJtYW5lbnRseSBhZnRlciBhIGNlcnRhaW4gcGVyaW9kIG9mXG4gKiB0aW1lIG9yIHdoZW4gb3BlbiBpcyBjYWxsZWQgZXhwbGljaXRseVxuICovXG5leHBvcnQgY2xhc3MgQXV0b09wZW5CYXJyaWVyIGV4dGVuZHMgQmFycmllciB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdGltZW91dDogYW55O1xuXG5cdGNvbnN0cnVjdG9yKGF1dG9PcGVuVGltZU1zOiBudW1iZXIpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3RpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHRoaXMub3BlbigpLCBhdXRvT3BlblRpbWVNcyk7XG5cdH1cblxuXHRvdmVycmlkZSBvcGVuKCk6IHZvaWQge1xuXHRcdGNsZWFyVGltZW91dCh0aGlzLl90aW1lb3V0KTtcblx0XHRzdXBlci5vcGVuKCk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRpbWVvdXQobWlsbGlzOiBudW1iZXIpOiBDYW5jZWxhYmxlUHJvbWlzZTx2b2lkPjtcbmV4cG9ydCBmdW5jdGlvbiB0aW1lb3V0KG1pbGxpczogbnVtYmVyLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+O1xuZXhwb3J0IGZ1bmN0aW9uIHRpbWVvdXQobWlsbGlzOiBudW1iZXIsIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBDYW5jZWxhYmxlUHJvbWlzZTx2b2lkPiB8IFByb21pc2U8dm9pZD4ge1xuXHRpZiAoIXRva2VuKSB7XG5cdFx0cmV0dXJuIGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKHRva2VuID0+IHRpbWVvdXQobWlsbGlzLCB0b2tlbikpO1xuXHR9XG5cblx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRjb25zdCBoYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0cmVzb2x2ZSgpO1xuXHRcdH0sIG1pbGxpcyk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHtcblx0XHRcdGNsZWFyVGltZW91dChoYW5kbGUpO1xuXHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRyZWplY3QobmV3IENhbmNlbGxhdGlvbkVycm9yKCkpO1xuXHRcdH0pO1xuXHR9KTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgdGltZW91dCB0aGF0IGNhbiBiZSBkaXNwb3NlZCB1c2luZyBpdHMgcmV0dXJuZWQgdmFsdWUuXG4gKiBAcGFyYW0gaGFuZGxlciBUaGUgdGltZW91dCBoYW5kbGVyLlxuICogQHBhcmFtIHRpbWVvdXQgQW4gb3B0aW9uYWwgdGltZW91dCBpbiBtaWxsaXNlY29uZHMuXG4gKiBAcGFyYW0gc3RvcmUgQW4gb3B0aW9uYWwge0BsaW5rIERpc3Bvc2FibGVTdG9yZX0gdGhhdCB3aWxsIGhhdmUgdGhlIHRpbWVvdXQgZGlzcG9zYWJsZSBtYW5hZ2VkIGF1dG9tYXRpY2FsbHkuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZTtcbiAqIC8vIENhbGwgdGhlIHRpbWVvdXQgYWZ0ZXIgMTAwMG1zIGF0IHdoaWNoIHBvaW50IGl0IHdpbGwgYmUgYXV0b21hdGljYWxseVxuICogLy8gZXZpY3RlZCBmcm9tIHRoZSBzdG9yZS5cbiAqIGNvbnN0IHRpbWVvdXREaXNwb3NhYmxlID0gZGlzcG9zYWJsZVRpbWVvdXQoKCkgPT4ge30sIDEwMDAsIHN0b3JlKTtcbiAqXG4gKiBpZiAoZm9vKSB7XG4gKiAgIC8vIENhbmNlbCB0aGUgdGltZW91dCBhbmQgZXZpY3QgaXQgZnJvbSBzdG9yZS5cbiAqICAgdGltZW91dERpc3Bvc2FibGUuZGlzcG9zZSgpO1xuICogfVxuICovXG5leHBvcnQgZnVuY3Rpb24gZGlzcG9zYWJsZVRpbWVvdXQoaGFuZGxlcjogKCkgPT4gdm9pZCwgdGltZW91dCA9IDAsIHN0b3JlPzogRGlzcG9zYWJsZVN0b3JlKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCB0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdGhhbmRsZXIoKTtcblx0XHRpZiAoc3RvcmUpIHtcblx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSwgdGltZW91dCk7XG5cdGNvbnN0IGRpc3Bvc2FibGUgPSB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdGNsZWFyVGltZW91dCh0aW1lcik7XG5cdFx0c3RvcmU/LmRlbGV0ZShkaXNwb3NhYmxlKTtcblx0fSk7XG5cdHN0b3JlPy5hZGQoZGlzcG9zYWJsZSk7XG5cdHJldHVybiBkaXNwb3NhYmxlO1xufVxuXG4vKipcbiAqIFJ1bnMgdGhlIHByb3ZpZGVkIGxpc3Qgb2YgcHJvbWlzZSBmYWN0b3JpZXMgaW4gc2VxdWVudGlhbCBvcmRlci4gVGhlIHJldHVybmVkXG4gKiBwcm9taXNlIHdpbGwgY29tcGxldGUgdG8gYW4gYXJyYXkgb2YgcmVzdWx0cyBmcm9tIGVhY2ggcHJvbWlzZS5cbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gc2VxdWVuY2U8VD4ocHJvbWlzZUZhY3RvcmllczogSVRhc2s8UHJvbWlzZTxUPj5bXSk6IFByb21pc2U8VFtdPiB7XG5cdGNvbnN0IHJlc3VsdHM6IFRbXSA9IFtdO1xuXHRsZXQgaW5kZXggPSAwO1xuXHRjb25zdCBsZW4gPSBwcm9taXNlRmFjdG9yaWVzLmxlbmd0aDtcblxuXHRmdW5jdGlvbiBuZXh0KCk6IFByb21pc2U8VD4gfCBudWxsIHtcblx0XHRyZXR1cm4gaW5kZXggPCBsZW4gPyBwcm9taXNlRmFjdG9yaWVzW2luZGV4KytdKCkgOiBudWxsO1xuXHR9XG5cblx0ZnVuY3Rpb24gdGhlbkhhbmRsZXIocmVzdWx0OiBhbnkpOiBQcm9taXNlPGFueT4ge1xuXHRcdGlmIChyZXN1bHQgIT09IHVuZGVmaW5lZCAmJiByZXN1bHQgIT09IG51bGwpIHtcblx0XHRcdHJlc3VsdHMucHVzaChyZXN1bHQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG4gPSBuZXh0KCk7XG5cdFx0aWYgKG4pIHtcblx0XHRcdHJldHVybiBuLnRoZW4odGhlbkhhbmRsZXIpO1xuXHRcdH1cblxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUocmVzdWx0cyk7XG5cdH1cblxuXHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwpLnRoZW4odGhlbkhhbmRsZXIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZmlyc3Q8VD4ocHJvbWlzZUZhY3RvcmllczogSVRhc2s8UHJvbWlzZTxUPj5bXSwgc2hvdWxkU3RvcDogKHQ6IFQpID0+IGJvb2xlYW4gPSB0ID0+ICEhdCwgZGVmYXVsdFZhbHVlOiBUIHwgbnVsbCA9IG51bGwpOiBQcm9taXNlPFQgfCBudWxsPiB7XG5cdGxldCBpbmRleCA9IDA7XG5cdGNvbnN0IGxlbiA9IHByb21pc2VGYWN0b3JpZXMubGVuZ3RoO1xuXG5cdGNvbnN0IGxvb3A6ICgpID0+IFByb21pc2U8VCB8IG51bGw+ID0gKCkgPT4ge1xuXHRcdGlmIChpbmRleCA+PSBsZW4pIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoZGVmYXVsdFZhbHVlKTtcblx0XHR9XG5cblx0XHRjb25zdCBmYWN0b3J5ID0gcHJvbWlzZUZhY3Rvcmllc1tpbmRleCsrXTtcblx0XHRjb25zdCBwcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKGZhY3RvcnkoKSk7XG5cblx0XHRyZXR1cm4gcHJvbWlzZS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRpZiAoc2hvdWxkU3RvcChyZXN1bHQpKSB7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUocmVzdWx0KTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGxvb3AoKTtcblx0XHR9KTtcblx0fTtcblxuXHRyZXR1cm4gbG9vcCgpO1xufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIHJlc3VsdCBvZiB0aGUgZmlyc3QgcHJvbWlzZSB0aGF0IG1hdGNoZXMgdGhlIFwic2hvdWxkU3RvcFwiLFxuICogcnVubmluZyBhbGwgcHJvbWlzZXMgaW4gcGFyYWxsZWwuIFN1cHBvcnRzIGNhbmNlbGFibGUgcHJvbWlzZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmaXJzdFBhcmFsbGVsPFQ+KHByb21pc2VMaXN0OiBQcm9taXNlPFQ+W10sIHNob3VsZFN0b3A/OiAodDogVCkgPT4gYm9vbGVhbiwgZGVmYXVsdFZhbHVlPzogVCB8IG51bGwpOiBQcm9taXNlPFQgfCBudWxsPjtcbmV4cG9ydCBmdW5jdGlvbiBmaXJzdFBhcmFsbGVsPFQsIFIgZXh0ZW5kcyBUPihwcm9taXNlTGlzdDogUHJvbWlzZTxUPltdLCBzaG91bGRTdG9wOiAodDogVCkgPT4gdCBpcyBSLCBkZWZhdWx0VmFsdWU/OiBSIHwgbnVsbCk6IFByb21pc2U8UiB8IG51bGw+O1xuZXhwb3J0IGZ1bmN0aW9uIGZpcnN0UGFyYWxsZWw8VD4ocHJvbWlzZUxpc3Q6IFByb21pc2U8VD5bXSwgc2hvdWxkU3RvcDogKHQ6IFQpID0+IGJvb2xlYW4gPSB0ID0+ICEhdCwgZGVmYXVsdFZhbHVlOiBUIHwgbnVsbCA9IG51bGwpIHtcblx0aWYgKHByb21pc2VMaXN0Lmxlbmd0aCA9PT0gMCkge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoZGVmYXVsdFZhbHVlKTtcblx0fVxuXG5cdGxldCB0b2RvID0gcHJvbWlzZUxpc3QubGVuZ3RoO1xuXHRjb25zdCBmaW5pc2ggPSAoKSA9PiB7XG5cdFx0dG9kbyA9IC0xO1xuXHRcdGZvciAoY29uc3QgcHJvbWlzZSBvZiBwcm9taXNlTGlzdCkge1xuXHRcdFx0KHByb21pc2UgYXMgUGFydGlhbDxDYW5jZWxhYmxlUHJvbWlzZTxUPj4pLmNhbmNlbD8uKCk7XG5cdFx0fVxuXHR9O1xuXG5cdHJldHVybiBuZXcgUHJvbWlzZTxUIHwgbnVsbD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdGZvciAoY29uc3QgcHJvbWlzZSBvZiBwcm9taXNlTGlzdCkge1xuXHRcdFx0cHJvbWlzZS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRcdGlmICgtLXRvZG8gPj0gMCAmJiBzaG91bGRTdG9wKHJlc3VsdCkpIHtcblx0XHRcdFx0XHRmaW5pc2goKTtcblx0XHRcdFx0XHRyZXNvbHZlKHJlc3VsdCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAodG9kbyA9PT0gMCkge1xuXHRcdFx0XHRcdHJlc29sdmUoZGVmYXVsdFZhbHVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHRcdFx0LmNhdGNoKGVyciA9PiB7XG5cdFx0XHRcdFx0aWYgKC0tdG9kbyA+PSAwKSB7XG5cdFx0XHRcdFx0XHRmaW5pc2goKTtcblx0XHRcdFx0XHRcdHJlamVjdChlcnIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0fVxuXHR9KTtcbn1cblxuaW50ZXJmYWNlIElMaW1pdGVkVGFza0ZhY3Rvcnk8VD4ge1xuXHRmYWN0b3J5OiBJVGFzazxQcm9taXNlPFQ+Pjtcblx0YzogKHZhbHVlOiBUIHwgUHJvbWlzZTxUPikgPT4gdm9pZDtcblx0ZTogKGVycm9yPzogdW5rbm93bikgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTGltaXRlcjxUPiB7XG5cblx0cmVhZG9ubHkgc2l6ZTogbnVtYmVyO1xuXG5cdHF1ZXVlKGZhY3Rvcnk6IElUYXNrPFByb21pc2U8VD4+KTogUHJvbWlzZTxUPjtcblxuXHRjbGVhcigpOiB2b2lkO1xufVxuXG4vKipcbiAqIEEgaGVscGVyIHRvIHF1ZXVlIE4gcHJvbWlzZXMgYW5kIHJ1biB0aGVtIGFsbCB3aXRoIGEgbWF4IGRlZ3JlZSBvZiBwYXJhbGxlbGlzbS4gVGhlIGhlbHBlclxuICogZW5zdXJlcyB0aGF0IGF0IGFueSB0aW1lIG5vIG1vcmUgdGhhbiBNIHByb21pc2VzIGFyZSBydW5uaW5nIGF0IHRoZSBzYW1lIHRpbWUuXG4gKi9cbmV4cG9ydCBjbGFzcyBMaW1pdGVyPFQ+IGltcGxlbWVudHMgSUxpbWl0ZXI8VD4ge1xuXG5cdHByaXZhdGUgX3NpemUgPSAwO1xuXHRwcml2YXRlIF9pc0Rpc3Bvc2VkID0gZmFsc2U7XG5cdHByaXZhdGUgcnVubmluZ1Byb21pc2VzOiBudW1iZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgbWF4RGVncmVlT2ZQYXJhbGVsbGlzbTogbnVtYmVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IG91dHN0YW5kaW5nUHJvbWlzZXM6IElMaW1pdGVkVGFza0ZhY3Rvcnk8VD5bXTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EcmFpbmVkOiBFbWl0dGVyPHZvaWQ+O1xuXG5cdGNvbnN0cnVjdG9yKG1heERlZ3JlZU9mUGFyYWxlbGxpc206IG51bWJlcikge1xuXHRcdHRoaXMubWF4RGVncmVlT2ZQYXJhbGVsbGlzbSA9IG1heERlZ3JlZU9mUGFyYWxlbGxpc207XG5cdFx0dGhpcy5vdXRzdGFuZGluZ1Byb21pc2VzID0gW107XG5cdFx0dGhpcy5ydW5uaW5nUHJvbWlzZXMgPSAwO1xuXHRcdHRoaXMuX29uRHJhaW5lZCA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZWQgd2hlbiBhbGwgd29yayBpcyBkb25lIChvbkRyYWluZWQpIG9yIHdoZW5cblx0ICogdGhlcmUgaXMgbm90aGluZyB0byBkb1xuXHQgKi9cblx0d2hlbklkbGUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuc2l6ZSA+IDBcblx0XHRcdD8gRXZlbnQudG9Qcm9taXNlKHRoaXMub25EcmFpbmVkKVxuXHRcdFx0OiBQcm9taXNlLnJlc29sdmUoKTtcblx0fVxuXG5cdGdldCBvbkRyYWluZWQoKTogRXZlbnQ8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl9vbkRyYWluZWQuZXZlbnQ7XG5cdH1cblxuXHRnZXQgc2l6ZSgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9zaXplO1xuXHR9XG5cblx0cXVldWUoZmFjdG9yeTogSVRhc2s8UHJvbWlzZTxUPj4pOiBQcm9taXNlPFQ+IHtcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdPYmplY3QgaGFzIGJlZW4gZGlzcG9zZWQnKTtcblx0XHR9XG5cdFx0dGhpcy5fc2l6ZSsrO1xuXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlPFQ+KChjLCBlKSA9PiB7XG5cdFx0XHR0aGlzLm91dHN0YW5kaW5nUHJvbWlzZXMucHVzaCh7IGZhY3RvcnksIGMsIGUgfSk7XG5cdFx0XHR0aGlzLmNvbnN1bWUoKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgY29uc3VtZSgpOiB2b2lkIHtcblx0XHR3aGlsZSAodGhpcy5vdXRzdGFuZGluZ1Byb21pc2VzLmxlbmd0aCAmJiB0aGlzLnJ1bm5pbmdQcm9taXNlcyA8IHRoaXMubWF4RGVncmVlT2ZQYXJhbGVsbGlzbSkge1xuXHRcdFx0Y29uc3QgaUxpbWl0ZWRUYXNrID0gdGhpcy5vdXRzdGFuZGluZ1Byb21pc2VzLnNoaWZ0KCkhO1xuXHRcdFx0dGhpcy5ydW5uaW5nUHJvbWlzZXMrKztcblxuXHRcdFx0Y29uc3QgcHJvbWlzZSA9IGlMaW1pdGVkVGFzay5mYWN0b3J5KCk7XG5cdFx0XHRwcm9taXNlLnRoZW4oaUxpbWl0ZWRUYXNrLmMsIGlMaW1pdGVkVGFzay5lKTtcblx0XHRcdHByb21pc2UudGhlbigoKSA9PiB0aGlzLmNvbnN1bWVkKCksICgpID0+IHRoaXMuY29uc3VtZWQoKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjb25zdW1lZCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLnJ1bm5pbmdQcm9taXNlcy0tO1xuXHRcdGlmICgtLXRoaXMuX3NpemUgPT09IDApIHtcblx0XHRcdHRoaXMuX29uRHJhaW5lZC5maXJlKCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMub3V0c3RhbmRpbmdQcm9taXNlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHR0aGlzLmNvbnN1bWUoKTtcblx0XHR9XG5cdH1cblxuXHRjbGVhcigpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdPYmplY3QgaGFzIGJlZW4gZGlzcG9zZWQnKTtcblx0XHR9XG5cdFx0dGhpcy5vdXRzdGFuZGluZ1Byb21pc2VzLmxlbmd0aCA9IDA7XG5cdFx0dGhpcy5fc2l6ZSA9IHRoaXMucnVubmluZ1Byb21pc2VzO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9pc0Rpc3Bvc2VkID0gdHJ1ZTtcblx0XHR0aGlzLm91dHN0YW5kaW5nUHJvbWlzZXMubGVuZ3RoID0gMDsgLy8gc3RvcCBmdXJ0aGVyIHByb2Nlc3Npbmdcblx0XHR0aGlzLl9zaXplID0gMDtcblx0XHR0aGlzLl9vbkRyYWluZWQuZGlzcG9zZSgpO1xuXHR9XG59XG5cbi8qKlxuICogQSBxdWV1ZSBpcyBoYW5kbGVzIG9uZSBwcm9taXNlIGF0IGEgdGltZSBhbmQgZ3VhcmFudGVlcyB0aGF0IGF0IGFueSB0aW1lIG9ubHkgb25lIHByb21pc2UgaXMgZXhlY3V0aW5nLlxuICovXG5leHBvcnQgY2xhc3MgUXVldWU8VD4gZXh0ZW5kcyBMaW1pdGVyPFQ+IHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcigxKTtcblx0fVxufVxuXG4vKipcbiAqIFNhbWUgYXMgYFF1ZXVlYCwgZW5zdXJlcyB0aGF0IG9ubHkgMSB0YXNrIGlzIGV4ZWN1dGVkIGF0IHRoZSBzYW1lIHRpbWUuIFRoZSBkaWZmZXJlbmNlIHRvIGBRdWV1ZWAgaXMgdGhhdFxuICogdGhlcmUgaXMgb25seSAxIHRhc2sgYWJvdXQgdG8gYmUgc2NoZWR1bGVkIG5leHQuIEFzIHN1Y2gsIGNhbGxpbmcgYHF1ZXVlYCB3aGlsZSBhIHRhc2sgaXMgZXhlY3V0aW5nIHdpbGxcbiAqIHJlcGxhY2UgdGhlIGN1cnJlbnRseSBxdWV1ZWQgdGFzayB1bnRpbCBpdCBleGVjdXRlcy5cbiAqXG4gKiBBcyBzdWNoLCB0aGUgcmV0dXJuZWQgcHJvbWlzZSBtYXkgbm90IGJlIGZyb20gdGhlIGZhY3RvcnkgdGhhdCBpcyBwYXNzZWQgaW4gYnV0IGZyb20gdGhlIG5leHQgZmFjdG9yeSB0aGF0XG4gKiBpcyBydW5uaW5nIGFmdGVyIGhhdmluZyBjYWxsZWQgYHF1ZXVlYC5cbiAqL1xuZXhwb3J0IGNsYXNzIExpbWl0ZWRRdWV1ZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBzZXF1ZW50aWFsaXplciA9IG5ldyBUYXNrU2VxdWVudGlhbGl6ZXIoKTtcblxuXHRwcml2YXRlIHRhc2tzID0gMDtcblxuXHRxdWV1ZShmYWN0b3J5OiBJVGFzazxQcm9taXNlPHZvaWQ+Pik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5zZXF1ZW50aWFsaXplci5pc1J1bm5pbmcoKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuc2VxdWVudGlhbGl6ZXIucnVuKHRoaXMudGFza3MrKywgZmFjdG9yeSgpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5zZXF1ZW50aWFsaXplci5xdWV1ZSgoKSA9PiB7XG5cdFx0XHRyZXR1cm4gdGhpcy5zZXF1ZW50aWFsaXplci5ydW4odGhpcy50YXNrcysrLCBmYWN0b3J5KCkpO1xuXHRcdH0pO1xuXHR9XG59XG5cbi8qKlxuICogQSBoZWxwZXIgdG8gb3JnYW5pemUgcXVldWVzIHBlciByZXNvdXJjZS4gVGhlIFJlc291cmNlUXVldWUgbWFrZXMgc3VyZSB0byBtYW5hZ2UgcXVldWVzIHBlciByZXNvdXJjZVxuICogYnkgZGlzcG9zaW5nIHRoZW0gb25jZSB0aGUgcXVldWUgaXMgZW1wdHkuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZXNvdXJjZVF1ZXVlIGltcGxlbWVudHMgSURpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgcXVldWVzID0gbmV3IE1hcDxzdHJpbmcsIFF1ZXVlPHZvaWQ+PigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZHJhaW5lcnMgPSBuZXcgU2V0PERlZmVycmVkUHJvbWlzZTx2b2lkPj4oKTtcblxuXHRwcml2YXRlIGRyYWluTGlzdGVuZXJzOiBEaXNwb3NhYmxlTWFwPG51bWJlcj4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZHJhaW5MaXN0ZW5lckNvdW50ID0gMDtcblxuXHRhc3luYyB3aGVuRHJhaW5lZCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5pc0RyYWluZWQoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByb21pc2UgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cdFx0dGhpcy5kcmFpbmVycy5hZGQocHJvbWlzZSk7XG5cblx0XHRyZXR1cm4gcHJvbWlzZS5wO1xuXHR9XG5cblx0cHJpdmF0ZSBpc0RyYWluZWQoKTogYm9vbGVhbiB7XG5cdFx0Zm9yIChjb25zdCBbLCBxdWV1ZV0gb2YgdGhpcy5xdWV1ZXMpIHtcblx0XHRcdGlmIChxdWV1ZS5zaXplID4gMCkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRxdWV1ZVNpemUocmVzb3VyY2U6IFVSSSwgZXh0VXJpOiBJRXh0VXJpID0gZGVmYXVsdEV4dFVyaSk6IG51bWJlciB7XG5cdFx0Y29uc3Qga2V5ID0gZXh0VXJpLmdldENvbXBhcmlzb25LZXkocmVzb3VyY2UpO1xuXG5cdFx0cmV0dXJuIHRoaXMucXVldWVzLmdldChrZXkpPy5zaXplID8/IDA7XG5cdH1cblxuXHRxdWV1ZUZvcihyZXNvdXJjZTogVVJJLCBmYWN0b3J5OiBJVGFzazxQcm9taXNlPHZvaWQ+PiwgZXh0VXJpOiBJRXh0VXJpID0gZGVmYXVsdEV4dFVyaSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGtleSA9IGV4dFVyaS5nZXRDb21wYXJpc29uS2V5KHJlc291cmNlKTtcblxuXHRcdGxldCBxdWV1ZSA9IHRoaXMucXVldWVzLmdldChrZXkpO1xuXHRcdGlmICghcXVldWUpIHtcblx0XHRcdHF1ZXVlID0gbmV3IFF1ZXVlPHZvaWQ+KCk7XG5cdFx0XHRjb25zdCBkcmFpbkxpc3RlbmVySWQgPSB0aGlzLmRyYWluTGlzdGVuZXJDb3VudCsrO1xuXHRcdFx0Y29uc3QgZHJhaW5MaXN0ZW5lciA9IEV2ZW50Lm9uY2UocXVldWUub25EcmFpbmVkKSgoKSA9PiB7XG5cdFx0XHRcdHF1ZXVlPy5kaXNwb3NlKCk7XG5cdFx0XHRcdHRoaXMucXVldWVzLmRlbGV0ZShrZXkpO1xuXHRcdFx0XHR0aGlzLm9uRGlkUXVldWVEcmFpbigpO1xuXG5cdFx0XHRcdHRoaXMuZHJhaW5MaXN0ZW5lcnM/LmRlbGV0ZUFuZERpc3Bvc2UoZHJhaW5MaXN0ZW5lcklkKTtcblxuXHRcdFx0XHRpZiAodGhpcy5kcmFpbkxpc3RlbmVycz8uc2l6ZSA9PT0gMCkge1xuXHRcdFx0XHRcdHRoaXMuZHJhaW5MaXN0ZW5lcnMuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHRoaXMuZHJhaW5MaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoIXRoaXMuZHJhaW5MaXN0ZW5lcnMpIHtcblx0XHRcdFx0dGhpcy5kcmFpbkxpc3RlbmVycyA9IG5ldyBEaXNwb3NhYmxlTWFwKCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmRyYWluTGlzdGVuZXJzLnNldChkcmFpbkxpc3RlbmVySWQsIGRyYWluTGlzdGVuZXIpO1xuXG5cdFx0XHR0aGlzLnF1ZXVlcy5zZXQoa2V5LCBxdWV1ZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHF1ZXVlLnF1ZXVlKGZhY3RvcnkpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZFF1ZXVlRHJhaW4oKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmlzRHJhaW5lZCgpKSB7XG5cdFx0XHRyZXR1cm47IC8vIG5vdCBkb25lIHlldFxuXHRcdH1cblxuXHRcdHRoaXMucmVsZWFzZURyYWluZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbGVhc2VEcmFpbmVycygpOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IGRyYWluZXIgb2YgdGhpcy5kcmFpbmVycykge1xuXHRcdFx0ZHJhaW5lci5jb21wbGV0ZSgpO1xuXHRcdH1cblxuXHRcdHRoaXMuZHJhaW5lcnMuY2xlYXIoKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBbLCBxdWV1ZV0gb2YgdGhpcy5xdWV1ZXMpIHtcblx0XHRcdHF1ZXVlLmRpc3Bvc2UoKTtcblx0XHR9XG5cblx0XHR0aGlzLnF1ZXVlcy5jbGVhcigpO1xuXG5cdFx0Ly8gRXZlbiB0aG91Z2ggd2UgbWlnaHQgc3RpbGwgaGF2ZSBwZW5kaW5nXG5cdFx0Ly8gdGFza3MgcXVldWVkLCBhZnRlciB0aGUgcXVldWVzIGhhdmUgYmVlblxuXHRcdC8vIGRpc3Bvc2VkLCB3ZSBjYW4gbm8gbG9uZ2VyIHRyYWNrIHRoZW0sIHNvXG5cdFx0Ly8gd2UgcmVsZWFzZSBkcmFpbmVycyB0byBwcmV2ZW50IGhhbmdpbmdcblx0XHQvLyBwcm9taXNlcyB3aGVuIHRoZSByZXNvdXJjZSBxdWV1ZSBpcyBiZWluZ1xuXHRcdC8vIGRpc3Bvc2VkLlxuXHRcdHRoaXMucmVsZWFzZURyYWluZXJzKCk7XG5cblx0XHR0aGlzLmRyYWluTGlzdGVuZXJzPy5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRpbWVvdXRUaW1lciBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSBfdG9rZW46IGFueTtcblx0cHJpdmF0ZSBfaXNEaXNwb3NlZCA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKCk7XG5cdGNvbnN0cnVjdG9yKHJ1bm5lcjogKCkgPT4gdm9pZCwgdGltZW91dDogbnVtYmVyKTtcblx0Y29uc3RydWN0b3IocnVubmVyPzogKCkgPT4gdm9pZCwgdGltZW91dD86IG51bWJlcikge1xuXHRcdHRoaXMuX3Rva2VuID0gLTE7XG5cblx0XHRpZiAodHlwZW9mIHJ1bm5lciA9PT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgdGltZW91dCA9PT0gJ251bWJlcicpIHtcblx0XHRcdHRoaXMuc2V0SWZOb3RTZXQocnVubmVyLCB0aW1lb3V0KTtcblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuY2FuY2VsKCk7XG5cdFx0dGhpcy5faXNEaXNwb3NlZCA9IHRydWU7XG5cdH1cblxuXHRjYW5jZWwoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3Rva2VuICE9PSAtMSkge1xuXHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMuX3Rva2VuKTtcblx0XHRcdHRoaXMuX3Rva2VuID0gLTE7XG5cdFx0fVxuXHR9XG5cblx0Y2FuY2VsQW5kU2V0KHJ1bm5lcjogKCkgPT4gdm9pZCwgdGltZW91dDogbnVtYmVyKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2lzRGlzcG9zZWQpIHtcblx0XHRcdHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoYENhbGxpbmcgJ2NhbmNlbEFuZFNldCcgb24gYSBkaXNwb3NlZCBUaW1lb3V0VGltZXJgKTtcblx0XHR9XG5cblx0XHR0aGlzLmNhbmNlbCgpO1xuXHRcdHRoaXMuX3Rva2VuID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLl90b2tlbiA9IC0xO1xuXHRcdFx0cnVubmVyKCk7XG5cdFx0fSwgdGltZW91dCk7XG5cdH1cblxuXHRzZXRJZk5vdFNldChydW5uZXI6ICgpID0+IHZvaWQsIHRpbWVvdXQ6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKGBDYWxsaW5nICdzZXRJZk5vdFNldCcgb24gYSBkaXNwb3NlZCBUaW1lb3V0VGltZXJgKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fdG9rZW4gIT09IC0xKSB7XG5cdFx0XHQvLyB0aW1lciBpcyBhbHJlYWR5IHNldFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl90b2tlbiA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5fdG9rZW4gPSAtMTtcblx0XHRcdHJ1bm5lcigpO1xuXHRcdH0sIHRpbWVvdXQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBJbnRlcnZhbFRpbWVyIGltcGxlbWVudHMgSURpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgZGlzcG9zYWJsZTogSURpc3Bvc2FibGUgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHByaXZhdGUgaXNEaXNwb3NlZCA9IGZhbHNlO1xuXG5cdGNhbmNlbCgpOiB2b2lkIHtcblx0XHR0aGlzLmRpc3Bvc2FibGU/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLmRpc3Bvc2FibGUgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRjYW5jZWxBbmRTZXQocnVubmVyOiAoKSA9PiB2b2lkLCBpbnRlcnZhbDogbnVtYmVyLCBjb250ZXh0ID0gZ2xvYmFsVGhpcyk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmlzRGlzcG9zZWQpIHtcblx0XHRcdHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoYENhbGxpbmcgJ2NhbmNlbEFuZFNldCcgb24gYSBkaXNwb3NlZCBJbnRlcnZhbFRpbWVyYCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5jYW5jZWwoKTtcblx0XHRjb25zdCBoYW5kbGUgPSBjb250ZXh0LnNldEludGVydmFsKCgpID0+IHtcblx0XHRcdHJ1bm5lcigpO1xuXHRcdH0sIGludGVydmFsKTtcblxuXHRcdHRoaXMuZGlzcG9zYWJsZSA9IHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRjb250ZXh0LmNsZWFySW50ZXJ2YWwoaGFuZGxlKTtcblx0XHRcdHRoaXMuZGlzcG9zYWJsZSA9IHVuZGVmaW5lZDtcblx0XHR9KTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5jYW5jZWwoKTtcblx0XHR0aGlzLmlzRGlzcG9zZWQgPSB0cnVlO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBSdW5PbmNlU2NoZWR1bGVyIGltcGxlbWVudHMgSURpc3Bvc2FibGUge1xuXG5cdHByb3RlY3RlZCBydW5uZXI6ICgoLi4uYXJnczogdW5rbm93bltdKSA9PiB2b2lkKSB8IG51bGw7XG5cblx0cHJpdmF0ZSB0aW1lb3V0VG9rZW46IGFueTtcblx0cHJpdmF0ZSB0aW1lb3V0OiBudW1iZXI7XG5cdHByaXZhdGUgdGltZW91dEhhbmRsZXI6ICgpID0+IHZvaWQ7XG5cblx0Y29uc3RydWN0b3IocnVubmVyOiAoLi4uYXJnczogYW55W10pID0+IHZvaWQsIGRlbGF5OiBudW1iZXIpIHtcblx0XHR0aGlzLnRpbWVvdXRUb2tlbiA9IC0xO1xuXHRcdHRoaXMucnVubmVyID0gcnVubmVyO1xuXHRcdHRoaXMudGltZW91dCA9IGRlbGF5O1xuXHRcdHRoaXMudGltZW91dEhhbmRsZXIgPSB0aGlzLm9uVGltZW91dC5iaW5kKHRoaXMpO1xuXHR9XG5cblx0LyoqXG5cdCAqIERpc3Bvc2UgUnVuT25jZVNjaGVkdWxlclxuXHQgKi9cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmNhbmNlbCgpO1xuXHRcdHRoaXMucnVubmVyID0gbnVsbDtcblx0fVxuXG5cdC8qKlxuXHQgKiBDYW5jZWwgY3VycmVudCBzY2hlZHVsZWQgcnVubmVyIChpZiBhbnkpLlxuXHQgKi9cblx0Y2FuY2VsKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmlzU2NoZWR1bGVkKCkpIHtcblx0XHRcdGNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXRUb2tlbik7XG5cdFx0XHR0aGlzLnRpbWVvdXRUb2tlbiA9IC0xO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBDYW5jZWwgcHJldmlvdXMgcnVubmVyIChpZiBhbnkpICYgc2NoZWR1bGUgYSBuZXcgcnVubmVyLlxuXHQgKi9cblx0c2NoZWR1bGUoZGVsYXkgPSB0aGlzLnRpbWVvdXQpOiB2b2lkIHtcblx0XHR0aGlzLmNhbmNlbCgpO1xuXHRcdHRoaXMudGltZW91dFRva2VuID0gc2V0VGltZW91dCh0aGlzLnRpbWVvdXRIYW5kbGVyLCBkZWxheSk7XG5cdH1cblxuXHRnZXQgZGVsYXkoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy50aW1lb3V0O1xuXHR9XG5cblx0c2V0IGRlbGF5KHZhbHVlOiBudW1iZXIpIHtcblx0XHR0aGlzLnRpbWVvdXQgPSB2YWx1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRydWUgaWYgc2NoZWR1bGVkLlxuXHQgKi9cblx0aXNTY2hlZHVsZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMudGltZW91dFRva2VuICE9PSAtMTtcblx0fVxuXG5cdGZsdXNoKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmlzU2NoZWR1bGVkKCkpIHtcblx0XHRcdHRoaXMuY2FuY2VsKCk7XG5cdFx0XHR0aGlzLmRvUnVuKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvblRpbWVvdXQoKSB7XG5cdFx0dGhpcy50aW1lb3V0VG9rZW4gPSAtMTtcblx0XHRpZiAodGhpcy5ydW5uZXIpIHtcblx0XHRcdHRoaXMuZG9SdW4oKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgZG9SdW4oKTogdm9pZCB7XG5cdFx0dGhpcy5ydW5uZXI/LigpO1xuXHR9XG59XG5cbi8qKlxuICogU2FtZSBhcyBgUnVuT25jZVNjaGVkdWxlcmAsIGJ1dCBkb2Vzbid0IGNvdW50IHRoZSB0aW1lIHNwZW50IGluIHNsZWVwIG1vZGUuXG4gKiA+ICoqTk9URSoqOiBPbmx5IG9mZmVycyAxcyByZXNvbHV0aW9uLlxuICpcbiAqIFdoZW4gY2FsbGluZyBgc2V0VGltZW91dGAgd2l0aCAzaHJzLCBhbmQgcHV0dGluZyB0aGUgY29tcHV0ZXIgaW1tZWRpYXRlbHkgdG8gc2xlZXBcbiAqIGZvciA4aHJzLCBgc2V0VGltZW91dGAgd2lsbCBmaXJlICoqYXMgc29vbiBhcyB0aGUgY29tcHV0ZXIgd2FrZXMgZnJvbSBzbGVlcCoqLiBCdXRcbiAqIHRoaXMgc2NoZWR1bGVyIHdpbGwgZXhlY3V0ZSAzaHJzICoqYWZ0ZXIgd2FraW5nIHRoZSBjb21wdXRlciBmcm9tIHNsZWVwKiouXG4gKi9cbmV4cG9ydCBjbGFzcyBQcm9jZXNzVGltZVJ1bk9uY2VTY2hlZHVsZXIge1xuXG5cdHByaXZhdGUgcnVubmVyOiAoKCkgPT4gdm9pZCkgfCBudWxsO1xuXHRwcml2YXRlIHRpbWVvdXQ6IG51bWJlcjtcblxuXHRwcml2YXRlIGNvdW50ZXI6IG51bWJlcjtcblx0cHJpdmF0ZSBpbnRlcnZhbFRva2VuOiBhbnk7XG5cdHByaXZhdGUgaW50ZXJ2YWxIYW5kbGVyOiAoKSA9PiB2b2lkO1xuXG5cdGNvbnN0cnVjdG9yKHJ1bm5lcjogKCkgPT4gdm9pZCwgZGVsYXk6IG51bWJlcikge1xuXHRcdGlmIChkZWxheSAlIDEwMDAgIT09IDApIHtcblx0XHRcdGNvbnNvbGUud2FybihgUHJvY2Vzc1RpbWVSdW5PbmNlU2NoZWR1bGVyIHJlc29sdXRpb24gaXMgMXMsICR7ZGVsYXl9bXMgaXMgbm90IGEgbXVsdGlwbGUgb2YgMTAwMG1zLmApO1xuXHRcdH1cblx0XHR0aGlzLnJ1bm5lciA9IHJ1bm5lcjtcblx0XHR0aGlzLnRpbWVvdXQgPSBkZWxheTtcblx0XHR0aGlzLmNvdW50ZXIgPSAwO1xuXHRcdHRoaXMuaW50ZXJ2YWxUb2tlbiA9IC0xO1xuXHRcdHRoaXMuaW50ZXJ2YWxIYW5kbGVyID0gdGhpcy5vbkludGVydmFsLmJpbmQodGhpcyk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuY2FuY2VsKCk7XG5cdFx0dGhpcy5ydW5uZXIgPSBudWxsO1xuXHR9XG5cblx0Y2FuY2VsKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmlzU2NoZWR1bGVkKCkpIHtcblx0XHRcdGNsZWFySW50ZXJ2YWwodGhpcy5pbnRlcnZhbFRva2VuKTtcblx0XHRcdHRoaXMuaW50ZXJ2YWxUb2tlbiA9IC0xO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBDYW5jZWwgcHJldmlvdXMgcnVubmVyIChpZiBhbnkpICYgc2NoZWR1bGUgYSBuZXcgcnVubmVyLlxuXHQgKi9cblx0c2NoZWR1bGUoZGVsYXkgPSB0aGlzLnRpbWVvdXQpOiB2b2lkIHtcblx0XHRpZiAoZGVsYXkgJSAxMDAwICE9PSAwKSB7XG5cdFx0XHRjb25zb2xlLndhcm4oYFByb2Nlc3NUaW1lUnVuT25jZVNjaGVkdWxlciByZXNvbHV0aW9uIGlzIDFzLCAke2RlbGF5fW1zIGlzIG5vdCBhIG11bHRpcGxlIG9mIDEwMDBtcy5gKTtcblx0XHR9XG5cdFx0dGhpcy5jYW5jZWwoKTtcblx0XHR0aGlzLmNvdW50ZXIgPSBNYXRoLmNlaWwoZGVsYXkgLyAxMDAwKTtcblx0XHR0aGlzLmludGVydmFsVG9rZW4gPSBzZXRJbnRlcnZhbCh0aGlzLmludGVydmFsSGFuZGxlciwgMTAwMCk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyB0cnVlIGlmIHNjaGVkdWxlZC5cblx0ICovXG5cdGlzU2NoZWR1bGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmludGVydmFsVG9rZW4gIT09IC0xO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkludGVydmFsKCkge1xuXHRcdHRoaXMuY291bnRlci0tO1xuXHRcdGlmICh0aGlzLmNvdW50ZXIgPiAwKSB7XG5cdFx0XHQvLyBzdGlsbCBuZWVkIHRvIHdhaXRcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyB0aW1lIGVsYXBzZWRcblx0XHRjbGVhckludGVydmFsKHRoaXMuaW50ZXJ2YWxUb2tlbik7XG5cdFx0dGhpcy5pbnRlcnZhbFRva2VuID0gLTE7XG5cdFx0dGhpcy5ydW5uZXI/LigpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBSdW5PbmNlV29ya2VyPFQ+IGV4dGVuZHMgUnVuT25jZVNjaGVkdWxlciB7XG5cblx0cHJpdmF0ZSB1bml0czogVFtdID0gW107XG5cblx0Y29uc3RydWN0b3IocnVubmVyOiAodW5pdHM6IFRbXSkgPT4gdm9pZCwgdGltZW91dDogbnVtYmVyKSB7XG5cdFx0c3VwZXIocnVubmVyLCB0aW1lb3V0KTtcblx0fVxuXG5cdHdvcmsodW5pdDogVCk6IHZvaWQge1xuXHRcdHRoaXMudW5pdHMucHVzaCh1bml0KTtcblxuXHRcdGlmICghdGhpcy5pc1NjaGVkdWxlZCgpKSB7XG5cdFx0XHR0aGlzLnNjaGVkdWxlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGRvUnVuKCk6IHZvaWQge1xuXHRcdGNvbnN0IHVuaXRzID0gdGhpcy51bml0cztcblx0XHR0aGlzLnVuaXRzID0gW107XG5cblx0XHR0aGlzLnJ1bm5lcj8uKHVuaXRzKTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy51bml0cyA9IFtdO1xuXG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRocm90dGxlZFdvcmtlck9wdGlvbnMge1xuXG5cdC8qKlxuXHQgKiBtYXhpbXVtIG9mIHVuaXRzIHRoZSB3b3JrZXIgd2lsbCBwYXNzIG9udG8gaGFuZGxlciBhdCBvbmNlXG5cdCAqL1xuXHRtYXhXb3JrQ2h1bmtTaXplOiBudW1iZXI7XG5cblx0LyoqXG5cdCAqIG1heGltdW0gb2YgdW5pdHMgdGhlIHdvcmtlciB3aWxsIGtlZXAgaW4gbWVtb3J5IGZvciBwcm9jZXNzaW5nXG5cdCAqL1xuXHRtYXhCdWZmZXJlZFdvcms6IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXHQvKipcblx0ICogZGVsYXkgYmVmb3JlIHByb2Nlc3NpbmcgdGhlIG5leHQgcm91bmQgb2YgY2h1bmtzIHdoZW4gY2h1bmsgc2l6ZSBleGNlZWRzIGxpbWl0c1xuXHQgKi9cblx0dGhyb3R0bGVEZWxheTogbnVtYmVyO1xuXG5cdC8qKlxuXHQgKiBXaGVuIGVuYWJsZWQgd2lsbCBndWFyYW50ZWUgdGhhdCB0d28gZGlzdGluY3QgY2FsbHMgdG8gYHdvcmsoKWAgYXJlIG5vdCBleGVjdXRlZFxuXHQgKiB3aXRob3V0IHRocm90dGxlIGRlbGF5IGJldHdlZW4gdGhlbS5cblx0ICogT3RoZXJ3aXNlIGlmIHRoZSB3b3JrZXIgaXNuJ3QgY3VycmVudGx5IHRocm90dGxpbmcgaXQgd2lsbCBleGVjdXRlIHdvcmsgaW1tZWRpYXRlbHkuXG5cdCAqL1xuXHR3YWl0VGhyb3R0bGVEZWxheUJldHdlZW5Xb3JrVW5pdHM/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIFRoZSBgVGhyb3R0bGVkV29ya2VyYCB3aWxsIGFjY2VwdCB1bml0cyBvZiB3b3JrIGBUYFxuICogdG8gaGFuZGxlLiBUaGUgY29udHJhY3QgaXM6XG4gKiAqIHRoZXJlIGlzIGEgbWF4aW11bSBvZiB1bml0cyB0aGUgd29ya2VyIGNhbiBoYW5kbGUgYXQgb25jZSAodmlhIGBtYXhXb3JrQ2h1bmtTaXplYClcbiAqICogdGhlcmUgaXMgYSBtYXhpbXVtIG9mIHVuaXRzIHRoZSB3b3JrZXIgd2lsbCBrZWVwIGluIG1lbW9yeSBmb3IgcHJvY2Vzc2luZyAodmlhIGBtYXhCdWZmZXJlZFdvcmtgKVxuICogKiBhZnRlciBoYXZpbmcgaGFuZGxlZCBgbWF4V29ya0NodW5rU2l6ZWAgdW5pdHMsIHRoZSB3b3JrZXIgbmVlZHMgdG8gcmVzdCAodmlhIGB0aHJvdHRsZURlbGF5YClcbiAqL1xuZXhwb3J0IGNsYXNzIFRocm90dGxlZFdvcmtlcjxUPiBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgcGVuZGluZ1dvcms6IFRbXSA9IFtdO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgdGhyb3R0bGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPFJ1bk9uY2VTY2hlZHVsZXI+KCkpO1xuXHRwcml2YXRlIGRpc3Bvc2VkID0gZmFsc2U7XG5cdHByaXZhdGUgbGFzdEV4ZWN1dGlvblRpbWUgPSAwO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgb3B0aW9uczogSVRocm90dGxlZFdvcmtlck9wdGlvbnMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBoYW5kbGVyOiAodW5pdHM6IFRbXSkgPT4gdm9pZFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRoZSBudW1iZXIgb2Ygd29yayB1bml0cyB0aGF0IGFyZSBwZW5kaW5nIHRvIGJlIHByb2Nlc3NlZC5cblx0ICovXG5cdGdldCBwZW5kaW5nKCk6IG51bWJlciB7IHJldHVybiB0aGlzLnBlbmRpbmdXb3JrLmxlbmd0aDsgfVxuXG5cdC8qKlxuXHQgKiBBZGQgdW5pdHMgdG8gYmUgd29ya2VkIG9uLiBVc2UgYHBlbmRpbmdgIHRvIGZpZ3VyZSBvdXRcblx0ICogaG93IG1hbnkgdW5pdHMgYXJlIG5vdCB5ZXQgcHJvY2Vzc2VkIGFmdGVyIHRoaXMgbWV0aG9kXG5cdCAqIHdhcyBjYWxsZWQuXG5cdCAqXG5cdCAqIEByZXR1cm5zIHdoZXRoZXIgdGhlIHdvcmsgd2FzIGFjY2VwdGVkIG9yIG5vdC4gSWYgdGhlXG5cdCAqIHdvcmtlciBpcyBkaXNwb3NlZCwgaXQgd2lsbCBub3QgYWNjZXB0IGFueSBtb3JlIHdvcmsuXG5cdCAqIElmIHRoZSBudW1iZXIgb2YgcGVuZGluZyB1bml0cyB3b3VsZCBiZWNvbWUgbGFyZ2VyXG5cdCAqIHRoYW4gYG1heFBlbmRpbmdXb3JrYCwgbW9yZSB3b3JrIHdpbGwgYWxzbyBub3QgYmUgYWNjZXB0ZWQuXG5cdCAqL1xuXHR3b3JrKHVuaXRzOiByZWFkb25seSBUW10pOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5kaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlOyAvLyB3b3JrIG5vdCBhY2NlcHRlZDogZGlzcG9zZWRcblx0XHR9XG5cblx0XHQvLyBDaGVjayBmb3IgcmVhY2hpbmcgbWF4aW11bSBvZiBwZW5kaW5nIHdvcmtcblx0XHRpZiAodHlwZW9mIHRoaXMub3B0aW9ucy5tYXhCdWZmZXJlZFdvcmsgPT09ICdudW1iZXInKSB7XG5cblx0XHRcdC8vIFRocm90dGxlZDogc2ltcGxlIGNoZWNrIGlmIHBlbmRpbmcgKyB1bml0cyBleGNlZWRzIG1heCBwZW5kaW5nXG5cdFx0XHRpZiAodGhpcy50aHJvdHRsZXIudmFsdWUpIHtcblx0XHRcdFx0aWYgKHRoaXMucGVuZGluZyArIHVuaXRzLmxlbmd0aCA+IHRoaXMub3B0aW9ucy5tYXhCdWZmZXJlZFdvcmspIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7IC8vIHdvcmsgbm90IGFjY2VwdGVkOiB0b28gbXVjaCBwZW5kaW5nIHdvcmtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBVbnRocm90dGxlZDogc2FtZSBhcyB0aHJvdHRsZWQsIGJ1dCBhY2NvdW50IGZvciBtYXggY2h1bmsgZ2V0dGluZ1xuXHRcdFx0Ly8gd29ya2VkIG9uIGRpcmVjdGx5IHdpdGhvdXQgYmVpbmcgcGVuZGluZ1xuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGlmICh0aGlzLnBlbmRpbmcgKyB1bml0cy5sZW5ndGggLSB0aGlzLm9wdGlvbnMubWF4V29ya0NodW5rU2l6ZSA+IHRoaXMub3B0aW9ucy5tYXhCdWZmZXJlZFdvcmspIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7IC8vIHdvcmsgbm90IGFjY2VwdGVkOiB0b28gbXVjaCBwZW5kaW5nIHdvcmtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEFkZCB0byBwZW5kaW5nIHVuaXRzIGZpcnN0XG5cdFx0Zm9yIChjb25zdCB1bml0IG9mIHVuaXRzKSB7XG5cdFx0XHR0aGlzLnBlbmRpbmdXb3JrLnB1c2godW5pdCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGltZVNpbmNlTGFzdEV4ZWN1dGlvbiA9IERhdGUubm93KCkgLSB0aGlzLmxhc3RFeGVjdXRpb25UaW1lO1xuXG5cdFx0aWYgKCF0aGlzLnRocm90dGxlci52YWx1ZSAmJiAoIXRoaXMub3B0aW9ucy53YWl0VGhyb3R0bGVEZWxheUJldHdlZW5Xb3JrVW5pdHMgfHwgdGltZVNpbmNlTGFzdEV4ZWN1dGlvbiA+PSB0aGlzLm9wdGlvbnMudGhyb3R0bGVEZWxheSkpIHtcblx0XHRcdC8vIFdvcmsgZGlyZWN0bHkgaWYgd2UgYXJlIG5vdCB0aHJvdHRsaW5nIGFuZCB3ZSBhcmUgbm90XG5cdFx0XHQvLyBlbmZvcmNlZCB0byB0aHJvdHRsZSBiZXR3ZWVuIGB3b3JrKClgIGNhbGxzLlxuXHRcdFx0dGhpcy5kb1dvcmsoKTtcblx0XHR9IGVsc2UgaWYgKCF0aGlzLnRocm90dGxlci52YWx1ZSAmJiB0aGlzLm9wdGlvbnMud2FpdFRocm90dGxlRGVsYXlCZXR3ZWVuV29ya1VuaXRzKSB7XG5cdFx0XHQvLyBPdGhlcndpc2UsIHNjaGVkdWxlIHRoZSB0aHJvdHRsZXIgdG8gd29yay5cblx0XHRcdHRoaXMuc2NoZWR1bGVUaHJvdHRsZXIoTWF0aC5tYXgodGhpcy5vcHRpb25zLnRocm90dGxlRGVsYXkgLSB0aW1lU2luY2VMYXN0RXhlY3V0aW9uLCAwKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIE90aGVyd2lzZSwgb3VyIHdvcmsgd2lsbCBiZSBwaWNrZWQgdXAgYnkgdGhlIHJ1bm5pbmcgdGhyb3R0bGVyXG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7IC8vIHdvcmsgYWNjZXB0ZWRcblx0fVxuXG5cdHByaXZhdGUgZG9Xb3JrKCk6IHZvaWQge1xuXHRcdHRoaXMubGFzdEV4ZWN1dGlvblRpbWUgPSBEYXRlLm5vdygpO1xuXG5cdFx0Ly8gRXh0cmFjdCBjaHVuayB0byBoYW5kbGUgYW5kIGhhbmRsZSBpdFxuXHRcdHRoaXMuaGFuZGxlcih0aGlzLnBlbmRpbmdXb3JrLnNwbGljZSgwLCB0aGlzLm9wdGlvbnMubWF4V29ya0NodW5rU2l6ZSkpO1xuXG5cdFx0Ly8gSWYgd2UgaGF2ZSByZW1haW5pbmcgd29yaywgc2NoZWR1bGUgaXQgYWZ0ZXIgYSBkZWxheVxuXHRcdGlmICh0aGlzLnBlbmRpbmdXb3JrLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuc2NoZWR1bGVUaHJvdHRsZXIoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNjaGVkdWxlVGhyb3R0bGVyKGRlbGF5ID0gdGhpcy5vcHRpb25zLnRocm90dGxlRGVsYXkpOiB2b2lkIHtcblx0XHR0aGlzLnRocm90dGxlci52YWx1ZSA9IG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHtcblx0XHRcdHRoaXMudGhyb3R0bGVyLmNsZWFyKCk7XG5cblx0XHRcdHRoaXMuZG9Xb3JrKCk7XG5cdFx0fSwgZGVsYXkpO1xuXHRcdHRoaXMudGhyb3R0bGVyLnZhbHVlLnNjaGVkdWxlKCk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblxuXHRcdHRoaXMuZGlzcG9zZWQgPSB0cnVlO1xuXHR9XG59XG5cbi8vI3JlZ2lvbiAtLSBydW4gb24gaWRsZSB0cmlja3MgLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBpbnRlcmZhY2UgSWRsZURlYWRsaW5lIHtcblx0cmVhZG9ubHkgZGlkVGltZW91dDogYm9vbGVhbjtcblx0dGltZVJlbWFpbmluZygpOiBudW1iZXI7XG59XG5cbnR5cGUgSWRsZUFwaSA9IFBpY2s8dHlwZW9mIGdsb2JhbFRoaXMsICdyZXF1ZXN0SWRsZUNhbGxiYWNrJyB8ICdjYW5jZWxJZGxlQ2FsbGJhY2snPjtcblxuXG4vKipcbiAqIEV4ZWN1dGUgdGhlIGNhbGxiYWNrIHRoZSBuZXh0IHRpbWUgdGhlIGJyb3dzZXIgaXMgaWRsZSwgcmV0dXJuaW5nIGFuXG4gKiB7QGxpbmsgSURpc3Bvc2FibGV9IHRoYXQgd2lsbCBjYW5jZWwgdGhlIGNhbGxiYWNrIHdoZW4gZGlzcG9zZWQuIFRoaXMgd3JhcHNcbiAqIFtyZXF1ZXN0SWRsZUNhbGxiYWNrXSBzbyBpdCB3aWxsIGZhbGxiYWNrIHRvIFtzZXRUaW1lb3V0XSBpZiB0aGUgZW52aXJvbm1lbnRcbiAqIGRvZXNuJ3Qgc3VwcG9ydCBpdC5cbiAqXG4gKiBAcGFyYW0gY2FsbGJhY2sgVGhlIGNhbGxiYWNrIHRvIHJ1biB3aGVuIGlkbGUsIHRoaXMgaW5jbHVkZXMgYW5cbiAqIFtJZGxlRGVhZGxpbmVdIHRoYXQgcHJvdmlkZXMgdGhlIHRpbWUgYWxsb3RlZCBmb3IgdGhlIGlkbGUgY2FsbGJhY2sgYnkgdGhlXG4gKiBicm93c2VyLiBOb3QgcmVzcGVjdGluZyB0aGlzIGRlYWRsaW5lIHdpbGwgcmVzdWx0IGluIGEgZGVncmFkZWQgdXNlclxuICogZXhwZXJpZW5jZS5cbiAqIEBwYXJhbSB0aW1lb3V0IEEgdGltZW91dCBhdCB3aGljaCBwb2ludCB0byBxdWV1ZSBubyBsb25nZXIgd2FpdCBmb3IgYW4gaWRsZVxuICogY2FsbGJhY2sgYnV0IHF1ZXVlIGl0IG9uIHRoZSByZWd1bGFyIGV2ZW50IGxvb3AgKGxpa2Ugc2V0VGltZW91dCkuIFR5cGljYWxseVxuICogdGhpcyBzaG91bGQgbm90IGJlIHVzZWQuXG4gKlxuICogW0lkbGVEZWFkbGluZV06IGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9JZGxlRGVhZGxpbmVcbiAqIFtyZXF1ZXN0SWRsZUNhbGxiYWNrXTogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1dpbmRvdy9yZXF1ZXN0SWRsZUNhbGxiYWNrXG4gKiBbc2V0VGltZW91dF06IGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9XaW5kb3cvc2V0VGltZW91dFxuICpcbiAqICoqTm90ZSoqIHRoYXQgdGhlcmUgaXMgYGRvbS50cyNydW5XaGVuV2luZG93SWRsZWAgd2hpY2ggaXMgYmV0dGVyIHN1aXRlZCB3aGVuIHJ1bm5pbmcgaW5zaWRlIGEgYnJvd3NlclxuICogY29udGV4dFxuICovXG5leHBvcnQgbGV0IHJ1bldoZW5HbG9iYWxJZGxlOiAoY2FsbGJhY2s6IChpZGxlOiBJZGxlRGVhZGxpbmUpID0+IHZvaWQsIHRpbWVvdXQ/OiBudW1iZXIpID0+IElEaXNwb3NhYmxlO1xuXG5leHBvcnQgbGV0IF9ydW5XaGVuSWRsZTogKHRhcmdldFdpbmRvdzogSWRsZUFwaSwgY2FsbGJhY2s6IChpZGxlOiBJZGxlRGVhZGxpbmUpID0+IHZvaWQsIHRpbWVvdXQ/OiBudW1iZXIpID0+IElEaXNwb3NhYmxlO1xuXG4oZnVuY3Rpb24gKCkge1xuXHRpZiAodHlwZW9mIGdsb2JhbFRoaXMucmVxdWVzdElkbGVDYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJyB8fCB0eXBlb2YgZ2xvYmFsVGhpcy5jYW5jZWxJZGxlQ2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHtcblx0XHRfcnVuV2hlbklkbGUgPSAoX3RhcmdldFdpbmRvdywgcnVubmVyLCB0aW1lb3V0PykgPT4ge1xuXHRcdFx0c2V0VGltZW91dDAoKCkgPT4ge1xuXHRcdFx0XHRpZiAoZGlzcG9zZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgZW5kID0gRGF0ZS5ub3coKSArIDE1OyAvLyBvbmUgZnJhbWUgYXQgNjRmcHNcblx0XHRcdFx0Y29uc3QgZGVhZGxpbmU6IElkbGVEZWFkbGluZSA9IHtcblx0XHRcdFx0XHRkaWRUaW1lb3V0OiB0cnVlLFxuXHRcdFx0XHRcdHRpbWVSZW1haW5pbmcoKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gTWF0aC5tYXgoMCwgZW5kIC0gRGF0ZS5ub3coKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRydW5uZXIoT2JqZWN0LmZyZWV6ZShkZWFkbGluZSkpO1xuXHRcdFx0fSk7XG5cdFx0XHRsZXQgZGlzcG9zZWQgPSBmYWxzZTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGRpc3Bvc2UoKSB7XG5cdFx0XHRcdFx0aWYgKGRpc3Bvc2VkKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGRpc3Bvc2VkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9O1xuXHR9IGVsc2Uge1xuXHRcdF9ydW5XaGVuSWRsZSA9ICh0YXJnZXRXaW5kb3c6IElkbGVBcGksIHJ1bm5lciwgdGltZW91dD8pID0+IHtcblx0XHRcdGNvbnN0IGhhbmRsZTogbnVtYmVyID0gdGFyZ2V0V2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2socnVubmVyLCB0eXBlb2YgdGltZW91dCA9PT0gJ251bWJlcicgPyB7IHRpbWVvdXQgfSA6IHVuZGVmaW5lZCk7XG5cdFx0XHRsZXQgZGlzcG9zZWQgPSBmYWxzZTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGRpc3Bvc2UoKSB7XG5cdFx0XHRcdFx0aWYgKGRpc3Bvc2VkKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGRpc3Bvc2VkID0gdHJ1ZTtcblx0XHRcdFx0XHR0YXJnZXRXaW5kb3cuY2FuY2VsSWRsZUNhbGxiYWNrKGhhbmRsZSk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fTtcblx0fVxuXHRydW5XaGVuR2xvYmFsSWRsZSA9IChydW5uZXIsIHRpbWVvdXQpID0+IF9ydW5XaGVuSWRsZShnbG9iYWxUaGlzLCBydW5uZXIsIHRpbWVvdXQpO1xufSkoKTtcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0SWRsZVZhbHVlPFQ+IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9leGVjdXRvcjogKCkgPT4gdm9pZDtcblx0cHJpdmF0ZSByZWFkb25seSBfaGFuZGxlOiBJRGlzcG9zYWJsZTtcblxuXHRwcml2YXRlIF9kaWRSdW46IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfdmFsdWU/OiBUO1xuXHRwcml2YXRlIF9lcnJvcjogdW5rbm93bjtcblxuXHRjb25zdHJ1Y3Rvcih0YXJnZXRXaW5kb3c6IElkbGVBcGksIGV4ZWN1dG9yOiAoKSA9PiBUKSB7XG5cdFx0dGhpcy5fZXhlY3V0b3IgPSAoKSA9PiB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0aGlzLl92YWx1ZSA9IGV4ZWN1dG9yKCk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0dGhpcy5fZXJyb3IgPSBlcnI7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHR0aGlzLl9kaWRSdW4gPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0dGhpcy5faGFuZGxlID0gX3J1bldoZW5JZGxlKHRhcmdldFdpbmRvdywgKCkgPT4gdGhpcy5fZXhlY3V0b3IoKSk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2hhbmRsZS5kaXNwb3NlKCk7XG5cdH1cblxuXHRnZXQgdmFsdWUoKTogVCB7XG5cdFx0aWYgKCF0aGlzLl9kaWRSdW4pIHtcblx0XHRcdHRoaXMuX2hhbmRsZS5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9leGVjdXRvcigpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fZXJyb3IpIHtcblx0XHRcdHRocm93IHRoaXMuX2Vycm9yO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fdmFsdWUhO1xuXHR9XG5cblx0Z2V0IGlzSW5pdGlhbGl6ZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2RpZFJ1bjtcblx0fVxufVxuXG4vKipcbiAqIEFuIGBJZGxlVmFsdWVgIHRoYXQgYWx3YXlzIHVzZXMgdGhlIGN1cnJlbnQgd2luZG93ICh3aGljaCBtaWdodCBiZSB0aHJvdHRsZWQgb3IgaW5hY3RpdmUpXG4gKlxuICogKipOb3RlKiogdGhhdCB0aGVyZSBpcyBgZG9tLnRzI1dpbmRvd0lkbGVWYWx1ZWAgd2hpY2ggaXMgYmV0dGVyIHN1aXRlZCB3aGVuIHJ1bm5pbmcgaW5zaWRlIGEgYnJvd3NlclxuICogY29udGV4dFxuICovXG5leHBvcnQgY2xhc3MgR2xvYmFsSWRsZVZhbHVlPFQ+IGV4dGVuZHMgQWJzdHJhY3RJZGxlVmFsdWU8VD4ge1xuXG5cdGNvbnN0cnVjdG9yKGV4ZWN1dG9yOiAoKSA9PiBUKSB7XG5cdFx0c3VwZXIoZ2xvYmFsVGhpcywgZXhlY3V0b3IpO1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmV0cnk8VD4odGFzazogSVRhc2s8UHJvbWlzZTxUPj4sIGRlbGF5OiBudW1iZXIsIHJldHJpZXM6IG51bWJlcik6IFByb21pc2U8VD4ge1xuXHRsZXQgbGFzdEVycm9yOiBFcnJvciB8IHVuZGVmaW5lZDtcblxuXHRmb3IgKGxldCBpID0gMDsgaSA8IHJldHJpZXM7IGkrKykge1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgdGFzaygpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRsYXN0RXJyb3IgPSBlcnJvcjtcblxuXHRcdFx0YXdhaXQgdGltZW91dChkZWxheSk7XG5cdFx0fVxuXHR9XG5cblx0dGhyb3cgbGFzdEVycm9yO1xufVxuXG4vLyNyZWdpb24gVGFzayBTZXF1ZW50aWFsaXplclxuXG5pbnRlcmZhY2UgSVJ1bm5pbmdUYXNrIHtcblx0cmVhZG9ubHkgdGFza0lkOiBudW1iZXI7XG5cdHJlYWRvbmx5IGNhbmNlbDogKCkgPT4gdm9pZDtcblx0cmVhZG9ubHkgcHJvbWlzZTogUHJvbWlzZTx2b2lkPjtcbn1cblxuaW50ZXJmYWNlIElRdWV1ZWRUYXNrIHtcblx0cmVhZG9ubHkgcHJvbWlzZTogUHJvbWlzZTx2b2lkPjtcblx0cmVhZG9ubHkgcHJvbWlzZVJlc29sdmU6ICgpID0+IHZvaWQ7XG5cdHJlYWRvbmx5IHByb21pc2VSZWplY3Q6IChlcnJvcjogRXJyb3IpID0+IHZvaWQ7XG5cdHJ1bjogSVRhc2s8UHJvbWlzZTx2b2lkPj47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRhc2tTZXF1ZW50aWFsaXplcldpdGhSdW5uaW5nVGFzayB7XG5cdHJlYWRvbmx5IHJ1bm5pbmc6IFByb21pc2U8dm9pZD47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRhc2tTZXF1ZW50aWFsaXplcldpdGhRdWV1ZWRUYXNrIHtcblx0cmVhZG9ubHkgcXVldWVkOiBJUXVldWVkVGFzaztcbn1cblxuLyoqXG4gKiBAZGVwcmVjYXRlZCB1c2UgYExpbWl0ZWRRdWV1ZWAgaW5zdGVhZCBmb3IgYW4gZWFzaWVyIHRvIHVzZSBBUElcbiAqL1xuZXhwb3J0IGNsYXNzIFRhc2tTZXF1ZW50aWFsaXplciB7XG5cblx0cHJpdmF0ZSBfcnVubmluZz86IElSdW5uaW5nVGFzaztcblx0cHJpdmF0ZSBfcXVldWVkPzogSVF1ZXVlZFRhc2s7XG5cblx0aXNSdW5uaW5nKHRhc2tJZD86IG51bWJlcik6IHRoaXMgaXMgSVRhc2tTZXF1ZW50aWFsaXplcldpdGhSdW5uaW5nVGFzayB7XG5cdFx0aWYgKHR5cGVvZiB0YXNrSWQgPT09ICdudW1iZXInKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcnVubmluZz8udGFza0lkID09PSB0YXNrSWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICEhdGhpcy5fcnVubmluZztcblx0fVxuXG5cdGdldCBydW5uaW5nKCk6IFByb21pc2U8dm9pZD4gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9ydW5uaW5nPy5wcm9taXNlO1xuXHR9XG5cblx0Y2FuY2VsUnVubmluZygpOiB2b2lkIHtcblx0XHR0aGlzLl9ydW5uaW5nPy5jYW5jZWwoKTtcblx0fVxuXG5cdHJ1bih0YXNrSWQ6IG51bWJlciwgcHJvbWlzZTogUHJvbWlzZTx2b2lkPiwgb25DYW5jZWw/OiAoKSA9PiB2b2lkLCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3J1bm5pbmcgPSB7IHRhc2tJZCwgY2FuY2VsOiAoKSA9PiBvbkNhbmNlbD8uKCksIHByb21pc2UgfTtcblxuXHRcdHByb21pc2UudGhlbigoKSA9PiB0aGlzLmRvbmVSdW5uaW5nKHRhc2tJZCksICgpID0+IHRoaXMuZG9uZVJ1bm5pbmcodGFza0lkKSk7XG5cblx0XHRyZXR1cm4gcHJvbWlzZTtcblx0fVxuXG5cdHByaXZhdGUgZG9uZVJ1bm5pbmcodGFza0lkOiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fcnVubmluZyAmJiB0YXNrSWQgPT09IHRoaXMuX3J1bm5pbmcudGFza0lkKSB7XG5cblx0XHRcdC8vIG9ubHkgc2V0IHJ1bm5pbmcgdG8gZG9uZSBpZiB0aGUgcHJvbWlzZSBmaW5pc2hlZCB0aGF0IGlzIGFzc29jaWF0ZWQgd2l0aCB0aGF0IHRhc2tJZFxuXHRcdFx0dGhpcy5fcnVubmluZyA9IHVuZGVmaW5lZDtcblxuXHRcdFx0Ly8gc2NoZWR1bGUgdGhlIHF1ZXVlZCB0YXNrIG5vdyB0aGF0IHdlIGFyZSBmcmVlIGlmIHdlIGhhdmUgYW55XG5cdFx0XHR0aGlzLnJ1blF1ZXVlZCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcnVuUXVldWVkKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9xdWV1ZWQpIHtcblx0XHRcdGNvbnN0IHF1ZXVlZCA9IHRoaXMuX3F1ZXVlZDtcblx0XHRcdHRoaXMuX3F1ZXVlZCA9IHVuZGVmaW5lZDtcblxuXHRcdFx0Ly8gUnVuIHF1ZXVlZCB0YXNrIGFuZCBjb21wbGV0ZSBvbiB0aGUgYXNzb2NpYXRlZCBwcm9taXNlXG5cdFx0XHRxdWV1ZWQucnVuKCkudGhlbihxdWV1ZWQucHJvbWlzZVJlc29sdmUsIHF1ZXVlZC5wcm9taXNlUmVqZWN0KTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogTm90ZTogdGhlIHByb21pc2UgdG8gc2NoZWR1bGUgYXMgbmV4dCBydW4gTVVTVCBpdHNlbGYgY2FsbCBgcnVuYC5cblx0ICogICAgICAgT3RoZXJ3aXNlLCB0aGlzIHNlcXVlbnRpYWxpemVyIHdpbGwgcmVwb3J0IGBmYWxzZWAgZm9yIGBpc1J1bm5pbmdgXG5cdCAqICAgICAgIGV2ZW4gd2hlbiB0aGlzIHRhc2sgaXMgcnVubmluZy4gTWlzc2luZyB0aGlzIGRldGFpbCBtZWFucyB0aGF0XG5cdCAqICAgICAgIHN1ZGRlbmx5IG11bHRpcGxlIHRhc2tzIHdpbGwgcnVuIGluIHBhcmFsbGVsLlxuXHQgKi9cblx0cXVldWUocnVuOiBJVGFzazxQcm9taXNlPHZvaWQ+Pik6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Ly8gdGhpcyBpcyBvdXIgZmlyc3QgcXVldWVkIHRhc2ssIHNvIHdlIGNyZWF0ZSBhc3NvY2lhdGVkIHByb21pc2Ugd2l0aCBpdFxuXHRcdC8vIHNvIHRoYXQgd2UgY2FuIHJldHVybiBhIHByb21pc2UgdGhhdCBjb21wbGV0ZXMgd2hlbiB0aGUgdGFzayBoYXNcblx0XHQvLyBjb21wbGV0ZWQuXG5cdFx0aWYgKCF0aGlzLl9xdWV1ZWQpIHtcblx0XHRcdGNvbnN0IHsgcHJvbWlzZSwgcmVzb2x2ZTogcHJvbWlzZVJlc29sdmUsIHJlamVjdDogcHJvbWlzZVJlamVjdCB9ID0gcHJvbWlzZVdpdGhSZXNvbHZlcnM8dm9pZD4oKTtcblx0XHRcdHRoaXMuX3F1ZXVlZCA9IHtcblx0XHRcdFx0cnVuLFxuXHRcdFx0XHRwcm9taXNlLFxuXHRcdFx0XHRwcm9taXNlUmVzb2x2ZTogcHJvbWlzZVJlc29sdmUhLFxuXHRcdFx0XHRwcm9taXNlUmVqZWN0OiBwcm9taXNlUmVqZWN0IVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyB3ZSBoYXZlIGEgcHJldmlvdXMgcXVldWVkIHRhc2ssIGp1c3Qgb3ZlcndyaXRlIGl0XG5cdFx0ZWxzZSB7XG5cdFx0XHR0aGlzLl9xdWV1ZWQucnVuID0gcnVuO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9xdWV1ZWQucHJvbWlzZTtcblx0fVxuXG5cdGhhc1F1ZXVlZCgpOiB0aGlzIGlzIElUYXNrU2VxdWVudGlhbGl6ZXJXaXRoUXVldWVkVGFzayB7XG5cdFx0cmV0dXJuICEhdGhpcy5fcXVldWVkO1xuXHR9XG5cblx0YXN5bmMgam9pbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fcXVldWVkPy5wcm9taXNlID8/IHRoaXMuX3J1bm5pbmc/LnByb21pc2U7XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvblxuXG4vKipcbiAqIFRoZSBgSW50ZXJ2YWxDb3VudGVyYCBhbGxvd3MgdG8gY291bnQgdGhlIG51bWJlclxuICogb2YgY2FsbHMgdG8gYGluY3JlbWVudCgpYCBvdmVyIGEgZHVyYXRpb24gb2ZcbiAqIGBpbnRlcnZhbGAuIFRoaXMgdXRpbGl0eSBjYW4gYmUgdXNlZCB0byBjb25kaXRpb25hbGx5XG4gKiB0aHJvdHRsZSBhIGZyZXF1ZW50IHRhc2sgd2hlbiBhIGNlcnRhaW4gdGhyZXNob2xkXG4gKiBpcyByZWFjaGVkLlxuICovXG5leHBvcnQgY2xhc3MgSW50ZXJ2YWxDb3VudGVyIHtcblxuXHRwcml2YXRlIGxhc3RJbmNyZW1lbnRUaW1lID0gMDtcblxuXHRwcml2YXRlIHZhbHVlID0gMDtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGludGVydmFsOiBudW1iZXIsIHByaXZhdGUgcmVhZG9ubHkgbm93Rm4gPSAoKSA9PiBEYXRlLm5vdygpKSB7IH1cblxuXHRpbmNyZW1lbnQoKTogbnVtYmVyIHtcblx0XHRjb25zdCBub3cgPSB0aGlzLm5vd0ZuKCk7XG5cblx0XHQvLyBXZSBhcmUgb3V0c2lkZSBvZiB0aGUgcmFuZ2Ugb2YgYGludGVydmFsYCBhbmQgYXMgc3VjaFxuXHRcdC8vIHN0YXJ0IGNvdW50aW5nIGZyb20gMCBhbmQgcmVtZW1iZXIgdGhlIHRpbWVcblx0XHRpZiAobm93IC0gdGhpcy5sYXN0SW5jcmVtZW50VGltZSA+IHRoaXMuaW50ZXJ2YWwpIHtcblx0XHRcdHRoaXMubGFzdEluY3JlbWVudFRpbWUgPSBub3c7XG5cdFx0XHR0aGlzLnZhbHVlID0gMDtcblx0XHR9XG5cblx0XHR0aGlzLnZhbHVlKys7XG5cblx0XHRyZXR1cm4gdGhpcy52YWx1ZTtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uXG5cbmV4cG9ydCB0eXBlIFZhbHVlQ2FsbGJhY2s8VCA9IHVua25vd24+ID0gKHZhbHVlOiBUIHwgUHJvbWlzZTxUPikgPT4gdm9pZDtcblxuY29uc3QgZW51bSBEZWZlcnJlZE91dGNvbWUge1xuXHRSZXNvbHZlZCxcblx0UmVqZWN0ZWRcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgcHJvbWlzZSB3aG9zZSByZXNvbHV0aW9uIG9yIHJlamVjdGlvbiBjYW4gYmUgY29udHJvbGxlZCBpbXBlcmF0aXZlbHkuXG4gKi9cbmV4cG9ydCBjbGFzcyBEZWZlcnJlZFByb21pc2U8VD4ge1xuXG5cdHByaXZhdGUgY29tcGxldGVDYWxsYmFjayE6IFZhbHVlQ2FsbGJhY2s8VD47XG5cdHByaXZhdGUgZXJyb3JDYWxsYmFjayE6IChlcnI6IHVua25vd24pID0+IHZvaWQ7XG5cdHByaXZhdGUgb3V0Y29tZT86IHsgb3V0Y29tZTogRGVmZXJyZWRPdXRjb21lLlJlamVjdGVkOyB2YWx1ZTogYW55IH0gfCB7IG91dGNvbWU6IERlZmVycmVkT3V0Y29tZS5SZXNvbHZlZDsgdmFsdWU6IFQgfTtcblxuXHRwdWJsaWMgZ2V0IGlzUmVqZWN0ZWQoKSB7XG5cdFx0cmV0dXJuIHRoaXMub3V0Y29tZT8ub3V0Y29tZSA9PT0gRGVmZXJyZWRPdXRjb21lLlJlamVjdGVkO1xuXHR9XG5cblx0cHVibGljIGdldCBpc1Jlc29sdmVkKCkge1xuXHRcdHJldHVybiB0aGlzLm91dGNvbWU/Lm91dGNvbWUgPT09IERlZmVycmVkT3V0Y29tZS5SZXNvbHZlZDtcblx0fVxuXG5cdHB1YmxpYyBnZXQgaXNTZXR0bGVkKCkge1xuXHRcdHJldHVybiAhIXRoaXMub3V0Y29tZTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgdmFsdWUoKSB7XG5cdFx0cmV0dXJuIHRoaXMub3V0Y29tZT8ub3V0Y29tZSA9PT0gRGVmZXJyZWRPdXRjb21lLlJlc29sdmVkID8gdGhpcy5vdXRjb21lPy52YWx1ZSA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdHB1YmxpYyByZWFkb25seSBwOiBQcm9taXNlPFQ+O1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMucCA9IG5ldyBQcm9taXNlPFQ+KChjLCBlKSA9PiB7XG5cdFx0XHR0aGlzLmNvbXBsZXRlQ2FsbGJhY2sgPSBjO1xuXHRcdFx0dGhpcy5lcnJvckNhbGxiYWNrID0gZTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBjb21wbGV0ZSh2YWx1ZTogVCkge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHtcblx0XHRcdHRoaXMuY29tcGxldGVDYWxsYmFjayh2YWx1ZSk7XG5cdFx0XHR0aGlzLm91dGNvbWUgPSB7IG91dGNvbWU6IERlZmVycmVkT3V0Y29tZS5SZXNvbHZlZCwgdmFsdWUgfTtcblx0XHRcdHJlc29sdmUoKTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBlcnJvcihlcnI6IHVua25vd24pIHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHR0aGlzLmVycm9yQ2FsbGJhY2soZXJyKTtcblx0XHRcdHRoaXMub3V0Y29tZSA9IHsgb3V0Y29tZTogRGVmZXJyZWRPdXRjb21lLlJlamVjdGVkLCB2YWx1ZTogZXJyIH07XG5cdFx0XHRyZXNvbHZlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgY2FuY2VsKCkge1xuXHRcdHJldHVybiB0aGlzLmVycm9yKG5ldyBDYW5jZWxsYXRpb25FcnJvcigpKTtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIFByb21pc2VzXG5cbmV4cG9ydCBuYW1lc3BhY2UgUHJvbWlzZXMge1xuXG5cdC8qKlxuXHQgKiBBIGRyb3AtaW4gcmVwbGFjZW1lbnQgZm9yIGBQcm9taXNlLmFsbGAgd2l0aCB0aGUgb25seSBkaWZmZXJlbmNlXG5cdCAqIHRoYXQgdGhlIG1ldGhvZCBhd2FpdHMgZXZlcnkgcHJvbWlzZSB0byBlaXRoZXIgZnVsZmlsbCBvciByZWplY3QuXG5cdCAqXG5cdCAqIFNpbWlsYXIgdG8gYFByb21pc2UuYWxsYCwgb25seSB0aGUgZmlyc3QgZXJyb3Igd2lsbCBiZSByZXR1cm5lZFxuXHQgKiBpZiBhbnkuXG5cdCAqL1xuXHRleHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0dGxlZDxUPihwcm9taXNlczogUHJvbWlzZTxUPltdKTogUHJvbWlzZTxUW10+IHtcblx0XHRsZXQgZmlyc3RFcnJvcjogRXJyb3IgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcy5tYXAocHJvbWlzZSA9PiBwcm9taXNlLnRoZW4odmFsdWUgPT4gdmFsdWUsIGVycm9yID0+IHtcblx0XHRcdGlmICghZmlyc3RFcnJvcikge1xuXHRcdFx0XHRmaXJzdEVycm9yID0gZXJyb3I7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7IC8vIGRvIG5vdCByZXRocm93IHNvIHRoYXQgb3RoZXIgcHJvbWlzZXMgY2FuIHNldHRsZVxuXHRcdH0pKSk7XG5cblx0XHRpZiAodHlwZW9mIGZpcnN0RXJyb3IgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHR0aHJvdyBmaXJzdEVycm9yO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQgYXMgdW5rbm93biBhcyBUW107IC8vIGNhc3QgaXMgbmVlZGVkIGFuZCBwcm90ZWN0ZWQgYnkgdGhlIGB0aHJvd2AgYWJvdmVcblx0fVxuXG5cdC8qKlxuXHQgKiBBIGhlbHBlciB0byBjcmVhdGUgYSBuZXcgYFByb21pc2U8VD5gIHdpdGggYSBib2R5IHRoYXQgaXMgYSBwcm9taXNlXG5cdCAqIGl0c2VsZi4gQnkgZGVmYXVsdCwgYW4gZXJyb3IgdGhhdCByYWlzZXMgZnJvbSB0aGUgYXN5bmMgYm9keSB3aWxsXG5cdCAqIGVuZCB1cCBhcyBhIHVuaGFuZGxlZCByZWplY3Rpb24sIHNvIHRoaXMgdXRpbGl0eSBwcm9wZXJseSBhd2FpdHMgdGhlXG5cdCAqIGJvZHkgYW5kIHJlamVjdHMgdGhlIHByb21pc2UgYXMgYSBub3JtYWwgcHJvbWlzZSBkb2VzIHdpdGhvdXQgYXN5bmNcblx0ICogYm9keS5cblx0ICpcblx0ICogVGhpcyBtZXRob2Qgc2hvdWxkIG9ubHkgYmUgdXNlZCBpbiByYXJlIGNhc2VzIHdoZXJlIG90aGVyd2lzZSBgYXN5bmNgXG5cdCAqIGNhbm5vdCBiZSB1c2VkIChlLmcuIHdoZW4gY2FsbGJhY2tzIGFyZSBpbnZvbHZlZCB0aGF0IHJlcXVpcmUgdGhpcykuXG5cdCAqL1xuXHRleHBvcnQgZnVuY3Rpb24gd2l0aEFzeW5jQm9keTxULCBFID0gRXJyb3I+KGJvZHlGbjogKHJlc29sdmU6ICh2YWx1ZTogVCkgPT4gdW5rbm93biwgcmVqZWN0OiAoZXJyb3I6IEUpID0+IHVua25vd24pID0+IFByb21pc2U8dW5rbm93bj4pOiBQcm9taXNlPFQ+IHtcblx0XHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tYXN5bmMtcHJvbWlzZS1leGVjdXRvclxuXHRcdHJldHVybiBuZXcgUHJvbWlzZTxUPihhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCBib2R5Rm4ocmVzb2x2ZSwgcmVqZWN0KTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHJlamVjdChlcnJvcik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFN0YXRlZnVsUHJvbWlzZTxUPiB7XG5cdHByaXZhdGUgX3ZhbHVlOiBUIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRnZXQgdmFsdWUoKTogVCB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl92YWx1ZTsgfVxuXG5cdHByaXZhdGUgX2Vycm9yOiB1bmtub3duID0gdW5kZWZpbmVkO1xuXHRnZXQgZXJyb3IoKTogdW5rbm93biB7IHJldHVybiB0aGlzLl9lcnJvcjsgfVxuXG5cdHByaXZhdGUgX2lzUmVzb2x2ZWQgPSBmYWxzZTtcblx0Z2V0IGlzUmVzb2x2ZWQoKSB7IHJldHVybiB0aGlzLl9pc1Jlc29sdmVkOyB9XG5cblx0cHVibGljIHJlYWRvbmx5IHByb21pc2U6IFByb21pc2U8VD47XG5cblx0Y29uc3RydWN0b3IocHJvbWlzZTogUHJvbWlzZTxUPikge1xuXHRcdHRoaXMucHJvbWlzZSA9IHByb21pc2UudGhlbihcblx0XHRcdHZhbHVlID0+IHtcblx0XHRcdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0XHRcdFx0dGhpcy5faXNSZXNvbHZlZCA9IHRydWU7XG5cdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdH0sXG5cdFx0XHRlcnJvciA9PiB7XG5cdFx0XHRcdHRoaXMuX2Vycm9yID0gZXJyb3I7XG5cdFx0XHRcdHRoaXMuX2lzUmVzb2x2ZWQgPSB0cnVlO1xuXHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdH1cblx0XHQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIHJlc29sdmVkIHZhbHVlLlxuXHQgKiBUaHJvd3MgaWYgdGhlIHByb21pc2UgaXMgbm90IHJlc29sdmVkIHlldC5cblx0ICovXG5cdHB1YmxpYyByZXF1aXJlVmFsdWUoKTogVCB7XG5cdFx0aWYgKCF0aGlzLl9pc1Jlc29sdmVkKSB7XG5cdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCdQcm9taXNlIGlzIG5vdCByZXNvbHZlZCB5ZXQnKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2Vycm9yKSB7XG5cdFx0XHR0aHJvdyB0aGlzLl9lcnJvcjtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3ZhbHVlITtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTGF6eVN0YXRlZnVsUHJvbWlzZTxUPiB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb21pc2UgPSBuZXcgTGF6eSgoKSA9PiBuZXcgU3RhdGVmdWxQcm9taXNlKHRoaXMuX2NvbXB1dGUoKSkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2NvbXB1dGU6ICgpID0+IFByb21pc2U8VD4sXG5cdCkgeyB9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIHJlc29sdmVkIHZhbHVlLlxuXHQgKiBUaHJvd3MgaWYgdGhlIHByb21pc2UgaXMgbm90IHJlc29sdmVkIHlldC5cblx0ICovXG5cdHB1YmxpYyByZXF1aXJlVmFsdWUoKTogVCB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb21pc2UudmFsdWUucmVxdWlyZVZhbHVlKCk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgcHJvbWlzZSAoYW5kIHRyaWdnZXJzIGEgY29tcHV0YXRpb24gb2YgdGhlIHByb21pc2UgaWYgbm90IHlldCBkb25lIHNvKS5cblx0ICovXG5cdHB1YmxpYyBnZXRQcm9taXNlKCk6IFByb21pc2U8VD4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm9taXNlLnZhbHVlLnByb21pc2U7XG5cdH1cblxuXHQvKipcblx0ICogUmVhZHMgdGhlIGN1cnJlbnQgdmFsdWUgd2l0aG91dCB0cmlnZ2VyaW5nIGEgY29tcHV0YXRpb24gb2YgdGhlIHByb21pc2UuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0IGN1cnJlbnRWYWx1ZSgpOiBUIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fcHJvbWlzZS5yYXdWYWx1ZT8udmFsdWU7XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvblxuXG5jb25zdCBlbnVtIEFzeW5jSXRlcmFibGVTb3VyY2VTdGF0ZSB7XG5cdEluaXRpYWwsXG5cdERvbmVPSyxcblx0RG9uZUVycm9yLFxufVxuXG4vKipcbiAqIEFuIG9iamVjdCB0aGF0IGFsbG93cyB0byBlbWl0IGFzeW5jIHZhbHVlcyBhc3luY2hyb25vdXNseSBvciBicmluZyB0aGUgaXRlcmFibGUgdG8gYW4gZXJyb3Igc3RhdGUgdXNpbmcgYHJlamVjdCgpYC5cbiAqIFRoaXMgZW1pdHRlciBpcyB2YWxpZCBvbmx5IGZvciB0aGUgZHVyYXRpb24gb2YgdGhlIGV4ZWN1dG9yICh1bnRpbCB0aGUgcHJvbWlzZSByZXR1cm5lZCBieSB0aGUgZXhlY3V0b3Igc2V0dGxlcykuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQXN5bmNJdGVyYWJsZUVtaXR0ZXI8VD4ge1xuXHQvKipcblx0ICogVGhlIHZhbHVlIHdpbGwgYmUgYXBwZW5kZWQgYXQgdGhlIGVuZC5cblx0ICpcblx0ICogKipOT1RFKiogSWYgYHJlamVjdCgpYCBoYXMgYWxyZWFkeSBiZWVuIGNhbGxlZCwgdGhpcyBtZXRob2QgaGFzIG5vIGVmZmVjdC5cblx0ICovXG5cdGVtaXRPbmUodmFsdWU6IFQpOiB2b2lkO1xuXHQvKipcblx0ICogVGhlIHZhbHVlcyB3aWxsIGJlIGFwcGVuZGVkIGF0IHRoZSBlbmQuXG5cdCAqXG5cdCAqICoqTk9URSoqIElmIGByZWplY3QoKWAgaGFzIGFscmVhZHkgYmVlbiBjYWxsZWQsIHRoaXMgbWV0aG9kIGhhcyBubyBlZmZlY3QuXG5cdCAqL1xuXHRlbWl0TWFueSh2YWx1ZXM6IFRbXSk6IHZvaWQ7XG5cdC8qKlxuXHQgKiBXcml0aW5nIGFuIGVycm9yIHdpbGwgcGVybWFuZW50bHkgaW52YWxpZGF0ZSB0aGlzIGl0ZXJhYmxlLlxuXHQgKiBUaGUgY3VycmVudCB1c2VycyB3aWxsIHJlY2VpdmUgYW4gZXJyb3IgdGhyb3duLCBhcyB3aWxsIGFsbCBmdXR1cmUgdXNlcnMuXG5cdCAqXG5cdCAqICoqTk9URSoqIElmIGByZWplY3QoKWAgaGF2ZSBhbHJlYWR5IGJlZW4gY2FsbGVkLCB0aGlzIG1ldGhvZCBoYXMgbm8gZWZmZWN0LlxuXHQgKi9cblx0cmVqZWN0KGVycm9yOiBFcnJvcik6IHZvaWQ7XG59XG5cbi8qKlxuICogQW4gZXhlY3V0b3IgZm9yIHRoZSBgQXN5bmNJdGVyYWJsZU9iamVjdGAgdGhhdCBoYXMgYWNjZXNzIHRvIGFuIGVtaXR0ZXIuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQXN5bmNJdGVyYWJsZUV4ZWN1dG9yPFQ+IHtcblx0LyoqXG5cdCAqIEBwYXJhbSBlbWl0dGVyIEFuIG9iamVjdCB0aGF0IGFsbG93cyB0byBlbWl0IGFzeW5jIHZhbHVlcyB2YWxpZCBvbmx5IGZvciB0aGUgZHVyYXRpb24gb2YgdGhlIGV4ZWN1dG9yLlxuXHQgKi9cblx0KGVtaXR0ZXI6IEFzeW5jSXRlcmFibGVFbWl0dGVyPFQ+KTogdm9pZCB8IFByb21pc2U8dm9pZD47XG59XG5cbi8qKlxuICogQSByaWNoIGltcGxlbWVudGF0aW9uIGZvciBhbiBgQXN5bmNJdGVyYWJsZTxUPmAuXG4gKi9cbmV4cG9ydCBjbGFzcyBBc3luY0l0ZXJhYmxlT2JqZWN0PFQ+IGltcGxlbWVudHMgQXN5bmNJdGVyYWJsZTxUPiB7XG5cblx0cHVibGljIHN0YXRpYyBmcm9tQXJyYXk8VD4oaXRlbXM6IFRbXSk6IEFzeW5jSXRlcmFibGVPYmplY3Q8VD4ge1xuXHRcdHJldHVybiBuZXcgQXN5bmNJdGVyYWJsZU9iamVjdDxUPigod3JpdGVyKSA9PiB7XG5cdFx0XHR3cml0ZXIuZW1pdE1hbnkoaXRlbXMpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBmcm9tUHJvbWlzZTxUPihwcm9taXNlOiBQcm9taXNlPFRbXT4pOiBBc3luY0l0ZXJhYmxlT2JqZWN0PFQ+IHtcblx0XHRyZXR1cm4gbmV3IEFzeW5jSXRlcmFibGVPYmplY3Q8VD4oYXN5bmMgKGVtaXR0ZXIpID0+IHtcblx0XHRcdGVtaXR0ZXIuZW1pdE1hbnkoYXdhaXQgcHJvbWlzZSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGZyb21Qcm9taXNlc1Jlc29sdmVPcmRlcjxUPihwcm9taXNlczogUHJvbWlzZTxUPltdKTogQXN5bmNJdGVyYWJsZU9iamVjdDxUPiB7XG5cdFx0cmV0dXJuIG5ldyBBc3luY0l0ZXJhYmxlT2JqZWN0PFQ+KGFzeW5jIChlbWl0dGVyKSA9PiB7XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcy5tYXAoYXN5bmMgKHApID0+IGVtaXR0ZXIuZW1pdE9uZShhd2FpdCBwKSkpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBtZXJnZTxUPihpdGVyYWJsZXM6IEFzeW5jSXRlcmFibGU8VD5bXSk6IEFzeW5jSXRlcmFibGVPYmplY3Q8VD4ge1xuXHRcdHJldHVybiBuZXcgQXN5bmNJdGVyYWJsZU9iamVjdChhc3luYyAoZW1pdHRlcikgPT4ge1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwoaXRlcmFibGVzLm1hcChhc3luYyAoaXRlcmFibGUpID0+IHtcblx0XHRcdFx0Zm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGl0ZXJhYmxlKSB7XG5cdFx0XHRcdFx0ZW1pdHRlci5lbWl0T25lKGl0ZW0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIEVNUFRZID0gQXN5bmNJdGVyYWJsZU9iamVjdC5mcm9tQXJyYXk8YW55PihbXSk7XG5cblx0cHJpdmF0ZSBfc3RhdGU6IEFzeW5jSXRlcmFibGVTb3VyY2VTdGF0ZTtcblx0cHJpdmF0ZSBfcmVzdWx0czogVFtdO1xuXHRwcml2YXRlIF9lcnJvcjogRXJyb3IgfCBudWxsO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vblJldHVybj86ICgpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vblN0YXRlQ2hhbmdlZDogRW1pdHRlcjx2b2lkPjtcblxuXHRjb25zdHJ1Y3RvcihleGVjdXRvcjogQXN5bmNJdGVyYWJsZUV4ZWN1dG9yPFQ+LCBvblJldHVybj86ICgpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+KSB7XG5cdFx0dGhpcy5fc3RhdGUgPSBBc3luY0l0ZXJhYmxlU291cmNlU3RhdGUuSW5pdGlhbDtcblx0XHR0aGlzLl9yZXN1bHRzID0gW107XG5cdFx0dGhpcy5fZXJyb3IgPSBudWxsO1xuXHRcdHRoaXMuX29uUmV0dXJuID0gb25SZXR1cm47XG5cdFx0dGhpcy5fb25TdGF0ZUNoYW5nZWQgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXG5cdFx0cXVldWVNaWNyb3Rhc2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3Qgd3JpdGVyOiBBc3luY0l0ZXJhYmxlRW1pdHRlcjxUPiA9IHtcblx0XHRcdFx0ZW1pdE9uZTogKGl0ZW0pID0+IHRoaXMuZW1pdE9uZShpdGVtKSxcblx0XHRcdFx0ZW1pdE1hbnk6IChpdGVtcykgPT4gdGhpcy5lbWl0TWFueShpdGVtcyksXG5cdFx0XHRcdHJlamVjdDogKGVycm9yKSA9PiB0aGlzLnJlamVjdChlcnJvcilcblx0XHRcdH07XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoZXhlY3V0b3Iod3JpdGVyKSk7XG5cdFx0XHRcdHRoaXMucmVzb2x2ZSgpO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdHRoaXMucmVqZWN0KGVycik7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHR3cml0ZXIuZW1pdE9uZSA9IHVuZGVmaW5lZCE7XG5cdFx0XHRcdHdyaXRlci5lbWl0TWFueSA9IHVuZGVmaW5lZCE7XG5cdFx0XHRcdHdyaXRlci5yZWplY3QgPSB1bmRlZmluZWQhO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0W1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpOiBBc3luY0l0ZXJhdG9yPFQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkPiB7XG5cdFx0bGV0IGkgPSAwO1xuXHRcdHJldHVybiB7XG5cdFx0XHRuZXh0OiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGRvIHtcblx0XHRcdFx0XHRpZiAodGhpcy5fc3RhdGUgPT09IEFzeW5jSXRlcmFibGVTb3VyY2VTdGF0ZS5Eb25lRXJyb3IpIHtcblx0XHRcdFx0XHRcdHRocm93IHRoaXMuX2Vycm9yO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoaSA8IHRoaXMuX3Jlc3VsdHMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4geyBkb25lOiBmYWxzZSwgdmFsdWU6IHRoaXMuX3Jlc3VsdHNbaSsrXSB9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAodGhpcy5fc3RhdGUgPT09IEFzeW5jSXRlcmFibGVTb3VyY2VTdGF0ZS5Eb25lT0spIHtcblx0XHRcdFx0XHRcdHJldHVybiB7IGRvbmU6IHRydWUsIHZhbHVlOiB1bmRlZmluZWQgfTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YXdhaXQgRXZlbnQudG9Qcm9taXNlKHRoaXMuX29uU3RhdGVDaGFuZ2VkLmV2ZW50KTtcblx0XHRcdFx0fSB3aGlsZSAodHJ1ZSk7XG5cdFx0XHR9LFxuXHRcdFx0cmV0dXJuOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX29uUmV0dXJuPy4oKTtcblx0XHRcdFx0cmV0dXJuIHsgZG9uZTogdHJ1ZSwgdmFsdWU6IHVuZGVmaW5lZCB9O1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIG1hcDxULCBSPihpdGVyYWJsZTogQXN5bmNJdGVyYWJsZTxUPiwgbWFwRm46IChpdGVtOiBUKSA9PiBSKTogQXN5bmNJdGVyYWJsZU9iamVjdDxSPiB7XG5cdFx0cmV0dXJuIG5ldyBBc3luY0l0ZXJhYmxlT2JqZWN0PFI+KGFzeW5jIChlbWl0dGVyKSA9PiB7XG5cdFx0XHRmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgaXRlcmFibGUpIHtcblx0XHRcdFx0ZW1pdHRlci5lbWl0T25lKG1hcEZuKGl0ZW0pKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBtYXA8Uj4obWFwRm46IChpdGVtOiBUKSA9PiBSKTogQXN5bmNJdGVyYWJsZU9iamVjdDxSPiB7XG5cdFx0cmV0dXJuIEFzeW5jSXRlcmFibGVPYmplY3QubWFwKHRoaXMsIG1hcEZuKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZmlsdGVyPFQ+KGl0ZXJhYmxlOiBBc3luY0l0ZXJhYmxlPFQ+LCBmaWx0ZXJGbjogKGl0ZW06IFQpID0+IGJvb2xlYW4pOiBBc3luY0l0ZXJhYmxlT2JqZWN0PFQ+IHtcblx0XHRyZXR1cm4gbmV3IEFzeW5jSXRlcmFibGVPYmplY3Q8VD4oYXN5bmMgKGVtaXR0ZXIpID0+IHtcblx0XHRcdGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBpdGVyYWJsZSkge1xuXHRcdFx0XHRpZiAoZmlsdGVyRm4oaXRlbSkpIHtcblx0XHRcdFx0XHRlbWl0dGVyLmVtaXRPbmUoaXRlbSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBmaWx0ZXIoZmlsdGVyRm46IChpdGVtOiBUKSA9PiBib29sZWFuKTogQXN5bmNJdGVyYWJsZU9iamVjdDxUPiB7XG5cdFx0cmV0dXJuIEFzeW5jSXRlcmFibGVPYmplY3QuZmlsdGVyKHRoaXMsIGZpbHRlckZuKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgY29hbGVzY2U8VD4oaXRlcmFibGU6IEFzeW5jSXRlcmFibGU8VCB8IHVuZGVmaW5lZCB8IG51bGw+KTogQXN5bmNJdGVyYWJsZU9iamVjdDxUPiB7XG5cdFx0cmV0dXJuIDxBc3luY0l0ZXJhYmxlT2JqZWN0PFQ+PkFzeW5jSXRlcmFibGVPYmplY3QuZmlsdGVyKGl0ZXJhYmxlLCBpdGVtID0+ICEhaXRlbSk7XG5cdH1cblxuXHRwdWJsaWMgY29hbGVzY2UoKTogQXN5bmNJdGVyYWJsZU9iamVjdDxOb25OdWxsYWJsZTxUPj4ge1xuXHRcdHJldHVybiBBc3luY0l0ZXJhYmxlT2JqZWN0LmNvYWxlc2NlKHRoaXMpIGFzIEFzeW5jSXRlcmFibGVPYmplY3Q8Tm9uTnVsbGFibGU8VD4+O1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBhc3luYyB0b1Byb21pc2U8VD4oaXRlcmFibGU6IEFzeW5jSXRlcmFibGU8VD4pOiBQcm9taXNlPFRbXT4ge1xuXHRcdGNvbnN0IHJlc3VsdDogVFtdID0gW107XG5cdFx0Zm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGl0ZXJhYmxlKSB7XG5cdFx0XHRyZXN1bHQucHVzaChpdGVtKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyB0b1Byb21pc2UoKTogUHJvbWlzZTxUW10+IHtcblx0XHRyZXR1cm4gQXN5bmNJdGVyYWJsZU9iamVjdC50b1Byb21pc2UodGhpcyk7XG5cdH1cblxuXHQvKipcblx0ICogVGhlIHZhbHVlIHdpbGwgYmUgYXBwZW5kZWQgYXQgdGhlIGVuZC5cblx0ICpcblx0ICogKipOT1RFKiogSWYgYHJlc29sdmUoKWAgb3IgYHJlamVjdCgpYCBoYXZlIGFscmVhZHkgYmVlbiBjYWxsZWQsIHRoaXMgbWV0aG9kIGhhcyBubyBlZmZlY3QuXG5cdCAqL1xuXHRwcml2YXRlIGVtaXRPbmUodmFsdWU6IFQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fc3RhdGUgIT09IEFzeW5jSXRlcmFibGVTb3VyY2VTdGF0ZS5Jbml0aWFsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIGl0IGlzIGltcG9ydGFudCB0byBhZGQgbmV3IHZhbHVlcyBhdCB0aGUgZW5kLFxuXHRcdC8vIGFzIHdlIG1heSBoYXZlIGl0ZXJhdG9ycyBhbHJlYWR5IHJ1bm5pbmcgb24gdGhlIGFycmF5XG5cdFx0dGhpcy5fcmVzdWx0cy5wdXNoKHZhbHVlKTtcblx0XHR0aGlzLl9vblN0YXRlQ2hhbmdlZC5maXJlKCk7XG5cdH1cblxuXHQvKipcblx0ICogVGhlIHZhbHVlcyB3aWxsIGJlIGFwcGVuZGVkIGF0IHRoZSBlbmQuXG5cdCAqXG5cdCAqICoqTk9URSoqIElmIGByZXNvbHZlKClgIG9yIGByZWplY3QoKWAgaGF2ZSBhbHJlYWR5IGJlZW4gY2FsbGVkLCB0aGlzIG1ldGhvZCBoYXMgbm8gZWZmZWN0LlxuXHQgKi9cblx0cHJpdmF0ZSBlbWl0TWFueSh2YWx1ZXM6IFRbXSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9zdGF0ZSAhPT0gQXN5bmNJdGVyYWJsZVNvdXJjZVN0YXRlLkluaXRpYWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Ly8gaXQgaXMgaW1wb3J0YW50IHRvIGFkZCBuZXcgdmFsdWVzIGF0IHRoZSBlbmQsXG5cdFx0Ly8gYXMgd2UgbWF5IGhhdmUgaXRlcmF0b3JzIGFscmVhZHkgcnVubmluZyBvbiB0aGUgYXJyYXlcblx0XHR0aGlzLl9yZXN1bHRzID0gdGhpcy5fcmVzdWx0cy5jb25jYXQodmFsdWVzKTtcblx0XHR0aGlzLl9vblN0YXRlQ2hhbmdlZC5maXJlKCk7XG5cdH1cblxuXHQvKipcblx0ICogQ2FsbGluZyBgcmVzb2x2ZSgpYCB3aWxsIG1hcmsgdGhlIHJlc3VsdCBhcnJheSBhcyBjb21wbGV0ZS5cblx0ICpcblx0ICogKipOT1RFKiogYHJlc29sdmUoKWAgbXVzdCBiZSBjYWxsZWQsIG90aGVyd2lzZSBhbGwgY29uc3VtZXJzIG9mIHRoaXMgaXRlcmFibGUgd2lsbCBoYW5nIGluZGVmaW5pdGVseSwgc2ltaWxhciB0byBhIG5vbi1yZXNvbHZlZCBwcm9taXNlLlxuXHQgKiAqKk5PVEUqKiBJZiBgcmVzb2x2ZSgpYCBvciBgcmVqZWN0KClgIGhhdmUgYWxyZWFkeSBiZWVuIGNhbGxlZCwgdGhpcyBtZXRob2QgaGFzIG5vIGVmZmVjdC5cblx0ICovXG5cdHByaXZhdGUgcmVzb2x2ZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fc3RhdGUgIT09IEFzeW5jSXRlcmFibGVTb3VyY2VTdGF0ZS5Jbml0aWFsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3N0YXRlID0gQXN5bmNJdGVyYWJsZVNvdXJjZVN0YXRlLkRvbmVPSztcblx0XHR0aGlzLl9vblN0YXRlQ2hhbmdlZC5maXJlKCk7XG5cdH1cblxuXHQvKipcblx0ICogV3JpdGluZyBhbiBlcnJvciB3aWxsIHBlcm1hbmVudGx5IGludmFsaWRhdGUgdGhpcyBpdGVyYWJsZS5cblx0ICogVGhlIGN1cnJlbnQgdXNlcnMgd2lsbCByZWNlaXZlIGFuIGVycm9yIHRocm93biwgYXMgd2lsbCBhbGwgZnV0dXJlIHVzZXJzLlxuXHQgKlxuXHQgKiAqKk5PVEUqKiBJZiBgcmVzb2x2ZSgpYCBvciBgcmVqZWN0KClgIGhhdmUgYWxyZWFkeSBiZWVuIGNhbGxlZCwgdGhpcyBtZXRob2QgaGFzIG5vIGVmZmVjdC5cblx0ICovXG5cdHByaXZhdGUgcmVqZWN0KGVycm9yOiBFcnJvcikge1xuXHRcdGlmICh0aGlzLl9zdGF0ZSAhPT0gQXN5bmNJdGVyYWJsZVNvdXJjZVN0YXRlLkluaXRpYWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fc3RhdGUgPSBBc3luY0l0ZXJhYmxlU291cmNlU3RhdGUuRG9uZUVycm9yO1xuXHRcdHRoaXMuX2Vycm9yID0gZXJyb3I7XG5cdFx0dGhpcy5fb25TdGF0ZUNoYW5nZWQuZmlyZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDYW5jZWxhYmxlQXN5bmNJdGVyYWJsZU9iamVjdDxUPiBleHRlbmRzIEFzeW5jSXRlcmFibGVPYmplY3Q8VD4ge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9zb3VyY2U6IENhbmNlbGxhdGlvblRva2VuU291cmNlLFxuXHRcdGV4ZWN1dG9yOiBBc3luY0l0ZXJhYmxlRXhlY3V0b3I8VD5cblx0KSB7XG5cdFx0c3VwZXIoZXhlY3V0b3IpO1xuXHR9XG5cblx0Y2FuY2VsKCk6IHZvaWQge1xuXHRcdHRoaXMuX3NvdXJjZS5jYW5jZWwoKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ2FuY2VsYWJsZUFzeW5jSXRlcmFibGU8VD4oY2FsbGJhY2s6ICh0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pID0+IEFzeW5jSXRlcmFibGU8VD4pOiBDYW5jZWxhYmxlQXN5bmNJdGVyYWJsZU9iamVjdDxUPiB7XG5cdGNvbnN0IHNvdXJjZSA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRjb25zdCBpbm5lckl0ZXJhYmxlID0gY2FsbGJhY2soc291cmNlLnRva2VuKTtcblxuXHRyZXR1cm4gbmV3IENhbmNlbGFibGVBc3luY0l0ZXJhYmxlT2JqZWN0PFQ+KHNvdXJjZSwgYXN5bmMgKGVtaXR0ZXIpID0+IHtcblx0XHRjb25zdCBzdWJzY3JpcHRpb24gPSBzb3VyY2UudG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoKCkgPT4ge1xuXHRcdFx0c3Vic2NyaXB0aW9uLmRpc3Bvc2UoKTtcblx0XHRcdHNvdXJjZS5kaXNwb3NlKCk7XG5cdFx0XHRlbWl0dGVyLnJlamVjdChuZXcgQ2FuY2VsbGF0aW9uRXJyb3IoKSk7XG5cdFx0fSk7XG5cdFx0dHJ5IHtcblx0XHRcdGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBpbm5lckl0ZXJhYmxlKSB7XG5cdFx0XHRcdGlmIChzb3VyY2UudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHQvLyBjYW5jZWxlZCBpbiB0aGUgbWVhbnRpbWVcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0ZW1pdHRlci5lbWl0T25lKGl0ZW0pO1xuXHRcdFx0fVxuXHRcdFx0c3Vic2NyaXB0aW9uLmRpc3Bvc2UoKTtcblx0XHRcdHNvdXJjZS5kaXNwb3NlKCk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRzdWJzY3JpcHRpb24uZGlzcG9zZSgpO1xuXHRcdFx0c291cmNlLmRpc3Bvc2UoKTtcblx0XHRcdGVtaXR0ZXIucmVqZWN0KGVycik7XG5cdFx0fVxuXHR9KTtcbn1cblxuZXhwb3J0IGNsYXNzIEFzeW5jSXRlcmFibGVTb3VyY2U8VD4ge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlZmVycmVkID0gbmV3IERlZmVycmVkUHJvbWlzZTx2b2lkPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hc3luY0l0ZXJhYmxlOiBBc3luY0l0ZXJhYmxlT2JqZWN0PFQ+O1xuXG5cdHByaXZhdGUgX2Vycm9yRm46IChlcnJvcjogRXJyb3IpID0+IHZvaWQ7XG5cdHByaXZhdGUgX2VtaXRGbjogKGl0ZW06IFQpID0+IHZvaWQ7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSBvblJldHVybiBBIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgd2hlbiBjb25zdW1pbmcgdGhlIGFzeW5jIGl0ZXJhYmxlXG5cdCAqIGhhcyBmaW5pc2hlZCBieSB0aGUgY29uc3VtZXIsIGUuZyB0aGUgZm9yLWF3YWl0LWxvb3AgaGFzIGJlIGV4aXN0ZWQgKGJyZWFrLCByZXR1cm4pIGVhcmx5LlxuXHQgKiBUaGlzIGlzIE5PVCBjYWxsZWQgd2hlbiByZXNvbHZpbmcgdGhpcyBzb3VyY2UgYnkgaXRzIG93bmVyLlxuXHQgKi9cblx0Y29uc3RydWN0b3Iob25SZXR1cm4/OiAoKSA9PiBQcm9taXNlPHZvaWQ+IHwgdm9pZCkge1xuXHRcdHRoaXMuX2FzeW5jSXRlcmFibGUgPSBuZXcgQXN5bmNJdGVyYWJsZU9iamVjdChlbWl0dGVyID0+IHtcblxuXHRcdFx0aWYgKGVhcmx5RXJyb3IpIHtcblx0XHRcdFx0ZW1pdHRlci5yZWplY3QoZWFybHlFcnJvcik7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChlYXJseUl0ZW1zKSB7XG5cdFx0XHRcdGVtaXR0ZXIuZW1pdE1hbnkoZWFybHlJdGVtcyk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9lcnJvckZuID0gKGVycm9yOiBFcnJvcikgPT4gZW1pdHRlci5yZWplY3QoZXJyb3IpO1xuXHRcdFx0dGhpcy5fZW1pdEZuID0gKGl0ZW06IFQpID0+IGVtaXR0ZXIuZW1pdE9uZShpdGVtKTtcblx0XHRcdHJldHVybiB0aGlzLl9kZWZlcnJlZC5wO1xuXHRcdH0sIG9uUmV0dXJuKTtcblxuXHRcdGxldCBlYXJseUVycm9yOiBFcnJvciB8IHVuZGVmaW5lZDtcblx0XHRsZXQgZWFybHlJdGVtczogVFtdIHwgdW5kZWZpbmVkO1xuXG5cdFx0dGhpcy5fZW1pdEZuID0gKGl0ZW06IFQpID0+IHtcblx0XHRcdGlmICghZWFybHlJdGVtcykge1xuXHRcdFx0XHRlYXJseUl0ZW1zID0gW107XG5cdFx0XHR9XG5cdFx0XHRlYXJseUl0ZW1zLnB1c2goaXRlbSk7XG5cdFx0fTtcblx0XHR0aGlzLl9lcnJvckZuID0gKGVycm9yOiBFcnJvcikgPT4ge1xuXHRcdFx0aWYgKCFlYXJseUVycm9yKSB7XG5cdFx0XHRcdGVhcmx5RXJyb3IgPSBlcnJvcjtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0Z2V0IGFzeW5jSXRlcmFibGUoKTogQXN5bmNJdGVyYWJsZU9iamVjdDxUPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2FzeW5jSXRlcmFibGU7XG5cdH1cblxuXHRyZXNvbHZlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2RlZmVycmVkLmNvbXBsZXRlKCk7XG5cdH1cblxuXHRyZWplY3QoZXJyb3I6IEVycm9yKTogdm9pZCB7XG5cdFx0dGhpcy5fZXJyb3JGbihlcnJvcik7XG5cdFx0dGhpcy5fZGVmZXJyZWQuY29tcGxldGUoKTtcblx0fVxuXG5cdGVtaXRPbmUoaXRlbTogVCk6IHZvaWQge1xuXHRcdHRoaXMuX2VtaXRGbihpdGVtKTtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQTRCLCtCQUErQjtBQUMzRCxTQUFTLG9CQUFvQix5QkFBeUI7QUFDdEQsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxZQUFZLGVBQTZDLG1CQUFtQixvQkFBb0I7QUFDekcsU0FBUyxVQUFVLHFCQUE4QjtBQUVqRCxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFlBQVk7QUFFZCxTQUFTLFdBQWMsS0FBaUM7QUFDOUQsU0FBTyxDQUFDLENBQUMsT0FBTyxPQUFRLElBQThCLFNBQVM7QUFDaEU7QUFNTyxTQUFTLHdCQUEyQixVQUEwRTtBQUNwSCxRQUFNLFNBQVMsSUFBSSx3QkFBd0I7QUFFM0MsUUFBTSxXQUFXLFNBQVMsT0FBTyxLQUFLO0FBQ3RDLFFBQU0sVUFBVSxJQUFJLFFBQVcsQ0FBQyxTQUFTLFdBQVc7QUFDbkQsVUFBTSxlQUFlLE9BQU8sTUFBTSx3QkFBd0IsTUFBTTtBQUMvRCxtQkFBYSxRQUFRO0FB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QUFBLElBQ3ZDLENBQUM7QUFDRCxRQUFJO0FBQ0gsdUJBQWlCLFFBQVEsZUFBZTtBQUN2QyxZQUFJLE9BQU8sTUFBTSx5QkFBeUI7QUFFekM7QUFBQSxRQUNEO0FBQ0EsZ0JBQVEsUUFBUSxJQUFJO0FBQUEsTUFDckI7QUFDQSxtQkFBYSxRQUFRO0FBQ3JCLGFBQU8sUUFBUTtBQUFBLElBQ2hCLFNBQVMsS0FBSztBQUNiLG1CQUFhLFFBQVE7QUFDckIsYUFBTyxRQUFRO0FBQ2YsY0FBUSxPQUFPLEdBQUc7QUFBQSxJQUNuQjtBQUFBLEVBQ0QsQ0FBQztBQUNGO0FBRU8sTUFBTSxvQkFBdUI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQWNuQyxZQUFZLFVBQXVDO0FBWm5ELFNBQWlCLFlBQVksSUFBSSxnQkFBc0I7QUFhdEQsU0FBSyxpQkFBaUIsSUFBSSxvQkFBb0IsYUFBVztBQUV4RCxVQUFJLFlBQVk7QUFDZixnQkFBUSxPQUFPLFVBQVU7QUFDekI7QUFBQSxNQUNEO0FBQ0EsVUFBSSxZQUFZO0FBQ2YsZ0JBQVEsU0FBUyxVQUFVO0FBQUEsTUFDNUI7QUFDQSxXQUFLLFdBQVcsQ0FBQyxVQUFpQixRQUFRLE9BQU8sS0FBSztBQUN0RCxXQUFLLFVBQVUsQ0FBQyxTQUFZLFFBQVEsUUFBUSxJQUFJO0FBQ2hELGFBQU8sS0FBSyxVQUFVO0FBQUEsSUFDdkIsR0FBRyxRQUFRO0FBRVgsUUFBSTtBQUNKLFFBQUk7QUFFSixTQUFLLFVBQVUsQ0FBQyxTQUFZO0FBQzNCLFVBQUksQ0FBQyxZQUFZO0FBQ2hCLHFCQUFhLENBQUM7QUFBQSxNQUNmO0FBQ0EsaUJBQVcsS0FBSyxJQUFJO0FBQUEsSUFDckI7QUFDQSxTQUFLLFdBQVcsQ0FBQyxVQUFpQjtBQUNqQyxVQUFJLENBQUMsWUFBWTtBQUNoQixxQkFBYTtBQUFBLE1BQ2Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRUEsSUFBSSxnQkFBd0M7QUFDM0MsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsVUFBZ0I7QUFDZixTQUFLLFVBQVUsU0FBUztBQUFBLEVBQ3pCO0FBQUEsRUFFQSxPQUFPLE9BQW9CO0FBQzFCLFNBQUssU0FBUyxLQUFLO0FBQ25CLFNBQUssVUFBVSxTQUFTO0FBQUEsRUFDekI7QUFBQSxFQUVBLFFBQVEsTUFBZTtBQUN0QixTQUFLLFFBQVEsSUFBSTtBQUFBLEVBQ2xCO0FBQ0Q7IiwKICAibmFtZXMiOiBbInRpbWVvdXQiLCAidGFzayIsICJ0b2tlbiIsICJEZWZlcnJlZE91dGNvbWUiLCAiUHJvbWlzZXMiLCAiQXN5bmNJdGVyYWJsZVNvdXJjZVN0YXRlIl0KfQo=
