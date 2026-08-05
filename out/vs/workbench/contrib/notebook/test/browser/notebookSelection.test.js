import assert from "assert";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { FoldingModel, updateFoldingStateAtIndex } from "../../browser/viewModel/foldingModel.js";
import { runDeleteAction } from "../../browser/controller/cellOperations.js";
import { NotebookCellSelectionCollection } from "../../browser/viewModel/cellSelectionCollection.js";
import { CellEditType, CellKind, SelectionStateType } from "../../common/notebookCommon.js";
import { createNotebookCellList, setupInstantiationService, TestCell, withTestNotebook } from "./testNotebookEditor.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
suite("NotebookSelection", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("focus is never empty", function() {
    const selectionCollection = new NotebookCellSelectionCollection();
    assert.deepStrictEqual(selectionCollection.focus, { start: 0, end: 0 });
    selectionCollection.setState(null, [], true, "model");
    assert.deepStrictEqual(selectionCollection.focus, { start: 0, end: 0 });
    selectionCollection.dispose();
  });
});
suite("NotebookCellList focus/selection", () => {
  let disposables;
  let instantiationService;
  let languageService;
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  setup(() => {
    disposables = new DisposableStore();
    instantiationService = setupInstantiationService(disposables);
    languageService = instantiationService.get(ILanguageService);
  });
  test("notebook cell list setFocus", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, viewModel, ds) => {
        const cellList = createNotebookCellList(instantiationService, ds);
        cellList.attachViewModel(viewModel);
        assert.strictEqual(cellList.length, 2);
        cellList.setFocus([0]);
        assert.deepStrictEqual(viewModel.getFocus(), { start: 0, end: 1 });
        cellList.setFocus([1]);
        assert.deepStrictEqual(viewModel.getFocus(), { start: 1, end: 2 });
        cellList.detachViewModel();
      }
    );
  });
  test("notebook cell list setSelections", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, viewModel, ds) => {
        const cellList = createNotebookCellList(instantiationService, ds);
        cellList.attachViewModel(viewModel);
        assert.strictEqual(cellList.length, 2);
        cellList.setSelection([0]);
        assert.deepStrictEqual(viewModel.getSelections(), [{ start: 0, end: 1 }]);
        cellList.setSelection([1]);
        assert.deepStrictEqual(viewModel.getSelections(), [{ start: 1, end: 2 }]);
      }
    );
  });
  test("notebook cell list setFocus2", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, viewModel, ds) => {
        const cellList = createNotebookCellList(instantiationService, ds);
        cellList.attachViewModel(viewModel);
        assert.strictEqual(cellList.length, 2);
        cellList.setFocus([0]);
        assert.deepStrictEqual(viewModel.getFocus(), { start: 0, end: 1 });
        cellList.setFocus([1]);
        assert.deepStrictEqual(viewModel.getFocus(), { start: 1, end: 2 });
        cellList.setSelection([1]);
        assert.deepStrictEqual(viewModel.getSelections(), [{ start: 1, end: 2 }]);
        cellList.detachViewModel();
      }
    );
  });
  test("notebook cell list focus/selection from UI", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["# header c", "markdown", CellKind.Markup, [], {}]
      ],
      (editor, viewModel, ds) => {
        const cellList = createNotebookCellList(instantiationService, ds);
        cellList.attachViewModel(viewModel);
        assert.deepStrictEqual(viewModel.getFocus(), { start: 0, end: 1 });
        assert.deepStrictEqual(viewModel.getSelections(), [{ start: 0, end: 1 }]);
        cellList.setFocus([1], new KeyboardEvent("keydown"), void 0);
        cellList.setSelection([1], new KeyboardEvent("keydown"), void 0);
        assert.deepStrictEqual(viewModel.getFocus(), { start: 1, end: 2 });
        assert.deepStrictEqual(viewModel.getSelections(), [{ start: 1, end: 2 }]);
        cellList.setFocus([2], new KeyboardEvent("keydown"), void 0);
        cellList.setSelection([1, 2]);
        assert.deepStrictEqual(viewModel.getFocus(), { start: 2, end: 3 });
        assert.deepStrictEqual(viewModel.getSelections(), [{ start: 1, end: 3 }]);
        cellList.setFocus([3], new KeyboardEvent("keydown"), void 0);
        assert.deepStrictEqual(viewModel.getFocus(), { start: 3, end: 4 });
        assert.deepStrictEqual(viewModel.getSelections(), [{ start: 1, end: 3 }]);
      }
    );
  });
  test("notebook cell list focus/selection with folding regions", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["# header c", "markdown", CellKind.Markup, [], {}]
      ],
      (editor, viewModel, ds) => {
        const foldingModel = ds.add(new FoldingModel());
        foldingModel.attachViewModel(viewModel);
        const cellList = createNotebookCellList(instantiationService, ds);
        cellList.attachViewModel(viewModel);
        assert.strictEqual(cellList.length, 5);
        assert.deepStrictEqual(viewModel.getFocus(), { start: 0, end: 1 });
        assert.deepStrictEqual(viewModel.getSelections(), [{ start: 0, end: 1 }]);
        cellList.setFocus([0]);
        updateFoldingStateAtIndex(foldingModel, 0, true);
        updateFoldingStateAtIndex(foldingModel, 2, true);
        viewModel.updateFoldingRanges(foldingModel.regions);
        cellList.setHiddenAreas(viewModel.getHiddenRanges(), true);
        assert.strictEqual(cellList.length, 3);
        assert.deepStrictEqual(viewModel.getFocus(), { start: 0, end: 1 });
        assert.deepStrictEqual(viewModel.getSelections(), [{ start: 0, end: 1 }]);
        cellList.focusNext(1, false);
        assert.deepStrictEqual(viewModel.getFocus(), { start: 2, end: 3 });
        assert.deepStrictEqual(viewModel.getSelections(), [{ start: 0, end: 1 }]);
        updateFoldingStateAtIndex(foldingModel, 2, false);
        viewModel.updateFoldingRanges(foldingModel.regions);
        cellList.setHiddenAreas(viewModel.getHiddenRanges(), true);
        assert.strictEqual(cellList.length, 4);
        assert.deepStrictEqual(viewModel.getFocus(), { start: 2, end: 3 });
      }
    );
  });
  test("notebook cell list focus/selection with folding regions and applyEdits", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3", "javascript", CellKind.Markup, [], {}],
        ["# header d", "markdown", CellKind.Markup, [], {}],
        ["var e = 4;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, viewModel, ds) => {
        const foldingModel = ds.add(new FoldingModel());
        foldingModel.attachViewModel(viewModel);
        const cellList = createNotebookCellList(instantiationService, ds);
        cellList.attachViewModel(viewModel);
        cellList.setFocus([0]);
        cellList.setSelection([0]);
        updateFoldingStateAtIndex(foldingModel, 0, true);
        updateFoldingStateAtIndex(foldingModel, 2, true);
        viewModel.updateFoldingRanges(foldingModel.regions);
        cellList.setHiddenAreas(viewModel.getHiddenRanges(), true);
        assert.strictEqual(cellList.getModelIndex2(0), 0);
        assert.strictEqual(cellList.getModelIndex2(1), 2);
        editor.textModel.applyEdits([{
          editType: CellEditType.Replace,
          index: 0,
          count: 2,
          cells: []
        }], true, void 0, () => void 0, void 0, false);
        viewModel.updateFoldingRanges(foldingModel.regions);
        cellList.setHiddenAreas(viewModel.getHiddenRanges(), true);
        assert.strictEqual(cellList.getModelIndex2(0), 0);
        assert.strictEqual(cellList.getModelIndex2(1), 3);
        editor.textModel.applyEdits([{
          editType: CellEditType.Replace,
          index: 0,
          count: 0,
          cells: [
            ds.add(new TestCell(viewModel.viewType, 7, "# header f", "markdown", CellKind.Code, [], languageService)),
            ds.add(new TestCell(viewModel.viewType, 8, "var g = 5;", "javascript", CellKind.Code, [], languageService))
          ]
        }], true, void 0, () => void 0, void 0, false);
        viewModel.updateFoldingRanges(foldingModel.regions);
        cellList.setHiddenAreas(viewModel.getHiddenRanges(), true);
        assert.strictEqual(cellList.getModelIndex2(0), 0);
        assert.strictEqual(cellList.getModelIndex2(1), 1);
        assert.strictEqual(cellList.getModelIndex2(2), 2);
      }
    );
  });
  test("notebook cell list getModelIndex", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["# header c", "markdown", CellKind.Markup, [], {}]
      ],
      (editor, viewModel, ds) => {
        const foldingModel = ds.add(new FoldingModel());
        foldingModel.attachViewModel(viewModel);
        const cellList = createNotebookCellList(instantiationService, ds);
        cellList.attachViewModel(viewModel);
        updateFoldingStateAtIndex(foldingModel, 0, true);
        updateFoldingStateAtIndex(foldingModel, 2, true);
        viewModel.updateFoldingRanges(foldingModel.regions);
        cellList.setHiddenAreas(viewModel.getHiddenRanges(), true);
        assert.deepStrictEqual(cellList.getModelIndex2(-1), 0);
        assert.deepStrictEqual(cellList.getModelIndex2(0), 0);
        assert.deepStrictEqual(cellList.getModelIndex2(1), 2);
        assert.deepStrictEqual(cellList.getModelIndex2(2), 4);
      }
    );
  });
  test("notebook validate range", async () => {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, viewModel) => {
        assert.deepStrictEqual(viewModel.validateRange(null), null);
        assert.deepStrictEqual(viewModel.validateRange(void 0), null);
        assert.deepStrictEqual(viewModel.validateRange({ start: 0, end: 0 }), { start: 0, end: 0 });
        assert.deepStrictEqual(viewModel.validateRange({ start: 0, end: 2 }), { start: 0, end: 2 });
        assert.deepStrictEqual(viewModel.validateRange({ start: 0, end: 3 }), { start: 0, end: 2 });
        assert.deepStrictEqual(viewModel.validateRange({ start: -1, end: 3 }), { start: 0, end: 2 });
        assert.deepStrictEqual(viewModel.validateRange({ start: -1, end: 1 }), { start: 0, end: 1 });
        assert.deepStrictEqual(viewModel.validateRange({ start: 2, end: 1 }), { start: 1, end: 2 });
        assert.deepStrictEqual(viewModel.validateRange({ start: 2, end: -1 }), { start: 0, end: 2 });
      }
    );
  });
  test("notebook updateSelectionState", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, viewModel) => {
        viewModel.updateSelectionsState({ kind: SelectionStateType.Index, focus: { start: 1, end: 2 }, selections: [{ start: 1, end: 2 }, { start: -1, end: 0 }] });
        assert.deepStrictEqual(viewModel.getSelections(), [{ start: 1, end: 2 }]);
      }
    );
  });
  test("notebook cell selection w/ cell deletion", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, viewModel) => {
        viewModel.updateSelectionsState({ kind: SelectionStateType.Index, focus: { start: 1, end: 2 }, selections: [{ start: 1, end: 2 }] });
        runDeleteAction(editor, viewModel.cellAt(1));
        assert.deepStrictEqual(viewModel.getFocus(), { start: 0, end: 1 });
        assert.deepStrictEqual(viewModel.getSelections(), [{ start: 0, end: 1 }]);
      }
    );
  });
  test("notebook cell selection w/ cell deletion from applyEdits", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["var c = 2;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        viewModel.updateSelectionsState({ kind: SelectionStateType.Index, focus: { start: 1, end: 2 }, selections: [{ start: 1, end: 2 }] });
        editor.textModel.applyEdits([{
          editType: CellEditType.Replace,
          index: 1,
          count: 1,
          cells: []
        }], true, void 0, () => void 0, void 0, true);
        assert.deepStrictEqual(viewModel.getFocus(), { start: 1, end: 2 });
        assert.deepStrictEqual(viewModel.getSelections(), [{ start: 1, end: 2 }]);
      }
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay90ZXN0L2Jyb3dzZXIvbm90ZWJvb2tTZWxlY3Rpb24udGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBGb2xkaW5nTW9kZWwsIHVwZGF0ZUZvbGRpbmdTdGF0ZUF0SW5kZXggfSBmcm9tICcuLi8uLi9icm93c2VyL3ZpZXdNb2RlbC9mb2xkaW5nTW9kZWwuanMnO1xuaW1wb3J0IHsgcnVuRGVsZXRlQWN0aW9uIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb250cm9sbGVyL2NlbGxPcGVyYXRpb25zLmpzJztcbmltcG9ydCB7IE5vdGVib29rQ2VsbFNlbGVjdGlvbkNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi9icm93c2VyL3ZpZXdNb2RlbC9jZWxsU2VsZWN0aW9uQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBDZWxsRWRpdFR5cGUsIENlbGxLaW5kLCBTZWxlY3Rpb25TdGF0ZVR5cGUgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgY3JlYXRlTm90ZWJvb2tDZWxsTGlzdCwgc2V0dXBJbnN0YW50aWF0aW9uU2VydmljZSwgVGVzdENlbGwsIHdpdGhUZXN0Tm90ZWJvb2sgfSBmcm9tICcuL3Rlc3ROb3RlYm9va0VkaXRvci5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5cbnN1aXRlKCdOb3RlYm9va1NlbGVjdGlvbicsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnZm9jdXMgaXMgbmV2ZXIgZW1wdHknLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uQ29sbGVjdGlvbiA9IG5ldyBOb3RlYm9va0NlbGxTZWxlY3Rpb25Db2xsZWN0aW9uKCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZWxlY3Rpb25Db2xsZWN0aW9uLmZvY3VzLCB7IHN0YXJ0OiAwLCBlbmQ6IDAgfSk7XG5cblx0XHRzZWxlY3Rpb25Db2xsZWN0aW9uLnNldFN0YXRlKG51bGwsIFtdLCB0cnVlLCAnbW9kZWwnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlbGVjdGlvbkNvbGxlY3Rpb24uZm9jdXMsIHsgc3RhcnQ6IDAsIGVuZDogMCB9KTtcblx0XHRzZWxlY3Rpb25Db2xsZWN0aW9uLmRpc3Bvc2UoKTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ05vdGVib29rQ2VsbExpc3QgZm9jdXMvc2VsZWN0aW9uJywgKCkgPT4ge1xuXHRsZXQgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdGxldCBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2U7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc2V0dXBJbnN0YW50aWF0aW9uU2VydmljZShkaXNwb3NhYmxlcyk7XG5cdFx0bGFuZ3VhZ2VTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMYW5ndWFnZVNlcnZpY2UpO1xuXHR9KTtcblxuXG5cdHRlc3QoJ25vdGVib29rIGNlbGwgbGlzdCBzZXRGb2N1cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCwgZHMpID0+IHtcblx0XHRcdFx0Y29uc3QgY2VsbExpc3QgPSBjcmVhdGVOb3RlYm9va0NlbGxMaXN0KGluc3RhbnRpYXRpb25TZXJ2aWNlLCBkcyk7XG5cdFx0XHRcdGNlbGxMaXN0LmF0dGFjaFZpZXdNb2RlbCh2aWV3TW9kZWwpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5sZW5ndGgsIDIpO1xuXHRcdFx0XHRjZWxsTGlzdC5zZXRGb2N1cyhbMF0pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRGb2N1cygpLCB7IHN0YXJ0OiAwLCBlbmQ6IDEgfSk7XG5cblx0XHRcdFx0Y2VsbExpc3Quc2V0Rm9jdXMoWzFdKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0Rm9jdXMoKSwgeyBzdGFydDogMSwgZW5kOiAyIH0pO1xuXHRcdFx0XHRjZWxsTGlzdC5kZXRhY2hWaWV3TW9kZWwoKTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdub3RlYm9vayBjZWxsIGxpc3Qgc2V0U2VsZWN0aW9ucycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCwgZHMpID0+IHtcblx0XHRcdFx0Y29uc3QgY2VsbExpc3QgPSBjcmVhdGVOb3RlYm9va0NlbGxMaXN0KGluc3RhbnRpYXRpb25TZXJ2aWNlLCBkcyk7XG5cdFx0XHRcdGNlbGxMaXN0LmF0dGFjaFZpZXdNb2RlbCh2aWV3TW9kZWwpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5sZW5ndGgsIDIpO1xuXHRcdFx0XHRjZWxsTGlzdC5zZXRTZWxlY3Rpb24oWzBdKTtcblx0XHRcdFx0Ly8gdGhlIG9ubHkgc2VsZWN0aW9uIGlzIGFsc28gdGhlIGZvY3VzXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldFNlbGVjdGlvbnMoKSwgW3sgc3RhcnQ6IDAsIGVuZDogMSB9XSk7XG5cblx0XHRcdFx0Ly8gc2V0IHNlbGVjdGlvbiBkb2VzIG5vdCBtb2RpZnkgZm9jdXNcblx0XHRcdFx0Y2VsbExpc3Quc2V0U2VsZWN0aW9uKFsxXSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldFNlbGVjdGlvbnMoKSwgW3sgc3RhcnQ6IDEsIGVuZDogMiB9XSk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbm90ZWJvb2sgY2VsbCBsaXN0IHNldEZvY3VzMicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCwgZHMpID0+IHtcblx0XHRcdFx0Y29uc3QgY2VsbExpc3QgPSBjcmVhdGVOb3RlYm9va0NlbGxMaXN0KGluc3RhbnRpYXRpb25TZXJ2aWNlLCBkcyk7XG5cdFx0XHRcdGNlbGxMaXN0LmF0dGFjaFZpZXdNb2RlbCh2aWV3TW9kZWwpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5sZW5ndGgsIDIpO1xuXHRcdFx0XHRjZWxsTGlzdC5zZXRGb2N1cyhbMF0pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRGb2N1cygpLCB7IHN0YXJ0OiAwLCBlbmQ6IDEgfSk7XG5cblx0XHRcdFx0Y2VsbExpc3Quc2V0Rm9jdXMoWzFdKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0Rm9jdXMoKSwgeyBzdGFydDogMSwgZW5kOiAyIH0pO1xuXG5cdFx0XHRcdGNlbGxMaXN0LnNldFNlbGVjdGlvbihbMV0pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRTZWxlY3Rpb25zKCksIFt7IHN0YXJ0OiAxLCBlbmQ6IDIgfV0pO1xuXHRcdFx0XHRjZWxsTGlzdC5kZXRhY2hWaWV3TW9kZWwoKTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXG5cdHRlc3QoJ25vdGVib29rIGNlbGwgbGlzdCBmb2N1cy9zZWxlY3Rpb24gZnJvbSBVSScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgYycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCwgZHMpID0+IHtcblx0XHRcdFx0Y29uc3QgY2VsbExpc3QgPSBjcmVhdGVOb3RlYm9va0NlbGxMaXN0KGluc3RhbnRpYXRpb25TZXJ2aWNlLCBkcyk7XG5cdFx0XHRcdGNlbGxMaXN0LmF0dGFjaFZpZXdNb2RlbCh2aWV3TW9kZWwpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRGb2N1cygpLCB7IHN0YXJ0OiAwLCBlbmQ6IDEgfSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldFNlbGVjdGlvbnMoKSwgW3sgc3RhcnQ6IDAsIGVuZDogMSB9XSk7XG5cblx0XHRcdFx0Ly8gYXJyb3cgZG93biwgbW92ZSBib3RoIGZvY3VzIGFuZCBzZWxlY3Rpb25zXG5cdFx0XHRcdGNlbGxMaXN0LnNldEZvY3VzKFsxXSwgbmV3IEtleWJvYXJkRXZlbnQoJ2tleWRvd24nKSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0Y2VsbExpc3Quc2V0U2VsZWN0aW9uKFsxXSwgbmV3IEtleWJvYXJkRXZlbnQoJ2tleWRvd24nKSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0Rm9jdXMoKSwgeyBzdGFydDogMSwgZW5kOiAyIH0pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRTZWxlY3Rpb25zKCksIFt7IHN0YXJ0OiAxLCBlbmQ6IDIgfV0pO1xuXG5cdFx0XHRcdC8vIHNoaWZ0K2Fycm93IGRvd24sIGV4cGFuZHMgc2VsZWN0aW9uXG5cdFx0XHRcdGNlbGxMaXN0LnNldEZvY3VzKFsyXSwgbmV3IEtleWJvYXJkRXZlbnQoJ2tleWRvd24nKSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0Y2VsbExpc3Quc2V0U2VsZWN0aW9uKFsxLCAyXSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldEZvY3VzKCksIHsgc3RhcnQ6IDIsIGVuZDogMyB9KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0U2VsZWN0aW9ucygpLCBbeyBzdGFydDogMSwgZW5kOiAzIH1dKTtcblxuXHRcdFx0XHQvLyBhcnJvdyBkb3duLCB3aWxsIG1vdmUgZm9jdXMgYnV0IG5vdCBleHBhbmQgc2VsZWN0aW9uXG5cdFx0XHRcdGNlbGxMaXN0LnNldEZvY3VzKFszXSwgbmV3IEtleWJvYXJkRXZlbnQoJ2tleWRvd24nKSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0Rm9jdXMoKSwgeyBzdGFydDogMywgZW5kOiA0IH0pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRTZWxlY3Rpb25zKCksIFt7IHN0YXJ0OiAxLCBlbmQ6IDMgfV0pO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cblx0dGVzdCgnbm90ZWJvb2sgY2VsbCBsaXN0IGZvY3VzL3NlbGVjdGlvbiB3aXRoIGZvbGRpbmcgcmVnaW9ucycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgYycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCwgZHMpID0+IHtcblx0XHRcdFx0Y29uc3QgZm9sZGluZ01vZGVsID0gZHMuYWRkKG5ldyBGb2xkaW5nTW9kZWwoKSk7XG5cdFx0XHRcdGZvbGRpbmdNb2RlbC5hdHRhY2hWaWV3TW9kZWwodmlld01vZGVsKTtcblxuXHRcdFx0XHRjb25zdCBjZWxsTGlzdCA9IGNyZWF0ZU5vdGVib29rQ2VsbExpc3QoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRzKTtcblx0XHRcdFx0Y2VsbExpc3QuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5sZW5ndGgsIDUpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRGb2N1cygpLCB7IHN0YXJ0OiAwLCBlbmQ6IDEgfSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldFNlbGVjdGlvbnMoKSwgW3sgc3RhcnQ6IDAsIGVuZDogMSB9XSk7XG5cdFx0XHRcdGNlbGxMaXN0LnNldEZvY3VzKFswXSk7XG5cblx0XHRcdFx0dXBkYXRlRm9sZGluZ1N0YXRlQXRJbmRleChmb2xkaW5nTW9kZWwsIDAsIHRydWUpO1xuXHRcdFx0XHR1cGRhdGVGb2xkaW5nU3RhdGVBdEluZGV4KGZvbGRpbmdNb2RlbCwgMiwgdHJ1ZSk7XG5cdFx0XHRcdHZpZXdNb2RlbC51cGRhdGVGb2xkaW5nUmFuZ2VzKGZvbGRpbmdNb2RlbC5yZWdpb25zKTtcblx0XHRcdFx0Y2VsbExpc3Quc2V0SGlkZGVuQXJlYXModmlld01vZGVsLmdldEhpZGRlblJhbmdlcygpLCB0cnVlKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0Lmxlbmd0aCwgMyk7XG5cblx0XHRcdFx0Ly8gY3VycmVudGx5LCBmb2N1cyBvbiBhIGZvbGRlZCBjZWxsIHdpbGwgb25seSBmb2N1cyB0aGUgY2VsbCBpdHNlbGYsIGV4Y2x1ZGluZyBpdHMgXCJpbm5lclwiIGNlbGxzXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldEZvY3VzKCksIHsgc3RhcnQ6IDAsIGVuZDogMSB9KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0U2VsZWN0aW9ucygpLCBbeyBzdGFydDogMCwgZW5kOiAxIH1dKTtcblxuXHRcdFx0XHRjZWxsTGlzdC5mb2N1c05leHQoMSwgZmFsc2UpO1xuXHRcdFx0XHQvLyBmb2N1cyBuZXh0IHNob3VsZCBza2lwIHRoZSBmb2xkZWQgaXRlbXNcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0Rm9jdXMoKSwgeyBzdGFydDogMiwgZW5kOiAzIH0pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRTZWxlY3Rpb25zKCksIFt7IHN0YXJ0OiAwLCBlbmQ6IDEgfV0pO1xuXG5cdFx0XHRcdC8vIHVuZm9sZFxuXHRcdFx0XHR1cGRhdGVGb2xkaW5nU3RhdGVBdEluZGV4KGZvbGRpbmdNb2RlbCwgMiwgZmFsc2UpO1xuXHRcdFx0XHR2aWV3TW9kZWwudXBkYXRlRm9sZGluZ1Jhbmdlcyhmb2xkaW5nTW9kZWwucmVnaW9ucyk7XG5cdFx0XHRcdGNlbGxMaXN0LnNldEhpZGRlbkFyZWFzKHZpZXdNb2RlbC5nZXRIaWRkZW5SYW5nZXMoKSwgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5sZW5ndGgsIDQpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRGb2N1cygpLCB7IHN0YXJ0OiAyLCBlbmQ6IDMgfSk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbm90ZWJvb2sgY2VsbCBsaXN0IGZvY3VzL3NlbGVjdGlvbiB3aXRoIGZvbGRpbmcgcmVnaW9ucyBhbmQgYXBwbHlFZGl0cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGMgPSAzJywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgZCcsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgZSA9IDQ7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCwgZHMpID0+IHtcblx0XHRcdFx0Y29uc3QgZm9sZGluZ01vZGVsID0gZHMuYWRkKG5ldyBGb2xkaW5nTW9kZWwoKSk7XG5cdFx0XHRcdGZvbGRpbmdNb2RlbC5hdHRhY2hWaWV3TW9kZWwodmlld01vZGVsKTtcblxuXHRcdFx0XHRjb25zdCBjZWxsTGlzdCA9IGNyZWF0ZU5vdGVib29rQ2VsbExpc3QoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRzKTtcblx0XHRcdFx0Y2VsbExpc3QuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cdFx0XHRcdGNlbGxMaXN0LnNldEZvY3VzKFswXSk7XG5cdFx0XHRcdGNlbGxMaXN0LnNldFNlbGVjdGlvbihbMF0pO1xuXG5cdFx0XHRcdHVwZGF0ZUZvbGRpbmdTdGF0ZUF0SW5kZXgoZm9sZGluZ01vZGVsLCAwLCB0cnVlKTtcblx0XHRcdFx0dXBkYXRlRm9sZGluZ1N0YXRlQXRJbmRleChmb2xkaW5nTW9kZWwsIDIsIHRydWUpO1xuXHRcdFx0XHR2aWV3TW9kZWwudXBkYXRlRm9sZGluZ1Jhbmdlcyhmb2xkaW5nTW9kZWwucmVnaW9ucyk7XG5cdFx0XHRcdGNlbGxMaXN0LnNldEhpZGRlbkFyZWFzKHZpZXdNb2RlbC5nZXRIaWRkZW5SYW5nZXMoKSwgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRNb2RlbEluZGV4MigwKSwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRNb2RlbEluZGV4MigxKSwgMik7XG5cblx0XHRcdFx0ZWRpdG9yLnRleHRNb2RlbC5hcHBseUVkaXRzKFt7XG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLCBpbmRleDogMCwgY291bnQ6IDIsIGNlbGxzOiBbXVxuXHRcdFx0XHR9XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZmFsc2UpO1xuXHRcdFx0XHR2aWV3TW9kZWwudXBkYXRlRm9sZGluZ1Jhbmdlcyhmb2xkaW5nTW9kZWwucmVnaW9ucyk7XG5cdFx0XHRcdGNlbGxMaXN0LnNldEhpZGRlbkFyZWFzKHZpZXdNb2RlbC5nZXRIaWRkZW5SYW5nZXMoKSwgdHJ1ZSk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LmdldE1vZGVsSW5kZXgyKDApLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LmdldE1vZGVsSW5kZXgyKDEpLCAzKTtcblxuXHRcdFx0XHQvLyBtaW1pYyB1bmRvXG5cdFx0XHRcdGVkaXRvci50ZXh0TW9kZWwuYXBwbHlFZGl0cyhbe1xuXHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUmVwbGFjZSwgaW5kZXg6IDAsIGNvdW50OiAwLCBjZWxsczogW1xuXHRcdFx0XHRcdFx0ZHMuYWRkKG5ldyBUZXN0Q2VsbCh2aWV3TW9kZWwudmlld1R5cGUsIDcsICcjIGhlYWRlciBmJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuQ29kZSwgW10sIGxhbmd1YWdlU2VydmljZSkpLFxuXHRcdFx0XHRcdFx0ZHMuYWRkKG5ldyBUZXN0Q2VsbCh2aWV3TW9kZWwudmlld1R5cGUsIDgsICd2YXIgZyA9IDU7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwgbGFuZ3VhZ2VTZXJ2aWNlKSlcblx0XHRcdFx0XHRdXG5cdFx0XHRcdH1dLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cdFx0XHRcdHZpZXdNb2RlbC51cGRhdGVGb2xkaW5nUmFuZ2VzKGZvbGRpbmdNb2RlbC5yZWdpb25zKTtcblx0XHRcdFx0Y2VsbExpc3Quc2V0SGlkZGVuQXJlYXModmlld01vZGVsLmdldEhpZGRlblJhbmdlcygpLCB0cnVlKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LmdldE1vZGVsSW5kZXgyKDApLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LmdldE1vZGVsSW5kZXgyKDEpLCAxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LmdldE1vZGVsSW5kZXgyKDIpLCAyKTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdub3RlYm9vayBjZWxsIGxpc3QgZ2V0TW9kZWxJbmRleCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgYycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCwgZHMpID0+IHtcblx0XHRcdFx0Y29uc3QgZm9sZGluZ01vZGVsID0gZHMuYWRkKG5ldyBGb2xkaW5nTW9kZWwoKSk7XG5cdFx0XHRcdGZvbGRpbmdNb2RlbC5hdHRhY2hWaWV3TW9kZWwodmlld01vZGVsKTtcblxuXHRcdFx0XHRjb25zdCBjZWxsTGlzdCA9IGNyZWF0ZU5vdGVib29rQ2VsbExpc3QoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRzKTtcblx0XHRcdFx0Y2VsbExpc3QuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cblx0XHRcdFx0dXBkYXRlRm9sZGluZ1N0YXRlQXRJbmRleChmb2xkaW5nTW9kZWwsIDAsIHRydWUpO1xuXHRcdFx0XHR1cGRhdGVGb2xkaW5nU3RhdGVBdEluZGV4KGZvbGRpbmdNb2RlbCwgMiwgdHJ1ZSk7XG5cdFx0XHRcdHZpZXdNb2RlbC51cGRhdGVGb2xkaW5nUmFuZ2VzKGZvbGRpbmdNb2RlbC5yZWdpb25zKTtcblx0XHRcdFx0Y2VsbExpc3Quc2V0SGlkZGVuQXJlYXModmlld01vZGVsLmdldEhpZGRlblJhbmdlcygpLCB0cnVlKTtcblxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LmdldE1vZGVsSW5kZXgyKC0xKSwgMCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3QuZ2V0TW9kZWxJbmRleDIoMCksIDApO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LmdldE1vZGVsSW5kZXgyKDEpLCAyKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRNb2RlbEluZGV4MigyKSwgNCk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblxuXHR0ZXN0KCdub3RlYm9vayB2YWxpZGF0ZSByYW5nZScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC52YWxpZGF0ZVJhbmdlKG51bGwpLCBudWxsKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwudmFsaWRhdGVSYW5nZSh1bmRlZmluZWQpLCBudWxsKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwudmFsaWRhdGVSYW5nZSh7IHN0YXJ0OiAwLCBlbmQ6IDAgfSksIHsgc3RhcnQ6IDAsIGVuZDogMCB9KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwudmFsaWRhdGVSYW5nZSh7IHN0YXJ0OiAwLCBlbmQ6IDIgfSksIHsgc3RhcnQ6IDAsIGVuZDogMiB9KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwudmFsaWRhdGVSYW5nZSh7IHN0YXJ0OiAwLCBlbmQ6IDMgfSksIHsgc3RhcnQ6IDAsIGVuZDogMiB9KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwudmFsaWRhdGVSYW5nZSh7IHN0YXJ0OiAtMSwgZW5kOiAzIH0pLCB7IHN0YXJ0OiAwLCBlbmQ6IDIgfSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLnZhbGlkYXRlUmFuZ2UoeyBzdGFydDogLTEsIGVuZDogMSB9KSwgeyBzdGFydDogMCwgZW5kOiAxIH0pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC52YWxpZGF0ZVJhbmdlKHsgc3RhcnQ6IDIsIGVuZDogMSB9KSwgeyBzdGFydDogMSwgZW5kOiAyIH0pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC52YWxpZGF0ZVJhbmdlKHsgc3RhcnQ6IDIsIGVuZDogLTEgfSksIHsgc3RhcnQ6IDAsIGVuZDogMiB9KTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdub3RlYm9vayB1cGRhdGVTZWxlY3Rpb25TdGF0ZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0XHR2aWV3TW9kZWwudXBkYXRlU2VsZWN0aW9uc1N0YXRlKHsga2luZDogU2VsZWN0aW9uU3RhdGVUeXBlLkluZGV4LCBmb2N1czogeyBzdGFydDogMSwgZW5kOiAyIH0sIHNlbGVjdGlvbnM6IFt7IHN0YXJ0OiAxLCBlbmQ6IDIgfSwgeyBzdGFydDogLTEsIGVuZDogMCB9XSB9KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0U2VsZWN0aW9ucygpLCBbeyBzdGFydDogMSwgZW5kOiAyIH1dKTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdub3RlYm9vayBjZWxsIHNlbGVjdGlvbiB3LyBjZWxsIGRlbGV0aW9uJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0KGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRcdHZpZXdNb2RlbC51cGRhdGVTZWxlY3Rpb25zU3RhdGUoeyBraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsIGZvY3VzOiB7IHN0YXJ0OiAxLCBlbmQ6IDIgfSwgc2VsZWN0aW9uczogW3sgc3RhcnQ6IDEsIGVuZDogMiB9XSB9KTtcblx0XHRcdFx0cnVuRGVsZXRlQWN0aW9uKGVkaXRvciwgdmlld01vZGVsLmNlbGxBdCgxKSEpO1xuXHRcdFx0XHQvLyB2aWV3TW9kZWwuZGVsZXRlQ2VsbCgxLCB0cnVlLCBmYWxzZSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldEZvY3VzKCksIHsgc3RhcnQ6IDAsIGVuZDogMSB9KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0U2VsZWN0aW9ucygpLCBbeyBzdGFydDogMCwgZW5kOiAxIH1dKTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdub3RlYm9vayBjZWxsIHNlbGVjdGlvbiB3LyBjZWxsIGRlbGV0aW9uIGZyb20gYXBwbHlFZGl0cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYyA9IDI7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRcdHZpZXdNb2RlbC51cGRhdGVTZWxlY3Rpb25zU3RhdGUoeyBraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSW5kZXgsIGZvY3VzOiB7IHN0YXJ0OiAxLCBlbmQ6IDIgfSwgc2VsZWN0aW9uczogW3sgc3RhcnQ6IDEsIGVuZDogMiB9XSB9KTtcblx0XHRcdFx0ZWRpdG9yLnRleHRNb2RlbC5hcHBseUVkaXRzKFt7XG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLFxuXHRcdFx0XHRcdGluZGV4OiAxLFxuXHRcdFx0XHRcdGNvdW50OiAxLFxuXHRcdFx0XHRcdGNlbGxzOiBbXVxuXHRcdFx0XHR9XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldEZvY3VzKCksIHsgc3RhcnQ6IDEsIGVuZDogMiB9KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0U2VsZWN0aW9ucygpLCBbeyBzdGFydDogMSwgZW5kOiAyIH1dKTtcblx0XHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsd0JBQXdCO0FBRWpDLFNBQVMsY0FBYyxpQ0FBaUM7QUFDeEQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx1Q0FBdUM7QUFDaEQsU0FBUyxjQUFjLFVBQVUsMEJBQTBCO0FBQzNELFNBQVMsd0JBQXdCLDJCQUEyQixVQUFVLHdCQUF3QjtBQUM5RixTQUFTLCtDQUErQztBQUN4RCxTQUFTLHVCQUF1QjtBQUVoQyxNQUFNLHFCQUFxQixNQUFNO0FBQ2hDLDBDQUF3QztBQUV4QyxPQUFLLHdCQUF3QixXQUFZO0FBQ3hDLFVBQU0sc0JBQXNCLElBQUksZ0NBQWdDO0FBQ2hFLFdBQU8sZ0JBQWdCLG9CQUFvQixPQUFPLEVBQUUsT0FBTyxHQUFHLEtBQUssRUFBRSxDQUFDO0FBRXRFLHdCQUFvQixTQUFTLE1BQU0sQ0FBQyxHQUFHLE1BQU0sT0FBTztBQUNwRCxXQUFPLGdCQUFnQixvQkFBb0IsT0FBTyxFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUUsQ0FBQztBQUN0RSx3QkFBb0IsUUFBUTtBQUFBLEVBQzdCLENBQUM7QUFDRixDQUFDO0FBRUQs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
