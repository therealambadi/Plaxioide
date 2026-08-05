import assert from "assert";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { CoreNavigationCommands } from "../../../../browser/coreCommands.js";
import { Position } from "../../../../common/core/position.js";
import { Range } from "../../../../common/core/range.js";
import { Selection } from "../../../../common/core/selection.js";
import { PieceTreeTextBufferBuilder } from "../../../../common/model/pieceTreeTextBuffer/pieceTreeTextBufferBuilder.js";
import { FindModelBoundToEditorModel } from "../../browser/findModel.js";
import { FindReplaceState } from "../../browser/findState.js";
import { withTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
suite("FindModel", () => {
  let disposables;
  setup(() => {
    disposables = new DisposableStore();
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  function findTest(testName, callback) {
    test(testName, () => {
      const textArr = [
        "// my cool header",
        '#include "cool.h"',
        "#include <iostream>",
        "",
        "int main() {",
        '    cout << "hello world, Hello!" << endl;',
        '    cout << "hello world again" << endl;',
        '    cout << "Hello world again" << endl;',
        '    cout << "helloworld again" << endl;',
        "}",
        "// blablablaciao",
        ""
      ];
      withTestCodeEditor(textArr, {}, (editor) => callback(editor));
      const text = textArr.join("\n");
      const ptBuilder = new PieceTreeTextBufferBuilder();
      ptBuilder.acceptChunk(text.substr(0, 94));
      ptBuilder.acceptChunk(text.substr(94, 101));
      ptBuilder.acceptChunk(text.substr(195, 59));
      const factory = ptBuilder.finish();
      withTestCodeEditor(
        factory,
        {},
        (editor) => callback(editor)
      );
    });
  }
  function fromRange(rng) {
    return [rng.startLineNumber, rng.startColumn, rng.endLineNumber, rng.endColumn];
  }
  function _getFindState(editor) {
    const model = editor.getModel();
    const currentFindMatches = [];
    const allFindMatches = [];
    for (const dec of model.getAllDecorations()) {
      if (dec.options.className === "currentFindMatch") {
        currentFindMatches.push(dec.range);
        allFindMatches.push(dec.range);
      } else if (dec.options.className === "findMatch") {
        allFindMatches.push(dec.range);
      }
    }
    currentFindMatches.sort(Range.compareRangesUsingStarts);
    allFindMatches.sort(Range.compareRangesUsingStarts);
    return {
      highlighted: currentFindMatches.map(fromRange),
      findDecorations: allFindMatches.map(fromRange)
    };
  }
  function assertFindState(editor, cursor, highlighted, findDecorations) {
    assert.deepStrictEqual(fromRange(editor.getSelection()), cursor, "cursor");
    const expectedState = {
      highlighted: highlighted ? [highlighted] : [],
      findDecorations
    };
    assert.deepStrictEqual(_getFindState(editor), expectedState, "state");
  }
  findTest("incremental find from beginning of file", (editor) => {
    editor.setPosition({ lineNumber: 1, column: 1 });
    const findState = disposables.add(new FindReplaceState());
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    findState.change({ searchString: "H" }, true);
    assertFindState(
      editor,
      [1, 12, 1, 13],
      [1, 12, 1, 13],
      [
        [1, 12, 1, 13],
        [2, 16, 2, 17],
        [6, 14, 6, 15],
        [6, 27, 6, 28],
        [7, 14, 7, 15],
        [8, 14, 8, 15],
        [9, 14, 9, 15]
      ]
    );
    findState.change({ searchString: "He" }, true);
    assertFindState(
      editor,
      [1, 12, 1, 14],
      [1, 12, 1, 14],
      [
        [1, 12, 1, 14],
        [6, 14, 6, 16],
        [6, 27, 6, 29],
        [7, 14, 7, 16],
        [8, 14, 8, 16],
        [9, 14, 9, 16]
      ]
    );
    findState.change({ searchString: "Hello" }, true);
    assertFindState(
      editor,
      [6, 14, 6, 19],
      [6, 14, 6, 19],
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19],
        [9, 14, 9, 19]
      ]
    );
    findState.change({ matchCase: true }, true);
    assertFindState(
      editor,
      [6, 27, 6, 32],
      [6, 27, 6, 32],
      [
        [6, 27, 6, 32],
        [8, 14, 8, 19]
      ]
    );
    findState.change({ searchString: "hello" }, true);
    assertFindState(
      editor,
      [6, 14, 6, 19],
      [6, 14, 6, 19],
      [
        [6, 14, 6, 19],
        [7, 14, 7, 19],
        [9, 14, 9, 19]
      ]
    );
    findState.change({ wholeWord: true }, true);
    assertFindState(
      editor,
      [6, 14, 6, 19],
      [6, 14, 6, 19],
      [
        [6, 14, 6, 19],
        [7, 14, 7, 19]
      ]
    );
    findState.change({ matchCase: false }, true);
    assertFindState(
      editor,
      [6, 14, 6, 19],
      [6, 14, 6, 19],
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findState.change({ wholeWord: false }, true);
    assertFindState(
      editor,
      [6, 14, 6, 19],
      [6, 14, 6, 19],
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19],
        [9, 14, 9, 19]
      ]
    );
    findState.change({ searchScope: [new Range(8, 1, 10, 1)] }, true);
    assertFindState(
      editor,
      [8, 14, 8, 19],
      [8, 14, 8, 19],
      [
        [8, 14, 8, 19],
        [9, 14, 9, 19]
      ]
    );
    findState.change({ searchScope: null }, true);
    assertFindState(
      editor,
      [6, 14, 6, 19],
      [6, 14, 6, 19],
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19],
        [9, 14, 9, 19]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("find model removes its decorations", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello" }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assert.strictEqual(findState.matchesCount, 5);
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19],
        [9, 14, 9, 19]
      ]
    );
    findModel.dispose();
    findState.dispose();
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      []
    );
  });
  findTest("find model updates state matchesCount", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello" }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assert.strictEqual(findState.matchesCount, 5);
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19],
        [9, 14, 9, 19]
      ]
    );
    findState.change({ searchString: "helloo" }, false);
    assert.strictEqual(findState.matchesCount, 0);
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      []
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("find model reacts to position change", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello" }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19],
        [9, 14, 9, 19]
      ]
    );
    editor.trigger("mouse", CoreNavigationCommands.MoveTo.id, {
      position: new Position(6, 20)
    });
    assertFindState(
      editor,
      [6, 20, 6, 20],
      null,
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19],
        [9, 14, 9, 19]
      ]
    );
    findState.change({ searchString: "Hello" }, true);
    assertFindState(
      editor,
      [6, 27, 6, 32],
      [6, 27, 6, 32],
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19],
        [9, 14, 9, 19]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("find model next", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello", wholeWord: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [6, 14, 6, 19],
      [6, 14, 6, 19],
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [6, 27, 6, 32],
      [6, 27, 6, 32],
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [7, 14, 7, 19],
      [7, 14, 7, 19],
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [8, 14, 8, 19],
      [8, 14, 8, 19],
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [6, 14, 6, 19],
      [6, 14, 6, 19],
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("find model next stays in scope", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello", wholeWord: true, searchScope: [new Range(7, 1, 9, 1)] }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [7, 14, 7, 19],
      [7, 14, 7, 19],
      [
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [8, 14, 8, 19],
      [8, 14, 8, 19],
      [
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [7, 14, 7, 19],
      [7, 14, 7, 19],
      [
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("multi-selection find model next stays in scope (overlap)", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello", wholeWord: true, searchScope: [new Range(7, 1, 8, 2), new Range(8, 1, 9, 1)] }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [7, 14, 7, 19],
      [7, 14, 7, 19],
      [
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [8, 14, 8, 19],
      [8, 14, 8, 19],
      [
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [7, 14, 7, 19],
      [7, 14, 7, 19],
      [
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("multi-selection find model next stays in scope", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello", matchCase: true, wholeWord: false, searchScope: [new Range(6, 1, 7, 38), new Range(9, 3, 9, 38)] }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 14, 6, 19],
        // `matchCase: false` would
        // find this match as well:
        // [6, 27, 6, 32],
        [7, 14, 7, 19],
        // `wholeWord: true` would
        // exclude this match:
        [9, 14, 9, 19]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [6, 14, 6, 19],
      [6, 14, 6, 19],
      [
        [6, 14, 6, 19],
        [7, 14, 7, 19],
        [9, 14, 9, 19]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [7, 14, 7, 19],
      [7, 14, 7, 19],
      [
        [6, 14, 6, 19],
        [7, 14, 7, 19],
        [9, 14, 9, 19]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [9, 14, 9, 19],
      [9, 14, 9, 19],
      [
        [6, 14, 6, 19],
        [7, 14, 7, 19],
        [9, 14, 9, 19]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [6, 14, 6, 19],
      [6, 14, 6, 19],
      [
        [6, 14, 6, 19],
        [7, 14, 7, 19],
        [9, 14, 9, 19]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("find model prev", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello", wholeWord: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToPrevMatch();
    assertFindState(
      editor,
      [8, 14, 8, 19],
      [8, 14, 8, 19],
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToPrevMatch();
    assertFindState(
      editor,
      [7, 14, 7, 19],
      [7, 14, 7, 19],
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToPrevMatch();
    assertFindState(
      editor,
      [6, 27, 6, 32],
      [6, 27, 6, 32],
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToPrevMatch();
    assertFindState(
      editor,
      [6, 14, 6, 19],
      [6, 14, 6, 19],
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToPrevMatch();
    assertFindState(
      editor,
      [8, 14, 8, 19],
      [8, 14, 8, 19],
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("find model prev stays in scope", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello", wholeWord: true, searchScope: [new Range(7, 1, 9, 1)] }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToPrevMatch();
    assertFindState(
      editor,
      [8, 14, 8, 19],
      [8, 14, 8, 19],
      [
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToPrevMatch();
    assertFindState(
      editor,
      [7, 14, 7, 19],
      [7, 14, 7, 19],
      [
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToPrevMatch();
    assertFindState(
      editor,
      [8, 14, 8, 19],
      [8, 14, 8, 19],
      [
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("find model next/prev with no matches", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "helloo", wholeWord: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      []
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      []
    );
    findModel.moveToPrevMatch();
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      []
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("find model next/prev respects cursor position", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello", wholeWord: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    editor.trigger("mouse", CoreNavigationCommands.MoveTo.id, {
      position: new Position(6, 20)
    });
    assertFindState(
      editor,
      [6, 20, 6, 20],
      null,
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [6, 27, 6, 32],
      [6, 27, 6, 32],
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("find ^", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "^", isRegex: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [1, 1, 1, 1],
        [2, 1, 2, 1],
        [3, 1, 3, 1],
        [4, 1, 4, 1],
        [5, 1, 5, 1],
        [6, 1, 6, 1],
        [7, 1, 7, 1],
        [8, 1, 8, 1],
        [9, 1, 9, 1],
        [10, 1, 10, 1],
        [11, 1, 11, 1],
        [12, 1, 12, 1]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [2, 1, 2, 1],
      [2, 1, 2, 1],
      [
        [1, 1, 1, 1],
        [2, 1, 2, 1],
        [3, 1, 3, 1],
        [4, 1, 4, 1],
        [5, 1, 5, 1],
        [6, 1, 6, 1],
        [7, 1, 7, 1],
        [8, 1, 8, 1],
        [9, 1, 9, 1],
        [10, 1, 10, 1],
        [11, 1, 11, 1],
        [12, 1, 12, 1]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [3, 1, 3, 1],
      [3, 1, 3, 1],
      [
        [1, 1, 1, 1],
        [2, 1, 2, 1],
        [3, 1, 3, 1],
        [4, 1, 4, 1],
        [5, 1, 5, 1],
        [6, 1, 6, 1],
        [7, 1, 7, 1],
        [8, 1, 8, 1],
        [9, 1, 9, 1],
        [10, 1, 10, 1],
        [11, 1, 11, 1],
        [12, 1, 12, 1]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("find $", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "$", isRegex: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [1, 18, 1, 18],
        [2, 18, 2, 18],
        [3, 20, 3, 20],
        [4, 1, 4, 1],
        [5, 13, 5, 13],
        [6, 43, 6, 43],
        [7, 41, 7, 41],
        [8, 41, 8, 41],
        [9, 40, 9, 40],
        [10, 2, 10, 2],
        [11, 17, 11, 17],
        [12, 1, 12, 1]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [1, 18, 1, 18],
      [1, 18, 1, 18],
      [
        [1, 18, 1, 18],
        [2, 18, 2, 18],
        [3, 20, 3, 20],
        [4, 1, 4, 1],
        [5, 13, 5, 13],
        [6, 43, 6, 43],
        [7, 41, 7, 41],
        [8, 41, 8, 41],
        [9, 40, 9, 40],
        [10, 2, 10, 2],
        [11, 17, 11, 17],
        [12, 1, 12, 1]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [2, 18, 2, 18],
      [2, 18, 2, 18],
      [
        [1, 18, 1, 18],
        [2, 18, 2, 18],
        [3, 20, 3, 20],
        [4, 1, 4, 1],
        [5, 13, 5, 13],
        [6, 43, 6, 43],
        [7, 41, 7, 41],
        [8, 41, 8, 41],
        [9, 40, 9, 40],
        [10, 2, 10, 2],
        [11, 17, 11, 17],
        [12, 1, 12, 1]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [3, 20, 3, 20],
      [3, 20, 3, 20],
      [
        [1, 18, 1, 18],
        [2, 18, 2, 18],
        [3, 20, 3, 20],
        [4, 1, 4, 1],
        [5, 13, 5, 13],
        [6, 43, 6, 43],
        [7, 41, 7, 41],
        [8, 41, 8, 41],
        [9, 40, 9, 40],
        [10, 2, 10, 2],
        [11, 17, 11, 17],
        [12, 1, 12, 1]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("find next ^$", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "^$", isRegex: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [4, 1, 4, 1],
        [12, 1, 12, 1]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [4, 1, 4, 1],
      [4, 1, 4, 1],
      [
        [4, 1, 4, 1],
        [12, 1, 12, 1]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [12, 1, 12, 1],
      [12, 1, 12, 1],
      [
        [4, 1, 4, 1],
        [12, 1, 12, 1]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [4, 1, 4, 1],
      [4, 1, 4, 1],
      [
        [4, 1, 4, 1],
        [12, 1, 12, 1]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("find .*", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: ".*", isRegex: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [1, 1, 1, 18],
        [2, 1, 2, 18],
        [3, 1, 3, 20],
        [4, 1, 4, 1],
        [5, 1, 5, 13],
        [6, 1, 6, 43],
        [7, 1, 7, 41],
        [8, 1, 8, 41],
        [9, 1, 9, 40],
        [10, 1, 10, 2],
        [11, 1, 11, 17],
        [12, 1, 12, 1]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("find next ^.*$", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "^.*$", isRegex: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [1, 1, 1, 18],
        [2, 1, 2, 18],
        [3, 1, 3, 20],
        [4, 1, 4, 1],
        [5, 1, 5, 13],
        [6, 1, 6, 43],
        [7, 1, 7, 41],
        [8, 1, 8, 41],
        [9, 1, 9, 40],
        [10, 1, 10, 2],
        [11, 1, 11, 17],
        [12, 1, 12, 1]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [1, 1, 1, 18],
      [1, 1, 1, 18],
      [
        [1, 1, 1, 18],
        [2, 1, 2, 18],
        [3, 1, 3, 20],
        [4, 1, 4, 1],
        [5, 1, 5, 13],
        [6, 1, 6, 43],
        [7, 1, 7, 41],
        [8, 1, 8, 41],
        [9, 1, 9, 40],
        [10, 1, 10, 2],
        [11, 1, 11, 17],
        [12, 1, 12, 1]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [2, 1, 2, 18],
      [2, 1, 2, 18],
      [
        [1, 1, 1, 18],
        [2, 1, 2, 18],
        [3, 1, 3, 20],
        [4, 1, 4, 1],
        [5, 1, 5, 13],
        [6, 1, 6, 43],
        [7, 1, 7, 41],
        [8, 1, 8, 41],
        [9, 1, 9, 40],
        [10, 1, 10, 2],
        [11, 1, 11, 17],
        [12, 1, 12, 1]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("find prev ^.*$", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "^.*$", isRegex: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [1, 1, 1, 18],
        [2, 1, 2, 18],
        [3, 1, 3, 20],
        [4, 1, 4, 1],
        [5, 1, 5, 13],
        [6, 1, 6, 43],
        [7, 1, 7, 41],
        [8, 1, 8, 41],
        [9, 1, 9, 40],
        [10, 1, 10, 2],
        [11, 1, 11, 17],
        [12, 1, 12, 1]
      ]
    );
    findModel.moveToPrevMatch();
    assertFindState(
      editor,
      [12, 1, 12, 1],
      [12, 1, 12, 1],
      [
        [1, 1, 1, 18],
        [2, 1, 2, 18],
        [3, 1, 3, 20],
        [4, 1, 4, 1],
        [5, 1, 5, 13],
        [6, 1, 6, 43],
        [7, 1, 7, 41],
        [8, 1, 8, 41],
        [9, 1, 9, 40],
        [10, 1, 10, 2],
        [11, 1, 11, 17],
        [12, 1, 12, 1]
      ]
    );
    findModel.moveToPrevMatch();
    assertFindState(
      editor,
      [11, 1, 11, 17],
      [11, 1, 11, 17],
      [
        [1, 1, 1, 18],
        [2, 1, 2, 18],
        [3, 1, 3, 20],
        [4, 1, 4, 1],
        [5, 1, 5, 13],
        [6, 1, 6, 43],
        [7, 1, 7, 41],
        [8, 1, 8, 41],
        [9, 1, 9, 40],
        [10, 1, 10, 2],
        [11, 1, 11, 17],
        [12, 1, 12, 1]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("find prev ^$", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "^$", isRegex: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [4, 1, 4, 1],
        [12, 1, 12, 1]
      ]
    );
    findModel.moveToPrevMatch();
    assertFindState(
      editor,
      [12, 1, 12, 1],
      [12, 1, 12, 1],
      [
        [4, 1, 4, 1],
        [12, 1, 12, 1]
      ]
    );
    findModel.moveToPrevMatch();
    assertFindState(
      editor,
      [4, 1, 4, 1],
      [4, 1, 4, 1],
      [
        [4, 1, 4, 1],
        [12, 1, 12, 1]
      ]
    );
    findModel.moveToPrevMatch();
    assertFindState(
      editor,
      [12, 1, 12, 1],
      [12, 1, 12, 1],
      [
        [4, 1, 4, 1],
        [12, 1, 12, 1]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("replace hello", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello", replaceString: "hi", wholeWord: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    editor.trigger("mouse", CoreNavigationCommands.MoveTo.id, {
      position: new Position(6, 20)
    });
    assertFindState(
      editor,
      [6, 20, 6, 20],
      null,
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    assert.strictEqual(editor.getModel().getLineContent(6), '    cout << "hello world, Hello!" << endl;');
    findModel.replace();
    assertFindState(
      editor,
      [6, 27, 6, 32],
      [6, 27, 6, 32],
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    assert.strictEqual(editor.getModel().getLineContent(6), '    cout << "hello world, Hello!" << endl;');
    findModel.replace();
    assertFindState(
      editor,
      [7, 14, 7, 19],
      [7, 14, 7, 19],
      [
        [6, 14, 6, 19],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    assert.strictEqual(editor.getModel().getLineContent(6), '    cout << "hello world, hi!" << endl;');
    findModel.replace();
    assertFindState(
      editor,
      [8, 14, 8, 19],
      [8, 14, 8, 19],
      [
        [6, 14, 6, 19],
        [8, 14, 8, 19]
      ]
    );
    assert.strictEqual(editor.getModel().getLineContent(7), '    cout << "hi world again" << endl;');
    findModel.replace();
    assertFindState(
      editor,
      [6, 14, 6, 19],
      [6, 14, 6, 19],
      [
        [6, 14, 6, 19]
      ]
    );
    assert.strictEqual(editor.getModel().getLineContent(8), '    cout << "hi world again" << endl;');
    findModel.replace();
    assertFindState(
      editor,
      [6, 16, 6, 16],
      null,
      []
    );
    assert.strictEqual(editor.getModel().getLineContent(6), '    cout << "hi world, hi!" << endl;');
    findModel.dispose();
    findState.dispose();
  });
  findTest("replace bla", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "bla", replaceString: "ciao" }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [11, 4, 11, 7],
        [11, 7, 11, 10],
        [11, 10, 11, 13]
      ]
    );
    findModel.replace();
    assertFindState(
      editor,
      [11, 4, 11, 7],
      [11, 4, 11, 7],
      [
        [11, 4, 11, 7],
        [11, 7, 11, 10],
        [11, 10, 11, 13]
      ]
    );
    assert.strictEqual(editor.getModel().getLineContent(11), "// blablablaciao");
    findModel.replace();
    assertFindState(
      editor,
      [11, 8, 11, 11],
      [11, 8, 11, 11],
      [
        [11, 8, 11, 11],
        [11, 11, 11, 14]
      ]
    );
    assert.strictEqual(editor.getModel().getLineContent(11), "// ciaoblablaciao");
    findModel.replace();
    assertFindState(
      editor,
      [11, 12, 11, 15],
      [11, 12, 11, 15],
      [
        [11, 12, 11, 15]
      ]
    );
    assert.strictEqual(editor.getModel().getLineContent(11), "// ciaociaoblaciao");
    findModel.replace();
    assertFindState(
      editor,
      [11, 16, 11, 16],
      null,
      []
    );
    assert.strictEqual(editor.getModel().getLineContent(11), "// ciaociaociaociao");
    findModel.dispose();
    findState.dispose();
  });
  findTest("replaceAll hello", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello", replaceString: "hi", wholeWord: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    editor.trigger("mouse", CoreNavigationCommands.MoveTo.id, {
      position: new Position(6, 20)
    });
    assertFindState(
      editor,
      [6, 20, 6, 20],
      null,
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    assert.strictEqual(editor.getModel().getLineContent(6), '    cout << "hello world, Hello!" << endl;');
    findModel.replaceAll();
    assertFindState(
      editor,
      [6, 17, 6, 17],
      null,
      []
    );
    assert.strictEqual(editor.getModel().getLineContent(6), '    cout << "hi world, hi!" << endl;');
    assert.strictEqual(editor.getModel().getLineContent(7), '    cout << "hi world again" << endl;');
    assert.strictEqual(editor.getModel().getLineContent(8), '    cout << "hi world again" << endl;');
    findModel.dispose();
    findState.dispose();
  });
  findTest("replaceAll two spaces with one space", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "  ", replaceString: " " }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 1, 6, 3],
        [6, 3, 6, 5],
        [7, 1, 7, 3],
        [7, 3, 7, 5],
        [8, 1, 8, 3],
        [8, 3, 8, 5],
        [9, 1, 9, 3],
        [9, 3, 9, 5]
      ]
    );
    findModel.replaceAll();
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 1, 6, 3],
        [7, 1, 7, 3],
        [8, 1, 8, 3],
        [9, 1, 9, 3]
      ]
    );
    assert.strictEqual(editor.getModel().getLineContent(6), '  cout << "hello world, Hello!" << endl;');
    assert.strictEqual(editor.getModel().getLineContent(7), '  cout << "hello world again" << endl;');
    assert.strictEqual(editor.getModel().getLineContent(8), '  cout << "Hello world again" << endl;');
    assert.strictEqual(editor.getModel().getLineContent(9), '  cout << "helloworld again" << endl;');
    findModel.dispose();
    findState.dispose();
  });
  findTest("replaceAll bla", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "bla", replaceString: "ciao" }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [11, 4, 11, 7],
        [11, 7, 11, 10],
        [11, 10, 11, 13]
      ]
    );
    findModel.replaceAll();
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      []
    );
    assert.strictEqual(editor.getModel().getLineContent(11), "// ciaociaociaociao");
    findModel.dispose();
    findState.dispose();
  });
  findTest("replaceAll bla with \\t\\n", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "bla", replaceString: "<\\n\\t>", isRegex: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [11, 4, 11, 7],
        [11, 7, 11, 10],
        [11, 10, 11, 13]
      ]
    );
    findModel.replaceAll();
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      []
    );
    assert.strictEqual(editor.getModel().getLineContent(11), "// <");
    assert.strictEqual(editor.getModel().getLineContent(12), "	><");
    assert.strictEqual(editor.getModel().getLineContent(13), "	><");
    assert.strictEqual(editor.getModel().getLineContent(14), "	>ciao");
    findModel.dispose();
    findState.dispose();
  });
  findTest('issue #3516: "replace all" moves page/cursor/focus/scroll to the place of the last replacement', (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "include", replaceString: "bar" }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [2, 2, 2, 9],
        [3, 2, 3, 9]
      ]
    );
    findModel.replaceAll();
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      []
    );
    assert.strictEqual(editor.getModel().getLineContent(2), '#bar "cool.h"');
    assert.strictEqual(editor.getModel().getLineContent(3), "#bar <iostream>");
    findModel.dispose();
    findState.dispose();
  });
  findTest("listens to model content changes", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello", replaceString: "hi", wholeWord: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    editor.getModel().setValue("hello\nhi");
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      []
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("selectAllMatches", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello", replaceString: "hi", wholeWord: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.selectAllMatches();
    assert.deepStrictEqual(editor.getSelections().map((s) => s.toString()), [
      new Selection(6, 14, 6, 19),
      new Selection(6, 27, 6, 32),
      new Selection(7, 14, 7, 19),
      new Selection(8, 14, 8, 19)
    ].map((s) => s.toString()));
    assertFindState(
      editor,
      [6, 14, 6, 19],
      null,
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("issue #14143 selectAllMatches should maintain primary cursor if feasible", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello", replaceString: "hi", wholeWord: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    editor.setSelection(new Range(7, 14, 7, 19));
    findModel.selectAllMatches();
    assert.deepStrictEqual(editor.getSelections().map((s) => s.toString()), [
      new Selection(7, 14, 7, 19),
      new Selection(6, 14, 6, 19),
      new Selection(6, 27, 6, 32),
      new Selection(8, 14, 8, 19)
    ].map((s) => s.toString()));
    assert.deepStrictEqual(editor.getSelection().toString(), new Selection(7, 14, 7, 19).toString());
    assertFindState(
      editor,
      [7, 14, 7, 19],
      null,
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("issue #1914: NPE when there is only one find match", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "cool.h" }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [2, 11, 2, 17]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [2, 11, 2, 17],
      [2, 11, 2, 17],
      [
        [2, 11, 2, 17]
      ]
    );
    findModel.moveToNextMatch();
    assertFindState(
      editor,
      [2, 11, 2, 17],
      [2, 11, 2, 17],
      [
        [2, 11, 2, 17]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("replace when search string has look ahed regex", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello(?=\\sworld)", replaceString: "hi", isRegex: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 14, 6, 19],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.replace();
    assertFindState(
      editor,
      [6, 14, 6, 19],
      [6, 14, 6, 19],
      [
        [6, 14, 6, 19],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    assert.strictEqual(editor.getModel().getLineContent(6), '    cout << "hello world, Hello!" << endl;');
    findModel.replace();
    assertFindState(
      editor,
      [7, 14, 7, 19],
      [7, 14, 7, 19],
      [
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    assert.strictEqual(editor.getModel().getLineContent(6), '    cout << "hi world, Hello!" << endl;');
    findModel.replace();
    assertFindState(
      editor,
      [8, 14, 8, 19],
      [8, 14, 8, 19],
      [
        [8, 14, 8, 19]
      ]
    );
    assert.strictEqual(editor.getModel().getLineContent(7), '    cout << "hi world again" << endl;');
    findModel.replace();
    assertFindState(
      editor,
      [8, 16, 8, 16],
      null,
      []
    );
    assert.strictEqual(editor.getModel().getLineContent(8), '    cout << "hi world again" << endl;');
    findModel.dispose();
    findState.dispose();
  });
  findTest("replace when search string has look ahed regex and cursor is at the last find match", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello(?=\\sworld)", replaceString: "hi", isRegex: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    editor.trigger("mouse", CoreNavigationCommands.MoveTo.id, {
      position: new Position(8, 14)
    });
    assertFindState(
      editor,
      [8, 14, 8, 14],
      null,
      [
        [6, 14, 6, 19],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.replace();
    assertFindState(
      editor,
      [8, 14, 8, 19],
      [8, 14, 8, 19],
      [
        [6, 14, 6, 19],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    assert.strictEqual(editor.getModel().getLineContent(8), '    cout << "Hello world again" << endl;');
    findModel.replace();
    assertFindState(
      editor,
      [6, 14, 6, 19],
      [6, 14, 6, 19],
      [
        [6, 14, 6, 19],
        [7, 14, 7, 19]
      ]
    );
    assert.strictEqual(editor.getModel().getLineContent(8), '    cout << "hi world again" << endl;');
    findModel.replace();
    assertFindState(
      editor,
      [7, 14, 7, 19],
      [7, 14, 7, 19],
      [
        [7, 14, 7, 19]
      ]
    );
    assert.strictEqual(editor.getModel().getLineContent(6), '    cout << "hi world, Hello!" << endl;');
    findModel.replace();
    assertFindState(
      editor,
      [7, 16, 7, 16],
      null,
      []
    );
    assert.strictEqual(editor.getModel().getLineContent(7), '    cout << "hi world again" << endl;');
    findModel.dispose();
    findState.dispose();
  });
  findTest("replaceAll when search string has look ahed regex", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello(?=\\sworld)", replaceString: "hi", isRegex: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 14, 6, 19],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.replaceAll();
    assert.strictEqual(editor.getModel().getLineContent(6), '    cout << "hi world, Hello!" << endl;');
    assert.strictEqual(editor.getModel().getLineContent(7), '    cout << "hi world again" << endl;');
    assert.strictEqual(editor.getModel().getLineContent(8), '    cout << "hi world again" << endl;');
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      []
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("replace when search string has look ahed regex and replace string has capturing groups", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hel(lo)(?=\\sworld)", replaceString: "hi$1", isRegex: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 14, 6, 19],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.replace();
    assertFindState(
      editor,
      [6, 14, 6, 19],
      [6, 14, 6, 19],
      [
        [6, 14, 6, 19],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    assert.strictEqual(editor.getModel().getLineContent(6), '    cout << "hello world, Hello!" << endl;');
    findModel.replace();
    assertFindState(
      editor,
      [7, 14, 7, 19],
      [7, 14, 7, 19],
      [
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    assert.strictEqual(editor.getModel().getLineContent(6), '    cout << "hilo world, Hello!" << endl;');
    findModel.replace();
    assertFindState(
      editor,
      [8, 14, 8, 19],
      [8, 14, 8, 19],
      [
        [8, 14, 8, 19]
      ]
    );
    assert.strictEqual(editor.getModel().getLineContent(7), '    cout << "hilo world again" << endl;');
    findModel.replace();
    assertFindState(
      editor,
      [8, 18, 8, 18],
      null,
      []
    );
    assert.strictEqual(editor.getModel().getLineContent(8), '    cout << "hilo world again" << endl;');
    findModel.dispose();
    findState.dispose();
  });
  findTest("replaceAll when search string has look ahed regex and replace string has capturing groups", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "wo(rl)d(?=.*;$)", replaceString: "gi$1", isRegex: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 20, 6, 25],
        [7, 20, 7, 25],
        [8, 20, 8, 25],
        [9, 19, 9, 24]
      ]
    );
    findModel.replaceAll();
    assert.strictEqual(editor.getModel().getLineContent(6), '    cout << "hello girl, Hello!" << endl;');
    assert.strictEqual(editor.getModel().getLineContent(7), '    cout << "hello girl again" << endl;');
    assert.strictEqual(editor.getModel().getLineContent(8), '    cout << "Hello girl again" << endl;');
    assert.strictEqual(editor.getModel().getLineContent(9), '    cout << "hellogirl again" << endl;');
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      []
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("replaceAll when search string is multiline and has look ahed regex and replace string has capturing groups", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "wo(rl)d(.*;\\n)(?=.*hello)", replaceString: "gi$1$2", isRegex: true, matchCase: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 20, 7, 1],
        [8, 20, 9, 1]
      ]
    );
    findModel.replaceAll();
    assert.strictEqual(editor.getModel().getLineContent(6), '    cout << "hello girl, Hello!" << endl;');
    assert.strictEqual(editor.getModel().getLineContent(8), '    cout << "Hello girl again" << endl;');
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      []
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("replaceAll preserving case", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello", replaceString: "goodbye", isRegex: false, matchCase: false, preserveCase: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19],
        [9, 14, 9, 19]
      ]
    );
    findModel.replaceAll();
    assert.strictEqual(editor.getModel().getLineContent(6), '    cout << "goodbye world, Goodbye!" << endl;');
    assert.strictEqual(editor.getModel().getLineContent(7), '    cout << "goodbye world again" << endl;');
    assert.strictEqual(editor.getModel().getLineContent(8), '    cout << "Goodbye world again" << endl;');
    assert.strictEqual(editor.getModel().getLineContent(9), '    cout << "goodbyeworld again" << endl;');
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      []
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest("issue #18711 replaceAll with empty string", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello", replaceString: "", wholeWord: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 14, 6, 19],
        [6, 27, 6, 32],
        [7, 14, 7, 19],
        [8, 14, 8, 19]
      ]
    );
    findModel.replaceAll();
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      []
    );
    assert.strictEqual(editor.getModel().getLineContent(6), '    cout << " world, !" << endl;');
    assert.strictEqual(editor.getModel().getLineContent(7), '    cout << " world again" << endl;');
    assert.strictEqual(editor.getModel().getLineContent(8), '    cout << " world again" << endl;');
    findModel.dispose();
    findState.dispose();
  });
  findTest("issue #32522 replaceAll with ^ on more than 1000 matches", (editor) => {
    let initialText = "";
    for (let i = 0; i < 1100; i++) {
      initialText += "line" + i + "\n";
    }
    editor.getModel().setValue(initialText);
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "^", replaceString: "a ", isRegex: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    findModel.replaceAll();
    let expectedText = "";
    for (let i = 0; i < 1100; i++) {
      expectedText += "a line" + i + "\n";
    }
    expectedText += "a ";
    assert.strictEqual(editor.getModel().getValue(), expectedText);
    findModel.dispose();
    findState.dispose();
  });
  findTest("issue #19740 Find and replace capture group/backreference inserts `undefined` instead of empty string", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello(z)?", replaceString: "hi$1", isRegex: true, matchCase: true }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [6, 14, 6, 19],
        [7, 14, 7, 19],
        [9, 14, 9, 19]
      ]
    );
    findModel.replaceAll();
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      []
    );
    assert.strictEqual(editor.getModel().getLineContent(6), '    cout << "hi world, Hello!" << endl;');
    assert.strictEqual(editor.getModel().getLineContent(7), '    cout << "hi world again" << endl;');
    assert.strictEqual(editor.getModel().getLineContent(9), '    cout << "hiworld again" << endl;');
    findModel.dispose();
    findState.dispose();
  });
  findTest("issue #27083. search scope works even if it is a single line", (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello", wholeWord: true, searchScope: [new Range(7, 1, 8, 1)] }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assertFindState(
      editor,
      [1, 1, 1, 1],
      null,
      [
        [7, 14, 7, 19]
      ]
    );
    findModel.dispose();
    findState.dispose();
  });
  findTest('issue #3516: Control behavior of "Next" operations (not looping back to beginning)', (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello", loop: false }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assert.strictEqual(findState.matchesCount, 5);
    assert.strictEqual(findState.matchesPosition, 0);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToNextMatch();
    assert.strictEqual(findState.matchesPosition, 1);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), false);
    findModel.moveToNextMatch();
    assert.strictEqual(findState.matchesPosition, 2);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToNextMatch();
    assert.strictEqual(findState.matchesPosition, 3);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToNextMatch();
    assert.strictEqual(findState.matchesPosition, 4);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToNextMatch();
    assert.strictEqual(findState.matchesPosition, 5);
    assert.strictEqual(findState.canNavigateForward(), false);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToNextMatch();
    assert.strictEqual(findState.matchesPosition, 5);
    assert.strictEqual(findState.canNavigateForward(), false);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToNextMatch();
    assert.strictEqual(findState.matchesPosition, 5);
    assert.strictEqual(findState.canNavigateForward(), false);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToPrevMatch();
    assert.strictEqual(findState.matchesPosition, 4);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToPrevMatch();
    assert.strictEqual(findState.matchesPosition, 3);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToPrevMatch();
    assert.strictEqual(findState.matchesPosition, 2);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToPrevMatch();
    assert.strictEqual(findState.matchesPosition, 1);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), false);
    findModel.moveToPrevMatch();
    assert.strictEqual(findState.matchesPosition, 1);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), false);
    findModel.moveToPrevMatch();
    assert.strictEqual(findState.matchesPosition, 1);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), false);
  });
  findTest('issue #3516: Control behavior of "Next" operations (looping back to beginning)', (editor) => {
    const findState = disposables.add(new FindReplaceState());
    findState.change({ searchString: "hello" }, false);
    const findModel = disposables.add(new FindModelBoundToEditorModel(editor, findState));
    assert.strictEqual(findState.matchesCount, 5);
    assert.strictEqual(findState.matchesPosition, 0);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToNextMatch();
    assert.strictEqual(findState.matchesPosition, 1);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToNextMatch();
    assert.strictEqual(findState.matchesPosition, 2);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToNextMatch();
    assert.strictEqual(findState.matchesPosition, 3);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToNextMatch();
    assert.strictEqual(findState.matchesPosition, 4);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToNextMatch();
    assert.strictEqual(findState.matchesPosition, 5);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToNextMatch();
    assert.strictEqual(findState.matchesPosition, 1);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToNextMatch();
    assert.strictEqual(findState.matchesPosition, 2);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToPrevMatch();
    assert.strictEqual(findState.matchesPosition, 1);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToPrevMatch();
    assert.strictEqual(findState.matchesPosition, 5);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToPrevMatch();
    assert.strictEqual(findState.matchesPosition, 4);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToPrevMatch();
    assert.strictEqual(findState.matchesPosition, 3);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToPrevMatch();
    assert.strictEqual(findState.matchesPosition, 2);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
    findModel.moveToPrevMatch();
    assert.strictEqual(findState.matchesPosition, 1);
    assert.strictEqual(findState.canNavigateForward(), true);
    assert.strictEqual(findState.canNavigateBack(), true);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9maW5kL3Rlc3QvYnJvd3Nlci9maW5kTW9kZWwudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL2NvcmVDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQWN0aXZlQ29kZUVkaXRvciwgSUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBQaWVjZVRyZWVUZXh0QnVmZmVyQnVpbGRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9tb2RlbC9waWVjZVRyZWVUZXh0QnVmZmVyL3BpZWNlVHJlZVRleHRCdWZmZXJCdWlsZGVyLmpzJztcbmltcG9ydCB7IEZpbmRNb2RlbEJvdW5kVG9FZGl0b3JNb2RlbCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvZmluZE1vZGVsLmpzJztcbmltcG9ydCB7IEZpbmRSZXBsYWNlU3RhdGUgfSBmcm9tICcuLi8uLi9icm93c2VyL2ZpbmRTdGF0ZS5qcyc7XG5pbXBvcnQgeyB3aXRoVGVzdENvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvdGVzdENvZGVFZGl0b3IuanMnO1xuXG5zdWl0ZSgnRmluZE1vZGVsJywgKCkgPT4ge1xuXG5cdGxldCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xuXG5cdHNldHVwKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0ZnVuY3Rpb24gZmluZFRlc3QodGVzdE5hbWU6IHN0cmluZywgY2FsbGJhY2s6IChlZGl0b3I6IElBY3RpdmVDb2RlRWRpdG9yKSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0dGVzdCh0ZXN0TmFtZSwgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGV4dEFyciA9IFtcblx0XHRcdFx0Jy8vIG15IGNvb2wgaGVhZGVyJyxcblx0XHRcdFx0JyNpbmNsdWRlIFwiY29vbC5oXCInLFxuXHRcdFx0XHQnI2luY2x1ZGUgPGlvc3RyZWFtPicsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnaW50IG1haW4oKSB7Jyxcblx0XHRcdFx0JyAgICBjb3V0IDw8IFwiaGVsbG8gd29ybGQsIEhlbGxvIVwiIDw8IGVuZGw7Jyxcblx0XHRcdFx0JyAgICBjb3V0IDw8IFwiaGVsbG8gd29ybGQgYWdhaW5cIiA8PCBlbmRsOycsXG5cdFx0XHRcdCcgICAgY291dCA8PCBcIkhlbGxvIHdvcmxkIGFnYWluXCIgPDwgZW5kbDsnLFxuXHRcdFx0XHQnICAgIGNvdXQgPDwgXCJoZWxsb3dvcmxkIGFnYWluXCIgPDwgZW5kbDsnLFxuXHRcdFx0XHQnfScsXG5cdFx0XHRcdCcvLyBibGFibGFibGFjaWFvJyxcblx0XHRcdFx0Jydcblx0XHRcdF07XG5cdFx0XHR3aXRoVGVzdENvZGVFZGl0b3IodGV4dEFyciwge30sIChlZGl0b3IpID0+IGNhbGxiYWNrKGVkaXRvciBhcyBJQWN0aXZlQ29kZUVkaXRvcikpO1xuXG5cdFx0XHRjb25zdCB0ZXh0ID0gdGV4dEFyci5qb2luKCdcXG4nKTtcblx0XHRcdGNvbnN0IHB0QnVpbGRlciA9IG5ldyBQaWVjZVRyZWVUZXh0QnVmZmVyQnVpbGRlcigpO1xuXHRcdFx0cHRCdWlsZGVyLmFjY2VwdENodW5rKHRleHQuc3Vic3RyKDAsIDk0KSk7XG5cdFx0XHRwdEJ1aWxkZXIuYWNjZXB0Q2h1bmsodGV4dC5zdWJzdHIoOTQsIDEwMSkpO1xuXHRcdFx0cHRCdWlsZGVyLmFjY2VwdENodW5rKHRleHQuc3Vic3RyKDE5NSwgNTkpKTtcblx0XHRcdGNvbnN0IGZhY3RvcnkgPSBwdEJ1aWxkZXIuZmluaXNoKCk7XG5cdFx0XHR3aXRoVGVzdENvZGVFZGl0b3IoXG5cdFx0XHRcdGZhY3RvcnksXG5cdFx0XHRcdHt9LFxuXHRcdFx0XHQoZWRpdG9yKSA9PiBjYWxsYmFjayhlZGl0b3IgYXMgSUFjdGl2ZUNvZGVFZGl0b3IpXG5cdFx0XHQpO1xuXHRcdH0pO1xuXHR9XG5cblx0ZnVuY3Rpb24gZnJvbVJhbmdlKHJuZzogUmFuZ2UpOiBudW1iZXJbXSB7XG5cdFx0cmV0dXJuIFtybmcuc3RhcnRMaW5lTnVtYmVyLCBybmcuc3RhcnRDb2x1bW4sIHJuZy5lbmRMaW5lTnVtYmVyLCBybmcuZW5kQ29sdW1uXTtcblx0fVxuXG5cdGZ1bmN0aW9uIF9nZXRGaW5kU3RhdGUoZWRpdG9yOiBJQ29kZUVkaXRvcikge1xuXHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCkhO1xuXHRcdGNvbnN0IGN1cnJlbnRGaW5kTWF0Y2hlczogUmFuZ2VbXSA9IFtdO1xuXHRcdGNvbnN0IGFsbEZpbmRNYXRjaGVzOiBSYW5nZVtdID0gW107XG5cblx0XHRmb3IgKGNvbnN0IGRlYyBvZiBtb2RlbC5nZXRBbGxEZWNvcmF0aW9ucygpKSB7XG5cdFx0XHRpZiAoZGVjLm9wdGlvbnMuY2xhc3NOYW1lID09PSAnY3VycmVudEZpbmRNYXRjaCcpIHtcblx0XHRcdFx0Y3VycmVudEZpbmRNYXRjaGVzLnB1c2goZGVjLnJhbmdlKTtcblx0XHRcdFx0YWxsRmluZE1hdGNoZXMucHVzaChkZWMucmFuZ2UpO1xuXHRcdFx0fSBlbHNlIGlmIChkZWMub3B0aW9ucy5jbGFzc05hbWUgPT09ICdmaW5kTWF0Y2gnKSB7XG5cdFx0XHRcdGFsbEZpbmRNYXRjaGVzLnB1c2goZGVjLnJhbmdlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjdXJyZW50RmluZE1hdGNoZXMuc29ydChSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMpO1xuXHRcdGFsbEZpbmRNYXRjaGVzLnNvcnQoUmFuZ2UuY29tcGFyZVJhbmdlc1VzaW5nU3RhcnRzKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRoaWdobGlnaHRlZDogY3VycmVudEZpbmRNYXRjaGVzLm1hcChmcm9tUmFuZ2UpLFxuXHRcdFx0ZmluZERlY29yYXRpb25zOiBhbGxGaW5kTWF0Y2hlcy5tYXAoZnJvbVJhbmdlKVxuXHRcdH07XG5cdH1cblxuXHRmdW5jdGlvbiBhc3NlcnRGaW5kU3RhdGUoZWRpdG9yOiBJQ29kZUVkaXRvciwgY3Vyc29yOiBudW1iZXJbXSwgaGlnaGxpZ2h0ZWQ6IG51bWJlcltdIHwgbnVsbCwgZmluZERlY29yYXRpb25zOiBudW1iZXJbXVtdKTogdm9pZCB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmcm9tUmFuZ2UoZWRpdG9yLmdldFNlbGVjdGlvbigpISksIGN1cnNvciwgJ2N1cnNvcicpO1xuXG5cdFx0Y29uc3QgZXhwZWN0ZWRTdGF0ZSA9IHtcblx0XHRcdGhpZ2hsaWdodGVkOiBoaWdobGlnaHRlZCA/IFtoaWdobGlnaHRlZF0gOiBbXSxcblx0XHRcdGZpbmREZWNvcmF0aW9uczogZmluZERlY29yYXRpb25zXG5cdFx0fTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKF9nZXRGaW5kU3RhdGUoZWRpdG9yKSwgZXhwZWN0ZWRTdGF0ZSwgJ3N0YXRlJyk7XG5cdH1cblxuXHRmaW5kVGVzdCgnaW5jcmVtZW50YWwgZmluZCBmcm9tIGJlZ2lubmluZyBvZiBmaWxlJywgKGVkaXRvcikgPT4ge1xuXHRcdGVkaXRvci5zZXRQb3NpdGlvbih7IGxpbmVOdW1iZXI6IDEsIGNvbHVtbjogMSB9KTtcblx0XHRjb25zdCBmaW5kU3RhdGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0Y29uc3QgZmluZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kTW9kZWxCb3VuZFRvRWRpdG9yTW9kZWwoZWRpdG9yLCBmaW5kU3RhdGUpKTtcblxuXHRcdC8vIHNpbXVsYXRlIHR5cGluZyB0aGUgc2VhcmNoIHN0cmluZ1xuXHRcdGZpbmRTdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTdHJpbmc6ICdIJyB9LCB0cnVlKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbMSwgMTIsIDEsIDEzXSxcblx0XHRcdFsxLCAxMiwgMSwgMTNdLFxuXHRcdFx0W1xuXHRcdFx0XHRbMSwgMTIsIDEsIDEzXSxcblx0XHRcdFx0WzIsIDE2LCAyLCAxN10sXG5cdFx0XHRcdFs2LCAxNCwgNiwgMTVdLFxuXHRcdFx0XHRbNiwgMjcsIDYsIDI4XSxcblx0XHRcdFx0WzcsIDE0LCA3LCAxNV0sXG5cdFx0XHRcdFs4LCAxNCwgOCwgMTVdLFxuXHRcdFx0XHRbOSwgMTQsIDksIDE1XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHQvLyBzaW11bGF0ZSB0eXBpbmcgdGhlIHNlYXJjaCBzdHJpbmdcblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgc2VhcmNoU3RyaW5nOiAnSGUnIH0sIHRydWUpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxMiwgMSwgMTRdLFxuXHRcdFx0WzEsIDEyLCAxLCAxNF0sXG5cdFx0XHRbXG5cdFx0XHRcdFsxLCAxMiwgMSwgMTRdLFxuXHRcdFx0XHRbNiwgMTQsIDYsIDE2XSxcblx0XHRcdFx0WzYsIDI3LCA2LCAyOV0sXG5cdFx0XHRcdFs3LCAxNCwgNywgMTZdLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE2XSxcblx0XHRcdFx0WzksIDE0LCA5LCAxNl1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0Ly8gc2ltdWxhdGUgdHlwaW5nIHRoZSBzZWFyY2ggc3RyaW5nXG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ0hlbGxvJyB9LCB0cnVlKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0W1xuXHRcdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFx0WzYsIDI3LCA2LCAzMl0sXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XSxcblx0XHRcdFx0WzksIDE0LCA5LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0Ly8gc2ltdWxhdGUgdG9nZ2xpbmcgb24gYG1hdGNoQ2FzZWBcblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgbWF0Y2hDYXNlOiB0cnVlIH0sIHRydWUpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFs2LCAyNywgNiwgMzJdLFxuXHRcdFx0WzYsIDI3LCA2LCAzMl0sXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAyNywgNiwgMzJdLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHQvLyBzaW11bGF0ZSB0eXBpbmcgdGhlIHNlYXJjaCBzdHJpbmdcblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgc2VhcmNoU3RyaW5nOiAnaGVsbG8nIH0sIHRydWUpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzksIDE0LCA5LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0Ly8gc2ltdWxhdGUgdG9nZ2xpbmcgb24gYHdob2xlV29yZGBcblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgd2hvbGVXb3JkOiB0cnVlIH0sIHRydWUpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHQvLyBzaW11bGF0ZSB0b2dnbGluZyBvZmYgYG1hdGNoQ2FzZWBcblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgbWF0Y2hDYXNlOiBmYWxzZSB9LCB0cnVlKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0W1xuXHRcdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFx0WzYsIDI3LCA2LCAzMl0sXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHQvLyBzaW11bGF0ZSB0b2dnbGluZyBvZmYgYHdob2xlV29yZGBcblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgd2hvbGVXb3JkOiBmYWxzZSB9LCB0cnVlKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0W1xuXHRcdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFx0WzYsIDI3LCA2LCAzMl0sXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XSxcblx0XHRcdFx0WzksIDE0LCA5LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0Ly8gc2ltdWxhdGUgYWRkaW5nIGEgc2VhcmNoIHNjb3BlXG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFNjb3BlOiBbbmV3IFJhbmdlKDgsIDEsIDEwLCAxKV0gfSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzgsIDE0LCA4LCAxOV0sXG5cdFx0XHRbOCwgMTQsIDgsIDE5XSxcblx0XHRcdFtcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV0sXG5cdFx0XHRcdFs5LCAxNCwgOSwgMTldXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdC8vIHNpbXVsYXRlIHJlbW92aW5nIHRoZSBzZWFyY2ggc2NvcGVcblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgc2VhcmNoU2NvcGU6IG51bGwgfSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs2LCAyNywgNiwgMzJdLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV0sXG5cdFx0XHRcdFs5LCAxNCwgOSwgMTldXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0ZmluZFN0YXRlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZmluZFRlc3QoJ2ZpbmQgbW9kZWwgcmVtb3ZlcyBpdHMgZGVjb3JhdGlvbnMnLCAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgZmluZFN0YXRlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kUmVwbGFjZVN0YXRlKCkpO1xuXHRcdGZpbmRTdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTdHJpbmc6ICdoZWxsbycgfSwgZmFsc2UpO1xuXHRcdGNvbnN0IGZpbmRNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZE1vZGVsQm91bmRUb0VkaXRvck1vZGVsKGVkaXRvciwgZmluZFN0YXRlKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLm1hdGNoZXNDb3VudCwgNSk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzEsIDEsIDEsIDFdLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs2LCAyNywgNiwgMzJdLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV0sXG5cdFx0XHRcdFs5LCAxNCwgOSwgMTldXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0ZmluZFN0YXRlLmRpc3Bvc2UoKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXVxuXHRcdCk7XG5cdH0pO1xuXG5cdGZpbmRUZXN0KCdmaW5kIG1vZGVsIHVwZGF0ZXMgc3RhdGUgbWF0Y2hlc0NvdW50JywgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IGZpbmRTdGF0ZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZFJlcGxhY2VTdGF0ZSgpKTtcblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgc2VhcmNoU3RyaW5nOiAnaGVsbG8nIH0sIGZhbHNlKTtcblx0XHRjb25zdCBmaW5kTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRNb2RlbEJvdW5kVG9FZGl0b3JNb2RlbChlZGl0b3IsIGZpbmRTdGF0ZSkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5tYXRjaGVzQ291bnQsIDUpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0XHRbNiwgMjcsIDYsIDMyXSxcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdFs4LCAxNCwgOCwgMTldLFxuXHRcdFx0XHRbOSwgMTQsIDksIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgc2VhcmNoU3RyaW5nOiAnaGVsbG9vJyB9LCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5tYXRjaGVzQ291bnQsIDApO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwuZGlzcG9zZSgpO1xuXHRcdGZpbmRTdGF0ZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGZpbmRUZXN0KCdmaW5kIG1vZGVsIHJlYWN0cyB0byBwb3NpdGlvbiBjaGFuZ2UnLCAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgZmluZFN0YXRlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kUmVwbGFjZVN0YXRlKCkpO1xuXHRcdGZpbmRTdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTdHJpbmc6ICdoZWxsbycgfSwgZmFsc2UpO1xuXHRcdGNvbnN0IGZpbmRNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZE1vZGVsQm91bmRUb0VkaXRvck1vZGVsKGVkaXRvciwgZmluZFN0YXRlKSk7XG5cblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbMSwgMSwgMSwgMV0sXG5cdFx0XHRudWxsLFxuXHRcdFx0W1xuXHRcdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFx0WzYsIDI3LCA2LCAzMl0sXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XSxcblx0XHRcdFx0WzksIDE0LCA5LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ21vdXNlJywgQ29yZU5hdmlnYXRpb25Db21tYW5kcy5Nb3ZlVG8uaWQsIHtcblx0XHRcdHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oNiwgMjApXG5cdFx0fSk7XG5cblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbNiwgMjAsIDYsIDIwXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0XHRbNiwgMjcsIDYsIDMyXSxcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdFs4LCAxNCwgOCwgMTldLFxuXHRcdFx0XHRbOSwgMTQsIDksIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgc2VhcmNoU3RyaW5nOiAnSGVsbG8nIH0sIHRydWUpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFs2LCAyNywgNiwgMzJdLFxuXHRcdFx0WzYsIDI3LCA2LCAzMl0sXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0XHRbNiwgMjcsIDYsIDMyXSxcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdFs4LCAxNCwgOCwgMTldLFxuXHRcdFx0XHRbOSwgMTQsIDksIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwuZGlzcG9zZSgpO1xuXHRcdGZpbmRTdGF0ZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGZpbmRUZXN0KCdmaW5kIG1vZGVsIG5leHQnLCAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgZmluZFN0YXRlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kUmVwbGFjZVN0YXRlKCkpO1xuXHRcdGZpbmRTdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTdHJpbmc6ICdoZWxsbycsIHdob2xlV29yZDogdHJ1ZSB9LCBmYWxzZSk7XG5cdFx0Y29uc3QgZmluZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kTW9kZWxCb3VuZFRvRWRpdG9yTW9kZWwoZWRpdG9yLCBmaW5kU3RhdGUpKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0XHRbNiwgMjcsIDYsIDMyXSxcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdFs4LCAxNCwgOCwgMTldXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9OZXh0TWF0Y2goKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0W1xuXHRcdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFx0WzYsIDI3LCA2LCAzMl0sXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvTmV4dE1hdGNoKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzYsIDI3LCA2LCAzMl0sXG5cdFx0XHRbNiwgMjcsIDYsIDMyXSxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs2LCAyNywgNiwgMzJdLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLm1vdmVUb05leHRNYXRjaCgpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0XHRbNiwgMjcsIDYsIDMyXSxcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdFs4LCAxNCwgOCwgMTldXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9OZXh0TWF0Y2goKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbOCwgMTQsIDgsIDE5XSxcblx0XHRcdFs4LCAxNCwgOCwgMTldLFxuXHRcdFx0W1xuXHRcdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFx0WzYsIDI3LCA2LCAzMl0sXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvTmV4dE1hdGNoKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs2LCAyNywgNiwgMzJdLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLmRpc3Bvc2UoKTtcblx0XHRmaW5kU3RhdGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRmaW5kVGVzdCgnZmluZCBtb2RlbCBuZXh0IHN0YXlzIGluIHNjb3BlJywgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IGZpbmRTdGF0ZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZFJlcGxhY2VTdGF0ZSgpKTtcblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgc2VhcmNoU3RyaW5nOiAnaGVsbG8nLCB3aG9sZVdvcmQ6IHRydWUsIHNlYXJjaFNjb3BlOiBbbmV3IFJhbmdlKDcsIDEsIDksIDEpXSB9LCBmYWxzZSk7XG5cdFx0Y29uc3QgZmluZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kTW9kZWxCb3VuZFRvRWRpdG9yTW9kZWwoZWRpdG9yLCBmaW5kU3RhdGUpKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvTmV4dE1hdGNoKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFtcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdFs4LCAxNCwgOCwgMTldXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9OZXh0TWF0Y2goKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbOCwgMTQsIDgsIDE5XSxcblx0XHRcdFs4LCAxNCwgOCwgMTldLFxuXHRcdFx0W1xuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLm1vdmVUb05leHRNYXRjaCgpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRbXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwuZGlzcG9zZSgpO1xuXHRcdGZpbmRTdGF0ZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGZpbmRUZXN0KCdtdWx0aS1zZWxlY3Rpb24gZmluZCBtb2RlbCBuZXh0IHN0YXlzIGluIHNjb3BlIChvdmVybGFwKScsIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBmaW5kU3RhdGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ2hlbGxvJywgd2hvbGVXb3JkOiB0cnVlLCBzZWFyY2hTY29wZTogW25ldyBSYW5nZSg3LCAxLCA4LCAyKSwgbmV3IFJhbmdlKDgsIDEsIDksIDEpXSB9LCBmYWxzZSk7XG5cdFx0Y29uc3QgZmluZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kTW9kZWxCb3VuZFRvRWRpdG9yTW9kZWwoZWRpdG9yLCBmaW5kU3RhdGUpKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvTmV4dE1hdGNoKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFtcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdFs4LCAxNCwgOCwgMTldXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9OZXh0TWF0Y2goKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbOCwgMTQsIDgsIDE5XSxcblx0XHRcdFs4LCAxNCwgOCwgMTldLFxuXHRcdFx0W1xuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLm1vdmVUb05leHRNYXRjaCgpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRbXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwuZGlzcG9zZSgpO1xuXHRcdGZpbmRTdGF0ZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGZpbmRUZXN0KCdtdWx0aS1zZWxlY3Rpb24gZmluZCBtb2RlbCBuZXh0IHN0YXlzIGluIHNjb3BlJywgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IGZpbmRTdGF0ZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZFJlcGxhY2VTdGF0ZSgpKTtcblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgc2VhcmNoU3RyaW5nOiAnaGVsbG8nLCBtYXRjaENhc2U6IHRydWUsIHdob2xlV29yZDogZmFsc2UsIHNlYXJjaFNjb3BlOiBbbmV3IFJhbmdlKDYsIDEsIDcsIDM4KSwgbmV3IFJhbmdlKDksIDMsIDksIDM4KV0gfSwgZmFsc2UpO1xuXHRcdGNvbnN0IGZpbmRNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZE1vZGVsQm91bmRUb0VkaXRvck1vZGVsKGVkaXRvciwgZmluZFN0YXRlKSk7XG5cblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbMSwgMSwgMSwgMV0sXG5cdFx0XHRudWxsLFxuXHRcdFx0W1xuXHRcdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFx0Ly8gYG1hdGNoQ2FzZTogZmFsc2VgIHdvdWxkXG5cdFx0XHRcdC8vIGZpbmQgdGhpcyBtYXRjaCBhcyB3ZWxsOlxuXHRcdFx0XHQvLyBbNiwgMjcsIDYsIDMyXSxcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdC8vIGB3aG9sZVdvcmQ6IHRydWVgIHdvdWxkXG5cdFx0XHRcdC8vIGV4Y2x1ZGUgdGhpcyBtYXRjaDpcblx0XHRcdFx0WzksIDE0LCA5LCAxOV0sXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9OZXh0TWF0Y2goKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0W1xuXHRcdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdFs5LCAxNCwgOSwgMTldLFxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvTmV4dE1hdGNoKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOSwgMTQsIDksIDE5XSxcblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLm1vdmVUb05leHRNYXRjaCgpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFs5LCAxNCwgOSwgMTldLFxuXHRcdFx0WzksIDE0LCA5LCAxOV0sXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzksIDE0LCA5LCAxOV0sXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9OZXh0TWF0Y2goKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0W1xuXHRcdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdFs5LCAxNCwgOSwgMTldLFxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwuZGlzcG9zZSgpO1xuXHRcdGZpbmRTdGF0ZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGZpbmRUZXN0KCdmaW5kIG1vZGVsIHByZXYnLCAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgZmluZFN0YXRlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kUmVwbGFjZVN0YXRlKCkpO1xuXHRcdGZpbmRTdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTdHJpbmc6ICdoZWxsbycsIHdob2xlV29yZDogdHJ1ZSB9LCBmYWxzZSk7XG5cdFx0Y29uc3QgZmluZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kTW9kZWxCb3VuZFRvRWRpdG9yTW9kZWwoZWRpdG9yLCBmaW5kU3RhdGUpKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0XHRbNiwgMjcsIDYsIDMyXSxcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdFs4LCAxNCwgOCwgMTldXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9QcmV2TWF0Y2goKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbOCwgMTQsIDgsIDE5XSxcblx0XHRcdFs4LCAxNCwgOCwgMTldLFxuXHRcdFx0W1xuXHRcdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFx0WzYsIDI3LCA2LCAzMl0sXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvUHJldk1hdGNoKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs2LCAyNywgNiwgMzJdLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLm1vdmVUb1ByZXZNYXRjaCgpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFs2LCAyNywgNiwgMzJdLFxuXHRcdFx0WzYsIDI3LCA2LCAzMl0sXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0XHRbNiwgMjcsIDYsIDMyXSxcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdFs4LCAxNCwgOCwgMTldXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9QcmV2TWF0Y2goKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0W1xuXHRcdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFx0WzYsIDI3LCA2LCAzMl0sXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvUHJldk1hdGNoKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzgsIDE0LCA4LCAxOV0sXG5cdFx0XHRbOCwgMTQsIDgsIDE5XSxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs2LCAyNywgNiwgMzJdLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLmRpc3Bvc2UoKTtcblx0XHRmaW5kU3RhdGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRmaW5kVGVzdCgnZmluZCBtb2RlbCBwcmV2IHN0YXlzIGluIHNjb3BlJywgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IGZpbmRTdGF0ZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZFJlcGxhY2VTdGF0ZSgpKTtcblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgc2VhcmNoU3RyaW5nOiAnaGVsbG8nLCB3aG9sZVdvcmQ6IHRydWUsIHNlYXJjaFNjb3BlOiBbbmV3IFJhbmdlKDcsIDEsIDksIDEpXSB9LCBmYWxzZSk7XG5cdFx0Y29uc3QgZmluZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kTW9kZWxCb3VuZFRvRWRpdG9yTW9kZWwoZWRpdG9yLCBmaW5kU3RhdGUpKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvUHJldk1hdGNoKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzgsIDE0LCA4LCAxOV0sXG5cdFx0XHRbOCwgMTQsIDgsIDE5XSxcblx0XHRcdFtcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdFs4LCAxNCwgOCwgMTldXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9QcmV2TWF0Y2goKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0W1xuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLm1vdmVUb1ByZXZNYXRjaCgpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFs4LCAxNCwgOCwgMTldLFxuXHRcdFx0WzgsIDE0LCA4LCAxOV0sXG5cdFx0XHRbXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwuZGlzcG9zZSgpO1xuXHRcdGZpbmRTdGF0ZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGZpbmRUZXN0KCdmaW5kIG1vZGVsIG5leHQvcHJldiB3aXRoIG5vIG1hdGNoZXMnLCAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgZmluZFN0YXRlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kUmVwbGFjZVN0YXRlKCkpO1xuXHRcdGZpbmRTdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTdHJpbmc6ICdoZWxsb28nLCB3aG9sZVdvcmQ6IHRydWUgfSwgZmFsc2UpO1xuXHRcdGNvbnN0IGZpbmRNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZE1vZGVsQm91bmRUb0VkaXRvck1vZGVsKGVkaXRvciwgZmluZFN0YXRlKSk7XG5cblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbMSwgMSwgMSwgMV0sXG5cdFx0XHRudWxsLFxuXHRcdFx0W11cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLm1vdmVUb05leHRNYXRjaCgpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvUHJldk1hdGNoKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzEsIDEsIDEsIDFdLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0ZmluZFN0YXRlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZmluZFRlc3QoJ2ZpbmQgbW9kZWwgbmV4dC9wcmV2IHJlc3BlY3RzIGN1cnNvciBwb3NpdGlvbicsIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBmaW5kU3RhdGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ2hlbGxvJywgd2hvbGVXb3JkOiB0cnVlIH0sIGZhbHNlKTtcblx0XHRjb25zdCBmaW5kTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRNb2RlbEJvdW5kVG9FZGl0b3JNb2RlbChlZGl0b3IsIGZpbmRTdGF0ZSkpO1xuXG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzEsIDEsIDEsIDFdLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs2LCAyNywgNiwgMzJdLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ21vdXNlJywgQ29yZU5hdmlnYXRpb25Db21tYW5kcy5Nb3ZlVG8uaWQsIHtcblx0XHRcdHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oNiwgMjApXG5cdFx0fSk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzYsIDIwLCA2LCAyMF0sXG5cdFx0XHRudWxsLFxuXHRcdFx0W1xuXHRcdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFx0WzYsIDI3LCA2LCAzMl0sXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvTmV4dE1hdGNoKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzYsIDI3LCA2LCAzMl0sXG5cdFx0XHRbNiwgMjcsIDYsIDMyXSxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs2LCAyNywgNiwgMzJdLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLmRpc3Bvc2UoKTtcblx0XHRmaW5kU3RhdGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRmaW5kVGVzdCgnZmluZCBeJywgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IGZpbmRTdGF0ZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZFJlcGxhY2VTdGF0ZSgpKTtcblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgc2VhcmNoU3RyaW5nOiAnXicsIGlzUmVnZXg6IHRydWUgfSwgZmFsc2UpO1xuXHRcdGNvbnN0IGZpbmRNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZE1vZGVsQm91bmRUb0VkaXRvck1vZGVsKGVkaXRvciwgZmluZFN0YXRlKSk7XG5cblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbMSwgMSwgMSwgMV0sXG5cdFx0XHRudWxsLFxuXHRcdFx0W1xuXHRcdFx0XHRbMSwgMSwgMSwgMV0sXG5cdFx0XHRcdFsyLCAxLCAyLCAxXSxcblx0XHRcdFx0WzMsIDEsIDMsIDFdLFxuXHRcdFx0XHRbNCwgMSwgNCwgMV0sXG5cdFx0XHRcdFs1LCAxLCA1LCAxXSxcblx0XHRcdFx0WzYsIDEsIDYsIDFdLFxuXHRcdFx0XHRbNywgMSwgNywgMV0sXG5cdFx0XHRcdFs4LCAxLCA4LCAxXSxcblx0XHRcdFx0WzksIDEsIDksIDFdLFxuXHRcdFx0XHRbMTAsIDEsIDEwLCAxXSxcblx0XHRcdFx0WzExLCAxLCAxMSwgMV0sXG5cdFx0XHRcdFsxMiwgMSwgMTIsIDFdLFxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvTmV4dE1hdGNoKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzIsIDEsIDIsIDFdLFxuXHRcdFx0WzIsIDEsIDIsIDFdLFxuXHRcdFx0W1xuXHRcdFx0XHRbMSwgMSwgMSwgMV0sXG5cdFx0XHRcdFsyLCAxLCAyLCAxXSxcblx0XHRcdFx0WzMsIDEsIDMsIDFdLFxuXHRcdFx0XHRbNCwgMSwgNCwgMV0sXG5cdFx0XHRcdFs1LCAxLCA1LCAxXSxcblx0XHRcdFx0WzYsIDEsIDYsIDFdLFxuXHRcdFx0XHRbNywgMSwgNywgMV0sXG5cdFx0XHRcdFs4LCAxLCA4LCAxXSxcblx0XHRcdFx0WzksIDEsIDksIDFdLFxuXHRcdFx0XHRbMTAsIDEsIDEwLCAxXSxcblx0XHRcdFx0WzExLCAxLCAxMSwgMV0sXG5cdFx0XHRcdFsxMiwgMSwgMTIsIDFdLFxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvTmV4dE1hdGNoKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzMsIDEsIDMsIDFdLFxuXHRcdFx0WzMsIDEsIDMsIDFdLFxuXHRcdFx0W1xuXHRcdFx0XHRbMSwgMSwgMSwgMV0sXG5cdFx0XHRcdFsyLCAxLCAyLCAxXSxcblx0XHRcdFx0WzMsIDEsIDMsIDFdLFxuXHRcdFx0XHRbNCwgMSwgNCwgMV0sXG5cdFx0XHRcdFs1LCAxLCA1LCAxXSxcblx0XHRcdFx0WzYsIDEsIDYsIDFdLFxuXHRcdFx0XHRbNywgMSwgNywgMV0sXG5cdFx0XHRcdFs4LCAxLCA4LCAxXSxcblx0XHRcdFx0WzksIDEsIDksIDFdLFxuXHRcdFx0XHRbMTAsIDEsIDEwLCAxXSxcblx0XHRcdFx0WzExLCAxLCAxMSwgMV0sXG5cdFx0XHRcdFsxMiwgMSwgMTIsIDFdLFxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwuZGlzcG9zZSgpO1xuXHRcdGZpbmRTdGF0ZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGZpbmRUZXN0KCdmaW5kICQnLCAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgZmluZFN0YXRlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kUmVwbGFjZVN0YXRlKCkpO1xuXHRcdGZpbmRTdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTdHJpbmc6ICckJywgaXNSZWdleDogdHJ1ZSB9LCBmYWxzZSk7XG5cdFx0Y29uc3QgZmluZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kTW9kZWxCb3VuZFRvRWRpdG9yTW9kZWwoZWRpdG9yLCBmaW5kU3RhdGUpKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFsxLCAxOCwgMSwgMThdLFxuXHRcdFx0XHRbMiwgMTgsIDIsIDE4XSxcblx0XHRcdFx0WzMsIDIwLCAzLCAyMF0sXG5cdFx0XHRcdFs0LCAxLCA0LCAxXSxcblx0XHRcdFx0WzUsIDEzLCA1LCAxM10sXG5cdFx0XHRcdFs2LCA0MywgNiwgNDNdLFxuXHRcdFx0XHRbNywgNDEsIDcsIDQxXSxcblx0XHRcdFx0WzgsIDQxLCA4LCA0MV0sXG5cdFx0XHRcdFs5LCA0MCwgOSwgNDBdLFxuXHRcdFx0XHRbMTAsIDIsIDEwLCAyXSxcblx0XHRcdFx0WzExLCAxNywgMTEsIDE3XSxcblx0XHRcdFx0WzEyLCAxLCAxMiwgMV0sXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9OZXh0TWF0Y2goKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbMSwgMTgsIDEsIDE4XSxcblx0XHRcdFsxLCAxOCwgMSwgMThdLFxuXHRcdFx0W1xuXHRcdFx0XHRbMSwgMTgsIDEsIDE4XSxcblx0XHRcdFx0WzIsIDE4LCAyLCAxOF0sXG5cdFx0XHRcdFszLCAyMCwgMywgMjBdLFxuXHRcdFx0XHRbNCwgMSwgNCwgMV0sXG5cdFx0XHRcdFs1LCAxMywgNSwgMTNdLFxuXHRcdFx0XHRbNiwgNDMsIDYsIDQzXSxcblx0XHRcdFx0WzcsIDQxLCA3LCA0MV0sXG5cdFx0XHRcdFs4LCA0MSwgOCwgNDFdLFxuXHRcdFx0XHRbOSwgNDAsIDksIDQwXSxcblx0XHRcdFx0WzEwLCAyLCAxMCwgMl0sXG5cdFx0XHRcdFsxMSwgMTcsIDExLCAxN10sXG5cdFx0XHRcdFsxMiwgMSwgMTIsIDFdLFxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvTmV4dE1hdGNoKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzIsIDE4LCAyLCAxOF0sXG5cdFx0XHRbMiwgMTgsIDIsIDE4XSxcblx0XHRcdFtcblx0XHRcdFx0WzEsIDE4LCAxLCAxOF0sXG5cdFx0XHRcdFsyLCAxOCwgMiwgMThdLFxuXHRcdFx0XHRbMywgMjAsIDMsIDIwXSxcblx0XHRcdFx0WzQsIDEsIDQsIDFdLFxuXHRcdFx0XHRbNSwgMTMsIDUsIDEzXSxcblx0XHRcdFx0WzYsIDQzLCA2LCA0M10sXG5cdFx0XHRcdFs3LCA0MSwgNywgNDFdLFxuXHRcdFx0XHRbOCwgNDEsIDgsIDQxXSxcblx0XHRcdFx0WzksIDQwLCA5LCA0MF0sXG5cdFx0XHRcdFsxMCwgMiwgMTAsIDJdLFxuXHRcdFx0XHRbMTEsIDE3LCAxMSwgMTddLFxuXHRcdFx0XHRbMTIsIDEsIDEyLCAxXSxcblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLm1vdmVUb05leHRNYXRjaCgpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFszLCAyMCwgMywgMjBdLFxuXHRcdFx0WzMsIDIwLCAzLCAyMF0sXG5cdFx0XHRbXG5cdFx0XHRcdFsxLCAxOCwgMSwgMThdLFxuXHRcdFx0XHRbMiwgMTgsIDIsIDE4XSxcblx0XHRcdFx0WzMsIDIwLCAzLCAyMF0sXG5cdFx0XHRcdFs0LCAxLCA0LCAxXSxcblx0XHRcdFx0WzUsIDEzLCA1LCAxM10sXG5cdFx0XHRcdFs2LCA0MywgNiwgNDNdLFxuXHRcdFx0XHRbNywgNDEsIDcsIDQxXSxcblx0XHRcdFx0WzgsIDQxLCA4LCA0MV0sXG5cdFx0XHRcdFs5LCA0MCwgOSwgNDBdLFxuXHRcdFx0XHRbMTAsIDIsIDEwLCAyXSxcblx0XHRcdFx0WzExLCAxNywgMTEsIDE3XSxcblx0XHRcdFx0WzEyLCAxLCAxMiwgMV0sXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0ZmluZFN0YXRlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZmluZFRlc3QoJ2ZpbmQgbmV4dCBeJCcsIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBmaW5kU3RhdGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ14kJywgaXNSZWdleDogdHJ1ZSB9LCBmYWxzZSk7XG5cdFx0Y29uc3QgZmluZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kTW9kZWxCb3VuZFRvRWRpdG9yTW9kZWwoZWRpdG9yLCBmaW5kU3RhdGUpKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFs0LCAxLCA0LCAxXSxcblx0XHRcdFx0WzEyLCAxLCAxMiwgMV0sXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9OZXh0TWF0Y2goKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbNCwgMSwgNCwgMV0sXG5cdFx0XHRbNCwgMSwgNCwgMV0sXG5cdFx0XHRbXG5cdFx0XHRcdFs0LCAxLCA0LCAxXSxcblx0XHRcdFx0WzEyLCAxLCAxMiwgMV0sXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9OZXh0TWF0Y2goKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbMTIsIDEsIDEyLCAxXSxcblx0XHRcdFsxMiwgMSwgMTIsIDFdLFxuXHRcdFx0W1xuXHRcdFx0XHRbNCwgMSwgNCwgMV0sXG5cdFx0XHRcdFsxMiwgMSwgMTIsIDFdLFxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvTmV4dE1hdGNoKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzQsIDEsIDQsIDFdLFxuXHRcdFx0WzQsIDEsIDQsIDFdLFxuXHRcdFx0W1xuXHRcdFx0XHRbNCwgMSwgNCwgMV0sXG5cdFx0XHRcdFsxMiwgMSwgMTIsIDFdLFxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwuZGlzcG9zZSgpO1xuXHRcdGZpbmRTdGF0ZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGZpbmRUZXN0KCdmaW5kIC4qJywgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IGZpbmRTdGF0ZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZFJlcGxhY2VTdGF0ZSgpKTtcblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgc2VhcmNoU3RyaW5nOiAnLionLCBpc1JlZ2V4OiB0cnVlIH0sIGZhbHNlKTtcblx0XHRjb25zdCBmaW5kTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRNb2RlbEJvdW5kVG9FZGl0b3JNb2RlbChlZGl0b3IsIGZpbmRTdGF0ZSkpO1xuXG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzEsIDEsIDEsIDFdLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzEsIDEsIDEsIDE4XSxcblx0XHRcdFx0WzIsIDEsIDIsIDE4XSxcblx0XHRcdFx0WzMsIDEsIDMsIDIwXSxcblx0XHRcdFx0WzQsIDEsIDQsIDFdLFxuXHRcdFx0XHRbNSwgMSwgNSwgMTNdLFxuXHRcdFx0XHRbNiwgMSwgNiwgNDNdLFxuXHRcdFx0XHRbNywgMSwgNywgNDFdLFxuXHRcdFx0XHRbOCwgMSwgOCwgNDFdLFxuXHRcdFx0XHRbOSwgMSwgOSwgNDBdLFxuXHRcdFx0XHRbMTAsIDEsIDEwLCAyXSxcblx0XHRcdFx0WzExLCAxLCAxMSwgMTddLFxuXHRcdFx0XHRbMTIsIDEsIDEyLCAxXSxcblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLmRpc3Bvc2UoKTtcblx0XHRmaW5kU3RhdGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRmaW5kVGVzdCgnZmluZCBuZXh0IF4uKiQnLCAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgZmluZFN0YXRlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kUmVwbGFjZVN0YXRlKCkpO1xuXHRcdGZpbmRTdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTdHJpbmc6ICdeLiokJywgaXNSZWdleDogdHJ1ZSB9LCBmYWxzZSk7XG5cdFx0Y29uc3QgZmluZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kTW9kZWxCb3VuZFRvRWRpdG9yTW9kZWwoZWRpdG9yLCBmaW5kU3RhdGUpKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFsxLCAxLCAxLCAxOF0sXG5cdFx0XHRcdFsyLCAxLCAyLCAxOF0sXG5cdFx0XHRcdFszLCAxLCAzLCAyMF0sXG5cdFx0XHRcdFs0LCAxLCA0LCAxXSxcblx0XHRcdFx0WzUsIDEsIDUsIDEzXSxcblx0XHRcdFx0WzYsIDEsIDYsIDQzXSxcblx0XHRcdFx0WzcsIDEsIDcsIDQxXSxcblx0XHRcdFx0WzgsIDEsIDgsIDQxXSxcblx0XHRcdFx0WzksIDEsIDksIDQwXSxcblx0XHRcdFx0WzEwLCAxLCAxMCwgMl0sXG5cdFx0XHRcdFsxMSwgMSwgMTEsIDE3XSxcblx0XHRcdFx0WzEyLCAxLCAxMiwgMV0sXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9OZXh0TWF0Y2goKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbMSwgMSwgMSwgMThdLFxuXHRcdFx0WzEsIDEsIDEsIDE4XSxcblx0XHRcdFtcblx0XHRcdFx0WzEsIDEsIDEsIDE4XSxcblx0XHRcdFx0WzIsIDEsIDIsIDE4XSxcblx0XHRcdFx0WzMsIDEsIDMsIDIwXSxcblx0XHRcdFx0WzQsIDEsIDQsIDFdLFxuXHRcdFx0XHRbNSwgMSwgNSwgMTNdLFxuXHRcdFx0XHRbNiwgMSwgNiwgNDNdLFxuXHRcdFx0XHRbNywgMSwgNywgNDFdLFxuXHRcdFx0XHRbOCwgMSwgOCwgNDFdLFxuXHRcdFx0XHRbOSwgMSwgOSwgNDBdLFxuXHRcdFx0XHRbMTAsIDEsIDEwLCAyXSxcblx0XHRcdFx0WzExLCAxLCAxMSwgMTddLFxuXHRcdFx0XHRbMTIsIDEsIDEyLCAxXSxcblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLm1vdmVUb05leHRNYXRjaCgpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsyLCAxLCAyLCAxOF0sXG5cdFx0XHRbMiwgMSwgMiwgMThdLFxuXHRcdFx0W1xuXHRcdFx0XHRbMSwgMSwgMSwgMThdLFxuXHRcdFx0XHRbMiwgMSwgMiwgMThdLFxuXHRcdFx0XHRbMywgMSwgMywgMjBdLFxuXHRcdFx0XHRbNCwgMSwgNCwgMV0sXG5cdFx0XHRcdFs1LCAxLCA1LCAxM10sXG5cdFx0XHRcdFs2LCAxLCA2LCA0M10sXG5cdFx0XHRcdFs3LCAxLCA3LCA0MV0sXG5cdFx0XHRcdFs4LCAxLCA4LCA0MV0sXG5cdFx0XHRcdFs5LCAxLCA5LCA0MF0sXG5cdFx0XHRcdFsxMCwgMSwgMTAsIDJdLFxuXHRcdFx0XHRbMTEsIDEsIDExLCAxN10sXG5cdFx0XHRcdFsxMiwgMSwgMTIsIDFdLFxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwuZGlzcG9zZSgpO1xuXHRcdGZpbmRTdGF0ZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGZpbmRUZXN0KCdmaW5kIHByZXYgXi4qJCcsIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBmaW5kU3RhdGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ14uKiQnLCBpc1JlZ2V4OiB0cnVlIH0sIGZhbHNlKTtcblx0XHRjb25zdCBmaW5kTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRNb2RlbEJvdW5kVG9FZGl0b3JNb2RlbChlZGl0b3IsIGZpbmRTdGF0ZSkpO1xuXG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzEsIDEsIDEsIDFdLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzEsIDEsIDEsIDE4XSxcblx0XHRcdFx0WzIsIDEsIDIsIDE4XSxcblx0XHRcdFx0WzMsIDEsIDMsIDIwXSxcblx0XHRcdFx0WzQsIDEsIDQsIDFdLFxuXHRcdFx0XHRbNSwgMSwgNSwgMTNdLFxuXHRcdFx0XHRbNiwgMSwgNiwgNDNdLFxuXHRcdFx0XHRbNywgMSwgNywgNDFdLFxuXHRcdFx0XHRbOCwgMSwgOCwgNDFdLFxuXHRcdFx0XHRbOSwgMSwgOSwgNDBdLFxuXHRcdFx0XHRbMTAsIDEsIDEwLCAyXSxcblx0XHRcdFx0WzExLCAxLCAxMSwgMTddLFxuXHRcdFx0XHRbMTIsIDEsIDEyLCAxXSxcblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLm1vdmVUb1ByZXZNYXRjaCgpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxMiwgMSwgMTIsIDFdLFxuXHRcdFx0WzEyLCAxLCAxMiwgMV0sXG5cdFx0XHRbXG5cdFx0XHRcdFsxLCAxLCAxLCAxOF0sXG5cdFx0XHRcdFsyLCAxLCAyLCAxOF0sXG5cdFx0XHRcdFszLCAxLCAzLCAyMF0sXG5cdFx0XHRcdFs0LCAxLCA0LCAxXSxcblx0XHRcdFx0WzUsIDEsIDUsIDEzXSxcblx0XHRcdFx0WzYsIDEsIDYsIDQzXSxcblx0XHRcdFx0WzcsIDEsIDcsIDQxXSxcblx0XHRcdFx0WzgsIDEsIDgsIDQxXSxcblx0XHRcdFx0WzksIDEsIDksIDQwXSxcblx0XHRcdFx0WzEwLCAxLCAxMCwgMl0sXG5cdFx0XHRcdFsxMSwgMSwgMTEsIDE3XSxcblx0XHRcdFx0WzEyLCAxLCAxMiwgMV0sXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9QcmV2TWF0Y2goKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbMTEsIDEsIDExLCAxN10sXG5cdFx0XHRbMTEsIDEsIDExLCAxN10sXG5cdFx0XHRbXG5cdFx0XHRcdFsxLCAxLCAxLCAxOF0sXG5cdFx0XHRcdFsyLCAxLCAyLCAxOF0sXG5cdFx0XHRcdFszLCAxLCAzLCAyMF0sXG5cdFx0XHRcdFs0LCAxLCA0LCAxXSxcblx0XHRcdFx0WzUsIDEsIDUsIDEzXSxcblx0XHRcdFx0WzYsIDEsIDYsIDQzXSxcblx0XHRcdFx0WzcsIDEsIDcsIDQxXSxcblx0XHRcdFx0WzgsIDEsIDgsIDQxXSxcblx0XHRcdFx0WzksIDEsIDksIDQwXSxcblx0XHRcdFx0WzEwLCAxLCAxMCwgMl0sXG5cdFx0XHRcdFsxMSwgMSwgMTEsIDE3XSxcblx0XHRcdFx0WzEyLCAxLCAxMiwgMV0sXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0ZmluZFN0YXRlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZmluZFRlc3QoJ2ZpbmQgcHJldiBeJCcsIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBmaW5kU3RhdGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ14kJywgaXNSZWdleDogdHJ1ZSB9LCBmYWxzZSk7XG5cdFx0Y29uc3QgZmluZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kTW9kZWxCb3VuZFRvRWRpdG9yTW9kZWwoZWRpdG9yLCBmaW5kU3RhdGUpKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFs0LCAxLCA0LCAxXSxcblx0XHRcdFx0WzEyLCAxLCAxMiwgMV0sXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9QcmV2TWF0Y2goKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbMTIsIDEsIDEyLCAxXSxcblx0XHRcdFsxMiwgMSwgMTIsIDFdLFxuXHRcdFx0W1xuXHRcdFx0XHRbNCwgMSwgNCwgMV0sXG5cdFx0XHRcdFsxMiwgMSwgMTIsIDFdLFxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvUHJldk1hdGNoKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzQsIDEsIDQsIDFdLFxuXHRcdFx0WzQsIDEsIDQsIDFdLFxuXHRcdFx0W1xuXHRcdFx0XHRbNCwgMSwgNCwgMV0sXG5cdFx0XHRcdFsxMiwgMSwgMTIsIDFdLFxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvUHJldk1hdGNoKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzEyLCAxLCAxMiwgMV0sXG5cdFx0XHRbMTIsIDEsIDEyLCAxXSxcblx0XHRcdFtcblx0XHRcdFx0WzQsIDEsIDQsIDFdLFxuXHRcdFx0XHRbMTIsIDEsIDEyLCAxXSxcblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLmRpc3Bvc2UoKTtcblx0XHRmaW5kU3RhdGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRmaW5kVGVzdCgncmVwbGFjZSBoZWxsbycsIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBmaW5kU3RhdGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ2hlbGxvJywgcmVwbGFjZVN0cmluZzogJ2hpJywgd2hvbGVXb3JkOiB0cnVlIH0sIGZhbHNlKTtcblx0XHRjb25zdCBmaW5kTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRNb2RlbEJvdW5kVG9FZGl0b3JNb2RlbChlZGl0b3IsIGZpbmRTdGF0ZSkpO1xuXG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzEsIDEsIDEsIDFdLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs2LCAyNywgNiwgMzJdLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ21vdXNlJywgQ29yZU5hdmlnYXRpb25Db21tYW5kcy5Nb3ZlVG8uaWQsIHtcblx0XHRcdHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oNiwgMjApXG5cdFx0fSk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzYsIDIwLCA2LCAyMF0sXG5cdFx0XHRudWxsLFxuXHRcdFx0W1xuXHRcdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFx0WzYsIDI3LCA2LCAzMl0sXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCg2KSwgJyAgICBjb3V0IDw8IFwiaGVsbG8gd29ybGQsIEhlbGxvIVwiIDw8IGVuZGw7Jyk7XG5cblx0XHRmaW5kTW9kZWwucmVwbGFjZSgpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFs2LCAyNywgNiwgMzJdLFxuXHRcdFx0WzYsIDI3LCA2LCAzMl0sXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0XHRbNiwgMjcsIDYsIDMyXSxcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdFs4LCAxNCwgOCwgMTldXG5cdFx0XHRdXG5cdFx0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDYpLCAnICAgIGNvdXQgPDwgXCJoZWxsbyB3b3JsZCwgSGVsbG8hXCIgPDwgZW5kbDsnKTtcblxuXHRcdGZpbmRNb2RlbC5yZXBsYWNlKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCg2KSwgJyAgICBjb3V0IDw8IFwiaGVsbG8gd29ybGQsIGhpIVwiIDw8IGVuZGw7Jyk7XG5cblx0XHRmaW5kTW9kZWwucmVwbGFjZSgpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFs4LCAxNCwgOCwgMTldLFxuXHRcdFx0WzgsIDE0LCA4LCAxOV0sXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCg3KSwgJyAgICBjb3V0IDw8IFwiaGkgd29ybGQgYWdhaW5cIiA8PCBlbmRsOycpO1xuXG5cdFx0ZmluZE1vZGVsLnJlcGxhY2UoKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0W1xuXHRcdFx0XHRbNiwgMTQsIDYsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCg4KSwgJyAgICBjb3V0IDw8IFwiaGkgd29ybGQgYWdhaW5cIiA8PCBlbmRsOycpO1xuXG5cdFx0ZmluZE1vZGVsLnJlcGxhY2UoKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbNiwgMTYsIDYsIDE2XSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXVxuXHRcdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCg2KSwgJyAgICBjb3V0IDw8IFwiaGkgd29ybGQsIGhpIVwiIDw8IGVuZGw7Jyk7XG5cblx0XHRmaW5kTW9kZWwuZGlzcG9zZSgpO1xuXHRcdGZpbmRTdGF0ZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGZpbmRUZXN0KCdyZXBsYWNlIGJsYScsIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBmaW5kU3RhdGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ2JsYScsIHJlcGxhY2VTdHJpbmc6ICdjaWFvJyB9LCBmYWxzZSk7XG5cdFx0Y29uc3QgZmluZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kTW9kZWxCb3VuZFRvRWRpdG9yTW9kZWwoZWRpdG9yLCBmaW5kU3RhdGUpKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFsxMSwgNCwgMTEsIDddLFxuXHRcdFx0XHRbMTEsIDcsIDExLCAxMF0sXG5cdFx0XHRcdFsxMSwgMTAsIDExLCAxM11cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLnJlcGxhY2UoKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbMTEsIDQsIDExLCA3XSxcblx0XHRcdFsxMSwgNCwgMTEsIDddLFxuXHRcdFx0W1xuXHRcdFx0XHRbMTEsIDQsIDExLCA3XSxcblx0XHRcdFx0WzExLCA3LCAxMSwgMTBdLFxuXHRcdFx0XHRbMTEsIDEwLCAxMSwgMTNdXG5cdFx0XHRdXG5cdFx0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDExKSwgJy8vIGJsYWJsYWJsYWNpYW8nKTtcblxuXHRcdGZpbmRNb2RlbC5yZXBsYWNlKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzExLCA4LCAxMSwgMTFdLFxuXHRcdFx0WzExLCA4LCAxMSwgMTFdLFxuXHRcdFx0W1xuXHRcdFx0XHRbMTEsIDgsIDExLCAxMV0sXG5cdFx0XHRcdFsxMSwgMTEsIDExLCAxNF1cblx0XHRcdF1cblx0XHQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoMTEpLCAnLy8gY2lhb2JsYWJsYWNpYW8nKTtcblxuXHRcdGZpbmRNb2RlbC5yZXBsYWNlKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzExLCAxMiwgMTEsIDE1XSxcblx0XHRcdFsxMSwgMTIsIDExLCAxNV0sXG5cdFx0XHRbXG5cdFx0XHRcdFsxMSwgMTIsIDExLCAxNV1cblx0XHRcdF1cblx0XHQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoMTEpLCAnLy8gY2lhb2NpYW9ibGFjaWFvJyk7XG5cblx0XHRmaW5kTW9kZWwucmVwbGFjZSgpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxMSwgMTYsIDExLCAxNl0sXG5cdFx0XHRudWxsLFxuXHRcdFx0W11cblx0XHQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoMTEpLCAnLy8gY2lhb2NpYW9jaWFvY2lhbycpO1xuXG5cdFx0ZmluZE1vZGVsLmRpc3Bvc2UoKTtcblx0XHRmaW5kU3RhdGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRmaW5kVGVzdCgncmVwbGFjZUFsbCBoZWxsbycsIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBmaW5kU3RhdGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ2hlbGxvJywgcmVwbGFjZVN0cmluZzogJ2hpJywgd2hvbGVXb3JkOiB0cnVlIH0sIGZhbHNlKTtcblx0XHRjb25zdCBmaW5kTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRNb2RlbEJvdW5kVG9FZGl0b3JNb2RlbChlZGl0b3IsIGZpbmRTdGF0ZSkpO1xuXG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzEsIDEsIDEsIDFdLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs2LCAyNywgNiwgMzJdLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ21vdXNlJywgQ29yZU5hdmlnYXRpb25Db21tYW5kcy5Nb3ZlVG8uaWQsIHtcblx0XHRcdHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oNiwgMjApXG5cdFx0fSk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzYsIDIwLCA2LCAyMF0sXG5cdFx0XHRudWxsLFxuXHRcdFx0W1xuXHRcdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFx0WzYsIDI3LCA2LCAzMl0sXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCg2KSwgJyAgICBjb3V0IDw8IFwiaGVsbG8gd29ybGQsIEhlbGxvIVwiIDw8IGVuZGw7Jyk7XG5cblx0XHRmaW5kTW9kZWwucmVwbGFjZUFsbCgpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFs2LCAxNywgNiwgMTddLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtdXG5cdFx0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDYpLCAnICAgIGNvdXQgPDwgXCJoaSB3b3JsZCwgaGkhXCIgPDwgZW5kbDsnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDcpLCAnICAgIGNvdXQgPDwgXCJoaSB3b3JsZCBhZ2FpblwiIDw8IGVuZGw7Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCg4KSwgJyAgICBjb3V0IDw8IFwiaGkgd29ybGQgYWdhaW5cIiA8PCBlbmRsOycpO1xuXG5cdFx0ZmluZE1vZGVsLmRpc3Bvc2UoKTtcblx0XHRmaW5kU3RhdGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRmaW5kVGVzdCgncmVwbGFjZUFsbCB0d28gc3BhY2VzIHdpdGggb25lIHNwYWNlJywgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IGZpbmRTdGF0ZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZFJlcGxhY2VTdGF0ZSgpKTtcblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgc2VhcmNoU3RyaW5nOiAnICAnLCByZXBsYWNlU3RyaW5nOiAnICcgfSwgZmFsc2UpO1xuXHRcdGNvbnN0IGZpbmRNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZE1vZGVsQm91bmRUb0VkaXRvck1vZGVsKGVkaXRvciwgZmluZFN0YXRlKSk7XG5cblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbMSwgMSwgMSwgMV0sXG5cdFx0XHRudWxsLFxuXHRcdFx0W1xuXHRcdFx0XHRbNiwgMSwgNiwgM10sXG5cdFx0XHRcdFs2LCAzLCA2LCA1XSxcblx0XHRcdFx0WzcsIDEsIDcsIDNdLFxuXHRcdFx0XHRbNywgMywgNywgNV0sXG5cdFx0XHRcdFs4LCAxLCA4LCAzXSxcblx0XHRcdFx0WzgsIDMsIDgsIDVdLFxuXHRcdFx0XHRbOSwgMSwgOSwgM10sXG5cdFx0XHRcdFs5LCAzLCA5LCA1XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwucmVwbGFjZUFsbCgpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAxLCA2LCAzXSxcblx0XHRcdFx0WzcsIDEsIDcsIDNdLFxuXHRcdFx0XHRbOCwgMSwgOCwgM10sXG5cdFx0XHRcdFs5LCAxLCA5LCAzXVxuXHRcdFx0XVxuXHRcdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCg2KSwgJyAgY291dCA8PCBcImhlbGxvIHdvcmxkLCBIZWxsbyFcIiA8PCBlbmRsOycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoNyksICcgIGNvdXQgPDwgXCJoZWxsbyB3b3JsZCBhZ2FpblwiIDw8IGVuZGw7Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCg4KSwgJyAgY291dCA8PCBcIkhlbGxvIHdvcmxkIGFnYWluXCIgPDwgZW5kbDsnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDkpLCAnICBjb3V0IDw8IFwiaGVsbG93b3JsZCBhZ2FpblwiIDw8IGVuZGw7Jyk7XG5cblx0XHRmaW5kTW9kZWwuZGlzcG9zZSgpO1xuXHRcdGZpbmRTdGF0ZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGZpbmRUZXN0KCdyZXBsYWNlQWxsIGJsYScsIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBmaW5kU3RhdGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ2JsYScsIHJlcGxhY2VTdHJpbmc6ICdjaWFvJyB9LCBmYWxzZSk7XG5cdFx0Y29uc3QgZmluZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kTW9kZWxCb3VuZFRvRWRpdG9yTW9kZWwoZWRpdG9yLCBmaW5kU3RhdGUpKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFsxMSwgNCwgMTEsIDddLFxuXHRcdFx0XHRbMTEsIDcsIDExLCAxMF0sXG5cdFx0XHRcdFsxMSwgMTAsIDExLCAxM11cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLnJlcGxhY2VBbGwoKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbMSwgMSwgMSwgMV0sXG5cdFx0XHRudWxsLFxuXHRcdFx0W11cblx0XHQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoMTEpLCAnLy8gY2lhb2NpYW9jaWFvY2lhbycpO1xuXG5cdFx0ZmluZE1vZGVsLmRpc3Bvc2UoKTtcblx0XHRmaW5kU3RhdGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRmaW5kVGVzdCgncmVwbGFjZUFsbCBibGEgd2l0aCBcXFxcdFxcXFxuJywgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IGZpbmRTdGF0ZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZFJlcGxhY2VTdGF0ZSgpKTtcblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgc2VhcmNoU3RyaW5nOiAnYmxhJywgcmVwbGFjZVN0cmluZzogJzxcXFxcblxcXFx0PicsIGlzUmVnZXg6IHRydWUgfSwgZmFsc2UpO1xuXHRcdGNvbnN0IGZpbmRNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZE1vZGVsQm91bmRUb0VkaXRvck1vZGVsKGVkaXRvciwgZmluZFN0YXRlKSk7XG5cblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbMSwgMSwgMSwgMV0sXG5cdFx0XHRudWxsLFxuXHRcdFx0W1xuXHRcdFx0XHRbMTEsIDQsIDExLCA3XSxcblx0XHRcdFx0WzExLCA3LCAxMSwgMTBdLFxuXHRcdFx0XHRbMTEsIDEwLCAxMSwgMTNdXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5yZXBsYWNlQWxsKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzEsIDEsIDEsIDFdLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtdXG5cdFx0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDExKSwgJy8vIDwnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDEyKSwgJ1xcdD48Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCgxMyksICdcXHQ+PCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoMTQpLCAnXFx0PmNpYW8nKTtcblxuXHRcdGZpbmRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0ZmluZFN0YXRlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZmluZFRlc3QoJ2lzc3VlICMzNTE2OiBcInJlcGxhY2UgYWxsXCIgbW92ZXMgcGFnZS9jdXJzb3IvZm9jdXMvc2Nyb2xsIHRvIHRoZSBwbGFjZSBvZiB0aGUgbGFzdCByZXBsYWNlbWVudCcsIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBmaW5kU3RhdGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ2luY2x1ZGUnLCByZXBsYWNlU3RyaW5nOiAnYmFyJyB9LCBmYWxzZSk7XG5cdFx0Y29uc3QgZmluZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kTW9kZWxCb3VuZFRvRWRpdG9yTW9kZWwoZWRpdG9yLCBmaW5kU3RhdGUpKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFsyLCAyLCAyLCA5XSxcblx0XHRcdFx0WzMsIDIsIDMsIDldXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5yZXBsYWNlQWxsKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzEsIDEsIDEsIDFdLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtdXG5cdFx0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoMiksICcjYmFyIFwiY29vbC5oXCInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDMpLCAnI2JhciA8aW9zdHJlYW0+Jyk7XG5cblx0XHRmaW5kTW9kZWwuZGlzcG9zZSgpO1xuXHRcdGZpbmRTdGF0ZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGZpbmRUZXN0KCdsaXN0ZW5zIHRvIG1vZGVsIGNvbnRlbnQgY2hhbmdlcycsIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBmaW5kU3RhdGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ2hlbGxvJywgcmVwbGFjZVN0cmluZzogJ2hpJywgd2hvbGVXb3JkOiB0cnVlIH0sIGZhbHNlKTtcblx0XHRjb25zdCBmaW5kTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRNb2RlbEJvdW5kVG9FZGl0b3JNb2RlbChlZGl0b3IsIGZpbmRTdGF0ZSkpO1xuXG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzEsIDEsIDEsIDFdLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs2LCAyNywgNiwgMzJdLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZWRpdG9yLmdldE1vZGVsKCkhLnNldFZhbHVlKCdoZWxsb1xcbmhpJyk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzEsIDEsIDEsIDFdLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0ZmluZFN0YXRlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZmluZFRlc3QoJ3NlbGVjdEFsbE1hdGNoZXMnLCAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgZmluZFN0YXRlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kUmVwbGFjZVN0YXRlKCkpO1xuXHRcdGZpbmRTdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTdHJpbmc6ICdoZWxsbycsIHJlcGxhY2VTdHJpbmc6ICdoaScsIHdob2xlV29yZDogdHJ1ZSB9LCBmYWxzZSk7XG5cdFx0Y29uc3QgZmluZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kTW9kZWxCb3VuZFRvRWRpdG9yTW9kZWwoZWRpdG9yLCBmaW5kU3RhdGUpKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0XHRbNiwgMjcsIDYsIDMyXSxcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdFs4LCAxNCwgOCwgMTldXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5zZWxlY3RBbGxNYXRjaGVzKCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCkhLm1hcChzID0+IHMudG9TdHJpbmcoKSksIFtcblx0XHRcdG5ldyBTZWxlY3Rpb24oNiwgMTQsIDYsIDE5KSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oNiwgMjcsIDYsIDMyKSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oNywgMTQsIDcsIDE5KSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oOCwgMTQsIDgsIDE5KVxuXHRcdF0ubWFwKHMgPT4gcy50b1N0cmluZygpKSk7XG5cblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0XHRbNiwgMjcsIDYsIDMyXSxcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdFs4LCAxNCwgOCwgMTldXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0ZmluZFN0YXRlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZmluZFRlc3QoJ2lzc3VlICMxNDE0MyBzZWxlY3RBbGxNYXRjaGVzIHNob3VsZCBtYWludGFpbiBwcmltYXJ5IGN1cnNvciBpZiBmZWFzaWJsZScsIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBmaW5kU3RhdGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ2hlbGxvJywgcmVwbGFjZVN0cmluZzogJ2hpJywgd2hvbGVXb3JkOiB0cnVlIH0sIGZhbHNlKTtcblx0XHRjb25zdCBmaW5kTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRNb2RlbEJvdW5kVG9FZGl0b3JNb2RlbChlZGl0b3IsIGZpbmRTdGF0ZSkpO1xuXG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzEsIDEsIDEsIDFdLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs2LCAyNywgNiwgMzJdLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgUmFuZ2UoNywgMTQsIDcsIDE5KSk7XG5cblx0XHRmaW5kTW9kZWwuc2VsZWN0QWxsTWF0Y2hlcygpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9ucygpIS5tYXAocyA9PiBzLnRvU3RyaW5nKCkpLCBbXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDcsIDE0LCA3LCAxOSksXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDYsIDE0LCA2LCAxOSksXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDYsIDI3LCA2LCAzMiksXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDgsIDE0LCA4LCAxOSlcblx0XHRdLm1hcChzID0+IHMudG9TdHJpbmcoKSkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0U2VsZWN0aW9uKCkhLnRvU3RyaW5nKCksIG5ldyBTZWxlY3Rpb24oNywgMTQsIDcsIDE5KS50b1N0cmluZygpKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs2LCAyNywgNiwgMzJdLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLmRpc3Bvc2UoKTtcblx0XHRmaW5kU3RhdGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRmaW5kVGVzdCgnaXNzdWUgIzE5MTQ6IE5QRSB3aGVuIHRoZXJlIGlzIG9ubHkgb25lIGZpbmQgbWF0Y2gnLCAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgZmluZFN0YXRlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kUmVwbGFjZVN0YXRlKCkpO1xuXHRcdGZpbmRTdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTdHJpbmc6ICdjb29sLmgnIH0sIGZhbHNlKTtcblx0XHRjb25zdCBmaW5kTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRNb2RlbEJvdW5kVG9FZGl0b3JNb2RlbChlZGl0b3IsIGZpbmRTdGF0ZSkpO1xuXG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzEsIDEsIDEsIDFdLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzIsIDExLCAyLCAxN11cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLm1vdmVUb05leHRNYXRjaCgpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsyLCAxMSwgMiwgMTddLFxuXHRcdFx0WzIsIDExLCAyLCAxN10sXG5cdFx0XHRbXG5cdFx0XHRcdFsyLCAxMSwgMiwgMTddXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9OZXh0TWF0Y2goKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbMiwgMTEsIDIsIDE3XSxcblx0XHRcdFsyLCAxMSwgMiwgMTddLFxuXHRcdFx0W1xuXHRcdFx0XHRbMiwgMTEsIDIsIDE3XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwuZGlzcG9zZSgpO1xuXHRcdGZpbmRTdGF0ZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGZpbmRUZXN0KCdyZXBsYWNlIHdoZW4gc2VhcmNoIHN0cmluZyBoYXMgbG9vayBhaGVkIHJlZ2V4JywgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IGZpbmRTdGF0ZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZFJlcGxhY2VTdGF0ZSgpKTtcblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgc2VhcmNoU3RyaW5nOiAnaGVsbG8oPz1cXFxcc3dvcmxkKScsIHJlcGxhY2VTdHJpbmc6ICdoaScsIGlzUmVnZXg6IHRydWUgfSwgZmFsc2UpO1xuXHRcdGNvbnN0IGZpbmRNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZE1vZGVsQm91bmRUb0VkaXRvck1vZGVsKGVkaXRvciwgZmluZFN0YXRlKSk7XG5cblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbMSwgMSwgMSwgMV0sXG5cdFx0XHRudWxsLFxuXHRcdFx0W1xuXHRcdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdFs4LCAxNCwgOCwgMTldXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5yZXBsYWNlKCk7XG5cblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0W1xuXHRcdFx0XHRbNiwgMTQsIDYsIDE5XSxcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdFs4LCAxNCwgOCwgMTldXG5cdFx0XHRdXG5cdFx0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDYpLCAnICAgIGNvdXQgPDwgXCJoZWxsbyB3b3JsZCwgSGVsbG8hXCIgPDwgZW5kbDsnKTtcblxuXHRcdGZpbmRNb2RlbC5yZXBsYWNlKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFtcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdFs4LCAxNCwgOCwgMTldXG5cdFx0XHRdXG5cdFx0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDYpLCAnICAgIGNvdXQgPDwgXCJoaSB3b3JsZCwgSGVsbG8hXCIgPDwgZW5kbDsnKTtcblxuXHRcdGZpbmRNb2RlbC5yZXBsYWNlKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzgsIDE0LCA4LCAxOV0sXG5cdFx0XHRbOCwgMTQsIDgsIDE5XSxcblx0XHRcdFtcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoNyksICcgICAgY291dCA8PCBcImhpIHdvcmxkIGFnYWluXCIgPDwgZW5kbDsnKTtcblxuXHRcdGZpbmRNb2RlbC5yZXBsYWNlKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzgsIDE2LCA4LCAxNl0sXG5cdFx0XHRudWxsLFxuXHRcdFx0W11cblx0XHQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoOCksICcgICAgY291dCA8PCBcImhpIHdvcmxkIGFnYWluXCIgPDwgZW5kbDsnKTtcblxuXHRcdGZpbmRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0ZmluZFN0YXRlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZmluZFRlc3QoJ3JlcGxhY2Ugd2hlbiBzZWFyY2ggc3RyaW5nIGhhcyBsb29rIGFoZWQgcmVnZXggYW5kIGN1cnNvciBpcyBhdCB0aGUgbGFzdCBmaW5kIG1hdGNoJywgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IGZpbmRTdGF0ZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZFJlcGxhY2VTdGF0ZSgpKTtcblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgc2VhcmNoU3RyaW5nOiAnaGVsbG8oPz1cXFxcc3dvcmxkKScsIHJlcGxhY2VTdHJpbmc6ICdoaScsIGlzUmVnZXg6IHRydWUgfSwgZmFsc2UpO1xuXHRcdGNvbnN0IGZpbmRNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZE1vZGVsQm91bmRUb0VkaXRvck1vZGVsKGVkaXRvciwgZmluZFN0YXRlKSk7XG5cblx0XHRlZGl0b3IudHJpZ2dlcignbW91c2UnLCBDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLk1vdmVUby5pZCwge1xuXHRcdFx0cG9zaXRpb246IG5ldyBQb3NpdGlvbig4LCAxNClcblx0XHR9KTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFs4LCAxNCwgOCwgMTRdLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwucmVwbGFjZSgpO1xuXG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzgsIDE0LCA4LCAxOV0sXG5cdFx0XHRbOCwgMTQsIDgsIDE5XSxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDgpLCAnICAgIGNvdXQgPDwgXCJIZWxsbyB3b3JsZCBhZ2FpblwiIDw8IGVuZGw7Jyk7XG5cblx0XHRmaW5kTW9kZWwucmVwbGFjZSgpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdF1cblx0XHQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoOCksICcgICAgY291dCA8PCBcImhpIHdvcmxkIGFnYWluXCIgPDwgZW5kbDsnKTtcblxuXHRcdGZpbmRNb2RlbC5yZXBsYWNlKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFtcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoNiksICcgICAgY291dCA8PCBcImhpIHdvcmxkLCBIZWxsbyFcIiA8PCBlbmRsOycpO1xuXG5cdFx0ZmluZE1vZGVsLnJlcGxhY2UoKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbNywgMTYsIDcsIDE2XSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXVxuXHRcdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCg3KSwgJyAgICBjb3V0IDw8IFwiaGkgd29ybGQgYWdhaW5cIiA8PCBlbmRsOycpO1xuXG5cdFx0ZmluZE1vZGVsLmRpc3Bvc2UoKTtcblx0XHRmaW5kU3RhdGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRmaW5kVGVzdCgncmVwbGFjZUFsbCB3aGVuIHNlYXJjaCBzdHJpbmcgaGFzIGxvb2sgYWhlZCByZWdleCcsIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBmaW5kU3RhdGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ2hlbGxvKD89XFxcXHN3b3JsZCknLCByZXBsYWNlU3RyaW5nOiAnaGknLCBpc1JlZ2V4OiB0cnVlIH0sIGZhbHNlKTtcblx0XHRjb25zdCBmaW5kTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRNb2RlbEJvdW5kVG9FZGl0b3JNb2RlbChlZGl0b3IsIGZpbmRTdGF0ZSkpO1xuXG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzEsIDEsIDEsIDFdLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOCwgMTQsIDgsIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwucmVwbGFjZUFsbCgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCg2KSwgJyAgICBjb3V0IDw8IFwiaGkgd29ybGQsIEhlbGxvIVwiIDw8IGVuZGw7Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCg3KSwgJyAgICBjb3V0IDw8IFwiaGkgd29ybGQgYWdhaW5cIiA8PCBlbmRsOycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoOCksICcgICAgY291dCA8PCBcImhpIHdvcmxkIGFnYWluXCIgPDwgZW5kbDsnKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwuZGlzcG9zZSgpO1xuXHRcdGZpbmRTdGF0ZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGZpbmRUZXN0KCdyZXBsYWNlIHdoZW4gc2VhcmNoIHN0cmluZyBoYXMgbG9vayBhaGVkIHJlZ2V4IGFuZCByZXBsYWNlIHN0cmluZyBoYXMgY2FwdHVyaW5nIGdyb3VwcycsIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBmaW5kU3RhdGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ2hlbChsbykoPz1cXFxcc3dvcmxkKScsIHJlcGxhY2VTdHJpbmc6ICdoaSQxJywgaXNSZWdleDogdHJ1ZSB9LCBmYWxzZSk7XG5cdFx0Y29uc3QgZmluZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kTW9kZWxCb3VuZFRvRWRpdG9yTW9kZWwoZWRpdG9yLCBmaW5kU3RhdGUpKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLnJlcGxhY2UoKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoNiksICcgICAgY291dCA8PCBcImhlbGxvIHdvcmxkLCBIZWxsbyFcIiA8PCBlbmRsOycpO1xuXG5cdFx0ZmluZE1vZGVsLnJlcGxhY2UoKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0W1xuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoNiksICcgICAgY291dCA8PCBcImhpbG8gd29ybGQsIEhlbGxvIVwiIDw8IGVuZGw7Jyk7XG5cblx0XHRmaW5kTW9kZWwucmVwbGFjZSgpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFs4LCAxNCwgOCwgMTldLFxuXHRcdFx0WzgsIDE0LCA4LCAxOV0sXG5cdFx0XHRbXG5cdFx0XHRcdFs4LCAxNCwgOCwgMTldXG5cdFx0XHRdXG5cdFx0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDcpLCAnICAgIGNvdXQgPDwgXCJoaWxvIHdvcmxkIGFnYWluXCIgPDwgZW5kbDsnKTtcblxuXHRcdGZpbmRNb2RlbC5yZXBsYWNlKCk7XG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzgsIDE4LCA4LCAxOF0sXG5cdFx0XHRudWxsLFxuXHRcdFx0W11cblx0XHQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoOCksICcgICAgY291dCA8PCBcImhpbG8gd29ybGQgYWdhaW5cIiA8PCBlbmRsOycpO1xuXG5cdFx0ZmluZE1vZGVsLmRpc3Bvc2UoKTtcblx0XHRmaW5kU3RhdGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRmaW5kVGVzdCgncmVwbGFjZUFsbCB3aGVuIHNlYXJjaCBzdHJpbmcgaGFzIGxvb2sgYWhlZCByZWdleCBhbmQgcmVwbGFjZSBzdHJpbmcgaGFzIGNhcHR1cmluZyBncm91cHMnLCAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgZmluZFN0YXRlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kUmVwbGFjZVN0YXRlKCkpO1xuXHRcdGZpbmRTdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTdHJpbmc6ICd3byhybClkKD89Lio7JCknLCByZXBsYWNlU3RyaW5nOiAnZ2kkMScsIGlzUmVnZXg6IHRydWUgfSwgZmFsc2UpO1xuXHRcdGNvbnN0IGZpbmRNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZE1vZGVsQm91bmRUb0VkaXRvck1vZGVsKGVkaXRvciwgZmluZFN0YXRlKSk7XG5cblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbMSwgMSwgMSwgMV0sXG5cdFx0XHRudWxsLFxuXHRcdFx0W1xuXHRcdFx0XHRbNiwgMjAsIDYsIDI1XSxcblx0XHRcdFx0WzcsIDIwLCA3LCAyNV0sXG5cdFx0XHRcdFs4LCAyMCwgOCwgMjVdLFxuXHRcdFx0XHRbOSwgMTksIDksIDI0XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwucmVwbGFjZUFsbCgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCg2KSwgJyAgICBjb3V0IDw8IFwiaGVsbG8gZ2lybCwgSGVsbG8hXCIgPDwgZW5kbDsnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDcpLCAnICAgIGNvdXQgPDwgXCJoZWxsbyBnaXJsIGFnYWluXCIgPDwgZW5kbDsnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDgpLCAnICAgIGNvdXQgPDwgXCJIZWxsbyBnaXJsIGFnYWluXCIgPDwgZW5kbDsnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDkpLCAnICAgIGNvdXQgPDwgXCJoZWxsb2dpcmwgYWdhaW5cIiA8PCBlbmRsOycpO1xuXG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzEsIDEsIDEsIDFdLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0ZmluZFN0YXRlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZmluZFRlc3QoJ3JlcGxhY2VBbGwgd2hlbiBzZWFyY2ggc3RyaW5nIGlzIG11bHRpbGluZSBhbmQgaGFzIGxvb2sgYWhlZCByZWdleCBhbmQgcmVwbGFjZSBzdHJpbmcgaGFzIGNhcHR1cmluZyBncm91cHMnLCAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgZmluZFN0YXRlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kUmVwbGFjZVN0YXRlKCkpO1xuXHRcdGZpbmRTdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTdHJpbmc6ICd3byhybClkKC4qO1xcXFxuKSg/PS4qaGVsbG8pJywgcmVwbGFjZVN0cmluZzogJ2dpJDEkMicsIGlzUmVnZXg6IHRydWUsIG1hdGNoQ2FzZTogdHJ1ZSB9LCBmYWxzZSk7XG5cdFx0Y29uc3QgZmluZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kTW9kZWxCb3VuZFRvRWRpdG9yTW9kZWwoZWRpdG9yLCBmaW5kU3RhdGUpKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAyMCwgNywgMV0sXG5cdFx0XHRcdFs4LCAyMCwgOSwgMV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLnJlcGxhY2VBbGwoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoNiksICcgICAgY291dCA8PCBcImhlbGxvIGdpcmwsIEhlbGxvIVwiIDw8IGVuZGw7Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCg4KSwgJyAgICBjb3V0IDw8IFwiSGVsbG8gZ2lybCBhZ2FpblwiIDw8IGVuZGw7Jyk7XG5cblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbMSwgMSwgMSwgMV0sXG5cdFx0XHRudWxsLFxuXHRcdFx0W11cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLmRpc3Bvc2UoKTtcblx0XHRmaW5kU3RhdGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRmaW5kVGVzdCgncmVwbGFjZUFsbCBwcmVzZXJ2aW5nIGNhc2UnLCAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgZmluZFN0YXRlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kUmVwbGFjZVN0YXRlKCkpO1xuXHRcdGZpbmRTdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTdHJpbmc6ICdoZWxsbycsIHJlcGxhY2VTdHJpbmc6ICdnb29kYnllJywgaXNSZWdleDogZmFsc2UsIG1hdGNoQ2FzZTogZmFsc2UsIHByZXNlcnZlQ2FzZTogdHJ1ZSB9LCBmYWxzZSk7XG5cdFx0Y29uc3QgZmluZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kTW9kZWxCb3VuZFRvRWRpdG9yTW9kZWwoZWRpdG9yLCBmaW5kU3RhdGUpKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFs2LCAxNCwgNiwgMTldLFxuXHRcdFx0XHRbNiwgMjcsIDYsIDMyXSxcblx0XHRcdFx0WzcsIDE0LCA3LCAxOV0sXG5cdFx0XHRcdFs4LCAxNCwgOCwgMTldLFxuXHRcdFx0XHRbOSwgMTQsIDksIDE5XSxcblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLnJlcGxhY2VBbGwoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoNiksICcgICAgY291dCA8PCBcImdvb2RieWUgd29ybGQsIEdvb2RieWUhXCIgPDwgZW5kbDsnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDcpLCAnICAgIGNvdXQgPDwgXCJnb29kYnllIHdvcmxkIGFnYWluXCIgPDwgZW5kbDsnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDgpLCAnICAgIGNvdXQgPDwgXCJHb29kYnllIHdvcmxkIGFnYWluXCIgPDwgZW5kbDsnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDkpLCAnICAgIGNvdXQgPDwgXCJnb29kYnlld29ybGQgYWdhaW5cIiA8PCBlbmRsOycpO1xuXG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzEsIDEsIDEsIDFdLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0ZmluZFN0YXRlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZmluZFRlc3QoJ2lzc3VlICMxODcxMSByZXBsYWNlQWxsIHdpdGggZW1wdHkgc3RyaW5nJywgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IGZpbmRTdGF0ZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZFJlcGxhY2VTdGF0ZSgpKTtcblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgc2VhcmNoU3RyaW5nOiAnaGVsbG8nLCByZXBsYWNlU3RyaW5nOiAnJywgd2hvbGVXb3JkOiB0cnVlIH0sIGZhbHNlKTtcblx0XHRjb25zdCBmaW5kTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRNb2RlbEJvdW5kVG9FZGl0b3JNb2RlbChlZGl0b3IsIGZpbmRTdGF0ZSkpO1xuXG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzEsIDEsIDEsIDFdLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs2LCAyNywgNiwgMzJdLFxuXHRcdFx0XHRbNywgMTQsIDcsIDE5XSxcblx0XHRcdFx0WzgsIDE0LCA4LCAxOV1cblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0ZmluZE1vZGVsLnJlcGxhY2VBbGwoKTtcblx0XHRhc3NlcnRGaW5kU3RhdGUoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRbMSwgMSwgMSwgMV0sXG5cdFx0XHRudWxsLFxuXHRcdFx0W11cblx0XHQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoNiksICcgICAgY291dCA8PCBcIiB3b3JsZCwgIVwiIDw8IGVuZGw7Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCg3KSwgJyAgICBjb3V0IDw8IFwiIHdvcmxkIGFnYWluXCIgPDwgZW5kbDsnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDgpLCAnICAgIGNvdXQgPDwgXCIgd29ybGQgYWdhaW5cIiA8PCBlbmRsOycpO1xuXG5cdFx0ZmluZE1vZGVsLmRpc3Bvc2UoKTtcblx0XHRmaW5kU3RhdGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRmaW5kVGVzdCgnaXNzdWUgIzMyNTIyIHJlcGxhY2VBbGwgd2l0aCBeIG9uIG1vcmUgdGhhbiAxMDAwIG1hdGNoZXMnLCAoZWRpdG9yKSA9PiB7XG5cdFx0bGV0IGluaXRpYWxUZXh0ID0gJyc7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAxMTAwOyBpKyspIHtcblx0XHRcdGluaXRpYWxUZXh0ICs9ICdsaW5lJyArIGkgKyAnXFxuJztcblx0XHR9XG5cdFx0ZWRpdG9yLmdldE1vZGVsKCkhLnNldFZhbHVlKGluaXRpYWxUZXh0KTtcblx0XHRjb25zdCBmaW5kU3RhdGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ14nLCByZXBsYWNlU3RyaW5nOiAnYSAnLCBpc1JlZ2V4OiB0cnVlIH0sIGZhbHNlKTtcblx0XHRjb25zdCBmaW5kTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRNb2RlbEJvdW5kVG9FZGl0b3JNb2RlbChlZGl0b3IsIGZpbmRTdGF0ZSkpO1xuXG5cdFx0ZmluZE1vZGVsLnJlcGxhY2VBbGwoKTtcblxuXHRcdGxldCBleHBlY3RlZFRleHQgPSAnJztcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDExMDA7IGkrKykge1xuXHRcdFx0ZXhwZWN0ZWRUZXh0ICs9ICdhIGxpbmUnICsgaSArICdcXG4nO1xuXHRcdH1cblx0XHRleHBlY3RlZFRleHQgKz0gJ2EgJztcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldFZhbHVlKCksIGV4cGVjdGVkVGV4dCk7XG5cblx0XHRmaW5kTW9kZWwuZGlzcG9zZSgpO1xuXHRcdGZpbmRTdGF0ZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGZpbmRUZXN0KCdpc3N1ZSAjMTk3NDAgRmluZCBhbmQgcmVwbGFjZSBjYXB0dXJlIGdyb3VwL2JhY2tyZWZlcmVuY2UgaW5zZXJ0cyBgdW5kZWZpbmVkYCBpbnN0ZWFkIG9mIGVtcHR5IHN0cmluZycsIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBmaW5kU3RhdGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ2hlbGxvKHopPycsIHJlcGxhY2VTdHJpbmc6ICdoaSQxJywgaXNSZWdleDogdHJ1ZSwgbWF0Y2hDYXNlOiB0cnVlIH0sIGZhbHNlKTtcblx0XHRjb25zdCBmaW5kTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRNb2RlbEJvdW5kVG9FZGl0b3JNb2RlbChlZGl0b3IsIGZpbmRTdGF0ZSkpO1xuXG5cdFx0YXNzZXJ0RmluZFN0YXRlKFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0WzEsIDEsIDEsIDFdLFxuXHRcdFx0bnVsbCxcblx0XHRcdFtcblx0XHRcdFx0WzYsIDE0LCA2LCAxOV0sXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldLFxuXHRcdFx0XHRbOSwgMTQsIDksIDE5XVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRmaW5kTW9kZWwucmVwbGFjZUFsbCgpO1xuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXVxuXHRcdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCg2KSwgJyAgICBjb3V0IDw8IFwiaGkgd29ybGQsIEhlbGxvIVwiIDw8IGVuZGw7Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRMaW5lQ29udGVudCg3KSwgJyAgICBjb3V0IDw8IFwiaGkgd29ybGQgYWdhaW5cIiA8PCBlbmRsOycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvbnRlbnQoOSksICcgICAgY291dCA8PCBcImhpd29ybGQgYWdhaW5cIiA8PCBlbmRsOycpO1xuXG5cdFx0ZmluZE1vZGVsLmRpc3Bvc2UoKTtcblx0XHRmaW5kU3RhdGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRmaW5kVGVzdCgnaXNzdWUgIzI3MDgzLiBzZWFyY2ggc2NvcGUgd29ya3MgZXZlbiBpZiBpdCBpcyBhIHNpbmdsZSBsaW5lJywgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IGZpbmRTdGF0ZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZFJlcGxhY2VTdGF0ZSgpKTtcblx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgc2VhcmNoU3RyaW5nOiAnaGVsbG8nLCB3aG9sZVdvcmQ6IHRydWUsIHNlYXJjaFNjb3BlOiBbbmV3IFJhbmdlKDcsIDEsIDgsIDEpXSB9LCBmYWxzZSk7XG5cdFx0Y29uc3QgZmluZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kTW9kZWxCb3VuZFRvRWRpdG9yTW9kZWwoZWRpdG9yLCBmaW5kU3RhdGUpKTtcblxuXHRcdGFzc2VydEZpbmRTdGF0ZShcblx0XHRcdGVkaXRvcixcblx0XHRcdFsxLCAxLCAxLCAxXSxcblx0XHRcdG51bGwsXG5cdFx0XHRbXG5cdFx0XHRcdFs3LCAxNCwgNywgMTldXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGZpbmRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0ZmluZFN0YXRlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZmluZFRlc3QoJ2lzc3VlICMzNTE2OiBDb250cm9sIGJlaGF2aW9yIG9mIFwiTmV4dFwiIG9wZXJhdGlvbnMgKG5vdCBsb29waW5nIGJhY2sgdG8gYmVnaW5uaW5nKScsIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBmaW5kU3RhdGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ2hlbGxvJywgbG9vcDogZmFsc2UgfSwgZmFsc2UpO1xuXHRcdGNvbnN0IGZpbmRNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmluZE1vZGVsQm91bmRUb0VkaXRvck1vZGVsKGVkaXRvciwgZmluZFN0YXRlKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLm1hdGNoZXNDb3VudCwgNSk7XG5cblx0XHQvLyBUZXN0IG5leHQgb3BlcmF0aW9uc1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUubWF0Y2hlc1Bvc2l0aW9uLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlRm9yd2FyZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlQmFjaygpLCB0cnVlKTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9OZXh0TWF0Y2goKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLm1hdGNoZXNQb3NpdGlvbiwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5jYW5OYXZpZ2F0ZUZvcndhcmQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5jYW5OYXZpZ2F0ZUJhY2soKSwgZmFsc2UpO1xuXG5cdFx0ZmluZE1vZGVsLm1vdmVUb05leHRNYXRjaCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUubWF0Y2hlc1Bvc2l0aW9uLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlRm9yd2FyZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlQmFjaygpLCB0cnVlKTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9OZXh0TWF0Y2goKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLm1hdGNoZXNQb3NpdGlvbiwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5jYW5OYXZpZ2F0ZUZvcndhcmQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5jYW5OYXZpZ2F0ZUJhY2soKSwgdHJ1ZSk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvTmV4dE1hdGNoKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5tYXRjaGVzUG9zaXRpb24sIDQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUuY2FuTmF2aWdhdGVGb3J3YXJkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUuY2FuTmF2aWdhdGVCYWNrKCksIHRydWUpO1xuXG5cdFx0ZmluZE1vZGVsLm1vdmVUb05leHRNYXRjaCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUubWF0Y2hlc1Bvc2l0aW9uLCA1KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlRm9yd2FyZCgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5jYW5OYXZpZ2F0ZUJhY2soKSwgdHJ1ZSk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvTmV4dE1hdGNoKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5tYXRjaGVzUG9zaXRpb24sIDUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUuY2FuTmF2aWdhdGVGb3J3YXJkKCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlQmFjaygpLCB0cnVlKTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9OZXh0TWF0Y2goKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLm1hdGNoZXNQb3NpdGlvbiwgNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5jYW5OYXZpZ2F0ZUZvcndhcmQoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUuY2FuTmF2aWdhdGVCYWNrKCksIHRydWUpO1xuXG5cdFx0Ly8gVGVzdCBwcmV2aW91cyBvcGVyYXRpb25zXG5cdFx0ZmluZE1vZGVsLm1vdmVUb1ByZXZNYXRjaCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUubWF0Y2hlc1Bvc2l0aW9uLCA0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlRm9yd2FyZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlQmFjaygpLCB0cnVlKTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9QcmV2TWF0Y2goKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLm1hdGNoZXNQb3NpdGlvbiwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5jYW5OYXZpZ2F0ZUZvcndhcmQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5jYW5OYXZpZ2F0ZUJhY2soKSwgdHJ1ZSk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvUHJldk1hdGNoKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5tYXRjaGVzUG9zaXRpb24sIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUuY2FuTmF2aWdhdGVGb3J3YXJkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUuY2FuTmF2aWdhdGVCYWNrKCksIHRydWUpO1xuXG5cdFx0ZmluZE1vZGVsLm1vdmVUb1ByZXZNYXRjaCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUubWF0Y2hlc1Bvc2l0aW9uLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlRm9yd2FyZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlQmFjaygpLCBmYWxzZSk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvUHJldk1hdGNoKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5tYXRjaGVzUG9zaXRpb24sIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUuY2FuTmF2aWdhdGVGb3J3YXJkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUuY2FuTmF2aWdhdGVCYWNrKCksIGZhbHNlKTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9QcmV2TWF0Y2goKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLm1hdGNoZXNQb3NpdGlvbiwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5jYW5OYXZpZ2F0ZUZvcndhcmQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5jYW5OYXZpZ2F0ZUJhY2soKSwgZmFsc2UpO1xuXG5cdH0pO1xuXG5cdGZpbmRUZXN0KCdpc3N1ZSAjMzUxNjogQ29udHJvbCBiZWhhdmlvciBvZiBcIk5leHRcIiBvcGVyYXRpb25zIChsb29waW5nIGJhY2sgdG8gYmVnaW5uaW5nKScsIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBmaW5kU3RhdGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbmRSZXBsYWNlU3RhdGUoKSk7XG5cdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ2hlbGxvJyB9LCBmYWxzZSk7XG5cdFx0Y29uc3QgZmluZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaW5kTW9kZWxCb3VuZFRvRWRpdG9yTW9kZWwoZWRpdG9yLCBmaW5kU3RhdGUpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUubWF0Y2hlc0NvdW50LCA1KTtcblxuXHRcdC8vIFRlc3QgbmV4dCBvcGVyYXRpb25zXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5tYXRjaGVzUG9zaXRpb24sIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUuY2FuTmF2aWdhdGVGb3J3YXJkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUuY2FuTmF2aWdhdGVCYWNrKCksIHRydWUpO1xuXG5cdFx0ZmluZE1vZGVsLm1vdmVUb05leHRNYXRjaCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUubWF0Y2hlc1Bvc2l0aW9uLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlRm9yd2FyZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlQmFjaygpLCB0cnVlKTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9OZXh0TWF0Y2goKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLm1hdGNoZXNQb3NpdGlvbiwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5jYW5OYXZpZ2F0ZUZvcndhcmQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5jYW5OYXZpZ2F0ZUJhY2soKSwgdHJ1ZSk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvTmV4dE1hdGNoKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5tYXRjaGVzUG9zaXRpb24sIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUuY2FuTmF2aWdhdGVGb3J3YXJkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUuY2FuTmF2aWdhdGVCYWNrKCksIHRydWUpO1xuXG5cdFx0ZmluZE1vZGVsLm1vdmVUb05leHRNYXRjaCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUubWF0Y2hlc1Bvc2l0aW9uLCA0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlRm9yd2FyZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlQmFjaygpLCB0cnVlKTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9OZXh0TWF0Y2goKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLm1hdGNoZXNQb3NpdGlvbiwgNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5jYW5OYXZpZ2F0ZUZvcndhcmQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5jYW5OYXZpZ2F0ZUJhY2soKSwgdHJ1ZSk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvTmV4dE1hdGNoKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5tYXRjaGVzUG9zaXRpb24sIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUuY2FuTmF2aWdhdGVGb3J3YXJkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUuY2FuTmF2aWdhdGVCYWNrKCksIHRydWUpO1xuXG5cdFx0ZmluZE1vZGVsLm1vdmVUb05leHRNYXRjaCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUubWF0Y2hlc1Bvc2l0aW9uLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlRm9yd2FyZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlQmFjaygpLCB0cnVlKTtcblxuXHRcdC8vIFRlc3QgcHJldmlvdXMgb3BlcmF0aW9uc1xuXHRcdGZpbmRNb2RlbC5tb3ZlVG9QcmV2TWF0Y2goKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLm1hdGNoZXNQb3NpdGlvbiwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5jYW5OYXZpZ2F0ZUZvcndhcmQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5jYW5OYXZpZ2F0ZUJhY2soKSwgdHJ1ZSk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvUHJldk1hdGNoKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5tYXRjaGVzUG9zaXRpb24sIDUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUuY2FuTmF2aWdhdGVGb3J3YXJkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUuY2FuTmF2aWdhdGVCYWNrKCksIHRydWUpO1xuXG5cdFx0ZmluZE1vZGVsLm1vdmVUb1ByZXZNYXRjaCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUubWF0Y2hlc1Bvc2l0aW9uLCA0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlRm9yd2FyZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlQmFjaygpLCB0cnVlKTtcblxuXHRcdGZpbmRNb2RlbC5tb3ZlVG9QcmV2TWF0Y2goKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLm1hdGNoZXNQb3NpdGlvbiwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5jYW5OYXZpZ2F0ZUZvcndhcmQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5jYW5OYXZpZ2F0ZUJhY2soKSwgdHJ1ZSk7XG5cblx0XHRmaW5kTW9kZWwubW92ZVRvUHJldk1hdGNoKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRTdGF0ZS5tYXRjaGVzUG9zaXRpb24sIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUuY2FuTmF2aWdhdGVGb3J3YXJkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUuY2FuTmF2aWdhdGVCYWNrKCksIHRydWUpO1xuXG5cdFx0ZmluZE1vZGVsLm1vdmVUb1ByZXZNYXRjaCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kU3RhdGUubWF0Y2hlc1Bvc2l0aW9uLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlRm9yd2FyZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLmNhbk5hdmlnYXRlQmFjaygpLCB0cnVlKTtcblxuXHR9KTtcblxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyw4QkFBOEI7QUFFdkMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsMEJBQTBCO0FBRW5DLE1BQU0sYUFBYSxNQUFNO0FBRXhCLE1BQUk7QUFFSixRQUFNLE1BQU07QUFDWCxrQkFBYyxJQUFJLGdCQUFnQjtBQUFBLEVBQ25DLENBQUM7QUFFRCxXQUFTLE1BQU07QUFDZCxnQkFBWSxRQUFRO0FBQUEsRUFDckIsQ0FBQztBQUVELDBDQUF3QztBQUV4QyxXQUFTLFNBQVMsVUFBa0IsVUFBcUQ7QUFDeEYsU0FBSyxVQUFVLE1BQU07QUFDcEIsWUFBTSxVQUFVO0FBQUEsUUFDZjtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUNBLHlCQUFtQixTQUFTLENBQUMsR0FBRyxDQUFDLFdBQVcsU0FBUyxNQUEyQixDQUFDO0FBRWpGLFlBQU0sT0FBTyxRQUFRLEtBQUssSUFBSTtBQUM5QixZQUFNLFlBQVksSUFBSSwyQkFBMkI7QUFDakQsZ0JBQVUsWUFBWSxLQUFLLE9BQU8sR0FBRyxFQUFFLENBQUM7QUFDeEMsZ0JBQVUsWUFBWSxLQUFLLE9BQU8sSUFBSSxHQUFHLENBQUM7QUFDMUMsZ0JBQVUsWUFBWSxLQUFLLE9BQU8sS0FBSyxFQUFFLENBQUM7QUFDMUMsWUFBTSxVQUFVLFVBQVUsT0FBTztBQUNqQztBQUFBLFFBQ0M7QUFBQSxRQUNBLENBQUM7QUFBQSxRQUNELENBQUMsV0FBVyxTQUFTLE1BQTJCO0FBQUEsTUFDakQ7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBRUEsV0FBUyxVQUFVLEtBQXNCO0FBQ3hDLFdBQU8sQ0FBQyxJQUFJLGlCQUFpQixJQUFJLGFBQWEsSUFBSSxlQUFlLElBQUksU0FBUztBQUFBLEVBQy9FO0FBRUEsV0FBUyxjQUFjLFFBQXFCO0FBQzNDLFVBQU0sUUFBUSxPQUFPLFNBQVM7QUFDOUIsVUFBTSxxQkFBOEIsQ0FBQztBQUNyQyxVQUFNLGlCQUEwQixDQUFDO0FBRWpDLGVBQVcsT0FBTyxNQUFNLGtCQUFrQixHQUFHO0FBQzVDLFVBQUksSUFBSSxRQUFRLGNBQWMsb0JBQW9CO0FBQ2pELDJCQUFtQixLQUFLLElBQUksS0FBSztBQUNqQyx1QkFBZSxLQUFLLElBQUksS0FBSztBQUFBLE1BQzlCLFdBQVcsSUFBSSxRQUFRLGNBQWMsYUFBYTtBQUNqRCx1QkFBZSxLQUFLLElBQUksS0FBSztBQUFBLE1BQzlCO0FBQUEsSUFDRDtBQUVBLHVCQUFtQixLQUFLLE1BQU0sd0JBQXdCO0FBQ3RELG1CQUFlLEtBQUssTUFBTSx3QkFBd0I7QUFFbEQsV0FBTztBQUFBLE1BQ04sYUFBYSxtQkFBbUIsSUFBSSxTQUFTO0FBQUEsTUFDN0MsaUJBQWlCLGVBQWUsSUFBSSxTQUFTO0FBQUEsSUFDOUM7QUFBQSxFQUNEO0FBRUEsV0FBUyxnQkFBZ0IsUUFBcUIsUUFBa0IsYUFBOEIsaUJBQW1DO0FBQ2hJLFdBQU8sZ0JBQWdCLFVBQVUsT0FBTyxhQUFhLENBQUUsR0FBRyxRQUFRLFFBQVE7QUFFMUUsVUFBTSxnQkFBZ0I7QUFBQSxNQUNyQixhQUFhLGNBQWMsQ0FBQyxXQUFXLElBQUksQ0FBQztBQUFBLE1BQzVDO0FBQUEsSUFDRDtBQUNBLFdBQU8sZ0JBQWdCLGNBQWMsTUFBTSxHQUFHLGVBQWUsT0FBTztBQUFBLEVBQ3JFO0FBRUEsV0FBUywyQ0FBMkMsQ0FBQyxXQUFXO0FBQy9ELFdBQU8sWUFBWSxFQUFFLFlBQVksR0FBRyxRQUFRLEVBQUUsQ0FBQztBQUMvQyxVQUFNLFlBQVksWUFBWSxJQUFJLElBQUksaUJBQWlCLENBQUM7QUFDeEQsVUFBTSxZQUFZLFlBQVksSUFBSSxJQUFJLDRCQUE0QixRQUFRLFNBQVMsQ0FBQztBQUdwRixjQUFVLE9BQU8sRUFBRSxjQUFjLElBQUksR0FBRyxJQUFJO0FBQzVDO0FBQUEsTUFDQztBQUFBLE1BQ0EsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxNQUNiO0FBQUEsUUFDQyxDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxNQUNkO0FBQUEsSUFDRDtBQUdBLGNBQVUsT0FBTyxFQUFFLGNBQWMsS0FBSyxHQUFHLElBQUk7QUFDN0M7QUFBQSxNQUNDO0FBQUEsTUFDQSxDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxNQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2I7QUFBQSxRQUNDLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxNQUNkO0FBQUEsSUFDRDtBQUdBLGNBQVUsT0FBTyxFQUFFLGNBQWMsUUFBUSxHQUFHLElBQUk7QUFDaEQ7QUFBQSxNQUNDO0FBQUEsTUFDQSxDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxNQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2I7QUFBQSxRQUNDLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDZDtBQUFBLElBQ0Q7QUFHQSxjQUFVLE9BQU8sRUFBRSxXQUFXLEtBQUssR0FBRyxJQUFJO0FBQzFDO0FBQUEsTUFDQztBQUFBLE1BQ0EsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxNQUNiO0FBQUEsUUFDQyxDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2Q7QUFBQSxJQUNEO0FBR0EsY0FBVSxPQUFPLEVBQUUsY0FBYyxRQUFRLEdBQUcsSUFBSTtBQUNoRDtBQUFBLE1BQ0M7QUFBQSxNQUNBLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDYjtBQUFBLFFBQ0MsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2Q7QUFBQSxJQUNEO0FBR0EsY0FBVSxPQUFPLEVBQUUsV0FBVyxLQUFLLEdBQUcsSUFBSTtBQUMxQztBQUFBLE1BQ0M7QUFBQSxNQUNBLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDYjtBQUFBLFFBQ0MsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxNQUNkO0FBQUEsSUFDRDtBQUdBLGNBQVUsT0FBTyxFQUFFLFdBQVcsTUFBTSxHQUFHLElBQUk7QUFDM0M7QUFBQSxNQUNDO0FBQUEsTUFDQSxDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxNQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2I7QUFBQSxRQUNDLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2Q7QUFBQSxJQUNEO0FBR0EsY0FBVSxPQUFPLEVBQUUsV0FBVyxNQUFNLEdBQUcsSUFBSTtBQUMzQztBQUFBLE1BQ0M7QUFBQSxNQUNBLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDYjtBQUFBLFFBQ0MsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2Is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RyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDYjtBQUFBLFFBQ0MsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDZDtBQUFBLElBQ0Q7QUFFQSxjQUFVLGdCQUFnQjtBQUMxQjtBQUFBLE1BQ0M7QUFBQSxNQUNBLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDYjtBQUFBLFFBQ0MsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDZDtBQUFBLElBQ0Q7QUFFQSxjQUFVLGdCQUFnQjtBQUMxQjtBQUFBLE1BQ0M7QUFBQSxNQUNBLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDYjtBQUFBLFFBQ0MsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDZDtBQUFBLElBQ0Q7QUFFQSxjQUFVLGdCQUFnQjtBQUMxQjtBQUFBLE1BQ0M7QUFBQSxNQUNBLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDYjtBQUFBLFFBQ0MsQ0FBQyxHQUFH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TUFDQztBQUFBLE1BQ0EsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxNQUNiO0FBQUEsUUFDQyxDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxNQUNkO0FBQUEsSUFDRDtBQUVBLGNBQVUsZ0JBQWdCO0FBQzFCO0FBQUEsTUFDQztBQUFBLE1BQ0EsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxNQUNiO0FBQUEsUUFDQyxDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxNQUNkO0FBQUEsSUFDRDtBQUVBLGNBQVUsZ0JBQWdCO0FBQzFCO0FBQUEsTUFDQztBQUFBLE1BQ0EsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxNQUNiO0FBQUEsUUFDQyxDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxNQUNkO0FBQUEsSUFDRDtBQUVBLGNBQVUsZ0JBQWdCO0FBQzFCO0FBQUEsTUFDQztBQUFBLE1BQ0EsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxN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Q0FBQztBQUFBLFFBQ1gsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDWCxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFBQSxRQUNiLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztBQUFBLFFBQ2IsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQUEsTUFDZDtBQUFBLElBQ0Q7QUFFQSxjQUFVLGdCQUFnQjtBQUMxQjtBQUFBLE1BQ0M7QUFBQSxNQUNBLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ1gsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDWDtBQUFBLFFBQ0MsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDWCxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUNYLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ1gsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDWCxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUNYLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ1gsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDWCxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUNYLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ1gsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQUEsUUFDYixDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFBQSxRQUNiLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztBQUFBLE1BQ2Q7QUFBQSxJQUNEO0FBRUEsY0FBVSxnQkFBZ0I7QUFDMUI7QUFBQSxNQUNDO0FBQUEsTUFDQSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUNYLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ1g7QUFBQSxRQUNDLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ1gsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDWCxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUNYLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ1gsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDWCxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUNYLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ1gsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDWCxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUNYLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztBQUFBLFFBQ2IsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQUEsUUFDYixDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFBQSxNQUNkO0FBQUEsSUFDRDtBQUVBLGNBQVUsUUFBUTtBQUNsQixjQUFVLFFBQVE7QUFBQSxFQUNuQixDQUFDO0FBRUQsV0FBUyxVQUFVLENBQUMsV0FBVztBQUM5QixVQUFNLFlBQVksWUFBWSxJQUFJLElBQUksaUJBQWlCLENBQUM7QUFDeEQsY0FBVSxPQUFPLEVBQUUsY0FBYyxLQUFLLFNBQVMsS0FBSyxHQUFHLEtBQUs7QUFDNUQsVUFBTSxZQUFZLFlBQVksSUFBSSxJQUFJLDRCQUE0QixRQUFRLFNBQVMsQ0FBQztBQUVwRjtBQUFBLE1BQ0M7QUFBQSxNQUNBLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ1g7QUFBQSxNQUNBO0FBQUEsUUFDQyxDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUNYLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFBQSxRQUNiLENBQUMsSUFBSSxJQUFJLElBQUksRUFBRTtBQUFBLFFBQ2YsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQUEsTUFDZDtBQUFBLElBQ0Q7QUFFQSxjQUFVLGdCQUFnQjtBQUMxQjtBQUFBLE1BQ0M7QUFBQSxNQUNBLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDYjtBQUFBLFFBQ0MsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDWCxDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQUEsUUFDYixDQUFDLElBQUksSUFBSSxJQUFJLEVBQUU7QUFBQSxRQUNmLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztBQUFBLE1BQ2Q7QUFBQSxJQUNEO0FBRUEsY0FBVSxnQkFBZ0I7QUFDMUI7QUFBQSxNQUNDO0FBQUEsTUFDQSxDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxNQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2I7QUFBQSxRQUNDLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ1gsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztBQUFBLFFBQ2IsQ0FBQyxJQUFJLElBQUksSUFBSSxFQUFFO0FBQUEsUUFDZixDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFBQSxNQUNkO0FBQUEsSUFDRDtBQUVBLGNBQVUsZ0JBQWdCO0FBQzFCO0FBQUEsTUFDQztBQUFBLE1BQ0EsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxNQUNiO0FBQUEsUUFDQyxDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUNYLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNiLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ2IsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDYixDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFBQSxRQUNiLENBQUMsSUFBSSxJQUFJLElBQUks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LFFBQ1osQ0FBQyxHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDWixDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUNYLENBQUMsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1osQ0FBQyxHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDWixDQUFDLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNaLENBQUMsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1osQ0FBQyxHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDWixDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFBQSxRQUNiLENBQUMsSUFBSSxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ2QsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQUEsTUFDZDtBQUFBLElBQ0Q7QUFFQSxjQUFVLGdCQUFnQjtBQUMxQjtBQUFBLE1BQ0M7QUFBQSxNQUNBLENBQUMsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLE1BQ1osQ0FBQyxHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQUEsTUFDWjtBQUFBLFFBQ0MsQ0FBQyxHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDWixDQUFDLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNaLENBQUMsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1osQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDWCxDQUFDLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNaLENBQUMsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1osQ0FBQyxHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDWixDQUFDLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNaLENBQUMsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1osQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQUEsUUFDYixDQUFDLElBQUksR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUNkLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztBQUFBLE1BQ2Q7QUFBQSxJQUNEO0FBRUEsY0FBVSxRQUFRO0FBQ2xCLGNBQVUsUUFBUTtBQUFBLEVBQ25CLENBQUM7QUFFRCxXQUFTLGtCQUFrQixDQUFDLFdBQVc7QUFDdEMsVUFBTSxZQUFZLFlBQVksSUFBSSxJQUFJLGlCQUFpQixDQUFDO0FBQ3hELGNBQVUsT0FBTyxFQUFFLGNBQWMsUUFBUSxTQUFTLEtBQUssR0FBRyxLQUFLO0FBQy9ELFVBQU0sWUFBWSxZQUFZLElBQUksSUFBSSw0QkFBNEIsUUFBUSxTQUFTLENBQUM7QUFFcEY7QUFBQSxNQUNDO0FBQUEsTUFDQSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0MsQ0FBQyxHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDWixDQUFDLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNaLENBQUMsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1osQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDWCxDQUFDLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNaLENBQUMsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1osQ0FBQyxHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDWixDQUFDLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNaLENBQUMsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1osQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQUEsUUFDYixDQUFDLElBQUksR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUNkLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztBQUFBLE1BQ2Q7QUFBQSxJQUNEO0FBRUEsY0FBVSxnQkFBZ0I7QUFDMUI7QUFBQSxNQUNDO0FBQUEsTUFDQSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFBQSxNQUNiLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztBQUFBLE1BQ2I7QUFBQSxRQUNDLENBQUMsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1osQ0FBQyxHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDWixDQUFDLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNaLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ1gsQ0FBQyxHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDWixDQUFDLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNaLENBQUMsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1osQ0FBQyxHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDWixDQUFDLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNaLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztBQUFBLFFBQ2IsQ0FBQyxJQUFJLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDZCxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFBQSxNQUNkO0FBQUEsSUFDRDtBQUVBLGNBQVUsZ0JBQWdCO0FBQzFCO0FBQUEsTUFDQztBQUFBLE1BQ0EsQ0FBQyxJQUFJLEdBQUcsSUFBSSxFQUFFO0FBQUEsTUFDZCxDQUFDLElBQUksR0FBRyxJQUFJLEVBQUU7QUFBQSxNQUNkO0FBQUEsUUFDQyxDQUFDLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNaLENBQUMsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1osQ0FBQyxHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDWixDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUNYLENBQUMsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1osQ0FBQyxHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDWixDQUFDLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNaLENBQUMsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1osQ0FBQyxHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDWixDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFBQSxRQUNiLENBQUMsSUFBSSxHQUFHLElBQUksRUFB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
