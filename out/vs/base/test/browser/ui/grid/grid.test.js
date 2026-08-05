import assert from "assert";
import { createSerializedGrid, Direction, getRelativeLocation, Grid, isGridBranchNode, Orientation, sanitizeGridNodeDescriptor, SerializableGrid, Sizing } from "../../../../browser/ui/grid/grid.js";
import { Event } from "../../../../common/event.js";
import { deepClone } from "../../../../common/objects.js";
import { nodesToArrays, TestView } from "./util.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../common/utils.js";
suite("Grid", function() {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let container;
  setup(function() {
    container = document.createElement("div");
    container.style.position = "absolute";
    container.style.width = `${800}px`;
    container.style.height = `${600}px`;
  });
  test("getRelativeLocation", () => {
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [0], Direction.Up), [0]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [0], Direction.Down), [1]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [0], Direction.Left), [0, 0]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [0], Direction.Right), [0, 1]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.HORIZONTAL, [0], Direction.Up), [0, 0]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.HORIZONTAL, [0], Direction.Down), [0, 1]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.HORIZONTAL, [0], Direction.Left), [0]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.HORIZONTAL, [0], Direction.Right), [1]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [4], Direction.Up), [4]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [4], Direction.Down), [5]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [4], Direction.Left), [4, 0]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [4], Direction.Right), [4, 1]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [0, 0], Direction.Up), [0, 0, 0]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [0, 0], Direction.Down), [0, 0, 1]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [0, 0], Direction.Left), [0, 0]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [0, 0], Direction.Right), [0, 1]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [1, 2], Direction.Up), [1, 2, 0]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [1, 2], Direction.Down), [1, 2, 1]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [1, 2], Direction.Left), [1, 2]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [1, 2], Direction.Right), [1, 3]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [1, 2, 3], Direction.Up), [1, 2, 3]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [1, 2, 3], Direction.Down), [1, 2, 4]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [1, 2, 3], Direction.Left), [1, 2, 3, 0]);
    assert.deepStrictEqual(getRelativeLocation(Orientation.VERTICAL, [1, 2, 3], Direction.Right), [1, 2, 3, 1]);
  });
  test("empty", () => {
    const view1 = store.add(new TestView(100, Number.MAX_VALUE, 100, Number.MAX_VALUE));
    const gridview = store.add(new Grid(view1));
    container.appendChild(gridview.element);
    gridview.layout(800, 600);
    assert.deepStrictEqual(view1.size, [800, 600]);
  });
  test("two views vertically", function() {
    const view1 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new Grid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    assert.deepStrictEqual(view1.size, [800, 600]);
    const view2 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, 200, view1, Direction.Up);
    assert.deepStrictEqual(view1.size, [800, 400]);
    assert.deepStrictEqual(view2.size, [800, 200]);
  });
  test("two views horizontally", function() {
    const view1 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new Grid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    assert.deepStrictEqual(view1.size, [800, 600]);
    const view2 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, 300, view1, Direction.Right);
    assert.deepStrictEqual(view1.size, [500, 600]);
    assert.deepStrictEqual(view2.size, [300, 600]);
  });
  test("simple layout", function() {
    const view1 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new Grid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    assert.deepStrictEqual(view1.size, [800, 600]);
    const view2 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, 200, view1, Direction.Up);
    assert.deepStrictEqual(view1.size, [800, 400]);
    assert.deepStrictEqual(view2.size, [800, 200]);
    const view3 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, 200, view1, Direction.Right);
    assert.deepStrictEqual(view1.size, [600, 400]);
    assert.deepStrictEqual(view2.size, [800, 200]);
    assert.deepStrictEqual(view3.size, [200, 400]);
    const view4 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view4, 200, view2, Direction.Left);
    assert.deepStrictEqual(view1.size, [600, 400]);
    assert.deepStrictEqual(view2.size, [600, 200]);
    assert.deepStrictEqual(view3.size, [200, 400]);
    assert.deepStrictEqual(view4.size, [200, 200]);
    const view5 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view5, 100, view1, Direction.Down);
    assert.deepStrictEqual(view1.size, [600, 300]);
    assert.deepStrictEqual(view2.size, [600, 200]);
    assert.deepStrictEqual(view3.size, [200, 400]);
    assert.deepStrictEqual(view4.size, [200, 200]);
    assert.deepStrictEqual(view5.size, [600, 100]);
  });
  test("another simple layout with automatic size distribution", function() {
    const view1 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new Grid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    assert.deepStrictEqual(view1.size, [800, 600]);
    const view2 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, Sizing.Distribute, view1, Direction.Left);
    assert.deepStrictEqual(view1.size, [400, 600]);
    assert.deepStrictEqual(view2.size, [400, 600]);
    const view3 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, Sizing.Distribute, view1, Direction.Right);
    assert.deepStrictEqual(view1.size, [266, 600]);
    assert.deepStrictEqual(view2.size, [266, 600]);
    assert.deepStrictEqual(view3.size, [268, 600]);
    const view4 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view4, Sizing.Distribute, view2, Direction.Down);
    assert.deepStrictEqual(view1.size, [266, 600]);
    assert.deepStrictEqual(view2.size, [266, 300]);
    assert.deepStrictEqual(view3.size, [268, 600]);
    assert.deepStrictEqual(view4.size, [266, 300]);
    const view5 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view5, Sizing.Distribute, view3, Direction.Up);
    assert.deepStrictEqual(view1.size, [266, 600]);
    assert.deepStrictEqual(view2.size, [266, 300]);
    assert.deepStrictEqual(view3.size, [268, 300]);
    assert.deepStrictEqual(view4.size, [266, 300]);
    assert.deepStrictEqual(view5.size, [268, 300]);
    const view6 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view6, Sizing.Distribute, view3, Direction.Down);
    assert.deepStrictEqual(view1.size, [266, 600]);
    assert.deepStrictEqual(view2.size, [266, 300]);
    assert.deepStrictEqual(view3.size, [268, 200]);
    assert.deepStrictEqual(view4.size, [266, 300]);
    assert.deepStrictEqual(view5.size, [268, 200]);
    assert.deepStrictEqual(view6.size, [268, 200]);
  });
  test("another simple layout with split size distribution", function() {
    const view1 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new Grid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    assert.deepStrictEqual(view1.size, [800, 600]);
    const view2 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, Sizing.Split, view1, Direction.Left);
    assert.deepStrictEqual(view1.size, [400, 600]);
    assert.deepStrictEqual(view2.size, [400, 600]);
    const view3 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, Sizing.Split, view1, Direction.Right);
    assert.deepStrictEqual(view1.size, [200, 600]);
    assert.deepStrictEqual(view2.size, [400, 600]);
    assert.deepStrictEqual(view3.size, [200, 600]);
    const view4 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view4, Sizing.Split, view2, Direction.Down);
    assert.deepStrictEqual(view1.size, [200, 600]);
    assert.deepStrictEqual(view2.size, [400, 300]);
    assert.deepStrictEqual(view3.size, [200, 600]);
    assert.deepStrictEqual(view4.size, [400, 300]);
    const view5 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view5, Sizing.Split, view3, Direction.Up);
    assert.deepStrictEqual(view1.size, [200, 600]);
    assert.deepStrictEqual(view2.size, [400, 300]);
    assert.deepStrictEqual(view3.size, [200, 300]);
    assert.deepStrictEqual(view4.size, [400, 300]);
    assert.deepStrictEqual(view5.size, [200, 300]);
    const view6 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view6, Sizing.Split, view3, Direction.Down);
    assert.deepStrictEqual(view1.size, [200, 600]);
    assert.deepStrictEqual(view2.size, [400, 300]);
    assert.deepStrictEqual(view3.size, [200, 150]);
    assert.deepStrictEqual(view4.size, [400, 300]);
    assert.deepStrictEqual(view5.size, [200, 300]);
    assert.deepStrictEqual(view6.size, [200, 150]);
  });
  test("3/2 layout with split", function() {
    const view1 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new Grid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    assert.deepStrictEqual(view1.size, [800, 600]);
    const view2 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, Sizing.Split, view1, Direction.Down);
    assert.deepStrictEqual(view1.size, [800, 300]);
    assert.deepStrictEqual(view2.size, [800, 300]);
    const view3 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, Sizing.Split, view2, Direction.Right);
    assert.deepStrictEqual(view1.size, [800, 300]);
    assert.deepStrictEqual(view2.size, [400, 300]);
    assert.deepStrictEqual(view3.size, [400, 300]);
    const view4 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view4, Sizing.Split, view1, Direction.Right);
    assert.deepStrictEqual(view1.size, [400, 300]);
    assert.deepStrictEqual(view2.size, [400, 300]);
    assert.deepStrictEqual(view3.size, [400, 300]);
    assert.deepStrictEqual(view4.size, [400, 300]);
    const view5 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view5, Sizing.Split, view1, Direction.Right);
    assert.deepStrictEqual(view1.size, [200, 300]);
    assert.deepStrictEqual(view2.size, [400, 300]);
    assert.deepStrictEqual(view3.size, [400, 300]);
    assert.deepStrictEqual(view4.size, [400, 300]);
    assert.deepStrictEqual(view5.size, [200, 300]);
  });
  test("sizing should be correct after branch demotion #50564", function() {
    const view1 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new Grid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const view2 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, Sizing.Split, view1, Direction.Right);
    const view3 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, Sizing.Split, view2, Direction.Down);
    const view4 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view4, Sizing.Split, view2, Direction.Right);
    assert.deepStrictEqual(view1.size, [400, 600]);
    assert.deepStrictEqual(view2.size, [200, 300]);
    assert.deepStrictEqual(view3.size, [400, 300]);
    assert.deepStrictEqual(view4.size, [200, 300]);
    grid.removeView(view3);
    assert.deepStrictEqual(view1.size, [400, 600]);
    assert.deepStrictEqual(view2.size, [200, 600]);
    assert.deepStrictEqual(view4.size, [200, 600]);
  });
  test("sizing should be correct after branch demotion #50675", function() {
    const view1 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new Grid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const view2 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, Sizing.Distribute, view1, Direction.Down);
    const view3 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, Sizing.Distribute, view2, Direction.Down);
    const view4 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view4, Sizing.Distribute, view3, Direction.Right);
    assert.deepStrictEqual(view1.size, [800, 200]);
    assert.deepStrictEqual(view2.size, [800, 200]);
    assert.deepStrictEqual(view3.size, [400, 200]);
    assert.deepStrictEqual(view4.size, [400, 200]);
    grid.removeView(view3, Sizing.Distribute);
    assert.deepStrictEqual(view1.size, [800, 200]);
    assert.deepStrictEqual(view2.size, [800, 200]);
    assert.deepStrictEqual(view4.size, [800, 200]);
  });
  test("getNeighborViews should work on single view layout", function() {
    const view1 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new Grid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Up), []);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Right), []);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Down), []);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Left), []);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Up, true), [view1]);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Right, true), [view1]);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Down, true), [view1]);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Left, true), [view1]);
  });
  test("getNeighborViews should work on simple layout", function() {
    const view1 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new Grid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const view2 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, Sizing.Distribute, view1, Direction.Down);
    const view3 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, Sizing.Distribute, view2, Direction.Down);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Up), []);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Right), []);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Down), [view2]);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Left), []);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Up, true), [view3]);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Right, true), [view1]);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Down, true), [view2]);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Left, true), [view1]);
    assert.deepStrictEqual(grid.getNeighborViews(view2, Direction.Up), [view1]);
    assert.deepStrictEqual(grid.getNeighborViews(view2, Direction.Right), []);
    assert.deepStrictEqual(grid.getNeighborViews(view2, Direction.Down), [view3]);
    assert.deepStrictEqual(grid.getNeighborViews(view2, Direction.Left), []);
    assert.deepStrictEqual(grid.getNeighborViews(view2, Direction.Up, true), [view1]);
    assert.deepStrictEqual(grid.getNeighborViews(view2, Direction.Right, true), [view2]);
    assert.deepStrictEqual(grid.getNeighborViews(view2, Direction.Down, true), [view3]);
    assert.deepStrictEqual(grid.getNeighborViews(view2, Direction.Left, true), [view2]);
    assert.deepStrictEqual(grid.getNeighborViews(view3, Direction.Up), [view2]);
    assert.deepStrictEqual(grid.getNeighborViews(view3, Direction.Right), []);
    assert.deepStrictEqual(grid.getNeighborViews(view3, Direction.Down), []);
    assert.deepStrictEqual(grid.getNeighborViews(view3, Direction.Left), []);
    assert.deepStrictEqual(grid.getNeighborViews(view3, Direction.Up, true), [view2]);
    assert.deepStrictEqual(grid.getNeighborViews(view3, Direction.Right, true), [view3]);
    assert.deepStrictEqual(grid.getNeighborViews(view3, Direction.Down, true), [view1]);
    assert.deepStrictEqual(grid.getNeighborViews(view3, Direction.Left, true), [view3]);
  });
  test("getNeighborViews should work on a complex layout", function() {
    const view1 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new Grid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const view2 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, Sizing.Distribute, view1, Direction.Down);
    const view3 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, Sizing.Distribute, view2, Direction.Down);
    const view4 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view4, Sizing.Distribute, view2, Direction.Right);
    const view5 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view5, Sizing.Distribute, view4, Direction.Down);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Up), []);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Right), []);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Down), [view2, view4]);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Left), []);
    assert.deepStrictEqual(grid.getNeighborViews(view2, Direction.Up), [view1]);
    assert.deepStrictEqual(grid.getNeighborViews(view2, Direction.Right), [view4, view5]);
    assert.deepStrictEqual(grid.getNeighborViews(view2, Direction.Down), [view3]);
    assert.deepStrictEqual(grid.getNeighborViews(view2, Direction.Left), []);
    assert.deepStrictEqual(grid.getNeighborViews(view4, Direction.Up), [view1]);
    assert.deepStrictEqual(grid.getNeighborViews(view4, Direction.Right), []);
    assert.deepStrictEqual(grid.getNeighborViews(view4, Direction.Down), [view5]);
    assert.deepStrictEqual(grid.getNeighborViews(view4, Direction.Left), [view2]);
    assert.deepStrictEqual(grid.getNeighborViews(view5, Direction.Up), [view4]);
    assert.deepStrictEqual(grid.getNeighborViews(view5, Direction.Right), []);
    assert.deepStrictEqual(grid.getNeighborViews(view5, Direction.Down), [view3]);
    assert.deepStrictEqual(grid.getNeighborViews(view5, Direction.Left), [view2]);
    assert.deepStrictEqual(grid.getNeighborViews(view3, Direction.Up), [view2, view5]);
    assert.deepStrictEqual(grid.getNeighborViews(view3, Direction.Right), []);
    assert.deepStrictEqual(grid.getNeighborViews(view3, Direction.Down), []);
    assert.deepStrictEqual(grid.getNeighborViews(view3, Direction.Left), []);
  });
  test("getNeighborViews should work on another simple layout", function() {
    const view1 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new Grid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const view2 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, Sizing.Distribute, view1, Direction.Right);
    const view3 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, Sizing.Distribute, view2, Direction.Down);
    const view4 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view4, Sizing.Distribute, view2, Direction.Right);
    assert.deepStrictEqual(grid.getNeighborViews(view4, Direction.Up), []);
    assert.deepStrictEqual(grid.getNeighborViews(view4, Direction.Right), []);
    assert.deepStrictEqual(grid.getNeighborViews(view4, Direction.Down), [view3]);
    assert.deepStrictEqual(grid.getNeighborViews(view4, Direction.Left), [view2]);
  });
  test("getNeighborViews should only return immediate neighbors", function() {
    const view1 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new Grid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const view2 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, Sizing.Distribute, view1, Direction.Right);
    const view3 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, Sizing.Distribute, view2, Direction.Down);
    const view4 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view4, Sizing.Distribute, view2, Direction.Right);
    assert.deepStrictEqual(grid.getNeighborViews(view1, Direction.Right), [view2, view3]);
  });
  test("hiding splitviews and restoring sizes", function() {
    const view1 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new Grid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const view2 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, Sizing.Distribute, view1, Direction.Right);
    const view3 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, Sizing.Distribute, view2, Direction.Down);
    const view4 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view4, Sizing.Distribute, view2, Direction.Right);
    const size1 = view1.size;
    const size2 = view2.size;
    const size3 = view3.size;
    const size4 = view4.size;
    grid.maximizeView(view1);
    assert.deepStrictEqual(view1.size, [800, 600]);
    assert.deepStrictEqual(view2.size, [0, 0]);
    assert.deepStrictEqual(view3.size, [0, 0]);
    assert.deepStrictEqual(view4.size, [0, 0]);
    grid.exitMaximizedView();
    assert.deepStrictEqual(view1.size, size1);
    assert.deepStrictEqual(view2.size, size2);
    assert.deepStrictEqual(view3.size, size3);
    assert.deepStrictEqual(view4.size, size4);
    grid.maximizeView(view2);
    assert.deepStrictEqual(view1.size, [0, 600]);
    assert.deepStrictEqual(view2.size, [800, 600]);
    assert.deepStrictEqual(view3.size, [800, 0]);
    assert.deepStrictEqual(view4.size, [0, 600]);
    grid.exitMaximizedView();
    assert.deepStrictEqual(view1.size, size1);
    assert.deepStrictEqual(view2.size, size2);
    assert.deepStrictEqual(view3.size, size3);
    assert.deepStrictEqual(view4.size, size4);
  });
  test("hasMaximizedView", function() {
    const view1 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new Grid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const view2 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, Sizing.Distribute, view1, Direction.Right);
    const view3 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, Sizing.Distribute, view2, Direction.Down);
    const view4 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view4, Sizing.Distribute, view2, Direction.Right);
    function checkIsMaximized(view) {
      grid.maximizeView(view);
      assert.deepStrictEqual(grid.hasMaximizedView(), true);
      assert.deepStrictEqual(grid.isViewExpanded(view1), false);
      assert.deepStrictEqual(grid.isViewExpanded(view2), false);
      assert.deepStrictEqual(grid.isViewExpanded(view3), false);
      assert.deepStrictEqual(grid.isViewExpanded(view4), false);
      grid.exitMaximizedView();
      assert.deepStrictEqual(grid.hasMaximizedView(), false);
    }
    checkIsMaximized(view1);
    checkIsMaximized(view2);
    checkIsMaximized(view3);
    checkIsMaximized(view4);
  });
  test("Changes to the grid unmaximize the view", function() {
    const view1 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new Grid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const view2 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, Sizing.Distribute, view1, Direction.Right);
    const view3 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, Sizing.Distribute, view2, Direction.Down);
    const view4 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.maximizeView(view1);
    assert.deepStrictEqual(grid.hasMaximizedView(), true);
    grid.addView(view4, Sizing.Distribute, view2, Direction.Right);
    assert.deepStrictEqual(grid.hasMaximizedView(), false);
    assert.deepStrictEqual(grid.isViewVisible(view1), true);
    assert.deepStrictEqual(grid.isViewVisible(view2), true);
    assert.deepStrictEqual(grid.isViewVisible(view3), true);
    assert.deepStrictEqual(grid.isViewVisible(view4), true);
    grid.maximizeView(view1);
    assert.deepStrictEqual(grid.hasMaximizedView(), true);
    grid.removeView(view4);
    assert.deepStrictEqual(grid.hasMaximizedView(), false);
    assert.deepStrictEqual(grid.isViewVisible(view1), true);
    assert.deepStrictEqual(grid.isViewVisible(view2), true);
    assert.deepStrictEqual(grid.isViewVisible(view3), true);
    grid.maximizeView(view1);
    assert.deepStrictEqual(grid.hasMaximizedView(), true);
    grid.setViewVisible(view3, true);
    assert.deepStrictEqual(grid.hasMaximizedView(), false);
    assert.deepStrictEqual(grid.isViewVisible(view1), true);
    assert.deepStrictEqual(grid.isViewVisible(view2), true);
    assert.deepStrictEqual(grid.isViewVisible(view3), true);
  });
  test("Changes to the grid sizing unmaximize the view", function() {
    const view1 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new Grid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const view2 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, Sizing.Distribute, view1, Direction.Right);
    const view3 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, Sizing.Distribute, view2, Direction.Down);
    const view4 = store.add(new TestView(50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view4, Sizing.Distribute, view2, Direction.Right);
    grid.maximizeView(view1);
    assert.deepStrictEqual(grid.hasMaximizedView(), true);
    grid.maximizeView(view2);
    assert.deepStrictEqual(grid.hasMaximizedView(), true);
    assert.deepStrictEqual(grid.isViewVisible(view1), false);
    assert.deepStrictEqual(grid.isViewVisible(view2), true);
    assert.deepStrictEqual(grid.isViewVisible(view3), false);
    assert.deepStrictEqual(grid.isViewVisible(view4), false);
    grid.maximizeView(view1);
    assert.deepStrictEqual(grid.hasMaximizedView(), true);
    grid.distributeViewSizes();
    assert.deepStrictEqual(grid.hasMaximizedView(), false);
    assert.deepStrictEqual(grid.isViewVisible(view1), true);
    assert.deepStrictEqual(grid.isViewVisible(view2), true);
    assert.deepStrictEqual(grid.isViewVisible(view3), true);
    assert.deepStrictEqual(grid.isViewVisible(view4), true);
    grid.maximizeView(view1);
    assert.deepStrictEqual(grid.hasMaximizedView(), true);
    grid.expandView(view2);
    assert.deepStrictEqual(grid.hasMaximizedView(), false);
    assert.deepStrictEqual(grid.isViewVisible(view1), true);
    assert.deepStrictEqual(grid.isViewVisible(view2), true);
    assert.deepStrictEqual(grid.isViewVisible(view3), true);
    assert.deepStrictEqual(grid.isViewVisible(view4), true);
    grid.maximizeView(view1);
    assert.deepStrictEqual(grid.hasMaximizedView(), true);
    grid.expandView(view1);
    assert.deepStrictEqual(grid.hasMaximizedView(), false);
    assert.deepStrictEqual(grid.isViewVisible(view1), true);
    assert.deepStrictEqual(grid.isViewVisible(view2), true);
    assert.deepStrictEqual(grid.isViewVisible(view3), true);
    assert.deepStrictEqual(grid.isViewVisible(view4), true);
  });
});
class TestSerializableView extends TestView {
  constructor(name, minimumWidth, maximumWidth, minimumHeight, maximumHeight) {
    super(minimumWidth, maximumWidth, minimumHeight, maximumHeight);
    this.name = name;
  }
  toJSON() {
    return { name: this.name };
  }
}
class TestViewDeserializer {
  constructor(store) {
    this.store = store;
    this.views = /* @__PURE__ */ new Map();
  }
  fromJSON(json) {
    const view = this.store.add(new TestSerializableView(json.name, 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    this.views.set(json.name, view);
    return view;
  }
  getView(id) {
    const view = this.views.get(id);
    if (!view) {
      throw new Error("Unknown view");
    }
    return view;
  }
}
function nodesToNames(node) {
  if (isGridBranchNode(node)) {
    return node.children.map(nodesToNames);
  } else {
    return node.view.name;
  }
}
suite("SerializableGrid", function() {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let container;
  setup(function() {
    container = document.createElement("div");
    container.style.position = "absolute";
    container.style.width = `${800}px`;
    container.style.height = `${600}px`;
  });
  test("serialize empty", function() {
    const view1 = store.add(new TestSerializableView("view1", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new SerializableGrid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const actual = grid.serialize();
    assert.deepStrictEqual(actual, {
      orientation: 0,
      width: 800,
      height: 600,
      root: {
        type: "branch",
        data: [
          {
            type: "leaf",
            data: {
              name: "view1"
            },
            size: 600
          }
        ],
        size: 800
      }
    });
  });
  test("serialize simple layout", function() {
    const view1 = store.add(new TestSerializableView("view1", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new SerializableGrid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const view2 = store.add(new TestSerializableView("view2", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, 200, view1, Direction.Up);
    const view3 = store.add(new TestSerializableView("view3", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, 200, view1, Direction.Right);
    const view4 = store.add(new TestSerializableView("view4", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view4, 200, view2, Direction.Left);
    const view5 = store.add(new TestSerializableView("view5", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view5, 100, view1, Direction.Down);
    assert.deepStrictEqual(grid.serialize(), {
      orientation: 0,
      width: 800,
      height: 600,
      root: {
        type: "branch",
        data: [
          {
            type: "branch",
            data: [
              { type: "leaf", data: { name: "view4" }, size: 200 },
              { type: "leaf", data: { name: "view2" }, size: 600 }
            ],
            size: 200
          },
          {
            type: "branch",
            data: [
              {
                type: "branch",
                data: [
                  { type: "leaf", data: { name: "view1" }, size: 300 },
                  { type: "leaf", data: { name: "view5" }, size: 100 }
                ],
                size: 600
              },
              { type: "leaf", data: { name: "view3" }, size: 200 }
            ],
            size: 400
          }
        ],
        size: 800
      }
    });
  });
  test("deserialize empty", function() {
    const view1 = store.add(new TestSerializableView("view1", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new SerializableGrid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const json = grid.serialize();
    grid.dispose();
    const deserializer = new TestViewDeserializer(store);
    const grid2 = store.add(SerializableGrid.deserialize(json, deserializer));
    grid2.layout(800, 600);
    assert.deepStrictEqual(nodesToNames(grid2.getViews()), ["view1"]);
  });
  test("deserialize simple layout", function() {
    const view1 = store.add(new TestSerializableView("view1", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new SerializableGrid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const view2 = store.add(new TestSerializableView("view2", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, 200, view1, Direction.Up);
    const view3 = store.add(new TestSerializableView("view3", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, 200, view1, Direction.Right);
    const view4 = store.add(new TestSerializableView("view4", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view4, 200, view2, Direction.Left);
    const view5 = store.add(new TestSerializableView("view5", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view5, 100, view1, Direction.Down);
    const json = grid.serialize();
    grid.dispose();
    const deserializer = new TestViewDeserializer(store);
    const grid2 = store.add(SerializableGrid.deserialize(json, deserializer));
    const view1Copy = deserializer.getView("view1");
    const view2Copy = deserializer.getView("view2");
    const view3Copy = deserializer.getView("view3");
    const view4Copy = deserializer.getView("view4");
    const view5Copy = deserializer.getView("view5");
    assert.deepStrictEqual(nodesToArrays(grid2.getViews()), [[view4Copy, view2Copy], [[view1Copy, view5Copy], view3Copy]]);
    grid2.layout(800, 600);
    assert.deepStrictEqual(view1Copy.size, [600, 300]);
    assert.deepStrictEqual(view2Copy.size, [600, 200]);
    assert.deepStrictEqual(view3Copy.size, [200, 400]);
    assert.deepStrictEqual(view4Copy.size, [200, 200]);
    assert.deepStrictEqual(view5Copy.size, [600, 100]);
  });
  test("deserialize simple layout with scaling", function() {
    const view1 = store.add(new TestSerializableView("view1", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new SerializableGrid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const view2 = store.add(new TestSerializableView("view2", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, 200, view1, Direction.Up);
    const view3 = store.add(new TestSerializableView("view3", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, 200, view1, Direction.Right);
    const view4 = store.add(new TestSerializableView("view4", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view4, 200, view2, Direction.Left);
    const view5 = store.add(new TestSerializableView("view5", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view5, 100, view1, Direction.Down);
    const json = grid.serialize();
    grid.dispose();
    const deserializer = new TestViewDeserializer(store);
    const grid2 = store.add(SerializableGrid.deserialize(json, deserializer));
    const view1Copy = deserializer.getView("view1");
    const view2Copy = deserializer.getView("view2");
    const view3Copy = deserializer.getView("view3");
    const view4Copy = deserializer.getView("view4");
    const view5Copy = deserializer.getView("view5");
    grid2.layout(400, 800);
    assert.deepStrictEqual(view1Copy.size, [300, 400]);
    assert.deepStrictEqual(view2Copy.size, [300, 267]);
    assert.deepStrictEqual(view3Copy.size, [100, 533]);
    assert.deepStrictEqual(view4Copy.size, [100, 267]);
    assert.deepStrictEqual(view5Copy.size, [300, 133]);
  });
  test("deserialize 4 view layout (ben issue #2)", function() {
    const view1 = store.add(new TestSerializableView("view1", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new SerializableGrid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const view2 = store.add(new TestSerializableView("view2", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, Sizing.Split, view1, Direction.Down);
    const view3 = store.add(new TestSerializableView("view3", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, Sizing.Split, view2, Direction.Down);
    const view4 = store.add(new TestSerializableView("view4", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view4, Sizing.Split, view3, Direction.Right);
    const json = grid.serialize();
    grid.dispose();
    const deserializer = new TestViewDeserializer(store);
    const grid2 = store.add(SerializableGrid.deserialize(json, deserializer));
    const view1Copy = deserializer.getView("view1");
    const view2Copy = deserializer.getView("view2");
    const view3Copy = deserializer.getView("view3");
    const view4Copy = deserializer.getView("view4");
    grid2.layout(800, 600);
    assert.deepStrictEqual(view1Copy.size, [800, 300]);
    assert.deepStrictEqual(view2Copy.size, [800, 150]);
    assert.deepStrictEqual(view3Copy.size, [400, 150]);
    assert.deepStrictEqual(view4Copy.size, [400, 150]);
  });
  test("deserialize 2 view layout (ben issue #3)", function() {
    const view1 = store.add(new TestSerializableView("view1", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new SerializableGrid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const view2 = store.add(new TestSerializableView("view2", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, Sizing.Split, view1, Direction.Right);
    const json = grid.serialize();
    grid.dispose();
    const deserializer = new TestViewDeserializer(store);
    const grid2 = store.add(SerializableGrid.deserialize(json, deserializer));
    const view1Copy = deserializer.getView("view1");
    const view2Copy = deserializer.getView("view2");
    grid2.layout(800, 600);
    assert.deepStrictEqual(view1Copy.size, [400, 600]);
    assert.deepStrictEqual(view2Copy.size, [400, 600]);
  });
  test("deserialize simple view layout #50609", function() {
    const view1 = store.add(new TestSerializableView("view1", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new SerializableGrid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const view2 = store.add(new TestSerializableView("view2", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, Sizing.Split, view1, Direction.Right);
    const view3 = store.add(new TestSerializableView("view3", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, Sizing.Split, view2, Direction.Down);
    grid.removeView(view1, Sizing.Split);
    const json = grid.serialize();
    grid.dispose();
    const deserializer = new TestViewDeserializer(store);
    const grid2 = store.add(SerializableGrid.deserialize(json, deserializer));
    const view2Copy = deserializer.getView("view2");
    const view3Copy = deserializer.getView("view3");
    grid2.layout(800, 600);
    assert.deepStrictEqual(view2Copy.size, [800, 300]);
    assert.deepStrictEqual(view3Copy.size, [800, 300]);
  });
  test("sanitizeGridNodeDescriptor", () => {
    const nodeDescriptor = { groups: [{ size: 0.2 }, { size: 0.2 }, { size: 0.6, groups: [{}, {}] }] };
    const nodeDescriptorCopy = deepClone(nodeDescriptor);
    sanitizeGridNodeDescriptor(nodeDescriptorCopy, true);
    assert.deepStrictEqual(nodeDescriptorCopy, { groups: [{ size: 0.2 }, { size: 0.2 }, { size: 0.6, groups: [{ size: 0.5 }, { size: 0.5 }] }] });
  });
  test("createSerializedGrid", () => {
    const gridDescriptor = { orientation: Orientation.VERTICAL, groups: [{ size: 0.2, data: "a" }, { size: 0.2, data: "b" }, { size: 0.6, groups: [{ data: "c" }, { data: "d" }] }] };
    const serializedGrid = createSerializedGrid(gridDescriptor);
    assert.deepStrictEqual(serializedGrid, {
      root: {
        type: "branch",
        size: void 0,
        data: [
          { type: "leaf", size: 0.2, data: "a" },
          { type: "leaf", size: 0.2, data: "b" },
          {
            type: "branch",
            size: 0.6,
            data: [
              { type: "leaf", size: 0.5, data: "c" },
              { type: "leaf", size: 0.5, data: "d" }
            ]
          }
        ]
      },
      orientation: Orientation.VERTICAL,
      width: 1,
      height: 1
    });
  });
  test("createSerializedGrid - issue #85601, should not allow single children groups", () => {
    const serializedGrid = createSerializedGrid({ orientation: Orientation.HORIZONTAL, groups: [{ groups: [{}, {}], size: 0.5 }, { groups: [{}], size: 0.5 }] });
    const views = [];
    const deserializer = new class {
      fromJSON() {
        const view = {
          element: document.createElement("div"),
          layout: () => null,
          minimumWidth: 0,
          maximumWidth: Number.POSITIVE_INFINITY,
          minimumHeight: 0,
          maximumHeight: Number.POSITIVE_INFINITY,
          onDidChange: Event.None,
          toJSON: () => ({})
        };
        views.push(view);
        return view;
      }
    }();
    const grid = store.add(SerializableGrid.deserialize(serializedGrid, deserializer));
    assert.strictEqual(views.length, 3);
    grid.removeView(views[2]);
  });
  test("from", () => {
    const createView = () => ({
      element: document.createElement("div"),
      layout: () => null,
      minimumWidth: 0,
      maximumWidth: Number.POSITIVE_INFINITY,
      minimumHeight: 0,
      maximumHeight: Number.POSITIVE_INFINITY,
      onDidChange: Event.None,
      toJSON: () => ({})
    });
    const a = createView();
    const b = createView();
    const c = createView();
    const d = createView();
    const gridDescriptor = { orientation: Orientation.VERTICAL, groups: [{ size: 0.2, data: a }, { size: 0.2, data: b }, { size: 0.6, groups: [{ data: c }, { data: d }] }] };
    const grid = SerializableGrid.from(gridDescriptor);
    assert.deepStrictEqual(nodesToArrays(grid.getViews()), [a, b, [c, d]]);
    grid.dispose();
  });
  test("serialize should store visibility and previous size", function() {
    const view1 = store.add(new TestSerializableView("view1", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new SerializableGrid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const view2 = store.add(new TestSerializableView("view2", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, 200, view1, Direction.Up);
    const view3 = store.add(new TestSerializableView("view3", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, 200, view1, Direction.Right);
    const view4 = store.add(new TestSerializableView("view4", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view4, 200, view2, Direction.Left);
    const view5 = store.add(new TestSerializableView("view5", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view5, 100, view1, Direction.Down);
    assert.deepStrictEqual(view1.size, [600, 300]);
    assert.deepStrictEqual(view2.size, [600, 200]);
    assert.deepStrictEqual(view3.size, [200, 400]);
    assert.deepStrictEqual(view4.size, [200, 200]);
    assert.deepStrictEqual(view5.size, [600, 100]);
    grid.setViewVisible(view5, false);
    assert.deepStrictEqual(view1.size, [600, 400]);
    assert.deepStrictEqual(view2.size, [600, 200]);
    assert.deepStrictEqual(view3.size, [200, 400]);
    assert.deepStrictEqual(view4.size, [200, 200]);
    assert.deepStrictEqual(view5.size, [600, 0]);
    grid.setViewVisible(view5, true);
    assert.deepStrictEqual(view1.size, [600, 300]);
    assert.deepStrictEqual(view2.size, [600, 200]);
    assert.deepStrictEqual(view3.size, [200, 400]);
    assert.deepStrictEqual(view4.size, [200, 200]);
    assert.deepStrictEqual(view5.size, [600, 100]);
    grid.setViewVisible(view5, false);
    assert.deepStrictEqual(view1.size, [600, 400]);
    assert.deepStrictEqual(view2.size, [600, 200]);
    assert.deepStrictEqual(view3.size, [200, 400]);
    assert.deepStrictEqual(view4.size, [200, 200]);
    assert.deepStrictEqual(view5.size, [600, 0]);
    grid.setViewVisible(view5, false);
    const json = grid.serialize();
    assert.deepStrictEqual(json, {
      orientation: 0,
      width: 800,
      height: 600,
      root: {
        type: "branch",
        data: [
          {
            type: "branch",
            data: [
              { type: "leaf", data: { name: "view4" }, size: 200 },
              { type: "leaf", data: { name: "view2" }, size: 600 }
            ],
            size: 200
          },
          {
            type: "branch",
            data: [
              {
                type: "branch",
                data: [
                  { type: "leaf", data: { name: "view1" }, size: 400 },
                  { type: "leaf", data: { name: "view5" }, size: 100, visible: false }
                ],
                size: 600
              },
              { type: "leaf", data: { name: "view3" }, size: 200 }
            ],
            size: 400
          }
        ],
        size: 800
      }
    });
    grid.dispose();
    const deserializer = new TestViewDeserializer(store);
    const grid2 = store.add(SerializableGrid.deserialize(json, deserializer));
    const view1Copy = deserializer.getView("view1");
    const view2Copy = deserializer.getView("view2");
    const view3Copy = deserializer.getView("view3");
    const view4Copy = deserializer.getView("view4");
    const view5Copy = deserializer.getView("view5");
    assert.deepStrictEqual(nodesToArrays(grid2.getViews()), [[view4Copy, view2Copy], [[view1Copy, view5Copy], view3Copy]]);
    grid2.layout(800, 600);
    assert.deepStrictEqual(view1Copy.size, [600, 400]);
    assert.deepStrictEqual(view2Copy.size, [600, 200]);
    assert.deepStrictEqual(view3Copy.size, [200, 400]);
    assert.deepStrictEqual(view4Copy.size, [200, 200]);
    assert.deepStrictEqual(view5Copy.size, [600, 0]);
    assert.deepStrictEqual(grid2.isViewVisible(view1Copy), true);
    assert.deepStrictEqual(grid2.isViewVisible(view2Copy), true);
    assert.deepStrictEqual(grid2.isViewVisible(view3Copy), true);
    assert.deepStrictEqual(grid2.isViewVisible(view4Copy), true);
    assert.deepStrictEqual(grid2.isViewVisible(view5Copy), false);
    grid2.setViewVisible(view5Copy, true);
    assert.deepStrictEqual(view1Copy.size, [600, 300]);
    assert.deepStrictEqual(view2Copy.size, [600, 200]);
    assert.deepStrictEqual(view3Copy.size, [200, 400]);
    assert.deepStrictEqual(view4Copy.size, [200, 200]);
    assert.deepStrictEqual(view5Copy.size, [600, 100]);
    assert.deepStrictEqual(grid2.isViewVisible(view1Copy), true);
    assert.deepStrictEqual(grid2.isViewVisible(view2Copy), true);
    assert.deepStrictEqual(grid2.isViewVisible(view3Copy), true);
    assert.deepStrictEqual(grid2.isViewVisible(view4Copy), true);
    assert.deepStrictEqual(grid2.isViewVisible(view5Copy), true);
  });
  test("serialize should store visibility and previous size even for first leaf", function() {
    const view1 = store.add(new TestSerializableView("view1", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    const grid = store.add(new SerializableGrid(view1));
    container.appendChild(grid.element);
    grid.layout(800, 600);
    const view2 = store.add(new TestSerializableView("view2", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view2, 200, view1, Direction.Up);
    const view3 = store.add(new TestSerializableView("view3", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view3, 200, view1, Direction.Right);
    const view4 = store.add(new TestSerializableView("view4", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view4, 200, view2, Direction.Left);
    const view5 = store.add(new TestSerializableView("view5", 50, Number.MAX_VALUE, 50, Number.MAX_VALUE));
    grid.addView(view5, 100, view1, Direction.Down);
    assert.deepStrictEqual(view1.size, [600, 300]);
    assert.deepStrictEqual(view2.size, [600, 200]);
    assert.deepStrictEqual(view3.size, [200, 400]);
    assert.deepStrictEqual(view4.size, [200, 200]);
    assert.deepStrictEqual(view5.size, [600, 100]);
    grid.setViewVisible(view4, false);
    assert.deepStrictEqual(view1.size, [600, 300]);
    assert.deepStrictEqual(view2.size, [800, 200]);
    assert.deepStrictEqual(view3.size, [200, 400]);
    assert.deepStrictEqual(view4.size, [0, 200]);
    assert.deepStrictEqual(view5.size, [600, 100]);
    const json = grid.serialize();
    assert.deepStrictEqual(json, {
      orientation: 0,
      width: 800,
      height: 600,
      root: {
        type: "branch",
        data: [
          {
            type: "branch",
            data: [
              { type: "leaf", data: { name: "view4" }, size: 200, visible: false },
              { type: "leaf", data: { name: "view2" }, size: 800 }
            ],
            size: 200
          },
          {
            type: "branch",
            data: [
              {
                type: "branch",
                data: [
                  { type: "leaf", data: { name: "view1" }, size: 300 },
                  { type: "leaf", data: { name: "view5" }, size: 100 }
                ],
                size: 600
              },
              { type: "leaf", data: { name: "view3" }, size: 200 }
            ],
            size: 400
          }
        ],
        size: 800
      }
    });
    grid.dispose();
    const deserializer = new TestViewDeserializer(store);
    const grid2 = store.add(SerializableGrid.deserialize(json, deserializer));
    const view1Copy = deserializer.getView("view1");
    const view2Copy = deserializer.getView("view2");
    const view3Copy = deserializer.getView("view3");
    const view4Copy = deserializer.getView("view4");
    const view5Copy = deserializer.getView("view5");
    assert.deepStrictEqual(nodesToArrays(grid2.getViews()), [[view4Copy, view2Copy], [[view1Copy, view5Copy], view3Copy]]);
    grid2.layout(800, 600);
    assert.deepStrictEqual(view1Copy.size, [600, 300]);
    assert.deepStrictEqual(view2Copy.size, [800, 200]);
    assert.deepStrictEqual(view3Copy.size, [200, 400]);
    assert.deepStrictEqual(view4Copy.size, [0, 200]);
    assert.deepStrictEqual(view5Copy.size, [600, 100]);
    assert.deepStrictEqual(grid2.isViewVisible(view1Copy), true);
    assert.deepStrictEqual(grid2.isViewVisible(view2Copy), true);
    assert.deepStrictEqual(grid2.isViewVisible(view3Copy), true);
    assert.deepStrictEqual(grid2.isViewVisible(view4Copy), false);
    assert.deepStrictEqual(grid2.isViewVisible(view5Copy), true);
    grid2.setViewVisible(view4Copy, true);
    assert.deepStrictEqual(view1Copy.size, [600, 300]);
    assert.deepStrictEqual(view2Copy.size, [600, 200]);
    assert.deepStrictEqual(view3Copy.size, [200, 400]);
    assert.deepStrictEqual(view4Copy.size, [200, 200]);
    assert.deepStrictEqual(view5Copy.size, [600, 100]);
    assert.deepStrictEqual(grid2.isViewVisible(view1Copy), true);
    assert.deepStrictEqual(grid2.isViewVisible(view2Copy), true);
    assert.deepStrictEqual(grid2.isViewVisible(view3Copy), true);
    assert.deepStrictEqual(grid2.isViewVisible(view4Copy), true);
    assert.deepStrictEqual(grid2.isViewVisible(view5Copy), true);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvYnJvd3Nlci91aS9ncmlkL2dyaWQudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IGNyZWF0ZVNlcmlhbGl6ZWRHcmlkLCBEaXJlY3Rpb24sIGdldFJlbGF0aXZlTG9jYXRpb24sIEdyaWQsIEdyaWROb2RlLCBHcmlkTm9kZURlc2NyaXB0b3IsIElTZXJpYWxpemFibGVWaWV3LCBpc0dyaWRCcmFuY2hOb2RlLCBJVmlld0Rlc2VyaWFsaXplciwgT3JpZW50YXRpb24sIHNhbml0aXplR3JpZE5vZGVEZXNjcmlwdG9yLCBTZXJpYWxpemFibGVHcmlkLCBTaXppbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL3VpL2dyaWQvZ3JpZC5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBkZWVwQ2xvbmUgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgeyBub2Rlc1RvQXJyYXlzLCBUZXN0VmlldyB9IGZyb20gJy4vdXRpbC5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5cbi8vIFNpbXBsZSBleGFtcGxlOlxuLy9cbi8vICArLS0tLS0rLS0tLS0tLS0tLS0tLS0tK1xuLy8gIHwgIDQgIHwgICAgICAyICAgICAgICB8XG4vLyAgKy0tLS0tKy0tLS0tLS0tLSstLS0tLStcbi8vICB8ICAgICAgICAxICAgICAgfCAgICAgfFxuLy8gICstLS0tLS0tLS0tLS0tLS0rICAzICB8XG4vLyAgfCAgICAgICAgNSAgICAgIHwgICAgIHxcbi8vICArLS0tLS0tLS0tLS0tLS0tKy0tLS0tK1xuLy9cbi8vICBWXG4vLyAgKy1IXG4vLyAgfCArLTRcbi8vICB8ICstMlxuLy8gICstSFxuLy8gICAgKy1WXG4vLyAgICB8ICstMVxuLy8gICAgfCArLTVcbi8vICAgICstM1xuXG5zdWl0ZSgnR3JpZCcsIGZ1bmN0aW9uICgpIHtcblxuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXHRsZXQgY29udGFpbmVyOiBIVE1MRWxlbWVudDtcblxuXHRzZXR1cChmdW5jdGlvbiAoKSB7XG5cdFx0Y29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29udGFpbmVyLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHRjb250YWluZXIuc3R5bGUud2lkdGggPSBgJHs4MDB9cHhgO1xuXHRcdGNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHs2MDB9cHhgO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXRSZWxhdGl2ZUxvY2F0aW9uJywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0UmVsYXRpdmVMb2NhdGlvbihPcmllbnRhdGlvbi5WRVJUSUNBTCwgWzBdLCBEaXJlY3Rpb24uVXApLCBbMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0UmVsYXRpdmVMb2NhdGlvbihPcmllbnRhdGlvbi5WRVJUSUNBTCwgWzBdLCBEaXJlY3Rpb24uRG93biksIFsxXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRSZWxhdGl2ZUxvY2F0aW9uKE9yaWVudGF0aW9uLlZFUlRJQ0FMLCBbMF0sIERpcmVjdGlvbi5MZWZ0KSwgWzAsIDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldFJlbGF0aXZlTG9jYXRpb24oT3JpZW50YXRpb24uVkVSVElDQUwsIFswXSwgRGlyZWN0aW9uLlJpZ2h0KSwgWzAsIDFdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0UmVsYXRpdmVMb2NhdGlvbihPcmllbnRhdGlvbi5IT1JJWk9OVEFMLCBbMF0sIERpcmVjdGlvbi5VcCksIFswLCAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRSZWxhdGl2ZUxvY2F0aW9uKE9yaWVudGF0aW9uLkhPUklaT05UQUwsIFswXSwgRGlyZWN0aW9uLkRvd24pLCBbMCwgMV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0UmVsYXRpdmVMb2NhdGlvbihPcmllbnRhdGlvbi5IT1JJWk9OVEFMLCBbMF0sIERpcmVjdGlvbi5MZWZ0KSwgWzBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldFJlbGF0aXZlTG9jYXRpb24oT3JpZW50YXRpb24uSE9SSVpPTlRBTCwgWzBdLCBEaXJlY3Rpb24uUmlnaHQpLCBbMV0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRSZWxhdGl2ZUxvY2F0aW9uKE9yaWVudGF0aW9uLlZFUlRJQ0FMLCBbNF0sIERpcmVjdGlvbi5VcCksIFs0XSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRSZWxhdGl2ZUxvY2F0aW9uKE9yaWVudGF0aW9uLlZFUlRJQ0FMLCBbNF0sIERpcmVjdGlvbi5Eb3duKSwgWzVdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldFJlbGF0aXZlTG9jYXRpb24oT3JpZW50YXRpb24uVkVSVElDQUwsIFs0XSwgRGlyZWN0aW9uLkxlZnQpLCBbNCwgMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0UmVsYXRpdmVMb2NhdGlvbihPcmllbnRhdGlvbi5WRVJUSUNBTCwgWzRdLCBEaXJlY3Rpb24uUmlnaHQpLCBbNCwgMV0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRSZWxhdGl2ZUxvY2F0aW9uKE9yaWVudGF0aW9uLlZFUlRJQ0FMLCBbMCwgMF0sIERpcmVjdGlvbi5VcCksIFswLCAwLCAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRSZWxhdGl2ZUxvY2F0aW9uKE9yaWVudGF0aW9uLlZFUlRJQ0FMLCBbMCwgMF0sIERpcmVjdGlvbi5Eb3duKSwgWzAsIDAsIDFdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldFJlbGF0aXZlTG9jYXRpb24oT3JpZW50YXRpb24uVkVSVElDQUwsIFswLCAwXSwgRGlyZWN0aW9uLkxlZnQpLCBbMCwgMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0UmVsYXRpdmVMb2NhdGlvbihPcmllbnRhdGlvbi5WRVJUSUNBTCwgWzAsIDBdLCBEaXJlY3Rpb24uUmlnaHQpLCBbMCwgMV0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRSZWxhdGl2ZUxvY2F0aW9uKE9yaWVudGF0aW9uLlZFUlRJQ0FMLCBbMSwgMl0sIERpcmVjdGlvbi5VcCksIFsxLCAyLCAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRSZWxhdGl2ZUxvY2F0aW9uKE9yaWVudGF0aW9uLlZFUlRJQ0FMLCBbMSwgMl0sIERpcmVjdGlvbi5Eb3duKSwgWzEsIDIsIDFdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldFJlbGF0aXZlTG9jYXRpb24oT3JpZW50YXRpb24uVkVSVElDQUwsIFsxLCAyXSwgRGlyZWN0aW9uLkxlZnQpLCBbMSwgMl0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0UmVsYXRpdmVMb2NhdGlvbihPcmllbnRhdGlvbi5WRVJUSUNBTCwgWzEsIDJdLCBEaXJlY3Rpb24uUmlnaHQpLCBbMSwgM10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRSZWxhdGl2ZUxvY2F0aW9uKE9yaWVudGF0aW9uLlZFUlRJQ0FMLCBbMSwgMiwgM10sIERpcmVjdGlvbi5VcCksIFsxLCAyLCAzXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRSZWxhdGl2ZUxvY2F0aW9uKE9yaWVudGF0aW9uLlZFUlRJQ0FMLCBbMSwgMiwgM10sIERpcmVjdGlvbi5Eb3duKSwgWzEsIDIsIDRdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldFJlbGF0aXZlTG9jYXRpb24oT3JpZW50YXRpb24uVkVSVElDQUwsIFsxLCAyLCAzXSwgRGlyZWN0aW9uLkxlZnQpLCBbMSwgMiwgMywgMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0UmVsYXRpdmVMb2NhdGlvbihPcmllbnRhdGlvbi5WRVJUSUNBTCwgWzEsIDIsIDNdLCBEaXJlY3Rpb24uUmlnaHQpLCBbMSwgMiwgMywgMV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdlbXB0eScsICgpID0+IHtcblx0XHRjb25zdCB2aWV3MSA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoMTAwLCBOdW1iZXIuTUFYX1ZBTFVFLCAxMDAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRjb25zdCBncmlkdmlldyA9IHN0b3JlLmFkZChuZXcgR3JpZCh2aWV3MSkpO1xuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChncmlkdmlldy5lbGVtZW50KTtcblx0XHRncmlkdmlldy5sYXlvdXQoODAwLCA2MDApO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3MS5zaXplLCBbODAwLCA2MDBdKTtcblx0fSk7XG5cblx0dGVzdCgndHdvIHZpZXdzIHZlcnRpY2FsbHknLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdmlldzEgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGNvbnN0IGdyaWQgPSBzdG9yZS5hZGQobmV3IEdyaWQodmlldzEpKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQoZ3JpZC5lbGVtZW50KTtcblx0XHRncmlkLmxheW91dCg4MDAsIDYwMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3MS5zaXplLCBbODAwLCA2MDBdKTtcblxuXHRcdGNvbnN0IHZpZXcyID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzIsIDIwMCwgdmlldzEsIERpcmVjdGlvbi5VcCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3MS5zaXplLCBbODAwLCA0MDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcyLnNpemUsIFs4MDAsIDIwMF0pO1xuXHR9KTtcblxuXHR0ZXN0KCd0d28gdmlld3MgaG9yaXpvbnRhbGx5JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHZpZXcxID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRjb25zdCBncmlkID0gc3RvcmUuYWRkKG5ldyBHcmlkKHZpZXcxKSk7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGdyaWQuZWxlbWVudCk7XG5cblx0XHRncmlkLmxheW91dCg4MDAsIDYwMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3MS5zaXplLCBbODAwLCA2MDBdKTtcblxuXHRcdGNvbnN0IHZpZXcyID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzIsIDMwMCwgdmlldzEsIERpcmVjdGlvbi5SaWdodCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3MS5zaXplLCBbNTAwLCA2MDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcyLnNpemUsIFszMDAsIDYwMF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzaW1wbGUgbGF5b3V0JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHZpZXcxID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRjb25zdCBncmlkID0gc3RvcmUuYWRkKG5ldyBHcmlkKHZpZXcxKSk7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGdyaWQuZWxlbWVudCk7XG5cblx0XHRncmlkLmxheW91dCg4MDAsIDYwMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3MS5zaXplLCBbODAwLCA2MDBdKTtcblxuXHRcdGNvbnN0IHZpZXcyID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzIsIDIwMCwgdmlldzEsIERpcmVjdGlvbi5VcCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3MS5zaXplLCBbODAwLCA0MDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcyLnNpemUsIFs4MDAsIDIwMF0pO1xuXG5cdFx0Y29uc3QgdmlldzMgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3MywgMjAwLCB2aWV3MSwgRGlyZWN0aW9uLlJpZ2h0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcxLnNpemUsIFs2MDAsIDQwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzIuc2l6ZSwgWzgwMCwgMjAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3My5zaXplLCBbMjAwLCA0MDBdKTtcblxuXHRcdGNvbnN0IHZpZXc0ID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzQsIDIwMCwgdmlldzIsIERpcmVjdGlvbi5MZWZ0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcxLnNpemUsIFs2MDAsIDQwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzIuc2l6ZSwgWzYwMCwgMjAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3My5zaXplLCBbMjAwLCA0MDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXc0LnNpemUsIFsyMDAsIDIwMF0pO1xuXG5cdFx0Y29uc3QgdmlldzUgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3NSwgMTAwLCB2aWV3MSwgRGlyZWN0aW9uLkRvd24pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzEuc2l6ZSwgWzYwMCwgMzAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCBbNjAwLCAyMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXczLnNpemUsIFsyMDAsIDQwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzQuc2l6ZSwgWzIwMCwgMjAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3NS5zaXplLCBbNjAwLCAxMDBdKTtcblx0fSk7XG5cblx0dGVzdCgnYW5vdGhlciBzaW1wbGUgbGF5b3V0IHdpdGggYXV0b21hdGljIHNpemUgZGlzdHJpYnV0aW9uJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHZpZXcxID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRjb25zdCBncmlkID0gc3RvcmUuYWRkKG5ldyBHcmlkKHZpZXcxKSk7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGdyaWQuZWxlbWVudCk7XG5cblx0XHRncmlkLmxheW91dCg4MDAsIDYwMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3MS5zaXplLCBbODAwLCA2MDBdKTtcblxuXHRcdGNvbnN0IHZpZXcyID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzIsIFNpemluZy5EaXN0cmlidXRlLCB2aWV3MSwgRGlyZWN0aW9uLkxlZnQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzEuc2l6ZSwgWzQwMCwgNjAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCBbNDAwLCA2MDBdKTtcblxuXHRcdGNvbnN0IHZpZXczID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzMsIFNpemluZy5EaXN0cmlidXRlLCB2aWV3MSwgRGlyZWN0aW9uLlJpZ2h0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcxLnNpemUsIFsyNjYsIDYwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzIuc2l6ZSwgWzI2NiwgNjAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3My5zaXplLCBbMjY4LCA2MDBdKTtcblxuXHRcdGNvbnN0IHZpZXc0ID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzQsIFNpemluZy5EaXN0cmlidXRlLCB2aWV3MiwgRGlyZWN0aW9uLkRvd24pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzEuc2l6ZSwgWzI2NiwgNjAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCBbMjY2LCAzMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXczLnNpemUsIFsyNjgsIDYwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzQuc2l6ZSwgWzI2NiwgMzAwXSk7XG5cblx0XHRjb25zdCB2aWV3NSA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXc1LCBTaXppbmcuRGlzdHJpYnV0ZSwgdmlldzMsIERpcmVjdGlvbi5VcCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3MS5zaXplLCBbMjY2LCA2MDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcyLnNpemUsIFsyNjYsIDMwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzMuc2l6ZSwgWzI2OCwgMzAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3NC5zaXplLCBbMjY2LCAzMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXc1LnNpemUsIFsyNjgsIDMwMF0pO1xuXG5cdFx0Y29uc3QgdmlldzYgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3NiwgU2l6aW5nLkRpc3RyaWJ1dGUsIHZpZXczLCBEaXJlY3Rpb24uRG93bik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3MS5zaXplLCBbMjY2LCA2MDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcyLnNpemUsIFsyNjYsIDMwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzMuc2l6ZSwgWzI2OCwgMjAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3NC5zaXplLCBbMjY2LCAzMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXc1LnNpemUsIFsyNjgsIDIwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzYuc2l6ZSwgWzI2OCwgMjAwXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Fub3RoZXIgc2ltcGxlIGxheW91dCB3aXRoIHNwbGl0IHNpemUgZGlzdHJpYnV0aW9uJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHZpZXcxID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRjb25zdCBncmlkID0gc3RvcmUuYWRkKG5ldyBHcmlkKHZpZXcxKSk7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGdyaWQuZWxlbWVudCk7XG5cblx0XHRncmlkLmxheW91dCg4MDAsIDYwMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3MS5zaXplLCBbODAwLCA2MDBdKTtcblxuXHRcdGNvbnN0IHZpZXcyID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzIsIFNpemluZy5TcGxpdCwgdmlldzEsIERpcmVjdGlvbi5MZWZ0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcxLnNpemUsIFs0MDAsIDYwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzIuc2l6ZSwgWzQwMCwgNjAwXSk7XG5cblx0XHRjb25zdCB2aWV3MyA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXczLCBTaXppbmcuU3BsaXQsIHZpZXcxLCBEaXJlY3Rpb24uUmlnaHQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzEuc2l6ZSwgWzIwMCwgNjAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCBbNDAwLCA2MDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXczLnNpemUsIFsyMDAsIDYwMF0pO1xuXG5cdFx0Y29uc3QgdmlldzQgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3NCwgU2l6aW5nLlNwbGl0LCB2aWV3MiwgRGlyZWN0aW9uLkRvd24pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzEuc2l6ZSwgWzIwMCwgNjAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCBbNDAwLCAzMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXczLnNpemUsIFsyMDAsIDYwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzQuc2l6ZSwgWzQwMCwgMzAwXSk7XG5cblx0XHRjb25zdCB2aWV3NSA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXc1LCBTaXppbmcuU3BsaXQsIHZpZXczLCBEaXJlY3Rpb24uVXApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzEuc2l6ZSwgWzIwMCwgNjAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCBbNDAwLCAzMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXczLnNpemUsIFsyMDAsIDMwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzQuc2l6ZSwgWzQwMCwgMzAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3NS5zaXplLCBbMjAwLCAzMDBdKTtcblxuXHRcdGNvbnN0IHZpZXc2ID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzYsIFNpemluZy5TcGxpdCwgdmlldzMsIERpcmVjdGlvbi5Eb3duKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcxLnNpemUsIFsyMDAsIDYwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzIuc2l6ZSwgWzQwMCwgMzAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3My5zaXplLCBbMjAwLCAxNTBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXc0LnNpemUsIFs0MDAsIDMwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzUuc2l6ZSwgWzIwMCwgMzAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3Ni5zaXplLCBbMjAwLCAxNTBdKTtcblx0fSk7XG5cblx0dGVzdCgnMy8yIGxheW91dCB3aXRoIHNwbGl0JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHZpZXcxID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRjb25zdCBncmlkID0gc3RvcmUuYWRkKG5ldyBHcmlkKHZpZXcxKSk7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGdyaWQuZWxlbWVudCk7XG5cblx0XHRncmlkLmxheW91dCg4MDAsIDYwMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3MS5zaXplLCBbODAwLCA2MDBdKTtcblxuXHRcdGNvbnN0IHZpZXcyID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzIsIFNpemluZy5TcGxpdCwgdmlldzEsIERpcmVjdGlvbi5Eb3duKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcxLnNpemUsIFs4MDAsIDMwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzIuc2l6ZSwgWzgwMCwgMzAwXSk7XG5cblx0XHRjb25zdCB2aWV3MyA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXczLCBTaXppbmcuU3BsaXQsIHZpZXcyLCBEaXJlY3Rpb24uUmlnaHQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzEuc2l6ZSwgWzgwMCwgMzAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCBbNDAwLCAzMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXczLnNpemUsIFs0MDAsIDMwMF0pO1xuXG5cdFx0Y29uc3QgdmlldzQgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3NCwgU2l6aW5nLlNwbGl0LCB2aWV3MSwgRGlyZWN0aW9uLlJpZ2h0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcxLnNpemUsIFs0MDAsIDMwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzIuc2l6ZSwgWzQwMCwgMzAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3My5zaXplLCBbNDAwLCAzMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXc0LnNpemUsIFs0MDAsIDMwMF0pO1xuXG5cdFx0Y29uc3QgdmlldzUgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3NSwgU2l6aW5nLlNwbGl0LCB2aWV3MSwgRGlyZWN0aW9uLlJpZ2h0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcxLnNpemUsIFsyMDAsIDMwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzIuc2l6ZSwgWzQwMCwgMzAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3My5zaXplLCBbNDAwLCAzMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXc0LnNpemUsIFs0MDAsIDMwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzUuc2l6ZSwgWzIwMCwgMzAwXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NpemluZyBzaG91bGQgYmUgY29ycmVjdCBhZnRlciBicmFuY2ggZGVtb3Rpb24gIzUwNTY0JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHZpZXcxID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRjb25zdCBncmlkID0gc3RvcmUuYWRkKG5ldyBHcmlkKHZpZXcxKSk7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGdyaWQuZWxlbWVudCk7XG5cblx0XHRncmlkLmxheW91dCg4MDAsIDYwMCk7XG5cblx0XHRjb25zdCB2aWV3MiA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXcyLCBTaXppbmcuU3BsaXQsIHZpZXcxLCBEaXJlY3Rpb24uUmlnaHQpO1xuXG5cdFx0Y29uc3QgdmlldzMgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3MywgU2l6aW5nLlNwbGl0LCB2aWV3MiwgRGlyZWN0aW9uLkRvd24pO1xuXG5cdFx0Y29uc3QgdmlldzQgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3NCwgU2l6aW5nLlNwbGl0LCB2aWV3MiwgRGlyZWN0aW9uLlJpZ2h0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcxLnNpemUsIFs0MDAsIDYwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzIuc2l6ZSwgWzIwMCwgMzAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3My5zaXplLCBbNDAwLCAzMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXc0LnNpemUsIFsyMDAsIDMwMF0pO1xuXG5cdFx0Z3JpZC5yZW1vdmVWaWV3KHZpZXczKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcxLnNpemUsIFs0MDAsIDYwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzIuc2l6ZSwgWzIwMCwgNjAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3NC5zaXplLCBbMjAwLCA2MDBdKTtcblx0fSk7XG5cblx0dGVzdCgnc2l6aW5nIHNob3VsZCBiZSBjb3JyZWN0IGFmdGVyIGJyYW5jaCBkZW1vdGlvbiAjNTA2NzUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdmlldzEgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGNvbnN0IGdyaWQgPSBzdG9yZS5hZGQobmV3IEdyaWQodmlldzEpKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQoZ3JpZC5lbGVtZW50KTtcblxuXHRcdGdyaWQubGF5b3V0KDgwMCwgNjAwKTtcblxuXHRcdGNvbnN0IHZpZXcyID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzIsIFNpemluZy5EaXN0cmlidXRlLCB2aWV3MSwgRGlyZWN0aW9uLkRvd24pO1xuXG5cdFx0Y29uc3QgdmlldzMgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3MywgU2l6aW5nLkRpc3RyaWJ1dGUsIHZpZXcyLCBEaXJlY3Rpb24uRG93bik7XG5cblx0XHRjb25zdCB2aWV3NCA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXc0LCBTaXppbmcuRGlzdHJpYnV0ZSwgdmlldzMsIERpcmVjdGlvbi5SaWdodCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3MS5zaXplLCBbODAwLCAyMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcyLnNpemUsIFs4MDAsIDIwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzMuc2l6ZSwgWzQwMCwgMjAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3NC5zaXplLCBbNDAwLCAyMDBdKTtcblxuXHRcdGdyaWQucmVtb3ZlVmlldyh2aWV3MywgU2l6aW5nLkRpc3RyaWJ1dGUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzEuc2l6ZSwgWzgwMCwgMjAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCBbODAwLCAyMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXc0LnNpemUsIFs4MDAsIDIwMF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXROZWlnaGJvclZpZXdzIHNob3VsZCB3b3JrIG9uIHNpbmdsZSB2aWV3IGxheW91dCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB2aWV3MSA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Y29uc3QgZ3JpZCA9IHN0b3JlLmFkZChuZXcgR3JpZCh2aWV3MSkpO1xuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChncmlkLmVsZW1lbnQpO1xuXG5cdFx0Z3JpZC5sYXlvdXQoODAwLCA2MDApO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzEsIERpcmVjdGlvbi5VcCksIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3MSwgRGlyZWN0aW9uLlJpZ2h0KSwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5nZXROZWlnaGJvclZpZXdzKHZpZXcxLCBEaXJlY3Rpb24uRG93biksIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3MSwgRGlyZWN0aW9uLkxlZnQpLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3MSwgRGlyZWN0aW9uLlVwLCB0cnVlKSwgW3ZpZXcxXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzEsIERpcmVjdGlvbi5SaWdodCwgdHJ1ZSksIFt2aWV3MV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5nZXROZWlnaGJvclZpZXdzKHZpZXcxLCBEaXJlY3Rpb24uRG93biwgdHJ1ZSksIFt2aWV3MV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5nZXROZWlnaGJvclZpZXdzKHZpZXcxLCBEaXJlY3Rpb24uTGVmdCwgdHJ1ZSksIFt2aWV3MV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXROZWlnaGJvclZpZXdzIHNob3VsZCB3b3JrIG9uIHNpbXBsZSBsYXlvdXQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdmlldzEgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGNvbnN0IGdyaWQgPSBzdG9yZS5hZGQobmV3IEdyaWQodmlldzEpKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQoZ3JpZC5lbGVtZW50KTtcblxuXHRcdGdyaWQubGF5b3V0KDgwMCwgNjAwKTtcblxuXHRcdGNvbnN0IHZpZXcyID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzIsIFNpemluZy5EaXN0cmlidXRlLCB2aWV3MSwgRGlyZWN0aW9uLkRvd24pO1xuXG5cdFx0Y29uc3QgdmlldzMgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3MywgU2l6aW5nLkRpc3RyaWJ1dGUsIHZpZXcyLCBEaXJlY3Rpb24uRG93bik7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3MSwgRGlyZWN0aW9uLlVwKSwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5nZXROZWlnaGJvclZpZXdzKHZpZXcxLCBEaXJlY3Rpb24uUmlnaHQpLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzEsIERpcmVjdGlvbi5Eb3duKSwgW3ZpZXcyXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzEsIERpcmVjdGlvbi5MZWZ0KSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzEsIERpcmVjdGlvbi5VcCwgdHJ1ZSksIFt2aWV3M10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5nZXROZWlnaGJvclZpZXdzKHZpZXcxLCBEaXJlY3Rpb24uUmlnaHQsIHRydWUpLCBbdmlldzFdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3MSwgRGlyZWN0aW9uLkRvd24sIHRydWUpLCBbdmlldzJdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3MSwgRGlyZWN0aW9uLkxlZnQsIHRydWUpLCBbdmlldzFdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5nZXROZWlnaGJvclZpZXdzKHZpZXcyLCBEaXJlY3Rpb24uVXApLCBbdmlldzFdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3MiwgRGlyZWN0aW9uLlJpZ2h0KSwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5nZXROZWlnaGJvclZpZXdzKHZpZXcyLCBEaXJlY3Rpb24uRG93biksIFt2aWV3M10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5nZXROZWlnaGJvclZpZXdzKHZpZXcyLCBEaXJlY3Rpb24uTGVmdCksIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5nZXROZWlnaGJvclZpZXdzKHZpZXcyLCBEaXJlY3Rpb24uVXAsIHRydWUpLCBbdmlldzFdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3MiwgRGlyZWN0aW9uLlJpZ2h0LCB0cnVlKSwgW3ZpZXcyXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzIsIERpcmVjdGlvbi5Eb3duLCB0cnVlKSwgW3ZpZXczXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzIsIERpcmVjdGlvbi5MZWZ0LCB0cnVlKSwgW3ZpZXcyXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3MywgRGlyZWN0aW9uLlVwKSwgW3ZpZXcyXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzMsIERpcmVjdGlvbi5SaWdodCksIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3MywgRGlyZWN0aW9uLkRvd24pLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzMsIERpcmVjdGlvbi5MZWZ0KSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzMsIERpcmVjdGlvbi5VcCwgdHJ1ZSksIFt2aWV3Ml0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5nZXROZWlnaGJvclZpZXdzKHZpZXczLCBEaXJlY3Rpb24uUmlnaHQsIHRydWUpLCBbdmlldzNdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3MywgRGlyZWN0aW9uLkRvd24sIHRydWUpLCBbdmlldzFdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3MywgRGlyZWN0aW9uLkxlZnQsIHRydWUpLCBbdmlldzNdKTtcblx0fSk7XG5cblx0dGVzdCgnZ2V0TmVpZ2hib3JWaWV3cyBzaG91bGQgd29yayBvbiBhIGNvbXBsZXggbGF5b3V0JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHZpZXcxID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRjb25zdCBncmlkID0gc3RvcmUuYWRkKG5ldyBHcmlkKHZpZXcxKSk7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGdyaWQuZWxlbWVudCk7XG5cblx0XHRncmlkLmxheW91dCg4MDAsIDYwMCk7XG5cblx0XHRjb25zdCB2aWV3MiA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXcyLCBTaXppbmcuRGlzdHJpYnV0ZSwgdmlldzEsIERpcmVjdGlvbi5Eb3duKTtcblxuXHRcdGNvbnN0IHZpZXczID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzMsIFNpemluZy5EaXN0cmlidXRlLCB2aWV3MiwgRGlyZWN0aW9uLkRvd24pO1xuXG5cdFx0Y29uc3QgdmlldzQgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3NCwgU2l6aW5nLkRpc3RyaWJ1dGUsIHZpZXcyLCBEaXJlY3Rpb24uUmlnaHQpO1xuXG5cdFx0Y29uc3QgdmlldzUgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3NSwgU2l6aW5nLkRpc3RyaWJ1dGUsIHZpZXc0LCBEaXJlY3Rpb24uRG93bik7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3MSwgRGlyZWN0aW9uLlVwKSwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5nZXROZWlnaGJvclZpZXdzKHZpZXcxLCBEaXJlY3Rpb24uUmlnaHQpLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzEsIERpcmVjdGlvbi5Eb3duKSwgW3ZpZXcyLCB2aWV3NF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5nZXROZWlnaGJvclZpZXdzKHZpZXcxLCBEaXJlY3Rpb24uTGVmdCksIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3MiwgRGlyZWN0aW9uLlVwKSwgW3ZpZXcxXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzIsIERpcmVjdGlvbi5SaWdodCksIFt2aWV3NCwgdmlldzVdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3MiwgRGlyZWN0aW9uLkRvd24pLCBbdmlldzNdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3MiwgRGlyZWN0aW9uLkxlZnQpLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzQsIERpcmVjdGlvbi5VcCksIFt2aWV3MV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5nZXROZWlnaGJvclZpZXdzKHZpZXc0LCBEaXJlY3Rpb24uUmlnaHQpLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzQsIERpcmVjdGlvbi5Eb3duKSwgW3ZpZXc1XSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzQsIERpcmVjdGlvbi5MZWZ0KSwgW3ZpZXcyXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzUsIERpcmVjdGlvbi5VcCksIFt2aWV3NF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5nZXROZWlnaGJvclZpZXdzKHZpZXc1LCBEaXJlY3Rpb24uUmlnaHQpLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzUsIERpcmVjdGlvbi5Eb3duKSwgW3ZpZXczXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzUsIERpcmVjdGlvbi5MZWZ0KSwgW3ZpZXcyXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzMsIERpcmVjdGlvbi5VcCksIFt2aWV3MiwgdmlldzVdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3MywgRGlyZWN0aW9uLlJpZ2h0KSwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5nZXROZWlnaGJvclZpZXdzKHZpZXczLCBEaXJlY3Rpb24uRG93biksIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3MywgRGlyZWN0aW9uLkxlZnQpLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldE5laWdoYm9yVmlld3Mgc2hvdWxkIHdvcmsgb24gYW5vdGhlciBzaW1wbGUgbGF5b3V0JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHZpZXcxID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRjb25zdCBncmlkID0gc3RvcmUuYWRkKG5ldyBHcmlkKHZpZXcxKSk7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGdyaWQuZWxlbWVudCk7XG5cblx0XHRncmlkLmxheW91dCg4MDAsIDYwMCk7XG5cblx0XHRjb25zdCB2aWV3MiA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXcyLCBTaXppbmcuRGlzdHJpYnV0ZSwgdmlldzEsIERpcmVjdGlvbi5SaWdodCk7XG5cblx0XHRjb25zdCB2aWV3MyA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXczLCBTaXppbmcuRGlzdHJpYnV0ZSwgdmlldzIsIERpcmVjdGlvbi5Eb3duKTtcblxuXHRcdGNvbnN0IHZpZXc0ID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzQsIFNpemluZy5EaXN0cmlidXRlLCB2aWV3MiwgRGlyZWN0aW9uLlJpZ2h0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5nZXROZWlnaGJvclZpZXdzKHZpZXc0LCBEaXJlY3Rpb24uVXApLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmdldE5laWdoYm9yVmlld3ModmlldzQsIERpcmVjdGlvbi5SaWdodCksIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3NCwgRGlyZWN0aW9uLkRvd24pLCBbdmlldzNdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3NCwgRGlyZWN0aW9uLkxlZnQpLCBbdmlldzJdKTtcblx0fSk7XG5cblx0dGVzdCgnZ2V0TmVpZ2hib3JWaWV3cyBzaG91bGQgb25seSByZXR1cm4gaW1tZWRpYXRlIG5laWdoYm9ycycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB2aWV3MSA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Y29uc3QgZ3JpZCA9IHN0b3JlLmFkZChuZXcgR3JpZCh2aWV3MSkpO1xuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChncmlkLmVsZW1lbnQpO1xuXG5cdFx0Z3JpZC5sYXlvdXQoODAwLCA2MDApO1xuXG5cdFx0Y29uc3QgdmlldzIgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3MiwgU2l6aW5nLkRpc3RyaWJ1dGUsIHZpZXcxLCBEaXJlY3Rpb24uUmlnaHQpO1xuXG5cdFx0Y29uc3QgdmlldzMgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3MywgU2l6aW5nLkRpc3RyaWJ1dGUsIHZpZXcyLCBEaXJlY3Rpb24uRG93bik7XG5cblx0XHRjb25zdCB2aWV3NCA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXc0LCBTaXppbmcuRGlzdHJpYnV0ZSwgdmlldzIsIERpcmVjdGlvbi5SaWdodCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh2aWV3MSwgRGlyZWN0aW9uLlJpZ2h0KSwgW3ZpZXcyLCB2aWV3M10pO1xuXHR9KTtcblxuXHR0ZXN0KCdoaWRpbmcgc3BsaXR2aWV3cyBhbmQgcmVzdG9yaW5nIHNpemVzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHZpZXcxID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRjb25zdCBncmlkID0gc3RvcmUuYWRkKG5ldyBHcmlkKHZpZXcxKSk7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGdyaWQuZWxlbWVudCk7XG5cblx0XHRncmlkLmxheW91dCg4MDAsIDYwMCk7XG5cblx0XHRjb25zdCB2aWV3MiA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXcyLCBTaXppbmcuRGlzdHJpYnV0ZSwgdmlldzEsIERpcmVjdGlvbi5SaWdodCk7XG5cblx0XHRjb25zdCB2aWV3MyA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXczLCBTaXppbmcuRGlzdHJpYnV0ZSwgdmlldzIsIERpcmVjdGlvbi5Eb3duKTtcblxuXHRcdGNvbnN0IHZpZXc0ID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzQsIFNpemluZy5EaXN0cmlidXRlLCB2aWV3MiwgRGlyZWN0aW9uLlJpZ2h0KTtcblxuXHRcdGNvbnN0IHNpemUxID0gdmlldzEuc2l6ZTtcblx0XHRjb25zdCBzaXplMiA9IHZpZXcyLnNpemU7XG5cdFx0Y29uc3Qgc2l6ZTMgPSB2aWV3My5zaXplO1xuXHRcdGNvbnN0IHNpemU0ID0gdmlldzQuc2l6ZTtcblxuXHRcdGdyaWQubWF4aW1pemVWaWV3KHZpZXcxKTtcblxuXHRcdC8vIFZpZXdzIDIsIDMsIDQgYXJlIGhpZGRlblxuXHRcdC8vIFNwbGl0dmlldyAoMiw0KSBhbmQgKCgyLDQpLDMpIGFyZSBoaWRkZW5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcxLnNpemUsIFs4MDAsIDYwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzIuc2l6ZSwgWzAsIDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXczLnNpemUsIFswLCAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3NC5zaXplLCBbMCwgMF0pO1xuXG5cdFx0Z3JpZC5leGl0TWF4aW1pemVkVmlldygpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3MS5zaXplLCBzaXplMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCBzaXplMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3My5zaXplLCBzaXplMyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3NC5zaXplLCBzaXplNCk7XG5cblx0XHQvLyBWaWV3cyAxLCAzLCA0IGFyZSBoaWRkZW5cblx0XHQvLyBBbGwgc3BsaXR2aWV3cyBhcmUgc3RpbGwgdmlzaWJsZSA9PiBvbmx5IG9ydGhvZ29uYWxzaXplIGlzIDBcblx0XHRncmlkLm1heGltaXplVmlldyh2aWV3Mik7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcxLnNpemUsIFswLCA2MDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcyLnNpemUsIFs4MDAsIDYwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzMuc2l6ZSwgWzgwMCwgMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzQuc2l6ZSwgWzAsIDYwMF0pO1xuXG5cdFx0Z3JpZC5leGl0TWF4aW1pemVkVmlldygpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3MS5zaXplLCBzaXplMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCBzaXplMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3My5zaXplLCBzaXplMyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3NC5zaXplLCBzaXplNCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2hhc01heGltaXplZFZpZXcnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdmlldzEgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGNvbnN0IGdyaWQgPSBzdG9yZS5hZGQobmV3IEdyaWQodmlldzEpKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQoZ3JpZC5lbGVtZW50KTtcblxuXHRcdGdyaWQubGF5b3V0KDgwMCwgNjAwKTtcblxuXHRcdGNvbnN0IHZpZXcyID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzIsIFNpemluZy5EaXN0cmlidXRlLCB2aWV3MSwgRGlyZWN0aW9uLlJpZ2h0KTtcblxuXHRcdGNvbnN0IHZpZXczID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzMsIFNpemluZy5EaXN0cmlidXRlLCB2aWV3MiwgRGlyZWN0aW9uLkRvd24pO1xuXG5cdFx0Y29uc3QgdmlldzQgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3NCwgU2l6aW5nLkRpc3RyaWJ1dGUsIHZpZXcyLCBEaXJlY3Rpb24uUmlnaHQpO1xuXG5cdFx0ZnVuY3Rpb24gY2hlY2tJc01heGltaXplZCh2aWV3OiBUZXN0Vmlldykge1xuXHRcdFx0Z3JpZC5tYXhpbWl6ZVZpZXcodmlldyk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5oYXNNYXhpbWl6ZWRWaWV3KCksIHRydWUpO1xuXG5cdFx0XHQvLyBXaGVuIGEgdmlldyBpcyBtYXhpbWl6ZWQsIG5vIHZpZXcgY2FuIGJlIGV4cGFuZGVkIGV2ZW4gaWYgaXQgaXMgbWF4aW1pemVkXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaXNWaWV3RXhwYW5kZWQodmlldzEpLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaXNWaWV3RXhwYW5kZWQodmlldzIpLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaXNWaWV3RXhwYW5kZWQodmlldzMpLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaXNWaWV3RXhwYW5kZWQodmlldzQpLCBmYWxzZSk7XG5cblx0XHRcdGdyaWQuZXhpdE1heGltaXplZFZpZXcoKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmhhc01heGltaXplZFZpZXcoKSwgZmFsc2UpO1xuXHRcdH1cblxuXHRcdGNoZWNrSXNNYXhpbWl6ZWQodmlldzEpO1xuXHRcdGNoZWNrSXNNYXhpbWl6ZWQodmlldzIpO1xuXHRcdGNoZWNrSXNNYXhpbWl6ZWQodmlldzMpO1xuXHRcdGNoZWNrSXNNYXhpbWl6ZWQodmlldzQpO1xuXHR9KTtcblxuXHR0ZXN0KCdDaGFuZ2VzIHRvIHRoZSBncmlkIHVubWF4aW1pemUgdGhlIHZpZXcnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdmlldzEgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGNvbnN0IGdyaWQgPSBzdG9yZS5hZGQobmV3IEdyaWQodmlldzEpKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQoZ3JpZC5lbGVtZW50KTtcblxuXHRcdGdyaWQubGF5b3V0KDgwMCwgNjAwKTtcblxuXHRcdGNvbnN0IHZpZXcyID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzIsIFNpemluZy5EaXN0cmlidXRlLCB2aWV3MSwgRGlyZWN0aW9uLlJpZ2h0KTtcblxuXHRcdGNvbnN0IHZpZXczID0gc3RvcmUuYWRkKG5ldyBUZXN0Vmlldyg1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzMsIFNpemluZy5EaXN0cmlidXRlLCB2aWV3MiwgRGlyZWN0aW9uLkRvd24pO1xuXG5cdFx0Y29uc3QgdmlldzQgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXG5cdFx0Ly8gQWRkaW5nIGEgdmlldyB1bm1heGltaXplcyB0aGUgdmlld1xuXHRcdGdyaWQubWF4aW1pemVWaWV3KHZpZXcxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaGFzTWF4aW1pemVkVmlldygpLCB0cnVlKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzQsIFNpemluZy5EaXN0cmlidXRlLCB2aWV3MiwgRGlyZWN0aW9uLlJpZ2h0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5oYXNNYXhpbWl6ZWRWaWV3KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaXNWaWV3VmlzaWJsZSh2aWV3MSksIHRydWUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5pc1ZpZXdWaXNpYmxlKHZpZXcyKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmlzVmlld1Zpc2libGUodmlldzMpLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaXNWaWV3VmlzaWJsZSh2aWV3NCksIHRydWUpO1xuXG5cdFx0Ly8gUmVtb3ZpbmcgYSB2aWV3IHVubWF4aW1pemVzIHRoZSB2aWV3XG5cdFx0Z3JpZC5tYXhpbWl6ZVZpZXcodmlldzEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5oYXNNYXhpbWl6ZWRWaWV3KCksIHRydWUpO1xuXHRcdGdyaWQucmVtb3ZlVmlldyh2aWV3NCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaGFzTWF4aW1pemVkVmlldygpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmlzVmlld1Zpc2libGUodmlldzEpLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaXNWaWV3VmlzaWJsZSh2aWV3MiksIHRydWUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5pc1ZpZXdWaXNpYmxlKHZpZXczKSwgdHJ1ZSk7XG5cblx0XHQvLyBDaGFuZ2luZyB0aGUgdmlzaWJpbGl0eSBvZiBhbnkgdmlldyB3aGlsZSBhIHZpZXcgaXMgbWF4aW1pemVkLCB1bm1heGltaXplcyB0aGUgdmlld1xuXHRcdGdyaWQubWF4aW1pemVWaWV3KHZpZXcxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaGFzTWF4aW1pemVkVmlldygpLCB0cnVlKTtcblx0XHRncmlkLnNldFZpZXdWaXNpYmxlKHZpZXczLCB0cnVlKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5oYXNNYXhpbWl6ZWRWaWV3KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaXNWaWV3VmlzaWJsZSh2aWV3MSksIHRydWUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5pc1ZpZXdWaXNpYmxlKHZpZXcyKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmlzVmlld1Zpc2libGUodmlldzMpLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnQ2hhbmdlcyB0byB0aGUgZ3JpZCBzaXppbmcgdW5tYXhpbWl6ZSB0aGUgdmlldycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB2aWV3MSA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Y29uc3QgZ3JpZCA9IHN0b3JlLmFkZChuZXcgR3JpZCh2aWV3MSkpO1xuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChncmlkLmVsZW1lbnQpO1xuXG5cdFx0Z3JpZC5sYXlvdXQoODAwLCA2MDApO1xuXG5cdFx0Y29uc3QgdmlldzIgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3MiwgU2l6aW5nLkRpc3RyaWJ1dGUsIHZpZXcxLCBEaXJlY3Rpb24uUmlnaHQpO1xuXG5cdFx0Y29uc3QgdmlldzMgPSBzdG9yZS5hZGQobmV3IFRlc3RWaWV3KDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3MywgU2l6aW5nLkRpc3RyaWJ1dGUsIHZpZXcyLCBEaXJlY3Rpb24uRG93bik7XG5cblx0XHRjb25zdCB2aWV3NCA9IHN0b3JlLmFkZChuZXcgVGVzdFZpZXcoNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXc0LCBTaXppbmcuRGlzdHJpYnV0ZSwgdmlldzIsIERpcmVjdGlvbi5SaWdodCk7XG5cblx0XHQvLyBNYXhpbWl6aW5nIGEgZGlmZmVyZW50IHZpZXcgdW5tYXhpbWl6ZXMgdGhlIGN1cnJlbnQgb25lIGFuZCBtYXhpbWl6ZXMgdGhlIG5ldyBvbmVcblx0XHRncmlkLm1heGltaXplVmlldyh2aWV3MSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmhhc01heGltaXplZFZpZXcoKSwgdHJ1ZSk7XG5cdFx0Z3JpZC5tYXhpbWl6ZVZpZXcodmlldzIpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmhhc01heGltaXplZFZpZXcoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmlzVmlld1Zpc2libGUodmlldzEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmlzVmlld1Zpc2libGUodmlldzIpLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaXNWaWV3VmlzaWJsZSh2aWV3MyksIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaXNWaWV3VmlzaWJsZSh2aWV3NCksIGZhbHNlKTtcblxuXHRcdC8vIERpc3RyaWJ1dGluZyB0aGUgc2l6ZSB1bm1heGltaXplcyB0aGUgdmlld1xuXHRcdGdyaWQubWF4aW1pemVWaWV3KHZpZXcxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaGFzTWF4aW1pemVkVmlldygpLCB0cnVlKTtcblx0XHRncmlkLmRpc3RyaWJ1dGVWaWV3U2l6ZXMoKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5oYXNNYXhpbWl6ZWRWaWV3KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaXNWaWV3VmlzaWJsZSh2aWV3MSksIHRydWUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5pc1ZpZXdWaXNpYmxlKHZpZXcyKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmlzVmlld1Zpc2libGUodmlldzMpLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaXNWaWV3VmlzaWJsZSh2aWV3NCksIHRydWUpO1xuXG5cdFx0Ly8gRXhwYW5kaW5nIGEgZGlmZmVyZW50IHZpZXcgdW5tYXhpbWl6ZXMgdGhlIHZpZXdcblx0XHRncmlkLm1heGltaXplVmlldyh2aWV3MSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmhhc01heGltaXplZFZpZXcoKSwgdHJ1ZSk7XG5cdFx0Z3JpZC5leHBhbmRWaWV3KHZpZXcyKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5oYXNNYXhpbWl6ZWRWaWV3KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaXNWaWV3VmlzaWJsZSh2aWV3MSksIHRydWUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5pc1ZpZXdWaXNpYmxlKHZpZXcyKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmlzVmlld1Zpc2libGUodmlldzMpLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaXNWaWV3VmlzaWJsZSh2aWV3NCksIHRydWUpO1xuXG5cdFx0Ly8gRXhwYW5kaW5nIHRoZSBtYXhpbWl6ZWQgdmlldyB1bm1heGltaXplcyB0aGUgdmlld1xuXHRcdGdyaWQubWF4aW1pemVWaWV3KHZpZXcxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaGFzTWF4aW1pemVkVmlldygpLCB0cnVlKTtcblx0XHRncmlkLmV4cGFuZFZpZXcodmlldzEpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmhhc01heGltaXplZFZpZXcoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5pc1ZpZXdWaXNpYmxlKHZpZXcxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLmlzVmlld1Zpc2libGUodmlldzIpLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQuaXNWaWV3VmlzaWJsZSh2aWV3MyksIHRydWUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZC5pc1ZpZXdWaXNpYmxlKHZpZXc0KSwgdHJ1ZSk7XG5cdH0pO1xufSk7XG5cbmNsYXNzIFRlc3RTZXJpYWxpemFibGVWaWV3IGV4dGVuZHMgVGVzdFZpZXcgaW1wbGVtZW50cyBJU2VyaWFsaXphYmxlVmlldyB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgbmFtZTogc3RyaW5nLFxuXHRcdG1pbmltdW1XaWR0aDogbnVtYmVyLFxuXHRcdG1heGltdW1XaWR0aDogbnVtYmVyLFxuXHRcdG1pbmltdW1IZWlnaHQ6IG51bWJlcixcblx0XHRtYXhpbXVtSGVpZ2h0OiBudW1iZXJcblx0KSB7XG5cdFx0c3VwZXIobWluaW11bVdpZHRoLCBtYXhpbXVtV2lkdGgsIG1pbmltdW1IZWlnaHQsIG1heGltdW1IZWlnaHQpO1xuXHR9XG5cblx0dG9KU09OKCkge1xuXHRcdHJldHVybiB7IG5hbWU6IHRoaXMubmFtZSB9O1xuXHR9XG59XG5cbmNsYXNzIFRlc3RWaWV3RGVzZXJpYWxpemVyIGltcGxlbWVudHMgSVZpZXdEZXNlcmlhbGl6ZXI8VGVzdFNlcmlhbGl6YWJsZVZpZXc+IHtcblxuXHRwcml2YXRlIHZpZXdzID0gbmV3IE1hcDxzdHJpbmcsIFRlc3RTZXJpYWxpemFibGVWaWV3PigpO1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgc3RvcmU6IFBpY2s8RGlzcG9zYWJsZVN0b3JlLCAnYWRkJz4pIHsgfVxuXG5cdGZyb21KU09OKGpzb246IGFueSk6IFRlc3RTZXJpYWxpemFibGVWaWV3IHtcblx0XHRjb25zdCB2aWV3ID0gdGhpcy5zdG9yZS5hZGQobmV3IFRlc3RTZXJpYWxpemFibGVWaWV3KGpzb24ubmFtZSwgNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0dGhpcy52aWV3cy5zZXQoanNvbi5uYW1lLCB2aWV3KTtcblx0XHRyZXR1cm4gdmlldztcblx0fVxuXG5cdGdldFZpZXcoaWQ6IHN0cmluZyk6IFRlc3RTZXJpYWxpemFibGVWaWV3IHtcblx0XHRjb25zdCB2aWV3ID0gdGhpcy52aWV3cy5nZXQoaWQpO1xuXHRcdGlmICghdmlldykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdVbmtub3duIHZpZXcnKTtcblx0XHR9XG5cdFx0cmV0dXJuIHZpZXc7XG5cdH1cbn1cblxuZnVuY3Rpb24gbm9kZXNUb05hbWVzKG5vZGU6IEdyaWROb2RlPFRlc3RTZXJpYWxpemFibGVWaWV3Pik6IGFueSB7XG5cdGlmIChpc0dyaWRCcmFuY2hOb2RlKG5vZGUpKSB7XG5cdFx0cmV0dXJuIG5vZGUuY2hpbGRyZW4ubWFwKG5vZGVzVG9OYW1lcyk7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIG5vZGUudmlldy5uYW1lO1xuXHR9XG59XG5cbnN1aXRlKCdTZXJpYWxpemFibGVHcmlkJywgZnVuY3Rpb24gKCkge1xuXG5cdGNvbnN0IHN0b3JlID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cdGxldCBjb250YWluZXI6IEhUTUxFbGVtZW50O1xuXG5cdHNldHVwKGZ1bmN0aW9uICgpIHtcblx0XHRjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRjb250YWluZXIuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRcdGNvbnRhaW5lci5zdHlsZS53aWR0aCA9IGAkezgwMH1weGA7XG5cdFx0Y29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGAkezYwMH1weGA7XG5cdH0pO1xuXG5cdHRlc3QoJ3NlcmlhbGl6ZSBlbXB0eScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB2aWV3MSA9IHN0b3JlLmFkZChuZXcgVGVzdFNlcmlhbGl6YWJsZVZpZXcoJ3ZpZXcxJywgNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Y29uc3QgZ3JpZCA9IHN0b3JlLmFkZChuZXcgU2VyaWFsaXphYmxlR3JpZCh2aWV3MSkpO1xuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChncmlkLmVsZW1lbnQpO1xuXHRcdGdyaWQubGF5b3V0KDgwMCwgNjAwKTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IGdyaWQuc2VyaWFsaXplKCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIHtcblx0XHRcdG9yaWVudGF0aW9uOiAwLFxuXHRcdFx0d2lkdGg6IDgwMCxcblx0XHRcdGhlaWdodDogNjAwLFxuXHRcdFx0cm9vdDoge1xuXHRcdFx0XHR0eXBlOiAnYnJhbmNoJyxcblx0XHRcdFx0ZGF0YTogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHR5cGU6ICdsZWFmJyxcblx0XHRcdFx0XHRcdGRhdGE6IHtcblx0XHRcdFx0XHRcdFx0bmFtZTogJ3ZpZXcxJyxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRzaXplOiA2MDBcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdHNpemU6IDgwMFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzZXJpYWxpemUgc2ltcGxlIGxheW91dCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB2aWV3MSA9IHN0b3JlLmFkZChuZXcgVGVzdFNlcmlhbGl6YWJsZVZpZXcoJ3ZpZXcxJywgNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Y29uc3QgZ3JpZCA9IHN0b3JlLmFkZChuZXcgU2VyaWFsaXphYmxlR3JpZCh2aWV3MSkpO1xuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChncmlkLmVsZW1lbnQpO1xuXHRcdGdyaWQubGF5b3V0KDgwMCwgNjAwKTtcblxuXHRcdGNvbnN0IHZpZXcyID0gc3RvcmUuYWRkKG5ldyBUZXN0U2VyaWFsaXphYmxlVmlldygndmlldzInLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzIsIDIwMCwgdmlldzEsIERpcmVjdGlvbi5VcCk7XG5cblx0XHRjb25zdCB2aWV3MyA9IHN0b3JlLmFkZChuZXcgVGVzdFNlcmlhbGl6YWJsZVZpZXcoJ3ZpZXczJywgNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXczLCAyMDAsIHZpZXcxLCBEaXJlY3Rpb24uUmlnaHQpO1xuXG5cdFx0Y29uc3QgdmlldzQgPSBzdG9yZS5hZGQobmV3IFRlc3RTZXJpYWxpemFibGVWaWV3KCd2aWV3NCcsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3NCwgMjAwLCB2aWV3MiwgRGlyZWN0aW9uLkxlZnQpO1xuXG5cdFx0Y29uc3QgdmlldzUgPSBzdG9yZS5hZGQobmV3IFRlc3RTZXJpYWxpemFibGVWaWV3KCd2aWV3NScsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3NSwgMTAwLCB2aWV3MSwgRGlyZWN0aW9uLkRvd24pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkLnNlcmlhbGl6ZSgpLCB7XG5cdFx0XHRvcmllbnRhdGlvbjogMCxcblx0XHRcdHdpZHRoOiA4MDAsXG5cdFx0XHRoZWlnaHQ6IDYwMCxcblx0XHRcdHJvb3Q6IHtcblx0XHRcdFx0dHlwZTogJ2JyYW5jaCcsXG5cdFx0XHRcdGRhdGE6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0eXBlOiAnYnJhbmNoJyxcblx0XHRcdFx0XHRcdGRhdGE6IFtcblx0XHRcdFx0XHRcdFx0eyB0eXBlOiAnbGVhZicsIGRhdGE6IHsgbmFtZTogJ3ZpZXc0JyB9LCBzaXplOiAyMDAgfSxcblx0XHRcdFx0XHRcdFx0eyB0eXBlOiAnbGVhZicsIGRhdGE6IHsgbmFtZTogJ3ZpZXcyJyB9LCBzaXplOiA2MDAgfVxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdHNpemU6IDIwMFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0dHlwZTogJ2JyYW5jaCcsXG5cdFx0XHRcdFx0XHRkYXRhOiBbXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnYnJhbmNoJyxcblx0XHRcdFx0XHRcdFx0XHRkYXRhOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHR7IHR5cGU6ICdsZWFmJywgZGF0YTogeyBuYW1lOiAndmlldzEnIH0sIHNpemU6IDMwMCB9LFxuXHRcdFx0XHRcdFx0XHRcdFx0eyB0eXBlOiAnbGVhZicsIGRhdGE6IHsgbmFtZTogJ3ZpZXc1JyB9LCBzaXplOiAxMDAgfVxuXHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0c2l6ZTogNjAwXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHsgdHlwZTogJ2xlYWYnLCBkYXRhOiB7IG5hbWU6ICd2aWV3MycgfSwgc2l6ZTogMjAwIH1cblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRzaXplOiA0MDBcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdHNpemU6IDgwMFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdkZXNlcmlhbGl6ZSBlbXB0eScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB2aWV3MSA9IHN0b3JlLmFkZChuZXcgVGVzdFNlcmlhbGl6YWJsZVZpZXcoJ3ZpZXcxJywgNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Y29uc3QgZ3JpZCA9IHN0b3JlLmFkZChuZXcgU2VyaWFsaXphYmxlR3JpZCh2aWV3MSkpO1xuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChncmlkLmVsZW1lbnQpO1xuXHRcdGdyaWQubGF5b3V0KDgwMCwgNjAwKTtcblxuXHRcdGNvbnN0IGpzb24gPSBncmlkLnNlcmlhbGl6ZSgpO1xuXHRcdGdyaWQuZGlzcG9zZSgpO1xuXG5cdFx0Y29uc3QgZGVzZXJpYWxpemVyID0gbmV3IFRlc3RWaWV3RGVzZXJpYWxpemVyKHN0b3JlKTtcblx0XHRjb25zdCBncmlkMiA9IHN0b3JlLmFkZChTZXJpYWxpemFibGVHcmlkLmRlc2VyaWFsaXplKGpzb24sIGRlc2VyaWFsaXplcikpO1xuXHRcdGdyaWQyLmxheW91dCg4MDAsIDYwMCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5vZGVzVG9OYW1lcyhncmlkMi5nZXRWaWV3cygpKSwgWyd2aWV3MSddKTtcblx0fSk7XG5cblx0dGVzdCgnZGVzZXJpYWxpemUgc2ltcGxlIGxheW91dCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB2aWV3MSA9IHN0b3JlLmFkZChuZXcgVGVzdFNlcmlhbGl6YWJsZVZpZXcoJ3ZpZXcxJywgNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Y29uc3QgZ3JpZCA9IHN0b3JlLmFkZChuZXcgU2VyaWFsaXphYmxlR3JpZCh2aWV3MSkpO1xuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChncmlkLmVsZW1lbnQpO1xuXG5cdFx0Z3JpZC5sYXlvdXQoODAwLCA2MDApO1xuXG5cdFx0Y29uc3QgdmlldzIgPSBzdG9yZS5hZGQobmV3IFRlc3RTZXJpYWxpemFibGVWaWV3KCd2aWV3MicsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3MiwgMjAwLCB2aWV3MSwgRGlyZWN0aW9uLlVwKTtcblxuXHRcdGNvbnN0IHZpZXczID0gc3RvcmUuYWRkKG5ldyBUZXN0U2VyaWFsaXphYmxlVmlldygndmlldzMnLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzMsIDIwMCwgdmlldzEsIERpcmVjdGlvbi5SaWdodCk7XG5cblx0XHRjb25zdCB2aWV3NCA9IHN0b3JlLmFkZChuZXcgVGVzdFNlcmlhbGl6YWJsZVZpZXcoJ3ZpZXc0JywgNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXc0LCAyMDAsIHZpZXcyLCBEaXJlY3Rpb24uTGVmdCk7XG5cblx0XHRjb25zdCB2aWV3NSA9IHN0b3JlLmFkZChuZXcgVGVzdFNlcmlhbGl6YWJsZVZpZXcoJ3ZpZXc1JywgNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXc1LCAxMDAsIHZpZXcxLCBEaXJlY3Rpb24uRG93bik7XG5cblx0XHRjb25zdCBqc29uID0gZ3JpZC5zZXJpYWxpemUoKTtcblx0XHRncmlkLmRpc3Bvc2UoKTtcblxuXHRcdGNvbnN0IGRlc2VyaWFsaXplciA9IG5ldyBUZXN0Vmlld0Rlc2VyaWFsaXplcihzdG9yZSk7XG5cdFx0Y29uc3QgZ3JpZDIgPSBzdG9yZS5hZGQoU2VyaWFsaXphYmxlR3JpZC5kZXNlcmlhbGl6ZShqc29uLCBkZXNlcmlhbGl6ZXIpKTtcblxuXHRcdGNvbnN0IHZpZXcxQ29weSA9IGRlc2VyaWFsaXplci5nZXRWaWV3KCd2aWV3MScpO1xuXHRcdGNvbnN0IHZpZXcyQ29weSA9IGRlc2VyaWFsaXplci5nZXRWaWV3KCd2aWV3MicpO1xuXHRcdGNvbnN0IHZpZXczQ29weSA9IGRlc2VyaWFsaXplci5nZXRWaWV3KCd2aWV3MycpO1xuXHRcdGNvbnN0IHZpZXc0Q29weSA9IGRlc2VyaWFsaXplci5nZXRWaWV3KCd2aWV3NCcpO1xuXHRcdGNvbnN0IHZpZXc1Q29weSA9IGRlc2VyaWFsaXplci5nZXRWaWV3KCd2aWV3NScpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChub2Rlc1RvQXJyYXlzKGdyaWQyLmdldFZpZXdzKCkpLCBbW3ZpZXc0Q29weSwgdmlldzJDb3B5XSwgW1t2aWV3MUNvcHksIHZpZXc1Q29weV0sIHZpZXczQ29weV1dKTtcblxuXHRcdGdyaWQyLmxheW91dCg4MDAsIDYwMCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcxQ29weS5zaXplLCBbNjAwLCAzMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcyQ29weS5zaXplLCBbNjAwLCAyMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXczQ29weS5zaXplLCBbMjAwLCA0MDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXc0Q29weS5zaXplLCBbMjAwLCAyMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXc1Q29weS5zaXplLCBbNjAwLCAxMDBdKTtcblx0fSk7XG5cblx0dGVzdCgnZGVzZXJpYWxpemUgc2ltcGxlIGxheW91dCB3aXRoIHNjYWxpbmcnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdmlldzEgPSBzdG9yZS5hZGQobmV3IFRlc3RTZXJpYWxpemFibGVWaWV3KCd2aWV3MScsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGNvbnN0IGdyaWQgPSBzdG9yZS5hZGQobmV3IFNlcmlhbGl6YWJsZUdyaWQodmlldzEpKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQoZ3JpZC5lbGVtZW50KTtcblxuXHRcdGdyaWQubGF5b3V0KDgwMCwgNjAwKTtcblxuXHRcdGNvbnN0IHZpZXcyID0gc3RvcmUuYWRkKG5ldyBUZXN0U2VyaWFsaXphYmxlVmlldygndmlldzInLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzIsIDIwMCwgdmlldzEsIERpcmVjdGlvbi5VcCk7XG5cblx0XHRjb25zdCB2aWV3MyA9IHN0b3JlLmFkZChuZXcgVGVzdFNlcmlhbGl6YWJsZVZpZXcoJ3ZpZXczJywgNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXczLCAyMDAsIHZpZXcxLCBEaXJlY3Rpb24uUmlnaHQpO1xuXG5cdFx0Y29uc3QgdmlldzQgPSBzdG9yZS5hZGQobmV3IFRlc3RTZXJpYWxpemFibGVWaWV3KCd2aWV3NCcsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3NCwgMjAwLCB2aWV3MiwgRGlyZWN0aW9uLkxlZnQpO1xuXG5cdFx0Y29uc3QgdmlldzUgPSBzdG9yZS5hZGQobmV3IFRlc3RTZXJpYWxpemFibGVWaWV3KCd2aWV3NScsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3NSwgMTAwLCB2aWV3MSwgRGlyZWN0aW9uLkRvd24pO1xuXG5cdFx0Y29uc3QganNvbiA9IGdyaWQuc2VyaWFsaXplKCk7XG5cdFx0Z3JpZC5kaXNwb3NlKCk7XG5cblx0XHRjb25zdCBkZXNlcmlhbGl6ZXIgPSBuZXcgVGVzdFZpZXdEZXNlcmlhbGl6ZXIoc3RvcmUpO1xuXHRcdGNvbnN0IGdyaWQyID0gc3RvcmUuYWRkKFNlcmlhbGl6YWJsZUdyaWQuZGVzZXJpYWxpemUoanNvbiwgZGVzZXJpYWxpemVyKSk7XG5cblx0XHRjb25zdCB2aWV3MUNvcHkgPSBkZXNlcmlhbGl6ZXIuZ2V0VmlldygndmlldzEnKTtcblx0XHRjb25zdCB2aWV3MkNvcHkgPSBkZXNlcmlhbGl6ZXIuZ2V0VmlldygndmlldzInKTtcblx0XHRjb25zdCB2aWV3M0NvcHkgPSBkZXNlcmlhbGl6ZXIuZ2V0VmlldygndmlldzMnKTtcblx0XHRjb25zdCB2aWV3NENvcHkgPSBkZXNlcmlhbGl6ZXIuZ2V0VmlldygndmlldzQnKTtcblx0XHRjb25zdCB2aWV3NUNvcHkgPSBkZXNlcmlhbGl6ZXIuZ2V0VmlldygndmlldzUnKTtcblxuXHRcdGdyaWQyLmxheW91dCg0MDAsIDgwMCk7IC8vIFsvMiwgKjQvM11cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcxQ29weS5zaXplLCBbMzAwLCA0MDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcyQ29weS5zaXplLCBbMzAwLCAyNjddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXczQ29weS5zaXplLCBbMTAwLCA1MzNdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXc0Q29weS5zaXplLCBbMTAwLCAyNjddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXc1Q29weS5zaXplLCBbMzAwLCAxMzNdKTtcblx0fSk7XG5cblx0dGVzdCgnZGVzZXJpYWxpemUgNCB2aWV3IGxheW91dCAoYmVuIGlzc3VlICMyKScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB2aWV3MSA9IHN0b3JlLmFkZChuZXcgVGVzdFNlcmlhbGl6YWJsZVZpZXcoJ3ZpZXcxJywgNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Y29uc3QgZ3JpZCA9IHN0b3JlLmFkZChuZXcgU2VyaWFsaXphYmxlR3JpZCh2aWV3MSkpO1xuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChncmlkLmVsZW1lbnQpO1xuXHRcdGdyaWQubGF5b3V0KDgwMCwgNjAwKTtcblxuXHRcdGNvbnN0IHZpZXcyID0gc3RvcmUuYWRkKG5ldyBUZXN0U2VyaWFsaXphYmxlVmlldygndmlldzInLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzIsIFNpemluZy5TcGxpdCwgdmlldzEsIERpcmVjdGlvbi5Eb3duKTtcblxuXHRcdGNvbnN0IHZpZXczID0gc3RvcmUuYWRkKG5ldyBUZXN0U2VyaWFsaXphYmxlVmlldygndmlldzMnLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzMsIFNpemluZy5TcGxpdCwgdmlldzIsIERpcmVjdGlvbi5Eb3duKTtcblxuXHRcdGNvbnN0IHZpZXc0ID0gc3RvcmUuYWRkKG5ldyBUZXN0U2VyaWFsaXphYmxlVmlldygndmlldzQnLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzQsIFNpemluZy5TcGxpdCwgdmlldzMsIERpcmVjdGlvbi5SaWdodCk7XG5cblx0XHRjb25zdCBqc29uID0gZ3JpZC5zZXJpYWxpemUoKTtcblx0XHRncmlkLmRpc3Bvc2UoKTtcblxuXHRcdGNvbnN0IGRlc2VyaWFsaXplciA9IG5ldyBUZXN0Vmlld0Rlc2VyaWFsaXplcihzdG9yZSk7XG5cdFx0Y29uc3QgZ3JpZDIgPSBzdG9yZS5hZGQoU2VyaWFsaXphYmxlR3JpZC5kZXNlcmlhbGl6ZShqc29uLCBkZXNlcmlhbGl6ZXIpKTtcblxuXHRcdGNvbnN0IHZpZXcxQ29weSA9IGRlc2VyaWFsaXplci5nZXRWaWV3KCd2aWV3MScpO1xuXHRcdGNvbnN0IHZpZXcyQ29weSA9IGRlc2VyaWFsaXplci5nZXRWaWV3KCd2aWV3MicpO1xuXHRcdGNvbnN0IHZpZXczQ29weSA9IGRlc2VyaWFsaXplci5nZXRWaWV3KCd2aWV3MycpO1xuXHRcdGNvbnN0IHZpZXc0Q29weSA9IGRlc2VyaWFsaXplci5nZXRWaWV3KCd2aWV3NCcpO1xuXG5cdFx0Z3JpZDIubGF5b3V0KDgwMCwgNjAwKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzFDb3B5LnNpemUsIFs4MDAsIDMwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzJDb3B5LnNpemUsIFs4MDAsIDE1MF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzNDb3B5LnNpemUsIFs0MDAsIDE1MF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzRDb3B5LnNpemUsIFs0MDAsIDE1MF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdkZXNlcmlhbGl6ZSAyIHZpZXcgbGF5b3V0IChiZW4gaXNzdWUgIzMpJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHZpZXcxID0gc3RvcmUuYWRkKG5ldyBUZXN0U2VyaWFsaXphYmxlVmlldygndmlldzEnLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRjb25zdCBncmlkID0gc3RvcmUuYWRkKG5ldyBTZXJpYWxpemFibGVHcmlkKHZpZXcxKSk7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGdyaWQuZWxlbWVudCk7XG5cblx0XHRncmlkLmxheW91dCg4MDAsIDYwMCk7XG5cblx0XHRjb25zdCB2aWV3MiA9IHN0b3JlLmFkZChuZXcgVGVzdFNlcmlhbGl6YWJsZVZpZXcoJ3ZpZXcyJywgNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXcyLCBTaXppbmcuU3BsaXQsIHZpZXcxLCBEaXJlY3Rpb24uUmlnaHQpO1xuXG5cdFx0Y29uc3QganNvbiA9IGdyaWQuc2VyaWFsaXplKCk7XG5cdFx0Z3JpZC5kaXNwb3NlKCk7XG5cblx0XHRjb25zdCBkZXNlcmlhbGl6ZXIgPSBuZXcgVGVzdFZpZXdEZXNlcmlhbGl6ZXIoc3RvcmUpO1xuXHRcdGNvbnN0IGdyaWQyID0gc3RvcmUuYWRkKFNlcmlhbGl6YWJsZUdyaWQuZGVzZXJpYWxpemUoanNvbiwgZGVzZXJpYWxpemVyKSk7XG5cblx0XHRjb25zdCB2aWV3MUNvcHkgPSBkZXNlcmlhbGl6ZXIuZ2V0VmlldygndmlldzEnKTtcblx0XHRjb25zdCB2aWV3MkNvcHkgPSBkZXNlcmlhbGl6ZXIuZ2V0VmlldygndmlldzInKTtcblxuXHRcdGdyaWQyLmxheW91dCg4MDAsIDYwMCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcxQ29weS5zaXplLCBbNDAwLCA2MDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXcyQ29weS5zaXplLCBbNDAwLCA2MDBdKTtcblx0fSk7XG5cblx0dGVzdCgnZGVzZXJpYWxpemUgc2ltcGxlIHZpZXcgbGF5b3V0ICM1MDYwOScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB2aWV3MSA9IHN0b3JlLmFkZChuZXcgVGVzdFNlcmlhbGl6YWJsZVZpZXcoJ3ZpZXcxJywgNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Y29uc3QgZ3JpZCA9IHN0b3JlLmFkZChuZXcgU2VyaWFsaXphYmxlR3JpZCh2aWV3MSkpO1xuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChncmlkLmVsZW1lbnQpO1xuXG5cdFx0Z3JpZC5sYXlvdXQoODAwLCA2MDApO1xuXG5cdFx0Y29uc3QgdmlldzIgPSBzdG9yZS5hZGQobmV3IFRlc3RTZXJpYWxpemFibGVWaWV3KCd2aWV3MicsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3MiwgU2l6aW5nLlNwbGl0LCB2aWV3MSwgRGlyZWN0aW9uLlJpZ2h0KTtcblxuXHRcdGNvbnN0IHZpZXczID0gc3RvcmUuYWRkKG5ldyBUZXN0U2VyaWFsaXphYmxlVmlldygndmlldzMnLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzMsIFNpemluZy5TcGxpdCwgdmlldzIsIERpcmVjdGlvbi5Eb3duKTtcblxuXHRcdGdyaWQucmVtb3ZlVmlldyh2aWV3MSwgU2l6aW5nLlNwbGl0KTtcblxuXHRcdGNvbnN0IGpzb24gPSBncmlkLnNlcmlhbGl6ZSgpO1xuXHRcdGdyaWQuZGlzcG9zZSgpO1xuXG5cdFx0Y29uc3QgZGVzZXJpYWxpemVyID0gbmV3IFRlc3RWaWV3RGVzZXJpYWxpemVyKHN0b3JlKTtcblx0XHRjb25zdCBncmlkMiA9IHN0b3JlLmFkZChTZXJpYWxpemFibGVHcmlkLmRlc2VyaWFsaXplKGpzb24sIGRlc2VyaWFsaXplcikpO1xuXG5cdFx0Y29uc3QgdmlldzJDb3B5ID0gZGVzZXJpYWxpemVyLmdldFZpZXcoJ3ZpZXcyJyk7XG5cdFx0Y29uc3QgdmlldzNDb3B5ID0gZGVzZXJpYWxpemVyLmdldFZpZXcoJ3ZpZXczJyk7XG5cblx0XHRncmlkMi5sYXlvdXQoODAwLCA2MDApO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3MkNvcHkuc2l6ZSwgWzgwMCwgMzAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3M0NvcHkuc2l6ZSwgWzgwMCwgMzAwXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Nhbml0aXplR3JpZE5vZGVEZXNjcmlwdG9yJywgKCkgPT4ge1xuXHRcdGNvbnN0IG5vZGVEZXNjcmlwdG9yOiBHcmlkTm9kZURlc2NyaXB0b3I8YW55PiA9IHsgZ3JvdXBzOiBbeyBzaXplOiAwLjIgfSwgeyBzaXplOiAwLjIgfSwgeyBzaXplOiAwLjYsIGdyb3VwczogW3t9LCB7fV0gfV0gfTtcblx0XHRjb25zdCBub2RlRGVzY3JpcHRvckNvcHkgPSBkZWVwQ2xvbmUobm9kZURlc2NyaXB0b3IpO1xuXHRcdHNhbml0aXplR3JpZE5vZGVEZXNjcmlwdG9yKG5vZGVEZXNjcmlwdG9yQ29weSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChub2RlRGVzY3JpcHRvckNvcHksIHsgZ3JvdXBzOiBbeyBzaXplOiAwLjIgfSwgeyBzaXplOiAwLjIgfSwgeyBzaXplOiAwLjYsIGdyb3VwczogW3sgc2l6ZTogMC41IH0sIHsgc2l6ZTogMC41IH1dIH1dIH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGVTZXJpYWxpemVkR3JpZCcsICgpID0+IHtcblx0XHRjb25zdCBncmlkRGVzY3JpcHRvciA9IHsgb3JpZW50YXRpb246IE9yaWVudGF0aW9uLlZFUlRJQ0FMLCBncm91cHM6IFt7IHNpemU6IDAuMiwgZGF0YTogJ2EnIH0sIHsgc2l6ZTogMC4yLCBkYXRhOiAnYicgfSwgeyBzaXplOiAwLjYsIGdyb3VwczogW3sgZGF0YTogJ2MnIH0sIHsgZGF0YTogJ2QnIH1dIH1dIH07XG5cdFx0Y29uc3Qgc2VyaWFsaXplZEdyaWQgPSBjcmVhdGVTZXJpYWxpemVkR3JpZChncmlkRGVzY3JpcHRvcik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJpYWxpemVkR3JpZCwge1xuXHRcdFx0cm9vdDoge1xuXHRcdFx0XHR0eXBlOiAnYnJhbmNoJyxcblx0XHRcdFx0c2l6ZTogdW5kZWZpbmVkLFxuXHRcdFx0XHRkYXRhOiBbXG5cdFx0XHRcdFx0eyB0eXBlOiAnbGVhZicsIHNpemU6IDAuMiwgZGF0YTogJ2EnIH0sXG5cdFx0XHRcdFx0eyB0eXBlOiAnbGVhZicsIHNpemU6IDAuMiwgZGF0YTogJ2InIH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0dHlwZTogJ2JyYW5jaCcsIHNpemU6IDAuNiwgZGF0YTogW1xuXHRcdFx0XHRcdFx0XHR7IHR5cGU6ICdsZWFmJywgc2l6ZTogMC41LCBkYXRhOiAnYycgfSxcblx0XHRcdFx0XHRcdFx0eyB0eXBlOiAnbGVhZicsIHNpemU6IDAuNSwgZGF0YTogJ2QnIH1cblx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdH0sXG5cdFx0XHRvcmllbnRhdGlvbjogT3JpZW50YXRpb24uVkVSVElDQUwsXG5cdFx0XHR3aWR0aDogMSxcblx0XHRcdGhlaWdodDogMVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGVTZXJpYWxpemVkR3JpZCAtIGlzc3VlICM4NTYwMSwgc2hvdWxkIG5vdCBhbGxvdyBzaW5nbGUgY2hpbGRyZW4gZ3JvdXBzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHNlcmlhbGl6ZWRHcmlkID0gY3JlYXRlU2VyaWFsaXplZEdyaWQoeyBvcmllbnRhdGlvbjogT3JpZW50YXRpb24uSE9SSVpPTlRBTCwgZ3JvdXBzOiBbeyBncm91cHM6IFt7fSwge31dLCBzaXplOiAwLjUgfSwgeyBncm91cHM6IFt7fV0sIHNpemU6IDAuNSB9XSB9KTtcblx0XHRjb25zdCB2aWV3czogSVNlcmlhbGl6YWJsZVZpZXdbXSA9IFtdO1xuXHRcdGNvbnN0IGRlc2VyaWFsaXplciA9IG5ldyBjbGFzcyBpbXBsZW1lbnRzIElWaWV3RGVzZXJpYWxpemVyPElTZXJpYWxpemFibGVWaWV3PiB7XG5cdFx0XHRmcm9tSlNPTigpOiBJU2VyaWFsaXphYmxlVmlldyB7XG5cdFx0XHRcdGNvbnN0IHZpZXc6IElTZXJpYWxpemFibGVWaWV3ID0ge1xuXHRcdFx0XHRcdGVsZW1lbnQ6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxuXHRcdFx0XHRcdGxheW91dDogKCkgPT4gbnVsbCxcblx0XHRcdFx0XHRtaW5pbXVtV2lkdGg6IDAsXG5cdFx0XHRcdFx0bWF4aW11bVdpZHRoOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksXG5cdFx0XHRcdFx0bWluaW11bUhlaWdodDogMCxcblx0XHRcdFx0XHRtYXhpbXVtSGVpZ2h0OiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksXG5cdFx0XHRcdFx0b25EaWRDaGFuZ2U6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdFx0dG9KU09OOiAoKSA9PiAoe30pXG5cdFx0XHRcdH07XG5cdFx0XHRcdHZpZXdzLnB1c2godmlldyk7XG5cdFx0XHRcdHJldHVybiB2aWV3O1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBncmlkID0gc3RvcmUuYWRkKFNlcmlhbGl6YWJsZUdyaWQuZGVzZXJpYWxpemUoc2VyaWFsaXplZEdyaWQsIGRlc2VyaWFsaXplcikpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3cy5sZW5ndGgsIDMpO1xuXG5cdFx0Ly8gc2hvdWxkIG5vdCB0aHJvd1xuXHRcdGdyaWQucmVtb3ZlVmlldyh2aWV3c1syXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Zyb20nLCAoKSA9PiB7XG5cdFx0Y29uc3QgY3JlYXRlVmlldyA9ICgpOiBJU2VyaWFsaXphYmxlVmlldyA9PiAoe1xuXHRcdFx0ZWxlbWVudDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksXG5cdFx0XHRsYXlvdXQ6ICgpID0+IG51bGwsXG5cdFx0XHRtaW5pbXVtV2lkdGg6IDAsXG5cdFx0XHRtYXhpbXVtV2lkdGg6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSxcblx0XHRcdG1pbmltdW1IZWlnaHQ6IDAsXG5cdFx0XHRtYXhpbXVtSGVpZ2h0OiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksXG5cdFx0XHRvbkRpZENoYW5nZTogRXZlbnQuTm9uZSxcblx0XHRcdHRvSlNPTjogKCkgPT4gKHt9KVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgYSA9IGNyZWF0ZVZpZXcoKTtcblx0XHRjb25zdCBiID0gY3JlYXRlVmlldygpO1xuXHRcdGNvbnN0IGMgPSBjcmVhdGVWaWV3KCk7XG5cdFx0Y29uc3QgZCA9IGNyZWF0ZVZpZXcoKTtcblxuXHRcdGNvbnN0IGdyaWREZXNjcmlwdG9yID0geyBvcmllbnRhdGlvbjogT3JpZW50YXRpb24uVkVSVElDQUwsIGdyb3VwczogW3sgc2l6ZTogMC4yLCBkYXRhOiBhIH0sIHsgc2l6ZTogMC4yLCBkYXRhOiBiIH0sIHsgc2l6ZTogMC42LCBncm91cHM6IFt7IGRhdGE6IGMgfSwgeyBkYXRhOiBkIH1dIH1dIH07XG5cdFx0Y29uc3QgZ3JpZCA9IFNlcmlhbGl6YWJsZUdyaWQuZnJvbShncmlkRGVzY3JpcHRvcik7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5vZGVzVG9BcnJheXMoZ3JpZC5nZXRWaWV3cygpKSwgW2EsIGIsIFtjLCBkXV0pO1xuXHRcdGdyaWQuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdzZXJpYWxpemUgc2hvdWxkIHN0b3JlIHZpc2liaWxpdHkgYW5kIHByZXZpb3VzIHNpemUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdmlldzEgPSBzdG9yZS5hZGQobmV3IFRlc3RTZXJpYWxpemFibGVWaWV3KCd2aWV3MScsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGNvbnN0IGdyaWQgPSBzdG9yZS5hZGQobmV3IFNlcmlhbGl6YWJsZUdyaWQodmlldzEpKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQoZ3JpZC5lbGVtZW50KTtcblx0XHRncmlkLmxheW91dCg4MDAsIDYwMCk7XG5cblx0XHRjb25zdCB2aWV3MiA9IHN0b3JlLmFkZChuZXcgVGVzdFNlcmlhbGl6YWJsZVZpZXcoJ3ZpZXcyJywgNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXcyLCAyMDAsIHZpZXcxLCBEaXJlY3Rpb24uVXApO1xuXG5cdFx0Y29uc3QgdmlldzMgPSBzdG9yZS5hZGQobmV3IFRlc3RTZXJpYWxpemFibGVWaWV3KCd2aWV3MycsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3MywgMjAwLCB2aWV3MSwgRGlyZWN0aW9uLlJpZ2h0KTtcblxuXHRcdGNvbnN0IHZpZXc0ID0gc3RvcmUuYWRkKG5ldyBUZXN0U2VyaWFsaXphYmxlVmlldygndmlldzQnLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzQsIDIwMCwgdmlldzIsIERpcmVjdGlvbi5MZWZ0KTtcblxuXHRcdGNvbnN0IHZpZXc1ID0gc3RvcmUuYWRkKG5ldyBUZXN0U2VyaWFsaXphYmxlVmlldygndmlldzUnLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzUsIDEwMCwgdmlldzEsIERpcmVjdGlvbi5Eb3duKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzEuc2l6ZSwgWzYwMCwgMzAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCBbNjAwLCAyMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXczLnNpemUsIFsyMDAsIDQwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzQuc2l6ZSwgWzIwMCwgMjAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3NS5zaXplLCBbNjAwLCAxMDBdKTtcblxuXHRcdGdyaWQuc2V0Vmlld1Zpc2libGUodmlldzUsIGZhbHNlKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzEuc2l6ZSwgWzYwMCwgNDAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCBbNjAwLCAyMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXczLnNpemUsIFsyMDAsIDQwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzQuc2l6ZSwgWzIwMCwgMjAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3NS5zaXplLCBbNjAwLCAwXSk7XG5cblx0XHRncmlkLnNldFZpZXdWaXNpYmxlKHZpZXc1LCB0cnVlKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzEuc2l6ZSwgWzYwMCwgMzAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCBbNjAwLCAyMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXczLnNpemUsIFsyMDAsIDQwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzQuc2l6ZSwgWzIwMCwgMjAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3NS5zaXplLCBbNjAwLCAxMDBdKTtcblxuXHRcdGdyaWQuc2V0Vmlld1Zpc2libGUodmlldzUsIGZhbHNlKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzEuc2l6ZSwgWzYwMCwgNDAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCBbNjAwLCAyMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXczLnNpemUsIFsyMDAsIDQwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzQuc2l6ZSwgWzIwMCwgMjAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3NS5zaXplLCBbNjAwLCAwXSk7XG5cblx0XHRncmlkLnNldFZpZXdWaXNpYmxlKHZpZXc1LCBmYWxzZSk7XG5cblx0XHRjb25zdCBqc29uID0gZ3JpZC5zZXJpYWxpemUoKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGpzb24sIHtcblx0XHRcdG9yaWVudGF0aW9uOiAwLFxuXHRcdFx0d2lkdGg6IDgwMCxcblx0XHRcdGhlaWdodDogNjAwLFxuXHRcdFx0cm9vdDoge1xuXHRcdFx0XHR0eXBlOiAnYnJhbmNoJyxcblx0XHRcdFx0ZGF0YTogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHR5cGU6ICdicmFuY2gnLFxuXHRcdFx0XHRcdFx0ZGF0YTogW1xuXHRcdFx0XHRcdFx0XHR7IHR5cGU6ICdsZWFmJywgZGF0YTogeyBuYW1lOiAndmlldzQnIH0sIHNpemU6IDIwMCB9LFxuXHRcdFx0XHRcdFx0XHR7IHR5cGU6ICdsZWFmJywgZGF0YTogeyBuYW1lOiAndmlldzInIH0sIHNpemU6IDYwMCB9XG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0c2l6ZTogMjAwXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0eXBlOiAnYnJhbmNoJyxcblx0XHRcdFx0XHRcdGRhdGE6IFtcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdicmFuY2gnLFxuXHRcdFx0XHRcdFx0XHRcdGRhdGE6IFtcblx0XHRcdFx0XHRcdFx0XHRcdHsgdHlwZTogJ2xlYWYnLCBkYXRhOiB7IG5hbWU6ICd2aWV3MScgfSwgc2l6ZTogNDAwIH0sXG5cdFx0XHRcdFx0XHRcdFx0XHR7IHR5cGU6ICdsZWFmJywgZGF0YTogeyBuYW1lOiAndmlldzUnIH0sIHNpemU6IDEwMCwgdmlzaWJsZTogZmFsc2UgfVxuXHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0c2l6ZTogNjAwXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHsgdHlwZTogJ2xlYWYnLCBkYXRhOiB7IG5hbWU6ICd2aWV3MycgfSwgc2l6ZTogMjAwIH1cblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRzaXplOiA0MDBcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdHNpemU6IDgwMFxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Z3JpZC5kaXNwb3NlKCk7XG5cblx0XHRjb25zdCBkZXNlcmlhbGl6ZXIgPSBuZXcgVGVzdFZpZXdEZXNlcmlhbGl6ZXIoc3RvcmUpO1xuXHRcdGNvbnN0IGdyaWQyID0gc3RvcmUuYWRkKFNlcmlhbGl6YWJsZUdyaWQuZGVzZXJpYWxpemUoanNvbiwgZGVzZXJpYWxpemVyKSk7XG5cblx0XHRjb25zdCB2aWV3MUNvcHkgPSBkZXNlcmlhbGl6ZXIuZ2V0VmlldygndmlldzEnKTtcblx0XHRjb25zdCB2aWV3MkNvcHkgPSBkZXNlcmlhbGl6ZXIuZ2V0VmlldygndmlldzInKTtcblx0XHRjb25zdCB2aWV3M0NvcHkgPSBkZXNlcmlhbGl6ZXIuZ2V0VmlldygndmlldzMnKTtcblx0XHRjb25zdCB2aWV3NENvcHkgPSBkZXNlcmlhbGl6ZXIuZ2V0VmlldygndmlldzQnKTtcblx0XHRjb25zdCB2aWV3NUNvcHkgPSBkZXNlcmlhbGl6ZXIuZ2V0VmlldygndmlldzUnKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobm9kZXNUb0FycmF5cyhncmlkMi5nZXRWaWV3cygpKSwgW1t2aWV3NENvcHksIHZpZXcyQ29weV0sIFtbdmlldzFDb3B5LCB2aWV3NUNvcHldLCB2aWV3M0NvcHldXSk7XG5cblx0XHRncmlkMi5sYXlvdXQoODAwLCA2MDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzFDb3B5LnNpemUsIFs2MDAsIDQwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzJDb3B5LnNpemUsIFs2MDAsIDIwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzNDb3B5LnNpemUsIFsyMDAsIDQwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzRDb3B5LnNpemUsIFsyMDAsIDIwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzVDb3B5LnNpemUsIFs2MDAsIDBdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZDIuaXNWaWV3VmlzaWJsZSh2aWV3MUNvcHkpLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQyLmlzVmlld1Zpc2libGUodmlldzJDb3B5KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkMi5pc1ZpZXdWaXNpYmxlKHZpZXczQ29weSksIHRydWUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZDIuaXNWaWV3VmlzaWJsZSh2aWV3NENvcHkpLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQyLmlzVmlld1Zpc2libGUodmlldzVDb3B5KSwgZmFsc2UpO1xuXG5cdFx0Z3JpZDIuc2V0Vmlld1Zpc2libGUodmlldzVDb3B5LCB0cnVlKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzFDb3B5LnNpemUsIFs2MDAsIDMwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzJDb3B5LnNpemUsIFs2MDAsIDIwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzNDb3B5LnNpemUsIFsyMDAsIDQwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzRDb3B5LnNpemUsIFsyMDAsIDIwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzVDb3B5LnNpemUsIFs2MDAsIDEwMF0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkMi5pc1ZpZXdWaXNpYmxlKHZpZXcxQ29weSksIHRydWUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZDIuaXNWaWV3VmlzaWJsZSh2aWV3MkNvcHkpLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQyLmlzVmlld1Zpc2libGUodmlldzNDb3B5KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkMi5pc1ZpZXdWaXNpYmxlKHZpZXc0Q29weSksIHRydWUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZDIuaXNWaWV3VmlzaWJsZSh2aWV3NUNvcHkpLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnc2VyaWFsaXplIHNob3VsZCBzdG9yZSB2aXNpYmlsaXR5IGFuZCBwcmV2aW91cyBzaXplIGV2ZW4gZm9yIGZpcnN0IGxlYWYnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdmlldzEgPSBzdG9yZS5hZGQobmV3IFRlc3RTZXJpYWxpemFibGVWaWV3KCd2aWV3MScsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGNvbnN0IGdyaWQgPSBzdG9yZS5hZGQobmV3IFNlcmlhbGl6YWJsZUdyaWQodmlldzEpKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQoZ3JpZC5lbGVtZW50KTtcblx0XHRncmlkLmxheW91dCg4MDAsIDYwMCk7XG5cblx0XHRjb25zdCB2aWV3MiA9IHN0b3JlLmFkZChuZXcgVGVzdFNlcmlhbGl6YWJsZVZpZXcoJ3ZpZXcyJywgNTAsIE51bWJlci5NQVhfVkFMVUUsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFKSk7XG5cdFx0Z3JpZC5hZGRWaWV3KHZpZXcyLCAyMDAsIHZpZXcxLCBEaXJlY3Rpb24uVXApO1xuXG5cdFx0Y29uc3QgdmlldzMgPSBzdG9yZS5hZGQobmV3IFRlc3RTZXJpYWxpemFibGVWaWV3KCd2aWV3MycsIDUwLCBOdW1iZXIuTUFYX1ZBTFVFLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSkpO1xuXHRcdGdyaWQuYWRkVmlldyh2aWV3MywgMjAwLCB2aWV3MSwgRGlyZWN0aW9uLlJpZ2h0KTtcblxuXHRcdGNvbnN0IHZpZXc0ID0gc3RvcmUuYWRkKG5ldyBUZXN0U2VyaWFsaXphYmxlVmlldygndmlldzQnLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzQsIDIwMCwgdmlldzIsIERpcmVjdGlvbi5MZWZ0KTtcblxuXHRcdGNvbnN0IHZpZXc1ID0gc3RvcmUuYWRkKG5ldyBUZXN0U2VyaWFsaXphYmxlVmlldygndmlldzUnLCA1MCwgTnVtYmVyLk1BWF9WQUxVRSwgNTAsIE51bWJlci5NQVhfVkFMVUUpKTtcblx0XHRncmlkLmFkZFZpZXcodmlldzUsIDEwMCwgdmlldzEsIERpcmVjdGlvbi5Eb3duKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzEuc2l6ZSwgWzYwMCwgMzAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCBbNjAwLCAyMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXczLnNpemUsIFsyMDAsIDQwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzQuc2l6ZSwgWzIwMCwgMjAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3NS5zaXplLCBbNjAwLCAxMDBdKTtcblxuXHRcdGdyaWQuc2V0Vmlld1Zpc2libGUodmlldzQsIGZhbHNlKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzEuc2l6ZSwgWzYwMCwgMzAwXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3Mi5zaXplLCBbODAwLCAyMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXczLnNpemUsIFsyMDAsIDQwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzQuc2l6ZSwgWzAsIDIwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzUuc2l6ZSwgWzYwMCwgMTAwXSk7XG5cblx0XHRjb25zdCBqc29uID0gZ3JpZC5zZXJpYWxpemUoKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGpzb24sIHtcblx0XHRcdG9yaWVudGF0aW9uOiAwLFxuXHRcdFx0d2lkdGg6IDgwMCxcblx0XHRcdGhlaWdodDogNjAwLFxuXHRcdFx0cm9vdDoge1xuXHRcdFx0XHR0eXBlOiAnYnJhbmNoJyxcblx0XHRcdFx0ZGF0YTogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHR5cGU6ICdicmFuY2gnLFxuXHRcdFx0XHRcdFx0ZGF0YTogW1xuXHRcdFx0XHRcdFx0XHR7IHR5cGU6ICdsZWFmJywgZGF0YTogeyBuYW1lOiAndmlldzQnIH0sIHNpemU6IDIwMCwgdmlzaWJsZTogZmFsc2UgfSxcblx0XHRcdFx0XHRcdFx0eyB0eXBlOiAnbGVhZicsIGRhdGE6IHsgbmFtZTogJ3ZpZXcyJyB9LCBzaXplOiA4MDAgfVxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdHNpemU6IDIwMFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0dHlwZTogJ2JyYW5jaCcsXG5cdFx0XHRcdFx0XHRkYXRhOiBbXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnYnJhbmNoJyxcblx0XHRcdFx0XHRcdFx0XHRkYXRhOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHR7IHR5cGU6ICdsZWFmJywgZGF0YTogeyBuYW1lOiAndmlldzEnIH0sIHNpemU6IDMwMCB9LFxuXHRcdFx0XHRcdFx0XHRcdFx0eyB0eXBlOiAnbGVhZicsIGRhdGE6IHsgbmFtZTogJ3ZpZXc1JyB9LCBzaXplOiAxMDAgfVxuXHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0c2l6ZTogNjAwXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHsgdHlwZTogJ2xlYWYnLCBkYXRhOiB7IG5hbWU6ICd2aWV3MycgfSwgc2l6ZTogMjAwIH1cblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRzaXplOiA0MDBcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdHNpemU6IDgwMFxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Z3JpZC5kaXNwb3NlKCk7XG5cblx0XHRjb25zdCBkZXNlcmlhbGl6ZXIgPSBuZXcgVGVzdFZpZXdEZXNlcmlhbGl6ZXIoc3RvcmUpO1xuXHRcdGNvbnN0IGdyaWQyID0gc3RvcmUuYWRkKFNlcmlhbGl6YWJsZUdyaWQuZGVzZXJpYWxpemUoanNvbiwgZGVzZXJpYWxpemVyKSk7XG5cblx0XHRjb25zdCB2aWV3MUNvcHkgPSBkZXNlcmlhbGl6ZXIuZ2V0VmlldygndmlldzEnKTtcblx0XHRjb25zdCB2aWV3MkNvcHkgPSBkZXNlcmlhbGl6ZXIuZ2V0VmlldygndmlldzInKTtcblx0XHRjb25zdCB2aWV3M0NvcHkgPSBkZXNlcmlhbGl6ZXIuZ2V0VmlldygndmlldzMnKTtcblx0XHRjb25zdCB2aWV3NENvcHkgPSBkZXNlcmlhbGl6ZXIuZ2V0VmlldygndmlldzQnKTtcblx0XHRjb25zdCB2aWV3NUNvcHkgPSBkZXNlcmlhbGl6ZXIuZ2V0VmlldygndmlldzUnKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobm9kZXNUb0FycmF5cyhncmlkMi5nZXRWaWV3cygpKSwgW1t2aWV3NENvcHksIHZpZXcyQ29weV0sIFtbdmlldzFDb3B5LCB2aWV3NUNvcHldLCB2aWV3M0NvcHldXSk7XG5cblx0XHRncmlkMi5sYXlvdXQoODAwLCA2MDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzFDb3B5LnNpemUsIFs2MDAsIDMwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzJDb3B5LnNpemUsIFs4MDAsIDIwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzNDb3B5LnNpemUsIFsyMDAsIDQwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzRDb3B5LnNpemUsIFswLCAyMDBdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXc1Q29weS5zaXplLCBbNjAwLCAxMDBdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZDIuaXNWaWV3VmlzaWJsZSh2aWV3MUNvcHkpLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQyLmlzVmlld1Zpc2libGUodmlldzJDb3B5KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkMi5pc1ZpZXdWaXNpYmxlKHZpZXczQ29weSksIHRydWUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZDIuaXNWaWV3VmlzaWJsZSh2aWV3NENvcHkpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkMi5pc1ZpZXdWaXNpYmxlKHZpZXc1Q29weSksIHRydWUpO1xuXG5cdFx0Z3JpZDIuc2V0Vmlld1Zpc2libGUodmlldzRDb3B5LCB0cnVlKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzFDb3B5LnNpemUsIFs2MDAsIDMwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzJDb3B5LnNpemUsIFs2MDAsIDIwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzNDb3B5LnNpemUsIFsyMDAsIDQwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzRDb3B5LnNpemUsIFsyMDAsIDIwMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlldzVDb3B5LnNpemUsIFs2MDAsIDEwMF0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkMi5pc1ZpZXdWaXNpYmxlKHZpZXcxQ29weSksIHRydWUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZDIuaXNWaWV3VmlzaWJsZSh2aWV3MkNvcHkpLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdyaWQyLmlzVmlld1Zpc2libGUodmlldzNDb3B5KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChncmlkMi5pc1ZpZXdWaXNpYmxlKHZpZXc0Q29weSksIHRydWUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ3JpZDIuaXNWaWV3VmlzaWJsZSh2aWV3NUNvcHkpLCB0cnVlKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLHNCQUFzQixXQUFXLHFCQUFxQixNQUF1RCxrQkFBcUMsYUFBYSw0QkFBNEIsa0JBQWtCLGNBQWM7QUFDcE8sU0FBUyxhQUFhO0FBQ3RCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsZUFBZSxnQkFBZ0I7QUFDeEMsU0FBUywrQ0FBK0M7QUF1QnhELE1BQU0sUUFBUSxXQUFZO0FBRXpCLFFBQU0sUUFBUSx3Q0FBd0M7QUFDdEQsTUFBSTtBQUVKLFFBQU0sV0FBWTtBQUNqQixnQkFBWSxTQUFTLGNBQWMsS0FBSztBQUN4QyxjQUFVLE1BQU0sV0FBVztBQUMzQixjQUFVLE1BQU0sUUFBUSxHQUFHLEdBQUc7QUFDOUIsY0FBVSxNQUFNLFNBQVMsR0FBRyxHQUFHO0FBQUEsRUFDaEMsQ0FBQztBQUVELE9BQUssdUJBQXVCLE1BQU07QUFDakMsV0FBTyxnQkFBZ0Isb0JBQW9CLFlBQVksVUFBVSxDQUFDLENBQUMsR0FBRyxVQUFVLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN4RixXQUFPLGdCQUFnQixvQkFBb0IsWUFBWSxVQUFVLENBQUMsQ0FBQyxHQUFHLFVBQVUsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzFGLFdBQU8sZ0JBQWdCLG9CQUFvQixZQUFZLFVBQVUsQ0FBQyxDQUFDLEdBQUcsVUFBVSxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM3RixXQUFPLGdCQUFnQixvQkFBb0IsWUFBWSxVQUFVLENBQUMsQ0FBQyxHQUFHLFVBQVUsS0FBSyxHQUFHLENBQUMsR0FBRyxDQUFD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
