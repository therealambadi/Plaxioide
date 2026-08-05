import assert from "assert";
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { Mimes } from "../../../../../base/common/mime.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Position } from "../../../../../editor/common/core/position.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { IUndoRedoService } from "../../../../../platform/undoRedo/common/undoRedo.js";
import { NotebookTextModel } from "../../common/model/notebookTextModel.js";
import { CellEditType, CellKind, MOVE_CURSOR_1_LINE_COMMAND, SelectionStateType } from "../../common/notebookCommon.js";
import { setupInstantiationService, TestCell, valueBytesFromString, withTestNotebook } from "./testNotebookEditor.js";
suite("NotebookTextModel", () => {
  let disposables;
  let instantiationService;
  let languageService;
  ensureNoDisposablesAreLeakedInTestSuite();
  suiteSetup(() => {
    disposables = new DisposableStore();
    instantiationService = setupInstantiationService(disposables);
    languageService = instantiationService.get(ILanguageService);
    instantiationService.spy(IUndoRedoService, "pushElement");
  });
  suiteTeardown(() => disposables.dispose());
  test("insert", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}],
        ["var d = 4;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, _viewModel, ds) => {
        const textModel = editor.textModel;
        textModel.applyEdits([
          { editType: CellEditType.Replace, index: 1, count: 0, cells: [ds.add(new TestCell(textModel.viewType, 5, "var e = 5;", "javascript", CellKind.Code, [], languageService))] },
          { editType: CellEditType.Replace, index: 3, count: 0, cells: [ds.add(new TestCell(textModel.viewType, 6, "var f = 6;", "javascript", CellKind.Code, [], languageService))] }
        ], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(textModel.cells.length, 6);
        assert.strictEqual(textModel.cells[1].getValue(), "var e = 5;");
        assert.strictEqual(textModel.cells[4].getValue(), "var f = 6;");
      }
    );
  });
  test("multiple inserts at same position", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}],
        ["var d = 4;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, _viewModel, ds) => {
        const textModel = editor.textModel;
        textModel.applyEdits([
          { editType: CellEditType.Replace, index: 1, count: 0, cells: [ds.add(new TestCell(textModel.viewType, 5, "var e = 5;", "javascript", CellKind.Code, [], languageService))] },
          { editType: CellEditType.Replace, index: 1, count: 0, cells: [ds.add(new TestCell(textModel.viewType, 6, "var f = 6;", "javascript", CellKind.Code, [], languageService))] }
        ], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(textModel.cells.length, 6);
        assert.strictEqual(textModel.cells[1].getValue(), "var e = 5;");
        assert.strictEqual(textModel.cells[2].getValue(), "var f = 6;");
      }
    );
  });
  test("delete", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}],
        ["var d = 4;", "javascript", CellKind.Code, [], {}]
      ],
      (editor) => {
        const textModel = editor.textModel;
        textModel.applyEdits([
          { editType: CellEditType.Replace, index: 1, count: 1, cells: [] },
          { editType: CellEditType.Replace, index: 3, count: 1, cells: [] }
        ], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(textModel.cells[0].getValue(), "var a = 1;");
        assert.strictEqual(textModel.cells[1].getValue(), "var c = 3;");
      }
    );
  });
  test("delete + insert", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}],
        ["var d = 4;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, _viewModel, ds) => {
        const textModel = editor.textModel;
        textModel.applyEdits([
          { editType: CellEditType.Replace, index: 1, count: 1, cells: [] },
          { editType: CellEditType.Replace, index: 3, count: 0, cells: [ds.add(new TestCell(textModel.viewType, 5, "var e = 5;", "javascript", CellKind.Code, [], languageService))] }
        ], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(textModel.cells.length, 4);
        assert.strictEqual(textModel.cells[0].getValue(), "var a = 1;");
        assert.strictEqual(textModel.cells[2].getValue(), "var e = 5;");
      }
    );
  });
  test("delete + insert at same position", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}],
        ["var d = 4;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, _viewModel, ds) => {
        const textModel = editor.textModel;
        textModel.applyEdits([
          { editType: CellEditType.Replace, index: 1, count: 1, cells: [] },
          { editType: CellEditType.Replace, index: 1, count: 0, cells: [ds.add(new TestCell(textModel.viewType, 5, "var e = 5;", "javascript", CellKind.Code, [], languageService))] }
        ], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(textModel.cells.length, 4);
        assert.strictEqual(textModel.cells[0].getValue(), "var a = 1;");
        assert.strictEqual(textModel.cells[1].getValue(), "var e = 5;");
        assert.strictEqual(textModel.cells[2].getValue(), "var c = 3;");
      }
    );
  });
  test("(replace) delete + insert at same position", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}],
        ["var d = 4;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, _viewModel, ds) => {
        const textModel = editor.textModel;
        textModel.applyEdits([
          { editType: CellEditType.Replace, index: 1, count: 1, cells: [ds.add(new TestCell(textModel.viewType, 5, "var e = 5;", "javascript", CellKind.Code, [], languageService))] }
        ], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(textModel.cells.length, 4);
        assert.strictEqual(textModel.cells[0].getValue(), "var a = 1;");
        assert.strictEqual(textModel.cells[1].getValue(), "var e = 5;");
        assert.strictEqual(textModel.cells[2].getValue(), "var c = 3;");
      }
    );
  });
  test("output", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}]
      ],
      (editor) => {
        const textModel = editor.textModel;
        assert.throws(() => {
          textModel.applyEdits([{
            index: Number.MAX_VALUE,
            editType: CellEditType.Output,
            outputs: []
          }], true, void 0, () => void 0, void 0, true);
        });
        assert.throws(() => {
          textModel.applyEdits([{
            index: -1,
            editType: CellEditType.Output,
            outputs: []
          }], true, void 0, () => void 0, void 0, true);
        });
        textModel.applyEdits([{
          index: 0,
          editType: CellEditType.Output,
          outputs: [{
            outputId: "someId",
            outputs: [{ mime: Mimes.markdown, data: valueBytesFromString("_Hello_") }]
          }]
        }], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(textModel.cells.length, 1);
        assert.strictEqual(textModel.cells[0].outputs.length, 1);
        textModel.applyEdits([{
          index: 0,
          editType: CellEditType.Output,
          append: true,
          outputs: [{
            outputId: "someId2",
            outputs: [{ mime: Mimes.markdown, data: valueBytesFromString("_Hello2_") }]
          }]
        }], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(textModel.cells.length, 1);
        assert.strictEqual(textModel.cells[0].outputs.length, 2);
        let [first, second] = textModel.cells[0].outputs;
        assert.strictEqual(first.outputId, "someId");
        assert.strictEqual(second.outputId, "someId2");
        textModel.applyEdits([{
          index: 0,
          editType: CellEditType.Output,
          outputs: [{
            outputId: "someId3",
            outputs: [{ mime: Mimes.text, data: valueBytesFromString("Last, replaced output") }]
          }]
        }], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(textModel.cells.length, 1);
        assert.strictEqual(textModel.cells[0].outputs.length, 1);
        [first] = textModel.cells[0].outputs;
        assert.strictEqual(first.outputId, "someId3");
      }
    );
  });
  test("multiple append output in one position", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}]
      ],
      (editor) => {
        const textModel = editor.textModel;
        textModel.applyEdits([
          {
            index: 0,
            editType: CellEditType.Output,
            append: true,
            outputs: [{
              outputId: "append1",
              outputs: [{ mime: Mimes.markdown, data: valueBytesFromString("append 1") }]
            }]
          },
          {
            index: 0,
            editType: CellEditType.Output,
            append: true,
            outputs: [{
              outputId: "append2",
              outputs: [{ mime: Mimes.markdown, data: valueBytesFromString("append 2") }]
            }]
          }
        ], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(textModel.cells.length, 1);
        assert.strictEqual(textModel.cells[0].outputs.length, 2);
        const [first, second] = textModel.cells[0].outputs;
        assert.strictEqual(first.outputId, "append1");
        assert.strictEqual(second.outputId, "append2");
      }
    );
  });
  test("append to output created in same batch", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}]
      ],
      (editor) => {
        const textModel = editor.textModel;
        textModel.applyEdits([
          {
            index: 0,
            editType: CellEditType.Output,
            append: true,
            outputs: [{
              outputId: "append1",
              outputs: [{ mime: Mimes.markdown, data: valueBytesFromString("append 1") }]
            }]
          },
          {
            editType: CellEditType.OutputItems,
            append: true,
            outputId: "append1",
            items: [{
              mime: Mimes.markdown,
              data: valueBytesFromString("append 2")
            }]
          }
        ], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(textModel.cells.length, 1);
        assert.strictEqual(textModel.cells[0].outputs.length, 1, "has 1 output");
        const [first] = textModel.cells[0].outputs;
        assert.strictEqual(first.outputId, "append1");
        assert.strictEqual(first.outputs.length, 2, "has 2 items");
      }
    );
  });
  const stdOutMime = "application/vnd.code.notebook.stdout";
  const stdErrMime = "application/vnd.code.notebook.stderr";
  test("appending streaming outputs", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}]
      ],
      (editor) => {
        const textModel = editor.textModel;
        textModel.applyEdits([
          {
            index: 0,
            editType: CellEditType.Output,
            append: true,
            outputs: [{
              outputId: "append1",
              outputs: [{ mime: stdOutMime, data: valueBytesFromString("append 1") }]
            }]
          }
        ], true, void 0, () => void 0, void 0, true);
        const [output] = textModel.cells[0].outputs;
        assert.strictEqual(output.versionId, 0, "initial output version should be 0");
        textModel.applyEdits([
          {
            editType: CellEditType.OutputItems,
            append: true,
            outputId: "append1",
            items: [
              { mime: stdOutMime, data: valueBytesFromString("append 2") },
              { mime: stdOutMime, data: valueBytesFromString("append 3") }
            ]
          }
        ], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(output.versionId, 1, "version should bump per append");
        textModel.applyEdits([
          {
            editType: CellEditType.OutputItems,
            append: true,
            outputId: "append1",
            items: [
              { mime: stdOutMime, data: valueBytesFromString("append 4") },
              { mime: stdOutMime, data: valueBytesFromString("append 5") }
            ]
          }
        ], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(output.versionId, 2, "version should bump per append");
        assert.strictEqual(textModel.cells.length, 1);
        assert.strictEqual(textModel.cells[0].outputs.length, 1, "has 1 output");
        assert.strictEqual(output.outputId, "append1");
        assert.strictEqual(output.outputs.length, 1, "outputs are compressed");
        assert.strictEqual(output.outputs[0].data.toString(), "append 1append 2append 3append 4append 5");
        assert.strictEqual(output.appendedSinceVersion(0, stdOutMime)?.toString(), "append 2append 3append 4append 5");
        assert.strictEqual(output.appendedSinceVersion(1, stdOutMime)?.toString(), "append 4append 5");
        assert.strictEqual(output.appendedSinceVersion(2, stdOutMime), void 0);
        assert.strictEqual(output.appendedSinceVersion(2, stdErrMime), void 0);
      }
    );
  });
  test("replacing streaming outputs", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}]
      ],
      (editor) => {
        const textModel = editor.textModel;
        textModel.applyEdits([
          {
            index: 0,
            editType: CellEditType.Output,
            append: true,
            outputs: [{
              outputId: "append1",
              outputs: [{ mime: stdOutMime, data: valueBytesFromString("append 1") }]
            }]
          }
        ], true, void 0, () => void 0, void 0, true);
        const [output] = textModel.cells[0].outputs;
        assert.strictEqual(output.versionId, 0, "initial output version should be 0");
        textModel.applyEdits([
          {
            editType: CellEditType.OutputItems,
            append: true,
            outputId: "append1",
            items: [{
              mime: stdOutMime,
              data: valueBytesFromString("append 2")
            }]
          }
        ], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(output.versionId, 1, "version should bump per append");
        textModel.applyEdits([
          {
            editType: CellEditType.OutputItems,
            append: false,
            outputId: "append1",
            items: [{
              mime: stdOutMime,
              data: valueBytesFromString("replace 3")
            }]
          }
        ], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(output.versionId, 2, "version should bump per replace");
        textModel.applyEdits([
          {
            editType: CellEditType.OutputItems,
            append: true,
            outputId: "append1",
            items: [{
              mime: stdOutMime,
              data: valueBytesFromString("append 4")
            }]
          }
        ], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(output.versionId, 3, "version should bump per append");
        assert.strictEqual(output.outputs[0].data.toString(), "replace 3append 4");
        assert.strictEqual(
          output.appendedSinceVersion(0, stdOutMime),
          void 0,
          "replacing output should clear out previous versioned output buffers"
        );
        assert.strictEqual(
          output.appendedSinceVersion(1, stdOutMime),
          void 0,
          "replacing output should clear out previous versioned output buffers"
        );
        assert.strictEqual(output.appendedSinceVersion(2, stdOutMime)?.toString(), "append 4");
      }
    );
  });
  test("appending streaming outputs with move cursor compression", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}]
      ],
      (editor) => {
        const textModel = editor.textModel;
        textModel.applyEdits([
          {
            index: 0,
            editType: CellEditType.Output,
            append: true,
            outputs: [{
              outputId: "append1",
              outputs: [
                { mime: stdOutMime, data: valueBytesFromString("append 1") },
                { mime: stdOutMime, data: valueBytesFromString("\nappend 1") }
              ]
            }]
          }
        ], true, void 0, () => void 0, void 0, true);
        const [output] = textModel.cells[0].outputs;
        assert.strictEqual(output.versionId, 0, "initial output version should be 0");
        textModel.applyEdits([
          {
            editType: CellEditType.OutputItems,
            append: true,
            outputId: "append1",
            items: [{
              mime: stdOutMime,
              data: valueBytesFromString(MOVE_CURSOR_1_LINE_COMMAND + "\nappend 2")
            }]
          }
        ], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(output.versionId, 1, "version should bump per append");
        assert.strictEqual(output.outputs[0].data.toString(), "append 1\nappend 2");
        assert.strictEqual(
          output.appendedSinceVersion(0, stdOutMime),
          void 0,
          "compressing outputs should clear out previous versioned output buffers"
        );
      }
    );
  });
  test("appending streaming outputs with carraige return compression", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}]
      ],
      (editor) => {
        const textModel = editor.textModel;
        textModel.applyEdits([
          {
            index: 0,
            editType: CellEditType.Output,
            append: true,
            outputs: [{
              outputId: "append1",
              outputs: [
                { mime: stdOutMime, data: valueBytesFromString("append 1") },
                { mime: stdOutMime, data: valueBytesFromString("\nappend 1") }
              ]
            }]
          }
        ], true, void 0, () => void 0, void 0, true);
        const [output] = textModel.cells[0].outputs;
        assert.strictEqual(output.versionId, 0, "initial output version should be 0");
        textModel.applyEdits([
          {
            editType: CellEditType.OutputItems,
            append: true,
            outputId: "append1",
            items: [{
              mime: stdOutMime,
              data: valueBytesFromString("\rappend 2")
            }]
          }
        ], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(output.versionId, 1, "version should bump per append");
        assert.strictEqual(output.outputs[0].data.toString(), "append 1\nappend 2");
        assert.strictEqual(
          output.appendedSinceVersion(0, stdOutMime),
          void 0,
          "compressing outputs should clear out previous versioned output buffers"
        );
      }
    );
  });
  test("appending multiple different mime streaming outputs", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}]
      ],
      (editor) => {
        const textModel = editor.textModel;
        textModel.applyEdits([
          {
            index: 0,
            editType: CellEditType.Output,
            append: true,
            outputs: [{
              outputId: "append1",
              outputs: [
                { mime: stdOutMime, data: valueBytesFromString("stdout 1") },
                { mime: stdErrMime, data: valueBytesFromString("stderr 1") }
              ]
            }]
          }
        ], true, void 0, () => void 0, void 0, true);
        const [output] = textModel.cells[0].outputs;
        assert.strictEqual(output.versionId, 0, "initial output version should be 0");
        textModel.applyEdits([
          {
            editType: CellEditType.OutputItems,
            append: true,
            outputId: "append1",
            items: [
              { mime: stdOutMime, data: valueBytesFromString("stdout 2") },
              { mime: stdErrMime, data: valueBytesFromString("stderr 2") }
            ]
          }
        ], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(output.versionId, 1, "version should bump per replace");
        assert.strictEqual(output.appendedSinceVersion(0, stdErrMime)?.toString(), "stderr 2");
        assert.strictEqual(output.appendedSinceVersion(0, stdOutMime)?.toString(), "stdout 2");
      }
    );
  });
  test("metadata", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}]
      ],
      (editor) => {
        const textModel = editor.textModel;
        assert.throws(() => {
          textModel.applyEdits([{
            index: Number.MAX_VALUE,
            editType: CellEditType.Metadata,
            metadata: {}
          }], true, void 0, () => void 0, void 0, true);
        });
        assert.throws(() => {
          textModel.applyEdits([{
            index: -1,
            editType: CellEditType.Metadata,
            metadata: {}
          }], true, void 0, () => void 0, void 0, true);
        });
        textModel.applyEdits([{
          index: 0,
          editType: CellEditType.Metadata,
          metadata: { customProperty: 15 }
        }], true, void 0, () => void 0, void 0, true);
        textModel.applyEdits([{
          index: 0,
          editType: CellEditType.Metadata,
          metadata: {}
        }], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(textModel.cells.length, 1);
        assert.strictEqual(textModel.cells[0].metadata.customProperty, void 0);
      }
    );
  });
  test("partial metadata", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}]
      ],
      (editor) => {
        const textModel = editor.textModel;
        textModel.applyEdits([{
          index: 0,
          editType: CellEditType.PartialMetadata,
          metadata: { customProperty: 15 }
        }], true, void 0, () => void 0, void 0, true);
        textModel.applyEdits([{
          index: 0,
          editType: CellEditType.PartialMetadata,
          metadata: {}
        }], true, void 0, () => void 0, void 0, true);
        assert.strictEqual(textModel.cells.length, 1);
        assert.strictEqual(textModel.cells[0].metadata.customProperty, 15);
      }
    );
  });
  test("multiple inserts in one edit", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}],
        ["var d = 4;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, _viewModel, ds) => {
        const textModel = editor.textModel;
        let changeEvent = void 0;
        const eventListener = textModel.onDidChangeContent((e) => {
          changeEvent = e;
        });
        const willChangeEvents = [];
        const willChangeListener = textModel.onWillAddRemoveCells((e) => {
          willChangeEvents.push(e);
        });
        const version = textModel.versionId;
        textModel.applyEdits([
          { editType: CellEditType.Replace, index: 1, count: 1, cells: [] },
          { editType: CellEditType.Replace, index: 1, count: 0, cells: [ds.add(new TestCell(textModel.viewType, 5, "var e = 5;", "javascript", CellKind.Code, [], languageService))] }
        ], true, void 0, () => ({ kind: SelectionStateType.Index, focus: { start: 0, end: 1 }, selections: [{ start: 0, end: 1 }] }), void 0, true);
        assert.strictEqual(textModel.cells.length, 4);
        assert.strictEqual(textModel.cells[0].getValue(), "var a = 1;");
        assert.strictEqual(textModel.cells[1].getValue(), "var e = 5;");
        assert.strictEqual(textModel.cells[2].getValue(), "var c = 3;");
        assert.notStrictEqual(changeEvent, void 0);
        assert.strictEqual(changeEvent.rawEvents.length, 2);
        assert.deepStrictEqual(changeEvent.endSelectionState?.selections, [{ start: 0, end: 1 }]);
        assert.strictEqual(willChangeEvents.length, 2);
        assert.strictEqual(textModel.versionId, version + 1);
        eventListener.dispose();
        willChangeListener.dispose();
      }
    );
  });
  test("insert and metadata change in one edit", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}],
        ["var d = 4;", "javascript", CellKind.Code, [], {}]
      ],
      (editor) => {
        const textModel = editor.textModel;
        let changeEvent = void 0;
        const eventListener = textModel.onDidChangeContent((e) => {
          changeEvent = e;
        });
        const willChangeEvents = [];
        const willChangeListener = textModel.onWillAddRemoveCells((e) => {
          willChangeEvents.push(e);
        });
        const version = textModel.versionId;
        textModel.applyEdits([
          { editType: CellEditType.Replace, index: 1, count: 1, cells: [] },
          {
            index: 0,
            editType: CellEditType.Metadata,
            metadata: {}
          }
        ], true, void 0, () => ({ kind: SelectionStateType.Index, focus: { start: 0, end: 1 }, selections: [{ start: 0, end: 1 }] }), void 0, true);
        assert.notStrictEqual(changeEvent, void 0);
        assert.strictEqual(changeEvent.rawEvents.length, 2);
        assert.deepStrictEqual(changeEvent.endSelectionState?.selections, [{ start: 0, end: 1 }]);
        assert.strictEqual(willChangeEvents.length, 1);
        assert.strictEqual(textModel.versionId, version + 1);
        eventListener.dispose();
        willChangeListener.dispose();
      }
    );
  });
  test("Updating appending/updating output in Notebooks does not work as expected #117273", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}]
    ], (editor) => {
      const model = editor.textModel;
      assert.strictEqual(model.cells.length, 1);
      assert.strictEqual(model.cells[0].outputs.length, 0);
      const success1 = model.applyEdits(
        [{
          editType: CellEditType.Output,
          index: 0,
          outputs: [
            { outputId: "out1", outputs: [{ mime: "application/x.notebook.stream", data: VSBuffer.wrap(new Uint8Array([1])) }] }
          ],
          append: false
        }],
        true,
        void 0,
        () => void 0,
        void 0,
        false
      );
      assert.ok(success1);
      assert.strictEqual(model.cells[0].outputs.length, 1);
      const success2 = model.applyEdits(
        [{
          editType: CellEditType.Output,
          index: 0,
          outputs: [
            { outputId: "out2", outputs: [{ mime: "application/x.notebook.stream", data: VSBuffer.wrap(new Uint8Array([1])) }] }
          ],
          append: true
        }],
        true,
        void 0,
        () => void 0,
        void 0,
        false
      );
      assert.ok(success2);
      assert.strictEqual(model.cells[0].outputs.length, 2);
    });
  });
  test("Clearing output of an empty notebook makes it dirty #119608", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}],
      ["var b = 2;", "javascript", CellKind.Code, [], {}]
    ], (editor, _, ds) => {
      const model = editor.textModel;
      let event;
      ds.add(model.onDidChangeContent((e) => {
        event = e;
      }));
      {
        const success = model.applyEdits(
          [{
            editType: CellEditType.Output,
            index: 0,
            outputs: [
              { outputId: "out1", outputs: [{ mime: "application/x.notebook.stream", data: VSBuffer.wrap(new Uint8Array([1])) }] }
            ],
            append: false
          }],
          true,
          void 0,
          () => void 0,
          void 0,
          false
        );
        assert.ok(success);
        assert.strictEqual(model.cells[0].outputs.length, 1);
        assert.ok(event);
      }
      {
        event = void 0;
        const success = model.applyEdits(
          [{
            editType: CellEditType.Output,
            index: 0,
            outputs: [],
            append: false
          }, {
            editType: CellEditType.Output,
            index: 1,
            outputs: [],
            append: false
          }],
          true,
          void 0,
          () => void 0,
          void 0,
          false
        );
        assert.ok(success);
        assert.ok(event);
      }
      {
        event = void 0;
        const success = model.applyEdits(
          [{
            editType: CellEditType.Output,
            index: 0,
            outputs: [],
            append: false
          }, {
            editType: CellEditType.Output,
            index: 1,
            outputs: [],
            append: false
          }],
          true,
          void 0,
          () => void 0,
          void 0,
          false
        );
        assert.ok(success);
        assert.ok(event === void 0);
      }
    });
  });
  test("Cell metadata/output change should update version id and alternative id #121807", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}],
      ["var b = 2;", "javascript", CellKind.Code, [], {}]
    ], async (editor, viewModel) => {
      assert.strictEqual(editor.textModel.versionId, 0);
      const firstAltVersion = "0_0,1;1,1";
      assert.strictEqual(editor.textModel.alternativeVersionId, firstAltVersion);
      editor.textModel.applyEdits([
        {
          index: 0,
          editType: CellEditType.Metadata,
          metadata: {
            inputCollapsed: true
          }
        }
      ], true, void 0, () => void 0, void 0, true);
      assert.strictEqual(editor.textModel.versionId, 1);
      assert.notStrictEqual(editor.textModel.alternativeVersionId, firstAltVersion);
      const secondAltVersion = "1_0,1;1,1";
      assert.strictEqual(editor.textModel.alternativeVersionId, secondAltVersion);
      await viewModel.undo();
      assert.strictEqual(editor.textModel.versionId, 2);
      assert.strictEqual(editor.textModel.alternativeVersionId, firstAltVersion);
      await viewModel.redo();
      assert.strictEqual(editor.textModel.versionId, 3);
      assert.notStrictEqual(editor.textModel.alternativeVersionId, firstAltVersion);
      assert.strictEqual(editor.textModel.alternativeVersionId, secondAltVersion);
      editor.textModel.applyEdits([
        {
          index: 1,
          editType: CellEditType.Metadata,
          metadata: {
            inputCollapsed: true
          }
        }
      ], true, void 0, () => void 0, void 0, true);
      assert.strictEqual(editor.textModel.versionId, 4);
      assert.strictEqual(editor.textModel.alternativeVersionId, "4_0,1;1,1");
      await viewModel.undo();
      assert.strictEqual(editor.textModel.versionId, 5);
      assert.strictEqual(editor.textModel.alternativeVersionId, secondAltVersion);
    });
  });
  test("metadata changes on newly added cells should combine their undo operations", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}]
    ], async (editor, viewModel, ds) => {
      const textModel = editor.textModel;
      editor.textModel.applyEdits([
        {
          editType: CellEditType.Replace,
          index: 1,
          count: 0,
          cells: [
            ds.add(new TestCell(textModel.viewType, 1, "var e = 5;", "javascript", CellKind.Code, [], languageService)),
            ds.add(new TestCell(textModel.viewType, 2, "var f = 6;", "javascript", CellKind.Code, [], languageService))
          ]
        }
      ], true, void 0, () => void 0, void 0, true);
      assert.strictEqual(textModel.cells.length, 3);
      editor.textModel.applyEdits([
        { editType: CellEditType.Metadata, index: 1, metadata: { id: "123" } }
      ], true, void 0, () => void 0, void 0, true);
      assert.strictEqual(textModel.cells[1].metadata.id, "123");
      await viewModel.undo();
      assert.strictEqual(textModel.cells.length, 1);
      await viewModel.redo();
      assert.strictEqual(textModel.cells.length, 3);
    });
  });
  test("changes with non-metadata edit should not combine their undo operations", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}]
    ], async (editor, viewModel, ds) => {
      const textModel = editor.textModel;
      editor.textModel.applyEdits([
        {
          editType: CellEditType.Replace,
          index: 1,
          count: 0,
          cells: [
            ds.add(new TestCell(textModel.viewType, 1, "var e = 5;", "javascript", CellKind.Code, [], languageService)),
            ds.add(new TestCell(textModel.viewType, 2, "var f = 6;", "javascript", CellKind.Code, [], languageService))
          ]
        }
      ], true, void 0, () => void 0, void 0, true);
      assert.strictEqual(textModel.cells.length, 3);
      editor.textModel.applyEdits([
        { editType: CellEditType.Metadata, index: 1, metadata: { id: "123" } },
        {
          editType: CellEditType.Output,
          handle: 0,
          append: true,
          outputs: [{
            outputId: "newOutput",
            outputs: [{ mime: Mimes.text, data: valueBytesFromString("cba") }, { mime: "application/foo", data: valueBytesFromString("cba") }]
          }]
        }
      ], true, void 0, () => void 0, void 0, true);
      assert.strictEqual(textModel.cells[1].metadata.id, "123");
      await viewModel.undo();
      assert.strictEqual(textModel.cells.length, 3);
      await viewModel.undo();
      assert.strictEqual(textModel.cells.length, 1);
    });
  });
  test("Destructive sorting in _doApplyEdits #121994", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [{ outputId: "i42", outputs: [{ mime: "m/ime", data: valueBytesFromString("test") }] }], {}]
    ], async (editor) => {
      const notebook = editor.textModel;
      assert.strictEqual(notebook.cells[0].outputs.length, 1);
      assert.strictEqual(notebook.cells[0].outputs[0].outputs.length, 1);
      assert.deepStrictEqual(notebook.cells[0].outputs[0].outputs[0].data, valueBytesFromString("test"));
      const edits = [
        {
          editType: CellEditType.Output,
          handle: 0,
          outputs: []
        },
        {
          editType: CellEditType.Output,
          handle: 0,
          append: true,
          outputs: [{
            outputId: "newOutput",
            outputs: [{ mime: Mimes.text, data: valueBytesFromString("cba") }, { mime: "application/foo", data: valueBytesFromString("cba") }]
          }]
        }
      ];
      editor.textModel.applyEdits(edits, true, void 0, () => void 0, void 0, true);
      assert.strictEqual(notebook.cells[0].outputs.length, 1);
      assert.strictEqual(notebook.cells[0].outputs[0].outputs.length, 2);
    });
  });
  test("Destructive sorting in _doApplyEdits #121994. cell splice between output changes", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [{ outputId: "i42", outputs: [{ mime: "m/ime", data: valueBytesFromString("test") }] }], {}],
      ["var b = 2;", "javascript", CellKind.Code, [{ outputId: "i43", outputs: [{ mime: "m/ime", data: valueBytesFromString("test") }] }], {}],
      ["var c = 3;", "javascript", CellKind.Code, [{ outputId: "i44", outputs: [{ mime: "m/ime", data: valueBytesFromString("test") }] }], {}]
    ], async (editor) => {
      const notebook = editor.textModel;
      const edits = [
        {
          editType: CellEditType.Output,
          index: 0,
          outputs: []
        },
        {
          editType: CellEditType.Replace,
          index: 1,
          count: 1,
          cells: []
        },
        {
          editType: CellEditType.Output,
          index: 2,
          append: true,
          outputs: [{
            outputId: "newOutput",
            outputs: [{ mime: Mimes.text, data: valueBytesFromString("cba") }, { mime: "application/foo", data: valueBytesFromString("cba") }]
          }]
        }
      ];
      editor.textModel.applyEdits(edits, true, void 0, () => void 0, void 0, true);
      assert.strictEqual(notebook.cells.length, 2);
      assert.strictEqual(notebook.cells[0].outputs.length, 0);
      assert.strictEqual(notebook.cells[1].outputs.length, 2);
      assert.strictEqual(notebook.cells[1].outputs[0].outputId, "i44");
      assert.strictEqual(notebook.cells[1].outputs[1].outputId, "newOutput");
    });
  });
  test("Destructive sorting in _doApplyEdits #121994. cell splice between output changes 2", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [{ outputId: "i42", outputs: [{ mime: "m/ime", data: valueBytesFromString("test") }] }], {}],
      ["var b = 2;", "javascript", CellKind.Code, [{ outputId: "i43", outputs: [{ mime: "m/ime", data: valueBytesFromString("test") }] }], {}],
      ["var c = 3;", "javascript", CellKind.Code, [{ outputId: "i44", outputs: [{ mime: "m/ime", data: valueBytesFromString("test") }] }], {}]
    ], async (editor) => {
      const notebook = editor.textModel;
      const edits = [
        {
          editType: CellEditType.Output,
          index: 1,
          append: true,
          outputs: [{
            outputId: "newOutput",
            outputs: [{ mime: Mimes.text, data: valueBytesFromString("cba") }, { mime: "application/foo", data: valueBytesFromString("cba") }]
          }]
        },
        {
          editType: CellEditType.Replace,
          index: 1,
          count: 1,
          cells: []
        },
        {
          editType: CellEditType.Output,
          index: 1,
          append: true,
          outputs: [{
            outputId: "newOutput2",
            outputs: [{ mime: Mimes.text, data: valueBytesFromString("cba") }, { mime: "application/foo", data: valueBytesFromString("cba") }]
          }]
        }
      ];
      editor.textModel.applyEdits(edits, true, void 0, () => void 0, void 0, true);
      assert.strictEqual(notebook.cells.length, 2);
      assert.strictEqual(notebook.cells[0].outputs.length, 1);
      assert.strictEqual(notebook.cells[1].outputs.length, 1);
      assert.strictEqual(notebook.cells[1].outputs[0].outputId, "i44");
    });
  });
  test("Output edits splice", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}]
    ], (editor) => {
      const model = editor.textModel;
      assert.strictEqual(model.cells.length, 1);
      assert.strictEqual(model.cells[0].outputs.length, 0);
      const success1 = model.applyEdits(
        [{
          editType: CellEditType.Output,
          index: 0,
          outputs: [
            { outputId: "out1", outputs: [{ mime: "application/x.notebook.stream", data: valueBytesFromString("1") }] },
            { outputId: "out2", outputs: [{ mime: "application/x.notebook.stream", data: valueBytesFromString("2") }] },
            { outputId: "out3", outputs: [{ mime: "application/x.notebook.stream", data: valueBytesFromString("3") }] },
            { outputId: "out4", outputs: [{ mime: "application/x.notebook.stream", data: valueBytesFromString("4") }] }
          ],
          append: false
        }],
        true,
        void 0,
        () => void 0,
        void 0,
        false
      );
      assert.ok(success1);
      assert.strictEqual(model.cells[0].outputs.length, 4);
      const success2 = model.applyEdits(
        [{
          editType: CellEditType.Output,
          index: 0,
          outputs: [
            { outputId: "out1", outputs: [{ mime: "application/x.notebook.stream", data: valueBytesFromString("1") }] },
            { outputId: "out5", outputs: [{ mime: "application/x.notebook.stream", data: valueBytesFromString("5") }] },
            { outputId: "out3", outputs: [{ mime: "application/x.notebook.stream", data: valueBytesFromString("3") }] },
            { outputId: "out6", outputs: [{ mime: "application/x.notebook.stream", data: valueBytesFromString("6") }] }
          ],
          append: false
        }],
        true,
        void 0,
        () => void 0,
        void 0,
        false
      );
      assert.ok(success2);
      assert.strictEqual(model.cells[0].outputs.length, 4);
      assert.strictEqual(model.cells[0].outputs[0].outputId, "out1");
      assert.strictEqual(model.cells[0].outputs[1].outputId, "out5");
      assert.strictEqual(model.cells[0].outputs[2].outputId, "out3");
      assert.strictEqual(model.cells[0].outputs[3].outputId, "out6");
    });
  });
  test("computeEdits no insert", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}]
    ], (editor) => {
      const model = editor.textModel;
      const edits = NotebookTextModel.computeEdits(model, [
        { source: "var a = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: void 0 }
      ]);
      assert.deepStrictEqual(edits, [
        { editType: CellEditType.Metadata, index: 0, metadata: {} }
      ]);
    });
  });
  test("computeEdits cell content changed", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}]
    ], (editor) => {
      const model = editor.textModel;
      const cells = [
        { source: "var a = 2;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: void 0 }
      ];
      const edits = NotebookTextModel.computeEdits(model, cells);
      assert.deepStrictEqual(edits, [
        { editType: CellEditType.Replace, index: 0, count: 1, cells }
      ]);
    });
  });
  test("computeEdits last cell content changed", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}],
      ["var b = 1;", "javascript", CellKind.Code, [], {}]
    ], (editor) => {
      const model = editor.textModel;
      const cells = [
        { source: "var a = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: void 0 },
        { source: "var b = 2;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: void 0 }
      ];
      const edits = NotebookTextModel.computeEdits(model, cells);
      assert.deepStrictEqual(edits, [
        { editType: CellEditType.Metadata, index: 0, metadata: {} },
        { editType: CellEditType.Replace, index: 1, count: 1, cells: cells.slice(1) }
      ]);
    });
  });
  test("computeEdits first cell content changed", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}],
      ["var b = 1;", "javascript", CellKind.Code, [], {}]
    ], (editor) => {
      const model = editor.textModel;
      const cells = [
        { source: "var a = 2;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: void 0 },
        { source: "var b = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: void 0 }
      ];
      const edits = NotebookTextModel.computeEdits(model, cells);
      assert.deepStrictEqual(edits, [
        { editType: CellEditType.Replace, index: 0, count: 1, cells: cells.slice(0, 1) },
        { editType: CellEditType.Metadata, index: 1, metadata: {} }
      ]);
    });
  });
  test("computeEdits middle cell content changed", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}],
      ["var b = 1;", "javascript", CellKind.Code, [], {}],
      ["var c = 1;", "javascript", CellKind.Code, [], {}]
    ], (editor) => {
      const model = editor.textModel;
      const cells = [
        { source: "var a = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: void 0 },
        { source: "var b = 2;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: void 0 },
        { source: "var c = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: void 0 }
      ];
      const edits = NotebookTextModel.computeEdits(model, cells);
      assert.deepStrictEqual(edits, [
        { editType: CellEditType.Metadata, index: 0, metadata: {} },
        { editType: CellEditType.Replace, index: 1, count: 1, cells: cells.slice(1, 2) },
        { editType: CellEditType.Metadata, index: 2, metadata: {} }
      ]);
    });
  });
  test("computeEdits cell metadata changed", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}],
      ["var b = 1;", "javascript", CellKind.Code, [], {}]
    ], (editor) => {
      const model = editor.textModel;
      const cells = [
        { source: "var a = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: { name: "foo" } },
        { source: "var b = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: void 0 }
      ];
      const edits = NotebookTextModel.computeEdits(model, cells);
      assert.deepStrictEqual(edits, [
        { editType: CellEditType.Metadata, index: 0, metadata: { name: "foo" } },
        { editType: CellEditType.Metadata, index: 1, metadata: {} }
      ]);
    });
  });
  test("computeEdits cell language changed", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}],
      ["var b = 1;", "javascript", CellKind.Code, [], {}]
    ], (editor) => {
      const model = editor.textModel;
      const cells = [
        { source: "var a = 1;", language: "typescript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: void 0 },
        { source: "var b = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: void 0 }
      ];
      const edits = NotebookTextModel.computeEdits(model, cells);
      assert.deepStrictEqual(edits, [
        { editType: CellEditType.Replace, index: 0, count: 1, cells: cells.slice(0, 1) },
        { editType: CellEditType.Metadata, index: 1, metadata: {} }
      ]);
    });
  });
  test("computeEdits cell kind changed", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}],
      ["var b = 1;", "javascript", CellKind.Code, [], {}]
    ], (editor) => {
      const model = editor.textModel;
      const cells = [
        { source: "var a = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: void 0 },
        { source: "var b = 1;", language: "javascript", cellKind: CellKind.Markup, mime: void 0, outputs: [], metadata: void 0 }
      ];
      const edits = NotebookTextModel.computeEdits(model, cells);
      assert.deepStrictEqual(edits, [
        { editType: CellEditType.Metadata, index: 0, metadata: {} },
        { editType: CellEditType.Replace, index: 1, count: 1, cells: cells.slice(1) }
      ]);
    });
  });
  test("computeEdits cell metadata & content changed", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}],
      ["var b = 1;", "javascript", CellKind.Code, [], {}]
    ], (editor) => {
      const model = editor.textModel;
      const cells = [
        { source: "var a = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: { name: "foo" } },
        { source: "var b = 2;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: { name: "bar" } }
      ];
      const edits = NotebookTextModel.computeEdits(model, cells);
      assert.deepStrictEqual(edits, [
        { editType: CellEditType.Metadata, index: 0, metadata: { name: "foo" } },
        { editType: CellEditType.Replace, index: 1, count: 1, cells: cells.slice(1) }
      ]);
    });
  });
  test("computeEdits cell content changed while executing", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}],
      ["var b = 1;", "javascript", CellKind.Code, [], {}]
    ], (editor) => {
      const model = editor.textModel;
      const cells = [
        { source: "var a = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: {} },
        { source: "var b = 2;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: {} }
      ];
      const edits = NotebookTextModel.computeEdits(model, cells, [model.cells[1].handle]);
      assert.deepStrictEqual(edits, [
        { editType: CellEditType.Metadata, index: 0, metadata: {} },
        { editType: CellEditType.Replace, index: 1, count: 1, cells: cells.slice(1) }
      ]);
    });
  });
  test("computeEdits cell internal metadata changed", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}],
      ["var b = 1;", "javascript", CellKind.Code, [], {}]
    ], (editor) => {
      const model = editor.textModel;
      const cells = [
        { source: "var a = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: void 0, internalMetadata: { executionOrder: 1 } },
        { source: "var b = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: void 0 }
      ];
      const edits = NotebookTextModel.computeEdits(model, cells);
      assert.deepStrictEqual(edits, [
        { editType: CellEditType.Replace, index: 0, count: 1, cells: cells.slice(0, 1) },
        { editType: CellEditType.Metadata, index: 1, metadata: {} }
      ]);
    });
  });
  test("computeEdits cell internal metadata changed while executing", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}],
      ["var b = 1;", "javascript", CellKind.Code, [], {}]
    ], (editor) => {
      const model = editor.textModel;
      const cells = [
        { source: "var a = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: {} },
        { source: "var b = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: {}, internalMetadata: { executionOrder: 1 } }
      ];
      const edits = NotebookTextModel.computeEdits(model, cells, [model.cells[1].handle]);
      assert.deepStrictEqual(edits, [
        { editType: CellEditType.Metadata, index: 0, metadata: {} },
        { editType: CellEditType.Metadata, index: 1, metadata: {} }
      ]);
    });
  });
  test("computeEdits cell insertion", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}],
      ["var b = 1;", "javascript", CellKind.Code, [], {}]
    ], (editor) => {
      const model = editor.textModel;
      const cells = [
        { source: "var a = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: void 0 },
        { source: "var c = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: void 0 },
        { source: "var b = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: { foo: "bar" } }
      ];
      const edits = NotebookTextModel.computeEdits(model, cells);
      assert.deepStrictEqual(edits, [
        { editType: CellEditType.Metadata, index: 0, metadata: {} },
        { editType: CellEditType.Replace, index: 1, count: 0, cells: cells.slice(1, 2) },
        { editType: CellEditType.Metadata, index: 1, metadata: { foo: "bar" } }
      ]);
      model.applyEdits(edits, true, void 0, () => void 0, void 0, true);
      assert.equal(model.cells.length, 3);
      assert.equal(model.cells[1].getValue(), "var c = 1;");
      assert.equal(model.cells[2].getValue(), "var b = 1;");
      assert.deepStrictEqual(model.cells[2].metadata, { foo: "bar" });
    });
  });
  test("computeEdits output changed", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [], {}],
      ["var b = 1;", "javascript", CellKind.Code, [], {}]
    ], (editor) => {
      const model = editor.textModel;
      const cells = [
        {
          source: "var a = 1;",
          language: "javascript",
          cellKind: CellKind.Code,
          mime: void 0,
          outputs: [{
            outputId: "someId",
            outputs: [{ mime: Mimes.markdown, data: valueBytesFromString("_World_") }]
          }],
          metadata: void 0
        },
        { source: "var b = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: { foo: "bar" } }
      ];
      const edits = NotebookTextModel.computeEdits(model, cells);
      assert.deepStrictEqual(edits, [
        { editType: CellEditType.Metadata, index: 0, metadata: {} },
        {
          editType: CellEditType.Output,
          index: 0,
          outputs: [{
            outputId: "someId",
            outputs: [{ mime: Mimes.markdown, data: valueBytesFromString("_World_") }]
          }],
          append: false
        },
        { editType: CellEditType.Metadata, index: 1, metadata: { foo: "bar" } }
      ]);
      model.applyEdits(edits, true, void 0, () => void 0, void 0, true);
      assert.equal(model.cells.length, 2);
      assert.strictEqual(model.cells[0].outputs.length, 1);
      assert.equal(model.cells[0].outputs[0].outputId, "someId");
      assert.equal(model.cells[0].outputs[0].outputs[0].data.toString(), "_World_");
    });
  });
  test("computeEdits output items changed", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [{
        outputId: "someId",
        outputs: [{ mime: Mimes.markdown, data: valueBytesFromString("_Hello_") }]
      }], {}],
      ["var b = 1;", "javascript", CellKind.Code, [], {}]
    ], (editor) => {
      const model = editor.textModel;
      const cells = [
        {
          source: "var a = 1;",
          language: "javascript",
          cellKind: CellKind.Code,
          mime: void 0,
          outputs: [{
            outputId: "someId",
            outputs: [{ mime: Mimes.markdown, data: valueBytesFromString("_World_") }]
          }],
          metadata: void 0
        },
        { source: "var b = 1;", language: "javascript", cellKind: CellKind.Code, mime: void 0, outputs: [], metadata: { foo: "bar" } }
      ];
      const edits = NotebookTextModel.computeEdits(model, cells);
      assert.deepStrictEqual(edits, [
        { editType: CellEditType.Metadata, index: 0, metadata: {} },
        { editType: CellEditType.OutputItems, outputId: "someId", items: [{ mime: Mimes.markdown, data: valueBytesFromString("_World_") }], append: false },
        { editType: CellEditType.Metadata, index: 1, metadata: { foo: "bar" } }
      ]);
      model.applyEdits(edits, true, void 0, () => void 0, void 0, true);
      assert.equal(model.cells.length, 2);
      assert.strictEqual(model.cells[0].outputs.length, 1);
      assert.equal(model.cells[0].outputs[0].outputId, "someId");
      assert.equal(model.cells[0].outputs[0].outputs[0].data.toString(), "_World_");
    });
  });
  test("Append multiple text/plain output items", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [{
        outputId: "1",
        outputs: [{ mime: "text/plain", data: valueBytesFromString("foo") }]
      }], {}]
    ], (editor) => {
      const model = editor.textModel;
      const edits = [
        {
          editType: CellEditType.OutputItems,
          outputId: "1",
          append: true,
          items: [{ mime: "text/plain", data: VSBuffer.fromString("bar") }, { mime: "text/plain", data: VSBuffer.fromString("baz") }]
        }
      ];
      model.applyEdits(edits, true, void 0, () => void 0, void 0, true);
      assert.equal(model.cells.length, 1);
      assert.equal(model.cells[0].outputs.length, 1);
      assert.equal(model.cells[0].outputs[0].outputs.length, 3);
      assert.equal(model.cells[0].outputs[0].outputs[0].mime, "text/plain");
      assert.equal(model.cells[0].outputs[0].outputs[0].data.toString(), "foo");
      assert.equal(model.cells[0].outputs[0].outputs[1].mime, "text/plain");
      assert.equal(model.cells[0].outputs[0].outputs[1].data.toString(), "bar");
      assert.equal(model.cells[0].outputs[0].outputs[2].mime, "text/plain");
      assert.equal(model.cells[0].outputs[0].outputs[2].data.toString(), "baz");
    });
  });
  test("Append multiple stdout stream output items to an output with another mime", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [{
        outputId: "1",
        outputs: [{ mime: "text/plain", data: valueBytesFromString("foo") }]
      }], {}]
    ], (editor) => {
      const model = editor.textModel;
      const edits = [
        {
          editType: CellEditType.OutputItems,
          outputId: "1",
          append: true,
          items: [{ mime: "application/vnd.code.notebook.stdout", data: VSBuffer.fromString("bar") }, { mime: "application/vnd.code.notebook.stdout", data: VSBuffer.fromString("baz") }]
        }
      ];
      model.applyEdits(edits, true, void 0, () => void 0, void 0, true);
      assert.equal(model.cells.length, 1);
      assert.equal(model.cells[0].outputs.length, 1);
      assert.equal(model.cells[0].outputs[0].outputs.length, 3);
      assert.equal(model.cells[0].outputs[0].outputs[0].mime, "text/plain");
      assert.equal(model.cells[0].outputs[0].outputs[0].data.toString(), "foo");
      assert.equal(model.cells[0].outputs[0].outputs[1].mime, "application/vnd.code.notebook.stdout");
      assert.equal(model.cells[0].outputs[0].outputs[1].data.toString(), "bar");
      assert.equal(model.cells[0].outputs[0].outputs[2].mime, "application/vnd.code.notebook.stdout");
      assert.equal(model.cells[0].outputs[0].outputs[2].data.toString(), "baz");
    });
  });
  test("Compress multiple stdout stream output items", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [{
        outputId: "1",
        outputs: [{ mime: "application/vnd.code.notebook.stdout", data: valueBytesFromString("foo") }]
      }], {}]
    ], (editor) => {
      const model = editor.textModel;
      const edits = [
        {
          editType: CellEditType.OutputItems,
          outputId: "1",
          append: true,
          items: [{ mime: "application/vnd.code.notebook.stdout", data: VSBuffer.fromString("bar") }, { mime: "application/vnd.code.notebook.stdout", data: VSBuffer.fromString("baz") }]
        }
      ];
      model.applyEdits(edits, true, void 0, () => void 0, void 0, true);
      assert.equal(model.cells.length, 1);
      assert.equal(model.cells[0].outputs.length, 1);
      assert.equal(model.cells[0].outputs[0].outputs.length, 1);
      assert.equal(model.cells[0].outputs[0].outputs[0].mime, "application/vnd.code.notebook.stdout");
      assert.equal(model.cells[0].outputs[0].outputs[0].data.toString(), "foobarbaz");
    });
  });
  test("Compress multiple stderr stream output items", async function() {
    await withTestNotebook([
      ["var a = 1;", "javascript", CellKind.Code, [{
        outputId: "1",
        outputs: [{ mime: "application/vnd.code.notebook.stderr", data: valueBytesFromString("foo") }]
      }], {}]
    ], (editor) => {
      const model = editor.textModel;
      const edits = [
        {
          editType: CellEditType.OutputItems,
          outputId: "1",
          append: true,
          items: [{ mime: "application/vnd.code.notebook.stderr", data: VSBuffer.fromString("bar") }, { mime: "application/vnd.code.notebook.stderr", data: VSBuffer.fromString("baz") }]
        }
      ];
      model.applyEdits(edits, true, void 0, () => void 0, void 0, true);
      assert.equal(model.cells.length, 1);
      assert.equal(model.cells[0].outputs.length, 1);
      assert.equal(model.cells[0].outputs[0].outputs.length, 1);
      assert.equal(model.cells[0].outputs[0].outputs[0].mime, "application/vnd.code.notebook.stderr");
      assert.equal(model.cells[0].outputs[0].outputs[0].data.toString(), "foobarbaz");
    });
  });
  test("findNextMatch", async function() {
    await withTestNotebook(
      [
        ["var a = 1;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}],
        ["var d = 4;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, viewModel) => {
        const notebookModel = viewModel.notebookDocument;
        let findMatch = notebookModel.findNextMatch("var", { cellIndex: 0, position: new Position(1, 1) }, false, false, null);
        assert.ok(findMatch);
        assert.strictEqual(findMatch.match.range.startLineNumber, 1);
        assert.strictEqual(findMatch.match.range.startColumn, 1);
        findMatch = notebookModel.findNextMatch("b", { cellIndex: 1, position: new Position(1, 1) }, false, false, null);
        assert.ok(findMatch);
        assert.strictEqual(findMatch.match.range.startLineNumber, 1);
        assert.strictEqual(findMatch.match.range.startColumn, 5);
        findMatch = notebookModel.findNextMatch("c", { cellIndex: 2, position: new Position(1, 1) }, false, false, null);
        assert.ok(findMatch);
        assert.strictEqual(findMatch.match.range.startLineNumber, 1);
        assert.strictEqual(findMatch.match.range.startColumn, 5);
        findMatch = notebookModel.findNextMatch("d", { cellIndex: 3, position: new Position(1, 1) }, false, false, null);
        assert.ok(findMatch);
        assert.strictEqual(findMatch.match.range.startLineNumber, 1);
        assert.strictEqual(findMatch.match.range.startColumn, 5);
        findMatch = notebookModel.findNextMatch("e", { cellIndex: 0, position: new Position(1, 1) }, false, false, null);
        assert.strictEqual(findMatch, null);
      }
    );
  });
  test("findNextMatch 2", async function() {
    await withTestNotebook(
      [
        ["var a = 1; var a = 2;", "javascript", CellKind.Code, [], {}],
        ["var b = 2;", "javascript", CellKind.Code, [], {}],
        ["var c = 3;", "javascript", CellKind.Code, [], {}],
        ["var d = 4;", "javascript", CellKind.Code, [], {}]
      ],
      (editor, viewModel) => {
        const notebookModel = viewModel.notebookDocument;
        let findMatch = notebookModel.findNextMatch("var", { cellIndex: 0, position: new Position(1, 1) }, false, false, null);
        assert.ok(findMatch);
        assert.strictEqual(findMatch.match.range.startLineNumber, 1);
        assert.strictEqual(findMatch.match.range.startColumn, 1);
        findMatch = notebookModel.findNextMatch("b", { cellIndex: 1, position: new Position(1, 1) }, false, false, null);
        assert.ok(findMatch);
        assert.strictEqual(findMatch.match.range.startLineNumber, 1);
        assert.strictEqual(findMatch.match.range.startColumn, 5);
        findMatch = notebookModel.findNextMatch("c", { cellIndex: 2, position: new Position(1, 1) }, false, false, null);
        assert.ok(findMatch);
        assert.strictEqual(findMatch.match.range.startLineNumber, 1);
        assert.strictEqual(findMatch.match.range.startColumn, 5);
        findMatch = notebookModel.findNextMatch("d", { cellIndex: 3, position: new Position(1, 1) }, false, false, null);
        assert.ok(findMatch);
        assert.strictEqual(findMatch.match.range.startLineNumber, 1);
        assert.strictEqual(findMatch.match.range.startColumn, 5);
        findMatch = notebookModel.findNextMatch("e", { cellIndex: 0, position: new Position(1, 1) }, false, false, null);
        assert.strictEqual(findMatch, null);
        findMatch = notebookModel.findNextMatch("var", { cellIndex: 0, position: new Position(1, 1) }, false, false, null);
        assert.ok(findMatch);
        assert.strictEqual(findMatch.match.range.startLineNumber, 1);
        assert.strictEqual(findMatch.match.range.startColumn, 1);
        findMatch = notebookModel.findNextMatch("var", { cellIndex: 0, position: new Position(1, 5) }, false, false, null);
        assert.ok(findMatch);
        assert.strictEqual(findMatch.match.range.startLineNumber, 1);
        assert.strictEqual(findMatch.match.range.startColumn, 12);
        findMatch = notebookModel.findNextMatch("a", { cellIndex: 0, position: new Position(1, 10) }, false, false, null);
        assert.ok(findMatch);
        assert.strictEqual(findMatch.match.range.startLineNumber, 1);
        assert.strictEqual(findMatch.match.range.startColumn, 13);
        findMatch = notebookModel.findNextMatch("var", { cellIndex: 0, position: new Position(1, 20) }, false, false, null);
        assert.ok(findMatch);
        assert.strictEqual(findMatch.match.range.startLineNumber, 1);
        assert.strictEqual(findMatch.match.range.startColumn, 1);
      }
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay90ZXN0L2Jyb3dzZXIvbm90ZWJvb2tUZXh0TW9kZWwudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBNaW1lcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21pbWUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuaW1wb3J0IHsgSVVuZG9SZWRvU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuZG9SZWRvL2NvbW1vbi91bmRvUmVkby5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va1RleHRNb2RlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi9tb2RlbC9ub3RlYm9va1RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBDZWxsRWRpdFR5cGUsIENlbGxLaW5kLCBJQ2VsbEVkaXRPcGVyYXRpb24sIE1PVkVfQ1VSU09SXzFfTElORV9DT01NQU5ELCBOb3RlYm9va1RleHRNb2RlbENoYW5nZWRFdmVudCwgTm90ZWJvb2tUZXh0TW9kZWxXaWxsQWRkUmVtb3ZlRXZlbnQsIFNlbGVjdGlvblN0YXRlVHlwZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBzZXR1cEluc3RhbnRpYXRpb25TZXJ2aWNlLCBUZXN0Q2VsbCwgdmFsdWVCeXRlc0Zyb21TdHJpbmcsIHdpdGhUZXN0Tm90ZWJvb2sgfSBmcm9tICcuL3Rlc3ROb3RlYm9va0VkaXRvci5qcyc7XG5cbnN1aXRlKCdOb3RlYm9va1RleHRNb2RlbCcsICgpID0+IHtcblx0bGV0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRsZXQgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHN1aXRlU2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc2V0dXBJbnN0YW50aWF0aW9uU2VydmljZShkaXNwb3NhYmxlcyk7XG5cdFx0bGFuZ3VhZ2VTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMYW5ndWFnZVNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnNweShJVW5kb1JlZG9TZXJ2aWNlLCAncHVzaEVsZW1lbnQnKTtcblx0fSk7XG5cblx0c3VpdGVUZWFyZG93bigoKSA9PiBkaXNwb3NhYmxlcy5kaXNwb3NlKCkpO1xuXG5cdHRlc3QoJ2luc2VydCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYyA9IDM7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBkID0gNDsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRcdF0sXG5cdFx0XHQoZWRpdG9yLCBfdmlld01vZGVsLCBkcykgPT4ge1xuXHRcdFx0XHRjb25zdCB0ZXh0TW9kZWwgPSBlZGl0b3IudGV4dE1vZGVsO1xuXHRcdFx0XHR0ZXh0TW9kZWwuYXBwbHlFZGl0cyhbXG5cdFx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsIGluZGV4OiAxLCBjb3VudDogMCwgY2VsbHM6IFtkcy5hZGQobmV3IFRlc3RDZWxsKHRleHRNb2RlbC52aWV3VHlwZSwgNSwgJ3ZhciBlID0gNTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCBsYW5ndWFnZVNlcnZpY2UpKV0gfSxcblx0XHRcdFx0XHR7IGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUmVwbGFjZSwgaW5kZXg6IDMsIGNvdW50OiAwLCBjZWxsczogW2RzLmFkZChuZXcgVGVzdENlbGwodGV4dE1vZGVsLnZpZXdUeXBlLCA2LCAndmFyIGYgPSA2OycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIGxhbmd1YWdlU2VydmljZSkpXSB9LFxuXHRcdFx0XHRdLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dE1vZGVsLmNlbGxzLmxlbmd0aCwgNik7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRNb2RlbC5jZWxsc1sxXS5nZXRWYWx1ZSgpLCAndmFyIGUgPSA1OycpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dE1vZGVsLmNlbGxzWzRdLmdldFZhbHVlKCksICd2YXIgZiA9IDY7Jyk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGlwbGUgaW5zZXJ0cyBhdCBzYW1lIHBvc2l0aW9uJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsndmFyIGEgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDI7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBjID0gMzsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGQgPSA0OycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIF92aWV3TW9kZWwsIGRzKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHRleHRNb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cdFx0XHRcdHRleHRNb2RlbC5hcHBseUVkaXRzKFtcblx0XHRcdFx0XHR7IGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUmVwbGFjZSwgaW5kZXg6IDEsIGNvdW50OiAwLCBjZWxsczogW2RzLmFkZChuZXcgVGVzdENlbGwodGV4dE1vZGVsLnZpZXdUeXBlLCA1LCAndmFyIGUgPSA1OycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIGxhbmd1YWdlU2VydmljZSkpXSB9LFxuXHRcdFx0XHRcdHsgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLCBpbmRleDogMSwgY291bnQ6IDAsIGNlbGxzOiBbZHMuYWRkKG5ldyBUZXN0Q2VsbCh0ZXh0TW9kZWwudmlld1R5cGUsIDYsICd2YXIgZiA9IDY7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwgbGFuZ3VhZ2VTZXJ2aWNlKSldIH0sXG5cdFx0XHRcdF0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHMubGVuZ3RoLCA2KTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dE1vZGVsLmNlbGxzWzFdLmdldFZhbHVlKCksICd2YXIgZSA9IDU7Jyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHNbMl0uZ2V0VmFsdWUoKSwgJ3ZhciBmID0gNjsnKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0Wyd2YXIgYSA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGMgPSAzOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgZCA9IDQ7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0KGVkaXRvcikgPT4ge1xuXHRcdFx0XHRjb25zdCB0ZXh0TW9kZWwgPSBlZGl0b3IudGV4dE1vZGVsO1xuXHRcdFx0XHR0ZXh0TW9kZWwuYXBwbHlFZGl0cyhbXG5cdFx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsIGluZGV4OiAxLCBjb3VudDogMSwgY2VsbHM6IFtdIH0sXG5cdFx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsIGluZGV4OiAzLCBjb3VudDogMSwgY2VsbHM6IFtdIH0sXG5cdFx0XHRcdF0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHNbMF0uZ2V0VmFsdWUoKSwgJ3ZhciBhID0gMTsnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRNb2RlbC5jZWxsc1sxXS5nZXRWYWx1ZSgpLCAndmFyIGMgPSAzOycpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZSArIGluc2VydCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYyA9IDM7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBkID0gNDsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRcdF0sXG5cdFx0XHQoZWRpdG9yLCBfdmlld01vZGVsLCBkcykgPT4ge1xuXHRcdFx0XHRjb25zdCB0ZXh0TW9kZWwgPSBlZGl0b3IudGV4dE1vZGVsO1xuXHRcdFx0XHR0ZXh0TW9kZWwuYXBwbHlFZGl0cyhbXG5cdFx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsIGluZGV4OiAxLCBjb3VudDogMSwgY2VsbHM6IFtdIH0sXG5cdFx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsIGluZGV4OiAzLCBjb3VudDogMCwgY2VsbHM6IFtkcy5hZGQobmV3IFRlc3RDZWxsKHRleHRNb2RlbC52aWV3VHlwZSwgNSwgJ3ZhciBlID0gNTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCBsYW5ndWFnZVNlcnZpY2UpKV0gfSxcblx0XHRcdFx0XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHMubGVuZ3RoLCA0KTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dE1vZGVsLmNlbGxzWzBdLmdldFZhbHVlKCksICd2YXIgYSA9IDE7Jyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHNbMl0uZ2V0VmFsdWUoKSwgJ3ZhciBlID0gNTsnKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGUgKyBpbnNlcnQgYXQgc2FtZSBwb3NpdGlvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYyA9IDM7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBkID0gNDsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRcdF0sXG5cdFx0XHQoZWRpdG9yLCBfdmlld01vZGVsLCBkcykgPT4ge1xuXHRcdFx0XHRjb25zdCB0ZXh0TW9kZWwgPSBlZGl0b3IudGV4dE1vZGVsO1xuXHRcdFx0XHR0ZXh0TW9kZWwuYXBwbHlFZGl0cyhbXG5cdFx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsIGluZGV4OiAxLCBjb3VudDogMSwgY2VsbHM6IFtdIH0sXG5cdFx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsIGluZGV4OiAxLCBjb3VudDogMCwgY2VsbHM6IFtkcy5hZGQobmV3IFRlc3RDZWxsKHRleHRNb2RlbC52aWV3VHlwZSwgNSwgJ3ZhciBlID0gNTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCBsYW5ndWFnZVNlcnZpY2UpKV0gfSxcblx0XHRcdFx0XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRNb2RlbC5jZWxscy5sZW5ndGgsIDQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dE1vZGVsLmNlbGxzWzBdLmdldFZhbHVlKCksICd2YXIgYSA9IDE7Jyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHNbMV0uZ2V0VmFsdWUoKSwgJ3ZhciBlID0gNTsnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRNb2RlbC5jZWxsc1syXS5nZXRWYWx1ZSgpLCAndmFyIGMgPSAzOycpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJyhyZXBsYWNlKSBkZWxldGUgKyBpbnNlcnQgYXQgc2FtZSBwb3NpdGlvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYyA9IDM7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBkID0gNDsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRcdF0sXG5cdFx0XHQoZWRpdG9yLCBfdmlld01vZGVsLCBkcykgPT4ge1xuXHRcdFx0XHRjb25zdCB0ZXh0TW9kZWwgPSBlZGl0b3IudGV4dE1vZGVsO1xuXHRcdFx0XHR0ZXh0TW9kZWwuYXBwbHlFZGl0cyhbXG5cdFx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsIGluZGV4OiAxLCBjb3VudDogMSwgY2VsbHM6IFtkcy5hZGQobmV3IFRlc3RDZWxsKHRleHRNb2RlbC52aWV3VHlwZSwgNSwgJ3ZhciBlID0gNTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCBsYW5ndWFnZVNlcnZpY2UpKV0gfSxcblx0XHRcdFx0XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRNb2RlbC5jZWxscy5sZW5ndGgsIDQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dE1vZGVsLmNlbGxzWzBdLmdldFZhbHVlKCksICd2YXIgYSA9IDE7Jyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHNbMV0uZ2V0VmFsdWUoKSwgJ3ZhciBlID0gNTsnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRNb2RlbC5jZWxsc1syXS5nZXRWYWx1ZSgpLCAndmFyIGMgPSAzOycpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ291dHB1dCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRdLFxuXHRcdFx0KGVkaXRvcikgPT4ge1xuXHRcdFx0XHRjb25zdCB0ZXh0TW9kZWwgPSBlZGl0b3IudGV4dE1vZGVsO1xuXG5cdFx0XHRcdC8vIGludmFsaWQgaW5kZXggMVxuXHRcdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0XHR0ZXh0TW9kZWwuYXBwbHlFZGl0cyhbe1xuXHRcdFx0XHRcdFx0aW5kZXg6IE51bWJlci5NQVhfVkFMVUUsXG5cdFx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dCxcblx0XHRcdFx0XHRcdG91dHB1dHM6IFtdXG5cdFx0XHRcdFx0fV0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHQvLyBpbnZhbGlkIGluZGV4IDJcblx0XHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRcdFx0dGV4dE1vZGVsLmFwcGx5RWRpdHMoW3tcblx0XHRcdFx0XHRcdGluZGV4OiAtMSxcblx0XHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuT3V0cHV0LFxuXHRcdFx0XHRcdFx0b3V0cHV0czogW11cblx0XHRcdFx0XHR9XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRleHRNb2RlbC5hcHBseUVkaXRzKFt7XG5cdFx0XHRcdFx0aW5kZXg6IDAsXG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXQsXG5cdFx0XHRcdFx0b3V0cHV0czogW3tcblx0XHRcdFx0XHRcdG91dHB1dElkOiAnc29tZUlkJyxcblx0XHRcdFx0XHRcdG91dHB1dHM6IFt7IG1pbWU6IE1pbWVzLm1hcmtkb3duLCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygnX0hlbGxvXycpIH1dXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fV0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHMubGVuZ3RoLCAxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRNb2RlbC5jZWxsc1swXS5vdXRwdXRzLmxlbmd0aCwgMSk7XG5cblx0XHRcdFx0Ly8gYXBwZW5kXG5cdFx0XHRcdHRleHRNb2RlbC5hcHBseUVkaXRzKFt7XG5cdFx0XHRcdFx0aW5kZXg6IDAsXG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXQsXG5cdFx0XHRcdFx0YXBwZW5kOiB0cnVlLFxuXHRcdFx0XHRcdG91dHB1dHM6IFt7XG5cdFx0XHRcdFx0XHRvdXRwdXRJZDogJ3NvbWVJZDInLFxuXHRcdFx0XHRcdFx0b3V0cHV0czogW3sgbWltZTogTWltZXMubWFya2Rvd24sIGRhdGE6IHZhbHVlQnl0ZXNGcm9tU3RyaW5nKCdfSGVsbG8yXycpIH1dXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fV0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHMubGVuZ3RoLCAxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRNb2RlbC5jZWxsc1swXS5vdXRwdXRzLmxlbmd0aCwgMik7XG5cdFx0XHRcdGxldCBbZmlyc3QsIHNlY29uZF0gPSB0ZXh0TW9kZWwuY2VsbHNbMF0ub3V0cHV0cztcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0Lm91dHB1dElkLCAnc29tZUlkJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWNvbmQub3V0cHV0SWQsICdzb21lSWQyJyk7XG5cblx0XHRcdFx0Ly8gcmVwbGFjZSBhbGxcblx0XHRcdFx0dGV4dE1vZGVsLmFwcGx5RWRpdHMoW3tcblx0XHRcdFx0XHRpbmRleDogMCxcblx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dCxcblx0XHRcdFx0XHRvdXRwdXRzOiBbe1xuXHRcdFx0XHRcdFx0b3V0cHV0SWQ6ICdzb21lSWQzJyxcblx0XHRcdFx0XHRcdG91dHB1dHM6IFt7IG1pbWU6IE1pbWVzLnRleHQsIGRhdGE6IHZhbHVlQnl0ZXNGcm9tU3RyaW5nKCdMYXN0LCByZXBsYWNlZCBvdXRwdXQnKSB9XVxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH1dLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dE1vZGVsLmNlbGxzLmxlbmd0aCwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHNbMF0ub3V0cHV0cy5sZW5ndGgsIDEpO1xuXHRcdFx0XHRbZmlyc3RdID0gdGV4dE1vZGVsLmNlbGxzWzBdLm91dHB1dHM7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5vdXRwdXRJZCwgJ3NvbWVJZDMnKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtdWx0aXBsZSBhcHBlbmQgb3V0cHV0IGluIG9uZSBwb3NpdGlvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRdLFxuXHRcdFx0KGVkaXRvcikgPT4ge1xuXHRcdFx0XHRjb25zdCB0ZXh0TW9kZWwgPSBlZGl0b3IudGV4dE1vZGVsO1xuXG5cdFx0XHRcdC8vIGFwcGVuZFxuXHRcdFx0XHR0ZXh0TW9kZWwuYXBwbHlFZGl0cyhbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0aW5kZXg6IDAsXG5cdFx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dCxcblx0XHRcdFx0XHRcdGFwcGVuZDogdHJ1ZSxcblx0XHRcdFx0XHRcdG91dHB1dHM6IFt7XG5cdFx0XHRcdFx0XHRcdG91dHB1dElkOiAnYXBwZW5kMScsXG5cdFx0XHRcdFx0XHRcdG91dHB1dHM6IFt7IG1pbWU6IE1pbWVzLm1hcmtkb3duLCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygnYXBwZW5kIDEnKSB9XVxuXHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGluZGV4OiAwLFxuXHRcdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXQsXG5cdFx0XHRcdFx0XHRhcHBlbmQ6IHRydWUsXG5cdFx0XHRcdFx0XHRvdXRwdXRzOiBbe1xuXHRcdFx0XHRcdFx0XHRvdXRwdXRJZDogJ2FwcGVuZDInLFxuXHRcdFx0XHRcdFx0XHRvdXRwdXRzOiBbeyBtaW1lOiBNaW1lcy5tYXJrZG93biwgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJ2FwcGVuZCAyJykgfV1cblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dE1vZGVsLmNlbGxzLmxlbmd0aCwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHNbMF0ub3V0cHV0cy5sZW5ndGgsIDIpO1xuXHRcdFx0XHRjb25zdCBbZmlyc3QsIHNlY29uZF0gPSB0ZXh0TW9kZWwuY2VsbHNbMF0ub3V0cHV0cztcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0Lm91dHB1dElkLCAnYXBwZW5kMScpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vjb25kLm91dHB1dElkLCAnYXBwZW5kMicpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FwcGVuZCB0byBvdXRwdXQgY3JlYXRlZCBpbiBzYW1lIGJhdGNoJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsndmFyIGEgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdF0sXG5cdFx0XHQoZWRpdG9yKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHRleHRNb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cblx0XHRcdFx0dGV4dE1vZGVsLmFwcGx5RWRpdHMoW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGluZGV4OiAwLFxuXHRcdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXQsXG5cdFx0XHRcdFx0XHRhcHBlbmQ6IHRydWUsXG5cdFx0XHRcdFx0XHRvdXRwdXRzOiBbe1xuXHRcdFx0XHRcdFx0XHRvdXRwdXRJZDogJ2FwcGVuZDEnLFxuXHRcdFx0XHRcdFx0XHRvdXRwdXRzOiBbeyBtaW1lOiBNaW1lcy5tYXJrZG93biwgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJ2FwcGVuZCAxJykgfV1cblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dEl0ZW1zLFxuXHRcdFx0XHRcdFx0YXBwZW5kOiB0cnVlLFxuXHRcdFx0XHRcdFx0b3V0cHV0SWQ6ICdhcHBlbmQxJyxcblx0XHRcdFx0XHRcdGl0ZW1zOiBbe1xuXHRcdFx0XHRcdFx0XHRtaW1lOiBNaW1lcy5tYXJrZG93biwgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJ2FwcGVuZCAyJylcblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dE1vZGVsLmNlbGxzLmxlbmd0aCwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHNbMF0ub3V0cHV0cy5sZW5ndGgsIDEsICdoYXMgMSBvdXRwdXQnKTtcblx0XHRcdFx0Y29uc3QgW2ZpcnN0XSA9IHRleHRNb2RlbC5jZWxsc1swXS5vdXRwdXRzO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3Qub3V0cHV0SWQsICdhcHBlbmQxJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5vdXRwdXRzLmxlbmd0aCwgMiwgJ2hhcyAyIGl0ZW1zJyk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0Y29uc3Qgc3RkT3V0TWltZSA9ICdhcHBsaWNhdGlvbi92bmQuY29kZS5ub3RlYm9vay5zdGRvdXQnO1xuXHRjb25zdCBzdGRFcnJNaW1lID0gJ2FwcGxpY2F0aW9uL3ZuZC5jb2RlLm5vdGVib29rLnN0ZGVycic7XG5cblx0dGVzdCgnYXBwZW5kaW5nIHN0cmVhbWluZyBvdXRwdXRzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsndmFyIGEgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdF0sXG5cdFx0XHQoZWRpdG9yKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHRleHRNb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cblx0XHRcdFx0dGV4dE1vZGVsLmFwcGx5RWRpdHMoW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGluZGV4OiAwLFxuXHRcdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXQsXG5cdFx0XHRcdFx0XHRhcHBlbmQ6IHRydWUsXG5cdFx0XHRcdFx0XHRvdXRwdXRzOiBbe1xuXHRcdFx0XHRcdFx0XHRvdXRwdXRJZDogJ2FwcGVuZDEnLFxuXHRcdFx0XHRcdFx0XHRvdXRwdXRzOiBbeyBtaW1lOiBzdGRPdXRNaW1lLCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygnYXBwZW5kIDEnKSB9XVxuXHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHRcdGNvbnN0IFtvdXRwdXRdID0gdGV4dE1vZGVsLmNlbGxzWzBdLm91dHB1dHM7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChvdXRwdXQudmVyc2lvbklkLCAwLCAnaW5pdGlhbCBvdXRwdXQgdmVyc2lvbiBzaG91bGQgYmUgMCcpO1xuXG5cdFx0XHRcdHRleHRNb2RlbC5hcHBseUVkaXRzKFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dEl0ZW1zLFxuXHRcdFx0XHRcdFx0YXBwZW5kOiB0cnVlLFxuXHRcdFx0XHRcdFx0b3V0cHV0SWQ6ICdhcHBlbmQxJyxcblx0XHRcdFx0XHRcdGl0ZW1zOiBbXG5cdFx0XHRcdFx0XHRcdHsgbWltZTogc3RkT3V0TWltZSwgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJ2FwcGVuZCAyJykgfSxcblx0XHRcdFx0XHRcdFx0eyBtaW1lOiBzdGRPdXRNaW1lLCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygnYXBwZW5kIDMnKSB9XG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fV0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3V0cHV0LnZlcnNpb25JZCwgMSwgJ3ZlcnNpb24gc2hvdWxkIGJ1bXAgcGVyIGFwcGVuZCcpO1xuXG5cdFx0XHRcdHRleHRNb2RlbC5hcHBseUVkaXRzKFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dEl0ZW1zLFxuXHRcdFx0XHRcdFx0YXBwZW5kOiB0cnVlLFxuXHRcdFx0XHRcdFx0b3V0cHV0SWQ6ICdhcHBlbmQxJyxcblx0XHRcdFx0XHRcdGl0ZW1zOiBbXG5cdFx0XHRcdFx0XHRcdHsgbWltZTogc3RkT3V0TWltZSwgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJ2FwcGVuZCA0JykgfSxcblx0XHRcdFx0XHRcdFx0eyBtaW1lOiBzdGRPdXRNaW1lLCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygnYXBwZW5kIDUnKSB9XG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fV0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3V0cHV0LnZlcnNpb25JZCwgMiwgJ3ZlcnNpb24gc2hvdWxkIGJ1bXAgcGVyIGFwcGVuZCcpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHMubGVuZ3RoLCAxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRNb2RlbC5jZWxsc1swXS5vdXRwdXRzLmxlbmd0aCwgMSwgJ2hhcyAxIG91dHB1dCcpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3V0cHV0Lm91dHB1dElkLCAnYXBwZW5kMScpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3V0cHV0Lm91dHB1dHMubGVuZ3RoLCAxLCAnb3V0cHV0cyBhcmUgY29tcHJlc3NlZCcpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3V0cHV0Lm91dHB1dHNbMF0uZGF0YS50b1N0cmluZygpLCAnYXBwZW5kIDFhcHBlbmQgMmFwcGVuZCAzYXBwZW5kIDRhcHBlbmQgNScpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3V0cHV0LmFwcGVuZGVkU2luY2VWZXJzaW9uKDAsIHN0ZE91dE1pbWUpPy50b1N0cmluZygpLCAnYXBwZW5kIDJhcHBlbmQgM2FwcGVuZCA0YXBwZW5kIDUnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG91dHB1dC5hcHBlbmRlZFNpbmNlVmVyc2lvbigxLCBzdGRPdXRNaW1lKT8udG9TdHJpbmcoKSwgJ2FwcGVuZCA0YXBwZW5kIDUnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG91dHB1dC5hcHBlbmRlZFNpbmNlVmVyc2lvbigyLCBzdGRPdXRNaW1lKSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG91dHB1dC5hcHBlbmRlZFNpbmNlVmVyc2lvbigyLCBzdGRFcnJNaW1lKSwgdW5kZWZpbmVkKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXBsYWNpbmcgc3RyZWFtaW5nIG91dHB1dHMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0Wyd2YXIgYSA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IpID0+IHtcblx0XHRcdFx0Y29uc3QgdGV4dE1vZGVsID0gZWRpdG9yLnRleHRNb2RlbDtcblxuXHRcdFx0XHR0ZXh0TW9kZWwuYXBwbHlFZGl0cyhbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0aW5kZXg6IDAsXG5cdFx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dCxcblx0XHRcdFx0XHRcdGFwcGVuZDogdHJ1ZSxcblx0XHRcdFx0XHRcdG91dHB1dHM6IFt7XG5cdFx0XHRcdFx0XHRcdG91dHB1dElkOiAnYXBwZW5kMScsXG5cdFx0XHRcdFx0XHRcdG91dHB1dHM6IFt7IG1pbWU6IHN0ZE91dE1pbWUsIGRhdGE6IHZhbHVlQnl0ZXNGcm9tU3RyaW5nKCdhcHBlbmQgMScpIH1dXG5cdFx0XHRcdFx0XHR9XVxuXHRcdFx0XHRcdH1dLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcblx0XHRcdFx0Y29uc3QgW291dHB1dF0gPSB0ZXh0TW9kZWwuY2VsbHNbMF0ub3V0cHV0cztcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG91dHB1dC52ZXJzaW9uSWQsIDAsICdpbml0aWFsIG91dHB1dCB2ZXJzaW9uIHNob3VsZCBiZSAwJyk7XG5cblx0XHRcdFx0dGV4dE1vZGVsLmFwcGx5RWRpdHMoW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuT3V0cHV0SXRlbXMsXG5cdFx0XHRcdFx0XHRhcHBlbmQ6IHRydWUsXG5cdFx0XHRcdFx0XHRvdXRwdXRJZDogJ2FwcGVuZDEnLFxuXHRcdFx0XHRcdFx0aXRlbXM6IFt7XG5cdFx0XHRcdFx0XHRcdG1pbWU6IHN0ZE91dE1pbWUsIGRhdGE6IHZhbHVlQnl0ZXNGcm9tU3RyaW5nKCdhcHBlbmQgMicpXG5cdFx0XHRcdFx0XHR9XVxuXHRcdFx0XHRcdH1dLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG91dHB1dC52ZXJzaW9uSWQsIDEsICd2ZXJzaW9uIHNob3VsZCBidW1wIHBlciBhcHBlbmQnKTtcblxuXHRcdFx0XHR0ZXh0TW9kZWwuYXBwbHlFZGl0cyhbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXRJdGVtcyxcblx0XHRcdFx0XHRcdGFwcGVuZDogZmFsc2UsXG5cdFx0XHRcdFx0XHRvdXRwdXRJZDogJ2FwcGVuZDEnLFxuXHRcdFx0XHRcdFx0aXRlbXM6IFt7XG5cdFx0XHRcdFx0XHRcdG1pbWU6IHN0ZE91dE1pbWUsIGRhdGE6IHZhbHVlQnl0ZXNGcm9tU3RyaW5nKCdyZXBsYWNlIDMnKVxuXHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChvdXRwdXQudmVyc2lvbklkLCAyLCAndmVyc2lvbiBzaG91bGQgYnVtcCBwZXIgcmVwbGFjZScpO1xuXG5cdFx0XHRcdHRleHRNb2RlbC5hcHBseUVkaXRzKFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dEl0ZW1zLFxuXHRcdFx0XHRcdFx0YXBwZW5kOiB0cnVlLFxuXHRcdFx0XHRcdFx0b3V0cHV0SWQ6ICdhcHBlbmQxJyxcblx0XHRcdFx0XHRcdGl0ZW1zOiBbe1xuXHRcdFx0XHRcdFx0XHRtaW1lOiBzdGRPdXRNaW1lLCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygnYXBwZW5kIDQnKVxuXHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChvdXRwdXQudmVyc2lvbklkLCAzLCAndmVyc2lvbiBzaG91bGQgYnVtcCBwZXIgYXBwZW5kJyk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG91dHB1dC5vdXRwdXRzWzBdLmRhdGEudG9TdHJpbmcoKSwgJ3JlcGxhY2UgM2FwcGVuZCA0Jyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChvdXRwdXQuYXBwZW5kZWRTaW5jZVZlcnNpb24oMCwgc3RkT3V0TWltZSksIHVuZGVmaW5lZCxcblx0XHRcdFx0XHQncmVwbGFjaW5nIG91dHB1dCBzaG91bGQgY2xlYXIgb3V0IHByZXZpb3VzIHZlcnNpb25lZCBvdXRwdXQgYnVmZmVycycpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3V0cHV0LmFwcGVuZGVkU2luY2VWZXJzaW9uKDEsIHN0ZE91dE1pbWUpLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0J3JlcGxhY2luZyBvdXRwdXQgc2hvdWxkIGNsZWFyIG91dCBwcmV2aW91cyB2ZXJzaW9uZWQgb3V0cHV0IGJ1ZmZlcnMnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG91dHB1dC5hcHBlbmRlZFNpbmNlVmVyc2lvbigyLCBzdGRPdXRNaW1lKT8udG9TdHJpbmcoKSwgJ2FwcGVuZCA0Jyk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnYXBwZW5kaW5nIHN0cmVhbWluZyBvdXRwdXRzIHdpdGggbW92ZSBjdXJzb3IgY29tcHJlc3Npb24nLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRdLFxuXHRcdFx0KGVkaXRvcikgPT4ge1xuXHRcdFx0XHRjb25zdCB0ZXh0TW9kZWwgPSBlZGl0b3IudGV4dE1vZGVsO1xuXG5cdFx0XHRcdHRleHRNb2RlbC5hcHBseUVkaXRzKFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRpbmRleDogMCxcblx0XHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuT3V0cHV0LFxuXHRcdFx0XHRcdFx0YXBwZW5kOiB0cnVlLFxuXHRcdFx0XHRcdFx0b3V0cHV0czogW3tcblx0XHRcdFx0XHRcdFx0b3V0cHV0SWQ6ICdhcHBlbmQxJyxcblx0XHRcdFx0XHRcdFx0b3V0cHV0czogW1xuXHRcdFx0XHRcdFx0XHRcdHsgbWltZTogc3RkT3V0TWltZSwgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJ2FwcGVuZCAxJykgfSxcblx0XHRcdFx0XHRcdFx0XHR7IG1pbWU6IHN0ZE91dE1pbWUsIGRhdGE6IHZhbHVlQnl0ZXNGcm9tU3RyaW5nKCdcXG5hcHBlbmQgMScpIH1dXG5cdFx0XHRcdFx0XHR9XVxuXHRcdFx0XHRcdH1dLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcblx0XHRcdFx0Y29uc3QgW291dHB1dF0gPSB0ZXh0TW9kZWwuY2VsbHNbMF0ub3V0cHV0cztcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG91dHB1dC52ZXJzaW9uSWQsIDAsICdpbml0aWFsIG91dHB1dCB2ZXJzaW9uIHNob3VsZCBiZSAwJyk7XG5cblx0XHRcdFx0dGV4dE1vZGVsLmFwcGx5RWRpdHMoW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuT3V0cHV0SXRlbXMsXG5cdFx0XHRcdFx0XHRhcHBlbmQ6IHRydWUsXG5cdFx0XHRcdFx0XHRvdXRwdXRJZDogJ2FwcGVuZDEnLFxuXHRcdFx0XHRcdFx0aXRlbXM6IFt7XG5cdFx0XHRcdFx0XHRcdG1pbWU6IHN0ZE91dE1pbWUsIGRhdGE6IHZhbHVlQnl0ZXNGcm9tU3RyaW5nKE1PVkVfQ1VSU09SXzFfTElORV9DT01NQU5EICsgJ1xcbmFwcGVuZCAyJylcblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fV0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3V0cHV0LnZlcnNpb25JZCwgMSwgJ3ZlcnNpb24gc2hvdWxkIGJ1bXAgcGVyIGFwcGVuZCcpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChvdXRwdXQub3V0cHV0c1swXS5kYXRhLnRvU3RyaW5nKCksICdhcHBlbmQgMVxcbmFwcGVuZCAyJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChvdXRwdXQuYXBwZW5kZWRTaW5jZVZlcnNpb24oMCwgc3RkT3V0TWltZSksIHVuZGVmaW5lZCxcblx0XHRcdFx0XHQnY29tcHJlc3Npbmcgb3V0cHV0cyBzaG91bGQgY2xlYXIgb3V0IHByZXZpb3VzIHZlcnNpb25lZCBvdXRwdXQgYnVmZmVycycpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FwcGVuZGluZyBzdHJlYW1pbmcgb3V0cHV0cyB3aXRoIGNhcnJhaWdlIHJldHVybiBjb21wcmVzc2lvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsndmFyIGEgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdF0sXG5cdFx0XHQoZWRpdG9yKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHRleHRNb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cblx0XHRcdFx0dGV4dE1vZGVsLmFwcGx5RWRpdHMoW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGluZGV4OiAwLFxuXHRcdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXQsXG5cdFx0XHRcdFx0XHRhcHBlbmQ6IHRydWUsXG5cdFx0XHRcdFx0XHRvdXRwdXRzOiBbe1xuXHRcdFx0XHRcdFx0XHRvdXRwdXRJZDogJ2FwcGVuZDEnLFxuXHRcdFx0XHRcdFx0XHRvdXRwdXRzOiBbXG5cdFx0XHRcdFx0XHRcdFx0eyBtaW1lOiBzdGRPdXRNaW1lLCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygnYXBwZW5kIDEnKSB9LFxuXHRcdFx0XHRcdFx0XHRcdHsgbWltZTogc3RkT3V0TWltZSwgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJ1xcbmFwcGVuZCAxJykgfV1cblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fV0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdFx0XHRjb25zdCBbb3V0cHV0XSA9IHRleHRNb2RlbC5jZWxsc1swXS5vdXRwdXRzO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3V0cHV0LnZlcnNpb25JZCwgMCwgJ2luaXRpYWwgb3V0cHV0IHZlcnNpb24gc2hvdWxkIGJlIDAnKTtcblxuXHRcdFx0XHR0ZXh0TW9kZWwuYXBwbHlFZGl0cyhbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXRJdGVtcyxcblx0XHRcdFx0XHRcdGFwcGVuZDogdHJ1ZSxcblx0XHRcdFx0XHRcdG91dHB1dElkOiAnYXBwZW5kMScsXG5cdFx0XHRcdFx0XHRpdGVtczogW3tcblx0XHRcdFx0XHRcdFx0bWltZTogc3RkT3V0TWltZSwgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJ1xccmFwcGVuZCAyJylcblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fV0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3V0cHV0LnZlcnNpb25JZCwgMSwgJ3ZlcnNpb24gc2hvdWxkIGJ1bXAgcGVyIGFwcGVuZCcpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChvdXRwdXQub3V0cHV0c1swXS5kYXRhLnRvU3RyaW5nKCksICdhcHBlbmQgMVxcbmFwcGVuZCAyJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChvdXRwdXQuYXBwZW5kZWRTaW5jZVZlcnNpb24oMCwgc3RkT3V0TWltZSksIHVuZGVmaW5lZCxcblx0XHRcdFx0XHQnY29tcHJlc3Npbmcgb3V0cHV0cyBzaG91bGQgY2xlYXIgb3V0IHByZXZpb3VzIHZlcnNpb25lZCBvdXRwdXQgYnVmZmVycycpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FwcGVuZGluZyBtdWx0aXBsZSBkaWZmZXJlbnQgbWltZSBzdHJlYW1pbmcgb3V0cHV0cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRdLFxuXHRcdFx0KGVkaXRvcikgPT4ge1xuXHRcdFx0XHRjb25zdCB0ZXh0TW9kZWwgPSBlZGl0b3IudGV4dE1vZGVsO1xuXG5cdFx0XHRcdHRleHRNb2RlbC5hcHBseUVkaXRzKFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRpbmRleDogMCxcblx0XHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuT3V0cHV0LFxuXHRcdFx0XHRcdFx0YXBwZW5kOiB0cnVlLFxuXHRcdFx0XHRcdFx0b3V0cHV0czogW3tcblx0XHRcdFx0XHRcdFx0b3V0cHV0SWQ6ICdhcHBlbmQxJyxcblx0XHRcdFx0XHRcdFx0b3V0cHV0czogW1xuXHRcdFx0XHRcdFx0XHRcdHsgbWltZTogc3RkT3V0TWltZSwgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJ3N0ZG91dCAxJykgfSxcblx0XHRcdFx0XHRcdFx0XHR7IG1pbWU6IHN0ZEVyck1pbWUsIGRhdGE6IHZhbHVlQnl0ZXNGcm9tU3RyaW5nKCdzdGRlcnIgMScpIH1cblx0XHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHRcdGNvbnN0IFtvdXRwdXRdID0gdGV4dE1vZGVsLmNlbGxzWzBdLm91dHB1dHM7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChvdXRwdXQudmVyc2lvbklkLCAwLCAnaW5pdGlhbCBvdXRwdXQgdmVyc2lvbiBzaG91bGQgYmUgMCcpO1xuXG5cdFx0XHRcdHRleHRNb2RlbC5hcHBseUVkaXRzKFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dEl0ZW1zLFxuXHRcdFx0XHRcdFx0YXBwZW5kOiB0cnVlLFxuXHRcdFx0XHRcdFx0b3V0cHV0SWQ6ICdhcHBlbmQxJyxcblx0XHRcdFx0XHRcdGl0ZW1zOiBbXG5cdFx0XHRcdFx0XHRcdHsgbWltZTogc3RkT3V0TWltZSwgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJ3N0ZG91dCAyJykgfSxcblx0XHRcdFx0XHRcdFx0eyBtaW1lOiBzdGRFcnJNaW1lLCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygnc3RkZXJyIDInKSB9XG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fV0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3V0cHV0LnZlcnNpb25JZCwgMSwgJ3ZlcnNpb24gc2hvdWxkIGJ1bXAgcGVyIHJlcGxhY2UnKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3V0cHV0LmFwcGVuZGVkU2luY2VWZXJzaW9uKDAsIHN0ZEVyck1pbWUpPy50b1N0cmluZygpLCAnc3RkZXJyIDInKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG91dHB1dC5hcHBlbmRlZFNpbmNlVmVyc2lvbigwLCBzdGRPdXRNaW1lKT8udG9TdHJpbmcoKSwgJ3N0ZG91dCAyJyk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnbWV0YWRhdGEnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0Wyd2YXIgYSA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IpID0+IHtcblx0XHRcdFx0Y29uc3QgdGV4dE1vZGVsID0gZWRpdG9yLnRleHRNb2RlbDtcblxuXHRcdFx0XHQvLyBpbnZhbGlkIGluZGV4IDFcblx0XHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRcdFx0dGV4dE1vZGVsLmFwcGx5RWRpdHMoW3tcblx0XHRcdFx0XHRcdGluZGV4OiBOdW1iZXIuTUFYX1ZBTFVFLFxuXHRcdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5NZXRhZGF0YSxcblx0XHRcdFx0XHRcdG1ldGFkYXRhOiB7fVxuXHRcdFx0XHRcdH1dLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Ly8gaW52YWxpZCBpbmRleCAyXG5cdFx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRcdHRleHRNb2RlbC5hcHBseUVkaXRzKFt7XG5cdFx0XHRcdFx0XHRpbmRleDogLTEsXG5cdFx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk1ldGFkYXRhLFxuXHRcdFx0XHRcdFx0bWV0YWRhdGE6IHt9XG5cdFx0XHRcdFx0fV0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0ZXh0TW9kZWwuYXBwbHlFZGl0cyhbe1xuXHRcdFx0XHRcdGluZGV4OiAwLFxuXHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuTWV0YWRhdGEsXG5cdFx0XHRcdFx0bWV0YWRhdGE6IHsgY3VzdG9tUHJvcGVydHk6IDE1IH0sXG5cdFx0XHRcdH1dLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcblxuXHRcdFx0XHR0ZXh0TW9kZWwuYXBwbHlFZGl0cyhbe1xuXHRcdFx0XHRcdGluZGV4OiAwLFxuXHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuTWV0YWRhdGEsXG5cdFx0XHRcdFx0bWV0YWRhdGE6IHt9LFxuXHRcdFx0XHR9XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRNb2RlbC5jZWxscy5sZW5ndGgsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dE1vZGVsLmNlbGxzWzBdLm1ldGFkYXRhLmN1c3RvbVByb3BlcnR5LCB1bmRlZmluZWQpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3BhcnRpYWwgbWV0YWRhdGEnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0Wyd2YXIgYSA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IpID0+IHtcblx0XHRcdFx0Y29uc3QgdGV4dE1vZGVsID0gZWRpdG9yLnRleHRNb2RlbDtcblxuXHRcdFx0XHR0ZXh0TW9kZWwuYXBwbHlFZGl0cyhbe1xuXHRcdFx0XHRcdGluZGV4OiAwLFxuXHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUGFydGlhbE1ldGFkYXRhLFxuXHRcdFx0XHRcdG1ldGFkYXRhOiB7IGN1c3RvbVByb3BlcnR5OiAxNSB9LFxuXHRcdFx0XHR9XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cblx0XHRcdFx0dGV4dE1vZGVsLmFwcGx5RWRpdHMoW3tcblx0XHRcdFx0XHRpbmRleDogMCxcblx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlBhcnRpYWxNZXRhZGF0YSxcblx0XHRcdFx0XHRtZXRhZGF0YToge30sXG5cdFx0XHRcdH1dLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dE1vZGVsLmNlbGxzLmxlbmd0aCwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHNbMF0ubWV0YWRhdGEuY3VzdG9tUHJvcGVydHksIDE1KTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtdWx0aXBsZSBpbnNlcnRzIGluIG9uZSBlZGl0JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsndmFyIGEgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgYiA9IDI7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBjID0gMzsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGQgPSA0OycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdFx0XSxcblx0XHRcdChlZGl0b3IsIF92aWV3TW9kZWwsIGRzKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHRleHRNb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cdFx0XHRcdGxldCBjaGFuZ2VFdmVudDogTm90ZWJvb2tUZXh0TW9kZWxDaGFuZ2VkRXZlbnQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGNvbnN0IGV2ZW50TGlzdGVuZXIgPSB0ZXh0TW9kZWwub25EaWRDaGFuZ2VDb250ZW50KGUgPT4ge1xuXHRcdFx0XHRcdGNoYW5nZUV2ZW50ID0gZTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGNvbnN0IHdpbGxDaGFuZ2VFdmVudHM6IE5vdGVib29rVGV4dE1vZGVsV2lsbEFkZFJlbW92ZUV2ZW50W10gPSBbXTtcblx0XHRcdFx0Y29uc3Qgd2lsbENoYW5nZUxpc3RlbmVyID0gdGV4dE1vZGVsLm9uV2lsbEFkZFJlbW92ZUNlbGxzKGUgPT4ge1xuXHRcdFx0XHRcdHdpbGxDaGFuZ2VFdmVudHMucHVzaChlKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGNvbnN0IHZlcnNpb24gPSB0ZXh0TW9kZWwudmVyc2lvbklkO1xuXG5cdFx0XHRcdHRleHRNb2RlbC5hcHBseUVkaXRzKFtcblx0XHRcdFx0XHR7IGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUmVwbGFjZSwgaW5kZXg6IDEsIGNvdW50OiAxLCBjZWxsczogW10gfSxcblx0XHRcdFx0XHR7IGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUmVwbGFjZSwgaW5kZXg6IDEsIGNvdW50OiAwLCBjZWxsczogW2RzLmFkZChuZXcgVGVzdENlbGwodGV4dE1vZGVsLnZpZXdUeXBlLCA1LCAndmFyIGUgPSA1OycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIGxhbmd1YWdlU2VydmljZSkpXSB9LFxuXHRcdFx0XHRdLCB0cnVlLCB1bmRlZmluZWQsICgpID0+ICh7IGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCwgZm9jdXM6IHsgc3RhcnQ6IDAsIGVuZDogMSB9LCBzZWxlY3Rpb25zOiBbeyBzdGFydDogMCwgZW5kOiAxIH1dIH0pLCB1bmRlZmluZWQsIHRydWUpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHMubGVuZ3RoLCA0KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRNb2RlbC5jZWxsc1swXS5nZXRWYWx1ZSgpLCAndmFyIGEgPSAxOycpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dE1vZGVsLmNlbGxzWzFdLmdldFZhbHVlKCksICd2YXIgZSA9IDU7Jyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHNbMl0uZ2V0VmFsdWUoKSwgJ3ZhciBjID0gMzsnKTtcblxuXHRcdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoY2hhbmdlRXZlbnQsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaGFuZ2VFdmVudCEucmF3RXZlbnRzLmxlbmd0aCwgMik7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2hhbmdlRXZlbnQhLmVuZFNlbGVjdGlvblN0YXRlPy5zZWxlY3Rpb25zLCBbeyBzdGFydDogMCwgZW5kOiAxIH1dKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdpbGxDaGFuZ2VFdmVudHMubGVuZ3RoLCAyKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRNb2RlbC52ZXJzaW9uSWQsIHZlcnNpb24gKyAxKTtcblx0XHRcdFx0ZXZlbnRMaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHRcdHdpbGxDaGFuZ2VMaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnaW5zZXJ0IGFuZCBtZXRhZGF0YSBjaGFuZ2UgaW4gb25lIGVkaXQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0Wyd2YXIgYSA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGMgPSAzOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgZCA9IDQ7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0KGVkaXRvcikgPT4ge1xuXHRcdFx0XHRjb25zdCB0ZXh0TW9kZWwgPSBlZGl0b3IudGV4dE1vZGVsO1xuXHRcdFx0XHRsZXQgY2hhbmdlRXZlbnQ6IE5vdGVib29rVGV4dE1vZGVsQ2hhbmdlZEV2ZW50IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRjb25zdCBldmVudExpc3RlbmVyID0gdGV4dE1vZGVsLm9uRGlkQ2hhbmdlQ29udGVudChlID0+IHtcblx0XHRcdFx0XHRjaGFuZ2VFdmVudCA9IGU7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRjb25zdCB3aWxsQ2hhbmdlRXZlbnRzOiBOb3RlYm9va1RleHRNb2RlbFdpbGxBZGRSZW1vdmVFdmVudFtdID0gW107XG5cdFx0XHRcdGNvbnN0IHdpbGxDaGFuZ2VMaXN0ZW5lciA9IHRleHRNb2RlbC5vbldpbGxBZGRSZW1vdmVDZWxscyhlID0+IHtcblx0XHRcdFx0XHR3aWxsQ2hhbmdlRXZlbnRzLnB1c2goZSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGNvbnN0IHZlcnNpb24gPSB0ZXh0TW9kZWwudmVyc2lvbklkO1xuXG5cdFx0XHRcdHRleHRNb2RlbC5hcHBseUVkaXRzKFtcblx0XHRcdFx0XHR7IGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUmVwbGFjZSwgaW5kZXg6IDEsIGNvdW50OiAxLCBjZWxsczogW10gfSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRpbmRleDogMCxcblx0XHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuTWV0YWRhdGEsXG5cdFx0XHRcdFx0XHRtZXRhZGF0YToge30sXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLCB0cnVlLCB1bmRlZmluZWQsICgpID0+ICh7IGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCwgZm9jdXM6IHsgc3RhcnQ6IDAsIGVuZDogMSB9LCBzZWxlY3Rpb25zOiBbeyBzdGFydDogMCwgZW5kOiAxIH1dIH0pLCB1bmRlZmluZWQsIHRydWUpO1xuXG5cdFx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChjaGFuZ2VFdmVudCwgdW5kZWZpbmVkKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNoYW5nZUV2ZW50IS5yYXdFdmVudHMubGVuZ3RoLCAyKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjaGFuZ2VFdmVudCEuZW5kU2VsZWN0aW9uU3RhdGU/LnNlbGVjdGlvbnMsIFt7IHN0YXJ0OiAwLCBlbmQ6IDEgfV0pO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod2lsbENoYW5nZUV2ZW50cy5sZW5ndGgsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dE1vZGVsLnZlcnNpb25JZCwgdmVyc2lvbiArIDEpO1xuXHRcdFx0XHRldmVudExpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0d2lsbENoYW5nZUxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXG5cdHRlc3QoJ1VwZGF0aW5nIGFwcGVuZGluZy91cGRhdGluZyBvdXRwdXQgaW4gTm90ZWJvb2tzIGRvZXMgbm90IHdvcmsgYXMgZXhwZWN0ZWQgIzExNzI3MycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFtcblx0XHRcdFsndmFyIGEgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdF0sIChlZGl0b3IpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLnRleHRNb2RlbDtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmNlbGxzLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuY2VsbHNbMF0ub3V0cHV0cy5sZW5ndGgsIDApO1xuXG5cdFx0XHRjb25zdCBzdWNjZXNzMSA9IG1vZGVsLmFwcGx5RWRpdHMoXG5cdFx0XHRcdFt7XG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXQsIGluZGV4OiAwLCBvdXRwdXRzOiBbXG5cdFx0XHRcdFx0XHR7IG91dHB1dElkOiAnb3V0MScsIG91dHB1dHM6IFt7IG1pbWU6ICdhcHBsaWNhdGlvbi94Lm5vdGVib29rLnN0cmVhbScsIGRhdGE6IFZTQnVmZmVyLndyYXAobmV3IFVpbnQ4QXJyYXkoWzFdKSkgfV0gfVxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0YXBwZW5kOiBmYWxzZVxuXHRcdFx0XHR9XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZmFsc2Vcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydC5vayhzdWNjZXNzMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuY2VsbHNbMF0ub3V0cHV0cy5sZW5ndGgsIDEpO1xuXG5cdFx0XHRjb25zdCBzdWNjZXNzMiA9IG1vZGVsLmFwcGx5RWRpdHMoXG5cdFx0XHRcdFt7XG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXQsIGluZGV4OiAwLCBvdXRwdXRzOiBbXG5cdFx0XHRcdFx0XHR7IG91dHB1dElkOiAnb3V0MicsIG91dHB1dHM6IFt7IG1pbWU6ICdhcHBsaWNhdGlvbi94Lm5vdGVib29rLnN0cmVhbScsIGRhdGE6IFZTQnVmZmVyLndyYXAobmV3IFVpbnQ4QXJyYXkoWzFdKSkgfV0gfVxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0YXBwZW5kOiB0cnVlXG5cdFx0XHRcdH1dLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmYWxzZVxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0Lm9rKHN1Y2Nlc3MyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5jZWxsc1swXS5vdXRwdXRzLmxlbmd0aCwgMik7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0NsZWFyaW5nIG91dHB1dCBvZiBhbiBlbXB0eSBub3RlYm9vayBtYWtlcyBpdCBkaXJ0eSAjMTE5NjA4JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soW1xuXHRcdFx0Wyd2YXIgYSA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0Wyd2YXIgYiA9IDI7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXG5cdFx0XSwgKGVkaXRvciwgXywgZHMpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLnRleHRNb2RlbDtcblxuXHRcdFx0bGV0IGV2ZW50OiBOb3RlYm9va1RleHRNb2RlbENoYW5nZWRFdmVudCB8IHVuZGVmaW5lZDtcblxuXHRcdFx0ZHMuYWRkKG1vZGVsLm9uRGlkQ2hhbmdlQ29udGVudChlID0+IHsgZXZlbnQgPSBlOyB9KSk7XG5cblx0XHRcdHtcblx0XHRcdFx0Ly8gMTogYWRkIG91cHV0IC0+IGV2ZW50XG5cdFx0XHRcdGNvbnN0IHN1Y2Nlc3MgPSBtb2RlbC5hcHBseUVkaXRzKFxuXHRcdFx0XHRcdFt7XG5cdFx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dCwgaW5kZXg6IDAsIG91dHB1dHM6IFtcblx0XHRcdFx0XHRcdFx0eyBvdXRwdXRJZDogJ291dDEnLCBvdXRwdXRzOiBbeyBtaW1lOiAnYXBwbGljYXRpb24veC5ub3RlYm9vay5zdHJlYW0nLCBkYXRhOiBWU0J1ZmZlci53cmFwKG5ldyBVaW50OEFycmF5KFsxXSkpIH1dIH1cblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRhcHBlbmQ6IGZhbHNlXG5cdFx0XHRcdFx0fV0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIGZhbHNlXG5cdFx0XHRcdCk7XG5cblx0XHRcdFx0YXNzZXJ0Lm9rKHN1Y2Nlc3MpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuY2VsbHNbMF0ub3V0cHV0cy5sZW5ndGgsIDEpO1xuXHRcdFx0XHRhc3NlcnQub2soZXZlbnQpO1xuXHRcdFx0fVxuXG5cdFx0XHR7XG5cdFx0XHRcdC8vIDI6IGNsZWFyIGFsbCBvdXRwdXQgdy8gb3V0cHV0IC0+IGV2ZW50XG5cdFx0XHRcdGV2ZW50ID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRjb25zdCBzdWNjZXNzID0gbW9kZWwuYXBwbHlFZGl0cyhcblx0XHRcdFx0XHRbe1xuXHRcdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXQsXG5cdFx0XHRcdFx0XHRpbmRleDogMCxcblx0XHRcdFx0XHRcdG91dHB1dHM6IFtdLFxuXHRcdFx0XHRcdFx0YXBwZW5kOiBmYWxzZVxuXHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuT3V0cHV0LFxuXHRcdFx0XHRcdFx0aW5kZXg6IDEsXG5cdFx0XHRcdFx0XHRvdXRwdXRzOiBbXSxcblx0XHRcdFx0XHRcdGFwcGVuZDogZmFsc2Vcblx0XHRcdFx0XHR9XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZmFsc2Vcblx0XHRcdFx0KTtcblx0XHRcdFx0YXNzZXJ0Lm9rKHN1Y2Nlc3MpO1xuXHRcdFx0XHRhc3NlcnQub2soZXZlbnQpO1xuXHRcdFx0fVxuXG5cdFx0XHR7XG5cdFx0XHRcdC8vIDI6IGNsZWFyIGFsbCBvdXRwdXQgd28vIG91dHB1dCAtPiBOTyBldmVudFxuXHRcdFx0XHRldmVudCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0Y29uc3Qgc3VjY2VzcyA9IG1vZGVsLmFwcGx5RWRpdHMoXG5cdFx0XHRcdFx0W3tcblx0XHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuT3V0cHV0LFxuXHRcdFx0XHRcdFx0aW5kZXg6IDAsXG5cdFx0XHRcdFx0XHRvdXRwdXRzOiBbXSxcblx0XHRcdFx0XHRcdGFwcGVuZDogZmFsc2Vcblx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dCxcblx0XHRcdFx0XHRcdGluZGV4OiAxLFxuXHRcdFx0XHRcdFx0b3V0cHV0czogW10sXG5cdFx0XHRcdFx0XHRhcHBlbmQ6IGZhbHNlXG5cdFx0XHRcdFx0fV0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIGZhbHNlXG5cdFx0XHRcdCk7XG5cblx0XHRcdFx0YXNzZXJ0Lm9rKHN1Y2Nlc3MpO1xuXHRcdFx0XHRhc3NlcnQub2soZXZlbnQgPT09IHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0NlbGwgbWV0YWRhdGEvb3V0cHV0IGNoYW5nZSBzaG91bGQgdXBkYXRlIHZlcnNpb24gaWQgYW5kIGFsdGVybmF0aXZlIGlkICMxMjE4MDcnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhbXG5cdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRdLCBhc3luYyAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IudGV4dE1vZGVsLnZlcnNpb25JZCwgMCk7XG5cdFx0XHRjb25zdCBmaXJzdEFsdFZlcnNpb24gPSAnMF8wLDE7MSwxJztcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IudGV4dE1vZGVsLmFsdGVybmF0aXZlVmVyc2lvbklkLCBmaXJzdEFsdFZlcnNpb24pO1xuXHRcdFx0ZWRpdG9yLnRleHRNb2RlbC5hcHBseUVkaXRzKFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGluZGV4OiAwLFxuXHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuTWV0YWRhdGEsXG5cdFx0XHRcdFx0bWV0YWRhdGE6IHtcblx0XHRcdFx0XHRcdGlucHV0Q29sbGFwc2VkOiB0cnVlXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRdLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IudGV4dE1vZGVsLnZlcnNpb25JZCwgMSk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoZWRpdG9yLnRleHRNb2RlbC5hbHRlcm5hdGl2ZVZlcnNpb25JZCwgZmlyc3RBbHRWZXJzaW9uKTtcblx0XHRcdGNvbnN0IHNlY29uZEFsdFZlcnNpb24gPSAnMV8wLDE7MSwxJztcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IudGV4dE1vZGVsLmFsdGVybmF0aXZlVmVyc2lvbklkLCBzZWNvbmRBbHRWZXJzaW9uKTtcblxuXHRcdFx0YXdhaXQgdmlld01vZGVsLnVuZG8oKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IudGV4dE1vZGVsLnZlcnNpb25JZCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLnRleHRNb2RlbC5hbHRlcm5hdGl2ZVZlcnNpb25JZCwgZmlyc3RBbHRWZXJzaW9uKTtcblxuXHRcdFx0YXdhaXQgdmlld01vZGVsLnJlZG8oKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IudGV4dE1vZGVsLnZlcnNpb25JZCwgMyk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoZWRpdG9yLnRleHRNb2RlbC5hbHRlcm5hdGl2ZVZlcnNpb25JZCwgZmlyc3RBbHRWZXJzaW9uKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IudGV4dE1vZGVsLmFsdGVybmF0aXZlVmVyc2lvbklkLCBzZWNvbmRBbHRWZXJzaW9uKTtcblxuXHRcdFx0ZWRpdG9yLnRleHRNb2RlbC5hcHBseUVkaXRzKFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGluZGV4OiAxLFxuXHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuTWV0YWRhdGEsXG5cdFx0XHRcdFx0bWV0YWRhdGE6IHtcblx0XHRcdFx0XHRcdGlucHV0Q29sbGFwc2VkOiB0cnVlXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRdLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IudGV4dE1vZGVsLnZlcnNpb25JZCwgNCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLnRleHRNb2RlbC5hbHRlcm5hdGl2ZVZlcnNpb25JZCwgJzRfMCwxOzEsMScpO1xuXG5cdFx0XHRhd2FpdCB2aWV3TW9kZWwudW5kbygpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci50ZXh0TW9kZWwudmVyc2lvbklkLCA1KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IudGV4dE1vZGVsLmFsdGVybmF0aXZlVmVyc2lvbklkLCBzZWNvbmRBbHRWZXJzaW9uKTtcblxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXRhZGF0YSBjaGFuZ2VzIG9uIG5ld2x5IGFkZGVkIGNlbGxzIHNob3VsZCBjb21iaW5lIHRoZWlyIHVuZG8gb3BlcmF0aW9ucycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFtcblx0XHRcdFsndmFyIGEgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdF0sIGFzeW5jIChlZGl0b3IsIHZpZXdNb2RlbCwgZHMpID0+IHtcblx0XHRcdGNvbnN0IHRleHRNb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cdFx0XHRlZGl0b3IudGV4dE1vZGVsLmFwcGx5RWRpdHMoW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLCBpbmRleDogMSwgY291bnQ6IDAsIGNlbGxzOiBbXG5cdFx0XHRcdFx0XHRkcy5hZGQobmV3IFRlc3RDZWxsKHRleHRNb2RlbC52aWV3VHlwZSwgMSwgJ3ZhciBlID0gNTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCBsYW5ndWFnZVNlcnZpY2UpKSxcblx0XHRcdFx0XHRcdGRzLmFkZChuZXcgVGVzdENlbGwodGV4dE1vZGVsLnZpZXdUeXBlLCAyLCAndmFyIGYgPSA2OycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIGxhbmd1YWdlU2VydmljZSkpXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9LFxuXHRcdFx0XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHMubGVuZ3RoLCAzKTtcblxuXHRcdFx0ZWRpdG9yLnRleHRNb2RlbC5hcHBseUVkaXRzKFtcblx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk1ldGFkYXRhLCBpbmRleDogMSwgbWV0YWRhdGE6IHsgaWQ6ICcxMjMnIH0gfSxcblx0XHRcdF0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dE1vZGVsLmNlbGxzWzFdLm1ldGFkYXRhLmlkLCAnMTIzJyk7XG5cblx0XHRcdGF3YWl0IHZpZXdNb2RlbC51bmRvKCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHMubGVuZ3RoLCAxKTtcblxuXHRcdFx0YXdhaXQgdmlld01vZGVsLnJlZG8oKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRNb2RlbC5jZWxscy5sZW5ndGgsIDMpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdjaGFuZ2VzIHdpdGggbm9uLW1ldGFkYXRhIGVkaXQgc2hvdWxkIG5vdCBjb21iaW5lIHRoZWlyIHVuZG8gb3BlcmF0aW9ucycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFtcblx0XHRcdFsndmFyIGEgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdF0sIGFzeW5jIChlZGl0b3IsIHZpZXdNb2RlbCwgZHMpID0+IHtcblx0XHRcdGNvbnN0IHRleHRNb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cdFx0XHRlZGl0b3IudGV4dE1vZGVsLmFwcGx5RWRpdHMoW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLCBpbmRleDogMSwgY291bnQ6IDAsIGNlbGxzOiBbXG5cdFx0XHRcdFx0XHRkcy5hZGQobmV3IFRlc3RDZWxsKHRleHRNb2RlbC52aWV3VHlwZSwgMSwgJ3ZhciBlID0gNTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCBsYW5ndWFnZVNlcnZpY2UpKSxcblx0XHRcdFx0XHRcdGRzLmFkZChuZXcgVGVzdENlbGwodGV4dE1vZGVsLnZpZXdUeXBlLCAyLCAndmFyIGYgPSA2OycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIGxhbmd1YWdlU2VydmljZSkpXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9LFxuXHRcdFx0XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHMubGVuZ3RoLCAzKTtcblxuXHRcdFx0ZWRpdG9yLnRleHRNb2RlbC5hcHBseUVkaXRzKFtcblx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk1ldGFkYXRhLCBpbmRleDogMSwgbWV0YWRhdGE6IHsgaWQ6ICcxMjMnIH0gfSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuT3V0cHV0LCBoYW5kbGU6IDAsIGFwcGVuZDogdHJ1ZSwgb3V0cHV0czogW3tcblx0XHRcdFx0XHRcdG91dHB1dElkOiAnbmV3T3V0cHV0Jyxcblx0XHRcdFx0XHRcdG91dHB1dHM6IFt7IG1pbWU6IE1pbWVzLnRleHQsIGRhdGE6IHZhbHVlQnl0ZXNGcm9tU3RyaW5nKCdjYmEnKSB9LCB7IG1pbWU6ICdhcHBsaWNhdGlvbi9mb28nLCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygnY2JhJykgfV1cblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9XG5cdFx0XHRdLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRNb2RlbC5jZWxsc1sxXS5tZXRhZGF0YS5pZCwgJzEyMycpO1xuXG5cdFx0XHRhd2FpdCB2aWV3TW9kZWwudW5kbygpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dE1vZGVsLmNlbGxzLmxlbmd0aCwgMyk7XG5cblx0XHRcdGF3YWl0IHZpZXdNb2RlbC51bmRvKCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0TW9kZWwuY2VsbHMubGVuZ3RoLCAxKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRGVzdHJ1Y3RpdmUgc29ydGluZyBpbiBfZG9BcHBseUVkaXRzICMxMjE5OTQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhbXG5cdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFt7IG91dHB1dElkOiAnaTQyJywgb3V0cHV0czogW3sgbWltZTogJ20vaW1lJywgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJ3Rlc3QnKSB9XSB9XSwge31dXG5cdFx0XSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXG5cdFx0XHRjb25zdCBub3RlYm9vayA9IGVkaXRvci50ZXh0TW9kZWw7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChub3RlYm9vay5jZWxsc1swXS5vdXRwdXRzLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suY2VsbHNbMF0ub3V0cHV0c1swXS5vdXRwdXRzLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5vdGVib29rLmNlbGxzWzBdLm91dHB1dHNbMF0ub3V0cHV0c1swXS5kYXRhLCB2YWx1ZUJ5dGVzRnJvbVN0cmluZygndGVzdCcpKTtcblxuXHRcdFx0Y29uc3QgZWRpdHM6IElDZWxsRWRpdE9wZXJhdGlvbltdID0gW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXQsIGhhbmRsZTogMCwgb3V0cHV0czogW11cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuT3V0cHV0LCBoYW5kbGU6IDAsIGFwcGVuZDogdHJ1ZSwgb3V0cHV0czogW3tcblx0XHRcdFx0XHRcdG91dHB1dElkOiAnbmV3T3V0cHV0Jyxcblx0XHRcdFx0XHRcdG91dHB1dHM6IFt7IG1pbWU6IE1pbWVzLnRleHQsIGRhdGE6IHZhbHVlQnl0ZXNGcm9tU3RyaW5nKCdjYmEnKSB9LCB7IG1pbWU6ICdhcHBsaWNhdGlvbi9mb28nLCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygnY2JhJykgfV1cblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9XG5cdFx0XHRdO1xuXG5cdFx0XHRlZGl0b3IudGV4dE1vZGVsLmFwcGx5RWRpdHMoZWRpdHMsIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suY2VsbHNbMF0ub3V0cHV0cy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5vdGVib29rLmNlbGxzWzBdLm91dHB1dHNbMF0ub3V0cHV0cy5sZW5ndGgsIDIpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdEZXN0cnVjdGl2ZSBzb3J0aW5nIGluIF9kb0FwcGx5RWRpdHMgIzEyMTk5NC4gY2VsbCBzcGxpY2UgYmV0d2VlbiBvdXRwdXQgY2hhbmdlcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFtcblx0XHRcdFsndmFyIGEgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW3sgb3V0cHV0SWQ6ICdpNDInLCBvdXRwdXRzOiBbeyBtaW1lOiAnbS9pbWUnLCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygndGVzdCcpIH1dIH1dLCB7fV0sXG5cdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFt7IG91dHB1dElkOiAnaTQzJywgb3V0cHV0czogW3sgbWltZTogJ20vaW1lJywgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJ3Rlc3QnKSB9XSB9XSwge31dLFxuXHRcdFx0Wyd2YXIgYyA9IDM7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbeyBvdXRwdXRJZDogJ2k0NCcsIG91dHB1dHM6IFt7IG1pbWU6ICdtL2ltZScsIGRhdGE6IHZhbHVlQnl0ZXNGcm9tU3RyaW5nKCd0ZXN0JykgfV0gfV0sIHt9XVxuXHRcdF0sIGFzeW5jIChlZGl0b3IpID0+IHtcblx0XHRcdGNvbnN0IG5vdGVib29rID0gZWRpdG9yLnRleHRNb2RlbDtcblxuXHRcdFx0Y29uc3QgZWRpdHM6IElDZWxsRWRpdE9wZXJhdGlvbltdID0gW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXQsIGluZGV4OiAwLCBvdXRwdXRzOiBbXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLCBpbmRleDogMSwgY291bnQ6IDEsIGNlbGxzOiBbXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXQsIGluZGV4OiAyLCBhcHBlbmQ6IHRydWUsIG91dHB1dHM6IFt7XG5cdFx0XHRcdFx0XHRvdXRwdXRJZDogJ25ld091dHB1dCcsXG5cdFx0XHRcdFx0XHRvdXRwdXRzOiBbeyBtaW1lOiBNaW1lcy50ZXh0LCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygnY2JhJykgfSwgeyBtaW1lOiAnYXBwbGljYXRpb24vZm9vJywgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJ2NiYScpIH1dXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fVxuXHRcdFx0XTtcblxuXHRcdFx0ZWRpdG9yLnRleHRNb2RlbC5hcHBseUVkaXRzKGVkaXRzLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5vdGVib29rLmNlbGxzLmxlbmd0aCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suY2VsbHNbMF0ub3V0cHV0cy5sZW5ndGgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5vdGVib29rLmNlbGxzWzFdLm91dHB1dHMubGVuZ3RoLCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChub3RlYm9vay5jZWxsc1sxXS5vdXRwdXRzWzBdLm91dHB1dElkLCAnaTQ0Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suY2VsbHNbMV0ub3V0cHV0c1sxXS5vdXRwdXRJZCwgJ25ld091dHB1dCcpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdEZXN0cnVjdGl2ZSBzb3J0aW5nIGluIF9kb0FwcGx5RWRpdHMgIzEyMTk5NC4gY2VsbCBzcGxpY2UgYmV0d2VlbiBvdXRwdXQgY2hhbmdlcyAyJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soW1xuXHRcdFx0Wyd2YXIgYSA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbeyBvdXRwdXRJZDogJ2k0MicsIG91dHB1dHM6IFt7IG1pbWU6ICdtL2ltZScsIGRhdGE6IHZhbHVlQnl0ZXNGcm9tU3RyaW5nKCd0ZXN0JykgfV0gfV0sIHt9XSxcblx0XHRcdFsndmFyIGIgPSAyOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW3sgb3V0cHV0SWQ6ICdpNDMnLCBvdXRwdXRzOiBbeyBtaW1lOiAnbS9pbWUnLCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygndGVzdCcpIH1dIH1dLCB7fV0sXG5cdFx0XHRbJ3ZhciBjID0gMzsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFt7IG91dHB1dElkOiAnaTQ0Jywgb3V0cHV0czogW3sgbWltZTogJ20vaW1lJywgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJ3Rlc3QnKSB9XSB9XSwge31dXG5cdFx0XSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdFx0Y29uc3Qgbm90ZWJvb2sgPSBlZGl0b3IudGV4dE1vZGVsO1xuXG5cdFx0XHRjb25zdCBlZGl0czogSUNlbGxFZGl0T3BlcmF0aW9uW10gPSBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dCwgaW5kZXg6IDEsIGFwcGVuZDogdHJ1ZSwgb3V0cHV0czogW3tcblx0XHRcdFx0XHRcdG91dHB1dElkOiAnbmV3T3V0cHV0Jyxcblx0XHRcdFx0XHRcdG91dHB1dHM6IFt7IG1pbWU6IE1pbWVzLnRleHQsIGRhdGE6IHZhbHVlQnl0ZXNGcm9tU3RyaW5nKCdjYmEnKSB9LCB7IG1pbWU6ICdhcHBsaWNhdGlvbi9mb28nLCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygnY2JhJykgfV1cblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLCBpbmRleDogMSwgY291bnQ6IDEsIGNlbGxzOiBbXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXQsIGluZGV4OiAxLCBhcHBlbmQ6IHRydWUsIG91dHB1dHM6IFt7XG5cdFx0XHRcdFx0XHRvdXRwdXRJZDogJ25ld091dHB1dDInLFxuXHRcdFx0XHRcdFx0b3V0cHV0czogW3sgbWltZTogTWltZXMudGV4dCwgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJ2NiYScpIH0sIHsgbWltZTogJ2FwcGxpY2F0aW9uL2ZvbycsIGRhdGE6IHZhbHVlQnl0ZXNGcm9tU3RyaW5nKCdjYmEnKSB9XVxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH1cblx0XHRcdF07XG5cblx0XHRcdGVkaXRvci50ZXh0TW9kZWwuYXBwbHlFZGl0cyhlZGl0cywgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChub3RlYm9vay5jZWxscy5sZW5ndGgsIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5vdGVib29rLmNlbGxzWzBdLm91dHB1dHMubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChub3RlYm9vay5jZWxsc1sxXS5vdXRwdXRzLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suY2VsbHNbMV0ub3V0cHV0c1swXS5vdXRwdXRJZCwgJ2k0NCcpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdPdXRwdXQgZWRpdHMgc3BsaWNlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soW1xuXHRcdFx0Wyd2YXIgYSA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXG5cdFx0XSwgKGVkaXRvcikgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IudGV4dE1vZGVsO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuY2VsbHMubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5jZWxsc1swXS5vdXRwdXRzLmxlbmd0aCwgMCk7XG5cblx0XHRcdGNvbnN0IHN1Y2Nlc3MxID0gbW9kZWwuYXBwbHlFZGl0cyhcblx0XHRcdFx0W3tcblx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dCwgaW5kZXg6IDAsIG91dHB1dHM6IFtcblx0XHRcdFx0XHRcdHsgb3V0cHV0SWQ6ICdvdXQxJywgb3V0cHV0czogW3sgbWltZTogJ2FwcGxpY2F0aW9uL3gubm90ZWJvb2suc3RyZWFtJywgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJzEnKSB9XSB9LFxuXHRcdFx0XHRcdFx0eyBvdXRwdXRJZDogJ291dDInLCBvdXRwdXRzOiBbeyBtaW1lOiAnYXBwbGljYXRpb24veC5ub3RlYm9vay5zdHJlYW0nLCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygnMicpIH1dIH0sXG5cdFx0XHRcdFx0XHR7IG91dHB1dElkOiAnb3V0MycsIG91dHB1dHM6IFt7IG1pbWU6ICdhcHBsaWNhdGlvbi94Lm5vdGVib29rLnN0cmVhbScsIGRhdGE6IHZhbHVlQnl0ZXNGcm9tU3RyaW5nKCczJykgfV0gfSxcblx0XHRcdFx0XHRcdHsgb3V0cHV0SWQ6ICdvdXQ0Jywgb3V0cHV0czogW3sgbWltZTogJ2FwcGxpY2F0aW9uL3gubm90ZWJvb2suc3RyZWFtJywgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJzQnKSB9XSB9XG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRhcHBlbmQ6IGZhbHNlXG5cdFx0XHRcdH1dLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmYWxzZVxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0Lm9rKHN1Y2Nlc3MxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5jZWxsc1swXS5vdXRwdXRzLmxlbmd0aCwgNCk7XG5cblx0XHRcdGNvbnN0IHN1Y2Nlc3MyID0gbW9kZWwuYXBwbHlFZGl0cyhcblx0XHRcdFx0W3tcblx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dCwgaW5kZXg6IDAsIG91dHB1dHM6IFtcblx0XHRcdFx0XHRcdHsgb3V0cHV0SWQ6ICdvdXQxJywgb3V0cHV0czogW3sgbWltZTogJ2FwcGxpY2F0aW9uL3gubm90ZWJvb2suc3RyZWFtJywgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJzEnKSB9XSB9LFxuXHRcdFx0XHRcdFx0eyBvdXRwdXRJZDogJ291dDUnLCBvdXRwdXRzOiBbeyBtaW1lOiAnYXBwbGljYXRpb24veC5ub3RlYm9vay5zdHJlYW0nLCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygnNScpIH1dIH0sXG5cdFx0XHRcdFx0XHR7IG91dHB1dElkOiAnb3V0MycsIG91dHB1dHM6IFt7IG1pbWU6ICdhcHBsaWNhdGlvbi94Lm5vdGVib29rLnN0cmVhbScsIGRhdGE6IHZhbHVlQnl0ZXNGcm9tU3RyaW5nKCczJykgfV0gfSxcblx0XHRcdFx0XHRcdHsgb3V0cHV0SWQ6ICdvdXQ2Jywgb3V0cHV0czogW3sgbWltZTogJ2FwcGxpY2F0aW9uL3gubm90ZWJvb2suc3RyZWFtJywgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJzYnKSB9XSB9XG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRhcHBlbmQ6IGZhbHNlXG5cdFx0XHRcdH1dLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmYWxzZVxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0Lm9rKHN1Y2Nlc3MyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5jZWxsc1swXS5vdXRwdXRzLmxlbmd0aCwgNCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuY2VsbHNbMF0ub3V0cHV0c1swXS5vdXRwdXRJZCwgJ291dDEnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5jZWxsc1swXS5vdXRwdXRzWzFdLm91dHB1dElkLCAnb3V0NScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmNlbGxzWzBdLm91dHB1dHNbMl0ub3V0cHV0SWQsICdvdXQzJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuY2VsbHNbMF0ub3V0cHV0c1szXS5vdXRwdXRJZCwgJ291dDYnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnY29tcHV0ZUVkaXRzIG5vIGluc2VydCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFtcblx0XHRcdFsndmFyIGEgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdF0sIChlZGl0b3IpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLnRleHRNb2RlbDtcblx0XHRcdGNvbnN0IGVkaXRzID0gTm90ZWJvb2tUZXh0TW9kZWwuY29tcHV0ZUVkaXRzKG1vZGVsLCBbXG5cdFx0XHRcdHsgc291cmNlOiAndmFyIGEgPSAxOycsIGxhbmd1YWdlOiAnamF2YXNjcmlwdCcsIGNlbGxLaW5kOiBDZWxsS2luZC5Db2RlLCBtaW1lOiB1bmRlZmluZWQsIG91dHB1dHM6IFtdLCBtZXRhZGF0YTogdW5kZWZpbmVkIH1cblx0XHRcdF0pO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRzLCBbXG5cdFx0XHRcdHsgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5NZXRhZGF0YSwgaW5kZXg6IDAsIG1ldGFkYXRhOiB7fSB9XG5cdFx0XHRdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnY29tcHV0ZUVkaXRzIGNlbGwgY29udGVudCBjaGFuZ2VkJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soW1xuXHRcdFx0Wyd2YXIgYSA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXG5cdFx0XSwgKGVkaXRvcikgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IudGV4dE1vZGVsO1xuXHRcdFx0Y29uc3QgY2VsbHMgPSBbXG5cdFx0XHRcdHsgc291cmNlOiAndmFyIGEgPSAyOycsIGxhbmd1YWdlOiAnamF2YXNjcmlwdCcsIGNlbGxLaW5kOiBDZWxsS2luZC5Db2RlLCBtaW1lOiB1bmRlZmluZWQsIG91dHB1dHM6IFtdLCBtZXRhZGF0YTogdW5kZWZpbmVkIH1cblx0XHRcdF07XG5cdFx0XHRjb25zdCBlZGl0cyA9IE5vdGVib29rVGV4dE1vZGVsLmNvbXB1dGVFZGl0cyhtb2RlbCwgY2VsbHMpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRzLCBbXG5cdFx0XHRcdHsgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLCBpbmRleDogMCwgY291bnQ6IDEsIGNlbGxzIH0sXG5cdFx0XHRdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnY29tcHV0ZUVkaXRzIGxhc3QgY2VsbCBjb250ZW50IGNoYW5nZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhbXG5cdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRdLCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cdFx0XHRjb25zdCBjZWxscyA9IFtcblx0XHRcdFx0eyBzb3VyY2U6ICd2YXIgYSA9IDE7JywgbGFuZ3VhZ2U6ICdqYXZhc2NyaXB0JywgY2VsbEtpbmQ6IENlbGxLaW5kLkNvZGUsIG1pbWU6IHVuZGVmaW5lZCwgb3V0cHV0czogW10sIG1ldGFkYXRhOiB1bmRlZmluZWQgfSxcblx0XHRcdFx0eyBzb3VyY2U6ICd2YXIgYiA9IDI7JywgbGFuZ3VhZ2U6ICdqYXZhc2NyaXB0JywgY2VsbEtpbmQ6IENlbGxLaW5kLkNvZGUsIG1pbWU6IHVuZGVmaW5lZCwgb3V0cHV0czogW10sIG1ldGFkYXRhOiB1bmRlZmluZWQgfVxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IGVkaXRzID0gTm90ZWJvb2tUZXh0TW9kZWwuY29tcHV0ZUVkaXRzKG1vZGVsLCBjZWxscyk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdHMsIFtcblx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk1ldGFkYXRhLCBpbmRleDogMCwgbWV0YWRhdGE6IHt9IH0sXG5cdFx0XHRcdHsgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLCBpbmRleDogMSwgY291bnQ6IDEsIGNlbGxzOiBjZWxscy5zbGljZSgxKSB9LFxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdH0pO1xuXHR0ZXN0KCdjb21wdXRlRWRpdHMgZmlyc3QgY2VsbCBjb250ZW50IGNoYW5nZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhbXG5cdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRdLCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cdFx0XHRjb25zdCBjZWxscyA9IFtcblx0XHRcdFx0eyBzb3VyY2U6ICd2YXIgYSA9IDI7JywgbGFuZ3VhZ2U6ICdqYXZhc2NyaXB0JywgY2VsbEtpbmQ6IENlbGxLaW5kLkNvZGUsIG1pbWU6IHVuZGVmaW5lZCwgb3V0cHV0czogW10sIG1ldGFkYXRhOiB1bmRlZmluZWQgfSxcblx0XHRcdFx0eyBzb3VyY2U6ICd2YXIgYiA9IDE7JywgbGFuZ3VhZ2U6ICdqYXZhc2NyaXB0JywgY2VsbEtpbmQ6IENlbGxLaW5kLkNvZGUsIG1pbWU6IHVuZGVmaW5lZCwgb3V0cHV0czogW10sIG1ldGFkYXRhOiB1bmRlZmluZWQgfVxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IGVkaXRzID0gTm90ZWJvb2tUZXh0TW9kZWwuY29tcHV0ZUVkaXRzKG1vZGVsLCBjZWxscyk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdHMsIFtcblx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsIGluZGV4OiAwLCBjb3VudDogMSwgY2VsbHM6IGNlbGxzLnNsaWNlKDAsIDEpIH0sXG5cdFx0XHRcdHsgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5NZXRhZGF0YSwgaW5kZXg6IDEsIG1ldGFkYXRhOiB7fSB9LFxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbXB1dGVFZGl0cyBtaWRkbGUgY2VsbCBjb250ZW50IGNoYW5nZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhbXG5cdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRbJ3ZhciBjID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XSwgKGVkaXRvcikgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IudGV4dE1vZGVsO1xuXHRcdFx0Y29uc3QgY2VsbHMgPSBbXG5cdFx0XHRcdHsgc291cmNlOiAndmFyIGEgPSAxOycsIGxhbmd1YWdlOiAnamF2YXNjcmlwdCcsIGNlbGxLaW5kOiBDZWxsS2luZC5Db2RlLCBtaW1lOiB1bmRlZmluZWQsIG91dHB1dHM6IFtdLCBtZXRhZGF0YTogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdHsgc291cmNlOiAndmFyIGIgPSAyOycsIGxhbmd1YWdlOiAnamF2YXNjcmlwdCcsIGNlbGxLaW5kOiBDZWxsS2luZC5Db2RlLCBtaW1lOiB1bmRlZmluZWQsIG91dHB1dHM6IFtdLCBtZXRhZGF0YTogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdHsgc291cmNlOiAndmFyIGMgPSAxOycsIGxhbmd1YWdlOiAnamF2YXNjcmlwdCcsIGNlbGxLaW5kOiBDZWxsS2luZC5Db2RlLCBtaW1lOiB1bmRlZmluZWQsIG91dHB1dHM6IFtdLCBtZXRhZGF0YTogdW5kZWZpbmVkIH1cblx0XHRcdF07XG5cdFx0XHRjb25zdCBlZGl0cyA9IE5vdGVib29rVGV4dE1vZGVsLmNvbXB1dGVFZGl0cyhtb2RlbCwgY2VsbHMpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRzLCBbXG5cdFx0XHRcdHsgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5NZXRhZGF0YSwgaW5kZXg6IDAsIG1ldGFkYXRhOiB7fSB9LFxuXHRcdFx0XHR7IGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUmVwbGFjZSwgaW5kZXg6IDEsIGNvdW50OiAxLCBjZWxsczogY2VsbHMuc2xpY2UoMSwgMikgfSxcblx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk1ldGFkYXRhLCBpbmRleDogMiwgbWV0YWRhdGE6IHt9IH0sXG5cdFx0XHRdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnY29tcHV0ZUVkaXRzIGNlbGwgbWV0YWRhdGEgY2hhbmdlZCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFtcblx0XHRcdFsndmFyIGEgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdF0sIChlZGl0b3IpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLnRleHRNb2RlbDtcblx0XHRcdGNvbnN0IGNlbGxzID0gW1xuXHRcdFx0XHR7IHNvdXJjZTogJ3ZhciBhID0gMTsnLCBsYW5ndWFnZTogJ2phdmFzY3JpcHQnLCBjZWxsS2luZDogQ2VsbEtpbmQuQ29kZSwgbWltZTogdW5kZWZpbmVkLCBvdXRwdXRzOiBbXSwgbWV0YWRhdGE6IHsgbmFtZTogJ2ZvbycgfSB9LFxuXHRcdFx0XHR7IHNvdXJjZTogJ3ZhciBiID0gMTsnLCBsYW5ndWFnZTogJ2phdmFzY3JpcHQnLCBjZWxsS2luZDogQ2VsbEtpbmQuQ29kZSwgbWltZTogdW5kZWZpbmVkLCBvdXRwdXRzOiBbXSwgbWV0YWRhdGE6IHVuZGVmaW5lZCB9XG5cdFx0XHRdO1xuXHRcdFx0Y29uc3QgZWRpdHMgPSBOb3RlYm9va1RleHRNb2RlbC5jb21wdXRlRWRpdHMobW9kZWwsIGNlbGxzKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0cywgW1xuXHRcdFx0XHR7IGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuTWV0YWRhdGEsIGluZGV4OiAwLCBtZXRhZGF0YTogeyBuYW1lOiAnZm9vJyB9IH0sXG5cdFx0XHRcdHsgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5NZXRhZGF0YSwgaW5kZXg6IDEsIG1ldGFkYXRhOiB7fSB9LFxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbXB1dGVFZGl0cyBjZWxsIGxhbmd1YWdlIGNoYW5nZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhbXG5cdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRdLCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cdFx0XHRjb25zdCBjZWxscyA9IFtcblx0XHRcdFx0eyBzb3VyY2U6ICd2YXIgYSA9IDE7JywgbGFuZ3VhZ2U6ICd0eXBlc2NyaXB0JywgY2VsbEtpbmQ6IENlbGxLaW5kLkNvZGUsIG1pbWU6IHVuZGVmaW5lZCwgb3V0cHV0czogW10sIG1ldGFkYXRhOiB1bmRlZmluZWQgfSxcblx0XHRcdFx0eyBzb3VyY2U6ICd2YXIgYiA9IDE7JywgbGFuZ3VhZ2U6ICdqYXZhc2NyaXB0JywgY2VsbEtpbmQ6IENlbGxLaW5kLkNvZGUsIG1pbWU6IHVuZGVmaW5lZCwgb3V0cHV0czogW10sIG1ldGFkYXRhOiB1bmRlZmluZWQgfVxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IGVkaXRzID0gTm90ZWJvb2tUZXh0TW9kZWwuY29tcHV0ZUVkaXRzKG1vZGVsLCBjZWxscyk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdHMsIFtcblx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsIGluZGV4OiAwLCBjb3VudDogMSwgY2VsbHM6IGNlbGxzLnNsaWNlKDAsIDEpIH0sXG5cdFx0XHRcdHsgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5NZXRhZGF0YSwgaW5kZXg6IDEsIG1ldGFkYXRhOiB7fSB9LFxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbXB1dGVFZGl0cyBjZWxsIGtpbmQgY2hhbmdlZCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFtcblx0XHRcdFsndmFyIGEgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdF0sIChlZGl0b3IpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLnRleHRNb2RlbDtcblx0XHRcdGNvbnN0IGNlbGxzID0gW1xuXHRcdFx0XHR7IHNvdXJjZTogJ3ZhciBhID0gMTsnLCBsYW5ndWFnZTogJ2phdmFzY3JpcHQnLCBjZWxsS2luZDogQ2VsbEtpbmQuQ29kZSwgbWltZTogdW5kZWZpbmVkLCBvdXRwdXRzOiBbXSwgbWV0YWRhdGE6IHVuZGVmaW5lZCB9LFxuXHRcdFx0XHR7IHNvdXJjZTogJ3ZhciBiID0gMTsnLCBsYW5ndWFnZTogJ2phdmFzY3JpcHQnLCBjZWxsS2luZDogQ2VsbEtpbmQuTWFya3VwLCBtaW1lOiB1bmRlZmluZWQsIG91dHB1dHM6IFtdLCBtZXRhZGF0YTogdW5kZWZpbmVkIH1cblx0XHRcdF07XG5cdFx0XHRjb25zdCBlZGl0cyA9IE5vdGVib29rVGV4dE1vZGVsLmNvbXB1dGVFZGl0cyhtb2RlbCwgY2VsbHMpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRzLCBbXG5cdFx0XHRcdHsgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5NZXRhZGF0YSwgaW5kZXg6IDAsIG1ldGFkYXRhOiB7fSB9LFxuXHRcdFx0XHR7IGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUmVwbGFjZSwgaW5kZXg6IDEsIGNvdW50OiAxLCBjZWxsczogY2VsbHMuc2xpY2UoMSkgfSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdjb21wdXRlRWRpdHMgY2VsbCBtZXRhZGF0YSAmIGNvbnRlbnQgY2hhbmdlZCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFtcblx0XHRcdFsndmFyIGEgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdF0sIChlZGl0b3IpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLnRleHRNb2RlbDtcblx0XHRcdGNvbnN0IGNlbGxzID0gW1xuXHRcdFx0XHR7IHNvdXJjZTogJ3ZhciBhID0gMTsnLCBsYW5ndWFnZTogJ2phdmFzY3JpcHQnLCBjZWxsS2luZDogQ2VsbEtpbmQuQ29kZSwgbWltZTogdW5kZWZpbmVkLCBvdXRwdXRzOiBbXSwgbWV0YWRhdGE6IHsgbmFtZTogJ2ZvbycgfSB9LFxuXHRcdFx0XHR7IHNvdXJjZTogJ3ZhciBiID0gMjsnLCBsYW5ndWFnZTogJ2phdmFzY3JpcHQnLCBjZWxsS2luZDogQ2VsbEtpbmQuQ29kZSwgbWltZTogdW5kZWZpbmVkLCBvdXRwdXRzOiBbXSwgbWV0YWRhdGE6IHsgbmFtZTogJ2JhcicgfSB9XG5cdFx0XHRdO1xuXHRcdFx0Y29uc3QgZWRpdHMgPSBOb3RlYm9va1RleHRNb2RlbC5jb21wdXRlRWRpdHMobW9kZWwsIGNlbGxzKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0cywgW1xuXHRcdFx0XHR7IGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuTWV0YWRhdGEsIGluZGV4OiAwLCBtZXRhZGF0YTogeyBuYW1lOiAnZm9vJyB9IH0sXG5cdFx0XHRcdHsgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLCBpbmRleDogMSwgY291bnQ6IDEsIGNlbGxzOiBjZWxscy5zbGljZSgxKSB9XG5cdFx0XHRdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnY29tcHV0ZUVkaXRzIGNlbGwgY29udGVudCBjaGFuZ2VkIHdoaWxlIGV4ZWN1dGluZycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFtcblx0XHRcdFsndmFyIGEgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdF0sIChlZGl0b3IpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLnRleHRNb2RlbDtcblx0XHRcdGNvbnN0IGNlbGxzID0gW1xuXHRcdFx0XHR7IHNvdXJjZTogJ3ZhciBhID0gMTsnLCBsYW5ndWFnZTogJ2phdmFzY3JpcHQnLCBjZWxsS2luZDogQ2VsbEtpbmQuQ29kZSwgbWltZTogdW5kZWZpbmVkLCBvdXRwdXRzOiBbXSwgbWV0YWRhdGE6IHt9IH0sXG5cdFx0XHRcdHsgc291cmNlOiAndmFyIGIgPSAyOycsIGxhbmd1YWdlOiAnamF2YXNjcmlwdCcsIGNlbGxLaW5kOiBDZWxsS2luZC5Db2RlLCBtaW1lOiB1bmRlZmluZWQsIG91dHB1dHM6IFtdLCBtZXRhZGF0YToge30gfVxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IGVkaXRzID0gTm90ZWJvb2tUZXh0TW9kZWwuY29tcHV0ZUVkaXRzKG1vZGVsLCBjZWxscywgW21vZGVsLmNlbGxzWzFdLmhhbmRsZV0pO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRzLCBbXG5cdFx0XHRcdHsgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5NZXRhZGF0YSwgaW5kZXg6IDAsIG1ldGFkYXRhOiB7fSB9LFxuXHRcdFx0XHR7IGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUmVwbGFjZSwgaW5kZXg6IDEsIGNvdW50OiAxLCBjZWxsczogY2VsbHMuc2xpY2UoMSkgfVxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbXB1dGVFZGl0cyBjZWxsIGludGVybmFsIG1ldGFkYXRhIGNoYW5nZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhbXG5cdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRdLCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cdFx0XHRjb25zdCBjZWxscyA9IFtcblx0XHRcdFx0eyBzb3VyY2U6ICd2YXIgYSA9IDE7JywgbGFuZ3VhZ2U6ICdqYXZhc2NyaXB0JywgY2VsbEtpbmQ6IENlbGxLaW5kLkNvZGUsIG1pbWU6IHVuZGVmaW5lZCwgb3V0cHV0czogW10sIG1ldGFkYXRhOiB1bmRlZmluZWQsIGludGVybmFsTWV0YWRhdGE6IHsgZXhlY3V0aW9uT3JkZXI6IDEgfSB9LFxuXHRcdFx0XHR7IHNvdXJjZTogJ3ZhciBiID0gMTsnLCBsYW5ndWFnZTogJ2phdmFzY3JpcHQnLCBjZWxsS2luZDogQ2VsbEtpbmQuQ29kZSwgbWltZTogdW5kZWZpbmVkLCBvdXRwdXRzOiBbXSwgbWV0YWRhdGE6IHVuZGVmaW5lZCB9XG5cdFx0XHRdO1xuXHRcdFx0Y29uc3QgZWRpdHMgPSBOb3RlYm9va1RleHRNb2RlbC5jb21wdXRlRWRpdHMobW9kZWwsIGNlbGxzKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0cywgW1xuXHRcdFx0XHR7IGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUmVwbGFjZSwgaW5kZXg6IDAsIGNvdW50OiAxLCBjZWxsczogY2VsbHMuc2xpY2UoMCwgMSkgfSxcblx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk1ldGFkYXRhLCBpbmRleDogMSwgbWV0YWRhdGE6IHt9IH0sXG5cdFx0XHRdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnY29tcHV0ZUVkaXRzIGNlbGwgaW50ZXJuYWwgbWV0YWRhdGEgY2hhbmdlZCB3aGlsZSBleGVjdXRpbmcnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhbXG5cdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRdLCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cdFx0XHRjb25zdCBjZWxscyA9IFtcblx0XHRcdFx0eyBzb3VyY2U6ICd2YXIgYSA9IDE7JywgbGFuZ3VhZ2U6ICdqYXZhc2NyaXB0JywgY2VsbEtpbmQ6IENlbGxLaW5kLkNvZGUsIG1pbWU6IHVuZGVmaW5lZCwgb3V0cHV0czogW10sIG1ldGFkYXRhOiB7fSB9LFxuXHRcdFx0XHR7IHNvdXJjZTogJ3ZhciBiID0gMTsnLCBsYW5ndWFnZTogJ2phdmFzY3JpcHQnLCBjZWxsS2luZDogQ2VsbEtpbmQuQ29kZSwgbWltZTogdW5kZWZpbmVkLCBvdXRwdXRzOiBbXSwgbWV0YWRhdGE6IHt9LCBpbnRlcm5hbE1ldGFkYXRhOiB7IGV4ZWN1dGlvbk9yZGVyOiAxIH0gfVxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IGVkaXRzID0gTm90ZWJvb2tUZXh0TW9kZWwuY29tcHV0ZUVkaXRzKG1vZGVsLCBjZWxscywgW21vZGVsLmNlbGxzWzFdLmhhbmRsZV0pO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRzLCBbXG5cdFx0XHRcdHsgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5NZXRhZGF0YSwgaW5kZXg6IDAsIG1ldGFkYXRhOiB7fSB9LFxuXHRcdFx0XHR7IGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuTWV0YWRhdGEsIGluZGV4OiAxLCBtZXRhZGF0YToge30gfSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdjb21wdXRlRWRpdHMgY2VsbCBpbnNlcnRpb24nLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhbXG5cdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRbJ3ZhciBiID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV1cblx0XHRdLCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cdFx0XHRjb25zdCBjZWxscyA9IFtcblx0XHRcdFx0eyBzb3VyY2U6ICd2YXIgYSA9IDE7JywgbGFuZ3VhZ2U6ICdqYXZhc2NyaXB0JywgY2VsbEtpbmQ6IENlbGxLaW5kLkNvZGUsIG1pbWU6IHVuZGVmaW5lZCwgb3V0cHV0czogW10sIG1ldGFkYXRhOiB1bmRlZmluZWQsIH0sXG5cdFx0XHRcdHsgc291cmNlOiAndmFyIGMgPSAxOycsIGxhbmd1YWdlOiAnamF2YXNjcmlwdCcsIGNlbGxLaW5kOiBDZWxsS2luZC5Db2RlLCBtaW1lOiB1bmRlZmluZWQsIG91dHB1dHM6IFtdLCBtZXRhZGF0YTogdW5kZWZpbmVkLCB9LFxuXHRcdFx0XHR7IHNvdXJjZTogJ3ZhciBiID0gMTsnLCBsYW5ndWFnZTogJ2phdmFzY3JpcHQnLCBjZWxsS2luZDogQ2VsbEtpbmQuQ29kZSwgbWltZTogdW5kZWZpbmVkLCBvdXRwdXRzOiBbXSwgbWV0YWRhdGE6IHsgZm9vOiAnYmFyJyB9IH1cblx0XHRcdF07XG5cdFx0XHRjb25zdCBlZGl0cyA9IE5vdGVib29rVGV4dE1vZGVsLmNvbXB1dGVFZGl0cyhtb2RlbCwgY2VsbHMpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRzLCBbXG5cdFx0XHRcdHsgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5NZXRhZGF0YSwgaW5kZXg6IDAsIG1ldGFkYXRhOiB7fSB9LFxuXHRcdFx0XHR7IGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUmVwbGFjZSwgaW5kZXg6IDEsIGNvdW50OiAwLCBjZWxsczogY2VsbHMuc2xpY2UoMSwgMikgfSxcblx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk1ldGFkYXRhLCBpbmRleDogMSwgbWV0YWRhdGE6IHsgZm9vOiAnYmFyJyB9IH0sXG5cdFx0XHRdKTtcblxuXHRcdFx0bW9kZWwuYXBwbHlFZGl0cyhlZGl0cywgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuZXF1YWwobW9kZWwuY2VsbHMubGVuZ3RoLCAzKTtcblx0XHRcdGFzc2VydC5lcXVhbChtb2RlbC5jZWxsc1sxXS5nZXRWYWx1ZSgpLCAndmFyIGMgPSAxOycpO1xuXHRcdFx0YXNzZXJ0LmVxdWFsKG1vZGVsLmNlbGxzWzJdLmdldFZhbHVlKCksICd2YXIgYiA9IDE7Jyk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmNlbGxzWzJdLm1ldGFkYXRhLCB7IGZvbzogJ2JhcicgfSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbXB1dGVFZGl0cyBvdXRwdXQgY2hhbmdlZCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFtcblx0XHRcdFsndmFyIGEgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFsndmFyIGIgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XVxuXHRcdF0sIChlZGl0b3IpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLnRleHRNb2RlbDtcblx0XHRcdGNvbnN0IGNlbGxzID0gW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0c291cmNlOiAndmFyIGEgPSAxOycsIGxhbmd1YWdlOiAnamF2YXNjcmlwdCcsIGNlbGxLaW5kOiBDZWxsS2luZC5Db2RlLCBtaW1lOiB1bmRlZmluZWQsIG91dHB1dHM6IFt7XG5cdFx0XHRcdFx0XHRvdXRwdXRJZDogJ3NvbWVJZCcsXG5cdFx0XHRcdFx0XHRvdXRwdXRzOiBbeyBtaW1lOiBNaW1lcy5tYXJrZG93biwgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJ19Xb3JsZF8nKSB9XVxuXHRcdFx0XHRcdH1dLCBtZXRhZGF0YTogdW5kZWZpbmVkLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7IHNvdXJjZTogJ3ZhciBiID0gMTsnLCBsYW5ndWFnZTogJ2phdmFzY3JpcHQnLCBjZWxsS2luZDogQ2VsbEtpbmQuQ29kZSwgbWltZTogdW5kZWZpbmVkLCBvdXRwdXRzOiBbXSwgbWV0YWRhdGE6IHsgZm9vOiAnYmFyJyB9IH1cblx0XHRcdF07XG5cdFx0XHRjb25zdCBlZGl0cyA9IE5vdGVib29rVGV4dE1vZGVsLmNvbXB1dGVFZGl0cyhtb2RlbCwgY2VsbHMpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRzLCBbXG5cdFx0XHRcdHsgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5NZXRhZGF0YSwgaW5kZXg6IDAsIG1ldGFkYXRhOiB7fSB9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXQsIGluZGV4OiAwLCBvdXRwdXRzOiBbe1xuXHRcdFx0XHRcdFx0b3V0cHV0SWQ6ICdzb21lSWQnLFxuXHRcdFx0XHRcdFx0b3V0cHV0czogW3sgbWltZTogTWltZXMubWFya2Rvd24sIGRhdGE6IHZhbHVlQnl0ZXNGcm9tU3RyaW5nKCdfV29ybGRfJykgfV1cblx0XHRcdFx0XHR9XSwgYXBwZW5kOiBmYWxzZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7IGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuTWV0YWRhdGEsIGluZGV4OiAxLCBtZXRhZGF0YTogeyBmb286ICdiYXInIH0gfSxcblx0XHRcdF0pO1xuXG5cdFx0XHRtb2RlbC5hcHBseUVkaXRzKGVkaXRzLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcblx0XHRcdGFzc2VydC5lcXVhbChtb2RlbC5jZWxscy5sZW5ndGgsIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmNlbGxzWzBdLm91dHB1dHMubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5lcXVhbChtb2RlbC5jZWxsc1swXS5vdXRwdXRzWzBdLm91dHB1dElkLCAnc29tZUlkJyk7XG5cdFx0XHRhc3NlcnQuZXF1YWwobW9kZWwuY2VsbHNbMF0ub3V0cHV0c1swXS5vdXRwdXRzWzBdLmRhdGEudG9TdHJpbmcoKSwgJ19Xb3JsZF8nKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnY29tcHV0ZUVkaXRzIG91dHB1dCBpdGVtcyBjaGFuZ2VkJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soW1xuXHRcdFx0Wyd2YXIgYSA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbe1xuXHRcdFx0XHRvdXRwdXRJZDogJ3NvbWVJZCcsXG5cdFx0XHRcdG91dHB1dHM6IFt7IG1pbWU6IE1pbWVzLm1hcmtkb3duLCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygnX0hlbGxvXycpIH1dXG5cdFx0XHR9XSwge31dLFxuXHRcdFx0Wyd2YXIgYiA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXG5cdFx0XSwgKGVkaXRvcikgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IudGV4dE1vZGVsO1xuXHRcdFx0Y29uc3QgY2VsbHMgPSBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRzb3VyY2U6ICd2YXIgYSA9IDE7JywgbGFuZ3VhZ2U6ICdqYXZhc2NyaXB0JywgY2VsbEtpbmQ6IENlbGxLaW5kLkNvZGUsIG1pbWU6IHVuZGVmaW5lZCwgb3V0cHV0czogW3tcblx0XHRcdFx0XHRcdG91dHB1dElkOiAnc29tZUlkJyxcblx0XHRcdFx0XHRcdG91dHB1dHM6IFt7IG1pbWU6IE1pbWVzLm1hcmtkb3duLCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygnX1dvcmxkXycpIH1dXG5cdFx0XHRcdFx0fV0sIG1ldGFkYXRhOiB1bmRlZmluZWQsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHsgc291cmNlOiAndmFyIGIgPSAxOycsIGxhbmd1YWdlOiAnamF2YXNjcmlwdCcsIGNlbGxLaW5kOiBDZWxsS2luZC5Db2RlLCBtaW1lOiB1bmRlZmluZWQsIG91dHB1dHM6IFtdLCBtZXRhZGF0YTogeyBmb286ICdiYXInIH0gfVxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IGVkaXRzID0gTm90ZWJvb2tUZXh0TW9kZWwuY29tcHV0ZUVkaXRzKG1vZGVsLCBjZWxscyk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdHMsIFtcblx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk1ldGFkYXRhLCBpbmRleDogMCwgbWV0YWRhdGE6IHt9IH0sXG5cdFx0XHRcdHsgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXRJdGVtcywgb3V0cHV0SWQ6ICdzb21lSWQnLCBpdGVtczogW3sgbWltZTogTWltZXMubWFya2Rvd24sIGRhdGE6IHZhbHVlQnl0ZXNGcm9tU3RyaW5nKCdfV29ybGRfJykgfV0sIGFwcGVuZDogZmFsc2UgfSxcblx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk1ldGFkYXRhLCBpbmRleDogMSwgbWV0YWRhdGE6IHsgZm9vOiAnYmFyJyB9IH0sXG5cdFx0XHRdKTtcblxuXHRcdFx0bW9kZWwuYXBwbHlFZGl0cyhlZGl0cywgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuZXF1YWwobW9kZWwuY2VsbHMubGVuZ3RoLCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5jZWxsc1swXS5vdXRwdXRzLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuZXF1YWwobW9kZWwuY2VsbHNbMF0ub3V0cHV0c1swXS5vdXRwdXRJZCwgJ3NvbWVJZCcpO1xuXHRcdFx0YXNzZXJ0LmVxdWFsKG1vZGVsLmNlbGxzWzBdLm91dHB1dHNbMF0ub3V0cHV0c1swXS5kYXRhLnRvU3RyaW5nKCksICdfV29ybGRfJyk7XG5cdFx0fSk7XG5cdH0pO1xuXHR0ZXN0KCdBcHBlbmQgbXVsdGlwbGUgdGV4dC9wbGFpbiBvdXRwdXQgaXRlbXMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhbXG5cdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFt7XG5cdFx0XHRcdG91dHB1dElkOiAnMScsXG5cdFx0XHRcdG91dHB1dHM6IFt7IG1pbWU6ICd0ZXh0L3BsYWluJywgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJ2ZvbycpIH1dXG5cdFx0XHR9XSwge31dXG5cdFx0XSwgKGVkaXRvcikgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IudGV4dE1vZGVsO1xuXHRcdFx0Y29uc3QgZWRpdHM6IElDZWxsRWRpdE9wZXJhdGlvbltdID0gW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXRJdGVtcyxcblx0XHRcdFx0XHRvdXRwdXRJZDogJzEnLFxuXHRcdFx0XHRcdGFwcGVuZDogdHJ1ZSxcblx0XHRcdFx0XHRpdGVtczogW3sgbWltZTogJ3RleHQvcGxhaW4nLCBkYXRhOiBWU0J1ZmZlci5mcm9tU3RyaW5nKCdiYXInKSB9LCB7IG1pbWU6ICd0ZXh0L3BsYWluJywgZGF0YTogVlNCdWZmZXIuZnJvbVN0cmluZygnYmF6JykgfV1cblx0XHRcdFx0fVxuXHRcdFx0XTtcblx0XHRcdG1vZGVsLmFwcGx5RWRpdHMoZWRpdHMsIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LmVxdWFsKG1vZGVsLmNlbGxzLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuZXF1YWwobW9kZWwuY2VsbHNbMF0ub3V0cHV0cy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LmVxdWFsKG1vZGVsLmNlbGxzWzBdLm91dHB1dHNbMF0ub3V0cHV0cy5sZW5ndGgsIDMpO1xuXHRcdFx0YXNzZXJ0LmVxdWFsKG1vZGVsLmNlbGxzWzBdLm91dHB1dHNbMF0ub3V0cHV0c1swXS5taW1lLCAndGV4dC9wbGFpbicpO1xuXHRcdFx0YXNzZXJ0LmVxdWFsKG1vZGVsLmNlbGxzWzBdLm91dHB1dHNbMF0ub3V0cHV0c1swXS5kYXRhLnRvU3RyaW5nKCksICdmb28nKTtcblx0XHRcdGFzc2VydC5lcXVhbChtb2RlbC5jZWxsc1swXS5vdXRwdXRzWzBdLm91dHB1dHNbMV0ubWltZSwgJ3RleHQvcGxhaW4nKTtcblx0XHRcdGFzc2VydC5lcXVhbChtb2RlbC5jZWxsc1swXS5vdXRwdXRzWzBdLm91dHB1dHNbMV0uZGF0YS50b1N0cmluZygpLCAnYmFyJyk7XG5cdFx0XHRhc3NlcnQuZXF1YWwobW9kZWwuY2VsbHNbMF0ub3V0cHV0c1swXS5vdXRwdXRzWzJdLm1pbWUsICd0ZXh0L3BsYWluJyk7XG5cdFx0XHRhc3NlcnQuZXF1YWwobW9kZWwuY2VsbHNbMF0ub3V0cHV0c1swXS5vdXRwdXRzWzJdLmRhdGEudG9TdHJpbmcoKSwgJ2JheicpO1xuXHRcdH0pO1xuXHR9KTtcblx0dGVzdCgnQXBwZW5kIG11bHRpcGxlIHN0ZG91dCBzdHJlYW0gb3V0cHV0IGl0ZW1zIHRvIGFuIG91dHB1dCB3aXRoIGFub3RoZXIgbWltZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3aXRoVGVzdE5vdGVib29rKFtcblx0XHRcdFsndmFyIGEgPSAxOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW3tcblx0XHRcdFx0b3V0cHV0SWQ6ICcxJyxcblx0XHRcdFx0b3V0cHV0czogW3sgbWltZTogJ3RleHQvcGxhaW4nLCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygnZm9vJykgfV1cblx0XHRcdH1dLCB7fV1cblx0XHRdLCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cdFx0XHRjb25zdCBlZGl0czogSUNlbGxFZGl0T3BlcmF0aW9uW10gPSBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dEl0ZW1zLFxuXHRcdFx0XHRcdG91dHB1dElkOiAnMScsXG5cdFx0XHRcdFx0YXBwZW5kOiB0cnVlLFxuXHRcdFx0XHRcdGl0ZW1zOiBbeyBtaW1lOiAnYXBwbGljYXRpb24vdm5kLmNvZGUubm90ZWJvb2suc3Rkb3V0JywgZGF0YTogVlNCdWZmZXIuZnJvbVN0cmluZygnYmFyJykgfSwgeyBtaW1lOiAnYXBwbGljYXRpb24vdm5kLmNvZGUubm90ZWJvb2suc3Rkb3V0JywgZGF0YTogVlNCdWZmZXIuZnJvbVN0cmluZygnYmF6JykgfV1cblx0XHRcdFx0fVxuXHRcdFx0XTtcblx0XHRcdG1vZGVsLmFwcGx5RWRpdHMoZWRpdHMsIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LmVxdWFsKG1vZGVsLmNlbGxzLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuZXF1YWwobW9kZWwuY2VsbHNbMF0ub3V0cHV0cy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LmVxdWFsKG1vZGVsLmNlbGxzWzBdLm91dHB1dHNbMF0ub3V0cHV0cy5sZW5ndGgsIDMpO1xuXHRcdFx0YXNzZXJ0LmVxdWFsKG1vZGVsLmNlbGxzWzBdLm91dHB1dHNbMF0ub3V0cHV0c1swXS5taW1lLCAndGV4dC9wbGFpbicpO1xuXHRcdFx0YXNzZXJ0LmVxdWFsKG1vZGVsLmNlbGxzWzBdLm91dHB1dHNbMF0ub3V0cHV0c1swXS5kYXRhLnRvU3RyaW5nKCksICdmb28nKTtcblx0XHRcdGFzc2VydC5lcXVhbChtb2RlbC5jZWxsc1swXS5vdXRwdXRzWzBdLm91dHB1dHNbMV0ubWltZSwgJ2FwcGxpY2F0aW9uL3ZuZC5jb2RlLm5vdGVib29rLnN0ZG91dCcpO1xuXHRcdFx0YXNzZXJ0LmVxdWFsKG1vZGVsLmNlbGxzWzBdLm91dHB1dHNbMF0ub3V0cHV0c1sxXS5kYXRhLnRvU3RyaW5nKCksICdiYXInKTtcblx0XHRcdGFzc2VydC5lcXVhbChtb2RlbC5jZWxsc1swXS5vdXRwdXRzWzBdLm91dHB1dHNbMl0ubWltZSwgJ2FwcGxpY2F0aW9uL3ZuZC5jb2RlLm5vdGVib29rLnN0ZG91dCcpO1xuXHRcdFx0YXNzZXJ0LmVxdWFsKG1vZGVsLmNlbGxzWzBdLm91dHB1dHNbMF0ub3V0cHV0c1syXS5kYXRhLnRvU3RyaW5nKCksICdiYXonKTtcblx0XHR9KTtcblx0fSk7XG5cdHRlc3QoJ0NvbXByZXNzIG11bHRpcGxlIHN0ZG91dCBzdHJlYW0gb3V0cHV0IGl0ZW1zJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soW1xuXHRcdFx0Wyd2YXIgYSA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbe1xuXHRcdFx0XHRvdXRwdXRJZDogJzEnLFxuXHRcdFx0XHRvdXRwdXRzOiBbeyBtaW1lOiAnYXBwbGljYXRpb24vdm5kLmNvZGUubm90ZWJvb2suc3Rkb3V0JywgZGF0YTogdmFsdWVCeXRlc0Zyb21TdHJpbmcoJ2ZvbycpIH1dXG5cdFx0XHR9XSwge31dXG5cdFx0XSwgKGVkaXRvcikgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IudGV4dE1vZGVsO1xuXHRcdFx0Y29uc3QgZWRpdHM6IElDZWxsRWRpdE9wZXJhdGlvbltdID0gW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXRJdGVtcyxcblx0XHRcdFx0XHRvdXRwdXRJZDogJzEnLFxuXHRcdFx0XHRcdGFwcGVuZDogdHJ1ZSxcblx0XHRcdFx0XHRpdGVtczogW3sgbWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5jb2RlLm5vdGVib29rLnN0ZG91dCcsIGRhdGE6IFZTQnVmZmVyLmZyb21TdHJpbmcoJ2JhcicpIH0sIHsgbWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5jb2RlLm5vdGVib29rLnN0ZG91dCcsIGRhdGE6IFZTQnVmZmVyLmZyb21TdHJpbmcoJ2JheicpIH1dXG5cdFx0XHRcdH1cblx0XHRcdF07XG5cdFx0XHRtb2RlbC5hcHBseUVkaXRzKGVkaXRzLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcblx0XHRcdGFzc2VydC5lcXVhbChtb2RlbC5jZWxscy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LmVxdWFsKG1vZGVsLmNlbGxzWzBdLm91dHB1dHMubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5lcXVhbChtb2RlbC5jZWxsc1swXS5vdXRwdXRzWzBdLm91dHB1dHMubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5lcXVhbChtb2RlbC5jZWxsc1swXS5vdXRwdXRzWzBdLm91dHB1dHNbMF0ubWltZSwgJ2FwcGxpY2F0aW9uL3ZuZC5jb2RlLm5vdGVib29rLnN0ZG91dCcpO1xuXHRcdFx0YXNzZXJ0LmVxdWFsKG1vZGVsLmNlbGxzWzBdLm91dHB1dHNbMF0ub3V0cHV0c1swXS5kYXRhLnRvU3RyaW5nKCksICdmb29iYXJiYXonKTtcblx0XHR9KTtcblxuXHR9KTtcblx0dGVzdCgnQ29tcHJlc3MgbXVsdGlwbGUgc3RkZXJyIHN0cmVhbSBvdXRwdXQgaXRlbXMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhbXG5cdFx0XHRbJ3ZhciBhID0gMTsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFt7XG5cdFx0XHRcdG91dHB1dElkOiAnMScsXG5cdFx0XHRcdG91dHB1dHM6IFt7IG1pbWU6ICdhcHBsaWNhdGlvbi92bmQuY29kZS5ub3RlYm9vay5zdGRlcnInLCBkYXRhOiB2YWx1ZUJ5dGVzRnJvbVN0cmluZygnZm9vJykgfV1cblx0XHRcdH1dLCB7fV1cblx0XHRdLCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci50ZXh0TW9kZWw7XG5cdFx0XHRjb25zdCBlZGl0czogSUNlbGxFZGl0T3BlcmF0aW9uW10gPSBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dEl0ZW1zLFxuXHRcdFx0XHRcdG91dHB1dElkOiAnMScsXG5cdFx0XHRcdFx0YXBwZW5kOiB0cnVlLFxuXHRcdFx0XHRcdGl0ZW1zOiBbeyBtaW1lOiAnYXBwbGljYXRpb24vdm5kLmNvZGUubm90ZWJvb2suc3RkZXJyJywgZGF0YTogVlNCdWZmZXIuZnJvbVN0cmluZygnYmFyJykgfSwgeyBtaW1lOiAnYXBwbGljYXRpb24vdm5kLmNvZGUubm90ZWJvb2suc3RkZXJyJywgZGF0YTogVlNCdWZmZXIuZnJvbVN0cmluZygnYmF6JykgfV1cblx0XHRcdFx0fVxuXHRcdFx0XTtcblx0XHRcdG1vZGVsLmFwcGx5RWRpdHMoZWRpdHMsIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LmVxdWFsKG1vZGVsLmNlbGxzLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuZXF1YWwobW9kZWwuY2VsbHNbMF0ub3V0cHV0cy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LmVxdWFsKG1vZGVsLmNlbGxzWzBdLm91dHB1dHNbMF0ub3V0cHV0cy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LmVxdWFsKG1vZGVsLmNlbGxzWzBdLm91dHB1dHNbMF0ub3V0cHV0c1swXS5taW1lLCAnYXBwbGljYXRpb24vdm5kLmNvZGUubm90ZWJvb2suc3RkZXJyJyk7XG5cdFx0XHRhc3NlcnQuZXF1YWwobW9kZWwuY2VsbHNbMF0ub3V0cHV0c1swXS5vdXRwdXRzWzBdLmRhdGEudG9TdHJpbmcoKSwgJ2Zvb2JhcmJheicpO1xuXHRcdH0pO1xuXG5cdH0pO1xuXG5cdHRlc3QoJ2ZpbmROZXh0TWF0Y2gnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0Wyd2YXIgYSA9IDE7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGMgPSAzOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgZCA9IDQ7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0KGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRcdGNvbnN0IG5vdGVib29rTW9kZWwgPSB2aWV3TW9kZWwubm90ZWJvb2tEb2N1bWVudDtcblxuXHRcdFx0XHQvLyBUZXN0IGNhc2UgMTogRmluZCAndmFyJyBzdGFydGluZyBmcm9tIHRoZSBmaXJzdCBjZWxsXG5cdFx0XHRcdGxldCBmaW5kTWF0Y2ggPSBub3RlYm9va01vZGVsLmZpbmROZXh0TWF0Y2goJ3ZhcicsIHsgY2VsbEluZGV4OiAwLCBwb3NpdGlvbjogbmV3IFBvc2l0aW9uKDEsIDEpIH0sIGZhbHNlLCBmYWxzZSwgbnVsbCk7XG5cdFx0XHRcdGFzc2VydC5vayhmaW5kTWF0Y2gpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZE1hdGNoIS5tYXRjaC5yYW5nZS5zdGFydExpbmVOdW1iZXIsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZE1hdGNoIS5tYXRjaC5yYW5nZS5zdGFydENvbHVtbiwgMSk7XG5cblx0XHRcdFx0Ly8gVGVzdCBjYXNlIDI6IEZpbmQgJ2InIHN0YXJ0aW5nIGZyb20gdGhlIHNlY29uZCBjZWxsXG5cdFx0XHRcdGZpbmRNYXRjaCA9IG5vdGVib29rTW9kZWwuZmluZE5leHRNYXRjaCgnYicsIHsgY2VsbEluZGV4OiAxLCBwb3NpdGlvbjogbmV3IFBvc2l0aW9uKDEsIDEpIH0sIGZhbHNlLCBmYWxzZSwgbnVsbCk7XG5cdFx0XHRcdGFzc2VydC5vayhmaW5kTWF0Y2gpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZE1hdGNoIS5tYXRjaC5yYW5nZS5zdGFydExpbmVOdW1iZXIsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZE1hdGNoIS5tYXRjaC5yYW5nZS5zdGFydENvbHVtbiwgNSk7XG5cblx0XHRcdFx0Ly8gVGVzdCBjYXNlIDM6IEZpbmQgJ2MnIHN0YXJ0aW5nIGZyb20gdGhlIHRoaXJkIGNlbGxcblx0XHRcdFx0ZmluZE1hdGNoID0gbm90ZWJvb2tNb2RlbC5maW5kTmV4dE1hdGNoKCdjJywgeyBjZWxsSW5kZXg6IDIsIHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oMSwgMSkgfSwgZmFsc2UsIGZhbHNlLCBudWxsKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKGZpbmRNYXRjaCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kTWF0Y2ghLm1hdGNoLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kTWF0Y2ghLm1hdGNoLnJhbmdlLnN0YXJ0Q29sdW1uLCA1KTtcblxuXHRcdFx0XHQvLyBUZXN0IGNhc2UgNDogRmluZCAnZCcgc3RhcnRpbmcgZnJvbSB0aGUgZm91cnRoIGNlbGxcblx0XHRcdFx0ZmluZE1hdGNoID0gbm90ZWJvb2tNb2RlbC5maW5kTmV4dE1hdGNoKCdkJywgeyBjZWxsSW5kZXg6IDMsIHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oMSwgMSkgfSwgZmFsc2UsIGZhbHNlLCBudWxsKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKGZpbmRNYXRjaCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kTWF0Y2ghLm1hdGNoLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kTWF0Y2ghLm1hdGNoLnJhbmdlLnN0YXJ0Q29sdW1uLCA1KTtcblxuXHRcdFx0XHQvLyBUZXN0IGNhc2UgNTogTm8gbWF0Y2ggZm91bmRcblx0XHRcdFx0ZmluZE1hdGNoID0gbm90ZWJvb2tNb2RlbC5maW5kTmV4dE1hdGNoKCdlJywgeyBjZWxsSW5kZXg6IDAsIHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oMSwgMSkgfSwgZmFsc2UsIGZhbHNlLCBudWxsKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRNYXRjaCwgbnVsbCk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZmluZE5leHRNYXRjaCAyJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsndmFyIGEgPSAxOyB2YXIgYSA9IDI7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dLFxuXHRcdFx0XHRbJ3ZhciBiID0gMjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCB7fV0sXG5cdFx0XHRcdFsndmFyIGMgPSAzOycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwgW10sIHt9XSxcblx0XHRcdFx0Wyd2YXIgZCA9IDQ7JywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCBbXSwge31dXG5cdFx0XHRdLFxuXHRcdFx0KGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRcdGNvbnN0IG5vdGVib29rTW9kZWwgPSB2aWV3TW9kZWwubm90ZWJvb2tEb2N1bWVudDtcblxuXHRcdFx0XHQvLyBUZXN0IGNhc2UgMTogRmluZCAndmFyJyBzdGFydGluZyBmcm9tIHRoZSBmaXJzdCBjZWxsXG5cdFx0XHRcdGxldCBmaW5kTWF0Y2ggPSBub3RlYm9va01vZGVsLmZpbmROZXh0TWF0Y2goJ3ZhcicsIHsgY2VsbEluZGV4OiAwLCBwb3NpdGlvbjogbmV3IFBvc2l0aW9uKDEsIDEpIH0sIGZhbHNlLCBmYWxzZSwgbnVsbCk7XG5cdFx0XHRcdGFzc2VydC5vayhmaW5kTWF0Y2gpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZE1hdGNoIS5tYXRjaC5yYW5nZS5zdGFydExpbmVOdW1iZXIsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZE1hdGNoIS5tYXRjaC5yYW5nZS5zdGFydENvbHVtbiwgMSk7XG5cblx0XHRcdFx0Ly8gVGVzdCBjYXNlIDI6IEZpbmQgJ2InIHN0YXJ0aW5nIGZyb20gdGhlIHNlY29uZCBjZWxsXG5cdFx0XHRcdGZpbmRNYXRjaCA9IG5vdGVib29rTW9kZWwuZmluZE5leHRNYXRjaCgnYicsIHsgY2VsbEluZGV4OiAxLCBwb3NpdGlvbjogbmV3IFBvc2l0aW9uKDEsIDEpIH0sIGZhbHNlLCBmYWxzZSwgbnVsbCk7XG5cdFx0XHRcdGFzc2VydC5vayhmaW5kTWF0Y2gpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZE1hdGNoIS5tYXRjaC5yYW5nZS5zdGFydExpbmVOdW1iZXIsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZE1hdGNoIS5tYXRjaC5yYW5nZS5zdGFydENvbHVtbiwgNSk7XG5cblx0XHRcdFx0Ly8gVGVzdCBjYXNlIDM6IEZpbmQgJ2MnIHN0YXJ0aW5nIGZyb20gdGhlIHRoaXJkIGNlbGxcblx0XHRcdFx0ZmluZE1hdGNoID0gbm90ZWJvb2tNb2RlbC5maW5kTmV4dE1hdGNoKCdjJywgeyBjZWxsSW5kZXg6IDIsIHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oMSwgMSkgfSwgZmFsc2UsIGZhbHNlLCBudWxsKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKGZpbmRNYXRjaCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kTWF0Y2ghLm1hdGNoLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kTWF0Y2ghLm1hdGNoLnJhbmdlLnN0YXJ0Q29sdW1uLCA1KTtcblxuXHRcdFx0XHQvLyBUZXN0IGNhc2UgNDogRmluZCAnZCcgc3RhcnRpbmcgZnJvbSB0aGUgZm91cnRoIGNlbGxcblx0XHRcdFx0ZmluZE1hdGNoID0gbm90ZWJvb2tNb2RlbC5maW5kTmV4dE1hdGNoKCdkJywgeyBjZWxsSW5kZXg6IDMsIHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oMSwgMSkgfSwgZmFsc2UsIGZhbHNlLCBudWxsKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKGZpbmRNYXRjaCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kTWF0Y2ghLm1hdGNoLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kTWF0Y2ghLm1hdGNoLnJhbmdlLnN0YXJ0Q29sdW1uLCA1KTtcblxuXHRcdFx0XHQvLyBUZXN0IGNhc2UgNTogTm8gbWF0Y2ggZm91bmRcblx0XHRcdFx0ZmluZE1hdGNoID0gbm90ZWJvb2tNb2RlbC5maW5kTmV4dE1hdGNoKCdlJywgeyBjZWxsSW5kZXg6IDAsIHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oMSwgMSkgfSwgZmFsc2UsIGZhbHNlLCBudWxsKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRNYXRjaCwgbnVsbCk7XG5cblx0XHRcdFx0Ly8gVGVzdCBjYXNlIDY6IFNhbWUga2V5d29yZHMgaW4gdGhlIHNhbWUgY2VsbFxuXHRcdFx0XHRmaW5kTWF0Y2ggPSBub3RlYm9va01vZGVsLmZpbmROZXh0TWF0Y2goJ3ZhcicsIHsgY2VsbEluZGV4OiAwLCBwb3NpdGlvbjogbmV3IFBvc2l0aW9uKDEsIDEpIH0sIGZhbHNlLCBmYWxzZSwgbnVsbCk7XG5cdFx0XHRcdGFzc2VydC5vayhmaW5kTWF0Y2gpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZE1hdGNoIS5tYXRjaC5yYW5nZS5zdGFydExpbmVOdW1iZXIsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZE1hdGNoIS5tYXRjaC5yYW5nZS5zdGFydENvbHVtbiwgMSk7XG5cblx0XHRcdFx0ZmluZE1hdGNoID0gbm90ZWJvb2tNb2RlbC5maW5kTmV4dE1hdGNoKCd2YXInLCB7IGNlbGxJbmRleDogMCwgcG9zaXRpb246IG5ldyBQb3NpdGlvbigxLCA1KSB9LCBmYWxzZSwgZmFsc2UsIG51bGwpO1xuXHRcdFx0XHRhc3NlcnQub2soZmluZE1hdGNoKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRNYXRjaCEubWF0Y2gucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCAxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRNYXRjaCEubWF0Y2gucmFuZ2Uuc3RhcnRDb2x1bW4sIDEyKTtcblxuXHRcdFx0XHQvLyBUZXN0IGNhc2UgNzogU2VhcmNoIGZyb20gdGhlIG1pZGRsZSBvZiBhIGNlbGwgd2l0aCBrZXl3b3JkIGJlZm9yZSBhbmQgYWZ0ZXJcblx0XHRcdFx0ZmluZE1hdGNoID0gbm90ZWJvb2tNb2RlbC5maW5kTmV4dE1hdGNoKCdhJywgeyBjZWxsSW5kZXg6IDAsIHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oMSwgMTApIH0sIGZhbHNlLCBmYWxzZSwgbnVsbCk7XG5cdFx0XHRcdGFzc2VydC5vayhmaW5kTWF0Y2gpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZE1hdGNoIS5tYXRjaC5yYW5nZS5zdGFydExpbmVOdW1iZXIsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZE1hdGNoIS5tYXRjaC5yYW5nZS5zdGFydENvbHVtbiwgMTMpO1xuXG5cdFx0XHRcdC8vIFRlc3QgY2FzZSA4OiBTZWFyY2ggZnJvbSBhIGNlbGwgYW5kIG5leHQgbWF0Y2ggaXMgaW4gYW5vdGhlciBjZWxsIGJlbG93XG5cdFx0XHRcdGZpbmRNYXRjaCA9IG5vdGVib29rTW9kZWwuZmluZE5leHRNYXRjaCgndmFyJywgeyBjZWxsSW5kZXg6IDAsIHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oMSwgMjApIH0sIGZhbHNlLCBmYWxzZSwgbnVsbCk7XG5cdFx0XHRcdGFzc2VydC5vayhmaW5kTWF0Y2gpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZE1hdGNoIS5tYXRjaC5yYW5nZS5zdGFydExpbmVOdW1iZXIsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZE1hdGNoIS5tYXRjaC5yYW5nZS5zdGFydENvbHVtbiwgMSk7XG5cdFx0XHRcdC8vIGFzc2VydC5zdHJpY3RFcXVhbChtYXRjaCEuY2VsbEluZGV4LCAxKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsYUFBYTtBQUN0QixTQUFTLCtDQUErQztBQUN4RCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGNBQWMsVUFBOEIsNEJBQWdHLDBCQUEwQjtBQUMvSyxTQUFTLDJCQUEyQixVQUFVLHNCQUFzQix3QkFBd0I7QUFFNUYsTUFBTSxxQkFBcUIsTUFBTTtBQUNoQyxNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFFSiwwQ0FBd0M7QUFFeEMsYUFBVyxNQUFNO0FBQ2hCLGtCQUFjLElBQUksZ0JBQWdCO0FBQ2xDLDJCQUF1QiwwQkFBMEIsV0FBVztBQUM1RCxzQkFBa0IscUJBQXFCLElBQUksZ0JBQWdCO0FBQzNELHlCQUFxQixJQUFJLGtCQUFrQixhQUFhO0FBQUEsRUFDekQsQ0FBQztBQUVELGdCQUFjLE1BQU0sWUFBWSxRQUFRLENBQUM7QUFFekMsT0FBSyxVQUFVLGlCQUFrQjtBQUNoQyxVQUFNO0FBQUEsTUFDTDtBQUFBLFFBQ0MsQ0FBQyxjQUFjLGNBQWMsU0FBUyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7QUFBQSxRQUNsRCxDQUFDLGNBQWMsY0FBYyxTQUFTLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUFBLFFBQ2xELENBQUMsY0FBYyxjQUFj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
