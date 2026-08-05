import assert from "assert";
import { escapeRegExpCharacters } from "../../../../../base/common/strings.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { EditOperation } from "../../../../common/core/editOperation.js";
import { Position } from "../../../../common/core/position.js";
import { Range } from "../../../../common/core/range.js";
import { Selection } from "../../../../common/core/selection.js";
import { TrackedRangeStickiness } from "../../../../common/model.js";
import { ModelDecorationOptions } from "../../../../common/model/textModel.js";
import { toSelectedLines } from "../../browser/folding.js";
import { FoldingModel, getNextFoldLine, getParentFoldLine, getPreviousFoldLine, setCollapseStateAtLevel, setCollapseStateForMatchingLines, setCollapseStateForRest, setCollapseStateLevelsDown, setCollapseStateLevelsUp, setCollapseStateUp } from "../../browser/foldingModel.js";
import { computeRanges } from "../../browser/indentRangeProvider.js";
import { createTextModel } from "../../../../test/common/testTextModel.js";
const _TestDecorationProvider = class _TestDecorationProvider {
  constructor(model) {
    this.model = model;
  }
  getDecorationOption(isCollapsed, isHidden) {
    if (isHidden) {
      return _TestDecorationProvider.hiddenDecoration;
    }
    if (isCollapsed) {
      return _TestDecorationProvider.collapsedDecoration;
    }
    return _TestDecorationProvider.expandedDecoration;
  }
  changeDecorations(callback) {
    return this.model.changeDecorations(callback);
  }
  removeDecorations(decorationIds) {
    this.model.changeDecorations((changeAccessor) => {
      changeAccessor.deltaDecorations(decorationIds, []);
    });
  }
  getDecorations() {
    const decorations = this.model.getAllDecorations();
    const res = [];
    for (const decoration of decorations) {
      if (decoration.options === _TestDecorationProvider.hiddenDecoration) {
        res.push({ line: decoration.range.startLineNumber, type: "hidden" });
      } else if (decoration.options === _TestDecorationProvider.collapsedDecoration) {
        res.push({ line: decoration.range.startLineNumber, type: "collapsed" });
      } else if (decoration.options === _TestDecorationProvider.expandedDecoration) {
        res.push({ line: decoration.range.startLineNumber, type: "expanded" });
      }
    }
    return res;
  }
};
_TestDecorationProvider.collapsedDecoration = ModelDecorationOptions.register({
  description: "test",
  stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
  linesDecorationsClassName: "folding"
});
_TestDecorationProvider.expandedDecoration = ModelDecorationOptions.register({
  description: "test",
  stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
  linesDecorationsClassName: "folding"
});
_TestDecorationProvider.hiddenDecoration = ModelDecorationOptions.register({
  description: "test",
  stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
  linesDecorationsClassName: "folding"
});
let TestDecorationProvider = _TestDecorationProvider;
suite("Folding Model", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function r(startLineNumber, endLineNumber, isCollapsed = false) {
    return { startLineNumber, endLineNumber, isCollapsed };
  }
  function d(line, type) {
    return { line, type };
  }
  function assertRegion(actual, expected, message) {
    assert.strictEqual(!!actual, !!expected, message);
    if (actual && expected) {
      assert.strictEqual(actual.startLineNumber, expected.startLineNumber, message);
      assert.strictEqual(actual.endLineNumber, expected.endLineNumber, message);
      assert.strictEqual(actual.isCollapsed, expected.isCollapsed, message);
    }
  }
  function assertFoldedRanges(foldingModel, expectedRegions, message) {
    const actualRanges = [];
    const actual = foldingModel.regions;
    for (let i = 0; i < actual.length; i++) {
      if (actual.isCollapsed(i)) {
        actualRanges.push(r(actual.getStartLineNumber(i), actual.getEndLineNumber(i)));
      }
    }
    assert.deepStrictEqual(actualRanges, expectedRegions, message);
  }
  function assertRanges(foldingModel, expectedRegions, message) {
    const actualRanges = [];
    const actual = foldingModel.regions;
    for (let i = 0; i < actual.length; i++) {
      actualRanges.push(r(actual.getStartLineNumber(i), actual.getEndLineNumber(i), actual.isCollapsed(i)));
    }
    assert.deepStrictEqual(actualRanges, expectedRegions, message);
  }
  function assertDecorations(foldingModel, expectedDecoration, message) {
    const decorationProvider = foldingModel.decorationProvider;
    assert.deepStrictEqual(decorationProvider.getDecorations(), expectedDecoration, message);
  }
  function assertRegions(actual, expectedRegions, message) {
    assert.deepStrictEqual(actual.map((r2) => ({ startLineNumber: r2.startLineNumber, endLineNumber: r2.endLineNumber, isCollapsed: r2.isCollapsed })), expectedRegions, message);
  }
  test("getRegionAtLine", () => {
    const lines = [
      /* 1*/
      "/**",
      /* 2*/
      " * Comment",
      /* 3*/
      " */",
      /* 4*/
      "class A {",
      /* 5*/
      "  void foo() {",
      /* 6*/
      "    // comment {",
      /* 7*/
      "  }",
      /* 8*/
      "}"
    ];
    const textModel = createTextModel(lines.join("\n"));
    try {
      const foldingModel = new FoldingModel(textModel, new TestDecorationProvider(textModel));
      const ranges = computeRanges(textModel, false, void 0);
      foldingModel.update(ranges);
      const r1 = r(1, 3, false);
      const r2 = r(4, 7, false);
      const r3 = r(5, 6, false);
      assertRanges(foldingModel, [r1, r2, r3]);
      assertRegion(foldingModel.getRegionAtLine(1), r1, "1");
      assertRegion(foldingModel.getRegionAtLine(2), r1, "2");
      assertRegion(foldingModel.getRegionAtLine(3), r1, "3");
      assertRegion(foldingModel.getRegionAtLine(4), r2, "4");
      assertRegion(foldingModel.getRegionAtLine(5), r3, "5");
      assertRegion(foldingModel.getRegionAtLine(6), r3, "5");
      assertRegion(foldingModel.getRegionAtLine(7), r2, "6");
      assertRegion(foldingModel.getRegionAtLine(8), null, "7");
    } finally {
      textModel.dispose();
    }
  });
  test("collapse", () => {
    const lines = [
      /* 1*/
      "/**",
      /* 2*/
      " * Comment",
      /* 3*/
      " */",
      /* 4*/
      "class A {",
      /* 5*/
      "  void foo() {",
      /* 6*/
      "    // comment {",
      /* 7*/
      "  }",
      /* 8*/
      "}"
    ];
    const textModel = createTextModel(lines.join("\n"));
    try {
      const foldingModel = new FoldingModel(textModel, new TestDecorationProvider(textModel));
      const ranges = computeRanges(textModel, false, void 0);
      foldingModel.update(ranges);
      const r1 = r(1, 3, false);
      const r2 = r(4, 7, false);
      const r3 = r(5, 6, false);
      assertRanges(foldingModel, [r1, r2, r3]);
      foldingModel.toggleCollapseState([foldingModel.getRegionAtLine(1)]);
      foldingModel.update(ranges);
      assertRanges(foldingModel, [r(1, 3, true), r2, r3]);
      foldingModel.toggleCollapseState([foldingModel.getRegionAtLine(5)]);
      foldingModel.update(ranges);
      assertRanges(foldingModel, [r(1, 3, true), r2, r(5, 6, true)]);
      foldingModel.toggleCollapseState([foldingModel.getRegionAtLine(7)]);
      foldingModel.update(ranges);
      assertRanges(foldingModel, [r(1, 3, true), r(4, 7, true), r(5, 6, true)]);
      textModel.dispose();
    } finally {
      textModel.dispose();
    }
  });
  test("update", () => {
    const lines = [
      /* 1*/
      "/**",
      /* 2*/
      " * Comment",
      /* 3*/
      " */",
      /* 4*/
      "class A {",
      /* 5*/
      "  void foo() {",
      /* 6*/
      "    // comment {",
      /* 7*/
      "  }",
      /* 8*/
      "}"
    ];
    const textModel = createTextModel(lines.join("\n"));
    try {
      const foldingModel = new FoldingModel(textModel, new TestDecorationProvider(textModel));
      const ranges = computeRanges(textModel, false, void 0);
      foldingModel.update(ranges);
      const r1 = r(1, 3, false);
      const r2 = r(4, 7, false);
      const r3 = r(5, 6, false);
      assertRanges(foldingModel, [r1, r2, r3]);
      foldingModel.toggleCollapseState([foldingModel.getRegionAtLine(2), foldingModel.getRegionAtLine(5)]);
      textModel.applyEdits([EditOperation.insert(new Position(4, 1), "//hello\n")]);
      foldingModel.update(computeRanges(textModel, false, void 0));
      assertRanges(foldingModel, [r(1, 3, true), r(5, 8, false), r(6, 7, true)]);
    } finally {
      textModel.dispose();
    }
  });
  test("delete", () => {
    const lines = [
      /* 1*/
      "function foo() {",
      /* 2*/
      "  switch (x) {",
      /* 3*/
      "    case 1:",
      /* 4*/
      "      //hello1",
      /* 5*/
      "      break;",
      /* 6*/
      "    case 2:",
      /* 7*/
      "      //hello2",
      /* 8*/
      "      break;",
      /* 9*/
      "    case 3:",
      /* 10*/
      "      //hello3",
      /* 11*/
      "      break;",
      /* 12*/
      "  }",
      /* 13*/
      "}"
    ];
    const textModel = createTextModel(lines.join("\n"));
    try {
      const foldingModel = new FoldingModel(textModel, new TestDecorationProvider(textModel));
      const ranges = computeRanges(textModel, false, void 0);
      foldingModel.update(ranges);
      const r1 = r(1, 12, false);
      const r2 = r(2, 11, false);
      const r3 = r(3, 5, false);
      const r4 = r(6, 8, false);
      const r5 = r(9, 11, false);
      assertRanges(foldingModel, [r1, r2, r3, r4, r5]);
      foldingModel.toggleCollapseState([foldingModel.getRegionAtLine(6)]);
      textModel.applyEdits([EditOperation.delete(new Range(6, 11, 9, 0))]);
      foldingModel.update(computeRanges(textModel, true, void 0), toSelectedLines([new Selection(7, 1, 7, 1)]));
      assertRanges(foldingModel, [r(1, 9, false), r(2, 8, false), r(3, 5, false), r(6, 8, false)]);
    } finally {
      textModel.dispose();
    }
  });
  test("getRegionsInside", () => {
    const lines = [
      /* 1*/
      "/**",
      /* 2*/
      " * Comment",
      /* 3*/
      " */",
      /* 4*/
      "class A {",
      /* 5*/
      "  void foo() {",
      /* 6*/
      "    // comment {",
      /* 7*/
      "  }",
      /* 8*/
      "}"
    ];
    const textModel = createTextModel(lines.join("\n"));
    try {
      const foldingModel = new FoldingModel(textModel, new TestDecorationProvider(textModel));
      const ranges = computeRanges(textModel, false, void 0);
      foldingModel.update(ranges);
      const r1 = r(1, 3, false);
      const r2 = r(4, 7, false);
      const r3 = r(5, 6, false);
      assertRanges(foldingModel, [r1, r2, r3]);
      const region1 = foldingModel.getRegionAtLine(r1.startLineNumber);
      const region2 = foldingModel.getRegionAtLine(r2.startLineNumber);
      const region3 = foldingModel.getRegionAtLine(r3.startLineNumber);
      assertRegions(foldingModel.getRegionsInside(null), [r1, r2, r3], "1");
      assertRegions(foldingModel.getRegionsInside(region1), [], "2");
      assertRegions(foldingModel.getRegionsInside(region2), [r3], "3");
      assertRegions(foldingModel.getRegionsInside(region3), [], "4");
    } finally {
      textModel.dispose();
    }
  });
  test("getRegionsInsideWithLevel", () => {
    const lines = [
      /* 1*/
      "//#region",
      /* 2*/
      "//#endregion",
      /* 3*/
      "class A {",
      /* 4*/
      "  void foo() {",
      /* 5*/
      "    if (true) {",
      /* 6*/
      "        return;",
      /* 7*/
      "    }",
      /* 8*/
      "    if (true) {",
      /* 9*/
      "      return;",
      /* 10*/
      "    }",
      /* 11*/
      "  }",
      /* 12*/
      "}"
    ];
    const textModel = createTextModel(lines.join("\n"));
    try {
      const foldingModel = new FoldingModel(textModel, new TestDecorationProvider(textModel));
      const ranges = computeRanges(textModel, false, { start: /^\/\/#region$/, end: /^\/\/#endregion$/ });
      foldingModel.update(ranges);
      const r1 = r(1, 2, false);
      const r2 = r(3, 11, false);
      const r3 = r(4, 10, false);
      const r4 = r(5, 6, false);
      const r5 = r(8, 9, false);
      const region1 = foldingModel.getRegionAtLine(r1.startLineNumber);
      const region2 = foldingModel.getRegionAtLine(r2.startLineNumber);
      const region3 = foldingModel.getRegionAtLine(r3.startLineNumber);
      assertRanges(foldingModel, [r1, r2, r3, r4, r5]);
      assertRegions(foldingModel.getRegionsInside(null, (r6, level) => level === 1), [r1, r2], "1");
      assertRegions(foldingModel.getRegionsInside(null, (r6, level) => level === 2), [r3], "2");
      assertRegions(foldingModel.getRegionsInside(null, (r6, level) => level === 3), [r4, r5], "3");
      assertRegions(foldingModel.getRegionsInside(region2, (r6, level) => level === 1), [r3], "4");
      assertRegions(foldingModel.getRegionsInside(region2, (r6, level) => level === 2), [r4, r5], "5");
      assertRegions(foldingModel.getRegionsInside(region3, (r6, level) => level === 1), [r4, r5], "6");
      assertRegions(foldingModel.getRegionsInside(region2, (r6, level) => r6.hidesLine(9)), [r3, r5], "7");
      assertRegions(foldingModel.getRegionsInside(region1, (r6, level) => level === 1), [], "8");
    } finally {
      textModel.dispose();
    }
  });
  test("getRegionAtLine2", () => {
    const lines = [
      /* 1*/
      "//#region",
      /* 2*/
      "class A {",
      /* 3*/
      "  void foo() {",
      /* 4*/
      "    if (true) {",
      /* 5*/
      "      //hello",
      /* 6*/
      "    }",
      /* 7*/
      "",
      /* 8*/
      "  }",
      /* 9*/
      "}",
      /* 10*/
      "//#endregion",
      /* 11*/
      ""
    ];
    const textModel = createTextModel(lines.join("\n"));
    try {
      const foldingModel = new FoldingModel(textModel, new TestDecorationProvider(textModel));
      const ranges = computeRanges(textModel, false, { start: /^\/\/#region$/, end: /^\/\/#endregion$/ });
      foldingModel.update(ranges);
      const r1 = r(1, 10, false);
      const r2 = r(2, 8, false);
      const r3 = r(3, 7, false);
      const r4 = r(4, 5, false);
      assertRanges(foldingModel, [r1, r2, r3, r4]);
      assertRegions(foldingModel.getAllRegionsAtLine(1), [r1], "1");
      assertRegions(foldingModel.getAllRegionsAtLine(2), [r1, r2].reverse(), "2");
      assertRegions(foldingModel.getAllRegionsAtLine(3), [r1, r2, r3].reverse(), "3");
      assertRegions(foldingModel.getAllRegionsAtLine(4), [r1, r2, r3, r4].reverse(), "4");
      assertRegions(foldingModel.getAllRegionsAtLine(5), [r1, r2, r3, r4].reverse(), "5");
      assertRegions(foldingModel.getAllRegionsAtLine(6), [r1, r2, r3].reverse(), "6");
      assertRegions(foldingModel.getAllRegionsAtLine(7), [r1, r2, r3].reverse(), "7");
      assertRegions(foldingModel.getAllRegionsAtLine(8), [r1, r2].reverse(), "8");
      assertRegions(foldingModel.getAllRegionsAtLine(9), [r1], "9");
      assertRegions(foldingModel.getAllRegionsAtLine(10), [r1], "10");
      assertRegions(foldingModel.getAllRegionsAtLine(11), [], "10");
    } finally {
      textModel.dispose();
    }
  });
  test("setCollapseStateRecursivly", () => {
    const lines = [
      /* 1*/
      "//#region",
      /* 2*/
      "//#endregion",
      /* 3*/
      "class A {",
      /* 4*/
      "  void foo() {",
      /* 5*/
      "    if (true) {",
      /* 6*/
      "        return;",
      /* 7*/
      "    }",
      /* 8*/
      "",
      /* 9*/
      "    if (true) {",
      /* 10*/
      "      return;",
      /* 11*/
      "    }",
      /* 12*/
      "  }",
      /* 13*/
      "}"
    ];
    const textModel = createTextModel(lines.join("\n"));
    try {
      const foldingModel = new FoldingModel(textModel, new TestDecorationProvider(textModel));
      const ranges = computeRanges(textModel, false, { start: /^\/\/#region$/, end: /^\/\/#endregion$/ });
      foldingModel.update(ranges);
      const r1 = r(1, 2, false);
      const r2 = r(3, 12, false);
      const r3 = r(4, 11, false);
      const r4 = r(5, 6, false);
      const r5 = r(9, 10, false);
      assertRanges(foldingModel, [r1, r2, r3, r4, r5]);
      setCollapseStateLevelsDown(foldingModel, true, Number.MAX_VALUE, [4]);
      assertFoldedRanges(foldingModel, [r3, r4, r5], "1");
      setCollapseStateLevelsDown(foldingModel, false, Number.MAX_VALUE, [8]);
      assertFoldedRanges(foldingModel, [], "2");
      setCollapseStateLevelsDown(foldingModel, true, Number.MAX_VALUE, [12]);
      assertFoldedRanges(foldingModel, [r2, r3, r4, r5], "1");
      setCollapseStateLevelsDown(foldingModel, false, Number.MAX_VALUE, [7]);
      assertFoldedRanges(foldingModel, [r2], "1");
      setCollapseStateLevelsDown(foldingModel, false);
      assertFoldedRanges(foldingModel, [], "1");
      setCollapseStateLevelsDown(foldingModel, true);
      assertFoldedRanges(foldingModel, [r1, r2, r3, r4, r5], "1");
    } finally {
      textModel.dispose();
    }
  });
  test("setCollapseStateAtLevel", () => {
    const lines = [
      /* 1*/
      "//#region",
      /* 2*/
      "//#endregion",
      /* 3*/
      "class A {",
      /* 4*/
      "  void foo() {",
      /* 5*/
      "    if (true) {",
      /* 6*/
      "        return;",
      /* 7*/
      "    }",
      /* 8*/
      "",
      /* 9*/
      "    if (true) {",
      /* 10*/
      "      return;",
      /* 11*/
      "    }",
      /* 12*/
      "  }",
      /* 13*/
      "  //#region",
      /* 14*/
      "  const bar = 9;",
      /* 15*/
      "  //#endregion",
      /* 16*/
      "}"
    ];
    const textModel = createTextModel(lines.join("\n"));
    try {
      const foldingModel = new FoldingModel(textModel, new TestDecorationProvider(textModel));
      const ranges = computeRanges(textModel, false, { start: /^\s*\/\/#region$/, end: /^\s*\/\/#endregion$/ });
      foldingModel.update(ranges);
      const r1 = r(1, 2, false);
      const r2 = r(3, 15, false);
      const r3 = r(4, 11, false);
      const r4 = r(5, 6, false);
      const r5 = r(9, 10, false);
      const r6 = r(13, 15, false);
      assertRanges(foldingModel, [r1, r2, r3, r4, r5, r6]);
      setCollapseStateAtLevel(foldingModel, 1, true, []);
      assertFoldedRanges(foldingModel, [r1, r2], "1");
      setCollapseStateAtLevel(foldingModel, 1, false, [5]);
      assertFoldedRanges(foldingModel, [r2], "2");
      setCollapseStateAtLevel(foldingModel, 1, false, [1]);
      assertFoldedRanges(foldingModel, [], "3");
      setCollapseStateAtLevel(foldingModel, 2, true, []);
      assertFoldedRanges(foldingModel, [r3, r6], "4");
      setCollapseStateAtLevel(foldingModel, 2, false, [5, 6]);
      assertFoldedRanges(foldingModel, [r3], "5");
      setCollapseStateAtLevel(foldingModel, 3, true, [4, 9]);
      assertFoldedRanges(foldingModel, [r3, r4], "6");
      setCollapseStateAtLevel(foldingModel, 3, false, [4, 9]);
      assertFoldedRanges(foldingModel, [r3], "7");
    } finally {
      textModel.dispose();
    }
  });
  test("setCollapseStateLevelsDown", () => {
    const lines = [
      /* 1*/
      "//#region",
      /* 2*/
      "//#endregion",
      /* 3*/
      "class A {",
      /* 4*/
      "  void foo() {",
      /* 5*/
      "    if (true) {",
      /* 6*/
      "        return;",
      /* 7*/
      "    }",
      /* 8*/
      "",
      /* 9*/
      "    if (true) {",
      /* 10*/
      "      return;",
      /* 11*/
      "    }",
      /* 12*/
      "  }",
      /* 13*/
      "}"
    ];
    const textModel = createTextModel(lines.join("\n"));
    try {
      const foldingModel = new FoldingModel(textModel, new TestDecorationProvider(textModel));
      const ranges = computeRanges(textModel, false, { start: /^\/\/#region$/, end: /^\/\/#endregion$/ });
      foldingModel.update(ranges);
      const r1 = r(1, 2, false);
      const r2 = r(3, 12, false);
      const r3 = r(4, 11, false);
      const r4 = r(5, 6, false);
      const r5 = r(9, 10, false);
      assertRanges(foldingModel, [r1, r2, r3, r4, r5]);
      setCollapseStateLevelsDown(foldingModel, true, 1, [4]);
      assertFoldedRanges(foldingModel, [r3], "1");
      setCollapseStateLevelsDown(foldingModel, true, 2, [4]);
      assertFoldedRanges(foldingModel, [r3, r4, r5], "2");
      setCollapseStateLevelsDown(foldingModel, false, 2, [3]);
      assertFoldedRanges(foldingModel, [r4, r5], "3");
      setCollapseStateLevelsDown(foldingModel, false, 2, [2]);
      assertFoldedRanges(foldingModel, [r4, r5], "4");
      setCollapseStateLevelsDown(foldingModel, true, 4, [2]);
      assertFoldedRanges(foldingModel, [r1, r4, r5], "5");
      setCollapseStateLevelsDown(foldingModel, false, 4, [2, 3]);
      assertFoldedRanges(foldingModel, [], "6");
    } finally {
      textModel.dispose();
    }
  });
  test("setCollapseStateLevelsUp", () => {
    const lines = [
      /* 1*/
      "//#region",
      /* 2*/
      "//#endregion",
      /* 3*/
      "class A {",
      /* 4*/
      "  void foo() {",
      /* 5*/
      "    if (true) {",
      /* 6*/
      "        return;",
      /* 7*/
      "    }",
      /* 8*/
      "",
      /* 9*/
      "    if (true) {",
      /* 10*/
      "      return;",
      /* 11*/
      "    }",
      /* 12*/
      "  }",
      /* 13*/
      "}"
    ];
    const textModel = createTextModel(lines.join("\n"));
    try {
      const foldingModel = new FoldingModel(textModel, new TestDecorationProvider(textModel));
      const ranges = computeRanges(textModel, false, { start: /^\/\/#region$/, end: /^\/\/#endregion$/ });
      foldingModel.update(ranges);
      const r1 = r(1, 2, false);
      const r2 = r(3, 12, false);
      const r3 = r(4, 11, false);
      const r4 = r(5, 6, false);
      const r5 = r(9, 10, false);
      assertRanges(foldingModel, [r1, r2, r3, r4, r5]);
      setCollapseStateLevelsUp(foldingModel, true, 1, [4]);
      assertFoldedRanges(foldingModel, [r3], "1");
      setCollapseStateLevelsUp(foldingModel, true, 2, [4]);
      assertFoldedRanges(foldingModel, [r2, r3], "2");
      setCollapseStateLevelsUp(foldingModel, false, 4, [1, 3, 4]);
      assertFoldedRanges(foldingModel, [], "3");
      setCollapseStateLevelsUp(foldingModel, true, 2, [10]);
      assertFoldedRanges(foldingModel, [r3, r5], "4");
    } finally {
      textModel.dispose();
    }
  });
  test("setCollapseStateUp", () => {
    const lines = [
      /* 1*/
      "//#region",
      /* 2*/
      "//#endregion",
      /* 3*/
      "class A {",
      /* 4*/
      "  void foo() {",
      /* 5*/
      "    if (true) {",
      /* 6*/
      "        return;",
      /* 7*/
      "    }",
      /* 8*/
      "",
      /* 9*/
      "    if (true) {",
      /* 10*/
      "      return;",
      /* 11*/
      "    }",
      /* 12*/
      "  }",
      /* 13*/
      "}"
    ];
    const textModel = createTextModel(lines.join("\n"));
    try {
      const foldingModel = new FoldingModel(textModel, new TestDecorationProvider(textModel));
      const ranges = computeRanges(textModel, false, { start: /^\/\/#region$/, end: /^\/\/#endregion$/ });
      foldingModel.update(ranges);
      const r1 = r(1, 2, false);
      const r2 = r(3, 12, false);
      const r3 = r(4, 11, false);
      const r4 = r(5, 6, false);
      const r5 = r(9, 10, false);
      assertRanges(foldingModel, [r1, r2, r3, r4, r5]);
      setCollapseStateUp(foldingModel, true, [5]);
      assertFoldedRanges(foldingModel, [r4], "1");
      setCollapseStateUp(foldingModel, true, [5]);
      assertFoldedRanges(foldingModel, [r3, r4], "2");
      setCollapseStateUp(foldingModel, true, [4]);
      assertFoldedRanges(foldingModel, [r2, r3, r4], "2");
    } finally {
      textModel.dispose();
    }
  });
  test("setCollapseStateForMatchingLines", () => {
    const lines = [
      /* 1*/
      "/**",
      /* 2*/
      " * the class",
      /* 3*/
      " */",
      /* 4*/
      "class A {",
      /* 5*/
      "  /**",
      /* 6*/
      "   * the foo",
      /* 7*/
      "   */",
      /* 8*/
      "  void foo() {",
      /* 9*/
      "    /*",
      /* 10*/
      "     * the comment",
      /* 11*/
      "     */",
      /* 12*/
      "  }",
      /* 13*/
      "}"
    ];
    const textModel = createTextModel(lines.join("\n"));
    try {
      const foldingModel = new FoldingModel(textModel, new TestDecorationProvider(textModel));
      const ranges = computeRanges(textModel, false, { start: /^\/\/#region$/, end: /^\/\/#endregion$/ });
      foldingModel.update(ranges);
      const r1 = r(1, 3, false);
      const r2 = r(4, 12, false);
      const r3 = r(5, 7, false);
      const r4 = r(8, 11, false);
      const r5 = r(9, 11, false);
      assertRanges(foldingModel, [r1, r2, r3, r4, r5]);
      const regExp = new RegExp("^\\s*" + escapeRegExpCharacters("/*"));
      setCollapseStateForMatchingLines(foldingModel, regExp, true);
      assertFoldedRanges(foldingModel, [r1, r3, r5], "1");
    } finally {
      textModel.dispose();
    }
  });
  test("setCollapseStateForRest", () => {
    const lines = [
      /* 1*/
      "//#region",
      /* 2*/
      "//#endregion",
      /* 3*/
      "class A {",
      /* 4*/
      "  void foo() {",
      /* 5*/
      "    if (true) {",
      /* 6*/
      "        return;",
      /* 7*/
      "    }",
      /* 8*/
      "",
      /* 9*/
      "    if (true) {",
      /* 10*/
      "      return;",
      /* 11*/
      "    }",
      /* 12*/
      "  }",
      /* 13*/
      "}"
    ];
    const textModel = createTextModel(lines.join("\n"));
    try {
      const foldingModel = new FoldingModel(textModel, new TestDecorationProvider(textModel));
      const ranges = computeRanges(textModel, false, { start: /^\/\/#region$/, end: /^\/\/#endregion$/ });
      foldingModel.update(ranges);
      const r1 = r(1, 2, false);
      const r2 = r(3, 12, false);
      const r3 = r(4, 11, false);
      const r4 = r(5, 6, false);
      const r5 = r(9, 10, false);
      assertRanges(foldingModel, [r1, r2, r3, r4, r5]);
      setCollapseStateForRest(foldingModel, true, [5]);
      assertFoldedRanges(foldingModel, [r1, r5], "1");
      setCollapseStateForRest(foldingModel, false, [5]);
      assertFoldedRanges(foldingModel, [], "2");
      setCollapseStateForRest(foldingModel, true, [1]);
      assertFoldedRanges(foldingModel, [r2, r3, r4, r5], "3");
      setCollapseStateForRest(foldingModel, true, [3]);
      assertFoldedRanges(foldingModel, [r1, r2, r3, r4, r5], "3");
    } finally {
      textModel.dispose();
    }
  });
  test("folding decoration", () => {
    const lines = [
      /* 1*/
      "class A {",
      /* 2*/
      "  void foo() {",
      /* 3*/
      "    if (true) {",
      /* 4*/
      "      hoo();",
      /* 5*/
      "    }",
      /* 6*/
      "  }",
      /* 7*/
      "}"
    ];
    const textModel = createTextModel(lines.join("\n"));
    try {
      const foldingModel = new FoldingModel(textModel, new TestDecorationProvider(textModel));
      const ranges = computeRanges(textModel, false, void 0);
      foldingModel.update(ranges);
      const r1 = r(1, 6, false);
      const r2 = r(2, 5, false);
      const r3 = r(3, 4, false);
      assertRanges(foldingModel, [r1, r2, r3]);
      assertDecorations(foldingModel, [d(1, "expanded"), d(2, "expanded"), d(3, "expanded")]);
      foldingModel.toggleCollapseState([foldingModel.getRegionAtLine(2)]);
      assertRanges(foldingModel, [r1, r(2, 5, true), r3]);
      assertDecorations(foldingModel, [d(1, "expanded"), d(2, "collapsed"), d(3, "hidden")]);
      foldingModel.update(ranges);
      assertRanges(foldingModel, [r1, r(2, 5, true), r3]);
      assertDecorations(foldingModel, [d(1, "expanded"), d(2, "collapsed"), d(3, "hidden")]);
      foldingModel.toggleCollapseState([foldingModel.getRegionAtLine(1)]);
      assertRanges(foldingModel, [r(1, 6, true), r(2, 5, true), r3]);
      assertDecorations(foldingModel, [d(1, "collapsed"), d(2, "hidden"), d(3, "hidden")]);
      foldingModel.update(ranges);
      assertRanges(foldingModel, [r(1, 6, true), r(2, 5, true), r3]);
      assertDecorations(foldingModel, [d(1, "collapsed"), d(2, "hidden"), d(3, "hidden")]);
      foldingModel.toggleCollapseState([foldingModel.getRegionAtLine(1), foldingModel.getRegionAtLine(3)]);
      assertRanges(foldingModel, [r1, r(2, 5, true), r(3, 4, true)]);
      assertDecorations(foldingModel, [d(1, "expanded"), d(2, "collapsed"), d(3, "hidden")]);
      foldingModel.update(ranges);
      assertRanges(foldingModel, [r1, r(2, 5, true), r(3, 4, true)]);
      assertDecorations(foldingModel, [d(1, "expanded"), d(2, "collapsed"), d(3, "hidden")]);
      textModel.dispose();
    } finally {
      textModel.dispose();
    }
  });
  test("fold jumping", () => {
    const lines = [
      /* 1*/
      "class A {",
      /* 2*/
      "  void foo() {",
      /* 3*/
      "    if (1) {",
      /* 4*/
      "      a();",
      /* 5*/
      "    } else if (2) {",
      /* 6*/
      "      if (true) {",
      /* 7*/
      "        b();",
      /* 8*/
      "      }",
      /* 9*/
      "    } else {",
      /* 10*/
      "      c();",
      /* 11*/
      "    }",
      /* 12*/
      "  }",
      /* 13*/
      "}"
    ];
    const textModel = createTextModel(lines.join("\n"));
    try {
      const foldingModel = new FoldingModel(textModel, new TestDecorationProvider(textModel));
      const ranges = computeRanges(textModel, false, void 0);
      foldingModel.update(ranges);
      const r1 = r(1, 12, false);
      const r2 = r(2, 11, false);
      const r3 = r(3, 4, false);
      const r4 = r(5, 8, false);
      const r5 = r(6, 7, false);
      const r6 = r(9, 10, false);
      assertRanges(foldingModel, [r1, r2, r3, r4, r5, r6]);
      assert.strictEqual(getParentFoldLine(7, foldingModel), 6);
      assert.strictEqual(getParentFoldLine(6, foldingModel), 5);
      assert.strictEqual(getParentFoldLine(5, foldingModel), 2);
      assert.strictEqual(getParentFoldLine(2, foldingModel), 1);
      assert.strictEqual(getParentFoldLine(1, foldingModel), null);
      assert.strictEqual(getPreviousFoldLine(10, foldingModel), 9);
      assert.strictEqual(getPreviousFoldLine(9, foldingModel), 5);
      assert.strictEqual(getPreviousFoldLine(5, foldingModel), 3);
      assert.strictEqual(getPreviousFoldLine(3, foldingModel), null);
      assert.strictEqual(getPreviousFoldLine(4, foldingModel), 3);
      assert.strictEqual(getPreviousFoldLine(7, foldingModel), 6);
      assert.strictEqual(getPreviousFoldLine(8, foldingModel), 6);
      assert.strictEqual(getNextFoldLine(3, foldingModel), 5);
      assert.strictEqual(getNextFoldLine(5, foldingModel), 9);
      assert.strictEqual(getNextFoldLine(9, foldingModel), null);
      assert.strictEqual(getNextFoldLine(4, foldingModel), 5);
      assert.strictEqual(getNextFoldLine(7, foldingModel), 9);
      assert.strictEqual(getNextFoldLine(8, foldingModel), 9);
    } finally {
      textModel.dispose();
    }
  });
  test("fold jumping issue #129503", () => {
    const lines = [
      /* 1*/
      "",
      /* 2*/
      "if True:",
      /* 3*/
      "  print(1)",
      /* 4*/
      "if True:",
      /* 5*/
      "  print(1)",
      /* 6*/
      ""
    ];
    const textModel = createTextModel(lines.join("\n"));
    try {
      const foldingModel = new FoldingModel(textModel, new TestDecorationProvider(textModel));
      const ranges = computeRanges(textModel, false, void 0);
      foldingModel.update(ranges);
      const r1 = r(2, 3, false);
      const r2 = r(4, 6, false);
      assertRanges(foldingModel, [r1, r2]);
      assert.strictEqual(getNextFoldLine(1, foldingModel), 2);
      assert.strictEqual(getNextFoldLine(2, foldingModel), 4);
      assert.strictEqual(getNextFoldLine(3, foldingModel), 4);
      assert.strictEqual(getNextFoldLine(4, foldingModel), null);
      assert.strictEqual(getNextFoldLine(5, foldingModel), null);
      assert.strictEqual(getNextFoldLine(6, foldingModel), null);
      assert.strictEqual(getPreviousFoldLine(1, foldingModel), null);
      assert.strictEqual(getPreviousFoldLine(2, foldingModel), null);
      assert.strictEqual(getPreviousFoldLine(3, foldingModel), 2);
      assert.strictEqual(getPreviousFoldLine(4, foldingModel), 2);
      assert.strictEqual(getPreviousFoldLine(5, foldingModel), 4);
      assert.strictEqual(getPreviousFoldLine(6, foldingModel), 4);
    } finally {
      textModel.dispose();
    }
  });
});
export {
  TestDecorationProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9mb2xkaW5nL3Rlc3QvYnJvd3Nlci9mb2xkaW5nTW9kZWwudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlc2NhcGVSZWdFeHBDaGFyYWN0ZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IEVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9lZGl0T3BlcmF0aW9uLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VBY2Nlc3NvciwgSVRleHRNb2RlbCwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcyB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBNb2RlbERlY29yYXRpb25PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL21vZGVsL3RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyB0b1NlbGVjdGVkTGluZXMgfSBmcm9tICcuLi8uLi9icm93c2VyL2ZvbGRpbmcuanMnO1xuaW1wb3J0IHsgRm9sZGluZ01vZGVsLCBnZXROZXh0Rm9sZExpbmUsIGdldFBhcmVudEZvbGRMaW5lLCBnZXRQcmV2aW91c0ZvbGRMaW5lLCBzZXRDb2xsYXBzZVN0YXRlQXRMZXZlbCwgc2V0Q29sbGFwc2VTdGF0ZUZvck1hdGNoaW5nTGluZXMsIHNldENvbGxhcHNlU3RhdGVGb3JSZXN0LCBzZXRDb2xsYXBzZVN0YXRlTGV2ZWxzRG93biwgc2V0Q29sbGFwc2VTdGF0ZUxldmVsc1VwLCBzZXRDb2xsYXBzZVN0YXRlVXAgfSBmcm9tICcuLi8uLi9icm93c2VyL2ZvbGRpbmdNb2RlbC5qcyc7XG5pbXBvcnQgeyBGb2xkaW5nUmVnaW9uIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9mb2xkaW5nUmFuZ2VzLmpzJztcbmltcG9ydCB7IGNvbXB1dGVSYW5nZXMgfSBmcm9tICcuLi8uLi9icm93c2VyL2luZGVudFJhbmdlUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgY3JlYXRlVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vdGVzdFRleHRNb2RlbC5qcyc7XG5cblxuaW50ZXJmYWNlIEV4cGVjdGVkUmVnaW9uIHtcblx0c3RhcnRMaW5lTnVtYmVyOiBudW1iZXI7XG5cdGVuZExpbmVOdW1iZXI6IG51bWJlcjtcblx0aXNDb2xsYXBzZWQ6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBFeHBlY3RlZERlY29yYXRpb24ge1xuXHRsaW5lOiBudW1iZXI7XG5cdHR5cGU6ICdoaWRkZW4nIHwgJ2NvbGxhcHNlZCcgfCAnZXhwYW5kZWQnO1xufVxuXG5leHBvcnQgY2xhc3MgVGVzdERlY29yYXRpb25Qcm92aWRlciB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgY29sbGFwc2VkRGVjb3JhdGlvbiA9IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMucmVnaXN0ZXIoe1xuXHRcdGRlc2NyaXB0aW9uOiAndGVzdCcsXG5cdFx0c3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsXG5cdFx0bGluZXNEZWNvcmF0aW9uc0NsYXNzTmFtZTogJ2ZvbGRpbmcnXG5cdH0pO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IGV4cGFuZGVkRGVjb3JhdGlvbiA9IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMucmVnaXN0ZXIoe1xuXHRcdGRlc2NyaXB0aW9uOiAndGVzdCcsXG5cdFx0c3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsXG5cdFx0bGluZXNEZWNvcmF0aW9uc0NsYXNzTmFtZTogJ2ZvbGRpbmcnXG5cdH0pO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IGhpZGRlbkRlY29yYXRpb24gPSBNb2RlbERlY29yYXRpb25PcHRpb25zLnJlZ2lzdGVyKHtcblx0XHRkZXNjcmlwdGlvbjogJ3Rlc3QnLFxuXHRcdHN0aWNraW5lc3M6IFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLFxuXHRcdGxpbmVzRGVjb3JhdGlvbnNDbGFzc05hbWU6ICdmb2xkaW5nJ1xuXHR9KTtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIG1vZGVsOiBJVGV4dE1vZGVsKSB7XG5cdH1cblxuXHRnZXREZWNvcmF0aW9uT3B0aW9uKGlzQ29sbGFwc2VkOiBib29sZWFuLCBpc0hpZGRlbjogYm9vbGVhbik6IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMge1xuXHRcdGlmIChpc0hpZGRlbikge1xuXHRcdFx0cmV0dXJuIFRlc3REZWNvcmF0aW9uUHJvdmlkZXIuaGlkZGVuRGVjb3JhdGlvbjtcblx0XHR9XG5cdFx0aWYgKGlzQ29sbGFwc2VkKSB7XG5cdFx0XHRyZXR1cm4gVGVzdERlY29yYXRpb25Qcm92aWRlci5jb2xsYXBzZWREZWNvcmF0aW9uO1xuXHRcdH1cblx0XHRyZXR1cm4gVGVzdERlY29yYXRpb25Qcm92aWRlci5leHBhbmRlZERlY29yYXRpb247XG5cdH1cblxuXHRjaGFuZ2VEZWNvcmF0aW9uczxUPihjYWxsYmFjazogKGNoYW5nZUFjY2Vzc29yOiBJTW9kZWxEZWNvcmF0aW9uc0NoYW5nZUFjY2Vzc29yKSA9PiBUKTogKFQgfCBudWxsKSB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuY2hhbmdlRGVjb3JhdGlvbnMoY2FsbGJhY2spO1xuXHR9XG5cblx0cmVtb3ZlRGVjb3JhdGlvbnMoZGVjb3JhdGlvbklkczogc3RyaW5nW10pOiB2b2lkIHtcblx0XHR0aGlzLm1vZGVsLmNoYW5nZURlY29yYXRpb25zKChjaGFuZ2VBY2Nlc3NvcikgPT4ge1xuXHRcdFx0Y2hhbmdlQWNjZXNzb3IuZGVsdGFEZWNvcmF0aW9ucyhkZWNvcmF0aW9uSWRzLCBbXSk7XG5cdFx0fSk7XG5cdH1cblxuXHRnZXREZWNvcmF0aW9ucygpOiBFeHBlY3RlZERlY29yYXRpb25bXSB7XG5cdFx0Y29uc3QgZGVjb3JhdGlvbnMgPSB0aGlzLm1vZGVsLmdldEFsbERlY29yYXRpb25zKCk7XG5cdFx0Y29uc3QgcmVzOiBFeHBlY3RlZERlY29yYXRpb25bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZGVjb3JhdGlvbiBvZiBkZWNvcmF0aW9ucykge1xuXHRcdFx0aWYgKGRlY29yYXRpb24ub3B0aW9ucyA9PT0gVGVzdERlY29yYXRpb25Qcm92aWRlci5oaWRkZW5EZWNvcmF0aW9uKSB7XG5cdFx0XHRcdHJlcy5wdXNoKHsgbGluZTogZGVjb3JhdGlvbi5yYW5nZS5zdGFydExpbmVOdW1iZXIsIHR5cGU6ICdoaWRkZW4nIH0pO1xuXHRcdFx0fSBlbHNlIGlmIChkZWNvcmF0aW9uLm9wdGlvbnMgPT09IFRlc3REZWNvcmF0aW9uUHJvdmlkZXIuY29sbGFwc2VkRGVjb3JhdGlvbikge1xuXHRcdFx0XHRyZXMucHVzaCh7IGxpbmU6IGRlY29yYXRpb24ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCB0eXBlOiAnY29sbGFwc2VkJyB9KTtcblx0XHRcdH0gZWxzZSBpZiAoZGVjb3JhdGlvbi5vcHRpb25zID09PSBUZXN0RGVjb3JhdGlvblByb3ZpZGVyLmV4cGFuZGVkRGVjb3JhdGlvbikge1xuXHRcdFx0XHRyZXMucHVzaCh7IGxpbmU6IGRlY29yYXRpb24ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCB0eXBlOiAnZXhwYW5kZWQnIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzO1xuXHR9XG59XG5cbnN1aXRlKCdGb2xkaW5nIE1vZGVsJywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblx0ZnVuY3Rpb24gcihzdGFydExpbmVOdW1iZXI6IG51bWJlciwgZW5kTGluZU51bWJlcjogbnVtYmVyLCBpc0NvbGxhcHNlZDogYm9vbGVhbiA9IGZhbHNlKTogRXhwZWN0ZWRSZWdpb24ge1xuXHRcdHJldHVybiB7IHN0YXJ0TGluZU51bWJlciwgZW5kTGluZU51bWJlciwgaXNDb2xsYXBzZWQgfTtcblx0fVxuXG5cdGZ1bmN0aW9uIGQobGluZTogbnVtYmVyLCB0eXBlOiAnaGlkZGVuJyB8ICdjb2xsYXBzZWQnIHwgJ2V4cGFuZGVkJyk6IEV4cGVjdGVkRGVjb3JhdGlvbiB7XG5cdFx0cmV0dXJuIHsgbGluZSwgdHlwZSB9O1xuXHR9XG5cblx0ZnVuY3Rpb24gYXNzZXJ0UmVnaW9uKGFjdHVhbDogRm9sZGluZ1JlZ2lvbiB8IG51bGwsIGV4cGVjdGVkOiBFeHBlY3RlZFJlZ2lvbiB8IG51bGwsIG1lc3NhZ2U/OiBzdHJpbmcpIHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoISFhY3R1YWwsICEhZXhwZWN0ZWQsIG1lc3NhZ2UpO1xuXHRcdGlmIChhY3R1YWwgJiYgZXhwZWN0ZWQpIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuc3RhcnRMaW5lTnVtYmVyLCBleHBlY3RlZC5zdGFydExpbmVOdW1iZXIsIG1lc3NhZ2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5lbmRMaW5lTnVtYmVyLCBleHBlY3RlZC5lbmRMaW5lTnVtYmVyLCBtZXNzYWdlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuaXNDb2xsYXBzZWQsIGV4cGVjdGVkLmlzQ29sbGFwc2VkLCBtZXNzYWdlKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBhc3NlcnRGb2xkZWRSYW5nZXMoZm9sZGluZ01vZGVsOiBGb2xkaW5nTW9kZWwsIGV4cGVjdGVkUmVnaW9uczogRXhwZWN0ZWRSZWdpb25bXSwgbWVzc2FnZT86IHN0cmluZykge1xuXHRcdGNvbnN0IGFjdHVhbFJhbmdlczogRXhwZWN0ZWRSZWdpb25bXSA9IFtdO1xuXHRcdGNvbnN0IGFjdHVhbCA9IGZvbGRpbmdNb2RlbC5yZWdpb25zO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgYWN0dWFsLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRpZiAoYWN0dWFsLmlzQ29sbGFwc2VkKGkpKSB7XG5cdFx0XHRcdGFjdHVhbFJhbmdlcy5wdXNoKHIoYWN0dWFsLmdldFN0YXJ0TGluZU51bWJlcihpKSwgYWN0dWFsLmdldEVuZExpbmVOdW1iZXIoaSkpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWxSYW5nZXMsIGV4cGVjdGVkUmVnaW9ucywgbWVzc2FnZSk7XG5cdH1cblxuXHRmdW5jdGlvbiBhc3NlcnRSYW5nZXMoZm9sZGluZ01vZGVsOiBGb2xkaW5nTW9kZWwsIGV4cGVjdGVkUmVnaW9uczogRXhwZWN0ZWRSZWdpb25bXSwgbWVzc2FnZT86IHN0cmluZykge1xuXHRcdGNvbnN0IGFjdHVhbFJhbmdlczogRXhwZWN0ZWRSZWdpb25bXSA9IFtdO1xuXHRcdGNvbnN0IGFjdHVhbCA9IGZvbGRpbmdNb2RlbC5yZWdpb25zO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgYWN0dWFsLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRhY3R1YWxSYW5nZXMucHVzaChyKGFjdHVhbC5nZXRTdGFydExpbmVOdW1iZXIoaSksIGFjdHVhbC5nZXRFbmRMaW5lTnVtYmVyKGkpLCBhY3R1YWwuaXNDb2xsYXBzZWQoaSkpKTtcblx0XHR9XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWxSYW5nZXMsIGV4cGVjdGVkUmVnaW9ucywgbWVzc2FnZSk7XG5cdH1cblxuXHRmdW5jdGlvbiBhc3NlcnREZWNvcmF0aW9ucyhmb2xkaW5nTW9kZWw6IEZvbGRpbmdNb2RlbCwgZXhwZWN0ZWREZWNvcmF0aW9uOiBFeHBlY3RlZERlY29yYXRpb25bXSwgbWVzc2FnZT86IHN0cmluZykge1xuXHRcdGNvbnN0IGRlY29yYXRpb25Qcm92aWRlciA9IGZvbGRpbmdNb2RlbC5kZWNvcmF0aW9uUHJvdmlkZXIgYXMgVGVzdERlY29yYXRpb25Qcm92aWRlcjtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGRlY29yYXRpb25Qcm92aWRlci5nZXREZWNvcmF0aW9ucygpLCBleHBlY3RlZERlY29yYXRpb24sIG1lc3NhZ2UpO1xuXHR9XG5cblx0ZnVuY3Rpb24gYXNzZXJ0UmVnaW9ucyhhY3R1YWw6IEZvbGRpbmdSZWdpb25bXSwgZXhwZWN0ZWRSZWdpb25zOiBFeHBlY3RlZFJlZ2lvbltdLCBtZXNzYWdlPzogc3RyaW5nKSB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubWFwKHIgPT4gKHsgc3RhcnRMaW5lTnVtYmVyOiByLnN0YXJ0TGluZU51bWJlciwgZW5kTGluZU51bWJlcjogci5lbmRMaW5lTnVtYmVyLCBpc0NvbGxhcHNlZDogci5pc0NvbGxhcHNlZCB9KSksIGV4cGVjdGVkUmVnaW9ucywgbWVzc2FnZSk7XG5cdH1cblxuXHR0ZXN0KCdnZXRSZWdpb25BdExpbmUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGluZXMgPSBbXG5cdFx0LyogMSovXHQnLyoqJyxcblx0XHQvKiAyKi9cdCcgKiBDb21tZW50Jyxcblx0XHQvKiAzKi9cdCcgKi8nLFxuXHRcdC8qIDQqL1x0J2NsYXNzIEEgeycsXG5cdFx0LyogNSovXHQnICB2b2lkIGZvbygpIHsnLFxuXHRcdC8qIDYqL1x0JyAgICAvLyBjb21tZW50IHsnLFxuXHRcdC8qIDcqL1x0JyAgfScsXG5cdFx0LyogOCovXHQnfSddO1xuXG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKGxpbmVzLmpvaW4oJ1xcbicpKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZm9sZGluZ01vZGVsID0gbmV3IEZvbGRpbmdNb2RlbCh0ZXh0TW9kZWwsIG5ldyBUZXN0RGVjb3JhdGlvblByb3ZpZGVyKHRleHRNb2RlbCkpO1xuXG5cdFx0XHRjb25zdCByYW5nZXMgPSBjb21wdXRlUmFuZ2VzKHRleHRNb2RlbCwgZmFsc2UsIHVuZGVmaW5lZCk7XG5cdFx0XHRmb2xkaW5nTW9kZWwudXBkYXRlKHJhbmdlcyk7XG5cblx0XHRcdGNvbnN0IHIxID0gcigxLCAzLCBmYWxzZSk7XG5cdFx0XHRjb25zdCByMiA9IHIoNCwgNywgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjMgPSByKDUsIDYsIGZhbHNlKTtcblxuXHRcdFx0YXNzZXJ0UmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3IxLCByMiwgcjNdKTtcblxuXHRcdFx0YXNzZXJ0UmVnaW9uKGZvbGRpbmdNb2RlbC5nZXRSZWdpb25BdExpbmUoMSksIHIxLCAnMScpO1xuXHRcdFx0YXNzZXJ0UmVnaW9uKGZvbGRpbmdNb2RlbC5nZXRSZWdpb25BdExpbmUoMiksIHIxLCAnMicpO1xuXHRcdFx0YXNzZXJ0UmVnaW9uKGZvbGRpbmdNb2RlbC5nZXRSZWdpb25BdExpbmUoMyksIHIxLCAnMycpO1xuXHRcdFx0YXNzZXJ0UmVnaW9uKGZvbGRpbmdNb2RlbC5nZXRSZWdpb25BdExpbmUoNCksIHIyLCAnNCcpO1xuXHRcdFx0YXNzZXJ0UmVnaW9uKGZvbGRpbmdNb2RlbC5nZXRSZWdpb25BdExpbmUoNSksIHIzLCAnNScpO1xuXHRcdFx0YXNzZXJ0UmVnaW9uKGZvbGRpbmdNb2RlbC5nZXRSZWdpb25BdExpbmUoNiksIHIzLCAnNScpO1xuXHRcdFx0YXNzZXJ0UmVnaW9uKGZvbGRpbmdNb2RlbC5nZXRSZWdpb25BdExpbmUoNyksIHIyLCAnNicpO1xuXHRcdFx0YXNzZXJ0UmVnaW9uKGZvbGRpbmdNb2RlbC5nZXRSZWdpb25BdExpbmUoOCksIG51bGwsICc3Jyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRleHRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0fVxuXG5cblx0fSk7XG5cblx0dGVzdCgnY29sbGFwc2UnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGluZXMgPSBbXG5cdFx0LyogMSovXHQnLyoqJyxcblx0XHQvKiAyKi9cdCcgKiBDb21tZW50Jyxcblx0XHQvKiAzKi9cdCcgKi8nLFxuXHRcdC8qIDQqL1x0J2NsYXNzIEEgeycsXG5cdFx0LyogNSovXHQnICB2b2lkIGZvbygpIHsnLFxuXHRcdC8qIDYqL1x0JyAgICAvLyBjb21tZW50IHsnLFxuXHRcdC8qIDcqL1x0JyAgfScsXG5cdFx0LyogOCovXHQnfSddO1xuXG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKGxpbmVzLmpvaW4oJ1xcbicpKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZm9sZGluZ01vZGVsID0gbmV3IEZvbGRpbmdNb2RlbCh0ZXh0TW9kZWwsIG5ldyBUZXN0RGVjb3JhdGlvblByb3ZpZGVyKHRleHRNb2RlbCkpO1xuXG5cdFx0XHRjb25zdCByYW5nZXMgPSBjb21wdXRlUmFuZ2VzKHRleHRNb2RlbCwgZmFsc2UsIHVuZGVmaW5lZCk7XG5cdFx0XHRmb2xkaW5nTW9kZWwudXBkYXRlKHJhbmdlcyk7XG5cblx0XHRcdGNvbnN0IHIxID0gcigxLCAzLCBmYWxzZSk7XG5cdFx0XHRjb25zdCByMiA9IHIoNCwgNywgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjMgPSByKDUsIDYsIGZhbHNlKTtcblxuXHRcdFx0YXNzZXJ0UmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3IxLCByMiwgcjNdKTtcblxuXHRcdFx0Zm9sZGluZ01vZGVsLnRvZ2dsZUNvbGxhcHNlU3RhdGUoW2ZvbGRpbmdNb2RlbC5nZXRSZWdpb25BdExpbmUoMSkhXSk7XG5cdFx0XHRmb2xkaW5nTW9kZWwudXBkYXRlKHJhbmdlcyk7XG5cblx0XHRcdGFzc2VydFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyKDEsIDMsIHRydWUpLCByMiwgcjNdKTtcblxuXHRcdFx0Zm9sZGluZ01vZGVsLnRvZ2dsZUNvbGxhcHNlU3RhdGUoW2ZvbGRpbmdNb2RlbC5nZXRSZWdpb25BdExpbmUoNSkhXSk7XG5cdFx0XHRmb2xkaW5nTW9kZWwudXBkYXRlKHJhbmdlcyk7XG5cblx0XHRcdGFzc2VydFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyKDEsIDMsIHRydWUpLCByMiwgcig1LCA2LCB0cnVlKV0pO1xuXG5cdFx0XHRmb2xkaW5nTW9kZWwudG9nZ2xlQ29sbGFwc2VTdGF0ZShbZm9sZGluZ01vZGVsLmdldFJlZ2lvbkF0TGluZSg3KSFdKTtcblx0XHRcdGZvbGRpbmdNb2RlbC51cGRhdGUocmFuZ2VzKTtcblxuXHRcdFx0YXNzZXJ0UmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3IoMSwgMywgdHJ1ZSksIHIoNCwgNywgdHJ1ZSksIHIoNSwgNiwgdHJ1ZSldKTtcblxuXHRcdFx0dGV4dE1vZGVsLmRpc3Bvc2UoKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGV4dE1vZGVsLmRpc3Bvc2UoKTtcblx0XHR9XG5cblx0fSk7XG5cblx0dGVzdCgndXBkYXRlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpbmVzID0gW1xuXHRcdC8qIDEqL1x0Jy8qKicsXG5cdFx0LyogMiovXHQnICogQ29tbWVudCcsXG5cdFx0LyogMyovXHQnICovJyxcblx0XHQvKiA0Ki9cdCdjbGFzcyBBIHsnLFxuXHRcdC8qIDUqL1x0JyAgdm9pZCBmb28oKSB7Jyxcblx0XHQvKiA2Ki9cdCcgICAgLy8gY29tbWVudCB7Jyxcblx0XHQvKiA3Ki9cdCcgIH0nLFxuXHRcdC8qIDgqL1x0J30nXTtcblxuXHRcdGNvbnN0IHRleHRNb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChsaW5lcy5qb2luKCdcXG4nKSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGZvbGRpbmdNb2RlbCA9IG5ldyBGb2xkaW5nTW9kZWwodGV4dE1vZGVsLCBuZXcgVGVzdERlY29yYXRpb25Qcm92aWRlcih0ZXh0TW9kZWwpKTtcblxuXHRcdFx0Y29uc3QgcmFuZ2VzID0gY29tcHV0ZVJhbmdlcyh0ZXh0TW9kZWwsIGZhbHNlLCB1bmRlZmluZWQpO1xuXHRcdFx0Zm9sZGluZ01vZGVsLnVwZGF0ZShyYW5nZXMpO1xuXG5cdFx0XHRjb25zdCByMSA9IHIoMSwgMywgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjIgPSByKDQsIDcsIGZhbHNlKTtcblx0XHRcdGNvbnN0IHIzID0gcig1LCA2LCBmYWxzZSk7XG5cblx0XHRcdGFzc2VydFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyMSwgcjIsIHIzXSk7XG5cdFx0XHRmb2xkaW5nTW9kZWwudG9nZ2xlQ29sbGFwc2VTdGF0ZShbZm9sZGluZ01vZGVsLmdldFJlZ2lvbkF0TGluZSgyKSEsIGZvbGRpbmdNb2RlbC5nZXRSZWdpb25BdExpbmUoNSkhXSk7XG5cblx0XHRcdHRleHRNb2RlbC5hcHBseUVkaXRzKFtFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oNCwgMSksICcvL2hlbGxvXFxuJyldKTtcblxuXHRcdFx0Zm9sZGluZ01vZGVsLnVwZGF0ZShjb21wdXRlUmFuZ2VzKHRleHRNb2RlbCwgZmFsc2UsIHVuZGVmaW5lZCkpO1xuXG5cdFx0XHRhc3NlcnRSYW5nZXMoZm9sZGluZ01vZGVsLCBbcigxLCAzLCB0cnVlKSwgcig1LCA4LCBmYWxzZSksIHIoNiwgNywgdHJ1ZSldKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGV4dE1vZGVsLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZScsICgpID0+IHtcblx0XHRjb25zdCBsaW5lcyA9IFtcblx0XHQvKiAxKi9cdCdmdW5jdGlvbiBmb28oKSB7Jyxcblx0XHQvKiAyKi9cdCcgIHN3aXRjaCAoeCkgeycsXG5cdFx0LyogMyovXHQnICAgIGNhc2UgMTonLFxuXHRcdC8qIDQqL1x0JyAgICAgIC8vaGVsbG8xJyxcblx0XHQvKiA1Ki9cdCcgICAgICBicmVhazsnLFxuXHRcdC8qIDYqL1x0JyAgICBjYXNlIDI6Jyxcblx0XHQvKiA3Ki9cdCcgICAgICAvL2hlbGxvMicsXG5cdFx0LyogOCovXHQnICAgICAgYnJlYWs7Jyxcblx0XHQvKiA5Ki9cdCcgICAgY2FzZSAzOicsXG5cdFx0LyogMTAqL1x0JyAgICAgIC8vaGVsbG8zJyxcblx0XHQvKiAxMSovXHQnICAgICAgYnJlYWs7Jyxcblx0XHQvKiAxMiovXHQnICB9Jyxcblx0XHQvKiAxMyovXHQnfSddO1xuXG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKGxpbmVzLmpvaW4oJ1xcbicpKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZm9sZGluZ01vZGVsID0gbmV3IEZvbGRpbmdNb2RlbCh0ZXh0TW9kZWwsIG5ldyBUZXN0RGVjb3JhdGlvblByb3ZpZGVyKHRleHRNb2RlbCkpO1xuXG5cdFx0XHRjb25zdCByYW5nZXMgPSBjb21wdXRlUmFuZ2VzKHRleHRNb2RlbCwgZmFsc2UsIHVuZGVmaW5lZCk7XG5cdFx0XHRmb2xkaW5nTW9kZWwudXBkYXRlKHJhbmdlcyk7XG5cblx0XHRcdGNvbnN0IHIxID0gcigxLCAxMiwgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjIgPSByKDIsIDExLCBmYWxzZSk7XG5cdFx0XHRjb25zdCByMyA9IHIoMywgNSwgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjQgPSByKDYsIDgsIGZhbHNlKTtcblx0XHRcdGNvbnN0IHI1ID0gcig5LCAxMSwgZmFsc2UpO1xuXG5cdFx0XHRhc3NlcnRSYW5nZXMoZm9sZGluZ01vZGVsLCBbcjEsIHIyLCByMywgcjQsIHI1XSk7XG5cdFx0XHRmb2xkaW5nTW9kZWwudG9nZ2xlQ29sbGFwc2VTdGF0ZShbZm9sZGluZ01vZGVsLmdldFJlZ2lvbkF0TGluZSg2KSFdKTtcblxuXHRcdFx0dGV4dE1vZGVsLmFwcGx5RWRpdHMoW0VkaXRPcGVyYXRpb24uZGVsZXRlKG5ldyBSYW5nZSg2LCAxMSwgOSwgMCkpXSk7XG5cblx0XHRcdGZvbGRpbmdNb2RlbC51cGRhdGUoY29tcHV0ZVJhbmdlcyh0ZXh0TW9kZWwsIHRydWUsIHVuZGVmaW5lZCksIHRvU2VsZWN0ZWRMaW5lcyhbbmV3IFNlbGVjdGlvbig3LCAxLCA3LCAxKV0pKTtcblxuXHRcdFx0YXNzZXJ0UmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3IoMSwgOSwgZmFsc2UpLCByKDIsIDgsIGZhbHNlKSwgcigzLCA1LCBmYWxzZSksIHIoNiwgOCwgZmFsc2UpXSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRleHRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdnZXRSZWdpb25zSW5zaWRlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpbmVzID0gW1xuXHRcdC8qIDEqL1x0Jy8qKicsXG5cdFx0LyogMiovXHQnICogQ29tbWVudCcsXG5cdFx0LyogMyovXHQnICovJyxcblx0XHQvKiA0Ki9cdCdjbGFzcyBBIHsnLFxuXHRcdC8qIDUqL1x0JyAgdm9pZCBmb28oKSB7Jyxcblx0XHQvKiA2Ki9cdCcgICAgLy8gY29tbWVudCB7Jyxcblx0XHQvKiA3Ki9cdCcgIH0nLFxuXHRcdC8qIDgqL1x0J30nXTtcblxuXHRcdGNvbnN0IHRleHRNb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChsaW5lcy5qb2luKCdcXG4nKSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGZvbGRpbmdNb2RlbCA9IG5ldyBGb2xkaW5nTW9kZWwodGV4dE1vZGVsLCBuZXcgVGVzdERlY29yYXRpb25Qcm92aWRlcih0ZXh0TW9kZWwpKTtcblxuXHRcdFx0Y29uc3QgcmFuZ2VzID0gY29tcHV0ZVJhbmdlcyh0ZXh0TW9kZWwsIGZhbHNlLCB1bmRlZmluZWQpO1xuXHRcdFx0Zm9sZGluZ01vZGVsLnVwZGF0ZShyYW5nZXMpO1xuXG5cdFx0XHRjb25zdCByMSA9IHIoMSwgMywgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjIgPSByKDQsIDcsIGZhbHNlKTtcblx0XHRcdGNvbnN0IHIzID0gcig1LCA2LCBmYWxzZSk7XG5cblx0XHRcdGFzc2VydFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyMSwgcjIsIHIzXSk7XG5cdFx0XHRjb25zdCByZWdpb24xID0gZm9sZGluZ01vZGVsLmdldFJlZ2lvbkF0TGluZShyMS5zdGFydExpbmVOdW1iZXIpO1xuXHRcdFx0Y29uc3QgcmVnaW9uMiA9IGZvbGRpbmdNb2RlbC5nZXRSZWdpb25BdExpbmUocjIuc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRcdGNvbnN0IHJlZ2lvbjMgPSBmb2xkaW5nTW9kZWwuZ2V0UmVnaW9uQXRMaW5lKHIzLnN0YXJ0TGluZU51bWJlcik7XG5cblx0XHRcdGFzc2VydFJlZ2lvbnMoZm9sZGluZ01vZGVsLmdldFJlZ2lvbnNJbnNpZGUobnVsbCksIFtyMSwgcjIsIHIzXSwgJzEnKTtcblx0XHRcdGFzc2VydFJlZ2lvbnMoZm9sZGluZ01vZGVsLmdldFJlZ2lvbnNJbnNpZGUocmVnaW9uMSksIFtdLCAnMicpO1xuXHRcdFx0YXNzZXJ0UmVnaW9ucyhmb2xkaW5nTW9kZWwuZ2V0UmVnaW9uc0luc2lkZShyZWdpb24yKSwgW3IzXSwgJzMnKTtcblx0XHRcdGFzc2VydFJlZ2lvbnMoZm9sZGluZ01vZGVsLmdldFJlZ2lvbnNJbnNpZGUocmVnaW9uMyksIFtdLCAnNCcpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0ZXh0TW9kZWwuZGlzcG9zZSgpO1xuXHRcdH1cblxuXHR9KTtcblxuXHR0ZXN0KCdnZXRSZWdpb25zSW5zaWRlV2l0aExldmVsJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpbmVzID0gW1xuXHRcdFx0LyogMSovXHQnLy8jcmVnaW9uJyxcblx0XHRcdC8qIDIqL1x0Jy8vI2VuZHJlZ2lvbicsXG5cdFx0XHQvKiAzKi9cdCdjbGFzcyBBIHsnLFxuXHRcdFx0LyogNCovXHQnICB2b2lkIGZvbygpIHsnLFxuXHRcdFx0LyogNSovXHQnICAgIGlmICh0cnVlKSB7Jyxcblx0XHRcdC8qIDYqL1x0JyAgICAgICAgcmV0dXJuOycsXG5cdFx0XHQvKiA3Ki9cdCcgICAgfScsXG5cdFx0XHQvKiA4Ki9cdCcgICAgaWYgKHRydWUpIHsnLFxuXHRcdFx0LyogOSovXHQnICAgICAgcmV0dXJuOycsXG5cdFx0XHQvKiAxMCovXHQnICAgIH0nLFxuXHRcdFx0LyogMTEqL1x0JyAgfScsXG5cdFx0XHQvKiAxMiovXHQnfSddO1xuXG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKGxpbmVzLmpvaW4oJ1xcbicpKTtcblx0XHR0cnkge1xuXG5cdFx0XHRjb25zdCBmb2xkaW5nTW9kZWwgPSBuZXcgRm9sZGluZ01vZGVsKHRleHRNb2RlbCwgbmV3IFRlc3REZWNvcmF0aW9uUHJvdmlkZXIodGV4dE1vZGVsKSk7XG5cblx0XHRcdGNvbnN0IHJhbmdlcyA9IGNvbXB1dGVSYW5nZXModGV4dE1vZGVsLCBmYWxzZSwgeyBzdGFydDogL15cXC9cXC8jcmVnaW9uJC8sIGVuZDogL15cXC9cXC8jZW5kcmVnaW9uJC8gfSk7XG5cdFx0XHRmb2xkaW5nTW9kZWwudXBkYXRlKHJhbmdlcyk7XG5cblx0XHRcdGNvbnN0IHIxID0gcigxLCAyLCBmYWxzZSk7XG5cdFx0XHRjb25zdCByMiA9IHIoMywgMTEsIGZhbHNlKTtcblx0XHRcdGNvbnN0IHIzID0gcig0LCAxMCwgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjQgPSByKDUsIDYsIGZhbHNlKTtcblx0XHRcdGNvbnN0IHI1ID0gcig4LCA5LCBmYWxzZSk7XG5cblx0XHRcdGNvbnN0IHJlZ2lvbjEgPSBmb2xkaW5nTW9kZWwuZ2V0UmVnaW9uQXRMaW5lKHIxLnN0YXJ0TGluZU51bWJlcik7XG5cdFx0XHRjb25zdCByZWdpb24yID0gZm9sZGluZ01vZGVsLmdldFJlZ2lvbkF0TGluZShyMi5zdGFydExpbmVOdW1iZXIpO1xuXHRcdFx0Y29uc3QgcmVnaW9uMyA9IGZvbGRpbmdNb2RlbC5nZXRSZWdpb25BdExpbmUocjMuc3RhcnRMaW5lTnVtYmVyKTtcblxuXHRcdFx0YXNzZXJ0UmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3IxLCByMiwgcjMsIHI0LCByNV0pO1xuXG5cdFx0XHRhc3NlcnRSZWdpb25zKGZvbGRpbmdNb2RlbC5nZXRSZWdpb25zSW5zaWRlKG51bGwsIChyLCBsZXZlbCkgPT4gbGV2ZWwgPT09IDEpLCBbcjEsIHIyXSwgJzEnKTtcblx0XHRcdGFzc2VydFJlZ2lvbnMoZm9sZGluZ01vZGVsLmdldFJlZ2lvbnNJbnNpZGUobnVsbCwgKHIsIGxldmVsKSA9PiBsZXZlbCA9PT0gMiksIFtyM10sICcyJyk7XG5cdFx0XHRhc3NlcnRSZWdpb25zKGZvbGRpbmdNb2RlbC5nZXRSZWdpb25zSW5zaWRlKG51bGwsIChyLCBsZXZlbCkgPT4gbGV2ZWwgPT09IDMpLCBbcjQsIHI1XSwgJzMnKTtcblxuXHRcdFx0YXNzZXJ0UmVnaW9ucyhmb2xkaW5nTW9kZWwuZ2V0UmVnaW9uc0luc2lkZShyZWdpb24yLCAociwgbGV2ZWwpID0+IGxldmVsID09PSAxKSwgW3IzXSwgJzQnKTtcblx0XHRcdGFzc2VydFJlZ2lvbnMoZm9sZGluZ01vZGVsLmdldFJlZ2lvbnNJbnNpZGUocmVnaW9uMiwgKHIsIGxldmVsKSA9PiBsZXZlbCA9PT0gMiksIFtyNCwgcjVdLCAnNScpO1xuXHRcdFx0YXNzZXJ0UmVnaW9ucyhmb2xkaW5nTW9kZWwuZ2V0UmVnaW9uc0luc2lkZShyZWdpb24zLCAociwgbGV2ZWwpID0+IGxldmVsID09PSAxKSwgW3I0LCByNV0sICc2Jyk7XG5cblx0XHRcdGFzc2VydFJlZ2lvbnMoZm9sZGluZ01vZGVsLmdldFJlZ2lvbnNJbnNpZGUocmVnaW9uMiwgKHIsIGxldmVsKSA9PiByLmhpZGVzTGluZSg5KSksIFtyMywgcjVdLCAnNycpO1xuXG5cdFx0XHRhc3NlcnRSZWdpb25zKGZvbGRpbmdNb2RlbC5nZXRSZWdpb25zSW5zaWRlKHJlZ2lvbjEsIChyLCBsZXZlbCkgPT4gbGV2ZWwgPT09IDEpLCBbXSwgJzgnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGV4dE1vZGVsLmRpc3Bvc2UoKTtcblx0XHR9XG5cblx0fSk7XG5cblx0dGVzdCgnZ2V0UmVnaW9uQXRMaW5lMicsICgpID0+IHtcblx0XHRjb25zdCBsaW5lcyA9IFtcblx0XHQvKiAxKi9cdCcvLyNyZWdpb24nLFxuXHRcdC8qIDIqL1x0J2NsYXNzIEEgeycsXG5cdFx0LyogMyovXHQnICB2b2lkIGZvbygpIHsnLFxuXHRcdC8qIDQqL1x0JyAgICBpZiAodHJ1ZSkgeycsXG5cdFx0LyogNSovXHQnICAgICAgLy9oZWxsbycsXG5cdFx0LyogNiovXHQnICAgIH0nLFxuXHRcdC8qIDcqL1x0JycsXG5cdFx0LyogOCovXHQnICB9Jyxcblx0XHQvKiA5Ki9cdCd9Jyxcblx0XHQvKiAxMCovXHQnLy8jZW5kcmVnaW9uJyxcblx0XHQvKiAxMSovXHQnJ107XG5cblx0XHRjb25zdCB0ZXh0TW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwobGluZXMuam9pbignXFxuJykpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBmb2xkaW5nTW9kZWwgPSBuZXcgRm9sZGluZ01vZGVsKHRleHRNb2RlbCwgbmV3IFRlc3REZWNvcmF0aW9uUHJvdmlkZXIodGV4dE1vZGVsKSk7XG5cblx0XHRcdGNvbnN0IHJhbmdlcyA9IGNvbXB1dGVSYW5nZXModGV4dE1vZGVsLCBmYWxzZSwgeyBzdGFydDogL15cXC9cXC8jcmVnaW9uJC8sIGVuZDogL15cXC9cXC8jZW5kcmVnaW9uJC8gfSk7XG5cdFx0XHRmb2xkaW5nTW9kZWwudXBkYXRlKHJhbmdlcyk7XG5cblx0XHRcdGNvbnN0IHIxID0gcigxLCAxMCwgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjIgPSByKDIsIDgsIGZhbHNlKTtcblx0XHRcdGNvbnN0IHIzID0gcigzLCA3LCBmYWxzZSk7XG5cdFx0XHRjb25zdCByNCA9IHIoNCwgNSwgZmFsc2UpO1xuXG5cdFx0XHRhc3NlcnRSYW5nZXMoZm9sZGluZ01vZGVsLCBbcjEsIHIyLCByMywgcjRdKTtcblxuXHRcdFx0YXNzZXJ0UmVnaW9ucyhmb2xkaW5nTW9kZWwuZ2V0QWxsUmVnaW9uc0F0TGluZSgxKSwgW3IxXSwgJzEnKTtcblx0XHRcdGFzc2VydFJlZ2lvbnMoZm9sZGluZ01vZGVsLmdldEFsbFJlZ2lvbnNBdExpbmUoMiksIFtyMSwgcjJdLnJldmVyc2UoKSwgJzInKTtcblx0XHRcdGFzc2VydFJlZ2lvbnMoZm9sZGluZ01vZGVsLmdldEFsbFJlZ2lvbnNBdExpbmUoMyksIFtyMSwgcjIsIHIzXS5yZXZlcnNlKCksICczJyk7XG5cdFx0XHRhc3NlcnRSZWdpb25zKGZvbGRpbmdNb2RlbC5nZXRBbGxSZWdpb25zQXRMaW5lKDQpLCBbcjEsIHIyLCByMywgcjRdLnJldmVyc2UoKSwgJzQnKTtcblx0XHRcdGFzc2VydFJlZ2lvbnMoZm9sZGluZ01vZGVsLmdldEFsbFJlZ2lvbnNBdExpbmUoNSksIFtyMSwgcjIsIHIzLCByNF0ucmV2ZXJzZSgpLCAnNScpO1xuXHRcdFx0YXNzZXJ0UmVnaW9ucyhmb2xkaW5nTW9kZWwuZ2V0QWxsUmVnaW9uc0F0TGluZSg2KSwgW3IxLCByMiwgcjNdLnJldmVyc2UoKSwgJzYnKTtcblx0XHRcdGFzc2VydFJlZ2lvbnMoZm9sZGluZ01vZGVsLmdldEFsbFJlZ2lvbnNBdExpbmUoNyksIFtyMSwgcjIsIHIzXS5yZXZlcnNlKCksICc3Jyk7XG5cdFx0XHRhc3NlcnRSZWdpb25zKGZvbGRpbmdNb2RlbC5nZXRBbGxSZWdpb25zQXRMaW5lKDgpLCBbcjEsIHIyXS5yZXZlcnNlKCksICc4Jyk7XG5cdFx0XHRhc3NlcnRSZWdpb25zKGZvbGRpbmdNb2RlbC5nZXRBbGxSZWdpb25zQXRMaW5lKDkpLCBbcjFdLCAnOScpO1xuXHRcdFx0YXNzZXJ0UmVnaW9ucyhmb2xkaW5nTW9kZWwuZ2V0QWxsUmVnaW9uc0F0TGluZSgxMCksIFtyMV0sICcxMCcpO1xuXHRcdFx0YXNzZXJ0UmVnaW9ucyhmb2xkaW5nTW9kZWwuZ2V0QWxsUmVnaW9uc0F0TGluZSgxMSksIFtdLCAnMTAnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGV4dE1vZGVsLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ3NldENvbGxhcHNlU3RhdGVSZWN1cnNpdmx5JywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpbmVzID0gW1xuXHRcdC8qIDEqL1x0Jy8vI3JlZ2lvbicsXG5cdFx0LyogMiovXHQnLy8jZW5kcmVnaW9uJyxcblx0XHQvKiAzKi9cdCdjbGFzcyBBIHsnLFxuXHRcdC8qIDQqL1x0JyAgdm9pZCBmb28oKSB7Jyxcblx0XHQvKiA1Ki9cdCcgICAgaWYgKHRydWUpIHsnLFxuXHRcdC8qIDYqL1x0JyAgICAgICAgcmV0dXJuOycsXG5cdFx0LyogNyovXHQnICAgIH0nLFxuXHRcdC8qIDgqL1x0JycsXG5cdFx0LyogOSovXHQnICAgIGlmICh0cnVlKSB7Jyxcblx0XHQvKiAxMCovXHQnICAgICAgcmV0dXJuOycsXG5cdFx0LyogMTEqL1x0JyAgICB9Jyxcblx0XHQvKiAxMiovXHQnICB9Jyxcblx0XHQvKiAxMyovXHQnfSddO1xuXG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKGxpbmVzLmpvaW4oJ1xcbicpKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZm9sZGluZ01vZGVsID0gbmV3IEZvbGRpbmdNb2RlbCh0ZXh0TW9kZWwsIG5ldyBUZXN0RGVjb3JhdGlvblByb3ZpZGVyKHRleHRNb2RlbCkpO1xuXG5cdFx0XHRjb25zdCByYW5nZXMgPSBjb21wdXRlUmFuZ2VzKHRleHRNb2RlbCwgZmFsc2UsIHsgc3RhcnQ6IC9eXFwvXFwvI3JlZ2lvbiQvLCBlbmQ6IC9eXFwvXFwvI2VuZHJlZ2lvbiQvIH0pO1xuXHRcdFx0Zm9sZGluZ01vZGVsLnVwZGF0ZShyYW5nZXMpO1xuXG5cdFx0XHRjb25zdCByMSA9IHIoMSwgMiwgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjIgPSByKDMsIDEyLCBmYWxzZSk7XG5cdFx0XHRjb25zdCByMyA9IHIoNCwgMTEsIGZhbHNlKTtcblx0XHRcdGNvbnN0IHI0ID0gcig1LCA2LCBmYWxzZSk7XG5cdFx0XHRjb25zdCByNSA9IHIoOSwgMTAsIGZhbHNlKTtcblx0XHRcdGFzc2VydFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyMSwgcjIsIHIzLCByNCwgcjVdKTtcblxuXHRcdFx0c2V0Q29sbGFwc2VTdGF0ZUxldmVsc0Rvd24oZm9sZGluZ01vZGVsLCB0cnVlLCBOdW1iZXIuTUFYX1ZBTFVFLCBbNF0pO1xuXHRcdFx0YXNzZXJ0Rm9sZGVkUmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3IzLCByNCwgcjVdLCAnMScpO1xuXG5cdFx0XHRzZXRDb2xsYXBzZVN0YXRlTGV2ZWxzRG93bihmb2xkaW5nTW9kZWwsIGZhbHNlLCBOdW1iZXIuTUFYX1ZBTFVFLCBbOF0pO1xuXHRcdFx0YXNzZXJ0Rm9sZGVkUmFuZ2VzKGZvbGRpbmdNb2RlbCwgW10sICcyJyk7XG5cblx0XHRcdHNldENvbGxhcHNlU3RhdGVMZXZlbHNEb3duKGZvbGRpbmdNb2RlbCwgdHJ1ZSwgTnVtYmVyLk1BWF9WQUxVRSwgWzEyXSk7XG5cdFx0XHRhc3NlcnRGb2xkZWRSYW5nZXMoZm9sZGluZ01vZGVsLCBbcjIsIHIzLCByNCwgcjVdLCAnMScpO1xuXG5cdFx0XHRzZXRDb2xsYXBzZVN0YXRlTGV2ZWxzRG93bihmb2xkaW5nTW9kZWwsIGZhbHNlLCBOdW1iZXIuTUFYX1ZBTFVFLCBbN10pO1xuXHRcdFx0YXNzZXJ0Rm9sZGVkUmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3IyXSwgJzEnKTtcblxuXHRcdFx0c2V0Q29sbGFwc2VTdGF0ZUxldmVsc0Rvd24oZm9sZGluZ01vZGVsLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRGb2xkZWRSYW5nZXMoZm9sZGluZ01vZGVsLCBbXSwgJzEnKTtcblxuXHRcdFx0c2V0Q29sbGFwc2VTdGF0ZUxldmVsc0Rvd24oZm9sZGluZ01vZGVsLCB0cnVlKTtcblx0XHRcdGFzc2VydEZvbGRlZFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyMSwgcjIsIHIzLCByNCwgcjVdLCAnMScpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0ZXh0TW9kZWwuZGlzcG9zZSgpO1xuXHRcdH1cblxuXHR9KTtcblxuXHR0ZXN0KCdzZXRDb2xsYXBzZVN0YXRlQXRMZXZlbCcsICgpID0+IHtcblx0XHRjb25zdCBsaW5lcyA9IFtcblx0XHQvKiAxKi9cdCcvLyNyZWdpb24nLFxuXHRcdC8qIDIqL1x0Jy8vI2VuZHJlZ2lvbicsXG5cdFx0LyogMyovXHQnY2xhc3MgQSB7Jyxcblx0XHQvKiA0Ki9cdCcgIHZvaWQgZm9vKCkgeycsXG5cdFx0LyogNSovXHQnICAgIGlmICh0cnVlKSB7Jyxcblx0XHQvKiA2Ki9cdCcgICAgICAgIHJldHVybjsnLFxuXHRcdC8qIDcqL1x0JyAgICB9Jyxcblx0XHQvKiA4Ki9cdCcnLFxuXHRcdC8qIDkqL1x0JyAgICBpZiAodHJ1ZSkgeycsXG5cdFx0LyogMTAqL1x0JyAgICAgIHJldHVybjsnLFxuXHRcdC8qIDExKi9cdCcgICAgfScsXG5cdFx0LyogMTIqL1x0JyAgfScsXG5cdFx0LyogMTMqL1x0JyAgLy8jcmVnaW9uJyxcblx0XHQvKiAxNCovXHQnICBjb25zdCBiYXIgPSA5OycsXG5cdFx0LyogMTUqL1x0JyAgLy8jZW5kcmVnaW9uJyxcblx0XHQvKiAxNiovXHQnfSddO1xuXG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKGxpbmVzLmpvaW4oJ1xcbicpKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZm9sZGluZ01vZGVsID0gbmV3IEZvbGRpbmdNb2RlbCh0ZXh0TW9kZWwsIG5ldyBUZXN0RGVjb3JhdGlvblByb3ZpZGVyKHRleHRNb2RlbCkpO1xuXG5cdFx0XHRjb25zdCByYW5nZXMgPSBjb21wdXRlUmFuZ2VzKHRleHRNb2RlbCwgZmFsc2UsIHsgc3RhcnQ6IC9eXFxzKlxcL1xcLyNyZWdpb24kLywgZW5kOiAvXlxccypcXC9cXC8jZW5kcmVnaW9uJC8gfSk7XG5cdFx0XHRmb2xkaW5nTW9kZWwudXBkYXRlKHJhbmdlcyk7XG5cblx0XHRcdGNvbnN0IHIxID0gcigxLCAyLCBmYWxzZSk7XG5cdFx0XHRjb25zdCByMiA9IHIoMywgMTUsIGZhbHNlKTtcblx0XHRcdGNvbnN0IHIzID0gcig0LCAxMSwgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjQgPSByKDUsIDYsIGZhbHNlKTtcblx0XHRcdGNvbnN0IHI1ID0gcig5LCAxMCwgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjYgPSByKDEzLCAxNSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0UmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3IxLCByMiwgcjMsIHI0LCByNSwgcjZdKTtcblxuXHRcdFx0c2V0Q29sbGFwc2VTdGF0ZUF0TGV2ZWwoZm9sZGluZ01vZGVsLCAxLCB0cnVlLCBbXSk7XG5cdFx0XHRhc3NlcnRGb2xkZWRSYW5nZXMoZm9sZGluZ01vZGVsLCBbcjEsIHIyXSwgJzEnKTtcblxuXHRcdFx0c2V0Q29sbGFwc2VTdGF0ZUF0TGV2ZWwoZm9sZGluZ01vZGVsLCAxLCBmYWxzZSwgWzVdKTtcblx0XHRcdGFzc2VydEZvbGRlZFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyMl0sICcyJyk7XG5cblx0XHRcdHNldENvbGxhcHNlU3RhdGVBdExldmVsKGZvbGRpbmdNb2RlbCwgMSwgZmFsc2UsIFsxXSk7XG5cdFx0XHRhc3NlcnRGb2xkZWRSYW5nZXMoZm9sZGluZ01vZGVsLCBbXSwgJzMnKTtcblxuXHRcdFx0c2V0Q29sbGFwc2VTdGF0ZUF0TGV2ZWwoZm9sZGluZ01vZGVsLCAyLCB0cnVlLCBbXSk7XG5cdFx0XHRhc3NlcnRGb2xkZWRSYW5nZXMoZm9sZGluZ01vZGVsLCBbcjMsIHI2XSwgJzQnKTtcblxuXHRcdFx0c2V0Q29sbGFwc2VTdGF0ZUF0TGV2ZWwoZm9sZGluZ01vZGVsLCAyLCBmYWxzZSwgWzUsIDZdKTtcblx0XHRcdGFzc2VydEZvbGRlZFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyM10sICc1Jyk7XG5cblx0XHRcdHNldENvbGxhcHNlU3RhdGVBdExldmVsKGZvbGRpbmdNb2RlbCwgMywgdHJ1ZSwgWzQsIDldKTtcblx0XHRcdGFzc2VydEZvbGRlZFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyMywgcjRdLCAnNicpO1xuXG5cdFx0XHRzZXRDb2xsYXBzZVN0YXRlQXRMZXZlbChmb2xkaW5nTW9kZWwsIDMsIGZhbHNlLCBbNCwgOV0pO1xuXHRcdFx0YXNzZXJ0Rm9sZGVkUmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3IzXSwgJzcnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGV4dE1vZGVsLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ3NldENvbGxhcHNlU3RhdGVMZXZlbHNEb3duJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpbmVzID0gW1xuXHRcdC8qIDEqL1x0Jy8vI3JlZ2lvbicsXG5cdFx0LyogMiovXHQnLy8jZW5kcmVnaW9uJyxcblx0XHQvKiAzKi9cdCdjbGFzcyBBIHsnLFxuXHRcdC8qIDQqL1x0JyAgdm9pZCBmb28oKSB7Jyxcblx0XHQvKiA1Ki9cdCcgICAgaWYgKHRydWUpIHsnLFxuXHRcdC8qIDYqL1x0JyAgICAgICAgcmV0dXJuOycsXG5cdFx0LyogNyovXHQnICAgIH0nLFxuXHRcdC8qIDgqL1x0JycsXG5cdFx0LyogOSovXHQnICAgIGlmICh0cnVlKSB7Jyxcblx0XHQvKiAxMCovXHQnICAgICAgcmV0dXJuOycsXG5cdFx0LyogMTEqL1x0JyAgICB9Jyxcblx0XHQvKiAxMiovXHQnICB9Jyxcblx0XHQvKiAxMyovXHQnfSddO1xuXG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKGxpbmVzLmpvaW4oJ1xcbicpKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZm9sZGluZ01vZGVsID0gbmV3IEZvbGRpbmdNb2RlbCh0ZXh0TW9kZWwsIG5ldyBUZXN0RGVjb3JhdGlvblByb3ZpZGVyKHRleHRNb2RlbCkpO1xuXG5cdFx0XHRjb25zdCByYW5nZXMgPSBjb21wdXRlUmFuZ2VzKHRleHRNb2RlbCwgZmFsc2UsIHsgc3RhcnQ6IC9eXFwvXFwvI3JlZ2lvbiQvLCBlbmQ6IC9eXFwvXFwvI2VuZHJlZ2lvbiQvIH0pO1xuXHRcdFx0Zm9sZGluZ01vZGVsLnVwZGF0ZShyYW5nZXMpO1xuXG5cdFx0XHRjb25zdCByMSA9IHIoMSwgMiwgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjIgPSByKDMsIDEyLCBmYWxzZSk7XG5cdFx0XHRjb25zdCByMyA9IHIoNCwgMTEsIGZhbHNlKTtcblx0XHRcdGNvbnN0IHI0ID0gcig1LCA2LCBmYWxzZSk7XG5cdFx0XHRjb25zdCByNSA9IHIoOSwgMTAsIGZhbHNlKTtcblx0XHRcdGFzc2VydFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyMSwgcjIsIHIzLCByNCwgcjVdKTtcblxuXHRcdFx0c2V0Q29sbGFwc2VTdGF0ZUxldmVsc0Rvd24oZm9sZGluZ01vZGVsLCB0cnVlLCAxLCBbNF0pO1xuXHRcdFx0YXNzZXJ0Rm9sZGVkUmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3IzXSwgJzEnKTtcblxuXHRcdFx0c2V0Q29sbGFwc2VTdGF0ZUxldmVsc0Rvd24oZm9sZGluZ01vZGVsLCB0cnVlLCAyLCBbNF0pO1xuXHRcdFx0YXNzZXJ0Rm9sZGVkUmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3IzLCByNCwgcjVdLCAnMicpO1xuXG5cdFx0XHRzZXRDb2xsYXBzZVN0YXRlTGV2ZWxzRG93bihmb2xkaW5nTW9kZWwsIGZhbHNlLCAyLCBbM10pO1xuXHRcdFx0YXNzZXJ0Rm9sZGVkUmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3I0LCByNV0sICczJyk7XG5cblx0XHRcdHNldENvbGxhcHNlU3RhdGVMZXZlbHNEb3duKGZvbGRpbmdNb2RlbCwgZmFsc2UsIDIsIFsyXSk7XG5cdFx0XHRhc3NlcnRGb2xkZWRSYW5nZXMoZm9sZGluZ01vZGVsLCBbcjQsIHI1XSwgJzQnKTtcblxuXHRcdFx0c2V0Q29sbGFwc2VTdGF0ZUxldmVsc0Rvd24oZm9sZGluZ01vZGVsLCB0cnVlLCA0LCBbMl0pO1xuXHRcdFx0YXNzZXJ0Rm9sZGVkUmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3IxLCByNCwgcjVdLCAnNScpO1xuXG5cdFx0XHRzZXRDb2xsYXBzZVN0YXRlTGV2ZWxzRG93bihmb2xkaW5nTW9kZWwsIGZhbHNlLCA0LCBbMiwgM10pO1xuXHRcdFx0YXNzZXJ0Rm9sZGVkUmFuZ2VzKGZvbGRpbmdNb2RlbCwgW10sICc2Jyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRleHRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdzZXRDb2xsYXBzZVN0YXRlTGV2ZWxzVXAnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGluZXMgPSBbXG5cdFx0LyogMSovXHQnLy8jcmVnaW9uJyxcblx0XHQvKiAyKi9cdCcvLyNlbmRyZWdpb24nLFxuXHRcdC8qIDMqL1x0J2NsYXNzIEEgeycsXG5cdFx0LyogNCovXHQnICB2b2lkIGZvbygpIHsnLFxuXHRcdC8qIDUqL1x0JyAgICBpZiAodHJ1ZSkgeycsXG5cdFx0LyogNiovXHQnICAgICAgICByZXR1cm47Jyxcblx0XHQvKiA3Ki9cdCcgICAgfScsXG5cdFx0LyogOCovXHQnJyxcblx0XHQvKiA5Ki9cdCcgICAgaWYgKHRydWUpIHsnLFxuXHRcdC8qIDEwKi9cdCcgICAgICByZXR1cm47Jyxcblx0XHQvKiAxMSovXHQnICAgIH0nLFxuXHRcdC8qIDEyKi9cdCcgIH0nLFxuXHRcdC8qIDEzKi9cdCd9J107XG5cblx0XHRjb25zdCB0ZXh0TW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwobGluZXMuam9pbignXFxuJykpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBmb2xkaW5nTW9kZWwgPSBuZXcgRm9sZGluZ01vZGVsKHRleHRNb2RlbCwgbmV3IFRlc3REZWNvcmF0aW9uUHJvdmlkZXIodGV4dE1vZGVsKSk7XG5cblx0XHRcdGNvbnN0IHJhbmdlcyA9IGNvbXB1dGVSYW5nZXModGV4dE1vZGVsLCBmYWxzZSwgeyBzdGFydDogL15cXC9cXC8jcmVnaW9uJC8sIGVuZDogL15cXC9cXC8jZW5kcmVnaW9uJC8gfSk7XG5cdFx0XHRmb2xkaW5nTW9kZWwudXBkYXRlKHJhbmdlcyk7XG5cblx0XHRcdGNvbnN0IHIxID0gcigxLCAyLCBmYWxzZSk7XG5cdFx0XHRjb25zdCByMiA9IHIoMywgMTIsIGZhbHNlKTtcblx0XHRcdGNvbnN0IHIzID0gcig0LCAxMSwgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjQgPSByKDUsIDYsIGZhbHNlKTtcblx0XHRcdGNvbnN0IHI1ID0gcig5LCAxMCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0UmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3IxLCByMiwgcjMsIHI0LCByNV0pO1xuXG5cdFx0XHRzZXRDb2xsYXBzZVN0YXRlTGV2ZWxzVXAoZm9sZGluZ01vZGVsLCB0cnVlLCAxLCBbNF0pO1xuXHRcdFx0YXNzZXJ0Rm9sZGVkUmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3IzXSwgJzEnKTtcblxuXHRcdFx0c2V0Q29sbGFwc2VTdGF0ZUxldmVsc1VwKGZvbGRpbmdNb2RlbCwgdHJ1ZSwgMiwgWzRdKTtcblx0XHRcdGFzc2VydEZvbGRlZFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyMiwgcjNdLCAnMicpO1xuXG5cdFx0XHRzZXRDb2xsYXBzZVN0YXRlTGV2ZWxzVXAoZm9sZGluZ01vZGVsLCBmYWxzZSwgNCwgWzEsIDMsIDRdKTtcblx0XHRcdGFzc2VydEZvbGRlZFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtdLCAnMycpO1xuXG5cdFx0XHRzZXRDb2xsYXBzZVN0YXRlTGV2ZWxzVXAoZm9sZGluZ01vZGVsLCB0cnVlLCAyLCBbMTBdKTtcblx0XHRcdGFzc2VydEZvbGRlZFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyMywgcjVdLCAnNCcpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0ZXh0TW9kZWwuZGlzcG9zZSgpO1xuXHRcdH1cblxuXHR9KTtcblxuXHR0ZXN0KCdzZXRDb2xsYXBzZVN0YXRlVXAnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGluZXMgPSBbXG5cdFx0LyogMSovXHQnLy8jcmVnaW9uJyxcblx0XHQvKiAyKi9cdCcvLyNlbmRyZWdpb24nLFxuXHRcdC8qIDMqL1x0J2NsYXNzIEEgeycsXG5cdFx0LyogNCovXHQnICB2b2lkIGZvbygpIHsnLFxuXHRcdC8qIDUqL1x0JyAgICBpZiAodHJ1ZSkgeycsXG5cdFx0LyogNiovXHQnICAgICAgICByZXR1cm47Jyxcblx0XHQvKiA3Ki9cdCcgICAgfScsXG5cdFx0LyogOCovXHQnJyxcblx0XHQvKiA5Ki9cdCcgICAgaWYgKHRydWUpIHsnLFxuXHRcdC8qIDEwKi9cdCcgICAgICByZXR1cm47Jyxcblx0XHQvKiAxMSovXHQnICAgIH0nLFxuXHRcdC8qIDEyKi9cdCcgIH0nLFxuXHRcdC8qIDEzKi9cdCd9J107XG5cblx0XHRjb25zdCB0ZXh0TW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwobGluZXMuam9pbignXFxuJykpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBmb2xkaW5nTW9kZWwgPSBuZXcgRm9sZGluZ01vZGVsKHRleHRNb2RlbCwgbmV3IFRlc3REZWNvcmF0aW9uUHJvdmlkZXIodGV4dE1vZGVsKSk7XG5cblx0XHRcdGNvbnN0IHJhbmdlcyA9IGNvbXB1dGVSYW5nZXModGV4dE1vZGVsLCBmYWxzZSwgeyBzdGFydDogL15cXC9cXC8jcmVnaW9uJC8sIGVuZDogL15cXC9cXC8jZW5kcmVnaW9uJC8gfSk7XG5cdFx0XHRmb2xkaW5nTW9kZWwudXBkYXRlKHJhbmdlcyk7XG5cblx0XHRcdGNvbnN0IHIxID0gcigxLCAyLCBmYWxzZSk7XG5cdFx0XHRjb25zdCByMiA9IHIoMywgMTIsIGZhbHNlKTtcblx0XHRcdGNvbnN0IHIzID0gcig0LCAxMSwgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjQgPSByKDUsIDYsIGZhbHNlKTtcblx0XHRcdGNvbnN0IHI1ID0gcig5LCAxMCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0UmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3IxLCByMiwgcjMsIHI0LCByNV0pO1xuXG5cdFx0XHRzZXRDb2xsYXBzZVN0YXRlVXAoZm9sZGluZ01vZGVsLCB0cnVlLCBbNV0pO1xuXHRcdFx0YXNzZXJ0Rm9sZGVkUmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3I0XSwgJzEnKTtcblxuXHRcdFx0c2V0Q29sbGFwc2VTdGF0ZVVwKGZvbGRpbmdNb2RlbCwgdHJ1ZSwgWzVdKTtcblx0XHRcdGFzc2VydEZvbGRlZFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyMywgcjRdLCAnMicpO1xuXG5cdFx0XHRzZXRDb2xsYXBzZVN0YXRlVXAoZm9sZGluZ01vZGVsLCB0cnVlLCBbNF0pO1xuXHRcdFx0YXNzZXJ0Rm9sZGVkUmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3IyLCByMywgcjRdLCAnMicpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0ZXh0TW9kZWwuZGlzcG9zZSgpO1xuXHRcdH1cblxuXHR9KTtcblxuXG5cdHRlc3QoJ3NldENvbGxhcHNlU3RhdGVGb3JNYXRjaGluZ0xpbmVzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpbmVzID0gW1xuXHRcdC8qIDEqL1x0Jy8qKicsXG5cdFx0LyogMiovXHQnICogdGhlIGNsYXNzJyxcblx0XHQvKiAzKi9cdCcgKi8nLFxuXHRcdC8qIDQqL1x0J2NsYXNzIEEgeycsXG5cdFx0LyogNSovXHQnICAvKionLFxuXHRcdC8qIDYqL1x0JyAgICogdGhlIGZvbycsXG5cdFx0LyogNyovXHQnICAgKi8nLFxuXHRcdC8qIDgqL1x0JyAgdm9pZCBmb28oKSB7Jyxcblx0XHQvKiA5Ki9cdCcgICAgLyonLFxuXHRcdC8qIDEwKi9cdCcgICAgICogdGhlIGNvbW1lbnQnLFxuXHRcdC8qIDExKi9cdCcgICAgICovJyxcblx0XHQvKiAxMiovXHQnICB9Jyxcblx0XHQvKiAxMyovXHQnfSddO1xuXG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKGxpbmVzLmpvaW4oJ1xcbicpKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZm9sZGluZ01vZGVsID0gbmV3IEZvbGRpbmdNb2RlbCh0ZXh0TW9kZWwsIG5ldyBUZXN0RGVjb3JhdGlvblByb3ZpZGVyKHRleHRNb2RlbCkpO1xuXG5cdFx0XHRjb25zdCByYW5nZXMgPSBjb21wdXRlUmFuZ2VzKHRleHRNb2RlbCwgZmFsc2UsIHsgc3RhcnQ6IC9eXFwvXFwvI3JlZ2lvbiQvLCBlbmQ6IC9eXFwvXFwvI2VuZHJlZ2lvbiQvIH0pO1xuXHRcdFx0Zm9sZGluZ01vZGVsLnVwZGF0ZShyYW5nZXMpO1xuXG5cdFx0XHRjb25zdCByMSA9IHIoMSwgMywgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjIgPSByKDQsIDEyLCBmYWxzZSk7XG5cdFx0XHRjb25zdCByMyA9IHIoNSwgNywgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjQgPSByKDgsIDExLCBmYWxzZSk7XG5cdFx0XHRjb25zdCByNSA9IHIoOSwgMTEsIGZhbHNlKTtcblx0XHRcdGFzc2VydFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyMSwgcjIsIHIzLCByNCwgcjVdKTtcblxuXHRcdFx0Y29uc3QgcmVnRXhwID0gbmV3IFJlZ0V4cCgnXlxcXFxzKicgKyBlc2NhcGVSZWdFeHBDaGFyYWN0ZXJzKCcvKicpKTtcblx0XHRcdHNldENvbGxhcHNlU3RhdGVGb3JNYXRjaGluZ0xpbmVzKGZvbGRpbmdNb2RlbCwgcmVnRXhwLCB0cnVlKTtcblx0XHRcdGFzc2VydEZvbGRlZFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyMSwgcjMsIHI1XSwgJzEnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGV4dE1vZGVsLmRpc3Bvc2UoKTtcblx0XHR9XG5cblx0fSk7XG5cblxuXHR0ZXN0KCdzZXRDb2xsYXBzZVN0YXRlRm9yUmVzdCcsICgpID0+IHtcblx0XHRjb25zdCBsaW5lcyA9IFtcblx0XHQvKiAxKi9cdCcvLyNyZWdpb24nLFxuXHRcdC8qIDIqL1x0Jy8vI2VuZHJlZ2lvbicsXG5cdFx0LyogMyovXHQnY2xhc3MgQSB7Jyxcblx0XHQvKiA0Ki9cdCcgIHZvaWQgZm9vKCkgeycsXG5cdFx0LyogNSovXHQnICAgIGlmICh0cnVlKSB7Jyxcblx0XHQvKiA2Ki9cdCcgICAgICAgIHJldHVybjsnLFxuXHRcdC8qIDcqL1x0JyAgICB9Jyxcblx0XHQvKiA4Ki9cdCcnLFxuXHRcdC8qIDkqL1x0JyAgICBpZiAodHJ1ZSkgeycsXG5cdFx0LyogMTAqL1x0JyAgICAgIHJldHVybjsnLFxuXHRcdC8qIDExKi9cdCcgICAgfScsXG5cdFx0LyogMTIqL1x0JyAgfScsXG5cdFx0LyogMTMqL1x0J30nXTtcblxuXHRcdGNvbnN0IHRleHRNb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChsaW5lcy5qb2luKCdcXG4nKSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGZvbGRpbmdNb2RlbCA9IG5ldyBGb2xkaW5nTW9kZWwodGV4dE1vZGVsLCBuZXcgVGVzdERlY29yYXRpb25Qcm92aWRlcih0ZXh0TW9kZWwpKTtcblxuXHRcdFx0Y29uc3QgcmFuZ2VzID0gY29tcHV0ZVJhbmdlcyh0ZXh0TW9kZWwsIGZhbHNlLCB7IHN0YXJ0OiAvXlxcL1xcLyNyZWdpb24kLywgZW5kOiAvXlxcL1xcLyNlbmRyZWdpb24kLyB9KTtcblx0XHRcdGZvbGRpbmdNb2RlbC51cGRhdGUocmFuZ2VzKTtcblxuXHRcdFx0Y29uc3QgcjEgPSByKDEsIDIsIGZhbHNlKTtcblx0XHRcdGNvbnN0IHIyID0gcigzLCAxMiwgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjMgPSByKDQsIDExLCBmYWxzZSk7XG5cdFx0XHRjb25zdCByNCA9IHIoNSwgNiwgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjUgPSByKDksIDEwLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRSYW5nZXMoZm9sZGluZ01vZGVsLCBbcjEsIHIyLCByMywgcjQsIHI1XSk7XG5cblx0XHRcdHNldENvbGxhcHNlU3RhdGVGb3JSZXN0KGZvbGRpbmdNb2RlbCwgdHJ1ZSwgWzVdKTtcblx0XHRcdGFzc2VydEZvbGRlZFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyMSwgcjVdLCAnMScpO1xuXG5cdFx0XHRzZXRDb2xsYXBzZVN0YXRlRm9yUmVzdChmb2xkaW5nTW9kZWwsIGZhbHNlLCBbNV0pO1xuXHRcdFx0YXNzZXJ0Rm9sZGVkUmFuZ2VzKGZvbGRpbmdNb2RlbCwgW10sICcyJyk7XG5cblx0XHRcdHNldENvbGxhcHNlU3RhdGVGb3JSZXN0KGZvbGRpbmdNb2RlbCwgdHJ1ZSwgWzFdKTtcblx0XHRcdGFzc2VydEZvbGRlZFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyMiwgcjMsIHI0LCByNV0sICczJyk7XG5cblx0XHRcdHNldENvbGxhcHNlU3RhdGVGb3JSZXN0KGZvbGRpbmdNb2RlbCwgdHJ1ZSwgWzNdKTtcblx0XHRcdGFzc2VydEZvbGRlZFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyMSwgcjIsIHIzLCByNCwgcjVdLCAnMycpO1xuXG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRleHRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0fVxuXG5cdH0pO1xuXG5cblx0dGVzdCgnZm9sZGluZyBkZWNvcmF0aW9uJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpbmVzID0gW1xuXHRcdC8qIDEqL1x0J2NsYXNzIEEgeycsXG5cdFx0LyogMiovXHQnICB2b2lkIGZvbygpIHsnLFxuXHRcdC8qIDMqL1x0JyAgICBpZiAodHJ1ZSkgeycsXG5cdFx0LyogNCovXHQnICAgICAgaG9vKCk7Jyxcblx0XHQvKiA1Ki9cdCcgICAgfScsXG5cdFx0LyogNiovXHQnICB9Jyxcblx0XHQvKiA3Ki9cdCd9J107XG5cblx0XHRjb25zdCB0ZXh0TW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwobGluZXMuam9pbignXFxuJykpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBmb2xkaW5nTW9kZWwgPSBuZXcgRm9sZGluZ01vZGVsKHRleHRNb2RlbCwgbmV3IFRlc3REZWNvcmF0aW9uUHJvdmlkZXIodGV4dE1vZGVsKSk7XG5cblx0XHRcdGNvbnN0IHJhbmdlcyA9IGNvbXB1dGVSYW5nZXModGV4dE1vZGVsLCBmYWxzZSwgdW5kZWZpbmVkKTtcblx0XHRcdGZvbGRpbmdNb2RlbC51cGRhdGUocmFuZ2VzKTtcblxuXHRcdFx0Y29uc3QgcjEgPSByKDEsIDYsIGZhbHNlKTtcblx0XHRcdGNvbnN0IHIyID0gcigyLCA1LCBmYWxzZSk7XG5cdFx0XHRjb25zdCByMyA9IHIoMywgNCwgZmFsc2UpO1xuXG5cdFx0XHRhc3NlcnRSYW5nZXMoZm9sZGluZ01vZGVsLCBbcjEsIHIyLCByM10pO1xuXHRcdFx0YXNzZXJ0RGVjb3JhdGlvbnMoZm9sZGluZ01vZGVsLCBbZCgxLCAnZXhwYW5kZWQnKSwgZCgyLCAnZXhwYW5kZWQnKSwgZCgzLCAnZXhwYW5kZWQnKV0pO1xuXG5cdFx0XHRmb2xkaW5nTW9kZWwudG9nZ2xlQ29sbGFwc2VTdGF0ZShbZm9sZGluZ01vZGVsLmdldFJlZ2lvbkF0TGluZSgyKSFdKTtcblxuXHRcdFx0YXNzZXJ0UmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3IxLCByKDIsIDUsIHRydWUpLCByM10pO1xuXHRcdFx0YXNzZXJ0RGVjb3JhdGlvbnMoZm9sZGluZ01vZGVsLCBbZCgxLCAnZXhwYW5kZWQnKSwgZCgyLCAnY29sbGFwc2VkJyksIGQoMywgJ2hpZGRlbicpXSk7XG5cblx0XHRcdGZvbGRpbmdNb2RlbC51cGRhdGUocmFuZ2VzKTtcblxuXHRcdFx0YXNzZXJ0UmFuZ2VzKGZvbGRpbmdNb2RlbCwgW3IxLCByKDIsIDUsIHRydWUpLCByM10pO1xuXHRcdFx0YXNzZXJ0RGVjb3JhdGlvbnMoZm9sZGluZ01vZGVsLCBbZCgxLCAnZXhwYW5kZWQnKSwgZCgyLCAnY29sbGFwc2VkJyksIGQoMywgJ2hpZGRlbicpXSk7XG5cblx0XHRcdGZvbGRpbmdNb2RlbC50b2dnbGVDb2xsYXBzZVN0YXRlKFtmb2xkaW5nTW9kZWwuZ2V0UmVnaW9uQXRMaW5lKDEpIV0pO1xuXG5cdFx0XHRhc3NlcnRSYW5nZXMoZm9sZGluZ01vZGVsLCBbcigxLCA2LCB0cnVlKSwgcigyLCA1LCB0cnVlKSwgcjNdKTtcblx0XHRcdGFzc2VydERlY29yYXRpb25zKGZvbGRpbmdNb2RlbCwgW2QoMSwgJ2NvbGxhcHNlZCcpLCBkKDIsICdoaWRkZW4nKSwgZCgzLCAnaGlkZGVuJyldKTtcblxuXHRcdFx0Zm9sZGluZ01vZGVsLnVwZGF0ZShyYW5nZXMpO1xuXG5cdFx0XHRhc3NlcnRSYW5nZXMoZm9sZGluZ01vZGVsLCBbcigxLCA2LCB0cnVlKSwgcigyLCA1LCB0cnVlKSwgcjNdKTtcblx0XHRcdGFzc2VydERlY29yYXRpb25zKGZvbGRpbmdNb2RlbCwgW2QoMSwgJ2NvbGxhcHNlZCcpLCBkKDIsICdoaWRkZW4nKSwgZCgzLCAnaGlkZGVuJyldKTtcblxuXHRcdFx0Zm9sZGluZ01vZGVsLnRvZ2dsZUNvbGxhcHNlU3RhdGUoW2ZvbGRpbmdNb2RlbC5nZXRSZWdpb25BdExpbmUoMSkhLCBmb2xkaW5nTW9kZWwuZ2V0UmVnaW9uQXRMaW5lKDMpIV0pO1xuXG5cdFx0XHRhc3NlcnRSYW5nZXMoZm9sZGluZ01vZGVsLCBbcjEsIHIoMiwgNSwgdHJ1ZSksIHIoMywgNCwgdHJ1ZSldKTtcblx0XHRcdGFzc2VydERlY29yYXRpb25zKGZvbGRpbmdNb2RlbCwgW2QoMSwgJ2V4cGFuZGVkJyksIGQoMiwgJ2NvbGxhcHNlZCcpLCBkKDMsICdoaWRkZW4nKV0pO1xuXG5cdFx0XHRmb2xkaW5nTW9kZWwudXBkYXRlKHJhbmdlcyk7XG5cblx0XHRcdGFzc2VydFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyMSwgcigyLCA1LCB0cnVlKSwgcigzLCA0LCB0cnVlKV0pO1xuXHRcdFx0YXNzZXJ0RGVjb3JhdGlvbnMoZm9sZGluZ01vZGVsLCBbZCgxLCAnZXhwYW5kZWQnKSwgZCgyLCAnY29sbGFwc2VkJyksIGQoMywgJ2hpZGRlbicpXSk7XG5cblx0XHRcdHRleHRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRleHRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0fVxuXG5cdH0pO1xuXG5cdHRlc3QoJ2ZvbGQganVtcGluZycsICgpID0+IHtcblx0XHRjb25zdCBsaW5lcyA9IFtcblx0XHRcdC8qIDEqL1x0J2NsYXNzIEEgeycsXG5cdFx0XHQvKiAyKi9cdCcgIHZvaWQgZm9vKCkgeycsXG5cdFx0XHQvKiAzKi9cdCcgICAgaWYgKDEpIHsnLFxuXHRcdFx0LyogNCovXHQnICAgICAgYSgpOycsXG5cdFx0XHQvKiA1Ki9cdCcgICAgfSBlbHNlIGlmICgyKSB7Jyxcblx0XHRcdC8qIDYqL1x0JyAgICAgIGlmICh0cnVlKSB7Jyxcblx0XHRcdC8qIDcqL1x0JyAgICAgICAgYigpOycsXG5cdFx0XHQvKiA4Ki9cdCcgICAgICB9Jyxcblx0XHRcdC8qIDkqL1x0JyAgICB9IGVsc2UgeycsXG5cdFx0XHQvKiAxMCovXHQnICAgICAgYygpOycsXG5cdFx0XHQvKiAxMSovXHQnICAgIH0nLFxuXHRcdFx0LyogMTIqL1x0JyAgfScsXG5cdFx0XHQvKiAxMyovXHQnfSdcblx0XHRdO1xuXG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKGxpbmVzLmpvaW4oJ1xcbicpKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZm9sZGluZ01vZGVsID0gbmV3IEZvbGRpbmdNb2RlbCh0ZXh0TW9kZWwsIG5ldyBUZXN0RGVjb3JhdGlvblByb3ZpZGVyKHRleHRNb2RlbCkpO1xuXG5cdFx0XHRjb25zdCByYW5nZXMgPSBjb21wdXRlUmFuZ2VzKHRleHRNb2RlbCwgZmFsc2UsIHVuZGVmaW5lZCk7XG5cdFx0XHRmb2xkaW5nTW9kZWwudXBkYXRlKHJhbmdlcyk7XG5cblx0XHRcdGNvbnN0IHIxID0gcigxLCAxMiwgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjIgPSByKDIsIDExLCBmYWxzZSk7XG5cdFx0XHRjb25zdCByMyA9IHIoMywgNCwgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjQgPSByKDUsIDgsIGZhbHNlKTtcblx0XHRcdGNvbnN0IHI1ID0gcig2LCA3LCBmYWxzZSk7XG5cdFx0XHRjb25zdCByNiA9IHIoOSwgMTAsIGZhbHNlKTtcblx0XHRcdGFzc2VydFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyMSwgcjIsIHIzLCByNCwgcjUsIHI2XSk7XG5cblx0XHRcdC8vIFRlc3QganVtcCB0byBwYXJlbnQuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0UGFyZW50Rm9sZExpbmUoNywgZm9sZGluZ01vZGVsKSwgNik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0UGFyZW50Rm9sZExpbmUoNiwgZm9sZGluZ01vZGVsKSwgNSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0UGFyZW50Rm9sZExpbmUoNSwgZm9sZGluZ01vZGVsKSwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0UGFyZW50Rm9sZExpbmUoMiwgZm9sZGluZ01vZGVsKSwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0UGFyZW50Rm9sZExpbmUoMSwgZm9sZGluZ01vZGVsKSwgbnVsbCk7XG5cblx0XHRcdC8vIFRlc3QganVtcCB0byBwcmV2aW91cy5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRQcmV2aW91c0ZvbGRMaW5lKDEwLCBmb2xkaW5nTW9kZWwpLCA5KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRQcmV2aW91c0ZvbGRMaW5lKDksIGZvbGRpbmdNb2RlbCksIDUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldFByZXZpb3VzRm9sZExpbmUoNSwgZm9sZGluZ01vZGVsKSwgMyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0UHJldmlvdXNGb2xkTGluZSgzLCBmb2xkaW5nTW9kZWwpLCBudWxsKTtcblx0XHRcdC8vIFRlc3Qgd2hlbiBub3Qgb24gYSBmb2xkaW5nIHJlZ2lvbiBzdGFydCBsaW5lLlxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldFByZXZpb3VzRm9sZExpbmUoNCwgZm9sZGluZ01vZGVsKSwgMyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0UHJldmlvdXNGb2xkTGluZSg3LCBmb2xkaW5nTW9kZWwpLCA2KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRQcmV2aW91c0ZvbGRMaW5lKDgsIGZvbGRpbmdNb2RlbCksIDYpO1xuXG5cdFx0XHQvLyBUZXN0IGp1bXAgdG8gbmV4dC5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXROZXh0Rm9sZExpbmUoMywgZm9sZGluZ01vZGVsKSwgNSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0TmV4dEZvbGRMaW5lKDUsIGZvbGRpbmdNb2RlbCksIDkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldE5leHRGb2xkTGluZSg5LCBmb2xkaW5nTW9kZWwpLCBudWxsKTtcblx0XHRcdC8vIFRlc3Qgd2hlbiBub3Qgb24gYSBmb2xkaW5nIHJlZ2lvbiBzdGFydCBsaW5lLlxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldE5leHRGb2xkTGluZSg0LCBmb2xkaW5nTW9kZWwpLCA1KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXROZXh0Rm9sZExpbmUoNywgZm9sZGluZ01vZGVsKSwgOSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0TmV4dEZvbGRMaW5lKDgsIGZvbGRpbmdNb2RlbCksIDkpO1xuXG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRleHRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0fVxuXG5cdH0pO1xuXG5cdHRlc3QoJ2ZvbGQganVtcGluZyBpc3N1ZSAjMTI5NTAzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpbmVzID0gW1xuXHRcdFx0LyogMSovXHQnJyxcblx0XHRcdC8qIDIqL1x0J2lmIFRydWU6Jyxcblx0XHRcdC8qIDMqL1x0JyAgcHJpbnQoMSknLFxuXHRcdFx0LyogNCovXHQnaWYgVHJ1ZTonLFxuXHRcdFx0LyogNSovXHQnICBwcmludCgxKScsXG5cdFx0XHQvKiA2Ki9cdCcnXG5cdFx0XTtcblxuXHRcdGNvbnN0IHRleHRNb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChsaW5lcy5qb2luKCdcXG4nKSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGZvbGRpbmdNb2RlbCA9IG5ldyBGb2xkaW5nTW9kZWwodGV4dE1vZGVsLCBuZXcgVGVzdERlY29yYXRpb25Qcm92aWRlcih0ZXh0TW9kZWwpKTtcblxuXHRcdFx0Y29uc3QgcmFuZ2VzID0gY29tcHV0ZVJhbmdlcyh0ZXh0TW9kZWwsIGZhbHNlLCB1bmRlZmluZWQpO1xuXHRcdFx0Zm9sZGluZ01vZGVsLnVwZGF0ZShyYW5nZXMpO1xuXG5cdFx0XHRjb25zdCByMSA9IHIoMiwgMywgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcjIgPSByKDQsIDYsIGZhbHNlKTtcblx0XHRcdGFzc2VydFJhbmdlcyhmb2xkaW5nTW9kZWwsIFtyMSwgcjJdKTtcblxuXHRcdFx0Ly8gVGVzdCBqdW1wIHRvIG5leHQuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0TmV4dEZvbGRMaW5lKDEsIGZvbGRpbmdNb2RlbCksIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldE5leHRGb2xkTGluZSgyLCBmb2xkaW5nTW9kZWwpLCA0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXROZXh0Rm9sZExpbmUoMywgZm9sZGluZ01vZGVsKSwgNCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0TmV4dEZvbGRMaW5lKDQsIGZvbGRpbmdNb2RlbCksIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldE5leHRGb2xkTGluZSg1LCBmb2xkaW5nTW9kZWwpLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXROZXh0Rm9sZExpbmUoNiwgZm9sZGluZ01vZGVsKSwgbnVsbCk7XG5cblx0XHRcdC8vIFRlc3QganVtcCB0byBwcmV2aW91cy5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRQcmV2aW91c0ZvbGRMaW5lKDEsIGZvbGRpbmdNb2RlbCksIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldFByZXZpb3VzRm9sZExpbmUoMiwgZm9sZGluZ01vZGVsKSwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0UHJldmlvdXNGb2xkTGluZSgzLCBmb2xkaW5nTW9kZWwpLCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRQcmV2aW91c0ZvbGRMaW5lKDQsIGZvbGRpbmdNb2RlbCksIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldFByZXZpb3VzRm9sZExpbmUoNSwgZm9sZGluZ01vZGVsKSwgNCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0UHJldmlvdXNGb2xkTGluZSg2LCBmb2xkaW5nTW9kZWwpLCA0KTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGV4dE1vZGVsLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFJQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQXNELDhCQUE4QjtBQUNwRixTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGNBQWMsaUJBQWlCLG1CQUFtQixxQkFBcUIseUJBQXlCLGtDQUFrQyx5QkFB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
