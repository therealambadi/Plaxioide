import assert from "assert";
import { SashState } from "../../../../browser/ui/sash/sash.js";
import { LayoutPriority, Sizing, SplitView } from "../../../../browser/ui/splitview/splitview.js";
import { Emitter } from "../../../../common/event.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../common/utils.js";
class TestView {
  constructor(_minimumSize, _maximumSize, priority = LayoutPriority.Normal) {
    this._minimumSize = _minimumSize;
    this._maximumSize = _maximumSize;
    this.priority = priority;
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this._element = document.createElement("div");
    this._onDidGetElement = new Emitter();
    this.onDidGetElement = this._onDidGetElement.event;
    this._size = 0;
    this._orthogonalSize = 0;
    this._onDidLayout = new Emitter();
    this.onDidLayout = this._onDidLayout.event;
    this._onDidFocus = new Emitter();
    this.onDidFocus = this._onDidFocus.event;
    assert(_minimumSize <= _maximumSize, "splitview view minimum size must be <= maximum size");
  }
  get minimumSize() {
    return this._minimumSize;
  }
  set minimumSize(size) {
    this._minimumSize = size;
    this._onDidChange.fire(void 0);
  }
  get maximumSize() {
    return this._maximumSize;
  }
  set maximumSize(size) {
    this._maximumSize = size;
    this._onDidChange.fire(void 0);
  }
  get element() {
    this._onDidGetElement.fire();
    return this._element;
  }
  get size() {
    return this._size;
  }
  get orthogonalSize() {
    return this._orthogonalSize;
  }
  layout(size, _offset, orthogonalSize) {
    this._size = size;
    this._orthogonalSize = orthogonalSize;
    this._onDidLayout.fire({ size, orthogonalSize });
  }
  focus() {
    this._onDidFocus.fire();
  }
  dispose() {
    this._onDidChange.dispose();
    this._onDidGetElement.dispose();
    this._onDidLayout.dispose();
    this._onDidFocus.dispose();
  }
}
function getSashes(splitview) {
  return splitview.sashItems.map((i) => i.sash);
}
suite("Splitview", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let container;
  setup(() => {
    container = document.createElement("div");
    container.style.position = "absolute";
    container.style.width = `${200}px`;
    container.style.height = `${200}px`;
  });
  test("empty splitview has empty DOM", () => {
    store.add(new SplitView(container));
    assert.strictEqual(container.firstElementChild.firstElementChild.childElementCount, 0, "split view should be empty");
  });
  test("has views and sashes as children", () => {
    const view1 = store.add(new TestView(20, 20));
    const view2 = store.add(new TestView(20, 20));
    const view3 = store.add(new TestView(20, 20));
    const splitview = store.add(new SplitView(container));
    splitview.addView(view1, 20);
    splitview.addView(view2, 20);
    splitview.addView(view3, 20);
    let viewQuery = container.querySelectorAll(".monaco-split-view2 > .monaco-scrollable-element > .split-view-container > .split-view-view");
    assert.strictEqual(viewQuery.length, 3, "split view should have 3 views");
    let sashQuery = container.querySelectorAll(".monaco-split-view2 > .sash-container > .monaco-sash");
    assert.strictEqual(sashQuery.length, 2, "split view should have 2 sashes");
    splitview.removeView(2);
    viewQuery = container.querySelectorAll(".monaco-split-view2 > .monaco-scrollable-element > .split-view-container > .split-view-view");
    assert.strictEqual(viewQuery.length, 2, "split view should have 2 views");
    sashQuery = container.querySelectorAll(".monaco-split-view2 > .sash-container > .monaco-sash");
    assert.strictEqual(sashQuery.length, 1, "split view should have 1 sash");
    splitview.removeView(0);
    viewQuery = container.querySelectorAll(".monaco-split-view2 > .monaco-scrollable-element > .split-view-container > .split-view-view");
    assert.strictEqual(viewQuery.length, 1, "split view should have 1 view");
    sashQuery = container.querySelectorAll(".monaco-split-view2 > .sash-container > .monaco-sash");
    assert.strictEqual(sashQuery.length, 0, "split view should have no sashes");
    splitview.removeView(0);
    viewQuery = container.querySelectorAll(".monaco-split-view2 > .monaco-scrollable-element > .split-view-container > .split-view-view");
    assert.strictEqual(viewQuery.length, 0, "split view should have no views");
    sashQuery = container.querySelectorAll(".monaco-split-view2 > .sash-container > .monaco-sash");
    assert.strictEqual(sashQuery.length, 0, "split view should have no sashes");
  });
  test("calls view methods on addView and removeView", () => {
    const view = store.add(new TestView(20, 20));
    const splitview = store.add(new SplitView(container));
    let didLayout = false;
    store.add(view.onDidLayout(() => didLayout = true));
    store.add(view.onDidGetElement(() => void 0));
    splitview.addView(view, 20);
    assert.strictEqual(view.size, 20, "view has right size");
    assert(didLayout, "layout is called");
    assert(didLayout, "render is called");
  });
  test("stretches view to viewport", () => {
    const view = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const splitview = store.add(new SplitView(container));
    splitview.layout(200);
    splitview.addView(view, 20);
    assert.strictEqual(view.size, 200, "view is stretched");
    splitview.layout(200);
    assert.strictEqual(view.size, 200, "view stayed the same");
    splitview.layout(100);
    assert.strictEqual(view.size, 100, "view is collapsed");
    splitview.layout(20);
    assert.strictEqual(view.size, 20, "view is collapsed");
    splitview.layout(10);
    assert.strictEqual(view.size, 20, "view is clamped");
    splitview.layout(200);
    assert.strictEqual(view.size, 200, "view is stretched");
  });
  test("can resize views", () => {
    const view1 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view2 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view3 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const splitview = store.add(new SplitView(container));
    splitview.layout(200);
    splitview.addView(view1, 20);
    splitview.addView(view2, 20);
    splitview.addView(view3, 20);
    assert.strictEqual(view1.size, 160, "view1 is stretched");
    assert.strictEqual(view2.size, 20, "view2 size is 20");
    assert.strictEqual(view3.size, 20, "view3 size is 20");
    splitview.resizeView(1, 40);
    assert.strictEqual(view1.size, 140, "view1 is collapsed");
    assert.strictEqual(view2.size, 40, "view2 is stretched");
    assert.strictEqual(view3.size, 20, "view3 stays the same");
    splitview.resizeView(0, 70);
    assert.strictEqual(view1.size, 70, "view1 is collapsed");
    assert.strictEqual(view2.size, 40, "view2 stays the same");
    assert.strictEqual(view3.size, 90, "view3 is stretched");
    splitview.resizeView(2, 40);
    assert.strictEqual(view1.size, 70, "view1 stays the same");
    assert.strictEqual(view2.size, 90, "view2 is collapsed");
    assert.strictEqual(view3.size, 40, "view3 is stretched");
  });
  test("reacts to view changes", () => {
    const view1 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view2 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view3 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const splitview = store.add(new SplitView(container));
    splitview.layout(200);
    splitview.addView(view1, 20);
    splitview.addView(view2, 20);
    splitview.addView(view3, 20);
    assert.strictEqual(view1.size, 160, "view1 is stretched");
    assert.strictEqual(view2.size, 20, "view2 size is 20");
    assert.strictEqual(view3.size, 20, "view3 size is 20");
    view1.maximumSize = 20;
    assert.strictEqual(view1.size, 20, "view1 is collapsed");
    assert.strictEqual(view2.size, 20, "view2 stays the same");
    assert.strictEqual(view3.size, 160, "view3 is stretched");
    view3.maximumSize = 40;
    assert.strictEqual(view1.size, 20, "view1 stays the same");
    assert.strictEqual(view2.size, 140, "view2 is stretched");
    assert.strictEqual(view3.size, 40, "view3 is collapsed");
    view2.maximumSize = 200;
    assert.strictEqual(view1.size, 20, "view1 stays the same");
    assert.strictEqual(view2.size, 140, "view2 stays the same");
    assert.strictEqual(view3.size, 40, "view3 stays the same");
    view3.maximumSize = Number.POSITIVE_INFINITY;
    view3.minimumSize = 100;
    assert.strictEqual(view1.size, 20, "view1 is collapsed");
    assert.strictEqual(view2.size, 80, "view2 is collapsed");
    assert.strictEqual(view3.size, 100, "view3 is stretched");
  });
  test("sashes are properly enabled/disabled", () => {
    const view1 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view2 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view3 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const splitview = store.add(new SplitView(container));
    splitview.layout(200);
    splitview.addView(view1, Sizing.Distribute);
    splitview.addView(view2, Sizing.Distribute);
    splitview.addView(view3, Sizing.Distribute);
    const sashes = getSashes(splitview);
    assert.strictEqual(sashes.length, 2, "there are two sashes");
    assert.strictEqual(sashes[0].state, SashState.Enabled, "first sash is enabled");
    assert.strictEqual(sashes[1].state, SashState.Enabled, "second sash is enabled");
    splitview.layout(60);
    assert.strictEqual(sashes[0].state, SashState.Disabled, "first sash is disabled");
    assert.strictEqual(sashes[1].state, SashState.Disabled, "second sash is disabled");
    splitview.layout(20);
    assert.strictEqual(sashes[0].state, SashState.Disabled, "first sash is disabled");
    assert.strictEqual(sashes[1].state, SashState.Disabled, "second sash is disabled");
    splitview.layout(200);
    assert.strictEqual(sashes[0].state, SashState.Enabled, "first sash is enabled");
    assert.strictEqual(sashes[1].state, SashState.Enabled, "second sash is enabled");
    view1.maximumSize = 20;
    assert.strictEqual(sashes[0].state, SashState.Disabled, "first sash is disabled");
    assert.strictEqual(sashes[1].state, SashState.Enabled, "second sash is enabled");
    view2.maximumSize = 20;
    assert.strictEqual(sashes[0].state, SashState.Disabled, "first sash is disabled");
    assert.strictEqual(sashes[1].state, SashState.Disabled, "second sash is disabled");
    view1.maximumSize = 300;
    assert.strictEqual(sashes[0].state, SashState.AtMinimum, "first sash is enabled");
    assert.strictEqual(sashes[1].state, SashState.AtMinimum, "second sash is enabled");
    view2.maximumSize = 200;
    assert.strictEqual(sashes[0].state, SashState.AtMinimum, "first sash is enabled");
    assert.strictEqual(sashes[1].state, SashState.AtMinimum, "second sash is enabled");
    splitview.resizeView(0, 40);
    assert.strictEqual(sashes[0].state, SashState.Enabled, "first sash is enabled");
    assert.strictEqual(sashes[1].state, SashState.Enabled, "second sash is enabled");
  });
  test("issue #35497", () => {
    const view1 = store.add(new TestView(160, Number.POSITIVE_INFINITY));
    const view2 = store.add(new TestView(66, 66));
    const splitview = store.add(new SplitView(container));
    splitview.layout(986);
    splitview.addView(view1, 142, 0);
    assert.strictEqual(view1.size, 986, "first view is stretched");
    store.add(view2.onDidGetElement(() => {
      assert.throws(() => splitview.resizeView(1, 922));
      assert.throws(() => splitview.resizeView(1, 922));
    }));
    splitview.addView(view2, 66, 0);
    assert.strictEqual(view2.size, 66, "second view is fixed");
    assert.strictEqual(view1.size, 986 - 66, "first view is collapsed");
    const viewContainers = container.querySelectorAll(".split-view-view");
    assert.strictEqual(viewContainers.length, 2, "there are two view containers");
    assert.strictEqual(viewContainers.item(0).style.height, "66px", "second view container is 66px");
    assert.strictEqual(viewContainers.item(1).style.height, `${986 - 66}px`, "first view container is 66px");
  });
  test("automatic size distribution", () => {
    const view1 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view2 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view3 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const splitview = store.add(new SplitView(container));
    splitview.layout(200);
    splitview.addView(view1, Sizing.Distribute);
    assert.strictEqual(view1.size, 200);
    splitview.addView(view2, 50);
    assert.deepStrictEqual([view1.size, view2.size], [150, 50]);
    splitview.addView(view3, Sizing.Distribute);
    assert.deepStrictEqual([view1.size, view2.size, view3.size], [66, 66, 68]);
    splitview.removeView(1, Sizing.Distribute);
    assert.deepStrictEqual([view1.size, view3.size], [100, 100]);
  });
  test("add views before layout", () => {
    const view1 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view2 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view3 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const splitview = store.add(new SplitView(container));
    splitview.addView(view1, 100);
    splitview.addView(view2, 75);
    splitview.addView(view3, 25);
    splitview.layout(200);
    assert.deepStrictEqual([view1.size, view2.size, view3.size], [67, 67, 66]);
  });
  test("split sizing", () => {
    const view1 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view2 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view3 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const splitview = store.add(new SplitView(container));
    splitview.layout(200);
    splitview.addView(view1, Sizing.Distribute);
    assert.strictEqual(view1.size, 200);
    splitview.addView(view2, Sizing.Split(0));
    assert.deepStrictEqual([view1.size, view2.size], [100, 100]);
    splitview.addView(view3, Sizing.Split(1));
    assert.deepStrictEqual([view1.size, view2.size, view3.size], [100, 50, 50]);
  });
  test("split sizing 2", () => {
    const view1 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view2 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view3 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const splitview = store.add(new SplitView(container));
    splitview.layout(200);
    splitview.addView(view1, Sizing.Distribute);
    assert.strictEqual(view1.size, 200);
    splitview.addView(view2, Sizing.Split(0));
    assert.deepStrictEqual([view1.size, view2.size], [100, 100]);
    splitview.addView(view3, Sizing.Split(0));
    assert.deepStrictEqual([view1.size, view2.size, view3.size], [50, 100, 50]);
  });
  test("proportional layout", () => {
    const view1 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view2 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const splitview = store.add(new SplitView(container));
    splitview.layout(200);
    splitview.addView(view1, Sizing.Distribute);
    splitview.addView(view2, Sizing.Distribute);
    assert.deepStrictEqual([view1.size, view2.size], [100, 100]);
    splitview.layout(100);
    assert.deepStrictEqual([view1.size, view2.size], [50, 50]);
  });
  test("disable proportional layout", () => {
    const view1 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view2 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const splitview = store.add(new SplitView(container, { proportionalLayout: false }));
    splitview.layout(200);
    splitview.addView(view1, Sizing.Distribute);
    splitview.addView(view2, Sizing.Distribute);
    assert.deepStrictEqual([view1.size, view2.size], [100, 100]);
    splitview.layout(100);
    assert.deepStrictEqual([view1.size, view2.size], [80, 20]);
  });
  test("high layout priority", () => {
    const view1 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view2 = store.add(new TestView(20, Number.POSITIVE_INFINITY, LayoutPriority.High));
    const view3 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const splitview = store.add(new SplitView(container, { proportionalLayout: false }));
    splitview.layout(200);
    splitview.addView(view1, Sizing.Distribute);
    splitview.addView(view2, Sizing.Distribute);
    splitview.addView(view3, Sizing.Distribute);
    assert.deepStrictEqual([view1.size, view2.size, view3.size], [66, 68, 66]);
    splitview.layout(180);
    assert.deepStrictEqual([view1.size, view2.size, view3.size], [66, 48, 66]);
    splitview.layout(124);
    assert.deepStrictEqual([view1.size, view2.size, view3.size], [66, 20, 38]);
    splitview.layout(60);
    assert.deepStrictEqual([view1.size, view2.size, view3.size], [20, 20, 20]);
    splitview.layout(200);
    assert.deepStrictEqual([view1.size, view2.size, view3.size], [20, 160, 20]);
  });
  test("low layout priority", () => {
    const view1 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view2 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view3 = store.add(new TestView(20, Number.POSITIVE_INFINITY, LayoutPriority.Low));
    const splitview = store.add(new SplitView(container, { proportionalLayout: false }));
    splitview.layout(200);
    splitview.addView(view1, Sizing.Distribute);
    splitview.addView(view2, Sizing.Distribute);
    splitview.addView(view3, Sizing.Distribute);
    assert.deepStrictEqual([view1.size, view2.size, view3.size], [66, 68, 66]);
    splitview.layout(180);
    assert.deepStrictEqual([view1.size, view2.size, view3.size], [66, 48, 66]);
    splitview.layout(132);
    assert.deepStrictEqual([view1.size, view2.size, view3.size], [46, 20, 66]);
    splitview.layout(60);
    assert.deepStrictEqual([view1.size, view2.size, view3.size], [20, 20, 20]);
    splitview.layout(200);
    assert.deepStrictEqual([view1.size, view2.size, view3.size], [20, 160, 20]);
  });
  test("context propagates to views", () => {
    const view1 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view2 = store.add(new TestView(20, Number.POSITIVE_INFINITY));
    const view3 = store.add(new TestView(20, Number.POSITIVE_INFINITY, LayoutPriority.Low));
    const splitview = store.add(new SplitView(container, { proportionalLayout: false }));
    splitview.layout(200);
    splitview.addView(view1, Sizing.Distribute);
    splitview.addView(view2, Sizing.Distribute);
    splitview.addView(view3, Sizing.Distribute);
    splitview.layout(200, 100);
    assert.deepStrictEqual([view1.orthogonalSize, view2.orthogonalSize, view3.orthogonalSize], [100, 100, 100]);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvYnJvd3Nlci91aS9zcGxpdHZpZXcvc3BsaXR2aWV3LnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBTYXNoLCBTYXNoU3RhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL3VpL3Nhc2gvc2FzaC5qcyc7XG5pbXBvcnQgeyBJVmlldywgTGF5b3V0UHJpb3JpdHksIFNpemluZywgU3BsaXRWaWV3IH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci91aS9zcGxpdHZpZXcvc3BsaXR2aWV3LmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3V0aWxzLmpzJztcblxuY2xhc3MgVGVzdFZpZXcgaW1wbGVtZW50cyBJVmlldzxudW1iZXI+IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZSA9IG5ldyBFbWl0dGVyPG51bWJlciB8IHVuZGVmaW5lZD4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2UgPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRnZXQgbWluaW11bVNpemUoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuX21pbmltdW1TaXplOyB9XG5cdHNldCBtaW5pbXVtU2l6ZShzaXplOiBudW1iZXIpIHsgdGhpcy5fbWluaW11bVNpemUgPSBzaXplOyB0aGlzLl9vbkRpZENoYW5nZS5maXJlKHVuZGVmaW5lZCk7IH1cblxuXHRnZXQgbWF4aW11bVNpemUoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuX21heGltdW1TaXplOyB9XG5cdHNldCBtYXhpbXVtU2l6ZShzaXplOiBudW1iZXIpIHsgdGhpcy5fbWF4aW11bVNpemUgPSBzaXplOyB0aGlzLl9vbkRpZENoYW5nZS5maXJlKHVuZGVmaW5lZCk7IH1cblxuXHRwcml2YXRlIF9lbGVtZW50OiBIVE1MRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRnZXQgZWxlbWVudCgpOiBIVE1MRWxlbWVudCB7IHRoaXMuX29uRGlkR2V0RWxlbWVudC5maXJlKCk7IHJldHVybiB0aGlzLl9lbGVtZW50OyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRHZXRFbGVtZW50ID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0cmVhZG9ubHkgb25EaWRHZXRFbGVtZW50ID0gdGhpcy5fb25EaWRHZXRFbGVtZW50LmV2ZW50O1xuXG5cdHByaXZhdGUgX3NpemUgPSAwO1xuXHRnZXQgc2l6ZSgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5fc2l6ZTsgfVxuXHRwcml2YXRlIF9vcnRob2dvbmFsU2l6ZTogbnVtYmVyIHwgdW5kZWZpbmVkID0gMDtcblx0Z2V0IG9ydGhvZ29uYWxTaXplKCk6IG51bWJlciB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9vcnRob2dvbmFsU2l6ZTsgfVxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZExheW91dCA9IG5ldyBFbWl0dGVyPHsgc2l6ZTogbnVtYmVyOyBvcnRob2dvbmFsU2l6ZTogbnVtYmVyIHwgdW5kZWZpbmVkIH0+KCk7XG5cdHJlYWRvbmx5IG9uRGlkTGF5b3V0ID0gdGhpcy5fb25EaWRMYXlvdXQuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRGb2N1cyA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkRm9jdXMgPSB0aGlzLl9vbkRpZEZvY3VzLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgX21pbmltdW1TaXplOiBudW1iZXIsXG5cdFx0cHJpdmF0ZSBfbWF4aW11bVNpemU6IG51bWJlcixcblx0XHRyZWFkb25seSBwcmlvcml0eTogTGF5b3V0UHJpb3JpdHkgPSBMYXlvdXRQcmlvcml0eS5Ob3JtYWxcblx0KSB7XG5cdFx0YXNzZXJ0KF9taW5pbXVtU2l6ZSA8PSBfbWF4aW11bVNpemUsICdzcGxpdHZpZXcgdmlldyBtaW5pbXVtIHNpemUgbXVzdCBiZSA8PSBtYXhpbXVtIHNpemUnKTtcblx0fVxuXG5cdGxheW91dChzaXplOiBudW1iZXIsIF9vZmZzZXQ6IG51bWJlciwgb3J0aG9nb25hbFNpemU6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuX3NpemUgPSBzaXplO1xuXHRcdHRoaXMuX29ydGhvZ29uYWxTaXplID0gb3J0aG9nb25hbFNpemU7XG5cdFx0dGhpcy5fb25EaWRMYXlvdXQuZmlyZSh7IHNpemUsIG9ydGhvZ29uYWxTaXplIH0pO1xuXHR9XG5cblx0Zm9jdXMoKTogdm9pZCB7XG5cdFx0dGhpcy5fb25EaWRGb2N1cy5maXJlKCk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9vbkRpZEdldEVsZW1lbnQuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX29uRGlkTGF5b3V0LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9vbkRpZEZvY3VzLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRTYXNoZXMoc3BsaXR2aWV3OiBTcGxpdFZpZXcpOiBTYXNoW10ge1xuXHRyZXR1cm4gc3BsaXR2aWV3LnNhc2hJdGVtcy5tYXAoKGk6IGFueSkgPT4gaS5zYXNoKSBhcyBTYXNoW107XG59XG5cbnN1aXRlKCdTcGxpdHZpZXcnLCAoKSA9PiB7XG5cblx0Y29uc3Qgc3RvcmUgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRsZXQgY29udGFpbmVyOiBIVE1MRWxlbWVudDtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0Y29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29udGFpbmVyLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHRjb250YWluZXIuc3R5bGUud2lkdGggPSBgJHsyMDB9cHhgO1xuXHRcdGNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHsyMDB9cHhgO1xuXHR9KTtcblxuXHR0ZXN0KCdlbXB0eSBzcGxpdHZpZXcgaGFzIGVtcHR5IERPTScsICgpID0+IHtcblx0XHRzdG9yZS5hZGQobmV3IFNwbGl0Vmlldyhjb250YWluZXIpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGFpbmVyLmZpcnN0RWxlbWVudENoaWxkIS5maXJzdEVsZW1lbnRDaGlsZCEuY2hpbGRFbGVtZW50Q291bnQsIDAsICdzcGxpdCB2aWV3IHNob3VsZCBiZSBlbXB0eScpO1xuXHR9KTtcblxuXHR0ZXN0KCdoYXMgdmlld3MgYW5kIHNhc2hlcyBhcyBjaGlsZHJlbicsICgpID0+IHtcblx0XHRjb25zdCB2aWV3MSA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoMjAsIDIwKSk7XG5cdFx0Y29uc3QgdmlldzIgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDIwLCAyMCkpO1xuXHRcdGNvbnN0IHZpZXczID0gc3RvcmUuYWRkKG5ldyBUZXN0VmlldygyMCwgMjApKTtcblx0XHRjb25zdCBzcGxpdHZpZXcgPSBzdG9yZS5hZGQobmV3IFNwbGl0Vmlldyhjb250YWluZXIpKTtcblxuXHRcdHNwbGl0dmlldy5hZGRWaWV3KHZpZXcxLCAyMCk7XG5cdFx0c3BsaXR2aWV3LmFkZFZpZXcodmlldzIsIDIwKTtcblx0XHRzcGxpdHZpZXcuYWRkVmlldyh2aWV3MywgMjApO1xuXG5cdFx0bGV0IHZpZXdRdWVyeSA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCcubW9uYWNvLXNwbGl0LXZpZXcyID4gLm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgPiAuc3BsaXQtdmlldy1jb250YWluZXIgPiAuc3BsaXQtdmlldy12aWV3Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdRdWVyeS5sZW5ndGgsIDMsICdzcGxpdCB2aWV3IHNob3VsZCBoYXZlIDMgdmlld3MnKTtcblxuXHRcdGxldCBzYXNoUXVlcnkgPSBjb250YWluZXIucXVlcnlTZWxlY3RvckFsbCgnLm1vbmFjby1zcGxpdC12aWV3MiA+IC5zYXNoLWNvbnRhaW5lciA+IC5tb25hY28tc2FzaCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXNoUXVlcnkubGVuZ3RoLCAyLCAnc3BsaXQgdmlldyBzaG91bGQgaGF2ZSAyIHNhc2hlcycpO1xuXG5cdFx0c3BsaXR2aWV3LnJlbW92ZVZpZXcoMik7XG5cblx0XHR2aWV3UXVlcnkgPSBjb250YWluZXIucXVlcnlTZWxlY3RvckFsbCgnLm1vbmFjby1zcGxpdC12aWV3MiA+IC5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50ID4gLnNwbGl0LXZpZXctY29udGFpbmVyID4gLnNwbGl0LXZpZXctdmlldycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3UXVlcnkubGVuZ3RoLCAyLCAnc3BsaXQgdmlldyBzaG91bGQgaGF2ZSAyIHZpZXdzJyk7XG5cblx0XHRzYXNoUXVlcnkgPSBjb250YWluZXIucXVlcnlTZWxlY3RvckFsbCgnLm1vbmFjby1zcGxpdC12aWV3MiA+IC5zYXNoLWNvbnRhaW5lciA+IC5tb25hY28tc2FzaCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXNoUXVlcnkubGVuZ3RoLCAxLCAnc3BsaXQgdmlldyBzaG91bGQgaGF2ZSAxIHNhc2gnKTtcblxuXHRcdHNwbGl0dmlldy5yZW1vdmVWaWV3KDApO1xuXG5cdFx0dmlld1F1ZXJ5ID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5tb25hY28tc3BsaXQtdmlldzIgPiAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5zcGxpdC12aWV3LWNvbnRhaW5lciA+IC5zcGxpdC12aWV3LXZpZXcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld1F1ZXJ5Lmxlbmd0aCwgMSwgJ3NwbGl0IHZpZXcgc2hvdWxkIGhhdmUgMSB2aWV3Jyk7XG5cblx0XHRzYXNoUXVlcnkgPSBjb250YWluZXIucXVlcnlTZWxlY3RvckFsbCgnLm1vbmFjby1zcGxpdC12aWV3MiA+IC5zYXNoLWNvbnRhaW5lciA+IC5tb25hY28tc2FzaCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXNoUXVlcnkubGVuZ3RoLCAwLCAnc3BsaXQgdmlldyBzaG91bGQgaGF2ZSBubyBzYXNoZXMnKTtcblxuXHRcdHNwbGl0dmlldy5yZW1vdmVWaWV3KDApO1xuXG5cdFx0dmlld1F1ZXJ5ID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5tb25hY28tc3BsaXQtdmlldzIgPiAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5zcGxpdC12aWV3LWNvbnRhaW5lciA+IC5zcGxpdC12aWV3LXZpZXcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld1F1ZXJ5Lmxlbmd0aCwgMCwgJ3NwbGl0IHZpZXcgc2hvdWxkIGhhdmUgbm8gdmlld3MnKTtcblxuXHRcdHNhc2hRdWVyeSA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCcubW9uYWNvLXNwbGl0LXZpZXcyID4gLnNhc2gtY29udGFpbmVyID4gLm1vbmFjby1zYXNoJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhc2hRdWVyeS5sZW5ndGgsIDAsICdzcGxpdCB2aWV3IHNob3VsZCBoYXZlIG5vIHNhc2hlcycpO1xuXHR9KTtcblxuXHR0ZXN0KCdjYWxscyB2aWV3IG1ldGhvZHMgb24gYWRkVmlldyBhbmQgcmVtb3ZlVmlldycsICgpID0+IHtcblx0XHRjb25zdCB2aWV3ID0gc3RvcmUuYWRkKG5ldyBUZXN0VmlldygyMCwgMjApKTtcblx0XHRjb25zdCBzcGxpdHZpZXcgPSBzdG9yZS5hZGQobmV3IFNwbGl0Vmlldyhjb250YWluZXIpKTtcblxuXHRcdGxldCBkaWRMYXlvdXQgPSBmYWxzZTtcblx0XHRzdG9yZS5hZGQodmlldy5vbkRpZExheW91dCgoKSA9PiBkaWRMYXlvdXQgPSB0cnVlKSk7XG5cdFx0c3RvcmUuYWRkKHZpZXcub25EaWRHZXRFbGVtZW50KCgpID0+IHVuZGVmaW5lZCkpO1xuXG5cdFx0c3BsaXR2aWV3LmFkZFZpZXcodmlldywgMjApO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXcuc2l6ZSwgMjAsICd2aWV3IGhhcyByaWdodCBzaXplJyk7XG5cdFx0YXNzZXJ0KGRpZExheW91dCwgJ2xheW91dCBpcyBjYWxsZWQnKTtcblx0XHRhc3NlcnQoZGlkTGF5b3V0LCAncmVuZGVyIGlzIGNhbGxlZCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdzdHJldGNoZXMgdmlldyB0byB2aWV3cG9ydCcsICgpID0+IHtcblx0XHRjb25zdCB2aWV3ID0gc3RvcmUuYWRkKG5ldyBUZXN0VmlldygyMCwgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKSk7XG5cdFx0Y29uc3Qgc3BsaXR2aWV3ID0gc3RvcmUuYWRkKG5ldyBTcGxpdFZpZXcoY29udGFpbmVyKSk7XG5cdFx0c3BsaXR2aWV3LmxheW91dCgyMDApO1xuXG5cdFx0c3BsaXR2aWV3LmFkZFZpZXcodmlldywgMjApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3LnNpemUsIDIwMCwgJ3ZpZXcgaXMgc3RyZXRjaGVkJyk7XG5cblx0XHRzcGxpdHZpZXcubGF5b3V0KDIwMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXcuc2l6ZSwgMjAwLCAndmlldyBzdGF5ZWQgdGhlIHNhbWUnKTtcblxuXHRcdHNwbGl0dmlldy5sYXlvdXQoMTAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlldy5zaXplLCAxMDAsICd2aWV3IGlzIGNvbGxhcHNlZCcpO1xuXG5cdFx0c3BsaXR2aWV3LmxheW91dCgyMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXcuc2l6ZSwgMjAsICd2aWV3IGlzIGNvbGxhcHNlZCcpO1xuXG5cdFx0c3BsaXR2aWV3LmxheW91dCgxMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXcuc2l6ZSwgMjAsICd2aWV3IGlzIGNsYW1wZWQnKTtcblxuXHRcdHNwbGl0dmlldy5sYXlvdXQoMjAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlldy5zaXplLCAyMDAsICd2aWV3IGlzIHN0cmV0Y2hlZCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdjYW4gcmVzaXplIHZpZXdzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHZpZXcxID0gc3RvcmUuYWRkKG5ldyBUZXN0VmlldygyMCwgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKSk7XG5cdFx0Y29uc3QgdmlldzIgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDIwLCBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpKTtcblx0XHRjb25zdCB2aWV3MyA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoMjAsIE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkpO1xuXHRcdGNvbnN0IHNwbGl0dmlldyA9IHN0b3JlLmFkZChuZXcgU3BsaXRWaWV3KGNvbnRhaW5lcikpO1xuXHRcdHNwbGl0dmlldy5sYXlvdXQoMjAwKTtcblxuXHRcdHNwbGl0dmlldy5hZGRWaWV3KHZpZXcxLCAyMCk7XG5cdFx0c3BsaXR2aWV3LmFkZFZpZXcodmlldzIsIDIwKTtcblx0XHRzcGxpdHZpZXcuYWRkVmlldyh2aWV3MywgMjApO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXcxLnNpemUsIDE2MCwgJ3ZpZXcxIGlzIHN0cmV0Y2hlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCAyMCwgJ3ZpZXcyIHNpemUgaXMgMjAnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlldzMuc2l6ZSwgMjAsICd2aWV3MyBzaXplIGlzIDIwJyk7XG5cblx0XHRzcGxpdHZpZXcucmVzaXplVmlldygxLCA0MCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlldzEuc2l6ZSwgMTQwLCAndmlldzEgaXMgY29sbGFwc2VkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXcyLnNpemUsIDQwLCAndmlldzIgaXMgc3RyZXRjaGVkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXczLnNpemUsIDIwLCAndmlldzMgc3RheXMgdGhlIHNhbWUnKTtcblxuXHRcdHNwbGl0dmlldy5yZXNpemVWaWV3KDAsIDcwKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3MS5zaXplLCA3MCwgJ3ZpZXcxIGlzIGNvbGxhcHNlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCA0MCwgJ3ZpZXcyIHN0YXlzIHRoZSBzYW1lJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXczLnNpemUsIDkwLCAndmlldzMgaXMgc3RyZXRjaGVkJyk7XG5cblx0XHRzcGxpdHZpZXcucmVzaXplVmlldygyLCA0MCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlldzEuc2l6ZSwgNzAsICd2aWV3MSBzdGF5cyB0aGUgc2FtZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCA5MCwgJ3ZpZXcyIGlzIGNvbGxhcHNlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3My5zaXplLCA0MCwgJ3ZpZXczIGlzIHN0cmV0Y2hlZCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWFjdHMgdG8gdmlldyBjaGFuZ2VzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHZpZXcxID0gc3RvcmUuYWRkKG5ldyBUZXN0VmlldygyMCwgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKSk7XG5cdFx0Y29uc3QgdmlldzIgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDIwLCBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpKTtcblx0XHRjb25zdCB2aWV3MyA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoMjAsIE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkpO1xuXHRcdGNvbnN0IHNwbGl0dmlldyA9IHN0b3JlLmFkZChuZXcgU3BsaXRWaWV3KGNvbnRhaW5lcikpO1xuXHRcdHNwbGl0dmlldy5sYXlvdXQoMjAwKTtcblxuXHRcdHNwbGl0dmlldy5hZGRWaWV3KHZpZXcxLCAyMCk7XG5cdFx0c3BsaXR2aWV3LmFkZFZpZXcodmlldzIsIDIwKTtcblx0XHRzcGxpdHZpZXcuYWRkVmlldyh2aWV3MywgMjApO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXcxLnNpemUsIDE2MCwgJ3ZpZXcxIGlzIHN0cmV0Y2hlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCAyMCwgJ3ZpZXcyIHNpemUgaXMgMjAnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlldzMuc2l6ZSwgMjAsICd2aWV3MyBzaXplIGlzIDIwJyk7XG5cblx0XHR2aWV3MS5tYXhpbXVtU2l6ZSA9IDIwO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXcxLnNpemUsIDIwLCAndmlldzEgaXMgY29sbGFwc2VkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXcyLnNpemUsIDIwLCAndmlldzIgc3RheXMgdGhlIHNhbWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlldzMuc2l6ZSwgMTYwLCAndmlldzMgaXMgc3RyZXRjaGVkJyk7XG5cblx0XHR2aWV3My5tYXhpbXVtU2l6ZSA9IDQwO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXcxLnNpemUsIDIwLCAndmlldzEgc3RheXMgdGhlIHNhbWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlldzIuc2l6ZSwgMTQwLCAndmlldzIgaXMgc3RyZXRjaGVkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXczLnNpemUsIDQwLCAndmlldzMgaXMgY29sbGFwc2VkJyk7XG5cblx0XHR2aWV3Mi5tYXhpbXVtU2l6ZSA9IDIwMDtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3MS5zaXplLCAyMCwgJ3ZpZXcxIHN0YXlzIHRoZSBzYW1lJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXcyLnNpemUsIDE0MCwgJ3ZpZXcyIHN0YXlzIHRoZSBzYW1lJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXczLnNpemUsIDQwLCAndmlldzMgc3RheXMgdGhlIHNhbWUnKTtcblxuXHRcdHZpZXczLm1heGltdW1TaXplID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuXHRcdHZpZXczLm1pbmltdW1TaXplID0gMTAwO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXcxLnNpemUsIDIwLCAndmlldzEgaXMgY29sbGFwc2VkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXcyLnNpemUsIDgwLCAndmlldzIgaXMgY29sbGFwc2VkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXczLnNpemUsIDEwMCwgJ3ZpZXczIGlzIHN0cmV0Y2hlZCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdzYXNoZXMgYXJlIHByb3Blcmx5IGVuYWJsZWQvZGlzYWJsZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgdmlldzEgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDIwLCBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpKTtcblx0XHRjb25zdCB2aWV3MiA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoMjAsIE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkpO1xuXHRcdGNvbnN0IHZpZXczID0gc3RvcmUuYWRkKG5ldyBUZXN0VmlldygyMCwgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKSk7XG5cdFx0Y29uc3Qgc3BsaXR2aWV3ID0gc3RvcmUuYWRkKG5ldyBTcGxpdFZpZXcoY29udGFpbmVyKSk7XG5cdFx0c3BsaXR2aWV3LmxheW91dCgyMDApO1xuXG5cdFx0c3BsaXR2aWV3LmFkZFZpZXcodmlldzEsIFNpemluZy5EaXN0cmlidXRlKTtcblx0XHRzcGxpdHZpZXcuYWRkVmlldyh2aWV3MiwgU2l6aW5nLkRpc3RyaWJ1dGUpO1xuXHRcdHNwbGl0dmlldy5hZGRWaWV3KHZpZXczLCBTaXppbmcuRGlzdHJpYnV0ZSk7XG5cblx0XHRjb25zdCBzYXNoZXMgPSBnZXRTYXNoZXMoc3BsaXR2aWV3KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FzaGVzLmxlbmd0aCwgMiwgJ3RoZXJlIGFyZSB0d28gc2FzaGVzJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhc2hlc1swXS5zdGF0ZSwgU2FzaFN0YXRlLkVuYWJsZWQsICdmaXJzdCBzYXNoIGlzIGVuYWJsZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FzaGVzWzFdLnN0YXRlLCBTYXNoU3RhdGUuRW5hYmxlZCwgJ3NlY29uZCBzYXNoIGlzIGVuYWJsZWQnKTtcblxuXHRcdHNwbGl0dmlldy5sYXlvdXQoNjApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXNoZXNbMF0uc3RhdGUsIFNhc2hTdGF0ZS5EaXNhYmxlZCwgJ2ZpcnN0IHNhc2ggaXMgZGlzYWJsZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FzaGVzWzFdLnN0YXRlLCBTYXNoU3RhdGUuRGlzYWJsZWQsICdzZWNvbmQgc2FzaCBpcyBkaXNhYmxlZCcpO1xuXG5cdFx0c3BsaXR2aWV3LmxheW91dCgyMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhc2hlc1swXS5zdGF0ZSwgU2FzaFN0YXRlLkRpc2FibGVkLCAnZmlyc3Qgc2FzaCBpcyBkaXNhYmxlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXNoZXNbMV0uc3RhdGUsIFNhc2hTdGF0ZS5EaXNhYmxlZCwgJ3NlY29uZCBzYXNoIGlzIGRpc2FibGVkJyk7XG5cblx0XHRzcGxpdHZpZXcubGF5b3V0KDIwMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhc2hlc1swXS5zdGF0ZSwgU2FzaFN0YXRlLkVuYWJsZWQsICdmaXJzdCBzYXNoIGlzIGVuYWJsZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FzaGVzWzFdLnN0YXRlLCBTYXNoU3RhdGUuRW5hYmxlZCwgJ3NlY29uZCBzYXNoIGlzIGVuYWJsZWQnKTtcblxuXHRcdHZpZXcxLm1heGltdW1TaXplID0gMjA7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhc2hlc1swXS5zdGF0ZSwgU2FzaFN0YXRlLkRpc2FibGVkLCAnZmlyc3Qgc2FzaCBpcyBkaXNhYmxlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXNoZXNbMV0uc3RhdGUsIFNhc2hTdGF0ZS5FbmFibGVkLCAnc2Vjb25kIHNhc2ggaXMgZW5hYmxlZCcpO1xuXG5cdFx0dmlldzIubWF4aW11bVNpemUgPSAyMDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FzaGVzWzBdLnN0YXRlLCBTYXNoU3RhdGUuRGlzYWJsZWQsICdmaXJzdCBzYXNoIGlzIGRpc2FibGVkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhc2hlc1sxXS5zdGF0ZSwgU2FzaFN0YXRlLkRpc2FibGVkLCAnc2Vjb25kIHNhc2ggaXMgZGlzYWJsZWQnKTtcblxuXHRcdHZpZXcxLm1heGltdW1TaXplID0gMzAwO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXNoZXNbMF0uc3RhdGUsIFNhc2hTdGF0ZS5BdE1pbmltdW0sICdmaXJzdCBzYXNoIGlzIGVuYWJsZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FzaGVzWzFdLnN0YXRlLCBTYXNoU3RhdGUuQXRNaW5pbXVtLCAnc2Vjb25kIHNhc2ggaXMgZW5hYmxlZCcpO1xuXG5cdFx0dmlldzIubWF4aW11bVNpemUgPSAyMDA7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhc2hlc1swXS5zdGF0ZSwgU2FzaFN0YXRlLkF0TWluaW11bSwgJ2ZpcnN0IHNhc2ggaXMgZW5hYmxlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXNoZXNbMV0uc3RhdGUsIFNhc2hTdGF0ZS5BdE1pbmltdW0sICdzZWNvbmQgc2FzaCBpcyBlbmFibGVkJyk7XG5cblx0XHRzcGxpdHZpZXcucmVzaXplVmlldygwLCA0MCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhc2hlc1swXS5zdGF0ZSwgU2FzaFN0YXRlLkVuYWJsZWQsICdmaXJzdCBzYXNoIGlzIGVuYWJsZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FzaGVzWzFdLnN0YXRlLCBTYXNoU3RhdGUuRW5hYmxlZCwgJ3NlY29uZCBzYXNoIGlzIGVuYWJsZWQnKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzM1NDk3JywgKCkgPT4ge1xuXHRcdGNvbnN0IHZpZXcxID0gc3RvcmUuYWRkKG5ldyBUZXN0VmlldygxNjAsIE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkpO1xuXHRcdGNvbnN0IHZpZXcyID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg2NiwgNjYpKTtcblxuXHRcdGNvbnN0IHNwbGl0dmlldyA9IHN0b3JlLmFkZChuZXcgU3BsaXRWaWV3KGNvbnRhaW5lcikpO1xuXHRcdHNwbGl0dmlldy5sYXlvdXQoOTg2KTtcblxuXHRcdHNwbGl0dmlldy5hZGRWaWV3KHZpZXcxLCAxNDIsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3MS5zaXplLCA5ODYsICdmaXJzdCB2aWV3IGlzIHN0cmV0Y2hlZCcpO1xuXG5cdFx0c3RvcmUuYWRkKHZpZXcyLm9uRGlkR2V0RWxlbWVudCgoKSA9PiB7XG5cdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHNwbGl0dmlldy5yZXNpemVWaWV3KDEsIDkyMikpO1xuXHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiBzcGxpdHZpZXcucmVzaXplVmlldygxLCA5MjIpKTtcblx0XHR9KSk7XG5cblx0XHRzcGxpdHZpZXcuYWRkVmlldyh2aWV3MiwgNjYsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCA2NiwgJ3NlY29uZCB2aWV3IGlzIGZpeGVkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXcxLnNpemUsIDk4NiAtIDY2LCAnZmlyc3QgdmlldyBpcyBjb2xsYXBzZWQnKTtcblxuXHRcdGNvbnN0IHZpZXdDb250YWluZXJzID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5zcGxpdC12aWV3LXZpZXcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld0NvbnRhaW5lcnMubGVuZ3RoLCAyLCAndGhlcmUgYXJlIHR3byB2aWV3IGNvbnRhaW5lcnMnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKHZpZXdDb250YWluZXJzLml0ZW0oMCkgYXMgSFRNTEVsZW1lbnQpLnN0eWxlLmhlaWdodCwgJzY2cHgnLCAnc2Vjb25kIHZpZXcgY29udGFpbmVyIGlzIDY2cHgnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWw8c3RyaW5nPigodmlld0NvbnRhaW5lcnMuaXRlbSgxKSBhcyBIVE1MRWxlbWVudCkuc3R5bGUuaGVpZ2h0LCBgJHs5ODYgLSA2Nn1weGAsICdmaXJzdCB2aWV3IGNvbnRhaW5lciBpcyA2NnB4Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2F1dG9tYXRpYyBzaXplIGRpc3RyaWJ1dGlvbicsICgpID0+IHtcblx0XHRjb25zdCB2aWV3MSA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoMjAsIE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkpO1xuXHRcdGNvbnN0IHZpZXcyID0gc3RvcmUuYWRkKG5ldyBUZXN0VmlldygyMCwgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKSk7XG5cdFx0Y29uc3QgdmlldzMgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDIwLCBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpKTtcblx0XHRjb25zdCBzcGxpdHZpZXcgPSBzdG9yZS5hZGQobmV3IFNwbGl0Vmlldyhjb250YWluZXIpKTtcblx0XHRzcGxpdHZpZXcubGF5b3V0KDIwMCk7XG5cblx0XHRzcGxpdHZpZXcuYWRkVmlldyh2aWV3MSwgU2l6aW5nLkRpc3RyaWJ1dGUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3MS5zaXplLCAyMDApO1xuXG5cdFx0c3BsaXR2aWV3LmFkZFZpZXcodmlldzIsIDUwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFt2aWV3MS5zaXplLCB2aWV3Mi5zaXplXSwgWzE1MCwgNTBdKTtcblxuXHRcdHNwbGl0dmlldy5hZGRWaWV3KHZpZXczLCBTaXppbmcuRGlzdHJpYnV0ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChbdmlldzEuc2l6ZSwgdmlldzIuc2l6ZSwgdmlldzMuc2l6ZV0sIFs2NiwgNjYsIDY4XSk7XG5cblx0XHRzcGxpdHZpZXcucmVtb3ZlVmlldygxLCBTaXppbmcuRGlzdHJpYnV0ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChbdmlldzEuc2l6ZSwgdmlldzMuc2l6ZV0sIFsxMDAsIDEwMF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdhZGQgdmlld3MgYmVmb3JlIGxheW91dCcsICgpID0+IHtcblx0XHRjb25zdCB2aWV3MSA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoMjAsIE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkpO1xuXHRcdGNvbnN0IHZpZXcyID0gc3RvcmUuYWRkKG5ldyBUZXN0VmlldygyMCwgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKSk7XG5cdFx0Y29uc3QgdmlldzMgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDIwLCBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpKTtcblx0XHRjb25zdCBzcGxpdHZpZXcgPSBzdG9yZS5hZGQobmV3IFNwbGl0Vmlldyhjb250YWluZXIpKTtcblxuXHRcdHNwbGl0dmlldy5hZGRWaWV3KHZpZXcxLCAxMDApO1xuXHRcdHNwbGl0dmlldy5hZGRWaWV3KHZpZXcyLCA3NSk7XG5cdFx0c3BsaXR2aWV3LmFkZFZpZXcodmlldzMsIDI1KTtcblxuXHRcdHNwbGl0dmlldy5sYXlvdXQoMjAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFt2aWV3MS5zaXplLCB2aWV3Mi5zaXplLCB2aWV3My5zaXplXSwgWzY3LCA2NywgNjZdKTtcblx0fSk7XG5cblx0dGVzdCgnc3BsaXQgc2l6aW5nJywgKCkgPT4ge1xuXHRcdGNvbnN0IHZpZXcxID0gc3RvcmUuYWRkKG5ldyBUZXN0VmlldygyMCwgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKSk7XG5cdFx0Y29uc3QgdmlldzIgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDIwLCBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpKTtcblx0XHRjb25zdCB2aWV3MyA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoMjAsIE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkpO1xuXHRcdGNvbnN0IHNwbGl0dmlldyA9IHN0b3JlLmFkZChuZXcgU3BsaXRWaWV3KGNvbnRhaW5lcikpO1xuXHRcdHNwbGl0dmlldy5sYXlvdXQoMjAwKTtcblxuXHRcdHNwbGl0dmlldy5hZGRWaWV3KHZpZXcxLCBTaXppbmcuRGlzdHJpYnV0ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXcxLnNpemUsIDIwMCk7XG5cblx0XHRzcGxpdHZpZXcuYWRkVmlldyh2aWV3MiwgU2l6aW5nLlNwbGl0KDApKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFt2aWV3MS5zaXplLCB2aWV3Mi5zaXplXSwgWzEwMCwgMTAwXSk7XG5cblx0XHRzcGxpdHZpZXcuYWRkVmlldyh2aWV3MywgU2l6aW5nLlNwbGl0KDEpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFt2aWV3MS5zaXplLCB2aWV3Mi5zaXplLCB2aWV3My5zaXplXSwgWzEwMCwgNTAsIDUwXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NwbGl0IHNpemluZyAyJywgKCkgPT4ge1xuXHRcdGNvbnN0IHZpZXcxID0gc3RvcmUuYWRkKG5ldyBUZXN0VmlldygyMCwgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKSk7XG5cdFx0Y29uc3QgdmlldzIgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDIwLCBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpKTtcblx0XHRjb25zdCB2aWV3MyA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoMjAsIE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkpO1xuXHRcdGNvbnN0IHNwbGl0dmlldyA9IHN0b3JlLmFkZChuZXcgU3BsaXRWaWV3KGNvbnRhaW5lcikpO1xuXHRcdHNwbGl0dmlldy5sYXlvdXQoMjAwKTtcblxuXHRcdHNwbGl0dmlldy5hZGRWaWV3KHZpZXcxLCBTaXppbmcuRGlzdHJpYnV0ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXcxLnNpemUsIDIwMCk7XG5cblx0XHRzcGxpdHZpZXcuYWRkVmlldyh2aWV3MiwgU2l6aW5nLlNwbGl0KDApKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFt2aWV3MS5zaXplLCB2aWV3Mi5zaXplXSwgWzEwMCwgMTAwXSk7XG5cblx0XHRzcGxpdHZpZXcuYWRkVmlldyh2aWV3MywgU2l6aW5nLlNwbGl0KDApKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFt2aWV3MS5zaXplLCB2aWV3Mi5zaXplLCB2aWV3My5zaXplXSwgWzUwLCAxMDAsIDUwXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Byb3BvcnRpb25hbCBsYXlvdXQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgdmlldzEgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDIwLCBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpKTtcblx0XHRjb25zdCB2aWV3MiA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoMjAsIE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkpO1xuXHRcdGNvbnN0IHNwbGl0dmlldyA9IHN0b3JlLmFkZChuZXcgU3BsaXRWaWV3KGNvbnRhaW5lcikpO1xuXHRcdHNwbGl0dmlldy5sYXlvdXQoMjAwKTtcblxuXHRcdHNwbGl0dmlldy5hZGRWaWV3KHZpZXcxLCBTaXppbmcuRGlzdHJpYnV0ZSk7XG5cdFx0c3BsaXR2aWV3LmFkZFZpZXcodmlldzIsIFNpemluZy5EaXN0cmlidXRlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFt2aWV3MS5zaXplLCB2aWV3Mi5zaXplXSwgWzEwMCwgMTAwXSk7XG5cblx0XHRzcGxpdHZpZXcubGF5b3V0KDEwMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChbdmlldzEuc2l6ZSwgdmlldzIuc2l6ZV0sIFs1MCwgNTBdKTtcblx0fSk7XG5cblx0dGVzdCgnZGlzYWJsZSBwcm9wb3J0aW9uYWwgbGF5b3V0JywgKCkgPT4ge1xuXHRcdGNvbnN0IHZpZXcxID0gc3RvcmUuYWRkKG5ldyBUZXN0VmlldygyMCwgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKSk7XG5cdFx0Y29uc3QgdmlldzIgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDIwLCBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpKTtcblx0XHRjb25zdCBzcGxpdHZpZXcgPSBzdG9yZS5hZGQobmV3IFNwbGl0Vmlldyhjb250YWluZXIsIHsgcHJvcG9ydGlvbmFsTGF5b3V0OiBmYWxzZSB9KSk7XG5cdFx0c3BsaXR2aWV3LmxheW91dCgyMDApO1xuXG5cdFx0c3BsaXR2aWV3LmFkZFZpZXcodmlldzEsIFNpemluZy5EaXN0cmlidXRlKTtcblx0XHRzcGxpdHZpZXcuYWRkVmlldyh2aWV3MiwgU2l6aW5nLkRpc3RyaWJ1dGUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoW3ZpZXcxLnNpemUsIHZpZXcyLnNpemVdLCBbMTAwLCAxMDBdKTtcblxuXHRcdHNwbGl0dmlldy5sYXlvdXQoMTAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFt2aWV3MS5zaXplLCB2aWV3Mi5zaXplXSwgWzgwLCAyMF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdoaWdoIGxheW91dCBwcmlvcml0eScsICgpID0+IHtcblx0XHRjb25zdCB2aWV3MSA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoMjAsIE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkpO1xuXHRcdGNvbnN0IHZpZXcyID0gc3RvcmUuYWRkKG5ldyBUZXN0VmlldygyMCwgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZLCBMYXlvdXRQcmlvcml0eS5IaWdoKSk7XG5cdFx0Y29uc3QgdmlldzMgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDIwLCBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpKTtcblx0XHRjb25zdCBzcGxpdHZpZXcgPSBzdG9yZS5hZGQobmV3IFNwbGl0Vmlldyhjb250YWluZXIsIHsgcHJvcG9ydGlvbmFsTGF5b3V0OiBmYWxzZSB9KSk7XG5cdFx0c3BsaXR2aWV3LmxheW91dCgyMDApO1xuXG5cdFx0c3BsaXR2aWV3LmFkZFZpZXcodmlldzEsIFNpemluZy5EaXN0cmlidXRlKTtcblx0XHRzcGxpdHZpZXcuYWRkVmlldyh2aWV3MiwgU2l6aW5nLkRpc3RyaWJ1dGUpO1xuXHRcdHNwbGl0dmlldy5hZGRWaWV3KHZpZXczLCBTaXppbmcuRGlzdHJpYnV0ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChbdmlldzEuc2l6ZSwgdmlldzIuc2l6ZSwgdmlldzMuc2l6ZV0sIFs2NiwgNjgsIDY2XSk7XG5cblx0XHRzcGxpdHZpZXcubGF5b3V0KDE4MCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChbdmlldzEuc2l6ZSwgdmlldzIuc2l6ZSwgdmlldzMuc2l6ZV0sIFs2NiwgNDgsIDY2XSk7XG5cblx0XHRzcGxpdHZpZXcubGF5b3V0KDEyNCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChbdmlldzEuc2l6ZSwgdmlldzIuc2l6ZSwgdmlldzMuc2l6ZV0sIFs2NiwgMjAsIDM4XSk7XG5cblx0XHRzcGxpdHZpZXcubGF5b3V0KDYwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFt2aWV3MS5zaXplLCB2aWV3Mi5zaXplLCB2aWV3My5zaXplXSwgWzIwLCAyMCwgMjBdKTtcblxuXHRcdHNwbGl0dmlldy5sYXlvdXQoMjAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFt2aWV3MS5zaXplLCB2aWV3Mi5zaXplLCB2aWV3My5zaXplXSwgWzIwLCAxNjAsIDIwXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xvdyBsYXlvdXQgcHJpb3JpdHknLCAoKSA9PiB7XG5cdFx0Y29uc3QgdmlldzEgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDIwLCBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpKTtcblx0XHRjb25zdCB2aWV3MiA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoMjAsIE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkpO1xuXHRcdGNvbnN0IHZpZXczID0gc3RvcmUuYWRkKG5ldyBUZXN0VmlldygyMCwgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZLCBMYXlvdXRQcmlvcml0eS5Mb3cpKTtcblx0XHRjb25zdCBzcGxpdHZpZXcgPSBzdG9yZS5hZGQobmV3IFNwbGl0Vmlldyhjb250YWluZXIsIHsgcHJvcG9ydGlvbmFsTGF5b3V0OiBmYWxzZSB9KSk7XG5cdFx0c3BsaXR2aWV3LmxheW91dCgyMDApO1xuXG5cdFx0c3BsaXR2aWV3LmFkZFZpZXcodmlldzEsIFNpemluZy5EaXN0cmlidXRlKTtcblx0XHRzcGxpdHZpZXcuYWRkVmlldyh2aWV3MiwgU2l6aW5nLkRpc3RyaWJ1dGUpO1xuXHRcdHNwbGl0dmlldy5hZGRWaWV3KHZpZXczLCBTaXppbmcuRGlzdHJpYnV0ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChbdmlldzEuc2l6ZSwgdmlldzIuc2l6ZSwgdmlldzMuc2l6ZV0sIFs2NiwgNjgsIDY2XSk7XG5cblx0XHRzcGxpdHZpZXcubGF5b3V0KDE4MCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChbdmlldzEuc2l6ZSwgdmlldzIuc2l6ZSwgdmlldzMuc2l6ZV0sIFs2NiwgNDgsIDY2XSk7XG5cblx0XHRzcGxpdHZpZXcubGF5b3V0KDEzMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChbdmlldzEuc2l6ZSwgdmlldzIuc2l6ZSwgdmlldzMuc2l6ZV0sIFs0NiwgMjAsIDY2XSk7XG5cblx0XHRzcGxpdHZpZXcubGF5b3V0KDYwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFt2aWV3MS5zaXplLCB2aWV3Mi5zaXplLCB2aWV3My5zaXplXSwgWzIwLCAyMCwgMjBdKTtcblxuXHRcdHNwbGl0dmlldy5sYXlvdXQoMjAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFt2aWV3MS5zaXplLCB2aWV3Mi5zaXplLCB2aWV3My5zaXplXSwgWzIwLCAxNjAsIDIwXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbnRleHQgcHJvcGFnYXRlcyB0byB2aWV3cycsICgpID0+IHtcblx0XHRjb25zdCB2aWV3MSA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoMjAsIE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkpO1xuXHRcdGNvbnN0IHZpZXcyID0gc3RvcmUuYWRkKG5ldyBUZXN0VmlldygyMCwgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKSk7XG5cdFx0Y29uc3QgdmlldzMgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDIwLCBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksIExheW91dFByaW9yaXR5LkxvdykpO1xuXHRcdGNvbnN0IHNwbGl0dmlldyA9IHN0b3JlLmFkZChuZXcgU3BsaXRWaWV3PG51bWJlcj4oY29udGFpbmVyLCB7IHByb3BvcnRpb25hbExheW91dDogZmFsc2UgfSkpO1xuXHRcdHNwbGl0dmlldy5sYXlvdXQoMjAwKTtcblxuXHRcdHNwbGl0dmlldy5hZGRWaWV3KHZpZXcxLCBTaXppbmcuRGlzdHJpYnV0ZSk7XG5cdFx0c3BsaXR2aWV3LmFkZFZpZXcodmlldzIsIFNpemluZy5EaXN0cmlidXRlKTtcblx0XHRzcGxpdHZpZXcuYWRkVmlldyh2aWV3MywgU2l6aW5nLkRpc3RyaWJ1dGUpO1xuXG5cdFx0c3BsaXR2aWV3LmxheW91dCgyMDAsIDEwMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChbdmlldzEub3J0aG9nb25hbFNpemUsIHZpZXcyLm9ydGhvZ29uYWxTaXplLCB2aWV3My5vcnRob2dvbmFsU2l6ZV0sIFsxMDAsIDEwMCwgMTAwXSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBZSxpQkFBaUI7QUFDaEMsU0FBZ0IsZ0JBQWdCLFFBQVEsaUJBQWlCO0FBQ3pELFNBQVMsZUFBZTtBQUN4QixTQUFTLCtDQUErQztBQUV4RCxNQUFNLFNBQWtDO0FBQUEsRUEyQnZDLFlBQ1MsY0FDQSxjQUNDLFdBQTJCLGVBQWUsUUFDbEQ7QUFITztBQUNBO0FBQ0M7QUE1QlYsU0FBaUIsZUFBZSxJQUFJLFFBQTRCO0FBQ2hFLFNBQVMsY0FBYyxLQUFLLGFBQWE7QUFRekMsU0FBUSxXQUF3QixTQUFTLGNBQWMsS0FBSztBQUc1RCxTQUFpQixtQkFBbUIsSUFBSSxRQUFjO0FBQ3RELFNBQVMsa0JBQWtCLEtBQUssaUJBQWlCO0FBRWpELFNBQVEsUUFBUTtBQUVoQixTQUFRLGtCQUFzQztBQUU5QyxTQUFpQixlQUFlLElBQUksUUFBOEQ7QUFDbEcsU0FBUyxjQUFjLEtBQUssYUFBYTtBQUV6QyxTQUFpQixjQUFjLElBQUksUUFBYztBQUNqRCxTQUFTLGFBQWEsS0FBSyxZQUFZO0FBT3RDLFdBQU8sZ0JBQWdCLGNBQWMs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
