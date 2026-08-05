import assert from "assert";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { CoreEditingCommands, CoreNavigationCommands } from "../../../browser/coreCommands.js";
import { EditOperation } from "../../../common/core/editOperation.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { Selection } from "../../../common/core/selection.js";
import { MetadataConsts, StandardTokenType } from "../../../common/encodedTokenAttributes.js";
import { EncodedTokenizationResult, TokenizationRegistry } from "../../../common/languages.js";
import { ILanguageService } from "../../../common/languages/language.js";
import { IndentAction } from "../../../common/languages/languageConfiguration.js";
import { ILanguageConfigurationService } from "../../../common/languages/languageConfigurationRegistry.js";
import { NullState } from "../../../common/languages/nullTokenize.js";
import { EndOfLinePreference, EndOfLineSequence } from "../../../common/model.js";
import { TextModel } from "../../../common/model/textModel.js";
import { OutgoingViewModelEventKind } from "../../../common/viewModelEventDispatcher.js";
import { createCodeEditorServices, instantiateTestCodeEditor, withTestCodeEditor } from "../testCodeEditor.js";
import { createTextModel, instantiateTextModel } from "../../common/testTextModel.js";
import { InputMode } from "../../../common/inputMode.js";
function moveTo(editor, viewModel, lineNumber, column, inSelectionMode = false) {
  if (inSelectionMode) {
    CoreNavigationCommands.MoveToSelect.runCoreEditorCommand(viewModel, {
      position: new Position(lineNumber, column)
    });
  } else {
    CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, {
      position: new Position(lineNumber, column)
    });
  }
}
function moveLeft(editor, viewModel, inSelectionMode = false) {
  if (inSelectionMode) {
    CoreNavigationCommands.CursorLeftSelect.runCoreEditorCommand(viewModel, {});
  } else {
    CoreNavigationCommands.CursorLeft.runCoreEditorCommand(viewModel, {});
  }
}
function moveRight(editor, viewModel, inSelectionMode = false) {
  if (inSelectionMode) {
    CoreNavigationCommands.CursorRightSelect.runCoreEditorCommand(viewModel, {});
  } else {
    CoreNavigationCommands.CursorRight.runCoreEditorCommand(viewModel, {});
  }
}
function moveDown(editor, viewModel, inSelectionMode = false) {
  if (inSelectionMode) {
    CoreNavigationCommands.CursorDownSelect.runCoreEditorCommand(viewModel, {});
  } else {
    CoreNavigationCommands.CursorDown.runCoreEditorCommand(viewModel, {});
  }
}
function moveUp(editor, viewModel, inSelectionMode = false) {
  if (inSelectionMode) {
    CoreNavigationCommands.CursorUpSelect.runCoreEditorCommand(viewModel, {});
  } else {
    CoreNavigationCommands.CursorUp.runCoreEditorCommand(viewModel, {});
  }
}
function moveToBeginningOfLine(editor, viewModel, inSelectionMode = false) {
  if (inSelectionMode) {
    CoreNavigationCommands.CursorHomeSelect.runCoreEditorCommand(viewModel, {});
  } else {
    CoreNavigationCommands.CursorHome.runCoreEditorCommand(viewModel, {});
  }
}
function moveToEndOfLine(editor, viewModel, inSelectionMode = false) {
  if (inSelectionMode) {
    CoreNavigationCommands.CursorEndSelect.runCoreEditorCommand(viewModel, {});
  } else {
    CoreNavigationCommands.CursorEnd.runCoreEditorCommand(viewModel, {});
  }
}
function moveToBeginningOfBuffer(editor, viewModel, inSelectionMode = false) {
  if (inSelectionMode) {
    CoreNavigationCommands.CursorTopSelect.runCoreEditorCommand(viewModel, {});
  } else {
    CoreNavigationCommands.CursorTop.runCoreEditorCommand(viewModel, {});
  }
}
function moveToEndOfBuffer(editor, viewModel, inSelectionMode = false) {
  if (inSelectionMode) {
    CoreNavigationCommands.CursorBottomSelect.runCoreEditorCommand(viewModel, {});
  } else {
    CoreNavigationCommands.CursorBottom.runCoreEditorCommand(viewModel, {});
  }
}
function assertCursor(viewModel, what) {
  let selections;
  if (what instanceof Position) {
    selections = [new Selection(what.lineNumber, what.column, what.lineNumber, what.column)];
  } else if (what instanceof Selection) {
    selections = [what];
  } else {
    selections = what;
  }
  const actual = viewModel.getSelections().map((s) => s.toString());
  const expected = selections.map((s) => s.toString());
  assert.deepStrictEqual(actual, expected);
}
suite("Editor Controller - Cursor", () => {
  const LINE1 = "    	My First Line	 ";
  const LINE2 = "	My Second Line";
  const LINE3 = "    Third Line\u{1F436}";
  const LINE4 = "";
  const LINE5 = "1";
  const TEXT = LINE1 + "\r\n" + LINE2 + "\n" + LINE3 + "\n" + LINE4 + "\r\n" + LINE5;
  function runTest(callback) {
    withTestCodeEditor(TEXT, {}, (editor, viewModel) => {
      callback(editor, viewModel);
    });
  }
  ensureNoDisposablesAreLeakedInTestSuite();
  test("cursor initialized", () => {
    runTest((editor, viewModel) => {
      assertCursor(viewModel, new Position(1, 1));
    });
  });
  test("no move", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 1);
      assertCursor(viewModel, new Position(1, 1));
    });
  });
  test("move", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 2);
      assertCursor(viewModel, new Position(1, 2));
    });
  });
  test("move in selection mode", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 2, true);
      assertCursor(viewModel, new Selection(1, 1, 1, 2));
    });
  });
  test("move beyond line end", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 25);
      assertCursor(viewModel, new Position(1, LINE1.length + 1));
    });
  });
  test("move empty line", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 4, 20);
      assertCursor(viewModel, new Position(4, 1));
    });
  });
  test("move one char line", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 5, 20);
      assertCursor(viewModel, new Position(5, 2));
    });
  });
  test("selection down", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 2, 1, true);
      assertCursor(viewModel, new Selection(1, 1, 2, 1));
    });
  });
  test("move and then select", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 2, 3);
      assertCursor(viewModel, new Position(2, 3));
      moveTo(editor, viewModel, 2, 15, true);
      assertCursor(viewModel, new Selection(2, 3, 2, 15));
      moveTo(editor, viewModel, 1, 2, true);
      assertCursor(viewModel, new Selection(2, 3, 1, 2));
    });
  });
  test("move left on top left position", () => {
    runTest((editor, viewModel) => {
      moveLeft(editor, viewModel);
      assertCursor(viewModel, new Position(1, 1));
    });
  });
  test("move left", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 3);
      assertCursor(viewModel, new Position(1, 3));
      moveLeft(editor, viewModel);
      assertCursor(viewModel, new Position(1, 2));
    });
  });
  test("move left with surrogate pair", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 3, 17);
      assertCursor(viewModel, new Position(3, 17));
      moveLeft(editor, viewModel);
      assertCursor(viewModel, new Position(3, 15));
    });
  });
  test("move left goes to previous row", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 2, 1);
      assertCursor(viewModel, new Position(2, 1));
      moveLeft(editor, viewModel);
      assertCursor(viewModel, new Position(1, 21));
    });
  });
  test("move left selection", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 2, 1);
      assertCursor(viewModel, new Position(2, 1));
      moveLeft(editor, viewModel, true);
      assertCursor(viewModel, new Selection(2, 1, 1, 21));
    });
  });
  test("move right on bottom right position", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 5, 2);
      assertCursor(viewModel, new Position(5, 2));
      moveRight(editor, viewModel);
      assertCursor(viewModel, new Position(5, 2));
    });
  });
  test("move right", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 3);
      assertCursor(viewModel, new Position(1, 3));
      moveRight(editor, viewModel);
      assertCursor(viewModel, new Position(1, 4));
    });
  });
  test("move right with surrogate pair", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 3, 15);
      assertCursor(viewModel, new Position(3, 15));
      moveRight(editor, viewModel);
      assertCursor(viewModel, new Position(3, 17));
    });
  });
  test("move right goes to next row", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 21);
      assertCursor(viewModel, new Position(1, 21));
      moveRight(editor, viewModel);
      assertCursor(viewModel, new Position(2, 1));
    });
  });
  test("move right selection", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 21);
      assertCursor(viewModel, new Position(1, 21));
      moveRight(editor, viewModel, true);
      assertCursor(viewModel, new Selection(1, 21, 2, 1));
    });
  });
  test("move down", () => {
    runTest((editor, viewModel) => {
      moveDown(editor, viewModel);
      assertCursor(viewModel, new Position(2, 1));
      moveDown(editor, viewModel);
      assertCursor(viewModel, new Position(3, 1));
      moveDown(editor, viewModel);
      assertCursor(viewModel, new Position(4, 1));
      moveDown(editor, viewModel);
      assertCursor(viewModel, new Position(5, 1));
      moveDown(editor, viewModel);
      assertCursor(viewModel, new Position(5, 2));
    });
  });
  test("move down with selection", () => {
    runTest((editor, viewModel) => {
      moveDown(editor, viewModel, true);
      assertCursor(viewModel, new Selection(1, 1, 2, 1));
      moveDown(editor, viewModel, true);
      assertCursor(viewModel, new Selection(1, 1, 3, 1));
      moveDown(editor, viewModel, true);
      assertCursor(viewModel, new Selection(1, 1, 4, 1));
      moveDown(editor, viewModel, true);
      assertCursor(viewModel, new Selection(1, 1, 5, 1));
      moveDown(editor, viewModel, true);
      assertCursor(viewModel, new Selection(1, 1, 5, 2));
    });
  });
  test("move down with tabs", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 5);
      assertCursor(viewModel, new Position(1, 5));
      moveDown(editor, viewModel);
      assertCursor(viewModel, new Position(2, 2));
      moveDown(editor, viewModel);
      assertCursor(viewModel, new Position(3, 5));
      moveDown(editor, viewModel);
      assertCursor(viewModel, new Position(4, 1));
      moveDown(editor, viewModel);
      assertCursor(viewModel, new Position(5, 2));
    });
  });
  test("move up", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 3, 5);
      assertCursor(viewModel, new Position(3, 5));
      moveUp(editor, viewModel);
      assertCursor(viewModel, new Position(2, 2));
      moveUp(editor, viewModel);
      assertCursor(viewModel, new Position(1, 5));
    });
  });
  test("move up with selection", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 3, 5);
      assertCursor(viewModel, new Position(3, 5));
      moveUp(editor, viewModel, true);
      assertCursor(viewModel, new Selection(3, 5, 2, 2));
      moveUp(editor, viewModel, true);
      assertCursor(viewModel, new Selection(3, 5, 1, 5));
    });
  });
  test("move up and down with tabs", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 5);
      assertCursor(viewModel, new Position(1, 5));
      moveDown(editor, viewModel);
      moveDown(editor, viewModel);
      moveDown(editor, viewModel);
      moveDown(editor, viewModel);
      assertCursor(viewModel, new Position(5, 2));
      moveUp(editor, viewModel);
      assertCursor(viewModel, new Position(4, 1));
      moveUp(editor, viewModel);
      assertCursor(viewModel, new Position(3, 5));
      moveUp(editor, viewModel);
      assertCursor(viewModel, new Position(2, 2));
      moveUp(editor, viewModel);
      assertCursor(viewModel, new Position(1, 5));
    });
  });
  test("move up and down with end of lines starting from a long one", () => {
    runTest((editor, viewModel) => {
      moveToEndOfLine(editor, viewModel);
      assertCursor(viewModel, new Position(1, LINE1.length + 1));
      moveToEndOfLine(editor, viewModel);
      assertCursor(viewModel, new Position(1, LINE1.length + 1));
      moveDown(editor, viewModel);
      assertCursor(viewModel, new Position(2, LINE2.length + 1));
      moveDown(editor, viewModel);
      assertCursor(viewModel, new Position(3, LINE3.length + 1));
      moveDown(editor, viewModel);
      assertCursor(viewModel, new Position(4, LINE4.length + 1));
      moveDown(editor, viewModel);
      assertCursor(viewModel, new Position(5, LINE5.length + 1));
      moveUp(editor, viewModel);
      moveUp(editor, viewModel);
      moveUp(editor, viewModel);
      moveUp(editor, viewModel);
      assertCursor(viewModel, new Position(1, LINE1.length + 1));
    });
  });
  test("issue #44465: cursor position not correct when move", () => {
    runTest((editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 5, 1, 5)]);
      moveUp(editor, viewModel);
      assertCursor(viewModel, new Position(1, 1));
      moveDown(editor, viewModel);
      assertCursor(viewModel, new Position(2, 2));
      moveUp(editor, viewModel);
      assertCursor(viewModel, new Position(1, 5));
      moveUp(editor, viewModel);
      assertCursor(viewModel, new Position(1, 1));
      moveUp(editor, viewModel);
      assertCursor(viewModel, new Position(1, 1));
      moveDown(editor, viewModel);
      assertCursor(viewModel, new Position(2, 1));
    });
  });
  test("issue #144041: Cursor up/down works", () => {
    const model = createTextModel(
      [
        "Word1 Word2 Word3 Word4",
        "Word5 Word6 Word7 Word8"
      ].join("\n")
    );
    withTestCodeEditor(model, { wrappingIndent: "indent", wordWrap: "wordWrapColumn", wordWrapColumn: 20 }, (editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 1, 1, 1)]);
      const cursorPositions = [];
      function reportCursorPosition() {
        cursorPositions.push(viewModel.getCursorStates()[0].viewState.position.toString());
      }
      reportCursorPosition();
      CoreNavigationCommands.CursorDown.runEditorCommand(null, editor, null);
      reportCursorPosition();
      CoreNavigationCommands.CursorDown.runEditorCommand(null, editor, null);
      reportCursorPosition();
      CoreNavigationCommands.CursorDown.runEditorCommand(null, editor, null);
      reportCursorPosition();
      CoreNavigationCommands.CursorDown.runEditorCommand(null, editor, null);
      reportCursorPosition();
      CoreNavigationCommands.CursorUp.runEditorCommand(null, editor, null);
      reportCursorPosition();
      CoreNavigationCommands.CursorUp.runEditorCommand(null, editor, null);
      reportCursorPosition();
      CoreNavigationCommands.CursorUp.runEditorCommand(null, editor, null);
      reportCursorPosition();
      CoreNavigationCommands.CursorUp.runEditorCommand(null, editor, null);
      reportCursorPosition();
      assert.deepStrictEqual(cursorPositions, [
        "(1,1)",
        "(2,5)",
        "(3,1)",
        "(4,5)",
        "(4,10)",
        "(3,1)",
        "(2,5)",
        "(1,1)",
        "(1,1)"
      ]);
    });
    model.dispose();
  });
  test("issue #140195: Cursor up/down makes progress", () => {
    const model = createTextModel(
      [
        "Word1 Word2 Word3 Word4",
        "Word5 Word6 Word7 Word8"
      ].join("\n")
    );
    withTestCodeEditor(model, { wrappingIndent: "indent", wordWrap: "wordWrapColumn", wordWrapColumn: 20 }, (editor, viewModel) => {
      editor.changeDecorations((changeAccessor) => {
        changeAccessor.deltaDecorations([], [
          {
            range: new Range(1, 22, 1, 22),
            options: {
              showIfCollapsed: true,
              description: "test",
              after: {
                content: "some very very very very very very very very long text"
              }
            }
          }
        ]);
      });
      viewModel.setSelections("test", [new Selection(1, 1, 1, 1)]);
      const cursorPositions = [];
      function reportCursorPosition() {
        cursorPositions.push(viewModel.getCursorStates()[0].viewState.position.toString());
      }
      reportCursorPosition();
      CoreNavigationCommands.CursorDown.runEditorCommand(null, editor, null);
      reportCursorPosition();
      CoreNavigationCommands.CursorDown.runEditorCommand(null, editor, null);
      reportCursorPosition();
      CoreNavigationCommands.CursorDown.runEditorCommand(null, editor, null);
      reportCursorPosition();
      CoreNavigationCommands.CursorDown.runEditorCommand(null, editor, null);
      reportCursorPosition();
      CoreNavigationCommands.CursorUp.runEditorCommand(null, editor, null);
      reportCursorPosition();
      CoreNavigationCommands.CursorUp.runEditorCommand(null, editor, null);
      reportCursorPosition();
      CoreNavigationCommands.CursorUp.runEditorCommand(null, editor, null);
      reportCursorPosition();
      CoreNavigationCommands.CursorUp.runEditorCommand(null, editor, null);
      reportCursorPosition();
      assert.deepStrictEqual(cursorPositions, [
        "(1,1)",
        "(2,5)",
        "(5,19)",
        "(6,1)",
        "(7,5)",
        "(6,1)",
        "(2,8)",
        "(1,1)",
        "(1,1)"
      ]);
    });
    model.dispose();
  });
  test("move to beginning of line", () => {
    runTest((editor, viewModel) => {
      moveToBeginningOfLine(editor, viewModel);
      assertCursor(viewModel, new Position(1, 6));
      moveToBeginningOfLine(editor, viewModel);
      assertCursor(viewModel, new Position(1, 1));
    });
  });
  test("move to beginning of line from within line", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 8);
      moveToBeginningOfLine(editor, viewModel);
      assertCursor(viewModel, new Position(1, 6));
      moveToBeginningOfLine(editor, viewModel);
      assertCursor(viewModel, new Position(1, 1));
    });
  });
  test("move to beginning of line from whitespace at beginning of line", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 2);
      moveToBeginningOfLine(editor, viewModel);
      assertCursor(viewModel, new Position(1, 6));
      moveToBeginningOfLine(editor, viewModel);
      assertCursor(viewModel, new Position(1, 1));
    });
  });
  test("move to beginning of line from within line selection", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 8);
      moveToBeginningOfLine(editor, viewModel, true);
      assertCursor(viewModel, new Selection(1, 8, 1, 6));
      moveToBeginningOfLine(editor, viewModel, true);
      assertCursor(viewModel, new Selection(1, 8, 1, 1));
    });
  });
  test("move to beginning of line with selection multiline forward", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 8);
      moveTo(editor, viewModel, 3, 9, true);
      moveToBeginningOfLine(editor, viewModel, false);
      assertCursor(viewModel, new Selection(3, 5, 3, 5));
    });
  });
  test("move to beginning of line with selection multiline backward", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 3, 9);
      moveTo(editor, viewModel, 1, 8, true);
      moveToBeginningOfLine(editor, viewModel, false);
      assertCursor(viewModel, new Selection(1, 6, 1, 6));
    });
  });
  test("move to beginning of line with selection single line forward", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 3, 2);
      moveTo(editor, viewModel, 3, 9, true);
      moveToBeginningOfLine(editor, viewModel, false);
      assertCursor(viewModel, new Selection(3, 5, 3, 5));
    });
  });
  test("move to beginning of line with selection single line backward", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 3, 9);
      moveTo(editor, viewModel, 3, 2, true);
      moveToBeginningOfLine(editor, viewModel, false);
      assertCursor(viewModel, new Selection(3, 5, 3, 5));
    });
  });
  test('issue #15401: "End" key is behaving weird when text is selected part 1', () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 8);
      moveTo(editor, viewModel, 3, 9, true);
      moveToBeginningOfLine(editor, viewModel, false);
      assertCursor(viewModel, new Selection(3, 5, 3, 5));
    });
  });
  test("issue #17011: Shift+home/end now go to the end of the selection start's line, not the selection's end", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 8);
      moveTo(editor, viewModel, 3, 9, true);
      moveToBeginningOfLine(editor, viewModel, true);
      assertCursor(viewModel, new Selection(1, 8, 3, 5));
    });
  });
  test("move to end of line", () => {
    runTest((editor, viewModel) => {
      moveToEndOfLine(editor, viewModel);
      assertCursor(viewModel, new Position(1, LINE1.length + 1));
      moveToEndOfLine(editor, viewModel);
      assertCursor(viewModel, new Position(1, LINE1.length + 1));
    });
  });
  test("move to end of line from within line", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 6);
      moveToEndOfLine(editor, viewModel);
      assertCursor(viewModel, new Position(1, LINE1.length + 1));
      moveToEndOfLine(editor, viewModel);
      assertCursor(viewModel, new Position(1, LINE1.length + 1));
    });
  });
  test("move to end of line from whitespace at end of line", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 20);
      moveToEndOfLine(editor, viewModel);
      assertCursor(viewModel, new Position(1, LINE1.length + 1));
      moveToEndOfLine(editor, viewModel);
      assertCursor(viewModel, new Position(1, LINE1.length + 1));
    });
  });
  test("move to end of line from within line selection", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 6);
      moveToEndOfLine(editor, viewModel, true);
      assertCursor(viewModel, new Selection(1, 6, 1, LINE1.length + 1));
      moveToEndOfLine(editor, viewModel, true);
      assertCursor(viewModel, new Selection(1, 6, 1, LINE1.length + 1));
    });
  });
  test("move to end of line with selection multiline forward", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 1);
      moveTo(editor, viewModel, 3, 9, true);
      moveToEndOfLine(editor, viewModel, false);
      assertCursor(viewModel, new Selection(3, 17, 3, 17));
    });
  });
  test("move to end of line with selection multiline backward", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 3, 9);
      moveTo(editor, viewModel, 1, 1, true);
      moveToEndOfLine(editor, viewModel, false);
      assertCursor(viewModel, new Selection(1, 21, 1, 21));
    });
  });
  test("move to end of line with selection single line forward", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 3, 1);
      moveTo(editor, viewModel, 3, 9, true);
      moveToEndOfLine(editor, viewModel, false);
      assertCursor(viewModel, new Selection(3, 17, 3, 17));
    });
  });
  test("move to end of line with selection single line backward", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 3, 9);
      moveTo(editor, viewModel, 3, 1, true);
      moveToEndOfLine(editor, viewModel, false);
      assertCursor(viewModel, new Selection(3, 17, 3, 17));
    });
  });
  test('issue #15401: "End" key is behaving weird when text is selected part 2', () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 1);
      moveTo(editor, viewModel, 3, 9, true);
      moveToEndOfLine(editor, viewModel, false);
      assertCursor(viewModel, new Selection(3, 17, 3, 17));
    });
  });
  test("move to beginning of buffer", () => {
    runTest((editor, viewModel) => {
      moveToBeginningOfBuffer(editor, viewModel);
      assertCursor(viewModel, new Position(1, 1));
    });
  });
  test("move to beginning of buffer from within first line", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 3);
      moveToBeginningOfBuffer(editor, viewModel);
      assertCursor(viewModel, new Position(1, 1));
    });
  });
  test("move to beginning of buffer from within another line", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 3, 3);
      moveToBeginningOfBuffer(editor, viewModel);
      assertCursor(viewModel, new Position(1, 1));
    });
  });
  test("move to beginning of buffer from within first line selection", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 1, 3);
      moveToBeginningOfBuffer(editor, viewModel, true);
      assertCursor(viewModel, new Selection(1, 3, 1, 1));
    });
  });
  test("move to beginning of buffer from within another line selection", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 3, 3);
      moveToBeginningOfBuffer(editor, viewModel, true);
      assertCursor(viewModel, new Selection(3, 3, 1, 1));
    });
  });
  test("move to end of buffer", () => {
    runTest((editor, viewModel) => {
      moveToEndOfBuffer(editor, viewModel);
      assertCursor(viewModel, new Position(5, LINE5.length + 1));
    });
  });
  test("move to end of buffer from within last line", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 5, 1);
      moveToEndOfBuffer(editor, viewModel);
      assertCursor(viewModel, new Position(5, LINE5.length + 1));
    });
  });
  test("move to end of buffer from within another line", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 3, 3);
      moveToEndOfBuffer(editor, viewModel);
      assertCursor(viewModel, new Position(5, LINE5.length + 1));
    });
  });
  test("move to end of buffer from within last line selection", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 5, 1);
      moveToEndOfBuffer(editor, viewModel, true);
      assertCursor(viewModel, new Selection(5, 1, 5, LINE5.length + 1));
    });
  });
  test("move to end of buffer from within another line selection", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 3, 3);
      moveToEndOfBuffer(editor, viewModel, true);
      assertCursor(viewModel, new Selection(3, 3, 5, LINE5.length + 1));
    });
  });
  test("select all", () => {
    runTest((editor, viewModel) => {
      CoreNavigationCommands.SelectAll.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, new Selection(1, 1, 5, LINE5.length + 1));
    });
  });
  test("no move doesn't trigger event", () => {
    runTest((editor, viewModel) => {
      const disposable = viewModel.onEvent((e) => {
        assert.ok(false, "was not expecting event");
      });
      moveTo(editor, viewModel, 1, 1);
      disposable.dispose();
    });
  });
  test("move eventing", () => {
    runTest((editor, viewModel) => {
      let events = 0;
      const disposable = viewModel.onEvent((e) => {
        if (e.kind === OutgoingViewModelEventKind.CursorStateChanged) {
          events++;
          assert.deepStrictEqual(e.selections, [new Selection(1, 2, 1, 2)]);
        }
      });
      moveTo(editor, viewModel, 1, 2);
      assert.strictEqual(events, 1, "receives 1 event");
      disposable.dispose();
    });
  });
  test("move in selection mode eventing", () => {
    runTest((editor, viewModel) => {
      let events = 0;
      const disposable = viewModel.onEvent((e) => {
        if (e.kind === OutgoingViewModelEventKind.CursorStateChanged) {
          events++;
          assert.deepStrictEqual(e.selections, [new Selection(1, 1, 1, 2)]);
        }
      });
      moveTo(editor, viewModel, 1, 2, true);
      assert.strictEqual(events, 1, "receives 1 event");
      disposable.dispose();
    });
  });
  test("saveState & restoreState", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 2, 1, true);
      assertCursor(viewModel, new Selection(1, 1, 2, 1));
      const savedState = JSON.stringify(viewModel.saveCursorState());
      moveTo(editor, viewModel, 1, 1, false);
      assertCursor(viewModel, new Position(1, 1));
      viewModel.restoreCursorState(JSON.parse(savedState));
      assertCursor(viewModel, new Selection(1, 1, 2, 1));
    });
  });
  test("Independent model edit 1", () => {
    runTest((editor, viewModel) => {
      moveTo(editor, viewModel, 2, 16, true);
      editor.getModel().applyEdits([EditOperation.delete(new Range(2, 1, 2, 2))]);
      assertCursor(viewModel, new Selection(1, 1, 2, 15));
    });
  });
  test("column select 1", () => {
    withTestCodeEditor([
      "	private compute(a:number): boolean {",
      "		if (a + 3 === 0 || a + 5 === 0) {",
      "			return false;",
      "		}",
      "	}"
    ], {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 1, 7, false);
      assertCursor(viewModel, new Position(1, 7));
      CoreNavigationCommands.ColumnSelect.runCoreEditorCommand(viewModel, {
        position: new Position(4, 4),
        viewPosition: new Position(4, 4),
        mouseColumn: 15,
        doColumnSelect: true
      });
      const expectedSelections = [
        new Selection(1, 7, 1, 12),
        new Selection(2, 4, 2, 9),
        new Selection(3, 3, 3, 6),
        new Selection(4, 4, 4, 4)
      ];
      assertCursor(viewModel, expectedSelections);
    });
  });
  test("grapheme breaking", () => {
    withTestCodeEditor([
      "abcabc",
      "a\u0303a\u0303a\u0303a\u0303a\u0303a\u0303",
      "\u8FBB\u{E0100}\u8FBB\u{E0100}\u8FBB\u{E0100}",
      "\u0BAA\u0BC1"
    ], {}, (editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(2, 1, 2, 1)]);
      moveRight(editor, viewModel);
      assertCursor(viewModel, new Position(2, 3));
      moveLeft(editor, viewModel);
      assertCursor(viewModel, new Position(2, 1));
      viewModel.setSelections("test", [new Selection(3, 1, 3, 1)]);
      moveRight(editor, viewModel);
      assertCursor(viewModel, new Position(3, 4));
      moveLeft(editor, viewModel);
      assertCursor(viewModel, new Position(3, 1));
      viewModel.setSelections("test", [new Selection(4, 1, 4, 1)]);
      moveRight(editor, viewModel);
      assertCursor(viewModel, new Position(4, 3));
      moveLeft(editor, viewModel);
      assertCursor(viewModel, new Position(4, 1));
      viewModel.setSelections("test", [new Selection(1, 3, 1, 3)]);
      moveDown(editor, viewModel);
      assertCursor(viewModel, new Position(2, 5));
      moveDown(editor, viewModel);
      assertCursor(viewModel, new Position(3, 4));
      moveUp(editor, viewModel);
      assertCursor(viewModel, new Position(2, 5));
      moveUp(editor, viewModel);
      assertCursor(viewModel, new Position(1, 3));
    });
  });
  test("issue #4905 - column select is biased to the right", () => {
    withTestCodeEditor([
      'var gulp = require("gulp");',
      'var path = require("path");',
      'var rimraf = require("rimraf");',
      'var isarray = require("isarray");',
      'var merge = require("merge-stream");',
      'var concat = require("gulp-concat");',
      'var newer = require("gulp-newer");'
    ].join("\n"), {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 1, 4, false);
      assertCursor(viewModel, new Position(1, 4));
      CoreNavigationCommands.ColumnSelect.runCoreEditorCommand(viewModel, {
        position: new Position(4, 1),
        viewPosition: new Position(4, 1),
        mouseColumn: 1,
        doColumnSelect: true
      });
      assertCursor(viewModel, [
        new Selection(1, 4, 1, 1),
        new Selection(2, 4, 2, 1),
        new Selection(3, 4, 3, 1),
        new Selection(4, 4, 4, 1)
      ]);
    });
  });
  test("issue #20087: column select with mouse", () => {
    withTestCodeEditor([
      '<property id="SomeThing" key="SomeKey" value="000"/>',
      '<property id="SomeThing" key="SomeKey" value="000"/>',
      '<property id="SomeThing" Key="SomeKey" value="000"/>',
      '<property id="SomeThing" key="SomeKey" value="000"/>',
      '<property id="SomeThing" key="SoMEKEy" value="000"/>',
      '<property id="SomeThing" key="SomeKey" value="000"/>',
      '<property id="SomeThing" key="SomeKey" value="000"/>',
      '<property id="SomeThing" key="SomeKey" valuE="000"/>',
      '<property id="SomeThing" key="SomeKey" value="000"/>',
      '<property id="SomeThing" key="SomeKey" value="00X"/>'
    ].join("\n"), {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 10, 10, false);
      assertCursor(viewModel, new Position(10, 10));
      CoreNavigationCommands.ColumnSelect.runCoreEditorCommand(viewModel, {
        position: new Position(1, 1),
        viewPosition: new Position(1, 1),
        mouseColumn: 1,
        doColumnSelect: true
      });
      assertCursor(viewModel, [
        new Selection(10, 10, 10, 1),
        new Selection(9, 10, 9, 1),
        new Selection(8, 10, 8, 1),
        new Selection(7, 10, 7, 1),
        new Selection(6, 10, 6, 1),
        new Selection(5, 10, 5, 1),
        new Selection(4, 10, 4, 1),
        new Selection(3, 10, 3, 1),
        new Selection(2, 10, 2, 1),
        new Selection(1, 10, 1, 1)
      ]);
      CoreNavigationCommands.ColumnSelect.runCoreEditorCommand(viewModel, {
        position: new Position(1, 1),
        viewPosition: new Position(1, 1),
        mouseColumn: 1,
        doColumnSelect: true
      });
      assertCursor(viewModel, [
        new Selection(10, 10, 10, 1),
        new Selection(9, 10, 9, 1),
        new Selection(8, 10, 8, 1),
        new Selection(7, 10, 7, 1),
        new Selection(6, 10, 6, 1),
        new Selection(5, 10, 5, 1),
        new Selection(4, 10, 4, 1),
        new Selection(3, 10, 3, 1),
        new Selection(2, 10, 2, 1),
        new Selection(1, 10, 1, 1)
      ]);
    });
  });
  test("issue #20087: column select with keyboard", () => {
    withTestCodeEditor([
      '<property id="SomeThing" key="SomeKey" value="000"/>',
      '<property id="SomeThing" key="SomeKey" value="000"/>',
      '<property id="SomeThing" Key="SomeKey" value="000"/>',
      '<property id="SomeThing" key="SomeKey" value="000"/>',
      '<property id="SomeThing" key="SoMEKEy" value="000"/>',
      '<property id="SomeThing" key="SomeKey" value="000"/>',
      '<property id="SomeThing" key="SomeKey" value="000"/>',
      '<property id="SomeThing" key="SomeKey" valuE="000"/>',
      '<property id="SomeThing" key="SomeKey" value="000"/>',
      '<property id="SomeThing" key="SomeKey" value="00X"/>'
    ].join("\n"), {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 10, 10, false);
      assertCursor(viewModel, new Position(10, 10));
      CoreNavigationCommands.CursorColumnSelectLeft.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(10, 10, 10, 9)
      ]);
      CoreNavigationCommands.CursorColumnSelectLeft.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(10, 10, 10, 8)
      ]);
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(10, 10, 10, 9)
      ]);
      CoreNavigationCommands.CursorColumnSelectUp.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(10, 10, 10, 9),
        new Selection(9, 10, 9, 9)
      ]);
      CoreNavigationCommands.CursorColumnSelectDown.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(10, 10, 10, 9)
      ]);
    });
  });
  test("issue #118062: Column selection cannot select first position of a line", () => {
    withTestCodeEditor([
      "hello world"
    ].join("\n"), {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 1, 2, false);
      assertCursor(viewModel, new Position(1, 2));
      CoreNavigationCommands.CursorColumnSelectLeft.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(1, 2, 1, 1)
      ]);
    });
  });
  test("column select with keyboard", () => {
    withTestCodeEditor([
      'var gulp = require("gulp");',
      'var path = require("path");',
      'var rimraf = require("rimraf");',
      'var isarray = require("isarray");',
      'var merge = require("merge-stream");',
      'var concat = require("gulp-concat");',
      'var newer = require("gulp-newer");'
    ].join("\n"), {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 1, 4, false);
      assertCursor(viewModel, new Position(1, 4));
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(1, 4, 1, 5)
      ]);
      CoreNavigationCommands.CursorColumnSelectDown.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(1, 4, 1, 5),
        new Selection(2, 4, 2, 5)
      ]);
      CoreNavigationCommands.CursorColumnSelectDown.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(1, 4, 1, 5),
        new Selection(2, 4, 2, 5),
        new Selection(3, 4, 3, 5)
      ]);
      CoreNavigationCommands.CursorColumnSelectDown.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectDown.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectDown.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectDown.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(1, 4, 1, 5),
        new Selection(2, 4, 2, 5),
        new Selection(3, 4, 3, 5),
        new Selection(4, 4, 4, 5),
        new Selection(5, 4, 5, 5),
        new Selection(6, 4, 6, 5),
        new Selection(7, 4, 7, 5)
      ]);
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(1, 4, 1, 6),
        new Selection(2, 4, 2, 6),
        new Selection(3, 4, 3, 6),
        new Selection(4, 4, 4, 6),
        new Selection(5, 4, 5, 6),
        new Selection(6, 4, 6, 6),
        new Selection(7, 4, 7, 6)
      ]);
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(1, 4, 1, 16),
        new Selection(2, 4, 2, 16),
        new Selection(3, 4, 3, 16),
        new Selection(4, 4, 4, 16),
        new Selection(5, 4, 5, 16),
        new Selection(6, 4, 6, 16),
        new Selection(7, 4, 7, 16)
      ]);
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(1, 4, 1, 26),
        new Selection(2, 4, 2, 26),
        new Selection(3, 4, 3, 26),
        new Selection(4, 4, 4, 26),
        new Selection(5, 4, 5, 26),
        new Selection(6, 4, 6, 26),
        new Selection(7, 4, 7, 26)
      ]);
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(1, 4, 1, 28),
        new Selection(2, 4, 2, 28),
        new Selection(3, 4, 3, 28),
        new Selection(4, 4, 4, 28),
        new Selection(5, 4, 5, 28),
        new Selection(6, 4, 6, 28),
        new Selection(7, 4, 7, 28)
      ]);
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(1, 4, 1, 28),
        new Selection(2, 4, 2, 28),
        new Selection(3, 4, 3, 32),
        new Selection(4, 4, 4, 32),
        new Selection(5, 4, 5, 32),
        new Selection(6, 4, 6, 32),
        new Selection(7, 4, 7, 32)
      ]);
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(1, 4, 1, 28),
        new Selection(2, 4, 2, 28),
        new Selection(3, 4, 3, 32),
        new Selection(4, 4, 4, 34),
        new Selection(5, 4, 5, 34),
        new Selection(6, 4, 6, 34),
        new Selection(7, 4, 7, 34)
      ]);
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(1, 4, 1, 28),
        new Selection(2, 4, 2, 28),
        new Selection(3, 4, 3, 32),
        new Selection(4, 4, 4, 34),
        new Selection(5, 4, 5, 35),
        new Selection(6, 4, 6, 35),
        new Selection(7, 4, 7, 35)
      ]);
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(1, 4, 1, 28),
        new Selection(2, 4, 2, 28),
        new Selection(3, 4, 3, 32),
        new Selection(4, 4, 4, 34),
        new Selection(5, 4, 5, 37),
        new Selection(6, 4, 6, 37),
        new Selection(7, 4, 7, 35)
      ]);
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(1, 4, 1, 28),
        new Selection(2, 4, 2, 28),
        new Selection(3, 4, 3, 32),
        new Selection(4, 4, 4, 34),
        new Selection(5, 4, 5, 37),
        new Selection(6, 4, 6, 37),
        new Selection(7, 4, 7, 35)
      ]);
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(1, 4, 1, 28),
        new Selection(2, 4, 2, 28),
        new Selection(3, 4, 3, 32),
        new Selection(4, 4, 4, 34),
        new Selection(5, 4, 5, 37),
        new Selection(6, 4, 6, 37),
        new Selection(7, 4, 7, 35)
      ]);
      CoreNavigationCommands.CursorColumnSelectLeft.runCoreEditorCommand(viewModel, {});
      assertCursor(viewModel, [
        new Selection(1, 4, 1, 28),
        new Selection(2, 4, 2, 28),
        new Selection(3, 4, 3, 32),
        new Selection(4, 4, 4, 34),
        new Selection(5, 4, 5, 36),
        new Selection(6, 4, 6, 36),
        new Selection(7, 4, 7, 35)
      ]);
    });
  });
  test("setSelection / setPosition with source", () => {
    const tokenizationSupport = {
      getInitialState: () => NullState,
      tokenize: void 0,
      tokenizeEncoded: (line, hasEOL, state) => {
        return new EncodedTokenizationResult(new Uint32Array(0), state);
      }
    };
    const LANGUAGE_ID = "modelModeTest1";
    const languageRegistration = TokenizationRegistry.register(LANGUAGE_ID, tokenizationSupport);
    const model = createTextModel("Just text", LANGUAGE_ID);
    withTestCodeEditor(model, {}, (editor1, cursor1) => {
      let event = void 0;
      const disposable = editor1.onDidChangeCursorPosition((e) => {
        event = e;
      });
      editor1.setSelection(new Range(1, 2, 1, 3), "navigation");
      assert.strictEqual(event.source, "navigation");
      event = void 0;
      editor1.setPosition(new Position(1, 2), "navigation");
      assert.strictEqual(event.source, "navigation");
      disposable.dispose();
    });
    languageRegistration.dispose();
    model.dispose();
  });
});
suite("Editor Controller", () => {
  const surroundingLanguageId = "surroundingLanguage";
  const indentRulesLanguageId = "indentRulesLanguage";
  const electricCharLanguageId = "electricCharLanguage";
  const autoClosingLanguageId = "autoClosingLanguage";
  let disposables;
  let instantiationService;
  let languageConfigurationService;
  let languageService;
  setup(() => {
    disposables = new DisposableStore();
    instantiationService = createCodeEditorServices(disposables);
    languageConfigurationService = instantiationService.get(ILanguageConfigurationService);
    languageService = instantiationService.get(ILanguageService);
    disposables.add(languageService.registerLanguage({ id: surroundingLanguageId }));
    disposables.add(languageConfigurationService.register(surroundingLanguageId, {
      autoClosingPairs: [{ open: "(", close: ")" }]
    }));
    setupIndentRulesLanguage(indentRulesLanguageId, {
      decreaseIndentPattern: /^\s*((?!\S.*\/[*]).*[*]\/\s*)?[})\]]|^\s*(case\b.*|default):\s*(\/\/.*|\/[*].*[*]\/\s*)?$/,
      increaseIndentPattern: /^((?!\/\/).)*(\{[^}"'`]*|\([^)"']*|\[[^\]"']*|^\s*(\{\}|\(\)|\[\]|(case\b.*|default):))\s*(\/\/.*|\/[*].*[*]\/\s*)?$/,
      indentNextLinePattern: /^\s*(for|while|if|else)\b(?!.*[;{}]\s*(\/\/.*|\/[*].*[*]\/\s*)?$)/,
      unIndentedLinePattern: /^(?!.*([;{}]|\S:)\s*(\/\/.*|\/[*].*[*]\/\s*)?$)(?!.*(\{[^}"']*|\([^)"']*|\[[^\]"']*|^\s*(\{\}|\(\)|\[\]|(case\b.*|default):))\s*(\/\/.*|\/[*].*[*]\/\s*)?$)(?!^\s*((?!\S.*\/[*]).*[*]\/\s*)?[})\]]|^\s*(case\b.*|default):\s*(\/\/.*|\/[*].*[*]\/\s*)?$)(?!^\s*(for|while|if|else)\b(?!.*[;{}]\s*(\/\/.*|\/[*].*[*]\/\s*)?$))/
    });
    disposables.add(languageService.registerLanguage({ id: electricCharLanguageId }));
    disposables.add(languageConfigurationService.register(electricCharLanguageId, {
      __electricCharacterSupport: {
        docComment: { open: "/**", close: " */" }
      },
      brackets: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"]
      ]
    }));
    setupAutoClosingLanguage();
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  function setupOnEnterLanguage(indentAction) {
    const onEnterLanguageId = "onEnterMode";
    disposables.add(languageService.registerLanguage({ id: onEnterLanguageId }));
    disposables.add(languageConfigurationService.register(onEnterLanguageId, {
      onEnterRules: [{
        beforeText: /.*/,
        action: {
          indentAction
        }
      }]
    }));
    return onEnterLanguageId;
  }
  function setupIndentRulesLanguage(languageId, indentationRules) {
    disposables.add(languageService.registerLanguage({ id: languageId }));
    disposables.add(languageConfigurationService.register(languageId, {
      indentationRules
    }));
    return languageId;
  }
  function setupAutoClosingLanguage() {
    disposables.add(languageService.registerLanguage({ id: autoClosingLanguageId }));
    disposables.add(languageConfigurationService.register(autoClosingLanguageId, {
      comments: {
        blockComment: ["/*", "*/"]
      },
      autoClosingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: "'", close: "'", notIn: ["string", "comment"] },
        { open: '"', close: '"', notIn: ["string"] },
        { open: "`", close: "`", notIn: ["string", "comment"] },
        { open: "/**", close: " */", notIn: ["string"] },
        { open: "begin", close: "end", notIn: ["string"] }
      ],
      __electricCharacterSupport: {
        docComment: { open: "/**", close: " */" }
      }
    }));
  }
  function setupAutoClosingLanguageTokenization() {
    class BaseState {
      constructor(parent = null) {
        this.parent = parent;
      }
      clone() {
        return this;
      }
      equals(other) {
        if (!(other instanceof BaseState)) {
          return false;
        }
        if (!this.parent && !other.parent) {
          return true;
        }
        if (!this.parent || !other.parent) {
          return false;
        }
        return this.parent.equals(other.parent);
      }
    }
    class StringState {
      constructor(char, parentState) {
        this.char = char;
        this.parentState = parentState;
      }
      clone() {
        return this;
      }
      equals(other) {
        return other instanceof StringState && this.char === other.char && this.parentState.equals(other.parentState);
      }
    }
    class BlockCommentState {
      constructor(parentState) {
        this.parentState = parentState;
      }
      clone() {
        return this;
      }
      equals(other) {
        return other instanceof StringState && this.parentState.equals(other.parentState);
      }
    }
    const encodedLanguageId = languageService.languageIdCodec.encodeLanguageId(autoClosingLanguageId);
    disposables.add(TokenizationRegistry.register(autoClosingLanguageId, {
      getInitialState: () => new BaseState(),
      tokenize: void 0,
      tokenizeEncoded: function(line, hasEOL, _state) {
        let state = _state;
        const tokens = [];
        const generateToken = (length, type, newState) => {
          if (tokens.length > 0 && tokens[tokens.length - 1].type === type) {
            tokens[tokens.length - 1].length += length;
          } else {
            tokens.push({ length, type });
          }
          line = line.substring(length);
          if (newState) {
            state = newState;
          }
        };
        while (line.length > 0) {
          advance();
        }
        const result = new Uint32Array(tokens.length * 2);
        let startIndex = 0;
        for (let i = 0; i < tokens.length; i++) {
          result[2 * i] = startIndex;
          result[2 * i + 1] = encodedLanguageId << MetadataConsts.LANGUAGEID_OFFSET | tokens[i].type << MetadataConsts.TOKEN_TYPE_OFFSET;
          startIndex += tokens[i].length;
        }
        return new EncodedTokenizationResult(result, state);
        function advance() {
          if (state instanceof BaseState) {
            const m1 = line.match(/^[^'"`{}/]+/g);
            if (m1) {
              return generateToken(m1[0].length, StandardTokenType.Other);
            }
            if (/^['"`]/.test(line)) {
              return generateToken(1, StandardTokenType.String, new StringState(line.charAt(0), state));
            }
            if (/^{/.test(line)) {
              return generateToken(1, StandardTokenType.Other, new BaseState(state));
            }
            if (/^}/.test(line)) {
              return generateToken(1, StandardTokenType.Other, state.parent || new BaseState());
            }
            if (/^\/\//.test(line)) {
              return generateToken(line.length, StandardTokenType.Comment, state);
            }
            if (/^\/\*/.test(line)) {
              return generateToken(2, StandardTokenType.Comment, new BlockCommentState(state));
            }
            return generateToken(1, StandardTokenType.Other, state);
          } else if (state instanceof StringState) {
            const m1 = line.match(/^[^\\'"`\$]+/g);
            if (m1) {
              return generateToken(m1[0].length, StandardTokenType.String);
            }
            if (/^\\/.test(line)) {
              return generateToken(2, StandardTokenType.String);
            }
            if (line.charAt(0) === state.char) {
              return generateToken(1, StandardTokenType.String, state.parentState);
            }
            if (/^\$\{/.test(line)) {
              return generateToken(2, StandardTokenType.Other, new BaseState(state));
            }
            return generateToken(1, StandardTokenType.Other, state);
          } else if (state instanceof BlockCommentState) {
            const m1 = line.match(/^[^*]+/g);
            if (m1) {
              return generateToken(m1[0].length, StandardTokenType.String);
            }
            if (/^\*\//.test(line)) {
              return generateToken(2, StandardTokenType.Comment, state.parentState);
            }
            return generateToken(1, StandardTokenType.Other, state);
          } else {
            throw new Error(`unknown state`);
          }
        }
      }
    }));
  }
  function setAutoClosingLanguageEnabledSet(chars) {
    disposables.add(languageConfigurationService.register(autoClosingLanguageId, {
      autoCloseBefore: chars,
      autoClosingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: "'", close: "'", notIn: ["string", "comment"] },
        { open: '"', close: '"', notIn: ["string"] },
        { open: "`", close: "`", notIn: ["string", "comment"] },
        { open: "/**", close: " */", notIn: ["string"] }
      ]
    }));
  }
  function createTextModel2(text, languageId = null, options = TextModel.DEFAULT_CREATION_OPTIONS, uri = null) {
    return disposables.add(instantiateTextModel(instantiationService, text, languageId, options, uri));
  }
  function withTestCodeEditor2(text, options, callback) {
    let model;
    if (typeof text === "string") {
      model = createTextModel2(text);
    } else if (Array.isArray(text)) {
      model = createTextModel2(text.join("\n"));
    } else {
      model = text;
    }
    const editor = disposables.add(instantiateTestCodeEditor(instantiationService, model, options));
    const viewModel = editor.getViewModel();
    viewModel.setHasFocus(true);
    callback(editor, viewModel);
  }
  function usingCursor(opts, callback) {
    const model = createTextModel2(opts.text.join("\n"), opts.languageId, opts.modelOpts);
    const editorOptions = opts.editorOpts || {};
    withTestCodeEditor2(model, editorOptions, (editor, viewModel) => {
      callback(editor, model, viewModel);
    });
  }
  let AutoClosingColumnType;
  ((AutoClosingColumnType2) => {
    AutoClosingColumnType2[AutoClosingColumnType2["Normal"] = 0] = "Normal";
    AutoClosingColumnType2[AutoClosingColumnType2["Special1"] = 1] = "Special1";
    AutoClosingColumnType2[AutoClosingColumnType2["Special2"] = 2] = "Special2";
  })(AutoClosingColumnType || (AutoClosingColumnType = {}));
  function extractAutoClosingSpecialColumns(maxColumn, annotatedLine) {
    const result = [];
    for (let j = 1; j <= maxColumn; j++) {
      result[j] = 0 /* Normal */;
    }
    let column = 1;
    for (let j = 0; j < annotatedLine.length; j++) {
      if (annotatedLine.charAt(j) === "|") {
        result[column] = 1 /* Special1 */;
      } else if (annotatedLine.charAt(j) === "!") {
        result[column] = 2 /* Special2 */;
      } else {
        column++;
      }
    }
    return result;
  }
  function assertType(editor, model, viewModel, lineNumber, column, chr, expectedInsert, message) {
    const lineContent = model.getLineContent(lineNumber);
    const expected = lineContent.substr(0, column - 1) + expectedInsert + lineContent.substr(column - 1);
    moveTo(editor, viewModel, lineNumber, column);
    viewModel.type(chr, "keyboard");
    assert.deepStrictEqual(model.getLineContent(lineNumber), expected, message);
    model.undo();
  }
  test("issue microsoft/monaco-editor#443: Indentation of a single row deletes selected text in some cases", () => {
    const model = createTextModel2(
      [
        "Hello world!",
        "another line"
      ].join("\n"),
      void 0,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 1, 1, 13)]);
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.deepStrictEqual(viewModel.getSelection(), new Selection(1, 1, 1, 14));
    });
  });
  test("Bug 9121: Auto indent + undo + redo is funky", () => {
    const model = createTextModel2(
      [
        ""
      ].join("\n"),
      void 0,
      {
        insertSpaces: false,
        trimAutoWhitespace: false
      }
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n", "assert1");
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	", "assert2");
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	\n	", "assert3");
      viewModel.type("x");
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	\n	x", "assert4");
      CoreNavigationCommands.CursorLeft.runCoreEditorCommand(viewModel, {});
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	\n	x", "assert5");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	\nx", "assert6");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	x", "assert7");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\nx", "assert8");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "x", "assert9");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\nx", "assert10");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	\nx", "assert11");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	\n	x", "assert12");
      CoreEditingCommands.Redo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	\nx", "assert13");
      CoreEditingCommands.Redo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\nx", "assert14");
      CoreEditingCommands.Redo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "x", "assert15");
    });
  });
  test("issue #23539: Setting model EOL isn't undoable", () => {
    withTestCodeEditor2([
      "Hello",
      "world"
    ], {}, (editor, viewModel) => {
      const model = editor.getModel();
      assertCursor(viewModel, new Position(1, 1));
      model.setEOL(EndOfLineSequence.LF);
      assert.strictEqual(model.getValue(), "Hello\nworld");
      model.pushEOL(EndOfLineSequence.CRLF);
      assert.strictEqual(model.getValue(), "Hello\r\nworld");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(), "Hello\nworld");
    });
  });
  test("issue #47733: Undo mangles unicode characters", () => {
    const languageId = "myMode";
    disposables.add(languageService.registerLanguage({ id: languageId }));
    disposables.add(languageConfigurationService.register(languageId, {
      surroundingPairs: [{ open: "%", close: "%" }]
    }));
    const model = createTextModel2("'\u{1F441}'", languageId);
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      editor.setSelection(new Selection(1, 1, 1, 2));
      viewModel.type("%", "keyboard");
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "%'%\u{1F441}'", "assert1");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "'\u{1F441}'", "assert2");
    });
  });
  test("issue #46208: Allow empty selections in the undo/redo stack", () => {
    const model = createTextModel2("");
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      viewModel.type("Hello", "keyboard");
      viewModel.type(" ", "keyboard");
      viewModel.type("world", "keyboard");
      viewModel.type(" ", "keyboard");
      assert.strictEqual(model.getLineContent(1), "Hello world ");
      assertCursor(viewModel, new Position(1, 13));
      moveLeft(editor, viewModel);
      moveRight(editor, viewModel);
      model.pushEditOperations([], [EditOperation.replaceMove(new Range(1, 12, 1, 13), "")], () => []);
      assert.strictEqual(model.getLineContent(1), "Hello world");
      assertCursor(viewModel, new Position(1, 12));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "Hello world ");
      assertCursor(viewModel, new Selection(1, 13, 1, 13));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "Hello world");
      assertCursor(viewModel, new Position(1, 12));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "Hello");
      assertCursor(viewModel, new Position(1, 6));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "");
      assertCursor(viewModel, new Position(1, 1));
      CoreEditingCommands.Redo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "Hello");
      assertCursor(viewModel, new Position(1, 6));
      CoreEditingCommands.Redo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "Hello world");
      assertCursor(viewModel, new Position(1, 12));
      CoreEditingCommands.Redo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "Hello world ");
      assertCursor(viewModel, new Position(1, 13));
      CoreEditingCommands.Redo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "Hello world");
      assertCursor(viewModel, new Position(1, 12));
      CoreEditingCommands.Redo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "Hello world");
      assertCursor(viewModel, new Position(1, 12));
    });
  });
  test("bug #16815:Shift+Tab doesn't go back to tabstop", () => {
    const languageId = setupOnEnterLanguage(IndentAction.IndentOutdent);
    const model = createTextModel2(
      [
        "     function baz() {"
      ].join("\n"),
      languageId
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 1, 6, false);
      assertCursor(viewModel, new Selection(1, 6, 1, 6));
      CoreEditingCommands.Outdent.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "    function baz() {");
      assertCursor(viewModel, new Selection(1, 5, 1, 5));
    });
  });
  test("Bug #18293:[regression][editor] Can't outdent whitespace line", () => {
    const model = createTextModel2(
      [
        "      "
      ].join("\n")
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 1, 7, false);
      assertCursor(viewModel, new Selection(1, 7, 1, 7));
      CoreEditingCommands.Outdent.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "    ");
      assertCursor(viewModel, new Selection(1, 5, 1, 5));
    });
  });
  test("issue #95591: Unindenting moves cursor to beginning of line", () => {
    const model = createTextModel2(
      [
        "        "
      ].join("\n")
    );
    withTestCodeEditor2(model, { useTabStops: false }, (editor, viewModel) => {
      moveTo(editor, viewModel, 1, 9, false);
      assertCursor(viewModel, new Selection(1, 9, 1, 9));
      CoreEditingCommands.Outdent.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "    ");
      assertCursor(viewModel, new Selection(1, 5, 1, 5));
    });
  });
  test("Bug #16657: [editor] Tab on empty line of zero indentation moves cursor to position (1,1)", () => {
    const model = createTextModel2(
      [
        "function baz() {",
        "	function hello() { // something here",
        "	",
        "",
        "	}",
        "}",
        ""
      ].join("\n"),
      void 0,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 7, 1, false);
      assertCursor(viewModel, new Selection(7, 1, 7, 1));
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(7), "	");
      assertCursor(viewModel, new Selection(7, 2, 7, 2));
    });
  });
  test("bug #16740: [editor] Cut line doesn't quite cut the last line", () => {
    withTestCodeEditor2([
      "asdasd",
      "qwerty"
    ], {}, (editor, viewModel) => {
      const model = editor.getModel();
      moveTo(editor, viewModel, 2, 1, false);
      assertCursor(viewModel, new Selection(2, 1, 2, 1));
      viewModel.cut("keyboard");
      assert.strictEqual(model.getLineCount(), 1);
      assert.strictEqual(model.getLineContent(1), "asdasd");
    });
    withTestCodeEditor2([
      "asdasd",
      ""
    ], {}, (editor, viewModel) => {
      const model = editor.getModel();
      moveTo(editor, viewModel, 2, 1, false);
      assertCursor(viewModel, new Selection(2, 1, 2, 1));
      viewModel.cut("keyboard");
      assert.strictEqual(model.getLineCount(), 1);
      assert.strictEqual(model.getLineContent(1), "asdasd");
      viewModel.cut("keyboard");
      assert.strictEqual(model.getLineCount(), 1);
      assert.strictEqual(model.getLineContent(1), "");
    });
  });
  test("issue #128602: When cutting multiple lines (ctrl x), the last line will not be erased", () => {
    withTestCodeEditor2([
      "a1",
      "a2",
      "a3"
    ], {}, (editor, viewModel) => {
      const model = editor.getModel();
      viewModel.setSelections("test", [
        new Selection(1, 1, 1, 1),
        new Selection(2, 1, 2, 1),
        new Selection(3, 1, 3, 1)
      ]);
      viewModel.cut("keyboard");
      assert.strictEqual(model.getLineCount(), 1);
      assert.strictEqual(model.getLineContent(1), "");
    });
  });
  test("Bug #11476: Double bracket surrounding + undo is broken", () => {
    usingCursor({
      text: [
        "hello"
      ],
      languageId: surroundingLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 1, 3, false);
      moveTo(editor, viewModel, 1, 5, true);
      assertCursor(viewModel, new Selection(1, 3, 1, 5));
      viewModel.type("(", "keyboard");
      assertCursor(viewModel, new Selection(1, 4, 1, 6));
      viewModel.type("(", "keyboard");
      assertCursor(viewModel, new Selection(1, 5, 1, 7));
    });
  });
  test("issue #1140: Backspace stops prematurely", () => {
    const model = createTextModel2(
      [
        "function baz() {",
        "  return 1;",
        "};"
      ].join("\n")
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 3, 2, false);
      moveTo(editor, viewModel, 1, 14, true);
      assertCursor(viewModel, new Selection(3, 2, 1, 14));
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assertCursor(viewModel, new Selection(1, 14, 1, 14));
      assert.strictEqual(model.getLineCount(), 1);
      assert.strictEqual(model.getLineContent(1), "function baz(;");
    });
  });
  test("issue #10212: Pasting entire line does not replace selection", () => {
    usingCursor({
      text: [
        "line1",
        "line2"
      ]
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 2, 1, false);
      moveTo(editor, viewModel, 2, 6, true);
      viewModel.paste("line1\n", true);
      assert.strictEqual(model.getLineContent(1), "line1");
      assert.strictEqual(model.getLineContent(2), "line1");
      assert.strictEqual(model.getLineContent(3), "");
    });
  });
  test("issue #74722: Pasting whole line does not replace selection", () => {
    usingCursor({
      text: [
        "line1",
        "line sel 2",
        "line3"
      ]
    }, (editor, model, viewModel) => {
      viewModel.setSelections("test", [new Selection(2, 6, 2, 9)]);
      viewModel.paste("line1\n", true);
      assert.strictEqual(model.getLineContent(1), "line1");
      assert.strictEqual(model.getLineContent(2), "line line1");
      assert.strictEqual(model.getLineContent(3), " 2");
      assert.strictEqual(model.getLineContent(4), "line3");
    });
  });
  test("issue #4996: Multiple cursor paste pastes contents of all cursors", () => {
    usingCursor({
      text: [
        "line1",
        "line2",
        "line3"
      ]
    }, (editor, model, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 1, 1, 1), new Selection(2, 1, 2, 1)]);
      viewModel.paste(
        "a\nb\nc\nd",
        false,
        [
          "a\nb",
          "c\nd"
        ]
      );
      assert.strictEqual(model.getValue(), [
        "a",
        "bline1",
        "c",
        "dline2",
        "line3"
      ].join("\n"));
    });
  });
  test("issue #16155: Paste into multiple cursors has edge case when number of lines equals number of cursors - 1", () => {
    usingCursor({
      text: [
        "test",
        "test",
        "test",
        "test"
      ]
    }, (editor, model, viewModel) => {
      viewModel.setSelections("test", [
        new Selection(1, 1, 1, 5),
        new Selection(2, 1, 2, 5),
        new Selection(3, 1, 3, 5),
        new Selection(4, 1, 4, 5)
      ]);
      viewModel.paste(
        "aaa\nbbb\nccc\n",
        false,
        null
      );
      assert.strictEqual(model.getValue(), [
        "aaa",
        "bbb",
        "ccc",
        "",
        "aaa",
        "bbb",
        "ccc",
        "",
        "aaa",
        "bbb",
        "ccc",
        "",
        "aaa",
        "bbb",
        "ccc",
        ""
      ].join("\n"));
    });
  });
  test("issue #43722: Multiline paste doesn't work anymore", () => {
    usingCursor({
      text: [
        "test",
        "test",
        "test",
        "test"
      ]
    }, (editor, model, viewModel) => {
      viewModel.setSelections("test", [
        new Selection(1, 1, 1, 5),
        new Selection(2, 1, 2, 5),
        new Selection(3, 1, 3, 5),
        new Selection(4, 1, 4, 5)
      ]);
      viewModel.paste(
        "aaa\r\nbbb\r\nccc\r\nddd\r\n",
        false,
        null
      );
      assert.strictEqual(model.getValue(), [
        "aaa",
        "bbb",
        "ccc",
        "ddd"
      ].join("\n"));
    });
  });
  test("issue #46440: (1) Pasting a multi-line selection pastes entire selection into every insertion point", () => {
    usingCursor({
      text: [
        "line1",
        "line2",
        "line3"
      ]
    }, (editor, model, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 1, 1, 1), new Selection(2, 1, 2, 1), new Selection(3, 1, 3, 1)]);
      viewModel.paste(
        "a\nb\nc",
        false,
        null
      );
      assert.strictEqual(model.getValue(), [
        "aline1",
        "bline2",
        "cline3"
      ].join("\n"));
    });
  });
  test("issue #46440: (2) Pasting a multi-line selection pastes entire selection into every insertion point", () => {
    usingCursor({
      text: [
        "line1",
        "line2",
        "line3"
      ]
    }, (editor, model, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 1, 1, 1), new Selection(2, 1, 2, 1), new Selection(3, 1, 3, 1)]);
      viewModel.paste(
        "a\nb\nc\n",
        false,
        null
      );
      assert.strictEqual(model.getValue(), [
        "aline1",
        "bline2",
        "cline3"
      ].join("\n"));
    });
  });
  test("issue #3071: Investigate why undo stack gets corrupted", () => {
    const model = createTextModel2(
      [
        "some lines",
        "and more lines",
        "just some text"
      ].join("\n")
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 1, 1, false);
      moveTo(editor, viewModel, 3, 4, true);
      let isFirst = true;
      const disposable = model.onDidChangeContent(() => {
        if (isFirst) {
          isFirst = false;
          viewModel.type("	", "keyboard");
        }
      });
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(), [
        "	 just some text"
      ].join("\n"), "001");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(), [
        "    some lines",
        "    and more lines",
        "    just some text"
      ].join("\n"), "002");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(), [
        "some lines",
        "and more lines",
        "just some text"
      ].join("\n"), "003");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(), [
        "some lines",
        "and more lines",
        "just some text"
      ].join("\n"), "004");
      disposable.dispose();
    });
  });
  test("issue #12950: Cannot Double Click To Insert Emoji Using OSX Emoji Panel", () => {
    usingCursor({
      text: [
        "some lines",
        "and more lines",
        "just some text"
      ],
      languageId: null
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 3, 1, false);
      viewModel.type("\u{1F60D}", "keyboard");
      assert.strictEqual(model.getValue(), [
        "some lines",
        "and more lines",
        "\u{1F60D}just some text"
      ].join("\n"));
    });
  });
  test("issue #3463: pressing tab adds spaces, but not as many as for a tab", () => {
    const model = createTextModel2(
      [
        "function a() {",
        "	var a = {",
        "		x: 3",
        "	};",
        "}"
      ].join("\n")
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 3, 2, false);
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(3), "	    	x: 3");
    });
  });
  test("issue #4312: trying to type a tab character over a sequence of spaces results in unexpected behaviour", () => {
    const model = createTextModel2(
      [
        "var foo = 123;       // this is a comment",
        "var bar = 4;       // another comment"
      ].join("\n"),
      void 0,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 1, 15, false);
      moveTo(editor, viewModel, 1, 22, true);
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "var foo = 123;	// this is a comment");
    });
  });
  test("issue #832: word right", () => {
    usingCursor({
      text: [
        "   /* Just some   more   text a+= 3 +5-3 + 7 */  "
      ]
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 1, 1, false);
      function assertWordRight(col, expectedCol) {
        const args = {
          position: {
            lineNumber: 1,
            column: col
          }
        };
        if (col === 1) {
          CoreNavigationCommands.WordSelect.runCoreEditorCommand(viewModel, args);
        } else {
          CoreNavigationCommands.WordSelectDrag.runCoreEditorCommand(viewModel, args);
        }
        assert.strictEqual(viewModel.getSelection().startColumn, 1, "TEST FOR " + col);
        assert.strictEqual(viewModel.getSelection().endColumn, expectedCol, "TEST FOR " + col);
      }
      assertWordRight(1, "   ".length + 1);
      assertWordRight(2, "   ".length + 1);
      assertWordRight(3, "   ".length + 1);
      assertWordRight(4, "   ".length + 1);
      assertWordRight(5, "   /".length + 1);
      assertWordRight(6, "   /*".length + 1);
      assertWordRight(7, "   /* ".length + 1);
      assertWordRight(8, "   /* Just".length + 1);
      assertWordRight(9, "   /* Just".length + 1);
      assertWordRight(10, "   /* Just".length + 1);
      assertWordRight(11, "   /* Just".length + 1);
      assertWordRight(12, "   /* Just ".length + 1);
      assertWordRight(13, "   /* Just some".length + 1);
      assertWordRight(14, "   /* Just some".length + 1);
      assertWordRight(15, "   /* Just some".length + 1);
      assertWordRight(16, "   /* Just some".length + 1);
      assertWordRight(17, "   /* Just some ".length + 1);
      assertWordRight(18, "   /* Just some  ".length + 1);
      assertWordRight(19, "   /* Just some   ".length + 1);
      assertWordRight(20, "   /* Just some   more".length + 1);
      assertWordRight(21, "   /* Just some   more".length + 1);
      assertWordRight(22, "   /* Just some   more".length + 1);
      assertWordRight(23, "   /* Just some   more".length + 1);
      assertWordRight(24, "   /* Just some   more ".length + 1);
      assertWordRight(25, "   /* Just some   more  ".length + 1);
      assertWordRight(26, "   /* Just some   more   ".length + 1);
      assertWordRight(27, "   /* Just some   more   text".length + 1);
      assertWordRight(28, "   /* Just some   more   text".length + 1);
      assertWordRight(29, "   /* Just some   more   text".length + 1);
      assertWordRight(30, "   /* Just some   more   text".length + 1);
      assertWordRight(31, "   /* Just some   more   text ".length + 1);
      assertWordRight(32, "   /* Just some   more   text a".length + 1);
      assertWordRight(33, "   /* Just some   more   text a+".length + 1);
      assertWordRight(34, "   /* Just some   more   text a+=".length + 1);
      assertWordRight(35, "   /* Just some   more   text a+= ".length + 1);
      assertWordRight(36, "   /* Just some   more   text a+= 3".length + 1);
      assertWordRight(37, "   /* Just some   more   text a+= 3 ".length + 1);
      assertWordRight(38, "   /* Just some   more   text a+= 3 +".length + 1);
      assertWordRight(39, "   /* Just some   more   text a+= 3 +5".length + 1);
      assertWordRight(40, "   /* Just some   more   text a+= 3 +5-".length + 1);
      assertWordRight(41, "   /* Just some   more   text a+= 3 +5-3".length + 1);
      assertWordRight(42, "   /* Just some   more   text a+= 3 +5-3 ".length + 1);
      assertWordRight(43, "   /* Just some   more   text a+= 3 +5-3 +".length + 1);
      assertWordRight(44, "   /* Just some   more   text a+= 3 +5-3 + ".length + 1);
      assertWordRight(45, "   /* Just some   more   text a+= 3 +5-3 + 7".length + 1);
      assertWordRight(46, "   /* Just some   more   text a+= 3 +5-3 + 7 ".length + 1);
      assertWordRight(47, "   /* Just some   more   text a+= 3 +5-3 + 7 *".length + 1);
      assertWordRight(48, "   /* Just some   more   text a+= 3 +5-3 + 7 */".length + 1);
      assertWordRight(49, "   /* Just some   more   text a+= 3 +5-3 + 7 */ ".length + 1);
      assertWordRight(50, "   /* Just some   more   text a+= 3 +5-3 + 7 */  ".length + 1);
    });
  });
  test("issue #33788: Wrong cursor position when double click to select a word", () => {
    const model = createTextModel2(
      [
        "Just some text"
      ].join("\n")
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      CoreNavigationCommands.WordSelect.runCoreEditorCommand(viewModel, { position: new Position(1, 8) });
      assert.deepStrictEqual(viewModel.getSelection(), new Selection(1, 6, 1, 10));
      CoreNavigationCommands.WordSelectDrag.runCoreEditorCommand(viewModel, { position: new Position(1, 8) });
      assert.deepStrictEqual(viewModel.getSelection(), new Selection(1, 6, 1, 10));
    });
  });
  test("issue #12887: Double-click highlighting separating white space", () => {
    const model = createTextModel2(
      [
        "abc def"
      ].join("\n")
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      CoreNavigationCommands.WordSelect.runCoreEditorCommand(viewModel, { position: new Position(1, 5) });
      assert.deepStrictEqual(viewModel.getSelection(), new Selection(1, 5, 1, 8));
    });
  });
  test("issue #9675: Undo/Redo adds a stop in between CHN Characters", () => {
    withTestCodeEditor2([], {}, (editor, viewModel) => {
      const model = editor.getModel();
      assertCursor(viewModel, new Position(1, 1));
      viewModel.type("\uFF53", "keyboard");
      viewModel.compositionType("\u305B", 1, 0, 0);
      viewModel.compositionType("\u305B\uFF4E", 1, 0, 0);
      viewModel.compositionType("\u305B\u3093", 2, 0, 0);
      viewModel.compositionType("\u305B\u3093\uFF53", 2, 0, 0);
      viewModel.compositionType("\u305B\u3093\u305B", 3, 0, 0);
      viewModel.compositionType("\u305B\u3093\u305B", 3, 0, 0);
      viewModel.compositionType("\u305B\u3093\u305B\u3044", 3, 0, 0);
      viewModel.compositionType("\u305B\u3093\u305B\u3044", 4, 0, 0);
      viewModel.compositionType("\u305B\u3093\u305B\u3044", 4, 0, 0);
      viewModel.compositionType("\u305B\u3093\u305B\u3044", 4, 0, 0);
      assert.strictEqual(model.getLineContent(1), "\u305B\u3093\u305B\u3044");
      assertCursor(viewModel, new Position(1, 5));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "");
      assertCursor(viewModel, new Position(1, 1));
    });
  });
  test("issue #23983: Calling model.setEOL does not reset cursor position", () => {
    usingCursor({
      text: [
        "first line",
        "second line"
      ]
    }, (editor, model, viewModel) => {
      model.setEOL(EndOfLineSequence.CRLF);
      viewModel.setSelections("test", [new Selection(2, 2, 2, 2)]);
      model.setEOL(EndOfLineSequence.LF);
      assertCursor(viewModel, new Selection(2, 2, 2, 2));
    });
  });
  test("issue #23983: Calling model.setValue() resets cursor position", () => {
    usingCursor({
      text: [
        "first line",
        "second line"
      ]
    }, (editor, model, viewModel) => {
      model.setEOL(EndOfLineSequence.CRLF);
      viewModel.setSelections("test", [new Selection(2, 2, 2, 2)]);
      model.setValue([
        "different first line",
        "different second line",
        "new third line"
      ].join("\n"));
      assertCursor(viewModel, new Selection(1, 1, 1, 1));
    });
  });
  test("issue #36740: wordwrap creates an extra step / character at the wrapping point", () => {
    withTestCodeEditor2([
      [
        "Lorem ipsum ",
        "dolor sit amet ",
        "consectetur ",
        "adipiscing elit"
      ].join("")
    ], { wordWrap: "wordWrapColumn", wordWrapColumn: 16 }, (editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 7, 1, 7)]);
      moveRight(editor, viewModel);
      assertCursor(viewModel, new Selection(1, 8, 1, 8));
      moveRight(editor, viewModel);
      assertCursor(viewModel, new Selection(1, 9, 1, 9));
      moveRight(editor, viewModel);
      assertCursor(viewModel, new Selection(1, 10, 1, 10));
      moveRight(editor, viewModel);
      assertCursor(viewModel, new Selection(1, 11, 1, 11));
      moveRight(editor, viewModel);
      assertCursor(viewModel, new Selection(1, 12, 1, 12));
      moveRight(editor, viewModel);
      assertCursor(viewModel, new Selection(1, 13, 1, 13));
      moveRight(editor, viewModel);
      assertCursor(viewModel, new Selection(1, 14, 1, 14));
      moveLeft(editor, viewModel);
      assertCursor(viewModel, new Selection(1, 13, 1, 13));
      moveLeft(editor, viewModel);
      assertCursor(viewModel, new Selection(1, 12, 1, 12));
    });
  });
  test("issue #110376: multiple selections with wordwrap behave differently", () => {
    withTestCodeEditor2([
      [
        "just a sentence. just a ",
        "sentence. just a sentence."
      ].join("")
    ], { wordWrap: "wordWrapColumn", wordWrapColumn: 25 }, (editor, viewModel) => {
      viewModel.setSelections("test", [
        new Selection(1, 1, 1, 16),
        new Selection(1, 18, 1, 33),
        new Selection(1, 35, 1, 50)
      ]);
      moveLeft(editor, viewModel);
      assertCursor(viewModel, [
        new Selection(1, 1, 1, 1),
        new Selection(1, 18, 1, 18),
        new Selection(1, 35, 1, 35)
      ]);
      viewModel.setSelections("test", [
        new Selection(1, 1, 1, 16),
        new Selection(1, 18, 1, 33),
        new Selection(1, 35, 1, 50)
      ]);
      moveRight(editor, viewModel);
      assertCursor(viewModel, [
        new Selection(1, 16, 1, 16),
        new Selection(1, 33, 1, 33),
        new Selection(1, 50, 1, 50)
      ]);
    });
  });
  test("issue #98320: Multi-Cursor, Wrap lines and cursorSelectRight ==> cursors out of sync", () => {
    withTestCodeEditor2([
      [
        "lorem_ipsum-1993x11x13",
        "dolor_sit_amet-1998x04x27",
        "consectetur-2007x10x08",
        "adipiscing-2012x07x27",
        "elit-2015x02x27"
      ].join("\n")
    ], { wordWrap: "wordWrapColumn", wordWrapColumn: 16 }, (editor, viewModel) => {
      viewModel.setSelections("test", [
        new Selection(1, 13, 1, 13),
        new Selection(2, 16, 2, 16),
        new Selection(3, 13, 3, 13),
        new Selection(4, 12, 4, 12),
        new Selection(5, 6, 5, 6)
      ]);
      assertCursor(viewModel, [
        new Selection(1, 13, 1, 13),
        new Selection(2, 16, 2, 16),
        new Selection(3, 13, 3, 13),
        new Selection(4, 12, 4, 12),
        new Selection(5, 6, 5, 6)
      ]);
      moveRight(editor, viewModel, true);
      assertCursor(viewModel, [
        new Selection(1, 13, 1, 14),
        new Selection(2, 16, 2, 17),
        new Selection(3, 13, 3, 14),
        new Selection(4, 12, 4, 13),
        new Selection(5, 6, 5, 7)
      ]);
      moveRight(editor, viewModel, true);
      assertCursor(viewModel, [
        new Selection(1, 13, 1, 15),
        new Selection(2, 16, 2, 18),
        new Selection(3, 13, 3, 15),
        new Selection(4, 12, 4, 14),
        new Selection(5, 6, 5, 8)
      ]);
      moveRight(editor, viewModel, true);
      assertCursor(viewModel, [
        new Selection(1, 13, 1, 16),
        new Selection(2, 16, 2, 19),
        new Selection(3, 13, 3, 16),
        new Selection(4, 12, 4, 15),
        new Selection(5, 6, 5, 9)
      ]);
      moveRight(editor, viewModel, true);
      assertCursor(viewModel, [
        new Selection(1, 13, 1, 17),
        new Selection(2, 16, 2, 20),
        new Selection(3, 13, 3, 17),
        new Selection(4, 12, 4, 16),
        new Selection(5, 6, 5, 10)
      ]);
    });
  });
  test("issue #41573 - delete across multiple lines does not shrink the selection when word wraps", () => {
    withTestCodeEditor2([
      "Authorization: 'Bearer pHKRfCTFSnGxs6akKlb9ddIXcca0sIUSZJutPHYqz7vEeHdMTMh0SGN0IGU3a0n59DXjTLRsj5EJ2u33qLNIFi9fk5XF8pK39PndLYUZhPt4QvHGLScgSkK0L4gwzkzMloTQPpKhqiikiIOvyNNSpd2o8j29NnOmdTUOKi9DVt74PD2ohKxyOrWZ6oZprTkb3eKajcpnS0LABKfaw2rmv4',"
    ].join("\n"), { wordWrap: "wordWrapColumn", wordWrapColumn: 100 }, (editor, viewModel) => {
      moveTo(editor, viewModel, 1, 43, false);
      moveTo(editor, viewModel, 1, 147, true);
      assertCursor(viewModel, new Selection(1, 43, 1, 147));
      editor.getModel().applyEdits([{
        range: new Range(1, 1, 1, 43),
        text: ""
      }]);
      assertCursor(viewModel, new Selection(1, 1, 1, 105));
    });
  });
  test("issue #22717: Moving text cursor cause an incorrect position in Chinese", () => {
    withTestCodeEditor2([
      [
        "\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D\u4E03\u516B\u4E5D\u5341",
        "12345678901234567890"
      ].join("\n")
    ], {}, (editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 5, 1, 5)]);
      moveDown(editor, viewModel);
      assertCursor(viewModel, new Selection(2, 9, 2, 9));
      moveRight(editor, viewModel);
      assertCursor(viewModel, new Selection(2, 10, 2, 10));
      moveRight(editor, viewModel);
      assertCursor(viewModel, new Selection(2, 11, 2, 11));
      moveUp(editor, viewModel);
      assertCursor(viewModel, new Selection(1, 6, 1, 6));
    });
  });
  test("issue #112301: new stickyTabStops feature interferes with word wrap", () => {
    withTestCodeEditor2([
      [
        "function hello() {",
        "        console.log(`this is a long console message`)",
        "}"
      ].join("\n")
    ], { wordWrap: "wordWrapColumn", wordWrapColumn: 32, stickyTabStops: true }, (editor, viewModel) => {
      viewModel.setSelections("test", [
        new Selection(2, 31, 2, 31)
      ]);
      moveRight(editor, viewModel, false);
      assertCursor(viewModel, new Position(2, 32));
      moveRight(editor, viewModel, false);
      assertCursor(viewModel, new Position(2, 33));
      moveRight(editor, viewModel, false);
      assertCursor(viewModel, new Position(2, 34));
      moveLeft(editor, viewModel, false);
      assertCursor(viewModel, new Position(2, 33));
      moveLeft(editor, viewModel, false);
      assertCursor(viewModel, new Position(2, 32));
      moveLeft(editor, viewModel, false);
      assertCursor(viewModel, new Position(2, 31));
    });
  });
  test("issue #44805: Should not be able to undo in readonly editor", () => {
    const model = createTextModel2(
      [
        ""
      ].join("\n")
    );
    withTestCodeEditor2(model, { readOnly: true }, (editor, viewModel) => {
      model.pushEditOperations([new Selection(1, 1, 1, 1)], [{
        range: new Range(1, 1, 1, 1),
        text: "Hello world!"
      }], () => [new Selection(1, 1, 1, 1)]);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "Hello world!");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "Hello world!");
    });
  });
  test("issue #46314: ViewModel is out of sync with Model!", () => {
    const tokenizationSupport = {
      getInitialState: () => NullState,
      tokenize: void 0,
      tokenizeEncoded: (line, hasEOL, state) => {
        return new EncodedTokenizationResult(new Uint32Array(0), state);
      }
    };
    const LANGUAGE_ID = "modelModeTest1";
    const languageRegistration = TokenizationRegistry.register(LANGUAGE_ID, tokenizationSupport);
    const model = createTextModel2("Just text", LANGUAGE_ID);
    withTestCodeEditor2(model, {}, (editor1, cursor1) => {
      withTestCodeEditor2(model, {}, (editor2, cursor2) => {
        const disposable = editor1.onDidChangeCursorPosition(() => {
          model.tokenization.tokenizeIfCheap(1);
        });
        model.applyEdits([{ range: new Range(1, 1, 1, 1), text: "-" }]);
        disposable.dispose();
      });
    });
    languageRegistration.dispose();
    model.dispose();
  });
  test("issue #37967: problem replacing consecutive characters", () => {
    const model = createTextModel2(
      [
        'const a = "foo";',
        'const b = ""'
      ].join("\n")
    );
    withTestCodeEditor2(model, { multiCursorMergeOverlapping: false }, (editor, viewModel) => {
      editor.setSelections([
        new Selection(1, 12, 1, 12),
        new Selection(1, 16, 1, 16),
        new Selection(2, 12, 2, 12),
        new Selection(2, 13, 2, 13)
      ]);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assertCursor(viewModel, [
        new Selection(1, 11, 1, 11),
        new Selection(1, 14, 1, 14),
        new Selection(2, 11, 2, 11),
        new Selection(2, 11, 2, 11)
      ]);
      viewModel.type("'", "keyboard");
      assert.strictEqual(model.getLineContent(1), "const a = 'foo';");
      assert.strictEqual(model.getLineContent(2), "const b = ''");
    });
  });
  test("issue #15761: Cursor doesn't move in a redo operation", () => {
    const model = createTextModel2(
      [
        "hello"
      ].join("\n")
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      editor.setSelections([
        new Selection(1, 4, 1, 4)
      ]);
      editor.executeEdits("test", [{
        range: new Range(1, 1, 1, 1),
        text: "*",
        forceMoveMarkers: true
      }]);
      assertCursor(viewModel, [
        new Selection(1, 5, 1, 5)
      ]);
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assertCursor(viewModel, [
        new Selection(1, 4, 1, 4)
      ]);
      CoreEditingCommands.Redo.runEditorCommand(null, editor, null);
      assertCursor(viewModel, [
        new Selection(1, 5, 1, 5)
      ]);
    });
  });
  test("issue #42783: API Calls with Undo Leave Cursor in Wrong Position", () => {
    const model = createTextModel2(
      [
        "ab"
      ].join("\n")
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      editor.setSelections([
        new Selection(1, 1, 1, 1)
      ]);
      editor.executeEdits("test", [{
        range: new Range(1, 1, 1, 3),
        text: ""
      }]);
      assertCursor(viewModel, [
        new Selection(1, 1, 1, 1)
      ]);
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assertCursor(viewModel, [
        new Selection(1, 1, 1, 1)
      ]);
      editor.executeEdits("test", [{
        range: new Range(1, 1, 1, 2),
        text: ""
      }]);
      assertCursor(viewModel, [
        new Selection(1, 1, 1, 1)
      ]);
    });
  });
  test("issue #85712: Paste line moves cursor to start of current line rather than start of next line", () => {
    const model = createTextModel2(
      [
        "abc123",
        ""
      ].join("\n")
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      editor.setSelections([
        new Selection(2, 1, 2, 1)
      ]);
      viewModel.paste("something\n", true);
      assert.strictEqual(model.getValue(), [
        "abc123",
        "something",
        ""
      ].join("\n"));
      assertCursor(viewModel, new Position(3, 1));
    });
  });
  test("issue #84897: Left delete behavior in some languages is changed", () => {
    const model = createTextModel2(
      [
        "\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35"
      ].join("\n")
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      editor.setSelections([
        new Selection(1, 7, 1, 7)
      ]);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\u0E2A\u0E27\u0E31\u0E2A\u0E14");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\u0E2A\u0E27\u0E31\u0E2A");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\u0E2A\u0E27\u0E31");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\u0E2A\u0E27");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\u0E2A");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "");
    });
  });
  test("issue #122914: Left delete behavior in some languages is changed (useTabStops: false)", () => {
    const model = createTextModel2(
      [
        "\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35"
      ].join("\n")
    );
    withTestCodeEditor2(model, { useTabStops: false }, (editor, viewModel) => {
      editor.setSelections([
        new Selection(1, 7, 1, 7)
      ]);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\u0E2A\u0E27\u0E31\u0E2A\u0E14");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\u0E2A\u0E27\u0E31\u0E2A");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\u0E2A\u0E27\u0E31");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\u0E2A\u0E27");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\u0E2A");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "");
    });
  });
  test("issue #99629: Emoji modifiers in text treated separately when using backspace", () => {
    const model = createTextModel2(
      [
        "\u{1F476}\u{1F3FE}"
      ].join("\n")
    );
    withTestCodeEditor2(model, { useTabStops: false }, (editor, viewModel) => {
      const len = model.getValueLength();
      editor.setSelections([
        new Selection(1, 1 + len, 1, 1 + len)
      ]);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "");
    });
  });
  test("issue #99629: Emoji modifiers in text treated separately when using backspace (ZWJ sequence)", () => {
    const model = createTextModel2(
      [
        "\u{1F468}\u200D\u{1F469}\u{1F3FD}\u200D\u{1F467}\u200D\u{1F466}"
      ].join("\n")
    );
    withTestCodeEditor2(model, { useTabStops: false }, (editor, viewModel) => {
      const len = model.getValueLength();
      editor.setSelections([
        new Selection(1, 1 + len, 1, 1 + len)
      ]);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\u{1F468}\u200D\u{1F469}\u{1F3FD}\u200D\u{1F467}");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\u{1F468}\u200D\u{1F469}\u{1F3FD}");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\u{1F468}");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "");
    });
  });
  test("issue #105730: move left behaves differently for multiple cursors", () => {
    const model = createTextModel2("asdfghjkl, asdfghjkl, asdfghjkl, ");
    withTestCodeEditor2(
      model,
      {
        wordWrap: "wordWrapColumn",
        wordWrapColumn: 24
      },
      (editor, viewModel) => {
        viewModel.setSelections("test", [
          new Selection(1, 10, 1, 12),
          new Selection(1, 21, 1, 23),
          new Selection(1, 32, 1, 34)
        ]);
        moveLeft(editor, viewModel, false);
        assertCursor(viewModel, [
          new Selection(1, 10, 1, 10),
          new Selection(1, 21, 1, 21),
          new Selection(1, 32, 1, 32)
        ]);
        viewModel.setSelections("test", [
          new Selection(1, 10, 1, 12),
          new Selection(1, 21, 1, 23),
          new Selection(1, 32, 1, 34)
        ]);
        moveLeft(editor, viewModel, true);
        assertCursor(viewModel, [
          new Selection(1, 10, 1, 11),
          new Selection(1, 21, 1, 22),
          new Selection(1, 32, 1, 33)
        ]);
      }
    );
  });
  test("issue #105730: move right should always skip wrap point", () => {
    const model = createTextModel2("asdfghjkl, asdfghjkl, asdfghjkl, \nasdfghjkl,");
    withTestCodeEditor2(
      model,
      {
        wordWrap: "wordWrapColumn",
        wordWrapColumn: 24
      },
      (editor, viewModel) => {
        viewModel.setSelections("test", [
          new Selection(1, 22, 1, 22)
        ]);
        moveRight(editor, viewModel, false);
        moveRight(editor, viewModel, false);
        assertCursor(viewModel, [
          new Selection(1, 24, 1, 24)
        ]);
        viewModel.setSelections("test", [
          new Selection(1, 22, 1, 22)
        ]);
        moveRight(editor, viewModel, true);
        moveRight(editor, viewModel, true);
        assertCursor(viewModel, [
          new Selection(1, 22, 1, 24)
        ]);
      }
    );
  });
  test("issue #123178: sticky tab in consecutive wrapped lines", () => {
    const model = createTextModel2("    aaaa        aaaa", void 0, { tabSize: 4 });
    withTestCodeEditor2(
      model,
      {
        wordWrap: "wordWrapColumn",
        wordWrapColumn: 8,
        stickyTabStops: true
      },
      (editor, viewModel) => {
        viewModel.setSelections("test", [
          new Selection(1, 9, 1, 9)
        ]);
        moveRight(editor, viewModel, false);
        assertCursor(viewModel, [
          new Selection(1, 10, 1, 10)
        ]);
        moveLeft(editor, viewModel, false);
        assertCursor(viewModel, [
          new Selection(1, 9, 1, 9)
        ]);
      }
    );
  });
  test("Cursor honors insertSpaces configuration on new line", () => {
    usingCursor({
      text: [
        "    	My First Line	 ",
        "	My Second Line",
        "    Third Line",
        "",
        "1"
      ]
    }, (editor, model, viewModel) => {
      CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, { position: new Position(1, 21), source: "keyboard" });
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getLineContent(1), "    	My First Line	 ");
      assert.strictEqual(model.getLineContent(2), "        ");
    });
  });
  test("Cursor honors insertSpaces configuration on tab", () => {
    const model = createTextModel2(
      [
        "    	My First Line	 ",
        "My Second Line123",
        "    Third Line",
        "",
        "1"
      ].join("\n"),
      void 0,
      {
        tabSize: 13,
        indentSize: 13
      }
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, { position: new Position(2, 1) });
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "             My Second Line123");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "My Second Line123");
      CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, { position: new Position(2, 2) });
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "M            y Second Line123");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "My Second Line123");
      CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, { position: new Position(2, 3) });
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "My            Second Line123");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "My Second Line123");
      CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, { position: new Position(2, 4) });
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "My           Second Line123");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "My Second Line123");
      CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, { position: new Position(2, 5) });
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "My S         econd Line123");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "My Second Line123");
      CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, { position: new Position(2, 5) });
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "My S         econd Line123");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "My Second Line123");
      CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, { position: new Position(2, 13) });
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "My Second Li ne123");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "My Second Line123");
      CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, { position: new Position(2, 14) });
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "My Second Lin             e123");
    });
  });
  test("Enter auto-indents with insertSpaces setting 1", () => {
    const languageId = setupOnEnterLanguage(IndentAction.Indent);
    usingCursor({
      text: [
        "	hello"
      ],
      languageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 1, 7, false);
      assertCursor(viewModel, new Selection(1, 7, 1, 7));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(EndOfLinePreference.CRLF), "	hello\r\n        ");
    });
  });
  test("Enter auto-indents with insertSpaces setting 2", () => {
    const languageId = setupOnEnterLanguage(IndentAction.None);
    usingCursor({
      text: [
        "	hello"
      ],
      languageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 1, 7, false);
      assertCursor(viewModel, new Selection(1, 7, 1, 7));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(EndOfLinePreference.CRLF), "	hello\r\n    ");
    });
  });
  test("Enter auto-indents with insertSpaces setting 3", () => {
    const languageId = setupOnEnterLanguage(IndentAction.IndentOutdent);
    usingCursor({
      text: [
        "	hell()"
      ],
      languageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 1, 7, false);
      assertCursor(viewModel, new Selection(1, 7, 1, 7));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(EndOfLinePreference.CRLF), "	hell(\r\n        \r\n    )");
    });
  });
  test("issue #148256: Pressing Enter creates line with bad indent with insertSpaces: true", () => {
    usingCursor({
      text: [
        "  	"
      ]
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 1, 4, false);
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), "  	\n    ");
    });
  });
  test("issue #148256: Pressing Enter creates line with bad indent with insertSpaces: false", () => {
    usingCursor({
      text: [
        "  	"
      ]
    }, (editor, model, viewModel) => {
      model.updateOptions({
        insertSpaces: false
      });
      moveTo(editor, viewModel, 1, 4, false);
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), "  	\n	");
    });
  });
  test("removeAutoWhitespace off", () => {
    usingCursor({
      text: [
        "    some  line abc  "
      ],
      modelOpts: {
        trimAutoWhitespace: false
      }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 1, model.getLineContent(1).length + 1);
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getLineContent(1), "    some  line abc  ");
      assert.strictEqual(model.getLineContent(2), "    ");
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getLineContent(1), "    some  line abc  ");
      assert.strictEqual(model.getLineContent(2), "    ");
      assert.strictEqual(model.getLineContent(3), "    ");
    });
  });
  test("removeAutoWhitespace on: removes only whitespace the cursor added 1", () => {
    usingCursor({
      text: [
        "    "
      ]
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 1, model.getLineContent(1).length + 1);
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getLineContent(1), "    ");
      assert.strictEqual(model.getLineContent(2), "    ");
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getLineContent(1), "    ");
      assert.strictEqual(model.getLineContent(2), "");
      assert.strictEqual(model.getLineContent(3), "    ");
    });
  });
  test("issue #115033: indent and appendText", () => {
    const languageId = "onEnterMode";
    disposables.add(languageService.registerLanguage({ id: languageId }));
    disposables.add(languageConfigurationService.register(languageId, {
      onEnterRules: [{
        beforeText: /.*/,
        action: {
          indentAction: IndentAction.Indent,
          appendText: "x"
        }
      }]
    }));
    usingCursor({
      text: [
        "text"
      ],
      languageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 1, 5);
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getLineContent(1), "text");
      assert.strictEqual(model.getLineContent(2), "    x");
      assertCursor(viewModel, new Position(2, 6));
    });
  });
  test("issue #6862: Editor removes auto inserted indentation when formatting on type", () => {
    const languageId = setupOnEnterLanguage(IndentAction.IndentOutdent);
    usingCursor({
      text: [
        "function foo (params: string) {}"
      ],
      languageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 1, 32);
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getLineContent(1), "function foo (params: string) {");
      assert.strictEqual(model.getLineContent(2), "    ");
      assert.strictEqual(model.getLineContent(3), "}");
      class TestCommand {
        constructor() {
          this._selectionId = null;
        }
        getEditOperations(model2, builder) {
          builder.addEditOperation(new Range(1, 13, 1, 14), "");
          this._selectionId = builder.trackSelection(viewModel.getSelection());
        }
        computeCursorState(model2, helper) {
          return helper.getTrackedSelection(this._selectionId);
        }
      }
      viewModel.executeCommand(new TestCommand(), "autoFormat");
      assert.strictEqual(model.getLineContent(1), "function foo(params: string) {");
      assert.strictEqual(model.getLineContent(2), "    ");
      assert.strictEqual(model.getLineContent(3), "}");
    });
  });
  test("removeAutoWhitespace on: removes only whitespace the cursor added 2", () => {
    const languageId = "testLang";
    const registration = languageService.registerLanguage({ id: languageId });
    const model = createTextModel2(
      [
        "    if (a) {",
        "        ",
        "",
        "",
        "    }"
      ].join("\n"),
      languageId
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 3, 1);
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "    if (a) {");
      assert.strictEqual(model.getLineContent(2), "        ");
      assert.strictEqual(model.getLineContent(3), "    ");
      assert.strictEqual(model.getLineContent(4), "");
      assert.strictEqual(model.getLineContent(5), "    }");
      moveTo(editor, viewModel, 4, 1);
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "    if (a) {");
      assert.strictEqual(model.getLineContent(2), "        ");
      assert.strictEqual(model.getLineContent(3), "");
      assert.strictEqual(model.getLineContent(4), "    ");
      assert.strictEqual(model.getLineContent(5), "    }");
      moveTo(editor, viewModel, 5, model.getLineMaxColumn(5));
      viewModel.type("something", "keyboard");
      assert.strictEqual(model.getLineContent(1), "    if (a) {");
      assert.strictEqual(model.getLineContent(2), "        ");
      assert.strictEqual(model.getLineContent(3), "");
      assert.strictEqual(model.getLineContent(4), "");
      assert.strictEqual(model.getLineContent(5), "    }something");
    });
    registration.dispose();
  });
  test("removeAutoWhitespace on: test 1", () => {
    const model = createTextModel2(
      [
        "    some  line abc  "
      ].join("\n")
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 1, model.getLineContent(1).length + 1);
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getLineContent(1), "    some  line abc  ");
      assert.strictEqual(model.getLineContent(2), "    ");
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getLineContent(1), "    some  line abc  ");
      assert.strictEqual(model.getLineContent(2), "");
      assert.strictEqual(model.getLineContent(3), "    ");
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "    some  line abc  ");
      assert.strictEqual(model.getLineContent(2), "");
      assert.strictEqual(model.getLineContent(3), "        ");
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getLineContent(1), "    some  line abc  ");
      assert.strictEqual(model.getLineContent(2), "");
      assert.strictEqual(model.getLineContent(3), "");
      assert.strictEqual(model.getLineContent(4), "        ");
      moveTo(editor, viewModel, 1, 5);
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getLineContent(1), "    ");
      assert.strictEqual(model.getLineContent(2), "    some  line abc  ");
      assert.strictEqual(model.getLineContent(3), "");
      assert.strictEqual(model.getLineContent(4), "");
      assert.strictEqual(model.getLineContent(5), "");
      moveTo(editor, viewModel, 2, 5);
      moveTo(editor, viewModel, 3, 1, true);
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getLineContent(1), "    ");
      assert.strictEqual(model.getLineContent(2), "    ");
      assert.strictEqual(model.getLineContent(3), "    ");
      assert.strictEqual(model.getLineContent(4), "");
      assert.strictEqual(model.getLineContent(5), "");
    });
  });
  test("issue #15118: remove auto whitespace when pasting entire line", () => {
    const model = createTextModel2(
      [
        "    function f() {",
        "        // I'm gonna copy this line",
        "        return 3;",
        "    }"
      ].join("\n")
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 3, model.getLineMaxColumn(3));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "    function f() {",
        "        // I'm gonna copy this line",
        "        return 3;",
        "        ",
        "    }"
      ].join("\n"));
      assertCursor(viewModel, new Position(4, model.getLineMaxColumn(4)));
      viewModel.paste("        // I'm gonna copy this line\n", true);
      assert.strictEqual(model.getValue(), [
        "    function f() {",
        "        // I'm gonna copy this line",
        "        return 3;",
        "        // I'm gonna copy this line",
        "",
        "    }"
      ].join("\n"));
      assertCursor(viewModel, new Position(5, 1));
    });
  });
  test("issue #40695: maintain cursor position when copying lines using ctrl+c, ctrl+v", () => {
    const model = createTextModel2(
      [
        "    function f() {",
        "        // I'm gonna copy this line",
        "        // Another line",
        "        return 3;",
        "    }"
      ].join("\n")
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      editor.setSelections([new Selection(4, 10, 4, 10)]);
      viewModel.paste("        // I'm gonna copy this line\n", true);
      assert.strictEqual(model.getValue(), [
        "    function f() {",
        "        // I'm gonna copy this line",
        "        // Another line",
        "        // I'm gonna copy this line",
        "        return 3;",
        "    }"
      ].join("\n"));
      assertCursor(viewModel, new Position(5, 10));
    });
  });
  test("UseTabStops is off", () => {
    const model = createTextModel2(
      [
        "    x",
        "        a    ",
        "    "
      ].join("\n")
    );
    withTestCodeEditor2(model, { useTabStops: false }, (editor, viewModel) => {
      moveTo(editor, viewModel, 2, 9);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "       a    ");
    });
  });
  test("Backspace removes whitespaces with tab size", () => {
    const model = createTextModel2(
      [
        " 	 	     x",
        "        a    ",
        "    "
      ].join("\n")
    );
    withTestCodeEditor2(model, { useTabStops: true }, (editor, viewModel) => {
      moveTo(editor, viewModel, 2, model.getLineContent(2).length + 1);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "        a   ");
      moveTo(editor, viewModel, 2, 9);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "    a   ");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "a   ");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "        a   ");
      moveTo(editor, viewModel, 1, 1);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), " 	 	     x");
      moveTo(editor, viewModel, 1, 10);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), " 	 	    x");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), " 	 	x");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), " 	x");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "x");
      moveTo(editor, viewModel, 3, model.getLineContent(3).length + 1);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(3), "");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "x\n        a   ");
      moveTo(editor, viewModel, 2, 3);
      moveTo(editor, viewModel, 2, 4, true);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "       a   ");
    });
  });
  test("PR #5423: Auto indent + undo + redo is funky", () => {
    const model = createTextModel2(
      [
        ""
      ].join("\n"),
      void 0,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n", "assert1");
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	", "assert2");
      viewModel.type("y", "keyboard");
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	y", "assert2");
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	y\n	", "assert3");
      viewModel.type("x");
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	y\n	x", "assert4");
      CoreNavigationCommands.CursorLeft.runCoreEditorCommand(viewModel, {});
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	y\n	x", "assert5");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	y\nx", "assert6");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	yx", "assert7");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	x", "assert8");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\nx", "assert9");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "x", "assert10");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\nx", "assert11");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	y\nx", "assert12");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	y\n	x", "assert13");
      CoreEditingCommands.Redo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\n	y\nx", "assert14");
      CoreEditingCommands.Redo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "\nx", "assert15");
      CoreEditingCommands.Redo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "x", "assert16");
    });
  });
  test("issue #90973: Undo brings back model alternative version", () => {
    const model = createTextModel2(
      [
        ""
      ].join("\n"),
      void 0,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      const beforeVersion = model.getVersionId();
      const beforeAltVersion = model.getAlternativeVersionId();
      viewModel.type("Hello", "keyboard");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      const afterVersion = model.getVersionId();
      const afterAltVersion = model.getAlternativeVersionId();
      assert.notStrictEqual(beforeVersion, afterVersion);
      assert.strictEqual(beforeAltVersion, afterAltVersion);
    });
  });
  test("Enter honors increaseIndentPattern", () => {
    usingCursor({
      text: [
        "if (true) {",
        "	if (true) {"
      ],
      languageId: indentRulesLanguageId,
      modelOpts: { insertSpaces: false },
      editorOpts: { autoIndent: "full" }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 1, 12, false);
      assertCursor(viewModel, new Selection(1, 12, 1, 12));
      viewModel.type("\n", "keyboard");
      model.tokenization.forceTokenization(model.getLineCount());
      assertCursor(viewModel, new Selection(2, 2, 2, 2));
      moveTo(editor, viewModel, 3, 13, false);
      assertCursor(viewModel, new Selection(3, 13, 3, 13));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(4, 3, 4, 3));
    });
  });
  test("Type honors decreaseIndentPattern", () => {
    usingCursor({
      text: [
        "if (true) {",
        "	"
      ],
      languageId: indentRulesLanguageId,
      editorOpts: { autoIndent: "full" }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 2, 2, false);
      assertCursor(viewModel, new Selection(2, 2, 2, 2));
      viewModel.type("}", "keyboard");
      assertCursor(viewModel, new Selection(2, 2, 2, 2));
      assert.strictEqual(model.getLineContent(2), "}", "001");
    });
  });
  test("Enter honors unIndentedLinePattern", () => {
    usingCursor({
      text: [
        "if (true) {",
        "			return true"
      ],
      languageId: indentRulesLanguageId,
      modelOpts: { insertSpaces: false },
      editorOpts: { autoIndent: "full" }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 2, 15, false);
      assertCursor(viewModel, new Selection(2, 15, 2, 15));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(3, 2, 3, 2));
    });
  });
  test("Enter honors indentNextLinePattern", () => {
    usingCursor({
      text: [
        "if (true)",
        "	return true;",
        "if (true)",
        "				return true"
      ],
      languageId: indentRulesLanguageId,
      modelOpts: { insertSpaces: false },
      editorOpts: { autoIndent: "full" }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 2, 14, false);
      assertCursor(viewModel, new Selection(2, 14, 2, 14));
      viewModel.type("\n", "keyboard");
      model.tokenization.forceTokenization(model.getLineCount());
      assertCursor(viewModel, new Selection(3, 1, 3, 1));
      moveTo(editor, viewModel, 5, 16, false);
      assertCursor(viewModel, new Selection(5, 16, 5, 16));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(6, 2, 6, 2));
    });
  });
  test("Enter honors indentNextLinePattern 2", () => {
    const model = createTextModel2(
      [
        "if (true)",
        "	if (true)"
      ].join("\n"),
      indentRulesLanguageId,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor2(model, { autoIndent: "full" }, (editor, viewModel) => {
      moveTo(editor, viewModel, 2, 11, false);
      assertCursor(viewModel, new Selection(2, 11, 2, 11));
      viewModel.type("\n", "keyboard");
      model.tokenization.forceTokenization(model.getLineCount());
      assertCursor(viewModel, new Selection(3, 3, 3, 3));
      viewModel.type("console.log();", "keyboard");
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(4, 1, 4, 1));
    });
  });
  test("Enter honors intential indent", () => {
    usingCursor({
      text: [
        "if (true) {",
        "	if (true) {",
        "return true;",
        "}}"
      ],
      languageId: indentRulesLanguageId,
      editorOpts: { autoIndent: "full" }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 3, 13, false);
      assertCursor(viewModel, new Selection(3, 13, 3, 13));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(4, 1, 4, 1));
      assert.strictEqual(model.getLineContent(3), "return true;", "001");
    });
  });
  test("Enter supports selection 1", () => {
    usingCursor({
      text: [
        "if (true) {",
        "	if (true) {",
        "		return true;",
        "	}a}"
      ],
      languageId: indentRulesLanguageId,
      modelOpts: { insertSpaces: false }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 4, 3, false);
      moveTo(editor, viewModel, 4, 4, true);
      assertCursor(viewModel, new Selection(4, 3, 4, 4));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(5, 1, 5, 1));
      assert.strictEqual(model.getLineContent(4), "	}", "001");
    });
  });
  test("Enter supports selection 2", () => {
    usingCursor({
      text: [
        "if (true) {",
        "	if (true) {"
      ],
      languageId: indentRulesLanguageId,
      modelOpts: { insertSpaces: false }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 2, 12, false);
      moveTo(editor, viewModel, 2, 13, true);
      assertCursor(viewModel, new Selection(2, 12, 2, 13));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(3, 3, 3, 3));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(4, 3, 4, 3));
    });
  });
  test("Enter honors tabSize and insertSpaces 1", () => {
    usingCursor({
      text: [
        "if (true) {",
        "	if (true) {"
      ],
      languageId: indentRulesLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 1, 12, false);
      assertCursor(viewModel, new Selection(1, 12, 1, 12));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(2, 5, 2, 5));
      model.tokenization.forceTokenization(model.getLineCount());
      moveTo(editor, viewModel, 3, 13, false);
      assertCursor(viewModel, new Selection(3, 13, 3, 13));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(4, 9, 4, 9));
    });
  });
  test("Enter honors tabSize and insertSpaces 2", () => {
    usingCursor({
      text: [
        "if (true) {",
        "    if (true) {"
      ],
      languageId: indentRulesLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 1, 12, false);
      assertCursor(viewModel, new Selection(1, 12, 1, 12));
      viewModel.type("\n", "keyboard");
      model.tokenization.forceTokenization(model.getLineCount());
      assertCursor(viewModel, new Selection(2, 5, 2, 5));
      moveTo(editor, viewModel, 3, 16, false);
      assertCursor(viewModel, new Selection(3, 16, 3, 16));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getLineContent(3), "    if (true) {");
      assertCursor(viewModel, new Selection(4, 9, 4, 9));
    });
  });
  test("Enter honors tabSize and insertSpaces 3", () => {
    usingCursor({
      text: [
        "if (true) {",
        "    if (true) {"
      ],
      languageId: indentRulesLanguageId,
      modelOpts: { insertSpaces: false }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 1, 12, false);
      assertCursor(viewModel, new Selection(1, 12, 1, 12));
      viewModel.type("\n", "keyboard");
      model.tokenization.forceTokenization(model.getLineCount());
      assertCursor(viewModel, new Selection(2, 2, 2, 2));
      moveTo(editor, viewModel, 3, 16, false);
      assertCursor(viewModel, new Selection(3, 16, 3, 16));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getLineContent(3), "    if (true) {");
      assertCursor(viewModel, new Selection(4, 3, 4, 3));
    });
  });
  test("Enter supports intentional indentation", () => {
    usingCursor({
      text: [
        "	if (true) {",
        "		switch(true) {",
        "			case true:",
        "				break;",
        "		}",
        "	}"
      ],
      languageId: indentRulesLanguageId,
      modelOpts: { insertSpaces: false },
      editorOpts: { autoIndent: "full" }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 5, 4, false);
      assertCursor(viewModel, new Selection(5, 4, 5, 4));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getLineContent(5), "		}");
      assertCursor(viewModel, new Selection(6, 3, 6, 3));
    });
  });
  test("Enter should not adjust cursor position when press enter in the middle of a line 1", () => {
    usingCursor({
      text: [
        "if (true) {",
        "	if (true) {",
        "		return true;",
        "	}a}"
      ],
      languageId: indentRulesLanguageId,
      modelOpts: { insertSpaces: false }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 3, 9, false);
      assertCursor(viewModel, new Selection(3, 9, 3, 9));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(4, 3, 4, 3));
      assert.strictEqual(model.getLineContent(4), "		 true;", "001");
    });
  });
  test("Enter should not adjust cursor position when press enter in the middle of a line 2", () => {
    usingCursor({
      text: [
        "if (true) {",
        "	if (true) {",
        "		return true;",
        "	}a}"
      ],
      languageId: indentRulesLanguageId,
      modelOpts: { insertSpaces: false }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 3, 3, false);
      assertCursor(viewModel, new Selection(3, 3, 3, 3));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(4, 3, 4, 3));
      assert.strictEqual(model.getLineContent(4), "		return true;", "001");
    });
  });
  test("Enter should not adjust cursor position when press enter in the middle of a line 3", () => {
    usingCursor({
      text: [
        "if (true) {",
        "  if (true) {",
        "    return true;",
        "  }a}"
      ],
      languageId: indentRulesLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 3, 11, false);
      assertCursor(viewModel, new Selection(3, 11, 3, 11));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(4, 5, 4, 5));
      assert.strictEqual(model.getLineContent(4), "     true;", "001");
    });
  });
  test("Enter should adjust cursor position when press enter in the middle of leading whitespaces 1", () => {
    usingCursor({
      text: [
        "if (true) {",
        "	if (true) {",
        "		return true;",
        "	}a}"
      ],
      languageId: indentRulesLanguageId,
      modelOpts: { insertSpaces: false }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 3, 2, false);
      assertCursor(viewModel, new Selection(3, 2, 3, 2));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(4, 2, 4, 2));
      assert.strictEqual(model.getLineContent(4), "		return true;", "001");
      moveTo(editor, viewModel, 4, 1, false);
      assertCursor(viewModel, new Selection(4, 1, 4, 1));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(5, 1, 5, 1));
      assert.strictEqual(model.getLineContent(5), "		return true;", "002");
    });
  });
  test("Enter should adjust cursor position when press enter in the middle of leading whitespaces 2", () => {
    usingCursor({
      text: [
        "	if (true) {",
        "		if (true) {",
        "	    	return true;",
        "		}a}"
      ],
      languageId: indentRulesLanguageId,
      modelOpts: { insertSpaces: false }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 3, 4, false);
      assertCursor(viewModel, new Selection(3, 4, 3, 4));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(4, 3, 4, 3));
      assert.strictEqual(model.getLineContent(4), "			return true;", "001");
      moveTo(editor, viewModel, 4, 1, false);
      assertCursor(viewModel, new Selection(4, 1, 4, 1));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(5, 1, 5, 1));
      assert.strictEqual(model.getLineContent(5), "			return true;", "002");
    });
  });
  test("Enter should adjust cursor position when press enter in the middle of leading whitespaces 3", () => {
    usingCursor({
      text: [
        "if (true) {",
        "  if (true) {",
        "    return true;",
        "}a}"
      ],
      languageId: indentRulesLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 3, 2, false);
      assertCursor(viewModel, new Selection(3, 2, 3, 2));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(4, 2, 4, 2));
      assert.strictEqual(model.getLineContent(4), "    return true;", "001");
      moveTo(editor, viewModel, 4, 3, false);
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(5, 3, 5, 3));
      assert.strictEqual(model.getLineContent(5), "    return true;", "002");
    });
  });
  test("Enter should adjust cursor position when press enter in the middle of leading whitespaces 4", () => {
    usingCursor({
      text: [
        "if (true) {",
        "  if (true) {",
        "	  return true;",
        "}a}",
        "",
        "if (true) {",
        "  if (true) {",
        "	  return true;",
        "}a}"
      ],
      languageId: indentRulesLanguageId,
      modelOpts: {
        tabSize: 2,
        indentSize: 2
      }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 3, 3, false);
      assertCursor(viewModel, new Selection(3, 3, 3, 3));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(4, 4, 4, 4));
      assert.strictEqual(model.getLineContent(4), "    return true;", "001");
      moveTo(editor, viewModel, 9, 4, false);
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(10, 5, 10, 5));
      assert.strictEqual(model.getLineContent(10), "    return true;", "001");
    });
  });
  test("Enter should adjust cursor position when press enter in the middle of leading whitespaces 5", () => {
    usingCursor({
      text: [
        "if (true) {",
        "  if (true) {",
        "    return true;",
        "    return true;",
        ""
      ],
      languageId: indentRulesLanguageId,
      modelOpts: { tabSize: 2 }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 3, 5, false);
      moveTo(editor, viewModel, 4, 3, true);
      assertCursor(viewModel, new Selection(3, 5, 4, 3));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(4, 3, 4, 3));
      assert.strictEqual(model.getLineContent(4), "    return true;", "001");
    });
  });
  test("issue microsoft/monaco-editor#108 part 1/2: Auto indentation on Enter with selection is half broken", () => {
    usingCursor({
      text: [
        "function baz() {",
        "	var x = 1;",
        "							return x;",
        "}"
      ],
      modelOpts: {
        insertSpaces: false
      },
      languageId: indentRulesLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 3, 8, false);
      moveTo(editor, viewModel, 2, 12, true);
      assertCursor(viewModel, new Selection(3, 8, 2, 12));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getLineContent(3), "	return x;");
      assertCursor(viewModel, new Position(3, 2));
    });
  });
  test("issue microsoft/monaco-editor#108 part 2/2: Auto indentation on Enter with selection is half broken", () => {
    usingCursor({
      text: [
        "function baz() {",
        "	var x = 1;",
        "							return x;",
        "}"
      ],
      modelOpts: {
        insertSpaces: false
      },
      languageId: indentRulesLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 2, 12, false);
      moveTo(editor, viewModel, 3, 8, true);
      assertCursor(viewModel, new Selection(2, 12, 3, 8));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getLineContent(3), "	return x;");
      assertCursor(viewModel, new Position(3, 2));
    });
  });
  test("onEnter works if there are no indentation rules", () => {
    usingCursor({
      text: [
        "<?",
        "	if (true) {",
        "		echo $hi;",
        "		echo $bye;",
        "	}",
        "?>"
      ],
      modelOpts: { insertSpaces: false }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 5, 3, false);
      assertCursor(viewModel, new Selection(5, 3, 5, 3));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getLineContent(6), "	");
      assertCursor(viewModel, new Selection(6, 2, 6, 2));
      assert.strictEqual(model.getLineContent(5), "	}");
    });
  });
  test("onEnter works if there are no indentation rules 2", () => {
    usingCursor({
      text: [
        "	if (5)",
        "		return 5;",
        "	"
      ],
      modelOpts: { insertSpaces: false }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 3, 2, false);
      assertCursor(viewModel, new Selection(3, 2, 3, 2));
      viewModel.type("\n", "keyboard");
      assertCursor(viewModel, new Selection(4, 2, 4, 2));
      assert.strictEqual(model.getLineContent(4), "	");
    });
  });
  test("bug #16543: Tab should indent to correct indentation spot immediately", () => {
    const model = createTextModel2(
      [
        "function baz() {",
        "	function hello() { // something here",
        "	",
        "",
        "	}",
        "}"
      ].join("\n"),
      indentRulesLanguageId,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 4, 1, false);
      assertCursor(viewModel, new Selection(4, 1, 4, 1));
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(4), "		");
    });
  });
  test("bug #2938 (1): When pressing Tab on white-space only lines, indent straight to the right spot (similar to empty lines)", () => {
    const model = createTextModel2(
      [
        "	function baz() {",
        "		function hello() { // something here",
        "		",
        "	",
        "		}",
        "	}"
      ].join("\n"),
      indentRulesLanguageId,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 4, 2, false);
      assertCursor(viewModel, new Selection(4, 2, 4, 2));
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(4), "			");
    });
  });
  test("bug #2938 (2): When pressing Tab on white-space only lines, indent straight to the right spot (similar to empty lines)", () => {
    const model = createTextModel2(
      [
        "	function baz() {",
        "		function hello() { // something here",
        "		",
        "    ",
        "		}",
        "	}"
      ].join("\n"),
      indentRulesLanguageId,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 4, 1, false);
      assertCursor(viewModel, new Selection(4, 1, 4, 1));
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(4), "			");
    });
  });
  test("bug #2938 (3): When pressing Tab on white-space only lines, indent straight to the right spot (similar to empty lines)", () => {
    const model = createTextModel2(
      [
        "	function baz() {",
        "		function hello() { // something here",
        "		",
        "			",
        "		}",
        "	}"
      ].join("\n"),
      indentRulesLanguageId,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 4, 3, false);
      assertCursor(viewModel, new Selection(4, 3, 4, 3));
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(4), "				");
    });
  });
  test("bug #2938 (4): When pressing Tab on white-space only lines, indent straight to the right spot (similar to empty lines)", () => {
    const model = createTextModel2(
      [
        "	function baz() {",
        "		function hello() { // something here",
        "		",
        "				",
        "		}",
        "	}"
      ].join("\n"),
      indentRulesLanguageId,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 4, 4, false);
      assertCursor(viewModel, new Selection(4, 4, 4, 4));
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(4), "					");
    });
  });
  test("bug #31015: When pressing Tab on lines and Enter rules are avail, indent straight to the right spotTab", () => {
    const onEnterLanguageId = setupOnEnterLanguage(IndentAction.Indent);
    const model = createTextModel2(
      [
        "    if (a) {",
        "        ",
        "",
        "",
        "    }"
      ].join("\n"),
      onEnterLanguageId
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      moveTo(editor, viewModel, 3, 1);
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "    if (a) {");
      assert.strictEqual(model.getLineContent(2), "        ");
      assert.strictEqual(model.getLineContent(3), "        ");
      assert.strictEqual(model.getLineContent(4), "");
      assert.strictEqual(model.getLineContent(5), "    }");
    });
  });
  test("type honors indentation rules: ruby keywords", () => {
    const rubyLanguageId = setupIndentRulesLanguage("ruby", {
      increaseIndentPattern: /^\s*((begin|class|def|else|elsif|ensure|for|if|module|rescue|unless|until|when|while)|(.*\sdo\b))\b[^\{;]*$/,
      decreaseIndentPattern: /^\s*([}\]]([,)]?\s*(#|$)|\.[a-zA-Z_]\w*\b)|(end|rescue|ensure|else|elsif|when)\b)/
    });
    const model = createTextModel2(
      [
        "class Greeter",
        "  def initialize(name)",
        "    @name = name",
        "    en"
      ].join("\n"),
      rubyLanguageId
    );
    withTestCodeEditor2(model, { autoIndent: "full" }, (editor, viewModel) => {
      moveTo(editor, viewModel, 4, 7, false);
      assertCursor(viewModel, new Selection(4, 7, 4, 7));
      viewModel.type("d", "keyboard");
      assert.strictEqual(model.getLineContent(4), "  end");
    });
  });
  test("Auto indent on type: increaseIndentPattern has higher priority than decreaseIndent when inheriting", () => {
    usingCursor({
      text: [
        "	if (true) {",
        "		console.log();",
        "	} else if {",
        "		console.log()",
        "	}"
      ],
      languageId: indentRulesLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 5, 3, false);
      assertCursor(viewModel, new Selection(5, 3, 5, 3));
      viewModel.type("e", "keyboard");
      assertCursor(viewModel, new Selection(5, 4, 5, 4));
      assert.strictEqual(model.getLineContent(5), "	}e", "This line should not decrease indent");
    });
  });
  test("type honors users indentation adjustment", () => {
    usingCursor({
      text: [
        "	if (true ||",
        "	 ) {",
        "	}",
        "if (true ||",
        ") {",
        "}"
      ],
      languageId: indentRulesLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 2, 3, false);
      assertCursor(viewModel, new Selection(2, 3, 2, 3));
      viewModel.type(" ", "keyboard");
      assertCursor(viewModel, new Selection(2, 4, 2, 4));
      assert.strictEqual(model.getLineContent(2), "	  ) {", "This line should not decrease indent");
    });
  });
  test("bug 29972: if a line is line comment, open bracket should not indent next line", () => {
    usingCursor({
      text: [
        "if (true) {",
        "	// {",
        "		"
      ],
      languageId: indentRulesLanguageId,
      editorOpts: { autoIndent: "full" }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 3, 3, false);
      assertCursor(viewModel, new Selection(3, 3, 3, 3));
      viewModel.type("}", "keyboard");
      assertCursor(viewModel, new Selection(3, 2, 3, 2));
      assert.strictEqual(model.getLineContent(3), "}");
    });
  });
  test("issue #38261: TAB key results in bizarre indentation in C++ mode ", () => {
    const languageId = "indentRulesMode";
    disposables.add(languageService.registerLanguage({ id: languageId }));
    disposables.add(languageConfigurationService.register(languageId, {
      brackets: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"]
      ],
      indentationRules: {
        increaseIndentPattern: new RegExp("(^.*\\{[^}]*$)"),
        decreaseIndentPattern: new RegExp("^\\s*\\}")
      }
    }));
    const model = createTextModel2(
      [
        "int main() {",
        "  return 0;",
        "}",
        "",
        "bool Foo::bar(const string &a,",
        "              const string &b) {",
        "  foo();",
        "",
        ")"
      ].join("\n"),
      languageId,
      {
        tabSize: 2,
        indentSize: 2
      }
    );
    withTestCodeEditor2(model, { autoIndent: "advanced" }, (editor, viewModel) => {
      moveTo(editor, viewModel, 8, 1, false);
      assertCursor(viewModel, new Selection(8, 1, 8, 1));
      CoreEditingCommands.Tab.runEditorCommand(null, editor, null);
      assert.strictEqual(
        model.getValue(),
        [
          "int main() {",
          "  return 0;",
          "}",
          "",
          "bool Foo::bar(const string &a,",
          "              const string &b) {",
          "  foo();",
          "  ",
          ")"
        ].join("\n")
      );
      assert.deepStrictEqual(viewModel.getSelection(), new Selection(8, 3, 8, 3));
    });
  });
  test("issue #57197: indent rules regex should be stateless", () => {
    const languageId = setupIndentRulesLanguage("lang", {
      decreaseIndentPattern: /^\s*}$/gm,
      increaseIndentPattern: /^(?![^\S\n]*(?!--|––|——)(?:[-❍❑■⬜□☐▪▫–—≡→›✘xX✔✓☑+]|\[[ xX+-]?\])\s[^\n]*)[^\S\n]*(.+:)[^\S\n]*(?:(?=@[^\s*~(]+(?::\/\/[^\s*~(:]+)?(?:\([^)]*\))?)|$)/gm
    });
    usingCursor({
      text: [
        "Project:"
      ],
      languageId,
      modelOpts: { insertSpaces: false },
      editorOpts: { autoIndent: "full" }
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 1, 9, false);
      assertCursor(viewModel, new Selection(1, 9, 1, 9));
      viewModel.type("\n", "keyboard");
      model.tokenization.forceTokenization(model.getLineCount());
      assertCursor(viewModel, new Selection(2, 2, 2, 2));
      moveTo(editor, viewModel, 1, 9, false);
      assertCursor(viewModel, new Selection(1, 9, 1, 9));
      viewModel.type("\n", "keyboard");
      model.tokenization.forceTokenization(model.getLineCount());
      assertCursor(viewModel, new Selection(2, 2, 2, 2));
    });
  });
  test("typing in json", () => {
    const languageId = "indentRulesMode";
    disposables.add(languageService.registerLanguage({ id: languageId }));
    disposables.add(languageConfigurationService.register(languageId, {
      brackets: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"]
      ],
      indentationRules: {
        increaseIndentPattern: new RegExp('({+(?=([^"]*"[^"]*")*[^"}]*$))|(\\[+(?=([^"]*"[^"]*")*[^"\\]]*$))'),
        decreaseIndentPattern: new RegExp("^\\s*[}\\]],?\\s*$")
      }
    }));
    const model = createTextModel2(
      [
        "{",
        '  "scripts: {"',
        '    "watch": "a {"',
        '    "build{": "b"',
        '    "tasks": []',
        '    "tasks": ["a"]',
        '  "}"',
        '"}"'
      ].join("\n"),
      languageId,
      {
        tabSize: 2,
        indentSize: 2
      }
    );
    withTestCodeEditor2(model, { autoIndent: "full" }, (editor, viewModel) => {
      moveTo(editor, viewModel, 3, 19, false);
      assertCursor(viewModel, new Selection(3, 19, 3, 19));
      viewModel.type("\n", "keyboard");
      assert.deepStrictEqual(model.getLineContent(4), "    ");
      moveTo(editor, viewModel, 5, 18, false);
      assertCursor(viewModel, new Selection(5, 18, 5, 18));
      viewModel.type("\n", "keyboard");
      assert.deepStrictEqual(model.getLineContent(6), "    ");
      moveTo(editor, viewModel, 7, 15, false);
      assertCursor(viewModel, new Selection(7, 15, 7, 15));
      viewModel.type("\n", "keyboard");
      assert.deepStrictEqual(model.getLineContent(8), "      ");
      assert.deepStrictEqual(model.getLineContent(9), "    ]");
      moveTo(editor, viewModel, 10, 18, false);
      assertCursor(viewModel, new Selection(10, 18, 10, 18));
      viewModel.type("\n", "keyboard");
      assert.deepStrictEqual(model.getLineContent(11), "    ]");
    });
  });
  test("issue #111128: Multicursor `Enter` issue with indentation", () => {
    const model = createTextModel2("    let a, b, c;", indentRulesLanguageId, { detectIndentation: false, insertSpaces: false, tabSize: 4 });
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      editor.setSelections([
        new Selection(1, 11, 1, 11),
        new Selection(1, 14, 1, 14)
      ]);
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), "    let a,\n	 b,\n	 c;");
    });
  });
  test("issue #122714: tabSize=1 prevent typing a string matching decreaseIndentPattern in an empty file", () => {
    const latextLanguageId = setupIndentRulesLanguage("latex", {
      increaseIndentPattern: new RegExp("\\\\begin{(?!document)([^}]*)}(?!.*\\\\end{\\1})"),
      decreaseIndentPattern: new RegExp("^\\s*\\\\end{(?!document)")
    });
    const model = createTextModel2(
      "\\end",
      latextLanguageId,
      { tabSize: 1 }
    );
    withTestCodeEditor2(model, { autoIndent: "full" }, (editor, viewModel) => {
      moveTo(editor, viewModel, 1, 5, false);
      assertCursor(viewModel, new Selection(1, 5, 1, 5));
      viewModel.type("{", "keyboard");
      assert.strictEqual(model.getLineContent(1), "\\end{}");
    });
  });
  test("ElectricCharacter - does nothing if no electric char", () => {
    usingCursor({
      text: [
        "  if (a) {",
        ""
      ],
      languageId: electricCharLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 2, 1);
      viewModel.type("*", "keyboard");
      assert.deepStrictEqual(model.getLineContent(2), "*");
    });
  });
  test("ElectricCharacter - indents in order to match bracket", () => {
    usingCursor({
      text: [
        "  if (a) {",
        ""
      ],
      languageId: electricCharLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 2, 1);
      viewModel.type("}", "keyboard");
      assert.deepStrictEqual(model.getLineContent(2), "  }");
    });
  });
  test("ElectricCharacter - unindents in order to match bracket", () => {
    usingCursor({
      text: [
        "  if (a) {",
        "    "
      ],
      languageId: electricCharLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 2, 5);
      viewModel.type("}", "keyboard");
      assert.deepStrictEqual(model.getLineContent(2), "  }");
    });
  });
  test("ElectricCharacter - matches with correct bracket", () => {
    usingCursor({
      text: [
        "  if (a) {",
        "    if (b) {",
        "    }",
        "    "
      ],
      languageId: electricCharLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 4, 1);
      viewModel.type("}", "keyboard");
      assert.deepStrictEqual(model.getLineContent(4), "  }    ");
    });
  });
  test("ElectricCharacter - does nothing if bracket does not match", () => {
    usingCursor({
      text: [
        "  if (a) {",
        "    if (b) {",
        "    }",
        "  }  "
      ],
      languageId: electricCharLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 4, 6);
      viewModel.type("}", "keyboard");
      assert.deepStrictEqual(model.getLineContent(4), "  }  }");
    });
  });
  test("ElectricCharacter - matches bracket even in line with content", () => {
    usingCursor({
      text: [
        "  if (a) {",
        "// hello"
      ],
      languageId: electricCharLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 2, 1);
      viewModel.type("}", "keyboard");
      assert.deepStrictEqual(model.getLineContent(2), "  }// hello");
    });
  });
  test("ElectricCharacter - is no-op if bracket is lined up", () => {
    usingCursor({
      text: [
        "  if (a) {",
        "  "
      ],
      languageId: electricCharLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 2, 3);
      viewModel.type("}", "keyboard");
      assert.deepStrictEqual(model.getLineContent(2), "  }");
    });
  });
  test("ElectricCharacter - is no-op if there is non-whitespace text before", () => {
    usingCursor({
      text: [
        "  if (a) {",
        "a"
      ],
      languageId: electricCharLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 2, 2);
      viewModel.type("}", "keyboard");
      assert.deepStrictEqual(model.getLineContent(2), "a}");
    });
  });
  test("ElectricCharacter - is no-op if pairs are all matched before", () => {
    usingCursor({
      text: [
        "foo(() => {",
        "  ( 1 + 2 ) ",
        "})"
      ],
      languageId: electricCharLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 2, 13);
      viewModel.type("*", "keyboard");
      assert.deepStrictEqual(model.getLineContent(2), "  ( 1 + 2 ) *");
    });
  });
  test("ElectricCharacter - is no-op if matching bracket is on the same line", () => {
    usingCursor({
      text: [
        "(div"
      ],
      languageId: electricCharLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 1, 5);
      let changeText = null;
      const disposable = model.onDidChangeContent((e) => {
        changeText = e.changes[0].text;
      });
      viewModel.type(")", "keyboard");
      assert.deepStrictEqual(model.getLineContent(1), "(div)");
      assert.deepStrictEqual(changeText, ")");
      disposable.dispose();
    });
  });
  test("ElectricCharacter - is no-op if the line has other content", () => {
    usingCursor({
      text: [
        "Math.max(",
        "	2",
        "	3"
      ],
      languageId: electricCharLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 3, 3);
      viewModel.type(")", "keyboard");
      assert.deepStrictEqual(model.getLineContent(3), "	3)");
    });
  });
  test("ElectricCharacter - appends text", () => {
    usingCursor({
      text: [
        "  if (a) {",
        "/*"
      ],
      languageId: electricCharLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 2, 3);
      viewModel.type("*", "keyboard");
      assert.deepStrictEqual(model.getLineContent(2), "/** */");
    });
  });
  test("ElectricCharacter - appends text 2", () => {
    usingCursor({
      text: [
        "  if (a) {",
        "  /*"
      ],
      languageId: electricCharLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 2, 5);
      viewModel.type("*", "keyboard");
      assert.deepStrictEqual(model.getLineContent(2), "  /** */");
    });
  });
  test("ElectricCharacter - issue #23711: Replacing selected text with )]} fails to delete old text with backwards-dragged selection", () => {
    usingCursor({
      text: [
        "{",
        "word"
      ],
      languageId: electricCharLanguageId
    }, (editor, model, viewModel) => {
      moveTo(editor, viewModel, 2, 5);
      moveTo(editor, viewModel, 2, 1, true);
      viewModel.type("}", "keyboard");
      assert.deepStrictEqual(model.getLineContent(2), "}");
    });
  });
  test("issue #61070: backtick (`) should auto-close after a word character", () => {
    usingCursor({
      text: ["const markup = highlight"],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      model.tokenization.forceTokenization(1);
      assertType(editor, model, viewModel, 1, 25, "`", "``", `auto closes \` @ (1, 25)`);
    });
  });
  test("issue #132912: quotes should not auto-close if they are closing a string", () => {
    setupAutoClosingLanguageTokenization();
    const model = createTextModel2("const t2 = `something ${t1}", autoClosingLanguageId);
    withTestCodeEditor2(
      model,
      {},
      (editor, viewModel) => {
        const model2 = viewModel.model;
        model2.tokenization.forceTokenization(1);
        assertType(editor, model2, viewModel, 1, 28, "`", "`", `does not auto close \` @ (1, 28)`);
      }
    );
  });
  test("autoClosingPairs - open parens: default", () => {
    usingCursor({
      text: [
        "var a = [];",
        "var b = `asd`;",
        "var c = 'asd';",
        'var d = "asd";',
        "var e = /*3*/	3;",
        "var f = /** 3 */3;",
        "var g = (3+5);",
        "var h = { a: 'value' };"
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      const autoClosePositions = [
        "var| a| |=| [|]|;|",
        "var| b| |=| |`asd|`|;|",
        "var| c| |=| |'asd|'|;|",
        'var| d| |=| |"asd|"|;|',
        "var| e| |=| /*3*/|	3|;|",
        "var| f| |=| /**| 3| */3|;|",
        "var| g| |=| (3+5|)|;|",
        "var| h| |=| {| a|:| |'value|'| |}|;|"
      ];
      for (let i = 0, len = autoClosePositions.length; i < len; i++) {
        const lineNumber = i + 1;
        const autoCloseColumns = extractAutoClosingSpecialColumns(model.getLineMaxColumn(lineNumber), autoClosePositions[i]);
        for (let column = 1; column < autoCloseColumns.length; column++) {
          model.tokenization.forceTokenization(lineNumber);
          if (autoCloseColumns[column] === 1 /* Special1 */) {
            assertType(editor, model, viewModel, lineNumber, column, "(", "()", `auto closes @ (${lineNumber}, ${column})`);
          } else {
            assertType(editor, model, viewModel, lineNumber, column, "(", "(", `does not auto close @ (${lineNumber}, ${column})`);
          }
        }
      }
    });
  });
  test("autoClosingPairs - open parens: whitespace", () => {
    usingCursor({
      text: [
        "var a = [];",
        "var b = `asd`;",
        "var c = 'asd';",
        'var d = "asd";',
        "var e = /*3*/	3;",
        "var f = /** 3 */3;",
        "var g = (3+5);",
        "var h = { a: 'value' };"
      ],
      languageId: autoClosingLanguageId,
      editorOpts: {
        autoClosingBrackets: "beforeWhitespace"
      }
    }, (editor, model, viewModel) => {
      const autoClosePositions = [
        "var| a| =| [|];|",
        "var| b| =| `asd`;|",
        "var| c| =| 'asd';|",
        'var| d| =| "asd";|',
        "var| e| =| /*3*/|	3;|",
        "var| f| =| /**| 3| */3;|",
        "var| g| =| (3+5|);|",
        "var| h| =| {| a:| 'value'| |};|"
      ];
      for (let i = 0, len = autoClosePositions.length; i < len; i++) {
        const lineNumber = i + 1;
        const autoCloseColumns = extractAutoClosingSpecialColumns(model.getLineMaxColumn(lineNumber), autoClosePositions[i]);
        for (let column = 1; column < autoCloseColumns.length; column++) {
          model.tokenization.forceTokenization(lineNumber);
          if (autoCloseColumns[column] === 1 /* Special1 */) {
            assertType(editor, model, viewModel, lineNumber, column, "(", "()", `auto closes @ (${lineNumber}, ${column})`);
          } else {
            assertType(editor, model, viewModel, lineNumber, column, "(", "(", `does not auto close @ (${lineNumber}, ${column})`);
          }
        }
      }
    });
  });
  test("autoClosingPairs - open parens disabled/enabled open quotes enabled/disabled", () => {
    usingCursor({
      text: [
        "var a = [];"
      ],
      languageId: autoClosingLanguageId,
      editorOpts: {
        autoClosingBrackets: "beforeWhitespace",
        autoClosingQuotes: "never"
      }
    }, (editor, model, viewModel) => {
      const autoClosePositions = [
        "var| a| =| [|];|"
      ];
      for (let i = 0, len = autoClosePositions.length; i < len; i++) {
        const lineNumber = i + 1;
        const autoCloseColumns = extractAutoClosingSpecialColumns(model.getLineMaxColumn(lineNumber), autoClosePositions[i]);
        for (let column = 1; column < autoCloseColumns.length; column++) {
          model.tokenization.forceTokenization(lineNumber);
          if (autoCloseColumns[column] === 1 /* Special1 */) {
            assertType(editor, model, viewModel, lineNumber, column, "(", "()", `auto closes @ (${lineNumber}, ${column})`);
          } else {
            assertType(editor, model, viewModel, lineNumber, column, "(", "(", `does not auto close @ (${lineNumber}, ${column})`);
          }
          assertType(editor, model, viewModel, lineNumber, column, "'", "'", `does not auto close @ (${lineNumber}, ${column})`);
        }
      }
    });
    usingCursor({
      text: [
        "var b = [];"
      ],
      languageId: autoClosingLanguageId,
      editorOpts: {
        autoClosingBrackets: "never",
        autoClosingQuotes: "beforeWhitespace"
      }
    }, (editor, model, viewModel) => {
      const autoClosePositions = [
        "var b =| [|];|"
      ];
      for (let i = 0, len = autoClosePositions.length; i < len; i++) {
        const lineNumber = i + 1;
        const autoCloseColumns = extractAutoClosingSpecialColumns(model.getLineMaxColumn(lineNumber), autoClosePositions[i]);
        for (let column = 1; column < autoCloseColumns.length; column++) {
          model.tokenization.forceTokenization(lineNumber);
          if (autoCloseColumns[column] === 1 /* Special1 */) {
            assertType(editor, model, viewModel, lineNumber, column, "'", "''", `auto closes @ (${lineNumber}, ${column})`);
          } else {
            assertType(editor, model, viewModel, lineNumber, column, "'", "'", `does not auto close @ (${lineNumber}, ${column})`);
          }
          assertType(editor, model, viewModel, lineNumber, column, "(", "(", `does not auto close @ (${lineNumber}, ${column})`);
        }
      }
    });
  });
  test("autoClosingPairs - configurable open parens", () => {
    setAutoClosingLanguageEnabledSet("abc");
    usingCursor({
      text: [
        "var a = [];",
        "var b = `asd`;",
        "var c = 'asd';",
        'var d = "asd";',
        "var e = /*3*/	3;",
        "var f = /** 3 */3;",
        "var g = (3+5);",
        "var h = { a: 'value' };"
      ],
      languageId: autoClosingLanguageId,
      editorOpts: {
        autoClosingBrackets: "languageDefined"
      }
    }, (editor, model, viewModel) => {
      const autoClosePositions = [
        "v|ar |a = [|];|",
        "v|ar |b = `|asd`;|",
        "v|ar |c = '|asd';|",
        'v|ar d = "|asd";|',
        "v|ar e = /*3*/	3;|",
        "v|ar f = /** 3| */3;|",
        "v|ar g = (3+5|);|",
        "v|ar h = { |a: 'v|alue' |};|"
      ];
      for (let i = 0, len = autoClosePositions.length; i < len; i++) {
        const lineNumber = i + 1;
        const autoCloseColumns = extractAutoClosingSpecialColumns(model.getLineMaxColumn(lineNumber), autoClosePositions[i]);
        for (let column = 1; column < autoCloseColumns.length; column++) {
          model.tokenization.forceTokenization(lineNumber);
          if (autoCloseColumns[column] === 1 /* Special1 */) {
            assertType(editor, model, viewModel, lineNumber, column, "(", "()", `auto closes @ (${lineNumber}, ${column})`);
          } else {
            assertType(editor, model, viewModel, lineNumber, column, "(", "(", `does not auto close @ (${lineNumber}, ${column})`);
          }
        }
      }
    });
  });
  test("autoClosingPairs - auto-pairing can be disabled", () => {
    usingCursor({
      text: [
        "var a = [];",
        "var b = `asd`;",
        "var c = 'asd';",
        'var d = "asd";',
        "var e = /*3*/	3;",
        "var f = /** 3 */3;",
        "var g = (3+5);",
        "var h = { a: 'value' };"
      ],
      languageId: autoClosingLanguageId,
      editorOpts: {
        autoClosingBrackets: "never",
        autoClosingQuotes: "never"
      }
    }, (editor, model, viewModel) => {
      const autoClosePositions = [
        "var a = [];",
        "var b = `asd`;",
        "var c = 'asd';",
        'var d = "asd";',
        "var e = /*3*/	3;",
        "var f = /** 3 */3;",
        "var g = (3+5);",
        "var h = { a: 'value' };"
      ];
      for (let i = 0, len = autoClosePositions.length; i < len; i++) {
        const lineNumber = i + 1;
        const autoCloseColumns = extractAutoClosingSpecialColumns(model.getLineMaxColumn(lineNumber), autoClosePositions[i]);
        for (let column = 1; column < autoCloseColumns.length; column++) {
          model.tokenization.forceTokenization(lineNumber);
          if (autoCloseColumns[column] === 1 /* Special1 */) {
            assertType(editor, model, viewModel, lineNumber, column, "(", "()", `auto closes @ (${lineNumber}, ${column})`);
            assertType(editor, model, viewModel, lineNumber, column, '"', '""', `auto closes @ (${lineNumber}, ${column})`);
          } else {
            assertType(editor, model, viewModel, lineNumber, column, "(", "(", `does not auto close @ (${lineNumber}, ${column})`);
            assertType(editor, model, viewModel, lineNumber, column, '"', '"', `does not auto close @ (${lineNumber}, ${column})`);
          }
        }
      }
    });
  });
  test("autoClosingPairs - auto wrapping is configurable", () => {
    usingCursor({
      text: [
        "var a = asd"
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      viewModel.setSelections("test", [
        new Selection(1, 1, 1, 4),
        new Selection(1, 9, 1, 12)
      ]);
      viewModel.type("`", "keyboard");
      assert.strictEqual(model.getValue(), "`var` a = `asd`");
      viewModel.type("(", "keyboard");
      assert.strictEqual(model.getValue(), "`(var)` a = `(asd)`");
    });
    usingCursor({
      text: [
        "var a = asd"
      ],
      languageId: autoClosingLanguageId,
      editorOpts: {
        autoSurround: "never"
      }
    }, (editor, model, viewModel) => {
      viewModel.setSelections("test", [
        new Selection(1, 1, 1, 4)
      ]);
      viewModel.type("`", "keyboard");
      assert.strictEqual(model.getValue(), "` a = asd");
    });
    usingCursor({
      text: [
        "var a = asd"
      ],
      languageId: autoClosingLanguageId,
      editorOpts: {
        autoSurround: "quotes"
      }
    }, (editor, model, viewModel) => {
      viewModel.setSelections("test", [
        new Selection(1, 1, 1, 4)
      ]);
      viewModel.type("`", "keyboard");
      assert.strictEqual(model.getValue(), "`var` a = asd");
      viewModel.type("(", "keyboard");
      assert.strictEqual(model.getValue(), "`(` a = asd");
    });
    usingCursor({
      text: [
        "var a = asd"
      ],
      languageId: autoClosingLanguageId,
      editorOpts: {
        autoSurround: "brackets"
      }
    }, (editor, model, viewModel) => {
      viewModel.setSelections("test", [
        new Selection(1, 1, 1, 4)
      ]);
      viewModel.type("(", "keyboard");
      assert.strictEqual(model.getValue(), "(var) a = asd");
      viewModel.type("`", "keyboard");
      assert.strictEqual(model.getValue(), "(`) a = asd");
    });
  });
  test("autoClosingPairs - quote", () => {
    usingCursor({
      text: [
        "var a = [];",
        "var b = `asd`;",
        "var c = 'asd';",
        'var d = "asd";',
        "var e = /*3*/	3;",
        "var f = /** 3 */3;",
        "var g = (3+5);",
        "var h = { a: 'value' };"
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      const autoClosePositions = [
        "var a |=| [|]|;|",
        "var b |=| `asd`|;|",
        "var c |=| 'asd'|;|",
        'var d |=| "asd"|;|',
        "var e |=| /*3*/|	3;|",
        "var f |=| /**| 3 */3;|",
        "var g |=| (3+5)|;|",
        "var h |=| {| a:| 'value'| |}|;|"
      ];
      for (let i = 0, len = autoClosePositions.length; i < len; i++) {
        const lineNumber = i + 1;
        const autoCloseColumns = extractAutoClosingSpecialColumns(model.getLineMaxColumn(lineNumber), autoClosePositions[i]);
        for (let column = 1; column < autoCloseColumns.length; column++) {
          model.tokenization.forceTokenization(lineNumber);
          if (autoCloseColumns[column] === 1 /* Special1 */) {
            assertType(editor, model, viewModel, lineNumber, column, "'", "''", `auto closes @ (${lineNumber}, ${column})`);
          } else if (autoCloseColumns[column] === 2 /* Special2 */) {
            assertType(editor, model, viewModel, lineNumber, column, "'", "", `over types @ (${lineNumber}, ${column})`);
          } else {
            assertType(editor, model, viewModel, lineNumber, column, "'", "'", `does not auto close @ (${lineNumber}, ${column})`);
          }
        }
      }
    });
  });
  test("autoClosingPairs - multi-character autoclose", () => {
    usingCursor({
      text: [
        ""
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      model.setValue("begi");
      viewModel.setSelections("test", [new Selection(1, 5, 1, 5)]);
      viewModel.type("n", "keyboard");
      assert.strictEqual(model.getLineContent(1), "beginend");
      model.setValue("/*");
      viewModel.setSelections("test", [new Selection(1, 3, 1, 3)]);
      viewModel.type("*", "keyboard");
      assert.strictEqual(model.getLineContent(1), "/** */");
    });
  });
  test("autoClosingPairs - doc comments can be turned off", () => {
    usingCursor({
      text: [
        ""
      ],
      languageId: autoClosingLanguageId,
      editorOpts: {
        autoClosingComments: "never"
      }
    }, (editor, model, viewModel) => {
      model.setValue("/*");
      viewModel.setSelections("test", [new Selection(1, 3, 1, 3)]);
      viewModel.type("*", "keyboard");
      assert.strictEqual(model.getLineContent(1), "/**");
    });
  });
  test("issue #72177: multi-character autoclose with conflicting patterns", () => {
    const languageId = "autoClosingModeMultiChar";
    disposables.add(languageService.registerLanguage({ id: languageId }));
    disposables.add(languageConfigurationService.register(languageId, {
      autoClosingPairs: [
        { open: "(", close: ")" },
        { open: "(*", close: "*)" },
        { open: "<@", close: "@>" },
        { open: "<@@", close: "@@>" }
      ]
    }));
    usingCursor({
      text: [
        ""
      ],
      languageId
    }, (editor, model, viewModel) => {
      viewModel.type("(", "keyboard");
      assert.strictEqual(model.getLineContent(1), "()");
      viewModel.type("*", "keyboard");
      assert.strictEqual(model.getLineContent(1), "(**)", `doesn't add entire close when already closed substring is there`);
      model.setValue("(");
      viewModel.setSelections("test", [new Selection(1, 2, 1, 2)]);
      viewModel.type("*", "keyboard");
      assert.strictEqual(model.getLineContent(1), "(**)", `does add entire close if not already there`);
      model.setValue("");
      viewModel.type("<@", "keyboard");
      assert.strictEqual(model.getLineContent(1), "<@@>");
      viewModel.type("@", "keyboard");
      assert.strictEqual(model.getLineContent(1), "<@@@@>", `autocloses when before multi-character closing brace`);
      viewModel.type("(", "keyboard");
      assert.strictEqual(model.getLineContent(1), "<@@()@@>", `autocloses when before multi-character closing brace`);
    });
  });
  test("issue #55314: Do not auto-close when ending with open", () => {
    const languageId = "myElectricMode";
    disposables.add(languageService.registerLanguage({ id: languageId }));
    disposables.add(languageConfigurationService.register(languageId, {
      autoClosingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: "'", close: "'", notIn: ["string", "comment"] },
        { open: '"', close: '"', notIn: ["string"] },
        { open: 'B"', close: '"', notIn: ["string", "comment"] },
        { open: "`", close: "`", notIn: ["string", "comment"] },
        { open: "/**", close: " */", notIn: ["string"] }
      ]
    }));
    usingCursor({
      text: [
        "little goat",
        "little LAMB",
        "little sheep",
        "Big LAMB"
      ],
      languageId
    }, (editor, model, viewModel) => {
      model.tokenization.forceTokenization(model.getLineCount());
      assertType(editor, model, viewModel, 1, 4, '"', '"', `does not double quote when ending with open`);
      model.tokenization.forceTokenization(model.getLineCount());
      assertType(editor, model, viewModel, 2, 4, '"', '"', `does not double quote when ending with open`);
      model.tokenization.forceTokenization(model.getLineCount());
      assertType(editor, model, viewModel, 3, 4, '"', '"', `does not double quote when ending with open`);
      model.tokenization.forceTokenization(model.getLineCount());
      assertType(editor, model, viewModel, 4, 2, '"', '"', `does not double quote when ending with open`);
      model.tokenization.forceTokenization(model.getLineCount());
      assertType(editor, model, viewModel, 4, 3, '"', '"', `does not double quote when ending with open`);
    });
  });
  test("issue #27937: Trying to add an item to the front of a list is cumbersome", () => {
    usingCursor({
      text: [
        'var arr = ["b", "c"];'
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      assertType(editor, model, viewModel, 1, 12, '"', '"', `does not over type and will not auto close`);
    });
  });
  test("issue #25658 - Do not auto-close single/double quotes after word characters", () => {
    usingCursor({
      text: [
        ""
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      function typeCharacters(viewModel2, chars) {
        for (let i = 0, len = chars.length; i < len; i++) {
          viewModel2.type(chars[i], "keyboard");
        }
      }
      model.tokenization.forceTokenization(model.getLineCount());
      typeCharacters(viewModel, "teste1 = teste' ok");
      assert.strictEqual(model.getLineContent(1), "teste1 = teste' ok");
      viewModel.setSelections("test", [new Selection(1, 1e3, 1, 1e3)]);
      typeCharacters(viewModel, "\n");
      model.tokenization.forceTokenization(model.getLineCount());
      typeCharacters(viewModel, "teste2 = teste 'ok");
      assert.strictEqual(model.getLineContent(2), "teste2 = teste 'ok'");
      viewModel.setSelections("test", [new Selection(2, 1e3, 2, 1e3)]);
      typeCharacters(viewModel, "\n");
      model.tokenization.forceTokenization(model.getLineCount());
      typeCharacters(viewModel, 'teste3 = teste" ok');
      assert.strictEqual(model.getLineContent(3), 'teste3 = teste" ok');
      viewModel.setSelections("test", [new Selection(3, 1e3, 3, 1e3)]);
      typeCharacters(viewModel, "\n");
      model.tokenization.forceTokenization(model.getLineCount());
      typeCharacters(viewModel, 'teste4 = teste "ok');
      assert.strictEqual(model.getLineContent(4), 'teste4 = teste "ok"');
      viewModel.setSelections("test", [new Selection(4, 1e3, 4, 1e3)]);
      typeCharacters(viewModel, "\n");
      model.tokenization.forceTokenization(model.getLineCount());
      typeCharacters(viewModel, "teste '");
      assert.strictEqual(model.getLineContent(5), "teste ''");
      viewModel.setSelections("test", [new Selection(5, 1e3, 5, 1e3)]);
      typeCharacters(viewModel, "\n");
      model.tokenization.forceTokenization(model.getLineCount());
      typeCharacters(viewModel, 'teste "');
      assert.strictEqual(model.getLineContent(6), 'teste ""');
      viewModel.setSelections("test", [new Selection(6, 1e3, 6, 1e3)]);
      typeCharacters(viewModel, "\n");
      model.tokenization.forceTokenization(model.getLineCount());
      typeCharacters(viewModel, "teste'");
      assert.strictEqual(model.getLineContent(7), "teste'");
      viewModel.setSelections("test", [new Selection(7, 1e3, 7, 1e3)]);
      typeCharacters(viewModel, "\n");
      model.tokenization.forceTokenization(model.getLineCount());
      typeCharacters(viewModel, 'teste"');
      assert.strictEqual(model.getLineContent(8), 'teste"');
    });
  });
  test("issue #37315 - overtypes only those characters that it inserted", () => {
    usingCursor({
      text: [
        "",
        "y=();"
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      assertCursor(viewModel, new Position(1, 1));
      viewModel.type("x=(", "keyboard");
      assert.strictEqual(model.getLineContent(1), "x=()");
      viewModel.type("asd", "keyboard");
      assert.strictEqual(model.getLineContent(1), "x=(asd)");
      viewModel.type(")", "keyboard");
      assert.strictEqual(model.getLineContent(1), "x=(asd)");
      viewModel.setSelections("test", [new Selection(2, 4, 2, 4)]);
      viewModel.type(")", "keyboard");
      assert.strictEqual(model.getLineContent(2), "y=());");
    });
  });
  test("issue #37315 - stops overtyping once cursor leaves area", () => {
    usingCursor({
      text: [
        "",
        "y=();"
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      assertCursor(viewModel, new Position(1, 1));
      viewModel.type("x=(", "keyboard");
      assert.strictEqual(model.getLineContent(1), "x=()");
      viewModel.setSelections("test", [new Selection(1, 5, 1, 5)]);
      viewModel.type(")", "keyboard");
      assert.strictEqual(model.getLineContent(1), "x=())");
    });
  });
  test("issue #37315 - it overtypes only once", () => {
    usingCursor({
      text: [
        "",
        "y=();"
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      assertCursor(viewModel, new Position(1, 1));
      viewModel.type("x=(", "keyboard");
      assert.strictEqual(model.getLineContent(1), "x=()");
      viewModel.type(")", "keyboard");
      assert.strictEqual(model.getLineContent(1), "x=()");
      viewModel.setSelections("test", [new Selection(1, 4, 1, 4)]);
      viewModel.type(")", "keyboard");
      assert.strictEqual(model.getLineContent(1), "x=())");
    });
  });
  test("issue #37315 - it can remember multiple auto-closed instances", () => {
    usingCursor({
      text: [
        "",
        "y=();"
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      assertCursor(viewModel, new Position(1, 1));
      viewModel.type("x=(", "keyboard");
      assert.strictEqual(model.getLineContent(1), "x=()");
      viewModel.type("(", "keyboard");
      assert.strictEqual(model.getLineContent(1), "x=(())");
      viewModel.type(")", "keyboard");
      assert.strictEqual(model.getLineContent(1), "x=(())");
      viewModel.type(")", "keyboard");
      assert.strictEqual(model.getLineContent(1), "x=(())");
    });
  });
  test("issue #118270 - auto closing deletes only those characters that it inserted", () => {
    usingCursor({
      text: [
        "",
        "y=();"
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      assertCursor(viewModel, new Position(1, 1));
      viewModel.type("x=(", "keyboard");
      assert.strictEqual(model.getLineContent(1), "x=()");
      viewModel.type("asd", "keyboard");
      assert.strictEqual(model.getLineContent(1), "x=(asd)");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "x=()");
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "x=");
      viewModel.setSelections("test", [new Selection(2, 4, 2, 4)]);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "y=);");
    });
  });
  test("issue #78527 - does not close quote on odd count", () => {
    usingCursor({
      text: [
        `std::cout << '"' << entryMap`
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 29, 1, 29)]);
      viewModel.type("[", "keyboard");
      assert.strictEqual(model.getLineContent(1), `std::cout << '"' << entryMap[]`);
      viewModel.type('"', "keyboard");
      assert.strictEqual(model.getLineContent(1), `std::cout << '"' << entryMap[""]`);
      viewModel.type("a", "keyboard");
      assert.strictEqual(model.getLineContent(1), `std::cout << '"' << entryMap["a"]`);
      viewModel.type('"', "keyboard");
      assert.strictEqual(model.getLineContent(1), `std::cout << '"' << entryMap["a"]`);
      viewModel.type("]", "keyboard");
      assert.strictEqual(model.getLineContent(1), `std::cout << '"' << entryMap["a"]`);
    });
  });
  test("issue #85983 - editor.autoClosingBrackets: beforeWhitespace is incorrect for Python", () => {
    const languageId = "pythonMode";
    disposables.add(languageService.registerLanguage({ id: languageId }));
    disposables.add(languageConfigurationService.register(languageId, {
      autoClosingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: '"', close: '"', notIn: ["string"] },
        { open: 'r"', close: '"', notIn: ["string", "comment"] },
        { open: 'R"', close: '"', notIn: ["string", "comment"] },
        { open: 'u"', close: '"', notIn: ["string", "comment"] },
        { open: 'U"', close: '"', notIn: ["string", "comment"] },
        { open: 'f"', close: '"', notIn: ["string", "comment"] },
        { open: 'F"', close: '"', notIn: ["string", "comment"] },
        { open: 'b"', close: '"', notIn: ["string", "comment"] },
        { open: 'B"', close: '"', notIn: ["string", "comment"] },
        { open: "'", close: "'", notIn: ["string", "comment"] },
        { open: "r'", close: "'", notIn: ["string", "comment"] },
        { open: "R'", close: "'", notIn: ["string", "comment"] },
        { open: "u'", close: "'", notIn: ["string", "comment"] },
        { open: "U'", close: "'", notIn: ["string", "comment"] },
        { open: "f'", close: "'", notIn: ["string", "comment"] },
        { open: "F'", close: "'", notIn: ["string", "comment"] },
        { open: "b'", close: "'", notIn: ["string", "comment"] },
        { open: "B'", close: "'", notIn: ["string", "comment"] },
        { open: "`", close: "`", notIn: ["string"] }
      ]
    }));
    usingCursor({
      text: [
        "foo'hello'"
      ],
      editorOpts: {
        autoClosingBrackets: "beforeWhitespace"
      },
      languageId
    }, (editor, model, viewModel) => {
      assertType(editor, model, viewModel, 1, 4, "(", "(", `does not auto close @ (1, 4)`);
    });
  });
  test("issue #78975 - Parentheses swallowing does not work when parentheses are inserted by autocomplete", () => {
    usingCursor({
      text: [
        "<div id"
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 8, 1, 8)]);
      viewModel.executeEdits("snippet", [{ range: new Range(1, 6, 1, 8), text: 'id=""' }], () => [new Selection(1, 10, 1, 10)]);
      assert.strictEqual(model.getLineContent(1), '<div id=""');
      viewModel.type("a", "keyboard");
      assert.strictEqual(model.getLineContent(1), '<div id="a"');
      viewModel.type('"', "keyboard");
      assert.strictEqual(model.getLineContent(1), '<div id="a"');
    });
  });
  test("issue #78833 - Add config to use old brackets/quotes overtyping", () => {
    usingCursor({
      text: [
        "",
        "y=();"
      ],
      languageId: autoClosingLanguageId,
      editorOpts: {
        autoClosingOvertype: "always"
      }
    }, (editor, model, viewModel) => {
      assertCursor(viewModel, new Position(1, 1));
      viewModel.type("x=(", "keyboard");
      assert.strictEqual(model.getLineContent(1), "x=()");
      viewModel.type(")", "keyboard");
      assert.strictEqual(model.getLineContent(1), "x=()");
      viewModel.setSelections("test", [new Selection(1, 4, 1, 4)]);
      viewModel.type(")", "keyboard");
      assert.strictEqual(model.getLineContent(1), "x=()");
      viewModel.setSelections("test", [new Selection(2, 4, 2, 4)]);
      viewModel.type(")", "keyboard");
      assert.strictEqual(model.getLineContent(2), "y=();");
    });
  });
  test("issue #15825: accents on mac US intl keyboard", () => {
    usingCursor({
      text: [],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      assertCursor(viewModel, new Position(1, 1));
      viewModel.startComposition();
      viewModel.type("`", "keyboard");
      viewModel.compositionType("\xE8", 1, 0, 0, "keyboard");
      viewModel.endComposition("keyboard");
      assert.strictEqual(model.getValue(), "\xE8");
    });
  });
  test("issue #90016: allow accents on mac US intl keyboard to surround selection", () => {
    usingCursor({
      text: [
        "test"
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 1, 1, 5)]);
      viewModel.startComposition();
      viewModel.type("'", "keyboard");
      viewModel.compositionType("'", 1, 0, 0, "keyboard");
      viewModel.compositionType("'", 1, 0, 0, "keyboard");
      viewModel.endComposition("keyboard");
      assert.strictEqual(model.getValue(), "'test'");
    });
  });
  test("issue #53357: Over typing ignores characters after backslash", () => {
    usingCursor({
      text: [
        "console.log();"
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 13, 1, 13)]);
      viewModel.type("'", "keyboard");
      assert.strictEqual(model.getValue(), "console.log('');");
      viewModel.type("it", "keyboard");
      assert.strictEqual(model.getValue(), "console.log('it');");
      viewModel.type("\\", "keyboard");
      assert.strictEqual(model.getValue(), "console.log('it\\');");
      viewModel.type("'", "keyboard");
      assert.strictEqual(model.getValue(), "console.log('it\\'');");
    });
  });
  test("issue #84998: Overtyping Brackets doesn't work after backslash", () => {
    usingCursor({
      text: [
        ""
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 1, 1, 1)]);
      viewModel.type("\\", "keyboard");
      assert.strictEqual(model.getValue(), "\\");
      viewModel.type("(", "keyboard");
      assert.strictEqual(model.getValue(), "\\()");
      viewModel.type("abc", "keyboard");
      assert.strictEqual(model.getValue(), "\\(abc)");
      viewModel.type("\\", "keyboard");
      assert.strictEqual(model.getValue(), "\\(abc\\)");
      viewModel.type(")", "keyboard");
      assert.strictEqual(model.getValue(), "\\(abc\\)");
    });
  });
  test("issue #2773: Accents (\xB4`\xA8^, others?) are inserted in the wrong position (Mac)", () => {
    usingCursor({
      text: [
        "hello",
        "world"
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      assertCursor(viewModel, new Position(1, 1));
      viewModel.startComposition();
      viewModel.type("`", "keyboard");
      moveDown(editor, viewModel, true);
      viewModel.compositionType("`", 1, 0, 0, "keyboard");
      viewModel.compositionType("`", 1, 0, 0, "keyboard");
      viewModel.endComposition("keyboard");
      assert.strictEqual(model.getValue(), "`hello\nworld");
      assertCursor(viewModel, new Selection(1, 2, 2, 2));
    });
  });
  test("issue #26820: auto close quotes when not used as accents", () => {
    usingCursor({
      text: [
        ""
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      assertCursor(viewModel, new Position(1, 1));
      viewModel.startComposition();
      viewModel.type("'", "keyboard");
      viewModel.compositionType("'", 1, 0, 0, "keyboard");
      viewModel.endComposition("keyboard");
      assert.strictEqual(model.getValue(), "''");
      viewModel.startComposition();
      viewModel.type("'", "keyboard");
      viewModel.compositionType("'", 1, 0, 0, "keyboard");
      viewModel.endComposition("keyboard");
      assert.strictEqual(model.getValue(), "''");
      model.setValue("'abc");
      viewModel.setSelections("test", [new Selection(1, 5, 1, 5)]);
      viewModel.startComposition();
      viewModel.type("'", "keyboard");
      viewModel.compositionType("'", 1, 0, 0, "keyboard");
      viewModel.endComposition("keyboard");
      assert.strictEqual(model.getValue(), "'abc'");
      model.setValue("'abc'def ");
      viewModel.setSelections("test", [new Selection(1, 10, 1, 10)]);
      viewModel.startComposition();
      viewModel.type("'", "keyboard");
      viewModel.compositionType("'", 1, 0, 0, "keyboard");
      viewModel.endComposition("keyboard");
      assert.strictEqual(model.getValue(), "'abc'def ''");
      model.setValue("abc");
      viewModel.setSelections("test", [new Selection(1, 1, 1, 1)]);
      viewModel.startComposition();
      viewModel.type("'", "keyboard");
      viewModel.compositionType("'", 1, 0, 0, "keyboard");
      viewModel.endComposition("keyboard");
      model.setValue("abc");
      viewModel.setSelections("test", [new Selection(1, 4, 1, 4)]);
      viewModel.startComposition();
      viewModel.type("'", "keyboard");
      viewModel.compositionType("'", 1, 0, 0, "keyboard");
      viewModel.endComposition("keyboard");
      assert.strictEqual(model.getValue(), "abc'");
    });
  });
  test("issue #144690: Quotes do not overtype when using US Intl PC keyboard layout", () => {
    usingCursor({
      text: [
        ""
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      assertCursor(viewModel, new Position(1, 1));
      viewModel.startComposition();
      viewModel.type(`'`, "keyboard");
      viewModel.compositionType(`'`, 1, 0, 0, "keyboard");
      viewModel.compositionType(`'`, 1, 0, 0, "keyboard");
      viewModel.endComposition("keyboard");
      viewModel.startComposition();
      viewModel.type(`'`, "keyboard");
      viewModel.compositionType(`';`, 1, 0, 0, "keyboard");
      viewModel.compositionType(`';`, 2, 0, 0, "keyboard");
      viewModel.endComposition("keyboard");
      assert.strictEqual(model.getValue(), `'';`);
    });
  });
  test("issue #144693: Typing a quote using US Intl PC keyboard layout always surrounds words", () => {
    usingCursor({
      text: [
        "const hello = 3;"
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 7, 1, 12)]);
      viewModel.startComposition();
      viewModel.type(`'`, "keyboard");
      viewModel.compositionType(`\xE9`, 1, 0, 0, "keyboard");
      viewModel.compositionType(`\xE9`, 1, 0, 0, "keyboard");
      viewModel.endComposition("keyboard");
      assert.strictEqual(model.getValue(), `const \xE9 = 3;`);
    });
  });
  test("issue #82701: auto close does not execute when IME is canceled via backspace", () => {
    usingCursor({
      text: [
        "{}"
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 2, 1, 2)]);
      viewModel.startComposition();
      viewModel.type("a", "keyboard");
      viewModel.compositionType("", 1, 0, 0, "keyboard");
      viewModel.endComposition("keyboard");
      assert.strictEqual(model.getValue(), "{}");
    });
  });
  test("issue #20891: All cursors should do the same thing", () => {
    usingCursor({
      text: [
        "var a = asd"
      ],
      languageId: autoClosingLanguageId
    }, (editor, model, viewModel) => {
      viewModel.setSelections("test", [
        new Selection(1, 9, 1, 9),
        new Selection(1, 12, 1, 12)
      ]);
      viewModel.type("`", "keyboard");
      assert.strictEqual(model.getValue(), "var a = `asd`");
    });
  });
  test("issue #41825: Special handling of quotes in surrounding pairs", () => {
    const languageId = "myMode";
    disposables.add(languageService.registerLanguage({ id: languageId }));
    disposables.add(languageConfigurationService.register(languageId, {
      surroundingPairs: [
        { open: '"', close: '"' },
        { open: "'", close: "'" }
      ]
    }));
    const model = createTextModel2("var x = 'hi';", languageId);
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      editor.setSelections([
        new Selection(1, 9, 1, 10),
        new Selection(1, 12, 1, 13)
      ]);
      viewModel.type('"', "keyboard");
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), 'var x = "hi";', "assert1");
      editor.setSelections([
        new Selection(1, 9, 1, 10),
        new Selection(1, 12, 1, 13)
      ]);
      viewModel.type("'", "keyboard");
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "var x = 'hi';", "assert2");
    });
  });
  test("All cursors should do the same thing when deleting left", () => {
    const model = createTextModel2(
      [
        "var a = ()"
      ].join("\n"),
      autoClosingLanguageId
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      viewModel.setSelections("test", [
        new Selection(1, 4, 1, 4),
        new Selection(1, 10, 1, 10)
      ]);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(), "va a = )");
    });
  });
  test("issue #7100: Mouse word selection is strange when non-word character is at the end of line", () => {
    const model = createTextModel2(
      [
        "before.a",
        "before",
        "hello:",
        "there:",
        "this is strange:",
        "here",
        "it",
        "is"
      ].join("\n")
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      CoreNavigationCommands.WordSelect.runEditorCommand(null, editor, {
        position: new Position(3, 7)
      });
      assertCursor(viewModel, new Selection(3, 7, 3, 7));
      CoreNavigationCommands.WordSelectDrag.runEditorCommand(null, editor, {
        position: new Position(4, 7)
      });
      assertCursor(viewModel, new Selection(3, 7, 4, 7));
    });
  });
  test("issue #112039: shift-continuing a double/triple-click and drag selection does not remember its starting mode", () => {
    const model = createTextModel2(
      [
        "just some text",
        "and another line",
        "and another one"
      ].join("\n")
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      CoreNavigationCommands.WordSelect.runEditorCommand(null, editor, {
        position: new Position(2, 6)
      });
      CoreNavigationCommands.MoveToSelect.runEditorCommand(null, editor, {
        position: new Position(1, 8)
      });
      assertCursor(viewModel, new Selection(2, 12, 1, 6));
    });
  });
  test("issue #158236: Shift click selection does not work on line number indicator", () => {
    const model = createTextModel2(
      [
        "just some text",
        "and another line",
        "and another one"
      ].join("\n")
    );
    withTestCodeEditor2(model, {}, (editor, viewModel) => {
      CoreNavigationCommands.MoveTo.runEditorCommand(null, editor, {
        position: new Position(3, 5)
      });
      CoreNavigationCommands.LineSelectDrag.runEditorCommand(null, editor, {
        position: new Position(2, 1)
      });
      assertCursor(viewModel, new Selection(3, 5, 2, 1));
    });
  });
  test("issue #111513: Text gets automatically selected when typing at the same location in another editor", () => {
    const model = createTextModel2(
      [
        "just",
        "",
        "some text"
      ].join("\n")
    );
    withTestCodeEditor2(model, {}, (editor1, viewModel1) => {
      editor1.setSelections([
        new Selection(2, 1, 2, 1)
      ]);
      withTestCodeEditor2(model, {}, (editor2, viewModel2) => {
        editor2.setSelections([
          new Selection(2, 1, 2, 1)
        ]);
        viewModel2.type("e", "keyboard");
        assertCursor(viewModel2, new Position(2, 2));
        assertCursor(viewModel1, new Position(2, 2));
      });
    });
  });
});
suite("Undo stops", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("there is an undo stop between typing and deleting left", () => {
    const model = createTextModel(
      [
        "A  line",
        "Another line"
      ].join("\n")
    );
    withTestCodeEditor(model, {}, (editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 3, 1, 3)]);
      viewModel.type("first", "keyboard");
      assert.strictEqual(model.getLineContent(1), "A first line");
      assertCursor(viewModel, new Selection(1, 8, 1, 8));
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "A fir line");
      assertCursor(viewModel, new Selection(1, 6, 1, 6));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "A first line");
      assertCursor(viewModel, new Selection(1, 8, 1, 8));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "A  line");
      assertCursor(viewModel, new Selection(1, 3, 1, 3));
    });
    model.dispose();
  });
  test("there is an undo stop between typing and deleting right", () => {
    const model = createTextModel(
      [
        "A  line",
        "Another line"
      ].join("\n")
    );
    withTestCodeEditor(model, {}, (editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 3, 1, 3)]);
      viewModel.type("first", "keyboard");
      assert.strictEqual(model.getLineContent(1), "A first line");
      assertCursor(viewModel, new Selection(1, 8, 1, 8));
      CoreEditingCommands.DeleteRight.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteRight.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "A firstine");
      assertCursor(viewModel, new Selection(1, 8, 1, 8));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "A first line");
      assertCursor(viewModel, new Selection(1, 8, 1, 8));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "A  line");
      assertCursor(viewModel, new Selection(1, 3, 1, 3));
    });
    model.dispose();
  });
  test("there is an undo stop between deleting left and typing", () => {
    const model = createTextModel(
      [
        "A  line",
        "Another line"
      ].join("\n")
    );
    withTestCodeEditor(model, {}, (editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(2, 8, 2, 8)]);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), " line");
      assertCursor(viewModel, new Selection(2, 1, 2, 1));
      viewModel.type("Second", "keyboard");
      assert.strictEqual(model.getLineContent(2), "Second line");
      assertCursor(viewModel, new Selection(2, 7, 2, 7));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), " line");
      assertCursor(viewModel, new Selection(2, 1, 2, 1));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "Another line");
      assertCursor(viewModel, new Selection(2, 8, 2, 8));
    });
    model.dispose();
  });
  test("there is an undo stop between deleting left and deleting right", () => {
    const model = createTextModel(
      [
        "A  line",
        "Another line"
      ].join("\n")
    );
    withTestCodeEditor(model, {}, (editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(2, 8, 2, 8)]);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), " line");
      assertCursor(viewModel, new Selection(2, 1, 2, 1));
      CoreEditingCommands.DeleteRight.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteRight.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteRight.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteRight.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteRight.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "");
      assertCursor(viewModel, new Selection(2, 1, 2, 1));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), " line");
      assertCursor(viewModel, new Selection(2, 1, 2, 1));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "Another line");
      assertCursor(viewModel, new Selection(2, 8, 2, 8));
    });
    model.dispose();
  });
  test("there is an undo stop between deleting right and typing", () => {
    const model = createTextModel(
      [
        "A  line",
        "Another line"
      ].join("\n")
    );
    withTestCodeEditor(model, {}, (editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(2, 9, 2, 9)]);
      CoreEditingCommands.DeleteRight.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteRight.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteRight.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteRight.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "Another ");
      assertCursor(viewModel, new Selection(2, 9, 2, 9));
      viewModel.type("text", "keyboard");
      assert.strictEqual(model.getLineContent(2), "Another text");
      assertCursor(viewModel, new Selection(2, 13, 2, 13));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "Another ");
      assertCursor(viewModel, new Selection(2, 9, 2, 9));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "Another line");
      assertCursor(viewModel, new Selection(2, 9, 2, 9));
    });
    model.dispose();
  });
  test("there is an undo stop between deleting right and deleting left", () => {
    const model = createTextModel(
      [
        "A  line",
        "Another line"
      ].join("\n")
    );
    withTestCodeEditor(model, {}, (editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(2, 9, 2, 9)]);
      CoreEditingCommands.DeleteRight.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteRight.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteRight.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteRight.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "Another ");
      assertCursor(viewModel, new Selection(2, 9, 2, 9));
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "An");
      assertCursor(viewModel, new Selection(2, 3, 2, 3));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "Another ");
      assertCursor(viewModel, new Selection(2, 9, 2, 9));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(2), "Another line");
      assertCursor(viewModel, new Selection(2, 9, 2, 9));
    });
    model.dispose();
  });
  test("inserts undo stop when typing space", () => {
    const model = createTextModel(
      [
        "A  line",
        "Another line"
      ].join("\n")
    );
    withTestCodeEditor(model, {}, (editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 3, 1, 3)]);
      viewModel.type("first and interesting", "keyboard");
      assert.strictEqual(model.getLineContent(1), "A first and interesting line");
      assertCursor(viewModel, new Selection(1, 24, 1, 24));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "A first and line");
      assertCursor(viewModel, new Selection(1, 12, 1, 12));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "A first line");
      assertCursor(viewModel, new Selection(1, 8, 1, 8));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getLineContent(1), "A  line");
      assertCursor(viewModel, new Selection(1, 3, 1, 3));
    });
    model.dispose();
  });
  test("can undo typing and EOL change in one undo stop", () => {
    const model = createTextModel(
      [
        "A  line",
        "Another line"
      ].join("\n")
    );
    withTestCodeEditor(model, {}, (editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 3, 1, 3)]);
      viewModel.type("first", "keyboard");
      assert.strictEqual(model.getValue(), "A first line\nAnother line");
      assertCursor(viewModel, new Selection(1, 8, 1, 8));
      model.pushEOL(EndOfLineSequence.CRLF);
      assert.strictEqual(model.getValue(), "A first line\r\nAnother line");
      assertCursor(viewModel, new Selection(1, 8, 1, 8));
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(), "A  line\nAnother line");
      assertCursor(viewModel, new Selection(1, 3, 1, 3));
    });
    model.dispose();
  });
  test("issue #93585: Undo multi cursor edit corrupts document", () => {
    const model = createTextModel(
      [
        "hello world",
        "hello world"
      ].join("\n")
    );
    withTestCodeEditor(model, {}, (editor, viewModel) => {
      viewModel.setSelections("test", [
        new Selection(2, 7, 2, 12),
        new Selection(1, 7, 1, 12)
      ]);
      viewModel.type("no", "keyboard");
      assert.strictEqual(model.getValue(), "hello no\nhello no");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(), "hello world\nhello world");
    });
    model.dispose();
  });
  test("there is a single undo stop for consecutive whitespaces", () => {
    const model = createTextModel(
      [
        ""
      ].join("\n"),
      void 0,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor(model, {}, (editor, viewModel) => {
      viewModel.type("a", "keyboard");
      viewModel.type("b", "keyboard");
      viewModel.type(" ", "keyboard");
      viewModel.type(" ", "keyboard");
      viewModel.type("c", "keyboard");
      viewModel.type("d", "keyboard");
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "ab  cd", "assert1");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "ab  ", "assert2");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "ab", "assert3");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "", "assert4");
    });
    model.dispose();
  });
  test("there is no undo stop after a single whitespace", () => {
    const model = createTextModel(
      [
        ""
      ].join("\n"),
      void 0,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor(model, {}, (editor, viewModel) => {
      viewModel.type("a", "keyboard");
      viewModel.type("b", "keyboard");
      viewModel.type(" ", "keyboard");
      viewModel.type("c", "keyboard");
      viewModel.type("d", "keyboard");
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "ab cd", "assert1");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "ab", "assert3");
      CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), "", "assert4");
    });
    model.dispose();
  });
});
suite("Overtype Mode", () => {
  setup(() => {
    InputMode.setInputMode("overtype");
  });
  teardown(() => {
    InputMode.setInputMode("insert");
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("simple type", () => {
    const model = createTextModel(
      [
        "123456789",
        "123456789"
      ].join("\n"),
      void 0,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor(model, {}, (editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 3, 1, 3)]);
      viewModel.type("a", "keyboard");
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), [
        "12a456789",
        "123456789"
      ].join("\n"), "assert1");
      viewModel.setSelections("test", [new Selection(1, 9, 1, 9)]);
      viewModel.type("bbb", "keyboard");
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), [
        "12a45678bbb",
        "123456789"
      ].join("\n"), "assert2");
    });
    model.dispose();
  });
  test("multi-line selection type", () => {
    const model = createTextModel(
      [
        "123456789",
        "123456789"
      ].join("\n"),
      void 0,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor(model, {}, (editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 5, 2, 3)]);
      viewModel.type("cc", "keyboard");
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), [
        "1234cc456789"
      ].join("\n"), "assert1");
    });
    model.dispose();
  });
  test("simple paste", () => {
    const model = createTextModel(
      [
        "123456789",
        "123456789"
      ].join("\n"),
      void 0,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor(model, {}, (editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 5, 1, 5)]);
      viewModel.paste("cc", false);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), [
        "1234cc789",
        "123456789"
      ].join("\n"), "assert1");
      viewModel.setSelections("test", [new Selection(1, 5, 1, 5)]);
      viewModel.paste("dddddddd", false);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), [
        "1234dddddddd",
        "123456789"
      ].join("\n"), "assert2");
    });
    model.dispose();
  });
  test("multi-line selection paste", () => {
    const model = createTextModel(
      [
        "123456789",
        "123456789"
      ].join("\n"),
      void 0,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor(model, {}, (editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 5, 2, 3)]);
      viewModel.paste("cc", false);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), [
        "1234cc456789"
      ].join("\n"), "assert1");
    });
    model.dispose();
  });
  test("paste multi-line text", () => {
    const model = createTextModel(
      [
        "123456789",
        "123456789"
      ].join("\n"),
      void 0,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor(model, {}, (editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 5, 1, 5)]);
      viewModel.paste([
        "aaaaaaa",
        "bbbbbbb"
      ].join("\n"), false);
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), [
        "1234aaaaaaa",
        "bbbbbbb",
        "123456789"
      ].join("\n"), "assert1");
    });
    model.dispose();
  });
  test("composition type", () => {
    const model = createTextModel(
      [
        "123456789",
        "123456789"
      ].join("\n"),
      void 0,
      {
        insertSpaces: false
      }
    );
    withTestCodeEditor(model, {}, (editor, viewModel) => {
      viewModel.setSelections("test", [new Selection(1, 5, 1, 5)]);
      viewModel.startComposition();
      viewModel.compositionType("\u30BB", 0, 0, 0, "keyboard");
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), [
        "1234\u30BB56789",
        "123456789"
      ].join("\n"), "assert1");
      viewModel.endComposition("keyboard");
      assert.strictEqual(model.getValue(EndOfLinePreference.LF), [
        "1234\u30BB6789",
        "123456789"
      ].join("\n"), "assert1");
    });
    model.dispose();
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9icm93c2VyL2NvbnRyb2xsZXIvY3Vyc29yLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgQ29yZUVkaXRpbmdDb21tYW5kcywgQ29yZU5hdmlnYXRpb25Db21tYW5kcyB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvY29yZUNvbW1hbmRzLmpzJztcbmltcG9ydCB7IElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IEVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9lZGl0T3BlcmF0aW9uLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUN1cnNvclBvc2l0aW9uQ2hhbmdlZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2N1cnNvckV2ZW50cy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZCwgSUN1cnNvclN0YXRlQ29tcHV0ZXJEYXRhLCBJRWRpdE9wZXJhdGlvbkJ1aWxkZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IE1ldGFkYXRhQ29uc3RzLCBTdGFuZGFyZFRva2VuVHlwZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lbmNvZGVkVG9rZW5BdHRyaWJ1dGVzLmpzJztcbmltcG9ydCB7IEVuY29kZWRUb2tlbml6YXRpb25SZXN1bHQsIElTdGF0ZSwgSVRva2VuaXphdGlvblN1cHBvcnQsIFRva2VuaXphdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJbmRlbnRBY3Rpb24sIEluZGVudGF0aW9uUnVsZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBOdWxsU3RhdGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL251bGxUb2tlbml6ZS5qcyc7XG5pbXBvcnQgeyBFbmRPZkxpbmVQcmVmZXJlbmNlLCBFbmRPZkxpbmVTZXF1ZW5jZSwgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IFZpZXdNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3TW9kZWwvdmlld01vZGVsSW1wbC5qcyc7XG5pbXBvcnQgeyBPdXRnb2luZ1ZpZXdNb2RlbEV2ZW50S2luZCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3TW9kZWxFdmVudERpc3BhdGNoZXIuanMnO1xuaW1wb3J0IHsgSVRlc3RDb2RlRWRpdG9yLCBUZXN0Q29kZUVkaXRvckluc3RhbnRpYXRpb25PcHRpb25zLCBjcmVhdGVDb2RlRWRpdG9yU2VydmljZXMsIGluc3RhbnRpYXRlVGVzdENvZGVFZGl0b3IsIHdpdGhUZXN0Q29kZUVkaXRvciB9IGZyb20gJy4uL3Rlc3RDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IElSZWxheGVkVGV4dE1vZGVsQ3JlYXRpb25PcHRpb25zLCBjcmVhdGVUZXh0TW9kZWwsIGluc3RhbnRpYXRlVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL3Rlc3RUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuaW1wb3J0IHsgSW5wdXRNb2RlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2lucHV0TW9kZS5qcyc7XG5cbi8vIC0tLS0tLS0tLSB1dGlsc1xuXG5mdW5jdGlvbiBtb3ZlVG8oZWRpdG9yOiBJVGVzdENvZGVFZGl0b3IsIHZpZXdNb2RlbDogVmlld01vZGVsLCBsaW5lTnVtYmVyOiBudW1iZXIsIGNvbHVtbjogbnVtYmVyLCBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4gPSBmYWxzZSkge1xuXHRpZiAoaW5TZWxlY3Rpb25Nb2RlKSB7XG5cdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5Nb3ZlVG9TZWxlY3QucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7XG5cdFx0XHRwb3NpdGlvbjogbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIGNvbHVtbilcblx0XHR9KTtcblx0fSBlbHNlIHtcblx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLk1vdmVUby5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHtcblx0XHRcdHBvc2l0aW9uOiBuZXcgUG9zaXRpb24obGluZU51bWJlciwgY29sdW1uKVxuXHRcdH0pO1xuXHR9XG59XG5cbmZ1bmN0aW9uIG1vdmVMZWZ0KGVkaXRvcjogSVRlc3RDb2RlRWRpdG9yLCB2aWV3TW9kZWw6IFZpZXdNb2RlbCwgaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuID0gZmFsc2UpIHtcblx0aWYgKGluU2VsZWN0aW9uTW9kZSkge1xuXHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yTGVmdFNlbGVjdC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0fSBlbHNlIHtcblx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckxlZnQucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gbW92ZVJpZ2h0KGVkaXRvcjogSVRlc3RDb2RlRWRpdG9yLCB2aWV3TW9kZWw6IFZpZXdNb2RlbCwgaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuID0gZmFsc2UpIHtcblx0aWYgKGluU2VsZWN0aW9uTW9kZSkge1xuXHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yUmlnaHRTZWxlY3QucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdH0gZWxzZSB7XG5cdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JSaWdodC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0fVxufVxuXG5mdW5jdGlvbiBtb3ZlRG93bihlZGl0b3I6IElUZXN0Q29kZUVkaXRvciwgdmlld01vZGVsOiBWaWV3TW9kZWwsIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbiA9IGZhbHNlKSB7XG5cdGlmIChpblNlbGVjdGlvbk1vZGUpIHtcblx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckRvd25TZWxlY3QucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdH0gZWxzZSB7XG5cdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JEb3duLnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHR9XG59XG5cbmZ1bmN0aW9uIG1vdmVVcChlZGl0b3I6IElUZXN0Q29kZUVkaXRvciwgdmlld01vZGVsOiBWaWV3TW9kZWwsIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbiA9IGZhbHNlKSB7XG5cdGlmIChpblNlbGVjdGlvbk1vZGUpIHtcblx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvclVwU2VsZWN0LnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHR9IGVsc2Uge1xuXHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yVXAucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gbW92ZVRvQmVnaW5uaW5nT2ZMaW5lKGVkaXRvcjogSVRlc3RDb2RlRWRpdG9yLCB2aWV3TW9kZWw6IFZpZXdNb2RlbCwgaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuID0gZmFsc2UpIHtcblx0aWYgKGluU2VsZWN0aW9uTW9kZSkge1xuXHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29ySG9tZVNlbGVjdC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0fSBlbHNlIHtcblx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckhvbWUucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gbW92ZVRvRW5kT2ZMaW5lKGVkaXRvcjogSVRlc3RDb2RlRWRpdG9yLCB2aWV3TW9kZWw6IFZpZXdNb2RlbCwgaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuID0gZmFsc2UpIHtcblx0aWYgKGluU2VsZWN0aW9uTW9kZSkge1xuXHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yRW5kU2VsZWN0LnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHR9IGVsc2Uge1xuXHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yRW5kLnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHR9XG59XG5cbmZ1bmN0aW9uIG1vdmVUb0JlZ2lubmluZ09mQnVmZmVyKGVkaXRvcjogSVRlc3RDb2RlRWRpdG9yLCB2aWV3TW9kZWw6IFZpZXdNb2RlbCwgaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuID0gZmFsc2UpIHtcblx0aWYgKGluU2VsZWN0aW9uTW9kZSkge1xuXHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yVG9wU2VsZWN0LnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHR9IGVsc2Uge1xuXHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yVG9wLnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHR9XG59XG5cbmZ1bmN0aW9uIG1vdmVUb0VuZE9mQnVmZmVyKGVkaXRvcjogSVRlc3RDb2RlRWRpdG9yLCB2aWV3TW9kZWw6IFZpZXdNb2RlbCwgaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuID0gZmFsc2UpIHtcblx0aWYgKGluU2VsZWN0aW9uTW9kZSkge1xuXHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQm90dG9tU2VsZWN0LnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHR9IGVsc2Uge1xuXHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQm90dG9tLnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGFzc2VydEN1cnNvcih2aWV3TW9kZWw6IFZpZXdNb2RlbCwgd2hhdDogUG9zaXRpb24gfCBTZWxlY3Rpb24gfCBTZWxlY3Rpb25bXSk6IHZvaWQge1xuXHRsZXQgc2VsZWN0aW9uczogU2VsZWN0aW9uW107XG5cdGlmICh3aGF0IGluc3RhbmNlb2YgUG9zaXRpb24pIHtcblx0XHRzZWxlY3Rpb25zID0gW25ldyBTZWxlY3Rpb24od2hhdC5saW5lTnVtYmVyLCB3aGF0LmNvbHVtbiwgd2hhdC5saW5lTnVtYmVyLCB3aGF0LmNvbHVtbildO1xuXHR9IGVsc2UgaWYgKHdoYXQgaW5zdGFuY2VvZiBTZWxlY3Rpb24pIHtcblx0XHRzZWxlY3Rpb25zID0gW3doYXRdO1xuXHR9IGVsc2Uge1xuXHRcdHNlbGVjdGlvbnMgPSB3aGF0O1xuXHR9XG5cdGNvbnN0IGFjdHVhbCA9IHZpZXdNb2RlbC5nZXRTZWxlY3Rpb25zKCkubWFwKHMgPT4gcy50b1N0cmluZygpKTtcblx0Y29uc3QgZXhwZWN0ZWQgPSBzZWxlY3Rpb25zLm1hcChzID0+IHMudG9TdHJpbmcoKSk7XG5cblx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcbn1cblxuc3VpdGUoJ0VkaXRvciBDb250cm9sbGVyIC0gQ3Vyc29yJywgKCkgPT4ge1xuXHRjb25zdCBMSU5FMSA9ICcgICAgXFx0TXkgRmlyc3QgTGluZVxcdCAnO1xuXHRjb25zdCBMSU5FMiA9ICdcXHRNeSBTZWNvbmQgTGluZSc7XG5cdGNvbnN0IExJTkUzID0gJyAgICBUaGlyZCBMaW5lXHVEODNEXHVEQzM2Jztcblx0Y29uc3QgTElORTQgPSAnJztcblx0Y29uc3QgTElORTUgPSAnMSc7XG5cblx0Y29uc3QgVEVYVCA9XG5cdFx0TElORTEgKyAnXFxyXFxuJyArXG5cdFx0TElORTIgKyAnXFxuJyArXG5cdFx0TElORTMgKyAnXFxuJyArXG5cdFx0TElORTQgKyAnXFxyXFxuJyArXG5cdFx0TElORTU7XG5cblx0ZnVuY3Rpb24gcnVuVGVzdChjYWxsYmFjazogKGVkaXRvcjogSVRlc3RDb2RlRWRpdG9yLCB2aWV3TW9kZWw6IFZpZXdNb2RlbCkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihURVhULCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRjYWxsYmFjayhlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0fSk7XG5cdH1cblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdjdXJzb3IgaW5pdGlhbGl6ZWQnLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigxLCAxKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdC8vIC0tLS0tLS0tLSBhYnNvbHV0ZSBtb3ZlXG5cblx0dGVzdCgnbm8gbW92ZScsICgpID0+IHtcblx0XHRydW5UZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCAxKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigxLCAxKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUnLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgMik7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMikpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIGluIHNlbGVjdGlvbiBtb2RlJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDIsIHRydWUpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAyKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgYmV5b25kIGxpbmUgZW5kJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDI1KTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigxLCBMSU5FMS5sZW5ndGggKyAxKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgZW1wdHkgbGluZScsICgpID0+IHtcblx0XHRydW5UZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCA0LCAyMCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oNCwgMSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIG9uZSBjaGFyIGxpbmUnLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgNSwgMjApO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDUsIDIpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnc2VsZWN0aW9uIGRvd24nLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMiwgMSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDEsIDIsIDEpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSBhbmQgdGhlbiBzZWxlY3QnLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMiwgMyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMiwgMykpO1xuXG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDIsIDE1LCB0cnVlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMiwgMywgMiwgMTUpKTtcblxuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCAyLCB0cnVlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMiwgMywgMSwgMikpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHQvLyAtLS0tLS0tLS0gbW92ZSBsZWZ0XG5cblx0dGVzdCgnbW92ZSBsZWZ0IG9uIHRvcCBsZWZ0IHBvc2l0aW9uJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlTGVmdChlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIGxlZnQnLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgMyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMykpO1xuXHRcdFx0bW92ZUxlZnQoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDIpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSBsZWZ0IHdpdGggc3Vycm9nYXRlIHBhaXInLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMywgMTcpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDMsIDE3KSk7XG5cdFx0XHRtb3ZlTGVmdChlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMywgMTUpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSBsZWZ0IGdvZXMgdG8gcHJldmlvdXMgcm93JywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDIsIDEpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDIsIDEpKTtcblx0XHRcdG1vdmVMZWZ0KGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigxLCAyMSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIGxlZnQgc2VsZWN0aW9uJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDIsIDEpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDIsIDEpKTtcblx0XHRcdG1vdmVMZWZ0KGVkaXRvciwgdmlld01vZGVsLCB0cnVlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMiwgMSwgMSwgMjEpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0Ly8gLS0tLS0tLS0tIG1vdmUgcmlnaHRcblxuXHR0ZXN0KCdtb3ZlIHJpZ2h0IG9uIGJvdHRvbSByaWdodCBwb3NpdGlvbicsICgpID0+IHtcblx0XHRydW5UZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCA1LCAyKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbig1LCAyKSk7XG5cdFx0XHRtb3ZlUmlnaHQoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDUsIDIpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSByaWdodCcsICgpID0+IHtcblx0XHRydW5UZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCAzKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigxLCAzKSk7XG5cdFx0XHRtb3ZlUmlnaHQoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDQpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSByaWdodCB3aXRoIHN1cnJvZ2F0ZSBwYWlyJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDMsIDE1KTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigzLCAxNSkpO1xuXHRcdFx0bW92ZVJpZ2h0KGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigzLCAxNykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHJpZ2h0IGdvZXMgdG8gbmV4dCByb3cnLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgMjEpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDIxKSk7XG5cdFx0XHRtb3ZlUmlnaHQoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDIsIDEpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSByaWdodCBzZWxlY3Rpb24nLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgMjEpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDIxKSk7XG5cdFx0XHRtb3ZlUmlnaHQoZWRpdG9yLCB2aWV3TW9kZWwsIHRydWUpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCAyMSwgMiwgMSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHQvLyAtLS0tLS0tLS0gbW92ZSBkb3duXG5cblx0dGVzdCgnbW92ZSBkb3duJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlRG93bihlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMiwgMSkpO1xuXHRcdFx0bW92ZURvd24oZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDMsIDEpKTtcblx0XHRcdG1vdmVEb3duKGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbig0LCAxKSk7XG5cdFx0XHRtb3ZlRG93bihlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oNSwgMSkpO1xuXHRcdFx0bW92ZURvd24oZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDUsIDIpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSBkb3duIHdpdGggc2VsZWN0aW9uJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlRG93bihlZGl0b3IsIHZpZXdNb2RlbCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDEsIDIsIDEpKTtcblx0XHRcdG1vdmVEb3duKGVkaXRvciwgdmlld01vZGVsLCB0cnVlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgMSwgMywgMSkpO1xuXHRcdFx0bW92ZURvd24oZWRpdG9yLCB2aWV3TW9kZWwsIHRydWUpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCAxLCA0LCAxKSk7XG5cdFx0XHRtb3ZlRG93bihlZGl0b3IsIHZpZXdNb2RlbCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDEsIDUsIDEpKTtcblx0XHRcdG1vdmVEb3duKGVkaXRvciwgdmlld01vZGVsLCB0cnVlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgMSwgNSwgMikpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIGRvd24gd2l0aCB0YWJzJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDUpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDUpKTtcblx0XHRcdG1vdmVEb3duKGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigyLCAyKSk7XG5cdFx0XHRtb3ZlRG93bihlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMywgNSkpO1xuXHRcdFx0bW92ZURvd24oZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDQsIDEpKTtcblx0XHRcdG1vdmVEb3duKGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbig1LCAyKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdC8vIC0tLS0tLS0tLSBtb3ZlIHVwXG5cblx0dGVzdCgnbW92ZSB1cCcsICgpID0+IHtcblx0XHRydW5UZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCA1KTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigzLCA1KSk7XG5cblx0XHRcdG1vdmVVcChlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMiwgMikpO1xuXG5cdFx0XHRtb3ZlVXAoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDUpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSB1cCB3aXRoIHNlbGVjdGlvbicsICgpID0+IHtcblx0XHRydW5UZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCA1KTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigzLCA1KSk7XG5cblx0XHRcdG1vdmVVcChlZGl0b3IsIHZpZXdNb2RlbCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDMsIDUsIDIsIDIpKTtcblxuXHRcdFx0bW92ZVVwKGVkaXRvciwgdmlld01vZGVsLCB0cnVlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMywgNSwgMSwgNSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHVwIGFuZCBkb3duIHdpdGggdGFicycsICgpID0+IHtcblx0XHRydW5UZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCA1KTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigxLCA1KSk7XG5cdFx0XHRtb3ZlRG93bihlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRtb3ZlRG93bihlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRtb3ZlRG93bihlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRtb3ZlRG93bihlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oNSwgMikpO1xuXHRcdFx0bW92ZVVwKGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbig0LCAxKSk7XG5cdFx0XHRtb3ZlVXAoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDMsIDUpKTtcblx0XHRcdG1vdmVVcChlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMiwgMikpO1xuXHRcdFx0bW92ZVVwKGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigxLCA1KSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgdXAgYW5kIGRvd24gd2l0aCBlbmQgb2YgbGluZXMgc3RhcnRpbmcgZnJvbSBhIGxvbmcgb25lJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG9FbmRPZkxpbmUoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEsIExJTkUxLmxlbmd0aCArIDEpKTtcblx0XHRcdG1vdmVUb0VuZE9mTGluZShlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgTElORTEubGVuZ3RoICsgMSkpO1xuXHRcdFx0bW92ZURvd24oZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDIsIExJTkUyLmxlbmd0aCArIDEpKTtcblx0XHRcdG1vdmVEb3duKGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigzLCBMSU5FMy5sZW5ndGggKyAxKSk7XG5cdFx0XHRtb3ZlRG93bihlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oNCwgTElORTQubGVuZ3RoICsgMSkpO1xuXHRcdFx0bW92ZURvd24oZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDUsIExJTkU1Lmxlbmd0aCArIDEpKTtcblx0XHRcdG1vdmVVcChlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRtb3ZlVXAoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0bW92ZVVwKGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdG1vdmVVcChlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgTElORTEubGVuZ3RoICsgMSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNDQ0NjU6IGN1cnNvciBwb3NpdGlvbiBub3QgY29ycmVjdCB3aGVuIG1vdmUnLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMSwgNSwgMSwgNSldKTtcblx0XHRcdC8vIGdvaW5nIG9uY2UgdXAgb24gdGhlIGZpcnN0IGxpbmUgcmVtZW1iZXJzIHRoZSBvZmZzZXQgdmlzdWFsIGNvbHVtbnNcblx0XHRcdG1vdmVVcChlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXHRcdFx0bW92ZURvd24oZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDIsIDIpKTtcblx0XHRcdG1vdmVVcChlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgNSkpO1xuXG5cdFx0XHQvLyBnb2luZyB0d2ljZSB1cCBvbiB0aGUgZmlyc3QgbGluZSBkaXNjYXJkcyB0aGUgb2Zmc2V0IHZpc3VhbCBjb2x1bW5zXG5cdFx0XHRtb3ZlVXAoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDEpKTtcblx0XHRcdG1vdmVVcChlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXHRcdFx0bW92ZURvd24oZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDIsIDEpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE0NDA0MTogQ3Vyc29yIHVwL2Rvd24gd29ya3MnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCdXb3JkMSBXb3JkMiBXb3JkMyBXb3JkNCcsXG5cdFx0XHRcdCdXb3JkNSBXb3JkNiBXb3JkNyBXb3JkOCcsXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyB3cmFwcGluZ0luZGVudDogJ2luZGVudCcsIHdvcmRXcmFwOiAnd29yZFdyYXBDb2x1bW4nLCB3b3JkV3JhcENvbHVtbjogMjAgfSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpXSk7XG5cblx0XHRcdGNvbnN0IGN1cnNvclBvc2l0aW9uczogYW55W10gPSBbXTtcblx0XHRcdGZ1bmN0aW9uIHJlcG9ydEN1cnNvclBvc2l0aW9uKCkge1xuXHRcdFx0XHRjdXJzb3JQb3NpdGlvbnMucHVzaCh2aWV3TW9kZWwuZ2V0Q3Vyc29yU3RhdGVzKClbMF0udmlld1N0YXRlLnBvc2l0aW9uLnRvU3RyaW5nKCkpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXBvcnRDdXJzb3JQb3NpdGlvbigpO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JEb3duLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdHJlcG9ydEN1cnNvclBvc2l0aW9uKCk7XG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckRvd24ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0cmVwb3J0Q3Vyc29yUG9zaXRpb24oKTtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yRG93bi5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRyZXBvcnRDdXJzb3JQb3NpdGlvbigpO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JEb3duLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblxuXHRcdFx0cmVwb3J0Q3Vyc29yUG9zaXRpb24oKTtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yVXAucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0cmVwb3J0Q3Vyc29yUG9zaXRpb24oKTtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yVXAucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0cmVwb3J0Q3Vyc29yUG9zaXRpb24oKTtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yVXAucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0cmVwb3J0Q3Vyc29yUG9zaXRpb24oKTtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yVXAucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0cmVwb3J0Q3Vyc29yUG9zaXRpb24oKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjdXJzb3JQb3NpdGlvbnMsIFtcblx0XHRcdFx0JygxLDEpJyxcblx0XHRcdFx0JygyLDUpJyxcblx0XHRcdFx0JygzLDEpJyxcblx0XHRcdFx0Jyg0LDUpJyxcblx0XHRcdFx0Jyg0LDEwKScsXG5cdFx0XHRcdCcoMywxKScsXG5cdFx0XHRcdCcoMiw1KScsXG5cdFx0XHRcdCcoMSwxKScsXG5cdFx0XHRcdCcoMSwxKScsXG5cdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE0MDE5NTogQ3Vyc29yIHVwL2Rvd24gbWFrZXMgcHJvZ3Jlc3MnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCdXb3JkMSBXb3JkMiBXb3JkMyBXb3JkNCcsXG5cdFx0XHRcdCdXb3JkNSBXb3JkNiBXb3JkNyBXb3JkOCcsXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyB3cmFwcGluZ0luZGVudDogJ2luZGVudCcsIHdvcmRXcmFwOiAnd29yZFdyYXBDb2x1bW4nLCB3b3JkV3JhcENvbHVtbjogMjAgfSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRlZGl0b3IuY2hhbmdlRGVjb3JhdGlvbnMoKGNoYW5nZUFjY2Vzc29yKSA9PiB7XG5cdFx0XHRcdGNoYW5nZUFjY2Vzc29yLmRlbHRhRGVjb3JhdGlvbnMoW10sIFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKDEsIDIyLCAxLCAyMiksXG5cdFx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRcdHNob3dJZkNvbGxhcHNlZDogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246ICd0ZXN0Jyxcblx0XHRcdFx0XHRcdFx0YWZ0ZXI6IHtcblx0XHRcdFx0XHRcdFx0XHRjb250ZW50OiAnc29tZSB2ZXJ5IHZlcnkgdmVyeSB2ZXJ5IHZlcnkgdmVyeSB2ZXJ5IHZlcnkgbG9uZyB0ZXh0Jyxcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XSk7XG5cdFx0XHR9KTtcblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSldKTtcblxuXHRcdFx0Y29uc3QgY3Vyc29yUG9zaXRpb25zOiBhbnlbXSA9IFtdO1xuXHRcdFx0ZnVuY3Rpb24gcmVwb3J0Q3Vyc29yUG9zaXRpb24oKSB7XG5cdFx0XHRcdGN1cnNvclBvc2l0aW9ucy5wdXNoKHZpZXdNb2RlbC5nZXRDdXJzb3JTdGF0ZXMoKVswXS52aWV3U3RhdGUucG9zaXRpb24udG9TdHJpbmcoKSk7XG5cdFx0XHR9XG5cblx0XHRcdHJlcG9ydEN1cnNvclBvc2l0aW9uKCk7XG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckRvd24ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0cmVwb3J0Q3Vyc29yUG9zaXRpb24oKTtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yRG93bi5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRyZXBvcnRDdXJzb3JQb3NpdGlvbigpO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JEb3duLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdHJlcG9ydEN1cnNvclBvc2l0aW9uKCk7XG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckRvd24ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXG5cdFx0XHRyZXBvcnRDdXJzb3JQb3NpdGlvbigpO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JVcC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRyZXBvcnRDdXJzb3JQb3NpdGlvbigpO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JVcC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRyZXBvcnRDdXJzb3JQb3NpdGlvbigpO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JVcC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRyZXBvcnRDdXJzb3JQb3NpdGlvbigpO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JVcC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRyZXBvcnRDdXJzb3JQb3NpdGlvbigpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGN1cnNvclBvc2l0aW9ucywgW1xuXHRcdFx0XHQnKDEsMSknLFxuXHRcdFx0XHQnKDIsNSknLFxuXHRcdFx0XHQnKDUsMTkpJyxcblx0XHRcdFx0Jyg2LDEpJyxcblx0XHRcdFx0Jyg3LDUpJyxcblx0XHRcdFx0Jyg2LDEpJyxcblx0XHRcdFx0JygyLDgpJyxcblx0XHRcdFx0JygxLDEpJyxcblx0XHRcdFx0JygxLDEpJyxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHQvLyAtLS0tLS0tLS0gbW92ZSB0byBiZWdpbm5pbmcgb2YgbGluZVxuXG5cdHRlc3QoJ21vdmUgdG8gYmVnaW5uaW5nIG9mIGxpbmUnLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUb0JlZ2lubmluZ09mTGluZShlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgNikpO1xuXHRcdFx0bW92ZVRvQmVnaW5uaW5nT2ZMaW5lKGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigxLCAxKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgdG8gYmVnaW5uaW5nIG9mIGxpbmUgZnJvbSB3aXRoaW4gbGluZScsICgpID0+IHtcblx0XHRydW5UZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCA4KTtcblx0XHRcdG1vdmVUb0JlZ2lubmluZ09mTGluZShlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgNikpO1xuXHRcdFx0bW92ZVRvQmVnaW5uaW5nT2ZMaW5lKGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigxLCAxKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgdG8gYmVnaW5uaW5nIG9mIGxpbmUgZnJvbSB3aGl0ZXNwYWNlIGF0IGJlZ2lubmluZyBvZiBsaW5lJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDIpO1xuXHRcdFx0bW92ZVRvQmVnaW5uaW5nT2ZMaW5lKGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigxLCA2KSk7XG5cdFx0XHRtb3ZlVG9CZWdpbm5pbmdPZkxpbmUoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDEpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSB0byBiZWdpbm5pbmcgb2YgbGluZSBmcm9tIHdpdGhpbiBsaW5lIHNlbGVjdGlvbicsICgpID0+IHtcblx0XHRydW5UZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCA4KTtcblx0XHRcdG1vdmVUb0JlZ2lubmluZ09mTGluZShlZGl0b3IsIHZpZXdNb2RlbCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDgsIDEsIDYpKTtcblx0XHRcdG1vdmVUb0JlZ2lubmluZ09mTGluZShlZGl0b3IsIHZpZXdNb2RlbCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDgsIDEsIDEpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSB0byBiZWdpbm5pbmcgb2YgbGluZSB3aXRoIHNlbGVjdGlvbiBtdWx0aWxpbmUgZm9yd2FyZCcsICgpID0+IHtcblx0XHRydW5UZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCA4KTtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMywgOSwgdHJ1ZSk7XG5cdFx0XHRtb3ZlVG9CZWdpbm5pbmdPZkxpbmUoZWRpdG9yLCB2aWV3TW9kZWwsIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMywgNSwgMywgNSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHRvIGJlZ2lubmluZyBvZiBsaW5lIHdpdGggc2VsZWN0aW9uIG11bHRpbGluZSBiYWNrd2FyZCcsICgpID0+IHtcblx0XHRydW5UZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCA5KTtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgOCwgdHJ1ZSk7XG5cdFx0XHRtb3ZlVG9CZWdpbm5pbmdPZkxpbmUoZWRpdG9yLCB2aWV3TW9kZWwsIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgNiwgMSwgNikpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHRvIGJlZ2lubmluZyBvZiBsaW5lIHdpdGggc2VsZWN0aW9uIHNpbmdsZSBsaW5lIGZvcndhcmQnLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMywgMik7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDMsIDksIHRydWUpO1xuXHRcdFx0bW92ZVRvQmVnaW5uaW5nT2ZMaW5lKGVkaXRvciwgdmlld01vZGVsLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDMsIDUsIDMsIDUpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSB0byBiZWdpbm5pbmcgb2YgbGluZSB3aXRoIHNlbGVjdGlvbiBzaW5nbGUgbGluZSBiYWNrd2FyZCcsICgpID0+IHtcblx0XHRydW5UZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCA5KTtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMywgMiwgdHJ1ZSk7XG5cdFx0XHRtb3ZlVG9CZWdpbm5pbmdPZkxpbmUoZWRpdG9yLCB2aWV3TW9kZWwsIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMywgNSwgMywgNSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTU0MDE6IFwiRW5kXCIga2V5IGlzIGJlaGF2aW5nIHdlaXJkIHdoZW4gdGV4dCBpcyBzZWxlY3RlZCBwYXJ0IDEnLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgOCk7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDMsIDksIHRydWUpO1xuXHRcdFx0bW92ZVRvQmVnaW5uaW5nT2ZMaW5lKGVkaXRvciwgdmlld01vZGVsLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDMsIDUsIDMsIDUpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE3MDExOiBTaGlmdCtob21lL2VuZCBub3cgZ28gdG8gdGhlIGVuZCBvZiB0aGUgc2VsZWN0aW9uIHN0YXJ0XFwncyBsaW5lLCBub3QgdGhlIHNlbGVjdGlvblxcJ3MgZW5kJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDgpO1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCA5LCB0cnVlKTtcblx0XHRcdG1vdmVUb0JlZ2lubmluZ09mTGluZShlZGl0b3IsIHZpZXdNb2RlbCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDgsIDMsIDUpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0Ly8gLS0tLS0tLS0tIG1vdmUgdG8gZW5kIG9mIGxpbmVcblxuXHR0ZXN0KCdtb3ZlIHRvIGVuZCBvZiBsaW5lJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG9FbmRPZkxpbmUoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEsIExJTkUxLmxlbmd0aCArIDEpKTtcblx0XHRcdG1vdmVUb0VuZE9mTGluZShlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgTElORTEubGVuZ3RoICsgMSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHRvIGVuZCBvZiBsaW5lIGZyb20gd2l0aGluIGxpbmUnLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgNik7XG5cdFx0XHRtb3ZlVG9FbmRPZkxpbmUoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEsIExJTkUxLmxlbmd0aCArIDEpKTtcblx0XHRcdG1vdmVUb0VuZE9mTGluZShlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgTElORTEubGVuZ3RoICsgMSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHRvIGVuZCBvZiBsaW5lIGZyb20gd2hpdGVzcGFjZSBhdCBlbmQgb2YgbGluZScsICgpID0+IHtcblx0XHRydW5UZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCAyMCk7XG5cdFx0XHRtb3ZlVG9FbmRPZkxpbmUoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEsIExJTkUxLmxlbmd0aCArIDEpKTtcblx0XHRcdG1vdmVUb0VuZE9mTGluZShlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgTElORTEubGVuZ3RoICsgMSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHRvIGVuZCBvZiBsaW5lIGZyb20gd2l0aGluIGxpbmUgc2VsZWN0aW9uJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDYpO1xuXHRcdFx0bW92ZVRvRW5kT2ZMaW5lKGVkaXRvciwgdmlld01vZGVsLCB0cnVlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgNiwgMSwgTElORTEubGVuZ3RoICsgMSkpO1xuXHRcdFx0bW92ZVRvRW5kT2ZMaW5lKGVkaXRvciwgdmlld01vZGVsLCB0cnVlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgNiwgMSwgTElORTEubGVuZ3RoICsgMSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHRvIGVuZCBvZiBsaW5lIHdpdGggc2VsZWN0aW9uIG11bHRpbGluZSBmb3J3YXJkJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDEpO1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCA5LCB0cnVlKTtcblx0XHRcdG1vdmVUb0VuZE9mTGluZShlZGl0b3IsIHZpZXdNb2RlbCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigzLCAxNywgMywgMTcpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSB0byBlbmQgb2YgbGluZSB3aXRoIHNlbGVjdGlvbiBtdWx0aWxpbmUgYmFja3dhcmQnLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMywgOSk7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDEsIHRydWUpO1xuXHRcdFx0bW92ZVRvRW5kT2ZMaW5lKGVkaXRvciwgdmlld01vZGVsLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDIxLCAxLCAyMSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHRvIGVuZCBvZiBsaW5lIHdpdGggc2VsZWN0aW9uIHNpbmdsZSBsaW5lIGZvcndhcmQnLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMywgMSk7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDMsIDksIHRydWUpO1xuXHRcdFx0bW92ZVRvRW5kT2ZMaW5lKGVkaXRvciwgdmlld01vZGVsLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDMsIDE3LCAzLCAxNykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHRvIGVuZCBvZiBsaW5lIHdpdGggc2VsZWN0aW9uIHNpbmdsZSBsaW5lIGJhY2t3YXJkJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDMsIDkpO1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCAxLCB0cnVlKTtcblx0XHRcdG1vdmVUb0VuZE9mTGluZShlZGl0b3IsIHZpZXdNb2RlbCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigzLCAxNywgMywgMTcpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE1NDAxOiBcIkVuZFwiIGtleSBpcyBiZWhhdmluZyB3ZWlyZCB3aGVuIHRleHQgaXMgc2VsZWN0ZWQgcGFydCAyJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDEpO1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCA5LCB0cnVlKTtcblx0XHRcdG1vdmVUb0VuZE9mTGluZShlZGl0b3IsIHZpZXdNb2RlbCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigzLCAxNywgMywgMTcpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0Ly8gLS0tLS0tLS0tIG1vdmUgdG8gYmVnaW5uaW5nIG9mIGJ1ZmZlclxuXG5cdHRlc3QoJ21vdmUgdG8gYmVnaW5uaW5nIG9mIGJ1ZmZlcicsICgpID0+IHtcblx0XHRydW5UZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvQmVnaW5uaW5nT2ZCdWZmZXIoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDEpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSB0byBiZWdpbm5pbmcgb2YgYnVmZmVyIGZyb20gd2l0aGluIGZpcnN0IGxpbmUnLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgMyk7XG5cdFx0XHRtb3ZlVG9CZWdpbm5pbmdPZkJ1ZmZlcihlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHRvIGJlZ2lubmluZyBvZiBidWZmZXIgZnJvbSB3aXRoaW4gYW5vdGhlciBsaW5lJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDMsIDMpO1xuXHRcdFx0bW92ZVRvQmVnaW5uaW5nT2ZCdWZmZXIoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDEpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSB0byBiZWdpbm5pbmcgb2YgYnVmZmVyIGZyb20gd2l0aGluIGZpcnN0IGxpbmUgc2VsZWN0aW9uJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDMpO1xuXHRcdFx0bW92ZVRvQmVnaW5uaW5nT2ZCdWZmZXIoZWRpdG9yLCB2aWV3TW9kZWwsIHRydWUpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCAzLCAxLCAxKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgdG8gYmVnaW5uaW5nIG9mIGJ1ZmZlciBmcm9tIHdpdGhpbiBhbm90aGVyIGxpbmUgc2VsZWN0aW9uJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDMsIDMpO1xuXHRcdFx0bW92ZVRvQmVnaW5uaW5nT2ZCdWZmZXIoZWRpdG9yLCB2aWV3TW9kZWwsIHRydWUpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigzLCAzLCAxLCAxKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdC8vIC0tLS0tLS0tLSBtb3ZlIHRvIGVuZCBvZiBidWZmZXJcblxuXHR0ZXN0KCdtb3ZlIHRvIGVuZCBvZiBidWZmZXInLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUb0VuZE9mQnVmZmVyKGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbig1LCBMSU5FNS5sZW5ndGggKyAxKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgdG8gZW5kIG9mIGJ1ZmZlciBmcm9tIHdpdGhpbiBsYXN0IGxpbmUnLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgNSwgMSk7XG5cdFx0XHRtb3ZlVG9FbmRPZkJ1ZmZlcihlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oNSwgTElORTUubGVuZ3RoICsgMSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHRvIGVuZCBvZiBidWZmZXIgZnJvbSB3aXRoaW4gYW5vdGhlciBsaW5lJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDMsIDMpO1xuXHRcdFx0bW92ZVRvRW5kT2ZCdWZmZXIoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDUsIExJTkU1Lmxlbmd0aCArIDEpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSB0byBlbmQgb2YgYnVmZmVyIGZyb20gd2l0aGluIGxhc3QgbGluZSBzZWxlY3Rpb24nLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgNSwgMSk7XG5cdFx0XHRtb3ZlVG9FbmRPZkJ1ZmZlcihlZGl0b3IsIHZpZXdNb2RlbCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDUsIDEsIDUsIExJTkU1Lmxlbmd0aCArIDEpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSB0byBlbmQgb2YgYnVmZmVyIGZyb20gd2l0aGluIGFub3RoZXIgbGluZSBzZWxlY3Rpb24nLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMywgMyk7XG5cdFx0XHRtb3ZlVG9FbmRPZkJ1ZmZlcihlZGl0b3IsIHZpZXdNb2RlbCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDMsIDMsIDUsIExJTkU1Lmxlbmd0aCArIDEpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0Ly8gLS0tLS0tLS0tIG1pc2NcblxuXHR0ZXN0KCdzZWxlY3QgYWxsJywgKCkgPT4ge1xuXHRcdHJ1blRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLlNlbGVjdEFsbC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgMSwgNSwgTElORTUubGVuZ3RoICsgMSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHQvLyAtLS0tLS0tLS0gZXZlbnRpbmdcblxuXHR0ZXN0KCdubyBtb3ZlIGRvZXNuXFwndCB0cmlnZ2VyIGV2ZW50JywgKCkgPT4ge1xuXG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSB2aWV3TW9kZWwub25FdmVudCgoZSkgPT4ge1xuXHRcdFx0XHRhc3NlcnQub2soZmFsc2UsICd3YXMgbm90IGV4cGVjdGluZyBldmVudCcpO1xuXHRcdFx0fSk7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDEpO1xuXHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgZXZlbnRpbmcnLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGxldCBldmVudHMgPSAwO1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHZpZXdNb2RlbC5vbkV2ZW50KChlKSA9PiB7XG5cdFx0XHRcdGlmIChlLmtpbmQgPT09IE91dGdvaW5nVmlld01vZGVsRXZlbnRLaW5kLkN1cnNvclN0YXRlQ2hhbmdlZCkge1xuXHRcdFx0XHRcdGV2ZW50cysrO1xuXHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZS5zZWxlY3Rpb25zLCBbbmV3IFNlbGVjdGlvbigxLCAyLCAxLCAyKV0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLCAxLCAncmVjZWl2ZXMgMSBldmVudCcpO1xuXHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgaW4gc2VsZWN0aW9uIG1vZGUgZXZlbnRpbmcnLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGxldCBldmVudHMgPSAwO1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHZpZXdNb2RlbC5vbkV2ZW50KChlKSA9PiB7XG5cdFx0XHRcdGlmIChlLmtpbmQgPT09IE91dGdvaW5nVmlld01vZGVsRXZlbnRLaW5kLkN1cnNvclN0YXRlQ2hhbmdlZCkge1xuXHRcdFx0XHRcdGV2ZW50cysrO1xuXHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZS5zZWxlY3Rpb25zLCBbbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAyKV0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgMiwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLCAxLCAncmVjZWl2ZXMgMSBldmVudCcpO1xuXHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdC8vIC0tLS0tLS0tLSBzdGF0ZSBzYXZlICYgcmVzdG9yZVxuXG5cdHRlc3QoJ3NhdmVTdGF0ZSAmIHJlc3RvcmVTdGF0ZScsICgpID0+IHtcblx0XHRydW5UZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAyLCAxLCB0cnVlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgMSwgMiwgMSkpO1xuXG5cdFx0XHRjb25zdCBzYXZlZFN0YXRlID0gSlNPTi5zdHJpbmdpZnkodmlld01vZGVsLnNhdmVDdXJzb3JTdGF0ZSgpKTtcblxuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCAxLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXG5cdFx0XHR2aWV3TW9kZWwucmVzdG9yZUN1cnNvclN0YXRlKEpTT04ucGFyc2Uoc2F2ZWRTdGF0ZSkpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCAxLCAyLCAxKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdC8vIC0tLS0tLS0tLSB1cGRhdGluZyBjdXJzb3JcblxuXHR0ZXN0KCdJbmRlcGVuZGVudCBtb2RlbCBlZGl0IDEnLCAoKSA9PiB7XG5cdFx0cnVuVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMiwgMTYsIHRydWUpO1xuXG5cdFx0XHRlZGl0b3IuZ2V0TW9kZWwoKS5hcHBseUVkaXRzKFtFZGl0T3BlcmF0aW9uLmRlbGV0ZShuZXcgUmFuZ2UoMiwgMSwgMiwgMikpXSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDEsIDIsIDE1KSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbHVtbiBzZWxlY3QgMScsICgpID0+IHtcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0J1xcdHByaXZhdGUgY29tcHV0ZShhOm51bWJlcik6IGJvb2xlYW4geycsXG5cdFx0XHQnXFx0XFx0aWYgKGEgKyAzID09PSAwIHx8IGEgKyA1ID09PSAwKSB7Jyxcblx0XHRcdCdcXHRcXHRcXHRyZXR1cm4gZmFsc2U7Jyxcblx0XHRcdCdcXHRcXHR9Jyxcblx0XHRcdCdcXHR9J1xuXHRcdF0sIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblxuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCA3LCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgNykpO1xuXG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkNvbHVtblNlbGVjdC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHtcblx0XHRcdFx0cG9zaXRpb246IG5ldyBQb3NpdGlvbig0LCA0KSxcblx0XHRcdFx0dmlld1Bvc2l0aW9uOiBuZXcgUG9zaXRpb24oNCwgNCksXG5cdFx0XHRcdG1vdXNlQ29sdW1uOiAxNSxcblx0XHRcdFx0ZG9Db2x1bW5TZWxlY3Q6IHRydWVcblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBleHBlY3RlZFNlbGVjdGlvbnMgPSBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNywgMSwgMTIpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDQsIDIsIDkpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDMsIDMsIDYpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDQsIDQsIDQsIDQpLFxuXHRcdFx0XTtcblxuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgZXhwZWN0ZWRTZWxlY3Rpb25zKTtcblxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdncmFwaGVtZSBicmVha2luZycsICgpID0+IHtcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0J2FiY2FiYycsXG5cdFx0XHQnYVx1MDMwM2FcdTAzMDNhXHUwMzAzYVx1MDMwM2FcdTAzMDNhXHUwMzAzJyxcblx0XHRcdCdcdThGQkJcdURCNDBcdUREMDBcdThGQkJcdURCNDBcdUREMDBcdThGQkJcdURCNDBcdUREMDAnLFxuXHRcdFx0J1x1MEJBQVx1MEJDMScsXG5cdFx0XSwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDEpXSk7XG5cdFx0XHRtb3ZlUmlnaHQoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDIsIDMpKTtcblx0XHRcdG1vdmVMZWZ0KGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigyLCAxKSk7XG5cblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMywgMSwgMywgMSldKTtcblx0XHRcdG1vdmVSaWdodChlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMywgNCkpO1xuXHRcdFx0bW92ZUxlZnQoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDMsIDEpKTtcblxuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbbmV3IFNlbGVjdGlvbig0LCAxLCA0LCAxKV0pO1xuXHRcdFx0bW92ZVJpZ2h0KGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbig0LCAzKSk7XG5cdFx0XHRtb3ZlTGVmdChlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oNCwgMSkpO1xuXG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpXSk7XG5cdFx0XHRtb3ZlRG93bihlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMiwgNSkpO1xuXHRcdFx0bW92ZURvd24oZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDMsIDQpKTtcblx0XHRcdG1vdmVVcChlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMiwgNSkpO1xuXHRcdFx0bW92ZVVwKGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigxLCAzKSk7XG5cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzQ5MDUgLSBjb2x1bW4gc2VsZWN0IGlzIGJpYXNlZCB0byB0aGUgcmlnaHQnLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCd2YXIgZ3VscCA9IHJlcXVpcmUoXCJndWxwXCIpOycsXG5cdFx0XHQndmFyIHBhdGggPSByZXF1aXJlKFwicGF0aFwiKTsnLFxuXHRcdFx0J3ZhciByaW1yYWYgPSByZXF1aXJlKFwicmltcmFmXCIpOycsXG5cdFx0XHQndmFyIGlzYXJyYXkgPSByZXF1aXJlKFwiaXNhcnJheVwiKTsnLFxuXHRcdFx0J3ZhciBtZXJnZSA9IHJlcXVpcmUoXCJtZXJnZS1zdHJlYW1cIik7Jyxcblx0XHRcdCd2YXIgY29uY2F0ID0gcmVxdWlyZShcImd1bHAtY29uY2F0XCIpOycsXG5cdFx0XHQndmFyIG5ld2VyID0gcmVxdWlyZShcImd1bHAtbmV3ZXJcIik7Jyxcblx0XHRdLmpvaW4oJ1xcbicpLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDQsIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigxLCA0KSk7XG5cblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ29sdW1uU2VsZWN0LnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge1xuXHRcdFx0XHRwb3NpdGlvbjogbmV3IFBvc2l0aW9uKDQsIDEpLFxuXHRcdFx0XHR2aWV3UG9zaXRpb246IG5ldyBQb3NpdGlvbig0LCAxKSxcblx0XHRcdFx0bW91c2VDb2x1bW46IDEsXG5cdFx0XHRcdGRvQ29sdW1uU2VsZWN0OiB0cnVlXG5cdFx0XHR9KTtcblxuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDEpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDQsIDIsIDEpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDQsIDMsIDEpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDQsIDQsIDQsIDEpLFxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMyMDA4NzogY29sdW1uIHNlbGVjdCB3aXRoIG1vdXNlJywgKCkgPT4ge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnPHByb3BlcnR5IGlkPVwiU29tZVRoaW5nXCIga2V5PVwiU29tZUtleVwiIHZhbHVlPVwiMDAwXCIvPicsXG5cdFx0XHQnPHByb3BlcnR5IGlkPVwiU29tZVRoaW5nXCIga2V5PVwiU29tZUtleVwiIHZhbHVlPVwiMDAwXCIvPicsXG5cdFx0XHQnPHByb3BlcnR5IGlkPVwiU29tZVRoaW5nXCIgS2V5PVwiU29tZUtleVwiIHZhbHVlPVwiMDAwXCIvPicsXG5cdFx0XHQnPHByb3BlcnR5IGlkPVwiU29tZVRoaW5nXCIga2V5PVwiU29tZUtleVwiIHZhbHVlPVwiMDAwXCIvPicsXG5cdFx0XHQnPHByb3BlcnR5IGlkPVwiU29tZVRoaW5nXCIga2V5PVwiU29NRUtFeVwiIHZhbHVlPVwiMDAwXCIvPicsXG5cdFx0XHQnPHByb3BlcnR5IGlkPVwiU29tZVRoaW5nXCIga2V5PVwiU29tZUtleVwiIHZhbHVlPVwiMDAwXCIvPicsXG5cdFx0XHQnPHByb3BlcnR5IGlkPVwiU29tZVRoaW5nXCIga2V5PVwiU29tZUtleVwiIHZhbHVlPVwiMDAwXCIvPicsXG5cdFx0XHQnPHByb3BlcnR5IGlkPVwiU29tZVRoaW5nXCIga2V5PVwiU29tZUtleVwiIHZhbHVFPVwiMDAwXCIvPicsXG5cdFx0XHQnPHByb3BlcnR5IGlkPVwiU29tZVRoaW5nXCIga2V5PVwiU29tZUtleVwiIHZhbHVlPVwiMDAwXCIvPicsXG5cdFx0XHQnPHByb3BlcnR5IGlkPVwiU29tZVRoaW5nXCIga2V5PVwiU29tZUtleVwiIHZhbHVlPVwiMDBYXCIvPicsXG5cdFx0XS5qb2luKCdcXG4nKSwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEwLCAxMCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEwLCAxMCkpO1xuXG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkNvbHVtblNlbGVjdC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHtcblx0XHRcdFx0cG9zaXRpb246IG5ldyBQb3NpdGlvbigxLCAxKSxcblx0XHRcdFx0dmlld1Bvc2l0aW9uOiBuZXcgUG9zaXRpb24oMSwgMSksXG5cdFx0XHRcdG1vdXNlQ29sdW1uOiAxLFxuXHRcdFx0XHRkb0NvbHVtblNlbGVjdDogdHJ1ZVxuXHRcdFx0fSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMTAsIDEwLCAxMCwgMSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oOSwgMTAsIDksIDEpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDgsIDEwLCA4LCAxKSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig3LCAxMCwgNywgMSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNiwgMTAsIDYsIDEpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDUsIDEwLCA1LCAxKSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig0LCAxMCwgNCwgMSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMywgMTAsIDMsIDEpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDEwLCAyLCAxKSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxMCwgMSwgMSksXG5cdFx0XHRdKTtcblxuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5Db2x1bW5TZWxlY3QucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7XG5cdFx0XHRcdHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oMSwgMSksXG5cdFx0XHRcdHZpZXdQb3NpdGlvbjogbmV3IFBvc2l0aW9uKDEsIDEpLFxuXHRcdFx0XHRtb3VzZUNvbHVtbjogMSxcblx0XHRcdFx0ZG9Db2x1bW5TZWxlY3Q6IHRydWVcblx0XHRcdH0pO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEwLCAxMCwgMTAsIDEpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDksIDEwLCA5LCAxKSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig4LCAxMCwgOCwgMSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNywgMTAsIDcsIDEpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDYsIDEwLCA2LCAxKSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig1LCAxMCwgNSwgMSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNCwgMTAsIDQsIDEpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDEwLCAzLCAxKSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxMCwgMiwgMSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMTAsIDEsIDEpLFxuXHRcdFx0XSk7XG5cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzIwMDg3OiBjb2x1bW4gc2VsZWN0IHdpdGgga2V5Ym9hcmQnLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCc8cHJvcGVydHkgaWQ9XCJTb21lVGhpbmdcIiBrZXk9XCJTb21lS2V5XCIgdmFsdWU9XCIwMDBcIi8+Jyxcblx0XHRcdCc8cHJvcGVydHkgaWQ9XCJTb21lVGhpbmdcIiBrZXk9XCJTb21lS2V5XCIgdmFsdWU9XCIwMDBcIi8+Jyxcblx0XHRcdCc8cHJvcGVydHkgaWQ9XCJTb21lVGhpbmdcIiBLZXk9XCJTb21lS2V5XCIgdmFsdWU9XCIwMDBcIi8+Jyxcblx0XHRcdCc8cHJvcGVydHkgaWQ9XCJTb21lVGhpbmdcIiBrZXk9XCJTb21lS2V5XCIgdmFsdWU9XCIwMDBcIi8+Jyxcblx0XHRcdCc8cHJvcGVydHkgaWQ9XCJTb21lVGhpbmdcIiBrZXk9XCJTb01FS0V5XCIgdmFsdWU9XCIwMDBcIi8+Jyxcblx0XHRcdCc8cHJvcGVydHkgaWQ9XCJTb21lVGhpbmdcIiBrZXk9XCJTb21lS2V5XCIgdmFsdWU9XCIwMDBcIi8+Jyxcblx0XHRcdCc8cHJvcGVydHkgaWQ9XCJTb21lVGhpbmdcIiBrZXk9XCJTb21lS2V5XCIgdmFsdWU9XCIwMDBcIi8+Jyxcblx0XHRcdCc8cHJvcGVydHkgaWQ9XCJTb21lVGhpbmdcIiBrZXk9XCJTb21lS2V5XCIgdmFsdUU9XCIwMDBcIi8+Jyxcblx0XHRcdCc8cHJvcGVydHkgaWQ9XCJTb21lVGhpbmdcIiBrZXk9XCJTb21lS2V5XCIgdmFsdWU9XCIwMDBcIi8+Jyxcblx0XHRcdCc8cHJvcGVydHkgaWQ9XCJTb21lVGhpbmdcIiBrZXk9XCJTb21lS2V5XCIgdmFsdWU9XCIwMFhcIi8+Jyxcblx0XHRdLmpvaW4oJ1xcbicpLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMTAsIDEwLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMTAsIDEwKSk7XG5cblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQ29sdW1uU2VsZWN0TGVmdC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxMCwgMTAsIDEwLCA5KVxuXHRcdFx0XSk7XG5cblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQ29sdW1uU2VsZWN0TGVmdC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxMCwgMTAsIDEwLCA4KVxuXHRcdFx0XSk7XG5cblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQ29sdW1uU2VsZWN0UmlnaHQucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMTAsIDEwLCAxMCwgOSlcblx0XHRcdF0pO1xuXG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdFVwLnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEwLCAxMCwgMTAsIDkpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDksIDEwLCA5LCA5KSxcblx0XHRcdF0pO1xuXG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdERvd24ucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMTAsIDEwLCAxMCwgOSlcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTE4MDYyOiBDb2x1bW4gc2VsZWN0aW9uIGNhbm5vdCBzZWxlY3QgZmlyc3QgcG9zaXRpb24gb2YgYSBsaW5lJywgKCkgPT4ge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnaGVsbG8gd29ybGQnLFxuXHRcdF0uam9pbignXFxuJyksIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblxuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCAyLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMikpO1xuXG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdExlZnQucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMiwgMSwgMSlcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdjb2x1bW4gc2VsZWN0IHdpdGgga2V5Ym9hcmQnLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCd2YXIgZ3VscCA9IHJlcXVpcmUoXCJndWxwXCIpOycsXG5cdFx0XHQndmFyIHBhdGggPSByZXF1aXJlKFwicGF0aFwiKTsnLFxuXHRcdFx0J3ZhciByaW1yYWYgPSByZXF1aXJlKFwicmltcmFmXCIpOycsXG5cdFx0XHQndmFyIGlzYXJyYXkgPSByZXF1aXJlKFwiaXNhcnJheVwiKTsnLFxuXHRcdFx0J3ZhciBtZXJnZSA9IHJlcXVpcmUoXCJtZXJnZS1zdHJlYW1cIik7Jyxcblx0XHRcdCd2YXIgY29uY2F0ID0gcmVxdWlyZShcImd1bHAtY29uY2F0XCIpOycsXG5cdFx0XHQndmFyIG5ld2VyID0gcmVxdWlyZShcImd1bHAtbmV3ZXJcIik7Jyxcblx0XHRdLmpvaW4oJ1xcbicpLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgNCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDQpKTtcblxuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JDb2x1bW5TZWxlY3RSaWdodC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCA0LCAxLCA1KVxuXHRcdFx0XSk7XG5cblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQ29sdW1uU2VsZWN0RG93bi5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCA0LCAxLCA1KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCA0LCAyLCA1KVxuXHRcdFx0XSk7XG5cblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQ29sdW1uU2VsZWN0RG93bi5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCA0LCAxLCA1KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCA0LCAyLCA1KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigzLCA0LCAzLCA1KSxcblx0XHRcdF0pO1xuXG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdERvd24ucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdERvd24ucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdERvd24ucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdERvd24ucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgNCwgMiwgNSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMywgNCwgMywgNSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNCwgNCwgNCwgNSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNSwgNCwgNSwgNSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNiwgNCwgNiwgNSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNywgNCwgNywgNSksXG5cdFx0XHRdKTtcblxuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JDb2x1bW5TZWxlY3RSaWdodC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCA0LCAxLCA2KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCA0LCAyLCA2KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigzLCA0LCAzLCA2KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig0LCA0LCA0LCA2KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig1LCA0LCA1LCA2KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig2LCA0LCA2LCA2KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig3LCA0LCA3LCA2KSxcblx0XHRcdF0pO1xuXG5cdFx0XHQvLyAxMCB0aW1lc1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JDb2x1bW5TZWxlY3RSaWdodC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQ29sdW1uU2VsZWN0UmlnaHQucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdFJpZ2h0LnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JDb2x1bW5TZWxlY3RSaWdodC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQ29sdW1uU2VsZWN0UmlnaHQucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdFJpZ2h0LnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JDb2x1bW5TZWxlY3RSaWdodC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQ29sdW1uU2VsZWN0UmlnaHQucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdFJpZ2h0LnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JDb2x1bW5TZWxlY3RSaWdodC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCA0LCAxLCAxNiksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgNCwgMiwgMTYpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDQsIDMsIDE2KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig0LCA0LCA0LCAxNiksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNSwgNCwgNSwgMTYpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDYsIDQsIDYsIDE2KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig3LCA0LCA3LCAxNiksXG5cdFx0XHRdKTtcblxuXHRcdFx0Ly8gMTAgdGltZXNcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQ29sdW1uU2VsZWN0UmlnaHQucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdFJpZ2h0LnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JDb2x1bW5TZWxlY3RSaWdodC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQ29sdW1uU2VsZWN0UmlnaHQucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdFJpZ2h0LnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JDb2x1bW5TZWxlY3RSaWdodC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQ29sdW1uU2VsZWN0UmlnaHQucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdFJpZ2h0LnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JDb2x1bW5TZWxlY3RSaWdodC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQ29sdW1uU2VsZWN0UmlnaHQucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgMjYpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDQsIDIsIDI2KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigzLCA0LCAzLCAyNiksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNCwgNCwgNCwgMjYpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDUsIDQsIDUsIDI2KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig2LCA0LCA2LCAyNiksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNywgNCwgNywgMjYpLFxuXHRcdFx0XSk7XG5cblx0XHRcdC8vIDIgdGltZXMgPT4gcmVhY2hpbmcgdGhlIGVuZGluZyBvZiBsaW5lcyAxIGFuZCAyXG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdFJpZ2h0LnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JDb2x1bW5TZWxlY3RSaWdodC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCA0LCAxLCAyOCksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgNCwgMiwgMjgpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDQsIDMsIDI4KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig0LCA0LCA0LCAyOCksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNSwgNCwgNSwgMjgpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDYsIDQsIDYsIDI4KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig3LCA0LCA3LCAyOCksXG5cdFx0XHRdKTtcblxuXHRcdFx0Ly8gNCB0aW1lcyA9PiByZWFjaGluZyB0aGUgZW5kaW5nIG9mIGxpbmUgM1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JDb2x1bW5TZWxlY3RSaWdodC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQ29sdW1uU2VsZWN0UmlnaHQucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdFJpZ2h0LnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JDb2x1bW5TZWxlY3RSaWdodC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCA0LCAxLCAyOCksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgNCwgMiwgMjgpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDQsIDMsIDMyKSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig0LCA0LCA0LCAzMiksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNSwgNCwgNSwgMzIpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDYsIDQsIDYsIDMyKSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig3LCA0LCA3LCAzMiksXG5cdFx0XHRdKTtcblxuXHRcdFx0Ly8gMiB0aW1lcyA9PiByZWFjaGluZyB0aGUgZW5kaW5nIG9mIGxpbmUgNFxuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JDb2x1bW5TZWxlY3RSaWdodC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQ29sdW1uU2VsZWN0UmlnaHQucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgMjgpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDQsIDIsIDI4KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigzLCA0LCAzLCAzMiksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNCwgNCwgNCwgMzQpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDUsIDQsIDUsIDM0KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig2LCA0LCA2LCAzNCksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNywgNCwgNywgMzQpLFxuXHRcdFx0XSk7XG5cblx0XHRcdC8vIDEgdGltZSA9PiByZWFjaGluZyB0aGUgZW5kaW5nIG9mIGxpbmUgN1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JDb2x1bW5TZWxlY3RSaWdodC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCA0LCAxLCAyOCksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgNCwgMiwgMjgpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDQsIDMsIDMyKSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig0LCA0LCA0LCAzNCksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNSwgNCwgNSwgMzUpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDYsIDQsIDYsIDM1KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig3LCA0LCA3LCAzNSksXG5cdFx0XHRdKTtcblxuXHRcdFx0Ly8gMyB0aW1lcyA9PiByZWFjaGluZyB0aGUgZW5kaW5nIG9mIGxpbmVzIDUgJiA2XG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdFJpZ2h0LnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JDb2x1bW5TZWxlY3RSaWdodC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQ29sdW1uU2VsZWN0UmlnaHQucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgMjgpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDQsIDIsIDI4KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigzLCA0LCAzLCAzMiksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNCwgNCwgNCwgMzQpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDUsIDQsIDUsIDM3KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig2LCA0LCA2LCAzNyksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNywgNCwgNywgMzUpLFxuXHRcdFx0XSk7XG5cblx0XHRcdC8vIGNhbm5vdCBnbyBhbnl3aGVyZSBhbnltb3JlXG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdFJpZ2h0LnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDI4KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCA0LCAyLCAyOCksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMywgNCwgMywgMzIpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDQsIDQsIDQsIDM0KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig1LCA0LCA1LCAzNyksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNiwgNCwgNiwgMzcpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDcsIDQsIDcsIDM1KSxcblx0XHRcdF0pO1xuXG5cdFx0XHQvLyBjYW5ub3QgZ28gYW55d2hlcmUgYW55bW9yZSBldmVuIGlmIHdlIGluc2lzdFxuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JDb2x1bW5TZWxlY3RSaWdodC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQ29sdW1uU2VsZWN0UmlnaHQucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdFJpZ2h0LnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JDb2x1bW5TZWxlY3RSaWdodC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCA0LCAxLCAyOCksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgNCwgMiwgMjgpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDQsIDMsIDMyKSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig0LCA0LCA0LCAzNCksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNSwgNCwgNSwgMzcpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDYsIDQsIDYsIDM3KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig3LCA0LCA3LCAzNSksXG5cdFx0XHRdKTtcblxuXHRcdFx0Ly8gY2FuIGVhc2lseSBnbyBiYWNrXG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdExlZnQucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7fSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgMjgpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDQsIDIsIDI4KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigzLCA0LCAzLCAzMiksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNCwgNCwgNCwgMzQpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDUsIDQsIDUsIDM2KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig2LCA0LCA2LCAzNiksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNywgNCwgNywgMzUpLFxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NldFNlbGVjdGlvbiAvIHNldFBvc2l0aW9uIHdpdGggc291cmNlJywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgdG9rZW5pemF0aW9uU3VwcG9ydDogSVRva2VuaXphdGlvblN1cHBvcnQgPSB7XG5cdFx0XHRnZXRJbml0aWFsU3RhdGU6ICgpID0+IE51bGxTdGF0ZSxcblx0XHRcdHRva2VuaXplOiB1bmRlZmluZWQhLFxuXHRcdFx0dG9rZW5pemVFbmNvZGVkOiAobGluZTogc3RyaW5nLCBoYXNFT0w6IGJvb2xlYW4sIHN0YXRlOiBJU3RhdGUpOiBFbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0ID0+IHtcblx0XHRcdFx0cmV0dXJuIG5ldyBFbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0KG5ldyBVaW50MzJBcnJheSgwKSwgc3RhdGUpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBMQU5HVUFHRV9JRCA9ICdtb2RlbE1vZGVUZXN0MSc7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VSZWdpc3RyYXRpb24gPSBUb2tlbml6YXRpb25SZWdpc3RyeS5yZWdpc3RlcihMQU5HVUFHRV9JRCwgdG9rZW5pemF0aW9uU3VwcG9ydCk7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoJ0p1c3QgdGV4dCcsIExBTkdVQUdFX0lEKTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IxLCBjdXJzb3IxKSA9PiB7XG5cdFx0XHRsZXQgZXZlbnQ6IElDdXJzb3JQb3NpdGlvbkNoYW5nZWRFdmVudCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBlZGl0b3IxLm9uRGlkQ2hhbmdlQ3Vyc29yUG9zaXRpb24oZSA9PiB7XG5cdFx0XHRcdGV2ZW50ID0gZTtcblx0XHRcdH0pO1xuXG5cdFx0XHRlZGl0b3IxLnNldFNlbGVjdGlvbihuZXcgUmFuZ2UoMSwgMiwgMSwgMyksICduYXZpZ2F0aW9uJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQhLnNvdXJjZSwgJ25hdmlnYXRpb24nKTtcblxuXHRcdFx0ZXZlbnQgPSB1bmRlZmluZWQ7XG5cdFx0XHRlZGl0b3IxLnNldFBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLCAyKSwgJ25hdmlnYXRpb24nKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudCEuc291cmNlLCAnbmF2aWdhdGlvbicpO1xuXHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cblx0XHRsYW5ndWFnZVJlZ2lzdHJhdGlvbi5kaXNwb3NlKCk7XG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgnRWRpdG9yIENvbnRyb2xsZXInLCAoKSA9PiB7XG5cblx0Y29uc3Qgc3Vycm91bmRpbmdMYW5ndWFnZUlkID0gJ3N1cnJvdW5kaW5nTGFuZ3VhZ2UnO1xuXHRjb25zdCBpbmRlbnRSdWxlc0xhbmd1YWdlSWQgPSAnaW5kZW50UnVsZXNMYW5ndWFnZSc7XG5cdGNvbnN0IGVsZWN0cmljQ2hhckxhbmd1YWdlSWQgPSAnZWxlY3RyaWNDaGFyTGFuZ3VhZ2UnO1xuXHRjb25zdCBhdXRvQ2xvc2luZ0xhbmd1YWdlSWQgPSAnYXV0b0Nsb3NpbmdMYW5ndWFnZSc7XG5cblx0bGV0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRsZXQgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U7XG5cdGxldCBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2U7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gY3JlYXRlQ29kZUVkaXRvclNlcnZpY2VzKGRpc3Bvc2FibGVzKTtcblx0XHRsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRsYW5ndWFnZVNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxhbmd1YWdlU2VydmljZSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VTZXJ2aWNlLnJlZ2lzdGVyTGFuZ3VhZ2UoeyBpZDogc3Vycm91bmRpbmdMYW5ndWFnZUlkIH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5yZWdpc3RlcihzdXJyb3VuZGluZ0xhbmd1YWdlSWQsIHtcblx0XHRcdGF1dG9DbG9zaW5nUGFpcnM6IFt7IG9wZW46ICcoJywgY2xvc2U6ICcpJyB9XVxuXHRcdH0pKTtcblxuXHRcdHNldHVwSW5kZW50UnVsZXNMYW5ndWFnZShpbmRlbnRSdWxlc0xhbmd1YWdlSWQsIHtcblx0XHRcdGRlY3JlYXNlSW5kZW50UGF0dGVybjogL15cXHMqKCg/IVxcUy4qXFwvWypdKS4qWypdXFwvXFxzKik/W30pXFxdXXxeXFxzKihjYXNlXFxiLip8ZGVmYXVsdCk6XFxzKihcXC9cXC8uKnxcXC9bKl0uKlsqXVxcL1xccyopPyQvLFxuXHRcdFx0aW5jcmVhc2VJbmRlbnRQYXR0ZXJuOiAvXigoPyFcXC9cXC8pLikqKFxce1tefVwiJ2BdKnxcXChbXilcIiddKnxcXFtbXlxcXVwiJ10qfF5cXHMqKFxce1xcfXxcXChcXCl8XFxbXFxdfChjYXNlXFxiLip8ZGVmYXVsdCk6KSlcXHMqKFxcL1xcLy4qfFxcL1sqXS4qWypdXFwvXFxzKik/JC8sXG5cdFx0XHRpbmRlbnROZXh0TGluZVBhdHRlcm46IC9eXFxzKihmb3J8d2hpbGV8aWZ8ZWxzZSlcXGIoPyEuKls7e31dXFxzKihcXC9cXC8uKnxcXC9bKl0uKlsqXVxcL1xccyopPyQpLyxcblx0XHRcdHVuSW5kZW50ZWRMaW5lUGF0dGVybjogL14oPyEuKihbO3t9XXxcXFM6KVxccyooXFwvXFwvLip8XFwvWypdLipbKl1cXC9cXHMqKT8kKSg/IS4qKFxce1tefVwiJ10qfFxcKFteKVwiJ10qfFxcW1teXFxdXCInXSp8XlxccyooXFx7XFx9fFxcKFxcKXxcXFtcXF18KGNhc2VcXGIuKnxkZWZhdWx0KTopKVxccyooXFwvXFwvLip8XFwvWypdLipbKl1cXC9cXHMqKT8kKSg/IV5cXHMqKCg/IVxcUy4qXFwvWypdKS4qWypdXFwvXFxzKik/W30pXFxdXXxeXFxzKihjYXNlXFxiLip8ZGVmYXVsdCk6XFxzKihcXC9cXC8uKnxcXC9bKl0uKlsqXVxcL1xccyopPyQpKD8hXlxccyooZm9yfHdoaWxlfGlmfGVsc2UpXFxiKD8hLipbO3t9XVxccyooXFwvXFwvLip8XFwvWypdLipbKl1cXC9cXHMqKT8kKSkvXG5cdFx0fSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VTZXJ2aWNlLnJlZ2lzdGVyTGFuZ3VhZ2UoeyBpZDogZWxlY3RyaWNDaGFyTGFuZ3VhZ2VJZCB9KSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UucmVnaXN0ZXIoZWxlY3RyaWNDaGFyTGFuZ3VhZ2VJZCwge1xuXHRcdFx0X19lbGVjdHJpY0NoYXJhY3RlclN1cHBvcnQ6IHtcblx0XHRcdFx0ZG9jQ29tbWVudDogeyBvcGVuOiAnLyoqJywgY2xvc2U6ICcgKi8nIH1cblx0XHRcdH0sXG5cdFx0XHRicmFja2V0czogW1xuXHRcdFx0XHRbJ3snLCAnfSddLFxuXHRcdFx0XHRbJ1snLCAnXSddLFxuXHRcdFx0XHRbJygnLCAnKSddXG5cdFx0XHRdXG5cdFx0fSkpO1xuXG5cdFx0c2V0dXBBdXRvQ2xvc2luZ0xhbmd1YWdlKCk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGZ1bmN0aW9uIHNldHVwT25FbnRlckxhbmd1YWdlKGluZGVudEFjdGlvbjogSW5kZW50QWN0aW9uKTogc3RyaW5nIHtcblx0XHRjb25zdCBvbkVudGVyTGFuZ3VhZ2VJZCA9ICdvbkVudGVyTW9kZSc7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VTZXJ2aWNlLnJlZ2lzdGVyTGFuZ3VhZ2UoeyBpZDogb25FbnRlckxhbmd1YWdlSWQgfSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLnJlZ2lzdGVyKG9uRW50ZXJMYW5ndWFnZUlkLCB7XG5cdFx0XHRvbkVudGVyUnVsZXM6IFt7XG5cdFx0XHRcdGJlZm9yZVRleHQ6IC8uKi8sXG5cdFx0XHRcdGFjdGlvbjoge1xuXHRcdFx0XHRcdGluZGVudEFjdGlvbjogaW5kZW50QWN0aW9uXG5cdFx0XHRcdH1cblx0XHRcdH1dXG5cdFx0fSkpO1xuXHRcdHJldHVybiBvbkVudGVyTGFuZ3VhZ2VJZDtcblx0fVxuXG5cdGZ1bmN0aW9uIHNldHVwSW5kZW50UnVsZXNMYW5ndWFnZShsYW5ndWFnZUlkOiBzdHJpbmcsIGluZGVudGF0aW9uUnVsZXM6IEluZGVudGF0aW9uUnVsZSk6IHN0cmluZyB7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZS5yZWdpc3Rlckxhbmd1YWdlKHsgaWQ6IGxhbmd1YWdlSWQgfSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLnJlZ2lzdGVyKGxhbmd1YWdlSWQsIHtcblx0XHRcdGluZGVudGF0aW9uUnVsZXM6IGluZGVudGF0aW9uUnVsZXNcblx0XHR9KSk7XG5cdFx0cmV0dXJuIGxhbmd1YWdlSWQ7XG5cdH1cblxuXHRmdW5jdGlvbiBzZXR1cEF1dG9DbG9zaW5nTGFuZ3VhZ2UoKSB7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZS5yZWdpc3Rlckxhbmd1YWdlKHsgaWQ6IGF1dG9DbG9zaW5nTGFuZ3VhZ2VJZCB9KSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UucmVnaXN0ZXIoYXV0b0Nsb3NpbmdMYW5ndWFnZUlkLCB7XG5cdFx0XHRjb21tZW50czoge1xuXHRcdFx0XHRibG9ja0NvbW1lbnQ6IFsnLyonLCAnKi8nXVxuXHRcdFx0fSxcblx0XHRcdGF1dG9DbG9zaW5nUGFpcnM6IFtcblx0XHRcdFx0eyBvcGVuOiAneycsIGNsb3NlOiAnfScgfSxcblx0XHRcdFx0eyBvcGVuOiAnWycsIGNsb3NlOiAnXScgfSxcblx0XHRcdFx0eyBvcGVuOiAnKCcsIGNsb3NlOiAnKScgfSxcblx0XHRcdFx0eyBvcGVuOiAnXFwnJywgY2xvc2U6ICdcXCcnLCBub3RJbjogWydzdHJpbmcnLCAnY29tbWVudCddIH0sXG5cdFx0XHRcdHsgb3BlbjogJ1xcXCInLCBjbG9zZTogJ1xcXCInLCBub3RJbjogWydzdHJpbmcnXSB9LFxuXHRcdFx0XHR7IG9wZW46ICdgJywgY2xvc2U6ICdgJywgbm90SW46IFsnc3RyaW5nJywgJ2NvbW1lbnQnXSB9LFxuXHRcdFx0XHR7IG9wZW46ICcvKionLCBjbG9zZTogJyAqLycsIG5vdEluOiBbJ3N0cmluZyddIH0sXG5cdFx0XHRcdHsgb3BlbjogJ2JlZ2luJywgY2xvc2U6ICdlbmQnLCBub3RJbjogWydzdHJpbmcnXSB9XG5cdFx0XHRdLFxuXHRcdFx0X19lbGVjdHJpY0NoYXJhY3RlclN1cHBvcnQ6IHtcblx0XHRcdFx0ZG9jQ29tbWVudDogeyBvcGVuOiAnLyoqJywgY2xvc2U6ICcgKi8nIH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRmdW5jdGlvbiBzZXR1cEF1dG9DbG9zaW5nTGFuZ3VhZ2VUb2tlbml6YXRpb24oKSB7XG5cdFx0Y2xhc3MgQmFzZVN0YXRlIGltcGxlbWVudHMgSVN0YXRlIHtcblx0XHRcdGNvbnN0cnVjdG9yKFxuXHRcdFx0XHRwdWJsaWMgcmVhZG9ubHkgcGFyZW50OiBTdGF0ZSB8IG51bGwgPSBudWxsXG5cdFx0XHQpIHsgfVxuXHRcdFx0Y2xvbmUoKTogSVN0YXRlIHsgcmV0dXJuIHRoaXM7IH1cblx0XHRcdGVxdWFscyhvdGhlcjogSVN0YXRlKTogYm9vbGVhbiB7XG5cdFx0XHRcdGlmICghKG90aGVyIGluc3RhbmNlb2YgQmFzZVN0YXRlKSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIXRoaXMucGFyZW50ICYmICFvdGhlci5wYXJlbnQpIHtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIXRoaXMucGFyZW50IHx8ICFvdGhlci5wYXJlbnQpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoaXMucGFyZW50LmVxdWFscyhvdGhlci5wYXJlbnQpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRjbGFzcyBTdHJpbmdTdGF0ZSBpbXBsZW1lbnRzIElTdGF0ZSB7XG5cdFx0XHRjb25zdHJ1Y3Rvcihcblx0XHRcdFx0cHVibGljIHJlYWRvbmx5IGNoYXI6IHN0cmluZyxcblx0XHRcdFx0cHVibGljIHJlYWRvbmx5IHBhcmVudFN0YXRlOiBTdGF0ZVxuXHRcdFx0KSB7IH1cblx0XHRcdGNsb25lKCk6IElTdGF0ZSB7IHJldHVybiB0aGlzOyB9XG5cdFx0XHRlcXVhbHMob3RoZXI6IElTdGF0ZSk6IGJvb2xlYW4geyByZXR1cm4gb3RoZXIgaW5zdGFuY2VvZiBTdHJpbmdTdGF0ZSAmJiB0aGlzLmNoYXIgPT09IG90aGVyLmNoYXIgJiYgdGhpcy5wYXJlbnRTdGF0ZS5lcXVhbHMob3RoZXIucGFyZW50U3RhdGUpOyB9XG5cdFx0fVxuXHRcdGNsYXNzIEJsb2NrQ29tbWVudFN0YXRlIGltcGxlbWVudHMgSVN0YXRlIHtcblx0XHRcdGNvbnN0cnVjdG9yKFxuXHRcdFx0XHRwdWJsaWMgcmVhZG9ubHkgcGFyZW50U3RhdGU6IFN0YXRlXG5cdFx0XHQpIHsgfVxuXHRcdFx0Y2xvbmUoKTogSVN0YXRlIHsgcmV0dXJuIHRoaXM7IH1cblx0XHRcdGVxdWFscyhvdGhlcjogSVN0YXRlKTogYm9vbGVhbiB7IHJldHVybiBvdGhlciBpbnN0YW5jZW9mIFN0cmluZ1N0YXRlICYmIHRoaXMucGFyZW50U3RhdGUuZXF1YWxzKG90aGVyLnBhcmVudFN0YXRlKTsgfVxuXHRcdH1cblx0XHR0eXBlIFN0YXRlID0gQmFzZVN0YXRlIHwgU3RyaW5nU3RhdGUgfCBCbG9ja0NvbW1lbnRTdGF0ZTtcblxuXHRcdGNvbnN0IGVuY29kZWRMYW5ndWFnZUlkID0gbGFuZ3VhZ2VTZXJ2aWNlLmxhbmd1YWdlSWRDb2RlYy5lbmNvZGVMYW5ndWFnZUlkKGF1dG9DbG9zaW5nTGFuZ3VhZ2VJZCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKFRva2VuaXphdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyKGF1dG9DbG9zaW5nTGFuZ3VhZ2VJZCwge1xuXHRcdFx0Z2V0SW5pdGlhbFN0YXRlOiAoKSA9PiBuZXcgQmFzZVN0YXRlKCksXG5cdFx0XHR0b2tlbml6ZTogdW5kZWZpbmVkISxcblx0XHRcdHRva2VuaXplRW5jb2RlZDogZnVuY3Rpb24gKGxpbmU6IHN0cmluZywgaGFzRU9MOiBib29sZWFuLCBfc3RhdGU6IElTdGF0ZSk6IEVuY29kZWRUb2tlbml6YXRpb25SZXN1bHQge1xuXHRcdFx0XHRsZXQgc3RhdGUgPSA8U3RhdGU+X3N0YXRlO1xuXHRcdFx0XHRjb25zdCB0b2tlbnM6IHsgbGVuZ3RoOiBudW1iZXI7IHR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlIH1bXSA9IFtdO1xuXHRcdFx0XHRjb25zdCBnZW5lcmF0ZVRva2VuID0gKGxlbmd0aDogbnVtYmVyLCB0eXBlOiBTdGFuZGFyZFRva2VuVHlwZSwgbmV3U3RhdGU/OiBTdGF0ZSkgPT4ge1xuXHRcdFx0XHRcdGlmICh0b2tlbnMubGVuZ3RoID4gMCAmJiB0b2tlbnNbdG9rZW5zLmxlbmd0aCAtIDFdLnR5cGUgPT09IHR5cGUpIHtcblx0XHRcdFx0XHRcdC8vIGdyb3cgbGFzdCB0b2tlbnNcblx0XHRcdFx0XHRcdHRva2Vuc1t0b2tlbnMubGVuZ3RoIC0gMV0ubGVuZ3RoICs9IGxlbmd0aDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dG9rZW5zLnB1c2goeyBsZW5ndGgsIHR5cGUgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGxpbmUgPSBsaW5lLnN1YnN0cmluZyhsZW5ndGgpO1xuXHRcdFx0XHRcdGlmIChuZXdTdGF0ZSkge1xuXHRcdFx0XHRcdFx0c3RhdGUgPSBuZXdTdGF0ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHRcdHdoaWxlIChsaW5lLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRhZHZhbmNlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gbmV3IFVpbnQzMkFycmF5KHRva2Vucy5sZW5ndGggKiAyKTtcblx0XHRcdFx0bGV0IHN0YXJ0SW5kZXggPSAwO1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRva2Vucy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdHJlc3VsdFsyICogaV0gPSBzdGFydEluZGV4O1xuXHRcdFx0XHRcdHJlc3VsdFsyICogaSArIDFdID0gKFxuXHRcdFx0XHRcdFx0KGVuY29kZWRMYW5ndWFnZUlkIDw8IE1ldGFkYXRhQ29uc3RzLkxBTkdVQUdFSURfT0ZGU0VUKVxuXHRcdFx0XHRcdFx0fCAodG9rZW5zW2ldLnR5cGUgPDwgTWV0YWRhdGFDb25zdHMuVE9LRU5fVFlQRV9PRkZTRVQpXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRzdGFydEluZGV4ICs9IHRva2Vuc1tpXS5sZW5ndGg7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG5ldyBFbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0KHJlc3VsdCwgc3RhdGUpO1xuXG5cdFx0XHRcdGZ1bmN0aW9uIGFkdmFuY2UoKTogdm9pZCB7XG5cdFx0XHRcdFx0aWYgKHN0YXRlIGluc3RhbmNlb2YgQmFzZVN0YXRlKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBtMSA9IGxpbmUubWF0Y2goL15bXidcImB7fS9dKy9nKTtcblx0XHRcdFx0XHRcdGlmIChtMSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZ2VuZXJhdGVUb2tlbihtMVswXS5sZW5ndGgsIFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICgvXlsnXCJgXS8udGVzdChsaW5lKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZ2VuZXJhdGVUb2tlbigxLCBTdGFuZGFyZFRva2VuVHlwZS5TdHJpbmcsIG5ldyBTdHJpbmdTdGF0ZShsaW5lLmNoYXJBdCgwKSwgc3RhdGUpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICgvXnsvLnRlc3QobGluZSkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGdlbmVyYXRlVG9rZW4oMSwgU3RhbmRhcmRUb2tlblR5cGUuT3RoZXIsIG5ldyBCYXNlU3RhdGUoc3RhdGUpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICgvXn0vLnRlc3QobGluZSkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGdlbmVyYXRlVG9rZW4oMSwgU3RhbmRhcmRUb2tlblR5cGUuT3RoZXIsIHN0YXRlLnBhcmVudCB8fCBuZXcgQmFzZVN0YXRlKCkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKC9eXFwvXFwvLy50ZXN0KGxpbmUpKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBnZW5lcmF0ZVRva2VuKGxpbmUubGVuZ3RoLCBTdGFuZGFyZFRva2VuVHlwZS5Db21tZW50LCBzdGF0ZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoL15cXC9cXCovLnRlc3QobGluZSkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGdlbmVyYXRlVG9rZW4oMiwgU3RhbmRhcmRUb2tlblR5cGUuQ29tbWVudCwgbmV3IEJsb2NrQ29tbWVudFN0YXRlKHN0YXRlKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm4gZ2VuZXJhdGVUb2tlbigxLCBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciwgc3RhdGUpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoc3RhdGUgaW5zdGFuY2VvZiBTdHJpbmdTdGF0ZSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgbTEgPSBsaW5lLm1hdGNoKC9eW15cXFxcJ1wiYFxcJF0rL2cpO1xuXHRcdFx0XHRcdFx0aWYgKG0xKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBnZW5lcmF0ZVRva2VuKG0xWzBdLmxlbmd0aCwgU3RhbmRhcmRUb2tlblR5cGUuU3RyaW5nKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICgvXlxcXFwvLnRlc3QobGluZSkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGdlbmVyYXRlVG9rZW4oMiwgU3RhbmRhcmRUb2tlblR5cGUuU3RyaW5nKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChsaW5lLmNoYXJBdCgwKSA9PT0gc3RhdGUuY2hhcikge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZ2VuZXJhdGVUb2tlbigxLCBTdGFuZGFyZFRva2VuVHlwZS5TdHJpbmcsIHN0YXRlLnBhcmVudFN0YXRlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICgvXlxcJFxcey8udGVzdChsaW5lKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZ2VuZXJhdGVUb2tlbigyLCBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciwgbmV3IEJhc2VTdGF0ZShzdGF0ZSkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIGdlbmVyYXRlVG9rZW4oMSwgU3RhbmRhcmRUb2tlblR5cGUuT3RoZXIsIHN0YXRlKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHN0YXRlIGluc3RhbmNlb2YgQmxvY2tDb21tZW50U3RhdGUpIHtcblx0XHRcdFx0XHRcdGNvbnN0IG0xID0gbGluZS5tYXRjaCgvXlteKl0rL2cpO1xuXHRcdFx0XHRcdFx0aWYgKG0xKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBnZW5lcmF0ZVRva2VuKG0xWzBdLmxlbmd0aCwgU3RhbmRhcmRUb2tlblR5cGUuU3RyaW5nKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICgvXlxcKlxcLy8udGVzdChsaW5lKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZ2VuZXJhdGVUb2tlbigyLCBTdGFuZGFyZFRva2VuVHlwZS5Db21tZW50LCBzdGF0ZS5wYXJlbnRTdGF0ZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm4gZ2VuZXJhdGVUb2tlbigxLCBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciwgc3RhdGUpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYHVua25vd24gc3RhdGVgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRmdW5jdGlvbiBzZXRBdXRvQ2xvc2luZ0xhbmd1YWdlRW5hYmxlZFNldChjaGFyczogc3RyaW5nKTogdm9pZCB7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UucmVnaXN0ZXIoYXV0b0Nsb3NpbmdMYW5ndWFnZUlkLCB7XG5cdFx0XHRhdXRvQ2xvc2VCZWZvcmU6IGNoYXJzLFxuXHRcdFx0YXV0b0Nsb3NpbmdQYWlyczogW1xuXHRcdFx0XHR7IG9wZW46ICd7JywgY2xvc2U6ICd9JyB9LFxuXHRcdFx0XHR7IG9wZW46ICdbJywgY2xvc2U6ICddJyB9LFxuXHRcdFx0XHR7IG9wZW46ICcoJywgY2xvc2U6ICcpJyB9LFxuXHRcdFx0XHR7IG9wZW46ICdcXCcnLCBjbG9zZTogJ1xcJycsIG5vdEluOiBbJ3N0cmluZycsICdjb21tZW50J10gfSxcblx0XHRcdFx0eyBvcGVuOiAnXFxcIicsIGNsb3NlOiAnXFxcIicsIG5vdEluOiBbJ3N0cmluZyddIH0sXG5cdFx0XHRcdHsgb3BlbjogJ2AnLCBjbG9zZTogJ2AnLCBub3RJbjogWydzdHJpbmcnLCAnY29tbWVudCddIH0sXG5cdFx0XHRcdHsgb3BlbjogJy8qKicsIGNsb3NlOiAnICovJywgbm90SW46IFsnc3RyaW5nJ10gfVxuXHRcdFx0XSxcblx0XHR9KSk7XG5cdH1cblxuXHRmdW5jdGlvbiBjcmVhdGVUZXh0TW9kZWwodGV4dDogc3RyaW5nLCBsYW5ndWFnZUlkOiBzdHJpbmcgfCBudWxsID0gbnVsbCwgb3B0aW9uczogSVJlbGF4ZWRUZXh0TW9kZWxDcmVhdGlvbk9wdGlvbnMgPSBUZXh0TW9kZWwuREVGQVVMVF9DUkVBVElPTl9PUFRJT05TLCB1cmk6IFVSSSB8IG51bGwgPSBudWxsKTogVGV4dE1vZGVsIHtcblx0XHRyZXR1cm4gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCB0ZXh0LCBsYW5ndWFnZUlkLCBvcHRpb25zLCB1cmkpKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHdpdGhUZXN0Q29kZUVkaXRvcih0ZXh0OiBJVGV4dE1vZGVsIHwgc3RyaW5nIHwgc3RyaW5nW10sIG9wdGlvbnM6IFRlc3RDb2RlRWRpdG9ySW5zdGFudGlhdGlvbk9wdGlvbnMsIGNhbGxiYWNrOiAoZWRpdG9yOiBJVGVzdENvZGVFZGl0b3IsIHZpZXdNb2RlbDogVmlld01vZGVsKSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0bGV0IG1vZGVsOiBJVGV4dE1vZGVsO1xuXHRcdGlmICh0eXBlb2YgdGV4dCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKHRleHQpO1xuXHRcdH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheSh0ZXh0KSkge1xuXHRcdFx0bW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwodGV4dC5qb2luKCdcXG4nKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG1vZGVsID0gdGV4dDtcblx0XHR9XG5cdFx0Y29uc3QgZWRpdG9yID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGVzdENvZGVFZGl0b3IoaW5zdGFudGlhdGlvblNlcnZpY2UsIG1vZGVsLCBvcHRpb25zKSk7XG5cdFx0Y29uc3Qgdmlld01vZGVsID0gZWRpdG9yLmdldFZpZXdNb2RlbCgpITtcblx0XHR2aWV3TW9kZWwuc2V0SGFzRm9jdXModHJ1ZSk7XG5cdFx0Y2FsbGJhY2soZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHR9XG5cblx0aW50ZXJmYWNlIElDdXJzb3JPcHRzIHtcblx0XHR0ZXh0OiBzdHJpbmdbXTtcblx0XHRsYW5ndWFnZUlkPzogc3RyaW5nIHwgbnVsbDtcblx0XHRtb2RlbE9wdHM/OiBJUmVsYXhlZFRleHRNb2RlbENyZWF0aW9uT3B0aW9ucztcblx0XHRlZGl0b3JPcHRzPzogSUVkaXRvck9wdGlvbnM7XG5cdH1cblxuXHRmdW5jdGlvbiB1c2luZ0N1cnNvcihvcHRzOiBJQ3Vyc29yT3B0cywgY2FsbGJhY2s6IChlZGl0b3I6IElUZXN0Q29kZUVkaXRvciwgbW9kZWw6IFRleHRNb2RlbCwgdmlld01vZGVsOiBWaWV3TW9kZWwpID0+IHZvaWQpOiB2b2lkIHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChvcHRzLnRleHQuam9pbignXFxuJyksIG9wdHMubGFuZ3VhZ2VJZCwgb3B0cy5tb2RlbE9wdHMpO1xuXHRcdGNvbnN0IGVkaXRvck9wdGlvbnM6IFRlc3RDb2RlRWRpdG9ySW5zdGFudGlhdGlvbk9wdGlvbnMgPSBvcHRzLmVkaXRvck9wdHMgfHwge307XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCBlZGl0b3JPcHRpb25zLCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGNhbGxiYWNrKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCk7XG5cdFx0fSk7XG5cdH1cblxuXHRjb25zdCBlbnVtIEF1dG9DbG9zaW5nQ29sdW1uVHlwZSB7XG5cdFx0Tm9ybWFsID0gMCxcblx0XHRTcGVjaWFsMSA9IDEsXG5cdFx0U3BlY2lhbDIgPSAyXG5cdH1cblxuXHRmdW5jdGlvbiBleHRyYWN0QXV0b0Nsb3NpbmdTcGVjaWFsQ29sdW1ucyhtYXhDb2x1bW46IG51bWJlciwgYW5ub3RhdGVkTGluZTogc3RyaW5nKTogQXV0b0Nsb3NpbmdDb2x1bW5UeXBlW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogQXV0b0Nsb3NpbmdDb2x1bW5UeXBlW10gPSBbXTtcblx0XHRmb3IgKGxldCBqID0gMTsgaiA8PSBtYXhDb2x1bW47IGorKykge1xuXHRcdFx0cmVzdWx0W2pdID0gQXV0b0Nsb3NpbmdDb2x1bW5UeXBlLk5vcm1hbDtcblx0XHR9XG5cdFx0bGV0IGNvbHVtbiA9IDE7XG5cdFx0Zm9yIChsZXQgaiA9IDA7IGogPCBhbm5vdGF0ZWRMaW5lLmxlbmd0aDsgaisrKSB7XG5cdFx0XHRpZiAoYW5ub3RhdGVkTGluZS5jaGFyQXQoaikgPT09ICd8Jykge1xuXHRcdFx0XHRyZXN1bHRbY29sdW1uXSA9IEF1dG9DbG9zaW5nQ29sdW1uVHlwZS5TcGVjaWFsMTtcblx0XHRcdH0gZWxzZSBpZiAoYW5ub3RhdGVkTGluZS5jaGFyQXQoaikgPT09ICchJykge1xuXHRcdFx0XHRyZXN1bHRbY29sdW1uXSA9IEF1dG9DbG9zaW5nQ29sdW1uVHlwZS5TcGVjaWFsMjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbHVtbisrO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0ZnVuY3Rpb24gYXNzZXJ0VHlwZShlZGl0b3I6IElUZXN0Q29kZUVkaXRvciwgbW9kZWw6IElUZXh0TW9kZWwsIHZpZXdNb2RlbDogVmlld01vZGVsLCBsaW5lTnVtYmVyOiBudW1iZXIsIGNvbHVtbjogbnVtYmVyLCBjaHI6IHN0cmluZywgZXhwZWN0ZWRJbnNlcnQ6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgbGluZUNvbnRlbnQgPSBtb2RlbC5nZXRMaW5lQ29udGVudChsaW5lTnVtYmVyKTtcblx0XHRjb25zdCBleHBlY3RlZCA9IGxpbmVDb250ZW50LnN1YnN0cigwLCBjb2x1bW4gLSAxKSArIGV4cGVjdGVkSW5zZXJ0ICsgbGluZUNvbnRlbnQuc3Vic3RyKGNvbHVtbiAtIDEpO1xuXHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgbGluZU51bWJlciwgY29sdW1uKTtcblx0XHR2aWV3TW9kZWwudHlwZShjaHIsICdrZXlib2FyZCcpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQobGluZU51bWJlciksIGV4cGVjdGVkLCBtZXNzYWdlKTtcblx0XHRtb2RlbC51bmRvKCk7XG5cdH1cblxuXHR0ZXN0KCdpc3N1ZSBtaWNyb3NvZnQvbW9uYWNvLWVkaXRvciM0NDM6IEluZGVudGF0aW9uIG9mIGEgc2luZ2xlIHJvdyBkZWxldGVzIHNlbGVjdGVkIHRleHQgaW4gc29tZSBjYXNlcycsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFtcblx0XHRcdFx0J0hlbGxvIHdvcmxkIScsXG5cdFx0XHRcdCdhbm90aGVyIGxpbmUnXG5cdFx0XHRdLmpvaW4oJ1xcbicpLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0e1xuXHRcdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlXG5cdFx0XHR9LFxuXHRcdCk7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEzKV0pO1xuXG5cdFx0XHQvLyBDaGVjayB0aGF0IGluZGVudGluZyBtYWludGFpbnMgdGhlIHNlbGVjdGlvbiBzdGFydCBhdCBjb2x1bW4gMVxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5UYWIucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0U2VsZWN0aW9uKCksIG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMTQpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnQnVnIDkxMjE6IEF1dG8gaW5kZW50ICsgdW5kbyArIHJlZG8gaXMgZnVua3knLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCcnXG5cdFx0XHRdLmpvaW4oJ1xcbicpLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0e1xuXHRcdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlLFxuXHRcdFx0XHR0cmltQXV0b1doaXRlc3BhY2U6IGZhbHNlXG5cdFx0XHR9LFxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcXG4nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1xcbicsICdhc3NlcnQxJyk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuVGFiLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1xcblxcdCcsICdhc3NlcnQyJyk7XG5cblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcXG4nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1xcblxcdFxcblxcdCcsICdhc3NlcnQzJyk7XG5cblx0XHRcdHZpZXdNb2RlbC50eXBlKCd4Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICdcXG5cXHRcXG5cXHR4JywgJ2Fzc2VydDQnKTtcblxuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JMZWZ0LnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnXFxuXFx0XFxuXFx0eCcsICdhc3NlcnQ1Jyk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICdcXG5cXHRcXG54JywgJ2Fzc2VydDYnKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1xcblxcdHgnLCAnYXNzZXJ0NycpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnXFxueCcsICdhc3NlcnQ4Jyk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICd4JywgJ2Fzc2VydDknKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1xcbngnLCAnYXNzZXJ0MTAnKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1xcblxcdFxcbngnLCAnYXNzZXJ0MTEnKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1xcblxcdFxcblxcdHgnLCAnYXNzZXJ0MTInKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5SZWRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1xcblxcdFxcbngnLCAnYXNzZXJ0MTMnKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5SZWRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1xcbngnLCAnYXNzZXJ0MTQnKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5SZWRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ3gnLCAnYXNzZXJ0MTUnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzIzNTM5OiBTZXR0aW5nIG1vZGVsIEVPTCBpc25cXCd0IHVuZG9hYmxlJywgKCkgPT4ge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnSGVsbG8nLFxuXHRcdFx0J3dvcmxkJ1xuXHRcdF0sIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCkhO1xuXG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXHRcdFx0bW9kZWwuc2V0RU9MKEVuZE9mTGluZVNlcXVlbmNlLkxGKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnSGVsbG9cXG53b3JsZCcpO1xuXG5cdFx0XHRtb2RlbC5wdXNoRU9MKEVuZE9mTGluZVNlcXVlbmNlLkNSTEYpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdIZWxsb1xcclxcbndvcmxkJyk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuVW5kby5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ0hlbGxvXFxud29ybGQnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzQ3NzMzOiBVbmRvIG1hbmdsZXMgdW5pY29kZSBjaGFyYWN0ZXJzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxhbmd1YWdlSWQgPSAnbXlNb2RlJztcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZVNlcnZpY2UucmVnaXN0ZXJMYW5ndWFnZSh7IGlkOiBsYW5ndWFnZUlkIH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5yZWdpc3RlcihsYW5ndWFnZUlkLCB7XG5cdFx0XHRzdXJyb3VuZGluZ1BhaXJzOiBbeyBvcGVuOiAnJScsIGNsb3NlOiAnJScgfV1cblx0XHR9KSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnXFwnXHVEODNEXHVEQzQxXFwnJywgbGFuZ3VhZ2VJZCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCAyKSk7XG5cblx0XHRcdHZpZXdNb2RlbC50eXBlKCclJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICclXFwnJVx1RDgzRFx1REM0MVxcJycsICdhc3NlcnQxJyk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuVW5kby5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICdcXCdcdUQ4M0RcdURDNDFcXCcnLCAnYXNzZXJ0MicpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNDYyMDg6IEFsbG93IGVtcHR5IHNlbGVjdGlvbnMgaW4gdGhlIHVuZG8vcmVkbyBzdGFjaycsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnJyk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdIZWxsbycsICdrZXlib2FyZCcpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJyAnLCAna2V5Ym9hcmQnKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCd3b3JsZCcsICdrZXlib2FyZCcpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJyAnLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ0hlbGxvIHdvcmxkICcpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDEzKSk7XG5cblx0XHRcdG1vdmVMZWZ0KGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdG1vdmVSaWdodChlZGl0b3IsIHZpZXdNb2RlbCk7XG5cblx0XHRcdG1vZGVsLnB1c2hFZGl0T3BlcmF0aW9ucyhbXSwgW0VkaXRPcGVyYXRpb24ucmVwbGFjZU1vdmUobmV3IFJhbmdlKDEsIDEyLCAxLCAxMyksICcnKV0sICgpID0+IFtdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ0hlbGxvIHdvcmxkJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMTIpKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ0hlbGxvIHdvcmxkICcpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCAxMywgMSwgMTMpKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ0hlbGxvIHdvcmxkJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMTIpKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ0hlbGxvJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgNikpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlJlZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnSGVsbG8nKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigxLCA2KSk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuUmVkby5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdIZWxsbyB3b3JsZCcpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDEyKSk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuUmVkby5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdIZWxsbyB3b3JsZCAnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigxLCAxMykpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlJlZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnSGVsbG8gd29ybGQnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigxLCAxMikpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlJlZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnSGVsbG8gd29ybGQnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigxLCAxMikpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdidWcgIzE2ODE1OlNoaWZ0K1RhYiBkb2VzblxcJ3QgZ28gYmFjayB0byB0YWJzdG9wJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxhbmd1YWdlSWQgPSBzZXR1cE9uRW50ZXJMYW5ndWFnZShJbmRlbnRBY3Rpb24uSW5kZW50T3V0ZGVudCk7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCcgICAgIGZ1bmN0aW9uIGJheigpIHsnXG5cdFx0XHRdLmpvaW4oJ1xcbicpLFxuXHRcdFx0bGFuZ3VhZ2VJZFxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgNiwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCA2LCAxLCA2KSk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuT3V0ZGVudC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICcgICAgZnVuY3Rpb24gYmF6KCkgeycpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCA1LCAxLCA1KSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0J1ZyAjMTgyOTM6W3JlZ3Jlc3Npb25dW2VkaXRvcl0gQ2FuXFwndCBvdXRkZW50IHdoaXRlc3BhY2UgbGluZScsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFtcblx0XHRcdFx0JyAgICAgICdcblx0XHRcdF0uam9pbignXFxuJylcblx0XHQpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDcsIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgNywgMSwgNykpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLk91dGRlbnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnICAgICcpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCA1LCAxLCA1KSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM5NTU5MTogVW5pbmRlbnRpbmcgbW92ZXMgY3Vyc29yIHRvIGJlZ2lubmluZyBvZiBsaW5lJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnICAgICAgICAnXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyB1c2VUYWJTdG9wczogZmFsc2UgfSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDksIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgOSwgMSwgOSkpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLk91dGRlbnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnICAgICcpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCA1LCAxLCA1KSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0J1ZyAjMTY2NTc6IFtlZGl0b3JdIFRhYiBvbiBlbXB0eSBsaW5lIG9mIHplcm8gaW5kZW50YXRpb24gbW92ZXMgY3Vyc29yIHRvIHBvc2l0aW9uICgxLDEpJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnZnVuY3Rpb24gYmF6KCkgeycsXG5cdFx0XHRcdCdcXHRmdW5jdGlvbiBoZWxsbygpIHsgLy8gc29tZXRoaW5nIGhlcmUnLFxuXHRcdFx0XHQnXFx0Jyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCdcXHR9Jyxcblx0XHRcdFx0J30nLFxuXHRcdFx0XHQnJ1xuXHRcdFx0XS5qb2luKCdcXG4nKSxcblx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdHtcblx0XHRcdFx0aW5zZXJ0U3BhY2VzOiBmYWxzZSxcblx0XHRcdH0sXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCA3LCAxLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDcsIDEsIDcsIDEpKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5UYWIucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDcpLCAnXFx0Jyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDcsIDIsIDcsIDIpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnYnVnICMxNjc0MDogW2VkaXRvcl0gQ3V0IGxpbmUgZG9lc25cXCd0IHF1aXRlIGN1dCB0aGUgbGFzdCBsaW5lJywgKCkgPT4ge1xuXG5cdFx0Ly8gUGFydCAxID0+IHRoZXJlIGlzIHRleHQgb24gdGhlIGxhc3QgbGluZVxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnYXNkYXNkJyxcblx0XHRcdCdxd2VydHknXG5cdFx0XSwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMiwgMSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigyLCAxLCAyLCAxKSk7XG5cblx0XHRcdHZpZXdNb2RlbC5jdXQoJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvdW50KCksIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnYXNkYXNkJyk7XG5cblx0XHR9KTtcblxuXHRcdC8vIFBhcnQgMiA9PiB0aGVyZSBpcyBubyB0ZXh0IG9uIHRoZSBsYXN0IGxpbmVcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0J2FzZGFzZCcsXG5cdFx0XHQnJ1xuXHRcdF0sIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCkhO1xuXG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDIsIDEsIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgMSkpO1xuXG5cdFx0XHR2aWV3TW9kZWwuY3V0KCdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb3VudCgpLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ2FzZGFzZCcpO1xuXG5cdFx0XHR2aWV3TW9kZWwuY3V0KCdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb3VudCgpLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJycpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTI4NjAyOiBXaGVuIGN1dHRpbmcgbXVsdGlwbGUgbGluZXMgKGN0cmwgeCksIHRoZSBsYXN0IGxpbmUgd2lsbCBub3QgYmUgZXJhc2VkJywgKCkgPT4ge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnYTEnLFxuXHRcdFx0J2EyJyxcblx0XHRcdCdhMydcblx0XHRdLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpITtcblxuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgMSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMywgMSwgMywgMSksXG5cdFx0XHRdKTtcblxuXHRcdFx0dmlld01vZGVsLmN1dCgna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ291bnQoKSwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICcnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnQnVnICMxMTQ3NjogRG91YmxlIGJyYWNrZXQgc3Vycm91bmRpbmcgKyB1bmRvIGlzIGJyb2tlbicsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCdoZWxsbydcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBzdXJyb3VuZGluZ0xhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDMsIGZhbHNlKTtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgNSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDUpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJygnLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNikpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnKCcsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCA1LCAxLCA3KSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMTQwOiBCYWNrc3BhY2Ugc3RvcHMgcHJlbWF0dXJlbHknLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCdmdW5jdGlvbiBiYXooKSB7Jyxcblx0XHRcdFx0JyAgcmV0dXJuIDE7Jyxcblx0XHRcdFx0J307J1xuXHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMywgMiwgZmFsc2UpO1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCAxNCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDMsIDIsIDEsIDE0KSk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDE0LCAxLCAxNCkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb3VudCgpLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ2Z1bmN0aW9uIGJheig7Jyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMDIxMjogUGFzdGluZyBlbnRpcmUgbGluZSBkb2VzIG5vdCByZXBsYWNlIHNlbGVjdGlvbicsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCdsaW5lMScsXG5cdFx0XHRcdCdsaW5lMidcblx0XHRcdF0sXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAyLCAxLCBmYWxzZSk7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDIsIDYsIHRydWUpO1xuXG5cdFx0XHR2aWV3TW9kZWwucGFzdGUoJ2xpbmUxXFxuJywgdHJ1ZSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ2xpbmUxJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICdsaW5lMScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM3NDcyMjogUGFzdGluZyB3aG9sZSBsaW5lIGRvZXMgbm90IHJlcGxhY2Ugc2VsZWN0aW9uJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J2xpbmUxJyxcblx0XHRcdFx0J2xpbmUgc2VsIDInLFxuXHRcdFx0XHQnbGluZTMnXG5cdFx0XHRdLFxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMiwgNiwgMiwgOSldKTtcblxuXHRcdFx0dmlld01vZGVsLnBhc3RlKCdsaW5lMVxcbicsIHRydWUpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdsaW5lMScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnbGluZSBsaW5lMScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnIDInKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg0KSwgJ2xpbmUzJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM0OTk2OiBNdWx0aXBsZSBjdXJzb3IgcGFzdGUgcGFzdGVzIGNvbnRlbnRzIG9mIGFsbCBjdXJzb3JzJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J2xpbmUxJyxcblx0XHRcdFx0J2xpbmUyJyxcblx0XHRcdFx0J2xpbmUzJ1xuXHRcdFx0XSxcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpLCBuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDEpXSk7XG5cblx0XHRcdHZpZXdNb2RlbC5wYXN0ZShcblx0XHRcdFx0J2FcXG5iXFxuY1xcbmQnLFxuXHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCdhXFxuYicsXG5cdFx0XHRcdFx0J2NcXG5kJ1xuXHRcdFx0XHRdXG5cdFx0XHQpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnYScsXG5cdFx0XHRcdCdibGluZTEnLFxuXHRcdFx0XHQnYycsXG5cdFx0XHRcdCdkbGluZTInLFxuXHRcdFx0XHQnbGluZTMnXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE2MTU1OiBQYXN0ZSBpbnRvIG11bHRpcGxlIGN1cnNvcnMgaGFzIGVkZ2UgY2FzZSB3aGVuIG51bWJlciBvZiBsaW5lcyBlcXVhbHMgbnVtYmVyIG9mIGN1cnNvcnMgLSAxJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J3Rlc3QnLFxuXHRcdFx0XHQndGVzdCcsXG5cdFx0XHRcdCd0ZXN0Jyxcblx0XHRcdFx0J3Rlc3QnXG5cdFx0XHRdLFxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDUpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDUpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDEsIDMsIDUpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDQsIDEsIDQsIDUpLFxuXHRcdFx0XSk7XG5cblx0XHRcdHZpZXdNb2RlbC5wYXN0ZShcblx0XHRcdFx0J2FhYVxcbmJiYlxcbmNjY1xcbicsXG5cdFx0XHRcdGZhbHNlLFxuXHRcdFx0XHRudWxsXG5cdFx0XHQpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnYWFhJyxcblx0XHRcdFx0J2JiYicsXG5cdFx0XHRcdCdjY2MnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0J2FhYScsXG5cdFx0XHRcdCdiYmInLFxuXHRcdFx0XHQnY2NjJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCdhYWEnLFxuXHRcdFx0XHQnYmJiJyxcblx0XHRcdFx0J2NjYycsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnYWFhJyxcblx0XHRcdFx0J2JiYicsXG5cdFx0XHRcdCdjY2MnLFxuXHRcdFx0XHQnJyxcblx0XHRcdF0uam9pbignXFxuJykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNDM3MjI6IE11bHRpbGluZSBwYXN0ZSBkb2VzblxcJ3Qgd29yayBhbnltb3JlJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J3Rlc3QnLFxuXHRcdFx0XHQndGVzdCcsXG5cdFx0XHRcdCd0ZXN0Jyxcblx0XHRcdFx0J3Rlc3QnXG5cdFx0XHRdLFxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDUpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDUpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDEsIDMsIDUpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDQsIDEsIDQsIDUpLFxuXHRcdFx0XSk7XG5cblx0XHRcdHZpZXdNb2RlbC5wYXN0ZShcblx0XHRcdFx0J2FhYVxcclxcbmJiYlxcclxcbmNjY1xcclxcbmRkZFxcclxcbicsXG5cdFx0XHRcdGZhbHNlLFxuXHRcdFx0XHRudWxsXG5cdFx0XHQpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnYWFhJyxcblx0XHRcdFx0J2JiYicsXG5cdFx0XHRcdCdjY2MnLFxuXHRcdFx0XHQnZGRkJyxcblx0XHRcdF0uam9pbignXFxuJykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNDY0NDA6ICgxKSBQYXN0aW5nIGEgbXVsdGktbGluZSBzZWxlY3Rpb24gcGFzdGVzIGVudGlyZSBzZWxlY3Rpb24gaW50byBldmVyeSBpbnNlcnRpb24gcG9pbnQnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnbGluZTEnLFxuXHRcdFx0XHQnbGluZTInLFxuXHRcdFx0XHQnbGluZTMnXG5cdFx0XHRdLFxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksIG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgMSksIG5ldyBTZWxlY3Rpb24oMywgMSwgMywgMSldKTtcblxuXHRcdFx0dmlld01vZGVsLnBhc3RlKFxuXHRcdFx0XHQnYVxcbmJcXG5jJyxcblx0XHRcdFx0ZmFsc2UsXG5cdFx0XHRcdG51bGxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCBbXG5cdFx0XHRcdCdhbGluZTEnLFxuXHRcdFx0XHQnYmxpbmUyJyxcblx0XHRcdFx0J2NsaW5lMydcblx0XHRcdF0uam9pbignXFxuJykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNDY0NDA6ICgyKSBQYXN0aW5nIGEgbXVsdGktbGluZSBzZWxlY3Rpb24gcGFzdGVzIGVudGlyZSBzZWxlY3Rpb24gaW50byBldmVyeSBpbnNlcnRpb24gcG9pbnQnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnbGluZTEnLFxuXHRcdFx0XHQnbGluZTInLFxuXHRcdFx0XHQnbGluZTMnXG5cdFx0XHRdLFxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksIG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgMSksIG5ldyBTZWxlY3Rpb24oMywgMSwgMywgMSldKTtcblxuXHRcdFx0dmlld01vZGVsLnBhc3RlKFxuXHRcdFx0XHQnYVxcbmJcXG5jXFxuJyxcblx0XHRcdFx0ZmFsc2UsXG5cdFx0XHRcdG51bGxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCBbXG5cdFx0XHRcdCdhbGluZTEnLFxuXHRcdFx0XHQnYmxpbmUyJyxcblx0XHRcdFx0J2NsaW5lMydcblx0XHRcdF0uam9pbignXFxuJykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMzA3MTogSW52ZXN0aWdhdGUgd2h5IHVuZG8gc3RhY2sgZ2V0cyBjb3JydXB0ZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCdzb21lIGxpbmVzJyxcblx0XHRcdFx0J2FuZCBtb3JlIGxpbmVzJyxcblx0XHRcdFx0J2p1c3Qgc29tZSB0ZXh0Jyxcblx0XHRcdF0uam9pbignXFxuJylcblx0XHQpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDEsIGZhbHNlKTtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMywgNCwgdHJ1ZSk7XG5cblx0XHRcdGxldCBpc0ZpcnN0ID0gdHJ1ZTtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBtb2RlbC5vbkRpZENoYW5nZUNvbnRlbnQoKCkgPT4ge1xuXHRcdFx0XHRpZiAoaXNGaXJzdCkge1xuXHRcdFx0XHRcdGlzRmlyc3QgPSBmYWxzZTtcblx0XHRcdFx0XHR2aWV3TW9kZWwudHlwZSgnXFx0JywgJ2tleWJvYXJkJyk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlRhYi5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnXFx0IGp1c3Qgc29tZSB0ZXh0J1xuXHRcdFx0XS5qb2luKCdcXG4nKSwgJzAwMScpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0JyAgICBzb21lIGxpbmVzJyxcblx0XHRcdFx0JyAgICBhbmQgbW9yZSBsaW5lcycsXG5cdFx0XHRcdCcgICAganVzdCBzb21lIHRleHQnLFxuXHRcdFx0XS5qb2luKCdcXG4nKSwgJzAwMicpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0J3NvbWUgbGluZXMnLFxuXHRcdFx0XHQnYW5kIG1vcmUgbGluZXMnLFxuXHRcdFx0XHQnanVzdCBzb21lIHRleHQnLFxuXHRcdFx0XS5qb2luKCdcXG4nKSwgJzAwMycpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0J3NvbWUgbGluZXMnLFxuXHRcdFx0XHQnYW5kIG1vcmUgbGluZXMnLFxuXHRcdFx0XHQnanVzdCBzb21lIHRleHQnLFxuXHRcdFx0XS5qb2luKCdcXG4nKSwgJzAwNCcpO1xuXG5cdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzEyOTUwOiBDYW5ub3QgRG91YmxlIENsaWNrIFRvIEluc2VydCBFbW9qaSBVc2luZyBPU1ggRW1vamkgUGFuZWwnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnc29tZSBsaW5lcycsXG5cdFx0XHRcdCdhbmQgbW9yZSBsaW5lcycsXG5cdFx0XHRcdCdqdXN0IHNvbWUgdGV4dCcsXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogbnVsbFxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMywgMSwgZmFsc2UpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXHVEODNEXHVERTBEJywgJ2tleWJvYXJkJyk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCBbXG5cdFx0XHRcdCdzb21lIGxpbmVzJyxcblx0XHRcdFx0J2FuZCBtb3JlIGxpbmVzJyxcblx0XHRcdFx0J1x1RDgzRFx1REUwRGp1c3Qgc29tZSB0ZXh0Jyxcblx0XHRcdF0uam9pbignXFxuJykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMzQ2MzogcHJlc3NpbmcgdGFiIGFkZHMgc3BhY2VzLCBidXQgbm90IGFzIG1hbnkgYXMgZm9yIGEgdGFiJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnZnVuY3Rpb24gYSgpIHsnLFxuXHRcdFx0XHQnXFx0dmFyIGEgPSB7Jyxcblx0XHRcdFx0J1xcdFxcdHg6IDMnLFxuXHRcdFx0XHQnXFx0fTsnLFxuXHRcdFx0XHQnfScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCAyLCBmYWxzZSk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlRhYi5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMyksICdcXHQgICAgXFx0eDogMycpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNDMxMjogdHJ5aW5nIHRvIHR5cGUgYSB0YWIgY2hhcmFjdGVyIG92ZXIgYSBzZXF1ZW5jZSBvZiBzcGFjZXMgcmVzdWx0cyBpbiB1bmV4cGVjdGVkIGJlaGF2aW91cicsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFtcblx0XHRcdFx0J3ZhciBmb28gPSAxMjM7ICAgICAgIC8vIHRoaXMgaXMgYSBjb21tZW50Jyxcblx0XHRcdFx0J3ZhciBiYXIgPSA0OyAgICAgICAvLyBhbm90aGVyIGNvbW1lbnQnXG5cdFx0XHRdLmpvaW4oJ1xcbicpLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0e1xuXHRcdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlLFxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgMTUsIGZhbHNlKTtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgMjIsIHRydWUpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5UYWIucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAndmFyIGZvbyA9IDEyMztcXHQvLyB0aGlzIGlzIGEgY29tbWVudCcpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjODMyOiB3b3JkIHJpZ2h0JywgKCkgPT4ge1xuXG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnICAgLyogSnVzdCBzb21lICAgbW9yZSAgIHRleHQgYSs9IDMgKzUtMyArIDcgKi8gICdcblx0XHRcdF0sXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCAxLCBmYWxzZSk7XG5cblx0XHRcdGZ1bmN0aW9uIGFzc2VydFdvcmRSaWdodChjb2w6IG51bWJlciwgZXhwZWN0ZWRDb2w6IG51bWJlcikge1xuXHRcdFx0XHRjb25zdCBhcmdzID0ge1xuXHRcdFx0XHRcdHBvc2l0aW9uOiB7XG5cdFx0XHRcdFx0XHRsaW5lTnVtYmVyOiAxLFxuXHRcdFx0XHRcdFx0Y29sdW1uOiBjb2xcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHRcdGlmIChjb2wgPT09IDEpIHtcblx0XHRcdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLldvcmRTZWxlY3QucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCBhcmdzKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLldvcmRTZWxlY3REcmFnLnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwgYXJncyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmdldFNlbGVjdGlvbigpLnN0YXJ0Q29sdW1uLCAxLCAnVEVTVCBGT1IgJyArIGNvbCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0U2VsZWN0aW9uKCkuZW5kQ29sdW1uLCBleHBlY3RlZENvbCwgJ1RFU1QgRk9SICcgKyBjb2wpO1xuXHRcdFx0fVxuXG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMSwgJyAgICcubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMiwgJyAgICcubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMywgJyAgICcubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoNCwgJyAgICcubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoNSwgJyAgIC8nLmxlbmd0aCArIDEpO1xuXHRcdFx0YXNzZXJ0V29yZFJpZ2h0KDYsICcgICAvKicubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoNywgJyAgIC8qICcubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoOCwgJyAgIC8qIEp1c3QnLmxlbmd0aCArIDEpO1xuXHRcdFx0YXNzZXJ0V29yZFJpZ2h0KDksICcgICAvKiBKdXN0Jy5sZW5ndGggKyAxKTtcblx0XHRcdGFzc2VydFdvcmRSaWdodCgxMCwgJyAgIC8qIEp1c3QnLmxlbmd0aCArIDEpO1xuXHRcdFx0YXNzZXJ0V29yZFJpZ2h0KDExLCAnICAgLyogSnVzdCcubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMTIsICcgICAvKiBKdXN0ICcubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMTMsICcgICAvKiBKdXN0IHNvbWUnLmxlbmd0aCArIDEpO1xuXHRcdFx0YXNzZXJ0V29yZFJpZ2h0KDE0LCAnICAgLyogSnVzdCBzb21lJy5sZW5ndGggKyAxKTtcblx0XHRcdGFzc2VydFdvcmRSaWdodCgxNSwgJyAgIC8qIEp1c3Qgc29tZScubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMTYsICcgICAvKiBKdXN0IHNvbWUnLmxlbmd0aCArIDEpO1xuXHRcdFx0YXNzZXJ0V29yZFJpZ2h0KDE3LCAnICAgLyogSnVzdCBzb21lICcubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMTgsICcgICAvKiBKdXN0IHNvbWUgICcubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMTksICcgICAvKiBKdXN0IHNvbWUgICAnLmxlbmd0aCArIDEpO1xuXHRcdFx0YXNzZXJ0V29yZFJpZ2h0KDIwLCAnICAgLyogSnVzdCBzb21lICAgbW9yZScubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMjEsICcgICAvKiBKdXN0IHNvbWUgICBtb3JlJy5sZW5ndGggKyAxKTtcblx0XHRcdGFzc2VydFdvcmRSaWdodCgyMiwgJyAgIC8qIEp1c3Qgc29tZSAgIG1vcmUnLmxlbmd0aCArIDEpO1xuXHRcdFx0YXNzZXJ0V29yZFJpZ2h0KDIzLCAnICAgLyogSnVzdCBzb21lICAgbW9yZScubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMjQsICcgICAvKiBKdXN0IHNvbWUgICBtb3JlICcubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMjUsICcgICAvKiBKdXN0IHNvbWUgICBtb3JlICAnLmxlbmd0aCArIDEpO1xuXHRcdFx0YXNzZXJ0V29yZFJpZ2h0KDI2LCAnICAgLyogSnVzdCBzb21lICAgbW9yZSAgICcubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMjcsICcgICAvKiBKdXN0IHNvbWUgICBtb3JlICAgdGV4dCcubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMjgsICcgICAvKiBKdXN0IHNvbWUgICBtb3JlICAgdGV4dCcubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMjksICcgICAvKiBKdXN0IHNvbWUgICBtb3JlICAgdGV4dCcubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMzAsICcgICAvKiBKdXN0IHNvbWUgICBtb3JlICAgdGV4dCcubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMzEsICcgICAvKiBKdXN0IHNvbWUgICBtb3JlICAgdGV4dCAnLmxlbmd0aCArIDEpO1xuXHRcdFx0YXNzZXJ0V29yZFJpZ2h0KDMyLCAnICAgLyogSnVzdCBzb21lICAgbW9yZSAgIHRleHQgYScubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMzMsICcgICAvKiBKdXN0IHNvbWUgICBtb3JlICAgdGV4dCBhKycubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMzQsICcgICAvKiBKdXN0IHNvbWUgICBtb3JlICAgdGV4dCBhKz0nLmxlbmd0aCArIDEpO1xuXHRcdFx0YXNzZXJ0V29yZFJpZ2h0KDM1LCAnICAgLyogSnVzdCBzb21lICAgbW9yZSAgIHRleHQgYSs9ICcubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMzYsICcgICAvKiBKdXN0IHNvbWUgICBtb3JlICAgdGV4dCBhKz0gMycubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMzcsICcgICAvKiBKdXN0IHNvbWUgICBtb3JlICAgdGV4dCBhKz0gMyAnLmxlbmd0aCArIDEpO1xuXHRcdFx0YXNzZXJ0V29yZFJpZ2h0KDM4LCAnICAgLyogSnVzdCBzb21lICAgbW9yZSAgIHRleHQgYSs9IDMgKycubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoMzksICcgICAvKiBKdXN0IHNvbWUgICBtb3JlICAgdGV4dCBhKz0gMyArNScubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoNDAsICcgICAvKiBKdXN0IHNvbWUgICBtb3JlICAgdGV4dCBhKz0gMyArNS0nLmxlbmd0aCArIDEpO1xuXHRcdFx0YXNzZXJ0V29yZFJpZ2h0KDQxLCAnICAgLyogSnVzdCBzb21lICAgbW9yZSAgIHRleHQgYSs9IDMgKzUtMycubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoNDIsICcgICAvKiBKdXN0IHNvbWUgICBtb3JlICAgdGV4dCBhKz0gMyArNS0zICcubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoNDMsICcgICAvKiBKdXN0IHNvbWUgICBtb3JlICAgdGV4dCBhKz0gMyArNS0zICsnLmxlbmd0aCArIDEpO1xuXHRcdFx0YXNzZXJ0V29yZFJpZ2h0KDQ0LCAnICAgLyogSnVzdCBzb21lICAgbW9yZSAgIHRleHQgYSs9IDMgKzUtMyArICcubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoNDUsICcgICAvKiBKdXN0IHNvbWUgICBtb3JlICAgdGV4dCBhKz0gMyArNS0zICsgNycubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoNDYsICcgICAvKiBKdXN0IHNvbWUgICBtb3JlICAgdGV4dCBhKz0gMyArNS0zICsgNyAnLmxlbmd0aCArIDEpO1xuXHRcdFx0YXNzZXJ0V29yZFJpZ2h0KDQ3LCAnICAgLyogSnVzdCBzb21lICAgbW9yZSAgIHRleHQgYSs9IDMgKzUtMyArIDcgKicubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoNDgsICcgICAvKiBKdXN0IHNvbWUgICBtb3JlICAgdGV4dCBhKz0gMyArNS0zICsgNyAqLycubGVuZ3RoICsgMSk7XG5cdFx0XHRhc3NlcnRXb3JkUmlnaHQoNDksICcgICAvKiBKdXN0IHNvbWUgICBtb3JlICAgdGV4dCBhKz0gMyArNS0zICsgNyAqLyAnLmxlbmd0aCArIDEpO1xuXHRcdFx0YXNzZXJ0V29yZFJpZ2h0KDUwLCAnICAgLyogSnVzdCBzb21lICAgbW9yZSAgIHRleHQgYSs9IDMgKzUtMyArIDcgKi8gICcubGVuZ3RoICsgMSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMzMzc4ODogV3JvbmcgY3Vyc29yIHBvc2l0aW9uIHdoZW4gZG91YmxlIGNsaWNrIHRvIHNlbGVjdCBhIHdvcmQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCdKdXN0IHNvbWUgdGV4dCdcblx0XHRcdF0uam9pbignXFxuJylcblx0XHQpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLldvcmRTZWxlY3QucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7IHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oMSwgOCkgfSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRTZWxlY3Rpb24oKSwgbmV3IFNlbGVjdGlvbigxLCA2LCAxLCAxMCkpO1xuXG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLldvcmRTZWxlY3REcmFnLnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwgeyBwb3NpdGlvbjogbmV3IFBvc2l0aW9uKDEsIDgpIH0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0U2VsZWN0aW9uKCksIG5ldyBTZWxlY3Rpb24oMSwgNiwgMSwgMTApKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzEyODg3OiBEb3VibGUtY2xpY2sgaGlnaGxpZ2h0aW5nIHNlcGFyYXRpbmcgd2hpdGUgc3BhY2UnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCdhYmMgZGVmJ1xuXHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuV29yZFNlbGVjdC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHsgcG9zaXRpb246IG5ldyBQb3NpdGlvbigxLCA1KSB9KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldFNlbGVjdGlvbigpLCBuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDgpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzk2NzU6IFVuZG8vUmVkbyBhZGRzIGEgc3RvcCBpbiBiZXR3ZWVuIENITiBDaGFyYWN0ZXJzJywgKCkgPT4ge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihbXSwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKSE7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXG5cdFx0XHQvLyBUeXBpbmcgc2VubnNlaSBpbiBKYXBhbmVzZSAtIEhpcmFnYW5hXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXHVGRjUzJywgJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwuY29tcG9zaXRpb25UeXBlKCdcdTMwNUInLCAxLCAwLCAwKTtcblx0XHRcdHZpZXdNb2RlbC5jb21wb3NpdGlvblR5cGUoJ1x1MzA1Qlx1RkY0RScsIDEsIDAsIDApO1xuXHRcdFx0dmlld01vZGVsLmNvbXBvc2l0aW9uVHlwZSgnXHUzMDVCXHUzMDkzJywgMiwgMCwgMCk7XG5cdFx0XHR2aWV3TW9kZWwuY29tcG9zaXRpb25UeXBlKCdcdTMwNUJcdTMwOTNcdUZGNTMnLCAyLCAwLCAwKTtcblx0XHRcdHZpZXdNb2RlbC5jb21wb3NpdGlvblR5cGUoJ1x1MzA1Qlx1MzA5M1x1MzA1QicsIDMsIDAsIDApO1xuXHRcdFx0dmlld01vZGVsLmNvbXBvc2l0aW9uVHlwZSgnXHUzMDVCXHUzMDkzXHUzMDVCJywgMywgMCwgMCk7XG5cdFx0XHR2aWV3TW9kZWwuY29tcG9zaXRpb25UeXBlKCdcdTMwNUJcdTMwOTNcdTMwNUJcdTMwNDQnLCAzLCAwLCAwKTtcblx0XHRcdHZpZXdNb2RlbC5jb21wb3NpdGlvblR5cGUoJ1x1MzA1Qlx1MzA5M1x1MzA1Qlx1MzA0NCcsIDQsIDAsIDApO1xuXHRcdFx0dmlld01vZGVsLmNvbXBvc2l0aW9uVHlwZSgnXHUzMDVCXHUzMDkzXHUzMDVCXHUzMDQ0JywgNCwgMCwgMCk7XG5cdFx0XHR2aWV3TW9kZWwuY29tcG9zaXRpb25UeXBlKCdcdTMwNUJcdTMwOTNcdTMwNUJcdTMwNDQnLCA0LCAwLCAwKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnXHUzMDVCXHUzMDkzXHUzMDVCXHUzMDQ0Jyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgNSkpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMjM5ODM6IENhbGxpbmcgbW9kZWwuc2V0RU9MIGRvZXMgbm90IHJlc2V0IGN1cnNvciBwb3NpdGlvbicsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCdmaXJzdCBsaW5lJyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJ1xuXHRcdFx0XVxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vZGVsLnNldEVPTChFbmRPZkxpbmVTZXF1ZW5jZS5DUkxGKTtcblxuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbbmV3IFNlbGVjdGlvbigyLCAyLCAyLCAyKV0pO1xuXHRcdFx0bW9kZWwuc2V0RU9MKEVuZE9mTGluZVNlcXVlbmNlLkxGKTtcblxuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigyLCAyLCAyLCAyKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMyMzk4MzogQ2FsbGluZyBtb2RlbC5zZXRWYWx1ZSgpIHJlc2V0cyBjdXJzb3IgcG9zaXRpb24nLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnZmlyc3QgbGluZScsXG5cdFx0XHRcdCdzZWNvbmQgbGluZSdcblx0XHRcdF1cblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb2RlbC5zZXRFT0woRW5kT2ZMaW5lU2VxdWVuY2UuQ1JMRik7XG5cblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMiwgMiwgMiwgMildKTtcblx0XHRcdG1vZGVsLnNldFZhbHVlKFtcblx0XHRcdFx0J2RpZmZlcmVudCBmaXJzdCBsaW5lJyxcblx0XHRcdFx0J2RpZmZlcmVudCBzZWNvbmQgbGluZScsXG5cdFx0XHRcdCduZXcgdGhpcmQgbGluZSdcblx0XHRcdF0uam9pbignXFxuJykpO1xuXG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzM2NzQwOiB3b3Jkd3JhcCBjcmVhdGVzIGFuIGV4dHJhIHN0ZXAgLyBjaGFyYWN0ZXIgYXQgdGhlIHdyYXBwaW5nIHBvaW50JywgKCkgPT4ge1xuXHRcdC8vIGEgc2luZ2xlIG1vZGVsIGxpbmUgPT4gNCB2aWV3IGxpbmVzXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdFtcblx0XHRcdFx0J0xvcmVtIGlwc3VtICcsXG5cdFx0XHRcdCdkb2xvciBzaXQgYW1ldCAnLFxuXHRcdFx0XHQnY29uc2VjdGV0dXIgJyxcblx0XHRcdFx0J2FkaXBpc2NpbmcgZWxpdCcsXG5cdFx0XHRdLmpvaW4oJycpXG5cdFx0XSwgeyB3b3JkV3JhcDogJ3dvcmRXcmFwQ29sdW1uJywgd29yZFdyYXBDb2x1bW46IDE2IH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbbmV3IFNlbGVjdGlvbigxLCA3LCAxLCA3KV0pO1xuXG5cdFx0XHRtb3ZlUmlnaHQoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCA4LCAxLCA4KSk7XG5cblx0XHRcdG1vdmVSaWdodChlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDksIDEsIDkpKTtcblxuXHRcdFx0bW92ZVJpZ2h0KGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgMTAsIDEsIDEwKSk7XG5cblx0XHRcdG1vdmVSaWdodChlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDExLCAxLCAxMSkpO1xuXG5cdFx0XHRtb3ZlUmlnaHQoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCAxMiwgMSwgMTIpKTtcblxuXHRcdFx0bW92ZVJpZ2h0KGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgMTMsIDEsIDEzKSk7XG5cblx0XHRcdC8vIG1vdmluZyB0byB2aWV3IGxpbmUgMlxuXHRcdFx0bW92ZVJpZ2h0KGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgMTQsIDEsIDE0KSk7XG5cblx0XHRcdG1vdmVMZWZ0KGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgMTMsIDEsIDEzKSk7XG5cblx0XHRcdC8vIG1vdmluZyBiYWNrIHRvIHZpZXcgbGluZSAxXG5cdFx0XHRtb3ZlTGVmdChlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDEyLCAxLCAxMikpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTEwMzc2OiBtdWx0aXBsZSBzZWxlY3Rpb25zIHdpdGggd29yZHdyYXAgYmVoYXZlIGRpZmZlcmVudGx5JywgKCkgPT4ge1xuXHRcdC8vIGEgc2luZ2xlIG1vZGVsIGxpbmUgPT4gNCB2aWV3IGxpbmVzXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdFtcblx0XHRcdFx0J2p1c3QgYSBzZW50ZW5jZS4ganVzdCBhICcsXG5cdFx0XHRcdCdzZW50ZW5jZS4ganVzdCBhIHNlbnRlbmNlLicsXG5cdFx0XHRdLmpvaW4oJycpXG5cdFx0XSwgeyB3b3JkV3JhcDogJ3dvcmRXcmFwQ29sdW1uJywgd29yZFdyYXBDb2x1bW46IDI1IH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMTYpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDE4LCAxLCAzMyksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMzUsIDEsIDUwKSxcblx0XHRcdF0pO1xuXG5cdFx0XHRtb3ZlTGVmdChlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMTgsIDEsIDE4KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAzNSwgMSwgMzUpLFxuXHRcdFx0XSk7XG5cblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDE2KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxOCwgMSwgMzMpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDM1LCAxLCA1MCksXG5cdFx0XHRdKTtcblxuXHRcdFx0bW92ZVJpZ2h0KGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxNiwgMSwgMTYpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDMzLCAxLCAzMyksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNTAsIDEsIDUwKSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjOTgzMjA6IE11bHRpLUN1cnNvciwgV3JhcCBsaW5lcyBhbmQgY3Vyc29yU2VsZWN0UmlnaHQgPT0+IGN1cnNvcnMgb3V0IG9mIHN5bmMnLCAoKSA9PiB7XG5cdFx0Ly8gYSBzaW5nbGUgbW9kZWwgbGluZSA9PiA0IHZpZXcgbGluZXNcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0W1xuXHRcdFx0XHQnbG9yZW1faXBzdW0tMTk5M3gxMXgxMycsXG5cdFx0XHRcdCdkb2xvcl9zaXRfYW1ldC0xOTk4eDA0eDI3Jyxcblx0XHRcdFx0J2NvbnNlY3RldHVyLTIwMDd4MTB4MDgnLFxuXHRcdFx0XHQnYWRpcGlzY2luZy0yMDEyeDA3eDI3Jyxcblx0XHRcdFx0J2VsaXQtMjAxNXgwMngyNycsXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0XSwgeyB3b3JkV3JhcDogJ3dvcmRXcmFwQ29sdW1uJywgd29yZFdyYXBDb2x1bW46IDE2IH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMTMsIDEsIDEzKSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxNiwgMiwgMTYpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDEzLCAzLCAxMyksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNCwgMTIsIDQsIDEyKSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig1LCA2LCA1LCA2KSxcblx0XHRcdF0pO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEzLCAxLCAxMyksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMTYsIDIsIDE2KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigzLCAxMywgMywgMTMpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDQsIDEyLCA0LCAxMiksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNSwgNiwgNSwgNiksXG5cdFx0XHRdKTtcblxuXHRcdFx0bW92ZVJpZ2h0KGVkaXRvciwgdmlld01vZGVsLCB0cnVlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxMywgMSwgMTQpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDE2LCAyLCAxNyksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMywgMTMsIDMsIDE0KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig0LCAxMiwgNCwgMTMpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDUsIDYsIDUsIDcpLFxuXHRcdFx0XSk7XG5cblx0XHRcdG1vdmVSaWdodChlZGl0b3IsIHZpZXdNb2RlbCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMTMsIDEsIDE1KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxNiwgMiwgMTgpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDEzLCAzLCAxNSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNCwgMTIsIDQsIDE0KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig1LCA2LCA1LCA4KSxcblx0XHRcdF0pO1xuXG5cdFx0XHRtb3ZlUmlnaHQoZWRpdG9yLCB2aWV3TW9kZWwsIHRydWUpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEzLCAxLCAxNiksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMTYsIDIsIDE5KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigzLCAxMywgMywgMTYpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDQsIDEyLCA0LCAxNSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oNSwgNiwgNSwgOSksXG5cdFx0XHRdKTtcblxuXHRcdFx0bW92ZVJpZ2h0KGVkaXRvciwgdmlld01vZGVsLCB0cnVlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxMywgMSwgMTcpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDE2LCAyLCAyMCksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMywgMTMsIDMsIDE3KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbig0LCAxMiwgNCwgMTYpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDUsIDYsIDUsIDEwKSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNDE1NzMgLSBkZWxldGUgYWNyb3NzIG11bHRpcGxlIGxpbmVzIGRvZXMgbm90IHNocmluayB0aGUgc2VsZWN0aW9uIHdoZW4gd29yZCB3cmFwcycsICgpID0+IHtcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0J0F1dGhvcml6YXRpb246IFxcJ0JlYXJlciBwSEtSZkNURlNuR3hzNmFrS2xiOWRkSVhjY2Ewc0lVU1pKdXRQSFlxejd2RWVIZE1UTWgwU0dOMElHVTNhMG41OURYalRMUnNqNUVKMnUzM3FMTklGaTlmazVYRjhwSzM5UG5kTFlVWmhQdDRRdkhHTFNjZ1NrSzBMNGd3emt6TWxvVFFQcEtocWlpa2lJT3Z5Tk5TcGQybzhqMjlObk9tZFRVT0tpOURWdDc0UEQyb2hLeHlPcldaNm9acHJUa2IzZUthamNwblMwTEFCS2ZhdzJybXY0XFwnLCdcblx0XHRdLmpvaW4oJ1xcbicpLCB7IHdvcmRXcmFwOiAnd29yZFdyYXBDb2x1bW4nLCB3b3JkV3JhcENvbHVtbjogMTAwIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCA0MywgZmFsc2UpO1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCAxNDcsIHRydWUpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCA0MywgMSwgMTQ3KSk7XG5cblx0XHRcdGVkaXRvci5nZXRNb2RlbCgpLmFwcGx5RWRpdHMoW3tcblx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCA0MyksXG5cdFx0XHRcdHRleHQ6ICcnXG5cdFx0XHR9XSk7XG5cblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMTA1KSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMyMjcxNzogTW92aW5nIHRleHQgY3Vyc29yIGNhdXNlIGFuIGluY29ycmVjdCBwb3NpdGlvbiBpbiBDaGluZXNlJywgKCkgPT4ge1xuXHRcdC8vIGEgc2luZ2xlIG1vZGVsIGxpbmUgPT4gNCB2aWV3IGxpbmVzXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdFtcblx0XHRcdFx0J1x1NEUwMFx1NEU4Q1x1NEUwOVx1NTZEQlx1NEU5NFx1NTE2RFx1NEUwM1x1NTE2Qlx1NEU1RFx1NTM0MScsXG5cdFx0XHRcdCcxMjM0NTY3ODkwMTIzNDU2Nzg5MCcsXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0XSwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbbmV3IFNlbGVjdGlvbigxLCA1LCAxLCA1KV0pO1xuXG5cdFx0XHRtb3ZlRG93bihlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDIsIDksIDIsIDkpKTtcblxuXHRcdFx0bW92ZVJpZ2h0KGVkaXRvciwgdmlld01vZGVsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMiwgMTAsIDIsIDEwKSk7XG5cblx0XHRcdG1vdmVSaWdodChlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDIsIDExLCAyLCAxMSkpO1xuXG5cdFx0XHRtb3ZlVXAoZWRpdG9yLCB2aWV3TW9kZWwpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCA2LCAxLCA2KSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMTIzMDE6IG5ldyBzdGlja3lUYWJTdG9wcyBmZWF0dXJlIGludGVyZmVyZXMgd2l0aCB3b3JkIHdyYXAnLCAoKSA9PiB7XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKFtcblx0XHRcdFtcblx0XHRcdFx0J2Z1bmN0aW9uIGhlbGxvKCkgeycsXG5cdFx0XHRcdCcgICAgICAgIGNvbnNvbGUubG9nKGB0aGlzIGlzIGEgbG9uZyBjb25zb2xlIG1lc3NhZ2VgKScsXG5cdFx0XHRcdCd9Jyxcblx0XHRcdF0uam9pbignXFxuJylcblx0XHRdLCB7IHdvcmRXcmFwOiAnd29yZFdyYXBDb2x1bW4nLCB3b3JkV3JhcENvbHVtbjogMzIsIHN0aWNreVRhYlN0b3BzOiB0cnVlIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMzEsIDIsIDMxKVxuXHRcdFx0XSk7XG5cdFx0XHRtb3ZlUmlnaHQoZWRpdG9yLCB2aWV3TW9kZWwsIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigyLCAzMikpO1xuXG5cdFx0XHRtb3ZlUmlnaHQoZWRpdG9yLCB2aWV3TW9kZWwsIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigyLCAzMykpO1xuXG5cdFx0XHRtb3ZlUmlnaHQoZWRpdG9yLCB2aWV3TW9kZWwsIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigyLCAzNCkpO1xuXG5cdFx0XHRtb3ZlTGVmdChlZGl0b3IsIHZpZXdNb2RlbCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDIsIDMzKSk7XG5cblx0XHRcdG1vdmVMZWZ0KGVkaXRvciwgdmlld01vZGVsLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMiwgMzIpKTtcblxuXHRcdFx0bW92ZUxlZnQoZWRpdG9yLCB2aWV3TW9kZWwsIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigyLCAzMSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNDQ4MDU6IFNob3VsZCBub3QgYmUgYWJsZSB0byB1bmRvIGluIHJlYWRvbmx5IGVkaXRvcicsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFtcblx0XHRcdFx0Jydcblx0XHRcdF0uam9pbignXFxuJylcblx0XHQpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IHJlYWRPbmx5OiB0cnVlIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW9kZWwucHVzaEVkaXRPcGVyYXRpb25zKFtuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpXSwgW3tcblx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCAxKSxcblx0XHRcdFx0dGV4dDogJ0hlbGxvIHdvcmxkISdcblx0XHRcdH1dLCAoKSA9PiBbbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKV0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnSGVsbG8gd29ybGQhJyk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuVW5kby5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICdIZWxsbyB3b3JsZCEnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzQ2MzE0OiBWaWV3TW9kZWwgaXMgb3V0IG9mIHN5bmMgd2l0aCBNb2RlbCEnLCAoKSA9PiB7XG5cblx0XHRjb25zdCB0b2tlbml6YXRpb25TdXBwb3J0OiBJVG9rZW5pemF0aW9uU3VwcG9ydCA9IHtcblx0XHRcdGdldEluaXRpYWxTdGF0ZTogKCkgPT4gTnVsbFN0YXRlLFxuXHRcdFx0dG9rZW5pemU6IHVuZGVmaW5lZCEsXG5cdFx0XHR0b2tlbml6ZUVuY29kZWQ6IChsaW5lOiBzdHJpbmcsIGhhc0VPTDogYm9vbGVhbiwgc3RhdGU6IElTdGF0ZSk6IEVuY29kZWRUb2tlbml6YXRpb25SZXN1bHQgPT4ge1xuXHRcdFx0XHRyZXR1cm4gbmV3IEVuY29kZWRUb2tlbml6YXRpb25SZXN1bHQobmV3IFVpbnQzMkFycmF5KDApLCBzdGF0ZSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IExBTkdVQUdFX0lEID0gJ21vZGVsTW9kZVRlc3QxJztcblx0XHRjb25zdCBsYW5ndWFnZVJlZ2lzdHJhdGlvbiA9IFRva2VuaXphdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyKExBTkdVQUdFX0lELCB0b2tlbml6YXRpb25TdXBwb3J0KTtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnSnVzdCB0ZXh0JywgTEFOR1VBR0VfSUQpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7fSwgKGVkaXRvcjEsIGN1cnNvcjEpID0+IHtcblx0XHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IyLCBjdXJzb3IyKSA9PiB7XG5cblx0XHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGVkaXRvcjEub25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbigoKSA9PiB7XG5cdFx0XHRcdFx0bW9kZWwudG9rZW5pemF0aW9uLnRva2VuaXplSWZDaGVhcCgxKTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0bW9kZWwuYXBwbHlFZGl0cyhbeyByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDEpLCB0ZXh0OiAnLScgfV0pO1xuXG5cdFx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRsYW5ndWFnZVJlZ2lzdHJhdGlvbi5kaXNwb3NlKCk7XG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMzc5Njc6IHByb2JsZW0gcmVwbGFjaW5nIGNvbnNlY3V0aXZlIGNoYXJhY3RlcnMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCdjb25zdCBhID0gXCJmb29cIjsnLFxuXHRcdFx0XHQnY29uc3QgYiA9IFwiXCInXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyBtdWx0aUN1cnNvck1lcmdlT3ZlcmxhcHBpbmc6IGZhbHNlIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEyLCAxLCAxMiksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMTYsIDEsIDE2KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxMiwgMiwgMTIpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDEzLCAyLCAxMyksXG5cdFx0XHRdKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblxuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDExLCAxLCAxMSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMTQsIDEsIDE0KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxMSwgMiwgMTEpLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDExLCAyLCAxMSksXG5cdFx0XHRdKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcJycsICdrZXlib2FyZCcpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdjb25zdCBhID0gXFwnZm9vXFwnOycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnY29uc3QgYiA9IFxcJ1xcJycpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTU3NjE6IEN1cnNvciBkb2VzblxcJ3QgbW92ZSBpbiBhIHJlZG8gb3BlcmF0aW9uJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnaGVsbG8nXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpXG5cdFx0XHRdKTtcblxuXHRcdFx0ZWRpdG9yLmV4ZWN1dGVFZGl0cygndGVzdCcsIFt7XG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMSksXG5cdFx0XHRcdHRleHQ6ICcqJyxcblx0XHRcdFx0Zm9yY2VNb3ZlTWFya2VyczogdHJ1ZVxuXHRcdFx0fV0pO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpLFxuXHRcdFx0XSk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuVW5kby5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCksXG5cdFx0XHRdKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5SZWRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCA1LCAxLCA1KSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNDI3ODM6IEFQSSBDYWxscyB3aXRoIFVuZG8gTGVhdmUgQ3Vyc29yIGluIFdyb25nIFBvc2l0aW9uJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnYWInXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpXG5cdFx0XHRdKTtcblxuXHRcdFx0ZWRpdG9yLmV4ZWN1dGVFZGl0cygndGVzdCcsIFt7XG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMyksXG5cdFx0XHRcdHRleHQ6ICcnXG5cdFx0XHR9XSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksXG5cdFx0XHRdKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSxcblx0XHRcdF0pO1xuXG5cdFx0XHRlZGl0b3IuZXhlY3V0ZUVkaXRzKCd0ZXN0JywgW3tcblx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCAyKSxcblx0XHRcdFx0dGV4dDogJydcblx0XHRcdH1dKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjODU3MTI6IFBhc3RlIGxpbmUgbW92ZXMgY3Vyc29yIHRvIHN0YXJ0IG9mIGN1cnJlbnQgbGluZSByYXRoZXIgdGhhbiBzdGFydCBvZiBuZXh0IGxpbmUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCdhYmMxMjMnLFxuXHRcdFx0XHQnJ1xuXHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxLCAyLCAxKVxuXHRcdFx0XSk7XG5cdFx0XHR2aWV3TW9kZWwucGFzdGUoJ3NvbWV0aGluZ1xcbicsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0J2FiYzEyMycsXG5cdFx0XHRcdCdzb21ldGhpbmcnLFxuXHRcdFx0XHQnJ1xuXHRcdFx0XS5qb2luKCdcXG4nKSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMywgMSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjODQ4OTc6IExlZnQgZGVsZXRlIGJlaGF2aW9yIGluIHNvbWUgbGFuZ3VhZ2VzIGlzIGNoYW5nZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCdcdTBFMkFcdTBFMjdcdTBFMzFcdTBFMkFcdTBFMTRcdTBFMzUnXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDcsIDEsIDcpXG5cdFx0XHRdKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1x1MEUyQVx1MEUyN1x1MEUzMVx1MEUyQVx1MEUxNCcpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnXHUwRTJBXHUwRTI3XHUwRTMxXHUwRTJBJyk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICdcdTBFMkFcdTBFMjdcdTBFMzEnKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1x1MEUyQVx1MEUyNycpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnXHUwRTJBJyk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICcnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzEyMjkxNDogTGVmdCBkZWxldGUgYmVoYXZpb3IgaW4gc29tZSBsYW5ndWFnZXMgaXMgY2hhbmdlZCAodXNlVGFiU3RvcHM6IGZhbHNlKScsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFtcblx0XHRcdFx0J1x1MEUyQVx1MEUyN1x1MEUzMVx1MEUyQVx1MEUxNFx1MEUzNSdcblx0XHRcdF0uam9pbignXFxuJylcblx0XHQpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IHVzZVRhYlN0b3BzOiBmYWxzZSB9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCA3LCAxLCA3KVxuXHRcdFx0XSk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICdcdTBFMkFcdTBFMjdcdTBFMzFcdTBFMkFcdTBFMTQnKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1x1MEUyQVx1MEUyN1x1MEUzMVx1MEUyQScpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnXHUwRTJBXHUwRTI3XHUwRTMxJyk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICdcdTBFMkFcdTBFMjcnKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1x1MEUyQScpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM5OTYyOTogRW1vamkgbW9kaWZpZXJzIGluIHRleHQgdHJlYXRlZCBzZXBhcmF0ZWx5IHdoZW4gdXNpbmcgYmFja3NwYWNlJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnXHVEODNEXHVEQzc2XHVEODNDXHVERkZFJ1xuXHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgdXNlVGFiU3RvcHM6IGZhbHNlIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0Y29uc3QgbGVuID0gbW9kZWwuZ2V0VmFsdWVMZW5ndGgoKTtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxICsgbGVuLCAxLCAxICsgbGVuKVxuXHRcdFx0XSk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICcnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzk5NjI5OiBFbW9qaSBtb2RpZmllcnMgaW4gdGV4dCB0cmVhdGVkIHNlcGFyYXRlbHkgd2hlbiB1c2luZyBiYWNrc3BhY2UgKFpXSiBzZXF1ZW5jZSknLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCdcdUQ4M0RcdURDNjhcdTIwMERcdUQ4M0RcdURDNjlcdUQ4M0NcdURGRkRcdTIwMERcdUQ4M0RcdURDNjdcdTIwMERcdUQ4M0RcdURDNjYnXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyB1c2VUYWJTdG9wczogZmFsc2UgfSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRjb25zdCBsZW4gPSBtb2RlbC5nZXRWYWx1ZUxlbmd0aCgpO1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEgKyBsZW4sIDEsIDEgKyBsZW4pXG5cdFx0XHRdKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1x1RDgzRFx1REM2OFx1MjAwRFx1RDgzRFx1REM2OVx1RDgzQ1x1REZGRFx1MjAwRFx1RDgzRFx1REM2NycpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnXHVEODNEXHVEQzY4XHUyMDBEXHVEODNEXHVEQzY5XHVEODNDXHVERkZEJyk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICdcdUQ4M0RcdURDNjgnKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJycpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTA1NzMwOiBtb3ZlIGxlZnQgYmVoYXZlcyBkaWZmZXJlbnRseSBmb3IgbXVsdGlwbGUgY3Vyc29ycycsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnYXNkZmdoamtsLCBhc2RmZ2hqa2wsIGFzZGZnaGprbCwgJyk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoXG5cdFx0XHRtb2RlbCxcblx0XHRcdHtcblx0XHRcdFx0d29yZFdyYXA6ICd3b3JkV3JhcENvbHVtbicsXG5cdFx0XHRcdHdvcmRXcmFwQ29sdW1uOiAyNFxuXHRcdFx0fSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEwLCAxLCAxMiksXG5cdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAyMSwgMSwgMjMpLFxuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMzIsIDEsIDM0KVxuXHRcdFx0XHRdKTtcblx0XHRcdFx0bW92ZUxlZnQoZWRpdG9yLCB2aWV3TW9kZWwsIGZhbHNlKTtcblx0XHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgW1xuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMTAsIDEsIDEwKSxcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDIxLCAxLCAyMSksXG5cdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAzMiwgMSwgMzIpXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW1xuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMTAsIDEsIDEyKSxcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDIxLCAxLCAyMyksXG5cdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAzMiwgMSwgMzQpXG5cdFx0XHRcdF0pO1xuXHRcdFx0XHRtb3ZlTGVmdChlZGl0b3IsIHZpZXdNb2RlbCwgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEwLCAxLCAxMSksXG5cdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAyMSwgMSwgMjIpLFxuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMzIsIDEsIDMzKVxuXHRcdFx0XHRdKTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTA1NzMwOiBtb3ZlIHJpZ2h0IHNob3VsZCBhbHdheXMgc2tpcCB3cmFwIHBvaW50JywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKCdhc2RmZ2hqa2wsIGFzZGZnaGprbCwgYXNkZmdoamtsLCBcXG5hc2RmZ2hqa2wsJyk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoXG5cdFx0XHRtb2RlbCxcblx0XHRcdHtcblx0XHRcdFx0d29yZFdyYXA6ICd3b3JkV3JhcENvbHVtbicsXG5cdFx0XHRcdHdvcmRXcmFwQ29sdW1uOiAyNFxuXHRcdFx0fSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDIyLCAxLCAyMilcblx0XHRcdFx0XSk7XG5cdFx0XHRcdG1vdmVSaWdodChlZGl0b3IsIHZpZXdNb2RlbCwgZmFsc2UpO1xuXHRcdFx0XHRtb3ZlUmlnaHQoZWRpdG9yLCB2aWV3TW9kZWwsIGZhbHNlKTtcblx0XHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgW1xuXHRcdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMjQsIDEsIDI0KSxcblx0XHRcdFx0XSk7XG5cblx0XHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbXG5cdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAyMiwgMSwgMjIpXG5cdFx0XHRcdF0pO1xuXHRcdFx0XHRtb3ZlUmlnaHQoZWRpdG9yLCB2aWV3TW9kZWwsIHRydWUpO1xuXHRcdFx0XHRtb3ZlUmlnaHQoZWRpdG9yLCB2aWV3TW9kZWwsIHRydWUpO1xuXHRcdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBbXG5cdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAyMiwgMSwgMjQpLFxuXHRcdFx0XHRdKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTIzMTc4OiBzdGlja3kgdGFiIGluIGNvbnNlY3V0aXZlIHdyYXBwZWQgbGluZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoJyAgICBhYWFhICAgICAgICBhYWFhJywgdW5kZWZpbmVkLCB7IHRhYlNpemU6IDQgfSk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoXG5cdFx0XHRtb2RlbCxcblx0XHRcdHtcblx0XHRcdFx0d29yZFdyYXA6ICd3b3JkV3JhcENvbHVtbicsXG5cdFx0XHRcdHdvcmRXcmFwQ29sdW1uOiA4LFxuXHRcdFx0XHRzdGlja3lUYWJTdG9wczogdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHQoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbXG5cdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCA5LCAxLCA5KVxuXHRcdFx0XHRdKTtcblx0XHRcdFx0bW92ZVJpZ2h0KGVkaXRvciwgdmlld01vZGVsLCBmYWxzZSk7XG5cdFx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEwLCAxLCAxMCksXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdG1vdmVMZWZ0KGVkaXRvciwgdmlld01vZGVsLCBmYWxzZSk7XG5cdFx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIFtcblx0XHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDksIDEsIDkpLFxuXHRcdFx0XHRdKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdDdXJzb3IgaG9ub3JzIGluc2VydFNwYWNlcyBjb25maWd1cmF0aW9uIG9uIG5ldyBsaW5lJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0JyAgICBcXHRNeSBGaXJzdCBMaW5lXFx0ICcsXG5cdFx0XHRcdCdcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMSdcblx0XHRcdF1cblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLk1vdmVUby5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHsgcG9zaXRpb246IG5ldyBQb3NpdGlvbigxLCAyMSksIHNvdXJjZTogJ2tleWJvYXJkJyB9KTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcXG4nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJyAgICBcXHRNeSBGaXJzdCBMaW5lXFx0ICcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnICAgICAgICAnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnQ3Vyc29yIGhvbm9ycyBpbnNlcnRTcGFjZXMgY29uZmlndXJhdGlvbiBvbiB0YWInLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCcgICAgXFx0TXkgRmlyc3QgTGluZVxcdCAnLFxuXHRcdFx0XHQnTXkgU2Vjb25kIExpbmUxMjMnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEnXG5cdFx0XHRdLmpvaW4oJ1xcbicpLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0e1xuXHRcdFx0XHR0YWJTaXplOiAxMyxcblx0XHRcdFx0aW5kZW50U2l6ZTogMTMsXG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0Ly8gVGFiIG9uIGNvbHVtbiAxXG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLk1vdmVUby5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHsgcG9zaXRpb246IG5ldyBQb3NpdGlvbigyLCAxKSB9KTtcblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuVGFiLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJyAgICAgICAgICAgICBNeSBTZWNvbmQgTGluZTEyMycpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblxuXHRcdFx0Ly8gVGFiIG9uIGNvbHVtbiAyXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICdNeSBTZWNvbmQgTGluZTEyMycpO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5Nb3ZlVG8ucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7IHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oMiwgMikgfSk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlRhYi5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICdNICAgICAgICAgICAgeSBTZWNvbmQgTGluZTEyMycpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblxuXHRcdFx0Ly8gVGFiIG9uIGNvbHVtbiAzXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICdNeSBTZWNvbmQgTGluZTEyMycpO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5Nb3ZlVG8ucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7IHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oMiwgMykgfSk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlRhYi5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICdNeSAgICAgICAgICAgIFNlY29uZCBMaW5lMTIzJyk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXG5cdFx0XHQvLyBUYWIgb24gY29sdW1uIDRcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJ015IFNlY29uZCBMaW5lMTIzJyk7XG5cdFx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLk1vdmVUby5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHsgcG9zaXRpb246IG5ldyBQb3NpdGlvbigyLCA0KSB9KTtcblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuVGFiLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJ015ICAgICAgICAgICBTZWNvbmQgTGluZTEyMycpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblxuXHRcdFx0Ly8gVGFiIG9uIGNvbHVtbiA1XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICdNeSBTZWNvbmQgTGluZTEyMycpO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5Nb3ZlVG8ucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7IHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oMiwgNSkgfSk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlRhYi5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICdNeSBTICAgICAgICAgZWNvbmQgTGluZTEyMycpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblxuXHRcdFx0Ly8gVGFiIG9uIGNvbHVtbiA1XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICdNeSBTZWNvbmQgTGluZTEyMycpO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5Nb3ZlVG8ucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7IHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oMiwgNSkgfSk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlRhYi5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICdNeSBTICAgICAgICAgZWNvbmQgTGluZTEyMycpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblxuXHRcdFx0Ly8gVGFiIG9uIGNvbHVtbiAxM1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnTXkgU2Vjb25kIExpbmUxMjMnKTtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuTW92ZVRvLnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwgeyBwb3NpdGlvbjogbmV3IFBvc2l0aW9uKDIsIDEzKSB9KTtcblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuVGFiLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJ015IFNlY29uZCBMaSBuZTEyMycpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblxuXHRcdFx0Ly8gVGFiIG9uIGNvbHVtbiAxNFxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnTXkgU2Vjb25kIExpbmUxMjMnKTtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuTW92ZVRvLnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwgeyBwb3NpdGlvbjogbmV3IFBvc2l0aW9uKDIsIDE0KSB9KTtcblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuVGFiLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJ015IFNlY29uZCBMaW4gICAgICAgICAgICAgZTEyMycpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdFbnRlciBhdXRvLWluZGVudHMgd2l0aCBpbnNlcnRTcGFjZXMgc2V0dGluZyAxJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxhbmd1YWdlSWQgPSBzZXR1cE9uRW50ZXJMYW5ndWFnZShJbmRlbnRBY3Rpb24uSW5kZW50KTtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCdcXHRoZWxsbydcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBsYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCA3LCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDcsIDEsIDcpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuQ1JMRiksICdcXHRoZWxsb1xcclxcbiAgICAgICAgJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0VudGVyIGF1dG8taW5kZW50cyB3aXRoIGluc2VydFNwYWNlcyBzZXR0aW5nIDInLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VJZCA9IHNldHVwT25FbnRlckxhbmd1YWdlKEluZGVudEFjdGlvbi5Ob25lKTtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCdcXHRoZWxsbydcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBsYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCA3LCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDcsIDEsIDcpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuQ1JMRiksICdcXHRoZWxsb1xcclxcbiAgICAnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRW50ZXIgYXV0by1pbmRlbnRzIHdpdGggaW5zZXJ0U3BhY2VzIHNldHRpbmcgMycsICgpID0+IHtcblx0XHRjb25zdCBsYW5ndWFnZUlkID0gc2V0dXBPbkVudGVyTGFuZ3VhZ2UoSW5kZW50QWN0aW9uLkluZGVudE91dGRlbnQpO1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J1xcdGhlbGwoKSdcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBsYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCA3LCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDcsIDEsIDcpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuQ1JMRiksICdcXHRoZWxsKFxcclxcbiAgICAgICAgXFxyXFxuICAgICknKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE0ODI1NjogUHJlc3NpbmcgRW50ZXIgY3JlYXRlcyBsaW5lIHdpdGggYmFkIGluZGVudCB3aXRoIGluc2VydFNwYWNlczogdHJ1ZScsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCcgIFxcdCdcblx0XHRcdF0sXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCA0LCBmYWxzZSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJyAgXFx0XFxuICAgICcpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTQ4MjU2OiBQcmVzc2luZyBFbnRlciBjcmVhdGVzIGxpbmUgd2l0aCBiYWQgaW5kZW50IHdpdGggaW5zZXJ0U3BhY2VzOiBmYWxzZScsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCcgIFxcdCdcblx0XHRcdF1cblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb2RlbC51cGRhdGVPcHRpb25zKHtcblx0XHRcdFx0aW5zZXJ0U3BhY2VzOiBmYWxzZVxuXHRcdFx0fSk7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDQsIGZhbHNlKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcXG4nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnICBcXHRcXG5cXHQnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgncmVtb3ZlQXV0b1doaXRlc3BhY2Ugb2ZmJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0JyAgICBzb21lICBsaW5lIGFiYyAgJ1xuXHRcdFx0XSxcblx0XHRcdG1vZGVsT3B0czoge1xuXHRcdFx0XHR0cmltQXV0b1doaXRlc3BhY2U6IGZhbHNlXG5cdFx0XHR9XG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXG5cdFx0XHQvLyBNb3ZlIGN1cnNvciB0byB0aGUgZW5kLCB2ZXJpZnkgdGhhdCB3ZSBkbyBub3QgdHJpbSB3aGl0ZXNwYWNlcyBpZiBsaW5lIGhhcyB2YWx1ZXNcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgbW9kZWwuZ2V0TGluZUNvbnRlbnQoMSkubGVuZ3RoICsgMSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICcgICAgc29tZSAgbGluZSBhYmMgICcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnICAgICcpO1xuXG5cdFx0XHQvLyBUcnkgdG8gZW50ZXIgYWdhaW4sIHdlIHNob3VsZCB0cmltbWVkIHByZXZpb3VzIGxpbmVcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcXG4nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJyAgICBzb21lICBsaW5lIGFiYyAgJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICcgICAgJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMyksICcgICAgJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlbW92ZUF1dG9XaGl0ZXNwYWNlIG9uOiByZW1vdmVzIG9ubHkgd2hpdGVzcGFjZSB0aGUgY3Vyc29yIGFkZGVkIDEnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnICAgICdcblx0XHRcdF1cblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIG1vZGVsLmdldExpbmVDb250ZW50KDEpLmxlbmd0aCArIDEpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnICAgICcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnICAgICcpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICcgICAgJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICcnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgzKSwgJyAgICAnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzExNTAzMzogaW5kZW50IGFuZCBhcHBlbmRUZXh0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGxhbmd1YWdlSWQgPSAnb25FbnRlck1vZGUnO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZS5yZWdpc3Rlckxhbmd1YWdlKHsgaWQ6IGxhbmd1YWdlSWQgfSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLnJlZ2lzdGVyKGxhbmd1YWdlSWQsIHtcblx0XHRcdG9uRW50ZXJSdWxlczogW3tcblx0XHRcdFx0YmVmb3JlVGV4dDogLy4qLyxcblx0XHRcdFx0YWN0aW9uOiB7XG5cdFx0XHRcdFx0aW5kZW50QWN0aW9uOiBJbmRlbnRBY3Rpb24uSW5kZW50LFxuXHRcdFx0XHRcdGFwcGVuZFRleHQ6ICd4J1xuXHRcdFx0XHR9XG5cdFx0XHR9XVxuXHRcdH0pKTtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCd0ZXh0J1xuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGxhbmd1YWdlSWQsXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDUpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAndGV4dCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnICAgIHgnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigyLCA2KSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM2ODYyOiBFZGl0b3IgcmVtb3ZlcyBhdXRvIGluc2VydGVkIGluZGVudGF0aW9uIHdoZW4gZm9ybWF0dGluZyBvbiB0eXBlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxhbmd1YWdlSWQgPSBzZXR1cE9uRW50ZXJMYW5ndWFnZShJbmRlbnRBY3Rpb24uSW5kZW50T3V0ZGVudCk7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnZnVuY3Rpb24gZm9vIChwYXJhbXM6IHN0cmluZykge30nXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogbGFuZ3VhZ2VJZCxcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgMzIpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnZnVuY3Rpb24gZm9vIChwYXJhbXM6IHN0cmluZykgeycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnICAgICcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnfScpO1xuXG5cdFx0XHRjbGFzcyBUZXN0Q29tbWFuZCBpbXBsZW1lbnRzIElDb21tYW5kIHtcblxuXHRcdFx0XHRwcml2YXRlIF9zZWxlY3Rpb25JZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cblx0XHRcdFx0cHVibGljIGdldEVkaXRPcGVyYXRpb25zKG1vZGVsOiBJVGV4dE1vZGVsLCBidWlsZGVyOiBJRWRpdE9wZXJhdGlvbkJ1aWxkZXIpOiB2b2lkIHtcblx0XHRcdFx0XHRidWlsZGVyLmFkZEVkaXRPcGVyYXRpb24obmV3IFJhbmdlKDEsIDEzLCAxLCAxNCksICcnKTtcblx0XHRcdFx0XHR0aGlzLl9zZWxlY3Rpb25JZCA9IGJ1aWxkZXIudHJhY2tTZWxlY3Rpb24odmlld01vZGVsLmdldFNlbGVjdGlvbigpKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHB1YmxpYyBjb21wdXRlQ3Vyc29yU3RhdGUobW9kZWw6IElUZXh0TW9kZWwsIGhlbHBlcjogSUN1cnNvclN0YXRlQ29tcHV0ZXJEYXRhKTogU2VsZWN0aW9uIHtcblx0XHRcdFx0XHRyZXR1cm4gaGVscGVyLmdldFRyYWNrZWRTZWxlY3Rpb24odGhpcy5fc2VsZWN0aW9uSWQhKTtcblx0XHRcdFx0fVxuXG5cdFx0XHR9XG5cblx0XHRcdHZpZXdNb2RlbC5leGVjdXRlQ29tbWFuZChuZXcgVGVzdENvbW1hbmQoKSwgJ2F1dG9Gb3JtYXQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ2Z1bmN0aW9uIGZvbyhwYXJhbXM6IHN0cmluZykgeycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnICAgICcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnfScpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZW1vdmVBdXRvV2hpdGVzcGFjZSBvbjogcmVtb3ZlcyBvbmx5IHdoaXRlc3BhY2UgdGhlIGN1cnNvciBhZGRlZCAyJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxhbmd1YWdlSWQgPSAndGVzdExhbmcnO1xuXHRcdGNvbnN0IHJlZ2lzdHJhdGlvbiA9IGxhbmd1YWdlU2VydmljZS5yZWdpc3Rlckxhbmd1YWdlKHsgaWQ6IGxhbmd1YWdlSWQgfSk7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCcgICAgaWYgKGEpIHsnLFxuXHRcdFx0XHQnICAgICAgICAnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcgICAgfSdcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHRsYW5ndWFnZUlkXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDMsIDEpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5UYWIucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnICAgIGlmIChhKSB7Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICcgICAgICAgICcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnICAgICcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDQpLCAnJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNSksICcgICAgfScpO1xuXG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDQsIDEpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5UYWIucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnICAgIGlmIChhKSB7Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICcgICAgICAgICcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNCksICcgICAgJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNSksICcgICAgfScpO1xuXG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDUsIG1vZGVsLmdldExpbmVNYXhDb2x1bW4oNSkpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ3NvbWV0aGluZycsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnICAgIGlmIChhKSB7Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICcgICAgICAgICcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNCksICcnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg1KSwgJyAgICB9c29tZXRoaW5nJyk7XG5cdFx0fSk7XG5cblx0XHRyZWdpc3RyYXRpb24uZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZW1vdmVBdXRvV2hpdGVzcGFjZSBvbjogdGVzdCAxJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnICAgIHNvbWUgIGxpbmUgYWJjICAnXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXG5cdFx0XHQvLyBNb3ZlIGN1cnNvciB0byB0aGUgZW5kLCB2ZXJpZnkgdGhhdCB3ZSBkbyBub3QgdHJpbSB3aGl0ZXNwYWNlcyBpZiBsaW5lIGhhcyB2YWx1ZXNcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgbW9kZWwuZ2V0TGluZUNvbnRlbnQoMSkubGVuZ3RoICsgMSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICcgICAgc29tZSAgbGluZSBhYmMgICcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnICAgICcpO1xuXG5cdFx0XHQvLyBUcnkgdG8gZW50ZXIgYWdhaW4sIHdlIHNob3VsZCB0cmltbWVkIHByZXZpb3VzIGxpbmVcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcXG4nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJyAgICBzb21lICBsaW5lIGFiYyAgJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICcnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgzKSwgJyAgICAnKTtcblxuXHRcdFx0Ly8gTW9yZSB3aGl0ZXNwYWNlc1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5UYWIucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnICAgIHNvbWUgIGxpbmUgYWJjICAnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnICAgICAgICAnKTtcblxuXHRcdFx0Ly8gRW50ZXIgYW5kIHZlcmlmeSB0aGF0IHRyaW1tZWQgYWdhaW5cblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcXG4nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJyAgICBzb21lICBsaW5lIGFiYyAgJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICcnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgzKSwgJycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDQpLCAnICAgICAgICAnKTtcblxuXHRcdFx0Ly8gVHJpbW1lZCBpZiB3ZSB3aWxsIGtlZXAgb25seSB0ZXh0XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDUpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnICAgICcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnICAgIHNvbWUgIGxpbmUgYWJjICAnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgzKSwgJycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDQpLCAnJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNSksICcnKTtcblxuXHRcdFx0Ly8gVHJpbW1lZCBpZiB3ZSB3aWxsIGtlZXAgb25seSB0ZXh0IGJ5IHNlbGVjdGlvblxuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAyLCA1KTtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMywgMSwgdHJ1ZSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICcgICAgJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICcgICAgJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMyksICcgICAgJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNCksICcnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg1KSwgJycpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTUxMTg6IHJlbW92ZSBhdXRvIHdoaXRlc3BhY2Ugd2hlbiBwYXN0aW5nIGVudGlyZSBsaW5lJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnICAgIGZ1bmN0aW9uIGYoKSB7Jyxcblx0XHRcdFx0JyAgICAgICAgLy8gSVxcJ20gZ29ubmEgY29weSB0aGlzIGxpbmUnLFxuXHRcdFx0XHQnICAgICAgICByZXR1cm4gMzsnLFxuXHRcdFx0XHQnICAgIH0nLFxuXHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblxuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKDMpKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcXG4nLCAna2V5Ym9hcmQnKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0JyAgICBmdW5jdGlvbiBmKCkgeycsXG5cdFx0XHRcdCcgICAgICAgIC8vIElcXCdtIGdvbm5hIGNvcHkgdGhpcyBsaW5lJyxcblx0XHRcdFx0JyAgICAgICAgcmV0dXJuIDM7Jyxcblx0XHRcdFx0JyAgICAgICAgJyxcblx0XHRcdFx0JyAgICB9Jyxcblx0XHRcdF0uam9pbignXFxuJykpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDQsIG1vZGVsLmdldExpbmVNYXhDb2x1bW4oNCkpKTtcblxuXHRcdFx0dmlld01vZGVsLnBhc3RlKCcgICAgICAgIC8vIElcXCdtIGdvbm5hIGNvcHkgdGhpcyBsaW5lXFxuJywgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnICAgIGZ1bmN0aW9uIGYoKSB7Jyxcblx0XHRcdFx0JyAgICAgICAgLy8gSVxcJ20gZ29ubmEgY29weSB0aGlzIGxpbmUnLFxuXHRcdFx0XHQnICAgICAgICByZXR1cm4gMzsnLFxuXHRcdFx0XHQnICAgICAgICAvLyBJXFwnbSBnb25uYSBjb3B5IHRoaXMgbGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnICAgIH0nLFxuXHRcdFx0XS5qb2luKCdcXG4nKSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oNSwgMSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNDA2OTU6IG1haW50YWluIGN1cnNvciBwb3NpdGlvbiB3aGVuIGNvcHlpbmcgbGluZXMgdXNpbmcgY3RybCtjLCBjdHJsK3YnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCcgICAgZnVuY3Rpb24gZigpIHsnLFxuXHRcdFx0XHQnICAgICAgICAvLyBJXFwnbSBnb25uYSBjb3B5IHRoaXMgbGluZScsXG5cdFx0XHRcdCcgICAgICAgIC8vIEFub3RoZXIgbGluZScsXG5cdFx0XHRcdCcgICAgICAgIHJldHVybiAzOycsXG5cdFx0XHRcdCcgICAgfScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbbmV3IFNlbGVjdGlvbig0LCAxMCwgNCwgMTApXSk7XG5cdFx0XHR2aWV3TW9kZWwucGFzdGUoJyAgICAgICAgLy8gSVxcJ20gZ29ubmEgY29weSB0aGlzIGxpbmVcXG4nLCB0cnVlKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0JyAgICBmdW5jdGlvbiBmKCkgeycsXG5cdFx0XHRcdCcgICAgICAgIC8vIElcXCdtIGdvbm5hIGNvcHkgdGhpcyBsaW5lJyxcblx0XHRcdFx0JyAgICAgICAgLy8gQW5vdGhlciBsaW5lJyxcblx0XHRcdFx0JyAgICAgICAgLy8gSVxcJ20gZ29ubmEgY29weSB0aGlzIGxpbmUnLFxuXHRcdFx0XHQnICAgICAgICByZXR1cm4gMzsnLFxuXHRcdFx0XHQnICAgIH0nLFxuXHRcdFx0XS5qb2luKCdcXG4nKSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oNSwgMTApKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnVXNlVGFiU3RvcHMgaXMgb2ZmJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnICAgIHgnLFxuXHRcdFx0XHQnICAgICAgICBhICAgICcsXG5cdFx0XHRcdCcgICAgJ1xuXHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgdXNlVGFiU3RvcHM6IGZhbHNlIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0Ly8gRGVsZXRlTGVmdCByZW1vdmVzIGp1c3Qgb25lIHdoaXRlc3BhY2Vcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMiwgOSk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnICAgICAgIGEgICAgJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0JhY2tzcGFjZSByZW1vdmVzIHdoaXRlc3BhY2VzIHdpdGggdGFiIHNpemUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCcgXFx0IFxcdCAgICAgeCcsXG5cdFx0XHRcdCcgICAgICAgIGEgICAgJyxcblx0XHRcdFx0JyAgICAnXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyB1c2VUYWJTdG9wczogdHJ1ZSB9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdC8vIERlbGV0ZUxlZnQgZG9lcyBub3QgcmVtb3ZlIHRhYiBzaXplLCBiZWNhdXNlIHNvbWUgdGV4dCBleGlzdHMgYmVmb3JlXG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDIsIG1vZGVsLmdldExpbmVDb250ZW50KDIpLmxlbmd0aCArIDEpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJyAgICAgICAgYSAgICcpO1xuXG5cdFx0XHQvLyBEZWxldGVMZWZ0IHJlbW92ZXMgdGFiIHNpemUgPSA0XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDIsIDkpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJyAgICBhICAgJyk7XG5cblx0XHRcdC8vIERlbGV0ZUxlZnQgcmVtb3ZlcyB0YWIgc2l6ZSA9IDRcblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICdhICAgJyk7XG5cblx0XHRcdC8vIFVuZG8gRGVsZXRlTGVmdCAtIGdldCB1cyBiYWNrIHRvIG9yaWdpbmFsIGluZGVudGF0aW9uXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnICAgICAgICBhICAgJyk7XG5cblx0XHRcdC8vIE5vdGhpbmcgaXMgYnJva2VuIHdoZW4gY3Vyc29yIGlzIGluICgxLDEpXG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDEpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJyBcXHQgXFx0ICAgICB4Jyk7XG5cblx0XHRcdC8vIERlbGV0ZUxlZnQgc3RvcHMgYXQgdGFiIHN0b3BzIGV2ZW4gaW4gbWl4ZWQgd2hpdGVzcGFjZSBjYXNlXG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDEwKTtcblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICcgXFx0IFxcdCAgICB4Jyk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICcgXFx0IFxcdHgnKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJyBcXHR4Jyk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICd4Jyk7XG5cblx0XHRcdC8vIERlbGV0ZUxlZnQgb24gbGFzdCBsaW5lXG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDMsIG1vZGVsLmdldExpbmVDb250ZW50KDMpLmxlbmd0aCArIDEpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgzKSwgJycpO1xuXG5cdFx0XHQvLyBEZWxldGVMZWZ0IHdpdGggcmVtb3ZpbmcgbmV3IGxpbmUgc3ltYm9sXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAneFxcbiAgICAgICAgYSAgICcpO1xuXG5cdFx0XHQvLyBJbiBjYXNlIG9mIHNlbGVjdGlvbiBEZWxldGVMZWZ0IG9ubHkgZGVsZXRlcyBzZWxlY3RlZCB0ZXh0XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDIsIDMpO1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAyLCA0LCB0cnVlKTtcblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICcgICAgICAgYSAgICcpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdQUiAjNTQyMzogQXV0byBpbmRlbnQgKyB1bmRvICsgcmVkbyBpcyBmdW5reScsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFtcblx0XHRcdFx0Jydcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHR7XG5cdFx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnXFxuJywgJ2Fzc2VydDEnKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5UYWIucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnXFxuXFx0JywgJ2Fzc2VydDInKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ3knLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1xcblxcdHknLCAnYXNzZXJ0MicpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICdcXG5cXHR5XFxuXFx0JywgJ2Fzc2VydDMnKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ3gnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1xcblxcdHlcXG5cXHR4JywgJ2Fzc2VydDQnKTtcblxuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JMZWZ0LnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge30pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnXFxuXFx0eVxcblxcdHgnLCAnYXNzZXJ0NScpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnXFxuXFx0eVxcbngnLCAnYXNzZXJ0NicpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnXFxuXFx0eXgnLCAnYXNzZXJ0NycpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnXFxuXFx0eCcsICdhc3NlcnQ4Jyk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICdcXG54JywgJ2Fzc2VydDknKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ3gnLCAnYXNzZXJ0MTAnKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1xcbngnLCAnYXNzZXJ0MTEnKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1xcblxcdHlcXG54JywgJ2Fzc2VydDEyJyk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuVW5kby5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICdcXG5cXHR5XFxuXFx0eCcsICdhc3NlcnQxMycpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlJlZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnXFxuXFx0eVxcbngnLCAnYXNzZXJ0MTQnKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5SZWRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ1xcbngnLCAnYXNzZXJ0MTUnKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5SZWRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ3gnLCAnYXNzZXJ0MTYnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzkwOTczOiBVbmRvIGJyaW5ncyBiYWNrIG1vZGVsIGFsdGVybmF0aXZlIHZlcnNpb24nLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCcnXG5cdFx0XHRdLmpvaW4oJ1xcbicpLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0e1xuXHRcdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlLFxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGNvbnN0IGJlZm9yZVZlcnNpb24gPSBtb2RlbC5nZXRWZXJzaW9uSWQoKTtcblx0XHRcdGNvbnN0IGJlZm9yZUFsdFZlcnNpb24gPSBtb2RlbC5nZXRBbHRlcm5hdGl2ZVZlcnNpb25JZCgpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ0hlbGxvJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0Y29uc3QgYWZ0ZXJWZXJzaW9uID0gbW9kZWwuZ2V0VmVyc2lvbklkKCk7XG5cdFx0XHRjb25zdCBhZnRlckFsdFZlcnNpb24gPSBtb2RlbC5nZXRBbHRlcm5hdGl2ZVZlcnNpb25JZCgpO1xuXG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoYmVmb3JlVmVyc2lvbiwgYWZ0ZXJWZXJzaW9uKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiZWZvcmVBbHRWZXJzaW9uLCBhZnRlckFsdFZlcnNpb24pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdFbnRlciBob25vcnMgaW5jcmVhc2VJbmRlbnRQYXR0ZXJuJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J2lmICh0cnVlKSB7Jyxcblx0XHRcdFx0J1xcdGlmICh0cnVlKSB7J1xuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGluZGVudFJ1bGVzTGFuZ3VhZ2VJZCxcblx0XHRcdG1vZGVsT3B0czogeyBpbnNlcnRTcGFjZXM6IGZhbHNlIH0sXG5cdFx0XHRlZGl0b3JPcHRzOiB7IGF1dG9JbmRlbnQ6ICdmdWxsJyB9XG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCAxMiwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCAxMiwgMSwgMTIpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKG1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMiwgMiwgMiwgMikpO1xuXG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDMsIDEzLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDMsIDEzLCAzLCAxMykpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDQsIDMsIDQsIDMpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnVHlwZSBob25vcnMgZGVjcmVhc2VJbmRlbnRQYXR0ZXJuJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J2lmICh0cnVlKSB7Jyxcblx0XHRcdFx0J1xcdCdcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBpbmRlbnRSdWxlc0xhbmd1YWdlSWQsXG5cdFx0XHRlZGl0b3JPcHRzOiB7IGF1dG9JbmRlbnQ6ICdmdWxsJyB9XG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAyLCAyLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDIsIDIsIDIsIDIpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ30nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMiwgMiwgMiwgMikpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnfScsICcwMDEnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRW50ZXIgaG9ub3JzIHVuSW5kZW50ZWRMaW5lUGF0dGVybicsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCdpZiAodHJ1ZSkgeycsXG5cdFx0XHRcdCdcXHRcXHRcXHRyZXR1cm4gdHJ1ZSdcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBpbmRlbnRSdWxlc0xhbmd1YWdlSWQsXG5cdFx0XHRtb2RlbE9wdHM6IHsgaW5zZXJ0U3BhY2VzOiBmYWxzZSB9LFxuXHRcdFx0ZWRpdG9yT3B0czogeyBhdXRvSW5kZW50OiAnZnVsbCcgfVxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMiwgMTUsIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMiwgMTUsIDIsIDE1KSk7XG5cblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcXG4nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMywgMiwgMywgMikpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdFbnRlciBob25vcnMgaW5kZW50TmV4dExpbmVQYXR0ZXJuJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J2lmICh0cnVlKScsXG5cdFx0XHRcdCdcXHRyZXR1cm4gdHJ1ZTsnLFxuXHRcdFx0XHQnaWYgKHRydWUpJyxcblx0XHRcdFx0J1xcdFxcdFxcdFxcdHJldHVybiB0cnVlJ1xuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGluZGVudFJ1bGVzTGFuZ3VhZ2VJZCxcblx0XHRcdG1vZGVsT3B0czogeyBpbnNlcnRTcGFjZXM6IGZhbHNlIH0sXG5cdFx0XHRlZGl0b3JPcHRzOiB7IGF1dG9JbmRlbnQ6ICdmdWxsJyB9XG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAyLCAxNCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigyLCAxNCwgMiwgMTQpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKG1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMywgMSwgMywgMSkpO1xuXG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDUsIDE2LCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDUsIDE2LCA1LCAxNikpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDYsIDIsIDYsIDIpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRW50ZXIgaG9ub3JzIGluZGVudE5leHRMaW5lUGF0dGVybiAyJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnaWYgKHRydWUpJyxcblx0XHRcdFx0J1xcdGlmICh0cnVlKSdcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHRpbmRlbnRSdWxlc0xhbmd1YWdlSWQsXG5cdFx0XHR7XG5cdFx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyBhdXRvSW5kZW50OiAnZnVsbCcgfSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDIsIDExLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDIsIDExLCAyLCAxMSkpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRtb2RlbC50b2tlbml6YXRpb24uZm9yY2VUb2tlbml6YXRpb24obW9kZWwuZ2V0TGluZUNvdW50KCkpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigzLCAzLCAzLCAzKSk7XG5cblx0XHRcdHZpZXdNb2RlbC50eXBlKCdjb25zb2xlLmxvZygpOycsICdrZXlib2FyZCcpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbig0LCAxLCA0LCAxKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0VudGVyIGhvbm9ycyBpbnRlbnRpYWwgaW5kZW50JywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J2lmICh0cnVlKSB7Jyxcblx0XHRcdFx0J1xcdGlmICh0cnVlKSB7Jyxcblx0XHRcdFx0J3JldHVybiB0cnVlOycsXG5cdFx0XHRcdCd9fSdcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBpbmRlbnRSdWxlc0xhbmd1YWdlSWQsXG5cdFx0XHRlZGl0b3JPcHRzOiB7IGF1dG9JbmRlbnQ6ICdmdWxsJyB9XG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCAxMywgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigzLCAxMywgMywgMTMpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbig0LCAxLCA0LCAxKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMyksICdyZXR1cm4gdHJ1ZTsnLCAnMDAxJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0VudGVyIHN1cHBvcnRzIHNlbGVjdGlvbiAxJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J2lmICh0cnVlKSB7Jyxcblx0XHRcdFx0J1xcdGlmICh0cnVlKSB7Jyxcblx0XHRcdFx0J1xcdFxcdHJldHVybiB0cnVlOycsXG5cdFx0XHRcdCdcXHR9YX0nXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogaW5kZW50UnVsZXNMYW5ndWFnZUlkLFxuXHRcdFx0bW9kZWxPcHRzOiB7IGluc2VydFNwYWNlczogZmFsc2UgfVxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgNCwgMywgZmFsc2UpO1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCA0LCA0LCB0cnVlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oNCwgMywgNCwgNCkpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDUsIDEsIDUsIDEpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg0KSwgJ1xcdH0nLCAnMDAxJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0VudGVyIHN1cHBvcnRzIHNlbGVjdGlvbiAyJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J2lmICh0cnVlKSB7Jyxcblx0XHRcdFx0J1xcdGlmICh0cnVlKSB7J1xuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGluZGVudFJ1bGVzTGFuZ3VhZ2VJZCxcblx0XHRcdG1vZGVsT3B0czogeyBpbnNlcnRTcGFjZXM6IGZhbHNlIH1cblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDIsIDEyLCBmYWxzZSk7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDIsIDEzLCB0cnVlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMiwgMTIsIDIsIDEzKSk7XG5cblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcXG4nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMywgMywgMywgMykpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDQsIDMsIDQsIDMpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRW50ZXIgaG9ub3JzIHRhYlNpemUgYW5kIGluc2VydFNwYWNlcyAxJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J2lmICh0cnVlKSB7Jyxcblx0XHRcdFx0J1xcdGlmICh0cnVlKSB7J1xuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGluZGVudFJ1bGVzTGFuZ3VhZ2VJZCxcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDEyLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDEyLCAxLCAxMikpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDIsIDUsIDIsIDUpKTtcblxuXHRcdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKG1vZGVsLmdldExpbmVDb3VudCgpKTtcblxuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCAxMywgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigzLCAxMywgMywgMTMpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbig0LCA5LCA0LCA5KSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0VudGVyIGhvbm9ycyB0YWJTaXplIGFuZCBpbnNlcnRTcGFjZXMgMicsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCdpZiAodHJ1ZSkgeycsXG5cdFx0XHRcdCcgICAgaWYgKHRydWUpIHsnXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogaW5kZW50UnVsZXNMYW5ndWFnZUlkLFxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgMTIsIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgMTIsIDEsIDEyKSk7XG5cblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcXG4nLCAna2V5Ym9hcmQnKTtcblx0XHRcdG1vZGVsLnRva2VuaXphdGlvbi5mb3JjZVRva2VuaXphdGlvbihtb2RlbC5nZXRMaW5lQ291bnQoKSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDIsIDUsIDIsIDUpKTtcblxuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCAxNiwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigzLCAxNiwgMywgMTYpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnICAgIGlmICh0cnVlKSB7Jyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDQsIDksIDQsIDkpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRW50ZXIgaG9ub3JzIHRhYlNpemUgYW5kIGluc2VydFNwYWNlcyAzJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J2lmICh0cnVlKSB7Jyxcblx0XHRcdFx0JyAgICBpZiAodHJ1ZSkgeydcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBpbmRlbnRSdWxlc0xhbmd1YWdlSWQsXG5cdFx0XHRtb2RlbE9wdHM6IHsgaW5zZXJ0U3BhY2VzOiBmYWxzZSB9XG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCAxMiwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCAxMiwgMSwgMTIpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKG1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMiwgMiwgMiwgMikpO1xuXG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDMsIDE2LCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDMsIDE2LCAzLCAxNikpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMyksICcgICAgaWYgKHRydWUpIHsnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oNCwgMywgNCwgMykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdFbnRlciBzdXBwb3J0cyBpbnRlbnRpb25hbCBpbmRlbnRhdGlvbicsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCdcXHRpZiAodHJ1ZSkgeycsXG5cdFx0XHRcdCdcXHRcXHRzd2l0Y2godHJ1ZSkgeycsXG5cdFx0XHRcdCdcXHRcXHRcXHRjYXNlIHRydWU6Jyxcblx0XHRcdFx0J1xcdFxcdFxcdFxcdGJyZWFrOycsXG5cdFx0XHRcdCdcXHRcXHR9Jyxcblx0XHRcdFx0J1xcdH0nXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogaW5kZW50UnVsZXNMYW5ndWFnZUlkLFxuXHRcdFx0bW9kZWxPcHRzOiB7IGluc2VydFNwYWNlczogZmFsc2UgfSxcblx0XHRcdGVkaXRvck9wdHM6IHsgYXV0b0luZGVudDogJ2Z1bGwnIH1cblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDUsIDQsIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oNSwgNCwgNSwgNCkpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNSksICdcXHRcXHR9Jyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDYsIDMsIDYsIDMpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRW50ZXIgc2hvdWxkIG5vdCBhZGp1c3QgY3Vyc29yIHBvc2l0aW9uIHdoZW4gcHJlc3MgZW50ZXIgaW4gdGhlIG1pZGRsZSBvZiBhIGxpbmUgMScsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCdpZiAodHJ1ZSkgeycsXG5cdFx0XHRcdCdcXHRpZiAodHJ1ZSkgeycsXG5cdFx0XHRcdCdcXHRcXHRyZXR1cm4gdHJ1ZTsnLFxuXHRcdFx0XHQnXFx0fWF9J1xuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGluZGVudFJ1bGVzTGFuZ3VhZ2VJZCxcblx0XHRcdG1vZGVsT3B0czogeyBpbnNlcnRTcGFjZXM6IGZhbHNlIH1cblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDMsIDksIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMywgOSwgMywgOSkpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDQsIDMsIDQsIDMpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg0KSwgJ1xcdFxcdCB0cnVlOycsICcwMDEnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRW50ZXIgc2hvdWxkIG5vdCBhZGp1c3QgY3Vyc29yIHBvc2l0aW9uIHdoZW4gcHJlc3MgZW50ZXIgaW4gdGhlIG1pZGRsZSBvZiBhIGxpbmUgMicsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCdpZiAodHJ1ZSkgeycsXG5cdFx0XHRcdCdcXHRpZiAodHJ1ZSkgeycsXG5cdFx0XHRcdCdcXHRcXHRyZXR1cm4gdHJ1ZTsnLFxuXHRcdFx0XHQnXFx0fWF9J1xuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGluZGVudFJ1bGVzTGFuZ3VhZ2VJZCxcblx0XHRcdG1vZGVsT3B0czogeyBpbnNlcnRTcGFjZXM6IGZhbHNlIH1cblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDMsIDMsIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMywgMywgMywgMykpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDQsIDMsIDQsIDMpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg0KSwgJ1xcdFxcdHJldHVybiB0cnVlOycsICcwMDEnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRW50ZXIgc2hvdWxkIG5vdCBhZGp1c3QgY3Vyc29yIHBvc2l0aW9uIHdoZW4gcHJlc3MgZW50ZXIgaW4gdGhlIG1pZGRsZSBvZiBhIGxpbmUgMycsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCdpZiAodHJ1ZSkgeycsXG5cdFx0XHRcdCcgIGlmICh0cnVlKSB7Jyxcblx0XHRcdFx0JyAgICByZXR1cm4gdHJ1ZTsnLFxuXHRcdFx0XHQnICB9YX0nXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogaW5kZW50UnVsZXNMYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCAxMSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigzLCAxMSwgMywgMTEpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbig0LCA1LCA0LCA1KSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNCksICcgICAgIHRydWU7JywgJzAwMScpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdFbnRlciBzaG91bGQgYWRqdXN0IGN1cnNvciBwb3NpdGlvbiB3aGVuIHByZXNzIGVudGVyIGluIHRoZSBtaWRkbGUgb2YgbGVhZGluZyB3aGl0ZXNwYWNlcyAxJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J2lmICh0cnVlKSB7Jyxcblx0XHRcdFx0J1xcdGlmICh0cnVlKSB7Jyxcblx0XHRcdFx0J1xcdFxcdHJldHVybiB0cnVlOycsXG5cdFx0XHRcdCdcXHR9YX0nXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogaW5kZW50UnVsZXNMYW5ndWFnZUlkLFxuXHRcdFx0bW9kZWxPcHRzOiB7IGluc2VydFNwYWNlczogZmFsc2UgfVxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMywgMiwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigzLCAyLCAzLCAyKSk7XG5cblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcXG4nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oNCwgMiwgNCwgMikpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDQpLCAnXFx0XFx0cmV0dXJuIHRydWU7JywgJzAwMScpO1xuXG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDQsIDEsIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oNCwgMSwgNCwgMSkpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDUsIDEsIDUsIDEpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg1KSwgJ1xcdFxcdHJldHVybiB0cnVlOycsICcwMDInKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRW50ZXIgc2hvdWxkIGFkanVzdCBjdXJzb3IgcG9zaXRpb24gd2hlbiBwcmVzcyBlbnRlciBpbiB0aGUgbWlkZGxlIG9mIGxlYWRpbmcgd2hpdGVzcGFjZXMgMicsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCdcXHRpZiAodHJ1ZSkgeycsXG5cdFx0XHRcdCdcXHRcXHRpZiAodHJ1ZSkgeycsXG5cdFx0XHRcdCdcXHQgICAgXFx0cmV0dXJuIHRydWU7Jyxcblx0XHRcdFx0J1xcdFxcdH1hfSdcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBpbmRlbnRSdWxlc0xhbmd1YWdlSWQsXG5cdFx0XHRtb2RlbE9wdHM6IHsgaW5zZXJ0U3BhY2VzOiBmYWxzZSB9XG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCA0LCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDMsIDQsIDMsIDQpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbig0LCAzLCA0LCAzKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNCksICdcXHRcXHRcXHRyZXR1cm4gdHJ1ZTsnLCAnMDAxJyk7XG5cblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgNCwgMSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbig0LCAxLCA0LCAxKSk7XG5cblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcXG4nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oNSwgMSwgNSwgMSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDUpLCAnXFx0XFx0XFx0cmV0dXJuIHRydWU7JywgJzAwMicpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdFbnRlciBzaG91bGQgYWRqdXN0IGN1cnNvciBwb3NpdGlvbiB3aGVuIHByZXNzIGVudGVyIGluIHRoZSBtaWRkbGUgb2YgbGVhZGluZyB3aGl0ZXNwYWNlcyAzJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J2lmICh0cnVlKSB7Jyxcblx0XHRcdFx0JyAgaWYgKHRydWUpIHsnLFxuXHRcdFx0XHQnICAgIHJldHVybiB0cnVlOycsXG5cdFx0XHRcdCd9YX0nXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogaW5kZW50UnVsZXNMYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCAyLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDMsIDIsIDMsIDIpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbig0LCAyLCA0LCAyKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNCksICcgICAgcmV0dXJuIHRydWU7JywgJzAwMScpO1xuXG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDQsIDMsIGZhbHNlKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcXG4nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oNSwgMywgNSwgMykpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDUpLCAnICAgIHJldHVybiB0cnVlOycsICcwMDInKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRW50ZXIgc2hvdWxkIGFkanVzdCBjdXJzb3IgcG9zaXRpb24gd2hlbiBwcmVzcyBlbnRlciBpbiB0aGUgbWlkZGxlIG9mIGxlYWRpbmcgd2hpdGVzcGFjZXMgNCcsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCdpZiAodHJ1ZSkgeycsXG5cdFx0XHRcdCcgIGlmICh0cnVlKSB7Jyxcblx0XHRcdFx0J1xcdCAgcmV0dXJuIHRydWU7Jyxcblx0XHRcdFx0J31hfScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnaWYgKHRydWUpIHsnLFxuXHRcdFx0XHQnICBpZiAodHJ1ZSkgeycsXG5cdFx0XHRcdCdcXHQgIHJldHVybiB0cnVlOycsXG5cdFx0XHRcdCd9YX0nXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogaW5kZW50UnVsZXNMYW5ndWFnZUlkLFxuXHRcdFx0bW9kZWxPcHRzOiB7XG5cdFx0XHRcdHRhYlNpemU6IDIsXG5cdFx0XHRcdGluZGVudFNpemU6IDJcblx0XHRcdH1cblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDMsIDMsIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMywgMywgMywgMykpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDQsIDQsIDQsIDQpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg0KSwgJyAgICByZXR1cm4gdHJ1ZTsnLCAnMDAxJyk7XG5cblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgOSwgNCwgZmFsc2UpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxMCwgNSwgMTAsIDUpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxMCksICcgICAgcmV0dXJuIHRydWU7JywgJzAwMScpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdFbnRlciBzaG91bGQgYWRqdXN0IGN1cnNvciBwb3NpdGlvbiB3aGVuIHByZXNzIGVudGVyIGluIHRoZSBtaWRkbGUgb2YgbGVhZGluZyB3aGl0ZXNwYWNlcyA1JywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J2lmICh0cnVlKSB7Jyxcblx0XHRcdFx0JyAgaWYgKHRydWUpIHsnLFxuXHRcdFx0XHQnICAgIHJldHVybiB0cnVlOycsXG5cdFx0XHRcdCcgICAgcmV0dXJuIHRydWU7Jyxcblx0XHRcdFx0Jydcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBpbmRlbnRSdWxlc0xhbmd1YWdlSWQsXG5cdFx0XHRtb2RlbE9wdHM6IHsgdGFiU2l6ZTogMiB9XG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCA1LCBmYWxzZSk7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDQsIDMsIHRydWUpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigzLCA1LCA0LCAzKSk7XG5cblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcXG4nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oNCwgMywgNCwgMykpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDQpLCAnICAgIHJldHVybiB0cnVlOycsICcwMDEnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgbWljcm9zb2Z0L21vbmFjby1lZGl0b3IjMTA4IHBhcnQgMS8yOiBBdXRvIGluZGVudGF0aW9uIG9uIEVudGVyIHdpdGggc2VsZWN0aW9uIGlzIGhhbGYgYnJva2VuJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J2Z1bmN0aW9uIGJheigpIHsnLFxuXHRcdFx0XHQnXFx0dmFyIHggPSAxOycsXG5cdFx0XHRcdCdcXHRcXHRcXHRcXHRcXHRcXHRcXHRyZXR1cm4geDsnLFxuXHRcdFx0XHQnfSdcblx0XHRcdF0sXG5cdFx0XHRtb2RlbE9wdHM6IHtcblx0XHRcdFx0aW5zZXJ0U3BhY2VzOiBmYWxzZSxcblx0XHRcdH0sXG5cdFx0XHRsYW5ndWFnZUlkOiBpbmRlbnRSdWxlc0xhbmd1YWdlSWQsXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCA4LCBmYWxzZSk7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDIsIDEyLCB0cnVlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMywgOCwgMiwgMTIpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnXFx0cmV0dXJuIHg7Jyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMywgMikpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSBtaWNyb3NvZnQvbW9uYWNvLWVkaXRvciMxMDggcGFydCAyLzI6IEF1dG8gaW5kZW50YXRpb24gb24gRW50ZXIgd2l0aCBzZWxlY3Rpb24gaXMgaGFsZiBicm9rZW4nLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnZnVuY3Rpb24gYmF6KCkgeycsXG5cdFx0XHRcdCdcXHR2YXIgeCA9IDE7Jyxcblx0XHRcdFx0J1xcdFxcdFxcdFxcdFxcdFxcdFxcdHJldHVybiB4OycsXG5cdFx0XHRcdCd9J1xuXHRcdFx0XSxcblx0XHRcdG1vZGVsT3B0czoge1xuXHRcdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlLFxuXHRcdFx0fSxcblx0XHRcdGxhbmd1YWdlSWQ6IGluZGVudFJ1bGVzTGFuZ3VhZ2VJZCxcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDIsIDEyLCBmYWxzZSk7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDMsIDgsIHRydWUpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigyLCAxMiwgMywgOCkpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMyksICdcXHRyZXR1cm4geDsnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigzLCAyKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ29uRW50ZXIgd29ya3MgaWYgdGhlcmUgYXJlIG5vIGluZGVudGF0aW9uIHJ1bGVzJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0Jzw/Jyxcblx0XHRcdFx0J1xcdGlmICh0cnVlKSB7Jyxcblx0XHRcdFx0J1xcdFxcdGVjaG8gJGhpOycsXG5cdFx0XHRcdCdcXHRcXHRlY2hvICRieWU7Jyxcblx0XHRcdFx0J1xcdH0nLFxuXHRcdFx0XHQnPz4nXG5cdFx0XHRdLFxuXHRcdFx0bW9kZWxPcHRzOiB7IGluc2VydFNwYWNlczogZmFsc2UgfVxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgNSwgMywgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbig1LCAzLCA1LCAzKSk7XG5cblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcXG4nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg2KSwgJ1xcdCcpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbig2LCAyLCA2LCAyKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNSksICdcXHR9Jyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ29uRW50ZXIgd29ya3MgaWYgdGhlcmUgYXJlIG5vIGluZGVudGF0aW9uIHJ1bGVzIDInLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnXHRpZiAoNSknLFxuXHRcdFx0XHQnXHRcdHJldHVybiA1OycsXG5cdFx0XHRcdCdcdCdcblx0XHRcdF0sXG5cdFx0XHRtb2RlbE9wdHM6IHsgaW5zZXJ0U3BhY2VzOiBmYWxzZSB9XG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCAyLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDMsIDIsIDMsIDIpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbig0LCAyLCA0LCAyKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNCksICdcXHQnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnYnVnICMxNjU0MzogVGFiIHNob3VsZCBpbmRlbnQgdG8gY29ycmVjdCBpbmRlbnRhdGlvbiBzcG90IGltbWVkaWF0ZWx5JywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnZnVuY3Rpb24gYmF6KCkgeycsXG5cdFx0XHRcdCdcXHRmdW5jdGlvbiBoZWxsbygpIHsgLy8gc29tZXRoaW5nIGhlcmUnLFxuXHRcdFx0XHQnXFx0Jyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCdcXHR9Jyxcblx0XHRcdFx0J30nXG5cdFx0XHRdLmpvaW4oJ1xcbicpLFxuXHRcdFx0aW5kZW50UnVsZXNMYW5ndWFnZUlkLFxuXHRcdFx0e1xuXHRcdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlLFxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgNCwgMSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbig0LCAxLCA0LCAxKSk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuVGFiLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg0KSwgJ1xcdFxcdCcpO1xuXHRcdH0pO1xuXHR9KTtcblxuXG5cdHRlc3QoJ2J1ZyAjMjkzOCAoMSk6IFdoZW4gcHJlc3NpbmcgVGFiIG9uIHdoaXRlLXNwYWNlIG9ubHkgbGluZXMsIGluZGVudCBzdHJhaWdodCB0byB0aGUgcmlnaHQgc3BvdCAoc2ltaWxhciB0byBlbXB0eSBsaW5lcyknLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHRmdW5jdGlvbiBiYXooKSB7Jyxcblx0XHRcdFx0J1xcdFxcdGZ1bmN0aW9uIGhlbGxvKCkgeyAvLyBzb21ldGhpbmcgaGVyZScsXG5cdFx0XHRcdCdcXHRcXHQnLFxuXHRcdFx0XHQnXFx0Jyxcblx0XHRcdFx0J1xcdFxcdH0nLFxuXHRcdFx0XHQnXFx0fSdcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHRpbmRlbnRSdWxlc0xhbmd1YWdlSWQsXG5cdFx0XHR7XG5cdFx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCA0LCAyLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDQsIDIsIDQsIDIpKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5UYWIucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDQpLCAnXFx0XFx0XFx0Jyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cblx0dGVzdCgnYnVnICMyOTM4ICgyKTogV2hlbiBwcmVzc2luZyBUYWIgb24gd2hpdGUtc3BhY2Ugb25seSBsaW5lcywgaW5kZW50IHN0cmFpZ2h0IHRvIHRoZSByaWdodCBzcG90IChzaW1pbGFyIHRvIGVtcHR5IGxpbmVzKScsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFtcblx0XHRcdFx0J1xcdGZ1bmN0aW9uIGJheigpIHsnLFxuXHRcdFx0XHQnXFx0XFx0ZnVuY3Rpb24gaGVsbG8oKSB7IC8vIHNvbWV0aGluZyBoZXJlJyxcblx0XHRcdFx0J1xcdFxcdCcsXG5cdFx0XHRcdCcgICAgJyxcblx0XHRcdFx0J1xcdFxcdH0nLFxuXHRcdFx0XHQnXFx0fSdcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHRpbmRlbnRSdWxlc0xhbmd1YWdlSWQsXG5cdFx0XHR7XG5cdFx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCA0LCAxLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDQsIDEsIDQsIDEpKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5UYWIucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDQpLCAnXFx0XFx0XFx0Jyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2J1ZyAjMjkzOCAoMyk6IFdoZW4gcHJlc3NpbmcgVGFiIG9uIHdoaXRlLXNwYWNlIG9ubHkgbGluZXMsIGluZGVudCBzdHJhaWdodCB0byB0aGUgcmlnaHQgc3BvdCAoc2ltaWxhciB0byBlbXB0eSBsaW5lcyknLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHRmdW5jdGlvbiBiYXooKSB7Jyxcblx0XHRcdFx0J1xcdFxcdGZ1bmN0aW9uIGhlbGxvKCkgeyAvLyBzb21ldGhpbmcgaGVyZScsXG5cdFx0XHRcdCdcXHRcXHQnLFxuXHRcdFx0XHQnXFx0XFx0XFx0Jyxcblx0XHRcdFx0J1xcdFxcdH0nLFxuXHRcdFx0XHQnXFx0fSdcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHRpbmRlbnRSdWxlc0xhbmd1YWdlSWQsXG5cdFx0XHR7XG5cdFx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCA0LCAzLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDQsIDMsIDQsIDMpKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5UYWIucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDQpLCAnXFx0XFx0XFx0XFx0Jyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2J1ZyAjMjkzOCAoNCk6IFdoZW4gcHJlc3NpbmcgVGFiIG9uIHdoaXRlLXNwYWNlIG9ubHkgbGluZXMsIGluZGVudCBzdHJhaWdodCB0byB0aGUgcmlnaHQgc3BvdCAoc2ltaWxhciB0byBlbXB0eSBsaW5lcyknLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHRmdW5jdGlvbiBiYXooKSB7Jyxcblx0XHRcdFx0J1xcdFxcdGZ1bmN0aW9uIGhlbGxvKCkgeyAvLyBzb21ldGhpbmcgaGVyZScsXG5cdFx0XHRcdCdcXHRcXHQnLFxuXHRcdFx0XHQnXFx0XFx0XFx0XFx0Jyxcblx0XHRcdFx0J1xcdFxcdH0nLFxuXHRcdFx0XHQnXFx0fSdcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHRpbmRlbnRSdWxlc0xhbmd1YWdlSWQsXG5cdFx0XHR7XG5cdFx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCA0LCA0LCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDQsIDQsIDQsIDQpKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5UYWIucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDQpLCAnXFx0XFx0XFx0XFx0XFx0Jyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2J1ZyAjMzEwMTU6IFdoZW4gcHJlc3NpbmcgVGFiIG9uIGxpbmVzIGFuZCBFbnRlciBydWxlcyBhcmUgYXZhaWwsIGluZGVudCBzdHJhaWdodCB0byB0aGUgcmlnaHQgc3BvdFRhYicsICgpID0+IHtcblx0XHRjb25zdCBvbkVudGVyTGFuZ3VhZ2VJZCA9IHNldHVwT25FbnRlckxhbmd1YWdlKEluZGVudEFjdGlvbi5JbmRlbnQpO1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnICAgIGlmIChhKSB7Jyxcblx0XHRcdFx0JyAgICAgICAgJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnICAgIH0nXG5cdFx0XHRdLmpvaW4oJ1xcbicpLFxuXHRcdFx0b25FbnRlckxhbmd1YWdlSWRcblx0XHQpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMywgMSk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlRhYi5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICcgICAgaWYgKGEpIHsnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJyAgICAgICAgJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMyksICcgICAgICAgICcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDQpLCAnJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNSksICcgICAgfScpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCd0eXBlIGhvbm9ycyBpbmRlbnRhdGlvbiBydWxlczogcnVieSBrZXl3b3JkcycsICgpID0+IHtcblx0XHRjb25zdCBydWJ5TGFuZ3VhZ2VJZCA9IHNldHVwSW5kZW50UnVsZXNMYW5ndWFnZSgncnVieScsIHtcblx0XHRcdGluY3JlYXNlSW5kZW50UGF0dGVybjogL15cXHMqKChiZWdpbnxjbGFzc3xkZWZ8ZWxzZXxlbHNpZnxlbnN1cmV8Zm9yfGlmfG1vZHVsZXxyZXNjdWV8dW5sZXNzfHVudGlsfHdoZW58d2hpbGUpfCguKlxcc2RvXFxiKSlcXGJbXlxceztdKiQvLFxuXHRcdFx0ZGVjcmVhc2VJbmRlbnRQYXR0ZXJuOiAvXlxccyooW31cXF1dKFssKV0/XFxzKigjfCQpfFxcLlthLXpBLVpfXVxcdypcXGIpfChlbmR8cmVzY3VlfGVuc3VyZXxlbHNlfGVsc2lmfHdoZW4pXFxiKS9cblx0XHR9KTtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFtcblx0XHRcdFx0J2NsYXNzIEdyZWV0ZXInLFxuXHRcdFx0XHQnICBkZWYgaW5pdGlhbGl6ZShuYW1lKScsXG5cdFx0XHRcdCcgICAgQG5hbWUgPSBuYW1lJyxcblx0XHRcdFx0JyAgICBlbidcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHRydWJ5TGFuZ3VhZ2VJZFxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogJ2Z1bGwnIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCA0LCA3LCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDQsIDcsIDQsIDcpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ2QnLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg0KSwgJyAgZW5kJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0F1dG8gaW5kZW50IG9uIHR5cGU6IGluY3JlYXNlSW5kZW50UGF0dGVybiBoYXMgaGlnaGVyIHByaW9yaXR5IHRoYW4gZGVjcmVhc2VJbmRlbnQgd2hlbiBpbmhlcml0aW5nJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J1xcdGlmICh0cnVlKSB7Jyxcblx0XHRcdFx0J1xcdFxcdGNvbnNvbGUubG9nKCk7Jyxcblx0XHRcdFx0J1xcdH0gZWxzZSBpZiB7Jyxcblx0XHRcdFx0J1xcdFxcdGNvbnNvbGUubG9nKCknLFxuXHRcdFx0XHQnXFx0fSdcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBpbmRlbnRSdWxlc0xhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDUsIDMsIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oNSwgMywgNSwgMykpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnZScsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbig1LCA0LCA1LCA0KSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNSksICdcXHR9ZScsICdUaGlzIGxpbmUgc2hvdWxkIG5vdCBkZWNyZWFzZSBpbmRlbnQnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgndHlwZSBob25vcnMgdXNlcnMgaW5kZW50YXRpb24gYWRqdXN0bWVudCcsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCdcXHRpZiAodHJ1ZSB8fCcsXG5cdFx0XHRcdCdcXHQgKSB7Jyxcblx0XHRcdFx0J1xcdH0nLFxuXHRcdFx0XHQnaWYgKHRydWUgfHwnLFxuXHRcdFx0XHQnKSB7Jyxcblx0XHRcdFx0J30nXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogaW5kZW50UnVsZXNMYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAyLCAzLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDIsIDMsIDIsIDMpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJyAnLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMiwgNCwgMiwgNCkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnXFx0ICApIHsnLCAnVGhpcyBsaW5lIHNob3VsZCBub3QgZGVjcmVhc2UgaW5kZW50Jyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2J1ZyAyOTk3MjogaWYgYSBsaW5lIGlzIGxpbmUgY29tbWVudCwgb3BlbiBicmFja2V0IHNob3VsZCBub3QgaW5kZW50IG5leHQgbGluZScsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCdpZiAodHJ1ZSkgeycsXG5cdFx0XHRcdCdcXHQvLyB7Jyxcblx0XHRcdFx0J1xcdFxcdCdcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBpbmRlbnRSdWxlc0xhbmd1YWdlSWQsXG5cdFx0XHRlZGl0b3JPcHRzOiB7IGF1dG9JbmRlbnQ6ICdmdWxsJyB9XG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCAzLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDMsIDMsIDMsIDMpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ30nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMywgMiwgMywgMikpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnfScpO1xuXHRcdH0pO1xuXHR9KTtcblxuXG5cdHRlc3QoJ2lzc3VlICMzODI2MTogVEFCIGtleSByZXN1bHRzIGluIGJpemFycmUgaW5kZW50YXRpb24gaW4gQysrIG1vZGUgJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxhbmd1YWdlSWQgPSAnaW5kZW50UnVsZXNNb2RlJztcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZVNlcnZpY2UucmVnaXN0ZXJMYW5ndWFnZSh7IGlkOiBsYW5ndWFnZUlkIH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5yZWdpc3RlcihsYW5ndWFnZUlkLCB7XG5cdFx0XHRicmFja2V0czogW1xuXHRcdFx0XHRbJ3snLCAnfSddLFxuXHRcdFx0XHRbJ1snLCAnXSddLFxuXHRcdFx0XHRbJygnLCAnKSddXG5cdFx0XHRdLFxuXHRcdFx0aW5kZW50YXRpb25SdWxlczoge1xuXHRcdFx0XHRpbmNyZWFzZUluZGVudFBhdHRlcm46IG5ldyBSZWdFeHAoXCIoXi4qXFxcXHtbXn1dKiQpXCIpLFxuXHRcdFx0XHRkZWNyZWFzZUluZGVudFBhdHRlcm46IG5ldyBSZWdFeHAoXCJeXFxcXHMqXFxcXH1cIilcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFtcblx0XHRcdFx0J2ludCBtYWluKCkgeycsXG5cdFx0XHRcdCcgIHJldHVybiAwOycsXG5cdFx0XHRcdCd9Jyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCdib29sIEZvbzo6YmFyKGNvbnN0IHN0cmluZyAmYSwnLFxuXHRcdFx0XHQnICAgICAgICAgICAgICBjb25zdCBzdHJpbmcgJmIpIHsnLFxuXHRcdFx0XHQnICBmb28oKTsnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JyknLFxuXHRcdFx0XS5qb2luKCdcXG4nKSxcblx0XHRcdGxhbmd1YWdlSWQsXG5cdFx0XHR7XG5cdFx0XHRcdHRhYlNpemU6IDIsXG5cdFx0XHRcdGluZGVudFNpemU6IDJcblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IGF1dG9JbmRlbnQ6ICdhZHZhbmNlZCcgfSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDgsIDEsIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oOCwgMSwgOCwgMSkpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlRhYi5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCdpbnQgbWFpbigpIHsnLFxuXHRcdFx0XHRcdCcgIHJldHVybiAwOycsXG5cdFx0XHRcdFx0J30nLFxuXHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRcdCdib29sIEZvbzo6YmFyKGNvbnN0IHN0cmluZyAmYSwnLFxuXHRcdFx0XHRcdCcgICAgICAgICAgICAgIGNvbnN0IHN0cmluZyAmYikgeycsXG5cdFx0XHRcdFx0JyAgZm9vKCk7Jyxcblx0XHRcdFx0XHQnICAnLFxuXHRcdFx0XHRcdCcpJyxcblx0XHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdFx0KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldFNlbGVjdGlvbigpLCBuZXcgU2VsZWN0aW9uKDgsIDMsIDgsIDMpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzU3MTk3OiBpbmRlbnQgcnVsZXMgcmVnZXggc2hvdWxkIGJlIHN0YXRlbGVzcycsICgpID0+IHtcblx0XHRjb25zdCBsYW5ndWFnZUlkID0gc2V0dXBJbmRlbnRSdWxlc0xhbmd1YWdlKCdsYW5nJywge1xuXHRcdFx0ZGVjcmVhc2VJbmRlbnRQYXR0ZXJuOiAvXlxccyp9JC9nbSxcblx0XHRcdGluY3JlYXNlSW5kZW50UGF0dGVybjogL14oPyFbXlxcU1xcbl0qKD8hLS18XHUyMDEzXHUyMDEzfFx1MjAxNFx1MjAxNCkoPzpbLVx1Mjc0RFx1Mjc1MVx1MjVBMFx1MkIxQ1x1MjVBMVx1MjYxMFx1MjVBQVx1MjVBQlx1MjAxM1x1MjAxNFx1MjI2MVx1MjE5Mlx1MjAzQVx1MjcxOHhYXHUyNzE0XHUyNzEzXHUyNjExK118XFxbWyB4WCstXT9cXF0pXFxzW15cXG5dKilbXlxcU1xcbl0qKC4rOilbXlxcU1xcbl0qKD86KD89QFteXFxzKn4oXSsoPzo6XFwvXFwvW15cXHMqfig6XSspPyg/OlxcKFteKV0qXFwpKT8pfCQpL2dtLFxuXHRcdH0pO1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J1Byb2plY3Q6Jyxcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBsYW5ndWFnZUlkLFxuXHRcdFx0bW9kZWxPcHRzOiB7IGluc2VydFNwYWNlczogZmFsc2UgfSxcblx0XHRcdGVkaXRvck9wdHM6IHsgYXV0b0luZGVudDogJ2Z1bGwnIH1cblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDEsIDksIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgOSwgMSwgOSkpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRtb2RlbC50b2tlbml6YXRpb24uZm9yY2VUb2tlbml6YXRpb24obW9kZWwuZ2V0TGluZUNvdW50KCkpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigyLCAyLCAyLCAyKSk7XG5cblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMSwgOSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCA5LCAxLCA5KSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRtb2RlbC50b2tlbml6YXRpb24uZm9yY2VUb2tlbml6YXRpb24obW9kZWwuZ2V0TGluZUNvdW50KCkpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigyLCAyLCAyLCAyKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3R5cGluZyBpbiBqc29uJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxhbmd1YWdlSWQgPSAnaW5kZW50UnVsZXNNb2RlJztcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZVNlcnZpY2UucmVnaXN0ZXJMYW5ndWFnZSh7IGlkOiBsYW5ndWFnZUlkIH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5yZWdpc3RlcihsYW5ndWFnZUlkLCB7XG5cdFx0XHRicmFja2V0czogW1xuXHRcdFx0XHRbJ3snLCAnfSddLFxuXHRcdFx0XHRbJ1snLCAnXSddLFxuXHRcdFx0XHRbJygnLCAnKSddXG5cdFx0XHRdLFxuXHRcdFx0aW5kZW50YXRpb25SdWxlczoge1xuXHRcdFx0XHRpbmNyZWFzZUluZGVudFBhdHRlcm46IG5ldyBSZWdFeHAoXCIoeysoPz0oW15cXFwiXSpcXFwiW15cXFwiXSpcXFwiKSpbXlxcXCJ9XSokKSl8KFxcXFxbKyg/PShbXlxcXCJdKlxcXCJbXlxcXCJdKlxcXCIpKlteXFxcIlxcXFxdXSokKSlcIiksXG5cdFx0XHRcdGRlY3JlYXNlSW5kZW50UGF0dGVybjogbmV3IFJlZ0V4cChcIl5cXFxccypbfVxcXFxdXSw/XFxcXHMqJFwiKVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQneycsXG5cdFx0XHRcdCcgIFwic2NyaXB0czoge1wiJyxcblx0XHRcdFx0JyAgICBcIndhdGNoXCI6IFwiYSB7XCInLFxuXHRcdFx0XHQnICAgIFwiYnVpbGR7XCI6IFwiYlwiJyxcblx0XHRcdFx0JyAgICBcInRhc2tzXCI6IFtdJyxcblx0XHRcdFx0JyAgICBcInRhc2tzXCI6IFtcImFcIl0nLFxuXHRcdFx0XHQnICBcIn1cIicsXG5cdFx0XHRcdCdcIn1cIidcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHRsYW5ndWFnZUlkLFxuXHRcdFx0e1xuXHRcdFx0XHR0YWJTaXplOiAyLFxuXHRcdFx0XHRpbmRlbnRTaXplOiAyXG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyBhdXRvSW5kZW50OiAnZnVsbCcgfSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDMsIDE5LCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDMsIDE5LCAzLCAxOSkpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDQpLCAnICAgICcpO1xuXG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDUsIDE4LCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDUsIDE4LCA1LCAxOCkpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDYpLCAnICAgICcpO1xuXG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDcsIDE1LCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDcsIDE1LCA3LCAxNSkpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDgpLCAnICAgICAgJyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDkpLCAnICAgIF0nKTtcblxuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxMCwgMTgsIGZhbHNlKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMTAsIDE4LCAxMCwgMTgpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxMSksICcgICAgXScpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTExMTI4OiBNdWx0aWN1cnNvciBgRW50ZXJgIGlzc3VlIHdpdGggaW5kZW50YXRpb24nLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoJyAgICBsZXQgYSwgYiwgYzsnLCBpbmRlbnRSdWxlc0xhbmd1YWdlSWQsIHsgZGV0ZWN0SW5kZW50YXRpb246IGZhbHNlLCBpbnNlcnRTcGFjZXM6IGZhbHNlLCB0YWJTaXplOiA0IH0pO1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDExLCAxLCAxMSksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMTQsIDEsIDE0KSxcblx0XHRcdF0pO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICcgICAgbGV0IGEsXFxuXFx0IGIsXFxuXFx0IGM7Jyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMjI3MTQ6IHRhYlNpemU9MSBwcmV2ZW50IHR5cGluZyBhIHN0cmluZyBtYXRjaGluZyBkZWNyZWFzZUluZGVudFBhdHRlcm4gaW4gYW4gZW1wdHkgZmlsZScsICgpID0+IHtcblx0XHRjb25zdCBsYXRleHRMYW5ndWFnZUlkID0gc2V0dXBJbmRlbnRSdWxlc0xhbmd1YWdlKCdsYXRleCcsIHtcblx0XHRcdGluY3JlYXNlSW5kZW50UGF0dGVybjogbmV3IFJlZ0V4cCgnXFxcXFxcXFxiZWdpbnsoPyFkb2N1bWVudCkoW159XSopfSg/IS4qXFxcXFxcXFxlbmR7XFxcXDF9KScpLFxuXHRcdFx0ZGVjcmVhc2VJbmRlbnRQYXR0ZXJuOiBuZXcgUmVnRXhwKCdeXFxcXHMqXFxcXFxcXFxlbmR7KD8hZG9jdW1lbnQpJylcblx0XHR9KTtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdCdcXFxcZW5kJyxcblx0XHRcdGxhdGV4dExhbmd1YWdlSWQsXG5cdFx0XHR7IHRhYlNpemU6IDEgfVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogJ2Z1bGwnIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCA1LCBmYWxzZSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ3snLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ1xcXFxlbmR7fScpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdFbGVjdHJpY0NoYXJhY3RlciAtIGRvZXMgbm90aGluZyBpZiBubyBlbGVjdHJpYyBjaGFyJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0JyAgaWYgKGEpIHsnLFxuXHRcdFx0XHQnJ1xuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGVsZWN0cmljQ2hhckxhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDIsIDEpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJyonLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICcqJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0VsZWN0cmljQ2hhcmFjdGVyIC0gaW5kZW50cyBpbiBvcmRlciB0byBtYXRjaCBicmFja2V0JywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0JyAgaWYgKGEpIHsnLFxuXHRcdFx0XHQnJ1xuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGVsZWN0cmljQ2hhckxhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDIsIDEpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ30nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICcgIH0nKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRWxlY3RyaWNDaGFyYWN0ZXIgLSB1bmluZGVudHMgaW4gb3JkZXIgdG8gbWF0Y2ggYnJhY2tldCcsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCcgIGlmIChhKSB7Jyxcblx0XHRcdFx0JyAgICAnXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogZWxlY3RyaWNDaGFyTGFuZ3VhZ2VJZFxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMiwgNSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnfScsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJyAgfScpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdFbGVjdHJpY0NoYXJhY3RlciAtIG1hdGNoZXMgd2l0aCBjb3JyZWN0IGJyYWNrZXQnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnICBpZiAoYSkgeycsXG5cdFx0XHRcdCcgICAgaWYgKGIpIHsnLFxuXHRcdFx0XHQnICAgIH0nLFxuXHRcdFx0XHQnICAgICdcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBlbGVjdHJpY0NoYXJMYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCA0LCAxKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCd9JywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDQpLCAnICB9ICAgICcpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdFbGVjdHJpY0NoYXJhY3RlciAtIGRvZXMgbm90aGluZyBpZiBicmFja2V0IGRvZXMgbm90IG1hdGNoJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0JyAgaWYgKGEpIHsnLFxuXHRcdFx0XHQnICAgIGlmIChiKSB7Jyxcblx0XHRcdFx0JyAgICB9Jyxcblx0XHRcdFx0JyAgfSAgJ1xuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGVsZWN0cmljQ2hhckxhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDQsIDYpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ30nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoNCksICcgIH0gIH0nKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRWxlY3RyaWNDaGFyYWN0ZXIgLSBtYXRjaGVzIGJyYWNrZXQgZXZlbiBpbiBsaW5lIHdpdGggY29udGVudCcsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCcgIGlmIChhKSB7Jyxcblx0XHRcdFx0Jy8vIGhlbGxvJ1xuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGVsZWN0cmljQ2hhckxhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDIsIDEpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ30nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICcgIH0vLyBoZWxsbycpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdFbGVjdHJpY0NoYXJhY3RlciAtIGlzIG5vLW9wIGlmIGJyYWNrZXQgaXMgbGluZWQgdXAnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnICBpZiAoYSkgeycsXG5cdFx0XHRcdCcgICdcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBlbGVjdHJpY0NoYXJMYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAyLCAzKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCd9JywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnICB9Jyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0VsZWN0cmljQ2hhcmFjdGVyIC0gaXMgbm8tb3AgaWYgdGhlcmUgaXMgbm9uLXdoaXRlc3BhY2UgdGV4dCBiZWZvcmUnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnICBpZiAoYSkgeycsXG5cdFx0XHRcdCdhJ1xuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGVsZWN0cmljQ2hhckxhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDIsIDIpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ30nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICdhfScpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdFbGVjdHJpY0NoYXJhY3RlciAtIGlzIG5vLW9wIGlmIHBhaXJzIGFyZSBhbGwgbWF0Y2hlZCBiZWZvcmUnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnZm9vKCgpID0+IHsnLFxuXHRcdFx0XHQnICAoIDEgKyAyICkgJyxcblx0XHRcdFx0J30pJ1xuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGVsZWN0cmljQ2hhckxhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDIsIDEzKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCcqJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnICAoIDEgKyAyICkgKicpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdFbGVjdHJpY0NoYXJhY3RlciAtIGlzIG5vLW9wIGlmIG1hdGNoaW5nIGJyYWNrZXQgaXMgb24gdGhlIHNhbWUgbGluZScsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCcoZGl2Jyxcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBlbGVjdHJpY0NoYXJMYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAxLCA1KTtcblx0XHRcdGxldCBjaGFuZ2VUZXh0OiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBtb2RlbC5vbkRpZENoYW5nZUNvbnRlbnQoZSA9PiB7XG5cdFx0XHRcdGNoYW5nZVRleHQgPSBlLmNoYW5nZXNbMF0udGV4dDtcblx0XHRcdH0pO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJyknLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICcoZGl2KScpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjaGFuZ2VUZXh0LCAnKScpO1xuXHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0VsZWN0cmljQ2hhcmFjdGVyIC0gaXMgbm8tb3AgaWYgdGhlIGxpbmUgaGFzIG90aGVyIGNvbnRlbnQnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnTWF0aC5tYXgoJyxcblx0XHRcdFx0J1xcdDInLFxuXHRcdFx0XHQnXFx0Mydcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBlbGVjdHJpY0NoYXJMYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAzLCAzKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCcpJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDMpLCAnXFx0MyknKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRWxlY3RyaWNDaGFyYWN0ZXIgLSBhcHBlbmRzIHRleHQnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnICBpZiAoYSkgeycsXG5cdFx0XHRcdCcvKidcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBlbGVjdHJpY0NoYXJMYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAyLCAzKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCcqJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnLyoqICovJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0VsZWN0cmljQ2hhcmFjdGVyIC0gYXBwZW5kcyB0ZXh0IDInLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnICBpZiAoYSkgeycsXG5cdFx0XHRcdCcgIC8qJ1xuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGVsZWN0cmljQ2hhckxhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8oZWRpdG9yLCB2aWV3TW9kZWwsIDIsIDUpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJyonLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICcgIC8qKiAqLycpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdFbGVjdHJpY0NoYXJhY3RlciAtIGlzc3VlICMyMzcxMTogUmVwbGFjaW5nIHNlbGVjdGVkIHRleHQgd2l0aCApXX0gZmFpbHMgdG8gZGVsZXRlIG9sZCB0ZXh0IHdpdGggYmFja3dhcmRzLWRyYWdnZWQgc2VsZWN0aW9uJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J3snLFxuXHRcdFx0XHQnd29yZCdcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBlbGVjdHJpY0NoYXJMYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKGVkaXRvciwgdmlld01vZGVsLCAyLCA1KTtcblx0XHRcdG1vdmVUbyhlZGl0b3IsIHZpZXdNb2RlbCwgMiwgMSwgdHJ1ZSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnfScsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJ30nKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzYxMDcwOiBiYWNrdGljayAoYCkgc2hvdWxkIGF1dG8tY2xvc2UgYWZ0ZXIgYSB3b3JkIGNoYXJhY3RlcicsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbJ2NvbnN0IG1hcmt1cCA9IGhpZ2hsaWdodCddLFxuXHRcdFx0bGFuZ3VhZ2VJZDogYXV0b0Nsb3NpbmdMYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKDEpO1xuXHRcdFx0YXNzZXJ0VHlwZShlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwsIDEsIDI1LCAnYCcsICdgYCcsIGBhdXRvIGNsb3NlcyBcXGAgQCAoMSwgMjUpYCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMzI5MTI6IHF1b3RlcyBzaG91bGQgbm90IGF1dG8tY2xvc2UgaWYgdGhleSBhcmUgY2xvc2luZyBhIHN0cmluZycsICgpID0+IHtcblx0XHRzZXR1cEF1dG9DbG9zaW5nTGFuZ3VhZ2VUb2tlbml6YXRpb24oKTtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnY29uc3QgdDIgPSBgc29tZXRoaW5nICR7dDF9JywgYXV0b0Nsb3NpbmdMYW5ndWFnZUlkKTtcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IoXG5cdFx0XHRtb2RlbCxcblx0XHRcdHt9LFxuXHRcdFx0KGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gdmlld01vZGVsLm1vZGVsO1xuXHRcdFx0XHRtb2RlbC50b2tlbml6YXRpb24uZm9yY2VUb2tlbml6YXRpb24oMSk7XG5cdFx0XHRcdGFzc2VydFR5cGUoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsLCAxLCAyOCwgJ2AnLCAnYCcsIGBkb2VzIG5vdCBhdXRvIGNsb3NlIFxcYCBAICgxLCAyOClgKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdhdXRvQ2xvc2luZ1BhaXJzIC0gb3BlbiBwYXJlbnM6IGRlZmF1bHQnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQndmFyIGEgPSBbXTsnLFxuXHRcdFx0XHQndmFyIGIgPSBgYXNkYDsnLFxuXHRcdFx0XHQndmFyIGMgPSBcXCdhc2RcXCc7Jyxcblx0XHRcdFx0J3ZhciBkID0gXCJhc2RcIjsnLFxuXHRcdFx0XHQndmFyIGUgPSAvKjMqL1x0MzsnLFxuXHRcdFx0XHQndmFyIGYgPSAvKiogMyAqLzM7Jyxcblx0XHRcdFx0J3ZhciBnID0gKDMrNSk7Jyxcblx0XHRcdFx0J3ZhciBoID0geyBhOiBcXCd2YWx1ZVxcJyB9OycsXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogYXV0b0Nsb3NpbmdMYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXG5cdFx0XHRjb25zdCBhdXRvQ2xvc2VQb3NpdGlvbnMgPSBbXG5cdFx0XHRcdCd2YXJ8IGF8IHw9fCBbfF18O3wnLFxuXHRcdFx0XHQndmFyfCBifCB8PXwgfGBhc2R8YHw7fCcsXG5cdFx0XHRcdCd2YXJ8IGN8IHw9fCB8XFwnYXNkfFxcJ3w7fCcsXG5cdFx0XHRcdCd2YXJ8IGR8IHw9fCB8XCJhc2R8XCJ8O3wnLFxuXHRcdFx0XHQndmFyfCBlfCB8PXwgLyozKi98XHQzfDt8Jyxcblx0XHRcdFx0J3ZhcnwgZnwgfD18IC8qKnwgM3wgKi8zfDt8Jyxcblx0XHRcdFx0J3ZhcnwgZ3wgfD18ICgzKzV8KXw7fCcsXG5cdFx0XHRcdCd2YXJ8IGh8IHw9fCB7fCBhfDp8IHxcXCd2YWx1ZXxcXCd8IHx9fDt8Jyxcblx0XHRcdF07XG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gYXV0b0Nsb3NlUG9zaXRpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBpICsgMTtcblx0XHRcdFx0Y29uc3QgYXV0b0Nsb3NlQ29sdW1ucyA9IGV4dHJhY3RBdXRvQ2xvc2luZ1NwZWNpYWxDb2x1bW5zKG1vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZU51bWJlciksIGF1dG9DbG9zZVBvc2l0aW9uc1tpXSk7XG5cblx0XHRcdFx0Zm9yIChsZXQgY29sdW1uID0gMTsgY29sdW1uIDwgYXV0b0Nsb3NlQ29sdW1ucy5sZW5ndGg7IGNvbHVtbisrKSB7XG5cdFx0XHRcdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKGxpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdGlmIChhdXRvQ2xvc2VDb2x1bW5zW2NvbHVtbl0gPT09IEF1dG9DbG9zaW5nQ29sdW1uVHlwZS5TcGVjaWFsMSkge1xuXHRcdFx0XHRcdFx0YXNzZXJ0VHlwZShlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwsIGxpbmVOdW1iZXIsIGNvbHVtbiwgJygnLCAnKCknLCBgYXV0byBjbG9zZXMgQCAoJHtsaW5lTnVtYmVyfSwgJHtjb2x1bW59KWApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRhc3NlcnRUeXBlKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCwgbGluZU51bWJlciwgY29sdW1uLCAnKCcsICcoJywgYGRvZXMgbm90IGF1dG8gY2xvc2UgQCAoJHtsaW5lTnVtYmVyfSwgJHtjb2x1bW59KWApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdhdXRvQ2xvc2luZ1BhaXJzIC0gb3BlbiBwYXJlbnM6IHdoaXRlc3BhY2UnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQndmFyIGEgPSBbXTsnLFxuXHRcdFx0XHQndmFyIGIgPSBgYXNkYDsnLFxuXHRcdFx0XHQndmFyIGMgPSBcXCdhc2RcXCc7Jyxcblx0XHRcdFx0J3ZhciBkID0gXCJhc2RcIjsnLFxuXHRcdFx0XHQndmFyIGUgPSAvKjMqL1x0MzsnLFxuXHRcdFx0XHQndmFyIGYgPSAvKiogMyAqLzM7Jyxcblx0XHRcdFx0J3ZhciBnID0gKDMrNSk7Jyxcblx0XHRcdFx0J3ZhciBoID0geyBhOiBcXCd2YWx1ZVxcJyB9OycsXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogYXV0b0Nsb3NpbmdMYW5ndWFnZUlkLFxuXHRcdFx0ZWRpdG9yT3B0czoge1xuXHRcdFx0XHRhdXRvQ2xvc2luZ0JyYWNrZXRzOiAnYmVmb3JlV2hpdGVzcGFjZSdcblx0XHRcdH1cblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cblx0XHRcdGNvbnN0IGF1dG9DbG9zZVBvc2l0aW9ucyA9IFtcblx0XHRcdFx0J3ZhcnwgYXwgPXwgW3xdO3wnLFxuXHRcdFx0XHQndmFyfCBifCA9fCBgYXNkYDt8Jyxcblx0XHRcdFx0J3ZhcnwgY3wgPXwgXFwnYXNkXFwnO3wnLFxuXHRcdFx0XHQndmFyfCBkfCA9fCBcImFzZFwiO3wnLFxuXHRcdFx0XHQndmFyfCBlfCA9fCAvKjMqL3xcdDM7fCcsXG5cdFx0XHRcdCd2YXJ8IGZ8ID18IC8qKnwgM3wgKi8zO3wnLFxuXHRcdFx0XHQndmFyfCBnfCA9fCAoMys1fCk7fCcsXG5cdFx0XHRcdCd2YXJ8IGh8ID18IHt8IGE6fCBcXCd2YWx1ZVxcJ3wgfH07fCcsXG5cdFx0XHRdO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGF1dG9DbG9zZVBvc2l0aW9ucy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRjb25zdCBsaW5lTnVtYmVyID0gaSArIDE7XG5cdFx0XHRcdGNvbnN0IGF1dG9DbG9zZUNvbHVtbnMgPSBleHRyYWN0QXV0b0Nsb3NpbmdTcGVjaWFsQ29sdW1ucyhtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGxpbmVOdW1iZXIpLCBhdXRvQ2xvc2VQb3NpdGlvbnNbaV0pO1xuXG5cdFx0XHRcdGZvciAobGV0IGNvbHVtbiA9IDE7IGNvbHVtbiA8IGF1dG9DbG9zZUNvbHVtbnMubGVuZ3RoOyBjb2x1bW4rKykge1xuXHRcdFx0XHRcdG1vZGVsLnRva2VuaXphdGlvbi5mb3JjZVRva2VuaXphdGlvbihsaW5lTnVtYmVyKTtcblx0XHRcdFx0XHRpZiAoYXV0b0Nsb3NlQ29sdW1uc1tjb2x1bW5dID09PSBBdXRvQ2xvc2luZ0NvbHVtblR5cGUuU3BlY2lhbDEpIHtcblx0XHRcdFx0XHRcdGFzc2VydFR5cGUoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsLCBsaW5lTnVtYmVyLCBjb2x1bW4sICcoJywgJygpJywgYGF1dG8gY2xvc2VzIEAgKCR7bGluZU51bWJlcn0sICR7Y29sdW1ufSlgKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0YXNzZXJ0VHlwZShlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwsIGxpbmVOdW1iZXIsIGNvbHVtbiwgJygnLCAnKCcsIGBkb2VzIG5vdCBhdXRvIGNsb3NlIEAgKCR7bGluZU51bWJlcn0sICR7Y29sdW1ufSlgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnYXV0b0Nsb3NpbmdQYWlycyAtIG9wZW4gcGFyZW5zIGRpc2FibGVkL2VuYWJsZWQgb3BlbiBxdW90ZXMgZW5hYmxlZC9kaXNhYmxlZCcsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCd2YXIgYSA9IFtdOycsXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogYXV0b0Nsb3NpbmdMYW5ndWFnZUlkLFxuXHRcdFx0ZWRpdG9yT3B0czoge1xuXHRcdFx0XHRhdXRvQ2xvc2luZ0JyYWNrZXRzOiAnYmVmb3JlV2hpdGVzcGFjZScsXG5cdFx0XHRcdGF1dG9DbG9zaW5nUXVvdGVzOiAnbmV2ZXInXG5cdFx0XHR9XG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXG5cdFx0XHRjb25zdCBhdXRvQ2xvc2VQb3NpdGlvbnMgPSBbXG5cdFx0XHRcdCd2YXJ8IGF8ID18IFt8XTt8Jyxcblx0XHRcdF07XG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gYXV0b0Nsb3NlUG9zaXRpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBpICsgMTtcblx0XHRcdFx0Y29uc3QgYXV0b0Nsb3NlQ29sdW1ucyA9IGV4dHJhY3RBdXRvQ2xvc2luZ1NwZWNpYWxDb2x1bW5zKG1vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZU51bWJlciksIGF1dG9DbG9zZVBvc2l0aW9uc1tpXSk7XG5cblx0XHRcdFx0Zm9yIChsZXQgY29sdW1uID0gMTsgY29sdW1uIDwgYXV0b0Nsb3NlQ29sdW1ucy5sZW5ndGg7IGNvbHVtbisrKSB7XG5cdFx0XHRcdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKGxpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdGlmIChhdXRvQ2xvc2VDb2x1bW5zW2NvbHVtbl0gPT09IEF1dG9DbG9zaW5nQ29sdW1uVHlwZS5TcGVjaWFsMSkge1xuXHRcdFx0XHRcdFx0YXNzZXJ0VHlwZShlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwsIGxpbmVOdW1iZXIsIGNvbHVtbiwgJygnLCAnKCknLCBgYXV0byBjbG9zZXMgQCAoJHtsaW5lTnVtYmVyfSwgJHtjb2x1bW59KWApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRhc3NlcnRUeXBlKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCwgbGluZU51bWJlciwgY29sdW1uLCAnKCcsICcoJywgYGRvZXMgbm90IGF1dG8gY2xvc2UgQCAoJHtsaW5lTnVtYmVyfSwgJHtjb2x1bW59KWApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRhc3NlcnRUeXBlKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCwgbGluZU51bWJlciwgY29sdW1uLCAnXFwnJywgJ1xcJycsIGBkb2VzIG5vdCBhdXRvIGNsb3NlIEAgKCR7bGluZU51bWJlcn0sICR7Y29sdW1ufSlgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQndmFyIGIgPSBbXTsnLFxuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGF1dG9DbG9zaW5nTGFuZ3VhZ2VJZCxcblx0XHRcdGVkaXRvck9wdHM6IHtcblx0XHRcdFx0YXV0b0Nsb3NpbmdCcmFja2V0czogJ25ldmVyJyxcblx0XHRcdFx0YXV0b0Nsb3NpbmdRdW90ZXM6ICdiZWZvcmVXaGl0ZXNwYWNlJ1xuXHRcdFx0fVxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblxuXHRcdFx0Y29uc3QgYXV0b0Nsb3NlUG9zaXRpb25zID0gW1xuXHRcdFx0XHQndmFyIGIgPXwgW3xdO3wnLFxuXHRcdFx0XTtcblx0XHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBhdXRvQ2xvc2VQb3NpdGlvbnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgbGluZU51bWJlciA9IGkgKyAxO1xuXHRcdFx0XHRjb25zdCBhdXRvQ2xvc2VDb2x1bW5zID0gZXh0cmFjdEF1dG9DbG9zaW5nU3BlY2lhbENvbHVtbnMobW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lTnVtYmVyKSwgYXV0b0Nsb3NlUG9zaXRpb25zW2ldKTtcblxuXHRcdFx0XHRmb3IgKGxldCBjb2x1bW4gPSAxOyBjb2x1bW4gPCBhdXRvQ2xvc2VDb2x1bW5zLmxlbmd0aDsgY29sdW1uKyspIHtcblx0XHRcdFx0XHRtb2RlbC50b2tlbml6YXRpb24uZm9yY2VUb2tlbml6YXRpb24obGluZU51bWJlcik7XG5cdFx0XHRcdFx0aWYgKGF1dG9DbG9zZUNvbHVtbnNbY29sdW1uXSA9PT0gQXV0b0Nsb3NpbmdDb2x1bW5UeXBlLlNwZWNpYWwxKSB7XG5cdFx0XHRcdFx0XHRhc3NlcnRUeXBlKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCwgbGluZU51bWJlciwgY29sdW1uLCAnXFwnJywgJ1xcJ1xcJycsIGBhdXRvIGNsb3NlcyBAICgke2xpbmVOdW1iZXJ9LCAke2NvbHVtbn0pYCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGFzc2VydFR5cGUoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsLCBsaW5lTnVtYmVyLCBjb2x1bW4sICdcXCcnLCAnXFwnJywgYGRvZXMgbm90IGF1dG8gY2xvc2UgQCAoJHtsaW5lTnVtYmVyfSwgJHtjb2x1bW59KWApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRhc3NlcnRUeXBlKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCwgbGluZU51bWJlciwgY29sdW1uLCAnKCcsICcoJywgYGRvZXMgbm90IGF1dG8gY2xvc2UgQCAoJHtsaW5lTnVtYmVyfSwgJHtjb2x1bW59KWApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2F1dG9DbG9zaW5nUGFpcnMgLSBjb25maWd1cmFibGUgb3BlbiBwYXJlbnMnLCAoKSA9PiB7XG5cdFx0c2V0QXV0b0Nsb3NpbmdMYW5ndWFnZUVuYWJsZWRTZXQoJ2FiYycpO1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J3ZhciBhID0gW107Jyxcblx0XHRcdFx0J3ZhciBiID0gYGFzZGA7Jyxcblx0XHRcdFx0J3ZhciBjID0gXFwnYXNkXFwnOycsXG5cdFx0XHRcdCd2YXIgZCA9IFwiYXNkXCI7Jyxcblx0XHRcdFx0J3ZhciBlID0gLyozKi9cdDM7Jyxcblx0XHRcdFx0J3ZhciBmID0gLyoqIDMgKi8zOycsXG5cdFx0XHRcdCd2YXIgZyA9ICgzKzUpOycsXG5cdFx0XHRcdCd2YXIgaCA9IHsgYTogXFwndmFsdWVcXCcgfTsnLFxuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGF1dG9DbG9zaW5nTGFuZ3VhZ2VJZCxcblx0XHRcdGVkaXRvck9wdHM6IHtcblx0XHRcdFx0YXV0b0Nsb3NpbmdCcmFja2V0czogJ2xhbmd1YWdlRGVmaW5lZCdcblx0XHRcdH1cblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cblx0XHRcdGNvbnN0IGF1dG9DbG9zZVBvc2l0aW9ucyA9IFtcblx0XHRcdFx0J3Z8YXIgfGEgPSBbfF07fCcsXG5cdFx0XHRcdCd2fGFyIHxiID0gYHxhc2RgO3wnLFxuXHRcdFx0XHQndnxhciB8YyA9IFxcJ3xhc2RcXCc7fCcsXG5cdFx0XHRcdCd2fGFyIGQgPSBcInxhc2RcIjt8Jyxcblx0XHRcdFx0J3Z8YXIgZSA9IC8qMyovXHQzO3wnLFxuXHRcdFx0XHQndnxhciBmID0gLyoqIDN8ICovMzt8Jyxcblx0XHRcdFx0J3Z8YXIgZyA9ICgzKzV8KTt8Jyxcblx0XHRcdFx0J3Z8YXIgaCA9IHsgfGE6IFxcJ3Z8YWx1ZVxcJyB8fTt8Jyxcblx0XHRcdF07XG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gYXV0b0Nsb3NlUG9zaXRpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBpICsgMTtcblx0XHRcdFx0Y29uc3QgYXV0b0Nsb3NlQ29sdW1ucyA9IGV4dHJhY3RBdXRvQ2xvc2luZ1NwZWNpYWxDb2x1bW5zKG1vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZU51bWJlciksIGF1dG9DbG9zZVBvc2l0aW9uc1tpXSk7XG5cblx0XHRcdFx0Zm9yIChsZXQgY29sdW1uID0gMTsgY29sdW1uIDwgYXV0b0Nsb3NlQ29sdW1ucy5sZW5ndGg7IGNvbHVtbisrKSB7XG5cdFx0XHRcdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKGxpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdGlmIChhdXRvQ2xvc2VDb2x1bW5zW2NvbHVtbl0gPT09IEF1dG9DbG9zaW5nQ29sdW1uVHlwZS5TcGVjaWFsMSkge1xuXHRcdFx0XHRcdFx0YXNzZXJ0VHlwZShlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwsIGxpbmVOdW1iZXIsIGNvbHVtbiwgJygnLCAnKCknLCBgYXV0byBjbG9zZXMgQCAoJHtsaW5lTnVtYmVyfSwgJHtjb2x1bW59KWApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRhc3NlcnRUeXBlKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCwgbGluZU51bWJlciwgY29sdW1uLCAnKCcsICcoJywgYGRvZXMgbm90IGF1dG8gY2xvc2UgQCAoJHtsaW5lTnVtYmVyfSwgJHtjb2x1bW59KWApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdhdXRvQ2xvc2luZ1BhaXJzIC0gYXV0by1wYWlyaW5nIGNhbiBiZSBkaXNhYmxlZCcsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCd2YXIgYSA9IFtdOycsXG5cdFx0XHRcdCd2YXIgYiA9IGBhc2RgOycsXG5cdFx0XHRcdCd2YXIgYyA9IFxcJ2FzZFxcJzsnLFxuXHRcdFx0XHQndmFyIGQgPSBcImFzZFwiOycsXG5cdFx0XHRcdCd2YXIgZSA9IC8qMyovXHQzOycsXG5cdFx0XHRcdCd2YXIgZiA9IC8qKiAzICovMzsnLFxuXHRcdFx0XHQndmFyIGcgPSAoMys1KTsnLFxuXHRcdFx0XHQndmFyIGggPSB7IGE6IFxcJ3ZhbHVlXFwnIH07Jyxcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBhdXRvQ2xvc2luZ0xhbmd1YWdlSWQsXG5cdFx0XHRlZGl0b3JPcHRzOiB7XG5cdFx0XHRcdGF1dG9DbG9zaW5nQnJhY2tldHM6ICduZXZlcicsXG5cdFx0XHRcdGF1dG9DbG9zaW5nUXVvdGVzOiAnbmV2ZXInXG5cdFx0XHR9XG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXG5cdFx0XHRjb25zdCBhdXRvQ2xvc2VQb3NpdGlvbnMgPSBbXG5cdFx0XHRcdCd2YXIgYSA9IFtdOycsXG5cdFx0XHRcdCd2YXIgYiA9IGBhc2RgOycsXG5cdFx0XHRcdCd2YXIgYyA9IFxcJ2FzZFxcJzsnLFxuXHRcdFx0XHQndmFyIGQgPSBcImFzZFwiOycsXG5cdFx0XHRcdCd2YXIgZSA9IC8qMyovXHQzOycsXG5cdFx0XHRcdCd2YXIgZiA9IC8qKiAzICovMzsnLFxuXHRcdFx0XHQndmFyIGcgPSAoMys1KTsnLFxuXHRcdFx0XHQndmFyIGggPSB7IGE6IFxcJ3ZhbHVlXFwnIH07Jyxcblx0XHRcdF07XG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gYXV0b0Nsb3NlUG9zaXRpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBpICsgMTtcblx0XHRcdFx0Y29uc3QgYXV0b0Nsb3NlQ29sdW1ucyA9IGV4dHJhY3RBdXRvQ2xvc2luZ1NwZWNpYWxDb2x1bW5zKG1vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZU51bWJlciksIGF1dG9DbG9zZVBvc2l0aW9uc1tpXSk7XG5cblx0XHRcdFx0Zm9yIChsZXQgY29sdW1uID0gMTsgY29sdW1uIDwgYXV0b0Nsb3NlQ29sdW1ucy5sZW5ndGg7IGNvbHVtbisrKSB7XG5cdFx0XHRcdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKGxpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdGlmIChhdXRvQ2xvc2VDb2x1bW5zW2NvbHVtbl0gPT09IEF1dG9DbG9zaW5nQ29sdW1uVHlwZS5TcGVjaWFsMSkge1xuXHRcdFx0XHRcdFx0YXNzZXJ0VHlwZShlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwsIGxpbmVOdW1iZXIsIGNvbHVtbiwgJygnLCAnKCknLCBgYXV0byBjbG9zZXMgQCAoJHtsaW5lTnVtYmVyfSwgJHtjb2x1bW59KWApO1xuXHRcdFx0XHRcdFx0YXNzZXJ0VHlwZShlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwsIGxpbmVOdW1iZXIsIGNvbHVtbiwgJ1wiJywgJ1wiXCInLCBgYXV0byBjbG9zZXMgQCAoJHtsaW5lTnVtYmVyfSwgJHtjb2x1bW59KWApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRhc3NlcnRUeXBlKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCwgbGluZU51bWJlciwgY29sdW1uLCAnKCcsICcoJywgYGRvZXMgbm90IGF1dG8gY2xvc2UgQCAoJHtsaW5lTnVtYmVyfSwgJHtjb2x1bW59KWApO1xuXHRcdFx0XHRcdFx0YXNzZXJ0VHlwZShlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwsIGxpbmVOdW1iZXIsIGNvbHVtbiwgJ1wiJywgJ1wiJywgYGRvZXMgbm90IGF1dG8gY2xvc2UgQCAoJHtsaW5lTnVtYmVyfSwgJHtjb2x1bW59KWApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdhdXRvQ2xvc2luZ1BhaXJzIC0gYXV0byB3cmFwcGluZyBpcyBjb25maWd1cmFibGUnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQndmFyIGEgPSBhc2QnXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogYXV0b0Nsb3NpbmdMYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCA0KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCA5LCAxLCAxMiksXG5cdFx0XHRdKTtcblxuXHRcdFx0Ly8gdHlwZSBhIGBcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdgJywgJ2tleWJvYXJkJyk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnYHZhcmAgYSA9IGBhc2RgJyk7XG5cblx0XHRcdC8vIHR5cGUgYSAoXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnKCcsICdrZXlib2FyZCcpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ2AodmFyKWAgYSA9IGAoYXNkKWAnKTtcblx0XHR9KTtcblxuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J3ZhciBhID0gYXNkJ1xuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGF1dG9DbG9zaW5nTGFuZ3VhZ2VJZCxcblx0XHRcdGVkaXRvck9wdHM6IHtcblx0XHRcdFx0YXV0b1N1cnJvdW5kOiAnbmV2ZXInXG5cdFx0XHR9XG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCA0KSxcblx0XHRcdF0pO1xuXG5cdFx0XHQvLyB0eXBlIGEgYFxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ2AnLCAna2V5Ym9hcmQnKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdgIGEgPSBhc2QnKTtcblx0XHR9KTtcblxuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J3ZhciBhID0gYXNkJ1xuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGF1dG9DbG9zaW5nTGFuZ3VhZ2VJZCxcblx0XHRcdGVkaXRvck9wdHM6IHtcblx0XHRcdFx0YXV0b1N1cnJvdW5kOiAncXVvdGVzJ1xuXHRcdFx0fVxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblxuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNCksXG5cdFx0XHRdKTtcblxuXHRcdFx0Ly8gdHlwZSBhIGBcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdgJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ2B2YXJgIGEgPSBhc2QnKTtcblxuXHRcdFx0Ly8gdHlwZSBhIChcblx0XHRcdHZpZXdNb2RlbC50eXBlKCcoJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ2AoYCBhID0gYXNkJyk7XG5cdFx0fSk7XG5cblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCd2YXIgYSA9IGFzZCdcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBhdXRvQ2xvc2luZ0xhbmd1YWdlSWQsXG5cdFx0XHRlZGl0b3JPcHRzOiB7XG5cdFx0XHRcdGF1dG9TdXJyb3VuZDogJ2JyYWNrZXRzJ1xuXHRcdFx0fVxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblxuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNCksXG5cdFx0XHRdKTtcblxuXHRcdFx0Ly8gdHlwZSBhIChcblx0XHRcdHZpZXdNb2RlbC50eXBlKCcoJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJyh2YXIpIGEgPSBhc2QnKTtcblxuXHRcdFx0Ly8gdHlwZSBhIGBcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdgJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJyhgKSBhID0gYXNkJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2F1dG9DbG9zaW5nUGFpcnMgLSBxdW90ZScsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCd2YXIgYSA9IFtdOycsXG5cdFx0XHRcdCd2YXIgYiA9IGBhc2RgOycsXG5cdFx0XHRcdCd2YXIgYyA9IFxcJ2FzZFxcJzsnLFxuXHRcdFx0XHQndmFyIGQgPSBcImFzZFwiOycsXG5cdFx0XHRcdCd2YXIgZSA9IC8qMyovXHQzOycsXG5cdFx0XHRcdCd2YXIgZiA9IC8qKiAzICovMzsnLFxuXHRcdFx0XHQndmFyIGcgPSAoMys1KTsnLFxuXHRcdFx0XHQndmFyIGggPSB7IGE6IFxcJ3ZhbHVlXFwnIH07Jyxcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBhdXRvQ2xvc2luZ0xhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cblx0XHRcdGNvbnN0IGF1dG9DbG9zZVBvc2l0aW9ucyA9IFtcblx0XHRcdFx0J3ZhciBhIHw9fCBbfF18O3wnLFxuXHRcdFx0XHQndmFyIGIgfD18IGBhc2RgfDt8Jyxcblx0XHRcdFx0J3ZhciBjIHw9fCBcXCdhc2RcXCd8O3wnLFxuXHRcdFx0XHQndmFyIGQgfD18IFwiYXNkXCJ8O3wnLFxuXHRcdFx0XHQndmFyIGUgfD18IC8qMyovfFx0Mzt8Jyxcblx0XHRcdFx0J3ZhciBmIHw9fCAvKip8IDMgKi8zO3wnLFxuXHRcdFx0XHQndmFyIGcgfD18ICgzKzUpfDt8Jyxcblx0XHRcdFx0J3ZhciBoIHw9fCB7fCBhOnwgXFwndmFsdWVcXCd8IHx9fDt8Jyxcblx0XHRcdF07XG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gYXV0b0Nsb3NlUG9zaXRpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBpICsgMTtcblx0XHRcdFx0Y29uc3QgYXV0b0Nsb3NlQ29sdW1ucyA9IGV4dHJhY3RBdXRvQ2xvc2luZ1NwZWNpYWxDb2x1bW5zKG1vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZU51bWJlciksIGF1dG9DbG9zZVBvc2l0aW9uc1tpXSk7XG5cblx0XHRcdFx0Zm9yIChsZXQgY29sdW1uID0gMTsgY29sdW1uIDwgYXV0b0Nsb3NlQ29sdW1ucy5sZW5ndGg7IGNvbHVtbisrKSB7XG5cdFx0XHRcdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKGxpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdGlmIChhdXRvQ2xvc2VDb2x1bW5zW2NvbHVtbl0gPT09IEF1dG9DbG9zaW5nQ29sdW1uVHlwZS5TcGVjaWFsMSkge1xuXHRcdFx0XHRcdFx0YXNzZXJ0VHlwZShlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwsIGxpbmVOdW1iZXIsIGNvbHVtbiwgJ1xcJycsICdcXCdcXCcnLCBgYXV0byBjbG9zZXMgQCAoJHtsaW5lTnVtYmVyfSwgJHtjb2x1bW59KWApO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoYXV0b0Nsb3NlQ29sdW1uc1tjb2x1bW5dID09PSBBdXRvQ2xvc2luZ0NvbHVtblR5cGUuU3BlY2lhbDIpIHtcblx0XHRcdFx0XHRcdGFzc2VydFR5cGUoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsLCBsaW5lTnVtYmVyLCBjb2x1bW4sICdcXCcnLCAnJywgYG92ZXIgdHlwZXMgQCAoJHtsaW5lTnVtYmVyfSwgJHtjb2x1bW59KWApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRhc3NlcnRUeXBlKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCwgbGluZU51bWJlciwgY29sdW1uLCAnXFwnJywgJ1xcJycsIGBkb2VzIG5vdCBhdXRvIGNsb3NlIEAgKCR7bGluZU51bWJlcn0sICR7Y29sdW1ufSlgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnYXV0b0Nsb3NpbmdQYWlycyAtIG11bHRpLWNoYXJhY3RlciBhdXRvY2xvc2UnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnJyxcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBhdXRvQ2xvc2luZ0xhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cblx0XHRcdG1vZGVsLnNldFZhbHVlKCdiZWdpJyk7XG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpXSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnYmVnaW5lbmQnKTtcblxuXHRcdFx0bW9kZWwuc2V0VmFsdWUoJy8qJyk7XG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpXSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnKicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnLyoqICovJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2F1dG9DbG9zaW5nUGFpcnMgLSBkb2MgY29tbWVudHMgY2FuIGJlIHR1cm5lZCBvZmYnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnJyxcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBhdXRvQ2xvc2luZ0xhbmd1YWdlSWQsXG5cdFx0XHRlZGl0b3JPcHRzOiB7XG5cdFx0XHRcdGF1dG9DbG9zaW5nQ29tbWVudHM6ICduZXZlcidcblx0XHRcdH1cblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cblx0XHRcdG1vZGVsLnNldFZhbHVlKCcvKicpO1xuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbbmV3IFNlbGVjdGlvbigxLCAzLCAxLCAzKV0pO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJyonLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJy8qKicpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNzIxNzc6IG11bHRpLWNoYXJhY3RlciBhdXRvY2xvc2Ugd2l0aCBjb25mbGljdGluZyBwYXR0ZXJucycsICgpID0+IHtcblx0XHRjb25zdCBsYW5ndWFnZUlkID0gJ2F1dG9DbG9zaW5nTW9kZU11bHRpQ2hhcic7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VTZXJ2aWNlLnJlZ2lzdGVyTGFuZ3VhZ2UoeyBpZDogbGFuZ3VhZ2VJZCB9KSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UucmVnaXN0ZXIobGFuZ3VhZ2VJZCwge1xuXHRcdFx0YXV0b0Nsb3NpbmdQYWlyczogW1xuXHRcdFx0XHR7IG9wZW46ICcoJywgY2xvc2U6ICcpJyB9LFxuXHRcdFx0XHR7IG9wZW46ICcoKicsIGNsb3NlOiAnKiknIH0sXG5cdFx0XHRcdHsgb3BlbjogJzxAJywgY2xvc2U6ICdAPicgfSxcblx0XHRcdFx0eyBvcGVuOiAnPEBAJywgY2xvc2U6ICdAQD4nIH0sXG5cdFx0XHRdLFxuXHRcdH0pKTtcblxuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0JycsXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogbGFuZ3VhZ2VJZFxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCcoJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICcoKScpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJyonLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJygqKiknLCBgZG9lc24ndCBhZGQgZW50aXJlIGNsb3NlIHdoZW4gYWxyZWFkeSBjbG9zZWQgc3Vic3RyaW5nIGlzIHRoZXJlYCk7XG5cblx0XHRcdG1vZGVsLnNldFZhbHVlKCcoJyk7XG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpXSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnKicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnKCoqKScsIGBkb2VzIGFkZCBlbnRpcmUgY2xvc2UgaWYgbm90IGFscmVhZHkgdGhlcmVgKTtcblxuXHRcdFx0bW9kZWwuc2V0VmFsdWUoJycpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJzxAJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICc8QEA+Jyk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnQCcsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnPEBAQEA+JywgYGF1dG9jbG9zZXMgd2hlbiBiZWZvcmUgbXVsdGktY2hhcmFjdGVyIGNsb3NpbmcgYnJhY2VgKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCcoJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICc8QEAoKUBAPicsIGBhdXRvY2xvc2VzIHdoZW4gYmVmb3JlIG11bHRpLWNoYXJhY3RlciBjbG9zaW5nIGJyYWNlYCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM1NTMxNDogRG8gbm90IGF1dG8tY2xvc2Ugd2hlbiBlbmRpbmcgd2l0aCBvcGVuJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxhbmd1YWdlSWQgPSAnbXlFbGVjdHJpY01vZGUnO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZS5yZWdpc3Rlckxhbmd1YWdlKHsgaWQ6IGxhbmd1YWdlSWQgfSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLnJlZ2lzdGVyKGxhbmd1YWdlSWQsIHtcblx0XHRcdGF1dG9DbG9zaW5nUGFpcnM6IFtcblx0XHRcdFx0eyBvcGVuOiAneycsIGNsb3NlOiAnfScgfSxcblx0XHRcdFx0eyBvcGVuOiAnWycsIGNsb3NlOiAnXScgfSxcblx0XHRcdFx0eyBvcGVuOiAnKCcsIGNsb3NlOiAnKScgfSxcblx0XHRcdFx0eyBvcGVuOiAnXFwnJywgY2xvc2U6ICdcXCcnLCBub3RJbjogWydzdHJpbmcnLCAnY29tbWVudCddIH0sXG5cdFx0XHRcdHsgb3BlbjogJ1xcXCInLCBjbG9zZTogJ1xcXCInLCBub3RJbjogWydzdHJpbmcnXSB9LFxuXHRcdFx0XHR7IG9wZW46ICdCXFxcIicsIGNsb3NlOiAnXFxcIicsIG5vdEluOiBbJ3N0cmluZycsICdjb21tZW50J10gfSxcblx0XHRcdFx0eyBvcGVuOiAnYCcsIGNsb3NlOiAnYCcsIG5vdEluOiBbJ3N0cmluZycsICdjb21tZW50J10gfSxcblx0XHRcdFx0eyBvcGVuOiAnLyoqJywgY2xvc2U6ICcgKi8nLCBub3RJbjogWydzdHJpbmcnXSB9XG5cdFx0XHRdLFxuXHRcdH0pKTtcblxuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J2xpdHRsZSBnb2F0Jyxcblx0XHRcdFx0J2xpdHRsZSBMQU1CJyxcblx0XHRcdFx0J2xpdHRsZSBzaGVlcCcsXG5cdFx0XHRcdCdCaWcgTEFNQidcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBsYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKG1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHRcdGFzc2VydFR5cGUoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsLCAxLCA0LCAnXCInLCAnXCInLCBgZG9lcyBub3QgZG91YmxlIHF1b3RlIHdoZW4gZW5kaW5nIHdpdGggb3BlbmApO1xuXHRcdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKG1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHRcdGFzc2VydFR5cGUoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsLCAyLCA0LCAnXCInLCAnXCInLCBgZG9lcyBub3QgZG91YmxlIHF1b3RlIHdoZW4gZW5kaW5nIHdpdGggb3BlbmApO1xuXHRcdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKG1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHRcdGFzc2VydFR5cGUoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsLCAzLCA0LCAnXCInLCAnXCInLCBgZG9lcyBub3QgZG91YmxlIHF1b3RlIHdoZW4gZW5kaW5nIHdpdGggb3BlbmApO1xuXHRcdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKG1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHRcdGFzc2VydFR5cGUoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsLCA0LCAyLCAnXCInLCAnXCInLCBgZG9lcyBub3QgZG91YmxlIHF1b3RlIHdoZW4gZW5kaW5nIHdpdGggb3BlbmApO1xuXHRcdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKG1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHRcdGFzc2VydFR5cGUoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsLCA0LCAzLCAnXCInLCAnXCInLCBgZG9lcyBub3QgZG91YmxlIHF1b3RlIHdoZW4gZW5kaW5nIHdpdGggb3BlbmApO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMjc5Mzc6IFRyeWluZyB0byBhZGQgYW4gaXRlbSB0byB0aGUgZnJvbnQgb2YgYSBsaXN0IGlzIGN1bWJlcnNvbWUnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQndmFyIGFyciA9IFtcImJcIiwgXCJjXCJdOydcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBhdXRvQ2xvc2luZ0xhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRhc3NlcnRUeXBlKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCwgMSwgMTIsICdcIicsICdcIicsIGBkb2VzIG5vdCBvdmVyIHR5cGUgYW5kIHdpbGwgbm90IGF1dG8gY2xvc2VgKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzI1NjU4IC0gRG8gbm90IGF1dG8tY2xvc2Ugc2luZ2xlL2RvdWJsZSBxdW90ZXMgYWZ0ZXIgd29yZCBjaGFyYWN0ZXJzJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0JycsXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogYXV0b0Nsb3NpbmdMYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXG5cdFx0XHRmdW5jdGlvbiB0eXBlQ2hhcmFjdGVycyh2aWV3TW9kZWw6IFZpZXdNb2RlbCwgY2hhcnM6IHN0cmluZyk6IHZvaWQge1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gY2hhcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0XHR2aWV3TW9kZWwudHlwZShjaGFyc1tpXSwgJ2tleWJvYXJkJyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gRmlyc3QgZ2lmXG5cdFx0XHRtb2RlbC50b2tlbml6YXRpb24uZm9yY2VUb2tlbml6YXRpb24obW9kZWwuZ2V0TGluZUNvdW50KCkpO1xuXHRcdFx0dHlwZUNoYXJhY3RlcnModmlld01vZGVsLCAndGVzdGUxID0gdGVzdGVcXCcgb2snKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ3Rlc3RlMSA9IHRlc3RlXFwnIG9rJyk7XG5cblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMSwgMTAwMCwgMSwgMTAwMCldKTtcblx0XHRcdHR5cGVDaGFyYWN0ZXJzKHZpZXdNb2RlbCwgJ1xcbicpO1xuXHRcdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKG1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHRcdHR5cGVDaGFyYWN0ZXJzKHZpZXdNb2RlbCwgJ3Rlc3RlMiA9IHRlc3RlIFxcJ29rJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICd0ZXN0ZTIgPSB0ZXN0ZSBcXCdva1xcJycpO1xuXG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDIsIDEwMDAsIDIsIDEwMDApXSk7XG5cdFx0XHR0eXBlQ2hhcmFjdGVycyh2aWV3TW9kZWwsICdcXG4nKTtcblx0XHRcdG1vZGVsLnRva2VuaXphdGlvbi5mb3JjZVRva2VuaXphdGlvbihtb2RlbC5nZXRMaW5lQ291bnQoKSk7XG5cdFx0XHR0eXBlQ2hhcmFjdGVycyh2aWV3TW9kZWwsICd0ZXN0ZTMgPSB0ZXN0ZVwiIG9rJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMyksICd0ZXN0ZTMgPSB0ZXN0ZVwiIG9rJyk7XG5cblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMywgMTAwMCwgMywgMTAwMCldKTtcblx0XHRcdHR5cGVDaGFyYWN0ZXJzKHZpZXdNb2RlbCwgJ1xcbicpO1xuXHRcdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKG1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHRcdHR5cGVDaGFyYWN0ZXJzKHZpZXdNb2RlbCwgJ3Rlc3RlNCA9IHRlc3RlIFwib2snKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg0KSwgJ3Rlc3RlNCA9IHRlc3RlIFwib2tcIicpO1xuXG5cdFx0XHQvLyBTZWNvbmQgZ2lmXG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDQsIDEwMDAsIDQsIDEwMDApXSk7XG5cdFx0XHR0eXBlQ2hhcmFjdGVycyh2aWV3TW9kZWwsICdcXG4nKTtcblx0XHRcdG1vZGVsLnRva2VuaXphdGlvbi5mb3JjZVRva2VuaXphdGlvbihtb2RlbC5nZXRMaW5lQ291bnQoKSk7XG5cdFx0XHR0eXBlQ2hhcmFjdGVycyh2aWV3TW9kZWwsICd0ZXN0ZSBcXCcnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCg1KSwgJ3Rlc3RlIFxcJ1xcJycpO1xuXG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDUsIDEwMDAsIDUsIDEwMDApXSk7XG5cdFx0XHR0eXBlQ2hhcmFjdGVycyh2aWV3TW9kZWwsICdcXG4nKTtcblx0XHRcdG1vZGVsLnRva2VuaXphdGlvbi5mb3JjZVRva2VuaXphdGlvbihtb2RlbC5nZXRMaW5lQ291bnQoKSk7XG5cdFx0XHR0eXBlQ2hhcmFjdGVycyh2aWV3TW9kZWwsICd0ZXN0ZSBcIicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDYpLCAndGVzdGUgXCJcIicpO1xuXG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDYsIDEwMDAsIDYsIDEwMDApXSk7XG5cdFx0XHR0eXBlQ2hhcmFjdGVycyh2aWV3TW9kZWwsICdcXG4nKTtcblx0XHRcdG1vZGVsLnRva2VuaXphdGlvbi5mb3JjZVRva2VuaXphdGlvbihtb2RlbC5nZXRMaW5lQ291bnQoKSk7XG5cdFx0XHR0eXBlQ2hhcmFjdGVycyh2aWV3TW9kZWwsICd0ZXN0ZVxcJycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDcpLCAndGVzdGVcXCcnKTtcblxuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbbmV3IFNlbGVjdGlvbig3LCAxMDAwLCA3LCAxMDAwKV0pO1xuXHRcdFx0dHlwZUNoYXJhY3RlcnModmlld01vZGVsLCAnXFxuJyk7XG5cdFx0XHRtb2RlbC50b2tlbml6YXRpb24uZm9yY2VUb2tlbml6YXRpb24obW9kZWwuZ2V0TGluZUNvdW50KCkpO1xuXHRcdFx0dHlwZUNoYXJhY3RlcnModmlld01vZGVsLCAndGVzdGVcIicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDgpLCAndGVzdGVcIicpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMzczMTUgLSBvdmVydHlwZXMgb25seSB0aG9zZSBjaGFyYWN0ZXJzIHRoYXQgaXQgaW5zZXJ0ZWQnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnJyxcblx0XHRcdFx0J3k9KCk7J1xuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGF1dG9DbG9zaW5nTGFuZ3VhZ2VJZFxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBQb3NpdGlvbigxLCAxKSk7XG5cblx0XHRcdHZpZXdNb2RlbC50eXBlKCd4PSgnLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ3g9KCknKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ2FzZCcsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAneD0oYXNkKScpO1xuXG5cdFx0XHQvLyBvdmVydHlwZSFcblx0XHRcdHZpZXdNb2RlbC50eXBlKCcpJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICd4PShhc2QpJyk7XG5cblx0XHRcdC8vIGRvIG5vdCBvdmVydHlwZSFcblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMiwgNCwgMiwgNCldKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCcpJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICd5PSgpKTsnKTtcblxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMzczMTUgLSBzdG9wcyBvdmVydHlwaW5nIG9uY2UgY3Vyc29yIGxlYXZlcyBhcmVhJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0JycsXG5cdFx0XHRcdCd5PSgpOydcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBhdXRvQ2xvc2luZ0xhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgneD0oJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICd4PSgpJyk7XG5cblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMSwgNSwgMSwgNSldKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCcpJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICd4PSgpKScpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMzczMTUgLSBpdCBvdmVydHlwZXMgb25seSBvbmNlJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0JycsXG5cdFx0XHRcdCd5PSgpOydcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBhdXRvQ2xvc2luZ0xhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgneD0oJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICd4PSgpJyk7XG5cblx0XHRcdHZpZXdNb2RlbC50eXBlKCcpJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICd4PSgpJyk7XG5cblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCldKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCcpJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICd4PSgpKScpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMzczMTUgLSBpdCBjYW4gcmVtZW1iZXIgbXVsdGlwbGUgYXV0by1jbG9zZWQgaW5zdGFuY2VzJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0JycsXG5cdFx0XHRcdCd5PSgpOydcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBhdXRvQ2xvc2luZ0xhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgneD0oJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICd4PSgpJyk7XG5cblx0XHRcdHZpZXdNb2RlbC50eXBlKCcoJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICd4PSgoKSknKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJyknLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ3g9KCgpKScpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnKScsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAneD0oKCkpJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMTgyNzAgLSBhdXRvIGNsb3NpbmcgZGVsZXRlcyBvbmx5IHRob3NlIGNoYXJhY3RlcnMgdGhhdCBpdCBpbnNlcnRlZCcsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQneT0oKTsnXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogYXV0b0Nsb3NpbmdMYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDEpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ3g9KCcsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAneD0oKScpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnYXNkJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICd4PShhc2QpJyk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ3g9KCknKTtcblxuXHRcdFx0Ly8gZGVsZXRlIGNsb3NpbmcgY2hhciFcblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICd4PScpO1xuXG5cdFx0XHQvLyBkbyBub3QgZGVsZXRlIGNsb3NpbmcgY2hhciFcblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMiwgNCwgMiwgNCldKTtcblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICd5PSk7Jyk7XG5cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzc4NTI3IC0gZG9lcyBub3QgY2xvc2UgcXVvdGUgb24gb2RkIGNvdW50JywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J3N0ZDo6Y291dCA8PCBcXCdcIlxcJyA8PCBlbnRyeU1hcCdcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBhdXRvQ2xvc2luZ0xhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDEsIDI5LCAxLCAyOSldKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1snLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ3N0ZDo6Y291dCA8PCBcXCdcIlxcJyA8PCBlbnRyeU1hcFtdJyk7XG5cblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcIicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnc3RkOjpjb3V0IDw8IFxcJ1wiXFwnIDw8IGVudHJ5TWFwW1wiXCJdJyk7XG5cblx0XHRcdHZpZXdNb2RlbC50eXBlKCdhJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdzdGQ6OmNvdXQgPDwgXFwnXCJcXCcgPDwgZW50cnlNYXBbXCJhXCJdJyk7XG5cblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcIicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnc3RkOjpjb3V0IDw8IFxcJ1wiXFwnIDw8IGVudHJ5TWFwW1wiYVwiXScpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXScsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnc3RkOjpjb3V0IDw8IFxcJ1wiXFwnIDw8IGVudHJ5TWFwW1wiYVwiXScpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjODU5ODMgLSBlZGl0b3IuYXV0b0Nsb3NpbmdCcmFja2V0czogYmVmb3JlV2hpdGVzcGFjZSBpcyBpbmNvcnJlY3QgZm9yIFB5dGhvbicsICgpID0+IHtcblx0XHRjb25zdCBsYW5ndWFnZUlkID0gJ3B5dGhvbk1vZGUnO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZS5yZWdpc3Rlckxhbmd1YWdlKHsgaWQ6IGxhbmd1YWdlSWQgfSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLnJlZ2lzdGVyKGxhbmd1YWdlSWQsIHtcblx0XHRcdGF1dG9DbG9zaW5nUGFpcnM6IFtcblx0XHRcdFx0eyBvcGVuOiAneycsIGNsb3NlOiAnfScgfSxcblx0XHRcdFx0eyBvcGVuOiAnWycsIGNsb3NlOiAnXScgfSxcblx0XHRcdFx0eyBvcGVuOiAnKCcsIGNsb3NlOiAnKScgfSxcblx0XHRcdFx0eyBvcGVuOiAnXFxcIicsIGNsb3NlOiAnXFxcIicsIG5vdEluOiBbJ3N0cmluZyddIH0sXG5cdFx0XHRcdHsgb3BlbjogJ3JcXFwiJywgY2xvc2U6ICdcXFwiJywgbm90SW46IFsnc3RyaW5nJywgJ2NvbW1lbnQnXSB9LFxuXHRcdFx0XHR7IG9wZW46ICdSXFxcIicsIGNsb3NlOiAnXFxcIicsIG5vdEluOiBbJ3N0cmluZycsICdjb21tZW50J10gfSxcblx0XHRcdFx0eyBvcGVuOiAndVxcXCInLCBjbG9zZTogJ1xcXCInLCBub3RJbjogWydzdHJpbmcnLCAnY29tbWVudCddIH0sXG5cdFx0XHRcdHsgb3BlbjogJ1VcXFwiJywgY2xvc2U6ICdcXFwiJywgbm90SW46IFsnc3RyaW5nJywgJ2NvbW1lbnQnXSB9LFxuXHRcdFx0XHR7IG9wZW46ICdmXFxcIicsIGNsb3NlOiAnXFxcIicsIG5vdEluOiBbJ3N0cmluZycsICdjb21tZW50J10gfSxcblx0XHRcdFx0eyBvcGVuOiAnRlxcXCInLCBjbG9zZTogJ1xcXCInLCBub3RJbjogWydzdHJpbmcnLCAnY29tbWVudCddIH0sXG5cdFx0XHRcdHsgb3BlbjogJ2JcXFwiJywgY2xvc2U6ICdcXFwiJywgbm90SW46IFsnc3RyaW5nJywgJ2NvbW1lbnQnXSB9LFxuXHRcdFx0XHR7IG9wZW46ICdCXFxcIicsIGNsb3NlOiAnXFxcIicsIG5vdEluOiBbJ3N0cmluZycsICdjb21tZW50J10gfSxcblx0XHRcdFx0eyBvcGVuOiAnXFwnJywgY2xvc2U6ICdcXCcnLCBub3RJbjogWydzdHJpbmcnLCAnY29tbWVudCddIH0sXG5cdFx0XHRcdHsgb3BlbjogJ3JcXCcnLCBjbG9zZTogJ1xcJycsIG5vdEluOiBbJ3N0cmluZycsICdjb21tZW50J10gfSxcblx0XHRcdFx0eyBvcGVuOiAnUlxcJycsIGNsb3NlOiAnXFwnJywgbm90SW46IFsnc3RyaW5nJywgJ2NvbW1lbnQnXSB9LFxuXHRcdFx0XHR7IG9wZW46ICd1XFwnJywgY2xvc2U6ICdcXCcnLCBub3RJbjogWydzdHJpbmcnLCAnY29tbWVudCddIH0sXG5cdFx0XHRcdHsgb3BlbjogJ1VcXCcnLCBjbG9zZTogJ1xcJycsIG5vdEluOiBbJ3N0cmluZycsICdjb21tZW50J10gfSxcblx0XHRcdFx0eyBvcGVuOiAnZlxcJycsIGNsb3NlOiAnXFwnJywgbm90SW46IFsnc3RyaW5nJywgJ2NvbW1lbnQnXSB9LFxuXHRcdFx0XHR7IG9wZW46ICdGXFwnJywgY2xvc2U6ICdcXCcnLCBub3RJbjogWydzdHJpbmcnLCAnY29tbWVudCddIH0sXG5cdFx0XHRcdHsgb3BlbjogJ2JcXCcnLCBjbG9zZTogJ1xcJycsIG5vdEluOiBbJ3N0cmluZycsICdjb21tZW50J10gfSxcblx0XHRcdFx0eyBvcGVuOiAnQlxcJycsIGNsb3NlOiAnXFwnJywgbm90SW46IFsnc3RyaW5nJywgJ2NvbW1lbnQnXSB9LFxuXHRcdFx0XHR7IG9wZW46ICdgJywgY2xvc2U6ICdgJywgbm90SW46IFsnc3RyaW5nJ10gfVxuXHRcdFx0XSxcblx0XHR9KSk7XG5cblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCdmb29cXCdoZWxsb1xcJydcblx0XHRcdF0sXG5cdFx0XHRlZGl0b3JPcHRzOiB7XG5cdFx0XHRcdGF1dG9DbG9zaW5nQnJhY2tldHM6ICdiZWZvcmVXaGl0ZXNwYWNlJ1xuXHRcdFx0fSxcblx0XHRcdGxhbmd1YWdlSWQ6IGxhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRhc3NlcnRUeXBlKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCwgMSwgNCwgJygnLCAnKCcsIGBkb2VzIG5vdCBhdXRvIGNsb3NlIEAgKDEsIDQpYCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM3ODk3NSAtIFBhcmVudGhlc2VzIHN3YWxsb3dpbmcgZG9lcyBub3Qgd29yayB3aGVuIHBhcmVudGhlc2VzIGFyZSBpbnNlcnRlZCBieSBhdXRvY29tcGxldGUnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQnPGRpdiBpZCdcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBhdXRvQ2xvc2luZ0xhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDEsIDgsIDEsIDgpXSk7XG5cblx0XHRcdHZpZXdNb2RlbC5leGVjdXRlRWRpdHMoJ3NuaXBwZXQnLCBbeyByYW5nZTogbmV3IFJhbmdlKDEsIDYsIDEsIDgpLCB0ZXh0OiAnaWQ9XCJcIicgfV0sICgpID0+IFtuZXcgU2VsZWN0aW9uKDEsIDEwLCAxLCAxMCldKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJzxkaXYgaWQ9XCJcIicpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnYScsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnPGRpdiBpZD1cImFcIicpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXCInLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJzxkaXYgaWQ9XCJhXCInKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzc4ODMzIC0gQWRkIGNvbmZpZyB0byB1c2Ugb2xkIGJyYWNrZXRzL3F1b3RlcyBvdmVydHlwaW5nJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0JycsXG5cdFx0XHRcdCd5PSgpOydcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBhdXRvQ2xvc2luZ0xhbmd1YWdlSWQsXG5cdFx0XHRlZGl0b3JPcHRzOiB7XG5cdFx0XHRcdGF1dG9DbG9zaW5nT3ZlcnR5cGU6ICdhbHdheXMnXG5cdFx0XHR9XG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDEpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ3g9KCcsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAneD0oKScpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnKScsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAneD0oKScpO1xuXG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpXSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnKScsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAneD0oKScpO1xuXG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDIsIDQsIDIsIDQpXSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnKScsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAneT0oKTsnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE1ODI1OiBhY2NlbnRzIG9uIG1hYyBVUyBpbnRsIGtleWJvYXJkJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBhdXRvQ2xvc2luZ0xhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXG5cdFx0XHQvLyBUeXBpbmcgYCArIGUgb24gdGhlIG1hYyBVUyBpbnRsIGtiIGxheW91dFxuXHRcdFx0dmlld01vZGVsLnN0YXJ0Q29tcG9zaXRpb24oKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdgJywgJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwuY29tcG9zaXRpb25UeXBlKCdcdTAwRTgnLCAxLCAwLCAwLCAna2V5Ym9hcmQnKTtcblx0XHRcdHZpZXdNb2RlbC5lbmRDb21wb3NpdGlvbigna2V5Ym9hcmQnKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdcdTAwRTgnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzkwMDE2OiBhbGxvdyBhY2NlbnRzIG9uIG1hYyBVUyBpbnRsIGtleWJvYXJkIHRvIHN1cnJvdW5kIHNlbGVjdGlvbicsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCd0ZXN0J1xuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGF1dG9DbG9zaW5nTGFuZ3VhZ2VJZFxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNSldKTtcblxuXHRcdFx0Ly8gVHlwaW5nIGAgKyBlIG9uIHRoZSBtYWMgVVMgaW50bCBrYiBsYXlvdXRcblx0XHRcdHZpZXdNb2RlbC5zdGFydENvbXBvc2l0aW9uKCk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFwnJywgJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwuY29tcG9zaXRpb25UeXBlKCdcXCcnLCAxLCAwLCAwLCAna2V5Ym9hcmQnKTtcblx0XHRcdHZpZXdNb2RlbC5jb21wb3NpdGlvblR5cGUoJ1xcJycsIDEsIDAsIDAsICdrZXlib2FyZCcpO1xuXHRcdFx0dmlld01vZGVsLmVuZENvbXBvc2l0aW9uKCdrZXlib2FyZCcpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ1xcJ3Rlc3RcXCcnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzUzMzU3OiBPdmVyIHR5cGluZyBpZ25vcmVzIGNoYXJhY3RlcnMgYWZ0ZXIgYmFja3NsYXNoJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J2NvbnNvbGUubG9nKCk7J1xuXHRcdFx0XSxcblx0XHRcdGxhbmd1YWdlSWQ6IGF1dG9DbG9zaW5nTGFuZ3VhZ2VJZFxuXHRcdH0sIChlZGl0b3IsIG1vZGVsLCB2aWV3TW9kZWwpID0+IHtcblxuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbbmV3IFNlbGVjdGlvbigxLCAxMywgMSwgMTMpXSk7XG5cblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcXCcnLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnY29uc29sZS5sb2coXFwnXFwnKTsnKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ2l0JywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ2NvbnNvbGUubG9nKFxcJ2l0XFwnKTsnKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcXFwnLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnY29uc29sZS5sb2coXFwnaXRcXFxcXFwnKTsnKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcJycsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdjb25zb2xlLmxvZyhcXCdpdFxcXFxcXCdcXCcpOycpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjODQ5OTg6IE92ZXJ0eXBpbmcgQnJhY2tldHMgZG9lc25cXCd0IHdvcmsgYWZ0ZXIgYmFja3NsYXNoJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0Jydcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBhdXRvQ2xvc2luZ0xhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSldKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcXFwnLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnXFxcXCcpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnKCcsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdcXFxcKCknKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ2FiYycsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdcXFxcKGFiYyknKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcXFwnLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnXFxcXChhYmNcXFxcKScpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnKScsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdcXFxcKGFiY1xcXFwpJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMyNzczOiBBY2NlbnRzIChcdTAwQjRgXHUwMEE4Xiwgb3RoZXJzPykgYXJlIGluc2VydGVkIGluIHRoZSB3cm9uZyBwb3NpdGlvbiAoTWFjKScsICgpID0+IHtcblx0XHR1c2luZ0N1cnNvcih7XG5cdFx0XHR0ZXh0OiBbXG5cdFx0XHRcdCdoZWxsbycsXG5cdFx0XHRcdCd3b3JsZCdcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBhdXRvQ2xvc2luZ0xhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXG5cdFx0XHQvLyBUeXBpbmcgYCBhbmQgcHJlc3Npbmcgc2hpZnQrZG93biBvbiB0aGUgbWFjIFVTIGludGwga2IgbGF5b3V0XG5cdFx0XHQvLyBIZXJlIHdlJ3JlIGp1c3QgcmVwbGF5aW5nIHdoYXQgdGhlIGN1cnNvciBnZXRzXG5cdFx0XHR2aWV3TW9kZWwuc3RhcnRDb21wb3NpdGlvbigpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ2AnLCAna2V5Ym9hcmQnKTtcblx0XHRcdG1vdmVEb3duKGVkaXRvciwgdmlld01vZGVsLCB0cnVlKTtcblx0XHRcdHZpZXdNb2RlbC5jb21wb3NpdGlvblR5cGUoJ2AnLCAxLCAwLCAwLCAna2V5Ym9hcmQnKTtcblx0XHRcdHZpZXdNb2RlbC5jb21wb3NpdGlvblR5cGUoJ2AnLCAxLCAwLCAwLCAna2V5Ym9hcmQnKTtcblx0XHRcdHZpZXdNb2RlbC5lbmRDb21wb3NpdGlvbigna2V5Ym9hcmQnKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdgaGVsbG9cXG53b3JsZCcpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCAyLCAyLCAyKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMyNjgyMDogYXV0byBjbG9zZSBxdW90ZXMgd2hlbiBub3QgdXNlZCBhcyBhY2NlbnRzJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0Jydcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBhdXRvQ2xvc2luZ0xhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXG5cdFx0XHQvLyBvbiB0aGUgbWFjIFVTIGludGwga2IgbGF5b3V0XG5cblx0XHRcdC8vIFR5cGluZyAnICsgc3BhY2Vcblx0XHRcdHZpZXdNb2RlbC5zdGFydENvbXBvc2l0aW9uKCk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFwnJywgJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwuY29tcG9zaXRpb25UeXBlKCdcXCcnLCAxLCAwLCAwLCAna2V5Ym9hcmQnKTtcblx0XHRcdHZpZXdNb2RlbC5lbmRDb21wb3NpdGlvbigna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnXFwnXFwnJyk7XG5cblx0XHRcdC8vIFR5cGluZyBvbmUgbW9yZSAnICsgc3BhY2Vcblx0XHRcdHZpZXdNb2RlbC5zdGFydENvbXBvc2l0aW9uKCk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFwnJywgJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwuY29tcG9zaXRpb25UeXBlKCdcXCcnLCAxLCAwLCAwLCAna2V5Ym9hcmQnKTtcblx0XHRcdHZpZXdNb2RlbC5lbmRDb21wb3NpdGlvbigna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnXFwnXFwnJyk7XG5cblx0XHRcdC8vIFR5cGluZyAnIGFzIGEgY2xvc2luZyB0YWdcblx0XHRcdG1vZGVsLnNldFZhbHVlKCdcXCdhYmMnKTtcblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMSwgNSwgMSwgNSldKTtcblx0XHRcdHZpZXdNb2RlbC5zdGFydENvbXBvc2l0aW9uKCk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFwnJywgJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwuY29tcG9zaXRpb25UeXBlKCdcXCcnLCAxLCAwLCAwLCAna2V5Ym9hcmQnKTtcblx0XHRcdHZpZXdNb2RlbC5lbmRDb21wb3NpdGlvbigna2V5Ym9hcmQnKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdcXCdhYmNcXCcnKTtcblxuXHRcdFx0Ly8gcXVvdGVzIGJlZm9yZSB0aGUgbmV3bHkgYWRkZWQgY2hhcmFjdGVyIGFyZSBhbGwgcGFpcmVkLlxuXHRcdFx0bW9kZWwuc2V0VmFsdWUoJ1xcJ2FiY1xcJ2RlZiAnKTtcblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMSwgMTAsIDEsIDEwKV0pO1xuXHRcdFx0dmlld01vZGVsLnN0YXJ0Q29tcG9zaXRpb24oKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdcXCcnLCAna2V5Ym9hcmQnKTtcblx0XHRcdHZpZXdNb2RlbC5jb21wb3NpdGlvblR5cGUoJ1xcJycsIDEsIDAsIDAsICdrZXlib2FyZCcpO1xuXHRcdFx0dmlld01vZGVsLmVuZENvbXBvc2l0aW9uKCdrZXlib2FyZCcpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ1xcJ2FiY1xcJ2RlZiBcXCdcXCcnKTtcblxuXHRcdFx0Ly8gTm8gYXV0byBjbG9zaW5nIGlmIHRoZXJlIGlzIG5vbi13aGl0ZXNwYWNlIGNoYXJhY3RlciBhZnRlciB0aGUgY3Vyc29yXG5cdFx0XHRtb2RlbC5zZXRWYWx1ZSgnYWJjJyk7XG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpXSk7XG5cdFx0XHR2aWV3TW9kZWwuc3RhcnRDb21wb3NpdGlvbigpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcJycsICdrZXlib2FyZCcpO1xuXHRcdFx0dmlld01vZGVsLmNvbXBvc2l0aW9uVHlwZSgnXFwnJywgMSwgMCwgMCwgJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwuZW5kQ29tcG9zaXRpb24oJ2tleWJvYXJkJyk7XG5cblx0XHRcdC8vIE5vIGF1dG8gY2xvc2luZyBpZiBpdCdzIGFmdGVyIGEgd29yZC5cblx0XHRcdG1vZGVsLnNldFZhbHVlKCdhYmMnKTtcblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCldKTtcblx0XHRcdHZpZXdNb2RlbC5zdGFydENvbXBvc2l0aW9uKCk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFwnJywgJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwuY29tcG9zaXRpb25UeXBlKCdcXCcnLCAxLCAwLCAwLCAna2V5Ym9hcmQnKTtcblx0XHRcdHZpZXdNb2RlbC5lbmRDb21wb3NpdGlvbigna2V5Ym9hcmQnKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdhYmNcXCcnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE0NDY5MDogUXVvdGVzIGRvIG5vdCBvdmVydHlwZSB3aGVuIHVzaW5nIFVTIEludGwgUEMga2V5Ym9hcmQgbGF5b3V0JywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0Jydcblx0XHRcdF0sXG5cdFx0XHRsYW5ndWFnZUlkOiBhdXRvQ2xvc2luZ0xhbmd1YWdlSWRcblx0XHR9LCAoZWRpdG9yLCBtb2RlbCwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXG5cdFx0XHQvLyBQcmVzc2luZyAnICsgJyArIDtcblxuXHRcdFx0dmlld01vZGVsLnN0YXJ0Q29tcG9zaXRpb24oKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKGAnYCwgJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwuY29tcG9zaXRpb25UeXBlKGAnYCwgMSwgMCwgMCwgJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwuY29tcG9zaXRpb25UeXBlKGAnYCwgMSwgMCwgMCwgJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwuZW5kQ29tcG9zaXRpb24oJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwuc3RhcnRDb21wb3NpdGlvbigpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoYCdgLCAna2V5Ym9hcmQnKTtcblx0XHRcdHZpZXdNb2RlbC5jb21wb3NpdGlvblR5cGUoYCc7YCwgMSwgMCwgMCwgJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwuY29tcG9zaXRpb25UeXBlKGAnO2AsIDIsIDAsIDAsICdrZXlib2FyZCcpO1xuXHRcdFx0dmlld01vZGVsLmVuZENvbXBvc2l0aW9uKCdrZXlib2FyZCcpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgYCcnO2ApO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTQ0NjkzOiBUeXBpbmcgYSBxdW90ZSB1c2luZyBVUyBJbnRsIFBDIGtleWJvYXJkIGxheW91dCBhbHdheXMgc3Vycm91bmRzIHdvcmRzJywgKCkgPT4ge1xuXHRcdHVzaW5nQ3Vyc29yKHtcblx0XHRcdHRleHQ6IFtcblx0XHRcdFx0J2NvbnN0IGhlbGxvID0gMzsnXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogYXV0b0Nsb3NpbmdMYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbbmV3IFNlbGVjdGlvbigxLCA3LCAxLCAxMildKTtcblxuXHRcdFx0Ly8gUHJlc3NpbmcgJyArIGVcblxuXHRcdFx0dmlld01vZGVsLnN0YXJ0Q29tcG9zaXRpb24oKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKGAnYCwgJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwuY29tcG9zaXRpb25UeXBlKGBcdTAwRTlgLCAxLCAwLCAwLCAna2V5Ym9hcmQnKTtcblx0XHRcdHZpZXdNb2RlbC5jb21wb3NpdGlvblR5cGUoYFx1MDBFOWAsIDEsIDAsIDAsICdrZXlib2FyZCcpO1xuXHRcdFx0dmlld01vZGVsLmVuZENvbXBvc2l0aW9uKCdrZXlib2FyZCcpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgYGNvbnN0IFx1MDBFOSA9IDM7YCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM4MjcwMTogYXV0byBjbG9zZSBkb2VzIG5vdCBleGVjdXRlIHdoZW4gSU1FIGlzIGNhbmNlbGVkIHZpYSBiYWNrc3BhY2UnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQne30nXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogYXV0b0Nsb3NpbmdMYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbbmV3IFNlbGVjdGlvbigxLCAyLCAxLCAyKV0pO1xuXG5cdFx0XHQvLyBUeXBpbmcgYSArIGJhY2tzcGFjZVxuXHRcdFx0dmlld01vZGVsLnN0YXJ0Q29tcG9zaXRpb24oKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdhJywgJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwuY29tcG9zaXRpb25UeXBlKCcnLCAxLCAwLCAwLCAna2V5Ym9hcmQnKTtcblx0XHRcdHZpZXdNb2RlbC5lbmRDb21wb3NpdGlvbigna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAne30nKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzIwODkxOiBBbGwgY3Vyc29ycyBzaG91bGQgZG8gdGhlIHNhbWUgdGhpbmcnLCAoKSA9PiB7XG5cdFx0dXNpbmdDdXJzb3Ioe1xuXHRcdFx0dGV4dDogW1xuXHRcdFx0XHQndmFyIGEgPSBhc2QnXG5cdFx0XHRdLFxuXHRcdFx0bGFuZ3VhZ2VJZDogYXV0b0Nsb3NpbmdMYW5ndWFnZUlkXG5cdFx0fSwgKGVkaXRvciwgbW9kZWwsIHZpZXdNb2RlbCkgPT4ge1xuXG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCA5LCAxLCA5KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxMiwgMSwgMTIpLFxuXHRcdFx0XSk7XG5cblx0XHRcdC8vIHR5cGUgYSBgXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnYCcsICdrZXlib2FyZCcpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ3ZhciBhID0gYGFzZGAnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzQxODI1OiBTcGVjaWFsIGhhbmRsaW5nIG9mIHF1b3RlcyBpbiBzdXJyb3VuZGluZyBwYWlycycsICgpID0+IHtcblx0XHRjb25zdCBsYW5ndWFnZUlkID0gJ215TW9kZSc7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VTZXJ2aWNlLnJlZ2lzdGVyTGFuZ3VhZ2UoeyBpZDogbGFuZ3VhZ2VJZCB9KSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UucmVnaXN0ZXIobGFuZ3VhZ2VJZCwge1xuXHRcdFx0c3Vycm91bmRpbmdQYWlyczogW1xuXHRcdFx0XHR7IG9wZW46ICdcIicsIGNsb3NlOiAnXCInIH0sXG5cdFx0XHRcdHsgb3BlbjogJ1xcJycsIGNsb3NlOiAnXFwnJyB9LFxuXHRcdFx0XVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKCd2YXIgeCA9IFxcJ2hpXFwnOycsIGxhbmd1YWdlSWQpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgOSwgMSwgMTApLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEyLCAxLCAxMylcblx0XHRcdF0pO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1wiJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICd2YXIgeCA9IFwiaGlcIjsnLCAnYXNzZXJ0MScpO1xuXG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgOSwgMSwgMTApLFxuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEyLCAxLCAxMylcblx0XHRcdF0pO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcJycsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAndmFyIHggPSBcXCdoaVxcJzsnLCAnYXNzZXJ0MicpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdBbGwgY3Vyc29ycyBzaG91bGQgZG8gdGhlIHNhbWUgdGhpbmcgd2hlbiBkZWxldGluZyBsZWZ0JywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQndmFyIGEgPSAoKSdcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHRhdXRvQ2xvc2luZ0xhbmd1YWdlSWRcblx0XHQpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KSxcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxMCwgMSwgMTApLFxuXHRcdFx0XSk7XG5cblx0XHRcdC8vIGRlbGV0ZSBsZWZ0XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ3ZhIGEgPSApJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM3MTAwOiBNb3VzZSB3b3JkIHNlbGVjdGlvbiBpcyBzdHJhbmdlIHdoZW4gbm9uLXdvcmQgY2hhcmFjdGVyIGlzIGF0IHRoZSBlbmQgb2YgbGluZScsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFtcblx0XHRcdFx0J2JlZm9yZS5hJyxcblx0XHRcdFx0J2JlZm9yZScsXG5cdFx0XHRcdCdoZWxsbzonLFxuXHRcdFx0XHQndGhlcmU6Jyxcblx0XHRcdFx0J3RoaXMgaXMgc3RyYW5nZTonLFxuXHRcdFx0XHQnaGVyZScsXG5cdFx0XHRcdCdpdCcsXG5cdFx0XHRcdCdpcycsXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5Xb3JkU2VsZWN0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCB7XG5cdFx0XHRcdHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oMywgNylcblx0XHRcdH0pO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigzLCA3LCAzLCA3KSk7XG5cblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuV29yZFNlbGVjdERyYWcucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIHtcblx0XHRcdFx0cG9zaXRpb246IG5ldyBQb3NpdGlvbig0LCA3KVxuXHRcdFx0fSk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDMsIDcsIDQsIDcpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzExMjAzOTogc2hpZnQtY29udGludWluZyBhIGRvdWJsZS90cmlwbGUtY2xpY2sgYW5kIGRyYWcgc2VsZWN0aW9uIGRvZXMgbm90IHJlbWVtYmVyIGl0cyBzdGFydGluZyBtb2RlJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnanVzdCBzb21lIHRleHQnLFxuXHRcdFx0XHQnYW5kIGFub3RoZXIgbGluZScsXG5cdFx0XHRcdCdhbmQgYW5vdGhlciBvbmUnLFxuXHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuV29yZFNlbGVjdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwge1xuXHRcdFx0XHRwb3NpdGlvbjogbmV3IFBvc2l0aW9uKDIsIDYpXG5cdFx0XHR9KTtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuTW92ZVRvU2VsZWN0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCB7XG5cdFx0XHRcdHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oMSwgOCksXG5cdFx0XHR9KTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMiwgMTIsIDEsIDYpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE1ODIzNjogU2hpZnQgY2xpY2sgc2VsZWN0aW9uIGRvZXMgbm90IHdvcmsgb24gbGluZSBudW1iZXIgaW5kaWNhdG9yJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnanVzdCBzb21lIHRleHQnLFxuXHRcdFx0XHQnYW5kIGFub3RoZXIgbGluZScsXG5cdFx0XHRcdCdhbmQgYW5vdGhlciBvbmUnLFxuXHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuTW92ZVRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCB7XG5cdFx0XHRcdHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oMywgNSlcblx0XHRcdH0pO1xuXHRcdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5MaW5lU2VsZWN0RHJhZy5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwge1xuXHRcdFx0XHRwb3NpdGlvbjogbmV3IFBvc2l0aW9uKDIsIDEpXG5cdFx0XHR9KTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMywgNSwgMiwgMSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTExNTEzOiBUZXh0IGdldHMgYXV0b21hdGljYWxseSBzZWxlY3RlZCB3aGVuIHR5cGluZyBhdCB0aGUgc2FtZSBsb2NhdGlvbiBpbiBhbm90aGVyIGVkaXRvcicsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFtcblx0XHRcdFx0J2p1c3QnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0J3NvbWUgdGV4dCcsXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IxLCB2aWV3TW9kZWwxKSA9PiB7XG5cdFx0XHRlZGl0b3IxLnNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDEpXG5cdFx0XHRdKTtcblx0XHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IyLCB2aWV3TW9kZWwyKSA9PiB7XG5cdFx0XHRcdGVkaXRvcjIuc2V0U2VsZWN0aW9ucyhbXG5cdFx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxLCAyLCAxKVxuXHRcdFx0XHRdKTtcblx0XHRcdFx0dmlld01vZGVsMi50eXBlKCdlJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwyLCBuZXcgUG9zaXRpb24oMiwgMikpO1xuXHRcdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsMSwgbmV3IFBvc2l0aW9uKDIsIDIpKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgnVW5kbyBzdG9wcycsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCd0aGVyZSBpcyBhbiB1bmRvIHN0b3AgYmV0d2VlbiB0eXBpbmcgYW5kIGRlbGV0aW5nIGxlZnQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCdBICBsaW5lJyxcblx0XHRcdFx0J0Fub3RoZXIgbGluZScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbbmV3IFNlbGVjdGlvbigxLCAzLCAxLCAzKV0pO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ2ZpcnN0JywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdBIGZpcnN0IGxpbmUnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgOCwgMSwgOCkpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ0EgZmlyIGxpbmUnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgNiwgMSwgNikpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnQSBmaXJzdCBsaW5lJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDgsIDEsIDgpKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ0EgIGxpbmUnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgMywgMSwgMykpO1xuXHRcdH0pO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCd0aGVyZSBpcyBhbiB1bmRvIHN0b3AgYmV0d2VlbiB0eXBpbmcgYW5kIGRlbGV0aW5nIHJpZ2h0JywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnQSAgbGluZScsXG5cdFx0XHRcdCdBbm90aGVyIGxpbmUnLFxuXHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMSwgMywgMSwgMyldKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdmaXJzdCcsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnQSBmaXJzdCBsaW5lJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDgsIDEsIDgpKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVSaWdodC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZVJpZ2h0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ0EgZmlyc3RpbmUnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgOCwgMSwgOCkpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnQSBmaXJzdCBsaW5lJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDgsIDEsIDgpKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ0EgIGxpbmUnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgMywgMSwgMykpO1xuXHRcdH0pO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCd0aGVyZSBpcyBhbiB1bmRvIHN0b3AgYmV0d2VlbiBkZWxldGluZyBsZWZ0IGFuZCB0eXBpbmcnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCdBICBsaW5lJyxcblx0XHRcdFx0J0Fub3RoZXIgbGluZScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbbmV3IFNlbGVjdGlvbigyLCA4LCAyLCA4KV0pO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJyBsaW5lJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDEpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1NlY29uZCcsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnU2Vjb25kIGxpbmUnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMiwgNywgMiwgNykpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnIGxpbmUnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgMSkpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnQW5vdGhlciBsaW5lJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDIsIDgsIDIsIDgpKTtcblx0XHR9KTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgndGhlcmUgaXMgYW4gdW5kbyBzdG9wIGJldHdlZW4gZGVsZXRpbmcgbGVmdCBhbmQgZGVsZXRpbmcgcmlnaHQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCdBICBsaW5lJyxcblx0XHRcdFx0J0Fub3RoZXIgbGluZScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbbmV3IFNlbGVjdGlvbigyLCA4LCAyLCA4KV0pO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJyBsaW5lJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDEpKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVSaWdodC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZVJpZ2h0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlUmlnaHQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVSaWdodC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZVJpZ2h0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJycpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigyLCAxLCAyLCAxKSk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuVW5kby5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICcgbGluZScpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigyLCAxLCAyLCAxKSk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuVW5kby5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICdBbm90aGVyIGxpbmUnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMiwgOCwgMiwgOCkpO1xuXHRcdH0pO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCd0aGVyZSBpcyBhbiB1bmRvIHN0b3AgYmV0d2VlbiBkZWxldGluZyByaWdodCBhbmQgdHlwaW5nJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnQSAgbGluZScsXG5cdFx0XHRcdCdBbm90aGVyIGxpbmUnLFxuXHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMiwgOSwgMiwgOSldKTtcblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlUmlnaHQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVSaWdodC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZVJpZ2h0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlUmlnaHQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnQW5vdGhlciAnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMiwgOSwgMiwgOSkpO1xuXG5cdFx0XHR2aWV3TW9kZWwudHlwZSgndGV4dCcsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnQW5vdGhlciB0ZXh0Jyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDIsIDEzLCAyLCAxMykpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnQW5vdGhlciAnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMiwgOSwgMiwgOSkpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDIpLCAnQW5vdGhlciBsaW5lJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDIsIDksIDIsIDkpKTtcblx0XHR9KTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgndGhlcmUgaXMgYW4gdW5kbyBzdG9wIGJldHdlZW4gZGVsZXRpbmcgcmlnaHQgYW5kIGRlbGV0aW5nIGxlZnQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCdBICBsaW5lJyxcblx0XHRcdFx0J0Fub3RoZXIgbGluZScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbbmV3IFNlbGVjdGlvbigyLCA5LCAyLCA5KV0pO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVSaWdodC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZVJpZ2h0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlUmlnaHQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVSaWdodC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICdBbm90aGVyICcpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigyLCA5LCAyLCA5KSk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZUxlZnQucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJ0FuJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDIsIDMsIDIsIDMpKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJ0Fub3RoZXIgJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDIsIDksIDIsIDkpKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJ0Fub3RoZXIgbGluZScpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigyLCA5LCAyLCA5KSk7XG5cdFx0fSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc2VydHMgdW5kbyBzdG9wIHdoZW4gdHlwaW5nIHNwYWNlJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnQSAgbGluZScsXG5cdFx0XHRcdCdBbm90aGVyIGxpbmUnLFxuXHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMSwgMywgMSwgMyldKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdmaXJzdCBhbmQgaW50ZXJlc3RpbmcnLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ0EgZmlyc3QgYW5kIGludGVyZXN0aW5nIGxpbmUnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgMjQsIDEsIDI0KSk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuVW5kby5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdBIGZpcnN0IGFuZCBsaW5lJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDEyLCAxLCAxMikpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExpbmVDb250ZW50KDEpLCAnQSBmaXJzdCBsaW5lJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDgsIDEsIDgpKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ0EgIGxpbmUnKTtcblx0XHRcdGFzc2VydEN1cnNvcih2aWV3TW9kZWwsIG5ldyBTZWxlY3Rpb24oMSwgMywgMSwgMykpO1xuXHRcdH0pO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdjYW4gdW5kbyB0eXBpbmcgYW5kIEVPTCBjaGFuZ2UgaW4gb25lIHVuZG8gc3RvcCcsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFtcblx0XHRcdFx0J0EgIGxpbmUnLFxuXHRcdFx0XHQnQW5vdGhlciBsaW5lJyxcblx0XHRcdF0uam9pbignXFxuJylcblx0XHQpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpXSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnZmlyc3QnLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnQSBmaXJzdCBsaW5lXFxuQW5vdGhlciBsaW5lJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDgsIDEsIDgpKTtcblxuXHRcdFx0bW9kZWwucHVzaEVPTChFbmRPZkxpbmVTZXF1ZW5jZS5DUkxGKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnQSBmaXJzdCBsaW5lXFxyXFxuQW5vdGhlciBsaW5lJyk7XG5cdFx0XHRhc3NlcnRDdXJzb3Iodmlld01vZGVsLCBuZXcgU2VsZWN0aW9uKDEsIDgsIDEsIDgpKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnQSAgbGluZVxcbkFub3RoZXIgbGluZScpO1xuXHRcdFx0YXNzZXJ0Q3Vyc29yKHZpZXdNb2RlbCwgbmV3IFNlbGVjdGlvbigxLCAzLCAxLCAzKSk7XG5cdFx0fSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM5MzU4NTogVW5kbyBtdWx0aSBjdXJzb3IgZWRpdCBjb3JydXB0cyBkb2N1bWVudCcsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFtcblx0XHRcdFx0J2hlbGxvIHdvcmxkJyxcblx0XHRcdFx0J2hlbGxvIHdvcmxkJyxcblx0XHRcdF0uam9pbignXFxuJylcblx0XHQpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtcblx0XHRcdFx0bmV3IFNlbGVjdGlvbigyLCA3LCAyLCAxMiksXG5cdFx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNywgMSwgMTIpLFxuXHRcdFx0XSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnbm8nLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCAnaGVsbG8gbm9cXG5oZWxsbyBubycpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdoZWxsbyB3b3JsZFxcbmhlbGxvIHdvcmxkJyk7XG5cdFx0fSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3RoZXJlIGlzIGEgc2luZ2xlIHVuZG8gc3RvcCBmb3IgY29uc2VjdXRpdmUgd2hpdGVzcGFjZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCcnXG5cdFx0XHRdLmpvaW4oJ1xcbicpLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0e1xuXHRcdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlLFxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdhJywgJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnYicsICdrZXlib2FyZCcpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJyAnLCAna2V5Ym9hcmQnKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCcgJywgJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnYycsICdrZXlib2FyZCcpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ2QnLCAna2V5Ym9hcmQnKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnYWIgIGNkJywgJ2Fzc2VydDEnKTtcblxuXHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5VbmRvLnJ1bkVkaXRvckNvbW1hbmQobnVsbCwgZWRpdG9yLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgJ2FiICAnLCAnYXNzZXJ0MicpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnYWInLCAnYXNzZXJ0MycpO1xuXG5cdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCAnJywgJ2Fzc2VydDQnKTtcblx0XHR9KTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgndGhlcmUgaXMgbm8gdW5kbyBzdG9wIGFmdGVyIGEgc2luZ2xlIHdoaXRlc3BhY2UnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCcnXG5cdFx0XHRdLmpvaW4oJ1xcbicpLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0e1xuXHRcdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlLFxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdhJywgJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnYicsICdrZXlib2FyZCcpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJyAnLCAna2V5Ym9hcmQnKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdjJywgJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnZCcsICdrZXlib2FyZCcpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICdhYiBjZCcsICdhc3NlcnQxJyk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuVW5kby5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICdhYicsICdhc3NlcnQzJyk7XG5cblx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuVW5kby5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksICcnLCAnYXNzZXJ0NCcpO1xuXHRcdH0pO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgnT3ZlcnR5cGUgTW9kZScsICgpID0+IHtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0SW5wdXRNb2RlLnNldElucHV0TW9kZSgnb3ZlcnR5cGUnKTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdElucHV0TW9kZS5zZXRJbnB1dE1vZGUoJ2luc2VydCcpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdzaW1wbGUgdHlwZScsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFtcblx0XHRcdFx0JzEyMzQ1Njc4OScsXG5cdFx0XHRcdCcxMjM0NTY3ODknLFxuXHRcdFx0XS5qb2luKCdcXG4nKSxcblx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdHtcblx0XHRcdFx0aW5zZXJ0U3BhY2VzOiBmYWxzZSxcblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpXSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnYScsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCBbXG5cdFx0XHRcdCcxMmE0NTY3ODknLFxuXHRcdFx0XHQnMTIzNDU2Nzg5Jyxcblx0XHRcdF0uam9pbignXFxuJyksICdhc3NlcnQxJyk7XG5cblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMSwgOSwgMSwgOSldKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKCdiYmInLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgW1xuXHRcdFx0XHQnMTJhNDU2NzhiYmInLFxuXHRcdFx0XHQnMTIzNDU2Nzg5Jyxcblx0XHRcdF0uam9pbignXFxuJyksICdhc3NlcnQyJyk7XG5cdFx0fSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ211bHRpLWxpbmUgc2VsZWN0aW9uIHR5cGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCcxMjM0NTY3ODknLFxuXHRcdFx0XHQnMTIzNDU2Nzg5Jyxcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHR7XG5cdFx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbbmV3IFNlbGVjdGlvbigxLCA1LCAyLCAzKV0pO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ2NjJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksIFtcblx0XHRcdFx0JzEyMzRjYzQ1Njc4OScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpLCAnYXNzZXJ0MScpO1xuXHRcdH0pO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaW1wbGUgcGFzdGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCcxMjM0NTY3ODknLFxuXHRcdFx0XHQnMTIzNDU2Nzg5Jyxcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHR7XG5cdFx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbbmV3IFNlbGVjdGlvbigxLCA1LCAxLCA1KV0pO1xuXHRcdFx0dmlld01vZGVsLnBhc3RlKCdjYycsIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgW1xuXHRcdFx0XHQnMTIzNGNjNzg5Jyxcblx0XHRcdFx0JzEyMzQ1Njc4OScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpLCAnYXNzZXJ0MScpO1xuXG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpXSk7XG5cdFx0XHR2aWV3TW9kZWwucGFzdGUoJ2RkZGRkZGRkJywgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCBbXG5cdFx0XHRcdCcxMjM0ZGRkZGRkZGQnLFxuXHRcdFx0XHQnMTIzNDU2Nzg5Jyxcblx0XHRcdF0uam9pbignXFxuJyksICdhc3NlcnQyJyk7XG5cdFx0fSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ211bHRpLWxpbmUgc2VsZWN0aW9uIHBhc3RlJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnMTIzNDU2Nzg5Jyxcblx0XHRcdFx0JzEyMzQ1Njc4OScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0e1xuXHRcdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlLFxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHt9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKCd0ZXN0JywgW25ldyBTZWxlY3Rpb24oMSwgNSwgMiwgMyldKTtcblx0XHRcdHZpZXdNb2RlbC5wYXN0ZSgnY2MnLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksIFtcblx0XHRcdFx0JzEyMzRjYzQ1Njc4OScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpLCAnYXNzZXJ0MScpO1xuXHRcdH0pO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdwYXN0ZSBtdWx0aS1saW5lIHRleHQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCcxMjM0NTY3ODknLFxuXHRcdFx0XHQnMTIzNDU2Nzg5Jyxcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHR7XG5cdFx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwge30sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLnNldFNlbGVjdGlvbnMoJ3Rlc3QnLCBbbmV3IFNlbGVjdGlvbigxLCA1LCAxLCA1KV0pO1xuXHRcdFx0dmlld01vZGVsLnBhc3RlKFtcblx0XHRcdFx0J2FhYWFhYWEnLFxuXHRcdFx0XHQnYmJiYmJiYidcblx0XHRcdF0uam9pbignXFxuJyksIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKSwgW1xuXHRcdFx0XHQnMTIzNGFhYWFhYWEnLFxuXHRcdFx0XHQnYmJiYmJiYicsXG5cdFx0XHRcdCcxMjM0NTY3ODknLFxuXHRcdFx0XS5qb2luKCdcXG4nKSwgJ2Fzc2VydDEnKTtcblx0XHR9KTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnY29tcG9zaXRpb24gdHlwZScsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFtcblx0XHRcdFx0JzEyMzQ1Njc4OScsXG5cdFx0XHRcdCcxMjM0NTY3ODknLFxuXHRcdFx0XS5qb2luKCdcXG4nKSxcblx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdHtcblx0XHRcdFx0aW5zZXJ0U3BhY2VzOiBmYWxzZSxcblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHR2aWV3TW9kZWwuc2V0U2VsZWN0aW9ucygndGVzdCcsIFtuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpXSk7XG5cdFx0XHR2aWV3TW9kZWwuc3RhcnRDb21wb3NpdGlvbigpO1xuXHRcdFx0dmlld01vZGVsLmNvbXBvc2l0aW9uVHlwZSgnXHUzMEJCJywgMCwgMCwgMCwgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRiksIFtcblx0XHRcdFx0JzEyMzRcdTMwQkI1Njc4OScsXG5cdFx0XHRcdCcxMjM0NTY3ODknLFxuXHRcdFx0XS5qb2luKCdcXG4nKSwgJ2Fzc2VydDEnKTtcblxuXHRcdFx0dmlld01vZGVsLmVuZENvbXBvc2l0aW9uKCdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpLCBbXG5cdFx0XHRcdCcxMjM0XHUzMEJCNjc4OScsXG5cdFx0XHRcdCcxMjM0NTY3ODknLFxuXHRcdFx0XS5qb2luKCdcXG4nKSwgJ2Fzc2VydDEnKTtcblx0XHR9KTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLHVCQUF1QjtBQUVoQyxTQUFTLCtDQUErQztBQUN4RCxTQUFTLHFCQUFxQiw4QkFBOEI7QUFFNUQsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxh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VSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDekIsQ0FBQztBQUNELG1CQUFhLFdBQVc7QUFBQSxRQUN2QixJQUFJLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQzFCLElBQUksVUFBVSxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDMUIsSUFBSSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUMxQixJQUFJLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQzFCLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDekIsQ0FBQztBQUVELGdCQUFVLFFBQVEsV0FBVyxJQUFJO0FBQ2pDLG1CQUFhLFdBQVc7QUFBQSxRQUN2QixJQUFJLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQzFCLElBQUksVUFBVSxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDMUIsSUFBSSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUMxQixJQUFJLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQzFCLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDekIsQ0FBQztBQUVELGdCQUFVLFFBQVEsV0FBVyxJQUFJO0FBQ2pDLG1CQUFhLFdBQVc7QUFBQSxRQUN2QixJQUFJLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQzFCLElBQUksVUFBVSxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDMUIsSUFBSSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUMxQixJQUFJLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQzFCLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDekIsQ0FBQztBQUVELGdCQUFVLFFBQVEsV0FBVyxJQUFJO0FBQ2pDLG1CQUFhLFdBQVc7QUFBQSxRQUN2QixJQUFJLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQzFCLElB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RUFBRTtBQUFBLFFBQ3pELEVBQUUsTUFBTSxNQUFPLE9BQU8sS0FBTSxPQUFPLENBQUMsVUFBVSxTQUFTLEVBQUU7QUFBQSxRQUN6RCxFQUFFLE1BQU0sTUFBTyxPQUFPLEtBQU0sT0FBTyxDQUFDLFVBQVUsU0FBUyxFQUFFO0FBQUEsUUFDekQsRUFBRSxNQUFNLE1BQU8sT0FBTyxLQUFNLE9BQU8sQ0FBQyxVQUFVLFNBQVMsRUFBRTtBQUFBLFFBQ3pELEVBQUUsTUFBTSxNQUFPLE9BQU8sS0FBTSxPQUFPLENBQUMsVUFBVSxTQUFTLEVBQUU7QUFBQSxRQUN6RCxFQUFFLE1BQU0sTUFBTyxPQUFPLEtBQU0sT0FBTyxDQUFDLFVBQVUsU0FBUyxFQUFFO0FBQUEsUUFDekQsRUFBRSxNQUFNLEtBQU0sT0FBTyxLQUFNLE9BQU8sQ0FBQyxVQUFVLFNBQVMsRUFBRTtBQUFBLFFBQ3hELEVBQUUsTUFBTSxNQUFPLE9BQU8sS0FBTSxPQUFPLENBQUMsVUFBVSxTQUFTLEVBQUU7QUFBQSxRQUN6RCxFQUFFLE1BQU0sTUFBTyxPQUFPLEtBQU0sT0FBTyxDQUFDLFVBQVUsU0FBUyxFQUFFO0FBQUEsUUFDekQsRUFBRSxNQUFNLE1BQU8sT0FBTyxLQUFNLE9BQU8sQ0FBQyxVQUFVLFNBQVMsRUFBRTtBQUFBLFFBQ3pELEVBQUUsTUFBTSxNQUFPLE9BQU8sS0FBTSxPQUFPLENBQUMsVUFBVSxTQUFTLEVBQUU7QUFBQSxRQUN6RCxFQUFFLE1BQU0sTUFBTyxPQUFPLEtBQU0sT0FBTyxDQUFDLFVBQVUsU0FBUyxFQUFFO0FBQUEsUUFDekQsRUFBRSxNQUFNLE1BQU8sT0FBTyxLQUFNLE9BQU8sQ0FBQyxVQUFVLFNBQVMsRUFBRTtBQUFBLFFBQ3pELEVBQUUsTUFBTSxNQUFPLE9BQU8sS0FBTSxPQUFPLENBQUMsVUFBVSxTQUFTLEVBQUU7QUFBQSxRQUN6RCxFQUFFLE1BQU0sTUFBTyxPQUFPLEtBQU0sT0FBTyxDQUFDLFVBQVUsU0FBUyxFQUFFO0FBQUEsUUFDekQsRUFBRSxNQUFNLEtBQUssT0FBTyxLQUFLLE9BQU8s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TUFDQTtBQUFBLFFBQ0MsY0FBYztBQUFBLE1BQ2Y7QUFBQSxJQUNEO0FBRUEsdUJBQW1CLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxjQUFjO0FBQ3BELGdCQUFVLGNBQWMsUUFBUSxDQUFDLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUMzRCxnQkFBVSxpQkFBaUI7QUFDM0IsZ0JBQVUsZ0JBQWdCLFVBQUssR0FBRyxHQUFHLEdBQUcsVUFBVTtBQUNsRCxhQUFPLFlBQVksTUFBTSxTQUFTLG9CQUFvQixFQUFFLEdBQUc7QUFBQSxRQUMxRDtBQUFBLFFBQ0E7QUFBQSxNQUNELEVBQUUsS0FBSyxJQUFJLEdBQUcsU0FBUztBQUV2QixnQkFBVSxlQUFlLFVBQVU7QUFDbkMsYUFBTyxZQUFZLE1BQU0sU0FBUyxvQkFBb0IsRUFBRSxHQUFHO0FBQUEsUUFDMUQ7QUFBQSxRQUNBO0FBQUEsTUFDRCxFQUFFLEtBQUssSUFBSSxHQUFHLFNBQVM7QUFBQSxJQUN4QixDQUFDO0FBRUQsVUFBTSxRQUFRO0FBQUEsRUFDZixDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFsiY3JlYXRlVGV4dE1vZGVsIiwgIndpdGhUZXN0Q29kZUVkaXRvciIsICJBdXRvQ2xvc2luZ0NvbHVtblR5cGUiLCAibW9kZWwiLCAidmlld01vZGVsIl0KfQo=
