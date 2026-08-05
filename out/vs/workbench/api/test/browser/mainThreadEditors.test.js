import assert from "assert";
import { Event } from "../../../../base/common/event.js";
import { DisposableStore, ImmortalReference } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { mock } from "../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { IBulkEditService } from "../../../../editor/browser/services/bulkEditService.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { EditOperation } from "../../../../editor/common/core/editOperation.js";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
import { IEditorWorkerService } from "../../../../editor/common/services/editorWorker.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ModelService } from "../../../../editor/common/services/modelService.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { TestCodeEditorService } from "../../../../editor/test/browser/editorTestServices.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../platform/configuration/test/common/testConfigurationService.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { TestDialogService } from "../../../../platform/dialogs/test/common/testDialogService.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { InstantiationService } from "../../../../platform/instantiation/common/instantiationService.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ILogService, NullLogService } from "../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { TestNotificationService } from "../../../../platform/notification/test/common/testNotificationService.js";
import { TestThemeService } from "../../../../platform/theme/test/common/testThemeService.js";
import { IUndoRedoService } from "../../../../platform/undoRedo/common/undoRedo.js";
import { UndoRedoService } from "../../../../platform/undoRedo/common/undoRedoService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { UriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentityService.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { MainThreadBulkEdits } from "../../browser/mainThreadBulkEdits.js";
import { SingleProxyRPCProtocol } from "../common/testRPCProtocol.js";
import { BulkEditService } from "../../../contrib/bulkEdit/browser/bulkEditService.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { SerializableObjectWithBuffers } from "../../../services/extensions/common/proxyIdentifier.js";
import { LabelService } from "../../../services/label/common/labelService.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
import { IPaneCompositePartService } from "../../../services/panecomposite/browser/panecomposite.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { IWorkingCopyFileService } from "../../../services/workingCopy/common/workingCopyFileService.js";
import { IWorkingCopyService } from "../../../services/workingCopy/common/workingCopyService.js";
import { TestEditorGroupsService, TestEditorService, TestEnvironmentService, TestFileService, TestLifecycleService, TestWorkingCopyService } from "../../../test/browser/workbenchTestServices.js";
import { TestContextService, TestTextResourcePropertiesService } from "../../../test/common/workbenchTestServices.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { LanguageService } from "../../../../editor/common/services/languageService.js";
import { ILanguageConfigurationService } from "../../../../editor/common/languages/languageConfigurationRegistry.js";
import { TestLanguageConfigurationService } from "../../../../editor/test/common/modes/testLanguageConfigurationService.js";
suite("MainThreadEditors", () => {
  let disposables;
  const resource = URI.parse("foo:bar");
  let modelService;
  let bulkEdits;
  const movedResources = /* @__PURE__ */ new Map();
  const copiedResources = /* @__PURE__ */ new Map();
  const createdResources = /* @__PURE__ */ new Set();
  const deletedResources = /* @__PURE__ */ new Set();
  setup(() => {
    disposables = new DisposableStore();
    movedResources.clear();
    copiedResources.clear();
    createdResources.clear();
    deletedResources.clear();
    const configService = new TestConfigurationService();
    const dialogService = new TestDialogService();
    const notificationService = new TestNotificationService();
    const undoRedoService = new UndoRedoService(dialogService, notificationService);
    const themeService = new TestThemeService();
    const services = new ServiceCollection();
    services.set(IBulkEditService, new SyncDescriptor(BulkEditService));
    services.set(ILabelService, new SyncDescriptor(LabelService));
    services.set(ILogService, new NullLogService());
    services.set(IWorkspaceContextService, new TestContextService());
    services.set(IEnvironmentService, TestEnvironmentService);
    services.set(IWorkbenchEnvironmentService, TestEnvironmentService);
    services.set(IConfigurationService, configService);
    services.set(IDialogService, dialogService);
    services.set(INotificationService, notificationService);
    services.set(IUndoRedoService, undoRedoService);
    services.set(IModelService, modelService);
    services.set(ICodeEditorService, new TestCodeEditorService(themeService));
    services.set(IFileService, new TestFileService());
    services.set(IUriIdentityService, new SyncDescriptor(UriIdentityService));
    services.set(IEditorService, disposables.add(new TestEditorService()));
    services.set(ILifecycleService, new TestLifecycleService());
    services.set(IWorkingCopyService, new TestWorkingCopyService());
    services.set(IEditorGroupsService, new TestEditorGroupsService());
    services.set(ITextFileService, new class extends mock() {
      constructor() {
        super(...arguments);
        this.files = {
          onDidSave: Event.None,
          onDidRevert: Event.None,
          onDidChangeDirty: Event.None
        };
      }
      isDirty() {
        return false;
      }
      create(operations) {
        for (const o of operations) {
          createdResources.add(o.resource);
        }
        return Promise.resolve(/* @__PURE__ */ Object.create(null));
      }
      async getEncodedReadable(resource2, value) {
        return void 0;
      }
    }());
    services.set(IWorkingCopyFileService, new class extends mock() {
      constructor() {
        super(...arguments);
        this.onDidRunWorkingCopyFileOperation = Event.None;
      }
      createFolder(operations) {
        this.create(operations);
      }
      create(operations) {
        for (const operation of operations) {
          createdResources.add(operation.resource);
        }
        return Promise.resolve(/* @__PURE__ */ Object.create(null));
      }
      move(operations) {
        const { source, target } = operations[0].file;
        movedResources.set(source, target);
        return Promise.resolve(/* @__PURE__ */ Object.create(null));
      }
      copy(operations) {
        const { source, target } = operations[0].file;
        copiedResources.set(source, target);
        return Promise.resolve(/* @__PURE__ */ Object.create(null));
      }
      delete(operations) {
        for (const operation of operations) {
          deletedResources.add(operation.resource);
        }
        return Promise.resolve(void 0);
      }
    }());
    services.set(ITextModelService, new class extends mock() {
      createModelReference(resource2) {
        const textEditorModel = new class extends mock() {
          constructor() {
            super(...arguments);
            this.textEditorModel = modelService.getModel(resource2);
          }
        }();
        textEditorModel.isReadonly = () => false;
        return Promise.resolve(new ImmortalReference(textEditorModel));
      }
    }());
    services.set(IEditorWorkerService, new class extends mock() {
    }());
    services.set(IPaneCompositePartService, new class extends mock() {
      constructor() {
        super(...arguments);
        this.onDidPaneCompositeOpen = Event.None;
        this.onDidPaneCompositeClose = Event.None;
      }
      getActivePaneComposite() {
        return void 0;
      }
    }());
    services.set(ILanguageService, disposables.add(new LanguageService()));
    services.set(ILanguageConfigurationService, new TestLanguageConfigurationService());
    const instaService = new InstantiationService(services);
    modelService = new ModelService(
      configService,
      new TestTextResourcePropertiesService(configService),
      undoRedoService,
      instaService
    );
    bulkEdits = instaService.createInstance(MainThreadBulkEdits, SingleProxyRPCProtocol(null));
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test(`applyWorkspaceEdit returns false if model is changed by user`, () => {
    const model = disposables.add(modelService.createModel("something", null, resource));
    const workspaceResourceEdit = {
      resource,
      versionId: model.getVersionId(),
      textEdit: {
        text: "asdfg",
        range: new Range(1, 1, 1, 1)
      }
    };
    model.applyEdits([EditOperation.insert(new Position(0, 0), "something")]);
    return bulkEdits.$tryApplyWorkspaceEdit(new SerializableObjectWithBuffers({ edits: [workspaceResourceEdit] })).then((result) => {
      assert.strictEqual(result, false);
    });
  });
  test(`issue #54773: applyWorkspaceEdit checks model version in race situation`, () => {
    const model = disposables.add(modelService.createModel("something", null, resource));
    const workspaceResourceEdit1 = {
      resource,
      versionId: model.getVersionId(),
      textEdit: {
        text: "asdfg",
        range: new Range(1, 1, 1, 1)
      }
    };
    const workspaceResourceEdit2 = {
      resource,
      versionId: model.getVersionId(),
      textEdit: {
        text: "asdfg",
        range: new Range(1, 1, 1, 1)
      }
    };
    const p1 = bulkEdits.$tryApplyWorkspaceEdit(new SerializableObjectWithBuffers({ edits: [workspaceResourceEdit1] })).then((result) => {
      assert.strictEqual(result, true);
    });
    const p2 = bulkEdits.$tryApplyWorkspaceEdit(new SerializableObjectWithBuffers({ edits: [workspaceResourceEdit2] })).then((result) => {
      assert.strictEqual(result, false);
    });
    return Promise.all([p1, p2]);
  });
  test(`applyWorkspaceEdit with only resource edit`, () => {
    return bulkEdits.$tryApplyWorkspaceEdit(new SerializableObjectWithBuffers({
      edits: [
        { oldResource: resource, newResource: resource, options: void 0 },
        { oldResource: void 0, newResource: resource, options: void 0 },
        { oldResource: resource, newResource: void 0, options: void 0 }
      ]
    })).then((result) => {
      assert.strictEqual(result, true);
      assert.strictEqual(movedResources.get(resource), resource);
      assert.strictEqual(createdResources.has(resource), true);
      assert.strictEqual(deletedResources.has(resource), true);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9tYWluVGhyZWFkRWRpdG9ycy50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIElSZWZlcmVuY2UsIEltbW9ydGFsUmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBtb2NrIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi9tb2NrLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSUJ1bGtFZGl0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2J1bGtFZGl0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL2VkaXRPcGVyYXRpb24uanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSVRleHRTbmFwc2hvdCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSUVkaXRvcldvcmtlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2VkaXRvcldvcmtlci5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWwsIElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdENvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL3Rlc3QvYnJvd3Nlci9lZGl0b3JUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgVGVzdERpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL3Rlc3QvY29tbW9uL3Rlc3REaWFsb2dTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UsIE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0Tm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Tm90aWZpY2F0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0VGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvdGVzdC9jb21tb24vdGVzdFRoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVW5kb1JlZG9TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdW5kb1JlZG8vY29tbW9uL3VuZG9SZWRvLmpzJztcbmltcG9ydCB7IFVuZG9SZWRvU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuZG9SZWRvL2NvbW1vbi91bmRvUmVkb1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHlTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IE1haW5UaHJlYWRCdWxrRWRpdHMgfSBmcm9tICcuLi8uLi9icm93c2VyL21haW5UaHJlYWRCdWxrRWRpdHMuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZVRleHRFZGl0RHRvIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgU2luZ2xlUHJveHlSUENQcm90b2NvbCB9IGZyb20gJy4uL2NvbW1vbi90ZXN0UlBDUHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgQnVsa0VkaXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29udHJpYi9idWxrRWRpdC9icm93c2VyL2J1bGtFZGl0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBTZXJpYWxpemFibGVPYmplY3RXaXRoQnVmZmVycyB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL3Byb3h5SWRlbnRpZmllci5qcyc7XG5pbXBvcnQgeyBMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9sYWJlbC9jb21tb24vbGFiZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3BhbmVjb21wb3NpdGUvYnJvd3Nlci9wYW5lY29tcG9zaXRlLmpzJztcbmltcG9ydCB7IElUZXh0RmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy90ZXh0ZmlsZS9jb21tb24vdGV4dGZpbGVzLmpzJztcbmltcG9ydCB7IElDb3B5T3BlcmF0aW9uLCBJQ3JlYXRlRmlsZU9wZXJhdGlvbiwgSUNyZWF0ZU9wZXJhdGlvbiwgSURlbGV0ZU9wZXJhdGlvbiwgSU1vdmVPcGVyYXRpb24sIElXb3JraW5nQ29weUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5RmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3dvcmtpbmdDb3B5L2NvbW1vbi93b3JraW5nQ29weVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdEVkaXRvckdyb3Vwc1NlcnZpY2UsIFRlc3RFZGl0b3JTZXJ2aWNlLCBUZXN0RW52aXJvbm1lbnRTZXJ2aWNlLCBUZXN0RmlsZVNlcnZpY2UsIFRlc3RMaWZlY3ljbGVTZXJ2aWNlLCBUZXN0V29ya2luZ0NvcHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vdGVzdC9icm93c2VyL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBUZXN0Q29udGV4dFNlcnZpY2UsIFRlc3RUZXh0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3Rlc3QvY29tbW9uL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci90ZXN0L2NvbW1vbi9tb2Rlcy90ZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5cbnN1aXRlKCdNYWluVGhyZWFkRWRpdG9ycycsICgpID0+IHtcblxuXHRsZXQgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0Y29uc3QgcmVzb3VyY2UgPSBVUkkucGFyc2UoJ2ZvbzpiYXInKTtcblxuXHRsZXQgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlO1xuXG5cdGxldCBidWxrRWRpdHM6IE1haW5UaHJlYWRCdWxrRWRpdHM7XG5cblx0Y29uc3QgbW92ZWRSZXNvdXJjZXMgPSBuZXcgTWFwPFVSSSwgVVJJPigpO1xuXHRjb25zdCBjb3BpZWRSZXNvdXJjZXMgPSBuZXcgTWFwPFVSSSwgVVJJPigpO1xuXHRjb25zdCBjcmVhdGVkUmVzb3VyY2VzID0gbmV3IFNldDxVUkk+KCk7XG5cdGNvbnN0IGRlbGV0ZWRSZXNvdXJjZXMgPSBuZXcgU2V0PFVSST4oKTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRtb3ZlZFJlc291cmNlcy5jbGVhcigpO1xuXHRcdGNvcGllZFJlc291cmNlcy5jbGVhcigpO1xuXHRcdGNyZWF0ZWRSZXNvdXJjZXMuY2xlYXIoKTtcblx0XHRkZWxldGVkUmVzb3VyY2VzLmNsZWFyKCk7XG5cblx0XHRjb25zdCBjb25maWdTZXJ2aWNlID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSgpO1xuXHRcdGNvbnN0IGRpYWxvZ1NlcnZpY2UgPSBuZXcgVGVzdERpYWxvZ1NlcnZpY2UoKTtcblx0XHRjb25zdCBub3RpZmljYXRpb25TZXJ2aWNlID0gbmV3IFRlc3ROb3RpZmljYXRpb25TZXJ2aWNlKCk7XG5cdFx0Y29uc3QgdW5kb1JlZG9TZXJ2aWNlID0gbmV3IFVuZG9SZWRvU2VydmljZShkaWFsb2dTZXJ2aWNlLCBub3RpZmljYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCB0aGVtZVNlcnZpY2UgPSBuZXcgVGVzdFRoZW1lU2VydmljZSgpO1xuXG5cdFx0Y29uc3Qgc2VydmljZXMgPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oKTtcblx0XHRzZXJ2aWNlcy5zZXQoSUJ1bGtFZGl0U2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKEJ1bGtFZGl0U2VydmljZSkpO1xuXHRcdHNlcnZpY2VzLnNldChJTGFiZWxTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoTGFiZWxTZXJ2aWNlKSk7XG5cdFx0c2VydmljZXMuc2V0KElMb2dTZXJ2aWNlLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSk7XG5cdFx0c2VydmljZXMuc2V0KElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgbmV3IFRlc3RDb250ZXh0U2VydmljZSgpKTtcblx0XHRzZXJ2aWNlcy5zZXQoSUVudmlyb25tZW50U2VydmljZSwgVGVzdEVudmlyb25tZW50U2VydmljZSk7XG5cdFx0c2VydmljZXMuc2V0KElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsIFRlc3RFbnZpcm9ubWVudFNlcnZpY2UpO1xuXHRcdHNlcnZpY2VzLnNldChJQ29uZmlndXJhdGlvblNlcnZpY2UsIGNvbmZpZ1NlcnZpY2UpO1xuXHRcdHNlcnZpY2VzLnNldChJRGlhbG9nU2VydmljZSwgZGlhbG9nU2VydmljZSk7XG5cdFx0c2VydmljZXMuc2V0KElOb3RpZmljYXRpb25TZXJ2aWNlLCBub3RpZmljYXRpb25TZXJ2aWNlKTtcblx0XHRzZXJ2aWNlcy5zZXQoSVVuZG9SZWRvU2VydmljZSwgdW5kb1JlZG9TZXJ2aWNlKTtcblx0XHRzZXJ2aWNlcy5zZXQoSU1vZGVsU2VydmljZSwgbW9kZWxTZXJ2aWNlKTtcblx0XHRzZXJ2aWNlcy5zZXQoSUNvZGVFZGl0b3JTZXJ2aWNlLCBuZXcgVGVzdENvZGVFZGl0b3JTZXJ2aWNlKHRoZW1lU2VydmljZSkpO1xuXHRcdHNlcnZpY2VzLnNldChJRmlsZVNlcnZpY2UsIG5ldyBUZXN0RmlsZVNlcnZpY2UoKSk7XG5cdFx0c2VydmljZXMuc2V0KElVcmlJZGVudGl0eVNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihVcmlJZGVudGl0eVNlcnZpY2UpKTtcblx0XHRzZXJ2aWNlcy5zZXQoSUVkaXRvclNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdEVkaXRvclNlcnZpY2UoKSkpO1xuXHRcdHNlcnZpY2VzLnNldChJTGlmZWN5Y2xlU2VydmljZSwgbmV3IFRlc3RMaWZlY3ljbGVTZXJ2aWNlKCkpO1xuXHRcdHNlcnZpY2VzLnNldChJV29ya2luZ0NvcHlTZXJ2aWNlLCBuZXcgVGVzdFdvcmtpbmdDb3B5U2VydmljZSgpKTtcblx0XHRzZXJ2aWNlcy5zZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UsIG5ldyBUZXN0RWRpdG9yR3JvdXBzU2VydmljZSgpKTtcblx0XHRzZXJ2aWNlcy5zZXQoSVRleHRGaWxlU2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJVGV4dEZpbGVTZXJ2aWNlPigpIHtcblx0XHRcdG92ZXJyaWRlIGlzRGlydHkoKSB7IHJldHVybiBmYWxzZTsgfVxuXHRcdFx0b3ZlcnJpZGUgZmlsZXMgPSA8YW55Pntcblx0XHRcdFx0b25EaWRTYXZlOiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZFJldmVydDogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VEaXJ0eTogRXZlbnQuTm9uZVxuXHRcdFx0fTtcblx0XHRcdG92ZXJyaWRlIGNyZWF0ZShvcGVyYXRpb25zOiB7IHJlc291cmNlOiBVUkkgfVtdKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgbyBvZiBvcGVyYXRpb25zKSB7XG5cdFx0XHRcdFx0Y3JlYXRlZFJlc291cmNlcy5hZGQoby5yZXNvdXJjZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShPYmplY3QuY3JlYXRlKG51bGwpKTtcblx0XHRcdH1cblx0XHRcdG92ZXJyaWRlIGFzeW5jIGdldEVuY29kZWRSZWFkYWJsZShyZXNvdXJjZTogVVJJLCB2YWx1ZT86IHN0cmluZyB8IElUZXh0U25hcHNob3QpOiBQcm9taXNlPGFueT4ge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHNlcnZpY2VzLnNldChJV29ya2luZ0NvcHlGaWxlU2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJV29ya2luZ0NvcHlGaWxlU2VydmljZT4oKSB7XG5cdFx0XHRvdmVycmlkZSBvbkRpZFJ1bldvcmtpbmdDb3B5RmlsZU9wZXJhdGlvbiA9IEV2ZW50Lk5vbmU7XG5cdFx0XHRvdmVycmlkZSBjcmVhdGVGb2xkZXIob3BlcmF0aW9uczogSUNyZWF0ZU9wZXJhdGlvbltdKTogYW55IHtcblx0XHRcdFx0dGhpcy5jcmVhdGUob3BlcmF0aW9ucyk7XG5cdFx0XHR9XG5cdFx0XHRvdmVycmlkZSBjcmVhdGUob3BlcmF0aW9uczogSUNyZWF0ZUZpbGVPcGVyYXRpb25bXSkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IG9wZXJhdGlvbiBvZiBvcGVyYXRpb25zKSB7XG5cdFx0XHRcdFx0Y3JlYXRlZFJlc291cmNlcy5hZGQob3BlcmF0aW9uLnJlc291cmNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKE9iamVjdC5jcmVhdGUobnVsbCkpO1xuXHRcdFx0fVxuXHRcdFx0b3ZlcnJpZGUgbW92ZShvcGVyYXRpb25zOiBJTW92ZU9wZXJhdGlvbltdKSB7XG5cdFx0XHRcdGNvbnN0IHsgc291cmNlLCB0YXJnZXQgfSA9IG9wZXJhdGlvbnNbMF0uZmlsZTtcblx0XHRcdFx0bW92ZWRSZXNvdXJjZXMuc2V0KHNvdXJjZSwgdGFyZ2V0KTtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShPYmplY3QuY3JlYXRlKG51bGwpKTtcblx0XHRcdH1cblx0XHRcdG92ZXJyaWRlIGNvcHkob3BlcmF0aW9uczogSUNvcHlPcGVyYXRpb25bXSkge1xuXHRcdFx0XHRjb25zdCB7IHNvdXJjZSwgdGFyZ2V0IH0gPSBvcGVyYXRpb25zWzBdLmZpbGU7XG5cdFx0XHRcdGNvcGllZFJlc291cmNlcy5zZXQoc291cmNlLCB0YXJnZXQpO1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKE9iamVjdC5jcmVhdGUobnVsbCkpO1xuXHRcdFx0fVxuXHRcdFx0b3ZlcnJpZGUgZGVsZXRlKG9wZXJhdGlvbnM6IElEZWxldGVPcGVyYXRpb25bXSkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IG9wZXJhdGlvbiBvZiBvcGVyYXRpb25zKSB7XG5cdFx0XHRcdFx0ZGVsZXRlZFJlc291cmNlcy5hZGQob3BlcmF0aW9uLnJlc291cmNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0c2VydmljZXMuc2V0KElUZXh0TW9kZWxTZXJ2aWNlLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElUZXh0TW9kZWxTZXJ2aWNlPigpIHtcblx0XHRcdG92ZXJyaWRlIGNyZWF0ZU1vZGVsUmVmZXJlbmNlKHJlc291cmNlOiBVUkkpOiBQcm9taXNlPElSZWZlcmVuY2U8SVJlc29sdmVkVGV4dEVkaXRvck1vZGVsPj4ge1xuXHRcdFx0XHRjb25zdCB0ZXh0RWRpdG9yTW9kZWwgPSBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElSZXNvbHZlZFRleHRFZGl0b3JNb2RlbD4oKSB7XG5cdFx0XHRcdFx0b3ZlcnJpZGUgdGV4dEVkaXRvck1vZGVsID0gbW9kZWxTZXJ2aWNlLmdldE1vZGVsKHJlc291cmNlKSE7XG5cdFx0XHRcdH07XG5cdFx0XHRcdHRleHRFZGl0b3JNb2RlbC5pc1JlYWRvbmx5ID0gKCkgPT4gZmFsc2U7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobmV3IEltbW9ydGFsUmVmZXJlbmNlKHRleHRFZGl0b3JNb2RlbCkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHNlcnZpY2VzLnNldChJRWRpdG9yV29ya2VyU2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJRWRpdG9yV29ya2VyU2VydmljZT4oKSB7XG5cblx0XHR9KTtcblx0XHRzZXJ2aWNlcy5zZXQoSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlPigpIGltcGxlbWVudHMgSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSB7XG5cdFx0XHRvdmVycmlkZSBvbkRpZFBhbmVDb21wb3NpdGVPcGVuID0gRXZlbnQuTm9uZTtcblx0XHRcdG92ZXJyaWRlIG9uRGlkUGFuZUNvbXBvc2l0ZUNsb3NlID0gRXZlbnQuTm9uZTtcblx0XHRcdG92ZXJyaWRlIGdldEFjdGl2ZVBhbmVDb21wb3NpdGUoKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRzZXJ2aWNlcy5zZXQoSUxhbmd1YWdlU2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBMYW5ndWFnZVNlcnZpY2UoKSkpO1xuXHRcdHNlcnZpY2VzLnNldChJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSwgbmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpO1xuXG5cdFx0Y29uc3QgaW5zdGFTZXJ2aWNlID0gbmV3IEluc3RhbnRpYXRpb25TZXJ2aWNlKHNlcnZpY2VzKTtcblxuXHRcdG1vZGVsU2VydmljZSA9IG5ldyBNb2RlbFNlcnZpY2UoXG5cdFx0XHRjb25maWdTZXJ2aWNlLFxuXHRcdFx0bmV3IFRlc3RUZXh0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZShjb25maWdTZXJ2aWNlKSxcblx0XHRcdHVuZG9SZWRvU2VydmljZSxcblx0XHRcdGluc3RhU2VydmljZVxuXHRcdCk7XG5cblx0XHRidWxrRWRpdHMgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWFpblRocmVhZEJ1bGtFZGl0cywgU2luZ2xlUHJveHlSUENQcm90b2NvbChudWxsKSk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoYGFwcGx5V29ya3NwYWNlRWRpdCByZXR1cm5zIGZhbHNlIGlmIG1vZGVsIGlzIGNoYW5nZWQgYnkgdXNlcmAsICgpID0+IHtcblxuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG1vZGVsU2VydmljZS5jcmVhdGVNb2RlbCgnc29tZXRoaW5nJywgbnVsbCwgcmVzb3VyY2UpKTtcblxuXHRcdGNvbnN0IHdvcmtzcGFjZVJlc291cmNlRWRpdDogSVdvcmtzcGFjZVRleHRFZGl0RHRvID0ge1xuXHRcdFx0cmVzb3VyY2U6IHJlc291cmNlLFxuXHRcdFx0dmVyc2lvbklkOiBtb2RlbC5nZXRWZXJzaW9uSWQoKSxcblx0XHRcdHRleHRFZGl0OiB7XG5cdFx0XHRcdHRleHQ6ICdhc2RmZycsXG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMSlcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Ly8gQWN0IGFzIGlmIHRoZSB1c2VyIGVkaXRlZCB0aGUgbW9kZWxcblx0XHRtb2RlbC5hcHBseUVkaXRzKFtFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oMCwgMCksICdzb21ldGhpbmcnKV0pO1xuXG5cdFx0cmV0dXJuIGJ1bGtFZGl0cy4kdHJ5QXBwbHlXb3Jrc3BhY2VFZGl0KG5ldyBTZXJpYWxpemFibGVPYmplY3RXaXRoQnVmZmVycyh7IGVkaXRzOiBbd29ya3NwYWNlUmVzb3VyY2VFZGl0XSB9KSkudGhlbigocmVzdWx0KSA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCBmYWxzZSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoYGlzc3VlICM1NDc3MzogYXBwbHlXb3Jrc3BhY2VFZGl0IGNoZWNrcyBtb2RlbCB2ZXJzaW9uIGluIHJhY2Ugc2l0dWF0aW9uYCwgKCkgPT4ge1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsKCdzb21ldGhpbmcnLCBudWxsLCByZXNvdXJjZSkpO1xuXG5cdFx0Y29uc3Qgd29ya3NwYWNlUmVzb3VyY2VFZGl0MTogSVdvcmtzcGFjZVRleHRFZGl0RHRvID0ge1xuXHRcdFx0cmVzb3VyY2U6IHJlc291cmNlLFxuXHRcdFx0dmVyc2lvbklkOiBtb2RlbC5nZXRWZXJzaW9uSWQoKSxcblx0XHRcdHRleHRFZGl0OiB7XG5cdFx0XHRcdHRleHQ6ICdhc2RmZycsXG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMSlcblx0XHRcdH1cblx0XHR9O1xuXHRcdGNvbnN0IHdvcmtzcGFjZVJlc291cmNlRWRpdDI6IElXb3Jrc3BhY2VUZXh0RWRpdER0byA9IHtcblx0XHRcdHJlc291cmNlOiByZXNvdXJjZSxcblx0XHRcdHZlcnNpb25JZDogbW9kZWwuZ2V0VmVyc2lvbklkKCksXG5cdFx0XHR0ZXh0RWRpdDoge1xuXHRcdFx0XHR0ZXh0OiAnYXNkZmcnLFxuXHRcdFx0XHRyYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDEpXG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IHAxID0gYnVsa0VkaXRzLiR0cnlBcHBseVdvcmtzcGFjZUVkaXQobmV3IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzKHsgZWRpdHM6IFt3b3Jrc3BhY2VSZXNvdXJjZUVkaXQxXSB9KSkudGhlbigocmVzdWx0KSA9PiB7XG5cdFx0XHQvLyBmaXJzdCBlZGl0IHJlcXVlc3Qgc3VjY2VlZHNcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsIHRydWUpO1xuXHRcdH0pO1xuXHRcdGNvbnN0IHAyID0gYnVsa0VkaXRzLiR0cnlBcHBseVdvcmtzcGFjZUVkaXQobmV3IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzKHsgZWRpdHM6IFt3b3Jrc3BhY2VSZXNvdXJjZUVkaXQyXSB9KSkudGhlbigocmVzdWx0KSA9PiB7XG5cdFx0XHQvLyBzZWNvbmQgZWRpdCByZXF1ZXN0IGZhaWxzXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCBmYWxzZSk7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIFByb21pc2UuYWxsKFtwMSwgcDJdKTtcblx0fSk7XG5cblx0dGVzdChgYXBwbHlXb3Jrc3BhY2VFZGl0IHdpdGggb25seSByZXNvdXJjZSBlZGl0YCwgKCkgPT4ge1xuXHRcdHJldHVybiBidWxrRWRpdHMuJHRyeUFwcGx5V29ya3NwYWNlRWRpdChuZXcgU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnMoe1xuXHRcdFx0ZWRpdHM6IFtcblx0XHRcdFx0eyBvbGRSZXNvdXJjZTogcmVzb3VyY2UsIG5ld1Jlc291cmNlOiByZXNvdXJjZSwgb3B0aW9uczogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdHsgb2xkUmVzb3VyY2U6IHVuZGVmaW5lZCwgbmV3UmVzb3VyY2U6IHJlc291cmNlLCBvcHRpb25zOiB1bmRlZmluZWQgfSxcblx0XHRcdFx0eyBvbGRSZXNvdXJjZTogcmVzb3VyY2UsIG5ld1Jlc291cmNlOiB1bmRlZmluZWQsIG9wdGlvbnM6IHVuZGVmaW5lZCB9XG5cdFx0XHRdXG5cdFx0fSkpLnRoZW4oKHJlc3VsdCkgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW92ZWRSZXNvdXJjZXMuZ2V0KHJlc291cmNlKSwgcmVzb3VyY2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZWRSZXNvdXJjZXMuaGFzKHJlc291cmNlKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVsZXRlZFJlc291cmNlcy5oYXMocmVzb3VyY2UpLCB0cnVlKTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGFBQWE7QUFDdEIsU0FBUyxpQkFBNkIseUJBQXlCO0FBQy9ELFNBQVMsV0FBVztBQUNwQixTQUFTLFlBQVk7QUFDckIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyx3QkFBd0I7QUFDakMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBRXRCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQW1DLHlCQUF5QjtBQUM1RCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGFBQWEsc0JBQXNCO0FBQzVDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMkJBQTJCO0FB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
