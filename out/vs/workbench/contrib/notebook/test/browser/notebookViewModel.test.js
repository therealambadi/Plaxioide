import assert from "assert";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { IBulkEditService } from "../../../../../editor/browser/services/bulkEditService.js";
import { TrackedRangeStickiness } from "../../../../../editor/common/model.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { TestThemeService } from "../../../../../platform/theme/test/common/testThemeService.js";
import { IUndoRedoService } from "../../../../../platform/undoRedo/common/undoRedo.js";
import { insertCellAtIndex, runDeleteAction } from "../../browser/controller/cellOperations.js";
import { NotebookEventDispatcher } from "../../browser/viewModel/eventDispatcher.js";
import { NotebookViewModel } from "../../browser/viewModel/notebookViewModelImpl.js";
import { ViewContext } from "../../browser/viewModel/viewContext.js";
import { NotebookTextModel } from "../../common/model/notebookTextModel.js";
import { CellKind, diff } from "../../common/notebookCommon.js";
import { NotebookOptions } from "../../browser/notebookOptions.js";
import { NotebookEditorTestModel, setupInstantiationService, withTestNotebook } from "./testNotebookEditor.js";
import { INotebookExecutionStateService } from "../../common/notebookExecutionStateService.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { mainWindow } from "../../../../../base/browser/window.js";
import { ICodeEditorService } from "../../../../../editor/browser/services/codeEditorService.js";
import { ILanguageDetectionService } from "../../../../services/languageDetection/common/languageDetectionWorkerService.js";
suite("NotebookViewModel", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  let disposables;
  let instantiationService;
  let textModelService;
  let bulkEditService;
  let undoRedoService;
  let modelService;
  let languageService;
  let languageDetectionService;
  let notebookExecutionStateService;
  suiteSetup(() => {
    disposables = new DisposableStore();
    instantiationService = setupInstantiationService(disposables);
    textModelService = instantiationService.get(ITextModelService);
    bulkEditService = instantiationService.get(IBulkEditService);
    undoRedoService = instantiationService.get(IUndoRedoService);
    modelService = instantiationService.get(IModelService);
    languageService = instantiationService.get(ILanguageService);
    languageDetectionService = instantiationService.get(ILanguageDetectionService);
    notebookExecutionStateService = instantiationService.get(INotebookExecutionStateService);
    instantiationService.stub(IConfigurationService, new TestConfigurationService());
    instantiationService.stub(IThemeService, new TestThemeService());
  });
  suiteTeardown(() => disposables.dispose());
  test("ctor", function() {
    const notebook = new NotebookTextModel("notebook", URI.parse("test"), [], {}, { transientCellMetadata: {}, transientDocumentMetadata: {}, transientOutputs: false, cellContentMetadata: {} }, undoRedoService, modelService, languageService, languageDetectionService, notebookExecutionStateService);
    const model = new NotebookEditorTestModel(notebook);
    const options = new NotebookOptions(mainWindow, false, void 0, instantiationService.get(IConfigurationService), instantiationService.get(INotebookExecutionStateService), instantiationService.get(ICodeEditorService));
    const eventDispatcher = new NotebookEventDispatcher();
    const viewContext = new ViewContext(options, eventDispatcher, () => ({}));
    const viewModel = new NotebookViewModel("notebook", model.notebook, viewContext, null, { isReadOnly: false }, instantiationService, bulkEditService, undoRedoService, textModelService, notebookExecutionStateService);
    assert.strictEqual(viewModel.viewType, "notebook");
    notebook.dispose();
    model.dispose();
    options.dispose();
    eventDispatcher.dispose();
    viewModel.dispose();
  });
  test("insert/delete", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, viewModel) => {
        const cell = insertCellAtIndex(viewModel, 1, "var c = 3", "javascript", CellKind.Code, {}, [], true, true);
        assert.strictEqual(viewModel.length, 3);
        assert.strictEqual(viewModel.notebookDocument.cells.length, 3);
        assert.strictEqual(viewModel.getCellIndex(cell), 1);
        runDeleteAction(editor, viewModel.cellAt(1));
        assert.strictEqual(viewModel.length, 2);
        assert.strictEqual(viewModel.notebookDocument.cells.length, 2);
        assert.strictEqual(viewModel.getCellIndex(cell), -1);
        cell.dispose();
        cell.model.dispose();
      }
    );
  });
  test("index", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, viewModel) => {
        const firstViewCell = viewModel.cellAt(0);
        const lastViewCell = viewModel.cellAt(viewModel.length - 1);
        const insertIndex = viewModel.getCellIndex(firstViewCell) + 1;
        const cell = insertCellAtIndex(viewModel, insertIndex, "var c = 3;", "javascript", CellKind.Code, {}, [], true, true);
        const addedCellIndex = viewModel.getCellIndex(cell);
        runDeleteAction(editor, viewModel.cellAt(addedCellIndex));
        const secondInsertIndex = viewModel.getCellIndex(lastViewCell) + 1;
        const cell2 = insertCellAtIndex(viewModel, secondInsertIndex, "var d = 4;", "javascript", CellKind.Code, {}, [], true, true);
        assert.strictEqual(viewModel.length, 3);
        assert.strictEqual(viewModel.notebookDocument.cells.length, 3);
        assert.strictEqual(viewModel.getCellIndex(cell2), 2);
        cell.dispose();
        cell.model.dispose();
        cell2.dispose();
        cell2.model.dispose();
      }
    );
  });
});
function getVisibleCells(cells, hiddenRanges) {
  if (!hiddenRanges.length) {
    return cells;
  }
  let start = 0;
  let hiddenRangeIndex = 0;
  const result = [];
  while (start < cells.length && hiddenRangeIndex < hiddenRanges.length) {
    if (start < hiddenRanges[hiddenRangeIndex].start) {
      result.push(...cells.slice(start, hiddenRanges[hiddenRangeIndex].start));
    }
    start = hiddenRanges[hiddenRangeIndex].end + 1;
    hiddenRangeIndex++;
  }
  if (start < cells.length) {
    result.push(...cells.slice(start));
  }
  return result;
}
suite("NotebookViewModel Decorations", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("tracking range", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}],
        ["var d = 4;", "javascript", CellKind.Code, [], {}],
        ["var e = 5;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, viewModel) => {
        const trackedId = viewModel.setTrackedRange("test", { start: 1, end: 2 }, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter);
        assert.deepStrictEqual(viewModel.getTrackedRange(trackedId), {
          start: 1,
          end: 2
        });
        const cell1 = insertCellAtIndex(viewModel, 0, "var d = 6;", "javascript", CellKind.Code, {}, [], true, true);
        assert.deepStrictEqual(viewModel.getTrackedRange(trackedId), {
          start: 2,
          end: 3
        });
        runDeleteAction(editor, viewModel.cellAt(0));
        assert.deepStrictEqual(viewModel.getTrackedRange(trackedId), {
          start: 1,
          end: 2
        });
        const cell2 = insertCellAtIndex(viewModel, 3, "var d = 7;", "javascript", CellKind.Code, {}, [], true, true);
        assert.deepStrictEqual(viewModel.getTrackedRange(trackedId), {
          start: 1,
          end: 3
        });
        runDeleteAction(editor, viewModel.cellAt(3));
        assert.deepStrictEqual(viewModel.getTrackedRange(trackedId), {
          start: 1,
          end: 2
        });
        runDeleteAction(editor, viewModel.cellAt(1));
        assert.deepStrictEqual(viewModel.getTrackedRange(trackedId), {
          start: 0,
          end: 1
        });
        cell1.dispose();
        cell1.model.dispose();
        cell2.dispose();
        cell2.model.dispose();
      }
    );
  });
  test("tracking range 2", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}],
        ["var d = 4;", "javascript", CellKind.Code, [], {}],
        ["var e = 5;", "javascript", CellKind.Code, [], {}],
        ["var e = 6;", "javascript", CellKind.Code, [], {}],
        ["var e = 7;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, viewModel) => {
        const trackedId = viewModel.setTrackedRange("test", { start: 1, end: 3 }, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter);
        assert.deepStrictEqual(viewModel.getTrackedRange(trackedId), {
          start: 1,
          end: 3
        });
        insertCellAtIndex(viewModel, 5, "var d = 9;", "javascript", CellKind.Code, {}, [], true, true);
        assert.deepStrictEqual(viewModel.getTrackedRange(trackedId), {
          start: 1,
          end: 3
        });
        insertCellAtIndex(viewModel, 4, "var d = 10;", "javascript", CellKind.Code, {}, [], true, true);
        assert.deepStrictEqual(viewModel.getTrackedRange(trackedId), {
          start: 1,
          end: 4
        });
      }
    );
  });
  test("diff hidden ranges", async function() {
    assert.deepStrictEqual(getVisibleCells([1, 2, 3, 4, 5], []), [1, 2, 3, 4, 5]);
    assert.deepStrictEqual(
      getVisibleCells(
        [1, 2, 3, 4, 5],
        [{ start: 1, end: 2 }]
      ),
      [1, 4, 5]
    );
    assert.deepStrictEqual(
      getVisibleCells(
        [1, 2, 3, 4, 5, 6, 7, 8, 9],
        [
          { start: 1, end: 2 },
          { start: 4, end: 5 }
        ]
      ),
      [1, 4, 7, 8, 9]
    );
    const original = getVisibleCells(
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
      [
        { start: 1, end: 2 },
        { start: 4, end: 5 }
      ]
    );
    const modified = getVisibleCells(
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
      [
        { start: 2, end: 4 }
      ]
    );
    assert.deepStrictEqual(diff(original, modified, (a) => {
      return original.indexOf(a) >= 0;
    }), [{ start: 1, deleteCount: 1, toInsert: [2, 6] }]);
  });
});
suite("NotebookViewModel API", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("#115432, get nearest code cell", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["b = 2;", "python", CellKind.Code, [], {}],
        ["var c = 3", "javascript", CellKind.Code, [], {}],
        ["# header d", "markdown", CellKind.Markup, [], {}],
        ["var e = 4;", "TypeScript", CellKind.Code, [], {}],
        ["# header f", "markdown", CellKind.Markup, [], {}]
      ],
      (editor, viewModel) => {
        assert.strictEqual(viewModel.nearestCodeCellIndex(0), 1);
        assert.strictEqual(viewModel.nearestCodeCellIndex(2), 1);
        assert.strictEqual(viewModel.nearestCodeCellIndex(4), 3);
        assert.strictEqual(viewModel.nearestCodeCellIndex(5), 4);
        assert.strictEqual(viewModel.nearestCodeCellIndex(6), 4);
      }
    );
  });
  test("#108464, get nearest code cell", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}]
      ],
      (editor, viewModel) => {
        assert.strictEqual(viewModel.nearestCodeCellIndex(2), 1);
      }
    );
  });
  test("getCells", async () => {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}]
      ],
      (editor, viewModel) => {
        assert.strictEqual(viewModel.getCellsInRange().length, 3);
        assert.deepStrictEqual(viewModel.getCellsInRange({ start: 0, end: 1 }).map((cell) => cell.getText()), ["# header a"]);
        assert.deepStrictEqual(viewModel.getCellsInRange({ start: 0, end: 2 }).map((cell) => cell.getText()), ["# header a", "var b = 1;"]);
        assert.deepStrictEqual(viewModel.getCellsInRange({ start: 0, end: 3 }).map((cell) => cell.getText()), ["# header a", "var b = 1;", "# header b"]);
        assert.deepStrictEqual(viewModel.getCellsInRange({ start: 0, end: 4 }).map((cell) => cell.getText()), ["# header a", "var b = 1;", "# header b"]);
        assert.deepStrictEqual(viewModel.getCellsInRange({ start: 1, end: 4 }).map((cell) => cell.getText()), ["var b = 1;", "# header b"]);
        assert.deepStrictEqual(viewModel.getCellsInRange({ start: 2, end: 4 }).map((cell) => cell.getText()), ["# header b"]);
        assert.deepStrictEqual(viewModel.getCellsInRange({ start: 3, end: 4 }).map((cell) => cell.getText()), []);
        assert.deepStrictEqual(viewModel.getCellsInRange({ start: -1, end: 1 }).map((cell) => cell.getText()), ["# header a"]);
        assert.deepStrictEqual(viewModel.getCellsInRange({ start: 3, end: 0 }).map((cell) => cell.getText()), ["# header a", "var b = 1;", "# header b"]);
      }
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay90ZXN0L2Jyb3dzZXIvbm90ZWJvb2tWaWV3TW9kZWwudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUJ1bGtFZGl0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2J1bGtFZGl0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBUcmFja2VkUmFuZ2VTdGlja2luZXNzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vdGVzdC9jb21tb24vdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRlc3RUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS90ZXN0L2NvbW1vbi90ZXN0VGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElVbmRvUmVkb1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91bmRvUmVkby9jb21tb24vdW5kb1JlZG8uanMnO1xuaW1wb3J0IHsgaW5zZXJ0Q2VsbEF0SW5kZXgsIHJ1bkRlbGV0ZUFjdGlvbiB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udHJvbGxlci9jZWxsT3BlcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0V2ZW50RGlzcGF0Y2hlciB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvdmlld01vZGVsL2V2ZW50RGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va1ZpZXdNb2RlbCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvdmlld01vZGVsL25vdGVib29rVmlld01vZGVsSW1wbC5qcyc7XG5pbXBvcnQgeyBWaWV3Q29udGV4dCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvdmlld01vZGVsL3ZpZXdDb250ZXh0LmpzJztcbmltcG9ydCB7IE5vdGVib29rVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL21vZGVsL25vdGVib29rVGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IENlbGxLaW5kLCBkaWZmIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IE5vdGVib29rT3B0aW9ucyB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvbm90ZWJvb2tPcHRpb25zLmpzJztcbmltcG9ydCB7IElDZWxsUmFuZ2UgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tSYW5nZS5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0VkaXRvclRlc3RNb2RlbCwgc2V0dXBJbnN0YW50aWF0aW9uU2VydmljZSwgd2l0aFRlc3ROb3RlYm9vayB9IGZyb20gJy4vdGVzdE5vdGVib29rRWRpdG9yLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQmFzZUNlbGxFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9ub3RlYm9va0Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VEZXRlY3Rpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvbGFuZ3VhZ2VEZXRlY3Rpb24vY29tbW9uL2xhbmd1YWdlRGV0ZWN0aW9uV29ya2VyU2VydmljZS5qcyc7XG5cbnN1aXRlKCdOb3RlYm9va1ZpZXdNb2RlbCcsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0bGV0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRsZXQgdGV4dE1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2U7XG5cdGxldCBidWxrRWRpdFNlcnZpY2U6IElCdWxrRWRpdFNlcnZpY2U7XG5cdGxldCB1bmRvUmVkb1NlcnZpY2U6IElVbmRvUmVkb1NlcnZpY2U7XG5cdGxldCBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2U7XG5cdGxldCBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2U7XG5cdGxldCBsYW5ndWFnZURldGVjdGlvblNlcnZpY2U6IElMYW5ndWFnZURldGVjdGlvblNlcnZpY2U7XG5cdGxldCBub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZTogSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlO1xuXG5cdHN1aXRlU2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc2V0dXBJbnN0YW50aWF0aW9uU2VydmljZShkaXNwb3NhYmxlcyk7XG5cdFx0dGV4dE1vZGVsU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVGV4dE1vZGVsU2VydmljZSk7XG5cdFx0YnVsa0VkaXRTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElCdWxrRWRpdFNlcnZpY2UpO1xuXHRcdHVuZG9SZWRvU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVW5kb1JlZG9TZXJ2aWNlKTtcblx0XHRtb2RlbFNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSU1vZGVsU2VydmljZSk7XG5cdFx0bGFuZ3VhZ2VTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMYW5ndWFnZVNlcnZpY2UpO1xuXHRcdGxhbmd1YWdlRGV0ZWN0aW9uU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTGFuZ3VhZ2VEZXRlY3Rpb25TZXJ2aWNlKTtcblx0XHRub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UpO1xuXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29uZmlndXJhdGlvblNlcnZpY2UsIG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVGhlbWVTZXJ2aWNlLCBuZXcgVGVzdFRoZW1lU2VydmljZSgpKTtcblx0fSk7XG5cblx0c3VpdGVUZWFyZG93bigoKSA9PiBkaXNwb3NhYmxlcy5kaXNwb3NlKCkpO1xuXG5cdHRlc3QoJ2N0b3InLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgbm90ZWJvb2sgPSBuZXcgTm90ZWJvb2tUZXh0TW9kZWwoJ25vdGVib29rJywgVVJJLnBhcnNlKCd0ZXN0JyksIFtdLCB7fSwgeyB0cmFuc2llbnRDZWxsTWV0YWRhdGE6IHt9LCB0cmFuc2llbnREb2N1bWVudE1ldGFkYXRhOiB7fSwgdHJhbnNpZW50T3V0cHV0czogZmFsc2UsIGNlbGxDb250ZW50TWV0YWRhdGE6IHt9IH0sIHVuZG9SZWRvU2VydmljZSwgbW9kZWxTZXJ2aWNlLCBsYW5ndWFnZVNlcnZpY2UsIGxhbmd1YWdlRGV0ZWN0aW9uU2VydmljZSwgbm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UpO1xuXHRcdGNvbnN0IG1vZGVsID0gbmV3IE5vdGVib29rRWRpdG9yVGVzdE1vZGVsKG5vdGVib29rKTtcblx0XHRjb25zdCBvcHRpb25zID0gbmV3IE5vdGVib29rT3B0aW9ucyhtYWluV2luZG93LCBmYWxzZSwgdW5kZWZpbmVkLCBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSwgaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSksIGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJQ29kZUVkaXRvclNlcnZpY2UpKTtcblx0XHRjb25zdCBldmVudERpc3BhdGNoZXIgPSBuZXcgTm90ZWJvb2tFdmVudERpc3BhdGNoZXIoKTtcblx0XHRjb25zdCB2aWV3Q29udGV4dCA9IG5ldyBWaWV3Q29udGV4dChvcHRpb25zLCBldmVudERpc3BhdGNoZXIsICgpID0+ICh7fSBhcyBJQmFzZUNlbGxFZGl0b3JPcHRpb25zKSk7XG5cdFx0Y29uc3Qgdmlld01vZGVsID0gbmV3IE5vdGVib29rVmlld01vZGVsKCdub3RlYm9vaycsIG1vZGVsLm5vdGVib29rLCB2aWV3Q29udGV4dCwgbnVsbCwgeyBpc1JlYWRPbmx5OiBmYWxzZSB9LCBpbnN0YW50aWF0aW9uU2VydmljZSwgYnVsa0VkaXRTZXJ2aWNlLCB1bmRvUmVkb1NlcnZpY2UsIHRleHRNb2RlbFNlcnZpY2UsIG5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLnZpZXdUeXBlLCAnbm90ZWJvb2snKTtcblx0XHRub3RlYm9vay5kaXNwb3NlKCk7XG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHRcdG9wdGlvbnMuZGlzcG9zZSgpO1xuXHRcdGV2ZW50RGlzcGF0Y2hlci5kaXNwb3NlKCk7XG5cdFx0dmlld01vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnaW5zZXJ0L2RlbGV0ZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0XHRjb25zdCBjZWxsID0gaW5zZXJ0Q2VsbEF0SW5kZXgodmlld01vZGVsLCAxLCAndmFyIGMgPSAzJywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCB7fSwgW10sIHRydWUsIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmxlbmd0aCwgMyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwubm90ZWJvb2tEb2N1bWVudC5jZWxscy5sZW5ndGgsIDMpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmdldENlbGxJbmRleChjZWxsKSwgMSk7XG5cblx0XHRcdFx0cnVuRGVsZXRlQWN0aW9uKGVkaXRvciwgdmlld01vZGVsLmNlbGxBdCgxKSEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmxlbmd0aCwgMik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwubm90ZWJvb2tEb2N1bWVudC5jZWxscy5sZW5ndGgsIDIpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmdldENlbGxJbmRleChjZWxsKSwgLTEpO1xuXG5cdFx0XHRcdGNlbGwuZGlzcG9zZSgpO1xuXHRcdFx0XHRjZWxsLm1vZGVsLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbmRleCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0XHRjb25zdCBmaXJzdFZpZXdDZWxsID0gdmlld01vZGVsLmNlbGxBdCgwKSE7XG5cdFx0XHRcdGNvbnN0IGxhc3RWaWV3Q2VsbCA9IHZpZXdNb2RlbC5jZWxsQXQodmlld01vZGVsLmxlbmd0aCAtIDEpITtcblxuXHRcdFx0XHRjb25zdCBpbnNlcnRJbmRleCA9IHZpZXdNb2RlbC5nZXRDZWxsSW5kZXgoZmlyc3RWaWV3Q2VsbCkgKyAxO1xuXHRcdFx0XHRjb25zdCBjZWxsID0gaW5zZXJ0Q2VsbEF0SW5kZXgodmlld01vZGVsLCBpbnNlcnRJbmRleCwgJ3ZhciBjID0gMzsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIHt9LCBbXSwgdHJ1ZSwgdHJ1ZSk7XG5cblx0XHRcdFx0Y29uc3QgYWRkZWRDZWxsSW5kZXggPSB2aWV3TW9kZWwuZ2V0Q2VsbEluZGV4KGNlbGwpO1xuXHRcdFx0XHRydW5EZWxldGVBY3Rpb24oZWRpdG9yLCB2aWV3TW9kZWwuY2VsbEF0KGFkZGVkQ2VsbEluZGV4KSEpO1xuXG5cdFx0XHRcdGNvbnN0IHNlY29uZEluc2VydEluZGV4ID0gdmlld01vZGVsLmdldENlbGxJbmRleChsYXN0Vmlld0NlbGwpICsgMTtcblx0XHRcdFx0Y29uc3QgY2VsbDIgPSBpbnNlcnRDZWxsQXRJbmRleCh2aWV3TW9kZWwsIHNlY29uZEluc2VydEluZGV4LCAndmFyIGQgPSA0OycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwge30sIFtdLCB0cnVlLCB0cnVlKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmxlbmd0aCwgMyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwubm90ZWJvb2tEb2N1bWVudC5jZWxscy5sZW5ndGgsIDMpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLmdldENlbGxJbmRleChjZWxsMiksIDIpO1xuXG5cdFx0XHRcdGNlbGwuZGlzcG9zZSgpO1xuXHRcdFx0XHRjZWxsLm1vZGVsLmRpc3Bvc2UoKTtcblx0XHRcdFx0Y2VsbDIuZGlzcG9zZSgpO1xuXHRcdFx0XHRjZWxsMi5tb2RlbC5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG59KTtcblxuZnVuY3Rpb24gZ2V0VmlzaWJsZUNlbGxzPFQ+KGNlbGxzOiBUW10sIGhpZGRlblJhbmdlczogSUNlbGxSYW5nZVtdKSB7XG5cdGlmICghaGlkZGVuUmFuZ2VzLmxlbmd0aCkge1xuXHRcdHJldHVybiBjZWxscztcblx0fVxuXG5cdGxldCBzdGFydCA9IDA7XG5cdGxldCBoaWRkZW5SYW5nZUluZGV4ID0gMDtcblx0Y29uc3QgcmVzdWx0OiBUW10gPSBbXTtcblxuXHR3aGlsZSAoc3RhcnQgPCBjZWxscy5sZW5ndGggJiYgaGlkZGVuUmFuZ2VJbmRleCA8IGhpZGRlblJhbmdlcy5sZW5ndGgpIHtcblx0XHRpZiAoc3RhcnQgPCBoaWRkZW5SYW5nZXNbaGlkZGVuUmFuZ2VJbmRleF0uc3RhcnQpIHtcblx0XHRcdHJlc3VsdC5wdXNoKC4uLmNlbGxzLnNsaWNlKHN0YXJ0LCBoaWRkZW5SYW5nZXNbaGlkZGVuUmFuZ2VJbmRleF0uc3RhcnQpKTtcblx0XHR9XG5cblx0XHRzdGFydCA9IGhpZGRlblJhbmdlc1toaWRkZW5SYW5nZUluZGV4XS5lbmQgKyAxO1xuXHRcdGhpZGRlblJhbmdlSW5kZXgrKztcblx0fVxuXG5cdGlmIChzdGFydCA8IGNlbGxzLmxlbmd0aCkge1xuXHRcdHJlc3VsdC5wdXNoKC4uLmNlbGxzLnNsaWNlKHN0YXJ0KSk7XG5cdH1cblxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5zdWl0ZSgnTm90ZWJvb2tWaWV3TW9kZWwgRGVjb3JhdGlvbnMnLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ3RyYWNraW5nIHJhbmdlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsndmFyIGEgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDI7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBjID0gMzsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGQgPSA0OycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgZSA9IDU7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0XHRjb25zdCB0cmFja2VkSWQgPSB2aWV3TW9kZWwuc2V0VHJhY2tlZFJhbmdlKCd0ZXN0JywgeyBzdGFydDogMSwgZW5kOiAyIH0sIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0VHJhY2tlZFJhbmdlKHRyYWNrZWRJZCEpLCB7XG5cdFx0XHRcdFx0c3RhcnQ6IDEsXG5cblx0XHRcdFx0XHRlbmQ6IDIsXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGNvbnN0IGNlbGwxID0gaW5zZXJ0Q2VsbEF0SW5kZXgodmlld01vZGVsLCAwLCAndmFyIGQgPSA2OycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwge30sIFtdLCB0cnVlLCB0cnVlKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0VHJhY2tlZFJhbmdlKHRyYWNrZWRJZCEpLCB7XG5cdFx0XHRcdFx0c3RhcnQ6IDIsXG5cblx0XHRcdFx0XHRlbmQ6IDNcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0cnVuRGVsZXRlQWN0aW9uKGVkaXRvciwgdmlld01vZGVsLmNlbGxBdCgwKSEpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRUcmFja2VkUmFuZ2UodHJhY2tlZElkISksIHtcblx0XHRcdFx0XHRzdGFydDogMSxcblxuXHRcdFx0XHRcdGVuZDogMlxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjb25zdCBjZWxsMiA9IGluc2VydENlbGxBdEluZGV4KHZpZXdNb2RlbCwgMywgJ3ZhciBkID0gNzsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIHt9LCBbXSwgdHJ1ZSwgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldFRyYWNrZWRSYW5nZSh0cmFja2VkSWQhKSwge1xuXHRcdFx0XHRcdHN0YXJ0OiAxLFxuXG5cdFx0XHRcdFx0ZW5kOiAzXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHJ1bkRlbGV0ZUFjdGlvbihlZGl0b3IsIHZpZXdNb2RlbC5jZWxsQXQoMykhKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0VHJhY2tlZFJhbmdlKHRyYWNrZWRJZCEpLCB7XG5cdFx0XHRcdFx0c3RhcnQ6IDEsXG5cblx0XHRcdFx0XHRlbmQ6IDJcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0cnVuRGVsZXRlQWN0aW9uKGVkaXRvciwgdmlld01vZGVsLmNlbGxBdCgxKSEpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRUcmFja2VkUmFuZ2UodHJhY2tlZElkISksIHtcblx0XHRcdFx0XHRzdGFydDogMCxcblxuXHRcdFx0XHRcdGVuZDogMVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjZWxsMS5kaXNwb3NlKCk7XG5cdFx0XHRcdGNlbGwxLm1vZGVsLmRpc3Bvc2UoKTtcblx0XHRcdFx0Y2VsbDIuZGlzcG9zZSgpO1xuXHRcdFx0XHRjZWxsMi5tb2RlbC5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgndHJhY2tpbmcgcmFuZ2UgMicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYyA9IDM7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBkID0gNDsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGUgPSA1OycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgZSA9IDY7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBlID0gNzsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRdLFxuXHRcdFx0KGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHRyYWNrZWRJZCA9IHZpZXdNb2RlbC5zZXRUcmFja2VkUmFuZ2UoJ3Rlc3QnLCB7IHN0YXJ0OiAxLCBlbmQ6IDMgfSwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXIpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRUcmFja2VkUmFuZ2UodHJhY2tlZElkISksIHtcblx0XHRcdFx0XHRzdGFydDogMSxcblxuXHRcdFx0XHRcdGVuZDogM1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRpbnNlcnRDZWxsQXRJbmRleCh2aWV3TW9kZWwsIDUsICd2YXIgZCA9IDk7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCB7fSwgW10sIHRydWUsIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRUcmFja2VkUmFuZ2UodHJhY2tlZElkISksIHtcblx0XHRcdFx0XHRzdGFydDogMSxcblxuXHRcdFx0XHRcdGVuZDogM1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRpbnNlcnRDZWxsQXRJbmRleCh2aWV3TW9kZWwsIDQsICd2YXIgZCA9IDEwOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwge30sIFtdLCB0cnVlLCB0cnVlKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0VHJhY2tlZFJhbmdlKHRyYWNrZWRJZCEpLCB7XG5cdFx0XHRcdFx0c3RhcnQ6IDEsXG5cblx0XHRcdFx0XHRlbmQ6IDRcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZGlmZiBoaWRkZW4gcmFuZ2VzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0VmlzaWJsZUNlbGxzPG51bWJlcj4oWzEsIDIsIDMsIDQsIDVdLCBbXSksIFsxLCAyLCAzLCA0LCA1XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0Z2V0VmlzaWJsZUNlbGxzPG51bWJlcj4oXG5cdFx0XHRcdFsxLCAyLCAzLCA0LCA1XSxcblx0XHRcdFx0W3sgc3RhcnQ6IDEsIGVuZDogMiB9XVxuXHRcdFx0KSxcblx0XHRcdFsxLCA0LCA1XVxuXHRcdCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0Z2V0VmlzaWJsZUNlbGxzPG51bWJlcj4oXG5cdFx0XHRcdFsxLCAyLCAzLCA0LCA1LCA2LCA3LCA4LCA5XSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdHsgc3RhcnQ6IDEsIGVuZDogMiB9LFxuXHRcdFx0XHRcdHsgc3RhcnQ6IDQsIGVuZDogNSB9XG5cdFx0XHRcdF1cblx0XHRcdCksXG5cdFx0XHRbMSwgNCwgNywgOCwgOV1cblx0XHQpO1xuXG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBnZXRWaXNpYmxlQ2VsbHM8bnVtYmVyPihcblx0XHRcdFsxLCAyLCAzLCA0LCA1LCA2LCA3LCA4LCA5XSxcblx0XHRcdFtcblx0XHRcdFx0eyBzdGFydDogMSwgZW5kOiAyIH0sXG5cdFx0XHRcdHsgc3RhcnQ6IDQsIGVuZDogNSB9XG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGNvbnN0IG1vZGlmaWVkID0gZ2V0VmlzaWJsZUNlbGxzPG51bWJlcj4oXG5cdFx0XHRbMSwgMiwgMywgNCwgNSwgNiwgNywgOCwgOV0sXG5cdFx0XHRbXG5cdFx0XHRcdHsgc3RhcnQ6IDIsIGVuZDogNCB9XG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZGlmZjxudW1iZXI+KG9yaWdpbmFsLCBtb2RpZmllZCwgKGEpID0+IHtcblx0XHRcdHJldHVybiBvcmlnaW5hbC5pbmRleE9mKGEpID49IDA7XG5cdFx0fSksIFt7IHN0YXJ0OiAxLCBkZWxldGVDb3VudDogMSwgdG9JbnNlcnQ6IFsyLCA2XSB9XSk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdOb3RlYm9va1ZpZXdNb2RlbCBBUEknLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJyMxMTU0MzIsIGdldCBuZWFyZXN0IGNvZGUgY2VsbCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ2IgPSAyOycsICdweXRob24nLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBjID0gMycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBkJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBlID0gNDsnLCAnVHlwZVNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgZicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLm5lYXJlc3RDb2RlQ2VsbEluZGV4KDApLCAxKTtcblx0XHRcdFx0Ly8gZmluZCB0aGUgbmVhcmVzdCBjb2RlIGNlbGwgZnJvbSBhYm92ZVxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLm5lYXJlc3RDb2RlQ2VsbEluZGV4KDIpLCAxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpZXdNb2RlbC5uZWFyZXN0Q29kZUNlbGxJbmRleCg0KSwgMyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwubmVhcmVzdENvZGVDZWxsSW5kZXgoNSksIDQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLm5lYXJlc3RDb2RlQ2VsbEluZGV4KDYpLCA0KTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCcjMTA4NDY0LCBnZXQgbmVhcmVzdCBjb2RlIGNlbGwnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WycjIGhlYWRlciBhJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgYicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld01vZGVsLm5lYXJlc3RDb2RlQ2VsbEluZGV4KDIpLCAxKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXRDZWxscycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0KGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0Q2VsbHNJblJhbmdlKCkubGVuZ3RoLCAzKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0Q2VsbHNJblJhbmdlKHsgc3RhcnQ6IDAsIGVuZDogMSB9KS5tYXAoY2VsbCA9PiBjZWxsLmdldFRleHQoKSksIFsnIyBoZWFkZXIgYSddKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0Q2VsbHNJblJhbmdlKHsgc3RhcnQ6IDAsIGVuZDogMiB9KS5tYXAoY2VsbCA9PiBjZWxsLmdldFRleHQoKSksIFsnIyBoZWFkZXIgYScsICd2YXIgYiA9IDE7J10pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRDZWxsc0luUmFuZ2UoeyBzdGFydDogMCwgZW5kOiAzIH0pLm1hcChjZWxsID0+IGNlbGwuZ2V0VGV4dCgpKSwgWycjIGhlYWRlciBhJywgJ3ZhciBiID0gMTsnLCAnIyBoZWFkZXIgYiddKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0Q2VsbHNJblJhbmdlKHsgc3RhcnQ6IDAsIGVuZDogNCB9KS5tYXAoY2VsbCA9PiBjZWxsLmdldFRleHQoKSksIFsnIyBoZWFkZXIgYScsICd2YXIgYiA9IDE7JywgJyMgaGVhZGVyIGInXSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldENlbGxzSW5SYW5nZSh7IHN0YXJ0OiAxLCBlbmQ6IDQgfSkubWFwKGNlbGwgPT4gY2VsbC5nZXRUZXh0KCkpLCBbJ3ZhciBiID0gMTsnLCAnIyBoZWFkZXIgYiddKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0Q2VsbHNJblJhbmdlKHsgc3RhcnQ6IDIsIGVuZDogNCB9KS5tYXAoY2VsbCA9PiBjZWxsLmdldFRleHQoKSksIFsnIyBoZWFkZXIgYiddKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0Q2VsbHNJblJhbmdlKHsgc3RhcnQ6IDMsIGVuZDogNCB9KS5tYXAoY2VsbCA9PiBjZWxsLmdldFRleHQoKSksIFtdKTtcblxuXHRcdFx0XHQvLyBubyBvbmUgc2hvdWxkIHVzZSBhbiBpbnZhbGlkIHJhbmdlIGJ1dCBgZ2V0Q2VsbHNgIHNob3VsZCBiZSBhYmxlIHRvIGhhbmRsZSB0aGF0LlxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdNb2RlbC5nZXRDZWxsc0luUmFuZ2UoeyBzdGFydDogLTEsIGVuZDogMSB9KS5tYXAoY2VsbCA9PiBjZWxsLmdldFRleHQoKSksIFsnIyBoZWFkZXIgYSddKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0Q2VsbHNJblJhbmdlKHsgc3RhcnQ6IDMsIGVuZDogMCB9KS5tYXAoY2VsbCA9PiBjZWxsLmdldFRleHQoKSksIFsnIyBoZWFkZXIgYScsICd2YXIgYiA9IDE7JywgJyMgaGVhZGVyIGInXSk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLFdBQVc7QUFDcEIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxnQ0FBZ0M7QUFFekMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyx3QkFBd0I7QUFDakMs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O0FBQ3RCLGVBQU8sWUFBWSxVQUFVLGdCQUFnQixFQUFFLFFBQVEsQ0FBQztBQUN4RCxlQUFPLGdCQUFnQixVQUFVLGdCQUFnQixFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUUsQ0FBQyxFQUFFLElBQUksVUFBUSxLQUFLLFFBQVEsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDO0FBQ2xILGVBQU8sZ0JBQWdCLFVBQVUsZ0JBQWdCLEVBQUUsT0FBTyxHQUFHLEtBQUssRUFBRSxDQUFDLEVBQUUsSUFBSSxVQUFRLEtBQUssUUFBUSxDQUFDLEdBQUcsQ0FBQyxjQUFjLFlBQVksQ0FBQztBQUNoSSxlQUFPLGdCQUFnQixVQUFVLGdCQUFnQixFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUUsQ0FBQyxFQUFFLElBQUksVUFBUSxLQUFLLFFBQVEsQ0FBQyxHQUFHLENBQUMsY0FBYyxjQUFjLFlBQVksQ0FBQztBQUM5SSxlQUFPLGdCQUFnQixVQUFVLGdCQUFnQixFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUUsQ0FBQyxFQUFFLElBQUksVUFBUSxLQUFLLFFBQVEsQ0FBQyxHQUFHLENBQUMsY0FBYyxjQUFjLFlBQVksQ0FBQztBQUM5SSxlQUFPLGdCQUFnQixVQUFVLGdCQUFnQixFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUUsQ0FBQyxFQUFFLElBQUksVUFBUSxLQUFLLFFBQVEsQ0FBQyxHQUFHLENBQUMsY0FBYyxZQUFZLENBQUM7QUFDaEksZUFBTyxnQkFBZ0IsVUFBVSxnQkFBZ0IsRUFBRSxPQUFPLEdBQUcsS0FBSyxFQUFFLENBQUMsRUFBRSxJQUFJLFVBQVEsS0FBSyxRQUFRLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQztBQUNsSCxlQUFPLGdCQUFnQixVQUFVLGdCQUFnQixFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUUsQ0FBQyxFQUFFLElBQUksVUFBUSxLQUFLLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUd0RyxlQUFPLGdCQUFnQixVQUFVLGdCQUFnQixFQUFFLE9BQU8sSUFBSSxLQUFLLEVBQUUsQ0FBQyxFQUFFLElBQUksVUFBUSxLQUFLLFFBQVEsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDO0FBQ25ILGVBQU8sZ0JBQWdCLFVBQVUsZ0JBQWdCLEVBQUUsT0FBTyxHQUFHLEtBQUssRUFBRSxDQUFDLEVBQUUsSUFBSSxVQUFRLEtBQUssUUFBUSxDQUFDLEdBQUcsQ0FBQyxjQUFjLGNBQWMsWUFBWSxDQUFDO0FBQUEsTUFDL0k7QUFBQSxJQUNEO0FBQUEsRUFDRCxDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
