import assert from "assert";
import { Event } from "../../../../../base/common/event.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { mock } from "../../../../../base/test/common/mock.js";
import { assertSnapshot } from "../../../../../base/test/common/snapshot.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { ILanguageFeaturesService } from "../../../../../editor/common/services/languageFeatures.js";
import { LanguageFeaturesService } from "../../../../../editor/common/services/languageFeaturesService.js";
import { NotebookCellOutline } from "../../browser/contrib/outline/notebookOutline.js";
import { computeContent } from "../../browser/viewParts/notebookEditorStickyScroll.js";
import { CellKind } from "../../common/notebookCommon.js";
import { createNotebookCellList, setupInstantiationService, withTestNotebook } from "./testNotebookEditor.js";
import { OutlineTarget } from "../../../../services/outline/browser/outline.js";
suite("NotebookEditorStickyScroll", () => {
  let disposables;
  let instantiationService;
  const domNode = document.createElement("div");
  teardown(() => {
    disposables.dispose();
  });
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  setup(() => {
    disposables = new DisposableStore();
    instantiationService = setupInstantiationService(disposables);
    instantiationService.set(ILanguageFeaturesService, new LanguageFeaturesService());
  });
  function getOutline(editor) {
    if (!editor.hasModel()) {
      assert.ok(false, "MUST have active text editor");
    }
    const outline = store.add(instantiationService.createInstance(NotebookCellOutline, new class extends mock() {
      constructor() {
        super(...arguments);
        this.onDidChangeModel = Event.None;
        this.onDidChangeSelection = Event.None;
      }
      getControl() {
        return editor;
      }
    }(), OutlineTarget.QuickPick));
    return outline;
  }
  function nbStickyTestHelper(domNode2, notebookEditor, notebookCellList, notebookOutlineEntries, disposables2) {
    const output = computeContent(notebookEditor, notebookCellList, notebookOutlineEntries, 0);
    for (const stickyLine of output.values()) {
      disposables2.add(stickyLine.line);
    }
    return createStickyTestElement(output.values());
  }
  function createStickyTestElement(stickyLines) {
    const outputElements = [];
    for (const stickyLine of stickyLines) {
      if (stickyLine.rendered) {
        outputElements.unshift(stickyLine.line.element.innerText);
      }
    }
    return outputElements;
  }
  test("test0: should render empty, 	scrollTop at 0", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["## header aa", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var c = 2;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel) => {
        viewModel.restoreEditorViewState({
          editingCells: Array.from({ length: 8 }, () => false),
          editorViewStates: Array.from({ length: 8 }, () => null),
          cellTotalHeights: Array.from({ length: 8 }, () => 50),
          cellLineNumberStates: {},
          collapsedInputCells: {},
          collapsedOutputCells: {}
        });
        const cellList = disposables.add(createNotebookCellList(instantiationService, disposables));
        cellList.attachViewModel(viewModel);
        cellList.layout(400, 100);
        editor.setScrollTop(0);
        editor.visibleRanges = [{ start: 0, end: 8 }];
        const outline = getOutline(editor);
        const notebookOutlineEntries = outline.entries;
        const resultingMap = nbStickyTestHelper(domNode, editor, cellList, notebookOutlineEntries, disposables);
        await assertSnapshot(resultingMap);
        outline.dispose();
      }
    );
  });
  test("test1: should render 0->1, 	visible range 3->8", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        // 0
        ["## header aa", "markdown", CellKind.Markup, [], {}],
        // 50
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        // 100
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        // 150
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        // 200
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        // 250
        ["# header b", "markdown", CellKind.Markup, [], {}],
        // 300
        ["var c = 2;", "javascript", CellKind.Code, [], {}]
        // 350
      ],
      async (editor, viewModel, ds) => {
        viewModel.restoreEditorViewState({
          editingCells: Array.from({ length: 8 }, () => false),
          editorViewStates: Array.from({ length: 8 }, () => null),
          cellTotalHeights: Array.from({ length: 8 }, () => 50),
          cellLineNumberStates: {},
          collapsedInputCells: {},
          collapsedOutputCells: {}
        });
        const cellList = ds.add(createNotebookCellList(instantiationService, ds));
        cellList.attachViewModel(viewModel);
        cellList.layout(400, 100);
        editor.setScrollTop(175);
        editor.visibleRanges = [{ start: 3, end: 8 }];
        const outline = getOutline(editor);
        const notebookOutlineEntries = outline.entries;
        const resultingMap = nbStickyTestHelper(domNode, editor, cellList, notebookOutlineEntries, ds);
        await assertSnapshot(resultingMap);
        outline.dispose();
      }
    );
  });
  test("test2: should render 0, 		visible range 6->9 so collapsing next 2 against following section", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        // 0
        ["## header aa", "markdown", CellKind.Markup, [], {}],
        // 50
        ["### header aaa", "markdown", CellKind.Markup, [], {}],
        // 100
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        // 150
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        // 200
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        // 250
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        // 300
        ["# header b", "markdown", CellKind.Markup, [], {}],
        // 350
        ["var c = 2;", "javascript", CellKind.Code, [], {}]
        // 400
      ],
      async (editor, viewModel, ds) => {
        viewModel.restoreEditorViewState({
          editingCells: Array.from({ length: 9 }, () => false),
          editorViewStates: Array.from({ length: 9 }, () => null),
          cellTotalHeights: Array.from({ length: 9 }, () => 50),
          cellLineNumberStates: {},
          collapsedInputCells: {},
          collapsedOutputCells: {}
        });
        const cellList = ds.add(createNotebookCellList(instantiationService, ds));
        cellList.attachViewModel(viewModel);
        cellList.layout(400, 100);
        editor.setScrollTop(325);
        editor.visibleRanges = [{ start: 6, end: 9 }];
        const outline = getOutline(editor);
        const notebookOutlineEntries = outline.entries;
        const resultingMap = nbStickyTestHelper(domNode, editor, cellList, notebookOutlineEntries, ds);
        await assertSnapshot(resultingMap);
        outline.dispose();
      }
    );
  });
  test("test3: should render 0->2, 	collapsing against equivalent level header", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        // 0
        ["## header aa", "markdown", CellKind.Markup, [], {}],
        // 50
        ["### header aaa", "markdown", CellKind.Markup, [], {}],
        // 100
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        // 150
        ["### header aab", "markdown", CellKind.Markup, [], {}],
        // 200
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        // 250
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        // 300
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        // 350
        ["# header b", "markdown", CellKind.Markup, [], {}],
        // 400
        ["var c = 2;", "javascript", CellKind.Code, [], {}]
        // 450
      ],
      async (editor, viewModel, ds) => {
        viewModel.restoreEditorViewState({
          editingCells: Array.from({ length: 10 }, () => false),
          editorViewStates: Array.from({ length: 10 }, () => null),
          cellTotalHeights: Array.from({ length: 10 }, () => 50),
          cellLineNumberStates: {},
          collapsedInputCells: {},
          collapsedOutputCells: {}
        });
        const cellList = ds.add(createNotebookCellList(instantiationService, ds));
        cellList.attachViewModel(viewModel);
        cellList.layout(400, 100);
        editor.setScrollTop(175);
        editor.visibleRanges = [{ start: 3, end: 10 }];
        const outline = getOutline(editor);
        const notebookOutlineEntries = outline.entries;
        const resultingMap = nbStickyTestHelper(domNode, editor, cellList, notebookOutlineEntries, ds);
        await assertSnapshot(resultingMap);
        outline.dispose();
      }
    );
  });
  test("test4: should render 0, 		scrolltop halfway through cell 0", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["## header aa", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var c = 2;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel, ds) => {
        viewModel.restoreEditorViewState({
          editingCells: Array.from({ length: 8 }, () => false),
          editorViewStates: Array.from({ length: 8 }, () => null),
          cellTotalHeights: Array.from({ length: 8 }, () => 50),
          cellLineNumberStates: {},
          collapsedInputCells: {},
          collapsedOutputCells: {}
        });
        const cellList = ds.add(createNotebookCellList(instantiationService, ds));
        cellList.attachViewModel(viewModel);
        cellList.layout(400, 100);
        editor.setScrollTop(50);
        editor.visibleRanges = [{ start: 0, end: 8 }];
        const outline = getOutline(editor);
        const notebookOutlineEntries = outline.entries;
        const resultingMap = nbStickyTestHelper(domNode, editor, cellList, notebookOutlineEntries, ds);
        await assertSnapshot(resultingMap);
        outline.dispose();
      }
    );
  });
  test("test5: should render 0->2, 	scrolltop halfway through cell 2", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["## header aa", "markdown", CellKind.Markup, [], {}],
        ["### header aaa", "markdown", CellKind.Markup, [], {}],
        ["#### header aaaa", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["var c = 2;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel, ds) => {
        viewModel.restoreEditorViewState({
          editingCells: Array.from({ length: 10 }, () => false),
          editorViewStates: Array.from({ length: 10 }, () => null),
          cellTotalHeights: Array.from({ length: 10 }, () => 50),
          cellLineNumberStates: {},
          collapsedInputCells: {},
          collapsedOutputCells: {}
        });
        const cellList = ds.add(createNotebookCellList(instantiationService, ds));
        cellList.attachViewModel(viewModel);
        cellList.layout(400, 100);
        editor.setScrollTop(125);
        editor.visibleRanges = [{ start: 2, end: 10 }];
        const outline = getOutline(editor);
        const notebookOutlineEntries = outline.entries;
        const resultingMap = nbStickyTestHelper(domNode, editor, cellList, notebookOutlineEntries, ds);
        await assertSnapshot(resultingMap);
        outline.dispose();
      }
    );
  });
  test("test6: should render 6->7, 	scrolltop halfway through cell 7", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        ["## header aa", "markdown", CellKind.Markup, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        ["# header b", "markdown", CellKind.Markup, [], {}],
        ["## header bb", "markdown", CellKind.Markup, [], {}],
        ["### header bbb", "markdown", CellKind.Markup, [], {}],
        ["var c = 2;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel, ds) => {
        viewModel.restoreEditorViewState({
          editingCells: Array.from({ length: 10 }, () => false),
          editorViewStates: Array.from({ length: 10 }, () => null),
          cellTotalHeights: Array.from({ length: 10 }, () => 50),
          cellLineNumberStates: {},
          collapsedInputCells: {},
          collapsedOutputCells: {}
        });
        const cellList = ds.add(createNotebookCellList(instantiationService, ds));
        cellList.attachViewModel(viewModel);
        cellList.layout(400, 100);
        editor.setScrollTop(375);
        editor.visibleRanges = [{ start: 7, end: 10 }];
        const outline = getOutline(editor);
        const notebookOutlineEntries = outline.entries;
        const resultingMap = nbStickyTestHelper(domNode, editor, cellList, notebookOutlineEntries, ds);
        await assertSnapshot(resultingMap);
        outline.dispose();
      }
    );
  });
  test("test7: should render 0->1, 	collapsing against next section", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}],
        //0
        ["## header aa", "markdown", CellKind.Markup, [], {}],
        //50
        ["### header aaa", "markdown", CellKind.Markup, [], {}],
        //100
        ["#### header aaaa", "markdown", CellKind.Markup, [], {}],
        //150
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        //200
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        //250
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        //300
        ["var b = 1;", "javascript", CellKind.Code, [], {}],
        //350
        ["# header b", "markdown", CellKind.Markup, [], {}],
        //400
        ["## header bb", "markdown", CellKind.Markup, [], {}],
        //450
        ["### header bbb", "markdown", CellKind.Markup, [], {}],
        ["var c = 2;", "javascript", CellKind.Code, [], {}]
      ],
      async (editor, viewModel, ds) => {
        viewModel.restoreEditorViewState({
          editingCells: Array.from({ length: 12 }, () => false),
          editorViewStates: Array.from({ length: 12 }, () => null),
          cellTotalHeights: Array.from({ length: 12 }, () => 50),
          cellLineNumberStates: {},
          collapsedInputCells: {},
          collapsedOutputCells: {}
        });
        const cellList = ds.add(createNotebookCellList(instantiationService, ds));
        cellList.attachViewModel(viewModel);
        cellList.layout(400, 100);
        editor.setScrollTop(350);
        editor.visibleRanges = [{ start: 7, end: 12 }];
        const outline = getOutline(editor);
        const notebookOutlineEntries = outline.entries;
        const resultingMap = nbStickyTestHelper(domNode, editor, cellList, notebookOutlineEntries, ds);
        await assertSnapshot(resultingMap);
        outline.dispose();
      }
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay90ZXN0L2Jyb3dzZXIvbm90ZWJvb2tTdGlja3lTY3JvbGwudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IG1vY2sgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL21vY2suanMnO1xuaW1wb3J0IHsgYXNzZXJ0U25hcHNob3QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3NuYXBzaG90LmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IExhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0NlbGxPdXRsaW5lIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb250cmliL291dGxpbmUvbm90ZWJvb2tPdXRsaW5lLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0VkaXRvciwgSU5vdGVib29rRWRpdG9yUGFuZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvbm90ZWJvb2tCcm93c2VyLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0NlbGxMaXN0IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci92aWV3L25vdGVib29rUmVuZGVyaW5nQ29tbW9uLmpzJztcbmltcG9ydCB7IE91dGxpbmVFbnRyeSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvdmlld01vZGVsL091dGxpbmVFbnRyeS5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va1N0aWNreUxpbmUsIGNvbXB1dGVDb250ZW50IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci92aWV3UGFydHMvbm90ZWJvb2tFZGl0b3JTdGlja3lTY3JvbGwuanMnO1xuaW1wb3J0IHsgQ2VsbEtpbmQgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgY3JlYXRlTm90ZWJvb2tDZWxsTGlzdCwgc2V0dXBJbnN0YW50aWF0aW9uU2VydmljZSwgd2l0aFRlc3ROb3RlYm9vayB9IGZyb20gJy4vdGVzdE5vdGVib29rRWRpdG9yLmpzJztcbmltcG9ydCB7IE91dGxpbmVUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9vdXRsaW5lL2Jyb3dzZXIvb3V0bGluZS5qcyc7XG5cbnN1aXRlKCdOb3RlYm9va0VkaXRvclN0aWNreVNjcm9sbCcsICgpID0+IHtcblx0bGV0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXG5cdGNvbnN0IGRvbU5vZGU6IEhUTUxFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0Y29uc3Qgc3RvcmUgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSBzZXR1cEluc3RhbnRpYXRpb25TZXJ2aWNlKGRpc3Bvc2FibGVzKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLCBuZXcgTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UoKSk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGdldE91dGxpbmUoZWRpdG9yOiBhbnkpIHtcblx0XHRpZiAoIWVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRhc3NlcnQub2soZmFsc2UsICdNVVNUIGhhdmUgYWN0aXZlIHRleHQgZWRpdG9yJyk7XG5cdFx0fVxuXHRcdGNvbnN0IG91dGxpbmUgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90ZWJvb2tDZWxsT3V0bGluZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJTm90ZWJvb2tFZGl0b3JQYW5lPigpIHtcblx0XHRcdG92ZXJyaWRlIGdldENvbnRyb2woKSB7XG5cdFx0XHRcdHJldHVybiBlZGl0b3I7XG5cdFx0XHR9XG5cdFx0XHRvdmVycmlkZSBvbkRpZENoYW5nZU1vZGVsOiBFdmVudDx2b2lkPiA9IEV2ZW50Lk5vbmU7XG5cdFx0XHRvdmVycmlkZSBvbkRpZENoYW5nZVNlbGVjdGlvbjogRXZlbnQ8SUVkaXRvclBhbmVTZWxlY3Rpb25DaGFuZ2VFdmVudD4gPSBFdmVudC5Ob25lO1xuXHRcdH0sIE91dGxpbmVUYXJnZXQuUXVpY2tQaWNrKSk7XG5cdFx0cmV0dXJuIG91dGxpbmU7XG5cdH1cblxuXHRmdW5jdGlvbiBuYlN0aWNreVRlc3RIZWxwZXIoZG9tTm9kZTogSFRNTEVsZW1lbnQsIG5vdGVib29rRWRpdG9yOiBJTm90ZWJvb2tFZGl0b3IsIG5vdGVib29rQ2VsbExpc3Q6IElOb3RlYm9va0NlbGxMaXN0LCBub3RlYm9va091dGxpbmVFbnRyaWVzOiBPdXRsaW5lRW50cnlbXSwgZGlzcG9zYWJsZXM6IFBpY2s8RGlzcG9zYWJsZVN0b3JlLCAnYWRkJz4pIHtcblx0XHRjb25zdCBvdXRwdXQgPSBjb21wdXRlQ29udGVudChub3RlYm9va0VkaXRvciwgbm90ZWJvb2tDZWxsTGlzdCwgbm90ZWJvb2tPdXRsaW5lRW50cmllcywgMCk7XG5cdFx0Zm9yIChjb25zdCBzdGlja3lMaW5lIG9mIG91dHB1dC52YWx1ZXMoKSkge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHN0aWNreUxpbmUubGluZSk7XG5cdFx0fVxuXHRcdHJldHVybiBjcmVhdGVTdGlja3lUZXN0RWxlbWVudChvdXRwdXQudmFsdWVzKCkpO1xuXHR9XG5cblx0ZnVuY3Rpb24gY3JlYXRlU3RpY2t5VGVzdEVsZW1lbnQoc3RpY2t5TGluZXM6IEl0ZXJhYmxlSXRlcmF0b3I8eyBsaW5lOiBOb3RlYm9va1N0aWNreUxpbmU7IHJlbmRlcmVkOiBib29sZWFuIH0+KSB7XG5cdFx0Y29uc3Qgb3V0cHV0RWxlbWVudHMgPSBbXTtcblx0XHRmb3IgKGNvbnN0IHN0aWNreUxpbmUgb2Ygc3RpY2t5TGluZXMpIHtcblx0XHRcdGlmIChzdGlja3lMaW5lLnJlbmRlcmVkKSB7XG5cdFx0XHRcdG91dHB1dEVsZW1lbnRzLnVuc2hpZnQoc3RpY2t5TGluZS5saW5lLmVsZW1lbnQuaW5uZXJUZXh0KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG91dHB1dEVsZW1lbnRzO1xuXHR9XG5cblx0dGVzdCgndGVzdDA6IHNob3VsZCByZW5kZXIgZW1wdHksIFx0c2Nyb2xsVG9wIGF0IDAnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WycjIGhlYWRlciBhJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMjIGhlYWRlciBhYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIGInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGMgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdGFzeW5jIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0XHR2aWV3TW9kZWwucmVzdG9yZUVkaXRvclZpZXdTdGF0ZSh7XG5cdFx0XHRcdFx0ZWRpdGluZ0NlbGxzOiBBcnJheS5mcm9tKHsgbGVuZ3RoOiA4IH0sICgpID0+IGZhbHNlKSxcblx0XHRcdFx0XHRlZGl0b3JWaWV3U3RhdGVzOiBBcnJheS5mcm9tKHsgbGVuZ3RoOiA4IH0sICgpID0+IG51bGwpLFxuXHRcdFx0XHRcdGNlbGxUb3RhbEhlaWdodHM6IEFycmF5LmZyb20oeyBsZW5ndGg6IDggfSwgKCkgPT4gNTApLFxuXHRcdFx0XHRcdGNlbGxMaW5lTnVtYmVyU3RhdGVzOiB7fSxcblx0XHRcdFx0XHRjb2xsYXBzZWRJbnB1dENlbGxzOiB7fSxcblx0XHRcdFx0XHRjb2xsYXBzZWRPdXRwdXRDZWxsczoge30sXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGNvbnN0IGNlbGxMaXN0ID0gZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZU5vdGVib29rQ2VsbExpc3QoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzKSk7XG5cdFx0XHRcdGNlbGxMaXN0LmF0dGFjaFZpZXdNb2RlbCh2aWV3TW9kZWwpO1xuXHRcdFx0XHRjZWxsTGlzdC5sYXlvdXQoNDAwLCAxMDApO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTY3JvbGxUb3AoMCk7XG5cdFx0XHRcdGVkaXRvci52aXNpYmxlUmFuZ2VzID0gW3sgc3RhcnQ6IDAsIGVuZDogOCB9XTtcblxuXHRcdFx0XHRjb25zdCBvdXRsaW5lID0gZ2V0T3V0bGluZShlZGl0b3IpO1xuXHRcdFx0XHRjb25zdCBub3RlYm9va091dGxpbmVFbnRyaWVzID0gb3V0bGluZS5lbnRyaWVzO1xuXHRcdFx0XHRjb25zdCByZXN1bHRpbmdNYXAgPSBuYlN0aWNreVRlc3RIZWxwZXIoZG9tTm9kZSwgZWRpdG9yLCBjZWxsTGlzdCwgbm90ZWJvb2tPdXRsaW5lRW50cmllcywgZGlzcG9zYWJsZXMpO1xuXHRcdFx0XHRhd2FpdCBhc3NlcnRTbmFwc2hvdChyZXN1bHRpbmdNYXApO1xuXHRcdFx0XHRvdXRsaW5lLmRpc3Bvc2UoKTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCd0ZXN0MTogc2hvdWxkIHJlbmRlciAwLT4xLCBcdHZpc2libGUgcmFuZ2UgMy0+OCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXHQvLyAwXG5cdFx0XHRcdFsnIyMgaGVhZGVyIGFhJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFx0Ly8gNTBcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFx0Ly8gMTAwXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcdC8vIDE1MFxuXHRcdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXHQvLyAyMDBcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFx0Ly8gMjUwXG5cdFx0XHRcdFsnIyBoZWFkZXIgYicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcdC8vIDMwMFxuXHRcdFx0XHRbJ3ZhciBjID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cdFx0Ly8gMzUwXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsLCBkcykgPT4ge1xuXHRcdFx0XHR2aWV3TW9kZWwucmVzdG9yZUVkaXRvclZpZXdTdGF0ZSh7XG5cdFx0XHRcdFx0ZWRpdGluZ0NlbGxzOiBBcnJheS5mcm9tKHsgbGVuZ3RoOiA4IH0sICgpID0+IGZhbHNlKSxcblx0XHRcdFx0XHRlZGl0b3JWaWV3U3RhdGVzOiBBcnJheS5mcm9tKHsgbGVuZ3RoOiA4IH0sICgpID0+IG51bGwpLFxuXHRcdFx0XHRcdGNlbGxUb3RhbEhlaWdodHM6IEFycmF5LmZyb20oeyBsZW5ndGg6IDggfSwgKCkgPT4gNTApLFxuXHRcdFx0XHRcdGNlbGxMaW5lTnVtYmVyU3RhdGVzOiB7fSxcblx0XHRcdFx0XHRjb2xsYXBzZWRJbnB1dENlbGxzOiB7fSxcblx0XHRcdFx0XHRjb2xsYXBzZWRPdXRwdXRDZWxsczoge30sXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGNvbnN0IGNlbGxMaXN0ID0gZHMuYWRkKGNyZWF0ZU5vdGVib29rQ2VsbExpc3QoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRzKSk7XG5cdFx0XHRcdGNlbGxMaXN0LmF0dGFjaFZpZXdNb2RlbCh2aWV3TW9kZWwpO1xuXHRcdFx0XHRjZWxsTGlzdC5sYXlvdXQoNDAwLCAxMDApO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTY3JvbGxUb3AoMTc1KTtcblx0XHRcdFx0ZWRpdG9yLnZpc2libGVSYW5nZXMgPSBbeyBzdGFydDogMywgZW5kOiA4IH1dO1xuXG5cdFx0XHRcdGNvbnN0IG91dGxpbmUgPSBnZXRPdXRsaW5lKGVkaXRvcik7XG5cdFx0XHRcdGNvbnN0IG5vdGVib29rT3V0bGluZUVudHJpZXMgPSBvdXRsaW5lLmVudHJpZXM7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdGluZ01hcCA9IG5iU3RpY2t5VGVzdEhlbHBlcihkb21Ob2RlLCBlZGl0b3IsIGNlbGxMaXN0LCBub3RlYm9va091dGxpbmVFbnRyaWVzLCBkcyk7XG5cblx0XHRcdFx0YXdhaXQgYXNzZXJ0U25hcHNob3QocmVzdWx0aW5nTWFwKTtcblx0XHRcdFx0b3V0bGluZS5kaXNwb3NlKCk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgndGVzdDI6IHNob3VsZCByZW5kZXIgMCwgXHRcdHZpc2libGUgcmFuZ2UgNi0+OSBzbyBjb2xsYXBzaW5nIG5leHQgMiBhZ2FpbnN0IGZvbGxvd2luZyBzZWN0aW9uJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcdC8vIDBcblx0XHRcdFx0WycjIyBoZWFkZXIgYWEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXHQvLyA1MFxuXHRcdFx0XHRbJyMjIyBoZWFkZXIgYWFhJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLC8vIDEwMFxuXHRcdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXHQvLyAxNTBcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFx0Ly8gMjAwXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcdC8vIDI1MFxuXHRcdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXHQvLyAzMDBcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFx0Ly8gMzUwXG5cdFx0XHRcdFsndmFyIGMgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVx0XHQvLyA0MDBcblx0XHRcdF0sXG5cdFx0XHRhc3luYyAoZWRpdG9yLCB2aWV3TW9kZWwsIGRzKSA9PiB7XG5cdFx0XHRcdHZpZXdNb2RlbC5yZXN0b3JlRWRpdG9yVmlld1N0YXRlKHtcblx0XHRcdFx0XHRlZGl0aW5nQ2VsbHM6IEFycmF5LmZyb20oeyBsZW5ndGg6IDkgfSwgKCkgPT4gZmFsc2UpLFxuXHRcdFx0XHRcdGVkaXRvclZpZXdTdGF0ZXM6IEFycmF5LmZyb20oeyBsZW5ndGg6IDkgfSwgKCkgPT4gbnVsbCksXG5cdFx0XHRcdFx0Y2VsbFRvdGFsSGVpZ2h0czogQXJyYXkuZnJvbSh7IGxlbmd0aDogOSB9LCAoKSA9PiA1MCksXG5cdFx0XHRcdFx0Y2VsbExpbmVOdW1iZXJTdGF0ZXM6IHt9LFxuXHRcdFx0XHRcdGNvbGxhcHNlZElucHV0Q2VsbHM6IHt9LFxuXHRcdFx0XHRcdGNvbGxhcHNlZE91dHB1dENlbGxzOiB7fSxcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Y29uc3QgY2VsbExpc3QgPSBkcy5hZGQoY3JlYXRlTm90ZWJvb2tDZWxsTGlzdChpbnN0YW50aWF0aW9uU2VydmljZSwgZHMpKTtcblx0XHRcdFx0Y2VsbExpc3QuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cdFx0XHRcdGNlbGxMaXN0LmxheW91dCg0MDAsIDEwMCk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNjcm9sbFRvcCgzMjUpOyAvLyByb29tIGZvciBhIHNpbmdsZSBoZWFkZXJcblx0XHRcdFx0ZWRpdG9yLnZpc2libGVSYW5nZXMgPSBbeyBzdGFydDogNiwgZW5kOiA5IH1dO1xuXG5cdFx0XHRcdGNvbnN0IG91dGxpbmUgPSBnZXRPdXRsaW5lKGVkaXRvcik7XG5cdFx0XHRcdGNvbnN0IG5vdGVib29rT3V0bGluZUVudHJpZXMgPSBvdXRsaW5lLmVudHJpZXM7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdGluZ01hcCA9IG5iU3RpY2t5VGVzdEhlbHBlcihkb21Ob2RlLCBlZGl0b3IsIGNlbGxMaXN0LCBub3RlYm9va091dGxpbmVFbnRyaWVzLCBkcyk7XG5cblx0XHRcdFx0YXdhaXQgYXNzZXJ0U25hcHNob3QocmVzdWx0aW5nTWFwKTtcblx0XHRcdFx0b3V0bGluZS5kaXNwb3NlKCk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgndGVzdDM6IHNob3VsZCByZW5kZXIgMC0+MiwgXHRjb2xsYXBzaW5nIGFnYWluc3QgZXF1aXZhbGVudCBsZXZlbCBoZWFkZXInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WycjIGhlYWRlciBhJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFx0Ly8gMFxuXHRcdFx0XHRbJyMjIGhlYWRlciBhYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcdC8vIDUwXG5cdFx0XHRcdFsnIyMjIGhlYWRlciBhYWEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sLy8gMTAwXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcdC8vIDE1MFxuXHRcdFx0XHRbJyMjIyBoZWFkZXIgYWFiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLC8vIDIwMFxuXHRcdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXHQvLyAyNTBcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFx0Ly8gMzAwXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcdC8vIDM1MFxuXHRcdFx0XHRbJyMgaGVhZGVyIGInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXHQvLyA0MDBcblx0XHRcdFx0Wyd2YXIgYyA9IDI7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXHRcdC8vIDQ1MFxuXHRcdFx0XSxcblx0XHRcdGFzeW5jIChlZGl0b3IsIHZpZXdNb2RlbCwgZHMpID0+IHtcblx0XHRcdFx0dmlld01vZGVsLnJlc3RvcmVFZGl0b3JWaWV3U3RhdGUoe1xuXHRcdFx0XHRcdGVkaXRpbmdDZWxsczogQXJyYXkuZnJvbSh7IGxlbmd0aDogMTAgfSwgKCkgPT4gZmFsc2UpLFxuXHRcdFx0XHRcdGVkaXRvclZpZXdTdGF0ZXM6IEFycmF5LmZyb20oeyBsZW5ndGg6IDEwIH0sICgpID0+IG51bGwpLFxuXHRcdFx0XHRcdGNlbGxUb3RhbEhlaWdodHM6IEFycmF5LmZyb20oeyBsZW5ndGg6IDEwIH0sICgpID0+IDUwKSxcblx0XHRcdFx0XHRjZWxsTGluZU51bWJlclN0YXRlczoge30sXG5cdFx0XHRcdFx0Y29sbGFwc2VkSW5wdXRDZWxsczoge30sXG5cdFx0XHRcdFx0Y29sbGFwc2VkT3V0cHV0Q2VsbHM6IHt9LFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjb25zdCBjZWxsTGlzdCA9IGRzLmFkZChjcmVhdGVOb3RlYm9va0NlbGxMaXN0KGluc3RhbnRpYXRpb25TZXJ2aWNlLCBkcykpO1xuXHRcdFx0XHRjZWxsTGlzdC5hdHRhY2hWaWV3TW9kZWwodmlld01vZGVsKTtcblx0XHRcdFx0Y2VsbExpc3QubGF5b3V0KDQwMCwgMTAwKTtcblxuXHRcdFx0XHRlZGl0b3Iuc2V0U2Nyb2xsVG9wKDE3NSk7IC8vIHJvb20gZm9yIGEgc2luZ2xlIGhlYWRlclxuXHRcdFx0XHRlZGl0b3IudmlzaWJsZVJhbmdlcyA9IFt7IHN0YXJ0OiAzLCBlbmQ6IDEwIH1dO1xuXG5cdFx0XHRcdGNvbnN0IG91dGxpbmUgPSBnZXRPdXRsaW5lKGVkaXRvcik7XG5cdFx0XHRcdGNvbnN0IG5vdGVib29rT3V0bGluZUVudHJpZXMgPSBvdXRsaW5lLmVudHJpZXM7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdGluZ01hcCA9IG5iU3RpY2t5VGVzdEhlbHBlcihkb21Ob2RlLCBlZGl0b3IsIGNlbGxMaXN0LCBub3RlYm9va091dGxpbmVFbnRyaWVzLCBkcyk7XG5cblx0XHRcdFx0YXdhaXQgYXNzZXJ0U25hcHNob3QocmVzdWx0aW5nTWFwKTtcblx0XHRcdFx0b3V0bGluZS5kaXNwb3NlKCk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0Ly8gb3V0ZGF0ZWQvaW1wcm9wZXIgYmVoYXZpb3Jcblx0dGVzdCgndGVzdDQ6IHNob3VsZCByZW5kZXIgMCwgXHRcdHNjcm9sbHRvcCBoYWxmd2F5IHRocm91Z2ggY2VsbCAwJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0WycjIyBoZWFkZXIgYWEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBjID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRcdF0sXG5cdFx0XHRhc3luYyAoZWRpdG9yLCB2aWV3TW9kZWwsIGRzKSA9PiB7XG5cdFx0XHRcdHZpZXdNb2RlbC5yZXN0b3JlRWRpdG9yVmlld1N0YXRlKHtcblx0XHRcdFx0XHRlZGl0aW5nQ2VsbHM6IEFycmF5LmZyb20oeyBsZW5ndGg6IDggfSwgKCkgPT4gZmFsc2UpLFxuXHRcdFx0XHRcdGVkaXRvclZpZXdTdGF0ZXM6IEFycmF5LmZyb20oeyBsZW5ndGg6IDggfSwgKCkgPT4gbnVsbCksXG5cdFx0XHRcdFx0Y2VsbFRvdGFsSGVpZ2h0czogQXJyYXkuZnJvbSh7IGxlbmd0aDogOCB9LCAoKSA9PiA1MCksXG5cdFx0XHRcdFx0Y2VsbExpbmVOdW1iZXJTdGF0ZXM6IHt9LFxuXHRcdFx0XHRcdGNvbGxhcHNlZElucHV0Q2VsbHM6IHt9LFxuXHRcdFx0XHRcdGNvbGxhcHNlZE91dHB1dENlbGxzOiB7fSxcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Y29uc3QgY2VsbExpc3QgPSBkcy5hZGQoY3JlYXRlTm90ZWJvb2tDZWxsTGlzdChpbnN0YW50aWF0aW9uU2VydmljZSwgZHMpKTtcblx0XHRcdFx0Y2VsbExpc3QuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cdFx0XHRcdGNlbGxMaXN0LmxheW91dCg0MDAsIDEwMCk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNjcm9sbFRvcCg1MCk7XG5cdFx0XHRcdGVkaXRvci52aXNpYmxlUmFuZ2VzID0gW3sgc3RhcnQ6IDAsIGVuZDogOCB9XTtcblxuXHRcdFx0XHRjb25zdCBvdXRsaW5lID0gZ2V0T3V0bGluZShlZGl0b3IpO1xuXHRcdFx0XHRjb25zdCBub3RlYm9va091dGxpbmVFbnRyaWVzID0gb3V0bGluZS5lbnRyaWVzO1xuXHRcdFx0XHRjb25zdCByZXN1bHRpbmdNYXAgPSBuYlN0aWNreVRlc3RIZWxwZXIoZG9tTm9kZSwgZWRpdG9yLCBjZWxsTGlzdCwgbm90ZWJvb2tPdXRsaW5lRW50cmllcywgZHMpO1xuXG5cdFx0XHRcdGF3YWl0IGFzc2VydFNuYXBzaG90KHJlc3VsdGluZ01hcCk7XG5cdFx0XHRcdG91dGxpbmUuZGlzcG9zZSgpO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rlc3Q1OiBzaG91bGQgcmVuZGVyIDAtPjIsIFx0c2Nyb2xsdG9wIGhhbGZ3YXkgdGhyb3VnaCBjZWxsIDInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WycjIGhlYWRlciBhJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMjIGhlYWRlciBhYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0WycjIyMgaGVhZGVyIGFhYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0WycjIyMjIGhlYWRlciBhYWFhJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgYicsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYyA9IDI7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsLCBkcykgPT4ge1xuXHRcdFx0XHR2aWV3TW9kZWwucmVzdG9yZUVkaXRvclZpZXdTdGF0ZSh7XG5cdFx0XHRcdFx0ZWRpdGluZ0NlbGxzOiBBcnJheS5mcm9tKHsgbGVuZ3RoOiAxMCB9LCAoKSA9PiBmYWxzZSksXG5cdFx0XHRcdFx0ZWRpdG9yVmlld1N0YXRlczogQXJyYXkuZnJvbSh7IGxlbmd0aDogMTAgfSwgKCkgPT4gbnVsbCksXG5cdFx0XHRcdFx0Y2VsbFRvdGFsSGVpZ2h0czogQXJyYXkuZnJvbSh7IGxlbmd0aDogMTAgfSwgKCkgPT4gNTApLFxuXHRcdFx0XHRcdGNlbGxMaW5lTnVtYmVyU3RhdGVzOiB7fSxcblx0XHRcdFx0XHRjb2xsYXBzZWRJbnB1dENlbGxzOiB7fSxcblx0XHRcdFx0XHRjb2xsYXBzZWRPdXRwdXRDZWxsczoge30sXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGNvbnN0IGNlbGxMaXN0ID0gZHMuYWRkKGNyZWF0ZU5vdGVib29rQ2VsbExpc3QoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRzKSk7XG5cdFx0XHRcdGNlbGxMaXN0LmF0dGFjaFZpZXdNb2RlbCh2aWV3TW9kZWwpO1xuXHRcdFx0XHRjZWxsTGlzdC5sYXlvdXQoNDAwLCAxMDApO1xuXG5cdFx0XHRcdGVkaXRvci5zZXRTY3JvbGxUb3AoMTI1KTtcblx0XHRcdFx0ZWRpdG9yLnZpc2libGVSYW5nZXMgPSBbeyBzdGFydDogMiwgZW5kOiAxMCB9XTtcblxuXHRcdFx0XHRjb25zdCBvdXRsaW5lID0gZ2V0T3V0bGluZShlZGl0b3IpO1xuXHRcdFx0XHRjb25zdCBub3RlYm9va091dGxpbmVFbnRyaWVzID0gb3V0bGluZS5lbnRyaWVzO1xuXHRcdFx0XHRjb25zdCByZXN1bHRpbmdNYXAgPSBuYlN0aWNreVRlc3RIZWxwZXIoZG9tTm9kZSwgZWRpdG9yLCBjZWxsTGlzdCwgbm90ZWJvb2tPdXRsaW5lRW50cmllcywgZHMpO1xuXG5cdFx0XHRcdGF3YWl0IGFzc2VydFNuYXBzaG90KHJlc3VsdGluZ01hcCk7XG5cdFx0XHRcdG91dGxpbmUuZGlzcG9zZSgpO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rlc3Q2OiBzaG91bGQgcmVuZGVyIDYtPjcsIFx0c2Nyb2xsdG9wIGhhbGZ3YXkgdGhyb3VnaCBjZWxsIDcnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WycjIGhlYWRlciBhJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMjIGhlYWRlciBhYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIGInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyMgaGVhZGVyIGJiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJyMjIyBoZWFkZXIgYmJiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBjID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRcdF0sXG5cdFx0XHRhc3luYyAoZWRpdG9yLCB2aWV3TW9kZWwsIGRzKSA9PiB7XG5cdFx0XHRcdHZpZXdNb2RlbC5yZXN0b3JlRWRpdG9yVmlld1N0YXRlKHtcblx0XHRcdFx0XHRlZGl0aW5nQ2VsbHM6IEFycmF5LmZyb20oeyBsZW5ndGg6IDEwIH0sICgpID0+IGZhbHNlKSxcblx0XHRcdFx0XHRlZGl0b3JWaWV3U3RhdGVzOiBBcnJheS5mcm9tKHsgbGVuZ3RoOiAxMCB9LCAoKSA9PiBudWxsKSxcblx0XHRcdFx0XHRjZWxsVG90YWxIZWlnaHRzOiBBcnJheS5mcm9tKHsgbGVuZ3RoOiAxMCB9LCAoKSA9PiA1MCksXG5cdFx0XHRcdFx0Y2VsbExpbmVOdW1iZXJTdGF0ZXM6IHt9LFxuXHRcdFx0XHRcdGNvbGxhcHNlZElucHV0Q2VsbHM6IHt9LFxuXHRcdFx0XHRcdGNvbGxhcHNlZE91dHB1dENlbGxzOiB7fSxcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Y29uc3QgY2VsbExpc3QgPSBkcy5hZGQoY3JlYXRlTm90ZWJvb2tDZWxsTGlzdChpbnN0YW50aWF0aW9uU2VydmljZSwgZHMpKTtcblx0XHRcdFx0Y2VsbExpc3QuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cdFx0XHRcdGNlbGxMaXN0LmxheW91dCg0MDAsIDEwMCk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNjcm9sbFRvcCgzNzUpO1xuXHRcdFx0XHRlZGl0b3IudmlzaWJsZVJhbmdlcyA9IFt7IHN0YXJ0OiA3LCBlbmQ6IDEwIH1dO1xuXG5cdFx0XHRcdGNvbnN0IG91dGxpbmUgPSBnZXRPdXRsaW5lKGVkaXRvcik7XG5cdFx0XHRcdGNvbnN0IG5vdGVib29rT3V0bGluZUVudHJpZXMgPSBvdXRsaW5lLmVudHJpZXM7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdGluZ01hcCA9IG5iU3RpY2t5VGVzdEhlbHBlcihkb21Ob2RlLCBlZGl0b3IsIGNlbGxMaXN0LCBub3RlYm9va091dGxpbmVFbnRyaWVzLCBkcyk7XG5cblx0XHRcdFx0YXdhaXQgYXNzZXJ0U25hcHNob3QocmVzdWx0aW5nTWFwKTtcblx0XHRcdFx0b3V0bGluZS5kaXNwb3NlKCk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgndGVzdDc6IHNob3VsZCByZW5kZXIgMC0+MSwgXHRjb2xsYXBzaW5nIGFnYWluc3QgbmV4dCBzZWN0aW9uJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSwgXHRcdC8vMFxuXHRcdFx0XHRbJyMjIGhlYWRlciBhYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSwgXHRcdC8vNTBcblx0XHRcdFx0WycjIyMgaGVhZGVyIGFhYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSwgXHQvLzEwMFxuXHRcdFx0XHRbJyMjIyMgaGVhZGVyIGFhYWEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sIFx0Ly8xNTBcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLCBcdFx0Ly8yMDBcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLCBcdFx0Ly8yNTBcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLCBcdFx0Ly8zMDBcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLCBcdFx0Ly8zNTBcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLCBcdFx0Ly80MDBcblx0XHRcdFx0WycjIyBoZWFkZXIgYmInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sIFx0XHQvLzQ1MFxuXHRcdFx0XHRbJyMjIyBoZWFkZXIgYmJiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBjID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRcdF0sXG5cdFx0XHRhc3luYyAoZWRpdG9yLCB2aWV3TW9kZWwsIGRzKSA9PiB7XG5cdFx0XHRcdHZpZXdNb2RlbC5yZXN0b3JlRWRpdG9yVmlld1N0YXRlKHtcblx0XHRcdFx0XHRlZGl0aW5nQ2VsbHM6IEFycmF5LmZyb20oeyBsZW5ndGg6IDEyIH0sICgpID0+IGZhbHNlKSxcblx0XHRcdFx0XHRlZGl0b3JWaWV3U3RhdGVzOiBBcnJheS5mcm9tKHsgbGVuZ3RoOiAxMiB9LCAoKSA9PiBudWxsKSxcblx0XHRcdFx0XHRjZWxsVG90YWxIZWlnaHRzOiBBcnJheS5mcm9tKHsgbGVuZ3RoOiAxMiB9LCAoKSA9PiA1MCksXG5cdFx0XHRcdFx0Y2VsbExpbmVOdW1iZXJTdGF0ZXM6IHt9LFxuXHRcdFx0XHRcdGNvbGxhcHNlZElucHV0Q2VsbHM6IHt9LFxuXHRcdFx0XHRcdGNvbGxhcHNlZE91dHB1dENlbGxzOiB7fSxcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Y29uc3QgY2VsbExpc3QgPSBkcy5hZGQoY3JlYXRlTm90ZWJvb2tDZWxsTGlzdChpbnN0YW50aWF0aW9uU2VydmljZSwgZHMpKTtcblx0XHRcdFx0Y2VsbExpc3QuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cdFx0XHRcdGNlbGxMaXN0LmxheW91dCg0MDAsIDEwMCk7XG5cblx0XHRcdFx0ZWRpdG9yLnNldFNjcm9sbFRvcCgzNTApO1xuXHRcdFx0XHRlZGl0b3IudmlzaWJsZVJhbmdlcyA9IFt7IHN0YXJ0OiA3LCBlbmQ6IDEyIH1dO1xuXG5cdFx0XHRcdGNvbnN0IG91dGxpbmUgPSBnZXRPdXRsaW5lKGVkaXRvcik7XG5cdFx0XHRcdGNvbnN0IG5vdGVib29rT3V0bGluZUVudHJpZXMgPSBvdXRsaW5lLmVudHJpZXM7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdGluZ01hcCA9IG5iU3RpY2t5VGVzdEhlbHBlcihkb21Ob2RlLCBlZGl0b3IsIGNlbGxMaXN0LCBub3RlYm9va091dGxpbmVFbnRyaWVzLCBkcyk7XG5cblx0XHRcdFx0YXdhaXQgYXNzZXJ0U25hcHNob3QocmVzdWx0aW5nTWFwKTtcblx0XHRcdFx0b3V0bGluZS5kaXNwb3NlKCk7XG5cdFx0XHR9KTtcblx0fSk7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
