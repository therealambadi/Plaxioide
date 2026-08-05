import assert from "assert";
import { bufferToStream, VSBuffer } from "../../../../../base/common/buffer.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { Mimes } from "../../../../../base/common/mime.js";
import { URI } from "../../../../../base/common/uri.js";
import { mock } from "../../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { ExtensionIdentifier } from "../../../../../platform/extensions/common/extensions.js";
import { NotebookTextModel } from "../../common/model/notebookTextModel.js";
import { CellKind, NotebookSetting } from "../../common/notebookCommon.js";
import { NotebookFileWorkingCopyModel } from "../../common/notebookEditorModel.js";
import { SimpleNotebookProviderInfo } from "../../common/notebookService.js";
import { setupInstantiationService } from "./testNotebookEditor.js";
import { SnapshotContext } from "../../../../services/workingCopy/common/fileWorkingCopy.js";
suite("NotebookFileWorkingCopyModel", function() {
  let disposables;
  let instantiationService;
  const configurationService = new TestConfigurationService();
  const telemetryService = new class extends mock() {
    publicLogError2() {
    }
  }();
  const logservice = new class extends mock() {
  }();
  teardown(() => disposables.dispose());
  ensureNoDisposablesAreLeakedInTestSuite();
  setup(() => {
    disposables = new DisposableStore();
    instantiationService = setupInstantiationService(disposables);
  });
  test("no transient output is send to serializer", async function() {
    const notebook = instantiationService.createInstance(
      NotebookTextModel,
      "notebook",
      URI.file("test"),
      [{ cellKind: CellKind.Code, language: "foo", mime: "foo", source: "foo", outputs: [{ outputId: "id", outputs: [{ mime: Mimes.text, data: VSBuffer.fromString("Hello Out") }] }] }],
      {},
      { transientCellMetadata: {}, transientDocumentMetadata: {}, cellContentMetadata: {}, transientOutputs: false }
    );
    {
      let callCount = 0;
      const model = disposables.add(new NotebookFileWorkingCopyModel(
        notebook,
        mockNotebookService(
          notebook,
          new class extends mock() {
            constructor() {
              super(...arguments);
              this.options = { transientOutputs: true, transientCellMetadata: {}, transientDocumentMetadata: {}, cellContentMetadata: {} };
            }
            async notebookToData(notebook2) {
              callCount += 1;
              assert.strictEqual(notebook2.cells.length, 1);
              assert.strictEqual(notebook2.cells[0].outputs.length, 0);
              return VSBuffer.fromString("");
            }
          }()
        ),
        configurationService,
        telemetryService,
        logservice
      ));
      await model.snapshot(SnapshotContext.Save, CancellationToken.None);
      assert.strictEqual(callCount, 1);
    }
    {
      let callCount = 0;
      const model = disposables.add(new NotebookFileWorkingCopyModel(
        notebook,
        mockNotebookService(
          notebook,
          new class extends mock() {
            constructor() {
              super(...arguments);
              this.options = { transientOutputs: false, transientCellMetadata: {}, transientDocumentMetadata: {}, cellContentMetadata: {} };
            }
            async notebookToData(notebook2) {
              callCount += 1;
              assert.strictEqual(notebook2.cells.length, 1);
              assert.strictEqual(notebook2.cells[0].outputs.length, 1);
              return VSBuffer.fromString("");
            }
          }()
        ),
        configurationService,
        telemetryService,
        logservice
      ));
      await model.snapshot(SnapshotContext.Save, CancellationToken.None);
      assert.strictEqual(callCount, 1);
    }
  });
  test("no transient metadata is send to serializer", async function() {
    const notebook = instantiationService.createInstance(
      NotebookTextModel,
      "notebook",
      URI.file("test"),
      [{ cellKind: CellKind.Code, language: "foo", mime: "foo", source: "foo", outputs: [] }],
      { foo: 123, bar: 456 },
      { transientCellMetadata: {}, transientDocumentMetadata: {}, cellContentMetadata: {}, transientOutputs: false }
    );
    disposables.add(notebook);
    {
      let callCount = 0;
      const model = disposables.add(new NotebookFileWorkingCopyModel(
        notebook,
        mockNotebookService(
          notebook,
          new class extends mock() {
            constructor() {
              super(...arguments);
              this.options = { transientOutputs: true, transientCellMetadata: {}, transientDocumentMetadata: { bar: true }, cellContentMetadata: {} };
            }
            async notebookToData(notebook2) {
              callCount += 1;
              assert.strictEqual(notebook2.metadata.foo, 123);
              assert.strictEqual(notebook2.metadata.bar, void 0);
              return VSBuffer.fromString("");
            }
          }()
        ),
        configurationService,
        telemetryService,
        logservice
      ));
      await model.snapshot(SnapshotContext.Save, CancellationToken.None);
      assert.strictEqual(callCount, 1);
    }
    {
      let callCount = 0;
      const model = disposables.add(new NotebookFileWorkingCopyModel(
        notebook,
        mockNotebookService(
          notebook,
          new class extends mock() {
            constructor() {
              super(...arguments);
              this.options = { transientOutputs: false, transientCellMetadata: {}, transientDocumentMetadata: {}, cellContentMetadata: {} };
            }
            async notebookToData(notebook2) {
              callCount += 1;
              assert.strictEqual(notebook2.metadata.foo, 123);
              assert.strictEqual(notebook2.metadata.bar, 456);
              return VSBuffer.fromString("");
            }
          }()
        ),
        configurationService,
        telemetryService,
        logservice
      ));
      await model.snapshot(SnapshotContext.Save, CancellationToken.None);
      assert.strictEqual(callCount, 1);
    }
  });
  test("no transient cell metadata is send to serializer", async function() {
    const notebook = instantiationService.createInstance(
      NotebookTextModel,
      "notebook",
      URI.file("test"),
      [{ cellKind: CellKind.Code, language: "foo", mime: "foo", source: "foo", outputs: [], metadata: { foo: 123, bar: 456 } }],
      {},
      { transientCellMetadata: {}, transientDocumentMetadata: {}, cellContentMetadata: {}, transientOutputs: false }
    );
    disposables.add(notebook);
    {
      let callCount = 0;
      const model = disposables.add(new NotebookFileWorkingCopyModel(
        notebook,
        mockNotebookService(
          notebook,
          new class extends mock() {
            constructor() {
              super(...arguments);
              this.options = { transientOutputs: true, transientDocumentMetadata: {}, transientCellMetadata: { bar: true }, cellContentMetadata: {} };
            }
            async notebookToData(notebook2) {
              callCount += 1;
              assert.strictEqual(notebook2.cells[0].metadata.foo, 123);
              assert.strictEqual(notebook2.cells[0].metadata.bar, void 0);
              return VSBuffer.fromString("");
            }
          }()
        ),
        configurationService,
        telemetryService,
        logservice
      ));
      await model.snapshot(SnapshotContext.Save, CancellationToken.None);
      assert.strictEqual(callCount, 1);
    }
    {
      let callCount = 0;
      const model = disposables.add(new NotebookFileWorkingCopyModel(
        notebook,
        mockNotebookService(
          notebook,
          new class extends mock() {
            constructor() {
              super(...arguments);
              this.options = { transientOutputs: false, transientCellMetadata: {}, transientDocumentMetadata: {}, cellContentMetadata: {} };
            }
            async notebookToData(notebook2) {
              callCount += 1;
              assert.strictEqual(notebook2.cells[0].metadata.foo, 123);
              assert.strictEqual(notebook2.cells[0].metadata.bar, 456);
              return VSBuffer.fromString("");
            }
          }()
        ),
        configurationService,
        telemetryService,
        logservice
      ));
      await model.snapshot(SnapshotContext.Save, CancellationToken.None);
      assert.strictEqual(callCount, 1);
    }
  });
  test("Notebooks with outputs beyond the size threshold will throw for backup snapshots", async function() {
    const outputLimit = 100;
    await configurationService.setUserConfiguration(NotebookSetting.outputBackupSizeLimit, outputLimit * 1 / 1024);
    const largeOutput = { outputId: "123", outputs: [{ mime: Mimes.text, data: VSBuffer.fromString("a".repeat(outputLimit + 1)) }] };
    const notebook = instantiationService.createInstance(
      NotebookTextModel,
      "notebook",
      URI.file("test"),
      [{ cellKind: CellKind.Code, language: "foo", mime: "foo", source: "foo", outputs: [largeOutput], metadata: { foo: 123, bar: 456 } }],
      {},
      { transientCellMetadata: {}, transientDocumentMetadata: {}, cellContentMetadata: {}, transientOutputs: false }
    );
    disposables.add(notebook);
    let callCount = 0;
    const model = disposables.add(new NotebookFileWorkingCopyModel(
      notebook,
      mockNotebookService(
        notebook,
        new class extends mock() {
          constructor() {
            super(...arguments);
            this.options = { transientOutputs: true, transientDocumentMetadata: {}, transientCellMetadata: { bar: true }, cellContentMetadata: {} };
          }
          async notebookToData(notebook2) {
            callCount += 1;
            assert.strictEqual(notebook2.cells[0].metadata.foo, 123);
            assert.strictEqual(notebook2.cells[0].metadata.bar, void 0);
            return VSBuffer.fromString("");
          }
        }(),
        configurationService
      ),
      configurationService,
      telemetryService,
      logservice
    ));
    try {
      await model.snapshot(SnapshotContext.Backup, CancellationToken.None);
      assert.fail("Expected snapshot to throw an error for large output");
    } catch (e) {
      assert.notEqual(e.code, "ERR_ASSERTION", e.message);
    }
    await model.snapshot(SnapshotContext.Save, CancellationToken.None);
    assert.strictEqual(callCount, 1);
  });
  test("Notebook model will not return a save delegate if the serializer has not been retreived", async function() {
    const notebook = instantiationService.createInstance(
      NotebookTextModel,
      "notebook",
      URI.file("test"),
      [{ cellKind: CellKind.Code, language: "foo", mime: "foo", source: "foo", outputs: [], metadata: { foo: 123, bar: 456 } }],
      {},
      { transientCellMetadata: {}, transientDocumentMetadata: {}, cellContentMetadata: {}, transientOutputs: false }
    );
    disposables.add(notebook);
    const serializer = new class extends mock() {
      save() {
        return Promise.resolve({ name: "savedFile" });
      }
    }();
    serializer.test = "yes";
    let resolveSerializer = () => {
    };
    const serializerPromise = new Promise((resolve) => {
      resolveSerializer = resolve;
    });
    const notebookService = mockNotebookService(notebook, serializerPromise);
    configurationService.setUserConfiguration(NotebookSetting.remoteSaving, true);
    const model = disposables.add(new NotebookFileWorkingCopyModel(
      notebook,
      notebookService,
      configurationService,
      telemetryService,
      logservice
    ));
    const notExist = model.save;
    assert.strictEqual(notExist, void 0);
    resolveSerializer(serializer);
    await model.getNotebookSerializer();
    const result = await model.save?.({}, {});
    assert.strictEqual(result.name, "savedFile");
  });
});
function mockNotebookService(notebook, notebookSerializer, configurationService = new TestConfigurationService()) {
  return new class extends mock() {
    constructor() {
      super(...arguments);
      this.serializer = void 0;
    }
    async withNotebookDataProvider(viewType) {
      this.serializer = await notebookSerializer;
      return new SimpleNotebookProviderInfo(
        notebook.viewType,
        this.serializer,
        {
          id: new ExtensionIdentifier("test"),
          location: void 0
        }
      );
    }
    tryGetDataProviderSync(viewType) {
      if (!this.serializer) {
        return void 0;
      }
      return new SimpleNotebookProviderInfo(
        notebook.viewType,
        this.serializer,
        {
          id: new ExtensionIdentifier("test"),
          location: void 0
        }
      );
    }
    async createNotebookTextDocumentSnapshot(uri, context, token) {
      const info = await this.withNotebookDataProvider(notebook.viewType);
      const serializer = info.serializer;
      const outputSizeLimit = configurationService.getValue(NotebookSetting.outputBackupSizeLimit) ?? 1024;
      const data = notebook.createSnapshot({ context, outputSizeLimit, transientOptions: serializer.options });
      const bytes = await serializer.notebookToData(data);
      return bufferToStream(bytes);
    }
  }();
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay90ZXN0L2Jyb3dzZXIvbm90ZWJvb2tFZGl0b3JNb2RlbC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgYnVmZmVyVG9TdHJlYW0sIFZTQnVmZmVyLCBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBNaW1lcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21pbWUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IG1vY2sgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL21vY2suanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJRmlsZVN0YXRXaXRoTWV0YWRhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IE5vdGVib29rVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL21vZGVsL25vdGVib29rVGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IENlbGxLaW5kLCBJT3V0cHV0RHRvLCBOb3RlYm9va0RhdGEsIE5vdGVib29rU2V0dGluZywgVHJhbnNpZW50T3B0aW9ucyB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0ZpbGVXb3JraW5nQ29weU1vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rRWRpdG9yTW9kZWwuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rU2VyaWFsaXplciwgSU5vdGVib29rU2VydmljZSwgU2ltcGxlTm90ZWJvb2tQcm92aWRlckluZm8gfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHNldHVwSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuL3Rlc3ROb3RlYm9va0VkaXRvci5qcyc7XG5pbXBvcnQgeyBTbmFwc2hvdENvbnRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vZmlsZVdvcmtpbmdDb3B5LmpzJztcblxuc3VpdGUoJ05vdGVib29rRmlsZVdvcmtpbmdDb3B5TW9kZWwnLCBmdW5jdGlvbiAoKSB7XG5cblx0bGV0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKTtcblx0Y29uc3QgdGVsZW1ldHJ5U2VydmljZSA9IG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SVRlbGVtZXRyeVNlcnZpY2U+KCkge1xuXHRcdG92ZXJyaWRlIHB1YmxpY0xvZ0Vycm9yMigpIHsgfVxuXHR9O1xuXHRjb25zdCBsb2dzZXJ2aWNlID0gbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJTG9nU2VydmljZT4oKSB7IH07XG5cblx0dGVhcmRvd24oKCkgPT4gZGlzcG9zYWJsZXMuZGlzcG9zZSgpKTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSBzZXR1cEluc3RhbnRpYXRpb25TZXJ2aWNlKGRpc3Bvc2FibGVzKTtcblx0fSk7XG5cblx0dGVzdCgnbm8gdHJhbnNpZW50IG91dHB1dCBpcyBzZW5kIHRvIHNlcmlhbGl6ZXInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBub3RlYm9vayA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vdGVib29rVGV4dE1vZGVsLFxuXHRcdFx0J25vdGVib29rJyxcblx0XHRcdFVSSS5maWxlKCd0ZXN0JyksXG5cdFx0XHRbeyBjZWxsS2luZDogQ2VsbEtpbmQuQ29kZSwgbGFuZ3VhZ2U6ICdmb28nLCBtaW1lOiAnZm9vJywgc291cmNlOiAnZm9vJywgb3V0cHV0czogW3sgb3V0cHV0SWQ6ICdpZCcsIG91dHB1dHM6IFt7IG1pbWU6IE1pbWVzLnRleHQsIGRhdGE6IFZTQnVmZmVyLmZyb21TdHJpbmcoJ0hlbGxvIE91dCcpIH1dIH1dIH1dLFxuXHRcdFx0e30sXG5cdFx0XHR7IHRyYW5zaWVudENlbGxNZXRhZGF0YToge30sIHRyYW5zaWVudERvY3VtZW50TWV0YWRhdGE6IHt9LCBjZWxsQ29udGVudE1ldGFkYXRhOiB7fSwgdHJhbnNpZW50T3V0cHV0czogZmFsc2UgfVxuXHRcdCk7XG5cblx0XHR7IC8vIHRyYW5zaWVudCBvdXRwdXRcblx0XHRcdGxldCBjYWxsQ291bnQgPSAwO1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IE5vdGVib29rRmlsZVdvcmtpbmdDb3B5TW9kZWwoXG5cdFx0XHRcdG5vdGVib29rLFxuXHRcdFx0XHRtb2NrTm90ZWJvb2tTZXJ2aWNlKG5vdGVib29rLFxuXHRcdFx0XHRcdG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SU5vdGVib29rU2VyaWFsaXplcj4oKSB7XG5cdFx0XHRcdFx0XHRvdmVycmlkZSBvcHRpb25zOiBUcmFuc2llbnRPcHRpb25zID0geyB0cmFuc2llbnRPdXRwdXRzOiB0cnVlLCB0cmFuc2llbnRDZWxsTWV0YWRhdGE6IHt9LCB0cmFuc2llbnREb2N1bWVudE1ldGFkYXRhOiB7fSwgY2VsbENvbnRlbnRNZXRhZGF0YToge30gfTtcblx0XHRcdFx0XHRcdG92ZXJyaWRlIGFzeW5jIG5vdGVib29rVG9EYXRhKG5vdGVib29rOiBOb3RlYm9va0RhdGEpIHtcblx0XHRcdFx0XHRcdFx0Y2FsbENvdW50ICs9IDE7XG5cdFx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChub3RlYm9vay5jZWxscy5sZW5ndGgsIDEpO1xuXHRcdFx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suY2VsbHNbMF0ub3V0cHV0cy5sZW5ndGgsIDApO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gVlNCdWZmZXIuZnJvbVN0cmluZygnJyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHQpLFxuXHRcdFx0XHRjb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRcdFx0dGVsZW1ldHJ5U2VydmljZSxcblx0XHRcdFx0bG9nc2VydmljZVxuXHRcdFx0KSk7XG5cblx0XHRcdGF3YWl0IG1vZGVsLnNuYXBzaG90KFNuYXBzaG90Q29udGV4dC5TYXZlLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxsQ291bnQsIDEpO1xuXHRcdH1cblxuXHRcdHsgLy8gTk9UIHRyYW5zaWVudCBvdXRwdXRcblx0XHRcdGxldCBjYWxsQ291bnQgPSAwO1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IE5vdGVib29rRmlsZVdvcmtpbmdDb3B5TW9kZWwoXG5cdFx0XHRcdG5vdGVib29rLFxuXHRcdFx0XHRtb2NrTm90ZWJvb2tTZXJ2aWNlKG5vdGVib29rLFxuXHRcdFx0XHRcdG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SU5vdGVib29rU2VyaWFsaXplcj4oKSB7XG5cdFx0XHRcdFx0XHRvdmVycmlkZSBvcHRpb25zOiBUcmFuc2llbnRPcHRpb25zID0geyB0cmFuc2llbnRPdXRwdXRzOiBmYWxzZSwgdHJhbnNpZW50Q2VsbE1ldGFkYXRhOiB7fSwgdHJhbnNpZW50RG9jdW1lbnRNZXRhZGF0YToge30sIGNlbGxDb250ZW50TWV0YWRhdGE6IHt9IH07XG5cdFx0XHRcdFx0XHRvdmVycmlkZSBhc3luYyBub3RlYm9va1RvRGF0YShub3RlYm9vazogTm90ZWJvb2tEYXRhKSB7XG5cdFx0XHRcdFx0XHRcdGNhbGxDb3VudCArPSAxO1xuXHRcdFx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suY2VsbHMubGVuZ3RoLCAxKTtcblx0XHRcdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5vdGVib29rLmNlbGxzWzBdLm91dHB1dHMubGVuZ3RoLCAxKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIFZTQnVmZmVyLmZyb21TdHJpbmcoJycpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0KSxcblx0XHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0XHRcdHRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0XHRcdGxvZ3NlcnZpY2Vcblx0XHRcdCkpO1xuXHRcdFx0YXdhaXQgbW9kZWwuc25hcHNob3QoU25hcHNob3RDb250ZXh0LlNhdmUsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxDb3VudCwgMSk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdubyB0cmFuc2llbnQgbWV0YWRhdGEgaXMgc2VuZCB0byBzZXJpYWxpemVyJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3Qgbm90ZWJvb2sgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShOb3RlYm9va1RleHRNb2RlbCxcblx0XHRcdCdub3RlYm9vaycsXG5cdFx0XHRVUkkuZmlsZSgndGVzdCcpLFxuXHRcdFx0W3sgY2VsbEtpbmQ6IENlbGxLaW5kLkNvZGUsIGxhbmd1YWdlOiAnZm9vJywgbWltZTogJ2ZvbycsIHNvdXJjZTogJ2ZvbycsIG91dHB1dHM6IFtdIH1dLFxuXHRcdFx0eyBmb286IDEyMywgYmFyOiA0NTYgfSxcblx0XHRcdHsgdHJhbnNpZW50Q2VsbE1ldGFkYXRhOiB7fSwgdHJhbnNpZW50RG9jdW1lbnRNZXRhZGF0YToge30sIGNlbGxDb250ZW50TWV0YWRhdGE6IHt9LCB0cmFuc2llbnRPdXRwdXRzOiBmYWxzZSB9XG5cdFx0KTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChub3RlYm9vayk7XG5cblx0XHR7IC8vIHRyYW5zaWVudFxuXHRcdFx0bGV0IGNhbGxDb3VudCA9IDA7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgTm90ZWJvb2tGaWxlV29ya2luZ0NvcHlNb2RlbChcblx0XHRcdFx0bm90ZWJvb2ssXG5cdFx0XHRcdG1vY2tOb3RlYm9va1NlcnZpY2Uobm90ZWJvb2ssXG5cdFx0XHRcdFx0bmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJTm90ZWJvb2tTZXJpYWxpemVyPigpIHtcblx0XHRcdFx0XHRcdG92ZXJyaWRlIG9wdGlvbnM6IFRyYW5zaWVudE9wdGlvbnMgPSB7IHRyYW5zaWVudE91dHB1dHM6IHRydWUsIHRyYW5zaWVudENlbGxNZXRhZGF0YToge30sIHRyYW5zaWVudERvY3VtZW50TWV0YWRhdGE6IHsgYmFyOiB0cnVlIH0sIGNlbGxDb250ZW50TWV0YWRhdGE6IHt9IH07XG5cdFx0XHRcdFx0XHRvdmVycmlkZSBhc3luYyBub3RlYm9va1RvRGF0YShub3RlYm9vazogTm90ZWJvb2tEYXRhKSB7XG5cdFx0XHRcdFx0XHRcdGNhbGxDb3VudCArPSAxO1xuXHRcdFx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2subWV0YWRhdGEuZm9vLCAxMjMpO1xuXHRcdFx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2subWV0YWRhdGEuYmFyLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gVlNCdWZmZXIuZnJvbVN0cmluZygnJyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHQpLFxuXHRcdFx0XHRjb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRcdFx0dGVsZW1ldHJ5U2VydmljZSxcblx0XHRcdFx0bG9nc2VydmljZVxuXHRcdFx0KSk7XG5cblx0XHRcdGF3YWl0IG1vZGVsLnNuYXBzaG90KFNuYXBzaG90Q29udGV4dC5TYXZlLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxsQ291bnQsIDEpO1xuXHRcdH1cblxuXHRcdHsgLy8gTk9UIHRyYW5zaWVudFxuXHRcdFx0bGV0IGNhbGxDb3VudCA9IDA7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgTm90ZWJvb2tGaWxlV29ya2luZ0NvcHlNb2RlbChcblx0XHRcdFx0bm90ZWJvb2ssXG5cdFx0XHRcdG1vY2tOb3RlYm9va1NlcnZpY2Uobm90ZWJvb2ssXG5cdFx0XHRcdFx0bmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJTm90ZWJvb2tTZXJpYWxpemVyPigpIHtcblx0XHRcdFx0XHRcdG92ZXJyaWRlIG9wdGlvbnM6IFRyYW5zaWVudE9wdGlvbnMgPSB7IHRyYW5zaWVudE91dHB1dHM6IGZhbHNlLCB0cmFuc2llbnRDZWxsTWV0YWRhdGE6IHt9LCB0cmFuc2llbnREb2N1bWVudE1ldGFkYXRhOiB7fSwgY2VsbENvbnRlbnRNZXRhZGF0YToge30gfTtcblx0XHRcdFx0XHRcdG92ZXJyaWRlIGFzeW5jIG5vdGVib29rVG9EYXRhKG5vdGVib29rOiBOb3RlYm9va0RhdGEpIHtcblx0XHRcdFx0XHRcdFx0Y2FsbENvdW50ICs9IDE7XG5cdFx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChub3RlYm9vay5tZXRhZGF0YS5mb28sIDEyMyk7XG5cdFx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChub3RlYm9vay5tZXRhZGF0YS5iYXIsIDQ1Nik7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBWU0J1ZmZlci5mcm9tU3RyaW5nKCcnKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdCksXG5cdFx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdFx0XHR0ZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdFx0XHRsb2dzZXJ2aWNlXG5cblx0XHRcdCkpO1xuXHRcdFx0YXdhaXQgbW9kZWwuc25hcHNob3QoU25hcHNob3RDb250ZXh0LlNhdmUsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxDb3VudCwgMSk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdubyB0cmFuc2llbnQgY2VsbCBtZXRhZGF0YSBpcyBzZW5kIHRvIHNlcmlhbGl6ZXInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBub3RlYm9vayA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vdGVib29rVGV4dE1vZGVsLFxuXHRcdFx0J25vdGVib29rJyxcblx0XHRcdFVSSS5maWxlKCd0ZXN0JyksXG5cdFx0XHRbeyBjZWxsS2luZDogQ2VsbEtpbmQuQ29kZSwgbGFuZ3VhZ2U6ICdmb28nLCBtaW1lOiAnZm9vJywgc291cmNlOiAnZm9vJywgb3V0cHV0czogW10sIG1ldGFkYXRhOiB7IGZvbzogMTIzLCBiYXI6IDQ1NiB9IH1dLFxuXHRcdFx0e30sXG5cdFx0XHR7IHRyYW5zaWVudENlbGxNZXRhZGF0YToge30sIHRyYW5zaWVudERvY3VtZW50TWV0YWRhdGE6IHt9LCBjZWxsQ29udGVudE1ldGFkYXRhOiB7fSwgdHJhbnNpZW50T3V0cHV0czogZmFsc2UsIH1cblx0XHQpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChub3RlYm9vayk7XG5cblx0XHR7IC8vIHRyYW5zaWVudFxuXHRcdFx0bGV0IGNhbGxDb3VudCA9IDA7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgTm90ZWJvb2tGaWxlV29ya2luZ0NvcHlNb2RlbChcblx0XHRcdFx0bm90ZWJvb2ssXG5cdFx0XHRcdG1vY2tOb3RlYm9va1NlcnZpY2Uobm90ZWJvb2ssXG5cdFx0XHRcdFx0bmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJTm90ZWJvb2tTZXJpYWxpemVyPigpIHtcblx0XHRcdFx0XHRcdG92ZXJyaWRlIG9wdGlvbnM6IFRyYW5zaWVudE9wdGlvbnMgPSB7IHRyYW5zaWVudE91dHB1dHM6IHRydWUsIHRyYW5zaWVudERvY3VtZW50TWV0YWRhdGE6IHt9LCB0cmFuc2llbnRDZWxsTWV0YWRhdGE6IHsgYmFyOiB0cnVlIH0sIGNlbGxDb250ZW50TWV0YWRhdGE6IHt9IH07XG5cdFx0XHRcdFx0XHRvdmVycmlkZSBhc3luYyBub3RlYm9va1RvRGF0YShub3RlYm9vazogTm90ZWJvb2tEYXRhKSB7XG5cdFx0XHRcdFx0XHRcdGNhbGxDb3VudCArPSAxO1xuXHRcdFx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suY2VsbHNbMF0ubWV0YWRhdGEhLmZvbywgMTIzKTtcblx0XHRcdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5vdGVib29rLmNlbGxzWzBdLm1ldGFkYXRhIS5iYXIsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBWU0J1ZmZlci5mcm9tU3RyaW5nKCcnKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdCksXG5cdFx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdFx0XHR0ZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdFx0XHRsb2dzZXJ2aWNlXG5cdFx0XHQpKTtcblxuXHRcdFx0YXdhaXQgbW9kZWwuc25hcHNob3QoU25hcHNob3RDb250ZXh0LlNhdmUsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxDb3VudCwgMSk7XG5cdFx0fVxuXG5cdFx0eyAvLyBOT1QgdHJhbnNpZW50XG5cdFx0XHRsZXQgY2FsbENvdW50ID0gMDtcblx0XHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBOb3RlYm9va0ZpbGVXb3JraW5nQ29weU1vZGVsKFxuXHRcdFx0XHRub3RlYm9vayxcblx0XHRcdFx0bW9ja05vdGVib29rU2VydmljZShub3RlYm9vayxcblx0XHRcdFx0XHRuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElOb3RlYm9va1NlcmlhbGl6ZXI+KCkge1xuXHRcdFx0XHRcdFx0b3ZlcnJpZGUgb3B0aW9uczogVHJhbnNpZW50T3B0aW9ucyA9IHsgdHJhbnNpZW50T3V0cHV0czogZmFsc2UsIHRyYW5zaWVudENlbGxNZXRhZGF0YToge30sIHRyYW5zaWVudERvY3VtZW50TWV0YWRhdGE6IHt9LCBjZWxsQ29udGVudE1ldGFkYXRhOiB7fSB9O1xuXHRcdFx0XHRcdFx0b3ZlcnJpZGUgYXN5bmMgbm90ZWJvb2tUb0RhdGEobm90ZWJvb2s6IE5vdGVib29rRGF0YSkge1xuXHRcdFx0XHRcdFx0XHRjYWxsQ291bnQgKz0gMTtcblx0XHRcdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5vdGVib29rLmNlbGxzWzBdLm1ldGFkYXRhIS5mb28sIDEyMyk7XG5cdFx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChub3RlYm9vay5jZWxsc1swXS5tZXRhZGF0YSEuYmFyLCA0NTYpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gVlNCdWZmZXIuZnJvbVN0cmluZygnJyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHQpLFxuXHRcdFx0XHRjb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRcdFx0dGVsZW1ldHJ5U2VydmljZSxcblx0XHRcdFx0bG9nc2VydmljZVxuXHRcdFx0KSk7XG5cdFx0XHRhd2FpdCBtb2RlbC5zbmFwc2hvdChTbmFwc2hvdENvbnRleHQuU2F2ZSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbENvdW50LCAxKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ05vdGVib29rcyB3aXRoIG91dHB1dHMgYmV5b25kIHRoZSBzaXplIHRocmVzaG9sZCB3aWxsIHRocm93IGZvciBiYWNrdXAgc25hcHNob3RzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG91dHB1dExpbWl0ID0gMTAwO1xuXHRcdGF3YWl0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnNldFVzZXJDb25maWd1cmF0aW9uKE5vdGVib29rU2V0dGluZy5vdXRwdXRCYWNrdXBTaXplTGltaXQsIG91dHB1dExpbWl0ICogMS4wIC8gMTAyNCk7XG5cdFx0Y29uc3QgbGFyZ2VPdXRwdXQ6IElPdXRwdXREdG8gPSB7IG91dHB1dElkOiAnMTIzJywgb3V0cHV0czogW3sgbWltZTogTWltZXMudGV4dCwgZGF0YTogVlNCdWZmZXIuZnJvbVN0cmluZygnYScucmVwZWF0KG91dHB1dExpbWl0ICsgMSkpIH1dIH07XG5cdFx0Y29uc3Qgbm90ZWJvb2sgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShOb3RlYm9va1RleHRNb2RlbCxcblx0XHRcdCdub3RlYm9vaycsXG5cdFx0XHRVUkkuZmlsZSgndGVzdCcpLFxuXHRcdFx0W3sgY2VsbEtpbmQ6IENlbGxLaW5kLkNvZGUsIGxhbmd1YWdlOiAnZm9vJywgbWltZTogJ2ZvbycsIHNvdXJjZTogJ2ZvbycsIG91dHB1dHM6IFtsYXJnZU91dHB1dF0sIG1ldGFkYXRhOiB7IGZvbzogMTIzLCBiYXI6IDQ1NiB9IH1dLFxuXHRcdFx0e30sXG5cdFx0XHR7IHRyYW5zaWVudENlbGxNZXRhZGF0YToge30sIHRyYW5zaWVudERvY3VtZW50TWV0YWRhdGE6IHt9LCBjZWxsQ29udGVudE1ldGFkYXRhOiB7fSwgdHJhbnNpZW50T3V0cHV0czogZmFsc2UsIH1cblx0XHQpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChub3RlYm9vayk7XG5cblx0XHRsZXQgY2FsbENvdW50ID0gMDtcblx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgTm90ZWJvb2tGaWxlV29ya2luZ0NvcHlNb2RlbChcblx0XHRcdG5vdGVib29rLFxuXHRcdFx0bW9ja05vdGVib29rU2VydmljZShub3RlYm9vayxcblx0XHRcdFx0bmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJTm90ZWJvb2tTZXJpYWxpemVyPigpIHtcblx0XHRcdFx0XHRvdmVycmlkZSBvcHRpb25zOiBUcmFuc2llbnRPcHRpb25zID0geyB0cmFuc2llbnRPdXRwdXRzOiB0cnVlLCB0cmFuc2llbnREb2N1bWVudE1ldGFkYXRhOiB7fSwgdHJhbnNpZW50Q2VsbE1ldGFkYXRhOiB7IGJhcjogdHJ1ZSB9LCBjZWxsQ29udGVudE1ldGFkYXRhOiB7fSB9O1xuXHRcdFx0XHRcdG92ZXJyaWRlIGFzeW5jIG5vdGVib29rVG9EYXRhKG5vdGVib29rOiBOb3RlYm9va0RhdGEpIHtcblx0XHRcdFx0XHRcdGNhbGxDb3VudCArPSAxO1xuXHRcdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5vdGVib29rLmNlbGxzWzBdLm1ldGFkYXRhIS5mb28sIDEyMyk7XG5cdFx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90ZWJvb2suY2VsbHNbMF0ubWV0YWRhdGEhLmJhciwgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHRcdHJldHVybiBWU0J1ZmZlci5mcm9tU3RyaW5nKCcnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdFx0XHQpLFxuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0XHR0ZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdFx0bG9nc2VydmljZVxuXHRcdCkpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IG1vZGVsLnNuYXBzaG90KFNuYXBzaG90Q29udGV4dC5CYWNrdXAsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0YXNzZXJ0LmZhaWwoJ0V4cGVjdGVkIHNuYXBzaG90IHRvIHRocm93IGFuIGVycm9yIGZvciBsYXJnZSBvdXRwdXQnKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRhc3NlcnQubm90RXF1YWwoZS5jb2RlLCAnRVJSX0FTU0VSVElPTicsIGUubWVzc2FnZSk7XG5cdFx0fVxuXG5cdFx0YXdhaXQgbW9kZWwuc25hcHNob3QoU25hcHNob3RDb250ZXh0LlNhdmUsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxsQ291bnQsIDEpO1xuXG5cdH0pO1xuXG5cdHRlc3QoJ05vdGVib29rIG1vZGVsIHdpbGwgbm90IHJldHVybiBhIHNhdmUgZGVsZWdhdGUgaWYgdGhlIHNlcmlhbGl6ZXIgaGFzIG5vdCBiZWVuIHJldHJlaXZlZCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBub3RlYm9vayA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vdGVib29rVGV4dE1vZGVsLFxuXHRcdFx0J25vdGVib29rJyxcblx0XHRcdFVSSS5maWxlKCd0ZXN0JyksXG5cdFx0XHRbeyBjZWxsS2luZDogQ2VsbEtpbmQuQ29kZSwgbGFuZ3VhZ2U6ICdmb28nLCBtaW1lOiAnZm9vJywgc291cmNlOiAnZm9vJywgb3V0cHV0czogW10sIG1ldGFkYXRhOiB7IGZvbzogMTIzLCBiYXI6IDQ1NiB9IH1dLFxuXHRcdFx0e30sXG5cdFx0XHR7IHRyYW5zaWVudENlbGxNZXRhZGF0YToge30sIHRyYW5zaWVudERvY3VtZW50TWV0YWRhdGE6IHt9LCBjZWxsQ29udGVudE1ldGFkYXRhOiB7fSwgdHJhbnNpZW50T3V0cHV0czogZmFsc2UsIH1cblx0XHQpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChub3RlYm9vayk7XG5cblx0XHRjb25zdCBzZXJpYWxpemVyID0gbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJTm90ZWJvb2tTZXJpYWxpemVyPigpIHtcblx0XHRcdG92ZXJyaWRlIHNhdmUoKTogUHJvbWlzZTxJRmlsZVN0YXRXaXRoTWV0YWRhdGE+IHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh7IG5hbWU6ICdzYXZlZEZpbGUnIH0gYXMgSUZpbGVTdGF0V2l0aE1ldGFkYXRhKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdChzZXJpYWxpemVyIGFzIGFueSkudGVzdCA9ICd5ZXMnO1xuXG5cdFx0bGV0IHJlc29sdmVTZXJpYWxpemVyOiAoc2VyaWFsaXplcjogSU5vdGVib29rU2VyaWFsaXplcikgPT4gdm9pZCA9ICgpID0+IHsgfTtcblx0XHRjb25zdCBzZXJpYWxpemVyUHJvbWlzZSA9IG5ldyBQcm9taXNlPElOb3RlYm9va1NlcmlhbGl6ZXI+KHJlc29sdmUgPT4ge1xuXHRcdFx0cmVzb2x2ZVNlcmlhbGl6ZXIgPSByZXNvbHZlO1xuXHRcdH0pO1xuXHRcdGNvbnN0IG5vdGVib29rU2VydmljZSA9IG1vY2tOb3RlYm9va1NlcnZpY2Uobm90ZWJvb2ssIHNlcmlhbGl6ZXJQcm9taXNlKTtcblx0XHRjb25maWd1cmF0aW9uU2VydmljZS5zZXRVc2VyQ29uZmlndXJhdGlvbihOb3RlYm9va1NldHRpbmcucmVtb3RlU2F2aW5nLCB0cnVlKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBOb3RlYm9va0ZpbGVXb3JraW5nQ29weU1vZGVsKFxuXHRcdFx0bm90ZWJvb2ssXG5cdFx0XHRub3RlYm9va1NlcnZpY2UsXG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRcdHRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0XHRsb2dzZXJ2aWNlXG5cdFx0KSk7XG5cblx0XHQvLyB0aGUgc2F2ZSBtZXRob2Qgc2hvdWxkIG5vdCBiZSBzZXQgaWYgdGhlIHNlcmlhbGl6ZXIgaXMgbm90IHlldCByZXNvbHZlZFxuXHRcdGNvbnN0IG5vdEV4aXN0ID0gbW9kZWwuc2F2ZTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobm90RXhpc3QsIHVuZGVmaW5lZCk7XG5cblx0XHRyZXNvbHZlU2VyaWFsaXplcihzZXJpYWxpemVyKTtcblx0XHRhd2FpdCBtb2RlbC5nZXROb3RlYm9va1NlcmlhbGl6ZXIoKTtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBtb2RlbC5zYXZlPy4oe30gYXMgYW55LCB7fSBhcyBhbnkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCEubmFtZSwgJ3NhdmVkRmlsZScpO1xuXHR9KTtcbn0pO1xuXG5mdW5jdGlvbiBtb2NrTm90ZWJvb2tTZXJ2aWNlKG5vdGVib29rOiBOb3RlYm9va1RleHRNb2RlbCwgbm90ZWJvb2tTZXJpYWxpemVyOiBQcm9taXNlPElOb3RlYm9va1NlcmlhbGl6ZXI+IHwgSU5vdGVib29rU2VyaWFsaXplciwgY29uZmlndXJhdGlvblNlcnZpY2U6IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKSk6IElOb3RlYm9va1NlcnZpY2Uge1xuXHRyZXR1cm4gbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJTm90ZWJvb2tTZXJ2aWNlPigpIHtcblx0XHRwcml2YXRlIHNlcmlhbGl6ZXI6IElOb3RlYm9va1NlcmlhbGl6ZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0b3ZlcnJpZGUgYXN5bmMgd2l0aE5vdGVib29rRGF0YVByb3ZpZGVyKHZpZXdUeXBlOiBzdHJpbmcpOiBQcm9taXNlPFNpbXBsZU5vdGVib29rUHJvdmlkZXJJbmZvPiB7XG5cdFx0XHR0aGlzLnNlcmlhbGl6ZXIgPSBhd2FpdCBub3RlYm9va1NlcmlhbGl6ZXI7XG5cdFx0XHRyZXR1cm4gbmV3IFNpbXBsZU5vdGVib29rUHJvdmlkZXJJbmZvKFxuXHRcdFx0XHRub3RlYm9vay52aWV3VHlwZSxcblx0XHRcdFx0dGhpcy5zZXJpYWxpemVyLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IG5ldyBFeHRlbnNpb25JZGVudGlmaWVyKCd0ZXN0JyksXG5cdFx0XHRcdFx0bG9jYXRpb246IHVuZGVmaW5lZFxuXHRcdFx0XHR9XG5cdFx0XHQpO1xuXHRcdH1cblx0XHRvdmVycmlkZSB0cnlHZXREYXRhUHJvdmlkZXJTeW5jKHZpZXdUeXBlOiBzdHJpbmcpOiBTaW1wbGVOb3RlYm9va1Byb3ZpZGVySW5mbyB8IHVuZGVmaW5lZCB7XG5cdFx0XHRpZiAoIXRoaXMuc2VyaWFsaXplcikge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG5ldyBTaW1wbGVOb3RlYm9va1Byb3ZpZGVySW5mbyhcblx0XHRcdFx0bm90ZWJvb2sudmlld1R5cGUsXG5cdFx0XHRcdHRoaXMuc2VyaWFsaXplcixcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBuZXcgRXh0ZW5zaW9uSWRlbnRpZmllcigndGVzdCcpLFxuXHRcdFx0XHRcdGxvY2F0aW9uOiB1bmRlZmluZWRcblx0XHRcdFx0fVxuXHRcdFx0KTtcblx0XHR9XG5cdFx0b3ZlcnJpZGUgYXN5bmMgY3JlYXRlTm90ZWJvb2tUZXh0RG9jdW1lbnRTbmFwc2hvdCh1cmk6IFVSSSwgY29udGV4dDogU25hcHNob3RDb250ZXh0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFZTQnVmZmVyUmVhZGFibGVTdHJlYW0+IHtcblx0XHRcdGNvbnN0IGluZm8gPSBhd2FpdCB0aGlzLndpdGhOb3RlYm9va0RhdGFQcm92aWRlcihub3RlYm9vay52aWV3VHlwZSk7XG5cdFx0XHRjb25zdCBzZXJpYWxpemVyID0gaW5mby5zZXJpYWxpemVyO1xuXHRcdFx0Y29uc3Qgb3V0cHV0U2l6ZUxpbWl0ID0gY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoTm90ZWJvb2tTZXR0aW5nLm91dHB1dEJhY2t1cFNpemVMaW1pdCkgPz8gMTAyNDtcblx0XHRcdGNvbnN0IGRhdGE6IE5vdGVib29rRGF0YSA9IG5vdGVib29rLmNyZWF0ZVNuYXBzaG90KHsgY29udGV4dDogY29udGV4dCwgb3V0cHV0U2l6ZUxpbWl0OiBvdXRwdXRTaXplTGltaXQsIHRyYW5zaWVudE9wdGlvbnM6IHNlcmlhbGl6ZXIub3B0aW9ucyB9KTtcblx0XHRcdGNvbnN0IGJ5dGVzID0gYXdhaXQgc2VyaWFsaXplci5ub3RlYm9va1RvRGF0YShkYXRhKTtcblxuXHRcdFx0cmV0dXJuIGJ1ZmZlclRvU3RyZWFtKGJ5dGVzKTtcblx0XHR9XG5cdH07XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxnQkFBZ0IsZ0JBQXdDO0FBQ2pFLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsYUFBYTtBQUN0QixTQUFTLFdBQVc7QUFDcEIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsMkJBQTJCO0FBS3BDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsVUFBb0MsdUJBQXlDO0FBQ3RGLFNBQVMsb0NBQW9DO0FBQzdDLFNBQWdELGtDQUFrQztBQUNsRixTQUFTLGlDQUFpQztBQUMxQyxTQUFTLHVCQUF1QjtBQUVoQyxNQUFNLGdDQUFnQyxXQUFZO0FBRWpELE1BQUk7QUFDSixNQUFJO0FBQ0osUUFBTSx1QkFBdUIsSUFBSSx5QkFBeUI7QUFDMUQsUUFBTSxtQkFBbUIsSUFBSSxjQUFjLEtBQXdCLEVBQUU7QUFBQSxJQUMzRCxrQkFBa0I7QUFBQSxJQUFFO0FBQUEsRUFDOUI7QUFDQSxRQUFNLGFBQWEsSUFBSSxjQUFjLEtBQWtCLEVBQUU7QUFBQSxFQUFFO0FBRTNELFdBQVMsTUFBTSxZQUFZLFFBQVEsQ0FBQztBQUVwQywwQ0FBd0M7QUFFeEMsUUFBTSxNQUFNO0FBQ1gsa0JBQWMsSUFBSSxnQkFBZ0I7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O0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxDQUFDO0FBR0QsVUFBTSxXQUFXLE1BQU07QUFDdkIsV0FBTyxZQUFZLFVBQVUsTUFBUztBQUV0QyxzQkFBa0IsVUFBVTtBQUM1QixVQUFNLE1BQU0sc0JBQXNCO0FBQ2xDLFVBQU0sU0FBUyxNQUFNLE1BQU0sT0FBTyxDQUFDLEdBQVUsQ0FBQyxDQUFRO0FBRXRELFdBQU8sWUFBWSxPQUFRLE1BQU0sV0FBVztBQUFBLEVBQzdDLENBQUM7QUFDRixDQUFDO0FBRUQsU0FBUyxvQkFBb0IsVUFBNkIsb0JBQXdFLHVCQUFpRCxJQUFJLHlCQUF5QixHQUFxQjtBQUNwTyxTQUFPLElBQUksY0FBYyxLQUF1QixFQUFFO0FBQUEsSUFBdkM7QUFBQTtBQUNWLFdBQVEsYUFBOEM7QUFBQTtBQUFBLElBQ3RELE1BQWUseUJBQXlCLFVBQXVEO0FBQzlGLFdBQUssYUFBYSxNQUFNO0FBQ3hCLGFBQU8sSUFBSTtBQUFBLFFBQ1YsU0FBUztBQUFBLFFBQ1QsS0FBSztBQUFBLFFBQ0w7QUFBQSxVQUNDLElBQUksSUFBSSxvQkFBb0IsTUFBTTtBQUFBLFVBQ2xDLFVBQVU7QUFBQSxRQUNYO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxJQUNTLHVCQUF1QixVQUEwRDtBQUN6RixVQUFJLENBQUMsS0FBSyxZQUFZO0FBQ3JCLGVBQU87QUFBQSxNQUNSO0FBQ0EsYUFBTyxJQUFJO0FBQUEsUUFDVixTQUFTO0FBQUEsUUFDVCxLQUFLO0FBQUEsUUFDTDtBQUFBLFVBQ0MsSUFBSSxJQUFJLG9CQUFvQixNQUFNO0FBQUEsVUFDbEMsVUFBVTtBQUFBLFFBQ1g7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLElBQ0EsTUFBZSxtQ0FBbUMsS0FBVSxTQUEwQixPQUEyRDtBQUNoSixZQUFNLE9BQU8sTUFBTSxLQUFLLHlCQUF5QixTQUFTLFFBQVE7QUFDbEUsWUFBTSxhQUFhLEtBQUs7QUFDeEIsWUFBTSxrQkFBa0IscUJBQXFCLFNBQVMsZ0JBQWdCLHFCQUFxQixLQUFLO0FBQ2hHLFlBQU0sT0FBcUIsU0FBUyxlQUFlLEVBQUUsU0FBa0IsaUJBQWtDLGtCQUFrQixXQUFXLFFBQVEsQ0FBQztBQUMvSSxZQUFNLFFBQVEsTUFBTSxXQUFXLGVBQWUsSUFBSTtBQUVsRCxhQUFPLGVBQWUsS0FBSztBQUFBLElBQzVCO0FBQUEsRUFDRDtBQUNEOyIsCiAgIm5hbWVzIjogWyJub3RlYm9vayJdCn0K
