import assert from "assert";
import { AsyncDataTree, CompressibleAsyncDataTree } from "../../../../browser/ui/tree/asyncDataTree.js";
import { timeout } from "../../../../common/async.js";
import { Iterable } from "../../../../common/iterator.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../common/utils.js";
import { runWithFakedTimers } from "../../../common/timeTravelScheduler.js";
function find(element, id) {
  if (element.id === id) {
    return element;
  }
  if (!element.children) {
    return void 0;
  }
  for (const child of element.children) {
    const result = find(child, id);
    if (result) {
      return result;
    }
  }
  return void 0;
}
class Renderer {
  constructor() {
    this.templateId = "default";
  }
  renderTemplate(container) {
    return container;
  }
  renderElement(element, index, templateData) {
    templateData.textContent = element.element.id + (element.element.suffix || "");
  }
  disposeTemplate(templateData) {
  }
  renderCompressedElements(node, index, templateData, height) {
    const result = [];
    for (const element of node.element.elements) {
      result.push(element.id + (element.suffix || ""));
    }
    templateData.textContent = result.join("/");
  }
}
class IdentityProvider {
  getId(element) {
    return element.id;
  }
}
class VirtualDelegate {
  getHeight() {
    return 20;
  }
  getTemplateId(element) {
    return "default";
  }
}
class DataSource {
  hasChildren(element) {
    return !!element.children && element.children.length > 0;
  }
  getChildren(element) {
    return Promise.resolve(element.children || []);
  }
}
class Model {
  constructor(root) {
    this.root = root;
  }
  get(id) {
    const result = find(this.root, id);
    if (!result) {
      throw new Error("element not found");
    }
    return result;
  }
}
suite("AsyncDataTree", function() {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  test("Collapse state should be preserved across refresh calls", async () => {
    const container = document.createElement("div");
    const model = new Model({
      id: "root",
      children: [{
        id: "a"
      }]
    });
    const tree = store.add(new AsyncDataTree("test", container, new VirtualDelegate(), [new Renderer()], new DataSource(), { identityProvider: new IdentityProvider() }));
    tree.layout(200);
    assert.strictEqual(container.querySelectorAll(".monaco-list-row").length, 0);
    await tree.setInput(model.root);
    assert.strictEqual(container.querySelectorAll(".monaco-list-row").length, 1);
    const twistie = container.querySelector(".monaco-list-row:first-child .monaco-tl-twistie");
    assert(!twistie.classList.contains("collapsible"));
    assert(!twistie.classList.contains("collapsed"));
    model.get("a").children = [
      { id: "aa" },
      { id: "ab" },
      { id: "ac" }
    ];
    await tree.updateChildren(model.root);
    assert.strictEqual(container.querySelectorAll(".monaco-list-row").length, 1);
    await tree.expand(model.get("a"));
    assert.strictEqual(container.querySelectorAll(".monaco-list-row").length, 4);
    model.get("a").children = [];
    await tree.updateChildren(model.root);
    assert.strictEqual(container.querySelectorAll(".monaco-list-row").length, 1);
  });
  test("issue #68648", async () => {
    const container = document.createElement("div");
    const getChildrenCalls = [];
    const dataSource = new class {
      hasChildren(element) {
        return !!element.children && element.children.length > 0;
      }
      getChildren(element) {
        getChildrenCalls.push(element.id);
        return Promise.resolve(element.children || []);
      }
    }();
    const model = new Model({
      id: "root",
      children: [{
        id: "a"
      }]
    });
    const tree = store.add(new AsyncDataTree("test", container, new VirtualDelegate(), [new Renderer()], dataSource, { identityProvider: new IdentityProvider() }));
    tree.layout(200);
    await tree.setInput(model.root);
    assert.deepStrictEqual(getChildrenCalls, ["root"]);
    let twistie = container.querySelector(".monaco-list-row:first-child .monaco-tl-twistie");
    assert(!twistie.classList.contains("collapsible"));
    assert(!twistie.classList.contains("collapsed"));
    assert(tree.getNode().children[0].collapsed);
    model.get("a").children = [{ id: "aa" }, { id: "ab" }, { id: "ac" }];
    await tree.updateChildren(model.root);
    assert.deepStrictEqual(getChildrenCalls, ["root", "root"]);
    twistie = container.querySelector(".monaco-list-row:first-child .monaco-tl-twistie");
    assert(twistie.classList.contains("collapsible"));
    assert(twistie.classList.contains("collapsed"));
    assert(tree.getNode().children[0].collapsed);
    model.get("a").children = [];
    await tree.updateChildren(model.root);
    assert.deepStrictEqual(getChildrenCalls, ["root", "root", "root"]);
    twistie = container.querySelector(".monaco-list-row:first-child .monaco-tl-twistie");
    assert(!twistie.classList.contains("collapsible"));
    assert(!twistie.classList.contains("collapsed"));
    assert(tree.getNode().children[0].collapsed);
    model.get("a").children = [{ id: "aa" }, { id: "ab" }, { id: "ac" }];
    await tree.updateChildren(model.root);
    assert.deepStrictEqual(getChildrenCalls, ["root", "root", "root", "root"]);
    twistie = container.querySelector(".monaco-list-row:first-child .monaco-tl-twistie");
    assert(twistie.classList.contains("collapsible"));
    assert(twistie.classList.contains("collapsed"));
    assert(tree.getNode().children[0].collapsed);
  });
  test("issue #67722 - once resolved, refreshed collapsed nodes should only get children when expanded", async () => {
    const container = document.createElement("div");
    const getChildrenCalls = [];
    const dataSource = new class {
      hasChildren(element) {
        return !!element.children && element.children.length > 0;
      }
      getChildren(element) {
        getChildrenCalls.push(element.id);
        return Promise.resolve(element.children || []);
      }
    }();
    const model = new Model({
      id: "root",
      children: [{
        id: "a",
        children: [{ id: "aa" }, { id: "ab" }, { id: "ac" }]
      }]
    });
    const tree = store.add(new AsyncDataTree("test", container, new VirtualDelegate(), [new Renderer()], dataSource, { identityProvider: new IdentityProvider() }));
    tree.layout(200);
    await tree.setInput(model.root);
    assert(tree.getNode(model.get("a")).collapsed);
    assert.deepStrictEqual(getChildrenCalls, ["root"]);
    await tree.expand(model.get("a"));
    assert(!tree.getNode(model.get("a")).collapsed);
    assert.deepStrictEqual(getChildrenCalls, ["root", "a"]);
    tree.collapse(model.get("a"));
    assert(tree.getNode(model.get("a")).collapsed);
    assert.deepStrictEqual(getChildrenCalls, ["root", "a"]);
    await tree.updateChildren();
    assert(tree.getNode(model.get("a")).collapsed);
    assert.deepStrictEqual(getChildrenCalls, ["root", "a", "root"], "a should not be refreshed, since it' collapsed");
  });
  test("resolved collapsed nodes which lose children should lose twistie as well", async () => {
    const container = document.createElement("div");
    const model = new Model({
      id: "root",
      children: [{
        id: "a",
        children: [{ id: "aa" }, { id: "ab" }, { id: "ac" }]
      }]
    });
    const tree = store.add(new AsyncDataTree("test", container, new VirtualDelegate(), [new Renderer()], new DataSource(), { identityProvider: new IdentityProvider() }));
    tree.layout(200);
    await tree.setInput(model.root);
    await tree.expand(model.get("a"));
    let twistie = container.querySelector(".monaco-list-row:first-child .monaco-tl-twistie");
    assert(twistie.classList.contains("collapsible"));
    assert(!twistie.classList.contains("collapsed"));
    assert(!tree.getNode(model.get("a")).collapsed);
    tree.collapse(model.get("a"));
    model.get("a").children = [];
    await tree.updateChildren(model.root);
    twistie = container.querySelector(".monaco-list-row:first-child .monaco-tl-twistie");
    assert(!twistie.classList.contains("collapsible"));
    assert(!twistie.classList.contains("collapsed"));
    assert(tree.getNode(model.get("a")).collapsed);
  });
  test("issue #192422 - resolved collapsed nodes with changed children don't show old children", async () => {
    const container = document.createElement("div");
    let hasGottenAChildren = false;
    const dataSource = new class {
      hasChildren(element) {
        return !!element.children && element.children.length > 0;
      }
      async getChildren(element) {
        if (element.id === "a") {
          if (!hasGottenAChildren) {
            hasGottenAChildren = true;
          } else {
            return [{ id: "c" }];
          }
        }
        return element.children || [];
      }
    }();
    const model = new Model({
      id: "root",
      children: [{
        id: "a",
        children: [{ id: "b" }]
      }]
    });
    const tree = store.add(new AsyncDataTree("test", container, new VirtualDelegate(), [new Renderer()], dataSource, { identityProvider: new IdentityProvider() }));
    tree.layout(200);
    await tree.setInput(model.root);
    const a = model.get("a");
    const aNode = tree.getNode(a);
    assert(aNode.collapsed);
    await tree.expand(a);
    assert(!aNode.collapsed);
    assert.equal(aNode.children.length, 1);
    assert.equal(aNode.children[0].element.id, "b");
    const bChild = container.querySelector(".monaco-list-row:nth-child(2)");
    assert.equal(bChild?.textContent, "b");
    tree.collapse(a);
    assert(aNode.collapsed);
    await tree.updateChildren(a);
    const aUpdated1 = model.get("a");
    const aNodeUpdated1 = tree.getNode(a);
    assert(aNodeUpdated1.collapsed);
    assert.equal(aNodeUpdated1.children.length, 0);
    let didCheckNoChildren = false;
    const event = tree.onDidChangeCollapseState((e) => {
      const child2 = container.querySelector(".monaco-list-row:nth-child(2)");
      assert.equal(child2, void 0);
      didCheckNoChildren = true;
    });
    await tree.expand(aUpdated1);
    event.dispose();
    assert(didCheckNoChildren);
    const aNodeUpdated2 = tree.getNode(a);
    assert(!aNodeUpdated2.collapsed);
    assert.equal(aNodeUpdated2.children.length, 1);
    assert.equal(aNodeUpdated2.children[0].element.id, "c");
    const child = container.querySelector(".monaco-list-row:nth-child(2)");
    assert.equal(child?.textContent, "c");
  });
  test("issue #192422 - resolved collapsed nodes with unchanged children immediately show children", async () => {
    const container = document.createElement("div");
    const dataSource = new class {
      hasChildren(element) {
        return !!element.children && element.children.length > 0;
      }
      async getChildren(element) {
        return element.children || [];
      }
    }();
    const model = new Model({
      id: "root",
      children: [{
        id: "a",
        children: [{ id: "b" }]
      }]
    });
    const tree = store.add(new AsyncDataTree("test", container, new VirtualDelegate(), [new Renderer()], dataSource, { identityProvider: new IdentityProvider() }));
    tree.layout(200);
    await tree.setInput(model.root);
    const a = model.get("a");
    const aNode = tree.getNode(a);
    assert(aNode.collapsed);
    await tree.expand(a);
    assert(!aNode.collapsed);
    assert.equal(aNode.children.length, 1);
    assert.equal(aNode.children[0].element.id, "b");
    const bChild = container.querySelector(".monaco-list-row:nth-child(2)");
    assert.equal(bChild?.textContent, "b");
    tree.collapse(a);
    assert(aNode.collapsed);
    const aUpdated1 = model.get("a");
    const aNodeUpdated1 = tree.getNode(a);
    assert(aNodeUpdated1.collapsed);
    assert.equal(aNodeUpdated1.children.length, 1);
    let didCheckSameChildren = false;
    const event = tree.onDidChangeCollapseState((e) => {
      const child2 = container.querySelector(".monaco-list-row:nth-child(2)");
      assert.equal(child2?.textContent, "b");
      didCheckSameChildren = true;
    });
    await tree.expand(aUpdated1);
    event.dispose();
    assert(didCheckSameChildren);
    const aNodeUpdated2 = tree.getNode(a);
    assert(!aNodeUpdated2.collapsed);
    assert.equal(aNodeUpdated2.children.length, 1);
    assert.equal(aNodeUpdated2.children[0].element.id, "b");
    const child = container.querySelector(".monaco-list-row:nth-child(2)");
    assert.equal(child?.textContent, "b");
  });
  test("support default collapse state per element", async () => {
    const container = document.createElement("div");
    const getChildrenCalls = [];
    const dataSource = new class {
      hasChildren(element) {
        return !!element.children && element.children.length > 0;
      }
      getChildren(element) {
        getChildrenCalls.push(element.id);
        return Promise.resolve(element.children || []);
      }
    }();
    const model = new Model({
      id: "root",
      children: [{
        id: "a",
        children: [{ id: "aa" }, { id: "ab" }, { id: "ac" }]
      }]
    });
    const tree = store.add(new AsyncDataTree("test", container, new VirtualDelegate(), [new Renderer()], dataSource, {
      collapseByDefault: (el) => el.id !== "a"
    }));
    tree.layout(200);
    await tree.setInput(model.root);
    assert(!tree.getNode(model.get("a")).collapsed);
    assert.deepStrictEqual(getChildrenCalls, ["root", "a"]);
  });
  test("issue #80098 - concurrent refresh and expand", async () => {
    const container = document.createElement("div");
    const calls = [];
    const dataSource = new class {
      hasChildren(element) {
        return !!element.children && element.children.length > 0;
      }
      getChildren(element) {
        return new Promise((c) => calls.push(() => c(element.children || [])));
      }
    }();
    const model = new Model({
      id: "root",
      children: [{
        id: "a",
        children: [{
          id: "aa"
        }]
      }]
    });
    const tree = store.add(new AsyncDataTree("test", container, new VirtualDelegate(), [new Renderer()], dataSource, { identityProvider: new IdentityProvider() }));
    tree.layout(200);
    const pSetInput = tree.setInput(model.root);
    calls.pop()();
    await pSetInput;
    const pUpdateChildrenA = tree.updateChildren(model.get("a"));
    const pExpandA = tree.expand(model.get("a"));
    assert.strictEqual(calls.length, 1, "expand(a) still hasn't called getChildren(a)");
    calls.pop()();
    assert.strictEqual(calls.length, 0, "no pending getChildren calls");
    await pUpdateChildrenA;
    assert.strictEqual(calls.length, 0, "expand(a) should not have forced a second refresh");
    const result = await pExpandA;
    assert.strictEqual(result, true, "expand(a) should be done");
  });
  test("issue #80098 - first expand should call getChildren", async () => {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      const container = document.createElement("div");
      const calls = [];
      const dataSource = new class {
        hasChildren(element) {
          return !!element.children && element.children.length > 0;
        }
        getChildren(element) {
          return new Promise((c) => calls.push(() => c(element.children || [])));
        }
      }();
      const model = new Model({
        id: "root",
        children: [{
          id: "a",
          children: [{
            id: "aa"
          }]
        }]
      });
      const tree = store.add(new AsyncDataTree("test", container, new VirtualDelegate(), [new Renderer()], dataSource, { identityProvider: new IdentityProvider() }));
      tree.layout(200);
      const pSetInput = tree.setInput(model.root);
      calls.pop()();
      await pSetInput;
      const pExpandA = tree.expand(model.get("a"));
      assert.strictEqual(calls.length, 1, "expand(a) should've called getChildren(a)");
      let race = await Promise.race([pExpandA.then(() => "expand"), timeout(1).then(() => "timeout")]);
      assert.strictEqual(race, "timeout", "expand(a) should not be yet done");
      calls.pop()();
      assert.strictEqual(calls.length, 0, "no pending getChildren calls");
      race = await Promise.race([pExpandA.then(() => "expand"), timeout(1).then(() => "timeout")]);
      assert.strictEqual(race, "expand", "expand(a) should now be done");
    });
  });
  test("issue #78388 - tree should react to hasChildren toggles", async () => {
    const container = document.createElement("div");
    const model = new Model({
      id: "root",
      children: [{
        id: "a"
      }]
    });
    const tree = store.add(new AsyncDataTree("test", container, new VirtualDelegate(), [new Renderer()], new DataSource(), { identityProvider: new IdentityProvider() }));
    tree.layout(200);
    await tree.setInput(model.root);
    assert.strictEqual(container.querySelectorAll(".monaco-list-row").length, 1);
    let twistie = container.querySelector(".monaco-list-row:first-child .monaco-tl-twistie");
    assert(!twistie.classList.contains("collapsible"));
    assert(!twistie.classList.contains("collapsed"));
    model.get("a").children = [{ id: "aa" }];
    await tree.updateChildren(model.get("a"), false);
    assert.strictEqual(container.querySelectorAll(".monaco-list-row").length, 1);
    twistie = container.querySelector(".monaco-list-row:first-child .monaco-tl-twistie");
    assert(twistie.classList.contains("collapsible"));
    assert(twistie.classList.contains("collapsed"));
    model.get("a").children = [];
    await tree.updateChildren(model.get("a"), false);
    assert.strictEqual(container.querySelectorAll(".monaco-list-row").length, 1);
    twistie = container.querySelector(".monaco-list-row:first-child .monaco-tl-twistie");
    assert(!twistie.classList.contains("collapsible"));
    assert(!twistie.classList.contains("collapsed"));
  });
  test("issues #84569, #82629 - rerender", async () => {
    const container = document.createElement("div");
    const model = new Model({
      id: "root",
      children: [{
        id: "a",
        children: [{
          id: "b",
          suffix: "1"
        }]
      }]
    });
    const tree = store.add(new AsyncDataTree("test", container, new VirtualDelegate(), [new Renderer()], new DataSource(), { identityProvider: new IdentityProvider() }));
    tree.layout(200);
    await tree.setInput(model.root);
    await tree.expand(model.get("a"));
    assert.deepStrictEqual(Array.from(container.querySelectorAll(".monaco-list-row")).map((e) => e.textContent), ["a", "b1"]);
    const a = model.get("a");
    const b = model.get("b");
    a.children?.splice(0, 1, { id: "b", suffix: "2" });
    await Promise.all([
      tree.updateChildren(a, true, true),
      tree.updateChildren(b, true, true)
    ]);
    assert.deepStrictEqual(Array.from(container.querySelectorAll(".monaco-list-row")).map((e) => e.textContent), ["a", "b2"]);
  });
  test("issue #199264 - dispose during render", async () => {
    const container = document.createElement("div");
    const model1 = new Model({
      id: "root",
      children: [{
        id: "a",
        children: [{ id: "aa" }, { id: "ab" }, { id: "ac" }]
      }]
    });
    const model2 = new Model({
      id: "root",
      children: [{
        id: "a",
        children: [{ id: "aa" }, { id: "ab" }, { id: "ac" }]
      }]
    });
    const tree = store.add(new AsyncDataTree("test", container, new VirtualDelegate(), [new Renderer()], new DataSource(), { identityProvider: new IdentityProvider() }));
    tree.layout(200);
    await tree.setInput(model1.root);
    const input = tree.setInput(model2.root);
    tree.dispose();
    await input;
    assert.strictEqual(container.innerHTML, "");
  });
  test("issue #121567", async () => {
    const container = document.createElement("div");
    const calls = [];
    const dataSource = new class {
      hasChildren(element) {
        return !!element.children && element.children.length > 0;
      }
      async getChildren(element) {
        calls.push(element);
        return element.children ?? Iterable.empty();
      }
    }();
    const model = new Model({
      id: "root",
      children: [{
        id: "a",
        children: [{
          id: "aa"
        }]
      }]
    });
    const a = model.get("a");
    const tree = store.add(new AsyncDataTree("test", container, new VirtualDelegate(), [new Renderer()], dataSource, { identityProvider: new IdentityProvider() }));
    tree.layout(200);
    await tree.setInput(model.root);
    assert.strictEqual(calls.length, 1, "There should be a single getChildren call for the root");
    assert(tree.isCollapsible(a), "a is collapsible");
    assert(tree.isCollapsed(a), "a is collapsed");
    await tree.updateChildren(a, false);
    assert.strictEqual(calls.length, 1, "There should be no changes to the calls list, since a was collapsed");
    assert(tree.isCollapsible(a), "a is collapsible");
    assert(tree.isCollapsed(a), "a is collapsed");
    const children = a.children;
    a.children = [];
    await tree.updateChildren(a, false);
    assert.strictEqual(calls.length, 1, "There should still be no changes to the calls list, since a was collapsed");
    assert(!tree.isCollapsible(a), "a is no longer collapsible");
    assert(tree.isCollapsed(a), "a is collapsed");
    a.children = children;
    await tree.updateChildren(a, false);
    assert.strictEqual(calls.length, 1, "There should still be no changes to the calls list, since a was collapsed");
    assert(tree.isCollapsible(a), "a is collapsible again");
    assert(tree.isCollapsed(a), "a is collapsed");
    await tree.expand(a);
    assert.strictEqual(calls.length, 2, "Finally, there should be a getChildren call for a");
    assert(tree.isCollapsible(a), "a is still collapsible");
    assert(!tree.isCollapsed(a), "a is expanded");
  });
  test("issue #199441", async () => {
    const container = document.createElement("div");
    const dataSource = new class {
      hasChildren(element) {
        return !!element.children && element.children.length > 0;
      }
      async getChildren(element) {
        return element.children ?? Iterable.empty();
      }
    }();
    const compressionDelegate = new class {
      isIncompressible(element) {
        return !dataSource.hasChildren(element);
      }
    }();
    const model = new Model({
      id: "root",
      children: [{
        id: "a",
        children: [{
          id: "b",
          children: [{ id: "b.txt" }]
        }]
      }]
    });
    const collapseByDefault = (element) => false;
    const tree = store.add(new CompressibleAsyncDataTree("test", container, new VirtualDelegate(), compressionDelegate, [new Renderer()], dataSource, { identityProvider: new IdentityProvider(), collapseByDefault }));
    tree.layout(200);
    await tree.setInput(model.root);
    assert.deepStrictEqual(Array.from(container.querySelectorAll(".monaco-list-row")).map((e) => e.textContent), ["a/b", "b.txt"]);
    model.get("a").children.push({
      id: "c",
      children: [{ id: "c.txt" }]
    });
    await tree.updateChildren(model.root, true);
    assert.deepStrictEqual(Array.from(container.querySelectorAll(".monaco-list-row")).map((e) => e.textContent), ["a", "b", "b.txt", "c", "c.txt"]);
  });
  test("Tree Navigation: AsyncDataTree", async () => {
    const container = document.createElement("div");
    const model = new Model({
      id: "root",
      children: [{
        id: "a",
        children: [{
          id: "aa",
          children: [{ id: "aa.txt" }]
        }, {
          id: "ab",
          children: [{ id: "ab.txt" }]
        }]
      }, {
        id: "b",
        children: [{
          id: "ba",
          children: [{ id: "ba.txt" }]
        }, {
          id: "bb",
          children: [{ id: "bb.txt" }]
        }]
      }, {
        id: "c",
        children: [{
          id: "ca",
          children: [{ id: "ca.txt" }]
        }, {
          id: "cb",
          children: [{ id: "cb.txt" }]
        }]
      }]
    });
    const tree = store.add(new AsyncDataTree("test", container, new VirtualDelegate(), [new Renderer()], new DataSource(), { identityProvider: new IdentityProvider() }));
    tree.layout(200);
    await tree.setInput(model.root);
    assert.deepStrictEqual(Array.from(container.querySelectorAll(".monaco-list-row")).map((e) => e.textContent), ["a", "b", "c"]);
    assert.strictEqual(tree.navigate().current(), null);
    assert.strictEqual(tree.navigate().first()?.id, "a");
    assert.strictEqual(tree.navigate().last()?.id, "c");
    assert.strictEqual(tree.navigate(model.get("b")).previous()?.id, "a");
    assert.strictEqual(tree.navigate(model.get("b")).next()?.id, "c");
    await tree.expand(model.get("a"));
    await tree.expand(model.get("aa"));
    await tree.expand(model.get("ab"));
    await tree.expand(model.get("b"));
    await tree.expand(model.get("ba"));
    await tree.expand(model.get("bb"));
    await tree.expand(model.get("c"));
    await tree.expand(model.get("ca"));
    await tree.expand(model.get("cb"));
    assert.deepStrictEqual(Array.from(container.querySelectorAll(".monaco-list-row")).map((e) => e.textContent), ["a", "aa", "aa.txt", "ab", "ab.txt", "b", "ba", "ba.txt", "bb", "bb.txt"]);
    assert.strictEqual(tree.navigate().first()?.id, "a");
    assert.strictEqual(tree.navigate().last()?.id, "cb.txt");
    assert.strictEqual(tree.navigate(model.get("b")).previous()?.id, "ab.txt");
    assert.strictEqual(tree.navigate(model.get("b")).next()?.id, "ba");
    assert.strictEqual(tree.navigate(model.get("ab.txt")).previous()?.id, "ab");
    assert.strictEqual(tree.navigate(model.get("ab.txt")).next()?.id, "b");
    assert.strictEqual(tree.navigate(model.get("bb.txt")).next()?.id, "c");
    tree.collapse(model.get("b"), false);
    assert.deepStrictEqual(Array.from(container.querySelectorAll(".monaco-list-row")).map((e) => e.textContent), ["a", "aa", "aa.txt", "ab", "ab.txt", "b", "c", "ca", "ca.txt", "cb"]);
    assert.strictEqual(tree.navigate(model.get("b")).next()?.id, "c");
  });
  test("Test Navigation: CompressibleAsyncDataTree", async () => {
    const container = document.createElement("div");
    const dataSource = new class {
      hasChildren(element) {
        return !!element.children && element.children.length > 0;
      }
      async getChildren(element) {
        return element.children ?? Iterable.empty();
      }
    }();
    const compressionDelegate = new class {
      isIncompressible(element) {
        return !dataSource.hasChildren(element);
      }
    }();
    const model = new Model({
      id: "root",
      children: [
        {
          id: "a",
          children: [{ id: "aa", children: [{ id: "aa.txt" }] }]
        },
        {
          id: "b",
          children: [{ id: "ba", children: [{ id: "ba.txt" }] }]
        },
        {
          id: "c",
          children: [{
            id: "ca",
            children: [{ id: "ca.txt" }]
          }, {
            id: "cb",
            children: [{ id: "cb.txt" }]
          }]
        }
      ]
    });
    const tree = store.add(new CompressibleAsyncDataTree("test", container, new VirtualDelegate(), compressionDelegate, [new Renderer()], dataSource, { identityProvider: new IdentityProvider() }));
    tree.layout(200);
    await tree.setInput(model.root);
    assert.deepStrictEqual(Array.from(container.querySelectorAll(".monaco-list-row")).map((e) => e.textContent), ["a", "b", "c"]);
    assert.strictEqual(tree.navigate().current(), null);
    assert.strictEqual(tree.navigate().first()?.id, "a");
    assert.strictEqual(tree.navigate().last()?.id, "c");
    assert.strictEqual(tree.navigate(model.get("b")).previous()?.id, "a");
    assert.strictEqual(tree.navigate(model.get("b")).next()?.id, "c");
    await tree.expand(model.get("a"));
    await tree.expand(model.get("aa"));
    await tree.expand(model.get("b"));
    await tree.expand(model.get("ba"));
    await tree.expand(model.get("c"));
    await tree.expand(model.get("ca"));
    await tree.expand(model.get("cb"));
    assert.deepStrictEqual(Array.from(container.querySelectorAll(".monaco-list-row")).map((e) => e.textContent), ["a/aa", "aa.txt", "b/ba", "ba.txt", "c", "ca", "ca.txt", "cb", "cb.txt"]);
    assert.strictEqual(tree.navigate().first()?.id, "aa");
    assert.strictEqual(tree.navigate().last()?.id, "cb.txt");
    assert.strictEqual(tree.navigate(model.get("b")).previous()?.id, "aa.txt");
    assert.strictEqual(tree.navigate(model.get("ba")).previous()?.id, "aa.txt");
    assert.strictEqual(tree.navigate(model.get("b")).next()?.id, "ba.txt");
    assert.strictEqual(tree.navigate(model.get("ba")).next()?.id, "ba.txt");
    assert.strictEqual(tree.navigate(model.get("aa.txt")).previous()?.id, "aa");
    assert.strictEqual(tree.navigate(model.get("aa.txt")).next()?.id, "ba");
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvYnJvd3Nlci91aS90cmVlL2FzeW5jRGF0YVRyZWUudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IElJZGVudGl0eVByb3ZpZGVyLCBJTGlzdFZpcnR1YWxEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvdWkvbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IEFzeW5jRGF0YVRyZWUsIENvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWUsIElUcmVlQ29tcHJlc3Npb25EZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvdWkvdHJlZS9hc3luY0RhdGFUcmVlLmpzJztcbmltcG9ydCB7IElDb21wcmVzc2VkVHJlZU5vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL3VpL3RyZWUvY29tcHJlc3NlZE9iamVjdFRyZWVNb2RlbC5qcyc7XG5pbXBvcnQgeyBJQ29tcHJlc3NpYmxlVHJlZVJlbmRlcmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci91aS90cmVlL29iamVjdFRyZWUuanMnO1xuaW1wb3J0IHsgSUFzeW5jRGF0YVNvdXJjZSwgSVRyZWVOb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci91aS90cmVlL3RyZWUuanMnO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBJdGVyYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgcnVuV2l0aEZha2VkVGltZXJzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RpbWVUcmF2ZWxTY2hlZHVsZXIuanMnO1xuXG5pbnRlcmZhY2UgRWxlbWVudCB7XG5cdGlkOiBzdHJpbmc7XG5cdHN1ZmZpeD86IHN0cmluZztcblx0Y2hpbGRyZW4/OiBFbGVtZW50W107XG59XG5cbmZ1bmN0aW9uIGZpbmQoZWxlbWVudDogRWxlbWVudCwgaWQ6IHN0cmluZyk6IEVsZW1lbnQgfCB1bmRlZmluZWQge1xuXHRpZiAoZWxlbWVudC5pZCA9PT0gaWQpIHtcblx0XHRyZXR1cm4gZWxlbWVudDtcblx0fVxuXG5cdGlmICghZWxlbWVudC5jaGlsZHJlbikge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRmb3IgKGNvbnN0IGNoaWxkIG9mIGVsZW1lbnQuY2hpbGRyZW4pIHtcblx0XHRjb25zdCByZXN1bHQgPSBmaW5kKGNoaWxkLCBpZCk7XG5cblx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmNsYXNzIFJlbmRlcmVyIGltcGxlbWVudHMgSUNvbXByZXNzaWJsZVRyZWVSZW5kZXJlcjxFbGVtZW50LCB2b2lkLCBIVE1MRWxlbWVudD4ge1xuXHRyZWFkb25seSB0ZW1wbGF0ZUlkID0gJ2RlZmF1bHQnO1xuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiBjb250YWluZXI7XG5cdH1cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBJVHJlZU5vZGU8RWxlbWVudCwgdm9pZD4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEudGV4dENvbnRlbnQgPSBlbGVtZW50LmVsZW1lbnQuaWQgKyAoZWxlbWVudC5lbGVtZW50LnN1ZmZpeCB8fCAnJyk7XG5cdH1cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHQvLyBub29wXG5cdH1cblx0cmVuZGVyQ29tcHJlc3NlZEVsZW1lbnRzKG5vZGU6IElUcmVlTm9kZTxJQ29tcHJlc3NlZFRyZWVOb2RlPEVsZW1lbnQ+LCB2b2lkPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBIVE1MRWxlbWVudCwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCByZXN1bHQ6IHN0cmluZ1tdID0gW107XG5cblx0XHRmb3IgKGNvbnN0IGVsZW1lbnQgb2Ygbm9kZS5lbGVtZW50LmVsZW1lbnRzKSB7XG5cdFx0XHRyZXN1bHQucHVzaChlbGVtZW50LmlkICsgKGVsZW1lbnQuc3VmZml4IHx8ICcnKSk7XG5cdFx0fVxuXG5cdFx0dGVtcGxhdGVEYXRhLnRleHRDb250ZW50ID0gcmVzdWx0LmpvaW4oJy8nKTtcblx0fVxufVxuXG5jbGFzcyBJZGVudGl0eVByb3ZpZGVyIGltcGxlbWVudHMgSUlkZW50aXR5UHJvdmlkZXI8RWxlbWVudD4ge1xuXHRnZXRJZChlbGVtZW50OiBFbGVtZW50KSB7XG5cdFx0cmV0dXJuIGVsZW1lbnQuaWQ7XG5cdH1cbn1cblxuY2xhc3MgVmlydHVhbERlbGVnYXRlIGltcGxlbWVudHMgSUxpc3RWaXJ0dWFsRGVsZWdhdGU8RWxlbWVudD4ge1xuXHRnZXRIZWlnaHQoKSB7IHJldHVybiAyMDsgfVxuXHRnZXRUZW1wbGF0ZUlkKGVsZW1lbnQ6IEVsZW1lbnQpOiBzdHJpbmcgeyByZXR1cm4gJ2RlZmF1bHQnOyB9XG59XG5cbmNsYXNzIERhdGFTb3VyY2UgaW1wbGVtZW50cyBJQXN5bmNEYXRhU291cmNlPEVsZW1lbnQsIEVsZW1lbnQ+IHtcblx0aGFzQ2hpbGRyZW4oZWxlbWVudDogRWxlbWVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIWVsZW1lbnQuY2hpbGRyZW4gJiYgZWxlbWVudC5jaGlsZHJlbi5sZW5ndGggPiAwO1xuXHR9XG5cdGdldENoaWxkcmVuKGVsZW1lbnQ6IEVsZW1lbnQpOiBQcm9taXNlPEVsZW1lbnRbXT4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoZWxlbWVudC5jaGlsZHJlbiB8fCBbXSk7XG5cdH1cbn1cblxuY2xhc3MgTW9kZWwge1xuXG5cdGNvbnN0cnVjdG9yKHJlYWRvbmx5IHJvb3Q6IEVsZW1lbnQpIHsgfVxuXG5cdGdldChpZDogc3RyaW5nKTogRWxlbWVudCB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gZmluZCh0aGlzLnJvb3QsIGlkKTtcblxuXHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2VsZW1lbnQgbm90IGZvdW5kJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG5zdWl0ZSgnQXN5bmNEYXRhVHJlZScsIGZ1bmN0aW9uICgpIHtcblxuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ0NvbGxhcHNlIHN0YXRlIHNob3VsZCBiZSBwcmVzZXJ2ZWQgYWNyb3NzIHJlZnJlc2ggY2FsbHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cblx0XHRjb25zdCBtb2RlbCA9IG5ldyBNb2RlbCh7XG5cdFx0XHRpZDogJ3Jvb3QnLFxuXHRcdFx0Y2hpbGRyZW46IFt7XG5cdFx0XHRcdGlkOiAnYSdcblx0XHRcdH1dXG5cdFx0fSk7XG5cblx0XHRjb25zdCB0cmVlID0gc3RvcmUuYWRkKG5ldyBBc3luY0RhdGFUcmVlPEVsZW1lbnQsIEVsZW1lbnQ+KCd0ZXN0JywgY29udGFpbmVyLCBuZXcgVmlydHVhbERlbGVnYXRlKCksIFtuZXcgUmVuZGVyZXIoKV0sIG5ldyBEYXRhU291cmNlKCksIHsgaWRlbnRpdHlQcm92aWRlcjogbmV3IElkZW50aXR5UHJvdmlkZXIoKSB9KSk7XG5cdFx0dHJlZS5sYXlvdXQoMjAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5tb25hY28tbGlzdC1yb3cnKS5sZW5ndGgsIDApO1xuXG5cdFx0YXdhaXQgdHJlZS5zZXRJbnB1dChtb2RlbC5yb290KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5tb25hY28tbGlzdC1yb3cnKS5sZW5ndGgsIDEpO1xuXHRcdGNvbnN0IHR3aXN0aWUgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcignLm1vbmFjby1saXN0LXJvdzpmaXJzdC1jaGlsZCAubW9uYWNvLXRsLXR3aXN0aWUnKSBhcyBIVE1MRWxlbWVudDtcblx0XHRhc3NlcnQoIXR3aXN0aWUuY2xhc3NMaXN0LmNvbnRhaW5zKCdjb2xsYXBzaWJsZScpKTtcblx0XHRhc3NlcnQoIXR3aXN0aWUuY2xhc3NMaXN0LmNvbnRhaW5zKCdjb2xsYXBzZWQnKSk7XG5cblx0XHRtb2RlbC5nZXQoJ2EnKS5jaGlsZHJlbiA9IFtcblx0XHRcdHsgaWQ6ICdhYScgfSxcblx0XHRcdHsgaWQ6ICdhYicgfSxcblx0XHRcdHsgaWQ6ICdhYycgfVxuXHRcdF07XG5cblx0XHRhd2FpdCB0cmVlLnVwZGF0ZUNoaWxkcmVuKG1vZGVsLnJvb3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250YWluZXIucXVlcnlTZWxlY3RvckFsbCgnLm1vbmFjby1saXN0LXJvdycpLmxlbmd0aCwgMSk7XG5cblx0XHRhd2FpdCB0cmVlLmV4cGFuZChtb2RlbC5nZXQoJ2EnKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCcubW9uYWNvLWxpc3Qtcm93JykubGVuZ3RoLCA0KTtcblxuXHRcdG1vZGVsLmdldCgnYScpLmNoaWxkcmVuID0gW107XG5cdFx0YXdhaXQgdHJlZS51cGRhdGVDaGlsZHJlbihtb2RlbC5yb290KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5tb25hY28tbGlzdC1yb3cnKS5sZW5ndGgsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNjg2NDgnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cblx0XHRjb25zdCBnZXRDaGlsZHJlbkNhbGxzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IGRhdGFTb3VyY2UgPSBuZXcgY2xhc3MgaW1wbGVtZW50cyBJQXN5bmNEYXRhU291cmNlPEVsZW1lbnQsIEVsZW1lbnQ+IHtcblx0XHRcdGhhc0NoaWxkcmVuKGVsZW1lbnQ6IEVsZW1lbnQpOiBib29sZWFuIHtcblx0XHRcdFx0cmV0dXJuICEhZWxlbWVudC5jaGlsZHJlbiAmJiBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA+IDA7XG5cdFx0XHR9XG5cdFx0XHRnZXRDaGlsZHJlbihlbGVtZW50OiBFbGVtZW50KTogUHJvbWlzZTxFbGVtZW50W10+IHtcblx0XHRcdFx0Z2V0Q2hpbGRyZW5DYWxscy5wdXNoKGVsZW1lbnQuaWQpO1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGVsZW1lbnQuY2hpbGRyZW4gfHwgW10pO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBtb2RlbCA9IG5ldyBNb2RlbCh7XG5cdFx0XHRpZDogJ3Jvb3QnLFxuXHRcdFx0Y2hpbGRyZW46IFt7XG5cdFx0XHRcdGlkOiAnYSdcblx0XHRcdH1dXG5cdFx0fSk7XG5cblx0XHRjb25zdCB0cmVlID0gc3RvcmUuYWRkKG5ldyBBc3luY0RhdGFUcmVlPEVsZW1lbnQsIEVsZW1lbnQ+KCd0ZXN0JywgY29udGFpbmVyLCBuZXcgVmlydHVhbERlbGVnYXRlKCksIFtuZXcgUmVuZGVyZXIoKV0sIGRhdGFTb3VyY2UsIHsgaWRlbnRpdHlQcm92aWRlcjogbmV3IElkZW50aXR5UHJvdmlkZXIoKSB9KSk7XG5cdFx0dHJlZS5sYXlvdXQoMjAwKTtcblxuXHRcdGF3YWl0IHRyZWUuc2V0SW5wdXQobW9kZWwucm9vdCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRDaGlsZHJlbkNhbGxzLCBbJ3Jvb3QnXSk7XG5cblx0XHRsZXQgdHdpc3RpZSA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCcubW9uYWNvLWxpc3Qtcm93OmZpcnN0LWNoaWxkIC5tb25hY28tdGwtdHdpc3RpZScpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGFzc2VydCghdHdpc3RpZS5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbGxhcHNpYmxlJykpO1xuXHRcdGFzc2VydCghdHdpc3RpZS5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbGxhcHNlZCcpKTtcblx0XHRhc3NlcnQodHJlZS5nZXROb2RlKCkuY2hpbGRyZW5bMF0uY29sbGFwc2VkKTtcblxuXHRcdG1vZGVsLmdldCgnYScpLmNoaWxkcmVuID0gW3sgaWQ6ICdhYScgfSwgeyBpZDogJ2FiJyB9LCB7IGlkOiAnYWMnIH1dO1xuXHRcdGF3YWl0IHRyZWUudXBkYXRlQ2hpbGRyZW4obW9kZWwucm9vdCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldENoaWxkcmVuQ2FsbHMsIFsncm9vdCcsICdyb290J10pO1xuXHRcdHR3aXN0aWUgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcignLm1vbmFjby1saXN0LXJvdzpmaXJzdC1jaGlsZCAubW9uYWNvLXRsLXR3aXN0aWUnKSBhcyBIVE1MRWxlbWVudDtcblx0XHRhc3NlcnQodHdpc3RpZS5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbGxhcHNpYmxlJykpO1xuXHRcdGFzc2VydCh0d2lzdGllLmNsYXNzTGlzdC5jb250YWlucygnY29sbGFwc2VkJykpO1xuXHRcdGFzc2VydCh0cmVlLmdldE5vZGUoKS5jaGlsZHJlblswXS5jb2xsYXBzZWQpO1xuXG5cdFx0bW9kZWwuZ2V0KCdhJykuY2hpbGRyZW4gPSBbXTtcblx0XHRhd2FpdCB0cmVlLnVwZGF0ZUNoaWxkcmVuKG1vZGVsLnJvb3QpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRDaGlsZHJlbkNhbGxzLCBbJ3Jvb3QnLCAncm9vdCcsICdyb290J10pO1xuXHRcdHR3aXN0aWUgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcignLm1vbmFjby1saXN0LXJvdzpmaXJzdC1jaGlsZCAubW9uYWNvLXRsLXR3aXN0aWUnKSBhcyBIVE1MRWxlbWVudDtcblx0XHRhc3NlcnQoIXR3aXN0aWUuY2xhc3NMaXN0LmNvbnRhaW5zKCdjb2xsYXBzaWJsZScpKTtcblx0XHRhc3NlcnQoIXR3aXN0aWUuY2xhc3NMaXN0LmNvbnRhaW5zKCdjb2xsYXBzZWQnKSk7XG5cdFx0YXNzZXJ0KHRyZWUuZ2V0Tm9kZSgpLmNoaWxkcmVuWzBdLmNvbGxhcHNlZCk7XG5cblx0XHRtb2RlbC5nZXQoJ2EnKS5jaGlsZHJlbiA9IFt7IGlkOiAnYWEnIH0sIHsgaWQ6ICdhYicgfSwgeyBpZDogJ2FjJyB9XTtcblx0XHRhd2FpdCB0cmVlLnVwZGF0ZUNoaWxkcmVuKG1vZGVsLnJvb3QpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRDaGlsZHJlbkNhbGxzLCBbJ3Jvb3QnLCAncm9vdCcsICdyb290JywgJ3Jvb3QnXSk7XG5cdFx0dHdpc3RpZSA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCcubW9uYWNvLWxpc3Qtcm93OmZpcnN0LWNoaWxkIC5tb25hY28tdGwtdHdpc3RpZScpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGFzc2VydCh0d2lzdGllLmNsYXNzTGlzdC5jb250YWlucygnY29sbGFwc2libGUnKSk7XG5cdFx0YXNzZXJ0KHR3aXN0aWUuY2xhc3NMaXN0LmNvbnRhaW5zKCdjb2xsYXBzZWQnKSk7XG5cdFx0YXNzZXJ0KHRyZWUuZ2V0Tm9kZSgpLmNoaWxkcmVuWzBdLmNvbGxhcHNlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM2NzcyMiAtIG9uY2UgcmVzb2x2ZWQsIHJlZnJlc2hlZCBjb2xsYXBzZWQgbm9kZXMgc2hvdWxkIG9ubHkgZ2V0IGNoaWxkcmVuIHdoZW4gZXhwYW5kZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cblx0XHRjb25zdCBnZXRDaGlsZHJlbkNhbGxzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IGRhdGFTb3VyY2UgPSBuZXcgY2xhc3MgaW1wbGVtZW50cyBJQXN5bmNEYXRhU291cmNlPEVsZW1lbnQsIEVsZW1lbnQ+IHtcblx0XHRcdGhhc0NoaWxkcmVuKGVsZW1lbnQ6IEVsZW1lbnQpOiBib29sZWFuIHtcblx0XHRcdFx0cmV0dXJuICEhZWxlbWVudC5jaGlsZHJlbiAmJiBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA+IDA7XG5cdFx0XHR9XG5cdFx0XHRnZXRDaGlsZHJlbihlbGVtZW50OiBFbGVtZW50KTogUHJvbWlzZTxFbGVtZW50W10+IHtcblx0XHRcdFx0Z2V0Q2hpbGRyZW5DYWxscy5wdXNoKGVsZW1lbnQuaWQpO1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGVsZW1lbnQuY2hpbGRyZW4gfHwgW10pO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBtb2RlbCA9IG5ldyBNb2RlbCh7XG5cdFx0XHRpZDogJ3Jvb3QnLFxuXHRcdFx0Y2hpbGRyZW46IFt7XG5cdFx0XHRcdGlkOiAnYScsIGNoaWxkcmVuOiBbeyBpZDogJ2FhJyB9LCB7IGlkOiAnYWInIH0sIHsgaWQ6ICdhYycgfV1cblx0XHRcdH1dXG5cdFx0fSk7XG5cblx0XHRjb25zdCB0cmVlID0gc3RvcmUuYWRkKG5ldyBBc3luY0RhdGFUcmVlPEVsZW1lbnQsIEVsZW1lbnQ+KCd0ZXN0JywgY29udGFpbmVyLCBuZXcgVmlydHVhbERlbGVnYXRlKCksIFtuZXcgUmVuZGVyZXIoKV0sIGRhdGFTb3VyY2UsIHsgaWRlbnRpdHlQcm92aWRlcjogbmV3IElkZW50aXR5UHJvdmlkZXIoKSB9KSk7XG5cdFx0dHJlZS5sYXlvdXQoMjAwKTtcblxuXHRcdGF3YWl0IHRyZWUuc2V0SW5wdXQobW9kZWwucm9vdCk7XG5cdFx0YXNzZXJ0KHRyZWUuZ2V0Tm9kZShtb2RlbC5nZXQoJ2EnKSkuY29sbGFwc2VkKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldENoaWxkcmVuQ2FsbHMsIFsncm9vdCddKTtcblxuXHRcdGF3YWl0IHRyZWUuZXhwYW5kKG1vZGVsLmdldCgnYScpKTtcblx0XHRhc3NlcnQoIXRyZWUuZ2V0Tm9kZShtb2RlbC5nZXQoJ2EnKSkuY29sbGFwc2VkKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldENoaWxkcmVuQ2FsbHMsIFsncm9vdCcsICdhJ10pO1xuXG5cdFx0dHJlZS5jb2xsYXBzZShtb2RlbC5nZXQoJ2EnKSk7XG5cdFx0YXNzZXJ0KHRyZWUuZ2V0Tm9kZShtb2RlbC5nZXQoJ2EnKSkuY29sbGFwc2VkKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldENoaWxkcmVuQ2FsbHMsIFsncm9vdCcsICdhJ10pO1xuXG5cdFx0YXdhaXQgdHJlZS51cGRhdGVDaGlsZHJlbigpO1xuXHRcdGFzc2VydCh0cmVlLmdldE5vZGUobW9kZWwuZ2V0KCdhJykpLmNvbGxhcHNlZCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRDaGlsZHJlbkNhbGxzLCBbJ3Jvb3QnLCAnYScsICdyb290J10sICdhIHNob3VsZCBub3QgYmUgcmVmcmVzaGVkLCBzaW5jZSBpdFxcJyBjb2xsYXBzZWQnKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZWQgY29sbGFwc2VkIG5vZGVzIHdoaWNoIGxvc2UgY2hpbGRyZW4gc2hvdWxkIGxvc2UgdHdpc3RpZSBhcyB3ZWxsJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBuZXcgTW9kZWwoe1xuXHRcdFx0aWQ6ICdyb290Jyxcblx0XHRcdGNoaWxkcmVuOiBbe1xuXHRcdFx0XHRpZDogJ2EnLCBjaGlsZHJlbjogW3sgaWQ6ICdhYScgfSwgeyBpZDogJ2FiJyB9LCB7IGlkOiAnYWMnIH1dXG5cdFx0XHR9XVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdHJlZSA9IHN0b3JlLmFkZChuZXcgQXN5bmNEYXRhVHJlZTxFbGVtZW50LCBFbGVtZW50PigndGVzdCcsIGNvbnRhaW5lciwgbmV3IFZpcnR1YWxEZWxlZ2F0ZSgpLCBbbmV3IFJlbmRlcmVyKCldLCBuZXcgRGF0YVNvdXJjZSgpLCB7IGlkZW50aXR5UHJvdmlkZXI6IG5ldyBJZGVudGl0eVByb3ZpZGVyKCkgfSkpO1xuXHRcdHRyZWUubGF5b3V0KDIwMCk7XG5cblx0XHRhd2FpdCB0cmVlLnNldElucHV0KG1vZGVsLnJvb3QpO1xuXHRcdGF3YWl0IHRyZWUuZXhwYW5kKG1vZGVsLmdldCgnYScpKTtcblxuXHRcdGxldCB0d2lzdGllID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJy5tb25hY28tbGlzdC1yb3c6Zmlyc3QtY2hpbGQgLm1vbmFjby10bC10d2lzdGllJykgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0YXNzZXJ0KHR3aXN0aWUuY2xhc3NMaXN0LmNvbnRhaW5zKCdjb2xsYXBzaWJsZScpKTtcblx0XHRhc3NlcnQoIXR3aXN0aWUuY2xhc3NMaXN0LmNvbnRhaW5zKCdjb2xsYXBzZWQnKSk7XG5cdFx0YXNzZXJ0KCF0cmVlLmdldE5vZGUobW9kZWwuZ2V0KCdhJykpLmNvbGxhcHNlZCk7XG5cblx0XHR0cmVlLmNvbGxhcHNlKG1vZGVsLmdldCgnYScpKTtcblx0XHRtb2RlbC5nZXQoJ2EnKS5jaGlsZHJlbiA9IFtdO1xuXHRcdGF3YWl0IHRyZWUudXBkYXRlQ2hpbGRyZW4obW9kZWwucm9vdCk7XG5cblx0XHR0d2lzdGllID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJy5tb25hY28tbGlzdC1yb3c6Zmlyc3QtY2hpbGQgLm1vbmFjby10bC10d2lzdGllJykgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0YXNzZXJ0KCF0d2lzdGllLmNsYXNzTGlzdC5jb250YWlucygnY29sbGFwc2libGUnKSk7XG5cdFx0YXNzZXJ0KCF0d2lzdGllLmNsYXNzTGlzdC5jb250YWlucygnY29sbGFwc2VkJykpO1xuXHRcdGFzc2VydCh0cmVlLmdldE5vZGUobW9kZWwuZ2V0KCdhJykpLmNvbGxhcHNlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxOTI0MjIgLSByZXNvbHZlZCBjb2xsYXBzZWQgbm9kZXMgd2l0aCBjaGFuZ2VkIGNoaWxkcmVuIGRvblxcJ3Qgc2hvdyBvbGQgY2hpbGRyZW4nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0bGV0IGhhc0dvdHRlbkFDaGlsZHJlbiA9IGZhbHNlO1xuXHRcdGNvbnN0IGRhdGFTb3VyY2UgPSBuZXcgY2xhc3MgaW1wbGVtZW50cyBJQXN5bmNEYXRhU291cmNlPEVsZW1lbnQsIEVsZW1lbnQ+IHtcblx0XHRcdGhhc0NoaWxkcmVuKGVsZW1lbnQ6IEVsZW1lbnQpOiBib29sZWFuIHtcblx0XHRcdFx0cmV0dXJuICEhZWxlbWVudC5jaGlsZHJlbiAmJiBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA+IDA7XG5cdFx0XHR9XG5cdFx0XHRhc3luYyBnZXRDaGlsZHJlbihlbGVtZW50OiBFbGVtZW50KTogUHJvbWlzZTxFbGVtZW50W10+IHtcblx0XHRcdFx0aWYgKGVsZW1lbnQuaWQgPT09ICdhJykge1xuXHRcdFx0XHRcdGlmICghaGFzR290dGVuQUNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0XHRoYXNHb3R0ZW5BQ2hpbGRyZW4gPSB0cnVlO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gW3sgaWQ6ICdjJyB9XTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGVsZW1lbnQuY2hpbGRyZW4gfHwgW107XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IG1vZGVsID0gbmV3IE1vZGVsKHtcblx0XHRcdGlkOiAncm9vdCcsXG5cdFx0XHRjaGlsZHJlbjogW3tcblx0XHRcdFx0aWQ6ICdhJywgY2hpbGRyZW46IFt7IGlkOiAnYicgfV1cblx0XHRcdH1dXG5cdFx0fSk7XG5cblx0XHRjb25zdCB0cmVlID0gc3RvcmUuYWRkKG5ldyBBc3luY0RhdGFUcmVlPEVsZW1lbnQsIEVsZW1lbnQ+KCd0ZXN0JywgY29udGFpbmVyLCBuZXcgVmlydHVhbERlbGVnYXRlKCksIFtuZXcgUmVuZGVyZXIoKV0sIGRhdGFTb3VyY2UsIHsgaWRlbnRpdHlQcm92aWRlcjogbmV3IElkZW50aXR5UHJvdmlkZXIoKSB9KSk7XG5cdFx0dHJlZS5sYXlvdXQoMjAwKTtcblxuXHRcdGF3YWl0IHRyZWUuc2V0SW5wdXQobW9kZWwucm9vdCk7XG5cdFx0Y29uc3QgYSA9IG1vZGVsLmdldCgnYScpO1xuXHRcdGNvbnN0IGFOb2RlID0gdHJlZS5nZXROb2RlKGEpO1xuXHRcdGFzc2VydChhTm9kZS5jb2xsYXBzZWQpO1xuXHRcdGF3YWl0IHRyZWUuZXhwYW5kKGEpO1xuXHRcdGFzc2VydCghYU5vZGUuY29sbGFwc2VkKTtcblx0XHRhc3NlcnQuZXF1YWwoYU5vZGUuY2hpbGRyZW4ubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuZXF1YWwoYU5vZGUuY2hpbGRyZW5bMF0uZWxlbWVudC5pZCwgJ2InKTtcblx0XHRjb25zdCBiQ2hpbGQgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcignLm1vbmFjby1saXN0LXJvdzpudGgtY2hpbGQoMiknKSBhcyBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0XHRhc3NlcnQuZXF1YWwoYkNoaWxkPy50ZXh0Q29udGVudCwgJ2InKTtcblx0XHR0cmVlLmNvbGxhcHNlKGEpO1xuXHRcdGFzc2VydChhTm9kZS5jb2xsYXBzZWQpO1xuXG5cdFx0YXdhaXQgdHJlZS51cGRhdGVDaGlsZHJlbihhKTtcblx0XHRjb25zdCBhVXBkYXRlZDEgPSBtb2RlbC5nZXQoJ2EnKTtcblx0XHRjb25zdCBhTm9kZVVwZGF0ZWQxID0gdHJlZS5nZXROb2RlKGEpO1xuXHRcdGFzc2VydChhTm9kZVVwZGF0ZWQxLmNvbGxhcHNlZCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGFOb2RlVXBkYXRlZDEuY2hpbGRyZW4ubGVuZ3RoLCAwKTtcblx0XHRsZXQgZGlkQ2hlY2tOb0NoaWxkcmVuID0gZmFsc2U7XG5cdFx0Y29uc3QgZXZlbnQgPSB0cmVlLm9uRGlkQ2hhbmdlQ29sbGFwc2VTdGF0ZShlID0+IHtcblx0XHRcdGNvbnN0IGNoaWxkID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJy5tb25hY28tbGlzdC1yb3c6bnRoLWNoaWxkKDIpJykgYXMgSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdFx0XHRhc3NlcnQuZXF1YWwoY2hpbGQsIHVuZGVmaW5lZCk7XG5cdFx0XHRkaWRDaGVja05vQ2hpbGRyZW4gPSB0cnVlO1xuXHRcdH0pO1xuXHRcdGF3YWl0IHRyZWUuZXhwYW5kKGFVcGRhdGVkMSk7XG5cdFx0ZXZlbnQuZGlzcG9zZSgpO1xuXHRcdGFzc2VydChkaWRDaGVja05vQ2hpbGRyZW4pO1xuXG5cdFx0Y29uc3QgYU5vZGVVcGRhdGVkMiA9IHRyZWUuZ2V0Tm9kZShhKTtcblx0XHRhc3NlcnQoIWFOb2RlVXBkYXRlZDIuY29sbGFwc2VkKTtcblx0XHRhc3NlcnQuZXF1YWwoYU5vZGVVcGRhdGVkMi5jaGlsZHJlbi5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5lcXVhbChhTm9kZVVwZGF0ZWQyLmNoaWxkcmVuWzBdLmVsZW1lbnQuaWQsICdjJyk7XG5cdFx0Y29uc3QgY2hpbGQgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcignLm1vbmFjby1saXN0LXJvdzpudGgtY2hpbGQoMiknKSBhcyBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0XHRhc3NlcnQuZXF1YWwoY2hpbGQ/LnRleHRDb250ZW50LCAnYycpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTkyNDIyIC0gcmVzb2x2ZWQgY29sbGFwc2VkIG5vZGVzIHdpdGggdW5jaGFuZ2VkIGNoaWxkcmVuIGltbWVkaWF0ZWx5IHNob3cgY2hpbGRyZW4nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29uc3QgZGF0YVNvdXJjZSA9IG5ldyBjbGFzcyBpbXBsZW1lbnRzIElBc3luY0RhdGFTb3VyY2U8RWxlbWVudCwgRWxlbWVudD4ge1xuXHRcdFx0aGFzQ2hpbGRyZW4oZWxlbWVudDogRWxlbWVudCk6IGJvb2xlYW4ge1xuXHRcdFx0XHRyZXR1cm4gISFlbGVtZW50LmNoaWxkcmVuICYmIGVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoID4gMDtcblx0XHRcdH1cblx0XHRcdGFzeW5jIGdldENoaWxkcmVuKGVsZW1lbnQ6IEVsZW1lbnQpOiBQcm9taXNlPEVsZW1lbnRbXT4ge1xuXHRcdFx0XHRyZXR1cm4gZWxlbWVudC5jaGlsZHJlbiB8fCBbXTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBuZXcgTW9kZWwoe1xuXHRcdFx0aWQ6ICdyb290Jyxcblx0XHRcdGNoaWxkcmVuOiBbe1xuXHRcdFx0XHRpZDogJ2EnLCBjaGlsZHJlbjogW3sgaWQ6ICdiJyB9XVxuXHRcdFx0fV1cblx0XHR9KTtcblxuXHRcdGNvbnN0IHRyZWUgPSBzdG9yZS5hZGQobmV3IEFzeW5jRGF0YVRyZWU8RWxlbWVudCwgRWxlbWVudD4oJ3Rlc3QnLCBjb250YWluZXIsIG5ldyBWaXJ0dWFsRGVsZWdhdGUoKSwgW25ldyBSZW5kZXJlcigpXSwgZGF0YVNvdXJjZSwgeyBpZGVudGl0eVByb3ZpZGVyOiBuZXcgSWRlbnRpdHlQcm92aWRlcigpIH0pKTtcblx0XHR0cmVlLmxheW91dCgyMDApO1xuXG5cdFx0YXdhaXQgdHJlZS5zZXRJbnB1dChtb2RlbC5yb290KTtcblx0XHRjb25zdCBhID0gbW9kZWwuZ2V0KCdhJyk7XG5cdFx0Y29uc3QgYU5vZGUgPSB0cmVlLmdldE5vZGUoYSk7XG5cdFx0YXNzZXJ0KGFOb2RlLmNvbGxhcHNlZCk7XG5cdFx0YXdhaXQgdHJlZS5leHBhbmQoYSk7XG5cdFx0YXNzZXJ0KCFhTm9kZS5jb2xsYXBzZWQpO1xuXHRcdGFzc2VydC5lcXVhbChhTm9kZS5jaGlsZHJlbi5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5lcXVhbChhTm9kZS5jaGlsZHJlblswXS5lbGVtZW50LmlkLCAnYicpO1xuXHRcdGNvbnN0IGJDaGlsZCA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCcubW9uYWNvLWxpc3Qtcm93Om50aC1jaGlsZCgyKScpIGFzIEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRcdGFzc2VydC5lcXVhbChiQ2hpbGQ/LnRleHRDb250ZW50LCAnYicpO1xuXHRcdHRyZWUuY29sbGFwc2UoYSk7XG5cdFx0YXNzZXJ0KGFOb2RlLmNvbGxhcHNlZCk7XG5cblx0XHRjb25zdCBhVXBkYXRlZDEgPSBtb2RlbC5nZXQoJ2EnKTtcblx0XHRjb25zdCBhTm9kZVVwZGF0ZWQxID0gdHJlZS5nZXROb2RlKGEpO1xuXHRcdGFzc2VydChhTm9kZVVwZGF0ZWQxLmNvbGxhcHNlZCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGFOb2RlVXBkYXRlZDEuY2hpbGRyZW4ubGVuZ3RoLCAxKTtcblx0XHRsZXQgZGlkQ2hlY2tTYW1lQ2hpbGRyZW4gPSBmYWxzZTtcblx0XHRjb25zdCBldmVudCA9IHRyZWUub25EaWRDaGFuZ2VDb2xsYXBzZVN0YXRlKGUgPT4ge1xuXHRcdFx0Y29uc3QgY2hpbGQgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcignLm1vbmFjby1saXN0LXJvdzpudGgtY2hpbGQoMiknKSBhcyBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0XHRcdGFzc2VydC5lcXVhbChjaGlsZD8udGV4dENvbnRlbnQsICdiJyk7XG5cdFx0XHRkaWRDaGVja1NhbWVDaGlsZHJlbiA9IHRydWU7XG5cdFx0fSk7XG5cdFx0YXdhaXQgdHJlZS5leHBhbmQoYVVwZGF0ZWQxKTtcblx0XHRldmVudC5kaXNwb3NlKCk7XG5cdFx0YXNzZXJ0KGRpZENoZWNrU2FtZUNoaWxkcmVuKTtcblxuXHRcdGNvbnN0IGFOb2RlVXBkYXRlZDIgPSB0cmVlLmdldE5vZGUoYSk7XG5cdFx0YXNzZXJ0KCFhTm9kZVVwZGF0ZWQyLmNvbGxhcHNlZCk7XG5cdFx0YXNzZXJ0LmVxdWFsKGFOb2RlVXBkYXRlZDIuY2hpbGRyZW4ubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuZXF1YWwoYU5vZGVVcGRhdGVkMi5jaGlsZHJlblswXS5lbGVtZW50LmlkLCAnYicpO1xuXHRcdGNvbnN0IGNoaWxkID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJy5tb25hY28tbGlzdC1yb3c6bnRoLWNoaWxkKDIpJykgYXMgSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdFx0YXNzZXJ0LmVxdWFsKGNoaWxkPy50ZXh0Q29udGVudCwgJ2InKTtcblx0fSk7XG5cblx0dGVzdCgnc3VwcG9ydCBkZWZhdWx0IGNvbGxhcHNlIHN0YXRlIHBlciBlbGVtZW50JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG5cdFx0Y29uc3QgZ2V0Q2hpbGRyZW5DYWxsczogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBkYXRhU291cmNlID0gbmV3IGNsYXNzIGltcGxlbWVudHMgSUFzeW5jRGF0YVNvdXJjZTxFbGVtZW50LCBFbGVtZW50PiB7XG5cdFx0XHRoYXNDaGlsZHJlbihlbGVtZW50OiBFbGVtZW50KTogYm9vbGVhbiB7XG5cdFx0XHRcdHJldHVybiAhIWVsZW1lbnQuY2hpbGRyZW4gJiYgZWxlbWVudC5jaGlsZHJlbi5sZW5ndGggPiAwO1xuXHRcdFx0fVxuXHRcdFx0Z2V0Q2hpbGRyZW4oZWxlbWVudDogRWxlbWVudCk6IFByb21pc2U8RWxlbWVudFtdPiB7XG5cdFx0XHRcdGdldENoaWxkcmVuQ2FsbHMucHVzaChlbGVtZW50LmlkKTtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShlbGVtZW50LmNoaWxkcmVuIHx8IFtdKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBuZXcgTW9kZWwoe1xuXHRcdFx0aWQ6ICdyb290Jyxcblx0XHRcdGNoaWxkcmVuOiBbe1xuXHRcdFx0XHRpZDogJ2EnLCBjaGlsZHJlbjogW3sgaWQ6ICdhYScgfSwgeyBpZDogJ2FiJyB9LCB7IGlkOiAnYWMnIH1dXG5cdFx0XHR9XVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdHJlZSA9IHN0b3JlLmFkZChuZXcgQXN5bmNEYXRhVHJlZTxFbGVtZW50LCBFbGVtZW50PigndGVzdCcsIGNvbnRhaW5lciwgbmV3IFZpcnR1YWxEZWxlZ2F0ZSgpLCBbbmV3IFJlbmRlcmVyKCldLCBkYXRhU291cmNlLCB7XG5cdFx0XHRjb2xsYXBzZUJ5RGVmYXVsdDogZWwgPT4gZWwuaWQgIT09ICdhJ1xuXHRcdH0pKTtcblx0XHR0cmVlLmxheW91dCgyMDApO1xuXG5cdFx0YXdhaXQgdHJlZS5zZXRJbnB1dChtb2RlbC5yb290KTtcblx0XHRhc3NlcnQoIXRyZWUuZ2V0Tm9kZShtb2RlbC5nZXQoJ2EnKSkuY29sbGFwc2VkKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldENoaWxkcmVuQ2FsbHMsIFsncm9vdCcsICdhJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjODAwOTggLSBjb25jdXJyZW50IHJlZnJlc2ggYW5kIGV4cGFuZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblxuXHRcdGNvbnN0IGNhbGxzOiBGdW5jdGlvbltdID0gW107XG5cdFx0Y29uc3QgZGF0YVNvdXJjZSA9IG5ldyBjbGFzcyBpbXBsZW1lbnRzIElBc3luY0RhdGFTb3VyY2U8RWxlbWVudCwgRWxlbWVudD4ge1xuXHRcdFx0aGFzQ2hpbGRyZW4oZWxlbWVudDogRWxlbWVudCk6IGJvb2xlYW4ge1xuXHRcdFx0XHRyZXR1cm4gISFlbGVtZW50LmNoaWxkcmVuICYmIGVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoID4gMDtcblx0XHRcdH1cblx0XHRcdGdldENoaWxkcmVuKGVsZW1lbnQ6IEVsZW1lbnQpOiBQcm9taXNlPEVsZW1lbnRbXT4ge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFByb21pc2UoYyA9PiBjYWxscy5wdXNoKCgpID0+IGMoZWxlbWVudC5jaGlsZHJlbiB8fCBbXSkpKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBuZXcgTW9kZWwoe1xuXHRcdFx0aWQ6ICdyb290Jyxcblx0XHRcdGNoaWxkcmVuOiBbe1xuXHRcdFx0XHRpZDogJ2EnLCBjaGlsZHJlbjogW3tcblx0XHRcdFx0XHRpZDogJ2FhJ1xuXHRcdFx0XHR9XVxuXHRcdFx0fV1cblx0XHR9KTtcblxuXHRcdGNvbnN0IHRyZWUgPSBzdG9yZS5hZGQobmV3IEFzeW5jRGF0YVRyZWU8RWxlbWVudCwgRWxlbWVudD4oJ3Rlc3QnLCBjb250YWluZXIsIG5ldyBWaXJ0dWFsRGVsZWdhdGUoKSwgW25ldyBSZW5kZXJlcigpXSwgZGF0YVNvdXJjZSwgeyBpZGVudGl0eVByb3ZpZGVyOiBuZXcgSWRlbnRpdHlQcm92aWRlcigpIH0pKTtcblx0XHR0cmVlLmxheW91dCgyMDApO1xuXG5cdFx0Y29uc3QgcFNldElucHV0ID0gdHJlZS5zZXRJbnB1dChtb2RlbC5yb290KTtcblx0XHRjYWxscy5wb3AoKSEoKTsgLy8gcmVzb2x2ZSBnZXRDaGlsZHJlbihyb290KVxuXHRcdGF3YWl0IHBTZXRJbnB1dDtcblxuXHRcdGNvbnN0IHBVcGRhdGVDaGlsZHJlbkEgPSB0cmVlLnVwZGF0ZUNoaWxkcmVuKG1vZGVsLmdldCgnYScpKTtcblx0XHRjb25zdCBwRXhwYW5kQSA9IHRyZWUuZXhwYW5kKG1vZGVsLmdldCgnYScpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbHMubGVuZ3RoLCAxLCAnZXhwYW5kKGEpIHN0aWxsIGhhc25cXCd0IGNhbGxlZCBnZXRDaGlsZHJlbihhKScpO1xuXG5cdFx0Y2FsbHMucG9wKCkhKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxzLmxlbmd0aCwgMCwgJ25vIHBlbmRpbmcgZ2V0Q2hpbGRyZW4gY2FsbHMnKTtcblxuXHRcdGF3YWl0IHBVcGRhdGVDaGlsZHJlbkE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxzLmxlbmd0aCwgMCwgJ2V4cGFuZChhKSBzaG91bGQgbm90IGhhdmUgZm9yY2VkIGEgc2Vjb25kIHJlZnJlc2gnKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBFeHBhbmRBO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsIHRydWUsICdleHBhbmQoYSkgc2hvdWxkIGJlIGRvbmUnKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzgwMDk4IC0gZmlyc3QgZXhwYW5kIHNob3VsZCBjYWxsIGdldENoaWxkcmVuJywgYXN5bmMgKCkgPT4ge1xuXHRcdHJldHVybiBydW5XaXRoRmFrZWRUaW1lcnMoeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG5cdFx0XHRjb25zdCBjYWxsczogRnVuY3Rpb25bXSA9IFtdO1xuXHRcdFx0Y29uc3QgZGF0YVNvdXJjZSA9IG5ldyBjbGFzcyBpbXBsZW1lbnRzIElBc3luY0RhdGFTb3VyY2U8RWxlbWVudCwgRWxlbWVudD4ge1xuXHRcdFx0XHRoYXNDaGlsZHJlbihlbGVtZW50OiBFbGVtZW50KTogYm9vbGVhbiB7XG5cdFx0XHRcdFx0cmV0dXJuICEhZWxlbWVudC5jaGlsZHJlbiAmJiBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA+IDA7XG5cdFx0XHRcdH1cblx0XHRcdFx0Z2V0Q2hpbGRyZW4oZWxlbWVudDogRWxlbWVudCk6IFByb21pc2U8RWxlbWVudFtdPiB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKGMgPT4gY2FsbHMucHVzaCgoKSA9PiBjKGVsZW1lbnQuY2hpbGRyZW4gfHwgW10pKSk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IG1vZGVsID0gbmV3IE1vZGVsKHtcblx0XHRcdFx0aWQ6ICdyb290Jyxcblx0XHRcdFx0Y2hpbGRyZW46IFt7XG5cdFx0XHRcdFx0aWQ6ICdhJywgY2hpbGRyZW46IFt7XG5cdFx0XHRcdFx0XHRpZDogJ2FhJ1xuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH1dXG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgdHJlZSA9IHN0b3JlLmFkZChuZXcgQXN5bmNEYXRhVHJlZTxFbGVtZW50LCBFbGVtZW50PigndGVzdCcsIGNvbnRhaW5lciwgbmV3IFZpcnR1YWxEZWxlZ2F0ZSgpLCBbbmV3IFJlbmRlcmVyKCldLCBkYXRhU291cmNlLCB7IGlkZW50aXR5UHJvdmlkZXI6IG5ldyBJZGVudGl0eVByb3ZpZGVyKCkgfSkpO1xuXHRcdFx0dHJlZS5sYXlvdXQoMjAwKTtcblxuXHRcdFx0Y29uc3QgcFNldElucHV0ID0gdHJlZS5zZXRJbnB1dChtb2RlbC5yb290KTtcblx0XHRcdGNhbGxzLnBvcCgpISgpOyAvLyByZXNvbHZlIGdldENoaWxkcmVuKHJvb3QpXG5cdFx0XHRhd2FpdCBwU2V0SW5wdXQ7XG5cblx0XHRcdGNvbnN0IHBFeHBhbmRBID0gdHJlZS5leHBhbmQobW9kZWwuZ2V0KCdhJykpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxzLmxlbmd0aCwgMSwgJ2V4cGFuZChhKSBzaG91bGRcXCd2ZSBjYWxsZWQgZ2V0Q2hpbGRyZW4oYSknKTtcblxuXHRcdFx0bGV0IHJhY2UgPSBhd2FpdCBQcm9taXNlLnJhY2UoW3BFeHBhbmRBLnRoZW4oKCkgPT4gJ2V4cGFuZCcpLCB0aW1lb3V0KDEpLnRoZW4oKCkgPT4gJ3RpbWVvdXQnKV0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhY2UsICd0aW1lb3V0JywgJ2V4cGFuZChhKSBzaG91bGQgbm90IGJlIHlldCBkb25lJyk7XG5cblx0XHRcdGNhbGxzLnBvcCgpISgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxzLmxlbmd0aCwgMCwgJ25vIHBlbmRpbmcgZ2V0Q2hpbGRyZW4gY2FsbHMnKTtcblxuXHRcdFx0cmFjZSA9IGF3YWl0IFByb21pc2UucmFjZShbcEV4cGFuZEEudGhlbigoKSA9PiAnZXhwYW5kJyksIHRpbWVvdXQoMSkudGhlbigoKSA9PiAndGltZW91dCcpXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFjZSwgJ2V4cGFuZCcsICdleHBhbmQoYSkgc2hvdWxkIG5vdyBiZSBkb25lJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM3ODM4OCAtIHRyZWUgc2hvdWxkIHJlYWN0IHRvIGhhc0NoaWxkcmVuIHRvZ2dsZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29uc3QgbW9kZWwgPSBuZXcgTW9kZWwoe1xuXHRcdFx0aWQ6ICdyb290Jyxcblx0XHRcdGNoaWxkcmVuOiBbe1xuXHRcdFx0XHRpZDogJ2EnXG5cdFx0XHR9XVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdHJlZSA9IHN0b3JlLmFkZChuZXcgQXN5bmNEYXRhVHJlZTxFbGVtZW50LCBFbGVtZW50PigndGVzdCcsIGNvbnRhaW5lciwgbmV3IFZpcnR1YWxEZWxlZ2F0ZSgpLCBbbmV3IFJlbmRlcmVyKCldLCBuZXcgRGF0YVNvdXJjZSgpLCB7IGlkZW50aXR5UHJvdmlkZXI6IG5ldyBJZGVudGl0eVByb3ZpZGVyKCkgfSkpO1xuXHRcdHRyZWUubGF5b3V0KDIwMCk7XG5cblx0XHRhd2FpdCB0cmVlLnNldElucHV0KG1vZGVsLnJvb3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250YWluZXIucXVlcnlTZWxlY3RvckFsbCgnLm1vbmFjby1saXN0LXJvdycpLmxlbmd0aCwgMSk7XG5cblx0XHRsZXQgdHdpc3RpZSA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCcubW9uYWNvLWxpc3Qtcm93OmZpcnN0LWNoaWxkIC5tb25hY28tdGwtdHdpc3RpZScpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGFzc2VydCghdHdpc3RpZS5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbGxhcHNpYmxlJykpO1xuXHRcdGFzc2VydCghdHdpc3RpZS5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbGxhcHNlZCcpKTtcblxuXHRcdG1vZGVsLmdldCgnYScpLmNoaWxkcmVuID0gW3sgaWQ6ICdhYScgfV07XG5cdFx0YXdhaXQgdHJlZS51cGRhdGVDaGlsZHJlbihtb2RlbC5nZXQoJ2EnKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250YWluZXIucXVlcnlTZWxlY3RvckFsbCgnLm1vbmFjby1saXN0LXJvdycpLmxlbmd0aCwgMSk7XG5cdFx0dHdpc3RpZSA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCcubW9uYWNvLWxpc3Qtcm93OmZpcnN0LWNoaWxkIC5tb25hY28tdGwtdHdpc3RpZScpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGFzc2VydCh0d2lzdGllLmNsYXNzTGlzdC5jb250YWlucygnY29sbGFwc2libGUnKSk7XG5cdFx0YXNzZXJ0KHR3aXN0aWUuY2xhc3NMaXN0LmNvbnRhaW5zKCdjb2xsYXBzZWQnKSk7XG5cblx0XHRtb2RlbC5nZXQoJ2EnKS5jaGlsZHJlbiA9IFtdO1xuXHRcdGF3YWl0IHRyZWUudXBkYXRlQ2hpbGRyZW4obW9kZWwuZ2V0KCdhJyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5tb25hY28tbGlzdC1yb3cnKS5sZW5ndGgsIDEpO1xuXHRcdHR3aXN0aWUgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcignLm1vbmFjby1saXN0LXJvdzpmaXJzdC1jaGlsZCAubW9uYWNvLXRsLXR3aXN0aWUnKSBhcyBIVE1MRWxlbWVudDtcblx0XHRhc3NlcnQoIXR3aXN0aWUuY2xhc3NMaXN0LmNvbnRhaW5zKCdjb2xsYXBzaWJsZScpKTtcblx0XHRhc3NlcnQoIXR3aXN0aWUuY2xhc3NMaXN0LmNvbnRhaW5zKCdjb2xsYXBzZWQnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlcyAjODQ1NjksICM4MjYyOSAtIHJlcmVuZGVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGNvbnN0IG1vZGVsID0gbmV3IE1vZGVsKHtcblx0XHRcdGlkOiAncm9vdCcsXG5cdFx0XHRjaGlsZHJlbjogW3tcblx0XHRcdFx0aWQ6ICdhJyxcblx0XHRcdFx0Y2hpbGRyZW46IFt7XG5cdFx0XHRcdFx0aWQ6ICdiJyxcblx0XHRcdFx0XHRzdWZmaXg6ICcxJ1xuXHRcdFx0XHR9XVxuXHRcdFx0fV1cblx0XHR9KTtcblxuXHRcdGNvbnN0IHRyZWUgPSBzdG9yZS5hZGQobmV3IEFzeW5jRGF0YVRyZWU8RWxlbWVudCwgRWxlbWVudD4oJ3Rlc3QnLCBjb250YWluZXIsIG5ldyBWaXJ0dWFsRGVsZWdhdGUoKSwgW25ldyBSZW5kZXJlcigpXSwgbmV3IERhdGFTb3VyY2UoKSwgeyBpZGVudGl0eVByb3ZpZGVyOiBuZXcgSWRlbnRpdHlQcm92aWRlcigpIH0pKTtcblx0XHR0cmVlLmxheW91dCgyMDApO1xuXG5cdFx0YXdhaXQgdHJlZS5zZXRJbnB1dChtb2RlbC5yb290KTtcblx0XHRhd2FpdCB0cmVlLmV4cGFuZChtb2RlbC5nZXQoJ2EnKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChBcnJheS5mcm9tKGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCcubW9uYWNvLWxpc3Qtcm93JykpLm1hcChlID0+IGUudGV4dENvbnRlbnQpLCBbJ2EnLCAnYjEnXSk7XG5cblx0XHRjb25zdCBhID0gbW9kZWwuZ2V0KCdhJyk7XG5cdFx0Y29uc3QgYiA9IG1vZGVsLmdldCgnYicpO1xuXHRcdGEuY2hpbGRyZW4/LnNwbGljZSgwLCAxLCB7IGlkOiAnYicsIHN1ZmZpeDogJzInIH0pO1xuXG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0dHJlZS51cGRhdGVDaGlsZHJlbihhLCB0cnVlLCB0cnVlKSxcblx0XHRcdHRyZWUudXBkYXRlQ2hpbGRyZW4oYiwgdHJ1ZSwgdHJ1ZSlcblx0XHRdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoQXJyYXkuZnJvbShjb250YWluZXIucXVlcnlTZWxlY3RvckFsbCgnLm1vbmFjby1saXN0LXJvdycpKS5tYXAoZSA9PiBlLnRleHRDb250ZW50KSwgWydhJywgJ2IyJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTk5MjY0IC0gZGlzcG9zZSBkdXJpbmcgcmVuZGVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGNvbnN0IG1vZGVsMSA9IG5ldyBNb2RlbCh7XG5cdFx0XHRpZDogJ3Jvb3QnLFxuXHRcdFx0Y2hpbGRyZW46IFt7XG5cdFx0XHRcdGlkOiAnYScsIGNoaWxkcmVuOiBbeyBpZDogJ2FhJyB9LCB7IGlkOiAnYWInIH0sIHsgaWQ6ICdhYycgfV1cblx0XHRcdH1dXG5cdFx0fSk7XG5cdFx0Y29uc3QgbW9kZWwyID0gbmV3IE1vZGVsKHtcblx0XHRcdGlkOiAncm9vdCcsXG5cdFx0XHRjaGlsZHJlbjogW3tcblx0XHRcdFx0aWQ6ICdhJywgY2hpbGRyZW46IFt7IGlkOiAnYWEnIH0sIHsgaWQ6ICdhYicgfSwgeyBpZDogJ2FjJyB9XVxuXHRcdFx0fV1cblx0XHR9KTtcblxuXHRcdGNvbnN0IHRyZWUgPSBzdG9yZS5hZGQobmV3IEFzeW5jRGF0YVRyZWU8RWxlbWVudCwgRWxlbWVudD4oJ3Rlc3QnLCBjb250YWluZXIsIG5ldyBWaXJ0dWFsRGVsZWdhdGUoKSwgW25ldyBSZW5kZXJlcigpXSwgbmV3IERhdGFTb3VyY2UoKSwgeyBpZGVudGl0eVByb3ZpZGVyOiBuZXcgSWRlbnRpdHlQcm92aWRlcigpIH0pKTtcblx0XHR0cmVlLmxheW91dCgyMDApO1xuXG5cdFx0YXdhaXQgdHJlZS5zZXRJbnB1dChtb2RlbDEucm9vdCk7XG5cdFx0Y29uc3QgaW5wdXQgPSB0cmVlLnNldElucHV0KG1vZGVsMi5yb290KTtcblx0XHR0cmVlLmRpc3Bvc2UoKTtcblx0XHRhd2FpdCBpbnB1dDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGFpbmVyLmlubmVySFRNTCwgJycpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTIxNTY3JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG5cdFx0Y29uc3QgY2FsbHM6IEVsZW1lbnRbXSA9IFtdO1xuXHRcdGNvbnN0IGRhdGFTb3VyY2UgPSBuZXcgY2xhc3MgaW1wbGVtZW50cyBJQXN5bmNEYXRhU291cmNlPEVsZW1lbnQsIEVsZW1lbnQ+IHtcblx0XHRcdGhhc0NoaWxkcmVuKGVsZW1lbnQ6IEVsZW1lbnQpOiBib29sZWFuIHtcblx0XHRcdFx0cmV0dXJuICEhZWxlbWVudC5jaGlsZHJlbiAmJiBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA+IDA7XG5cdFx0XHR9XG5cdFx0XHRhc3luYyBnZXRDaGlsZHJlbihlbGVtZW50OiBFbGVtZW50KSB7XG5cdFx0XHRcdGNhbGxzLnB1c2goZWxlbWVudCk7XG5cdFx0XHRcdHJldHVybiBlbGVtZW50LmNoaWxkcmVuID8/IEl0ZXJhYmxlLmVtcHR5KCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IG1vZGVsID0gbmV3IE1vZGVsKHtcblx0XHRcdGlkOiAncm9vdCcsXG5cdFx0XHRjaGlsZHJlbjogW3tcblx0XHRcdFx0aWQ6ICdhJywgY2hpbGRyZW46IFt7XG5cdFx0XHRcdFx0aWQ6ICdhYSdcblx0XHRcdFx0fV1cblx0XHRcdH1dXG5cdFx0fSk7XG5cdFx0Y29uc3QgYSA9IG1vZGVsLmdldCgnYScpO1xuXG5cdFx0Y29uc3QgdHJlZSA9IHN0b3JlLmFkZChuZXcgQXN5bmNEYXRhVHJlZTxFbGVtZW50LCBFbGVtZW50PigndGVzdCcsIGNvbnRhaW5lciwgbmV3IFZpcnR1YWxEZWxlZ2F0ZSgpLCBbbmV3IFJlbmRlcmVyKCldLCBkYXRhU291cmNlLCB7IGlkZW50aXR5UHJvdmlkZXI6IG5ldyBJZGVudGl0eVByb3ZpZGVyKCkgfSkpO1xuXHRcdHRyZWUubGF5b3V0KDIwMCk7XG5cblx0XHRhd2FpdCB0cmVlLnNldElucHV0KG1vZGVsLnJvb3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxscy5sZW5ndGgsIDEsICdUaGVyZSBzaG91bGQgYmUgYSBzaW5nbGUgZ2V0Q2hpbGRyZW4gY2FsbCBmb3IgdGhlIHJvb3QnKTtcblx0XHRhc3NlcnQodHJlZS5pc0NvbGxhcHNpYmxlKGEpLCAnYSBpcyBjb2xsYXBzaWJsZScpO1xuXHRcdGFzc2VydCh0cmVlLmlzQ29sbGFwc2VkKGEpLCAnYSBpcyBjb2xsYXBzZWQnKTtcblxuXHRcdGF3YWl0IHRyZWUudXBkYXRlQ2hpbGRyZW4oYSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxscy5sZW5ndGgsIDEsICdUaGVyZSBzaG91bGQgYmUgbm8gY2hhbmdlcyB0byB0aGUgY2FsbHMgbGlzdCwgc2luY2UgYSB3YXMgY29sbGFwc2VkJyk7XG5cdFx0YXNzZXJ0KHRyZWUuaXNDb2xsYXBzaWJsZShhKSwgJ2EgaXMgY29sbGFwc2libGUnKTtcblx0XHRhc3NlcnQodHJlZS5pc0NvbGxhcHNlZChhKSwgJ2EgaXMgY29sbGFwc2VkJyk7XG5cblx0XHRjb25zdCBjaGlsZHJlbiA9IGEuY2hpbGRyZW47XG5cdFx0YS5jaGlsZHJlbiA9IFtdO1xuXHRcdGF3YWl0IHRyZWUudXBkYXRlQ2hpbGRyZW4oYSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxscy5sZW5ndGgsIDEsICdUaGVyZSBzaG91bGQgc3RpbGwgYmUgbm8gY2hhbmdlcyB0byB0aGUgY2FsbHMgbGlzdCwgc2luY2UgYSB3YXMgY29sbGFwc2VkJyk7XG5cdFx0YXNzZXJ0KCF0cmVlLmlzQ29sbGFwc2libGUoYSksICdhIGlzIG5vIGxvbmdlciBjb2xsYXBzaWJsZScpO1xuXHRcdGFzc2VydCh0cmVlLmlzQ29sbGFwc2VkKGEpLCAnYSBpcyBjb2xsYXBzZWQnKTtcblxuXHRcdGEuY2hpbGRyZW4gPSBjaGlsZHJlbjtcblx0XHRhd2FpdCB0cmVlLnVwZGF0ZUNoaWxkcmVuKGEsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbHMubGVuZ3RoLCAxLCAnVGhlcmUgc2hvdWxkIHN0aWxsIGJlIG5vIGNoYW5nZXMgdG8gdGhlIGNhbGxzIGxpc3QsIHNpbmNlIGEgd2FzIGNvbGxhcHNlZCcpO1xuXHRcdGFzc2VydCh0cmVlLmlzQ29sbGFwc2libGUoYSksICdhIGlzIGNvbGxhcHNpYmxlIGFnYWluJyk7XG5cdFx0YXNzZXJ0KHRyZWUuaXNDb2xsYXBzZWQoYSksICdhIGlzIGNvbGxhcHNlZCcpO1xuXG5cdFx0YXdhaXQgdHJlZS5leHBhbmQoYSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxzLmxlbmd0aCwgMiwgJ0ZpbmFsbHksIHRoZXJlIHNob3VsZCBiZSBhIGdldENoaWxkcmVuIGNhbGwgZm9yIGEnKTtcblx0XHRhc3NlcnQodHJlZS5pc0NvbGxhcHNpYmxlKGEpLCAnYSBpcyBzdGlsbCBjb2xsYXBzaWJsZScpO1xuXHRcdGFzc2VydCghdHJlZS5pc0NvbGxhcHNlZChhKSwgJ2EgaXMgZXhwYW5kZWQnKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE5OTQ0MScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblxuXHRcdGNvbnN0IGRhdGFTb3VyY2UgPSBuZXcgY2xhc3MgaW1wbGVtZW50cyBJQXN5bmNEYXRhU291cmNlPEVsZW1lbnQsIEVsZW1lbnQ+IHtcblx0XHRcdGhhc0NoaWxkcmVuKGVsZW1lbnQ6IEVsZW1lbnQpOiBib29sZWFuIHtcblx0XHRcdFx0cmV0dXJuICEhZWxlbWVudC5jaGlsZHJlbiAmJiBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA+IDA7XG5cdFx0XHR9XG5cdFx0XHRhc3luYyBnZXRDaGlsZHJlbihlbGVtZW50OiBFbGVtZW50KSB7XG5cdFx0XHRcdHJldHVybiBlbGVtZW50LmNoaWxkcmVuID8/IEl0ZXJhYmxlLmVtcHR5KCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IGNvbXByZXNzaW9uRGVsZWdhdGUgPSBuZXcgY2xhc3MgaW1wbGVtZW50cyBJVHJlZUNvbXByZXNzaW9uRGVsZWdhdGU8RWxlbWVudD4ge1xuXHRcdFx0aXNJbmNvbXByZXNzaWJsZShlbGVtZW50OiBFbGVtZW50KTogYm9vbGVhbiB7XG5cdFx0XHRcdHJldHVybiAhZGF0YVNvdXJjZS5oYXNDaGlsZHJlbihlbGVtZW50KTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBuZXcgTW9kZWwoe1xuXHRcdFx0aWQ6ICdyb290Jyxcblx0XHRcdGNoaWxkcmVuOiBbe1xuXHRcdFx0XHRpZDogJ2EnLCBjaGlsZHJlbjogW3tcblx0XHRcdFx0XHRpZDogJ2InLFxuXHRcdFx0XHRcdGNoaWxkcmVuOiBbeyBpZDogJ2IudHh0JyB9XVxuXHRcdFx0XHR9XVxuXHRcdFx0fV1cblx0XHR9KTtcblxuXHRcdGNvbnN0IGNvbGxhcHNlQnlEZWZhdWx0ID0gKGVsZW1lbnQ6IEVsZW1lbnQpID0+IGZhbHNlO1xuXG5cdFx0Y29uc3QgdHJlZSA9IHN0b3JlLmFkZChuZXcgQ29tcHJlc3NpYmxlQXN5bmNEYXRhVHJlZTxFbGVtZW50LCBFbGVtZW50PigndGVzdCcsIGNvbnRhaW5lciwgbmV3IFZpcnR1YWxEZWxlZ2F0ZSgpLCBjb21wcmVzc2lvbkRlbGVnYXRlLCBbbmV3IFJlbmRlcmVyKCldLCBkYXRhU291cmNlLCB7IGlkZW50aXR5UHJvdmlkZXI6IG5ldyBJZGVudGl0eVByb3ZpZGVyKCksIGNvbGxhcHNlQnlEZWZhdWx0IH0pKTtcblx0XHR0cmVlLmxheW91dCgyMDApO1xuXG5cdFx0YXdhaXQgdHJlZS5zZXRJbnB1dChtb2RlbC5yb290KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKEFycmF5LmZyb20oY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5tb25hY28tbGlzdC1yb3cnKSkubWFwKGUgPT4gZS50ZXh0Q29udGVudCksIFsnYS9iJywgJ2IudHh0J10pO1xuXG5cdFx0bW9kZWwuZ2V0KCdhJykuY2hpbGRyZW4hLnB1c2goe1xuXHRcdFx0aWQ6ICdjJyxcblx0XHRcdGNoaWxkcmVuOiBbeyBpZDogJ2MudHh0JyB9XVxuXHRcdH0pO1xuXG5cdFx0YXdhaXQgdHJlZS51cGRhdGVDaGlsZHJlbihtb2RlbC5yb290LCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKEFycmF5LmZyb20oY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5tb25hY28tbGlzdC1yb3cnKSkubWFwKGUgPT4gZS50ZXh0Q29udGVudCksIFsnYScsICdiJywgJ2IudHh0JywgJ2MnLCAnYy50eHQnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RyZWUgTmF2aWdhdGlvbjogQXN5bmNEYXRhVHJlZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gbmV3IE1vZGVsKHtcblx0XHRcdGlkOiAncm9vdCcsXG5cdFx0XHRjaGlsZHJlbjogW3tcblx0XHRcdFx0aWQ6ICdhJywgY2hpbGRyZW46IFt7XG5cdFx0XHRcdFx0aWQ6ICdhYScsIGNoaWxkcmVuOiBbeyBpZDogJ2FhLnR4dCcgfV1cblx0XHRcdFx0fSwge1xuXHRcdFx0XHRcdGlkOiAnYWInLCBjaGlsZHJlbjogW3sgaWQ6ICdhYi50eHQnIH1dXG5cdFx0XHRcdH1dXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGlkOiAnYicsIGNoaWxkcmVuOiBbe1xuXHRcdFx0XHRcdGlkOiAnYmEnLCBjaGlsZHJlbjogW3sgaWQ6ICdiYS50eHQnIH1dXG5cdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRpZDogJ2JiJywgY2hpbGRyZW46IFt7IGlkOiAnYmIudHh0JyB9XVxuXHRcdFx0XHR9XVxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogJ2MnLCBjaGlsZHJlbjogW3tcblx0XHRcdFx0XHRpZDogJ2NhJywgY2hpbGRyZW46IFt7IGlkOiAnY2EudHh0JyB9XVxuXHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0aWQ6ICdjYicsIGNoaWxkcmVuOiBbeyBpZDogJ2NiLnR4dCcgfV1cblx0XHRcdFx0fV1cblx0XHRcdH1dXG5cdFx0fSk7XG5cblx0XHRjb25zdCB0cmVlID0gc3RvcmUuYWRkKG5ldyBBc3luY0RhdGFUcmVlPEVsZW1lbnQsIEVsZW1lbnQ+KCd0ZXN0JywgY29udGFpbmVyLCBuZXcgVmlydHVhbERlbGVnYXRlKCksIFtuZXcgUmVuZGVyZXIoKV0sIG5ldyBEYXRhU291cmNlKCksIHsgaWRlbnRpdHlQcm92aWRlcjogbmV3IElkZW50aXR5UHJvdmlkZXIoKSB9KSk7XG5cdFx0dHJlZS5sYXlvdXQoMjAwKTtcblxuXHRcdGF3YWl0IHRyZWUuc2V0SW5wdXQobW9kZWwucm9vdCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChBcnJheS5mcm9tKGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCcubW9uYWNvLWxpc3Qtcm93JykpLm1hcChlID0+IGUudGV4dENvbnRlbnQpLCBbJ2EnLCAnYicsICdjJ10pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyZWUubmF2aWdhdGUoKS5jdXJyZW50KCksIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmVlLm5hdmlnYXRlKCkuZmlyc3QoKT8uaWQsICdhJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyZWUubmF2aWdhdGUoKS5sYXN0KCk/LmlkLCAnYycpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyZWUubmF2aWdhdGUobW9kZWwuZ2V0KCdiJykpLnByZXZpb3VzKCk/LmlkLCAnYScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmVlLm5hdmlnYXRlKG1vZGVsLmdldCgnYicpKS5uZXh0KCk/LmlkLCAnYycpO1xuXG5cdFx0YXdhaXQgdHJlZS5leHBhbmQobW9kZWwuZ2V0KCdhJykpO1xuXHRcdGF3YWl0IHRyZWUuZXhwYW5kKG1vZGVsLmdldCgnYWEnKSk7XG5cdFx0YXdhaXQgdHJlZS5leHBhbmQobW9kZWwuZ2V0KCdhYicpKTtcblxuXHRcdGF3YWl0IHRyZWUuZXhwYW5kKG1vZGVsLmdldCgnYicpKTtcblx0XHRhd2FpdCB0cmVlLmV4cGFuZChtb2RlbC5nZXQoJ2JhJykpO1xuXHRcdGF3YWl0IHRyZWUuZXhwYW5kKG1vZGVsLmdldCgnYmInKSk7XG5cblx0XHRhd2FpdCB0cmVlLmV4cGFuZChtb2RlbC5nZXQoJ2MnKSk7XG5cdFx0YXdhaXQgdHJlZS5leHBhbmQobW9kZWwuZ2V0KCdjYScpKTtcblx0XHRhd2FpdCB0cmVlLmV4cGFuZChtb2RlbC5nZXQoJ2NiJykpO1xuXG5cdFx0Ly8gT25seSB0aGUgZmlyc3QgMTAgZWxlbWVudHMgYXJlIHJlbmRlcmVkICh0b3RhbCBoZWlnaHQgaXMgMjAwcHgsIGVhY2ggZWxlbWVudCBpcyAyMHB4KVxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoQXJyYXkuZnJvbShjb250YWluZXIucXVlcnlTZWxlY3RvckFsbCgnLm1vbmFjby1saXN0LXJvdycpKS5tYXAoZSA9PiBlLnRleHRDb250ZW50KSwgWydhJywgJ2FhJywgJ2FhLnR4dCcsICdhYicsICdhYi50eHQnLCAnYicsICdiYScsICdiYS50eHQnLCAnYmInLCAnYmIudHh0J10pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyZWUubmF2aWdhdGUoKS5maXJzdCgpPy5pZCwgJ2EnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJlZS5uYXZpZ2F0ZSgpLmxhc3QoKT8uaWQsICdjYi50eHQnKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmVlLm5hdmlnYXRlKG1vZGVsLmdldCgnYicpKS5wcmV2aW91cygpPy5pZCwgJ2FiLnR4dCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmVlLm5hdmlnYXRlKG1vZGVsLmdldCgnYicpKS5uZXh0KCk/LmlkLCAnYmEnKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmVlLm5hdmlnYXRlKG1vZGVsLmdldCgnYWIudHh0JykpLnByZXZpb3VzKCk/LmlkLCAnYWInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJlZS5uYXZpZ2F0ZShtb2RlbC5nZXQoJ2FiLnR4dCcpKS5uZXh0KCk/LmlkLCAnYicpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyZWUubmF2aWdhdGUobW9kZWwuZ2V0KCdiYi50eHQnKSkubmV4dCgpPy5pZCwgJ2MnKTtcblxuXHRcdHRyZWUuY29sbGFwc2UobW9kZWwuZ2V0KCdiJyksIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKEFycmF5LmZyb20oY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5tb25hY28tbGlzdC1yb3cnKSkubWFwKGUgPT4gZS50ZXh0Q29udGVudCksIFsnYScsICdhYScsICdhYS50eHQnLCAnYWInLCAnYWIudHh0JywgJ2InLCAnYycsICdjYScsICdjYS50eHQnLCAnY2InXSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJlZS5uYXZpZ2F0ZShtb2RlbC5nZXQoJ2InKSkubmV4dCgpPy5pZCwgJ2MnKTtcblx0fSk7XG5cblx0dGVzdCgnVGVzdCBOYXZpZ2F0aW9uOiBDb21wcmVzc2libGVBc3luY0RhdGFUcmVlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG5cdFx0Y29uc3QgZGF0YVNvdXJjZSA9IG5ldyBjbGFzcyBpbXBsZW1lbnRzIElBc3luY0RhdGFTb3VyY2U8RWxlbWVudCwgRWxlbWVudD4ge1xuXHRcdFx0aGFzQ2hpbGRyZW4oZWxlbWVudDogRWxlbWVudCk6IGJvb2xlYW4ge1xuXHRcdFx0XHRyZXR1cm4gISFlbGVtZW50LmNoaWxkcmVuICYmIGVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoID4gMDtcblx0XHRcdH1cblx0XHRcdGFzeW5jIGdldENoaWxkcmVuKGVsZW1lbnQ6IEVsZW1lbnQpIHtcblx0XHRcdFx0cmV0dXJuIGVsZW1lbnQuY2hpbGRyZW4gPz8gSXRlcmFibGUuZW1wdHkoKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgY29tcHJlc3Npb25EZWxlZ2F0ZSA9IG5ldyBjbGFzcyBpbXBsZW1lbnRzIElUcmVlQ29tcHJlc3Npb25EZWxlZ2F0ZTxFbGVtZW50PiB7XG5cdFx0XHRpc0luY29tcHJlc3NpYmxlKGVsZW1lbnQ6IEVsZW1lbnQpOiBib29sZWFuIHtcblx0XHRcdFx0cmV0dXJuICFkYXRhU291cmNlLmhhc0NoaWxkcmVuKGVsZW1lbnQpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBtb2RlbCA9IG5ldyBNb2RlbCh7XG5cdFx0XHRpZDogJ3Jvb3QnLFxuXHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnYScsIGNoaWxkcmVuOiBbeyBpZDogJ2FhJywgY2hpbGRyZW46IFt7IGlkOiAnYWEudHh0JyB9XSB9XVxuXHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0aWQ6ICdiJywgY2hpbGRyZW46IFt7IGlkOiAnYmEnLCBjaGlsZHJlbjogW3sgaWQ6ICdiYS50eHQnIH1dIH1dXG5cdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRpZDogJ2MnLCBjaGlsZHJlbjogW3tcblx0XHRcdFx0XHRcdGlkOiAnY2EnLCBjaGlsZHJlbjogW3sgaWQ6ICdjYS50eHQnIH1dXG5cdFx0XHRcdFx0fSwge1xuXHRcdFx0XHRcdFx0aWQ6ICdjYicsIGNoaWxkcmVuOiBbeyBpZDogJ2NiLnR4dCcgfV1cblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSk7XG5cblx0XHRjb25zdCB0cmVlID0gc3RvcmUuYWRkKG5ldyBDb21wcmVzc2libGVBc3luY0RhdGFUcmVlPEVsZW1lbnQsIEVsZW1lbnQ+KCd0ZXN0JywgY29udGFpbmVyLCBuZXcgVmlydHVhbERlbGVnYXRlKCksIGNvbXByZXNzaW9uRGVsZWdhdGUsIFtuZXcgUmVuZGVyZXIoKV0sIGRhdGFTb3VyY2UsIHsgaWRlbnRpdHlQcm92aWRlcjogbmV3IElkZW50aXR5UHJvdmlkZXIoKSB9KSk7XG5cdFx0dHJlZS5sYXlvdXQoMjAwKTtcblxuXHRcdGF3YWl0IHRyZWUuc2V0SW5wdXQobW9kZWwucm9vdCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChBcnJheS5mcm9tKGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCcubW9uYWNvLWxpc3Qtcm93JykpLm1hcChlID0+IGUudGV4dENvbnRlbnQpLCBbJ2EnLCAnYicsICdjJ10pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyZWUubmF2aWdhdGUoKS5jdXJyZW50KCksIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmVlLm5hdmlnYXRlKCkuZmlyc3QoKT8uaWQsICdhJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyZWUubmF2aWdhdGUoKS5sYXN0KCk/LmlkLCAnYycpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyZWUubmF2aWdhdGUobW9kZWwuZ2V0KCdiJykpLnByZXZpb3VzKCk/LmlkLCAnYScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmVlLm5hdmlnYXRlKG1vZGVsLmdldCgnYicpKS5uZXh0KCk/LmlkLCAnYycpO1xuXG5cdFx0YXdhaXQgdHJlZS5leHBhbmQobW9kZWwuZ2V0KCdhJykpO1xuXHRcdGF3YWl0IHRyZWUuZXhwYW5kKG1vZGVsLmdldCgnYWEnKSk7XG5cblx0XHRhd2FpdCB0cmVlLmV4cGFuZChtb2RlbC5nZXQoJ2InKSk7XG5cdFx0YXdhaXQgdHJlZS5leHBhbmQobW9kZWwuZ2V0KCdiYScpKTtcblxuXHRcdGF3YWl0IHRyZWUuZXhwYW5kKG1vZGVsLmdldCgnYycpKTtcblx0XHRhd2FpdCB0cmVlLmV4cGFuZChtb2RlbC5nZXQoJ2NhJykpO1xuXHRcdGF3YWl0IHRyZWUuZXhwYW5kKG1vZGVsLmdldCgnY2InKSk7XG5cblx0XHQvLyBPbmx5IHRoZSBmaXJzdCAxMCBlbGVtZW50cyBhcmUgcmVuZGVyZWQgKHRvdGFsIGhlaWdodCBpcyAyMDBweCwgZWFjaCBlbGVtZW50IGlzIDIwcHgpXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChBcnJheS5mcm9tKGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCcubW9uYWNvLWxpc3Qtcm93JykpLm1hcChlID0+IGUudGV4dENvbnRlbnQpLCBbJ2EvYWEnLCAnYWEudHh0JywgJ2IvYmEnLCAnYmEudHh0JywgJ2MnLCAnY2EnLCAnY2EudHh0JywgJ2NiJywgJ2NiLnR4dCddKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmVlLm5hdmlnYXRlKCkuZmlyc3QoKT8uaWQsICdhYScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmVlLm5hdmlnYXRlKCkubGFzdCgpPy5pZCwgJ2NiLnR4dCcpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyZWUubmF2aWdhdGUobW9kZWwuZ2V0KCdiJykpLnByZXZpb3VzKCk/LmlkLCAnYWEudHh0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyZWUubmF2aWdhdGUobW9kZWwuZ2V0KCdiYScpKS5wcmV2aW91cygpPy5pZCwgJ2FhLnR4dCcpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyZWUubmF2aWdhdGUobW9kZWwuZ2V0KCdiJykpLm5leHQoKT8uaWQsICdiYS50eHQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJlZS5uYXZpZ2F0ZShtb2RlbC5nZXQoJ2JhJykpLm5leHQoKT8uaWQsICdiYS50eHQnKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmVlLm5hdmlnYXRlKG1vZGVsLmdldCgnYWEudHh0JykpLnByZXZpb3VzKCk/LmlkLCAnYWEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJlZS5uYXZpZ2F0ZShtb2RlbC5nZXQoJ2FhLnR4dCcpKS5uZXh0KCk/LmlkLCAnYmEnKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUVuQixTQUFTLGVBQWUsaUNBQTJEO0FBSW5GLFNBQVMsZUFBZTtBQUN4QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLCtDQUErQztBQUN4RCxTQUFTLDBCQUEwQjtBQVFuQyxTQUFTLEtBQUssU0FBa0IsSUFBaUM7QUFDaEUsTUFBSSxRQUFRLE9BQU8sSUFBSTtBQUN0QixXQUFPO0FBQUEsRUFDUjtBQUVBLE1BQUksQ0FBQyxRQUFRLFVBQVU7QUFDdEIsV0FBTztBQUFBLEVBQ1I7QUFFQSxhQUFXLFNBQVMsUUFBUSxVQUFVO0FBQ3JDLFVBQU0sU0FBUyxLQUFL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
