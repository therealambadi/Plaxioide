import assert from "assert";
import * as sinon from "sinon";
import { timeout } from "../../../../base/common/async.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Event } from "../../../../base/common/event.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { URI } from "../../../../base/common/uri.js";
import { mock, mockObject } from "../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import * as editorRange from "../../../../editor/common/core/range.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { NullLogService } from "../../../../platform/log/common/log.js";
import { ExtHostCommands } from "../../common/extHostCommands.js";
import { ExtHostDocumentsAndEditors } from "../../common/extHostDocumentsAndEditors.js";
import { ExtHostTesting, TestRunCoordinator, TestRunDto, TestRunProfileImpl } from "../../common/extHostTesting.js";
import { ExtHostTestItemCollection, TestItemImpl } from "../../common/extHostTestItem.js";
import * as convert from "../../common/extHostTypeConverters.js";
import { Location, Position, Range, TestMessage, TestRunProfileKind, TestRunRequest as TestRunRequestImpl, TestTag } from "../../common/extHostTypes.js";
import { AnyCallRPCProtocol } from "../common/testRPCProtocol.js";
import { TestId } from "../../../contrib/testing/common/testId.js";
import { TestDiffOpType, TestItemExpandState, TestMessageType } from "../../../contrib/testing/common/testTypes.js";
import { nullExtensionDescription } from "../../../services/extensions/common/extensions.js";
const simplify = (item) => ({
  id: item.id,
  label: item.label,
  uri: item.uri,
  range: item.range
});
const assertTreesEqual = (a, b) => {
  if (!a) {
    throw new assert.AssertionError({ message: "Expected a to be defined", actual: a });
  }
  if (!b) {
    throw new assert.AssertionError({ message: "Expected b to be defined", actual: b });
  }
  assert.deepStrictEqual(simplify(a), simplify(b));
  const aChildren = [...a.children].map(([_, c]) => c.id).sort();
  const bChildren = [...b.children].map(([_, c]) => c.id).sort();
  assert.strictEqual(aChildren.length, bChildren.length, `expected ${a.label}.children.length == ${b.label}.children.length`);
  aChildren.forEach((key) => assertTreesEqual(a.children.get(key), b.children.get(key)));
};
suite("ExtHost Testing", () => {
  class TestExtHostTestItemCollection extends ExtHostTestItemCollection {
    setDiff(diff) {
      this.diff = diff;
    }
  }
  teardown(() => {
    sinon.restore();
  });
  const ds = ensureNoDisposablesAreLeakedInTestSuite();
  let single;
  let resolveCalls = [];
  setup(() => {
    resolveCalls = [];
    single = ds.add(new TestExtHostTestItemCollection("ctrlId", "root", {
      getDocument: () => void 0
    }));
    single.resolveHandler = (item) => {
      resolveCalls.push(item?.id);
      if (item === void 0) {
        const a = new TestItemImpl("ctrlId", "id-a", "a", URI.file("/"));
        a.canResolveChildren = true;
        const b = new TestItemImpl("ctrlId", "id-b", "b", URI.file("/"));
        single.root.children.add(a);
        single.root.children.add(b);
      } else if (item.id === "id-a") {
        item.children.add(new TestItemImpl("ctrlId", "id-aa", "aa", URI.file("/")));
        item.children.add(new TestItemImpl("ctrlId", "id-ab", "ab", URI.file("/")));
      }
    };
    ds.add(single.onDidGenerateDiff((d) => single.setDiff(
      d
      /* don't clear during testing */
    )));
  });
  suite("OwnedTestCollection", () => {
    test("adds a root recursively", async () => {
      await single.expand(single.root.id, Infinity);
      const a = single.root.children.get("id-a");
      const b = single.root.children.get("id-b");
      assert.deepStrictEqual(single.collectDiff(), [
        {
          op: TestDiffOpType.Add,
          item: { controllerId: "ctrlId", expand: TestItemExpandState.BusyExpanding, item: { ...convert.TestItem.from(single.root) } }
        },
        {
          op: TestDiffOpType.Add,
          item: { controllerId: "ctrlId", expand: TestItemExpandState.BusyExpanding, item: { ...convert.TestItem.from(a) } }
        },
        {
          op: TestDiffOpType.Add,
          item: { controllerId: "ctrlId", expand: TestItemExpandState.NotExpandable, item: convert.TestItem.from(a.children.get("id-aa")) }
        },
        {
          op: TestDiffOpType.Add,
          item: { controllerId: "ctrlId", expand: TestItemExpandState.NotExpandable, item: convert.TestItem.from(a.children.get("id-ab")) }
        },
        {
          op: TestDiffOpType.Update,
          item: { extId: new TestId(["ctrlId", "id-a"]).toString(), expand: TestItemExpandState.Expanded }
        },
        {
          op: TestDiffOpType.Add,
          item: { controllerId: "ctrlId", expand: TestItemExpandState.NotExpandable, item: convert.TestItem.from(b) }
        },
        {
          op: TestDiffOpType.Update,
          item: { extId: single.root.id, expand: TestItemExpandState.Expanded }
        }
      ]);
    });
    test("parents are set correctly", () => {
      single.expand(single.root.id, Infinity);
      single.collectDiff();
      const a = single.root.children.get("id-a");
      const ab = a.children.get("id-ab");
      assert.strictEqual(a.parent, void 0);
      assert.strictEqual(ab.parent, a);
    });
    test("can add an item with same ID as root", () => {
      single.collectDiff();
      const child = new TestItemImpl("ctrlId", "ctrlId", "c", void 0);
      single.root.children.add(child);
      assert.deepStrictEqual(single.collectDiff(), [
        {
          op: TestDiffOpType.Add,
          item: { controllerId: "ctrlId", expand: TestItemExpandState.NotExpandable, item: convert.TestItem.from(child) }
        }
      ]);
    });
    test("no-ops if items not changed", () => {
      single.collectDiff();
      assert.deepStrictEqual(single.collectDiff(), []);
    });
    test("watches property mutations", () => {
      single.expand(single.root.id, Infinity);
      single.collectDiff();
      single.root.children.get("id-a").description = "Hello world";
      assert.deepStrictEqual(single.collectDiff(), [
        {
          op: TestDiffOpType.Update,
          item: { extId: new TestId(["ctrlId", "id-a"]).toString(), item: { description: "Hello world" } }
        }
      ]);
    });
    test("removes children", () => {
      single.expand(single.root.id, Infinity);
      single.collectDiff();
      single.root.children.delete("id-a");
      assert.deepStrictEqual(single.collectDiff(), [
        { op: TestDiffOpType.Remove, itemId: new TestId(["ctrlId", "id-a"]).toString() }
      ]);
      assert.deepStrictEqual(
        [...single.tree.keys()].sort(),
        [single.root.id, new TestId(["ctrlId", "id-b"]).toString()]
      );
      assert.strictEqual(single.tree.size, 2);
    });
    test("adds new children", () => {
      single.expand(single.root.id, Infinity);
      single.collectDiff();
      const child = new TestItemImpl("ctrlId", "id-ac", "c", void 0);
      single.root.children.get("id-a").children.add(child);
      assert.deepStrictEqual(single.collectDiff(), [
        {
          op: TestDiffOpType.Add,
          item: {
            controllerId: "ctrlId",
            expand: TestItemExpandState.NotExpandable,
            item: convert.TestItem.from(child)
          }
        }
      ]);
      assert.deepStrictEqual(
        [...single.tree.values()].map((n) => n.actual.id).sort(),
        [single.root.id, "id-a", "id-aa", "id-ab", "id-ac", "id-b"]
      );
      assert.strictEqual(single.tree.size, 6);
    });
    test("manages tags correctly", () => {
      single.expand(single.root.id, Infinity);
      single.collectDiff();
      const tag1 = new TestTag("tag1");
      const tag2 = new TestTag("tag2");
      const tag3 = new TestTag("tag3");
      const child = new TestItemImpl("ctrlId", "id-ac", "c", void 0);
      child.tags = [tag1, tag2];
      single.root.children.get("id-a").children.add(child);
      assert.deepStrictEqual(single.collectDiff(), [
        { op: TestDiffOpType.AddTag, tag: { id: "ctrlId\0tag1" } },
        { op: TestDiffOpType.AddTag, tag: { id: "ctrlId\0tag2" } },
        {
          op: TestDiffOpType.Add,
          item: {
            controllerId: "ctrlId",
            expand: TestItemExpandState.NotExpandable,
            item: convert.TestItem.from(child)
          }
        }
      ]);
      child.tags = [tag2, tag3];
      assert.deepStrictEqual(single.collectDiff(), [
        { op: TestDiffOpType.AddTag, tag: { id: "ctrlId\0tag3" } },
        {
          op: TestDiffOpType.Update,
          item: {
            extId: new TestId(["ctrlId", "id-a", "id-ac"]).toString(),
            item: { tags: ["ctrlId\0tag2", "ctrlId\0tag3"] }
          }
        },
        { op: TestDiffOpType.RemoveTag, id: "ctrlId\0tag1" }
      ]);
      const a = single.root.children.get("id-a");
      a.tags = [tag2];
      a.children.replace([]);
      assert.deepStrictEqual(single.collectDiff().filter((t) => t.op === TestDiffOpType.RemoveTag), [
        { op: TestDiffOpType.RemoveTag, id: "ctrlId\0tag3" }
      ]);
    });
    test("replaces on uri change", () => {
      single.expand(single.root.id, Infinity);
      single.collectDiff();
      const oldA = single.root.children.get("id-a");
      const uri = single.root.children.get("id-a").uri?.with({ path: "/different" });
      const newA = new TestItemImpl("ctrlId", "id-a", "Hello world", uri);
      newA.children.replace([...oldA.children].map(([_, item]) => item));
      single.root.children.replace([...single.root.children].map(([id, i]) => id === "id-a" ? newA : i));
      assert.deepStrictEqual(single.collectDiff(), [
        { op: TestDiffOpType.Remove, itemId: new TestId(["ctrlId", "id-a"]).toString() },
        {
          op: TestDiffOpType.Add,
          item: { controllerId: "ctrlId", expand: TestItemExpandState.NotExpandable, item: { ...convert.TestItem.from(newA) } }
        },
        {
          op: TestDiffOpType.Add,
          item: { controllerId: "ctrlId", expand: TestItemExpandState.NotExpandable, item: convert.TestItem.from(newA.children.get("id-aa")) }
        },
        {
          op: TestDiffOpType.Add,
          item: { controllerId: "ctrlId", expand: TestItemExpandState.NotExpandable, item: convert.TestItem.from(newA.children.get("id-ab")) }
        }
      ]);
    });
    test("treats in-place replacement as mutation", () => {
      single.expand(single.root.id, Infinity);
      single.collectDiff();
      const oldA = single.root.children.get("id-a");
      const uri = single.root.children.get("id-a").uri;
      const newA = new TestItemImpl("ctrlId", "id-a", "Hello world", uri);
      newA.children.replace([...oldA.children].map(([_, item]) => item));
      single.root.children.replace([
        newA,
        new TestItemImpl("ctrlId", "id-b", single.root.children.get("id-b").label, uri)
      ]);
      assert.deepStrictEqual(single.collectDiff(), [
        {
          op: TestDiffOpType.Update,
          item: { extId: new TestId(["ctrlId", "id-a"]).toString(), item: { label: "Hello world" } }
        },
        {
          op: TestDiffOpType.DocumentSynced,
          docv: void 0,
          uri
        }
      ]);
      newA.label = "still connected";
      assert.deepStrictEqual(single.collectDiff(), [
        {
          op: TestDiffOpType.Update,
          item: { extId: new TestId(["ctrlId", "id-a"]).toString(), item: { label: "still connected" } }
        }
      ]);
      oldA.label = "no longer connected";
      assert.deepStrictEqual(single.collectDiff(), []);
    });
    suite("expandibility restoration", () => {
      const doReplace = async (canResolveChildren = true) => {
        const uri = single.root.children.get("id-a").uri;
        const newA = new TestItemImpl("ctrlId", "id-a", "Hello world", uri);
        newA.canResolveChildren = canResolveChildren;
        single.root.children.replace([
          newA,
          new TestItemImpl("ctrlId", "id-b", single.root.children.get("id-b").label, uri)
        ]);
        await timeout(0);
      };
      test("does not restore an unexpanded state", async () => {
        await single.expand(single.root.id, 0);
        assert.deepStrictEqual(resolveCalls, [void 0]);
        await doReplace();
        assert.deepStrictEqual(resolveCalls, [void 0]);
      });
      test("restores resolve state on replacement", async () => {
        await single.expand(single.root.id, Infinity);
        assert.deepStrictEqual(resolveCalls, [void 0, "id-a"]);
        await doReplace();
        assert.deepStrictEqual(resolveCalls, [void 0, "id-a", "id-a"]);
      });
      test("does not expand if new child is not expandable", async () => {
        await single.expand(single.root.id, Infinity);
        assert.deepStrictEqual(resolveCalls, [void 0, "id-a"]);
        await doReplace(false);
        assert.deepStrictEqual(resolveCalls, [void 0, "id-a"]);
      });
    });
    test("treats in-place replacement as mutation deeply", () => {
      single.expand(single.root.id, Infinity);
      single.collectDiff();
      const oldA = single.root.children.get("id-a");
      const uri = oldA.uri;
      const newA = new TestItemImpl("ctrlId", "id-a", single.root.children.get("id-a").label, uri);
      const oldAA = oldA.children.get("id-aa");
      const oldAB = oldA.children.get("id-ab");
      const newAB = new TestItemImpl("ctrlId", "id-ab", "Hello world", uri);
      newA.children.replace([oldAA, newAB]);
      single.root.children.replace([newA, single.root.children.get("id-b")]);
      assert.deepStrictEqual(single.collectDiff(), [
        {
          op: TestDiffOpType.Update,
          item: { extId: TestId.fromExtHostTestItem(oldAB, "ctrlId").toString(), item: { label: "Hello world" } }
        },
        {
          op: TestDiffOpType.DocumentSynced,
          docv: void 0,
          uri
        }
      ]);
      oldAA.label = "still connected1";
      newAB.label = "still connected2";
      oldAB.label = "not connected3";
      assert.deepStrictEqual(single.collectDiff(), [
        {
          op: TestDiffOpType.Update,
          item: { extId: new TestId(["ctrlId", "id-a", "id-aa"]).toString(), item: { label: "still connected1" } }
        },
        {
          op: TestDiffOpType.Update,
          item: { extId: new TestId(["ctrlId", "id-a", "id-ab"]).toString(), item: { label: "still connected2" } }
        }
      ]);
      assert.strictEqual(newAB.parent, newA);
      assert.strictEqual(oldAA.parent, newA);
      assert.deepStrictEqual(newA.parent, void 0);
    });
    test("moves an item to be a new child", async () => {
      await single.expand(single.root.id, 0);
      single.collectDiff();
      const b = single.root.children.get("id-b");
      const a = single.root.children.get("id-a");
      a.children.add(b);
      assert.deepStrictEqual(single.collectDiff(), [
        {
          op: TestDiffOpType.Remove,
          itemId: new TestId(["ctrlId", "id-b"]).toString()
        },
        {
          op: TestDiffOpType.Add,
          item: { controllerId: "ctrlId", expand: TestItemExpandState.NotExpandable, item: convert.TestItem.from(b) }
        }
      ]);
      b.label = "still connected";
      assert.deepStrictEqual(single.collectDiff(), [
        {
          op: TestDiffOpType.Update,
          item: { extId: new TestId(["ctrlId", "id-a", "id-b"]).toString(), item: { label: "still connected" } }
        }
      ]);
      assert.deepStrictEqual([...single.root.children].map(([_, item]) => item), [single.root.children.get("id-a")]);
      assert.deepStrictEqual(b.parent, a);
    });
    test("sends document sync events", async () => {
      await single.expand(single.root.id, 0);
      single.collectDiff();
      const a = single.root.children.get("id-a");
      a.range = new Range(new Position(0, 0), new Position(1, 0));
      assert.deepStrictEqual(single.collectDiff(), [
        {
          op: TestDiffOpType.DocumentSynced,
          docv: void 0,
          uri: URI.file("/")
        },
        {
          op: TestDiffOpType.Update,
          item: {
            extId: new TestId(["ctrlId", "id-a"]).toString(),
            item: {
              range: editorRange.Range.lift({
                endColumn: 1,
                endLineNumber: 2,
                startColumn: 1,
                startLineNumber: 1
              })
            }
          }
        }
      ]);
      a.range = a.range;
      assert.deepStrictEqual(single.collectDiff(), [
        {
          op: TestDiffOpType.DocumentSynced,
          docv: void 0,
          uri: URI.file("/")
        }
      ]);
      const uri = URI.file("/");
      const a2 = new TestItemImpl("ctrlId", "id-a", "a", uri);
      a2.range = a.range;
      single.root.children.replace([a2, single.root.children.get("id-b")]);
      assert.deepStrictEqual(single.collectDiff(), [
        {
          op: TestDiffOpType.DocumentSynced,
          docv: void 0,
          uri
        }
      ]);
    });
  });
  suite("MirroredTestCollection", () => {
  });
  suite("TestRunTracker", () => {
    let proxy;
    let c;
    let cts;
    let configuration;
    let req;
    let dto;
    const ext = {};
    teardown(() => {
      for (const { id } of c.trackers) {
        c.disposeTestRun(id);
      }
    });
    setup(async () => {
      proxy = mockObject()();
      cts = new CancellationTokenSource();
      c = new TestRunCoordinator(proxy, new NullLogService());
      configuration = new TestRunProfileImpl(mockObject()(), /* @__PURE__ */ new Map(), /* @__PURE__ */ new Set(), Event.None, "ctrlId", 42, "Do Run", TestRunProfileKind.Run, () => {
      }, false);
      await single.expand(single.root.id, Infinity);
      single.collectDiff();
      req = {
        include: void 0,
        exclude: [single.root.children.get("id-b")],
        profile: configuration,
        preserveFocus: false
      };
      dto = TestRunDto.fromInternal({
        controllerId: "ctrl",
        profileId: configuration.profileId,
        excludeExtIds: ["id-b"],
        runId: "run-id",
        testIds: [single.root.id]
      }, single);
    });
    test("tracks a run started from a main thread request", () => {
      const tracker = ds.add(c.prepareForMainThreadTestRun(ext, req, dto, configuration, cts.token));
      assert.strictEqual(tracker.hasRunningTasks, false);
      const task1 = c.createTestRun(ext, "ctrl", single, req, "run1", true);
      const task2 = c.createTestRun(ext, "ctrl", single, req, "run2", true);
      assert.strictEqual(proxy.$startedExtensionTestRun.called, false);
      assert.strictEqual(tracker.hasRunningTasks, true);
      task1.appendOutput("hello");
      const taskId = proxy.$appendOutputToRun.args[0]?.[1];
      assert.deepStrictEqual([["run-id", taskId, VSBuffer.fromString("hello"), void 0, void 0]], proxy.$appendOutputToRun.args);
      task1.end();
      assert.strictEqual(proxy.$finishedExtensionTestRun.called, false);
      assert.strictEqual(tracker.hasRunningTasks, true);
      task2.end();
      assert.strictEqual(proxy.$finishedExtensionTestRun.called, false);
      assert.strictEqual(tracker.hasRunningTasks, false);
    });
    test("run cancel force ends after a timeout", () => {
      const clock = sinon.useFakeTimers();
      try {
        const tracker = ds.add(c.prepareForMainThreadTestRun(ext, req, dto, configuration, cts.token));
        const task = c.createTestRun(ext, "ctrl", single, req, "run1", true);
        const onEnded = sinon.stub();
        ds.add(tracker.onEnd(onEnded));
        assert.strictEqual(task.token.isCancellationRequested, false);
        assert.strictEqual(tracker.hasRunningTasks, true);
        tracker.cancel();
        assert.strictEqual(task.token.isCancellationRequested, true);
        assert.strictEqual(tracker.hasRunningTasks, true);
        clock.tick(9999);
        assert.strictEqual(tracker.hasRunningTasks, true);
        assert.strictEqual(onEnded.called, false);
        clock.tick(1);
        assert.strictEqual(onEnded.called, true);
        assert.strictEqual(tracker.hasRunningTasks, false);
      } finally {
        clock.restore();
      }
    });
    test("run cancel force ends on second cancellation request", () => {
      const tracker = ds.add(c.prepareForMainThreadTestRun(ext, req, dto, configuration, cts.token));
      const task = c.createTestRun(ext, "ctrl", single, req, "run1", true);
      const onEnded = sinon.stub();
      ds.add(tracker.onEnd(onEnded));
      assert.strictEqual(task.token.isCancellationRequested, false);
      assert.strictEqual(tracker.hasRunningTasks, true);
      tracker.cancel();
      assert.strictEqual(task.token.isCancellationRequested, true);
      assert.strictEqual(tracker.hasRunningTasks, true);
      assert.strictEqual(onEnded.called, false);
      tracker.cancel();
      assert.strictEqual(tracker.hasRunningTasks, false);
      assert.strictEqual(onEnded.called, true);
    });
    test("tracks a run started from an extension request", () => {
      const task1 = c.createTestRun(ext, "ctrl", single, req, "hello world", false);
      const tracker = Iterable.first(c.trackers);
      assert.strictEqual(tracker.hasRunningTasks, true);
      assert.deepStrictEqual(proxy.$startedExtensionTestRun.args, [
        [{
          profile: { group: 2, id: 42 },
          controllerId: "ctrl",
          id: tracker.id,
          include: [single.root.id],
          exclude: [new TestId(["ctrlId", "id-b"]).toString()],
          persist: false,
          continuous: false,
          preserveFocus: false
        }]
      ]);
      const task2 = c.createTestRun(ext, "ctrl", single, req, "run2", true);
      const task3Detached = c.createTestRun(ext, "ctrl", single, { ...req }, "task3Detached", true);
      task1.end();
      assert.strictEqual(proxy.$finishedExtensionTestRun.called, false);
      assert.strictEqual(tracker.hasRunningTasks, true);
      task2.end();
      assert.deepStrictEqual(proxy.$finishedExtensionTestRun.args, [[tracker.id]]);
      assert.strictEqual(tracker.hasRunningTasks, false);
      task3Detached.end();
    });
    test("adds tests to run smartly", () => {
      const task1 = c.createTestRun(ext, "ctrlId", single, req, "hello world", false);
      const tracker = Iterable.first(c.trackers);
      const expectedArgs = [];
      assert.deepStrictEqual(proxy.$addTestsToRun.args, expectedArgs);
      task1.passed(single.root.children.get("id-a").children.get("id-aa"));
      expectedArgs.push([
        "ctrlId",
        tracker.id,
        [
          convert.TestItem.from(single.root),
          convert.TestItem.from(single.root.children.get("id-a")),
          convert.TestItem.from(single.root.children.get("id-a").children.get("id-aa"))
        ]
      ]);
      assert.deepStrictEqual(proxy.$addTestsToRun.args, expectedArgs);
      task1.enqueued(single.root.children.get("id-a").children.get("id-ab"));
      expectedArgs.push([
        "ctrlId",
        tracker.id,
        [
          convert.TestItem.from(single.root.children.get("id-a")),
          convert.TestItem.from(single.root.children.get("id-a").children.get("id-ab"))
        ]
      ]);
      assert.deepStrictEqual(proxy.$addTestsToRun.args, expectedArgs);
      task1.passed(single.root.children.get("id-a").children.get("id-ab"));
      assert.deepStrictEqual(proxy.$addTestsToRun.args, expectedArgs);
      task1.end();
    });
    test("adds test messages to run", () => {
      const test1 = new TestItemImpl("ctrlId", "id-c", "test c", URI.file("/testc.txt"));
      const test2 = new TestItemImpl("ctrlId", "id-d", "test d", URI.file("/testd.txt"));
      test1.range = test2.range = new Range(new Position(0, 0), new Position(1, 0));
      single.root.children.replace([test1, test2]);
      const task = c.createTestRun(ext, "ctrlId", single, req, "hello world", false);
      const message1 = new TestMessage("some message");
      message1.location = new Location(URI.file("/a.txt"), new Position(0, 0));
      task.failed(test1, message1);
      const args = proxy.$appendTestMessagesInRun.args[0];
      assert.deepStrictEqual(proxy.$appendTestMessagesInRun.args[0], [
        args[0],
        args[1],
        new TestId(["ctrlId", "id-c"]).toString(),
        [{
          message: "some message",
          type: TestMessageType.Error,
          expected: void 0,
          contextValue: void 0,
          actual: void 0,
          location: convert.location.from(message1.location),
          stackTrace: void 0
        }]
      ]);
      task.failed(test2, new TestMessage("some message"));
      assert.deepStrictEqual(proxy.$appendTestMessagesInRun.args[1], [
        args[0],
        args[1],
        new TestId(["ctrlId", "id-d"]).toString(),
        [{
          message: "some message",
          type: TestMessageType.Error,
          contextValue: void 0,
          expected: void 0,
          actual: void 0,
          location: convert.location.from({ uri: test2.uri, range: test2.range }),
          stackTrace: void 0
        }]
      ]);
      task.end();
    });
    test("guards calls after runs are ended", () => {
      const task = c.createTestRun(ext, "ctrl", single, req, "hello world", false);
      task.end();
      task.failed(single.root, new TestMessage("some message"));
      task.appendOutput("output");
      assert.strictEqual(proxy.$addTestsToRun.called, false);
      assert.strictEqual(proxy.$appendOutputToRun.called, false);
      assert.strictEqual(proxy.$appendTestMessagesInRun.called, false);
    });
    test("sets state of test with identical local IDs (#131827)", () => {
      const testA = single.root.children.get("id-a");
      const testB = single.root.children.get("id-b");
      const childA = new TestItemImpl("ctrlId", "id-child", "child", void 0);
      testA.children.replace([childA]);
      const childB = new TestItemImpl("ctrlId", "id-child", "child", void 0);
      testB.children.replace([childB]);
      const task1 = c.createTestRun(ext, "ctrl", single, new TestRunRequestImpl(), "hello world", false);
      const tracker = Iterable.first(c.trackers);
      task1.passed(childA);
      task1.passed(childB);
      assert.deepStrictEqual(proxy.$addTestsToRun.args, [
        [
          "ctrl",
          tracker.id,
          [single.root, testA, childA].map((t) => convert.TestItem.from(t))
        ],
        [
          "ctrl",
          tracker.id,
          [single.root, testB, childB].map((t) => convert.TestItem.from(t))
        ]
      ]);
      task1.end();
    });
  });
  suite("service", () => {
    let ctrl;
    class TestExtHostTesting extends ExtHostTesting {
      getProfileInternalId(ctrl2, profile) {
        for (const [id, p] of this.controllers.get(ctrl2.id).profiles) {
          if (profile === p) {
            return id;
          }
        }
        throw new Error("profile not found");
      }
    }
    setup(() => {
      const rpcProtocol = AnyCallRPCProtocol();
      ctrl = ds.add(new TestExtHostTesting(
        rpcProtocol,
        new NullLogService(),
        new ExtHostCommands(rpcProtocol, new NullLogService(), new class extends mock() {
          onExtensionError() {
            return true;
          }
        }()),
        new ExtHostDocumentsAndEditors(rpcProtocol, new NullLogService())
      ));
    });
    test("exposes active profiles correctly", async () => {
      const extA = { ...nullExtensionDescription, identifier: new ExtensionIdentifier("ext.a"), enabledApiProposals: ["testingActiveProfile"] };
      const extB = { ...nullExtensionDescription, identifier: new ExtensionIdentifier("ext.b"), enabledApiProposals: ["testingActiveProfile"] };
      const ctrlA = ds.add(ctrl.createTestController(extA, "a", "ctrla"));
      const profAA = ds.add(ctrlA.createRunProfile("aa", TestRunProfileKind.Run, () => {
      }));
      const profAB = ds.add(ctrlA.createRunProfile("ab", TestRunProfileKind.Run, () => {
      }));
      const ctrlB = ds.add(ctrl.createTestController(extB, "b", "ctrlb"));
      const profBA = ds.add(ctrlB.createRunProfile("ba", TestRunProfileKind.Run, () => {
      }));
      const profBB = ds.add(ctrlB.createRunProfile("bb", TestRunProfileKind.Run, () => {
      }));
      const neverCalled = sinon.stub();
      assert.deepStrictEqual(profAA.isDefault, false);
      assert.deepStrictEqual(profBA.isDefault, false);
      assert.deepStrictEqual(profBB.isDefault, false);
      const changeA = Event.toPromise(profAA.onDidChangeDefault);
      const changeBA = Event.toPromise(profBA.onDidChangeDefault);
      const changeBB = Event.toPromise(profBB.onDidChangeDefault);
      ds.add(profAB.onDidChangeDefault(neverCalled));
      assert.strictEqual(neverCalled.called, false);
      ctrl.$setDefaultRunProfiles({
        a: [ctrl.getProfileInternalId(ctrlA, profAA)],
        b: [ctrl.getProfileInternalId(ctrlB, profBA), ctrl.getProfileInternalId(ctrlB, profBB)]
      });
      assert.deepStrictEqual(await changeA, true);
      assert.deepStrictEqual(await changeBA, true);
      assert.deepStrictEqual(await changeBB, true);
      assert.deepStrictEqual(profAA.isDefault, true);
      assert.deepStrictEqual(profBA.isDefault, true);
      assert.deepStrictEqual(profBB.isDefault, true);
      assert.deepStrictEqual(profAB.isDefault, false);
      ds.add(profAA.onDidChangeDefault(neverCalled));
      ctrl.$setDefaultRunProfiles({
        a: [ctrl.getProfileInternalId(ctrlA, profAA)]
      });
      assert.strictEqual(neverCalled.called, false);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9leHRIb3N0VGVzdGluZy50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0ICogYXMgc2lub24gZnJvbSAnc2lub24nO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgbW9jaywgbW9ja09iamVjdCwgTW9ja09iamVjdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vbW9jay5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCAqIGFzIGVkaXRvclJhbmdlIGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyLCBJRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgTWFpblRocmVhZFRlc3RpbmdTaGFwZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7IEV4dEhvc3RDb21tYW5kcyB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0Q29tbWFuZHMuanMnO1xuaW1wb3J0IHsgRXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RUZWxlbWV0cnkgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdFRlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0VGVzdGluZywgVGVzdFJ1bkNvb3JkaW5hdG9yLCBUZXN0UnVuRHRvLCBUZXN0UnVuUHJvZmlsZUltcGwgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdFRlc3RpbmcuanMnO1xuaW1wb3J0IHsgRXh0SG9zdFRlc3RJdGVtQ29sbGVjdGlvbiwgVGVzdEl0ZW1JbXBsIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3RUZXN0SXRlbS5qcyc7XG5pbXBvcnQgKiBhcyBjb252ZXJ0IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0VHlwZUNvbnZlcnRlcnMuanMnO1xuaW1wb3J0IHsgTG9jYXRpb24sIFBvc2l0aW9uLCBSYW5nZSwgVGVzdE1lc3NhZ2UsIFRlc3RSdW5Qcm9maWxlS2luZCwgVGVzdFJ1blJlcXVlc3QgYXMgVGVzdFJ1blJlcXVlc3RJbXBsLCBUZXN0VGFnIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3RUeXBlcy5qcyc7XG5pbXBvcnQgeyBBbnlDYWxsUlBDUHJvdG9jb2wgfSBmcm9tICcuLi9jb21tb24vdGVzdFJQQ1Byb3RvY29sLmpzJztcbmltcG9ydCB7IFRlc3RJZCB9IGZyb20gJy4uLy4uLy4uL2NvbnRyaWIvdGVzdGluZy9jb21tb24vdGVzdElkLmpzJztcbmltcG9ydCB7IFRlc3REaWZmT3BUeXBlLCBUZXN0SXRlbUV4cGFuZFN0YXRlLCBUZXN0TWVzc2FnZVR5cGUsIFRlc3RzRGlmZiB9IGZyb20gJy4uLy4uLy4uL2NvbnRyaWIvdGVzdGluZy9jb21tb24vdGVzdFR5cGVzLmpzJztcbmltcG9ydCB7IG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHR5cGUgeyBUZXN0Q29udHJvbGxlciwgVGVzdEl0ZW0sIFRlc3RSdW5Qcm9maWxlLCBUZXN0UnVuUmVxdWVzdCB9IGZyb20gJ3ZzY29kZSc7XG5cbmNvbnN0IHNpbXBsaWZ5ID0gKGl0ZW06IFRlc3RJdGVtKSA9PiAoe1xuXHRpZDogaXRlbS5pZCxcblx0bGFiZWw6IGl0ZW0ubGFiZWwsXG5cdHVyaTogaXRlbS51cmksXG5cdHJhbmdlOiBpdGVtLnJhbmdlLFxufSk7XG5cbmNvbnN0IGFzc2VydFRyZWVzRXF1YWwgPSAoYTogVGVzdEl0ZW1JbXBsIHwgdW5kZWZpbmVkLCBiOiBUZXN0SXRlbUltcGwgfCB1bmRlZmluZWQpID0+IHtcblx0aWYgKCFhKSB7XG5cdFx0dGhyb3cgbmV3IGFzc2VydC5Bc3NlcnRpb25FcnJvcih7IG1lc3NhZ2U6ICdFeHBlY3RlZCBhIHRvIGJlIGRlZmluZWQnLCBhY3R1YWw6IGEgfSk7XG5cdH1cblxuXHRpZiAoIWIpIHtcblx0XHR0aHJvdyBuZXcgYXNzZXJ0LkFzc2VydGlvbkVycm9yKHsgbWVzc2FnZTogJ0V4cGVjdGVkIGIgdG8gYmUgZGVmaW5lZCcsIGFjdHVhbDogYiB9KTtcblx0fVxuXG5cdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2ltcGxpZnkoYSksIHNpbXBsaWZ5KGIpKTtcblxuXHRjb25zdCBhQ2hpbGRyZW4gPSBbLi4uYS5jaGlsZHJlbl0ubWFwKChbXywgY10pID0+IGMuaWQpLnNvcnQoKTtcblx0Y29uc3QgYkNoaWxkcmVuID0gWy4uLmIuY2hpbGRyZW5dLm1hcCgoW18sIGNdKSA9PiBjLmlkKS5zb3J0KCk7XG5cdGFzc2VydC5zdHJpY3RFcXVhbChhQ2hpbGRyZW4ubGVuZ3RoLCBiQ2hpbGRyZW4ubGVuZ3RoLCBgZXhwZWN0ZWQgJHthLmxhYmVsfS5jaGlsZHJlbi5sZW5ndGggPT0gJHtiLmxhYmVsfS5jaGlsZHJlbi5sZW5ndGhgKTtcblx0YUNoaWxkcmVuLmZvckVhY2goa2V5ID0+IGFzc2VydFRyZWVzRXF1YWwoYS5jaGlsZHJlbi5nZXQoa2V5KSBhcyBUZXN0SXRlbUltcGwsIGIuY2hpbGRyZW4uZ2V0KGtleSkgYXMgVGVzdEl0ZW1JbXBsKSk7XG59O1xuXG4vLyBjb25zdCBhc3NlcnRUcmVlTGlzdEVxdWFsID0gKGE6IFJlYWRvbmx5QXJyYXk8VGVzdEl0ZW0+LCBiOiBSZWFkb25seUFycmF5PFRlc3RJdGVtPikgPT4ge1xuLy8gXHRhc3NlcnQuc3RyaWN0RXF1YWwoYS5sZW5ndGgsIGIubGVuZ3RoLCBgZXhwZWN0ZWQgYS5sZW5ndGggPT0gbi5sZW5ndGhgKTtcbi8vIFx0YS5mb3JFYWNoKChfLCBpKSA9PiBhc3NlcnRUcmVlc0VxdWFsKGFbaV0sIGJbaV0pKTtcbi8vIH07XG5cbi8vIGNsYXNzIFRlc3RNaXJyb3JlZENvbGxlY3Rpb24gZXh0ZW5kcyBNaXJyb3JlZFRlc3RDb2xsZWN0aW9uIHtcbi8vIFx0cHVibGljIGNoYW5nZUV2ZW50ITogVGVzdENoYW5nZUV2ZW50O1xuXG4vLyBcdGNvbnN0cnVjdG9yKCkge1xuLy8gXHRcdHN1cGVyKCk7XG4vLyBcdFx0dGhpcy5vbkRpZENoYW5nZVRlc3RzKGV2dCA9PiB0aGlzLmNoYW5nZUV2ZW50ID0gZXZ0KTtcbi8vIFx0fVxuXG4vLyBcdHB1YmxpYyBnZXQgbGVuZ3RoKCkge1xuLy8gXHRcdHJldHVybiB0aGlzLml0ZW1zLnNpemU7XG4vLyBcdH1cbi8vIH1cblxuc3VpdGUoJ0V4dEhvc3QgVGVzdGluZycsICgpID0+IHtcblx0Y2xhc3MgVGVzdEV4dEhvc3RUZXN0SXRlbUNvbGxlY3Rpb24gZXh0ZW5kcyBFeHRIb3N0VGVzdEl0ZW1Db2xsZWN0aW9uIHtcblx0XHRwdWJsaWMgc2V0RGlmZihkaWZmOiBUZXN0c0RpZmYpIHtcblx0XHRcdHRoaXMuZGlmZiA9IGRpZmY7XG5cdFx0fVxuXHR9XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdHNpbm9uLnJlc3RvcmUoKTtcblx0fSk7XG5cblx0Y29uc3QgZHMgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRsZXQgc2luZ2xlOiBUZXN0RXh0SG9zdFRlc3RJdGVtQ29sbGVjdGlvbjtcblx0bGV0IHJlc29sdmVDYWxsczogKHN0cmluZyB8IHVuZGVmaW5lZClbXSA9IFtdO1xuXHRzZXR1cCgoKSA9PiB7XG5cdFx0cmVzb2x2ZUNhbGxzID0gW107XG5cdFx0c2luZ2xlID0gZHMuYWRkKG5ldyBUZXN0RXh0SG9zdFRlc3RJdGVtQ29sbGVjdGlvbignY3RybElkJywgJ3Jvb3QnLCB7XG5cdFx0XHRnZXREb2N1bWVudDogKCkgPT4gdW5kZWZpbmVkLFxuXHRcdH0gYXMgUGFydGlhbDxFeHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycz4gYXMgRXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMpKTtcblx0XHRzaW5nbGUucmVzb2x2ZUhhbmRsZXIgPSBpdGVtID0+IHtcblx0XHRcdHJlc29sdmVDYWxscy5wdXNoKGl0ZW0/LmlkKTtcblx0XHRcdGlmIChpdGVtID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Y29uc3QgYSA9IG5ldyBUZXN0SXRlbUltcGwoJ2N0cmxJZCcsICdpZC1hJywgJ2EnLCBVUkkuZmlsZSgnLycpKTtcblx0XHRcdFx0YS5jYW5SZXNvbHZlQ2hpbGRyZW4gPSB0cnVlO1xuXHRcdFx0XHRjb25zdCBiID0gbmV3IFRlc3RJdGVtSW1wbCgnY3RybElkJywgJ2lkLWInLCAnYicsIFVSSS5maWxlKCcvJykpO1xuXHRcdFx0XHRzaW5nbGUucm9vdC5jaGlsZHJlbi5hZGQoYSk7XG5cdFx0XHRcdHNpbmdsZS5yb290LmNoaWxkcmVuLmFkZChiKTtcblx0XHRcdH0gZWxzZSBpZiAoaXRlbS5pZCA9PT0gJ2lkLWEnKSB7XG5cdFx0XHRcdGl0ZW0uY2hpbGRyZW4uYWRkKG5ldyBUZXN0SXRlbUltcGwoJ2N0cmxJZCcsICdpZC1hYScsICdhYScsIFVSSS5maWxlKCcvJykpKTtcblx0XHRcdFx0aXRlbS5jaGlsZHJlbi5hZGQobmV3IFRlc3RJdGVtSW1wbCgnY3RybElkJywgJ2lkLWFiJywgJ2FiJywgVVJJLmZpbGUoJy8nKSkpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRkcy5hZGQoc2luZ2xlLm9uRGlkR2VuZXJhdGVEaWZmKGQgPT4gc2luZ2xlLnNldERpZmYoZCAvKiBkb24ndCBjbGVhciBkdXJpbmcgdGVzdGluZyAqLykpKTtcblx0fSk7XG5cblx0c3VpdGUoJ093bmVkVGVzdENvbGxlY3Rpb24nLCAoKSA9PiB7XG5cdFx0dGVzdCgnYWRkcyBhIHJvb3QgcmVjdXJzaXZlbHknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCBzaW5nbGUuZXhwYW5kKHNpbmdsZS5yb290LmlkLCBJbmZpbml0eSk7XG5cdFx0XHRjb25zdCBhID0gc2luZ2xlLnJvb3QuY2hpbGRyZW4uZ2V0KCdpZC1hJykgYXMgVGVzdEl0ZW1JbXBsO1xuXHRcdFx0Y29uc3QgYiA9IHNpbmdsZS5yb290LmNoaWxkcmVuLmdldCgnaWQtYicpIGFzIFRlc3RJdGVtSW1wbDtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2luZ2xlLmNvbGxlY3REaWZmKCksIFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG9wOiBUZXN0RGlmZk9wVHlwZS5BZGQsXG5cdFx0XHRcdFx0aXRlbTogeyBjb250cm9sbGVySWQ6ICdjdHJsSWQnLCBleHBhbmQ6IFRlc3RJdGVtRXhwYW5kU3RhdGUuQnVzeUV4cGFuZGluZywgaXRlbTogeyAuLi5jb252ZXJ0LlRlc3RJdGVtLmZyb20oc2luZ2xlLnJvb3QpIH0gfVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0b3A6IFRlc3REaWZmT3BUeXBlLkFkZCxcblx0XHRcdFx0XHRpdGVtOiB7IGNvbnRyb2xsZXJJZDogJ2N0cmxJZCcsIGV4cGFuZDogVGVzdEl0ZW1FeHBhbmRTdGF0ZS5CdXN5RXhwYW5kaW5nLCBpdGVtOiB7IC4uLmNvbnZlcnQuVGVzdEl0ZW0uZnJvbShhKSB9IH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG9wOiBUZXN0RGlmZk9wVHlwZS5BZGQsXG5cdFx0XHRcdFx0aXRlbTogeyBjb250cm9sbGVySWQ6ICdjdHJsSWQnLCBleHBhbmQ6IFRlc3RJdGVtRXhwYW5kU3RhdGUuTm90RXhwYW5kYWJsZSwgaXRlbTogY29udmVydC5UZXN0SXRlbS5mcm9tKGEuY2hpbGRyZW4uZ2V0KCdpZC1hYScpIGFzIFRlc3RJdGVtSW1wbCkgfVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0b3A6IFRlc3REaWZmT3BUeXBlLkFkZCxcblx0XHRcdFx0XHRpdGVtOiB7IGNvbnRyb2xsZXJJZDogJ2N0cmxJZCcsIGV4cGFuZDogVGVzdEl0ZW1FeHBhbmRTdGF0ZS5Ob3RFeHBhbmRhYmxlLCBpdGVtOiBjb252ZXJ0LlRlc3RJdGVtLmZyb20oYS5jaGlsZHJlbi5nZXQoJ2lkLWFiJykgYXMgVGVzdEl0ZW1JbXBsKSB9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRvcDogVGVzdERpZmZPcFR5cGUuVXBkYXRlLFxuXHRcdFx0XHRcdGl0ZW06IHsgZXh0SWQ6IG5ldyBUZXN0SWQoWydjdHJsSWQnLCAnaWQtYSddKS50b1N0cmluZygpLCBleHBhbmQ6IFRlc3RJdGVtRXhwYW5kU3RhdGUuRXhwYW5kZWQgfVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0b3A6IFRlc3REaWZmT3BUeXBlLkFkZCxcblx0XHRcdFx0XHRpdGVtOiB7IGNvbnRyb2xsZXJJZDogJ2N0cmxJZCcsIGV4cGFuZDogVGVzdEl0ZW1FeHBhbmRTdGF0ZS5Ob3RFeHBhbmRhYmxlLCBpdGVtOiBjb252ZXJ0LlRlc3RJdGVtLmZyb20oYikgfVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0b3A6IFRlc3REaWZmT3BUeXBlLlVwZGF0ZSxcblx0XHRcdFx0XHRpdGVtOiB7IGV4dElkOiBzaW5nbGUucm9vdC5pZCwgZXhwYW5kOiBUZXN0SXRlbUV4cGFuZFN0YXRlLkV4cGFuZGVkIH1cblx0XHRcdFx0fSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncGFyZW50cyBhcmUgc2V0IGNvcnJlY3RseScsICgpID0+IHtcblx0XHRcdHNpbmdsZS5leHBhbmQoc2luZ2xlLnJvb3QuaWQsIEluZmluaXR5KTtcblx0XHRcdHNpbmdsZS5jb2xsZWN0RGlmZigpO1xuXG5cdFx0XHRjb25zdCBhID0gc2luZ2xlLnJvb3QuY2hpbGRyZW4uZ2V0KCdpZC1hJykhO1xuXHRcdFx0Y29uc3QgYWIgPSBhLmNoaWxkcmVuLmdldCgnaWQtYWInKSE7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYS5wYXJlbnQsIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWIucGFyZW50LCBhKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2NhbiBhZGQgYW4gaXRlbSB3aXRoIHNhbWUgSUQgYXMgcm9vdCcsICgpID0+IHtcblx0XHRcdHNpbmdsZS5jb2xsZWN0RGlmZigpO1xuXG5cdFx0XHRjb25zdCBjaGlsZCA9IG5ldyBUZXN0SXRlbUltcGwoJ2N0cmxJZCcsICdjdHJsSWQnLCAnYycsIHVuZGVmaW5lZCk7XG5cdFx0XHRzaW5nbGUucm9vdC5jaGlsZHJlbi5hZGQoY2hpbGQpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzaW5nbGUuY29sbGVjdERpZmYoKSwgW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0b3A6IFRlc3REaWZmT3BUeXBlLkFkZCxcblx0XHRcdFx0XHRpdGVtOiB7IGNvbnRyb2xsZXJJZDogJ2N0cmxJZCcsIGV4cGFuZDogVGVzdEl0ZW1FeHBhbmRTdGF0ZS5Ob3RFeHBhbmRhYmxlLCBpdGVtOiBjb252ZXJ0LlRlc3RJdGVtLmZyb20oY2hpbGQpIH0sXG5cdFx0XHRcdH1cblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnbm8tb3BzIGlmIGl0ZW1zIG5vdCBjaGFuZ2VkJywgKCkgPT4ge1xuXHRcdFx0c2luZ2xlLmNvbGxlY3REaWZmKCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNpbmdsZS5jb2xsZWN0RGlmZigpLCBbXSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCd3YXRjaGVzIHByb3BlcnR5IG11dGF0aW9ucycsICgpID0+IHtcblx0XHRcdHNpbmdsZS5leHBhbmQoc2luZ2xlLnJvb3QuaWQsIEluZmluaXR5KTtcblx0XHRcdHNpbmdsZS5jb2xsZWN0RGlmZigpO1xuXHRcdFx0c2luZ2xlLnJvb3QuY2hpbGRyZW4uZ2V0KCdpZC1hJykhLmRlc2NyaXB0aW9uID0gJ0hlbGxvIHdvcmxkJzsgLyogaXRlbSBhICovXG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2luZ2xlLmNvbGxlY3REaWZmKCksIFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG9wOiBUZXN0RGlmZk9wVHlwZS5VcGRhdGUsXG5cdFx0XHRcdFx0aXRlbTogeyBleHRJZDogbmV3IFRlc3RJZChbJ2N0cmxJZCcsICdpZC1hJ10pLnRvU3RyaW5nKCksIGl0ZW06IHsgZGVzY3JpcHRpb246ICdIZWxsbyB3b3JsZCcgfSB9LFxuXHRcdFx0XHR9XG5cdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3JlbW92ZXMgY2hpbGRyZW4nLCAoKSA9PiB7XG5cdFx0XHRzaW5nbGUuZXhwYW5kKHNpbmdsZS5yb290LmlkLCBJbmZpbml0eSk7XG5cdFx0XHRzaW5nbGUuY29sbGVjdERpZmYoKTtcblx0XHRcdHNpbmdsZS5yb290LmNoaWxkcmVuLmRlbGV0ZSgnaWQtYScpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNpbmdsZS5jb2xsZWN0RGlmZigpLCBbXG5cdFx0XHRcdHsgb3A6IFRlc3REaWZmT3BUeXBlLlJlbW92ZSwgaXRlbUlkOiBuZXcgVGVzdElkKFsnY3RybElkJywgJ2lkLWEnXSkudG9TdHJpbmcoKSB9LFxuXHRcdFx0XSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRbLi4uc2luZ2xlLnRyZWUua2V5cygpXS5zb3J0KCksXG5cdFx0XHRcdFtzaW5nbGUucm9vdC5pZCwgbmV3IFRlc3RJZChbJ2N0cmxJZCcsICdpZC1iJ10pLnRvU3RyaW5nKCldLFxuXHRcdFx0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaW5nbGUudHJlZS5zaXplLCAyKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2FkZHMgbmV3IGNoaWxkcmVuJywgKCkgPT4ge1xuXHRcdFx0c2luZ2xlLmV4cGFuZChzaW5nbGUucm9vdC5pZCwgSW5maW5pdHkpO1xuXHRcdFx0c2luZ2xlLmNvbGxlY3REaWZmKCk7XG5cdFx0XHRjb25zdCBjaGlsZCA9IG5ldyBUZXN0SXRlbUltcGwoJ2N0cmxJZCcsICdpZC1hYycsICdjJywgdW5kZWZpbmVkKTtcblx0XHRcdHNpbmdsZS5yb290LmNoaWxkcmVuLmdldCgnaWQtYScpIS5jaGlsZHJlbi5hZGQoY2hpbGQpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNpbmdsZS5jb2xsZWN0RGlmZigpLCBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRvcDogVGVzdERpZmZPcFR5cGUuQWRkLCBpdGVtOiB7XG5cdFx0XHRcdFx0XHRjb250cm9sbGVySWQ6ICdjdHJsSWQnLFxuXHRcdFx0XHRcdFx0ZXhwYW5kOiBUZXN0SXRlbUV4cGFuZFN0YXRlLk5vdEV4cGFuZGFibGUsXG5cdFx0XHRcdFx0XHRpdGVtOiBjb252ZXJ0LlRlc3RJdGVtLmZyb20oY2hpbGQpLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdF0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0Wy4uLnNpbmdsZS50cmVlLnZhbHVlcygpXS5tYXAobiA9PiBuLmFjdHVhbC5pZCkuc29ydCgpLFxuXHRcdFx0XHRbc2luZ2xlLnJvb3QuaWQsICdpZC1hJywgJ2lkLWFhJywgJ2lkLWFiJywgJ2lkLWFjJywgJ2lkLWInXSxcblx0XHRcdCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2luZ2xlLnRyZWUuc2l6ZSwgNik7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdtYW5hZ2VzIHRhZ3MgY29ycmVjdGx5JywgKCkgPT4ge1xuXHRcdFx0c2luZ2xlLmV4cGFuZChzaW5nbGUucm9vdC5pZCwgSW5maW5pdHkpO1xuXHRcdFx0c2luZ2xlLmNvbGxlY3REaWZmKCk7XG5cdFx0XHRjb25zdCB0YWcxID0gbmV3IFRlc3RUYWcoJ3RhZzEnKTtcblx0XHRcdGNvbnN0IHRhZzIgPSBuZXcgVGVzdFRhZygndGFnMicpO1xuXHRcdFx0Y29uc3QgdGFnMyA9IG5ldyBUZXN0VGFnKCd0YWczJyk7XG5cdFx0XHRjb25zdCBjaGlsZCA9IG5ldyBUZXN0SXRlbUltcGwoJ2N0cmxJZCcsICdpZC1hYycsICdjJywgdW5kZWZpbmVkKTtcblx0XHRcdGNoaWxkLnRhZ3MgPSBbdGFnMSwgdGFnMl07XG5cdFx0XHRzaW5nbGUucm9vdC5jaGlsZHJlbi5nZXQoJ2lkLWEnKSEuY2hpbGRyZW4uYWRkKGNoaWxkKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzaW5nbGUuY29sbGVjdERpZmYoKSwgW1xuXHRcdFx0XHR7IG9wOiBUZXN0RGlmZk9wVHlwZS5BZGRUYWcsIHRhZzogeyBpZDogJ2N0cmxJZFxcMHRhZzEnIH0gfSxcblx0XHRcdFx0eyBvcDogVGVzdERpZmZPcFR5cGUuQWRkVGFnLCB0YWc6IHsgaWQ6ICdjdHJsSWRcXDB0YWcyJyB9IH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRvcDogVGVzdERpZmZPcFR5cGUuQWRkLCBpdGVtOiB7XG5cdFx0XHRcdFx0XHRjb250cm9sbGVySWQ6ICdjdHJsSWQnLFxuXHRcdFx0XHRcdFx0ZXhwYW5kOiBUZXN0SXRlbUV4cGFuZFN0YXRlLk5vdEV4cGFuZGFibGUsXG5cdFx0XHRcdFx0XHRpdGVtOiBjb252ZXJ0LlRlc3RJdGVtLmZyb20oY2hpbGQpLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdF0pO1xuXG5cdFx0XHRjaGlsZC50YWdzID0gW3RhZzIsIHRhZzNdO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzaW5nbGUuY29sbGVjdERpZmYoKSwgW1xuXHRcdFx0XHR7IG9wOiBUZXN0RGlmZk9wVHlwZS5BZGRUYWcsIHRhZzogeyBpZDogJ2N0cmxJZFxcMHRhZzMnIH0gfSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG9wOiBUZXN0RGlmZk9wVHlwZS5VcGRhdGUsIGl0ZW06IHtcblx0XHRcdFx0XHRcdGV4dElkOiBuZXcgVGVzdElkKFsnY3RybElkJywgJ2lkLWEnLCAnaWQtYWMnXSkudG9TdHJpbmcoKSxcblx0XHRcdFx0XHRcdGl0ZW06IHsgdGFnczogWydjdHJsSWRcXDB0YWcyJywgJ2N0cmxJZFxcMHRhZzMnXSB9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7IG9wOiBUZXN0RGlmZk9wVHlwZS5SZW1vdmVUYWcsIGlkOiAnY3RybElkXFwwdGFnMScgfSxcblx0XHRcdF0pO1xuXG5cdFx0XHRjb25zdCBhID0gc2luZ2xlLnJvb3QuY2hpbGRyZW4uZ2V0KCdpZC1hJykhO1xuXHRcdFx0YS50YWdzID0gW3RhZzJdO1xuXHRcdFx0YS5jaGlsZHJlbi5yZXBsYWNlKFtdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2luZ2xlLmNvbGxlY3REaWZmKCkuZmlsdGVyKHQgPT4gdC5vcCA9PT0gVGVzdERpZmZPcFR5cGUuUmVtb3ZlVGFnKSwgW1xuXHRcdFx0XHR7IG9wOiBUZXN0RGlmZk9wVHlwZS5SZW1vdmVUYWcsIGlkOiAnY3RybElkXFwwdGFnMycgfSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncmVwbGFjZXMgb24gdXJpIGNoYW5nZScsICgpID0+IHtcblx0XHRcdHNpbmdsZS5leHBhbmQoc2luZ2xlLnJvb3QuaWQsIEluZmluaXR5KTtcblx0XHRcdHNpbmdsZS5jb2xsZWN0RGlmZigpO1xuXG5cdFx0XHRjb25zdCBvbGRBID0gc2luZ2xlLnJvb3QuY2hpbGRyZW4uZ2V0KCdpZC1hJykgYXMgVGVzdEl0ZW1JbXBsO1xuXHRcdFx0Y29uc3QgdXJpID0gc2luZ2xlLnJvb3QuY2hpbGRyZW4uZ2V0KCdpZC1hJykhLnVyaT8ud2l0aCh7IHBhdGg6ICcvZGlmZmVyZW50JyB9KTtcblx0XHRcdGNvbnN0IG5ld0EgPSBuZXcgVGVzdEl0ZW1JbXBsKCdjdHJsSWQnLCAnaWQtYScsICdIZWxsbyB3b3JsZCcsIHVyaSk7XG5cdFx0XHRuZXdBLmNoaWxkcmVuLnJlcGxhY2UoWy4uLm9sZEEuY2hpbGRyZW5dLm1hcCgoW18sIGl0ZW1dKSA9PiBpdGVtKSk7XG5cdFx0XHRzaW5nbGUucm9vdC5jaGlsZHJlbi5yZXBsYWNlKFsuLi5zaW5nbGUucm9vdC5jaGlsZHJlbl0ubWFwKChbaWQsIGldKSA9PiBpZCA9PT0gJ2lkLWEnID8gbmV3QSA6IGkpKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzaW5nbGUuY29sbGVjdERpZmYoKSwgW1xuXHRcdFx0XHR7IG9wOiBUZXN0RGlmZk9wVHlwZS5SZW1vdmUsIGl0ZW1JZDogbmV3IFRlc3RJZChbJ2N0cmxJZCcsICdpZC1hJ10pLnRvU3RyaW5nKCkgfSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG9wOiBUZXN0RGlmZk9wVHlwZS5BZGQsXG5cdFx0XHRcdFx0aXRlbTogeyBjb250cm9sbGVySWQ6ICdjdHJsSWQnLCBleHBhbmQ6IFRlc3RJdGVtRXhwYW5kU3RhdGUuTm90RXhwYW5kYWJsZSwgaXRlbTogeyAuLi5jb252ZXJ0LlRlc3RJdGVtLmZyb20obmV3QSkgfSB9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRvcDogVGVzdERpZmZPcFR5cGUuQWRkLFxuXHRcdFx0XHRcdGl0ZW06IHsgY29udHJvbGxlcklkOiAnY3RybElkJywgZXhwYW5kOiBUZXN0SXRlbUV4cGFuZFN0YXRlLk5vdEV4cGFuZGFibGUsIGl0ZW06IGNvbnZlcnQuVGVzdEl0ZW0uZnJvbShuZXdBLmNoaWxkcmVuLmdldCgnaWQtYWEnKSBhcyBUZXN0SXRlbUltcGwpIH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG9wOiBUZXN0RGlmZk9wVHlwZS5BZGQsXG5cdFx0XHRcdFx0aXRlbTogeyBjb250cm9sbGVySWQ6ICdjdHJsSWQnLCBleHBhbmQ6IFRlc3RJdGVtRXhwYW5kU3RhdGUuTm90RXhwYW5kYWJsZSwgaXRlbTogY29udmVydC5UZXN0SXRlbS5mcm9tKG5ld0EuY2hpbGRyZW4uZ2V0KCdpZC1hYicpIGFzIFRlc3RJdGVtSW1wbCkgfVxuXHRcdFx0XHR9LFxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCd0cmVhdHMgaW4tcGxhY2UgcmVwbGFjZW1lbnQgYXMgbXV0YXRpb24nLCAoKSA9PiB7XG5cdFx0XHRzaW5nbGUuZXhwYW5kKHNpbmdsZS5yb290LmlkLCBJbmZpbml0eSk7XG5cdFx0XHRzaW5nbGUuY29sbGVjdERpZmYoKTtcblxuXHRcdFx0Y29uc3Qgb2xkQSA9IHNpbmdsZS5yb290LmNoaWxkcmVuLmdldCgnaWQtYScpIGFzIFRlc3RJdGVtSW1wbDtcblx0XHRcdGNvbnN0IHVyaSA9IHNpbmdsZS5yb290LmNoaWxkcmVuLmdldCgnaWQtYScpIS51cmk7XG5cdFx0XHRjb25zdCBuZXdBID0gbmV3IFRlc3RJdGVtSW1wbCgnY3RybElkJywgJ2lkLWEnLCAnSGVsbG8gd29ybGQnLCB1cmkpO1xuXHRcdFx0bmV3QS5jaGlsZHJlbi5yZXBsYWNlKFsuLi5vbGRBLmNoaWxkcmVuXS5tYXAoKFtfLCBpdGVtXSkgPT4gaXRlbSkpO1xuXHRcdFx0c2luZ2xlLnJvb3QuY2hpbGRyZW4ucmVwbGFjZShbXG5cdFx0XHRcdG5ld0EsXG5cdFx0XHRcdG5ldyBUZXN0SXRlbUltcGwoJ2N0cmxJZCcsICdpZC1iJywgc2luZ2xlLnJvb3QuY2hpbGRyZW4uZ2V0KCdpZC1iJykhLmxhYmVsLCB1cmkpLFxuXHRcdFx0XSk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2luZ2xlLmNvbGxlY3REaWZmKCksIFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG9wOiBUZXN0RGlmZk9wVHlwZS5VcGRhdGUsXG5cdFx0XHRcdFx0aXRlbTogeyBleHRJZDogbmV3IFRlc3RJZChbJ2N0cmxJZCcsICdpZC1hJ10pLnRvU3RyaW5nKCksIGl0ZW06IHsgbGFiZWw6ICdIZWxsbyB3b3JsZCcgfSB9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0b3A6IFRlc3REaWZmT3BUeXBlLkRvY3VtZW50U3luY2VkLFxuXHRcdFx0XHRcdGRvY3Y6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHR1cmk6IHVyaVxuXHRcdFx0XHR9XG5cdFx0XHRdKTtcblxuXHRcdFx0bmV3QS5sYWJlbCA9ICdzdGlsbCBjb25uZWN0ZWQnO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzaW5nbGUuY29sbGVjdERpZmYoKSwgW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0b3A6IFRlc3REaWZmT3BUeXBlLlVwZGF0ZSxcblx0XHRcdFx0XHRpdGVtOiB7IGV4dElkOiBuZXcgVGVzdElkKFsnY3RybElkJywgJ2lkLWEnXSkudG9TdHJpbmcoKSwgaXRlbTogeyBsYWJlbDogJ3N0aWxsIGNvbm5lY3RlZCcgfSB9XG5cdFx0XHRcdH0sXG5cdFx0XHRdKTtcblxuXHRcdFx0b2xkQS5sYWJlbCA9ICdubyBsb25nZXIgY29ubmVjdGVkJztcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2luZ2xlLmNvbGxlY3REaWZmKCksIFtdKTtcblx0XHR9KTtcblxuXHRcdHN1aXRlKCdleHBhbmRpYmlsaXR5IHJlc3RvcmF0aW9uJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZG9SZXBsYWNlID0gYXN5bmMgKGNhblJlc29sdmVDaGlsZHJlbiA9IHRydWUpID0+IHtcblx0XHRcdFx0Y29uc3QgdXJpID0gc2luZ2xlLnJvb3QuY2hpbGRyZW4uZ2V0KCdpZC1hJykhLnVyaTtcblx0XHRcdFx0Y29uc3QgbmV3QSA9IG5ldyBUZXN0SXRlbUltcGwoJ2N0cmxJZCcsICdpZC1hJywgJ0hlbGxvIHdvcmxkJywgdXJpKTtcblx0XHRcdFx0bmV3QS5jYW5SZXNvbHZlQ2hpbGRyZW4gPSBjYW5SZXNvbHZlQ2hpbGRyZW47XG5cdFx0XHRcdHNpbmdsZS5yb290LmNoaWxkcmVuLnJlcGxhY2UoW1xuXHRcdFx0XHRcdG5ld0EsXG5cdFx0XHRcdFx0bmV3IFRlc3RJdGVtSW1wbCgnY3RybElkJywgJ2lkLWInLCBzaW5nbGUucm9vdC5jaGlsZHJlbi5nZXQoJ2lkLWInKSEubGFiZWwsIHVyaSksXG5cdFx0XHRcdF0pO1xuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDApOyAvLyBkcmFpbiBtaWNyb3Rhc2tzXG5cdFx0XHR9O1xuXG5cdFx0XHR0ZXN0KCdkb2VzIG5vdCByZXN0b3JlIGFuIHVuZXhwYW5kZWQgc3RhdGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGF3YWl0IHNpbmdsZS5leHBhbmQoc2luZ2xlLnJvb3QuaWQsIDApO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc29sdmVDYWxscywgW3VuZGVmaW5lZF0pO1xuXHRcdFx0XHRhd2FpdCBkb1JlcGxhY2UoKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXNvbHZlQ2FsbHMsIFt1bmRlZmluZWRdKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdyZXN0b3JlcyByZXNvbHZlIHN0YXRlIG9uIHJlcGxhY2VtZW50JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRhd2FpdCBzaW5nbGUuZXhwYW5kKHNpbmdsZS5yb290LmlkLCBJbmZpbml0eSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzb2x2ZUNhbGxzLCBbdW5kZWZpbmVkLCAnaWQtYSddKTtcblx0XHRcdFx0YXdhaXQgZG9SZXBsYWNlKCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzb2x2ZUNhbGxzLCBbdW5kZWZpbmVkLCAnaWQtYScsICdpZC1hJ10pO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2RvZXMgbm90IGV4cGFuZCBpZiBuZXcgY2hpbGQgaXMgbm90IGV4cGFuZGFibGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGF3YWl0IHNpbmdsZS5leHBhbmQoc2luZ2xlLnJvb3QuaWQsIEluZmluaXR5KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXNvbHZlQ2FsbHMsIFt1bmRlZmluZWQsICdpZC1hJ10pO1xuXHRcdFx0XHRhd2FpdCBkb1JlcGxhY2UoZmFsc2UpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlc29sdmVDYWxscywgW3VuZGVmaW5lZCwgJ2lkLWEnXSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3RyZWF0cyBpbi1wbGFjZSByZXBsYWNlbWVudCBhcyBtdXRhdGlvbiBkZWVwbHknLCAoKSA9PiB7XG5cdFx0XHRzaW5nbGUuZXhwYW5kKHNpbmdsZS5yb290LmlkLCBJbmZpbml0eSk7XG5cdFx0XHRzaW5nbGUuY29sbGVjdERpZmYoKTtcblxuXHRcdFx0Y29uc3Qgb2xkQSA9IHNpbmdsZS5yb290LmNoaWxkcmVuLmdldCgnaWQtYScpITtcblx0XHRcdGNvbnN0IHVyaSA9IG9sZEEudXJpO1xuXHRcdFx0Y29uc3QgbmV3QSA9IG5ldyBUZXN0SXRlbUltcGwoJ2N0cmxJZCcsICdpZC1hJywgc2luZ2xlLnJvb3QuY2hpbGRyZW4uZ2V0KCdpZC1hJykhLmxhYmVsLCB1cmkpO1xuXHRcdFx0Y29uc3Qgb2xkQUEgPSBvbGRBLmNoaWxkcmVuLmdldCgnaWQtYWEnKSE7XG5cdFx0XHRjb25zdCBvbGRBQiA9IG9sZEEuY2hpbGRyZW4uZ2V0KCdpZC1hYicpITtcblx0XHRcdGNvbnN0IG5ld0FCID0gbmV3IFRlc3RJdGVtSW1wbCgnY3RybElkJywgJ2lkLWFiJywgJ0hlbGxvIHdvcmxkJywgdXJpKTtcblx0XHRcdG5ld0EuY2hpbGRyZW4ucmVwbGFjZShbb2xkQUEsIG5ld0FCXSk7XG5cdFx0XHRzaW5nbGUucm9vdC5jaGlsZHJlbi5yZXBsYWNlKFtuZXdBLCBzaW5nbGUucm9vdC5jaGlsZHJlbi5nZXQoJ2lkLWInKSFdKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzaW5nbGUuY29sbGVjdERpZmYoKSwgW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0b3A6IFRlc3REaWZmT3BUeXBlLlVwZGF0ZSxcblx0XHRcdFx0XHRpdGVtOiB7IGV4dElkOiBUZXN0SWQuZnJvbUV4dEhvc3RUZXN0SXRlbShvbGRBQiwgJ2N0cmxJZCcpLnRvU3RyaW5nKCksIGl0ZW06IHsgbGFiZWw6ICdIZWxsbyB3b3JsZCcgfSB9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0b3A6IFRlc3REaWZmT3BUeXBlLkRvY3VtZW50U3luY2VkLFxuXHRcdFx0XHRcdGRvY3Y6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHR1cmk6IHVyaVxuXHRcdFx0XHR9XG5cdFx0XHRdKTtcblxuXHRcdFx0b2xkQUEubGFiZWwgPSAnc3RpbGwgY29ubmVjdGVkMSc7XG5cdFx0XHRuZXdBQi5sYWJlbCA9ICdzdGlsbCBjb25uZWN0ZWQyJztcblx0XHRcdG9sZEFCLmxhYmVsID0gJ25vdCBjb25uZWN0ZWQzJztcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2luZ2xlLmNvbGxlY3REaWZmKCksIFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG9wOiBUZXN0RGlmZk9wVHlwZS5VcGRhdGUsXG5cdFx0XHRcdFx0aXRlbTogeyBleHRJZDogbmV3IFRlc3RJZChbJ2N0cmxJZCcsICdpZC1hJywgJ2lkLWFhJ10pLnRvU3RyaW5nKCksIGl0ZW06IHsgbGFiZWw6ICdzdGlsbCBjb25uZWN0ZWQxJyB9IH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG9wOiBUZXN0RGlmZk9wVHlwZS5VcGRhdGUsXG5cdFx0XHRcdFx0aXRlbTogeyBleHRJZDogbmV3IFRlc3RJZChbJ2N0cmxJZCcsICdpZC1hJywgJ2lkLWFiJ10pLnRvU3RyaW5nKCksIGl0ZW06IHsgbGFiZWw6ICdzdGlsbCBjb25uZWN0ZWQyJyB9IH1cblx0XHRcdFx0fSxcblx0XHRcdF0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmV3QUIucGFyZW50LCBuZXdBKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChvbGRBQS5wYXJlbnQsIG5ld0EpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdBLnBhcmVudCwgdW5kZWZpbmVkKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ21vdmVzIGFuIGl0ZW0gdG8gYmUgYSBuZXcgY2hpbGQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCBzaW5nbGUuZXhwYW5kKHNpbmdsZS5yb290LmlkLCAwKTtcblx0XHRcdHNpbmdsZS5jb2xsZWN0RGlmZigpO1xuXHRcdFx0Y29uc3QgYiA9IHNpbmdsZS5yb290LmNoaWxkcmVuLmdldCgnaWQtYicpIGFzIFRlc3RJdGVtSW1wbDtcblx0XHRcdGNvbnN0IGEgPSBzaW5nbGUucm9vdC5jaGlsZHJlbi5nZXQoJ2lkLWEnKSBhcyBUZXN0SXRlbUltcGw7XG5cdFx0XHRhLmNoaWxkcmVuLmFkZChiKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2luZ2xlLmNvbGxlY3REaWZmKCksIFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG9wOiBUZXN0RGlmZk9wVHlwZS5SZW1vdmUsXG5cdFx0XHRcdFx0aXRlbUlkOiBuZXcgVGVzdElkKFsnY3RybElkJywgJ2lkLWInXSkudG9TdHJpbmcoKSxcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG9wOiBUZXN0RGlmZk9wVHlwZS5BZGQsXG5cdFx0XHRcdFx0aXRlbTogeyBjb250cm9sbGVySWQ6ICdjdHJsSWQnLCBleHBhbmQ6IFRlc3RJdGVtRXhwYW5kU3RhdGUuTm90RXhwYW5kYWJsZSwgaXRlbTogY29udmVydC5UZXN0SXRlbS5mcm9tKGIpIH1cblx0XHRcdFx0fSxcblx0XHRcdF0pO1xuXG5cdFx0XHRiLmxhYmVsID0gJ3N0aWxsIGNvbm5lY3RlZCc7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNpbmdsZS5jb2xsZWN0RGlmZigpLCBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRvcDogVGVzdERpZmZPcFR5cGUuVXBkYXRlLFxuXHRcdFx0XHRcdGl0ZW06IHsgZXh0SWQ6IG5ldyBUZXN0SWQoWydjdHJsSWQnLCAnaWQtYScsICdpZC1iJ10pLnRvU3RyaW5nKCksIGl0ZW06IHsgbGFiZWw6ICdzdGlsbCBjb25uZWN0ZWQnIH0gfVxuXHRcdFx0XHR9LFxuXHRcdFx0XSk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoWy4uLnNpbmdsZS5yb290LmNoaWxkcmVuXS5tYXAoKFtfLCBpdGVtXSkgPT4gaXRlbSksIFtzaW5nbGUucm9vdC5jaGlsZHJlbi5nZXQoJ2lkLWEnKV0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChiLnBhcmVudCwgYSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzZW5kcyBkb2N1bWVudCBzeW5jIGV2ZW50cycsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHNpbmdsZS5leHBhbmQoc2luZ2xlLnJvb3QuaWQsIDApO1xuXHRcdFx0c2luZ2xlLmNvbGxlY3REaWZmKCk7XG5cblx0XHRcdGNvbnN0IGEgPSBzaW5nbGUucm9vdC5jaGlsZHJlbi5nZXQoJ2lkLWEnKSBhcyBUZXN0SXRlbUltcGw7XG5cdFx0XHRhLnJhbmdlID0gbmV3IFJhbmdlKG5ldyBQb3NpdGlvbigwLCAwKSwgbmV3IFBvc2l0aW9uKDEsIDApKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzaW5nbGUuY29sbGVjdERpZmYoKSwgW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0b3A6IFRlc3REaWZmT3BUeXBlLkRvY3VtZW50U3luY2VkLFxuXHRcdFx0XHRcdGRvY3Y6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHR1cmk6IFVSSS5maWxlKCcvJylcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG9wOiBUZXN0RGlmZk9wVHlwZS5VcGRhdGUsXG5cdFx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdFx0ZXh0SWQ6IG5ldyBUZXN0SWQoWydjdHJsSWQnLCAnaWQtYSddKS50b1N0cmluZygpLFxuXHRcdFx0XHRcdFx0aXRlbToge1xuXHRcdFx0XHRcdFx0XHRyYW5nZTogZWRpdG9yUmFuZ2UuUmFuZ2UubGlmdCh7XG5cdFx0XHRcdFx0XHRcdFx0ZW5kQ29sdW1uOiAxLFxuXHRcdFx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IDIsXG5cdFx0XHRcdFx0XHRcdFx0c3RhcnRDb2x1bW46IDEsXG5cdFx0XHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxXG5cdFx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSxcblx0XHRcdF0pO1xuXG5cdFx0XHQvLyBzZW5kcyBvbiByZXBsYWNlIGV2ZW4gaWYgaXQncyBhIG5vLW9wXG5cdFx0XHRhLnJhbmdlID0gYS5yYW5nZTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2luZ2xlLmNvbGxlY3REaWZmKCksIFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG9wOiBUZXN0RGlmZk9wVHlwZS5Eb2N1bWVudFN5bmNlZCxcblx0XHRcdFx0XHRkb2N2OiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0dXJpOiBVUkkuZmlsZSgnLycpXG5cdFx0XHRcdH0sXG5cdFx0XHRdKTtcblxuXHRcdFx0Ly8gc2VuZHMgb24gYSBjaGlsZCByZXBsYWNlbWVudFxuXHRcdFx0Y29uc3QgdXJpID0gVVJJLmZpbGUoJy8nKTtcblx0XHRcdGNvbnN0IGEyID0gbmV3IFRlc3RJdGVtSW1wbCgnY3RybElkJywgJ2lkLWEnLCAnYScsIHVyaSk7XG5cdFx0XHRhMi5yYW5nZSA9IGEucmFuZ2U7XG5cdFx0XHRzaW5nbGUucm9vdC5jaGlsZHJlbi5yZXBsYWNlKFthMiwgc2luZ2xlLnJvb3QuY2hpbGRyZW4uZ2V0KCdpZC1iJykhXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNpbmdsZS5jb2xsZWN0RGlmZigpLCBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRvcDogVGVzdERpZmZPcFR5cGUuRG9jdW1lbnRTeW5jZWQsXG5cdFx0XHRcdFx0ZG9jdjogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdHVyaVxuXHRcdFx0XHR9LFxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cblx0c3VpdGUoJ01pcnJvcmVkVGVzdENvbGxlY3Rpb24nLCAoKSA9PiB7XG5cdFx0Ly8gdG9kb0Bjb25ub3I0MzEyOiByZS1yZW5hYmxlIHdoZW4gd2UgZmlndXJlIG91dCB3aGF0IG9ic2VydmluZyBsb29rcyBsaWtlIHdlIGFzeW5jIGNoaWxkcmVuXG5cdFx0Ly8gXHRsZXQgbTogVGVzdE1pcnJvcmVkQ29sbGVjdGlvbjtcblx0XHQvLyBcdHNldHVwKCgpID0+IG0gPSBuZXcgVGVzdE1pcnJvcmVkQ29sbGVjdGlvbigpKTtcblxuXHRcdC8vIFx0dGVzdCgnbWlycm9ycyBjcmVhdGlvbiBvZiB0aGUgcm9vdCcsICgpID0+IHtcblx0XHQvLyBcdFx0Y29uc3QgdGVzdHMgPSB0ZXN0U3R1YnMubmVzdGVkKCk7XG5cdFx0Ly8gXHRcdHNpbmdsZS5hZGRSb290KHRlc3RzLCAncGlkJyk7XG5cdFx0Ly8gXHRcdHNpbmdsZS5leHBhbmQoc2luZ2xlLnJvb3QuaWQsIEluZmluaXR5KTtcblx0XHQvLyBcdFx0bS5hcHBseShzaW5nbGUuY29sbGVjdERpZmYoKSk7XG5cdFx0Ly8gXHRcdGFzc2VydFRyZWVzRXF1YWwobS5yb290VGVzdEl0ZW1zWzBdLCBvd25lZC5nZXRUZXN0QnlJZChzaW5nbGUucm9vdC5pZCkhWzFdLmFjdHVhbCk7XG5cdFx0Ly8gXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtLmxlbmd0aCwgc2luZ2xlLml0ZW1Ub0ludGVybmFsLnNpemUpO1xuXHRcdC8vIFx0fSk7XG5cblx0XHQvLyBcdHRlc3QoJ21pcnJvcnMgbm9kZSBkZWxldGlvbicsICgpID0+IHtcblx0XHQvLyBcdFx0Y29uc3QgdGVzdHMgPSB0ZXN0U3R1YnMubmVzdGVkKCk7XG5cdFx0Ly8gXHRcdHNpbmdsZS5hZGRSb290KHRlc3RzLCAncGlkJyk7XG5cdFx0Ly8gXHRcdG0uYXBwbHkoc2luZ2xlLmNvbGxlY3REaWZmKCkpO1xuXHRcdC8vIFx0XHRzaW5nbGUuZXhwYW5kKHNpbmdsZS5yb290LmlkLCBJbmZpbml0eSk7XG5cdFx0Ly8gXHRcdHRlc3RzLmNoaWxkcmVuIS5zcGxpY2UoMCwgMSk7XG5cdFx0Ly8gXHRcdHNpbmdsZS5vbkl0ZW1DaGFuZ2UodGVzdHMsICdwaWQnKTtcblx0XHQvLyBcdFx0c2luZ2xlLmV4cGFuZChzaW5nbGUucm9vdC5pZCwgSW5maW5pdHkpO1xuXHRcdC8vIFx0XHRtLmFwcGx5KHNpbmdsZS5jb2xsZWN0RGlmZigpKTtcblxuXHRcdC8vIFx0XHRhc3NlcnRUcmVlc0VxdWFsKG0ucm9vdFRlc3RJdGVtc1swXSwgb3duZWQuZ2V0VGVzdEJ5SWQoc2luZ2xlLnJvb3QuaWQpIVsxXS5hY3R1YWwpO1xuXHRcdC8vIFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobS5sZW5ndGgsIHNpbmdsZS5pdGVtVG9JbnRlcm5hbC5zaXplKTtcblx0XHQvLyBcdH0pO1xuXG5cdFx0Ly8gXHR0ZXN0KCdtaXJyb3JzIG5vZGUgYWRkaXRpb24nLCAoKSA9PiB7XG5cdFx0Ly8gXHRcdGNvbnN0IHRlc3RzID0gdGVzdFN0dWJzLm5lc3RlZCgpO1xuXHRcdC8vIFx0XHRzaW5nbGUuYWRkUm9vdCh0ZXN0cywgJ3BpZCcpO1xuXHRcdC8vIFx0XHRtLmFwcGx5KHNpbmdsZS5jb2xsZWN0RGlmZigpKTtcblx0XHQvLyBcdFx0dGVzdHMuY2hpbGRyZW4hWzBdLmNoaWxkcmVuIS5wdXNoKHN0dWJUZXN0KCdhYycpKTtcblx0XHQvLyBcdFx0c2luZ2xlLm9uSXRlbUNoYW5nZSh0ZXN0cywgJ3BpZCcpO1xuXHRcdC8vIFx0XHRtLmFwcGx5KHNpbmdsZS5jb2xsZWN0RGlmZigpKTtcblxuXHRcdC8vIFx0XHRhc3NlcnRUcmVlc0VxdWFsKG0ucm9vdFRlc3RJdGVtc1swXSwgb3duZWQuZ2V0VGVzdEJ5SWQoc2luZ2xlLnJvb3QuaWQpIVsxXS5hY3R1YWwpO1xuXHRcdC8vIFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobS5sZW5ndGgsIHNpbmdsZS5pdGVtVG9JbnRlcm5hbC5zaXplKTtcblx0XHQvLyBcdH0pO1xuXG5cdFx0Ly8gXHR0ZXN0KCdtaXJyb3JzIG5vZGUgdXBkYXRlJywgKCkgPT4ge1xuXHRcdC8vIFx0XHRjb25zdCB0ZXN0cyA9IHRlc3RTdHVicy5uZXN0ZWQoKTtcblx0XHQvLyBcdFx0c2luZ2xlLmFkZFJvb3QodGVzdHMsICdwaWQnKTtcblx0XHQvLyBcdFx0bS5hcHBseShzaW5nbGUuY29sbGVjdERpZmYoKSk7XG5cdFx0Ly8gXHRcdHRlc3RzLmNoaWxkcmVuIVswXS5kZXNjcmlwdGlvbiA9ICdIZWxsbyB3b3JsZCc7IC8qIGl0ZW0gYSAqL1xuXHRcdC8vIFx0XHRzaW5nbGUub25JdGVtQ2hhbmdlKHRlc3RzLCAncGlkJyk7XG5cdFx0Ly8gXHRcdG0uYXBwbHkoc2luZ2xlLmNvbGxlY3REaWZmKCkpO1xuXG5cdFx0Ly8gXHRcdGFzc2VydFRyZWVzRXF1YWwobS5yb290VGVzdEl0ZW1zWzBdLCBvd25lZC5nZXRUZXN0QnlJZChzaW5nbGUucm9vdC5pZCkhWzFdLmFjdHVhbCk7XG5cdFx0Ly8gXHR9KTtcblxuXHRcdC8vIFx0c3VpdGUoJ01pcnJvcmVkQ2hhbmdlQ29sbGVjdG9yJywgKCkgPT4ge1xuXHRcdC8vIFx0XHRsZXQgdGVzdHMgPSB0ZXN0U3R1YnMubmVzdGVkKCk7XG5cdFx0Ly8gXHRcdHNldHVwKCgpID0+IHtcblx0XHQvLyBcdFx0XHR0ZXN0cyA9IHRlc3RTdHVicy5uZXN0ZWQoKTtcblx0XHQvLyBcdFx0XHRzaW5nbGUuYWRkUm9vdCh0ZXN0cywgJ3BpZCcpO1xuXHRcdC8vIFx0XHRcdG0uYXBwbHkoc2luZ2xlLmNvbGxlY3REaWZmKCkpO1xuXHRcdC8vIFx0XHR9KTtcblxuXHRcdC8vIFx0XHR0ZXN0KCdjcmVhdGVzIGNoYW5nZSBmb3Igcm9vdCcsICgpID0+IHtcblx0XHQvLyBcdFx0XHRhc3NlcnRUcmVlTGlzdEVxdWFsKG0uY2hhbmdlRXZlbnQuYWRkZWQsIFtcblx0XHQvLyBcdFx0XHRcdHRlc3RzLFxuXHRcdC8vIFx0XHRcdFx0dGVzdHMuY2hpbGRyZW5bMF0sXG5cdFx0Ly8gXHRcdFx0XHR0ZXN0cy5jaGlsZHJlbiFbMF0uY2hpbGRyZW4hWzBdLFxuXHRcdC8vIFx0XHRcdFx0dGVzdHMuY2hpbGRyZW4hWzBdLmNoaWxkcmVuIVsxXSxcblx0XHQvLyBcdFx0XHRcdHRlc3RzLmNoaWxkcmVuWzFdLFxuXHRcdC8vIFx0XHRcdF0pO1xuXHRcdC8vIFx0XHRcdGFzc2VydFRyZWVMaXN0RXF1YWwobS5jaGFuZ2VFdmVudC5yZW1vdmVkLCBbXSk7XG5cdFx0Ly8gXHRcdFx0YXNzZXJ0VHJlZUxpc3RFcXVhbChtLmNoYW5nZUV2ZW50LnVwZGF0ZWQsIFtdKTtcblx0XHQvLyBcdFx0fSk7XG5cblx0XHQvLyBcdFx0dGVzdCgnY3JlYXRlcyBjaGFuZ2UgZm9yIGRlbGV0ZScsICgpID0+IHtcblx0XHQvLyBcdFx0XHRjb25zdCBybSA9IHRlc3RzLmNoaWxkcmVuLnNoaWZ0KCkhO1xuXHRcdC8vIFx0XHRcdHNpbmdsZS5vbkl0ZW1DaGFuZ2UodGVzdHMsICdwaWQnKTtcblx0XHQvLyBcdFx0XHRtLmFwcGx5KHNpbmdsZS5jb2xsZWN0RGlmZigpKTtcblxuXHRcdC8vIFx0XHRcdGFzc2VydFRyZWVMaXN0RXF1YWwobS5jaGFuZ2VFdmVudC5hZGRlZCwgW10pO1xuXHRcdC8vIFx0XHRcdGFzc2VydFRyZWVMaXN0RXF1YWwobS5jaGFuZ2VFdmVudC5yZW1vdmVkLCBbXG5cdFx0Ly8gXHRcdFx0XHR7IC4uLnJtIH0sXG5cdFx0Ly8gXHRcdFx0XHR7IC4uLnJtLmNoaWxkcmVuIVswXSB9LFxuXHRcdC8vIFx0XHRcdFx0eyAuLi5ybS5jaGlsZHJlbiFbMV0gfSxcblx0XHQvLyBcdFx0XHRdKTtcblx0XHQvLyBcdFx0XHRhc3NlcnRUcmVlTGlzdEVxdWFsKG0uY2hhbmdlRXZlbnQudXBkYXRlZCwgW10pO1xuXHRcdC8vIFx0XHR9KTtcblxuXHRcdC8vIFx0XHR0ZXN0KCdjcmVhdGVzIGNoYW5nZSBmb3IgdXBkYXRlJywgKCkgPT4ge1xuXHRcdC8vIFx0XHRcdHRlc3RzLmNoaWxkcmVuWzBdLmxhYmVsID0gJ3VwZGF0ZWQhJztcblx0XHQvLyBcdFx0XHRzaW5nbGUub25JdGVtQ2hhbmdlKHRlc3RzLCAncGlkJyk7XG5cdFx0Ly8gXHRcdFx0bS5hcHBseShzaW5nbGUuY29sbGVjdERpZmYoKSk7XG5cblx0XHQvLyBcdFx0XHRhc3NlcnRUcmVlTGlzdEVxdWFsKG0uY2hhbmdlRXZlbnQuYWRkZWQsIFtdKTtcblx0XHQvLyBcdFx0XHRhc3NlcnRUcmVlTGlzdEVxdWFsKG0uY2hhbmdlRXZlbnQucmVtb3ZlZCwgW10pO1xuXHRcdC8vIFx0XHRcdGFzc2VydFRyZWVMaXN0RXF1YWwobS5jaGFuZ2VFdmVudC51cGRhdGVkLCBbdGVzdHMuY2hpbGRyZW5bMF1dKTtcblx0XHQvLyBcdFx0fSk7XG5cblx0XHQvLyBcdFx0dGVzdCgnaXMgYSBuby1vcCBpZiBhIG5vZGUgaXMgYWRkZWQgYW5kIHJlbW92ZWQnLCAoKSA9PiB7XG5cdFx0Ly8gXHRcdFx0Y29uc3QgbmVzdGVkID0gdGVzdFN0dWJzLm5lc3RlZCgnaWQyLScpO1xuXHRcdC8vIFx0XHRcdHRlc3RzLmNoaWxkcmVuLnB1c2gobmVzdGVkKTtcblx0XHQvLyBcdFx0XHRzaW5nbGUub25JdGVtQ2hhbmdlKHRlc3RzLCAncGlkJyk7XG5cdFx0Ly8gXHRcdFx0dGVzdHMuY2hpbGRyZW4ucG9wKCk7XG5cdFx0Ly8gXHRcdFx0c2luZ2xlLm9uSXRlbUNoYW5nZSh0ZXN0cywgJ3BpZCcpO1xuXHRcdC8vIFx0XHRcdGNvbnN0IHByZXZpb3VzRXZlbnQgPSBtLmNoYW5nZUV2ZW50O1xuXHRcdC8vIFx0XHRcdG0uYXBwbHkoc2luZ2xlLmNvbGxlY3REaWZmKCkpO1xuXHRcdC8vIFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtLmNoYW5nZUV2ZW50LCBwcmV2aW91c0V2ZW50KTtcblx0XHQvLyBcdFx0fSk7XG5cblx0XHQvLyBcdFx0dGVzdCgnaXMgYSBzaW5nbGUtb3AgaWYgYSBub2RlIGlzIGFkZGVkIGFuZCBjaGFuZ2VkJywgKCkgPT4ge1xuXHRcdC8vIFx0XHRcdGNvbnN0IGNoaWxkID0gc3R1YlRlc3QoJ2MnKTtcblx0XHQvLyBcdFx0XHR0ZXN0cy5jaGlsZHJlbi5wdXNoKGNoaWxkKTtcblx0XHQvLyBcdFx0XHRzaW5nbGUub25JdGVtQ2hhbmdlKHRlc3RzLCAncGlkJyk7XG5cdFx0Ly8gXHRcdFx0Y2hpbGQubGFiZWwgPSAnZCc7XG5cdFx0Ly8gXHRcdFx0c2luZ2xlLm9uSXRlbUNoYW5nZSh0ZXN0cywgJ3BpZCcpO1xuXHRcdC8vIFx0XHRcdG0uYXBwbHkoc2luZ2xlLmNvbGxlY3REaWZmKCkpO1xuXG5cdFx0Ly8gXHRcdFx0YXNzZXJ0VHJlZUxpc3RFcXVhbChtLmNoYW5nZUV2ZW50LmFkZGVkLCBbY2hpbGRdKTtcblx0XHQvLyBcdFx0XHRhc3NlcnRUcmVlTGlzdEVxdWFsKG0uY2hhbmdlRXZlbnQucmVtb3ZlZCwgW10pO1xuXHRcdC8vIFx0XHRcdGFzc2VydFRyZWVMaXN0RXF1YWwobS5jaGFuZ2VFdmVudC51cGRhdGVkLCBbXSk7XG5cdFx0Ly8gXHRcdH0pO1xuXG5cdFx0Ly8gXHRcdHRlc3QoJ2dldHMgdGhlIGNvbW1vbiBhbmNlc3RvciAoMSknLCAoKSA9PiB7XG5cdFx0Ly8gXHRcdFx0dGVzdHMuY2hpbGRyZW4hWzBdLmNoaWxkcmVuIVswXS5sYWJlbCA9ICd6YSc7XG5cdFx0Ly8gXHRcdFx0dGVzdHMuY2hpbGRyZW4hWzBdLmNoaWxkcmVuIVsxXS5sYWJlbCA9ICd6Yic7XG5cdFx0Ly8gXHRcdFx0c2luZ2xlLm9uSXRlbUNoYW5nZSh0ZXN0cywgJ3BpZCcpO1xuXHRcdC8vIFx0XHRcdG0uYXBwbHkoc2luZ2xlLmNvbGxlY3REaWZmKCkpO1xuXG5cdFx0Ly8gXHRcdH0pO1xuXG5cdFx0Ly8gXHRcdHRlc3QoJ2dldHMgdGhlIGNvbW1vbiBhbmNlc3RvciAoMiknLCAoKSA9PiB7XG5cdFx0Ly8gXHRcdFx0dGVzdHMuY2hpbGRyZW4hWzBdLmNoaWxkcmVuIVswXS5sYWJlbCA9ICd6YSc7XG5cdFx0Ly8gXHRcdFx0dGVzdHMuY2hpbGRyZW4hWzFdLmxhYmVsID0gJ2FiJztcblx0XHQvLyBcdFx0XHRzaW5nbGUub25JdGVtQ2hhbmdlKHRlc3RzLCAncGlkJyk7XG5cdFx0Ly8gXHRcdFx0bS5hcHBseShzaW5nbGUuY29sbGVjdERpZmYoKSk7XG5cdFx0Ly8gXHRcdH0pO1xuXHRcdC8vIFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdUZXN0UnVuVHJhY2tlcicsICgpID0+IHtcblx0XHRsZXQgcHJveHk6IE1vY2tPYmplY3Q8TWFpblRocmVhZFRlc3RpbmdTaGFwZT47XG5cdFx0bGV0IGM6IFRlc3RSdW5Db29yZGluYXRvcjtcblx0XHRsZXQgY3RzOiBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZTtcblx0XHRsZXQgY29uZmlndXJhdGlvbjogVGVzdFJ1blByb2ZpbGVJbXBsO1xuXG5cdFx0bGV0IHJlcTogVGVzdFJ1blJlcXVlc3Q7XG5cblx0XHRsZXQgZHRvOiBUZXN0UnVuRHRvO1xuXHRcdGNvbnN0IGV4dDogSUV4dGVuc2lvbkRlc2NyaXB0aW9uID0ge30gYXMgYW55O1xuXG5cdFx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCB7IGlkIH0gb2YgYy50cmFja2Vycykge1xuXHRcdFx0XHRjLmRpc3Bvc2VUZXN0UnVuKGlkKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHNldHVwKGFzeW5jICgpID0+IHtcblx0XHRcdHByb3h5ID0gbW9ja09iamVjdDxNYWluVGhyZWFkVGVzdGluZ1NoYXBlPigpKCk7XG5cdFx0XHRjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRcdGMgPSBuZXcgVGVzdFJ1bkNvb3JkaW5hdG9yKHByb3h5LCBuZXcgTnVsbExvZ1NlcnZpY2UoKSk7XG5cblx0XHRcdGNvbmZpZ3VyYXRpb24gPSBuZXcgVGVzdFJ1blByb2ZpbGVJbXBsKG1vY2tPYmplY3Q8TWFpblRocmVhZFRlc3RpbmdTaGFwZT4oKSgpLCBuZXcgTWFwKCksIG5ldyBTZXQoKSwgRXZlbnQuTm9uZSwgJ2N0cmxJZCcsIDQyLCAnRG8gUnVuJywgVGVzdFJ1blByb2ZpbGVLaW5kLlJ1biwgKCkgPT4geyB9LCBmYWxzZSk7XG5cblx0XHRcdGF3YWl0IHNpbmdsZS5leHBhbmQoc2luZ2xlLnJvb3QuaWQsIEluZmluaXR5KTtcblx0XHRcdHNpbmdsZS5jb2xsZWN0RGlmZigpO1xuXG5cdFx0XHRyZXEgPSB7XG5cdFx0XHRcdGluY2x1ZGU6IHVuZGVmaW5lZCxcblx0XHRcdFx0ZXhjbHVkZTogW3NpbmdsZS5yb290LmNoaWxkcmVuLmdldCgnaWQtYicpIV0sXG5cdFx0XHRcdHByb2ZpbGU6IGNvbmZpZ3VyYXRpb24sXG5cdFx0XHRcdHByZXNlcnZlRm9jdXM6IGZhbHNlLFxuXHRcdFx0fTtcblxuXHRcdFx0ZHRvID0gVGVzdFJ1bkR0by5mcm9tSW50ZXJuYWwoe1xuXHRcdFx0XHRjb250cm9sbGVySWQ6ICdjdHJsJyxcblx0XHRcdFx0cHJvZmlsZUlkOiBjb25maWd1cmF0aW9uLnByb2ZpbGVJZCxcblx0XHRcdFx0ZXhjbHVkZUV4dElkczogWydpZC1iJ10sXG5cdFx0XHRcdHJ1bklkOiAncnVuLWlkJyxcblx0XHRcdFx0dGVzdElkczogW3NpbmdsZS5yb290LmlkXSxcblx0XHRcdH0sIHNpbmdsZSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCd0cmFja3MgYSBydW4gc3RhcnRlZCBmcm9tIGEgbWFpbiB0aHJlYWQgcmVxdWVzdCcsICgpID0+IHtcblx0XHRcdGNvbnN0IHRyYWNrZXIgPSBkcy5hZGQoYy5wcmVwYXJlRm9yTWFpblRocmVhZFRlc3RSdW4oZXh0LCByZXEsIGR0bywgY29uZmlndXJhdGlvbiwgY3RzLnRva2VuKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJhY2tlci5oYXNSdW5uaW5nVGFza3MsIGZhbHNlKTtcblxuXHRcdFx0Y29uc3QgdGFzazEgPSBjLmNyZWF0ZVRlc3RSdW4oZXh0LCAnY3RybCcsIHNpbmdsZSwgcmVxLCAncnVuMScsIHRydWUpO1xuXHRcdFx0Y29uc3QgdGFzazIgPSBjLmNyZWF0ZVRlc3RSdW4oZXh0LCAnY3RybCcsIHNpbmdsZSwgcmVxLCAncnVuMicsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHByb3h5LiRzdGFydGVkRXh0ZW5zaW9uVGVzdFJ1bi5jYWxsZWQsIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmFja2VyLmhhc1J1bm5pbmdUYXNrcywgdHJ1ZSk7XG5cblx0XHRcdHRhc2sxLmFwcGVuZE91dHB1dCgnaGVsbG8nKTtcblx0XHRcdGNvbnN0IHRhc2tJZCA9IHByb3h5LiRhcHBlbmRPdXRwdXRUb1J1bi5hcmdzWzBdPy5bMV07XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFtbJ3J1bi1pZCcsIHRhc2tJZCwgVlNCdWZmZXIuZnJvbVN0cmluZygnaGVsbG8nKSwgdW5kZWZpbmVkLCB1bmRlZmluZWRdXSwgcHJveHkuJGFwcGVuZE91dHB1dFRvUnVuLmFyZ3MpO1xuXHRcdFx0dGFzazEuZW5kKCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwcm94eS4kZmluaXNoZWRFeHRlbnNpb25UZXN0UnVuLmNhbGxlZCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWNrZXIuaGFzUnVubmluZ1Rhc2tzLCB0cnVlKTtcblxuXHRcdFx0dGFzazIuZW5kKCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwcm94eS4kZmluaXNoZWRFeHRlbnNpb25UZXN0UnVuLmNhbGxlZCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWNrZXIuaGFzUnVubmluZ1Rhc2tzLCBmYWxzZSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdydW4gY2FuY2VsIGZvcmNlIGVuZHMgYWZ0ZXIgYSB0aW1lb3V0JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgY2xvY2sgPSBzaW5vbi51c2VGYWtlVGltZXJzKCk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCB0cmFja2VyID0gZHMuYWRkKGMucHJlcGFyZUZvck1haW5UaHJlYWRUZXN0UnVuKGV4dCwgcmVxLCBkdG8sIGNvbmZpZ3VyYXRpb24sIGN0cy50b2tlbikpO1xuXHRcdFx0XHRjb25zdCB0YXNrID0gYy5jcmVhdGVUZXN0UnVuKGV4dCwgJ2N0cmwnLCBzaW5nbGUsIHJlcSwgJ3J1bjEnLCB0cnVlKTtcblx0XHRcdFx0Y29uc3Qgb25FbmRlZCA9IHNpbm9uLnN0dWIoKTtcblx0XHRcdFx0ZHMuYWRkKHRyYWNrZXIub25FbmQob25FbmRlZCkpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0YXNrLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkLCBmYWxzZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmFja2VyLmhhc1J1bm5pbmdUYXNrcywgdHJ1ZSk7XG5cdFx0XHRcdHRyYWNrZXIuY2FuY2VsKCk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhc2sudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQsIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJhY2tlci5oYXNSdW5uaW5nVGFza3MsIHRydWUpO1xuXG5cdFx0XHRcdGNsb2NrLnRpY2soOTk5OSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmFja2VyLmhhc1J1bm5pbmdUYXNrcywgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChvbkVuZGVkLmNhbGxlZCwgZmFsc2UpO1xuXG5cdFx0XHRcdGNsb2NrLnRpY2soMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChvbkVuZGVkLmNhbGxlZCwgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmFja2VyLmhhc1J1bm5pbmdUYXNrcywgZmFsc2UpO1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0Y2xvY2sucmVzdG9yZSgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGVzdCgncnVuIGNhbmNlbCBmb3JjZSBlbmRzIG9uIHNlY29uZCBjYW5jZWxsYXRpb24gcmVxdWVzdCcsICgpID0+IHtcblx0XHRcdGNvbnN0IHRyYWNrZXIgPSBkcy5hZGQoYy5wcmVwYXJlRm9yTWFpblRocmVhZFRlc3RSdW4oZXh0LCByZXEsIGR0bywgY29uZmlndXJhdGlvbiwgY3RzLnRva2VuKSk7XG5cdFx0XHRjb25zdCB0YXNrID0gYy5jcmVhdGVUZXN0UnVuKGV4dCwgJ2N0cmwnLCBzaW5nbGUsIHJlcSwgJ3J1bjEnLCB0cnVlKTtcblx0XHRcdGNvbnN0IG9uRW5kZWQgPSBzaW5vbi5zdHViKCk7XG5cdFx0XHRkcy5hZGQodHJhY2tlci5vbkVuZChvbkVuZGVkKSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0YXNrLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJhY2tlci5oYXNSdW5uaW5nVGFza3MsIHRydWUpO1xuXHRcdFx0dHJhY2tlci5jYW5jZWwoKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhc2sudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWNrZXIuaGFzUnVubmluZ1Rhc2tzLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChvbkVuZGVkLmNhbGxlZCwgZmFsc2UpO1xuXHRcdFx0dHJhY2tlci5jYW5jZWwoKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWNrZXIuaGFzUnVubmluZ1Rhc2tzLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob25FbmRlZC5jYWxsZWQsIHRydWUpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgndHJhY2tzIGEgcnVuIHN0YXJ0ZWQgZnJvbSBhbiBleHRlbnNpb24gcmVxdWVzdCcsICgpID0+IHtcblx0XHRcdGNvbnN0IHRhc2sxID0gYy5jcmVhdGVUZXN0UnVuKGV4dCwgJ2N0cmwnLCBzaW5nbGUsIHJlcSwgJ2hlbGxvIHdvcmxkJywgZmFsc2UpO1xuXG5cdFx0XHRjb25zdCB0cmFja2VyID0gSXRlcmFibGUuZmlyc3QoYy50cmFja2VycykhO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWNrZXIuaGFzUnVubmluZ1Rhc2tzLCB0cnVlKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocHJveHkuJHN0YXJ0ZWRFeHRlbnNpb25UZXN0UnVuLmFyZ3MsIFtcblx0XHRcdFx0W3tcblx0XHRcdFx0XHRwcm9maWxlOiB7IGdyb3VwOiAyLCBpZDogNDIgfSxcblx0XHRcdFx0XHRjb250cm9sbGVySWQ6ICdjdHJsJyxcblx0XHRcdFx0XHRpZDogdHJhY2tlci5pZCxcblx0XHRcdFx0XHRpbmNsdWRlOiBbc2luZ2xlLnJvb3QuaWRdLFxuXHRcdFx0XHRcdGV4Y2x1ZGU6IFtuZXcgVGVzdElkKFsnY3RybElkJywgJ2lkLWInXSkudG9TdHJpbmcoKV0sXG5cdFx0XHRcdFx0cGVyc2lzdDogZmFsc2UsXG5cdFx0XHRcdFx0Y29udGludW91czogZmFsc2UsXG5cdFx0XHRcdFx0cHJlc2VydmVGb2N1czogZmFsc2UsXG5cdFx0XHRcdH1dXG5cdFx0XHRdKTtcblxuXHRcdFx0Y29uc3QgdGFzazIgPSBjLmNyZWF0ZVRlc3RSdW4oZXh0LCAnY3RybCcsIHNpbmdsZSwgcmVxLCAncnVuMicsIHRydWUpO1xuXHRcdFx0Y29uc3QgdGFzazNEZXRhY2hlZCA9IGMuY3JlYXRlVGVzdFJ1bihleHQsICdjdHJsJywgc2luZ2xlLCB7IC4uLnJlcSB9LCAndGFzazNEZXRhY2hlZCcsIHRydWUpO1xuXG5cdFx0XHR0YXNrMS5lbmQoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwcm94eS4kZmluaXNoZWRFeHRlbnNpb25UZXN0UnVuLmNhbGxlZCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWNrZXIuaGFzUnVubmluZ1Rhc2tzLCB0cnVlKTtcblxuXHRcdFx0dGFzazIuZW5kKCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHByb3h5LiRmaW5pc2hlZEV4dGVuc2lvblRlc3RSdW4uYXJncywgW1t0cmFja2VyLmlkXV0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWNrZXIuaGFzUnVubmluZ1Rhc2tzLCBmYWxzZSk7XG5cblx0XHRcdHRhc2szRGV0YWNoZWQuZW5kKCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdhZGRzIHRlc3RzIHRvIHJ1biBzbWFydGx5JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGFzazEgPSBjLmNyZWF0ZVRlc3RSdW4oZXh0LCAnY3RybElkJywgc2luZ2xlLCByZXEsICdoZWxsbyB3b3JsZCcsIGZhbHNlKTtcblx0XHRcdGNvbnN0IHRyYWNrZXIgPSBJdGVyYWJsZS5maXJzdChjLnRyYWNrZXJzKSE7XG5cdFx0XHRjb25zdCBleHBlY3RlZEFyZ3M6IHVua25vd25bXVtdID0gW107XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHByb3h5LiRhZGRUZXN0c1RvUnVuLmFyZ3MsIGV4cGVjdGVkQXJncyk7XG5cblx0XHRcdHRhc2sxLnBhc3NlZChzaW5nbGUucm9vdC5jaGlsZHJlbi5nZXQoJ2lkLWEnKSEuY2hpbGRyZW4uZ2V0KCdpZC1hYScpISk7XG5cdFx0XHRleHBlY3RlZEFyZ3MucHVzaChbXG5cdFx0XHRcdCdjdHJsSWQnLFxuXHRcdFx0XHR0cmFja2VyLmlkLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Y29udmVydC5UZXN0SXRlbS5mcm9tKHNpbmdsZS5yb290KSxcblx0XHRcdFx0XHRjb252ZXJ0LlRlc3RJdGVtLmZyb20oc2luZ2xlLnJvb3QuY2hpbGRyZW4uZ2V0KCdpZC1hJykgYXMgVGVzdEl0ZW1JbXBsKSxcblx0XHRcdFx0XHRjb252ZXJ0LlRlc3RJdGVtLmZyb20oc2luZ2xlLnJvb3QuY2hpbGRyZW4uZ2V0KCdpZC1hJykhLmNoaWxkcmVuLmdldCgnaWQtYWEnKSBhcyBUZXN0SXRlbUltcGwpLFxuXHRcdFx0XHRdXG5cdFx0XHRdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocHJveHkuJGFkZFRlc3RzVG9SdW4uYXJncywgZXhwZWN0ZWRBcmdzKTtcblxuXHRcdFx0dGFzazEuZW5xdWV1ZWQoc2luZ2xlLnJvb3QuY2hpbGRyZW4uZ2V0KCdpZC1hJykhLmNoaWxkcmVuLmdldCgnaWQtYWInKSEpO1xuXHRcdFx0ZXhwZWN0ZWRBcmdzLnB1c2goW1xuXHRcdFx0XHQnY3RybElkJyxcblx0XHRcdFx0dHJhY2tlci5pZCxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdGNvbnZlcnQuVGVzdEl0ZW0uZnJvbShzaW5nbGUucm9vdC5jaGlsZHJlbi5nZXQoJ2lkLWEnKSBhcyBUZXN0SXRlbUltcGwpLFxuXHRcdFx0XHRcdGNvbnZlcnQuVGVzdEl0ZW0uZnJvbShzaW5nbGUucm9vdC5jaGlsZHJlbi5nZXQoJ2lkLWEnKSEuY2hpbGRyZW4uZ2V0KCdpZC1hYicpIGFzIFRlc3RJdGVtSW1wbCksXG5cdFx0XHRcdF0sXG5cdFx0XHRdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocHJveHkuJGFkZFRlc3RzVG9SdW4uYXJncywgZXhwZWN0ZWRBcmdzKTtcblxuXHRcdFx0dGFzazEucGFzc2VkKHNpbmdsZS5yb290LmNoaWxkcmVuLmdldCgnaWQtYScpIS5jaGlsZHJlbi5nZXQoJ2lkLWFiJykhKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocHJveHkuJGFkZFRlc3RzVG9SdW4uYXJncywgZXhwZWN0ZWRBcmdzKTtcblxuXHRcdFx0dGFzazEuZW5kKCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdhZGRzIHRlc3QgbWVzc2FnZXMgdG8gcnVuJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGVzdDEgPSBuZXcgVGVzdEl0ZW1JbXBsKCdjdHJsSWQnLCAnaWQtYycsICd0ZXN0IGMnLCBVUkkuZmlsZSgnL3Rlc3RjLnR4dCcpKTtcblx0XHRcdGNvbnN0IHRlc3QyID0gbmV3IFRlc3RJdGVtSW1wbCgnY3RybElkJywgJ2lkLWQnLCAndGVzdCBkJywgVVJJLmZpbGUoJy90ZXN0ZC50eHQnKSk7XG5cdFx0XHR0ZXN0MS5yYW5nZSA9IHRlc3QyLnJhbmdlID0gbmV3IFJhbmdlKG5ldyBQb3NpdGlvbigwLCAwKSwgbmV3IFBvc2l0aW9uKDEsIDApKTtcblx0XHRcdHNpbmdsZS5yb290LmNoaWxkcmVuLnJlcGxhY2UoW3Rlc3QxLCB0ZXN0Ml0pO1xuXHRcdFx0Y29uc3QgdGFzayA9IGMuY3JlYXRlVGVzdFJ1bihleHQsICdjdHJsSWQnLCBzaW5nbGUsIHJlcSwgJ2hlbGxvIHdvcmxkJywgZmFsc2UpO1xuXG5cdFx0XHRjb25zdCBtZXNzYWdlMSA9IG5ldyBUZXN0TWVzc2FnZSgnc29tZSBtZXNzYWdlJyk7XG5cdFx0XHRtZXNzYWdlMS5sb2NhdGlvbiA9IG5ldyBMb2NhdGlvbihVUkkuZmlsZSgnL2EudHh0JyksIG5ldyBQb3NpdGlvbigwLCAwKSk7XG5cdFx0XHR0YXNrLmZhaWxlZCh0ZXN0MSwgbWVzc2FnZTEpO1xuXG5cdFx0XHRjb25zdCBhcmdzID0gcHJveHkuJGFwcGVuZFRlc3RNZXNzYWdlc0luUnVuLmFyZ3NbMF07XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHByb3h5LiRhcHBlbmRUZXN0TWVzc2FnZXNJblJ1bi5hcmdzWzBdLCBbXG5cdFx0XHRcdGFyZ3NbMF0sXG5cdFx0XHRcdGFyZ3NbMV0sXG5cdFx0XHRcdG5ldyBUZXN0SWQoWydjdHJsSWQnLCAnaWQtYyddKS50b1N0cmluZygpLFxuXHRcdFx0XHRbe1xuXHRcdFx0XHRcdG1lc3NhZ2U6ICdzb21lIG1lc3NhZ2UnLFxuXHRcdFx0XHRcdHR5cGU6IFRlc3RNZXNzYWdlVHlwZS5FcnJvcixcblx0XHRcdFx0XHRleHBlY3RlZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdGNvbnRleHRWYWx1ZTogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdGFjdHVhbDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdGxvY2F0aW9uOiBjb252ZXJ0LmxvY2F0aW9uLmZyb20obWVzc2FnZTEubG9jYXRpb24pLFxuXHRcdFx0XHRcdHN0YWNrVHJhY2U6IHVuZGVmaW5lZCxcblx0XHRcdFx0fV1cblx0XHRcdF0pO1xuXG5cdFx0XHQvLyBzaG91bGQgdXNlIHRlc3QgbG9jYXRpb24gYXMgZGVmYXVsdFxuXHRcdFx0dGFzay5mYWlsZWQodGVzdDIsIG5ldyBUZXN0TWVzc2FnZSgnc29tZSBtZXNzYWdlJykpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwcm94eS4kYXBwZW5kVGVzdE1lc3NhZ2VzSW5SdW4uYXJnc1sxXSwgW1xuXHRcdFx0XHRhcmdzWzBdLFxuXHRcdFx0XHRhcmdzWzFdLFxuXHRcdFx0XHRuZXcgVGVzdElkKFsnY3RybElkJywgJ2lkLWQnXSkudG9TdHJpbmcoKSxcblx0XHRcdFx0W3tcblx0XHRcdFx0XHRtZXNzYWdlOiAnc29tZSBtZXNzYWdlJyxcblx0XHRcdFx0XHR0eXBlOiBUZXN0TWVzc2FnZVR5cGUuRXJyb3IsXG5cdFx0XHRcdFx0Y29udGV4dFZhbHVlOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0ZXhwZWN0ZWQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRhY3R1YWw6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRsb2NhdGlvbjogY29udmVydC5sb2NhdGlvbi5mcm9tKHsgdXJpOiB0ZXN0Mi51cmkhLCByYW5nZTogdGVzdDIucmFuZ2UgfSksXG5cdFx0XHRcdFx0c3RhY2tUcmFjZTogdW5kZWZpbmVkLFxuXHRcdFx0XHR9XVxuXHRcdFx0XSk7XG5cblx0XHRcdHRhc2suZW5kKCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdndWFyZHMgY2FsbHMgYWZ0ZXIgcnVucyBhcmUgZW5kZWQnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCB0YXNrID0gYy5jcmVhdGVUZXN0UnVuKGV4dCwgJ2N0cmwnLCBzaW5nbGUsIHJlcSwgJ2hlbGxvIHdvcmxkJywgZmFsc2UpO1xuXHRcdFx0dGFzay5lbmQoKTtcblxuXHRcdFx0dGFzay5mYWlsZWQoc2luZ2xlLnJvb3QsIG5ldyBUZXN0TWVzc2FnZSgnc29tZSBtZXNzYWdlJykpO1xuXHRcdFx0dGFzay5hcHBlbmRPdXRwdXQoJ291dHB1dCcpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocHJveHkuJGFkZFRlc3RzVG9SdW4uY2FsbGVkLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocHJveHkuJGFwcGVuZE91dHB1dFRvUnVuLmNhbGxlZCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHByb3h5LiRhcHBlbmRUZXN0TWVzc2FnZXNJblJ1bi5jYWxsZWQsIGZhbHNlKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3NldHMgc3RhdGUgb2YgdGVzdCB3aXRoIGlkZW50aWNhbCBsb2NhbCBJRHMgKCMxMzE4MjcpJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGVzdEEgPSBzaW5nbGUucm9vdC5jaGlsZHJlbi5nZXQoJ2lkLWEnKTtcblx0XHRcdGNvbnN0IHRlc3RCID0gc2luZ2xlLnJvb3QuY2hpbGRyZW4uZ2V0KCdpZC1iJyk7XG5cdFx0XHRjb25zdCBjaGlsZEEgPSBuZXcgVGVzdEl0ZW1JbXBsKCdjdHJsSWQnLCAnaWQtY2hpbGQnLCAnY2hpbGQnLCB1bmRlZmluZWQpO1xuXHRcdFx0dGVzdEEhLmNoaWxkcmVuLnJlcGxhY2UoW2NoaWxkQV0pO1xuXHRcdFx0Y29uc3QgY2hpbGRCID0gbmV3IFRlc3RJdGVtSW1wbCgnY3RybElkJywgJ2lkLWNoaWxkJywgJ2NoaWxkJywgdW5kZWZpbmVkKTtcblx0XHRcdHRlc3RCIS5jaGlsZHJlbi5yZXBsYWNlKFtjaGlsZEJdKTtcblxuXHRcdFx0Y29uc3QgdGFzazEgPSBjLmNyZWF0ZVRlc3RSdW4oZXh0LCAnY3RybCcsIHNpbmdsZSwgbmV3IFRlc3RSdW5SZXF1ZXN0SW1wbCgpLCAnaGVsbG8gd29ybGQnLCBmYWxzZSk7XG5cdFx0XHRjb25zdCB0cmFja2VyID0gSXRlcmFibGUuZmlyc3QoYy50cmFja2VycykhO1xuXG5cdFx0XHR0YXNrMS5wYXNzZWQoY2hpbGRBKTtcblx0XHRcdHRhc2sxLnBhc3NlZChjaGlsZEIpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwcm94eS4kYWRkVGVzdHNUb1J1bi5hcmdzLCBbXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnY3RybCcsXG5cdFx0XHRcdFx0dHJhY2tlci5pZCxcblx0XHRcdFx0XHRbc2luZ2xlLnJvb3QsIHRlc3RBLCBjaGlsZEFdLm1hcCh0ID0+IGNvbnZlcnQuVGVzdEl0ZW0uZnJvbSh0IGFzIFRlc3RJdGVtSW1wbCkpLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0J2N0cmwnLFxuXHRcdFx0XHRcdHRyYWNrZXIuaWQsXG5cdFx0XHRcdFx0W3NpbmdsZS5yb290LCB0ZXN0QiwgY2hpbGRCXS5tYXAodCA9PiBjb252ZXJ0LlRlc3RJdGVtLmZyb20odCBhcyBUZXN0SXRlbUltcGwpKSxcblx0XHRcdFx0XSxcblx0XHRcdF0pO1xuXG5cdFx0XHR0YXNrMS5lbmQoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ3NlcnZpY2UnLCAoKSA9PiB7XG5cdFx0bGV0IGN0cmw6IFRlc3RFeHRIb3N0VGVzdGluZztcblxuXHRcdGNsYXNzIFRlc3RFeHRIb3N0VGVzdGluZyBleHRlbmRzIEV4dEhvc3RUZXN0aW5nIHtcblx0XHRcdHB1YmxpYyBnZXRQcm9maWxlSW50ZXJuYWxJZChjdHJsOiBUZXN0Q29udHJvbGxlciwgcHJvZmlsZTogVGVzdFJ1blByb2ZpbGUpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBbaWQsIHBdIG9mIHRoaXMuY29udHJvbGxlcnMuZ2V0KGN0cmwuaWQpIS5wcm9maWxlcykge1xuXHRcdFx0XHRcdGlmIChwcm9maWxlID09PSBwKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gaWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdwcm9maWxlIG5vdCBmb3VuZCcpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHNldHVwKCgpID0+IHtcblx0XHRcdGNvbnN0IHJwY1Byb3RvY29sID0gQW55Q2FsbFJQQ1Byb3RvY29sKCk7XG5cdFx0XHRjdHJsID0gZHMuYWRkKG5ldyBUZXN0RXh0SG9zdFRlc3RpbmcoXG5cdFx0XHRcdHJwY1Byb3RvY29sLFxuXHRcdFx0XHRuZXcgTnVsbExvZ1NlcnZpY2UoKSxcblx0XHRcdFx0bmV3IEV4dEhvc3RDb21tYW5kcyhycGNQcm90b2NvbCwgbmV3IE51bGxMb2dTZXJ2aWNlKCksIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUV4dEhvc3RUZWxlbWV0cnk+KCkge1xuXHRcdFx0XHRcdG92ZXJyaWRlIG9uRXh0ZW5zaW9uRXJyb3IoKTogYm9vbGVhbiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pLFxuXHRcdFx0XHRuZXcgRXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMocnBjUHJvdG9jb2wsIG5ldyBOdWxsTG9nU2VydmljZSgpKSxcblx0XHRcdCkpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZXhwb3NlcyBhY3RpdmUgcHJvZmlsZXMgY29ycmVjdGx5JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZXh0QSA9IHsgLi4ubnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCBpZGVudGlmaWVyOiBuZXcgRXh0ZW5zaW9uSWRlbnRpZmllcignZXh0LmEnKSwgZW5hYmxlZEFwaVByb3Bvc2FsczogWyd0ZXN0aW5nQWN0aXZlUHJvZmlsZSddIH07XG5cdFx0XHRjb25zdCBleHRCID0geyAuLi5udWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGlkZW50aWZpZXI6IG5ldyBFeHRlbnNpb25JZGVudGlmaWVyKCdleHQuYicpLCBlbmFibGVkQXBpUHJvcG9zYWxzOiBbJ3Rlc3RpbmdBY3RpdmVQcm9maWxlJ10gfTtcblxuXHRcdFx0Y29uc3QgY3RybEEgPSBkcy5hZGQoY3RybC5jcmVhdGVUZXN0Q29udHJvbGxlcihleHRBLCAnYScsICdjdHJsYScpKTtcblx0XHRcdGNvbnN0IHByb2ZBQSA9IGRzLmFkZChjdHJsQS5jcmVhdGVSdW5Qcm9maWxlKCdhYScsIFRlc3RSdW5Qcm9maWxlS2luZC5SdW4sICgpID0+IHsgfSkpO1xuXHRcdFx0Y29uc3QgcHJvZkFCID0gZHMuYWRkKGN0cmxBLmNyZWF0ZVJ1blByb2ZpbGUoJ2FiJywgVGVzdFJ1blByb2ZpbGVLaW5kLlJ1biwgKCkgPT4geyB9KSk7XG5cblx0XHRcdGNvbnN0IGN0cmxCID0gZHMuYWRkKGN0cmwuY3JlYXRlVGVzdENvbnRyb2xsZXIoZXh0QiwgJ2InLCAnY3RybGInKSk7XG5cdFx0XHRjb25zdCBwcm9mQkEgPSBkcy5hZGQoY3RybEIuY3JlYXRlUnVuUHJvZmlsZSgnYmEnLCBUZXN0UnVuUHJvZmlsZUtpbmQuUnVuLCAoKSA9PiB7IH0pKTtcblx0XHRcdGNvbnN0IHByb2ZCQiA9IGRzLmFkZChjdHJsQi5jcmVhdGVSdW5Qcm9maWxlKCdiYicsIFRlc3RSdW5Qcm9maWxlS2luZC5SdW4sICgpID0+IHsgfSkpO1xuXHRcdFx0Y29uc3QgbmV2ZXJDYWxsZWQgPSBzaW5vbi5zdHViKCk7XG5cblx0XHRcdC8vIGVtcHR5IGRlZmF1bHQgc3RhdGU6XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHByb2ZBQS5pc0RlZmF1bHQsIGZhbHNlKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocHJvZkJBLmlzRGVmYXVsdCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwcm9mQkIuaXNEZWZhdWx0LCBmYWxzZSk7XG5cblx0XHRcdC8vIGZpcmVzIGEgY2hhbmdlIGV2ZW50OlxuXHRcdFx0Y29uc3QgY2hhbmdlQSA9IEV2ZW50LnRvUHJvbWlzZShwcm9mQUEub25EaWRDaGFuZ2VEZWZhdWx0IGFzIEV2ZW50PGJvb2xlYW4+KTtcblx0XHRcdGNvbnN0IGNoYW5nZUJBID0gRXZlbnQudG9Qcm9taXNlKHByb2ZCQS5vbkRpZENoYW5nZURlZmF1bHQgYXMgRXZlbnQ8Ym9vbGVhbj4pO1xuXHRcdFx0Y29uc3QgY2hhbmdlQkIgPSBFdmVudC50b1Byb21pc2UocHJvZkJCLm9uRGlkQ2hhbmdlRGVmYXVsdCBhcyBFdmVudDxib29sZWFuPik7XG5cblx0XHRcdGRzLmFkZChwcm9mQUIub25EaWRDaGFuZ2VEZWZhdWx0KG5ldmVyQ2FsbGVkKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmV2ZXJDYWxsZWQuY2FsbGVkLCBmYWxzZSk7XG5cblx0XHRcdGN0cmwuJHNldERlZmF1bHRSdW5Qcm9maWxlcyh7XG5cdFx0XHRcdGE6IFtjdHJsLmdldFByb2ZpbGVJbnRlcm5hbElkKGN0cmxBLCBwcm9mQUEpXSxcblx0XHRcdFx0YjogW2N0cmwuZ2V0UHJvZmlsZUludGVybmFsSWQoY3RybEIsIHByb2ZCQSksIGN0cmwuZ2V0UHJvZmlsZUludGVybmFsSWQoY3RybEIsIHByb2ZCQildXG5cdFx0XHR9KTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhd2FpdCBjaGFuZ2VBLCB0cnVlKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXdhaXQgY2hhbmdlQkEsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhd2FpdCBjaGFuZ2VCQiwgdHJ1ZSk7XG5cblx0XHRcdC8vIHVwZGF0ZXMgaW50ZXJuYWwgc3RhdGU6XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHByb2ZBQS5pc0RlZmF1bHQsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwcm9mQkEuaXNEZWZhdWx0LCB0cnVlKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocHJvZkJCLmlzRGVmYXVsdCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHByb2ZBQi5pc0RlZmF1bHQsIGZhbHNlKTtcblxuXHRcdFx0Ly8gbm8tb3BzIGlmIGVxdWFsXG5cdFx0XHRkcy5hZGQocHJvZkFBLm9uRGlkQ2hhbmdlRGVmYXVsdChuZXZlckNhbGxlZCkpO1xuXHRcdFx0Y3RybC4kc2V0RGVmYXVsdFJ1blByb2ZpbGVzKHtcblx0XHRcdFx0YTogW2N0cmwuZ2V0UHJvZmlsZUludGVybmFsSWQoY3RybEEsIHByb2ZBQSldLFxuXHRcdFx0fSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1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
