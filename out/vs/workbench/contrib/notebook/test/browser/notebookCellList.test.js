import assert from "assert";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { CellKind, NotebookSetting } from "../../common/notebookCommon.js";
import { createNotebookCellList, setupInstantiationService, withTestNotebook } from "./testNotebookEditor.js";
suite("NotebookCellList", () => {
  let testDisposables;
  let instantiationService;
  teardown(() => {
    testDisposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  let config;
  setup(() => {
    testDisposables = new DisposableStore();
    instantiationService = setupInstantiationService(testDisposables);
    config = new TestConfigurationService();
    instantiationService.stub(IConfigurationService, config);
  });
  test("revealElementsInView: reveal fully visible cell should not scroll", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["# header c", "markdown", CellKind.Markup, [], {}]
      ],
      async (editor, viewModel, disposables) => {
        viewModel.restoreEditorViewState({
          editingCells: [false, false, false, false, false],
          cellLineNumberStates: {},
          editorViewStates: [null, null, null, null, null],
          cellTotalHeights: [50, 100, 50, 100, 50],
          collapsedInputCells: {},
          collapsedOutputCells: {}
        });
        const cellList = createNotebookCellList(instantiationService, disposables);
        cellList.attachViewModel(viewModel);
        cellList.layout(210, 100);
        cellList.scrollTop = 5;
        assert.deepStrictEqual(cellList.scrollTop, 5);
        assert.deepStrictEqual(cellList.getViewScrollBottom(), 215);
        cellList.revealCells({ start: 1, end: 2 });
        assert.deepStrictEqual(cellList.scrollTop, 5);
        assert.deepStrictEqual(cellList.getViewScrollBottom(), 215);
        cellList.revealCells({ start: 2, end: 3 });
        assert.deepStrictEqual(cellList.scrollTop, 5);
        assert.deepStrictEqual(cellList.getViewScrollBottom(), 215);
        cellList.revealCells({ start: 3, end: 4 });
        assert.deepStrictEqual(cellList.scrollTop, 90);
      }
    );
  });
  test("revealElementsInView: reveal partially visible cell", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["# header c", "markdown", CellKind.Markup, [], {}]
      ],
      async (editor, viewModel, disposables) => {
        viewModel.restoreEditorViewState({
          editingCells: [false, false, false, false, false],
          editorViewStates: [null, null, null, null, null],
          cellTotalHeights: [50, 100, 50, 100, 50],
          cellLineNumberStates: {},
          collapsedInputCells: {},
          collapsedOutputCells: {}
        });
        const cellList = createNotebookCellList(instantiationService, disposables);
        cellList.attachViewModel(viewModel);
        cellList.layout(210, 100);
        assert.deepStrictEqual(cellList.scrollTop, 0);
        assert.deepStrictEqual(cellList.getViewScrollBottom(), 210);
        cellList.revealCells({ start: 3, end: 4 });
        assert.deepStrictEqual(cellList.scrollTop, 90);
        cellList.scrollTop = 5;
        assert.deepStrictEqual(cellList.scrollTop, 5);
        assert.deepStrictEqual(cellList.getViewScrollBottom(), 215);
        cellList.revealCells({ start: 0, end: 1 });
        assert.deepStrictEqual(cellList.scrollTop, 0);
      }
    );
  });
  test("revealElementsInView: reveal cell out of viewport", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["# header c", "markdown", CellKind.Markup, [], {}]
      ],
      async (editor, viewModel, disposables) => {
        viewModel.restoreEditorViewState({
          editingCells: [false, false, false, false, false],
          editorViewStates: [null, null, null, null, null],
          cellTotalHeights: [50, 100, 50, 100, 50],
          cellLineNumberStates: {},
          collapsedInputCells: {},
          collapsedOutputCells: {}
        });
        const cellList = createNotebookCellList(instantiationService, disposables);
        cellList.updateOptions({ paddingBottom: 100 });
        cellList.attachViewModel(viewModel);
        cellList.layout(210, 100);
        assert.deepStrictEqual(cellList.scrollTop, 0);
        assert.deepStrictEqual(cellList.getViewScrollBottom(), 210);
        cellList.revealCells({ start: 4, end: 5 });
        assert.deepStrictEqual(cellList.scrollTop, 140);
      }
    );
  });
  test("updateElementHeight", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["# header c", "markdown", CellKind.Markup, [], {}]
      ],
      async (editor, viewModel, disposables) => {
        viewModel.restoreEditorViewState({
          editingCells: [false, false, false, false, false],
          editorViewStates: [null, null, null, null, null],
          cellTotalHeights: [50, 100, 50, 100, 50],
          cellLineNumberStates: {},
          collapsedInputCells: {},
          collapsedOutputCells: {}
        });
        const cellList = createNotebookCellList(instantiationService, disposables);
        cellList.attachViewModel(viewModel);
        cellList.layout(210, 100);
        assert.deepStrictEqual(cellList.scrollTop, 0);
        assert.deepStrictEqual(cellList.getViewScrollBottom(), 210);
        cellList.updateElementHeight(0, 60);
        assert.deepStrictEqual(cellList.scrollTop, 0);
        cellList.scrollTop = 5;
        assert.deepStrictEqual(cellList.scrollTop, 5);
        assert.deepStrictEqual(cellList.getViewScrollBottom(), 215);
        cellList.updateElementHeight(0, 80);
        assert.deepStrictEqual(cellList.scrollTop, 5);
      }
    );
  });
  test("updateElementHeight with anchor", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["# header c", "markdown", CellKind.Markup, [], {}]
      ],
      async (editor, viewModel, disposables) => {
        viewModel.restoreEditorViewState({
          editingCells: [false, false, false, false, false],
          editorViewStates: [null, null, null, null, null],
          cellTotalHeights: [50, 100, 50, 100, 50],
          cellLineNumberStates: {},
          collapsedInputCells: {},
          collapsedOutputCells: {}
        });
        const cellList = createNotebookCellList(instantiationService, disposables);
        cellList.attachViewModel(viewModel);
        cellList.layout(210, 100);
        assert.deepStrictEqual(cellList.scrollTop, 0);
        assert.deepStrictEqual(cellList.getViewScrollBottom(), 210);
        cellList.updateElementHeight2(viewModel.cellAt(0), 50);
        cellList.scrollTop = 5;
        assert.deepStrictEqual(cellList.scrollTop, 5);
        assert.deepStrictEqual(cellList.getViewScrollBottom(), 215);
        cellList.setFocus([1]);
        cellList.updateElementHeight2(viewModel.cellAt(0), 100);
        assert.deepStrictEqual(cellList.scrollHeight, 400);
        assert.deepStrictEqual(cellList.scrollTop, 5);
        assert.deepStrictEqual(cellList.getViewScrollBottom(), 215);
        cellList.updateElementHeight2(viewModel.cellAt(0), 150);
        assert.deepStrictEqual(cellList.scrollTop, 55);
        assert.deepStrictEqual(cellList.getViewScrollBottom(), 265);
        cellList.updateElementHeight2(viewModel.cellAt(0), 50);
        assert.deepStrictEqual(cellList.scrollTop, 55);
        assert.deepStrictEqual(cellList.getViewScrollBottom(), 265);
        cellList.updateElementHeight2(viewModel.cellAt(0), 250);
        assert.deepStrictEqual(cellList.scrollTop, 250 + 100 - cellList.renderHeight);
        assert.deepStrictEqual(cellList.getViewScrollBottom(), 250 + 100 - cellList.renderHeight + 210);
      }
    );
  });
  test("updateElementHeight with no scrolling", async function() {
    config.setUserConfiguration(NotebookSetting.scrollToRevealCell, "none");
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["# header c", "markdown", CellKind.Markup, [], {}]
      ],
      async (editor, viewModel, disposables) => {
        viewModel.restoreEditorViewState({
          editingCells: [false, false, false, false, false],
          editorViewStates: [null, null, null, null, null],
          cellTotalHeights: [50, 100, 50, 100, 50],
          cellLineNumberStates: {},
          collapsedInputCells: {},
          collapsedOutputCells: {}
        });
        const cellList = createNotebookCellList(instantiationService, disposables);
        cellList.attachViewModel(viewModel);
        cellList.layout(210, 100);
        assert.deepStrictEqual(cellList.scrollTop, 0);
        assert.deepStrictEqual(cellList.getViewScrollBottom(), 210);
        cellList.updateElementHeight2(viewModel.cellAt(0), 50);
        cellList.scrollTop = 5;
        assert.deepStrictEqual(cellList.scrollTop, 5);
        assert.deepStrictEqual(cellList.getViewScrollBottom(), 215);
        cellList.setFocus([1]);
        cellList.updateElementHeight2(viewModel.cellAt(0), 100);
        assert.deepStrictEqual(cellList.scrollHeight, 400);
        assert.deepStrictEqual(cellList.scrollTop, 5);
        cellList.updateElementHeight2(viewModel.cellAt(0), 50);
        assert.deepStrictEqual(cellList.scrollTop, 5);
        cellList.updateElementHeight2(viewModel.cellAt(0), 250);
        assert.deepStrictEqual(cellList.scrollTop, 5);
      }
    );
  });
  test("updateElementHeight with no scroll setting and cell editor focused", async function() {
    config.setUserConfiguration(NotebookSetting.scrollToRevealCell, "none");
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["# header c", "markdown", CellKind.Markup, [], {}]
      ],
      async (editor, viewModel, disposables) => {
        viewModel.restoreEditorViewState({
          editingCells: [false, false, false, false, false],
          editorViewStates: [null, null, null, null, null],
          cellTotalHeights: [50, 100, 50, 100, 50],
          cellLineNumberStates: {},
          collapsedInputCells: {},
          collapsedOutputCells: {}
        });
        const cellList = createNotebookCellList(instantiationService, disposables);
        cellList.attachViewModel(viewModel);
        cellList.layout(210, 100);
        assert.deepStrictEqual(cellList.scrollTop, 0);
        assert.deepStrictEqual(cellList.getViewScrollBottom(), 210);
        cellList.setFocus([1]);
        editor.focusNotebookCell(cellList.viewModel?.cellAt(1), "editor");
        cellList.updateElementHeight2(viewModel.cellAt(0), 100);
        assert.deepStrictEqual(cellList.scrollHeight, 400);
        assert.deepStrictEqual(cellList.scrollTop, 50);
        cellList.updateElementHeight2(viewModel.cellAt(0), 50);
        assert.deepStrictEqual(cellList.scrollTop, 0);
        cellList.updateElementHeight2(viewModel.cellAt(0), 250);
        assert.deepStrictEqual(cellList.scrollTop, 250 + 100 - cellList.renderHeight);
      }
    );
  });
  test("updateElementHeight with focused element out of viewport", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["# header c", "markdown", CellKind.Markup, [], {}]
      ],
      async (editor, viewModel, disposables) => {
        viewModel.restoreEditorViewState({
          editingCells: [false, false, false, false, false],
          editorViewStates: [null, null, null, null, null],
          cellTotalHeights: [50, 100, 50, 100, 50],
          cellLineNumberStates: {},
          collapsedInputCells: {},
          collapsedOutputCells: {}
        });
        const cellList = createNotebookCellList(instantiationService, disposables);
        cellList.attachViewModel(viewModel);
        cellList.layout(210, 100);
        assert.deepStrictEqual(cellList.scrollTop, 0);
        assert.deepStrictEqual(cellList.getViewScrollBottom(), 210);
        cellList.setFocus([4]);
        cellList.updateElementHeight2(viewModel.cellAt(1), 130);
        assert.deepStrictEqual(cellList.scrollTop, 0);
      }
    );
  });
  test("updateElementHeight of cells out of viewport should not trigger scroll #121140", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["# header c", "markdown", CellKind.Markup, [], {}]
      ],
      async (editor, viewModel, disposables) => {
        viewModel.restoreEditorViewState({
          editingCells: [false, false, false, false, false],
          editorViewStates: [null, null, null, null, null],
          cellTotalHeights: [50, 100, 50, 100, 50],
          cellLineNumberStates: {},
          collapsedInputCells: {},
          collapsedOutputCells: {}
        });
        const cellList = createNotebookCellList(instantiationService, disposables);
        cellList.attachViewModel(viewModel);
        cellList.layout(210, 100);
        assert.deepStrictEqual(cellList.scrollTop, 0);
        assert.deepStrictEqual(cellList.getViewScrollBottom(), 210);
        cellList.setFocus([1]);
        cellList.scrollTop = 80;
        assert.deepStrictEqual(cellList.scrollTop, 80);
        cellList.updateElementHeight2(viewModel.cellAt(0), 30);
        assert.deepStrictEqual(cellList.scrollTop, 60);
      }
    );
  });
  test("visibleRanges should be exclusive of end", async function() {
    await withTestNotebook(
      [],
      async (editor, viewModel, disposables) => {
        const cellList = createNotebookCellList(instantiationService, disposables);
        cellList.attachViewModel(viewModel);
        cellList.layout(100, 100);
        assert.deepStrictEqual(cellList.visibleRanges, []);
      }
    );
  });
  test("visibleRanges should be exclusive of end 2", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}]
      ],
      async (editor, viewModel, disposables) => {
        viewModel.restoreEditorViewState({
          editingCells: [false],
          editorViewStates: [null],
          cellTotalHeights: [50],
          cellLineNumberStates: {},
          collapsedInputCells: {},
          collapsedOutputCells: {}
        });
        const cellList = createNotebookCellList(instantiationService, disposables);
        cellList.attachViewModel(viewModel);
        cellList.layout(100, 100);
        assert.deepStrictEqual(cellList.visibleRanges, [{ start: 0, end: 1 }]);
      }
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay90ZXN0L2Jyb3dzZXIvbm90ZWJvb2tDZWxsTGlzdC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBDZWxsS2luZCwgTm90ZWJvb2tTZXR0aW5nIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IGNyZWF0ZU5vdGVib29rQ2VsbExpc3QsIHNldHVwSW5zdGFudGlhdGlvblNlcnZpY2UsIHdpdGhUZXN0Tm90ZWJvb2sgfSBmcm9tICcuL3Rlc3ROb3RlYm9va0VkaXRvci5qcyc7XG5cbnN1aXRlKCdOb3RlYm9va0NlbGxMaXN0JywgKCkgPT4ge1xuXHRsZXQgdGVzdERpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHR0ZXN0RGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRsZXQgY29uZmlnOiBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2U7XG5cdHNldHVwKCgpID0+IHtcblx0XHR0ZXN0RGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSBzZXR1cEluc3RhbnRpYXRpb25TZXJ2aWNlKHRlc3REaXNwb3NhYmxlcyk7XG5cdFx0Y29uZmlnID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSgpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb25maWcpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXZlYWxFbGVtZW50c0luVmlldzogcmV2ZWFsIGZ1bGx5IHZpc2libGUgY2VsbCBzaG91bGQgbm90IHNjcm9sbCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgYycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdGFzeW5jIChlZGl0b3IsIHZpZXdNb2RlbCwgZGlzcG9zYWJsZXMpID0+IHtcblx0XHRcdFx0dmlld01vZGVsLnJlc3RvcmVFZGl0b3JWaWV3U3RhdGUoe1xuXHRcdFx0XHRcdGVkaXRpbmdDZWxsczogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV0sXG5cdFx0XHRcdFx0Y2VsbExpbmVOdW1iZXJTdGF0ZXM6IHt9LFxuXHRcdFx0XHRcdGVkaXRvclZpZXdTdGF0ZXM6IFtudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsXSxcblx0XHRcdFx0XHRjZWxsVG90YWxIZWlnaHRzOiBbNTAsIDEwMCwgNTAsIDEwMCwgNTBdLFxuXHRcdFx0XHRcdGNvbGxhcHNlZElucHV0Q2VsbHM6IHt9LFxuXHRcdFx0XHRcdGNvbGxhcHNlZE91dHB1dENlbGxzOiB7fSxcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Y29uc3QgY2VsbExpc3QgPSBjcmVhdGVOb3RlYm9va0NlbGxMaXN0KGluc3RhbnRpYXRpb25TZXJ2aWNlLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHRcdGNlbGxMaXN0LmF0dGFjaFZpZXdNb2RlbCh2aWV3TW9kZWwpO1xuXG5cdFx0XHRcdC8vIHJlbmRlciBoZWlnaHQgMjEwLCBpdCBjYW4gcmVuZGVyIDMgZnVsbCBjZWxscyBhbmQgMSBwYXJ0aWFsIGNlbGxcblx0XHRcdFx0Y2VsbExpc3QubGF5b3V0KDIxMCwgMTAwKTtcblx0XHRcdFx0Ly8gc2Nyb2xsIGEgYml0LCBzY3JvbGxUb3AgdG8gYm90dG9tOiA1LCAyMTVcblx0XHRcdFx0Y2VsbExpc3Quc2Nyb2xsVG9wID0gNTtcblxuXHRcdFx0XHQvLyBpbml0IHNjcm9sbFRvcCBhbmQgc2Nyb2xsQm90dG9tXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsVG9wLCA1KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRWaWV3U2Nyb2xsQm90dG9tKCksIDIxNSk7XG5cblx0XHRcdFx0Ly8gcmV2ZWFsIGNlbGwgMSwgdG9wIDUwLCBib3R0b20gMTUwLCB3aGljaCBpcyBmdWxseSB2aXNpYmxlIGluIHRoZSB2aWV3cG9ydFxuXHRcdFx0XHRjZWxsTGlzdC5yZXZlYWxDZWxscyh7IHN0YXJ0OiAxLCBlbmQ6IDIgfSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsVG9wLCA1KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRWaWV3U2Nyb2xsQm90dG9tKCksIDIxNSk7XG5cblx0XHRcdFx0Ly8gcmV2ZWFsIGNlbGwgMiwgdG9wIDE1MCwgYm90dG9tIDIwMCwgd2hpY2ggaXMgZnVsbHkgdmlzaWJsZSBpbiB0aGUgdmlld3BvcnRcblx0XHRcdFx0Y2VsbExpc3QucmV2ZWFsQ2VsbHMoeyBzdGFydDogMiwgZW5kOiAzIH0pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbFRvcCwgNSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3QuZ2V0Vmlld1Njcm9sbEJvdHRvbSgpLCAyMTUpO1xuXG5cdFx0XHRcdC8vIHJldmVhbCBjZWxsIDMsIHRvcCAyMDAsIGJvdHRvbSAzMDAsIHdoaWNoIGlzIHBhcnRpYWxseSB2aXNpYmxlIGluIHRoZSB2aWV3cG9ydFxuXHRcdFx0XHRjZWxsTGlzdC5yZXZlYWxDZWxscyh7IHN0YXJ0OiAzLCBlbmQ6IDQgfSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsVG9wLCA5MCk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgncmV2ZWFsRWxlbWVudHNJblZpZXc6IHJldmVhbCBwYXJ0aWFsbHkgdmlzaWJsZSBjZWxsJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIGInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBjJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsLCBkaXNwb3NhYmxlcykgPT4ge1xuXHRcdFx0XHR2aWV3TW9kZWwucmVzdG9yZUVkaXRvclZpZXdTdGF0ZSh7XG5cdFx0XHRcdFx0ZWRpdGluZ0NlbGxzOiBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXSxcblx0XHRcdFx0XHRlZGl0b3JWaWV3U3RhdGVzOiBbbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbF0sXG5cdFx0XHRcdFx0Y2VsbFRvdGFsSGVpZ2h0czogWzUwLCAxMDAsIDUwLCAxMDAsIDUwXSxcblx0XHRcdFx0XHRjZWxsTGluZU51bWJlclN0YXRlczoge30sXG5cdFx0XHRcdFx0Y29sbGFwc2VkSW5wdXRDZWxsczoge30sXG5cdFx0XHRcdFx0Y29sbGFwc2VkT3V0cHV0Q2VsbHM6IHt9LFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjb25zdCBjZWxsTGlzdCA9IGNyZWF0ZU5vdGVib29rQ2VsbExpc3QoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzKTtcblx0XHRcdFx0Y2VsbExpc3QuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cblx0XHRcdFx0Ly8gcmVuZGVyIGhlaWdodCAyMTAsIGl0IGNhbiByZW5kZXIgMyBmdWxsIGNlbGxzIGFuZCAxIHBhcnRpYWwgY2VsbFxuXHRcdFx0XHRjZWxsTGlzdC5sYXlvdXQoMjEwLCAxMDApO1xuXG5cdFx0XHRcdC8vIGluaXQgc2Nyb2xsVG9wIGFuZCBzY3JvbGxCb3R0b21cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxUb3AsIDApO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LmdldFZpZXdTY3JvbGxCb3R0b20oKSwgMjEwKTtcblxuXHRcdFx0XHQvLyByZXZlYWwgY2VsbCAzLCB0b3AgMjAwLCBib3R0b20gMzAwLCB3aGljaCBpcyBwYXJ0aWFsbHkgdmlzaWJsZSBpbiB0aGUgdmlld3BvcnRcblx0XHRcdFx0Y2VsbExpc3QucmV2ZWFsQ2VsbHMoeyBzdGFydDogMywgZW5kOiA0IH0pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbFRvcCwgOTApO1xuXG5cdFx0XHRcdC8vIHNjcm9sbCB0byA1XG5cdFx0XHRcdGNlbGxMaXN0LnNjcm9sbFRvcCA9IDU7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsVG9wLCA1KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRWaWV3U2Nyb2xsQm90dG9tKCksIDIxNSk7XG5cblx0XHRcdFx0Ly8gcmV2ZWFsIGNlbGwgMCwgdG9wIDAsIGJvdHRvbSA1MFxuXHRcdFx0XHRjZWxsTGlzdC5yZXZlYWxDZWxscyh7IHN0YXJ0OiAwLCBlbmQ6IDEgfSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsVG9wLCAwKTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXZlYWxFbGVtZW50c0luVmlldzogcmV2ZWFsIGNlbGwgb3V0IG9mIHZpZXdwb3J0JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIGInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBjJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsLCBkaXNwb3NhYmxlcykgPT4ge1xuXHRcdFx0XHR2aWV3TW9kZWwucmVzdG9yZUVkaXRvclZpZXdTdGF0ZSh7XG5cdFx0XHRcdFx0ZWRpdGluZ0NlbGxzOiBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXSxcblx0XHRcdFx0XHRlZGl0b3JWaWV3U3RhdGVzOiBbbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbF0sXG5cdFx0XHRcdFx0Y2VsbFRvdGFsSGVpZ2h0czogWzUwLCAxMDAsIDUwLCAxMDAsIDUwXSxcblx0XHRcdFx0XHRjZWxsTGluZU51bWJlclN0YXRlczoge30sXG5cdFx0XHRcdFx0Y29sbGFwc2VkSW5wdXRDZWxsczoge30sXG5cdFx0XHRcdFx0Y29sbGFwc2VkT3V0cHV0Q2VsbHM6IHt9LFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjb25zdCBjZWxsTGlzdCA9IGNyZWF0ZU5vdGVib29rQ2VsbExpc3QoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzKTtcblx0XHRcdFx0Ly8gd2l0aG91dCBwYWRkaW5nQm90dG9tLCB0aGUgbGFzdCAyMCBweCB3aWxsIGFsd2F5cyBiZSBoaWRkZW4gZHVlIHRvIGB0b3BJbnNlcnRUb29sYmFySGVpZ2h0YFxuXHRcdFx0XHRjZWxsTGlzdC51cGRhdGVPcHRpb25zKHsgcGFkZGluZ0JvdHRvbTogMTAwIH0pO1xuXHRcdFx0XHRjZWxsTGlzdC5hdHRhY2hWaWV3TW9kZWwodmlld01vZGVsKTtcblxuXHRcdFx0XHQvLyByZW5kZXIgaGVpZ2h0IDIxMCwgaXQgY2FuIHJlbmRlciAzIGZ1bGwgY2VsbHMgYW5kIDEgcGFydGlhbCBjZWxsXG5cdFx0XHRcdGNlbGxMaXN0LmxheW91dCgyMTAsIDEwMCk7XG5cblx0XHRcdFx0Ly8gaW5pdCBzY3JvbGxUb3AgYW5kIHNjcm9sbEJvdHRvbVxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbFRvcCwgMCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3QuZ2V0Vmlld1Njcm9sbEJvdHRvbSgpLCAyMTApO1xuXG5cdFx0XHRcdGNlbGxMaXN0LnJldmVhbENlbGxzKHsgc3RhcnQ6IDQsIGVuZDogNSB9KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxUb3AsIDE0MCk7XG5cdFx0XHRcdC8vIGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3QuZ2V0Vmlld1Njcm9sbEJvdHRvbSgpLCAzMzApO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZUVsZW1lbnRIZWlnaHQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WycjIGhlYWRlciBhJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgYicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDI7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIGMnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV1cblx0XHRcdF0sXG5cdFx0XHRhc3luYyAoZWRpdG9yLCB2aWV3TW9kZWwsIGRpc3Bvc2FibGVzKSA9PiB7XG5cdFx0XHRcdHZpZXdNb2RlbC5yZXN0b3JlRWRpdG9yVmlld1N0YXRlKHtcblx0XHRcdFx0XHRlZGl0aW5nQ2VsbHM6IFtmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2VdLFxuXHRcdFx0XHRcdGVkaXRvclZpZXdTdGF0ZXM6IFtudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsXSxcblx0XHRcdFx0XHRjZWxsVG90YWxIZWlnaHRzOiBbNTAsIDEwMCwgNTAsIDEwMCwgNTBdLFxuXHRcdFx0XHRcdGNlbGxMaW5lTnVtYmVyU3RhdGVzOiB7fSxcblx0XHRcdFx0XHRjb2xsYXBzZWRJbnB1dENlbGxzOiB7fSxcblx0XHRcdFx0XHRjb2xsYXBzZWRPdXRwdXRDZWxsczoge30sXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGNvbnN0IGNlbGxMaXN0ID0gY3JlYXRlTm90ZWJvb2tDZWxsTGlzdChpbnN0YW50aWF0aW9uU2VydmljZSwgZGlzcG9zYWJsZXMpO1xuXHRcdFx0XHRjZWxsTGlzdC5hdHRhY2hWaWV3TW9kZWwodmlld01vZGVsKTtcblxuXHRcdFx0XHQvLyByZW5kZXIgaGVpZ2h0IDIxMCwgaXQgY2FuIHJlbmRlciAzIGZ1bGwgY2VsbHMgYW5kIDEgcGFydGlhbCBjZWxsXG5cdFx0XHRcdGNlbGxMaXN0LmxheW91dCgyMTAsIDEwMCk7XG5cblx0XHRcdFx0Ly8gaW5pdCBzY3JvbGxUb3AgYW5kIHNjcm9sbEJvdHRvbVxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbFRvcCwgMCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3QuZ2V0Vmlld1Njcm9sbEJvdHRvbSgpLCAyMTApO1xuXG5cdFx0XHRcdGNlbGxMaXN0LnVwZGF0ZUVsZW1lbnRIZWlnaHQoMCwgNjApO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbFRvcCwgMCk7XG5cblx0XHRcdFx0Ly8gc2Nyb2xsIHRvIDVcblx0XHRcdFx0Y2VsbExpc3Quc2Nyb2xsVG9wID0gNTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxUb3AsIDUpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LmdldFZpZXdTY3JvbGxCb3R0b20oKSwgMjE1KTtcblxuXHRcdFx0XHRjZWxsTGlzdC51cGRhdGVFbGVtZW50SGVpZ2h0KDAsIDgwKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxUb3AsIDUpO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZUVsZW1lbnRIZWlnaHQgd2l0aCBhbmNob3InLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WycjIGhlYWRlciBhJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgYicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDI7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIGMnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV1cblx0XHRcdF0sXG5cdFx0XHRhc3luYyAoZWRpdG9yLCB2aWV3TW9kZWwsIGRpc3Bvc2FibGVzKSA9PiB7XG5cdFx0XHRcdHZpZXdNb2RlbC5yZXN0b3JlRWRpdG9yVmlld1N0YXRlKHtcblx0XHRcdFx0XHRlZGl0aW5nQ2VsbHM6IFtmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2VdLFxuXHRcdFx0XHRcdGVkaXRvclZpZXdTdGF0ZXM6IFtudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsXSxcblx0XHRcdFx0XHRjZWxsVG90YWxIZWlnaHRzOiBbNTAsIDEwMCwgNTAsIDEwMCwgNTBdLFxuXHRcdFx0XHRcdGNlbGxMaW5lTnVtYmVyU3RhdGVzOiB7fSxcblx0XHRcdFx0XHRjb2xsYXBzZWRJbnB1dENlbGxzOiB7fSxcblx0XHRcdFx0XHRjb2xsYXBzZWRPdXRwdXRDZWxsczoge30sXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGNvbnN0IGNlbGxMaXN0ID0gY3JlYXRlTm90ZWJvb2tDZWxsTGlzdChpbnN0YW50aWF0aW9uU2VydmljZSwgZGlzcG9zYWJsZXMpO1xuXHRcdFx0XHRjZWxsTGlzdC5hdHRhY2hWaWV3TW9kZWwodmlld01vZGVsKTtcblxuXHRcdFx0XHQvLyByZW5kZXIgaGVpZ2h0IDIxMCwgaXQgY2FuIHJlbmRlciAzIGZ1bGwgY2VsbHMgYW5kIDEgcGFydGlhbCBjZWxsXG5cdFx0XHRcdGNlbGxMaXN0LmxheW91dCgyMTAsIDEwMCk7XG5cblx0XHRcdFx0Ly8gaW5pdCBzY3JvbGxUb3AgYW5kIHNjcm9sbEJvdHRvbVxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbFRvcCwgMCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3QuZ2V0Vmlld1Njcm9sbEJvdHRvbSgpLCAyMTApO1xuXG5cdFx0XHRcdC8vIHNjcm9sbCB0byA1XG5cdFx0XHRcdGNlbGxMaXN0LnVwZGF0ZUVsZW1lbnRIZWlnaHQyKHZpZXdNb2RlbC5jZWxsQXQoMCkhLCA1MCk7XG5cdFx0XHRcdGNlbGxMaXN0LnNjcm9sbFRvcCA9IDU7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsVG9wLCA1KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRWaWV3U2Nyb2xsQm90dG9tKCksIDIxNSk7XG5cblx0XHRcdFx0Y2VsbExpc3Quc2V0Rm9jdXMoWzFdKTtcblx0XHRcdFx0Y2VsbExpc3QudXBkYXRlRWxlbWVudEhlaWdodDIodmlld01vZGVsLmNlbGxBdCgwKSEsIDEwMCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsSGVpZ2h0LCA0MDApO1xuXG5cdFx0XHRcdC8vIHRoZSBmaXJzdCBjZWxsIGdyb3dzLCBhbmQgdGhlIGZvY3VzZWQgY2VsbCB3aWxsIHJlbWFpbiBmdWxseSB2aXNpYmxlLCBzbyB3ZSBkb24ndCBzY3JvbGxcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxUb3AsIDUpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LmdldFZpZXdTY3JvbGxCb3R0b20oKSwgMjE1KTtcblxuXHRcdFx0XHRjZWxsTGlzdC51cGRhdGVFbGVtZW50SGVpZ2h0Mih2aWV3TW9kZWwuY2VsbEF0KDApISwgMTUwKTtcblx0XHRcdFx0Ly8gdGhlIGZpcnN0IGNlbGwgZ3Jvd3MsIGFuZCB0aGUgZm9jdXNlZCBjZWxsIHdpbGwgYmUgcHVzaGVkIG91dCBvZiB2aWV3LCBzbyB3ZSBzY3JvbGwgZG93blxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbFRvcCwgNTUpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LmdldFZpZXdTY3JvbGxCb3R0b20oKSwgMjY1KTtcblxuXHRcdFx0XHQvLyBXZSBkb24ndCBhbmNob3IgdG8gdGhlIGZvY3VzZWQgY2VsbCB3aGVuIGNlbGxzIHNocmlua1xuXHRcdFx0XHRjZWxsTGlzdC51cGRhdGVFbGVtZW50SGVpZ2h0Mih2aWV3TW9kZWwuY2VsbEF0KDApISwgNTApO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbFRvcCwgNTUpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LmdldFZpZXdTY3JvbGxCb3R0b20oKSwgMjY1KTtcblxuXHRcdFx0XHQvLyBmb2N1cyB3b24ndCBiZSB2aXNpYmxlIGFmdGVyIGNlbGwgMCBncm93IHRvIDI1MCwgc28gbGV0J3MgdHJ5IHRvIGtlZXAgdGhlIGZvY3VzZWQgY2VsbCB2aXNpYmxlXG5cdFx0XHRcdGNlbGxMaXN0LnVwZGF0ZUVsZW1lbnRIZWlnaHQyKHZpZXdNb2RlbC5jZWxsQXQoMCkhLCAyNTApO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbFRvcCwgMjUwICsgMTAwIC0gY2VsbExpc3QucmVuZGVySGVpZ2h0KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRWaWV3U2Nyb2xsQm90dG9tKCksIDI1MCArIDEwMCAtIGNlbGxMaXN0LnJlbmRlckhlaWdodCArIDIxMCk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlRWxlbWVudEhlaWdodCB3aXRoIG5vIHNjcm9sbGluZycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25maWcuc2V0VXNlckNvbmZpZ3VyYXRpb24oTm90ZWJvb2tTZXR0aW5nLnNjcm9sbFRvUmV2ZWFsQ2VsbCwgJ25vbmUnKTtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgYycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdGFzeW5jIChlZGl0b3IsIHZpZXdNb2RlbCwgZGlzcG9zYWJsZXMpID0+IHtcblx0XHRcdFx0dmlld01vZGVsLnJlc3RvcmVFZGl0b3JWaWV3U3RhdGUoe1xuXHRcdFx0XHRcdGVkaXRpbmdDZWxsczogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV0sXG5cdFx0XHRcdFx0ZWRpdG9yVmlld1N0YXRlczogW251bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGxdLFxuXHRcdFx0XHRcdGNlbGxUb3RhbEhlaWdodHM6IFs1MCwgMTAwLCA1MCwgMTAwLCA1MF0sXG5cdFx0XHRcdFx0Y2VsbExpbmVOdW1iZXJTdGF0ZXM6IHt9LFxuXHRcdFx0XHRcdGNvbGxhcHNlZElucHV0Q2VsbHM6IHt9LFxuXHRcdFx0XHRcdGNvbGxhcHNlZE91dHB1dENlbGxzOiB7fSxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGNvbnN0IGNlbGxMaXN0ID0gY3JlYXRlTm90ZWJvb2tDZWxsTGlzdChpbnN0YW50aWF0aW9uU2VydmljZSwgZGlzcG9zYWJsZXMpO1xuXHRcdFx0XHRjZWxsTGlzdC5hdHRhY2hWaWV3TW9kZWwodmlld01vZGVsKTtcblxuXHRcdFx0XHQvLyByZW5kZXIgaGVpZ2h0IDIxMCwgaXQgY2FuIHJlbmRlciAzIGZ1bGwgY2VsbHMgYW5kIDEgcGFydGlhbCBjZWxsXG5cdFx0XHRcdGNlbGxMaXN0LmxheW91dCgyMTAsIDEwMCk7XG5cblx0XHRcdFx0Ly8gaW5pdCBzY3JvbGxUb3AgYW5kIHNjcm9sbEJvdHRvbVxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbFRvcCwgMCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3QuZ2V0Vmlld1Njcm9sbEJvdHRvbSgpLCAyMTApO1xuXG5cdFx0XHRcdC8vIHNjcm9sbCB0byA1XG5cdFx0XHRcdGNlbGxMaXN0LnVwZGF0ZUVsZW1lbnRIZWlnaHQyKHZpZXdNb2RlbC5jZWxsQXQoMCkhLCA1MCk7XG5cdFx0XHRcdGNlbGxMaXN0LnNjcm9sbFRvcCA9IDU7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsVG9wLCA1KTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRWaWV3U2Nyb2xsQm90dG9tKCksIDIxNSk7XG5cblx0XHRcdFx0Y2VsbExpc3Quc2V0Rm9jdXMoWzFdKTtcblx0XHRcdFx0Y2VsbExpc3QudXBkYXRlRWxlbWVudEhlaWdodDIodmlld01vZGVsLmNlbGxBdCgwKSEsIDEwMCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsSGVpZ2h0LCA0MDApO1xuXG5cdFx0XHRcdC8vIEFueSBjaGFuZ2UgaW4gY2VsbCBzaXplIHNob3VsZCBub3QgYWZmZWN0IHRoZSBzY3JvbGwgaGVpZ2h0IHdpdGggc2Nyb2xsVG9SZXZlYWwgc2V0IHRvIG5vbmVcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxUb3AsIDUpO1xuXG5cdFx0XHRcdGNlbGxMaXN0LnVwZGF0ZUVsZW1lbnRIZWlnaHQyKHZpZXdNb2RlbC5jZWxsQXQoMCkhLCA1MCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsVG9wLCA1KTtcblxuXHRcdFx0XHRjZWxsTGlzdC51cGRhdGVFbGVtZW50SGVpZ2h0Mih2aWV3TW9kZWwuY2VsbEF0KDApISwgMjUwKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxUb3AsIDUpO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZUVsZW1lbnRIZWlnaHQgd2l0aCBubyBzY3JvbGwgc2V0dGluZyBhbmQgY2VsbCBlZGl0b3IgZm9jdXNlZCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25maWcuc2V0VXNlckNvbmZpZ3VyYXRpb24oTm90ZWJvb2tTZXR0aW5nLnNjcm9sbFRvUmV2ZWFsQ2VsbCwgJ25vbmUnKTtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgYycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdGFzeW5jIChlZGl0b3IsIHZpZXdNb2RlbCwgZGlzcG9zYWJsZXMpID0+IHtcblx0XHRcdFx0dmlld01vZGVsLnJlc3RvcmVFZGl0b3JWaWV3U3RhdGUoe1xuXHRcdFx0XHRcdGVkaXRpbmdDZWxsczogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV0sXG5cdFx0XHRcdFx0ZWRpdG9yVmlld1N0YXRlczogW251bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGxdLFxuXHRcdFx0XHRcdGNlbGxUb3RhbEhlaWdodHM6IFs1MCwgMTAwLCA1MCwgMTAwLCA1MF0sXG5cdFx0XHRcdFx0Y2VsbExpbmVOdW1iZXJTdGF0ZXM6IHt9LFxuXHRcdFx0XHRcdGNvbGxhcHNlZElucHV0Q2VsbHM6IHt9LFxuXHRcdFx0XHRcdGNvbGxhcHNlZE91dHB1dENlbGxzOiB7fSxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGNvbnN0IGNlbGxMaXN0ID0gY3JlYXRlTm90ZWJvb2tDZWxsTGlzdChpbnN0YW50aWF0aW9uU2VydmljZSwgZGlzcG9zYWJsZXMpO1xuXHRcdFx0XHRjZWxsTGlzdC5hdHRhY2hWaWV3TW9kZWwodmlld01vZGVsKTtcblxuXHRcdFx0XHQvLyByZW5kZXIgaGVpZ2h0IDIxMCwgaXQgY2FuIHJlbmRlciAzIGZ1bGwgY2VsbHMgYW5kIDEgcGFydGlhbCBjZWxsXG5cdFx0XHRcdGNlbGxMaXN0LmxheW91dCgyMTAsIDEwMCk7XG5cblx0XHRcdFx0Ly8gaW5pdCBzY3JvbGxUb3AgYW5kIHNjcm9sbEJvdHRvbVxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbFRvcCwgMCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3QuZ2V0Vmlld1Njcm9sbEJvdHRvbSgpLCAyMTApO1xuXG5cdFx0XHRcdGNlbGxMaXN0LnNldEZvY3VzKFsxXSk7XG5cblx0XHRcdFx0ZWRpdG9yLmZvY3VzTm90ZWJvb2tDZWxsKGNlbGxMaXN0LnZpZXdNb2RlbD8uY2VsbEF0KDEpISwgJ2VkaXRvcicpO1xuXHRcdFx0XHRjZWxsTGlzdC51cGRhdGVFbGVtZW50SGVpZ2h0Mih2aWV3TW9kZWwuY2VsbEF0KDApISwgMTAwKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxIZWlnaHQsIDQwMCk7XG5cblx0XHRcdFx0Ly8gV2UgaGF2ZSB0aGUgY2VsbCBlZGl0b3IgZm9jdXNlZCwgc28gd2Ugc2hvdWxkIGFuY2hvciB0byB0aGF0IGNlbGxcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxUb3AsIDUwKTtcblxuXHRcdFx0XHRjZWxsTGlzdC51cGRhdGVFbGVtZW50SGVpZ2h0Mih2aWV3TW9kZWwuY2VsbEF0KDApISwgNTApO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbFRvcCwgMCk7XG5cblx0XHRcdFx0Y2VsbExpc3QudXBkYXRlRWxlbWVudEhlaWdodDIodmlld01vZGVsLmNlbGxBdCgwKSEsIDI1MCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsVG9wLCAyNTAgKyAxMDAgLSBjZWxsTGlzdC5yZW5kZXJIZWlnaHQpO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZUVsZW1lbnRIZWlnaHQgd2l0aCBmb2N1c2VkIGVsZW1lbnQgb3V0IG9mIHZpZXdwb3J0JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIGInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBjJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsLCBkaXNwb3NhYmxlcykgPT4ge1xuXHRcdFx0XHR2aWV3TW9kZWwucmVzdG9yZUVkaXRvclZpZXdTdGF0ZSh7XG5cdFx0XHRcdFx0ZWRpdGluZ0NlbGxzOiBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXSxcblx0XHRcdFx0XHRlZGl0b3JWaWV3U3RhdGVzOiBbbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbF0sXG5cdFx0XHRcdFx0Y2VsbFRvdGFsSGVpZ2h0czogWzUwLCAxMDAsIDUwLCAxMDAsIDUwXSxcblx0XHRcdFx0XHRjZWxsTGluZU51bWJlclN0YXRlczoge30sXG5cdFx0XHRcdFx0Y29sbGFwc2VkSW5wdXRDZWxsczoge30sXG5cdFx0XHRcdFx0Y29sbGFwc2VkT3V0cHV0Q2VsbHM6IHt9LFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjb25zdCBjZWxsTGlzdCA9IGNyZWF0ZU5vdGVib29rQ2VsbExpc3QoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzKTtcblx0XHRcdFx0Y2VsbExpc3QuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cblx0XHRcdFx0Ly8gcmVuZGVyIGhlaWdodCAyMTAsIGl0IGNhbiByZW5kZXIgMyBmdWxsIGNlbGxzIGFuZCAxIHBhcnRpYWwgY2VsbFxuXHRcdFx0XHRjZWxsTGlzdC5sYXlvdXQoMjEwLCAxMDApO1xuXG5cdFx0XHRcdC8vIGluaXQgc2Nyb2xsVG9wIGFuZCBzY3JvbGxCb3R0b21cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxUb3AsIDApO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxMaXN0LmdldFZpZXdTY3JvbGxCb3R0b20oKSwgMjEwKTtcblxuXHRcdFx0XHRjZWxsTGlzdC5zZXRGb2N1cyhbNF0pO1xuXHRcdFx0XHRjZWxsTGlzdC51cGRhdGVFbGVtZW50SGVpZ2h0Mih2aWV3TW9kZWwuY2VsbEF0KDEpISwgMTMwKTtcblx0XHRcdFx0Ly8gdGhlIGZvY3VzIGNlbGwgaXMgbm90IGluIHRoZSB2aWV3cG9ydCwgdGhlIHNjcm9sbHRvcCBzaG91bGQgbm90IGNoYW5nZSBhdCBhbGxcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxUb3AsIDApO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZUVsZW1lbnRIZWlnaHQgb2YgY2VsbHMgb3V0IG9mIHZpZXdwb3J0IHNob3VsZCBub3QgdHJpZ2dlciBzY3JvbGwgIzEyMTE0MCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgYycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdGFzeW5jIChlZGl0b3IsIHZpZXdNb2RlbCwgZGlzcG9zYWJsZXMpID0+IHtcblx0XHRcdFx0dmlld01vZGVsLnJlc3RvcmVFZGl0b3JWaWV3U3RhdGUoe1xuXHRcdFx0XHRcdGVkaXRpbmdDZWxsczogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV0sXG5cdFx0XHRcdFx0ZWRpdG9yVmlld1N0YXRlczogW251bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGxdLFxuXHRcdFx0XHRcdGNlbGxUb3RhbEhlaWdodHM6IFs1MCwgMTAwLCA1MCwgMTAwLCA1MF0sXG5cdFx0XHRcdFx0Y2VsbExpbmVOdW1iZXJTdGF0ZXM6IHt9LFxuXHRcdFx0XHRcdGNvbGxhcHNlZElucHV0Q2VsbHM6IHt9LFxuXHRcdFx0XHRcdGNvbGxhcHNlZE91dHB1dENlbGxzOiB7fSxcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Y29uc3QgY2VsbExpc3QgPSBjcmVhdGVOb3RlYm9va0NlbGxMaXN0KGluc3RhbnRpYXRpb25TZXJ2aWNlLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHRcdGNlbGxMaXN0LmF0dGFjaFZpZXdNb2RlbCh2aWV3TW9kZWwpO1xuXG5cdFx0XHRcdC8vIHJlbmRlciBoZWlnaHQgMjEwLCBpdCBjYW4gcmVuZGVyIDMgZnVsbCBjZWxscyBhbmQgMSBwYXJ0aWFsIGNlbGxcblx0XHRcdFx0Y2VsbExpc3QubGF5b3V0KDIxMCwgMTAwKTtcblxuXHRcdFx0XHQvLyBpbml0IHNjcm9sbFRvcCBhbmQgc2Nyb2xsQm90dG9tXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsVG9wLCAwKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRWaWV3U2Nyb2xsQm90dG9tKCksIDIxMCk7XG5cblx0XHRcdFx0Y2VsbExpc3Quc2V0Rm9jdXMoWzFdKTtcblx0XHRcdFx0Y2VsbExpc3Quc2Nyb2xsVG9wID0gODA7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsVG9wLCA4MCk7XG5cblx0XHRcdFx0Y2VsbExpc3QudXBkYXRlRWxlbWVudEhlaWdodDIodmlld01vZGVsLmNlbGxBdCgwKSEsIDMwKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxUb3AsIDYwKTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCd2aXNpYmxlUmFuZ2VzIHNob3VsZCBiZSBleGNsdXNpdmUgb2YgZW5kJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsLCBkaXNwb3NhYmxlcykgPT4ge1xuXHRcdFx0XHRjb25zdCBjZWxsTGlzdCA9IGNyZWF0ZU5vdGVib29rQ2VsbExpc3QoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzKTtcblx0XHRcdFx0Y2VsbExpc3QuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cblx0XHRcdFx0Ly8gcmVuZGVyIGhlaWdodCAyMTAsIGl0IGNhbiByZW5kZXIgMyBmdWxsIGNlbGxzIGFuZCAxIHBhcnRpYWwgY2VsbFxuXHRcdFx0XHRjZWxsTGlzdC5sYXlvdXQoMTAwLCAxMDApO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbExpc3QudmlzaWJsZVJhbmdlcywgW10pO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Zpc2libGVSYW5nZXMgc2hvdWxkIGJlIGV4Y2x1c2l2ZSBvZiBlbmQgMicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsLCBkaXNwb3NhYmxlcykgPT4ge1xuXHRcdFx0XHR2aWV3TW9kZWwucmVzdG9yZUVkaXRvclZpZXdTdGF0ZSh7XG5cdFx0XHRcdFx0ZWRpdGluZ0NlbGxzOiBbZmFsc2VdLFxuXHRcdFx0XHRcdGVkaXRvclZpZXdTdGF0ZXM6IFtudWxsXSxcblx0XHRcdFx0XHRjZWxsVG90YWxIZWlnaHRzOiBbNTBdLFxuXHRcdFx0XHRcdGNlbGxMaW5lTnVtYmVyU3RhdGVzOiB7fSxcblx0XHRcdFx0XHRjb2xsYXBzZWRJbnB1dENlbGxzOiB7fSxcblx0XHRcdFx0XHRjb2xsYXBzZWRPdXRwdXRDZWxsczoge30sXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGNvbnN0IGNlbGxMaXN0ID0gY3JlYXRlTm90ZWJvb2tDZWxsTGlzdChpbnN0YW50aWF0aW9uU2VydmljZSwgZGlzcG9zYWJsZXMpO1xuXHRcdFx0XHRjZWxsTGlzdC5hdHRhY2hWaWV3TW9kZWwodmlld01vZGVsKTtcblxuXHRcdFx0XHQvLyByZW5kZXIgaGVpZ2h0IDIxMCwgaXQgY2FuIHJlbmRlciAzIGZ1bGwgY2VsbHMgYW5kIDEgcGFydGlhbCBjZWxsXG5cdFx0XHRcdGNlbGxMaXN0LmxheW91dCgxMDAsIDEwMCk7XG5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsTGlzdC52aXNpYmxlUmFuZ2VzLCBbeyBzdGFydDogMCwgZW5kOiAxIH1dKTtcblx0XHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZ0NBQWdDO0FBRXpDLFNBQVMsVUFBVSx1QkFBdUI7QUFDMUMsU0FBUyx3QkFBd0IsMkJBQTJCLHdCQUF3QjtBQUVwRixNQUFNLG9CQUFvQixNQUFNO0FBQy9CLE1BQUk7QUFDSixNQUFJO0FBRUosV0FBUyxNQUFNO0FBQ2Qsb0JBQWdCLFFBQVE7QUFBQSxFQUN6QixDQUFDO0FBRUQsMENB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
