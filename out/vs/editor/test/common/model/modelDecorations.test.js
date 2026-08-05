import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { EditOperation } from "../../../common/core/editOperation.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { EndOfLineSequence, TrackedRangeStickiness } from "../../../common/model.js";
import { createTextModel } from "../testTextModel.js";
function modelHasDecorations(model, decorations) {
  const modelDecorations = [];
  const actualDecorations = model.getAllDecorations();
  for (let i = 0, len = actualDecorations.length; i < len; i++) {
    modelDecorations.push({
      range: actualDecorations[i].range,
      className: actualDecorations[i].options.className
    });
  }
  modelDecorations.sort((a, b) => Range.compareRangesUsingStarts(a.range, b.range));
  assert.deepStrictEqual(modelDecorations, decorations);
}
function modelHasDecoration(model, startLineNumber, startColumn, endLineNumber, endColumn, className) {
  modelHasDecorations(model, [{
    range: new Range(startLineNumber, startColumn, endLineNumber, endColumn),
    className
  }]);
}
function modelHasNoDecorations(model) {
  assert.strictEqual(model.getAllDecorations().length, 0, "Model has no decoration");
}
function addDecoration(model, startLineNumber, startColumn, endLineNumber, endColumn, className) {
  return model.changeDecorations((changeAccessor) => {
    return changeAccessor.addDecoration(new Range(startLineNumber, startColumn, endLineNumber, endColumn), {
      description: "test",
      className
    });
  });
}
function lineHasDecorations(model, lineNumber, decorations) {
  const lineDecorations = [];
  const decs = model.getLineDecorations(lineNumber);
  for (let i = 0, len = decs.length; i < len; i++) {
    lineDecorations.push({
      start: decs[i].range.startColumn,
      end: decs[i].range.endColumn,
      className: decs[i].options.className
    });
  }
  assert.deepStrictEqual(lineDecorations, decorations, "Line decorations");
}
function lineHasNoDecorations(model, lineNumber) {
  lineHasDecorations(model, lineNumber, []);
}
function lineHasDecoration(model, lineNumber, start, end, className) {
  lineHasDecorations(model, lineNumber, [{
    start,
    end,
    className
  }]);
}
suite("Editor Model - Model Decorations", () => {
  const LINE1 = "My First Line";
  const LINE2 = "		My Second Line";
  const LINE3 = "    Third Line";
  const LINE4 = "";
  const LINE5 = "1";
  let thisModel;
  setup(() => {
    const text = LINE1 + "\r\n" + LINE2 + "\n" + LINE3 + "\n" + LINE4 + "\r\n" + LINE5;
    thisModel = createTextModel(text);
  });
  teardown(() => {
    thisModel.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("single character decoration", () => {
    addDecoration(thisModel, 1, 1, 1, 2, "myType");
    lineHasDecoration(thisModel, 1, 1, 2, "myType");
    lineHasNoDecorations(thisModel, 2);
    lineHasNoDecorations(thisModel, 3);
    lineHasNoDecorations(thisModel, 4);
    lineHasNoDecorations(thisModel, 5);
  });
  test("line decoration", () => {
    addDecoration(thisModel, 1, 1, 1, 14, "myType");
    lineHasDecoration(thisModel, 1, 1, 14, "myType");
    lineHasNoDecorations(thisModel, 2);
    lineHasNoDecorations(thisModel, 3);
    lineHasNoDecorations(thisModel, 4);
    lineHasNoDecorations(thisModel, 5);
  });
  test("full line decoration", () => {
    addDecoration(thisModel, 1, 1, 2, 1, "myType");
    const line1Decorations = thisModel.getLineDecorations(1);
    assert.strictEqual(line1Decorations.length, 1);
    assert.strictEqual(line1Decorations[0].options.className, "myType");
    const line2Decorations = thisModel.getLineDecorations(1);
    assert.strictEqual(line2Decorations.length, 1);
    assert.strictEqual(line2Decorations[0].options.className, "myType");
    lineHasNoDecorations(thisModel, 3);
    lineHasNoDecorations(thisModel, 4);
    lineHasNoDecorations(thisModel, 5);
  });
  test("multiple line decoration", () => {
    addDecoration(thisModel, 1, 2, 3, 2, "myType");
    const line1Decorations = thisModel.getLineDecorations(1);
    assert.strictEqual(line1Decorations.length, 1);
    assert.strictEqual(line1Decorations[0].options.className, "myType");
    const line2Decorations = thisModel.getLineDecorations(1);
    assert.strictEqual(line2Decorations.length, 1);
    assert.strictEqual(line2Decorations[0].options.className, "myType");
    const line3Decorations = thisModel.getLineDecorations(1);
    assert.strictEqual(line3Decorations.length, 1);
    assert.strictEqual(line3Decorations[0].options.className, "myType");
    lineHasNoDecorations(thisModel, 4);
    lineHasNoDecorations(thisModel, 5);
  });
  test("decoration gets removed", () => {
    const decId = addDecoration(thisModel, 1, 2, 3, 2, "myType");
    modelHasDecoration(thisModel, 1, 2, 3, 2, "myType");
    thisModel.changeDecorations((changeAccessor) => {
      changeAccessor.removeDecoration(decId);
    });
    modelHasNoDecorations(thisModel);
  });
  test("decorations get removed", () => {
    const decId1 = addDecoration(thisModel, 1, 2, 3, 2, "myType1");
    const decId2 = addDecoration(thisModel, 1, 2, 3, 1, "myType2");
    modelHasDecorations(thisModel, [
      {
        range: new Range(1, 2, 3, 1),
        className: "myType2"
      },
      {
        range: new Range(1, 2, 3, 2),
        className: "myType1"
      }
    ]);
    thisModel.changeDecorations((changeAccessor) => {
      changeAccessor.removeDecoration(decId1);
    });
    modelHasDecorations(thisModel, [
      {
        range: new Range(1, 2, 3, 1),
        className: "myType2"
      }
    ]);
    thisModel.changeDecorations((changeAccessor) => {
      changeAccessor.removeDecoration(decId2);
    });
    modelHasNoDecorations(thisModel);
  });
  test("decoration range can be changed", () => {
    const decId = addDecoration(thisModel, 1, 2, 3, 2, "myType");
    modelHasDecoration(thisModel, 1, 2, 3, 2, "myType");
    thisModel.changeDecorations((changeAccessor) => {
      changeAccessor.changeDecoration(decId, new Range(1, 1, 1, 2));
    });
    modelHasDecoration(thisModel, 1, 1, 1, 2, "myType");
  });
  test("decorations emit event on add", () => {
    let listenerCalled = 0;
    const disposable = thisModel.onDidChangeDecorations((e) => {
      listenerCalled++;
    });
    addDecoration(thisModel, 1, 2, 3, 2, "myType");
    assert.strictEqual(listenerCalled, 1, "listener called");
    disposable.dispose();
  });
  test("decorations emit event on change", () => {
    let listenerCalled = 0;
    const decId = addDecoration(thisModel, 1, 2, 3, 2, "myType");
    const disposable = thisModel.onDidChangeDecorations((e) => {
      listenerCalled++;
    });
    thisModel.changeDecorations((changeAccessor) => {
      changeAccessor.changeDecoration(decId, new Range(1, 1, 1, 2));
    });
    assert.strictEqual(listenerCalled, 1, "listener called");
    disposable.dispose();
  });
  test("decorations emit event on remove", () => {
    let listenerCalled = 0;
    const decId = addDecoration(thisModel, 1, 2, 3, 2, "myType");
    const disposable = thisModel.onDidChangeDecorations((e) => {
      listenerCalled++;
    });
    thisModel.changeDecorations((changeAccessor) => {
      changeAccessor.removeDecoration(decId);
    });
    assert.strictEqual(listenerCalled, 1, "listener called");
    disposable.dispose();
  });
  test("decorations emit event when inserting one line text before it", () => {
    let listenerCalled = 0;
    addDecoration(thisModel, 1, 2, 3, 2, "myType");
    const disposable = thisModel.onDidChangeDecorations((e) => {
      listenerCalled++;
    });
    thisModel.applyEdits([EditOperation.insert(new Position(1, 1), "Hallo ")]);
    assert.strictEqual(listenerCalled, 1, "listener called");
    disposable.dispose();
  });
  test("decorations do not emit event on no-op deltaDecorations", () => {
    let listenerCalled = 0;
    const disposable = thisModel.onDidChangeDecorations((e) => {
      listenerCalled++;
    });
    thisModel.deltaDecorations([], []);
    thisModel.changeDecorations((accessor) => {
      accessor.deltaDecorations([], []);
    });
    assert.strictEqual(listenerCalled, 0, "listener not called");
    disposable.dispose();
  });
  test("decorations are updated when inserting one line text before it", () => {
    addDecoration(thisModel, 1, 2, 3, 2, "myType");
    modelHasDecoration(thisModel, 1, 2, 3, 2, "myType");
    thisModel.applyEdits([EditOperation.insert(new Position(1, 1), "Hallo ")]);
    modelHasDecoration(thisModel, 1, 8, 3, 2, "myType");
  });
  test("decorations are updated when inserting one line text before it 2", () => {
    addDecoration(thisModel, 1, 1, 3, 2, "myType");
    modelHasDecoration(thisModel, 1, 1, 3, 2, "myType");
    thisModel.applyEdits([EditOperation.replace(new Range(1, 1, 1, 1), "Hallo ")]);
    modelHasDecoration(thisModel, 1, 1, 3, 2, "myType");
  });
  test("decorations are updated when inserting multiple lines text before it", () => {
    addDecoration(thisModel, 1, 2, 3, 2, "myType");
    modelHasDecoration(thisModel, 1, 2, 3, 2, "myType");
    thisModel.applyEdits([EditOperation.insert(new Position(1, 1), "Hallo\nI'm inserting multiple\nlines")]);
    modelHasDecoration(thisModel, 3, 7, 5, 2, "myType");
  });
  test("decorations change when inserting text after them", () => {
    addDecoration(thisModel, 1, 2, 3, 2, "myType");
    modelHasDecoration(thisModel, 1, 2, 3, 2, "myType");
    thisModel.applyEdits([EditOperation.insert(new Position(3, 2), "Hallo")]);
    modelHasDecoration(thisModel, 1, 2, 3, 7, "myType");
  });
  test("decorations are updated when inserting text inside", () => {
    addDecoration(thisModel, 1, 2, 3, 2, "myType");
    modelHasDecoration(thisModel, 1, 2, 3, 2, "myType");
    thisModel.applyEdits([EditOperation.insert(new Position(1, 3), "Hallo ")]);
    modelHasDecoration(thisModel, 1, 2, 3, 2, "myType");
  });
  test("decorations are updated when inserting text inside 2", () => {
    addDecoration(thisModel, 1, 2, 3, 2, "myType");
    modelHasDecoration(thisModel, 1, 2, 3, 2, "myType");
    thisModel.applyEdits([EditOperation.insert(new Position(3, 1), "Hallo ")]);
    modelHasDecoration(thisModel, 1, 2, 3, 8, "myType");
  });
  test("decorations are updated when inserting text inside 3", () => {
    addDecoration(thisModel, 1, 1, 2, 16, "myType");
    modelHasDecoration(thisModel, 1, 1, 2, 16, "myType");
    thisModel.applyEdits([EditOperation.insert(new Position(2, 2), "\n")]);
    modelHasDecoration(thisModel, 1, 1, 3, 15, "myType");
  });
  test("decorations are updated when inserting multiple lines text inside", () => {
    addDecoration(thisModel, 1, 2, 3, 2, "myType");
    modelHasDecoration(thisModel, 1, 2, 3, 2, "myType");
    thisModel.applyEdits([EditOperation.insert(new Position(1, 3), "Hallo\nI'm inserting multiple\nlines")]);
    modelHasDecoration(thisModel, 1, 2, 5, 2, "myType");
  });
  test("decorations are updated when deleting one line text before it", () => {
    addDecoration(thisModel, 1, 2, 3, 2, "myType");
    modelHasDecoration(thisModel, 1, 2, 3, 2, "myType");
    thisModel.applyEdits([EditOperation.delete(new Range(1, 1, 1, 2))]);
    modelHasDecoration(thisModel, 1, 1, 3, 2, "myType");
  });
  test("decorations are updated when deleting multiple lines text before it", () => {
    addDecoration(thisModel, 2, 2, 3, 2, "myType");
    modelHasDecoration(thisModel, 2, 2, 3, 2, "myType");
    thisModel.applyEdits([EditOperation.delete(new Range(1, 1, 2, 1))]);
    modelHasDecoration(thisModel, 1, 2, 2, 2, "myType");
  });
  test("decorations are updated when deleting multiple lines text before it 2", () => {
    addDecoration(thisModel, 2, 3, 3, 2, "myType");
    modelHasDecoration(thisModel, 2, 3, 3, 2, "myType");
    thisModel.applyEdits([EditOperation.delete(new Range(1, 1, 2, 2))]);
    modelHasDecoration(thisModel, 1, 2, 2, 2, "myType");
  });
  test("decorations are updated when deleting text inside", () => {
    addDecoration(thisModel, 1, 2, 4, 1, "myType");
    modelHasDecoration(thisModel, 1, 2, 4, 1, "myType");
    thisModel.applyEdits([EditOperation.delete(new Range(1, 3, 2, 1))]);
    modelHasDecoration(thisModel, 1, 2, 3, 1, "myType");
  });
  test("decorations are updated when deleting text inside 2", () => {
    addDecoration(thisModel, 1, 2, 4, 1, "myType");
    modelHasDecoration(thisModel, 1, 2, 4, 1, "myType");
    thisModel.applyEdits([
      EditOperation.delete(new Range(1, 1, 1, 2)),
      EditOperation.delete(new Range(4, 1, 4, 1))
    ]);
    modelHasDecoration(thisModel, 1, 1, 4, 1, "myType");
  });
  test("decorations are updated when deleting multiple lines text", () => {
    addDecoration(thisModel, 1, 2, 4, 1, "myType");
    modelHasDecoration(thisModel, 1, 2, 4, 1, "myType");
    thisModel.applyEdits([EditOperation.delete(new Range(1, 1, 3, 1))]);
    modelHasDecoration(thisModel, 1, 1, 2, 1, "myType");
  });
  test("decorations are updated when changing EOL", () => {
    addDecoration(thisModel, 1, 2, 4, 1, "myType1");
    addDecoration(thisModel, 1, 3, 4, 1, "myType2");
    addDecoration(thisModel, 1, 4, 4, 1, "myType3");
    addDecoration(thisModel, 1, 5, 4, 1, "myType4");
    addDecoration(thisModel, 1, 6, 4, 1, "myType5");
    addDecoration(thisModel, 1, 7, 4, 1, "myType6");
    addDecoration(thisModel, 1, 8, 4, 1, "myType7");
    addDecoration(thisModel, 1, 9, 4, 1, "myType8");
    addDecoration(thisModel, 1, 10, 4, 1, "myType9");
    thisModel.applyEdits([EditOperation.insert(new Position(1, 1), "x")]);
    thisModel.setEOL(EndOfLineSequence.CRLF);
    thisModel.applyEdits([EditOperation.insert(new Position(1, 1), "x")]);
    modelHasDecorations(thisModel, [
      { range: new Range(1, 4, 4, 1), className: "myType1" },
      { range: new Range(1, 5, 4, 1), className: "myType2" },
      { range: new Range(1, 6, 4, 1), className: "myType3" },
      { range: new Range(1, 7, 4, 1), className: "myType4" },
      { range: new Range(1, 8, 4, 1), className: "myType5" },
      { range: new Range(1, 9, 4, 1), className: "myType6" },
      { range: new Range(1, 10, 4, 1), className: "myType7" },
      { range: new Range(1, 11, 4, 1), className: "myType8" },
      { range: new Range(1, 12, 4, 1), className: "myType9" }
    ]);
  });
  test("an apparently simple edit", () => {
    addDecoration(thisModel, 1, 2, 4, 1, "myType1");
    thisModel.applyEdits([EditOperation.replace(new Range(1, 14, 2, 1), "x")]);
    modelHasDecorations(thisModel, [
      { range: new Range(1, 2, 3, 1), className: "myType1" }
    ]);
  });
  test("removeAllDecorationsWithOwnerId can be called after model dispose", () => {
    const model = createTextModel("asd");
    model.dispose();
    model.removeAllDecorationsWithOwnerId(1);
  });
  test("removeAllDecorationsWithOwnerId works", () => {
    thisModel.deltaDecorations([], [{ range: new Range(1, 2, 4, 1), options: { description: "test", className: "myType1" } }], 1);
    thisModel.removeAllDecorationsWithOwnerId(1);
    modelHasNoDecorations(thisModel);
  });
});
suite("Decorations and editing", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function _runTest(decRange, stickiness, editRange, editText, editForceMoveMarkers, expectedDecRange, msg) {
    const model = createTextModel([
      "My First Line",
      "My Second Line",
      "Third Line"
    ].join("\n"));
    const id = model.deltaDecorations([], [{ range: decRange, options: { description: "test", stickiness } }])[0];
    model.applyEdits([{
      range: editRange,
      text: editText,
      forceMoveMarkers: editForceMoveMarkers
    }]);
    const actual = model.getDecorationRange(id);
    assert.deepStrictEqual(actual, expectedDecRange, msg);
    model.dispose();
  }
  function runTest(decRange, editRange, editText, expectedDecRange) {
    _runTest(decRange, 0, editRange, editText, false, expectedDecRange[0][0], "no-0-AlwaysGrowsWhenTypingAtEdges");
    _runTest(decRange, 1, editRange, editText, false, expectedDecRange[0][1], "no-1-NeverGrowsWhenTypingAtEdges");
    _runTest(decRange, 2, editRange, editText, false, expectedDecRange[0][2], "no-2-GrowsOnlyWhenTypingBefore");
    _runTest(decRange, 3, editRange, editText, false, expectedDecRange[0][3], "no-3-GrowsOnlyWhenTypingAfter");
    _runTest(decRange, 0, editRange, editText, true, expectedDecRange[1][0], "force-0-AlwaysGrowsWhenTypingAtEdges");
    _runTest(decRange, 1, editRange, editText, true, expectedDecRange[1][1], "force-1-NeverGrowsWhenTypingAtEdges");
    _runTest(decRange, 2, editRange, editText, true, expectedDecRange[1][2], "force-2-GrowsOnlyWhenTypingBefore");
    _runTest(decRange, 3, editRange, editText, true, expectedDecRange[1][3], "force-3-GrowsOnlyWhenTypingAfter");
  }
  suite("insert", () => {
    suite("collapsed dec", () => {
      test("before", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 3, 1, 3),
          "xx",
          [
            [new Range(1, 6, 1, 6), new Range(1, 6, 1, 6), new Range(1, 6, 1, 6), new Range(1, 6, 1, 6)],
            [new Range(1, 6, 1, 6), new Range(1, 6, 1, 6), new Range(1, 6, 1, 6), new Range(1, 6, 1, 6)]
          ]
        );
      });
      test("equal", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 4, 1, 4),
          "xx",
          [
            [new Range(1, 4, 1, 6), new Range(1, 6, 1, 6), new Range(1, 4, 1, 4), new Range(1, 6, 1, 6)],
            [new Range(1, 6, 1, 6), new Range(1, 6, 1, 6), new Range(1, 6, 1, 6), new Range(1, 6, 1, 6)]
          ]
        );
      });
      test("after", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 5, 1, 5),
          "xx",
          [
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)],
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)]
          ]
        );
      });
    });
    suite("non-collapsed dec", () => {
      test("before", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 3),
          "xx",
          [
            [new Range(1, 6, 1, 11), new Range(1, 6, 1, 11), new Range(1, 6, 1, 11), new Range(1, 6, 1, 11)],
            [new Range(1, 6, 1, 11), new Range(1, 6, 1, 11), new Range(1, 6, 1, 11), new Range(1, 6, 1, 11)]
          ]
        );
      });
      test("start", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 4),
          "xx",
          [
            [new Range(1, 4, 1, 11), new Range(1, 6, 1, 11), new Range(1, 4, 1, 11), new Range(1, 6, 1, 11)],
            [new Range(1, 6, 1, 11), new Range(1, 6, 1, 11), new Range(1, 6, 1, 11), new Range(1, 6, 1, 11)]
          ]
        );
      });
      test("inside", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 5),
          "xx",
          [
            [new Range(1, 4, 1, 11), new Range(1, 4, 1, 11), new Range(1, 4, 1, 11), new Range(1, 4, 1, 11)],
            [new Range(1, 4, 1, 11), new Range(1, 4, 1, 11), new Range(1, 4, 1, 11), new Range(1, 4, 1, 11)]
          ]
        );
      });
      test("end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 9, 1, 9),
          "xx",
          [
            [new Range(1, 4, 1, 11), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 11)],
            [new Range(1, 4, 1, 11), new Range(1, 4, 1, 11), new Range(1, 4, 1, 11), new Range(1, 4, 1, 11)]
          ]
        );
      });
      test("after", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 10, 1, 10),
          "xx",
          [
            [new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9)],
            [new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9)]
          ]
        );
      });
    });
  });
  suite("delete", () => {
    suite("collapsed dec", () => {
      test("edit.end < range.start", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 1, 1, 3),
          "",
          [
            [new Range(1, 2, 1, 2), new Range(1, 2, 1, 2), new Range(1, 2, 1, 2), new Range(1, 2, 1, 2)],
            [new Range(1, 2, 1, 2), new Range(1, 2, 1, 2), new Range(1, 2, 1, 2), new Range(1, 2, 1, 2)]
          ]
        );
      });
      test("edit.end <= range.start", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 2, 1, 4),
          "",
          [
            [new Range(1, 2, 1, 2), new Range(1, 2, 1, 2), new Range(1, 2, 1, 2), new Range(1, 2, 1, 2)],
            [new Range(1, 2, 1, 2), new Range(1, 2, 1, 2), new Range(1, 2, 1, 2), new Range(1, 2, 1, 2)]
          ]
        );
      });
      test("edit.start < range.start && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 3, 1, 5),
          "",
          [
            [new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3)],
            [new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3)]
          ]
        );
      });
      test("edit.start >= range.end", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 4, 1, 6),
          "",
          [
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)],
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)]
          ]
        );
      });
      test("edit.start > range.end", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 5, 1, 7),
          "",
          [
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)],
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)]
          ]
        );
      });
    });
    suite("non-collapsed dec", () => {
      test("edit.end < range.start", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 1, 1, 3),
          "",
          [
            [new Range(1, 2, 1, 7), new Range(1, 2, 1, 7), new Range(1, 2, 1, 7), new Range(1, 2, 1, 7)],
            [new Range(1, 2, 1, 7), new Range(1, 2, 1, 7), new Range(1, 2, 1, 7), new Range(1, 2, 1, 7)]
          ]
        );
      });
      test("edit.end <= range.start", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 2, 1, 4),
          "",
          [
            [new Range(1, 2, 1, 7), new Range(1, 2, 1, 7), new Range(1, 2, 1, 7), new Range(1, 2, 1, 7)],
            [new Range(1, 2, 1, 7), new Range(1, 2, 1, 7), new Range(1, 2, 1, 7), new Range(1, 2, 1, 7)]
          ]
        );
      });
      test("edit.start < range.start && edit.end < range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 5),
          "",
          [
            [new Range(1, 3, 1, 7), new Range(1, 3, 1, 7), new Range(1, 3, 1, 7), new Range(1, 3, 1, 7)],
            [new Range(1, 3, 1, 7), new Range(1, 3, 1, 7), new Range(1, 3, 1, 7), new Range(1, 3, 1, 7)]
          ]
        );
      });
      test("edit.start < range.start && edit.end == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 9),
          "",
          [
            [new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3)],
            [new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3)]
          ]
        );
      });
      test("edit.start < range.start && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 10),
          "",
          [
            [new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3)],
            [new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3)]
          ]
        );
      });
      test("edit.start == range.start && edit.end < range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 6),
          "",
          [
            [new Range(1, 4, 1, 7), new Range(1, 4, 1, 7), new Range(1, 4, 1, 7), new Range(1, 4, 1, 7)],
            [new Range(1, 4, 1, 7), new Range(1, 4, 1, 7), new Range(1, 4, 1, 7), new Range(1, 4, 1, 7)]
          ]
        );
      });
      test("edit.start == range.start && edit.end == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 9),
          "",
          [
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)],
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)]
          ]
        );
      });
      test("edit.start == range.start && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 10),
          "",
          [
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)],
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)]
          ]
        );
      });
      test("edit.start > range.start && edit.start < range.end && edit.end < range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 7),
          "",
          [
            [new Range(1, 4, 1, 7), new Range(1, 4, 1, 7), new Range(1, 4, 1, 7), new Range(1, 4, 1, 7)],
            [new Range(1, 4, 1, 7), new Range(1, 4, 1, 7), new Range(1, 4, 1, 7), new Range(1, 4, 1, 7)]
          ]
        );
      });
      test("edit.start > range.start && edit.start < range.end && edit.end == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 9),
          "",
          [
            [new Range(1, 4, 1, 5), new Range(1, 4, 1, 5), new Range(1, 4, 1, 5), new Range(1, 4, 1, 5)],
            [new Range(1, 4, 1, 5), new Range(1, 4, 1, 5), new Range(1, 4, 1, 5), new Range(1, 4, 1, 5)]
          ]
        );
      });
      test("edit.start > range.start && edit.start < range.end && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 10),
          "",
          [
            [new Range(1, 4, 1, 5), new Range(1, 4, 1, 5), new Range(1, 4, 1, 5), new Range(1, 4, 1, 5)],
            [new Range(1, 4, 1, 5), new Range(1, 4, 1, 5), new Range(1, 4, 1, 5), new Range(1, 4, 1, 5)]
          ]
        );
      });
      test("edit.start == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 9, 1, 11),
          "",
          [
            [new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9)],
            [new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9)]
          ]
        );
      });
      test("edit.start > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 10, 1, 11),
          "",
          [
            [new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9)],
            [new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9)]
          ]
        );
      });
    });
  });
  suite("replace short", () => {
    suite("collapsed dec", () => {
      test("edit.end < range.start", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 1, 1, 3),
          "c",
          [
            [new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3)],
            [new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3)]
          ]
        );
      });
      test("edit.end <= range.start", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 2, 1, 4),
          "c",
          [
            [new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3)],
            [new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3), new Range(1, 3, 1, 3)]
          ]
        );
      });
      test("edit.start < range.start && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 3, 1, 5),
          "c",
          [
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)],
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)]
          ]
        );
      });
      test("edit.start >= range.end", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 4, 1, 6),
          "c",
          [
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)],
            [new Range(1, 5, 1, 5), new Range(1, 5, 1, 5), new Range(1, 5, 1, 5), new Range(1, 5, 1, 5)]
          ]
        );
      });
      test("edit.start > range.end", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 5, 1, 7),
          "c",
          [
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)],
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)]
          ]
        );
      });
    });
    suite("non-collapsed dec", () => {
      test("edit.end < range.start", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 1, 1, 3),
          "c",
          [
            [new Range(1, 3, 1, 8), new Range(1, 3, 1, 8), new Range(1, 3, 1, 8), new Range(1, 3, 1, 8)],
            [new Range(1, 3, 1, 8), new Range(1, 3, 1, 8), new Range(1, 3, 1, 8), new Range(1, 3, 1, 8)]
          ]
        );
      });
      test("edit.end <= range.start", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 2, 1, 4),
          "c",
          [
            [new Range(1, 3, 1, 8), new Range(1, 3, 1, 8), new Range(1, 3, 1, 8), new Range(1, 3, 1, 8)],
            [new Range(1, 3, 1, 8), new Range(1, 3, 1, 8), new Range(1, 3, 1, 8), new Range(1, 3, 1, 8)]
          ]
        );
      });
      test("edit.start < range.start && edit.end < range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 5),
          "c",
          [
            [new Range(1, 4, 1, 8), new Range(1, 4, 1, 8), new Range(1, 4, 1, 8), new Range(1, 4, 1, 8)],
            [new Range(1, 4, 1, 8), new Range(1, 4, 1, 8), new Range(1, 4, 1, 8), new Range(1, 4, 1, 8)]
          ]
        );
      });
      test("edit.start < range.start && edit.end == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 9),
          "c",
          [
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)],
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)]
          ]
        );
      });
      test("edit.start < range.start && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 10),
          "c",
          [
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)],
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)]
          ]
        );
      });
      test("edit.start == range.start && edit.end < range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 6),
          "c",
          [
            [new Range(1, 4, 1, 8), new Range(1, 4, 1, 8), new Range(1, 4, 1, 8), new Range(1, 4, 1, 8)],
            [new Range(1, 5, 1, 8), new Range(1, 5, 1, 8), new Range(1, 5, 1, 8), new Range(1, 5, 1, 8)]
          ]
        );
      });
      test("edit.start == range.start && edit.end == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 9),
          "c",
          [
            [new Range(1, 4, 1, 5), new Range(1, 4, 1, 5), new Range(1, 4, 1, 5), new Range(1, 4, 1, 5)],
            [new Range(1, 5, 1, 5), new Range(1, 5, 1, 5), new Range(1, 5, 1, 5), new Range(1, 5, 1, 5)]
          ]
        );
      });
      test("edit.start == range.start && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 10),
          "c",
          [
            [new Range(1, 4, 1, 5), new Range(1, 4, 1, 5), new Range(1, 4, 1, 5), new Range(1, 4, 1, 5)],
            [new Range(1, 5, 1, 5), new Range(1, 5, 1, 5), new Range(1, 5, 1, 5), new Range(1, 5, 1, 5)]
          ]
        );
      });
      test("edit.start > range.start && edit.start < range.end && edit.end < range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 7),
          "c",
          [
            [new Range(1, 4, 1, 8), new Range(1, 4, 1, 8), new Range(1, 4, 1, 8), new Range(1, 4, 1, 8)],
            [new Range(1, 4, 1, 8), new Range(1, 4, 1, 8), new Range(1, 4, 1, 8), new Range(1, 4, 1, 8)]
          ]
        );
      });
      test("edit.start > range.start && edit.start < range.end && edit.end == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 9),
          "c",
          [
            [new Range(1, 4, 1, 6), new Range(1, 4, 1, 6), new Range(1, 4, 1, 6), new Range(1, 4, 1, 6)],
            [new Range(1, 4, 1, 6), new Range(1, 4, 1, 6), new Range(1, 4, 1, 6), new Range(1, 4, 1, 6)]
          ]
        );
      });
      test("edit.start > range.start && edit.start < range.end && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 10),
          "c",
          [
            [new Range(1, 4, 1, 6), new Range(1, 4, 1, 6), new Range(1, 4, 1, 6), new Range(1, 4, 1, 6)],
            [new Range(1, 4, 1, 6), new Range(1, 4, 1, 6), new Range(1, 4, 1, 6), new Range(1, 4, 1, 6)]
          ]
        );
      });
      test("edit.start == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 9, 1, 11),
          "c",
          [
            [new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9)],
            [new Range(1, 4, 1, 10), new Range(1, 4, 1, 10), new Range(1, 4, 1, 10), new Range(1, 4, 1, 10)]
          ]
        );
      });
      test("edit.start > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 10, 1, 11),
          "c",
          [
            [new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9)],
            [new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9)]
          ]
        );
      });
    });
  });
  suite("replace long", () => {
    suite("collapsed dec", () => {
      test("edit.end < range.start", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 1, 1, 3),
          "cccc",
          [
            [new Range(1, 6, 1, 6), new Range(1, 6, 1, 6), new Range(1, 6, 1, 6), new Range(1, 6, 1, 6)],
            [new Range(1, 6, 1, 6), new Range(1, 6, 1, 6), new Range(1, 6, 1, 6), new Range(1, 6, 1, 6)]
          ]
        );
      });
      test("edit.end <= range.start", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 2, 1, 4),
          "cccc",
          [
            [new Range(1, 4, 1, 6), new Range(1, 6, 1, 6), new Range(1, 4, 1, 4), new Range(1, 6, 1, 6)],
            [new Range(1, 6, 1, 6), new Range(1, 6, 1, 6), new Range(1, 6, 1, 6), new Range(1, 6, 1, 6)]
          ]
        );
      });
      test("edit.start < range.start && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 3, 1, 5),
          "cccc",
          [
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)],
            [new Range(1, 7, 1, 7), new Range(1, 7, 1, 7), new Range(1, 7, 1, 7), new Range(1, 7, 1, 7)]
          ]
        );
      });
      test("edit.start >= range.end", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 4, 1, 6),
          "cccc",
          [
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)],
            [new Range(1, 8, 1, 8), new Range(1, 8, 1, 8), new Range(1, 8, 1, 8), new Range(1, 8, 1, 8)]
          ]
        );
      });
      test("edit.start > range.end", () => {
        runTest(
          new Range(1, 4, 1, 4),
          new Range(1, 5, 1, 7),
          "cccc",
          [
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)],
            [new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4), new Range(1, 4, 1, 4)]
          ]
        );
      });
    });
    suite("non-collapsed dec", () => {
      test("edit.end < range.start", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 1, 1, 3),
          "cccc",
          [
            [new Range(1, 6, 1, 11), new Range(1, 6, 1, 11), new Range(1, 6, 1, 11), new Range(1, 6, 1, 11)],
            [new Range(1, 6, 1, 11), new Range(1, 6, 1, 11), new Range(1, 6, 1, 11), new Range(1, 6, 1, 11)]
          ]
        );
      });
      test("edit.end <= range.start", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 2, 1, 4),
          "cccc",
          [
            [new Range(1, 4, 1, 11), new Range(1, 6, 1, 11), new Range(1, 4, 1, 11), new Range(1, 6, 1, 11)],
            [new Range(1, 6, 1, 11), new Range(1, 6, 1, 11), new Range(1, 6, 1, 11), new Range(1, 6, 1, 11)]
          ]
        );
      });
      test("edit.start < range.start && edit.end < range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 5),
          "cccc",
          [
            [new Range(1, 4, 1, 11), new Range(1, 4, 1, 11), new Range(1, 4, 1, 11), new Range(1, 4, 1, 11)],
            [new Range(1, 7, 1, 11), new Range(1, 7, 1, 11), new Range(1, 7, 1, 11), new Range(1, 7, 1, 11)]
          ]
        );
      });
      test("edit.start < range.start && edit.end == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 9),
          "cccc",
          [
            [new Range(1, 4, 1, 7), new Range(1, 4, 1, 7), new Range(1, 4, 1, 7), new Range(1, 4, 1, 7)],
            [new Range(1, 7, 1, 7), new Range(1, 7, 1, 7), new Range(1, 7, 1, 7), new Range(1, 7, 1, 7)]
          ]
        );
      });
      test("edit.start < range.start && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 3, 1, 10),
          "cccc",
          [
            [new Range(1, 4, 1, 7), new Range(1, 4, 1, 7), new Range(1, 4, 1, 7), new Range(1, 4, 1, 7)],
            [new Range(1, 7, 1, 7), new Range(1, 7, 1, 7), new Range(1, 7, 1, 7), new Range(1, 7, 1, 7)]
          ]
        );
      });
      test("edit.start == range.start && edit.end < range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 6),
          "cccc",
          [
            [new Range(1, 4, 1, 11), new Range(1, 4, 1, 11), new Range(1, 4, 1, 11), new Range(1, 4, 1, 11)],
            [new Range(1, 8, 1, 11), new Range(1, 8, 1, 11), new Range(1, 8, 1, 11), new Range(1, 8, 1, 11)]
          ]
        );
      });
      test("edit.start == range.start && edit.end == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 9),
          "cccc",
          [
            [new Range(1, 4, 1, 8), new Range(1, 4, 1, 8), new Range(1, 4, 1, 8), new Range(1, 4, 1, 8)],
            [new Range(1, 8, 1, 8), new Range(1, 8, 1, 8), new Range(1, 8, 1, 8), new Range(1, 8, 1, 8)]
          ]
        );
      });
      test("edit.start == range.start && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 4, 1, 10),
          "cccc",
          [
            [new Range(1, 4, 1, 8), new Range(1, 4, 1, 8), new Range(1, 4, 1, 8), new Range(1, 4, 1, 8)],
            [new Range(1, 8, 1, 8), new Range(1, 8, 1, 8), new Range(1, 8, 1, 8), new Range(1, 8, 1, 8)]
          ]
        );
      });
      test("edit.start > range.start && edit.start < range.end && edit.end < range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 7),
          "cccc",
          [
            [new Range(1, 4, 1, 11), new Range(1, 4, 1, 11), new Range(1, 4, 1, 11), new Range(1, 4, 1, 11)],
            [new Range(1, 4, 1, 11), new Range(1, 4, 1, 11), new Range(1, 4, 1, 11), new Range(1, 4, 1, 11)]
          ]
        );
      });
      test("edit.start > range.start && edit.start < range.end && edit.end == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 9),
          "cccc",
          [
            [new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9)],
            [new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9)]
          ]
        );
      });
      test("edit.start > range.start && edit.start < range.end && edit.end > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 5, 1, 10),
          "cccc",
          [
            [new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9)],
            [new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9)]
          ]
        );
      });
      test("edit.start == range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 9, 1, 11),
          "cccc",
          [
            [new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9)],
            [new Range(1, 4, 1, 13), new Range(1, 4, 1, 13), new Range(1, 4, 1, 13), new Range(1, 4, 1, 13)]
          ]
        );
      });
      test("edit.start > range.end", () => {
        runTest(
          new Range(1, 4, 1, 9),
          new Range(1, 10, 1, 11),
          "cccc",
          [
            [new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9)],
            [new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9), new Range(1, 4, 1, 9)]
          ]
        );
      });
    });
  });
});
suite("deltaDecorations", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function decoration(id, startLineNumber, startColumn, endLineNumber, endColum) {
    return {
      id,
      range: new Range(startLineNumber, startColumn, endLineNumber, endColum)
    };
  }
  function toModelDeltaDecoration(dec) {
    return {
      range: dec.range,
      options: {
        description: "test",
        className: dec.id
      }
    };
  }
  function strcmp(a, b) {
    if (a === b) {
      return 0;
    }
    if (a < b) {
      return -1;
    }
    return 1;
  }
  function readModelDecorations(model, ids) {
    return ids.map((id) => {
      return {
        range: model.getDecorationRange(id),
        id: model.getDecorationOptions(id).className
      };
    });
  }
  function testDeltaDecorations(text, decorations, newDecorations) {
    const model = createTextModel(text.join("\n"));
    const initialIds = model.deltaDecorations([], decorations.map(toModelDeltaDecoration));
    const actualDecorations = readModelDecorations(model, initialIds);
    assert.strictEqual(initialIds.length, decorations.length, "returns expected cnt of ids");
    assert.strictEqual(initialIds.length, model.getAllDecorations().length, "does not leak decorations");
    actualDecorations.sort((a, b) => strcmp(a.id, b.id));
    decorations.sort((a, b) => strcmp(a.id, b.id));
    assert.deepStrictEqual(actualDecorations, decorations);
    const newIds = model.deltaDecorations(initialIds, newDecorations.map(toModelDeltaDecoration));
    const actualNewDecorations = readModelDecorations(model, newIds);
    assert.strictEqual(newIds.length, newDecorations.length, "returns expected cnt of ids");
    assert.strictEqual(newIds.length, model.getAllDecorations().length, "does not leak decorations");
    actualNewDecorations.sort((a, b) => strcmp(a.id, b.id));
    newDecorations.sort((a, b) => strcmp(a.id, b.id));
    assert.deepStrictEqual(actualDecorations, decorations);
    model.dispose();
  }
  function range(startLineNumber, startColumn, endLineNumber, endColumn) {
    return new Range(startLineNumber, startColumn, endLineNumber, endColumn);
  }
  test("result respects input", () => {
    const model = createTextModel([
      "Hello world,",
      "How are you?"
    ].join("\n"));
    const ids = model.deltaDecorations([], [
      toModelDeltaDecoration(decoration("a", 1, 1, 1, 12)),
      toModelDeltaDecoration(decoration("b", 2, 1, 2, 13))
    ]);
    assert.deepStrictEqual(model.getDecorationRange(ids[0]), range(1, 1, 1, 12));
    assert.deepStrictEqual(model.getDecorationRange(ids[1]), range(2, 1, 2, 13));
    model.dispose();
  });
  test("deltaDecorations 1", () => {
    testDeltaDecorations(
      [
        "This is a text",
        "That has multiple lines",
        "And is very friendly",
        "Towards testing"
      ],
      [
        decoration("a", 1, 1, 1, 2),
        decoration("b", 1, 1, 1, 15),
        decoration("c", 1, 1, 2, 1),
        decoration("d", 1, 1, 2, 24),
        decoration("e", 2, 1, 2, 24),
        decoration("f", 2, 1, 4, 16)
      ],
      [
        decoration("x", 1, 1, 1, 2),
        decoration("b", 1, 1, 1, 15),
        decoration("c", 1, 1, 2, 1),
        decoration("d", 1, 1, 2, 24),
        decoration("e", 2, 1, 2, 21),
        decoration("f", 2, 17, 4, 16)
      ]
    );
  });
  test("deltaDecorations 2", () => {
    testDeltaDecorations(
      [
        "This is a text",
        "That has multiple lines",
        "And is very friendly",
        "Towards testing"
      ],
      [
        decoration("a", 1, 1, 1, 2),
        decoration("b", 1, 2, 1, 3),
        decoration("c", 1, 3, 1, 4),
        decoration("d", 1, 4, 1, 5),
        decoration("e", 1, 5, 1, 6)
      ],
      [
        decoration("a", 1, 2, 1, 3),
        decoration("b", 1, 3, 1, 4),
        decoration("c", 1, 4, 1, 5),
        decoration("d", 1, 5, 1, 6)
      ]
    );
  });
  test("deltaDecorations 3", () => {
    testDeltaDecorations(
      [
        "This is a text",
        "That has multiple lines",
        "And is very friendly",
        "Towards testing"
      ],
      [
        decoration("a", 1, 1, 1, 2),
        decoration("b", 1, 2, 1, 3),
        decoration("c", 1, 3, 1, 4),
        decoration("d", 1, 4, 1, 5),
        decoration("e", 1, 5, 1, 6)
      ],
      []
    );
  });
  test("issue #4317: editor.setDecorations doesn't update the hover message", () => {
    const model = createTextModel("Hello world!");
    let ids = model.deltaDecorations([], [{
      range: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 100,
        endColumn: 1
      },
      options: {
        description: "test",
        hoverMessage: { value: "hello1" }
      }
    }]);
    ids = model.deltaDecorations(ids, [{
      range: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 100,
        endColumn: 1
      },
      options: {
        description: "test",
        hoverMessage: { value: "hello2" }
      }
    }]);
    const actualDecoration = model.getDecorationOptions(ids[0]);
    assert.deepStrictEqual(actualDecoration.hoverMessage, { value: "hello2" });
    model.dispose();
  });
  test("model doesn't get confused with individual tracked ranges", () => {
    const model = createTextModel([
      "Hello world,",
      "How are you?"
    ].join("\n"));
    const trackedRangeId = model.changeDecorations((changeAcessor) => {
      return changeAcessor.addDecoration(
        {
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1
        },
        {
          description: "test",
          stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges
        }
      );
    });
    model.changeDecorations((changeAccessor) => {
      changeAccessor.removeDecoration(trackedRangeId);
    });
    let ids = model.deltaDecorations([], [
      toModelDeltaDecoration(decoration("a", 1, 1, 1, 12)),
      toModelDeltaDecoration(decoration("b", 2, 1, 2, 13))
    ]);
    assert.deepStrictEqual(model.getDecorationRange(ids[0]), range(1, 1, 1, 12));
    assert.deepStrictEqual(model.getDecorationRange(ids[1]), range(2, 1, 2, 13));
    ids = model.deltaDecorations(ids, [
      toModelDeltaDecoration(decoration("a", 1, 1, 1, 12)),
      toModelDeltaDecoration(decoration("b", 2, 1, 2, 13))
    ]);
    assert.deepStrictEqual(model.getDecorationRange(ids[0]), range(1, 1, 1, 12));
    assert.deepStrictEqual(model.getDecorationRange(ids[1]), range(2, 1, 2, 13));
    model.dispose();
  });
  test("issue #16922: Clicking on link doesn't seem to do anything", () => {
    const model = createTextModel([
      "Hello world,",
      "How are you?",
      "Fine.",
      "Good."
    ].join("\n"));
    model.deltaDecorations([], [
      { range: new Range(1, 1, 1, 1), options: { description: "test", className: "1" } },
      { range: new Range(1, 13, 1, 13), options: { description: "test", className: "2" } },
      { range: new Range(2, 1, 2, 1), options: { description: "test", className: "3" } },
      { range: new Range(2, 1, 2, 4), options: { description: "test", className: "4" } },
      { range: new Range(2, 8, 2, 13), options: { description: "test", className: "5" } },
      { range: new Range(3, 1, 4, 6), options: { description: "test", className: "6" } },
      { range: new Range(1, 1, 3, 6), options: { description: "test", className: "x1" } },
      { range: new Range(2, 5, 2, 8), options: { description: "test", className: "x2" } },
      { range: new Range(1, 1, 2, 8), options: { description: "test", className: "x3" } },
      { range: new Range(2, 5, 3, 1), options: { description: "test", className: "x4" } }
    ]);
    const inRange = model.getDecorationsInRange(new Range(2, 6, 2, 6));
    const inRangeClassNames = inRange.map((d) => d.options.className);
    inRangeClassNames.sort();
    assert.deepStrictEqual(inRangeClassNames, ["x1", "x2", "x3", "x4"]);
    model.dispose();
  });
  test("issue #41492: URL highlighting persists after pasting over url", () => {
    const model = createTextModel([
      "My First Line"
    ].join("\n"));
    const id = model.deltaDecorations([], [{ range: new Range(1, 2, 1, 14), options: { description: "test", stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges, collapseOnReplaceEdit: true } }])[0];
    model.applyEdits([{
      range: new Range(1, 1, 1, 14),
      text: "Some new text that is longer than the previous one",
      forceMoveMarkers: false
    }]);
    const actual = model.getDecorationRange(id);
    assert.deepStrictEqual(actual, new Range(1, 1, 1, 1));
    model.dispose();
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZWwvbW9kZWxEZWNvcmF0aW9ucy50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvZWRpdE9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgRW5kT2ZMaW5lU2VxdWVuY2UsIElNb2RlbERlbHRhRGVjb3JhdGlvbiwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRleHRNb2RlbCB9IGZyb20gJy4uL3Rlc3RUZXh0TW9kZWwuanMnO1xuXG4vLyAtLS0tLS0tLS0gdXRpbHNcblxuaW50ZXJmYWNlIElMaWdodFdlaWdodERlY29yYXRpb24yIHtcblx0cmFuZ2U6IFJhbmdlO1xuXHRjbGFzc05hbWU6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIG1vZGVsSGFzRGVjb3JhdGlvbnMobW9kZWw6IFRleHRNb2RlbCwgZGVjb3JhdGlvbnM6IElMaWdodFdlaWdodERlY29yYXRpb24yW10pIHtcblx0Y29uc3QgbW9kZWxEZWNvcmF0aW9uczogSUxpZ2h0V2VpZ2h0RGVjb3JhdGlvbjJbXSA9IFtdO1xuXHRjb25zdCBhY3R1YWxEZWNvcmF0aW9ucyA9IG1vZGVsLmdldEFsbERlY29yYXRpb25zKCk7XG5cdGZvciAobGV0IGkgPSAwLCBsZW4gPSBhY3R1YWxEZWNvcmF0aW9ucy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdG1vZGVsRGVjb3JhdGlvbnMucHVzaCh7XG5cdFx0XHRyYW5nZTogYWN0dWFsRGVjb3JhdGlvbnNbaV0ucmFuZ2UsXG5cdFx0XHRjbGFzc05hbWU6IGFjdHVhbERlY29yYXRpb25zW2ldLm9wdGlvbnMuY2xhc3NOYW1lXG5cdFx0fSk7XG5cdH1cblx0bW9kZWxEZWNvcmF0aW9ucy5zb3J0KChhLCBiKSA9PiBSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMoYS5yYW5nZSwgYi5yYW5nZSkpO1xuXHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsRGVjb3JhdGlvbnMsIGRlY29yYXRpb25zKTtcbn1cblxuZnVuY3Rpb24gbW9kZWxIYXNEZWNvcmF0aW9uKG1vZGVsOiBUZXh0TW9kZWwsIHN0YXJ0TGluZU51bWJlcjogbnVtYmVyLCBzdGFydENvbHVtbjogbnVtYmVyLCBlbmRMaW5lTnVtYmVyOiBudW1iZXIsIGVuZENvbHVtbjogbnVtYmVyLCBjbGFzc05hbWU6IHN0cmluZykge1xuXHRtb2RlbEhhc0RlY29yYXRpb25zKG1vZGVsLCBbe1xuXHRcdHJhbmdlOiBuZXcgUmFuZ2Uoc3RhcnRMaW5lTnVtYmVyLCBzdGFydENvbHVtbiwgZW5kTGluZU51bWJlciwgZW5kQ29sdW1uKSxcblx0XHRjbGFzc05hbWU6IGNsYXNzTmFtZVxuXHR9XSk7XG59XG5cbmZ1bmN0aW9uIG1vZGVsSGFzTm9EZWNvcmF0aW9ucyhtb2RlbDogVGV4dE1vZGVsKSB7XG5cdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRBbGxEZWNvcmF0aW9ucygpLmxlbmd0aCwgMCwgJ01vZGVsIGhhcyBubyBkZWNvcmF0aW9uJyk7XG59XG5cbmZ1bmN0aW9uIGFkZERlY29yYXRpb24obW9kZWw6IFRleHRNb2RlbCwgc3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIHN0YXJ0Q29sdW1uOiBudW1iZXIsIGVuZExpbmVOdW1iZXI6IG51bWJlciwgZW5kQ29sdW1uOiBudW1iZXIsIGNsYXNzTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcblx0cmV0dXJuIG1vZGVsLmNoYW5nZURlY29yYXRpb25zKChjaGFuZ2VBY2Nlc3NvcikgPT4ge1xuXHRcdHJldHVybiBjaGFuZ2VBY2Nlc3Nvci5hZGREZWNvcmF0aW9uKG5ldyBSYW5nZShzdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uLCBlbmRMaW5lTnVtYmVyLCBlbmRDb2x1bW4pLCB7XG5cdFx0XHRkZXNjcmlwdGlvbjogJ3Rlc3QnLFxuXHRcdFx0Y2xhc3NOYW1lOiBjbGFzc05hbWVcblx0XHR9KTtcblx0fSkhO1xufVxuXG5mdW5jdGlvbiBsaW5lSGFzRGVjb3JhdGlvbnMobW9kZWw6IFRleHRNb2RlbCwgbGluZU51bWJlcjogbnVtYmVyLCBkZWNvcmF0aW9uczogeyBzdGFydDogbnVtYmVyOyBlbmQ6IG51bWJlcjsgY2xhc3NOYW1lOiBzdHJpbmcgfVtdKSB7XG5cdGNvbnN0IGxpbmVEZWNvcmF0aW9uczogQXJyYXk8eyBzdGFydDogbnVtYmVyOyBlbmQ6IG51bWJlcjsgY2xhc3NOYW1lOiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkIH0+ID0gW107XG5cdGNvbnN0IGRlY3MgPSBtb2RlbC5nZXRMaW5lRGVjb3JhdGlvbnMobGluZU51bWJlcik7XG5cdGZvciAobGV0IGkgPSAwLCBsZW4gPSBkZWNzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0bGluZURlY29yYXRpb25zLnB1c2goe1xuXHRcdFx0c3RhcnQ6IGRlY3NbaV0ucmFuZ2Uuc3RhcnRDb2x1bW4sXG5cdFx0XHRlbmQ6IGRlY3NbaV0ucmFuZ2UuZW5kQ29sdW1uLFxuXHRcdFx0Y2xhc3NOYW1lOiBkZWNzW2ldLm9wdGlvbnMuY2xhc3NOYW1lXG5cdFx0fSk7XG5cdH1cblx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaW5lRGVjb3JhdGlvbnMsIGRlY29yYXRpb25zLCAnTGluZSBkZWNvcmF0aW9ucycpO1xufVxuXG5mdW5jdGlvbiBsaW5lSGFzTm9EZWNvcmF0aW9ucyhtb2RlbDogVGV4dE1vZGVsLCBsaW5lTnVtYmVyOiBudW1iZXIpIHtcblx0bGluZUhhc0RlY29yYXRpb25zKG1vZGVsLCBsaW5lTnVtYmVyLCBbXSk7XG59XG5cbmZ1bmN0aW9uIGxpbmVIYXNEZWNvcmF0aW9uKG1vZGVsOiBUZXh0TW9kZWwsIGxpbmVOdW1iZXI6IG51bWJlciwgc3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXIsIGNsYXNzTmFtZTogc3RyaW5nKSB7XG5cdGxpbmVIYXNEZWNvcmF0aW9ucyhtb2RlbCwgbGluZU51bWJlciwgW3tcblx0XHRzdGFydDogc3RhcnQsXG5cdFx0ZW5kOiBlbmQsXG5cdFx0Y2xhc3NOYW1lOiBjbGFzc05hbWVcblx0fV0pO1xufVxuXG5zdWl0ZSgnRWRpdG9yIE1vZGVsIC0gTW9kZWwgRGVjb3JhdGlvbnMnLCAoKSA9PiB7XG5cdGNvbnN0IExJTkUxID0gJ015IEZpcnN0IExpbmUnO1xuXHRjb25zdCBMSU5FMiA9ICdcXHRcXHRNeSBTZWNvbmQgTGluZSc7XG5cdGNvbnN0IExJTkUzID0gJyAgICBUaGlyZCBMaW5lJztcblx0Y29uc3QgTElORTQgPSAnJztcblx0Y29uc3QgTElORTUgPSAnMSc7XG5cblx0Ly8gLS0tLS0tLS0tIE1vZGVsIERlY29yYXRpb25zXG5cblx0bGV0IHRoaXNNb2RlbDogVGV4dE1vZGVsO1xuXG5cdHNldHVwKCgpID0+IHtcblx0XHRjb25zdCB0ZXh0ID1cblx0XHRcdExJTkUxICsgJ1xcclxcbicgK1xuXHRcdFx0TElORTIgKyAnXFxuJyArXG5cdFx0XHRMSU5FMyArICdcXG4nICtcblx0XHRcdExJTkU0ICsgJ1xcclxcbicgK1xuXHRcdFx0TElORTU7XG5cdFx0dGhpc01vZGVsID0gY3JlYXRlVGV4dE1vZGVsKHRleHQpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0dGhpc01vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnc2luZ2xlIGNoYXJhY3RlciBkZWNvcmF0aW9uJywgKCkgPT4ge1xuXHRcdGFkZERlY29yYXRpb24odGhpc01vZGVsLCAxLCAxLCAxLCAyLCAnbXlUeXBlJyk7XG5cdFx0bGluZUhhc0RlY29yYXRpb24odGhpc01vZGVsLCAxLCAxLCAyLCAnbXlUeXBlJyk7XG5cdFx0bGluZUhhc05vRGVjb3JhdGlvbnModGhpc01vZGVsLCAyKTtcblx0XHRsaW5lSGFzTm9EZWNvcmF0aW9ucyh0aGlzTW9kZWwsIDMpO1xuXHRcdGxpbmVIYXNOb0RlY29yYXRpb25zKHRoaXNNb2RlbCwgNCk7XG5cdFx0bGluZUhhc05vRGVjb3JhdGlvbnModGhpc01vZGVsLCA1KTtcblx0fSk7XG5cblx0dGVzdCgnbGluZSBkZWNvcmF0aW9uJywgKCkgPT4ge1xuXHRcdGFkZERlY29yYXRpb24odGhpc01vZGVsLCAxLCAxLCAxLCAxNCwgJ215VHlwZScpO1xuXHRcdGxpbmVIYXNEZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMSwgMTQsICdteVR5cGUnKTtcblx0XHRsaW5lSGFzTm9EZWNvcmF0aW9ucyh0aGlzTW9kZWwsIDIpO1xuXHRcdGxpbmVIYXNOb0RlY29yYXRpb25zKHRoaXNNb2RlbCwgMyk7XG5cdFx0bGluZUhhc05vRGVjb3JhdGlvbnModGhpc01vZGVsLCA0KTtcblx0XHRsaW5lSGFzTm9EZWNvcmF0aW9ucyh0aGlzTW9kZWwsIDUpO1xuXHR9KTtcblxuXHR0ZXN0KCdmdWxsIGxpbmUgZGVjb3JhdGlvbicsICgpID0+IHtcblx0XHRhZGREZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMSwgMiwgMSwgJ215VHlwZScpO1xuXG5cdFx0Y29uc3QgbGluZTFEZWNvcmF0aW9ucyA9IHRoaXNNb2RlbC5nZXRMaW5lRGVjb3JhdGlvbnMoMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmUxRGVjb3JhdGlvbnMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZTFEZWNvcmF0aW9uc1swXS5vcHRpb25zLmNsYXNzTmFtZSwgJ215VHlwZScpO1xuXG5cdFx0Y29uc3QgbGluZTJEZWNvcmF0aW9ucyA9IHRoaXNNb2RlbC5nZXRMaW5lRGVjb3JhdGlvbnMoMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmUyRGVjb3JhdGlvbnMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZTJEZWNvcmF0aW9uc1swXS5vcHRpb25zLmNsYXNzTmFtZSwgJ215VHlwZScpO1xuXG5cdFx0bGluZUhhc05vRGVjb3JhdGlvbnModGhpc01vZGVsLCAzKTtcblx0XHRsaW5lSGFzTm9EZWNvcmF0aW9ucyh0aGlzTW9kZWwsIDQpO1xuXHRcdGxpbmVIYXNOb0RlY29yYXRpb25zKHRoaXNNb2RlbCwgNSk7XG5cdH0pO1xuXG5cdHRlc3QoJ211bHRpcGxlIGxpbmUgZGVjb3JhdGlvbicsICgpID0+IHtcblx0XHRhZGREZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMiwgMywgMiwgJ215VHlwZScpO1xuXG5cdFx0Y29uc3QgbGluZTFEZWNvcmF0aW9ucyA9IHRoaXNNb2RlbC5nZXRMaW5lRGVjb3JhdGlvbnMoMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmUxRGVjb3JhdGlvbnMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZTFEZWNvcmF0aW9uc1swXS5vcHRpb25zLmNsYXNzTmFtZSwgJ215VHlwZScpO1xuXG5cdFx0Y29uc3QgbGluZTJEZWNvcmF0aW9ucyA9IHRoaXNNb2RlbC5nZXRMaW5lRGVjb3JhdGlvbnMoMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmUyRGVjb3JhdGlvbnMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZTJEZWNvcmF0aW9uc1swXS5vcHRpb25zLmNsYXNzTmFtZSwgJ215VHlwZScpO1xuXG5cdFx0Y29uc3QgbGluZTNEZWNvcmF0aW9ucyA9IHRoaXNNb2RlbC5nZXRMaW5lRGVjb3JhdGlvbnMoMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmUzRGVjb3JhdGlvbnMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZTNEZWNvcmF0aW9uc1swXS5vcHRpb25zLmNsYXNzTmFtZSwgJ215VHlwZScpO1xuXG5cdFx0bGluZUhhc05vRGVjb3JhdGlvbnModGhpc01vZGVsLCA0KTtcblx0XHRsaW5lSGFzTm9EZWNvcmF0aW9ucyh0aGlzTW9kZWwsIDUpO1xuXHR9KTtcblxuXHQvLyAtLS0tLS0tLS0gcmVtb3ZpbmcsIGNoYW5naW5nIGRlY29yYXRpb25zXG5cblx0dGVzdCgnZGVjb3JhdGlvbiBnZXRzIHJlbW92ZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZGVjSWQgPSBhZGREZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMiwgMywgMiwgJ215VHlwZScpO1xuXHRcdG1vZGVsSGFzRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDIsIDMsIDIsICdteVR5cGUnKTtcblx0XHR0aGlzTW9kZWwuY2hhbmdlRGVjb3JhdGlvbnMoKGNoYW5nZUFjY2Vzc29yKSA9PiB7XG5cdFx0XHRjaGFuZ2VBY2Nlc3Nvci5yZW1vdmVEZWNvcmF0aW9uKGRlY0lkKTtcblx0XHR9KTtcblx0XHRtb2RlbEhhc05vRGVjb3JhdGlvbnModGhpc01vZGVsKTtcblx0fSk7XG5cblx0dGVzdCgnZGVjb3JhdGlvbnMgZ2V0IHJlbW92ZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZGVjSWQxID0gYWRkRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDIsIDMsIDIsICdteVR5cGUxJyk7XG5cdFx0Y29uc3QgZGVjSWQyID0gYWRkRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDIsIDMsIDEsICdteVR5cGUyJyk7XG5cdFx0bW9kZWxIYXNEZWNvcmF0aW9ucyh0aGlzTW9kZWwsIFtcblx0XHRcdHtcblx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgxLCAyLCAzLCAxKSxcblx0XHRcdFx0Y2xhc3NOYW1lOiAnbXlUeXBlMidcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgMiwgMywgMiksXG5cdFx0XHRcdGNsYXNzTmFtZTogJ215VHlwZTEnXG5cdFx0XHR9XG5cdFx0XSk7XG5cdFx0dGhpc01vZGVsLmNoYW5nZURlY29yYXRpb25zKChjaGFuZ2VBY2Nlc3NvcikgPT4ge1xuXHRcdFx0Y2hhbmdlQWNjZXNzb3IucmVtb3ZlRGVjb3JhdGlvbihkZWNJZDEpO1xuXHRcdH0pO1xuXHRcdG1vZGVsSGFzRGVjb3JhdGlvbnModGhpc01vZGVsLCBbXG5cdFx0XHR7XG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgMiwgMywgMSksXG5cdFx0XHRcdGNsYXNzTmFtZTogJ215VHlwZTInXG5cdFx0XHR9XG5cdFx0XSk7XG5cdFx0dGhpc01vZGVsLmNoYW5nZURlY29yYXRpb25zKChjaGFuZ2VBY2Nlc3NvcikgPT4ge1xuXHRcdFx0Y2hhbmdlQWNjZXNzb3IucmVtb3ZlRGVjb3JhdGlvbihkZWNJZDIpO1xuXHRcdH0pO1xuXHRcdG1vZGVsSGFzTm9EZWNvcmF0aW9ucyh0aGlzTW9kZWwpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWNvcmF0aW9uIHJhbmdlIGNhbiBiZSBjaGFuZ2VkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGRlY0lkID0gYWRkRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDIsIDMsIDIsICdteVR5cGUnKTtcblx0XHRtb2RlbEhhc0RlY29yYXRpb24odGhpc01vZGVsLCAxLCAyLCAzLCAyLCAnbXlUeXBlJyk7XG5cdFx0dGhpc01vZGVsLmNoYW5nZURlY29yYXRpb25zKChjaGFuZ2VBY2Nlc3NvcikgPT4ge1xuXHRcdFx0Y2hhbmdlQWNjZXNzb3IuY2hhbmdlRGVjb3JhdGlvbihkZWNJZCwgbmV3IFJhbmdlKDEsIDEsIDEsIDIpKTtcblx0XHR9KTtcblx0XHRtb2RlbEhhc0RlY29yYXRpb24odGhpc01vZGVsLCAxLCAxLCAxLCAyLCAnbXlUeXBlJyk7XG5cdH0pO1xuXG5cdC8vIC0tLS0tLS0tLSBldmVudGluZ1xuXG5cdHRlc3QoJ2RlY29yYXRpb25zIGVtaXQgZXZlbnQgb24gYWRkJywgKCkgPT4ge1xuXHRcdGxldCBsaXN0ZW5lckNhbGxlZCA9IDA7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHRoaXNNb2RlbC5vbkRpZENoYW5nZURlY29yYXRpb25zKChlKSA9PiB7XG5cdFx0XHRsaXN0ZW5lckNhbGxlZCsrO1xuXHRcdH0pO1xuXHRcdGFkZERlY29yYXRpb24odGhpc01vZGVsLCAxLCAyLCAzLCAyLCAnbXlUeXBlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpc3RlbmVyQ2FsbGVkLCAxLCAnbGlzdGVuZXIgY2FsbGVkJyk7XG5cdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlY29yYXRpb25zIGVtaXQgZXZlbnQgb24gY2hhbmdlJywgKCkgPT4ge1xuXHRcdGxldCBsaXN0ZW5lckNhbGxlZCA9IDA7XG5cdFx0Y29uc3QgZGVjSWQgPSBhZGREZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMiwgMywgMiwgJ215VHlwZScpO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSB0aGlzTW9kZWwub25EaWRDaGFuZ2VEZWNvcmF0aW9ucygoZSkgPT4ge1xuXHRcdFx0bGlzdGVuZXJDYWxsZWQrKztcblx0XHR9KTtcblx0XHR0aGlzTW9kZWwuY2hhbmdlRGVjb3JhdGlvbnMoKGNoYW5nZUFjY2Vzc29yKSA9PiB7XG5cdFx0XHRjaGFuZ2VBY2Nlc3Nvci5jaGFuZ2VEZWNvcmF0aW9uKGRlY0lkLCBuZXcgUmFuZ2UoMSwgMSwgMSwgMikpO1xuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaXN0ZW5lckNhbGxlZCwgMSwgJ2xpc3RlbmVyIGNhbGxlZCcpO1xuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWNvcmF0aW9ucyBlbWl0IGV2ZW50IG9uIHJlbW92ZScsICgpID0+IHtcblx0XHRsZXQgbGlzdGVuZXJDYWxsZWQgPSAwO1xuXHRcdGNvbnN0IGRlY0lkID0gYWRkRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDIsIDMsIDIsICdteVR5cGUnKTtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gdGhpc01vZGVsLm9uRGlkQ2hhbmdlRGVjb3JhdGlvbnMoKGUpID0+IHtcblx0XHRcdGxpc3RlbmVyQ2FsbGVkKys7XG5cdFx0fSk7XG5cdFx0dGhpc01vZGVsLmNoYW5nZURlY29yYXRpb25zKChjaGFuZ2VBY2Nlc3NvcikgPT4ge1xuXHRcdFx0Y2hhbmdlQWNjZXNzb3IucmVtb3ZlRGVjb3JhdGlvbihkZWNJZCk7XG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpc3RlbmVyQ2FsbGVkLCAxLCAnbGlzdGVuZXIgY2FsbGVkJyk7XG5cdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlY29yYXRpb25zIGVtaXQgZXZlbnQgd2hlbiBpbnNlcnRpbmcgb25lIGxpbmUgdGV4dCBiZWZvcmUgaXQnLCAoKSA9PiB7XG5cdFx0bGV0IGxpc3RlbmVyQ2FsbGVkID0gMDtcblx0XHRhZGREZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMiwgMywgMiwgJ215VHlwZScpO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHRoaXNNb2RlbC5vbkRpZENoYW5nZURlY29yYXRpb25zKChlKSA9PiB7XG5cdFx0XHRsaXN0ZW5lckNhbGxlZCsrO1xuXHRcdH0pO1xuXG5cdFx0dGhpc01vZGVsLmFwcGx5RWRpdHMoW0VkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbigxLCAxKSwgJ0hhbGxvICcpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpc3RlbmVyQ2FsbGVkLCAxLCAnbGlzdGVuZXIgY2FsbGVkJyk7XG5cdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlY29yYXRpb25zIGRvIG5vdCBlbWl0IGV2ZW50IG9uIG5vLW9wIGRlbHRhRGVjb3JhdGlvbnMnLCAoKSA9PiB7XG5cdFx0bGV0IGxpc3RlbmVyQ2FsbGVkID0gMDtcblxuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSB0aGlzTW9kZWwub25EaWRDaGFuZ2VEZWNvcmF0aW9ucygoZSkgPT4ge1xuXHRcdFx0bGlzdGVuZXJDYWxsZWQrKztcblx0XHR9KTtcblxuXHRcdHRoaXNNb2RlbC5kZWx0YURlY29yYXRpb25zKFtdLCBbXSk7XG5cdFx0dGhpc01vZGVsLmNoYW5nZURlY29yYXRpb25zKChhY2Nlc3NvcikgPT4ge1xuXHRcdFx0YWNjZXNzb3IuZGVsdGFEZWNvcmF0aW9ucyhbXSwgW10pO1xuXHRcdH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpc3RlbmVyQ2FsbGVkLCAwLCAnbGlzdGVuZXIgbm90IGNhbGxlZCcpO1xuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHQvLyAtLS0tLS0tLS0gZWRpdGluZyB0ZXh0ICYgZWZmZWN0cyBvbiBkZWNvcmF0aW9uc1xuXG5cdHRlc3QoJ2RlY29yYXRpb25zIGFyZSB1cGRhdGVkIHdoZW4gaW5zZXJ0aW5nIG9uZSBsaW5lIHRleHQgYmVmb3JlIGl0JywgKCkgPT4ge1xuXHRcdGFkZERlY29yYXRpb24odGhpc01vZGVsLCAxLCAyLCAzLCAyLCAnbXlUeXBlJyk7XG5cdFx0bW9kZWxIYXNEZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMiwgMywgMiwgJ215VHlwZScpO1xuXHRcdHRoaXNNb2RlbC5hcHBseUVkaXRzKFtFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oMSwgMSksICdIYWxsbyAnKV0pO1xuXHRcdG1vZGVsSGFzRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDgsIDMsIDIsICdteVR5cGUnKTtcblx0fSk7XG5cblx0dGVzdCgnZGVjb3JhdGlvbnMgYXJlIHVwZGF0ZWQgd2hlbiBpbnNlcnRpbmcgb25lIGxpbmUgdGV4dCBiZWZvcmUgaXQgMicsICgpID0+IHtcblx0XHRhZGREZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMSwgMywgMiwgJ215VHlwZScpO1xuXHRcdG1vZGVsSGFzRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDEsIDMsIDIsICdteVR5cGUnKTtcblx0XHR0aGlzTW9kZWwuYXBwbHlFZGl0cyhbRWRpdE9wZXJhdGlvbi5yZXBsYWNlKG5ldyBSYW5nZSgxLCAxLCAxLCAxKSwgJ0hhbGxvICcpXSk7XG5cdFx0bW9kZWxIYXNEZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMSwgMywgMiwgJ215VHlwZScpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWNvcmF0aW9ucyBhcmUgdXBkYXRlZCB3aGVuIGluc2VydGluZyBtdWx0aXBsZSBsaW5lcyB0ZXh0IGJlZm9yZSBpdCcsICgpID0+IHtcblx0XHRhZGREZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMiwgMywgMiwgJ215VHlwZScpO1xuXHRcdG1vZGVsSGFzRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDIsIDMsIDIsICdteVR5cGUnKTtcblx0XHR0aGlzTW9kZWwuYXBwbHlFZGl0cyhbRWRpdE9wZXJhdGlvbi5pbnNlcnQobmV3IFBvc2l0aW9uKDEsIDEpLCAnSGFsbG9cXG5JXFwnbSBpbnNlcnRpbmcgbXVsdGlwbGVcXG5saW5lcycpXSk7XG5cdFx0bW9kZWxIYXNEZWNvcmF0aW9uKHRoaXNNb2RlbCwgMywgNywgNSwgMiwgJ215VHlwZScpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWNvcmF0aW9ucyBjaGFuZ2Ugd2hlbiBpbnNlcnRpbmcgdGV4dCBhZnRlciB0aGVtJywgKCkgPT4ge1xuXHRcdGFkZERlY29yYXRpb24odGhpc01vZGVsLCAxLCAyLCAzLCAyLCAnbXlUeXBlJyk7XG5cdFx0bW9kZWxIYXNEZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMiwgMywgMiwgJ215VHlwZScpO1xuXHRcdHRoaXNNb2RlbC5hcHBseUVkaXRzKFtFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oMywgMiksICdIYWxsbycpXSk7XG5cdFx0bW9kZWxIYXNEZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMiwgMywgNywgJ215VHlwZScpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWNvcmF0aW9ucyBhcmUgdXBkYXRlZCB3aGVuIGluc2VydGluZyB0ZXh0IGluc2lkZScsICgpID0+IHtcblx0XHRhZGREZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMiwgMywgMiwgJ215VHlwZScpO1xuXHRcdG1vZGVsSGFzRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDIsIDMsIDIsICdteVR5cGUnKTtcblx0XHR0aGlzTW9kZWwuYXBwbHlFZGl0cyhbRWRpdE9wZXJhdGlvbi5pbnNlcnQobmV3IFBvc2l0aW9uKDEsIDMpLCAnSGFsbG8gJyldKTtcblx0XHRtb2RlbEhhc0RlY29yYXRpb24odGhpc01vZGVsLCAxLCAyLCAzLCAyLCAnbXlUeXBlJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlY29yYXRpb25zIGFyZSB1cGRhdGVkIHdoZW4gaW5zZXJ0aW5nIHRleHQgaW5zaWRlIDInLCAoKSA9PiB7XG5cdFx0YWRkRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDIsIDMsIDIsICdteVR5cGUnKTtcblx0XHRtb2RlbEhhc0RlY29yYXRpb24odGhpc01vZGVsLCAxLCAyLCAzLCAyLCAnbXlUeXBlJyk7XG5cdFx0dGhpc01vZGVsLmFwcGx5RWRpdHMoW0VkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbigzLCAxKSwgJ0hhbGxvICcpXSk7XG5cdFx0bW9kZWxIYXNEZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMiwgMywgOCwgJ215VHlwZScpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWNvcmF0aW9ucyBhcmUgdXBkYXRlZCB3aGVuIGluc2VydGluZyB0ZXh0IGluc2lkZSAzJywgKCkgPT4ge1xuXHRcdGFkZERlY29yYXRpb24odGhpc01vZGVsLCAxLCAxLCAyLCAxNiwgJ215VHlwZScpO1xuXHRcdG1vZGVsSGFzRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDEsIDIsIDE2LCAnbXlUeXBlJyk7XG5cdFx0dGhpc01vZGVsLmFwcGx5RWRpdHMoW0VkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbigyLCAyKSwgJ1xcbicpXSk7XG5cdFx0bW9kZWxIYXNEZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMSwgMywgMTUsICdteVR5cGUnKTtcblx0fSk7XG5cblx0dGVzdCgnZGVjb3JhdGlvbnMgYXJlIHVwZGF0ZWQgd2hlbiBpbnNlcnRpbmcgbXVsdGlwbGUgbGluZXMgdGV4dCBpbnNpZGUnLCAoKSA9PiB7XG5cdFx0YWRkRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDIsIDMsIDIsICdteVR5cGUnKTtcblx0XHRtb2RlbEhhc0RlY29yYXRpb24odGhpc01vZGVsLCAxLCAyLCAzLCAyLCAnbXlUeXBlJyk7XG5cdFx0dGhpc01vZGVsLmFwcGx5RWRpdHMoW0VkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbigxLCAzKSwgJ0hhbGxvXFxuSVxcJ20gaW5zZXJ0aW5nIG11bHRpcGxlXFxubGluZXMnKV0pO1xuXHRcdG1vZGVsSGFzRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDIsIDUsIDIsICdteVR5cGUnKTtcblx0fSk7XG5cblx0dGVzdCgnZGVjb3JhdGlvbnMgYXJlIHVwZGF0ZWQgd2hlbiBkZWxldGluZyBvbmUgbGluZSB0ZXh0IGJlZm9yZSBpdCcsICgpID0+IHtcblx0XHRhZGREZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMiwgMywgMiwgJ215VHlwZScpO1xuXHRcdG1vZGVsSGFzRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDIsIDMsIDIsICdteVR5cGUnKTtcblx0XHR0aGlzTW9kZWwuYXBwbHlFZGl0cyhbRWRpdE9wZXJhdGlvbi5kZWxldGUobmV3IFJhbmdlKDEsIDEsIDEsIDIpKV0pO1xuXHRcdG1vZGVsSGFzRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDEsIDMsIDIsICdteVR5cGUnKTtcblx0fSk7XG5cblx0dGVzdCgnZGVjb3JhdGlvbnMgYXJlIHVwZGF0ZWQgd2hlbiBkZWxldGluZyBtdWx0aXBsZSBsaW5lcyB0ZXh0IGJlZm9yZSBpdCcsICgpID0+IHtcblx0XHRhZGREZWNvcmF0aW9uKHRoaXNNb2RlbCwgMiwgMiwgMywgMiwgJ215VHlwZScpO1xuXHRcdG1vZGVsSGFzRGVjb3JhdGlvbih0aGlzTW9kZWwsIDIsIDIsIDMsIDIsICdteVR5cGUnKTtcblx0XHR0aGlzTW9kZWwuYXBwbHlFZGl0cyhbRWRpdE9wZXJhdGlvbi5kZWxldGUobmV3IFJhbmdlKDEsIDEsIDIsIDEpKV0pO1xuXHRcdG1vZGVsSGFzRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDIsIDIsIDIsICdteVR5cGUnKTtcblx0fSk7XG5cblx0dGVzdCgnZGVjb3JhdGlvbnMgYXJlIHVwZGF0ZWQgd2hlbiBkZWxldGluZyBtdWx0aXBsZSBsaW5lcyB0ZXh0IGJlZm9yZSBpdCAyJywgKCkgPT4ge1xuXHRcdGFkZERlY29yYXRpb24odGhpc01vZGVsLCAyLCAzLCAzLCAyLCAnbXlUeXBlJyk7XG5cdFx0bW9kZWxIYXNEZWNvcmF0aW9uKHRoaXNNb2RlbCwgMiwgMywgMywgMiwgJ215VHlwZScpO1xuXHRcdHRoaXNNb2RlbC5hcHBseUVkaXRzKFtFZGl0T3BlcmF0aW9uLmRlbGV0ZShuZXcgUmFuZ2UoMSwgMSwgMiwgMikpXSk7XG5cdFx0bW9kZWxIYXNEZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMiwgMiwgMiwgJ215VHlwZScpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWNvcmF0aW9ucyBhcmUgdXBkYXRlZCB3aGVuIGRlbGV0aW5nIHRleHQgaW5zaWRlJywgKCkgPT4ge1xuXHRcdGFkZERlY29yYXRpb24odGhpc01vZGVsLCAxLCAyLCA0LCAxLCAnbXlUeXBlJyk7XG5cdFx0bW9kZWxIYXNEZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMiwgNCwgMSwgJ215VHlwZScpO1xuXHRcdHRoaXNNb2RlbC5hcHBseUVkaXRzKFtFZGl0T3BlcmF0aW9uLmRlbGV0ZShuZXcgUmFuZ2UoMSwgMywgMiwgMSkpXSk7XG5cdFx0bW9kZWxIYXNEZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMiwgMywgMSwgJ215VHlwZScpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWNvcmF0aW9ucyBhcmUgdXBkYXRlZCB3aGVuIGRlbGV0aW5nIHRleHQgaW5zaWRlIDInLCAoKSA9PiB7XG5cdFx0YWRkRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDIsIDQsIDEsICdteVR5cGUnKTtcblx0XHRtb2RlbEhhc0RlY29yYXRpb24odGhpc01vZGVsLCAxLCAyLCA0LCAxLCAnbXlUeXBlJyk7XG5cdFx0dGhpc01vZGVsLmFwcGx5RWRpdHMoW1xuXHRcdFx0RWRpdE9wZXJhdGlvbi5kZWxldGUobmV3IFJhbmdlKDEsIDEsIDEsIDIpKSxcblx0XHRcdEVkaXRPcGVyYXRpb24uZGVsZXRlKG5ldyBSYW5nZSg0LCAxLCA0LCAxKSlcblx0XHRdKTtcblx0XHRtb2RlbEhhc0RlY29yYXRpb24odGhpc01vZGVsLCAxLCAxLCA0LCAxLCAnbXlUeXBlJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlY29yYXRpb25zIGFyZSB1cGRhdGVkIHdoZW4gZGVsZXRpbmcgbXVsdGlwbGUgbGluZXMgdGV4dCcsICgpID0+IHtcblx0XHRhZGREZWNvcmF0aW9uKHRoaXNNb2RlbCwgMSwgMiwgNCwgMSwgJ215VHlwZScpO1xuXHRcdG1vZGVsSGFzRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDIsIDQsIDEsICdteVR5cGUnKTtcblx0XHR0aGlzTW9kZWwuYXBwbHlFZGl0cyhbRWRpdE9wZXJhdGlvbi5kZWxldGUobmV3IFJhbmdlKDEsIDEsIDMsIDEpKV0pO1xuXHRcdG1vZGVsSGFzRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDEsIDIsIDEsICdteVR5cGUnKTtcblx0fSk7XG5cblx0dGVzdCgnZGVjb3JhdGlvbnMgYXJlIHVwZGF0ZWQgd2hlbiBjaGFuZ2luZyBFT0wnLCAoKSA9PiB7XG5cdFx0YWRkRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDIsIDQsIDEsICdteVR5cGUxJyk7XG5cdFx0YWRkRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDMsIDQsIDEsICdteVR5cGUyJyk7XG5cdFx0YWRkRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDQsIDQsIDEsICdteVR5cGUzJyk7XG5cdFx0YWRkRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDUsIDQsIDEsICdteVR5cGU0Jyk7XG5cdFx0YWRkRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDYsIDQsIDEsICdteVR5cGU1Jyk7XG5cdFx0YWRkRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDcsIDQsIDEsICdteVR5cGU2Jyk7XG5cdFx0YWRkRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDgsIDQsIDEsICdteVR5cGU3Jyk7XG5cdFx0YWRkRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDksIDQsIDEsICdteVR5cGU4Jyk7XG5cdFx0YWRkRGVjb3JhdGlvbih0aGlzTW9kZWwsIDEsIDEwLCA0LCAxLCAnbXlUeXBlOScpO1xuXHRcdHRoaXNNb2RlbC5hcHBseUVkaXRzKFtFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oMSwgMSksICd4JyldKTtcblx0XHR0aGlzTW9kZWwuc2V0RU9MKEVuZE9mTGluZVNlcXVlbmNlLkNSTEYpO1xuXHRcdHRoaXNNb2RlbC5hcHBseUVkaXRzKFtFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oMSwgMSksICd4JyldKTtcblx0XHRtb2RlbEhhc0RlY29yYXRpb25zKHRoaXNNb2RlbCwgW1xuXHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDEsIDQsIDQsIDEpLCBjbGFzc05hbWU6ICdteVR5cGUxJyB9LFxuXHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDEsIDUsIDQsIDEpLCBjbGFzc05hbWU6ICdteVR5cGUyJyB9LFxuXHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDEsIDYsIDQsIDEpLCBjbGFzc05hbWU6ICdteVR5cGUzJyB9LFxuXHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDEsIDcsIDQsIDEpLCBjbGFzc05hbWU6ICdteVR5cGU0JyB9LFxuXHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDEsIDgsIDQsIDEpLCBjbGFzc05hbWU6ICdteVR5cGU1JyB9LFxuXHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDEsIDksIDQsIDEpLCBjbGFzc05hbWU6ICdteVR5cGU2JyB9LFxuXHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDEsIDEwLCA0LCAxKSwgY2xhc3NOYW1lOiAnbXlUeXBlNycgfSxcblx0XHRcdHsgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxMSwgNCwgMSksIGNsYXNzTmFtZTogJ215VHlwZTgnIH0sXG5cdFx0XHR7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMTIsIDQsIDEpLCBjbGFzc05hbWU6ICdteVR5cGU5JyB9LFxuXHRcdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdhbiBhcHBhcmVudGx5IHNpbXBsZSBlZGl0JywgKCkgPT4ge1xuXHRcdGFkZERlY29yYXRpb24odGhpc01vZGVsLCAxLCAyLCA0LCAxLCAnbXlUeXBlMScpO1xuXHRcdHRoaXNNb2RlbC5hcHBseUVkaXRzKFtFZGl0T3BlcmF0aW9uLnJlcGxhY2UobmV3IFJhbmdlKDEsIDE0LCAyLCAxKSwgJ3gnKV0pO1xuXHRcdG1vZGVsSGFzRGVjb3JhdGlvbnModGhpc01vZGVsLCBbXG5cdFx0XHR7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMiwgMywgMSksIGNsYXNzTmFtZTogJ215VHlwZTEnIH0sXG5cdFx0XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlbW92ZUFsbERlY29yYXRpb25zV2l0aE93bmVySWQgY2FuIGJlIGNhbGxlZCBhZnRlciBtb2RlbCBkaXNwb3NlJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKCdhc2QnKTtcblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0bW9kZWwucmVtb3ZlQWxsRGVjb3JhdGlvbnNXaXRoT3duZXJJZCgxKTtcblx0fSk7XG5cblx0dGVzdCgncmVtb3ZlQWxsRGVjb3JhdGlvbnNXaXRoT3duZXJJZCB3b3JrcycsICgpID0+IHtcblx0XHR0aGlzTW9kZWwuZGVsdGFEZWNvcmF0aW9ucyhbXSwgW3sgcmFuZ2U6IG5ldyBSYW5nZSgxLCAyLCA0LCAxKSwgb3B0aW9uczogeyBkZXNjcmlwdGlvbjogJ3Rlc3QnLCBjbGFzc05hbWU6ICdteVR5cGUxJyB9IH1dLCAxKTtcblx0XHR0aGlzTW9kZWwucmVtb3ZlQWxsRGVjb3JhdGlvbnNXaXRoT3duZXJJZCgxKTtcblx0XHRtb2RlbEhhc05vRGVjb3JhdGlvbnModGhpc01vZGVsKTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ0RlY29yYXRpb25zIGFuZCBlZGl0aW5nJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGZ1bmN0aW9uIF9ydW5UZXN0KGRlY1JhbmdlOiBSYW5nZSwgc3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcywgZWRpdFJhbmdlOiBSYW5nZSwgZWRpdFRleHQ6IHN0cmluZywgZWRpdEZvcmNlTW92ZU1hcmtlcnM6IGJvb2xlYW4sIGV4cGVjdGVkRGVjUmFuZ2U6IFJhbmdlLCBtc2c6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFtcblx0XHRcdCdNeSBGaXJzdCBMaW5lJyxcblx0XHRcdCdNeSBTZWNvbmQgTGluZScsXG5cdFx0XHQnVGhpcmQgTGluZSdcblx0XHRdLmpvaW4oJ1xcbicpKTtcblxuXHRcdGNvbnN0IGlkID0gbW9kZWwuZGVsdGFEZWNvcmF0aW9ucyhbXSwgW3sgcmFuZ2U6IGRlY1JhbmdlLCBvcHRpb25zOiB7IGRlc2NyaXB0aW9uOiAndGVzdCcsIHN0aWNraW5lc3M6IHN0aWNraW5lc3MgfSB9XSlbMF07XG5cdFx0bW9kZWwuYXBwbHlFZGl0cyhbe1xuXHRcdFx0cmFuZ2U6IGVkaXRSYW5nZSxcblx0XHRcdHRleHQ6IGVkaXRUZXh0LFxuXHRcdFx0Zm9yY2VNb3ZlTWFya2VyczogZWRpdEZvcmNlTW92ZU1hcmtlcnNcblx0XHR9XSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gbW9kZWwuZ2V0RGVjb3JhdGlvblJhbmdlKGlkKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWREZWNSYW5nZSwgbXNnKTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHJ1blRlc3QoZGVjUmFuZ2U6IFJhbmdlLCBlZGl0UmFuZ2U6IFJhbmdlLCBlZGl0VGV4dDogc3RyaW5nLCBleHBlY3RlZERlY1JhbmdlOiBSYW5nZVtdW10pOiB2b2lkIHtcblx0XHRfcnVuVGVzdChkZWNSYW5nZSwgMCwgZWRpdFJhbmdlLCBlZGl0VGV4dCwgZmFsc2UsIGV4cGVjdGVkRGVjUmFuZ2VbMF1bMF0sICduby0wLUFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXMnKTtcblx0XHRfcnVuVGVzdChkZWNSYW5nZSwgMSwgZWRpdFJhbmdlLCBlZGl0VGV4dCwgZmFsc2UsIGV4cGVjdGVkRGVjUmFuZ2VbMF1bMV0sICduby0xLU5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcycpO1xuXHRcdF9ydW5UZXN0KGRlY1JhbmdlLCAyLCBlZGl0UmFuZ2UsIGVkaXRUZXh0LCBmYWxzZSwgZXhwZWN0ZWREZWNSYW5nZVswXVsyXSwgJ25vLTItR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZScpO1xuXHRcdF9ydW5UZXN0KGRlY1JhbmdlLCAzLCBlZGl0UmFuZ2UsIGVkaXRUZXh0LCBmYWxzZSwgZXhwZWN0ZWREZWNSYW5nZVswXVszXSwgJ25vLTMtR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyJyk7XG5cblx0XHRfcnVuVGVzdChkZWNSYW5nZSwgMCwgZWRpdFJhbmdlLCBlZGl0VGV4dCwgdHJ1ZSwgZXhwZWN0ZWREZWNSYW5nZVsxXVswXSwgJ2ZvcmNlLTAtQWx3YXlzR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcycpO1xuXHRcdF9ydW5UZXN0KGRlY1JhbmdlLCAxLCBlZGl0UmFuZ2UsIGVkaXRUZXh0LCB0cnVlLCBleHBlY3RlZERlY1JhbmdlWzFdWzFdLCAnZm9yY2UtMS1OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMnKTtcblx0XHRfcnVuVGVzdChkZWNSYW5nZSwgMiwgZWRpdFJhbmdlLCBlZGl0VGV4dCwgdHJ1ZSwgZXhwZWN0ZWREZWNSYW5nZVsxXVsyXSwgJ2ZvcmNlLTItR3Jvd3NPbmx5V2hlblR5cGluZ0JlZm9yZScpO1xuXHRcdF9ydW5UZXN0KGRlY1JhbmdlLCAzLCBlZGl0UmFuZ2UsIGVkaXRUZXh0LCB0cnVlLCBleHBlY3RlZERlY1JhbmdlWzFdWzNdLCAnZm9yY2UtMy1Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXInKTtcblx0fVxuXG5cdHN1aXRlKCdpbnNlcnQnLCAoKSA9PiB7XG5cdFx0c3VpdGUoJ2NvbGxhcHNlZCBkZWMnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdiZWZvcmUnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDQpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAzLCAxLCAzKSwgJ3h4Jyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDYsIDEsIDYpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgNiksIG5ldyBSYW5nZSgxLCA2LCAxLCA2KSwgbmV3IFJhbmdlKDEsIDYsIDEsIDYpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNiwgMSwgNiksIG5ldyBSYW5nZSgxLCA2LCAxLCA2KSwgbmV3IFJhbmdlKDEsIDYsIDEsIDYpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgNildLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZXF1YWwnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDQpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA0KSwgJ3h4Jyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDYpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgNiksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDYsIDEsIDYpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNiwgMSwgNiksIG5ldyBSYW5nZSgxLCA2LCAxLCA2KSwgbmV3IFJhbmdlKDEsIDYsIDEsIDYpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgNildLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnYWZ0ZXInLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDQpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA1LCAxLCA1KSwgJ3h4Jyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdHN1aXRlKCdub24tY29sbGFwc2VkIGRlYycsICgpID0+IHtcblx0XHRcdHRlc3QoJ2JlZm9yZScsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDMsIDEsIDMpLCAneHgnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNiwgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgMTEpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNiwgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgMTEpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3N0YXJ0JywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgNCksICd4eCcsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCAxMSksIG5ldyBSYW5nZSgxLCA2LCAxLCAxMSksIG5ldyBSYW5nZSgxLCA0LCAxLCAxMSksIG5ldyBSYW5nZSgxLCA2LCAxLCAxMSldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA2LCAxLCAxMSksIG5ldyBSYW5nZSgxLCA2LCAxLCAxMSksIG5ldyBSYW5nZSgxLCA2LCAxLCAxMSksIG5ldyBSYW5nZSgxLCA2LCAxLCAxMSldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnaW5zaWRlJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNSwgMSwgNSksICd4eCcsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCAxMSksIG5ldyBSYW5nZSgxLCA0LCAxLCAxMSksIG5ldyBSYW5nZSgxLCA0LCAxLCAxMSksIG5ldyBSYW5nZSgxLCA0LCAxLCAxMSldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCAxMSksIG5ldyBSYW5nZSgxLCA0LCAxLCAxMSksIG5ldyBSYW5nZSgxLCA0LCAxLCAxMSksIG5ldyBSYW5nZSgxLCA0LCAxLCAxMSldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgOSwgMSwgOSksICd4eCcsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCAxMSksIG5ldyBSYW5nZSgxLCA0LCAxLCA5KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDkpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgMTEpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgMTEpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2FmdGVyJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMTAsIDEsIDEwKSwgJ3h4Jyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDkpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOSksIG5ldyBSYW5nZSgxLCA0LCAxLCA5KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDkpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgOSksIG5ldyBSYW5nZSgxLCA0LCAxLCA5KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDkpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOSldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnZGVsZXRlJywgKCkgPT4ge1xuXHRcdHN1aXRlKCdjb2xsYXBzZWQgZGVjJywgKCkgPT4ge1xuXHRcdFx0dGVzdCgnZWRpdC5lbmQgPCByYW5nZS5zdGFydCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgNCksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDEsIDEsIDMpLCAnJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDIsIDEsIDIpLCBuZXcgUmFuZ2UoMSwgMiwgMSwgMiksIG5ldyBSYW5nZSgxLCAyLCAxLCAyKSwgbmV3IFJhbmdlKDEsIDIsIDEsIDIpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgMiwgMSwgMiksIG5ldyBSYW5nZSgxLCAyLCAxLCAyKSwgbmV3IFJhbmdlKDEsIDIsIDEsIDIpLCBuZXcgUmFuZ2UoMSwgMiwgMSwgMildLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5lbmQgPD0gcmFuZ2Uuc3RhcnQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDQpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAyLCAxLCA0KSwgJycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCAyLCAxLCAyKSwgbmV3IFJhbmdlKDEsIDIsIDEsIDIpLCBuZXcgUmFuZ2UoMSwgMiwgMSwgMiksIG5ldyBSYW5nZSgxLCAyLCAxLCAyKV0sXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDIsIDEsIDIpLCBuZXcgUmFuZ2UoMSwgMiwgMSwgMiksIG5ldyBSYW5nZSgxLCAyLCAxLCAyKSwgbmV3IFJhbmdlKDEsIDIsIDEsIDIpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPCByYW5nZS5zdGFydCAmJiBlZGl0LmVuZCA+IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgNCksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDMsIDEsIDUpLCAnJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDMsIDEsIDMpLCBuZXcgUmFuZ2UoMSwgMywgMSwgMyksIG5ldyBSYW5nZSgxLCAzLCAxLCAzKSwgbmV3IFJhbmdlKDEsIDMsIDEsIDMpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgMywgMSwgMyksIG5ldyBSYW5nZSgxLCAzLCAxLCAzKSwgbmV3IFJhbmdlKDEsIDMsIDEsIDMpLCBuZXcgUmFuZ2UoMSwgMywgMSwgMyldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA+PSByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDQpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA2KSwgJycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPiByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDQpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA1LCAxLCA3KSwgJycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRzdWl0ZSgnbm9uLWNvbGxhcHNlZCBkZWMnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdlZGl0LmVuZCA8IHJhbmdlLnN0YXJ0JywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMSwgMyksICcnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgMiwgMSwgNyksIG5ldyBSYW5nZSgxLCAyLCAxLCA3KSwgbmV3IFJhbmdlKDEsIDIsIDEsIDcpLCBuZXcgUmFuZ2UoMSwgMiwgMSwgNyldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCAyLCAxLCA3KSwgbmV3IFJhbmdlKDEsIDIsIDEsIDcpLCBuZXcgUmFuZ2UoMSwgMiwgMSwgNyksIG5ldyBSYW5nZSgxLCAyLCAxLCA3KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LmVuZCA8PSByYW5nZS5zdGFydCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDIsIDEsIDQpLCAnJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDIsIDEsIDcpLCBuZXcgUmFuZ2UoMSwgMiwgMSwgNyksIG5ldyBSYW5nZSgxLCAyLCAxLCA3KSwgbmV3IFJhbmdlKDEsIDIsIDEsIDcpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgMiwgMSwgNyksIG5ldyBSYW5nZSgxLCAyLCAxLCA3KSwgbmV3IFJhbmdlKDEsIDIsIDEsIDcpLCBuZXcgUmFuZ2UoMSwgMiwgMSwgNyldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA8IHJhbmdlLnN0YXJ0ICYmIGVkaXQuZW5kIDwgcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMywgMSwgNSksICcnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgMywgMSwgNyksIG5ldyBSYW5nZSgxLCAzLCAxLCA3KSwgbmV3IFJhbmdlKDEsIDMsIDEsIDcpLCBuZXcgUmFuZ2UoMSwgMywgMSwgNyldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCAzLCAxLCA3KSwgbmV3IFJhbmdlKDEsIDMsIDEsIDcpLCBuZXcgUmFuZ2UoMSwgMywgMSwgNyksIG5ldyBSYW5nZSgxLCAzLCAxLCA3KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPCByYW5nZS5zdGFydCAmJiBlZGl0LmVuZCA9PSByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAzLCAxLCA5KSwgJycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCAzLCAxLCAzKSwgbmV3IFJhbmdlKDEsIDMsIDEsIDMpLCBuZXcgUmFuZ2UoMSwgMywgMSwgMyksIG5ldyBSYW5nZSgxLCAzLCAxLCAzKV0sXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDMsIDEsIDMpLCBuZXcgUmFuZ2UoMSwgMywgMSwgMyksIG5ldyBSYW5nZSgxLCAzLCAxLCAzKSwgbmV3IFJhbmdlKDEsIDMsIDEsIDMpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA8IHJhbmdlLnN0YXJ0ICYmIGVkaXQuZW5kID4gcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMywgMSwgMTApLCAnJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDMsIDEsIDMpLCBuZXcgUmFuZ2UoMSwgMywgMSwgMyksIG5ldyBSYW5nZSgxLCAzLCAxLCAzKSwgbmV3IFJhbmdlKDEsIDMsIDEsIDMpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgMywgMSwgMyksIG5ldyBSYW5nZSgxLCAzLCAxLCAzKSwgbmV3IFJhbmdlKDEsIDMsIDEsIDMpLCBuZXcgUmFuZ2UoMSwgMywgMSwgMyldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID09IHJhbmdlLnN0YXJ0ICYmIGVkaXQuZW5kIDwgcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgNiksICcnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgNyksIG5ldyBSYW5nZSgxLCA0LCAxLCA3KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDcpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNyldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCA3KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDcpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNyksIG5ldyBSYW5nZSgxLCA0LCAxLCA3KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPT0gcmFuZ2Uuc3RhcnQgJiYgZWRpdC5lbmQgPT0gcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksICcnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPT0gcmFuZ2Uuc3RhcnQgJiYgZWRpdC5lbmQgPiByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCAxMCksICcnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPiByYW5nZS5zdGFydCAmJiBlZGl0LnN0YXJ0IDwgcmFuZ2UuZW5kICYmIGVkaXQuZW5kIDwgcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNSwgMSwgNyksICcnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgNyksIG5ldyBSYW5nZSgxLCA0LCAxLCA3KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDcpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNyldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCA3KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDcpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNyksIG5ldyBSYW5nZSgxLCA0LCAxLCA3KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPiByYW5nZS5zdGFydCAmJiBlZGl0LnN0YXJ0IDwgcmFuZ2UuZW5kICYmIGVkaXQuZW5kID09IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDUsIDEsIDkpLCAnJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDUpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNSksIG5ldyBSYW5nZSgxLCA0LCAxLCA1KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDUpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgNSksIG5ldyBSYW5nZSgxLCA0LCAxLCA1KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDUpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNSldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID4gcmFuZ2Uuc3RhcnQgJiYgZWRpdC5zdGFydCA8IHJhbmdlLmVuZCAmJiBlZGl0LmVuZCA+IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDUsIDEsIDEwKSwgJycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCA1KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDUpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNSksIG5ldyBSYW5nZSgxLCA0LCAxLCA1KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDUpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNSksIG5ldyBSYW5nZSgxLCA0LCAxLCA1KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDUpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA9PSByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA5LCAxLCAxMSksICcnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgOSksIG5ldyBSYW5nZSgxLCA0LCAxLCA5KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDkpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOSldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCA5KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDkpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOSksIG5ldyBSYW5nZSgxLCA0LCAxLCA5KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPiByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAxMCwgMSwgMTEpLCAnJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDkpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOSksIG5ldyBSYW5nZSgxLCA0LCAxLCA5KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDkpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgOSksIG5ldyBSYW5nZSgxLCA0LCAxLCA5KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDkpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOSldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgncmVwbGFjZSBzaG9ydCcsICgpID0+IHtcblx0XHRzdWl0ZSgnY29sbGFwc2VkIGRlYycsICgpID0+IHtcblx0XHRcdHRlc3QoJ2VkaXQuZW5kIDwgcmFuZ2Uuc3RhcnQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDQpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCAzKSwgJ2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgMywgMSwgMyksIG5ldyBSYW5nZSgxLCAzLCAxLCAzKSwgbmV3IFJhbmdlKDEsIDMsIDEsIDMpLCBuZXcgUmFuZ2UoMSwgMywgMSwgMyldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCAzLCAxLCAzKSwgbmV3IFJhbmdlKDEsIDMsIDEsIDMpLCBuZXcgUmFuZ2UoMSwgMywgMSwgMyksIG5ldyBSYW5nZSgxLCAzLCAxLCAzKV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LmVuZCA8PSByYW5nZS5zdGFydCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgNCksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDIsIDEsIDQpLCAnYycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCAzLCAxLCAzKSwgbmV3IFJhbmdlKDEsIDMsIDEsIDMpLCBuZXcgUmFuZ2UoMSwgMywgMSwgMyksIG5ldyBSYW5nZSgxLCAzLCAxLCAzKV0sXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDMsIDEsIDMpLCBuZXcgUmFuZ2UoMSwgMywgMSwgMyksIG5ldyBSYW5nZSgxLCAzLCAxLCAzKSwgbmV3IFJhbmdlKDEsIDMsIDEsIDMpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPCByYW5nZS5zdGFydCAmJiBlZGl0LmVuZCA+IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgNCksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDMsIDEsIDUpLCAnYycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPj0gcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA0KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgNiksICdjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNSwgMSwgNSksIG5ldyBSYW5nZSgxLCA1LCAxLCA1KSwgbmV3IFJhbmdlKDEsIDUsIDEsIDUpLCBuZXcgUmFuZ2UoMSwgNSwgMSwgNSldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA+IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgNCksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDUsIDEsIDcpLCAnYycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRzdWl0ZSgnbm9uLWNvbGxhcHNlZCBkZWMnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdlZGl0LmVuZCA8IHJhbmdlLnN0YXJ0JywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMSwgMyksICdjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDMsIDEsIDgpLCBuZXcgUmFuZ2UoMSwgMywgMSwgOCksIG5ldyBSYW5nZSgxLCAzLCAxLCA4KSwgbmV3IFJhbmdlKDEsIDMsIDEsIDgpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgMywgMSwgOCksIG5ldyBSYW5nZSgxLCAzLCAxLCA4KSwgbmV3IFJhbmdlKDEsIDMsIDEsIDgpLCBuZXcgUmFuZ2UoMSwgMywgMSwgOCldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5lbmQgPD0gcmFuZ2Uuc3RhcnQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAyLCAxLCA0KSwgJ2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgMywgMSwgOCksIG5ldyBSYW5nZSgxLCAzLCAxLCA4KSwgbmV3IFJhbmdlKDEsIDMsIDEsIDgpLCBuZXcgUmFuZ2UoMSwgMywgMSwgOCldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCAzLCAxLCA4KSwgbmV3IFJhbmdlKDEsIDMsIDEsIDgpLCBuZXcgUmFuZ2UoMSwgMywgMSwgOCksIG5ldyBSYW5nZSgxLCAzLCAxLCA4KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0IDwgcmFuZ2Uuc3RhcnQgJiYgZWRpdC5lbmQgPCByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAzLCAxLCA1KSwgJ2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgOCksIG5ldyBSYW5nZSgxLCA0LCAxLCA4KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDgpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOCldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCA4KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDgpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOCksIG5ldyBSYW5nZSgxLCA0LCAxLCA4KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0IDwgcmFuZ2Uuc3RhcnQgJiYgZWRpdC5lbmQgPT0gcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMywgMSwgOSksICdjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA8IHJhbmdlLnN0YXJ0ICYmIGVkaXQuZW5kID4gcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMywgMSwgMTApLCAnYycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPT0gcmFuZ2Uuc3RhcnQgJiYgZWRpdC5lbmQgPCByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA2KSwgJ2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgOCksIG5ldyBSYW5nZSgxLCA0LCAxLCA4KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDgpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOCldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA1LCAxLCA4KSwgbmV3IFJhbmdlKDEsIDUsIDEsIDgpLCBuZXcgUmFuZ2UoMSwgNSwgMSwgOCksIG5ldyBSYW5nZSgxLCA1LCAxLCA4KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID09IHJhbmdlLnN0YXJ0ICYmIGVkaXQuZW5kID09IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLCAnYycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCA1KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDUpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNSksIG5ldyBSYW5nZSgxLCA0LCAxLCA1KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDUsIDEsIDUpLCBuZXcgUmFuZ2UoMSwgNSwgMSwgNSksIG5ldyBSYW5nZSgxLCA1LCAxLCA1KSwgbmV3IFJhbmdlKDEsIDUsIDEsIDUpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPT0gcmFuZ2Uuc3RhcnQgJiYgZWRpdC5lbmQgPiByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCAxMCksICdjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDUpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNSksIG5ldyBSYW5nZSgxLCA0LCAxLCA1KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDUpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNSwgMSwgNSksIG5ldyBSYW5nZSgxLCA1LCAxLCA1KSwgbmV3IFJhbmdlKDEsIDUsIDEsIDUpLCBuZXcgUmFuZ2UoMSwgNSwgMSwgNSldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA+IHJhbmdlLnN0YXJ0ICYmIGVkaXQuc3RhcnQgPCByYW5nZS5lbmQgJiYgZWRpdC5lbmQgPCByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA1LCAxLCA3KSwgJ2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgOCksIG5ldyBSYW5nZSgxLCA0LCAxLCA4KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDgpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOCldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCA4KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDgpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOCksIG5ldyBSYW5nZSgxLCA0LCAxLCA4KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID4gcmFuZ2Uuc3RhcnQgJiYgZWRpdC5zdGFydCA8IHJhbmdlLmVuZCAmJiBlZGl0LmVuZCA9PSByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA1LCAxLCA5KSwgJ2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgNiksIG5ldyBSYW5nZSgxLCA0LCAxLCA2KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDYpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNildLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCA2KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDYpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNiksIG5ldyBSYW5nZSgxLCA0LCAxLCA2KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID4gcmFuZ2Uuc3RhcnQgJiYgZWRpdC5zdGFydCA8IHJhbmdlLmVuZCAmJiBlZGl0LmVuZCA+IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDUsIDEsIDEwKSwgJ2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgNiksIG5ldyBSYW5nZSgxLCA0LCAxLCA2KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDYpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNildLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCA2KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDYpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNiksIG5ldyBSYW5nZSgxLCA0LCAxLCA2KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID09IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDksIDEsIDExKSwgJ2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgOSksIG5ldyBSYW5nZSgxLCA0LCAxLCA5KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDkpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOSldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCAxMCksIG5ldyBSYW5nZSgxLCA0LCAxLCAxMCksIG5ldyBSYW5nZSgxLCA0LCAxLCAxMCksIG5ldyBSYW5nZSgxLCA0LCAxLCAxMCldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA+IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDEwLCAxLCAxMSksICdjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDkpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOSksIG5ldyBSYW5nZSgxLCA0LCAxLCA5KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDkpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgOSksIG5ldyBSYW5nZSgxLCA0LCAxLCA5KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDkpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOSldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgncmVwbGFjZSBsb25nJywgKCkgPT4ge1xuXHRcdHN1aXRlKCdjb2xsYXBzZWQgZGVjJywgKCkgPT4ge1xuXHRcdFx0dGVzdCgnZWRpdC5lbmQgPCByYW5nZS5zdGFydCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgNCksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDEsIDEsIDMpLCAnY2NjYycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA2LCAxLCA2KSwgbmV3IFJhbmdlKDEsIDYsIDEsIDYpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgNiksIG5ldyBSYW5nZSgxLCA2LCAxLCA2KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDYsIDEsIDYpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgNiksIG5ldyBSYW5nZSgxLCA2LCAxLCA2KSwgbmV3IFJhbmdlKDEsIDYsIDEsIDYpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuZW5kIDw9IHJhbmdlLnN0YXJ0JywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA0KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMiwgMSwgNCksICdjY2NjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDYpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgNiksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDYsIDEsIDYpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNiwgMSwgNiksIG5ldyBSYW5nZSgxLCA2LCAxLCA2KSwgbmV3IFJhbmdlKDEsIDYsIDEsIDYpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgNildLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA8IHJhbmdlLnN0YXJ0ICYmIGVkaXQuZW5kID4gcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA0KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMywgMSwgNSksICdjY2NjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNywgMSwgNyksIG5ldyBSYW5nZSgxLCA3LCAxLCA3KSwgbmV3IFJhbmdlKDEsIDcsIDEsIDcpLCBuZXcgUmFuZ2UoMSwgNywgMSwgNyldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA+PSByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDQpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA2KSwgJ2NjY2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA4LCAxLCA4KSwgbmV3IFJhbmdlKDEsIDgsIDEsIDgpLCBuZXcgUmFuZ2UoMSwgOCwgMSwgOCksIG5ldyBSYW5nZSgxLCA4LCAxLCA4KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID4gcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA0KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNSwgMSwgNyksICdjY2NjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDQpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNCldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdHN1aXRlKCdub24tY29sbGFwc2VkIGRlYycsICgpID0+IHtcblx0XHRcdHRlc3QoJ2VkaXQuZW5kIDwgcmFuZ2Uuc3RhcnQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCAzKSwgJ2NjY2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNiwgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgMTEpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNiwgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNiwgMSwgMTEpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuZW5kIDw9IHJhbmdlLnN0YXJ0JywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMiwgMSwgNCksICdjY2NjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDExKSwgbmV3IFJhbmdlKDEsIDYsIDEsIDExKSwgbmV3IFJhbmdlKDEsIDQsIDEsIDExKSwgbmV3IFJhbmdlKDEsIDYsIDEsIDExKV0sXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDYsIDEsIDExKSwgbmV3IFJhbmdlKDEsIDYsIDEsIDExKSwgbmV3IFJhbmdlKDEsIDYsIDEsIDExKSwgbmV3IFJhbmdlKDEsIDYsIDEsIDExKV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0IDwgcmFuZ2Uuc3RhcnQgJiYgZWRpdC5lbmQgPCByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAzLCAxLCA1KSwgJ2NjY2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgMTEpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNywgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNywgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNywgMSwgMTEpLCBuZXcgUmFuZ2UoMSwgNywgMSwgMTEpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPCByYW5nZS5zdGFydCAmJiBlZGl0LmVuZCA9PSByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAzLCAxLCA5KSwgJ2NjY2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgNyksIG5ldyBSYW5nZSgxLCA0LCAxLCA3KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDcpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNyldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA3LCAxLCA3KSwgbmV3IFJhbmdlKDEsIDcsIDEsIDcpLCBuZXcgUmFuZ2UoMSwgNywgMSwgNyksIG5ldyBSYW5nZSgxLCA3LCAxLCA3KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0IDwgcmFuZ2Uuc3RhcnQgJiYgZWRpdC5lbmQgPiByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAzLCAxLCAxMCksICdjY2NjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDcpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgNyksIG5ldyBSYW5nZSgxLCA0LCAxLCA3KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDcpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNywgMSwgNyksIG5ldyBSYW5nZSgxLCA3LCAxLCA3KSwgbmV3IFJhbmdlKDEsIDcsIDEsIDcpLCBuZXcgUmFuZ2UoMSwgNywgMSwgNyldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA9PSByYW5nZS5zdGFydCAmJiBlZGl0LmVuZCA8IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDYpLCAnY2NjYycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCAxMSksIG5ldyBSYW5nZSgxLCA0LCAxLCAxMSksIG5ldyBSYW5nZSgxLCA0LCAxLCAxMSksIG5ldyBSYW5nZSgxLCA0LCAxLCAxMSldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA4LCAxLCAxMSksIG5ldyBSYW5nZSgxLCA4LCAxLCAxMSksIG5ldyBSYW5nZSgxLCA4LCAxLCAxMSksIG5ldyBSYW5nZSgxLCA4LCAxLCAxMSldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA9PSByYW5nZS5zdGFydCAmJiBlZGl0LmVuZCA9PSByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSwgJ2NjY2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgOCksIG5ldyBSYW5nZSgxLCA0LCAxLCA4KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDgpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOCldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA4LCAxLCA4KSwgbmV3IFJhbmdlKDEsIDgsIDEsIDgpLCBuZXcgUmFuZ2UoMSwgOCwgMSwgOCksIG5ldyBSYW5nZSgxLCA4LCAxLCA4KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID09IHJhbmdlLnN0YXJ0ICYmIGVkaXQuZW5kID4gcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgMTApLCAnY2NjYycsXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCA4KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDgpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOCksIG5ldyBSYW5nZSgxLCA0LCAxLCA4KV0sXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDgsIDEsIDgpLCBuZXcgUmFuZ2UoMSwgOCwgMSwgOCksIG5ldyBSYW5nZSgxLCA4LCAxLCA4KSwgbmV3IFJhbmdlKDEsIDgsIDEsIDgpXSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ2VkaXQuc3RhcnQgPiByYW5nZS5zdGFydCAmJiBlZGl0LnN0YXJ0IDwgcmFuZ2UuZW5kICYmIGVkaXQuZW5kIDwgcmFuZ2UuZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRydW5UZXN0KFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA5KSxcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNSwgMSwgNyksICdjY2NjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDExKSwgbmV3IFJhbmdlKDEsIDQsIDEsIDExKSwgbmV3IFJhbmdlKDEsIDQsIDEsIDExKSwgbmV3IFJhbmdlKDEsIDQsIDEsIDExKV0sXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDExKSwgbmV3IFJhbmdlKDEsIDQsIDEsIDExKSwgbmV3IFJhbmdlKDEsIDQsIDEsIDExKSwgbmV3IFJhbmdlKDEsIDQsIDEsIDExKV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID4gcmFuZ2Uuc3RhcnQgJiYgZWRpdC5zdGFydCA8IHJhbmdlLmVuZCAmJiBlZGl0LmVuZCA9PSByYW5nZS5lbmQnLCAoKSA9PiB7XG5cdFx0XHRcdHJ1blRlc3QoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDkpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA1LCAxLCA5KSwgJ2NjY2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgOSksIG5ldyBSYW5nZSgxLCA0LCAxLCA5KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDkpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOSldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCA5KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDkpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOSksIG5ldyBSYW5nZSgxLCA0LCAxLCA5KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID4gcmFuZ2Uuc3RhcnQgJiYgZWRpdC5zdGFydCA8IHJhbmdlLmVuZCAmJiBlZGl0LmVuZCA+IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDUsIDEsIDEwKSwgJ2NjY2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgOSksIG5ldyBSYW5nZSgxLCA0LCAxLCA5KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDkpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOSldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCA5KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDkpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOSksIG5ldyBSYW5nZSgxLCA0LCAxLCA5KV0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdlZGl0LnN0YXJ0ID09IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDksIDEsIDExKSwgJ2NjY2MnLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgOSksIG5ldyBSYW5nZSgxLCA0LCAxLCA5KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDkpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOSldLFxuXHRcdFx0XHRcdFx0W25ldyBSYW5nZSgxLCA0LCAxLCAxMyksIG5ldyBSYW5nZSgxLCA0LCAxLCAxMyksIG5ldyBSYW5nZSgxLCA0LCAxLCAxMyksIG5ldyBSYW5nZSgxLCA0LCAxLCAxMyldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnZWRpdC5zdGFydCA+IHJhbmdlLmVuZCcsICgpID0+IHtcblx0XHRcdFx0cnVuVGVzdChcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgNCwgMSwgOSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDEwLCAxLCAxMSksICdjY2NjJyxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRbbmV3IFJhbmdlKDEsIDQsIDEsIDkpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOSksIG5ldyBSYW5nZSgxLCA0LCAxLCA5KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDkpXSxcblx0XHRcdFx0XHRcdFtuZXcgUmFuZ2UoMSwgNCwgMSwgOSksIG5ldyBSYW5nZSgxLCA0LCAxLCA5KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDkpLCBuZXcgUmFuZ2UoMSwgNCwgMSwgOSldLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuXG5pbnRlcmZhY2UgSUxpZ2h0V2VpZ2h0RGVjb3JhdGlvbiB7XG5cdGlkOiBzdHJpbmc7XG5cdHJhbmdlOiBSYW5nZTtcbn1cblxuc3VpdGUoJ2RlbHRhRGVjb3JhdGlvbnMnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0ZnVuY3Rpb24gZGVjb3JhdGlvbihpZDogc3RyaW5nLCBzdGFydExpbmVOdW1iZXI6IG51bWJlciwgc3RhcnRDb2x1bW46IG51bWJlciwgZW5kTGluZU51bWJlcjogbnVtYmVyLCBlbmRDb2x1bTogbnVtYmVyKTogSUxpZ2h0V2VpZ2h0RGVjb3JhdGlvbiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGlkOiBpZCxcblx0XHRcdHJhbmdlOiBuZXcgUmFuZ2Uoc3RhcnRMaW5lTnVtYmVyLCBzdGFydENvbHVtbiwgZW5kTGluZU51bWJlciwgZW5kQ29sdW0pXG5cdFx0fTtcblx0fVxuXG5cdGZ1bmN0aW9uIHRvTW9kZWxEZWx0YURlY29yYXRpb24oZGVjOiBJTGlnaHRXZWlnaHREZWNvcmF0aW9uKTogSU1vZGVsRGVsdGFEZWNvcmF0aW9uIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmFuZ2U6IGRlYy5yYW5nZSxcblx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246ICd0ZXN0Jyxcblx0XHRcdFx0Y2xhc3NOYW1lOiBkZWMuaWRcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0ZnVuY3Rpb24gc3RyY21wKGE6IHN0cmluZywgYjogc3RyaW5nKTogbnVtYmVyIHtcblx0XHRpZiAoYSA9PT0gYikge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXHRcdGlmIChhIDwgYikge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH1cblx0XHRyZXR1cm4gMTtcblx0fVxuXG5cdGZ1bmN0aW9uIHJlYWRNb2RlbERlY29yYXRpb25zKG1vZGVsOiBUZXh0TW9kZWwsIGlkczogc3RyaW5nW10pOiBJTGlnaHRXZWlnaHREZWNvcmF0aW9uW10ge1xuXHRcdHJldHVybiBpZHMubWFwKChpZCkgPT4ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0cmFuZ2U6IG1vZGVsLmdldERlY29yYXRpb25SYW5nZShpZCkhLFxuXHRcdFx0XHRpZDogbW9kZWwuZ2V0RGVjb3JhdGlvbk9wdGlvbnMoaWQpIS5jbGFzc05hbWUhXG5cdFx0XHR9O1xuXHRcdH0pO1xuXHR9XG5cblx0ZnVuY3Rpb24gdGVzdERlbHRhRGVjb3JhdGlvbnModGV4dDogc3RyaW5nW10sIGRlY29yYXRpb25zOiBJTGlnaHRXZWlnaHREZWNvcmF0aW9uW10sIG5ld0RlY29yYXRpb25zOiBJTGlnaHRXZWlnaHREZWNvcmF0aW9uW10pOiB2b2lkIHtcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKHRleHQuam9pbignXFxuJykpO1xuXG5cdFx0Ly8gQWRkIGluaXRpYWwgZGVjb3JhdGlvbnMgJiBhc3NlcnQgdGhleSBhcmUgYWRkZWRcblx0XHRjb25zdCBpbml0aWFsSWRzID0gbW9kZWwuZGVsdGFEZWNvcmF0aW9ucyhbXSwgZGVjb3JhdGlvbnMubWFwKHRvTW9kZWxEZWx0YURlY29yYXRpb24pKTtcblx0XHRjb25zdCBhY3R1YWxEZWNvcmF0aW9ucyA9IHJlYWRNb2RlbERlY29yYXRpb25zKG1vZGVsLCBpbml0aWFsSWRzKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbml0aWFsSWRzLmxlbmd0aCwgZGVjb3JhdGlvbnMubGVuZ3RoLCAncmV0dXJucyBleHBlY3RlZCBjbnQgb2YgaWRzJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGluaXRpYWxJZHMubGVuZ3RoLCBtb2RlbC5nZXRBbGxEZWNvcmF0aW9ucygpLmxlbmd0aCwgJ2RvZXMgbm90IGxlYWsgZGVjb3JhdGlvbnMnKTtcblx0XHRhY3R1YWxEZWNvcmF0aW9ucy5zb3J0KChhLCBiKSA9PiBzdHJjbXAoYS5pZCwgYi5pZCkpO1xuXHRcdGRlY29yYXRpb25zLnNvcnQoKGEsIGIpID0+IHN0cmNtcChhLmlkLCBiLmlkKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWxEZWNvcmF0aW9ucywgZGVjb3JhdGlvbnMpO1xuXG5cdFx0Y29uc3QgbmV3SWRzID0gbW9kZWwuZGVsdGFEZWNvcmF0aW9ucyhpbml0aWFsSWRzLCBuZXdEZWNvcmF0aW9ucy5tYXAodG9Nb2RlbERlbHRhRGVjb3JhdGlvbikpO1xuXHRcdGNvbnN0IGFjdHVhbE5ld0RlY29yYXRpb25zID0gcmVhZE1vZGVsRGVjb3JhdGlvbnMobW9kZWwsIG5ld0lkcyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmV3SWRzLmxlbmd0aCwgbmV3RGVjb3JhdGlvbnMubGVuZ3RoLCAncmV0dXJucyBleHBlY3RlZCBjbnQgb2YgaWRzJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5ld0lkcy5sZW5ndGgsIG1vZGVsLmdldEFsbERlY29yYXRpb25zKCkubGVuZ3RoLCAnZG9lcyBub3QgbGVhayBkZWNvcmF0aW9ucycpO1xuXHRcdGFjdHVhbE5ld0RlY29yYXRpb25zLnNvcnQoKGEsIGIpID0+IHN0cmNtcChhLmlkLCBiLmlkKSk7XG5cdFx0bmV3RGVjb3JhdGlvbnMuc29ydCgoYSwgYikgPT4gc3RyY21wKGEuaWQsIGIuaWQpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbERlY29yYXRpb25zLCBkZWNvcmF0aW9ucyk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH1cblxuXHRmdW5jdGlvbiByYW5nZShzdGFydExpbmVOdW1iZXI6IG51bWJlciwgc3RhcnRDb2x1bW46IG51bWJlciwgZW5kTGluZU51bWJlcjogbnVtYmVyLCBlbmRDb2x1bW46IG51bWJlcik6IFJhbmdlIHtcblx0XHRyZXR1cm4gbmV3IFJhbmdlKHN0YXJ0TGluZU51bWJlciwgc3RhcnRDb2x1bW4sIGVuZExpbmVOdW1iZXIsIGVuZENvbHVtbik7XG5cdH1cblxuXHR0ZXN0KCdyZXN1bHQgcmVzcGVjdHMgaW5wdXQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoW1xuXHRcdFx0J0hlbGxvIHdvcmxkLCcsXG5cdFx0XHQnSG93IGFyZSB5b3U/J1xuXHRcdF0uam9pbignXFxuJykpO1xuXG5cdFx0Y29uc3QgaWRzID0gbW9kZWwuZGVsdGFEZWNvcmF0aW9ucyhbXSwgW1xuXHRcdFx0dG9Nb2RlbERlbHRhRGVjb3JhdGlvbihkZWNvcmF0aW9uKCdhJywgMSwgMSwgMSwgMTIpKSxcblx0XHRcdHRvTW9kZWxEZWx0YURlY29yYXRpb24oZGVjb3JhdGlvbignYicsIDIsIDEsIDIsIDEzKSlcblx0XHRdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0RGVjb3JhdGlvblJhbmdlKGlkc1swXSksIHJhbmdlKDEsIDEsIDEsIDEyKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXREZWNvcmF0aW9uUmFuZ2UoaWRzWzFdKSwgcmFuZ2UoMiwgMSwgMiwgMTMpKTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnZGVsdGFEZWNvcmF0aW9ucyAxJywgKCkgPT4ge1xuXHRcdHRlc3REZWx0YURlY29yYXRpb25zKFxuXHRcdFx0W1xuXHRcdFx0XHQnVGhpcyBpcyBhIHRleHQnLFxuXHRcdFx0XHQnVGhhdCBoYXMgbXVsdGlwbGUgbGluZXMnLFxuXHRcdFx0XHQnQW5kIGlzIHZlcnkgZnJpZW5kbHknLFxuXHRcdFx0XHQnVG93YXJkcyB0ZXN0aW5nJ1xuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0ZGVjb3JhdGlvbignYScsIDEsIDEsIDEsIDIpLFxuXHRcdFx0XHRkZWNvcmF0aW9uKCdiJywgMSwgMSwgMSwgMTUpLFxuXHRcdFx0XHRkZWNvcmF0aW9uKCdjJywgMSwgMSwgMiwgMSksXG5cdFx0XHRcdGRlY29yYXRpb24oJ2QnLCAxLCAxLCAyLCAyNCksXG5cdFx0XHRcdGRlY29yYXRpb24oJ2UnLCAyLCAxLCAyLCAyNCksXG5cdFx0XHRcdGRlY29yYXRpb24oJ2YnLCAyLCAxLCA0LCAxNilcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdGRlY29yYXRpb24oJ3gnLCAxLCAxLCAxLCAyKSxcblx0XHRcdFx0ZGVjb3JhdGlvbignYicsIDEsIDEsIDEsIDE1KSxcblx0XHRcdFx0ZGVjb3JhdGlvbignYycsIDEsIDEsIDIsIDEpLFxuXHRcdFx0XHRkZWNvcmF0aW9uKCdkJywgMSwgMSwgMiwgMjQpLFxuXHRcdFx0XHRkZWNvcmF0aW9uKCdlJywgMiwgMSwgMiwgMjEpLFxuXHRcdFx0XHRkZWNvcmF0aW9uKCdmJywgMiwgMTcsIDQsIDE2KVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbHRhRGVjb3JhdGlvbnMgMicsICgpID0+IHtcblx0XHR0ZXN0RGVsdGFEZWNvcmF0aW9ucyhcblx0XHRcdFtcblx0XHRcdFx0J1RoaXMgaXMgYSB0ZXh0Jyxcblx0XHRcdFx0J1RoYXQgaGFzIG11bHRpcGxlIGxpbmVzJyxcblx0XHRcdFx0J0FuZCBpcyB2ZXJ5IGZyaWVuZGx5Jyxcblx0XHRcdFx0J1Rvd2FyZHMgdGVzdGluZydcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdGRlY29yYXRpb24oJ2EnLCAxLCAxLCAxLCAyKSxcblx0XHRcdFx0ZGVjb3JhdGlvbignYicsIDEsIDIsIDEsIDMpLFxuXHRcdFx0XHRkZWNvcmF0aW9uKCdjJywgMSwgMywgMSwgNCksXG5cdFx0XHRcdGRlY29yYXRpb24oJ2QnLCAxLCA0LCAxLCA1KSxcblx0XHRcdFx0ZGVjb3JhdGlvbignZScsIDEsIDUsIDEsIDYpXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRkZWNvcmF0aW9uKCdhJywgMSwgMiwgMSwgMyksXG5cdFx0XHRcdGRlY29yYXRpb24oJ2InLCAxLCAzLCAxLCA0KSxcblx0XHRcdFx0ZGVjb3JhdGlvbignYycsIDEsIDQsIDEsIDUpLFxuXHRcdFx0XHRkZWNvcmF0aW9uKCdkJywgMSwgNSwgMSwgNilcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWx0YURlY29yYXRpb25zIDMnLCAoKSA9PiB7XG5cdFx0dGVzdERlbHRhRGVjb3JhdGlvbnMoXG5cdFx0XHRbXG5cdFx0XHRcdCdUaGlzIGlzIGEgdGV4dCcsXG5cdFx0XHRcdCdUaGF0IGhhcyBtdWx0aXBsZSBsaW5lcycsXG5cdFx0XHRcdCdBbmQgaXMgdmVyeSBmcmllbmRseScsXG5cdFx0XHRcdCdUb3dhcmRzIHRlc3RpbmcnXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRkZWNvcmF0aW9uKCdhJywgMSwgMSwgMSwgMiksXG5cdFx0XHRcdGRlY29yYXRpb24oJ2InLCAxLCAyLCAxLCAzKSxcblx0XHRcdFx0ZGVjb3JhdGlvbignYycsIDEsIDMsIDEsIDQpLFxuXHRcdFx0XHRkZWNvcmF0aW9uKCdkJywgMSwgNCwgMSwgNSksXG5cdFx0XHRcdGRlY29yYXRpb24oJ2UnLCAxLCA1LCAxLCA2KVxuXHRcdFx0XSxcblx0XHRcdFtdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzQzMTc6IGVkaXRvci5zZXREZWNvcmF0aW9ucyBkb2VzblxcJ3QgdXBkYXRlIHRoZSBob3ZlciBtZXNzYWdlJywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoJ0hlbGxvIHdvcmxkIScpO1xuXG5cdFx0bGV0IGlkcyA9IG1vZGVsLmRlbHRhRGVjb3JhdGlvbnMoW10sIFt7XG5cdFx0XHRyYW5nZToge1xuXHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IDEsXG5cdFx0XHRcdHN0YXJ0Q29sdW1uOiAxLFxuXHRcdFx0XHRlbmRMaW5lTnVtYmVyOiAxMDAsXG5cdFx0XHRcdGVuZENvbHVtbjogMVxuXHRcdFx0fSxcblx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246ICd0ZXN0Jyxcblx0XHRcdFx0aG92ZXJNZXNzYWdlOiB7IHZhbHVlOiAnaGVsbG8xJyB9XG5cdFx0XHR9XG5cdFx0fV0pO1xuXG5cdFx0aWRzID0gbW9kZWwuZGVsdGFEZWNvcmF0aW9ucyhpZHMsIFt7XG5cdFx0XHRyYW5nZToge1xuXHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IDEsXG5cdFx0XHRcdHN0YXJ0Q29sdW1uOiAxLFxuXHRcdFx0XHRlbmRMaW5lTnVtYmVyOiAxMDAsXG5cdFx0XHRcdGVuZENvbHVtbjogMVxuXHRcdFx0fSxcblx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246ICd0ZXN0Jyxcblx0XHRcdFx0aG92ZXJNZXNzYWdlOiB7IHZhbHVlOiAnaGVsbG8yJyB9XG5cdFx0XHR9XG5cdFx0fV0pO1xuXG5cdFx0Y29uc3QgYWN0dWFsRGVjb3JhdGlvbiA9IG1vZGVsLmdldERlY29yYXRpb25PcHRpb25zKGlkc1swXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbERlY29yYXRpb24hLmhvdmVyTWVzc2FnZSwgeyB2YWx1ZTogJ2hlbGxvMicgfSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vZGVsIGRvZXNuXFwndCBnZXQgY29uZnVzZWQgd2l0aCBpbmRpdmlkdWFsIHRyYWNrZWQgcmFuZ2VzJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFtcblx0XHRcdCdIZWxsbyB3b3JsZCwnLFxuXHRcdFx0J0hvdyBhcmUgeW91Pydcblx0XHRdLmpvaW4oJ1xcbicpKTtcblxuXHRcdGNvbnN0IHRyYWNrZWRSYW5nZUlkID0gbW9kZWwuY2hhbmdlRGVjb3JhdGlvbnMoKGNoYW5nZUFjZXNzb3IpID0+IHtcblx0XHRcdHJldHVybiBjaGFuZ2VBY2Vzc29yLmFkZERlY29yYXRpb24oXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IDEsXG5cdFx0XHRcdFx0c3RhcnRDb2x1bW46IDEsXG5cdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogMSxcblx0XHRcdFx0XHRlbmRDb2x1bW46IDFcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiAndGVzdCcsXG5cdFx0XHRcdFx0c3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzXG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fSk7XG5cdFx0bW9kZWwuY2hhbmdlRGVjb3JhdGlvbnMoKGNoYW5nZUFjY2Vzc29yKSA9PiB7XG5cdFx0XHRjaGFuZ2VBY2Nlc3Nvci5yZW1vdmVEZWNvcmF0aW9uKHRyYWNrZWRSYW5nZUlkISk7XG5cdFx0fSk7XG5cblx0XHRsZXQgaWRzID0gbW9kZWwuZGVsdGFEZWNvcmF0aW9ucyhbXSwgW1xuXHRcdFx0dG9Nb2RlbERlbHRhRGVjb3JhdGlvbihkZWNvcmF0aW9uKCdhJywgMSwgMSwgMSwgMTIpKSxcblx0XHRcdHRvTW9kZWxEZWx0YURlY29yYXRpb24oZGVjb3JhdGlvbignYicsIDIsIDEsIDIsIDEzKSlcblx0XHRdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0RGVjb3JhdGlvblJhbmdlKGlkc1swXSksIHJhbmdlKDEsIDEsIDEsIDEyKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXREZWNvcmF0aW9uUmFuZ2UoaWRzWzFdKSwgcmFuZ2UoMiwgMSwgMiwgMTMpKTtcblxuXHRcdGlkcyA9IG1vZGVsLmRlbHRhRGVjb3JhdGlvbnMoaWRzLCBbXG5cdFx0XHR0b01vZGVsRGVsdGFEZWNvcmF0aW9uKGRlY29yYXRpb24oJ2EnLCAxLCAxLCAxLCAxMikpLFxuXHRcdFx0dG9Nb2RlbERlbHRhRGVjb3JhdGlvbihkZWNvcmF0aW9uKCdiJywgMiwgMSwgMiwgMTMpKVxuXHRcdF0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXREZWNvcmF0aW9uUmFuZ2UoaWRzWzBdKSwgcmFuZ2UoMSwgMSwgMSwgMTIpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldERlY29yYXRpb25SYW5nZShpZHNbMV0pLCByYW5nZSgyLCAxLCAyLCAxMykpO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTY5MjI6IENsaWNraW5nIG9uIGxpbmsgZG9lc25cXCd0IHNlZW0gdG8gZG8gYW55dGhpbmcnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoW1xuXHRcdFx0J0hlbGxvIHdvcmxkLCcsXG5cdFx0XHQnSG93IGFyZSB5b3U/Jyxcblx0XHRcdCdGaW5lLicsXG5cdFx0XHQnR29vZC4nLFxuXHRcdF0uam9pbignXFxuJykpO1xuXG5cdFx0bW9kZWwuZGVsdGFEZWNvcmF0aW9ucyhbXSwgW1xuXHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDEpLCBvcHRpb25zOiB7IGRlc2NyaXB0aW9uOiAndGVzdCcsIGNsYXNzTmFtZTogJzEnIH0gfSxcblx0XHRcdHsgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxMywgMSwgMTMpLCBvcHRpb25zOiB7IGRlc2NyaXB0aW9uOiAndGVzdCcsIGNsYXNzTmFtZTogJzInIH0gfSxcblx0XHRcdHsgcmFuZ2U6IG5ldyBSYW5nZSgyLCAxLCAyLCAxKSwgb3B0aW9uczogeyBkZXNjcmlwdGlvbjogJ3Rlc3QnLCBjbGFzc05hbWU6ICczJyB9IH0sXG5cdFx0XHR7IHJhbmdlOiBuZXcgUmFuZ2UoMiwgMSwgMiwgNCksIG9wdGlvbnM6IHsgZGVzY3JpcHRpb246ICd0ZXN0JywgY2xhc3NOYW1lOiAnNCcgfSB9LFxuXHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDIsIDgsIDIsIDEzKSwgb3B0aW9uczogeyBkZXNjcmlwdGlvbjogJ3Rlc3QnLCBjbGFzc05hbWU6ICc1JyB9IH0sXG5cdFx0XHR7IHJhbmdlOiBuZXcgUmFuZ2UoMywgMSwgNCwgNiksIG9wdGlvbnM6IHsgZGVzY3JpcHRpb246ICd0ZXN0JywgY2xhc3NOYW1lOiAnNicgfSB9LFxuXHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDMsIDYpLCBvcHRpb25zOiB7IGRlc2NyaXB0aW9uOiAndGVzdCcsIGNsYXNzTmFtZTogJ3gxJyB9IH0sXG5cdFx0XHR7IHJhbmdlOiBuZXcgUmFuZ2UoMiwgNSwgMiwgOCksIG9wdGlvbnM6IHsgZGVzY3JpcHRpb246ICd0ZXN0JywgY2xhc3NOYW1lOiAneDInIH0gfSxcblx0XHRcdHsgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAyLCA4KSwgb3B0aW9uczogeyBkZXNjcmlwdGlvbjogJ3Rlc3QnLCBjbGFzc05hbWU6ICd4MycgfSB9LFxuXHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDIsIDUsIDMsIDEpLCBvcHRpb25zOiB7IGRlc2NyaXB0aW9uOiAndGVzdCcsIGNsYXNzTmFtZTogJ3g0JyB9IH0sXG5cdFx0XSk7XG5cblx0XHRjb25zdCBpblJhbmdlID0gbW9kZWwuZ2V0RGVjb3JhdGlvbnNJblJhbmdlKG5ldyBSYW5nZSgyLCA2LCAyLCA2KSk7XG5cblx0XHRjb25zdCBpblJhbmdlQ2xhc3NOYW1lcyA9IGluUmFuZ2UubWFwKGQgPT4gZC5vcHRpb25zLmNsYXNzTmFtZSk7XG5cdFx0aW5SYW5nZUNsYXNzTmFtZXMuc29ydCgpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaW5SYW5nZUNsYXNzTmFtZXMsIFsneDEnLCAneDInLCAneDMnLCAneDQnXSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM0MTQ5MjogVVJMIGhpZ2hsaWdodGluZyBwZXJzaXN0cyBhZnRlciBwYXN0aW5nIG92ZXIgdXJsJywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoW1xuXHRcdFx0J015IEZpcnN0IExpbmUnXG5cdFx0XS5qb2luKCdcXG4nKSk7XG5cblx0XHRjb25zdCBpZCA9IG1vZGVsLmRlbHRhRGVjb3JhdGlvbnMoW10sIFt7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMiwgMSwgMTQpLCBvcHRpb25zOiB7IGRlc2NyaXB0aW9uOiAndGVzdCcsIHN0aWNraW5lc3M6IFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLCBjb2xsYXBzZU9uUmVwbGFjZUVkaXQ6IHRydWUgfSB9XSlbMF07XG5cdFx0bW9kZWwuYXBwbHlFZGl0cyhbe1xuXHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCAxNCksXG5cdFx0XHR0ZXh0OiAnU29tZSBuZXcgdGV4dCB0aGF0IGlzIGxvbmdlciB0aGFuIHRoZSBwcmV2aW91cyBvbmUnLFxuXHRcdFx0Zm9yY2VNb3ZlTWFya2VyczogZmFsc2Vcblx0XHR9XSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gbW9kZWwuZ2V0RGVjb3JhdGlvblJhbmdlKGlkKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgbmV3IFJhbmdlKDEsIDEsIDEsIDEpKTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLCtDQUErQztBQUN4RCxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGFBQWE7QUFDdEIsU0FBUyxtQkFBMEMsOEJBQThCO0FBRWpGLFNBQVMsdUJBQXVCO0FBU2hDLFNBQVMsb0JBQW9CLE9BQWtCLGFBQXdDO0FBQ3RGLFFBQU0sbUJBQThDLENBQUM7QUFDckQsUUFBTSxvQkFBb0IsTUFBTSxrQkFBa0I7QUFDbEQsV0FBUyxJQUFJLEdBQUcsTUFBTSxrQkFBa0IsUUFBUSxJ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LFVBQUc7QUFBQSxVQUN2QjtBQUFBLFlBQ0MsQ0FBQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsWUFDM0YsQ0FBQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsVUFDNUY7QUFBQSxRQUNEO0FBQUEsTUFDRCxDQUFDO0FBQ0QsV0FBSyxTQUFTLE1BQU07QUFDbkI7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssU0FBUyxNQUFNO0FBQ25CO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxZQUMzRixDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUM1RjtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGLENBQUM7QUFDRCxVQUFNLHFCQUFxQixNQUFNO0FBQ2hDLFdBQUssVUFBVSxNQUFNO0FBQ3BCO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLENBQUM7QUFBQSxZQUMvRixDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLENBQUM7QUFBQSxVQUNo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QU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxZQUMzRixDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUM1RjtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCxXQUFLLG9EQUFvRCxNQUFNO0FBQzlEO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxZQUMzRixDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUM1RjtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCxXQUFLLDJCQUEyQixNQUFNO0FBQ3JDO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxZQUMzRixDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUM1RjtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCxXQUFLLDBCQUEwQixNQUFNO0FBQ3BDO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxZQUMzRixDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUM1RjtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGLENBQUM7QUFDRCxVQUFNLHFCQUFxQixNQUFNO0FBQ2hDLFdBQUssMEJBQTBCLE1BQU07QUFDcEM7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssMkJBQTJCLE1BQU07QUFDckM7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssb0RBQW9ELE1BQU07QUFDOUQ7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUVELFdBQUsscURBQXFELE1BQU07QUFDL0Q7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUVELFdBQUssb0RBQW9ELE1BQU07QUFDOUQ7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHO0FBQUEsVUFDeEI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUVELFdBQUsscURBQXFELE1BQU07QUFDL0Q7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUVELFdBQUssc0RBQXNELE1BQU07QUFDaEU7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUVELFdBQUsscURBQXFELE1BQU07QUFDL0Q7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHO0FBQUEsVUFDeEI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUVELFdBQUssOEVBQThFLE1BQU07QUFDeEY7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUVELFdBQUssK0VBQStFLE1BQU07QUFDekY7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUVELFdBQUssOEVBQThFLE1BQU07QUFDeEY7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHO0FBQUEsVUFDeEI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUVELFdBQUssMkJBQTJCLE1BQU07QUFDckM7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHO0FBQUEsVUFDeEI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUVELFdBQUssMEJBQTBCLE1BQU07QUFDcEM7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxVQUFHO0FBQUEsVUFDekI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELFFBQU0saUJBQWlCLE1BQU07QUFDNUIsVUFBTSxpQkFBaUIsTUFBTTtBQUM1QixXQUFLLDBCQUEwQixNQUFNO0FBQ3BDO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxZQUMzRixDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUM1RjtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCxXQUFLLDJCQUEyQixNQUFNO0FBQ3JDO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxZQUMzRixDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUM1RjtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCxXQUFLLG9EQUFvRCxNQUFNO0FBQzlEO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxZQUMzRixDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUM1RjtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCxXQUFLLDJCQUEyQixNQUFNO0FBQ3JDO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxZQUMzRixDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUM1RjtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCxXQUFLLDBCQUEwQixNQUFNO0FBQ3BDO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxZQUMzRixDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUM1RjtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGLENBQUM7QUFDRCxVQUFNLHFCQUFxQixNQUFNO0FBQ2hDLFdBQUssMEJBQTBCLE1BQU07QUFDcEM7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssMkJBQTJCLE1BQU07QUFDckM7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssb0RBQW9ELE1BQU07QUFDOUQ7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUsscURBQXFELE1BQU07QUFDL0Q7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssb0RBQW9ELE1BQU07QUFDOUQ7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHO0FBQUEsVUFDeEI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUsscURBQXFELE1BQU07QUFDL0Q7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssc0RBQXNELE1BQU07QUFDaEU7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUsscURBQXFELE1BQU07QUFDL0Q7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHO0FBQUEsVUFDeEI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssOEVBQThFLE1BQU07QUFDeEY7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssK0VBQStFLE1BQU07QUFDekY7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssOEVBQThFLE1BQU07QUFDeEY7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHO0FBQUEsVUFDeEI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssMkJBQTJCLE1BQU07QUFDckM7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHO0FBQUEsVUFDeEI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUFBLFVBQ2hHO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssMEJBQTBCLE1BQU07QUFDcEM7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxVQUFHO0FBQUEsVUFDekI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELFFBQU0sZ0JBQWdCLE1BQU07QUFDM0IsVUFBTSxpQkFBaUIsTUFBTTtBQUM1QixXQUFLLDBCQUEwQixNQUFNO0FBQ3BDO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxZQUMzRixDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUM1RjtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCxXQUFLLDJCQUEyQixNQUFNO0FBQ3JDO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxZQUMzRixDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUM1RjtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCxXQUFLLG9EQUFvRCxNQUFNO0FBQzlEO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxZQUMzRixDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUM1RjtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCxXQUFLLDJCQUEyQixNQUFNO0FBQ3JDO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxZQUMzRixDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUM1RjtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCxXQUFLLDBCQUEwQixNQUFNO0FBQ3BDO0FBQUEsVUFDQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQ3ZCO0FBQUEsWUFDQyxDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxZQUMzRixDQUFDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFBQSxVQUM1RjtBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGLENBQUM7QUFDRCxVQUFNLHFCQUFxQixNQUFNO0FBQ2hDLFdBQUssMEJBQTBCLE1BQU07QUFDcEM7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUFBLFlBQy9GLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUFBLFVBQ2hHO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssMkJBQTJCLE1BQU07QUFDckM7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUFBLFlBQy9GLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUFBLFVBQ2hHO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssb0RBQW9ELE1BQU07QUFDOUQ7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUFBLFlBQy9GLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUFBLFVBQ2hHO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUsscURBQXFELE1BQU07QUFDL0Q7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssb0RBQW9ELE1BQU07QUFDOUQ7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHO0FBQUEsVUFDeEI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUsscURBQXFELE1BQU07QUFDL0Q7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUFBLFlBQy9GLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUFBLFVBQ2hHO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssc0RBQXNELE1BQU07QUFDaEU7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUsscURBQXFELE1BQU07QUFDL0Q7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHO0FBQUEsVUFDeEI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssOEVBQThFLE1BQU07QUFDeEY7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUFBLFlBQy9GLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUFBLFVBQ2hHO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssK0VBQStFLE1BQU07QUFDekY7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHO0FBQUEsVUFDdkI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssOEVBQThFLE1BQU07QUFDeEY7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHO0FBQUEsVUFDeEI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssMkJBQTJCLE1BQU07QUFDckM7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHO0FBQUEsVUFDeEI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUFBLFVBQ2hHO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssMEJBQTBCLE1BQU07QUFDcEM7QUFBQSxVQUNDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDcEIsSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxVQUFHO0FBQUEsVUFDekI7QUFBQSxZQUNDLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUFBLFlBQzNGLENBQUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxH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QUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxNQUM3QjtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHNCQUFzQixNQUFNO0FBQ2hDO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsV0FBVyxLQUFLLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUMxQixXQUFXLEtBQUssR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQzFCLFdBQVcsS0FBSyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDMUIsV0FBVyxLQUFLLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUMxQixXQUFXLEtBQUssR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQzNCO0FBQUEsTUFDQTtBQUFBLFFBQ0MsV0FBVyxLQUFLLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUMxQixXQUFXLEtBQUssR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQzFCLFdBQVcsS0FBSyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDMUIsV0FBVyxLQUFLLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUMzQjtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHNCQUFzQixNQUFNO0FBQ2hDO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsV0FBVyxLQUFLLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUMxQixXQUFXLEtBQUssR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQzFCLFdBQVcsS0FBSyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDMUIsV0FBVyxLQUFLLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUMxQixXQUFXLEtBQUssR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQzNCO0FBQUEsTUFDQSxD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
