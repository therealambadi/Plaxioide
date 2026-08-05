import assert from "assert";
import { timeout } from "../../../../../base/common/async.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { runWithFakedTimers } from "../../../../../base/test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { ShutdownReason, WillShutdownJoinerOrder } from "../../common/lifecycle.js";
import { NativeLifecycleService } from "../../electron-sandbox/lifecycleService.js";
import { workbenchInstantiationService } from "../../../../test/electron-sandbox/workbenchTestServices.js";
suite("Lifecycleservice", function() {
  let lifecycleService;
  const disposables = new DisposableStore();
  class TestLifecycleService extends NativeLifecycleService {
    testHandleBeforeShutdown(reason) {
      return super.handleBeforeShutdown(reason);
    }
    testHandleWillShutdown(reason) {
      return super.handleWillShutdown(reason);
    }
  }
  setup(async () => {
    const instantiationService = workbenchInstantiationService(void 0, disposables);
    lifecycleService = disposables.add(instantiationService.createInstance(TestLifecycleService));
  });
  teardown(async () => {
    disposables.clear();
  });
  test("onBeforeShutdown - final veto called after other vetos", async function() {
    let vetoCalled = false;
    let finalVetoCalled = false;
    const order = [];
    disposables.add(lifecycleService.onBeforeShutdown((e) => {
      e.veto(new Promise((resolve) => {
        vetoCalled = true;
        order.push(1);
        resolve(false);
      }), "test");
    }));
    disposables.add(lifecycleService.onBeforeShutdown((e) => {
      e.finalVeto(() => {
        return new Promise((resolve) => {
          finalVetoCalled = true;
          order.push(2);
          resolve(true);
        });
      }, "test");
    }));
    const veto = await lifecycleService.testHandleBeforeShutdown(ShutdownReason.QUIT);
    assert.strictEqual(veto, true);
    assert.strictEqual(vetoCalled, true);
    assert.strictEqual(finalVetoCalled, true);
    assert.strictEqual(order[0], 1);
    assert.strictEqual(order[1], 2);
  });
  test("onBeforeShutdown - final veto not called when veto happened before", async function() {
    let vetoCalled = false;
    let finalVetoCalled = false;
    disposables.add(lifecycleService.onBeforeShutdown((e) => {
      e.veto(new Promise((resolve) => {
        vetoCalled = true;
        resolve(true);
      }), "test");
    }));
    disposables.add(lifecycleService.onBeforeShutdown((e) => {
      e.finalVeto(() => {
        return new Promise((resolve) => {
          finalVetoCalled = true;
          resolve(true);
        });
      }, "test");
    }));
    const veto = await lifecycleService.testHandleBeforeShutdown(ShutdownReason.QUIT);
    assert.strictEqual(veto, true);
    assert.strictEqual(vetoCalled, true);
    assert.strictEqual(finalVetoCalled, false);
  });
  test("onBeforeShutdown - veto with error is treated as veto", async function() {
    disposables.add(lifecycleService.onBeforeShutdown((e) => {
      e.veto(new Promise((resolve, reject) => {
        reject(new Error("Fail"));
      }), "test");
    }));
    const veto = await lifecycleService.testHandleBeforeShutdown(ShutdownReason.QUIT);
    assert.strictEqual(veto, true);
  });
  test("onBeforeShutdown - final veto with error is treated as veto", async function() {
    disposables.add(lifecycleService.onBeforeShutdown((e) => {
      e.finalVeto(() => new Promise((resolve, reject) => {
        reject(new Error("Fail"));
      }), "test");
    }));
    const veto = await lifecycleService.testHandleBeforeShutdown(ShutdownReason.QUIT);
    assert.strictEqual(veto, true);
  });
  test("onWillShutdown - join", async function() {
    let joinCalled = false;
    disposables.add(lifecycleService.onWillShutdown((e) => {
      e.join(new Promise((resolve) => {
        joinCalled = true;
        resolve();
      }), { id: "test", label: "test" });
    }));
    await lifecycleService.testHandleWillShutdown(ShutdownReason.QUIT);
    assert.strictEqual(joinCalled, true);
  });
  test("onWillShutdown - join with error is handled", async function() {
    let joinCalled = false;
    disposables.add(lifecycleService.onWillShutdown((e) => {
      e.join(new Promise((resolve, reject) => {
        joinCalled = true;
        reject(new Error("Fail"));
      }), { id: "test", label: "test" });
    }));
    await lifecycleService.testHandleWillShutdown(ShutdownReason.QUIT);
    assert.strictEqual(joinCalled, true);
  });
  test("onWillShutdown - join order", async function() {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      const order = [];
      disposables.add(lifecycleService.onWillShutdown((e) => {
        e.join(async () => {
          order.push("disconnect start");
          await timeout(1);
          order.push("disconnect end");
        }, { id: "test", label: "test", order: WillShutdownJoinerOrder.Last });
        e.join((async () => {
          order.push("default start");
          await timeout(1);
          order.push("default end");
        })(), { id: "test", label: "test", order: WillShutdownJoinerOrder.Default });
      }));
      await lifecycleService.testHandleWillShutdown(ShutdownReason.QUIT);
      assert.deepStrictEqual(order, [
        "default start",
        "default end",
        "disconnect start",
        "disconnect end"
      ]);
    });
  });
  test("willShutdown is set when shutting down", async function() {
    let willShutdownSet = false;
    disposables.add(lifecycleService.onWillShutdown((e) => {
      e.join(new Promise((resolve) => {
        if (lifecycleService.willShutdown) {
          willShutdownSet = true;
          resolve();
        }
      }), { id: "test", label: "test" });
    }));
    await lifecycleService.testHandleWillShutdown(ShutdownReason.QUIT);
    assert.strictEqual(willShutdownSet, true);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvbGlmZWN5Y2xlL3Rlc3QvZWxlY3Ryb24tc2FuZGJveC9saWZlY3ljbGVTZXJ2aWNlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IHJ1bldpdGhGYWtlZFRpbWVycyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdGltZVRyYXZlbFNjaGVkdWxlci5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFNodXRkb3duUmVhc29uLCBXaWxsU2h1dGRvd25Kb2luZXJPcmRlciB9IGZyb20gJy4uLy4uL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTmF0aXZlTGlmZWN5Y2xlU2VydmljZSB9IGZyb20gJy4uLy4uL2VsZWN0cm9uLXNhbmRib3gvbGlmZWN5Y2xlU2VydmljZS5qcyc7XG5pbXBvcnQgeyB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvZWxlY3Ryb24tc2FuZGJveC93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuXG5zdWl0ZSgnTGlmZWN5Y2xlc2VydmljZScsIGZ1bmN0aW9uICgpIHtcblxuXHRsZXQgbGlmZWN5Y2xlU2VydmljZTogVGVzdExpZmVjeWNsZVNlcnZpY2U7XG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdGNsYXNzIFRlc3RMaWZlY3ljbGVTZXJ2aWNlIGV4dGVuZHMgTmF0aXZlTGlmZWN5Y2xlU2VydmljZSB7XG5cblx0XHR0ZXN0SGFuZGxlQmVmb3JlU2h1dGRvd24ocmVhc29uOiBTaHV0ZG93blJlYXNvbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdFx0cmV0dXJuIHN1cGVyLmhhbmRsZUJlZm9yZVNodXRkb3duKHJlYXNvbik7XG5cdFx0fVxuXG5cdFx0dGVzdEhhbmRsZVdpbGxTaHV0ZG93bihyZWFzb246IFNodXRkb3duUmVhc29uKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRyZXR1cm4gc3VwZXIuaGFuZGxlV2lsbFNodXRkb3duKHJlYXNvbik7XG5cdFx0fVxuXHR9XG5cblx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBkaXNwb3NhYmxlcyk7XG5cdFx0bGlmZWN5Y2xlU2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0TGlmZWN5Y2xlU2VydmljZSkpO1xuXHR9KTtcblxuXHR0ZWFyZG93bihhc3luYyAoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fSk7XG5cblx0dGVzdCgnb25CZWZvcmVTaHV0ZG93biAtIGZpbmFsIHZldG8gY2FsbGVkIGFmdGVyIG90aGVyIHZldG9zJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGxldCB2ZXRvQ2FsbGVkID0gZmFsc2U7XG5cdFx0bGV0IGZpbmFsVmV0b0NhbGxlZCA9IGZhbHNlO1xuXG5cdFx0Y29uc3Qgb3JkZXI6IG51bWJlcltdID0gW107XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobGlmZWN5Y2xlU2VydmljZS5vbkJlZm9yZVNodXRkb3duKGUgPT4ge1xuXHRcdFx0ZS52ZXRvKG5ldyBQcm9taXNlPGJvb2xlYW4+KHJlc29sdmUgPT4ge1xuXHRcdFx0XHR2ZXRvQ2FsbGVkID0gdHJ1ZTtcblx0XHRcdFx0b3JkZXIucHVzaCgxKTtcblxuXHRcdFx0XHRyZXNvbHZlKGZhbHNlKTtcblx0XHRcdH0pLCAndGVzdCcpO1xuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChsaWZlY3ljbGVTZXJ2aWNlLm9uQmVmb3JlU2h1dGRvd24oZSA9PiB7XG5cdFx0XHRlLmZpbmFsVmV0bygoKSA9PiB7XG5cdFx0XHRcdHJldHVybiBuZXcgUHJvbWlzZTxib29sZWFuPihyZXNvbHZlID0+IHtcblx0XHRcdFx0XHRmaW5hbFZldG9DYWxsZWQgPSB0cnVlO1xuXHRcdFx0XHRcdG9yZGVyLnB1c2goMik7XG5cblx0XHRcdFx0XHRyZXNvbHZlKHRydWUpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0sICd0ZXN0Jyk7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgdmV0byA9IGF3YWl0IGxpZmVjeWNsZVNlcnZpY2UudGVzdEhhbmRsZUJlZm9yZVNodXRkb3duKFNodXRkb3duUmVhc29uLlFVSVQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZldG8sIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2ZXRvQ2FsbGVkLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluYWxWZXRvQ2FsbGVkLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3JkZXJbMF0sIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChvcmRlclsxXSwgMik7XG5cdH0pO1xuXG5cdHRlc3QoJ29uQmVmb3JlU2h1dGRvd24gLSBmaW5hbCB2ZXRvIG5vdCBjYWxsZWQgd2hlbiB2ZXRvIGhhcHBlbmVkIGJlZm9yZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgdmV0b0NhbGxlZCA9IGZhbHNlO1xuXHRcdGxldCBmaW5hbFZldG9DYWxsZWQgPSBmYWxzZTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChsaWZlY3ljbGVTZXJ2aWNlLm9uQmVmb3JlU2h1dGRvd24oZSA9PiB7XG5cdFx0XHRlLnZldG8obmV3IFByb21pc2U8Ym9vbGVhbj4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdHZldG9DYWxsZWQgPSB0cnVlO1xuXG5cdFx0XHRcdHJlc29sdmUodHJ1ZSk7XG5cdFx0XHR9KSwgJ3Rlc3QnKTtcblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobGlmZWN5Y2xlU2VydmljZS5vbkJlZm9yZVNodXRkb3duKGUgPT4ge1xuXHRcdFx0ZS5maW5hbFZldG8oKCkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFByb21pc2U8Ym9vbGVhbj4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdFx0ZmluYWxWZXRvQ2FsbGVkID0gdHJ1ZTtcblxuXHRcdFx0XHRcdHJlc29sdmUodHJ1ZSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSwgJ3Rlc3QnKTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCB2ZXRvID0gYXdhaXQgbGlmZWN5Y2xlU2VydmljZS50ZXN0SGFuZGxlQmVmb3JlU2h1dGRvd24oU2h1dGRvd25SZWFzb24uUVVJVCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmV0bywgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZldG9DYWxsZWQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5hbFZldG9DYWxsZWQsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnb25CZWZvcmVTaHV0ZG93biAtIHZldG8gd2l0aCBlcnJvciBpcyB0cmVhdGVkIGFzIHZldG8nLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxpZmVjeWNsZVNlcnZpY2Uub25CZWZvcmVTaHV0ZG93bihlID0+IHtcblx0XHRcdGUudmV0byhuZXcgUHJvbWlzZTxib29sZWFuPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdHJlamVjdChuZXcgRXJyb3IoJ0ZhaWwnKSk7XG5cdFx0XHR9KSwgJ3Rlc3QnKTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCB2ZXRvID0gYXdhaXQgbGlmZWN5Y2xlU2VydmljZS50ZXN0SGFuZGxlQmVmb3JlU2h1dGRvd24oU2h1dGRvd25SZWFzb24uUVVJVCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmV0bywgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ29uQmVmb3JlU2h1dGRvd24gLSBmaW5hbCB2ZXRvIHdpdGggZXJyb3IgaXMgdHJlYXRlZCBhcyB2ZXRvJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGRpc3Bvc2FibGVzLmFkZChsaWZlY3ljbGVTZXJ2aWNlLm9uQmVmb3JlU2h1dGRvd24oZSA9PiB7XG5cdFx0XHRlLmZpbmFsVmV0bygoKSA9PiBuZXcgUHJvbWlzZTxib29sZWFuPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdHJlamVjdChuZXcgRXJyb3IoJ0ZhaWwnKSk7XG5cdFx0XHR9KSwgJ3Rlc3QnKTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCB2ZXRvID0gYXdhaXQgbGlmZWN5Y2xlU2VydmljZS50ZXN0SGFuZGxlQmVmb3JlU2h1dGRvd24oU2h1dGRvd25SZWFzb24uUVVJVCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmV0bywgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ29uV2lsbFNodXRkb3duIC0gam9pbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgam9pbkNhbGxlZCA9IGZhbHNlO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxpZmVjeWNsZVNlcnZpY2Uub25XaWxsU2h1dGRvd24oZSA9PiB7XG5cdFx0XHRlLmpvaW4obmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdGpvaW5DYWxsZWQgPSB0cnVlO1xuXG5cdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdH0pLCB7IGlkOiAndGVzdCcsIGxhYmVsOiAndGVzdCcgfSk7XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgbGlmZWN5Y2xlU2VydmljZS50ZXN0SGFuZGxlV2lsbFNodXRkb3duKFNodXRkb3duUmVhc29uLlFVSVQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGpvaW5DYWxsZWQsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdvbldpbGxTaHV0ZG93biAtIGpvaW4gd2l0aCBlcnJvciBpcyBoYW5kbGVkJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGxldCBqb2luQ2FsbGVkID0gZmFsc2U7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobGlmZWN5Y2xlU2VydmljZS5vbldpbGxTaHV0ZG93bihlID0+IHtcblx0XHRcdGUuam9pbihuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdGpvaW5DYWxsZWQgPSB0cnVlO1xuXG5cdFx0XHRcdHJlamVjdChuZXcgRXJyb3IoJ0ZhaWwnKSk7XG5cdFx0XHR9KSwgeyBpZDogJ3Rlc3QnLCBsYWJlbDogJ3Rlc3QnIH0pO1xuXHRcdH0pKTtcblxuXHRcdGF3YWl0IGxpZmVjeWNsZVNlcnZpY2UudGVzdEhhbmRsZVdpbGxTaHV0ZG93bihTaHV0ZG93blJlYXNvbi5RVUlUKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChqb2luQ2FsbGVkLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnb25XaWxsU2h1dGRvd24gLSBqb2luIG9yZGVyJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiBydW5XaXRoRmFrZWRUaW1lcnMoeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IG9yZGVyOiBzdHJpbmdbXSA9IFtdO1xuXG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQobGlmZWN5Y2xlU2VydmljZS5vbldpbGxTaHV0ZG93bihlID0+IHtcblx0XHRcdFx0ZS5qb2luKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRvcmRlci5wdXNoKCdkaXNjb25uZWN0IHN0YXJ0Jyk7XG5cdFx0XHRcdFx0YXdhaXQgdGltZW91dCgxKTtcblx0XHRcdFx0XHRvcmRlci5wdXNoKCdkaXNjb25uZWN0IGVuZCcpO1xuXHRcdFx0XHR9LCB7IGlkOiAndGVzdCcsIGxhYmVsOiAndGVzdCcsIG9yZGVyOiBXaWxsU2h1dGRvd25Kb2luZXJPcmRlci5MYXN0IH0pO1xuXG5cdFx0XHRcdGUuam9pbigoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdG9yZGVyLnB1c2goJ2RlZmF1bHQgc3RhcnQnKTtcblx0XHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEpO1xuXHRcdFx0XHRcdG9yZGVyLnB1c2goJ2RlZmF1bHQgZW5kJyk7XG5cdFx0XHRcdH0pKCksIHsgaWQ6ICd0ZXN0JywgbGFiZWw6ICd0ZXN0Jywgb3JkZXI6IFdpbGxTaHV0ZG93bkpvaW5lck9yZGVyLkRlZmF1bHQgfSk7XG5cdFx0XHR9KSk7XG5cblx0XHRcdGF3YWl0IGxpZmVjeWNsZVNlcnZpY2UudGVzdEhhbmRsZVdpbGxTaHV0ZG93bihTaHV0ZG93blJlYXNvbi5RVUlUKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChvcmRlciwgW1xuXHRcdFx0XHQnZGVmYXVsdCBzdGFydCcsXG5cdFx0XHRcdCdkZWZhdWx0IGVuZCcsXG5cdFx0XHRcdCdkaXNjb25uZWN0IHN0YXJ0Jyxcblx0XHRcdFx0J2Rpc2Nvbm5lY3QgZW5kJ1xuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dpbGxTaHV0ZG93biBpcyBzZXQgd2hlbiBzaHV0dGluZyBkb3duJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGxldCB3aWxsU2h1dGRvd25TZXQgPSBmYWxzZTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChsaWZlY3ljbGVTZXJ2aWNlLm9uV2lsbFNodXRkb3duKGUgPT4ge1xuXHRcdFx0ZS5qb2luKG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdFx0XHRpZiAobGlmZWN5Y2xlU2VydmljZS53aWxsU2h1dGRvd24pIHtcblx0XHRcdFx0XHR3aWxsU2h1dGRvd25TZXQgPSB0cnVlO1xuXHRcdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSksIHsgaWQ6ICd0ZXN0JywgbGFiZWw6ICd0ZXN0JyB9KTtcblx0XHR9KSk7XG5cblx0XHRhd2FpdCBsaWZlY3ljbGVTZXJ2aWNlLnRlc3RIYW5kbGVXaWxsU2h1dGRvd24oU2h1dGRvd25SZWFzb24uUVVJVCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod2lsbFNodXRkb3duU2V0LCB0cnVlKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGVBQWU7QUFDeEIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxnQkFBZ0IsK0JBQStCO0FBQ3hELFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMscUNBQXFDO0FBRTlDLE1BQU0sb0JBQW9CLFdBQVk7QUFFckMsTUFBSTtBQUNKLFFBQU0sY0FBYyxJQUFJLGdCQUFnQjtBQUFBLEVBRXhDLE1BQU0sNkJB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
