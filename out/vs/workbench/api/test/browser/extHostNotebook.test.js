import assert from "assert";
import { ExtHostDocumentsAndEditors } from "../../common/extHostDocumentsAndEditors.js";
import { TestRPCProtocol } from "../common/testRPCProtocol.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { NullLogService } from "../../../../platform/log/common/log.js";
import { mock } from "../../../../base/test/common/mock.js";
import { MainContext } from "../../common/extHost.protocol.js";
import { ExtHostNotebookController } from "../../common/extHostNotebook.js";
import { CellKind, CellUri, NotebookCellsChangeType } from "../../../contrib/notebook/common/notebookCommon.js";
import { URI } from "../../../../base/common/uri.js";
import { ExtHostDocuments } from "../../common/extHostDocuments.js";
import { ExtHostCommands } from "../../common/extHostCommands.js";
import { nullExtensionDescription } from "../../../services/extensions/common/extensions.js";
import { isEqual } from "../../../../base/common/resources.js";
import { Event } from "../../../../base/common/event.js";
import { ExtHostNotebookDocuments } from "../../common/extHostNotebookDocuments.js";
import { SerializableObjectWithBuffers } from "../../../services/extensions/common/proxyIdentifier.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { ExtHostConsumerFileSystem } from "../../common/extHostFileSystemConsumer.js";
import { ExtHostFileSystemInfo } from "../../common/extHostFileSystemInfo.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { ExtHostSearch } from "../../common/extHostSearch.js";
import { URITransformerService } from "../../common/extHostUriTransformerService.js";
suite("NotebookCell#Document", function() {
  let rpcProtocol;
  let notebook;
  let extHostDocumentsAndEditors;
  let extHostDocuments;
  let extHostNotebooks;
  let extHostNotebookDocuments;
  let extHostConsumerFileSystem;
  let extHostSearch;
  const notebookUri = URI.parse("test:///notebook.file");
  const disposables = new DisposableStore();
  teardown(function() {
    disposables.clear();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  setup(async function() {
    rpcProtocol = new TestRPCProtocol();
    rpcProtocol.set(MainContext.MainThreadCommands, new class extends mock() {
      $registerCommand() {
      }
    }());
    rpcProtocol.set(MainContext.MainThreadNotebook, new class extends mock() {
      async $registerNotebookSerializer() {
      }
      async $unregisterNotebookSerializer() {
      }
    }());
    extHostDocumentsAndEditors = new ExtHostDocumentsAndEditors(rpcProtocol, new NullLogService());
    extHostDocuments = new ExtHostDocuments(rpcProtocol, extHostDocumentsAndEditors);
    extHostConsumerFileSystem = new ExtHostConsumerFileSystem(rpcProtocol, new ExtHostFileSystemInfo());
    extHostSearch = new ExtHostSearch(rpcProtocol, new URITransformerService(null), new NullLogService());
    extHostNotebooks = new ExtHostNotebookController(rpcProtocol, new ExtHostCommands(rpcProtocol, new NullLogService(), new class extends mock() {
      onExtensionError() {
        return true;
      }
    }()), extHostDocumentsAndEditors, extHostDocuments, extHostConsumerFileSystem, extHostSearch, new NullLogService());
    extHostNotebookDocuments = new ExtHostNotebookDocuments(extHostNotebooks);
    const reg = extHostNotebooks.registerNotebookSerializer(nullExtensionDescription, "test", new class extends mock() {
    }());
    extHostNotebooks.$acceptDocumentAndEditorsDelta(new SerializableObjectWithBuffers({
      addedDocuments: [{
        uri: notebookUri,
        viewType: "test",
        versionId: 0,
        cells: [{
          handle: 0,
          uri: CellUri.generate(notebookUri, 0),
          source: ["### Heading"],
          eol: "\n",
          language: "markdown",
          cellKind: CellKind.Markup,
          outputs: []
        }, {
          handle: 1,
          uri: CellUri.generate(notebookUri, 1),
          source: ['console.log("aaa")', 'console.log("bbb")'],
          eol: "\n",
          language: "javascript",
          cellKind: CellKind.Code,
          outputs: []
        }]
      }],
      addedEditors: [{
        documentUri: notebookUri,
        id: "_notebook_editor_0",
        selections: [{ start: 0, end: 1 }],
        visibleRanges: [],
        viewType: "test"
      }]
    }));
    extHostNotebooks.$acceptDocumentAndEditorsDelta(new SerializableObjectWithBuffers({ newActiveEditor: "_notebook_editor_0" }));
    notebook = extHostNotebooks.notebookDocuments[0];
    disposables.add(reg);
    disposables.add(notebook);
    disposables.add(extHostDocuments);
  });
  test("cell document is vscode.TextDocument", async function() {
    assert.strictEqual(notebook.apiNotebook.cellCount, 2);
    const [c1, c2] = notebook.apiNotebook.getCells();
    const d1 = extHostDocuments.getDocument(c1.document.uri);
    assert.ok(d1);
    assert.strictEqual(d1.languageId, c1.document.languageId);
    assert.strictEqual(d1.version, 1);
    const d2 = extHostDocuments.getDocument(c2.document.uri);
    assert.ok(d2);
    assert.strictEqual(d2.languageId, c2.document.languageId);
    assert.strictEqual(d2.version, 1);
  });
  test("cell document goes when notebook closes", async function() {
    const cellUris = [];
    for (const cell of notebook.apiNotebook.getCells()) {
      assert.ok(extHostDocuments.getDocument(cell.document.uri));
      cellUris.push(cell.document.uri.toString());
    }
    const removedCellUris = [];
    const reg = extHostDocuments.onDidRemoveDocument((doc) => {
      removedCellUris.push(doc.uri.toString());
    });
    extHostNotebooks.$acceptDocumentAndEditorsDelta(new SerializableObjectWithBuffers({ removedDocuments: [notebook.uri] }));
    reg.dispose();
    assert.strictEqual(removedCellUris.length, 2);
    assert.deepStrictEqual(removedCellUris.sort(), cellUris.sort());
  });
  test("cell document is vscode.TextDocument after changing it", async function() {
    const p = new Promise((resolve, reject) => {
      disposables.add(extHostNotebookDocuments.onDidChangeNotebookDocument((e) => {
        try {
          assert.strictEqual(e.contentChanges.length, 1);
          assert.strictEqual(e.contentChanges[0].addedCells.length, 2);
          const [first, second] = e.contentChanges[0].addedCells;
          const doc1 = extHostDocuments.getAllDocumentData().find((data) => isEqual(data.document.uri, first.document.uri));
          assert.ok(doc1);
          assert.strictEqual(doc1?.document === first.document, true);
          const doc2 = extHostDocuments.getAllDocumentData().find((data) => isEqual(data.document.uri, second.document.uri));
          assert.ok(doc2);
          assert.strictEqual(doc2?.document === second.document, true);
          resolve();
        } catch (err) {
          reject(err);
        }
      }));
    });
    extHostNotebookDocuments.$acceptModelChanged(notebookUri, new SerializableObjectWithBuffers({
      versionId: notebook.apiNotebook.version + 1,
      rawEvents: [
        {
          kind: NotebookCellsChangeType.ModelChange,
          changes: [[0, 0, [{
            handle: 2,
            uri: CellUri.generate(notebookUri, 2),
            source: ["Hello", "World", "Hello World!"],
            eol: "\n",
            language: "test",
            cellKind: CellKind.Code,
            outputs: []
          }, {
            handle: 3,
            uri: CellUri.generate(notebookUri, 3),
            source: ["Hallo", "Welt", "Hallo Welt!"],
            eol: "\n",
            language: "test",
            cellKind: CellKind.Code,
            outputs: []
          }]]]
        }
      ]
    }), false);
    await p;
  });
  test("cell document stays open when notebook is still open", async function() {
    const docs = [];
    const addData = [];
    for (const cell of notebook.apiNotebook.getCells()) {
      const doc = extHostDocuments.getDocument(cell.document.uri);
      assert.ok(doc);
      assert.strictEqual(extHostDocuments.getDocument(cell.document.uri).isClosed, false);
      docs.push(doc);
      addData.push({
        EOL: "\n",
        isDirty: doc.isDirty,
        lines: doc.getText().split("\n"),
        languageId: doc.languageId,
        uri: doc.uri,
        versionId: doc.version,
        encoding: "utf8"
      });
    }
    extHostDocumentsAndEditors.$acceptDocumentsAndEditorsDelta({ addedDocuments: addData });
    extHostDocumentsAndEditors.$acceptDocumentsAndEditorsDelta({ removedDocuments: docs.map((d) => d.uri) });
    for (const cell of notebook.apiNotebook.getCells()) {
      assert.ok(extHostDocuments.getDocument(cell.document.uri));
      assert.strictEqual(extHostDocuments.getDocument(cell.document.uri).isClosed, false);
    }
    extHostNotebooks.$acceptDocumentAndEditorsDelta(new SerializableObjectWithBuffers({ removedDocuments: [notebook.uri] }));
    for (const cell of notebook.apiNotebook.getCells()) {
      assert.throws(() => extHostDocuments.getDocument(cell.document.uri));
    }
    for (const doc of docs) {
      assert.strictEqual(doc.isClosed, true);
    }
  });
  test("cell document goes when cell is removed", async function() {
    assert.strictEqual(notebook.apiNotebook.cellCount, 2);
    const [cell1, cell2] = notebook.apiNotebook.getCells();
    extHostNotebookDocuments.$acceptModelChanged(notebook.uri, new SerializableObjectWithBuffers({
      versionId: 2,
      rawEvents: [
        {
          kind: NotebookCellsChangeType.ModelChange,
          changes: [[0, 1, []]]
        }
      ]
    }), false);
    assert.strictEqual(notebook.apiNotebook.cellCount, 1);
    assert.strictEqual(cell1.document.isClosed, true);
    assert.strictEqual(cell2.document.isClosed, false);
    assert.throws(() => extHostDocuments.getDocument(cell1.document.uri));
  });
  test("cell#index", function() {
    assert.strictEqual(notebook.apiNotebook.cellCount, 2);
    const [first, second] = notebook.apiNotebook.getCells();
    assert.strictEqual(first.index, 0);
    assert.strictEqual(second.index, 1);
    extHostNotebookDocuments.$acceptModelChanged(notebook.uri, new SerializableObjectWithBuffers({
      versionId: notebook.apiNotebook.version + 1,
      rawEvents: [{
        kind: NotebookCellsChangeType.ModelChange,
        changes: [[0, 1, []]]
      }]
    }), false);
    assert.strictEqual(notebook.apiNotebook.cellCount, 1);
    assert.strictEqual(second.index, 0);
    extHostNotebookDocuments.$acceptModelChanged(notebookUri, new SerializableObjectWithBuffers({
      versionId: notebook.apiNotebook.version + 1,
      rawEvents: [{
        kind: NotebookCellsChangeType.ModelChange,
        changes: [[0, 0, [{
          handle: 2,
          uri: CellUri.generate(notebookUri, 2),
          source: ["Hello", "World", "Hello World!"],
          eol: "\n",
          language: "test",
          cellKind: CellKind.Code,
          outputs: []
        }, {
          handle: 3,
          uri: CellUri.generate(notebookUri, 3),
          source: ["Hallo", "Welt", "Hallo Welt!"],
          eol: "\n",
          language: "test",
          cellKind: CellKind.Code,
          outputs: []
        }]]]
      }]
    }), false);
    assert.strictEqual(notebook.apiNotebook.cellCount, 3);
    assert.strictEqual(second.index, 2);
  });
  test("ERR MISSING extHostDocument for notebook cell: #116711", async function() {
    const p = Event.toPromise(extHostNotebookDocuments.onDidChangeNotebookDocument);
    extHostNotebookDocuments.$acceptModelChanged(notebook.uri, new SerializableObjectWithBuffers({
      versionId: 100,
      rawEvents: [{
        kind: NotebookCellsChangeType.ModelChange,
        changes: [[0, 2, [{
          handle: 3,
          uri: CellUri.generate(notebookUri, 3),
          source: ["### Heading"],
          eol: "\n",
          language: "markdown",
          cellKind: CellKind.Markup,
          outputs: []
        }, {
          handle: 4,
          uri: CellUri.generate(notebookUri, 4),
          source: ['console.log("aaa")', 'console.log("bbb")'],
          eol: "\n",
          language: "javascript",
          cellKind: CellKind.Code,
          outputs: []
        }]]]
      }]
    }), false);
    assert.strictEqual(notebook.apiNotebook.cellCount, 2);
    const event = await p;
    assert.strictEqual(event.notebook === notebook.apiNotebook, true);
    assert.strictEqual(event.contentChanges.length, 1);
    assert.strictEqual(event.contentChanges[0].range.end - event.contentChanges[0].range.start, 2);
    assert.strictEqual(event.contentChanges[0].removedCells[0].document.isClosed, true);
    assert.strictEqual(event.contentChanges[0].removedCells[1].document.isClosed, true);
    assert.strictEqual(event.contentChanges[0].addedCells.length, 2);
    assert.strictEqual(event.contentChanges[0].addedCells[0].document.isClosed, false);
    assert.strictEqual(event.contentChanges[0].addedCells[1].document.isClosed, false);
  });
  test("Opening a notebook results in VS Code firing the event onDidChangeActiveNotebookEditor twice #118470", function() {
    let count = 0;
    disposables.add(extHostNotebooks.onDidChangeActiveNotebookEditor(() => count += 1));
    extHostNotebooks.$acceptDocumentAndEditorsDelta(new SerializableObjectWithBuffers({
      addedEditors: [{
        documentUri: notebookUri,
        id: "_notebook_editor_2",
        selections: [{ start: 0, end: 1 }],
        visibleRanges: [],
        viewType: "test"
      }]
    }));
    extHostNotebooks.$acceptDocumentAndEditorsDelta(new SerializableObjectWithBuffers({
      newActiveEditor: "_notebook_editor_2"
    }));
    assert.strictEqual(count, 1);
  });
  test("unset active notebook editor", function() {
    const editor = extHostNotebooks.activeNotebookEditor;
    assert.ok(editor !== void 0);
    extHostNotebooks.$acceptDocumentAndEditorsDelta(new SerializableObjectWithBuffers({ newActiveEditor: void 0 }));
    assert.ok(extHostNotebooks.activeNotebookEditor === editor);
    extHostNotebooks.$acceptDocumentAndEditorsDelta(new SerializableObjectWithBuffers({}));
    assert.ok(extHostNotebooks.activeNotebookEditor === editor);
    extHostNotebooks.$acceptDocumentAndEditorsDelta(new SerializableObjectWithBuffers({ newActiveEditor: null }));
    assert.ok(extHostNotebooks.activeNotebookEditor === void 0);
  });
  test("change cell language triggers onDidChange events", async function() {
    const first = notebook.apiNotebook.cellAt(0);
    assert.strictEqual(first.document.languageId, "markdown");
    const removed = Event.toPromise(extHostDocuments.onDidRemoveDocument);
    const added = Event.toPromise(extHostDocuments.onDidAddDocument);
    extHostNotebookDocuments.$acceptModelChanged(notebook.uri, new SerializableObjectWithBuffers({
      versionId: 12,
      rawEvents: [{
        kind: NotebookCellsChangeType.ChangeCellLanguage,
        index: 0,
        language: "fooLang"
      }]
    }), false);
    const removedDoc = await removed;
    const addedDoc = await added;
    assert.strictEqual(first.document.languageId, "fooLang");
    assert.ok(removedDoc === addedDoc);
  });
  test("onDidChangeNotebook-event, cell changes", async function() {
    const p = Event.toPromise(extHostNotebookDocuments.onDidChangeNotebookDocument);
    extHostNotebookDocuments.$acceptModelChanged(notebook.uri, new SerializableObjectWithBuffers({
      versionId: 12,
      rawEvents: [{
        kind: NotebookCellsChangeType.ChangeCellMetadata,
        index: 0,
        metadata: { foo: 1 }
      }, {
        kind: NotebookCellsChangeType.ChangeCellMetadata,
        index: 1,
        metadata: { foo: 2 }
      }, {
        kind: NotebookCellsChangeType.Output,
        index: 1,
        outputs: [
          {
            items: [{
              valueBytes: VSBuffer.fromByteArray([0, 2, 3]),
              mime: "text/plain"
            }],
            outputId: "1"
          }
        ]
      }]
    }), false, void 0);
    const event = await p;
    assert.strictEqual(event.notebook === notebook.apiNotebook, true);
    assert.strictEqual(event.contentChanges.length, 0);
    assert.strictEqual(event.cellChanges.length, 2);
    const [first, second] = event.cellChanges;
    assert.deepStrictEqual(first.metadata, first.cell.metadata);
    assert.deepStrictEqual(first.executionSummary, void 0);
    assert.deepStrictEqual(first.outputs, void 0);
    assert.deepStrictEqual(first.document, void 0);
    assert.deepStrictEqual(second.outputs, second.cell.outputs);
    assert.deepStrictEqual(second.metadata, second.cell.metadata);
    assert.deepStrictEqual(second.executionSummary, void 0);
    assert.deepStrictEqual(second.document, void 0);
  });
  test("onDidChangeNotebook-event, notebook metadata", async function() {
    const p = Event.toPromise(extHostNotebookDocuments.onDidChangeNotebookDocument);
    extHostNotebookDocuments.$acceptModelChanged(notebook.uri, new SerializableObjectWithBuffers({ versionId: 12, rawEvents: [] }), false, { foo: 2 });
    const event = await p;
    assert.strictEqual(event.notebook === notebook.apiNotebook, true);
    assert.strictEqual(event.contentChanges.length, 0);
    assert.strictEqual(event.cellChanges.length, 0);
    assert.deepStrictEqual(event.metadata, { foo: 2 });
  });
  test("onDidChangeNotebook-event, froozen data", async function() {
    const p = Event.toPromise(extHostNotebookDocuments.onDidChangeNotebookDocument);
    extHostNotebookDocuments.$acceptModelChanged(notebook.uri, new SerializableObjectWithBuffers({ versionId: 12, rawEvents: [] }), false, { foo: 2 });
    const event = await p;
    assert.ok(Object.isFrozen(event));
    assert.ok(Object.isFrozen(event.cellChanges));
    assert.ok(Object.isFrozen(event.contentChanges));
    assert.ok(Object.isFrozen(event.notebook));
    assert.ok(!Object.isFrozen(event.metadata));
  });
  test("change cell language and onDidChangeNotebookDocument", async function() {
    const p = Event.toPromise(extHostNotebookDocuments.onDidChangeNotebookDocument);
    const first = notebook.apiNotebook.cellAt(0);
    assert.strictEqual(first.document.languageId, "markdown");
    extHostNotebookDocuments.$acceptModelChanged(notebook.uri, new SerializableObjectWithBuffers({
      versionId: 12,
      rawEvents: [{
        kind: NotebookCellsChangeType.ChangeCellLanguage,
        index: 0,
        language: "fooLang"
      }]
    }), false);
    const event = await p;
    assert.strictEqual(event.notebook === notebook.apiNotebook, true);
    assert.strictEqual(event.contentChanges.length, 0);
    assert.strictEqual(event.cellChanges.length, 1);
    const [cellChange] = event.cellChanges;
    assert.strictEqual(cellChange.cell === first, true);
    assert.ok(cellChange.document === first.document);
    assert.ok(cellChange.executionSummary === void 0);
    assert.ok(cellChange.metadata === void 0);
    assert.ok(cellChange.outputs === void 0);
  });
  test("change notebook cell document and onDidChangeNotebookDocument", async function() {
    const p = Event.toPromise(extHostNotebookDocuments.onDidChangeNotebookDocument);
    const first = notebook.apiNotebook.cellAt(0);
    extHostNotebookDocuments.$acceptModelChanged(notebook.uri, new SerializableObjectWithBuffers({
      versionId: 12,
      rawEvents: [{
        kind: NotebookCellsChangeType.ChangeCellContent,
        index: 0
      }]
    }), false);
    const event = await p;
    assert.strictEqual(event.notebook === notebook.apiNotebook, true);
    assert.strictEqual(event.contentChanges.length, 0);
    assert.strictEqual(event.cellChanges.length, 1);
    const [cellChange] = event.cellChanges;
    assert.strictEqual(cellChange.cell === first, true);
    assert.ok(cellChange.document === first.document);
    assert.ok(cellChange.executionSummary === void 0);
    assert.ok(cellChange.metadata === void 0);
    assert.ok(cellChange.outputs === void 0);
  });
  async function replaceOutputs(cellIndex, outputId, outputItems) {
    const changeEvent = Event.toPromise(extHostNotebookDocuments.onDidChangeNotebookDocument);
    extHostNotebookDocuments.$acceptModelChanged(notebook.uri, new SerializableObjectWithBuffers({
      versionId: notebook.apiNotebook.version + 1,
      rawEvents: [{
        kind: NotebookCellsChangeType.Output,
        index: cellIndex,
        outputs: [{ outputId, items: outputItems }]
      }]
    }), false);
    await changeEvent;
  }
  async function appendOutputItem(cellIndex, outputId, outputItems) {
    const changeEvent = Event.toPromise(extHostNotebookDocuments.onDidChangeNotebookDocument);
    extHostNotebookDocuments.$acceptModelChanged(notebook.uri, new SerializableObjectWithBuffers({
      versionId: notebook.apiNotebook.version + 1,
      rawEvents: [{
        kind: NotebookCellsChangeType.OutputItem,
        index: cellIndex,
        append: true,
        outputId,
        outputItems
      }]
    }), false);
    await changeEvent;
  }
  test("Append multiple text/plain output items", async function() {
    await replaceOutputs(1, "1", [{ mime: "text/plain", valueBytes: VSBuffer.fromString("foo") }]);
    await appendOutputItem(1, "1", [{ mime: "text/plain", valueBytes: VSBuffer.fromString("bar") }]);
    await appendOutputItem(1, "1", [{ mime: "text/plain", valueBytes: VSBuffer.fromString("baz") }]);
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs.length, 1);
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs[0].items.length, 3);
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs[0].items[0].mime, "text/plain");
    assert.strictEqual(VSBuffer.wrap(notebook.apiNotebook.cellAt(1).outputs[0].items[0].data).toString(), "foo");
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs[0].items[1].mime, "text/plain");
    assert.strictEqual(VSBuffer.wrap(notebook.apiNotebook.cellAt(1).outputs[0].items[1].data).toString(), "bar");
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs[0].items[2].mime, "text/plain");
    assert.strictEqual(VSBuffer.wrap(notebook.apiNotebook.cellAt(1).outputs[0].items[2].data).toString(), "baz");
  });
  test("Append multiple stdout stream output items to an output with another mime", async function() {
    await replaceOutputs(1, "1", [{ mime: "text/plain", valueBytes: VSBuffer.fromString("foo") }]);
    await appendOutputItem(1, "1", [{ mime: "application/vnd.code.notebook.stdout", valueBytes: VSBuffer.fromString("bar") }]);
    await appendOutputItem(1, "1", [{ mime: "application/vnd.code.notebook.stdout", valueBytes: VSBuffer.fromString("baz") }]);
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs.length, 1);
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs[0].items.length, 3);
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs[0].items[0].mime, "text/plain");
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs[0].items[1].mime, "application/vnd.code.notebook.stdout");
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs[0].items[2].mime, "application/vnd.code.notebook.stdout");
  });
  test("Compress multiple stdout stream output items", async function() {
    await replaceOutputs(1, "1", [{ mime: "application/vnd.code.notebook.stdout", valueBytes: VSBuffer.fromString("foo") }]);
    await appendOutputItem(1, "1", [{ mime: "application/vnd.code.notebook.stdout", valueBytes: VSBuffer.fromString("bar") }]);
    await appendOutputItem(1, "1", [{ mime: "application/vnd.code.notebook.stdout", valueBytes: VSBuffer.fromString("baz") }]);
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs.length, 1);
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs[0].items.length, 1);
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs[0].items[0].mime, "application/vnd.code.notebook.stdout");
    assert.strictEqual(VSBuffer.wrap(notebook.apiNotebook.cellAt(1).outputs[0].items[0].data).toString(), "foobarbaz");
  });
  test("Compress multiple stdout stream output items (with support for terminal escape code -> \x1B[A)", async function() {
    await replaceOutputs(1, "1", [{ mime: "application/vnd.code.notebook.stdout", valueBytes: VSBuffer.fromString("\nfoo") }]);
    await appendOutputItem(1, "1", [{ mime: "application/vnd.code.notebook.stdout", valueBytes: VSBuffer.fromString(`${String.fromCharCode(27)}[Abar`) }]);
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs.length, 1);
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs[0].items.length, 1);
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs[0].items[0].mime, "application/vnd.code.notebook.stdout");
    assert.strictEqual(VSBuffer.wrap(notebook.apiNotebook.cellAt(1).outputs[0].items[0].data).toString(), "bar");
  });
  test("Compress multiple stdout stream output items (with support for terminal escape code -> \r character)", async function() {
    await replaceOutputs(1, "1", [{ mime: "application/vnd.code.notebook.stdout", valueBytes: VSBuffer.fromString("foo") }]);
    await appendOutputItem(1, "1", [{ mime: "application/vnd.code.notebook.stdout", valueBytes: VSBuffer.fromString(`\rbar`) }]);
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs.length, 1);
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs[0].items.length, 1);
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs[0].items[0].mime, "application/vnd.code.notebook.stdout");
    assert.strictEqual(VSBuffer.wrap(notebook.apiNotebook.cellAt(1).outputs[0].items[0].data).toString(), "bar");
  });
  test("Compress multiple stderr stream output items", async function() {
    await replaceOutputs(1, "1", [{ mime: "application/vnd.code.notebook.stderr", valueBytes: VSBuffer.fromString("foo") }]);
    await appendOutputItem(1, "1", [{ mime: "application/vnd.code.notebook.stderr", valueBytes: VSBuffer.fromString("bar") }]);
    await appendOutputItem(1, "1", [{ mime: "application/vnd.code.notebook.stderr", valueBytes: VSBuffer.fromString("baz") }]);
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs.length, 1);
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs[0].items.length, 1);
    assert.strictEqual(notebook.apiNotebook.cellAt(1).outputs[0].items[0].mime, "application/vnd.code.notebook.stderr");
    assert.strictEqual(VSBuffer.wrap(notebook.apiNotebook.cellAt(1).outputs[0].items[0].data).toString(), "foobarbaz");
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9leHRIb3N0Tm90ZWJvb2sudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCAqIGFzIHZzY29kZSBmcm9tICd2c2NvZGUnO1xuaW1wb3J0IHsgRXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMuanMnO1xuaW1wb3J0IHsgVGVzdFJQQ1Byb3RvY29sIH0gZnJvbSAnLi4vY29tbW9uL3Rlc3RSUENQcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBtb2NrIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi9tb2NrLmpzJztcbmltcG9ydCB7IElNb2RlbEFkZGVkRGF0YSwgTWFpbkNvbnRleHQsIE1haW5UaHJlYWRDb21tYW5kc1NoYXBlLCBNYWluVGhyZWFkTm90ZWJvb2tTaGFwZSwgTm90ZWJvb2tDZWxsc0NoYW5nZWRFdmVudER0bywgTm90ZWJvb2tPdXRwdXRJdGVtRHRvIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgRXh0SG9zdE5vdGVib29rQ29udHJvbGxlciB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0Tm90ZWJvb2suanMnO1xuaW1wb3J0IHsgRXh0SG9zdE5vdGVib29rRG9jdW1lbnQgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdE5vdGVib29rRG9jdW1lbnQuanMnO1xuaW1wb3J0IHsgQ2VsbEtpbmQsIENlbGxVcmksIE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlIH0gZnJvbSAnLi4vLi4vLi4vY29udHJpYi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IEV4dEhvc3REb2N1bWVudHMgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdERvY3VtZW50cy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0Q29tbWFuZHMgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdENvbW1hbmRzLmpzJztcbmltcG9ydCB7IG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEV4dEhvc3ROb3RlYm9va0RvY3VtZW50cyB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0Tm90ZWJvb2tEb2N1bWVudHMuanMnO1xuaW1wb3J0IHsgU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnMgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9wcm94eUlkZW50aWZpZXIuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RUZWxlbWV0cnkgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdFRlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0Q29uc3VtZXJGaWxlU3lzdGVtIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3RGaWxlU3lzdGVtQ29uc3VtZXIuanMnO1xuaW1wb3J0IHsgRXh0SG9zdEZpbGVTeXN0ZW1JbmZvIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3RGaWxlU3lzdGVtSW5mby5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IEV4dEhvc3RTZWFyY2ggfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdFNlYXJjaC5qcyc7XG5pbXBvcnQgeyBVUklUcmFuc2Zvcm1lclNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdFVyaVRyYW5zZm9ybWVyU2VydmljZS5qcyc7XG5cbnN1aXRlKCdOb3RlYm9va0NlbGwjRG9jdW1lbnQnLCBmdW5jdGlvbiAoKSB7XG5cdGxldCBycGNQcm90b2NvbDogVGVzdFJQQ1Byb3RvY29sO1xuXHRsZXQgbm90ZWJvb2s6IEV4dEhvc3ROb3RlYm9va0RvY3VtZW50O1xuXHRsZXQgZXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnM6IEV4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzO1xuXHRsZXQgZXh0SG9zdERvY3VtZW50czogRXh0SG9zdERvY3VtZW50cztcblx0bGV0IGV4dEhvc3ROb3RlYm9va3M6IEV4dEhvc3ROb3RlYm9va0NvbnRyb2xsZXI7XG5cdGxldCBleHRIb3N0Tm90ZWJvb2tEb2N1bWVudHM6IEV4dEhvc3ROb3RlYm9va0RvY3VtZW50cztcblx0bGV0IGV4dEhvc3RDb25zdW1lckZpbGVTeXN0ZW06IEV4dEhvc3RDb25zdW1lckZpbGVTeXN0ZW07XG5cdGxldCBleHRIb3N0U2VhcmNoOiBFeHRIb3N0U2VhcmNoO1xuXG5cdGNvbnN0IG5vdGVib29rVXJpID0gVVJJLnBhcnNlKCd0ZXN0Oi8vL25vdGVib29rLmZpbGUnKTtcblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0dGVhcmRvd24oZnVuY3Rpb24gKCkge1xuXHRcdGRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHNldHVwKGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRycGNQcm90b2NvbCA9IG5ldyBUZXN0UlBDUHJvdG9jb2woKTtcblx0XHRycGNQcm90b2NvbC5zZXQoTWFpbkNvbnRleHQuTWFpblRocmVhZENvbW1hbmRzLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPE1haW5UaHJlYWRDb21tYW5kc1NoYXBlPigpIHtcblx0XHRcdG92ZXJyaWRlICRyZWdpc3RlckNvbW1hbmQoKSB7IH1cblx0XHR9KTtcblx0XHRycGNQcm90b2NvbC5zZXQoTWFpbkNvbnRleHQuTWFpblRocmVhZE5vdGVib29rLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPE1haW5UaHJlYWROb3RlYm9va1NoYXBlPigpIHtcblx0XHRcdG92ZXJyaWRlIGFzeW5jICRyZWdpc3Rlck5vdGVib29rU2VyaWFsaXplcigpIHsgfVxuXHRcdFx0b3ZlcnJpZGUgYXN5bmMgJHVucmVnaXN0ZXJOb3RlYm9va1NlcmlhbGl6ZXIoKSB7IH1cblx0XHR9KTtcblx0XHRleHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycyA9IG5ldyBFeHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycyhycGNQcm90b2NvbCwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHRcdGV4dEhvc3REb2N1bWVudHMgPSBuZXcgRXh0SG9zdERvY3VtZW50cyhycGNQcm90b2NvbCwgZXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMpO1xuXHRcdGV4dEhvc3RDb25zdW1lckZpbGVTeXN0ZW0gPSBuZXcgRXh0SG9zdENvbnN1bWVyRmlsZVN5c3RlbShycGNQcm90b2NvbCwgbmV3IEV4dEhvc3RGaWxlU3lzdGVtSW5mbygpKTtcblx0XHRleHRIb3N0U2VhcmNoID0gbmV3IEV4dEhvc3RTZWFyY2gocnBjUHJvdG9jb2wsIG5ldyBVUklUcmFuc2Zvcm1lclNlcnZpY2UobnVsbCksIG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblx0XHRleHRIb3N0Tm90ZWJvb2tzID0gbmV3IEV4dEhvc3ROb3RlYm9va0NvbnRyb2xsZXIocnBjUHJvdG9jb2wsIG5ldyBFeHRIb3N0Q29tbWFuZHMocnBjUHJvdG9jb2wsIG5ldyBOdWxsTG9nU2VydmljZSgpLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElFeHRIb3N0VGVsZW1ldHJ5PigpIHtcblx0XHRcdG92ZXJyaWRlIG9uRXh0ZW5zaW9uRXJyb3IoKTogYm9vbGVhbiB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH0pLCBleHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycywgZXh0SG9zdERvY3VtZW50cywgZXh0SG9zdENvbnN1bWVyRmlsZVN5c3RlbSwgZXh0SG9zdFNlYXJjaCwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHRcdGV4dEhvc3ROb3RlYm9va0RvY3VtZW50cyA9IG5ldyBFeHRIb3N0Tm90ZWJvb2tEb2N1bWVudHMoZXh0SG9zdE5vdGVib29rcyk7XG5cblx0XHRjb25zdCByZWcgPSBleHRIb3N0Tm90ZWJvb2tzLnJlZ2lzdGVyTm90ZWJvb2tTZXJpYWxpemVyKG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgJ3Rlc3QnLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPHZzY29kZS5Ob3RlYm9va1NlcmlhbGl6ZXI+KCkgeyB9KTtcblx0XHRleHRIb3N0Tm90ZWJvb2tzLiRhY2NlcHREb2N1bWVudEFuZEVkaXRvcnNEZWx0YShuZXcgU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnMoe1xuXHRcdFx0YWRkZWREb2N1bWVudHM6IFt7XG5cdFx0XHRcdHVyaTogbm90ZWJvb2tVcmksXG5cdFx0XHRcdHZpZXdUeXBlOiAndGVzdCcsXG5cdFx0XHRcdHZlcnNpb25JZDogMCxcblx0XHRcdFx0Y2VsbHM6IFt7XG5cdFx0XHRcdFx0aGFuZGxlOiAwLFxuXHRcdFx0XHRcdHVyaTogQ2VsbFVyaS5nZW5lcmF0ZShub3RlYm9va1VyaSwgMCksXG5cdFx0XHRcdFx0c291cmNlOiBbJyMjIyBIZWFkaW5nJ10sXG5cdFx0XHRcdFx0ZW9sOiAnXFxuJyxcblx0XHRcdFx0XHRsYW5ndWFnZTogJ21hcmtkb3duJyxcblx0XHRcdFx0XHRjZWxsS2luZDogQ2VsbEtpbmQuTWFya3VwLFxuXHRcdFx0XHRcdG91dHB1dHM6IFtdLFxuXHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0aGFuZGxlOiAxLFxuXHRcdFx0XHRcdHVyaTogQ2VsbFVyaS5nZW5lcmF0ZShub3RlYm9va1VyaSwgMSksXG5cdFx0XHRcdFx0c291cmNlOiBbJ2NvbnNvbGUubG9nKFwiYWFhXCIpJywgJ2NvbnNvbGUubG9nKFwiYmJiXCIpJ10sXG5cdFx0XHRcdFx0ZW9sOiAnXFxuJyxcblx0XHRcdFx0XHRsYW5ndWFnZTogJ2phdmFzY3JpcHQnLFxuXHRcdFx0XHRcdGNlbGxLaW5kOiBDZWxsS2luZC5Db2RlLFxuXHRcdFx0XHRcdG91dHB1dHM6IFtdLFxuXHRcdFx0XHR9XSxcblx0XHRcdH1dLFxuXHRcdFx0YWRkZWRFZGl0b3JzOiBbe1xuXHRcdFx0XHRkb2N1bWVudFVyaTogbm90ZWJvb2tVcmksXG5cdFx0XHRcdGlkOiAnX25vdGVib29rX2VkaXRvcl8wJyxcblx0XHRcdFx0c2VsZWN0aW9uczogW3sgc3RhcnQ6IDAsIGVuZDogMSB9XSxcblx0XHRcdFx0dmlzaWJsZVJhbmdlczogW10sXG5cdFx0XHRcdHZpZXdUeXBlOiAndGVzdCdcblx0XHRcdH1dXG5cdFx0fSkpO1xuXHRcdGV4dEhvc3ROb3RlYm9va3MuJGFjY2VwdERvY3VtZW50QW5kRWRpdG9yc0RlbHRhKG5ldyBTZXJpYWxpemFibGVPYmplY3RXaXRoQnVmZmVycyh7IG5ld0FjdGl2ZUVkaXRvcjogJ19ub3RlYm9va19lZGl0b3JfMCcgfSkpO1xuXG5cdFx0bm90ZWJvb2sgPSBleHRIb3N0Tm90ZWJvb2tzLm5vdGVib29rRG9jdW1lbnRzWzBdITtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWcpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChub3RlYm9vayk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3REb2N1bWVudHMpO1xuXHR9KTtcblxuXG5cdHRlc3QoJ2NlbGwgZG9jdW1lbnQgaXMgdnNjb2RlLlRleHREb2N1bWVudCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChub3RlYm9vay5hcGlOb3RlYm9vay5jZWxsQ291bnQsIDIpO1xuXG5cdFx0Y29uc3QgW2MxLCBjMl0gPSBub3RlYm9vay5hcGlOb3RlYm9vay5nZXRDZWxscygpO1xuXHRcdGNvbnN0IGQxID0gZXh0SG9zdERvY3VtZW50cy5nZXREb2N1bWVudChjMS5kb2N1bWVudC51cmkpO1xuXG5cdFx0YXNzZXJ0Lm9rKGQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZDEubGFuZ3VhZ2VJZCwgYzEuZG9jdW1lbnQubGFuZ3VhZ2VJZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGQxLnZlcnNpb24sIDEpO1xuXG5cdFx0Y29uc3QgZDIgPSBleHRIb3N0RG9jdW1lbnRzLmdldERvY3VtZW50KGMyLmRvY3VtZW50LnVyaSk7XG5cdFx0YXNzZXJ0Lm9rKGQyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZDIubGFuZ3VhZ2VJZCwgYzIuZG9jdW1lbnQubGFuZ3VhZ2VJZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGQyLnZlcnNpb24sIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdjZWxsIGRvY3VtZW50IGdvZXMgd2hlbiBub3RlYm9vayBjbG9zZXMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgY2VsbFVyaXM6IHN0cmluZ1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBjZWxsIG9mIG5vdGVib29rLmFwaU5vdGVib29rLmdldENlbGxzKCkpIHtcblx0XHRcdGFzc2VydC5vayhleHRIb3N0RG9jdW1lbnRzLmdldERvY3VtZW50KGNlbGwuZG9jdW1lbnQudXJpKSk7XG5cdFx0XHRjZWxsVXJpcy5wdXNoKGNlbGwuZG9jdW1lbnQudXJpLnRvU3RyaW5nKCkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlbW92ZWRDZWxsVXJpczogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCByZWcgPSBleHRIb3N0RG9jdW1lbnRzLm9uRGlkUmVtb3ZlRG9jdW1lbnQoZG9jID0+IHtcblx0XHRcdHJlbW92ZWRDZWxsVXJpcy5wdXNoKGRvYy51cmkudG9TdHJpbmcoKSk7XG5cdFx0fSk7XG5cblx0XHRleHRIb3N0Tm90ZWJvb2tzLiRhY2NlcHREb2N1bWVudEFuZEVkaXRvcnNEZWx0YShuZXcgU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnMoeyByZW1vdmVkRG9jdW1lbnRzOiBbbm90ZWJvb2sudXJpXSB9KSk7XG5cdFx0cmVnLmRpc3Bvc2UoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZW1vdmVkQ2VsbFVyaXMubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlbW92ZWRDZWxsVXJpcy5zb3J0KCksIGNlbGxVcmlzLnNvcnQoKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NlbGwgZG9jdW1lbnQgaXMgdnNjb2RlLlRleHREb2N1bWVudCBhZnRlciBjaGFuZ2luZyBpdCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHAgPSBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cblx0XHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0Tm90ZWJvb2tEb2N1bWVudHMub25EaWRDaGFuZ2VOb3RlYm9va0RvY3VtZW50KGUgPT4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlLmNvbnRlbnRDaGFuZ2VzLmxlbmd0aCwgMSk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGUuY29udGVudENoYW5nZXNbMF0uYWRkZWRDZWxscy5sZW5ndGgsIDIpO1xuXG5cdFx0XHRcdFx0Y29uc3QgW2ZpcnN0LCBzZWNvbmRdID0gZS5jb250ZW50Q2hhbmdlc1swXS5hZGRlZENlbGxzO1xuXG5cdFx0XHRcdFx0Y29uc3QgZG9jMSA9IGV4dEhvc3REb2N1bWVudHMuZ2V0QWxsRG9jdW1lbnREYXRhKCkuZmluZChkYXRhID0+IGlzRXF1YWwoZGF0YS5kb2N1bWVudC51cmksIGZpcnN0LmRvY3VtZW50LnVyaSkpO1xuXHRcdFx0XHRcdGFzc2VydC5vayhkb2MxKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZG9jMT8uZG9jdW1lbnQgPT09IGZpcnN0LmRvY3VtZW50LCB0cnVlKTtcblxuXHRcdFx0XHRcdGNvbnN0IGRvYzIgPSBleHRIb3N0RG9jdW1lbnRzLmdldEFsbERvY3VtZW50RGF0YSgpLmZpbmQoZGF0YSA9PiBpc0VxdWFsKGRhdGEuZG9jdW1lbnQudXJpLCBzZWNvbmQuZG9jdW1lbnQudXJpKSk7XG5cdFx0XHRcdFx0YXNzZXJ0Lm9rKGRvYzIpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkb2MyPy5kb2N1bWVudCA9PT0gc2Vjb25kLmRvY3VtZW50LCB0cnVlKTtcblxuXHRcdFx0XHRcdHJlc29sdmUoKTtcblxuXHRcdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0XHRyZWplY3QoZXJyKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0fSk7XG5cblx0XHRleHRIb3N0Tm90ZWJvb2tEb2N1bWVudHMuJGFjY2VwdE1vZGVsQ2hhbmdlZChub3RlYm9va1VyaSwgbmV3IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzKHtcblx0XHRcdHZlcnNpb25JZDogbm90ZWJvb2suYXBpTm90ZWJvb2sudmVyc2lvbiArIDEsXG5cdFx0XHRyYXdFdmVudHM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGtpbmQ6IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLk1vZGVsQ2hhbmdlLFxuXHRcdFx0XHRcdGNoYW5nZXM6IFtbMCwgMCwgW3tcblx0XHRcdFx0XHRcdGhhbmRsZTogMixcblx0XHRcdFx0XHRcdHVyaTogQ2VsbFVyaS5nZW5lcmF0ZShub3RlYm9va1VyaSwgMiksXG5cdFx0XHRcdFx0XHRzb3VyY2U6IFsnSGVsbG8nLCAnV29ybGQnLCAnSGVsbG8gV29ybGQhJ10sXG5cdFx0XHRcdFx0XHRlb2w6ICdcXG4nLFxuXHRcdFx0XHRcdFx0bGFuZ3VhZ2U6ICd0ZXN0Jyxcblx0XHRcdFx0XHRcdGNlbGxLaW5kOiBDZWxsS2luZC5Db2RlLFxuXHRcdFx0XHRcdFx0b3V0cHV0czogW10sXG5cdFx0XHRcdFx0fSwge1xuXHRcdFx0XHRcdFx0aGFuZGxlOiAzLFxuXHRcdFx0XHRcdFx0dXJpOiBDZWxsVXJpLmdlbmVyYXRlKG5vdGVib29rVXJpLCAzKSxcblx0XHRcdFx0XHRcdHNvdXJjZTogWydIYWxsbycsICdXZWx0JywgJ0hhbGxvIFdlbHQhJ10sXG5cdFx0XHRcdFx0XHRlb2w6ICdcXG4nLFxuXHRcdFx0XHRcdFx0bGFuZ3VhZ2U6ICd0ZXN0Jyxcblx0XHRcdFx0XHRcdGNlbGxLaW5kOiBDZWxsS2luZC5Db2RlLFxuXHRcdFx0XHRcdFx0b3V0cHV0czogW10sXG5cdFx0XHRcdFx0fV1dXVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSksIGZhbHNlKTtcblxuXHRcdGF3YWl0IHA7XG5cblx0fSk7XG5cblx0dGVzdCgnY2VsbCBkb2N1bWVudCBzdGF5cyBvcGVuIHdoZW4gbm90ZWJvb2sgaXMgc3RpbGwgb3BlbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGRvY3M6IHZzY29kZS5UZXh0RG9jdW1lbnRbXSA9IFtdO1xuXHRcdGNvbnN0IGFkZERhdGE6IElNb2RlbEFkZGVkRGF0YVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBjZWxsIG9mIG5vdGVib29rLmFwaU5vdGVib29rLmdldENlbGxzKCkpIHtcblx0XHRcdGNvbnN0IGRvYyA9IGV4dEhvc3REb2N1bWVudHMuZ2V0RG9jdW1lbnQoY2VsbC5kb2N1bWVudC51cmkpO1xuXHRcdFx0YXNzZXJ0Lm9rKGRvYyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXh0SG9zdERvY3VtZW50cy5nZXREb2N1bWVudChjZWxsLmRvY3VtZW50LnVyaSkuaXNDbG9zZWQsIGZhbHNlKTtcblx0XHRcdGRvY3MucHVzaChkb2MpO1xuXHRcdFx0YWRkRGF0YS5wdXNoKHtcblx0XHRcdFx0RU9MOiAnXFxuJyxcblx0XHRcdFx0aXNEaXJ0eTogZG9jLmlzRGlydHksXG5cdFx0XHRcdGxpbmVzOiBkb2MuZ2V0VGV4dCgpLnNwbGl0KCdcXG4nKSxcblx0XHRcdFx0bGFuZ3VhZ2VJZDogZG9jLmxhbmd1YWdlSWQsXG5cdFx0XHRcdHVyaTogZG9jLnVyaSxcblx0XHRcdFx0dmVyc2lvbklkOiBkb2MudmVyc2lvbixcblx0XHRcdFx0ZW5jb2Rpbmc6ICd1dGY4J1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gdGhpcyBjYWxsIGhhcHBlbnMgd2hlbiBvcGVuaW5nIGEgZG9jdW1lbnQgb24gdGhlIG1haW4gc2lkZVxuXHRcdGV4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzLiRhY2NlcHREb2N1bWVudHNBbmRFZGl0b3JzRGVsdGEoeyBhZGRlZERvY3VtZW50czogYWRkRGF0YSB9KTtcblxuXHRcdC8vIHRoaXMgY2FsbCBoYXBwZW5zIHdoZW4gY2xvc2luZyBhIGRvY3VtZW50IGZyb20gdGhlIG1haW4gc2lkZVxuXHRcdGV4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzLiRhY2NlcHREb2N1bWVudHNBbmRFZGl0b3JzRGVsdGEoeyByZW1vdmVkRG9jdW1lbnRzOiBkb2NzLm1hcChkID0+IGQudXJpKSB9KTtcblxuXHRcdC8vIG5vdGVib29rIGlzIHN0aWxsIG9wZW4gLT4gY2VsbCBkb2N1bWVudHMgc3RheSBvcGVuXG5cdFx0Zm9yIChjb25zdCBjZWxsIG9mIG5vdGVib29rLmFwaU5vdGVib29rLmdldENlbGxzKCkpIHtcblx0XHRcdGFzc2VydC5vayhleHRIb3N0RG9jdW1lbnRzLmdldERvY3VtZW50KGNlbGwuZG9jdW1lbnQudXJpKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXh0SG9zdERvY3VtZW50cy5nZXREb2N1bWVudChjZWxsLmRvY3VtZW50LnVyaSkuaXNDbG9zZWQsIGZhbHNlKTtcblx0XHR9XG5cblx0XHQvLyBjbG9zZSBub3RlYm9vayAtPiBkb2NzIGFyZSBjbG9zZWRcblx0XHRleHRIb3N0Tm90ZWJvb2tzLiRhY2NlcHREb2N1bWVudEFuZEVkaXRvcnNEZWx0YShuZXcgU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnMoeyByZW1vdmVkRG9jdW1lbnRzOiBbbm90ZWJvb2sudXJpXSB9KSk7XG5cdFx0Zm9yIChjb25zdCBjZWxsIG9mIG5vdGVib29rLmFwaU5vdGVib29rLmdldENlbGxzKCkpIHtcblx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4gZXh0SG9zdERvY3VtZW50cy5nZXREb2N1bWVudChjZWxsLmRvY3VtZW50LnVyaSkpO1xuXHRcdH1cblx0XHRmb3IgKGNvbnN0IGRvYyBvZiBkb2NzKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZG9jLmlzQ2xvc2VkLCB0cnVlKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2NlbGwgZG9jdW1lbnQgZ29lcyB3aGVuIGNlbGwgaXMgcmVtb3ZlZCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChub3RlYm9vay5hcGlOb3RlYm9vay5jZWxsQ291bnQsIDIpO1xuXHRcdGNvbnN0IFtjZWxsMSwgY2VsbDJdID0gbm90ZWJvb2suYXBpTm90ZWJvb2suZ2V0Q2VsbHMoKTtcblxuXHRcdGV4dEhvc3ROb3RlYm9va0RvY3VtZW50cy4kYWNjZXB0TW9kZWxDaGFuZ2VkKG5vdGVib29rLnVyaSwgbmV3IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzKHtcblx0XHRcdHZlcnNpb25JZDogMixcblx0XHRcdHJhd0V2ZW50czogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0a2luZDogTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuTW9kZWxDaGFuZ2UsXG5cdFx0XHRcdFx0Y2hhbmdlczogW1swLCAxLCBbXV1dXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9KSwgZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5vdGVib29rLmFwaU5vdGVib29rLmNlbGxDb3VudCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNlbGwxLmRvY3VtZW50LmlzQ2xvc2VkLCB0cnVlKTsgLy8gcmVmIHN0aWxsIGFsaXZlIVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsMi5kb2N1bWVudC5pc0Nsb3NlZCwgZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiBleHRIb3N0RG9jdW1lbnRzLmdldERvY3VtZW50KGNlbGwxLmRvY3VtZW50LnVyaSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdjZWxsI2luZGV4JywgZnVuY3Rpb24gKCkge1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5vdGVib29rLmFwaU5vdGVib29rLmNlbGxDb3VudCwgMik7XG5cdFx0Y29uc3QgW2ZpcnN0LCBzZWNvbmRdID0gbm90ZWJvb2suYXBpTm90ZWJvb2suZ2V0Q2VsbHMoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QuaW5kZXgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWNvbmQuaW5kZXgsIDEpO1xuXG5cdFx0Ly8gcmVtb3ZlIGZpcnN0IGNlbGxcblx0XHRleHRIb3N0Tm90ZWJvb2tEb2N1bWVudHMuJGFjY2VwdE1vZGVsQ2hhbmdlZChub3RlYm9vay51cmksIG5ldyBTZXJpYWxpemFibGVPYmplY3RXaXRoQnVmZmVycyh7XG5cdFx0XHR2ZXJzaW9uSWQ6IG5vdGVib29rLmFwaU5vdGVib29rLnZlcnNpb24gKyAxLFxuXHRcdFx0cmF3RXZlbnRzOiBbe1xuXHRcdFx0XHRraW5kOiBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5Nb2RlbENoYW5nZSxcblx0XHRcdFx0Y2hhbmdlczogW1swLCAxLCBbXV1dXG5cdFx0XHR9XVxuXHRcdH0pLCBmYWxzZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suYXBpTm90ZWJvb2suY2VsbENvdW50LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vjb25kLmluZGV4LCAwKTtcblxuXHRcdGV4dEhvc3ROb3RlYm9va0RvY3VtZW50cy4kYWNjZXB0TW9kZWxDaGFuZ2VkKG5vdGVib29rVXJpLCBuZXcgU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnMoe1xuXHRcdFx0dmVyc2lvbklkOiBub3RlYm9vay5hcGlOb3RlYm9vay52ZXJzaW9uICsgMSxcblx0XHRcdHJhd0V2ZW50czogW3tcblx0XHRcdFx0a2luZDogTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuTW9kZWxDaGFuZ2UsXG5cdFx0XHRcdGNoYW5nZXM6IFtbMCwgMCwgW3tcblx0XHRcdFx0XHRoYW5kbGU6IDIsXG5cdFx0XHRcdFx0dXJpOiBDZWxsVXJpLmdlbmVyYXRlKG5vdGVib29rVXJpLCAyKSxcblx0XHRcdFx0XHRzb3VyY2U6IFsnSGVsbG8nLCAnV29ybGQnLCAnSGVsbG8gV29ybGQhJ10sXG5cdFx0XHRcdFx0ZW9sOiAnXFxuJyxcblx0XHRcdFx0XHRsYW5ndWFnZTogJ3Rlc3QnLFxuXHRcdFx0XHRcdGNlbGxLaW5kOiBDZWxsS2luZC5Db2RlLFxuXHRcdFx0XHRcdG91dHB1dHM6IFtdLFxuXHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0aGFuZGxlOiAzLFxuXHRcdFx0XHRcdHVyaTogQ2VsbFVyaS5nZW5lcmF0ZShub3RlYm9va1VyaSwgMyksXG5cdFx0XHRcdFx0c291cmNlOiBbJ0hhbGxvJywgJ1dlbHQnLCAnSGFsbG8gV2VsdCEnXSxcblx0XHRcdFx0XHRlb2w6ICdcXG4nLFxuXHRcdFx0XHRcdGxhbmd1YWdlOiAndGVzdCcsXG5cdFx0XHRcdFx0Y2VsbEtpbmQ6IENlbGxLaW5kLkNvZGUsXG5cdFx0XHRcdFx0b3V0cHV0czogW10sXG5cdFx0XHRcdH1dXV1cblx0XHRcdH1dXG5cdFx0fSksIGZhbHNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChub3RlYm9vay5hcGlOb3RlYm9vay5jZWxsQ291bnQsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWNvbmQuaW5kZXgsIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCdFUlIgTUlTU0lORyBleHRIb3N0RG9jdW1lbnQgZm9yIG5vdGVib29rIGNlbGw6ICMxMTY3MTEnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBwID0gRXZlbnQudG9Qcm9taXNlKGV4dEhvc3ROb3RlYm9va0RvY3VtZW50cy5vbkRpZENoYW5nZU5vdGVib29rRG9jdW1lbnQpO1xuXG5cdFx0Ly8gRE9OJ1QgY2FsbCB0aGlzLCBtYWtlIHN1cmUgdGhlIGNlbGwtZG9jdW1lbnRzIGhhdmUgbm90IGJlZW4gY3JlYXRlZCB5ZXRcblx0XHQvLyBhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2subm90ZWJvb2tEb2N1bWVudC5jZWxsQ291bnQsIDIpO1xuXG5cdFx0ZXh0SG9zdE5vdGVib29rRG9jdW1lbnRzLiRhY2NlcHRNb2RlbENoYW5nZWQobm90ZWJvb2sudXJpLCBuZXcgU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnMoe1xuXHRcdFx0dmVyc2lvbklkOiAxMDAsXG5cdFx0XHRyYXdFdmVudHM6IFt7XG5cdFx0XHRcdGtpbmQ6IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLk1vZGVsQ2hhbmdlLFxuXHRcdFx0XHRjaGFuZ2VzOiBbWzAsIDIsIFt7XG5cdFx0XHRcdFx0aGFuZGxlOiAzLFxuXHRcdFx0XHRcdHVyaTogQ2VsbFVyaS5nZW5lcmF0ZShub3RlYm9va1VyaSwgMyksXG5cdFx0XHRcdFx0c291cmNlOiBbJyMjIyBIZWFkaW5nJ10sXG5cdFx0XHRcdFx0ZW9sOiAnXFxuJyxcblx0XHRcdFx0XHRsYW5ndWFnZTogJ21hcmtkb3duJyxcblx0XHRcdFx0XHRjZWxsS2luZDogQ2VsbEtpbmQuTWFya3VwLFxuXHRcdFx0XHRcdG91dHB1dHM6IFtdLFxuXHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0aGFuZGxlOiA0LFxuXHRcdFx0XHRcdHVyaTogQ2VsbFVyaS5nZW5lcmF0ZShub3RlYm9va1VyaSwgNCksXG5cdFx0XHRcdFx0c291cmNlOiBbJ2NvbnNvbGUubG9nKFwiYWFhXCIpJywgJ2NvbnNvbGUubG9nKFwiYmJiXCIpJ10sXG5cdFx0XHRcdFx0ZW9sOiAnXFxuJyxcblx0XHRcdFx0XHRsYW5ndWFnZTogJ2phdmFzY3JpcHQnLFxuXHRcdFx0XHRcdGNlbGxLaW5kOiBDZWxsS2luZC5Db2RlLFxuXHRcdFx0XHRcdG91dHB1dHM6IFtdLFxuXHRcdFx0XHR9XV1dXG5cdFx0XHR9XVxuXHRcdH0pLCBmYWxzZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suYXBpTm90ZWJvb2suY2VsbENvdW50LCAyKTtcblxuXHRcdGNvbnN0IGV2ZW50ID0gYXdhaXQgcDtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5ub3RlYm9vayA9PT0gbm90ZWJvb2suYXBpTm90ZWJvb2ssIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5jb250ZW50Q2hhbmdlcy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5jb250ZW50Q2hhbmdlc1swXS5yYW5nZS5lbmQgLSBldmVudC5jb250ZW50Q2hhbmdlc1swXS5yYW5nZS5zdGFydCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbnRlbnRDaGFuZ2VzWzBdLnJlbW92ZWRDZWxsc1swXS5kb2N1bWVudC5pc0Nsb3NlZCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbnRlbnRDaGFuZ2VzWzBdLnJlbW92ZWRDZWxsc1sxXS5kb2N1bWVudC5pc0Nsb3NlZCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbnRlbnRDaGFuZ2VzWzBdLmFkZGVkQ2VsbHMubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29udGVudENoYW5nZXNbMF0uYWRkZWRDZWxsc1swXS5kb2N1bWVudC5pc0Nsb3NlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5jb250ZW50Q2hhbmdlc1swXS5hZGRlZENlbGxzWzFdLmRvY3VtZW50LmlzQ2xvc2VkLCBmYWxzZSk7XG5cdH0pO1xuXG5cblx0dGVzdCgnT3BlbmluZyBhIG5vdGVib29rIHJlc3VsdHMgaW4gVlMgQ29kZSBmaXJpbmcgdGhlIGV2ZW50IG9uRGlkQ2hhbmdlQWN0aXZlTm90ZWJvb2tFZGl0b3IgdHdpY2UgIzExODQ3MCcsIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgY291bnQgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0Tm90ZWJvb2tzLm9uRGlkQ2hhbmdlQWN0aXZlTm90ZWJvb2tFZGl0b3IoKCkgPT4gY291bnQgKz0gMSkpO1xuXG5cdFx0ZXh0SG9zdE5vdGVib29rcy4kYWNjZXB0RG9jdW1lbnRBbmRFZGl0b3JzRGVsdGEobmV3IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzKHtcblx0XHRcdGFkZGVkRWRpdG9yczogW3tcblx0XHRcdFx0ZG9jdW1lbnRVcmk6IG5vdGVib29rVXJpLFxuXHRcdFx0XHRpZDogJ19ub3RlYm9va19lZGl0b3JfMicsXG5cdFx0XHRcdHNlbGVjdGlvbnM6IFt7IHN0YXJ0OiAwLCBlbmQ6IDEgfV0sXG5cdFx0XHRcdHZpc2libGVSYW5nZXM6IFtdLFxuXHRcdFx0XHR2aWV3VHlwZTogJ3Rlc3QnXG5cdFx0XHR9XVxuXHRcdH0pKTtcblxuXHRcdGV4dEhvc3ROb3RlYm9va3MuJGFjY2VwdERvY3VtZW50QW5kRWRpdG9yc0RlbHRhKG5ldyBTZXJpYWxpemFibGVPYmplY3RXaXRoQnVmZmVycyh7XG5cdFx0XHRuZXdBY3RpdmVFZGl0b3I6ICdfbm90ZWJvb2tfZWRpdG9yXzInXG5cdFx0fSkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50LCAxKTtcblx0fSk7XG5cblx0dGVzdCgndW5zZXQgYWN0aXZlIG5vdGVib29rIGVkaXRvcicsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGVkaXRvciA9IGV4dEhvc3ROb3RlYm9va3MuYWN0aXZlTm90ZWJvb2tFZGl0b3I7XG5cdFx0YXNzZXJ0Lm9rKGVkaXRvciAhPT0gdW5kZWZpbmVkKTtcblxuXHRcdGV4dEhvc3ROb3RlYm9va3MuJGFjY2VwdERvY3VtZW50QW5kRWRpdG9yc0RlbHRhKG5ldyBTZXJpYWxpemFibGVPYmplY3RXaXRoQnVmZmVycyh7IG5ld0FjdGl2ZUVkaXRvcjogdW5kZWZpbmVkIH0pKTtcblx0XHRhc3NlcnQub2soZXh0SG9zdE5vdGVib29rcy5hY3RpdmVOb3RlYm9va0VkaXRvciA9PT0gZWRpdG9yKTtcblxuXHRcdGV4dEhvc3ROb3RlYm9va3MuJGFjY2VwdERvY3VtZW50QW5kRWRpdG9yc0RlbHRhKG5ldyBTZXJpYWxpemFibGVPYmplY3RXaXRoQnVmZmVycyh7fSkpO1xuXHRcdGFzc2VydC5vayhleHRIb3N0Tm90ZWJvb2tzLmFjdGl2ZU5vdGVib29rRWRpdG9yID09PSBlZGl0b3IpO1xuXG5cdFx0ZXh0SG9zdE5vdGVib29rcy4kYWNjZXB0RG9jdW1lbnRBbmRFZGl0b3JzRGVsdGEobmV3IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzKHsgbmV3QWN0aXZlRWRpdG9yOiBudWxsIH0pKTtcblx0XHRhc3NlcnQub2soZXh0SG9zdE5vdGVib29rcy5hY3RpdmVOb3RlYm9va0VkaXRvciA9PT0gdW5kZWZpbmVkKTtcblx0fSk7XG5cblx0dGVzdCgnY2hhbmdlIGNlbGwgbGFuZ3VhZ2UgdHJpZ2dlcnMgb25EaWRDaGFuZ2UgZXZlbnRzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgZmlyc3QgPSBub3RlYm9vay5hcGlOb3RlYm9vay5jZWxsQXQoMCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QuZG9jdW1lbnQubGFuZ3VhZ2VJZCwgJ21hcmtkb3duJyk7XG5cblx0XHRjb25zdCByZW1vdmVkID0gRXZlbnQudG9Qcm9taXNlKGV4dEhvc3REb2N1bWVudHMub25EaWRSZW1vdmVEb2N1bWVudCk7XG5cdFx0Y29uc3QgYWRkZWQgPSBFdmVudC50b1Byb21pc2UoZXh0SG9zdERvY3VtZW50cy5vbkRpZEFkZERvY3VtZW50KTtcblxuXHRcdGV4dEhvc3ROb3RlYm9va0RvY3VtZW50cy4kYWNjZXB0TW9kZWxDaGFuZ2VkKG5vdGVib29rLnVyaSwgbmV3IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzKHtcblx0XHRcdHZlcnNpb25JZDogMTIsIHJhd0V2ZW50czogW3tcblx0XHRcdFx0a2luZDogTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuQ2hhbmdlQ2VsbExhbmd1YWdlLFxuXHRcdFx0XHRpbmRleDogMCxcblx0XHRcdFx0bGFuZ3VhZ2U6ICdmb29MYW5nJ1xuXHRcdFx0fV1cblx0XHR9KSwgZmFsc2UpO1xuXG5cdFx0Y29uc3QgcmVtb3ZlZERvYyA9IGF3YWl0IHJlbW92ZWQ7XG5cdFx0Y29uc3QgYWRkZWREb2MgPSBhd2FpdCBhZGRlZDtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5kb2N1bWVudC5sYW5ndWFnZUlkLCAnZm9vTGFuZycpO1xuXHRcdGFzc2VydC5vayhyZW1vdmVkRG9jID09PSBhZGRlZERvYyk7XG5cdH0pO1xuXG5cdHRlc3QoJ29uRGlkQ2hhbmdlTm90ZWJvb2stZXZlbnQsIGNlbGwgY2hhbmdlcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHAgPSBFdmVudC50b1Byb21pc2UoZXh0SG9zdE5vdGVib29rRG9jdW1lbnRzLm9uRGlkQ2hhbmdlTm90ZWJvb2tEb2N1bWVudCk7XG5cblx0XHRleHRIb3N0Tm90ZWJvb2tEb2N1bWVudHMuJGFjY2VwdE1vZGVsQ2hhbmdlZChub3RlYm9vay51cmksIG5ldyBTZXJpYWxpemFibGVPYmplY3RXaXRoQnVmZmVycyh7XG5cdFx0XHR2ZXJzaW9uSWQ6IDEyLCByYXdFdmVudHM6IFt7XG5cdFx0XHRcdGtpbmQ6IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLkNoYW5nZUNlbGxNZXRhZGF0YSxcblx0XHRcdFx0aW5kZXg6IDAsXG5cdFx0XHRcdG1ldGFkYXRhOiB7IGZvbzogMSB9XG5cdFx0XHR9LCB7XG5cdFx0XHRcdGtpbmQ6IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLkNoYW5nZUNlbGxNZXRhZGF0YSxcblx0XHRcdFx0aW5kZXg6IDEsXG5cdFx0XHRcdG1ldGFkYXRhOiB7IGZvbzogMiB9LFxuXHRcdFx0fSwge1xuXHRcdFx0XHRraW5kOiBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5PdXRwdXQsXG5cdFx0XHRcdGluZGV4OiAxLFxuXHRcdFx0XHRvdXRwdXRzOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0aXRlbXM6IFt7XG5cdFx0XHRcdFx0XHRcdHZhbHVlQnl0ZXM6IFZTQnVmZmVyLmZyb21CeXRlQXJyYXkoWzAsIDIsIDNdKSxcblx0XHRcdFx0XHRcdFx0bWltZTogJ3RleHQvcGxhaW4nXG5cdFx0XHRcdFx0XHR9XSxcblx0XHRcdFx0XHRcdG91dHB1dElkOiAnMSdcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdH1dXG5cdFx0fSksIGZhbHNlLCB1bmRlZmluZWQpO1xuXG5cblx0XHRjb25zdCBldmVudCA9IGF3YWl0IHA7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQubm90ZWJvb2sgPT09IG5vdGVib29rLmFwaU5vdGVib29rLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29udGVudENoYW5nZXMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY2VsbENoYW5nZXMubGVuZ3RoLCAyKTtcblxuXHRcdGNvbnN0IFtmaXJzdCwgc2Vjb25kXSA9IGV2ZW50LmNlbGxDaGFuZ2VzO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmlyc3QubWV0YWRhdGEsIGZpcnN0LmNlbGwubWV0YWRhdGEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmlyc3QuZXhlY3V0aW9uU3VtbWFyeSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpcnN0Lm91dHB1dHMsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXJzdC5kb2N1bWVudCwgdW5kZWZpbmVkKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2Vjb25kLm91dHB1dHMsIHNlY29uZC5jZWxsLm91dHB1dHMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2Vjb25kLm1ldGFkYXRhLCBzZWNvbmQuY2VsbC5tZXRhZGF0YSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZWNvbmQuZXhlY3V0aW9uU3VtbWFyeSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlY29uZC5kb2N1bWVudCwgdW5kZWZpbmVkKTtcblx0fSk7XG5cblx0dGVzdCgnb25EaWRDaGFuZ2VOb3RlYm9vay1ldmVudCwgbm90ZWJvb2sgbWV0YWRhdGEnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBwID0gRXZlbnQudG9Qcm9taXNlKGV4dEhvc3ROb3RlYm9va0RvY3VtZW50cy5vbkRpZENoYW5nZU5vdGVib29rRG9jdW1lbnQpO1xuXG5cdFx0ZXh0SG9zdE5vdGVib29rRG9jdW1lbnRzLiRhY2NlcHRNb2RlbENoYW5nZWQobm90ZWJvb2sudXJpLCBuZXcgU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnMoeyB2ZXJzaW9uSWQ6IDEyLCByYXdFdmVudHM6IFtdIH0pLCBmYWxzZSwgeyBmb286IDIgfSk7XG5cblx0XHRjb25zdCBldmVudCA9IGF3YWl0IHA7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQubm90ZWJvb2sgPT09IG5vdGVib29rLmFwaU5vdGVib29rLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY29udGVudENoYW5nZXMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQuY2VsbENoYW5nZXMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGV2ZW50Lm1ldGFkYXRhLCB7IGZvbzogMiB9KTtcblx0fSk7XG5cblx0dGVzdCgnb25EaWRDaGFuZ2VOb3RlYm9vay1ldmVudCwgZnJvb3plbiBkYXRhJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgcCA9IEV2ZW50LnRvUHJvbWlzZShleHRIb3N0Tm90ZWJvb2tEb2N1bWVudHMub25EaWRDaGFuZ2VOb3RlYm9va0RvY3VtZW50KTtcblxuXHRcdGV4dEhvc3ROb3RlYm9va0RvY3VtZW50cy4kYWNjZXB0TW9kZWxDaGFuZ2VkKG5vdGVib29rLnVyaSwgbmV3IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzKHsgdmVyc2lvbklkOiAxMiwgcmF3RXZlbnRzOiBbXSB9KSwgZmFsc2UsIHsgZm9vOiAyIH0pO1xuXG5cdFx0Y29uc3QgZXZlbnQgPSBhd2FpdCBwO1xuXG5cdFx0YXNzZXJ0Lm9rKE9iamVjdC5pc0Zyb3plbihldmVudCkpO1xuXHRcdGFzc2VydC5vayhPYmplY3QuaXNGcm96ZW4oZXZlbnQuY2VsbENoYW5nZXMpKTtcblx0XHRhc3NlcnQub2soT2JqZWN0LmlzRnJvemVuKGV2ZW50LmNvbnRlbnRDaGFuZ2VzKSk7XG5cdFx0YXNzZXJ0Lm9rKE9iamVjdC5pc0Zyb3plbihldmVudC5ub3RlYm9vaykpO1xuXHRcdGFzc2VydC5vayghT2JqZWN0LmlzRnJvemVuKGV2ZW50Lm1ldGFkYXRhKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NoYW5nZSBjZWxsIGxhbmd1YWdlIGFuZCBvbkRpZENoYW5nZU5vdGVib29rRG9jdW1lbnQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBwID0gRXZlbnQudG9Qcm9taXNlKGV4dEhvc3ROb3RlYm9va0RvY3VtZW50cy5vbkRpZENoYW5nZU5vdGVib29rRG9jdW1lbnQpO1xuXG5cdFx0Y29uc3QgZmlyc3QgPSBub3RlYm9vay5hcGlOb3RlYm9vay5jZWxsQXQoMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LmRvY3VtZW50Lmxhbmd1YWdlSWQsICdtYXJrZG93bicpO1xuXG5cdFx0ZXh0SG9zdE5vdGVib29rRG9jdW1lbnRzLiRhY2NlcHRNb2RlbENoYW5nZWQobm90ZWJvb2sudXJpLCBuZXcgU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnMoe1xuXHRcdFx0dmVyc2lvbklkOiAxMixcblx0XHRcdHJhd0V2ZW50czogW3tcblx0XHRcdFx0a2luZDogTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuQ2hhbmdlQ2VsbExhbmd1YWdlLFxuXHRcdFx0XHRpbmRleDogMCxcblx0XHRcdFx0bGFuZ3VhZ2U6ICdmb29MYW5nJ1xuXHRcdFx0fV1cblx0XHR9KSwgZmFsc2UpO1xuXG5cdFx0Y29uc3QgZXZlbnQgPSBhd2FpdCBwO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Lm5vdGVib29rID09PSBub3RlYm9vay5hcGlOb3RlYm9vaywgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbnRlbnRDaGFuZ2VzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNlbGxDaGFuZ2VzLmxlbmd0aCwgMSk7XG5cblx0XHRjb25zdCBbY2VsbENoYW5nZV0gPSBldmVudC5jZWxsQ2hhbmdlcztcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsQ2hhbmdlLmNlbGwgPT09IGZpcnN0LCB0cnVlKTtcblx0XHRhc3NlcnQub2soY2VsbENoYW5nZS5kb2N1bWVudCA9PT0gZmlyc3QuZG9jdW1lbnQpO1xuXHRcdGFzc2VydC5vayhjZWxsQ2hhbmdlLmV4ZWN1dGlvblN1bW1hcnkgPT09IHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0Lm9rKGNlbGxDaGFuZ2UubWV0YWRhdGEgPT09IHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0Lm9rKGNlbGxDaGFuZ2Uub3V0cHV0cyA9PT0gdW5kZWZpbmVkKTtcblx0fSk7XG5cblx0dGVzdCgnY2hhbmdlIG5vdGVib29rIGNlbGwgZG9jdW1lbnQgYW5kIG9uRGlkQ2hhbmdlTm90ZWJvb2tEb2N1bWVudCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHAgPSBFdmVudC50b1Byb21pc2UoZXh0SG9zdE5vdGVib29rRG9jdW1lbnRzLm9uRGlkQ2hhbmdlTm90ZWJvb2tEb2N1bWVudCk7XG5cblx0XHRjb25zdCBmaXJzdCA9IG5vdGVib29rLmFwaU5vdGVib29rLmNlbGxBdCgwKTtcblxuXHRcdGV4dEhvc3ROb3RlYm9va0RvY3VtZW50cy4kYWNjZXB0TW9kZWxDaGFuZ2VkKG5vdGVib29rLnVyaSwgbmV3IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzKHtcblx0XHRcdHZlcnNpb25JZDogMTIsXG5cdFx0XHRyYXdFdmVudHM6IFt7XG5cdFx0XHRcdGtpbmQ6IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLkNoYW5nZUNlbGxDb250ZW50LFxuXHRcdFx0XHRpbmRleDogMFxuXHRcdFx0fV1cblx0XHR9KSwgZmFsc2UpO1xuXG5cdFx0Y29uc3QgZXZlbnQgPSBhd2FpdCBwO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Lm5vdGVib29rID09PSBub3RlYm9vay5hcGlOb3RlYm9vaywgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNvbnRlbnRDaGFuZ2VzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LmNlbGxDaGFuZ2VzLmxlbmd0aCwgMSk7XG5cblx0XHRjb25zdCBbY2VsbENoYW5nZV0gPSBldmVudC5jZWxsQ2hhbmdlcztcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsQ2hhbmdlLmNlbGwgPT09IGZpcnN0LCB0cnVlKTtcblx0XHRhc3NlcnQub2soY2VsbENoYW5nZS5kb2N1bWVudCA9PT0gZmlyc3QuZG9jdW1lbnQpO1xuXHRcdGFzc2VydC5vayhjZWxsQ2hhbmdlLmV4ZWN1dGlvblN1bW1hcnkgPT09IHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0Lm9rKGNlbGxDaGFuZ2UubWV0YWRhdGEgPT09IHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0Lm9rKGNlbGxDaGFuZ2Uub3V0cHV0cyA9PT0gdW5kZWZpbmVkKTtcblx0fSk7XG5cblx0YXN5bmMgZnVuY3Rpb24gcmVwbGFjZU91dHB1dHMoY2VsbEluZGV4OiBudW1iZXIsIG91dHB1dElkOiBzdHJpbmcsIG91dHB1dEl0ZW1zOiBOb3RlYm9va091dHB1dEl0ZW1EdG9bXSkge1xuXHRcdGNvbnN0IGNoYW5nZUV2ZW50ID0gRXZlbnQudG9Qcm9taXNlKGV4dEhvc3ROb3RlYm9va0RvY3VtZW50cy5vbkRpZENoYW5nZU5vdGVib29rRG9jdW1lbnQpO1xuXHRcdGV4dEhvc3ROb3RlYm9va0RvY3VtZW50cy4kYWNjZXB0TW9kZWxDaGFuZ2VkKG5vdGVib29rLnVyaSwgbmV3IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzPE5vdGVib29rQ2VsbHNDaGFuZ2VkRXZlbnREdG8+KHtcblx0XHRcdHZlcnNpb25JZDogbm90ZWJvb2suYXBpTm90ZWJvb2sudmVyc2lvbiArIDEsXG5cdFx0XHRyYXdFdmVudHM6IFt7XG5cdFx0XHRcdGtpbmQ6IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLk91dHB1dCxcblx0XHRcdFx0aW5kZXg6IGNlbGxJbmRleCxcblx0XHRcdFx0b3V0cHV0czogW3sgb3V0cHV0SWQsIGl0ZW1zOiBvdXRwdXRJdGVtcyB9XVxuXHRcdFx0fV1cblx0XHR9KSwgZmFsc2UpO1xuXHRcdGF3YWl0IGNoYW5nZUV2ZW50O1xuXHR9XG5cdGFzeW5jIGZ1bmN0aW9uIGFwcGVuZE91dHB1dEl0ZW0oY2VsbEluZGV4OiBudW1iZXIsIG91dHB1dElkOiBzdHJpbmcsIG91dHB1dEl0ZW1zOiBOb3RlYm9va091dHB1dEl0ZW1EdG9bXSkge1xuXHRcdGNvbnN0IGNoYW5nZUV2ZW50ID0gRXZlbnQudG9Qcm9taXNlKGV4dEhvc3ROb3RlYm9va0RvY3VtZW50cy5vbkRpZENoYW5nZU5vdGVib29rRG9jdW1lbnQpO1xuXHRcdGV4dEhvc3ROb3RlYm9va0RvY3VtZW50cy4kYWNjZXB0TW9kZWxDaGFuZ2VkKG5vdGVib29rLnVyaSwgbmV3IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzPE5vdGVib29rQ2VsbHNDaGFuZ2VkRXZlbnREdG8+KHtcblx0XHRcdHZlcnNpb25JZDogbm90ZWJvb2suYXBpTm90ZWJvb2sudmVyc2lvbiArIDEsXG5cdFx0XHRyYXdFdmVudHM6IFt7XG5cdFx0XHRcdGtpbmQ6IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLk91dHB1dEl0ZW0sXG5cdFx0XHRcdGluZGV4OiBjZWxsSW5kZXgsXG5cdFx0XHRcdGFwcGVuZDogdHJ1ZSxcblx0XHRcdFx0b3V0cHV0SWQsXG5cdFx0XHRcdG91dHB1dEl0ZW1zXG5cdFx0XHR9XVxuXHRcdH0pLCBmYWxzZSk7XG5cdFx0YXdhaXQgY2hhbmdlRXZlbnQ7XG5cdH1cblx0dGVzdCgnQXBwZW5kIG11bHRpcGxlIHRleHQvcGxhaW4gb3V0cHV0IGl0ZW1zJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHJlcGxhY2VPdXRwdXRzKDEsICcxJywgW3sgbWltZTogJ3RleHQvcGxhaW4nLCB2YWx1ZUJ5dGVzOiBWU0J1ZmZlci5mcm9tU3RyaW5nKCdmb28nKSB9XSk7XG5cdFx0YXdhaXQgYXBwZW5kT3V0cHV0SXRlbSgxLCAnMScsIFt7IG1pbWU6ICd0ZXh0L3BsYWluJywgdmFsdWVCeXRlczogVlNCdWZmZXIuZnJvbVN0cmluZygnYmFyJykgfV0pO1xuXHRcdGF3YWl0IGFwcGVuZE91dHB1dEl0ZW0oMSwgJzEnLCBbeyBtaW1lOiAndGV4dC9wbGFpbicsIHZhbHVlQnl0ZXM6IFZTQnVmZmVyLmZyb21TdHJpbmcoJ2JheicpIH1dKTtcblxuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5vdGVib29rLmFwaU5vdGVib29rLmNlbGxBdCgxKS5vdXRwdXRzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5vdGVib29rLmFwaU5vdGVib29rLmNlbGxBdCgxKS5vdXRwdXRzWzBdLml0ZW1zLmxlbmd0aCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5vdGVib29rLmFwaU5vdGVib29rLmNlbGxBdCgxKS5vdXRwdXRzWzBdLml0ZW1zWzBdLm1pbWUsICd0ZXh0L3BsYWluJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFZTQnVmZmVyLndyYXAobm90ZWJvb2suYXBpTm90ZWJvb2suY2VsbEF0KDEpLm91dHB1dHNbMF0uaXRlbXNbMF0uZGF0YSkudG9TdHJpbmcoKSwgJ2ZvbycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChub3RlYm9vay5hcGlOb3RlYm9vay5jZWxsQXQoMSkub3V0cHV0c1swXS5pdGVtc1sxXS5taW1lLCAndGV4dC9wbGFpbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChWU0J1ZmZlci53cmFwKG5vdGVib29rLmFwaU5vdGVib29rLmNlbGxBdCgxKS5vdXRwdXRzWzBdLml0ZW1zWzFdLmRhdGEpLnRvU3RyaW5nKCksICdiYXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suYXBpTm90ZWJvb2suY2VsbEF0KDEpLm91dHB1dHNbMF0uaXRlbXNbMl0ubWltZSwgJ3RleHQvcGxhaW4nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoVlNCdWZmZXIud3JhcChub3RlYm9vay5hcGlOb3RlYm9vay5jZWxsQXQoMSkub3V0cHV0c1swXS5pdGVtc1syXS5kYXRhKS50b1N0cmluZygpLCAnYmF6Jyk7XG5cdH0pO1xuXHR0ZXN0KCdBcHBlbmQgbXVsdGlwbGUgc3Rkb3V0IHN0cmVhbSBvdXRwdXQgaXRlbXMgdG8gYW4gb3V0cHV0IHdpdGggYW5vdGhlciBtaW1lJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHJlcGxhY2VPdXRwdXRzKDEsICcxJywgW3sgbWltZTogJ3RleHQvcGxhaW4nLCB2YWx1ZUJ5dGVzOiBWU0J1ZmZlci5mcm9tU3RyaW5nKCdmb28nKSB9XSk7XG5cdFx0YXdhaXQgYXBwZW5kT3V0cHV0SXRlbSgxLCAnMScsIFt7IG1pbWU6ICdhcHBsaWNhdGlvbi92bmQuY29kZS5ub3RlYm9vay5zdGRvdXQnLCB2YWx1ZUJ5dGVzOiBWU0J1ZmZlci5mcm9tU3RyaW5nKCdiYXInKSB9XSk7XG5cdFx0YXdhaXQgYXBwZW5kT3V0cHV0SXRlbSgxLCAnMScsIFt7IG1pbWU6ICdhcHBsaWNhdGlvbi92bmQuY29kZS5ub3RlYm9vay5zdGRvdXQnLCB2YWx1ZUJ5dGVzOiBWU0J1ZmZlci5mcm9tU3RyaW5nKCdiYXonKSB9XSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suYXBpTm90ZWJvb2suY2VsbEF0KDEpLm91dHB1dHMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suYXBpTm90ZWJvb2suY2VsbEF0KDEpLm91dHB1dHNbMF0uaXRlbXMubGVuZ3RoLCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suYXBpTm90ZWJvb2suY2VsbEF0KDEpLm91dHB1dHNbMF0uaXRlbXNbMF0ubWltZSwgJ3RleHQvcGxhaW4nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suYXBpTm90ZWJvb2suY2VsbEF0KDEpLm91dHB1dHNbMF0uaXRlbXNbMV0ubWltZSwgJ2FwcGxpY2F0aW9uL3ZuZC5jb2RlLm5vdGVib29rLnN0ZG91dCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChub3RlYm9vay5hcGlOb3RlYm9vay5jZWxsQXQoMSkub3V0cHV0c1swXS5pdGVtc1syXS5taW1lLCAnYXBwbGljYXRpb24vdm5kLmNvZGUubm90ZWJvb2suc3Rkb3V0Jyk7XG5cdH0pO1xuXHR0ZXN0KCdDb21wcmVzcyBtdWx0aXBsZSBzdGRvdXQgc3RyZWFtIG91dHB1dCBpdGVtcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCByZXBsYWNlT3V0cHV0cygxLCAnMScsIFt7IG1pbWU6ICdhcHBsaWNhdGlvbi92bmQuY29kZS5ub3RlYm9vay5zdGRvdXQnLCB2YWx1ZUJ5dGVzOiBWU0J1ZmZlci5mcm9tU3RyaW5nKCdmb28nKSB9XSk7XG5cdFx0YXdhaXQgYXBwZW5kT3V0cHV0SXRlbSgxLCAnMScsIFt7IG1pbWU6ICdhcHBsaWNhdGlvbi92bmQuY29kZS5ub3RlYm9vay5zdGRvdXQnLCB2YWx1ZUJ5dGVzOiBWU0J1ZmZlci5mcm9tU3RyaW5nKCdiYXInKSB9XSk7XG5cdFx0YXdhaXQgYXBwZW5kT3V0cHV0SXRlbSgxLCAnMScsIFt7IG1pbWU6ICdhcHBsaWNhdGlvbi92bmQuY29kZS5ub3RlYm9vay5zdGRvdXQnLCB2YWx1ZUJ5dGVzOiBWU0J1ZmZlci5mcm9tU3RyaW5nKCdiYXonKSB9XSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suYXBpTm90ZWJvb2suY2VsbEF0KDEpLm91dHB1dHMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suYXBpTm90ZWJvb2suY2VsbEF0KDEpLm91dHB1dHNbMF0uaXRlbXMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suYXBpTm90ZWJvb2suY2VsbEF0KDEpLm91dHB1dHNbMF0uaXRlbXNbMF0ubWltZSwgJ2FwcGxpY2F0aW9uL3ZuZC5jb2RlLm5vdGVib29rLnN0ZG91dCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChWU0J1ZmZlci53cmFwKG5vdGVib29rLmFwaU5vdGVib29rLmNlbGxBdCgxKS5vdXRwdXRzWzBdLml0ZW1zWzBdLmRhdGEpLnRvU3RyaW5nKCksICdmb29iYXJiYXonKTtcblx0fSk7XG5cdHRlc3QoJ0NvbXByZXNzIG11bHRpcGxlIHN0ZG91dCBzdHJlYW0gb3V0cHV0IGl0ZW1zICh3aXRoIHN1cHBvcnQgZm9yIHRlcm1pbmFsIGVzY2FwZSBjb2RlIC0+IFxcdTAwMWJbQSknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgcmVwbGFjZU91dHB1dHMoMSwgJzEnLCBbeyBtaW1lOiAnYXBwbGljYXRpb24vdm5kLmNvZGUubm90ZWJvb2suc3Rkb3V0JywgdmFsdWVCeXRlczogVlNCdWZmZXIuZnJvbVN0cmluZygnXFxuZm9vJykgfV0pO1xuXHRcdGF3YWl0IGFwcGVuZE91dHB1dEl0ZW0oMSwgJzEnLCBbeyBtaW1lOiAnYXBwbGljYXRpb24vdm5kLmNvZGUubm90ZWJvb2suc3Rkb3V0JywgdmFsdWVCeXRlczogVlNCdWZmZXIuZnJvbVN0cmluZyhgJHtTdHJpbmcuZnJvbUNoYXJDb2RlKDI3KX1bQWJhcmApIH1dKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChub3RlYm9vay5hcGlOb3RlYm9vay5jZWxsQXQoMSkub3V0cHV0cy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChub3RlYm9vay5hcGlOb3RlYm9vay5jZWxsQXQoMSkub3V0cHV0c1swXS5pdGVtcy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChub3RlYm9vay5hcGlOb3RlYm9vay5jZWxsQXQoMSkub3V0cHV0c1swXS5pdGVtc1swXS5taW1lLCAnYXBwbGljYXRpb24vdm5kLmNvZGUubm90ZWJvb2suc3Rkb3V0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFZTQnVmZmVyLndyYXAobm90ZWJvb2suYXBpTm90ZWJvb2suY2VsbEF0KDEpLm91dHB1dHNbMF0uaXRlbXNbMF0uZGF0YSkudG9TdHJpbmcoKSwgJ2JhcicpO1xuXHR9KTtcblx0dGVzdCgnQ29tcHJlc3MgbXVsdGlwbGUgc3Rkb3V0IHN0cmVhbSBvdXRwdXQgaXRlbXMgKHdpdGggc3VwcG9ydCBmb3IgdGVybWluYWwgZXNjYXBlIGNvZGUgLT4gXFxyIGNoYXJhY3RlciknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgcmVwbGFjZU91dHB1dHMoMSwgJzEnLCBbeyBtaW1lOiAnYXBwbGljYXRpb24vdm5kLmNvZGUubm90ZWJvb2suc3Rkb3V0JywgdmFsdWVCeXRlczogVlNCdWZmZXIuZnJvbVN0cmluZygnZm9vJykgfV0pO1xuXHRcdGF3YWl0IGFwcGVuZE91dHB1dEl0ZW0oMSwgJzEnLCBbeyBtaW1lOiAnYXBwbGljYXRpb24vdm5kLmNvZGUubm90ZWJvb2suc3Rkb3V0JywgdmFsdWVCeXRlczogVlNCdWZmZXIuZnJvbVN0cmluZyhgXFxyYmFyYCkgfV0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5vdGVib29rLmFwaU5vdGVib29rLmNlbGxBdCgxKS5vdXRwdXRzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5vdGVib29rLmFwaU5vdGVib29rLmNlbGxBdCgxKS5vdXRwdXRzWzBdLml0ZW1zLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5vdGVib29rLmFwaU5vdGVib29rLmNlbGxBdCgxKS5vdXRwdXRzWzBdLml0ZW1zWzBdLm1pbWUsICdhcHBsaWNhdGlvbi92bmQuY29kZS5ub3RlYm9vay5zdGRvdXQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoVlNCdWZmZXIud3JhcChub3RlYm9vay5hcGlOb3RlYm9vay5jZWxsQXQoMSkub3V0cHV0c1swXS5pdGVtc1swXS5kYXRhKS50b1N0cmluZygpLCAnYmFyJyk7XG5cdH0pO1xuXHR0ZXN0KCdDb21wcmVzcyBtdWx0aXBsZSBzdGRlcnIgc3RyZWFtIG91dHB1dCBpdGVtcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCByZXBsYWNlT3V0cHV0cygxLCAnMScsIFt7IG1pbWU6ICdhcHBsaWNhdGlvbi92bmQuY29kZS5ub3RlYm9vay5zdGRlcnInLCB2YWx1ZUJ5dGVzOiBWU0J1ZmZlci5mcm9tU3RyaW5nKCdmb28nKSB9XSk7XG5cdFx0YXdhaXQgYXBwZW5kT3V0cHV0SXRlbSgxLCAnMScsIFt7IG1pbWU6ICdhcHBsaWNhdGlvbi92bmQuY29kZS5ub3RlYm9vay5zdGRlcnInLCB2YWx1ZUJ5dGVzOiBWU0J1ZmZlci5mcm9tU3RyaW5nKCdiYXInKSB9XSk7XG5cdFx0YXdhaXQgYXBwZW5kT3V0cHV0SXRlbSgxLCAnMScsIFt7IG1pbWU6ICdhcHBsaWNhdGlvbi92bmQuY29kZS5ub3RlYm9vay5zdGRlcnInLCB2YWx1ZUJ5dGVzOiBWU0J1ZmZlci5mcm9tU3RyaW5nKCdiYXonKSB9XSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suYXBpTm90ZWJvb2suY2VsbEF0KDEpLm91dHB1dHMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suYXBpTm90ZWJvb2suY2VsbEF0KDEpLm91dHB1dHNbMF0uaXRlbXMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suYXBpTm90ZWJvb2suY2VsbEF0KDEpLm91dHB1dHNbMF0uaXRlbXNbMF0ubWltZSwgJ2FwcGxpY2F0aW9uL3ZuZC5jb2RlLm5vdGVib29rLnN0ZGVycicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChWU0J1ZmZlci53cmFwKG5vdGVib29rLmFwaU5vdGVib29rLmNlbGxBdCgxKS5vdXRwdXRzWzBdLml0ZW1zWzBdLmRhdGEpLnRvU3RyaW5nKCksICdmb29iYXJiYXonKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUVuQixTQUFTLGtDQUFrQztBQUMzQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFlBQVk7QUFDckIsU0FBMEIsbUJBQTBIO0FBQ3BKLFNBQVMsaUNBQWlDO0FBRTFDLFNBQVMsVUFBVSxTQUFTLCtCQUErQjtBQUMzRCxTQUFTLFdBQVc7QUFDcEIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsYUFBYTtBQUN0QixTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLGlDQUFpQztBQUMxQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLCtDQUErQztBQUN4RCxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDZCQUE2QjtBQUV0QyxNQUFNLHlCQUF5QixXQUFZO0FBQzFDLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBRUosUUFBTSxjQUFjLElBQUksTUFBTSx1QkFBdUI7QUFDckQsUUFBTSxjQUFjLElBQUksZ0JBQWdCO0FBRXhDLFdBQVMsV0FBWTtBQUNwQixnQkFBWSxNQUFNO0FBQUEsRUFDbkIsQ0FBQztBQUVELDBDQUF3QztBQUV4QyxRQUFNLGlCQUFrQjtBQUN2QixrQkFBYyxJQUFJLGdCQUFnQjtBQUNsQyxnQkFBWSxJQUFJLFlBQVksb0JBQW9CLElBQUksY0FBYyxLQUE4QixFQUFFO0FBQUEs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
