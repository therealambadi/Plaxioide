import assert from "assert";
import { AsyncIterableObject, DeferredPromise } from "../../../../../base/common/async.js";
import { Event } from "../../../../../base/common/event.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { mock } from "../../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../../editor/common/languages/modesRegistry.js";
import { IMenuService } from "../../../../../platform/actions/common/actions.js";
import { ExtensionIdentifier } from "../../../../../platform/extensions/common/extensions.js";
import { insertCellAtIndex } from "../../browser/controller/cellOperations.js";
import { NotebookExecutionService } from "../../browser/services/notebookExecutionServiceImpl.js";
import { NotebookExecutionStateService } from "../../browser/services/notebookExecutionStateServiceImpl.js";
import { NotebookKernelService } from "../../browser/services/notebookKernelServiceImpl.js";
import { CellEditType, CellKind, CellUri, NotebookExecutionState } from "../../common/notebookCommon.js";
import { CellExecutionUpdateType, INotebookExecutionService } from "../../common/notebookExecutionService.js";
import { INotebookExecutionStateService, NotebookExecutionType } from "../../common/notebookExecutionStateService.js";
import { INotebookKernelService } from "../../common/notebookKernelService.js";
import { INotebookLoggingService } from "../../common/notebookLoggingService.js";
import { INotebookService } from "../../common/notebookService.js";
import { setupInstantiationService, withTestNotebook as _withTestNotebook } from "./testNotebookEditor.js";
suite("NotebookExecutionStateService", () => {
  let instantiationService;
  let kernelService;
  let disposables;
  let testNotebookModel;
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  setup(function() {
    disposables = new DisposableStore();
    instantiationService = setupInstantiationService(disposables);
    instantiationService.stub(INotebookService, new class extends mock() {
      constructor() {
        super(...arguments);
        this.onDidAddNotebookDocument = Event.None;
        this.onWillRemoveNotebookDocument = Event.None;
      }
      getNotebookTextModels() {
        return [];
      }
      getNotebookTextModel(uri) {
        return testNotebookModel;
      }
    }());
    instantiationService.stub(IMenuService, new class extends mock() {
      createMenu() {
        return new class extends mock() {
          constructor() {
            super(...arguments);
            this.onDidChange = Event.None;
          }
          getActions() {
            return [];
          }
          dispose() {
          }
        }();
      }
    }());
    instantiationService.stub(INotebookLoggingService, new class extends mock() {
      debug(category, output) {
      }
    }());
    kernelService = disposables.add(instantiationService.createInstance(NotebookKernelService));
    instantiationService.set(INotebookKernelService, kernelService);
    instantiationService.set(INotebookExecutionService, disposables.add(instantiationService.createInstance(NotebookExecutionService)));
    instantiationService.set(INotebookExecutionStateService, disposables.add(instantiationService.createInstance(NotebookExecutionStateService)));
  });
  async function withTestNotebook(cells, callback) {
    return _withTestNotebook(cells, (editor, viewModel) => callback(viewModel, viewModel.notebookDocument, disposables));
  }
  function testCancelOnDelete(expectedCancels, implementsInterrupt) {
    return withTestNotebook([], async (viewModel, _document, disposables2) => {
      testNotebookModel = viewModel.notebookDocument;
      let cancels = 0;
      const kernel = new class extends TestNotebookKernel {
        constructor() {
          super({ languages: ["javascript"] });
          this.implementsInterrupt = implementsInterrupt;
        }
        async executeNotebookCellsRequest() {
        }
        async cancelNotebookCellExecution(_uri, handles) {
          cancels += handles.length;
        }
      }();
      disposables2.add(kernelService.registerKernel(kernel));
      kernelService.selectKernelForNotebook(kernel, viewModel.notebookDocument);
      const executionStateService = instantiationService.get(INotebookExecutionStateService);
      const cell = disposables2.add(insertCellAtIndex(viewModel, 0, "var c = 3", "javascript", CellKind.Code, {}, [], true, true));
      const cell2 = disposables2.add(insertCellAtIndex(viewModel, 1, "var c = 3", "javascript", CellKind.Code, {}, [], true, true));
      const cell3 = disposables2.add(insertCellAtIndex(viewModel, 2, "var c = 3", "javascript", CellKind.Code, {}, [], true, true));
      insertCellAtIndex(viewModel, 3, "var c = 3", "javascript", CellKind.Code, {}, [], true, true);
      const exe = executionStateService.createCellExecution(viewModel.uri, cell.handle);
      exe.confirm();
      exe.update([{ editType: CellExecutionUpdateType.ExecutionState, executionOrder: 1 }]);
      const exe2 = executionStateService.createCellExecution(viewModel.uri, cell2.handle);
      exe2.confirm();
      executionStateService.createCellExecution(viewModel.uri, cell3.handle);
      assert.strictEqual(cancels, 0);
      viewModel.notebookDocument.applyEdits([{
        editType: CellEditType.Replace,
        index: 0,
        count: 3,
        cells: []
      }], true, void 0, () => void 0, void 0, false);
      assert.strictEqual(cancels, expectedCancels);
    });
  }
  test("cancel execution when cell is deleted", async function() {
    return testCancelOnDelete(3, false);
  });
  test("cancel execution when cell is deleted in interrupt-type kernel", async function() {
    return testCancelOnDelete(1, true);
  });
  test("fires onDidChangeCellExecution when cell is completed while deleted", async function() {
    return withTestNotebook([], async (viewModel, _document, disposables2) => {
      testNotebookModel = viewModel.notebookDocument;
      const kernel = new TestNotebookKernel();
      disposables2.add(kernelService.registerKernel(kernel));
      kernelService.selectKernelForNotebook(kernel, viewModel.notebookDocument);
      const executionStateService = instantiationService.get(INotebookExecutionStateService);
      const cell = insertCellAtIndex(viewModel, 0, "var c = 3", "javascript", CellKind.Code, {}, [], true, true);
      const exe = executionStateService.createCellExecution(viewModel.uri, cell.handle);
      let didFire = false;
      disposables2.add(executionStateService.onDidChangeExecution((e) => {
        if (e.type === NotebookExecutionType.cell) {
          didFire = !e.changed;
        }
      }));
      viewModel.notebookDocument.applyEdits([{
        editType: CellEditType.Replace,
        index: 0,
        count: 1,
        cells: []
      }], true, void 0, () => void 0, void 0, false);
      exe.complete({});
      assert.strictEqual(didFire, true);
    });
  });
  test("does not fire onDidChangeCellExecution for output updates", async function() {
    return withTestNotebook([], async (viewModel, _document, disposables2) => {
      testNotebookModel = viewModel.notebookDocument;
      const kernel = new TestNotebookKernel();
      disposables2.add(kernelService.registerKernel(kernel));
      kernelService.selectKernelForNotebook(kernel, viewModel.notebookDocument);
      const executionStateService = instantiationService.get(INotebookExecutionStateService);
      const cell = disposables2.add(insertCellAtIndex(viewModel, 0, "var c = 3", "javascript", CellKind.Code, {}, [], true, true));
      const exe = executionStateService.createCellExecution(viewModel.uri, cell.handle);
      let didFire = false;
      disposables2.add(executionStateService.onDidChangeExecution((e) => {
        if (e.type === NotebookExecutionType.cell) {
          didFire = true;
        }
      }));
      exe.update([{ editType: CellExecutionUpdateType.OutputItems, items: [], outputId: "1" }]);
      assert.strictEqual(didFire, false);
      exe.update([{ editType: CellExecutionUpdateType.ExecutionState, executionOrder: 123 }]);
      assert.strictEqual(didFire, true);
      exe.complete({});
    });
  });
  test("getCellExecution and onDidChangeCellExecution", async function() {
    return withTestNotebook([], async (viewModel, _document, disposables2) => {
      testNotebookModel = viewModel.notebookDocument;
      const kernel = new TestNotebookKernel();
      disposables2.add(kernelService.registerKernel(kernel));
      kernelService.selectKernelForNotebook(kernel, viewModel.notebookDocument);
      const executionStateService = instantiationService.get(INotebookExecutionStateService);
      const cell = disposables2.add(insertCellAtIndex(viewModel, 0, "var c = 3", "javascript", CellKind.Code, {}, [], true, true));
      const deferred = new DeferredPromise();
      disposables2.add(executionStateService.onDidChangeExecution((e) => {
        if (e.type === NotebookExecutionType.cell) {
          const cellUri = CellUri.generate(e.notebook, e.cellHandle);
          const exe = executionStateService.getCellExecution(cellUri);
          assert.ok(exe);
          assert.strictEqual(e.notebook.toString(), exe.notebook.toString());
          assert.strictEqual(e.cellHandle, exe.cellHandle);
          assert.strictEqual(exe.notebook.toString(), e.changed?.notebook.toString());
          assert.strictEqual(exe.cellHandle, e.changed?.cellHandle);
          deferred.complete();
        }
      }));
      executionStateService.createCellExecution(viewModel.uri, cell.handle);
      return deferred.p;
    });
  });
  test("getExecution and onDidChangeExecution", async function() {
    return withTestNotebook([], async (viewModel, _document, disposables2) => {
      testNotebookModel = viewModel.notebookDocument;
      const kernel = new TestNotebookKernel();
      disposables2.add(kernelService.registerKernel(kernel));
      kernelService.selectKernelForNotebook(kernel, viewModel.notebookDocument);
      const eventRaisedWithExecution = [];
      const executionStateService = instantiationService.get(INotebookExecutionStateService);
      executionStateService.onDidChangeExecution((e) => eventRaisedWithExecution.push(e.type === NotebookExecutionType.notebook && !!e.changed), this, disposables2);
      const deferred = new DeferredPromise();
      disposables2.add(executionStateService.onDidChangeExecution((e) => {
        if (e.type === NotebookExecutionType.notebook) {
          const exe = executionStateService.getExecution(viewModel.uri);
          assert.ok(exe);
          assert.strictEqual(e.notebook.toString(), exe.notebook.toString());
          assert.ok(e.affectsNotebook(viewModel.uri));
          assert.deepStrictEqual(eventRaisedWithExecution, [true]);
          deferred.complete();
        }
      }));
      executionStateService.createExecution(viewModel.uri);
      return deferred.p;
    });
  });
  test("getExecution and onDidChangeExecution 2", async function() {
    return withTestNotebook([], async (viewModel, _document, disposables2) => {
      testNotebookModel = viewModel.notebookDocument;
      const kernel = new TestNotebookKernel();
      disposables2.add(kernelService.registerKernel(kernel));
      kernelService.selectKernelForNotebook(kernel, viewModel.notebookDocument);
      const executionStateService = instantiationService.get(INotebookExecutionStateService);
      const deferred = new DeferredPromise();
      const expectedNotebookEventStates = [NotebookExecutionState.Unconfirmed, NotebookExecutionState.Pending, NotebookExecutionState.Executing, void 0];
      executionStateService.onDidChangeExecution((e) => {
        if (e.type === NotebookExecutionType.notebook) {
          const expectedState = expectedNotebookEventStates.shift();
          if (typeof expectedState === "number") {
            const exe = executionStateService.getExecution(viewModel.uri);
            assert.ok(exe);
            assert.strictEqual(e.notebook.toString(), exe.notebook.toString());
            assert.strictEqual(e.changed?.state, expectedState);
          } else {
            assert.ok(e.changed === void 0);
          }
          assert.ok(e.affectsNotebook(viewModel.uri));
          if (expectedNotebookEventStates.length === 0) {
            deferred.complete();
          }
        }
      }, this, disposables2);
      const execution = executionStateService.createExecution(viewModel.uri);
      execution.confirm();
      execution.begin();
      execution.complete();
      return deferred.p;
    });
  });
  test("force-cancel works for Cell Execution", async function() {
    return withTestNotebook([], async (viewModel, _document, disposables2) => {
      testNotebookModel = viewModel.notebookDocument;
      const kernel = new TestNotebookKernel();
      disposables2.add(kernelService.registerKernel(kernel));
      kernelService.selectKernelForNotebook(kernel, viewModel.notebookDocument);
      const executionStateService = instantiationService.get(INotebookExecutionStateService);
      const cell = disposables2.add(insertCellAtIndex(viewModel, 0, "var c = 3", "javascript", CellKind.Code, {}, [], true, true));
      executionStateService.createCellExecution(viewModel.uri, cell.handle);
      const exe = executionStateService.getCellExecution(cell.uri);
      assert.ok(exe);
      executionStateService.forceCancelNotebookExecutions(viewModel.uri);
      const exe2 = executionStateService.getCellExecution(cell.uri);
      assert.strictEqual(exe2, void 0);
    });
  });
  test("force-cancel works for Notebook Execution", async function() {
    return withTestNotebook([], async (viewModel, _document, disposables2) => {
      testNotebookModel = viewModel.notebookDocument;
      const kernel = new TestNotebookKernel();
      disposables2.add(kernelService.registerKernel(kernel));
      kernelService.selectKernelForNotebook(kernel, viewModel.notebookDocument);
      const eventRaisedWithExecution = [];
      const executionStateService = instantiationService.get(INotebookExecutionStateService);
      executionStateService.onDidChangeExecution((e) => eventRaisedWithExecution.push(e.type === NotebookExecutionType.notebook && !!e.changed), this, disposables2);
      executionStateService.createExecution(viewModel.uri);
      const exe = executionStateService.getExecution(viewModel.uri);
      assert.ok(exe);
      assert.deepStrictEqual(eventRaisedWithExecution, [true]);
      executionStateService.forceCancelNotebookExecutions(viewModel.uri);
      const exe2 = executionStateService.getExecution(viewModel.uri);
      assert.deepStrictEqual(eventRaisedWithExecution, [true, false]);
      assert.strictEqual(exe2, void 0);
    });
  });
  test("force-cancel works for Cell and Notebook Execution", async function() {
    return withTestNotebook([], async (viewModel, _document, disposables2) => {
      testNotebookModel = viewModel.notebookDocument;
      const kernel = new TestNotebookKernel();
      disposables2.add(kernelService.registerKernel(kernel));
      kernelService.selectKernelForNotebook(kernel, viewModel.notebookDocument);
      const executionStateService = instantiationService.get(INotebookExecutionStateService);
      executionStateService.createExecution(viewModel.uri);
      executionStateService.createExecution(viewModel.uri);
      const cellExe = executionStateService.getExecution(viewModel.uri);
      const exe = executionStateService.getExecution(viewModel.uri);
      assert.ok(cellExe);
      assert.ok(exe);
      executionStateService.forceCancelNotebookExecutions(viewModel.uri);
      const cellExe2 = executionStateService.getExecution(viewModel.uri);
      const exe2 = executionStateService.getExecution(viewModel.uri);
      assert.strictEqual(cellExe2, void 0);
      assert.strictEqual(exe2, void 0);
    });
  });
});
class TestNotebookKernel {
  constructor(opts) {
    this.id = "test";
    this.label = "";
    this.viewType = "*";
    this.onDidChange = Event.None;
    this.extension = new ExtensionIdentifier("test");
    this.localResourceRoot = URI.file("/test");
    this.preloadUris = [];
    this.preloadProvides = [];
    this.supportedLanguages = [];
    this.supportedLanguages = opts?.languages ?? [PLAINTEXT_LANGUAGE_ID];
    if (opts?.id) {
      this.id = opts?.id;
    }
  }
  async executeNotebookCellsRequest() {
  }
  async cancelNotebookCellExecution(uri, cellHandles) {
  }
  provideVariables(notebookUri, parentId, kind, start, token) {
    return AsyncIterableObject.EMPTY;
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay90ZXN0L2Jyb3dzZXIvbm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IEFzeW5jSXRlcmFibGVPYmplY3QsIERlZmVycmVkUHJvbWlzZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBtb2NrIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi9tb2NrLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgUExBSU5URVhUX0xBTkdVQUdFX0lEIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbW9kZXNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJTWVudSwgSU1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBpbnNlcnRDZWxsQXRJbmRleCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udHJvbGxlci9jZWxsT3BlcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0V4ZWN1dGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL3NlcnZpY2VzL25vdGVib29rRXhlY3V0aW9uU2VydmljZUltcGwuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL3NlcnZpY2VzL25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlSW1wbC5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0tlcm5lbFNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL3NlcnZpY2VzL25vdGVib29rS2VybmVsU2VydmljZUltcGwuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tWaWV3TW9kZWwgfSBmcm9tICcuLi8uLi9icm93c2VyL3ZpZXdNb2RlbC9ub3RlYm9va1ZpZXdNb2RlbEltcGwuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi9jb21tb24vbW9kZWwvbm90ZWJvb2tUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgQ2VsbEVkaXRUeXBlLCBDZWxsS2luZCwgQ2VsbFVyaSwgSU91dHB1dER0bywgTm90ZWJvb2tDZWxsTWV0YWRhdGEsIE5vdGVib29rRXhlY3V0aW9uU3RhdGUgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgQ2VsbEV4ZWN1dGlvblVwZGF0ZVR5cGUsIElOb3RlYm9va0V4ZWN1dGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tFeGVjdXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSwgTm90ZWJvb2tFeGVjdXRpb25UeXBlIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0tlcm5lbCwgSU5vdGVib29rS2VybmVsU2VydmljZSwgVmFyaWFibGVzUmVzdWx0IH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rS2VybmVsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tMb2dnaW5nU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0xvZ2dpbmdTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va1NlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHNldHVwSW5zdGFudGlhdGlvblNlcnZpY2UsIHdpdGhUZXN0Tm90ZWJvb2sgYXMgX3dpdGhUZXN0Tm90ZWJvb2sgfSBmcm9tICcuL3Rlc3ROb3RlYm9va0VkaXRvci5qcyc7XG5cbnN1aXRlKCdOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZScsICgpID0+IHtcblxuXHRsZXQgaW5zdGFudGlhdGlvblNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZTtcblx0bGV0IGtlcm5lbFNlcnZpY2U6IElOb3RlYm9va0tlcm5lbFNlcnZpY2U7XG5cdGxldCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xuXHRsZXQgdGVzdE5vdGVib29rTW9kZWw6IE5vdGVib29rVGV4dE1vZGVsIHwgdW5kZWZpbmVkO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHNldHVwKGZ1bmN0aW9uICgpIHtcblxuXHRcdGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSBzZXR1cEluc3RhbnRpYXRpb25TZXJ2aWNlKGRpc3Bvc2FibGVzKTtcblxuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSU5vdGVib29rU2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJTm90ZWJvb2tTZXJ2aWNlPigpIHtcblx0XHRcdG92ZXJyaWRlIG9uRGlkQWRkTm90ZWJvb2tEb2N1bWVudCA9IEV2ZW50Lk5vbmU7XG5cdFx0XHRvdmVycmlkZSBvbldpbGxSZW1vdmVOb3RlYm9va0RvY3VtZW50ID0gRXZlbnQuTm9uZTtcblx0XHRcdG92ZXJyaWRlIGdldE5vdGVib29rVGV4dE1vZGVscygpIHsgcmV0dXJuIFtdOyB9XG5cdFx0XHRvdmVycmlkZSBnZXROb3RlYm9va1RleHRNb2RlbCh1cmk6IFVSSSk6IE5vdGVib29rVGV4dE1vZGVsIHwgdW5kZWZpbmVkIHtcblx0XHRcdFx0cmV0dXJuIHRlc3ROb3RlYm9va01vZGVsO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTWVudVNlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SU1lbnVTZXJ2aWNlPigpIHtcblx0XHRcdG92ZXJyaWRlIGNyZWF0ZU1lbnUoKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElNZW51PigpIHtcblx0XHRcdFx0XHRvdmVycmlkZSBvbkRpZENoYW5nZSA9IEV2ZW50Lk5vbmU7XG5cdFx0XHRcdFx0b3ZlcnJpZGUgZ2V0QWN0aW9ucygpIHsgcmV0dXJuIFtdOyB9XG5cdFx0XHRcdFx0b3ZlcnJpZGUgZGlzcG9zZSgpIHsgfVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSU5vdGVib29rTG9nZ2luZ1NlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SU5vdGVib29rTG9nZ2luZ1NlcnZpY2U+KCkge1xuXHRcdFx0b3ZlcnJpZGUgZGVidWcoY2F0ZWdvcnk6IHN0cmluZywgb3V0cHV0OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRcdFx0Ly9cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGtlcm5lbFNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90ZWJvb2tLZXJuZWxTZXJ2aWNlKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc2V0KElOb3RlYm9va0tlcm5lbFNlcnZpY2UsIGtlcm5lbFNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnNldChJTm90ZWJvb2tFeGVjdXRpb25TZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90ZWJvb2tFeGVjdXRpb25TZXJ2aWNlKSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnNldChJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSkpKTtcblx0fSk7XG5cblx0YXN5bmMgZnVuY3Rpb24gd2l0aFRlc3ROb3RlYm9vayhjZWxsczogW3N0cmluZywgc3RyaW5nLCBDZWxsS2luZCwgSU91dHB1dER0b1tdLCBOb3RlYm9va0NlbGxNZXRhZGF0YV1bXSwgY2FsbGJhY2s6ICh2aWV3TW9kZWw6IE5vdGVib29rVmlld01vZGVsLCB0ZXh0TW9kZWw6IE5vdGVib29rVGV4dE1vZGVsLCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPikge1xuXHRcdHJldHVybiBfd2l0aFRlc3ROb3RlYm9vayhjZWxscywgKGVkaXRvciwgdmlld01vZGVsKSA9PiBjYWxsYmFjayh2aWV3TW9kZWwsIHZpZXdNb2RlbC5ub3RlYm9va0RvY3VtZW50LCBkaXNwb3NhYmxlcykpO1xuXHR9XG5cblx0ZnVuY3Rpb24gdGVzdENhbmNlbE9uRGVsZXRlKGV4cGVjdGVkQ2FuY2VsczogbnVtYmVyLCBpbXBsZW1lbnRzSW50ZXJydXB0OiBib29sZWFuKSB7XG5cdFx0cmV0dXJuIHdpdGhUZXN0Tm90ZWJvb2soW10sIGFzeW5jICh2aWV3TW9kZWwsIF9kb2N1bWVudCwgZGlzcG9zYWJsZXMpID0+IHtcblx0XHRcdHRlc3ROb3RlYm9va01vZGVsID0gdmlld01vZGVsLm5vdGVib29rRG9jdW1lbnQ7XG5cblx0XHRcdGxldCBjYW5jZWxzID0gMDtcblx0XHRcdGNvbnN0IGtlcm5lbCA9IG5ldyBjbGFzcyBleHRlbmRzIFRlc3ROb3RlYm9va0tlcm5lbCB7XG5cdFx0XHRcdGltcGxlbWVudHNJbnRlcnJ1cHQgPSBpbXBsZW1lbnRzSW50ZXJydXB0O1xuXG5cdFx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRcdHN1cGVyKHsgbGFuZ3VhZ2VzOiBbJ2phdmFzY3JpcHQnXSB9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdG92ZXJyaWRlIGFzeW5jIGV4ZWN1dGVOb3RlYm9va0NlbGxzUmVxdWVzdCgpOiBQcm9taXNlPHZvaWQ+IHsgfVxuXG5cdFx0XHRcdG92ZXJyaWRlIGFzeW5jIGNhbmNlbE5vdGVib29rQ2VsbEV4ZWN1dGlvbihfdXJpOiBVUkksIGhhbmRsZXM6IG51bWJlcltdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdFx0Y2FuY2VscyArPSBoYW5kbGVzLmxlbmd0aDtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChrZXJuZWxTZXJ2aWNlLnJlZ2lzdGVyS2VybmVsKGtlcm5lbCkpO1xuXHRcdFx0a2VybmVsU2VydmljZS5zZWxlY3RLZXJuZWxGb3JOb3RlYm9vayhrZXJuZWwsIHZpZXdNb2RlbC5ub3RlYm9va0RvY3VtZW50KTtcblxuXHRcdFx0Y29uc3QgZXhlY3V0aW9uU3RhdGVTZXJ2aWNlOiBJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlKTtcblxuXHRcdFx0Ly8gU2hvdWxkIGNhbmNlbCBleGVjdXRpbmcgYW5kIHBlbmRpbmcgY2VsbHMsIHdoZW4ga2VybmVsIGRvZXMgbm90IGltcGxlbWVudCBpbnRlcnJ1cHRcblx0XHRcdGNvbnN0IGNlbGwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zZXJ0Q2VsbEF0SW5kZXgodmlld01vZGVsLCAwLCAndmFyIGMgPSAzJywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCB7fSwgW10sIHRydWUsIHRydWUpKTtcblx0XHRcdGNvbnN0IGNlbGwyID0gZGlzcG9zYWJsZXMuYWRkKGluc2VydENlbGxBdEluZGV4KHZpZXdNb2RlbCwgMSwgJ3ZhciBjID0gMycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwge30sIFtdLCB0cnVlLCB0cnVlKSk7XG5cdFx0XHRjb25zdCBjZWxsMyA9IGRpc3Bvc2FibGVzLmFkZChpbnNlcnRDZWxsQXRJbmRleCh2aWV3TW9kZWwsIDIsICd2YXIgYyA9IDMnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIHt9LCBbXSwgdHJ1ZSwgdHJ1ZSkpO1xuXHRcdFx0aW5zZXJ0Q2VsbEF0SW5kZXgodmlld01vZGVsLCAzLCAndmFyIGMgPSAzJywgJ2phdmFzY3JpcHQnLCBDZWxsS2luZC5Db2RlLCB7fSwgW10sIHRydWUsIHRydWUpOyAvLyBOb3QgZGVsZXRlZFxuXHRcdFx0Y29uc3QgZXhlID0gZXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmNyZWF0ZUNlbGxFeGVjdXRpb24odmlld01vZGVsLnVyaSwgY2VsbC5oYW5kbGUpOyAvLyBFeGVjdXRpbmdcblx0XHRcdGV4ZS5jb25maXJtKCk7XG5cdFx0XHRleGUudXBkYXRlKFt7IGVkaXRUeXBlOiBDZWxsRXhlY3V0aW9uVXBkYXRlVHlwZS5FeGVjdXRpb25TdGF0ZSwgZXhlY3V0aW9uT3JkZXI6IDEgfV0pO1xuXHRcdFx0Y29uc3QgZXhlMiA9IGV4ZWN1dGlvblN0YXRlU2VydmljZS5jcmVhdGVDZWxsRXhlY3V0aW9uKHZpZXdNb2RlbC51cmksIGNlbGwyLmhhbmRsZSk7IC8vIFBlbmRpbmdcblx0XHRcdGV4ZTIuY29uZmlybSgpO1xuXHRcdFx0ZXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmNyZWF0ZUNlbGxFeGVjdXRpb24odmlld01vZGVsLnVyaSwgY2VsbDMuaGFuZGxlKTsgLy8gVW5jb25maXJtZWRcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYW5jZWxzLCAwKTtcblx0XHRcdHZpZXdNb2RlbC5ub3RlYm9va0RvY3VtZW50LmFwcGx5RWRpdHMoW3tcblx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLCBpbmRleDogMCwgY291bnQ6IDMsIGNlbGxzOiBbXVxuXHRcdFx0fV0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYW5jZWxzLCBleHBlY3RlZENhbmNlbHMpO1xuXHRcdH0pO1xuXG5cdH1cblxuXHQvLyBUT0RPQHJvYmxvdSBDb3VsZCBiZSBhIHRlc3QganVzdCBmb3IgTm90ZWJvb2tFeGVjdXRpb25MaXN0ZW5lcnMsIHdoaWNoIGNhbiBiZSBhIHN0YW5kYWxvbmUgY29udHJpYnV0aW9uXG5cdHRlc3QoJ2NhbmNlbCBleGVjdXRpb24gd2hlbiBjZWxsIGlzIGRlbGV0ZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0cmV0dXJuIHRlc3RDYW5jZWxPbkRlbGV0ZSgzLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NhbmNlbCBleGVjdXRpb24gd2hlbiBjZWxsIGlzIGRlbGV0ZWQgaW4gaW50ZXJydXB0LXR5cGUga2VybmVsJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiB0ZXN0Q2FuY2VsT25EZWxldGUoMSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpcmVzIG9uRGlkQ2hhbmdlQ2VsbEV4ZWN1dGlvbiB3aGVuIGNlbGwgaXMgY29tcGxldGVkIHdoaWxlIGRlbGV0ZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0cmV0dXJuIHdpdGhUZXN0Tm90ZWJvb2soW10sIGFzeW5jICh2aWV3TW9kZWwsIF9kb2N1bWVudCwgZGlzcG9zYWJsZXMpID0+IHtcblx0XHRcdHRlc3ROb3RlYm9va01vZGVsID0gdmlld01vZGVsLm5vdGVib29rRG9jdW1lbnQ7XG5cblx0XHRcdGNvbnN0IGtlcm5lbCA9IG5ldyBUZXN0Tm90ZWJvb2tLZXJuZWwoKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChrZXJuZWxTZXJ2aWNlLnJlZ2lzdGVyS2VybmVsKGtlcm5lbCkpO1xuXHRcdFx0a2VybmVsU2VydmljZS5zZWxlY3RLZXJuZWxGb3JOb3RlYm9vayhrZXJuZWwsIHZpZXdNb2RlbC5ub3RlYm9va0RvY3VtZW50KTtcblxuXHRcdFx0Y29uc3QgZXhlY3V0aW9uU3RhdGVTZXJ2aWNlOiBJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGNlbGwgPSBpbnNlcnRDZWxsQXRJbmRleCh2aWV3TW9kZWwsIDAsICd2YXIgYyA9IDMnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIHt9LCBbXSwgdHJ1ZSwgdHJ1ZSk7XG5cdFx0XHRjb25zdCBleGUgPSBleGVjdXRpb25TdGF0ZVNlcnZpY2UuY3JlYXRlQ2VsbEV4ZWN1dGlvbih2aWV3TW9kZWwudXJpLCBjZWxsLmhhbmRsZSk7XG5cblx0XHRcdGxldCBkaWRGaXJlID0gZmFsc2U7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZXhlY3V0aW9uU3RhdGVTZXJ2aWNlLm9uRGlkQ2hhbmdlRXhlY3V0aW9uKGUgPT4ge1xuXHRcdFx0XHRpZiAoZS50eXBlID09PSBOb3RlYm9va0V4ZWN1dGlvblR5cGUuY2VsbCkge1xuXHRcdFx0XHRcdGRpZEZpcmUgPSAhZS5jaGFuZ2VkO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdHZpZXdNb2RlbC5ub3RlYm9va0RvY3VtZW50LmFwcGx5RWRpdHMoW3tcblx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLCBpbmRleDogMCwgY291bnQ6IDEsIGNlbGxzOiBbXVxuXHRcdFx0fV0sIHRydWUsIHVuZGVmaW5lZCwgKCkgPT4gdW5kZWZpbmVkLCB1bmRlZmluZWQsIGZhbHNlKTtcblx0XHRcdGV4ZS5jb21wbGV0ZSh7fSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlkRmlyZSwgdHJ1ZSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RvZXMgbm90IGZpcmUgb25EaWRDaGFuZ2VDZWxsRXhlY3V0aW9uIGZvciBvdXRwdXQgdXBkYXRlcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gd2l0aFRlc3ROb3RlYm9vayhbXSwgYXN5bmMgKHZpZXdNb2RlbCwgX2RvY3VtZW50LCBkaXNwb3NhYmxlcykgPT4ge1xuXHRcdFx0dGVzdE5vdGVib29rTW9kZWwgPSB2aWV3TW9kZWwubm90ZWJvb2tEb2N1bWVudDtcblxuXHRcdFx0Y29uc3Qga2VybmVsID0gbmV3IFRlc3ROb3RlYm9va0tlcm5lbCgpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGtlcm5lbFNlcnZpY2UucmVnaXN0ZXJLZXJuZWwoa2VybmVsKSk7XG5cdFx0XHRrZXJuZWxTZXJ2aWNlLnNlbGVjdEtlcm5lbEZvck5vdGVib29rKGtlcm5lbCwgdmlld01vZGVsLm5vdGVib29rRG9jdW1lbnQpO1xuXG5cdFx0XHRjb25zdCBleGVjdXRpb25TdGF0ZVNlcnZpY2U6IElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgY2VsbCA9IGRpc3Bvc2FibGVzLmFkZChpbnNlcnRDZWxsQXRJbmRleCh2aWV3TW9kZWwsIDAsICd2YXIgYyA9IDMnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIHt9LCBbXSwgdHJ1ZSwgdHJ1ZSkpO1xuXHRcdFx0Y29uc3QgZXhlID0gZXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmNyZWF0ZUNlbGxFeGVjdXRpb24odmlld01vZGVsLnVyaSwgY2VsbC5oYW5kbGUpO1xuXG5cdFx0XHRsZXQgZGlkRmlyZSA9IGZhbHNlO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGV4ZWN1dGlvblN0YXRlU2VydmljZS5vbkRpZENoYW5nZUV4ZWN1dGlvbihlID0+IHtcblx0XHRcdFx0aWYgKGUudHlwZSA9PT0gTm90ZWJvb2tFeGVjdXRpb25UeXBlLmNlbGwpIHtcblx0XHRcdFx0XHRkaWRGaXJlID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHRleGUudXBkYXRlKFt7IGVkaXRUeXBlOiBDZWxsRXhlY3V0aW9uVXBkYXRlVHlwZS5PdXRwdXRJdGVtcywgaXRlbXM6IFtdLCBvdXRwdXRJZDogJzEnIH1dKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWRGaXJlLCBmYWxzZSk7XG5cdFx0XHRleGUudXBkYXRlKFt7IGVkaXRUeXBlOiBDZWxsRXhlY3V0aW9uVXBkYXRlVHlwZS5FeGVjdXRpb25TdGF0ZSwgZXhlY3V0aW9uT3JkZXI6IDEyMyB9XSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlkRmlyZSwgdHJ1ZSk7XG5cdFx0XHRleGUuY29tcGxldGUoe30pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHQvLyAjMTQyNDY2XG5cdHRlc3QoJ2dldENlbGxFeGVjdXRpb24gYW5kIG9uRGlkQ2hhbmdlQ2VsbEV4ZWN1dGlvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gd2l0aFRlc3ROb3RlYm9vayhbXSwgYXN5bmMgKHZpZXdNb2RlbCwgX2RvY3VtZW50LCBkaXNwb3NhYmxlcykgPT4ge1xuXHRcdFx0dGVzdE5vdGVib29rTW9kZWwgPSB2aWV3TW9kZWwubm90ZWJvb2tEb2N1bWVudDtcblxuXHRcdFx0Y29uc3Qga2VybmVsID0gbmV3IFRlc3ROb3RlYm9va0tlcm5lbCgpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGtlcm5lbFNlcnZpY2UucmVnaXN0ZXJLZXJuZWwoa2VybmVsKSk7XG5cdFx0XHRrZXJuZWxTZXJ2aWNlLnNlbGVjdEtlcm5lbEZvck5vdGVib29rKGtlcm5lbCwgdmlld01vZGVsLm5vdGVib29rRG9jdW1lbnQpO1xuXG5cdFx0XHRjb25zdCBleGVjdXRpb25TdGF0ZVNlcnZpY2U6IElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgY2VsbCA9IGRpc3Bvc2FibGVzLmFkZChpbnNlcnRDZWxsQXRJbmRleCh2aWV3TW9kZWwsIDAsICd2YXIgYyA9IDMnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIHt9LCBbXSwgdHJ1ZSwgdHJ1ZSkpO1xuXG5cdFx0XHRjb25zdCBkZWZlcnJlZCA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChleGVjdXRpb25TdGF0ZVNlcnZpY2Uub25EaWRDaGFuZ2VFeGVjdXRpb24oZSA9PiB7XG5cdFx0XHRcdGlmIChlLnR5cGUgPT09IE5vdGVib29rRXhlY3V0aW9uVHlwZS5jZWxsKSB7XG5cdFx0XHRcdFx0Y29uc3QgY2VsbFVyaSA9IENlbGxVcmkuZ2VuZXJhdGUoZS5ub3RlYm9vaywgZS5jZWxsSGFuZGxlKTtcblx0XHRcdFx0XHRjb25zdCBleGUgPSBleGVjdXRpb25TdGF0ZVNlcnZpY2UuZ2V0Q2VsbEV4ZWN1dGlvbihjZWxsVXJpKTtcblx0XHRcdFx0XHRhc3NlcnQub2soZXhlKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZS5ub3RlYm9vay50b1N0cmluZygpLCBleGUubm90ZWJvb2sudG9TdHJpbmcoKSk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGUuY2VsbEhhbmRsZSwgZXhlLmNlbGxIYW5kbGUpO1xuXG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4ZS5ub3RlYm9vay50b1N0cmluZygpLCBlLmNoYW5nZWQ/Lm5vdGVib29rLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGUuY2VsbEhhbmRsZSwgZS5jaGFuZ2VkPy5jZWxsSGFuZGxlKTtcblxuXHRcdFx0XHRcdGRlZmVycmVkLmNvbXBsZXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0ZXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmNyZWF0ZUNlbGxFeGVjdXRpb24odmlld01vZGVsLnVyaSwgY2VsbC5oYW5kbGUpO1xuXG5cdFx0XHRyZXR1cm4gZGVmZXJyZWQucDtcblx0XHR9KTtcblx0fSk7XG5cdHRlc3QoJ2dldEV4ZWN1dGlvbiBhbmQgb25EaWRDaGFuZ2VFeGVjdXRpb24nLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0cmV0dXJuIHdpdGhUZXN0Tm90ZWJvb2soW10sIGFzeW5jICh2aWV3TW9kZWwsIF9kb2N1bWVudCwgZGlzcG9zYWJsZXMpID0+IHtcblx0XHRcdHRlc3ROb3RlYm9va01vZGVsID0gdmlld01vZGVsLm5vdGVib29rRG9jdW1lbnQ7XG5cblx0XHRcdGNvbnN0IGtlcm5lbCA9IG5ldyBUZXN0Tm90ZWJvb2tLZXJuZWwoKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChrZXJuZWxTZXJ2aWNlLnJlZ2lzdGVyS2VybmVsKGtlcm5lbCkpO1xuXHRcdFx0a2VybmVsU2VydmljZS5zZWxlY3RLZXJuZWxGb3JOb3RlYm9vayhrZXJuZWwsIHZpZXdNb2RlbC5ub3RlYm9va0RvY3VtZW50KTtcblxuXHRcdFx0Y29uc3QgZXZlbnRSYWlzZWRXaXRoRXhlY3V0aW9uOiBib29sZWFuW10gPSBbXTtcblx0XHRcdGNvbnN0IGV4ZWN1dGlvblN0YXRlU2VydmljZTogSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSk7XG5cdFx0XHRleGVjdXRpb25TdGF0ZVNlcnZpY2Uub25EaWRDaGFuZ2VFeGVjdXRpb24oZSA9PiBldmVudFJhaXNlZFdpdGhFeGVjdXRpb24ucHVzaChlLnR5cGUgPT09IE5vdGVib29rRXhlY3V0aW9uVHlwZS5ub3RlYm9vayAmJiAhIWUuY2hhbmdlZCksIHRoaXMsIGRpc3Bvc2FibGVzKTtcblxuXHRcdFx0Y29uc3QgZGVmZXJyZWQgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZXhlY3V0aW9uU3RhdGVTZXJ2aWNlLm9uRGlkQ2hhbmdlRXhlY3V0aW9uKGUgPT4ge1xuXHRcdFx0XHRpZiAoZS50eXBlID09PSBOb3RlYm9va0V4ZWN1dGlvblR5cGUubm90ZWJvb2spIHtcblx0XHRcdFx0XHRjb25zdCBleGUgPSBleGVjdXRpb25TdGF0ZVNlcnZpY2UuZ2V0RXhlY3V0aW9uKHZpZXdNb2RlbC51cmkpO1xuXHRcdFx0XHRcdGFzc2VydC5vayhleGUpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlLm5vdGVib29rLnRvU3RyaW5nKCksIGV4ZS5ub3RlYm9vay50b1N0cmluZygpKTtcblx0XHRcdFx0XHRhc3NlcnQub2soZS5hZmZlY3RzTm90ZWJvb2sodmlld01vZGVsLnVyaSkpO1xuXHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZXZlbnRSYWlzZWRXaXRoRXhlY3V0aW9uLCBbdHJ1ZV0pO1xuXHRcdFx0XHRcdGRlZmVycmVkLmNvbXBsZXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0ZXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmNyZWF0ZUV4ZWN1dGlvbih2aWV3TW9kZWwudXJpKTtcblxuXHRcdFx0cmV0dXJuIGRlZmVycmVkLnA7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldEV4ZWN1dGlvbiBhbmQgb25EaWRDaGFuZ2VFeGVjdXRpb24gMicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gd2l0aFRlc3ROb3RlYm9vayhbXSwgYXN5bmMgKHZpZXdNb2RlbCwgX2RvY3VtZW50LCBkaXNwb3NhYmxlcykgPT4ge1xuXHRcdFx0dGVzdE5vdGVib29rTW9kZWwgPSB2aWV3TW9kZWwubm90ZWJvb2tEb2N1bWVudDtcblxuXHRcdFx0Y29uc3Qga2VybmVsID0gbmV3IFRlc3ROb3RlYm9va0tlcm5lbCgpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGtlcm5lbFNlcnZpY2UucmVnaXN0ZXJLZXJuZWwoa2VybmVsKSk7XG5cdFx0XHRrZXJuZWxTZXJ2aWNlLnNlbGVjdEtlcm5lbEZvck5vdGVib29rKGtlcm5lbCwgdmlld01vZGVsLm5vdGVib29rRG9jdW1lbnQpO1xuXG5cdFx0XHRjb25zdCBleGVjdXRpb25TdGF0ZVNlcnZpY2U6IElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UpO1xuXG5cdFx0XHRjb25zdCBkZWZlcnJlZCA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblx0XHRcdGNvbnN0IGV4cGVjdGVkTm90ZWJvb2tFdmVudFN0YXRlczogKE5vdGVib29rRXhlY3V0aW9uU3RhdGUgfCB1bmRlZmluZWQpW10gPSBbTm90ZWJvb2tFeGVjdXRpb25TdGF0ZS5VbmNvbmZpcm1lZCwgTm90ZWJvb2tFeGVjdXRpb25TdGF0ZS5QZW5kaW5nLCBOb3RlYm9va0V4ZWN1dGlvblN0YXRlLkV4ZWN1dGluZywgdW5kZWZpbmVkXTtcblx0XHRcdGV4ZWN1dGlvblN0YXRlU2VydmljZS5vbkRpZENoYW5nZUV4ZWN1dGlvbihlID0+IHtcblx0XHRcdFx0aWYgKGUudHlwZSA9PT0gTm90ZWJvb2tFeGVjdXRpb25UeXBlLm5vdGVib29rKSB7XG5cdFx0XHRcdFx0Y29uc3QgZXhwZWN0ZWRTdGF0ZSA9IGV4cGVjdGVkTm90ZWJvb2tFdmVudFN0YXRlcy5zaGlmdCgpO1xuXHRcdFx0XHRcdGlmICh0eXBlb2YgZXhwZWN0ZWRTdGF0ZSA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGV4ZSA9IGV4ZWN1dGlvblN0YXRlU2VydmljZS5nZXRFeGVjdXRpb24odmlld01vZGVsLnVyaSk7XG5cdFx0XHRcdFx0XHRhc3NlcnQub2soZXhlKTtcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlLm5vdGVib29rLnRvU3RyaW5nKCksIGV4ZS5ub3RlYm9vay50b1N0cmluZygpKTtcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlLmNoYW5nZWQ/LnN0YXRlLCBleHBlY3RlZFN0YXRlKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0YXNzZXJ0Lm9rKGUuY2hhbmdlZCA9PT0gdW5kZWZpbmVkKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRhc3NlcnQub2soZS5hZmZlY3RzTm90ZWJvb2sodmlld01vZGVsLnVyaSkpO1xuXHRcdFx0XHRcdGlmIChleHBlY3RlZE5vdGVib29rRXZlbnRTdGF0ZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHRkZWZlcnJlZC5jb21wbGV0ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSwgdGhpcywgZGlzcG9zYWJsZXMpO1xuXG5cdFx0XHRjb25zdCBleGVjdXRpb24gPSBleGVjdXRpb25TdGF0ZVNlcnZpY2UuY3JlYXRlRXhlY3V0aW9uKHZpZXdNb2RlbC51cmkpO1xuXHRcdFx0ZXhlY3V0aW9uLmNvbmZpcm0oKTtcblx0XHRcdGV4ZWN1dGlvbi5iZWdpbigpO1xuXHRcdFx0ZXhlY3V0aW9uLmNvbXBsZXRlKCk7XG5cblx0XHRcdHJldHVybiBkZWZlcnJlZC5wO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdmb3JjZS1jYW5jZWwgd29ya3MgZm9yIENlbGwgRXhlY3V0aW9uJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiB3aXRoVGVzdE5vdGVib29rKFtdLCBhc3luYyAodmlld01vZGVsLCBfZG9jdW1lbnQsIGRpc3Bvc2FibGVzKSA9PiB7XG5cdFx0XHR0ZXN0Tm90ZWJvb2tNb2RlbCA9IHZpZXdNb2RlbC5ub3RlYm9va0RvY3VtZW50O1xuXG5cdFx0XHRjb25zdCBrZXJuZWwgPSBuZXcgVGVzdE5vdGVib29rS2VybmVsKCk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoa2VybmVsU2VydmljZS5yZWdpc3Rlcktlcm5lbChrZXJuZWwpKTtcblx0XHRcdGtlcm5lbFNlcnZpY2Uuc2VsZWN0S2VybmVsRm9yTm90ZWJvb2soa2VybmVsLCB2aWV3TW9kZWwubm90ZWJvb2tEb2N1bWVudCk7XG5cblx0XHRcdGNvbnN0IGV4ZWN1dGlvblN0YXRlU2VydmljZTogSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSk7XG5cdFx0XHRjb25zdCBjZWxsID0gZGlzcG9zYWJsZXMuYWRkKGluc2VydENlbGxBdEluZGV4KHZpZXdNb2RlbCwgMCwgJ3ZhciBjID0gMycsICdqYXZhc2NyaXB0JywgQ2VsbEtpbmQuQ29kZSwge30sIFtdLCB0cnVlLCB0cnVlKSk7XG5cdFx0XHRleGVjdXRpb25TdGF0ZVNlcnZpY2UuY3JlYXRlQ2VsbEV4ZWN1dGlvbih2aWV3TW9kZWwudXJpLCBjZWxsLmhhbmRsZSk7XG5cdFx0XHRjb25zdCBleGUgPSBleGVjdXRpb25TdGF0ZVNlcnZpY2UuZ2V0Q2VsbEV4ZWN1dGlvbihjZWxsLnVyaSk7XG5cdFx0XHRhc3NlcnQub2soZXhlKTtcblxuXHRcdFx0ZXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmZvcmNlQ2FuY2VsTm90ZWJvb2tFeGVjdXRpb25zKHZpZXdNb2RlbC51cmkpO1xuXHRcdFx0Y29uc3QgZXhlMiA9IGV4ZWN1dGlvblN0YXRlU2VydmljZS5nZXRDZWxsRXhlY3V0aW9uKGNlbGwudXJpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGUyLCB1bmRlZmluZWQpO1xuXHRcdH0pO1xuXHR9KTtcblx0dGVzdCgnZm9yY2UtY2FuY2VsIHdvcmtzIGZvciBOb3RlYm9vayBFeGVjdXRpb24nLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0cmV0dXJuIHdpdGhUZXN0Tm90ZWJvb2soW10sIGFzeW5jICh2aWV3TW9kZWwsIF9kb2N1bWVudCwgZGlzcG9zYWJsZXMpID0+IHtcblx0XHRcdHRlc3ROb3RlYm9va01vZGVsID0gdmlld01vZGVsLm5vdGVib29rRG9jdW1lbnQ7XG5cblx0XHRcdGNvbnN0IGtlcm5lbCA9IG5ldyBUZXN0Tm90ZWJvb2tLZXJuZWwoKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChrZXJuZWxTZXJ2aWNlLnJlZ2lzdGVyS2VybmVsKGtlcm5lbCkpO1xuXHRcdFx0a2VybmVsU2VydmljZS5zZWxlY3RLZXJuZWxGb3JOb3RlYm9vayhrZXJuZWwsIHZpZXdNb2RlbC5ub3RlYm9va0RvY3VtZW50KTtcblx0XHRcdGNvbnN0IGV2ZW50UmFpc2VkV2l0aEV4ZWN1dGlvbjogYm9vbGVhbltdID0gW107XG5cblx0XHRcdGNvbnN0IGV4ZWN1dGlvblN0YXRlU2VydmljZTogSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSk7XG5cdFx0XHRleGVjdXRpb25TdGF0ZVNlcnZpY2Uub25EaWRDaGFuZ2VFeGVjdXRpb24oZSA9PiBldmVudFJhaXNlZFdpdGhFeGVjdXRpb24ucHVzaChlLnR5cGUgPT09IE5vdGVib29rRXhlY3V0aW9uVHlwZS5ub3RlYm9vayAmJiAhIWUuY2hhbmdlZCksIHRoaXMsIGRpc3Bvc2FibGVzKTtcblx0XHRcdGV4ZWN1dGlvblN0YXRlU2VydmljZS5jcmVhdGVFeGVjdXRpb24odmlld01vZGVsLnVyaSk7XG5cdFx0XHRjb25zdCBleGUgPSBleGVjdXRpb25TdGF0ZVNlcnZpY2UuZ2V0RXhlY3V0aW9uKHZpZXdNb2RlbC51cmkpO1xuXHRcdFx0YXNzZXJ0Lm9rKGV4ZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGV2ZW50UmFpc2VkV2l0aEV4ZWN1dGlvbiwgW3RydWVdKTtcblxuXHRcdFx0ZXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmZvcmNlQ2FuY2VsTm90ZWJvb2tFeGVjdXRpb25zKHZpZXdNb2RlbC51cmkpO1xuXHRcdFx0Y29uc3QgZXhlMiA9IGV4ZWN1dGlvblN0YXRlU2VydmljZS5nZXRFeGVjdXRpb24odmlld01vZGVsLnVyaSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGV2ZW50UmFpc2VkV2l0aEV4ZWN1dGlvbiwgW3RydWUsIGZhbHNlXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhlMiwgdW5kZWZpbmVkKTtcblx0XHR9KTtcblx0fSk7XG5cdHRlc3QoJ2ZvcmNlLWNhbmNlbCB3b3JrcyBmb3IgQ2VsbCBhbmQgTm90ZWJvb2sgRXhlY3V0aW9uJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiB3aXRoVGVzdE5vdGVib29rKFtdLCBhc3luYyAodmlld01vZGVsLCBfZG9jdW1lbnQsIGRpc3Bvc2FibGVzKSA9PiB7XG5cdFx0XHR0ZXN0Tm90ZWJvb2tNb2RlbCA9IHZpZXdNb2RlbC5ub3RlYm9va0RvY3VtZW50O1xuXG5cdFx0XHRjb25zdCBrZXJuZWwgPSBuZXcgVGVzdE5vdGVib29rS2VybmVsKCk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoa2VybmVsU2VydmljZS5yZWdpc3Rlcktlcm5lbChrZXJuZWwpKTtcblx0XHRcdGtlcm5lbFNlcnZpY2Uuc2VsZWN0S2VybmVsRm9yTm90ZWJvb2soa2VybmVsLCB2aWV3TW9kZWwubm90ZWJvb2tEb2N1bWVudCk7XG5cblx0XHRcdGNvbnN0IGV4ZWN1dGlvblN0YXRlU2VydmljZTogSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSk7XG5cdFx0XHRleGVjdXRpb25TdGF0ZVNlcnZpY2UuY3JlYXRlRXhlY3V0aW9uKHZpZXdNb2RlbC51cmkpO1xuXHRcdFx0ZXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmNyZWF0ZUV4ZWN1dGlvbih2aWV3TW9kZWwudXJpKTtcblx0XHRcdGNvbnN0IGNlbGxFeGUgPSBleGVjdXRpb25TdGF0ZVNlcnZpY2UuZ2V0RXhlY3V0aW9uKHZpZXdNb2RlbC51cmkpO1xuXHRcdFx0Y29uc3QgZXhlID0gZXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmdldEV4ZWN1dGlvbih2aWV3TW9kZWwudXJpKTtcblx0XHRcdGFzc2VydC5vayhjZWxsRXhlKTtcblx0XHRcdGFzc2VydC5vayhleGUpO1xuXG5cdFx0XHRleGVjdXRpb25TdGF0ZVNlcnZpY2UuZm9yY2VDYW5jZWxOb3RlYm9va0V4ZWN1dGlvbnModmlld01vZGVsLnVyaSk7XG5cdFx0XHRjb25zdCBjZWxsRXhlMiA9IGV4ZWN1dGlvblN0YXRlU2VydmljZS5nZXRFeGVjdXRpb24odmlld01vZGVsLnVyaSk7XG5cdFx0XHRjb25zdCBleGUyID0gZXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmdldEV4ZWN1dGlvbih2aWV3TW9kZWwudXJpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjZWxsRXhlMiwgdW5kZWZpbmVkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGUyLCB1bmRlZmluZWQpO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuXG5jbGFzcyBUZXN0Tm90ZWJvb2tLZXJuZWwgaW1wbGVtZW50cyBJTm90ZWJvb2tLZXJuZWwge1xuXHRpZDogc3RyaW5nID0gJ3Rlc3QnO1xuXHRsYWJlbDogc3RyaW5nID0gJyc7XG5cdHZpZXdUeXBlID0gJyonO1xuXHRvbkRpZENoYW5nZSA9IEV2ZW50Lk5vbmU7XG5cdGV4dGVuc2lvbjogRXh0ZW5zaW9uSWRlbnRpZmllciA9IG5ldyBFeHRlbnNpb25JZGVudGlmaWVyKCd0ZXN0Jyk7XG5cdGxvY2FsUmVzb3VyY2VSb290OiBVUkkgPSBVUkkuZmlsZSgnL3Rlc3QnKTtcblx0ZGVzY3JpcHRpb24/OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGRldGFpbD86IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJlbG9hZFVyaXM6IFVSSVtdID0gW107XG5cdHByZWxvYWRQcm92aWRlczogc3RyaW5nW10gPSBbXTtcblx0c3VwcG9ydGVkTGFuZ3VhZ2VzOiBzdHJpbmdbXSA9IFtdO1xuXHRhc3luYyBleGVjdXRlTm90ZWJvb2tDZWxsc1JlcXVlc3QoKTogUHJvbWlzZTx2b2lkPiB7IH1cblx0YXN5bmMgY2FuY2VsTm90ZWJvb2tDZWxsRXhlY3V0aW9uKHVyaTogVVJJLCBjZWxsSGFuZGxlczogbnVtYmVyW10pOiBQcm9taXNlPHZvaWQ+IHsgfVxuXHRwcm92aWRlVmFyaWFibGVzKG5vdGVib29rVXJpOiBVUkksIHBhcmVudElkOiBudW1iZXIgfCB1bmRlZmluZWQsIGtpbmQ6ICduYW1lZCcgfCAnaW5kZXhlZCcsIHN0YXJ0OiBudW1iZXIsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IEFzeW5jSXRlcmFibGVPYmplY3Q8VmFyaWFibGVzUmVzdWx0PiB7XG5cdFx0cmV0dXJuIEFzeW5jSXRlcmFibGVPYmplY3QuRU1QVFk7XG5cdH1cblxuXHRjb25zdHJ1Y3RvcihvcHRzPzogeyBsYW5ndWFnZXM/OiBzdHJpbmdbXTsgaWQ/OiBzdHJpbmcgfSkge1xuXHRcdHRoaXMuc3VwcG9ydGVkTGFuZ3VhZ2VzID0gb3B0cz8ubGFuZ3VhZ2VzID8/IFtQTEFJTlRFWFRfTEFOR1VBR0VfSURdO1xuXHRcdGlmIChvcHRzPy5pZCkge1xuXHRcdFx0dGhpcy5pZCA9IG9wdHM/LmlkO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMscUJBQXFCLHVCQUF1QjtBQUVyRCxTQUFTLGFBQWE7QUFDdEIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsWUFBWTtBQUNyQixTQUFTLCtDQUErQztBQUN4RCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFnQixvQkFBb0I7QUFDcEMsU0FBUywyQkFBMkI7QUFFcEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUyw2QkFBNkI7QUFHdEMsU0FBUyxjQUFjLFVBQVUsU0FBMkMsOEJBQThCO0FBQzFHLFNBQVMseUJBQXlCLGlDQUFpQztBQUNuRSxTQUFTLGdDQUFnQyw2QkFBNkI7QUFDdEUsU0FBMEIsOEJBQStDO0FBQ3pFLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsMkJBQTJCLG9CQUFvQix5QkFBeUI7QUFFakYsTUFBTSxpQ0FBaUMsTUFBTTtBQUU1QyxNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBRUosV0FBUyxNQUFNO0FBQ2QsZ0JBQVksUUFBUTtBQUFBLEVBQ3JCLENBQUM7QUFFRCwwQ0FBd0M7QUFFeEMsUUFBTSxXQUFZO0FBRWpCLGtCQUFjLElBQUksZ0JBQWdCO0FBRWxDLDJCQUF1QiwwQkFBMEIsV0FBVztBQUU1RCx5QkFBcUIsS0FBSyxrQkFBa0IsSUFBSSxjQUFjLEtBQXVCLEVBQUU7QUFBQSxNQUF2QztBQUFBO0FBQy9DLGFBQVMsMkJBQTJCLE1BQU07QUFDMUMsYUFBUywrQkFBK0IsTUFBTTtBQUFBO0FBQUEsTUFDckMsd0JBQXdCO0FBQUUsZUFBTyxDQUFDO0FBQUEsTUFBRztBQUFBLE1BQ3JDLHFCQUFxQixLQUF5QztBQUN0RSxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0QsR0FBQztBQUVELHlCQUFxQixLQUFLLGNBQWMsSUFBSSxjQUFjLEtBQW1CLEVBQUU7QUFBQSxNQUNyRSxhQUFhO0FBQ3JCLGVBQU8sSUFBSSxjQUFjLEtBQVksRUFBRTtBQUFBLFVBQTVCO0FBQUE7QUFDVixpQkFBUyxjQUFjLE1BQU07QUFBQTtBQUFBLFVBQ3BCLGFBQWE7QUFBRSxtQkFBTyxDQUFDO0FBQUEsVUFBRztBQUFBLFVBQzFCLFVBQVU7QUFBQSxVQUFFO0FBQUEsUUFDdEI7QUFBQSxNQUNEO0FBQUEsSUFDRCxHQUFDO0FBQ0QseUJBQXFCLEtBQUsseUJBQXlCLElBQUksY0FBYyxLQUE4QixFQUFFO0FBQUEsTUFDM0YsTUFBTSxVQUFrQixRQUFzQjtBQUFBLE1BRXZEO0FBQUEsSUFDRCxHQUFDO0FBRUQsb0JBQWdCLFlBQVksSUFBSSxxQkFBcUIsZUFBZSxxQkFBcUIsQ0FBQztBQUMxRix5QkFBcUIsSUFBSSx3QkFBd0IsYUFBYTtBQUM5RCx5QkFBcUIsSUFBSSwyQkFBMkIsWUFBWSxJQUFJLHFCQUFxQixlQUFlLHdCQUF3QixDQUFDLENBQUM7QUFDbEkseUJBQXFCLElBQUksZ0NBQWdDLFlBQVksSUFBSSxxQkFBcUIsZUFBZSw2QkFBNkIsQ0FBQyxDQUFDO0FBQUEsRUFDN0ksQ0FBQztBQUVELGlCQUFlLGlCQUFpQixPQUF5RSxVQUE4SDtBQUN0TyxXQUFPLGtCQUFrQixPQUFPLENBQUMsUUFBUSxjQUFjLFNBQVMsV0FBVyxVQUFVLGtCQUFrQixXQUFXLENBQUM7QUFBQSxFQUNwSDtBQUVBLFdBQVMsbUJBQW1CLGlCQUF5QixxQkFBOEI7QUFDbEYsV0FBTyxpQkFBaUIsQ0FBQyxHQUFHLE9BQU8sV0FBVyxXQUFXQSxpQkFBZ0I7QUFDeEUsMEJBQW9CLFVBQVU7QUFFOUIsVUFBSSxVQUFVO0FBQ2QsWUFBTSxTQUFTLElBQUksY0FBYyxtQkFBbUI7QUFBQSxRQUduRCxjQUFjO0FBQ2IsZ0JBQU0sRUFBRSxXQUFXLENBQUMsWUFBWSxFQUFFLENBQUM7QUFIcEMscUNBQXNCO0FBQUEsUUFJdEI7QUFBQSxRQUVBLE1BQWUsOEJBQTZDO0FBQUEsUUFBRTtBQUFBLFFBRTlELE1BQWUsNEJBQTRCLE1BQVcsU0FBa0M7QUFDdkYscUJBQVcsUUFBUTtBQUFBLFFBQ3BCO0FBQUEsTUFDRDtBQUNBLE1BQUFBLGFBQVksSUFBSSxjQUFjLGVBQWUsTUFBTSxDQUFDO0FBQ3BELG9CQUFjLHdCQUF3QixRQUFRLFVBQVUsZ0JBQWdCO0FBRXhFLFlBQU0sd0JBQXdELHFCQUFxQixJQUFJLDhCQUE4QjtBQUdySCxZQUFNLE9BQU9BLGFBQVksSUFBSSxrQkFBa0IsV0FBVyxHQUFHLGFBQWEsY0FBYyxTQUFTLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNLElBQUksQ0FBQztBQUMxSCxZQUFNLFFBQVFBLGFBQVksSUFBSSxrQkFBa0IsV0FBVyxHQUFHLGFBQWEsY0FBYyxTQUFTLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNLElBQUksQ0FBQztBQUMzSCxZQUFNLFFBQVFBLGFBQVksSUFBSSxrQkFBa0IsV0FBVyxHQUFHLGFBQWEsY0FBYyxTQUFTLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNLElBQUksQ0FBQztBQUMzSCx3QkFBa0IsV0FBVyxHQUFHLGFBQWEsY0FBYyxTQUFTLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNLElBQUk7QUFDNUYsWUFBTSxNQUFNLHNCQUFzQixvQkFBb0IsVUFBVSxLQUFLLEtBQUssTUFBTTtBQUNoRixVQUFJLFFBQVE7QUFDWixVQUFJLE9BQU8sQ0FBQyxFQUFFLFVBQVUsd0JBQXdCLGdCQUFnQixnQkFBZ0IsRUFBRSxDQUFDLENBQUM7QUFDcEYsWUFBTSxPQUFPLHNCQUFzQixvQkFBb0IsVUFBVSxLQUFLLE1BQU0sTUFBTTtBQUNsRixXQUFLLFFBQVE7QUFDYiw0QkFBc0Isb0JBQW9CLFVBQVUsS0FBSyxNQUFNLE1BQU07QUFDckUsYUFBTyxZQUFZLFNBQVMsQ0FBQztBQUM3QixnQkFBVSxpQkFBaUIsV0FBVyxDQUFDO0FBQUEsUUFDdEMsVUFBVSxhQUFhO0FBQUEsUUFBUyxPQUFPO0FBQUEsUUFBRyxPQUFPO0FBQUEsUUFBRyxPQUFPLENBQUM7QUFBQSxNQUM3RCxDQUFDLEdBQUcsTUFBTSxRQUFXLE1BQU0sUUFBVyxRQUFXLEtBQUs7QUFDdEQsYUFBTyxZQUFZLFNBQVMsZUFBZTtBQUFBLElBQzVDLENBQUM7QUFBQSxFQUVGO0FBR0EsT0FBSyx5Q0FBeUMsaUJBQWtCO0FBQy9ELFdBQU8sbUJBQW1CLEdBQUcsS0FBSztBQUFBLEVBQ25DLENBQUM7QUFFRCxPQUFLLGtFQUFrRSxpQkFBa0I7QUFDeEYsV0FBTyxtQkFBbUIsR0FBRyxJQUFJO0FBQUEsRUFDbEMsQ0FBQztBQUVELE9BQUssdUVBQXVFLGlCQUFrQjtBQUM3RixXQUFPLGlCQUFpQixDQUFDLEdBQUcsT0FBTyxXQUFXLFdBQVdBLGlCQUFnQjtBQUN4RSwwQkFBb0IsVUFBVTtBQUU5QixZQUFNLFNBQVMsSUFBSSxtQkFBbUI7QUFDdEMsTUFBQUEsYUFBWSxJQUFJLGNBQWMsZUFBZSxNQUFNLENBQUM7QUFDcEQsb0JBQWMsd0JBQXdCLFFBQVEsVUFBVSxnQkFBZ0I7QUFFeEUsWUFBTSx3QkFBd0QscUJBQXFCLElBQUksOEJBQThCO0FBQ3JILFlBQU0sT0FBTyxrQkFBa0IsV0FBVyxHQUFHLGFBQWEsY0FBYyxTQUFTLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNLElBQUk7QUFDekcsWUFBTSxNQUFNLHNCQUFzQixvQkFBb0IsVUFBVSxLQUFLLEtBQUssTUFBTTtBQUVoRixVQUFJLFVBQVU7QUFDZCxNQUFBQSxhQUFZLElBQUksc0JBQXNCLHFCQUFxQixPQUFLO0FBQy9ELFlBQUksRUFBRSxTQUFTLHNCQUFzQixNQUFNO0FBQzFDLG9CQUFVLENBQUMsRUFBRTtBQUFBLFFBQ2Q7QUFBQSxNQUNELENBQUMsQ0FBQztBQUVGLGdCQUFVLGlCQUFpQixXQUFXLENBQUM7QUFBQSxRQUN0QyxVQUFVLGFBQWE7QUFBQSxRQUFTLE9BQU87QUFBQSxRQUFHLE9BQU87QUFBQSxRQUFHLE9BQU8sQ0FBQztBQUFBLE1BQzdELENBQUMsR0FBRyxNQUFNLFFBQVcsTUFBTSxRQUFXLFFBQVcsS0FBSztBQUN0RCxVQUFJLFNBQVMsQ0FBQyxDQUFDO0FBQ2YsYUFBTyxZQUFZLFNBQVMsSUFBSTtBQUFBLElBQ2pDLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLDZEQUE2RCxpQkFBa0I7QUFDbkYsV0FBTyxpQkFBaUIsQ0FBQyxHQUFHLE9BQU8sV0FBVyxXQUFXQSxpQkFBZ0I7QUFDeEUsMEJBQW9CLFVBQVU7QUFFOUIsWUFBTSxTQUFTLElBQUksbUJBQW1CO0FBQ3RDLE1BQUFBLGFBQVksSUFBSSxjQUFjLGVBQWUsTUFBTSxDQUFDO0FBQ3BELG9CQUFjLHdCQUF3QixRQUFRLFVBQVUsZ0JBQWdCO0FBRXhFLFlBQU0sd0JBQXdELHFCQUFxQixJQUFJLDhCQUE4QjtBQUNySCxZQUFNLE9BQU9BLGFBQVksSUFBSSxrQkFBa0IsV0FBVyxHQUFHLGFBQWEsY0FBYyxTQUFTLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNLElBQUksQ0FBQztBQUMxSCxZQUFNLE1BQU0sc0JBQXNCLG9CQUFvQixVQUFVLEtBQUssS0FBSyxNQUFNO0FBRWhGLFVBQUksVUFBVTtBQUNkLE1BQUFBLGFBQVksSUFBSSxzQkFBc0IscUJBQXFCLE9BQUs7QUFDL0QsWUFBSSxFQUFFLFNBQVMsc0JBQXNCLE1BQU07QUFDMUMsb0JBQVU7QUFBQSxRQUNYO0FBQUEsTUFDRCxDQUFDLENBQUM7QUFFRixVQUFJLE9BQU8sQ0FBQyxFQUFFLFVBQVUsd0JBQXdCLGFBQWEsT0FBTyxDQUFDLEdBQUcsVUFBVSxJQUFJLENBQUMsQ0FBQztBQUN4RixhQUFPLFlBQVksU0FBUyxLQUFLO0FBQ2pDLFVBQUksT0FBTyxDQUFDLEVBQUUsVUFBVSx3QkFBd0IsZ0JBQWdCLGdCQUFnQixJQUFJLENBQUMsQ0FBQztBQUN0RixhQUFPLFlBQVksU0FBUyxJQUFJO0FBQ2hDLFVBQUksU0FBUyxDQUFDLENBQUM7QUFBQSxJQUNoQixDQUFDO0FBQUEsRUFDRixDQUFDO0FBR0QsT0FBSyxpREFBaUQsaUJBQWtCO0FBQ3ZFLFdBQU8saUJBQWlCLENBQUMsR0FBRyxPQUFPLFdBQVcsV0FBV0EsaUJBQWdCO0FBQ3hFLDBCQUFvQixVQUFVO0FBRTlCLFlBQU0sU0FBUyxJQUFJLG1CQUFtQjtBQUN0QyxNQUFBQSxhQUFZLElBQUksY0FBYyxlQUFlLE1BQU0sQ0FBQztBQUNwRCxvQkFBYyx3QkFBd0IsUUFBUSxVQUFVLGdCQUFnQjtBQUV4RSxZQUFNLHdCQUF3RCxxQkFBcUIsSUFBSSw4QkFBOEI7QUFDckgsWUFBTSxPQUFPQSxhQUFZLElBQUksa0JBQWtCLFdBQVcsR0FBRyxhQUFhLGNBQWMsU0FBUyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsTUFBTSxJQUFJLENBQUM7QUFFMUgsWUFBTSxXQUFXLElBQUksZ0JBQXNCO0FBQzNDLE1BQUFBLGFBQVksSUFBSSxzQkFBc0IscUJBQXFCLE9BQUs7QUFDL0QsWUFBSSxFQUFFLFNBQVMsc0JBQXNCLE1BQU07QUFDMUMsZ0JBQU0sVUFBVSxRQUFRLFNBQVMsRUFBRSxVQUFVLEVBQUUsVUFBVTtBQUN6RCxnQkFBTSxNQUFNLHNCQUFzQixpQkFBaUIsT0FBTztBQUMxRCxpQkFBTyxHQUFHLEdBQUc7QUFDYixpQkFBTyxZQUFZLEVBQUUsU0FBUyxTQUFTLEdBQUcsSUFBSSxTQUFTLFNBQVMsQ0FBQztBQUNqRSxpQkFBTyxZQUFZLEVBQUUsWUFBWSxJQUFJLFVBQVU7QUFFL0MsaUJBQU8sWUFBWSxJQUFJLFNBQVMsU0FBUyxHQUFHLEVBQUUsU0FBUyxTQUFTLFNBQVMsQ0FBQztBQUMxRSxpQkFBTyxZQUFZLElBQUksWUFBWSxFQUFFLFNBQVMsVUFBVTtBQUV4RCxtQkFBUyxTQUFTO0FBQUEsUUFDbkI7QUFBQSxNQUNELENBQUMsQ0FBQztBQUVGLDRCQUFzQixvQkFBb0IsVUFBVSxLQUFLLEtBQUssTUFBTTtBQUVwRSxhQUFPLFNBQVM7QUFBQSxJQUNqQixDQUFDO0FBQUEsRUFDRixDQUFDO0FBQ0QsT0FBSyx5Q0FBeUMsaUJBQWtCO0FBQy9ELFdBQU8saUJBQWlCLENBQUMsR0FBRyxPQUFPLFdBQVcsV0FBV0EsaUJBQWdCO0FBQ3hFLDBCQUFvQixVQUFVO0FBRTlCLFlBQU0sU0FBUyxJQUFJLG1CQUFtQjtBQUN0QyxNQUFBQSxhQUFZLElBQUksY0FBYyxlQUFlLE1BQU0sQ0FBQztBQUNwRCxvQkFBYyx3QkFBd0IsUUFBUSxVQUFVLGdCQUFnQjtBQUV4RSxZQUFNLDJCQUFzQyxDQUFDO0FBQzdDLFlBQU0sd0JBQXdELHFCQUFxQixJQUFJLDhCQUE4QjtBQUNySCw0QkFBc0IscUJBQXFCLE9BQUsseUJBQXlCLEtBQUssRUFBRSxTQUFTLHNCQUFzQixZQUFZLENBQUMsQ0FBQyxFQUFFLE9BQU8sR0FBRyxNQUFNQSxZQUFXO0FBRTFKLFlBQU0sV0FBVyxJQUFJLGdCQUFzQjtBQUMzQyxNQUFBQSxhQUFZLElBQUksc0JBQXNCLHFCQUFxQixPQUFLO0FBQy9ELFlBQUksRUFBRSxTQUFTLHNCQUFzQixVQUFVO0FBQzlDLGdCQUFNLE1BQU0sc0JBQXNCLGFBQWEsVUFBVSxHQUFHO0FBQzVELGlCQUFPLEdBQUcsR0FBRztBQUNiLGlCQUFPLFlBQVksRUFBRSxTQUFTLFNBQVMsR0FBRyxJQUFJLFNBQVMsU0FBUyxDQUFDO0FBQ2pFLGlCQUFPLEdBQUcsRUFBRSxnQkFBZ0IsVUFBVSxHQUFHLENBQUM7QUFDMUMsaUJBQU8sZ0JBQWdCLDBCQUEwQixDQUFDLElBQUksQ0FBQztBQUN2RCxtQkFBUyxTQUFTO0FBQUEsUUFDbkI7QUFBQSxNQUNELENBQUMsQ0FBQztBQUVGLDRCQUFzQixnQkFBZ0IsVUFBVSxHQUFHO0FBRW5ELGFBQU8sU0FBUztBQUFBLElBQ2pCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLDJDQUEyQyxpQkFBa0I7QUFDakUsV0FBTyxpQkFBaUIsQ0FBQyxHQUFHLE9BQU8sV0FBVyxXQUFXQSxpQkFBZ0I7QUFDeEUsMEJBQW9CLFVBQVU7QUFFOUIsWUFBTSxTQUFTLElBQUksbUJBQW1CO0FBQ3RDLE1BQUFBLGFBQVksSUFBSSxjQUFjLGVBQWUsTUFBTSxDQUFDO0FBQ3BELG9CQUFjLHdCQUF3QixRQUFRLFVBQVUsZ0JBQWdCO0FBRXhFLFlBQU0sd0JBQXdELHFCQUFxQixJQUFJLDhCQUE4QjtBQUVySCxZQUFNLFdBQVcsSUFBSSxnQkFBc0I7QUFDM0MsWUFBTSw4QkFBc0UsQ0FBQyx1QkFBdUIsYUFBYSx1QkFBdUIsU0FBUyx1QkFBdUIsV0FBVyxNQUFTO0FBQzVMLDRCQUFzQixxQkFBcUIsT0FBSztBQUMvQyxZQUFJLEVBQUUsU0FBUyxzQkFBc0IsVUFBVTtBQUM5QyxnQkFBTSxnQkFBZ0IsNEJBQTRCLE1BQU07QUFDeEQsY0FBSSxPQUFPLGtCQUFrQixVQUFVO0FBQ3RDLGtCQUFNLE1BQU0sc0JBQXNCLGFBQWEsVUFBVSxHQUFHO0FBQzVELG1CQUFPLEdBQUcsR0FBRztBQUNiLG1CQUFPLFlBQVksRUFBRSxTQUFTLFNBQVMsR0FBRyxJQUFJLFNBQVMsU0FBUyxDQUFDO0FBQ2pFLG1CQUFPLFlBQVksRUFBRSxTQUFTLE9BQU8sYUFBYTtBQUFBLFVBQ25ELE9BQU87QUFDTixtQkFBTyxHQUFHLEVBQUUsWUFBWSxNQUFTO0FBQUEsVUFDbEM7QUFFQSxpQkFBTyxHQUFHLEVBQUUsZ0JBQWdCLFVBQVUsR0FBRyxDQUFDO0FBQzFDLGNBQUksNEJBQTRCLFdBQVcsR0FBRztBQUM3QyxxQkFBUyxTQUFTO0FBQUEsVUFDbkI7QUFBQSxRQUNEO0FBQUEsTUFDRCxHQUFHLE1BQU1BLFlBQVc7QUFFcEIsWUFBTSxZQUFZLHNCQUFzQixnQkFBZ0IsVUFBVSxHQUFHO0FBQ3JFLGdCQUFVLFFBQVE7QUFDbEIsZ0JBQVUsTUFBTTtBQUNoQixnQkFBVSxTQUFTO0FBRW5CLGFBQU8sU0FBUztBQUFBLElBQ2pCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLHlDQUF5QyxpQkFBa0I7QUFDL0QsV0FBTyxpQkFBaUIsQ0FBQyxHQUFHLE9BQU8sV0FBVyxXQUFXQSxpQkFBZ0I7QUFDeEUsMEJBQW9CLFVBQVU7QUFFOUIsWUFBTSxTQUFTLElBQUksbUJBQW1CO0FBQ3RDLE1BQUFBLGFBQVksSUFBSSxjQUFjLGVBQWUsTUFBTSxDQUFDO0FBQ3BELG9CQUFjLHdCQUF3QixRQUFRLFVBQVUsZ0JBQWdCO0FBRXhFLFlBQU0sd0JBQXdELHFCQUFxQixJQUFJLDhCQUE4QjtBQUNySCxZQUFNLE9BQU9BLGFBQVksSUFBSSxrQkFBa0IsV0FBVyxHQUFHLGFBQWEsY0FBYyxTQUFTLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNLElBQUksQ0FBQztBQUMxSCw0QkFBc0Isb0JBQW9CLFVBQVUsS0FBSyxLQUFLLE1BQU07QUFDcEUsWUFBTSxNQUFNLHNCQUFzQixpQkFBaUIsS0FBSyxHQUFHO0FBQzNELGFBQU8sR0FBRyxHQUFHO0FBRWIsNEJBQXNCLDhCQUE4QixVQUFVLEdBQUc7QUFDakUsWUFBTSxPQUFPLHNCQUFzQixpQkFBaUIsS0FBSyxHQUFHO0FBQzVELGFBQU8sWUFBWSxNQUFNLE1BQVM7QUFBQSxJQUNuQyxDQUFDO0FBQUEsRUFDRixDQUFDO0FBQ0QsT0FBSyw2Q0FBNkMsaUJBQWtCO0FBQ25FLFdBQU8saUJBQWlCLENBQUMsR0FBRyxPQUFPLFdBQVcsV0FBV0EsaUJBQWdCO0FBQ3hFLDBCQUFvQixVQUFVO0FBRTlCLFlBQU0sU0FBUyxJQUFJLG1CQUFtQjtBQUN0QyxNQUFBQSxhQUFZLElBQUksY0FBYyxlQUFlLE1BQU0sQ0FBQztBQUNwRCxvQkFBYyx3QkFBd0IsUUFBUSxVQUFVLGdCQUFnQjtBQUN4RSxZQUFNLDJCQUFzQyxDQUFDO0FBRTdDLFlBQU0sd0JBQXdELHFCQUFxQixJQUFJLDhCQUE4QjtBQUNySCw0QkFBc0IscUJBQXFCLE9BQUsseUJBQXlCLEtBQUssRUFBRSxTQUFTLHNCQUFzQixZQUFZLENBQUMsQ0FBQyxFQUFFLE9BQU8sR0FBRyxNQUFNQSxZQUFXO0FBQzFKLDRCQUFzQixnQkFBZ0IsVUFBVSxHQUFHO0FBQ25ELFlBQU0sTUFBTSxzQkFBc0IsYUFBYSxVQUFVLEdBQUc7QUFDNUQsYUFBTyxHQUFHLEdBQUc7QUFDYixhQUFPLGdCQUFnQiwwQkFBMEIsQ0FBQyxJQUFJLENBQUM7QUFFdkQsNEJBQXNCLDhCQUE4QixVQUFVLEdBQUc7QUFDakUsWUFBTSxPQUFPLHNCQUFzQixhQUFhLFVBQVUsR0FBRztBQUM3RCxhQUFPLGdCQUFnQiwwQkFBMEIsQ0FBQyxNQUFNLEtBQUssQ0FBQztBQUM5RCxhQUFPLFlBQVksTUFBTSxNQUFTO0FBQUEsSUFDbkMsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUNELE9BQUssc0RBQXNELGlCQUFrQjtBQUM1RSxXQUFPLGlCQUFpQixDQUFDLEdBQUcsT0FBTyxXQUFXLFdBQVdBLGlCQUFnQjtBQUN4RSwwQkFBb0IsVUFBVTtBQUU5QixZQUFNLFNBQVMsSUFBSSxtQkFBbUI7QUFDdEMsTUFBQUEsYUFBWSxJQUFJLGNBQWMsZUFBZSxNQUFNLENBQUM7QUFDcEQsb0JBQWMsd0JBQXdCLFFBQVEsVUFBVSxnQkFBZ0I7QUFFeEUsWUFBTSx3QkFBd0QscUJBQXFCLElBQUksOEJBQThCO0FBQ3JILDRCQUFzQixnQkFBZ0IsVUFBVSxHQUFHO0FBQ25ELDRCQUFzQixnQkFBZ0IsVUFBVSxHQUFHO0FBQ25ELFlBQU0sVUFBVSxzQkFBc0IsYUFBYSxVQUFVLEdBQUc7QUFDaEUsWUFBTSxNQUFNLHNCQUFzQixhQUFhLFVBQVUsR0FBRztBQUM1RCxhQUFPLEdBQUcsT0FBTztBQUNqQixhQUFPLEdBQUcsR0FBRztBQUViLDRCQUFzQiw4QkFBOEIsVUFBVSxHQUFHO0FBQ2pFLFlBQU0sV0FBVyxzQkFBc0IsYUFBYSxVQUFVLEdBQUc7QUFDakUsWUFBTSxPQUFPLHNCQUFzQixhQUFhLFVBQVUsR0FBRztBQUM3RCxhQUFPLFlBQVksVUFBVSxNQUFTO0FBQ3RDLGFBQU8sWUFBWSxNQUFNLE1BQVM7QUFBQSxJQUNuQyxDQUFDO0FBQUEsRUFDRixDQUFDO0FBQ0YsQ0FBQztBQUVELE1BQU0sbUJBQThDO0FBQUEsRUFrQm5ELFlBQVksTUFBOEM7QUFqQjFELGNBQWE7QUFDYixpQkFBZ0I7QUFDaEIsb0JBQVc7QUFDWCx1QkFBYyxNQUFNO0FBQ3BCLHFCQUFpQyxJQUFJLG9CQUFvQixNQUFNO0FBQy9ELDZCQUF5QixJQUFJLEtBQUssT0FBTztBQUd6Qyx1QkFBcUIsQ0FBQztBQUN0QiwyQkFBNEIsQ0FBQztBQUM3Qiw4QkFBK0IsQ0FBQztBQVEvQixTQUFLLHFCQUFxQixNQUFNLGFBQWEsQ0FBQyxxQkFBcUI7QUFDbkUsUUFBSSxNQUFNLElBQUk7QUFDYixXQUFLLEtBQUssTUFBTTtBQUFBLElBQ2pCO0FBQUEsRUFDRDtBQUFBLEVBWEEsTUFBTSw4QkFBNkM7QUFBQSxFQUFFO0FBQUEsRUFDckQsTUFBTSw0QkFBNEIsS0FBVSxhQUFzQztBQUFBLEVBQUU7QUFBQSxFQUNwRixpQkFBaUIsYUFBa0IsVUFBOEIsTUFBMkIsT0FBZSxPQUFnRTtBQUMxSyxXQUFPLG9CQUFvQjtBQUFBLEVBQzVCO0FBUUQ7IiwKICAibmFtZXMiOiBbImRpc3Bvc2FibGVzIl0KfQo=
