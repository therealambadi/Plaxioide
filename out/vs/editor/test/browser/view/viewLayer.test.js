import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { RenderedLinesCollection } from "../../../browser/view/viewLayer.js";
class TestLine {
  constructor(id) {
    this.id = id;
    this._pinged = false;
  }
  onContentChanged() {
    this._pinged = true;
  }
  onTokensChanged() {
    this._pinged = true;
  }
}
function assertState(col, state) {
  const actualState = {
    startLineNumber: col.getStartLineNumber(),
    lines: [],
    pinged: []
  };
  for (let lineNumber = col.getStartLineNumber(); lineNumber <= col.getEndLineNumber(); lineNumber++) {
    actualState.lines.push(col.getLine(lineNumber).id);
    actualState.pinged.push(col.getLine(lineNumber)._pinged);
  }
  assert.deepStrictEqual(actualState, state);
}
suite("RenderedLinesCollection onLinesDeleted", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function testOnModelLinesDeleted(deleteFromLineNumber, deleteToLineNumber, expectedDeleted, expectedState) {
    const col = new RenderedLinesCollection({ createLine: () => new TestLine("new") });
    col._set(6, [
      new TestLine("old6"),
      new TestLine("old7"),
      new TestLine("old8"),
      new TestLine("old9")
    ]);
    const actualDeleted1 = col.onLinesDeleted(deleteFromLineNumber, deleteToLineNumber);
    let actualDeleted = [];
    if (actualDeleted1) {
      actualDeleted = actualDeleted1.map((line) => line.id);
    }
    assert.deepStrictEqual(actualDeleted, expectedDeleted);
    assertState(col, expectedState);
  }
  test("A1", () => {
    testOnModelLinesDeleted(3, 3, [], {
      startLineNumber: 5,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("A2", () => {
    testOnModelLinesDeleted(3, 4, [], {
      startLineNumber: 4,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("A3", () => {
    testOnModelLinesDeleted(3, 5, [], {
      startLineNumber: 3,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("A4", () => {
    testOnModelLinesDeleted(3, 6, ["old6"], {
      startLineNumber: 3,
      lines: ["old7", "old8", "old9"],
      pinged: [false, false, false]
    });
  });
  test("A5", () => {
    testOnModelLinesDeleted(3, 7, ["old6", "old7"], {
      startLineNumber: 3,
      lines: ["old8", "old9"],
      pinged: [false, false]
    });
  });
  test("A6", () => {
    testOnModelLinesDeleted(3, 8, ["old6", "old7", "old8"], {
      startLineNumber: 3,
      lines: ["old9"],
      pinged: [false]
    });
  });
  test("A7", () => {
    testOnModelLinesDeleted(3, 9, ["old6", "old7", "old8", "old9"], {
      startLineNumber: 3,
      lines: [],
      pinged: []
    });
  });
  test("A8", () => {
    testOnModelLinesDeleted(3, 10, ["old6", "old7", "old8", "old9"], {
      startLineNumber: 3,
      lines: [],
      pinged: []
    });
  });
  test("B1", () => {
    testOnModelLinesDeleted(5, 5, [], {
      startLineNumber: 5,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("B2", () => {
    testOnModelLinesDeleted(5, 6, ["old6"], {
      startLineNumber: 5,
      lines: ["old7", "old8", "old9"],
      pinged: [false, false, false]
    });
  });
  test("B3", () => {
    testOnModelLinesDeleted(5, 7, ["old6", "old7"], {
      startLineNumber: 5,
      lines: ["old8", "old9"],
      pinged: [false, false]
    });
  });
  test("B4", () => {
    testOnModelLinesDeleted(5, 8, ["old6", "old7", "old8"], {
      startLineNumber: 5,
      lines: ["old9"],
      pinged: [false]
    });
  });
  test("B5", () => {
    testOnModelLinesDeleted(5, 9, ["old6", "old7", "old8", "old9"], {
      startLineNumber: 5,
      lines: [],
      pinged: []
    });
  });
  test("B6", () => {
    testOnModelLinesDeleted(5, 10, ["old6", "old7", "old8", "old9"], {
      startLineNumber: 5,
      lines: [],
      pinged: []
    });
  });
  test("C1", () => {
    testOnModelLinesDeleted(6, 6, ["old6"], {
      startLineNumber: 6,
      lines: ["old7", "old8", "old9"],
      pinged: [false, false, false]
    });
  });
  test("C2", () => {
    testOnModelLinesDeleted(6, 7, ["old6", "old7"], {
      startLineNumber: 6,
      lines: ["old8", "old9"],
      pinged: [false, false]
    });
  });
  test("C3", () => {
    testOnModelLinesDeleted(6, 8, ["old6", "old7", "old8"], {
      startLineNumber: 6,
      lines: ["old9"],
      pinged: [false]
    });
  });
  test("C4", () => {
    testOnModelLinesDeleted(6, 9, ["old6", "old7", "old8", "old9"], {
      startLineNumber: 6,
      lines: [],
      pinged: []
    });
  });
  test("C5", () => {
    testOnModelLinesDeleted(6, 10, ["old6", "old7", "old8", "old9"], {
      startLineNumber: 6,
      lines: [],
      pinged: []
    });
  });
  test("D1", () => {
    testOnModelLinesDeleted(7, 7, ["old7"], {
      startLineNumber: 6,
      lines: ["old6", "old8", "old9"],
      pinged: [false, false, false]
    });
  });
  test("D2", () => {
    testOnModelLinesDeleted(7, 8, ["old7", "old8"], {
      startLineNumber: 6,
      lines: ["old6", "old9"],
      pinged: [false, false]
    });
  });
  test("D3", () => {
    testOnModelLinesDeleted(7, 9, ["old7", "old8", "old9"], {
      startLineNumber: 6,
      lines: ["old6"],
      pinged: [false]
    });
  });
  test("D4", () => {
    testOnModelLinesDeleted(7, 10, ["old7", "old8", "old9"], {
      startLineNumber: 6,
      lines: ["old6"],
      pinged: [false]
    });
  });
  test("E1", () => {
    testOnModelLinesDeleted(8, 8, ["old8"], {
      startLineNumber: 6,
      lines: ["old6", "old7", "old9"],
      pinged: [false, false, false]
    });
  });
  test("E2", () => {
    testOnModelLinesDeleted(8, 9, ["old8", "old9"], {
      startLineNumber: 6,
      lines: ["old6", "old7"],
      pinged: [false, false]
    });
  });
  test("E3", () => {
    testOnModelLinesDeleted(8, 10, ["old8", "old9"], {
      startLineNumber: 6,
      lines: ["old6", "old7"],
      pinged: [false, false]
    });
  });
  test("F1", () => {
    testOnModelLinesDeleted(9, 9, ["old9"], {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8"],
      pinged: [false, false, false]
    });
  });
  test("F2", () => {
    testOnModelLinesDeleted(9, 10, ["old9"], {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8"],
      pinged: [false, false, false]
    });
  });
  test("G1", () => {
    testOnModelLinesDeleted(10, 10, [], {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("G2", () => {
    testOnModelLinesDeleted(10, 11, [], {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("H1", () => {
    testOnModelLinesDeleted(11, 13, [], {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
});
suite("RenderedLinesCollection onLineChanged", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function testOnModelLineChanged(changedLineNumber, expectedPinged, expectedState) {
    const col = new RenderedLinesCollection({ createLine: () => new TestLine("new") });
    col._set(6, [
      new TestLine("old6"),
      new TestLine("old7"),
      new TestLine("old8"),
      new TestLine("old9")
    ]);
    const actualPinged = col.onLinesChanged(changedLineNumber, 1);
    assert.deepStrictEqual(actualPinged, expectedPinged);
    assertState(col, expectedState);
  }
  test("3", () => {
    testOnModelLineChanged(3, false, {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("4", () => {
    testOnModelLineChanged(4, false, {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("5", () => {
    testOnModelLineChanged(5, false, {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("6", () => {
    testOnModelLineChanged(6, true, {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [true, false, false, false]
    });
  });
  test("7", () => {
    testOnModelLineChanged(7, true, {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, true, false, false]
    });
  });
  test("8", () => {
    testOnModelLineChanged(8, true, {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, true, false]
    });
  });
  test("9", () => {
    testOnModelLineChanged(9, true, {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, true]
    });
  });
  test("10", () => {
    testOnModelLineChanged(10, false, {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("11", () => {
    testOnModelLineChanged(11, false, {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
});
suite("RenderedLinesCollection onLinesInserted", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function testOnModelLinesInserted(insertFromLineNumber, insertToLineNumber, expectedDeleted, expectedState) {
    const col = new RenderedLinesCollection({ createLine: () => new TestLine("new") });
    col._set(6, [
      new TestLine("old6"),
      new TestLine("old7"),
      new TestLine("old8"),
      new TestLine("old9")
    ]);
    const actualDeleted1 = col.onLinesInserted(insertFromLineNumber, insertToLineNumber);
    let actualDeleted = [];
    if (actualDeleted1) {
      actualDeleted = actualDeleted1.map((line) => line.id);
    }
    assert.deepStrictEqual(actualDeleted, expectedDeleted);
    assertState(col, expectedState);
  }
  test("A1", () => {
    testOnModelLinesInserted(3, 3, [], {
      startLineNumber: 7,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("A2", () => {
    testOnModelLinesInserted(3, 4, [], {
      startLineNumber: 8,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("A3", () => {
    testOnModelLinesInserted(3, 5, [], {
      startLineNumber: 9,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("A4", () => {
    testOnModelLinesInserted(3, 6, [], {
      startLineNumber: 10,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("A5", () => {
    testOnModelLinesInserted(3, 7, [], {
      startLineNumber: 11,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("A6", () => {
    testOnModelLinesInserted(3, 8, [], {
      startLineNumber: 12,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("A7", () => {
    testOnModelLinesInserted(3, 9, [], {
      startLineNumber: 13,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("A8", () => {
    testOnModelLinesInserted(3, 10, [], {
      startLineNumber: 14,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("B1", () => {
    testOnModelLinesInserted(5, 5, [], {
      startLineNumber: 7,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("B2", () => {
    testOnModelLinesInserted(5, 6, [], {
      startLineNumber: 8,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("B3", () => {
    testOnModelLinesInserted(5, 7, [], {
      startLineNumber: 9,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("B4", () => {
    testOnModelLinesInserted(5, 8, [], {
      startLineNumber: 10,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("B5", () => {
    testOnModelLinesInserted(5, 9, [], {
      startLineNumber: 11,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("B6", () => {
    testOnModelLinesInserted(5, 10, [], {
      startLineNumber: 12,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("C1", () => {
    testOnModelLinesInserted(6, 6, [], {
      startLineNumber: 7,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("C2", () => {
    testOnModelLinesInserted(6, 7, [], {
      startLineNumber: 8,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("C3", () => {
    testOnModelLinesInserted(6, 8, [], {
      startLineNumber: 9,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("C4", () => {
    testOnModelLinesInserted(6, 9, [], {
      startLineNumber: 10,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("C5", () => {
    testOnModelLinesInserted(6, 10, [], {
      startLineNumber: 11,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("D1", () => {
    testOnModelLinesInserted(7, 7, ["old9"], {
      startLineNumber: 6,
      lines: ["old6", "new", "old7", "old8"],
      pinged: [false, false, false, false]
    });
  });
  test("D2", () => {
    testOnModelLinesInserted(7, 8, ["old8", "old9"], {
      startLineNumber: 6,
      lines: ["old6", "new", "new", "old7"],
      pinged: [false, false, false, false]
    });
  });
  test("D3", () => {
    testOnModelLinesInserted(7, 9, ["old7", "old8", "old9"], {
      startLineNumber: 6,
      lines: ["old6"],
      pinged: [false]
    });
  });
  test("D4", () => {
    testOnModelLinesInserted(7, 10, ["old7", "old8", "old9"], {
      startLineNumber: 6,
      lines: ["old6"],
      pinged: [false]
    });
  });
  test("E1", () => {
    testOnModelLinesInserted(8, 8, ["old9"], {
      startLineNumber: 6,
      lines: ["old6", "old7", "new", "old8"],
      pinged: [false, false, false, false]
    });
  });
  test("E2", () => {
    testOnModelLinesInserted(8, 9, ["old8", "old9"], {
      startLineNumber: 6,
      lines: ["old6", "old7"],
      pinged: [false, false]
    });
  });
  test("E3", () => {
    testOnModelLinesInserted(8, 10, ["old8", "old9"], {
      startLineNumber: 6,
      lines: ["old6", "old7"],
      pinged: [false, false]
    });
  });
  test("F1", () => {
    testOnModelLinesInserted(9, 9, ["old9"], {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8"],
      pinged: [false, false, false]
    });
  });
  test("F2", () => {
    testOnModelLinesInserted(9, 10, ["old9"], {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8"],
      pinged: [false, false, false]
    });
  });
  test("G1", () => {
    testOnModelLinesInserted(10, 10, [], {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("G2", () => {
    testOnModelLinesInserted(10, 11, [], {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("H1", () => {
    testOnModelLinesInserted(11, 13, [], {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
});
suite("RenderedLinesCollection onTokensChanged", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function testOnModelTokensChanged(changedFromLineNumber, changedToLineNumber, expectedPinged, expectedState) {
    const col = new RenderedLinesCollection({ createLine: () => new TestLine("new") });
    col._set(6, [
      new TestLine("old6"),
      new TestLine("old7"),
      new TestLine("old8"),
      new TestLine("old9")
    ]);
    const actualPinged = col.onTokensChanged([{ fromLineNumber: changedFromLineNumber, toLineNumber: changedToLineNumber }]);
    assert.deepStrictEqual(actualPinged, expectedPinged);
    assertState(col, expectedState);
  }
  test("A", () => {
    testOnModelTokensChanged(3, 3, false, {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("B", () => {
    testOnModelTokensChanged(3, 5, false, {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("C", () => {
    testOnModelTokensChanged(3, 6, true, {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [true, false, false, false]
    });
  });
  test("D", () => {
    testOnModelTokensChanged(6, 6, true, {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [true, false, false, false]
    });
  });
  test("E", () => {
    testOnModelTokensChanged(5, 10, true, {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [true, true, true, true]
    });
  });
  test("F", () => {
    testOnModelTokensChanged(8, 9, true, {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, true, true]
    });
  });
  test("G", () => {
    testOnModelTokensChanged(8, 11, true, {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, true, true]
    });
  });
  test("H", () => {
    testOnModelTokensChanged(10, 10, false, {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
  test("I", () => {
    testOnModelTokensChanged(10, 11, false, {
      startLineNumber: 6,
      lines: ["old6", "old7", "old8", "old9"],
      pinged: [false, false, false, false]
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9icm93c2VyL3ZpZXcvdmlld0xheWVyLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElMaW5lLCBSZW5kZXJlZExpbmVzQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvdmlldy92aWV3TGF5ZXIuanMnO1xuXG5jbGFzcyBUZXN0TGluZSBpbXBsZW1lbnRzIElMaW5lIHtcblxuXHRfcGluZ2VkID0gZmFsc2U7XG5cdGNvbnN0cnVjdG9yKHB1YmxpYyBpZDogc3RyaW5nKSB7XG5cdH1cblxuXHRvbkNvbnRlbnRDaGFuZ2VkKCk6IHZvaWQge1xuXHRcdHRoaXMuX3BpbmdlZCA9IHRydWU7XG5cdH1cblx0b25Ub2tlbnNDaGFuZ2VkKCk6IHZvaWQge1xuXHRcdHRoaXMuX3BpbmdlZCA9IHRydWU7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElMaW5lc0NvbGxlY3Rpb25TdGF0ZSB7XG5cdHN0YXJ0TGluZU51bWJlcjogbnVtYmVyO1xuXHRsaW5lczogc3RyaW5nW107XG5cdHBpbmdlZDogYm9vbGVhbltdO1xufVxuXG5mdW5jdGlvbiBhc3NlcnRTdGF0ZShjb2w6IFJlbmRlcmVkTGluZXNDb2xsZWN0aW9uPFRlc3RMaW5lPiwgc3RhdGU6IElMaW5lc0NvbGxlY3Rpb25TdGF0ZSk6IHZvaWQge1xuXHRjb25zdCBhY3R1YWxTdGF0ZTogSUxpbmVzQ29sbGVjdGlvblN0YXRlID0ge1xuXHRcdHN0YXJ0TGluZU51bWJlcjogY29sLmdldFN0YXJ0TGluZU51bWJlcigpLFxuXHRcdGxpbmVzOiBbXSxcblx0XHRwaW5nZWQ6IFtdXG5cdH07XG5cdGZvciAobGV0IGxpbmVOdW1iZXIgPSBjb2wuZ2V0U3RhcnRMaW5lTnVtYmVyKCk7IGxpbmVOdW1iZXIgPD0gY29sLmdldEVuZExpbmVOdW1iZXIoKTsgbGluZU51bWJlcisrKSB7XG5cdFx0YWN0dWFsU3RhdGUubGluZXMucHVzaChjb2wuZ2V0TGluZShsaW5lTnVtYmVyKS5pZCk7XG5cdFx0YWN0dWFsU3RhdGUucGluZ2VkLnB1c2goY29sLmdldExpbmUobGluZU51bWJlcikuX3BpbmdlZCk7XG5cdH1cblx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWxTdGF0ZSwgc3RhdGUpO1xufVxuXG5zdWl0ZSgnUmVuZGVyZWRMaW5lc0NvbGxlY3Rpb24gb25MaW5lc0RlbGV0ZWQnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0ZnVuY3Rpb24gdGVzdE9uTW9kZWxMaW5lc0RlbGV0ZWQoZGVsZXRlRnJvbUxpbmVOdW1iZXI6IG51bWJlciwgZGVsZXRlVG9MaW5lTnVtYmVyOiBudW1iZXIsIGV4cGVjdGVkRGVsZXRlZDogc3RyaW5nW10sIGV4cGVjdGVkU3RhdGU6IElMaW5lc0NvbGxlY3Rpb25TdGF0ZSk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbCA9IG5ldyBSZW5kZXJlZExpbmVzQ29sbGVjdGlvbjxUZXN0TGluZT4oeyBjcmVhdGVMaW5lOiAoKSA9PiBuZXcgVGVzdExpbmUoJ25ldycpIH0pO1xuXHRcdGNvbC5fc2V0KDYsIFtcblx0XHRcdG5ldyBUZXN0TGluZSgnb2xkNicpLFxuXHRcdFx0bmV3IFRlc3RMaW5lKCdvbGQ3JyksXG5cdFx0XHRuZXcgVGVzdExpbmUoJ29sZDgnKSxcblx0XHRcdG5ldyBUZXN0TGluZSgnb2xkOScpXG5cdFx0XSk7XG5cdFx0Y29uc3QgYWN0dWFsRGVsZXRlZDEgPSBjb2wub25MaW5lc0RlbGV0ZWQoZGVsZXRlRnJvbUxpbmVOdW1iZXIsIGRlbGV0ZVRvTGluZU51bWJlcik7XG5cdFx0bGV0IGFjdHVhbERlbGV0ZWQ6IHN0cmluZ1tdID0gW107XG5cdFx0aWYgKGFjdHVhbERlbGV0ZWQxKSB7XG5cdFx0XHRhY3R1YWxEZWxldGVkID0gYWN0dWFsRGVsZXRlZDEubWFwKGxpbmUgPT4gbGluZS5pZCk7XG5cdFx0fVxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsRGVsZXRlZCwgZXhwZWN0ZWREZWxldGVkKTtcblx0XHRhc3NlcnRTdGF0ZShjb2wsIGV4cGVjdGVkU3RhdGUpO1xuXHR9XG5cblx0dGVzdCgnQTEnLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxMaW5lc0RlbGV0ZWQoMywgMywgW10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNSxcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdBMicsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzRGVsZXRlZCgzLCA0LCBbXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA0LFxuXHRcdFx0bGluZXM6IFsnb2xkNicsICdvbGQ3JywgJ29sZDgnLCAnb2xkOSddLFxuXHRcdFx0cGluZ2VkOiBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2VdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0EzJywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNEZWxldGVkKDMsIDUsIFtdLCB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IDMsXG5cdFx0XHRsaW5lczogWydvbGQ2JywgJ29sZDcnLCAnb2xkOCcsICdvbGQ5J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnQTQnLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxMaW5lc0RlbGV0ZWQoMywgNiwgWydvbGQ2J10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogMyxcblx0XHRcdGxpbmVzOiBbJ29sZDcnLCAnb2xkOCcsICdvbGQ5J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdBNScsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzRGVsZXRlZCgzLCA3LCBbJ29sZDYnLCAnb2xkNyddLCB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IDMsXG5cdFx0XHRsaW5lczogWydvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZV1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnQTYnLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxMaW5lc0RlbGV0ZWQoMywgOCwgWydvbGQ2JywgJ29sZDcnLCAnb2xkOCddLCB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IDMsXG5cdFx0XHRsaW5lczogWydvbGQ5J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZV1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnQTcnLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxMaW5lc0RlbGV0ZWQoMywgOSwgWydvbGQ2JywgJ29sZDcnLCAnb2xkOCcsICdvbGQ5J10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogMyxcblx0XHRcdGxpbmVzOiBbXSxcblx0XHRcdHBpbmdlZDogW11cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnQTgnLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxMaW5lc0RlbGV0ZWQoMywgMTAsIFsnb2xkNicsICdvbGQ3JywgJ29sZDgnLCAnb2xkOSddLCB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IDMsXG5cdFx0XHRsaW5lczogW10sXG5cdFx0XHRwaW5nZWQ6IFtdXG5cdFx0fSk7XG5cdH0pO1xuXG5cblx0dGVzdCgnQjEnLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxMaW5lc0RlbGV0ZWQoNSwgNSwgW10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNSxcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdCMicsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzRGVsZXRlZCg1LCA2LCBbJ29sZDYnXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA1LFxuXHRcdFx0bGluZXM6IFsnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2VdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0IzJywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNEZWxldGVkKDUsIDcsIFsnb2xkNicsICdvbGQ3J10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNSxcblx0XHRcdGxpbmVzOiBbJ29sZDgnLCAnb2xkOSddLFxuXHRcdFx0cGluZ2VkOiBbZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdCNCcsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzRGVsZXRlZCg1LCA4LCBbJ29sZDYnLCAnb2xkNycsICdvbGQ4J10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNSxcblx0XHRcdGxpbmVzOiBbJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdCNScsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzRGVsZXRlZCg1LCA5LCBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA1LFxuXHRcdFx0bGluZXM6IFtdLFxuXHRcdFx0cGluZ2VkOiBbXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdCNicsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzRGVsZXRlZCg1LCAxMCwgWydvbGQ2JywgJ29sZDcnLCAnb2xkOCcsICdvbGQ5J10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNSxcblx0XHRcdGxpbmVzOiBbXSxcblx0XHRcdHBpbmdlZDogW11cblx0XHR9KTtcblx0fSk7XG5cblxuXHR0ZXN0KCdDMScsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzRGVsZXRlZCg2LCA2LCBbJ29sZDYnXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA2LFxuXHRcdFx0bGluZXM6IFsnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2VdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0MyJywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNEZWxldGVkKDYsIDcsIFsnb2xkNicsICdvbGQ3J10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDgnLCAnb2xkOSddLFxuXHRcdFx0cGluZ2VkOiBbZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdDMycsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzRGVsZXRlZCg2LCA4LCBbJ29sZDYnLCAnb2xkNycsICdvbGQ4J10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdDNCcsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzRGVsZXRlZCg2LCA5LCBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA2LFxuXHRcdFx0bGluZXM6IFtdLFxuXHRcdFx0cGluZ2VkOiBbXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdDNScsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzRGVsZXRlZCg2LCAxMCwgWydvbGQ2JywgJ29sZDcnLCAnb2xkOCcsICdvbGQ5J10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbXSxcblx0XHRcdHBpbmdlZDogW11cblx0XHR9KTtcblx0fSk7XG5cblxuXHR0ZXN0KCdEMScsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzRGVsZXRlZCg3LCA3LCBbJ29sZDcnXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA2LFxuXHRcdFx0bGluZXM6IFsnb2xkNicsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2VdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0QyJywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNEZWxldGVkKDcsIDgsIFsnb2xkNycsICdvbGQ4J10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkOSddLFxuXHRcdFx0cGluZ2VkOiBbZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdEMycsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzRGVsZXRlZCg3LCA5LCBbJ29sZDcnLCAnb2xkOCcsICdvbGQ5J10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdENCcsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzRGVsZXRlZCg3LCAxMCwgWydvbGQ3JywgJ29sZDgnLCAnb2xkOSddLCB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IDYsXG5cdFx0XHRsaW5lczogWydvbGQ2J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZV1cblx0XHR9KTtcblx0fSk7XG5cblxuXHR0ZXN0KCdFMScsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzRGVsZXRlZCg4LCA4LCBbJ29sZDgnXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA2LFxuXHRcdFx0bGluZXM6IFsnb2xkNicsICdvbGQ3JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2VdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0UyJywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNEZWxldGVkKDgsIDksIFsnb2xkOCcsICdvbGQ5J10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNyddLFxuXHRcdFx0cGluZ2VkOiBbZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdFMycsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzRGVsZXRlZCg4LCAxMCwgWydvbGQ4JywgJ29sZDknXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA2LFxuXHRcdFx0bGluZXM6IFsnb2xkNicsICdvbGQ3J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZSwgZmFsc2VdXG5cdFx0fSk7XG5cdH0pO1xuXG5cblx0dGVzdCgnRjEnLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxMaW5lc0RlbGV0ZWQoOSwgOSwgWydvbGQ5J10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdGMicsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzRGVsZXRlZCg5LCAxMCwgWydvbGQ5J10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXG5cdHRlc3QoJ0cxJywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNEZWxldGVkKDEwLCAxMCwgW10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdHMicsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzRGVsZXRlZCgxMCwgMTEsIFtdLCB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IDYsXG5cdFx0XHRsaW5lczogWydvbGQ2JywgJ29sZDcnLCAnb2xkOCcsICdvbGQ5J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV1cblx0XHR9KTtcblx0fSk7XG5cblxuXHR0ZXN0KCdIMScsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzRGVsZXRlZCgxMSwgMTMsIFtdLCB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IDYsXG5cdFx0XHRsaW5lczogWydvbGQ2JywgJ29sZDcnLCAnb2xkOCcsICdvbGQ5J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV1cblx0XHR9KTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ1JlbmRlcmVkTGluZXNDb2xsZWN0aW9uIG9uTGluZUNoYW5nZWQnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0ZnVuY3Rpb24gdGVzdE9uTW9kZWxMaW5lQ2hhbmdlZChjaGFuZ2VkTGluZU51bWJlcjogbnVtYmVyLCBleHBlY3RlZFBpbmdlZDogYm9vbGVhbiwgZXhwZWN0ZWRTdGF0ZTogSUxpbmVzQ29sbGVjdGlvblN0YXRlKTogdm9pZCB7XG5cdFx0Y29uc3QgY29sID0gbmV3IFJlbmRlcmVkTGluZXNDb2xsZWN0aW9uPFRlc3RMaW5lPih7IGNyZWF0ZUxpbmU6ICgpID0+IG5ldyBUZXN0TGluZSgnbmV3JykgfSk7XG5cdFx0Y29sLl9zZXQoNiwgW1xuXHRcdFx0bmV3IFRlc3RMaW5lKCdvbGQ2JyksXG5cdFx0XHRuZXcgVGVzdExpbmUoJ29sZDcnKSxcblx0XHRcdG5ldyBUZXN0TGluZSgnb2xkOCcpLFxuXHRcdFx0bmV3IFRlc3RMaW5lKCdvbGQ5Jylcblx0XHRdKTtcblx0XHRjb25zdCBhY3R1YWxQaW5nZWQgPSBjb2wub25MaW5lc0NoYW5nZWQoY2hhbmdlZExpbmVOdW1iZXIsIDEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsUGluZ2VkLCBleHBlY3RlZFBpbmdlZCk7XG5cdFx0YXNzZXJ0U3RhdGUoY29sLCBleHBlY3RlZFN0YXRlKTtcblx0fVxuXG5cdHRlc3QoJzMnLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxMaW5lQ2hhbmdlZCgzLCBmYWxzZSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA2LFxuXHRcdFx0bGluZXM6IFsnb2xkNicsICdvbGQ3JywgJ29sZDgnLCAnb2xkOSddLFxuXHRcdFx0cGluZ2VkOiBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2VdXG5cdFx0fSk7XG5cdH0pO1xuXHR0ZXN0KCc0JywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZUNoYW5nZWQoNCwgZmFsc2UsIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblx0dGVzdCgnNScsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVDaGFuZ2VkKDUsIGZhbHNlLCB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IDYsXG5cdFx0XHRsaW5lczogWydvbGQ2JywgJ29sZDcnLCAnb2xkOCcsICdvbGQ5J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV1cblx0XHR9KTtcblx0fSk7XG5cdHRlc3QoJzYnLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxMaW5lQ2hhbmdlZCg2LCB0cnVlLCB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IDYsXG5cdFx0XHRsaW5lczogWydvbGQ2JywgJ29sZDcnLCAnb2xkOCcsICdvbGQ5J10sXG5cdFx0XHRwaW5nZWQ6IFt0cnVlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblx0dGVzdCgnNycsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVDaGFuZ2VkKDcsIHRydWUsIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCB0cnVlLCBmYWxzZSwgZmFsc2VdXG5cdFx0fSk7XG5cdH0pO1xuXHR0ZXN0KCc4JywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZUNoYW5nZWQoOCwgdHJ1ZSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA2LFxuXHRcdFx0bGluZXM6IFsnb2xkNicsICdvbGQ3JywgJ29sZDgnLCAnb2xkOSddLFxuXHRcdFx0cGluZ2VkOiBbZmFsc2UsIGZhbHNlLCB0cnVlLCBmYWxzZV1cblx0XHR9KTtcblx0fSk7XG5cdHRlc3QoJzknLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxMaW5lQ2hhbmdlZCg5LCB0cnVlLCB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IDYsXG5cdFx0XHRsaW5lczogWydvbGQ2JywgJ29sZDcnLCAnb2xkOCcsICdvbGQ5J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZSwgZmFsc2UsIGZhbHNlLCB0cnVlXVxuXHRcdH0pO1xuXHR9KTtcblx0dGVzdCgnMTAnLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxMaW5lQ2hhbmdlZCgxMCwgZmFsc2UsIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblx0dGVzdCgnMTEnLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxMaW5lQ2hhbmdlZCgxMSwgZmFsc2UsIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxufSk7XG5cbnN1aXRlKCdSZW5kZXJlZExpbmVzQ29sbGVjdGlvbiBvbkxpbmVzSW5zZXJ0ZWQnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0ZnVuY3Rpb24gdGVzdE9uTW9kZWxMaW5lc0luc2VydGVkKGluc2VydEZyb21MaW5lTnVtYmVyOiBudW1iZXIsIGluc2VydFRvTGluZU51bWJlcjogbnVtYmVyLCBleHBlY3RlZERlbGV0ZWQ6IHN0cmluZ1tdLCBleHBlY3RlZFN0YXRlOiBJTGluZXNDb2xsZWN0aW9uU3RhdGUpOiB2b2lkIHtcblx0XHRjb25zdCBjb2wgPSBuZXcgUmVuZGVyZWRMaW5lc0NvbGxlY3Rpb248VGVzdExpbmU+KHsgY3JlYXRlTGluZTogKCkgPT4gbmV3IFRlc3RMaW5lKCduZXcnKSB9KTtcblx0XHRjb2wuX3NldCg2LCBbXG5cdFx0XHRuZXcgVGVzdExpbmUoJ29sZDYnKSxcblx0XHRcdG5ldyBUZXN0TGluZSgnb2xkNycpLFxuXHRcdFx0bmV3IFRlc3RMaW5lKCdvbGQ4JyksXG5cdFx0XHRuZXcgVGVzdExpbmUoJ29sZDknKVxuXHRcdF0pO1xuXHRcdGNvbnN0IGFjdHVhbERlbGV0ZWQxID0gY29sLm9uTGluZXNJbnNlcnRlZChpbnNlcnRGcm9tTGluZU51bWJlciwgaW5zZXJ0VG9MaW5lTnVtYmVyKTtcblx0XHRsZXQgYWN0dWFsRGVsZXRlZDogc3RyaW5nW10gPSBbXTtcblx0XHRpZiAoYWN0dWFsRGVsZXRlZDEpIHtcblx0XHRcdGFjdHVhbERlbGV0ZWQgPSBhY3R1YWxEZWxldGVkMS5tYXAobGluZSA9PiBsaW5lLmlkKTtcblx0XHR9XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWxEZWxldGVkLCBleHBlY3RlZERlbGV0ZWQpO1xuXHRcdGFzc2VydFN0YXRlKGNvbCwgZXhwZWN0ZWRTdGF0ZSk7XG5cdH1cblxuXHR0ZXN0KCdBMScsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzSW5zZXJ0ZWQoMywgMywgW10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNyxcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdBMicsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzSW5zZXJ0ZWQoMywgNCwgW10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogOCxcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdBMycsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzSW5zZXJ0ZWQoMywgNSwgW10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogOSxcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdBNCcsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzSW5zZXJ0ZWQoMywgNiwgW10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogMTAsXG5cdFx0XHRsaW5lczogWydvbGQ2JywgJ29sZDcnLCAnb2xkOCcsICdvbGQ5J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnQTUnLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxMaW5lc0luc2VydGVkKDMsIDcsIFtdLCB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IDExLFxuXHRcdFx0bGluZXM6IFsnb2xkNicsICdvbGQ3JywgJ29sZDgnLCAnb2xkOSddLFxuXHRcdFx0cGluZ2VkOiBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2VdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0E2JywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNJbnNlcnRlZCgzLCA4LCBbXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxMixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdBNycsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzSW5zZXJ0ZWQoMywgOSwgW10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogMTMsXG5cdFx0XHRsaW5lczogWydvbGQ2JywgJ29sZDcnLCAnb2xkOCcsICdvbGQ5J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnQTgnLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxMaW5lc0luc2VydGVkKDMsIDEwLCBbXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxNCxcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXG5cdHRlc3QoJ0IxJywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNJbnNlcnRlZCg1LCA1LCBbXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA3LFxuXHRcdFx0bGluZXM6IFsnb2xkNicsICdvbGQ3JywgJ29sZDgnLCAnb2xkOSddLFxuXHRcdFx0cGluZ2VkOiBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2VdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0IyJywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNJbnNlcnRlZCg1LCA2LCBbXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA4LFxuXHRcdFx0bGluZXM6IFsnb2xkNicsICdvbGQ3JywgJ29sZDgnLCAnb2xkOSddLFxuXHRcdFx0cGluZ2VkOiBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2VdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0IzJywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNJbnNlcnRlZCg1LCA3LCBbXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA5LFxuXHRcdFx0bGluZXM6IFsnb2xkNicsICdvbGQ3JywgJ29sZDgnLCAnb2xkOSddLFxuXHRcdFx0cGluZ2VkOiBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2VdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0I0JywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNJbnNlcnRlZCg1LCA4LCBbXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxMCxcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdCNScsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzSW5zZXJ0ZWQoNSwgOSwgW10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogMTEsXG5cdFx0XHRsaW5lczogWydvbGQ2JywgJ29sZDcnLCAnb2xkOCcsICdvbGQ5J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnQjYnLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxMaW5lc0luc2VydGVkKDUsIDEwLCBbXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxMixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXG5cdHRlc3QoJ0MxJywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNJbnNlcnRlZCg2LCA2LCBbXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA3LFxuXHRcdFx0bGluZXM6IFsnb2xkNicsICdvbGQ3JywgJ29sZDgnLCAnb2xkOSddLFxuXHRcdFx0cGluZ2VkOiBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2VdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0MyJywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNJbnNlcnRlZCg2LCA3LCBbXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA4LFxuXHRcdFx0bGluZXM6IFsnb2xkNicsICdvbGQ3JywgJ29sZDgnLCAnb2xkOSddLFxuXHRcdFx0cGluZ2VkOiBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2VdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0MzJywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNJbnNlcnRlZCg2LCA4LCBbXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA5LFxuXHRcdFx0bGluZXM6IFsnb2xkNicsICdvbGQ3JywgJ29sZDgnLCAnb2xkOSddLFxuXHRcdFx0cGluZ2VkOiBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2VdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0M0JywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNJbnNlcnRlZCg2LCA5LCBbXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxMCxcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdDNScsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzSW5zZXJ0ZWQoNiwgMTAsIFtdLCB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IDExLFxuXHRcdFx0bGluZXM6IFsnb2xkNicsICdvbGQ3JywgJ29sZDgnLCAnb2xkOSddLFxuXHRcdFx0cGluZ2VkOiBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2VdXG5cdFx0fSk7XG5cdH0pO1xuXG5cblx0dGVzdCgnRDEnLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxMaW5lc0luc2VydGVkKDcsIDcsIFsnb2xkOSddLCB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IDYsXG5cdFx0XHRsaW5lczogWydvbGQ2JywgJ25ldycsICdvbGQ3JywgJ29sZDgnXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdEMicsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzSW5zZXJ0ZWQoNywgOCwgWydvbGQ4JywgJ29sZDknXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA2LFxuXHRcdFx0bGluZXM6IFsnb2xkNicsICduZXcnLCAnbmV3JywgJ29sZDcnXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdEMycsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzSW5zZXJ0ZWQoNywgOSwgWydvbGQ3JywgJ29sZDgnLCAnb2xkOSddLCB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IDYsXG5cdFx0XHRsaW5lczogWydvbGQ2J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZV1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRDQnLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxMaW5lc0luc2VydGVkKDcsIDEwLCBbJ29sZDcnLCAnb2xkOCcsICdvbGQ5J10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXG5cdHRlc3QoJ0UxJywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNJbnNlcnRlZCg4LCA4LCBbJ29sZDknXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA2LFxuXHRcdFx0bGluZXM6IFsnb2xkNicsICdvbGQ3JywgJ25ldycsICdvbGQ4J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRTInLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxMaW5lc0luc2VydGVkKDgsIDksIFsnb2xkOCcsICdvbGQ5J10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNyddLFxuXHRcdFx0cGluZ2VkOiBbZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdFMycsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbExpbmVzSW5zZXJ0ZWQoOCwgMTAsIFsnb2xkOCcsICdvbGQ5J10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNyddLFxuXHRcdFx0cGluZ2VkOiBbZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXG5cdHRlc3QoJ0YxJywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNJbnNlcnRlZCg5LCA5LCBbJ29sZDknXSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA2LFxuXHRcdFx0bGluZXM6IFsnb2xkNicsICdvbGQ3JywgJ29sZDgnXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2VdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0YyJywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNJbnNlcnRlZCg5LCAxMCwgWydvbGQ5J10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXG5cdHRlc3QoJ0cxJywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNJbnNlcnRlZCgxMCwgMTAsIFtdLCB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IDYsXG5cdFx0XHRsaW5lczogWydvbGQ2JywgJ29sZDcnLCAnb2xkOCcsICdvbGQ5J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRzInLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxMaW5lc0luc2VydGVkKDEwLCAxMSwgW10sIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblxuXG5cdHRlc3QoJ0gxJywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsTGluZXNJbnNlcnRlZCgxMSwgMTMsIFtdLCB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IDYsXG5cdFx0XHRsaW5lczogWydvbGQ2JywgJ29sZDcnLCAnb2xkOCcsICdvbGQ5J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV1cblx0XHR9KTtcblx0fSk7XG59KTtcblxuXG5zdWl0ZSgnUmVuZGVyZWRMaW5lc0NvbGxlY3Rpb24gb25Ub2tlbnNDaGFuZ2VkJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGZ1bmN0aW9uIHRlc3RPbk1vZGVsVG9rZW5zQ2hhbmdlZChjaGFuZ2VkRnJvbUxpbmVOdW1iZXI6IG51bWJlciwgY2hhbmdlZFRvTGluZU51bWJlcjogbnVtYmVyLCBleHBlY3RlZFBpbmdlZDogYm9vbGVhbiwgZXhwZWN0ZWRTdGF0ZTogSUxpbmVzQ29sbGVjdGlvblN0YXRlKTogdm9pZCB7XG5cdFx0Y29uc3QgY29sID0gbmV3IFJlbmRlcmVkTGluZXNDb2xsZWN0aW9uPFRlc3RMaW5lPih7IGNyZWF0ZUxpbmU6ICgpID0+IG5ldyBUZXN0TGluZSgnbmV3JykgfSk7XG5cdFx0Y29sLl9zZXQoNiwgW1xuXHRcdFx0bmV3IFRlc3RMaW5lKCdvbGQ2JyksXG5cdFx0XHRuZXcgVGVzdExpbmUoJ29sZDcnKSxcblx0XHRcdG5ldyBUZXN0TGluZSgnb2xkOCcpLFxuXHRcdFx0bmV3IFRlc3RMaW5lKCdvbGQ5Jylcblx0XHRdKTtcblx0XHRjb25zdCBhY3R1YWxQaW5nZWQgPSBjb2wub25Ub2tlbnNDaGFuZ2VkKFt7IGZyb21MaW5lTnVtYmVyOiBjaGFuZ2VkRnJvbUxpbmVOdW1iZXIsIHRvTGluZU51bWJlcjogY2hhbmdlZFRvTGluZU51bWJlciB9XSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWxQaW5nZWQsIGV4cGVjdGVkUGluZ2VkKTtcblx0XHRhc3NlcnRTdGF0ZShjb2wsIGV4cGVjdGVkU3RhdGUpO1xuXHR9XG5cblx0dGVzdCgnQScsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbFRva2Vuc0NoYW5nZWQoMywgMywgZmFsc2UsIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblx0dGVzdCgnQicsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbFRva2Vuc0NoYW5nZWQoMywgNSwgZmFsc2UsIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcblx0dGVzdCgnQycsICgpID0+IHtcblx0XHR0ZXN0T25Nb2RlbFRva2Vuc0NoYW5nZWQoMywgNiwgdHJ1ZSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA2LFxuXHRcdFx0bGluZXM6IFsnb2xkNicsICdvbGQ3JywgJ29sZDgnLCAnb2xkOSddLFxuXHRcdFx0cGluZ2VkOiBbdHJ1ZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV1cblx0XHR9KTtcblx0fSk7XG5cdHRlc3QoJ0QnLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxUb2tlbnNDaGFuZ2VkKDYsIDYsIHRydWUsIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW3RydWUsIGZhbHNlLCBmYWxzZSwgZmFsc2VdXG5cdFx0fSk7XG5cdH0pO1xuXHR0ZXN0KCdFJywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsVG9rZW5zQ2hhbmdlZCg1LCAxMCwgdHJ1ZSwge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiA2LFxuXHRcdFx0bGluZXM6IFsnb2xkNicsICdvbGQ3JywgJ29sZDgnLCAnb2xkOSddLFxuXHRcdFx0cGluZ2VkOiBbdHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZV1cblx0XHR9KTtcblx0fSk7XG5cdHRlc3QoJ0YnLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxUb2tlbnNDaGFuZ2VkKDgsIDksIHRydWUsIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgdHJ1ZSwgdHJ1ZV1cblx0XHR9KTtcblx0fSk7XG5cdHRlc3QoJ0cnLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxUb2tlbnNDaGFuZ2VkKDgsIDExLCB0cnVlLCB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IDYsXG5cdFx0XHRsaW5lczogWydvbGQ2JywgJ29sZDcnLCAnb2xkOCcsICdvbGQ5J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZSwgZmFsc2UsIHRydWUsIHRydWVdXG5cdFx0fSk7XG5cdH0pO1xuXHR0ZXN0KCdIJywgKCkgPT4ge1xuXHRcdHRlc3RPbk1vZGVsVG9rZW5zQ2hhbmdlZCgxMCwgMTAsIGZhbHNlLCB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IDYsXG5cdFx0XHRsaW5lczogWydvbGQ2JywgJ29sZDcnLCAnb2xkOCcsICdvbGQ5J10sXG5cdFx0XHRwaW5nZWQ6IFtmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV1cblx0XHR9KTtcblx0fSk7XG5cdHRlc3QoJ0knLCAoKSA9PiB7XG5cdFx0dGVzdE9uTW9kZWxUb2tlbnNDaGFuZ2VkKDEwLCAxMSwgZmFsc2UsIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogNixcblx0XHRcdGxpbmVzOiBbJ29sZDYnLCAnb2xkNycsICdvbGQ4JywgJ29sZDknXSxcblx0XHRcdHBpbmdlZDogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXVxuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsK0NBQStDO0FBQ3hELFNBQWdCLCtCQUErQjtBQUUvQyxNQUFNLFNBQTBCO0FBQUEsRUFHL0IsWUFBbUIsSUFBWTtBQUFaO0FBRG5CLG1CQUFVO0FBQUEsRUFFVjtBQUFBLEVBRUEsbUJBQXlCO0FBQ3hCLFNBQUssVUFBVTtBQUFBLEVBQ2hCO0FBQUEsRUFDQSxrQkFBd0I7QUFDdkIsU0FBSyxVQUFVO0FBQUEsRUFDaEI7QUFDRDtBQVFBLFNBQVMsWUFBWSxLQUF3QyxPQUFvQztBQUNoRyxRQUFNLGNBQXFDO0FBQUEsSUFDMUMsaUJBQWlCLElBQUksbUJBQW1CO0FBQUEsSUFDeEMsT0FBTyxDQUFDO0FBQUEsSUFDUixRQUFRLENBQUM7QUFBQSxFQUNWO0FBQ0EsV0FBUyxhQUFhLElBQUksbUJBQW1CLEdBQUcsY0FBYyxJQUFJLGlCQUFpQixHQUFHLGNBQWM7QUFDbkcsZ0JBQVksTUFBTSxLQUFLLElBQUksUUFBUSxVQUFVLEVBQUUsRUFBRTtBQUNq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
