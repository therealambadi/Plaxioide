import assert from "assert";
import { stub } from "sinon";
import { DeferredPromise, timeout } from "../../common/async.js";
import { CancellationToken } from "../../common/cancellation.js";
import { errorHandler, setUnexpectedErrorHandler } from "../../common/errors.js";
import { AsyncEmitter, DebounceEmitter, DynamicListEventMultiplexer, Emitter, Event, EventBufferer, EventMultiplexer, ListenerLeakError, ListenerRefusalError, MicrotaskEmitter, PauseableEmitter, Relay, createEventDeliveryQueue } from "../../common/event.js";
import { DisposableStore, isDisposable, setDisposableTracker, DisposableTracker } from "../../common/lifecycle.js";
import { observableValue, transaction } from "../../common/observable.js";
import { MicrotaskDelay } from "../../common/symbols.js";
import { runWithFakedTimers } from "./timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "./utils.js";
import { tail } from "../../common/arrays.js";
var Samples;
((Samples2) => {
  class EventCounter {
    constructor() {
      this.count = 0;
    }
    reset() {
      this.count = 0;
    }
    onEvent() {
      this.count += 1;
    }
  }
  Samples2.EventCounter = EventCounter;
  class Document3 {
    constructor() {
      this._onDidChange = new Emitter();
      this.onDidChange = this._onDidChange.event;
    }
    setText(value) {
      this._onDidChange.fire(value);
    }
    dispose() {
      this._onDidChange.dispose();
    }
  }
  Samples2.Document3 = Document3;
})(Samples || (Samples = {}));
suite("Event utils dispose", function() {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  let tracker = new DisposableTracker();
  function assertDisposablesCount(expected) {
    if (Array.isArray(expected)) {
      const instances = new Set(expected);
      const actualInstances = tracker.getTrackedDisposables();
      assert.strictEqual(actualInstances.length, expected.length);
      for (const item of actualInstances) {
        assert.ok(instances.has(item));
      }
    } else {
      assert.strictEqual(tracker.getTrackedDisposables().length, expected);
    }
  }
  setup(() => {
    tracker = new DisposableTracker();
    setDisposableTracker(tracker);
  });
  teardown(function() {
    setDisposableTracker(null);
  });
  test("no leak with snapshot-utils", function() {
    const store = new DisposableStore();
    const emitter = ds.add(new Emitter());
    const evens = Event.filter(emitter.event, (n) => n % 2 === 0, store);
    assertDisposablesCount(1);
    let all = 0;
    const leaked = evens((n) => all += n);
    assert.ok(isDisposable(leaked));
    assertDisposablesCount(3);
    emitter.dispose();
    store.dispose();
    assertDisposablesCount([leaked]);
  });
  test("no leak with debounce-util", function() {
    const store = new DisposableStore();
    const emitter = ds.add(new Emitter());
    const debounced = Event.debounce(emitter.event, (l) => 0, void 0, void 0, void 0, void 0, store);
    assertDisposablesCount(1);
    let all = 0;
    const leaked = debounced((n) => all += n);
    assert.ok(isDisposable(leaked));
    assertDisposablesCount(3);
    emitter.dispose();
    store.dispose();
    assertDisposablesCount([leaked]);
  });
});
suite("Event", function() {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  const counter = new Samples.EventCounter();
  setup(() => counter.reset());
  test("Emitter plain", function() {
    const doc = ds.add(new Samples.Document3());
    const subscription = doc.onDidChange(counter.onEvent, counter);
    doc.setText("far");
    doc.setText("boo");
    subscription.dispose();
    doc.setText("boo");
    assert.strictEqual(counter.count, 2);
  });
  test("Emitter duplicate functions", () => {
    const calls = [];
    const a = (v) => calls.push(`a${v}`);
    const b = (v) => calls.push(`b${v}`);
    const emitter = ds.add(new Emitter());
    ds.add(emitter.event(a));
    ds.add(emitter.event(b));
    const s2 = emitter.event(a);
    emitter.fire("1");
    assert.deepStrictEqual(calls, ["a1", "b1", "a1"]);
    s2.dispose();
    calls.length = 0;
    emitter.fire("2");
    assert.deepStrictEqual(calls, ["a2", "b2"]);
  });
  test("Emitter, dispose listener during emission", () => {
    for (let keepFirstMod = 1; keepFirstMod < 4; keepFirstMod++) {
      const emitter = ds.add(new Emitter());
      const calls = [];
      const disposables = Array.from({ length: 25 }, (_, n) => ds.add(emitter.event(() => {
        if (n % keepFirstMod === 0) {
          disposables[n].dispose();
        }
        calls.push(n);
      })));
      emitter.fire();
      assert.deepStrictEqual(calls, Array.from({ length: 25 }, (_, n) => n));
    }
  });
  test("Emitter, dispose emitter during emission", () => {
    const emitter = ds.add(new Emitter());
    const calls = [];
    const disposables = Array.from({ length: 25 }, (_, n) => ds.add(emitter.event(() => {
      if (n === 10) {
        emitter.dispose();
      }
      calls.push(n);
    })));
    emitter.fire();
    disposables.forEach((d) => d.dispose());
    assert.deepStrictEqual(calls, Array.from({ length: 11 }, (_, n) => n));
  });
  test("Emitter, shared delivery queue", () => {
    const deliveryQueue = createEventDeliveryQueue();
    const emitter1 = ds.add(new Emitter({ deliveryQueue }));
    const emitter2 = ds.add(new Emitter({ deliveryQueue }));
    const calls = [];
    ds.add(emitter1.event((d) => {
      calls.push(`${d}a`);
      if (d === 1) {
        emitter2.fire(2);
      }
    }));
    ds.add(emitter1.event((d) => {
      calls.push(`${d}b`);
    }));
    ds.add(emitter2.event((d) => {
      calls.push(`${d}c`);
      emitter1.dispose();
    }));
    ds.add(emitter2.event((d) => {
      calls.push(`${d}d`);
    }));
    emitter1.fire(1);
    assert.deepStrictEqual(calls, ["1a", "1b", "2c", "2d"]);
  });
  test("Emitter, handles removal during 3", () => {
    const fn1 = stub();
    const fn2 = stub();
    const emitter = ds.add(new Emitter());
    ds.add(emitter.event(fn1));
    const h = emitter.event(() => {
      h.dispose();
    });
    ds.add(emitter.event(fn2));
    emitter.fire("foo");
    assert.deepStrictEqual(fn2.args, [["foo"]]);
    assert.deepStrictEqual(fn1.args, [["foo"]]);
  });
  test("Emitter, handles removal during 2", () => {
    const fn1 = stub();
    const emitter = ds.add(new Emitter());
    ds.add(emitter.event(fn1));
    const h = emitter.event(() => {
      h.dispose();
    });
    emitter.fire("foo");
    assert.deepStrictEqual(fn1.args, [["foo"]]);
  });
  test("Emitter, bucket", function() {
    const bucket = [];
    const doc = ds.add(new Samples.Document3());
    const subscription = doc.onDidChange(counter.onEvent, counter, bucket);
    doc.setText("far");
    doc.setText("boo");
    while (bucket.length) {
      bucket.pop().dispose();
    }
    doc.setText("boo");
    subscription.dispose();
    doc.setText("boo");
    assert.strictEqual(counter.count, 2);
  });
  test("Emitter, store", function() {
    const bucket = ds.add(new DisposableStore());
    const doc = ds.add(new Samples.Document3());
    const subscription = doc.onDidChange(counter.onEvent, counter, bucket);
    doc.setText("far");
    doc.setText("boo");
    bucket.clear();
    doc.setText("boo");
    subscription.dispose();
    doc.setText("boo");
    assert.strictEqual(counter.count, 2);
  });
  test("onFirstAdd|onLastRemove", () => {
    let firstCount = 0;
    let lastCount = 0;
    const a = ds.add(new Emitter({
      onWillAddFirstListener() {
        firstCount += 1;
      },
      onDidRemoveLastListener() {
        lastCount += 1;
      }
    }));
    assert.strictEqual(firstCount, 0);
    assert.strictEqual(lastCount, 0);
    let subscription1 = ds.add(a.event(function() {
    }));
    const subscription2 = ds.add(a.event(function() {
    }));
    assert.strictEqual(firstCount, 1);
    assert.strictEqual(lastCount, 0);
    subscription1.dispose();
    assert.strictEqual(firstCount, 1);
    assert.strictEqual(lastCount, 0);
    subscription2.dispose();
    assert.strictEqual(firstCount, 1);
    assert.strictEqual(lastCount, 1);
    subscription1 = ds.add(a.event(function() {
    }));
    assert.strictEqual(firstCount, 2);
    assert.strictEqual(lastCount, 1);
  });
  test("onDidAddListener", () => {
    let count = 0;
    const a = ds.add(new Emitter({
      onDidAddListener() {
        count += 1;
      }
    }));
    assert.strictEqual(count, 0);
    let subscription = ds.add(a.event(function() {
    }));
    assert.strictEqual(count, 1);
    subscription.dispose();
    assert.strictEqual(count, 1);
    subscription = ds.add(a.event(function() {
    }));
    assert.strictEqual(count, 2);
    subscription.dispose();
    assert.strictEqual(count, 2);
  });
  test("onWillRemoveListener", () => {
    let count = 0;
    const a = ds.add(new Emitter({
      onWillRemoveListener() {
        count += 1;
      }
    }));
    assert.strictEqual(count, 0);
    let subscription = ds.add(a.event(function() {
    }));
    assert.strictEqual(count, 0);
    subscription.dispose();
    assert.strictEqual(count, 1);
    subscription = ds.add(a.event(function() {
    }));
    assert.strictEqual(count, 1);
  });
  test("throwingListener", () => {
    const origErrorHandler = errorHandler.getUnexpectedErrorHandler();
    setUnexpectedErrorHandler(() => null);
    try {
      const a = ds.add(new Emitter());
      let hit = false;
      ds.add(a.event(function() {
        throw 9;
      }));
      ds.add(a.event(function() {
        hit = true;
      }));
      a.fire(void 0);
      assert.strictEqual(hit, true);
    } finally {
      setUnexpectedErrorHandler(origErrorHandler);
    }
  });
  test("throwingListener (custom handler)", () => {
    const allError = [];
    const a = ds.add(new Emitter({
      onListenerError(e) {
        allError.push(e);
      }
    }));
    let hit = false;
    ds.add(a.event(function() {
      throw 9;
    }));
    ds.add(a.event(function() {
      hit = true;
    }));
    a.fire(void 0);
    assert.strictEqual(hit, true);
    assert.deepStrictEqual(allError, [9]);
  });
  test("throw ListenerLeakError", () => {
    const store = new DisposableStore();
    const allError = [];
    const a = ds.add(new Emitter({
      onListenerError(e) {
        allError.push(e);
      },
      leakWarningThreshold: 3
    }));
    for (let i = 0; i < 11; i++) {
      a.event(() => {
      }, void 0, store);
    }
    assert.deepStrictEqual(allError.length, 5);
    const [start, rest] = tail(allError);
    assert.ok(rest instanceof ListenerRefusalError);
    for (const item of start) {
      assert.ok(item instanceof ListenerLeakError);
    }
    store.dispose();
  });
  test("reusing event function and context", function() {
    let counter2 = 0;
    function listener() {
      counter2 += 1;
    }
    const context = {};
    const emitter = ds.add(new Emitter());
    const reg1 = emitter.event(listener, context);
    const reg2 = emitter.event(listener, context);
    emitter.fire(void 0);
    assert.strictEqual(counter2, 2);
    reg1.dispose();
    emitter.fire(void 0);
    assert.strictEqual(counter2, 3);
    reg2.dispose();
    emitter.fire(void 0);
    assert.strictEqual(counter2, 3);
  });
  test("DebounceEmitter", async function() {
    return runWithFakedTimers({}, async function() {
      let callCount = 0;
      let sum = 0;
      const emitter = new DebounceEmitter({
        merge: (arr) => {
          callCount += 1;
          return arr.reduce((p2, c) => p2 + c);
        }
      });
      ds.add(emitter.event((e) => {
        sum = e;
      }));
      const p = Event.toPromise(emitter.event);
      emitter.fire(1);
      emitter.fire(2);
      await p;
      assert.strictEqual(callCount, 1);
      assert.strictEqual(sum, 3);
    });
  });
  test("Microtask Emitter", (done) => {
    let count = 0;
    assert.strictEqual(count, 0);
    const emitter = new MicrotaskEmitter();
    const listener = emitter.event(() => {
      count++;
    });
    emitter.fire();
    assert.strictEqual(count, 0);
    emitter.fire();
    assert.strictEqual(count, 0);
    setTimeout(() => {
      assert.strictEqual(count, 3);
      done();
    }, 0);
    queueMicrotask(() => {
      assert.strictEqual(count, 2);
      count++;
      listener.dispose();
    });
  });
  test("Emitter - In Order Delivery", function() {
    const a = ds.add(new Emitter());
    const listener2Events = [];
    ds.add(a.event(function listener1(event) {
      if (event === "e1") {
        a.fire("e2");
        assert.deepStrictEqual(listener2Events, ["e1", "e2"]);
      }
    }));
    ds.add(a.event(function listener2(event) {
      listener2Events.push(event);
    }));
    a.fire("e1");
    assert.deepStrictEqual(listener2Events, ["e1", "e2"]);
  });
  test("Emitter, - In Order Delivery 3x", function() {
    const a = ds.add(new Emitter());
    const listener2Events = [];
    ds.add(a.event(function listener1(event) {
      if (event === "e2") {
        a.fire("e3");
        assert.deepStrictEqual(listener2Events, ["e1", "e2", "e3"]);
      }
    }));
    ds.add(a.event(function listener1(event) {
      if (event === "e1") {
        a.fire("e2");
        assert.deepStrictEqual(listener2Events, ["e1", "e2", "e3"]);
      }
    }));
    ds.add(a.event(function listener2(event) {
      listener2Events.push(event);
    }));
    a.fire("e1");
    assert.deepStrictEqual(listener2Events, ["e1", "e2", "e3"]);
  });
  test("Cannot read property '_actual' of undefined #142204", function() {
    const e = ds.add(new Emitter());
    const dispo = e.event(() => {
    });
    dispo.dispose.call(void 0);
  });
});
suite("AsyncEmitter", function() {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  test("event has waitUntil-function", async function() {
    const emitter = new AsyncEmitter();
    ds.add(emitter.event((e) => {
      assert.strictEqual(e.foo, true);
      assert.strictEqual(e.bar, 1);
      assert.strictEqual(typeof e.waitUntil, "function");
    }));
    emitter.fireAsync({ foo: true, bar: 1 }, CancellationToken.None);
    emitter.dispose();
  });
  test("sequential delivery", async function() {
    return runWithFakedTimers({}, async function() {
      let globalState = 0;
      const emitter = new AsyncEmitter();
      ds.add(emitter.event((e) => {
        e.waitUntil(timeout(10).then((_) => {
          assert.strictEqual(globalState, 0);
          globalState += 1;
        }));
      }));
      ds.add(emitter.event((e) => {
        e.waitUntil(timeout(1).then((_) => {
          assert.strictEqual(globalState, 1);
          globalState += 1;
        }));
      }));
      await emitter.fireAsync({ foo: true }, CancellationToken.None);
      assert.strictEqual(globalState, 2);
    });
  });
  test("sequential, in-order delivery", async function() {
    return runWithFakedTimers({}, async function() {
      const events = [];
      let done = false;
      const emitter = new AsyncEmitter();
      ds.add(emitter.event((e) => {
        e.waitUntil(timeout(10).then(async (_) => {
          if (e.foo === 1) {
            await emitter.fireAsync({ foo: 2 }, CancellationToken.None);
            assert.deepStrictEqual(events, [1, 2]);
            done = true;
          }
        }));
      }));
      ds.add(emitter.event((e) => {
        events.push(e.foo);
        e.waitUntil(timeout(7));
      }));
      await emitter.fireAsync({ foo: 1 }, CancellationToken.None);
      assert.ok(done);
    });
  });
  test("catch errors", async function() {
    const origErrorHandler = errorHandler.getUnexpectedErrorHandler();
    setUnexpectedErrorHandler(() => null);
    let globalState = 0;
    const emitter = new AsyncEmitter();
    ds.add(emitter.event((e) => {
      globalState += 1;
      e.waitUntil(new Promise((_r, reject) => reject(new Error())));
    }));
    ds.add(emitter.event((e) => {
      globalState += 1;
      e.waitUntil(timeout(10));
      e.waitUntil(timeout(20).then(() => globalState++));
    }));
    await emitter.fireAsync({ foo: true }, CancellationToken.None).then(() => {
      assert.strictEqual(globalState, 3);
    }).catch((e) => {
      console.log(e);
      assert.ok(false);
    });
    setUnexpectedErrorHandler(origErrorHandler);
  });
});
suite("PausableEmitter", function() {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  test("basic", function() {
    const data = [];
    const emitter = ds.add(new PauseableEmitter());
    ds.add(emitter.event((e) => data.push(e)));
    emitter.fire(1);
    emitter.fire(2);
    assert.deepStrictEqual(data, [1, 2]);
  });
  test("pause/resume - no merge", function() {
    const data = [];
    const emitter = ds.add(new PauseableEmitter());
    ds.add(emitter.event((e) => data.push(e)));
    emitter.fire(1);
    emitter.fire(2);
    assert.deepStrictEqual(data, [1, 2]);
    emitter.pause();
    emitter.fire(3);
    emitter.fire(4);
    assert.deepStrictEqual(data, [1, 2]);
    emitter.resume();
    assert.deepStrictEqual(data, [1, 2, 3, 4]);
    emitter.fire(5);
    assert.deepStrictEqual(data, [1, 2, 3, 4, 5]);
  });
  test("pause/resume - merge", function() {
    const data = [];
    const emitter = ds.add(new PauseableEmitter({ merge: (a) => a.reduce((p, c) => p + c, 0) }));
    ds.add(emitter.event((e) => data.push(e)));
    emitter.fire(1);
    emitter.fire(2);
    assert.deepStrictEqual(data, [1, 2]);
    emitter.pause();
    emitter.fire(3);
    emitter.fire(4);
    assert.deepStrictEqual(data, [1, 2]);
    emitter.resume();
    assert.deepStrictEqual(data, [1, 2, 7]);
    emitter.fire(5);
    assert.deepStrictEqual(data, [1, 2, 7, 5]);
  });
  test("double pause/resume", function() {
    const data = [];
    const emitter = ds.add(new PauseableEmitter());
    ds.add(emitter.event((e) => data.push(e)));
    emitter.fire(1);
    emitter.fire(2);
    assert.deepStrictEqual(data, [1, 2]);
    emitter.pause();
    emitter.pause();
    emitter.fire(3);
    emitter.fire(4);
    assert.deepStrictEqual(data, [1, 2]);
    emitter.resume();
    assert.deepStrictEqual(data, [1, 2]);
    emitter.resume();
    assert.deepStrictEqual(data, [1, 2, 3, 4]);
    emitter.resume();
    assert.deepStrictEqual(data, [1, 2, 3, 4]);
  });
  test("resume, no pause", function() {
    const data = [];
    const emitter = ds.add(new PauseableEmitter());
    ds.add(emitter.event((e) => data.push(e)));
    emitter.fire(1);
    emitter.fire(2);
    assert.deepStrictEqual(data, [1, 2]);
    emitter.resume();
    emitter.fire(3);
    assert.deepStrictEqual(data, [1, 2, 3]);
  });
  test("nested pause", function() {
    const data = [];
    const emitter = ds.add(new PauseableEmitter());
    let once = true;
    ds.add(emitter.event((e) => {
      data.push(e);
      if (once) {
        emitter.pause();
        once = false;
      }
    }));
    ds.add(emitter.event((e) => {
      data.push(e);
    }));
    emitter.pause();
    emitter.fire(1);
    emitter.fire(2);
    assert.deepStrictEqual(data, []);
    emitter.resume();
    assert.deepStrictEqual(data, [1, 1]);
    emitter.resume();
    assert.deepStrictEqual(data, [1, 1, 2, 2]);
    emitter.fire(3);
    assert.deepStrictEqual(data, [1, 1, 2, 2, 3, 3]);
  });
  test("empty pause with merge", function() {
    const data = [];
    const emitter = ds.add(new PauseableEmitter({ merge: (a) => a[0] }));
    ds.add(emitter.event((e) => data.push(1)));
    emitter.pause();
    emitter.resume();
    assert.deepStrictEqual(data, []);
  });
});
suite("Event utils - ensureNoDisposablesAreLeakedInTestSuite", function() {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("fromObservable", function() {
    const obs = observableValue("test", 12);
    const event = Event.fromObservable(obs);
    const values = [];
    const d = event((n) => {
      values.push(n);
    });
    obs.set(3, void 0);
    obs.set(13, void 0);
    obs.set(3, void 0);
    obs.set(33, void 0);
    obs.set(1, void 0);
    transaction((tx) => {
      obs.set(334, tx);
      obs.set(99, tx);
    });
    assert.deepStrictEqual(values, [3, 13, 3, 33, 1, 99]);
    d.dispose();
  });
});
suite("Event utils", () => {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  suite("EventBufferer", () => {
    test("should not buffer when not wrapped", () => {
      const bufferer = new EventBufferer();
      const counter = new Samples.EventCounter();
      const emitter = ds.add(new Emitter());
      const event = bufferer.wrapEvent(emitter.event);
      const listener = event(counter.onEvent, counter);
      assert.strictEqual(counter.count, 0);
      emitter.fire();
      assert.strictEqual(counter.count, 1);
      emitter.fire();
      assert.strictEqual(counter.count, 2);
      emitter.fire();
      assert.strictEqual(counter.count, 3);
      listener.dispose();
    });
    test("should buffer when wrapped", () => {
      const bufferer = new EventBufferer();
      const counter = new Samples.EventCounter();
      const emitter = ds.add(new Emitter());
      const event = bufferer.wrapEvent(emitter.event);
      const listener = event(counter.onEvent, counter);
      assert.strictEqual(counter.count, 0);
      emitter.fire();
      assert.strictEqual(counter.count, 1);
      bufferer.bufferEvents(() => {
        emitter.fire();
        assert.strictEqual(counter.count, 1);
        emitter.fire();
        assert.strictEqual(counter.count, 1);
      });
      assert.strictEqual(counter.count, 3);
      emitter.fire();
      assert.strictEqual(counter.count, 4);
      listener.dispose();
    });
    test("once", () => {
      const emitter = ds.add(new Emitter());
      let counter1 = 0, counter2 = 0, counter3 = 0;
      const listener1 = emitter.event(() => counter1++);
      const listener2 = Event.once(emitter.event)(() => counter2++);
      const listener3 = Event.once(emitter.event)(() => counter3++);
      assert.strictEqual(counter1, 0);
      assert.strictEqual(counter2, 0);
      assert.strictEqual(counter3, 0);
      listener3.dispose();
      emitter.fire();
      assert.strictEqual(counter1, 1);
      assert.strictEqual(counter2, 1);
      assert.strictEqual(counter3, 0);
      emitter.fire();
      assert.strictEqual(counter1, 2);
      assert.strictEqual(counter2, 1);
      assert.strictEqual(counter3, 0);
      listener1.dispose();
      listener2.dispose();
    });
  });
  suite("buffer", () => {
    test("should buffer events", () => {
      const result = [];
      const emitter = ds.add(new Emitter());
      const event = emitter.event;
      const bufferedEvent = Event.buffer(event);
      emitter.fire(1);
      emitter.fire(2);
      emitter.fire(3);
      assert.deepStrictEqual(result, []);
      const listener = bufferedEvent((num) => result.push(num));
      assert.deepStrictEqual(result, [1, 2, 3]);
      emitter.fire(4);
      assert.deepStrictEqual(result, [1, 2, 3, 4]);
      listener.dispose();
      emitter.fire(5);
      assert.deepStrictEqual(result, [1, 2, 3, 4]);
    });
    test("should buffer events on next tick", async () => {
      const result = [];
      const emitter = ds.add(new Emitter());
      const event = emitter.event;
      const bufferedEvent = Event.buffer(event, true);
      emitter.fire(1);
      emitter.fire(2);
      emitter.fire(3);
      assert.deepStrictEqual(result, []);
      const listener = bufferedEvent((num) => result.push(num));
      assert.deepStrictEqual(result, []);
      await timeout(10);
      emitter.fire(4);
      assert.deepStrictEqual(result, [1, 2, 3, 4]);
      listener.dispose();
      emitter.fire(5);
      assert.deepStrictEqual(result, [1, 2, 3, 4]);
    });
    test("should fire initial buffer events", () => {
      const result = [];
      const emitter = ds.add(new Emitter());
      const event = emitter.event;
      const bufferedEvent = Event.buffer(event, false, [-2, -1, 0]);
      emitter.fire(1);
      emitter.fire(2);
      emitter.fire(3);
      assert.deepStrictEqual(result, []);
      ds.add(bufferedEvent((num) => result.push(num)));
      assert.deepStrictEqual(result, [-2, -1, 0, 1, 2, 3]);
    });
  });
  suite("EventMultiplexer", () => {
    test("works", () => {
      const result = [];
      const m = new EventMultiplexer();
      ds.add(m.event((r) => result.push(r)));
      const e1 = ds.add(new Emitter());
      ds.add(m.add(e1.event));
      assert.deepStrictEqual(result, []);
      e1.fire(0);
      assert.deepStrictEqual(result, [0]);
    });
    test("multiplexer dispose works", () => {
      const result = [];
      const m = new EventMultiplexer();
      ds.add(m.event((r) => result.push(r)));
      const e1 = ds.add(new Emitter());
      ds.add(m.add(e1.event));
      assert.deepStrictEqual(result, []);
      e1.fire(0);
      assert.deepStrictEqual(result, [0]);
      m.dispose();
      assert.deepStrictEqual(result, [0]);
      e1.fire(0);
      assert.deepStrictEqual(result, [0]);
    });
    test("event dispose works", () => {
      const result = [];
      const m = new EventMultiplexer();
      ds.add(m.event((r) => result.push(r)));
      const e1 = ds.add(new Emitter());
      ds.add(m.add(e1.event));
      assert.deepStrictEqual(result, []);
      e1.fire(0);
      assert.deepStrictEqual(result, [0]);
      e1.dispose();
      assert.deepStrictEqual(result, [0]);
      e1.fire(0);
      assert.deepStrictEqual(result, [0]);
    });
    test("mutliplexer event dispose works", () => {
      const result = [];
      const m = new EventMultiplexer();
      ds.add(m.event((r) => result.push(r)));
      const e1 = ds.add(new Emitter());
      const l1 = m.add(e1.event);
      assert.deepStrictEqual(result, []);
      e1.fire(0);
      assert.deepStrictEqual(result, [0]);
      l1.dispose();
      assert.deepStrictEqual(result, [0]);
      e1.fire(0);
      assert.deepStrictEqual(result, [0]);
    });
    test("hot start works", () => {
      const result = [];
      const m = new EventMultiplexer();
      ds.add(m.event((r) => result.push(r)));
      const e1 = ds.add(new Emitter());
      ds.add(m.add(e1.event));
      const e2 = ds.add(new Emitter());
      ds.add(m.add(e2.event));
      const e3 = ds.add(new Emitter());
      ds.add(m.add(e3.event));
      e1.fire(1);
      e2.fire(2);
      e3.fire(3);
      assert.deepStrictEqual(result, [1, 2, 3]);
    });
    test("cold start works", () => {
      const result = [];
      const m = new EventMultiplexer();
      const e1 = ds.add(new Emitter());
      ds.add(m.add(e1.event));
      const e2 = ds.add(new Emitter());
      ds.add(m.add(e2.event));
      const e3 = ds.add(new Emitter());
      ds.add(m.add(e3.event));
      ds.add(m.event((r) => result.push(r)));
      e1.fire(1);
      e2.fire(2);
      e3.fire(3);
      assert.deepStrictEqual(result, [1, 2, 3]);
    });
    test("late add works", () => {
      const result = [];
      const m = new EventMultiplexer();
      const e1 = ds.add(new Emitter());
      ds.add(m.add(e1.event));
      const e2 = ds.add(new Emitter());
      ds.add(m.add(e2.event));
      ds.add(m.event((r) => result.push(r)));
      e1.fire(1);
      e2.fire(2);
      const e3 = ds.add(new Emitter());
      ds.add(m.add(e3.event));
      e3.fire(3);
      assert.deepStrictEqual(result, [1, 2, 3]);
    });
    test("add dispose works", () => {
      const result = [];
      const m = new EventMultiplexer();
      const e1 = ds.add(new Emitter());
      ds.add(m.add(e1.event));
      const e2 = ds.add(new Emitter());
      ds.add(m.add(e2.event));
      ds.add(m.event((r) => result.push(r)));
      e1.fire(1);
      e2.fire(2);
      const e3 = ds.add(new Emitter());
      const l3 = m.add(e3.event);
      e3.fire(3);
      assert.deepStrictEqual(result, [1, 2, 3]);
      l3.dispose();
      e3.fire(4);
      assert.deepStrictEqual(result, [1, 2, 3]);
      e2.fire(4);
      e1.fire(5);
      assert.deepStrictEqual(result, [1, 2, 3, 4, 5]);
    });
  });
  suite("DynamicListEventMultiplexer", () => {
    let addEmitter;
    let removeEmitter;
    const recordedEvents = [];
    class TestItem {
      constructor() {
        this.onTestEventEmitter = ds.add(new Emitter());
        this.onTestEvent = this.onTestEventEmitter.event;
      }
    }
    let items;
    let m;
    setup(() => {
      addEmitter = ds.add(new Emitter());
      removeEmitter = ds.add(new Emitter());
      items = [new TestItem(), new TestItem()];
      for (const [i, item] of items.entries()) {
        ds.add(item.onTestEvent((e) => `${i}:${e}`));
      }
      m = new DynamicListEventMultiplexer(items, addEmitter.event, removeEmitter.event, (e) => e.onTestEvent);
      ds.add(m.event((e) => recordedEvents.push(e)));
      recordedEvents.length = 0;
    });
    teardown(() => m.dispose());
    test("should fire events for initial items", () => {
      items[0].onTestEventEmitter.fire(1);
      items[1].onTestEventEmitter.fire(2);
      items[0].onTestEventEmitter.fire(3);
      items[1].onTestEventEmitter.fire(4);
      assert.deepStrictEqual(recordedEvents, [1, 2, 3, 4]);
    });
    test("should fire events for added items", () => {
      const addedItem = new TestItem();
      addEmitter.fire(addedItem);
      addedItem.onTestEventEmitter.fire(1);
      items[0].onTestEventEmitter.fire(2);
      items[1].onTestEventEmitter.fire(3);
      addedItem.onTestEventEmitter.fire(4);
      assert.deepStrictEqual(recordedEvents, [1, 2, 3, 4]);
    });
    test("should not fire events for removed items", () => {
      removeEmitter.fire(items[0]);
      items[0].onTestEventEmitter.fire(1);
      items[1].onTestEventEmitter.fire(2);
      items[0].onTestEventEmitter.fire(3);
      items[1].onTestEventEmitter.fire(4);
      assert.deepStrictEqual(recordedEvents, [2, 4]);
    });
  });
  test("latch", () => {
    const emitter = ds.add(new Emitter());
    const event = Event.latch(emitter.event);
    const result = [];
    const listener = ds.add(event((num) => result.push(num)));
    assert.deepStrictEqual(result, []);
    emitter.fire(1);
    assert.deepStrictEqual(result, [1]);
    emitter.fire(2);
    assert.deepStrictEqual(result, [1, 2]);
    emitter.fire(2);
    assert.deepStrictEqual(result, [1, 2]);
    emitter.fire(1);
    assert.deepStrictEqual(result, [1, 2, 1]);
    emitter.fire(1);
    assert.deepStrictEqual(result, [1, 2, 1]);
    emitter.fire(3);
    assert.deepStrictEqual(result, [1, 2, 1, 3]);
    emitter.fire(3);
    assert.deepStrictEqual(result, [1, 2, 1, 3]);
    emitter.fire(3);
    assert.deepStrictEqual(result, [1, 2, 1, 3]);
    listener.dispose();
  });
  test("dispose is reentrant", () => {
    const emitter = ds.add(new Emitter({
      onDidRemoveLastListener: () => {
        emitter.dispose();
      }
    }));
    const listener = emitter.event(() => void 0);
    listener.dispose();
  });
  suite("fromPromise", () => {
    test("not yet resolved", async function() {
      return new Promise((resolve) => {
        let promise = new DeferredPromise();
        ds.add(Event.fromPromise(promise.p)((e) => {
          assert.strictEqual(e, 1);
          promise = new DeferredPromise();
          ds.add(Event.fromPromise(promise.p)(() => {
            resolve();
          }));
          promise.error(void 0);
        }));
        promise.complete(1);
      });
    });
    test("already resolved", async function() {
      return new Promise((resolve) => {
        let promise = new DeferredPromise();
        promise.complete(1);
        ds.add(Event.fromPromise(promise.p)((e) => {
          assert.strictEqual(e, 1);
          promise = new DeferredPromise();
          promise.error(void 0);
          ds.add(Event.fromPromise(promise.p)(() => {
            resolve();
          }));
        }));
      });
    });
  });
  suite("Relay", () => {
    test("should input work", () => {
      const e1 = ds.add(new Emitter());
      const e2 = ds.add(new Emitter());
      const relay = new Relay();
      const result = [];
      const listener = (num) => result.push(num);
      const subscription = relay.event(listener);
      e1.fire(1);
      assert.deepStrictEqual(result, []);
      relay.input = e1.event;
      e1.fire(2);
      assert.deepStrictEqual(result, [2]);
      relay.input = e2.event;
      e1.fire(3);
      e2.fire(4);
      assert.deepStrictEqual(result, [2, 4]);
      subscription.dispose();
      e1.fire(5);
      e2.fire(6);
      assert.deepStrictEqual(result, [2, 4]);
    });
    test("should Relay dispose work", () => {
      const e1 = ds.add(new Emitter());
      const e2 = ds.add(new Emitter());
      const relay = new Relay();
      const result = [];
      const listener = (num) => result.push(num);
      ds.add(relay.event(listener));
      e1.fire(1);
      assert.deepStrictEqual(result, []);
      relay.input = e1.event;
      e1.fire(2);
      assert.deepStrictEqual(result, [2]);
      relay.input = e2.event;
      e1.fire(3);
      e2.fire(4);
      assert.deepStrictEqual(result, [2, 4]);
      relay.dispose();
      e1.fire(5);
      e2.fire(6);
      assert.deepStrictEqual(result, [2, 4]);
    });
  });
  suite("accumulate", () => {
    test("should not fire after a listener is disposed with undefined or []", async () => {
      const eventEmitter = ds.add(new Emitter());
      const event = eventEmitter.event;
      const accumulated = Event.accumulate(event, 0);
      const calls1 = [];
      const calls2 = [];
      const listener1 = ds.add(accumulated((e) => calls1.push(e)));
      ds.add(accumulated((e) => calls2.push(e)));
      eventEmitter.fire(1);
      await timeout(1);
      assert.deepStrictEqual(calls1, [[1]]);
      assert.deepStrictEqual(calls2, [[1]]);
      listener1.dispose();
      await timeout(1);
      assert.deepStrictEqual(calls1, [[1]]);
      assert.deepStrictEqual(calls2, [[1]], "should not fire after a listener is disposed with undefined or []");
    });
    test("should accumulate a single event", async () => {
      const eventEmitter = ds.add(new Emitter());
      const event = eventEmitter.event;
      const accumulated = Event.accumulate(event, 0);
      const results1 = await new Promise((r) => {
        ds.add(accumulated(r));
        eventEmitter.fire(1);
      });
      assert.deepStrictEqual(results1, [1]);
      const results2 = await new Promise((r) => {
        ds.add(accumulated(r));
        eventEmitter.fire(2);
      });
      assert.deepStrictEqual(results2, [2]);
    });
    test("should accumulate multiple events", async () => {
      const eventEmitter = ds.add(new Emitter());
      const event = eventEmitter.event;
      const accumulated = Event.accumulate(event, 0);
      const results1 = await new Promise((r) => {
        ds.add(accumulated(r));
        eventEmitter.fire(1);
        eventEmitter.fire(2);
        eventEmitter.fire(3);
      });
      assert.deepStrictEqual(results1, [1, 2, 3]);
      const results2 = await new Promise((r) => {
        ds.add(accumulated(r));
        eventEmitter.fire(4);
        eventEmitter.fire(5);
        eventEmitter.fire(6);
        eventEmitter.fire(7);
        eventEmitter.fire(8);
      });
      assert.deepStrictEqual(results2, [4, 5, 6, 7, 8]);
    });
  });
  suite("debounce", () => {
    test("simple", function(done) {
      const doc = ds.add(new Samples.Document3());
      const onDocDidChange = Event.debounce(doc.onDidChange, (prev, cur) => {
        if (!prev) {
          prev = [cur];
        } else if (prev.indexOf(cur) < 0) {
          prev.push(cur);
        }
        return prev;
      }, 10);
      let count = 0;
      ds.add(onDocDidChange((keys) => {
        count++;
        assert.ok(keys, "was not expecting keys.");
        if (count === 1) {
          doc.setText("4");
          assert.deepStrictEqual(keys, ["1", "2", "3"]);
        } else if (count === 2) {
          assert.deepStrictEqual(keys, ["4"]);
          done();
        }
      }));
      doc.setText("1");
      doc.setText("2");
      doc.setText("3");
    });
    test("microtask", function(done) {
      const doc = ds.add(new Samples.Document3());
      const onDocDidChange = Event.debounce(doc.onDidChange, (prev, cur) => {
        if (!prev) {
          prev = [cur];
        } else if (prev.indexOf(cur) < 0) {
          prev.push(cur);
        }
        return prev;
      }, MicrotaskDelay);
      let count = 0;
      ds.add(onDocDidChange((keys) => {
        count++;
        assert.ok(keys, "was not expecting keys.");
        if (count === 1) {
          doc.setText("4");
          assert.deepStrictEqual(keys, ["1", "2", "3"]);
        } else if (count === 2) {
          assert.deepStrictEqual(keys, ["4"]);
          done();
        }
      }));
      doc.setText("1");
      doc.setText("2");
      doc.setText("3");
    });
    test("leading", async function() {
      const emitter = ds.add(new Emitter());
      const debounced = Event.debounce(
        emitter.event,
        (l, e) => e,
        0,
        /*leading=*/
        true
      );
      let calls = 0;
      ds.add(debounced(() => {
        calls++;
      }));
      emitter.fire();
      await timeout(1);
      assert.strictEqual(calls, 1);
    });
    test("leading (2)", async function() {
      const emitter = ds.add(new Emitter());
      const debounced = Event.debounce(
        emitter.event,
        (l, e) => e,
        0,
        /*leading=*/
        true
      );
      let calls = 0;
      ds.add(debounced(() => {
        calls++;
      }));
      emitter.fire();
      emitter.fire();
      emitter.fire();
      await timeout(1);
      assert.strictEqual(calls, 2);
    });
    test("leading reset", async function() {
      const emitter = ds.add(new Emitter());
      const debounced = Event.debounce(
        emitter.event,
        (l, e) => l ? l + 1 : 1,
        0,
        /*leading=*/
        true
      );
      const calls = [];
      ds.add(debounced((e) => calls.push(e)));
      emitter.fire(1);
      emitter.fire(1);
      await timeout(1);
      assert.deepStrictEqual(calls, [1, 1]);
    });
    test("should not flush events when a listener is disposed", async () => {
      const emitter = ds.add(new Emitter());
      const debounced = Event.debounce(emitter.event, (l, e) => l ? l + 1 : 1, 0);
      const calls = [];
      const listener = ds.add(debounced((e) => calls.push(e)));
      emitter.fire(1);
      listener.dispose();
      emitter.fire(1);
      await timeout(1);
      assert.deepStrictEqual(calls, []);
    });
    test("flushOnListenerRemove - should flush events when a listener is disposed", async () => {
      const emitter = ds.add(new Emitter());
      const debounced = Event.debounce(emitter.event, (l, e) => l ? l + 1 : 1, 0, void 0, true);
      const calls = [];
      const listener = ds.add(debounced((e) => calls.push(e)));
      emitter.fire(1);
      listener.dispose();
      emitter.fire(1);
      await timeout(1);
      assert.deepStrictEqual(calls, [1], "should fire with the first event, not the second (after listener dispose)");
    });
    test("should flush events when the emitter is disposed", async () => {
      const emitter = ds.add(new Emitter());
      const debounced = Event.debounce(emitter.event, (l, e) => l ? l + 1 : 1, 0);
      const calls = [];
      ds.add(debounced((e) => calls.push(e)));
      emitter.fire(1);
      emitter.dispose();
      await timeout(1);
      assert.deepStrictEqual(calls, [1]);
    });
  });
  test("issue #230401", () => {
    let count = 0;
    const emitter = ds.add(new Emitter());
    const disposables = ds.add(new DisposableStore());
    ds.add(emitter.event(() => {
      count++;
      disposables.add(emitter.event(() => {
        count++;
      }));
      disposables.add(emitter.event(() => {
        count++;
      }));
      disposables.clear();
    }));
    ds.add(emitter.event(() => {
      count++;
    }));
    emitter.fire();
    assert.deepStrictEqual(count, 2);
  });
  suite("chain2", () => {
    let em;
    let calls;
    setup(() => {
      em = ds.add(new Emitter());
      calls = [];
    });
    test("maps", () => {
      const ev = Event.chain(em.event, ($) => $.map((v) => v * 2));
      ds.add(ev((v) => calls.push(v)));
      em.fire(1);
      em.fire(2);
      em.fire(3);
      assert.deepStrictEqual(calls, [2, 4, 6]);
    });
    test("filters", () => {
      const ev = Event.chain(em.event, ($) => $.filter((v) => v % 2 === 0));
      ds.add(ev((v) => calls.push(v)));
      em.fire(1);
      em.fire(2);
      em.fire(3);
      em.fire(4);
      assert.deepStrictEqual(calls, [2, 4]);
    });
    test("reduces", () => {
      const ev = Event.chain(em.event, ($) => $.reduce((acc, v) => acc + v, 0));
      ds.add(ev((v) => calls.push(v)));
      em.fire(1);
      em.fire(2);
      em.fire(3);
      em.fire(4);
      assert.deepStrictEqual(calls, [1, 3, 6, 10]);
    });
    test("latches", () => {
      const ev = Event.chain(em.event, ($) => $.latch());
      ds.add(ev((v) => calls.push(v)));
      em.fire(1);
      em.fire(1);
      em.fire(2);
      em.fire(2);
      em.fire(3);
      em.fire(3);
      em.fire(1);
      assert.deepStrictEqual(calls, [1, 2, 3, 1]);
    });
    test("does everything", () => {
      const ev = Event.chain(
        em.event,
        ($) => $.filter((v) => v % 2 === 0).map((v) => v * 2).reduce((acc, v) => acc + v, 0).latch()
      );
      ds.add(ev((v) => calls.push(v)));
      em.fire(1);
      em.fire(2);
      em.fire(3);
      em.fire(4);
      em.fire(0);
      assert.deepStrictEqual(calls, [4, 12]);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvY29tbW9uL2V2ZW50LnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgc3R1YiB9IGZyb20gJ3Npbm9uJztcbmltcG9ydCB7IERlZmVycmVkUHJvbWlzZSwgdGltZW91dCB9IGZyb20gJy4uLy4uL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgZXJyb3JIYW5kbGVyLCBzZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBBc3luY0VtaXR0ZXIsIERlYm91bmNlRW1pdHRlciwgRHluYW1pY0xpc3RFdmVudE11bHRpcGxleGVyLCBFbWl0dGVyLCBFdmVudCwgRXZlbnRCdWZmZXJlciwgRXZlbnRNdWx0aXBsZXhlciwgSVdhaXRVbnRpbCwgTGlzdGVuZXJMZWFrRXJyb3IsIExpc3RlbmVyUmVmdXNhbEVycm9yLCBNaWNyb3Rhc2tFbWl0dGVyLCBQYXVzZWFibGVFbWl0dGVyLCBSZWxheSwgY3JlYXRlRXZlbnREZWxpdmVyeVF1ZXVlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIGlzRGlzcG9zYWJsZSwgc2V0RGlzcG9zYWJsZVRyYWNrZXIsIERpc3Bvc2FibGVUcmFja2VyIH0gZnJvbSAnLi4vLi4vY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBvYnNlcnZhYmxlVmFsdWUsIHRyYW5zYWN0aW9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgTWljcm90YXNrRGVsYXkgfSBmcm9tICcuLi8uLi9jb21tb24vc3ltYm9scy5qcyc7XG5pbXBvcnQgeyBydW5XaXRoRmFrZWRUaW1lcnMgfSBmcm9tICcuL3RpbWVUcmF2ZWxTY2hlZHVsZXIuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi91dGlscy5qcyc7XG5pbXBvcnQgeyB0YWlsIH0gZnJvbSAnLi4vLi4vY29tbW9uL2FycmF5cy5qcyc7XG5cbm5hbWVzcGFjZSBTYW1wbGVzIHtcblxuXHRleHBvcnQgY2xhc3MgRXZlbnRDb3VudGVyIHtcblxuXHRcdGNvdW50ID0gMDtcblxuXHRcdHJlc2V0KCkge1xuXHRcdFx0dGhpcy5jb3VudCA9IDA7XG5cdFx0fVxuXG5cdFx0b25FdmVudCgpIHtcblx0XHRcdHRoaXMuY291bnQgKz0gMTtcblx0XHR9XG5cdH1cblxuXHRleHBvcnQgY2xhc3MgRG9jdW1lbnQzIHtcblxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlID0gbmV3IEVtaXR0ZXI8c3RyaW5nPigpO1xuXG5cdFx0b25EaWRDaGFuZ2U6IEV2ZW50PHN0cmluZz4gPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRcdHNldFRleHQodmFsdWU6IHN0cmluZykge1xuXHRcdFx0Ly8uLi5cblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUodmFsdWUpO1xuXHRcdH1cblxuXHRcdGRpc3Bvc2UoKSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5kaXNwb3NlKCk7XG5cdFx0fVxuXG5cdH1cbn1cblxuc3VpdGUoJ0V2ZW50IHV0aWxzIGRpc3Bvc2UnLCBmdW5jdGlvbiAoKSB7XG5cblx0Y29uc3QgZHMgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRsZXQgdHJhY2tlciA9IG5ldyBEaXNwb3NhYmxlVHJhY2tlcigpO1xuXG5cdGZ1bmN0aW9uIGFzc2VydERpc3Bvc2FibGVzQ291bnQoZXhwZWN0ZWQ6IG51bWJlciB8IEFycmF5PElEaXNwb3NhYmxlPikge1xuXHRcdGlmIChBcnJheS5pc0FycmF5KGV4cGVjdGVkKSkge1xuXHRcdFx0Y29uc3QgaW5zdGFuY2VzID0gbmV3IFNldChleHBlY3RlZCk7XG5cdFx0XHRjb25zdCBhY3R1YWxJbnN0YW5jZXMgPSB0cmFja2VyLmdldFRyYWNrZWREaXNwb3NhYmxlcygpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbEluc3RhbmNlcy5sZW5ndGgsIGV4cGVjdGVkLmxlbmd0aCk7XG5cblx0XHRcdGZvciAoY29uc3QgaXRlbSBvZiBhY3R1YWxJbnN0YW5jZXMpIHtcblx0XHRcdFx0YXNzZXJ0Lm9rKGluc3RhbmNlcy5oYXMoaXRlbSkpO1xuXHRcdFx0fVxuXG5cdFx0fSBlbHNlIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmFja2VyLmdldFRyYWNrZWREaXNwb3NhYmxlcygpLmxlbmd0aCwgZXhwZWN0ZWQpO1xuXHRcdH1cblxuXHR9XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdHRyYWNrZXIgPSBuZXcgRGlzcG9zYWJsZVRyYWNrZXIoKTtcblx0XHRzZXREaXNwb3NhYmxlVHJhY2tlcih0cmFja2VyKTtcblx0fSk7XG5cblx0dGVhcmRvd24oZnVuY3Rpb24gKCkge1xuXHRcdHNldERpc3Bvc2FibGVUcmFja2VyKG51bGwpO1xuXHR9KTtcblxuXHR0ZXN0KCdubyBsZWFrIHdpdGggc25hcHNob3QtdXRpbHMnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBlbWl0dGVyID0gZHMuYWRkKG5ldyBFbWl0dGVyPG51bWJlcj4oKSk7XG5cdFx0Y29uc3QgZXZlbnMgPSBFdmVudC5maWx0ZXIoZW1pdHRlci5ldmVudCwgbiA9PiBuICUgMiA9PT0gMCwgc3RvcmUpO1xuXHRcdGFzc2VydERpc3Bvc2FibGVzQ291bnQoMSk7IC8vIHNuYXBob3Qgb25seSBsaXN0ZW4gd2hlbiBgZXZlbnNgIGlzIGJlaW5nIGxpc3RlbmVkIG9uXG5cblx0XHRsZXQgYWxsID0gMDtcblx0XHRjb25zdCBsZWFrZWQgPSBldmVucyhuID0+IGFsbCArPSBuKTtcblx0XHRhc3NlcnQub2soaXNEaXNwb3NhYmxlKGxlYWtlZCkpO1xuXHRcdGFzc2VydERpc3Bvc2FibGVzQ291bnQoMyk7XG5cblx0XHRlbWl0dGVyLmRpc3Bvc2UoKTtcblx0XHRzdG9yZS5kaXNwb3NlKCk7XG5cdFx0YXNzZXJ0RGlzcG9zYWJsZXNDb3VudChbbGVha2VkXSk7IC8vIGxlYWtlZCBpcyBzdGlsbCB0aGVyZVxuXHR9KTtcblxuXHR0ZXN0KCdubyBsZWFrIHdpdGggZGVib3VuY2UtdXRpbCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBlbWl0dGVyID0gZHMuYWRkKG5ldyBFbWl0dGVyPG51bWJlcj4oKSk7XG5cdFx0Y29uc3QgZGVib3VuY2VkID0gRXZlbnQuZGVib3VuY2UoZW1pdHRlci5ldmVudCwgKGwpID0+IDAsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgc3RvcmUpO1xuXHRcdGFzc2VydERpc3Bvc2FibGVzQ291bnQoMSk7IC8vIGRlYm91bmNlIG9ubHkgbGlzdGVucyB3aGVuIGBkZWJvdW5jZWAgaXMgYmVpbmcgbGlzdGVuZWQgb25cblxuXHRcdGxldCBhbGwgPSAwO1xuXHRcdGNvbnN0IGxlYWtlZCA9IGRlYm91bmNlZChuID0+IGFsbCArPSBuKTtcblx0XHRhc3NlcnQub2soaXNEaXNwb3NhYmxlKGxlYWtlZCkpO1xuXHRcdGFzc2VydERpc3Bvc2FibGVzQ291bnQoMyk7XG5cblx0XHRlbWl0dGVyLmRpc3Bvc2UoKTtcblx0XHRzdG9yZS5kaXNwb3NlKCk7XG5cblx0XHRhc3NlcnREaXNwb3NhYmxlc0NvdW50KFtsZWFrZWRdKTsgLy8gbGVha2VkIGlzIHN0aWxsIHRoZXJlXG5cdH0pO1xufSk7XG5cbnN1aXRlKCdFdmVudCcsIGZ1bmN0aW9uICgpIHtcblxuXHRjb25zdCBkcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGNvbnN0IGNvdW50ZXIgPSBuZXcgU2FtcGxlcy5FdmVudENvdW50ZXIoKTtcblxuXHRzZXR1cCgoKSA9PiBjb3VudGVyLnJlc2V0KCkpO1xuXG5cdHRlc3QoJ0VtaXR0ZXIgcGxhaW4nLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBkb2MgPSBkcy5hZGQobmV3IFNhbXBsZXMuRG9jdW1lbnQzKCkpO1xuXG5cdFx0Y29uc3Qgc3Vic2NyaXB0aW9uID0gZG9jLm9uRGlkQ2hhbmdlKGNvdW50ZXIub25FdmVudCwgY291bnRlcik7XG5cblx0XHRkb2Muc2V0VGV4dCgnZmFyJyk7XG5cdFx0ZG9jLnNldFRleHQoJ2JvbycpO1xuXG5cdFx0Ly8gdW5ob29rIGxpc3RlbmVyXG5cdFx0c3Vic2NyaXB0aW9uLmRpc3Bvc2UoKTtcblx0XHRkb2Muc2V0VGV4dCgnYm9vJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50ZXIuY291bnQsIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCdFbWl0dGVyIGR1cGxpY2F0ZSBmdW5jdGlvbnMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY2FsbHM6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3QgYSA9ICh2OiBzdHJpbmcpID0+IGNhbGxzLnB1c2goYGEke3Z9YCk7XG5cdFx0Y29uc3QgYiA9ICh2OiBzdHJpbmcpID0+IGNhbGxzLnB1c2goYGIke3Z9YCk7XG5cblx0XHRjb25zdCBlbWl0dGVyID0gZHMuYWRkKG5ldyBFbWl0dGVyPHN0cmluZz4oKSk7XG5cblx0XHRkcy5hZGQoZW1pdHRlci5ldmVudChhKSk7XG5cdFx0ZHMuYWRkKGVtaXR0ZXIuZXZlbnQoYikpO1xuXHRcdGNvbnN0IHMyID0gZW1pdHRlci5ldmVudChhKTtcblxuXHRcdGVtaXR0ZXIuZmlyZSgnMScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2FsbHMsIFsnYTEnLCAnYjEnLCAnYTEnXSk7XG5cblx0XHRzMi5kaXNwb3NlKCk7XG5cdFx0Y2FsbHMubGVuZ3RoID0gMDtcblx0XHRlbWl0dGVyLmZpcmUoJzInKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzLCBbJ2EyJywgJ2IyJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdFbWl0dGVyLCBkaXNwb3NlIGxpc3RlbmVyIGR1cmluZyBlbWlzc2lvbicsICgpID0+IHtcblx0XHRmb3IgKGxldCBrZWVwRmlyc3RNb2QgPSAxOyBrZWVwRmlyc3RNb2QgPCA0OyBrZWVwRmlyc3RNb2QrKykge1xuXHRcdFx0Y29uc3QgZW1pdHRlciA9IGRzLmFkZChuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0XHRcdGNvbnN0IGNhbGxzOiBudW1iZXJbXSA9IFtdO1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBBcnJheS5mcm9tKHsgbGVuZ3RoOiAyNSB9LCAoXywgbikgPT4gZHMuYWRkKGVtaXR0ZXIuZXZlbnQoKCkgPT4ge1xuXHRcdFx0XHRpZiAobiAlIGtlZXBGaXJzdE1vZCA9PT0gMCkge1xuXHRcdFx0XHRcdGRpc3Bvc2FibGVzW25dLmRpc3Bvc2UoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjYWxscy5wdXNoKG4pO1xuXHRcdFx0fSkpKTtcblxuXHRcdFx0ZW1pdHRlci5maXJlKCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzLCBBcnJheS5mcm9tKHsgbGVuZ3RoOiAyNSB9LCAoXywgbikgPT4gbikpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnRW1pdHRlciwgZGlzcG9zZSBlbWl0dGVyIGR1cmluZyBlbWlzc2lvbicsICgpID0+IHtcblx0XHRjb25zdCBlbWl0dGVyID0gZHMuYWRkKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRcdGNvbnN0IGNhbGxzOiBudW1iZXJbXSA9IFtdO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gQXJyYXkuZnJvbSh7IGxlbmd0aDogMjUgfSwgKF8sIG4pID0+IGRzLmFkZChlbWl0dGVyLmV2ZW50KCgpID0+IHtcblx0XHRcdGlmIChuID09PSAxMCkge1xuXHRcdFx0XHRlbWl0dGVyLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHRcdGNhbGxzLnB1c2gobik7XG5cdFx0fSkpKTtcblxuXHRcdGVtaXR0ZXIuZmlyZSgpO1xuXHRcdGRpc3Bvc2FibGVzLmZvckVhY2goZCA9PiBkLmRpc3Bvc2UoKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxscywgQXJyYXkuZnJvbSh7IGxlbmd0aDogMTEgfSwgKF8sIG4pID0+IG4pKTtcblx0fSk7XG5cblx0dGVzdCgnRW1pdHRlciwgc2hhcmVkIGRlbGl2ZXJ5IHF1ZXVlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGRlbGl2ZXJ5UXVldWUgPSBjcmVhdGVFdmVudERlbGl2ZXJ5UXVldWUoKTtcblx0XHRjb25zdCBlbWl0dGVyMSA9IGRzLmFkZChuZXcgRW1pdHRlcjxudW1iZXI+KHsgZGVsaXZlcnlRdWV1ZSB9KSk7XG5cdFx0Y29uc3QgZW1pdHRlcjIgPSBkcy5hZGQobmV3IEVtaXR0ZXI8bnVtYmVyPih7IGRlbGl2ZXJ5UXVldWUgfSkpO1xuXG5cdFx0Y29uc3QgY2FsbHM6IHN0cmluZ1tdID0gW107XG5cdFx0ZHMuYWRkKGVtaXR0ZXIxLmV2ZW50KGQgPT4geyBjYWxscy5wdXNoKGAke2R9YWApOyBpZiAoZCA9PT0gMSkgeyBlbWl0dGVyMi5maXJlKDIpOyB9IH0pKTtcblx0XHRkcy5hZGQoZW1pdHRlcjEuZXZlbnQoZCA9PiB7IGNhbGxzLnB1c2goYCR7ZH1iYCk7IH0pKTtcblxuXHRcdGRzLmFkZChlbWl0dGVyMi5ldmVudChkID0+IHsgY2FsbHMucHVzaChgJHtkfWNgKTsgZW1pdHRlcjEuZGlzcG9zZSgpOyB9KSk7XG5cdFx0ZHMuYWRkKGVtaXR0ZXIyLmV2ZW50KGQgPT4geyBjYWxscy5wdXNoKGAke2R9ZGApOyB9KSk7XG5cblx0XHRlbWl0dGVyMS5maXJlKDEpO1xuXG5cdFx0Ly8gMS4gQ2hlY2sgdGhhdCAyIGlzIG5vdCBkZWxpdmVyZWQgYmVmb3JlIDEgZmluaXNoZXNcblx0XHQvLyAyLiBDaGVjayB0aGF0IDIgZmluaXNoZXMgZ2V0dGluZyBkZWxpdmVyZWQgZXZlbiBpZiBvbmUgZW1pdHRlciBpcyBkaXNwb3NlZFxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2FsbHMsIFsnMWEnLCAnMWInLCAnMmMnLCAnMmQnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0VtaXR0ZXIsIGhhbmRsZXMgcmVtb3ZhbCBkdXJpbmcgMycsICgpID0+IHtcblx0XHRjb25zdCBmbjEgPSBzdHViKCk7XG5cdFx0Y29uc3QgZm4yID0gc3R1YigpO1xuXHRcdGNvbnN0IGVtaXR0ZXIgPSBkcy5hZGQobmV3IEVtaXR0ZXI8c3RyaW5nPigpKTtcblxuXHRcdGRzLmFkZChlbWl0dGVyLmV2ZW50KGZuMSkpO1xuXHRcdGNvbnN0IGggPSBlbWl0dGVyLmV2ZW50KCgpID0+IHtcblx0XHRcdGguZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHRcdGRzLmFkZChlbWl0dGVyLmV2ZW50KGZuMikpO1xuXHRcdGVtaXR0ZXIuZmlyZSgnZm9vJyk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZuMi5hcmdzLCBbWydmb28nXV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZm4xLmFyZ3MsIFtbJ2ZvbyddXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0VtaXR0ZXIsIGhhbmRsZXMgcmVtb3ZhbCBkdXJpbmcgMicsICgpID0+IHtcblx0XHRjb25zdCBmbjEgPSBzdHViKCk7XG5cdFx0Y29uc3QgZW1pdHRlciA9IGRzLmFkZChuZXcgRW1pdHRlcjxzdHJpbmc+KCkpO1xuXG5cdFx0ZHMuYWRkKGVtaXR0ZXIuZXZlbnQoZm4xKSk7XG5cdFx0Y29uc3QgaCA9IGVtaXR0ZXIuZXZlbnQoKCkgPT4ge1xuXHRcdFx0aC5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdFx0ZW1pdHRlci5maXJlKCdmb28nKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZm4xLmFyZ3MsIFtbJ2ZvbyddXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0VtaXR0ZXIsIGJ1Y2tldCcsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGJ1Y2tldDogSURpc3Bvc2FibGVbXSA9IFtdO1xuXHRcdGNvbnN0IGRvYyA9IGRzLmFkZChuZXcgU2FtcGxlcy5Eb2N1bWVudDMoKSk7XG5cdFx0Y29uc3Qgc3Vic2NyaXB0aW9uID0gZG9jLm9uRGlkQ2hhbmdlKGNvdW50ZXIub25FdmVudCwgY291bnRlciwgYnVja2V0KTtcblxuXHRcdGRvYy5zZXRUZXh0KCdmYXInKTtcblx0XHRkb2Muc2V0VGV4dCgnYm9vJyk7XG5cblx0XHQvLyB1bmhvb2sgbGlzdGVuZXJcblx0XHR3aGlsZSAoYnVja2V0Lmxlbmd0aCkge1xuXHRcdFx0YnVja2V0LnBvcCgpIS5kaXNwb3NlKCk7XG5cdFx0fVxuXHRcdGRvYy5zZXRUZXh0KCdib28nKTtcblxuXHRcdC8vIG5vb3Bcblx0XHRzdWJzY3JpcHRpb24uZGlzcG9zZSgpO1xuXG5cdFx0ZG9jLnNldFRleHQoJ2JvbycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudGVyLmNvdW50LCAyKTtcblx0fSk7XG5cblx0dGVzdCgnRW1pdHRlciwgc3RvcmUnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBidWNrZXQgPSBkcy5hZGQobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0XHRjb25zdCBkb2MgPSBkcy5hZGQobmV3IFNhbXBsZXMuRG9jdW1lbnQzKCkpO1xuXHRcdGNvbnN0IHN1YnNjcmlwdGlvbiA9IGRvYy5vbkRpZENoYW5nZShjb3VudGVyLm9uRXZlbnQsIGNvdW50ZXIsIGJ1Y2tldCk7XG5cblx0XHRkb2Muc2V0VGV4dCgnZmFyJyk7XG5cdFx0ZG9jLnNldFRleHQoJ2JvbycpO1xuXG5cdFx0Ly8gdW5ob29rIGxpc3RlbmVyXG5cdFx0YnVja2V0LmNsZWFyKCk7XG5cdFx0ZG9jLnNldFRleHQoJ2JvbycpO1xuXG5cdFx0Ly8gbm9vcFxuXHRcdHN1YnNjcmlwdGlvbi5kaXNwb3NlKCk7XG5cblx0XHRkb2Muc2V0VGV4dCgnYm9vJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50ZXIuY291bnQsIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCdvbkZpcnN0QWRkfG9uTGFzdFJlbW92ZScsICgpID0+IHtcblxuXHRcdGxldCBmaXJzdENvdW50ID0gMDtcblx0XHRsZXQgbGFzdENvdW50ID0gMDtcblx0XHRjb25zdCBhID0gZHMuYWRkKG5ldyBFbWl0dGVyKHtcblx0XHRcdG9uV2lsbEFkZEZpcnN0TGlzdGVuZXIoKSB7IGZpcnN0Q291bnQgKz0gMTsgfSxcblx0XHRcdG9uRGlkUmVtb3ZlTGFzdExpc3RlbmVyKCkgeyBsYXN0Q291bnQgKz0gMTsgfVxuXHRcdH0pKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdENvdW50LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFzdENvdW50LCAwKTtcblxuXHRcdGxldCBzdWJzY3JpcHRpb24xID0gZHMuYWRkKGEuZXZlbnQoZnVuY3Rpb24gKCkgeyB9KSk7XG5cdFx0Y29uc3Qgc3Vic2NyaXB0aW9uMiA9IGRzLmFkZChhLmV2ZW50KGZ1bmN0aW9uICgpIHsgfSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdENvdW50LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFzdENvdW50LCAwKTtcblxuXHRcdHN1YnNjcmlwdGlvbjEuZGlzcG9zZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdENvdW50LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFzdENvdW50LCAwKTtcblxuXHRcdHN1YnNjcmlwdGlvbjIuZGlzcG9zZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdENvdW50LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFzdENvdW50LCAxKTtcblxuXHRcdHN1YnNjcmlwdGlvbjEgPSBkcy5hZGQoYS5ldmVudChmdW5jdGlvbiAoKSB7IH0pKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3RDb3VudCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhc3RDb3VudCwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ29uRGlkQWRkTGlzdGVuZXInLCAoKSA9PiB7XG5cdFx0bGV0IGNvdW50ID0gMDtcblx0XHRjb25zdCBhID0gZHMuYWRkKG5ldyBFbWl0dGVyKHtcblx0XHRcdG9uRGlkQWRkTGlzdGVuZXIoKSB7IGNvdW50ICs9IDE7IH1cblx0XHR9KSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDApO1xuXG5cdFx0bGV0IHN1YnNjcmlwdGlvbiA9IGRzLmFkZChhLmV2ZW50KGZ1bmN0aW9uICgpIHsgfSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudCwgMSk7XG5cblx0XHRzdWJzY3JpcHRpb24uZGlzcG9zZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudCwgMSk7XG5cblx0XHRzdWJzY3JpcHRpb24gPSBkcy5hZGQoYS5ldmVudChmdW5jdGlvbiAoKSB7IH0pKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDIpO1xuXG5cdFx0c3Vic2NyaXB0aW9uLmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCdvbldpbGxSZW1vdmVMaXN0ZW5lcicsICgpID0+IHtcblx0XHRsZXQgY291bnQgPSAwO1xuXHRcdGNvbnN0IGEgPSBkcy5hZGQobmV3IEVtaXR0ZXIoe1xuXHRcdFx0b25XaWxsUmVtb3ZlTGlzdGVuZXIoKSB7IGNvdW50ICs9IDE7IH1cblx0XHR9KSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDApO1xuXG5cdFx0bGV0IHN1YnNjcmlwdGlvbiA9IGRzLmFkZChhLmV2ZW50KGZ1bmN0aW9uICgpIHsgfSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudCwgMCk7XG5cblx0XHRzdWJzY3JpcHRpb24uZGlzcG9zZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudCwgMSk7XG5cblx0XHRzdWJzY3JpcHRpb24gPSBkcy5hZGQoYS5ldmVudChmdW5jdGlvbiAoKSB7IH0pKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCd0aHJvd2luZ0xpc3RlbmVyJywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdFcnJvckhhbmRsZXIgPSBlcnJvckhhbmRsZXIuZ2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcigpO1xuXHRcdHNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIoKCkgPT4gbnVsbCk7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgYSA9IGRzLmFkZChuZXcgRW1pdHRlcjx1bmRlZmluZWQ+KCkpO1xuXHRcdFx0bGV0IGhpdCA9IGZhbHNlO1xuXHRcdFx0ZHMuYWRkKGEuZXZlbnQoZnVuY3Rpb24gKCkge1xuXHRcdFx0XHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdGhyb3ctbGl0ZXJhbFxuXHRcdFx0XHR0aHJvdyA5O1xuXHRcdFx0fSkpO1xuXHRcdFx0ZHMuYWRkKGEuZXZlbnQoZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRoaXQgPSB0cnVlO1xuXHRcdFx0fSkpO1xuXHRcdFx0YS5maXJlKHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGl0LCB0cnVlKTtcblxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRzZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKG9yaWdFcnJvckhhbmRsZXIpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgndGhyb3dpbmdMaXN0ZW5lciAoY3VzdG9tIGhhbmRsZXIpJywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgYWxsRXJyb3I6IGFueVtdID0gW107XG5cblx0XHRjb25zdCBhID0gZHMuYWRkKG5ldyBFbWl0dGVyPHVuZGVmaW5lZD4oe1xuXHRcdFx0b25MaXN0ZW5lckVycm9yKGUpIHsgYWxsRXJyb3IucHVzaChlKTsgfVxuXHRcdH0pKTtcblx0XHRsZXQgaGl0ID0gZmFsc2U7XG5cdFx0ZHMuYWRkKGEuZXZlbnQoZnVuY3Rpb24gKCkge1xuXHRcdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXRocm93LWxpdGVyYWxcblx0XHRcdHRocm93IDk7XG5cdFx0fSkpO1xuXHRcdGRzLmFkZChhLmV2ZW50KGZ1bmN0aW9uICgpIHtcblx0XHRcdGhpdCA9IHRydWU7XG5cdFx0fSkpO1xuXHRcdGEuZmlyZSh1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoaXQsIHRydWUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWxsRXJyb3IsIFs5XSk7XG5cblx0fSk7XG5cblx0dGVzdCgndGhyb3cgTGlzdGVuZXJMZWFrRXJyb3InLCAoKSA9PiB7XG5cblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBhbGxFcnJvcjogYW55W10gPSBbXTtcblxuXHRcdGNvbnN0IGEgPSBkcy5hZGQobmV3IEVtaXR0ZXI8dW5kZWZpbmVkPih7XG5cdFx0XHRvbkxpc3RlbmVyRXJyb3IoZSkgeyBhbGxFcnJvci5wdXNoKGUpOyB9LFxuXHRcdFx0bGVha1dhcm5pbmdUaHJlc2hvbGQ6IDMsXG5cdFx0fSkpO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAxMTsgaSsrKSB7XG5cdFx0XHRhLmV2ZW50KCgpID0+IHsgfSwgdW5kZWZpbmVkLCBzdG9yZSk7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhbGxFcnJvci5sZW5ndGgsIDUpO1xuXHRcdGNvbnN0IFtzdGFydCwgcmVzdF0gPSB0YWlsKGFsbEVycm9yKTtcblx0XHRhc3NlcnQub2socmVzdCBpbnN0YW5jZW9mIExpc3RlbmVyUmVmdXNhbEVycm9yKTtcblxuXHRcdGZvciAoY29uc3QgaXRlbSBvZiBzdGFydCkge1xuXHRcdFx0YXNzZXJ0Lm9rKGl0ZW0gaW5zdGFuY2VvZiBMaXN0ZW5lckxlYWtFcnJvcik7XG5cdFx0fVxuXG5cdFx0c3RvcmUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXVzaW5nIGV2ZW50IGZ1bmN0aW9uIGFuZCBjb250ZXh0JywgZnVuY3Rpb24gKCkge1xuXHRcdGxldCBjb3VudGVyID0gMDtcblx0XHRmdW5jdGlvbiBsaXN0ZW5lcigpIHtcblx0XHRcdGNvdW50ZXIgKz0gMTtcblx0XHR9XG5cdFx0Y29uc3QgY29udGV4dCA9IHt9O1xuXG5cdFx0Y29uc3QgZW1pdHRlciA9IGRzLmFkZChuZXcgRW1pdHRlcjx1bmRlZmluZWQ+KCkpO1xuXHRcdGNvbnN0IHJlZzEgPSBlbWl0dGVyLmV2ZW50KGxpc3RlbmVyLCBjb250ZXh0KTtcblx0XHRjb25zdCByZWcyID0gZW1pdHRlci5ldmVudChsaXN0ZW5lciwgY29udGV4dCk7XG5cblx0XHRlbWl0dGVyLmZpcmUodW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnRlciwgMik7XG5cblx0XHRyZWcxLmRpc3Bvc2UoKTtcblx0XHRlbWl0dGVyLmZpcmUodW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnRlciwgMyk7XG5cblx0XHRyZWcyLmRpc3Bvc2UoKTtcblx0XHRlbWl0dGVyLmZpcmUodW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnRlciwgMyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0RlYm91bmNlRW1pdHRlcicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gcnVuV2l0aEZha2VkVGltZXJzKHt9LCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdGxldCBjYWxsQ291bnQgPSAwO1xuXHRcdFx0bGV0IHN1bSA9IDA7XG5cdFx0XHRjb25zdCBlbWl0dGVyID0gbmV3IERlYm91bmNlRW1pdHRlcjxudW1iZXI+KHtcblx0XHRcdFx0bWVyZ2U6IGFyciA9PiB7XG5cdFx0XHRcdFx0Y2FsbENvdW50ICs9IDE7XG5cdFx0XHRcdFx0cmV0dXJuIGFyci5yZWR1Y2UoKHAsIGMpID0+IHAgKyBjKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdGRzLmFkZChlbWl0dGVyLmV2ZW50KGUgPT4geyBzdW0gPSBlOyB9KSk7XG5cblx0XHRcdGNvbnN0IHAgPSBFdmVudC50b1Byb21pc2UoZW1pdHRlci5ldmVudCk7XG5cblx0XHRcdGVtaXR0ZXIuZmlyZSgxKTtcblx0XHRcdGVtaXR0ZXIuZmlyZSgyKTtcblxuXHRcdFx0YXdhaXQgcDtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxDb3VudCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3VtLCAzKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnTWljcm90YXNrIEVtaXR0ZXInLCAoZG9uZSkgPT4ge1xuXHRcdGxldCBjb3VudCA9IDA7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50LCAwKTtcblx0XHRjb25zdCBlbWl0dGVyID0gbmV3IE1pY3JvdGFza0VtaXR0ZXI8dm9pZD4oKTtcblx0XHRjb25zdCBsaXN0ZW5lciA9IGVtaXR0ZXIuZXZlbnQoKCkgPT4ge1xuXHRcdFx0Y291bnQrKztcblx0XHR9KTtcblx0XHRlbWl0dGVyLmZpcmUoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDApO1xuXHRcdGVtaXR0ZXIuZmlyZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudCwgMCk7XG5cdFx0Ly8gU2hvdWxkIHdhaXQgdW50aWwgdGhlIGV2ZW50IGxvb3AgZW5kcyBhbmQgdGhlcmVmb3JlIGJlIHRoZSBsYXN0IHRoaW5nIGNhbGxlZFxuXHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50LCAzKTtcblx0XHRcdGRvbmUoKTtcblx0XHR9LCAwKTtcblx0XHRxdWV1ZU1pY3JvdGFzaygoKSA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDIpO1xuXHRcdFx0Y291bnQrKztcblx0XHRcdGxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRW1pdHRlciAtIEluIE9yZGVyIERlbGl2ZXJ5JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGEgPSBkcy5hZGQobmV3IEVtaXR0ZXI8c3RyaW5nPigpKTtcblx0XHRjb25zdCBsaXN0ZW5lcjJFdmVudHM6IHN0cmluZ1tdID0gW107XG5cdFx0ZHMuYWRkKGEuZXZlbnQoZnVuY3Rpb24gbGlzdGVuZXIxKGV2ZW50KSB7XG5cdFx0XHRpZiAoZXZlbnQgPT09ICdlMScpIHtcblx0XHRcdFx0YS5maXJlKCdlMicpO1xuXHRcdFx0XHQvLyBhc3NlcnQgdGhhdCBhbGwgZXZlbnRzIGFyZSBkZWxpdmVyZWQgYXQgdGhpcyBwb2ludFxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RlbmVyMkV2ZW50cywgWydlMScsICdlMiddKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0ZHMuYWRkKGEuZXZlbnQoZnVuY3Rpb24gbGlzdGVuZXIyKGV2ZW50KSB7XG5cdFx0XHRsaXN0ZW5lcjJFdmVudHMucHVzaChldmVudCk7XG5cdFx0fSkpO1xuXHRcdGEuZmlyZSgnZTEnKTtcblxuXHRcdC8vIGFzc2VydCB0aGF0IGFsbCBldmVudHMgYXJlIGRlbGl2ZXJlZCBpbiBvcmRlclxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdGVuZXIyRXZlbnRzLCBbJ2UxJywgJ2UyJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdFbWl0dGVyLCAtIEluIE9yZGVyIERlbGl2ZXJ5IDN4JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGEgPSBkcy5hZGQobmV3IEVtaXR0ZXI8c3RyaW5nPigpKTtcblx0XHRjb25zdCBsaXN0ZW5lcjJFdmVudHM6IHN0cmluZ1tdID0gW107XG5cdFx0ZHMuYWRkKGEuZXZlbnQoZnVuY3Rpb24gbGlzdGVuZXIxKGV2ZW50KSB7XG5cdFx0XHRpZiAoZXZlbnQgPT09ICdlMicpIHtcblx0XHRcdFx0YS5maXJlKCdlMycpO1xuXHRcdFx0XHQvLyBhc3NlcnQgdGhhdCBhbGwgZXZlbnRzIGFyZSBkZWxpdmVyZWQgYXQgdGhpcyBwb2ludFxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RlbmVyMkV2ZW50cywgWydlMScsICdlMicsICdlMyddKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0ZHMuYWRkKGEuZXZlbnQoZnVuY3Rpb24gbGlzdGVuZXIxKGV2ZW50KSB7XG5cdFx0XHRpZiAoZXZlbnQgPT09ICdlMScpIHtcblx0XHRcdFx0YS5maXJlKCdlMicpO1xuXHRcdFx0XHQvLyBhc3NlcnQgdGhhdCBhbGwgZXZlbnRzIGFyZSBkZWxpdmVyZWQgYXQgdGhpcyBwb2ludFxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RlbmVyMkV2ZW50cywgWydlMScsICdlMicsICdlMyddKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0ZHMuYWRkKGEuZXZlbnQoZnVuY3Rpb24gbGlzdGVuZXIyKGV2ZW50KSB7XG5cdFx0XHRsaXN0ZW5lcjJFdmVudHMucHVzaChldmVudCk7XG5cdFx0fSkpO1xuXHRcdGEuZmlyZSgnZTEnKTtcblxuXHRcdC8vIGFzc2VydCB0aGF0IGFsbCBldmVudHMgYXJlIGRlbGl2ZXJlZCBpbiBvcmRlclxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdGVuZXIyRXZlbnRzLCBbJ2UxJywgJ2UyJywgJ2UzJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdDYW5ub3QgcmVhZCBwcm9wZXJ0eSBcXCdfYWN0dWFsXFwnIG9mIHVuZGVmaW5lZCAjMTQyMjA0JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGUgPSBkcy5hZGQobmV3IEVtaXR0ZXI8bnVtYmVyPigpKTtcblx0XHRjb25zdCBkaXNwbyA9IGUuZXZlbnQoKCkgPT4geyB9KTtcblx0XHRkaXNwby5kaXNwb3NlLmNhbGwodW5kZWZpbmVkKTsgIC8vIGFzc2VydCB0aGF0IGRpc3Bvc2FibGUgY2FuIGJlIGNhbGxlZCB3aXRoIHRoaXNcblx0fSk7XG59KTtcblxuc3VpdGUoJ0FzeW5jRW1pdHRlcicsIGZ1bmN0aW9uICgpIHtcblxuXHRjb25zdCBkcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2V2ZW50IGhhcyB3YWl0VW50aWwtZnVuY3Rpb24nLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRpbnRlcmZhY2UgRSBleHRlbmRzIElXYWl0VW50aWwge1xuXHRcdFx0Zm9vOiBib29sZWFuO1xuXHRcdFx0YmFyOiBudW1iZXI7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZW1pdHRlciA9IG5ldyBBc3luY0VtaXR0ZXI8RT4oKTtcblxuXHRcdGRzLmFkZChlbWl0dGVyLmV2ZW50KGUgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGUuZm9vLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlLmJhciwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZW9mIGUud2FpdFVudGlsLCAnZnVuY3Rpb24nKTtcblx0XHR9KSk7XG5cblx0XHRlbWl0dGVyLmZpcmVBc3luYyh7IGZvbzogdHJ1ZSwgYmFyOiAxLCB9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRlbWl0dGVyLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnc2VxdWVudGlhbCBkZWxpdmVyeScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gcnVuV2l0aEZha2VkVGltZXJzKHt9LCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdGludGVyZmFjZSBFIGV4dGVuZHMgSVdhaXRVbnRpbCB7XG5cdFx0XHRcdGZvbzogYm9vbGVhbjtcblx0XHRcdH1cblxuXHRcdFx0bGV0IGdsb2JhbFN0YXRlID0gMDtcblx0XHRcdGNvbnN0IGVtaXR0ZXIgPSBuZXcgQXN5bmNFbWl0dGVyPEU+KCk7XG5cblx0XHRcdGRzLmFkZChlbWl0dGVyLmV2ZW50KGUgPT4ge1xuXHRcdFx0XHRlLndhaXRVbnRpbCh0aW1lb3V0KDEwKS50aGVuKF8gPT4ge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iYWxTdGF0ZSwgMCk7XG5cdFx0XHRcdFx0Z2xvYmFsU3RhdGUgKz0gMTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHRkcy5hZGQoZW1pdHRlci5ldmVudChlID0+IHtcblx0XHRcdFx0ZS53YWl0VW50aWwodGltZW91dCgxKS50aGVuKF8gPT4ge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iYWxTdGF0ZSwgMSk7XG5cdFx0XHRcdFx0Z2xvYmFsU3RhdGUgKz0gMTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHRhd2FpdCBlbWl0dGVyLmZpcmVBc3luYyh7IGZvbzogdHJ1ZSB9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iYWxTdGF0ZSwgMik7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NlcXVlbnRpYWwsIGluLW9yZGVyIGRlbGl2ZXJ5JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiBydW5XaXRoRmFrZWRUaW1lcnMoe30sIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdFx0aW50ZXJmYWNlIEUgZXh0ZW5kcyBJV2FpdFVudGlsIHtcblx0XHRcdFx0Zm9vOiBudW1iZXI7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBldmVudHM6IG51bWJlcltdID0gW107XG5cdFx0XHRsZXQgZG9uZSA9IGZhbHNlO1xuXHRcdFx0Y29uc3QgZW1pdHRlciA9IG5ldyBBc3luY0VtaXR0ZXI8RT4oKTtcblxuXHRcdFx0Ly8gZTFcblx0XHRcdGRzLmFkZChlbWl0dGVyLmV2ZW50KGUgPT4ge1xuXHRcdFx0XHRlLndhaXRVbnRpbCh0aW1lb3V0KDEwKS50aGVuKGFzeW5jIF8gPT4ge1xuXHRcdFx0XHRcdGlmIChlLmZvbyA9PT0gMSkge1xuXHRcdFx0XHRcdFx0YXdhaXQgZW1pdHRlci5maXJlQXN5bmMoeyBmb286IDIgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGV2ZW50cywgWzEsIDJdKTtcblx0XHRcdFx0XHRcdGRvbmUgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHQvLyBlMlxuXHRcdFx0ZHMuYWRkKGVtaXR0ZXIuZXZlbnQoZSA9PiB7XG5cdFx0XHRcdGV2ZW50cy5wdXNoKGUuZm9vKTtcblx0XHRcdFx0ZS53YWl0VW50aWwodGltZW91dCg3KSk7XG5cdFx0XHR9KSk7XG5cblx0XHRcdGF3YWl0IGVtaXR0ZXIuZmlyZUFzeW5jKHsgZm9vOiAxIH0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0YXNzZXJ0Lm9rKGRvbmUpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdjYXRjaCBlcnJvcnMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgb3JpZ0Vycm9ySGFuZGxlciA9IGVycm9ySGFuZGxlci5nZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKCk7XG5cdFx0c2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcigoKSA9PiBudWxsKTtcblxuXHRcdGludGVyZmFjZSBFIGV4dGVuZHMgSVdhaXRVbnRpbCB7XG5cdFx0XHRmb286IGJvb2xlYW47XG5cdFx0fVxuXG5cdFx0bGV0IGdsb2JhbFN0YXRlID0gMDtcblx0XHRjb25zdCBlbWl0dGVyID0gbmV3IEFzeW5jRW1pdHRlcjxFPigpO1xuXG5cdFx0ZHMuYWRkKGVtaXR0ZXIuZXZlbnQoZSA9PiB7XG5cdFx0XHRnbG9iYWxTdGF0ZSArPSAxO1xuXHRcdFx0ZS53YWl0VW50aWwobmV3IFByb21pc2UoKF9yLCByZWplY3QpID0+IHJlamVjdChuZXcgRXJyb3IoKSkpKTtcblx0XHR9KSk7XG5cblx0XHRkcy5hZGQoZW1pdHRlci5ldmVudChlID0+IHtcblx0XHRcdGdsb2JhbFN0YXRlICs9IDE7XG5cdFx0XHRlLndhaXRVbnRpbCh0aW1lb3V0KDEwKSk7XG5cdFx0XHRlLndhaXRVbnRpbCh0aW1lb3V0KDIwKS50aGVuKCgpID0+IGdsb2JhbFN0YXRlKyspKTsgLy8gbXVsdGlwbGUgYHdhaXRVbnRpbGAgYXJlIHN1cHBvcnRlZCBhbmQgYXdhaXRlZCBvblxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IGVtaXR0ZXIuZmlyZUFzeW5jKHsgZm9vOiB0cnVlIH0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpLnRoZW4oKCkgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2JhbFN0YXRlLCAzKTtcblx0XHR9KS5jYXRjaChlID0+IHtcblx0XHRcdGNvbnNvbGUubG9nKGUpO1xuXHRcdFx0YXNzZXJ0Lm9rKGZhbHNlKTtcblx0XHR9KTtcblxuXHRcdHNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIob3JpZ0Vycm9ySGFuZGxlcik7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdQYXVzYWJsZUVtaXR0ZXInLCBmdW5jdGlvbiAoKSB7XG5cblx0Y29uc3QgZHMgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdiYXNpYycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBkYXRhOiBudW1iZXJbXSA9IFtdO1xuXHRcdGNvbnN0IGVtaXR0ZXIgPSBkcy5hZGQobmV3IFBhdXNlYWJsZUVtaXR0ZXI8bnVtYmVyPigpKTtcblxuXHRcdGRzLmFkZChlbWl0dGVyLmV2ZW50KGUgPT4gZGF0YS5wdXNoKGUpKSk7XG5cdFx0ZW1pdHRlci5maXJlKDEpO1xuXHRcdGVtaXR0ZXIuZmlyZSgyKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZGF0YSwgWzEsIDJdKTtcblx0fSk7XG5cblx0dGVzdCgncGF1c2UvcmVzdW1lIC0gbm8gbWVyZ2UnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZGF0YTogbnVtYmVyW10gPSBbXTtcblx0XHRjb25zdCBlbWl0dGVyID0gZHMuYWRkKG5ldyBQYXVzZWFibGVFbWl0dGVyPG51bWJlcj4oKSk7XG5cblx0XHRkcy5hZGQoZW1pdHRlci5ldmVudChlID0+IGRhdGEucHVzaChlKSkpO1xuXHRcdGVtaXR0ZXIuZmlyZSgxKTtcblx0XHRlbWl0dGVyLmZpcmUoMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChkYXRhLCBbMSwgMl0pO1xuXG5cdFx0ZW1pdHRlci5wYXVzZSgpO1xuXHRcdGVtaXR0ZXIuZmlyZSgzKTtcblx0XHRlbWl0dGVyLmZpcmUoNCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChkYXRhLCBbMSwgMl0pO1xuXG5cdFx0ZW1pdHRlci5yZXN1bWUoKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGRhdGEsIFsxLCAyLCAzLCA0XSk7XG5cdFx0ZW1pdHRlci5maXJlKDUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZGF0YSwgWzEsIDIsIDMsIDQsIDVdKTtcblx0fSk7XG5cblx0dGVzdCgncGF1c2UvcmVzdW1lIC0gbWVyZ2UnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZGF0YTogbnVtYmVyW10gPSBbXTtcblx0XHRjb25zdCBlbWl0dGVyID0gZHMuYWRkKG5ldyBQYXVzZWFibGVFbWl0dGVyPG51bWJlcj4oeyBtZXJnZTogKGEpID0+IGEucmVkdWNlKChwLCBjKSA9PiBwICsgYywgMCkgfSkpO1xuXG5cdFx0ZHMuYWRkKGVtaXR0ZXIuZXZlbnQoZSA9PiBkYXRhLnB1c2goZSkpKTtcblx0XHRlbWl0dGVyLmZpcmUoMSk7XG5cdFx0ZW1pdHRlci5maXJlKDIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZGF0YSwgWzEsIDJdKTtcblxuXHRcdGVtaXR0ZXIucGF1c2UoKTtcblx0XHRlbWl0dGVyLmZpcmUoMyk7XG5cdFx0ZW1pdHRlci5maXJlKDQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZGF0YSwgWzEsIDJdKTtcblxuXHRcdGVtaXR0ZXIucmVzdW1lKCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChkYXRhLCBbMSwgMiwgN10pO1xuXG5cdFx0ZW1pdHRlci5maXJlKDUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZGF0YSwgWzEsIDIsIDcsIDVdKTtcblx0fSk7XG5cblx0dGVzdCgnZG91YmxlIHBhdXNlL3Jlc3VtZScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBkYXRhOiBudW1iZXJbXSA9IFtdO1xuXHRcdGNvbnN0IGVtaXR0ZXIgPSBkcy5hZGQobmV3IFBhdXNlYWJsZUVtaXR0ZXI8bnVtYmVyPigpKTtcblxuXHRcdGRzLmFkZChlbWl0dGVyLmV2ZW50KGUgPT4gZGF0YS5wdXNoKGUpKSk7XG5cdFx0ZW1pdHRlci5maXJlKDEpO1xuXHRcdGVtaXR0ZXIuZmlyZSgyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGRhdGEsIFsxLCAyXSk7XG5cblx0XHRlbWl0dGVyLnBhdXNlKCk7XG5cdFx0ZW1pdHRlci5wYXVzZSgpO1xuXHRcdGVtaXR0ZXIuZmlyZSgzKTtcblx0XHRlbWl0dGVyLmZpcmUoNCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChkYXRhLCBbMSwgMl0pO1xuXG5cdFx0ZW1pdHRlci5yZXN1bWUoKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGRhdGEsIFsxLCAyXSk7XG5cblx0XHRlbWl0dGVyLnJlc3VtZSgpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZGF0YSwgWzEsIDIsIDMsIDRdKTtcblxuXHRcdGVtaXR0ZXIucmVzdW1lKCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChkYXRhLCBbMSwgMiwgMywgNF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXN1bWUsIG5vIHBhdXNlJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGRhdGE6IG51bWJlcltdID0gW107XG5cdFx0Y29uc3QgZW1pdHRlciA9IGRzLmFkZChuZXcgUGF1c2VhYmxlRW1pdHRlcjxudW1iZXI+KCkpO1xuXG5cdFx0ZHMuYWRkKGVtaXR0ZXIuZXZlbnQoZSA9PiBkYXRhLnB1c2goZSkpKTtcblx0XHRlbWl0dGVyLmZpcmUoMSk7XG5cdFx0ZW1pdHRlci5maXJlKDIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZGF0YSwgWzEsIDJdKTtcblxuXHRcdGVtaXR0ZXIucmVzdW1lKCk7XG5cdFx0ZW1pdHRlci5maXJlKDMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZGF0YSwgWzEsIDIsIDNdKTtcblx0fSk7XG5cblx0dGVzdCgnbmVzdGVkIHBhdXNlJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGRhdGE6IG51bWJlcltdID0gW107XG5cdFx0Y29uc3QgZW1pdHRlciA9IGRzLmFkZChuZXcgUGF1c2VhYmxlRW1pdHRlcjxudW1iZXI+KCkpO1xuXG5cdFx0bGV0IG9uY2UgPSB0cnVlO1xuXHRcdGRzLmFkZChlbWl0dGVyLmV2ZW50KGUgPT4ge1xuXHRcdFx0ZGF0YS5wdXNoKGUpO1xuXG5cdFx0XHRpZiAob25jZSkge1xuXHRcdFx0XHRlbWl0dGVyLnBhdXNlKCk7XG5cdFx0XHRcdG9uY2UgPSBmYWxzZTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0ZHMuYWRkKGVtaXR0ZXIuZXZlbnQoZSA9PiB7XG5cdFx0XHRkYXRhLnB1c2goZSk7XG5cdFx0fSkpO1xuXG5cdFx0ZW1pdHRlci5wYXVzZSgpO1xuXHRcdGVtaXR0ZXIuZmlyZSgxKTtcblx0XHRlbWl0dGVyLmZpcmUoMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChkYXRhLCBbXSk7XG5cblx0XHRlbWl0dGVyLnJlc3VtZSgpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZGF0YSwgWzEsIDFdKTsgLy8gcGF1c2VkIGFmdGVyIGZpcnN0IGV2ZW50XG5cblx0XHRlbWl0dGVyLnJlc3VtZSgpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZGF0YSwgWzEsIDEsIDIsIDJdKTsgLy8gcmVtYWluZyBldmVudCBkZWxpdmVyZWRcblxuXHRcdGVtaXR0ZXIuZmlyZSgzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGRhdGEsIFsxLCAxLCAyLCAyLCAzLCAzXSk7XG5cblx0fSk7XG5cblx0dGVzdCgnZW1wdHkgcGF1c2Ugd2l0aCBtZXJnZScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBkYXRhOiBudW1iZXJbXSA9IFtdO1xuXHRcdGNvbnN0IGVtaXR0ZXIgPSBkcy5hZGQobmV3IFBhdXNlYWJsZUVtaXR0ZXI8bnVtYmVyPih7IG1lcmdlOiBhID0+IGFbMF0gfSkpO1xuXHRcdGRzLmFkZChlbWl0dGVyLmV2ZW50KGUgPT4gZGF0YS5wdXNoKDEpKSk7XG5cblx0XHRlbWl0dGVyLnBhdXNlKCk7XG5cdFx0ZW1pdHRlci5yZXN1bWUoKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGRhdGEsIFtdKTtcblx0fSk7XG5cbn0pO1xuXG5zdWl0ZSgnRXZlbnQgdXRpbHMgLSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUnLCBmdW5jdGlvbiAoKSB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2Zyb21PYnNlcnZhYmxlJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3Qgb2JzID0gb2JzZXJ2YWJsZVZhbHVlKCd0ZXN0JywgMTIpO1xuXHRcdGNvbnN0IGV2ZW50ID0gRXZlbnQuZnJvbU9ic2VydmFibGUob2JzKTtcblxuXHRcdGNvbnN0IHZhbHVlczogbnVtYmVyW10gPSBbXTtcblx0XHRjb25zdCBkID0gZXZlbnQobiA9PiB7IHZhbHVlcy5wdXNoKG4pOyB9KTtcblxuXHRcdG9icy5zZXQoMywgdW5kZWZpbmVkKTtcblx0XHRvYnMuc2V0KDEzLCB1bmRlZmluZWQpO1xuXHRcdG9icy5zZXQoMywgdW5kZWZpbmVkKTtcblx0XHRvYnMuc2V0KDMzLCB1bmRlZmluZWQpO1xuXHRcdG9icy5zZXQoMSwgdW5kZWZpbmVkKTtcblxuXHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdG9icy5zZXQoMzM0LCB0eCk7XG5cdFx0XHRvYnMuc2V0KDk5LCB0eCk7XG5cdFx0fSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZhbHVlcywgKFszLCAxMywgMywgMzMsIDEsIDk5XSkpO1xuXHRcdGQuZGlzcG9zZSgpO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgnRXZlbnQgdXRpbHMnLCAoKSA9PiB7XG5cblx0Y29uc3QgZHMgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRzdWl0ZSgnRXZlbnRCdWZmZXJlcicsICgpID0+IHtcblxuXHRcdHRlc3QoJ3Nob3VsZCBub3QgYnVmZmVyIHdoZW4gbm90IHdyYXBwZWQnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBidWZmZXJlciA9IG5ldyBFdmVudEJ1ZmZlcmVyKCk7XG5cdFx0XHRjb25zdCBjb3VudGVyID0gbmV3IFNhbXBsZXMuRXZlbnRDb3VudGVyKCk7XG5cdFx0XHRjb25zdCBlbWl0dGVyID0gZHMuYWRkKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBidWZmZXJlci53cmFwRXZlbnQoZW1pdHRlci5ldmVudCk7XG5cdFx0XHRjb25zdCBsaXN0ZW5lciA9IGV2ZW50KGNvdW50ZXIub25FdmVudCwgY291bnRlcik7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudGVyLmNvdW50LCAwKTtcblx0XHRcdGVtaXR0ZXIuZmlyZSgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50ZXIuY291bnQsIDEpO1xuXHRcdFx0ZW1pdHRlci5maXJlKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnRlci5jb3VudCwgMik7XG5cdFx0XHRlbWl0dGVyLmZpcmUoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudGVyLmNvdW50LCAzKTtcblxuXHRcdFx0bGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGJ1ZmZlciB3aGVuIHdyYXBwZWQnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBidWZmZXJlciA9IG5ldyBFdmVudEJ1ZmZlcmVyKCk7XG5cdFx0XHRjb25zdCBjb3VudGVyID0gbmV3IFNhbXBsZXMuRXZlbnRDb3VudGVyKCk7XG5cdFx0XHRjb25zdCBlbWl0dGVyID0gZHMuYWRkKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBidWZmZXJlci53cmFwRXZlbnQoZW1pdHRlci5ldmVudCk7XG5cdFx0XHRjb25zdCBsaXN0ZW5lciA9IGV2ZW50KGNvdW50ZXIub25FdmVudCwgY291bnRlcik7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudGVyLmNvdW50LCAwKTtcblx0XHRcdGVtaXR0ZXIuZmlyZSgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50ZXIuY291bnQsIDEpO1xuXG5cdFx0XHRidWZmZXJlci5idWZmZXJFdmVudHMoKCkgPT4ge1xuXHRcdFx0XHRlbWl0dGVyLmZpcmUoKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50ZXIuY291bnQsIDEpO1xuXHRcdFx0XHRlbWl0dGVyLmZpcmUoKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50ZXIuY291bnQsIDEpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudGVyLmNvdW50LCAzKTtcblx0XHRcdGVtaXR0ZXIuZmlyZSgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50ZXIuY291bnQsIDQpO1xuXG5cdFx0XHRsaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdvbmNlJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZW1pdHRlciA9IGRzLmFkZChuZXcgRW1pdHRlcjx2b2lkPigpKTtcblxuXHRcdFx0bGV0IGNvdW50ZXIxID0gMCwgY291bnRlcjIgPSAwLCBjb3VudGVyMyA9IDA7XG5cblx0XHRcdGNvbnN0IGxpc3RlbmVyMSA9IGVtaXR0ZXIuZXZlbnQoKCkgPT4gY291bnRlcjErKyk7XG5cdFx0XHRjb25zdCBsaXN0ZW5lcjIgPSBFdmVudC5vbmNlKGVtaXR0ZXIuZXZlbnQpKCgpID0+IGNvdW50ZXIyKyspO1xuXHRcdFx0Y29uc3QgbGlzdGVuZXIzID0gRXZlbnQub25jZShlbWl0dGVyLmV2ZW50KSgoKSA9PiBjb3VudGVyMysrKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50ZXIxLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudGVyMiwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnRlcjMsIDApO1xuXG5cdFx0XHRsaXN0ZW5lcjMuZGlzcG9zZSgpO1xuXHRcdFx0ZW1pdHRlci5maXJlKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnRlcjEsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50ZXIyLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudGVyMywgMCk7XG5cblx0XHRcdGVtaXR0ZXIuZmlyZSgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50ZXIxLCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudGVyMiwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnRlcjMsIDApO1xuXG5cdFx0XHRsaXN0ZW5lcjEuZGlzcG9zZSgpO1xuXHRcdFx0bGlzdGVuZXIyLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ2J1ZmZlcicsICgpID0+IHtcblxuXHRcdHRlc3QoJ3Nob3VsZCBidWZmZXIgZXZlbnRzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBudW1iZXJbXSA9IFtdO1xuXHRcdFx0Y29uc3QgZW1pdHRlciA9IGRzLmFkZChuZXcgRW1pdHRlcjxudW1iZXI+KCkpO1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBlbWl0dGVyLmV2ZW50O1xuXHRcdFx0Y29uc3QgYnVmZmVyZWRFdmVudCA9IEV2ZW50LmJ1ZmZlcihldmVudCk7XG5cblx0XHRcdGVtaXR0ZXIuZmlyZSgxKTtcblx0XHRcdGVtaXR0ZXIuZmlyZSgyKTtcblx0XHRcdGVtaXR0ZXIuZmlyZSgzKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LCBbXSBhcyBudW1iZXJbXSk7XG5cblx0XHRcdGNvbnN0IGxpc3RlbmVyID0gYnVmZmVyZWRFdmVudChudW0gPT4gcmVzdWx0LnB1c2gobnVtKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgWzEsIDIsIDNdKTtcblxuXHRcdFx0ZW1pdHRlci5maXJlKDQpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQsIFsxLCAyLCAzLCA0XSk7XG5cblx0XHRcdGxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdGVtaXR0ZXIuZmlyZSg1KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LCBbMSwgMiwgMywgNF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGJ1ZmZlciBldmVudHMgb24gbmV4dCB0aWNrJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBudW1iZXJbXSA9IFtdO1xuXHRcdFx0Y29uc3QgZW1pdHRlciA9IGRzLmFkZChuZXcgRW1pdHRlcjxudW1iZXI+KCkpO1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBlbWl0dGVyLmV2ZW50O1xuXHRcdFx0Y29uc3QgYnVmZmVyZWRFdmVudCA9IEV2ZW50LmJ1ZmZlcihldmVudCwgdHJ1ZSk7XG5cblx0XHRcdGVtaXR0ZXIuZmlyZSgxKTtcblx0XHRcdGVtaXR0ZXIuZmlyZSgyKTtcblx0XHRcdGVtaXR0ZXIuZmlyZSgzKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LCBbXSBhcyBudW1iZXJbXSk7XG5cblx0XHRcdGNvbnN0IGxpc3RlbmVyID0gYnVmZmVyZWRFdmVudChudW0gPT4gcmVzdWx0LnB1c2gobnVtKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgW10pO1xuXG5cdFx0XHRhd2FpdCB0aW1lb3V0KDEwKTtcblx0XHRcdGVtaXR0ZXIuZmlyZSg0KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LCBbMSwgMiwgMywgNF0pO1xuXHRcdFx0bGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0ZW1pdHRlci5maXJlKDUpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQsIFsxLCAyLCAzLCA0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgZmlyZSBpbml0aWFsIGJ1ZmZlciBldmVudHMnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCByZXN1bHQ6IG51bWJlcltdID0gW107XG5cdFx0XHRjb25zdCBlbWl0dGVyID0gZHMuYWRkKG5ldyBFbWl0dGVyPG51bWJlcj4oKSk7XG5cdFx0XHRjb25zdCBldmVudCA9IGVtaXR0ZXIuZXZlbnQ7XG5cdFx0XHRjb25zdCBidWZmZXJlZEV2ZW50ID0gRXZlbnQuYnVmZmVyKGV2ZW50LCBmYWxzZSwgWy0yLCAtMSwgMF0pO1xuXG5cdFx0XHRlbWl0dGVyLmZpcmUoMSk7XG5cdFx0XHRlbWl0dGVyLmZpcmUoMik7XG5cdFx0XHRlbWl0dGVyLmZpcmUoMyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgW10gYXMgbnVtYmVyW10pO1xuXG5cdFx0XHRkcy5hZGQoYnVmZmVyZWRFdmVudChudW0gPT4gcmVzdWx0LnB1c2gobnVtKSkpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQsIFstMiwgLTEsIDAsIDEsIDIsIDNdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ0V2ZW50TXVsdGlwbGV4ZXInLCAoKSA9PiB7XG5cblx0XHR0ZXN0KCd3b3JrcycsICgpID0+IHtcblx0XHRcdGNvbnN0IHJlc3VsdDogbnVtYmVyW10gPSBbXTtcblx0XHRcdGNvbnN0IG0gPSBuZXcgRXZlbnRNdWx0aXBsZXhlcjxudW1iZXI+KCk7XG5cdFx0XHRkcy5hZGQobS5ldmVudChyID0+IHJlc3VsdC5wdXNoKHIpKSk7XG5cblx0XHRcdGNvbnN0IGUxID0gZHMuYWRkKG5ldyBFbWl0dGVyPG51bWJlcj4oKSk7XG5cdFx0XHRkcy5hZGQobS5hZGQoZTEuZXZlbnQpKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQsIFtdKTtcblxuXHRcdFx0ZTEuZmlyZSgwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LCBbMF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnbXVsdGlwbGV4ZXIgZGlzcG9zZSB3b3JrcycsICgpID0+IHtcblx0XHRcdGNvbnN0IHJlc3VsdDogbnVtYmVyW10gPSBbXTtcblx0XHRcdGNvbnN0IG0gPSBuZXcgRXZlbnRNdWx0aXBsZXhlcjxudW1iZXI+KCk7XG5cdFx0XHRkcy5hZGQobS5ldmVudChyID0+IHJlc3VsdC5wdXNoKHIpKSk7XG5cblx0XHRcdGNvbnN0IGUxID0gZHMuYWRkKG5ldyBFbWl0dGVyPG51bWJlcj4oKSk7XG5cdFx0XHRkcy5hZGQobS5hZGQoZTEuZXZlbnQpKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQsIFtdKTtcblxuXHRcdFx0ZTEuZmlyZSgwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LCBbMF0pO1xuXG5cdFx0XHRtLmRpc3Bvc2UoKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LCBbMF0pO1xuXG5cdFx0XHRlMS5maXJlKDApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQsIFswXSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdldmVudCBkaXNwb3NlIHdvcmtzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBudW1iZXJbXSA9IFtdO1xuXHRcdFx0Y29uc3QgbSA9IG5ldyBFdmVudE11bHRpcGxleGVyPG51bWJlcj4oKTtcblx0XHRcdGRzLmFkZChtLmV2ZW50KHIgPT4gcmVzdWx0LnB1c2gocikpKTtcblxuXHRcdFx0Y29uc3QgZTEgPSBkcy5hZGQobmV3IEVtaXR0ZXI8bnVtYmVyPigpKTtcblx0XHRcdGRzLmFkZChtLmFkZChlMS5ldmVudCkpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgW10pO1xuXG5cdFx0XHRlMS5maXJlKDApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQsIFswXSk7XG5cblx0XHRcdGUxLmRpc3Bvc2UoKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LCBbMF0pO1xuXG5cdFx0XHRlMS5maXJlKDApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQsIFswXSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdtdXRsaXBsZXhlciBldmVudCBkaXNwb3NlIHdvcmtzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBudW1iZXJbXSA9IFtdO1xuXHRcdFx0Y29uc3QgbSA9IG5ldyBFdmVudE11bHRpcGxleGVyPG51bWJlcj4oKTtcblx0XHRcdGRzLmFkZChtLmV2ZW50KHIgPT4gcmVzdWx0LnB1c2gocikpKTtcblxuXHRcdFx0Y29uc3QgZTEgPSBkcy5hZGQobmV3IEVtaXR0ZXI8bnVtYmVyPigpKTtcblx0XHRcdGNvbnN0IGwxID0gbS5hZGQoZTEuZXZlbnQpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgW10pO1xuXG5cdFx0XHRlMS5maXJlKDApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQsIFswXSk7XG5cblx0XHRcdGwxLmRpc3Bvc2UoKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LCBbMF0pO1xuXG5cdFx0XHRlMS5maXJlKDApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQsIFswXSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdob3Qgc3RhcnQgd29ya3MnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCByZXN1bHQ6IG51bWJlcltdID0gW107XG5cdFx0XHRjb25zdCBtID0gbmV3IEV2ZW50TXVsdGlwbGV4ZXI8bnVtYmVyPigpO1xuXHRcdFx0ZHMuYWRkKG0uZXZlbnQociA9PiByZXN1bHQucHVzaChyKSkpO1xuXG5cdFx0XHRjb25zdCBlMSA9IGRzLmFkZChuZXcgRW1pdHRlcjxudW1iZXI+KCkpO1xuXHRcdFx0ZHMuYWRkKG0uYWRkKGUxLmV2ZW50KSk7XG5cdFx0XHRjb25zdCBlMiA9IGRzLmFkZChuZXcgRW1pdHRlcjxudW1iZXI+KCkpO1xuXHRcdFx0ZHMuYWRkKG0uYWRkKGUyLmV2ZW50KSk7XG5cdFx0XHRjb25zdCBlMyA9IGRzLmFkZChuZXcgRW1pdHRlcjxudW1iZXI+KCkpO1xuXHRcdFx0ZHMuYWRkKG0uYWRkKGUzLmV2ZW50KSk7XG5cblx0XHRcdGUxLmZpcmUoMSk7XG5cdFx0XHRlMi5maXJlKDIpO1xuXHRcdFx0ZTMuZmlyZSgzKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LCBbMSwgMiwgM10pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnY29sZCBzdGFydCB3b3JrcycsICgpID0+IHtcblx0XHRcdGNvbnN0IHJlc3VsdDogbnVtYmVyW10gPSBbXTtcblx0XHRcdGNvbnN0IG0gPSBuZXcgRXZlbnRNdWx0aXBsZXhlcjxudW1iZXI+KCk7XG5cblx0XHRcdGNvbnN0IGUxID0gZHMuYWRkKG5ldyBFbWl0dGVyPG51bWJlcj4oKSk7XG5cdFx0XHRkcy5hZGQobS5hZGQoZTEuZXZlbnQpKTtcblx0XHRcdGNvbnN0IGUyID0gZHMuYWRkKG5ldyBFbWl0dGVyPG51bWJlcj4oKSk7XG5cdFx0XHRkcy5hZGQobS5hZGQoZTIuZXZlbnQpKTtcblx0XHRcdGNvbnN0IGUzID0gZHMuYWRkKG5ldyBFbWl0dGVyPG51bWJlcj4oKSk7XG5cdFx0XHRkcy5hZGQobS5hZGQoZTMuZXZlbnQpKTtcblxuXHRcdFx0ZHMuYWRkKG0uZXZlbnQociA9PiByZXN1bHQucHVzaChyKSkpO1xuXG5cdFx0XHRlMS5maXJlKDEpO1xuXHRcdFx0ZTIuZmlyZSgyKTtcblx0XHRcdGUzLmZpcmUoMyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgWzEsIDIsIDNdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2xhdGUgYWRkIHdvcmtzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBudW1iZXJbXSA9IFtdO1xuXHRcdFx0Y29uc3QgbSA9IG5ldyBFdmVudE11bHRpcGxleGVyPG51bWJlcj4oKTtcblxuXHRcdFx0Y29uc3QgZTEgPSBkcy5hZGQobmV3IEVtaXR0ZXI8bnVtYmVyPigpKTtcblx0XHRcdGRzLmFkZChtLmFkZChlMS5ldmVudCkpO1xuXHRcdFx0Y29uc3QgZTIgPSBkcy5hZGQobmV3IEVtaXR0ZXI8bnVtYmVyPigpKTtcblx0XHRcdGRzLmFkZChtLmFkZChlMi5ldmVudCkpO1xuXG5cdFx0XHRkcy5hZGQobS5ldmVudChyID0+IHJlc3VsdC5wdXNoKHIpKSk7XG5cblx0XHRcdGUxLmZpcmUoMSk7XG5cdFx0XHRlMi5maXJlKDIpO1xuXG5cdFx0XHRjb25zdCBlMyA9IGRzLmFkZChuZXcgRW1pdHRlcjxudW1iZXI+KCkpO1xuXHRcdFx0ZHMuYWRkKG0uYWRkKGUzLmV2ZW50KSk7XG5cdFx0XHRlMy5maXJlKDMpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgWzEsIDIsIDNdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2FkZCBkaXNwb3NlIHdvcmtzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBudW1iZXJbXSA9IFtdO1xuXHRcdFx0Y29uc3QgbSA9IG5ldyBFdmVudE11bHRpcGxleGVyPG51bWJlcj4oKTtcblxuXHRcdFx0Y29uc3QgZTEgPSBkcy5hZGQobmV3IEVtaXR0ZXI8bnVtYmVyPigpKTtcblx0XHRcdGRzLmFkZChtLmFkZChlMS5ldmVudCkpO1xuXHRcdFx0Y29uc3QgZTIgPSBkcy5hZGQobmV3IEVtaXR0ZXI8bnVtYmVyPigpKTtcblx0XHRcdGRzLmFkZChtLmFkZChlMi5ldmVudCkpO1xuXG5cdFx0XHRkcy5hZGQobS5ldmVudChyID0+IHJlc3VsdC5wdXNoKHIpKSk7XG5cblx0XHRcdGUxLmZpcmUoMSk7XG5cdFx0XHRlMi5maXJlKDIpO1xuXG5cdFx0XHRjb25zdCBlMyA9IGRzLmFkZChuZXcgRW1pdHRlcjxudW1iZXI+KCkpO1xuXHRcdFx0Y29uc3QgbDMgPSBtLmFkZChlMy5ldmVudCk7XG5cdFx0XHRlMy5maXJlKDMpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQsIFsxLCAyLCAzXSk7XG5cblx0XHRcdGwzLmRpc3Bvc2UoKTtcblx0XHRcdGUzLmZpcmUoNCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgWzEsIDIsIDNdKTtcblxuXHRcdFx0ZTIuZmlyZSg0KTtcblx0XHRcdGUxLmZpcmUoNSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgWzEsIDIsIDMsIDQsIDVdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ0R5bmFtaWNMaXN0RXZlbnRNdWx0aXBsZXhlcicsICgpID0+IHtcblx0XHRsZXQgYWRkRW1pdHRlcjogRW1pdHRlcjxUZXN0SXRlbT47XG5cdFx0bGV0IHJlbW92ZUVtaXR0ZXI6IEVtaXR0ZXI8VGVzdEl0ZW0+O1xuXHRcdGNvbnN0IHJlY29yZGVkRXZlbnRzOiBudW1iZXJbXSA9IFtdO1xuXHRcdGNsYXNzIFRlc3RJdGVtIHtcblx0XHRcdHJlYWRvbmx5IG9uVGVzdEV2ZW50RW1pdHRlciA9IGRzLmFkZChuZXcgRW1pdHRlcjxudW1iZXI+KCkpO1xuXHRcdFx0cmVhZG9ubHkgb25UZXN0RXZlbnQgPSB0aGlzLm9uVGVzdEV2ZW50RW1pdHRlci5ldmVudDtcblx0XHR9XG5cdFx0bGV0IGl0ZW1zOiBUZXN0SXRlbVtdO1xuXHRcdGxldCBtOiBEeW5hbWljTGlzdEV2ZW50TXVsdGlwbGV4ZXI8VGVzdEl0ZW0sIG51bWJlcj47XG5cdFx0c2V0dXAoKCkgPT4ge1xuXHRcdFx0YWRkRW1pdHRlciA9IGRzLmFkZChuZXcgRW1pdHRlcjxUZXN0SXRlbT4oKSk7XG5cdFx0XHRyZW1vdmVFbWl0dGVyID0gZHMuYWRkKG5ldyBFbWl0dGVyPFRlc3RJdGVtPigpKTtcblx0XHRcdGl0ZW1zID0gW25ldyBUZXN0SXRlbSgpLCBuZXcgVGVzdEl0ZW0oKV07XG5cdFx0XHRmb3IgKGNvbnN0IFtpLCBpdGVtXSBvZiBpdGVtcy5lbnRyaWVzKCkpIHtcblx0XHRcdFx0ZHMuYWRkKGl0ZW0ub25UZXN0RXZlbnQoZSA9PiBgJHtpfToke2V9YCkpO1xuXHRcdFx0fVxuXHRcdFx0bSA9IG5ldyBEeW5hbWljTGlzdEV2ZW50TXVsdGlwbGV4ZXIoaXRlbXMsIGFkZEVtaXR0ZXIuZXZlbnQsIHJlbW92ZUVtaXR0ZXIuZXZlbnQsIGUgPT4gZS5vblRlc3RFdmVudCk7XG5cdFx0XHRkcy5hZGQobS5ldmVudChlID0+IHJlY29yZGVkRXZlbnRzLnB1c2goZSkpKTtcblx0XHRcdHJlY29yZGVkRXZlbnRzLmxlbmd0aCA9IDA7XG5cdFx0fSk7XG5cdFx0dGVhcmRvd24oKCkgPT4gbS5kaXNwb3NlKCkpO1xuXHRcdHRlc3QoJ3Nob3VsZCBmaXJlIGV2ZW50cyBmb3IgaW5pdGlhbCBpdGVtcycsICgpID0+IHtcblx0XHRcdGl0ZW1zWzBdLm9uVGVzdEV2ZW50RW1pdHRlci5maXJlKDEpO1xuXHRcdFx0aXRlbXNbMV0ub25UZXN0RXZlbnRFbWl0dGVyLmZpcmUoMik7XG5cdFx0XHRpdGVtc1swXS5vblRlc3RFdmVudEVtaXR0ZXIuZmlyZSgzKTtcblx0XHRcdGl0ZW1zWzFdLm9uVGVzdEV2ZW50RW1pdHRlci5maXJlKDQpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWNvcmRlZEV2ZW50cywgWzEsIDIsIDMsIDRdKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgZmlyZSBldmVudHMgZm9yIGFkZGVkIGl0ZW1zJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgYWRkZWRJdGVtID0gbmV3IFRlc3RJdGVtKCk7XG5cdFx0XHRhZGRFbWl0dGVyLmZpcmUoYWRkZWRJdGVtKTtcblx0XHRcdGFkZGVkSXRlbS5vblRlc3RFdmVudEVtaXR0ZXIuZmlyZSgxKTtcblx0XHRcdGl0ZW1zWzBdLm9uVGVzdEV2ZW50RW1pdHRlci5maXJlKDIpO1xuXHRcdFx0aXRlbXNbMV0ub25UZXN0RXZlbnRFbWl0dGVyLmZpcmUoMyk7XG5cdFx0XHRhZGRlZEl0ZW0ub25UZXN0RXZlbnRFbWl0dGVyLmZpcmUoNCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlY29yZGVkRXZlbnRzLCBbMSwgMiwgMywgNF0pO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCBub3QgZmlyZSBldmVudHMgZm9yIHJlbW92ZWQgaXRlbXMnLCAoKSA9PiB7XG5cdFx0XHRyZW1vdmVFbWl0dGVyLmZpcmUoaXRlbXNbMF0pO1xuXHRcdFx0aXRlbXNbMF0ub25UZXN0RXZlbnRFbWl0dGVyLmZpcmUoMSk7XG5cdFx0XHRpdGVtc1sxXS5vblRlc3RFdmVudEVtaXR0ZXIuZmlyZSgyKTtcblx0XHRcdGl0ZW1zWzBdLm9uVGVzdEV2ZW50RW1pdHRlci5maXJlKDMpO1xuXHRcdFx0aXRlbXNbMV0ub25UZXN0RXZlbnRFbWl0dGVyLmZpcmUoNCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlY29yZGVkRXZlbnRzLCBbMiwgNF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdsYXRjaCcsICgpID0+IHtcblx0XHRjb25zdCBlbWl0dGVyID0gZHMuYWRkKG5ldyBFbWl0dGVyPG51bWJlcj4oKSk7XG5cdFx0Y29uc3QgZXZlbnQgPSBFdmVudC5sYXRjaChlbWl0dGVyLmV2ZW50KTtcblxuXHRcdGNvbnN0IHJlc3VsdDogbnVtYmVyW10gPSBbXTtcblx0XHRjb25zdCBsaXN0ZW5lciA9IGRzLmFkZChldmVudChudW0gPT4gcmVzdWx0LnB1c2gobnVtKSkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQsIFtdKTtcblxuXHRcdGVtaXR0ZXIuZmlyZSgxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgWzFdKTtcblxuXHRcdGVtaXR0ZXIuZmlyZSgyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgWzEsIDJdKTtcblxuXHRcdGVtaXR0ZXIuZmlyZSgyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgWzEsIDJdKTtcblxuXHRcdGVtaXR0ZXIuZmlyZSgxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgWzEsIDIsIDFdKTtcblxuXHRcdGVtaXR0ZXIuZmlyZSgxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgWzEsIDIsIDFdKTtcblxuXHRcdGVtaXR0ZXIuZmlyZSgzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgWzEsIDIsIDEsIDNdKTtcblxuXHRcdGVtaXR0ZXIuZmlyZSgzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgWzEsIDIsIDEsIDNdKTtcblxuXHRcdGVtaXR0ZXIuZmlyZSgzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgWzEsIDIsIDEsIDNdKTtcblxuXHRcdGxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnZGlzcG9zZSBpcyByZWVudHJhbnQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZW1pdHRlciA9IGRzLmFkZChuZXcgRW1pdHRlcjxudW1iZXI+KHtcblx0XHRcdG9uRGlkUmVtb3ZlTGFzdExpc3RlbmVyOiAoKSA9PiB7XG5cdFx0XHRcdGVtaXR0ZXIuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGxpc3RlbmVyID0gZW1pdHRlci5ldmVudCgoKSA9PiB1bmRlZmluZWQpO1xuXHRcdGxpc3RlbmVyLmRpc3Bvc2UoKTsgLy8gc2hvdWxkIG5vdCBjcmFzaFxuXHR9KTtcblxuXHRzdWl0ZSgnZnJvbVByb21pc2UnLCAoKSA9PiB7XG5cblx0XHR0ZXN0KCdub3QgeWV0IHJlc29sdmVkJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdFx0XHRsZXQgcHJvbWlzZSA9IG5ldyBEZWZlcnJlZFByb21pc2U8bnVtYmVyPigpO1xuXG5cdFx0XHRcdGRzLmFkZChFdmVudC5mcm9tUHJvbWlzZShwcm9taXNlLnApKGUgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlLCAxKTtcblxuXHRcdFx0XHRcdHByb21pc2UgPSBuZXcgRGVmZXJyZWRQcm9taXNlKCk7XG5cblx0XHRcdFx0XHRkcy5hZGQoRXZlbnQuZnJvbVByb21pc2UocHJvbWlzZS5wKSgoKSA9PiB7XG5cdFx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdFx0cHJvbWlzZS5lcnJvcih1bmRlZmluZWQpO1xuXHRcdFx0XHR9KSk7XG5cblx0XHRcdFx0cHJvbWlzZS5jb21wbGV0ZSgxKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnYWxyZWFkeSByZXNvbHZlZCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRcdFx0bGV0IHByb21pc2UgPSBuZXcgRGVmZXJyZWRQcm9taXNlPG51bWJlcj4oKTtcblx0XHRcdFx0cHJvbWlzZS5jb21wbGV0ZSgxKTtcblxuXHRcdFx0XHRkcy5hZGQoRXZlbnQuZnJvbVByb21pc2UocHJvbWlzZS5wKShlID0+IHtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZSwgMSk7XG5cblx0XHRcdFx0XHRwcm9taXNlID0gbmV3IERlZmVycmVkUHJvbWlzZSgpO1xuXHRcdFx0XHRcdHByb21pc2UuZXJyb3IodW5kZWZpbmVkKTtcblxuXHRcdFx0XHRcdGRzLmFkZChFdmVudC5mcm9tUHJvbWlzZShwcm9taXNlLnApKCgpID0+IHtcblx0XHRcdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdH0pKTtcblxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdSZWxheScsICgpID0+IHtcblx0XHR0ZXN0KCdzaG91bGQgaW5wdXQgd29yaycsICgpID0+IHtcblx0XHRcdGNvbnN0IGUxID0gZHMuYWRkKG5ldyBFbWl0dGVyPG51bWJlcj4oKSk7XG5cdFx0XHRjb25zdCBlMiA9IGRzLmFkZChuZXcgRW1pdHRlcjxudW1iZXI+KCkpO1xuXHRcdFx0Y29uc3QgcmVsYXkgPSBuZXcgUmVsYXk8bnVtYmVyPigpO1xuXG5cdFx0XHRjb25zdCByZXN1bHQ6IG51bWJlcltdID0gW107XG5cdFx0XHRjb25zdCBsaXN0ZW5lciA9IChudW06IG51bWJlcikgPT4gcmVzdWx0LnB1c2gobnVtKTtcblx0XHRcdGNvbnN0IHN1YnNjcmlwdGlvbiA9IHJlbGF5LmV2ZW50KGxpc3RlbmVyKTtcblxuXHRcdFx0ZTEuZmlyZSgxKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LCBbXSk7XG5cblx0XHRcdHJlbGF5LmlucHV0ID0gZTEuZXZlbnQ7XG5cdFx0XHRlMS5maXJlKDIpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQsIFsyXSk7XG5cblx0XHRcdHJlbGF5LmlucHV0ID0gZTIuZXZlbnQ7XG5cdFx0XHRlMS5maXJlKDMpO1xuXHRcdFx0ZTIuZmlyZSg0KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LCBbMiwgNF0pO1xuXG5cdFx0XHRzdWJzY3JpcHRpb24uZGlzcG9zZSgpO1xuXHRcdFx0ZTEuZmlyZSg1KTtcblx0XHRcdGUyLmZpcmUoNik7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdCwgWzIsIDRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBSZWxheSBkaXNwb3NlIHdvcmsnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBlMSA9IGRzLmFkZChuZXcgRW1pdHRlcjxudW1iZXI+KCkpO1xuXHRcdFx0Y29uc3QgZTIgPSBkcy5hZGQobmV3IEVtaXR0ZXI8bnVtYmVyPigpKTtcblx0XHRcdGNvbnN0IHJlbGF5ID0gbmV3IFJlbGF5PG51bWJlcj4oKTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0OiBudW1iZXJbXSA9IFtdO1xuXHRcdFx0Y29uc3QgbGlzdGVuZXIgPSAobnVtOiBudW1iZXIpID0+IHJlc3VsdC5wdXNoKG51bSk7XG5cdFx0XHRkcy5hZGQocmVsYXkuZXZlbnQobGlzdGVuZXIpKTtcblxuXHRcdFx0ZTEuZmlyZSgxKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LCBbXSk7XG5cblx0XHRcdHJlbGF5LmlucHV0ID0gZTEuZXZlbnQ7XG5cdFx0XHRlMS5maXJlKDIpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQsIFsyXSk7XG5cblx0XHRcdHJlbGF5LmlucHV0ID0gZTIuZXZlbnQ7XG5cdFx0XHRlMS5maXJlKDMpO1xuXHRcdFx0ZTIuZmlyZSg0KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LCBbMiwgNF0pO1xuXG5cdFx0XHRyZWxheS5kaXNwb3NlKCk7XG5cdFx0XHRlMS5maXJlKDUpO1xuXHRcdFx0ZTIuZmlyZSg2KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LCBbMiwgNF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnYWNjdW11bGF0ZScsICgpID0+IHtcblx0XHR0ZXN0KCdzaG91bGQgbm90IGZpcmUgYWZ0ZXIgYSBsaXN0ZW5lciBpcyBkaXNwb3NlZCB3aXRoIHVuZGVmaW5lZCBvciBbXScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGV2ZW50RW1pdHRlciA9IGRzLmFkZChuZXcgRW1pdHRlcjxudW1iZXI+KCkpO1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBldmVudEVtaXR0ZXIuZXZlbnQ7XG5cdFx0XHRjb25zdCBhY2N1bXVsYXRlZCA9IEV2ZW50LmFjY3VtdWxhdGUoZXZlbnQsIDApO1xuXG5cdFx0XHRjb25zdCBjYWxsczE6IG51bWJlcltdW10gPSBbXTtcblx0XHRcdGNvbnN0IGNhbGxzMjogbnVtYmVyW11bXSA9IFtdO1xuXHRcdFx0Y29uc3QgbGlzdGVuZXIxID0gZHMuYWRkKGFjY3VtdWxhdGVkKChlKSA9PiBjYWxsczEucHVzaChlKSkpO1xuXHRcdFx0ZHMuYWRkKGFjY3VtdWxhdGVkKChlKSA9PiBjYWxsczIucHVzaChlKSkpO1xuXG5cdFx0XHRldmVudEVtaXR0ZXIuZmlyZSgxKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzMSwgW1sxXV0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxsczIsIFtbMV1dKTtcblxuXHRcdFx0bGlzdGVuZXIxLmRpc3Bvc2UoKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzMSwgW1sxXV0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxsczIsIFtbMV1dLCAnc2hvdWxkIG5vdCBmaXJlIGFmdGVyIGEgbGlzdGVuZXIgaXMgZGlzcG9zZWQgd2l0aCB1bmRlZmluZWQgb3IgW10nKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgYWNjdW11bGF0ZSBhIHNpbmdsZSBldmVudCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGV2ZW50RW1pdHRlciA9IGRzLmFkZChuZXcgRW1pdHRlcjxudW1iZXI+KCkpO1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBldmVudEVtaXR0ZXIuZXZlbnQ7XG5cdFx0XHRjb25zdCBhY2N1bXVsYXRlZCA9IEV2ZW50LmFjY3VtdWxhdGUoZXZlbnQsIDApO1xuXG5cdFx0XHRjb25zdCByZXN1bHRzMSA9IGF3YWl0IG5ldyBQcm9taXNlPG51bWJlcltdPihyID0+IHtcblx0XHRcdFx0ZHMuYWRkKGFjY3VtdWxhdGVkKHIpKTtcblx0XHRcdFx0ZXZlbnRFbWl0dGVyLmZpcmUoMSk7XG5cdFx0XHR9KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0czEsIFsxXSk7XG5cblx0XHRcdGNvbnN0IHJlc3VsdHMyID0gYXdhaXQgbmV3IFByb21pc2U8bnVtYmVyW10+KHIgPT4ge1xuXHRcdFx0XHRkcy5hZGQoYWNjdW11bGF0ZWQocikpO1xuXHRcdFx0XHRldmVudEVtaXR0ZXIuZmlyZSgyKTtcblx0XHRcdH0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHRzMiwgWzJdKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgYWNjdW11bGF0ZSBtdWx0aXBsZSBldmVudHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBldmVudEVtaXR0ZXIgPSBkcy5hZGQobmV3IEVtaXR0ZXI8bnVtYmVyPigpKTtcblx0XHRcdGNvbnN0IGV2ZW50ID0gZXZlbnRFbWl0dGVyLmV2ZW50O1xuXHRcdFx0Y29uc3QgYWNjdW11bGF0ZWQgPSBFdmVudC5hY2N1bXVsYXRlKGV2ZW50LCAwKTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0czEgPSBhd2FpdCBuZXcgUHJvbWlzZTxudW1iZXJbXT4ociA9PiB7XG5cdFx0XHRcdGRzLmFkZChhY2N1bXVsYXRlZChyKSk7XG5cdFx0XHRcdGV2ZW50RW1pdHRlci5maXJlKDEpO1xuXHRcdFx0XHRldmVudEVtaXR0ZXIuZmlyZSgyKTtcblx0XHRcdFx0ZXZlbnRFbWl0dGVyLmZpcmUoMyk7XG5cdFx0XHR9KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0czEsIFsxLCAyLCAzXSk7XG5cblx0XHRcdGNvbnN0IHJlc3VsdHMyID0gYXdhaXQgbmV3IFByb21pc2U8bnVtYmVyW10+KHIgPT4ge1xuXHRcdFx0XHRkcy5hZGQoYWNjdW11bGF0ZWQocikpO1xuXHRcdFx0XHRldmVudEVtaXR0ZXIuZmlyZSg0KTtcblx0XHRcdFx0ZXZlbnRFbWl0dGVyLmZpcmUoNSk7XG5cdFx0XHRcdGV2ZW50RW1pdHRlci5maXJlKDYpO1xuXHRcdFx0XHRldmVudEVtaXR0ZXIuZmlyZSg3KTtcblx0XHRcdFx0ZXZlbnRFbWl0dGVyLmZpcmUoOCk7XG5cdFx0XHR9KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0czIsIFs0LCA1LCA2LCA3LCA4XSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdkZWJvdW5jZScsICgpID0+IHtcblx0XHR0ZXN0KCdzaW1wbGUnLCBmdW5jdGlvbiAoZG9uZTogKCkgPT4gdm9pZCkge1xuXHRcdFx0Y29uc3QgZG9jID0gZHMuYWRkKG5ldyBTYW1wbGVzLkRvY3VtZW50MygpKTtcblxuXHRcdFx0Y29uc3Qgb25Eb2NEaWRDaGFuZ2UgPSBFdmVudC5kZWJvdW5jZShkb2Mub25EaWRDaGFuZ2UsIChwcmV2OiBzdHJpbmdbXSB8IHVuZGVmaW5lZCwgY3VyKSA9PiB7XG5cdFx0XHRcdGlmICghcHJldikge1xuXHRcdFx0XHRcdHByZXYgPSBbY3VyXTtcblx0XHRcdFx0fSBlbHNlIGlmIChwcmV2LmluZGV4T2YoY3VyKSA8IDApIHtcblx0XHRcdFx0XHRwcmV2LnB1c2goY3VyKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcHJldjtcblx0XHRcdH0sIDEwKTtcblxuXHRcdFx0bGV0IGNvdW50ID0gMDtcblxuXHRcdFx0ZHMuYWRkKG9uRG9jRGlkQ2hhbmdlKGtleXMgPT4ge1xuXHRcdFx0XHRjb3VudCsrO1xuXHRcdFx0XHRhc3NlcnQub2soa2V5cywgJ3dhcyBub3QgZXhwZWN0aW5nIGtleXMuJyk7XG5cdFx0XHRcdGlmIChjb3VudCA9PT0gMSkge1xuXHRcdFx0XHRcdGRvYy5zZXRUZXh0KCc0Jyk7XG5cdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChrZXlzLCBbJzEnLCAnMicsICczJ10pO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGNvdW50ID09PSAyKSB7XG5cdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChrZXlzLCBbJzQnXSk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdGRvYy5zZXRUZXh0KCcxJyk7XG5cdFx0XHRkb2Muc2V0VGV4dCgnMicpO1xuXHRcdFx0ZG9jLnNldFRleHQoJzMnKTtcblx0XHR9KTtcblxuXG5cdFx0dGVzdCgnbWljcm90YXNrJywgZnVuY3Rpb24gKGRvbmU6ICgpID0+IHZvaWQpIHtcblx0XHRcdGNvbnN0IGRvYyA9IGRzLmFkZChuZXcgU2FtcGxlcy5Eb2N1bWVudDMoKSk7XG5cblx0XHRcdGNvbnN0IG9uRG9jRGlkQ2hhbmdlID0gRXZlbnQuZGVib3VuY2UoZG9jLm9uRGlkQ2hhbmdlLCAocHJldjogc3RyaW5nW10gfCB1bmRlZmluZWQsIGN1cikgPT4ge1xuXHRcdFx0XHRpZiAoIXByZXYpIHtcblx0XHRcdFx0XHRwcmV2ID0gW2N1cl07XG5cdFx0XHRcdH0gZWxzZSBpZiAocHJldi5pbmRleE9mKGN1cikgPCAwKSB7XG5cdFx0XHRcdFx0cHJldi5wdXNoKGN1cik7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHByZXY7XG5cdFx0XHR9LCBNaWNyb3Rhc2tEZWxheSk7XG5cblx0XHRcdGxldCBjb3VudCA9IDA7XG5cblx0XHRcdGRzLmFkZChvbkRvY0RpZENoYW5nZShrZXlzID0+IHtcblx0XHRcdFx0Y291bnQrKztcblx0XHRcdFx0YXNzZXJ0Lm9rKGtleXMsICd3YXMgbm90IGV4cGVjdGluZyBrZXlzLicpO1xuXHRcdFx0XHRpZiAoY291bnQgPT09IDEpIHtcblx0XHRcdFx0XHRkb2Muc2V0VGV4dCgnNCcpO1xuXHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoa2V5cywgWycxJywgJzInLCAnMyddKTtcblx0XHRcdFx0fSBlbHNlIGlmIChjb3VudCA9PT0gMikge1xuXHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoa2V5cywgWyc0J10pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHRkb2Muc2V0VGV4dCgnMScpO1xuXHRcdFx0ZG9jLnNldFRleHQoJzInKTtcblx0XHRcdGRvYy5zZXRUZXh0KCczJyk7XG5cdFx0fSk7XG5cblxuXHRcdHRlc3QoJ2xlYWRpbmcnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBlbWl0dGVyID0gZHMuYWRkKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRcdFx0Y29uc3QgZGVib3VuY2VkID0gRXZlbnQuZGVib3VuY2UoZW1pdHRlci5ldmVudCwgKGwsIGUpID0+IGUsIDAsIC8qbGVhZGluZz0qL3RydWUpO1xuXG5cdFx0XHRsZXQgY2FsbHMgPSAwO1xuXHRcdFx0ZHMuYWRkKGRlYm91bmNlZCgoKSA9PiB7XG5cdFx0XHRcdGNhbGxzKys7XG5cdFx0XHR9KSk7XG5cblx0XHRcdC8vIElmIHRoZSBzb3VyY2UgZXZlbnQgaXMgZmlyZWQgb25jZSwgdGhlIGRlYm91bmNlZCAob24gdGhlIGxlYWRpbmcgZWRnZSkgZXZlbnQgc2hvdWxkIGJlIGZpcmVkIG9ubHkgb25jZVxuXHRcdFx0ZW1pdHRlci5maXJlKCk7XG5cblx0XHRcdGF3YWl0IHRpbWVvdXQoMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbHMsIDEpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnbGVhZGluZyAoMiknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBlbWl0dGVyID0gZHMuYWRkKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRcdFx0Y29uc3QgZGVib3VuY2VkID0gRXZlbnQuZGVib3VuY2UoZW1pdHRlci5ldmVudCwgKGwsIGUpID0+IGUsIDAsIC8qbGVhZGluZz0qL3RydWUpO1xuXG5cdFx0XHRsZXQgY2FsbHMgPSAwO1xuXHRcdFx0ZHMuYWRkKGRlYm91bmNlZCgoKSA9PiB7XG5cdFx0XHRcdGNhbGxzKys7XG5cdFx0XHR9KSk7XG5cblx0XHRcdC8vIElmIHRoZSBzb3VyY2UgZXZlbnQgaXMgZmlyZWQgbXVsdGlwbGUgdGltZXMsIHRoZSBkZWJvdW5jZWQgKG9uIHRoZSBsZWFkaW5nIGVkZ2UpIGV2ZW50IHNob3VsZCBiZSBmaXJlZCB0d2ljZVxuXHRcdFx0ZW1pdHRlci5maXJlKCk7XG5cdFx0XHRlbWl0dGVyLmZpcmUoKTtcblx0XHRcdGVtaXR0ZXIuZmlyZSgpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxscywgMik7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdsZWFkaW5nIHJlc2V0JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3QgZW1pdHRlciA9IGRzLmFkZChuZXcgRW1pdHRlcjxudW1iZXI+KCkpO1xuXHRcdFx0Y29uc3QgZGVib3VuY2VkID0gRXZlbnQuZGVib3VuY2UoZW1pdHRlci5ldmVudCwgKGwsIGUpID0+IGwgPyBsICsgMSA6IDEsIDAsIC8qbGVhZGluZz0qL3RydWUpO1xuXG5cdFx0XHRjb25zdCBjYWxsczogbnVtYmVyW10gPSBbXTtcblx0XHRcdGRzLmFkZChkZWJvdW5jZWQoKGUpID0+IGNhbGxzLnB1c2goZSkpKTtcblxuXHRcdFx0ZW1pdHRlci5maXJlKDEpO1xuXHRcdFx0ZW1pdHRlci5maXJlKDEpO1xuXG5cdFx0XHRhd2FpdCB0aW1lb3V0KDEpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxscywgWzEsIDFdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBub3QgZmx1c2ggZXZlbnRzIHdoZW4gYSBsaXN0ZW5lciBpcyBkaXNwb3NlZCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGVtaXR0ZXIgPSBkcy5hZGQobmV3IEVtaXR0ZXI8bnVtYmVyPigpKTtcblx0XHRcdGNvbnN0IGRlYm91bmNlZCA9IEV2ZW50LmRlYm91bmNlKGVtaXR0ZXIuZXZlbnQsIChsLCBlKSA9PiBsID8gbCArIDEgOiAxLCAwKTtcblxuXHRcdFx0Y29uc3QgY2FsbHM6IG51bWJlcltdID0gW107XG5cdFx0XHRjb25zdCBsaXN0ZW5lciA9IGRzLmFkZChkZWJvdW5jZWQoKGUpID0+IGNhbGxzLnB1c2goZSkpKTtcblxuXHRcdFx0ZW1pdHRlci5maXJlKDEpO1xuXHRcdFx0bGlzdGVuZXIuZGlzcG9zZSgpO1xuXG5cdFx0XHRlbWl0dGVyLmZpcmUoMSk7XG5cblx0XHRcdGF3YWl0IHRpbWVvdXQoMSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzLCBbXSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdmbHVzaE9uTGlzdGVuZXJSZW1vdmUgLSBzaG91bGQgZmx1c2ggZXZlbnRzIHdoZW4gYSBsaXN0ZW5lciBpcyBkaXNwb3NlZCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGVtaXR0ZXIgPSBkcy5hZGQobmV3IEVtaXR0ZXI8bnVtYmVyPigpKTtcblx0XHRcdGNvbnN0IGRlYm91bmNlZCA9IEV2ZW50LmRlYm91bmNlKGVtaXR0ZXIuZXZlbnQsIChsLCBlKSA9PiBsID8gbCArIDEgOiAxLCAwLCB1bmRlZmluZWQsIHRydWUpO1xuXG5cdFx0XHRjb25zdCBjYWxsczogbnVtYmVyW10gPSBbXTtcblx0XHRcdGNvbnN0IGxpc3RlbmVyID0gZHMuYWRkKGRlYm91bmNlZCgoZSkgPT4gY2FsbHMucHVzaChlKSkpO1xuXG5cdFx0XHRlbWl0dGVyLmZpcmUoMSk7XG5cdFx0XHRsaXN0ZW5lci5kaXNwb3NlKCk7XG5cblx0XHRcdGVtaXR0ZXIuZmlyZSgxKTtcblxuXHRcdFx0YXdhaXQgdGltZW91dCgxKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2FsbHMsIFsxXSwgJ3Nob3VsZCBmaXJlIHdpdGggdGhlIGZpcnN0IGV2ZW50LCBub3QgdGhlIHNlY29uZCAoYWZ0ZXIgbGlzdGVuZXIgZGlzcG9zZSknKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBmbHVzaCBldmVudHMgd2hlbiB0aGUgZW1pdHRlciBpcyBkaXNwb3NlZCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGVtaXR0ZXIgPSBkcy5hZGQobmV3IEVtaXR0ZXI8bnVtYmVyPigpKTtcblx0XHRcdGNvbnN0IGRlYm91bmNlZCA9IEV2ZW50LmRlYm91bmNlKGVtaXR0ZXIuZXZlbnQsIChsLCBlKSA9PiBsID8gbCArIDEgOiAxLCAwKTtcblxuXHRcdFx0Y29uc3QgY2FsbHM6IG51bWJlcltdID0gW107XG5cdFx0XHRkcy5hZGQoZGVib3VuY2VkKChlKSA9PiBjYWxscy5wdXNoKGUpKSk7XG5cblx0XHRcdGVtaXR0ZXIuZmlyZSgxKTtcblx0XHRcdGVtaXR0ZXIuZGlzcG9zZSgpO1xuXG5cdFx0XHRhd2FpdCB0aW1lb3V0KDEpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxscywgWzFdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzIzMDQwMScsICgpID0+IHtcblx0XHRsZXQgY291bnQgPSAwO1xuXHRcdGNvbnN0IGVtaXR0ZXIgPSBkcy5hZGQobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBkcy5hZGQobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0XHRkcy5hZGQoZW1pdHRlci5ldmVudCgoKSA9PiB7XG5cdFx0XHRjb3VudCsrO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGVtaXR0ZXIuZXZlbnQoKCkgPT4ge1xuXHRcdFx0XHRjb3VudCsrO1xuXHRcdFx0fSkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGVtaXR0ZXIuZXZlbnQoKCkgPT4ge1xuXHRcdFx0XHRjb3VudCsrO1xuXHRcdFx0fSkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHR9KSk7XG5cdFx0ZHMuYWRkKGVtaXR0ZXIuZXZlbnQoKCkgPT4ge1xuXHRcdFx0Y291bnQrKztcblx0XHR9KSk7XG5cdFx0ZW1pdHRlci5maXJlKCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb3VudCwgMik7XG5cdH0pO1xuXG5cdHN1aXRlKCdjaGFpbjInLCAoKSA9PiB7XG5cdFx0bGV0IGVtOiBFbWl0dGVyPG51bWJlcj47XG5cdFx0bGV0IGNhbGxzOiBudW1iZXJbXTtcblxuXHRcdHNldHVwKCgpID0+IHtcblx0XHRcdGVtID0gZHMuYWRkKG5ldyBFbWl0dGVyPG51bWJlcj4oKSk7XG5cdFx0XHRjYWxscyA9IFtdO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnbWFwcycsICgpID0+IHtcblx0XHRcdGNvbnN0IGV2ID0gRXZlbnQuY2hhaW4oZW0uZXZlbnQsICQgPT4gJC5tYXAodiA9PiB2ICogMikpO1xuXHRcdFx0ZHMuYWRkKGV2KHYgPT4gY2FsbHMucHVzaCh2KSkpO1xuXHRcdFx0ZW0uZmlyZSgxKTtcblx0XHRcdGVtLmZpcmUoMik7XG5cdFx0XHRlbS5maXJlKDMpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxscywgWzIsIDQsIDZdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2ZpbHRlcnMnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBldiA9IEV2ZW50LmNoYWluKGVtLmV2ZW50LCAkID0+ICQuZmlsdGVyKHYgPT4gdiAlIDIgPT09IDApKTtcblx0XHRcdGRzLmFkZChldih2ID0+IGNhbGxzLnB1c2godikpKTtcblx0XHRcdGVtLmZpcmUoMSk7XG5cdFx0XHRlbS5maXJlKDIpO1xuXHRcdFx0ZW0uZmlyZSgzKTtcblx0XHRcdGVtLmZpcmUoNCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzLCBbMiwgNF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncmVkdWNlcycsICgpID0+IHtcblx0XHRcdGNvbnN0IGV2ID0gRXZlbnQuY2hhaW4oZW0uZXZlbnQsICQgPT4gJC5yZWR1Y2UoKGFjYywgdikgPT4gYWNjICsgdiwgMCkpO1xuXHRcdFx0ZHMuYWRkKGV2KHYgPT4gY2FsbHMucHVzaCh2KSkpO1xuXHRcdFx0ZW0uZmlyZSgxKTtcblx0XHRcdGVtLmZpcmUoMik7XG5cdFx0XHRlbS5maXJlKDMpO1xuXHRcdFx0ZW0uZmlyZSg0KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2FsbHMsIFsxLCAzLCA2LCAxMF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnbGF0Y2hlcycsICgpID0+IHtcblx0XHRcdGNvbnN0IGV2ID0gRXZlbnQuY2hhaW4oZW0uZXZlbnQsICQgPT4gJC5sYXRjaCgpKTtcblx0XHRcdGRzLmFkZChldih2ID0+IGNhbGxzLnB1c2godikpKTtcblx0XHRcdGVtLmZpcmUoMSk7XG5cdFx0XHRlbS5maXJlKDEpO1xuXHRcdFx0ZW0uZmlyZSgyKTtcblx0XHRcdGVtLmZpcmUoMik7XG5cdFx0XHRlbS5maXJlKDMpO1xuXHRcdFx0ZW0uZmlyZSgzKTtcblx0XHRcdGVtLmZpcmUoMSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzLCBbMSwgMiwgMywgMV0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZG9lcyBldmVyeXRoaW5nJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZXYgPSBFdmVudC5jaGFpbihlbS5ldmVudCwgJCA9PiAkXG5cdFx0XHRcdC5maWx0ZXIodiA9PiB2ICUgMiA9PT0gMClcblx0XHRcdFx0Lm1hcCh2ID0+IHYgKiAyKVxuXHRcdFx0XHQucmVkdWNlKChhY2MsIHYpID0+IGFjYyArIHYsIDApXG5cdFx0XHRcdC5sYXRjaCgpXG5cdFx0XHQpO1xuXG5cdFx0XHRkcy5hZGQoZXYodiA9PiBjYWxscy5wdXNoKHYpKSk7XG5cdFx0XHRlbS5maXJlKDEpO1xuXHRcdFx0ZW0uZmlyZSgyKTtcblx0XHRcdGVtLmZpcmUoMyk7XG5cdFx0XHRlbS5maXJlKDQpO1xuXHRcdFx0ZW0uZmlyZSgwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2FsbHMsIFs0LCAxMl0pO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBSUEsT0FBTyxZQUFZO0FBQ25CLFNBQVMsWUFBWTtBQUNyQixTQUFTLGlCQUFpQixlQUFlO0FBQ3pDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsY0FBYyxpQ0FBaUM7QUFDeEQsU0FBUyxjQUFjLGlCQUFpQiw2QkFBNkIsU0FBUyxPQUFPLGVBQWUsa0JBQThCLG1CQUFtQixzQkFBc0Isa0JBQWtCLGtCQUFrQixPQUFPLGdDQUFnQztBQUN0UCxTQUFTLGlCQUE4QixjQUFjLHNCQUFzQix5QkFBeUI7QUFDcEcsU0FBUyxpQkFBaUIsbUJBQW1CO0FBQzdDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsWUFBWTtBQUVyQixJQUFV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VyxNQUFNO0FBQ3JCLFlBQU0sS0FBSyxNQUFNLE1BQU0sR0FBRyxPQUFPLE9BQUssRUFBRSxPQUFPLENBQUMsS0FBSyxNQUFNLE1BQU0sR0FBRyxDQUFDLENBQUM7QUFDdEUsU0FBRyxJQUFJLEdBQUcsT0FBSyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDN0IsU0FBRyxLQUFLLENBQUM7QUFDVCxTQUFHLEtBQUssQ0FBQztBQUNULFNBQUcsS0FBSyxDQUFDO0FBQ1QsU0FBRyxLQUFLLENBQUM7QUFDVCxhQUFPLGdCQUFnQixPQUFPLENBQUMsR0FBRyxHQUFHLEdBQUcsRUFBRSxDQUFDO0FBQUEsSUFDNUMsQ0FBQztBQUVELFNBQUssV0FBVyxNQUFNO0FBQ3JCLFlBQU0sS0FBSyxNQUFNLE1BQU0sR0FBRyxPQUFPLE9BQUssRUFBRSxNQUFNLENBQUM7QUFDL0MsU0FBRyxJQUFJLEdBQUcsT0FBSyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDN0IsU0FBRyxLQUFLLENBQUM7QUFDVCxTQUFHLEtBQUssQ0FBQztBQUNULFNBQUcsS0FBSyxDQUFDO0FBQ1QsU0FBRyxLQUFLLENBQUM7QUFDVCxTQUFHLEtBQUssQ0FBQztBQUNULFNBQUcsS0FBSyxDQUFDO0FBQ1QsU0FBRyxLQUFLLENBQUM7QUFDVCxhQUFPLGdCQUFnQixPQUFPLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsSUFDM0MsQ0FBQztBQUVELFNBQUssbUJBQW1CLE1BQU07QUFDN0IsWUFBTSxLQUFLLE1BQU07QUFBQSxRQUFNLEdBQUc7QUFBQSxRQUFPLE9BQUssRUFDcEMsT0FBTyxPQUFLLElBQUksTUFBTSxDQUFDLEVBQ3ZCLElBQUksT0FBSyxJQUFJLENBQUMsRUFDZCxPQUFPLENBQUMsS0FBSyxNQUFNLE1BQU0sR0FBRyxDQUFDLEVBQzdCLE1BQU07QUFBQSxNQUNSO0FBRUEsU0FBRyxJQUFJLEdBQUcsT0FBSyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDN0IsU0FBRyxLQUFLLENBQUM7QUFDVCxTQUFHLEtBQUssQ0FBQztBQUNULFNBQUcsS0FBSyxDQUFDO0FBQ1QsU0FBRyxLQUFLLENBQUM7QUFDVCxTQUFHLEtBQUssQ0FBQztBQUNULGFBQU8sZ0JBQWdCLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUFBLElBQ3RDLENBQUM7QUFBQSxFQUNGLENBQUM7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJTYW1wbGVzIiwgImNvdW50ZXIiLCAicCJdCn0K
