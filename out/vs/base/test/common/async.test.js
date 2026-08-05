import assert from "assert";
import * as async from "../../common/async.js";
import * as MicrotaskDelay from "../../common/symbols.js";
import { CancellationTokenSource } from "../../common/cancellation.js";
import { isCancellationError } from "../../common/errors.js";
import { Event } from "../../common/event.js";
import { URI } from "../../common/uri.js";
import { runWithFakedTimers } from "./timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "./utils.js";
import { DisposableStore } from "../../common/lifecycle.js";
suite("Async", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  suite("cancelablePromise", function() {
    test("set token, don't wait for inner promise", function() {
      let canceled = 0;
      const promise = async.createCancelablePromise((token) => {
        store.add(token.onCancellationRequested((_) => {
          canceled += 1;
        }));
        return new Promise((resolve) => {
        });
      });
      const result = promise.then((_) => assert.ok(false), (err) => {
        assert.strictEqual(canceled, 1);
        assert.ok(isCancellationError(err));
      });
      promise.cancel();
      promise.cancel();
      return result;
    });
    test("cancel despite inner promise being resolved", function() {
      let canceled = 0;
      const promise = async.createCancelablePromise((token) => {
        store.add(token.onCancellationRequested((_) => {
          canceled += 1;
        }));
        return Promise.resolve(1234);
      });
      const result = promise.then((_) => assert.ok(false), (err) => {
        assert.strictEqual(canceled, 1);
        assert.ok(isCancellationError(err));
      });
      promise.cancel();
      return result;
    });
    test("execution order (sync)", function() {
      const order = [];
      const cancellablePromise = async.createCancelablePromise((token) => {
        order.push("in callback");
        store.add(token.onCancellationRequested((_) => order.push("cancelled")));
        return Promise.resolve(1234);
      });
      order.push("afterCreate");
      const promise = cancellablePromise.then(void 0, (err) => null).then(() => order.push("finally"));
      cancellablePromise.cancel();
      order.push("afterCancel");
      return promise.then(() => assert.deepStrictEqual(order, ["in callback", "afterCreate", "cancelled", "afterCancel", "finally"]));
    });
    test("execution order (async)", function() {
      const order = [];
      const cancellablePromise = async.createCancelablePromise((token) => {
        order.push("in callback");
        store.add(token.onCancellationRequested((_) => order.push("cancelled")));
        return new Promise((c) => setTimeout(c.bind(1234), 0));
      });
      order.push("afterCreate");
      const promise = cancellablePromise.then(void 0, (err) => null).then(() => order.push("finally"));
      cancellablePromise.cancel();
      order.push("afterCancel");
      return promise.then(() => assert.deepStrictEqual(order, ["in callback", "afterCreate", "cancelled", "afterCancel", "finally"]));
    });
    test("execution order (async with late listener)", async function() {
      const order = [];
      const cancellablePromise = async.createCancelablePromise(async (token) => {
        order.push("in callback");
        await async.timeout(0);
        store.add(token.onCancellationRequested((_) => order.push("cancelled")));
        cancellablePromise.cancel();
        order.push("afterCancel");
      });
      order.push("afterCreate");
      const promise = cancellablePromise.then(void 0, (err) => null).then(() => order.push("finally"));
      return promise.then(() => assert.deepStrictEqual(order, ["in callback", "afterCreate", "cancelled", "afterCancel", "finally"]));
    });
    test("get inner result", async function() {
      const promise = async.createCancelablePromise((token) => {
        return async.timeout(12).then((_) => 1234);
      });
      const result = await promise;
      assert.strictEqual(result, 1234);
    });
  });
  suite("Throttler", function() {
    test("non async", function() {
      let count = 0;
      const factory = () => {
        return Promise.resolve(++count);
      };
      const throttler = new async.Throttler();
      return Promise.all([
        throttler.queue(factory).then((result) => {
          assert.strictEqual(result, 1);
        }),
        throttler.queue(factory).then((result) => {
          assert.strictEqual(result, 2);
        }),
        throttler.queue(factory).then((result) => {
          assert.strictEqual(result, 2);
        }),
        throttler.queue(factory).then((result) => {
          assert.strictEqual(result, 2);
        }),
        throttler.queue(factory).then((result) => {
          assert.strictEqual(result, 2);
        })
      ]).then(() => assert.strictEqual(count, 2));
    });
    test("async", () => {
      let count = 0;
      const factory = () => async.timeout(0).then(() => ++count);
      const throttler = new async.Throttler();
      return Promise.all([
        throttler.queue(factory).then((result) => {
          assert.strictEqual(result, 1);
        }),
        throttler.queue(factory).then((result) => {
          assert.strictEqual(result, 2);
        }),
        throttler.queue(factory).then((result) => {
          assert.strictEqual(result, 2);
        }),
        throttler.queue(factory).then((result) => {
          assert.strictEqual(result, 2);
        }),
        throttler.queue(factory).then((result) => {
          assert.strictEqual(result, 2);
        })
      ]).then(() => {
        return Promise.all([
          throttler.queue(factory).then((result) => {
            assert.strictEqual(result, 3);
          }),
          throttler.queue(factory).then((result) => {
            assert.strictEqual(result, 4);
          }),
          throttler.queue(factory).then((result) => {
            assert.strictEqual(result, 4);
          }),
          throttler.queue(factory).then((result) => {
            assert.strictEqual(result, 4);
          }),
          throttler.queue(factory).then((result) => {
            assert.strictEqual(result, 4);
          })
        ]);
      });
    });
    test("last factory should be the one getting called", function() {
      const factoryFactory = (n) => () => {
        return async.timeout(0).then(() => n);
      };
      const throttler = new async.Throttler();
      const promises = [];
      promises.push(throttler.queue(factoryFactory(1)).then((n) => {
        assert.strictEqual(n, 1);
      }));
      promises.push(throttler.queue(factoryFactory(2)).then((n) => {
        assert.strictEqual(n, 3);
      }));
      promises.push(throttler.queue(factoryFactory(3)).then((n) => {
        assert.strictEqual(n, 3);
      }));
      return Promise.all(promises);
    });
    test("disposal after queueing", async () => {
      let factoryCalls = 0;
      const factory = async () => {
        factoryCalls++;
        return async.timeout(0);
      };
      const throttler = new async.Throttler();
      const promises = [];
      promises.push(throttler.queue(factory));
      promises.push(throttler.queue(factory));
      throttler.dispose();
      await Promise.all(promises);
      assert.strictEqual(factoryCalls, 1);
    });
    test("disposal before queueing", async () => {
      let factoryCalls = 0;
      const factory = async () => {
        factoryCalls++;
        return async.timeout(0);
      };
      const throttler = new async.Throttler();
      const promises = [];
      throttler.dispose();
      promises.push(throttler.queue(factory));
      try {
        await Promise.all(promises);
        assert.fail("should fail");
      } catch (err) {
        assert.strictEqual(factoryCalls, 0);
      }
    });
  });
  suite("Delayer", function() {
    test("simple", () => {
      let count = 0;
      const factory = () => {
        return Promise.resolve(++count);
      };
      const delayer = new async.Delayer(0);
      const promises = [];
      assert(!delayer.isTriggered());
      promises.push(delayer.trigger(factory).then((result) => {
        assert.strictEqual(result, 1);
        assert(!delayer.isTriggered());
      }));
      assert(delayer.isTriggered());
      promises.push(delayer.trigger(factory).then((result) => {
        assert.strictEqual(result, 1);
        assert(!delayer.isTriggered());
      }));
      assert(delayer.isTriggered());
      promises.push(delayer.trigger(factory).then((result) => {
        assert.strictEqual(result, 1);
        assert(!delayer.isTriggered());
      }));
      assert(delayer.isTriggered());
      return Promise.all(promises).then(() => {
        assert(!delayer.isTriggered());
      });
    });
    test("microtask delay simple", () => {
      let count = 0;
      const factory = () => {
        return Promise.resolve(++count);
      };
      const delayer = new async.Delayer(MicrotaskDelay.MicrotaskDelay);
      const promises = [];
      assert(!delayer.isTriggered());
      promises.push(delayer.trigger(factory).then((result) => {
        assert.strictEqual(result, 1);
        assert(!delayer.isTriggered());
      }));
      assert(delayer.isTriggered());
      promises.push(delayer.trigger(factory).then((result) => {
        assert.strictEqual(result, 1);
        assert(!delayer.isTriggered());
      }));
      assert(delayer.isTriggered());
      promises.push(delayer.trigger(factory).then((result) => {
        assert.strictEqual(result, 1);
        assert(!delayer.isTriggered());
      }));
      assert(delayer.isTriggered());
      return Promise.all(promises).then(() => {
        assert(!delayer.isTriggered());
      });
    });
    suite("ThrottledDelayer", () => {
      test("promise should resolve if disposed", async () => {
        const throttledDelayer = new async.ThrottledDelayer(100);
        const promise = throttledDelayer.trigger(async () => {
        }, 0);
        throttledDelayer.dispose();
        try {
          await promise;
          assert.fail("SHOULD NOT BE HERE");
        } catch (err) {
        }
      });
      test("trigger after dispose throws", async () => {
        const throttledDelayer = new async.ThrottledDelayer(100);
        throttledDelayer.dispose();
        await assert.rejects(() => throttledDelayer.trigger(async () => {
        }, 0));
      });
    });
    test("simple cancel", function() {
      let count = 0;
      const factory = () => {
        return Promise.resolve(++count);
      };
      const delayer = new async.Delayer(0);
      assert(!delayer.isTriggered());
      const p = delayer.trigger(factory).then(() => {
        assert(false);
      }, () => {
        assert(true, "yes, it was cancelled");
      });
      assert(delayer.isTriggered());
      delayer.cancel();
      assert(!delayer.isTriggered());
      return p;
    });
    test("simple cancel microtask", function() {
      let count = 0;
      const factory = () => {
        return Promise.resolve(++count);
      };
      const delayer = new async.Delayer(MicrotaskDelay.MicrotaskDelay);
      assert(!delayer.isTriggered());
      const p = delayer.trigger(factory).then(() => {
        assert(false);
      }, () => {
        assert(true, "yes, it was cancelled");
      });
      assert(delayer.isTriggered());
      delayer.cancel();
      assert(!delayer.isTriggered());
      return p;
    });
    test("cancel should cancel all calls to trigger", function() {
      let count = 0;
      const factory = () => {
        return Promise.resolve(++count);
      };
      const delayer = new async.Delayer(0);
      const promises = [];
      assert(!delayer.isTriggered());
      promises.push(delayer.trigger(factory).then(void 0, () => {
        assert(true, "yes, it was cancelled");
      }));
      assert(delayer.isTriggered());
      promises.push(delayer.trigger(factory).then(void 0, () => {
        assert(true, "yes, it was cancelled");
      }));
      assert(delayer.isTriggered());
      promises.push(delayer.trigger(factory).then(void 0, () => {
        assert(true, "yes, it was cancelled");
      }));
      assert(delayer.isTriggered());
      delayer.cancel();
      return Promise.all(promises).then(() => {
        assert(!delayer.isTriggered());
      });
    });
    test("trigger, cancel, then trigger again", function() {
      let count = 0;
      const factory = () => {
        return Promise.resolve(++count);
      };
      const delayer = new async.Delayer(0);
      let promises = [];
      assert(!delayer.isTriggered());
      const p = delayer.trigger(factory).then((result) => {
        assert.strictEqual(result, 1);
        assert(!delayer.isTriggered());
        promises.push(delayer.trigger(factory).then(void 0, () => {
          assert(true, "yes, it was cancelled");
        }));
        assert(delayer.isTriggered());
        promises.push(delayer.trigger(factory).then(void 0, () => {
          assert(true, "yes, it was cancelled");
        }));
        assert(delayer.isTriggered());
        delayer.cancel();
        const p2 = Promise.all(promises).then(() => {
          promises = [];
          assert(!delayer.isTriggered());
          promises.push(delayer.trigger(factory).then(() => {
            assert.strictEqual(result, 1);
            assert(!delayer.isTriggered());
          }));
          assert(delayer.isTriggered());
          promises.push(delayer.trigger(factory).then(() => {
            assert.strictEqual(result, 1);
            assert(!delayer.isTriggered());
          }));
          assert(delayer.isTriggered());
          const p3 = Promise.all(promises).then(() => {
            assert(!delayer.isTriggered());
          });
          assert(delayer.isTriggered());
          return p3;
        });
        return p2;
      });
      assert(delayer.isTriggered());
      return p;
    });
    test("last task should be the one getting called", function() {
      const factoryFactory = (n) => () => {
        return Promise.resolve(n);
      };
      const delayer = new async.Delayer(0);
      const promises = [];
      assert(!delayer.isTriggered());
      promises.push(delayer.trigger(factoryFactory(1)).then((n) => {
        assert.strictEqual(n, 3);
      }));
      promises.push(delayer.trigger(factoryFactory(2)).then((n) => {
        assert.strictEqual(n, 3);
      }));
      promises.push(delayer.trigger(factoryFactory(3)).then((n) => {
        assert.strictEqual(n, 3);
      }));
      const p = Promise.all(promises).then(() => {
        assert(!delayer.isTriggered());
      });
      assert(delayer.isTriggered());
      return p;
    });
  });
  suite("sequence", () => {
    test("simple", () => {
      const factoryFactory = (n) => () => {
        return Promise.resolve(n);
      };
      return async.sequence([
        factoryFactory(1),
        factoryFactory(2),
        factoryFactory(3),
        factoryFactory(4),
        factoryFactory(5)
      ]).then((result) => {
        assert.strictEqual(5, result.length);
        assert.strictEqual(1, result[0]);
        assert.strictEqual(2, result[1]);
        assert.strictEqual(3, result[2]);
        assert.strictEqual(4, result[3]);
        assert.strictEqual(5, result[4]);
      });
    });
  });
  suite("Limiter", () => {
    test("assert degree of paralellism", function() {
      let activePromises = 0;
      const factoryFactory = (n) => () => {
        activePromises++;
        assert(activePromises < 6);
        return async.timeout(0).then(() => {
          activePromises--;
          return n;
        });
      };
      const limiter = new async.Limiter(5);
      const promises = [];
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((n) => promises.push(limiter.queue(factoryFactory(n))));
      return Promise.all(promises).then((res) => {
        assert.strictEqual(10, res.length);
        assert.deepStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], res);
      });
    });
  });
  suite("Queue", () => {
    test("simple", function() {
      const queue = new async.Queue();
      let syncPromise = false;
      const f1 = () => Promise.resolve(true).then(() => syncPromise = true);
      let asyncPromise = false;
      const f2 = () => async.timeout(10).then(() => asyncPromise = true);
      assert.strictEqual(queue.size, 0);
      queue.queue(f1);
      assert.strictEqual(queue.size, 1);
      const p = queue.queue(f2);
      assert.strictEqual(queue.size, 2);
      return p.then(() => {
        assert.strictEqual(queue.size, 0);
        assert.ok(syncPromise);
        assert.ok(asyncPromise);
      });
    });
    test("stop processing on dispose", async function() {
      const queue = new async.Queue();
      let workCounter = 0;
      const task = async () => {
        await async.timeout(0);
        workCounter++;
        queue.dispose();
      };
      const p1 = queue.queue(task);
      queue.queue(task);
      queue.queue(task);
      assert.strictEqual(queue.size, 3);
      await p1;
      assert.strictEqual(workCounter, 1);
    });
    test("stop on clear", async function() {
      const queue = new async.Queue();
      let workCounter = 0;
      const task = async () => {
        await async.timeout(0);
        workCounter++;
        queue.clear();
        assert.strictEqual(queue.size, 1);
      };
      const p1 = queue.queue(task);
      queue.queue(task);
      queue.queue(task);
      assert.strictEqual(queue.size, 3);
      await p1;
      assert.strictEqual(workCounter, 1);
      assert.strictEqual(queue.size, 0);
      const p2 = queue.queue(task);
      await p2;
      assert.strictEqual(workCounter, 2);
    });
    test("clear and drain (1)", async function() {
      const queue = new async.Queue();
      let workCounter = 0;
      const task = async () => {
        await async.timeout(0);
        workCounter++;
        queue.clear();
      };
      const p0 = Event.toPromise(queue.onDrained);
      const p1 = queue.queue(task);
      await p1;
      await p0;
      assert.strictEqual(workCounter, 1);
      queue.dispose();
    });
    test("clear and drain (2)", async function() {
      const queue = new async.Queue();
      let didFire = false;
      const d = queue.onDrained(() => {
        didFire = true;
      });
      queue.clear();
      assert.strictEqual(didFire, false);
      d.dispose();
      queue.dispose();
    });
    test("drain timing", async function() {
      const queue = new async.Queue();
      const logicClock = new class {
        constructor() {
          this.time = 0;
        }
        tick() {
          return this.time++;
        }
      }();
      let didDrainTime = 0;
      let didFinishTime1 = 0;
      let didFinishTime2 = 0;
      const d = queue.onDrained(() => {
        didDrainTime = logicClock.tick();
      });
      const p1 = queue.queue(() => {
        didFinishTime1 = logicClock.tick();
        return Promise.resolve();
      });
      const p2 = queue.queue(async () => {
        await async.timeout(10);
        didFinishTime2 = logicClock.tick();
      });
      await Promise.all([p1, p2]);
      assert.strictEqual(didFinishTime1, 0);
      assert.strictEqual(didFinishTime2, 1);
      assert.strictEqual(didDrainTime, 2);
      d.dispose();
      queue.dispose();
    });
    test("drain event is send only once", async function() {
      const queue = new async.Queue();
      let drainCount = 0;
      const d = queue.onDrained(() => {
        drainCount++;
      });
      queue.queue(async () => {
      });
      queue.queue(async () => {
      });
      queue.queue(async () => {
      });
      queue.queue(async () => {
      });
      assert.strictEqual(drainCount, 0);
      assert.strictEqual(queue.size, 4);
      await queue.whenIdle();
      assert.strictEqual(drainCount, 1);
      d.dispose();
      queue.dispose();
    });
    test("order is kept", function() {
      return runWithFakedTimers({}, () => {
        const queue = new async.Queue();
        const res = [];
        const f1 = () => Promise.resolve(true).then(() => res.push(1));
        const f2 = () => async.timeout(10).then(() => res.push(2));
        const f3 = () => Promise.resolve(true).then(() => res.push(3));
        const f4 = () => async.timeout(20).then(() => res.push(4));
        const f5 = () => async.timeout(0).then(() => res.push(5));
        queue.queue(f1);
        queue.queue(f2);
        queue.queue(f3);
        queue.queue(f4);
        return queue.queue(f5).then(() => {
          assert.strictEqual(res[0], 1);
          assert.strictEqual(res[1], 2);
          assert.strictEqual(res[2], 3);
          assert.strictEqual(res[3], 4);
          assert.strictEqual(res[4], 5);
        });
      });
    });
    test("errors bubble individually but not cause stop", function() {
      const queue = new async.Queue();
      const res = [];
      let error = false;
      const f1 = () => Promise.resolve(true).then(() => res.push(1));
      const f2 = () => async.timeout(10).then(() => res.push(2));
      const f3 = () => Promise.resolve(true).then(() => Promise.reject(new Error("error")));
      const f4 = () => async.timeout(20).then(() => res.push(4));
      const f5 = () => async.timeout(0).then(() => res.push(5));
      queue.queue(f1);
      queue.queue(f2);
      queue.queue(f3).then(void 0, () => error = true);
      queue.queue(f4);
      return queue.queue(f5).then(() => {
        assert.strictEqual(res[0], 1);
        assert.strictEqual(res[1], 2);
        assert.ok(error);
        assert.strictEqual(res[2], 4);
        assert.strictEqual(res[3], 5);
      });
    });
    test("order is kept (chained)", function() {
      const queue = new async.Queue();
      const res = [];
      const f1 = () => Promise.resolve(true).then(() => res.push(1));
      const f2 = () => async.timeout(10).then(() => res.push(2));
      const f3 = () => Promise.resolve(true).then(() => res.push(3));
      const f4 = () => async.timeout(20).then(() => res.push(4));
      const f5 = () => async.timeout(0).then(() => res.push(5));
      return queue.queue(f1).then(() => {
        return queue.queue(f2).then(() => {
          return queue.queue(f3).then(() => {
            return queue.queue(f4).then(() => {
              return queue.queue(f5).then(() => {
                assert.strictEqual(res[0], 1);
                assert.strictEqual(res[1], 2);
                assert.strictEqual(res[2], 3);
                assert.strictEqual(res[3], 4);
                assert.strictEqual(res[4], 5);
              });
            });
          });
        });
      });
    });
    test("events", async function() {
      const queue = new async.Queue();
      let drained = false;
      const onDrained = Event.toPromise(queue.onDrained).then(() => drained = true);
      const res = [];
      const f1 = () => async.timeout(10).then(() => res.push(2));
      const f2 = () => async.timeout(20).then(() => res.push(4));
      const f3 = () => async.timeout(0).then(() => res.push(5));
      const q1 = queue.queue(f1);
      const q2 = queue.queue(f2);
      queue.queue(f3);
      q1.then(() => {
        assert.ok(!drained);
        q2.then(() => {
          assert.ok(!drained);
        });
      });
      await onDrained;
      assert.ok(drained);
    });
  });
  suite("ResourceQueue", () => {
    test("simple", async function() {
      const queue = new async.ResourceQueue();
      await queue.whenDrained();
      let done1 = false;
      queue.queueFor(URI.file("/some/path"), async () => {
        done1 = true;
      });
      await queue.whenDrained();
      assert.strictEqual(done1, true);
      let done2 = false;
      queue.queueFor(URI.file("/some/other/path"), async () => {
        done2 = true;
      });
      await queue.whenDrained();
      assert.strictEqual(done2, true);
      const w1 = new async.DeferredPromise();
      queue.queueFor(URI.file("/some/path"), () => w1.p);
      let drained = false;
      queue.whenDrained().then(() => drained = true);
      assert.strictEqual(drained, false);
      await w1.complete();
      await async.timeout(0);
      assert.strictEqual(drained, true);
      const w2 = new async.DeferredPromise();
      const w3 = new async.DeferredPromise();
      queue.queueFor(URI.file("/some/path"), () => w2.p);
      queue.queueFor(URI.file("/some/other/path"), () => w3.p);
      drained = false;
      queue.whenDrained().then(() => drained = true);
      queue.dispose();
      await async.timeout(0);
      assert.strictEqual(drained, true);
    });
  });
  suite("retry", () => {
    test("success case", async () => {
      return runWithFakedTimers({ useFakeTimers: true }, async () => {
        let counter = 0;
        const res = await async.retry(() => {
          counter++;
          if (counter < 2) {
            return Promise.reject(new Error("fail"));
          }
          return Promise.resolve(true);
        }, 10, 3);
        assert.strictEqual(res, true);
      });
    });
    test("error case", async () => {
      return runWithFakedTimers({ useFakeTimers: true }, async () => {
        const expectedError = new Error("fail");
        try {
          await async.retry(() => {
            return Promise.reject(expectedError);
          }, 10, 3);
        } catch (error) {
          assert.strictEqual(error, error);
        }
      });
    });
  });
  suite("TaskSequentializer", () => {
    test("execution basics", async function() {
      const sequentializer = new async.TaskSequentializer();
      assert.ok(!sequentializer.isRunning());
      assert.ok(!sequentializer.hasQueued());
      assert.ok(!sequentializer.isRunning(2323));
      assert.ok(!sequentializer.running);
      await sequentializer.run(1, Promise.resolve());
      assert.ok(!sequentializer.isRunning());
      assert.ok(!sequentializer.isRunning(1));
      assert.ok(!sequentializer.running);
      assert.ok(!sequentializer.hasQueued());
      sequentializer.run(2, async.timeout(1));
      assert.ok(sequentializer.isRunning());
      assert.ok(sequentializer.isRunning(2));
      assert.ok(!sequentializer.hasQueued());
      assert.strictEqual(sequentializer.isRunning(1), false);
      assert.ok(sequentializer.running);
      await async.timeout(2);
      assert.strictEqual(sequentializer.isRunning(), false);
      assert.strictEqual(sequentializer.isRunning(2), false);
      assert.ok(!sequentializer.running);
    });
    test("executing and queued (finishes instantly)", async function() {
      const sequentializer = new async.TaskSequentializer();
      let pendingDone = false;
      sequentializer.run(1, async.timeout(1).then(() => {
        pendingDone = true;
        return;
      }));
      let queuedDone = false;
      const res = sequentializer.queue(() => Promise.resolve(null).then(() => {
        queuedDone = true;
        return;
      }));
      assert.ok(sequentializer.hasQueued());
      await res;
      assert.ok(pendingDone);
      assert.ok(queuedDone);
      assert.ok(!sequentializer.hasQueued());
    });
    test("executing and queued (finishes after timeout)", async function() {
      const sequentializer = new async.TaskSequentializer();
      let pendingDone = false;
      sequentializer.run(1, async.timeout(1).then(() => {
        pendingDone = true;
        return;
      }));
      let queuedDone = false;
      const res = sequentializer.queue(() => async.timeout(1).then(() => {
        queuedDone = true;
        return;
      }));
      await res;
      assert.ok(pendingDone);
      assert.ok(queuedDone);
      assert.ok(!sequentializer.hasQueued());
    });
    test("join (without executing or queued)", async function() {
      const sequentializer = new async.TaskSequentializer();
      await sequentializer.join();
      assert.ok(!sequentializer.hasQueued());
    });
    test("join (without queued)", async function() {
      const sequentializer = new async.TaskSequentializer();
      let pendingDone = false;
      sequentializer.run(1, async.timeout(1).then(() => {
        pendingDone = true;
        return;
      }));
      await sequentializer.join();
      assert.ok(pendingDone);
      assert.ok(!sequentializer.isRunning());
    });
    test("join (with executing and queued)", async function() {
      const sequentializer = new async.TaskSequentializer();
      let pendingDone = false;
      sequentializer.run(1, async.timeout(1).then(() => {
        pendingDone = true;
        return;
      }));
      let queuedDone = false;
      sequentializer.queue(() => async.timeout(1).then(() => {
        queuedDone = true;
        return;
      }));
      await sequentializer.join();
      assert.ok(pendingDone);
      assert.ok(queuedDone);
      assert.ok(!sequentializer.isRunning());
      assert.ok(!sequentializer.hasQueued());
    });
    test("executing and multiple queued (last one wins)", async function() {
      const sequentializer = new async.TaskSequentializer();
      let pendingDone = false;
      sequentializer.run(1, async.timeout(1).then(() => {
        pendingDone = true;
        return;
      }));
      let firstDone = false;
      const firstRes = sequentializer.queue(() => async.timeout(2).then(() => {
        firstDone = true;
        return;
      }));
      let secondDone = false;
      const secondRes = sequentializer.queue(() => async.timeout(3).then(() => {
        secondDone = true;
        return;
      }));
      let thirdDone = false;
      const thirdRes = sequentializer.queue(() => async.timeout(4).then(() => {
        thirdDone = true;
        return;
      }));
      await Promise.all([firstRes, secondRes, thirdRes]);
      assert.ok(pendingDone);
      assert.ok(!firstDone);
      assert.ok(!secondDone);
      assert.ok(thirdDone);
    });
    test("cancel executing", async function() {
      const sequentializer = new async.TaskSequentializer();
      const ctsTimeout = store.add(new CancellationTokenSource());
      let pendingCancelled = false;
      const timeout = async.timeout(1, ctsTimeout.token);
      sequentializer.run(1, timeout, () => pendingCancelled = true);
      sequentializer.cancelRunning();
      assert.ok(pendingCancelled);
      ctsTimeout.cancel();
    });
  });
  suite("disposableTimeout", () => {
    test("handler only success", async () => {
      let cb = false;
      const t = async.disposableTimeout(() => cb = true);
      await async.timeout(0);
      assert.strictEqual(cb, true);
      t.dispose();
    });
    test("handler only cancel", async () => {
      let cb = false;
      const t = async.disposableTimeout(() => cb = true);
      t.dispose();
      await async.timeout(0);
      assert.strictEqual(cb, false);
    });
    test("store managed success", async () => {
      let cb = false;
      const s = new DisposableStore();
      async.disposableTimeout(() => cb = true, 0, s);
      await async.timeout(0);
      assert.strictEqual(cb, true);
      s.dispose();
    });
    test("store managed cancel via disposable", async () => {
      let cb = false;
      const s = new DisposableStore();
      const t = async.disposableTimeout(() => cb = true, 0, s);
      t.dispose();
      await async.timeout(0);
      assert.strictEqual(cb, false);
      s.dispose();
    });
    test("store managed cancel via store", async () => {
      let cb = false;
      const s = new DisposableStore();
      async.disposableTimeout(() => cb = true, 0, s);
      s.dispose();
      await async.timeout(0);
      assert.strictEqual(cb, false);
    });
  });
  test("raceCancellation", async () => {
    const cts = store.add(new CancellationTokenSource());
    const ctsTimeout = store.add(new CancellationTokenSource());
    let triggered = false;
    const timeout = async.timeout(100, ctsTimeout.token);
    const p = async.raceCancellation(timeout.then(() => triggered = true), cts.token);
    cts.cancel();
    await p;
    assert.ok(!triggered);
    ctsTimeout.cancel();
  });
  test("raceTimeout", async () => {
    const cts = store.add(new CancellationTokenSource());
    let timedout = false;
    let triggered = false;
    const ctsTimeout1 = store.add(new CancellationTokenSource());
    const timeout1 = async.timeout(100, ctsTimeout1.token);
    const p1 = async.raceTimeout(timeout1.then(() => triggered = true), 1, () => timedout = true);
    cts.cancel();
    await p1;
    assert.ok(!triggered);
    assert.strictEqual(timedout, true);
    ctsTimeout1.cancel();
    timedout = false;
    const ctsTimeout2 = store.add(new CancellationTokenSource());
    const timeout2 = async.timeout(1, ctsTimeout2.token);
    const p2 = async.raceTimeout(timeout2.then(() => triggered = true), 100, () => timedout = true);
    cts.cancel();
    await p2;
    assert.ok(triggered);
    assert.strictEqual(timedout, false);
    ctsTimeout2.cancel();
  });
  test("SequencerByKey", async () => {
    const s = new async.SequencerByKey();
    const r1 = await s.queue("key1", () => Promise.resolve("hello"));
    assert.strictEqual(r1, "hello");
    await s.queue("key2", () => Promise.reject(new Error("failed"))).then(() => {
      throw new Error("should not be resolved");
    }, (err) => {
      assert.strictEqual(err.message, "failed");
    });
    const r3 = await s.queue("key2", () => Promise.resolve("hello"));
    assert.strictEqual(r3, "hello");
  });
  test("IntervalCounter", async () => {
    let now = 0;
    const counter = new async.IntervalCounter(5, () => now);
    assert.strictEqual(counter.increment(), 1);
    assert.strictEqual(counter.increment(), 2);
    assert.strictEqual(counter.increment(), 3);
    now = 10;
    assert.strictEqual(counter.increment(), 1);
    assert.strictEqual(counter.increment(), 2);
    assert.strictEqual(counter.increment(), 3);
  });
  suite("firstParallel", () => {
    test("simple", async () => {
      const a = await async.firstParallel([
        Promise.resolve(1),
        Promise.resolve(2),
        Promise.resolve(3)
      ], (v) => v === 2);
      assert.strictEqual(a, 2);
    });
    test("uses null default", async () => {
      assert.strictEqual(await async.firstParallel([Promise.resolve(1)], (v) => v === 2), null);
    });
    test("uses value default", async () => {
      assert.strictEqual(await async.firstParallel([Promise.resolve(1)], (v) => v === 2, 4), 4);
    });
    test("empty", async () => {
      assert.strictEqual(await async.firstParallel([], (v) => v === 2, 4), 4);
    });
    test("cancels", async () => {
      let ct1;
      const p1 = async.createCancelablePromise(async (ct) => {
        ct1 = ct;
        await async.timeout(200, ct);
        return 1;
      });
      let ct2;
      const p2 = async.createCancelablePromise(async (ct) => {
        ct2 = ct;
        await async.timeout(2, ct);
        return 2;
      });
      assert.strictEqual(await async.firstParallel([p1, p2], (v) => v === 2, 4), 2);
      assert.strictEqual(ct1.isCancellationRequested, true, "should cancel a");
      assert.strictEqual(ct2.isCancellationRequested, true, "should cancel b");
    });
    test("rejection handling", async () => {
      let ct1;
      const p1 = async.createCancelablePromise(async (ct) => {
        ct1 = ct;
        await async.timeout(200, ct);
        return 1;
      });
      let ct2;
      const p2 = async.createCancelablePromise(async (ct) => {
        ct2 = ct;
        await async.timeout(2, ct);
        throw new Error("oh no");
      });
      assert.strictEqual(await async.firstParallel([p1, p2], (v) => v === 2, 4).catch(() => "ok"), "ok");
      assert.strictEqual(ct1.isCancellationRequested, true, "should cancel a");
      assert.strictEqual(ct2.isCancellationRequested, true, "should cancel b");
    });
  });
  suite("DeferredPromise", () => {
    test("resolves", async () => {
      const deferred = new async.DeferredPromise();
      assert.strictEqual(deferred.isResolved, false);
      deferred.complete(42);
      assert.strictEqual(await deferred.p, 42);
      assert.strictEqual(deferred.isResolved, true);
    });
    test("rejects", async () => {
      const deferred = new async.DeferredPromise();
      assert.strictEqual(deferred.isRejected, false);
      const err = new Error("oh no!");
      deferred.error(err);
      assert.strictEqual(await deferred.p.catch((e) => e), err);
      assert.strictEqual(deferred.isRejected, true);
    });
    test("cancels", async () => {
      const deferred = new async.DeferredPromise();
      assert.strictEqual(deferred.isRejected, false);
      deferred.cancel();
      assert.strictEqual((await deferred.p.catch((e) => e)).name, "Canceled");
      assert.strictEqual(deferred.isRejected, true);
    });
  });
  suite("Promises.settled", () => {
    test("resolves", async () => {
      const p1 = Promise.resolve(1);
      const p2 = async.timeout(1).then(() => 2);
      const p3 = async.timeout(2).then(() => 3);
      const result = await async.Promises.settled([p1, p2, p3]);
      assert.strictEqual(result.length, 3);
      assert.deepStrictEqual(result[0], 1);
      assert.deepStrictEqual(result[1], 2);
      assert.deepStrictEqual(result[2], 3);
    });
    test("resolves in order", async () => {
      const p1 = async.timeout(2).then(() => 1);
      const p2 = async.timeout(1).then(() => 2);
      const p3 = Promise.resolve(3);
      const result = await async.Promises.settled([p1, p2, p3]);
      assert.strictEqual(result.length, 3);
      assert.deepStrictEqual(result[0], 1);
      assert.deepStrictEqual(result[1], 2);
      assert.deepStrictEqual(result[2], 3);
    });
    test("rejects with first error but handles all promises (all errors)", async () => {
      const p1 = Promise.reject(1);
      let p2Handled = false;
      const p2Error = new Error("2");
      const p2 = async.timeout(1).then(() => {
        p2Handled = true;
        throw p2Error;
      });
      let p3Handled = false;
      const p3Error = new Error("3");
      const p3 = async.timeout(2).then(() => {
        p3Handled = true;
        throw p3Error;
      });
      let error = void 0;
      try {
        await async.Promises.settled([p1, p2, p3]);
      } catch (e) {
        error = e;
      }
      assert.ok(error);
      assert.notStrictEqual(error, p2Error);
      assert.notStrictEqual(error, p3Error);
      assert.ok(p2Handled);
      assert.ok(p3Handled);
    });
    test("rejects with first error but handles all promises (1 error)", async () => {
      const p1 = Promise.resolve(1);
      let p2Handled = false;
      const p2Error = new Error("2");
      const p2 = async.timeout(1).then(() => {
        p2Handled = true;
        throw p2Error;
      });
      let p3Handled = false;
      const p3 = async.timeout(2).then(() => {
        p3Handled = true;
        return 3;
      });
      let error = void 0;
      try {
        await async.Promises.settled([p1, p2, p3]);
      } catch (e) {
        error = e;
      }
      assert.strictEqual(error, p2Error);
      assert.ok(p2Handled);
      assert.ok(p3Handled);
    });
  });
  suite("Promises.withAsyncBody", () => {
    test("basics", async () => {
      const p1 = async.Promises.withAsyncBody(async (resolve, reject) => {
        resolve(1);
      });
      const p2 = async.Promises.withAsyncBody(async (resolve, reject) => {
        reject(new Error("error"));
      });
      const p3 = async.Promises.withAsyncBody(async (resolve, reject) => {
        throw new Error("error");
      });
      const r1 = await p1;
      assert.strictEqual(r1, 1);
      let e2 = void 0;
      try {
        await p2;
      } catch (error) {
        e2 = error;
      }
      assert.ok(e2 instanceof Error);
      let e3 = void 0;
      try {
        await p3;
      } catch (error) {
        e3 = error;
      }
      assert.ok(e3 instanceof Error);
    });
  });
  suite("ThrottledWorker", () => {
    function assertArrayEquals(actual, expected) {
      assert.strictEqual(actual.length, expected.length);
      for (let i = 0; i < actual.length; i++) {
        assert.strictEqual(actual[i], expected[i]);
      }
    }
    test("basics", async () => {
      let handled = [];
      let handledCallback;
      let handledPromise = new Promise((resolve) => handledCallback = resolve);
      let handledCounterToResolve = 1;
      let currentHandledCounter = 0;
      const handler = (units) => {
        handled.push(...units);
        currentHandledCounter++;
        if (currentHandledCounter === handledCounterToResolve) {
          handledCallback();
          handledPromise = new Promise((resolve) => handledCallback = resolve);
          currentHandledCounter = 0;
        }
      };
      const worker = store.add(new async.ThrottledWorker({
        maxWorkChunkSize: 5,
        maxBufferedWork: void 0,
        throttleDelay: 1
      }, handler));
      let worked = worker.work([1, 2, 3]);
      assertArrayEquals(handled, [1, 2, 3]);
      assert.strictEqual(worker.pending, 0);
      assert.strictEqual(worked, true);
      worker.work([4, 5]);
      worked = worker.work([6]);
      assertArrayEquals(handled, [1, 2, 3, 4, 5, 6]);
      assert.strictEqual(worker.pending, 0);
      assert.strictEqual(worked, true);
      handled = [];
      handledCounterToResolve = 2;
      worked = worker.work([1, 2, 3, 4, 5, 6, 7]);
      assertArrayEquals(handled, [1, 2, 3, 4, 5]);
      assert.strictEqual(worker.pending, 2);
      assert.strictEqual(worked, true);
      await handledPromise;
      assertArrayEquals(handled, [1, 2, 3, 4, 5, 6, 7]);
      handled = [];
      handledCounterToResolve = 4;
      worked = worker.work([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
      assertArrayEquals(handled, [1, 2, 3, 4, 5]);
      assert.strictEqual(worker.pending, 14);
      assert.strictEqual(worked, true);
      await handledPromise;
      assertArrayEquals(handled, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
      handled = [];
      handledCounterToResolve = 2;
      worked = worker.work([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      assertArrayEquals(handled, [1, 2, 3, 4, 5]);
      assert.strictEqual(worker.pending, 5);
      assert.strictEqual(worked, true);
      await handledPromise;
      assertArrayEquals(handled, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      handled = [];
      handledCounterToResolve = 3;
      worked = worker.work([1, 2, 3, 4, 5, 6, 7]);
      assertArrayEquals(handled, [1, 2, 3, 4, 5]);
      assert.strictEqual(worker.pending, 2);
      assert.strictEqual(worked, true);
      worker.work([8]);
      worked = worker.work([9, 10, 11]);
      assertArrayEquals(handled, [1, 2, 3, 4, 5]);
      assert.strictEqual(worker.pending, 6);
      assert.strictEqual(worked, true);
      await handledPromise;
      assertArrayEquals(handled, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      assert.strictEqual(worker.pending, 0);
      handled = [];
      handledCounterToResolve = 2;
      worked = worker.work([1, 2, 3, 4, 5, 6, 7]);
      assertArrayEquals(handled, [1, 2, 3, 4, 5]);
      assert.strictEqual(worked, true);
      worker.work([8]);
      worked = worker.work([9, 10]);
      assertArrayEquals(handled, [1, 2, 3, 4, 5]);
      assert.strictEqual(worked, true);
      await handledPromise;
      assertArrayEquals(handled, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
    test("do not accept too much work", async () => {
      const handled = [];
      const handler = (units) => handled.push(...units);
      const worker = store.add(new async.ThrottledWorker({
        maxWorkChunkSize: 5,
        maxBufferedWork: 5,
        throttleDelay: 1
      }, handler));
      let worked = worker.work([1, 2, 3]);
      assert.strictEqual(worked, true);
      worked = worker.work([1, 2, 3, 4, 5, 6]);
      assert.strictEqual(worked, true);
      assert.strictEqual(worker.pending, 1);
      worked = worker.work([7]);
      assert.strictEqual(worked, true);
      assert.strictEqual(worker.pending, 2);
      worked = worker.work([8, 9, 10, 11]);
      assert.strictEqual(worked, false);
      assert.strictEqual(worker.pending, 2);
    });
    test("do not accept too much work (account for max chunk size", async () => {
      const handled = [];
      const handler = (units) => handled.push(...units);
      const worker = store.add(new async.ThrottledWorker({
        maxWorkChunkSize: 5,
        maxBufferedWork: 5,
        throttleDelay: 1
      }, handler));
      let worked = worker.work([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      assert.strictEqual(worked, false);
      assert.strictEqual(worker.pending, 0);
      worked = worker.work([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      assert.strictEqual(worked, true);
      assert.strictEqual(worker.pending, 5);
    });
    test("disposed", async () => {
      const handled = [];
      const handler = (units) => handled.push(...units);
      const worker = store.add(new async.ThrottledWorker({
        maxWorkChunkSize: 5,
        maxBufferedWork: void 0,
        throttleDelay: 1
      }, handler));
      worker.dispose();
      const worked = worker.work([1, 2, 3]);
      assertArrayEquals(handled, []);
      assert.strictEqual(worker.pending, 0);
      assert.strictEqual(worked, false);
    });
  });
  suite("LimitedQueue", () => {
    test("basics (with long running task)", async () => {
      const limitedQueue = new async.LimitedQueue();
      let counter = 0;
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(limitedQueue.queue(async () => {
          counter = i;
          await async.timeout(1);
        }));
      }
      await Promise.all(promises);
      assert.strictEqual(counter, 4);
    });
    test("basics (with sync running task)", async () => {
      const limitedQueue = new async.LimitedQueue();
      let counter = 0;
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(limitedQueue.queue(async () => {
          counter = i;
        }));
      }
      await Promise.all(promises);
      assert.strictEqual(counter, 4);
    });
  });
  suite("AsyncIterableObject", function() {
    test("onReturn NOT called", async function() {
      let calledOnReturn = false;
      const iter = new async.AsyncIterableObject((writer) => {
        writer.emitMany([1, 2, 3, 4, 5]);
      }, () => {
        calledOnReturn = true;
      });
      for await (const item of iter) {
        assert.strictEqual(typeof item, "number");
      }
      assert.strictEqual(calledOnReturn, false);
    });
    test("onReturn called on break", async function() {
      let calledOnReturn = false;
      const iter = new async.AsyncIterableObject((writer) => {
        writer.emitMany([1, 2, 3, 4, 5]);
      }, () => {
        calledOnReturn = true;
      });
      for await (const item of iter) {
        assert.strictEqual(item, 1);
        break;
      }
      assert.strictEqual(calledOnReturn, true);
    });
    test("onReturn called on return", async function() {
      let calledOnReturn = false;
      const iter = new async.AsyncIterableObject((writer) => {
        writer.emitMany([1, 2, 3, 4, 5]);
      }, () => {
        calledOnReturn = true;
      });
      await async function test2() {
        for await (const item of iter) {
          assert.strictEqual(item, 1);
          return;
        }
      }();
      assert.strictEqual(calledOnReturn, true);
    });
    test("onReturn called on throwing", async function() {
      let calledOnReturn = false;
      const iter = new async.AsyncIterableObject((writer) => {
        writer.emitMany([1, 2, 3, 4, 5]);
      }, () => {
        calledOnReturn = true;
      });
      try {
        for await (const item of iter) {
          assert.strictEqual(item, 1);
          throw new Error();
        }
      } catch (e) {
      }
      assert.strictEqual(calledOnReturn, true);
    });
  });
  suite("AsyncIterableSource", function() {
    test("onReturn is wired up", async function() {
      let calledOnReturn = false;
      const source = new async.AsyncIterableSource(() => {
        calledOnReturn = true;
      });
      source.emitOne(1);
      source.emitOne(2);
      source.emitOne(3);
      source.resolve();
      for await (const item of source.asyncIterable) {
        assert.strictEqual(item, 1);
        break;
      }
      assert.strictEqual(calledOnReturn, true);
    });
    test("onReturn is wired up 2", async function() {
      let calledOnReturn = false;
      const source = new async.AsyncIterableSource(() => {
        calledOnReturn = true;
      });
      source.emitOne(1);
      source.emitOne(2);
      source.emitOne(3);
      source.resolve();
      for await (const item of source.asyncIterable) {
        assert.strictEqual(typeof item, "number");
      }
      assert.strictEqual(calledOnReturn, false);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvY29tbW9uL2FzeW5jLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgKiBhcyBhc3luYyBmcm9tICcuLi8uLi9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0ICogYXMgTWljcm90YXNrRGVsYXkgZnJvbSBcIi4uLy4uL2NvbW1vbi9zeW1ib2xzLmpzXCI7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IGlzQ2FuY2VsbGF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgcnVuV2l0aEZha2VkVGltZXJzIH0gZnJvbSAnLi90aW1lVHJhdmVsU2NoZWR1bGVyLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4vdXRpbHMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5cbnN1aXRlKCdBc3luYycsICgpID0+IHtcblxuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHN1aXRlKCdjYW5jZWxhYmxlUHJvbWlzZScsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0KCdzZXQgdG9rZW4sIGRvblxcJ3Qgd2FpdCBmb3IgaW5uZXIgcHJvbWlzZScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdGxldCBjYW5jZWxlZCA9IDA7XG5cdFx0XHRjb25zdCBwcm9taXNlID0gYXN5bmMuY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UodG9rZW4gPT4ge1xuXHRcdFx0XHRzdG9yZS5hZGQodG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoXyA9PiB7IGNhbmNlbGVkICs9IDE7IH0pKTtcblx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4geyAvKm5ldmVyKi8gfSk7XG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IHByb21pc2UudGhlbihfID0+IGFzc2VydC5vayhmYWxzZSksIGVyciA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYW5jZWxlZCwgMSk7XG5cdFx0XHRcdGFzc2VydC5vayhpc0NhbmNlbGxhdGlvbkVycm9yKGVycikpO1xuXHRcdFx0fSk7XG5cdFx0XHRwcm9taXNlLmNhbmNlbCgpO1xuXHRcdFx0cHJvbWlzZS5jYW5jZWwoKTsgLy8gY2FuY2VsIG9ubHkgb25jZVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2NhbmNlbCBkZXNwaXRlIGlubmVyIHByb21pc2UgYmVpbmcgcmVzb2x2ZWQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRsZXQgY2FuY2VsZWQgPSAwO1xuXHRcdFx0Y29uc3QgcHJvbWlzZSA9IGFzeW5jLmNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKHRva2VuID0+IHtcblx0XHRcdFx0c3RvcmUuYWRkKHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKF8gPT4geyBjYW5jZWxlZCArPSAxOyB9KSk7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoMTIzNCk7XG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IHByb21pc2UudGhlbihfID0+IGFzc2VydC5vayhmYWxzZSksIGVyciA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYW5jZWxlZCwgMSk7XG5cdFx0XHRcdGFzc2VydC5vayhpc0NhbmNlbGxhdGlvbkVycm9yKGVycikpO1xuXHRcdFx0fSk7XG5cdFx0XHRwcm9taXNlLmNhbmNlbCgpO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9KTtcblxuXHRcdC8vIENhbmNlbGxpbmcgYSBzeW5jIGNhbmNlbGFibGUgcHJvbWlzZSB3aWxsIGZpcmUgdGhlIGNhbmNlbGxlZCB0b2tlbi5cblx0XHQvLyBBbHNvLCBldmVyeSBgdGhlbmAgY2FsbGJhY2sgcnVucyBpbiBhbm90aGVyIGV4ZWN1dGlvbiBmcmFtZS5cblx0XHR0ZXN0KCdleGVjdXRpb24gb3JkZXIgKHN5bmMpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3Qgb3JkZXI6IHN0cmluZ1tdID0gW107XG5cblx0XHRcdGNvbnN0IGNhbmNlbGxhYmxlUHJvbWlzZSA9IGFzeW5jLmNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKHRva2VuID0+IHtcblx0XHRcdFx0b3JkZXIucHVzaCgnaW4gY2FsbGJhY2snKTtcblx0XHRcdFx0c3RvcmUuYWRkKHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKF8gPT4gb3JkZXIucHVzaCgnY2FuY2VsbGVkJykpKTtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgxMjM0KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRvcmRlci5wdXNoKCdhZnRlckNyZWF0ZScpO1xuXG5cdFx0XHRjb25zdCBwcm9taXNlID0gY2FuY2VsbGFibGVQcm9taXNlXG5cdFx0XHRcdC50aGVuKHVuZGVmaW5lZCwgZXJyID0+IG51bGwpXG5cdFx0XHRcdC50aGVuKCgpID0+IG9yZGVyLnB1c2goJ2ZpbmFsbHknKSk7XG5cblx0XHRcdGNhbmNlbGxhYmxlUHJvbWlzZS5jYW5jZWwoKTtcblx0XHRcdG9yZGVyLnB1c2goJ2FmdGVyQ2FuY2VsJyk7XG5cblx0XHRcdHJldHVybiBwcm9taXNlLnRoZW4oKCkgPT4gYXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChvcmRlciwgWydpbiBjYWxsYmFjaycsICdhZnRlckNyZWF0ZScsICdjYW5jZWxsZWQnLCAnYWZ0ZXJDYW5jZWwnLCAnZmluYWxseSddKSk7XG5cdFx0fSk7XG5cblx0XHQvLyBDYW5jZWxsaW5nIGFuIGFzeW5jIGNhbmNlbGFibGUgcHJvbWlzZSBpcyBqdXN0IHRoZSBzYW1lIGFzIGEgc3luYyBjYW5jZWxsYWJsZSBwcm9taXNlLlxuXHRcdHRlc3QoJ2V4ZWN1dGlvbiBvcmRlciAoYXN5bmMpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3Qgb3JkZXI6IHN0cmluZ1tdID0gW107XG5cblx0XHRcdGNvbnN0IGNhbmNlbGxhYmxlUHJvbWlzZSA9IGFzeW5jLmNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKHRva2VuID0+IHtcblx0XHRcdFx0b3JkZXIucHVzaCgnaW4gY2FsbGJhY2snKTtcblx0XHRcdFx0c3RvcmUuYWRkKHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKF8gPT4gb3JkZXIucHVzaCgnY2FuY2VsbGVkJykpKTtcblx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKGMgPT4gc2V0VGltZW91dChjLmJpbmQoMTIzNCksIDApKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRvcmRlci5wdXNoKCdhZnRlckNyZWF0ZScpO1xuXG5cdFx0XHRjb25zdCBwcm9taXNlID0gY2FuY2VsbGFibGVQcm9taXNlXG5cdFx0XHRcdC50aGVuKHVuZGVmaW5lZCwgZXJyID0+IG51bGwpXG5cdFx0XHRcdC50aGVuKCgpID0+IG9yZGVyLnB1c2goJ2ZpbmFsbHknKSk7XG5cblx0XHRcdGNhbmNlbGxhYmxlUHJvbWlzZS5jYW5jZWwoKTtcblx0XHRcdG9yZGVyLnB1c2goJ2FmdGVyQ2FuY2VsJyk7XG5cblx0XHRcdHJldHVybiBwcm9taXNlLnRoZW4oKCkgPT4gYXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChvcmRlciwgWydpbiBjYWxsYmFjaycsICdhZnRlckNyZWF0ZScsICdjYW5jZWxsZWQnLCAnYWZ0ZXJDYW5jZWwnLCAnZmluYWxseSddKSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdleGVjdXRpb24gb3JkZXIgKGFzeW5jIHdpdGggbGF0ZSBsaXN0ZW5lciknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBvcmRlcjogc3RyaW5nW10gPSBbXTtcblxuXHRcdFx0Y29uc3QgY2FuY2VsbGFibGVQcm9taXNlID0gYXN5bmMuY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UoYXN5bmMgdG9rZW4gPT4ge1xuXHRcdFx0XHRvcmRlci5wdXNoKCdpbiBjYWxsYmFjaycpO1xuXG5cdFx0XHRcdGF3YWl0IGFzeW5jLnRpbWVvdXQoMCk7XG5cdFx0XHRcdHN0b3JlLmFkZCh0b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZChfID0+IG9yZGVyLnB1c2goJ2NhbmNlbGxlZCcpKSk7XG5cdFx0XHRcdGNhbmNlbGxhYmxlUHJvbWlzZS5jYW5jZWwoKTtcblx0XHRcdFx0b3JkZXIucHVzaCgnYWZ0ZXJDYW5jZWwnKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRvcmRlci5wdXNoKCdhZnRlckNyZWF0ZScpO1xuXG5cdFx0XHRjb25zdCBwcm9taXNlID0gY2FuY2VsbGFibGVQcm9taXNlXG5cdFx0XHRcdC50aGVuKHVuZGVmaW5lZCwgZXJyID0+IG51bGwpXG5cdFx0XHRcdC50aGVuKCgpID0+IG9yZGVyLnB1c2goJ2ZpbmFsbHknKSk7XG5cblx0XHRcdHJldHVybiBwcm9taXNlLnRoZW4oKCkgPT4gYXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChvcmRlciwgWydpbiBjYWxsYmFjaycsICdhZnRlckNyZWF0ZScsICdjYW5jZWxsZWQnLCAnYWZ0ZXJDYW5jZWwnLCAnZmluYWxseSddKSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdnZXQgaW5uZXIgcmVzdWx0JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3QgcHJvbWlzZSA9IGFzeW5jLmNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKHRva2VuID0+IHtcblx0XHRcdFx0cmV0dXJuIGFzeW5jLnRpbWVvdXQoMTIpLnRoZW4oXyA9PiAxMjM0KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBwcm9taXNlO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgMTIzNCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdUaHJvdHRsZXInLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdCgnbm9uIGFzeW5jJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0bGV0IGNvdW50ID0gMDtcblx0XHRcdGNvbnN0IGZhY3RvcnkgPSAoKSA9PiB7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKytjb3VudCk7XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCB0aHJvdHRsZXIgPSBuZXcgYXN5bmMuVGhyb3R0bGVyKCk7XG5cblx0XHRcdHJldHVybiBQcm9taXNlLmFsbChbXG5cdFx0XHRcdHRocm90dGxlci5xdWV1ZShmYWN0b3J5KS50aGVuKChyZXN1bHQpID0+IHsgYXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgMSk7IH0pLFxuXHRcdFx0XHR0aHJvdHRsZXIucXVldWUoZmFjdG9yeSkudGhlbigocmVzdWx0KSA9PiB7IGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsIDIpOyB9KSxcblx0XHRcdFx0dGhyb3R0bGVyLnF1ZXVlKGZhY3RvcnkpLnRoZW4oKHJlc3VsdCkgPT4geyBhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAyKTsgfSksXG5cdFx0XHRcdHRocm90dGxlci5xdWV1ZShmYWN0b3J5KS50aGVuKChyZXN1bHQpID0+IHsgYXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgMik7IH0pLFxuXHRcdFx0XHR0aHJvdHRsZXIucXVldWUoZmFjdG9yeSkudGhlbigocmVzdWx0KSA9PiB7IGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsIDIpOyB9KVxuXHRcdFx0XSkudGhlbigoKSA9PiBhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDIpKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2FzeW5jJywgKCkgPT4ge1xuXHRcdFx0bGV0IGNvdW50ID0gMDtcblx0XHRcdGNvbnN0IGZhY3RvcnkgPSAoKSA9PiBhc3luYy50aW1lb3V0KDApLnRoZW4oKCkgPT4gKytjb3VudCk7XG5cblx0XHRcdGNvbnN0IHRocm90dGxlciA9IG5ldyBhc3luYy5UaHJvdHRsZXIoKTtcblxuXHRcdFx0cmV0dXJuIFByb21pc2UuYWxsKFtcblx0XHRcdFx0dGhyb3R0bGVyLnF1ZXVlKGZhY3RvcnkpLnRoZW4oKHJlc3VsdCkgPT4geyBhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAxKTsgfSksXG5cdFx0XHRcdHRocm90dGxlci5xdWV1ZShmYWN0b3J5KS50aGVuKChyZXN1bHQpID0+IHsgYXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgMik7IH0pLFxuXHRcdFx0XHR0aHJvdHRsZXIucXVldWUoZmFjdG9yeSkudGhlbigocmVzdWx0KSA9PiB7IGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsIDIpOyB9KSxcblx0XHRcdFx0dGhyb3R0bGVyLnF1ZXVlKGZhY3RvcnkpLnRoZW4oKHJlc3VsdCkgPT4geyBhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAyKTsgfSksXG5cdFx0XHRcdHRocm90dGxlci5xdWV1ZShmYWN0b3J5KS50aGVuKChyZXN1bHQpID0+IHsgYXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgMik7IH0pXG5cdFx0XHRdKS50aGVuKCgpID0+IHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UuYWxsKFtcblx0XHRcdFx0XHR0aHJvdHRsZXIucXVldWUoZmFjdG9yeSkudGhlbigocmVzdWx0KSA9PiB7IGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsIDMpOyB9KSxcblx0XHRcdFx0XHR0aHJvdHRsZXIucXVldWUoZmFjdG9yeSkudGhlbigocmVzdWx0KSA9PiB7IGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsIDQpOyB9KSxcblx0XHRcdFx0XHR0aHJvdHRsZXIucXVldWUoZmFjdG9yeSkudGhlbigocmVzdWx0KSA9PiB7IGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsIDQpOyB9KSxcblx0XHRcdFx0XHR0aHJvdHRsZXIucXVldWUoZmFjdG9yeSkudGhlbigocmVzdWx0KSA9PiB7IGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsIDQpOyB9KSxcblx0XHRcdFx0XHR0aHJvdHRsZXIucXVldWUoZmFjdG9yeSkudGhlbigocmVzdWx0KSA9PiB7IGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsIDQpOyB9KVxuXHRcdFx0XHRdKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnbGFzdCBmYWN0b3J5IHNob3VsZCBiZSB0aGUgb25lIGdldHRpbmcgY2FsbGVkJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3QgZmFjdG9yeUZhY3RvcnkgPSAobjogbnVtYmVyKSA9PiAoKSA9PiB7XG5cdFx0XHRcdHJldHVybiBhc3luYy50aW1lb3V0KDApLnRoZW4oKCkgPT4gbik7XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCB0aHJvdHRsZXIgPSBuZXcgYXN5bmMuVGhyb3R0bGVyKCk7XG5cblx0XHRcdGNvbnN0IHByb21pc2VzOiBQcm9taXNlPGFueT5bXSA9IFtdO1xuXG5cdFx0XHRwcm9taXNlcy5wdXNoKHRocm90dGxlci5xdWV1ZShmYWN0b3J5RmFjdG9yeSgxKSkudGhlbigobikgPT4geyBhc3NlcnQuc3RyaWN0RXF1YWwobiwgMSk7IH0pKTtcblx0XHRcdHByb21pc2VzLnB1c2godGhyb3R0bGVyLnF1ZXVlKGZhY3RvcnlGYWN0b3J5KDIpKS50aGVuKChuKSA9PiB7IGFzc2VydC5zdHJpY3RFcXVhbChuLCAzKTsgfSkpO1xuXHRcdFx0cHJvbWlzZXMucHVzaCh0aHJvdHRsZXIucXVldWUoZmFjdG9yeUZhY3RvcnkoMykpLnRoZW4oKG4pID0+IHsgYXNzZXJ0LnN0cmljdEVxdWFsKG4sIDMpOyB9KSk7XG5cblx0XHRcdHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdkaXNwb3NhbCBhZnRlciBxdWV1ZWluZycsIGFzeW5jICgpID0+IHtcblx0XHRcdGxldCBmYWN0b3J5Q2FsbHMgPSAwO1xuXHRcdFx0Y29uc3QgZmFjdG9yeSA9IGFzeW5jICgpID0+IHtcblx0XHRcdFx0ZmFjdG9yeUNhbGxzKys7XG5cdFx0XHRcdHJldHVybiBhc3luYy50aW1lb3V0KDApO1xuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgdGhyb3R0bGVyID0gbmV3IGFzeW5jLlRocm90dGxlcigpO1xuXHRcdFx0Y29uc3QgcHJvbWlzZXM6IFByb21pc2U8YW55PltdID0gW107XG5cblx0XHRcdHByb21pc2VzLnB1c2godGhyb3R0bGVyLnF1ZXVlKGZhY3RvcnkpKTtcblx0XHRcdHByb21pc2VzLnB1c2godGhyb3R0bGVyLnF1ZXVlKGZhY3RvcnkpKTtcblx0XHRcdHRocm90dGxlci5kaXNwb3NlKCk7XG5cblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmYWN0b3J5Q2FsbHMsIDEpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZGlzcG9zYWwgYmVmb3JlIHF1ZXVlaW5nJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0bGV0IGZhY3RvcnlDYWxscyA9IDA7XG5cdFx0XHRjb25zdCBmYWN0b3J5ID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRmYWN0b3J5Q2FsbHMrKztcblx0XHRcdFx0cmV0dXJuIGFzeW5jLnRpbWVvdXQoMCk7XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCB0aHJvdHRsZXIgPSBuZXcgYXN5bmMuVGhyb3R0bGVyKCk7XG5cdFx0XHRjb25zdCBwcm9taXNlczogUHJvbWlzZTxhbnk+W10gPSBbXTtcblxuXHRcdFx0dGhyb3R0bGVyLmRpc3Bvc2UoKTtcblx0XHRcdHByb21pc2VzLnB1c2godGhyb3R0bGVyLnF1ZXVlKGZhY3RvcnkpKTtcblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuXHRcdFx0XHRhc3NlcnQuZmFpbCgnc2hvdWxkIGZhaWwnKTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmFjdG9yeUNhbGxzLCAwKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ0RlbGF5ZXInLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdCgnc2ltcGxlJywgKCkgPT4ge1xuXHRcdFx0bGV0IGNvdW50ID0gMDtcblx0XHRcdGNvbnN0IGZhY3RvcnkgPSAoKSA9PiB7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKytjb3VudCk7XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBkZWxheWVyID0gbmV3IGFzeW5jLkRlbGF5ZXIoMCk7XG5cdFx0XHRjb25zdCBwcm9taXNlczogUHJvbWlzZTxhbnk+W10gPSBbXTtcblxuXHRcdFx0YXNzZXJ0KCFkZWxheWVyLmlzVHJpZ2dlcmVkKCkpO1xuXG5cdFx0XHRwcm9taXNlcy5wdXNoKGRlbGF5ZXIudHJpZ2dlcihmYWN0b3J5KS50aGVuKChyZXN1bHQpID0+IHsgYXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgMSk7IGFzc2VydCghZGVsYXllci5pc1RyaWdnZXJlZCgpKTsgfSkpO1xuXHRcdFx0YXNzZXJ0KGRlbGF5ZXIuaXNUcmlnZ2VyZWQoKSk7XG5cblx0XHRcdHByb21pc2VzLnB1c2goZGVsYXllci50cmlnZ2VyKGZhY3RvcnkpLnRoZW4oKHJlc3VsdCkgPT4geyBhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAxKTsgYXNzZXJ0KCFkZWxheWVyLmlzVHJpZ2dlcmVkKCkpOyB9KSk7XG5cdFx0XHRhc3NlcnQoZGVsYXllci5pc1RyaWdnZXJlZCgpKTtcblxuXHRcdFx0cHJvbWlzZXMucHVzaChkZWxheWVyLnRyaWdnZXIoZmFjdG9yeSkudGhlbigocmVzdWx0KSA9PiB7IGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsIDEpOyBhc3NlcnQoIWRlbGF5ZXIuaXNUcmlnZ2VyZWQoKSk7IH0pKTtcblx0XHRcdGFzc2VydChkZWxheWVyLmlzVHJpZ2dlcmVkKCkpO1xuXG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5hbGwocHJvbWlzZXMpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRhc3NlcnQoIWRlbGF5ZXIuaXNUcmlnZ2VyZWQoKSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ21pY3JvdGFzayBkZWxheSBzaW1wbGUnLCAoKSA9PiB7XG5cdFx0XHRsZXQgY291bnQgPSAwO1xuXHRcdFx0Y29uc3QgZmFjdG9yeSA9ICgpID0+IHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgrK2NvdW50KTtcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IGRlbGF5ZXIgPSBuZXcgYXN5bmMuRGVsYXllcihNaWNyb3Rhc2tEZWxheS5NaWNyb3Rhc2tEZWxheSk7XG5cdFx0XHRjb25zdCBwcm9taXNlczogUHJvbWlzZTxhbnk+W10gPSBbXTtcblxuXHRcdFx0YXNzZXJ0KCFkZWxheWVyLmlzVHJpZ2dlcmVkKCkpO1xuXG5cdFx0XHRwcm9taXNlcy5wdXNoKGRlbGF5ZXIudHJpZ2dlcihmYWN0b3J5KS50aGVuKChyZXN1bHQpID0+IHsgYXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgMSk7IGFzc2VydCghZGVsYXllci5pc1RyaWdnZXJlZCgpKTsgfSkpO1xuXHRcdFx0YXNzZXJ0KGRlbGF5ZXIuaXNUcmlnZ2VyZWQoKSk7XG5cblx0XHRcdHByb21pc2VzLnB1c2goZGVsYXllci50cmlnZ2VyKGZhY3RvcnkpLnRoZW4oKHJlc3VsdCkgPT4geyBhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAxKTsgYXNzZXJ0KCFkZWxheWVyLmlzVHJpZ2dlcmVkKCkpOyB9KSk7XG5cdFx0XHRhc3NlcnQoZGVsYXllci5pc1RyaWdnZXJlZCgpKTtcblxuXHRcdFx0cHJvbWlzZXMucHVzaChkZWxheWVyLnRyaWdnZXIoZmFjdG9yeSkudGhlbigocmVzdWx0KSA9PiB7IGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsIDEpOyBhc3NlcnQoIWRlbGF5ZXIuaXNUcmlnZ2VyZWQoKSk7IH0pKTtcblx0XHRcdGFzc2VydChkZWxheWVyLmlzVHJpZ2dlcmVkKCkpO1xuXG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5hbGwocHJvbWlzZXMpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRhc3NlcnQoIWRlbGF5ZXIuaXNUcmlnZ2VyZWQoKSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHN1aXRlKCdUaHJvdHRsZWREZWxheWVyJywgKCkgPT4ge1xuXHRcdFx0dGVzdCgncHJvbWlzZSBzaG91bGQgcmVzb2x2ZSBpZiBkaXNwb3NlZCcsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgdGhyb3R0bGVkRGVsYXllciA9IG5ldyBhc3luYy5UaHJvdHRsZWREZWxheWVyPHZvaWQ+KDEwMCk7XG5cdFx0XHRcdGNvbnN0IHByb21pc2UgPSB0aHJvdHRsZWREZWxheWVyLnRyaWdnZXIoYXN5bmMgKCkgPT4geyB9LCAwKTtcblx0XHRcdFx0dGhyb3R0bGVkRGVsYXllci5kaXNwb3NlKCk7XG5cblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRhd2FpdCBwcm9taXNlO1xuXHRcdFx0XHRcdGFzc2VydC5mYWlsKCdTSE9VTEQgTk9UIEJFIEhFUkUnKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0Ly8gT0tcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ3RyaWdnZXIgYWZ0ZXIgZGlzcG9zZSB0aHJvd3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHRocm90dGxlZERlbGF5ZXIgPSBuZXcgYXN5bmMuVGhyb3R0bGVkRGVsYXllcjx2b2lkPigxMDApO1xuXHRcdFx0XHR0aHJvdHRsZWREZWxheWVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0YXdhaXQgYXNzZXJ0LnJlamVjdHMoKCkgPT4gdGhyb3R0bGVkRGVsYXllci50cmlnZ2VyKGFzeW5jICgpID0+IHsgfSwgMCkpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaW1wbGUgY2FuY2VsJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0bGV0IGNvdW50ID0gMDtcblx0XHRcdGNvbnN0IGZhY3RvcnkgPSAoKSA9PiB7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKytjb3VudCk7XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBkZWxheWVyID0gbmV3IGFzeW5jLkRlbGF5ZXIoMCk7XG5cblx0XHRcdGFzc2VydCghZGVsYXllci5pc1RyaWdnZXJlZCgpKTtcblxuXHRcdFx0Y29uc3QgcCA9IGRlbGF5ZXIudHJpZ2dlcihmYWN0b3J5KS50aGVuKCgpID0+IHtcblx0XHRcdFx0YXNzZXJ0KGZhbHNlKTtcblx0XHRcdH0sICgpID0+IHtcblx0XHRcdFx0YXNzZXJ0KHRydWUsICd5ZXMsIGl0IHdhcyBjYW5jZWxsZWQnKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQoZGVsYXllci5pc1RyaWdnZXJlZCgpKTtcblx0XHRcdGRlbGF5ZXIuY2FuY2VsKCk7XG5cdFx0XHRhc3NlcnQoIWRlbGF5ZXIuaXNUcmlnZ2VyZWQoKSk7XG5cblx0XHRcdHJldHVybiBwO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2ltcGxlIGNhbmNlbCBtaWNyb3Rhc2snLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRsZXQgY291bnQgPSAwO1xuXHRcdFx0Y29uc3QgZmFjdG9yeSA9ICgpID0+IHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgrK2NvdW50KTtcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IGRlbGF5ZXIgPSBuZXcgYXN5bmMuRGVsYXllcihNaWNyb3Rhc2tEZWxheS5NaWNyb3Rhc2tEZWxheSk7XG5cblx0XHRcdGFzc2VydCghZGVsYXllci5pc1RyaWdnZXJlZCgpKTtcblxuXHRcdFx0Y29uc3QgcCA9IGRlbGF5ZXIudHJpZ2dlcihmYWN0b3J5KS50aGVuKCgpID0+IHtcblx0XHRcdFx0YXNzZXJ0KGZhbHNlKTtcblx0XHRcdH0sICgpID0+IHtcblx0XHRcdFx0YXNzZXJ0KHRydWUsICd5ZXMsIGl0IHdhcyBjYW5jZWxsZWQnKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQoZGVsYXllci5pc1RyaWdnZXJlZCgpKTtcblx0XHRcdGRlbGF5ZXIuY2FuY2VsKCk7XG5cdFx0XHRhc3NlcnQoIWRlbGF5ZXIuaXNUcmlnZ2VyZWQoKSk7XG5cblx0XHRcdHJldHVybiBwO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnY2FuY2VsIHNob3VsZCBjYW5jZWwgYWxsIGNhbGxzIHRvIHRyaWdnZXInLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRsZXQgY291bnQgPSAwO1xuXHRcdFx0Y29uc3QgZmFjdG9yeSA9ICgpID0+IHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgrK2NvdW50KTtcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IGRlbGF5ZXIgPSBuZXcgYXN5bmMuRGVsYXllcigwKTtcblx0XHRcdGNvbnN0IHByb21pc2VzOiBQcm9taXNlPGFueT5bXSA9IFtdO1xuXG5cdFx0XHRhc3NlcnQoIWRlbGF5ZXIuaXNUcmlnZ2VyZWQoKSk7XG5cblx0XHRcdHByb21pc2VzLnB1c2goZGVsYXllci50cmlnZ2VyKGZhY3RvcnkpLnRoZW4odW5kZWZpbmVkLCAoKSA9PiB7IGFzc2VydCh0cnVlLCAneWVzLCBpdCB3YXMgY2FuY2VsbGVkJyk7IH0pKTtcblx0XHRcdGFzc2VydChkZWxheWVyLmlzVHJpZ2dlcmVkKCkpO1xuXG5cdFx0XHRwcm9taXNlcy5wdXNoKGRlbGF5ZXIudHJpZ2dlcihmYWN0b3J5KS50aGVuKHVuZGVmaW5lZCwgKCkgPT4geyBhc3NlcnQodHJ1ZSwgJ3llcywgaXQgd2FzIGNhbmNlbGxlZCcpOyB9KSk7XG5cdFx0XHRhc3NlcnQoZGVsYXllci5pc1RyaWdnZXJlZCgpKTtcblxuXHRcdFx0cHJvbWlzZXMucHVzaChkZWxheWVyLnRyaWdnZXIoZmFjdG9yeSkudGhlbih1bmRlZmluZWQsICgpID0+IHsgYXNzZXJ0KHRydWUsICd5ZXMsIGl0IHdhcyBjYW5jZWxsZWQnKTsgfSkpO1xuXHRcdFx0YXNzZXJ0KGRlbGF5ZXIuaXNUcmlnZ2VyZWQoKSk7XG5cblx0XHRcdGRlbGF5ZXIuY2FuY2VsKCk7XG5cblx0XHRcdHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbigoKSA9PiB7XG5cdFx0XHRcdGFzc2VydCghZGVsYXllci5pc1RyaWdnZXJlZCgpKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgndHJpZ2dlciwgY2FuY2VsLCB0aGVuIHRyaWdnZXIgYWdhaW4nLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRsZXQgY291bnQgPSAwO1xuXHRcdFx0Y29uc3QgZmFjdG9yeSA9ICgpID0+IHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgrK2NvdW50KTtcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IGRlbGF5ZXIgPSBuZXcgYXN5bmMuRGVsYXllcigwKTtcblx0XHRcdGxldCBwcm9taXNlczogUHJvbWlzZTxhbnk+W10gPSBbXTtcblxuXHRcdFx0YXNzZXJ0KCFkZWxheWVyLmlzVHJpZ2dlcmVkKCkpO1xuXG5cdFx0XHRjb25zdCBwID0gZGVsYXllci50cmlnZ2VyKGZhY3RvcnkpLnRoZW4oKHJlc3VsdCkgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAxKTtcblx0XHRcdFx0YXNzZXJ0KCFkZWxheWVyLmlzVHJpZ2dlcmVkKCkpO1xuXG5cdFx0XHRcdHByb21pc2VzLnB1c2goZGVsYXllci50cmlnZ2VyKGZhY3RvcnkpLnRoZW4odW5kZWZpbmVkLCAoKSA9PiB7IGFzc2VydCh0cnVlLCAneWVzLCBpdCB3YXMgY2FuY2VsbGVkJyk7IH0pKTtcblx0XHRcdFx0YXNzZXJ0KGRlbGF5ZXIuaXNUcmlnZ2VyZWQoKSk7XG5cblx0XHRcdFx0cHJvbWlzZXMucHVzaChkZWxheWVyLnRyaWdnZXIoZmFjdG9yeSkudGhlbih1bmRlZmluZWQsICgpID0+IHsgYXNzZXJ0KHRydWUsICd5ZXMsIGl0IHdhcyBjYW5jZWxsZWQnKTsgfSkpO1xuXHRcdFx0XHRhc3NlcnQoZGVsYXllci5pc1RyaWdnZXJlZCgpKTtcblxuXHRcdFx0XHRkZWxheWVyLmNhbmNlbCgpO1xuXG5cdFx0XHRcdGNvbnN0IHAgPSBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbigoKSA9PiB7XG5cdFx0XHRcdFx0cHJvbWlzZXMgPSBbXTtcblxuXHRcdFx0XHRcdGFzc2VydCghZGVsYXllci5pc1RyaWdnZXJlZCgpKTtcblxuXHRcdFx0XHRcdHByb21pc2VzLnB1c2goZGVsYXllci50cmlnZ2VyKGZhY3RvcnkpLnRoZW4oKCkgPT4geyBhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCAxKTsgYXNzZXJ0KCFkZWxheWVyLmlzVHJpZ2dlcmVkKCkpOyB9KSk7XG5cdFx0XHRcdFx0YXNzZXJ0KGRlbGF5ZXIuaXNUcmlnZ2VyZWQoKSk7XG5cblx0XHRcdFx0XHRwcm9taXNlcy5wdXNoKGRlbGF5ZXIudHJpZ2dlcihmYWN0b3J5KS50aGVuKCgpID0+IHsgYXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgMSk7IGFzc2VydCghZGVsYXllci5pc1RyaWdnZXJlZCgpKTsgfSkpO1xuXHRcdFx0XHRcdGFzc2VydChkZWxheWVyLmlzVHJpZ2dlcmVkKCkpO1xuXG5cdFx0XHRcdFx0Y29uc3QgcCA9IFByb21pc2UuYWxsKHByb21pc2VzKS50aGVuKCgpID0+IHtcblx0XHRcdFx0XHRcdGFzc2VydCghZGVsYXllci5pc1RyaWdnZXJlZCgpKTtcblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGFzc2VydChkZWxheWVyLmlzVHJpZ2dlcmVkKCkpO1xuXG5cdFx0XHRcdFx0cmV0dXJuIHA7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHJldHVybiBwO1xuXHRcdFx0fSk7XG5cblx0XHRcdGFzc2VydChkZWxheWVyLmlzVHJpZ2dlcmVkKCkpO1xuXG5cdFx0XHRyZXR1cm4gcDtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2xhc3QgdGFzayBzaG91bGQgYmUgdGhlIG9uZSBnZXR0aW5nIGNhbGxlZCcsIGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IGZhY3RvcnlGYWN0b3J5ID0gKG46IG51bWJlcikgPT4gKCkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG4pO1xuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgZGVsYXllciA9IG5ldyBhc3luYy5EZWxheWVyKDApO1xuXHRcdFx0Y29uc3QgcHJvbWlzZXM6IFByb21pc2U8YW55PltdID0gW107XG5cblx0XHRcdGFzc2VydCghZGVsYXllci5pc1RyaWdnZXJlZCgpKTtcblxuXHRcdFx0cHJvbWlzZXMucHVzaChkZWxheWVyLnRyaWdnZXIoZmFjdG9yeUZhY3RvcnkoMSkpLnRoZW4oKG4pID0+IHsgYXNzZXJ0LnN0cmljdEVxdWFsKG4sIDMpOyB9KSk7XG5cdFx0XHRwcm9taXNlcy5wdXNoKGRlbGF5ZXIudHJpZ2dlcihmYWN0b3J5RmFjdG9yeSgyKSkudGhlbigobikgPT4geyBhc3NlcnQuc3RyaWN0RXF1YWwobiwgMyk7IH0pKTtcblx0XHRcdHByb21pc2VzLnB1c2goZGVsYXllci50cmlnZ2VyKGZhY3RvcnlGYWN0b3J5KDMpKS50aGVuKChuKSA9PiB7IGFzc2VydC5zdHJpY3RFcXVhbChuLCAzKTsgfSkpO1xuXG5cdFx0XHRjb25zdCBwID0gUHJvbWlzZS5hbGwocHJvbWlzZXMpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRhc3NlcnQoIWRlbGF5ZXIuaXNUcmlnZ2VyZWQoKSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0YXNzZXJ0KGRlbGF5ZXIuaXNUcmlnZ2VyZWQoKSk7XG5cblx0XHRcdHJldHVybiBwO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnc2VxdWVuY2UnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2ltcGxlJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZmFjdG9yeUZhY3RvcnkgPSAobjogbnVtYmVyKSA9PiAoKSA9PiB7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobik7XG5cdFx0XHR9O1xuXG5cdFx0XHRyZXR1cm4gYXN5bmMuc2VxdWVuY2UoW1xuXHRcdFx0XHRmYWN0b3J5RmFjdG9yeSgxKSxcblx0XHRcdFx0ZmFjdG9yeUZhY3RvcnkoMiksXG5cdFx0XHRcdGZhY3RvcnlGYWN0b3J5KDMpLFxuXHRcdFx0XHRmYWN0b3J5RmFjdG9yeSg0KSxcblx0XHRcdFx0ZmFjdG9yeUZhY3RvcnkoNSksXG5cdFx0XHRdKS50aGVuKChyZXN1bHQpID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDUsIHJlc3VsdC5sZW5ndGgpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMSwgcmVzdWx0WzBdKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDIsIHJlc3VsdFsxXSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgzLCByZXN1bHRbMl0pO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoNCwgcmVzdWx0WzNdKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDUsIHJlc3VsdFs0XSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ0xpbWl0ZXInLCAoKSA9PiB7XG5cdFx0dGVzdCgnYXNzZXJ0IGRlZ3JlZSBvZiBwYXJhbGVsbGlzbScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdGxldCBhY3RpdmVQcm9taXNlcyA9IDA7XG5cdFx0XHRjb25zdCBmYWN0b3J5RmFjdG9yeSA9IChuOiBudW1iZXIpID0+ICgpID0+IHtcblx0XHRcdFx0YWN0aXZlUHJvbWlzZXMrKztcblx0XHRcdFx0YXNzZXJ0KGFjdGl2ZVByb21pc2VzIDwgNik7XG5cdFx0XHRcdHJldHVybiBhc3luYy50aW1lb3V0KDApLnRoZW4oKCkgPT4geyBhY3RpdmVQcm9taXNlcy0tOyByZXR1cm4gbjsgfSk7XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBsaW1pdGVyID0gbmV3IGFzeW5jLkxpbWl0ZXIoNSk7XG5cblx0XHRcdGNvbnN0IHByb21pc2VzOiBQcm9taXNlPGFueT5bXSA9IFtdO1xuXHRcdFx0WzAsIDEsIDIsIDMsIDQsIDUsIDYsIDcsIDgsIDldLmZvckVhY2gobiA9PiBwcm9taXNlcy5wdXNoKGxpbWl0ZXIucXVldWUoZmFjdG9yeUZhY3RvcnkobikpKSk7XG5cblx0XHRcdHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbigocmVzKSA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgxMCwgcmVzLmxlbmd0aCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoWzAsIDEsIDIsIDMsIDQsIDUsIDYsIDcsIDgsIDldLCByZXMpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cblx0c3VpdGUoJ1F1ZXVlJywgKCkgPT4ge1xuXHRcdHRlc3QoJ3NpbXBsZScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IHF1ZXVlID0gbmV3IGFzeW5jLlF1ZXVlKCk7XG5cblx0XHRcdGxldCBzeW5jUHJvbWlzZSA9IGZhbHNlO1xuXHRcdFx0Y29uc3QgZjEgPSAoKSA9PiBQcm9taXNlLnJlc29sdmUodHJ1ZSkudGhlbigoKSA9PiBzeW5jUHJvbWlzZSA9IHRydWUpO1xuXG5cdFx0XHRsZXQgYXN5bmNQcm9taXNlID0gZmFsc2U7XG5cdFx0XHRjb25zdCBmMiA9ICgpID0+IGFzeW5jLnRpbWVvdXQoMTApLnRoZW4oKCkgPT4gYXN5bmNQcm9taXNlID0gdHJ1ZSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChxdWV1ZS5zaXplLCAwKTtcblxuXHRcdFx0cXVldWUucXVldWUoZjEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXVlLnNpemUsIDEpO1xuXG5cdFx0XHRjb25zdCBwID0gcXVldWUucXVldWUoZjIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXVlLnNpemUsIDIpO1xuXHRcdFx0cmV0dXJuIHAudGhlbigoKSA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChxdWV1ZS5zaXplLCAwKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKHN5bmNQcm9taXNlKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKGFzeW5jUHJvbWlzZSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3N0b3AgcHJvY2Vzc2luZyBvbiBkaXNwb3NlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3QgcXVldWUgPSBuZXcgYXN5bmMuUXVldWUoKTtcblxuXHRcdFx0bGV0IHdvcmtDb3VudGVyID0gMDtcblx0XHRcdGNvbnN0IHRhc2sgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGF3YWl0IGFzeW5jLnRpbWVvdXQoMCk7XG5cdFx0XHRcdHdvcmtDb3VudGVyKys7XG5cdFx0XHRcdHF1ZXVlLmRpc3Bvc2UoKTsgLy8gRElTUE9TRSBIRVJFXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBwMSA9IHF1ZXVlLnF1ZXVlKHRhc2spO1xuXHRcdFx0cXVldWUucXVldWUodGFzayk7XG5cdFx0XHRxdWV1ZS5xdWV1ZSh0YXNrKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChxdWV1ZS5zaXplLCAzKTtcblxuXG5cdFx0XHRhd2FpdCBwMTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtDb3VudGVyLCAxKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3N0b3Agb24gY2xlYXInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBxdWV1ZSA9IG5ldyBhc3luYy5RdWV1ZSgpO1xuXG5cdFx0XHRsZXQgd29ya0NvdW50ZXIgPSAwO1xuXHRcdFx0Y29uc3QgdGFzayA9IGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgYXN5bmMudGltZW91dCgwKTtcblx0XHRcdFx0d29ya0NvdW50ZXIrKztcblx0XHRcdFx0cXVldWUuY2xlYXIoKTsgLy8gQ0xFQVIgSEVSRVxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocXVldWUuc2l6ZSwgMSk7IC8vIFRISVMgdGFzayBpcyBzdGlsbCBydW5uaW5nXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBwMSA9IHF1ZXVlLnF1ZXVlKHRhc2spO1xuXHRcdFx0cXVldWUucXVldWUodGFzayk7XG5cdFx0XHRxdWV1ZS5xdWV1ZSh0YXNrKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChxdWV1ZS5zaXplLCAzKTtcblxuXHRcdFx0YXdhaXQgcDE7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya0NvdW50ZXIsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXVlLnNpemUsIDApOyAvLyBoYXMgYmVlbiBjbGVhcmVkXG5cblxuXHRcdFx0Y29uc3QgcDIgPSBxdWV1ZS5xdWV1ZSh0YXNrKTtcblx0XHRcdGF3YWl0IHAyO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtDb3VudGVyLCAyKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2NsZWFyIGFuZCBkcmFpbiAoMSknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBxdWV1ZSA9IG5ldyBhc3luYy5RdWV1ZSgpO1xuXG5cdFx0XHRsZXQgd29ya0NvdW50ZXIgPSAwO1xuXHRcdFx0Y29uc3QgdGFzayA9IGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgYXN5bmMudGltZW91dCgwKTtcblx0XHRcdFx0d29ya0NvdW50ZXIrKztcblx0XHRcdFx0cXVldWUuY2xlYXIoKTsgLy8gQ0xFQVIgSEVSRVxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgcDAgPSBFdmVudC50b1Byb21pc2UocXVldWUub25EcmFpbmVkKTtcblx0XHRcdGNvbnN0IHAxID0gcXVldWUucXVldWUodGFzayk7XG5cblx0XHRcdGF3YWl0IHAxO1xuXHRcdFx0YXdhaXQgcDA7IC8vIGV4cGVjdCBkcmFpbiB0byBmaXJlIGJlY2F1c2UgYSB0YXNrIHdhcyBydW5uaW5nXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya0NvdW50ZXIsIDEpO1xuXHRcdFx0cXVldWUuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnY2xlYXIgYW5kIGRyYWluICgyKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IHF1ZXVlID0gbmV3IGFzeW5jLlF1ZXVlKCk7XG5cblx0XHRcdGxldCBkaWRGaXJlID0gZmFsc2U7XG5cdFx0XHRjb25zdCBkID0gcXVldWUub25EcmFpbmVkKCgpID0+IHtcblx0XHRcdFx0ZGlkRmlyZSA9IHRydWU7XG5cdFx0XHR9KTtcblxuXHRcdFx0cXVldWUuY2xlYXIoKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZEZpcmUsIGZhbHNlKTsgLy8gbm8gd29yaywgbm8gZHJhaW4hXG5cdFx0XHRkLmRpc3Bvc2UoKTtcblx0XHRcdHF1ZXVlLmRpc3Bvc2UoKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2RyYWluIHRpbWluZycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IHF1ZXVlID0gbmV3IGFzeW5jLlF1ZXVlKCk7XG5cblx0XHRcdGNvbnN0IGxvZ2ljQ2xvY2sgPSBuZXcgY2xhc3Mge1xuXHRcdFx0XHRwcml2YXRlIHRpbWUgPSAwO1xuXHRcdFx0XHR0aWNrKCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLnRpbWUrKztcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0bGV0IGRpZERyYWluVGltZSA9IDA7XG5cdFx0XHRsZXQgZGlkRmluaXNoVGltZTEgPSAwO1xuXHRcdFx0bGV0IGRpZEZpbmlzaFRpbWUyID0gMDtcblx0XHRcdGNvbnN0IGQgPSBxdWV1ZS5vbkRyYWluZWQoKCkgPT4ge1xuXHRcdFx0XHRkaWREcmFpblRpbWUgPSBsb2dpY0Nsb2NrLnRpY2soKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBwMSA9IHF1ZXVlLnF1ZXVlKCgpID0+IHtcblx0XHRcdFx0Ly8gYXdhaXQgYXN5bmMudGltZW91dCgxMCk7XG5cdFx0XHRcdGRpZEZpbmlzaFRpbWUxID0gbG9naWNDbG9jay50aWNrKCk7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBwMiA9IHF1ZXVlLnF1ZXVlKGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgYXN5bmMudGltZW91dCgxMCk7XG5cdFx0XHRcdGRpZEZpbmlzaFRpbWUyID0gbG9naWNDbG9jay50aWNrKCk7XG5cdFx0XHR9KTtcblxuXG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChbcDEsIHAyXSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWRGaW5pc2hUaW1lMSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlkRmluaXNoVGltZTIsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZERyYWluVGltZSwgMik7XG5cblx0XHRcdGQuZGlzcG9zZSgpO1xuXHRcdFx0cXVldWUuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZHJhaW4gZXZlbnQgaXMgc2VuZCBvbmx5IG9uY2UnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBxdWV1ZSA9IG5ldyBhc3luYy5RdWV1ZSgpO1xuXG5cdFx0XHRsZXQgZHJhaW5Db3VudCA9IDA7XG5cdFx0XHRjb25zdCBkID0gcXVldWUub25EcmFpbmVkKCgpID0+IHsgZHJhaW5Db3VudCsrOyB9KTtcblx0XHRcdHF1ZXVlLnF1ZXVlKGFzeW5jICgpID0+IHsgfSk7XG5cdFx0XHRxdWV1ZS5xdWV1ZShhc3luYyAoKSA9PiB7IH0pO1xuXHRcdFx0cXVldWUucXVldWUoYXN5bmMgKCkgPT4geyB9KTtcblx0XHRcdHF1ZXVlLnF1ZXVlKGFzeW5jICgpID0+IHsgfSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZHJhaW5Db3VudCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocXVldWUuc2l6ZSwgNCk7XG5cblx0XHRcdGF3YWl0IHF1ZXVlLndoZW5JZGxlKCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkcmFpbkNvdW50LCAxKTtcblxuXHRcdFx0ZC5kaXNwb3NlKCk7XG5cdFx0XHRxdWV1ZS5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdvcmRlciBpcyBrZXB0JywgZnVuY3Rpb24gKCkge1xuXHRcdFx0cmV0dXJuIHJ1bldpdGhGYWtlZFRpbWVycyh7fSwgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBxdWV1ZSA9IG5ldyBhc3luYy5RdWV1ZSgpO1xuXG5cdFx0XHRcdGNvbnN0IHJlczogbnVtYmVyW10gPSBbXTtcblxuXHRcdFx0XHRjb25zdCBmMSA9ICgpID0+IFByb21pc2UucmVzb2x2ZSh0cnVlKS50aGVuKCgpID0+IHJlcy5wdXNoKDEpKTtcblx0XHRcdFx0Y29uc3QgZjIgPSAoKSA9PiBhc3luYy50aW1lb3V0KDEwKS50aGVuKCgpID0+IHJlcy5wdXNoKDIpKTtcblx0XHRcdFx0Y29uc3QgZjMgPSAoKSA9PiBQcm9taXNlLnJlc29sdmUodHJ1ZSkudGhlbigoKSA9PiByZXMucHVzaCgzKSk7XG5cdFx0XHRcdGNvbnN0IGY0ID0gKCkgPT4gYXN5bmMudGltZW91dCgyMCkudGhlbigoKSA9PiByZXMucHVzaCg0KSk7XG5cdFx0XHRcdGNvbnN0IGY1ID0gKCkgPT4gYXN5bmMudGltZW91dCgwKS50aGVuKCgpID0+IHJlcy5wdXNoKDUpKTtcblxuXHRcdFx0XHRxdWV1ZS5xdWV1ZShmMSk7XG5cdFx0XHRcdHF1ZXVlLnF1ZXVlKGYyKTtcblx0XHRcdFx0cXVldWUucXVldWUoZjMpO1xuXHRcdFx0XHRxdWV1ZS5xdWV1ZShmNCk7XG5cdFx0XHRcdHJldHVybiBxdWV1ZS5xdWV1ZShmNSkudGhlbigoKSA9PiB7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc1swXSwgMSk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc1sxXSwgMik7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc1syXSwgMyk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc1szXSwgNCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc1s0XSwgNSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdlcnJvcnMgYnViYmxlIGluZGl2aWR1YWxseSBidXQgbm90IGNhdXNlIHN0b3AnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBxdWV1ZSA9IG5ldyBhc3luYy5RdWV1ZSgpO1xuXG5cdFx0XHRjb25zdCByZXM6IG51bWJlcltdID0gW107XG5cdFx0XHRsZXQgZXJyb3IgPSBmYWxzZTtcblxuXHRcdFx0Y29uc3QgZjEgPSAoKSA9PiBQcm9taXNlLnJlc29sdmUodHJ1ZSkudGhlbigoKSA9PiByZXMucHVzaCgxKSk7XG5cdFx0XHRjb25zdCBmMiA9ICgpID0+IGFzeW5jLnRpbWVvdXQoMTApLnRoZW4oKCkgPT4gcmVzLnB1c2goMikpO1xuXHRcdFx0Y29uc3QgZjMgPSAoKSA9PiBQcm9taXNlLnJlc29sdmUodHJ1ZSkudGhlbigoKSA9PiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ2Vycm9yJykpKTtcblx0XHRcdGNvbnN0IGY0ID0gKCkgPT4gYXN5bmMudGltZW91dCgyMCkudGhlbigoKSA9PiByZXMucHVzaCg0KSk7XG5cdFx0XHRjb25zdCBmNSA9ICgpID0+IGFzeW5jLnRpbWVvdXQoMCkudGhlbigoKSA9PiByZXMucHVzaCg1KSk7XG5cblx0XHRcdHF1ZXVlLnF1ZXVlKGYxKTtcblx0XHRcdHF1ZXVlLnF1ZXVlKGYyKTtcblx0XHRcdHF1ZXVlLnF1ZXVlKGYzKS50aGVuKHVuZGVmaW5lZCwgKCkgPT4gZXJyb3IgPSB0cnVlKTtcblx0XHRcdHF1ZXVlLnF1ZXVlKGY0KTtcblx0XHRcdHJldHVybiBxdWV1ZS5xdWV1ZShmNSkudGhlbigoKSA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNbMF0sIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzWzFdLCAyKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKGVycm9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc1syXSwgNCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNbM10sIDUpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdvcmRlciBpcyBrZXB0IChjaGFpbmVkKScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IHF1ZXVlID0gbmV3IGFzeW5jLlF1ZXVlKCk7XG5cblx0XHRcdGNvbnN0IHJlczogbnVtYmVyW10gPSBbXTtcblxuXHRcdFx0Y29uc3QgZjEgPSAoKSA9PiBQcm9taXNlLnJlc29sdmUodHJ1ZSkudGhlbigoKSA9PiByZXMucHVzaCgxKSk7XG5cdFx0XHRjb25zdCBmMiA9ICgpID0+IGFzeW5jLnRpbWVvdXQoMTApLnRoZW4oKCkgPT4gcmVzLnB1c2goMikpO1xuXHRcdFx0Y29uc3QgZjMgPSAoKSA9PiBQcm9taXNlLnJlc29sdmUodHJ1ZSkudGhlbigoKSA9PiByZXMucHVzaCgzKSk7XG5cdFx0XHRjb25zdCBmNCA9ICgpID0+IGFzeW5jLnRpbWVvdXQoMjApLnRoZW4oKCkgPT4gcmVzLnB1c2goNCkpO1xuXHRcdFx0Y29uc3QgZjUgPSAoKSA9PiBhc3luYy50aW1lb3V0KDApLnRoZW4oKCkgPT4gcmVzLnB1c2goNSkpO1xuXG5cdFx0XHRyZXR1cm4gcXVldWUucXVldWUoZjEpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gcXVldWUucXVldWUoZjIpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRcdHJldHVybiBxdWV1ZS5xdWV1ZShmMykudGhlbigoKSA9PiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcXVldWUucXVldWUoZjQpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcXVldWUucXVldWUoZjUpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNbMF0sIDEpO1xuXHRcdFx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNbMV0sIDIpO1xuXHRcdFx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNbMl0sIDMpO1xuXHRcdFx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNbM10sIDQpO1xuXHRcdFx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNbNF0sIDUpO1xuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZXZlbnRzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3QgcXVldWUgPSBuZXcgYXN5bmMuUXVldWUoKTtcblxuXHRcdFx0bGV0IGRyYWluZWQgPSBmYWxzZTtcblx0XHRcdGNvbnN0IG9uRHJhaW5lZCA9IEV2ZW50LnRvUHJvbWlzZShxdWV1ZS5vbkRyYWluZWQpLnRoZW4oKCkgPT4gZHJhaW5lZCA9IHRydWUpO1xuXG5cdFx0XHRjb25zdCByZXM6IG51bWJlcltdID0gW107XG5cblx0XHRcdGNvbnN0IGYxID0gKCkgPT4gYXN5bmMudGltZW91dCgxMCkudGhlbigoKSA9PiByZXMucHVzaCgyKSk7XG5cdFx0XHRjb25zdCBmMiA9ICgpID0+IGFzeW5jLnRpbWVvdXQoMjApLnRoZW4oKCkgPT4gcmVzLnB1c2goNCkpO1xuXHRcdFx0Y29uc3QgZjMgPSAoKSA9PiBhc3luYy50aW1lb3V0KDApLnRoZW4oKCkgPT4gcmVzLnB1c2goNSkpO1xuXG5cdFx0XHRjb25zdCBxMSA9IHF1ZXVlLnF1ZXVlKGYxKTtcblx0XHRcdGNvbnN0IHEyID0gcXVldWUucXVldWUoZjIpO1xuXHRcdFx0cXVldWUucXVldWUoZjMpO1xuXG5cdFx0XHRxMS50aGVuKCgpID0+IHtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFkcmFpbmVkKTtcblx0XHRcdFx0cTIudGhlbigoKSA9PiB7XG5cdFx0XHRcdFx0YXNzZXJ0Lm9rKCFkcmFpbmVkKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0YXdhaXQgb25EcmFpbmVkO1xuXHRcdFx0YXNzZXJ0Lm9rKGRyYWluZWQpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnUmVzb3VyY2VRdWV1ZScsICgpID0+IHtcblx0XHR0ZXN0KCdzaW1wbGUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBxdWV1ZSA9IG5ldyBhc3luYy5SZXNvdXJjZVF1ZXVlKCk7XG5cblx0XHRcdGF3YWl0IHF1ZXVlLndoZW5EcmFpbmVkKCk7IC8vIHJldHVybnMgaW1tZWRpYXRlbHkgc2luY2UgZW1wdHlcblxuXHRcdFx0bGV0IGRvbmUxID0gZmFsc2U7XG5cdFx0XHRxdWV1ZS5xdWV1ZUZvcihVUkkuZmlsZSgnL3NvbWUvcGF0aCcpLCBhc3luYyAoKSA9PiB7IGRvbmUxID0gdHJ1ZTsgfSk7XG5cdFx0XHRhd2FpdCBxdWV1ZS53aGVuRHJhaW5lZCgpOyAvLyByZXR1cm5zIGltbWVkaWF0ZWx5IHNpbmNlIG5vIHdvcmsgc2NoZWR1bGVkXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZG9uZTEsIHRydWUpO1xuXG5cdFx0XHRsZXQgZG9uZTIgPSBmYWxzZTtcblx0XHRcdHF1ZXVlLnF1ZXVlRm9yKFVSSS5maWxlKCcvc29tZS9vdGhlci9wYXRoJyksIGFzeW5jICgpID0+IHsgZG9uZTIgPSB0cnVlOyB9KTtcblx0XHRcdGF3YWl0IHF1ZXVlLndoZW5EcmFpbmVkKCk7IC8vIHJldHVybnMgaW1tZWRpYXRlbHkgc2luY2Ugbm8gd29yayBzY2hlZHVsZWRcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkb25lMiwgdHJ1ZSk7XG5cblx0XHRcdC8vIHNjaGVkdWxlIHNvbWUgd29ya1xuXHRcdFx0Y29uc3QgdzEgPSBuZXcgYXN5bmMuRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cdFx0XHRxdWV1ZS5xdWV1ZUZvcihVUkkuZmlsZSgnL3NvbWUvcGF0aCcpLCAoKSA9PiB3MS5wKTtcblxuXHRcdFx0bGV0IGRyYWluZWQgPSBmYWxzZTtcblx0XHRcdHF1ZXVlLndoZW5EcmFpbmVkKCkudGhlbigoKSA9PiBkcmFpbmVkID0gdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZHJhaW5lZCwgZmFsc2UpO1xuXHRcdFx0YXdhaXQgdzEuY29tcGxldGUoKTtcblx0XHRcdGF3YWl0IGFzeW5jLnRpbWVvdXQoMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZHJhaW5lZCwgdHJ1ZSk7XG5cblx0XHRcdC8vIHNjaGVkdWxlIHNvbWUgd29ya1xuXHRcdFx0Y29uc3QgdzIgPSBuZXcgYXN5bmMuRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cdFx0XHRjb25zdCB3MyA9IG5ldyBhc3luYy5EZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblx0XHRcdHF1ZXVlLnF1ZXVlRm9yKFVSSS5maWxlKCcvc29tZS9wYXRoJyksICgpID0+IHcyLnApO1xuXHRcdFx0cXVldWUucXVldWVGb3IoVVJJLmZpbGUoJy9zb21lL290aGVyL3BhdGgnKSwgKCkgPT4gdzMucCk7XG5cblx0XHRcdGRyYWluZWQgPSBmYWxzZTtcblx0XHRcdHF1ZXVlLndoZW5EcmFpbmVkKCkudGhlbigoKSA9PiBkcmFpbmVkID0gdHJ1ZSk7XG5cblx0XHRcdHF1ZXVlLmRpc3Bvc2UoKTtcblx0XHRcdGF3YWl0IGFzeW5jLnRpbWVvdXQoMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZHJhaW5lZCwgdHJ1ZSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdyZXRyeScsICgpID0+IHtcblx0XHR0ZXN0KCdzdWNjZXNzIGNhc2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRyZXR1cm4gcnVuV2l0aEZha2VkVGltZXJzKHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGxldCBjb3VudGVyID0gMDtcblxuXHRcdFx0XHRjb25zdCByZXMgPSBhd2FpdCBhc3luYy5yZXRyeSgoKSA9PiB7XG5cdFx0XHRcdFx0Y291bnRlcisrO1xuXHRcdFx0XHRcdGlmIChjb3VudGVyIDwgMikge1xuXHRcdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignZmFpbCcpKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRydWUpO1xuXHRcdFx0XHR9LCAxMCwgMyk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcywgdHJ1ZSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2Vycm9yIGNhc2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRyZXR1cm4gcnVuV2l0aEZha2VkVGltZXJzKHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGV4cGVjdGVkRXJyb3IgPSBuZXcgRXJyb3IoJ2ZhaWwnKTtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRhd2FpdCBhc3luYy5yZXRyeSgoKSA9PiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QoZXhwZWN0ZWRFcnJvcik7XG5cdFx0XHRcdFx0fSwgMTAsIDMpO1xuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnJvciwgZXJyb3IpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ1Rhc2tTZXF1ZW50aWFsaXplcicsICgpID0+IHtcblx0XHR0ZXN0KCdleGVjdXRpb24gYmFzaWNzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3Qgc2VxdWVudGlhbGl6ZXIgPSBuZXcgYXN5bmMuVGFza1NlcXVlbnRpYWxpemVyKCk7XG5cblx0XHRcdGFzc2VydC5vayghc2VxdWVudGlhbGl6ZXIuaXNSdW5uaW5nKCkpO1xuXHRcdFx0YXNzZXJ0Lm9rKCFzZXF1ZW50aWFsaXplci5oYXNRdWV1ZWQoKSk7XG5cdFx0XHRhc3NlcnQub2soIXNlcXVlbnRpYWxpemVyLmlzUnVubmluZygyMzIzKSk7XG5cdFx0XHRhc3NlcnQub2soIXNlcXVlbnRpYWxpemVyLnJ1bm5pbmcpO1xuXG5cdFx0XHQvLyBwZW5kaW5nIHJlbW92ZXMgaXRzZWxmIGFmdGVyIGRvbmVcblx0XHRcdGF3YWl0IHNlcXVlbnRpYWxpemVyLnJ1bigxLCBQcm9taXNlLnJlc29sdmUoKSk7XG5cdFx0XHRhc3NlcnQub2soIXNlcXVlbnRpYWxpemVyLmlzUnVubmluZygpKTtcblx0XHRcdGFzc2VydC5vayghc2VxdWVudGlhbGl6ZXIuaXNSdW5uaW5nKDEpKTtcblx0XHRcdGFzc2VydC5vayghc2VxdWVudGlhbGl6ZXIucnVubmluZyk7XG5cdFx0XHRhc3NlcnQub2soIXNlcXVlbnRpYWxpemVyLmhhc1F1ZXVlZCgpKTtcblxuXHRcdFx0Ly8gcGVuZGluZyByZW1vdmVzIGl0c2VsZiBhZnRlciBkb25lICh1c2UgYXN5bmMudGltZW91dClcblx0XHRcdHNlcXVlbnRpYWxpemVyLnJ1bigyLCBhc3luYy50aW1lb3V0KDEpKTtcblx0XHRcdGFzc2VydC5vayhzZXF1ZW50aWFsaXplci5pc1J1bm5pbmcoKSk7XG5cdFx0XHRhc3NlcnQub2soc2VxdWVudGlhbGl6ZXIuaXNSdW5uaW5nKDIpKTtcblx0XHRcdGFzc2VydC5vayghc2VxdWVudGlhbGl6ZXIuaGFzUXVldWVkKCkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcXVlbnRpYWxpemVyLmlzUnVubmluZygxKSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Lm9rKHNlcXVlbnRpYWxpemVyLnJ1bm5pbmcpO1xuXG5cdFx0XHRhd2FpdCBhc3luYy50aW1lb3V0KDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcXVlbnRpYWxpemVyLmlzUnVubmluZygpLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VxdWVudGlhbGl6ZXIuaXNSdW5uaW5nKDIpLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQub2soIXNlcXVlbnRpYWxpemVyLnJ1bm5pbmcpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZXhlY3V0aW5nIGFuZCBxdWV1ZWQgKGZpbmlzaGVzIGluc3RhbnRseSknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBzZXF1ZW50aWFsaXplciA9IG5ldyBhc3luYy5UYXNrU2VxdWVudGlhbGl6ZXIoKTtcblxuXHRcdFx0bGV0IHBlbmRpbmdEb25lID0gZmFsc2U7XG5cdFx0XHRzZXF1ZW50aWFsaXplci5ydW4oMSwgYXN5bmMudGltZW91dCgxKS50aGVuKCgpID0+IHsgcGVuZGluZ0RvbmUgPSB0cnVlOyByZXR1cm47IH0pKTtcblxuXHRcdFx0Ly8gcXVldWVkIGZpbmlzaGVzIGluc3RhbnRseVxuXHRcdFx0bGV0IHF1ZXVlZERvbmUgPSBmYWxzZTtcblx0XHRcdGNvbnN0IHJlcyA9IHNlcXVlbnRpYWxpemVyLnF1ZXVlKCgpID0+IFByb21pc2UucmVzb2x2ZShudWxsKS50aGVuKCgpID0+IHsgcXVldWVkRG9uZSA9IHRydWU7IHJldHVybjsgfSkpO1xuXG5cdFx0XHRhc3NlcnQub2soc2VxdWVudGlhbGl6ZXIuaGFzUXVldWVkKCkpO1xuXG5cdFx0XHRhd2FpdCByZXM7XG5cdFx0XHRhc3NlcnQub2socGVuZGluZ0RvbmUpO1xuXHRcdFx0YXNzZXJ0Lm9rKHF1ZXVlZERvbmUpO1xuXHRcdFx0YXNzZXJ0Lm9rKCFzZXF1ZW50aWFsaXplci5oYXNRdWV1ZWQoKSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdleGVjdXRpbmcgYW5kIHF1ZXVlZCAoZmluaXNoZXMgYWZ0ZXIgdGltZW91dCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBzZXF1ZW50aWFsaXplciA9IG5ldyBhc3luYy5UYXNrU2VxdWVudGlhbGl6ZXIoKTtcblxuXHRcdFx0bGV0IHBlbmRpbmdEb25lID0gZmFsc2U7XG5cdFx0XHRzZXF1ZW50aWFsaXplci5ydW4oMSwgYXN5bmMudGltZW91dCgxKS50aGVuKCgpID0+IHsgcGVuZGluZ0RvbmUgPSB0cnVlOyByZXR1cm47IH0pKTtcblxuXHRcdFx0Ly8gcXVldWVkIGZpbmlzaGVzIGFmdGVyIGFzeW5jLnRpbWVvdXRcblx0XHRcdGxldCBxdWV1ZWREb25lID0gZmFsc2U7XG5cdFx0XHRjb25zdCByZXMgPSBzZXF1ZW50aWFsaXplci5xdWV1ZSgoKSA9PiBhc3luYy50aW1lb3V0KDEpLnRoZW4oKCkgPT4geyBxdWV1ZWREb25lID0gdHJ1ZTsgcmV0dXJuOyB9KSk7XG5cblx0XHRcdGF3YWl0IHJlcztcblx0XHRcdGFzc2VydC5vayhwZW5kaW5nRG9uZSk7XG5cdFx0XHRhc3NlcnQub2socXVldWVkRG9uZSk7XG5cdFx0XHRhc3NlcnQub2soIXNlcXVlbnRpYWxpemVyLmhhc1F1ZXVlZCgpKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2pvaW4gKHdpdGhvdXQgZXhlY3V0aW5nIG9yIHF1ZXVlZCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBzZXF1ZW50aWFsaXplciA9IG5ldyBhc3luYy5UYXNrU2VxdWVudGlhbGl6ZXIoKTtcblxuXHRcdFx0YXdhaXQgc2VxdWVudGlhbGl6ZXIuam9pbigpO1xuXHRcdFx0YXNzZXJ0Lm9rKCFzZXF1ZW50aWFsaXplci5oYXNRdWV1ZWQoKSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdqb2luICh3aXRob3V0IHF1ZXVlZCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBzZXF1ZW50aWFsaXplciA9IG5ldyBhc3luYy5UYXNrU2VxdWVudGlhbGl6ZXIoKTtcblxuXHRcdFx0bGV0IHBlbmRpbmdEb25lID0gZmFsc2U7XG5cdFx0XHRzZXF1ZW50aWFsaXplci5ydW4oMSwgYXN5bmMudGltZW91dCgxKS50aGVuKCgpID0+IHsgcGVuZGluZ0RvbmUgPSB0cnVlOyByZXR1cm47IH0pKTtcblxuXHRcdFx0YXdhaXQgc2VxdWVudGlhbGl6ZXIuam9pbigpO1xuXHRcdFx0YXNzZXJ0Lm9rKHBlbmRpbmdEb25lKTtcblx0XHRcdGFzc2VydC5vayghc2VxdWVudGlhbGl6ZXIuaXNSdW5uaW5nKCkpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnam9pbiAod2l0aCBleGVjdXRpbmcgYW5kIHF1ZXVlZCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBzZXF1ZW50aWFsaXplciA9IG5ldyBhc3luYy5UYXNrU2VxdWVudGlhbGl6ZXIoKTtcblxuXHRcdFx0bGV0IHBlbmRpbmdEb25lID0gZmFsc2U7XG5cdFx0XHRzZXF1ZW50aWFsaXplci5ydW4oMSwgYXN5bmMudGltZW91dCgxKS50aGVuKCgpID0+IHsgcGVuZGluZ0RvbmUgPSB0cnVlOyByZXR1cm47IH0pKTtcblxuXHRcdFx0Ly8gcXVldWVkIGZpbmlzaGVzIGFmdGVyIGFzeW5jLnRpbWVvdXRcblx0XHRcdGxldCBxdWV1ZWREb25lID0gZmFsc2U7XG5cdFx0XHRzZXF1ZW50aWFsaXplci5xdWV1ZSgoKSA9PiBhc3luYy50aW1lb3V0KDEpLnRoZW4oKCkgPT4geyBxdWV1ZWREb25lID0gdHJ1ZTsgcmV0dXJuOyB9KSk7XG5cblx0XHRcdGF3YWl0IHNlcXVlbnRpYWxpemVyLmpvaW4oKTtcblx0XHRcdGFzc2VydC5vayhwZW5kaW5nRG9uZSk7XG5cdFx0XHRhc3NlcnQub2socXVldWVkRG9uZSk7XG5cdFx0XHRhc3NlcnQub2soIXNlcXVlbnRpYWxpemVyLmlzUnVubmluZygpKTtcblx0XHRcdGFzc2VydC5vayghc2VxdWVudGlhbGl6ZXIuaGFzUXVldWVkKCkpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZXhlY3V0aW5nIGFuZCBtdWx0aXBsZSBxdWV1ZWQgKGxhc3Qgb25lIHdpbnMpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3Qgc2VxdWVudGlhbGl6ZXIgPSBuZXcgYXN5bmMuVGFza1NlcXVlbnRpYWxpemVyKCk7XG5cblx0XHRcdGxldCBwZW5kaW5nRG9uZSA9IGZhbHNlO1xuXHRcdFx0c2VxdWVudGlhbGl6ZXIucnVuKDEsIGFzeW5jLnRpbWVvdXQoMSkudGhlbigoKSA9PiB7IHBlbmRpbmdEb25lID0gdHJ1ZTsgcmV0dXJuOyB9KSk7XG5cblx0XHRcdC8vIHF1ZXVlZCBmaW5pc2hlcyBhZnRlciBhc3luYy50aW1lb3V0XG5cdFx0XHRsZXQgZmlyc3REb25lID0gZmFsc2U7XG5cdFx0XHRjb25zdCBmaXJzdFJlcyA9IHNlcXVlbnRpYWxpemVyLnF1ZXVlKCgpID0+IGFzeW5jLnRpbWVvdXQoMikudGhlbigoKSA9PiB7IGZpcnN0RG9uZSA9IHRydWU7IHJldHVybjsgfSkpO1xuXG5cdFx0XHRsZXQgc2Vjb25kRG9uZSA9IGZhbHNlO1xuXHRcdFx0Y29uc3Qgc2Vjb25kUmVzID0gc2VxdWVudGlhbGl6ZXIucXVldWUoKCkgPT4gYXN5bmMudGltZW91dCgzKS50aGVuKCgpID0+IHsgc2Vjb25kRG9uZSA9IHRydWU7IHJldHVybjsgfSkpO1xuXG5cdFx0XHRsZXQgdGhpcmREb25lID0gZmFsc2U7XG5cdFx0XHRjb25zdCB0aGlyZFJlcyA9IHNlcXVlbnRpYWxpemVyLnF1ZXVlKCgpID0+IGFzeW5jLnRpbWVvdXQoNCkudGhlbigoKSA9PiB7IHRoaXJkRG9uZSA9IHRydWU7IHJldHVybjsgfSkpO1xuXG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChbZmlyc3RSZXMsIHNlY29uZFJlcywgdGhpcmRSZXNdKTtcblx0XHRcdGFzc2VydC5vayhwZW5kaW5nRG9uZSk7XG5cdFx0XHRhc3NlcnQub2soIWZpcnN0RG9uZSk7XG5cdFx0XHRhc3NlcnQub2soIXNlY29uZERvbmUpO1xuXHRcdFx0YXNzZXJ0Lm9rKHRoaXJkRG9uZSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdjYW5jZWwgZXhlY3V0aW5nJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3Qgc2VxdWVudGlhbGl6ZXIgPSBuZXcgYXN5bmMuVGFza1NlcXVlbnRpYWxpemVyKCk7XG5cdFx0XHRjb25zdCBjdHNUaW1lb3V0ID0gc3RvcmUuYWRkKG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpKTtcblxuXHRcdFx0bGV0IHBlbmRpbmdDYW5jZWxsZWQgPSBmYWxzZTtcblx0XHRcdGNvbnN0IHRpbWVvdXQgPSBhc3luYy50aW1lb3V0KDEsIGN0c1RpbWVvdXQudG9rZW4pO1xuXHRcdFx0c2VxdWVudGlhbGl6ZXIucnVuKDEsIHRpbWVvdXQsICgpID0+IHBlbmRpbmdDYW5jZWxsZWQgPSB0cnVlKTtcblx0XHRcdHNlcXVlbnRpYWxpemVyLmNhbmNlbFJ1bm5pbmcoKTtcblxuXHRcdFx0YXNzZXJ0Lm9rKHBlbmRpbmdDYW5jZWxsZWQpO1xuXHRcdFx0Y3RzVGltZW91dC5jYW5jZWwoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ2Rpc3Bvc2FibGVUaW1lb3V0JywgKCkgPT4ge1xuXHRcdHRlc3QoJ2hhbmRsZXIgb25seSBzdWNjZXNzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0bGV0IGNiID0gZmFsc2U7XG5cdFx0XHRjb25zdCB0ID0gYXN5bmMuZGlzcG9zYWJsZVRpbWVvdXQoKCkgPT4gY2IgPSB0cnVlKTtcblxuXHRcdFx0YXdhaXQgYXN5bmMudGltZW91dCgwKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNiLCB0cnVlKTtcblxuXHRcdFx0dC5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdoYW5kbGVyIG9ubHkgY2FuY2VsJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0bGV0IGNiID0gZmFsc2U7XG5cdFx0XHRjb25zdCB0ID0gYXN5bmMuZGlzcG9zYWJsZVRpbWVvdXQoKCkgPT4gY2IgPSB0cnVlKTtcblx0XHRcdHQuZGlzcG9zZSgpO1xuXG5cdFx0XHRhd2FpdCBhc3luYy50aW1lb3V0KDApO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2IsIGZhbHNlKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3N0b3JlIG1hbmFnZWQgc3VjY2VzcycsIGFzeW5jICgpID0+IHtcblx0XHRcdGxldCBjYiA9IGZhbHNlO1xuXHRcdFx0Y29uc3QgcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdGFzeW5jLmRpc3Bvc2FibGVUaW1lb3V0KCgpID0+IGNiID0gdHJ1ZSwgMCwgcyk7XG5cblx0XHRcdGF3YWl0IGFzeW5jLnRpbWVvdXQoMCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYiwgdHJ1ZSk7XG5cblx0XHRcdHMuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc3RvcmUgbWFuYWdlZCBjYW5jZWwgdmlhIGRpc3Bvc2FibGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRsZXQgY2IgPSBmYWxzZTtcblx0XHRcdGNvbnN0IHMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHRjb25zdCB0ID0gYXN5bmMuZGlzcG9zYWJsZVRpbWVvdXQoKCkgPT4gY2IgPSB0cnVlLCAwLCBzKTtcblx0XHRcdHQuZGlzcG9zZSgpO1xuXG5cdFx0XHRhd2FpdCBhc3luYy50aW1lb3V0KDApO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2IsIGZhbHNlKTtcblxuXHRcdFx0cy5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzdG9yZSBtYW5hZ2VkIGNhbmNlbCB2aWEgc3RvcmUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRsZXQgY2IgPSBmYWxzZTtcblx0XHRcdGNvbnN0IHMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHRhc3luYy5kaXNwb3NhYmxlVGltZW91dCgoKSA9PiBjYiA9IHRydWUsIDAsIHMpO1xuXHRcdFx0cy5kaXNwb3NlKCk7XG5cblx0XHRcdGF3YWl0IGFzeW5jLnRpbWVvdXQoMCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYiwgZmFsc2UpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdyYWNlQ2FuY2VsbGF0aW9uJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGN0cyA9IHN0b3JlLmFkZChuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKSk7XG5cdFx0Y29uc3QgY3RzVGltZW91dCA9IHN0b3JlLmFkZChuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKSk7XG5cblx0XHRsZXQgdHJpZ2dlcmVkID0gZmFsc2U7XG5cdFx0Y29uc3QgdGltZW91dCA9IGFzeW5jLnRpbWVvdXQoMTAwLCBjdHNUaW1lb3V0LnRva2VuKTtcblx0XHRjb25zdCBwID0gYXN5bmMucmFjZUNhbmNlbGxhdGlvbih0aW1lb3V0LnRoZW4oKCkgPT4gdHJpZ2dlcmVkID0gdHJ1ZSksIGN0cy50b2tlbik7XG5cdFx0Y3RzLmNhbmNlbCgpO1xuXG5cdFx0YXdhaXQgcDtcblxuXHRcdGFzc2VydC5vayghdHJpZ2dlcmVkKTtcblx0XHRjdHNUaW1lb3V0LmNhbmNlbCgpO1xuXHR9KTtcblxuXHR0ZXN0KCdyYWNlVGltZW91dCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjdHMgPSBzdG9yZS5hZGQobmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCkpO1xuXG5cdFx0Ly8gdGltZW91dCB3aW5zXG5cdFx0bGV0IHRpbWVkb3V0ID0gZmFsc2U7XG5cdFx0bGV0IHRyaWdnZXJlZCA9IGZhbHNlO1xuXG5cdFx0Y29uc3QgY3RzVGltZW91dDEgPSBzdG9yZS5hZGQobmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCkpO1xuXHRcdGNvbnN0IHRpbWVvdXQxID0gYXN5bmMudGltZW91dCgxMDAsIGN0c1RpbWVvdXQxLnRva2VuKTtcblx0XHRjb25zdCBwMSA9IGFzeW5jLnJhY2VUaW1lb3V0KHRpbWVvdXQxLnRoZW4oKCkgPT4gdHJpZ2dlcmVkID0gdHJ1ZSksIDEsICgpID0+IHRpbWVkb3V0ID0gdHJ1ZSk7XG5cdFx0Y3RzLmNhbmNlbCgpO1xuXG5cdFx0YXdhaXQgcDE7XG5cblx0XHRhc3NlcnQub2soIXRyaWdnZXJlZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRpbWVkb3V0LCB0cnVlKTtcblx0XHRjdHNUaW1lb3V0MS5jYW5jZWwoKTtcblxuXHRcdC8vIHByb21pc2Ugd2luc1xuXHRcdHRpbWVkb3V0ID0gZmFsc2U7XG5cblx0XHRjb25zdCBjdHNUaW1lb3V0MiA9IHN0b3JlLmFkZChuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKSk7XG5cdFx0Y29uc3QgdGltZW91dDIgPSBhc3luYy50aW1lb3V0KDEsIGN0c1RpbWVvdXQyLnRva2VuKTtcblx0XHRjb25zdCBwMiA9IGFzeW5jLnJhY2VUaW1lb3V0KHRpbWVvdXQyLnRoZW4oKCkgPT4gdHJpZ2dlcmVkID0gdHJ1ZSksIDEwMCwgKCkgPT4gdGltZWRvdXQgPSB0cnVlKTtcblx0XHRjdHMuY2FuY2VsKCk7XG5cblx0XHRhd2FpdCBwMjtcblxuXHRcdGFzc2VydC5vayh0cmlnZ2VyZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aW1lZG91dCwgZmFsc2UpO1xuXHRcdGN0c1RpbWVvdXQyLmNhbmNlbCgpO1xuXHR9KTtcblxuXHR0ZXN0KCdTZXF1ZW5jZXJCeUtleScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzID0gbmV3IGFzeW5jLlNlcXVlbmNlckJ5S2V5PHN0cmluZz4oKTtcblxuXHRcdGNvbnN0IHIxID0gYXdhaXQgcy5xdWV1ZSgna2V5MScsICgpID0+IFByb21pc2UucmVzb2x2ZSgnaGVsbG8nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHIxLCAnaGVsbG8nKTtcblxuXHRcdGF3YWl0IHMucXVldWUoJ2tleTInLCAoKSA9PiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ2ZhaWxlZCcpKSkudGhlbigoKSA9PiB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ3Nob3VsZCBub3QgYmUgcmVzb2x2ZWQnKTtcblx0XHR9LCBlcnIgPT4ge1xuXHRcdFx0Ly8gRXhwZWN0ZWQgZXJyb3Jcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnIubWVzc2FnZSwgJ2ZhaWxlZCcpO1xuXHRcdH0pO1xuXG5cdFx0Ly8gU3RpbGwgd29ya3MgYWZ0ZXIgYSBxdWV1ZWQgcHJvbWlzZSBpcyByZWplY3RlZFxuXHRcdGNvbnN0IHIzID0gYXdhaXQgcy5xdWV1ZSgna2V5MicsICgpID0+IFByb21pc2UucmVzb2x2ZSgnaGVsbG8nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHIzLCAnaGVsbG8nKTtcblx0fSk7XG5cblx0dGVzdCgnSW50ZXJ2YWxDb3VudGVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGxldCBub3cgPSAwO1xuXHRcdGNvbnN0IGNvdW50ZXIgPSBuZXcgYXN5bmMuSW50ZXJ2YWxDb3VudGVyKDUsICgpID0+IG5vdyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnRlci5pbmNyZW1lbnQoKSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50ZXIuaW5jcmVtZW50KCksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudGVyLmluY3JlbWVudCgpLCAzKTtcblxuXHRcdG5vdyA9IDEwO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50ZXIuaW5jcmVtZW50KCksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudGVyLmluY3JlbWVudCgpLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnRlci5pbmNyZW1lbnQoKSwgMyk7XG5cdH0pO1xuXG5cdHN1aXRlKCdmaXJzdFBhcmFsbGVsJywgKCkgPT4ge1xuXHRcdHRlc3QoJ3NpbXBsZScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGEgPSBhd2FpdCBhc3luYy5maXJzdFBhcmFsbGVsKFtcblx0XHRcdFx0UHJvbWlzZS5yZXNvbHZlKDEpLFxuXHRcdFx0XHRQcm9taXNlLnJlc29sdmUoMiksXG5cdFx0XHRcdFByb21pc2UucmVzb2x2ZSgzKSxcblx0XHRcdF0sIHYgPT4gdiA9PT0gMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYSwgMik7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCd1c2VzIG51bGwgZGVmYXVsdCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBhc3luYy5maXJzdFBhcmFsbGVsKFtQcm9taXNlLnJlc29sdmUoMSldLCB2ID0+IHYgPT09IDIpLCBudWxsKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3VzZXMgdmFsdWUgZGVmYXVsdCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBhc3luYy5maXJzdFBhcmFsbGVsKFtQcm9taXNlLnJlc29sdmUoMSldLCB2ID0+IHYgPT09IDIsIDQpLCA0KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2VtcHR5JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IGFzeW5jLmZpcnN0UGFyYWxsZWwoW10sIHYgPT4gdiA9PT0gMiwgNCksIDQpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnY2FuY2VscycsIGFzeW5jICgpID0+IHtcblx0XHRcdGxldCBjdDE6IENhbmNlbGxhdGlvblRva2VuO1xuXHRcdFx0Y29uc3QgcDEgPSBhc3luYy5jcmVhdGVDYW5jZWxhYmxlUHJvbWlzZShhc3luYyAoY3QpID0+IHtcblx0XHRcdFx0Y3QxID0gY3Q7XG5cdFx0XHRcdGF3YWl0IGFzeW5jLnRpbWVvdXQoMjAwLCBjdCk7XG5cdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0fSk7XG5cdFx0XHRsZXQgY3QyOiBDYW5jZWxsYXRpb25Ub2tlbjtcblx0XHRcdGNvbnN0IHAyID0gYXN5bmMuY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UoYXN5bmMgKGN0KSA9PiB7XG5cdFx0XHRcdGN0MiA9IGN0O1xuXHRcdFx0XHRhd2FpdCBhc3luYy50aW1lb3V0KDIsIGN0KTtcblx0XHRcdFx0cmV0dXJuIDI7XG5cdFx0XHR9KTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IGFzeW5jLmZpcnN0UGFyYWxsZWwoW3AxLCBwMl0sIHYgPT4gdiA9PT0gMiwgNCksIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGN0MSEuaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQsIHRydWUsICdzaG91bGQgY2FuY2VsIGEnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjdDIhLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkLCB0cnVlLCAnc2hvdWxkIGNhbmNlbCBiJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdyZWplY3Rpb24gaGFuZGxpbmcnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRsZXQgY3QxOiBDYW5jZWxsYXRpb25Ub2tlbjtcblx0XHRcdGNvbnN0IHAxID0gYXN5bmMuY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UoYXN5bmMgKGN0KSA9PiB7XG5cdFx0XHRcdGN0MSA9IGN0O1xuXHRcdFx0XHRhd2FpdCBhc3luYy50aW1lb3V0KDIwMCwgY3QpO1xuXHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdH0pO1xuXHRcdFx0bGV0IGN0MjogQ2FuY2VsbGF0aW9uVG9rZW47XG5cdFx0XHRjb25zdCBwMiA9IGFzeW5jLmNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKGFzeW5jIChjdCkgPT4ge1xuXHRcdFx0XHRjdDIgPSBjdDtcblx0XHRcdFx0YXdhaXQgYXN5bmMudGltZW91dCgyLCBjdCk7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignb2ggbm8nKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgYXN5bmMuZmlyc3RQYXJhbGxlbChbcDEsIHAyXSwgdiA9PiB2ID09PSAyLCA0KS5jYXRjaCgoKSA9PiAnb2snKSwgJ29rJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3QxIS5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCwgdHJ1ZSwgJ3Nob3VsZCBjYW5jZWwgYScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGN0MiEuaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQsIHRydWUsICdzaG91bGQgY2FuY2VsIGInKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ0RlZmVycmVkUHJvbWlzZScsICgpID0+IHtcblx0XHR0ZXN0KCdyZXNvbHZlcycsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGRlZmVycmVkID0gbmV3IGFzeW5jLkRlZmVycmVkUHJvbWlzZTxudW1iZXI+KCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVmZXJyZWQuaXNSZXNvbHZlZCwgZmFsc2UpO1xuXHRcdFx0ZGVmZXJyZWQuY29tcGxldGUoNDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IGRlZmVycmVkLnAsIDQyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWZlcnJlZC5pc1Jlc29sdmVkLCB0cnVlKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3JlamVjdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBkZWZlcnJlZCA9IG5ldyBhc3luYy5EZWZlcnJlZFByb21pc2U8bnVtYmVyPigpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlZmVycmVkLmlzUmVqZWN0ZWQsIGZhbHNlKTtcblx0XHRcdGNvbnN0IGVyciA9IG5ldyBFcnJvcignb2ggbm8hJyk7XG5cdFx0XHRkZWZlcnJlZC5lcnJvcihlcnIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IGRlZmVycmVkLnAuY2F0Y2goZSA9PiBlKSwgZXJyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWZlcnJlZC5pc1JlamVjdGVkLCB0cnVlKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2NhbmNlbHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBkZWZlcnJlZCA9IG5ldyBhc3luYy5EZWZlcnJlZFByb21pc2U8bnVtYmVyPigpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlZmVycmVkLmlzUmVqZWN0ZWQsIGZhbHNlKTtcblx0XHRcdGRlZmVycmVkLmNhbmNlbCgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBkZWZlcnJlZC5wLmNhdGNoKGUgPT4gZSkpLm5hbWUsICdDYW5jZWxlZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlZmVycmVkLmlzUmVqZWN0ZWQsIHRydWUpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnUHJvbWlzZXMuc2V0dGxlZCcsICgpID0+IHtcblx0XHR0ZXN0KCdyZXNvbHZlcycsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHAxID0gUHJvbWlzZS5yZXNvbHZlKDEpO1xuXHRcdFx0Y29uc3QgcDIgPSBhc3luYy50aW1lb3V0KDEpLnRoZW4oKCkgPT4gMik7XG5cdFx0XHRjb25zdCBwMyA9IGFzeW5jLnRpbWVvdXQoMikudGhlbigoKSA9PiAzKTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgYXN5bmMuUHJvbWlzZXMuc2V0dGxlZDxudW1iZXI+KFtwMSwgcDIsIHAzXSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQubGVuZ3RoLCAzKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0WzBdLCAxKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0WzFdLCAyKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0WzJdLCAzKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Jlc29sdmVzIGluIG9yZGVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcDEgPSBhc3luYy50aW1lb3V0KDIpLnRoZW4oKCkgPT4gMSk7XG5cdFx0XHRjb25zdCBwMiA9IGFzeW5jLnRpbWVvdXQoMSkudGhlbigoKSA9PiAyKTtcblx0XHRcdGNvbnN0IHAzID0gUHJvbWlzZS5yZXNvbHZlKDMpO1xuXG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBhc3luYy5Qcm9taXNlcy5zZXR0bGVkPG51bWJlcj4oW3AxLCBwMiwgcDNdKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5sZW5ndGgsIDMpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHRbMF0sIDEpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHRbMV0sIDIpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHRbMl0sIDMpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncmVqZWN0cyB3aXRoIGZpcnN0IGVycm9yIGJ1dCBoYW5kbGVzIGFsbCBwcm9taXNlcyAoYWxsIGVycm9ycyknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBwMSA9IFByb21pc2UucmVqZWN0KDEpO1xuXG5cdFx0XHRsZXQgcDJIYW5kbGVkID0gZmFsc2U7XG5cdFx0XHRjb25zdCBwMkVycm9yID0gbmV3IEVycm9yKCcyJyk7XG5cdFx0XHRjb25zdCBwMiA9IGFzeW5jLnRpbWVvdXQoMSkudGhlbigoKSA9PiB7XG5cdFx0XHRcdHAySGFuZGxlZCA9IHRydWU7XG5cdFx0XHRcdHRocm93IHAyRXJyb3I7XG5cdFx0XHR9KTtcblxuXHRcdFx0bGV0IHAzSGFuZGxlZCA9IGZhbHNlO1xuXHRcdFx0Y29uc3QgcDNFcnJvciA9IG5ldyBFcnJvcignMycpO1xuXHRcdFx0Y29uc3QgcDMgPSBhc3luYy50aW1lb3V0KDIpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRwM0hhbmRsZWQgPSB0cnVlO1xuXHRcdFx0XHR0aHJvdyBwM0Vycm9yO1xuXHRcdFx0fSk7XG5cblx0XHRcdGxldCBlcnJvcjogRXJyb3IgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCBhc3luYy5Qcm9taXNlcy5zZXR0bGVkPG51bWJlcj4oW3AxLCBwMiwgcDNdKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0ZXJyb3IgPSBlO1xuXHRcdFx0fVxuXG5cdFx0XHRhc3NlcnQub2soZXJyb3IpO1xuXHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKGVycm9yLCBwMkVycm9yKTtcblx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChlcnJvciwgcDNFcnJvcik7XG5cdFx0XHRhc3NlcnQub2socDJIYW5kbGVkKTtcblx0XHRcdGFzc2VydC5vayhwM0hhbmRsZWQpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncmVqZWN0cyB3aXRoIGZpcnN0IGVycm9yIGJ1dCBoYW5kbGVzIGFsbCBwcm9taXNlcyAoMSBlcnJvciknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBwMSA9IFByb21pc2UucmVzb2x2ZSgxKTtcblxuXHRcdFx0bGV0IHAySGFuZGxlZCA9IGZhbHNlO1xuXHRcdFx0Y29uc3QgcDJFcnJvciA9IG5ldyBFcnJvcignMicpO1xuXHRcdFx0Y29uc3QgcDIgPSBhc3luYy50aW1lb3V0KDEpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRwMkhhbmRsZWQgPSB0cnVlO1xuXHRcdFx0XHR0aHJvdyBwMkVycm9yO1xuXHRcdFx0fSk7XG5cblx0XHRcdGxldCBwM0hhbmRsZWQgPSBmYWxzZTtcblx0XHRcdGNvbnN0IHAzID0gYXN5bmMudGltZW91dCgyKS50aGVuKCgpID0+IHtcblx0XHRcdFx0cDNIYW5kbGVkID0gdHJ1ZTtcblx0XHRcdFx0cmV0dXJuIDM7XG5cdFx0XHR9KTtcblxuXHRcdFx0bGV0IGVycm9yOiBFcnJvciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IGFzeW5jLlByb21pc2VzLnNldHRsZWQ8bnVtYmVyPihbcDEsIHAyLCBwM10pO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRlcnJvciA9IGU7XG5cdFx0XHR9XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnJvciwgcDJFcnJvcik7XG5cdFx0XHRhc3NlcnQub2socDJIYW5kbGVkKTtcblx0XHRcdGFzc2VydC5vayhwM0hhbmRsZWQpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnUHJvbWlzZXMud2l0aEFzeW5jQm9keScsICgpID0+IHtcblx0XHR0ZXN0KCdiYXNpY3MnLCBhc3luYyAoKSA9PiB7XG5cblx0XHRcdGNvbnN0IHAxID0gYXN5bmMuUHJvbWlzZXMud2l0aEFzeW5jQm9keShhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdHJlc29sdmUoMSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgcDIgPSBhc3luYy5Qcm9taXNlcy53aXRoQXN5bmNCb2R5KGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0cmVqZWN0KG5ldyBFcnJvcignZXJyb3InKSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgcDMgPSBhc3luYy5Qcm9taXNlcy53aXRoQXN5bmNCb2R5KGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdlcnJvcicpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IHIxID0gYXdhaXQgcDE7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocjEsIDEpO1xuXG5cdFx0XHRsZXQgZTI6IEVycm9yIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgcDI7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRlMiA9IGVycm9yO1xuXHRcdFx0fVxuXG5cdFx0XHRhc3NlcnQub2soZTIgaW5zdGFuY2VvZiBFcnJvcik7XG5cblx0XHRcdGxldCBlMzogRXJyb3IgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCBwMztcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdGUzID0gZXJyb3I7XG5cdFx0XHR9XG5cblx0XHRcdGFzc2VydC5vayhlMyBpbnN0YW5jZW9mIEVycm9yKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ1Rocm90dGxlZFdvcmtlcicsICgpID0+IHtcblxuXHRcdGZ1bmN0aW9uIGFzc2VydEFycmF5RXF1YWxzKGFjdHVhbDogdW5rbm93bltdLCBleHBlY3RlZDogdW5rbm93bltdKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmxlbmd0aCwgZXhwZWN0ZWQubGVuZ3RoKTtcblxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBhY3R1YWwubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbFtpXSwgZXhwZWN0ZWRbaV0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRlc3QoJ2Jhc2ljcycsIGFzeW5jICgpID0+IHtcblx0XHRcdGxldCBoYW5kbGVkOiBudW1iZXJbXSA9IFtdO1xuXG5cdFx0XHRsZXQgaGFuZGxlZENhbGxiYWNrOiBGdW5jdGlvbjtcblx0XHRcdGxldCBoYW5kbGVkUHJvbWlzZSA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gaGFuZGxlZENhbGxiYWNrID0gcmVzb2x2ZSk7XG5cdFx0XHRsZXQgaGFuZGxlZENvdW50ZXJUb1Jlc29sdmUgPSAxO1xuXHRcdFx0bGV0IGN1cnJlbnRIYW5kbGVkQ291bnRlciA9IDA7XG5cblx0XHRcdGNvbnN0IGhhbmRsZXIgPSAodW5pdHM6IHJlYWRvbmx5IG51bWJlcltdKSA9PiB7XG5cdFx0XHRcdGhhbmRsZWQucHVzaCguLi51bml0cyk7XG5cblx0XHRcdFx0Y3VycmVudEhhbmRsZWRDb3VudGVyKys7XG5cdFx0XHRcdGlmIChjdXJyZW50SGFuZGxlZENvdW50ZXIgPT09IGhhbmRsZWRDb3VudGVyVG9SZXNvbHZlKSB7XG5cdFx0XHRcdFx0aGFuZGxlZENhbGxiYWNrKCk7XG5cblx0XHRcdFx0XHRoYW5kbGVkUHJvbWlzZSA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gaGFuZGxlZENhbGxiYWNrID0gcmVzb2x2ZSk7XG5cdFx0XHRcdFx0Y3VycmVudEhhbmRsZWRDb3VudGVyID0gMDtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3Qgd29ya2VyID0gc3RvcmUuYWRkKG5ldyBhc3luYy5UaHJvdHRsZWRXb3JrZXI8bnVtYmVyPih7XG5cdFx0XHRcdG1heFdvcmtDaHVua1NpemU6IDUsXG5cdFx0XHRcdG1heEJ1ZmZlcmVkV29yazogdW5kZWZpbmVkLFxuXHRcdFx0XHR0aHJvdHRsZURlbGF5OiAxXG5cdFx0XHR9LCBoYW5kbGVyKSk7XG5cblx0XHRcdC8vIFdvcmsgbGVzcyB0aGFuIGNodW5rIHNpemVcblxuXHRcdFx0bGV0IHdvcmtlZCA9IHdvcmtlci53b3JrKFsxLCAyLCAzXSk7XG5cblx0XHRcdGFzc2VydEFycmF5RXF1YWxzKGhhbmRsZWQsIFsxLCAyLCAzXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2VyLnBlbmRpbmcsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtlZCwgdHJ1ZSk7XG5cblx0XHRcdHdvcmtlci53b3JrKFs0LCA1XSk7XG5cdFx0XHR3b3JrZWQgPSB3b3JrZXIud29yayhbNl0pO1xuXG5cdFx0XHRhc3NlcnRBcnJheUVxdWFscyhoYW5kbGVkLCBbMSwgMiwgMywgNCwgNSwgNl0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtlci5wZW5kaW5nLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JrZWQsIHRydWUpO1xuXG5cdFx0XHQvLyBXb3JrIG1vcmUgdGhhbiBjaHVuayBzaXplICh2YXJpYW50IDEpXG5cblx0XHRcdGhhbmRsZWQgPSBbXTtcblx0XHRcdGhhbmRsZWRDb3VudGVyVG9SZXNvbHZlID0gMjtcblxuXHRcdFx0d29ya2VkID0gd29ya2VyLndvcmsoWzEsIDIsIDMsIDQsIDUsIDYsIDddKTtcblxuXHRcdFx0YXNzZXJ0QXJyYXlFcXVhbHMoaGFuZGxlZCwgWzEsIDIsIDMsIDQsIDVdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JrZXIucGVuZGluZywgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2VkLCB0cnVlKTtcblxuXHRcdFx0YXdhaXQgaGFuZGxlZFByb21pc2U7XG5cblx0XHRcdGFzc2VydEFycmF5RXF1YWxzKGhhbmRsZWQsIFsxLCAyLCAzLCA0LCA1LCA2LCA3XSk7XG5cblx0XHRcdGhhbmRsZWQgPSBbXTtcblx0XHRcdGhhbmRsZWRDb3VudGVyVG9SZXNvbHZlID0gNDtcblxuXHRcdFx0d29ya2VkID0gd29ya2VyLndvcmsoWzEsIDIsIDMsIDQsIDUsIDYsIDcsIDgsIDksIDEwLCAxMSwgMTIsIDEzLCAxNCwgMTUsIDE2LCAxNywgMTgsIDE5XSk7XG5cblx0XHRcdGFzc2VydEFycmF5RXF1YWxzKGhhbmRsZWQsIFsxLCAyLCAzLCA0LCA1XSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2VyLnBlbmRpbmcsIDE0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JrZWQsIHRydWUpO1xuXG5cdFx0XHRhd2FpdCBoYW5kbGVkUHJvbWlzZTtcblxuXHRcdFx0YXNzZXJ0QXJyYXlFcXVhbHMoaGFuZGxlZCwgWzEsIDIsIDMsIDQsIDUsIDYsIDcsIDgsIDksIDEwLCAxMSwgMTIsIDEzLCAxNCwgMTUsIDE2LCAxNywgMTgsIDE5XSk7XG5cblx0XHRcdC8vIFdvcmsgbW9yZSB0aGFuIGNodW5rIHNpemUgKHZhcmlhbnQgMilcblxuXHRcdFx0aGFuZGxlZCA9IFtdO1xuXHRcdFx0aGFuZGxlZENvdW50ZXJUb1Jlc29sdmUgPSAyO1xuXG5cdFx0XHR3b3JrZWQgPSB3b3JrZXIud29yayhbMSwgMiwgMywgNCwgNSwgNiwgNywgOCwgOSwgMTBdKTtcblxuXHRcdFx0YXNzZXJ0QXJyYXlFcXVhbHMoaGFuZGxlZCwgWzEsIDIsIDMsIDQsIDVdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JrZXIucGVuZGluZywgNSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2VkLCB0cnVlKTtcblxuXHRcdFx0YXdhaXQgaGFuZGxlZFByb21pc2U7XG5cblx0XHRcdGFzc2VydEFycmF5RXF1YWxzKGhhbmRsZWQsIFsxLCAyLCAzLCA0LCA1LCA2LCA3LCA4LCA5LCAxMF0pO1xuXG5cdFx0XHQvLyBXb3JrIG1vcmUgd2hpbGUgdGhyb3R0bGVkICh2YXJpYW50IDEpXG5cblx0XHRcdGhhbmRsZWQgPSBbXTtcblx0XHRcdGhhbmRsZWRDb3VudGVyVG9SZXNvbHZlID0gMztcblxuXHRcdFx0d29ya2VkID0gd29ya2VyLndvcmsoWzEsIDIsIDMsIDQsIDUsIDYsIDddKTtcblxuXHRcdFx0YXNzZXJ0QXJyYXlFcXVhbHMoaGFuZGxlZCwgWzEsIDIsIDMsIDQsIDVdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JrZXIucGVuZGluZywgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2VkLCB0cnVlKTtcblxuXHRcdFx0d29ya2VyLndvcmsoWzhdKTtcblx0XHRcdHdvcmtlZCA9IHdvcmtlci53b3JrKFs5LCAxMCwgMTFdKTtcblxuXHRcdFx0YXNzZXJ0QXJyYXlFcXVhbHMoaGFuZGxlZCwgWzEsIDIsIDMsIDQsIDVdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JrZXIucGVuZGluZywgNik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2VkLCB0cnVlKTtcblxuXHRcdFx0YXdhaXQgaGFuZGxlZFByb21pc2U7XG5cblx0XHRcdGFzc2VydEFycmF5RXF1YWxzKGhhbmRsZWQsIFsxLCAyLCAzLCA0LCA1LCA2LCA3LCA4LCA5LCAxMCwgMTFdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JrZXIucGVuZGluZywgMCk7XG5cblx0XHRcdC8vIFdvcmsgbW9yZSB3aGlsZSB0aHJvdHRsZWQgKHZhcmlhbnQgMilcblxuXHRcdFx0aGFuZGxlZCA9IFtdO1xuXHRcdFx0aGFuZGxlZENvdW50ZXJUb1Jlc29sdmUgPSAyO1xuXG5cdFx0XHR3b3JrZWQgPSB3b3JrZXIud29yayhbMSwgMiwgMywgNCwgNSwgNiwgN10pO1xuXG5cdFx0XHRhc3NlcnRBcnJheUVxdWFscyhoYW5kbGVkLCBbMSwgMiwgMywgNCwgNV0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtlZCwgdHJ1ZSk7XG5cblx0XHRcdHdvcmtlci53b3JrKFs4XSk7XG5cdFx0XHR3b3JrZWQgPSB3b3JrZXIud29yayhbOSwgMTBdKTtcblxuXHRcdFx0YXNzZXJ0QXJyYXlFcXVhbHMoaGFuZGxlZCwgWzEsIDIsIDMsIDQsIDVdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JrZWQsIHRydWUpO1xuXG5cdFx0XHRhd2FpdCBoYW5kbGVkUHJvbWlzZTtcblxuXHRcdFx0YXNzZXJ0QXJyYXlFcXVhbHMoaGFuZGxlZCwgWzEsIDIsIDMsIDQsIDUsIDYsIDcsIDgsIDksIDEwXSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdkbyBub3QgYWNjZXB0IHRvbyBtdWNoIHdvcmsnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBoYW5kbGVkOiBudW1iZXJbXSA9IFtdO1xuXHRcdFx0Y29uc3QgaGFuZGxlciA9ICh1bml0czogcmVhZG9ubHkgbnVtYmVyW10pID0+IGhhbmRsZWQucHVzaCguLi51bml0cyk7XG5cblx0XHRcdGNvbnN0IHdvcmtlciA9IHN0b3JlLmFkZChuZXcgYXN5bmMuVGhyb3R0bGVkV29ya2VyPG51bWJlcj4oe1xuXHRcdFx0XHRtYXhXb3JrQ2h1bmtTaXplOiA1LFxuXHRcdFx0XHRtYXhCdWZmZXJlZFdvcms6IDUsXG5cdFx0XHRcdHRocm90dGxlRGVsYXk6IDFcblx0XHRcdH0sIGhhbmRsZXIpKTtcblxuXHRcdFx0bGV0IHdvcmtlZCA9IHdvcmtlci53b3JrKFsxLCAyLCAzXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2VkLCB0cnVlKTtcblxuXHRcdFx0d29ya2VkID0gd29ya2VyLndvcmsoWzEsIDIsIDMsIDQsIDUsIDZdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JrZWQsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtlci5wZW5kaW5nLCAxKTtcblxuXHRcdFx0d29ya2VkID0gd29ya2VyLndvcmsoWzddKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JrZWQsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtlci5wZW5kaW5nLCAyKTtcblxuXHRcdFx0d29ya2VkID0gd29ya2VyLndvcmsoWzgsIDksIDEwLCAxMV0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtlZCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtlci5wZW5kaW5nLCAyKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2RvIG5vdCBhY2NlcHQgdG9vIG11Y2ggd29yayAoYWNjb3VudCBmb3IgbWF4IGNodW5rIHNpemUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBoYW5kbGVkOiBudW1iZXJbXSA9IFtdO1xuXHRcdFx0Y29uc3QgaGFuZGxlciA9ICh1bml0czogcmVhZG9ubHkgbnVtYmVyW10pID0+IGhhbmRsZWQucHVzaCguLi51bml0cyk7XG5cblx0XHRcdGNvbnN0IHdvcmtlciA9IHN0b3JlLmFkZChuZXcgYXN5bmMuVGhyb3R0bGVkV29ya2VyPG51bWJlcj4oe1xuXHRcdFx0XHRtYXhXb3JrQ2h1bmtTaXplOiA1LFxuXHRcdFx0XHRtYXhCdWZmZXJlZFdvcms6IDUsXG5cdFx0XHRcdHRocm90dGxlRGVsYXk6IDFcblx0XHRcdH0sIGhhbmRsZXIpKTtcblxuXHRcdFx0bGV0IHdvcmtlZCA9IHdvcmtlci53b3JrKFsxLCAyLCAzLCA0LCA1LCA2LCA3LCA4LCA5LCAxMCwgMTFdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JrZWQsIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JrZXIucGVuZGluZywgMCk7XG5cblx0XHRcdHdvcmtlZCA9IHdvcmtlci53b3JrKFsxLCAyLCAzLCA0LCA1LCA2LCA3LCA4LCA5LCAxMF0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtlZCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2VyLnBlbmRpbmcsIDUpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZGlzcG9zZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBoYW5kbGVkOiBudW1iZXJbXSA9IFtdO1xuXHRcdFx0Y29uc3QgaGFuZGxlciA9ICh1bml0czogcmVhZG9ubHkgbnVtYmVyW10pID0+IGhhbmRsZWQucHVzaCguLi51bml0cyk7XG5cblx0XHRcdGNvbnN0IHdvcmtlciA9IHN0b3JlLmFkZChuZXcgYXN5bmMuVGhyb3R0bGVkV29ya2VyPG51bWJlcj4oe1xuXHRcdFx0XHRtYXhXb3JrQ2h1bmtTaXplOiA1LFxuXHRcdFx0XHRtYXhCdWZmZXJlZFdvcms6IHVuZGVmaW5lZCxcblx0XHRcdFx0dGhyb3R0bGVEZWxheTogMVxuXHRcdFx0fSwgaGFuZGxlcikpO1xuXHRcdFx0d29ya2VyLmRpc3Bvc2UoKTtcblx0XHRcdGNvbnN0IHdvcmtlZCA9IHdvcmtlci53b3JrKFsxLCAyLCAzXSk7XG5cblx0XHRcdGFzc2VydEFycmF5RXF1YWxzKGhhbmRsZWQsIFtdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JrZXIucGVuZGluZywgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2VkLCBmYWxzZSk7XG5cdFx0fSk7XG5cblx0XHQvLyAgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIzMDM2NlxuXHRcdC8vIFx0dGVzdCgnd2FpdFRocm90dGxlRGVsYXlCZXR3ZWVuV29ya1VuaXRzIG9wdGlvbicsIGFzeW5jICgpID0+IHtcblx0XHQvLyBcdFx0Y29uc3QgaGFuZGxlZDogbnVtYmVyW10gPSBbXTtcblx0XHQvLyBcdFx0bGV0IGhhbmRsZWRDYWxsYmFjazogRnVuY3Rpb247XG5cdFx0Ly8gXHRcdGxldCBoYW5kbGVkUHJvbWlzZSA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gaGFuZGxlZENhbGxiYWNrID0gcmVzb2x2ZSk7XG5cdFx0Ly8gXHRcdGxldCBjdXJyZW50VGltZSA9IDA7XG5cblx0XHQvLyBcdFx0Y29uc3QgaGFuZGxlciA9ICh1bml0czogcmVhZG9ubHkgbnVtYmVyW10pID0+IHtcblx0XHQvLyBcdFx0XHRoYW5kbGVkLnB1c2goLi4udW5pdHMpO1xuXHRcdC8vIFx0XHRcdGhhbmRsZWRDYWxsYmFjaygpO1xuXHRcdC8vIFx0XHRcdGhhbmRsZWRQcm9taXNlID0gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBoYW5kbGVkQ2FsbGJhY2sgPSByZXNvbHZlKTtcblx0XHQvLyBcdFx0fTtcblxuXHRcdC8vIFx0XHRjb25zdCB3b3JrZXIgPSBzdG9yZS5hZGQobmV3IGFzeW5jLlRocm90dGxlZFdvcmtlcjxudW1iZXI+KHtcblx0XHQvLyBcdFx0XHRtYXhXb3JrQ2h1bmtTaXplOiA1LFxuXHRcdC8vIFx0XHRcdG1heEJ1ZmZlcmVkV29yazogdW5kZWZpbmVkLFxuXHRcdC8vIFx0XHRcdHRocm90dGxlRGVsYXk6IDUsXG5cdFx0Ly8gXHRcdFx0d2FpdFRocm90dGxlRGVsYXlCZXR3ZWVuV29ya1VuaXRzOiB0cnVlXG5cdFx0Ly8gXHRcdH0sIGhhbmRsZXIpKTtcblxuXHRcdC8vIFx0XHQvLyBTY2hlZHVsZSB3b3JrLCBpdCBzaG91bGQgZXhlY3V0ZSBpbW1lZGlhdGVseVxuXHRcdC8vIFx0XHRjdXJyZW50VGltZSA9IERhdGUubm93KCk7XG5cdFx0Ly8gXHRcdGxldCB3b3JrZWQgPSB3b3JrZXIud29yayhbMSwgMiwgM10pO1xuXHRcdC8vIFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2VkLCB0cnVlKTtcblx0XHQvLyBcdFx0YXNzZXJ0QXJyYXlFcXVhbHMoaGFuZGxlZCwgWzEsIDIsIDNdKTtcblx0XHQvLyBcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKERhdGUubm93KCkgLSBjdXJyZW50VGltZSA8IDUsIHRydWUpO1xuXG5cdFx0Ly8gXHRcdC8vIFNjaGVkdWxlIHdvcmsgYWdhaW4sIGl0IHNob3VsZCB3YWl0IGF0IGxlYXN0IHRocm90dGxlIGRlbGF5IGJlZm9yZSBleGVjdXRpbmdcblx0XHQvLyBcdFx0Y3VycmVudFRpbWUgPSBEYXRlLm5vdygpO1xuXHRcdC8vIFx0XHR3b3JrZWQgPSB3b3JrZXIud29yayhbNCwgNV0pO1xuXHRcdC8vIFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2VkLCB0cnVlKTtcblx0XHQvLyBcdFx0Ly8gVGhyb3R0bGUgZGVsYXkgaGFzbid0IHJlc2V0IHNvIHdlIHN0aWxsIG11c3Qgd2FpdFxuXHRcdC8vIFx0XHRhc3NlcnRBcnJheUVxdWFscyhoYW5kbGVkLCBbMSwgMiwgM10pO1xuXHRcdC8vIFx0XHRhd2FpdCBoYW5kbGVkUHJvbWlzZTtcblx0XHQvLyBcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKERhdGUubm93KCkgLSBjdXJyZW50VGltZSA+PSA1LCB0cnVlKTtcblx0XHQvLyBcdFx0YXNzZXJ0QXJyYXlFcXVhbHMoaGFuZGxlZCwgWzEsIDIsIDMsIDQsIDVdKTtcblx0XHQvLyBcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnTGltaXRlZFF1ZXVlJywgKCkgPT4ge1xuXG5cdFx0dGVzdCgnYmFzaWNzICh3aXRoIGxvbmcgcnVubmluZyB0YXNrKScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGxpbWl0ZWRRdWV1ZSA9IG5ldyBhc3luYy5MaW1pdGVkUXVldWUoKTtcblxuXHRcdFx0bGV0IGNvdW50ZXIgPSAwO1xuXHRcdFx0Y29uc3QgcHJvbWlzZXMgPSBbXTtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgNTsgaSsrKSB7XG5cdFx0XHRcdHByb21pc2VzLnB1c2gobGltaXRlZFF1ZXVlLnF1ZXVlKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRjb3VudGVyID0gaTtcblx0XHRcdFx0XHRhd2FpdCBhc3luYy50aW1lb3V0KDEpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcblxuXHRcdFx0Ly8gb25seSB0aGUgbGFzdCB0YXNrIGV4ZWN1dGVkXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnRlciwgNCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdiYXNpY3MgKHdpdGggc3luYyBydW5uaW5nIHRhc2spJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbGltaXRlZFF1ZXVlID0gbmV3IGFzeW5jLkxpbWl0ZWRRdWV1ZSgpO1xuXG5cdFx0XHRsZXQgY291bnRlciA9IDA7XG5cdFx0XHRjb25zdCBwcm9taXNlcyA9IFtdO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCA1OyBpKyspIHtcblx0XHRcdFx0cHJvbWlzZXMucHVzaChsaW1pdGVkUXVldWUucXVldWUoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGNvdW50ZXIgPSBpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcblxuXHRcdFx0Ly8gb25seSB0aGUgbGFzdCB0YXNrIGV4ZWN1dGVkXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnRlciwgNCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdBc3luY0l0ZXJhYmxlT2JqZWN0JywgZnVuY3Rpb24gKCkge1xuXG5cblx0XHR0ZXN0KCdvblJldHVybiBOT1QgY2FsbGVkJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0XHRsZXQgY2FsbGVkT25SZXR1cm4gPSBmYWxzZTtcblx0XHRcdGNvbnN0IGl0ZXIgPSBuZXcgYXN5bmMuQXN5bmNJdGVyYWJsZU9iamVjdDxudW1iZXI+KHdyaXRlciA9PiB7XG5cdFx0XHRcdHdyaXRlci5lbWl0TWFueShbMSwgMiwgMywgNCwgNV0pO1xuXHRcdFx0fSwgKCkgPT4ge1xuXHRcdFx0XHRjYWxsZWRPblJldHVybiA9IHRydWU7XG5cdFx0XHR9KTtcblxuXHRcdFx0Zm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGl0ZXIpIHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBpdGVtLCAnbnVtYmVyJyk7XG5cdFx0XHR9XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxsZWRPblJldHVybiwgZmFsc2UpO1xuXG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdvblJldHVybiBjYWxsZWQgb24gYnJlYWsnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdGxldCBjYWxsZWRPblJldHVybiA9IGZhbHNlO1xuXHRcdFx0Y29uc3QgaXRlciA9IG5ldyBhc3luYy5Bc3luY0l0ZXJhYmxlT2JqZWN0PG51bWJlcj4od3JpdGVyID0+IHtcblx0XHRcdFx0d3JpdGVyLmVtaXRNYW55KFsxLCAyLCAzLCA0LCA1XSk7XG5cdFx0XHR9LCAoKSA9PiB7XG5cdFx0XHRcdGNhbGxlZE9uUmV0dXJuID0gdHJ1ZTtcblx0XHRcdH0pO1xuXG5cdFx0XHRmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgaXRlcikge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbSwgMSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbGVkT25SZXR1cm4sIHRydWUpO1xuXG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdvblJldHVybiBjYWxsZWQgb24gcmV0dXJuJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0XHRsZXQgY2FsbGVkT25SZXR1cm4gPSBmYWxzZTtcblx0XHRcdGNvbnN0IGl0ZXIgPSBuZXcgYXN5bmMuQXN5bmNJdGVyYWJsZU9iamVjdDxudW1iZXI+KHdyaXRlciA9PiB7XG5cdFx0XHRcdHdyaXRlci5lbWl0TWFueShbMSwgMiwgMywgNCwgNV0pO1xuXHRcdFx0fSwgKCkgPT4ge1xuXHRcdFx0XHRjYWxsZWRPblJldHVybiA9IHRydWU7XG5cdFx0XHR9KTtcblxuXHRcdFx0YXdhaXQgKGFzeW5jIGZ1bmN0aW9uIHRlc3QoKSB7XG5cdFx0XHRcdGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBpdGVyKSB7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0sIDEpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fSkoKTtcblxuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbGVkT25SZXR1cm4sIHRydWUpO1xuXG5cdFx0fSk7XG5cblxuXHRcdHRlc3QoJ29uUmV0dXJuIGNhbGxlZCBvbiB0aHJvd2luZycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdFx0bGV0IGNhbGxlZE9uUmV0dXJuID0gZmFsc2U7XG5cdFx0XHRjb25zdCBpdGVyID0gbmV3IGFzeW5jLkFzeW5jSXRlcmFibGVPYmplY3Q8bnVtYmVyPih3cml0ZXIgPT4ge1xuXHRcdFx0XHR3cml0ZXIuZW1pdE1hbnkoWzEsIDIsIDMsIDQsIDVdKTtcblx0XHRcdH0sICgpID0+IHtcblx0XHRcdFx0Y2FsbGVkT25SZXR1cm4gPSB0cnVlO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBpdGVyKSB7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0sIDEpO1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cblx0XHRcdH1cblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxlZE9uUmV0dXJuLCB0cnVlKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ0FzeW5jSXRlcmFibGVTb3VyY2UnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHR0ZXN0KCdvblJldHVybiBpcyB3aXJlZCB1cCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRcdGxldCBjYWxsZWRPblJldHVybiA9IGZhbHNlO1xuXHRcdFx0Y29uc3Qgc291cmNlID0gbmV3IGFzeW5jLkFzeW5jSXRlcmFibGVTb3VyY2U8bnVtYmVyPigoKSA9PiB7IGNhbGxlZE9uUmV0dXJuID0gdHJ1ZTsgfSk7XG5cblx0XHRcdHNvdXJjZS5lbWl0T25lKDEpO1xuXHRcdFx0c291cmNlLmVtaXRPbmUoMik7XG5cdFx0XHRzb3VyY2UuZW1pdE9uZSgzKTtcblx0XHRcdHNvdXJjZS5yZXNvbHZlKCk7XG5cblx0XHRcdGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBzb3VyY2UuYXN5bmNJdGVyYWJsZSkge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbSwgMSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbGVkT25SZXR1cm4sIHRydWUpO1xuXG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdvblJldHVybiBpcyB3aXJlZCB1cCAyJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdFx0bGV0IGNhbGxlZE9uUmV0dXJuID0gZmFsc2U7XG5cdFx0XHRjb25zdCBzb3VyY2UgPSBuZXcgYXN5bmMuQXN5bmNJdGVyYWJsZVNvdXJjZTxudW1iZXI+KCgpID0+IHsgY2FsbGVkT25SZXR1cm4gPSB0cnVlOyB9KTtcblxuXHRcdFx0c291cmNlLmVtaXRPbmUoMSk7XG5cdFx0XHRzb3VyY2UuZW1pdE9uZSgyKTtcblx0XHRcdHNvdXJjZS5lbWl0T25lKDMpO1xuXHRcdFx0c291cmNlLnJlc29sdmUoKTtcblxuXHRcdFx0Zm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHNvdXJjZS5hc3luY0l0ZXJhYmxlKSB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlb2YgaXRlbSwgJ251bWJlcicpO1xuXHRcdFx0fVxuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbGVkT25SZXR1cm4sIGZhbHNlKTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixZQUFZLFdBQVc7QUFDdkIsWUFBWSxvQkFBb0I7QUFDaEMsU0FBNEIsK0JBQStCO0FBQzNELFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsYUFBYTtBQUN0QixTQUFTLFdBQVc7QUFDcEIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyx1QkFBdUI7QUFFaEMsTUFBTSxTQUFTLE1BQU07QUFFcEIsUUFBTSxRQUFRLHdDQUF3QztBQUV0RCxRQUFNLHFCQUFxQixXQUFZO0FBQ3RDLFNBQUssMkNBQTRDLFdBQVk7QUFDNUQsVUFBSSxXQUFXO0FBQ2YsWUFBTSxVQUFVLE1BQU0sd0JBQXdCLFdBQVM7QUFDdEQsY0FBTSxJQUFJLE1BQU0sd0JBQXdCLE9BQUs7QUFBRSxzQkFBWTtBQUFBLFFBQUcsQ0FBQyxDQUFDO0FBQ2hFLGVBQU8sSUFBSSxRQUFRLGFBQVc7QUFBQSxRQUFZLENBQUM7QUFBQSxNQUM1QyxDQUFDO0FBQ0QsWUFBTSxTQUFTLFFBQVEsS0FBSyxPQUFLLE9BQU8sR0FBRyxLQUFLLEdBQUcsU0FBTztBQUN6RCxlQUFPLFlBQVksVUFBVSxDQUFDO0FBQzlCLGVBQU8sR0FBRyxvQkFBb0IsR0FBRyxDQUFDO0FBQUEsTUFDbkMsQ0FBQztBQUNELGNBQVEsT0FBTztBQUNmLGNBQVEsT0FBTztBQUNmLGFBQU87QUFBQSxJQUNSLENBQUM7QUFFRCxTQUFLLCtDQUErQyxXQUFZO0FBQy9ELFVBQUksV0FBVztBQUNmLFlBQU0sVUFBVSxNQUFNLHdCQUF3QixXQUFTO0FBQ3RELGNBQU0sSUFBSSxNQUFNLHdCQUF3QixPQUFLO0FBQUUsc0JBQVk7QUFBQSxRQUFHLENBQUMsQ0FBQztBQUNoRSxlQUFPLFFBQVEsUUFBUSxJQUFJO0FBQUEsTUFDNUIsQ0FBQztBQUNELFlBQU0s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Q0FBQztBQUFBLFFBQzVFLFVBQVUsTUFBTSxPQUFPLEVBQUUsS0FBSyxDQUFDLFdBQVc7QUFBRSxpQkFBTyxZQUFZLFFBQVEsQ0FBQztBQUFBLFFBQUcsQ0FBQztBQUFBLFFBQzVFLFVBQVUsTUFBTSxPQUFPLEVBQUUsS0FBSyxDQUFDLFdBQVc7QUFBRSxpQkFBTyxZQUFZLFFBQVEsQ0FBQztBQUFBLFFBQUcsQ0FBQztBQUFBLFFBQzVFLFVBQVUsTUFBTSxPQUFPLEVBQUUsS0FBSyxDQUFDLFdBQVc7QUFBRSxpQkFBTyxZQUFZLFFBQVEsQ0FBQztBQUFBLFFBQUcsQ0FBQztBQUFBLE1BQzdFLENBQUMsRUFBRSxLQUFLLE1BQU07QUFDYixlQUFPLFFBQVEsSUFBSTtBQUFBLFVBQ2xCLFVBQVUsTUFBTSxPQUFPLEVBQUUsS0FBSyxDQUFDLFdBQVc7QUFBRSxtQkFBTyxZQUFZLFFBQVEsQ0FBQztBQUFBLFVBQUcsQ0FBQztBQUFBLFVBQzVFLFVBQVUsTUFBTSxPQUFPLEVBQUUsS0FBSyxDQUFDLFdBQVc7QUFBRSxtQkFBTyxZQUFZLFFBQVEsQ0FBQztBQUFBLFVBQUcsQ0FBQztBQUFBLFVBQzVFLFVBQVUsTUFBTSxPQUFPLEVBQUUsS0FBSyxDQUFDLFdBQVc7QUFBRSxtQkFBTyxZQUFZLFFBQVEsQ0FBQztBQUFBLFVBQUcsQ0FBQztBQUFBLFVBQzVFLFVBQVUsTUFBTSxPQUFPLEVBQUUsS0FBSyxDQUFDLFdBQVc7QUFBRSxtQkFBTyxZQUFZLFFBQVEsQ0FBQztBQUFBLFVBQUcsQ0FBQztBQUFBLFVBQzVFLFVBQVUsTUFBTSxPQUFPLEVBQUUsS0FBSyxDQUFDLFdBQVc7QUFBRSxtQkFBTyxZQUFZLFFBQVEsQ0FBQztBQUFBLFVBQUcsQ0FBQztBQUFBLFFBQzdFLENBQUM7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNGLENBQUM7QUFFRCxTQUFLLGlEQUFpRCxXQUFZO0FBQ2pFLFlBQU0saUJBQWlCLENBQUMsTUFBYyxNQUFNO0FBQzNDLGVBQU8sTUFBTSxRQUFRLENBQUMsRUFBRSxLQUFLLE1BQU0sQ0FBQztB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
