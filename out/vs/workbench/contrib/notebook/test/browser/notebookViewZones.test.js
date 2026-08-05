import assert from "assert";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { NotebookCellsLayout } from "../../browser/view/notebookCellListView.js";
import { FoldingModel } from "../../browser/viewModel/foldingModel.js";
import { CellEditType, CellKind } from "../../common/notebookCommon.js";
import { createNotebookCellList, setupInstantiationService, withTestNotebook } from "./testNotebookEditor.js";
suite("NotebookRangeMap", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("empty", () => {
    const rangeMap = new NotebookCellsLayout();
    assert.strictEqual(rangeMap.size, 0);
    assert.strictEqual(rangeMap.count, 0);
  });
  const one = { size: 1 };
  const two = { size: 2 };
  const three = { size: 3 };
  const five = { size: 5 };
  const ten = { size: 10 };
  test("length & count", () => {
    const rangeMap = new NotebookCellsLayout();
    rangeMap.splice(0, 0, [one]);
    assert.strictEqual(rangeMap.size, 1);
    assert.strictEqual(rangeMap.count, 1);
  });
  test("length & count #2", () => {
    const rangeMap = new NotebookCellsLayout();
    rangeMap.splice(0, 0, [one, one, one, one, one]);
    assert.strictEqual(rangeMap.size, 5);
    assert.strictEqual(rangeMap.count, 5);
  });
  test("length & count #3", () => {
    const rangeMap = new NotebookCellsLayout();
    rangeMap.splice(0, 0, [five]);
    assert.strictEqual(rangeMap.size, 5);
    assert.strictEqual(rangeMap.count, 1);
  });
  test("length & count #4", () => {
    const rangeMap = new NotebookCellsLayout();
    rangeMap.splice(0, 0, [five, five, five, five, five]);
    assert.strictEqual(rangeMap.size, 25);
    assert.strictEqual(rangeMap.count, 5);
  });
  test("insert", () => {
    const rangeMap = new NotebookCellsLayout();
    rangeMap.splice(0, 0, [five, five, five, five, five]);
    assert.strictEqual(rangeMap.size, 25);
    assert.strictEqual(rangeMap.count, 5);
    rangeMap.splice(0, 0, [five, five, five, five, five]);
    assert.strictEqual(rangeMap.size, 50);
    assert.strictEqual(rangeMap.count, 10);
    rangeMap.splice(5, 0, [ten, ten]);
    assert.strictEqual(rangeMap.size, 70);
    assert.strictEqual(rangeMap.count, 12);
    rangeMap.splice(12, 0, [{ size: 200 }]);
    assert.strictEqual(rangeMap.size, 270);
    assert.strictEqual(rangeMap.count, 13);
  });
  test("delete", () => {
    const rangeMap = new NotebookCellsLayout();
    rangeMap.splice(0, 0, [
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five,
      five
    ]);
    assert.strictEqual(rangeMap.size, 100);
    assert.strictEqual(rangeMap.count, 20);
    rangeMap.splice(10, 5);
    assert.strictEqual(rangeMap.size, 75);
    assert.strictEqual(rangeMap.count, 15);
    rangeMap.splice(0, 1);
    assert.strictEqual(rangeMap.size, 70);
    assert.strictEqual(rangeMap.count, 14);
    rangeMap.splice(1, 13);
    assert.strictEqual(rangeMap.size, 5);
    assert.strictEqual(rangeMap.count, 1);
    rangeMap.splice(1, 1);
    assert.strictEqual(rangeMap.size, 5);
    assert.strictEqual(rangeMap.count, 1);
  });
  test("insert & delete", () => {
    const rangeMap = new NotebookCellsLayout();
    assert.strictEqual(rangeMap.size, 0);
    assert.strictEqual(rangeMap.count, 0);
    rangeMap.splice(0, 0, [one]);
    assert.strictEqual(rangeMap.size, 1);
    assert.strictEqual(rangeMap.count, 1);
    rangeMap.splice(0, 1);
    assert.strictEqual(rangeMap.size, 0);
    assert.strictEqual(rangeMap.count, 0);
  });
  test("insert & delete #2", () => {
    const rangeMap = new NotebookCellsLayout();
    rangeMap.splice(0, 0, [
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      one
    ]);
    rangeMap.splice(2, 6);
    assert.strictEqual(rangeMap.count, 4);
    assert.strictEqual(rangeMap.size, 4);
  });
  test("insert & delete #3", () => {
    const rangeMap = new NotebookCellsLayout();
    rangeMap.splice(0, 0, [
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      two,
      two,
      two,
      two,
      two,
      two,
      two,
      two,
      two,
      two
    ]);
    rangeMap.splice(8, 4);
    assert.strictEqual(rangeMap.count, 16);
    assert.strictEqual(rangeMap.size, 24);
  });
  test("insert & delete #4", () => {
    const rangeMap = new NotebookCellsLayout();
    rangeMap.splice(0, 0, [
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      one,
      two,
      two,
      two,
      two,
      two,
      two,
      two,
      two,
      two,
      two
    ]);
    rangeMap.splice(5, 0, [three, three, three, three, three]);
    assert.strictEqual(rangeMap.count, 25);
    assert.strictEqual(rangeMap.size, 45);
    rangeMap.splice(4, 7);
    assert.strictEqual(rangeMap.count, 18);
    assert.strictEqual(rangeMap.size, 28);
  });
  suite("indexAt, positionAt", () => {
    test("empty", () => {
      const rangeMap = new NotebookCellsLayout();
      assert.strictEqual(rangeMap.indexAt(0), 0);
      assert.strictEqual(rangeMap.indexAt(10), 0);
      assert.strictEqual(rangeMap.indexAt(-1), -1);
      assert.strictEqual(rangeMap.positionAt(0), -1);
      assert.strictEqual(rangeMap.positionAt(10), -1);
      assert.strictEqual(rangeMap.positionAt(-1), -1);
    });
    test("simple", () => {
      const rangeMap = new NotebookCellsLayout();
      rangeMap.splice(0, 0, [one]);
      assert.strictEqual(rangeMap.indexAt(0), 0);
      assert.strictEqual(rangeMap.indexAt(1), 1);
      assert.strictEqual(rangeMap.positionAt(0), 0);
      assert.strictEqual(rangeMap.positionAt(1), -1);
    });
    test("simple #2", () => {
      const rangeMap = new NotebookCellsLayout();
      rangeMap.splice(0, 0, [ten]);
      assert.strictEqual(rangeMap.indexAt(0), 0);
      assert.strictEqual(rangeMap.indexAt(5), 0);
      assert.strictEqual(rangeMap.indexAt(9), 0);
      assert.strictEqual(rangeMap.indexAt(10), 1);
      assert.strictEqual(rangeMap.positionAt(0), 0);
      assert.strictEqual(rangeMap.positionAt(1), -1);
    });
    test("insert", () => {
      const rangeMap = new NotebookCellsLayout();
      rangeMap.splice(0, 0, [one, one, one, one, one, one, one, one, one, one]);
      assert.strictEqual(rangeMap.indexAt(0), 0);
      assert.strictEqual(rangeMap.indexAt(1), 1);
      assert.strictEqual(rangeMap.indexAt(5), 5);
      assert.strictEqual(rangeMap.indexAt(9), 9);
      assert.strictEqual(rangeMap.indexAt(10), 10);
      assert.strictEqual(rangeMap.indexAt(11), 10);
      rangeMap.splice(10, 0, [one, one, one, one, one, one, one, one, one, one]);
      assert.strictEqual(rangeMap.indexAt(10), 10);
      assert.strictEqual(rangeMap.indexAt(19), 19);
      assert.strictEqual(rangeMap.indexAt(20), 20);
      assert.strictEqual(rangeMap.indexAt(21), 20);
      assert.strictEqual(rangeMap.positionAt(0), 0);
      assert.strictEqual(rangeMap.positionAt(1), 1);
      assert.strictEqual(rangeMap.positionAt(19), 19);
      assert.strictEqual(rangeMap.positionAt(20), -1);
    });
    test("delete", () => {
      const rangeMap = new NotebookCellsLayout();
      rangeMap.splice(0, 0, [one, one, one, one, one, one, one, one, one, one]);
      rangeMap.splice(2, 6);
      assert.strictEqual(rangeMap.indexAt(0), 0);
      assert.strictEqual(rangeMap.indexAt(1), 1);
      assert.strictEqual(rangeMap.indexAt(3), 3);
      assert.strictEqual(rangeMap.indexAt(4), 4);
      assert.strictEqual(rangeMap.indexAt(5), 4);
      assert.strictEqual(rangeMap.positionAt(0), 0);
      assert.strictEqual(rangeMap.positionAt(1), 1);
      assert.strictEqual(rangeMap.positionAt(3), 3);
      assert.strictEqual(rangeMap.positionAt(4), -1);
    });
    test("delete #2", () => {
      const rangeMap = new NotebookCellsLayout();
      rangeMap.splice(0, 0, [ten, ten, ten, ten, ten, ten, ten, ten, ten, ten]);
      rangeMap.splice(2, 6);
      assert.strictEqual(rangeMap.indexAt(0), 0);
      assert.strictEqual(rangeMap.indexAt(1), 0);
      assert.strictEqual(rangeMap.indexAt(30), 3);
      assert.strictEqual(rangeMap.indexAt(40), 4);
      assert.strictEqual(rangeMap.indexAt(50), 4);
      assert.strictEqual(rangeMap.positionAt(0), 0);
      assert.strictEqual(rangeMap.positionAt(1), 10);
      assert.strictEqual(rangeMap.positionAt(2), 20);
      assert.strictEqual(rangeMap.positionAt(3), 30);
      assert.strictEqual(rangeMap.positionAt(4), -1);
    });
  });
});
suite("NotebookRangeMap with top padding", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("empty", () => {
    const rangeMap = new NotebookCellsLayout(10);
    assert.strictEqual(rangeMap.size, 10);
    assert.strictEqual(rangeMap.count, 0);
  });
  const one = { size: 1 };
  const five = { size: 5 };
  const ten = { size: 10 };
  test("length & count", () => {
    const rangeMap = new NotebookCellsLayout(10);
    rangeMap.splice(0, 0, [one]);
    assert.strictEqual(rangeMap.size, 11);
    assert.strictEqual(rangeMap.count, 1);
  });
  test("length & count #2", () => {
    const rangeMap = new NotebookCellsLayout(10);
    rangeMap.splice(0, 0, [one, one, one, one, one]);
    assert.strictEqual(rangeMap.size, 15);
    assert.strictEqual(rangeMap.count, 5);
  });
  test("length & count #3", () => {
    const rangeMap = new NotebookCellsLayout(10);
    rangeMap.splice(0, 0, [five]);
    assert.strictEqual(rangeMap.size, 15);
    assert.strictEqual(rangeMap.count, 1);
  });
  test("length & count #4", () => {
    const rangeMap = new NotebookCellsLayout(10);
    rangeMap.splice(0, 0, [five, five, five, five, five]);
    assert.strictEqual(rangeMap.size, 35);
    assert.strictEqual(rangeMap.count, 5);
  });
  test("insert", () => {
    const rangeMap = new NotebookCellsLayout(10);
    rangeMap.splice(0, 0, [five, five, five, five, five]);
    assert.strictEqual(rangeMap.size, 35);
    assert.strictEqual(rangeMap.count, 5);
    rangeMap.splice(0, 0, [five, five, five, five, five]);
    assert.strictEqual(rangeMap.size, 60);
    assert.strictEqual(rangeMap.count, 10);
    rangeMap.splice(5, 0, [ten, ten]);
    assert.strictEqual(rangeMap.size, 80);
    assert.strictEqual(rangeMap.count, 12);
    rangeMap.splice(12, 0, [{ size: 200 }]);
    assert.strictEqual(rangeMap.size, 280);
    assert.strictEqual(rangeMap.count, 13);
  });
  suite("indexAt, positionAt", () => {
    test("empty", () => {
      const rangeMap = new NotebookCellsLayout(10);
      assert.strictEqual(rangeMap.indexAt(0), 0);
      assert.strictEqual(rangeMap.indexAt(10), 0);
      assert.strictEqual(rangeMap.indexAt(-1), -1);
      assert.strictEqual(rangeMap.positionAt(0), -1);
      assert.strictEqual(rangeMap.positionAt(10), -1);
      assert.strictEqual(rangeMap.positionAt(-1), -1);
    });
    test("simple", () => {
      const rangeMap = new NotebookCellsLayout(10);
      rangeMap.splice(0, 0, [one]);
      assert.strictEqual(rangeMap.indexAt(0), 0);
      assert.strictEqual(rangeMap.indexAt(1), 0);
      assert.strictEqual(rangeMap.indexAt(10), 0);
      assert.strictEqual(rangeMap.indexAt(11), 1);
      assert.strictEqual(rangeMap.positionAt(0), 10);
      assert.strictEqual(rangeMap.positionAt(1), -1);
    });
  });
});
suite("NotebookRangeMap with whitesspaces", () => {
  let testDisposables;
  let instantiationService;
  let config;
  teardown(() => {
    testDisposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  setup(() => {
    testDisposables = new DisposableStore();
    instantiationService = setupInstantiationService(testDisposables);
    config = new TestConfigurationService();
    instantiationService.stub(IConfigurationService, config);
  });
  test("simple", () => {
    const rangeMap = new NotebookCellsLayout(0);
    rangeMap.splice(0, 0, [{ size: 479 }, { size: 163 }, { size: 182 }, { size: 106 }, { size: 106 }, { size: 106 }, { size: 87 }]);
    const start = rangeMap.indexAt(650);
    const end = rangeMap.indexAfter(650 + 890 - 1);
    assert.strictEqual(start, 2);
    assert.strictEqual(end, 7);
    rangeMap.insertWhitespace("1", 0, 18);
    assert.strictEqual(rangeMap.indexAt(650), 1);
  });
  test("Whitespace CRUD", async function() {
    const twenty = { size: 20 };
    const rangeMap = new NotebookCellsLayout(0);
    rangeMap.splice(0, 0, [twenty, twenty, twenty]);
    rangeMap.insertWhitespace("0", 0, 5);
    rangeMap.insertWhitespace("1", 0, 5);
    assert.strictEqual(rangeMap.indexAt(0), 0);
    assert.strictEqual(rangeMap.indexAt(1), 0);
    assert.strictEqual(rangeMap.indexAt(10), 0);
    assert.strictEqual(rangeMap.indexAt(11), 0);
    assert.strictEqual(rangeMap.indexAt(21), 0);
    assert.strictEqual(rangeMap.indexAt(31), 1);
    assert.strictEqual(rangeMap.positionAt(0), 10);
    assert.strictEqual(rangeMap.getWhitespacePosition("0"), 0);
    assert.strictEqual(rangeMap.getWhitespacePosition("1"), 5);
    assert.strictEqual(rangeMap.positionAt(0), 10);
    assert.strictEqual(rangeMap.positionAt(1), 30);
    rangeMap.changeOneWhitespace("0", 0, 10);
    assert.strictEqual(rangeMap.getWhitespacePosition("0"), 0);
    assert.strictEqual(rangeMap.getWhitespacePosition("1"), 10);
    assert.strictEqual(rangeMap.positionAt(0), 15);
    assert.strictEqual(rangeMap.positionAt(1), 35);
    rangeMap.removeWhitespace("1");
    assert.strictEqual(rangeMap.getWhitespacePosition("0"), 0);
    assert.strictEqual(rangeMap.positionAt(0), 10);
    assert.strictEqual(rangeMap.positionAt(1), 30);
  });
  test("Whitespace with editing", async function() {
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
        disposables.add(cellList);
        cellList.attachViewModel(viewModel);
        cellList.layout(210, 100);
        assert.strictEqual(cellList.scrollHeight, 350);
        cellList.changeViewZones((accessor) => {
          const id = accessor.addZone({
            afterModelPosition: 1,
            heightInPx: 20,
            domNode: document.createElement("div")
          });
          accessor.layoutZone(id);
          assert.strictEqual(cellList.scrollHeight, 370);
          assert.strictEqual(cellList.getElementTop(0), 0);
          assert.strictEqual(cellList.getElementTop(1), 70);
          assert.strictEqual(cellList.getElementTop(2), 170);
          const textModel = editor.textModel;
          textModel.applyEdits([
            { editType: CellEditType.Replace, index: 0, count: 1, cells: [] }
          ], true, void 0, () => void 0, void 0, true);
          assert.strictEqual(cellList.getElementTop(0), 20);
          assert.strictEqual(cellList.getElementTop(1), 120);
          assert.strictEqual(cellList.getElementTop(2), 170);
          accessor.removeZone(id);
        });
      }
    );
  });
  test("Multiple Whitespaces", async function() {
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
        disposables.add(cellList);
        cellList.attachViewModel(viewModel);
        cellList.layout(210, 100);
        assert.strictEqual(cellList.scrollHeight, 350);
        cellList.changeViewZones((accessor) => {
          const first = accessor.addZone({
            afterModelPosition: 0,
            heightInPx: 20,
            domNode: document.createElement("div")
          });
          accessor.layoutZone(first);
          const second = accessor.addZone({
            afterModelPosition: 3,
            heightInPx: 20,
            domNode: document.createElement("div")
          });
          accessor.layoutZone(second);
          assert.strictEqual(cellList.scrollHeight, 390);
          assert.strictEqual(cellList.getElementTop(0), 20);
          assert.strictEqual(cellList.getElementTop(1), 70);
          assert.strictEqual(cellList.getElementTop(2), 170);
          assert.strictEqual(cellList.getElementTop(3), 240);
          accessor.removeZone(first);
          assert.strictEqual(cellList.scrollHeight, 370);
          assert.strictEqual(cellList.getElementTop(0), 0);
          assert.strictEqual(cellList.getElementTop(1), 50);
          assert.strictEqual(cellList.getElementTop(2), 150);
          assert.strictEqual(cellList.getElementTop(3), 220);
          accessor.removeZone(second);
          assert.strictEqual(cellList.scrollHeight, 350);
          assert.strictEqual(cellList.getElementTop(3), 200);
        });
      }
    );
  });
  test("Multiple Whitespaces 2", async function() {
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
        disposables.add(cellList);
        cellList.attachViewModel(viewModel);
        cellList.layout(210, 100);
        assert.strictEqual(cellList.scrollHeight, 350);
        cellList.changeViewZones((accessor) => {
          const first = accessor.addZone({
            afterModelPosition: 0,
            heightInPx: 20,
            domNode: document.createElement("div")
          });
          accessor.layoutZone(first);
          const second = accessor.addZone({
            afterModelPosition: 1,
            heightInPx: 20,
            domNode: document.createElement("div")
          });
          accessor.layoutZone(second);
          assert.strictEqual(cellList.scrollHeight, 390);
          assert.strictEqual(cellList._getView().getWhitespacePosition(first), 0);
          assert.strictEqual(cellList._getView().getWhitespacePosition(second), 70);
          accessor.removeZone(first);
          accessor.removeZone(second);
        });
      }
    );
  });
  test("Multiple Whitespaces 3", async function() {
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
        disposables.add(cellList);
        cellList.attachViewModel(viewModel);
        cellList.layout(210, 100);
        assert.strictEqual(cellList.scrollHeight, 350);
        cellList.changeViewZones((accessor) => {
          const first = accessor.addZone({
            afterModelPosition: 1,
            heightInPx: 20,
            domNode: document.createElement("div")
          });
          accessor.layoutZone(first);
          const second = accessor.addZone({
            afterModelPosition: 2,
            heightInPx: 20,
            domNode: document.createElement("div")
          });
          accessor.layoutZone(second);
          assert.strictEqual(cellList.scrollHeight, 390);
          assert.strictEqual(cellList._getView().getWhitespacePosition(first), 50);
          assert.strictEqual(cellList._getView().getWhitespacePosition(second), 170);
          accessor.removeZone(first);
          accessor.removeZone(second);
        });
      }
    );
  });
  test("Whitespace with folding support", async function() {
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
        disposables.add(cellList);
        cellList.attachViewModel(viewModel);
        cellList.layout(210, 100);
        assert.strictEqual(cellList.scrollHeight, 350);
        cellList.changeViewZones((accessor) => {
          const id = accessor.addZone({
            afterModelPosition: 0,
            heightInPx: 20,
            domNode: document.createElement("div")
          });
          accessor.layoutZone(id);
          assert.strictEqual(cellList.scrollHeight, 370);
          assert.strictEqual(cellList.getElementTop(0), 20);
          assert.strictEqual(cellList.getElementTop(1), 70);
          assert.strictEqual(cellList.getElementTop(2), 170);
          assert.strictEqual(cellList.getElementTop(3), 220);
          assert.strictEqual(cellList.getElementTop(4), 320);
          accessor.removeZone(id);
          assert.strictEqual(cellList.scrollHeight, 350);
        });
        cellList.changeViewZones((accessor) => {
          const id = accessor.addZone({
            afterModelPosition: 1,
            heightInPx: 20,
            domNode: document.createElement("div")
          });
          accessor.layoutZone(id);
          assert.strictEqual(cellList.scrollHeight, 370);
          assert.strictEqual(cellList.getElementTop(0), 0);
          assert.strictEqual(cellList.getElementTop(1), 70);
          assert.strictEqual(cellList.getElementTop(2), 170);
          assert.strictEqual(cellList.getElementTop(3), 220);
          assert.strictEqual(cellList.getElementTop(4), 320);
          accessor.removeZone(id);
          assert.strictEqual(cellList.scrollHeight, 350);
        });
        cellList.changeViewZones((accessor) => {
          const id = accessor.addZone({
            afterModelPosition: 3,
            heightInPx: 20,
            domNode: document.createElement("div")
          });
          accessor.layoutZone(id);
          assert.strictEqual(cellList.scrollHeight, 370);
          const foldingModel = disposables.add(new FoldingModel());
          foldingModel.attachViewModel(viewModel);
          foldingModel.applyMemento([{ start: 2, end: 3 }]);
          viewModel.updateFoldingRanges(foldingModel.regions);
          assert.deepStrictEqual(viewModel.getHiddenRanges(), [
            { start: 3, end: 3 }
          ]);
          cellList.setHiddenAreas(viewModel.getHiddenRanges(), true);
          assert.strictEqual(cellList.scrollHeight, 250);
          assert.strictEqual(cellList.getElementTop(0), 0);
          assert.strictEqual(cellList.getElementTop(1), 50);
          assert.strictEqual(cellList.getElementTop(2), 150);
          assert.strictEqual(cellList.getElementTop(3), 200);
          cellList.setHiddenAreas([], true);
          assert.strictEqual(cellList.scrollHeight, 370);
          accessor.removeZone(id);
          assert.strictEqual(cellList.scrollHeight, 350);
        });
        cellList.changeViewZones((accessor) => {
          const id = accessor.addZone({
            afterModelPosition: 4,
            heightInPx: 20,
            domNode: document.createElement("div")
          });
          accessor.layoutZone(id);
          assert.strictEqual(cellList.scrollHeight, 370);
          const foldingModel = disposables.add(new FoldingModel());
          foldingModel.attachViewModel(viewModel);
          foldingModel.applyMemento([{ start: 2, end: 3 }]);
          viewModel.updateFoldingRanges(foldingModel.regions);
          assert.deepStrictEqual(viewModel.getHiddenRanges(), [
            { start: 3, end: 3 }
          ]);
          cellList.setHiddenAreas(viewModel.getHiddenRanges(), true);
          assert.strictEqual(cellList.scrollHeight, 270);
          assert.strictEqual(cellList.getElementTop(0), 0);
          assert.strictEqual(cellList.getElementTop(1), 50);
          assert.strictEqual(cellList.getElementTop(2), 150);
          assert.strictEqual(cellList.getElementTop(3), 220);
          cellList.setHiddenAreas([], true);
          assert.strictEqual(cellList.scrollHeight, 370);
          accessor.removeZone(id);
          assert.strictEqual(cellList.scrollHeight, 350);
        });
        cellList.changeViewZones((accessor) => {
          const id = accessor.addZone({
            afterModelPosition: 4,
            heightInPx: 20,
            domNode: document.createElement("div")
          });
          accessor.layoutZone(id);
          assert.strictEqual(cellList.scrollHeight, 370);
          const foldingModel = disposables.add(new FoldingModel());
          foldingModel.attachViewModel(viewModel);
          foldingModel.applyMemento([{ start: 0, end: 1 }]);
          viewModel.updateFoldingRanges(foldingModel.regions);
          assert.deepStrictEqual(viewModel.getHiddenRanges(), [
            { start: 1, end: 1 }
          ]);
          cellList.setHiddenAreas(viewModel.getHiddenRanges(), true);
          assert.strictEqual(cellList.scrollHeight, 270);
          assert.strictEqual(cellList.getElementTop(0), 0);
          assert.strictEqual(cellList.getElementTop(1), 50);
          assert.strictEqual(cellList.getElementTop(2), 100);
          assert.strictEqual(cellList.getElementTop(3), 220);
          cellList.setHiddenAreas([], true);
          assert.strictEqual(cellList.scrollHeight, 370);
          accessor.removeZone(id);
          assert.strictEqual(cellList.scrollHeight, 350);
        });
      }
    );
  });
  test("Whitespace with multiple viewzones at same position", async function() {
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
        disposables.add(cellList);
        cellList.attachViewModel(viewModel);
        cellList.layout(210, 100);
        assert.strictEqual(cellList.scrollHeight, 350);
        cellList.changeViewZones((accessor) => {
          const first = accessor.addZone({
            afterModelPosition: 0,
            heightInPx: 20,
            domNode: document.createElement("div")
          });
          accessor.layoutZone(first);
          assert.strictEqual(cellList.scrollHeight, 370);
          const second = accessor.addZone({
            afterModelPosition: 0,
            heightInPx: 20,
            domNode: document.createElement("div")
          });
          accessor.layoutZone(second);
          assert.strictEqual(cellList.scrollHeight, 390);
          assert.strictEqual(cellList.getElementTop(0), 40);
          assert.strictEqual(cellList.getElementTop(1), 90);
          assert.strictEqual(cellList.getElementTop(2), 190);
          assert.strictEqual(cellList.getElementTop(3), 240);
          assert.strictEqual(cellList.getElementTop(4), 340);
          accessor.removeZone(first);
          assert.strictEqual(cellList.scrollHeight, 370);
          accessor.removeZone(second);
          assert.strictEqual(cellList.scrollHeight, 350);
        });
      }
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay90ZXN0L2Jyb3dzZXIvbm90ZWJvb2tWaWV3Wm9uZXMudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0NlbGxzTGF5b3V0IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci92aWV3L25vdGVib29rQ2VsbExpc3RWaWV3LmpzJztcbmltcG9ydCB7IEZvbGRpbmdNb2RlbCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvdmlld01vZGVsL2ZvbGRpbmdNb2RlbC5qcyc7XG5pbXBvcnQgeyBDZWxsRWRpdFR5cGUsIENlbGxLaW5kIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IGNyZWF0ZU5vdGVib29rQ2VsbExpc3QsIHNldHVwSW5zdGFudGlhdGlvblNlcnZpY2UsIHdpdGhUZXN0Tm90ZWJvb2sgfSBmcm9tICcuL3Rlc3ROb3RlYm9va0VkaXRvci5qcyc7XG5cbnN1aXRlKCdOb3RlYm9va1JhbmdlTWFwJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2VtcHR5JywgKCkgPT4ge1xuXHRcdGNvbnN0IHJhbmdlTWFwID0gbmV3IE5vdGVib29rQ2VsbHNMYXlvdXQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCAwKTtcblx0fSk7XG5cblx0Y29uc3Qgb25lID0geyBzaXplOiAxIH07XG5cdGNvbnN0IHR3byA9IHsgc2l6ZTogMiB9O1xuXHRjb25zdCB0aHJlZSA9IHsgc2l6ZTogMyB9O1xuXHRjb25zdCBmaXZlID0geyBzaXplOiA1IH07XG5cdGNvbnN0IHRlbiA9IHsgc2l6ZTogMTAgfTtcblxuXHR0ZXN0KCdsZW5ndGggJiBjb3VudCcsICgpID0+IHtcblx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBOb3RlYm9va0NlbGxzTGF5b3V0KCk7XG5cdFx0cmFuZ2VNYXAuc3BsaWNlKDAsIDAsIFtvbmVdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCAxKTtcblx0fSk7XG5cblx0dGVzdCgnbGVuZ3RoICYgY291bnQgIzInLCAoKSA9PiB7XG5cdFx0Y29uc3QgcmFuZ2VNYXAgPSBuZXcgTm90ZWJvb2tDZWxsc0xheW91dCgpO1xuXHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbb25lLCBvbmUsIG9uZSwgb25lLCBvbmVdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCA1KTtcblx0fSk7XG5cblx0dGVzdCgnbGVuZ3RoICYgY291bnQgIzMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcmFuZ2VNYXAgPSBuZXcgTm90ZWJvb2tDZWxsc0xheW91dCgpO1xuXHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbZml2ZV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5zaXplLCA1KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdsZW5ndGggJiBjb3VudCAjNCcsICgpID0+IHtcblx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBOb3RlYm9va0NlbGxzTGF5b3V0KCk7XG5cdFx0cmFuZ2VNYXAuc3BsaWNlKDAsIDAsIFtmaXZlLCBmaXZlLCBmaXZlLCBmaXZlLCBmaXZlXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDI1KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDUpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbnNlcnQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcmFuZ2VNYXAgPSBuZXcgTm90ZWJvb2tDZWxsc0xheW91dCgpO1xuXHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbZml2ZSwgZml2ZSwgZml2ZSwgZml2ZSwgZml2ZV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5zaXplLCAyNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCA1KTtcblxuXHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbZml2ZSwgZml2ZSwgZml2ZSwgZml2ZSwgZml2ZV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5zaXplLCA1MCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCAxMCk7XG5cblx0XHRyYW5nZU1hcC5zcGxpY2UoNSwgMCwgW3RlbiwgdGVuXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDcwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDEyKTtcblxuXHRcdHJhbmdlTWFwLnNwbGljZSgxMiwgMCwgW3sgc2l6ZTogMjAwIH1dKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgMjcwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDEzKTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlJywgKCkgPT4ge1xuXHRcdGNvbnN0IHJhbmdlTWFwID0gbmV3IE5vdGVib29rQ2VsbHNMYXlvdXQoKTtcblx0XHRyYW5nZU1hcC5zcGxpY2UoMCwgMCwgW2ZpdmUsIGZpdmUsIGZpdmUsIGZpdmUsIGZpdmUsXG5cdFx0XHRmaXZlLCBmaXZlLCBmaXZlLCBmaXZlLCBmaXZlLFxuXHRcdFx0Zml2ZSwgZml2ZSwgZml2ZSwgZml2ZSwgZml2ZSxcblx0XHRcdGZpdmUsIGZpdmUsIGZpdmUsIGZpdmUsIGZpdmVdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgMTAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDIwKTtcblxuXHRcdHJhbmdlTWFwLnNwbGljZSgxMCwgNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDc1KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDE1KTtcblxuXHRcdHJhbmdlTWFwLnNwbGljZSgwLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgNzApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5jb3VudCwgMTQpO1xuXG5cdFx0cmFuZ2VNYXAuc3BsaWNlKDEsIDEzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCAxKTtcblxuXHRcdHJhbmdlTWFwLnNwbGljZSgxLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCAxKTtcblx0fSk7XG5cblx0dGVzdCgnaW5zZXJ0ICYgZGVsZXRlJywgKCkgPT4ge1xuXHRcdGNvbnN0IHJhbmdlTWFwID0gbmV3IE5vdGVib29rQ2VsbHNMYXlvdXQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCAwKTtcblxuXHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbb25lXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5jb3VudCwgMSk7XG5cblx0XHRyYW5nZU1hcC5zcGxpY2UoMCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5jb3VudCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc2VydCAmIGRlbGV0ZSAjMicsICgpID0+IHtcblx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBOb3RlYm9va0NlbGxzTGF5b3V0KCk7XG5cdFx0cmFuZ2VNYXAuc3BsaWNlKDAsIDAsIFtvbmUsIG9uZSwgb25lLCBvbmUsIG9uZSxcblx0XHRcdG9uZSwgb25lLCBvbmUsIG9uZSwgb25lXSk7XG5cdFx0cmFuZ2VNYXAuc3BsaWNlKDIsIDYpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5jb3VudCwgNCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbnNlcnQgJiBkZWxldGUgIzMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcmFuZ2VNYXAgPSBuZXcgTm90ZWJvb2tDZWxsc0xheW91dCgpO1xuXHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbb25lLCBvbmUsIG9uZSwgb25lLCBvbmUsXG5cdFx0XHRvbmUsIG9uZSwgb25lLCBvbmUsIG9uZSxcblx0XHRcdHR3bywgdHdvLCB0d28sIHR3bywgdHdvLFxuXHRcdFx0dHdvLCB0d28sIHR3bywgdHdvLCB0d29dKTtcblx0XHRyYW5nZU1hcC5zcGxpY2UoOCwgNCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCAxNik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDI0KTtcblx0fSk7XG5cblx0dGVzdCgnaW5zZXJ0ICYgZGVsZXRlICM0JywgKCkgPT4ge1xuXHRcdGNvbnN0IHJhbmdlTWFwID0gbmV3IE5vdGVib29rQ2VsbHNMYXlvdXQoKTtcblx0XHRyYW5nZU1hcC5zcGxpY2UoMCwgMCwgW29uZSwgb25lLCBvbmUsIG9uZSwgb25lLFxuXHRcdFx0b25lLCBvbmUsIG9uZSwgb25lLCBvbmUsXG5cdFx0XHR0d28sIHR3bywgdHdvLCB0d28sIHR3byxcblx0XHRcdHR3bywgdHdvLCB0d28sIHR3bywgdHdvXSk7XG5cdFx0cmFuZ2VNYXAuc3BsaWNlKDUsIDAsIFt0aHJlZSwgdGhyZWUsIHRocmVlLCB0aHJlZSwgdGhyZWVdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDI1KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgNDUpO1xuXG5cdFx0cmFuZ2VNYXAuc3BsaWNlKDQsIDcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5jb3VudCwgMTgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5zaXplLCAyOCk7XG5cdH0pO1xuXG5cdHN1aXRlKCdpbmRleEF0LCBwb3NpdGlvbkF0JywgKCkgPT4ge1xuXHRcdHRlc3QoJ2VtcHR5JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmFuZ2VNYXAgPSBuZXcgTm90ZWJvb2tDZWxsc0xheW91dCgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmluZGV4QXQoMCksIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmluZGV4QXQoMTApLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KC0xKSwgLTEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoMCksIC0xKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5wb3NpdGlvbkF0KDEwKSwgLTEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoLTEpLCAtMSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaW1wbGUnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBOb3RlYm9va0NlbGxzTGF5b3V0KCk7XG5cdFx0XHRyYW5nZU1hcC5zcGxpY2UoMCwgMCwgW29uZV0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmluZGV4QXQoMCksIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmluZGV4QXQoMSksIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoMCksIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoMSksIC0xKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3NpbXBsZSAjMicsICgpID0+IHtcblx0XHRcdGNvbnN0IHJhbmdlTWFwID0gbmV3IE5vdGVib29rQ2VsbHNMYXlvdXQoKTtcblx0XHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbdGVuXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgwKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCg1KSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCg5KSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgxMCksIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoMCksIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoMSksIC0xKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2luc2VydCcsICgpID0+IHtcblx0XHRcdGNvbnN0IHJhbmdlTWFwID0gbmV3IE5vdGVib29rQ2VsbHNMYXlvdXQoKTtcblx0XHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbb25lLCBvbmUsIG9uZSwgb25lLCBvbmUsIG9uZSwgb25lLCBvbmUsIG9uZSwgb25lXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgwKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgxKSwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCg1KSwgNSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCg5KSwgOSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgxMCksIDEwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDExKSwgMTApO1xuXG5cdFx0XHRyYW5nZU1hcC5zcGxpY2UoMTAsIDAsIFtvbmUsIG9uZSwgb25lLCBvbmUsIG9uZSwgb25lLCBvbmUsIG9uZSwgb25lLCBvbmVdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDEwKSwgMTApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmluZGV4QXQoMTkpLCAxOSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgyMCksIDIwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDIxKSwgMjApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoMCksIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoMSksIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoMTkpLCAxOSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCgyMCksIC0xKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2RlbGV0ZScsICgpID0+IHtcblx0XHRcdGNvbnN0IHJhbmdlTWFwID0gbmV3IE5vdGVib29rQ2VsbHNMYXlvdXQoKTtcblx0XHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbb25lLCBvbmUsIG9uZSwgb25lLCBvbmUsIG9uZSwgb25lLCBvbmUsIG9uZSwgb25lXSk7XG5cdFx0XHRyYW5nZU1hcC5zcGxpY2UoMiwgNik7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDApLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDEpLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDMpLCAzKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDQpLCA0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDUpLCA0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5wb3NpdGlvbkF0KDApLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5wb3NpdGlvbkF0KDEpLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5wb3NpdGlvbkF0KDMpLCAzKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5wb3NpdGlvbkF0KDQpLCAtMSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdkZWxldGUgIzInLCAoKSA9PiB7XG5cdFx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBOb3RlYm9va0NlbGxzTGF5b3V0KCk7XG5cdFx0XHRyYW5nZU1hcC5zcGxpY2UoMCwgMCwgW3RlbiwgdGVuLCB0ZW4sIHRlbiwgdGVuLCB0ZW4sIHRlbiwgdGVuLCB0ZW4sIHRlbl0pO1xuXHRcdFx0cmFuZ2VNYXAuc3BsaWNlKDIsIDYpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgwKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgxKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgzMCksIDMpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmluZGV4QXQoNDApLCA0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDUwKSwgNCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCgwKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCgxKSwgMTApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoMiksIDIwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5wb3NpdGlvbkF0KDMpLCAzMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCg0KSwgLTEpO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgnTm90ZWJvb2tSYW5nZU1hcCB3aXRoIHRvcCBwYWRkaW5nJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2VtcHR5JywgKCkgPT4ge1xuXHRcdGNvbnN0IHJhbmdlTWFwID0gbmV3IE5vdGVib29rQ2VsbHNMYXlvdXQoMTApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5zaXplLCAxMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCAwKTtcblx0fSk7XG5cblx0Y29uc3Qgb25lID0geyBzaXplOiAxIH07XG5cdGNvbnN0IGZpdmUgPSB7IHNpemU6IDUgfTtcblx0Y29uc3QgdGVuID0geyBzaXplOiAxMCB9O1xuXG5cdHRlc3QoJ2xlbmd0aCAmIGNvdW50JywgKCkgPT4ge1xuXHRcdGNvbnN0IHJhbmdlTWFwID0gbmV3IE5vdGVib29rQ2VsbHNMYXlvdXQoMTApO1xuXHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbb25lXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDExKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdsZW5ndGggJiBjb3VudCAjMicsICgpID0+IHtcblx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBOb3RlYm9va0NlbGxzTGF5b3V0KDEwKTtcblx0XHRyYW5nZU1hcC5zcGxpY2UoMCwgMCwgW29uZSwgb25lLCBvbmUsIG9uZSwgb25lXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDE1KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDUpO1xuXHR9KTtcblxuXHR0ZXN0KCdsZW5ndGggJiBjb3VudCAjMycsICgpID0+IHtcblx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBOb3RlYm9va0NlbGxzTGF5b3V0KDEwKTtcblx0XHRyYW5nZU1hcC5zcGxpY2UoMCwgMCwgW2ZpdmVdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgMTUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5jb3VudCwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xlbmd0aCAmIGNvdW50ICM0JywgKCkgPT4ge1xuXHRcdGNvbnN0IHJhbmdlTWFwID0gbmV3IE5vdGVib29rQ2VsbHNMYXlvdXQoMTApO1xuXHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbZml2ZSwgZml2ZSwgZml2ZSwgZml2ZSwgZml2ZV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5zaXplLCAzNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCA1KTtcblx0fSk7XG5cblx0dGVzdCgnaW5zZXJ0JywgKCkgPT4ge1xuXHRcdGNvbnN0IHJhbmdlTWFwID0gbmV3IE5vdGVib29rQ2VsbHNMYXlvdXQoMTApO1xuXHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbZml2ZSwgZml2ZSwgZml2ZSwgZml2ZSwgZml2ZV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5zaXplLCAzNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCA1KTtcblxuXHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbZml2ZSwgZml2ZSwgZml2ZSwgZml2ZSwgZml2ZV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5zaXplLCA2MCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmNvdW50LCAxMCk7XG5cblx0XHRyYW5nZU1hcC5zcGxpY2UoNSwgMCwgW3RlbiwgdGVuXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnNpemUsIDgwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDEyKTtcblxuXHRcdHJhbmdlTWFwLnNwbGljZSgxMiwgMCwgW3sgc2l6ZTogMjAwIH1dKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuc2l6ZSwgMjgwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuY291bnQsIDEzKTtcblx0fSk7XG5cblx0c3VpdGUoJ2luZGV4QXQsIHBvc2l0aW9uQXQnLCAoKSA9PiB7XG5cdFx0dGVzdCgnZW1wdHknLCAoKSA9PiB7XG5cdFx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBOb3RlYm9va0NlbGxzTGF5b3V0KDEwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDApLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDEwKSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgtMSksIC0xKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5wb3NpdGlvbkF0KDApLCAtMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCgxMCksIC0xKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5wb3NpdGlvbkF0KC0xKSwgLTEpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2ltcGxlJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmFuZ2VNYXAgPSBuZXcgTm90ZWJvb2tDZWxsc0xheW91dCgxMCk7XG5cdFx0XHRyYW5nZU1hcC5zcGxpY2UoMCwgMCwgW29uZV0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmluZGV4QXQoMCksIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmluZGV4QXQoMSksIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmluZGV4QXQoMTApLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDExKSwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCgwKSwgMTApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoMSksIC0xKTtcblx0XHR9KTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ05vdGVib29rUmFuZ2VNYXAgd2l0aCB3aGl0ZXNzcGFjZXMnLCAoKSA9PiB7XG5cdGxldCB0ZXN0RGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdGxldCBjb25maWc6IFRlc3RDb25maWd1cmF0aW9uU2VydmljZTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0dGVzdERpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdHRlc3REaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZSA9IHNldHVwSW5zdGFudGlhdGlvblNlcnZpY2UodGVzdERpc3Bvc2FibGVzKTtcblx0XHRjb25maWcgPSBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKCk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29uZmlndXJhdGlvblNlcnZpY2UsIGNvbmZpZyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NpbXBsZScsICgpID0+IHtcblx0XHRjb25zdCByYW5nZU1hcCA9IG5ldyBOb3RlYm9va0NlbGxzTGF5b3V0KDApO1xuXHRcdHJhbmdlTWFwLnNwbGljZSgwLCAwLCBbeyBzaXplOiA0NzkgfSwgeyBzaXplOiAxNjMgfSwgeyBzaXplOiAxODIgfSwgeyBzaXplOiAxMDYgfSwgeyBzaXplOiAxMDYgfSwgeyBzaXplOiAxMDYgfSwgeyBzaXplOiA4NyB9XSk7XG5cblx0XHRjb25zdCBzdGFydCA9IHJhbmdlTWFwLmluZGV4QXQoNjUwKTtcblx0XHRjb25zdCBlbmQgPSByYW5nZU1hcC5pbmRleEFmdGVyKDY1MCArIDg5MCAtIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGFydCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVuZCwgNyk7XG5cblx0XHRyYW5nZU1hcC5pbnNlcnRXaGl0ZXNwYWNlKCcxJywgMCwgMTgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDY1MCksIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdXaGl0ZXNwYWNlIENSVUQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdHdlbnR5ID0geyBzaXplOiAyMCB9O1xuXG5cdFx0Y29uc3QgcmFuZ2VNYXAgPSBuZXcgTm90ZWJvb2tDZWxsc0xheW91dCgwKTtcblx0XHRyYW5nZU1hcC5zcGxpY2UoMCwgMCwgW3R3ZW50eSwgdHdlbnR5LCB0d2VudHldKTtcblx0XHRyYW5nZU1hcC5pbnNlcnRXaGl0ZXNwYWNlKCcwJywgMCwgNSk7XG5cdFx0cmFuZ2VNYXAuaW5zZXJ0V2hpdGVzcGFjZSgnMScsIDAsIDUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDApLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgxKSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmluZGV4QXQoMTApLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuaW5kZXhBdCgxMSksIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5pbmRleEF0KDIxKSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmluZGV4QXQoMzEpLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCgwKSwgMTApO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLmdldFdoaXRlc3BhY2VQb3NpdGlvbignMCcpLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuZ2V0V2hpdGVzcGFjZVBvc2l0aW9uKCcxJyksIDUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoMCksIDEwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCgxKSwgMzApO1xuXG5cdFx0cmFuZ2VNYXAuY2hhbmdlT25lV2hpdGVzcGFjZSgnMCcsIDAsIDEwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAuZ2V0V2hpdGVzcGFjZVBvc2l0aW9uKCcwJyksIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5nZXRXaGl0ZXNwYWNlUG9zaXRpb24oJzEnKSwgMTApO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlTWFwLnBvc2l0aW9uQXQoMCksIDE1KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCgxKSwgMzUpO1xuXG5cdFx0cmFuZ2VNYXAucmVtb3ZlV2hpdGVzcGFjZSgnMScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5nZXRXaGl0ZXNwYWNlUG9zaXRpb24oJzAnKSwgMCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2VNYXAucG9zaXRpb25BdCgwKSwgMTApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZU1hcC5wb3NpdGlvbkF0KDEpLCAzMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1doaXRlc3BhY2Ugd2l0aCBlZGl0aW5nJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIGInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBjJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsLCBkaXNwb3NhYmxlcykgPT4ge1xuXHRcdFx0XHR2aWV3TW9kZWwucmVzdG9yZUVkaXRvclZpZXdTdGF0ZSh7XG5cdFx0XHRcdFx0ZWRpdGluZ0NlbGxzOiBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXSxcblx0XHRcdFx0XHRjZWxsTGluZU51bWJlclN0YXRlczoge30sXG5cdFx0XHRcdFx0ZWRpdG9yVmlld1N0YXRlczogW251bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGxdLFxuXHRcdFx0XHRcdGNlbGxUb3RhbEhlaWdodHM6IFs1MCwgMTAwLCA1MCwgMTAwLCA1MF0sXG5cdFx0XHRcdFx0Y29sbGFwc2VkSW5wdXRDZWxsczoge30sXG5cdFx0XHRcdFx0Y29sbGFwc2VkT3V0cHV0Q2VsbHM6IHt9LFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjb25zdCBjZWxsTGlzdCA9IGNyZWF0ZU5vdGVib29rQ2VsbExpc3QoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzKTtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGNlbGxMaXN0KTtcblx0XHRcdFx0Y2VsbExpc3QuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cblx0XHRcdFx0Ly8gcmVuZGVyIGhlaWdodCAyMTAsIGl0IGNhbiByZW5kZXIgMyBmdWxsIGNlbGxzIGFuZCAxIHBhcnRpYWwgY2VsbFxuXHRcdFx0XHRjZWxsTGlzdC5sYXlvdXQoMjEwLCAxMDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsSGVpZ2h0LCAzNTApO1xuXG5cdFx0XHRcdGNlbGxMaXN0LmNoYW5nZVZpZXdab25lcyhhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgaWQgPSBhY2Nlc3Nvci5hZGRab25lKHtcblx0XHRcdFx0XHRcdGFmdGVyTW9kZWxQb3NpdGlvbjogMSxcblx0XHRcdFx0XHRcdGhlaWdodEluUHg6IDIwLFxuXHRcdFx0XHRcdFx0ZG9tTm9kZTogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jylcblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGFjY2Vzc29yLmxheW91dFpvbmUoaWQpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxIZWlnaHQsIDM3MCk7XG5cblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3QuZ2V0RWxlbWVudFRvcCgwKSwgMCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LmdldEVsZW1lbnRUb3AoMSksIDcwKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3QuZ2V0RWxlbWVudFRvcCgyKSwgMTcwKTtcblxuXHRcdFx0XHRcdGNvbnN0IHRleHRNb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cdFx0XHRcdFx0dGV4dE1vZGVsLmFwcGx5RWRpdHMoW1xuXHRcdFx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsIGluZGV4OiAwLCBjb3VudDogMSwgY2VsbHM6IFtdIH0sXG5cdFx0XHRcdFx0XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3QuZ2V0RWxlbWVudFRvcCgwKSwgMjApO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRFbGVtZW50VG9wKDEpLCAxMjApO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRFbGVtZW50VG9wKDIpLCAxNzApO1xuXG5cdFx0XHRcdFx0YWNjZXNzb3IucmVtb3ZlWm9uZShpZCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ011bHRpcGxlIFdoaXRlc3BhY2VzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIGInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBjJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsLCBkaXNwb3NhYmxlcykgPT4ge1xuXHRcdFx0XHR2aWV3TW9kZWwucmVzdG9yZUVkaXRvclZpZXdTdGF0ZSh7XG5cdFx0XHRcdFx0ZWRpdGluZ0NlbGxzOiBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXSxcblx0XHRcdFx0XHRjZWxsTGluZU51bWJlclN0YXRlczoge30sXG5cdFx0XHRcdFx0ZWRpdG9yVmlld1N0YXRlczogW251bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGxdLFxuXHRcdFx0XHRcdGNlbGxUb3RhbEhlaWdodHM6IFs1MCwgMTAwLCA1MCwgMTAwLCA1MF0sXG5cdFx0XHRcdFx0Y29sbGFwc2VkSW5wdXRDZWxsczoge30sXG5cdFx0XHRcdFx0Y29sbGFwc2VkT3V0cHV0Q2VsbHM6IHt9LFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjb25zdCBjZWxsTGlzdCA9IGNyZWF0ZU5vdGVib29rQ2VsbExpc3QoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzKTtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGNlbGxMaXN0KTtcblx0XHRcdFx0Y2VsbExpc3QuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cblx0XHRcdFx0Ly8gcmVuZGVyIGhlaWdodCAyMTAsIGl0IGNhbiByZW5kZXIgMyBmdWxsIGNlbGxzIGFuZCAxIHBhcnRpYWwgY2VsbFxuXHRcdFx0XHRjZWxsTGlzdC5sYXlvdXQoMjEwLCAxMDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsSGVpZ2h0LCAzNTApO1xuXG5cdFx0XHRcdGNlbGxMaXN0LmNoYW5nZVZpZXdab25lcyhhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgZmlyc3QgPSBhY2Nlc3Nvci5hZGRab25lKHtcblx0XHRcdFx0XHRcdGFmdGVyTW9kZWxQb3NpdGlvbjogMCxcblx0XHRcdFx0XHRcdGhlaWdodEluUHg6IDIwLFxuXHRcdFx0XHRcdFx0ZG9tTm9kZTogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jylcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRhY2Nlc3Nvci5sYXlvdXRab25lKGZpcnN0KTtcblxuXHRcdFx0XHRcdGNvbnN0IHNlY29uZCA9IGFjY2Vzc29yLmFkZFpvbmUoe1xuXHRcdFx0XHRcdFx0YWZ0ZXJNb2RlbFBvc2l0aW9uOiAzLFxuXHRcdFx0XHRcdFx0aGVpZ2h0SW5QeDogMjAsXG5cdFx0XHRcdFx0XHRkb21Ob2RlOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGFjY2Vzc29yLmxheW91dFpvbmUoc2Vjb25kKTtcblxuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxIZWlnaHQsIDM5MCk7XG5cblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3QuZ2V0RWxlbWVudFRvcCgwKSwgMjApO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRFbGVtZW50VG9wKDEpLCA3MCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LmdldEVsZW1lbnRUb3AoMiksIDE3MCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LmdldEVsZW1lbnRUb3AoMyksIDI0MCk7XG5cblx0XHRcdFx0XHRhY2Nlc3Nvci5yZW1vdmVab25lKGZpcnN0KTtcblxuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxIZWlnaHQsIDM3MCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LmdldEVsZW1lbnRUb3AoMCksIDApO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRFbGVtZW50VG9wKDEpLCA1MCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LmdldEVsZW1lbnRUb3AoMiksIDE1MCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LmdldEVsZW1lbnRUb3AoMyksIDIyMCk7XG5cblx0XHRcdFx0XHRhY2Nlc3Nvci5yZW1vdmVab25lKHNlY29uZCk7XG5cblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsSGVpZ2h0LCAzNTApO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRFbGVtZW50VG9wKDMpLCAyMDApO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdNdWx0aXBsZSBXaGl0ZXNwYWNlcyAyJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIGInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBjJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsLCBkaXNwb3NhYmxlcykgPT4ge1xuXHRcdFx0XHR2aWV3TW9kZWwucmVzdG9yZUVkaXRvclZpZXdTdGF0ZSh7XG5cdFx0XHRcdFx0ZWRpdGluZ0NlbGxzOiBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXSxcblx0XHRcdFx0XHRjZWxsTGluZU51bWJlclN0YXRlczoge30sXG5cdFx0XHRcdFx0ZWRpdG9yVmlld1N0YXRlczogW251bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGxdLFxuXHRcdFx0XHRcdGNlbGxUb3RhbEhlaWdodHM6IFs1MCwgMTAwLCA1MCwgMTAwLCA1MF0sXG5cdFx0XHRcdFx0Y29sbGFwc2VkSW5wdXRDZWxsczoge30sXG5cdFx0XHRcdFx0Y29sbGFwc2VkT3V0cHV0Q2VsbHM6IHt9LFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjb25zdCBjZWxsTGlzdCA9IGNyZWF0ZU5vdGVib29rQ2VsbExpc3QoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzKTtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGNlbGxMaXN0KTtcblx0XHRcdFx0Y2VsbExpc3QuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cblx0XHRcdFx0Ly8gcmVuZGVyIGhlaWdodCAyMTAsIGl0IGNhbiByZW5kZXIgMyBmdWxsIGNlbGxzIGFuZCAxIHBhcnRpYWwgY2VsbFxuXHRcdFx0XHRjZWxsTGlzdC5sYXlvdXQoMjEwLCAxMDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsSGVpZ2h0LCAzNTApO1xuXG5cdFx0XHRcdGNlbGxMaXN0LmNoYW5nZVZpZXdab25lcyhhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgZmlyc3QgPSBhY2Nlc3Nvci5hZGRab25lKHtcblx0XHRcdFx0XHRcdGFmdGVyTW9kZWxQb3NpdGlvbjogMCxcblx0XHRcdFx0XHRcdGhlaWdodEluUHg6IDIwLFxuXHRcdFx0XHRcdFx0ZG9tTm9kZTogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jylcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRhY2Nlc3Nvci5sYXlvdXRab25lKGZpcnN0KTtcblxuXHRcdFx0XHRcdGNvbnN0IHNlY29uZCA9IGFjY2Vzc29yLmFkZFpvbmUoe1xuXHRcdFx0XHRcdFx0YWZ0ZXJNb2RlbFBvc2l0aW9uOiAxLFxuXHRcdFx0XHRcdFx0aGVpZ2h0SW5QeDogMjAsXG5cdFx0XHRcdFx0XHRkb21Ob2RlOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGFjY2Vzc29yLmxheW91dFpvbmUoc2Vjb25kKTtcblxuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxIZWlnaHQsIDM5MCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0Ll9nZXRWaWV3KCkuZ2V0V2hpdGVzcGFjZVBvc2l0aW9uKGZpcnN0KSwgMCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0Ll9nZXRWaWV3KCkuZ2V0V2hpdGVzcGFjZVBvc2l0aW9uKHNlY29uZCksIDcwKTtcblxuXHRcdFx0XHRcdGFjY2Vzc29yLnJlbW92ZVpvbmUoZmlyc3QpO1xuXHRcdFx0XHRcdGFjY2Vzc29yLnJlbW92ZVpvbmUoc2Vjb25kKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnTXVsdGlwbGUgV2hpdGVzcGFjZXMgMycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgYycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdGFzeW5jIChlZGl0b3IsIHZpZXdNb2RlbCwgZGlzcG9zYWJsZXMpID0+IHtcblx0XHRcdFx0dmlld01vZGVsLnJlc3RvcmVFZGl0b3JWaWV3U3RhdGUoe1xuXHRcdFx0XHRcdGVkaXRpbmdDZWxsczogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV0sXG5cdFx0XHRcdFx0Y2VsbExpbmVOdW1iZXJTdGF0ZXM6IHt9LFxuXHRcdFx0XHRcdGVkaXRvclZpZXdTdGF0ZXM6IFtudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsXSxcblx0XHRcdFx0XHRjZWxsVG90YWxIZWlnaHRzOiBbNTAsIDEwMCwgNTAsIDEwMCwgNTBdLFxuXHRcdFx0XHRcdGNvbGxhcHNlZElucHV0Q2VsbHM6IHt9LFxuXHRcdFx0XHRcdGNvbGxhcHNlZE91dHB1dENlbGxzOiB7fSxcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Y29uc3QgY2VsbExpc3QgPSBjcmVhdGVOb3RlYm9va0NlbGxMaXN0KGluc3RhbnRpYXRpb25TZXJ2aWNlLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChjZWxsTGlzdCk7XG5cdFx0XHRcdGNlbGxMaXN0LmF0dGFjaFZpZXdNb2RlbCh2aWV3TW9kZWwpO1xuXG5cdFx0XHRcdC8vIHJlbmRlciBoZWlnaHQgMjEwLCBpdCBjYW4gcmVuZGVyIDMgZnVsbCBjZWxscyBhbmQgMSBwYXJ0aWFsIGNlbGxcblx0XHRcdFx0Y2VsbExpc3QubGF5b3V0KDIxMCwgMTAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbEhlaWdodCwgMzUwKTtcblxuXHRcdFx0XHRjZWxsTGlzdC5jaGFuZ2VWaWV3Wm9uZXMoYWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGZpcnN0ID0gYWNjZXNzb3IuYWRkWm9uZSh7XG5cdFx0XHRcdFx0XHRhZnRlck1vZGVsUG9zaXRpb246IDEsXG5cdFx0XHRcdFx0XHRoZWlnaHRJblB4OiAyMCxcblx0XHRcdFx0XHRcdGRvbU5vZGU6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0YWNjZXNzb3IubGF5b3V0Wm9uZShmaXJzdCk7XG5cblx0XHRcdFx0XHRjb25zdCBzZWNvbmQgPSBhY2Nlc3Nvci5hZGRab25lKHtcblx0XHRcdFx0XHRcdGFmdGVyTW9kZWxQb3NpdGlvbjogMixcblx0XHRcdFx0XHRcdGhlaWdodEluUHg6IDIwLFxuXHRcdFx0XHRcdFx0ZG9tTm9kZTogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jylcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRhY2Nlc3Nvci5sYXlvdXRab25lKHNlY29uZCk7XG5cblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsSGVpZ2h0LCAzOTApO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5fZ2V0VmlldygpLmdldFdoaXRlc3BhY2VQb3NpdGlvbihmaXJzdCksIDUwKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3QuX2dldFZpZXcoKS5nZXRXaGl0ZXNwYWNlUG9zaXRpb24oc2Vjb25kKSwgMTcwKTtcblxuXHRcdFx0XHRcdGFjY2Vzc29yLnJlbW92ZVpvbmUoZmlyc3QpO1xuXHRcdFx0XHRcdGFjY2Vzc29yLnJlbW92ZVpvbmUoc2Vjb25kKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0Ly8gdGVzdCgnTXVsdGlwbGUgV2hpdGVzcGFjZXMgNCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0Ly8gXHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHQvLyBcdFx0W1xuXHQvLyBcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdC8vIFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0Ly8gXHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHQvLyBcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdC8vIFx0XHRcdFsnIyBoZWFkZXIgYycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XVxuXHQvLyBcdFx0XSxcblx0Ly8gXHRcdGFzeW5jIChlZGl0b3IsIHZpZXdNb2RlbCwgZGlzcG9zYWJsZXMpID0+IHtcblx0Ly8gXHRcdFx0dmlld01vZGVsLnJlc3RvcmVFZGl0b3JWaWV3U3RhdGUoe1xuXHQvLyBcdFx0XHRcdGVkaXRpbmdDZWxsczogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV0sXG5cdC8vIFx0XHRcdFx0Y2VsbExpbmVOdW1iZXJTdGF0ZXM6IHt9LFxuXHQvLyBcdFx0XHRcdGVkaXRvclZpZXdTdGF0ZXM6IFtudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsXSxcblx0Ly8gXHRcdFx0XHRjZWxsVG90YWxIZWlnaHRzOiBbNTAsIDEwMCwgNTAsIDEwMCwgNTBdLFxuXHQvLyBcdFx0XHRcdGNvbGxhcHNlZElucHV0Q2VsbHM6IHt9LFxuXHQvLyBcdFx0XHRcdGNvbGxhcHNlZE91dHB1dENlbGxzOiB7fSxcblx0Ly8gXHRcdFx0fSk7XG5cblx0Ly8gXHRcdFx0Y29uc3QgY2VsbExpc3QgPSBjcmVhdGVOb3RlYm9va0NlbGxMaXN0KGluc3RhbnRpYXRpb25TZXJ2aWNlLCBkaXNwb3NhYmxlcyk7XG5cdC8vIFx0XHRcdGRpc3Bvc2FibGVzLmFkZChjZWxsTGlzdCk7XG5cdC8vIFx0XHRcdGNlbGxMaXN0LmF0dGFjaFZpZXdNb2RlbCh2aWV3TW9kZWwpO1xuXG5cdC8vIFx0XHRcdC8vIHJlbmRlciBoZWlnaHQgMjEwLCBpdCBjYW4gcmVuZGVyIDMgZnVsbCBjZWxscyBhbmQgMSBwYXJ0aWFsIGNlbGxcblx0Ly8gXHRcdFx0Y2VsbExpc3QubGF5b3V0KDIxMCwgMTAwKTtcblx0Ly8gXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbEhlaWdodCwgMzUwKTtcblxuXHQvLyBcdFx0XHRjZWxsTGlzdC5jaGFuZ2VWaWV3Wm9uZXMoYWNjZXNzb3IgPT4ge1xuXHQvLyBcdFx0XHRcdGNvbnN0IGZpcnN0ID0gYWNjZXNzb3IuYWRkWm9uZSh7XG5cdC8vIFx0XHRcdFx0XHRhZnRlck1vZGVsUG9zaXRpb246IDEsXG5cdC8vIFx0XHRcdFx0XHRoZWlnaHRJblB4OiAyMCxcblx0Ly8gXHRcdFx0XHRcdGRvbU5vZGU6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpXG5cdC8vIFx0XHRcdFx0fSk7XG5cdC8vIFx0XHRcdFx0YWNjZXNzb3IubGF5b3V0Wm9uZShmaXJzdCk7XG5cblx0Ly8gXHRcdFx0XHRjb25zdCBzZWNvbmQgPSBhY2Nlc3Nvci5hZGRab25lKHtcblx0Ly8gXHRcdFx0XHRcdGFmdGVyTW9kZWxQb3NpdGlvbjogMSxcblx0Ly8gXHRcdFx0XHRcdGhlaWdodEluUHg6IDIwLFxuXHQvLyBcdFx0XHRcdFx0ZG9tTm9kZTogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jylcblx0Ly8gXHRcdFx0XHR9KTtcblx0Ly8gXHRcdFx0XHRhY2Nlc3Nvci5sYXlvdXRab25lKHNlY29uZCk7XG5cblx0Ly8gXHRcdFx0XHRjb25zdCB0aGlyZCA9IGFjY2Vzc29yLmFkZFpvbmUoe1xuXHQvLyBcdFx0XHRcdFx0YWZ0ZXJNb2RlbFBvc2l0aW9uOiAyLFxuXHQvLyBcdFx0XHRcdFx0aGVpZ2h0SW5QeDogMjAsXG5cdC8vIFx0XHRcdFx0XHRkb21Ob2RlOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxuXHQvLyBcdFx0XHRcdH0pO1xuXHQvLyBcdFx0XHRcdGFjY2Vzc29yLmxheW91dFpvbmUoc2Vjb25kKTtcblxuXHQvLyBcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxIZWlnaHQsIDQxMCk7XG5cdC8vIFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0Ll9nZXRWaWV3KCkuZ2V0V2hpdGVzcGFjZVBvc2l0aW9uKGZpcnN0KSwgNTApO1xuXHQvLyBcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5fZ2V0VmlldygpLmdldFdoaXRlc3BhY2VQb3NpdGlvbihzZWNvbmQpLCA3MCk7XG5cdC8vIFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0Ll9nZXRWaWV3KCkuZ2V0V2hpdGVzcGFjZVBvc2l0aW9uKHRoaXJkKSwgMTkwKTtcblxuXHQvLyBcdFx0XHRcdGFjY2Vzc29yLnJlbW92ZVpvbmUoZmlyc3QpO1xuXHQvLyBcdFx0XHRcdGFjY2Vzc29yLnJlbW92ZVpvbmUoc2Vjb25kKTtcblx0Ly8gXHRcdFx0XHRhY2Nlc3Nvci5yZW1vdmVab25lKHRoaXJkKTtcblx0Ly8gXHRcdFx0fSk7XG5cdC8vIFx0XHR9KTtcblx0Ly8gfSk7XG5cblx0dGVzdCgnV2hpdGVzcGFjZSB3aXRoIGZvbGRpbmcgc3VwcG9ydCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJyMgaGVhZGVyIGEnLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBiJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsnIyBoZWFkZXIgYycsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdGFzeW5jIChlZGl0b3IsIHZpZXdNb2RlbCwgZGlzcG9zYWJsZXMpID0+IHtcblx0XHRcdFx0dmlld01vZGVsLnJlc3RvcmVFZGl0b3JWaWV3U3RhdGUoe1xuXHRcdFx0XHRcdGVkaXRpbmdDZWxsczogW2ZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV0sXG5cdFx0XHRcdFx0Y2VsbExpbmVOdW1iZXJTdGF0ZXM6IHt9LFxuXHRcdFx0XHRcdGVkaXRvclZpZXdTdGF0ZXM6IFtudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsXSxcblx0XHRcdFx0XHRjZWxsVG90YWxIZWlnaHRzOiBbNTAsIDEwMCwgNTAsIDEwMCwgNTBdLFxuXHRcdFx0XHRcdGNvbGxhcHNlZElucHV0Q2VsbHM6IHt9LFxuXHRcdFx0XHRcdGNvbGxhcHNlZE91dHB1dENlbGxzOiB7fSxcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Y29uc3QgY2VsbExpc3QgPSBjcmVhdGVOb3RlYm9va0NlbGxMaXN0KGluc3RhbnRpYXRpb25TZXJ2aWNlLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChjZWxsTGlzdCk7XG5cdFx0XHRcdGNlbGxMaXN0LmF0dGFjaFZpZXdNb2RlbCh2aWV3TW9kZWwpO1xuXG5cdFx0XHRcdC8vIHJlbmRlciBoZWlnaHQgMjEwLCBpdCBjYW4gcmVuZGVyIDMgZnVsbCBjZWxscyBhbmQgMSBwYXJ0aWFsIGNlbGxcblx0XHRcdFx0Y2VsbExpc3QubGF5b3V0KDIxMCwgMTAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbEhlaWdodCwgMzUwKTtcblxuXHRcdFx0XHRjZWxsTGlzdC5jaGFuZ2VWaWV3Wm9uZXMoYWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGlkID0gYWNjZXNzb3IuYWRkWm9uZSh7XG5cdFx0XHRcdFx0XHRhZnRlck1vZGVsUG9zaXRpb246IDAsXG5cdFx0XHRcdFx0XHRoZWlnaHRJblB4OiAyMCxcblx0XHRcdFx0XHRcdGRvbU5vZGU6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpXG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRhY2Nlc3Nvci5sYXlvdXRab25lKGlkKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsSGVpZ2h0LCAzNzApO1xuXG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LmdldEVsZW1lbnRUb3AoMCksIDIwKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3QuZ2V0RWxlbWVudFRvcCgxKSwgNzApO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRFbGVtZW50VG9wKDIpLCAxNzApO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRFbGVtZW50VG9wKDMpLCAyMjApO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRFbGVtZW50VG9wKDQpLCAzMjApO1xuXG5cdFx0XHRcdFx0YWNjZXNzb3IucmVtb3ZlWm9uZShpZCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbEhlaWdodCwgMzUwKTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Y2VsbExpc3QuY2hhbmdlVmlld1pvbmVzKGFjY2Vzc29yID0+IHtcblx0XHRcdFx0XHRjb25zdCBpZCA9IGFjY2Vzc29yLmFkZFpvbmUoe1xuXHRcdFx0XHRcdFx0YWZ0ZXJNb2RlbFBvc2l0aW9uOiAxLFxuXHRcdFx0XHRcdFx0aGVpZ2h0SW5QeDogMjAsXG5cdFx0XHRcdFx0XHRkb21Ob2RlOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0YWNjZXNzb3IubGF5b3V0Wm9uZShpZCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbEhlaWdodCwgMzcwKTtcblxuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRFbGVtZW50VG9wKDApLCAwKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3QuZ2V0RWxlbWVudFRvcCgxKSwgNzApO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRFbGVtZW50VG9wKDIpLCAxNzApO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRFbGVtZW50VG9wKDMpLCAyMjApO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRFbGVtZW50VG9wKDQpLCAzMjApO1xuXG5cdFx0XHRcdFx0YWNjZXNzb3IucmVtb3ZlWm9uZShpZCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbEhlaWdodCwgMzUwKTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Ly8gV2hpdGVzcGFjZSBzaG91bGQgYmUgaGlkZGVuIGlmIGl0J3MgYWZ0ZXIgdGhlIGhlYWRlciBpbiBhIGZvbGRpbmcgcmVnaW9uXG5cdFx0XHRcdGNlbGxMaXN0LmNoYW5nZVZpZXdab25lcyhhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgaWQgPSBhY2Nlc3Nvci5hZGRab25lKHtcblx0XHRcdFx0XHRcdGFmdGVyTW9kZWxQb3NpdGlvbjogMyxcblx0XHRcdFx0XHRcdGhlaWdodEluUHg6IDIwLFxuXHRcdFx0XHRcdFx0ZG9tTm9kZTogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jylcblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGFjY2Vzc29yLmxheW91dFpvbmUoaWQpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxIZWlnaHQsIDM3MCk7XG5cblx0XHRcdFx0XHRjb25zdCBmb2xkaW5nTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZvbGRpbmdNb2RlbCgpKTtcblx0XHRcdFx0XHRmb2xkaW5nTW9kZWwuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cdFx0XHRcdFx0Zm9sZGluZ01vZGVsLmFwcGx5TWVtZW50byhbeyBzdGFydDogMiwgZW5kOiAzIH1dKTtcblx0XHRcdFx0XHR2aWV3TW9kZWwudXBkYXRlRm9sZGluZ1Jhbmdlcyhmb2xkaW5nTW9kZWwucmVnaW9ucyk7XG5cdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0SGlkZGVuUmFuZ2VzKCksIFtcblx0XHRcdFx0XHRcdHsgc3RhcnQ6IDMsIGVuZDogMyB9XG5cdFx0XHRcdFx0XSk7XG5cdFx0XHRcdFx0Y2VsbExpc3Quc2V0SGlkZGVuQXJlYXModmlld01vZGVsLmdldEhpZGRlblJhbmdlcygpLCB0cnVlKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsSGVpZ2h0LCAyNTApO1xuXG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LmdldEVsZW1lbnRUb3AoMCksIDApO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRFbGVtZW50VG9wKDEpLCA1MCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LmdldEVsZW1lbnRUb3AoMiksIDE1MCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LmdldEVsZW1lbnRUb3AoMyksIDIwMCk7XG5cblx0XHRcdFx0XHRjZWxsTGlzdC5zZXRIaWRkZW5BcmVhcyhbXSwgdHJ1ZSk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbEhlaWdodCwgMzcwKTtcblx0XHRcdFx0XHRhY2Nlc3Nvci5yZW1vdmVab25lKGlkKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsSGVpZ2h0LCAzNTApO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHQvLyBXaGl0ZXNwYWNlIHNob3VsZCBub3QgYmUgaGlkZGVuIGlmIGl0J3MgYWZ0ZXIgdGhlIGxhc3QgY2VsbCBpbiBhIGZvbGRpbmcgcmVnaW9uXG5cdFx0XHRcdGNlbGxMaXN0LmNoYW5nZVZpZXdab25lcyhhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgaWQgPSBhY2Nlc3Nvci5hZGRab25lKHtcblx0XHRcdFx0XHRcdGFmdGVyTW9kZWxQb3NpdGlvbjogNCxcblx0XHRcdFx0XHRcdGhlaWdodEluUHg6IDIwLFxuXHRcdFx0XHRcdFx0ZG9tTm9kZTogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jylcblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGFjY2Vzc29yLmxheW91dFpvbmUoaWQpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxIZWlnaHQsIDM3MCk7XG5cblx0XHRcdFx0XHRjb25zdCBmb2xkaW5nTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZvbGRpbmdNb2RlbCgpKTtcblx0XHRcdFx0XHRmb2xkaW5nTW9kZWwuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cdFx0XHRcdFx0Zm9sZGluZ01vZGVsLmFwcGx5TWVtZW50byhbeyBzdGFydDogMiwgZW5kOiAzIH1dKTtcblx0XHRcdFx0XHR2aWV3TW9kZWwudXBkYXRlRm9sZGluZ1Jhbmdlcyhmb2xkaW5nTW9kZWwucmVnaW9ucyk7XG5cdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3TW9kZWwuZ2V0SGlkZGVuUmFuZ2VzKCksIFtcblx0XHRcdFx0XHRcdHsgc3RhcnQ6IDMsIGVuZDogMyB9XG5cdFx0XHRcdFx0XSk7XG5cdFx0XHRcdFx0Y2VsbExpc3Quc2V0SGlkZGVuQXJlYXModmlld01vZGVsLmdldEhpZGRlblJhbmdlcygpLCB0cnVlKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsSGVpZ2h0LCAyNzApO1xuXG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LmdldEVsZW1lbnRUb3AoMCksIDApO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRFbGVtZW50VG9wKDEpLCA1MCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LmdldEVsZW1lbnRUb3AoMiksIDE1MCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LmdldEVsZW1lbnRUb3AoMyksIDIyMCk7XG5cblx0XHRcdFx0XHRjZWxsTGlzdC5zZXRIaWRkZW5BcmVhcyhbXSwgdHJ1ZSk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbEhlaWdodCwgMzcwKTtcblx0XHRcdFx0XHRhY2Nlc3Nvci5yZW1vdmVab25lKGlkKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsSGVpZ2h0LCAzNTApO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHQvLyBXaGl0ZXNwYWNlIG1vdmUgd2hlbiBwcmV2aW91cyBmb2xkaW5nIHJlZ2lvbnMgZm9sZFxuXHRcdFx0XHRjZWxsTGlzdC5jaGFuZ2VWaWV3Wm9uZXMoYWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGlkID0gYWNjZXNzb3IuYWRkWm9uZSh7XG5cdFx0XHRcdFx0XHRhZnRlck1vZGVsUG9zaXRpb246IDQsXG5cdFx0XHRcdFx0XHRoZWlnaHRJblB4OiAyMCxcblx0XHRcdFx0XHRcdGRvbU5vZGU6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpXG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRhY2Nlc3Nvci5sYXlvdXRab25lKGlkKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsSGVpZ2h0LCAzNzApO1xuXG5cdFx0XHRcdFx0Y29uc3QgZm9sZGluZ01vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGb2xkaW5nTW9kZWwoKSk7XG5cdFx0XHRcdFx0Zm9sZGluZ01vZGVsLmF0dGFjaFZpZXdNb2RlbCh2aWV3TW9kZWwpO1xuXHRcdFx0XHRcdGZvbGRpbmdNb2RlbC5hcHBseU1lbWVudG8oW3sgc3RhcnQ6IDAsIGVuZDogMSB9XSk7XG5cdFx0XHRcdFx0dmlld01vZGVsLnVwZGF0ZUZvbGRpbmdSYW5nZXMoZm9sZGluZ01vZGVsLnJlZ2lvbnMpO1xuXHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld01vZGVsLmdldEhpZGRlblJhbmdlcygpLCBbXG5cdFx0XHRcdFx0XHR7IHN0YXJ0OiAxLCBlbmQ6IDEgfVxuXHRcdFx0XHRcdF0pO1xuXHRcdFx0XHRcdGNlbGxMaXN0LnNldEhpZGRlbkFyZWFzKHZpZXdNb2RlbC5nZXRIaWRkZW5SYW5nZXMoKSwgdHJ1ZSk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbEhlaWdodCwgMjcwKTtcblxuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRFbGVtZW50VG9wKDApLCAwKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3QuZ2V0RWxlbWVudFRvcCgxKSwgNTApO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRFbGVtZW50VG9wKDIpLCAxMDApO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRFbGVtZW50VG9wKDMpLCAyMjApO1xuXG5cdFx0XHRcdFx0Y2VsbExpc3Quc2V0SGlkZGVuQXJlYXMoW10sIHRydWUpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxIZWlnaHQsIDM3MCk7XG5cdFx0XHRcdFx0YWNjZXNzb3IucmVtb3ZlWm9uZShpZCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbEhlaWdodCwgMzUwKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnV2hpdGVzcGFjZSB3aXRoIG11bHRpcGxlIHZpZXd6b25lcyBhdCBzYW1lIHBvc2l0aW9uJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJyMgaGVhZGVyIGInLCAnbWFya2Rvd24nLCBDZWxsS2luZC5NYXJrdXAsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0WycjIGhlYWRlciBjJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0YXN5bmMgKGVkaXRvciwgdmlld01vZGVsLCBkaXNwb3NhYmxlcykgPT4ge1xuXHRcdFx0XHR2aWV3TW9kZWwucmVzdG9yZUVkaXRvclZpZXdTdGF0ZSh7XG5cdFx0XHRcdFx0ZWRpdGluZ0NlbGxzOiBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlXSxcblx0XHRcdFx0XHRjZWxsTGluZU51bWJlclN0YXRlczoge30sXG5cdFx0XHRcdFx0ZWRpdG9yVmlld1N0YXRlczogW251bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGxdLFxuXHRcdFx0XHRcdGNlbGxUb3RhbEhlaWdodHM6IFs1MCwgMTAwLCA1MCwgMTAwLCA1MF0sXG5cdFx0XHRcdFx0Y29sbGFwc2VkSW5wdXRDZWxsczoge30sXG5cdFx0XHRcdFx0Y29sbGFwc2VkT3V0cHV0Q2VsbHM6IHt9LFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjb25zdCBjZWxsTGlzdCA9IGNyZWF0ZU5vdGVib29rQ2VsbExpc3QoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzKTtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGNlbGxMaXN0KTtcblx0XHRcdFx0Y2VsbExpc3QuYXR0YWNoVmlld01vZGVsKHZpZXdNb2RlbCk7XG5cblx0XHRcdFx0Ly8gcmVuZGVyIGhlaWdodCAyMTAsIGl0IGNhbiByZW5kZXIgMyBmdWxsIGNlbGxzIGFuZCAxIHBhcnRpYWwgY2VsbFxuXHRcdFx0XHRjZWxsTGlzdC5sYXlvdXQoMjEwLCAxMDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3Quc2Nyb2xsSGVpZ2h0LCAzNTApO1xuXG5cdFx0XHRcdGNlbGxMaXN0LmNoYW5nZVZpZXdab25lcyhhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgZmlyc3QgPSBhY2Nlc3Nvci5hZGRab25lKHtcblx0XHRcdFx0XHRcdGFmdGVyTW9kZWxQb3NpdGlvbjogMCxcblx0XHRcdFx0XHRcdGhlaWdodEluUHg6IDIwLFxuXHRcdFx0XHRcdFx0ZG9tTm9kZTogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jylcblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGFjY2Vzc29yLmxheW91dFpvbmUoZmlyc3QpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5zY3JvbGxIZWlnaHQsIDM3MCk7XG5cblx0XHRcdFx0XHRjb25zdCBzZWNvbmQgPSBhY2Nlc3Nvci5hZGRab25lKHtcblx0XHRcdFx0XHRcdGFmdGVyTW9kZWxQb3NpdGlvbjogMCxcblx0XHRcdFx0XHRcdGhlaWdodEluUHg6IDIwLFxuXHRcdFx0XHRcdFx0ZG9tTm9kZTogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jylcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRhY2Nlc3Nvci5sYXlvdXRab25lKHNlY29uZCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbEhlaWdodCwgMzkwKTtcblxuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsTGlzdC5nZXRFbGVtZW50VG9wKDApLCA0MCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LmdldEVsZW1lbnRUb3AoMSksIDkwKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3QuZ2V0RWxlbWVudFRvcCgyKSwgMTkwKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3QuZ2V0RWxlbWVudFRvcCgzKSwgMjQwKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2VsbExpc3QuZ2V0RWxlbWVudFRvcCg0KSwgMzQwKTtcblxuXG5cdFx0XHRcdFx0YWNjZXNzb3IucmVtb3ZlWm9uZShmaXJzdCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbEhlaWdodCwgMzcwKTtcblx0XHRcdFx0XHRhY2Nlc3Nvci5yZW1vdmVab25lKHNlY29uZCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGxMaXN0LnNjcm9sbEhlaWdodCwgMzUwKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQU1BLE9BQU8sWUFBWTtBQUNuQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLCtDQUErQztBQUN4RCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdDQUFnQztBQUV6QyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGNBQWMsZ0JBQWdCO0FBQ3ZDLFNBQVMsd0JBQXdCLDJCQUEyQix3QkFBd0I7QUFFcEYsTUFBTSxvQkFBb0IsTUFBTTtBQUUvQiwwQ0FBd0M7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
