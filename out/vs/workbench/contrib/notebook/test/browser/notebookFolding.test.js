import assert from "assert";
import { CellKind } from "../../common/notebookCommon.js";
import { setupInstantiationService, withTestNotebook } from "./testNotebookEditor.js";
import { IUndoRedoService } from "../../../../../platform/undoRedo/common/undoRedo.js";
import { FoldingModel, updateFoldingStateAtIndex } from "../../browser/viewModel/foldingModel.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
suite("Notebook Folding", () => {
  let disposables;
  let instantiationService;
  teardown(() => disposables.dispose());
  ensureNoDisposablesAreLeakedInTestSuite();
  setup(() => {
    disposables = new DisposableStore();
    instantiationService = setupInstantiationService(disposables);
    instantiationService.spy(IUndoRedoService, "pushElement");
  });
  test("Folding based on markdown cells", async function() {
    await withTestNotebook(
      [
        ["# header 1", "markdown", CellKind.Markup, [], {}],
        ["body", "markdown", CellKind.Markup, [], {}],
        ["## header 2.1", "markdown", CellKind.Markup, [], {}],
        ["body 2", "markdown", CellKind.Markup, [], {}],
        ["body 3", "markdown", CellKind.Markup, [], {}],
        ["## header 2.2", "markdown", CellKind.Markup, [], {}],
        ["var e = 7;", "markdown", CellKind.Markup, [], {}]
      ],
      (editor, viewModel, ds) => {
        const foldingController = ds.add(new FoldingModel());
        foldingController.attachViewModel(viewModel);
        assert.strictEqual(foldingController.regions.findRange(1), 0);
        assert.strictEqual(foldingController.regions.findRange(2), 0);
        assert.strictEqual(foldingController.regions.findRange(3), 1);
        assert.strictEqual(foldingController.regions.findRange(4), 1);
        assert.strictEqual(foldingController.regions.findRange(5), 1);
        assert.strictEqual(foldingController.regions.findRange(6), 2);
        assert.strictEqual(foldingController.regions.findRange(7), 2);
      }
    );
  });
  test("Folding not based on code cells", async function() {
    await withTestNotebook(
      [
        ["# header 1", "markdown", CellKind.Markup, [], {}],
        ["body", "markdown", CellKind.Markup, [], {}],
        ["# comment 1", "python", CellKind.Code, [], {}],
        ["body 2", "markdown", CellKind.Markup, [], {}],
        ["body 3\n```\n## comment 2\n```", "markdown", CellKind.Markup, [], {}],
        ["body 4", "markdown", CellKind.Markup, [], {}],
        ["## header 2.1", "markdown", CellKind.Markup, [], {}],
        ["var e = 7;", "python", CellKind.Code, [], {}]
      ],
      (editor, viewModel, ds) => {
        const foldingController = ds.add(new FoldingModel());
        foldingController.attachViewModel(viewModel);
        assert.strictEqual(foldingController.regions.findRange(1), 0);
        assert.strictEqual(foldingController.regions.findRange(2), 0);
        assert.strictEqual(foldingController.regions.findRange(3), 0);
        assert.strictEqual(foldingController.regions.findRange(4), 0);
        assert.strictEqual(foldingController.regions.findRange(5), 0);
        assert.strictEqual(foldingController.regions.findRange(6), 0);
        assert.strictEqual(foldingController.regions.findRange(7), 1);
        assert.strictEqual(foldingController.regions.findRange(8), 1);
      }
    );
  });
  test("Top level header in a cell wins", async function() {
    await withTestNotebook(
      [
        ["# header 1", "markdown", CellKind.Markup, [], {}],
        ["body", "markdown", CellKind.Markup, [], {}],
        ["## header 2.1\n# header3", "markdown", CellKind.Markup, [], {}],
        ["body 2", "markdown", CellKind.Markup, [], {}],
        ["body 3", "markdown", CellKind.Markup, [], {}],
        ["## header 2.2", "markdown", CellKind.Markup, [], {}],
        ["var e = 7;", "markdown", CellKind.Markup, [], {}]
      ],
      (editor, viewModel, ds) => {
        const foldingController = ds.add(new FoldingModel());
        foldingController.attachViewModel(viewModel);
        assert.strictEqual(foldingController.regions.findRange(1), 0);
        assert.strictEqual(foldingController.regions.findRange(2), 0);
        assert.strictEqual(foldingController.regions.getEndLineNumber(0), 2);
        assert.strictEqual(foldingController.regions.findRange(3), 1);
        assert.strictEqual(foldingController.regions.findRange(4), 1);
        assert.strictEqual(foldingController.regions.findRange(5), 1);
        assert.strictEqual(foldingController.regions.getEndLineNumber(1), 7);
        assert.strictEqual(foldingController.regions.findRange(6), 2);
        assert.strictEqual(foldingController.regions.findRange(7), 2);
        assert.strictEqual(foldingController.regions.getEndLineNumber(2), 7);
      }
    );
  });
  test("Folding", async function() {
    await withTestNotebook(
      [
        ["# header 1", "markdown", CellKind.Markup, [], {}],
        ["body", "markdown", CellKind.Markup, [], {}],
        ["## header 2.1", "markdown", CellKind.Markup, [], {}],
        ["body 2", "markdown", CellKind.Markup, [], {}],
        ["body 3", "markdown", CellKind.Markup, [], {}],
        ["## header 2.2", "markdown", CellKind.Markup, [], {}],
        ["var e = 7;", "markdown", CellKind.Markup, [], {}]
      ],
      (editor, viewModel, ds) => {
        const foldingModel = ds.add(new FoldingModel());
        foldingModel.attachViewModel(viewModel);
        updateFoldingStateAtIndex(foldingModel, 0, true);
        viewModel.updateFoldingRanges(foldingModel.regions);
        assert.deepStrictEqual(viewModel.getHiddenRanges(), [
          { start: 1, end: 6 }
        ]);
      }
    );
    await withTestNotebook(
      [
        ["# header 1", "markdown", CellKind.Markup, [], {}],
        ["body", "markdown", CellKind.Markup, [], {}],
        ["## header 2.1\n", "markdown", CellKind.Markup, [], {}],
        ["body 2", "markdown", CellKind.Markup, [], {}],
        ["body 3", "markdown", CellKind.Markup, [], {}],
        ["## header 2.2", "markdown", CellKind.Markup, [], {}],
        ["var e = 7;", "markdown", CellKind.Markup, [], {}]
      ],
      (editor, viewModel, ds) => {
        const foldingModel = ds.add(new FoldingModel());
        foldingModel.attachViewModel(viewModel);
        updateFoldingStateAtIndex(foldingModel, 2, true);
        viewModel.updateFoldingRanges(foldingModel.regions);
        assert.deepStrictEqual(viewModel.getHiddenRanges(), [
          { start: 3, end: 4 }
        ]);
      }
    );
    await withTestNotebook(
      [
        ["# header 1", "markdown", CellKind.Markup, [], {}],
        ["body", "markdown", CellKind.Markup, [], {}],
        ["# header 2.1\n", "markdown", CellKind.Markup, [], {}],
        ["body 2", "markdown", CellKind.Markup, [], {}],
        ["body 3", "markdown", CellKind.Markup, [], {}],
        ["## header 2.2", "markdown", CellKind.Markup, [], {}],
        ["var e = 7;", "markdown", CellKind.Markup, [], {}]
      ],
      (editor, viewModel, ds) => {
        const foldingModel = ds.add(new FoldingModel());
        foldingModel.attachViewModel(viewModel);
        updateFoldingStateAtIndex(foldingModel, 2, true);
        viewModel.updateFoldingRanges(foldingModel.regions);
        assert.deepStrictEqual(viewModel.getHiddenRanges(), [
          { start: 3, end: 6 }
        ]);
      }
    );
  });
  test("Nested Folding", async function() {
    await withTestNotebook(
      [
        ["# header 1", "markdown", CellKind.Markup, [], {}],
        ["body", "markdown", CellKind.Markup, [], {}],
        ["# header 2.1\n", "markdown", CellKind.Markup, [], {}],
        ["body 2", "markdown", CellKind.Markup, [], {}],
        ["body 3", "markdown", CellKind.Markup, [], {}],
        ["## header 2.2", "markdown", CellKind.Markup, [], {}],
        ["var e = 7;", "markdown", CellKind.Markup, [], {}]
      ],
      (editor, viewModel, ds) => {
        const foldingModel = ds.add(new FoldingModel());
        foldingModel.attachViewModel(viewModel);
        updateFoldingStateAtIndex(foldingModel, 0, true);
        viewModel.updateFoldingRanges(foldingModel.regions);
        assert.deepStrictEqual(viewModel.getHiddenRanges(), [
          { start: 1, end: 1 }
        ]);
        updateFoldingStateAtIndex(foldingModel, 5, true);
        updateFoldingStateAtIndex(foldingModel, 2, true);
        viewModel.updateFoldingRanges(foldingModel.regions);
        assert.deepStrictEqual(viewModel.getHiddenRanges(), [
          { start: 1, end: 1 },
          { start: 3, end: 6 }
        ]);
        updateFoldingStateAtIndex(foldingModel, 2, false);
        viewModel.updateFoldingRanges(foldingModel.regions);
        assert.deepStrictEqual(viewModel.getHiddenRanges(), [
          { start: 1, end: 1 },
          { start: 6, end: 6 }
        ]);
      }
    );
  });
  test("Folding Memento", async function() {
    await withTestNotebook(
      [
        ["# header 1", "markdown", CellKind.Markup, [], {}],
        ["body", "markdown", CellKind.Markup, [], {}],
        ["# header 2.1\n", "markdown", CellKind.Markup, [], {}],
        ["body 2", "markdown", CellKind.Markup, [], {}],
        ["body 3", "markdown", CellKind.Markup, [], {}],
        ["## header 2.2", "markdown", CellKind.Markup, [], {}],
        ["var e = 7;", "markdown", CellKind.Markup, [], {}],
        ["# header 2.1\n", "markdown", CellKind.Markup, [], {}],
        ["body 2", "markdown", CellKind.Markup, [], {}],
        ["body 3", "markdown", CellKind.Markup, [], {}],
        ["## header 2.2", "markdown", CellKind.Markup, [], {}],
        ["var e = 7;", "markdown", CellKind.Markup, [], {}]
      ],
      (editor, viewModel, ds) => {
        const foldingModel = ds.add(new FoldingModel());
        foldingModel.attachViewModel(viewModel);
        foldingModel.applyMemento([{ start: 2, end: 6 }]);
        viewModel.updateFoldingRanges(foldingModel.regions);
        assert.deepStrictEqual(viewModel.getHiddenRanges(), [
          { start: 3, end: 6 }
        ]);
      }
    );
    await withTestNotebook(
      [
        ["# header 1", "markdown", CellKind.Markup, [], {}],
        ["body", "markdown", CellKind.Markup, [], {}],
        ["# header 2.1\n", "markdown", CellKind.Markup, [], {}],
        ["body 2", "markdown", CellKind.Markup, [], {}],
        ["body 3", "markdown", CellKind.Markup, [], {}],
        ["## header 2.2", "markdown", CellKind.Markup, [], {}],
        ["var e = 7;", "markdown", CellKind.Markup, [], {}],
        ["# header 2.1\n", "markdown", CellKind.Markup, [], {}],
        ["body 2", "markdown", CellKind.Markup, [], {}],
        ["body 3", "markdown", CellKind.Markup, [], {}],
        ["## header 2.2", "markdown", CellKind.Markup, [], {}],
        ["var e = 7;", "markdown", CellKind.Markup, [], {}]
      ],
      (editor, viewModel, ds) => {
        const foldingModel = ds.add(new FoldingModel());
        foldingModel.attachViewModel(viewModel);
        foldingModel.applyMemento([
          { start: 5, end: 6 },
          { start: 10, end: 11 }
        ]);
        viewModel.updateFoldingRanges(foldingModel.regions);
        assert.deepStrictEqual(viewModel.getHiddenRanges(), [
          { start: 6, end: 6 },
          { start: 11, end: 11 }
        ]);
      }
    );
    await withTestNotebook(
      [
        ["# header 1", "markdown", CellKind.Markup, [], {}],
        ["body", "markdown", CellKind.Markup, [], {}],
        ["# header 2.1\n", "markdown", CellKind.Markup, [], {}],
        ["body 2", "markdown", CellKind.Markup, [], {}],
        ["body 3", "markdown", CellKind.Markup, [], {}],
        ["## header 2.2", "markdown", CellKind.Markup, [], {}],
        ["var e = 7;", "markdown", CellKind.Markup, [], {}],
        ["# header 2.1\n", "markdown", CellKind.Markup, [], {}],
        ["body 2", "markdown", CellKind.Markup, [], {}],
        ["body 3", "markdown", CellKind.Markup, [], {}],
        ["## header 2.2", "markdown", CellKind.Markup, [], {}],
        ["var e = 7;", "markdown", CellKind.Markup, [], {}]
      ],
      (editor, viewModel, ds) => {
        const foldingModel = ds.add(new FoldingModel());
        foldingModel.attachViewModel(viewModel);
        foldingModel.applyMemento([
          { start: 5, end: 6 },
          { start: 7, end: 11 }
        ]);
        viewModel.updateFoldingRanges(foldingModel.regions);
        assert.deepStrictEqual(viewModel.getHiddenRanges(), [
          { start: 6, end: 6 },
          { start: 8, end: 11 }
        ]);
      }
    );
  });
  test("View Index", async function() {
    await withTestNotebook(
      [
        ["# header 1", "markdown", CellKind.Markup, [], {}],
        ["body", "markdown", CellKind.Markup, [], {}],
        ["# header 2.1\n", "markdown", CellKind.Markup, [], {}],
        ["body 2", "markdown", CellKind.Markup, [], {}],
        ["body 3", "markdown", CellKind.Markup, [], {}],
        ["## header 2.2", "markdown", CellKind.Markup, [], {}],
        ["var e = 7;", "markdown", CellKind.Markup, [], {}],
        ["# header 2.1\n", "markdown", CellKind.Markup, [], {}],
        ["body 2", "markdown", CellKind.Markup, [], {}],
        ["body 3", "markdown", CellKind.Markup, [], {}],
        ["## header 2.2", "markdown", CellKind.Markup, [], {}],
        ["var e = 7;", "markdown", CellKind.Markup, [], {}]
      ],
      (editor, viewModel, ds) => {
        const foldingModel = ds.add(new FoldingModel());
        foldingModel.attachViewModel(viewModel);
        foldingModel.applyMemento([{ start: 2, end: 6 }]);
        viewModel.updateFoldingRanges(foldingModel.regions);
        assert.deepStrictEqual(viewModel.getHiddenRanges(), [
          { start: 3, end: 6 }
        ]);
        assert.strictEqual(viewModel.getNextVisibleCellIndex(1), 2);
        assert.strictEqual(viewModel.getNextVisibleCellIndex(2), 7);
        assert.strictEqual(viewModel.getNextVisibleCellIndex(3), 7);
        assert.strictEqual(viewModel.getNextVisibleCellIndex(4), 7);
        assert.strictEqual(viewModel.getNextVisibleCellIndex(5), 7);
        assert.strictEqual(viewModel.getNextVisibleCellIndex(6), 7);
        assert.strictEqual(viewModel.getNextVisibleCellIndex(7), 8);
      }
    );
    await withTestNotebook(
      [
        ["# header 1", "markdown", CellKind.Markup, [], {}],
        ["body", "markdown", CellKind.Markup, [], {}],
        ["# header 2.1\n", "markdown", CellKind.Markup, [], {}],
        ["body 2", "markdown", CellKind.Markup, [], {}],
        ["body 3", "markdown", CellKind.Markup, [], {}],
        ["## header 2.2", "markdown", CellKind.Markup, [], {}],
        ["var e = 7;", "markdown", CellKind.Markup, [], {}],
        ["# header 2.1\n", "markdown", CellKind.Markup, [], {}],
        ["body 2", "markdown", CellKind.Markup, [], {}],
        ["body 3", "markdown", CellKind.Markup, [], {}],
        ["## header 2.2", "markdown", CellKind.Markup, [], {}],
        ["var e = 7;", "markdown", CellKind.Markup, [], {}]
      ],
      (editor, viewModel, ds) => {
        const foldingModel = ds.add(new FoldingModel());
        foldingModel.attachViewModel(viewModel);
        foldingModel.applyMemento([
          { start: 5, end: 6 },
          { start: 10, end: 11 }
        ]);
        viewModel.updateFoldingRanges(foldingModel.regions);
        assert.deepStrictEqual(viewModel.getHiddenRanges(), [
          { start: 6, end: 6 },
          { start: 11, end: 11 }
        ]);
        assert.strictEqual(viewModel.getNextVisibleCellIndex(4), 5);
        assert.strictEqual(viewModel.getNextVisibleCellIndex(5), 7);
        assert.strictEqual(viewModel.getNextVisibleCellIndex(6), 7);
        assert.strictEqual(viewModel.getNextVisibleCellIndex(9), 10);
        assert.strictEqual(viewModel.getNextVisibleCellIndex(10), 12);
        assert.strictEqual(viewModel.getNextVisibleCellIndex(11), 12);
      }
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay90ZXN0L2Jyb3dzZXIvbm90ZWJvb2tGb2xkaW5nLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBDZWxsS2luZCB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBzZXR1cEluc3RhbnRpYXRpb25TZXJ2aWNlLCB3aXRoVGVzdE5vdGVib29rIH0gZnJvbSAnLi90ZXN0Tm90ZWJvb2tFZGl0b3IuanMnO1xuaW1wb3J0IHsgSVVuZG9SZWRvU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuZG9SZWRvL2NvbW1vbi91bmRvUmVkby5qcyc7XG5pbXBvcnQgeyBGb2xkaW5nTW9kZWwsIHVwZGF0ZUZvbGRpbmdTdGF0ZUF0SW5kZXggfSBmcm9tICcuLi8uLi9icm93c2VyL3ZpZXdNb2RlbC9mb2xkaW5nTW9kZWwuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5zdWl0ZSgnTm90ZWJvb2sgRm9sZGluZycsICgpID0+IHtcblx0bGV0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXG5cdHRlYXJkb3duKCgpID0+IGRpc3Bvc2FibGVzLmRpc3Bvc2UoKSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc2V0dXBJbnN0YW50aWF0aW9uU2VydmljZShkaXNwb3NhYmxlcyk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3B5KElVbmRvUmVkb1NlcnZpY2UsICdwdXNoRWxlbWVudCcpO1xuXHR9KTtcblxuXG5cdHRlc3QoJ0ZvbGRpbmcgYmFzZWQgb24gbWFya2Rvd24gY2VsbHMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WycjIGhlYWRlciAxJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ2JvZHknLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyMgaGVhZGVyIDIuMScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wydib2R5IDInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnYm9keSAzJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMjIGhlYWRlciAyLjInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGUgPSA3OycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdF0sXG5cdFx0XHQoZWRpdG9yLCB2aWV3TW9kZWwsIGRzKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGZvbGRpbmdDb250cm9sbGVyID0gZHMuYWRkKG5ldyBGb2xkaW5nTW9kZWwoKSk7XG5cdFx0XHRcdGZvbGRpbmdDb250cm9sbGVyLmF0dGFjaFZpZXdNb2RlbCh2aWV3TW9kZWwpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb2xkaW5nQ29udHJvbGxlci5yZWdpb25zLmZpbmRSYW5nZSgxKSwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb2xkaW5nQ29udHJvbGxlci5yZWdpb25zLmZpbmRSYW5nZSgyKSwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb2xkaW5nQ29udHJvbGxlci5yZWdpb25zLmZpbmRSYW5nZSgzKSwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb2xkaW5nQ29udHJvbGxlci5yZWdpb25zLmZpbmRSYW5nZSg0KSwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb2xkaW5nQ29udHJvbGxlci5yZWdpb25zLmZpbmRSYW5nZSg1KSwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb2xkaW5nQ29udHJvbGxlci5yZWdpb25zLmZpbmRSYW5nZSg2KSwgMik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb2xkaW5nQ29udHJvbGxlci5yZWdpb25zLmZpbmRSYW5nZSg3KSwgMik7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnRm9sZGluZyBub3QgYmFzZWQgb24gY29kZSBjZWxscycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIDEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnYm9keScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0WycjIGNvbW1lbnQgMScsICdweXRob24nLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ2JvZHkgMicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wydib2R5IDNcXG5gYGBcXG4jIyBjb21tZW50IDJcXG5gYGAnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnYm9keSA0JywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMjIGhlYWRlciAyLjEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGUgPSA3OycsICdweXRob24nLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCwgZHMpID0+IHtcblx0XHRcdFx0Y29uc3QgZm9sZGluZ0NvbnRyb2xsZXIgPSBkcy5hZGQobmV3IEZvbGRpbmdNb2RlbCgpKTtcblx0XHRcdFx0Zm9sZGluZ0NvbnRyb2xsZXIuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbGRpbmdDb250cm9sbGVyLnJlZ2lvbnMuZmluZFJhbmdlKDEpLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbGRpbmdDb250cm9sbGVyLnJlZ2lvbnMuZmluZFJhbmdlKDIpLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbGRpbmdDb250cm9sbGVyLnJlZ2lvbnMuZmluZFJhbmdlKDMpLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbGRpbmdDb250cm9sbGVyLnJlZ2lvbnMuZmluZFJhbmdlKDQpLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbGRpbmdDb250cm9sbGVyLnJlZ2lvbnMuZmluZFJhbmdlKDUpLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbGRpbmdDb250cm9sbGVyLnJlZ2lvbnMuZmluZFJhbmdlKDYpLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbGRpbmdDb250cm9sbGVyLnJlZ2lvbnMuZmluZFJhbmdlKDcpLCAxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbGRpbmdDb250cm9sbGVyLnJlZ2lvbnMuZmluZFJhbmdlKDgpLCAxKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdUb3AgbGV2ZWwgaGVhZGVyIGluIGEgY2VsbCB3aW5zJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgMScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wydib2R5JywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMjIGhlYWRlciAyLjFcXG4jIGhlYWRlcjMnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnYm9keSAyJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ2JvZHkgMycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0WycjIyBoZWFkZXIgMi4yJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBlID0gNzsnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRdLFxuXHRcdFx0KGVkaXRvciwgdmlld01vZGVsLCBkcykgPT4ge1xuXHRcdFx0XHRjb25zdCBmb2xkaW5nQ29udHJvbGxlciA9IGRzLmFkZChuZXcgRm9sZGluZ01vZGVsKCkpO1xuXHRcdFx0XHRmb2xkaW5nQ29udHJvbGxlci5hdHRhY2hWaWV3TW9kZWwodmlld01vZGVsKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9sZGluZ0NvbnRyb2xsZXIucmVnaW9ucy5maW5kUmFuZ2UoMSksIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9sZGluZ0NvbnRyb2xsZXIucmVnaW9ucy5maW5kUmFuZ2UoMiksIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9sZGluZ0NvbnRyb2xsZXIucmVnaW9ucy5nZXRFbmRMaW5lTnVtYmVyKDApLCAyKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9sZGluZ0NvbnRyb2xsZXIucmVnaW9ucy5maW5kUmFuZ2UoMyksIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9sZGluZ0NvbnRyb2xsZXIucmVnaW9ucy5maW5kUmFuZ2UoNCksIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9sZGluZ0NvbnRyb2xsZXIucmVnaW9ucy5maW5kUmFuZ2UoNSksIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9sZGluZ0NvbnRyb2xsZXIucmVnaW9ucy5nZXRFbmRMaW5lTnVtYmVyKDEpLCA3KTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9sZGluZ0NvbnRyb2xsZXIucmVnaW9ucy5maW5kUmFuZ2UoNiksIDIpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9sZGluZ0NvbnRyb2xsZXIucmVnaW9ucy5maW5kUmFuZ2UoNyksIDIpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9sZGluZ0NvbnRyb2xsZXIucmVnaW9ucy5nZXRFbmRMaW5lTnVtYmVyKDIpLCA3KTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdGb2xkaW5nJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgMScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wydib2R5JywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMjIGhlYWRlciAyLjEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnYm9keSAyJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ2JvZHkgMycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0WycjIyBoZWFkZXIgMi4yJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBlID0gNzsnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRdLFxuXHRcdFx0KGVkaXRvciwgdmlld01vZGVsLCBkcykgPT4ge1xuXHRcdFx0XHRjb25zdCBmb2xkaW5nTW9kZWwgPSBkcy5hZGQobmV3IEZvbGRpbmdNb2RlbCgpKTtcblx0XHRcdFx0Zm9sZGluZ01vZGVsLmF0dGFjaFZpZXdNb2RlbCh2aWV3TW9kZWwpO1xuXHRcdFx0XHR1cGRhdGVGb2xkaW5nU3RhdGVBdEluZGV4KGZvbGRpbmdNb2RlbCwgMCwgdHJ1ZSk7XG5cdFx0XHRcdHZpZXdNb2RlbC51cGRhdGVGb2xkaW5nUmFuZ2VzKGZvbGRpbmdNb2RlbC5yZWdpb25zKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0SGlkZGVuUmFuZ2VzKCksIFtcblx0XHRcdFx0XHR7IHN0YXJ0OiAxLCBlbmQ6IDYgfVxuXHRcdFx0XHRdKTtcblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WycjIGhlYWRlciAxJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ2JvZHknLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyMgaGVhZGVyIDIuMVxcbicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wydib2R5IDInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnYm9keSAzJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMjIGhlYWRlciAyLjInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGUgPSA3OycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdF0sXG5cdFx0XHQoZWRpdG9yLCB2aWV3TW9kZWwsIGRzKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGZvbGRpbmdNb2RlbCA9IGRzLmFkZChuZXcgRm9sZGluZ01vZGVsKCkpO1xuXHRcdFx0XHRmb2xkaW5nTW9kZWwuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cdFx0XHRcdHVwZGF0ZUZvbGRpbmdTdGF0ZUF0SW5kZXgoZm9sZGluZ01vZGVsLCAyLCB0cnVlKTtcblx0XHRcdFx0dmlld01vZGVsLnVwZGF0ZUZvbGRpbmdSYW5nZXMoZm9sZGluZ01vZGVsLnJlZ2lvbnMpO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldEhpZGRlblJhbmdlcygpLCBbXG5cdFx0XHRcdFx0eyBzdGFydDogMywgZW5kOiA0IH1cblx0XHRcdFx0XSk7XG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgMScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wydib2R5JywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIDIuMVxcbicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wydib2R5IDInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnYm9keSAzJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMjIGhlYWRlciAyLjInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGUgPSA3OycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdF0sXG5cdFx0XHQoZWRpdG9yLCB2aWV3TW9kZWwsIGRzKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGZvbGRpbmdNb2RlbCA9IGRzLmFkZChuZXcgRm9sZGluZ01vZGVsKCkpO1xuXHRcdFx0XHRmb2xkaW5nTW9kZWwuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cdFx0XHRcdHVwZGF0ZUZvbGRpbmdTdGF0ZUF0SW5kZXgoZm9sZGluZ01vZGVsLCAyLCB0cnVlKTtcblx0XHRcdFx0dmlld01vZGVsLnVwZGF0ZUZvbGRpbmdSYW5nZXMoZm9sZGluZ01vZGVsLnJlZ2lvbnMpO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldEhpZGRlblJhbmdlcygpLCBbXG5cdFx0XHRcdFx0eyBzdGFydDogMywgZW5kOiA2IH1cblx0XHRcdFx0XSk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnTmVzdGVkIEZvbGRpbmcnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WycjIGhlYWRlciAxJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ2JvZHknLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgMi4xXFxuJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ2JvZHkgMicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wydib2R5IDMnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyMgaGVhZGVyIDIuMicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgZSA9IDc7JywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCwgZHMpID0+IHtcblx0XHRcdFx0Y29uc3QgZm9sZGluZ01vZGVsID0gZHMuYWRkKG5ldyBGb2xkaW5nTW9kZWwoKSk7XG5cdFx0XHRcdGZvbGRpbmdNb2RlbC5hdHRhY2hWaWV3TW9kZWwodmlld01vZGVsKTtcblx0XHRcdFx0dXBkYXRlRm9sZGluZ1N0YXRlQXRJbmRleChmb2xkaW5nTW9kZWwsIDAsIHRydWUpO1xuXHRcdFx0XHR2aWV3TW9kZWwudXBkYXRlRm9sZGluZ1Jhbmdlcyhmb2xkaW5nTW9kZWwucmVnaW9ucyk7XG5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0SGlkZGVuUmFuZ2VzKCksIFtcblx0XHRcdFx0XHR7IHN0YXJ0OiAxLCBlbmQ6IDEgfVxuXHRcdFx0XHRdKTtcblxuXHRcdFx0XHR1cGRhdGVGb2xkaW5nU3RhdGVBdEluZGV4KGZvbGRpbmdNb2RlbCwgNSwgdHJ1ZSk7XG5cdFx0XHRcdHVwZGF0ZUZvbGRpbmdTdGF0ZUF0SW5kZXgoZm9sZGluZ01vZGVsLCAyLCB0cnVlKTtcblx0XHRcdFx0dmlld01vZGVsLnVwZGF0ZUZvbGRpbmdSYW5nZXMoZm9sZGluZ01vZGVsLnJlZ2lvbnMpO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldEhpZGRlblJhbmdlcygpLCBbXG5cdFx0XHRcdFx0eyBzdGFydDogMSwgZW5kOiAxIH0sXG5cdFx0XHRcdFx0eyBzdGFydDogMywgZW5kOiA2IH1cblx0XHRcdFx0XSk7XG5cblx0XHRcdFx0dXBkYXRlRm9sZGluZ1N0YXRlQXRJbmRleChmb2xkaW5nTW9kZWwsIDIsIGZhbHNlKTtcblx0XHRcdFx0dmlld01vZGVsLnVwZGF0ZUZvbGRpbmdSYW5nZXMoZm9sZGluZ01vZGVsLnJlZ2lvbnMpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRIaWRkZW5SYW5nZXMoKSwgW1xuXHRcdFx0XHRcdHsgc3RhcnQ6IDEsIGVuZDogMSB9LFxuXHRcdFx0XHRcdHsgc3RhcnQ6IDYsIGVuZDogNiB9XG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdC8vIHZpZXdNb2RlbC5pbnNlcnRDZWxsKDcsIG5ldyBUZXN0Q2VsbCh2aWV3TW9kZWwudmlld1R5cGUsIDcsIFsndmFyIGMgPSA4OyddLCAnbWFya2Rvd24nLCBDZWxsS2luZC5Db2RlLCBbXSksIHRydWUpO1xuXG5cdFx0XHRcdC8vIGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldEhpZGRlblJhbmdlcygpLCBbXG5cdFx0XHRcdC8vIFx0eyBzdGFydDogMSwgZW5kOiAxIH0sXG5cdFx0XHRcdC8vIFx0eyBzdGFydDogNiwgZW5kOiA3IH1cblx0XHRcdFx0Ly8gXSk7XG5cblx0XHRcdFx0Ly8gdmlld01vZGVsLmluc2VydENlbGwoMSwgbmV3IFRlc3RDZWxsKHZpZXdNb2RlbC52aWV3VHlwZSwgOCwgWyd2YXIgYyA9IDk7J10sICdtYXJrZG93bicsIENlbGxLaW5kLkNvZGUsIFtdKSwgdHJ1ZSk7XG5cdFx0XHRcdC8vIGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldEhpZGRlblJhbmdlcygpLCBbXG5cdFx0XHRcdC8vIFx0Ly8gdGhlIGZpcnN0IGNvbGxhcHNlZCByYW5nZSBpcyBub3cgZXhwYW5kZWQgYXMgd2UgaW5zZXJ0IGNvbnRlbnQgaW50byBpdC5cblx0XHRcdFx0Ly8gXHQvLyB7IHN0YXJ0OiAxLH0sXG5cdFx0XHRcdC8vIFx0eyBzdGFydDogNywgZW5kOiA4IH1cblx0XHRcdFx0Ly8gXSk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnRm9sZGluZyBNZW1lbnRvJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgMScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wydib2R5JywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIDIuMVxcbicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wydib2R5IDInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnYm9keSAzJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMjIGhlYWRlciAyLjInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGUgPSA3OycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciAyLjFcXG4nLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnYm9keSAyJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ2JvZHkgMycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0WycjIyBoZWFkZXIgMi4yJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBlID0gNzsnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRdLFxuXHRcdFx0KGVkaXRvciwgdmlld01vZGVsLCBkcykgPT4ge1xuXHRcdFx0XHRjb25zdCBmb2xkaW5nTW9kZWwgPSBkcy5hZGQobmV3IEZvbGRpbmdNb2RlbCgpKTtcblx0XHRcdFx0Zm9sZGluZ01vZGVsLmF0dGFjaFZpZXdNb2RlbCh2aWV3TW9kZWwpO1xuXHRcdFx0XHRmb2xkaW5nTW9kZWwuYXBwbHlNZW1lbnRvKFt7IHN0YXJ0OiAyLCBlbmQ6IDYgfV0pO1xuXHRcdFx0XHR2aWV3TW9kZWwudXBkYXRlRm9sZGluZ1Jhbmdlcyhmb2xkaW5nTW9kZWwucmVnaW9ucyk7XG5cblx0XHRcdFx0Ly8gTm90ZSB0aGF0IGhpZGRlbiByYW5nZXMgIT09IGZvbGRpbmcgcmFuZ2VzXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldEhpZGRlblJhbmdlcygpLCBbXG5cdFx0XHRcdFx0eyBzdGFydDogMywgZW5kOiA2IH1cblx0XHRcdFx0XSk7XG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgMScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wydib2R5JywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIDIuMVxcbicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wydib2R5IDInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnYm9keSAzJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMjIGhlYWRlciAyLjInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGUgPSA3OycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciAyLjFcXG4nLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnYm9keSAyJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ2JvZHkgMycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0WycjIyBoZWFkZXIgMi4yJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBlID0gNzsnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRdLFxuXHRcdFx0KGVkaXRvciwgdmlld01vZGVsLCBkcykgPT4ge1xuXHRcdFx0XHRjb25zdCBmb2xkaW5nTW9kZWwgPSBkcy5hZGQobmV3IEZvbGRpbmdNb2RlbCgpKTtcblx0XHRcdFx0Zm9sZGluZ01vZGVsLmF0dGFjaFZpZXdNb2RlbCh2aWV3TW9kZWwpO1xuXHRcdFx0XHRmb2xkaW5nTW9kZWwuYXBwbHlNZW1lbnRvKFtcblx0XHRcdFx0XHR7IHN0YXJ0OiA1LCBlbmQ6IDYgfSxcblx0XHRcdFx0XHR7IHN0YXJ0OiAxMCwgZW5kOiAxMSB9LFxuXHRcdFx0XHRdKTtcblx0XHRcdFx0dmlld01vZGVsLnVwZGF0ZUZvbGRpbmdSYW5nZXMoZm9sZGluZ01vZGVsLnJlZ2lvbnMpO1xuXG5cdFx0XHRcdC8vIE5vdGUgdGhhdCBoaWRkZW4gcmFuZ2VzICE9PSBmb2xkaW5nIHJhbmdlc1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRIaWRkZW5SYW5nZXMoKSwgW1xuXHRcdFx0XHRcdHsgc3RhcnQ6IDYsIGVuZDogNiB9LFxuXHRcdFx0XHRcdHsgc3RhcnQ6IDExLCBlbmQ6IDExIH1cblx0XHRcdFx0XSk7XG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgMScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wydib2R5JywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIDIuMVxcbicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wydib2R5IDInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnYm9keSAzJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMjIGhlYWRlciAyLjInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGUgPSA3OycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciAyLjFcXG4nLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnYm9keSAyJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ2JvZHkgMycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0WycjIyBoZWFkZXIgMi4yJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBlID0gNzsnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRdLFxuXHRcdFx0KGVkaXRvciwgdmlld01vZGVsLCBkcykgPT4ge1xuXHRcdFx0XHRjb25zdCBmb2xkaW5nTW9kZWwgPSBkcy5hZGQobmV3IEZvbGRpbmdNb2RlbCgpKTtcblx0XHRcdFx0Zm9sZGluZ01vZGVsLmF0dGFjaFZpZXdNb2RlbCh2aWV3TW9kZWwpO1xuXHRcdFx0XHRmb2xkaW5nTW9kZWwuYXBwbHlNZW1lbnRvKFtcblx0XHRcdFx0XHR7IHN0YXJ0OiA1LCBlbmQ6IDYgfSxcblx0XHRcdFx0XHR7IHN0YXJ0OiA3LCBlbmQ6IDExIH0sXG5cdFx0XHRcdF0pO1xuXHRcdFx0XHR2aWV3TW9kZWwudXBkYXRlRm9sZGluZ1Jhbmdlcyhmb2xkaW5nTW9kZWwucmVnaW9ucyk7XG5cblx0XHRcdFx0Ly8gTm90ZSB0aGF0IGhpZGRlbiByYW5nZXMgIT09IGZvbGRpbmcgcmFuZ2VzXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldEhpZGRlblJhbmdlcygpLCBbXG5cdFx0XHRcdFx0eyBzdGFydDogNiwgZW5kOiA2IH0sXG5cdFx0XHRcdFx0eyBzdGFydDogOCwgZW5kOiAxMSB9XG5cdFx0XHRcdF0pO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1ZpZXcgSW5kZXgnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WycjIGhlYWRlciAxJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ2JvZHknLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgMi4xXFxuJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ2JvZHkgMicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wydib2R5IDMnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyMgaGVhZGVyIDIuMicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgZSA9IDc7JywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIDIuMVxcbicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wydib2R5IDInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnYm9keSAzJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMjIGhlYWRlciAyLjInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGUgPSA3OycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdF0sXG5cdFx0XHQoZWRpdG9yLCB2aWV3TW9kZWwsIGRzKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGZvbGRpbmdNb2RlbCA9IGRzLmFkZChuZXcgRm9sZGluZ01vZGVsKCkpO1xuXHRcdFx0XHRmb2xkaW5nTW9kZWwuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cdFx0XHRcdGZvbGRpbmdNb2RlbC5hcHBseU1lbWVudG8oW3sgc3RhcnQ6IDIsIGVuZDogNiB9XSk7XG5cdFx0XHRcdHZpZXdNb2RlbC51cGRhdGVGb2xkaW5nUmFuZ2VzKGZvbGRpbmdNb2RlbC5yZWdpb25zKTtcblxuXHRcdFx0XHQvLyBOb3RlIHRoYXQgaGlkZGVuIHJhbmdlcyAhPT0gZm9sZGluZyByYW5nZXNcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0SGlkZGVuUmFuZ2VzKCksIFtcblx0XHRcdFx0XHR7IHN0YXJ0OiAzLCBlbmQ6IDYgfVxuXHRcdFx0XHRdKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmdldE5leHRWaXNpYmxlQ2VsbEluZGV4KDEpLCAyKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXROZXh0VmlzaWJsZUNlbGxJbmRleCgyKSwgNyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0TmV4dFZpc2libGVDZWxsSW5kZXgoMyksIDcpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmdldE5leHRWaXNpYmxlQ2VsbEluZGV4KDQpLCA3KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXROZXh0VmlzaWJsZUNlbGxJbmRleCg1KSwgNyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0TmV4dFZpc2libGVDZWxsSW5kZXgoNiksIDcpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmdldE5leHRWaXNpYmxlQ2VsbEluZGV4KDcpLCA4KTtcblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WycjIGhlYWRlciAxJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ2JvZHknLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgMi4xXFxuJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ2JvZHkgMicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wydib2R5IDMnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyMgaGVhZGVyIDIuMicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgZSA9IDc7JywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIDIuMVxcbicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wydib2R5IDInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnYm9keSAzJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMjIGhlYWRlciAyLjInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGUgPSA3OycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdF0sXG5cdFx0XHQoZWRpdG9yLCB2aWV3TW9kZWwsIGRzKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGZvbGRpbmdNb2RlbCA9IGRzLmFkZChuZXcgRm9sZGluZ01vZGVsKCkpO1xuXHRcdFx0XHRmb2xkaW5nTW9kZWwuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cdFx0XHRcdGZvbGRpbmdNb2RlbC5hcHBseU1lbWVudG8oW1xuXHRcdFx0XHRcdHsgc3RhcnQ6IDUsIGVuZDogNiB9LFxuXHRcdFx0XHRcdHsgc3RhcnQ6IDEwLCBlbmQ6IDExIH0sXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdHZpZXdNb2RlbC51cGRhdGVGb2xkaW5nUmFuZ2VzKGZvbGRpbmdNb2RlbC5yZWdpb25zKTtcblxuXHRcdFx0XHQvLyBOb3RlIHRoYXQgaGlkZGVuIHJhbmdlcyAhPT0gZm9sZGluZyByYW5nZXNcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0SGlkZGVuUmFuZ2VzKCksIFtcblx0XHRcdFx0XHR7IHN0YXJ0OiA2LCBlbmQ6IDYgfSxcblx0XHRcdFx0XHR7IHN0YXJ0OiAxMSwgZW5kOiAxMSB9XG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdC8vIGZvbGRpbmcgcmFuZ2VzXG5cdFx0XHRcdC8vIFs1LCA2XVxuXHRcdFx0XHQvLyBbMTAsIDExXVxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmdldE5leHRWaXNpYmxlQ2VsbEluZGV4KDQpLCA1KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXROZXh0VmlzaWJsZUNlbGxJbmRleCg1KSwgNyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0TmV4dFZpc2libGVDZWxsSW5kZXgoNiksIDcpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0TmV4dFZpc2libGVDZWxsSW5kZXgoOSksIDEwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXROZXh0VmlzaWJsZUNlbGxJbmRleCgxMCksIDEyKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXROZXh0VmlzaWJsZUNl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
