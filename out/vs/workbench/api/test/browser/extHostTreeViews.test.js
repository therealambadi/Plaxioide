import assert from "assert";
import * as sinon from "sinon";
import { Emitter } from "../../../../base/common/event.js";
import { ExtHostTreeViews } from "../../common/extHostTreeViews.js";
import { ExtHostCommands } from "../../common/extHostCommands.js";
import { MainContext } from "../../common/extHost.protocol.js";
import { TestRPCProtocol } from "../common/testRPCProtocol.js";
import { mock } from "../../../../base/test/common/mock.js";
import { TreeItemCollapsibleState } from "../../../common/views.js";
import { NullLogService } from "../../../../platform/log/common/log.js";
import { nullExtensionDescription as extensionsDescription } from "../../../services/extensions/common/extensions.js";
import { runWithFakedTimers } from "../../../../base/test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
function unBatchChildren(result) {
  if (!result || result.length === 0) {
    return void 0;
  }
  if (result.length > 1) {
    throw new Error("Unexpected result length, all tests are unbatched.");
  }
  return result[0].slice(1);
}
suite("ExtHostTreeView", function() {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  class RecordingShape extends mock() {
    constructor() {
      super(...arguments);
      this.onRefresh = new Emitter();
    }
    async $registerTreeViewDataProvider(treeViewId) {
    }
    $refresh(viewId, itemsToRefresh) {
      return Promise.resolve(null).then(() => {
        this.onRefresh.fire(itemsToRefresh);
      });
    }
    $reveal(treeViewId, itemInfo, options) {
      return Promise.resolve();
    }
    $disposeTree(treeViewId) {
      return Promise.resolve();
    }
  }
  let testObject;
  let target;
  let onDidChangeTreeNode;
  let onDidChangeTreeNodeWithId;
  let tree;
  let labels;
  let nodes;
  setup(() => {
    tree = {
      "a": {
        "aa": {},
        "ab": {}
      },
      "b": {
        "ba": {},
        "bb": {}
      }
    };
    labels = {};
    nodes = {};
    const rpcProtocol = new TestRPCProtocol();
    rpcProtocol.set(MainContext.MainThreadCommands, new class extends mock() {
      $registerCommand() {
      }
    }());
    target = new RecordingShape();
    testObject = store.add(new ExtHostTreeViews(target, new ExtHostCommands(
      rpcProtocol,
      new NullLogService(),
      new class extends mock() {
        onExtensionError() {
          return true;
        }
      }()
    ), new NullLogService()));
    onDidChangeTreeNode = new Emitter();
    onDidChangeTreeNodeWithId = new Emitter();
    testObject.createTreeView("testNodeTreeProvider", { treeDataProvider: aNodeTreeDataProvider() }, extensionsDescription);
    testObject.createTreeView("testNodeWithIdTreeProvider", { treeDataProvider: aNodeWithIdTreeDataProvider() }, extensionsDescription);
    testObject.createTreeView("testNodeWithHighlightsTreeProvider", { treeDataProvider: aNodeWithHighlightedLabelTreeDataProvider() }, extensionsDescription);
    return loadCompleteTree("testNodeTreeProvider");
  });
  test("construct node tree", () => {
    return testObject.$getChildren("testNodeTreeProvider").then((elements) => {
      const actuals = unBatchChildren(elements)?.map((e) => e.handle);
      assert.deepStrictEqual(actuals, ["0/0:a", "0/0:b"]);
      return Promise.all([
        testObject.$getChildren("testNodeTreeProvider", ["0/0:a"]).then((children) => {
          const actuals2 = unBatchChildren(children)?.map((e) => e.handle);
          assert.deepStrictEqual(actuals2, ["0/0:a/0:aa", "0/0:a/0:ab"]);
          return Promise.all([
            testObject.$getChildren("testNodeTreeProvider", ["0/0:a/0:aa"]).then((children2) => assert.strictEqual(unBatchChildren(children2)?.length, 0)),
            testObject.$getChildren("testNodeTreeProvider", ["0/0:a/0:ab"]).then((children2) => assert.strictEqual(unBatchChildren(children2)?.length, 0))
          ]);
        }),
        testObject.$getChildren("testNodeTreeProvider", ["0/0:b"]).then((children) => {
          const actuals2 = unBatchChildren(children)?.map((e) => e.handle);
          assert.deepStrictEqual(actuals2, ["0/0:b/0:ba", "0/0:b/0:bb"]);
          return Promise.all([
            testObject.$getChildren("testNodeTreeProvider", ["0/0:b/0:ba"]).then((children2) => assert.strictEqual(unBatchChildren(children2)?.length, 0)),
            testObject.$getChildren("testNodeTreeProvider", ["0/0:b/0:bb"]).then((children2) => assert.strictEqual(unBatchChildren(children2)?.length, 0))
          ]);
        })
      ]);
    });
  });
  test("construct id tree", () => {
    return testObject.$getChildren("testNodeWithIdTreeProvider").then((elements) => {
      const actuals = unBatchChildren(elements)?.map((e) => e.handle);
      assert.deepStrictEqual(actuals, ["1/a", "1/b"]);
      return Promise.all([
        testObject.$getChildren("testNodeWithIdTreeProvider", ["1/a"]).then((children) => {
          const actuals2 = unBatchChildren(children)?.map((e) => e.handle);
          assert.deepStrictEqual(actuals2, ["1/aa", "1/ab"]);
          return Promise.all([
            testObject.$getChildren("testNodeWithIdTreeProvider", ["1/aa"]).then((children2) => assert.strictEqual(unBatchChildren(children2)?.length, 0)),
            testObject.$getChildren("testNodeWithIdTreeProvider", ["1/ab"]).then((children2) => assert.strictEqual(unBatchChildren(children2)?.length, 0))
          ]);
        }),
        testObject.$getChildren("testNodeWithIdTreeProvider", ["1/b"]).then((children) => {
          const actuals2 = unBatchChildren(children)?.map((e) => e.handle);
          assert.deepStrictEqual(actuals2, ["1/ba", "1/bb"]);
          return Promise.all([
            testObject.$getChildren("testNodeWithIdTreeProvider", ["1/ba"]).then((children2) => assert.strictEqual(unBatchChildren(children2)?.length, 0)),
            testObject.$getChildren("testNodeWithIdTreeProvider", ["1/bb"]).then((children2) => assert.strictEqual(unBatchChildren(children2)?.length, 0))
          ]);
        })
      ]);
    });
  });
  test("construct highlights tree", () => {
    return testObject.$getChildren("testNodeWithHighlightsTreeProvider").then((elements) => {
      assert.deepStrictEqual(removeUnsetKeys(unBatchChildren(elements)), [{
        handle: "1/a",
        label: { label: "a", highlights: [[0, 2], [3, 5]] },
        collapsibleState: TreeItemCollapsibleState.Collapsed
      }, {
        handle: "1/b",
        label: { label: "b", highlights: [[0, 2], [3, 5]] },
        collapsibleState: TreeItemCollapsibleState.Collapsed
      }]);
      return Promise.all([
        testObject.$getChildren("testNodeWithHighlightsTreeProvider", ["1/a"]).then((children) => {
          assert.deepStrictEqual(removeUnsetKeys(unBatchChildren(children)), [{
            handle: "1/aa",
            parentHandle: "1/a",
            label: { label: "aa", highlights: [[0, 2], [3, 5]] },
            collapsibleState: TreeItemCollapsibleState.None
          }, {
            handle: "1/ab",
            parentHandle: "1/a",
            label: { label: "ab", highlights: [[0, 2], [3, 5]] },
            collapsibleState: TreeItemCollapsibleState.None
          }]);
        }),
        testObject.$getChildren("testNodeWithHighlightsTreeProvider", ["1/b"]).then((children) => {
          assert.deepStrictEqual(removeUnsetKeys(unBatchChildren(children)), [{
            handle: "1/ba",
            parentHandle: "1/b",
            label: { label: "ba", highlights: [[0, 2], [3, 5]] },
            collapsibleState: TreeItemCollapsibleState.None
          }, {
            handle: "1/bb",
            parentHandle: "1/b",
            label: { label: "bb", highlights: [[0, 2], [3, 5]] },
            collapsibleState: TreeItemCollapsibleState.None
          }]);
        })
      ]);
    });
  });
  test("error is thrown if id is not unique", (done) => {
    tree["a"] = {
      "aa": {}
    };
    tree["b"] = {
      "aa": {},
      "ba": {}
    };
    let caughtExpectedError = false;
    store.add(target.onRefresh.event(() => {
      testObject.$getChildren("testNodeWithIdTreeProvider").then((elements) => {
        const actuals = unBatchChildren(elements)?.map((e) => e.handle);
        assert.deepStrictEqual(actuals, ["1/a", "1/b"]);
        return testObject.$getChildren("testNodeWithIdTreeProvider", ["1/a"]).then(() => testObject.$getChildren("testNodeWithIdTreeProvider", ["1/b"])).then(() => assert.fail("Should fail with duplicate id")).catch(() => caughtExpectedError = true).finally(() => caughtExpectedError ? done() : assert.fail("Expected duplicate id error not thrown."));
      });
    }));
    onDidChangeTreeNode.fire(void 0);
  });
  test("refresh root", function(done) {
    store.add(target.onRefresh.event((actuals) => {
      assert.strictEqual(void 0, actuals);
      done();
    }));
    onDidChangeTreeNode.fire(void 0);
  });
  test("refresh a parent node", () => {
    return new Promise((c, e) => {
      store.add(target.onRefresh.event((actuals) => {
        assert.deepStrictEqual(["0/0:b"], Object.keys(actuals));
        assert.deepStrictEqual(removeUnsetKeys(actuals["0/0:b"]), {
          handle: "0/0:b",
          label: { label: "b" },
          collapsibleState: TreeItemCollapsibleState.Collapsed
        });
        c(void 0);
      }));
      onDidChangeTreeNode.fire(getNode("b"));
    });
  });
  test("refresh a leaf node", function(done) {
    store.add(target.onRefresh.event((actuals) => {
      assert.deepStrictEqual(["0/0:b/0:bb"], Object.keys(actuals));
      assert.deepStrictEqual(removeUnsetKeys(actuals["0/0:b/0:bb"]), {
        handle: "0/0:b/0:bb",
        parentHandle: "0/0:b",
        label: { label: "bb" },
        collapsibleState: TreeItemCollapsibleState.None
      });
      done();
    }));
    onDidChangeTreeNode.fire(getNode("bb"));
  });
  async function runWithEventMerging(action) {
    await runWithFakedTimers({}, async () => {
      await new Promise((resolve) => {
        let subscription = void 0;
        subscription = target.onRefresh.event(() => {
          subscription.dispose();
          resolve();
        });
        onDidChangeTreeNode.fire(getNode("b"));
      });
      await new Promise(action);
    });
  }
  test("refresh parent and child node trigger refresh only on parent - scenario 1", async () => {
    return runWithEventMerging((resolve) => {
      store.add(target.onRefresh.event((actuals) => {
        assert.deepStrictEqual(["0/0:b", "0/0:a/0:aa"], Object.keys(actuals));
        assert.deepStrictEqual(removeUnsetKeys(actuals["0/0:b"]), {
          handle: "0/0:b",
          label: { label: "b" },
          collapsibleState: TreeItemCollapsibleState.Collapsed
        });
        assert.deepStrictEqual(removeUnsetKeys(actuals["0/0:a/0:aa"]), {
          handle: "0/0:a/0:aa",
          parentHandle: "0/0:a",
          label: { label: "aa" },
          collapsibleState: TreeItemCollapsibleState.None
        });
        resolve();
      }));
      onDidChangeTreeNode.fire(getNode("b"));
      onDidChangeTreeNode.fire(getNode("aa"));
      onDidChangeTreeNode.fire(getNode("bb"));
    });
  });
  test("refresh parent and child node trigger refresh only on parent - scenario 2", async () => {
    return runWithEventMerging((resolve) => {
      store.add(target.onRefresh.event((actuals) => {
        assert.deepStrictEqual(["0/0:a/0:aa", "0/0:b"], Object.keys(actuals));
        assert.deepStrictEqual(removeUnsetKeys(actuals["0/0:b"]), {
          handle: "0/0:b",
          label: { label: "b" },
          collapsibleState: TreeItemCollapsibleState.Collapsed
        });
        assert.deepStrictEqual(removeUnsetKeys(actuals["0/0:a/0:aa"]), {
          handle: "0/0:a/0:aa",
          parentHandle: "0/0:a",
          label: { label: "aa" },
          collapsibleState: TreeItemCollapsibleState.None
        });
        resolve();
      }));
      onDidChangeTreeNode.fire(getNode("bb"));
      onDidChangeTreeNode.fire(getNode("aa"));
      onDidChangeTreeNode.fire(getNode("b"));
    });
  });
  test("refresh an element for label change", function(done) {
    labels["a"] = "aa";
    store.add(target.onRefresh.event((actuals) => {
      assert.deepStrictEqual(["0/0:a"], Object.keys(actuals));
      assert.deepStrictEqual(removeUnsetKeys(actuals["0/0:a"]), {
        handle: "0/0:aa",
        label: { label: "aa" },
        collapsibleState: TreeItemCollapsibleState.Collapsed
      });
      done();
    }));
    onDidChangeTreeNode.fire(getNode("a"));
  });
  test("refresh calls are throttled on roots", () => {
    return runWithEventMerging((resolve) => {
      store.add(target.onRefresh.event((actuals) => {
        assert.strictEqual(void 0, actuals);
        resolve();
      }));
      onDidChangeTreeNode.fire(void 0);
      onDidChangeTreeNode.fire(void 0);
      onDidChangeTreeNode.fire(void 0);
      onDidChangeTreeNode.fire(void 0);
    });
  });
  test("refresh calls are throttled on elements", () => {
    return runWithEventMerging((resolve) => {
      store.add(target.onRefresh.event((actuals) => {
        assert.deepStrictEqual(["0/0:a", "0/0:b"], Object.keys(actuals));
        resolve();
      }));
      onDidChangeTreeNode.fire(getNode("a"));
      onDidChangeTreeNode.fire(getNode("b"));
      onDidChangeTreeNode.fire(getNode("b"));
      onDidChangeTreeNode.fire(getNode("a"));
    });
  });
  test("refresh calls are throttled on unknown elements", () => {
    return runWithEventMerging((resolve) => {
      store.add(target.onRefresh.event((actuals) => {
        assert.deepStrictEqual(["0/0:a", "0/0:b"], Object.keys(actuals));
        resolve();
      }));
      onDidChangeTreeNode.fire(getNode("a"));
      onDidChangeTreeNode.fire(getNode("b"));
      onDidChangeTreeNode.fire(getNode("g"));
      onDidChangeTreeNode.fire(getNode("a"));
    });
  });
  test("refresh calls are throttled on unknown elements and root", () => {
    return runWithEventMerging((resolve) => {
      store.add(target.onRefresh.event((actuals) => {
        assert.strictEqual(void 0, actuals);
        resolve();
      }));
      onDidChangeTreeNode.fire(getNode("a"));
      onDidChangeTreeNode.fire(getNode("b"));
      onDidChangeTreeNode.fire(getNode("g"));
      onDidChangeTreeNode.fire(void 0);
    });
  });
  test("refresh calls are throttled on elements and root", () => {
    return runWithEventMerging((resolve) => {
      store.add(target.onRefresh.event((actuals) => {
        assert.strictEqual(void 0, actuals);
        resolve();
      }));
      onDidChangeTreeNode.fire(getNode("a"));
      onDidChangeTreeNode.fire(getNode("b"));
      onDidChangeTreeNode.fire(void 0);
      onDidChangeTreeNode.fire(getNode("a"));
    });
  });
  test("generate unique handles from labels by escaping them", (done) => {
    tree = {
      "a/0:b": {}
    };
    store.add(target.onRefresh.event(() => {
      testObject.$getChildren("testNodeTreeProvider").then((elements) => {
        assert.deepStrictEqual(unBatchChildren(elements)?.map((e) => e.handle), ["0/0:a//0:b"]);
        done();
      });
    }));
    onDidChangeTreeNode.fire(void 0);
  });
  test("tree with duplicate labels", (done) => {
    const dupItems = {
      "adup1": "c",
      "adup2": "g",
      "bdup1": "e",
      "hdup1": "i",
      "hdup2": "l",
      "jdup1": "k"
    };
    labels["c"] = "a";
    labels["e"] = "b";
    labels["g"] = "a";
    labels["i"] = "h";
    labels["l"] = "h";
    labels["k"] = "j";
    tree[dupItems["adup1"]] = {};
    tree["d"] = {};
    const bdup1Tree = {};
    bdup1Tree["h"] = {};
    bdup1Tree[dupItems["hdup1"]] = {};
    bdup1Tree["j"] = {};
    bdup1Tree[dupItems["jdup1"]] = {};
    bdup1Tree[dupItems["hdup2"]] = {};
    tree[dupItems["bdup1"]] = bdup1Tree;
    tree["f"] = {};
    tree[dupItems["adup2"]] = {};
    store.add(target.onRefresh.event(() => {
      testObject.$getChildren("testNodeTreeProvider").then((elements) => {
        const actuals = unBatchChildren(elements)?.map((e) => e.handle);
        assert.deepStrictEqual(actuals, ["0/0:a", "0/0:b", "0/1:a", "0/0:d", "0/1:b", "0/0:f", "0/2:a"]);
        return testObject.$getChildren("testNodeTreeProvider", ["0/1:b"]).then((elements2) => {
          const actuals2 = unBatchChildren(elements2)?.map((e) => e.handle);
          assert.deepStrictEqual(actuals2, ["0/1:b/0:h", "0/1:b/1:h", "0/1:b/0:j", "0/1:b/1:j", "0/1:b/2:h"]);
          done();
        });
      });
    }));
    onDidChangeTreeNode.fire(void 0);
  });
  test("getChildren is not returned from cache if refreshed", (done) => {
    tree = {
      "c": {}
    };
    store.add(target.onRefresh.event(() => {
      testObject.$getChildren("testNodeTreeProvider").then((elements) => {
        assert.deepStrictEqual(unBatchChildren(elements)?.map((e) => e.handle), ["0/0:c"]);
        done();
      });
    }));
    onDidChangeTreeNode.fire(void 0);
  });
  test("getChildren is returned from cache if not refreshed", () => {
    tree = {
      "c": {}
    };
    return testObject.$getChildren("testNodeTreeProvider").then((elements) => {
      assert.deepStrictEqual(unBatchChildren(elements)?.map((e) => e.handle), ["0/0:a", "0/0:b"]);
    });
  });
  test("reveal will throw an error if getParent is not implemented", () => {
    const treeView = testObject.createTreeView("treeDataProvider", { treeDataProvider: aNodeTreeDataProvider() }, extensionsDescription);
    return treeView.reveal({ key: "a" }).then(() => assert.fail("Reveal should throw an error as getParent is not implemented"), () => null);
  });
  test("reveal will return empty array for root element", () => {
    const revealTarget = sinon.spy(target, "$reveal");
    const treeView = testObject.createTreeView("treeDataProvider", { treeDataProvider: aCompleteNodeTreeDataProvider() }, extensionsDescription);
    const expected = {
      item: { handle: "0/0:a", label: { label: "a" }, collapsibleState: TreeItemCollapsibleState.Collapsed },
      parentChain: []
    };
    return treeView.reveal({ key: "a" }).then(() => {
      assert.ok(revealTarget.calledOnce);
      assert.deepStrictEqual("treeDataProvider", revealTarget.args[0][0]);
      assert.deepStrictEqual(expected, removeUnsetKeys(revealTarget.args[0][1]));
      assert.deepStrictEqual({ select: true, focus: false, expand: false }, revealTarget.args[0][2]);
    });
  });
  test("reveal will return parents array for an element when hierarchy is not loaded", () => {
    const revealTarget = sinon.spy(target, "$reveal");
    const treeView = testObject.createTreeView("treeDataProvider", { treeDataProvider: aCompleteNodeTreeDataProvider() }, extensionsDescription);
    const expected = {
      item: { handle: "0/0:a/0:aa", label: { label: "aa" }, collapsibleState: TreeItemCollapsibleState.None, parentHandle: "0/0:a" },
      parentChain: [{ handle: "0/0:a", label: { label: "a" }, collapsibleState: TreeItemCollapsibleState.Collapsed }]
    };
    return treeView.reveal({ key: "aa" }).then(() => {
      assert.ok(revealTarget.calledOnce);
      assert.deepStrictEqual("treeDataProvider", revealTarget.args[0][0]);
      assert.deepStrictEqual(expected.item, removeUnsetKeys(revealTarget.args[0][1].item));
      assert.deepStrictEqual(expected.parentChain, revealTarget.args[0][1].parentChain.map((arg) => removeUnsetKeys(arg)));
      assert.deepStrictEqual({ select: true, focus: false, expand: false }, revealTarget.args[0][2]);
    });
  });
  test("reveal will return parents array for an element when hierarchy is loaded", () => {
    const revealTarget = sinon.spy(target, "$reveal");
    const treeView = testObject.createTreeView("treeDataProvider", { treeDataProvider: aCompleteNodeTreeDataProvider() }, extensionsDescription);
    const expected = {
      item: { handle: "0/0:a/0:aa", label: { label: "aa" }, collapsibleState: TreeItemCollapsibleState.None, parentHandle: "0/0:a" },
      parentChain: [{ handle: "0/0:a", label: { label: "a" }, collapsibleState: TreeItemCollapsibleState.Collapsed }]
    };
    return testObject.$getChildren("treeDataProvider").then(() => testObject.$getChildren("treeDataProvider", ["0/0:a"])).then(() => treeView.reveal({ key: "aa" }).then(() => {
      assert.ok(revealTarget.calledOnce);
      assert.deepStrictEqual("treeDataProvider", revealTarget.args[0][0]);
      assert.deepStrictEqual(expected.item, removeUnsetKeys(revealTarget.args[0][1].item));
      assert.deepStrictEqual(expected.parentChain, revealTarget.args[0][1].parentChain.map((arg) => removeUnsetKeys(arg)));
      assert.deepStrictEqual({ select: true, focus: false, expand: false }, revealTarget.args[0][2]);
    }));
  });
  test("reveal will return parents array for deeper element with no selection", () => {
    tree = {
      "b": {
        "ba": {
          "bac": {}
        }
      }
    };
    const revealTarget = sinon.spy(target, "$reveal");
    const treeView = testObject.createTreeView("treeDataProvider", { treeDataProvider: aCompleteNodeTreeDataProvider() }, extensionsDescription);
    const expected = {
      item: { handle: "0/0:b/0:ba/0:bac", label: { label: "bac" }, collapsibleState: TreeItemCollapsibleState.None, parentHandle: "0/0:b/0:ba" },
      parentChain: [
        { handle: "0/0:b", label: { label: "b" }, collapsibleState: TreeItemCollapsibleState.Collapsed },
        { handle: "0/0:b/0:ba", label: { label: "ba" }, collapsibleState: TreeItemCollapsibleState.Collapsed, parentHandle: "0/0:b" }
      ]
    };
    return treeView.reveal({ key: "bac" }, { select: false, focus: false, expand: false }).then(() => {
      assert.ok(revealTarget.calledOnce);
      assert.deepStrictEqual("treeDataProvider", revealTarget.args[0][0]);
      assert.deepStrictEqual(expected.item, removeUnsetKeys(revealTarget.args[0][1].item));
      assert.deepStrictEqual(expected.parentChain, revealTarget.args[0][1].parentChain.map((arg) => removeUnsetKeys(arg)));
      assert.deepStrictEqual({ select: false, focus: false, expand: false }, revealTarget.args[0][2]);
    });
  });
  test("reveal after first udpate", () => {
    const revealTarget = sinon.spy(target, "$reveal");
    const treeView = testObject.createTreeView("treeDataProvider", { treeDataProvider: aCompleteNodeTreeDataProvider() }, extensionsDescription);
    const expected = {
      item: { handle: "0/0:a/0:ac", label: { label: "ac" }, collapsibleState: TreeItemCollapsibleState.None, parentHandle: "0/0:a" },
      parentChain: [{ handle: "0/0:a", label: { label: "a" }, collapsibleState: TreeItemCollapsibleState.Collapsed }]
    };
    return loadCompleteTree("treeDataProvider").then(() => {
      tree = {
        "a": {
          "aa": {},
          "ac": {}
        },
        "b": {
          "ba": {},
          "bb": {}
        }
      };
      onDidChangeTreeNode.fire(getNode("a"));
      return treeView.reveal({ key: "ac" }).then(() => {
        assert.ok(revealTarget.calledOnce);
        assert.deepStrictEqual("treeDataProvider", revealTarget.args[0][0]);
        assert.deepStrictEqual(expected.item, removeUnsetKeys(revealTarget.args[0][1].item));
        assert.deepStrictEqual(expected.parentChain, revealTarget.args[0][1].parentChain.map((arg) => removeUnsetKeys(arg)));
        assert.deepStrictEqual({ select: true, focus: false, expand: false }, revealTarget.args[0][2]);
      });
    });
  });
  test("reveal after second udpate", () => {
    const revealTarget = sinon.spy(target, "$reveal");
    const treeView = testObject.createTreeView("treeDataProvider", { treeDataProvider: aCompleteNodeTreeDataProvider() }, extensionsDescription);
    return loadCompleteTree("treeDataProvider").then(() => {
      return runWithEventMerging((resolve) => {
        tree = {
          "a": {
            "aa": {},
            "ac": {}
          },
          "b": {
            "ba": {},
            "bb": {}
          }
        };
        onDidChangeTreeNode.fire(getNode("a"));
        tree = {
          "a": {
            "aa": {},
            "ac": {}
          },
          "b": {
            "ba": {},
            "bc": {}
          }
        };
        onDidChangeTreeNode.fire(getNode("b"));
        resolve();
      }).then(() => {
        return treeView.reveal({ key: "bc" }).then(() => {
          assert.ok(revealTarget.calledOnce);
          assert.deepStrictEqual("treeDataProvider", revealTarget.args[0][0]);
          assert.deepStrictEqual({ handle: "0/0:b/0:bc", label: { label: "bc" }, collapsibleState: TreeItemCollapsibleState.None, parentHandle: "0/0:b" }, removeUnsetKeys(revealTarget.args[0][1].item));
          assert.deepStrictEqual([{ handle: "0/0:b", label: { label: "b" }, collapsibleState: TreeItemCollapsibleState.Collapsed }], revealTarget.args[0][1].parentChain.map((arg) => removeUnsetKeys(arg)));
          assert.deepStrictEqual({ select: true, focus: false, expand: false }, revealTarget.args[0][2]);
        });
      });
    });
  });
  function loadCompleteTree(treeId, element) {
    return testObject.$getChildren(treeId, element ? [element] : void 0).then((elements) => {
      if (!elements || elements?.length === 0) {
        return null;
      }
      return elements[0].slice(1).map((e) => loadCompleteTree(treeId, e.handle));
    }).then(() => null);
  }
  function removeUnsetKeys(obj) {
    if (Array.isArray(obj)) {
      return obj.map((o) => removeUnsetKeys(o));
    }
    if (typeof obj === "object") {
      const result = {};
      for (const key of Object.keys(obj)) {
        if (obj[key] !== void 0) {
          result[key] = removeUnsetKeys(obj[key]);
        }
      }
      return result;
    }
    return obj;
  }
  function aNodeTreeDataProvider() {
    return {
      getChildren: (element) => {
        return getChildren(element ? element.key : void 0).map((key) => getNode(key));
      },
      getTreeItem: (element) => {
        return getTreeItem(element.key);
      },
      onDidChangeTreeData: onDidChangeTreeNode.event
    };
  }
  function aCompleteNodeTreeDataProvider() {
    return {
      getChildren: (element) => {
        return getChildren(element ? element.key : void 0).map((key) => getNode(key));
      },
      getTreeItem: (element) => {
        return getTreeItem(element.key);
      },
      getParent: ({ key }) => {
        const parentKey = key.substring(0, key.length - 1);
        return parentKey ? new Key(parentKey) : void 0;
      },
      onDidChangeTreeData: onDidChangeTreeNode.event
    };
  }
  function aNodeWithIdTreeDataProvider() {
    return {
      getChildren: (element) => {
        return getChildren(element ? element.key : void 0).map((key) => getNode(key));
      },
      getTreeItem: (element) => {
        const treeItem = getTreeItem(element.key);
        treeItem.id = element.key;
        return treeItem;
      },
      onDidChangeTreeData: onDidChangeTreeNodeWithId.event
    };
  }
  function aNodeWithHighlightedLabelTreeDataProvider() {
    return {
      getChildren: (element) => {
        return getChildren(element ? element.key : void 0).map((key) => getNode(key));
      },
      getTreeItem: (element) => {
        const treeItem = getTreeItem(element.key, [[0, 2], [3, 5]]);
        treeItem.id = element.key;
        return treeItem;
      },
      onDidChangeTreeData: onDidChangeTreeNodeWithId.event
    };
  }
  function getTreeElement(element) {
    let parent = tree;
    for (let i = 0; i < element.length; i++) {
      parent = parent[element.substring(0, i + 1)];
      if (!parent) {
        return null;
      }
    }
    return parent;
  }
  function getChildren(key) {
    if (!key) {
      return Object.keys(tree);
    }
    const treeElement = getTreeElement(key);
    if (treeElement) {
      return Object.keys(treeElement);
    }
    return [];
  }
  function getTreeItem(key, highlights) {
    const treeElement = getTreeElement(key);
    return {
      label: { label: labels[key] || key, highlights },
      collapsibleState: treeElement && Object.keys(treeElement).length ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None
    };
  }
  function getNode(key) {
    if (!nodes[key]) {
      nodes[key] = new Key(key);
    }
    return nodes[key];
  }
  class Key {
    constructor(key) {
      this.key = key;
    }
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9leHRIb3N0VHJlZVZpZXdzLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgKiBhcyBzaW5vbiBmcm9tICdzaW5vbic7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRXh0SG9zdFRyZWVWaWV3cyB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0VHJlZVZpZXdzLmpzJztcbmltcG9ydCB7IEV4dEhvc3RDb21tYW5kcyB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0Q29tbWFuZHMuanMnO1xuaW1wb3J0IHsgTWFpblRocmVhZFRyZWVWaWV3c1NoYXBlLCBNYWluQ29udGV4dCwgTWFpblRocmVhZENvbW1hbmRzU2hhcGUgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdC5wcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBUcmVlRGF0YVByb3ZpZGVyLCBUcmVlSXRlbSB9IGZyb20gJ3ZzY29kZSc7XG5pbXBvcnQgeyBUZXN0UlBDUHJvdG9jb2wgfSBmcm9tICcuLi9jb21tb24vdGVzdFJQQ1Byb3RvY29sLmpzJztcbmltcG9ydCB7IG1vY2sgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL21vY2suanMnO1xuaW1wb3J0IHsgVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLCBJVHJlZUl0ZW0sIElSZXZlYWxPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHR5cGUgeyBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24gYXMgZXh0ZW5zaW9uc0Rlc2NyaXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBydW5XaXRoRmFrZWRUaW1lcnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3RpbWVUcmF2ZWxTY2hlZHVsZXIuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RUZWxlbWV0cnkgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdFRlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcblxuZnVuY3Rpb24gdW5CYXRjaENoaWxkcmVuKHJlc3VsdDogKG51bWJlciB8IElUcmVlSXRlbSlbXVtdIHwgdW5kZWZpbmVkKTogSVRyZWVJdGVtW10gfCB1bmRlZmluZWQge1xuXHRpZiAoIXJlc3VsdCB8fCByZXN1bHQubGVuZ3RoID09PSAwKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXHRpZiAocmVzdWx0Lmxlbmd0aCA+IDEpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgcmVzdWx0IGxlbmd0aCwgYWxsIHRlc3RzIGFyZSB1bmJhdGNoZWQuJyk7XG5cdH1cblx0cmV0dXJuIHJlc3VsdFswXS5zbGljZSgxKSBhcyBJVHJlZUl0ZW1bXTtcbn1cblxuc3VpdGUoJ0V4dEhvc3RUcmVlVmlldycsIGZ1bmN0aW9uICgpIHtcblx0Y29uc3Qgc3RvcmUgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRjbGFzcyBSZWNvcmRpbmdTaGFwZSBleHRlbmRzIG1vY2s8TWFpblRocmVhZFRyZWVWaWV3c1NoYXBlPigpIHtcblxuXHRcdG9uUmVmcmVzaCA9IG5ldyBFbWl0dGVyPHsgW3RyZWVJdGVtSGFuZGxlOiBzdHJpbmddOiBJVHJlZUl0ZW0gfT4oKTtcblxuXHRcdG92ZXJyaWRlIGFzeW5jICRyZWdpc3RlclRyZWVWaWV3RGF0YVByb3ZpZGVyKHRyZWVWaWV3SWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdH1cblxuXHRcdG92ZXJyaWRlICRyZWZyZXNoKHZpZXdJZDogc3RyaW5nLCBpdGVtc1RvUmVmcmVzaDogeyBbdHJlZUl0ZW1IYW5kbGU6IHN0cmluZ106IElUcmVlSXRlbSB9KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHR0aGlzLm9uUmVmcmVzaC5maXJlKGl0ZW1zVG9SZWZyZXNoKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdG92ZXJyaWRlICRyZXZlYWwodHJlZVZpZXdJZDogc3RyaW5nLCBpdGVtSW5mbzogeyBpdGVtOiBJVHJlZUl0ZW07IHBhcmVudENoYWluOiBJVHJlZUl0ZW1bXSB9IHwgdW5kZWZpbmVkLCBvcHRpb25zOiBJUmV2ZWFsT3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdH1cblxuXHRcdG92ZXJyaWRlICRkaXNwb3NlVHJlZSh0cmVlVmlld0lkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0XHR9XG5cblx0fVxuXG5cdGxldCB0ZXN0T2JqZWN0OiBFeHRIb3N0VHJlZVZpZXdzO1xuXHRsZXQgdGFyZ2V0OiBSZWNvcmRpbmdTaGFwZTtcblx0bGV0IG9uRGlkQ2hhbmdlVHJlZU5vZGU6IEVtaXR0ZXI8eyBrZXk6IHN0cmluZyB9IHwgdW5kZWZpbmVkPjtcblx0bGV0IG9uRGlkQ2hhbmdlVHJlZU5vZGVXaXRoSWQ6IEVtaXR0ZXI8eyBrZXk6IHN0cmluZyB9Pjtcblx0bGV0IHRyZWU6IHsgW2tleTogc3RyaW5nXTogYW55IH07XG5cdGxldCBsYWJlbHM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH07XG5cdGxldCBub2RlczogeyBba2V5OiBzdHJpbmddOiB7IGtleTogc3RyaW5nIH0gfTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0dHJlZSA9IHtcblx0XHRcdCdhJzoge1xuXHRcdFx0XHQnYWEnOiB7fSxcblx0XHRcdFx0J2FiJzoge31cblx0XHRcdH0sXG5cdFx0XHQnYic6IHtcblx0XHRcdFx0J2JhJzoge30sXG5cdFx0XHRcdCdiYic6IHt9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGxhYmVscyA9IHt9O1xuXHRcdG5vZGVzID0ge307XG5cblx0XHRjb25zdCBycGNQcm90b2NvbCA9IG5ldyBUZXN0UlBDUHJvdG9jb2woKTtcblxuXHRcdHJwY1Byb3RvY29sLnNldChNYWluQ29udGV4dC5NYWluVGhyZWFkQ29tbWFuZHMsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8TWFpblRocmVhZENvbW1hbmRzU2hhcGU+KCkge1xuXHRcdFx0b3ZlcnJpZGUgJHJlZ2lzdGVyQ29tbWFuZCgpIHsgfVxuXHRcdH0pO1xuXHRcdHRhcmdldCA9IG5ldyBSZWNvcmRpbmdTaGFwZSgpO1xuXHRcdHRlc3RPYmplY3QgPSBzdG9yZS5hZGQobmV3IEV4dEhvc3RUcmVlVmlld3ModGFyZ2V0LCBuZXcgRXh0SG9zdENvbW1hbmRzKFxuXHRcdFx0cnBjUHJvdG9jb2wsXG5cdFx0XHRuZXcgTnVsbExvZ1NlcnZpY2UoKSxcblx0XHRcdG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUV4dEhvc3RUZWxlbWV0cnk+KCkge1xuXHRcdFx0XHRvdmVycmlkZSBvbkV4dGVuc2lvbkVycm9yKCk6IGJvb2xlYW4ge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0KSwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpKTtcblx0XHRvbkRpZENoYW5nZVRyZWVOb2RlID0gbmV3IEVtaXR0ZXI8eyBrZXk6IHN0cmluZyB9IHwgdW5kZWZpbmVkPigpO1xuXHRcdG9uRGlkQ2hhbmdlVHJlZU5vZGVXaXRoSWQgPSBuZXcgRW1pdHRlcjx7IGtleTogc3RyaW5nIH0+KCk7XG5cdFx0dGVzdE9iamVjdC5jcmVhdGVUcmVlVmlldygndGVzdE5vZGVUcmVlUHJvdmlkZXInLCB7IHRyZWVEYXRhUHJvdmlkZXI6IGFOb2RlVHJlZURhdGFQcm92aWRlcigpIH0sIGV4dGVuc2lvbnNEZXNjcmlwdGlvbik7XG5cdFx0dGVzdE9iamVjdC5jcmVhdGVUcmVlVmlldygndGVzdE5vZGVXaXRoSWRUcmVlUHJvdmlkZXInLCB7IHRyZWVEYXRhUHJvdmlkZXI6IGFOb2RlV2l0aElkVHJlZURhdGFQcm92aWRlcigpIH0sIGV4dGVuc2lvbnNEZXNjcmlwdGlvbik7XG5cdFx0dGVzdE9iamVjdC5jcmVhdGVUcmVlVmlldygndGVzdE5vZGVXaXRoSGlnaGxpZ2h0c1RyZWVQcm92aWRlcicsIHsgdHJlZURhdGFQcm92aWRlcjogYU5vZGVXaXRoSGlnaGxpZ2h0ZWRMYWJlbFRyZWVEYXRhUHJvdmlkZXIoKSB9LCBleHRlbnNpb25zRGVzY3JpcHRpb24pO1xuXG5cdFx0cmV0dXJuIGxvYWRDb21wbGV0ZVRyZWUoJ3Rlc3ROb2RlVHJlZVByb3ZpZGVyJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbnN0cnVjdCBub2RlIHRyZWUnLCAoKSA9PiB7XG5cdFx0cmV0dXJuIHRlc3RPYmplY3QuJGdldENoaWxkcmVuKCd0ZXN0Tm9kZVRyZWVQcm92aWRlcicpXG5cdFx0XHQudGhlbihlbGVtZW50cyA9PiB7XG5cdFx0XHRcdGNvbnN0IGFjdHVhbHMgPSB1bkJhdGNoQ2hpbGRyZW4oZWxlbWVudHMpPy5tYXAoZSA9PiBlLmhhbmRsZSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFscywgWycwLzA6YScsICcwLzA6YiddKTtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UuYWxsKFtcblx0XHRcdFx0XHR0ZXN0T2JqZWN0LiRnZXRDaGlsZHJlbigndGVzdE5vZGVUcmVlUHJvdmlkZXInLCBbJzAvMDphJ10pXG5cdFx0XHRcdFx0XHQudGhlbihjaGlsZHJlbiA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGFjdHVhbHMgPSB1bkJhdGNoQ2hpbGRyZW4oY2hpbGRyZW4pPy5tYXAoZSA9PiBlLmhhbmRsZSk7XG5cdFx0XHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFscywgWycwLzA6YS8wOmFhJywgJzAvMDphLzA6YWInXSk7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBQcm9taXNlLmFsbChbXG5cdFx0XHRcdFx0XHRcdFx0dGVzdE9iamVjdC4kZ2V0Q2hpbGRyZW4oJ3Rlc3ROb2RlVHJlZVByb3ZpZGVyJywgWycwLzA6YS8wOmFhJ10pLnRoZW4oY2hpbGRyZW4gPT4gYXNzZXJ0LnN0cmljdEVxdWFsKHVuQmF0Y2hDaGlsZHJlbihjaGlsZHJlbik/Lmxlbmd0aCwgMCkpLFxuXHRcdFx0XHRcdFx0XHRcdHRlc3RPYmplY3QuJGdldENoaWxkcmVuKCd0ZXN0Tm9kZVRyZWVQcm92aWRlcicsIFsnMC8wOmEvMDphYiddKS50aGVuKGNoaWxkcmVuID0+IGFzc2VydC5zdHJpY3RFcXVhbCh1bkJhdGNoQ2hpbGRyZW4oY2hpbGRyZW4pPy5sZW5ndGgsIDApKVxuXHRcdFx0XHRcdFx0XHRdKTtcblx0XHRcdFx0XHRcdH0pLFxuXHRcdFx0XHRcdHRlc3RPYmplY3QuJGdldENoaWxkcmVuKCd0ZXN0Tm9kZVRyZWVQcm92aWRlcicsIFsnMC8wOmInXSlcblx0XHRcdFx0XHRcdC50aGVuKGNoaWxkcmVuID0+IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgYWN0dWFscyA9IHVuQmF0Y2hDaGlsZHJlbihjaGlsZHJlbik/Lm1hcChlID0+IGUuaGFuZGxlKTtcblx0XHRcdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWxzLCBbJzAvMDpiLzA6YmEnLCAnMC8wOmIvMDpiYiddKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIFByb21pc2UuYWxsKFtcblx0XHRcdFx0XHRcdFx0XHR0ZXN0T2JqZWN0LiRnZXRDaGlsZHJlbigndGVzdE5vZGVUcmVlUHJvdmlkZXInLCBbJzAvMDpiLzA6YmEnXSkudGhlbihjaGlsZHJlbiA9PiBhc3NlcnQuc3RyaWN0RXF1YWwodW5CYXRjaENoaWxkcmVuKGNoaWxkcmVuKT8ubGVuZ3RoLCAwKSksXG5cdFx0XHRcdFx0XHRcdFx0dGVzdE9iamVjdC4kZ2V0Q2hpbGRyZW4oJ3Rlc3ROb2RlVHJlZVByb3ZpZGVyJywgWycwLzA6Yi8wOmJiJ10pLnRoZW4oY2hpbGRyZW4gPT4gYXNzZXJ0LnN0cmljdEVxdWFsKHVuQmF0Y2hDaGlsZHJlbihjaGlsZHJlbik/Lmxlbmd0aCwgMCkpXG5cdFx0XHRcdFx0XHRcdF0pO1xuXHRcdFx0XHRcdFx0fSlcblx0XHRcdFx0XSk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnY29uc3RydWN0IGlkIHRyZWUnLCAoKSA9PiB7XG5cdFx0cmV0dXJuIHRlc3RPYmplY3QuJGdldENoaWxkcmVuKCd0ZXN0Tm9kZVdpdGhJZFRyZWVQcm92aWRlcicpXG5cdFx0XHQudGhlbihlbGVtZW50cyA9PiB7XG5cdFx0XHRcdGNvbnN0IGFjdHVhbHMgPSB1bkJhdGNoQ2hpbGRyZW4oZWxlbWVudHMpPy5tYXAoZSA9PiBlLmhhbmRsZSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFscywgWycxL2EnLCAnMS9iJ10pO1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5hbGwoW1xuXHRcdFx0XHRcdHRlc3RPYmplY3QuJGdldENoaWxkcmVuKCd0ZXN0Tm9kZVdpdGhJZFRyZWVQcm92aWRlcicsIFsnMS9hJ10pXG5cdFx0XHRcdFx0XHQudGhlbihjaGlsZHJlbiA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGFjdHVhbHMgPSB1bkJhdGNoQ2hpbGRyZW4oY2hpbGRyZW4pPy5tYXAoZSA9PiBlLmhhbmRsZSk7XG5cdFx0XHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFscywgWycxL2FhJywgJzEvYWInXSk7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBQcm9taXNlLmFsbChbXG5cdFx0XHRcdFx0XHRcdFx0dGVzdE9iamVjdC4kZ2V0Q2hpbGRyZW4oJ3Rlc3ROb2RlV2l0aElkVHJlZVByb3ZpZGVyJywgWycxL2FhJ10pLnRoZW4oY2hpbGRyZW4gPT4gYXNzZXJ0LnN0cmljdEVxdWFsKHVuQmF0Y2hDaGlsZHJlbihjaGlsZHJlbik/Lmxlbmd0aCwgMCkpLFxuXHRcdFx0XHRcdFx0XHRcdHRlc3RPYmplY3QuJGdldENoaWxkcmVuKCd0ZXN0Tm9kZVdpdGhJZFRyZWVQcm92aWRlcicsIFsnMS9hYiddKS50aGVuKGNoaWxkcmVuID0+IGFzc2VydC5zdHJpY3RFcXVhbCh1bkJhdGNoQ2hpbGRyZW4oY2hpbGRyZW4pPy5sZW5ndGgsIDApKVxuXHRcdFx0XHRcdFx0XHRdKTtcblx0XHRcdFx0XHRcdH0pLFxuXHRcdFx0XHRcdHRlc3RPYmplY3QuJGdldENoaWxkcmVuKCd0ZXN0Tm9kZVdpdGhJZFRyZWVQcm92aWRlcicsIFsnMS9iJ10pXG5cdFx0XHRcdFx0XHQudGhlbihjaGlsZHJlbiA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGFjdHVhbHMgPSB1bkJhdGNoQ2hpbGRyZW4oY2hpbGRyZW4pPy5tYXAoZSA9PiBlLmhhbmRsZSk7XG5cdFx0XHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFscywgWycxL2JhJywgJzEvYmInXSk7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBQcm9taXNlLmFsbChbXG5cdFx0XHRcdFx0XHRcdFx0dGVzdE9iamVjdC4kZ2V0Q2hpbGRyZW4oJ3Rlc3ROb2RlV2l0aElkVHJlZVByb3ZpZGVyJywgWycxL2JhJ10pLnRoZW4oY2hpbGRyZW4gPT4gYXNzZXJ0LnN0cmljdEVxdWFsKHVuQmF0Y2hDaGlsZHJlbihjaGlsZHJlbik/Lmxlbmd0aCwgMCkpLFxuXHRcdFx0XHRcdFx0XHRcdHRlc3RPYmplY3QuJGdldENoaWxkcmVuKCd0ZXN0Tm9kZVdpdGhJZFRyZWVQcm92aWRlcicsIFsnMS9iYiddKS50aGVuKGNoaWxkcmVuID0+IGFzc2VydC5zdHJpY3RFcXVhbCh1bkJhdGNoQ2hpbGRyZW4oY2hpbGRyZW4pPy5sZW5ndGgsIDApKVxuXHRcdFx0XHRcdFx0XHRdKTtcblx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdF0pO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbnN0cnVjdCBoaWdobGlnaHRzIHRyZWUnLCAoKSA9PiB7XG5cdFx0cmV0dXJuIHRlc3RPYmplY3QuJGdldENoaWxkcmVuKCd0ZXN0Tm9kZVdpdGhIaWdobGlnaHRzVHJlZVByb3ZpZGVyJylcblx0XHRcdC50aGVuKGVsZW1lbnRzID0+IHtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZW1vdmVVbnNldEtleXModW5CYXRjaENoaWxkcmVuKGVsZW1lbnRzKSksIFt7XG5cdFx0XHRcdFx0aGFuZGxlOiAnMS9hJyxcblx0XHRcdFx0XHRsYWJlbDogeyBsYWJlbDogJ2EnLCBoaWdobGlnaHRzOiBbWzAsIDJdLCBbMywgNV1dIH0sXG5cdFx0XHRcdFx0Y29sbGFwc2libGVTdGF0ZTogVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLkNvbGxhcHNlZFxuXHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0aGFuZGxlOiAnMS9iJyxcblx0XHRcdFx0XHRsYWJlbDogeyBsYWJlbDogJ2InLCBoaWdobGlnaHRzOiBbWzAsIDJdLCBbMywgNV1dIH0sXG5cdFx0XHRcdFx0Y29sbGFwc2libGVTdGF0ZTogVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLkNvbGxhcHNlZFxuXHRcdFx0XHR9XSk7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLmFsbChbXG5cdFx0XHRcdFx0dGVzdE9iamVjdC4kZ2V0Q2hpbGRyZW4oJ3Rlc3ROb2RlV2l0aEhpZ2hsaWdodHNUcmVlUHJvdmlkZXInLCBbJzEvYSddKVxuXHRcdFx0XHRcdFx0LnRoZW4oY2hpbGRyZW4gPT4ge1xuXHRcdFx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlbW92ZVVuc2V0S2V5cyh1bkJhdGNoQ2hpbGRyZW4oY2hpbGRyZW4pKSwgW3tcblx0XHRcdFx0XHRcdFx0XHRoYW5kbGU6ICcxL2FhJyxcblx0XHRcdFx0XHRcdFx0XHRwYXJlbnRIYW5kbGU6ICcxL2EnLFxuXHRcdFx0XHRcdFx0XHRcdGxhYmVsOiB7IGxhYmVsOiAnYWEnLCBoaWdobGlnaHRzOiBbWzAsIDJdLCBbMywgNV1dIH0sXG5cdFx0XHRcdFx0XHRcdFx0Y29sbGFwc2libGVTdGF0ZTogVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLk5vbmVcblx0XHRcdFx0XHRcdFx0fSwge1xuXHRcdFx0XHRcdFx0XHRcdGhhbmRsZTogJzEvYWInLFxuXHRcdFx0XHRcdFx0XHRcdHBhcmVudEhhbmRsZTogJzEvYScsXG5cdFx0XHRcdFx0XHRcdFx0bGFiZWw6IHsgbGFiZWw6ICdhYicsIGhpZ2hsaWdodHM6IFtbMCwgMl0sIFszLCA1XV0gfSxcblx0XHRcdFx0XHRcdFx0XHRjb2xsYXBzaWJsZVN0YXRlOiBUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUuTm9uZVxuXHRcdFx0XHRcdFx0XHR9XSk7XG5cdFx0XHRcdFx0XHR9KSxcblx0XHRcdFx0XHR0ZXN0T2JqZWN0LiRnZXRDaGlsZHJlbigndGVzdE5vZGVXaXRoSGlnaGxpZ2h0c1RyZWVQcm92aWRlcicsIFsnMS9iJ10pXG5cdFx0XHRcdFx0XHQudGhlbihjaGlsZHJlbiA9PiB7XG5cdFx0XHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVtb3ZlVW5zZXRLZXlzKHVuQmF0Y2hDaGlsZHJlbihjaGlsZHJlbikpLCBbe1xuXHRcdFx0XHRcdFx0XHRcdGhhbmRsZTogJzEvYmEnLFxuXHRcdFx0XHRcdFx0XHRcdHBhcmVudEhhbmRsZTogJzEvYicsXG5cdFx0XHRcdFx0XHRcdFx0bGFiZWw6IHsgbGFiZWw6ICdiYScsIGhpZ2hsaWdodHM6IFtbMCwgMl0sIFszLCA1XV0gfSxcblx0XHRcdFx0XHRcdFx0XHRjb2xsYXBzaWJsZVN0YXRlOiBUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUuTm9uZVxuXHRcdFx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHRcdFx0aGFuZGxlOiAnMS9iYicsXG5cdFx0XHRcdFx0XHRcdFx0cGFyZW50SGFuZGxlOiAnMS9iJyxcblx0XHRcdFx0XHRcdFx0XHRsYWJlbDogeyBsYWJlbDogJ2JiJywgaGlnaGxpZ2h0czogW1swLCAyXSwgWzMsIDVdXSB9LFxuXHRcdFx0XHRcdFx0XHRcdGNvbGxhcHNpYmxlU3RhdGU6IFRyZWVJdGVtQ29sbGFwc2libGVTdGF0ZS5Ob25lXG5cdFx0XHRcdFx0XHRcdH1dKTtcblx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdF0pO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Vycm9yIGlzIHRocm93biBpZiBpZCBpcyBub3QgdW5pcXVlJywgKGRvbmUpID0+IHtcblx0XHR0cmVlWydhJ10gPSB7XG5cdFx0XHQnYWEnOiB7fSxcblx0XHR9O1xuXHRcdHRyZWVbJ2InXSA9IHtcblx0XHRcdCdhYSc6IHt9LFxuXHRcdFx0J2JhJzoge31cblx0XHR9O1xuXHRcdGxldCBjYXVnaHRFeHBlY3RlZEVycm9yID0gZmFsc2U7XG5cdFx0c3RvcmUuYWRkKHRhcmdldC5vblJlZnJlc2guZXZlbnQoKCkgPT4ge1xuXHRcdFx0dGVzdE9iamVjdC4kZ2V0Q2hpbGRyZW4oJ3Rlc3ROb2RlV2l0aElkVHJlZVByb3ZpZGVyJylcblx0XHRcdFx0LnRoZW4oZWxlbWVudHMgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGFjdHVhbHMgPSB1bkJhdGNoQ2hpbGRyZW4oZWxlbWVudHMpPy5tYXAoZSA9PiBlLmhhbmRsZSk7XG5cdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWxzLCBbJzEvYScsICcxL2InXSk7XG5cdFx0XHRcdFx0cmV0dXJuIHRlc3RPYmplY3QuJGdldENoaWxkcmVuKCd0ZXN0Tm9kZVdpdGhJZFRyZWVQcm92aWRlcicsIFsnMS9hJ10pXG5cdFx0XHRcdFx0XHQudGhlbigoKSA9PiB0ZXN0T2JqZWN0LiRnZXRDaGlsZHJlbigndGVzdE5vZGVXaXRoSWRUcmVlUHJvdmlkZXInLCBbJzEvYiddKSlcblx0XHRcdFx0XHRcdC50aGVuKCgpID0+IGFzc2VydC5mYWlsKCdTaG91bGQgZmFpbCB3aXRoIGR1cGxpY2F0ZSBpZCcpKVxuXHRcdFx0XHRcdFx0LmNhdGNoKCgpID0+IGNhdWdodEV4cGVjdGVkRXJyb3IgPSB0cnVlKVxuXHRcdFx0XHRcdFx0LmZpbmFsbHkoKCkgPT4gY2F1Z2h0RXhwZWN0ZWRFcnJvciA/IGRvbmUoKSA6IGFzc2VydC5mYWlsKCdFeHBlY3RlZCBkdXBsaWNhdGUgaWQgZXJyb3Igbm90IHRocm93bi4nKSk7XG5cdFx0XHRcdH0pO1xuXHRcdH0pKTtcblx0XHRvbkRpZENoYW5nZVRyZWVOb2RlLmZpcmUodW5kZWZpbmVkKTtcblx0fSk7XG5cblx0dGVzdCgncmVmcmVzaCByb290JywgZnVuY3Rpb24gKGRvbmUpIHtcblx0XHRzdG9yZS5hZGQodGFyZ2V0Lm9uUmVmcmVzaC5ldmVudChhY3R1YWxzID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bmRlZmluZWQsIGFjdHVhbHMpO1xuXHRcdFx0ZG9uZSgpO1xuXHRcdH0pKTtcblx0XHRvbkRpZENoYW5nZVRyZWVOb2RlLmZpcmUodW5kZWZpbmVkKTtcblx0fSk7XG5cblx0dGVzdCgncmVmcmVzaCBhIHBhcmVudCBub2RlJywgKCkgPT4ge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgoYywgZSkgPT4ge1xuXHRcdFx0c3RvcmUuYWRkKHRhcmdldC5vblJlZnJlc2guZXZlbnQoYWN0dWFscyA9PiB7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoWycwLzA6YiddLCBPYmplY3Qua2V5cyhhY3R1YWxzKSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVtb3ZlVW5zZXRLZXlzKGFjdHVhbHNbJzAvMDpiJ10pLCB7XG5cdFx0XHRcdFx0aGFuZGxlOiAnMC8wOmInLFxuXHRcdFx0XHRcdGxhYmVsOiB7IGxhYmVsOiAnYicgfSxcblx0XHRcdFx0XHRjb2xsYXBzaWJsZVN0YXRlOiBUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUuQ29sbGFwc2VkXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRjKHVuZGVmaW5lZCk7XG5cdFx0XHR9KSk7XG5cdFx0XHRvbkRpZENoYW5nZVRyZWVOb2RlLmZpcmUoZ2V0Tm9kZSgnYicpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgncmVmcmVzaCBhIGxlYWYgbm9kZScsIGZ1bmN0aW9uIChkb25lKSB7XG5cdFx0c3RvcmUuYWRkKHRhcmdldC5vblJlZnJlc2guZXZlbnQoYWN0dWFscyA9PiB7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFsnMC8wOmIvMDpiYiddLCBPYmplY3Qua2V5cyhhY3R1YWxzKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlbW92ZVVuc2V0S2V5cyhhY3R1YWxzWycwLzA6Yi8wOmJiJ10pLCB7XG5cdFx0XHRcdGhhbmRsZTogJzAvMDpiLzA6YmInLFxuXHRcdFx0XHRwYXJlbnRIYW5kbGU6ICcwLzA6YicsXG5cdFx0XHRcdGxhYmVsOiB7IGxhYmVsOiAnYmInIH0sXG5cdFx0XHRcdGNvbGxhcHNpYmxlU3RhdGU6IFRyZWVJdGVtQ29sbGFwc2libGVTdGF0ZS5Ob25lXG5cdFx0XHR9KTtcblx0XHRcdGRvbmUoKTtcblx0XHR9KSk7XG5cdFx0b25EaWRDaGFuZ2VUcmVlTm9kZS5maXJlKGdldE5vZGUoJ2JiJykpO1xuXHR9KTtcblxuXHRhc3luYyBmdW5jdGlvbiBydW5XaXRoRXZlbnRNZXJnaW5nKGFjdGlvbjogKHJlc29sdmU6ICgpID0+IHZvaWQpID0+IHZvaWQpIHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnMoe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XG5cdFx0XHRcdGxldCBzdWJzY3JpcHRpb246IElEaXNwb3NhYmxlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRzdWJzY3JpcHRpb24gPSB0YXJnZXQub25SZWZyZXNoLmV2ZW50KCgpID0+IHtcblx0XHRcdFx0XHRzdWJzY3JpcHRpb24hLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRvbkRpZENoYW5nZVRyZWVOb2RlLmZpcmUoZ2V0Tm9kZSgnYicpKTtcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4oYWN0aW9uKTtcblx0XHR9KTtcblx0fVxuXG5cdHRlc3QoJ3JlZnJlc2ggcGFyZW50IGFuZCBjaGlsZCBub2RlIHRyaWdnZXIgcmVmcmVzaCBvbmx5IG9uIHBhcmVudCAtIHNjZW5hcmlvIDEnLCBhc3luYyAoKSA9PiB7XG5cdFx0cmV0dXJuIHJ1bldpdGhFdmVudE1lcmdpbmcoKHJlc29sdmUpID0+IHtcblx0XHRcdHN0b3JlLmFkZCh0YXJnZXQub25SZWZyZXNoLmV2ZW50KGFjdHVhbHMgPT4ge1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFsnMC8wOmInLCAnMC8wOmEvMDphYSddLCBPYmplY3Qua2V5cyhhY3R1YWxzKSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVtb3ZlVW5zZXRLZXlzKGFjdHVhbHNbJzAvMDpiJ10pLCB7XG5cdFx0XHRcdFx0aGFuZGxlOiAnMC8wOmInLFxuXHRcdFx0XHRcdGxhYmVsOiB7IGxhYmVsOiAnYicgfSxcblx0XHRcdFx0XHRjb2xsYXBzaWJsZVN0YXRlOiBUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUuQ29sbGFwc2VkXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlbW92ZVVuc2V0S2V5cyhhY3R1YWxzWycwLzA6YS8wOmFhJ10pLCB7XG5cdFx0XHRcdFx0aGFuZGxlOiAnMC8wOmEvMDphYScsXG5cdFx0XHRcdFx0cGFyZW50SGFuZGxlOiAnMC8wOmEnLFxuXHRcdFx0XHRcdGxhYmVsOiB7IGxhYmVsOiAnYWEnIH0sXG5cdFx0XHRcdFx0Y29sbGFwc2libGVTdGF0ZTogVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLk5vbmVcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdH0pKTtcblx0XHRcdG9uRGlkQ2hhbmdlVHJlZU5vZGUuZmlyZShnZXROb2RlKCdiJykpO1xuXHRcdFx0b25EaWRDaGFuZ2VUcmVlTm9kZS5maXJlKGdldE5vZGUoJ2FhJykpO1xuXHRcdFx0b25EaWRDaGFuZ2VUcmVlTm9kZS5maXJlKGdldE5vZGUoJ2JiJykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWZyZXNoIHBhcmVudCBhbmQgY2hpbGQgbm9kZSB0cmlnZ2VyIHJlZnJlc2ggb25seSBvbiBwYXJlbnQgLSBzY2VuYXJpbyAyJywgYXN5bmMgKCkgPT4ge1xuXHRcdHJldHVybiBydW5XaXRoRXZlbnRNZXJnaW5nKChyZXNvbHZlKSA9PiB7XG5cdFx0XHRzdG9yZS5hZGQodGFyZ2V0Lm9uUmVmcmVzaC5ldmVudChhY3R1YWxzID0+IHtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChbJzAvMDphLzA6YWEnLCAnMC8wOmInXSwgT2JqZWN0LmtleXMoYWN0dWFscykpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlbW92ZVVuc2V0S2V5cyhhY3R1YWxzWycwLzA6YiddKSwge1xuXHRcdFx0XHRcdGhhbmRsZTogJzAvMDpiJyxcblx0XHRcdFx0XHRsYWJlbDogeyBsYWJlbDogJ2InIH0sXG5cdFx0XHRcdFx0Y29sbGFwc2libGVTdGF0ZTogVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLkNvbGxhcHNlZFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZW1vdmVVbnNldEtleXMoYWN0dWFsc1snMC8wOmEvMDphYSddKSwge1xuXHRcdFx0XHRcdGhhbmRsZTogJzAvMDphLzA6YWEnLFxuXHRcdFx0XHRcdHBhcmVudEhhbmRsZTogJzAvMDphJyxcblx0XHRcdFx0XHRsYWJlbDogeyBsYWJlbDogJ2FhJyB9LFxuXHRcdFx0XHRcdGNvbGxhcHNpYmxlU3RhdGU6IFRyZWVJdGVtQ29sbGFwc2libGVTdGF0ZS5Ob25lXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHR9KSk7XG5cdFx0XHRvbkRpZENoYW5nZVRyZWVOb2RlLmZpcmUoZ2V0Tm9kZSgnYmInKSk7XG5cdFx0XHRvbkRpZENoYW5nZVRyZWVOb2RlLmZpcmUoZ2V0Tm9kZSgnYWEnKSk7XG5cdFx0XHRvbkRpZENoYW5nZVRyZWVOb2RlLmZpcmUoZ2V0Tm9kZSgnYicpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgncmVmcmVzaCBhbiBlbGVtZW50IGZvciBsYWJlbCBjaGFuZ2UnLCBmdW5jdGlvbiAoZG9uZSkge1xuXHRcdGxhYmVsc1snYSddID0gJ2FhJztcblx0XHRzdG9yZS5hZGQodGFyZ2V0Lm9uUmVmcmVzaC5ldmVudChhY3R1YWxzID0+IHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoWycwLzA6YSddLCBPYmplY3Qua2V5cyhhY3R1YWxzKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlbW92ZVVuc2V0S2V5cyhhY3R1YWxzWycwLzA6YSddKSwge1xuXHRcdFx0XHRoYW5kbGU6ICcwLzA6YWEnLFxuXHRcdFx0XHRsYWJlbDogeyBsYWJlbDogJ2FhJyB9LFxuXHRcdFx0XHRjb2xsYXBzaWJsZVN0YXRlOiBUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUuQ29sbGFwc2VkXG5cdFx0XHR9KTtcblx0XHRcdGRvbmUoKTtcblx0XHR9KSk7XG5cdFx0b25EaWRDaGFuZ2VUcmVlTm9kZS5maXJlKGdldE5vZGUoJ2EnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlZnJlc2ggY2FsbHMgYXJlIHRocm90dGxlZCBvbiByb290cycsICgpID0+IHtcblx0XHRyZXR1cm4gcnVuV2l0aEV2ZW50TWVyZ2luZygocmVzb2x2ZSkgPT4ge1xuXHRcdFx0c3RvcmUuYWRkKHRhcmdldC5vblJlZnJlc2guZXZlbnQoYWN0dWFscyA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bmRlZmluZWQsIGFjdHVhbHMpO1xuXHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHR9KSk7XG5cdFx0XHRvbkRpZENoYW5nZVRyZWVOb2RlLmZpcmUodW5kZWZpbmVkKTtcblx0XHRcdG9uRGlkQ2hhbmdlVHJlZU5vZGUuZmlyZSh1bmRlZmluZWQpO1xuXHRcdFx0b25EaWRDaGFuZ2VUcmVlTm9kZS5maXJlKHVuZGVmaW5lZCk7XG5cdFx0XHRvbkRpZENoYW5nZVRyZWVOb2RlLmZpcmUodW5kZWZpbmVkKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgncmVmcmVzaCBjYWxscyBhcmUgdGhyb3R0bGVkIG9uIGVsZW1lbnRzJywgKCkgPT4ge1xuXHRcdHJldHVybiBydW5XaXRoRXZlbnRNZXJnaW5nKChyZXNvbHZlKSA9PiB7XG5cdFx0XHRzdG9yZS5hZGQodGFyZ2V0Lm9uUmVmcmVzaC5ldmVudChhY3R1YWxzID0+IHtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChbJzAvMDphJywgJzAvMDpiJ10sIE9iamVjdC5rZXlzKGFjdHVhbHMpKTtcblx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHRvbkRpZENoYW5nZVRyZWVOb2RlLmZpcmUoZ2V0Tm9kZSgnYScpKTtcblx0XHRcdG9uRGlkQ2hhbmdlVHJlZU5vZGUuZmlyZShnZXROb2RlKCdiJykpO1xuXHRcdFx0b25EaWRDaGFuZ2VUcmVlTm9kZS5maXJlKGdldE5vZGUoJ2InKSk7XG5cdFx0XHRvbkRpZENoYW5nZVRyZWVOb2RlLmZpcmUoZ2V0Tm9kZSgnYScpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgncmVmcmVzaCBjYWxscyBhcmUgdGhyb3R0bGVkIG9uIHVua25vd24gZWxlbWVudHMnLCAoKSA9PiB7XG5cdFx0cmV0dXJuIHJ1bldpdGhFdmVudE1lcmdpbmcoKHJlc29sdmUpID0+IHtcblx0XHRcdHN0b3JlLmFkZCh0YXJnZXQub25SZWZyZXNoLmV2ZW50KGFjdHVhbHMgPT4ge1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFsnMC8wOmEnLCAnMC8wOmInXSwgT2JqZWN0LmtleXMoYWN0dWFscykpO1xuXHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHR9KSk7XG5cblx0XHRcdG9uRGlkQ2hhbmdlVHJlZU5vZGUuZmlyZShnZXROb2RlKCdhJykpO1xuXHRcdFx0b25EaWRDaGFuZ2VUcmVlTm9kZS5maXJlKGdldE5vZGUoJ2InKSk7XG5cdFx0XHRvbkRpZENoYW5nZVRyZWVOb2RlLmZpcmUoZ2V0Tm9kZSgnZycpKTtcblx0XHRcdG9uRGlkQ2hhbmdlVHJlZU5vZGUuZmlyZShnZXROb2RlKCdhJykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWZyZXNoIGNhbGxzIGFyZSB0aHJvdHRsZWQgb24gdW5rbm93biBlbGVtZW50cyBhbmQgcm9vdCcsICgpID0+IHtcblx0XHRyZXR1cm4gcnVuV2l0aEV2ZW50TWVyZ2luZygocmVzb2x2ZSkgPT4ge1xuXHRcdFx0c3RvcmUuYWRkKHRhcmdldC5vblJlZnJlc2guZXZlbnQoYWN0dWFscyA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bmRlZmluZWQsIGFjdHVhbHMpO1xuXHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHR9KSk7XG5cblx0XHRcdG9uRGlkQ2hhbmdlVHJlZU5vZGUuZmlyZShnZXROb2RlKCdhJykpO1xuXHRcdFx0b25EaWRDaGFuZ2VUcmVlTm9kZS5maXJlKGdldE5vZGUoJ2InKSk7XG5cdFx0XHRvbkRpZENoYW5nZVRyZWVOb2RlLmZpcmUoZ2V0Tm9kZSgnZycpKTtcblx0XHRcdG9uRGlkQ2hhbmdlVHJlZU5vZGUuZmlyZSh1bmRlZmluZWQpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWZyZXNoIGNhbGxzIGFyZSB0aHJvdHRsZWQgb24gZWxlbWVudHMgYW5kIHJvb3QnLCAoKSA9PiB7XG5cdFx0cmV0dXJuIHJ1bldpdGhFdmVudE1lcmdpbmcoKHJlc29sdmUpID0+IHtcblx0XHRcdHN0b3JlLmFkZCh0YXJnZXQub25SZWZyZXNoLmV2ZW50KGFjdHVhbHMgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5kZWZpbmVkLCBhY3R1YWxzKTtcblx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHRvbkRpZENoYW5nZVRyZWVOb2RlLmZpcmUoZ2V0Tm9kZSgnYScpKTtcblx0XHRcdG9uRGlkQ2hhbmdlVHJlZU5vZGUuZmlyZShnZXROb2RlKCdiJykpO1xuXHRcdFx0b25EaWRDaGFuZ2VUcmVlTm9kZS5maXJlKHVuZGVmaW5lZCk7XG5cdFx0XHRvbkRpZENoYW5nZVRyZWVOb2RlLmZpcmUoZ2V0Tm9kZSgnYScpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZ2VuZXJhdGUgdW5pcXVlIGhhbmRsZXMgZnJvbSBsYWJlbHMgYnkgZXNjYXBpbmcgdGhlbScsIChkb25lKSA9PiB7XG5cdFx0dHJlZSA9IHtcblx0XHRcdCdhLzA6Yic6IHt9XG5cdFx0fTtcblxuXHRcdHN0b3JlLmFkZCh0YXJnZXQub25SZWZyZXNoLmV2ZW50KCgpID0+IHtcblx0XHRcdHRlc3RPYmplY3QuJGdldENoaWxkcmVuKCd0ZXN0Tm9kZVRyZWVQcm92aWRlcicpXG5cdFx0XHRcdC50aGVuKGVsZW1lbnRzID0+IHtcblx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHVuQmF0Y2hDaGlsZHJlbihlbGVtZW50cyk/Lm1hcChlID0+IGUuaGFuZGxlKSwgWycwLzA6YS8vMDpiJ10pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0fSkpO1xuXHRcdG9uRGlkQ2hhbmdlVHJlZU5vZGUuZmlyZSh1bmRlZmluZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCd0cmVlIHdpdGggZHVwbGljYXRlIGxhYmVscycsIChkb25lKSA9PiB7XG5cblx0XHRjb25zdCBkdXBJdGVtcyA9IHtcblx0XHRcdCdhZHVwMSc6ICdjJyxcblx0XHRcdCdhZHVwMic6ICdnJyxcblx0XHRcdCdiZHVwMSc6ICdlJyxcblx0XHRcdCdoZHVwMSc6ICdpJyxcblx0XHRcdCdoZHVwMic6ICdsJyxcblx0XHRcdCdqZHVwMSc6ICdrJ1xuXHRcdH07XG5cblx0XHRsYWJlbHNbJ2MnXSA9ICdhJztcblx0XHRsYWJlbHNbJ2UnXSA9ICdiJztcblx0XHRsYWJlbHNbJ2cnXSA9ICdhJztcblx0XHRsYWJlbHNbJ2knXSA9ICdoJztcblx0XHRsYWJlbHNbJ2wnXSA9ICdoJztcblx0XHRsYWJlbHNbJ2snXSA9ICdqJztcblxuXHRcdHRyZWVbZHVwSXRlbXNbJ2FkdXAxJ11dID0ge307XG5cdFx0dHJlZVsnZCddID0ge307XG5cblx0XHRjb25zdCBiZHVwMVRyZWU6IHsgW2tleTogc3RyaW5nXTogYW55IH0gPSB7fTtcblx0XHRiZHVwMVRyZWVbJ2gnXSA9IHt9O1xuXHRcdGJkdXAxVHJlZVtkdXBJdGVtc1snaGR1cDEnXV0gPSB7fTtcblx0XHRiZHVwMVRyZWVbJ2onXSA9IHt9O1xuXHRcdGJkdXAxVHJlZVtkdXBJdGVtc1snamR1cDEnXV0gPSB7fTtcblx0XHRiZHVwMVRyZWVbZHVwSXRlbXNbJ2hkdXAyJ11dID0ge307XG5cblx0XHR0cmVlW2R1cEl0ZW1zWydiZHVwMSddXSA9IGJkdXAxVHJlZTtcblx0XHR0cmVlWydmJ10gPSB7fTtcblx0XHR0cmVlW2R1cEl0ZW1zWydhZHVwMiddXSA9IHt9O1xuXG5cdFx0c3RvcmUuYWRkKHRhcmdldC5vblJlZnJlc2guZXZlbnQoKCkgPT4ge1xuXHRcdFx0dGVzdE9iamVjdC4kZ2V0Q2hpbGRyZW4oJ3Rlc3ROb2RlVHJlZVByb3ZpZGVyJylcblx0XHRcdFx0LnRoZW4oZWxlbWVudHMgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGFjdHVhbHMgPSB1bkJhdGNoQ2hpbGRyZW4oZWxlbWVudHMpPy5tYXAoZSA9PiBlLmhhbmRsZSk7XG5cdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWxzLCBbJzAvMDphJywgJzAvMDpiJywgJzAvMTphJywgJzAvMDpkJywgJzAvMTpiJywgJzAvMDpmJywgJzAvMjphJ10pO1xuXHRcdFx0XHRcdHJldHVybiB0ZXN0T2JqZWN0LiRnZXRDaGlsZHJlbigndGVzdE5vZGVUcmVlUHJvdmlkZXInLCBbJzAvMTpiJ10pXG5cdFx0XHRcdFx0XHQudGhlbihlbGVtZW50cyA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGFjdHVhbHMgPSB1bkJhdGNoQ2hpbGRyZW4oZWxlbWVudHMpPy5tYXAoZSA9PiBlLmhhbmRsZSk7XG5cdFx0XHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFscywgWycwLzE6Yi8wOmgnLCAnMC8xOmIvMTpoJywgJzAvMTpiLzA6aicsICcwLzE6Yi8xOmonLCAnMC8xOmIvMjpoJ10pO1xuXHRcdFx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0fSkpO1xuXG5cdFx0b25EaWRDaGFuZ2VUcmVlTm9kZS5maXJlKHVuZGVmaW5lZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldENoaWxkcmVuIGlzIG5vdCByZXR1cm5lZCBmcm9tIGNhY2hlIGlmIHJlZnJlc2hlZCcsIChkb25lKSA9PiB7XG5cdFx0dHJlZSA9IHtcblx0XHRcdCdjJzoge31cblx0XHR9O1xuXG5cdFx0c3RvcmUuYWRkKHRhcmdldC5vblJlZnJlc2guZXZlbnQoKCkgPT4ge1xuXHRcdFx0dGVzdE9iamVjdC4kZ2V0Q2hpbGRyZW4oJ3Rlc3ROb2RlVHJlZVByb3ZpZGVyJylcblx0XHRcdFx0LnRoZW4oZWxlbWVudHMgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodW5CYXRjaENoaWxkcmVuKGVsZW1lbnRzKT8ubWFwKGUgPT4gZS5oYW5kbGUpLCBbJzAvMDpjJ10pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0fSkpO1xuXG5cdFx0b25EaWRDaGFuZ2VUcmVlTm9kZS5maXJlKHVuZGVmaW5lZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldENoaWxkcmVuIGlzIHJldHVybmVkIGZyb20gY2FjaGUgaWYgbm90IHJlZnJlc2hlZCcsICgpID0+IHtcblx0XHR0cmVlID0ge1xuXHRcdFx0J2MnOiB7fVxuXHRcdH07XG5cblx0XHRyZXR1cm4gdGVzdE9iamVjdC4kZ2V0Q2hpbGRyZW4oJ3Rlc3ROb2RlVHJlZVByb3ZpZGVyJylcblx0XHRcdC50aGVuKGVsZW1lbnRzID0+IHtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh1bkJhdGNoQ2hpbGRyZW4oZWxlbWVudHMpPy5tYXAoZSA9PiBlLmhhbmRsZSksIFsnMC8wOmEnLCAnMC8wOmInXSk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgncmV2ZWFsIHdpbGwgdGhyb3cgYW4gZXJyb3IgaWYgZ2V0UGFyZW50IGlzIG5vdCBpbXBsZW1lbnRlZCcsICgpID0+IHtcblx0XHRjb25zdCB0cmVlVmlldyA9IHRlc3RPYmplY3QuY3JlYXRlVHJlZVZpZXcoJ3RyZWVEYXRhUHJvdmlkZXInLCB7IHRyZWVEYXRhUHJvdmlkZXI6IGFOb2RlVHJlZURhdGFQcm92aWRlcigpIH0sIGV4dGVuc2lvbnNEZXNjcmlwdGlvbik7XG5cdFx0cmV0dXJuIHRyZWVWaWV3LnJldmVhbCh7IGtleTogJ2EnIH0pXG5cdFx0XHQudGhlbigoKSA9PiBhc3NlcnQuZmFpbCgnUmV2ZWFsIHNob3VsZCB0aHJvdyBhbiBlcnJvciBhcyBnZXRQYXJlbnQgaXMgbm90IGltcGxlbWVudGVkJyksICgpID0+IG51bGwpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXZlYWwgd2lsbCByZXR1cm4gZW1wdHkgYXJyYXkgZm9yIHJvb3QgZWxlbWVudCcsICgpID0+IHtcblx0XHRjb25zdCByZXZlYWxUYXJnZXQgPSBzaW5vbi5zcHkodGFyZ2V0LCAnJHJldmVhbCcpO1xuXHRcdGNvbnN0IHRyZWVWaWV3ID0gdGVzdE9iamVjdC5jcmVhdGVUcmVlVmlldygndHJlZURhdGFQcm92aWRlcicsIHsgdHJlZURhdGFQcm92aWRlcjogYUNvbXBsZXRlTm9kZVRyZWVEYXRhUHJvdmlkZXIoKSB9LCBleHRlbnNpb25zRGVzY3JpcHRpb24pO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0ge1xuXHRcdFx0aXRlbTpcblx0XHRcdFx0eyBoYW5kbGU6ICcwLzA6YScsIGxhYmVsOiB7IGxhYmVsOiAnYScgfSwgY29sbGFwc2libGVTdGF0ZTogVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLkNvbGxhcHNlZCB9LFxuXHRcdFx0cGFyZW50Q2hhaW46IFtdXG5cdFx0fTtcblx0XHRyZXR1cm4gdHJlZVZpZXcucmV2ZWFsKHsga2V5OiAnYScgfSlcblx0XHRcdC50aGVuKCgpID0+IHtcblx0XHRcdFx0YXNzZXJ0Lm9rKHJldmVhbFRhcmdldC5jYWxsZWRPbmNlKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCgndHJlZURhdGFQcm92aWRlcicsIHJldmVhbFRhcmdldC5hcmdzWzBdWzBdKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChleHBlY3RlZCwgcmVtb3ZlVW5zZXRLZXlzKHJldmVhbFRhcmdldC5hcmdzWzBdWzFdKSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoeyBzZWxlY3Q6IHRydWUsIGZvY3VzOiBmYWxzZSwgZXhwYW5kOiBmYWxzZSB9LCByZXZlYWxUYXJnZXQuYXJnc1swXVsyXSk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgncmV2ZWFsIHdpbGwgcmV0dXJuIHBhcmVudHMgYXJyYXkgZm9yIGFuIGVsZW1lbnQgd2hlbiBoaWVyYXJjaHkgaXMgbm90IGxvYWRlZCcsICgpID0+IHtcblx0XHRjb25zdCByZXZlYWxUYXJnZXQgPSBzaW5vbi5zcHkodGFyZ2V0LCAnJHJldmVhbCcpO1xuXHRcdGNvbnN0IHRyZWVWaWV3ID0gdGVzdE9iamVjdC5jcmVhdGVUcmVlVmlldygndHJlZURhdGFQcm92aWRlcicsIHsgdHJlZURhdGFQcm92aWRlcjogYUNvbXBsZXRlTm9kZVRyZWVEYXRhUHJvdmlkZXIoKSB9LCBleHRlbnNpb25zRGVzY3JpcHRpb24pO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0ge1xuXHRcdFx0aXRlbTogeyBoYW5kbGU6ICcwLzA6YS8wOmFhJywgbGFiZWw6IHsgbGFiZWw6ICdhYScgfSwgY29sbGFwc2libGVTdGF0ZTogVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLk5vbmUsIHBhcmVudEhhbmRsZTogJzAvMDphJyB9LFxuXHRcdFx0cGFyZW50Q2hhaW46IFt7IGhhbmRsZTogJzAvMDphJywgbGFiZWw6IHsgbGFiZWw6ICdhJyB9LCBjb2xsYXBzaWJsZVN0YXRlOiBUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUuQ29sbGFwc2VkIH1dXG5cdFx0fTtcblx0XHRyZXR1cm4gdHJlZVZpZXcucmV2ZWFsKHsga2V5OiAnYWEnIH0pXG5cdFx0XHQudGhlbigoKSA9PiB7XG5cdFx0XHRcdGFzc2VydC5vayhyZXZlYWxUYXJnZXQuY2FsbGVkT25jZSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoJ3RyZWVEYXRhUHJvdmlkZXInLCByZXZlYWxUYXJnZXQuYXJnc1swXVswXSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZXhwZWN0ZWQuaXRlbSwgcmVtb3ZlVW5zZXRLZXlzKHJldmVhbFRhcmdldC5hcmdzWzBdWzFdIS5pdGVtKSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZXhwZWN0ZWQucGFyZW50Q2hhaW4sICg8QXJyYXk8YW55Pj4ocmV2ZWFsVGFyZ2V0LmFyZ3NbMF1bMV0hLnBhcmVudENoYWluKSkubWFwKGFyZyA9PiByZW1vdmVVbnNldEtleXMoYXJnKSkpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHsgc2VsZWN0OiB0cnVlLCBmb2N1czogZmFsc2UsIGV4cGFuZDogZmFsc2UgfSwgcmV2ZWFsVGFyZ2V0LmFyZ3NbMF1bMl0pO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JldmVhbCB3aWxsIHJldHVybiBwYXJlbnRzIGFycmF5IGZvciBhbiBlbGVtZW50IHdoZW4gaGllcmFyY2h5IGlzIGxvYWRlZCcsICgpID0+IHtcblx0XHRjb25zdCByZXZlYWxUYXJnZXQgPSBzaW5vbi5zcHkodGFyZ2V0LCAnJHJldmVhbCcpO1xuXHRcdGNvbnN0IHRyZWVWaWV3ID0gdGVzdE9iamVjdC5jcmVhdGVUcmVlVmlldygndHJlZURhdGFQcm92aWRlcicsIHsgdHJlZURhdGFQcm92aWRlcjogYUNvbXBsZXRlTm9kZVRyZWVEYXRhUHJvdmlkZXIoKSB9LCBleHRlbnNpb25zRGVzY3JpcHRpb24pO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0ge1xuXHRcdFx0aXRlbTogeyBoYW5kbGU6ICcwLzA6YS8wOmFhJywgbGFiZWw6IHsgbGFiZWw6ICdhYScgfSwgY29sbGFwc2libGVTdGF0ZTogVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLk5vbmUsIHBhcmVudEhhbmRsZTogJzAvMDphJyB9LFxuXHRcdFx0cGFyZW50Q2hhaW46IFt7IGhhbmRsZTogJzAvMDphJywgbGFiZWw6IHsgbGFiZWw6ICdhJyB9LCBjb2xsYXBzaWJsZVN0YXRlOiBUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUuQ29sbGFwc2VkIH1dXG5cdFx0fTtcblx0XHRyZXR1cm4gdGVzdE9iamVjdC4kZ2V0Q2hpbGRyZW4oJ3RyZWVEYXRhUHJvdmlkZXInKVxuXHRcdFx0LnRoZW4oKCkgPT4gdGVzdE9iamVjdC4kZ2V0Q2hpbGRyZW4oJ3RyZWVEYXRhUHJvdmlkZXInLCBbJzAvMDphJ10pKVxuXHRcdFx0LnRoZW4oKCkgPT4gdHJlZVZpZXcucmV2ZWFsKHsga2V5OiAnYWEnIH0pXG5cdFx0XHRcdC50aGVuKCgpID0+IHtcblx0XHRcdFx0XHRhc3NlcnQub2socmV2ZWFsVGFyZ2V0LmNhbGxlZE9uY2UpO1xuXHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoJ3RyZWVEYXRhUHJvdmlkZXInLCByZXZlYWxUYXJnZXQuYXJnc1swXVswXSk7XG5cdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChleHBlY3RlZC5pdGVtLCByZW1vdmVVbnNldEtleXMocmV2ZWFsVGFyZ2V0LmFyZ3NbMF1bMV0hLml0ZW0pKTtcblx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGV4cGVjdGVkLnBhcmVudENoYWluLCAoPEFycmF5PGFueT4+KHJldmVhbFRhcmdldC5hcmdzWzBdWzFdIS5wYXJlbnRDaGFpbikpLm1hcChhcmcgPT4gcmVtb3ZlVW5zZXRLZXlzKGFyZykpKTtcblx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHsgc2VsZWN0OiB0cnVlLCBmb2N1czogZmFsc2UsIGV4cGFuZDogZmFsc2UgfSwgcmV2ZWFsVGFyZ2V0LmFyZ3NbMF1bMl0pO1xuXHRcdFx0XHR9KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JldmVhbCB3aWxsIHJldHVybiBwYXJlbnRzIGFycmF5IGZvciBkZWVwZXIgZWxlbWVudCB3aXRoIG5vIHNlbGVjdGlvbicsICgpID0+IHtcblx0XHR0cmVlID0ge1xuXHRcdFx0J2InOiB7XG5cdFx0XHRcdCdiYSc6IHtcblx0XHRcdFx0XHQnYmFjJzoge31cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0Y29uc3QgcmV2ZWFsVGFyZ2V0ID0gc2lub24uc3B5KHRhcmdldCwgJyRyZXZlYWwnKTtcblx0XHRjb25zdCB0cmVlVmlldyA9IHRlc3RPYmplY3QuY3JlYXRlVHJlZVZpZXcoJ3RyZWVEYXRhUHJvdmlkZXInLCB7IHRyZWVEYXRhUHJvdmlkZXI6IGFDb21wbGV0ZU5vZGVUcmVlRGF0YVByb3ZpZGVyKCkgfSwgZXh0ZW5zaW9uc0Rlc2NyaXB0aW9uKTtcblx0XHRjb25zdCBleHBlY3RlZCA9IHtcblx0XHRcdGl0ZW06IHsgaGFuZGxlOiAnMC8wOmIvMDpiYS8wOmJhYycsIGxhYmVsOiB7IGxhYmVsOiAnYmFjJyB9LCBjb2xsYXBzaWJsZVN0YXRlOiBUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUuTm9uZSwgcGFyZW50SGFuZGxlOiAnMC8wOmIvMDpiYScgfSxcblx0XHRcdHBhcmVudENoYWluOiBbXG5cdFx0XHRcdHsgaGFuZGxlOiAnMC8wOmInLCBsYWJlbDogeyBsYWJlbDogJ2InIH0sIGNvbGxhcHNpYmxlU3RhdGU6IFRyZWVJdGVtQ29sbGFwc2libGVTdGF0ZS5Db2xsYXBzZWQgfSxcblx0XHRcdFx0eyBoYW5kbGU6ICcwLzA6Yi8wOmJhJywgbGFiZWw6IHsgbGFiZWw6ICdiYScgfSwgY29sbGFwc2libGVTdGF0ZTogVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLkNvbGxhcHNlZCwgcGFyZW50SGFuZGxlOiAnMC8wOmInIH1cblx0XHRcdF1cblx0XHR9O1xuXHRcdHJldHVybiB0cmVlVmlldy5yZXZlYWwoeyBrZXk6ICdiYWMnIH0sIHsgc2VsZWN0OiBmYWxzZSwgZm9jdXM6IGZhbHNlLCBleHBhbmQ6IGZhbHNlIH0pXG5cdFx0XHQudGhlbigoKSA9PiB7XG5cdFx0XHRcdGFzc2VydC5vayhyZXZlYWxUYXJnZXQuY2FsbGVkT25jZSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoJ3RyZWVEYXRhUHJvdmlkZXInLCByZXZlYWxUYXJnZXQuYXJnc1swXVswXSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZXhwZWN0ZWQuaXRlbSwgcmVtb3ZlVW5zZXRLZXlzKHJldmVhbFRhcmdldC5hcmdzWzBdWzFdIS5pdGVtKSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZXhwZWN0ZWQucGFyZW50Q2hhaW4sICg8QXJyYXk8YW55Pj4ocmV2ZWFsVGFyZ2V0LmFyZ3NbMF1bMV0hLnBhcmVudENoYWluKSkubWFwKGFyZyA9PiByZW1vdmVVbnNldEtleXMoYXJnKSkpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHsgc2VsZWN0OiBmYWxzZSwgZm9jdXM6IGZhbHNlLCBleHBhbmQ6IGZhbHNlIH0sIHJldmVhbFRhcmdldC5hcmdzWzBdWzJdKTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXZlYWwgYWZ0ZXIgZmlyc3QgdWRwYXRlJywgKCkgPT4ge1xuXHRcdGNvbnN0IHJldmVhbFRhcmdldCA9IHNpbm9uLnNweSh0YXJnZXQsICckcmV2ZWFsJyk7XG5cdFx0Y29uc3QgdHJlZVZpZXcgPSB0ZXN0T2JqZWN0LmNyZWF0ZVRyZWVWaWV3KCd0cmVlRGF0YVByb3ZpZGVyJywgeyB0cmVlRGF0YVByb3ZpZGVyOiBhQ29tcGxldGVOb2RlVHJlZURhdGFQcm92aWRlcigpIH0sIGV4dGVuc2lvbnNEZXNjcmlwdGlvbik7XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSB7XG5cdFx0XHRpdGVtOiB7IGhhbmRsZTogJzAvMDphLzA6YWMnLCBsYWJlbDogeyBsYWJlbDogJ2FjJyB9LCBjb2xsYXBzaWJsZVN0YXRlOiBUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUuTm9uZSwgcGFyZW50SGFuZGxlOiAnMC8wOmEnIH0sXG5cdFx0XHRwYXJlbnRDaGFpbjogW3sgaGFuZGxlOiAnMC8wOmEnLCBsYWJlbDogeyBsYWJlbDogJ2EnIH0sIGNvbGxhcHNpYmxlU3RhdGU6IFRyZWVJdGVtQ29sbGFwc2libGVTdGF0ZS5Db2xsYXBzZWQgfV1cblx0XHR9O1xuXHRcdHJldHVybiBsb2FkQ29tcGxldGVUcmVlKCd0cmVlRGF0YVByb3ZpZGVyJylcblx0XHRcdC50aGVuKCgpID0+IHtcblx0XHRcdFx0dHJlZSA9IHtcblx0XHRcdFx0XHQnYSc6IHtcblx0XHRcdFx0XHRcdCdhYSc6IHt9LFxuXHRcdFx0XHRcdFx0J2FjJzoge31cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdCdiJzoge1xuXHRcdFx0XHRcdFx0J2JhJzoge30sXG5cdFx0XHRcdFx0XHQnYmInOiB7fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblx0XHRcdFx0b25EaWRDaGFuZ2VUcmVlTm9kZS5maXJlKGdldE5vZGUoJ2EnKSk7XG5cblx0XHRcdFx0cmV0dXJuIHRyZWVWaWV3LnJldmVhbCh7IGtleTogJ2FjJyB9KVxuXHRcdFx0XHRcdC50aGVuKCgpID0+IHtcblx0XHRcdFx0XHRcdGFzc2VydC5vayhyZXZlYWxUYXJnZXQuY2FsbGVkT25jZSk7XG5cdFx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKCd0cmVlRGF0YVByb3ZpZGVyJywgcmV2ZWFsVGFyZ2V0LmFyZ3NbMF1bMF0pO1xuXHRcdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChleHBlY3RlZC5pdGVtLCByZW1vdmVVbnNldEtleXMocmV2ZWFsVGFyZ2V0LmFyZ3NbMF1bMV0hLml0ZW0pKTtcblx0XHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZXhwZWN0ZWQucGFyZW50Q2hhaW4sICg8QXJyYXk8YW55Pj4ocmV2ZWFsVGFyZ2V0LmFyZ3NbMF1bMV0hLnBhcmVudENoYWluKSkubWFwKGFyZyA9PiByZW1vdmVVbnNldEtleXMoYXJnKSkpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh7IHNlbGVjdDogdHJ1ZSwgZm9jdXM6IGZhbHNlLCBleHBhbmQ6IGZhbHNlIH0sIHJldmVhbFRhcmdldC5hcmdzWzBdWzJdKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXZlYWwgYWZ0ZXIgc2Vjb25kIHVkcGF0ZScsICgpID0+IHtcblx0XHRjb25zdCByZXZlYWxUYXJnZXQgPSBzaW5vbi5zcHkodGFyZ2V0LCAnJHJldmVhbCcpO1xuXHRcdGNvbnN0IHRyZWVWaWV3ID0gdGVzdE9iamVjdC5jcmVhdGVUcmVlVmlldygndHJlZURhdGFQcm92aWRlcicsIHsgdHJlZURhdGFQcm92aWRlcjogYUNvbXBsZXRlTm9kZVRyZWVEYXRhUHJvdmlkZXIoKSB9LCBleHRlbnNpb25zRGVzY3JpcHRpb24pO1xuXHRcdHJldHVybiBsb2FkQ29tcGxldGVUcmVlKCd0cmVlRGF0YVByb3ZpZGVyJylcblx0XHRcdC50aGVuKCgpID0+IHtcblx0XHRcdFx0cmV0dXJuIHJ1bldpdGhFdmVudE1lcmdpbmcoKHJlc29sdmUpID0+IHtcblx0XHRcdFx0XHR0cmVlID0ge1xuXHRcdFx0XHRcdFx0J2EnOiB7XG5cdFx0XHRcdFx0XHRcdCdhYSc6IHt9LFxuXHRcdFx0XHRcdFx0XHQnYWMnOiB7fVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdCdiJzoge1xuXHRcdFx0XHRcdFx0XHQnYmEnOiB7fSxcblx0XHRcdFx0XHRcdFx0J2JiJzoge31cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdG9uRGlkQ2hhbmdlVHJlZU5vZGUuZmlyZShnZXROb2RlKCdhJykpO1xuXHRcdFx0XHRcdHRyZWUgPSB7XG5cdFx0XHRcdFx0XHQnYSc6IHtcblx0XHRcdFx0XHRcdFx0J2FhJzoge30sXG5cdFx0XHRcdFx0XHRcdCdhYyc6IHt9XG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0J2InOiB7XG5cdFx0XHRcdFx0XHRcdCdiYSc6IHt9LFxuXHRcdFx0XHRcdFx0XHQnYmMnOiB7fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0b25EaWRDaGFuZ2VUcmVlTm9kZS5maXJlKGdldE5vZGUoJ2InKSk7XG5cdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHR9KS50aGVuKCgpID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gdHJlZVZpZXcucmV2ZWFsKHsga2V5OiAnYmMnIH0pXG5cdFx0XHRcdFx0XHQudGhlbigoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGFzc2VydC5vayhyZXZlYWxUYXJnZXQuY2FsbGVkT25jZSk7XG5cdFx0XHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoJ3RyZWVEYXRhUHJvdmlkZXInLCByZXZlYWxUYXJnZXQuYXJnc1swXVswXSk7XG5cdFx0XHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoeyBoYW5kbGU6ICcwLzA6Yi8wOmJjJywgbGFiZWw6IHsgbGFiZWw6ICdiYycgfSwgY29sbGFwc2libGVTdGF0ZTogVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLk5vbmUsIHBhcmVudEhhbmRsZTogJzAvMDpiJyB9LCByZW1vdmVVbnNldEtleXMocmV2ZWFsVGFyZ2V0LmFyZ3NbMF1bMV0hLml0ZW0pKTtcblx0XHRcdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChbeyBoYW5kbGU6ICcwLzA6YicsIGxhYmVsOiB7IGxhYmVsOiAnYicgfSwgY29sbGFwc2libGVTdGF0ZTogVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLkNvbGxhcHNlZCB9XSwgKDxBcnJheTxhbnk+PnJldmVhbFRhcmdldC5hcmdzWzBdWzFdIS5wYXJlbnRDaGFpbikubWFwKGFyZyA9PiByZW1vdmVVbnNldEtleXMoYXJnKSkpO1xuXHRcdFx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHsgc2VsZWN0OiB0cnVlLCBmb2N1czogZmFsc2UsIGV4cGFuZDogZmFsc2UgfSwgcmV2ZWFsVGFyZ2V0LmFyZ3NbMF1bMl0pO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGxvYWRDb21wbGV0ZVRyZWUodHJlZUlkOiBzdHJpbmcsIGVsZW1lbnQ/OiBzdHJpbmcpOiBQcm9taXNlPG51bGw+IHtcblx0XHRyZXR1cm4gdGVzdE9iamVjdC4kZ2V0Q2hpbGRyZW4odHJlZUlkLCBlbGVtZW50ID8gW2VsZW1lbnRdIDogdW5kZWZpbmVkKVxuXHRcdFx0LnRoZW4oZWxlbWVudHMgPT4ge1xuXHRcdFx0XHRpZiAoIWVsZW1lbnRzIHx8IGVsZW1lbnRzPy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZWxlbWVudHNbMF0uc2xpY2UoMSkubWFwKGUgPT4gbG9hZENvbXBsZXRlVHJlZSh0cmVlSWQsIChlIGFzIElUcmVlSXRlbSkuaGFuZGxlKSk7XG5cdFx0XHR9KVxuXHRcdFx0LnRoZW4oKCkgPT4gbnVsbCk7XG5cdH1cblxuXHRmdW5jdGlvbiByZW1vdmVVbnNldEtleXMob2JqOiBhbnkpOiBhbnkge1xuXHRcdGlmIChBcnJheS5pc0FycmF5KG9iaikpIHtcblx0XHRcdHJldHVybiBvYmoubWFwKG8gPT4gcmVtb3ZlVW5zZXRLZXlzKG8pKTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIG9iaiA9PT0gJ29iamVjdCcpIHtcblx0XHRcdGNvbnN0IHJlc3VsdDogeyBba2V5OiBzdHJpbmddOiBhbnkgfSA9IHt9O1xuXHRcdFx0Zm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMob2JqKSkge1xuXHRcdFx0XHRpZiAob2JqW2tleV0gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHJlc3VsdFtrZXldID0gcmVtb3ZlVW5zZXRLZXlzKG9ialtrZXldKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cdFx0cmV0dXJuIG9iajtcblx0fVxuXG5cdGZ1bmN0aW9uIGFOb2RlVHJlZURhdGFQcm92aWRlcigpOiBUcmVlRGF0YVByb3ZpZGVyPHsga2V5OiBzdHJpbmcgfT4ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRnZXRDaGlsZHJlbjogKGVsZW1lbnQ6IHsga2V5OiBzdHJpbmcgfSk6IHsga2V5OiBzdHJpbmcgfVtdID0+IHtcblx0XHRcdFx0cmV0dXJuIGdldENoaWxkcmVuKGVsZW1lbnQgPyBlbGVtZW50LmtleSA6IHVuZGVmaW5lZCkubWFwKGtleSA9PiBnZXROb2RlKGtleSkpO1xuXHRcdFx0fSxcblx0XHRcdGdldFRyZWVJdGVtOiAoZWxlbWVudDogeyBrZXk6IHN0cmluZyB9KTogVHJlZUl0ZW0gPT4ge1xuXHRcdFx0XHRyZXR1cm4gZ2V0VHJlZUl0ZW0oZWxlbWVudC5rZXkpO1xuXHRcdFx0fSxcblx0XHRcdG9uRGlkQ2hhbmdlVHJlZURhdGE6IG9uRGlkQ2hhbmdlVHJlZU5vZGUuZXZlbnRcblx0XHR9O1xuXHR9XG5cblx0ZnVuY3Rpb24gYUNvbXBsZXRlTm9kZVRyZWVEYXRhUHJvdmlkZXIoKTogVHJlZURhdGFQcm92aWRlcjx7IGtleTogc3RyaW5nIH0+IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Z2V0Q2hpbGRyZW46IChlbGVtZW50OiB7IGtleTogc3RyaW5nIH0pOiB7IGtleTogc3RyaW5nIH1bXSA9PiB7XG5cdFx0XHRcdHJldHVybiBnZXRDaGlsZHJlbihlbGVtZW50ID8gZWxlbWVudC5rZXkgOiB1bmRlZmluZWQpLm1hcChrZXkgPT4gZ2V0Tm9kZShrZXkpKTtcblx0XHRcdH0sXG5cdFx0XHRnZXRUcmVlSXRlbTogKGVsZW1lbnQ6IHsga2V5OiBzdHJpbmcgfSk6IFRyZWVJdGVtID0+IHtcblx0XHRcdFx0cmV0dXJuIGdldFRyZWVJdGVtKGVsZW1lbnQua2V5KTtcblx0XHRcdH0sXG5cdFx0XHRnZXRQYXJlbnQ6ICh7IGtleSB9OiB7IGtleTogc3RyaW5nIH0pOiB7IGtleTogc3RyaW5nIH0gfCB1bmRlZmluZWQgPT4ge1xuXHRcdFx0XHRjb25zdCBwYXJlbnRLZXkgPSBrZXkuc3Vic3RyaW5nKDAsIGtleS5sZW5ndGggLSAxKTtcblx0XHRcdFx0cmV0dXJuIHBhcmVudEtleSA/IG5ldyBLZXkocGFyZW50S2V5KSA6IHVuZGVmaW5lZDtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZENoYW5nZVRyZWVEYXRhOiBvbkRpZENoYW5nZVRyZWVOb2RlLmV2ZW50XG5cdFx0fTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFOb2RlV2l0aElkVHJlZURhdGFQcm92aWRlcigpOiBUcmVlRGF0YVByb3ZpZGVyPHsga2V5OiBzdHJpbmcgfT4ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRnZXRDaGlsZHJlbjogKGVsZW1lbnQ6IHsga2V5OiBzdHJpbmcgfSk6IHsga2V5OiBzdHJpbmcgfVtdID0+IHtcblx0XHRcdFx0cmV0dXJuIGdldENoaWxkcmVuKGVsZW1lbnQgPyBlbGVtZW50LmtleSA6IHVuZGVmaW5lZCkubWFwKGtleSA9PiBnZXROb2RlKGtleSkpO1xuXHRcdFx0fSxcblx0XHRcdGdldFRyZWVJdGVtOiAoZWxlbWVudDogeyBrZXk6IHN0cmluZyB9KTogVHJlZUl0ZW0gPT4ge1xuXHRcdFx0XHRjb25zdCB0cmVlSXRlbSA9IGdldFRyZWVJdGVtKGVsZW1lbnQua2V5KTtcblx0XHRcdFx0dHJlZUl0ZW0uaWQgPSBlbGVtZW50LmtleTtcblx0XHRcdFx0cmV0dXJuIHRyZWVJdGVtO1xuXHRcdFx0fSxcblx0XHRcdG9uRGlkQ2hhbmdlVHJlZURhdGE6IG9uRGlkQ2hhbmdlVHJlZU5vZGVXaXRoSWQuZXZlbnRcblx0XHR9O1xuXHR9XG5cblx0ZnVuY3Rpb24gYU5vZGVXaXRoSGlnaGxpZ2h0ZWRMYWJlbFRyZWVEYXRhUHJvdmlkZXIoKTogVHJlZURhdGFQcm92aWRlcjx7IGtleTogc3RyaW5nIH0+IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Z2V0Q2hpbGRyZW46IChlbGVtZW50OiB7IGtleTogc3RyaW5nIH0pOiB7IGtleTogc3RyaW5nIH1bXSA9PiB7XG5cdFx0XHRcdHJldHVybiBnZXRDaGlsZHJlbihlbGVtZW50ID8gZWxlbWVudC5rZXkgOiB1bmRlZmluZWQpLm1hcChrZXkgPT4gZ2V0Tm9kZShrZXkpKTtcblx0XHRcdH0sXG5cdFx0XHRnZXRUcmVlSXRlbTogKGVsZW1lbnQ6IHsga2V5OiBzdHJpbmcgfSk6IFRyZWVJdGVtID0+IHtcblx0XHRcdFx0Y29uc3QgdHJlZUl0ZW0gPSBnZXRUcmVlSXRlbShlbGVtZW50LmtleSwgW1swLCAyXSwgWzMsIDVdXSk7XG5cdFx0XHRcdHRyZWVJdGVtLmlkID0gZWxlbWVudC5rZXk7XG5cdFx0XHRcdHJldHVybiB0cmVlSXRlbTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZENoYW5nZVRyZWVEYXRhOiBvbkRpZENoYW5nZVRyZWVOb2RlV2l0aElkLmV2ZW50XG5cdFx0fTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldFRyZWVFbGVtZW50KGVsZW1lbnQ6IHN0cmluZyk6IGFueSB7XG5cdFx0bGV0IHBhcmVudCA9IHRyZWU7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBlbGVtZW50Lmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRwYXJlbnQgPSBwYXJlbnRbZWxlbWVudC5zdWJzdHJpbmcoMCwgaSArIDEpXTtcblx0XHRcdGlmICghcGFyZW50KSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcGFyZW50O1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0Q2hpbGRyZW4oa2V5OiBzdHJpbmcgfCB1bmRlZmluZWQpOiBzdHJpbmdbXSB7XG5cdFx0aWYgKCFrZXkpIHtcblx0XHRcdHJldHVybiBPYmplY3Qua2V5cyh0cmVlKTtcblx0XHR9XG5cdFx0Y29uc3QgdHJlZUVsZW1lbnQgPSBnZXRUcmVlRWxlbWVudChrZXkpO1xuXHRcdGlmICh0cmVlRWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIE9iamVjdC5rZXlzKHRyZWVFbGVtZW50KTtcblx0XHR9XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0VHJlZUl0ZW0oa2V5OiBzdHJpbmcsIGhpZ2hsaWdodHM/OiBbbnVtYmVyLCBudW1iZXJdW10pOiBUcmVlSXRlbSB7XG5cdFx0Y29uc3QgdHJlZUVsZW1lbnQgPSBnZXRUcmVlRWxlbWVudChrZXkpO1xuXHRcdHJldHVybiB7XG5cdFx0XHRsYWJlbDogPGFueT57IGxhYmVsOiBsYWJlbHNba2V5XSB8fCBrZXksIGhpZ2hsaWdodHMgfSxcblx0XHRcdGNvbGxhcHNpYmxlU3RhdGU6IHRyZWVFbGVtZW50ICYmIE9iamVjdC5rZXlzKHRyZWVFbGVtZW50KS5sZW5ndGggPyBUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUuQ29sbGFwc2VkIDogVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLk5vbmVcblx0XHR9O1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0Tm9kZShrZXk6IHN0cmluZyk6IHsga2V5OiBzdHJpbmcgfSB7XG5cdFx0aWYgKCFub2Rlc1trZXldKSB7XG5cdFx0XHRub2Rlc1trZXldID0gbmV3IEtleShrZXkpO1xuXHRcdH1cblx0XHRyZXR1cm4gbm9kZXNba2V5XTtcblx0fVxuXG5cdGNsYXNzIEtleSB7XG5cdFx0Y29uc3RydWN0b3IocmVhZG9ubHkga2V5OiBzdHJpbmcpIHsgfVxuXHR9XG5cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFlBQVksV0FBVztBQUN2QixTQUFTLGVBQWU7QUFDeEIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBbUMsbUJBQTRDO0FBRS9FLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsWUFBWTtBQUNyQixTQUFTLGdDQUEyRDtBQUNwRSxTQUFTLHNCQUFzQjtBQUUvQixTQUFTLDRCQUE0Qiw2QkFBNkI7QUFDbEUsU0FBUywwQkFBMEI7QUFFbkMsU0FBUywrQ0FBK0M7QUFFeEQsU0FBUyxnQkFBZ0IsUUFBdUU7QUFDL0YsTUFBSSxDQUFDLFVBQVUsT0FBTyxXQUFXLEdBQUc7QUFDbkMsV0FBTztBQUFBLEVBQ1I7QUFDQSxNQUFJLE9B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
