import assert from "assert";
import { setUnexpectedErrorHandler } from "../../common/errors.js";
import { Emitter, Event } from "../../common/event.js";
import { DisposableStore } from "../../common/lifecycle.js";
import { autorun, autorunHandleChanges, derived, derivedDisposable, keepObserved, observableFromEvent, observableSignal, observableValue, transaction, waitForState } from "../../common/observable.js";
import { BaseObservable } from "../../common/observableInternal/base.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "./utils.js";
suite("observables", () => {
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  suite("tutorial", () => {
    test("observable + autorun", () => {
      const log = new Log();
      const myObservable = observableValue("myObservable", 0);
      ds.add(autorun((reader) => {
        log.log(`myAutorun.run(myObservable: ${myObservable.read(reader)})`);
      }));
      assert.deepStrictEqual(log.getAndClearEntries(), ["myAutorun.run(myObservable: 0)"]);
      myObservable.set(1, void 0);
      assert.deepStrictEqual(log.getAndClearEntries(), ["myAutorun.run(myObservable: 1)"]);
      myObservable.set(1, void 0);
      assert.deepStrictEqual(log.getAndClearEntries(), []);
      transaction((tx) => {
        myObservable.set(2, tx);
        assert.deepStrictEqual(log.getAndClearEntries(), []);
        myObservable.set(3, tx);
        assert.deepStrictEqual(log.getAndClearEntries(), []);
      });
      assert.deepStrictEqual(log.getAndClearEntries(), ["myAutorun.run(myObservable: 3)"]);
    });
    test("derived + autorun", () => {
      const log = new Log();
      const observable1 = observableValue("myObservable1", 0);
      const observable2 = observableValue("myObservable2", 0);
      const myDerived = derived((reader) => {
        const value1 = observable1.read(reader);
        const value2 = observable2.read(reader);
        const sum = value1 + value2;
        log.log(`myDerived.recompute: ${value1} + ${value2} = ${sum}`);
        return sum;
      });
      ds.add(autorun((reader) => {
        log.log(`myAutorun(myDerived: ${myDerived.read(reader)})`);
      }));
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myDerived.recompute: 0 + 0 = 0",
        "myAutorun(myDerived: 0)"
      ]);
      observable1.set(1, void 0);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myDerived.recompute: 1 + 0 = 1",
        "myAutorun(myDerived: 1)"
      ]);
      observable2.set(1, void 0);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myDerived.recompute: 1 + 1 = 2",
        "myAutorun(myDerived: 2)"
      ]);
      transaction((tx) => {
        observable1.set(5, tx);
        assert.deepStrictEqual(log.getAndClearEntries(), []);
        observable2.set(5, tx);
        assert.deepStrictEqual(log.getAndClearEntries(), []);
      });
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myDerived.recompute: 5 + 5 = 10",
        "myAutorun(myDerived: 10)"
      ]);
      transaction((tx) => {
        observable1.set(6, tx);
        assert.deepStrictEqual(log.getAndClearEntries(), []);
        observable2.set(4, tx);
        assert.deepStrictEqual(log.getAndClearEntries(), []);
      });
      assert.deepStrictEqual(log.getAndClearEntries(), ["myDerived.recompute: 6 + 4 = 10"]);
    });
    test("read during transaction", () => {
      const log = new Log();
      const observable1 = observableValue("myObservable1", 0);
      const observable2 = observableValue("myObservable2", 0);
      const myDerived = derived((reader) => {
        const value1 = observable1.read(reader);
        const value2 = observable2.read(reader);
        const sum = value1 + value2;
        log.log(`myDerived.recompute: ${value1} + ${value2} = ${sum}`);
        return sum;
      });
      ds.add(autorun((reader) => {
        log.log(`myAutorun(myDerived: ${myDerived.read(reader)})`);
      }));
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myDerived.recompute: 0 + 0 = 0",
        "myAutorun(myDerived: 0)"
      ]);
      transaction((tx) => {
        observable1.set(-10, tx);
        assert.deepStrictEqual(log.getAndClearEntries(), []);
        myDerived.get();
        assert.deepStrictEqual(log.getAndClearEntries(), ["myDerived.recompute: -10 + 0 = -10"]);
        observable2.set(10, tx);
        assert.deepStrictEqual(log.getAndClearEntries(), []);
      });
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myDerived.recompute: -10 + 10 = 0",
        "myAutorun(myDerived: 0)"
      ]);
    });
    test("get without observers", () => {
      const log = new Log();
      const observable1 = observableValue("myObservableValue1", 0);
      const computed1 = derived((reader) => {
        const value1 = observable1.read(reader);
        const result = value1 % 3;
        log.log(`recompute1: ${value1} % 3 = ${result}`);
        return result;
      });
      const computed2 = derived((reader) => {
        const value1 = computed1.read(reader);
        const result = value1 * 2;
        log.log(`recompute2: ${value1} * 2 = ${result}`);
        return result;
      });
      const computed3 = derived((reader) => {
        const value1 = computed1.read(reader);
        const result = value1 * 3;
        log.log(`recompute3: ${value1} * 3 = ${result}`);
        return result;
      });
      const computedSum = derived((reader) => {
        const value1 = computed2.read(reader);
        const value2 = computed3.read(reader);
        const result = value1 + value2;
        log.log(`recompute4: ${value1} + ${value2} = ${result}`);
        return result;
      });
      assert.deepStrictEqual(log.getAndClearEntries(), []);
      observable1.set(1, void 0);
      assert.deepStrictEqual(log.getAndClearEntries(), []);
      log.log(`value: ${computedSum.get()}`);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "recompute1: 1 % 3 = 1",
        "recompute2: 1 * 2 = 2",
        "recompute3: 1 * 3 = 3",
        "recompute4: 2 + 3 = 5",
        "value: 5"
      ]);
      log.log(`value: ${computedSum.get()}`);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "recompute1: 1 % 3 = 1",
        "recompute2: 1 * 2 = 2",
        "recompute3: 1 * 3 = 3",
        "recompute4: 2 + 3 = 5",
        "value: 5"
      ]);
      const disposable = keepObserved(computedSum);
      log.log(`value: ${computedSum.get()}`);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "recompute1: 1 % 3 = 1",
        "recompute2: 1 * 2 = 2",
        "recompute3: 1 * 3 = 3",
        "recompute4: 2 + 3 = 5",
        "value: 5"
      ]);
      log.log(`value: ${computedSum.get()}`);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "value: 5"
      ]);
      observable1.set(2, void 0);
      assert.deepStrictEqual(log.getAndClearEntries(), []);
      log.log(`value: ${computedSum.get()}`);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "recompute1: 2 % 3 = 2",
        "recompute2: 2 * 2 = 4",
        "recompute3: 2 * 3 = 6",
        "recompute4: 4 + 6 = 10",
        "value: 10"
      ]);
      log.log(`value: ${computedSum.get()}`);
      assert.deepStrictEqual(log.getAndClearEntries(), ["value: 10"]);
      disposable.dispose();
      log.log(`value: ${computedSum.get()}`);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "recompute1: 2 % 3 = 2",
        "recompute2: 2 * 2 = 4",
        "recompute3: 2 * 3 = 6",
        "recompute4: 4 + 6 = 10",
        "value: 10"
      ]);
      log.log(`value: ${computedSum.get()}`);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "recompute1: 2 % 3 = 2",
        "recompute2: 2 * 2 = 4",
        "recompute3: 2 * 3 = 6",
        "recompute4: 4 + 6 = 10",
        "value: 10"
      ]);
    });
    test("autorun that receives deltas of signals", () => {
      const log = new Log();
      const signal = observableSignal("signal");
      const disposable = autorunHandleChanges({
        // The change summary is used to collect the changes
        createEmptyChangeSummary: () => ({ msgs: [] }),
        handleChange(context, changeSummary) {
          if (context.didChange(signal)) {
            changeSummary.msgs.push(context.change.msg);
          }
          return true;
        }
      }, (reader, changeSummary) => {
        signal.read(reader);
        log.log("msgs: " + changeSummary.msgs.join(", "));
      });
      signal.trigger(void 0, { msg: "foobar" });
      transaction((tx) => {
        signal.trigger(tx, { msg: "hello" });
        signal.trigger(tx, { msg: "world" });
      });
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "msgs: ",
        "msgs: foobar",
        "msgs: hello, world"
      ]);
      disposable.dispose();
    });
  });
  test("topological order", () => {
    const log = new Log();
    const myObservable1 = observableValue("myObservable1", 0);
    const myObservable2 = observableValue("myObservable2", 0);
    const myComputed1 = derived((reader) => {
      const value1 = myObservable1.read(reader);
      const value2 = myObservable2.read(reader);
      const sum = value1 + value2;
      log.log(`myComputed1.recompute(myObservable1: ${value1} + myObservable2: ${value2} = ${sum})`);
      return sum;
    });
    const myComputed2 = derived((reader) => {
      const value1 = myComputed1.read(reader);
      const value2 = myObservable1.read(reader);
      const value3 = myObservable2.read(reader);
      const sum = value1 + value2 + value3;
      log.log(`myComputed2.recompute(myComputed1: ${value1} + myObservable1: ${value2} + myObservable2: ${value3} = ${sum})`);
      return sum;
    });
    const myComputed3 = derived((reader) => {
      const value1 = myComputed2.read(reader);
      const value2 = myObservable1.read(reader);
      const value3 = myObservable2.read(reader);
      const sum = value1 + value2 + value3;
      log.log(`myComputed3.recompute(myComputed2: ${value1} + myObservable1: ${value2} + myObservable2: ${value3} = ${sum})`);
      return sum;
    });
    ds.add(autorun((reader) => {
      log.log(`myAutorun.run(myComputed3: ${myComputed3.read(reader)})`);
    }));
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "myComputed1.recompute(myObservable1: 0 + myObservable2: 0 = 0)",
      "myComputed2.recompute(myComputed1: 0 + myObservable1: 0 + myObservable2: 0 = 0)",
      "myComputed3.recompute(myComputed2: 0 + myObservable1: 0 + myObservable2: 0 = 0)",
      "myAutorun.run(myComputed3: 0)"
    ]);
    myObservable1.set(1, void 0);
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "myComputed1.recompute(myObservable1: 1 + myObservable2: 0 = 1)",
      "myComputed2.recompute(myComputed1: 1 + myObservable1: 1 + myObservable2: 0 = 2)",
      "myComputed3.recompute(myComputed2: 2 + myObservable1: 1 + myObservable2: 0 = 3)",
      "myAutorun.run(myComputed3: 3)"
    ]);
    transaction((tx) => {
      myObservable1.set(2, tx);
      myComputed2.get();
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myComputed1.recompute(myObservable1: 2 + myObservable2: 0 = 2)",
        "myComputed2.recompute(myComputed1: 2 + myObservable1: 2 + myObservable2: 0 = 4)"
      ]);
      myObservable1.set(3, tx);
      myComputed2.get();
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myComputed1.recompute(myObservable1: 3 + myObservable2: 0 = 3)",
        "myComputed2.recompute(myComputed1: 3 + myObservable1: 3 + myObservable2: 0 = 6)"
      ]);
    });
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "myComputed3.recompute(myComputed2: 6 + myObservable1: 3 + myObservable2: 0 = 9)",
      "myAutorun.run(myComputed3: 9)"
    ]);
  });
  suite("from event", () => {
    function init() {
      const log = new Log();
      let value = 0;
      const eventEmitter = new Emitter();
      let id = 0;
      const observable = observableFromEvent(
        (handler) => {
          const curId = id++;
          log.log(`subscribed handler ${curId}`);
          const disposable = eventEmitter.event(handler);
          return {
            dispose: () => {
              log.log(`unsubscribed handler ${curId}`);
              disposable.dispose();
            }
          };
        },
        () => {
          log.log(`compute value ${value}`);
          return value;
        }
      );
      return {
        log,
        setValue: (newValue) => {
          value = newValue;
          eventEmitter.fire();
        },
        observable
      };
    }
    test("Handle undefined", () => {
      const { log, setValue, observable } = init();
      setValue(void 0);
      const autorunDisposable = autorun((reader) => {
        observable.read(reader);
        log.log(
          `autorun, value: ${observable.read(reader)}`
        );
      });
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "subscribed handler 0",
        "compute value undefined",
        "autorun, value: undefined"
      ]);
      setValue(1);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "compute value 1",
        "autorun, value: 1"
      ]);
      autorunDisposable.dispose();
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "unsubscribed handler 0"
      ]);
    });
    test("basic", () => {
      const { log, setValue, observable } = init();
      const shouldReadObservable = observableValue("shouldReadObservable", true);
      const autorunDisposable = autorun((reader) => {
        if (shouldReadObservable.read(reader)) {
          observable.read(reader);
          log.log(
            `autorun, should read: true, value: ${observable.read(reader)}`
          );
        } else {
          log.log(`autorun, should read: false`);
        }
      });
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "subscribed handler 0",
        "compute value 0",
        "autorun, should read: true, value: 0"
      ]);
      log.log(`get value: ${observable.get()}`);
      assert.deepStrictEqual(log.getAndClearEntries(), ["get value: 0"]);
      setValue(1);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "compute value 1",
        "autorun, should read: true, value: 1"
      ]);
      shouldReadObservable.set(false, void 0);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "autorun, should read: false",
        "unsubscribed handler 0"
      ]);
      shouldReadObservable.set(true, void 0);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "subscribed handler 1",
        "compute value 1",
        "autorun, should read: true, value: 1"
      ]);
      autorunDisposable.dispose();
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "unsubscribed handler 1"
      ]);
    });
    test("get without observers", () => {
      const { log, observable } = init();
      assert.deepStrictEqual(log.getAndClearEntries(), []);
      log.log(`get value: ${observable.get()}`);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "compute value 0",
        "get value: 0"
      ]);
      log.log(`get value: ${observable.get()}`);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "compute value 0",
        "get value: 0"
      ]);
    });
  });
  test("reading derived in transaction unsubscribes unnecessary observables", () => {
    const log = new Log();
    const shouldReadObservable = observableValue("shouldReadMyObs1", true);
    const myObs1 = new LoggingObservableValue("myObs1", 0, log);
    const myComputed = derived((reader) => {
      log.log("myComputed.recompute");
      if (shouldReadObservable.read(reader)) {
        return myObs1.read(reader);
      }
      return 1;
    });
    ds.add(autorun((reader) => {
      const value = myComputed.read(reader);
      log.log(`myAutorun: ${value}`);
    }));
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "myComputed.recompute",
      "myObs1.firstObserverAdded",
      "myObs1.get",
      "myAutorun: 0"
    ]);
    transaction((tx) => {
      myObs1.set(1, tx);
      assert.deepStrictEqual(log.getAndClearEntries(), ["myObs1.set (value 1)"]);
      shouldReadObservable.set(false, tx);
      assert.deepStrictEqual(log.getAndClearEntries(), []);
      myComputed.get();
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myComputed.recompute",
        "myObs1.lastObserverRemoved"
      ]);
    });
    assert.deepStrictEqual(log.getAndClearEntries(), ["myAutorun: 1"]);
  });
  test("avoid recomputation of deriveds that are no longer read", () => {
    const log = new Log();
    const myObsShouldRead = new LoggingObservableValue("myObsShouldRead", true, log);
    const myObs1 = new LoggingObservableValue("myObs1", 0, log);
    const myComputed1 = derived((reader) => {
      const myObs1Val = myObs1.read(reader);
      const result = myObs1Val % 10;
      log.log(`myComputed1(myObs1: ${myObs1Val}): Computed ${result}`);
      return myObs1Val;
    });
    ds.add(autorun((reader) => {
      const shouldRead = myObsShouldRead.read(reader);
      if (shouldRead) {
        const v = myComputed1.read(reader);
        log.log(`myAutorun(shouldRead: true, myComputed1: ${v}): run`);
      } else {
        log.log(`myAutorun(shouldRead: false): run`);
      }
    }));
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "myObsShouldRead.firstObserverAdded",
      "myObsShouldRead.get",
      "myObs1.firstObserverAdded",
      "myObs1.get",
      "myComputed1(myObs1: 0): Computed 0",
      "myAutorun(shouldRead: true, myComputed1: 0): run"
    ]);
    transaction((tx) => {
      myObsShouldRead.set(false, tx);
      myObs1.set(1, tx);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myObsShouldRead.set (value false)",
        "myObs1.set (value 1)"
      ]);
    });
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "myObsShouldRead.get",
      "myAutorun(shouldRead: false): run",
      "myObs1.lastObserverRemoved"
    ]);
    transaction((tx) => {
      myObsShouldRead.set(true, tx);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myObsShouldRead.set (value true)"
      ]);
    });
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "myObsShouldRead.get",
      "myObs1.firstObserverAdded",
      "myObs1.get",
      "myComputed1(myObs1: 1): Computed 1",
      "myAutorun(shouldRead: true, myComputed1: 1): run"
    ]);
  });
  suite("autorun rerun on neutral change", () => {
    test("autorun reruns on neutral observable double change", () => {
      const log = new Log();
      const myObservable = observableValue("myObservable", 0);
      ds.add(autorun((reader) => {
        log.log(`myAutorun.run(myObservable: ${myObservable.read(reader)})`);
      }));
      assert.deepStrictEqual(log.getAndClearEntries(), ["myAutorun.run(myObservable: 0)"]);
      transaction((tx) => {
        myObservable.set(2, tx);
        assert.deepStrictEqual(log.getAndClearEntries(), []);
        myObservable.set(0, tx);
        assert.deepStrictEqual(log.getAndClearEntries(), []);
      });
      assert.deepStrictEqual(log.getAndClearEntries(), ["myAutorun.run(myObservable: 0)"]);
    });
    test("autorun does not rerun on indirect neutral observable double change", () => {
      const log = new Log();
      const myObservable = observableValue("myObservable", 0);
      const myDerived = derived((reader) => {
        const val = myObservable.read(reader);
        log.log(`myDerived.read(myObservable: ${val})`);
        return val;
      });
      ds.add(autorun((reader) => {
        log.log(`myAutorun.run(myDerived: ${myDerived.read(reader)})`);
      }));
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myDerived.read(myObservable: 0)",
        "myAutorun.run(myDerived: 0)"
      ]);
      transaction((tx) => {
        myObservable.set(2, tx);
        assert.deepStrictEqual(log.getAndClearEntries(), []);
        myObservable.set(0, tx);
        assert.deepStrictEqual(log.getAndClearEntries(), []);
      });
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myDerived.read(myObservable: 0)"
      ]);
    });
    test("autorun reruns on indirect neutral observable double change when changes propagate", () => {
      const log = new Log();
      const myObservable = observableValue("myObservable", 0);
      const myDerived = derived((reader) => {
        const val = myObservable.read(reader);
        log.log(`myDerived.read(myObservable: ${val})`);
        return val;
      });
      ds.add(autorun((reader) => {
        log.log(`myAutorun.run(myDerived: ${myDerived.read(reader)})`);
      }));
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myDerived.read(myObservable: 0)",
        "myAutorun.run(myDerived: 0)"
      ]);
      transaction((tx) => {
        myObservable.set(2, tx);
        assert.deepStrictEqual(log.getAndClearEntries(), []);
        myDerived.get();
        assert.deepStrictEqual(log.getAndClearEntries(), [
          "myDerived.read(myObservable: 2)"
        ]);
        myObservable.set(0, tx);
        assert.deepStrictEqual(log.getAndClearEntries(), []);
      });
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myDerived.read(myObservable: 0)",
        "myAutorun.run(myDerived: 0)"
      ]);
    });
  });
  test("self-disposing autorun", () => {
    const log = new Log();
    const observable1 = new LoggingObservableValue("myObservable1", 0, log);
    const myObservable2 = new LoggingObservableValue("myObservable2", 0, log);
    const myObservable3 = new LoggingObservableValue("myObservable3", 0, log);
    const d = autorun((reader) => {
      if (observable1.read(reader) >= 2) {
        assert.deepStrictEqual(log.getAndClearEntries(), [
          "myObservable1.set (value 2)",
          "myObservable1.get"
        ]);
        myObservable2.read(reader);
        assert.deepStrictEqual(log.getAndClearEntries(), [
          "myObservable2.firstObserverAdded",
          "myObservable2.get"
        ]);
        d.dispose();
        assert.deepStrictEqual(log.getAndClearEntries(), [
          "myObservable1.lastObserverRemoved",
          "myObservable2.lastObserverRemoved"
        ]);
        myObservable3.read(reader);
        assert.deepStrictEqual(log.getAndClearEntries(), [
          "myObservable3.get"
        ]);
      }
    });
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "myObservable1.firstObserverAdded",
      "myObservable1.get"
    ]);
    observable1.set(1, void 0);
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "myObservable1.set (value 1)",
      "myObservable1.get"
    ]);
    observable1.set(2, void 0);
    assert.deepStrictEqual(log.getAndClearEntries(), []);
  });
  test("changing observables in endUpdate", () => {
    const log = new Log();
    const myObservable1 = new LoggingObservableValue("myObservable1", 0, log);
    const myObservable2 = new LoggingObservableValue("myObservable2", 0, log);
    const myDerived1 = derived((reader) => {
      const val = myObservable1.read(reader);
      log.log(`myDerived1.read(myObservable: ${val})`);
      return val;
    });
    const myDerived2 = derived((reader) => {
      const val = myObservable2.read(reader);
      if (val === 1) {
        myDerived1.read(reader);
      }
      log.log(`myDerived2.read(myObservable: ${val})`);
      return val;
    });
    ds.add(autorun((reader) => {
      const myDerived1Val = myDerived1.read(reader);
      const myDerived2Val = myDerived2.read(reader);
      log.log(`myAutorun.run(myDerived1: ${myDerived1Val}, myDerived2: ${myDerived2Val})`);
    }));
    transaction((tx) => {
      myObservable2.set(1, tx);
      myObservable1.set(1, tx);
    });
  });
  test("set dependency in derived", () => {
    const log = new Log();
    const myObservable = new LoggingObservableValue("myObservable", 0, log);
    const myComputed = derived((reader) => {
      let value = myObservable.read(reader);
      const origValue = value;
      log.log(`myComputed(myObservable: ${origValue}): start computing`);
      if (value % 3 !== 0) {
        value++;
        myObservable.set(value, void 0);
      }
      log.log(`myComputed(myObservable: ${origValue}): finished computing`);
      return value;
    });
    ds.add(autorun((reader) => {
      const value = myComputed.read(reader);
      log.log(`myAutorun(myComputed: ${value})`);
    }));
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "myObservable.firstObserverAdded",
      "myObservable.get",
      "myComputed(myObservable: 0): start computing",
      "myComputed(myObservable: 0): finished computing",
      "myAutorun(myComputed: 0)"
    ]);
    myObservable.set(1, void 0);
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "myObservable.set (value 1)",
      "myObservable.get",
      "myComputed(myObservable: 1): start computing",
      "myObservable.set (value 2)",
      "myComputed(myObservable: 1): finished computing",
      "myObservable.get",
      "myComputed(myObservable: 2): start computing",
      "myObservable.set (value 3)",
      "myComputed(myObservable: 2): finished computing",
      "myObservable.get",
      "myComputed(myObservable: 3): start computing",
      "myComputed(myObservable: 3): finished computing",
      "myAutorun(myComputed: 3)"
    ]);
  });
  test("set dependency in autorun", () => {
    const log = new Log();
    const myObservable = new LoggingObservableValue("myObservable", 0, log);
    ds.add(autorun((reader) => {
      const value = myObservable.read(reader);
      log.log(`myAutorun(myObservable: ${value}): start`);
      if (value !== 0 && value < 4) {
        myObservable.set(value + 1, void 0);
      }
      log.log(`myAutorun(myObservable: ${value}): end`);
    }));
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "myObservable.firstObserverAdded",
      "myObservable.get",
      "myAutorun(myObservable: 0): start",
      "myAutorun(myObservable: 0): end"
    ]);
    myObservable.set(1, void 0);
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "myObservable.set (value 1)",
      "myObservable.get",
      "myAutorun(myObservable: 1): start",
      "myObservable.set (value 2)",
      "myAutorun(myObservable: 1): end",
      "myObservable.get",
      "myAutorun(myObservable: 2): start",
      "myObservable.set (value 3)",
      "myAutorun(myObservable: 2): end",
      "myObservable.get",
      "myAutorun(myObservable: 3): start",
      "myObservable.set (value 4)",
      "myAutorun(myObservable: 3): end",
      "myObservable.get",
      "myAutorun(myObservable: 4): start",
      "myAutorun(myObservable: 4): end"
    ]);
  });
  test("get in transaction between sets", () => {
    const log = new Log();
    const myObservable = new LoggingObservableValue("myObservable", 0, log);
    const myDerived1 = derived((reader) => {
      const value = myObservable.read(reader);
      log.log(`myDerived1(myObservable: ${value}): start computing`);
      return value;
    });
    const myDerived2 = derived((reader) => {
      const value = myDerived1.read(reader);
      log.log(`myDerived2(myDerived1: ${value}): start computing`);
      return value;
    });
    ds.add(autorun((reader) => {
      const value = myDerived2.read(reader);
      log.log(`myAutorun(myDerived2: ${value})`);
    }));
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "myObservable.firstObserverAdded",
      "myObservable.get",
      "myDerived1(myObservable: 0): start computing",
      "myDerived2(myDerived1: 0): start computing",
      "myAutorun(myDerived2: 0)"
    ]);
    transaction((tx) => {
      myObservable.set(1, tx);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myObservable.set (value 1)"
      ]);
      myDerived2.get();
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myObservable.get",
        "myDerived1(myObservable: 1): start computing",
        "myDerived2(myDerived1: 1): start computing"
      ]);
      myObservable.set(2, tx);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myObservable.set (value 2)"
      ]);
    });
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "myObservable.get",
      "myDerived1(myObservable: 2): start computing",
      "myDerived2(myDerived1: 2): start computing",
      "myAutorun(myDerived2: 2)"
    ]);
  });
  test("bug: Dont reset states", () => {
    const log = new Log();
    const myObservable1 = new LoggingObservableValue("myObservable1", 0, log);
    const myObservable2 = new LoggingObservableValue("myObservable2", 0, log);
    const myDerived2 = derived((reader) => {
      const val = myObservable2.read(reader);
      log.log(`myDerived2.computed(myObservable2: ${val})`);
      return val % 10;
    });
    const myDerived3 = derived((reader) => {
      const val1 = myObservable1.read(reader);
      const val2 = myDerived2.read(reader);
      log.log(`myDerived3.computed(myDerived1: ${val1}, myDerived2: ${val2})`);
      return `${val1} + ${val2}`;
    });
    ds.add(autorun((reader) => {
      const val = myDerived3.read(reader);
      log.log(`myAutorun(myDerived3: ${val})`);
    }));
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "myObservable1.firstObserverAdded",
      "myObservable1.get",
      "myObservable2.firstObserverAdded",
      "myObservable2.get",
      "myDerived2.computed(myObservable2: 0)",
      "myDerived3.computed(myDerived1: 0, myDerived2: 0)",
      "myAutorun(myDerived3: 0 + 0)"
    ]);
    transaction((tx) => {
      myObservable1.set(1, tx);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myObservable1.set (value 1)"
      ]);
      myObservable2.set(10, tx);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myObservable2.set (value 10)"
      ]);
    });
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "myObservable1.get",
      "myObservable2.get",
      "myDerived2.computed(myObservable2: 10)",
      "myDerived3.computed(myDerived1: 1, myDerived2: 0)",
      "myAutorun(myDerived3: 1 + 0)"
    ]);
  });
  test("bug: Add observable in endUpdate", () => {
    const myObservable1 = observableValue("myObservable1", 0);
    const myObservable2 = observableValue("myObservable2", 0);
    const myDerived1 = derived((reader) => {
      return myObservable1.read(reader);
    });
    const myDerived2 = derived((reader) => {
      return myObservable2.read(reader);
    });
    const myDerivedA1 = derived((reader) => {
      const d1 = myDerived1.read(reader);
      if (d1 === 1) {
        myDerived2.read(reader);
      }
    });
    ds.add(autorun((reader) => {
      myDerivedA1.read(reader);
    }));
    ds.add(autorun((reader) => {
      myDerived2.read(reader);
    }));
    transaction((tx) => {
      myObservable1.set(1, tx);
      myObservable2.set(1, tx);
    });
  });
  test("bug: fromObservableLight doesnt subscribe", () => {
    const log = new Log();
    const myObservable = new LoggingObservableValue("myObservable", 0, log);
    const myDerived = derived((reader) => {
      const val = myObservable.read(reader);
      log.log(`myDerived.computed(myObservable2: ${val})`);
      return val % 10;
    });
    const e = Event.fromObservableLight(myDerived);
    log.log("event created");
    e(() => {
      log.log("event fired");
    });
    myObservable.set(1, void 0);
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "event created",
      "myObservable.firstObserverAdded",
      "myObservable.get",
      "myDerived.computed(myObservable2: 0)",
      "myObservable.set (value 1)",
      "myObservable.get",
      "myDerived.computed(myObservable2: 1)",
      "event fired"
    ]);
  });
  test("bug: Event.fromObservable always should get events", () => {
    const emitter = new Emitter();
    const log = new Log();
    let i = 0;
    const obs = observableFromEvent(emitter.event, () => i);
    i++;
    emitter.fire(1);
    const evt2 = Event.fromObservable(obs);
    const d = evt2((e) => {
      log.log(`event fired ${e}`);
    });
    i++;
    emitter.fire(2);
    assert.deepStrictEqual(log.getAndClearEntries(), ["event fired 2"]);
    i++;
    emitter.fire(3);
    assert.deepStrictEqual(log.getAndClearEntries(), ["event fired 3"]);
    d.dispose();
  });
  test("dont run autorun after dispose", () => {
    const log = new Log();
    const myObservable = new LoggingObservableValue("myObservable", 0, log);
    const d = autorun((reader) => {
      const v = myObservable.read(reader);
      log.log("autorun, myObservable:" + v);
    });
    transaction((tx) => {
      myObservable.set(1, tx);
      d.dispose();
    });
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "myObservable.firstObserverAdded",
      "myObservable.get",
      "autorun, myObservable:0",
      "myObservable.set (value 1)",
      "myObservable.lastObserverRemoved"
    ]);
  });
  suite("waitForState", () => {
    test("resolve", async () => {
      const log = new Log();
      const myObservable = new LoggingObservableValue("myObservable", { state: "initializing" }, log);
      const p = waitForState(myObservable, (p2) => p2.state === "ready", (p2) => p2.state === "error").then((r) => {
        log.log(`resolved ${JSON.stringify(r)}`);
      }, (err) => {
        log.log(`rejected ${JSON.stringify(err)}`);
      });
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myObservable.firstObserverAdded",
        "myObservable.get"
      ]);
      myObservable.set({ state: "ready" }, void 0);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myObservable.set (value [object Object])",
        "myObservable.get",
        "myObservable.lastObserverRemoved"
      ]);
      await p;
      assert.deepStrictEqual(log.getAndClearEntries(), [
        'resolved {"state":"ready"}'
      ]);
    });
    test("resolveImmediate", async () => {
      const log = new Log();
      const myObservable = new LoggingObservableValue("myObservable", { state: "ready" }, log);
      const p = waitForState(myObservable, (p2) => p2.state === "ready", (p2) => p2.state === "error").then((r) => {
        log.log(`resolved ${JSON.stringify(r)}`);
      }, (err) => {
        log.log(`rejected ${JSON.stringify(err)}`);
      });
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myObservable.firstObserverAdded",
        "myObservable.get",
        "myObservable.lastObserverRemoved"
      ]);
      myObservable.set({ state: "error" }, void 0);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myObservable.set (value [object Object])"
      ]);
      await p;
      assert.deepStrictEqual(log.getAndClearEntries(), [
        'resolved {"state":"ready"}'
      ]);
    });
    test("reject", async () => {
      const log = new Log();
      const myObservable = new LoggingObservableValue("myObservable", { state: "initializing" }, log);
      const p = waitForState(myObservable, (p2) => p2.state === "ready", (p2) => p2.state === "error").then((r) => {
        log.log(`resolved ${JSON.stringify(r)}`);
      }, (err) => {
        log.log(`rejected ${JSON.stringify(err)}`);
      });
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myObservable.firstObserverAdded",
        "myObservable.get"
      ]);
      myObservable.set({ state: "error" }, void 0);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myObservable.set (value [object Object])",
        "myObservable.get",
        "myObservable.lastObserverRemoved"
      ]);
      await p;
      assert.deepStrictEqual(log.getAndClearEntries(), [
        'rejected {"state":"error"}'
      ]);
    });
    test("derived as lazy", () => {
      const store = new DisposableStore();
      const log = new Log();
      let i = 0;
      const d = derivedDisposable(() => {
        const id = i++;
        log.log("myDerived " + id);
        return {
          dispose: () => log.log(`disposed ${id}`)
        };
      });
      d.get();
      assert.deepStrictEqual(log.getAndClearEntries(), ["myDerived 0", "disposed 0"]);
      d.get();
      assert.deepStrictEqual(log.getAndClearEntries(), ["myDerived 1", "disposed 1"]);
      d.keepObserved(store);
      assert.deepStrictEqual(log.getAndClearEntries(), []);
      d.get();
      assert.deepStrictEqual(log.getAndClearEntries(), ["myDerived 2"]);
      d.get();
      assert.deepStrictEqual(log.getAndClearEntries(), []);
      store.dispose();
      assert.deepStrictEqual(log.getAndClearEntries(), ["disposed 2"]);
    });
  });
  test("observableValue", () => {
    const log = new Log();
    const myObservable1 = observableValue("myObservable1", 0);
    const myObservable2 = observableValue("myObservable2", 0);
    const d = autorun((reader) => {
      const v1 = myObservable1.read(reader);
      const v2 = myObservable2.read(reader);
      log.log("autorun, myObservable1:" + v1 + ", myObservable2:" + v2);
    });
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "autorun, myObservable1:0, myObservable2:0"
    ]);
    myObservable1.set(0, void 0);
    assert.deepStrictEqual(log.getAndClearEntries(), []);
    myObservable2.set(0, void 0, { message: "change1" });
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "autorun, myObservable1:0, myObservable2:0"
    ]);
    d.dispose();
  });
  suite("autorun error handling", () => {
    test("immediate throw", () => {
      const log = new Log();
      setUnexpectedErrorHandler((e) => {
        log.log(`error: ${e.message}`);
      });
      const myObservable = new LoggingObservableValue("myObservable", 0, log);
      const d = autorun((reader) => {
        myObservable.read(reader);
        throw new Error("foobar");
      });
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myObservable.firstObserverAdded",
        "myObservable.get",
        "error: foobar"
      ]);
      myObservable.set(1, void 0);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myObservable.set (value 1)",
        "myObservable.get",
        "error: foobar"
      ]);
      d.dispose();
    });
    test("late throw", () => {
      const log = new Log();
      setUnexpectedErrorHandler((e) => {
        log.log(`error: ${e.message}`);
      });
      const myObservable = new LoggingObservableValue("myObservable", 0, log);
      const d = autorun((reader) => {
        const value = myObservable.read(reader);
        if (value >= 1) {
          throw new Error("foobar");
        }
      });
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myObservable.firstObserverAdded",
        "myObservable.get"
      ]);
      myObservable.set(1, void 0);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myObservable.set (value 1)",
        "myObservable.get",
        "error: foobar"
      ]);
      myObservable.set(2, void 0);
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "myObservable.set (value 2)",
        "myObservable.get",
        "error: foobar"
      ]);
      d.dispose();
    });
  });
  test("recomputeInitiallyAndOnChange should work when a dependency sets an observable", () => {
    const store = new DisposableStore();
    const log = new Log();
    const myObservable = new LoggingObservableValue("myObservable", 0, log);
    let shouldUpdate = true;
    const myDerived = derived((reader) => {
      log.log("myDerived.computed start");
      const val = myObservable.read(reader);
      if (shouldUpdate) {
        shouldUpdate = false;
        myObservable.set(1, void 0);
      }
      log.log("myDerived.computed end");
      return val;
    });
    assert.deepStrictEqual(log.getAndClearEntries(), []);
    myDerived.recomputeInitiallyAndOnChange(store, (val) => {
      log.log(`recomputeInitiallyAndOnChange, myDerived: ${val}`);
    });
    assert.deepStrictEqual(log.getAndClearEntries(), [
      "myDerived.computed start",
      "myObservable.firstObserverAdded",
      "myObservable.get",
      "myObservable.set (value 1)",
      "myDerived.computed end",
      "myDerived.computed start",
      "myObservable.get",
      "myDerived.computed end",
      "recomputeInitiallyAndOnChange, myDerived: 1"
    ]);
    myDerived.get();
    assert.deepStrictEqual(log.getAndClearEntries(), []);
    store.dispose();
  });
  suite("prevent invalid usage", () => {
    suite("reading outside of compute function", () => {
      test("derived", () => {
        let fn = () => {
        };
        const obs = observableValue("obs", 0);
        const d = derived((reader) => {
          fn = () => {
            obs.read(reader);
          };
          return obs.read(reader);
        });
        const disp = autorun((reader) => {
          d.read(reader);
        });
        assert.throws(() => {
          fn();
        });
        disp.dispose();
      });
      test("autorun", () => {
        let fn = () => {
        };
        const obs = observableValue("obs", 0);
        const disp = autorun((reader) => {
          fn = () => {
            obs.read(reader);
          };
          obs.read(reader);
        });
        assert.throws(() => {
          fn();
        });
        disp.dispose();
      });
    });
    test.skip("catches cyclic dependencies", () => {
      const log = new Log();
      setUnexpectedErrorHandler((e) => {
        log.log(e.toString());
      });
      const obs = observableValue("obs", 0);
      const d1 = derived((reader) => {
        log.log("d1.computed start");
        const x = obs.read(reader) + d2.read(reader);
        log.log("d1.computed end");
        return x;
      });
      const d2 = derived((reader) => {
        log.log("d2.computed start");
        d1.read(reader);
        log.log("d2.computed end");
        return 0;
      });
      const disp = autorun((reader) => {
        log.log("autorun start");
        d1.read(reader);
        log.log("autorun end");
        return 0;
      });
      assert.deepStrictEqual(log.getAndClearEntries(), [
        "autorun start",
        "d1.computed start",
        "d2.computed start",
        "Error: Cyclic deriveds are not supported yet!",
        "d1.computed end",
        "autorun end"
      ]);
      disp.dispose();
    });
  });
});
class LoggingObserver {
  constructor(debugName, log) {
    this.debugName = debugName;
    this.log = log;
    this.count = 0;
  }
  beginUpdate(observable) {
    this.count++;
    this.log.log(`${this.debugName}.beginUpdate (count ${this.count})`);
  }
  endUpdate(observable) {
    this.log.log(`${this.debugName}.endUpdate (count ${this.count})`);
    this.count--;
  }
  handleChange(observable, change) {
    this.log.log(`${this.debugName}.handleChange (count ${this.count})`);
  }
  handlePossibleChange(observable) {
    this.log.log(`${this.debugName}.handlePossibleChange`);
  }
}
class LoggingObservableValue extends BaseObservable {
  constructor(debugName, initialValue, logger) {
    super();
    this.debugName = debugName;
    this.logger = logger;
    this.value = initialValue;
  }
  onFirstObserverAdded() {
    this.logger.log(`${this.debugName}.firstObserverAdded`);
  }
  onLastObserverRemoved() {
    this.logger.log(`${this.debugName}.lastObserverRemoved`);
  }
  get() {
    this.logger.log(`${this.debugName}.get`);
    return this.value;
  }
  set(value, tx, change) {
    if (this.value === value) {
      return;
    }
    if (!tx) {
      transaction((tx2) => {
        this.set(value, tx2, change);
      }, () => `Setting ${this.debugName}`);
      return;
    }
    this.logger.log(`${this.debugName}.set (value ${value})`);
    this.value = value;
    for (const observer of this._observers) {
      tx.updateObserver(observer, this);
      observer.handleChange(this, change);
    }
  }
  toString() {
    return `${this.debugName}: ${this.value}`;
  }
}
class Log {
  constructor() {
    this.entries = [];
  }
  log(message) {
    this.entries.push(message);
  }
  getAndClearEntries() {
    const entries = [...this.entries];
    this.entries.length = 0;
    return entries;
  }
}
export {
  LoggingObservableValue,
  LoggingObserver
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvY29tbW9uL29ic2VydmFibGUudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IHNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXV0b3J1biwgYXV0b3J1bkhhbmRsZUNoYW5nZXMsIGRlcml2ZWQsIGRlcml2ZWREaXNwb3NhYmxlLCBJT2JzZXJ2YWJsZSwgSU9ic2VydmVyLCBJU2V0dGFibGVPYnNlcnZhYmxlLCBJVHJhbnNhY3Rpb24sIGtlZXBPYnNlcnZlZCwgb2JzZXJ2YWJsZUZyb21FdmVudCwgb2JzZXJ2YWJsZVNpZ25hbCwgb2JzZXJ2YWJsZVZhbHVlLCB0cmFuc2FjdGlvbiwgd2FpdEZvclN0YXRlIH0gZnJvbSAnLi4vLi4vY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgQmFzZU9ic2VydmFibGUsIElPYnNlcnZhYmxlV2l0aENoYW5nZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9vYnNlcnZhYmxlSW50ZXJuYWwvYmFzZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuL3V0aWxzLmpzJztcblxuc3VpdGUoJ29ic2VydmFibGVzJywgKCkgPT4ge1xuXHRjb25zdCBkcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdC8qKlxuXHQgKiBSZWFkcyB0aGVzZSB0ZXN0cyB0byB1bmRlcnN0YW5kIGhvdyB0byB1c2Ugb2JzZXJ2YWJsZXMuXG5cdCAqL1xuXHRzdWl0ZSgndHV0b3JpYWwnLCAoKSA9PiB7XG5cdFx0dGVzdCgnb2JzZXJ2YWJsZSArIGF1dG9ydW4nLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBsb2cgPSBuZXcgTG9nKCk7XG5cdFx0XHQvLyBUaGlzIGNyZWF0ZXMgYSB2YXJpYWJsZSB0aGF0IHN0b3JlcyBhIHZhbHVlIGFuZCB3aG9zZSB2YWx1ZSBjaGFuZ2VzIGNhbiBiZSBvYnNlcnZlZC5cblx0XHRcdC8vIFRoZSBuYW1lIGlzIG9ubHkgdXNlZCBmb3IgZGVidWdnaW5nIHB1cnBvc2VzLlxuXHRcdFx0Ly8gVGhlIHNlY29uZCBhcmcgaXMgdGhlIGluaXRpYWwgdmFsdWUuXG5cdFx0XHRjb25zdCBteU9ic2VydmFibGUgPSBvYnNlcnZhYmxlVmFsdWUoJ215T2JzZXJ2YWJsZScsIDApO1xuXG5cdFx0XHQvLyBUaGlzIGNyZWF0ZXMgYW4gYXV0b3J1bjogSXQgcnVucyBpbW1lZGlhdGVseSBhbmQgdGhlbiBhZ2FpbiB3aGVuZXZlciBhbnkgb2YgdGhlXG5cdFx0XHQvLyBkZXBlbmRlbmNpZXMgY2hhbmdlLiBEZXBlbmRlbmNpZXMgYXJlIHRyYWNrZWQgYnkgcmVhZGluZyBvYnNlcnZhYmxlcyB3aXRoIHRoZSBgcmVhZGVyYCBwYXJhbWV0ZXIuXG5cdFx0XHQvL1xuXHRcdFx0Ly8gVGhlIEBkZXNjcmlwdGlvbiBpcyBvbmx5IHVzZWQgZm9yIGRlYnVnZ2luZyBwdXJwb3Nlcy5cblx0XHRcdC8vIFRoZSBhdXRvcnVuIGhhcyB0byBiZSBkaXNwb3NlZCEgVGhpcyBpcyB2ZXJ5IGltcG9ydGFudC5cblx0XHRcdGRzLmFkZChhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRcdC8qKiBAZGVzY3JpcHRpb24gbXlBdXRvcnVuICovXG5cblx0XHRcdFx0Ly8gVGhpcyBjb2RlIGlzIHJ1biBpbW1lZGlhdGVseS5cblxuXHRcdFx0XHQvLyBVc2UgdGhlIGByZWFkZXJgIHRvIHJlYWQgb2JzZXJ2YWJsZSB2YWx1ZXMgYW5kIHRyYWNrIHRoZSBkZXBlbmRlbmN5IHRvIHRoZW0uXG5cdFx0XHRcdC8vIElmIHlvdSB1c2UgYG9ic2VydmFibGUuZ2V0KClgIGluc3RlYWQgb2YgYG9ic2VydmFibGUucmVhZChyZWFkZXIpYCwgeW91IHdpbGwganVzdFxuXHRcdFx0XHQvLyBnZXQgdGhlIHZhbHVlIGFuZCBub3Qgc3Vic2NyaWJlIHRvIGl0LlxuXHRcdFx0XHRsb2cubG9nKGBteUF1dG9ydW4ucnVuKG15T2JzZXJ2YWJsZTogJHtteU9ic2VydmFibGUucmVhZChyZWFkZXIpfSlgKTtcblxuXHRcdFx0XHQvLyBOb3cgdGhhdCBhbGwgZGVwZW5kZW5jaWVzIGFyZSB0cmFja2VkLCB0aGUgYXV0b3J1biBpcyByZS1ydW4gd2hlbmV2ZXIgYW55IG9mIHRoZVxuXHRcdFx0XHQvLyBkZXBlbmRlbmNpZXMgY2hhbmdlLlxuXHRcdFx0fSkpO1xuXHRcdFx0Ly8gVGhlIGF1dG9ydW4gcnVucyBpbW1lZGlhdGVseVxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFsnbXlBdXRvcnVuLnJ1bihteU9ic2VydmFibGU6IDApJ10pO1xuXG5cdFx0XHQvLyBXZSBzZXQgdGhlIG9ic2VydmFibGUuXG5cdFx0XHRteU9ic2VydmFibGUuc2V0KDEsIHVuZGVmaW5lZCk7XG5cdFx0XHQvLyAtPiBUaGUgYXV0b3J1biBydW5zIGFnYWluIHdoZW4gYW55IHJlYWQgb2JzZXJ2YWJsZSBjaGFuZ2VkXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgWydteUF1dG9ydW4ucnVuKG15T2JzZXJ2YWJsZTogMSknXSk7XG5cblx0XHRcdC8vIFdlIHNldCB0aGUgb2JzZXJ2YWJsZSBhZ2Fpbi5cblx0XHRcdG15T2JzZXJ2YWJsZS5zZXQoMSwgdW5kZWZpbmVkKTtcblx0XHRcdC8vIC0+IFRoZSBhdXRvcnVuIGRvZXMgbm90IHJ1biBhZ2FpbiwgYmVjYXVzZSB0aGUgb2JzZXJ2YWJsZSBkaWRuJ3QgY2hhbmdlLlxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtdKTtcblxuXHRcdFx0Ly8gVHJhbnNhY3Rpb25zIGJhdGNoIGF1dG9ydW4gcnVuc1xuXHRcdFx0dHJhbnNhY3Rpb24oKHR4KSA9PiB7XG5cdFx0XHRcdG15T2JzZXJ2YWJsZS5zZXQoMiwgdHgpO1xuXHRcdFx0XHQvLyBObyBhdXRvLXJ1biByYW4geWV0LCBldmVuIHRob3VnaCB0aGUgdmFsdWUgY2hhbmdlZCFcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtdKTtcblxuXHRcdFx0XHRteU9ic2VydmFibGUuc2V0KDMsIHR4KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtdKTtcblx0XHRcdH0pO1xuXHRcdFx0Ly8gT25seSBhdCB0aGUgZW5kIG9mIHRoZSB0cmFuc2FjdGlvbiB0aGUgYXV0b3J1biByZS1ydW5zXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgWydteUF1dG9ydW4ucnVuKG15T2JzZXJ2YWJsZTogMyknXSk7XG5cblx0XHRcdC8vIE5vdGUgdGhhdCB0aGUgYXV0b3J1biBkaWQgbm90IHNlZSB0aGUgaW50ZXJtZWRpYXRlIHZhbHVlIGAyYCFcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2Rlcml2ZWQgKyBhdXRvcnVuJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbG9nID0gbmV3IExvZygpO1xuXHRcdFx0Y29uc3Qgb2JzZXJ2YWJsZTEgPSBvYnNlcnZhYmxlVmFsdWUoJ215T2JzZXJ2YWJsZTEnLCAwKTtcblx0XHRcdGNvbnN0IG9ic2VydmFibGUyID0gb2JzZXJ2YWJsZVZhbHVlKCdteU9ic2VydmFibGUyJywgMCk7XG5cblx0XHRcdC8vIEEgZGVyaXZlZCB2YWx1ZSBpcyBhbiBvYnNlcnZhYmxlIHRoYXQgaXMgZGVyaXZlZCBmcm9tIG90aGVyIG9ic2VydmFibGVzLlxuXHRcdFx0Y29uc3QgbXlEZXJpdmVkID0gZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdFx0XHQvKiogQGRlc2NyaXB0aW9uIG15RGVyaXZlZCAqL1xuXHRcdFx0XHRjb25zdCB2YWx1ZTEgPSBvYnNlcnZhYmxlMS5yZWFkKHJlYWRlcik7IC8vIFVzZSB0aGUgcmVhZGVyIHRvIHRyYWNrIGRlcGVuZGVuY2llcy5cblx0XHRcdFx0Y29uc3QgdmFsdWUyID0gb2JzZXJ2YWJsZTIucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRjb25zdCBzdW0gPSB2YWx1ZTEgKyB2YWx1ZTI7XG5cdFx0XHRcdGxvZy5sb2coYG15RGVyaXZlZC5yZWNvbXB1dGU6ICR7dmFsdWUxfSArICR7dmFsdWUyfSA9ICR7c3VtfWApO1xuXHRcdFx0XHRyZXR1cm4gc3VtO1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIFdlIGNyZWF0ZSBhbiBhdXRvcnVuIHRoYXQgcmVhY3RzIG9uIGNoYW5nZXMgdG8gb3VyIGRlcml2ZWQgdmFsdWUuXG5cdFx0XHRkcy5hZGQoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0XHQvKiogQGRlc2NyaXB0aW9uIG15QXV0b3J1biAqL1xuXHRcdFx0XHQvLyBBdXRvcnVucyB3b3JrIHdpdGggb2JzZXJ2YWJsZSB2YWx1ZXMgYW5kIGRlcml2ZWRzIC0gaW4gc2hvcnQsIHRoZXkgd29yayB3aXRoIGFueSBvYnNlcnZhYmxlLlxuXHRcdFx0XHRsb2cubG9nKGBteUF1dG9ydW4obXlEZXJpdmVkOiAke215RGVyaXZlZC5yZWFkKHJlYWRlcil9KWApO1xuXHRcdFx0fSkpO1xuXHRcdFx0Ly8gYXV0b3J1biBydW5zIGltbWVkaWF0ZWx5XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XHRcIm15RGVyaXZlZC5yZWNvbXB1dGU6IDAgKyAwID0gMFwiLFxuXHRcdFx0XHRcIm15QXV0b3J1bihteURlcml2ZWQ6IDApXCIsXG5cdFx0XHRdKTtcblxuXHRcdFx0b2JzZXJ2YWJsZTEuc2V0KDEsIHVuZGVmaW5lZCk7XG5cdFx0XHQvLyBhbmQgb24gY2hhbmdlcy4uLlxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0XCJteURlcml2ZWQucmVjb21wdXRlOiAxICsgMCA9IDFcIixcblx0XHRcdFx0XCJteUF1dG9ydW4obXlEZXJpdmVkOiAxKVwiLFxuXHRcdFx0XSk7XG5cblx0XHRcdG9ic2VydmFibGUyLnNldCgxLCB1bmRlZmluZWQpO1xuXHRcdFx0Ly8gLi4uIG9mIGFueSBkZXBlbmRlbmN5LlxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0XCJteURlcml2ZWQucmVjb21wdXRlOiAxICsgMSA9IDJcIixcblx0XHRcdFx0XCJteUF1dG9ydW4obXlEZXJpdmVkOiAyKVwiLFxuXHRcdFx0XSk7XG5cblx0XHRcdC8vIE5vdyB3ZSBjaGFuZ2UgbXVsdGlwbGUgb2JzZXJ2YWJsZXMgaW4gYSB0cmFuc2FjdGlvbiB0byBiYXRjaCBwcm9jZXNzIHRoZSBlZmZlY3RzLlxuXHRcdFx0dHJhbnNhY3Rpb24oKHR4KSA9PiB7XG5cdFx0XHRcdG9ic2VydmFibGUxLnNldCg1LCB0eCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXSk7XG5cblx0XHRcdFx0b2JzZXJ2YWJsZTIuc2V0KDUsIHR4KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtdKTtcblx0XHRcdH0pO1xuXHRcdFx0Ly8gV2hlbiBjaGFuZ2luZyBtdWx0aXBsZSBvYnNlcnZhYmxlcyBpbiBhIHRyYW5zYWN0aW9uLFxuXHRcdFx0Ly8gZGVyaXZlZHMgYXJlIG9ubHkgcmVjb21wdXRlZCBvbiBkZW1hbmQuXG5cdFx0XHQvLyAoTm90ZSB0aGF0IHlvdSBjYW5ub3Qgc2VlIHRoZSBpbnRlcm1lZGlhdGUgdmFsdWUgd2hlbiBgb2JzMSA9PSA1YCBhbmQgYG9iczIgPT0gMWApXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XHRcIm15RGVyaXZlZC5yZWNvbXB1dGU6IDUgKyA1ID0gMTBcIixcblx0XHRcdFx0XCJteUF1dG9ydW4obXlEZXJpdmVkOiAxMClcIixcblx0XHRcdF0pO1xuXG5cdFx0XHR0cmFuc2FjdGlvbigodHgpID0+IHtcblx0XHRcdFx0b2JzZXJ2YWJsZTEuc2V0KDYsIHR4KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtdKTtcblxuXHRcdFx0XHRvYnNlcnZhYmxlMi5zZXQoNCwgdHgpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW10pO1xuXHRcdFx0fSk7XG5cdFx0XHQvLyBOb3cgdGhlIGF1dG9ydW4gZGlkbid0IHJ1biBhZ2FpbiwgYmVjYXVzZSBpdHMgZGVwZW5kZW5jeSBjaGFuZ2VkIGZyb20gMTAgdG8gMTAgKD0gbm8gY2hhbmdlKS5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCAoW1wibXlEZXJpdmVkLnJlY29tcHV0ZTogNiArIDQgPSAxMFwiXSkpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncmVhZCBkdXJpbmcgdHJhbnNhY3Rpb24nLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBsb2cgPSBuZXcgTG9nKCk7XG5cdFx0XHRjb25zdCBvYnNlcnZhYmxlMSA9IG9ic2VydmFibGVWYWx1ZSgnbXlPYnNlcnZhYmxlMScsIDApO1xuXHRcdFx0Y29uc3Qgb2JzZXJ2YWJsZTIgPSBvYnNlcnZhYmxlVmFsdWUoJ215T2JzZXJ2YWJsZTInLCAwKTtcblxuXHRcdFx0Y29uc3QgbXlEZXJpdmVkID0gZGVyaXZlZCgocmVhZGVyKSA9PiB7XG5cdFx0XHRcdC8qKiBAZGVzY3JpcHRpb24gbXlEZXJpdmVkICovXG5cdFx0XHRcdGNvbnN0IHZhbHVlMSA9IG9ic2VydmFibGUxLnJlYWQocmVhZGVyKTtcblx0XHRcdFx0Y29uc3QgdmFsdWUyID0gb2JzZXJ2YWJsZTIucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRjb25zdCBzdW0gPSB2YWx1ZTEgKyB2YWx1ZTI7XG5cdFx0XHRcdGxvZy5sb2coYG15RGVyaXZlZC5yZWNvbXB1dGU6ICR7dmFsdWUxfSArICR7dmFsdWUyfSA9ICR7c3VtfWApO1xuXHRcdFx0XHRyZXR1cm4gc3VtO1xuXHRcdFx0fSk7XG5cblx0XHRcdGRzLmFkZChhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRcdC8qKiBAZGVzY3JpcHRpb24gbXlBdXRvcnVuICovXG5cdFx0XHRcdGxvZy5sb2coYG15QXV0b3J1bihteURlcml2ZWQ6ICR7bXlEZXJpdmVkLnJlYWQocmVhZGVyKX0pYCk7XG5cdFx0XHR9KSk7XG5cdFx0XHQvLyBhdXRvcnVuIHJ1bnMgaW1tZWRpYXRlbHlcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdFwibXlEZXJpdmVkLnJlY29tcHV0ZTogMCArIDAgPSAwXCIsXG5cdFx0XHRcdFwibXlBdXRvcnVuKG15RGVyaXZlZDogMClcIixcblx0XHRcdF0pO1xuXG5cdFx0XHR0cmFuc2FjdGlvbigodHgpID0+IHtcblx0XHRcdFx0b2JzZXJ2YWJsZTEuc2V0KC0xMCwgdHgpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW10pO1xuXG5cdFx0XHRcdG15RGVyaXZlZC5nZXQoKTsgLy8gVGhpcyBmb3JjZXMgYSAoc3luYykgcmVjb21wdXRhdGlvbiBvZiB0aGUgY3VycmVudCB2YWx1ZSFcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIChbXCJteURlcml2ZWQucmVjb21wdXRlOiAtMTAgKyAwID0gLTEwXCJdKSk7XG5cdFx0XHRcdC8vIFRoaXMgbWVhbnMsIHRoYXQgZXZlbiBpbiB0cmFuc2FjdGlvbnMgeW91IGNhbiBhc3N1bWUgdGhhdCBhbGwgdmFsdWVzIHlvdSBjYW4gcmVhZCB3aXRoIGBnZXRgIGFuZCBgcmVhZGAgYXJlIHVwLXRvLWRhdGUuXG5cdFx0XHRcdC8vIFJlYWQgdGhlc2UgdmFsdWVzIGp1c3QgbWlnaHQgY2F1c2UgYWRkaXRpb25hbCAocG90ZW50aWFsbHkgdW5uZWVkZWQpIHJlY29tcHV0YXRpb25zLlxuXG5cdFx0XHRcdG9ic2VydmFibGUyLnNldCgxMCwgdHgpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW10pO1xuXHRcdFx0fSk7XG5cdFx0XHQvLyBUaGlzIGF1dG9ydW4gcnVucyBhZ2FpbiwgYmVjYXVzZSBpdHMgZGVwZW5kZW5jeSBjaGFuZ2VkIGZyb20gMCB0byAtMTAgYW5kIHRoZW4gYmFjayB0byAwLlxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0XCJteURlcml2ZWQucmVjb21wdXRlOiAtMTAgKyAxMCA9IDBcIixcblx0XHRcdFx0XCJteUF1dG9ydW4obXlEZXJpdmVkOiAwKVwiLFxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdnZXQgd2l0aG91dCBvYnNlcnZlcnMnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBsb2cgPSBuZXcgTG9nKCk7XG5cdFx0XHRjb25zdCBvYnNlcnZhYmxlMSA9IG9ic2VydmFibGVWYWx1ZSgnbXlPYnNlcnZhYmxlVmFsdWUxJywgMCk7XG5cblx0XHRcdC8vIFdlIHNldCB1cCBzb21lIGNvbXB1dGVkcy5cblx0XHRcdGNvbnN0IGNvbXB1dGVkMSA9IGRlcml2ZWQoKHJlYWRlcikgPT4ge1xuXHRcdFx0XHQvKiogQGRlc2NyaXB0aW9uIGNvbXB1dGVkICovXG5cdFx0XHRcdGNvbnN0IHZhbHVlMSA9IG9ic2VydmFibGUxLnJlYWQocmVhZGVyKTtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gdmFsdWUxICUgMztcblx0XHRcdFx0bG9nLmxvZyhgcmVjb21wdXRlMTogJHt2YWx1ZTF9ICUgMyA9ICR7cmVzdWx0fWApO1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCBjb21wdXRlZDIgPSBkZXJpdmVkKChyZWFkZXIpID0+IHtcblx0XHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBjb21wdXRlZCAqL1xuXHRcdFx0XHRjb25zdCB2YWx1ZTEgPSBjb21wdXRlZDEucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSB2YWx1ZTEgKiAyO1xuXHRcdFx0XHRsb2cubG9nKGByZWNvbXB1dGUyOiAke3ZhbHVlMX0gKiAyID0gJHtyZXN1bHR9YCk7XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IGNvbXB1dGVkMyA9IGRlcml2ZWQoKHJlYWRlcikgPT4ge1xuXHRcdFx0XHQvKiogQGRlc2NyaXB0aW9uIGNvbXB1dGVkICovXG5cdFx0XHRcdGNvbnN0IHZhbHVlMSA9IGNvbXB1dGVkMS5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IHZhbHVlMSAqIDM7XG5cdFx0XHRcdGxvZy5sb2coYHJlY29tcHV0ZTM6ICR7dmFsdWUxfSAqIDMgPSAke3Jlc3VsdH1gKTtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH0pO1xuXHRcdFx0Y29uc3QgY29tcHV0ZWRTdW0gPSBkZXJpdmVkKChyZWFkZXIpID0+IHtcblx0XHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBjb21wdXRlZCAqL1xuXHRcdFx0XHRjb25zdCB2YWx1ZTEgPSBjb21wdXRlZDIucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRjb25zdCB2YWx1ZTIgPSBjb21wdXRlZDMucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSB2YWx1ZTEgKyB2YWx1ZTI7XG5cdFx0XHRcdGxvZy5sb2coYHJlY29tcHV0ZTQ6ICR7dmFsdWUxfSArICR7dmFsdWUyfSA9ICR7cmVzdWx0fWApO1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW10pO1xuXG5cdFx0XHRvYnNlcnZhYmxlMS5zZXQoMSwgdW5kZWZpbmVkKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXSk7XG5cblx0XHRcdC8vIEFuZCBub3cgcmVhZCB0aGUgY29tcHV0ZWQgdGhhdCBkZXBlbmRlbnMgb24gYWxsIHRoZSBvdGhlcnMuXG5cdFx0XHRsb2cubG9nKGB2YWx1ZTogJHtjb21wdXRlZFN1bS5nZXQoKX1gKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdCdyZWNvbXB1dGUxOiAxICUgMyA9IDEnLFxuXHRcdFx0XHQncmVjb21wdXRlMjogMSAqIDIgPSAyJyxcblx0XHRcdFx0J3JlY29tcHV0ZTM6IDEgKiAzID0gMycsXG5cdFx0XHRcdCdyZWNvbXB1dGU0OiAyICsgMyA9IDUnLFxuXHRcdFx0XHQndmFsdWU6IDUnLFxuXHRcdFx0XSk7XG5cblx0XHRcdGxvZy5sb2coYHZhbHVlOiAke2NvbXB1dGVkU3VtLmdldCgpfWApO1xuXHRcdFx0Ly8gQmVjYXVzZSB0aGVyZSBhcmUgbm8gb2JzZXJ2ZXJzLCB0aGUgZGVyaXZlZCB2YWx1ZXMgYXJlIG5vdCBjYWNoZWQgKCEpLCBidXQgY29tcHV0ZWQgZnJvbSBzY3JhdGNoLlxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0J3JlY29tcHV0ZTE6IDEgJSAzID0gMScsXG5cdFx0XHRcdCdyZWNvbXB1dGUyOiAxICogMiA9IDInLFxuXHRcdFx0XHQncmVjb21wdXRlMzogMSAqIDMgPSAzJyxcblx0XHRcdFx0J3JlY29tcHV0ZTQ6IDIgKyAzID0gNScsXG5cdFx0XHRcdCd2YWx1ZTogNScsXG5cdFx0XHRdKTtcblxuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGtlZXBPYnNlcnZlZChjb21wdXRlZFN1bSk7IC8vIFVzZSBrZWVwT2JzZXJ2ZWQgdG8ga2VlcCB0aGUgY2FjaGUuXG5cdFx0XHQvLyBZb3UgY2FuIGFsc28gdXNlIGBjb21wdXRlZFN1bS5rZWVwT2JzZXJ2ZWQoc3RvcmUpYCBmb3IgYW4gaW5saW5lIGV4cGVyaWVuY2UuXG5cdFx0XHRsb2cubG9nKGB2YWx1ZTogJHtjb21wdXRlZFN1bS5nZXQoKX1gKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdCdyZWNvbXB1dGUxOiAxICUgMyA9IDEnLFxuXHRcdFx0XHQncmVjb21wdXRlMjogMSAqIDIgPSAyJyxcblx0XHRcdFx0J3JlY29tcHV0ZTM6IDEgKiAzID0gMycsXG5cdFx0XHRcdCdyZWNvbXB1dGU0OiAyICsgMyA9IDUnLFxuXHRcdFx0XHQndmFsdWU6IDUnLFxuXHRcdFx0XSk7XG5cblx0XHRcdGxvZy5sb2coYHZhbHVlOiAke2NvbXB1dGVkU3VtLmdldCgpfWApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0J3ZhbHVlOiA1Jyxcblx0XHRcdF0pO1xuXHRcdFx0Ly8gVGFkYSwgbm8gcmVjb21wdXRhdGlvbnMhXG5cblx0XHRcdG9ic2VydmFibGUxLnNldCgyLCB1bmRlZmluZWQpO1xuXHRcdFx0Ly8gVGhlIGtlZXBPYnNlcnZlZCBkb2VzIG5vdCBmb3JjZSBkZXJpdmVkcyB0byBiZSByZWNvbXB1dGVkISBUaGV5IGFyZSBzdGlsbCBsYXp5LlxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIChbXSkpO1xuXG5cdFx0XHRsb2cubG9nKGB2YWx1ZTogJHtjb21wdXRlZFN1bS5nZXQoKX1gKTtcblx0XHRcdC8vIFRob3NlIGRlcml2ZWRzIGFyZSByZWNvbXB1dGVkIG9uIGRlbWFuZCwgaS5lLiB3aGVuIHNvbWVvbmUgcmVhZHMgdGhlbS5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdFwicmVjb21wdXRlMTogMiAlIDMgPSAyXCIsXG5cdFx0XHRcdFwicmVjb21wdXRlMjogMiAqIDIgPSA0XCIsXG5cdFx0XHRcdFwicmVjb21wdXRlMzogMiAqIDMgPSA2XCIsXG5cdFx0XHRcdFwicmVjb21wdXRlNDogNCArIDYgPSAxMFwiLFxuXHRcdFx0XHRcInZhbHVlOiAxMFwiLFxuXHRcdFx0XSk7XG5cdFx0XHRsb2cubG9nKGB2YWx1ZTogJHtjb21wdXRlZFN1bS5nZXQoKX1gKTtcblx0XHRcdC8vIC4uLiBhbmQgdGhlbiBjYWNoZWQgYWdhaW5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCAoW1widmFsdWU6IDEwXCJdKSk7XG5cblx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpOyAvLyBEb24ndCBmb3JnZXQgdG8gZGlzcG9zZSB0aGUga2VlcEFsaXZlIHRvIHByZXZlbnQgbWVtb3J5IGxlYWtzIVxuXG5cdFx0XHRsb2cubG9nKGB2YWx1ZTogJHtjb21wdXRlZFN1bS5nZXQoKX1gKTtcblx0XHRcdC8vIFdoaWNoIGRpc2FibGVzIHRoZSBjYWNoZSBhZ2FpblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0XCJyZWNvbXB1dGUxOiAyICUgMyA9IDJcIixcblx0XHRcdFx0XCJyZWNvbXB1dGUyOiAyICogMiA9IDRcIixcblx0XHRcdFx0XCJyZWNvbXB1dGUzOiAyICogMyA9IDZcIixcblx0XHRcdFx0XCJyZWNvbXB1dGU0OiA0ICsgNiA9IDEwXCIsXG5cdFx0XHRcdFwidmFsdWU6IDEwXCIsXG5cdFx0XHRdKTtcblxuXHRcdFx0bG9nLmxvZyhgdmFsdWU6ICR7Y29tcHV0ZWRTdW0uZ2V0KCl9YCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XHRcInJlY29tcHV0ZTE6IDIgJSAzID0gMlwiLFxuXHRcdFx0XHRcInJlY29tcHV0ZTI6IDIgKiAyID0gNFwiLFxuXHRcdFx0XHRcInJlY29tcHV0ZTM6IDIgKiAzID0gNlwiLFxuXHRcdFx0XHRcInJlY29tcHV0ZTQ6IDQgKyA2ID0gMTBcIixcblx0XHRcdFx0XCJ2YWx1ZTogMTBcIixcblx0XHRcdF0pO1xuXG5cdFx0XHQvLyBXaHkgZG9uJ3Qgd2UganVzdCBhbHdheXMga2VlcCB0aGUgY2FjaGUgYWxpdmU/XG5cdFx0XHQvLyBUaGlzIGlzIGJlY2F1c2UgaW4gb3JkZXIgdG8ga2VlcCB0aGUgY2FjaGUgYWxpdmUsIHdlIGhhdmUgdG8ga2VlcCBvdXIgc3Vic2NyaXB0aW9ucyB0byBvdXIgZGVwZW5kZW5jaWVzIGFsaXZlLFxuXHRcdFx0Ly8gd2hpY2ggY291bGQgY2F1c2UgbWVtb3J5LWxlYWtzLlxuXHRcdFx0Ly8gU28gaW5zdGVhZCwgd2hlbiB0aGUgbGFzdCBvYnNlcnZlciBvZiBhIGRlcml2ZWQgaXMgZGlzcG9zZWQsIHdlIGRpc3Bvc2Ugb3VyIHN1YnNjcmlwdGlvbnMgdG8gb3VyIGRlcGVuZGVuY2llcy5cblx0XHRcdC8vIGBrZWVwT2JzZXJ2ZWRgIGp1c3QgcHJldmVudHMgdGhpcyBmcm9tIGhhcHBlbmluZy5cblx0XHR9KTtcblxuXHRcdHRlc3QoJ2F1dG9ydW4gdGhhdCByZWNlaXZlcyBkZWx0YXMgb2Ygc2lnbmFscycsICgpID0+IHtcblx0XHRcdGNvbnN0IGxvZyA9IG5ldyBMb2coKTtcblxuXHRcdFx0Ly8gQSBzaWduYWwgaXMgYW4gb2JzZXJ2YWJsZSB3aXRob3V0IGEgdmFsdWUuXG5cdFx0XHQvLyBIb3dldmVyLCBpdCBjYW4gc2hpcCBjaGFuZ2UgaW5mb3JtYXRpb24gd2hlbiBpdCBpcyB0cmlnZ2VyZWQuXG5cdFx0XHQvLyBSZWFkZXJzIGNhbiBwcm9jZXNzL2FnZ3JlZ2F0ZSB0aGlzIGNoYW5nZSBpbmZvcm1hdGlvbi5cblx0XHRcdGNvbnN0IHNpZ25hbCA9IG9ic2VydmFibGVTaWduYWw8eyBtc2c6IHN0cmluZyB9Pignc2lnbmFsJyk7XG5cblx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBhdXRvcnVuSGFuZGxlQ2hhbmdlcyh7XG5cdFx0XHRcdC8vIFRoZSBjaGFuZ2Ugc3VtbWFyeSBpcyB1c2VkIHRvIGNvbGxlY3QgdGhlIGNoYW5nZXNcblx0XHRcdFx0Y3JlYXRlRW1wdHlDaGFuZ2VTdW1tYXJ5OiAoKSA9PiAoeyBtc2dzOiBbXSBhcyBzdHJpbmdbXSB9KSxcblx0XHRcdFx0aGFuZGxlQ2hhbmdlKGNvbnRleHQsIGNoYW5nZVN1bW1hcnkpIHtcblx0XHRcdFx0XHRpZiAoY29udGV4dC5kaWRDaGFuZ2Uoc2lnbmFsKSkge1xuXHRcdFx0XHRcdFx0Ly8gV2UganVzdCBwdXNoIHRoZSBjaGFuZ2VzIGludG8gYW4gYXJyYXlcblx0XHRcdFx0XHRcdGNoYW5nZVN1bW1hcnkubXNncy5wdXNoKGNvbnRleHQuY2hhbmdlLm1zZyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0cnVlOyAvLyBXZSB3YW50IHRvIGhhbmRsZSB0aGUgY2hhbmdlXG5cdFx0XHRcdH0sXG5cdFx0XHR9LCAocmVhZGVyLCBjaGFuZ2VTdW1tYXJ5KSA9PiB7XG5cdFx0XHRcdC8vIFdoZW4gaGFuZGxpbmcgdGhlIGNoYW5nZSwgbWFrZSBzdXJlIHRvIHJlYWQgdGhlIHNpZ25hbCFcblx0XHRcdFx0c2lnbmFsLnJlYWQocmVhZGVyKTtcblx0XHRcdFx0bG9nLmxvZygnbXNnczogJyArIGNoYW5nZVN1bW1hcnkubXNncy5qb2luKCcsICcpKTtcblx0XHRcdH0pO1xuXG5cblx0XHRcdHNpZ25hbC50cmlnZ2VyKHVuZGVmaW5lZCwgeyBtc2c6ICdmb29iYXInIH0pO1xuXG5cdFx0XHR0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHRcdC8vIFlvdSBjYW4gYmF0Y2ggdHJpZ2dlcmluZyBzaWduYWxzLlxuXHRcdFx0XHQvLyBObyBkZWx0YSBpbmZvcm1hdGlvbiBpcyBsb3N0IVxuXHRcdFx0XHRzaWduYWwudHJpZ2dlcih0eCwgeyBtc2c6ICdoZWxsbycgfSk7XG5cdFx0XHRcdHNpZ25hbC50cmlnZ2VyKHR4LCB7IG1zZzogJ3dvcmxkJyB9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XHQnbXNnczogJyxcblx0XHRcdFx0J21zZ3M6IGZvb2JhcicsXG5cdFx0XHRcdCdtc2dzOiBoZWxsbywgd29ybGQnXG5cdFx0XHRdKTtcblxuXHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cblx0XHQvLyBUaGF0IGlzIHRoZSBlbmQgb2YgdGhlIHR1dG9yaWFsLlxuXHRcdC8vIFRoZXJlIGFyZSBsb3RzIG9mIHV0aWxpdGllcyB5b3UgY2FuIGV4cGxvcmUgbm93LCBsaWtlIGBvYnNlcnZhYmxlRnJvbUV2ZW50YCwgYEV2ZW50LmZyb21PYnNlcnZhYmxlTGlnaHRgLFxuXHRcdC8vIGF1dG9ydW5XaXRoU3RvcmUsIG9ic2VydmFibGVXaXRoU3RvcmUgYW5kIHNvIG9uLlxuXHR9KTtcblxuXHR0ZXN0KCd0b3BvbG9naWNhbCBvcmRlcicsICgpID0+IHtcblx0XHRjb25zdCBsb2cgPSBuZXcgTG9nKCk7XG5cdFx0Y29uc3QgbXlPYnNlcnZhYmxlMSA9IG9ic2VydmFibGVWYWx1ZSgnbXlPYnNlcnZhYmxlMScsIDApO1xuXHRcdGNvbnN0IG15T2JzZXJ2YWJsZTIgPSBvYnNlcnZhYmxlVmFsdWUoJ215T2JzZXJ2YWJsZTInLCAwKTtcblxuXHRcdGNvbnN0IG15Q29tcHV0ZWQxID0gZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBteUNvbXB1dGVkMSAqL1xuXHRcdFx0Y29uc3QgdmFsdWUxID0gbXlPYnNlcnZhYmxlMS5yZWFkKHJlYWRlcik7XG5cdFx0XHRjb25zdCB2YWx1ZTIgPSBteU9ic2VydmFibGUyLnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IHN1bSA9IHZhbHVlMSArIHZhbHVlMjtcblx0XHRcdGxvZy5sb2coYG15Q29tcHV0ZWQxLnJlY29tcHV0ZShteU9ic2VydmFibGUxOiAke3ZhbHVlMX0gKyBteU9ic2VydmFibGUyOiAke3ZhbHVlMn0gPSAke3N1bX0pYCk7XG5cdFx0XHRyZXR1cm4gc3VtO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgbXlDb21wdXRlZDIgPSBkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIG15Q29tcHV0ZWQyICovXG5cdFx0XHRjb25zdCB2YWx1ZTEgPSBteUNvbXB1dGVkMS5yZWFkKHJlYWRlcik7XG5cdFx0XHRjb25zdCB2YWx1ZTIgPSBteU9ic2VydmFibGUxLnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IHZhbHVlMyA9IG15T2JzZXJ2YWJsZTIucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3Qgc3VtID0gdmFsdWUxICsgdmFsdWUyICsgdmFsdWUzO1xuXHRcdFx0bG9nLmxvZyhgbXlDb21wdXRlZDIucmVjb21wdXRlKG15Q29tcHV0ZWQxOiAke3ZhbHVlMX0gKyBteU9ic2VydmFibGUxOiAke3ZhbHVlMn0gKyBteU9ic2VydmFibGUyOiAke3ZhbHVlM30gPSAke3N1bX0pYCk7XG5cdFx0XHRyZXR1cm4gc3VtO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgbXlDb21wdXRlZDMgPSBkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIG15Q29tcHV0ZWQzICovXG5cdFx0XHRjb25zdCB2YWx1ZTEgPSBteUNvbXB1dGVkMi5yZWFkKHJlYWRlcik7XG5cdFx0XHRjb25zdCB2YWx1ZTIgPSBteU9ic2VydmFibGUxLnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IHZhbHVlMyA9IG15T2JzZXJ2YWJsZTIucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3Qgc3VtID0gdmFsdWUxICsgdmFsdWUyICsgdmFsdWUzO1xuXHRcdFx0bG9nLmxvZyhgbXlDb21wdXRlZDMucmVjb21wdXRlKG15Q29tcHV0ZWQyOiAke3ZhbHVlMX0gKyBteU9ic2VydmFibGUxOiAke3ZhbHVlMn0gKyBteU9ic2VydmFibGUyOiAke3ZhbHVlM30gPSAke3N1bX0pYCk7XG5cdFx0XHRyZXR1cm4gc3VtO1xuXHRcdH0pO1xuXG5cdFx0ZHMuYWRkKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gbXlBdXRvcnVuICovXG5cdFx0XHRsb2cubG9nKGBteUF1dG9ydW4ucnVuKG15Q29tcHV0ZWQzOiAke215Q29tcHV0ZWQzLnJlYWQocmVhZGVyKX0pYCk7XG5cdFx0fSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcIm15Q29tcHV0ZWQxLnJlY29tcHV0ZShteU9ic2VydmFibGUxOiAwICsgbXlPYnNlcnZhYmxlMjogMCA9IDApXCIsXG5cdFx0XHRcIm15Q29tcHV0ZWQyLnJlY29tcHV0ZShteUNvbXB1dGVkMTogMCArIG15T2JzZXJ2YWJsZTE6IDAgKyBteU9ic2VydmFibGUyOiAwID0gMClcIixcblx0XHRcdFwibXlDb21wdXRlZDMucmVjb21wdXRlKG15Q29tcHV0ZWQyOiAwICsgbXlPYnNlcnZhYmxlMTogMCArIG15T2JzZXJ2YWJsZTI6IDAgPSAwKVwiLFxuXHRcdFx0XCJteUF1dG9ydW4ucnVuKG15Q29tcHV0ZWQzOiAwKVwiLFxuXHRcdF0pO1xuXG5cdFx0bXlPYnNlcnZhYmxlMS5zZXQoMSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XCJteUNvbXB1dGVkMS5yZWNvbXB1dGUobXlPYnNlcnZhYmxlMTogMSArIG15T2JzZXJ2YWJsZTI6IDAgPSAxKVwiLFxuXHRcdFx0XCJteUNvbXB1dGVkMi5yZWNvbXB1dGUobXlDb21wdXRlZDE6IDEgKyBteU9ic2VydmFibGUxOiAxICsgbXlPYnNlcnZhYmxlMjogMCA9IDIpXCIsXG5cdFx0XHRcIm15Q29tcHV0ZWQzLnJlY29tcHV0ZShteUNvbXB1dGVkMjogMiArIG15T2JzZXJ2YWJsZTE6IDEgKyBteU9ic2VydmFibGUyOiAwID0gMylcIixcblx0XHRcdFwibXlBdXRvcnVuLnJ1bihteUNvbXB1dGVkMzogMylcIixcblx0XHRdKTtcblxuXHRcdHRyYW5zYWN0aW9uKCh0eCkgPT4ge1xuXHRcdFx0bXlPYnNlcnZhYmxlMS5zZXQoMiwgdHgpO1xuXHRcdFx0bXlDb21wdXRlZDIuZ2V0KCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XHRcIm15Q29tcHV0ZWQxLnJlY29tcHV0ZShteU9ic2VydmFibGUxOiAyICsgbXlPYnNlcnZhYmxlMjogMCA9IDIpXCIsXG5cdFx0XHRcdFwibXlDb21wdXRlZDIucmVjb21wdXRlKG15Q29tcHV0ZWQxOiAyICsgbXlPYnNlcnZhYmxlMTogMiArIG15T2JzZXJ2YWJsZTI6IDAgPSA0KVwiLFxuXHRcdFx0XSk7XG5cblx0XHRcdG15T2JzZXJ2YWJsZTEuc2V0KDMsIHR4KTtcblx0XHRcdG15Q29tcHV0ZWQyLmdldCgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0XCJteUNvbXB1dGVkMS5yZWNvbXB1dGUobXlPYnNlcnZhYmxlMTogMyArIG15T2JzZXJ2YWJsZTI6IDAgPSAzKVwiLFxuXHRcdFx0XHRcIm15Q29tcHV0ZWQyLnJlY29tcHV0ZShteUNvbXB1dGVkMTogMyArIG15T2JzZXJ2YWJsZTE6IDMgKyBteU9ic2VydmFibGUyOiAwID0gNilcIixcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcIm15Q29tcHV0ZWQzLnJlY29tcHV0ZShteUNvbXB1dGVkMjogNiArIG15T2JzZXJ2YWJsZTE6IDMgKyBteU9ic2VydmFibGUyOiAwID0gOSlcIixcblx0XHRcdFwibXlBdXRvcnVuLnJ1bihteUNvbXB1dGVkMzogOSlcIixcblx0XHRdKTtcblx0fSk7XG5cblx0c3VpdGUoJ2Zyb20gZXZlbnQnLCAoKSA9PiB7XG5cblx0XHRmdW5jdGlvbiBpbml0KCk6IHsgbG9nOiBMb2c7IHNldFZhbHVlOiAodmFsdWU6IG51bWJlciB8IHVuZGVmaW5lZCkgPT4gdm9pZDsgb2JzZXJ2YWJsZTogSU9ic2VydmFibGU8bnVtYmVyIHwgdW5kZWZpbmVkPiB9IHtcblx0XHRcdGNvbnN0IGxvZyA9IG5ldyBMb2coKTtcblxuXHRcdFx0bGV0IHZhbHVlOiBudW1iZXIgfCB1bmRlZmluZWQgPSAwO1xuXHRcdFx0Y29uc3QgZXZlbnRFbWl0dGVyID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblxuXHRcdFx0bGV0IGlkID0gMDtcblx0XHRcdGNvbnN0IG9ic2VydmFibGUgPSBvYnNlcnZhYmxlRnJvbUV2ZW50KFxuXHRcdFx0XHQoaGFuZGxlcikgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGN1cklkID0gaWQrKztcblx0XHRcdFx0XHRsb2cubG9nKGBzdWJzY3JpYmVkIGhhbmRsZXIgJHtjdXJJZH1gKTtcblx0XHRcdFx0XHRjb25zdCBkaXNwb3NhYmxlID0gZXZlbnRFbWl0dGVyLmV2ZW50KGhhbmRsZXIpO1xuXG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0XHRcdFx0bG9nLmxvZyhgdW5zdWJzY3JpYmVkIGhhbmRsZXIgJHtjdXJJZH1gKTtcblx0XHRcdFx0XHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0sXG5cdFx0XHRcdCgpID0+IHtcblx0XHRcdFx0XHRsb2cubG9nKGBjb21wdXRlIHZhbHVlICR7dmFsdWV9YCk7XG5cdFx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHQpO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRsb2csXG5cdFx0XHRcdHNldFZhbHVlOiAobmV3VmFsdWUpID0+IHtcblx0XHRcdFx0XHR2YWx1ZSA9IG5ld1ZhbHVlO1xuXHRcdFx0XHRcdGV2ZW50RW1pdHRlci5maXJlKCk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdG9ic2VydmFibGUsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHRlc3QoJ0hhbmRsZSB1bmRlZmluZWQnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCB7IGxvZywgc2V0VmFsdWUsIG9ic2VydmFibGUgfSA9IGluaXQoKTtcblxuXHRcdFx0c2V0VmFsdWUodW5kZWZpbmVkKTtcblxuXHRcdFx0Y29uc3QgYXV0b3J1bkRpc3Bvc2FibGUgPSBhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRcdC8qKiBAZGVzY3JpcHRpb24gTXlBdXRvcnVuICovXG5cdFx0XHRcdG9ic2VydmFibGUucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRsb2cubG9nKFxuXHRcdFx0XHRcdGBhdXRvcnVuLCB2YWx1ZTogJHtvYnNlcnZhYmxlLnJlYWQocmVhZGVyKX1gXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0XCJzdWJzY3JpYmVkIGhhbmRsZXIgMFwiLFxuXHRcdFx0XHRcImNvbXB1dGUgdmFsdWUgdW5kZWZpbmVkXCIsXG5cdFx0XHRcdFwiYXV0b3J1biwgdmFsdWU6IHVuZGVmaW5lZFwiLFxuXHRcdFx0XSk7XG5cblx0XHRcdHNldFZhbHVlKDEpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XHRcImNvbXB1dGUgdmFsdWUgMVwiLFxuXHRcdFx0XHRcImF1dG9ydW4sIHZhbHVlOiAxXCJcblx0XHRcdF0pO1xuXG5cdFx0XHRhdXRvcnVuRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdFwidW5zdWJzY3JpYmVkIGhhbmRsZXIgMFwiXG5cdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2Jhc2ljJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgeyBsb2csIHNldFZhbHVlLCBvYnNlcnZhYmxlIH0gPSBpbml0KCk7XG5cblx0XHRcdGNvbnN0IHNob3VsZFJlYWRPYnNlcnZhYmxlID0gb2JzZXJ2YWJsZVZhbHVlKCdzaG91bGRSZWFkT2JzZXJ2YWJsZScsIHRydWUpO1xuXG5cdFx0XHRjb25zdCBhdXRvcnVuRGlzcG9zYWJsZSA9IGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBNeUF1dG9ydW4gKi9cblx0XHRcdFx0aWYgKHNob3VsZFJlYWRPYnNlcnZhYmxlLnJlYWQocmVhZGVyKSkge1xuXHRcdFx0XHRcdG9ic2VydmFibGUucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRcdGxvZy5sb2coXG5cdFx0XHRcdFx0XHRgYXV0b3J1biwgc2hvdWxkIHJlYWQ6IHRydWUsIHZhbHVlOiAke29ic2VydmFibGUucmVhZChyZWFkZXIpfWBcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGxvZy5sb2coYGF1dG9ydW4sIHNob3VsZCByZWFkOiBmYWxzZWApO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdCdzdWJzY3JpYmVkIGhhbmRsZXIgMCcsXG5cdFx0XHRcdCdjb21wdXRlIHZhbHVlIDAnLFxuXHRcdFx0XHQnYXV0b3J1biwgc2hvdWxkIHJlYWQ6IHRydWUsIHZhbHVlOiAwJyxcblx0XHRcdF0pO1xuXG5cdFx0XHQvLyBDYWNoZWQgZ2V0XG5cdFx0XHRsb2cubG9nKGBnZXQgdmFsdWU6ICR7b2JzZXJ2YWJsZS5nZXQoKX1gKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbJ2dldCB2YWx1ZTogMCddKTtcblxuXHRcdFx0c2V0VmFsdWUoMSk7XG5cdFx0XHQvLyBUcmlnZ2VyIGF1dG9ydW4sIG5vIHVuc3ViL3N1YlxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0J2NvbXB1dGUgdmFsdWUgMScsXG5cdFx0XHRcdCdhdXRvcnVuLCBzaG91bGQgcmVhZDogdHJ1ZSwgdmFsdWU6IDEnLFxuXHRcdFx0XSk7XG5cblx0XHRcdC8vIFVuc3Vic2NyaWJlIHdoZW4gbm90IHJlYWRcblx0XHRcdHNob3VsZFJlYWRPYnNlcnZhYmxlLnNldChmYWxzZSwgdW5kZWZpbmVkKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdCdhdXRvcnVuLCBzaG91bGQgcmVhZDogZmFsc2UnLFxuXHRcdFx0XHQndW5zdWJzY3JpYmVkIGhhbmRsZXIgMCcsXG5cdFx0XHRdKTtcblxuXHRcdFx0c2hvdWxkUmVhZE9ic2VydmFibGUuc2V0KHRydWUsIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XHQnc3Vic2NyaWJlZCBoYW5kbGVyIDEnLFxuXHRcdFx0XHQnY29tcHV0ZSB2YWx1ZSAxJyxcblx0XHRcdFx0J2F1dG9ydW4sIHNob3VsZCByZWFkOiB0cnVlLCB2YWx1ZTogMScsXG5cdFx0XHRdKTtcblxuXHRcdFx0YXV0b3J1bkRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0J3Vuc3Vic2NyaWJlZCBoYW5kbGVyIDEnLFxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdnZXQgd2l0aG91dCBvYnNlcnZlcnMnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCB7IGxvZywgb2JzZXJ2YWJsZSB9ID0gaW5pdCgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtdKTtcblxuXHRcdFx0bG9nLmxvZyhgZ2V0IHZhbHVlOiAke29ic2VydmFibGUuZ2V0KCl9YCk7XG5cdFx0XHQvLyBOb3QgY2FjaGVkIG9yIHN1YnNjcmliZWRcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdCdjb21wdXRlIHZhbHVlIDAnLFxuXHRcdFx0XHQnZ2V0IHZhbHVlOiAwJyxcblx0XHRcdF0pO1xuXG5cdFx0XHRsb2cubG9nKGBnZXQgdmFsdWU6ICR7b2JzZXJ2YWJsZS5nZXQoKX1gKTtcblx0XHRcdC8vIFN0aWxsIG5vdCBjYWNoZWQgb3Igc3Vic2NyaWJlZFxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0J2NvbXB1dGUgdmFsdWUgMCcsXG5cdFx0XHRcdCdnZXQgdmFsdWU6IDAnLFxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlYWRpbmcgZGVyaXZlZCBpbiB0cmFuc2FjdGlvbiB1bnN1YnNjcmliZXMgdW5uZWNlc3Nhcnkgb2JzZXJ2YWJsZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbG9nID0gbmV3IExvZygpO1xuXG5cdFx0Y29uc3Qgc2hvdWxkUmVhZE9ic2VydmFibGUgPSBvYnNlcnZhYmxlVmFsdWUoJ3Nob3VsZFJlYWRNeU9iczEnLCB0cnVlKTtcblx0XHRjb25zdCBteU9iczEgPSBuZXcgTG9nZ2luZ09ic2VydmFibGVWYWx1ZSgnbXlPYnMxJywgMCwgbG9nKTtcblx0XHRjb25zdCBteUNvbXB1dGVkID0gZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBteUNvbXB1dGVkICovXG5cdFx0XHRsb2cubG9nKCdteUNvbXB1dGVkLnJlY29tcHV0ZScpO1xuXHRcdFx0aWYgKHNob3VsZFJlYWRPYnNlcnZhYmxlLnJlYWQocmVhZGVyKSkge1xuXHRcdFx0XHRyZXR1cm4gbXlPYnMxLnJlYWQocmVhZGVyKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiAxO1xuXHRcdH0pO1xuXHRcdGRzLmFkZChhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIG15QXV0b3J1biAqL1xuXHRcdFx0Y29uc3QgdmFsdWUgPSBteUNvbXB1dGVkLnJlYWQocmVhZGVyKTtcblx0XHRcdGxvZy5sb2coYG15QXV0b3J1bjogJHt2YWx1ZX1gKTtcblx0XHR9KSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFwibXlDb21wdXRlZC5yZWNvbXB1dGVcIixcblx0XHRcdFwibXlPYnMxLmZpcnN0T2JzZXJ2ZXJBZGRlZFwiLFxuXHRcdFx0XCJteU9iczEuZ2V0XCIsXG5cdFx0XHRcIm15QXV0b3J1bjogMFwiLFxuXHRcdF0pO1xuXG5cdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0bXlPYnMxLnNldCgxLCB0eCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgKFtcIm15T2JzMS5zZXQgKHZhbHVlIDEpXCJdKSk7XG5cblx0XHRcdHNob3VsZFJlYWRPYnNlcnZhYmxlLnNldChmYWxzZSwgdHgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIChbXSkpO1xuXG5cdFx0XHRteUNvbXB1dGVkLmdldCgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0XCJteUNvbXB1dGVkLnJlY29tcHV0ZVwiLFxuXHRcdFx0XHRcIm15T2JzMS5sYXN0T2JzZXJ2ZXJSZW1vdmVkXCIsXG5cdFx0XHRdKTtcblx0XHR9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgKFtcIm15QXV0b3J1bjogMVwiXSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdhdm9pZCByZWNvbXB1dGF0aW9uIG9mIGRlcml2ZWRzIHRoYXQgYXJlIG5vIGxvbmdlciByZWFkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvZyA9IG5ldyBMb2coKTtcblxuXHRcdGNvbnN0IG15T2JzU2hvdWxkUmVhZCA9IG5ldyBMb2dnaW5nT2JzZXJ2YWJsZVZhbHVlKCdteU9ic1Nob3VsZFJlYWQnLCB0cnVlLCBsb2cpO1xuXHRcdGNvbnN0IG15T2JzMSA9IG5ldyBMb2dnaW5nT2JzZXJ2YWJsZVZhbHVlKCdteU9iczEnLCAwLCBsb2cpO1xuXG5cdFx0Y29uc3QgbXlDb21wdXRlZDEgPSBkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIG15Q29tcHV0ZWQxICovXG5cdFx0XHRjb25zdCBteU9iczFWYWwgPSBteU9iczEucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gbXlPYnMxVmFsICUgMTA7XG5cdFx0XHRsb2cubG9nKGBteUNvbXB1dGVkMShteU9iczE6ICR7bXlPYnMxVmFsfSk6IENvbXB1dGVkICR7cmVzdWx0fWApO1xuXHRcdFx0cmV0dXJuIG15T2JzMVZhbDtcblx0XHR9KTtcblxuXHRcdGRzLmFkZChhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIG15QXV0b3J1biAqL1xuXHRcdFx0Y29uc3Qgc2hvdWxkUmVhZCA9IG15T2JzU2hvdWxkUmVhZC5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAoc2hvdWxkUmVhZCkge1xuXHRcdFx0XHRjb25zdCB2ID0gbXlDb21wdXRlZDEucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRsb2cubG9nKGBteUF1dG9ydW4oc2hvdWxkUmVhZDogdHJ1ZSwgbXlDb21wdXRlZDE6ICR7dn0pOiBydW5gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGxvZy5sb2coYG15QXV0b3J1bihzaG91bGRSZWFkOiBmYWxzZSk6IHJ1bmApO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XCJteU9ic1Nob3VsZFJlYWQuZmlyc3RPYnNlcnZlckFkZGVkXCIsXG5cdFx0XHRcIm15T2JzU2hvdWxkUmVhZC5nZXRcIixcblx0XHRcdFwibXlPYnMxLmZpcnN0T2JzZXJ2ZXJBZGRlZFwiLFxuXHRcdFx0XCJteU9iczEuZ2V0XCIsXG5cdFx0XHRcIm15Q29tcHV0ZWQxKG15T2JzMTogMCk6IENvbXB1dGVkIDBcIixcblx0XHRcdFwibXlBdXRvcnVuKHNob3VsZFJlYWQ6IHRydWUsIG15Q29tcHV0ZWQxOiAwKTogcnVuXCIsXG5cdFx0XSk7XG5cblx0XHR0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHRteU9ic1Nob3VsZFJlYWQuc2V0KGZhbHNlLCB0eCk7XG5cdFx0XHRteU9iczEuc2V0KDEsIHR4KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdFwibXlPYnNTaG91bGRSZWFkLnNldCAodmFsdWUgZmFsc2UpXCIsXG5cdFx0XHRcdFwibXlPYnMxLnNldCAodmFsdWUgMSlcIixcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHRcdC8vIG15Q29tcHV0ZWQxIHNob3VsZCBub3QgYmUgcmVjb21wdXRlZCBoZXJlLCBldmVuIHRob3VnaCBpdHMgZGVwZW5kZW5jeSBteU9iczEgY2hhbmdlZCFcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XCJteU9ic1Nob3VsZFJlYWQuZ2V0XCIsXG5cdFx0XHRcIm15QXV0b3J1bihzaG91bGRSZWFkOiBmYWxzZSk6IHJ1blwiLFxuXHRcdFx0XCJteU9iczEubGFzdE9ic2VydmVyUmVtb3ZlZFwiLFxuXHRcdF0pO1xuXG5cdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0bXlPYnNTaG91bGRSZWFkLnNldCh0cnVlLCB0eCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XHRcIm15T2JzU2hvdWxkUmVhZC5zZXQgKHZhbHVlIHRydWUpXCIsXG5cdFx0XHRdKTtcblx0XHR9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XCJteU9ic1Nob3VsZFJlYWQuZ2V0XCIsXG5cdFx0XHRcIm15T2JzMS5maXJzdE9ic2VydmVyQWRkZWRcIixcblx0XHRcdFwibXlPYnMxLmdldFwiLFxuXHRcdFx0XCJteUNvbXB1dGVkMShteU9iczE6IDEpOiBDb21wdXRlZCAxXCIsXG5cdFx0XHRcIm15QXV0b3J1bihzaG91bGRSZWFkOiB0cnVlLCBteUNvbXB1dGVkMTogMSk6IHJ1blwiLFxuXHRcdF0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnYXV0b3J1biByZXJ1biBvbiBuZXV0cmFsIGNoYW5nZScsICgpID0+IHtcblx0XHR0ZXN0KCdhdXRvcnVuIHJlcnVucyBvbiBuZXV0cmFsIG9ic2VydmFibGUgZG91YmxlIGNoYW5nZScsICgpID0+IHtcblx0XHRcdGNvbnN0IGxvZyA9IG5ldyBMb2coKTtcblx0XHRcdGNvbnN0IG15T2JzZXJ2YWJsZSA9IG9ic2VydmFibGVWYWx1ZSgnbXlPYnNlcnZhYmxlJywgMCk7XG5cblx0XHRcdGRzLmFkZChhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRcdC8qKiBAZGVzY3JpcHRpb24gbXlBdXRvcnVuICovXG5cdFx0XHRcdGxvZy5sb2coYG15QXV0b3J1bi5ydW4obXlPYnNlcnZhYmxlOiAke215T2JzZXJ2YWJsZS5yZWFkKHJlYWRlcil9KWApO1xuXHRcdFx0fSkpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFsnbXlBdXRvcnVuLnJ1bihteU9ic2VydmFibGU6IDApJ10pO1xuXG5cblx0XHRcdHRyYW5zYWN0aW9uKCh0eCkgPT4ge1xuXHRcdFx0XHRteU9ic2VydmFibGUuc2V0KDIsIHR4KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtdKTtcblxuXHRcdFx0XHRteU9ic2VydmFibGUuc2V0KDAsIHR4KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtdKTtcblx0XHRcdH0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFsnbXlBdXRvcnVuLnJ1bihteU9ic2VydmFibGU6IDApJ10pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnYXV0b3J1biBkb2VzIG5vdCByZXJ1biBvbiBpbmRpcmVjdCBuZXV0cmFsIG9ic2VydmFibGUgZG91YmxlIGNoYW5nZScsICgpID0+IHtcblx0XHRcdGNvbnN0IGxvZyA9IG5ldyBMb2coKTtcblx0XHRcdGNvbnN0IG15T2JzZXJ2YWJsZSA9IG9ic2VydmFibGVWYWx1ZSgnbXlPYnNlcnZhYmxlJywgMCk7XG5cdFx0XHRjb25zdCBteURlcml2ZWQgPSBkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0XHRcdC8qKiBAZGVzY3JpcHRpb24gbXlEZXJpdmVkICovXG5cdFx0XHRcdGNvbnN0IHZhbCA9IG15T2JzZXJ2YWJsZS5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdGxvZy5sb2coYG15RGVyaXZlZC5yZWFkKG15T2JzZXJ2YWJsZTogJHt2YWx9KWApO1xuXHRcdFx0XHRyZXR1cm4gdmFsO1xuXHRcdFx0fSk7XG5cblx0XHRcdGRzLmFkZChhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRcdC8qKiBAZGVzY3JpcHRpb24gbXlBdXRvcnVuICovXG5cdFx0XHRcdGxvZy5sb2coYG15QXV0b3J1bi5ydW4obXlEZXJpdmVkOiAke215RGVyaXZlZC5yZWFkKHJlYWRlcil9KWApO1xuXHRcdFx0fSkpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0XCJteURlcml2ZWQucmVhZChteU9ic2VydmFibGU6IDApXCIsXG5cdFx0XHRcdFwibXlBdXRvcnVuLnJ1bihteURlcml2ZWQ6IDApXCJcblx0XHRcdF0pO1xuXG5cdFx0XHR0cmFuc2FjdGlvbigodHgpID0+IHtcblx0XHRcdFx0bXlPYnNlcnZhYmxlLnNldCgyLCB0eCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXSk7XG5cblx0XHRcdFx0bXlPYnNlcnZhYmxlLnNldCgwLCB0eCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXSk7XG5cdFx0XHR9KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdFwibXlEZXJpdmVkLnJlYWQobXlPYnNlcnZhYmxlOiAwKVwiXG5cdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2F1dG9ydW4gcmVydW5zIG9uIGluZGlyZWN0IG5ldXRyYWwgb2JzZXJ2YWJsZSBkb3VibGUgY2hhbmdlIHdoZW4gY2hhbmdlcyBwcm9wYWdhdGUnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBsb2cgPSBuZXcgTG9nKCk7XG5cdFx0XHRjb25zdCBteU9ic2VydmFibGUgPSBvYnNlcnZhYmxlVmFsdWUoJ215T2JzZXJ2YWJsZScsIDApO1xuXHRcdFx0Y29uc3QgbXlEZXJpdmVkID0gZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdFx0XHQvKiogQGRlc2NyaXB0aW9uIG15RGVyaXZlZCAqL1xuXHRcdFx0XHRjb25zdCB2YWwgPSBteU9ic2VydmFibGUucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRsb2cubG9nKGBteURlcml2ZWQucmVhZChteU9ic2VydmFibGU6ICR7dmFsfSlgKTtcblx0XHRcdFx0cmV0dXJuIHZhbDtcblx0XHRcdH0pO1xuXG5cdFx0XHRkcy5hZGQoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0XHQvKiogQGRlc2NyaXB0aW9uIG15QXV0b3J1biAqL1xuXHRcdFx0XHRsb2cubG9nKGBteUF1dG9ydW4ucnVuKG15RGVyaXZlZDogJHtteURlcml2ZWQucmVhZChyZWFkZXIpfSlgKTtcblx0XHRcdH0pKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdFwibXlEZXJpdmVkLnJlYWQobXlPYnNlcnZhYmxlOiAwKVwiLFxuXHRcdFx0XHRcIm15QXV0b3J1bi5ydW4obXlEZXJpdmVkOiAwKVwiXG5cdFx0XHRdKTtcblxuXHRcdFx0dHJhbnNhY3Rpb24oKHR4KSA9PiB7XG5cdFx0XHRcdG15T2JzZXJ2YWJsZS5zZXQoMiwgdHgpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW10pO1xuXG5cdFx0XHRcdG15RGVyaXZlZC5nZXQoKTsgLy8gVGhpcyBtYXJrcyB0aGUgYXV0by1ydW4gYXMgY2hhbmdlZFxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XHRcdFwibXlEZXJpdmVkLnJlYWQobXlPYnNlcnZhYmxlOiAyKVwiXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdG15T2JzZXJ2YWJsZS5zZXQoMCwgdHgpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW10pO1xuXHRcdFx0fSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XHRcIm15RGVyaXZlZC5yZWFkKG15T2JzZXJ2YWJsZTogMClcIixcblx0XHRcdFx0XCJteUF1dG9ydW4ucnVuKG15RGVyaXZlZDogMClcIlxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NlbGYtZGlzcG9zaW5nIGF1dG9ydW4nLCAoKSA9PiB7XG5cdFx0Y29uc3QgbG9nID0gbmV3IExvZygpO1xuXG5cdFx0Y29uc3Qgb2JzZXJ2YWJsZTEgPSBuZXcgTG9nZ2luZ09ic2VydmFibGVWYWx1ZSgnbXlPYnNlcnZhYmxlMScsIDAsIGxvZyk7XG5cdFx0Y29uc3QgbXlPYnNlcnZhYmxlMiA9IG5ldyBMb2dnaW5nT2JzZXJ2YWJsZVZhbHVlKCdteU9ic2VydmFibGUyJywgMCwgbG9nKTtcblx0XHRjb25zdCBteU9ic2VydmFibGUzID0gbmV3IExvZ2dpbmdPYnNlcnZhYmxlVmFsdWUoJ215T2JzZXJ2YWJsZTMnLCAwLCBsb2cpO1xuXG5cdFx0Y29uc3QgZCA9IGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gYXV0b3J1biAqL1xuXHRcdFx0aWYgKG9ic2VydmFibGUxLnJlYWQocmVhZGVyKSA+PSAyKSB7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdFx0XCJteU9ic2VydmFibGUxLnNldCAodmFsdWUgMilcIixcblx0XHRcdFx0XHRcIm15T2JzZXJ2YWJsZTEuZ2V0XCIsXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdG15T2JzZXJ2YWJsZTIucmVhZChyZWFkZXIpO1xuXHRcdFx0XHQvLyBGaXJzdCB0aW1lIHRoaXMgb2JzZXJ2YWJsZSBpcyByZWFkXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdFx0XCJteU9ic2VydmFibGUyLmZpcnN0T2JzZXJ2ZXJBZGRlZFwiLFxuXHRcdFx0XHRcdFwibXlPYnNlcnZhYmxlMi5nZXRcIixcblx0XHRcdFx0XSk7XG5cblx0XHRcdFx0ZC5kaXNwb3NlKCk7XG5cdFx0XHRcdC8vIERpc3Bvc2luZyByZW1vdmVzIGFsbCBvYnNlcnZlcnNcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0XHRcIm15T2JzZXJ2YWJsZTEubGFzdE9ic2VydmVyUmVtb3ZlZFwiLFxuXHRcdFx0XHRcdFwibXlPYnNlcnZhYmxlMi5sYXN0T2JzZXJ2ZXJSZW1vdmVkXCIsXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdG15T2JzZXJ2YWJsZTMucmVhZChyZWFkZXIpO1xuXHRcdFx0XHQvLyBUaGlzIGRvZXMgbm90IHN1YnNjcmliZSB0aGUgb2JzZXJ2YWJsZSwgYmVjYXVzZSB0aGUgYXV0b3J1biBpcyBkaXNwb3NlZFxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XHRcdFwibXlPYnNlcnZhYmxlMy5nZXRcIixcblx0XHRcdFx0XSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdCdteU9ic2VydmFibGUxLmZpcnN0T2JzZXJ2ZXJBZGRlZCcsXG5cdFx0XHQnbXlPYnNlcnZhYmxlMS5nZXQnLFxuXHRcdF0pO1xuXG5cdFx0b2JzZXJ2YWJsZTEuc2V0KDEsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdCdteU9ic2VydmFibGUxLnNldCAodmFsdWUgMSknLFxuXHRcdFx0J215T2JzZXJ2YWJsZTEuZ2V0Jyxcblx0XHRdKTtcblxuXHRcdG9ic2VydmFibGUxLnNldCgyLCB1bmRlZmluZWQpO1xuXHRcdC8vIFNlZSBhc3NlcnRzIGluIHRoZSBhdXRvcnVuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIChbXSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdjaGFuZ2luZyBvYnNlcnZhYmxlcyBpbiBlbmRVcGRhdGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbG9nID0gbmV3IExvZygpO1xuXG5cdFx0Y29uc3QgbXlPYnNlcnZhYmxlMSA9IG5ldyBMb2dnaW5nT2JzZXJ2YWJsZVZhbHVlKCdteU9ic2VydmFibGUxJywgMCwgbG9nKTtcblx0XHRjb25zdCBteU9ic2VydmFibGUyID0gbmV3IExvZ2dpbmdPYnNlcnZhYmxlVmFsdWUoJ215T2JzZXJ2YWJsZTInLCAwLCBsb2cpO1xuXG5cdFx0Y29uc3QgbXlEZXJpdmVkMSA9IGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gbXlEZXJpdmVkMSAqL1xuXHRcdFx0Y29uc3QgdmFsID0gbXlPYnNlcnZhYmxlMS5yZWFkKHJlYWRlcik7XG5cdFx0XHRsb2cubG9nKGBteURlcml2ZWQxLnJlYWQobXlPYnNlcnZhYmxlOiAke3ZhbH0pYCk7XG5cdFx0XHRyZXR1cm4gdmFsO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgbXlEZXJpdmVkMiA9IGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gbXlEZXJpdmVkMiAqL1xuXHRcdFx0Y29uc3QgdmFsID0gbXlPYnNlcnZhYmxlMi5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAodmFsID09PSAxKSB7XG5cdFx0XHRcdG15RGVyaXZlZDEucmVhZChyZWFkZXIpO1xuXHRcdFx0fVxuXHRcdFx0bG9nLmxvZyhgbXlEZXJpdmVkMi5yZWFkKG15T2JzZXJ2YWJsZTogJHt2YWx9KWApO1xuXHRcdFx0cmV0dXJuIHZhbDtcblx0XHR9KTtcblxuXHRcdGRzLmFkZChhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIG15QXV0b3J1biAqL1xuXHRcdFx0Y29uc3QgbXlEZXJpdmVkMVZhbCA9IG15RGVyaXZlZDEucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgbXlEZXJpdmVkMlZhbCA9IG15RGVyaXZlZDIucmVhZChyZWFkZXIpO1xuXHRcdFx0bG9nLmxvZyhgbXlBdXRvcnVuLnJ1bihteURlcml2ZWQxOiAke215RGVyaXZlZDFWYWx9LCBteURlcml2ZWQyOiAke215RGVyaXZlZDJWYWx9KWApO1xuXHRcdH0pKTtcblxuXHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdG15T2JzZXJ2YWJsZTIuc2V0KDEsIHR4KTtcblx0XHRcdC8vIGVuZCB1cGRhdGUgb2YgdGhpcyBvYnNlcnZhYmxlIHdpbGwgdHJpZ2dlciBlbmRVcGRhdGUgb2YgbXlEZXJpdmVkMSBhbmRcblx0XHRcdC8vIHRoZSBhdXRvcnVuIGFuZCB0aGUgYXV0b3J1biB3aWxsIGFkZCBteURlcml2ZWQyIGFzIG9ic2VydmVyIHRvIG15RGVyaXZlZDFcblx0XHRcdG15T2JzZXJ2YWJsZTEuc2V0KDEsIHR4KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnc2V0IGRlcGVuZGVuY3kgaW4gZGVyaXZlZCcsICgpID0+IHtcblx0XHRjb25zdCBsb2cgPSBuZXcgTG9nKCk7XG5cblx0XHRjb25zdCBteU9ic2VydmFibGUgPSBuZXcgTG9nZ2luZ09ic2VydmFibGVWYWx1ZSgnbXlPYnNlcnZhYmxlJywgMCwgbG9nKTtcblx0XHRjb25zdCBteUNvbXB1dGVkID0gZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBteUNvbXB1dGVkICovXG5cdFx0XHRsZXQgdmFsdWUgPSBteU9ic2VydmFibGUucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3Qgb3JpZ1ZhbHVlID0gdmFsdWU7XG5cdFx0XHRsb2cubG9nKGBteUNvbXB1dGVkKG15T2JzZXJ2YWJsZTogJHtvcmlnVmFsdWV9KTogc3RhcnQgY29tcHV0aW5nYCk7XG5cdFx0XHRpZiAodmFsdWUgJSAzICE9PSAwKSB7XG5cdFx0XHRcdHZhbHVlKys7XG5cdFx0XHRcdG15T2JzZXJ2YWJsZS5zZXQodmFsdWUsIHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cdFx0XHRsb2cubG9nKGBteUNvbXB1dGVkKG15T2JzZXJ2YWJsZTogJHtvcmlnVmFsdWV9KTogZmluaXNoZWQgY29tcHV0aW5nYCk7XG5cdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0fSk7XG5cblx0XHRkcy5hZGQoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBteUF1dG9ydW4gKi9cblx0XHRcdGNvbnN0IHZhbHVlID0gbXlDb21wdXRlZC5yZWFkKHJlYWRlcik7XG5cdFx0XHRsb2cubG9nKGBteUF1dG9ydW4obXlDb21wdXRlZDogJHt2YWx1ZX0pYCk7XG5cdFx0fSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcIm15T2JzZXJ2YWJsZS5maXJzdE9ic2VydmVyQWRkZWRcIixcblx0XHRcdFwibXlPYnNlcnZhYmxlLmdldFwiLFxuXHRcdFx0XCJteUNvbXB1dGVkKG15T2JzZXJ2YWJsZTogMCk6IHN0YXJ0IGNvbXB1dGluZ1wiLFxuXHRcdFx0XCJteUNvbXB1dGVkKG15T2JzZXJ2YWJsZTogMCk6IGZpbmlzaGVkIGNvbXB1dGluZ1wiLFxuXHRcdFx0XCJteUF1dG9ydW4obXlDb21wdXRlZDogMClcIlxuXHRcdF0pO1xuXG5cdFx0bXlPYnNlcnZhYmxlLnNldCgxLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcIm15T2JzZXJ2YWJsZS5zZXQgKHZhbHVlIDEpXCIsXG5cdFx0XHRcIm15T2JzZXJ2YWJsZS5nZXRcIixcblx0XHRcdFwibXlDb21wdXRlZChteU9ic2VydmFibGU6IDEpOiBzdGFydCBjb21wdXRpbmdcIixcblx0XHRcdFwibXlPYnNlcnZhYmxlLnNldCAodmFsdWUgMilcIixcblx0XHRcdFwibXlDb21wdXRlZChteU9ic2VydmFibGU6IDEpOiBmaW5pc2hlZCBjb21wdXRpbmdcIixcblx0XHRcdFwibXlPYnNlcnZhYmxlLmdldFwiLFxuXHRcdFx0XCJteUNvbXB1dGVkKG15T2JzZXJ2YWJsZTogMik6IHN0YXJ0IGNvbXB1dGluZ1wiLFxuXHRcdFx0XCJteU9ic2VydmFibGUuc2V0ICh2YWx1ZSAzKVwiLFxuXHRcdFx0XCJteUNvbXB1dGVkKG15T2JzZXJ2YWJsZTogMik6IGZpbmlzaGVkIGNvbXB1dGluZ1wiLFxuXHRcdFx0XCJteU9ic2VydmFibGUuZ2V0XCIsXG5cdFx0XHRcIm15Q29tcHV0ZWQobXlPYnNlcnZhYmxlOiAzKTogc3RhcnQgY29tcHV0aW5nXCIsXG5cdFx0XHRcIm15Q29tcHV0ZWQobXlPYnNlcnZhYmxlOiAzKTogZmluaXNoZWQgY29tcHV0aW5nXCIsXG5cdFx0XHRcIm15QXV0b3J1bihteUNvbXB1dGVkOiAzKVwiLFxuXHRcdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzZXQgZGVwZW5kZW5jeSBpbiBhdXRvcnVuJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvZyA9IG5ldyBMb2coKTtcblx0XHRjb25zdCBteU9ic2VydmFibGUgPSBuZXcgTG9nZ2luZ09ic2VydmFibGVWYWx1ZSgnbXlPYnNlcnZhYmxlJywgMCwgbG9nKTtcblxuXHRcdGRzLmFkZChhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIG15QXV0b3J1biAqL1xuXHRcdFx0Y29uc3QgdmFsdWUgPSBteU9ic2VydmFibGUucmVhZChyZWFkZXIpO1xuXHRcdFx0bG9nLmxvZyhgbXlBdXRvcnVuKG15T2JzZXJ2YWJsZTogJHt2YWx1ZX0pOiBzdGFydGApO1xuXHRcdFx0aWYgKHZhbHVlICE9PSAwICYmIHZhbHVlIDwgNCkge1xuXHRcdFx0XHRteU9ic2VydmFibGUuc2V0KHZhbHVlICsgMSwgdW5kZWZpbmVkKTtcblx0XHRcdH1cblx0XHRcdGxvZy5sb2coYG15QXV0b3J1bihteU9ic2VydmFibGU6ICR7dmFsdWV9KTogZW5kYCk7XG5cdFx0fSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcIm15T2JzZXJ2YWJsZS5maXJzdE9ic2VydmVyQWRkZWRcIixcblx0XHRcdFwibXlPYnNlcnZhYmxlLmdldFwiLFxuXHRcdFx0XCJteUF1dG9ydW4obXlPYnNlcnZhYmxlOiAwKTogc3RhcnRcIixcblx0XHRcdFwibXlBdXRvcnVuKG15T2JzZXJ2YWJsZTogMCk6IGVuZFwiLFxuXHRcdF0pO1xuXG5cdFx0bXlPYnNlcnZhYmxlLnNldCgxLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcIm15T2JzZXJ2YWJsZS5zZXQgKHZhbHVlIDEpXCIsXG5cdFx0XHRcIm15T2JzZXJ2YWJsZS5nZXRcIixcblx0XHRcdFwibXlBdXRvcnVuKG15T2JzZXJ2YWJsZTogMSk6IHN0YXJ0XCIsXG5cdFx0XHRcIm15T2JzZXJ2YWJsZS5zZXQgKHZhbHVlIDIpXCIsXG5cdFx0XHRcIm15QXV0b3J1bihteU9ic2VydmFibGU6IDEpOiBlbmRcIixcblx0XHRcdFwibXlPYnNlcnZhYmxlLmdldFwiLFxuXHRcdFx0XCJteUF1dG9ydW4obXlPYnNlcnZhYmxlOiAyKTogc3RhcnRcIixcblx0XHRcdFwibXlPYnNlcnZhYmxlLnNldCAodmFsdWUgMylcIixcblx0XHRcdFwibXlBdXRvcnVuKG15T2JzZXJ2YWJsZTogMik6IGVuZFwiLFxuXHRcdFx0XCJteU9ic2VydmFibGUuZ2V0XCIsXG5cdFx0XHRcIm15QXV0b3J1bihteU9ic2VydmFibGU6IDMpOiBzdGFydFwiLFxuXHRcdFx0XCJteU9ic2VydmFibGUuc2V0ICh2YWx1ZSA0KVwiLFxuXHRcdFx0XCJteUF1dG9ydW4obXlPYnNlcnZhYmxlOiAzKTogZW5kXCIsXG5cdFx0XHRcIm15T2JzZXJ2YWJsZS5nZXRcIixcblx0XHRcdFwibXlBdXRvcnVuKG15T2JzZXJ2YWJsZTogNCk6IHN0YXJ0XCIsXG5cdFx0XHRcIm15QXV0b3J1bihteU9ic2VydmFibGU6IDQpOiBlbmRcIixcblx0XHRdKTtcblx0fSk7XG5cblx0dGVzdCgnZ2V0IGluIHRyYW5zYWN0aW9uIGJldHdlZW4gc2V0cycsICgpID0+IHtcblx0XHRjb25zdCBsb2cgPSBuZXcgTG9nKCk7XG5cdFx0Y29uc3QgbXlPYnNlcnZhYmxlID0gbmV3IExvZ2dpbmdPYnNlcnZhYmxlVmFsdWUoJ215T2JzZXJ2YWJsZScsIDAsIGxvZyk7XG5cblx0XHRjb25zdCBteURlcml2ZWQxID0gZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBteURlcml2ZWQxICovXG5cdFx0XHRjb25zdCB2YWx1ZSA9IG15T2JzZXJ2YWJsZS5yZWFkKHJlYWRlcik7XG5cdFx0XHRsb2cubG9nKGBteURlcml2ZWQxKG15T2JzZXJ2YWJsZTogJHt2YWx1ZX0pOiBzdGFydCBjb21wdXRpbmdgKTtcblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IG15RGVyaXZlZDIgPSBkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIG15RGVyaXZlZDIgKi9cblx0XHRcdGNvbnN0IHZhbHVlID0gbXlEZXJpdmVkMS5yZWFkKHJlYWRlcik7XG5cdFx0XHRsb2cubG9nKGBteURlcml2ZWQyKG15RGVyaXZlZDE6ICR7dmFsdWV9KTogc3RhcnQgY29tcHV0aW5nYCk7XG5cdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0fSk7XG5cblx0XHRkcy5hZGQoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBteUF1dG9ydW4gKi9cblx0XHRcdGNvbnN0IHZhbHVlID0gbXlEZXJpdmVkMi5yZWFkKHJlYWRlcik7XG5cdFx0XHRsb2cubG9nKGBteUF1dG9ydW4obXlEZXJpdmVkMjogJHt2YWx1ZX0pYCk7XG5cdFx0fSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcIm15T2JzZXJ2YWJsZS5maXJzdE9ic2VydmVyQWRkZWRcIixcblx0XHRcdFwibXlPYnNlcnZhYmxlLmdldFwiLFxuXHRcdFx0XCJteURlcml2ZWQxKG15T2JzZXJ2YWJsZTogMCk6IHN0YXJ0IGNvbXB1dGluZ1wiLFxuXHRcdFx0XCJteURlcml2ZWQyKG15RGVyaXZlZDE6IDApOiBzdGFydCBjb21wdXRpbmdcIixcblx0XHRcdFwibXlBdXRvcnVuKG15RGVyaXZlZDI6IDApXCIsXG5cdFx0XSk7XG5cblx0XHR0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHRteU9ic2VydmFibGUuc2V0KDEsIHR4KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdFwibXlPYnNlcnZhYmxlLnNldCAodmFsdWUgMSlcIixcblx0XHRcdF0pO1xuXG5cdFx0XHRteURlcml2ZWQyLmdldCgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0XCJteU9ic2VydmFibGUuZ2V0XCIsXG5cdFx0XHRcdFwibXlEZXJpdmVkMShteU9ic2VydmFibGU6IDEpOiBzdGFydCBjb21wdXRpbmdcIixcblx0XHRcdFx0XCJteURlcml2ZWQyKG15RGVyaXZlZDE6IDEpOiBzdGFydCBjb21wdXRpbmdcIixcblx0XHRcdF0pO1xuXG5cdFx0XHRteU9ic2VydmFibGUuc2V0KDIsIHR4KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdFwibXlPYnNlcnZhYmxlLnNldCAodmFsdWUgMilcIixcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcIm15T2JzZXJ2YWJsZS5nZXRcIixcblx0XHRcdFwibXlEZXJpdmVkMShteU9ic2VydmFibGU6IDIpOiBzdGFydCBjb21wdXRpbmdcIixcblx0XHRcdFwibXlEZXJpdmVkMihteURlcml2ZWQxOiAyKTogc3RhcnQgY29tcHV0aW5nXCIsXG5cdFx0XHRcIm15QXV0b3J1bihteURlcml2ZWQyOiAyKVwiLFxuXHRcdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdidWc6IERvbnQgcmVzZXQgc3RhdGVzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvZyA9IG5ldyBMb2coKTtcblx0XHRjb25zdCBteU9ic2VydmFibGUxID0gbmV3IExvZ2dpbmdPYnNlcnZhYmxlVmFsdWUoJ215T2JzZXJ2YWJsZTEnLCAwLCBsb2cpO1xuXG5cdFx0Y29uc3QgbXlPYnNlcnZhYmxlMiA9IG5ldyBMb2dnaW5nT2JzZXJ2YWJsZVZhbHVlKCdteU9ic2VydmFibGUyJywgMCwgbG9nKTtcblx0XHRjb25zdCBteURlcml2ZWQyID0gZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBteURlcml2ZWQyICovXG5cdFx0XHRjb25zdCB2YWwgPSBteU9ic2VydmFibGUyLnJlYWQocmVhZGVyKTtcblx0XHRcdGxvZy5sb2coYG15RGVyaXZlZDIuY29tcHV0ZWQobXlPYnNlcnZhYmxlMjogJHt2YWx9KWApO1xuXHRcdFx0cmV0dXJuIHZhbCAlIDEwO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgbXlEZXJpdmVkMyA9IGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gbXlEZXJpdmVkMyAqL1xuXHRcdFx0Y29uc3QgdmFsMSA9IG15T2JzZXJ2YWJsZTEucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgdmFsMiA9IG15RGVyaXZlZDIucmVhZChyZWFkZXIpO1xuXHRcdFx0bG9nLmxvZyhgbXlEZXJpdmVkMy5jb21wdXRlZChteURlcml2ZWQxOiAke3ZhbDF9LCBteURlcml2ZWQyOiAke3ZhbDJ9KWApO1xuXHRcdFx0cmV0dXJuIGAke3ZhbDF9ICsgJHt2YWwyfWA7XG5cdFx0fSk7XG5cblx0XHRkcy5hZGQoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBteUF1dG9ydW4gKi9cblx0XHRcdGNvbnN0IHZhbCA9IG15RGVyaXZlZDMucmVhZChyZWFkZXIpO1xuXHRcdFx0bG9nLmxvZyhgbXlBdXRvcnVuKG15RGVyaXZlZDM6ICR7dmFsfSlgKTtcblx0XHR9KSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFwibXlPYnNlcnZhYmxlMS5maXJzdE9ic2VydmVyQWRkZWRcIixcblx0XHRcdFwibXlPYnNlcnZhYmxlMS5nZXRcIixcblx0XHRcdFwibXlPYnNlcnZhYmxlMi5maXJzdE9ic2VydmVyQWRkZWRcIixcblx0XHRcdFwibXlPYnNlcnZhYmxlMi5nZXRcIixcblx0XHRcdFwibXlEZXJpdmVkMi5jb21wdXRlZChteU9ic2VydmFibGUyOiAwKVwiLFxuXHRcdFx0XCJteURlcml2ZWQzLmNvbXB1dGVkKG15RGVyaXZlZDE6IDAsIG15RGVyaXZlZDI6IDApXCIsXG5cdFx0XHRcIm15QXV0b3J1bihteURlcml2ZWQzOiAwICsgMClcIixcblx0XHRdKTtcblxuXHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdG15T2JzZXJ2YWJsZTEuc2V0KDEsIHR4KTsgLy8gTWFyayBteURlcml2ZWQgMyBhcyBzdGFsZVxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0XCJteU9ic2VydmFibGUxLnNldCAodmFsdWUgMSlcIixcblx0XHRcdF0pO1xuXG5cdFx0XHRteU9ic2VydmFibGUyLnNldCgxMCwgdHgpOyAvLyBUaGlzIGlzIGEgbm9uLWNoYW5nZS4gbXlEZXJpdmVkMyBzaG91bGQgbm90IGJlIG1hcmtlZCBhcyBwb3NzaWJseS1kZXBlZGVuY3ktY2hhbmdlZCFcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdFwibXlPYnNlcnZhYmxlMi5zZXQgKHZhbHVlIDEwKVwiLFxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFwibXlPYnNlcnZhYmxlMS5nZXRcIixcblx0XHRcdFwibXlPYnNlcnZhYmxlMi5nZXRcIixcblx0XHRcdFwibXlEZXJpdmVkMi5jb21wdXRlZChteU9ic2VydmFibGUyOiAxMClcIixcblx0XHRcdCdteURlcml2ZWQzLmNvbXB1dGVkKG15RGVyaXZlZDE6IDEsIG15RGVyaXZlZDI6IDApJyxcblx0XHRcdCdteUF1dG9ydW4obXlEZXJpdmVkMzogMSArIDApJyxcblx0XHRdKTtcblx0fSk7XG5cblx0dGVzdCgnYnVnOiBBZGQgb2JzZXJ2YWJsZSBpbiBlbmRVcGRhdGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbXlPYnNlcnZhYmxlMSA9IG9ic2VydmFibGVWYWx1ZSgnbXlPYnNlcnZhYmxlMScsIDApO1xuXHRcdGNvbnN0IG15T2JzZXJ2YWJsZTIgPSBvYnNlcnZhYmxlVmFsdWUoJ215T2JzZXJ2YWJsZTInLCAwKTtcblxuXHRcdGNvbnN0IG15RGVyaXZlZDEgPSBkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIG15RGVyaXZlZDEgKi9cblx0XHRcdHJldHVybiBteU9ic2VydmFibGUxLnJlYWQocmVhZGVyKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IG15RGVyaXZlZDIgPSBkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIG15RGVyaXZlZDIgKi9cblx0XHRcdHJldHVybiBteU9ic2VydmFibGUyLnJlYWQocmVhZGVyKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IG15RGVyaXZlZEExID0gZGVyaXZlZChyZWFkZXIgPT4gLyoqIEBkZXNjcmlwdGlvbiBteURlcml2ZWRBMSAqLyB7XG5cdFx0XHRjb25zdCBkMSA9IG15RGVyaXZlZDEucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKGQxID09PSAxKSB7XG5cdFx0XHRcdC8vIFRoaXMgYWRkcyBhbiBvYnNlcnZlciB3aGlsZSBteURlcml2ZWQgaXMgc3RpbGwgaW4gdXBkYXRlIG1vZGUuXG5cdFx0XHRcdC8vIFdoZW4gbXlEZXJpdmVkIGV4aXRzIHVwZGF0ZSBtb2RlLCB0aGUgb2JzZXJ2ZXIgc2hvdWxkbid0IHJlY2VpdmVcblx0XHRcdFx0Ly8gbW9yZSBlbmRVcGRhdGUgdGhhbiBiZWdpblVwZGF0ZSBjYWxscy5cblx0XHRcdFx0bXlEZXJpdmVkMi5yZWFkKHJlYWRlcik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRkcy5hZGQoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBteUF1dG9ydW4xICovXG5cdFx0XHRteURlcml2ZWRBMS5yZWFkKHJlYWRlcik7XG5cdFx0fSkpO1xuXG5cdFx0ZHMuYWRkKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gbXlBdXRvcnVuMiAqL1xuXHRcdFx0bXlEZXJpdmVkMi5yZWFkKHJlYWRlcik7XG5cdFx0fSkpO1xuXG5cdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0bXlPYnNlcnZhYmxlMS5zZXQoMSwgdHgpO1xuXHRcdFx0bXlPYnNlcnZhYmxlMi5zZXQoMSwgdHgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdidWc6IGZyb21PYnNlcnZhYmxlTGlnaHQgZG9lc250IHN1YnNjcmliZScsICgpID0+IHtcblx0XHRjb25zdCBsb2cgPSBuZXcgTG9nKCk7XG5cdFx0Y29uc3QgbXlPYnNlcnZhYmxlID0gbmV3IExvZ2dpbmdPYnNlcnZhYmxlVmFsdWUoJ215T2JzZXJ2YWJsZScsIDAsIGxvZyk7XG5cblx0XHRjb25zdCBteURlcml2ZWQgPSBkZXJpdmVkKHJlYWRlciA9PiAvKiogQGRlc2NyaXB0aW9uIG15RGVyaXZlZCAqLyB7XG5cdFx0XHRjb25zdCB2YWwgPSBteU9ic2VydmFibGUucmVhZChyZWFkZXIpO1xuXHRcdFx0bG9nLmxvZyhgbXlEZXJpdmVkLmNvbXB1dGVkKG15T2JzZXJ2YWJsZTI6ICR7dmFsfSlgKTtcblx0XHRcdHJldHVybiB2YWwgJSAxMDtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGUgPSBFdmVudC5mcm9tT2JzZXJ2YWJsZUxpZ2h0KG15RGVyaXZlZCk7XG5cdFx0bG9nLmxvZygnZXZlbnQgY3JlYXRlZCcpO1xuXHRcdGUoKCkgPT4ge1xuXHRcdFx0bG9nLmxvZygnZXZlbnQgZmlyZWQnKTtcblx0XHR9KTtcblxuXHRcdG15T2JzZXJ2YWJsZS5zZXQoMSwgdW5kZWZpbmVkKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHQnZXZlbnQgY3JlYXRlZCcsXG5cdFx0XHQnbXlPYnNlcnZhYmxlLmZpcnN0T2JzZXJ2ZXJBZGRlZCcsXG5cdFx0XHQnbXlPYnNlcnZhYmxlLmdldCcsXG5cdFx0XHQnbXlEZXJpdmVkLmNvbXB1dGVkKG15T2JzZXJ2YWJsZTI6IDApJyxcblx0XHRcdCdteU9ic2VydmFibGUuc2V0ICh2YWx1ZSAxKScsXG5cdFx0XHQnbXlPYnNlcnZhYmxlLmdldCcsXG5cdFx0XHQnbXlEZXJpdmVkLmNvbXB1dGVkKG15T2JzZXJ2YWJsZTI6IDEpJyxcblx0XHRcdCdldmVudCBmaXJlZCcsXG5cdFx0XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2J1ZzogRXZlbnQuZnJvbU9ic2VydmFibGUgYWx3YXlzIHNob3VsZCBnZXQgZXZlbnRzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGVtaXR0ZXIgPSBuZXcgRW1pdHRlcigpO1xuXHRcdGNvbnN0IGxvZyA9IG5ldyBMb2coKTtcblx0XHRsZXQgaSA9IDA7XG5cdFx0Y29uc3Qgb2JzID0gb2JzZXJ2YWJsZUZyb21FdmVudChlbWl0dGVyLmV2ZW50LCAoKSA9PiBpKTtcblxuXHRcdGkrKztcblx0XHRlbWl0dGVyLmZpcmUoMSk7XG5cblx0XHRjb25zdCBldnQyID0gRXZlbnQuZnJvbU9ic2VydmFibGUob2JzKTtcblx0XHRjb25zdCBkID0gZXZ0MihlID0+IHtcblx0XHRcdGxvZy5sb2coYGV2ZW50IGZpcmVkICR7ZX1gKTtcblx0XHR9KTtcblxuXHRcdGkrKztcblx0XHRlbWl0dGVyLmZpcmUoMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcImV2ZW50IGZpcmVkIDJcIl0pO1xuXG5cdFx0aSsrO1xuXHRcdGVtaXR0ZXIuZmlyZSgzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1wiZXZlbnQgZmlyZWQgM1wiXSk7XG5cblx0XHRkLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnZG9udCBydW4gYXV0b3J1biBhZnRlciBkaXNwb3NlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvZyA9IG5ldyBMb2coKTtcblx0XHRjb25zdCBteU9ic2VydmFibGUgPSBuZXcgTG9nZ2luZ09ic2VydmFibGVWYWx1ZSgnbXlPYnNlcnZhYmxlJywgMCwgbG9nKTtcblxuXHRcdGNvbnN0IGQgPSBhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIHVwZGF0ZSAqL1xuXHRcdFx0Y29uc3QgdiA9IG15T2JzZXJ2YWJsZS5yZWFkKHJlYWRlcik7XG5cdFx0XHRsb2cubG9nKCdhdXRvcnVuLCBteU9ic2VydmFibGU6JyArIHYpO1xuXHRcdH0pO1xuXG5cdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0bXlPYnNlcnZhYmxlLnNldCgxLCB0eCk7XG5cdFx0XHRkLmRpc3Bvc2UoKTtcblx0XHR9KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHQnbXlPYnNlcnZhYmxlLmZpcnN0T2JzZXJ2ZXJBZGRlZCcsXG5cdFx0XHQnbXlPYnNlcnZhYmxlLmdldCcsXG5cdFx0XHQnYXV0b3J1biwgbXlPYnNlcnZhYmxlOjAnLFxuXHRcdFx0J215T2JzZXJ2YWJsZS5zZXQgKHZhbHVlIDEpJyxcblx0XHRcdCdteU9ic2VydmFibGUubGFzdE9ic2VydmVyUmVtb3ZlZCcsXG5cdFx0XSk7XG5cdH0pO1xuXG5cdHN1aXRlKCd3YWl0Rm9yU3RhdGUnLCAoKSA9PiB7XG5cdFx0dGVzdCgncmVzb2x2ZScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGxvZyA9IG5ldyBMb2coKTtcblx0XHRcdGNvbnN0IG15T2JzZXJ2YWJsZSA9IG5ldyBMb2dnaW5nT2JzZXJ2YWJsZVZhbHVlKCdteU9ic2VydmFibGUnLCB7IHN0YXRlOiAnaW5pdGlhbGl6aW5nJyBhcyAnaW5pdGlhbGl6aW5nJyB8ICdyZWFkeScgfCAnZXJyb3InIH0sIGxvZyk7XG5cblx0XHRcdGNvbnN0IHAgPSB3YWl0Rm9yU3RhdGUobXlPYnNlcnZhYmxlLCBwID0+IHAuc3RhdGUgPT09ICdyZWFkeScsIHAgPT4gcC5zdGF0ZSA9PT0gJ2Vycm9yJykudGhlbihyID0+IHtcblx0XHRcdFx0bG9nLmxvZyhgcmVzb2x2ZWQgJHtKU09OLnN0cmluZ2lmeShyKX1gKTtcblx0XHRcdH0sIChlcnIpID0+IHtcblx0XHRcdFx0bG9nLmxvZyhgcmVqZWN0ZWQgJHtKU09OLnN0cmluZ2lmeShlcnIpfWApO1xuXHRcdFx0fSk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdCdteU9ic2VydmFibGUuZmlyc3RPYnNlcnZlckFkZGVkJyxcblx0XHRcdFx0J215T2JzZXJ2YWJsZS5nZXQnLFxuXHRcdFx0XSk7XG5cblx0XHRcdG15T2JzZXJ2YWJsZS5zZXQoeyBzdGF0ZTogJ3JlYWR5JyB9LCB1bmRlZmluZWQpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XHQnbXlPYnNlcnZhYmxlLnNldCAodmFsdWUgW29iamVjdCBPYmplY3RdKScsXG5cdFx0XHRcdCdteU9ic2VydmFibGUuZ2V0Jyxcblx0XHRcdFx0J215T2JzZXJ2YWJsZS5sYXN0T2JzZXJ2ZXJSZW1vdmVkJyxcblx0XHRcdF0pO1xuXG5cdFx0XHRhd2FpdCBwO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XHQncmVzb2x2ZWQge1xcXCJzdGF0ZVxcXCI6XFxcInJlYWR5XFxcIn0nLFxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdyZXNvbHZlSW1tZWRpYXRlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbG9nID0gbmV3IExvZygpO1xuXHRcdFx0Y29uc3QgbXlPYnNlcnZhYmxlID0gbmV3IExvZ2dpbmdPYnNlcnZhYmxlVmFsdWUoJ215T2JzZXJ2YWJsZScsIHsgc3RhdGU6ICdyZWFkeScgYXMgJ2luaXRpYWxpemluZycgfCAncmVhZHknIHwgJ2Vycm9yJyB9LCBsb2cpO1xuXG5cdFx0XHRjb25zdCBwID0gd2FpdEZvclN0YXRlKG15T2JzZXJ2YWJsZSwgcCA9PiBwLnN0YXRlID09PSAncmVhZHknLCBwID0+IHAuc3RhdGUgPT09ICdlcnJvcicpLnRoZW4ociA9PiB7XG5cdFx0XHRcdGxvZy5sb2coYHJlc29sdmVkICR7SlNPTi5zdHJpbmdpZnkocil9YCk7XG5cdFx0XHR9LCAoZXJyKSA9PiB7XG5cdFx0XHRcdGxvZy5sb2coYHJlamVjdGVkICR7SlNPTi5zdHJpbmdpZnkoZXJyKX1gKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XHQnbXlPYnNlcnZhYmxlLmZpcnN0T2JzZXJ2ZXJBZGRlZCcsXG5cdFx0XHRcdCdteU9ic2VydmFibGUuZ2V0Jyxcblx0XHRcdFx0J215T2JzZXJ2YWJsZS5sYXN0T2JzZXJ2ZXJSZW1vdmVkJyxcblx0XHRcdF0pO1xuXG5cdFx0XHRteU9ic2VydmFibGUuc2V0KHsgc3RhdGU6ICdlcnJvcicgfSwgdW5kZWZpbmVkKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0J215T2JzZXJ2YWJsZS5zZXQgKHZhbHVlIFtvYmplY3QgT2JqZWN0XSknLFxuXHRcdFx0XSk7XG5cblx0XHRcdGF3YWl0IHA7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdCdyZXNvbHZlZCB7XFxcInN0YXRlXFxcIjpcXFwicmVhZHlcXFwifScsXG5cdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3JlamVjdCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGxvZyA9IG5ldyBMb2coKTtcblx0XHRcdGNvbnN0IG15T2JzZXJ2YWJsZSA9IG5ldyBMb2dnaW5nT2JzZXJ2YWJsZVZhbHVlKCdteU9ic2VydmFibGUnLCB7IHN0YXRlOiAnaW5pdGlhbGl6aW5nJyBhcyAnaW5pdGlhbGl6aW5nJyB8ICdyZWFkeScgfCAnZXJyb3InIH0sIGxvZyk7XG5cblx0XHRcdGNvbnN0IHAgPSB3YWl0Rm9yU3RhdGUobXlPYnNlcnZhYmxlLCBwID0+IHAuc3RhdGUgPT09ICdyZWFkeScsIHAgPT4gcC5zdGF0ZSA9PT0gJ2Vycm9yJykudGhlbihyID0+IHtcblx0XHRcdFx0bG9nLmxvZyhgcmVzb2x2ZWQgJHtKU09OLnN0cmluZ2lmeShyKX1gKTtcblx0XHRcdH0sIChlcnIpID0+IHtcblx0XHRcdFx0bG9nLmxvZyhgcmVqZWN0ZWQgJHtKU09OLnN0cmluZ2lmeShlcnIpfWApO1xuXHRcdFx0fSk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdCdteU9ic2VydmFibGUuZmlyc3RPYnNlcnZlckFkZGVkJyxcblx0XHRcdFx0J215T2JzZXJ2YWJsZS5nZXQnLFxuXHRcdFx0XSk7XG5cblx0XHRcdG15T2JzZXJ2YWJsZS5zZXQoeyBzdGF0ZTogJ2Vycm9yJyB9LCB1bmRlZmluZWQpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XHQnbXlPYnNlcnZhYmxlLnNldCAodmFsdWUgW29iamVjdCBPYmplY3RdKScsXG5cdFx0XHRcdCdteU9ic2VydmFibGUuZ2V0Jyxcblx0XHRcdFx0J215T2JzZXJ2YWJsZS5sYXN0T2JzZXJ2ZXJSZW1vdmVkJyxcblx0XHRcdF0pO1xuXG5cdFx0XHRhd2FpdCBwO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XHQncmVqZWN0ZWQge1xcXCJzdGF0ZVxcXCI6XFxcImVycm9yXFxcIn0nXG5cdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2Rlcml2ZWQgYXMgbGF6eScsICgpID0+IHtcblx0XHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0Y29uc3QgbG9nID0gbmV3IExvZygpO1xuXHRcdFx0bGV0IGkgPSAwO1xuXHRcdFx0Y29uc3QgZCA9IGRlcml2ZWREaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdFx0Y29uc3QgaWQgPSBpKys7XG5cdFx0XHRcdGxvZy5sb2coJ215RGVyaXZlZCAnICsgaWQpO1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGRpc3Bvc2U6ICgpID0+IGxvZy5sb2coYGRpc3Bvc2VkICR7aWR9YClcblx0XHRcdFx0fTtcblx0XHRcdH0pO1xuXG5cdFx0XHRkLmdldCgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFsnbXlEZXJpdmVkIDAnLCAnZGlzcG9zZWQgMCddKTtcblx0XHRcdGQuZ2V0KCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgWydteURlcml2ZWQgMScsICdkaXNwb3NlZCAxJ10pO1xuXG5cdFx0XHRkLmtlZXBPYnNlcnZlZChzdG9yZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW10pO1xuXHRcdFx0ZC5nZXQoKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbJ215RGVyaXZlZCAyJ10pO1xuXHRcdFx0ZC5nZXQoKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXSk7XG5cblx0XHRcdHN0b3JlLmRpc3Bvc2UoKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFsnZGlzcG9zZWQgMiddKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnb2JzZXJ2YWJsZVZhbHVlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvZyA9IG5ldyBMb2coKTtcblx0XHRjb25zdCBteU9ic2VydmFibGUxID0gb2JzZXJ2YWJsZVZhbHVlPG51bWJlcj4oJ215T2JzZXJ2YWJsZTEnLCAwKTtcblx0XHRjb25zdCBteU9ic2VydmFibGUyID0gb2JzZXJ2YWJsZVZhbHVlPG51bWJlciwgeyBtZXNzYWdlOiBzdHJpbmcgfT4oJ215T2JzZXJ2YWJsZTInLCAwKTtcblxuXHRcdGNvbnN0IGQgPSBhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIHVwZGF0ZSAqL1xuXHRcdFx0Y29uc3QgdjEgPSBteU9ic2VydmFibGUxLnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IHYyID0gbXlPYnNlcnZhYmxlMi5yZWFkKHJlYWRlcik7XG5cdFx0XHRsb2cubG9nKCdhdXRvcnVuLCBteU9ic2VydmFibGUxOicgKyB2MSArICcsIG15T2JzZXJ2YWJsZTI6JyArIHYyKTtcblx0XHR9KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHQnYXV0b3J1biwgbXlPYnNlcnZhYmxlMTowLCBteU9ic2VydmFibGUyOjAnXG5cdFx0XSk7XG5cblx0XHQvLyBEb2Vzbid0IHRyaWdnZXIgdGhlIGF1dG9ydW4sIGJlY2F1c2Ugbm8gZGVsdGEgd2FzIHByb3ZpZGVkIGFuZCB0aGUgdmFsdWUgZGlkIG5vdCBjaGFuZ2Vcblx0XHRteU9ic2VydmFibGUxLnNldCgwLCB1bmRlZmluZWQpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRdKTtcblxuXHRcdC8vIFRyaWdnZXJzIHRoZSBhdXRvcnVuLiBUaGUgdmFsdWUgZGlkIG5vdCBjaGFuZ2UsIGJ1dCBhIGRlbHRhIHZhbHVlIHdhcyBwcm92aWRlZFxuXHRcdG15T2JzZXJ2YWJsZTIuc2V0KDAsIHVuZGVmaW5lZCwgeyBtZXNzYWdlOiAnY2hhbmdlMScgfSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0J2F1dG9ydW4sIG15T2JzZXJ2YWJsZTE6MCwgbXlPYnNlcnZhYmxlMjowJ1xuXHRcdF0pO1xuXG5cdFx0ZC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHN1aXRlKCdhdXRvcnVuIGVycm9yIGhhbmRsaW5nJywgKCkgPT4ge1xuXHRcdHRlc3QoJ2ltbWVkaWF0ZSB0aHJvdycsICgpID0+IHtcblx0XHRcdGNvbnN0IGxvZyA9IG5ldyBMb2coKTtcblxuXHRcdFx0c2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcihlID0+IHtcblx0XHRcdFx0bG9nLmxvZyhgZXJyb3I6ICR7ZS5tZXNzYWdlfWApO1xuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IG15T2JzZXJ2YWJsZSA9IG5ldyBMb2dnaW5nT2JzZXJ2YWJsZVZhbHVlKCdteU9ic2VydmFibGUnLCAwLCBsb2cpO1xuXG5cdFx0XHRjb25zdCBkID0gYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0XHRteU9ic2VydmFibGUucmVhZChyZWFkZXIpO1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2Zvb2JhcicpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdFwibXlPYnNlcnZhYmxlLmZpcnN0T2JzZXJ2ZXJBZGRlZFwiLFxuXHRcdFx0XHRcIm15T2JzZXJ2YWJsZS5nZXRcIixcblx0XHRcdFx0XCJlcnJvcjogZm9vYmFyXCJcblx0XHRcdF0pO1xuXG5cdFx0XHRteU9ic2VydmFibGUuc2V0KDEsIHVuZGVmaW5lZCk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdFwibXlPYnNlcnZhYmxlLnNldCAodmFsdWUgMSlcIixcblx0XHRcdFx0XCJteU9ic2VydmFibGUuZ2V0XCIsXG5cdFx0XHRcdFwiZXJyb3I6IGZvb2JhclwiLFxuXHRcdFx0XSk7XG5cblx0XHRcdGQuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnbGF0ZSB0aHJvdycsICgpID0+IHtcblx0XHRcdGNvbnN0IGxvZyA9IG5ldyBMb2coKTtcblxuXHRcdFx0c2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcihlID0+IHtcblx0XHRcdFx0bG9nLmxvZyhgZXJyb3I6ICR7ZS5tZXNzYWdlfWApO1xuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IG15T2JzZXJ2YWJsZSA9IG5ldyBMb2dnaW5nT2JzZXJ2YWJsZVZhbHVlKCdteU9ic2VydmFibGUnLCAwLCBsb2cpO1xuXG5cdFx0XHRjb25zdCBkID0gYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0XHRjb25zdCB2YWx1ZSA9IG15T2JzZXJ2YWJsZS5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdGlmICh2YWx1ZSA+PSAxKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdmb29iYXInKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdFwibXlPYnNlcnZhYmxlLmZpcnN0T2JzZXJ2ZXJBZGRlZFwiLFxuXHRcdFx0XHRcIm15T2JzZXJ2YWJsZS5nZXRcIixcblx0XHRcdF0pO1xuXG5cdFx0XHRteU9ic2VydmFibGUuc2V0KDEsIHVuZGVmaW5lZCk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobG9nLmdldEFuZENsZWFyRW50cmllcygpLCBbXG5cdFx0XHRcdFwibXlPYnNlcnZhYmxlLnNldCAodmFsdWUgMSlcIixcblx0XHRcdFx0XCJteU9ic2VydmFibGUuZ2V0XCIsXG5cdFx0XHRcdFwiZXJyb3I6IGZvb2JhclwiLFxuXHRcdFx0XSk7XG5cblx0XHRcdG15T2JzZXJ2YWJsZS5zZXQoMiwgdW5kZWZpbmVkKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIFtcblx0XHRcdFx0XCJteU9ic2VydmFibGUuc2V0ICh2YWx1ZSAyKVwiLFxuXHRcdFx0XHRcIm15T2JzZXJ2YWJsZS5nZXRcIixcblx0XHRcdFx0XCJlcnJvcjogZm9vYmFyXCIsXG5cdFx0XHRdKTtcblxuXHRcdFx0ZC5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlY29tcHV0ZUluaXRpYWxseUFuZE9uQ2hhbmdlIHNob3VsZCB3b3JrIHdoZW4gYSBkZXBlbmRlbmN5IHNldHMgYW4gb2JzZXJ2YWJsZScsICgpID0+IHtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBsb2cgPSBuZXcgTG9nKCk7XG5cblx0XHRjb25zdCBteU9ic2VydmFibGUgPSBuZXcgTG9nZ2luZ09ic2VydmFibGVWYWx1ZSgnbXlPYnNlcnZhYmxlJywgMCwgbG9nKTtcblxuXHRcdGxldCBzaG91bGRVcGRhdGUgPSB0cnVlO1xuXG5cdFx0Y29uc3QgbXlEZXJpdmVkID0gZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBteURlcml2ZWQgKi9cblxuXHRcdFx0bG9nLmxvZygnbXlEZXJpdmVkLmNvbXB1dGVkIHN0YXJ0Jyk7XG5cblx0XHRcdGNvbnN0IHZhbCA9IG15T2JzZXJ2YWJsZS5yZWFkKHJlYWRlcik7XG5cblx0XHRcdGlmIChzaG91bGRVcGRhdGUpIHtcblx0XHRcdFx0c2hvdWxkVXBkYXRlID0gZmFsc2U7XG5cdFx0XHRcdG15T2JzZXJ2YWJsZS5zZXQoMSwgdW5kZWZpbmVkKTtcblx0XHRcdH1cblxuXHRcdFx0bG9nLmxvZygnbXlEZXJpdmVkLmNvbXB1dGVkIGVuZCcpO1xuXG5cdFx0XHRyZXR1cm4gdmFsO1xuXHRcdH0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIChbXSkpO1xuXG5cdFx0bXlEZXJpdmVkLnJlY29tcHV0ZUluaXRpYWxseUFuZE9uQ2hhbmdlKHN0b3JlLCB2YWwgPT4ge1xuXHRcdFx0bG9nLmxvZyhgcmVjb21wdXRlSW5pdGlhbGx5QW5kT25DaGFuZ2UsIG15RGVyaXZlZDogJHt2YWx9YCk7XG5cdFx0fSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgW1xuXHRcdFx0XCJteURlcml2ZWQuY29tcHV0ZWQgc3RhcnRcIixcblx0XHRcdFwibXlPYnNlcnZhYmxlLmZpcnN0T2JzZXJ2ZXJBZGRlZFwiLFxuXHRcdFx0XCJteU9ic2VydmFibGUuZ2V0XCIsXG5cdFx0XHRcIm15T2JzZXJ2YWJsZS5zZXQgKHZhbHVlIDEpXCIsXG5cdFx0XHRcIm15RGVyaXZlZC5jb21wdXRlZCBlbmRcIixcblx0XHRcdFwibXlEZXJpdmVkLmNvbXB1dGVkIHN0YXJ0XCIsXG5cdFx0XHRcIm15T2JzZXJ2YWJsZS5nZXRcIixcblx0XHRcdFwibXlEZXJpdmVkLmNvbXB1dGVkIGVuZFwiLFxuXHRcdFx0XCJyZWNvbXB1dGVJbml0aWFsbHlBbmRPbkNoYW5nZSwgbXlEZXJpdmVkOiAxXCIsXG5cdFx0XSk7XG5cblx0XHRteURlcml2ZWQuZ2V0KCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsb2cuZ2V0QW5kQ2xlYXJFbnRyaWVzKCksIChbXSkpO1xuXG5cdFx0c3RvcmUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRzdWl0ZSgncHJldmVudCBpbnZhbGlkIHVzYWdlJywgKCkgPT4ge1xuXHRcdHN1aXRlKCdyZWFkaW5nIG91dHNpZGUgb2YgY29tcHV0ZSBmdW5jdGlvbicsICgpID0+IHtcblx0XHRcdHRlc3QoJ2Rlcml2ZWQnLCAoKSA9PiB7XG5cdFx0XHRcdGxldCBmbjogKCkgPT4gdm9pZCA9ICgpID0+IHsgfTtcblxuXHRcdFx0XHRjb25zdCBvYnMgPSBvYnNlcnZhYmxlVmFsdWUoJ29icycsIDApO1xuXHRcdFx0XHRjb25zdCBkID0gZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdFx0XHRcdGZuID0gKCkgPT4geyBvYnMucmVhZChyZWFkZXIpOyB9O1xuXHRcdFx0XHRcdHJldHVybiBvYnMucmVhZChyZWFkZXIpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjb25zdCBkaXNwID0gYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0XHRcdGQucmVhZChyZWFkZXIpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0XHRmbigpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRkaXNwLmRpc3Bvc2UoKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdhdXRvcnVuJywgKCkgPT4ge1xuXHRcdFx0XHRsZXQgZm46ICgpID0+IHZvaWQgPSAoKSA9PiB7IH07XG5cblx0XHRcdFx0Y29uc3Qgb2JzID0gb2JzZXJ2YWJsZVZhbHVlKCdvYnMnLCAwKTtcblx0XHRcdFx0Y29uc3QgZGlzcCA9IGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdFx0XHRmbiA9ICgpID0+IHsgb2JzLnJlYWQocmVhZGVyKTsgfTtcblx0XHRcdFx0XHRvYnMucmVhZChyZWFkZXIpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0XHRmbigpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRkaXNwLmRpc3Bvc2UoKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdC5za2lwKCdjYXRjaGVzIGN5Y2xpYyBkZXBlbmRlbmNpZXMnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBsb2cgPSBuZXcgTG9nKCk7XG5cblx0XHRcdHNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIoKGUpID0+IHtcblx0XHRcdFx0bG9nLmxvZyhlLnRvU3RyaW5nKCkpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IG9icyA9IG9ic2VydmFibGVWYWx1ZSgnb2JzJywgMCk7XG5cdFx0XHRjb25zdCBkMSA9IGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHRcdFx0bG9nLmxvZygnZDEuY29tcHV0ZWQgc3RhcnQnKTtcblx0XHRcdFx0Y29uc3QgeCA9IG9icy5yZWFkKHJlYWRlcikgKyBkMi5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdGxvZy5sb2coJ2QxLmNvbXB1dGVkIGVuZCcpO1xuXHRcdFx0XHRyZXR1cm4geDtcblx0XHRcdH0pO1xuXHRcdFx0Y29uc3QgZDIgPSBkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0XHRcdGxvZy5sb2coJ2QyLmNvbXB1dGVkIHN0YXJ0Jyk7XG5cdFx0XHRcdGQxLnJlYWQocmVhZGVyKTtcblx0XHRcdFx0bG9nLmxvZygnZDIuY29tcHV0ZWQgZW5kJyk7XG5cdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IGRpc3AgPSBhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRcdGxvZy5sb2coJ2F1dG9ydW4gc3RhcnQnKTtcblx0XHRcdFx0ZDEucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRsb2cubG9nKCdhdXRvcnVuIGVuZCcpO1xuXHRcdFx0XHRyZXR1cm4gMDtcblx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxvZy5nZXRBbmRDbGVhckVudHJpZXMoKSwgKFtcblx0XHRcdFx0XCJhdXRvcnVuIHN0YXJ0XCIsXG5cdFx0XHRcdFwiZDEuY29tcHV0ZWQgc3RhcnRcIixcblx0XHRcdFx0XCJkMi5jb21wdXRlZCBzdGFydFwiLFxuXHRcdFx0XHRcIkVycm9yOiBDeWNsaWMgZGVyaXZlZHMgYXJlIG5vdCBzdXBwb3J0ZWQgeWV0IVwiLFxuXHRcdFx0XHRcImQxLmNvbXB1dGVkIGVuZFwiLFxuXHRcdFx0XHRcImF1dG9ydW4gZW5kXCJcblx0XHRcdF0pKTtcblxuXHRcdFx0ZGlzcC5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG5cbmV4cG9ydCBjbGFzcyBMb2dnaW5nT2JzZXJ2ZXIgaW1wbGVtZW50cyBJT2JzZXJ2ZXIge1xuXHRwcml2YXRlIGNvdW50ID0gMDtcblxuXHRjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgZGVidWdOYW1lOiBzdHJpbmcsIHByaXZhdGUgcmVhZG9ubHkgbG9nOiBMb2cpIHtcblx0fVxuXG5cdGJlZ2luVXBkYXRlPFQ+KG9ic2VydmFibGU6IElPYnNlcnZhYmxlPFQ+KTogdm9pZCB7XG5cdFx0dGhpcy5jb3VudCsrO1xuXHRcdHRoaXMubG9nLmxvZyhgJHt0aGlzLmRlYnVnTmFtZX0uYmVnaW5VcGRhdGUgKGNvdW50ICR7dGhpcy5jb3VudH0pYCk7XG5cdH1cblx0ZW5kVXBkYXRlPFQ+KG9ic2VydmFibGU6IElPYnNlcnZhYmxlPFQ+KTogdm9pZCB7XG5cdFx0dGhpcy5sb2cubG9nKGAke3RoaXMuZGVidWdOYW1lfS5lbmRVcGRhdGUgKGNvdW50ICR7dGhpcy5jb3VudH0pYCk7XG5cdFx0dGhpcy5jb3VudC0tO1xuXHR9XG5cdGhhbmRsZUNoYW5nZTxULCBUQ2hhbmdlPihvYnNlcnZhYmxlOiBJT2JzZXJ2YWJsZVdpdGhDaGFuZ2U8VCwgVENoYW5nZT4sIGNoYW5nZTogVENoYW5nZSk6IHZvaWQge1xuXHRcdHRoaXMubG9nLmxvZyhgJHt0aGlzLmRlYnVnTmFtZX0uaGFuZGxlQ2hhbmdlIChjb3VudCAke3RoaXMuY291bnR9KWApO1xuXHR9XG5cdGhhbmRsZVBvc3NpYmxlQ2hhbmdlPFQ+KG9ic2VydmFibGU6IElPYnNlcnZhYmxlPFQ+KTogdm9pZCB7XG5cdFx0dGhpcy5sb2cubG9nKGAke3RoaXMuZGVidWdOYW1lfS5oYW5kbGVQb3NzaWJsZUNoYW5nZWApO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBMb2dnaW5nT2JzZXJ2YWJsZVZhbHVlPFQsIFRDaGFuZ2UgPSB2b2lkPlxuXHRleHRlbmRzIEJhc2VPYnNlcnZhYmxlPFQsIFRDaGFuZ2U+XG5cdGltcGxlbWVudHMgSVNldHRhYmxlT2JzZXJ2YWJsZTxULCBUQ2hhbmdlPiB7XG5cdHByaXZhdGUgdmFsdWU6IFQ7XG5cblx0Y29uc3RydWN0b3IocHVibGljIHJlYWRvbmx5IGRlYnVnTmFtZTogc3RyaW5nLCBpbml0aWFsVmFsdWU6IFQsIHByaXZhdGUgcmVhZG9ubHkgbG9nZ2VyOiBMb2cpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMudmFsdWUgPSBpbml0aWFsVmFsdWU7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgb25GaXJzdE9ic2VydmVyQWRkZWQoKTogdm9pZCB7XG5cdFx0dGhpcy5sb2dnZXIubG9nKGAke3RoaXMuZGVidWdOYW1lfS5maXJzdE9ic2VydmVyQWRkZWRgKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBvbkxhc3RPYnNlcnZlclJlbW92ZWQoKTogdm9pZCB7XG5cdFx0dGhpcy5sb2dnZXIubG9nKGAke3RoaXMuZGVidWdOYW1lfS5sYXN0T2JzZXJ2ZXJSZW1vdmVkYCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0KCk6IFQge1xuXHRcdHRoaXMubG9nZ2VyLmxvZyhgJHt0aGlzLmRlYnVnTmFtZX0uZ2V0YCk7XG5cdFx0cmV0dXJuIHRoaXMudmFsdWU7XG5cdH1cblxuXHRwdWJsaWMgc2V0KHZhbHVlOiBULCB0eDogSVRyYW5zYWN0aW9uIHwgdW5kZWZpbmVkLCBjaGFuZ2U6IFRDaGFuZ2UpOiB2b2lkIHtcblx0XHRpZiAodGhpcy52YWx1ZSA9PT0gdmFsdWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXR4KSB7XG5cdFx0XHR0cmFuc2FjdGlvbigodHgpID0+IHtcblx0XHRcdFx0dGhpcy5zZXQodmFsdWUsIHR4LCBjaGFuZ2UpO1xuXHRcdFx0fSwgKCkgPT4gYFNldHRpbmcgJHt0aGlzLmRlYnVnTmFtZX1gKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmxvZ2dlci5sb2coYCR7dGhpcy5kZWJ1Z05hbWV9LnNldCAodmFsdWUgJHt2YWx1ZX0pYCk7XG5cblx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cblx0XHRmb3IgKGNvbnN0IG9ic2VydmVyIG9mIHRoaXMuX29ic2VydmVycykge1xuXHRcdFx0dHgudXBkYXRlT2JzZXJ2ZXIob2JzZXJ2ZXIsIHRoaXMpO1xuXHRcdFx0b2JzZXJ2ZXIuaGFuZGxlQ2hhbmdlKHRoaXMsIGNoYW5nZSk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgdG9TdHJpbmcoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYCR7dGhpcy5kZWJ1Z05hbWV9OiAke3RoaXMudmFsdWV9YDtcblx0fVxufVxuXG5jbGFzcyBMb2cge1xuXHRwcml2YXRlIHJlYWRvbmx5IGVudHJpZXM6IHN0cmluZ1tdID0gW107XG5cdHB1YmxpYyBsb2cobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5lbnRyaWVzLnB1c2gobWVzc2FnZSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0QW5kQ2xlYXJFbnRyaWVzKCk6IHN0cmluZ1tdIHtcblx0XHRjb25zdCBlbnRyaWVzID0gWy4uLnRoaXMuZW50cmllc107XG5cdFx0dGhpcy5lbnRyaWVzLmxlbmd0aCA9IDA7XG5cdFx0cmV0dXJuIGVudHJpZXM7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGlDQUFpQztBQUMxQyxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLFNBQVMsc0JBQXNCLFNBQVMsbUJBQThFLGNBQWMscUJBQXFCLGtCQUFrQixpQkFBaUIsYUFBYSxvQkFBb0I7QUFDdE8sU0FBUyxzQkFBNkM7QUFDdEQsU0FBUywrQ0FBK0M7QUFFeEQsTUFBTSxlQUFlLE1BQU07QUFDMUIsUUFBTSxLQUFLLHdDQUF3QztBQUtuRCxRQUFNLFlBQVksTUFBTTtBQUN2QixTQUFLLHdCQUF3QixNQUFNO0FBQ2xDLFlBQU0sTUFBTSxJQUFJLElBQUk7QUFJcEIsWUFBTSxlQUFlLGdCQUFnQixnQkFBZ0IsQ0FBQztBQU90RCxTQUFHLElBQUksUUFBUSxZQUFVO0FBUXhCLFlBQUksSUFBSSwrQkFBK0IsYUFBYSxLQUFLLE1BQU0sQ0FBQyxHQUFHO0FBQUEsTUFJcEUsQ0FBQyxDQUFDO0FBRUYsYUFBTyxnQkFBZ0IsSUFBSSxtQkFBbUIsR0FBRyxDQUFDLGdDQUFnQyxDQUFDO0FBR25GLG1CQUFhLElBQUksR0FBRyxNQUFTO0FBRTdCLGFBQU8sZ0JBQWdCLElBQUksbUJBQW1CLEdBQUcsQ0FBQyxnQ0FBZ0MsQ0FBQztBQUduRixtQkFBYSxJQUFJLEdBQUcsTUFBUztBQUU3QixhQUFPLGdCQUFnQixJQUFJLG1CQUFtQixHQUFHLENBQUMsQ0FBQztBQUduRCxrQkFBWSxDQUFDLE9BQU87QUFDbkIscUJBQWEsSUFBSSxHQUFHLEVBQUU7QUFFdEIsZUFBTyxnQkFBZ0IsSUFBSSxtQkFBbUIsR0FBRyxDQUFDLENBQUM7QUFFbkQscUJBQWEsSUFBSSxHQUFHLEVBQUU7QUFDdEIsZUFBTyxnQkFBZ0IsSUFBSSxtQkFBbUIsR0FBRyxD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
