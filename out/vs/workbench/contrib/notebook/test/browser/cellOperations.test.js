import assert from "assert";
import { FoldingModel, updateFoldingStateAtIndex } from "../../browser/viewModel/foldingModel.js";
import { changeCellToKind, computeCellLinesContents, copyCellRange, insertCell, joinNotebookCells, moveCellRange, runDeleteAction } from "../../browser/controller/cellOperations.js";
import { CellEditType, CellKind, SelectionStateType } from "../../common/notebookCommon.js";
import { withTestNotebook } from "./testNotebookEditor.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { ResourceTextEdit } from "../../../../../editor/browser/services/bulkEditService.js";
import { ResourceNotebookCellEdit } from "../../../bulkEdit/browser/bulkCellEdits.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { ValidAnnotatedEditOperation } from "../../../../../editor/common/model.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
suite("CellOperations", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("Move cells - single cell", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        viewModel.updateSelectionsState({ kind: SelectionStateType.Index, focus: { start: 1, end: 2 }, selections: [{ start: 1, end: 2 }] });
        const cell = viewModel.cellAt(1);
        assert.ok(cell);
        await moveCellRange({ notebookEditor: editor, cell }, "down");
        assert.strictEqual(viewModel.cellAt(2)?.getText(), "var b = 1;");
        assert.strictEqual(cell, viewModel.cellAt(2));
      }
    );
  });
  test("Move cells - multiple cells in a selection", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        viewModel.updateSelectionsState({ kind: SelectionStateType.Index, focus: { start: 1, end: 2 }, selections: [{ start: 0, end: 2 }] });
        await moveCellRange({ notebookEditor: editor }, "down");
        assert.strictEqual(viewModel.cellAt(0)?.getText(), "# header b");
        assert.strictEqual(viewModel.cellAt(1)?.getText(), "# header a");
        assert.strictEqual(viewModel.cellAt(2)?.getText(), "var b = 1;");
      }
    );
  });
  test("Move cells - move with folding ranges", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel, ds) => {
        const foldingModel = ds.add(new FoldingModel());
        foldingModel.attachViewModel(viewModel);
        updateFoldingStateAtIndex(foldingModel, 0, true);
        updateFoldingStateAtIndex(foldingModel, 1, true);
        viewModel.updateFoldingRanges(foldingModel.regions);
        editor.setHiddenAreas([{ start: 1, end: 2 }]);
        editor.setHiddenAreas(viewModel.getHiddenRanges());
        viewModel.updateSelectionsState({ kind: SelectionStateType.Index, focus: { start: 0, end: 1 }, selections: [{ start: 0, end: 1 }] });
        await moveCellRange({ notebookEditor: editor }, "down");
        assert.strictEqual(viewModel.cellAt(0)?.getText(), "# header b");
        assert.strictEqual(viewModel.cellAt(1)?.getText(), "# header a");
        assert.strictEqual(viewModel.cellAt(2)?.getText(), "var b = 1;");
      }
    );
  });
  test("Copy/duplicate cells - single cell", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        viewModel.updateSelectionsState({ kind: SelectionStateType.Index, focus: { start: 1, end: 2 }, selections: [{ start: 1, end: 2 }] });
        await copyCellRange({ notebookEditor: editor, cell: viewModel.cellAt(1) }, "down");
        assert.strictEqual(viewModel.length, 6);
        assert.strictEqual(viewModel.cellAt(1)?.getText(), "var b = 1;");
        assert.strictEqual(viewModel.cellAt(2)?.getText(), "var b = 1;");
      }
    );
  });
  test("Copy/duplicate cells - target and selection are different, #119769", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        viewModel.updateSelectionsState({ kind: SelectionStateType.Index, focus: { start: 0, end: 1 }, selections: [{ start: 0, end: 1 }] });
        await copyCellRange({ notebookEditor: editor, cell: viewModel.cellAt(1), ui: true }, "down");
        assert.strictEqual(viewModel.length, 6);
        assert.strictEqual(viewModel.cellAt(1)?.getText(), "var b = 1;");
        assert.strictEqual(viewModel.cellAt(2)?.getText(), "var b = 1;");
      }
    );
  });
  test("Copy/duplicate cells - multiple cells in a selection", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        viewModel.updateSelectionsState({ kind: SelectionStateType.Index, focus: { start: 1, end: 2 }, selections: [{ start: 0, end: 2 }] });
        await copyCellRange({ notebookEditor: editor, cell: viewModel.cellAt(1) }, "down");
        assert.strictEqual(viewModel.length, 7);
        assert.strictEqual(viewModel.cellAt(0)?.getText(), "# header a");
        assert.strictEqual(viewModel.cellAt(1)?.getText(), "var b = 1;");
        assert.strictEqual(viewModel.cellAt(2)?.getText(), "# header a");
        assert.strictEqual(viewModel.cellAt(3)?.getText(), "var b = 1;");
      }
    );
  });
  test("Copy/duplicate cells - move with folding ranges", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel, ds) => {
        const foldingModel = ds.add(new FoldingModel());
        foldingModel.attachViewModel(viewModel);
        updateFoldingStateAtIndex(foldingModel, 0, true);
        updateFoldingStateAtIndex(foldingModel, 1, true);
        viewModel.updateFoldingRanges(foldingModel.regions);
        editor.setHiddenAreas([{ start: 1, end: 2 }]);
        editor.setHiddenAreas(viewModel.getHiddenRanges());
        viewModel.updateSelectionsState({ kind: SelectionStateType.Index, focus: { start: 0, end: 1 }, selections: [{ start: 0, end: 1 }] });
        await copyCellRange({ notebookEditor: editor, cell: viewModel.cellAt(1) }, "down");
        assert.strictEqual(viewModel.length, 7);
        assert.strictEqual(viewModel.cellAt(0)?.getText(), "# header a");
        assert.strictEqual(viewModel.cellAt(1)?.getText(), "var b = 1;");
        assert.strictEqual(viewModel.cellAt(2)?.getText(), "# header a");
        assert.strictEqual(viewModel.cellAt(3)?.getText(), "var b = 1;");
      }
    );
  });
  test("Copy/duplicate cells - should not share the same text buffer #102423", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        viewModel.updateSelectionsState({ kind: SelectionStateType.Index, focus: { start: 1, end: 2 }, selections: [{ start: 1, end: 2 }] });
        await copyCellRange({ notebookEditor: editor, cell: viewModel.cellAt(1) }, "down");
        assert.strictEqual(viewModel.length, 3);
        const cell1 = viewModel.cellAt(1);
        const cell2 = viewModel.cellAt(2);
        assert.ok(cell1);
        assert.ok(cell2);
        assert.strictEqual(cell1.getText(), "var b = 1;");
        assert.strictEqual(viewModel.cellAt(2)?.getText(), "var b = 1;");
        cell1.textBuffer.applyEdits([
          new ValidAnnotatedEditOperation(null, new Range(1, 1, 1, 4), "", false, false, false)
        ], false, true);
        assert.notStrictEqual(cell1.getText(), cell2.getText());
      }
    );
  });
  test("Join cell with below - single cell", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel, accessor) => {
        viewModel.updateSelectionsState({ kind: SelectionStateType.Index, focus: { start: 3, end: 4 }, selections: [{ start: 3, end: 4 }] });
        const ret = await joinNotebookCells(editor, { start: 3, end: 4 }, "below");
        assert.strictEqual(ret?.edits.length, 2);
        assert.deepStrictEqual(ret?.edits[0], new ResourceTextEdit(viewModel.cellAt(3).uri, {
          range: new Range(1, 11, 1, 11),
          text: viewModel.cellAt(4).textBuffer.getEOL() + "var c = 3;"
        }));
        assert.deepStrictEqual(ret?.edits[1], new ResourceNotebookCellEdit(
          editor.textModel.uri,
          {
            editType: CellEditType.Replace,
            index: 4,
            count: 1,
            cells: []
          }
        ));
      }
    );
  });
  test("Join cell with above - single cell", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel, accessor) => {
        viewModel.updateSelectionsState({ kind: SelectionStateType.Index, focus: { start: 3, end: 4 }, selections: [{ start: 3, end: 4 }] });
        const ret = await joinNotebookCells(editor, { start: 4, end: 5 }, "above");
        assert.strictEqual(ret?.edits.length, 2);
        assert.deepStrictEqual(ret?.edits[0], new ResourceTextEdit(viewModel.cellAt(3).uri, {
          range: new Range(1, 11, 1, 11),
          text: viewModel.cellAt(4).textBuffer.getEOL() + "var c = 3;"
        }));
        assert.deepStrictEqual(ret?.edits[1], new ResourceNotebookCellEdit(
          editor.textModel.uri,
          {
            editType: CellEditType.Replace,
            index: 4,
            count: 1,
            cells: []
          }
        ));
      }
    );
  });
  test("Join cell with below - multiple cells", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel, accessor) => {
        viewModel.updateSelectionsState({ kind: SelectionStateType.Index, focus: { start: 1, end: 2 }, selections: [{ start: 0, end: 2 }] });
        const ret = await joinNotebookCells(editor, { start: 0, end: 2 }, "below");
        assert.strictEqual(ret?.edits.length, 2);
        assert.deepStrictEqual(ret?.edits[0], new ResourceTextEdit(viewModel.cellAt(0).uri, {
          range: new Range(1, 11, 1, 11),
          text: viewModel.cellAt(1).textBuffer.getEOL() + "var b = 2;" + viewModel.cellAt(2).textBuffer.getEOL() + "var c = 3;"
        }));
        assert.deepStrictEqual(ret?.edits[1], new ResourceNotebookCellEdit(
          editor.textModel.uri,
          {
            editType: CellEditType.Replace,
            index: 1,
            count: 2,
            cells: []
          }
        ));
      }
    );
  });
  test("Join cell with above - multiple cells", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel, accessor) => {
        viewModel.updateSelectionsState({ kind: SelectionStateType.Index, focus: { start: 2, end: 3 }, selections: [{ start: 1, end: 3 }] });
        const ret = await joinNotebookCells(editor, { start: 1, end: 3 }, "above");
        assert.strictEqual(ret?.edits.length, 2);
        assert.deepStrictEqual(ret?.edits[0], new ResourceTextEdit(viewModel.cellAt(0).uri, {
          range: new Range(1, 11, 1, 11),
          text: viewModel.cellAt(1).textBuffer.getEOL() + "var b = 2;" + viewModel.cellAt(2).textBuffer.getEOL() + "var c = 3;"
        }));
        assert.deepStrictEqual(ret?.edits[1], new ResourceNotebookCellEdit(
          editor.textModel.uri,
          {
            editType: CellEditType.Replace,
            index: 1,
            count: 2,
            cells: []
          }
        ));
      }
    );
  });
  test("Delete focus cell", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        editor.setFocus({ start: 0, end: 1 });
        editor.setSelections([{ start: 0, end: 1 }]);
        runDeleteAction(editor, viewModel.cellAt(0));
        assert.strictEqual(viewModel.length, 2);
      }
    );
  });
  test("Delete selected cells", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        editor.setFocus({ start: 0, end: 1 });
        editor.setSelections([{ start: 0, end: 2 }]);
        runDeleteAction(editor, viewModel.cellAt(0));
        assert.strictEqual(viewModel.length, 1);
      }
    );
  });
  test("Delete focus cell out of a selection", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}],
        ["var d = 4;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        editor.setFocus({ start: 0, end: 1 });
        editor.setSelections([{ start: 2, end: 4 }]);
        runDeleteAction(editor, viewModel.cellAt(0));
        assert.strictEqual(viewModel.length, 3);
      }
    );
  });
  test("Delete UI target", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        editor.setFocus({ start: 0, end: 1 });
        editor.setSelections([{ start: 0, end: 1 }]);
        runDeleteAction(editor, viewModel.cellAt(2));
        assert.strictEqual(viewModel.length, 2);
        assert.strictEqual(viewModel.cellAt(0)?.getText(), "var a = 1;");
        assert.strictEqual(viewModel.cellAt(1)?.getText(), "var b = 2;");
      }
    );
  });
  test("Delete UI target 2", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}],
        ["var d = 4;", "javascript", CellKind.Code, [], {}],
        ["var e = 5;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        editor.setFocus({ start: 0, end: 1 });
        editor.setSelections([{ start: 0, end: 1 }, { start: 3, end: 5 }]);
        runDeleteAction(editor, viewModel.cellAt(1));
        assert.strictEqual(viewModel.length, 4);
        assert.deepStrictEqual(editor.getFocus(), { start: 0, end: 1 });
        assert.deepStrictEqual(viewModel.getSelections(), [{ start: 0, end: 1 }, { start: 2, end: 4 }]);
      }
    );
  });
  test("Delete UI target 3", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}],
        ["var d = 4;", "javascript", CellKind.Code, [], {}],
        ["var e = 5;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        editor.setFocus({ start: 0, end: 1 });
        editor.setSelections([{ start: 2, end: 3 }]);
        runDeleteAction(editor, viewModel.cellAt(0));
        assert.strictEqual(viewModel.length, 4);
        assert.deepStrictEqual(editor.getFocus(), { start: 0, end: 1 });
        assert.deepStrictEqual(viewModel.getSelections(), [{ start: 1, end: 2 }]);
      }
    );
  });
  test("Delete UI target 4", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}],
        ["var d = 4;", "javascript", CellKind.Code, [], {}],
        ["var e = 5;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        editor.setFocus({ start: 2, end: 3 });
        editor.setSelections([{ start: 3, end: 5 }]);
        runDeleteAction(editor, viewModel.cellAt(0));
        assert.strictEqual(viewModel.length, 4);
        assert.deepStrictEqual(editor.getFocus(), { start: 1, end: 2 });
        assert.deepStrictEqual(viewModel.getSelections(), [{ start: 2, end: 4 }]);
      }
    );
  });
  test("Delete last cell sets selection correctly", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        editor.setFocus({ start: 2, end: 3 });
        editor.setSelections([{ start: 2, end: 3 }]);
        runDeleteAction(editor, viewModel.cellAt(2));
        assert.strictEqual(viewModel.length, 2);
        assert.deepStrictEqual(editor.getFocus(), { start: 1, end: 2 });
      }
    );
  });
  test("#120187. Delete should work on multiple distinct selection", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}],
        ["var d = 4;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        editor.setFocus({ start: 0, end: 1 });
        editor.setSelections([{ start: 0, end: 1 }, { start: 3, end: 4 }]);
        runDeleteAction(editor, viewModel.cellAt(0));
        assert.strictEqual(viewModel.length, 2);
        assert.deepStrictEqual(editor.getFocus(), { start: 0, end: 1 });
      }
    );
  });
  test("#120187. Delete should work on multiple distinct selection 2", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}],
        ["var d = 4;", "javascript", CellKind.Code, [], {}],
        ["var e = 5;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        editor.setFocus({ start: 1, end: 2 });
        editor.setSelections([{ start: 1, end: 2 }, { start: 3, end: 5 }]);
        runDeleteAction(editor, viewModel.cellAt(1));
        assert.strictEqual(viewModel.length, 2);
        assert.deepStrictEqual(editor.getFocus(), { start: 1, end: 2 });
      }
    );
  });
  test("Change cell kind - single cell", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        viewModel.updateSelectionsState({ kind: SelectionStateType.Index, focus: { start: 1, end: 2 }, selections: [{ start: 1, end: 2 }] });
        await changeCellToKind(CellKind.Markup, { notebookEditor: editor, cell: viewModel.cellAt(1), ui: true });
        assert.strictEqual(viewModel.cellAt(1)?.cellKind, CellKind.Markup);
      }
    );
  });
  test("Change cell kind - multi cells", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        viewModel.updateSelectionsState({ kind: SelectionStateType.Index, focus: { start: 1, end: 2 }, selections: [{ start: 1, end: 2 }] });
        await changeCellToKind(CellKind.Markup, { notebookEditor: editor, selectedCells: [viewModel.cellAt(3), viewModel.cellAt(4)], ui: false });
        assert.strictEqual(viewModel.cellAt(3)?.cellKind, CellKind.Markup);
        assert.strictEqual(viewModel.cellAt(4)?.cellKind, CellKind.Markup);
      }
    );
  });
  test("split cell", async function() {
    await withTestNotebook(
      [
        ["var b = 1;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, viewModel) => {
        assert.deepStrictEqual(computeCellLinesContents(viewModel.cellAt(0), [{ lineNumber: 1, column: 4 }]), [
          "var",
          " b = 1;"
        ]);
        assert.deepStrictEqual(computeCellLinesContents(viewModel.cellAt(0), [{ lineNumber: 1, column: 4 }, { lineNumber: 1, column: 6 }]), [
          "var",
          " b",
          " = 1;"
        ]);
        assert.deepStrictEqual(computeCellLinesContents(viewModel.cellAt(0), [{ lineNumber: 1, column: 1 }]), [
          "",
          "var b = 1;"
        ]);
        assert.deepStrictEqual(computeCellLinesContents(viewModel.cellAt(0), [{ lineNumber: 1, column: 11 }]), [
          "var b = 1;",
          ""
        ]);
      }
    );
  });
  test("Insert cell", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel, _ds, accessor) => {
        const languageService = accessor.get(ILanguageService);
        const insertedCellAbove = insertCell(languageService, editor, 4, CellKind.Code, "above", "var a = 0;");
        assert.strictEqual(viewModel.length, 6);
        assert.strictEqual(viewModel.cellAt(4), insertedCellAbove);
        const insertedCellBelow = insertCell(languageService, editor, 1, CellKind.Code, "below", "var a = 0;");
        assert.strictEqual(viewModel.length, 7);
        assert.strictEqual(viewModel.cellAt(2), insertedCellBelow);
      }
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay90ZXN0L2Jyb3dzZXIvY2VsbE9wZXJhdGlvbnMudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IEZvbGRpbmdNb2RlbCwgdXBkYXRlRm9sZGluZ1N0YXRlQXRJbmRleCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvdmlld01vZGVsL2ZvbGRpbmdNb2RlbC5qcyc7XG5pbXBvcnQgeyBjaGFuZ2VDZWxsVG9LaW5kLCBjb21wdXRlQ2VsbExpbmVzQ29udGVudHMsIGNvcHlDZWxsUmFuZ2UsIGluc2VydENlbGwsIGpvaW5Ob3RlYm9va0NlbGxzLCBtb3ZlQ2VsbFJhbmdlLCBydW5EZWxldGVBY3Rpb24gfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnRyb2xsZXIvY2VsbE9wZXJhdGlvbnMuanMnO1xuaW1wb3J0IHsgQ2VsbEVkaXRUeXBlLCBDZWxsS2luZCwgU2VsZWN0aW9uU3RhdGVUeXBlIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IHdpdGhUZXN0Tm90ZWJvb2sgfSBmcm9tICcuL3Rlc3ROb3RlYm9va0VkaXRvci5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZVRleHRFZGl0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvYnVsa0VkaXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFJlc291cmNlTm90ZWJvb2tDZWxsRWRpdCB9IGZyb20gJy4uLy4uLy4uL2J1bGtFZGl0L2Jyb3dzZXIvYnVsa0NlbGxFZGl0cy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSVRleHRCdWZmZXIsIFZhbGlkQW5ub3RhdGVkRWRpdE9wZXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cbnN1aXRlKCdDZWxsT3BlcmF0aW9ucycsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnTW92ZSBjZWxscyAtIHNpbmdsZSBjZWxsJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIGInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYyA9IDM7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRcdHZpZXdNb2RlbC51cGRhdGVTZWxlY3Rpb25zU3RhdGUoeyBraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsIGZvY3VzOiB7IHN0YXJ0OiAxLCBlbmQ6IDIgfSwgc2VsZWN0aW9uczogW3sgc3RhcnQ6IDEsIGVuZDogMiB9XSB9KTtcblx0XHRcdFx0Y29uc3QgY2VsbCA9IHZpZXdNb2RlbC5jZWxsQXQoMSk7XG5cdFx0XHRcdGFzc2VydC5vayhjZWxsKTtcblx0XHRcdFx0YXdhaXQgbW92ZUNlbGxSYW5nZSh7IG5vdGVib29rRWRpdG9yOiBlZGl0b3IsIGNlbGw6IGNlbGwgfSwgJ2Rvd24nKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5jZWxsQXQoMik/LmdldFRleHQoKSwgJ3ZhciBiID0gMTsnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGwsIHZpZXdNb2RlbC5jZWxsQXQoMikpO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ01vdmUgY2VsbHMgLSBtdWx0aXBsZSBjZWxscyBpbiBhIHNlbGVjdGlvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGMgPSAzOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdGFzeW5jIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0XHR2aWV3TW9kZWwudXBkYXRlU2VsZWN0aW9uc1N0YXRlKHsga2luZDogU2VsZWN0aW9uU3RhdGVUeXBlLkluZGV4LCBmb2N1czogeyBzdGFydDogMSwgZW5kOiAyIH0sIHNlbGVjdGlvbnM6IFt7IHN0YXJ0OiAwLCBlbmQ6IDIgfV0gfSk7XG5cdFx0XHRcdGF3YWl0IG1vdmVDZWxsUmFuZ2UoeyBub3RlYm9va0VkaXRvcjogZWRpdG9yIH0sICdkb3duJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuY2VsbEF0KDApPy5nZXRUZXh0KCksICcjIGhlYWRlciBiJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuY2VsbEF0KDEpPy5nZXRUZXh0KCksICcjIGhlYWRlciBhJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuY2VsbEF0KDIpPy5nZXRUZXh0KCksICd2YXIgYiA9IDE7Jyk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnTW92ZSBjZWxscyAtIG1vdmUgd2l0aCBmb2xkaW5nIHJhbmdlcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGMgPSAzOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdGFzeW5jIChlZGl0b3IsIHZpZXdNb2RlbCwgZHMpID0+IHtcblx0XHRcdFx0Y29uc3QgZm9sZGluZ01vZGVsID0gZHMuYWRkKG5ldyBGb2xkaW5nTW9kZWwoKSk7XG5cdFx0XHRcdGZvbGRpbmdNb2RlbC5hdHRhY2hWaWV3TW9kZWwodmlld01vZGVsKTtcblx0XHRcdFx0dXBkYXRlRm9sZGluZ1N0YXRlQXRJbmRleChmb2xkaW5nTW9kZWwsIDAsIHRydWUpO1xuXHRcdFx0XHR1cGRhdGVGb2xkaW5nU3RhdGVBdEluZGV4KGZvbGRpbmdNb2RlbCwgMSwgdHJ1ZSk7XG5cdFx0XHRcdHZpZXdNb2RlbC51cGRhdGVGb2xkaW5nUmFuZ2VzKGZvbGRpbmdNb2RlbC5yZWdpb25zKTtcblx0XHRcdFx0ZWRpdG9yLnNldEhpZGRlbkFyZWFzKFt7IHN0YXJ0OiAxLCBlbmQ6IDIgfV0pO1xuXHRcdFx0XHRlZGl0b3Iuc2V0SGlkZGVuQXJlYXModmlld01vZGVsLmdldEhpZGRlblJhbmdlcygpKTtcblxuXHRcdFx0XHR2aWV3TW9kZWwudXBkYXRlU2VsZWN0aW9uc1N0YXRlKHsga2luZDogU2VsZWN0aW9uU3RhdGVUeXBlLkluZGV4LCBmb2N1czogeyBzdGFydDogMCwgZW5kOiAxIH0sIHNlbGVjdGlvbnM6IFt7IHN0YXJ0OiAwLCBlbmQ6IDEgfV0gfSk7XG5cdFx0XHRcdGF3YWl0IG1vdmVDZWxsUmFuZ2UoeyBub3RlYm9va0VkaXRvcjogZWRpdG9yIH0sICdkb3duJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuY2VsbEF0KDApPy5nZXRUZXh0KCksICcjIGhlYWRlciBiJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuY2VsbEF0KDEpPy5nZXRUZXh0KCksICcjIGhlYWRlciBhJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuY2VsbEF0KDIpPy5nZXRUZXh0KCksICd2YXIgYiA9IDE7Jyk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblxuXHR0ZXN0KCdDb3B5L2R1cGxpY2F0ZSBjZWxscyAtIHNpbmdsZSBjZWxsJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIGInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYyA9IDM7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRcdHZpZXdNb2RlbC51cGRhdGVTZWxlY3Rpb25zU3RhdGUoeyBraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsIGZvY3VzOiB7IHN0YXJ0OiAxLCBlbmQ6IDIgfSwgc2VsZWN0aW9uczogW3sgc3RhcnQ6IDEsIGVuZDogMiB9XSB9KTtcblx0XHRcdFx0YXdhaXQgY29weUNlbGxSYW5nZSh7IG5vdGVib29rRWRpdG9yOiBlZGl0b3IsIGNlbGw6IHZpZXdNb2RlbC5jZWxsQXQoMSkhIH0sICdkb3duJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwubGVuZ3RoLCA2KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5jZWxsQXQoMSk/LmdldFRleHQoKSwgJ3ZhciBiID0gMTsnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5jZWxsQXQoMik/LmdldFRleHQoKSwgJ3ZhciBiID0gMTsnKTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdDb3B5L2R1cGxpY2F0ZSBjZWxscyAtIHRhcmdldCBhbmQgc2VsZWN0aW9uIGFyZSBkaWZmZXJlbnQsICMxMTk3NjknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WycjIGhlYWRlciBhJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgYicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDI7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBjID0gMzsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRcdF0sXG5cdFx0XHRhc3luYyAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdFx0dmlld01vZGVsLnVwZGF0ZVNlbGVjdGlvbnNTdGF0ZSh7IGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCwgZm9jdXM6IHsgc3RhcnQ6IDAsIGVuZDogMSB9LCBzZWxlY3Rpb25zOiBbeyBzdGFydDogMCwgZW5kOiAxIH1dIH0pO1xuXHRcdFx0XHRhd2FpdCBjb3B5Q2VsbFJhbmdlKHsgbm90ZWJvb2tFZGl0b3I6IGVkaXRvciwgY2VsbDogdmlld01vZGVsLmNlbGxBdCgxKSEsIHVpOiB0cnVlIH0sICdkb3duJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwubGVuZ3RoLCA2KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5jZWxsQXQoMSk/LmdldFRleHQoKSwgJ3ZhciBiID0gMTsnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5jZWxsQXQoMik/LmdldFRleHQoKSwgJ3ZhciBiID0gMTsnKTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdDb3B5L2R1cGxpY2F0ZSBjZWxscyAtIG11bHRpcGxlIGNlbGxzIGluIGEgc2VsZWN0aW9uJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIGInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYyA9IDM7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRcdHZpZXdNb2RlbC51cGRhdGVTZWxlY3Rpb25zU3RhdGUoeyBraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsIGZvY3VzOiB7IHN0YXJ0OiAxLCBlbmQ6IDIgfSwgc2VsZWN0aW9uczogW3sgc3RhcnQ6IDAsIGVuZDogMiB9XSB9KTtcblx0XHRcdFx0YXdhaXQgY29weUNlbGxSYW5nZSh7IG5vdGVib29rRWRpdG9yOiBlZGl0b3IsIGNlbGw6IHZpZXdNb2RlbC5jZWxsQXQoMSkhIH0sICdkb3duJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwubGVuZ3RoLCA3KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5jZWxsQXQoMCk/LmdldFRleHQoKSwgJyMgaGVhZGVyIGEnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5jZWxsQXQoMSk/LmdldFRleHQoKSwgJ3ZhciBiID0gMTsnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5jZWxsQXQoMik/LmdldFRleHQoKSwgJyMgaGVhZGVyIGEnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5jZWxsQXQoMyk/LmdldFRleHQoKSwgJ3ZhciBiID0gMTsnKTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdDb3B5L2R1cGxpY2F0ZSBjZWxscyAtIG1vdmUgd2l0aCBmb2xkaW5nIHJhbmdlcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGMgPSAzOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdGFzeW5jIChlZGl0b3IsIHZpZXdNb2RlbCwgZHMpID0+IHtcblx0XHRcdFx0Y29uc3QgZm9sZGluZ01vZGVsID0gZHMuYWRkKG5ldyBGb2xkaW5nTW9kZWwoKSk7XG5cdFx0XHRcdGZvbGRpbmdNb2RlbC5hdHRhY2hWaWV3TW9kZWwodmlld01vZGVsKTtcblx0XHRcdFx0dXBkYXRlRm9sZGluZ1N0YXRlQXRJbmRleChmb2xkaW5nTW9kZWwsIDAsIHRydWUpO1xuXHRcdFx0XHR1cGRhdGVGb2xkaW5nU3RhdGVBdEluZGV4KGZvbGRpbmdNb2RlbCwgMSwgdHJ1ZSk7XG5cdFx0XHRcdHZpZXdNb2RlbC51cGRhdGVGb2xkaW5nUmFuZ2VzKGZvbGRpbmdNb2RlbC5yZWdpb25zKTtcblx0XHRcdFx0ZWRpdG9yLnNldEhpZGRlbkFyZWFzKFt7IHN0YXJ0OiAxLCBlbmQ6IDIgfV0pO1xuXHRcdFx0XHRlZGl0b3Iuc2V0SGlkZGVuQXJlYXModmlld01vZGVsLmdldEhpZGRlblJhbmdlcygpKTtcblxuXHRcdFx0XHR2aWV3TW9kZWwudXBkYXRlU2VsZWN0aW9uc1N0YXRlKHsga2luZDogU2VsZWN0aW9uU3RhdGVUeXBlLkluZGV4LCBmb2N1czogeyBzdGFydDogMCwgZW5kOiAxIH0sIHNlbGVjdGlvbnM6IFt7IHN0YXJ0OiAwLCBlbmQ6IDEgfV0gfSk7XG5cdFx0XHRcdGF3YWl0IGNvcHlDZWxsUmFuZ2UoeyBub3RlYm9va0VkaXRvcjogZWRpdG9yLCBjZWxsOiB2aWV3TW9kZWwuY2VsbEF0KDEpISB9LCAnZG93bicpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmxlbmd0aCwgNyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuY2VsbEF0KDApPy5nZXRUZXh0KCksICcjIGhlYWRlciBhJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuY2VsbEF0KDEpPy5nZXRUZXh0KCksICd2YXIgYiA9IDE7Jyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuY2VsbEF0KDIpPy5nZXRUZXh0KCksICcjIGhlYWRlciBhJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuY2VsbEF0KDMpPy5nZXRUZXh0KCksICd2YXIgYiA9IDE7Jyk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnQ29weS9kdXBsaWNhdGUgY2VsbHMgLSBzaG91bGQgbm90IHNoYXJlIHRoZSBzYW1lIHRleHQgYnVmZmVyICMxMDI0MjMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WycjIGhlYWRlciBhJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRcdF0sXG5cdFx0XHRhc3luYyAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdFx0dmlld01vZGVsLnVwZGF0ZVNlbGVjdGlvbnNTdGF0ZSh7IGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCwgZm9jdXM6IHsgc3RhcnQ6IDEsIGVuZDogMiB9LCBzZWxlY3Rpb25zOiBbeyBzdGFydDogMSwgZW5kOiAyIH1dIH0pO1xuXHRcdFx0XHRhd2FpdCBjb3B5Q2VsbFJhbmdlKHsgbm90ZWJvb2tFZGl0b3I6IGVkaXRvciwgY2VsbDogdmlld01vZGVsLmNlbGxBdCgxKSEgfSwgJ2Rvd24nKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5sZW5ndGgsIDMpO1xuXHRcdFx0XHRjb25zdCBjZWxsMSA9IHZpZXdNb2RlbC5jZWxsQXQoMSk7XG5cdFx0XHRcdGNvbnN0IGNlbGwyID0gdmlld01vZGVsLmNlbGxBdCgyKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKGNlbGwxKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKGNlbGwyKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGwxLmdldFRleHQoKSwgJ3ZhciBiID0gMTsnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5jZWxsQXQoMik/LmdldFRleHQoKSwgJ3ZhciBiID0gMTsnKTtcblxuXHRcdFx0XHQoY2VsbDEudGV4dEJ1ZmZlciBhcyBJVGV4dEJ1ZmZlcikuYXBwbHlFZGl0cyhbXG5cdFx0XHRcdFx0bmV3IFZhbGlkQW5ub3RhdGVkRWRpdE9wZXJhdGlvbihudWxsLCBuZXcgUmFuZ2UoMSwgMSwgMSwgNCksICcnLCBmYWxzZSwgZmFsc2UsIGZhbHNlKVxuXHRcdFx0XHRdLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChjZWxsMS5nZXRUZXh0KCksIGNlbGwyLmdldFRleHQoKSk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnSm9pbiBjZWxsIHdpdGggYmVsb3cgLSBzaW5nbGUgY2VsbCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGMgPSAzOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdGFzeW5jIChlZGl0b3IsIHZpZXdNb2RlbCwgYWNjZXNzb3IpID0+IHtcblx0XHRcdFx0dmlld01vZGVsLnVwZGF0ZVNlbGVjdGlvbnNTdGF0ZSh7IGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCwgZm9jdXM6IHsgc3RhcnQ6IDMsIGVuZDogNCB9LCBzZWxlY3Rpb25zOiBbeyBzdGFydDogMywgZW5kOiA0IH1dIH0pO1xuXHRcdFx0XHRjb25zdCByZXQgPSBhd2FpdCBqb2luTm90ZWJvb2tDZWxscyhlZGl0b3IsIHsgc3RhcnQ6IDMsIGVuZDogNCB9LCAnYmVsb3cnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldD8uZWRpdHMubGVuZ3RoLCAyKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXQ/LmVkaXRzWzBdLCBuZXcgUmVzb3VyY2VUZXh0RWRpdCh2aWV3TW9kZWwuY2VsbEF0KDMpIS51cmksIHtcblx0XHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKDEsIDExLCAxLCAxMSksIHRleHQ6IHZpZXdNb2RlbC5jZWxsQXQoNCkhLnRleHRCdWZmZXIuZ2V0RU9MKCkgKyAndmFyIGMgPSAzOydcblx0XHRcdFx0fSkpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJldD8uZWRpdHNbMV0sIG5ldyBSZXNvdXJjZU5vdGVib29rQ2VsbEVkaXQoZWRpdG9yLnRleHRNb2RlbC51cmksXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLFxuXHRcdFx0XHRcdFx0aW5kZXg6IDQsXG5cdFx0XHRcdFx0XHRjb3VudDogMSxcblx0XHRcdFx0XHRcdGNlbGxzOiBbXVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0KSk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnSm9pbiBjZWxsIHdpdGggYWJvdmUgLSBzaW5nbGUgY2VsbCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGMgPSAzOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdGFzeW5jIChlZGl0b3IsIHZpZXdNb2RlbCwgYWNjZXNzb3IpID0+IHtcblx0XHRcdFx0dmlld01vZGVsLnVwZGF0ZVNlbGVjdGlvbnNTdGF0ZSh7IGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCwgZm9jdXM6IHsgc3RhcnQ6IDMsIGVuZDogNCB9LCBzZWxlY3Rpb25zOiBbeyBzdGFydDogMywgZW5kOiA0IH1dIH0pO1xuXHRcdFx0XHRjb25zdCByZXQgPSBhd2FpdCBqb2luTm90ZWJvb2tDZWxscyhlZGl0b3IsIHsgc3RhcnQ6IDQsIGVuZDogNSB9LCAnYWJvdmUnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldD8uZWRpdHMubGVuZ3RoLCAyKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXQ/LmVkaXRzWzBdLCBuZXcgUmVzb3VyY2VUZXh0RWRpdCh2aWV3TW9kZWwuY2VsbEF0KDMpIS51cmksIHtcblx0XHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKDEsIDExLCAxLCAxMSksIHRleHQ6IHZpZXdNb2RlbC5jZWxsQXQoNCkhLnRleHRCdWZmZXIuZ2V0RU9MKCkgKyAndmFyIGMgPSAzOydcblx0XHRcdFx0fSkpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJldD8uZWRpdHNbMV0sIG5ldyBSZXNvdXJjZU5vdGVib29rQ2VsbEVkaXQoZWRpdG9yLnRleHRNb2RlbC51cmksXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLFxuXHRcdFx0XHRcdFx0aW5kZXg6IDQsXG5cdFx0XHRcdFx0XHRjb3VudDogMSxcblx0XHRcdFx0XHRcdGNlbGxzOiBbXVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0KSk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnSm9pbiBjZWxsIHdpdGggYmVsb3cgLSBtdWx0aXBsZSBjZWxscycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYyA9IDM7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsLCBhY2Nlc3NvcikgPT4ge1xuXHRcdFx0XHR2aWV3TW9kZWwudXBkYXRlU2VsZWN0aW9uc1N0YXRlKHsga2luZDogU2VsZWN0aW9uU3RhdGVUeXBlLkluZGV4LCBmb2N1czogeyBzdGFydDogMSwgZW5kOiAyIH0sIHNlbGVjdGlvbnM6IFt7IHN0YXJ0OiAwLCBlbmQ6IDIgfV0gfSk7XG5cdFx0XHRcdGNvbnN0IHJldCA9IGF3YWl0IGpvaW5Ob3RlYm9va0NlbGxzKGVkaXRvciwgeyBzdGFydDogMCwgZW5kOiAyIH0sICdiZWxvdycpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmV0Py5lZGl0cy5sZW5ndGgsIDIpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJldD8uZWRpdHNbMF0sIG5ldyBSZXNvdXJjZVRleHRFZGl0KHZpZXdNb2RlbC5jZWxsQXQoMCkhLnVyaSwge1xuXHRcdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgMTEsIDEsIDExKSwgdGV4dDogdmlld01vZGVsLmNlbGxBdCgxKSEudGV4dEJ1ZmZlci5nZXRFT0woKSArICd2YXIgYiA9IDI7JyArIHZpZXdNb2RlbC5jZWxsQXQoMikhLnRleHRCdWZmZXIuZ2V0RU9MKCkgKyAndmFyIGMgPSAzOydcblx0XHRcdFx0fSkpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJldD8uZWRpdHNbMV0sIG5ldyBSZXNvdXJjZU5vdGVib29rQ2VsbEVkaXQoZWRpdG9yLnRleHRNb2RlbC51cmksXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLFxuXHRcdFx0XHRcdFx0aW5kZXg6IDEsXG5cdFx0XHRcdFx0XHRjb3VudDogMixcblx0XHRcdFx0XHRcdGNlbGxzOiBbXVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0KSk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnSm9pbiBjZWxsIHdpdGggYWJvdmUgLSBtdWx0aXBsZSBjZWxscycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYyA9IDM7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsLCBhY2Nlc3NvcikgPT4ge1xuXHRcdFx0XHR2aWV3TW9kZWwudXBkYXRlU2VsZWN0aW9uc1N0YXRlKHsga2luZDogU2VsZWN0aW9uU3RhdGVUeXBlLkluZGV4LCBmb2N1czogeyBzdGFydDogMiwgZW5kOiAzIH0sIHNlbGVjdGlvbnM6IFt7IHN0YXJ0OiAxLCBlbmQ6IDMgfV0gfSk7XG5cdFx0XHRcdGNvbnN0IHJldCA9IGF3YWl0IGpvaW5Ob3RlYm9va0NlbGxzKGVkaXRvciwgeyBzdGFydDogMSwgZW5kOiAzIH0sICdhYm92ZScpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmV0Py5lZGl0cy5sZW5ndGgsIDIpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJldD8uZWRpdHNbMF0sIG5ldyBSZXNvdXJjZVRleHRFZGl0KHZpZXdNb2RlbC5jZWxsQXQoMCkhLnVyaSwge1xuXHRcdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgMTEsIDEsIDExKSwgdGV4dDogdmlld01vZGVsLmNlbGxBdCgxKSEudGV4dEJ1ZmZlci5nZXRFT0woKSArICd2YXIgYiA9IDI7JyArIHZpZXdNb2RlbC5jZWxsQXQoMikhLnRleHRCdWZmZXIuZ2V0RU9MKCkgKyAndmFyIGMgPSAzOydcblx0XHRcdFx0fSkpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJldD8uZWRpdHNbMV0sIG5ldyBSZXNvdXJjZU5vdGVib29rQ2VsbEVkaXQoZWRpdG9yLnRleHRNb2RlbC51cmksXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLFxuXHRcdFx0XHRcdFx0aW5kZXg6IDEsXG5cdFx0XHRcdFx0XHRjb3VudDogMixcblx0XHRcdFx0XHRcdGNlbGxzOiBbXVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0KSk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRGVsZXRlIGZvY3VzIGNlbGwnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0Wyd2YXIgYSA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGMgPSAzOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdGFzeW5jIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0XHRlZGl0b3Iuc2V0Rm9jdXMoeyBzdGFydDogMCwgZW5kOiAxIH0pO1xuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhbeyBzdGFydDogMCwgZW5kOiAxIH1dKTtcblx0XHRcdFx0cnVuRGVsZXRlQWN0aW9uKGVkaXRvciwgdmlld01vZGVsLmNlbGxBdCgwKSEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmxlbmd0aCwgMik7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRGVsZXRlIHNlbGVjdGVkIGNlbGxzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsndmFyIGEgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDI7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBjID0gMzsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRcdF0sXG5cdFx0XHRhc3luYyAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdFx0ZWRpdG9yLnNldEZvY3VzKHsgc3RhcnQ6IDAsIGVuZDogMSB9KTtcblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW3sgc3RhcnQ6IDAsIGVuZDogMiB9XSk7XG5cdFx0XHRcdHJ1bkRlbGV0ZUFjdGlvbihlZGl0b3IsIHZpZXdNb2RlbC5jZWxsQXQoMCkhKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5sZW5ndGgsIDEpO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0RlbGV0ZSBmb2N1cyBjZWxsIG91dCBvZiBhIHNlbGVjdGlvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYyA9IDM7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBkID0gNDsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRcdGVkaXRvci5zZXRGb2N1cyh7IHN0YXJ0OiAwLCBlbmQ6IDEgfSk7XG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFt7IHN0YXJ0OiAyLCBlbmQ6IDQgfV0pO1xuXHRcdFx0XHRydW5EZWxldGVBY3Rpb24oZWRpdG9yLCB2aWV3TW9kZWwuY2VsbEF0KDApISk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwubGVuZ3RoLCAzKTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdEZWxldGUgVUkgdGFyZ2V0JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsndmFyIGEgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDI7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBjID0gMzsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRcdF0sXG5cdFx0XHRhc3luYyAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdFx0ZWRpdG9yLnNldEZvY3VzKHsgc3RhcnQ6IDAsIGVuZDogMSB9KTtcblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW3sgc3RhcnQ6IDAsIGVuZDogMSB9XSk7XG5cdFx0XHRcdHJ1bkRlbGV0ZUFjdGlvbihlZGl0b3IsIHZpZXdNb2RlbC5jZWxsQXQoMikhKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5sZW5ndGgsIDIpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmNlbGxBdCgwKT8uZ2V0VGV4dCgpLCAndmFyIGEgPSAxOycpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmNlbGxBdCgxKT8uZ2V0VGV4dCgpLCAndmFyIGIgPSAyOycpO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0RlbGV0ZSBVSSB0YXJnZXQgMicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYyA9IDM7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBkID0gNDsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGUgPSA1OycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdF0sXG5cdFx0XHRhc3luYyAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdFx0ZWRpdG9yLnNldEZvY3VzKHsgc3RhcnQ6IDAsIGVuZDogMSB9KTtcblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW3sgc3RhcnQ6IDAsIGVuZDogMSB9LCB7IHN0YXJ0OiAzLCBlbmQ6IDUgfV0pO1xuXHRcdFx0XHRydW5EZWxldGVBY3Rpb24oZWRpdG9yLCB2aWV3TW9kZWwuY2VsbEF0KDEpISk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwubGVuZ3RoLCA0KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0Rm9jdXMoKSwgeyBzdGFydDogMCwgZW5kOiAxIH0pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRTZWxlY3Rpb25zKCksIFt7IHN0YXJ0OiAwLCBlbmQ6IDEgfSwgeyBzdGFydDogMiwgZW5kOiA0IH1dKTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdEZWxldGUgVUkgdGFyZ2V0IDMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0Wyd2YXIgYSA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGMgPSAzOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgZCA9IDQ7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBlID0gNTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRcdGVkaXRvci5zZXRGb2N1cyh7IHN0YXJ0OiAwLCBlbmQ6IDEgfSk7XG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFt7IHN0YXJ0OiAyLCBlbmQ6IDMgfV0pO1xuXHRcdFx0XHRydW5EZWxldGVBY3Rpb24oZWRpdG9yLCB2aWV3TW9kZWwuY2VsbEF0KDApISk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwubGVuZ3RoLCA0KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0Rm9jdXMoKSwgeyBzdGFydDogMCwgZW5kOiAxIH0pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRTZWxlY3Rpb25zKCksIFt7IHN0YXJ0OiAxLCBlbmQ6IDIgfV0pO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0RlbGV0ZSBVSSB0YXJnZXQgNCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYyA9IDM7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBkID0gNDsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGUgPSA1OycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdF0sXG5cdFx0XHRhc3luYyAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdFx0ZWRpdG9yLnNldEZvY3VzKHsgc3RhcnQ6IDIsIGVuZDogMyB9KTtcblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbnMoW3sgc3RhcnQ6IDMsIGVuZDogNSB9XSk7XG5cdFx0XHRcdHJ1bkRlbGV0ZUFjdGlvbihlZGl0b3IsIHZpZXdNb2RlbC5jZWxsQXQoMCkhKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5sZW5ndGgsIDQpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRGb2N1cygpLCB7IHN0YXJ0OiAxLCBlbmQ6IDIgfSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldFNlbGVjdGlvbnMoKSwgW3sgc3RhcnQ6IDIsIGVuZDogNCB9XSk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblxuXHR0ZXN0KCdEZWxldGUgbGFzdCBjZWxsIHNldHMgc2VsZWN0aW9uIGNvcnJlY3RseScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYyA9IDM7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRcdGVkaXRvci5zZXRGb2N1cyh7IHN0YXJ0OiAyLCBlbmQ6IDMgfSk7XG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFt7IHN0YXJ0OiAyLCBlbmQ6IDMgfV0pO1xuXHRcdFx0XHRydW5EZWxldGVBY3Rpb24oZWRpdG9yLCB2aWV3TW9kZWwuY2VsbEF0KDIpISk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwubGVuZ3RoLCAyKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0Rm9jdXMoKSwgeyBzdGFydDogMSwgZW5kOiAyIH0pO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJyMxMjAxODcuIERlbGV0ZSBzaG91bGQgd29yayBvbiBtdWx0aXBsZSBkaXN0aW5jdCBzZWxlY3Rpb24nLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0Wyd2YXIgYSA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGMgPSAzOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgZCA9IDQ7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRcdGVkaXRvci5zZXRGb2N1cyh7IHN0YXJ0OiAwLCBlbmQ6IDEgfSk7XG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFt7IHN0YXJ0OiAwLCBlbmQ6IDEgfSwgeyBzdGFydDogMywgZW5kOiA0IH1dKTtcblx0XHRcdFx0cnVuRGVsZXRlQWN0aW9uKGVkaXRvciwgdmlld01vZGVsLmNlbGxBdCgwKSEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmxlbmd0aCwgMik7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldEZvY3VzKCksIHsgc3RhcnQ6IDAsIGVuZDogMSB9KTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCcjMTIwMTg3LiBEZWxldGUgc2hvdWxkIHdvcmsgb24gbXVsdGlwbGUgZGlzdGluY3Qgc2VsZWN0aW9uIDInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0Wyd2YXIgYSA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGMgPSAzOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgZCA9IDQ7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBlID0gNTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRcdGVkaXRvci5zZXRGb2N1cyh7IHN0YXJ0OiAxLCBlbmQ6IDIgfSk7XG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFt7IHN0YXJ0OiAxLCBlbmQ6IDIgfSwgeyBzdGFydDogMywgZW5kOiA1IH1dKTtcblx0XHRcdFx0cnVuRGVsZXRlQWN0aW9uKGVkaXRvciwgdmlld01vZGVsLmNlbGxBdCgxKSEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmxlbmd0aCwgMik7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldEZvY3VzKCksIHsgc3RhcnQ6IDEsIGVuZDogMiB9KTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdDaGFuZ2UgY2VsbCBraW5kIC0gc2luZ2xlIGNlbGwnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WycjIGhlYWRlciBhJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgYicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDI7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBjID0gMzsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRcdF0sXG5cdFx0XHRhc3luYyAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdFx0dmlld01vZGVsLnVwZGF0ZVNlbGVjdGlvbnNTdGF0ZSh7IGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCwgZm9jdXM6IHsgc3RhcnQ6IDEsIGVuZDogMiB9LCBzZWxlY3Rpb25zOiBbeyBzdGFydDogMSwgZW5kOiAyIH1dIH0pO1xuXHRcdFx0XHRhd2FpdCBjaGFuZ2VDZWxsVG9LaW5kKENlbGxLaW5kLk1hcmt1cCwgeyBub3RlYm9va0VkaXRvcjogZWRpdG9yLCBjZWxsOiB2aWV3TW9kZWwuY2VsbEF0KDEpISwgdWk6IHRydWUgfSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuY2VsbEF0KDEpPy5jZWxsS2luZCwgQ2VsbEtpbmQuTWFya3VwKTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdDaGFuZ2UgY2VsbCBraW5kIC0gbXVsdGkgY2VsbHMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WycjIGhlYWRlciBhJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgYicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDI7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBjID0gMzsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRcdF0sXG5cdFx0XHRhc3luYyAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdFx0dmlld01vZGVsLnVwZGF0ZVNlbGVjdGlvbnNTdGF0ZSh7IGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCwgZm9jdXM6IHsgc3RhcnQ6IDEsIGVuZDogMiB9LCBzZWxlY3Rpb25zOiBbeyBzdGFydDogMSwgZW5kOiAyIH1dIH0pO1xuXHRcdFx0XHRhd2FpdCBjaGFuZ2VDZWxsVG9LaW5kKENlbGxLaW5kLk1hcmt1cCwgeyBub3RlYm9va0VkaXRvcjogZWRpdG9yLCBzZWxlY3RlZENlbGxzOiBbdmlld01vZGVsLmNlbGxBdCgzKSEsIHZpZXdNb2RlbC5jZWxsQXQoNCkhXSwgdWk6IGZhbHNlIH0pO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmNlbGxBdCgzKT8uY2VsbEtpbmQsIENlbGxLaW5kLk1hcmt1cCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuY2VsbEF0KDQpPy5jZWxsS2luZCwgQ2VsbEtpbmQuTWFya3VwKTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXG5cdHRlc3QoJ3NwbGl0IGNlbGwnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0KGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29tcHV0ZUNlbGxMaW5lc0NvbnRlbnRzKHZpZXdNb2RlbC5jZWxsQXQoMCkhLCBbeyBsaW5lTnVtYmVyOiAxLCBjb2x1bW46IDQgfV0pLCBbXG5cdFx0XHRcdFx0J3ZhcicsXG5cdFx0XHRcdFx0JyBiID0gMTsnXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29tcHV0ZUNlbGxMaW5lc0NvbnRlbnRzKHZpZXdNb2RlbC5jZWxsQXQoMCkhLCBbeyBsaW5lTnVtYmVyOiAxLCBjb2x1bW46IDQgfSwgeyBsaW5lTnVtYmVyOiAxLCBjb2x1bW46IDYgfV0pLCBbXG5cdFx0XHRcdFx0J3ZhcicsXG5cdFx0XHRcdFx0JyBiJyxcblx0XHRcdFx0XHQnID0gMTsnXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29tcHV0ZUNlbGxMaW5lc0NvbnRlbnRzKHZpZXdNb2RlbC5jZWxsQXQoMCkhLCBbeyBsaW5lTnVtYmVyOiAxLCBjb2x1bW46IDEgfV0pLCBbXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0J3ZhciBiID0gMTsnXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29tcHV0ZUNlbGxMaW5lc0NvbnRlbnRzKHZpZXdNb2RlbC5jZWxsQXQoMCkhLCBbeyBsaW5lTnVtYmVyOiAxLCBjb2x1bW46IDExIH1dKSwgW1xuXHRcdFx0XHRcdCd2YXIgYiA9IDE7Jyxcblx0XHRcdFx0XHQnJyxcblx0XHRcdFx0XSk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnSW5zZXJ0IGNlbGwnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WycjIGhlYWRlciBhJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgYicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDI7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBjID0gMzsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRcdF0sXG5cdFx0XHRhc3luYyAoZWRpdG9yLCB2aWV3TW9kZWwsIF9kcywgYWNjZXNzb3IpID0+IHtcblx0XHRcdFx0Y29uc3QgbGFuZ3VhZ2VTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZVNlcnZpY2UpO1xuXG5cdFx0XHRcdGNvbnN0IGluc2VydGVkQ2VsbEFib3ZlID0gaW5zZXJ0Q2VsbChsYW5ndWFnZVNlcnZpY2UsIGVkaXRvciwgNCwgQ2VsbEtpbmQuQ29kZSwgJ2Fib3ZlJywgJ3ZhciBhID0gMDsnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5sZW5ndGgsIDYpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmNlbGxBdCg0KSwgaW5zZXJ0ZWRDZWxsQWJvdmUpO1xuXG5cdFx0XHRcdGNvbnN0IGluc2VydGVkQ2VsbEJlbG93ID0gaW5zZXJ0Q2VsbChsYW5ndWFnZVNlcnZpY2UsIGVkaXRvciwgMSwgQ2VsbEtpbmQuQ29kZSwgJ2JlbG93JywgJ3ZhciBhID0gMDsnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5sZW5ndGgsIDcpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmNlbGxBdCgyKSwgaW5zZXJ0ZWRDZWxsQmVsb3cpO1xuXHRcdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxjQUFjLGlDQUFpQztBQUN4RCxTQUFTLGtCQUFr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
