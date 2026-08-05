var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { multibyteAwareBtoa } from "../../../base/browser/dom.js";
import { createCancelablePromise } from "../../../base/common/async.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { isCancellationError, onUnexpectedError } from "../../../base/common/errors.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable, DisposableMap, DisposableStore } from "../../../base/common/lifecycle.js";
import { Schemas } from "../../../base/common/network.js";
import { basename } from "../../../base/common/path.js";
import { isEqual, isEqualOrParent, toLocalResource } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { localize } from "../../../nls.js";
import { IFileDialogService } from "../../../platform/dialogs/common/dialogs.js";
import { FileOperation, IFileService } from "../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../platform/label/common/label.js";
import { IStorageService } from "../../../platform/storage/common/storage.js";
import { IUndoRedoService, UndoRedoElementType } from "../../../platform/undoRedo/common/undoRedo.js";
import { reviveWebviewExtension } from "./mainThreadWebviews.js";
import * as extHostProtocol from "../common/extHost.protocol.js";
import { CustomEditorInput } from "../../contrib/customEditor/browser/customEditorInput.js";
import { ICustomEditorService } from "../../contrib/customEditor/common/customEditor.js";
import { CustomTextEditorModel } from "../../contrib/customEditor/common/customTextEditorModel.js";
import { ExtensionKeyedWebviewOriginStore } from "../../contrib/webview/browser/webview.js";
import { IWebviewWorkbenchService } from "../../contrib/webviewPanel/browser/webviewWorkbenchService.js";
import { editorGroupToColumn } from "../../services/editor/common/editorGroupColumn.js";
import { IEditorGroupsService } from "../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../services/editor/common/editorService.js";
import { IWorkbenchEnvironmentService } from "../../services/environment/common/environmentService.js";
import { IExtensionService } from "../../services/extensions/common/extensions.js";
import { IPathService } from "../../services/path/common/pathService.js";
import { ResourceWorkingCopy } from "../../services/workingCopy/common/resourceWorkingCopy.js";
import { NO_TYPE_ID, WorkingCopyCapabilities } from "../../services/workingCopy/common/workingCopy.js";
import { IWorkingCopyFileService } from "../../services/workingCopy/common/workingCopyFileService.js";
import { IWorkingCopyService } from "../../services/workingCopy/common/workingCopyService.js";
import { IUriIdentityService } from "../../../platform/uriIdentity/common/uriIdentity.js";
var CustomEditorModelType = /* @__PURE__ */ ((CustomEditorModelType2) => {
  CustomEditorModelType2[CustomEditorModelType2["Custom"] = 0] = "Custom";
  CustomEditorModelType2[CustomEditorModelType2["Text"] = 1] = "Text";
  return CustomEditorModelType2;
})(CustomEditorModelType || {});
let MainThreadCustomEditors = class extends Disposable {
  constructor(context, mainThreadWebview, mainThreadWebviewPanels, extensionService, storageService, workingCopyService, workingCopyFileService, _customEditorService, _editorGroupService, _editorService, _instantiationService, _webviewWorkbenchService, _uriIdentityService) {
    super();
    this.mainThreadWebview = mainThreadWebview;
    this.mainThreadWebviewPanels = mainThreadWebviewPanels;
    this._customEditorService = _customEditorService;
    this._editorGroupService = _editorGroupService;
    this._editorService = _editorService;
    this._instantiationService = _instantiationService;
    this._webviewWorkbenchService = _webviewWorkbenchService;
    this._uriIdentityService = _uriIdentityService;
    this._editorProviders = this._register(new DisposableMap());
    this._editorRenameBackups = /* @__PURE__ */ new Map();
    this._webviewOriginStore = new ExtensionKeyedWebviewOriginStore("mainThreadCustomEditors.origins", storageService);
    this._proxyCustomEditors = context.getProxy(extHostProtocol.ExtHostContext.ExtHostCustomEditors);
    this._register(workingCopyFileService.registerWorkingCopyProvider((editorResource) => {
      const matchedWorkingCopies = [];
      for (const workingCopy of workingCopyService.workingCopies) {
        if (workingCopy instanceof MainThreadCustomEditorModel) {
          if (isEqualOrParent(editorResource, workingCopy.editorResource)) {
            matchedWorkingCopies.push(workingCopy);
          }
        }
      }
      return matchedWorkingCopies;
    }));
    this._register(_webviewWorkbenchService.registerResolver({
      canResolve: (webview) => {
        if (webview instanceof CustomEditorInput) {
          extensionService.activateByEvent(`onCustomEditor:${webview.viewType}`);
        }
        return false;
      },
      resolveWebview: () => {
        throw new Error("not implemented");
      }
    }));
    this._register(workingCopyFileService.onWillRunWorkingCopyFileOperation(async (e) => this.onWillRunWorkingCopyFileOperation(e)));
  }
  $registerTextEditorProvider(extensionData, viewType, options, capabilities, serializeBuffersForPostMessage) {
    this.registerEditorProvider(1 /* Text */, reviveWebviewExtension(extensionData), viewType, options, capabilities, true, serializeBuffersForPostMessage);
  }
  $registerCustomEditorProvider(extensionData, viewType, options, supportsMultipleEditorsPerDocument, serializeBuffersForPostMessage) {
    this.registerEditorProvider(0 /* Custom */, reviveWebviewExtension(extensionData), viewType, options, {}, supportsMultipleEditorsPerDocument, serializeBuffersForPostMessage);
  }
  registerEditorProvider(modelType, extension, viewType, options, capabilities, supportsMultipleEditorsPerDocument, serializeBuffersForPostMessage) {
    if (this._editorProviders.has(viewType)) {
      throw new Error(`Provider for ${viewType} already registered`);
    }
    const disposables = new DisposableStore();
    disposables.add(this._customEditorService.registerCustomEditorCapabilities(viewType, {
      supportsMultipleEditorsPerDocument
    }));
    disposables.add(this._webviewWorkbenchService.registerResolver({
      canResolve: (webviewInput) => {
        return webviewInput instanceof CustomEditorInput && webviewInput.viewType === viewType;
      },
      resolveWebview: async (webviewInput, cancellation) => {
        const handle = generateUuid();
        const resource = webviewInput.resource;
        webviewInput.webview.origin = this._webviewOriginStore.getOrigin(viewType, extension.id);
        this.mainThreadWebviewPanels.addWebviewInput(handle, webviewInput, { serializeBuffersForPostMessage });
        webviewInput.webview.options = options;
        webviewInput.webview.extension = extension;
        let backupId = webviewInput.backupId;
        if (webviewInput.oldResource && !webviewInput.backupId) {
          const backup = this._editorRenameBackups.get(webviewInput.oldResource.toString());
          backupId = backup?.backupId;
          this._editorRenameBackups.delete(webviewInput.oldResource.toString());
        }
        let modelRef;
        try {
          modelRef = await this.getOrCreateCustomEditorModel(modelType, resource, viewType, { backupId }, cancellation);
        } catch (error) {
          onUnexpectedError(error);
          webviewInput.webview.setHtml(this.mainThreadWebview.getWebviewResolvedFailedContent(viewType));
          return;
        }
        if (cancellation.isCancellationRequested) {
          modelRef.dispose();
          return;
        }
        const disposeSub = webviewInput.webview.onDidDispose(() => {
          disposeSub.dispose();
          if (modelRef.object.isDirty()) {
            const sub = modelRef.object.onDidChangeDirty(() => {
              if (!modelRef.object.isDirty()) {
                sub.dispose();
                modelRef.dispose();
              }
            });
            return;
          }
          modelRef.dispose();
        });
        if (capabilities.supportsMove) {
          webviewInput.onMove(async (newResource) => {
            const oldModel = modelRef;
            modelRef = await this.getOrCreateCustomEditorModel(modelType, newResource, viewType, {}, CancellationToken.None);
            this._proxyCustomEditors.$onMoveCustomEditor(handle, newResource, viewType);
            oldModel.dispose();
          });
        }
        try {
          await this._proxyCustomEditors.$resolveCustomEditor(this._uriIdentityService.asCanonicalUri(resource), handle, viewType, {
            title: webviewInput.getTitle(),
            contentOptions: webviewInput.webview.contentOptions,
            options: webviewInput.webview.options,
            active: webviewInput === this._editorService.activeEditor
          }, editorGroupToColumn(this._editorGroupService, webviewInput.group || 0), cancellation);
        } catch (error) {
          onUnexpectedError(error);
          webviewInput.webview.setHtml(this.mainThreadWebview.getWebviewResolvedFailedContent(viewType));
          modelRef.dispose();
          return;
        }
      }
    }));
    this._editorProviders.set(viewType, disposables);
  }
  $unregisterEditorProvider(viewType) {
    if (!this._editorProviders.has(viewType)) {
      throw new Error(`No provider for ${viewType} registered`);
    }
    this._editorProviders.deleteAndDispose(viewType);
    this._customEditorService.models.disposeAllModelsForView(viewType);
  }
  async getOrCreateCustomEditorModel(modelType, resource, viewType, options, cancellation) {
    const existingModel = this._customEditorService.models.tryRetain(resource, viewType);
    if (existingModel) {
      return existingModel;
    }
    switch (modelType) {
      case 1 /* Text */: {
        const model = CustomTextEditorModel.create(this._instantiationService, viewType, resource);
        return this._customEditorService.models.add(resource, viewType, model);
      }
      case 0 /* Custom */: {
        const model = MainThreadCustomEditorModel.create(this._instantiationService, this._proxyCustomEditors, viewType, resource, options, () => {
          return Array.from(this.mainThreadWebviewPanels.webviewInputs).filter((editor) => editor instanceof CustomEditorInput && isEqual(editor.resource, resource));
        }, cancellation);
        return this._customEditorService.models.add(resource, viewType, model);
      }
    }
  }
  async $onDidEdit(resourceComponents, viewType, editId, label) {
    const model = await this.getCustomEditorModel(resourceComponents, viewType);
    model.pushEdit(editId, label);
  }
  async $onContentChange(resourceComponents, viewType) {
    const model = await this.getCustomEditorModel(resourceComponents, viewType);
    model.changeContent();
  }
  async getCustomEditorModel(resourceComponents, viewType) {
    const resource = URI.revive(resourceComponents);
    const model = await this._customEditorService.models.get(resource, viewType);
    if (!model || !(model instanceof MainThreadCustomEditorModel)) {
      throw new Error("Could not find model for webview editor");
    }
    return model;
  }
  //#region Working Copy
  async onWillRunWorkingCopyFileOperation(e) {
    if (e.operation !== FileOperation.MOVE) {
      return;
    }
    e.waitUntil((async () => {
      const models = [];
      for (const file of e.files) {
        if (file.source) {
          models.push(...await this._customEditorService.models.getAllModels(file.source));
        }
      }
      for (const model of models) {
        if (model instanceof MainThreadCustomEditorModel && model.isDirty()) {
          const workingCopy = await model.backup(CancellationToken.None);
          if (workingCopy.meta) {
            this._editorRenameBackups.set(model.editorResource.toString(), workingCopy.meta);
          }
        }
      }
    })());
  }
  //#endregion
};
MainThreadCustomEditors = __decorateClass([
  __decorateParam(3, IExtensionService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IWorkingCopyService),
  __decorateParam(6, IWorkingCopyFileService),
  __decorateParam(7, ICustomEditorService),
  __decorateParam(8, IEditorGroupsService),
  __decorateParam(9, IEditorService),
  __decorateParam(10, IInstantiationService),
  __decorateParam(11, IWebviewWorkbenchService),
  __decorateParam(12, IUriIdentityService)
], MainThreadCustomEditors);
var HotExitState;
((HotExitState2) => {
  let Type;
  ((Type2) => {
    Type2[Type2["Allowed"] = 0] = "Allowed";
    Type2[Type2["NotAllowed"] = 1] = "NotAllowed";
    Type2[Type2["Pending"] = 2] = "Pending";
  })(Type = HotExitState2.Type || (HotExitState2.Type = {}));
  HotExitState2.Allowed = Object.freeze({ type: 0 /* Allowed */ });
  HotExitState2.NotAllowed = Object.freeze({ type: 1 /* NotAllowed */ });
  class Pending {
    constructor(operation) {
      this.operation = operation;
      this.type = 2 /* Pending */;
    }
  }
  HotExitState2.Pending = Pending;
})(HotExitState || (HotExitState = {}));
let MainThreadCustomEditorModel = class extends ResourceWorkingCopy {
  constructor(_proxy, _viewType, _editorResource, fromBackup, _editable, startDirty, _getEditors, _fileDialogService, fileService, _labelService, _undoService, _environmentService, workingCopyService, _pathService, extensionService) {
    super(MainThreadCustomEditorModel.toWorkingCopyResource(_viewType, _editorResource), fileService);
    this._proxy = _proxy;
    this._viewType = _viewType;
    this._editorResource = _editorResource;
    this._editable = _editable;
    this._getEditors = _getEditors;
    this._fileDialogService = _fileDialogService;
    this._labelService = _labelService;
    this._undoService = _undoService;
    this._environmentService = _environmentService;
    this._pathService = _pathService;
    this._fromBackup = false;
    this._hotExitState = HotExitState.Allowed;
    this._currentEditIndex = -1;
    this._savePoint = -1;
    this._edits = [];
    this._isDirtyFromContentChange = false;
    // TODO@mjbvz consider to enable a `typeId` that is specific for custom
    // editors. Using a distinct `typeId` allows the working copy to have
    // any resource (including file based resources) even if other working
    // copies exist with the same resource.
    //
    // IMPORTANT: changing the `typeId` has an impact on backups for this
    // working copy. Any value that is not the empty string will be used
    // as seed to the backup. Only change the `typeId` if you have implemented
    // a fallback solution to resolve any existing backups that do not have
    // this seed.
    this.typeId = NO_TYPE_ID;
    this._onDidChangeDirty = this._register(new Emitter());
    this.onDidChangeDirty = this._onDidChangeDirty.event;
    this._onDidChangeContent = this._register(new Emitter());
    this.onDidChangeContent = this._onDidChangeContent.event;
    this._onDidSave = this._register(new Emitter());
    this.onDidSave = this._onDidSave.event;
    this.onDidChangeReadonly = Event.None;
    this._fromBackup = fromBackup;
    if (_editable) {
      this._register(workingCopyService.registerWorkingCopy(this));
      this._register(extensionService.onWillStop((e) => {
        e.veto(true, localize("vetoExtHostRestart", "An extension provided editor for '{0}' is still open that would close otherwise.", this.name));
      }));
    }
    if (startDirty) {
      this._isDirtyFromContentChange = true;
    }
  }
  static async create(instantiationService, proxy, viewType, resource, options, getEditors, cancellation) {
    const editors = getEditors();
    let untitledDocumentData;
    if (editors.length !== 0) {
      untitledDocumentData = editors[0].untitledDocumentData;
    }
    const { editable } = await proxy.$createCustomDocument(resource, viewType, options.backupId, untitledDocumentData, cancellation);
    return instantiationService.createInstance(MainThreadCustomEditorModel, proxy, viewType, resource, !!options.backupId, editable, !!untitledDocumentData, getEditors);
  }
  get editorResource() {
    return this._editorResource;
  }
  dispose() {
    if (this._editable) {
      this._undoService.removeElements(this._editorResource);
    }
    this._proxy.$disposeCustomDocument(this._editorResource, this._viewType);
    super.dispose();
  }
  //#region IWorkingCopy
  // Make sure each custom editor has a unique resource for backup and edits
  static toWorkingCopyResource(viewType, resource) {
    const authority = viewType.replace(/[^a-z0-9\-_]/gi, "-");
    const path = `/${multibyteAwareBtoa(resource.with({ query: null, fragment: null }).toString(true))}`;
    return URI.from({
      scheme: Schemas.vscodeCustomEditor,
      authority,
      path,
      query: JSON.stringify(resource.toJSON())
    });
  }
  get name() {
    return basename(this._labelService.getUriLabel(this._editorResource));
  }
  get capabilities() {
    return this.isUntitled() ? WorkingCopyCapabilities.Untitled : WorkingCopyCapabilities.None;
  }
  isDirty() {
    if (this._isDirtyFromContentChange) {
      return true;
    }
    if (this._edits.length > 0) {
      return this._savePoint !== this._currentEditIndex;
    }
    return this._fromBackup;
  }
  isUntitled() {
    return this._editorResource.scheme === Schemas.untitled;
  }
  //#endregion
  isReadonly() {
    return !this._editable;
  }
  get viewType() {
    return this._viewType;
  }
  get backupId() {
    return this._backupId;
  }
  pushEdit(editId, label) {
    if (!this._editable) {
      throw new Error("Document is not editable");
    }
    this.change(() => {
      this.spliceEdits(editId);
      this._currentEditIndex = this._edits.length - 1;
    });
    this._undoService.pushElement({
      type: UndoRedoElementType.Resource,
      resource: this._editorResource,
      label: label ?? localize("defaultEditLabel", "Edit"),
      code: "undoredo.customEditorEdit",
      undo: () => this.undo(),
      redo: () => this.redo()
    });
  }
  changeContent() {
    this.change(() => {
      this._isDirtyFromContentChange = true;
    });
  }
  async undo() {
    if (!this._editable) {
      return;
    }
    if (this._currentEditIndex < 0) {
      return;
    }
    const undoneEdit = this._edits[this._currentEditIndex];
    this.change(() => {
      --this._currentEditIndex;
    });
    await this._proxy.$undo(this._editorResource, this.viewType, undoneEdit, this.isDirty());
  }
  async redo() {
    if (!this._editable) {
      return;
    }
    if (this._currentEditIndex >= this._edits.length - 1) {
      return;
    }
    const redoneEdit = this._edits[this._currentEditIndex + 1];
    this.change(() => {
      ++this._currentEditIndex;
    });
    await this._proxy.$redo(this._editorResource, this.viewType, redoneEdit, this.isDirty());
  }
  spliceEdits(editToInsert) {
    const start = this._currentEditIndex + 1;
    const toRemove = this._edits.length - this._currentEditIndex;
    const removedEdits = typeof editToInsert === "number" ? this._edits.splice(start, toRemove, editToInsert) : this._edits.splice(start, toRemove);
    if (removedEdits.length) {
      this._proxy.$disposeEdits(this._editorResource, this._viewType, removedEdits);
    }
  }
  change(makeEdit) {
    const wasDirty = this.isDirty();
    makeEdit();
    this._onDidChangeContent.fire();
    if (this.isDirty() !== wasDirty) {
      this._onDidChangeDirty.fire();
    }
  }
  async revert(options) {
    if (!this._editable) {
      return;
    }
    if (this._currentEditIndex === this._savePoint && !this._isDirtyFromContentChange && !this._fromBackup) {
      return;
    }
    if (!options?.soft) {
      this._proxy.$revert(this._editorResource, this.viewType, CancellationToken.None);
    }
    this.change(() => {
      this._isDirtyFromContentChange = false;
      this._fromBackup = false;
      this._currentEditIndex = this._savePoint;
      this.spliceEdits();
    });
  }
  async save(options) {
    const result = !!await this.saveCustomEditor(options);
    if (result) {
      this._onDidSave.fire({ reason: options?.reason, source: options?.source });
    }
    return result;
  }
  async saveCustomEditor(options) {
    if (!this._editable) {
      return void 0;
    }
    if (this.isUntitled()) {
      const targetUri = await this.suggestUntitledSavePath(options);
      if (!targetUri) {
        return void 0;
      }
      await this.saveCustomEditorAs(this._editorResource, targetUri, options);
      return targetUri;
    }
    const savePromise = createCancelablePromise((token) => this._proxy.$onSave(this._editorResource, this.viewType, token));
    this._ongoingSave?.cancel();
    this._ongoingSave = savePromise;
    try {
      await savePromise;
      if (this._ongoingSave === savePromise) {
        this.change(() => {
          this._isDirtyFromContentChange = false;
          this._savePoint = this._currentEditIndex;
          this._fromBackup = false;
        });
      }
    } finally {
      if (this._ongoingSave === savePromise) {
        this._ongoingSave = void 0;
      }
    }
    return this._editorResource;
  }
  suggestUntitledSavePath(options) {
    if (!this.isUntitled()) {
      throw new Error("Resource is not untitled");
    }
    const remoteAuthority = this._environmentService.remoteAuthority;
    const localResource = toLocalResource(this._editorResource, remoteAuthority, this._pathService.defaultUriScheme);
    return this._fileDialogService.pickFileToSave(localResource, options?.availableFileSystems);
  }
  async saveCustomEditorAs(resource, targetResource, _options) {
    if (this._editable) {
      await createCancelablePromise((token) => this._proxy.$onSaveAs(this._editorResource, this.viewType, targetResource, token));
      this.change(() => {
        this._savePoint = this._currentEditIndex;
      });
      return true;
    } else {
      await this.fileService.copy(
        resource,
        targetResource,
        false
        /* overwrite */
      );
      return true;
    }
  }
  get canHotExit() {
    return typeof this._backupId === "string" && this._hotExitState.type === 0 /* Allowed */;
  }
  async backup(token) {
    const editors = this._getEditors();
    if (!editors.length) {
      throw new Error("No editors found for resource, cannot back up");
    }
    const primaryEditor = editors[0];
    const backupMeta = {
      viewType: this.viewType,
      editorResource: this._editorResource,
      backupId: "",
      extension: primaryEditor.extension ? {
        id: primaryEditor.extension.id.value,
        location: primaryEditor.extension.location
      } : void 0,
      webview: {
        origin: primaryEditor.webview.origin,
        options: primaryEditor.webview.options,
        state: primaryEditor.webview.state
      }
    };
    const backupData = {
      meta: backupMeta
    };
    if (!this._editable) {
      return backupData;
    }
    if (this._hotExitState.type === 2 /* Pending */) {
      this._hotExitState.operation.cancel();
    }
    const pendingState = new HotExitState.Pending(
      createCancelablePromise((token2) => this._proxy.$backup(this._editorResource.toJSON(), this.viewType, token2))
    );
    this._hotExitState = pendingState;
    token.onCancellationRequested(() => {
      pendingState.operation.cancel();
    });
    let errorMessage = "";
    try {
      const backupId = await pendingState.operation;
      if (this._hotExitState === pendingState) {
        this._hotExitState = HotExitState.Allowed;
        backupData.meta.backupId = backupId;
        this._backupId = backupId;
      }
    } catch (e) {
      if (isCancellationError(e)) {
        throw e;
      }
      if (this._hotExitState === pendingState) {
        this._hotExitState = HotExitState.NotAllowed;
      }
      if (e.message) {
        errorMessage = e.message;
      }
    }
    if (this._hotExitState === HotExitState.Allowed) {
      return backupData;
    }
    throw new Error(`Cannot backup in this state: ${errorMessage}`);
  }
};
MainThreadCustomEditorModel = __decorateClass([
  __decorateParam(7, IFileDialogService),
  __decorateParam(8, IFileService),
  __decorateParam(9, ILabelService),
  __decorateParam(10, IUndoRedoService),
  __decorateParam(11, IWorkbenchEnvironmentService),
  __decorateParam(12, IWorkingCopyService),
  __decorateParam(13, IPathService),
  __decorateParam(14, IExtensionService)
], MainThreadCustomEditorModel);
export {
  MainThreadCustomEditors
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZEN1c3RvbUVkaXRvcnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBtdWx0aWJ5dGVBd2FyZUJ0b2EgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IENhbmNlbGFibGVQcm9taXNlLCBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IGlzQ2FuY2VsbGF0aW9uRXJyb3IsIG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZU1hcCwgRGlzcG9zYWJsZVN0b3JlLCBJUmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBpc0VxdWFsLCBpc0VxdWFsT3JQYXJlbnQsIHRvTG9jYWxSZXNvdXJjZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkksIFVyaUNvbXBvbmVudHMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJRmlsZURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IEZpbGVPcGVyYXRpb24sIElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVW5kb1JlZG9TZXJ2aWNlLCBVbmRvUmVkb0VsZW1lbnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdW5kb1JlZG8vY29tbW9uL3VuZG9SZWRvLmpzJztcbmltcG9ydCB7IE1haW5UaHJlYWRXZWJ2aWV3UGFuZWxzIH0gZnJvbSAnLi9tYWluVGhyZWFkV2Vidmlld1BhbmVscy5qcyc7XG5pbXBvcnQgeyBNYWluVGhyZWFkV2Vidmlld3MsIHJldml2ZVdlYnZpZXdFeHRlbnNpb24gfSBmcm9tICcuL21haW5UaHJlYWRXZWJ2aWV3cy5qcyc7XG5pbXBvcnQgKiBhcyBleHRIb3N0UHJvdG9jb2wgZnJvbSAnLi4vY29tbW9uL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgSVJldmVydE9wdGlvbnMsIElTYXZlT3B0aW9ucyB9IGZyb20gJy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgQ3VzdG9tRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi9jb250cmliL2N1c3RvbUVkaXRvci9icm93c2VyL2N1c3RvbUVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IEN1c3RvbURvY3VtZW50QmFja3VwRGF0YSB9IGZyb20gJy4uLy4uL2NvbnRyaWIvY3VzdG9tRWRpdG9yL2Jyb3dzZXIvY3VzdG9tRWRpdG9ySW5wdXRGYWN0b3J5LmpzJztcbmltcG9ydCB7IElDdXN0b21FZGl0b3JNb2RlbCwgSUN1c3RvbUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb250cmliL2N1c3RvbUVkaXRvci9jb21tb24vY3VzdG9tRWRpdG9yLmpzJztcbmltcG9ydCB7IEN1c3RvbVRleHRFZGl0b3JNb2RlbCB9IGZyb20gJy4uLy4uL2NvbnRyaWIvY3VzdG9tRWRpdG9yL2NvbW1vbi9jdXN0b21UZXh0RWRpdG9yTW9kZWwuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uS2V5ZWRXZWJ2aWV3T3JpZ2luU3RvcmUsIFdlYnZpZXdFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uL2NvbnRyaWIvd2Vidmlldy9icm93c2VyL3dlYnZpZXcuanMnO1xuaW1wb3J0IHsgV2Vidmlld0lucHV0IH0gZnJvbSAnLi4vLi4vY29udHJpYi93ZWJ2aWV3UGFuZWwvYnJvd3Nlci93ZWJ2aWV3RWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgSVdlYnZpZXdXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29udHJpYi93ZWJ2aWV3UGFuZWwvYnJvd3Nlci93ZWJ2aWV3V29ya2JlbmNoU2VydmljZS5qcyc7XG5pbXBvcnQgeyBlZGl0b3JHcm91cFRvQ29sdW1uIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cENvbHVtbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RDb250ZXh0IH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0SG9zdEN1c3RvbWVycy5qcyc7XG5pbXBvcnQgeyBJUGF0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9wYXRoL2NvbW1vbi9wYXRoU2VydmljZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZVdvcmtpbmdDb3B5IH0gZnJvbSAnLi4vLi4vc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3Jlc291cmNlV29ya2luZ0NvcHkuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5LCBJV29ya2luZ0NvcHlCYWNrdXAsIElXb3JraW5nQ29weVNhdmVFdmVudCwgTk9fVFlQRV9JRCwgV29ya2luZ0NvcHlDYXBhYmlsaXRpZXMgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHkuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5RmlsZVNlcnZpY2UsIFdvcmtpbmdDb3B5RmlsZUV2ZW50IH0gZnJvbSAnLi4vLi4vc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5RmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5U2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL3dvcmtpbmdDb3B5L2NvbW1vbi93b3JraW5nQ29weVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5cbmNvbnN0IGVudW0gQ3VzdG9tRWRpdG9yTW9kZWxUeXBlIHtcblx0Q3VzdG9tLFxuXHRUZXh0LFxufVxuXG5leHBvcnQgY2xhc3MgTWFpblRocmVhZEN1c3RvbUVkaXRvcnMgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgZXh0SG9zdFByb3RvY29sLk1haW5UaHJlYWRDdXN0b21FZGl0b3JzU2hhcGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5Q3VzdG9tRWRpdG9yczogZXh0SG9zdFByb3RvY29sLkV4dEhvc3RDdXN0b21FZGl0b3JzU2hhcGU7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yUHJvdmlkZXJzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVNYXA8c3RyaW5nPigpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JSZW5hbWVCYWNrdXBzID0gbmV3IE1hcDxzdHJpbmcsIEN1c3RvbURvY3VtZW50QmFja3VwRGF0YT4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF93ZWJ2aWV3T3JpZ2luU3RvcmU6IEV4dGVuc2lvbktleWVkV2Vidmlld09yaWdpblN0b3JlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRleHQ6IElFeHRIb3N0Q29udGV4dCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IG1haW5UaHJlYWRXZWJ2aWV3OiBNYWluVGhyZWFkV2Vidmlld3MsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBtYWluVGhyZWFkV2Vidmlld1BhbmVsczogTWFpblRocmVhZFdlYnZpZXdQYW5lbHMsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2Ugc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASVdvcmtpbmdDb3B5U2VydmljZSB3b3JraW5nQ29weVNlcnZpY2U6IElXb3JraW5nQ29weVNlcnZpY2UsXG5cdFx0QElXb3JraW5nQ29weUZpbGVTZXJ2aWNlIHdvcmtpbmdDb3B5RmlsZVNlcnZpY2U6IElXb3JraW5nQ29weUZpbGVTZXJ2aWNlLFxuXHRcdEBJQ3VzdG9tRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jdXN0b21FZGl0b3JTZXJ2aWNlOiBJQ3VzdG9tRWRpdG9yU2VydmljZSxcblx0XHRASUVkaXRvckdyb3Vwc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yR3JvdXBTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJV2Vidmlld1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfd2Vidmlld1dvcmtiZW5jaFNlcnZpY2U6IElXZWJ2aWV3V29ya2JlbmNoU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF91cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl93ZWJ2aWV3T3JpZ2luU3RvcmUgPSBuZXcgRXh0ZW5zaW9uS2V5ZWRXZWJ2aWV3T3JpZ2luU3RvcmUoJ21haW5UaHJlYWRDdXN0b21FZGl0b3JzLm9yaWdpbnMnLCBzdG9yYWdlU2VydmljZSk7XG5cblx0XHR0aGlzLl9wcm94eUN1c3RvbUVkaXRvcnMgPSBjb250ZXh0LmdldFByb3h5KGV4dEhvc3RQcm90b2NvbC5FeHRIb3N0Q29udGV4dC5FeHRIb3N0Q3VzdG9tRWRpdG9ycyk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih3b3JraW5nQ29weUZpbGVTZXJ2aWNlLnJlZ2lzdGVyV29ya2luZ0NvcHlQcm92aWRlcigoZWRpdG9yUmVzb3VyY2UpID0+IHtcblx0XHRcdGNvbnN0IG1hdGNoZWRXb3JraW5nQ29waWVzOiBJV29ya2luZ0NvcHlbXSA9IFtdO1xuXG5cdFx0XHRmb3IgKGNvbnN0IHdvcmtpbmdDb3B5IG9mIHdvcmtpbmdDb3B5U2VydmljZS53b3JraW5nQ29waWVzKSB7XG5cdFx0XHRcdGlmICh3b3JraW5nQ29weSBpbnN0YW5jZW9mIE1haW5UaHJlYWRDdXN0b21FZGl0b3JNb2RlbCkge1xuXHRcdFx0XHRcdGlmIChpc0VxdWFsT3JQYXJlbnQoZWRpdG9yUmVzb3VyY2UsIHdvcmtpbmdDb3B5LmVkaXRvclJlc291cmNlKSkge1xuXHRcdFx0XHRcdFx0bWF0Y2hlZFdvcmtpbmdDb3BpZXMucHVzaCh3b3JraW5nQ29weSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbWF0Y2hlZFdvcmtpbmdDb3BpZXM7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gVGhpcyByZXZpdmVyJ3Mgb25seSBqb2IgaXMgdG8gYWN0aXZhdGUgY3VzdG9tIGVkaXRvciBleHRlbnNpb25zLlxuXHRcdHRoaXMuX3JlZ2lzdGVyKF93ZWJ2aWV3V29ya2JlbmNoU2VydmljZS5yZWdpc3RlclJlc29sdmVyKHtcblx0XHRcdGNhblJlc29sdmU6ICh3ZWJ2aWV3OiBXZWJ2aWV3SW5wdXQpID0+IHtcblx0XHRcdFx0aWYgKHdlYnZpZXcgaW5zdGFuY2VvZiBDdXN0b21FZGl0b3JJbnB1dCkge1xuXHRcdFx0XHRcdGV4dGVuc2lvblNlcnZpY2UuYWN0aXZhdGVCeUV2ZW50KGBvbkN1c3RvbUVkaXRvcjoke3dlYnZpZXcudmlld1R5cGV9YCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSxcblx0XHRcdHJlc29sdmVXZWJ2aWV3OiAoKSA9PiB7IHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7IH1cblx0XHR9KSk7XG5cblx0XHQvLyBXb3JraW5nIGNvcHkgb3BlcmF0aW9uc1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHdvcmtpbmdDb3B5RmlsZVNlcnZpY2Uub25XaWxsUnVuV29ya2luZ0NvcHlGaWxlT3BlcmF0aW9uKGFzeW5jIGUgPT4gdGhpcy5vbldpbGxSdW5Xb3JraW5nQ29weUZpbGVPcGVyYXRpb24oZSkpKTtcblx0fVxuXG5cdHB1YmxpYyAkcmVnaXN0ZXJUZXh0RWRpdG9yUHJvdmlkZXIoZXh0ZW5zaW9uRGF0YTogZXh0SG9zdFByb3RvY29sLldlYnZpZXdFeHRlbnNpb25EZXNjcmlwdGlvbiwgdmlld1R5cGU6IHN0cmluZywgb3B0aW9uczogZXh0SG9zdFByb3RvY29sLklXZWJ2aWV3UGFuZWxPcHRpb25zLCBjYXBhYmlsaXRpZXM6IGV4dEhvc3RQcm90b2NvbC5DdXN0b21UZXh0RWRpdG9yQ2FwYWJpbGl0aWVzLCBzZXJpYWxpemVCdWZmZXJzRm9yUG9zdE1lc3NhZ2U6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLnJlZ2lzdGVyRWRpdG9yUHJvdmlkZXIoQ3VzdG9tRWRpdG9yTW9kZWxUeXBlLlRleHQsIHJldml2ZVdlYnZpZXdFeHRlbnNpb24oZXh0ZW5zaW9uRGF0YSksIHZpZXdUeXBlLCBvcHRpb25zLCBjYXBhYmlsaXRpZXMsIHRydWUsIHNlcmlhbGl6ZUJ1ZmZlcnNGb3JQb3N0TWVzc2FnZSk7XG5cdH1cblxuXHRwdWJsaWMgJHJlZ2lzdGVyQ3VzdG9tRWRpdG9yUHJvdmlkZXIoZXh0ZW5zaW9uRGF0YTogZXh0SG9zdFByb3RvY29sLldlYnZpZXdFeHRlbnNpb25EZXNjcmlwdGlvbiwgdmlld1R5cGU6IHN0cmluZywgb3B0aW9uczogZXh0SG9zdFByb3RvY29sLklXZWJ2aWV3UGFuZWxPcHRpb25zLCBzdXBwb3J0c011bHRpcGxlRWRpdG9yc1BlckRvY3VtZW50OiBib29sZWFuLCBzZXJpYWxpemVCdWZmZXJzRm9yUG9zdE1lc3NhZ2U6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLnJlZ2lzdGVyRWRpdG9yUHJvdmlkZXIoQ3VzdG9tRWRpdG9yTW9kZWxUeXBlLkN1c3RvbSwgcmV2aXZlV2Vidmlld0V4dGVuc2lvbihleHRlbnNpb25EYXRhKSwgdmlld1R5cGUsIG9wdGlvbnMsIHt9LCBzdXBwb3J0c011bHRpcGxlRWRpdG9yc1BlckRvY3VtZW50LCBzZXJpYWxpemVCdWZmZXJzRm9yUG9zdE1lc3NhZ2UpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckVkaXRvclByb3ZpZGVyKFxuXHRcdG1vZGVsVHlwZTogQ3VzdG9tRWRpdG9yTW9kZWxUeXBlLFxuXHRcdGV4dGVuc2lvbjogV2Vidmlld0V4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHRcdHZpZXdUeXBlOiBzdHJpbmcsXG5cdFx0b3B0aW9uczogZXh0SG9zdFByb3RvY29sLklXZWJ2aWV3UGFuZWxPcHRpb25zLFxuXHRcdGNhcGFiaWxpdGllczogZXh0SG9zdFByb3RvY29sLkN1c3RvbVRleHRFZGl0b3JDYXBhYmlsaXRpZXMsXG5cdFx0c3VwcG9ydHNNdWx0aXBsZUVkaXRvcnNQZXJEb2N1bWVudDogYm9vbGVhbixcblx0XHRzZXJpYWxpemVCdWZmZXJzRm9yUG9zdE1lc3NhZ2U6IGJvb2xlYW4sXG5cdCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9lZGl0b3JQcm92aWRlcnMuaGFzKHZpZXdUeXBlKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBQcm92aWRlciBmb3IgJHt2aWV3VHlwZX0gYWxyZWFkeSByZWdpc3RlcmVkYCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQodGhpcy5fY3VzdG9tRWRpdG9yU2VydmljZS5yZWdpc3RlckN1c3RvbUVkaXRvckNhcGFiaWxpdGllcyh2aWV3VHlwZSwge1xuXHRcdFx0c3VwcG9ydHNNdWx0aXBsZUVkaXRvcnNQZXJEb2N1bWVudFxuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZCh0aGlzLl93ZWJ2aWV3V29ya2JlbmNoU2VydmljZS5yZWdpc3RlclJlc29sdmVyKHtcblx0XHRcdGNhblJlc29sdmU6ICh3ZWJ2aWV3SW5wdXQpID0+IHtcblx0XHRcdFx0cmV0dXJuIHdlYnZpZXdJbnB1dCBpbnN0YW5jZW9mIEN1c3RvbUVkaXRvcklucHV0ICYmIHdlYnZpZXdJbnB1dC52aWV3VHlwZSA9PT0gdmlld1R5cGU7XG5cdFx0XHR9LFxuXHRcdFx0cmVzb2x2ZVdlYnZpZXc6IGFzeW5jICh3ZWJ2aWV3SW5wdXQ6IEN1c3RvbUVkaXRvcklucHV0LCBjYW5jZWxsYXRpb246IENhbmNlbGxhdGlvblRva2VuKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGhhbmRsZSA9IGdlbmVyYXRlVXVpZCgpO1xuXHRcdFx0XHRjb25zdCByZXNvdXJjZSA9IHdlYnZpZXdJbnB1dC5yZXNvdXJjZTtcblxuXHRcdFx0XHR3ZWJ2aWV3SW5wdXQud2Vidmlldy5vcmlnaW4gPSB0aGlzLl93ZWJ2aWV3T3JpZ2luU3RvcmUuZ2V0T3JpZ2luKHZpZXdUeXBlLCBleHRlbnNpb24uaWQpO1xuXG5cdFx0XHRcdHRoaXMubWFpblRocmVhZFdlYnZpZXdQYW5lbHMuYWRkV2Vidmlld0lucHV0KGhhbmRsZSwgd2Vidmlld0lucHV0LCB7IHNlcmlhbGl6ZUJ1ZmZlcnNGb3JQb3N0TWVzc2FnZSB9KTtcblx0XHRcdFx0d2Vidmlld0lucHV0LndlYnZpZXcub3B0aW9ucyA9IG9wdGlvbnM7XG5cdFx0XHRcdHdlYnZpZXdJbnB1dC53ZWJ2aWV3LmV4dGVuc2lvbiA9IGV4dGVuc2lvbjtcblxuXHRcdFx0XHQvLyBJZiB0aGVyZSdzIGFuIG9sZCByZXNvdXJjZSB0aGlzIHdhcyBhIG1vdmUgYW5kIHdlIG11c3QgcmVzb2x2ZSB0aGUgYmFja3VwIGF0IHRoZSBzYW1lIHRpbWUgYXMgdGhlIHdlYnZpZXdcblx0XHRcdFx0Ly8gVGhpcyBpcyBiZWNhdXNlIHRoZSBiYWNrdXAgbXVzdCBiZSByZWFkeSB1cG9uIG1vZGVsIGNyZWF0aW9uLCBhbmQgdGhlIGlucHV0IHJlc29sdmUgbWV0aG9kIGNvbWVzIGFmdGVyXG5cdFx0XHRcdGxldCBiYWNrdXBJZCA9IHdlYnZpZXdJbnB1dC5iYWNrdXBJZDtcblx0XHRcdFx0aWYgKHdlYnZpZXdJbnB1dC5vbGRSZXNvdXJjZSAmJiAhd2Vidmlld0lucHV0LmJhY2t1cElkKSB7XG5cdFx0XHRcdFx0Y29uc3QgYmFja3VwID0gdGhpcy5fZWRpdG9yUmVuYW1lQmFja3Vwcy5nZXQod2Vidmlld0lucHV0Lm9sZFJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRcdGJhY2t1cElkID0gYmFja3VwPy5iYWNrdXBJZDtcblx0XHRcdFx0XHR0aGlzLl9lZGl0b3JSZW5hbWVCYWNrdXBzLmRlbGV0ZSh3ZWJ2aWV3SW5wdXQub2xkUmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRsZXQgbW9kZWxSZWY6IElSZWZlcmVuY2U8SUN1c3RvbUVkaXRvck1vZGVsPjtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRtb2RlbFJlZiA9IGF3YWl0IHRoaXMuZ2V0T3JDcmVhdGVDdXN0b21FZGl0b3JNb2RlbChtb2RlbFR5cGUsIHJlc291cmNlLCB2aWV3VHlwZSwgeyBiYWNrdXBJZCB9LCBjYW5jZWxsYXRpb24pO1xuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGVycm9yKTtcblx0XHRcdFx0XHR3ZWJ2aWV3SW5wdXQud2Vidmlldy5zZXRIdG1sKHRoaXMubWFpblRocmVhZFdlYnZpZXcuZ2V0V2Vidmlld1Jlc29sdmVkRmFpbGVkQ29udGVudCh2aWV3VHlwZSkpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChjYW5jZWxsYXRpb24uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRtb2RlbFJlZi5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgZGlzcG9zZVN1YiA9IHdlYnZpZXdJbnB1dC53ZWJ2aWV3Lm9uRGlkRGlzcG9zZSgoKSA9PiB7XG5cdFx0XHRcdFx0ZGlzcG9zZVN1Yi5kaXNwb3NlKCk7XG5cblx0XHRcdFx0XHQvLyBJZiB0aGUgbW9kZWwgaXMgc3RpbGwgZGlydHksIG1ha2Ugc3VyZSB3ZSBoYXZlIHRpbWUgdG8gc2F2ZSBpdFxuXHRcdFx0XHRcdGlmIChtb2RlbFJlZi5vYmplY3QuaXNEaXJ0eSgpKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBzdWIgPSBtb2RlbFJlZi5vYmplY3Qub25EaWRDaGFuZ2VEaXJ0eSgoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGlmICghbW9kZWxSZWYub2JqZWN0LmlzRGlydHkoKSkge1xuXHRcdFx0XHRcdFx0XHRcdHN1Yi5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHRcdFx0bW9kZWxSZWYuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRtb2RlbFJlZi5kaXNwb3NlKCk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGlmIChjYXBhYmlsaXRpZXMuc3VwcG9ydHNNb3ZlKSB7XG5cdFx0XHRcdFx0d2Vidmlld0lucHV0Lm9uTW92ZShhc3luYyAobmV3UmVzb3VyY2U6IFVSSSkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3Qgb2xkTW9kZWwgPSBtb2RlbFJlZjtcblx0XHRcdFx0XHRcdG1vZGVsUmVmID0gYXdhaXQgdGhpcy5nZXRPckNyZWF0ZUN1c3RvbUVkaXRvck1vZGVsKG1vZGVsVHlwZSwgbmV3UmVzb3VyY2UsIHZpZXdUeXBlLCB7fSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRcdFx0XHR0aGlzLl9wcm94eUN1c3RvbUVkaXRvcnMuJG9uTW92ZUN1c3RvbUVkaXRvcihoYW5kbGUsIG5ld1Jlc291cmNlLCB2aWV3VHlwZSk7XG5cdFx0XHRcdFx0XHRvbGRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuX3Byb3h5Q3VzdG9tRWRpdG9ycy4kcmVzb2x2ZUN1c3RvbUVkaXRvcih0aGlzLl91cmlJZGVudGl0eVNlcnZpY2UuYXNDYW5vbmljYWxVcmkocmVzb3VyY2UpLCBoYW5kbGUsIHZpZXdUeXBlLCB7XG5cdFx0XHRcdFx0XHR0aXRsZTogd2Vidmlld0lucHV0LmdldFRpdGxlKCksXG5cdFx0XHRcdFx0XHRjb250ZW50T3B0aW9uczogd2Vidmlld0lucHV0LndlYnZpZXcuY29udGVudE9wdGlvbnMsXG5cdFx0XHRcdFx0XHRvcHRpb25zOiB3ZWJ2aWV3SW5wdXQud2Vidmlldy5vcHRpb25zLFxuXHRcdFx0XHRcdFx0YWN0aXZlOiB3ZWJ2aWV3SW5wdXQgPT09IHRoaXMuX2VkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yLFxuXHRcdFx0XHRcdH0sIGVkaXRvckdyb3VwVG9Db2x1bW4odGhpcy5fZWRpdG9yR3JvdXBTZXJ2aWNlLCB3ZWJ2aWV3SW5wdXQuZ3JvdXAgfHwgMCksIGNhbmNlbGxhdGlvbik7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZXJyb3IpO1xuXHRcdFx0XHRcdHdlYnZpZXdJbnB1dC53ZWJ2aWV3LnNldEh0bWwodGhpcy5tYWluVGhyZWFkV2Vidmlldy5nZXRXZWJ2aWV3UmVzb2x2ZWRGYWlsZWRDb250ZW50KHZpZXdUeXBlKSk7XG5cdFx0XHRcdFx0bW9kZWxSZWYuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2VkaXRvclByb3ZpZGVycy5zZXQodmlld1R5cGUsIGRpc3Bvc2FibGVzKTtcblx0fVxuXG5cdHB1YmxpYyAkdW5yZWdpc3RlckVkaXRvclByb3ZpZGVyKHZpZXdUeXBlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2VkaXRvclByb3ZpZGVycy5oYXModmlld1R5cGUpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYE5vIHByb3ZpZGVyIGZvciAke3ZpZXdUeXBlfSByZWdpc3RlcmVkYCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fZWRpdG9yUHJvdmlkZXJzLmRlbGV0ZUFuZERpc3Bvc2Uodmlld1R5cGUpO1xuXG5cdFx0dGhpcy5fY3VzdG9tRWRpdG9yU2VydmljZS5tb2RlbHMuZGlzcG9zZUFsbE1vZGVsc0ZvclZpZXcodmlld1R5cGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRPckNyZWF0ZUN1c3RvbUVkaXRvck1vZGVsKFxuXHRcdG1vZGVsVHlwZTogQ3VzdG9tRWRpdG9yTW9kZWxUeXBlLFxuXHRcdHJlc291cmNlOiBVUkksXG5cdFx0dmlld1R5cGU6IHN0cmluZyxcblx0XHRvcHRpb25zOiB7IGJhY2t1cElkPzogc3RyaW5nIH0sXG5cdFx0Y2FuY2VsbGF0aW9uOiBDYW5jZWxsYXRpb25Ub2tlbixcblx0KTogUHJvbWlzZTxJUmVmZXJlbmNlPElDdXN0b21FZGl0b3JNb2RlbD4+IHtcblx0XHRjb25zdCBleGlzdGluZ01vZGVsID0gdGhpcy5fY3VzdG9tRWRpdG9yU2VydmljZS5tb2RlbHMudHJ5UmV0YWluKHJlc291cmNlLCB2aWV3VHlwZSk7XG5cdFx0aWYgKGV4aXN0aW5nTW9kZWwpIHtcblx0XHRcdHJldHVybiBleGlzdGluZ01vZGVsO1xuXHRcdH1cblxuXHRcdHN3aXRjaCAobW9kZWxUeXBlKSB7XG5cdFx0XHRjYXNlIEN1c3RvbUVkaXRvck1vZGVsVHlwZS5UZXh0OlxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Y29uc3QgbW9kZWwgPSBDdXN0b21UZXh0RWRpdG9yTW9kZWwuY3JlYXRlKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLCB2aWV3VHlwZSwgcmVzb3VyY2UpO1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLl9jdXN0b21FZGl0b3JTZXJ2aWNlLm1vZGVscy5hZGQocmVzb3VyY2UsIHZpZXdUeXBlLCBtb2RlbCk7XG5cdFx0XHRcdH1cblx0XHRcdGNhc2UgQ3VzdG9tRWRpdG9yTW9kZWxUeXBlLkN1c3RvbTpcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnN0IG1vZGVsID0gTWFpblRocmVhZEN1c3RvbUVkaXRvck1vZGVsLmNyZWF0ZSh0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZSwgdGhpcy5fcHJveHlDdXN0b21FZGl0b3JzLCB2aWV3VHlwZSwgcmVzb3VyY2UsIG9wdGlvbnMsICgpID0+IHtcblx0XHRcdFx0XHRcdHJldHVybiBBcnJheS5mcm9tKHRoaXMubWFpblRocmVhZFdlYnZpZXdQYW5lbHMud2Vidmlld0lucHV0cylcblx0XHRcdFx0XHRcdFx0LmZpbHRlcihlZGl0b3IgPT4gZWRpdG9yIGluc3RhbmNlb2YgQ3VzdG9tRWRpdG9ySW5wdXQgJiYgaXNFcXVhbChlZGl0b3IucmVzb3VyY2UsIHJlc291cmNlKSkgYXMgQ3VzdG9tRWRpdG9ySW5wdXRbXTtcblx0XHRcdFx0XHR9LCBjYW5jZWxsYXRpb24pO1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLl9jdXN0b21FZGl0b3JTZXJ2aWNlLm1vZGVscy5hZGQocmVzb3VyY2UsIHZpZXdUeXBlLCBtb2RlbCk7XG5cdFx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgJG9uRGlkRWRpdChyZXNvdXJjZUNvbXBvbmVudHM6IFVyaUNvbXBvbmVudHMsIHZpZXdUeXBlOiBzdHJpbmcsIGVkaXRJZDogbnVtYmVyLCBsYWJlbDogc3RyaW5nIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCB0aGlzLmdldEN1c3RvbUVkaXRvck1vZGVsKHJlc291cmNlQ29tcG9uZW50cywgdmlld1R5cGUpO1xuXHRcdG1vZGVsLnB1c2hFZGl0KGVkaXRJZCwgbGFiZWwpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jICRvbkNvbnRlbnRDaGFuZ2UocmVzb3VyY2VDb21wb25lbnRzOiBVcmlDb21wb25lbnRzLCB2aWV3VHlwZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCB0aGlzLmdldEN1c3RvbUVkaXRvck1vZGVsKHJlc291cmNlQ29tcG9uZW50cywgdmlld1R5cGUpO1xuXHRcdG1vZGVsLmNoYW5nZUNvbnRlbnQoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0Q3VzdG9tRWRpdG9yTW9kZWwocmVzb3VyY2VDb21wb25lbnRzOiBVcmlDb21wb25lbnRzLCB2aWV3VHlwZTogc3RyaW5nKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkucmV2aXZlKHJlc291cmNlQ29tcG9uZW50cyk7XG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCB0aGlzLl9jdXN0b21FZGl0b3JTZXJ2aWNlLm1vZGVscy5nZXQocmVzb3VyY2UsIHZpZXdUeXBlKTtcblx0XHRpZiAoIW1vZGVsIHx8ICEobW9kZWwgaW5zdGFuY2VvZiBNYWluVGhyZWFkQ3VzdG9tRWRpdG9yTW9kZWwpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIG1vZGVsIGZvciB3ZWJ2aWV3IGVkaXRvcicpO1xuXHRcdH1cblx0XHRyZXR1cm4gbW9kZWw7XG5cdH1cblxuXHQvLyNyZWdpb24gV29ya2luZyBDb3B5XG5cdHByaXZhdGUgYXN5bmMgb25XaWxsUnVuV29ya2luZ0NvcHlGaWxlT3BlcmF0aW9uKGU6IFdvcmtpbmdDb3B5RmlsZUV2ZW50KSB7XG5cdFx0aWYgKGUub3BlcmF0aW9uICE9PSBGaWxlT3BlcmF0aW9uLk1PVkUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0ZS53YWl0VW50aWwoKGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVscyA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBmaWxlIG9mIGUuZmlsZXMpIHtcblx0XHRcdFx0aWYgKGZpbGUuc291cmNlKSB7XG5cdFx0XHRcdFx0bW9kZWxzLnB1c2goLi4uKGF3YWl0IHRoaXMuX2N1c3RvbUVkaXRvclNlcnZpY2UubW9kZWxzLmdldEFsbE1vZGVscyhmaWxlLnNvdXJjZSkpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Zm9yIChjb25zdCBtb2RlbCBvZiBtb2RlbHMpIHtcblx0XHRcdFx0aWYgKG1vZGVsIGluc3RhbmNlb2YgTWFpblRocmVhZEN1c3RvbUVkaXRvck1vZGVsICYmIG1vZGVsLmlzRGlydHkoKSkge1xuXHRcdFx0XHRcdGNvbnN0IHdvcmtpbmdDb3B5ID0gYXdhaXQgbW9kZWwuYmFja3VwKENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0XHRcdGlmICh3b3JraW5nQ29weS5tZXRhKSB7XG5cdFx0XHRcdFx0XHQvLyBUaGlzIGNhc3QgaXMgc2FmZSBiZWNhdXNlIHdlIGRvIGFuIGluc3RhbmNlb2YgY2hlY2sgYWJvdmUgYW5kIGEgY3VzdG9tIGRvY3VtZW50IGJhY2t1cCBkYXRhIGlzIGFsd2F5cyByZXR1cm5lZFxuXHRcdFx0XHRcdFx0dGhpcy5fZWRpdG9yUmVuYW1lQmFja3Vwcy5zZXQobW9kZWwuZWRpdG9yUmVzb3VyY2UudG9TdHJpbmcoKSwgd29ya2luZ0NvcHkubWV0YSBhcyBDdXN0b21Eb2N1bWVudEJhY2t1cERhdGEpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKCkpO1xuXHR9XG5cdC8vI2VuZHJlZ2lvblxufVxuXG5uYW1lc3BhY2UgSG90RXhpdFN0YXRlIHtcblx0ZXhwb3J0IGNvbnN0IGVudW0gVHlwZSB7XG5cdFx0QWxsb3dlZCxcblx0XHROb3RBbGxvd2VkLFxuXHRcdFBlbmRpbmcsXG5cdH1cblxuXHRleHBvcnQgY29uc3QgQWxsb3dlZCA9IE9iamVjdC5mcmVlemUoeyB0eXBlOiBUeXBlLkFsbG93ZWQgfSBhcyBjb25zdCk7XG5cdGV4cG9ydCBjb25zdCBOb3RBbGxvd2VkID0gT2JqZWN0LmZyZWV6ZSh7IHR5cGU6IFR5cGUuTm90QWxsb3dlZCB9IGFzIGNvbnN0KTtcblxuXHRleHBvcnQgY2xhc3MgUGVuZGluZyB7XG5cdFx0cmVhZG9ubHkgdHlwZSA9IFR5cGUuUGVuZGluZztcblxuXHRcdGNvbnN0cnVjdG9yKFxuXHRcdFx0cHVibGljIHJlYWRvbmx5IG9wZXJhdGlvbjogQ2FuY2VsYWJsZVByb21pc2U8c3RyaW5nPixcblx0XHQpIHsgfVxuXHR9XG5cblx0ZXhwb3J0IHR5cGUgU3RhdGUgPSB0eXBlb2YgQWxsb3dlZCB8IHR5cGVvZiBOb3RBbGxvd2VkIHwgUGVuZGluZztcbn1cblxuXG5jbGFzcyBNYWluVGhyZWFkQ3VzdG9tRWRpdG9yTW9kZWwgZXh0ZW5kcyBSZXNvdXJjZVdvcmtpbmdDb3B5IGltcGxlbWVudHMgSUN1c3RvbUVkaXRvck1vZGVsIHtcblxuXHRwcml2YXRlIF9mcm9tQmFja3VwOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgX2hvdEV4aXRTdGF0ZTogSG90RXhpdFN0YXRlLlN0YXRlID0gSG90RXhpdFN0YXRlLkFsbG93ZWQ7XG5cdHByaXZhdGUgX2JhY2t1cElkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfY3VycmVudEVkaXRJbmRleDogbnVtYmVyID0gLTE7XG5cdHByaXZhdGUgX3NhdmVQb2ludDogbnVtYmVyID0gLTE7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRzOiBBcnJheTxudW1iZXI+ID0gW107XG5cdHByaXZhdGUgX2lzRGlydHlGcm9tQ29udGVudENoYW5nZSA9IGZhbHNlO1xuXG5cdHByaXZhdGUgX29uZ29pbmdTYXZlPzogQ2FuY2VsYWJsZVByb21pc2U8dm9pZD47XG5cblx0Ly8gVE9ET0BtamJ2eiBjb25zaWRlciB0byBlbmFibGUgYSBgdHlwZUlkYCB0aGF0IGlzIHNwZWNpZmljIGZvciBjdXN0b21cblx0Ly8gZWRpdG9ycy4gVXNpbmcgYSBkaXN0aW5jdCBgdHlwZUlkYCBhbGxvd3MgdGhlIHdvcmtpbmcgY29weSB0byBoYXZlXG5cdC8vIGFueSByZXNvdXJjZSAoaW5jbHVkaW5nIGZpbGUgYmFzZWQgcmVzb3VyY2VzKSBldmVuIGlmIG90aGVyIHdvcmtpbmdcblx0Ly8gY29waWVzIGV4aXN0IHdpdGggdGhlIHNhbWUgcmVzb3VyY2UuXG5cdC8vXG5cdC8vIElNUE9SVEFOVDogY2hhbmdpbmcgdGhlIGB0eXBlSWRgIGhhcyBhbiBpbXBhY3Qgb24gYmFja3VwcyBmb3IgdGhpc1xuXHQvLyB3b3JraW5nIGNvcHkuIEFueSB2YWx1ZSB0aGF0IGlzIG5vdCB0aGUgZW1wdHkgc3RyaW5nIHdpbGwgYmUgdXNlZFxuXHQvLyBhcyBzZWVkIHRvIHRoZSBiYWNrdXAuIE9ubHkgY2hhbmdlIHRoZSBgdHlwZUlkYCBpZiB5b3UgaGF2ZSBpbXBsZW1lbnRlZFxuXHQvLyBhIGZhbGxiYWNrIHNvbHV0aW9uIHRvIHJlc29sdmUgYW55IGV4aXN0aW5nIGJhY2t1cHMgdGhhdCBkbyBub3QgaGF2ZVxuXHQvLyB0aGlzIHNlZWQuXG5cdHJlYWRvbmx5IHR5cGVJZCA9IE5PX1RZUEVfSUQ7XG5cblx0cHVibGljIHN0YXRpYyBhc3luYyBjcmVhdGUoXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRwcm94eTogZXh0SG9zdFByb3RvY29sLkV4dEhvc3RDdXN0b21FZGl0b3JzU2hhcGUsXG5cdFx0dmlld1R5cGU6IHN0cmluZyxcblx0XHRyZXNvdXJjZTogVVJJLFxuXHRcdG9wdGlvbnM6IHsgYmFja3VwSWQ/OiBzdHJpbmcgfSxcblx0XHRnZXRFZGl0b3JzOiAoKSA9PiBDdXN0b21FZGl0b3JJbnB1dFtdLFxuXHRcdGNhbmNlbGxhdGlvbjogQ2FuY2VsbGF0aW9uVG9rZW4sXG5cdCk6IFByb21pc2U8TWFpblRocmVhZEN1c3RvbUVkaXRvck1vZGVsPiB7XG5cdFx0Y29uc3QgZWRpdG9ycyA9IGdldEVkaXRvcnMoKTtcblx0XHRsZXQgdW50aXRsZWREb2N1bWVudERhdGE6IFZTQnVmZmVyIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChlZGl0b3JzLmxlbmd0aCAhPT0gMCkge1xuXHRcdFx0dW50aXRsZWREb2N1bWVudERhdGEgPSBlZGl0b3JzWzBdLnVudGl0bGVkRG9jdW1lbnREYXRhO1xuXHRcdH1cblx0XHRjb25zdCB7IGVkaXRhYmxlIH0gPSBhd2FpdCBwcm94eS4kY3JlYXRlQ3VzdG9tRG9jdW1lbnQocmVzb3VyY2UsIHZpZXdUeXBlLCBvcHRpb25zLmJhY2t1cElkLCB1bnRpdGxlZERvY3VtZW50RGF0YSwgY2FuY2VsbGF0aW9uKTtcblx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWFpblRocmVhZEN1c3RvbUVkaXRvck1vZGVsLCBwcm94eSwgdmlld1R5cGUsIHJlc291cmNlLCAhIW9wdGlvbnMuYmFja3VwSWQsIGVkaXRhYmxlLCAhIXVudGl0bGVkRG9jdW1lbnREYXRhLCBnZXRFZGl0b3JzKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBleHRIb3N0UHJvdG9jb2wuRXh0SG9zdEN1c3RvbUVkaXRvcnNTaGFwZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF92aWV3VHlwZTogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvclJlc291cmNlOiBVUkksXG5cdFx0ZnJvbUJhY2t1cDogYm9vbGVhbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0YWJsZTogYm9vbGVhbixcblx0XHRzdGFydERpcnR5OiBib29sZWFuLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2dldEVkaXRvcnM6ICgpID0+IEN1c3RvbUVkaXRvcklucHV0W10sXG5cdFx0QElGaWxlRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9maWxlRGlhbG9nU2VydmljZTogSUZpbGVEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElVbmRvUmVkb1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdW5kb1NlcnZpY2U6IElVbmRvUmVkb1NlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJV29ya2luZ0NvcHlTZXJ2aWNlIHdvcmtpbmdDb3B5U2VydmljZTogSVdvcmtpbmdDb3B5U2VydmljZSxcblx0XHRASVBhdGhTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3BhdGhTZXJ2aWNlOiBJUGF0aFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihNYWluVGhyZWFkQ3VzdG9tRWRpdG9yTW9kZWwudG9Xb3JraW5nQ29weVJlc291cmNlKF92aWV3VHlwZSwgX2VkaXRvclJlc291cmNlKSwgZmlsZVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fZnJvbUJhY2t1cCA9IGZyb21CYWNrdXA7XG5cblx0XHRpZiAoX2VkaXRhYmxlKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih3b3JraW5nQ29weVNlcnZpY2UucmVnaXN0ZXJXb3JraW5nQ29weSh0aGlzKSk7XG5cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGV4dGVuc2lvblNlcnZpY2Uub25XaWxsU3RvcChlID0+IHtcblx0XHRcdFx0ZS52ZXRvKHRydWUsIGxvY2FsaXplKCd2ZXRvRXh0SG9zdFJlc3RhcnQnLCBcIkFuIGV4dGVuc2lvbiBwcm92aWRlZCBlZGl0b3IgZm9yICd7MH0nIGlzIHN0aWxsIG9wZW4gdGhhdCB3b3VsZCBjbG9zZSBvdGhlcndpc2UuXCIsIHRoaXMubmFtZSkpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdC8vIE5vcm1hbGx5IG1lYW5zIHdlJ3JlIHJlLW9wZW5pbmcgYW4gdW50aXRsZWQgZmlsZVxuXHRcdGlmIChzdGFydERpcnR5KSB7XG5cdFx0XHR0aGlzLl9pc0RpcnR5RnJvbUNvbnRlbnRDaGFuZ2UgPSB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdGdldCBlZGl0b3JSZXNvdXJjZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fZWRpdG9yUmVzb3VyY2U7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdGlmICh0aGlzLl9lZGl0YWJsZSkge1xuXHRcdFx0dGhpcy5fdW5kb1NlcnZpY2UucmVtb3ZlRWxlbWVudHModGhpcy5fZWRpdG9yUmVzb3VyY2UpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3Byb3h5LiRkaXNwb3NlQ3VzdG9tRG9jdW1lbnQodGhpcy5fZWRpdG9yUmVzb3VyY2UsIHRoaXMuX3ZpZXdUeXBlKTtcblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdC8vI3JlZ2lvbiBJV29ya2luZ0NvcHlcblxuXHQvLyBNYWtlIHN1cmUgZWFjaCBjdXN0b20gZWRpdG9yIGhhcyBhIHVuaXF1ZSByZXNvdXJjZSBmb3IgYmFja3VwIGFuZCBlZGl0c1xuXHRwcml2YXRlIHN0YXRpYyB0b1dvcmtpbmdDb3B5UmVzb3VyY2Uodmlld1R5cGU6IHN0cmluZywgcmVzb3VyY2U6IFVSSSkge1xuXHRcdGNvbnN0IGF1dGhvcml0eSA9IHZpZXdUeXBlLnJlcGxhY2UoL1teYS16MC05XFwtX10vZ2ksICctJyk7XG5cdFx0Y29uc3QgcGF0aCA9IGAvJHttdWx0aWJ5dGVBd2FyZUJ0b2EocmVzb3VyY2Uud2l0aCh7IHF1ZXJ5OiBudWxsLCBmcmFnbWVudDogbnVsbCB9KS50b1N0cmluZyh0cnVlKSl9YDtcblx0XHRyZXR1cm4gVVJJLmZyb20oe1xuXHRcdFx0c2NoZW1lOiBTY2hlbWFzLnZzY29kZUN1c3RvbUVkaXRvcixcblx0XHRcdGF1dGhvcml0eTogYXV0aG9yaXR5LFxuXHRcdFx0cGF0aDogcGF0aCxcblx0XHRcdHF1ZXJ5OiBKU09OLnN0cmluZ2lmeShyZXNvdXJjZS50b0pTT04oKSksXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IG5hbWUoKSB7XG5cdFx0cmV0dXJuIGJhc2VuYW1lKHRoaXMuX2xhYmVsU2VydmljZS5nZXRVcmlMYWJlbCh0aGlzLl9lZGl0b3JSZXNvdXJjZSkpO1xuXHR9XG5cblx0cHVibGljIGdldCBjYXBhYmlsaXRpZXMoKTogV29ya2luZ0NvcHlDYXBhYmlsaXRpZXMge1xuXHRcdHJldHVybiB0aGlzLmlzVW50aXRsZWQoKSA/IFdvcmtpbmdDb3B5Q2FwYWJpbGl0aWVzLlVudGl0bGVkIDogV29ya2luZ0NvcHlDYXBhYmlsaXRpZXMuTm9uZTtcblx0fVxuXG5cdHB1YmxpYyBpc0RpcnR5KCk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLl9pc0RpcnR5RnJvbUNvbnRlbnRDaGFuZ2UpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fZWRpdHMubGVuZ3RoID4gMCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3NhdmVQb2ludCAhPT0gdGhpcy5fY3VycmVudEVkaXRJbmRleDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2Zyb21CYWNrdXA7XG5cdH1cblxuXHRwcml2YXRlIGlzVW50aXRsZWQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2VkaXRvclJlc291cmNlLnNjaGVtZSA9PT0gU2NoZW1hcy51bnRpdGxlZDtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlRGlydHk6IEVtaXR0ZXI8dm9pZD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VEaXJ0eTogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZURpcnR5LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQ29udGVudDogRW1pdHRlcjx2b2lkPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUNvbnRlbnQ6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VDb250ZW50LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkU2F2ZTogRW1pdHRlcjxJV29ya2luZ0NvcHlTYXZlRXZlbnQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVdvcmtpbmdDb3B5U2F2ZUV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25EaWRTYXZlOiBFdmVudDxJV29ya2luZ0NvcHlTYXZlRXZlbnQ+ID0gdGhpcy5fb25EaWRTYXZlLmV2ZW50O1xuXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlUmVhZG9ubHkgPSBFdmVudC5Ob25lO1xuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdHB1YmxpYyBpc1JlYWRvbmx5KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhdGhpcy5fZWRpdGFibGU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHZpZXdUeXBlKCkge1xuXHRcdHJldHVybiB0aGlzLl92aWV3VHlwZTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgYmFja3VwSWQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2JhY2t1cElkO1xuXHR9XG5cblx0cHVibGljIHB1c2hFZGl0KGVkaXRJZDogbnVtYmVyLCBsYWJlbDogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKCF0aGlzLl9lZGl0YWJsZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdEb2N1bWVudCBpcyBub3QgZWRpdGFibGUnKTtcblx0XHR9XG5cblx0XHR0aGlzLmNoYW5nZSgoKSA9PiB7XG5cdFx0XHR0aGlzLnNwbGljZUVkaXRzKGVkaXRJZCk7XG5cdFx0XHR0aGlzLl9jdXJyZW50RWRpdEluZGV4ID0gdGhpcy5fZWRpdHMubGVuZ3RoIC0gMTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX3VuZG9TZXJ2aWNlLnB1c2hFbGVtZW50KHtcblx0XHRcdHR5cGU6IFVuZG9SZWRvRWxlbWVudFR5cGUuUmVzb3VyY2UsXG5cdFx0XHRyZXNvdXJjZTogdGhpcy5fZWRpdG9yUmVzb3VyY2UsXG5cdFx0XHRsYWJlbDogbGFiZWwgPz8gbG9jYWxpemUoJ2RlZmF1bHRFZGl0TGFiZWwnLCBcIkVkaXRcIiksXG5cdFx0XHRjb2RlOiAndW5kb3JlZG8uY3VzdG9tRWRpdG9yRWRpdCcsXG5cdFx0XHR1bmRvOiAoKSA9PiB0aGlzLnVuZG8oKSxcblx0XHRcdHJlZG86ICgpID0+IHRoaXMucmVkbygpLFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGNoYW5nZUNvbnRlbnQoKSB7XG5cdFx0dGhpcy5jaGFuZ2UoKCkgPT4ge1xuXHRcdFx0dGhpcy5faXNEaXJ0eUZyb21Db250ZW50Q2hhbmdlID0gdHJ1ZTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdW5kbygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuX2VkaXRhYmxlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2N1cnJlbnRFZGl0SW5kZXggPCAwKSB7XG5cdFx0XHQvLyBub3RoaW5nIHRvIHVuZG9cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB1bmRvbmVFZGl0ID0gdGhpcy5fZWRpdHNbdGhpcy5fY3VycmVudEVkaXRJbmRleF07XG5cdFx0dGhpcy5jaGFuZ2UoKCkgPT4ge1xuXHRcdFx0LS10aGlzLl9jdXJyZW50RWRpdEluZGV4O1xuXHRcdH0pO1xuXHRcdGF3YWl0IHRoaXMuX3Byb3h5LiR1bmRvKHRoaXMuX2VkaXRvclJlc291cmNlLCB0aGlzLnZpZXdUeXBlLCB1bmRvbmVFZGl0LCB0aGlzLmlzRGlydHkoKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlZG8oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLl9lZGl0YWJsZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9jdXJyZW50RWRpdEluZGV4ID49IHRoaXMuX2VkaXRzLmxlbmd0aCAtIDEpIHtcblx0XHRcdC8vIG5vdGhpbmcgdG8gcmVkb1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlZG9uZUVkaXQgPSB0aGlzLl9lZGl0c1t0aGlzLl9jdXJyZW50RWRpdEluZGV4ICsgMV07XG5cdFx0dGhpcy5jaGFuZ2UoKCkgPT4ge1xuXHRcdFx0Kyt0aGlzLl9jdXJyZW50RWRpdEluZGV4O1xuXHRcdH0pO1xuXHRcdGF3YWl0IHRoaXMuX3Byb3h5LiRyZWRvKHRoaXMuX2VkaXRvclJlc291cmNlLCB0aGlzLnZpZXdUeXBlLCByZWRvbmVFZGl0LCB0aGlzLmlzRGlydHkoKSk7XG5cdH1cblxuXHRwcml2YXRlIHNwbGljZUVkaXRzKGVkaXRUb0luc2VydD86IG51bWJlcikge1xuXHRcdGNvbnN0IHN0YXJ0ID0gdGhpcy5fY3VycmVudEVkaXRJbmRleCArIDE7XG5cdFx0Y29uc3QgdG9SZW1vdmUgPSB0aGlzLl9lZGl0cy5sZW5ndGggLSB0aGlzLl9jdXJyZW50RWRpdEluZGV4O1xuXG5cdFx0Y29uc3QgcmVtb3ZlZEVkaXRzID0gdHlwZW9mIGVkaXRUb0luc2VydCA9PT0gJ251bWJlcidcblx0XHRcdD8gdGhpcy5fZWRpdHMuc3BsaWNlKHN0YXJ0LCB0b1JlbW92ZSwgZWRpdFRvSW5zZXJ0KVxuXHRcdFx0OiB0aGlzLl9lZGl0cy5zcGxpY2Uoc3RhcnQsIHRvUmVtb3ZlKTtcblxuXHRcdGlmIChyZW1vdmVkRWRpdHMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLl9wcm94eS4kZGlzcG9zZUVkaXRzKHRoaXMuX2VkaXRvclJlc291cmNlLCB0aGlzLl92aWV3VHlwZSwgcmVtb3ZlZEVkaXRzKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNoYW5nZShtYWtlRWRpdDogKCkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGNvbnN0IHdhc0RpcnR5ID0gdGhpcy5pc0RpcnR5KCk7XG5cdFx0bWFrZUVkaXQoKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbnRlbnQuZmlyZSgpO1xuXG5cdFx0aWYgKHRoaXMuaXNEaXJ0eSgpICE9PSB3YXNEaXJ0eSkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VEaXJ0eS5maXJlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGFzeW5jIHJldmVydChvcHRpb25zPzogSVJldmVydE9wdGlvbnMpIHtcblx0XHRpZiAoIXRoaXMuX2VkaXRhYmxlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2N1cnJlbnRFZGl0SW5kZXggPT09IHRoaXMuX3NhdmVQb2ludCAmJiAhdGhpcy5faXNEaXJ0eUZyb21Db250ZW50Q2hhbmdlICYmICF0aGlzLl9mcm9tQmFja3VwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCFvcHRpb25zPy5zb2Z0KSB7XG5cdFx0XHR0aGlzLl9wcm94eS4kcmV2ZXJ0KHRoaXMuX2VkaXRvclJlc291cmNlLCB0aGlzLnZpZXdUeXBlLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHR9XG5cblx0XHR0aGlzLmNoYW5nZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9pc0RpcnR5RnJvbUNvbnRlbnRDaGFuZ2UgPSBmYWxzZTtcblx0XHRcdHRoaXMuX2Zyb21CYWNrdXAgPSBmYWxzZTtcblx0XHRcdHRoaXMuX2N1cnJlbnRFZGl0SW5kZXggPSB0aGlzLl9zYXZlUG9pbnQ7XG5cdFx0XHR0aGlzLnNwbGljZUVkaXRzKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgc2F2ZShvcHRpb25zPzogSVNhdmVPcHRpb25zKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gISFhd2FpdCB0aGlzLnNhdmVDdXN0b21FZGl0b3Iob3B0aW9ucyk7XG5cblx0XHQvLyBFbWl0IFNhdmUgRXZlbnRcblx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHR0aGlzLl9vbkRpZFNhdmUuZmlyZSh7IHJlYXNvbjogb3B0aW9ucz8ucmVhc29uLCBzb3VyY2U6IG9wdGlvbnM/LnNvdXJjZSB9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHNhdmVDdXN0b21FZGl0b3Iob3B0aW9ucz86IElTYXZlT3B0aW9ucyk6IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCF0aGlzLl9lZGl0YWJsZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5pc1VudGl0bGVkKCkpIHtcblx0XHRcdGNvbnN0IHRhcmdldFVyaSA9IGF3YWl0IHRoaXMuc3VnZ2VzdFVudGl0bGVkU2F2ZVBhdGgob3B0aW9ucyk7XG5cdFx0XHRpZiAoIXRhcmdldFVyaSkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHRhd2FpdCB0aGlzLnNhdmVDdXN0b21FZGl0b3JBcyh0aGlzLl9lZGl0b3JSZXNvdXJjZSwgdGFyZ2V0VXJpLCBvcHRpb25zKTtcblx0XHRcdHJldHVybiB0YXJnZXRVcmk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2F2ZVByb21pc2UgPSBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSh0b2tlbiA9PiB0aGlzLl9wcm94eS4kb25TYXZlKHRoaXMuX2VkaXRvclJlc291cmNlLCB0aGlzLnZpZXdUeXBlLCB0b2tlbikpO1xuXHRcdHRoaXMuX29uZ29pbmdTYXZlPy5jYW5jZWwoKTtcblx0XHR0aGlzLl9vbmdvaW5nU2F2ZSA9IHNhdmVQcm9taXNlO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHNhdmVQcm9taXNlO1xuXG5cdFx0XHRpZiAodGhpcy5fb25nb2luZ1NhdmUgPT09IHNhdmVQcm9taXNlKSB7IC8vIE1ha2Ugc3VyZSB3ZSBhcmUgc3RpbGwgZG9pbmcgdGhlIHNhbWUgc2F2ZVxuXHRcdFx0XHR0aGlzLmNoYW5nZSgoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5faXNEaXJ0eUZyb21Db250ZW50Q2hhbmdlID0gZmFsc2U7XG5cdFx0XHRcdFx0dGhpcy5fc2F2ZVBvaW50ID0gdGhpcy5fY3VycmVudEVkaXRJbmRleDtcblx0XHRcdFx0XHR0aGlzLl9mcm9tQmFja3VwID0gZmFsc2U7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRpZiAodGhpcy5fb25nb2luZ1NhdmUgPT09IHNhdmVQcm9taXNlKSB7IC8vIE1ha2Ugc3VyZSB3ZSBhcmUgc3RpbGwgZG9pbmcgdGhlIHNhbWUgc2F2ZVxuXHRcdFx0XHR0aGlzLl9vbmdvaW5nU2F2ZSA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fZWRpdG9yUmVzb3VyY2U7XG5cdH1cblxuXHRwcml2YXRlIHN1Z2dlc3RVbnRpdGxlZFNhdmVQYXRoKG9wdGlvbnM6IElTYXZlT3B0aW9ucyB8IHVuZGVmaW5lZCk6IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCF0aGlzLmlzVW50aXRsZWQoKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdSZXNvdXJjZSBpcyBub3QgdW50aXRsZWQnKTtcblx0XHR9XG5cblx0XHRjb25zdCByZW1vdGVBdXRob3JpdHkgPSB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5O1xuXHRcdGNvbnN0IGxvY2FsUmVzb3VyY2UgPSB0b0xvY2FsUmVzb3VyY2UodGhpcy5fZWRpdG9yUmVzb3VyY2UsIHJlbW90ZUF1dGhvcml0eSwgdGhpcy5fcGF0aFNlcnZpY2UuZGVmYXVsdFVyaVNjaGVtZSk7XG5cblx0XHRyZXR1cm4gdGhpcy5fZmlsZURpYWxvZ1NlcnZpY2UucGlja0ZpbGVUb1NhdmUobG9jYWxSZXNvdXJjZSwgb3B0aW9ucz8uYXZhaWxhYmxlRmlsZVN5c3RlbXMpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHNhdmVDdXN0b21FZGl0b3JBcyhyZXNvdXJjZTogVVJJLCB0YXJnZXRSZXNvdXJjZTogVVJJLCBfb3B0aW9ucz86IElTYXZlT3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGlmICh0aGlzLl9lZGl0YWJsZSkge1xuXHRcdFx0Ly8gVE9ETzogaGFuZGxlIGNhbmNlbGxhdGlvblxuXHRcdFx0YXdhaXQgY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UodG9rZW4gPT4gdGhpcy5fcHJveHkuJG9uU2F2ZUFzKHRoaXMuX2VkaXRvclJlc291cmNlLCB0aGlzLnZpZXdUeXBlLCB0YXJnZXRSZXNvdXJjZSwgdG9rZW4pKTtcblx0XHRcdHRoaXMuY2hhbmdlKCgpID0+IHtcblx0XHRcdFx0dGhpcy5fc2F2ZVBvaW50ID0gdGhpcy5fY3VycmVudEVkaXRJbmRleDtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIFNpbmNlIHRoZSBlZGl0b3IgaXMgcmVhZG9ubHksIGp1c3QgY29weSB0aGUgZmlsZSBvdmVyXG5cdFx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmNvcHkocmVzb3VyY2UsIHRhcmdldFJlc291cmNlLCBmYWxzZSAvKiBvdmVyd3JpdGUgKi8pO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGdldCBjYW5Ib3RFeGl0KCkgeyByZXR1cm4gdHlwZW9mIHRoaXMuX2JhY2t1cElkID09PSAnc3RyaW5nJyAmJiB0aGlzLl9ob3RFeGl0U3RhdGUudHlwZSA9PT0gSG90RXhpdFN0YXRlLlR5cGUuQWxsb3dlZDsgfVxuXG5cdHB1YmxpYyBhc3luYyBiYWNrdXAodG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJV29ya2luZ0NvcHlCYWNrdXA+IHtcblx0XHRjb25zdCBlZGl0b3JzID0gdGhpcy5fZ2V0RWRpdG9ycygpO1xuXHRcdGlmICghZWRpdG9ycy5sZW5ndGgpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTm8gZWRpdG9ycyBmb3VuZCBmb3IgcmVzb3VyY2UsIGNhbm5vdCBiYWNrIHVwJyk7XG5cdFx0fVxuXHRcdGNvbnN0IHByaW1hcnlFZGl0b3IgPSBlZGl0b3JzWzBdO1xuXG5cdFx0Y29uc3QgYmFja3VwTWV0YTogQ3VzdG9tRG9jdW1lbnRCYWNrdXBEYXRhID0ge1xuXHRcdFx0dmlld1R5cGU6IHRoaXMudmlld1R5cGUsXG5cdFx0XHRlZGl0b3JSZXNvdXJjZTogdGhpcy5fZWRpdG9yUmVzb3VyY2UsXG5cdFx0XHRiYWNrdXBJZDogJycsXG5cdFx0XHRleHRlbnNpb246IHByaW1hcnlFZGl0b3IuZXh0ZW5zaW9uID8ge1xuXHRcdFx0XHRpZDogcHJpbWFyeUVkaXRvci5leHRlbnNpb24uaWQudmFsdWUsXG5cdFx0XHRcdGxvY2F0aW9uOiBwcmltYXJ5RWRpdG9yLmV4dGVuc2lvbi5sb2NhdGlvbiEsXG5cdFx0XHR9IDogdW5kZWZpbmVkLFxuXHRcdFx0d2Vidmlldzoge1xuXHRcdFx0XHRvcmlnaW46IHByaW1hcnlFZGl0b3Iud2Vidmlldy5vcmlnaW4sXG5cdFx0XHRcdG9wdGlvbnM6IHByaW1hcnlFZGl0b3Iud2Vidmlldy5vcHRpb25zLFxuXHRcdFx0XHRzdGF0ZTogcHJpbWFyeUVkaXRvci53ZWJ2aWV3LnN0YXRlLFxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBiYWNrdXBEYXRhOiBJV29ya2luZ0NvcHlCYWNrdXAgPSB7XG5cdFx0XHRtZXRhOiBiYWNrdXBNZXRhXG5cdFx0fTtcblxuXHRcdGlmICghdGhpcy5fZWRpdGFibGUpIHtcblx0XHRcdHJldHVybiBiYWNrdXBEYXRhO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9ob3RFeGl0U3RhdGUudHlwZSA9PT0gSG90RXhpdFN0YXRlLlR5cGUuUGVuZGluZykge1xuXHRcdFx0dGhpcy5faG90RXhpdFN0YXRlLm9wZXJhdGlvbi5jYW5jZWwoKTtcblx0XHR9XG5cblx0XHRjb25zdCBwZW5kaW5nU3RhdGUgPSBuZXcgSG90RXhpdFN0YXRlLlBlbmRpbmcoXG5cdFx0XHRjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSh0b2tlbiA9PlxuXHRcdFx0XHR0aGlzLl9wcm94eS4kYmFja3VwKHRoaXMuX2VkaXRvclJlc291cmNlLnRvSlNPTigpLCB0aGlzLnZpZXdUeXBlLCB0b2tlbikpKTtcblx0XHR0aGlzLl9ob3RFeGl0U3RhdGUgPSBwZW5kaW5nU3RhdGU7XG5cblx0XHR0b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiB7XG5cdFx0XHRwZW5kaW5nU3RhdGUub3BlcmF0aW9uLmNhbmNlbCgpO1xuXHRcdH0pO1xuXG5cdFx0bGV0IGVycm9yTWVzc2FnZSA9ICcnO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBiYWNrdXBJZCA9IGF3YWl0IHBlbmRpbmdTdGF0ZS5vcGVyYXRpb247XG5cdFx0XHQvLyBNYWtlIHN1cmUgc3RhdGUgaGFzIG5vdCBjaGFuZ2VkIGluIHRoZSBtZWFudGltZVxuXHRcdFx0aWYgKHRoaXMuX2hvdEV4aXRTdGF0ZSA9PT0gcGVuZGluZ1N0YXRlKSB7XG5cdFx0XHRcdHRoaXMuX2hvdEV4aXRTdGF0ZSA9IEhvdEV4aXRTdGF0ZS5BbGxvd2VkO1xuXHRcdFx0XHRiYWNrdXBEYXRhLm1ldGEhLmJhY2t1cElkID0gYmFja3VwSWQ7XG5cdFx0XHRcdHRoaXMuX2JhY2t1cElkID0gYmFja3VwSWQ7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0aWYgKGlzQ2FuY2VsbGF0aW9uRXJyb3IoZSkpIHtcblx0XHRcdFx0Ly8gVGhpcyBpcyBleHBlY3RlZFxuXHRcdFx0XHR0aHJvdyBlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBPdGhlcndpc2UgaXQgY291bGQgYmUgYSByZWFsIGVycm9yLiBNYWtlIHN1cmUgc3RhdGUgaGFzIG5vdCBjaGFuZ2VkIGluIHRoZSBtZWFudGltZS5cblx0XHRcdGlmICh0aGlzLl9ob3RFeGl0U3RhdGUgPT09IHBlbmRpbmdTdGF0ZSkge1xuXHRcdFx0XHR0aGlzLl9ob3RFeGl0U3RhdGUgPSBIb3RFeGl0U3RhdGUuTm90QWxsb3dlZDtcblx0XHRcdH1cblx0XHRcdGlmIChlLm1lc3NhZ2UpIHtcblx0XHRcdFx0ZXJyb3JNZXNzYWdlID0gZS5tZXNzYWdlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9ob3RFeGl0U3RhdGUgPT09IEhvdEV4aXRTdGF0ZS5BbGxvd2VkKSB7XG5cdFx0XHRyZXR1cm4gYmFja3VwRGF0YTtcblx0XHR9XG5cblx0XHR0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBiYWNrdXAgaW4gdGhpcyBzdGF0ZTogJHtlcnJvck1lc3NhZ2V9YCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUywwQkFBMEI7QUFDbkMsU0FBNEIsK0JBQStCO0FBRTNELFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMscUJBQXFCLHlCQUF5QjtBQUN2RCxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLFlBQVksZUFBZSx1QkFBbUM7QUFDdkUs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VUFBVSxjQUFjLFVBQVU7QUFBQSxNQUNuQyxJQUFJO0FBQUEsTUFDSixTQUFTO0FBQUEsUUFDUixRQUFRLGNBQWMsUUFBUTtBQUFBLFFBQzlCLFNBQVMsY0FBYyxRQUFRO0FBQUEsUUFDL0IsT0FBTyxjQUFjLFFBQVE7QUFBQSxNQUM5QjtBQUFBLElBQ0Q7QUFFQSxVQUFNLGFBQWlDO0FBQUEsTUFDdEMsTUFBTTtBQUFBLElBQ1A7QUFFQSxRQUFJLENBQUMsS0FBSyxXQUFXO0FBQ3BCLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxLQUFLLGNBQWMsU0FBUyxpQkFBMkI7QUFDMUQsV0FBSyxjQUFjLFVBQVUsT0FBTztBQUFBLElBQ3JDO0FBRUEsVUFBTSxlQUFlLElBQUksYUFBYTtBQUFBLE1BQ3JDLHdCQUF3QixDQUFBRSxXQUN2QixLQUFLLE9BQU8sUUFBUSxLQUFLLGdCQUFnQixPQUFPLEdBQUcsS0FBSyxVQUFVQSxNQUFLLENBQUM7QUFBQSxJQUFDO0FBQzNFLFNBQUssZ0JBQWdCO0FBRXJCLFVBQU0sd0JBQXdCLE1BQU07QUFDbkMsbUJBQWEsVUFBVSxPQUFPO0FBQUEsSUFDL0IsQ0FBQztBQUVELFFBQUksZUFBZTtBQUNuQixRQUFJO0FBQ0gsWUFBTSxXQUFXLE1BQU0sYUFBYTtBQUVwQyxVQUFJLEtBQUssa0JBQWtCLGNBQWM7QUFDeEMsYUFBSyxnQkFBZ0IsYUFBYTtBQUNsQyxtQkFBVyxLQUFNLFdBQVc7QUFDNUIsYUFBSyxZQUFZO0FBQUEsTUFDbEI7QUFBQSxJQUNELFNBQVMsR0FBRztBQUNYLFVBQUksb0JBQW9CLENBQUMsR0FBRztBQUUzQixjQUFNO0FBQUEsTUFDUDtBQUdBLFVBQUksS0FBSyxrQkFBa0IsY0FBYztBQUN4QyxhQUFLLGdCQUFnQixhQUFhO0FBQUEsTUFDbkM7QUFDQSxVQUFJLEVBQUUsU0FBUztBQUNkLHVCQUFlLEVBQUU7QUFBQSxNQUNsQjtBQUFBLElBQ0Q7QUFFQSxRQUFJLEtBQUssa0JBQWtCLGFBQWEsU0FBUztBQUNoRCxhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0sSUFBSSxNQUFNLGdDQUFnQyxZQUFZLEVBQUU7QUFBQSxFQUMvRDtBQUNEO0FBdlpNLDhCQUFOO0FBQUEsRUFtREc7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0ExREc7IiwKICAibmFtZXMiOiBbIkN1c3RvbUVkaXRvck1vZGVsVHlwZSIsICJIb3RFeGl0U3RhdGUiLCAiVHlwZSIsICJ0b2tlbiJdCn0K
