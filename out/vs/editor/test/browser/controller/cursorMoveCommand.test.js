import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { CoreNavigationCommands } from "../../../browser/coreCommands.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { CursorMove } from "../../../common/cursor/cursorMoveCommands.js";
import { withTestCodeEditor } from "../testCodeEditor.js";
suite("Cursor move command test", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const TEXT = [
    "    	My First Line	 ",
    "	My Second Line",
    "    Third Line\u{1F436}",
    "",
    "1"
  ].join("\n");
  function executeTest(callback) {
    withTestCodeEditor(TEXT, {}, (editor, viewModel) => {
      callback(editor, viewModel);
    });
  }
  test("move left should move to left character", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 8);
      moveLeft(viewModel);
      cursorEqual(viewModel, 1, 7);
    });
  });
  test("move left should move to left by n characters", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 8);
      moveLeft(viewModel, 3);
      cursorEqual(viewModel, 1, 5);
    });
  });
  test("move left should move to left by half line", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 8);
      moveLeft(viewModel, 1, CursorMove.RawUnit.HalfLine);
      cursorEqual(viewModel, 1, 1);
    });
  });
  test("move left moves to previous line", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 2, 3);
      moveLeft(viewModel, 10);
      cursorEqual(viewModel, 1, 21);
    });
  });
  test("move right should move to right character", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 5);
      moveRight(viewModel);
      cursorEqual(viewModel, 1, 6);
    });
  });
  test("move right should move to right by n characters", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 2);
      moveRight(viewModel, 6);
      cursorEqual(viewModel, 1, 8);
    });
  });
  test("move right should move to right by half line", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 4);
      moveRight(viewModel, 1, CursorMove.RawUnit.HalfLine);
      cursorEqual(viewModel, 1, 14);
    });
  });
  test("move right moves to next line", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 8);
      moveRight(viewModel, 100);
      cursorEqual(viewModel, 2, 1);
    });
  });
  test("move to first character of line from middle", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 8);
      moveToLineStart(viewModel);
      cursorEqual(viewModel, 1, 1);
    });
  });
  test("move to first character of line from first non white space character", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 6);
      moveToLineStart(viewModel);
      cursorEqual(viewModel, 1, 1);
    });
  });
  test("move to first character of line from first character", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 1);
      moveToLineStart(viewModel);
      cursorEqual(viewModel, 1, 1);
    });
  });
  test("move to first non white space character of line from middle", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 8);
      moveToLineFirstNonWhitespaceCharacter(viewModel);
      cursorEqual(viewModel, 1, 6);
    });
  });
  test("move to first non white space character of line from first non white space character", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 6);
      moveToLineFirstNonWhitespaceCharacter(viewModel);
      cursorEqual(viewModel, 1, 6);
    });
  });
  test("move to first non white space character of line from first character", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 1);
      moveToLineFirstNonWhitespaceCharacter(viewModel);
      cursorEqual(viewModel, 1, 6);
    });
  });
  test("move to end of line from middle", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 8);
      moveToLineEnd(viewModel);
      cursorEqual(viewModel, 1, 21);
    });
  });
  test("move to end of line from last non white space character", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 19);
      moveToLineEnd(viewModel);
      cursorEqual(viewModel, 1, 21);
    });
  });
  test("move to end of line from line end", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 21);
      moveToLineEnd(viewModel);
      cursorEqual(viewModel, 1, 21);
    });
  });
  test("move to last non white space character from middle", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 8);
      moveToLineLastNonWhitespaceCharacter(viewModel);
      cursorEqual(viewModel, 1, 19);
    });
  });
  test("move to last non white space character from last non white space character", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 19);
      moveToLineLastNonWhitespaceCharacter(viewModel);
      cursorEqual(viewModel, 1, 19);
    });
  });
  test("move to last non white space character from line end", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 21);
      moveToLineLastNonWhitespaceCharacter(viewModel);
      cursorEqual(viewModel, 1, 19);
    });
  });
  test("move to center of line not from center", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 8);
      moveToLineCenter(viewModel);
      cursorEqual(viewModel, 1, 11);
    });
  });
  test("move to center of line from center", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 11);
      moveToLineCenter(viewModel);
      cursorEqual(viewModel, 1, 11);
    });
  });
  test("move to center of line from start", () => {
    executeTest((editor, viewModel) => {
      moveToLineStart(viewModel);
      moveToLineCenter(viewModel);
      cursorEqual(viewModel, 1, 11);
    });
  });
  test("move to center of line from end", () => {
    executeTest((editor, viewModel) => {
      moveToLineEnd(viewModel);
      moveToLineCenter(viewModel);
      cursorEqual(viewModel, 1, 11);
    });
  });
  test("move up by cursor move command", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 3, 5);
      cursorEqual(viewModel, 3, 5);
      moveUp(viewModel, 2);
      cursorEqual(viewModel, 1, 5);
      moveUp(viewModel, 1);
      cursorEqual(viewModel, 1, 1);
    });
  });
  test("move up by model line cursor move command", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 3, 5);
      cursorEqual(viewModel, 3, 5);
      moveUpByModelLine(viewModel, 2);
      cursorEqual(viewModel, 1, 5);
      moveUpByModelLine(viewModel, 1);
      cursorEqual(viewModel, 1, 1);
    });
  });
  test("move down by model line cursor move command", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 3, 5);
      cursorEqual(viewModel, 3, 5);
      moveDownByModelLine(viewModel, 2);
      cursorEqual(viewModel, 5, 2);
      moveDownByModelLine(viewModel, 1);
      cursorEqual(viewModel, 5, 2);
    });
  });
  test("move up with selection by cursor move command", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 3, 5);
      cursorEqual(viewModel, 3, 5);
      moveUp(viewModel, 1, true);
      cursorEqual(viewModel, 2, 2, 3, 5);
      moveUp(viewModel, 1, true);
      cursorEqual(viewModel, 1, 5, 3, 5);
    });
  });
  test("move up and down with tabs by cursor move command", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 1, 5);
      cursorEqual(viewModel, 1, 5);
      moveDown(viewModel, 4);
      cursorEqual(viewModel, 5, 2);
      moveUp(viewModel, 1);
      cursorEqual(viewModel, 4, 1);
      moveUp(viewModel, 1);
      cursorEqual(viewModel, 3, 5);
      moveUp(viewModel, 1);
      cursorEqual(viewModel, 2, 2);
      moveUp(viewModel, 1);
      cursorEqual(viewModel, 1, 5);
    });
  });
  test("move up and down with end of lines starting from a long one by cursor move command", () => {
    executeTest((editor, viewModel) => {
      moveToEndOfLine(viewModel);
      cursorEqual(viewModel, 1, 21);
      moveToEndOfLine(viewModel);
      cursorEqual(viewModel, 1, 21);
      moveDown(viewModel, 2);
      cursorEqual(viewModel, 3, 17);
      moveDown(viewModel, 1);
      cursorEqual(viewModel, 4, 1);
      moveDown(viewModel, 1);
      cursorEqual(viewModel, 5, 2);
      moveUp(viewModel, 4);
      cursorEqual(viewModel, 1, 21);
    });
  });
  test("move to view top line moves to first visible line if it is first line", () => {
    executeTest((editor, viewModel) => {
      viewModel.getCompletelyVisibleViewRange = () => new Range(1, 1, 10, 1);
      moveTo(viewModel, 2, 2);
      moveToTop(viewModel);
      cursorEqual(viewModel, 1, 6);
    });
  });
  test("move to view top line moves to top visible line when first line is not visible", () => {
    executeTest((editor, viewModel) => {
      viewModel.getCompletelyVisibleViewRange = () => new Range(2, 1, 10, 1);
      moveTo(viewModel, 4, 1);
      moveToTop(viewModel);
      cursorEqual(viewModel, 2, 2);
    });
  });
  test("move to view top line moves to nth line from top", () => {
    executeTest((editor, viewModel) => {
      viewModel.getCompletelyVisibleViewRange = () => new Range(1, 1, 10, 1);
      moveTo(viewModel, 4, 1);
      moveToTop(viewModel, 3);
      cursorEqual(viewModel, 3, 5);
    });
  });
  test("move to view top line moves to last line if n is greater than last visible line number", () => {
    executeTest((editor, viewModel) => {
      viewModel.getCompletelyVisibleViewRange = () => new Range(1, 1, 3, 1);
      moveTo(viewModel, 2, 2);
      moveToTop(viewModel, 4);
      cursorEqual(viewModel, 3, 5);
    });
  });
  test("move to view center line moves to the center line", () => {
    executeTest((editor, viewModel) => {
      viewModel.getCompletelyVisibleViewRange = () => new Range(3, 1, 3, 1);
      moveTo(viewModel, 2, 2);
      moveToCenter(viewModel);
      cursorEqual(viewModel, 3, 5);
    });
  });
  test("move to view bottom line moves to last visible line if it is last line", () => {
    executeTest((editor, viewModel) => {
      viewModel.getCompletelyVisibleViewRange = () => new Range(1, 1, 5, 1);
      moveTo(viewModel, 2, 2);
      moveToBottom(viewModel);
      cursorEqual(viewModel, 5, 1);
    });
  });
  test("move to view bottom line moves to last visible line when last line is not visible", () => {
    executeTest((editor, viewModel) => {
      viewModel.getCompletelyVisibleViewRange = () => new Range(2, 1, 3, 1);
      moveTo(viewModel, 2, 2);
      moveToBottom(viewModel);
      cursorEqual(viewModel, 3, 5);
    });
  });
  test("move to view bottom line moves to nth line from bottom", () => {
    executeTest((editor, viewModel) => {
      viewModel.getCompletelyVisibleViewRange = () => new Range(1, 1, 5, 1);
      moveTo(viewModel, 4, 1);
      moveToBottom(viewModel, 3);
      cursorEqual(viewModel, 3, 5);
    });
  });
  test("move to view bottom line moves to first line if n is lesser than first visible line number", () => {
    executeTest((editor, viewModel) => {
      viewModel.getCompletelyVisibleViewRange = () => new Range(2, 1, 5, 1);
      moveTo(viewModel, 4, 1);
      moveToBottom(viewModel, 5);
      cursorEqual(viewModel, 2, 2);
    });
  });
});
suite("Cursor move by blankline test", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const TEXT = [
    "    	My First Line	 ",
    "	My Second Line",
    "    Third Line\u{1F436}",
    "",
    "1",
    "2",
    "3",
    "",
    "         ",
    "a",
    "b"
  ].join("\n");
  function executeTest(callback) {
    withTestCodeEditor(TEXT, {}, (editor, viewModel) => {
      callback(editor, viewModel);
    });
  }
  test("move down should move to start of next blank line", () => {
    executeTest((editor, viewModel) => {
      moveDownByBlankLine(viewModel, false);
      cursorEqual(viewModel, 4, 1);
    });
  });
  test("move up should move to start of previous blank line", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 7, 1);
      moveUpByBlankLine(viewModel, false);
      cursorEqual(viewModel, 4, 1);
    });
  });
  test("move down should skip over whitespace if already on blank line", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 8, 1);
      moveDownByBlankLine(viewModel, false);
      cursorEqual(viewModel, 11, 1);
    });
  });
  test("move up should skip over whitespace if already on blank line", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 9, 1);
      moveUpByBlankLine(viewModel, false);
      cursorEqual(viewModel, 4, 1);
    });
  });
  test("move up should go to first column of first line if not empty", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 2, 1);
      moveUpByBlankLine(viewModel, false);
      cursorEqual(viewModel, 1, 1);
    });
  });
  test("move down should go to first column of last line if not empty", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 10, 1);
      moveDownByBlankLine(viewModel, false);
      cursorEqual(viewModel, 11, 1);
    });
  });
  test("select down should select to start of next blank line", () => {
    executeTest((editor, viewModel) => {
      moveDownByBlankLine(viewModel, true);
      selectionEqual(viewModel.getSelection(), 4, 1, 1, 1);
    });
  });
  test("select up should select to start of previous blank line", () => {
    executeTest((editor, viewModel) => {
      moveTo(viewModel, 7, 1);
      moveUpByBlankLine(viewModel, true);
      selectionEqual(viewModel.getSelection(), 4, 1, 7, 1);
    });
  });
});
function move(viewModel, args) {
  CoreNavigationCommands.CursorMove.runCoreEditorCommand(viewModel, args);
}
function moveToLineStart(viewModel) {
  move(viewModel, { to: CursorMove.RawDirection.WrappedLineStart });
}
function moveToLineFirstNonWhitespaceCharacter(viewModel) {
  move(viewModel, { to: CursorMove.RawDirection.WrappedLineFirstNonWhitespaceCharacter });
}
function moveToLineCenter(viewModel) {
  move(viewModel, { to: CursorMove.RawDirection.WrappedLineColumnCenter });
}
function moveToLineEnd(viewModel) {
  move(viewModel, { to: CursorMove.RawDirection.WrappedLineEnd });
}
function moveToLineLastNonWhitespaceCharacter(viewModel) {
  move(viewModel, { to: CursorMove.RawDirection.WrappedLineLastNonWhitespaceCharacter });
}
function moveLeft(viewModel, value, by, select) {
  move(viewModel, { to: CursorMove.RawDirection.Left, by, value, select });
}
function moveRight(viewModel, value, by, select) {
  move(viewModel, { to: CursorMove.RawDirection.Right, by, value, select });
}
function moveUp(viewModel, noOfLines = 1, select) {
  move(viewModel, { to: CursorMove.RawDirection.Up, by: CursorMove.RawUnit.WrappedLine, value: noOfLines, select });
}
function moveUpByBlankLine(viewModel, select) {
  move(viewModel, { to: CursorMove.RawDirection.PrevBlankLine, by: CursorMove.RawUnit.WrappedLine, select });
}
function moveUpByModelLine(viewModel, noOfLines = 1, select) {
  move(viewModel, { to: CursorMove.RawDirection.Up, value: noOfLines, select });
}
function moveDown(viewModel, noOfLines = 1, select) {
  move(viewModel, { to: CursorMove.RawDirection.Down, by: CursorMove.RawUnit.WrappedLine, value: noOfLines, select });
}
function moveDownByBlankLine(viewModel, select) {
  move(viewModel, { to: CursorMove.RawDirection.NextBlankLine, by: CursorMove.RawUnit.WrappedLine, select });
}
function moveDownByModelLine(viewModel, noOfLines = 1, select) {
  move(viewModel, { to: CursorMove.RawDirection.Down, value: noOfLines, select });
}
function moveToTop(viewModel, noOfLines = 1, select) {
  move(viewModel, { to: CursorMove.RawDirection.ViewPortTop, value: noOfLines, select });
}
function moveToCenter(viewModel, select) {
  move(viewModel, { to: CursorMove.RawDirection.ViewPortCenter, select });
}
function moveToBottom(viewModel, noOfLines = 1, select) {
  move(viewModel, { to: CursorMove.RawDirection.ViewPortBottom, value: noOfLines, select });
}
function cursorEqual(viewModel, posLineNumber, posColumn, selLineNumber = posLineNumber, selColumn = posColumn) {
  positionEqual(viewModel.getPosition(), posLineNumber, posColumn);
  selectionEqual(viewModel.getSelection(), posLineNumber, posColumn, selLineNumber, selColumn);
}
function positionEqual(position, lineNumber, column) {
  assert.deepStrictEqual(position, new Position(lineNumber, column), "position equal");
}
function selectionEqual(selection, posLineNumber, posColumn, selLineNumber, selColumn) {
  assert.deepStrictEqual({
    selectionStartLineNumber: selection.selectionStartLineNumber,
    selectionStartColumn: selection.selectionStartColumn,
    positionLineNumber: selection.positionLineNumber,
    positionColumn: selection.positionColumn
  }, {
    selectionStartLineNumber: selLineNumber,
    selectionStartColumn: selColumn,
    positionLineNumber: posLineNumber,
    positionColumn: posColumn
  }, "selection equal");
}
function moveTo(viewModel, lineNumber, column, inSelectionMode = false) {
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
function moveToEndOfLine(viewModel, inSelectionMode = false) {
  if (inSelectionMode) {
    CoreNavigationCommands.CursorEndSelect.runCoreEditorCommand(viewModel, {});
  } else {
    CoreNavigationCommands.CursorEnd.runCoreEditorCommand(viewModel, {});
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9icm93c2VyL2NvbnRyb2xsZXIvY3Vyc29yTW92ZUNvbW1hbmQudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgQ29yZU5hdmlnYXRpb25Db21tYW5kcyB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvY29yZUNvbW1hbmRzLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgQ3Vyc29yTW92ZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jdXJzb3IvY3Vyc29yTW92ZUNvbW1hbmRzLmpzJztcbmltcG9ydCB7IFZpZXdNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3TW9kZWwvdmlld01vZGVsSW1wbC5qcyc7XG5pbXBvcnQgeyBJVGVzdENvZGVFZGl0b3IsIHdpdGhUZXN0Q29kZUVkaXRvciB9IGZyb20gJy4uL3Rlc3RDb2RlRWRpdG9yLmpzJztcblxuc3VpdGUoJ0N1cnNvciBtb3ZlIGNvbW1hbmQgdGVzdCcsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRjb25zdCBURVhUID0gW1xuXHRcdCcgICAgXFx0TXkgRmlyc3QgTGluZVxcdCAnLFxuXHRcdCdcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0JyAgICBUaGlyZCBMaW5lXHVEODNEXHVEQzM2Jyxcblx0XHQnJyxcblx0XHQnMSdcblx0XS5qb2luKCdcXG4nKTtcblxuXHRmdW5jdGlvbiBleGVjdXRlVGVzdChjYWxsYmFjazogKGVkaXRvcjogSVRlc3RDb2RlRWRpdG9yLCB2aWV3TW9kZWw6IFZpZXdNb2RlbCkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihURVhULCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRjYWxsYmFjayhlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0fSk7XG5cdH1cblxuXHR0ZXN0KCdtb3ZlIGxlZnQgc2hvdWxkIG1vdmUgdG8gbGVmdCBjaGFyYWN0ZXInLCAoKSA9PiB7XG5cdFx0ZXhlY3V0ZVRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8odmlld01vZGVsLCAxLCA4KTtcblx0XHRcdG1vdmVMZWZ0KHZpZXdNb2RlbCk7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDEsIDcpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIGxlZnQgc2hvdWxkIG1vdmUgdG8gbGVmdCBieSBuIGNoYXJhY3RlcnMnLCAoKSA9PiB7XG5cdFx0ZXhlY3V0ZVRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8odmlld01vZGVsLCAxLCA4KTtcblx0XHRcdG1vdmVMZWZ0KHZpZXdNb2RlbCwgMyk7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDEsIDUpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIGxlZnQgc2hvdWxkIG1vdmUgdG8gbGVmdCBieSBoYWxmIGxpbmUnLCAoKSA9PiB7XG5cdFx0ZXhlY3V0ZVRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8odmlld01vZGVsLCAxLCA4KTtcblx0XHRcdG1vdmVMZWZ0KHZpZXdNb2RlbCwgMSwgQ3Vyc29yTW92ZS5SYXdVbml0LkhhbGZMaW5lKTtcblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgMSwgMSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgbGVmdCBtb3ZlcyB0byBwcmV2aW91cyBsaW5lJywgKCkgPT4ge1xuXHRcdGV4ZWN1dGVUZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKHZpZXdNb2RlbCwgMiwgMyk7XG5cdFx0XHRtb3ZlTGVmdCh2aWV3TW9kZWwsIDEwKTtcblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgMSwgMjEpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHJpZ2h0IHNob3VsZCBtb3ZlIHRvIHJpZ2h0IGNoYXJhY3RlcicsICgpID0+IHtcblx0XHRleGVjdXRlVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyh2aWV3TW9kZWwsIDEsIDUpO1xuXHRcdFx0bW92ZVJpZ2h0KHZpZXdNb2RlbCk7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDEsIDYpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHJpZ2h0IHNob3VsZCBtb3ZlIHRvIHJpZ2h0IGJ5IG4gY2hhcmFjdGVycycsICgpID0+IHtcblx0XHRleGVjdXRlVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyh2aWV3TW9kZWwsIDEsIDIpO1xuXHRcdFx0bW92ZVJpZ2h0KHZpZXdNb2RlbCwgNik7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDEsIDgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHJpZ2h0IHNob3VsZCBtb3ZlIHRvIHJpZ2h0IGJ5IGhhbGYgbGluZScsICgpID0+IHtcblx0XHRleGVjdXRlVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyh2aWV3TW9kZWwsIDEsIDQpO1xuXHRcdFx0bW92ZVJpZ2h0KHZpZXdNb2RlbCwgMSwgQ3Vyc29yTW92ZS5SYXdVbml0LkhhbGZMaW5lKTtcblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgMSwgMTQpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHJpZ2h0IG1vdmVzIHRvIG5leHQgbGluZScsICgpID0+IHtcblx0XHRleGVjdXRlVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyh2aWV3TW9kZWwsIDEsIDgpO1xuXHRcdFx0bW92ZVJpZ2h0KHZpZXdNb2RlbCwgMTAwKTtcblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgMiwgMSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgdG8gZmlyc3QgY2hhcmFjdGVyIG9mIGxpbmUgZnJvbSBtaWRkbGUnLCAoKSA9PiB7XG5cdFx0ZXhlY3V0ZVRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8odmlld01vZGVsLCAxLCA4KTtcblx0XHRcdG1vdmVUb0xpbmVTdGFydCh2aWV3TW9kZWwpO1xuXHRcdFx0Y3Vyc29yRXF1YWwodmlld01vZGVsLCAxLCAxKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSB0byBmaXJzdCBjaGFyYWN0ZXIgb2YgbGluZSBmcm9tIGZpcnN0IG5vbiB3aGl0ZSBzcGFjZSBjaGFyYWN0ZXInLCAoKSA9PiB7XG5cdFx0ZXhlY3V0ZVRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8odmlld01vZGVsLCAxLCA2KTtcblx0XHRcdG1vdmVUb0xpbmVTdGFydCh2aWV3TW9kZWwpO1xuXHRcdFx0Y3Vyc29yRXF1YWwodmlld01vZGVsLCAxLCAxKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSB0byBmaXJzdCBjaGFyYWN0ZXIgb2YgbGluZSBmcm9tIGZpcnN0IGNoYXJhY3RlcicsICgpID0+IHtcblx0XHRleGVjdXRlVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyh2aWV3TW9kZWwsIDEsIDEpO1xuXHRcdFx0bW92ZVRvTGluZVN0YXJ0KHZpZXdNb2RlbCk7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDEsIDEpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHRvIGZpcnN0IG5vbiB3aGl0ZSBzcGFjZSBjaGFyYWN0ZXIgb2YgbGluZSBmcm9tIG1pZGRsZScsICgpID0+IHtcblx0XHRleGVjdXRlVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyh2aWV3TW9kZWwsIDEsIDgpO1xuXHRcdFx0bW92ZVRvTGluZUZpcnN0Tm9uV2hpdGVzcGFjZUNoYXJhY3Rlcih2aWV3TW9kZWwpO1xuXHRcdFx0Y3Vyc29yRXF1YWwodmlld01vZGVsLCAxLCA2KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSB0byBmaXJzdCBub24gd2hpdGUgc3BhY2UgY2hhcmFjdGVyIG9mIGxpbmUgZnJvbSBmaXJzdCBub24gd2hpdGUgc3BhY2UgY2hhcmFjdGVyJywgKCkgPT4ge1xuXHRcdGV4ZWN1dGVUZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKHZpZXdNb2RlbCwgMSwgNik7XG5cdFx0XHRtb3ZlVG9MaW5lRmlyc3ROb25XaGl0ZXNwYWNlQ2hhcmFjdGVyKHZpZXdNb2RlbCk7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDEsIDYpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHRvIGZpcnN0IG5vbiB3aGl0ZSBzcGFjZSBjaGFyYWN0ZXIgb2YgbGluZSBmcm9tIGZpcnN0IGNoYXJhY3RlcicsICgpID0+IHtcblx0XHRleGVjdXRlVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyh2aWV3TW9kZWwsIDEsIDEpO1xuXHRcdFx0bW92ZVRvTGluZUZpcnN0Tm9uV2hpdGVzcGFjZUNoYXJhY3Rlcih2aWV3TW9kZWwpO1xuXHRcdFx0Y3Vyc29yRXF1YWwodmlld01vZGVsLCAxLCA2KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSB0byBlbmQgb2YgbGluZSBmcm9tIG1pZGRsZScsICgpID0+IHtcblx0XHRleGVjdXRlVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyh2aWV3TW9kZWwsIDEsIDgpO1xuXHRcdFx0bW92ZVRvTGluZUVuZCh2aWV3TW9kZWwpO1xuXHRcdFx0Y3Vyc29yRXF1YWwodmlld01vZGVsLCAxLCAyMSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgdG8gZW5kIG9mIGxpbmUgZnJvbSBsYXN0IG5vbiB3aGl0ZSBzcGFjZSBjaGFyYWN0ZXInLCAoKSA9PiB7XG5cdFx0ZXhlY3V0ZVRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8odmlld01vZGVsLCAxLCAxOSk7XG5cdFx0XHRtb3ZlVG9MaW5lRW5kKHZpZXdNb2RlbCk7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDEsIDIxKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSB0byBlbmQgb2YgbGluZSBmcm9tIGxpbmUgZW5kJywgKCkgPT4ge1xuXHRcdGV4ZWN1dGVUZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKHZpZXdNb2RlbCwgMSwgMjEpO1xuXHRcdFx0bW92ZVRvTGluZUVuZCh2aWV3TW9kZWwpO1xuXHRcdFx0Y3Vyc29yRXF1YWwodmlld01vZGVsLCAxLCAyMSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgdG8gbGFzdCBub24gd2hpdGUgc3BhY2UgY2hhcmFjdGVyIGZyb20gbWlkZGxlJywgKCkgPT4ge1xuXHRcdGV4ZWN1dGVUZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKHZpZXdNb2RlbCwgMSwgOCk7XG5cdFx0XHRtb3ZlVG9MaW5lTGFzdE5vbldoaXRlc3BhY2VDaGFyYWN0ZXIodmlld01vZGVsKTtcblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgMSwgMTkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHRvIGxhc3Qgbm9uIHdoaXRlIHNwYWNlIGNoYXJhY3RlciBmcm9tIGxhc3Qgbm9uIHdoaXRlIHNwYWNlIGNoYXJhY3RlcicsICgpID0+IHtcblx0XHRleGVjdXRlVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyh2aWV3TW9kZWwsIDEsIDE5KTtcblx0XHRcdG1vdmVUb0xpbmVMYXN0Tm9uV2hpdGVzcGFjZUNoYXJhY3Rlcih2aWV3TW9kZWwpO1xuXHRcdFx0Y3Vyc29yRXF1YWwodmlld01vZGVsLCAxLCAxOSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgdG8gbGFzdCBub24gd2hpdGUgc3BhY2UgY2hhcmFjdGVyIGZyb20gbGluZSBlbmQnLCAoKSA9PiB7XG5cdFx0ZXhlY3V0ZVRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8odmlld01vZGVsLCAxLCAyMSk7XG5cdFx0XHRtb3ZlVG9MaW5lTGFzdE5vbldoaXRlc3BhY2VDaGFyYWN0ZXIodmlld01vZGVsKTtcblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgMSwgMTkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHRvIGNlbnRlciBvZiBsaW5lIG5vdCBmcm9tIGNlbnRlcicsICgpID0+IHtcblx0XHRleGVjdXRlVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyh2aWV3TW9kZWwsIDEsIDgpO1xuXHRcdFx0bW92ZVRvTGluZUNlbnRlcih2aWV3TW9kZWwpO1xuXHRcdFx0Y3Vyc29yRXF1YWwodmlld01vZGVsLCAxLCAxMSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgdG8gY2VudGVyIG9mIGxpbmUgZnJvbSBjZW50ZXInLCAoKSA9PiB7XG5cdFx0ZXhlY3V0ZVRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8odmlld01vZGVsLCAxLCAxMSk7XG5cdFx0XHRtb3ZlVG9MaW5lQ2VudGVyKHZpZXdNb2RlbCk7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDEsIDExKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSB0byBjZW50ZXIgb2YgbGluZSBmcm9tIHN0YXJ0JywgKCkgPT4ge1xuXHRcdGV4ZWN1dGVUZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvTGluZVN0YXJ0KHZpZXdNb2RlbCk7XG5cdFx0XHRtb3ZlVG9MaW5lQ2VudGVyKHZpZXdNb2RlbCk7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDEsIDExKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSB0byBjZW50ZXIgb2YgbGluZSBmcm9tIGVuZCcsICgpID0+IHtcblx0XHRleGVjdXRlVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUb0xpbmVFbmQodmlld01vZGVsKTtcblx0XHRcdG1vdmVUb0xpbmVDZW50ZXIodmlld01vZGVsKTtcblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgMSwgMTEpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHVwIGJ5IGN1cnNvciBtb3ZlIGNvbW1hbmQnLCAoKSA9PiB7XG5cdFx0ZXhlY3V0ZVRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8odmlld01vZGVsLCAzLCA1KTtcblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgMywgNSk7XG5cblx0XHRcdG1vdmVVcCh2aWV3TW9kZWwsIDIpO1xuXHRcdFx0Y3Vyc29yRXF1YWwodmlld01vZGVsLCAxLCA1KTtcblxuXHRcdFx0bW92ZVVwKHZpZXdNb2RlbCwgMSk7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDEsIDEpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHVwIGJ5IG1vZGVsIGxpbmUgY3Vyc29yIG1vdmUgY29tbWFuZCcsICgpID0+IHtcblx0XHRleGVjdXRlVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyh2aWV3TW9kZWwsIDMsIDUpO1xuXHRcdFx0Y3Vyc29yRXF1YWwodmlld01vZGVsLCAzLCA1KTtcblxuXHRcdFx0bW92ZVVwQnlNb2RlbExpbmUodmlld01vZGVsLCAyKTtcblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgMSwgNSk7XG5cblx0XHRcdG1vdmVVcEJ5TW9kZWxMaW5lKHZpZXdNb2RlbCwgMSk7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDEsIDEpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIGRvd24gYnkgbW9kZWwgbGluZSBjdXJzb3IgbW92ZSBjb21tYW5kJywgKCkgPT4ge1xuXHRcdGV4ZWN1dGVUZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKHZpZXdNb2RlbCwgMywgNSk7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDMsIDUpO1xuXG5cdFx0XHRtb3ZlRG93bkJ5TW9kZWxMaW5lKHZpZXdNb2RlbCwgMik7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDUsIDIpO1xuXG5cdFx0XHRtb3ZlRG93bkJ5TW9kZWxMaW5lKHZpZXdNb2RlbCwgMSk7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDUsIDIpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHVwIHdpdGggc2VsZWN0aW9uIGJ5IGN1cnNvciBtb3ZlIGNvbW1hbmQnLCAoKSA9PiB7XG5cdFx0ZXhlY3V0ZVRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8odmlld01vZGVsLCAzLCA1KTtcblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgMywgNSk7XG5cblx0XHRcdG1vdmVVcCh2aWV3TW9kZWwsIDEsIHRydWUpO1xuXHRcdFx0Y3Vyc29yRXF1YWwodmlld01vZGVsLCAyLCAyLCAzLCA1KTtcblxuXHRcdFx0bW92ZVVwKHZpZXdNb2RlbCwgMSwgdHJ1ZSk7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDEsIDUsIDMsIDUpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHVwIGFuZCBkb3duIHdpdGggdGFicyBieSBjdXJzb3IgbW92ZSBjb21tYW5kJywgKCkgPT4ge1xuXHRcdGV4ZWN1dGVUZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKHZpZXdNb2RlbCwgMSwgNSk7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDEsIDUpO1xuXG5cdFx0XHRtb3ZlRG93bih2aWV3TW9kZWwsIDQpO1xuXHRcdFx0Y3Vyc29yRXF1YWwodmlld01vZGVsLCA1LCAyKTtcblxuXHRcdFx0bW92ZVVwKHZpZXdNb2RlbCwgMSk7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDQsIDEpO1xuXG5cdFx0XHRtb3ZlVXAodmlld01vZGVsLCAxKTtcblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgMywgNSk7XG5cblx0XHRcdG1vdmVVcCh2aWV3TW9kZWwsIDEpO1xuXHRcdFx0Y3Vyc29yRXF1YWwodmlld01vZGVsLCAyLCAyKTtcblxuXHRcdFx0bW92ZVVwKHZpZXdNb2RlbCwgMSk7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDEsIDUpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHVwIGFuZCBkb3duIHdpdGggZW5kIG9mIGxpbmVzIHN0YXJ0aW5nIGZyb20gYSBsb25nIG9uZSBieSBjdXJzb3IgbW92ZSBjb21tYW5kJywgKCkgPT4ge1xuXHRcdGV4ZWN1dGVUZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvRW5kT2ZMaW5lKHZpZXdNb2RlbCk7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDEsIDIxKTtcblxuXHRcdFx0bW92ZVRvRW5kT2ZMaW5lKHZpZXdNb2RlbCk7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDEsIDIxKTtcblxuXHRcdFx0bW92ZURvd24odmlld01vZGVsLCAyKTtcblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgMywgMTcpO1xuXG5cdFx0XHRtb3ZlRG93bih2aWV3TW9kZWwsIDEpO1xuXHRcdFx0Y3Vyc29yRXF1YWwodmlld01vZGVsLCA0LCAxKTtcblxuXHRcdFx0bW92ZURvd24odmlld01vZGVsLCAxKTtcblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgNSwgMik7XG5cblx0XHRcdG1vdmVVcCh2aWV3TW9kZWwsIDQpO1xuXHRcdFx0Y3Vyc29yRXF1YWwodmlld01vZGVsLCAxLCAyMSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgdG8gdmlldyB0b3AgbGluZSBtb3ZlcyB0byBmaXJzdCB2aXNpYmxlIGxpbmUgaWYgaXQgaXMgZmlyc3QgbGluZScsICgpID0+IHtcblx0XHRleGVjdXRlVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC5nZXRDb21wbGV0ZWx5VmlzaWJsZVZpZXdSYW5nZSA9ICgpID0+IG5ldyBSYW5nZSgxLCAxLCAxMCwgMSk7XG5cblx0XHRcdG1vdmVUbyh2aWV3TW9kZWwsIDIsIDIpO1xuXHRcdFx0bW92ZVRvVG9wKHZpZXdNb2RlbCk7XG5cblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgMSwgNik7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgdG8gdmlldyB0b3AgbGluZSBtb3ZlcyB0byB0b3AgdmlzaWJsZSBsaW5lIHdoZW4gZmlyc3QgbGluZSBpcyBub3QgdmlzaWJsZScsICgpID0+IHtcblx0XHRleGVjdXRlVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC5nZXRDb21wbGV0ZWx5VmlzaWJsZVZpZXdSYW5nZSA9ICgpID0+IG5ldyBSYW5nZSgyLCAxLCAxMCwgMSk7XG5cblx0XHRcdG1vdmVUbyh2aWV3TW9kZWwsIDQsIDEpO1xuXHRcdFx0bW92ZVRvVG9wKHZpZXdNb2RlbCk7XG5cblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgMiwgMik7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgdG8gdmlldyB0b3AgbGluZSBtb3ZlcyB0byBudGggbGluZSBmcm9tIHRvcCcsICgpID0+IHtcblx0XHRleGVjdXRlVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC5nZXRDb21wbGV0ZWx5VmlzaWJsZVZpZXdSYW5nZSA9ICgpID0+IG5ldyBSYW5nZSgxLCAxLCAxMCwgMSk7XG5cblx0XHRcdG1vdmVUbyh2aWV3TW9kZWwsIDQsIDEpO1xuXHRcdFx0bW92ZVRvVG9wKHZpZXdNb2RlbCwgMyk7XG5cblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgMywgNSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgdG8gdmlldyB0b3AgbGluZSBtb3ZlcyB0byBsYXN0IGxpbmUgaWYgbiBpcyBncmVhdGVyIHRoYW4gbGFzdCB2aXNpYmxlIGxpbmUgbnVtYmVyJywgKCkgPT4ge1xuXHRcdGV4ZWN1dGVUZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLmdldENvbXBsZXRlbHlWaXNpYmxlVmlld1JhbmdlID0gKCkgPT4gbmV3IFJhbmdlKDEsIDEsIDMsIDEpO1xuXG5cdFx0XHRtb3ZlVG8odmlld01vZGVsLCAyLCAyKTtcblx0XHRcdG1vdmVUb1RvcCh2aWV3TW9kZWwsIDQpO1xuXG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDMsIDUpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHRvIHZpZXcgY2VudGVyIGxpbmUgbW92ZXMgdG8gdGhlIGNlbnRlciBsaW5lJywgKCkgPT4ge1xuXHRcdGV4ZWN1dGVUZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLmdldENvbXBsZXRlbHlWaXNpYmxlVmlld1JhbmdlID0gKCkgPT4gbmV3IFJhbmdlKDMsIDEsIDMsIDEpO1xuXG5cdFx0XHRtb3ZlVG8odmlld01vZGVsLCAyLCAyKTtcblx0XHRcdG1vdmVUb0NlbnRlcih2aWV3TW9kZWwpO1xuXG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDMsIDUpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHRvIHZpZXcgYm90dG9tIGxpbmUgbW92ZXMgdG8gbGFzdCB2aXNpYmxlIGxpbmUgaWYgaXQgaXMgbGFzdCBsaW5lJywgKCkgPT4ge1xuXHRcdGV4ZWN1dGVUZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLmdldENvbXBsZXRlbHlWaXNpYmxlVmlld1JhbmdlID0gKCkgPT4gbmV3IFJhbmdlKDEsIDEsIDUsIDEpO1xuXG5cdFx0XHRtb3ZlVG8odmlld01vZGVsLCAyLCAyKTtcblx0XHRcdG1vdmVUb0JvdHRvbSh2aWV3TW9kZWwpO1xuXG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDUsIDEpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHRvIHZpZXcgYm90dG9tIGxpbmUgbW92ZXMgdG8gbGFzdCB2aXNpYmxlIGxpbmUgd2hlbiBsYXN0IGxpbmUgaXMgbm90IHZpc2libGUnLCAoKSA9PiB7XG5cdFx0ZXhlY3V0ZVRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHR2aWV3TW9kZWwuZ2V0Q29tcGxldGVseVZpc2libGVWaWV3UmFuZ2UgPSAoKSA9PiBuZXcgUmFuZ2UoMiwgMSwgMywgMSk7XG5cblx0XHRcdG1vdmVUbyh2aWV3TW9kZWwsIDIsIDIpO1xuXHRcdFx0bW92ZVRvQm90dG9tKHZpZXdNb2RlbCk7XG5cblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgMywgNSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgdG8gdmlldyBib3R0b20gbGluZSBtb3ZlcyB0byBudGggbGluZSBmcm9tIGJvdHRvbScsICgpID0+IHtcblx0XHRleGVjdXRlVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC5nZXRDb21wbGV0ZWx5VmlzaWJsZVZpZXdSYW5nZSA9ICgpID0+IG5ldyBSYW5nZSgxLCAxLCA1LCAxKTtcblxuXHRcdFx0bW92ZVRvKHZpZXdNb2RlbCwgNCwgMSk7XG5cdFx0XHRtb3ZlVG9Cb3R0b20odmlld01vZGVsLCAzKTtcblxuXHRcdFx0Y3Vyc29yRXF1YWwodmlld01vZGVsLCAzLCA1KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSB0byB2aWV3IGJvdHRvbSBsaW5lIG1vdmVzIHRvIGZpcnN0IGxpbmUgaWYgbiBpcyBsZXNzZXIgdGhhbiBmaXJzdCB2aXNpYmxlIGxpbmUgbnVtYmVyJywgKCkgPT4ge1xuXHRcdGV4ZWN1dGVUZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLmdldENvbXBsZXRlbHlWaXNpYmxlVmlld1JhbmdlID0gKCkgPT4gbmV3IFJhbmdlKDIsIDEsIDUsIDEpO1xuXG5cdFx0XHRtb3ZlVG8odmlld01vZGVsLCA0LCAxKTtcblx0XHRcdG1vdmVUb0JvdHRvbSh2aWV3TW9kZWwsIDUpO1xuXG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDIsIDIpO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgnQ3Vyc29yIG1vdmUgYnkgYmxhbmtsaW5lIHRlc3QnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0Y29uc3QgVEVYVCA9IFtcblx0XHQnICAgIFxcdE15IEZpcnN0IExpbmVcXHQgJyxcblx0XHQnXFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdCcgICAgVGhpcmQgTGluZVx1RDgzRFx1REMzNicsXG5cdFx0JycsXG5cdFx0JzEnLFxuXHRcdCcyJyxcblx0XHQnMycsXG5cdFx0JycsXG5cdFx0JyAgICAgICAgICcsXG5cdFx0J2EnLFxuXHRcdCdiJyxcblx0XS5qb2luKCdcXG4nKTtcblxuXHRmdW5jdGlvbiBleGVjdXRlVGVzdChjYWxsYmFjazogKGVkaXRvcjogSVRlc3RDb2RlRWRpdG9yLCB2aWV3TW9kZWw6IFZpZXdNb2RlbCkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihURVhULCB7fSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRjYWxsYmFjayhlZGl0b3IsIHZpZXdNb2RlbCk7XG5cdFx0fSk7XG5cdH1cblxuXHR0ZXN0KCdtb3ZlIGRvd24gc2hvdWxkIG1vdmUgdG8gc3RhcnQgb2YgbmV4dCBibGFuayBsaW5lJywgKCkgPT4ge1xuXHRcdGV4ZWN1dGVUZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZURvd25CeUJsYW5rTGluZSh2aWV3TW9kZWwsIGZhbHNlKTtcblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgNCwgMSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgdXAgc2hvdWxkIG1vdmUgdG8gc3RhcnQgb2YgcHJldmlvdXMgYmxhbmsgbGluZScsICgpID0+IHtcblx0XHRleGVjdXRlVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyh2aWV3TW9kZWwsIDcsIDEpO1xuXHRcdFx0bW92ZVVwQnlCbGFua0xpbmUodmlld01vZGVsLCBmYWxzZSk7XG5cdFx0XHRjdXJzb3JFcXVhbCh2aWV3TW9kZWwsIDQsIDEpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIGRvd24gc2hvdWxkIHNraXAgb3ZlciB3aGl0ZXNwYWNlIGlmIGFscmVhZHkgb24gYmxhbmsgbGluZScsICgpID0+IHtcblx0XHRleGVjdXRlVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyh2aWV3TW9kZWwsIDgsIDEpO1xuXHRcdFx0bW92ZURvd25CeUJsYW5rTGluZSh2aWV3TW9kZWwsIGZhbHNlKTtcblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgMTEsIDEpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHVwIHNob3VsZCBza2lwIG92ZXIgd2hpdGVzcGFjZSBpZiBhbHJlYWR5IG9uIGJsYW5rIGxpbmUnLCAoKSA9PiB7XG5cdFx0ZXhlY3V0ZVRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8odmlld01vZGVsLCA5LCAxKTtcblx0XHRcdG1vdmVVcEJ5QmxhbmtMaW5lKHZpZXdNb2RlbCwgZmFsc2UpO1xuXHRcdFx0Y3Vyc29yRXF1YWwodmlld01vZGVsLCA0LCAxKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSB1cCBzaG91bGQgZ28gdG8gZmlyc3QgY29sdW1uIG9mIGZpcnN0IGxpbmUgaWYgbm90IGVtcHR5JywgKCkgPT4ge1xuXHRcdGV4ZWN1dGVUZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZVRvKHZpZXdNb2RlbCwgMiwgMSk7XG5cdFx0XHRtb3ZlVXBCeUJsYW5rTGluZSh2aWV3TW9kZWwsIGZhbHNlKTtcblx0XHRcdGN1cnNvckVxdWFsKHZpZXdNb2RlbCwgMSwgMSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgZG93biBzaG91bGQgZ28gdG8gZmlyc3QgY29sdW1uIG9mIGxhc3QgbGluZSBpZiBub3QgZW1wdHknLCAoKSA9PiB7XG5cdFx0ZXhlY3V0ZVRlc3QoKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRtb3ZlVG8odmlld01vZGVsLCAxMCwgMSk7XG5cdFx0XHRtb3ZlRG93bkJ5QmxhbmtMaW5lKHZpZXdNb2RlbCwgZmFsc2UpO1xuXHRcdFx0Y3Vyc29yRXF1YWwodmlld01vZGVsLCAxMSwgMSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NlbGVjdCBkb3duIHNob3VsZCBzZWxlY3QgdG8gc3RhcnQgb2YgbmV4dCBibGFuayBsaW5lJywgKCkgPT4ge1xuXHRcdGV4ZWN1dGVUZXN0KChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0bW92ZURvd25CeUJsYW5rTGluZSh2aWV3TW9kZWwsIHRydWUpO1xuXHRcdFx0c2VsZWN0aW9uRXF1YWwodmlld01vZGVsLmdldFNlbGVjdGlvbigpLCA0LCAxLCAxLCAxKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnc2VsZWN0IHVwIHNob3VsZCBzZWxlY3QgdG8gc3RhcnQgb2YgcHJldmlvdXMgYmxhbmsgbGluZScsICgpID0+IHtcblx0XHRleGVjdXRlVGVzdCgoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdG1vdmVUbyh2aWV3TW9kZWwsIDcsIDEpO1xuXHRcdFx0bW92ZVVwQnlCbGFua0xpbmUodmlld01vZGVsLCB0cnVlKTtcblx0XHRcdHNlbGVjdGlvbkVxdWFsKHZpZXdNb2RlbC5nZXRTZWxlY3Rpb24oKSwgNCwgMSwgNywgMSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG5cbi8vIE1vdmUgY29tbWFuZFxuXG5mdW5jdGlvbiBtb3ZlKHZpZXdNb2RlbDogVmlld01vZGVsLCBhcmdzOiBhbnkpIHtcblx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JNb3ZlLnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwgYXJncyk7XG59XG5cbmZ1bmN0aW9uIG1vdmVUb0xpbmVTdGFydCh2aWV3TW9kZWw6IFZpZXdNb2RlbCkge1xuXHRtb3ZlKHZpZXdNb2RlbCwgeyB0bzogQ3Vyc29yTW92ZS5SYXdEaXJlY3Rpb24uV3JhcHBlZExpbmVTdGFydCB9KTtcbn1cblxuZnVuY3Rpb24gbW92ZVRvTGluZUZpcnN0Tm9uV2hpdGVzcGFjZUNoYXJhY3Rlcih2aWV3TW9kZWw6IFZpZXdNb2RlbCkge1xuXHRtb3ZlKHZpZXdNb2RlbCwgeyB0bzogQ3Vyc29yTW92ZS5SYXdEaXJlY3Rpb24uV3JhcHBlZExpbmVGaXJzdE5vbldoaXRlc3BhY2VDaGFyYWN0ZXIgfSk7XG59XG5cbmZ1bmN0aW9uIG1vdmVUb0xpbmVDZW50ZXIodmlld01vZGVsOiBWaWV3TW9kZWwpIHtcblx0bW92ZSh2aWV3TW9kZWwsIHsgdG86IEN1cnNvck1vdmUuUmF3RGlyZWN0aW9uLldyYXBwZWRMaW5lQ29sdW1uQ2VudGVyIH0pO1xufVxuXG5mdW5jdGlvbiBtb3ZlVG9MaW5lRW5kKHZpZXdNb2RlbDogVmlld01vZGVsKSB7XG5cdG1vdmUodmlld01vZGVsLCB7IHRvOiBDdXJzb3JNb3ZlLlJhd0RpcmVjdGlvbi5XcmFwcGVkTGluZUVuZCB9KTtcbn1cblxuZnVuY3Rpb24gbW92ZVRvTGluZUxhc3ROb25XaGl0ZXNwYWNlQ2hhcmFjdGVyKHZpZXdNb2RlbDogVmlld01vZGVsKSB7XG5cdG1vdmUodmlld01vZGVsLCB7IHRvOiBDdXJzb3JNb3ZlLlJhd0RpcmVjdGlvbi5XcmFwcGVkTGluZUxhc3ROb25XaGl0ZXNwYWNlQ2hhcmFjdGVyIH0pO1xufVxuXG5mdW5jdGlvbiBtb3ZlTGVmdCh2aWV3TW9kZWw6IFZpZXdNb2RlbCwgdmFsdWU/OiBudW1iZXIsIGJ5Pzogc3RyaW5nLCBzZWxlY3Q/OiBib29sZWFuKSB7XG5cdG1vdmUodmlld01vZGVsLCB7IHRvOiBDdXJzb3JNb3ZlLlJhd0RpcmVjdGlvbi5MZWZ0LCBieTogYnksIHZhbHVlOiB2YWx1ZSwgc2VsZWN0OiBzZWxlY3QgfSk7XG59XG5cbmZ1bmN0aW9uIG1vdmVSaWdodCh2aWV3TW9kZWw6IFZpZXdNb2RlbCwgdmFsdWU/OiBudW1iZXIsIGJ5Pzogc3RyaW5nLCBzZWxlY3Q/OiBib29sZWFuKSB7XG5cdG1vdmUodmlld01vZGVsLCB7IHRvOiBDdXJzb3JNb3ZlLlJhd0RpcmVjdGlvbi5SaWdodCwgYnk6IGJ5LCB2YWx1ZTogdmFsdWUsIHNlbGVjdDogc2VsZWN0IH0pO1xufVxuXG5mdW5jdGlvbiBtb3ZlVXAodmlld01vZGVsOiBWaWV3TW9kZWwsIG5vT2ZMaW5lczogbnVtYmVyID0gMSwgc2VsZWN0PzogYm9vbGVhbikge1xuXHRtb3ZlKHZpZXdNb2RlbCwgeyB0bzogQ3Vyc29yTW92ZS5SYXdEaXJlY3Rpb24uVXAsIGJ5OiBDdXJzb3JNb3ZlLlJhd1VuaXQuV3JhcHBlZExpbmUsIHZhbHVlOiBub09mTGluZXMsIHNlbGVjdDogc2VsZWN0IH0pO1xufVxuXG5mdW5jdGlvbiBtb3ZlVXBCeUJsYW5rTGluZSh2aWV3TW9kZWw6IFZpZXdNb2RlbCwgc2VsZWN0PzogYm9vbGVhbikge1xuXHRtb3ZlKHZpZXdNb2RlbCwgeyB0bzogQ3Vyc29yTW92ZS5SYXdEaXJlY3Rpb24uUHJldkJsYW5rTGluZSwgYnk6IEN1cnNvck1vdmUuUmF3VW5pdC5XcmFwcGVkTGluZSwgc2VsZWN0OiBzZWxlY3QgfSk7XG59XG5cbmZ1bmN0aW9uIG1vdmVVcEJ5TW9kZWxMaW5lKHZpZXdNb2RlbDogVmlld01vZGVsLCBub09mTGluZXM6IG51bWJlciA9IDEsIHNlbGVjdD86IGJvb2xlYW4pIHtcblx0bW92ZSh2aWV3TW9kZWwsIHsgdG86IEN1cnNvck1vdmUuUmF3RGlyZWN0aW9uLlVwLCB2YWx1ZTogbm9PZkxpbmVzLCBzZWxlY3Q6IHNlbGVjdCB9KTtcbn1cblxuZnVuY3Rpb24gbW92ZURvd24odmlld01vZGVsOiBWaWV3TW9kZWwsIG5vT2ZMaW5lczogbnVtYmVyID0gMSwgc2VsZWN0PzogYm9vbGVhbikge1xuXHRtb3ZlKHZpZXdNb2RlbCwgeyB0bzogQ3Vyc29yTW92ZS5SYXdEaXJlY3Rpb24uRG93biwgYnk6IEN1cnNvck1vdmUuUmF3VW5pdC5XcmFwcGVkTGluZSwgdmFsdWU6IG5vT2ZMaW5lcywgc2VsZWN0OiBzZWxlY3QgfSk7XG59XG5cbmZ1bmN0aW9uIG1vdmVEb3duQnlCbGFua0xpbmUodmlld01vZGVsOiBWaWV3TW9kZWwsIHNlbGVjdD86IGJvb2xlYW4pIHtcblx0bW92ZSh2aWV3TW9kZWwsIHsgdG86IEN1cnNvck1vdmUuUmF3RGlyZWN0aW9uLk5leHRCbGFua0xpbmUsIGJ5OiBDdXJzb3JNb3ZlLlJhd1VuaXQuV3JhcHBlZExpbmUsIHNlbGVjdDogc2VsZWN0IH0pO1xufVxuXG5mdW5jdGlvbiBtb3ZlRG93bkJ5TW9kZWxMaW5lKHZpZXdNb2RlbDogVmlld01vZGVsLCBub09mTGluZXM6IG51bWJlciA9IDEsIHNlbGVjdD86IGJvb2xlYW4pIHtcblx0bW92ZSh2aWV3TW9kZWwsIHsgdG86IEN1cnNvck1vdmUuUmF3RGlyZWN0aW9uLkRvd24sIHZhbHVlOiBub09mTGluZXMsIHNlbGVjdDogc2VsZWN0IH0pO1xufVxuXG5mdW5jdGlvbiBtb3ZlVG9Ub3Aodmlld01vZGVsOiBWaWV3TW9kZWwsIG5vT2ZMaW5lczogbnVtYmVyID0gMSwgc2VsZWN0PzogYm9vbGVhbikge1xuXHRtb3ZlKHZpZXdNb2RlbCwgeyB0bzogQ3Vyc29yTW92ZS5SYXdEaXJlY3Rpb24uVmlld1BvcnRUb3AsIHZhbHVlOiBub09mTGluZXMsIHNlbGVjdDogc2VsZWN0IH0pO1xufVxuXG5mdW5jdGlvbiBtb3ZlVG9DZW50ZXIodmlld01vZGVsOiBWaWV3TW9kZWwsIHNlbGVjdD86IGJvb2xlYW4pIHtcblx0bW92ZSh2aWV3TW9kZWwsIHsgdG86IEN1cnNvck1vdmUuUmF3RGlyZWN0aW9uLlZpZXdQb3J0Q2VudGVyLCBzZWxlY3Q6IHNlbGVjdCB9KTtcbn1cblxuZnVuY3Rpb24gbW92ZVRvQm90dG9tKHZpZXdNb2RlbDogVmlld01vZGVsLCBub09mTGluZXM6IG51bWJlciA9IDEsIHNlbGVjdD86IGJvb2xlYW4pIHtcblx0bW92ZSh2aWV3TW9kZWwsIHsgdG86IEN1cnNvck1vdmUuUmF3RGlyZWN0aW9uLlZpZXdQb3J0Qm90dG9tLCB2YWx1ZTogbm9PZkxpbmVzLCBzZWxlY3Q6IHNlbGVjdCB9KTtcbn1cblxuZnVuY3Rpb24gY3Vyc29yRXF1YWwodmlld01vZGVsOiBWaWV3TW9kZWwsIHBvc0xpbmVOdW1iZXI6IG51bWJlciwgcG9zQ29sdW1uOiBudW1iZXIsIHNlbExpbmVOdW1iZXI6IG51bWJlciA9IHBvc0xpbmVOdW1iZXIsIHNlbENvbHVtbjogbnVtYmVyID0gcG9zQ29sdW1uKSB7XG5cdHBvc2l0aW9uRXF1YWwodmlld01vZGVsLmdldFBvc2l0aW9uKCksIHBvc0xpbmVOdW1iZXIsIHBvc0NvbHVtbik7XG5cdHNlbGVjdGlvbkVxdWFsKHZpZXdNb2RlbC5nZXRTZWxlY3Rpb24oKSwgcG9zTGluZU51bWJlciwgcG9zQ29sdW1uLCBzZWxMaW5lTnVtYmVyLCBzZWxDb2x1bW4pO1xufVxuXG5mdW5jdGlvbiBwb3NpdGlvbkVxdWFsKHBvc2l0aW9uOiBQb3NpdGlvbiwgbGluZU51bWJlcjogbnVtYmVyLCBjb2x1bW46IG51bWJlcikge1xuXHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBvc2l0aW9uLCBuZXcgUG9zaXRpb24obGluZU51bWJlciwgY29sdW1uKSwgJ3Bvc2l0aW9uIGVxdWFsJyk7XG59XG5cbmZ1bmN0aW9uIHNlbGVjdGlvbkVxdWFsKHNlbGVjdGlvbjogU2VsZWN0aW9uLCBwb3NMaW5lTnVtYmVyOiBudW1iZXIsIHBvc0NvbHVtbjogbnVtYmVyLCBzZWxMaW5lTnVtYmVyOiBudW1iZXIsIHNlbENvbHVtbjogbnVtYmVyKSB7XG5cdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoe1xuXHRcdHNlbGVjdGlvblN0YXJ0TGluZU51bWJlcjogc2VsZWN0aW9uLnNlbGVjdGlvblN0YXJ0TGluZU51bWJlcixcblx0XHRzZWxlY3Rpb25TdGFydENvbHVtbjogc2VsZWN0aW9uLnNlbGVjdGlvblN0YXJ0Q29sdW1uLFxuXHRcdHBvc2l0aW9uTGluZU51bWJlcjogc2VsZWN0aW9uLnBvc2l0aW9uTGluZU51bWJlcixcblx0XHRwb3NpdGlvbkNvbHVtbjogc2VsZWN0aW9uLnBvc2l0aW9uQ29sdW1uXG5cdH0sIHtcblx0XHRzZWxlY3Rpb25TdGFydExpbmVOdW1iZXI6IHNlbExpbmVOdW1iZXIsXG5cdFx0c2VsZWN0aW9uU3RhcnRDb2x1bW46IHNlbENvbHVtbixcblx0XHRwb3NpdGlvbkxpbmVOdW1iZXI6IHBvc0xpbmVOdW1iZXIsXG5cdFx0cG9zaXRpb25Db2x1bW46IHBvc0NvbHVtblxuXHR9LCAnc2VsZWN0aW9uIGVxdWFsJyk7XG59XG5cbmZ1bmN0aW9uIG1vdmVUbyh2aWV3TW9kZWw6IFZpZXdNb2RlbCwgbGluZU51bWJlcjogbnVtYmVyLCBjb2x1bW46IG51bWJlciwgaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuID0gZmFsc2UpIHtcblx0aWYgKGluU2VsZWN0aW9uTW9kZSkge1xuXHRcdENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuTW92ZVRvU2VsZWN0LnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge1xuXHRcdFx0cG9zaXRpb246IG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyLCBjb2x1bW4pXG5cdFx0fSk7XG5cdH0gZWxzZSB7XG5cdFx0Q29yZU5hdmlnYXRpb25Db21tYW5kcy5Nb3ZlVG8ucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7XG5cdFx0XHRwb3NpdGlvbjogbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIGNvbHVtbilcblx0XHR9KTtcblx0fVxufVxuXG5mdW5jdGlvbiBtb3ZlVG9FbmRPZkxpbmUodmlld01vZGVsOiBWaWV3TW9kZWwsIGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbiA9IGZhbHNlKSB7XG5cdGlmIChpblNlbGVjdGlvbk1vZGUpIHtcblx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckVuZFNlbGVjdC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0fSBlbHNlIHtcblx0XHRDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckVuZC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHt9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsYUFBYTtBQUV0QixTQUFTLGtCQUFrQjtBQUUzQixTQUEwQiwwQkFBMEI7QUFFcEQsTUFBTSw0QkFBNEIsTUFBTTtBQUV2QywwQ0FBd0M7QUFFeEMsUUFBTSxPQUFPO0FBQUEsSUFDWjtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNELEVBQUUsS0FBSyxJQUFJO0FBRVgsV0FBUyxZQUFZLFVBQXlFO0FBQzdGLHVCQUFtQixNQUFNLENBQUMsR0FBRyxDQUFDLFFBQVEsY0FBYztBQUNuRCxlQUFTLFFBQVEsU0FBUztBQUFBLElBQzNCLENBQUM7QUFBQSxFQUNGO0FBRUEsT0FBSywyQ0FBMkMsTUFBTTtBQUNyRCxnQkFBWSxDQUFDLFFBQVEsY0FBYztBQUNsQyxhQUFPLFdBQVcsR0FBRyxDQUFDO0FBQ3RCLGVBQVMsU0FBUztBQUNsQixrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUFBLElBQzVCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLGlEQUFpRCxNQUFNO0FBQzNELGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGFBQU8sV0FBVyxHQUFHLENBQUM7QUFDdEIsZUFBUyxXQUFXLENBQUM7QUFDckIsa0JBQVksV0FBVyxHQUFHLENBQUM7QUFBQSxJQUM1QixDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyw4Q0FBOEMsTUFBTTtBQUN4RCxnQkFBWSxDQUFDLFFBQVEsY0FBYztBQUNsQyxhQUFPLFdBQVcsR0FBRyxDQUFDO0FBQ3RCLGVBQVMsV0FBVyxHQUFHLFdBQVcsUUFBUSxRQUFRO0FBQ2xELGtCQUFZLFdBQVcsR0FBRyxDQUFDO0FBQUEsSUFDNUIsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssb0NBQW9DLE1BQU07QUFDOUMsZ0JBQVksQ0FBQyxRQUFRLGNBQWM7QUFDbEMsYUFBTyxXQUFXLEdBQUcsQ0FBQztBQUN0QixlQUFTLFdBQVcsRUFBRTtBQUN0QixrQkFBWSxXQUFXLEdBQUcsRUFBRTtBQUFBLElBQzdCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLDZDQUE2QyxNQUFNO0FBQ3ZELGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGFBQU8sV0FBVyxHQUFHLENBQUM7QUFDdEIsZ0JBQVUsU0FBUztBQUNuQixrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUFBLElBQzVCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLG1EQUFtRCxNQUFNO0FBQzdELGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGFBQU8sV0FBVyxHQUFHLENBQUM7QUFDdEIsZ0JBQVUsV0FBVyxDQUFDO0FBQ3RCLGtCQUFZLFdBQVcsR0FBRyxDQUFDO0FBQUEsSUFDNUIsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssZ0RBQWdELE1BQU07QUFDMUQsZ0JBQVksQ0FBQyxRQUFRLGNBQWM7QUFDbEMsYUFBTyxXQUFXLEdBQUcsQ0FBQztBQUN0QixnQkFBVSxXQUFXLEdBQUcsV0FBVyxRQUFRLFFBQVE7QUFDbkQsa0JBQVksV0FBVyxHQUFHLEVBQUU7QUFBQSxJQUM3QixDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyxpQ0FBaUMsTUFBTTtBQUMzQyxnQkFBWSxDQUFDLFFBQVEsY0FBYztBQUNsQyxhQUFPLFdBQVcsR0FBRyxDQUFDO0FBQ3RCLGdCQUFVLFdBQVcsR0FBRztBQUN4QixrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUFBLElBQzVCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLCtDQUErQyxNQUFNO0FBQ3pELGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGFBQU8sV0FBVyxHQUFHLENBQUM7QUFDdEIsc0JBQWdCLFNBQVM7QUFDekIsa0JBQVksV0FBVyxHQUFHLENBQUM7QUFBQSxJQUM1QixDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyx3RUFBd0UsTUFBTTtBQUNsRixnQkFBWSxDQUFDLFFBQVEsY0FBYztBQUNsQyxhQUFPLFdBQVcsR0FBRyxDQUFDO0FBQ3RCLHNCQUFnQixTQUFTO0FBQ3pCLGtCQUFZLFdBQVcsR0FBRyxDQUFDO0FBQUEsSUFDNUIsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssd0RBQXdELE1BQU07QUFDbEUsZ0JBQVksQ0FBQyxRQUFRLGNBQWM7QUFDbEMsYUFBTyxXQUFXLEdBQUcsQ0FBQztBQUN0QixzQkFBZ0IsU0FBUztBQUN6QixrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUFBLElBQzVCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLCtEQUErRCxNQUFNO0FBQ3pFLGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGFBQU8sV0FBVyxHQUFHLENBQUM7QUFDdEIsNENBQXNDLFNBQVM7QUFDL0Msa0JBQVksV0FBVyxHQUFHLENBQUM7QUFBQSxJQUM1QixDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyx3RkFBd0YsTUFBTTtBQUNsRyxnQkFBWSxDQUFDLFFBQVEsY0FBYztBQUNsQyxhQUFPLFdBQVcsR0FBRyxDQUFDO0FBQ3RCLDRDQUFzQyxTQUFTO0FBQy9DLGtCQUFZLFdBQVcsR0FBRyxDQUFDO0FBQUEsSUFDNUIsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssd0VBQXdFLE1BQU07QUFDbEYsZ0JBQVksQ0FBQyxRQUFRLGNBQWM7QUFDbEMsYUFBTyxXQUFXLEdBQUcsQ0FBQztBQUN0Qiw0Q0FBc0MsU0FBUztBQUMvQyxrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUFBLElBQzVCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLG1DQUFtQyxNQUFNO0FBQzdDLGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGFBQU8sV0FBVyxHQUFHLENBQUM7QUFDdEIsb0JBQWMsU0FBUztBQUN2QixrQkFBWSxXQUFXLEdBQUcsRUFBRTtBQUFBLElBQzdCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLDJEQUEyRCxNQUFNO0FBQ3JFLGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGFBQU8sV0FBVyxHQUFHLEVBQUU7QUFDdkIsb0JBQWMsU0FBUztBQUN2QixrQkFBWSxXQUFXLEdBQUcsRUFBRTtBQUFBLElBQzdCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLHFDQUFxQyxNQUFNO0FBQy9DLGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGFBQU8sV0FBVyxHQUFHLEVBQUU7QUFDdkIsb0JBQWMsU0FBUztBQUN2QixrQkFBWSxXQUFXLEdBQUcsRUFBRTtBQUFBLElBQzdCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLHNEQUFzRCxNQUFNO0FBQ2hFLGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGFBQU8sV0FBVyxHQUFHLENBQUM7QUFDdEIsMkNBQXFDLFNBQVM7QUFDOUMsa0JBQVksV0FBVyxHQUFHLEVBQUU7QUFBQSxJQUM3QixDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyw4RUFBOEUsTUFBTTtBQUN4RixnQkFBWSxDQUFDLFFBQVEsY0FBYztBQUNsQyxhQUFPLFdBQVcsR0FBRyxFQUFFO0FBQ3ZCLDJDQUFxQyxTQUFTO0FBQzlDLGtCQUFZLFdBQVcsR0FBRyxFQUFFO0FBQUEsSUFDN0IsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssd0RBQXdELE1BQU07QUFDbEUsZ0JBQVksQ0FBQyxRQUFRLGNBQWM7QUFDbEMsYUFBTyxXQUFXLEdBQUcsRUFBRTtBQUN2QiwyQ0FBcUMsU0FBUztBQUM5QyxrQkFBWSxXQUFXLEdBQUcsRUFBRTtBQUFBLElBQzdCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLDBDQUEwQyxNQUFNO0FBQ3BELGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGFBQU8sV0FBVyxHQUFHLENBQUM7QUFDdEIsdUJBQWlCLFNBQVM7QUFDMUIsa0JBQVksV0FBVyxHQUFHLEVBQUU7QUFBQSxJQUM3QixDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyxzQ0FBc0MsTUFBTTtBQUNoRCxnQkFBWSxDQUFDLFFBQVEsY0FBYztBQUNsQyxhQUFPLFdBQVcsR0FBRyxFQUFFO0FBQ3ZCLHVCQUFpQixTQUFTO0FBQzFCLGtCQUFZLFdBQVcsR0FBRyxFQUFFO0FBQUEsSUFDN0IsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUsscUNBQXFDLE1BQU07QUFDL0MsZ0JBQVksQ0FBQyxRQUFRLGNBQWM7QUFDbEMsc0JBQWdCLFNBQVM7QUFDekIsdUJBQWlCLFNBQVM7QUFDMUIsa0JBQVksV0FBVyxHQUFHLEVBQUU7QUFBQSxJQUM3QixDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyxtQ0FBbUMsTUFBTTtBQUM3QyxnQkFBWSxDQUFDLFFBQVEsY0FBYztBQUNsQyxvQkFBYyxTQUFTO0FBQ3ZCLHVCQUFpQixTQUFTO0FBQzFCLGtCQUFZLFdBQVcsR0FBRyxFQUFFO0FBQUEsSUFDN0IsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssa0NBQWtDLE1BQU07QUFDNUMsZ0JBQVksQ0FBQyxRQUFRLGNBQWM7QUFDbEMsYUFBTyxXQUFXLEdBQUcsQ0FBQztBQUN0QixrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUUzQixhQUFPLFdBQVcsQ0FBQztBQUNuQixrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUUzQixhQUFPLFdBQVcsQ0FBQztBQUNuQixrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUFBLElBQzVCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLDZDQUE2QyxNQUFNO0FBQ3ZELGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGFBQU8sV0FBVyxHQUFHLENBQUM7QUFDdEIsa0JBQVksV0FBVyxHQUFHLENBQUM7QUFFM0Isd0JBQWtCLFdBQVcsQ0FBQztBQUM5QixrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUUzQix3QkFBa0IsV0FBVyxDQUFDO0FBQzlCLGtCQUFZLFdBQVcsR0FBRyxDQUFDO0FBQUEsSUFDNUIsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssK0NBQStDLE1BQU07QUFDekQsZ0JBQVksQ0FBQyxRQUFRLGNBQWM7QUFDbEMsYUFBTyxXQUFXLEdBQUcsQ0FBQztBQUN0QixrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUUzQiwwQkFBb0IsV0FBVyxDQUFDO0FBQ2hDLGtCQUFZLFdBQVcsR0FBRyxDQUFDO0FBRTNCLDBCQUFvQixXQUFXLENBQUM7QUFDaEMsa0JBQVksV0FBVyxHQUFHLENBQUM7QUFBQSxJQUM1QixDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyxpREFBaUQsTUFBTTtBQUMzRCxnQkFBWSxDQUFDLFFBQVEsY0FBYztBQUNsQyxhQUFPLFdBQVcsR0FBRyxDQUFDO0FBQ3RCLGtCQUFZLFdBQVcsR0FBRyxDQUFDO0FBRTNCLGFBQU8sV0FBVyxHQUFHLElBQUk7QUFDekIsa0JBQVksV0FBVyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBRWpDLGFBQU8sV0FBVyxHQUFHLElBQUk7QUFDekIsa0JBQVksV0FBVyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsSUFDbEMsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUsscURBQXFELE1BQU07QUFDL0QsZ0JBQVksQ0FBQyxRQUFRLGNBQWM7QUFDbEMsYUFBTyxXQUFXLEdBQUcsQ0FBQztBQUN0QixrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUUzQixlQUFTLFdBQVcsQ0FBQztBQUNyQixrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUUzQixhQUFPLFdBQVcsQ0FBQztBQUNuQixrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUUzQixhQUFPLFdBQVcsQ0FBQztBQUNuQixrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUUzQixhQUFPLFdBQVcsQ0FBQztBQUNuQixrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUUzQixhQUFPLFdBQVcsQ0FBQztBQUNuQixrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUFBLElBQzVCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLHNGQUFzRixNQUFNO0FBQ2hHLGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLHNCQUFnQixTQUFTO0FBQ3pCLGtCQUFZLFdBQVcsR0FBRyxFQUFFO0FBRTVCLHNCQUFnQixTQUFTO0FBQ3pCLGtCQUFZLFdBQVcsR0FBRyxFQUFFO0FBRTVCLGVBQVMsV0FBVyxDQUFDO0FBQ3JCLGtCQUFZLFdBQVcsR0FBRyxFQUFFO0FBRTVCLGVBQVMsV0FBVyxDQUFDO0FBQ3JCLGtCQUFZLFdBQVcsR0FBRyxDQUFDO0FBRTNCLGVBQVMsV0FBVyxDQUFDO0FBQ3JCLGtCQUFZLFdBQVcsR0FBRyxDQUFDO0FBRTNCLGFBQU8sV0FBVyxDQUFDO0FBQ25CLGtCQUFZLFdBQVcsR0FBRyxFQUFFO0FBQUEsSUFDN0IsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUsseUVBQXlFLE1BQU07QUFDbkYsZ0JBQVksQ0FBQyxRQUFRLGNBQWM7QUFDbEMsZ0JBQVUsZ0NBQWdDLE1BQU0sSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUM7QUFFckUsYUFBTyxXQUFXLEdBQUcsQ0FBQztBQUN0QixnQkFBVSxTQUFTO0FBRW5CLGtCQUFZLFdBQVcsR0FBRyxDQUFDO0FBQUEsSUFDNUIsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssa0ZBQWtGLE1BQU07QUFDNUYsZ0JBQVksQ0FBQyxRQUFRLGNBQWM7QUFDbEMsZ0JBQVUsZ0NBQWdDLE1BQU0sSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUM7QUFFckUsYUFBTyxXQUFXLEdBQUcsQ0FBQztBQUN0QixnQkFBVSxTQUFTO0FBRW5CLGtCQUFZLFdBQVcsR0FBRyxDQUFDO0FBQUEsSUFDNUIsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssb0RBQW9ELE1BQU07QUFDOUQsZ0JBQVksQ0FBQyxRQUFRLGNBQWM7QUFDbEMsZ0JBQVUsZ0NBQWdDLE1BQU0sSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUM7QUFFckUsYUFBTyxXQUFXLEdBQUcsQ0FBQztBQUN0QixnQkFBVSxXQUFXLENBQUM7QUFFdEIsa0JBQVksV0FBVyxHQUFHLENBQUM7QUFBQSxJQUM1QixDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSywwRkFBMEYsTUFBTTtBQUNwRyxnQkFBWSxDQUFDLFFBQVEsY0FBYztBQUNsQyxnQkFBVSxnQ0FBZ0MsTUFBTSxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUVwRSxhQUFPLFdBQVcsR0FBRyxDQUFDO0FBQ3RCLGdCQUFVLFdBQVcsQ0FBQztBQUV0QixrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUFBLElBQzVCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLHFEQUFxRCxNQUFNO0FBQy9ELGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGdCQUFVLGdDQUFnQyxNQUFNLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBRXBFLGFBQU8sV0FBVyxHQUFHLENBQUM7QUFDdEIsbUJBQWEsU0FBUztBQUV0QixrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUFBLElBQzVCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLDBFQUEwRSxNQUFNO0FBQ3BGLGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGdCQUFVLGdDQUFnQyxNQUFNLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBRXBFLGFBQU8sV0FBVyxHQUFHLENBQUM7QUFDdEIsbUJBQWEsU0FBUztBQUV0QixrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUFBLElBQzVCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLHFGQUFxRixNQUFNO0FBQy9GLGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGdCQUFVLGdDQUFnQyxNQUFNLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBRXBFLGFBQU8sV0FBVyxHQUFHLENBQUM7QUFDdEIsbUJBQWEsU0FBUztBQUV0QixrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUFBLElBQzVCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLDBEQUEwRCxNQUFNO0FBQ3BFLGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGdCQUFVLGdDQUFnQyxNQUFNLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBRXBFLGFBQU8sV0FBVyxHQUFHLENBQUM7QUFDdEIsbUJBQWEsV0FBVyxDQUFDO0FBRXpCLGtCQUFZLFdBQVcsR0FBRyxDQUFDO0FBQUEsSUFDNUIsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssOEZBQThGLE1BQU07QUFDeEcsZ0JBQVksQ0FBQyxRQUFRLGNBQWM7QUFDbEMsZ0JBQVUsZ0NBQWdDLE1BQU0sSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFFcEUsYUFBTyxXQUFXLEdBQUcsQ0FBQztBQUN0QixtQkFBYSxXQUFXLENBQUM7QUFFekIsa0JBQVksV0FBVyxHQUFHLENBQUM7QUFBQSxJQUM1QixDQUFDO0FBQUEsRUFDRixDQUFDO0FBQ0YsQ0FBQztBQUVELE1BQU0saUNBQWlDLE1BQU07QUFFNUMsMENBQXdDO0FBRXhDLFFBQU0sT0FBTztBQUFBLElBQ1o7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsRUFDRCxFQUFFLEtBQUssSUFBSTtBQUVYLFdBQVMsWUFBWSxVQUF5RTtBQUM3Rix1QkFBbUIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxRQUFRLGNBQWM7QUFDbkQsZUFBUyxRQUFRLFNBQVM7QUFBQSxJQUMzQixDQUFDO0FBQUEsRUFDRjtBQUVBLE9BQUsscURBQXFELE1BQU07QUFDL0QsZ0JBQVksQ0FBQyxRQUFRLGNBQWM7QUFDbEMsMEJBQW9CLFdBQVcsS0FBSztBQUNwQyxrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUFBLElBQzVCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLHVEQUF1RCxNQUFNO0FBQ2pFLGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGFBQU8sV0FBVyxHQUFHLENBQUM7QUFDdEIsd0JBQWtCLFdBQVcsS0FBSztBQUNsQyxrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUFBLElBQzVCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLGtFQUFrRSxNQUFNO0FBQzVFLGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGFBQU8sV0FBVyxHQUFHLENBQUM7QUFDdEIsMEJBQW9CLFdBQVcsS0FBSztBQUNwQyxrQkFBWSxXQUFXLElBQUksQ0FBQztBQUFBLElBQzdCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLGdFQUFnRSxNQUFNO0FBQzFFLGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGFBQU8sV0FBVyxHQUFHLENBQUM7QUFDdEIsd0JBQWtCLFdBQVcsS0FBSztBQUNsQyxrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUFBLElBQzVCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLGdFQUFnRSxNQUFNO0FBQzFFLGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGFBQU8sV0FBVyxHQUFHLENBQUM7QUFDdEIsd0JBQWtCLFdBQVcsS0FBSztBQUNsQyxrQkFBWSxXQUFXLEdBQUcsQ0FBQztBQUFBLElBQzVCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLGlFQUFpRSxNQUFNO0FBQzNFLGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGFBQU8sV0FBVyxJQUFJLENBQUM7QUFDdkIsMEJBQW9CLFdBQVcsS0FBSztBQUNwQyxrQkFBWSxXQUFXLElBQUksQ0FBQztBQUFBLElBQzdCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLHlEQUF5RCxNQUFNO0FBQ25FLGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLDBCQUFvQixXQUFXLElBQUk7QUFDbkMscUJBQWUsVUFBVSxhQUFhLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3BELENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLDJEQUEyRCxNQUFNO0FBQ3JFLGdCQUFZLENBQUMsUUFBUSxjQUFjO0FBQ2xDLGFBQU8sV0FBVyxHQUFHLENBQUM7QUFDdEIsd0JBQWtCLFdBQVcsSUFBSTtBQUNqQyxxQkFBZSxVQUFVLGFBQWEsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsSUFDcEQsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUNGLENBQUM7QUFJRCxTQUFTLEtBQUssV0FBc0IsTUFBVztBQUM5Qyx5QkFBdUIsV0FBVyxxQkFBcUIsV0FBVyxJQUFJO0FBQ3ZFO0FBRUEsU0FBUyxnQkFBZ0IsV0FBc0I7QUFDOUMsT0FBSyxXQUFXLEVBQUUsSUFBSSxXQUFXLGFBQWEsaUJBQWlCLENBQUM7QUFDakU7QUFFQSxTQUFTLHNDQUFzQyxXQUFzQjtBQUNwRSxPQUFLLFdBQVcsRUFBRSxJQUFJLFdBQVcsYUFBYSx1Q0FBdUMsQ0FBQztBQUN2RjtBQUVBLFNBQVMsaUJBQWlCLFdBQXNCO0FBQy9DLE9BQUssV0FBVyxFQUFFLElBQUksV0FBVyxhQUFhLHdCQUF3QixDQUFDO0FBQ3hFO0FBRUEsU0FBUyxjQUFjLFdBQXNCO0FBQzVDLE9BQUssV0FBVyxFQUFFLElBQUksV0FBVyxhQUFhLGVBQWUsQ0FBQztBQUMvRDtBQUVBLFNBQVMscUNBQXFDLFdBQXNCO0FBQ25FLE9BQUssV0FBVyxFQUFFLElBQUksV0FBVyxhQUFhLHNDQUFzQyxDQUFDO0FBQ3RGO0FBRUEsU0FBUyxTQUFTLFdBQXNCLE9BQWdCLElBQWEsUUFBa0I7QUFDdEYsT0FBSyxXQUFXLEVBQUUsSUFBSSxXQUFXLGFBQWEsTUFBTSxJQUFRLE9BQWMsT0FBZSxDQUFDO0FBQzNGO0FBRUEsU0FBUyxVQUFVLFdBQXNCLE9BQWdCLElBQWEsUUFBa0I7QUFDdkYsT0FBSyxXQUFXLEVBQUUsSUFBSSxXQUFXLGFBQWEsT0FBTyxJQUFRLE9BQWMsT0FBZSxDQUFDO0FBQzVGO0FBRUEsU0FBUyxPQUFPLFdBQXNCLFlBQW9CLEdBQUcsUUFBa0I7QUFDOUUsT0FBSyxXQUFXLEVBQUUsSUFBSSxXQUFXLGFBQWEsSUFBSSxJQUFJLFdBQVcsUUFBUSxhQUFhLE9BQU8sV0FBVyxPQUFlLENBQUM7QUFDekg7QUFFQSxTQUFTLGtCQUFrQixXQUFzQixRQUFrQjtBQUNsRSxPQUFLLFdBQVcsRUFBRSxJQUFJLFdBQVcsYUFBYSxlQUFlLElBQUksV0FBVyxRQUFRLGFBQWEsT0FBZSxDQUFDO0FBQ2xIO0FBRUEsU0FBUyxrQkFBa0IsV0FBc0IsWUFBb0IsR0FBRyxRQUFrQjtBQUN6RixPQUFLLFdBQVcsRUFBRSxJQUFJLFdBQVcsYUFBYSxJQUFJLE9BQU8sV0FBVyxPQUFlLENBQUM7QUFDckY7QUFFQSxTQUFTLFNBQVMsV0FBc0IsWUFBb0IsR0FBRyxRQUFrQjtBQUNoRixPQUFLLFdBQVcsRUFBRSxJQUFJLFdBQVcsYUFBYSxNQUFNLElBQUksV0FBVyxRQUFRLGFBQWEsT0FBTyxXQUFXLE9BQWUsQ0FBQztBQUMzSDtBQUVBLFNBQVMsb0JBQW9CLFdBQXNCLFFBQWtCO0FBQ3BFLE9BQUssV0FBVyxFQUFFLElBQUksV0FBVyxhQUFhLGVBQWUsSUFBSSxXQUFXLFFBQVEsYUFBYSxPQUFlLENBQUM7QUFDbEg7QUFFQSxTQUFTLG9CQUFvQixXQUFzQixZQUFvQixHQUFHLFFBQWtCO0FBQzNGLE9BQUssV0FBVyxFQUFFLElBQUksV0FBVyxhQUFhLE1BQU0sT0FBTyxXQUFXLE9BQWUsQ0FBQztBQUN2RjtBQUVBLFNBQVMsVUFBVSxXQUFzQixZQUFvQixHQUFHLFFBQWtCO0FBQ2pGLE9BQUssV0FBVyxFQUFFLElBQUksV0FBVyxhQUFhLGFBQWEsT0FBTyxXQUFXLE9BQWUsQ0FBQztBQUM5RjtBQUVBLFNBQVMsYUFBYSxXQUFzQixRQUFrQjtBQUM3RCxPQUFLLFdBQVcsRUFBRSxJQUFJLFdBQVcsYUFBYSxnQkFBZ0IsT0FBZSxDQUFDO0FBQy9FO0FBRUEsU0FBUyxhQUFhLFdBQXNCLFlBQW9CLEdBQUcsUUFBa0I7QUFDcEYsT0FBSyxXQUFXLEVBQUUsSUFBSSxXQUFXLGFBQWEsZ0JBQWdCLE9BQU8sV0FBVyxPQUFlLENBQUM7QUFDakc7QUFFQSxTQUFTLFlBQVksV0FBc0IsZUFBdUIsV0FBbUIsZ0JBQXdCLGVBQWUsWUFBb0IsV0FBVztBQUMxSixnQkFBYyxVQUFVLFlBQVksR0FBRyxlQUFlLFNBQVM7QUFDL0QsaUJBQWUsVUFBVSxhQUFhLEdBQUcsZUFBZSxXQUFXLGVBQWUsU0FBUztBQUM1RjtBQUVBLFNBQVMsY0FBYyxVQUFvQixZQUFvQixRQUFnQjtBQUM5RSxTQUFPLGdCQUFnQixVQUFVLElBQUksU0FBUyxZQUFZLE1BQU0sR0FBRyxnQkFBZ0I7QUFDcEY7QUFFQSxTQUFTLGVBQWUsV0FBc0IsZUFBdUIsV0FBbUIsZUFBdUIsV0FBbUI7QUFDakksU0FBTyxnQkFBZ0I7QUFBQSxJQUN0QiwwQkFBMEIsVUFBVTtBQUFBLElBQ3BDLHNCQUFzQixVQUFVO0FBQUEsSUFDaEMsb0JBQW9CLFVBQVU7QUFBQSxJQUM5QixnQkFBZ0IsVUFBVTtBQUFBLEVBQzNCLEdBQUc7QUFBQSxJQUNGLDBCQUEwQjtBQUFBLElBQzFCLHNCQUFzQjtBQUFBLElBQ3RCLG9CQUFvQjtBQUFBLElBQ3BCLGdCQUFnQjtBQUFBLEVBQ2pCLEdBQUcsaUJBQWlCO0FBQ3JCO0FBRUEsU0FBUyxPQUFPLFdBQXNCLFlBQW9CLFFBQWdCLGtCQUEyQixPQUFPO0FBQzNHLE1BQUksaUJBQWlCO0FBQ3BCLDJCQUF1QixhQUFhLHFCQUFxQixXQUFXO0FBQUEsTUFDbkUsVUFBVSxJQUFJLFNBQVMsWUFBWSxNQUFNO0FBQUEsSUFDMUMsQ0FBQztBQUFBLEVBQ0YsT0FBTztBQUNOLDJCQUF1QixPQUFPLHFCQUFxQixXQUFXO0FBQUEsTUFDN0QsVUFBVSxJQUFJLFNBQVMsWUFBWSxNQUFNO0FBQUEsSUFDMUMsQ0FBQztBQUFBLEVBQ0Y7QUFDRDtBQUVBLFNBQVMsZ0JBQWdCLFdBQXNCLGtCQUEyQixPQUFPO0FBQ2hGLE1BQUksaUJBQWlCO0FBQ3BCLDJCQUF1QixnQkFBZ0IscUJBQXFCLFdBQVcsQ0FBQyxDQUFDO0FBQUEsRUFDMUUsT0FBTztBQUNOLDJCQUF1QixVQUFVLHFCQUFxQixXQUFXLENBQUMsQ0FBQztBQUFBLEVBQ3BFO0FBQ0Q7IiwKICAibmFtZXMiOiBbXQp9Cg==
