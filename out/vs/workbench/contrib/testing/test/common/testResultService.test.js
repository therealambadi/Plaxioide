import assert from "assert";
import { timeout } from "../../../../../base/common/async.js";
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { MockContextKeyService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
import { NullLogService } from "../../../../../platform/log/common/log.js";
import { NullTelemetryService } from "../../../../../platform/telemetry/common/telemetryUtils.js";
import { TestId } from "../../common/testId.js";
import { TestProfileService } from "../../common/testProfileService.js";
import { HydratedTestResult, LiveTestResult, TaskRawOutput, TestResultItemChangeReason, resultItemParents } from "../../common/testResult.js";
import { TestResultService } from "../../common/testResultService.js";
import { InMemoryResultStorage } from "../../common/testResultStorage.js";
import { TestResultState, TestRunProfileBitset } from "../../common/testTypes.js";
import { makeEmptyCounts } from "../../common/testingStates.js";
import { getInitializedMainTestCollection, testStubs } from "./testStubs.js";
import { TestStorageService } from "../../../../test/common/workbenchTestServices.js";
suite("Workbench - Test Results Service", () => {
  const getLabelsIn = (it) => [...it].map((t) => t.item.label).sort();
  const getChangeSummary = () => [...changed].map((c) => ({ reason: c.reason, label: c.item.item.label }));
  let r;
  let changed = /* @__PURE__ */ new Set();
  let tests;
  const defaultOpts = (testIds) => ({
    group: TestRunProfileBitset.Run,
    targets: [{
      profileId: 0,
      controllerId: "ctrlId",
      testIds
    }]
  });
  let insertCounter = 0;
  class TestLiveTestResult extends LiveTestResult {
    constructor(id, persist, request) {
      super(id, persist, request, insertCounter++, NullTelemetryService);
      ds.add(this);
    }
    setAllToStatePublic(state, taskId, when) {
      this.setAllToState(state, taskId, when);
    }
  }
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  setup(async () => {
    changed = /* @__PURE__ */ new Set();
    r = ds.add(new TestLiveTestResult(
      "foo",
      true,
      defaultOpts(["id-a"])
    ));
    ds.add(r.onChange((e) => changed.add(e)));
    r.addTask({ id: "t", name: "n", running: true, ctrlId: "ctrl" });
    tests = ds.add(testStubs.nested());
    const cts = ds.add(new CancellationTokenSource());
    const ok = await Promise.race([
      Promise.resolve(tests.expand(tests.root.id, Infinity)).then(() => true),
      timeout(1e3, cts.token).then(() => false)
    ]);
    cts.cancel();
    if (!ok) {
      throw new Error("timed out while expanding, diff: " + JSON.stringify(tests.collectDiff()));
    }
    r.addTestChainToRun("ctrlId", [
      tests.root.toTestItem(),
      tests.root.children.get("id-a").toTestItem(),
      tests.root.children.get("id-a").children.get("id-aa").toTestItem()
    ]);
    r.addTestChainToRun("ctrlId", [
      tests.root.children.get("id-a").toTestItem(),
      tests.root.children.get("id-a").children.get("id-ab").toTestItem()
    ]);
  });
  suite("LiveTestResult", () => {
    test("is empty if no tests are yet present", async () => {
      assert.deepStrictEqual(getLabelsIn(new TestLiveTestResult(
        "foo",
        false,
        defaultOpts(["id-a"])
      ).tests), []);
    });
    test("initially queues nothing", () => {
      assert.deepStrictEqual(getChangeSummary(), []);
    });
    test("initializes with the subtree of requested tests", () => {
      assert.deepStrictEqual(getLabelsIn(r.tests), ["a", "aa", "ab", "root"]);
    });
    test("initializes with valid counts", () => {
      const c = makeEmptyCounts();
      c[TestResultState.Unset] = 4;
      assert.deepStrictEqual(r.counts, c);
    });
    test("setAllToState", () => {
      changed.clear();
      r.setAllToStatePublic(TestResultState.Queued, "t", (_, t) => t.item.label !== "root");
      const c = makeEmptyCounts();
      c[TestResultState.Unset] = 1;
      c[TestResultState.Queued] = 3;
      assert.deepStrictEqual(r.counts, c);
      r.setAllToStatePublic(TestResultState.Failed, "t", (_, t) => t.item.label !== "root");
      const c2 = makeEmptyCounts();
      c2[TestResultState.Unset] = 1;
      c2[TestResultState.Failed] = 3;
      assert.deepStrictEqual(r.counts, c2);
      assert.deepStrictEqual(r.getStateById(new TestId(["ctrlId", "id-a"]).toString())?.ownComputedState, TestResultState.Failed);
      assert.deepStrictEqual(r.getStateById(new TestId(["ctrlId", "id-a"]).toString())?.tasks[0].state, TestResultState.Failed);
      assert.deepStrictEqual(getChangeSummary(), [
        { label: "a", reason: TestResultItemChangeReason.OwnStateChange },
        { label: "root", reason: TestResultItemChangeReason.ComputedStateChange },
        { label: "aa", reason: TestResultItemChangeReason.OwnStateChange },
        { label: "ab", reason: TestResultItemChangeReason.OwnStateChange },
        { label: "a", reason: TestResultItemChangeReason.OwnStateChange },
        { label: "root", reason: TestResultItemChangeReason.ComputedStateChange },
        { label: "aa", reason: TestResultItemChangeReason.OwnStateChange },
        { label: "ab", reason: TestResultItemChangeReason.OwnStateChange }
      ]);
    });
    test("updateState", () => {
      changed.clear();
      const testId = new TestId(["ctrlId", "id-a", "id-aa"]).toString();
      r.updateState(testId, "t", TestResultState.Running);
      const c = makeEmptyCounts();
      c[TestResultState.Running] = 1;
      c[TestResultState.Unset] = 3;
      assert.deepStrictEqual(r.counts, c);
      assert.deepStrictEqual(r.getStateById(testId)?.ownComputedState, TestResultState.Running);
      assert.deepStrictEqual(r.getStateById(tests.root.id)?.computedState, TestResultState.Running);
      assert.deepStrictEqual(getChangeSummary(), [
        { label: "aa", reason: TestResultItemChangeReason.OwnStateChange },
        { label: "a", reason: TestResultItemChangeReason.ComputedStateChange },
        { label: "root", reason: TestResultItemChangeReason.ComputedStateChange }
      ]);
      r.updateState(testId, "t", TestResultState.Passed);
      assert.deepStrictEqual(r.getStateById(testId)?.ownComputedState, TestResultState.Passed);
      r.updateState(testId, "t", TestResultState.Errored);
      assert.deepStrictEqual(r.getStateById(testId)?.ownComputedState, TestResultState.Errored);
      r.updateState(testId, "t", TestResultState.Passed);
      assert.deepStrictEqual(r.getStateById(testId)?.ownComputedState, TestResultState.Errored);
    });
    test("ignores outside run", () => {
      changed.clear();
      r.updateState(new TestId(["ctrlId", "id-b"]).toString(), "t", TestResultState.Running);
      const c = makeEmptyCounts();
      c[TestResultState.Unset] = 4;
      assert.deepStrictEqual(r.counts, c);
      assert.deepStrictEqual(r.getStateById(new TestId(["ctrlId", "id-b"]).toString()), void 0);
    });
    test("markComplete", () => {
      r.setAllToStatePublic(TestResultState.Queued, "t", () => true);
      r.updateState(new TestId(["ctrlId", "id-a", "id-aa"]).toString(), "t", TestResultState.Passed);
      changed.clear();
      r.markComplete();
      const c = makeEmptyCounts();
      c[TestResultState.Unset] = 3;
      c[TestResultState.Passed] = 1;
      assert.deepStrictEqual(r.counts, c);
      assert.deepStrictEqual(r.getStateById(tests.root.id)?.ownComputedState, TestResultState.Unset);
      assert.deepStrictEqual(r.getStateById(new TestId(["ctrlId", "id-a", "id-aa"]).toString())?.ownComputedState, TestResultState.Passed);
    });
  });
  suite("service", () => {
    let storage;
    let results;
    class TestTestResultService extends TestResultService {
      constructor() {
        super(...arguments);
        this.persistScheduler = { schedule: () => this.persistImmediately() };
      }
    }
    setup(() => {
      storage = ds.add(new InMemoryResultStorage({
        asCanonicalUri(uri) {
          return uri;
        }
      }, ds.add(new TestStorageService()), new NullLogService()));
      results = ds.add(new TestTestResultService(
        new MockContextKeyService(),
        storage,
        ds.add(new TestProfileService(new MockContextKeyService(), ds.add(new TestStorageService()))),
        NullTelemetryService
      ));
    });
    test("pushes new result", () => {
      results.push(r);
      assert.deepStrictEqual(results.results, [r]);
    });
    test("serializes and re-hydrates", async () => {
      results.push(r);
      r.updateState(new TestId(["ctrlId", "id-a", "id-aa"]).toString(), "t", TestResultState.Passed, 42);
      r.markComplete();
      await timeout(10);
      results = ds.add(new TestResultService(
        new MockContextKeyService(),
        storage,
        ds.add(new TestProfileService(new MockContextKeyService(), ds.add(new TestStorageService()))),
        NullTelemetryService
      ));
      assert.strictEqual(0, results.results.length);
      await timeout(10);
      assert.strictEqual(1, results.results.length);
      const [rehydrated, actual] = results.getStateById(tests.root.id);
      const expected = { ...r.getStateById(tests.root.id) };
      expected.item.uri = actual.item.uri;
      expected.item.children = void 0;
      expected.retired = true;
      delete expected.children;
      assert.deepStrictEqual(actual, { ...expected });
      assert.deepStrictEqual(rehydrated.counts, r.counts);
      assert.strictEqual(typeof rehydrated.completedAt, "number");
    });
    test("clears results but keeps ongoing tests", async () => {
      results.push(r);
      r.markComplete();
      const r2 = results.push(new LiveTestResult(
        "",
        false,
        defaultOpts([]),
        insertCounter++,
        NullTelemetryService
      ));
      results.clear();
      assert.deepStrictEqual(results.results, [r2]);
    });
    test("keeps ongoing tests on top, restored order when done", async () => {
      results.push(r);
      const r2 = results.push(new LiveTestResult(
        "",
        false,
        defaultOpts([]),
        insertCounter++,
        NullTelemetryService
      ));
      assert.deepStrictEqual(results.results, [r2, r]);
      r2.markComplete();
      assert.deepStrictEqual(results.results, [r, r2]);
      r.markComplete();
      assert.deepStrictEqual(results.results, [r2, r]);
    });
    const makeHydrated = async (completedAt = 42, state = TestResultState.Passed) => new HydratedTestResult({
      asCanonicalUri(uri) {
        return uri;
      }
    }, {
      completedAt,
      id: "some-id",
      tasks: [{ id: "t", name: void 0, ctrlId: "ctrl", hasCoverage: false }],
      name: "hello world",
      request: defaultOpts([]),
      items: [{
        ...(await getInitializedMainTestCollection()).getNodeById(new TestId(["ctrlId", "id-a"]).toString()),
        tasks: [{ state, duration: 0, messages: [] }],
        computedState: state,
        ownComputedState: state
      }]
    });
    test("pushes hydrated results", async () => {
      results.push(r);
      const hydrated = await makeHydrated();
      results.push(hydrated);
      assert.deepStrictEqual(results.results, [r, hydrated]);
    });
    test("inserts in correct order", async () => {
      results.push(r);
      const hydrated1 = await makeHydrated();
      results.push(hydrated1);
      assert.deepStrictEqual(results.results, [r, hydrated1]);
    });
    test("inserts in correct order 2", async () => {
      results.push(r);
      const hydrated1 = await makeHydrated();
      results.push(hydrated1);
      const hydrated2 = await makeHydrated(30);
      results.push(hydrated2);
      assert.deepStrictEqual(results.results, [r, hydrated1, hydrated2]);
    });
  });
  test("resultItemParents", function() {
    assert.deepStrictEqual([...resultItemParents(r, r.getStateById(new TestId(["ctrlId", "id-a", "id-aa"]).toString()))], [
      r.getStateById(new TestId(["ctrlId", "id-a", "id-aa"]).toString()),
      r.getStateById(new TestId(["ctrlId", "id-a"]).toString()),
      r.getStateById(new TestId(["ctrlId"]).toString())
    ]);
    assert.deepStrictEqual([...resultItemParents(r, r.getStateById(tests.root.id))], [
      r.getStateById(tests.root.id)
    ]);
  });
  suite("output controller", () => {
    test("reads live output ranges", async () => {
      const ctrl = new TaskRawOutput();
      ctrl.append(VSBuffer.fromString("12345"));
      ctrl.append(VSBuffer.fromString("67890"));
      ctrl.append(VSBuffer.fromString("12345"));
      ctrl.append(VSBuffer.fromString("67890"));
      assert.deepStrictEqual(ctrl.getRange(0, 5), VSBuffer.fromString("12345"));
      assert.deepStrictEqual(ctrl.getRange(5, 5), VSBuffer.fromString("67890"));
      assert.deepStrictEqual(ctrl.getRange(7, 6), VSBuffer.fromString("890123"));
      assert.deepStrictEqual(ctrl.getRange(15, 5), VSBuffer.fromString("67890"));
      assert.deepStrictEqual(ctrl.getRange(15, 10), VSBuffer.fromString("67890"));
    });
    test("corrects offsets for marked ranges", async () => {
      const ctrl = new TaskRawOutput();
      const a1 = ctrl.append(VSBuffer.fromString("12345"), 1);
      const a2 = ctrl.append(VSBuffer.fromString("67890"), 1234);
      const a3 = ctrl.append(VSBuffer.fromString("with new line\r\n"), 4);
      assert.deepStrictEqual(ctrl.getRange(a1.offset, a1.length), VSBuffer.fromString("\x1B]633;SetMark;Id=s1;Hidden\x0712345\x1B]633;SetMark;Id=e1;Hidden\x07"));
      assert.deepStrictEqual(ctrl.getRange(a2.offset, a2.length), VSBuffer.fromString("\x1B]633;SetMark;Id=s1234;Hidden\x0767890\x1B]633;SetMark;Id=e1234;Hidden\x07"));
      assert.deepStrictEqual(ctrl.getRange(a3.offset, a3.length), VSBuffer.fromString("\x1B]633;SetMark;Id=s4;Hidden\x07with new line\x1B]633;SetMark;Id=e4;Hidden\x07\r\n"));
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL3Rlc3QvY29tbW9uL3Rlc3RSZXN1bHRTZXJ2aWNlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBNb2NrQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL3Rlc3QvY29tbW9uL21vY2tLZXliaW5kaW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IE51bGxUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnlVdGlscy5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IFRlc3RJZCB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXN0SWQuanMnO1xuaW1wb3J0IHsgVGVzdFByb2ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3Rlc3RQcm9maWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBIeWRyYXRlZFRlc3RSZXN1bHQsIExpdmVUZXN0UmVzdWx0LCBUYXNrUmF3T3V0cHV0LCBUZXN0UmVzdWx0SXRlbUNoYW5nZSwgVGVzdFJlc3VsdEl0ZW1DaGFuZ2VSZWFzb24sIHJlc3VsdEl0ZW1QYXJlbnRzIH0gZnJvbSAnLi4vLi4vY29tbW9uL3Rlc3RSZXN1bHQuanMnO1xuaW1wb3J0IHsgVGVzdFJlc3VsdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vdGVzdFJlc3VsdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRlc3RSZXN1bHRTdG9yYWdlLCBJbk1lbW9yeVJlc3VsdFN0b3JhZ2UgfSBmcm9tICcuLi8uLi9jb21tb24vdGVzdFJlc3VsdFN0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVRlc3RUYXNrU3RhdGUsIFJlc29sdmVkVGVzdFJ1blJlcXVlc3QsIFRlc3RSZXN1bHRJdGVtLCBUZXN0UmVzdWx0U3RhdGUsIFRlc3RSdW5Qcm9maWxlQml0c2V0IH0gZnJvbSAnLi4vLi4vY29tbW9uL3Rlc3RUeXBlcy5qcyc7XG5pbXBvcnQgeyBtYWtlRW1wdHlDb3VudHMgfSBmcm9tICcuLi8uLi9jb21tb24vdGVzdGluZ1N0YXRlcy5qcyc7XG5pbXBvcnQgeyBUZXN0VGVzdENvbGxlY3Rpb24sIGdldEluaXRpYWxpemVkTWFpblRlc3RDb2xsZWN0aW9uLCB0ZXN0U3R1YnMgfSBmcm9tICcuL3Rlc3RTdHVicy5qcyc7XG5pbXBvcnQgeyBUZXN0U3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuXG5zdWl0ZSgnV29ya2JlbmNoIC0gVGVzdCBSZXN1bHRzIFNlcnZpY2UnLCAoKSA9PiB7XG5cdGNvbnN0IGdldExhYmVsc0luID0gKGl0OiBJdGVyYWJsZTxUZXN0UmVzdWx0SXRlbT4pID0+IFsuLi5pdF0ubWFwKHQgPT4gdC5pdGVtLmxhYmVsKS5zb3J0KCk7XG5cdGNvbnN0IGdldENoYW5nZVN1bW1hcnkgPSAoKSA9PiBbLi4uY2hhbmdlZF1cblx0XHQubWFwKGMgPT4gKHsgcmVhc29uOiBjLnJlYXNvbiwgbGFiZWw6IGMuaXRlbS5pdGVtLmxhYmVsIH0pKTtcblxuXHRsZXQgcjogVGVzdExpdmVUZXN0UmVzdWx0O1xuXHRsZXQgY2hhbmdlZCA9IG5ldyBTZXQ8VGVzdFJlc3VsdEl0ZW1DaGFuZ2U+KCk7XG5cdGxldCB0ZXN0czogVGVzdFRlc3RDb2xsZWN0aW9uO1xuXG5cdGNvbnN0IGRlZmF1bHRPcHRzID0gKHRlc3RJZHM6IHN0cmluZ1tdKTogUmVzb2x2ZWRUZXN0UnVuUmVxdWVzdCA9PiAoe1xuXHRcdGdyb3VwOiBUZXN0UnVuUHJvZmlsZUJpdHNldC5SdW4sXG5cdFx0dGFyZ2V0czogW3tcblx0XHRcdHByb2ZpbGVJZDogMCxcblx0XHRcdGNvbnRyb2xsZXJJZDogJ2N0cmxJZCcsXG5cdFx0XHR0ZXN0SWRzLFxuXHRcdH1dXG5cdH0pO1xuXG5cdGxldCBpbnNlcnRDb3VudGVyID0gMDtcblxuXHRjbGFzcyBUZXN0TGl2ZVRlc3RSZXN1bHQgZXh0ZW5kcyBMaXZlVGVzdFJlc3VsdCB7XG5cdFx0Y29uc3RydWN0b3IoXG5cdFx0XHRpZDogc3RyaW5nLFxuXHRcdFx0cGVyc2lzdDogYm9vbGVhbixcblx0XHRcdHJlcXVlc3Q6IFJlc29sdmVkVGVzdFJ1blJlcXVlc3QsXG5cdFx0KSB7XG5cdFx0XHRzdXBlcihpZCwgcGVyc2lzdCwgcmVxdWVzdCwgaW5zZXJ0Q291bnRlcisrLCBOdWxsVGVsZW1ldHJ5U2VydmljZSk7XG5cdFx0XHRkcy5hZGQodGhpcyk7XG5cdFx0fVxuXG5cdFx0cHVibGljIHNldEFsbFRvU3RhdGVQdWJsaWMoc3RhdGU6IFRlc3RSZXN1bHRTdGF0ZSwgdGFza0lkOiBzdHJpbmcsIHdoZW46ICh0YXNrOiBJVGVzdFRhc2tTdGF0ZSwgaXRlbTogVGVzdFJlc3VsdEl0ZW0pID0+IGJvb2xlYW4pIHtcblx0XHRcdHRoaXMuc2V0QWxsVG9TdGF0ZShzdGF0ZSwgdGFza0lkLCB3aGVuKTtcblx0XHR9XG5cdH1cblxuXHRjb25zdCBkcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHNldHVwKGFzeW5jICgpID0+IHtcblx0XHRjaGFuZ2VkID0gbmV3IFNldCgpO1xuXHRcdHIgPSBkcy5hZGQobmV3IFRlc3RMaXZlVGVzdFJlc3VsdChcblx0XHRcdCdmb28nLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdGRlZmF1bHRPcHRzKFsnaWQtYSddKSxcblx0XHQpKTtcblxuXHRcdGRzLmFkZChyLm9uQ2hhbmdlKGUgPT4gY2hhbmdlZC5hZGQoZSkpKTtcblx0XHRyLmFkZFRhc2soeyBpZDogJ3QnLCBuYW1lOiAnbicsIHJ1bm5pbmc6IHRydWUsIGN0cmxJZDogJ2N0cmwnIH0pO1xuXG5cdFx0dGVzdHMgPSBkcy5hZGQodGVzdFN0dWJzLm5lc3RlZCgpKTtcblx0XHRjb25zdCBjdHMgPSBkcy5hZGQobmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCkpO1xuXHRcdGNvbnN0IG9rID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdFByb21pc2UucmVzb2x2ZSh0ZXN0cy5leHBhbmQodGVzdHMucm9vdC5pZCwgSW5maW5pdHkpKS50aGVuKCgpID0+IHRydWUpLFxuXHRcdFx0dGltZW91dCgxMDAwLCBjdHMudG9rZW4pLnRoZW4oKCkgPT4gZmFsc2UpLFxuXHRcdF0pO1xuXHRcdGN0cy5jYW5jZWwoKTtcblxuXHRcdC8vIHRvZG9AY29ubm9yNDMxMjogZGVidWcgZm9yIHRlc3RzICMxMzc4NTM6XG5cdFx0aWYgKCFvaykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCd0aW1lZCBvdXQgd2hpbGUgZXhwYW5kaW5nLCBkaWZmOiAnICsgSlNPTi5zdHJpbmdpZnkodGVzdHMuY29sbGVjdERpZmYoKSkpO1xuXHRcdH1cblxuXHRcdHIuYWRkVGVzdENoYWluVG9SdW4oJ2N0cmxJZCcsIFtcblx0XHRcdHRlc3RzLnJvb3QudG9UZXN0SXRlbSgpLFxuXHRcdFx0dGVzdHMucm9vdC5jaGlsZHJlbi5nZXQoJ2lkLWEnKSEudG9UZXN0SXRlbSgpLFxuXHRcdFx0dGVzdHMucm9vdC5jaGlsZHJlbi5nZXQoJ2lkLWEnKSEuY2hpbGRyZW4uZ2V0KCdpZC1hYScpIS50b1Rlc3RJdGVtKCksXG5cdFx0XSk7XG5cblx0XHRyLmFkZFRlc3RDaGFpblRvUnVuKCdjdHJsSWQnLCBbXG5cdFx0XHR0ZXN0cy5yb290LmNoaWxkcmVuLmdldCgnaWQtYScpIS50b1Rlc3RJdGVtKCksXG5cdFx0XHR0ZXN0cy5yb290LmNoaWxkcmVuLmdldCgnaWQtYScpIS5jaGlsZHJlbi5nZXQoJ2lkLWFiJykhLnRvVGVzdEl0ZW0oKSxcblx0XHRdKTtcblx0fSk7XG5cblx0Ly8gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7IHRvZG9AY29ubm9yNDMxMlxuXG5cdHN1aXRlKCdMaXZlVGVzdFJlc3VsdCcsICgpID0+IHtcblx0XHR0ZXN0KCdpcyBlbXB0eSBpZiBubyB0ZXN0cyBhcmUgeWV0IHByZXNlbnQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldExhYmVsc0luKG5ldyBUZXN0TGl2ZVRlc3RSZXN1bHQoXG5cdFx0XHRcdCdmb28nLFxuXHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0ZGVmYXVsdE9wdHMoWydpZC1hJ10pLFxuXHRcdFx0KS50ZXN0cyksIFtdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2luaXRpYWxseSBxdWV1ZXMgbm90aGluZycsICgpID0+IHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0Q2hhbmdlU3VtbWFyeSgpLCBbXSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdpbml0aWFsaXplcyB3aXRoIHRoZSBzdWJ0cmVlIG9mIHJlcXVlc3RlZCB0ZXN0cycsICgpID0+IHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0TGFiZWxzSW4oci50ZXN0cyksIFsnYScsICdhYScsICdhYicsICdyb290J10pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnaW5pdGlhbGl6ZXMgd2l0aCB2YWxpZCBjb3VudHMnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBjID0gbWFrZUVtcHR5Q291bnRzKCk7XG5cdFx0XHRjW1Rlc3RSZXN1bHRTdGF0ZS5VbnNldF0gPSA0O1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyLmNvdW50cywgYyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzZXRBbGxUb1N0YXRlJywgKCkgPT4ge1xuXHRcdFx0Y2hhbmdlZC5jbGVhcigpO1xuXHRcdFx0ci5zZXRBbGxUb1N0YXRlUHVibGljKFRlc3RSZXN1bHRTdGF0ZS5RdWV1ZWQsICd0JywgKF8sIHQpID0+IHQuaXRlbS5sYWJlbCAhPT0gJ3Jvb3QnKTtcblx0XHRcdGNvbnN0IGMgPSBtYWtlRW1wdHlDb3VudHMoKTtcblx0XHRcdGNbVGVzdFJlc3VsdFN0YXRlLlVuc2V0XSA9IDE7XG5cdFx0XHRjW1Rlc3RSZXN1bHRTdGF0ZS5RdWV1ZWRdID0gMztcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoci5jb3VudHMsIGMpO1xuXG5cdFx0XHRyLnNldEFsbFRvU3RhdGVQdWJsaWMoVGVzdFJlc3VsdFN0YXRlLkZhaWxlZCwgJ3QnLCAoXywgdCkgPT4gdC5pdGVtLmxhYmVsICE9PSAncm9vdCcpO1xuXHRcdFx0Y29uc3QgYzIgPSBtYWtlRW1wdHlDb3VudHMoKTtcblx0XHRcdGMyW1Rlc3RSZXN1bHRTdGF0ZS5VbnNldF0gPSAxO1xuXHRcdFx0YzJbVGVzdFJlc3VsdFN0YXRlLkZhaWxlZF0gPSAzO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyLmNvdW50cywgYzIpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHIuZ2V0U3RhdGVCeUlkKG5ldyBUZXN0SWQoWydjdHJsSWQnLCAnaWQtYSddKS50b1N0cmluZygpKT8ub3duQ29tcHV0ZWRTdGF0ZSwgVGVzdFJlc3VsdFN0YXRlLkZhaWxlZCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHIuZ2V0U3RhdGVCeUlkKG5ldyBUZXN0SWQoWydjdHJsSWQnLCAnaWQtYSddKS50b1N0cmluZygpKT8udGFza3NbMF0uc3RhdGUsIFRlc3RSZXN1bHRTdGF0ZS5GYWlsZWQpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRDaGFuZ2VTdW1tYXJ5KCksIFtcblx0XHRcdFx0eyBsYWJlbDogJ2EnLCByZWFzb246IFRlc3RSZXN1bHRJdGVtQ2hhbmdlUmVhc29uLk93blN0YXRlQ2hhbmdlIH0sXG5cdFx0XHRcdHsgbGFiZWw6ICdyb290JywgcmVhc29uOiBUZXN0UmVzdWx0SXRlbUNoYW5nZVJlYXNvbi5Db21wdXRlZFN0YXRlQ2hhbmdlIH0sXG5cdFx0XHRcdHsgbGFiZWw6ICdhYScsIHJlYXNvbjogVGVzdFJlc3VsdEl0ZW1DaGFuZ2VSZWFzb24uT3duU3RhdGVDaGFuZ2UgfSxcblx0XHRcdFx0eyBsYWJlbDogJ2FiJywgcmVhc29uOiBUZXN0UmVzdWx0SXRlbUNoYW5nZVJlYXNvbi5Pd25TdGF0ZUNoYW5nZSB9LFxuXG5cdFx0XHRcdHsgbGFiZWw6ICdhJywgcmVhc29uOiBUZXN0UmVzdWx0SXRlbUNoYW5nZVJlYXNvbi5Pd25TdGF0ZUNoYW5nZSB9LFxuXHRcdFx0XHR7IGxhYmVsOiAncm9vdCcsIHJlYXNvbjogVGVzdFJlc3VsdEl0ZW1DaGFuZ2VSZWFzb24uQ29tcHV0ZWRTdGF0ZUNoYW5nZSB9LFxuXHRcdFx0XHR7IGxhYmVsOiAnYWEnLCByZWFzb246IFRlc3RSZXN1bHRJdGVtQ2hhbmdlUmVhc29uLk93blN0YXRlQ2hhbmdlIH0sXG5cdFx0XHRcdHsgbGFiZWw6ICdhYicsIHJlYXNvbjogVGVzdFJlc3VsdEl0ZW1DaGFuZ2VSZWFzb24uT3duU3RhdGVDaGFuZ2UgfSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgndXBkYXRlU3RhdGUnLCAoKSA9PiB7XG5cdFx0XHRjaGFuZ2VkLmNsZWFyKCk7XG5cdFx0XHRjb25zdCB0ZXN0SWQgPSBuZXcgVGVzdElkKFsnY3RybElkJywgJ2lkLWEnLCAnaWQtYWEnXSkudG9TdHJpbmcoKTtcblx0XHRcdHIudXBkYXRlU3RhdGUodGVzdElkLCAndCcsIFRlc3RSZXN1bHRTdGF0ZS5SdW5uaW5nKTtcblx0XHRcdGNvbnN0IGMgPSBtYWtlRW1wdHlDb3VudHMoKTtcblx0XHRcdGNbVGVzdFJlc3VsdFN0YXRlLlJ1bm5pbmddID0gMTtcblx0XHRcdGNbVGVzdFJlc3VsdFN0YXRlLlVuc2V0XSA9IDM7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHIuY291bnRzLCBjKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoci5nZXRTdGF0ZUJ5SWQodGVzdElkKT8ub3duQ29tcHV0ZWRTdGF0ZSwgVGVzdFJlc3VsdFN0YXRlLlJ1bm5pbmcpO1xuXHRcdFx0Ly8gdXBkYXRlIGNvbXB1dGVkIHN0YXRlOlxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyLmdldFN0YXRlQnlJZCh0ZXN0cy5yb290LmlkKT8uY29tcHV0ZWRTdGF0ZSwgVGVzdFJlc3VsdFN0YXRlLlJ1bm5pbmcpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRDaGFuZ2VTdW1tYXJ5KCksIFtcblx0XHRcdFx0eyBsYWJlbDogJ2FhJywgcmVhc29uOiBUZXN0UmVzdWx0SXRlbUNoYW5nZVJlYXNvbi5Pd25TdGF0ZUNoYW5nZSB9LFxuXHRcdFx0XHR7IGxhYmVsOiAnYScsIHJlYXNvbjogVGVzdFJlc3VsdEl0ZW1DaGFuZ2VSZWFzb24uQ29tcHV0ZWRTdGF0ZUNoYW5nZSB9LFxuXHRcdFx0XHR7IGxhYmVsOiAncm9vdCcsIHJlYXNvbjogVGVzdFJlc3VsdEl0ZW1DaGFuZ2VSZWFzb24uQ29tcHV0ZWRTdGF0ZUNoYW5nZSB9LFxuXHRcdFx0XSk7XG5cblx0XHRcdHIudXBkYXRlU3RhdGUodGVzdElkLCAndCcsIFRlc3RSZXN1bHRTdGF0ZS5QYXNzZWQpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyLmdldFN0YXRlQnlJZCh0ZXN0SWQpPy5vd25Db21wdXRlZFN0YXRlLCBUZXN0UmVzdWx0U3RhdGUuUGFzc2VkKTtcblxuXHRcdFx0ci51cGRhdGVTdGF0ZSh0ZXN0SWQsICd0JywgVGVzdFJlc3VsdFN0YXRlLkVycm9yZWQpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyLmdldFN0YXRlQnlJZCh0ZXN0SWQpPy5vd25Db21wdXRlZFN0YXRlLCBUZXN0UmVzdWx0U3RhdGUuRXJyb3JlZCk7XG5cblx0XHRcdHIudXBkYXRlU3RhdGUodGVzdElkLCAndCcsIFRlc3RSZXN1bHRTdGF0ZS5QYXNzZWQpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyLmdldFN0YXRlQnlJZCh0ZXN0SWQpPy5vd25Db21wdXRlZFN0YXRlLCBUZXN0UmVzdWx0U3RhdGUuRXJyb3JlZCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdpZ25vcmVzIG91dHNpZGUgcnVuJywgKCkgPT4ge1xuXHRcdFx0Y2hhbmdlZC5jbGVhcigpO1xuXHRcdFx0ci51cGRhdGVTdGF0ZShuZXcgVGVzdElkKFsnY3RybElkJywgJ2lkLWInXSkudG9TdHJpbmcoKSwgJ3QnLCBUZXN0UmVzdWx0U3RhdGUuUnVubmluZyk7XG5cdFx0XHRjb25zdCBjID0gbWFrZUVtcHR5Q291bnRzKCk7XG5cdFx0XHRjW1Rlc3RSZXN1bHRTdGF0ZS5VbnNldF0gPSA0O1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyLmNvdW50cywgYyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHIuZ2V0U3RhdGVCeUlkKG5ldyBUZXN0SWQoWydjdHJsSWQnLCAnaWQtYiddKS50b1N0cmluZygpKSwgdW5kZWZpbmVkKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ21hcmtDb21wbGV0ZScsICgpID0+IHtcblx0XHRcdHIuc2V0QWxsVG9TdGF0ZVB1YmxpYyhUZXN0UmVzdWx0U3RhdGUuUXVldWVkLCAndCcsICgpID0+IHRydWUpO1xuXHRcdFx0ci51cGRhdGVTdGF0ZShuZXcgVGVzdElkKFsnY3RybElkJywgJ2lkLWEnLCAnaWQtYWEnXSkudG9TdHJpbmcoKSwgJ3QnLCBUZXN0UmVzdWx0U3RhdGUuUGFzc2VkKTtcblx0XHRcdGNoYW5nZWQuY2xlYXIoKTtcblxuXHRcdFx0ci5tYXJrQ29tcGxldGUoKTtcblxuXHRcdFx0Y29uc3QgYyA9IG1ha2VFbXB0eUNvdW50cygpO1xuXHRcdFx0Y1tUZXN0UmVzdWx0U3RhdGUuVW5zZXRdID0gMztcblx0XHRcdGNbVGVzdFJlc3VsdFN0YXRlLlBhc3NlZF0gPSAxO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyLmNvdW50cywgYyk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoci5nZXRTdGF0ZUJ5SWQodGVzdHMucm9vdC5pZCk/Lm93bkNvbXB1dGVkU3RhdGUsIFRlc3RSZXN1bHRTdGF0ZS5VbnNldCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHIuZ2V0U3RhdGVCeUlkKG5ldyBUZXN0SWQoWydjdHJsSWQnLCAnaWQtYScsICdpZC1hYSddKS50b1N0cmluZygpKT8ub3duQ29tcHV0ZWRTdGF0ZSwgVGVzdFJlc3VsdFN0YXRlLlBhc3NlZCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdzZXJ2aWNlJywgKCkgPT4ge1xuXHRcdGxldCBzdG9yYWdlOiBJVGVzdFJlc3VsdFN0b3JhZ2U7XG5cdFx0bGV0IHJlc3VsdHM6IFRlc3RSZXN1bHRTZXJ2aWNlO1xuXG5cdFx0Y2xhc3MgVGVzdFRlc3RSZXN1bHRTZXJ2aWNlIGV4dGVuZHMgVGVzdFJlc3VsdFNlcnZpY2Uge1xuXHRcdFx0cHJvdGVjdGVkIG92ZXJyaWRlIHBlcnNpc3RTY2hlZHVsZXIgPSB7IHNjaGVkdWxlOiAoKSA9PiB0aGlzLnBlcnNpc3RJbW1lZGlhdGVseSgpIH0gYXMgYW55O1xuXHRcdH1cblxuXHRcdHNldHVwKCgpID0+IHtcblx0XHRcdHN0b3JhZ2UgPSBkcy5hZGQobmV3IEluTWVtb3J5UmVzdWx0U3RvcmFnZSh7XG5cdFx0XHRcdGFzQ2Fub25pY2FsVXJpKHVyaSkge1xuXHRcdFx0XHRcdHJldHVybiB1cmk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9IGFzIElVcmlJZGVudGl0eVNlcnZpY2UsIGRzLmFkZChuZXcgVGVzdFN0b3JhZ2VTZXJ2aWNlKCkpLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSkpO1xuXHRcdFx0cmVzdWx0cyA9IGRzLmFkZChuZXcgVGVzdFRlc3RSZXN1bHRTZXJ2aWNlKFxuXHRcdFx0XHRuZXcgTW9ja0NvbnRleHRLZXlTZXJ2aWNlKCksXG5cdFx0XHRcdHN0b3JhZ2UsXG5cdFx0XHRcdGRzLmFkZChuZXcgVGVzdFByb2ZpbGVTZXJ2aWNlKG5ldyBNb2NrQ29udGV4dEtleVNlcnZpY2UoKSwgZHMuYWRkKG5ldyBUZXN0U3RvcmFnZVNlcnZpY2UoKSkpKSxcblx0XHRcdFx0TnVsbFRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0XHQpKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3B1c2hlcyBuZXcgcmVzdWx0JywgKCkgPT4ge1xuXHRcdFx0cmVzdWx0cy5wdXNoKHIpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHRzLnJlc3VsdHMsIFtyXSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzZXJpYWxpemVzIGFuZCByZS1oeWRyYXRlcycsIGFzeW5jICgpID0+IHtcblx0XHRcdHJlc3VsdHMucHVzaChyKTtcblx0XHRcdHIudXBkYXRlU3RhdGUobmV3IFRlc3RJZChbJ2N0cmxJZCcsICdpZC1hJywgJ2lkLWFhJ10pLnRvU3RyaW5nKCksICd0JywgVGVzdFJlc3VsdFN0YXRlLlBhc3NlZCwgNDIpO1xuXHRcdFx0ci5tYXJrQ29tcGxldGUoKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMTApOyAvLyBhbGxvdyBwZXJzaXN0SW1tZWRpYXRlbHkgYXN5bmMgdG8gaGFwcGVuXG5cblx0XHRcdHJlc3VsdHMgPSBkcy5hZGQobmV3IFRlc3RSZXN1bHRTZXJ2aWNlKFxuXHRcdFx0XHRuZXcgTW9ja0NvbnRleHRLZXlTZXJ2aWNlKCksXG5cdFx0XHRcdHN0b3JhZ2UsXG5cdFx0XHRcdGRzLmFkZChuZXcgVGVzdFByb2ZpbGVTZXJ2aWNlKG5ldyBNb2NrQ29udGV4dEtleVNlcnZpY2UoKSwgZHMuYWRkKG5ldyBUZXN0U3RvcmFnZVNlcnZpY2UoKSkpKSxcblx0XHRcdFx0TnVsbFRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0XHQpKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDAsIHJlc3VsdHMucmVzdWx0cy5sZW5ndGgpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgxMCk7IC8vIGFsbG93IGxvYWQgcHJvbWlzZSB0byByZXNvbHZlXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMSwgcmVzdWx0cy5yZXN1bHRzLmxlbmd0aCk7XG5cblx0XHRcdGNvbnN0IFtyZWh5ZHJhdGVkLCBhY3R1YWxdID0gcmVzdWx0cy5nZXRTdGF0ZUJ5SWQodGVzdHMucm9vdC5pZCkhO1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWQ6IGFueSA9IHsgLi4uci5nZXRTdGF0ZUJ5SWQodGVzdHMucm9vdC5pZCkhIH07XG5cdFx0XHRleHBlY3RlZC5pdGVtLnVyaSA9IGFjdHVhbC5pdGVtLnVyaTtcblx0XHRcdGV4cGVjdGVkLml0ZW0uY2hpbGRyZW4gPSB1bmRlZmluZWQ7XG5cdFx0XHRleHBlY3RlZC5yZXRpcmVkID0gdHJ1ZTtcblx0XHRcdGRlbGV0ZSBleHBlY3RlZC5jaGlsZHJlbjtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCB7IC4uLmV4cGVjdGVkIH0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWh5ZHJhdGVkLmNvdW50cywgci5jb3VudHMpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiByZWh5ZHJhdGVkLmNvbXBsZXRlZEF0LCAnbnVtYmVyJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdjbGVhcnMgcmVzdWx0cyBidXQga2VlcHMgb25nb2luZyB0ZXN0cycsIGFzeW5jICgpID0+IHtcblx0XHRcdHJlc3VsdHMucHVzaChyKTtcblx0XHRcdHIubWFya0NvbXBsZXRlKCk7XG5cblx0XHRcdGNvbnN0IHIyID0gcmVzdWx0cy5wdXNoKG5ldyBMaXZlVGVzdFJlc3VsdChcblx0XHRcdFx0JycsXG5cdFx0XHRcdGZhbHNlLFxuXHRcdFx0XHRkZWZhdWx0T3B0cyhbXSksXG5cdFx0XHRcdGluc2VydENvdW50ZXIrKyxcblx0XHRcdFx0TnVsbFRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0XHQpKTtcblx0XHRcdHJlc3VsdHMuY2xlYXIoKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHRzLnJlc3VsdHMsIFtyMl0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgna2VlcHMgb25nb2luZyB0ZXN0cyBvbiB0b3AsIHJlc3RvcmVkIG9yZGVyIHdoZW4gZG9uZScsIGFzeW5jICgpID0+IHtcblx0XHRcdHJlc3VsdHMucHVzaChyKTtcblx0XHRcdGNvbnN0IHIyID0gcmVzdWx0cy5wdXNoKG5ldyBMaXZlVGVzdFJlc3VsdChcblx0XHRcdFx0JycsXG5cdFx0XHRcdGZhbHNlLFxuXHRcdFx0XHRkZWZhdWx0T3B0cyhbXSksXG5cdFx0XHRcdGluc2VydENvdW50ZXIrKyxcblx0XHRcdFx0TnVsbFRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0XHQpKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHRzLnJlc3VsdHMsIFtyMiwgcl0pO1xuXHRcdFx0cjIubWFya0NvbXBsZXRlKCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdHMucmVzdWx0cywgW3IsIHIyXSk7XG5cdFx0XHRyLm1hcmtDb21wbGV0ZSgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHRzLnJlc3VsdHMsIFtyMiwgcl0pO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgbWFrZUh5ZHJhdGVkID0gYXN5bmMgKGNvbXBsZXRlZEF0ID0gNDIsIHN0YXRlID0gVGVzdFJlc3VsdFN0YXRlLlBhc3NlZCkgPT4gbmV3IEh5ZHJhdGVkVGVzdFJlc3VsdCh7XG5cdFx0XHRhc0Nhbm9uaWNhbFVyaSh1cmkpIHtcblx0XHRcdFx0cmV0dXJuIHVyaTtcblx0XHRcdH0sXG5cdFx0fSBhcyBJVXJpSWRlbnRpdHlTZXJ2aWNlLCB7XG5cdFx0XHRjb21wbGV0ZWRBdCxcblx0XHRcdGlkOiAnc29tZS1pZCcsXG5cdFx0XHR0YXNrczogW3sgaWQ6ICd0JywgbmFtZTogdW5kZWZpbmVkLCBjdHJsSWQ6ICdjdHJsJywgaGFzQ292ZXJhZ2U6IGZhbHNlIH1dLFxuXHRcdFx0bmFtZTogJ2hlbGxvIHdvcmxkJyxcblx0XHRcdHJlcXVlc3Q6IGRlZmF1bHRPcHRzKFtdKSxcblx0XHRcdGl0ZW1zOiBbe1xuXHRcdFx0XHQuLi4oYXdhaXQgZ2V0SW5pdGlhbGl6ZWRNYWluVGVzdENvbGxlY3Rpb24oKSkuZ2V0Tm9kZUJ5SWQobmV3IFRlc3RJZChbJ2N0cmxJZCcsICdpZC1hJ10pLnRvU3RyaW5nKCkpISxcblx0XHRcdFx0dGFza3M6IFt7IHN0YXRlLCBkdXJhdGlvbjogMCwgbWVzc2FnZXM6IFtdIH1dLFxuXHRcdFx0XHRjb21wdXRlZFN0YXRlOiBzdGF0ZSxcblx0XHRcdFx0b3duQ29tcHV0ZWRTdGF0ZTogc3RhdGUsXG5cdFx0XHR9XVxuXHRcdH0pO1xuXG5cdFx0dGVzdCgncHVzaGVzIGh5ZHJhdGVkIHJlc3VsdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRyZXN1bHRzLnB1c2gocik7XG5cdFx0XHRjb25zdCBoeWRyYXRlZCA9IGF3YWl0IG1ha2VIeWRyYXRlZCgpO1xuXHRcdFx0cmVzdWx0cy5wdXNoKGh5ZHJhdGVkKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0cy5yZXN1bHRzLCBbciwgaHlkcmF0ZWRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2luc2VydHMgaW4gY29ycmVjdCBvcmRlcicsIGFzeW5jICgpID0+IHtcblx0XHRcdHJlc3VsdHMucHVzaChyKTtcblx0XHRcdGNvbnN0IGh5ZHJhdGVkMSA9IGF3YWl0IG1ha2VIeWRyYXRlZCgpO1xuXHRcdFx0cmVzdWx0cy5wdXNoKGh5ZHJhdGVkMSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc3VsdHMucmVzdWx0cywgW3IsIGh5ZHJhdGVkMV0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnaW5zZXJ0cyBpbiBjb3JyZWN0IG9yZGVyIDInLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRyZXN1bHRzLnB1c2gocik7XG5cdFx0XHRjb25zdCBoeWRyYXRlZDEgPSBhd2FpdCBtYWtlSHlkcmF0ZWQoKTtcblx0XHRcdHJlc3VsdHMucHVzaChoeWRyYXRlZDEpO1xuXHRcdFx0Y29uc3QgaHlkcmF0ZWQyID0gYXdhaXQgbWFrZUh5ZHJhdGVkKDMwKTtcblx0XHRcdHJlc3VsdHMucHVzaChoeWRyYXRlZDIpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHRzLnJlc3VsdHMsIFtyLCBoeWRyYXRlZDEsIGh5ZHJhdGVkMl0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXN1bHRJdGVtUGFyZW50cycsIGZ1bmN0aW9uICgpIHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFsuLi5yZXN1bHRJdGVtUGFyZW50cyhyLCByLmdldFN0YXRlQnlJZChuZXcgVGVzdElkKFsnY3RybElkJywgJ2lkLWEnLCAnaWQtYWEnXSkudG9TdHJpbmcoKSkhKV0sIFtcblx0XHRcdHIuZ2V0U3RhdGVCeUlkKG5ldyBUZXN0SWQoWydjdHJsSWQnLCAnaWQtYScsICdpZC1hYSddKS50b1N0cmluZygpKSxcblx0XHRcdHIuZ2V0U3RhdGVCeUlkKG5ldyBUZXN0SWQoWydjdHJsSWQnLCAnaWQtYSddKS50b1N0cmluZygpKSxcblx0XHRcdHIuZ2V0U3RhdGVCeUlkKG5ldyBUZXN0SWQoWydjdHJsSWQnXSkudG9TdHJpbmcoKSksXG5cdFx0XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFsuLi5yZXN1bHRJdGVtUGFyZW50cyhyLCByLmdldFN0YXRlQnlJZCh0ZXN0cy5yb290LmlkKSEpXSwgW1xuXHRcdFx0ci5nZXRTdGF0ZUJ5SWQodGVzdHMucm9vdC5pZCksXG5cdFx0XSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdvdXRwdXQgY29udHJvbGxlcicsICgpID0+IHtcblx0XHR0ZXN0KCdyZWFkcyBsaXZlIG91dHB1dCByYW5nZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBjdHJsID0gbmV3IFRhc2tSYXdPdXRwdXQoKTtcblxuXHRcdFx0Y3RybC5hcHBlbmQoVlNCdWZmZXIuZnJvbVN0cmluZygnMTIzNDUnKSk7XG5cdFx0XHRjdHJsLmFwcGVuZChWU0J1ZmZlci5mcm9tU3RyaW5nKCc2Nzg5MCcpKTtcblx0XHRcdGN0cmwuYXBwZW5kKFZTQnVmZmVyLmZyb21TdHJpbmcoJzEyMzQ1JykpO1xuXHRcdFx0Y3RybC5hcHBlbmQoVlNCdWZmZXIuZnJvbVN0cmluZygnNjc4OTAnKSk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY3RybC5nZXRSYW5nZSgwLCA1KSwgVlNCdWZmZXIuZnJvbVN0cmluZygnMTIzNDUnKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGN0cmwuZ2V0UmFuZ2UoNSwgNSksIFZTQnVmZmVyLmZyb21TdHJpbmcoJzY3ODkwJykpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjdHJsLmdldFJhbmdlKDcsIDYpLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCc4OTAxMjMnKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGN0cmwuZ2V0UmFuZ2UoMTUsIDUpLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCc2Nzg5MCcpKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY3RybC5nZXRSYW5nZSgxNSwgMTApLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCc2Nzg5MCcpKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2NvcnJlY3RzIG9mZnNldHMgZm9yIG1hcmtlZCByYW5nZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBjdHJsID0gbmV3IFRhc2tSYXdPdXRwdXQoKTtcblxuXHRcdFx0Y29uc3QgYTEgPSBjdHJsLmFwcGVuZChWU0J1ZmZlci5mcm9tU3RyaW5nKCcxMjM0NScpLCAxKTtcblx0XHRcdGNvbnN0IGEyID0gY3RybC5hcHBlbmQoVlNCdWZmZXIuZnJvbVN0cmluZygnNjc4OTAnKSwgMTIzNCk7XG5cdFx0XHRjb25zdCBhMyA9IGN0cmwuYXBwZW5kKFZTQnVmZmVyLmZyb21TdHJpbmcoJ3dpdGggbmV3IGxpbmVcXHJcXG4nKSwgNCk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY3RybC5nZXRSYW5nZShhMS5vZmZzZXQsIGExLmxlbmd0aCksIFZTQnVmZmVyLmZyb21TdHJpbmcoJ1xceDFiXTYzMztTZXRNYXJrO0lkPXMxO0hpZGRlblxceDA3MTIzNDVcXHgxYl02MzM7U2V0TWFyaztJZD1lMTtIaWRkZW5cXHgwNycpKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY3RybC5nZXRSYW5nZShhMi5vZmZzZXQsIGEyLmxlbmd0aCksIFZTQnVmZmVyLmZyb21TdHJpbmcoJ1xceDFiXTYzMztTZXRNYXJrO0lkPXMxMjM0O0hpZGRlblxceDA3Njc4OTBcXHgxYl02MzM7U2V0TWFyaztJZD1lMTIzNDtIaWRkZW5cXHgwNycpKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY3RybC5nZXRSYW5nZShhMy5vZmZzZXQsIGEzLmxlbmd0aCksIFZTQnVmZmVyLmZyb21TdHJpbmcoJ1xceDFiXTYzMztTZXRNYXJrO0lkPXM0O0hpZGRlblxceDA3d2l0aCBuZXcgbGluZVxceDFiXTYzMztTZXRNYXJrO0lkPWU0O0hpZGRlblxceDA3XFxyXFxuJykpO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsZUFBZTtBQUN4QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLCtCQUErQjtBQUN4QyxTQUFTLCtDQUErQztBQUN4RCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDRCQUE0QjtBQUVyQyxTQUFTLGNBQWM7QUFDdkIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxvQkFBb0IsZ0JBQWdCLGVBQXFDLDRCQUE0Qix5QkFBeUI7QUFDdkksU0FBUyx5QkFBeUI7QUFDbEMsU0FBNkIsNkJBQTZCO0FBQzFELFNBQWlFLGlCQUFpQiw0QkFBNEI7QUFDOUcsU0FBUyx1QkFBdUI7QUFDaEMsU0FBNkIsa0NBQWtDLGlCQUFpQjtBQUNoRixTQUFTLDBCQUEwQjtBQUVuQyxNQUFNLG9DQUFvQyxNQUFNO0FBQy9DLFFBQU0sY0FBYyxDQUFDLE9BQWlDLENBQUMsR0FBRyxFQUFFLEVBQUUsSUFBSSxPQUFLLEVBQUUsS0FBSyxLQUFLLEVBQUUsS0FBSztBQUMxRixRQUFNLG1C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
