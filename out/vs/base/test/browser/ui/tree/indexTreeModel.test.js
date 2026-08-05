import assert from "assert";
import { IndexTreeModel } from "../../../../browser/ui/tree/indexTreeModel.js";
import { TreeVisibility } from "../../../../browser/ui/tree/tree.js";
import { timeout } from "../../../../common/async.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../common/utils.js";
import { DisposableStore } from "../../../../common/lifecycle.js";
function bindListToModel(list, model) {
  return model.onDidSpliceRenderedNodes(({ start, deleteCount, elements }) => {
    list.splice(start, deleteCount, ...elements);
  });
}
function toArray(list) {
  return list.map((i) => i.element);
}
function toElements(node) {
  return node.children?.length ? { e: node.element, children: node.children.map(toElements) } : node.element;
}
const diffIdentityProvider = { getId: (n) => String(n) };
function withSmartSplice(fn) {
  fn({});
  fn({ diffIdentityProvider });
}
suite("IndexTreeModel", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const disposables = new DisposableStore();
  teardown(() => {
    disposables.clear();
  });
  test("ctor", () => {
    const list = [];
    const model = new IndexTreeModel("test", -1);
    assert(model);
    assert.strictEqual(list.length, 0);
  });
  test("insert", () => withSmartSplice((options) => {
    const list = [];
    const model = new IndexTreeModel("test", -1);
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      { element: 0 },
      { element: 1 },
      { element: 2 }
    ], options);
    assert.deepStrictEqual(list.length, 3);
    assert.deepStrictEqual(list[0].element, 0);
    assert.deepStrictEqual(list[0].collapsed, false);
    assert.deepStrictEqual(list[0].depth, 1);
    assert.deepStrictEqual(list[1].element, 1);
    assert.deepStrictEqual(list[1].collapsed, false);
    assert.deepStrictEqual(list[1].depth, 1);
    assert.deepStrictEqual(list[2].element, 2);
    assert.deepStrictEqual(list[2].collapsed, false);
    assert.deepStrictEqual(list[2].depth, 1);
    disposable.dispose();
  }));
  test("deep insert", () => withSmartSplice((options) => {
    const list = [];
    const model = new IndexTreeModel("test", -1);
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      {
        element: 0,
        children: [
          { element: 10 },
          { element: 11 },
          { element: 12 }
        ]
      },
      { element: 1 },
      { element: 2 }
    ]);
    assert.deepStrictEqual(list.length, 6);
    assert.deepStrictEqual(list[0].element, 0);
    assert.deepStrictEqual(list[0].collapsed, false);
    assert.deepStrictEqual(list[0].depth, 1);
    assert.deepStrictEqual(list[1].element, 10);
    assert.deepStrictEqual(list[1].collapsed, false);
    assert.deepStrictEqual(list[1].depth, 2);
    assert.deepStrictEqual(list[2].element, 11);
    assert.deepStrictEqual(list[2].collapsed, false);
    assert.deepStrictEqual(list[2].depth, 2);
    assert.deepStrictEqual(list[3].element, 12);
    assert.deepStrictEqual(list[3].collapsed, false);
    assert.deepStrictEqual(list[3].depth, 2);
    assert.deepStrictEqual(list[4].element, 1);
    assert.deepStrictEqual(list[4].collapsed, false);
    assert.deepStrictEqual(list[4].depth, 1);
    assert.deepStrictEqual(list[5].element, 2);
    assert.deepStrictEqual(list[5].collapsed, false);
    assert.deepStrictEqual(list[5].depth, 1);
    disposable.dispose();
  }));
  test("deep insert collapsed", () => withSmartSplice((options) => {
    const list = [];
    const model = new IndexTreeModel("test", -1);
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      {
        element: 0,
        collapsed: true,
        children: [
          { element: 10 },
          { element: 11 },
          { element: 12 }
        ]
      },
      { element: 1 },
      { element: 2 }
    ], options);
    assert.deepStrictEqual(list.length, 3);
    assert.deepStrictEqual(list[0].element, 0);
    assert.deepStrictEqual(list[0].collapsed, true);
    assert.deepStrictEqual(list[0].depth, 1);
    assert.deepStrictEqual(list[1].element, 1);
    assert.deepStrictEqual(list[1].collapsed, false);
    assert.deepStrictEqual(list[1].depth, 1);
    assert.deepStrictEqual(list[2].element, 2);
    assert.deepStrictEqual(list[2].collapsed, false);
    assert.deepStrictEqual(list[2].depth, 1);
    disposable.dispose();
  }));
  test("delete", () => withSmartSplice((options) => {
    const list = [];
    const model = new IndexTreeModel("test", -1);
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      { element: 0 },
      { element: 1 },
      { element: 2 }
    ], options);
    assert.deepStrictEqual(list.length, 3);
    model.splice([1], 1, void 0, options);
    assert.deepStrictEqual(list.length, 2);
    assert.deepStrictEqual(list[0].element, 0);
    assert.deepStrictEqual(list[0].collapsed, false);
    assert.deepStrictEqual(list[0].depth, 1);
    assert.deepStrictEqual(list[1].element, 2);
    assert.deepStrictEqual(list[1].collapsed, false);
    assert.deepStrictEqual(list[1].depth, 1);
    model.splice([0], 2, void 0, options);
    assert.deepStrictEqual(list.length, 0);
    disposable.dispose();
  }));
  test("nested delete", () => withSmartSplice((options) => {
    const list = [];
    const model = new IndexTreeModel("test", -1);
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      {
        element: 0,
        children: [
          { element: 10 },
          { element: 11 },
          { element: 12 }
        ]
      },
      { element: 1 },
      { element: 2 }
    ], options);
    assert.deepStrictEqual(list.length, 6);
    model.splice([1], 2, void 0, options);
    assert.deepStrictEqual(list.length, 4);
    assert.deepStrictEqual(list[0].element, 0);
    assert.deepStrictEqual(list[0].collapsed, false);
    assert.deepStrictEqual(list[0].depth, 1);
    assert.deepStrictEqual(list[1].element, 10);
    assert.deepStrictEqual(list[1].collapsed, false);
    assert.deepStrictEqual(list[1].depth, 2);
    assert.deepStrictEqual(list[2].element, 11);
    assert.deepStrictEqual(list[2].collapsed, false);
    assert.deepStrictEqual(list[2].depth, 2);
    assert.deepStrictEqual(list[3].element, 12);
    assert.deepStrictEqual(list[3].collapsed, false);
    assert.deepStrictEqual(list[3].depth, 2);
    disposable.dispose();
  }));
  test("deep delete", () => withSmartSplice((options) => {
    const list = [];
    const model = new IndexTreeModel("test", -1);
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      {
        element: 0,
        children: [
          { element: 10 },
          { element: 11 },
          { element: 12 }
        ]
      },
      { element: 1 },
      { element: 2 }
    ], options);
    assert.deepStrictEqual(list.length, 6);
    model.splice([0], 1, void 0, options);
    assert.deepStrictEqual(list.length, 2);
    assert.deepStrictEqual(list[0].element, 1);
    assert.deepStrictEqual(list[0].collapsed, false);
    assert.deepStrictEqual(list[0].depth, 1);
    assert.deepStrictEqual(list[1].element, 2);
    assert.deepStrictEqual(list[1].collapsed, false);
    assert.deepStrictEqual(list[1].depth, 1);
    disposable.dispose();
  }));
  test("smart splice deep", () => {
    const list = [];
    const model = new IndexTreeModel("test", -1);
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      { element: 0 },
      { element: 1 },
      { element: 2 },
      { element: 3 }
    ], { diffIdentityProvider });
    assert.deepStrictEqual(list.filter((l) => l.depth === 1).map(toElements), [
      0,
      1,
      2,
      3
    ]);
    model.splice([0], 3, [
      { element: -0.5 },
      { element: 0, children: [{ element: 0.1 }] },
      { element: 1 },
      { element: 2, children: [{ element: 2.1 }, { element: 2.2, children: [{ element: 2.21 }] }] }
    ], { diffIdentityProvider, diffDepth: Infinity });
    assert.deepStrictEqual(list.filter((l) => l.depth === 1).map(toElements), [
      -0.5,
      { e: 0, children: [0.1] },
      1,
      { e: 2, children: [2.1, { e: 2.2, children: [2.21] }] },
      3
    ]);
    disposable.dispose();
  });
  test("hidden delete", () => withSmartSplice((options) => {
    const list = [];
    const model = new IndexTreeModel("test", -1);
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      {
        element: 0,
        collapsed: true,
        children: [
          { element: 10 },
          { element: 11 },
          { element: 12 }
        ]
      },
      { element: 1 },
      { element: 2 }
    ], options);
    assert.deepStrictEqual(list.length, 3);
    model.splice([0, 1], 1, void 0, options);
    assert.deepStrictEqual(list.length, 3);
    model.splice([0, 0], 2, void 0, options);
    assert.deepStrictEqual(list.length, 3);
    disposable.dispose();
  }));
  test("collapse", () => withSmartSplice((options) => {
    const list = [];
    const model = new IndexTreeModel("test", -1);
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      {
        element: 0,
        children: [
          { element: 10 },
          { element: 11 },
          { element: 12 }
        ]
      },
      { element: 1 },
      { element: 2 }
    ], options);
    assert.deepStrictEqual(list.length, 6);
    model.setCollapsed([0], true);
    assert.deepStrictEqual(list.length, 3);
    assert.deepStrictEqual(list[0].element, 0);
    assert.deepStrictEqual(list[0].collapsed, true);
    assert.deepStrictEqual(list[0].depth, 1);
    assert.deepStrictEqual(list[1].element, 1);
    assert.deepStrictEqual(list[1].collapsed, false);
    assert.deepStrictEqual(list[1].depth, 1);
    assert.deepStrictEqual(list[2].element, 2);
    assert.deepStrictEqual(list[2].collapsed, false);
    assert.deepStrictEqual(list[2].depth, 1);
    disposable.dispose();
  }));
  test("expand", () => withSmartSplice((options) => {
    const list = [];
    const model = new IndexTreeModel("test", -1);
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      {
        element: 0,
        collapsed: true,
        children: [
          { element: 10 },
          { element: 11 },
          { element: 12 }
        ]
      },
      { element: 1 },
      { element: 2 }
    ], options);
    assert.deepStrictEqual(list.length, 3);
    model.expandTo([0, 1]);
    assert.deepStrictEqual(list.length, 6);
    assert.deepStrictEqual(list[0].element, 0);
    assert.deepStrictEqual(list[0].collapsed, false);
    assert.deepStrictEqual(list[0].depth, 1);
    assert.deepStrictEqual(list[1].element, 10);
    assert.deepStrictEqual(list[1].collapsed, false);
    assert.deepStrictEqual(list[1].depth, 2);
    assert.deepStrictEqual(list[2].element, 11);
    assert.deepStrictEqual(list[2].collapsed, false);
    assert.deepStrictEqual(list[2].depth, 2);
    assert.deepStrictEqual(list[3].element, 12);
    assert.deepStrictEqual(list[3].collapsed, false);
    assert.deepStrictEqual(list[3].depth, 2);
    assert.deepStrictEqual(list[4].element, 1);
    assert.deepStrictEqual(list[4].collapsed, false);
    assert.deepStrictEqual(list[4].depth, 1);
    assert.deepStrictEqual(list[5].element, 2);
    assert.deepStrictEqual(list[5].collapsed, false);
    assert.deepStrictEqual(list[5].depth, 1);
    disposable.dispose();
  }));
  test("smart diff consistency", () => {
    const times = 500;
    const minEdits = 1;
    const maxEdits = 10;
    const maxInserts = 5;
    for (let i = 0; i < times; i++) {
      const list = [];
      const options = { diffIdentityProvider: { getId: (n) => String(n) } };
      const model = new IndexTreeModel("test", -1);
      const disposable = bindListToModel(list, model);
      const changes = [];
      const expected = [];
      let elementCounter = 0;
      for (let edits = Math.random() * (maxEdits - minEdits) + minEdits; edits > 0; edits--) {
        const spliceIndex = Math.floor(Math.random() * list.length);
        const deleteCount = Math.ceil(Math.random() * (list.length - spliceIndex));
        const insertCount = Math.floor(Math.random() * maxInserts + 1);
        const inserts = [];
        for (let i2 = 0; i2 < insertCount; i2++) {
          const element = elementCounter++;
          inserts.push({ element, children: [] });
        }
        if (Math.random() < 0.5) {
          const elements = list.slice(spliceIndex, spliceIndex + Math.floor(deleteCount / 2));
          inserts.push(...elements.map(({ element }) => ({ element, children: [] })));
        }
        model.splice([spliceIndex], deleteCount, inserts, options);
        expected.splice(spliceIndex, deleteCount, ...inserts.map((i2) => i2.element));
        const listElements = list.map((l) => l.element);
        changes.push(`splice(${spliceIndex}, ${deleteCount}, [${inserts.map((e) => e.element).join(", ")}]) -> ${listElements.join(", ")}`);
        assert.deepStrictEqual(expected, listElements, `Expected ${listElements.join(", ")} to equal ${expected.join(", ")}. Steps:

${changes.join("\n")}`);
      }
      disposable.dispose();
    }
  });
  test("collapse should recursively adjust visible count", () => {
    const list = [];
    const model = new IndexTreeModel("test", -1);
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      {
        element: 1,
        children: [
          {
            element: 11,
            children: [
              { element: 111 }
            ]
          }
        ]
      },
      {
        element: 2,
        children: [
          { element: 21 }
        ]
      }
    ]);
    assert.deepStrictEqual(list.length, 5);
    assert.deepStrictEqual(toArray(list), [1, 11, 111, 2, 21]);
    model.setCollapsed([0, 0], true);
    assert.deepStrictEqual(list.length, 4);
    assert.deepStrictEqual(toArray(list), [1, 11, 2, 21]);
    model.setCollapsed([1], true);
    assert.deepStrictEqual(list.length, 3);
    assert.deepStrictEqual(toArray(list), [1, 11, 2]);
    disposable.dispose();
  });
  test("setCollapsible", () => {
    const list = [];
    const model = new IndexTreeModel("test", -1);
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      {
        element: 0,
        children: [
          { element: 10 }
        ]
      }
    ]);
    assert.deepStrictEqual(list.length, 2);
    model.setCollapsible([0], false);
    assert.deepStrictEqual(list.length, 2);
    assert.deepStrictEqual(list[0].element, 0);
    assert.deepStrictEqual(list[0].collapsible, false);
    assert.deepStrictEqual(list[0].collapsed, false);
    assert.deepStrictEqual(list[1].element, 10);
    assert.deepStrictEqual(list[1].collapsible, false);
    assert.deepStrictEqual(list[1].collapsed, false);
    assert.deepStrictEqual(model.setCollapsed([0], true), false);
    assert.deepStrictEqual(list[0].element, 0);
    assert.deepStrictEqual(list[0].collapsible, false);
    assert.deepStrictEqual(list[0].collapsed, false);
    assert.deepStrictEqual(list[1].element, 10);
    assert.deepStrictEqual(list[1].collapsible, false);
    assert.deepStrictEqual(list[1].collapsed, false);
    assert.deepStrictEqual(model.setCollapsed([0], false), false);
    assert.deepStrictEqual(list[0].element, 0);
    assert.deepStrictEqual(list[0].collapsible, false);
    assert.deepStrictEqual(list[0].collapsed, false);
    assert.deepStrictEqual(list[1].element, 10);
    assert.deepStrictEqual(list[1].collapsible, false);
    assert.deepStrictEqual(list[1].collapsed, false);
    model.setCollapsible([0], true);
    assert.deepStrictEqual(list.length, 2);
    assert.deepStrictEqual(list[0].element, 0);
    assert.deepStrictEqual(list[0].collapsible, true);
    assert.deepStrictEqual(list[0].collapsed, false);
    assert.deepStrictEqual(list[1].element, 10);
    assert.deepStrictEqual(list[1].collapsible, false);
    assert.deepStrictEqual(list[1].collapsed, false);
    assert.deepStrictEqual(model.setCollapsed([0], true), true);
    assert.deepStrictEqual(list.length, 1);
    assert.deepStrictEqual(list[0].element, 0);
    assert.deepStrictEqual(list[0].collapsible, true);
    assert.deepStrictEqual(list[0].collapsed, true);
    assert.deepStrictEqual(model.setCollapsed([0], false), true);
    assert.deepStrictEqual(list[0].element, 0);
    assert.deepStrictEqual(list[0].collapsible, true);
    assert.deepStrictEqual(list[0].collapsed, false);
    assert.deepStrictEqual(list[1].element, 10);
    assert.deepStrictEqual(list[1].collapsible, false);
    assert.deepStrictEqual(list[1].collapsed, false);
    disposable.dispose();
  });
  test("simple filter", () => {
    const list = [];
    const filter = new class {
      filter(element) {
        return element % 2 === 0 ? TreeVisibility.Visible : TreeVisibility.Hidden;
      }
    }();
    const model = new IndexTreeModel("test", -1, { filter });
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      {
        element: 0,
        children: [
          { element: 1 },
          { element: 2 },
          { element: 3 },
          { element: 4 },
          { element: 5 },
          { element: 6 },
          { element: 7 }
        ]
      }
    ]);
    assert.deepStrictEqual(list.length, 4);
    assert.deepStrictEqual(toArray(list), [0, 2, 4, 6]);
    model.setCollapsed([0], true);
    assert.deepStrictEqual(toArray(list), [0]);
    model.setCollapsed([0], false);
    assert.deepStrictEqual(toArray(list), [0, 2, 4, 6]);
    disposable.dispose();
  });
  test("recursive filter on initial model", () => {
    const list = [];
    const filter = new class {
      filter(element) {
        return element === 0 ? TreeVisibility.Recurse : TreeVisibility.Hidden;
      }
    }();
    const model = new IndexTreeModel("test", -1, { filter });
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      {
        element: 0,
        children: [
          { element: 1 },
          { element: 2 }
        ]
      }
    ]);
    assert.deepStrictEqual(toArray(list), []);
    disposable.dispose();
  });
  test("refilter", () => {
    const list = [];
    let shouldFilter = false;
    const filter = new class {
      filter(element) {
        return !shouldFilter || element % 2 === 0 ? TreeVisibility.Visible : TreeVisibility.Hidden;
      }
    }();
    const model = new IndexTreeModel("test", -1, { filter });
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      {
        element: 0,
        children: [
          { element: 1 },
          { element: 2 },
          { element: 3 },
          { element: 4 },
          { element: 5 },
          { element: 6 },
          { element: 7 }
        ]
      }
    ]);
    assert.deepStrictEqual(toArray(list), [0, 1, 2, 3, 4, 5, 6, 7]);
    model.refilter();
    assert.deepStrictEqual(toArray(list), [0, 1, 2, 3, 4, 5, 6, 7]);
    shouldFilter = true;
    model.refilter();
    assert.deepStrictEqual(toArray(list), [0, 2, 4, 6]);
    shouldFilter = false;
    model.refilter();
    assert.deepStrictEqual(toArray(list), [0, 1, 2, 3, 4, 5, 6, 7]);
    disposable.dispose();
  });
  test("recursive filter", () => {
    const list = [];
    let query = new RegExp("");
    const filter = new class {
      filter(element) {
        return query.test(element) ? TreeVisibility.Visible : TreeVisibility.Recurse;
      }
    }();
    const model = new IndexTreeModel("test", "root", { filter });
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      {
        element: "vscode",
        children: [
          { element: ".build" },
          { element: "git" },
          {
            element: "github",
            children: [
              { element: "calendar.yml" },
              { element: "endgame" },
              { element: "build.js" }
            ]
          },
          {
            element: "build",
            children: [
              { element: "lib" },
              { element: "gulpfile.js" }
            ]
          }
        ]
      }
    ]);
    assert.deepStrictEqual(list.length, 10);
    query = /build/;
    model.refilter();
    assert.deepStrictEqual(toArray(list), ["vscode", ".build", "github", "build.js", "build"]);
    model.setCollapsed([0], true);
    assert.deepStrictEqual(toArray(list), ["vscode"]);
    model.setCollapsed([0], false);
    assert.deepStrictEqual(toArray(list), ["vscode", ".build", "github", "build.js", "build"]);
    disposable.dispose();
  });
  test("recursive filter updates when children change (#133272)", async () => {
    const list = [];
    let query = "";
    const filter = new class {
      filter(element) {
        return element.includes(query) ? TreeVisibility.Visible : TreeVisibility.Recurse;
      }
    }();
    const model = new IndexTreeModel("test", "root", { filter });
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      {
        element: "a",
        children: [
          { element: "b" }
        ]
      }
    ]);
    assert.deepStrictEqual(toArray(list), ["a", "b"]);
    query = "visible";
    model.refilter();
    assert.deepStrictEqual(toArray(list), []);
    model.splice([0, 0, 0], 0, [
      {
        element: "visible",
        children: []
      }
    ]);
    await timeout(0);
    assert.deepStrictEqual(toArray(list), ["a", "b", "visible"]);
    disposable.dispose();
  });
  test("recursive filter with collapse", () => {
    const list = [];
    let query = new RegExp("");
    const filter = new class {
      filter(element) {
        return query.test(element) ? TreeVisibility.Visible : TreeVisibility.Recurse;
      }
    }();
    const model = new IndexTreeModel("test", "root", { filter });
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      {
        element: "vscode",
        children: [
          { element: ".build" },
          { element: "git" },
          {
            element: "github",
            children: [
              { element: "calendar.yml" },
              { element: "endgame" },
              { element: "build.js" }
            ]
          },
          {
            element: "build",
            children: [
              { element: "lib" },
              { element: "gulpfile.js" }
            ]
          }
        ]
      }
    ]);
    assert.deepStrictEqual(list.length, 10);
    query = /gulp/;
    model.refilter();
    assert.deepStrictEqual(toArray(list), ["vscode", "build", "gulpfile.js"]);
    model.setCollapsed([0, 3], true);
    assert.deepStrictEqual(toArray(list), ["vscode", "build"]);
    model.setCollapsed([0], true);
    assert.deepStrictEqual(toArray(list), ["vscode"]);
    disposable.dispose();
  });
  test("recursive filter while collapsed", () => {
    const list = [];
    let query = new RegExp("");
    const filter = new class {
      filter(element) {
        return query.test(element) ? TreeVisibility.Visible : TreeVisibility.Recurse;
      }
    }();
    const model = new IndexTreeModel("test", "root", { filter });
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      {
        element: "vscode",
        collapsed: true,
        children: [
          { element: ".build" },
          { element: "git" },
          {
            element: "github",
            children: [
              { element: "calendar.yml" },
              { element: "endgame" },
              { element: "build.js" }
            ]
          },
          {
            element: "build",
            children: [
              { element: "lib" },
              { element: "gulpfile.js" }
            ]
          }
        ]
      }
    ]);
    assert.deepStrictEqual(toArray(list), ["vscode"]);
    query = /gulp/;
    model.refilter();
    assert.deepStrictEqual(toArray(list), ["vscode"]);
    model.setCollapsed([0], false);
    assert.deepStrictEqual(toArray(list), ["vscode", "build", "gulpfile.js"]);
    model.setCollapsed([0], true);
    assert.deepStrictEqual(toArray(list), ["vscode"]);
    query = new RegExp("");
    model.refilter();
    assert.deepStrictEqual(toArray(list), ["vscode"]);
    model.setCollapsed([0], false);
    assert.deepStrictEqual(list.length, 10);
    disposable.dispose();
  });
  suite("getNodeLocation", () => {
    test("simple", () => {
      const list = [];
      const model = new IndexTreeModel("test", -1);
      const disposable = bindListToModel(list, model);
      model.splice([0], 0, [
        {
          element: 0,
          children: [
            { element: 10 },
            { element: 11 },
            { element: 12 }
          ]
        },
        { element: 1 },
        { element: 2 }
      ]);
      assert.deepStrictEqual(model.getNodeLocation(list[0]), [0]);
      assert.deepStrictEqual(model.getNodeLocation(list[1]), [0, 0]);
      assert.deepStrictEqual(model.getNodeLocation(list[2]), [0, 1]);
      assert.deepStrictEqual(model.getNodeLocation(list[3]), [0, 2]);
      assert.deepStrictEqual(model.getNodeLocation(list[4]), [1]);
      assert.deepStrictEqual(model.getNodeLocation(list[5]), [2]);
      disposable.dispose();
    });
    test("with filter", () => {
      const list = [];
      const filter = new class {
        filter(element) {
          return element % 2 === 0 ? TreeVisibility.Visible : TreeVisibility.Hidden;
        }
      }();
      const model = new IndexTreeModel("test", -1, { filter });
      const disposable = bindListToModel(list, model);
      model.splice([0], 0, [
        {
          element: 0,
          children: [
            { element: 1 },
            { element: 2 },
            { element: 3 },
            { element: 4 },
            { element: 5 },
            { element: 6 },
            { element: 7 }
          ]
        }
      ]);
      assert.deepStrictEqual(model.getNodeLocation(list[0]), [0]);
      assert.deepStrictEqual(model.getNodeLocation(list[1]), [0, 1]);
      assert.deepStrictEqual(model.getNodeLocation(list[2]), [0, 3]);
      assert.deepStrictEqual(model.getNodeLocation(list[3]), [0, 5]);
      disposable.dispose();
    });
  });
  test("refilter with filtered out nodes", () => {
    const list = [];
    let query = new RegExp("");
    const filter = new class {
      filter(element) {
        return query.test(element);
      }
    }();
    const model = new IndexTreeModel("test", "root", { filter });
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      { element: "silver" },
      { element: "gold" },
      { element: "platinum" }
    ]);
    assert.deepStrictEqual(toArray(list), ["silver", "gold", "platinum"]);
    query = /platinum/;
    model.refilter();
    assert.deepStrictEqual(toArray(list), ["platinum"]);
    model.splice([0], Number.POSITIVE_INFINITY, [
      { element: "silver" },
      { element: "gold" },
      { element: "platinum" }
    ]);
    assert.deepStrictEqual(toArray(list), ["platinum"]);
    model.refilter();
    assert.deepStrictEqual(toArray(list), ["platinum"]);
    disposable.dispose();
  });
  test("explicit hidden nodes should have renderNodeCount == 0, issue #83211", () => {
    const list = [];
    let query = new RegExp("");
    const filter = new class {
      filter(element) {
        return query.test(element);
      }
    }();
    const model = new IndexTreeModel("test", "root", { filter });
    const disposable = bindListToModel(list, model);
    model.splice([0], 0, [
      { element: "a", children: [{ element: "aa" }] },
      { element: "b", children: [{ element: "bb" }] }
    ]);
    assert.deepStrictEqual(toArray(list), ["a", "aa", "b", "bb"]);
    assert.deepStrictEqual(model.getListIndex([0]), 0);
    assert.deepStrictEqual(model.getListIndex([0, 0]), 1);
    assert.deepStrictEqual(model.getListIndex([1]), 2);
    assert.deepStrictEqual(model.getListIndex([1, 0]), 3);
    query = /b/;
    model.refilter();
    assert.deepStrictEqual(toArray(list), ["b", "bb"]);
    assert.deepStrictEqual(model.getListIndex([0]), -1);
    assert.deepStrictEqual(model.getListIndex([0, 0]), -1);
    assert.deepStrictEqual(model.getListIndex([1]), 0);
    assert.deepStrictEqual(model.getListIndex([1, 0]), 1);
    disposable.dispose();
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvYnJvd3Nlci91aS90cmVlL2luZGV4VHJlZU1vZGVsLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBJSW5kZXhUcmVlTW9kZWxTcGxpY2VPcHRpb25zLCBJSW5kZXhUcmVlTm9kZSwgSW5kZXhUcmVlTW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL3VpL3RyZWUvaW5kZXhUcmVlTW9kZWwuanMnO1xuaW1wb3J0IHsgSVRyZWVFbGVtZW50LCBJVHJlZUZpbHRlciwgSVRyZWVOb2RlLCBUcmVlVmlzaWJpbGl0eSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvdWkvdHJlZS90cmVlLmpzJztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGlmZWN5Y2xlLmpzJztcblxuZnVuY3Rpb24gYmluZExpc3RUb01vZGVsPFQ+KGxpc3Q6IElUcmVlTm9kZTxUPltdLCBtb2RlbDogSW5kZXhUcmVlTW9kZWw8VD4pOiBJRGlzcG9zYWJsZSB7XG5cdHJldHVybiBtb2RlbC5vbkRpZFNwbGljZVJlbmRlcmVkTm9kZXMoKHsgc3RhcnQsIGRlbGV0ZUNvdW50LCBlbGVtZW50cyB9KSA9PiB7XG5cdFx0bGlzdC5zcGxpY2Uoc3RhcnQsIGRlbGV0ZUNvdW50LCAuLi5lbGVtZW50cyk7XG5cdH0pO1xufVxuXG5mdW5jdGlvbiB0b0FycmF5PFQ+KGxpc3Q6IElUcmVlTm9kZTxUPltdKTogVFtdIHtcblx0cmV0dXJuIGxpc3QubWFwKGkgPT4gaS5lbGVtZW50KTtcbn1cblxuXG5mdW5jdGlvbiB0b0VsZW1lbnRzPFQ+KG5vZGU6IElUcmVlTm9kZTxUPik6IGFueSB7XG5cdHJldHVybiBub2RlLmNoaWxkcmVuPy5sZW5ndGggPyB7IGU6IG5vZGUuZWxlbWVudCwgY2hpbGRyZW46IG5vZGUuY2hpbGRyZW4ubWFwKHRvRWxlbWVudHMpIH0gOiBub2RlLmVsZW1lbnQ7XG59XG5cbmNvbnN0IGRpZmZJZGVudGl0eVByb3ZpZGVyID0geyBnZXRJZDogKG46IG51bWJlcikgPT4gU3RyaW5nKG4pIH07XG5cbi8qKlxuICogQ2FsbHMgdGhhdCB0ZXN0IGZ1bmN0aW9uIHR3aWNlLCBvbmNlIHdpdGggYW4gZW1wdHkgb3B0aW9ucyBhbmRcbiAqIG9uY2Ugd2l0aCBgZGlmZklkZW50aXR5UHJvdmlkZXJgLlxuICovXG5mdW5jdGlvbiB3aXRoU21hcnRTcGxpY2UoZm46IChvcHRpb25zOiBJSW5kZXhUcmVlTW9kZWxTcGxpY2VPcHRpb25zPG51bWJlciwgYW55PikgPT4gdm9pZCkge1xuXHRmbih7fSk7XG5cdGZuKHsgZGlmZklkZW50aXR5UHJvdmlkZXIgfSk7XG59XG5cbnN1aXRlKCdJbmRleFRyZWVNb2RlbCcsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2N0b3InLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGlzdDogSVRyZWVOb2RlPG51bWJlcj5bXSA9IFtdO1xuXHRcdGNvbnN0IG1vZGVsID0gbmV3IEluZGV4VHJlZU1vZGVsPG51bWJlcj4oJ3Rlc3QnLCAtMSk7XG5cdFx0YXNzZXJ0KG1vZGVsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGlzdC5sZW5ndGgsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdpbnNlcnQnLCAoKSA9PiB3aXRoU21hcnRTcGxpY2Uob3B0aW9ucyA9PiB7XG5cdFx0Y29uc3QgbGlzdDogSVRyZWVOb2RlPG51bWJlcj5bXSA9IFtdO1xuXHRcdGNvbnN0IG1vZGVsID0gbmV3IEluZGV4VHJlZU1vZGVsPG51bWJlcj4oJ3Rlc3QnLCAtMSk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGJpbmRMaXN0VG9Nb2RlbChsaXN0LCBtb2RlbCk7XG5cblx0XHRtb2RlbC5zcGxpY2UoWzBdLCAwLCBbXG5cdFx0XHR7IGVsZW1lbnQ6IDAgfSxcblx0XHRcdHsgZWxlbWVudDogMSB9LFxuXHRcdFx0eyBlbGVtZW50OiAyIH1cblx0XHRdLCBvcHRpb25zKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdC5sZW5ndGgsIDMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFswXS5lbGVtZW50LCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMF0uY29sbGFwc2VkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzBdLmRlcHRoLCAxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMV0uZWxlbWVudCwgMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzFdLmNvbGxhcHNlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsxXS5kZXB0aCwgMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzJdLmVsZW1lbnQsIDIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsyXS5jb2xsYXBzZWQsIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMl0uZGVwdGgsIDEpO1xuXG5cdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH0pKTtcblxuXHR0ZXN0KCdkZWVwIGluc2VydCcsICgpID0+IHdpdGhTbWFydFNwbGljZShvcHRpb25zID0+IHtcblx0XHRjb25zdCBsaXN0OiBJVHJlZU5vZGU8bnVtYmVyPltdID0gW107XG5cdFx0Y29uc3QgbW9kZWwgPSBuZXcgSW5kZXhUcmVlTW9kZWw8bnVtYmVyPigndGVzdCcsIC0xKTtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gYmluZExpc3RUb01vZGVsKGxpc3QsIG1vZGVsKTtcblxuXHRcdG1vZGVsLnNwbGljZShbMF0sIDAsIFtcblx0XHRcdHtcblx0XHRcdFx0ZWxlbWVudDogMCwgY2hpbGRyZW46IFtcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IDEwIH0sXG5cdFx0XHRcdFx0eyBlbGVtZW50OiAxMSB9LFxuXHRcdFx0XHRcdHsgZWxlbWVudDogMTIgfSxcblx0XHRcdFx0XVxuXHRcdFx0fSxcblx0XHRcdHsgZWxlbWVudDogMSB9LFxuXHRcdFx0eyBlbGVtZW50OiAyIH1cblx0XHRdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdC5sZW5ndGgsIDYpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFswXS5lbGVtZW50LCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMF0uY29sbGFwc2VkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzBdLmRlcHRoLCAxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMV0uZWxlbWVudCwgMTApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsxXS5jb2xsYXBzZWQsIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMV0uZGVwdGgsIDIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsyXS5lbGVtZW50LCAxMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzJdLmNvbGxhcHNlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsyXS5kZXB0aCwgMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzNdLmVsZW1lbnQsIDEyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbM10uY29sbGFwc2VkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzNdLmRlcHRoLCAyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbNF0uZWxlbWVudCwgMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzRdLmNvbGxhcHNlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFs0XS5kZXB0aCwgMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzVdLmVsZW1lbnQsIDIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFs1XS5jb2xsYXBzZWQsIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbNV0uZGVwdGgsIDEpO1xuXG5cdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH0pKTtcblxuXHR0ZXN0KCdkZWVwIGluc2VydCBjb2xsYXBzZWQnLCAoKSA9PiB3aXRoU21hcnRTcGxpY2Uob3B0aW9ucyA9PiB7XG5cdFx0Y29uc3QgbGlzdDogSVRyZWVOb2RlPG51bWJlcj5bXSA9IFtdO1xuXHRcdGNvbnN0IG1vZGVsID0gbmV3IEluZGV4VHJlZU1vZGVsPG51bWJlcj4oJ3Rlc3QnLCAtMSk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGJpbmRMaXN0VG9Nb2RlbChsaXN0LCBtb2RlbCk7XG5cblx0XHRtb2RlbC5zcGxpY2UoWzBdLCAwLCBbXG5cdFx0XHR7XG5cdFx0XHRcdGVsZW1lbnQ6IDAsIGNvbGxhcHNlZDogdHJ1ZSwgY2hpbGRyZW46IFtcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IDEwIH0sXG5cdFx0XHRcdFx0eyBlbGVtZW50OiAxMSB9LFxuXHRcdFx0XHRcdHsgZWxlbWVudDogMTIgfSxcblx0XHRcdFx0XVxuXHRcdFx0fSxcblx0XHRcdHsgZWxlbWVudDogMSB9LFxuXHRcdFx0eyBlbGVtZW50OiAyIH1cblx0XHRdLCBvcHRpb25zKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdC5sZW5ndGgsIDMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFswXS5lbGVtZW50LCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMF0uY29sbGFwc2VkLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMF0uZGVwdGgsIDEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsxXS5lbGVtZW50LCAxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMV0uY29sbGFwc2VkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzFdLmRlcHRoLCAxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMl0uZWxlbWVudCwgMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzJdLmNvbGxhcHNlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsyXS5kZXB0aCwgMSk7XG5cblx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fSkpO1xuXG5cdHRlc3QoJ2RlbGV0ZScsICgpID0+IHdpdGhTbWFydFNwbGljZShvcHRpb25zID0+IHtcblx0XHRjb25zdCBsaXN0OiBJVHJlZU5vZGU8bnVtYmVyPltdID0gW107XG5cdFx0Y29uc3QgbW9kZWwgPSBuZXcgSW5kZXhUcmVlTW9kZWw8bnVtYmVyPigndGVzdCcsIC0xKTtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gYmluZExpc3RUb01vZGVsKGxpc3QsIG1vZGVsKTtcblxuXHRcdG1vZGVsLnNwbGljZShbMF0sIDAsIFtcblx0XHRcdHsgZWxlbWVudDogMCB9LFxuXHRcdFx0eyBlbGVtZW50OiAxIH0sXG5cdFx0XHR7IGVsZW1lbnQ6IDIgfVxuXHRcdF0sIG9wdGlvbnMpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0Lmxlbmd0aCwgMyk7XG5cblx0XHRtb2RlbC5zcGxpY2UoWzFdLCAxLCB1bmRlZmluZWQsIG9wdGlvbnMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdC5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFswXS5lbGVtZW50LCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMF0uY29sbGFwc2VkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzBdLmRlcHRoLCAxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMV0uZWxlbWVudCwgMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzFdLmNvbGxhcHNlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsxXS5kZXB0aCwgMSk7XG5cblx0XHRtb2RlbC5zcGxpY2UoWzBdLCAyLCB1bmRlZmluZWQsIG9wdGlvbnMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdC5sZW5ndGgsIDApO1xuXG5cdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH0pKTtcblxuXHR0ZXN0KCduZXN0ZWQgZGVsZXRlJywgKCkgPT4gd2l0aFNtYXJ0U3BsaWNlKG9wdGlvbnMgPT4ge1xuXHRcdGNvbnN0IGxpc3Q6IElUcmVlTm9kZTxudW1iZXI+W10gPSBbXTtcblx0XHRjb25zdCBtb2RlbCA9IG5ldyBJbmRleFRyZWVNb2RlbDxudW1iZXI+KCd0ZXN0JywgLTEpO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBiaW5kTGlzdFRvTW9kZWwobGlzdCwgbW9kZWwpO1xuXG5cdFx0bW9kZWwuc3BsaWNlKFswXSwgMCwgW1xuXHRcdFx0e1xuXHRcdFx0XHRlbGVtZW50OiAwLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHsgZWxlbWVudDogMTAgfSxcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IDExIH0sXG5cdFx0XHRcdFx0eyBlbGVtZW50OiAxMiB9LFxuXHRcdFx0XHRdXG5cdFx0XHR9LFxuXHRcdFx0eyBlbGVtZW50OiAxIH0sXG5cdFx0XHR7IGVsZW1lbnQ6IDIgfVxuXHRcdF0sIG9wdGlvbnMpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0Lmxlbmd0aCwgNik7XG5cblx0XHRtb2RlbC5zcGxpY2UoWzFdLCAyLCB1bmRlZmluZWQsIG9wdGlvbnMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdC5sZW5ndGgsIDQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFswXS5lbGVtZW50LCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMF0uY29sbGFwc2VkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzBdLmRlcHRoLCAxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMV0uZWxlbWVudCwgMTApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsxXS5jb2xsYXBzZWQsIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMV0uZGVwdGgsIDIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsyXS5lbGVtZW50LCAxMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzJdLmNvbGxhcHNlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsyXS5kZXB0aCwgMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzNdLmVsZW1lbnQsIDEyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbM10uY29sbGFwc2VkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzNdLmRlcHRoLCAyKTtcblxuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9KSk7XG5cblx0dGVzdCgnZGVlcCBkZWxldGUnLCAoKSA9PiB3aXRoU21hcnRTcGxpY2Uob3B0aW9ucyA9PiB7XG5cdFx0Y29uc3QgbGlzdDogSVRyZWVOb2RlPG51bWJlcj5bXSA9IFtdO1xuXHRcdGNvbnN0IG1vZGVsID0gbmV3IEluZGV4VHJlZU1vZGVsPG51bWJlcj4oJ3Rlc3QnLCAtMSk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGJpbmRMaXN0VG9Nb2RlbChsaXN0LCBtb2RlbCk7XG5cblx0XHRtb2RlbC5zcGxpY2UoWzBdLCAwLCBbXG5cdFx0XHR7XG5cdFx0XHRcdGVsZW1lbnQ6IDAsIGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0eyBlbGVtZW50OiAxMCB9LFxuXHRcdFx0XHRcdHsgZWxlbWVudDogMTEgfSxcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IDEyIH0sXG5cdFx0XHRcdF1cblx0XHRcdH0sXG5cdFx0XHR7IGVsZW1lbnQ6IDEgfSxcblx0XHRcdHsgZWxlbWVudDogMiB9XG5cdFx0XSwgb3B0aW9ucyk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3QubGVuZ3RoLCA2KTtcblxuXHRcdG1vZGVsLnNwbGljZShbMF0sIDEsIHVuZGVmaW5lZCwgb3B0aW9ucyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0Lmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzBdLmVsZW1lbnQsIDEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFswXS5jb2xsYXBzZWQsIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMF0uZGVwdGgsIDEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsxXS5lbGVtZW50LCAyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMV0uY29sbGFwc2VkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzFdLmRlcHRoLCAxKTtcblxuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9KSk7XG5cblx0dGVzdCgnc21hcnQgc3BsaWNlIGRlZXAnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGlzdDogSVRyZWVOb2RlPG51bWJlcj5bXSA9IFtdO1xuXHRcdGNvbnN0IG1vZGVsID0gbmV3IEluZGV4VHJlZU1vZGVsPG51bWJlcj4oJ3Rlc3QnLCAtMSk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGJpbmRMaXN0VG9Nb2RlbChsaXN0LCBtb2RlbCk7XG5cblx0XHRtb2RlbC5zcGxpY2UoWzBdLCAwLCBbXG5cdFx0XHR7IGVsZW1lbnQ6IDAgfSxcblx0XHRcdHsgZWxlbWVudDogMSB9LFxuXHRcdFx0eyBlbGVtZW50OiAyIH0sXG5cdFx0XHR7IGVsZW1lbnQ6IDMgfSxcblx0XHRdLCB7IGRpZmZJZGVudGl0eVByb3ZpZGVyIH0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0LmZpbHRlcihsID0+IGwuZGVwdGggPT09IDEpLm1hcCh0b0VsZW1lbnRzKSwgW1xuXHRcdFx0MCxcblx0XHRcdDEsXG5cdFx0XHQyLFxuXHRcdFx0Myxcblx0XHRdKTtcblxuXHRcdG1vZGVsLnNwbGljZShbMF0sIDMsIFtcblx0XHRcdHsgZWxlbWVudDogLTAuNSB9LFxuXHRcdFx0eyBlbGVtZW50OiAwLCBjaGlsZHJlbjogW3sgZWxlbWVudDogMC4xIH1dIH0sXG5cdFx0XHR7IGVsZW1lbnQ6IDEgfSxcblx0XHRcdHsgZWxlbWVudDogMiwgY2hpbGRyZW46IFt7IGVsZW1lbnQ6IDIuMSB9LCB7IGVsZW1lbnQ6IDIuMiwgY2hpbGRyZW46IFt7IGVsZW1lbnQ6IDIuMjEgfV0gfV0gfSxcblx0XHRdLCB7IGRpZmZJZGVudGl0eVByb3ZpZGVyLCBkaWZmRGVwdGg6IEluZmluaXR5IH0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0LmZpbHRlcihsID0+IGwuZGVwdGggPT09IDEpLm1hcCh0b0VsZW1lbnRzKSwgW1xuXHRcdFx0LTAuNSxcblx0XHRcdHsgZTogMCwgY2hpbGRyZW46IFswLjFdIH0sXG5cdFx0XHQxLFxuXHRcdFx0eyBlOiAyLCBjaGlsZHJlbjogWzIuMSwgeyBlOiAyLjIsIGNoaWxkcmVuOiBbMi4yMV0gfV0gfSxcblx0XHRcdDMsXG5cdFx0XSk7XG5cblx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnaGlkZGVuIGRlbGV0ZScsICgpID0+IHdpdGhTbWFydFNwbGljZShvcHRpb25zID0+IHtcblx0XHRjb25zdCBsaXN0OiBJVHJlZU5vZGU8bnVtYmVyPltdID0gW107XG5cdFx0Y29uc3QgbW9kZWwgPSBuZXcgSW5kZXhUcmVlTW9kZWw8bnVtYmVyPigndGVzdCcsIC0xKTtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gYmluZExpc3RUb01vZGVsKGxpc3QsIG1vZGVsKTtcblxuXHRcdG1vZGVsLnNwbGljZShbMF0sIDAsIFtcblx0XHRcdHtcblx0XHRcdFx0ZWxlbWVudDogMCwgY29sbGFwc2VkOiB0cnVlLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHsgZWxlbWVudDogMTAgfSxcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IDExIH0sXG5cdFx0XHRcdFx0eyBlbGVtZW50OiAxMiB9LFxuXHRcdFx0XHRdXG5cdFx0XHR9LFxuXHRcdFx0eyBlbGVtZW50OiAxIH0sXG5cdFx0XHR7IGVsZW1lbnQ6IDIgfVxuXHRcdF0sIG9wdGlvbnMpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0Lmxlbmd0aCwgMyk7XG5cblx0XHRtb2RlbC5zcGxpY2UoWzAsIDFdLCAxLCB1bmRlZmluZWQsIG9wdGlvbnMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdC5sZW5ndGgsIDMpO1xuXG5cdFx0bW9kZWwuc3BsaWNlKFswLCAwXSwgMiwgdW5kZWZpbmVkLCBvcHRpb25zKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3QubGVuZ3RoLCAzKTtcblxuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9KSk7XG5cblx0dGVzdCgnY29sbGFwc2UnLCAoKSA9PiB3aXRoU21hcnRTcGxpY2Uob3B0aW9ucyA9PiB7XG5cdFx0Y29uc3QgbGlzdDogSVRyZWVOb2RlPG51bWJlcj5bXSA9IFtdO1xuXHRcdGNvbnN0IG1vZGVsID0gbmV3IEluZGV4VHJlZU1vZGVsPG51bWJlcj4oJ3Rlc3QnLCAtMSk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGJpbmRMaXN0VG9Nb2RlbChsaXN0LCBtb2RlbCk7XG5cblx0XHRtb2RlbC5zcGxpY2UoWzBdLCAwLCBbXG5cdFx0XHR7XG5cdFx0XHRcdGVsZW1lbnQ6IDAsIGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0eyBlbGVtZW50OiAxMCB9LFxuXHRcdFx0XHRcdHsgZWxlbWVudDogMTEgfSxcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IDEyIH0sXG5cdFx0XHRcdF1cblx0XHRcdH0sXG5cdFx0XHR7IGVsZW1lbnQ6IDEgfSxcblx0XHRcdHsgZWxlbWVudDogMiB9XG5cdFx0XSwgb3B0aW9ucyk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3QubGVuZ3RoLCA2KTtcblxuXHRcdG1vZGVsLnNldENvbGxhcHNlZChbMF0sIHRydWUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdC5sZW5ndGgsIDMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFswXS5lbGVtZW50LCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMF0uY29sbGFwc2VkLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMF0uZGVwdGgsIDEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsxXS5lbGVtZW50LCAxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMV0uY29sbGFwc2VkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzFdLmRlcHRoLCAxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMl0uZWxlbWVudCwgMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzJdLmNvbGxhcHNlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsyXS5kZXB0aCwgMSk7XG5cblx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fSkpO1xuXG5cdHRlc3QoJ2V4cGFuZCcsICgpID0+IHdpdGhTbWFydFNwbGljZShvcHRpb25zID0+IHtcblx0XHRjb25zdCBsaXN0OiBJVHJlZU5vZGU8bnVtYmVyPltdID0gW107XG5cdFx0Y29uc3QgbW9kZWwgPSBuZXcgSW5kZXhUcmVlTW9kZWw8bnVtYmVyPigndGVzdCcsIC0xKTtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gYmluZExpc3RUb01vZGVsKGxpc3QsIG1vZGVsKTtcblxuXHRcdG1vZGVsLnNwbGljZShbMF0sIDAsIFtcblx0XHRcdHtcblx0XHRcdFx0ZWxlbWVudDogMCwgY29sbGFwc2VkOiB0cnVlLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHsgZWxlbWVudDogMTAgfSxcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IDExIH0sXG5cdFx0XHRcdFx0eyBlbGVtZW50OiAxMiB9LFxuXHRcdFx0XHRdXG5cdFx0XHR9LFxuXHRcdFx0eyBlbGVtZW50OiAxIH0sXG5cdFx0XHR7IGVsZW1lbnQ6IDIgfVxuXHRcdF0sIG9wdGlvbnMpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0Lmxlbmd0aCwgMyk7XG5cblx0XHRtb2RlbC5leHBhbmRUbyhbMCwgMV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdC5sZW5ndGgsIDYpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFswXS5lbGVtZW50LCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMF0uY29sbGFwc2VkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzBdLmRlcHRoLCAxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMV0uZWxlbWVudCwgMTApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsxXS5jb2xsYXBzZWQsIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMV0uZGVwdGgsIDIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsyXS5lbGVtZW50LCAxMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzJdLmNvbGxhcHNlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsyXS5kZXB0aCwgMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzNdLmVsZW1lbnQsIDEyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbM10uY29sbGFwc2VkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzNdLmRlcHRoLCAyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbNF0uZWxlbWVudCwgMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzRdLmNvbGxhcHNlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFs0XS5kZXB0aCwgMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzVdLmVsZW1lbnQsIDIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFs1XS5jb2xsYXBzZWQsIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbNV0uZGVwdGgsIDEpO1xuXG5cdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH0pKTtcblxuXHR0ZXN0KCdzbWFydCBkaWZmIGNvbnNpc3RlbmN5JywgKCkgPT4ge1xuXHRcdGNvbnN0IHRpbWVzID0gNTAwO1xuXHRcdGNvbnN0IG1pbkVkaXRzID0gMTtcblx0XHRjb25zdCBtYXhFZGl0cyA9IDEwO1xuXHRcdGNvbnN0IG1heEluc2VydHMgPSA1O1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aW1lczsgaSsrKSB7XG5cdFx0XHRjb25zdCBsaXN0OiBJVHJlZU5vZGU8bnVtYmVyPltdID0gW107XG5cdFx0XHRjb25zdCBvcHRpb25zID0geyBkaWZmSWRlbnRpdHlQcm92aWRlcjogeyBnZXRJZDogKG46IG51bWJlcikgPT4gU3RyaW5nKG4pIH0gfTtcblx0XHRcdGNvbnN0IG1vZGVsID0gbmV3IEluZGV4VHJlZU1vZGVsPG51bWJlcj4oJ3Rlc3QnLCAtMSk7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlID0gYmluZExpc3RUb01vZGVsKGxpc3QsIG1vZGVsKTtcblxuXHRcdFx0Y29uc3QgY2hhbmdlcyA9IFtdO1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWQ6IG51bWJlcltdID0gW107XG5cdFx0XHRsZXQgZWxlbWVudENvdW50ZXIgPSAwO1xuXG5cdFx0XHRmb3IgKGxldCBlZGl0cyA9IE1hdGgucmFuZG9tKCkgKiAobWF4RWRpdHMgLSBtaW5FZGl0cykgKyBtaW5FZGl0czsgZWRpdHMgPiAwOyBlZGl0cy0tKSB7XG5cdFx0XHRcdGNvbnN0IHNwbGljZUluZGV4ID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogbGlzdC5sZW5ndGgpO1xuXHRcdFx0XHRjb25zdCBkZWxldGVDb3VudCA9IE1hdGguY2VpbChNYXRoLnJhbmRvbSgpICogKGxpc3QubGVuZ3RoIC0gc3BsaWNlSW5kZXgpKTtcblx0XHRcdFx0Y29uc3QgaW5zZXJ0Q291bnQgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBtYXhJbnNlcnRzICsgMSk7XG5cblx0XHRcdFx0Y29uc3QgaW5zZXJ0czogSVRyZWVFbGVtZW50PG51bWJlcj5bXSA9IFtdO1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGluc2VydENvdW50OyBpKyspIHtcblx0XHRcdFx0XHRjb25zdCBlbGVtZW50ID0gZWxlbWVudENvdW50ZXIrKztcblx0XHRcdFx0XHRpbnNlcnRzLnB1c2goeyBlbGVtZW50LCBjaGlsZHJlbjogW10gfSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBtb3ZlIGV4aXN0aW5nIGl0ZW1zXG5cdFx0XHRcdGlmIChNYXRoLnJhbmRvbSgpIDwgMC41KSB7XG5cdFx0XHRcdFx0Y29uc3QgZWxlbWVudHMgPSBsaXN0LnNsaWNlKHNwbGljZUluZGV4LCBzcGxpY2VJbmRleCArIE1hdGguZmxvb3IoZGVsZXRlQ291bnQgLyAyKSk7XG5cdFx0XHRcdFx0aW5zZXJ0cy5wdXNoKC4uLmVsZW1lbnRzLm1hcCgoeyBlbGVtZW50IH0pID0+ICh7IGVsZW1lbnQsIGNoaWxkcmVuOiBbXSB9KSkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0bW9kZWwuc3BsaWNlKFtzcGxpY2VJbmRleF0sIGRlbGV0ZUNvdW50LCBpbnNlcnRzLCBvcHRpb25zKTtcblx0XHRcdFx0ZXhwZWN0ZWQuc3BsaWNlKHNwbGljZUluZGV4LCBkZWxldGVDb3VudCwgLi4uaW5zZXJ0cy5tYXAoaSA9PiBpLmVsZW1lbnQpKTtcblxuXHRcdFx0XHRjb25zdCBsaXN0RWxlbWVudHMgPSBsaXN0Lm1hcChsID0+IGwuZWxlbWVudCk7XG5cdFx0XHRcdGNoYW5nZXMucHVzaChgc3BsaWNlKCR7c3BsaWNlSW5kZXh9LCAke2RlbGV0ZUNvdW50fSwgWyR7aW5zZXJ0cy5tYXAoZSA9PiBlLmVsZW1lbnQpLmpvaW4oJywgJyl9XSkgLT4gJHtsaXN0RWxlbWVudHMuam9pbignLCAnKX1gKTtcblxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGV4cGVjdGVkLCBsaXN0RWxlbWVudHMsIGBFeHBlY3RlZCAke2xpc3RFbGVtZW50cy5qb2luKCcsICcpfSB0byBlcXVhbCAke2V4cGVjdGVkLmpvaW4oJywgJyl9LiBTdGVwczpcXG5cXG4ke2NoYW5nZXMuam9pbignXFxuJyl9YCk7XG5cdFx0XHR9XG5cblx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnY29sbGFwc2Ugc2hvdWxkIHJlY3Vyc2l2ZWx5IGFkanVzdCB2aXNpYmxlIGNvdW50JywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpc3Q6IElUcmVlTm9kZTxudW1iZXI+W10gPSBbXTtcblx0XHRjb25zdCBtb2RlbCA9IG5ldyBJbmRleFRyZWVNb2RlbDxudW1iZXI+KCd0ZXN0JywgLTEpO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBiaW5kTGlzdFRvTW9kZWwobGlzdCwgbW9kZWwpO1xuXG5cdFx0bW9kZWwuc3BsaWNlKFswXSwgMCwgW1xuXHRcdFx0e1xuXHRcdFx0XHRlbGVtZW50OiAxLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGVsZW1lbnQ6IDExLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHR7IGVsZW1lbnQ6IDExMSB9XG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRlbGVtZW50OiAyLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHsgZWxlbWVudDogMjEgfVxuXHRcdFx0XHRdXG5cdFx0XHR9XG5cdFx0XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3QubGVuZ3RoLCA1KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvQXJyYXkobGlzdCksIFsxLCAxMSwgMTExLCAyLCAyMV0pO1xuXG5cdFx0bW9kZWwuc2V0Q29sbGFwc2VkKFswLCAwXSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0Lmxlbmd0aCwgNCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b0FycmF5KGxpc3QpLCBbMSwgMTEsIDIsIDIxXSk7XG5cblx0XHRtb2RlbC5zZXRDb2xsYXBzZWQoWzFdLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3QubGVuZ3RoLCAzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvQXJyYXkobGlzdCksIFsxLCAxMSwgMl0pO1xuXG5cdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NldENvbGxhcHNpYmxlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpc3Q6IElUcmVlTm9kZTxudW1iZXI+W10gPSBbXTtcblx0XHRjb25zdCBtb2RlbCA9IG5ldyBJbmRleFRyZWVNb2RlbDxudW1iZXI+KCd0ZXN0JywgLTEpO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBiaW5kTGlzdFRvTW9kZWwobGlzdCwgbW9kZWwpO1xuXG5cdFx0bW9kZWwuc3BsaWNlKFswXSwgMCwgW1xuXHRcdFx0e1xuXHRcdFx0XHRlbGVtZW50OiAwLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHsgZWxlbWVudDogMTAgfVxuXHRcdFx0XHRdXG5cdFx0XHR9XG5cdFx0XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3QubGVuZ3RoLCAyKTtcblxuXHRcdG1vZGVsLnNldENvbGxhcHNpYmxlKFswXSwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdC5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFswXS5lbGVtZW50LCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMF0uY29sbGFwc2libGUsIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMF0uY29sbGFwc2VkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzFdLmVsZW1lbnQsIDEwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMV0uY29sbGFwc2libGUsIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMV0uY29sbGFwc2VkLCBmYWxzZSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLnNldENvbGxhcHNlZChbMF0sIHRydWUpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzBdLmVsZW1lbnQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFswXS5jb2xsYXBzaWJsZSwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFswXS5jb2xsYXBzZWQsIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMV0uZWxlbWVudCwgMTApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsxXS5jb2xsYXBzaWJsZSwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsxXS5jb2xsYXBzZWQsIGZhbHNlKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuc2V0Q29sbGFwc2VkKFswXSwgZmFsc2UpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzBdLmVsZW1lbnQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFswXS5jb2xsYXBzaWJsZSwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFswXS5jb2xsYXBzZWQsIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RbMV0uZWxlbWVudCwgMTApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsxXS5jb2xsYXBzaWJsZSwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsxXS5jb2xsYXBzZWQsIGZhbHNlKTtcblxuXHRcdG1vZGVsLnNldENvbGxhcHNpYmxlKFswXSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0Lmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzBdLmVsZW1lbnQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFswXS5jb2xsYXBzaWJsZSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzBdLmNvbGxhcHNlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsxXS5lbGVtZW50LCAxMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzFdLmNvbGxhcHNpYmxlLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzFdLmNvbGxhcHNlZCwgZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5zZXRDb2xsYXBzZWQoWzBdLCB0cnVlKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0Lmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzBdLmVsZW1lbnQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFswXS5jb2xsYXBzaWJsZSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzBdLmNvbGxhcHNlZCwgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLnNldENvbGxhcHNlZChbMF0sIGZhbHNlKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzBdLmVsZW1lbnQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFswXS5jb2xsYXBzaWJsZSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzBdLmNvbGxhcHNlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdFsxXS5lbGVtZW50LCAxMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzFdLmNvbGxhcHNpYmxlLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaXN0WzFdLmNvbGxhcHNlZCwgZmFsc2UpO1xuXG5cdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NpbXBsZSBmaWx0ZXInLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGlzdDogSVRyZWVOb2RlPG51bWJlcj5bXSA9IFtdO1xuXHRcdGNvbnN0IGZpbHRlciA9IG5ldyBjbGFzcyBpbXBsZW1lbnRzIElUcmVlRmlsdGVyPG51bWJlcj4ge1xuXHRcdFx0ZmlsdGVyKGVsZW1lbnQ6IG51bWJlcik6IFRyZWVWaXNpYmlsaXR5IHtcblx0XHRcdFx0cmV0dXJuIGVsZW1lbnQgJSAyID09PSAwID8gVHJlZVZpc2liaWxpdHkuVmlzaWJsZSA6IFRyZWVWaXNpYmlsaXR5LkhpZGRlbjtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBuZXcgSW5kZXhUcmVlTW9kZWw8bnVtYmVyPigndGVzdCcsIC0xLCB7IGZpbHRlciB9KTtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gYmluZExpc3RUb01vZGVsKGxpc3QsIG1vZGVsKTtcblxuXHRcdG1vZGVsLnNwbGljZShbMF0sIDAsIFtcblx0XHRcdHtcblx0XHRcdFx0ZWxlbWVudDogMCwgY2hpbGRyZW46IFtcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IDEgfSxcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IDIgfSxcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IDMgfSxcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IDQgfSxcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IDUgfSxcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IDYgfSxcblx0XHRcdFx0XHR7IGVsZW1lbnQ6IDcgfVxuXHRcdFx0XHRdXG5cdFx0XHR9XG5cdFx0XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3QubGVuZ3RoLCA0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvQXJyYXkobGlzdCksIFswLCAyLCA0LCA2XSk7XG5cblx0XHRtb2RlbC5zZXRDb2xsYXBzZWQoWzBdLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvQXJyYXkobGlzdCksIFswXSk7XG5cblx0XHRtb2RlbC5zZXRDb2xsYXBzZWQoWzBdLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b0FycmF5KGxpc3QpLCBbMCwgMiwgNCwgNl0pO1xuXG5cdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlY3Vyc2l2ZSBmaWx0ZXIgb24gaW5pdGlhbCBtb2RlbCcsICgpID0+IHtcblx0XHRjb25zdCBsaXN0OiBJVHJlZU5vZGU8bnVtYmVyPltdID0gW107XG5cdFx0Y29uc3QgZmlsdGVyID0gbmV3IGNsYXNzIGltcGxlbWVudHMgSVRyZWVGaWx0ZXI8bnVtYmVyPiB7XG5cdFx0XHRmaWx0ZXIoZWxlbWVudDogbnVtYmVyKTogVHJlZVZpc2liaWxpdHkge1xuXHRcdFx0XHRyZXR1cm4gZWxlbWVudCA9PT0gMCA/IFRyZWVWaXNpYmlsaXR5LlJlY3Vyc2UgOiBUcmVlVmlzaWJpbGl0eS5IaWRkZW47XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IG1vZGVsID0gbmV3IEluZGV4VHJlZU1vZGVsPG51bWJlcj4oJ3Rlc3QnLCAtMSwgeyBmaWx0ZXIgfSk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGJpbmRMaXN0VG9Nb2RlbChsaXN0LCBtb2RlbCk7XG5cblx0XHRtb2RlbC5zcGxpY2UoWzBdLCAwLCBbXG5cdFx0XHR7XG5cdFx0XHRcdGVsZW1lbnQ6IDAsIGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0eyBlbGVtZW50OiAxIH0sXG5cdFx0XHRcdFx0eyBlbGVtZW50OiAyIH1cblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdF0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b0FycmF5KGxpc3QpLCBbXSk7XG5cblx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgncmVmaWx0ZXInLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGlzdDogSVRyZWVOb2RlPG51bWJlcj5bXSA9IFtdO1xuXHRcdGxldCBzaG91bGRGaWx0ZXIgPSBmYWxzZTtcblx0XHRjb25zdCBmaWx0ZXIgPSBuZXcgY2xhc3MgaW1wbGVtZW50cyBJVHJlZUZpbHRlcjxudW1iZXI+IHtcblx0XHRcdGZpbHRlcihlbGVtZW50OiBudW1iZXIpOiBUcmVlVmlzaWJpbGl0eSB7XG5cdFx0XHRcdHJldHVybiAoIXNob3VsZEZpbHRlciB8fCBlbGVtZW50ICUgMiA9PT0gMCkgPyBUcmVlVmlzaWJpbGl0eS5WaXNpYmxlIDogVHJlZVZpc2liaWxpdHkuSGlkZGVuO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBtb2RlbCA9IG5ldyBJbmRleFRyZWVNb2RlbDxudW1iZXI+KCd0ZXN0JywgLTEsIHsgZmlsdGVyIH0pO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBiaW5kTGlzdFRvTW9kZWwobGlzdCwgbW9kZWwpO1xuXG5cdFx0bW9kZWwuc3BsaWNlKFswXSwgMCwgW1xuXHRcdFx0e1xuXHRcdFx0XHRlbGVtZW50OiAwLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHsgZWxlbWVudDogMSB9LFxuXHRcdFx0XHRcdHsgZWxlbWVudDogMiB9LFxuXHRcdFx0XHRcdHsgZWxlbWVudDogMyB9LFxuXHRcdFx0XHRcdHsgZWxlbWVudDogNCB9LFxuXHRcdFx0XHRcdHsgZWxlbWVudDogNSB9LFxuXHRcdFx0XHRcdHsgZWxlbWVudDogNiB9LFxuXHRcdFx0XHRcdHsgZWxlbWVudDogNyB9XG5cdFx0XHRcdF1cblx0XHRcdH0sXG5cdFx0XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvQXJyYXkobGlzdCksIFswLCAxLCAyLCAzLCA0LCA1LCA2LCA3XSk7XG5cblx0XHRtb2RlbC5yZWZpbHRlcigpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9BcnJheShsaXN0KSwgWzAsIDEsIDIsIDMsIDQsIDUsIDYsIDddKTtcblxuXHRcdHNob3VsZEZpbHRlciA9IHRydWU7XG5cdFx0bW9kZWwucmVmaWx0ZXIoKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvQXJyYXkobGlzdCksIFswLCAyLCA0LCA2XSk7XG5cblx0XHRzaG91bGRGaWx0ZXIgPSBmYWxzZTtcblx0XHRtb2RlbC5yZWZpbHRlcigpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9BcnJheShsaXN0KSwgWzAsIDEsIDIsIDMsIDQsIDUsIDYsIDddKTtcblxuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWN1cnNpdmUgZmlsdGVyJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpc3Q6IElUcmVlTm9kZTxzdHJpbmc+W10gPSBbXTtcblx0XHRsZXQgcXVlcnkgPSBuZXcgUmVnRXhwKCcnKTtcblx0XHRjb25zdCBmaWx0ZXIgPSBuZXcgY2xhc3MgaW1wbGVtZW50cyBJVHJlZUZpbHRlcjxzdHJpbmc+IHtcblx0XHRcdGZpbHRlcihlbGVtZW50OiBzdHJpbmcpOiBUcmVlVmlzaWJpbGl0eSB7XG5cdFx0XHRcdHJldHVybiBxdWVyeS50ZXN0KGVsZW1lbnQpID8gVHJlZVZpc2liaWxpdHkuVmlzaWJsZSA6IFRyZWVWaXNpYmlsaXR5LlJlY3Vyc2U7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IG1vZGVsID0gbmV3IEluZGV4VHJlZU1vZGVsPHN0cmluZz4oJ3Rlc3QnLCAncm9vdCcsIHsgZmlsdGVyIH0pO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBiaW5kTGlzdFRvTW9kZWwobGlzdCwgbW9kZWwpO1xuXG5cdFx0bW9kZWwuc3BsaWNlKFswXSwgMCwgW1xuXHRcdFx0e1xuXHRcdFx0XHRlbGVtZW50OiAndnNjb2RlJywgY2hpbGRyZW46IFtcblx0XHRcdFx0XHR7IGVsZW1lbnQ6ICcuYnVpbGQnIH0sXG5cdFx0XHRcdFx0eyBlbGVtZW50OiAnZ2l0JyB9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGVsZW1lbnQ6ICdnaXRodWInLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHR7IGVsZW1lbnQ6ICdjYWxlbmRhci55bWwnIH0sXG5cdFx0XHRcdFx0XHRcdHsgZWxlbWVudDogJ2VuZGdhbWUnIH0sXG5cdFx0XHRcdFx0XHRcdHsgZWxlbWVudDogJ2J1aWxkLmpzJyB9LFxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0ZWxlbWVudDogJ2J1aWxkJywgY2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0eyBlbGVtZW50OiAnbGliJyB9LFxuXHRcdFx0XHRcdFx0XHR7IGVsZW1lbnQ6ICdndWxwZmlsZS5qcycgfVxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fSxcblx0XHRdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdC5sZW5ndGgsIDEwKTtcblxuXHRcdHF1ZXJ5ID0gL2J1aWxkLztcblx0XHRtb2RlbC5yZWZpbHRlcigpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9BcnJheShsaXN0KSwgWyd2c2NvZGUnLCAnLmJ1aWxkJywgJ2dpdGh1YicsICdidWlsZC5qcycsICdidWlsZCddKTtcblxuXHRcdG1vZGVsLnNldENvbGxhcHNlZChbMF0sIHRydWUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9BcnJheShsaXN0KSwgWyd2c2NvZGUnXSk7XG5cblx0XHRtb2RlbC5zZXRDb2xsYXBzZWQoWzBdLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b0FycmF5KGxpc3QpLCBbJ3ZzY29kZScsICcuYnVpbGQnLCAnZ2l0aHViJywgJ2J1aWxkLmpzJywgJ2J1aWxkJ10pO1xuXG5cdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlY3Vyc2l2ZSBmaWx0ZXIgdXBkYXRlcyB3aGVuIGNoaWxkcmVuIGNoYW5nZSAoIzEzMzI3MiknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbGlzdDogSVRyZWVOb2RlPHN0cmluZz5bXSA9IFtdO1xuXHRcdGxldCBxdWVyeSA9ICcnO1xuXHRcdGNvbnN0IGZpbHRlciA9IG5ldyBjbGFzcyBpbXBsZW1lbnRzIElUcmVlRmlsdGVyPHN0cmluZz4ge1xuXHRcdFx0ZmlsdGVyKGVsZW1lbnQ6IHN0cmluZyk6IFRyZWVWaXNpYmlsaXR5IHtcblx0XHRcdFx0cmV0dXJuIGVsZW1lbnQuaW5jbHVkZXMocXVlcnkpID8gVHJlZVZpc2liaWxpdHkuVmlzaWJsZSA6IFRyZWVWaXNpYmlsaXR5LlJlY3Vyc2U7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IG1vZGVsID0gbmV3IEluZGV4VHJlZU1vZGVsPHN0cmluZz4oJ3Rlc3QnLCAncm9vdCcsIHsgZmlsdGVyIH0pO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBiaW5kTGlzdFRvTW9kZWwobGlzdCwgbW9kZWwpO1xuXG5cdFx0bW9kZWwuc3BsaWNlKFswXSwgMCwgW1xuXHRcdFx0e1xuXHRcdFx0XHRlbGVtZW50OiAnYScsXG5cdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0eyBlbGVtZW50OiAnYicgfSxcblx0XHRcdFx0XSxcblx0XHRcdH0sXG5cdFx0XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvQXJyYXkobGlzdCksIFsnYScsICdiJ10pO1xuXHRcdHF1ZXJ5ID0gJ3Zpc2libGUnO1xuXHRcdG1vZGVsLnJlZmlsdGVyKCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b0FycmF5KGxpc3QpLCBbXSk7XG5cblx0XHRtb2RlbC5zcGxpY2UoWzAsIDAsIDBdLCAwLCBbXG5cdFx0XHR7XG5cdFx0XHRcdGVsZW1lbnQ6ICd2aXNpYmxlJywgY2hpbGRyZW46IFtdXG5cdFx0XHR9LFxuXHRcdF0pO1xuXG5cdFx0YXdhaXQgdGltZW91dCgwKTsgLy8gd2FpdCBmb3IgcmVmaWx0ZXIgbWljcm90YXNrXG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvQXJyYXkobGlzdCksIFsnYScsICdiJywgJ3Zpc2libGUnXSk7XG5cblx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgncmVjdXJzaXZlIGZpbHRlciB3aXRoIGNvbGxhcHNlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpc3Q6IElUcmVlTm9kZTxzdHJpbmc+W10gPSBbXTtcblx0XHRsZXQgcXVlcnkgPSBuZXcgUmVnRXhwKCcnKTtcblx0XHRjb25zdCBmaWx0ZXIgPSBuZXcgY2xhc3MgaW1wbGVtZW50cyBJVHJlZUZpbHRlcjxzdHJpbmc+IHtcblx0XHRcdGZpbHRlcihlbGVtZW50OiBzdHJpbmcpOiBUcmVlVmlzaWJpbGl0eSB7XG5cdFx0XHRcdHJldHVybiBxdWVyeS50ZXN0KGVsZW1lbnQpID8gVHJlZVZpc2liaWxpdHkuVmlzaWJsZSA6IFRyZWVWaXNpYmlsaXR5LlJlY3Vyc2U7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IG1vZGVsID0gbmV3IEluZGV4VHJlZU1vZGVsPHN0cmluZz4oJ3Rlc3QnLCAncm9vdCcsIHsgZmlsdGVyIH0pO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBiaW5kTGlzdFRvTW9kZWwobGlzdCwgbW9kZWwpO1xuXG5cdFx0bW9kZWwuc3BsaWNlKFswXSwgMCwgW1xuXHRcdFx0e1xuXHRcdFx0XHRlbGVtZW50OiAndnNjb2RlJywgY2hpbGRyZW46IFtcblx0XHRcdFx0XHR7IGVsZW1lbnQ6ICcuYnVpbGQnIH0sXG5cdFx0XHRcdFx0eyBlbGVtZW50OiAnZ2l0JyB9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGVsZW1lbnQ6ICdnaXRodWInLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHR7IGVsZW1lbnQ6ICdjYWxlbmRhci55bWwnIH0sXG5cdFx0XHRcdFx0XHRcdHsgZWxlbWVudDogJ2VuZGdhbWUnIH0sXG5cdFx0XHRcdFx0XHRcdHsgZWxlbWVudDogJ2J1aWxkLmpzJyB9LFxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0ZWxlbWVudDogJ2J1aWxkJywgY2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0eyBlbGVtZW50OiAnbGliJyB9LFxuXHRcdFx0XHRcdFx0XHR7IGVsZW1lbnQ6ICdndWxwZmlsZS5qcycgfVxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fSxcblx0XHRdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdC5sZW5ndGgsIDEwKTtcblxuXHRcdHF1ZXJ5ID0gL2d1bHAvO1xuXHRcdG1vZGVsLnJlZmlsdGVyKCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b0FycmF5KGxpc3QpLCBbJ3ZzY29kZScsICdidWlsZCcsICdndWxwZmlsZS5qcyddKTtcblxuXHRcdG1vZGVsLnNldENvbGxhcHNlZChbMCwgM10sIHRydWUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9BcnJheShsaXN0KSwgWyd2c2NvZGUnLCAnYnVpbGQnXSk7XG5cblx0XHRtb2RlbC5zZXRDb2xsYXBzZWQoWzBdLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvQXJyYXkobGlzdCksIFsndnNjb2RlJ10pO1xuXG5cdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlY3Vyc2l2ZSBmaWx0ZXIgd2hpbGUgY29sbGFwc2VkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpc3Q6IElUcmVlTm9kZTxzdHJpbmc+W10gPSBbXTtcblx0XHRsZXQgcXVlcnkgPSBuZXcgUmVnRXhwKCcnKTtcblx0XHRjb25zdCBmaWx0ZXIgPSBuZXcgY2xhc3MgaW1wbGVtZW50cyBJVHJlZUZpbHRlcjxzdHJpbmc+IHtcblx0XHRcdGZpbHRlcihlbGVtZW50OiBzdHJpbmcpOiBUcmVlVmlzaWJpbGl0eSB7XG5cdFx0XHRcdHJldHVybiBxdWVyeS50ZXN0KGVsZW1lbnQpID8gVHJlZVZpc2liaWxpdHkuVmlzaWJsZSA6IFRyZWVWaXNpYmlsaXR5LlJlY3Vyc2U7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IG1vZGVsID0gbmV3IEluZGV4VHJlZU1vZGVsPHN0cmluZz4oJ3Rlc3QnLCAncm9vdCcsIHsgZmlsdGVyIH0pO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBiaW5kTGlzdFRvTW9kZWwobGlzdCwgbW9kZWwpO1xuXG5cdFx0bW9kZWwuc3BsaWNlKFswXSwgMCwgW1xuXHRcdFx0e1xuXHRcdFx0XHRlbGVtZW50OiAndnNjb2RlJywgY29sbGFwc2VkOiB0cnVlLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHsgZWxlbWVudDogJy5idWlsZCcgfSxcblx0XHRcdFx0XHR7IGVsZW1lbnQ6ICdnaXQnIH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0ZWxlbWVudDogJ2dpdGh1YicsIGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdHsgZWxlbWVudDogJ2NhbGVuZGFyLnltbCcgfSxcblx0XHRcdFx0XHRcdFx0eyBlbGVtZW50OiAnZW5kZ2FtZScgfSxcblx0XHRcdFx0XHRcdFx0eyBlbGVtZW50OiAnYnVpbGQuanMnIH0sXG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRlbGVtZW50OiAnYnVpbGQnLCBjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHR7IGVsZW1lbnQ6ICdsaWInIH0sXG5cdFx0XHRcdFx0XHRcdHsgZWxlbWVudDogJ2d1bHBmaWxlLmpzJyB9XG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9LFxuXHRcdF0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b0FycmF5KGxpc3QpLCBbJ3ZzY29kZSddKTtcblxuXHRcdHF1ZXJ5ID0gL2d1bHAvO1xuXHRcdG1vZGVsLnJlZmlsdGVyKCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b0FycmF5KGxpc3QpLCBbJ3ZzY29kZSddKTtcblxuXHRcdG1vZGVsLnNldENvbGxhcHNlZChbMF0sIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvQXJyYXkobGlzdCksIFsndnNjb2RlJywgJ2J1aWxkJywgJ2d1bHBmaWxlLmpzJ10pO1xuXG5cdFx0bW9kZWwuc2V0Q29sbGFwc2VkKFswXSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b0FycmF5KGxpc3QpLCBbJ3ZzY29kZSddKTtcblxuXHRcdHF1ZXJ5ID0gbmV3IFJlZ0V4cCgnJyk7XG5cdFx0bW9kZWwucmVmaWx0ZXIoKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvQXJyYXkobGlzdCksIFsndnNjb2RlJ10pO1xuXG5cdFx0bW9kZWwuc2V0Q29sbGFwc2VkKFswXSwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGlzdC5sZW5ndGgsIDEwKTtcblxuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRzdWl0ZSgnZ2V0Tm9kZUxvY2F0aW9uJywgKCkgPT4ge1xuXG5cdFx0dGVzdCgnc2ltcGxlJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbGlzdDogSUluZGV4VHJlZU5vZGU8bnVtYmVyPltdID0gW107XG5cdFx0XHRjb25zdCBtb2RlbCA9IG5ldyBJbmRleFRyZWVNb2RlbDxudW1iZXI+KCd0ZXN0JywgLTEpO1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGJpbmRMaXN0VG9Nb2RlbChsaXN0LCBtb2RlbCk7XG5cblx0XHRcdG1vZGVsLnNwbGljZShbMF0sIDAsIFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGVsZW1lbnQ6IDAsIGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHR7IGVsZW1lbnQ6IDEwIH0sXG5cdFx0XHRcdFx0XHR7IGVsZW1lbnQ6IDExIH0sXG5cdFx0XHRcdFx0XHR7IGVsZW1lbnQ6IDEyIH0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7IGVsZW1lbnQ6IDEgfSxcblx0XHRcdFx0eyBlbGVtZW50OiAyIH1cblx0XHRcdF0pO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldE5vZGVMb2NhdGlvbihsaXN0WzBdKSwgWzBdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0Tm9kZUxvY2F0aW9uKGxpc3RbMV0pLCBbMCwgMF0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXROb2RlTG9jYXRpb24obGlzdFsyXSksIFswLCAxXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldE5vZGVMb2NhdGlvbihsaXN0WzNdKSwgWzAsIDJdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0Tm9kZUxvY2F0aW9uKGxpc3RbNF0pLCBbMV0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXROb2RlTG9jYXRpb24obGlzdFs1XSksIFsyXSk7XG5cblx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnd2l0aCBmaWx0ZXInLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBsaXN0OiBJSW5kZXhUcmVlTm9kZTxudW1iZXI+W10gPSBbXTtcblx0XHRcdGNvbnN0IGZpbHRlciA9IG5ldyBjbGFzcyBpbXBsZW1lbnRzIElUcmVlRmlsdGVyPG51bWJlcj4ge1xuXHRcdFx0XHRmaWx0ZXIoZWxlbWVudDogbnVtYmVyKTogVHJlZVZpc2liaWxpdHkge1xuXHRcdFx0XHRcdHJldHVybiBlbGVtZW50ICUgMiA9PT0gMCA/IFRyZWVWaXNpYmlsaXR5LlZpc2libGUgOiBUcmVlVmlzaWJpbGl0eS5IaWRkZW47XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IG1vZGVsID0gbmV3IEluZGV4VHJlZU1vZGVsPG51bWJlcj4oJ3Rlc3QnLCAtMSwgeyBmaWx0ZXIgfSk7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlID0gYmluZExpc3RUb01vZGVsKGxpc3QsIG1vZGVsKTtcblxuXHRcdFx0bW9kZWwuc3BsaWNlKFswXSwgMCwgW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZWxlbWVudDogMCwgY2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdHsgZWxlbWVudDogMSB9LFxuXHRcdFx0XHRcdFx0eyBlbGVtZW50OiAyIH0sXG5cdFx0XHRcdFx0XHR7IGVsZW1lbnQ6IDMgfSxcblx0XHRcdFx0XHRcdHsgZWxlbWVudDogNCB9LFxuXHRcdFx0XHRcdFx0eyBlbGVtZW50OiA1IH0sXG5cdFx0XHRcdFx0XHR7IGVsZW1lbnQ6IDYgfSxcblx0XHRcdFx0XHRcdHsgZWxlbWVudDogNyB9XG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9XG5cdFx0XHRdKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXROb2RlTG9jYXRpb24obGlzdFswXSksIFswXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldE5vZGVMb2NhdGlvbihsaXN0WzFdKSwgWzAsIDFdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0Tm9kZUxvY2F0aW9uKGxpc3RbMl0pLCBbMCwgM10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXROb2RlTG9jYXRpb24obGlzdFszXSksIFswLCA1XSk7XG5cblx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWZpbHRlciB3aXRoIGZpbHRlcmVkIG91dCBub2RlcycsICgpID0+IHtcblx0XHRjb25zdCBsaXN0OiBJVHJlZU5vZGU8c3RyaW5nPltdID0gW107XG5cdFx0bGV0IHF1ZXJ5ID0gbmV3IFJlZ0V4cCgnJyk7XG5cdFx0Y29uc3QgZmlsdGVyID0gbmV3IGNsYXNzIGltcGxlbWVudHMgSVRyZWVGaWx0ZXI8c3RyaW5nPiB7XG5cdFx0XHRmaWx0ZXIoZWxlbWVudDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0XHRcdHJldHVybiBxdWVyeS50ZXN0KGVsZW1lbnQpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBtb2RlbCA9IG5ldyBJbmRleFRyZWVNb2RlbDxzdHJpbmc+KCd0ZXN0JywgJ3Jvb3QnLCB7IGZpbHRlciB9KTtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gYmluZExpc3RUb01vZGVsKGxpc3QsIG1vZGVsKTtcblxuXHRcdG1vZGVsLnNwbGljZShbMF0sIDAsIFtcblx0XHRcdHsgZWxlbWVudDogJ3NpbHZlcicgfSxcblx0XHRcdHsgZWxlbWVudDogJ2dvbGQnIH0sXG5cdFx0XHR7IGVsZW1lbnQ6ICdwbGF0aW51bScgfVxuXHRcdF0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b0FycmF5KGxpc3QpLCBbJ3NpbHZlcicsICdnb2xkJywgJ3BsYXRpbnVtJ10pO1xuXG5cdFx0cXVlcnkgPSAvcGxhdGludW0vO1xuXHRcdG1vZGVsLnJlZmlsdGVyKCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b0FycmF5KGxpc3QpLCBbJ3BsYXRpbnVtJ10pO1xuXG5cdFx0bW9kZWwuc3BsaWNlKFswXSwgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZLCBbXG5cdFx0XHR7IGVsZW1lbnQ6ICdzaWx2ZXInIH0sXG5cdFx0XHR7IGVsZW1lbnQ6ICdnb2xkJyB9LFxuXHRcdFx0eyBlbGVtZW50OiAncGxhdGludW0nIH1cblx0XHRdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvQXJyYXkobGlzdCksIFsncGxhdGludW0nXSk7XG5cblx0XHRtb2RlbC5yZWZpbHRlcigpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9BcnJheShsaXN0KSwgWydwbGF0aW51bSddKTtcblxuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdleHBsaWNpdCBoaWRkZW4gbm9kZXMgc2hvdWxkIGhhdmUgcmVuZGVyTm9kZUNvdW50ID09IDAsIGlzc3VlICM4MzIxMScsICgpID0+IHtcblx0XHRjb25zdCBsaXN0OiBJVHJlZU5vZGU8c3RyaW5nPltdID0gW107XG5cdFx0bGV0IHF1ZXJ5ID0gbmV3IFJlZ0V4cCgnJyk7XG5cdFx0Y29uc3QgZmlsdGVyID0gbmV3IGNsYXNzIGltcGxlbWVudHMgSVRyZWVGaWx0ZXI8c3RyaW5nPiB7XG5cdFx0XHRmaWx0ZXIoZWxlbWVudDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0XHRcdHJldHVybiBxdWVyeS50ZXN0KGVsZW1lbnQpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBtb2RlbCA9IG5ldyBJbmRleFRyZWVNb2RlbDxzdHJpbmc+KCd0ZXN0JywgJ3Jvb3QnLCB7IGZpbHRlciB9KTtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gYmluZExpc3RUb01vZGVsKGxpc3QsIG1vZGVsKTtcblxuXHRcdG1vZGVsLnNwbGljZShbMF0sIDAsIFtcblx0XHRcdHsgZWxlbWVudDogJ2EnLCBjaGlsZHJlbjogW3sgZWxlbWVudDogJ2FhJyB9XSB9LFxuXHRcdFx0eyBlbGVtZW50OiAnYicsIGNoaWxkcmVuOiBbeyBlbGVtZW50OiAnYmInIH1dIH1cblx0XHRdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9BcnJheShsaXN0KSwgWydhJywgJ2FhJywgJ2InLCAnYmInXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRMaXN0SW5kZXgoWzBdKSwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRMaXN0SW5kZXgoWzAsIDBdKSwgMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRMaXN0SW5kZXgoWzFdKSwgMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRMaXN0SW5kZXgoWzEsIDBdKSwgMyk7XG5cblx0XHRxdWVyeSA9IC9iLztcblx0XHRtb2RlbC5yZWZpbHRlcigpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9BcnJheShsaXN0KSwgWydiJywgJ2JiJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0TGlzdEluZGV4KFswXSksIC0xKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpc3RJbmRleChbMCwgMF0pLCAtMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRMaXN0SW5kZXgoWzFdKSwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRMaXN0SW5kZXgoWzEsIDBdKSwgMSk7XG5cblx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUF1RCxzQkFBc0I7QUFDN0UsU0FBK0Msc0JBQXNCO0FBQ3JFLFNBQVMsZUFBZTtBQUN4QixTQUFTLCtDQUErQztB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
