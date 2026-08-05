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
import { localize } from "../../../../../nls.js";
import { toErrorMessage } from "../../../../../base/common/errorMessage.js";
import { basename, isEqual } from "../../../../../base/common/resources.js";
import { Action } from "../../../../../base/common/actions.js";
import { URI } from "../../../../../base/common/uri.js";
import { FileOperationResult } from "../../../../../platform/files/common/files.js";
import { ITextFileService } from "../../../../services/textfile/common/textfiles.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { dispose, Disposable } from "../../../../../base/common/lifecycle.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { ResourceMap } from "../../../../../base/common/map.js";
import { DiffEditorInput } from "../../../../common/editor/diffEditorInput.js";
import { IContextKeyService, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { TextFileContentProvider } from "../../common/files.js";
import { FileEditorInput } from "./fileEditorInput.js";
import { SAVE_FILE_AS_LABEL } from "../fileConstants.js";
import { INotificationService, Severity } from "../../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { Event } from "../../../../../base/common/event.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { isWindows } from "../../../../../base/common/platform.js";
import { Schemas } from "../../../../../base/common/network.js";
import { IPreferencesService } from "../../../../services/preferences/common/preferences.js";
import { SaveReason, SideBySideEditor } from "../../../../common/editor.js";
import { hash } from "../../../../../base/common/hash.js";
const CONFLICT_RESOLUTION_CONTEXT = "saveConflictResolutionContext";
const CONFLICT_RESOLUTION_SCHEME = "conflictResolution";
const LEARN_MORE_DIRTY_WRITE_IGNORE_KEY = "learnMoreDirtyWriteError";
const conflictEditorHelp = localize("userGuide", "Use the actions in the editor tool bar to either undo your changes or overwrite the content of the file with your changes.");
let TextFileSaveErrorHandler = class extends Disposable {
  constructor(notificationService, textFileService, contextKeyService, editorService, textModelService, instantiationService, storageService) {
    super();
    this.notificationService = notificationService;
    this.textFileService = textFileService;
    this.editorService = editorService;
    this.instantiationService = instantiationService;
    this.storageService = storageService;
    this.messages = new ResourceMap();
    this.activeConflictResolutionResource = void 0;
    this.conflictResolutionContext = new RawContextKey(CONFLICT_RESOLUTION_CONTEXT, false, true).bindTo(contextKeyService);
    const provider = this._register(instantiationService.createInstance(TextFileContentProvider));
    this._register(textModelService.registerTextModelContentProvider(CONFLICT_RESOLUTION_SCHEME, provider));
    this.textFileService.files.saveErrorHandler = this;
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.textFileService.files.onDidSave((e) => this.onFileSavedOrReverted(e.model.resource)));
    this._register(this.textFileService.files.onDidRevert((model) => this.onFileSavedOrReverted(model.resource)));
    this._register(this.editorService.onDidActiveEditorChange(() => this.onActiveEditorChanged()));
  }
  onActiveEditorChanged() {
    let isActiveEditorSaveConflictResolution = false;
    let activeConflictResolutionResource;
    const activeInput = this.editorService.activeEditor;
    if (activeInput instanceof DiffEditorInput) {
      const resource = activeInput.original.resource;
      if (resource?.scheme === CONFLICT_RESOLUTION_SCHEME) {
        isActiveEditorSaveConflictResolution = true;
        activeConflictResolutionResource = activeInput.modified.resource;
      }
    }
    this.conflictResolutionContext.set(isActiveEditorSaveConflictResolution);
    this.activeConflictResolutionResource = activeConflictResolutionResource;
  }
  onFileSavedOrReverted(resource) {
    const messageHandle = this.messages.get(resource);
    if (messageHandle) {
      messageHandle.close();
      this.messages.delete(resource);
    }
  }
  onSaveError(error, model, options) {
    const fileOperationError = error;
    const resource = model.resource;
    let message;
    const primaryActions = [];
    const secondaryActions = [];
    if (fileOperationError.fileOperationResult === FileOperationResult.FILE_MODIFIED_SINCE) {
      if (this.activeConflictResolutionResource && isEqual(this.activeConflictResolutionResource, model.resource)) {
        if (this.storageService.getBoolean(LEARN_MORE_DIRTY_WRITE_IGNORE_KEY, StorageScope.APPLICATION)) {
          return;
        }
        message = conflictEditorHelp;
        primaryActions.push(this.instantiationService.createInstance(ResolveConflictLearnMoreAction));
        secondaryActions.push(this.instantiationService.createInstance(DoNotShowResolveConflictLearnMoreAction));
      } else {
        message = localize("staleSaveError", "Failed to save '{0}': The content of the file is newer. Please compare your version with the file contents or overwrite the content of the file with your changes.", basename(resource));
        primaryActions.push(this.instantiationService.createInstance(ResolveSaveConflictAction, model));
        primaryActions.push(this.instantiationService.createInstance(SaveModelIgnoreModifiedSinceAction, model, options));
        secondaryActions.push(this.instantiationService.createInstance(ConfigureSaveConflictAction));
      }
    } else {
      const isWriteLocked = fileOperationError.fileOperationResult === FileOperationResult.FILE_WRITE_LOCKED;
      const triedToUnlock = isWriteLocked && fileOperationError.options?.unlock;
      const isPermissionDenied = fileOperationError.fileOperationResult === FileOperationResult.FILE_PERMISSION_DENIED;
      const canSaveElevated = resource.scheme === Schemas.file;
      if (canSaveElevated && (isPermissionDenied || triedToUnlock)) {
        primaryActions.push(this.instantiationService.createInstance(SaveModelElevatedAction, model, options, !!triedToUnlock));
      } else if (isWriteLocked) {
        primaryActions.push(this.instantiationService.createInstance(UnlockModelAction, model, options));
      } else {
        primaryActions.push(this.instantiationService.createInstance(RetrySaveModelAction, model, options));
      }
      primaryActions.push(this.instantiationService.createInstance(SaveModelAsAction, model));
      primaryActions.push(this.instantiationService.createInstance(RevertModelAction, model));
      if (isWriteLocked) {
        if (triedToUnlock && canSaveElevated) {
          message = isWindows ? localize("readonlySaveErrorAdmin", "Failed to save '{0}': File is read-only. Select 'Overwrite as Admin' to retry as administrator.", basename(resource)) : localize("readonlySaveErrorSudo", "Failed to save '{0}': File is read-only. Select 'Overwrite as Sudo' to retry as superuser.", basename(resource));
        } else {
          message = localize("readonlySaveError", "Failed to save '{0}': File is read-only. Select 'Overwrite' to attempt to make it writeable.", basename(resource));
        }
      } else if (canSaveElevated && isPermissionDenied) {
        message = isWindows ? localize("permissionDeniedSaveError", "Failed to save '{0}': Insufficient permissions. Select 'Retry as Admin' to retry as administrator.", basename(resource)) : localize("permissionDeniedSaveErrorSudo", "Failed to save '{0}': Insufficient permissions. Select 'Retry as Sudo' to retry as superuser.", basename(resource));
      } else {
        message = localize({ key: "genericSaveError", comment: ["{0} is the resource that failed to save and {1} the error message"] }, "Failed to save '{0}': {1}", basename(resource), toErrorMessage(error, false));
      }
    }
    const actions = { primary: primaryActions, secondary: secondaryActions };
    const handle = this.notificationService.notify({
      id: `${hash(model.resource.toString())}`,
      // unique per model (https://github.com/microsoft/vscode/issues/121539)
      severity: Severity.Error,
      message,
      actions
    });
    Event.once(handle.onDidClose)(() => {
      dispose(primaryActions);
      dispose(secondaryActions);
    });
    this.messages.set(model.resource, handle);
  }
  dispose() {
    super.dispose();
    this.messages.clear();
  }
};
TextFileSaveErrorHandler.ID = "workbench.contrib.textFileSaveErrorHandler";
TextFileSaveErrorHandler = __decorateClass([
  __decorateParam(0, INotificationService),
  __decorateParam(1, ITextFileService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, ITextModelService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IStorageService)
], TextFileSaveErrorHandler);
const pendingResolveSaveConflictMessages = [];
function clearPendingResolveSaveConflictMessages() {
  while (pendingResolveSaveConflictMessages.length > 0) {
    const item = pendingResolveSaveConflictMessages.pop();
    item?.close();
  }
}
let ResolveConflictLearnMoreAction = class extends Action {
  constructor(openerService) {
    super("workbench.files.action.resolveConflictLearnMore", localize("learnMore", "Learn More"));
    this.openerService = openerService;
  }
  async run() {
    await this.openerService.open(URI.parse("https://go.microsoft.com/fwlink/?linkid=868264"));
  }
};
ResolveConflictLearnMoreAction = __decorateClass([
  __decorateParam(0, IOpenerService)
], ResolveConflictLearnMoreAction);
let DoNotShowResolveConflictLearnMoreAction = class extends Action {
  constructor(storageService) {
    super("workbench.files.action.resolveConflictLearnMoreDoNotShowAgain", localize("dontShowAgain", "Don't Show Again"));
    this.storageService = storageService;
  }
  async run(notification) {
    this.storageService.store(LEARN_MORE_DIRTY_WRITE_IGNORE_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
    notification.dispose();
  }
};
DoNotShowResolveConflictLearnMoreAction = __decorateClass([
  __decorateParam(0, IStorageService)
], DoNotShowResolveConflictLearnMoreAction);
let ResolveSaveConflictAction = class extends Action {
  constructor(model, editorService, notificationService, instantiationService, productService) {
    super("workbench.files.action.resolveConflict", localize("compareChanges", "Compare"));
    this.model = model;
    this.editorService = editorService;
    this.notificationService = notificationService;
    this.instantiationService = instantiationService;
    this.productService = productService;
  }
  async run() {
    if (!this.model.isDisposed()) {
      const resource = this.model.resource;
      const name = basename(resource);
      const editorLabel = localize("saveConflictDiffLabel", "{0} (in file) \u2194 {1} (in {2}) - Resolve save conflict", name, name, this.productService.nameLong);
      await TextFileContentProvider.open(resource, CONFLICT_RESOLUTION_SCHEME, editorLabel, this.editorService, { pinned: true });
      const actions = { primary: [this.instantiationService.createInstance(ResolveConflictLearnMoreAction)] };
      const handle = this.notificationService.notify({
        id: `${hash(resource.toString())}`,
        // unique per model
        severity: Severity.Info,
        message: conflictEditorHelp,
        actions,
        neverShowAgain: { id: LEARN_MORE_DIRTY_WRITE_IGNORE_KEY, isSecondary: true }
      });
      Event.once(handle.onDidClose)(() => dispose(actions.primary));
      pendingResolveSaveConflictMessages.push(handle);
    }
  }
};
ResolveSaveConflictAction = __decorateClass([
  __decorateParam(1, IEditorService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IProductService)
], ResolveSaveConflictAction);
class SaveModelElevatedAction extends Action {
  constructor(model, options, triedToUnlock) {
    super("workbench.files.action.saveModelElevated", triedToUnlock ? isWindows ? localize("overwriteElevated", "Overwrite as Admin...") : localize("overwriteElevatedSudo", "Overwrite as Sudo...") : isWindows ? localize("saveElevated", "Retry as Admin...") : localize("saveElevatedSudo", "Retry as Sudo..."));
    this.model = model;
    this.options = options;
    this.triedToUnlock = triedToUnlock;
  }
  async run() {
    if (!this.model.isDisposed()) {
      await this.model.save({
        ...this.options,
        writeElevated: true,
        writeUnlock: this.triedToUnlock,
        reason: SaveReason.EXPLICIT
      });
    }
  }
}
class RetrySaveModelAction extends Action {
  constructor(model, options) {
    super("workbench.files.action.saveModel", localize("retry", "Retry"));
    this.model = model;
    this.options = options;
  }
  async run() {
    if (!this.model.isDisposed()) {
      await this.model.save({ ...this.options, reason: SaveReason.EXPLICIT });
    }
  }
}
class RevertModelAction extends Action {
  constructor(model) {
    super("workbench.files.action.revertModel", localize("revert", "Revert"));
    this.model = model;
  }
  async run() {
    if (!this.model.isDisposed()) {
      await this.model.revert();
    }
  }
}
let SaveModelAsAction = class extends Action {
  constructor(model, editorService) {
    super("workbench.files.action.saveModelAs", SAVE_FILE_AS_LABEL.value);
    this.model = model;
    this.editorService = editorService;
  }
  async run() {
    if (!this.model.isDisposed()) {
      const editor = this.findEditor();
      if (editor) {
        await this.editorService.save(editor, { saveAs: true, reason: SaveReason.EXPLICIT });
      }
    }
  }
  findEditor() {
    let preferredMatchingEditor;
    const editors = this.editorService.findEditors(this.model.resource, { supportSideBySide: SideBySideEditor.PRIMARY });
    for (const identifier of editors) {
      if (identifier.editor instanceof FileEditorInput) {
        preferredMatchingEditor = identifier;
        break;
      } else if (!preferredMatchingEditor) {
        preferredMatchingEditor = identifier;
      }
    }
    return preferredMatchingEditor;
  }
};
SaveModelAsAction = __decorateClass([
  __decorateParam(1, IEditorService)
], SaveModelAsAction);
class UnlockModelAction extends Action {
  constructor(model, options) {
    super("workbench.files.action.unlock", localize("overwrite", "Overwrite"));
    this.model = model;
    this.options = options;
  }
  async run() {
    if (!this.model.isDisposed()) {
      await this.model.save({ ...this.options, writeUnlock: true, reason: SaveReason.EXPLICIT });
    }
  }
}
class SaveModelIgnoreModifiedSinceAction extends Action {
  constructor(model, options) {
    super("workbench.files.action.saveIgnoreModifiedSince", localize("overwrite", "Overwrite"));
    this.model = model;
    this.options = options;
  }
  async run() {
    if (!this.model.isDisposed()) {
      await this.model.save({ ...this.options, ignoreModifiedSince: true, reason: SaveReason.EXPLICIT });
    }
  }
}
let ConfigureSaveConflictAction = class extends Action {
  constructor(preferencesService) {
    super("workbench.files.action.configureSaveConflict", localize("configure", "Configure"));
    this.preferencesService = preferencesService;
  }
  async run() {
    this.preferencesService.openSettings({ query: "files.saveConflictResolution" });
  }
};
ConfigureSaveConflictAction = __decorateClass([
  __decorateParam(0, IPreferencesService)
], ConfigureSaveConflictAction);
const acceptLocalChangesCommand = (accessor, resource) => {
  return acceptOrRevertLocalChangesCommand(accessor, resource, true);
};
const revertLocalChangesCommand = (accessor, resource) => {
  return acceptOrRevertLocalChangesCommand(accessor, resource, false);
};
async function acceptOrRevertLocalChangesCommand(accessor, resource, accept) {
  const editorService = accessor.get(IEditorService);
  const editorPane = editorService.activeEditorPane;
  if (!editorPane) {
    return;
  }
  const editor = editorPane.input;
  const group = editorPane.group;
  clearPendingResolveSaveConflictMessages();
  if (accept) {
    const options = { ignoreModifiedSince: true, reason: SaveReason.EXPLICIT };
    await editorService.save({ editor, groupId: group.id }, options);
  } else {
    await editorService.revert({ editor, groupId: group.id });
  }
  await editorService.openEditor({ resource }, group);
  return group.closeEditor(editor);
}
export {
  CONFLICT_RESOLUTION_CONTEXT,
  CONFLICT_RESOLUTION_SCHEME,
  TextFileSaveErrorHandler,
  acceptLocalChangesCommand,
  revertLocalChangesCommand
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy9icm93c2VyL2VkaXRvcnMvdGV4dEZpbGVTYXZlRXJyb3JIYW5kbGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgdG9FcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvck1lc3NhZ2UuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRmlsZU9wZXJhdGlvbkVycm9yLCBGaWxlT3BlcmF0aW9uUmVzdWx0LCBJV3JpdGVGaWxlT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJVGV4dEZpbGVTZXJ2aWNlLCBJU2F2ZUVycm9ySGFuZGxlciwgSVRleHRGaWxlRWRpdG9yTW9kZWwsIElUZXh0RmlsZVNhdmVBc09wdGlvbnMsIElUZXh0RmlsZVNhdmVPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvdGV4dGZpbGUvY29tbW9uL3RleHRmaWxlcy5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yLCBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlLCBkaXNwb3NlLCBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvcmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFJlc291cmNlTWFwIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IERpZmZFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZGlmZkVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IFRleHRGaWxlQ29udGVudFByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IEZpbGVFZGl0b3JJbnB1dCB9IGZyb20gJy4vZmlsZUVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IFNBVkVfRklMRV9BU19MQUJFTCB9IGZyb20gJy4uL2ZpbGVDb25zdGFudHMuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UsIElOb3RpZmljYXRpb25IYW5kbGUsIElOb3RpZmljYXRpb25BY3Rpb25zLCBTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgSVByZWZlcmVuY2VzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3ByZWZlcmVuY2VzL2NvbW1vbi9wcmVmZXJlbmNlcy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9ySWRlbnRpZmllciwgU2F2ZVJlYXNvbiwgU2lkZUJ5U2lkZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgaGFzaCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2hhc2guanMnO1xuXG5leHBvcnQgY29uc3QgQ09ORkxJQ1RfUkVTT0xVVElPTl9DT05URVhUID0gJ3NhdmVDb25mbGljdFJlc29sdXRpb25Db250ZXh0JztcbmV4cG9ydCBjb25zdCBDT05GTElDVF9SRVNPTFVUSU9OX1NDSEVNRSA9ICdjb25mbGljdFJlc29sdXRpb24nO1xuXG5jb25zdCBMRUFSTl9NT1JFX0RJUlRZX1dSSVRFX0lHTk9SRV9LRVkgPSAnbGVhcm5Nb3JlRGlydHlXcml0ZUVycm9yJztcblxuY29uc3QgY29uZmxpY3RFZGl0b3JIZWxwID0gbG9jYWxpemUoJ3VzZXJHdWlkZScsIFwiVXNlIHRoZSBhY3Rpb25zIGluIHRoZSBlZGl0b3IgdG9vbCBiYXIgdG8gZWl0aGVyIHVuZG8geW91ciBjaGFuZ2VzIG9yIG92ZXJ3cml0ZSB0aGUgY29udGVudCBvZiB0aGUgZmlsZSB3aXRoIHlvdXIgY2hhbmdlcy5cIik7XG5cbi8vIEEgaGFuZGxlciBmb3IgdGV4dCBmaWxlIHNhdmUgZXJyb3IgaGFwcGVuaW5nIHdpdGggY29uZmxpY3QgcmVzb2x1dGlvbiBhY3Rpb25zXG5leHBvcnQgY2xhc3MgVGV4dEZpbGVTYXZlRXJyb3JIYW5kbGVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElTYXZlRXJyb3JIYW5kbGVyLCBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIudGV4dEZpbGVTYXZlRXJyb3JIYW5kbGVyJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IG1lc3NhZ2VzID0gbmV3IFJlc291cmNlTWFwPElOb3RpZmljYXRpb25IYW5kbGU+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgY29uZmxpY3RSZXNvbHV0aW9uQ29udGV4dDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgYWN0aXZlQ29uZmxpY3RSZXNvbHV0aW9uUmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASVRleHRGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRleHRGaWxlU2VydmljZTogSVRleHRGaWxlU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHRleHRNb2RlbFNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmNvbmZsaWN0UmVzb2x1dGlvbkNvbnRleHQgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPihDT05GTElDVF9SRVNPTFVUSU9OX0NPTlRFWFQsIGZhbHNlLCB0cnVlKS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLl9yZWdpc3RlcihpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUNvbnRlbnRQcm92aWRlcikpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRleHRNb2RlbFNlcnZpY2UucmVnaXN0ZXJUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIoQ09ORkxJQ1RfUkVTT0xVVElPTl9TQ0hFTUUsIHByb3ZpZGVyKSk7XG5cblx0XHQvLyBTZXQgYXMgc2F2ZSBlcnJvciBoYW5kbGVyIHRvIHNlcnZpY2UgZm9yIHRleHQgZmlsZXNcblx0XHR0aGlzLnRleHRGaWxlU2VydmljZS5maWxlcy5zYXZlRXJyb3JIYW5kbGVyID0gdGhpcztcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50ZXh0RmlsZVNlcnZpY2UuZmlsZXMub25EaWRTYXZlKGUgPT4gdGhpcy5vbkZpbGVTYXZlZE9yUmV2ZXJ0ZWQoZS5tb2RlbC5yZXNvdXJjZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRleHRGaWxlU2VydmljZS5maWxlcy5vbkRpZFJldmVydChtb2RlbCA9PiB0aGlzLm9uRmlsZVNhdmVkT3JSZXZlcnRlZChtb2RlbC5yZXNvdXJjZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvclNlcnZpY2Uub25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UoKCkgPT4gdGhpcy5vbkFjdGl2ZUVkaXRvckNoYW5nZWQoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkFjdGl2ZUVkaXRvckNoYW5nZWQoKTogdm9pZCB7XG5cdFx0bGV0IGlzQWN0aXZlRWRpdG9yU2F2ZUNvbmZsaWN0UmVzb2x1dGlvbiA9IGZhbHNlO1xuXHRcdGxldCBhY3RpdmVDb25mbGljdFJlc29sdXRpb25SZXNvdXJjZTogVVJJIHwgdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgYWN0aXZlSW5wdXQgPSB0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yO1xuXHRcdGlmIChhY3RpdmVJbnB1dCBpbnN0YW5jZW9mIERpZmZFZGl0b3JJbnB1dCkge1xuXHRcdFx0Y29uc3QgcmVzb3VyY2UgPSBhY3RpdmVJbnB1dC5vcmlnaW5hbC5yZXNvdXJjZTtcblx0XHRcdGlmIChyZXNvdXJjZT8uc2NoZW1lID09PSBDT05GTElDVF9SRVNPTFVUSU9OX1NDSEVNRSkge1xuXHRcdFx0XHRpc0FjdGl2ZUVkaXRvclNhdmVDb25mbGljdFJlc29sdXRpb24gPSB0cnVlO1xuXHRcdFx0XHRhY3RpdmVDb25mbGljdFJlc29sdXRpb25SZXNvdXJjZSA9IGFjdGl2ZUlucHV0Lm1vZGlmaWVkLnJlc291cmNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuY29uZmxpY3RSZXNvbHV0aW9uQ29udGV4dC5zZXQoaXNBY3RpdmVFZGl0b3JTYXZlQ29uZmxpY3RSZXNvbHV0aW9uKTtcblx0XHR0aGlzLmFjdGl2ZUNvbmZsaWN0UmVzb2x1dGlvblJlc291cmNlID0gYWN0aXZlQ29uZmxpY3RSZXNvbHV0aW9uUmVzb3VyY2U7XG5cdH1cblxuXHRwcml2YXRlIG9uRmlsZVNhdmVkT3JSZXZlcnRlZChyZXNvdXJjZTogVVJJKTogdm9pZCB7XG5cdFx0Y29uc3QgbWVzc2FnZUhhbmRsZSA9IHRoaXMubWVzc2FnZXMuZ2V0KHJlc291cmNlKTtcblx0XHRpZiAobWVzc2FnZUhhbmRsZSkge1xuXHRcdFx0bWVzc2FnZUhhbmRsZS5jbG9zZSgpO1xuXHRcdFx0dGhpcy5tZXNzYWdlcy5kZWxldGUocmVzb3VyY2UpO1xuXHRcdH1cblx0fVxuXG5cdG9uU2F2ZUVycm9yKGVycm9yOiB1bmtub3duLCBtb2RlbDogSVRleHRGaWxlRWRpdG9yTW9kZWwsIG9wdGlvbnM6IElUZXh0RmlsZVNhdmVPcHRpb25zKTogdm9pZCB7XG5cdFx0Y29uc3QgZmlsZU9wZXJhdGlvbkVycm9yID0gZXJyb3IgYXMgRmlsZU9wZXJhdGlvbkVycm9yO1xuXHRcdGNvbnN0IHJlc291cmNlID0gbW9kZWwucmVzb3VyY2U7XG5cblx0XHRsZXQgbWVzc2FnZTogc3RyaW5nO1xuXHRcdGNvbnN0IHByaW1hcnlBY3Rpb25zOiBBY3Rpb25bXSA9IFtdO1xuXHRcdGNvbnN0IHNlY29uZGFyeUFjdGlvbnM6IEFjdGlvbltdID0gW107XG5cblx0XHQvLyBEaXJ0eSB3cml0ZSBwcmV2ZW50aW9uXG5cdFx0aWYgKGZpbGVPcGVyYXRpb25FcnJvci5maWxlT3BlcmF0aW9uUmVzdWx0ID09PSBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTU9ESUZJRURfU0lOQ0UpIHtcblxuXHRcdFx0Ly8gSWYgdGhlIHVzZXIgdHJpZWQgdG8gc2F2ZSBmcm9tIHRoZSBvcGVuZWQgY29uZmxpY3QgZWRpdG9yLCBzaG93IGl0cyBtZXNzYWdlIGFnYWluXG5cdFx0XHRpZiAodGhpcy5hY3RpdmVDb25mbGljdFJlc29sdXRpb25SZXNvdXJjZSAmJiBpc0VxdWFsKHRoaXMuYWN0aXZlQ29uZmxpY3RSZXNvbHV0aW9uUmVzb3VyY2UsIG1vZGVsLnJlc291cmNlKSkge1xuXHRcdFx0XHRpZiAodGhpcy5zdG9yYWdlU2VydmljZS5nZXRCb29sZWFuKExFQVJOX01PUkVfRElSVFlfV1JJVEVfSUdOT1JFX0tFWSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKSkge1xuXHRcdFx0XHRcdHJldHVybjsgLy8gcmV0dXJuIGlmIHRoaXMgbWVzc2FnZSBpcyBpZ25vcmVkXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRtZXNzYWdlID0gY29uZmxpY3RFZGl0b3JIZWxwO1xuXG5cdFx0XHRcdHByaW1hcnlBY3Rpb25zLnB1c2godGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXNvbHZlQ29uZmxpY3RMZWFybk1vcmVBY3Rpb24pKTtcblx0XHRcdFx0c2Vjb25kYXJ5QWN0aW9ucy5wdXNoKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRG9Ob3RTaG93UmVzb2x2ZUNvbmZsaWN0TGVhcm5Nb3JlQWN0aW9uKSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIE90aGVyd2lzZSBzaG93IHRoZSBtZXNzYWdlIHRoYXQgd2lsbCBsZWFkIHRoZSB1c2VyIGludG8gdGhlIHNhdmUgY29uZmxpY3QgZWRpdG9yLlxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdG1lc3NhZ2UgPSBsb2NhbGl6ZSgnc3RhbGVTYXZlRXJyb3InLCBcIkZhaWxlZCB0byBzYXZlICd7MH0nOiBUaGUgY29udGVudCBvZiB0aGUgZmlsZSBpcyBuZXdlci4gUGxlYXNlIGNvbXBhcmUgeW91ciB2ZXJzaW9uIHdpdGggdGhlIGZpbGUgY29udGVudHMgb3Igb3ZlcndyaXRlIHRoZSBjb250ZW50IG9mIHRoZSBmaWxlIHdpdGggeW91ciBjaGFuZ2VzLlwiLCBiYXNlbmFtZShyZXNvdXJjZSkpO1xuXG5cdFx0XHRcdHByaW1hcnlBY3Rpb25zLnB1c2godGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXNvbHZlU2F2ZUNvbmZsaWN0QWN0aW9uLCBtb2RlbCkpO1xuXHRcdFx0XHRwcmltYXJ5QWN0aW9ucy5wdXNoKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2F2ZU1vZGVsSWdub3JlTW9kaWZpZWRTaW5jZUFjdGlvbiwgbW9kZWwsIG9wdGlvbnMpKTtcblxuXHRcdFx0XHRzZWNvbmRhcnlBY3Rpb25zLnB1c2godGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb25maWd1cmVTYXZlQ29uZmxpY3RBY3Rpb24pKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBBbnkgb3RoZXIgc2F2ZSBlcnJvclxuXHRcdGVsc2Uge1xuXHRcdFx0Y29uc3QgaXNXcml0ZUxvY2tlZCA9IGZpbGVPcGVyYXRpb25FcnJvci5maWxlT3BlcmF0aW9uUmVzdWx0ID09PSBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfV1JJVEVfTE9DS0VEO1xuXHRcdFx0Y29uc3QgdHJpZWRUb1VubG9jayA9IGlzV3JpdGVMb2NrZWQgJiYgKGZpbGVPcGVyYXRpb25FcnJvci5vcHRpb25zIGFzIElXcml0ZUZpbGVPcHRpb25zIHwgdW5kZWZpbmVkKT8udW5sb2NrO1xuXHRcdFx0Y29uc3QgaXNQZXJtaXNzaW9uRGVuaWVkID0gZmlsZU9wZXJhdGlvbkVycm9yLmZpbGVPcGVyYXRpb25SZXN1bHQgPT09IEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9QRVJNSVNTSU9OX0RFTklFRDtcblx0XHRcdGNvbnN0IGNhblNhdmVFbGV2YXRlZCA9IHJlc291cmNlLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlOyAvLyBjdXJyZW50bHkgb25seSBzdXBwb3J0ZWQgZm9yIGxvY2FsIHNjaGVtZXMgKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy80ODY1OSlcblxuXHRcdFx0Ly8gU2F2ZSBFbGV2YXRlZFxuXHRcdFx0aWYgKGNhblNhdmVFbGV2YXRlZCAmJiAoaXNQZXJtaXNzaW9uRGVuaWVkIHx8IHRyaWVkVG9VbmxvY2spKSB7XG5cdFx0XHRcdHByaW1hcnlBY3Rpb25zLnB1c2godGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTYXZlTW9kZWxFbGV2YXRlZEFjdGlvbiwgbW9kZWwsIG9wdGlvbnMsICEhdHJpZWRUb1VubG9jaykpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBVbmxvY2tcblx0XHRcdGVsc2UgaWYgKGlzV3JpdGVMb2NrZWQpIHtcblx0XHRcdFx0cHJpbWFyeUFjdGlvbnMucHVzaCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFVubG9ja01vZGVsQWN0aW9uLCBtb2RlbCwgb3B0aW9ucykpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBSZXRyeVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHByaW1hcnlBY3Rpb25zLnB1c2godGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXRyeVNhdmVNb2RlbEFjdGlvbiwgbW9kZWwsIG9wdGlvbnMpKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2F2ZSBBc1xuXHRcdFx0cHJpbWFyeUFjdGlvbnMucHVzaCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNhdmVNb2RlbEFzQWN0aW9uLCBtb2RlbCkpO1xuXG5cdFx0XHQvLyBSZXZlcnRcblx0XHRcdHByaW1hcnlBY3Rpb25zLnB1c2godGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXZlcnRNb2RlbEFjdGlvbiwgbW9kZWwpKTtcblxuXHRcdFx0Ly8gTWVzc2FnZVxuXHRcdFx0aWYgKGlzV3JpdGVMb2NrZWQpIHtcblx0XHRcdFx0aWYgKHRyaWVkVG9VbmxvY2sgJiYgY2FuU2F2ZUVsZXZhdGVkKSB7XG5cdFx0XHRcdFx0bWVzc2FnZSA9IGlzV2luZG93cyA/IGxvY2FsaXplKCdyZWFkb25seVNhdmVFcnJvckFkbWluJywgXCJGYWlsZWQgdG8gc2F2ZSAnezB9JzogRmlsZSBpcyByZWFkLW9ubHkuIFNlbGVjdCAnT3ZlcndyaXRlIGFzIEFkbWluJyB0byByZXRyeSBhcyBhZG1pbmlzdHJhdG9yLlwiLCBiYXNlbmFtZShyZXNvdXJjZSkpIDogbG9jYWxpemUoJ3JlYWRvbmx5U2F2ZUVycm9yU3VkbycsIFwiRmFpbGVkIHRvIHNhdmUgJ3swfSc6IEZpbGUgaXMgcmVhZC1vbmx5LiBTZWxlY3QgJ092ZXJ3cml0ZSBhcyBTdWRvJyB0byByZXRyeSBhcyBzdXBlcnVzZXIuXCIsIGJhc2VuYW1lKHJlc291cmNlKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bWVzc2FnZSA9IGxvY2FsaXplKCdyZWFkb25seVNhdmVFcnJvcicsIFwiRmFpbGVkIHRvIHNhdmUgJ3swfSc6IEZpbGUgaXMgcmVhZC1vbmx5LiBTZWxlY3QgJ092ZXJ3cml0ZScgdG8gYXR0ZW1wdCB0byBtYWtlIGl0IHdyaXRlYWJsZS5cIiwgYmFzZW5hbWUocmVzb3VyY2UpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChjYW5TYXZlRWxldmF0ZWQgJiYgaXNQZXJtaXNzaW9uRGVuaWVkKSB7XG5cdFx0XHRcdG1lc3NhZ2UgPSBpc1dpbmRvd3MgPyBsb2NhbGl6ZSgncGVybWlzc2lvbkRlbmllZFNhdmVFcnJvcicsIFwiRmFpbGVkIHRvIHNhdmUgJ3swfSc6IEluc3VmZmljaWVudCBwZXJtaXNzaW9ucy4gU2VsZWN0ICdSZXRyeSBhcyBBZG1pbicgdG8gcmV0cnkgYXMgYWRtaW5pc3RyYXRvci5cIiwgYmFzZW5hbWUocmVzb3VyY2UpKSA6IGxvY2FsaXplKCdwZXJtaXNzaW9uRGVuaWVkU2F2ZUVycm9yU3VkbycsIFwiRmFpbGVkIHRvIHNhdmUgJ3swfSc6IEluc3VmZmljaWVudCBwZXJtaXNzaW9ucy4gU2VsZWN0ICdSZXRyeSBhcyBTdWRvJyB0byByZXRyeSBhcyBzdXBlcnVzZXIuXCIsIGJhc2VuYW1lKHJlc291cmNlKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtZXNzYWdlID0gbG9jYWxpemUoeyBrZXk6ICdnZW5lcmljU2F2ZUVycm9yJywgY29tbWVudDogWyd7MH0gaXMgdGhlIHJlc291cmNlIHRoYXQgZmFpbGVkIHRvIHNhdmUgYW5kIHsxfSB0aGUgZXJyb3IgbWVzc2FnZSddIH0sIFwiRmFpbGVkIHRvIHNhdmUgJ3swfSc6IHsxfVwiLCBiYXNlbmFtZShyZXNvdXJjZSksIHRvRXJyb3JNZXNzYWdlKGVycm9yLCBmYWxzZSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFNob3cgbWVzc2FnZSBhbmQga2VlcCBmdW5jdGlvbiB0byBoaWRlIGluIGNhc2UgdGhlIGZpbGUgZ2V0cyBzYXZlZC9yZXZlcnRlZFxuXHRcdGNvbnN0IGFjdGlvbnM6IElOb3RpZmljYXRpb25BY3Rpb25zID0geyBwcmltYXJ5OiBwcmltYXJ5QWN0aW9ucywgc2Vjb25kYXJ5OiBzZWNvbmRhcnlBY3Rpb25zIH07XG5cdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLm5vdGlmeSh7XG5cdFx0XHRpZDogYCR7aGFzaChtb2RlbC5yZXNvdXJjZS50b1N0cmluZygpKX1gLCAvLyB1bmlxdWUgcGVyIG1vZGVsIChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTIxNTM5KVxuXHRcdFx0c2V2ZXJpdHk6IFNldmVyaXR5LkVycm9yLFxuXHRcdFx0bWVzc2FnZSxcblx0XHRcdGFjdGlvbnNcblx0XHR9KTtcblx0XHRFdmVudC5vbmNlKGhhbmRsZS5vbkRpZENsb3NlKSgoKSA9PiB7IGRpc3Bvc2UocHJpbWFyeUFjdGlvbnMpOyBkaXNwb3NlKHNlY29uZGFyeUFjdGlvbnMpOyB9KTtcblx0XHR0aGlzLm1lc3NhZ2VzLnNldChtb2RlbC5yZXNvdXJjZSwgaGFuZGxlKTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXG5cdFx0dGhpcy5tZXNzYWdlcy5jbGVhcigpO1xuXHR9XG59XG5cbmNvbnN0IHBlbmRpbmdSZXNvbHZlU2F2ZUNvbmZsaWN0TWVzc2FnZXM6IElOb3RpZmljYXRpb25IYW5kbGVbXSA9IFtdO1xuZnVuY3Rpb24gY2xlYXJQZW5kaW5nUmVzb2x2ZVNhdmVDb25mbGljdE1lc3NhZ2VzKCk6IHZvaWQge1xuXHR3aGlsZSAocGVuZGluZ1Jlc29sdmVTYXZlQ29uZmxpY3RNZXNzYWdlcy5sZW5ndGggPiAwKSB7XG5cdFx0Y29uc3QgaXRlbSA9IHBlbmRpbmdSZXNvbHZlU2F2ZUNvbmZsaWN0TWVzc2FnZXMucG9wKCk7XG5cdFx0aXRlbT8uY2xvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBSZXNvbHZlQ29uZmxpY3RMZWFybk1vcmVBY3Rpb24gZXh0ZW5kcyBBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCd3b3JrYmVuY2guZmlsZXMuYWN0aW9uLnJlc29sdmVDb25mbGljdExlYXJuTW9yZScsIGxvY2FsaXplKCdsZWFybk1vcmUnLCBcIkxlYXJuIE1vcmVcIikpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMub3BlbmVyU2VydmljZS5vcGVuKFVSSS5wYXJzZSgnaHR0cHM6Ly9nby5taWNyb3NvZnQuY29tL2Z3bGluay8/bGlua2lkPTg2ODI2NCcpKTtcblx0fVxufVxuXG5jbGFzcyBEb05vdFNob3dSZXNvbHZlQ29uZmxpY3RMZWFybk1vcmVBY3Rpb24gZXh0ZW5kcyBBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCd3b3JrYmVuY2guZmlsZXMuYWN0aW9uLnJlc29sdmVDb25mbGljdExlYXJuTW9yZURvTm90U2hvd0FnYWluJywgbG9jYWxpemUoJ2RvbnRTaG93QWdhaW4nLCBcIkRvbid0IFNob3cgQWdhaW5cIikpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKG5vdGlmaWNhdGlvbjogSURpc3Bvc2FibGUpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIFJlbWVtYmVyIHRoaXMgYXMgYXBwbGljYXRpb24gc3RhdGVcblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKExFQVJOX01PUkVfRElSVFlfV1JJVEVfSUdOT1JFX0tFWSwgdHJ1ZSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXG5cdFx0Ly8gSGlkZSBub3RpZmljYXRpb25cblx0XHRub3RpZmljYXRpb24uZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIFJlc29sdmVTYXZlQ29uZmxpY3RBY3Rpb24gZXh0ZW5kcyBBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgbW9kZWw6IElUZXh0RmlsZUVkaXRvck1vZGVsLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCd3b3JrYmVuY2guZmlsZXMuYWN0aW9uLnJlc29sdmVDb25mbGljdCcsIGxvY2FsaXplKCdjb21wYXJlQ2hhbmdlcycsIFwiQ29tcGFyZVwiKSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLm1vZGVsLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0Y29uc3QgcmVzb3VyY2UgPSB0aGlzLm1vZGVsLnJlc291cmNlO1xuXHRcdFx0Y29uc3QgbmFtZSA9IGJhc2VuYW1lKHJlc291cmNlKTtcblx0XHRcdGNvbnN0IGVkaXRvckxhYmVsID0gbG9jYWxpemUoJ3NhdmVDb25mbGljdERpZmZMYWJlbCcsIFwiezB9IChpbiBmaWxlKSBcdTIxOTQgezF9IChpbiB7Mn0pIC0gUmVzb2x2ZSBzYXZlIGNvbmZsaWN0XCIsIG5hbWUsIG5hbWUsIHRoaXMucHJvZHVjdFNlcnZpY2UubmFtZUxvbmcpO1xuXG5cdFx0XHRhd2FpdCBUZXh0RmlsZUNvbnRlbnRQcm92aWRlci5vcGVuKHJlc291cmNlLCBDT05GTElDVF9SRVNPTFVUSU9OX1NDSEVNRSwgZWRpdG9yTGFiZWwsIHRoaXMuZWRpdG9yU2VydmljZSwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cblx0XHRcdC8vIFNob3cgYWRkaXRpb25hbCBoZWxwIGhvdyB0byByZXNvbHZlIHRoZSBzYXZlIGNvbmZsaWN0XG5cdFx0XHRjb25zdCBhY3Rpb25zID0geyBwcmltYXJ5OiBbdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXNvbHZlQ29uZmxpY3RMZWFybk1vcmVBY3Rpb24pXSB9O1xuXHRcdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLm5vdGlmeSh7XG5cdFx0XHRcdGlkOiBgJHtoYXNoKHJlc291cmNlLnRvU3RyaW5nKCkpfWAsIC8vIHVuaXF1ZSBwZXIgbW9kZWxcblx0XHRcdFx0c2V2ZXJpdHk6IFNldmVyaXR5LkluZm8sXG5cdFx0XHRcdG1lc3NhZ2U6IGNvbmZsaWN0RWRpdG9ySGVscCxcblx0XHRcdFx0YWN0aW9ucyxcblx0XHRcdFx0bmV2ZXJTaG93QWdhaW46IHsgaWQ6IExFQVJOX01PUkVfRElSVFlfV1JJVEVfSUdOT1JFX0tFWSwgaXNTZWNvbmRhcnk6IHRydWUgfVxuXHRcdFx0fSk7XG5cdFx0XHRFdmVudC5vbmNlKGhhbmRsZS5vbkRpZENsb3NlKSgoKSA9PiBkaXNwb3NlKGFjdGlvbnMucHJpbWFyeSkpO1xuXHRcdFx0cGVuZGluZ1Jlc29sdmVTYXZlQ29uZmxpY3RNZXNzYWdlcy5wdXNoKGhhbmRsZSk7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIFNhdmVNb2RlbEVsZXZhdGVkQWN0aW9uIGV4dGVuZHMgQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIG1vZGVsOiBJVGV4dEZpbGVFZGl0b3JNb2RlbCxcblx0XHRwcml2YXRlIG9wdGlvbnM6IElUZXh0RmlsZVNhdmVPcHRpb25zLFxuXHRcdHByaXZhdGUgdHJpZWRUb1VubG9jazogYm9vbGVhblxuXHQpIHtcblx0XHRzdXBlcignd29ya2JlbmNoLmZpbGVzLmFjdGlvbi5zYXZlTW9kZWxFbGV2YXRlZCcsIHRyaWVkVG9VbmxvY2sgPyBpc1dpbmRvd3MgPyBsb2NhbGl6ZSgnb3ZlcndyaXRlRWxldmF0ZWQnLCBcIk92ZXJ3cml0ZSBhcyBBZG1pbi4uLlwiKSA6IGxvY2FsaXplKCdvdmVyd3JpdGVFbGV2YXRlZFN1ZG8nLCBcIk92ZXJ3cml0ZSBhcyBTdWRvLi4uXCIpIDogaXNXaW5kb3dzID8gbG9jYWxpemUoJ3NhdmVFbGV2YXRlZCcsIFwiUmV0cnkgYXMgQWRtaW4uLi5cIikgOiBsb2NhbGl6ZSgnc2F2ZUVsZXZhdGVkU3VkbycsIFwiUmV0cnkgYXMgU3Vkby4uLlwiKSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLm1vZGVsLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0YXdhaXQgdGhpcy5tb2RlbC5zYXZlKHtcblx0XHRcdFx0Li4udGhpcy5vcHRpb25zLFxuXHRcdFx0XHR3cml0ZUVsZXZhdGVkOiB0cnVlLFxuXHRcdFx0XHR3cml0ZVVubG9jazogdGhpcy50cmllZFRvVW5sb2NrLFxuXHRcdFx0XHRyZWFzb246IFNhdmVSZWFzb24uRVhQTElDSVRcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBSZXRyeVNhdmVNb2RlbEFjdGlvbiBleHRlbmRzIEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBtb2RlbDogSVRleHRGaWxlRWRpdG9yTW9kZWwsXG5cdFx0cHJpdmF0ZSBvcHRpb25zOiBJVGV4dEZpbGVTYXZlT3B0aW9uc1xuXHQpIHtcblx0XHRzdXBlcignd29ya2JlbmNoLmZpbGVzLmFjdGlvbi5zYXZlTW9kZWwnLCBsb2NhbGl6ZSgncmV0cnknLCBcIlJldHJ5XCIpKTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMubW9kZWwuaXNEaXNwb3NlZCgpKSB7XG5cdFx0XHRhd2FpdCB0aGlzLm1vZGVsLnNhdmUoeyAuLi50aGlzLm9wdGlvbnMsIHJlYXNvbjogU2F2ZVJlYXNvbi5FWFBMSUNJVCB9KTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgUmV2ZXJ0TW9kZWxBY3Rpb24gZXh0ZW5kcyBBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgbW9kZWw6IElUZXh0RmlsZUVkaXRvck1vZGVsXG5cdCkge1xuXHRcdHN1cGVyKCd3b3JrYmVuY2guZmlsZXMuYWN0aW9uLnJldmVydE1vZGVsJywgbG9jYWxpemUoJ3JldmVydCcsIFwiUmV2ZXJ0XCIpKTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMubW9kZWwuaXNEaXNwb3NlZCgpKSB7XG5cdFx0XHRhd2FpdCB0aGlzLm1vZGVsLnJldmVydCgpO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBTYXZlTW9kZWxBc0FjdGlvbiBleHRlbmRzIEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBtb2RlbDogSVRleHRGaWxlRWRpdG9yTW9kZWwsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoJ3dvcmtiZW5jaC5maWxlcy5hY3Rpb24uc2F2ZU1vZGVsQXMnLCBTQVZFX0ZJTEVfQVNfTEFCRUwudmFsdWUpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5tb2RlbC5pc0Rpc3Bvc2VkKCkpIHtcblx0XHRcdGNvbnN0IGVkaXRvciA9IHRoaXMuZmluZEVkaXRvcigpO1xuXHRcdFx0aWYgKGVkaXRvcikge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmVkaXRvclNlcnZpY2Uuc2F2ZShlZGl0b3IsIHsgc2F2ZUFzOiB0cnVlLCByZWFzb246IFNhdmVSZWFzb24uRVhQTElDSVQgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBmaW5kRWRpdG9yKCk6IElFZGl0b3JJZGVudGlmaWVyIHwgdW5kZWZpbmVkIHtcblx0XHRsZXQgcHJlZmVycmVkTWF0Y2hpbmdFZGl0b3I6IElFZGl0b3JJZGVudGlmaWVyIHwgdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgZWRpdG9ycyA9IHRoaXMuZWRpdG9yU2VydmljZS5maW5kRWRpdG9ycyh0aGlzLm1vZGVsLnJlc291cmNlLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLlBSSU1BUlkgfSk7XG5cdFx0Zm9yIChjb25zdCBpZGVudGlmaWVyIG9mIGVkaXRvcnMpIHtcblx0XHRcdGlmIChpZGVudGlmaWVyLmVkaXRvciBpbnN0YW5jZW9mIEZpbGVFZGl0b3JJbnB1dCkge1xuXHRcdFx0XHQvLyBXZSBwcmVmZXIgYSBgRmlsZUVkaXRvcklucHV0YCBmb3IgXCJTYXZlIEFzXCIsIGJ1dCBpdCBpcyBwb3NzaWJsZVxuXHRcdFx0XHQvLyB0aGF0IGEgY3VzdG9tIGVkaXRvciBpcyBsZXZlcmFnaW5nIHRoZSB0ZXh0IGZpbGUgbW9kZWwgYW5kIGFzXG5cdFx0XHRcdC8vIHN1Y2ggd2UgbmVlZCB0byBmYWxsYmFjayB0byBhbnkgb3RoZXIgZWRpdG9yIGhhdmluZyB0aGUgcmVzb3VyY2Vcblx0XHRcdFx0Ly8gb3BlbmVkIGZvciBydW5uaW5nIHRoZSBzYXZlLlxuXHRcdFx0XHRwcmVmZXJyZWRNYXRjaGluZ0VkaXRvciA9IGlkZW50aWZpZXI7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fSBlbHNlIGlmICghcHJlZmVycmVkTWF0Y2hpbmdFZGl0b3IpIHtcblx0XHRcdFx0cHJlZmVycmVkTWF0Y2hpbmdFZGl0b3IgPSBpZGVudGlmaWVyO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBwcmVmZXJyZWRNYXRjaGluZ0VkaXRvcjtcblx0fVxufVxuXG5jbGFzcyBVbmxvY2tNb2RlbEFjdGlvbiBleHRlbmRzIEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBtb2RlbDogSVRleHRGaWxlRWRpdG9yTW9kZWwsXG5cdFx0cHJpdmF0ZSBvcHRpb25zOiBJVGV4dEZpbGVTYXZlT3B0aW9uc1xuXHQpIHtcblx0XHRzdXBlcignd29ya2JlbmNoLmZpbGVzLmFjdGlvbi51bmxvY2snLCBsb2NhbGl6ZSgnb3ZlcndyaXRlJywgXCJPdmVyd3JpdGVcIikpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5tb2RlbC5pc0Rpc3Bvc2VkKCkpIHtcblx0XHRcdGF3YWl0IHRoaXMubW9kZWwuc2F2ZSh7IC4uLnRoaXMub3B0aW9ucywgd3JpdGVVbmxvY2s6IHRydWUsIHJlYXNvbjogU2F2ZVJlYXNvbi5FWFBMSUNJVCB9KTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgU2F2ZU1vZGVsSWdub3JlTW9kaWZpZWRTaW5jZUFjdGlvbiBleHRlbmRzIEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBtb2RlbDogSVRleHRGaWxlRWRpdG9yTW9kZWwsXG5cdFx0cHJpdmF0ZSBvcHRpb25zOiBJVGV4dEZpbGVTYXZlT3B0aW9uc1xuXHQpIHtcblx0XHRzdXBlcignd29ya2JlbmNoLmZpbGVzLmFjdGlvbi5zYXZlSWdub3JlTW9kaWZpZWRTaW5jZScsIGxvY2FsaXplKCdvdmVyd3JpdGUnLCBcIk92ZXJ3cml0ZVwiKSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLm1vZGVsLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0YXdhaXQgdGhpcy5tb2RlbC5zYXZlKHsgLi4udGhpcy5vcHRpb25zLCBpZ25vcmVNb2RpZmllZFNpbmNlOiB0cnVlLCByZWFzb246IFNhdmVSZWFzb24uRVhQTElDSVQgfSk7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIENvbmZpZ3VyZVNhdmVDb25mbGljdEFjdGlvbiBleHRlbmRzIEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElQcmVmZXJlbmNlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcmVmZXJlbmNlc1NlcnZpY2U6IElQcmVmZXJlbmNlc1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoJ3dvcmtiZW5jaC5maWxlcy5hY3Rpb24uY29uZmlndXJlU2F2ZUNvbmZsaWN0JywgbG9jYWxpemUoJ2NvbmZpZ3VyZScsIFwiQ29uZmlndXJlXCIpKTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLnByZWZlcmVuY2VzU2VydmljZS5vcGVuU2V0dGluZ3MoeyBxdWVyeTogJ2ZpbGVzLnNhdmVDb25mbGljdFJlc29sdXRpb24nIH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBhY2NlcHRMb2NhbENoYW5nZXNDb21tYW5kID0gKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCByZXNvdXJjZTogVVJJKSA9PiB7XG5cdHJldHVybiBhY2NlcHRPclJldmVydExvY2FsQ2hhbmdlc0NvbW1hbmQoYWNjZXNzb3IsIHJlc291cmNlLCB0cnVlKTtcbn07XG5cbmV4cG9ydCBjb25zdCByZXZlcnRMb2NhbENoYW5nZXNDb21tYW5kID0gKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCByZXNvdXJjZTogVVJJKSA9PiB7XG5cdHJldHVybiBhY2NlcHRPclJldmVydExvY2FsQ2hhbmdlc0NvbW1hbmQoYWNjZXNzb3IsIHJlc291cmNlLCBmYWxzZSk7XG59O1xuXG5hc3luYyBmdW5jdGlvbiBhY2NlcHRPclJldmVydExvY2FsQ2hhbmdlc0NvbW1hbmQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHJlc291cmNlOiBVUkksIGFjY2VwdDogYm9vbGVhbikge1xuXHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblxuXHRjb25zdCBlZGl0b3JQYW5lID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lO1xuXHRpZiAoIWVkaXRvclBhbmUpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRjb25zdCBlZGl0b3IgPSBlZGl0b3JQYW5lLmlucHV0O1xuXHRjb25zdCBncm91cCA9IGVkaXRvclBhbmUuZ3JvdXA7XG5cblx0Ly8gSGlkZSBhbnkgcHJldmlvdXNseSBzaG93biBtZXNzYWdlIGFib3V0IGhvdyB0byB1c2UgdGhlc2UgYWN0aW9uc1xuXHRjbGVhclBlbmRpbmdSZXNvbHZlU2F2ZUNvbmZsaWN0TWVzc2FnZXMoKTtcblxuXHQvLyBBY2NlcHQgb3IgcmV2ZXJ0XG5cdGlmIChhY2NlcHQpIHtcblx0XHRjb25zdCBvcHRpb25zOiBJVGV4dEZpbGVTYXZlQXNPcHRpb25zID0geyBpZ25vcmVNb2RpZmllZFNpbmNlOiB0cnVlLCByZWFzb246IFNhdmVSZWFzb24uRVhQTElDSVQgfTtcblx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLnNhdmUoeyBlZGl0b3IsIGdyb3VwSWQ6IGdyb3VwLmlkIH0sIG9wdGlvbnMpO1xuXHR9IGVsc2Uge1xuXHRcdGF3YWl0IGVkaXRvclNlcnZpY2UucmV2ZXJ0KHsgZWRpdG9yLCBncm91cElkOiBncm91cC5pZCB9KTtcblx0fVxuXG5cdC8vIFJlb3BlbiBvcmlnaW5hbCBlZGl0b3Jcblx0YXdhaXQgZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHsgcmVzb3VyY2UgfSwgZ3JvdXApO1xuXG5cdC8vIENsZWFuIHVwXG5cdHJldHVybiBncm91cC5jbG9zZUVkaXRvcihlZGl0b3IpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFVBQVUsZUFBZTtBQUNsQyxTQUFTLGNBQWM7QUFDdkIsU0FBUyxXQUFXO0FBQ3BCLFNBQTZCLDJCQUE4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
