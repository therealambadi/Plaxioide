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
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { toDisposable } from "../../../../base/common/lifecycle.js";
import { LinkedList } from "../../../../base/common/linkedList.js";
import { ResourceMap, ResourceSet } from "../../../../base/common/map.js";
import { isCodeEditor, isDiffEditor } from "../../../../editor/browser/editorBrowser.js";
import { IBulkEditService, ResourceFileEdit, ResourceTextEdit } from "../../../../editor/browser/services/bulkEditService.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Extensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Progress } from "../../../../platform/progress/common/progress.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { UndoRedoGroup } from "../../../../platform/undoRedo/common/undoRedo.js";
import { BulkCellEdits, ResourceNotebookCellEdit } from "./bulkCellEdits.js";
import { BulkFileEdits } from "./bulkFileEdits.js";
import { BulkTextEdits } from "./bulkTextEdits.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ILifecycleService, ShutdownReason } from "../../../services/lifecycle/common/lifecycle.js";
import { IWorkingCopyService } from "../../../services/workingCopy/common/workingCopyService.js";
import { OpaqueEdits, ResourceAttachmentEdit } from "./opaqueEdits.js";
function liftEdits(edits) {
  return edits.map((edit) => {
    if (ResourceTextEdit.is(edit)) {
      return ResourceTextEdit.lift(edit);
    }
    if (ResourceFileEdit.is(edit)) {
      return ResourceFileEdit.lift(edit);
    }
    if (ResourceNotebookCellEdit.is(edit)) {
      return ResourceNotebookCellEdit.lift(edit);
    }
    if (ResourceAttachmentEdit.is(edit)) {
      return ResourceAttachmentEdit.lift(edit);
    }
    throw new Error("Unsupported edit");
  });
}
let BulkEdit = class {
  constructor(_label, _code, _editor, _progress, _token, _edits, _undoRedoGroup, _undoRedoSource, _confirmBeforeUndo, _instaService, _logService) {
    this._label = _label;
    this._code = _code;
    this._editor = _editor;
    this._progress = _progress;
    this._token = _token;
    this._edits = _edits;
    this._undoRedoGroup = _undoRedoGroup;
    this._undoRedoSource = _undoRedoSource;
    this._confirmBeforeUndo = _confirmBeforeUndo;
    this._instaService = _instaService;
    this._logService = _logService;
  }
  ariaMessage() {
    const otherResources = new ResourceMap();
    const textEditResources = new ResourceMap();
    let textEditCount = 0;
    for (const edit of this._edits) {
      if (edit instanceof ResourceTextEdit) {
        textEditCount += 1;
        textEditResources.set(edit.resource, true);
      } else if (edit instanceof ResourceFileEdit) {
        otherResources.set(edit.oldResource ?? edit.newResource, true);
      }
    }
    if (this._edits.length === 0) {
      return localize("summary.0", "Made no edits");
    } else if (otherResources.size === 0) {
      if (textEditCount > 1 && textEditResources.size > 1) {
        return localize("summary.nm", "Made {0} text edits in {1} files", textEditCount, textEditResources.size);
      } else {
        return localize("summary.n0", "Made {0} text edits in one file", textEditCount);
      }
    } else {
      return localize("summary.textFiles", "Made {0} text edits in {1} files, also created or deleted {2} files", textEditCount, textEditResources.size, otherResources.size);
    }
  }
  async perform() {
    if (this._edits.length === 0) {
      return [];
    }
    const ranges = [1];
    for (let i = 1; i < this._edits.length; i++) {
      if (Object.getPrototypeOf(this._edits[i - 1]) === Object.getPrototypeOf(this._edits[i])) {
        ranges[ranges.length - 1]++;
      } else {
        ranges.push(1);
      }
    }
    const increment = this._edits.length > 1 ? 0 : void 0;
    this._progress.report({ increment, total: 100 });
    const progress = { report: (_) => this._progress.report({ increment: 100 / this._edits.length }) };
    const resources = [];
    let index = 0;
    for (const range of ranges) {
      if (this._token.isCancellationRequested) {
        break;
      }
      const group = this._edits.slice(index, index + range);
      if (group[0] instanceof ResourceFileEdit) {
        resources.push(await this._performFileEdits(group, this._undoRedoGroup, this._undoRedoSource, this._confirmBeforeUndo, progress));
      } else if (group[0] instanceof ResourceTextEdit) {
        resources.push(await this._performTextEdits(group, this._undoRedoGroup, this._undoRedoSource, progress));
      } else if (group[0] instanceof ResourceNotebookCellEdit) {
        resources.push(await this._performCellEdits(group, this._undoRedoGroup, this._undoRedoSource, progress));
      } else if (group[0] instanceof ResourceAttachmentEdit) {
        resources.push(await this._performOpaqueEdits(group, this._undoRedoGroup, this._undoRedoSource, progress));
      } else {
        console.log("UNKNOWN EDIT");
      }
      index = index + range;
    }
    return resources.flat();
  }
  async _performFileEdits(edits, undoRedoGroup, undoRedoSource, confirmBeforeUndo, progress) {
    this._logService.debug("_performFileEdits", JSON.stringify(edits));
    const model = this._instaService.createInstance(BulkFileEdits, this._label || localize("workspaceEdit", "Workspace Edit"), this._code || "undoredo.workspaceEdit", undoRedoGroup, undoRedoSource, confirmBeforeUndo, progress, this._token, edits);
    return await model.apply();
  }
  async _performTextEdits(edits, undoRedoGroup, undoRedoSource, progress) {
    this._logService.debug("_performTextEdits", JSON.stringify(edits));
    const model = this._instaService.createInstance(BulkTextEdits, this._label || localize("workspaceEdit", "Workspace Edit"), this._code || "undoredo.workspaceEdit", this._editor, undoRedoGroup, undoRedoSource, progress, this._token, edits);
    return await model.apply();
  }
  async _performCellEdits(edits, undoRedoGroup, undoRedoSource, progress) {
    this._logService.debug("_performCellEdits", JSON.stringify(edits));
    const model = this._instaService.createInstance(BulkCellEdits, undoRedoGroup, undoRedoSource, progress, this._token, edits);
    return await model.apply();
  }
  async _performOpaqueEdits(edits, undoRedoGroup, undoRedoSource, progress) {
    this._logService.debug("_performOpaqueEdits", JSON.stringify(edits));
    const model = this._instaService.createInstance(OpaqueEdits, undoRedoGroup, undoRedoSource, progress, this._token, edits);
    return await model.apply();
  }
};
BulkEdit = __decorateClass([
  __decorateParam(9, IInstantiationService),
  __decorateParam(10, ILogService)
], BulkEdit);
let BulkEditService = class {
  constructor(_instaService, _logService, _editorService, _lifecycleService, _dialogService, _workingCopyService, _configService) {
    this._instaService = _instaService;
    this._logService = _logService;
    this._editorService = _editorService;
    this._lifecycleService = _lifecycleService;
    this._dialogService = _dialogService;
    this._workingCopyService = _workingCopyService;
    this._configService = _configService;
    this._activeUndoRedoGroups = new LinkedList();
  }
  setPreviewHandler(handler) {
    this._previewHandler = handler;
    return toDisposable(() => {
      if (this._previewHandler === handler) {
        this._previewHandler = void 0;
      }
    });
  }
  hasPreviewHandler() {
    return Boolean(this._previewHandler);
  }
  async apply(editsIn, options) {
    let edits = liftEdits(Array.isArray(editsIn) ? editsIn : editsIn.edits);
    if (edits.length === 0) {
      return { ariaSummary: localize("nothing", "Made no edits"), isApplied: false };
    }
    if (this._previewHandler && (options?.showPreview || edits.some((value) => value.metadata?.needsConfirmation))) {
      edits = await this._previewHandler(edits, options);
    }
    let codeEditor = options?.editor;
    if (!codeEditor) {
      const candidate = this._editorService.activeTextEditorControl;
      if (isCodeEditor(candidate)) {
        codeEditor = candidate;
      } else if (isDiffEditor(candidate)) {
        codeEditor = candidate.getModifiedEditor();
      }
    }
    if (codeEditor && codeEditor.getOption(EditorOption.readOnly)) {
      codeEditor = void 0;
    }
    let undoRedoGroup;
    let undoRedoGroupRemove = () => {
    };
    if (typeof options?.undoRedoGroupId === "number") {
      for (const candidate of this._activeUndoRedoGroups) {
        if (candidate.id === options.undoRedoGroupId) {
          undoRedoGroup = candidate;
          break;
        }
      }
    }
    if (!undoRedoGroup) {
      undoRedoGroup = new UndoRedoGroup();
      undoRedoGroupRemove = this._activeUndoRedoGroups.push(undoRedoGroup);
    }
    const label = options?.quotableLabel || options?.label;
    const bulkEdit = this._instaService.createInstance(
      BulkEdit,
      label,
      options?.code,
      codeEditor,
      options?.progress ?? Progress.None,
      options?.token ?? CancellationToken.None,
      edits,
      undoRedoGroup,
      options?.undoRedoSource,
      !!options?.confirmBeforeUndo
    );
    let listener;
    try {
      listener = this._lifecycleService.onBeforeShutdown((e) => e.veto(this._shouldVeto(label, e.reason), "veto.blukEditService"));
      const resources = await bulkEdit.perform();
      if (options?.respectAutoSaveConfig && this._configService.getValue(autoSaveSetting) === true && resources.length > 1) {
        await this._saveAll(resources);
      }
      return { ariaSummary: bulkEdit.ariaMessage(), isApplied: edits.length > 0 };
    } catch (err) {
      this._logService.error(err);
      throw err;
    } finally {
      listener?.dispose();
      undoRedoGroupRemove();
    }
  }
  async _saveAll(resources) {
    const set = new ResourceSet(resources);
    const saves = this._workingCopyService.dirtyWorkingCopies.map(async (copy) => {
      if (set.has(copy.resource)) {
        await copy.save();
      }
    });
    const result = await Promise.allSettled(saves);
    for (const item of result) {
      if (item.status === "rejected") {
        this._logService.warn(item.reason);
      }
    }
  }
  async _shouldVeto(label, reason) {
    let message;
    let primaryButton;
    switch (reason) {
      case ShutdownReason.CLOSE:
        message = localize("closeTheWindow.message", "Are you sure you want to close the window?");
        primaryButton = localize({ key: "closeTheWindow", comment: ["&& denotes a mnemonic"] }, "&&Close Window");
        break;
      case ShutdownReason.LOAD:
        message = localize("changeWorkspace.message", "Are you sure you want to change the workspace?");
        primaryButton = localize({ key: "changeWorkspace", comment: ["&& denotes a mnemonic"] }, "Change &&Workspace");
        break;
      case ShutdownReason.RELOAD:
        message = localize("reloadTheWindow.message", "Are you sure you want to reload the window?");
        primaryButton = localize({ key: "reloadTheWindow", comment: ["&& denotes a mnemonic"] }, "&&Reload Window");
        break;
      default:
        message = localize("quit.message", "Are you sure you want to quit?");
        primaryButton = localize({ key: "quit", comment: ["&& denotes a mnemonic"] }, "&&Quit");
        break;
    }
    const result = await this._dialogService.confirm({
      message,
      detail: localize("areYouSureQuiteBulkEdit.detail", "'{0}' is in progress.", label || localize("fileOperation", "File operation")),
      primaryButton
    });
    return !result.confirmed;
  }
};
BulkEditService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, ILifecycleService),
  __decorateParam(4, IDialogService),
  __decorateParam(5, IWorkingCopyService),
  __decorateParam(6, IConfigurationService)
], BulkEditService);
registerSingleton(IBulkEditService, BulkEditService, InstantiationType.Delayed);
const autoSaveSetting = "files.refactoring.autoSave";
Registry.as(Extensions.Configuration).registerConfiguration({
  id: "files",
  properties: {
    [autoSaveSetting]: {
      description: localize("refactoring.autoSave", "Controls if files that were part of a refactoring are saved automatically"),
      default: true,
      type: "boolean"
    }
  }
});
export {
  BulkEditService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9idWxrRWRpdC9icm93c2VyL2J1bGtFZGl0U2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTGlua2VkTGlzdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpbmtlZExpc3QuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAsIFJlc291cmNlU2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciwgaXNDb2RlRWRpdG9yLCBpc0RpZmZFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IElCdWxrRWRpdE9wdGlvbnMsIElCdWxrRWRpdFByZXZpZXdIYW5kbGVyLCBJQnVsa0VkaXRSZXN1bHQsIElCdWxrRWRpdFNlcnZpY2UsIFJlc291cmNlRWRpdCwgUmVzb3VyY2VGaWxlRWRpdCwgUmVzb3VyY2VUZXh0RWRpdCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2J1bGtFZGl0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IFdvcmtzcGFjZUVkaXQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMsIElDb25maWd1cmF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElQcm9ncmVzcywgSVByb2dyZXNzU3RlcCwgUHJvZ3Jlc3MgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgVW5kb1JlZG9Hcm91cCwgVW5kb1JlZG9Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91bmRvUmVkby9jb21tb24vdW5kb1JlZG8uanMnO1xuaW1wb3J0IHsgQnVsa0NlbGxFZGl0cywgUmVzb3VyY2VOb3RlYm9va0NlbGxFZGl0IH0gZnJvbSAnLi9idWxrQ2VsbEVkaXRzLmpzJztcbmltcG9ydCB7IEJ1bGtGaWxlRWRpdHMgfSBmcm9tICcuL2J1bGtGaWxlRWRpdHMuanMnO1xuaW1wb3J0IHsgQnVsa1RleHRFZGl0cyB9IGZyb20gJy4vYnVsa1RleHRFZGl0cy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlU2VydmljZSwgU2h1dGRvd25SZWFzb24gfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBPcGFxdWVFZGl0cywgUmVzb3VyY2VBdHRhY2htZW50RWRpdCB9IGZyb20gJy4vb3BhcXVlRWRpdHMuanMnO1xuXG5mdW5jdGlvbiBsaWZ0RWRpdHMoZWRpdHM6IFJlc291cmNlRWRpdFtdKTogUmVzb3VyY2VFZGl0W10ge1xuXHRyZXR1cm4gZWRpdHMubWFwKGVkaXQgPT4ge1xuXHRcdGlmIChSZXNvdXJjZVRleHRFZGl0LmlzKGVkaXQpKSB7XG5cdFx0XHRyZXR1cm4gUmVzb3VyY2VUZXh0RWRpdC5saWZ0KGVkaXQpO1xuXHRcdH1cblx0XHRpZiAoUmVzb3VyY2VGaWxlRWRpdC5pcyhlZGl0KSkge1xuXHRcdFx0cmV0dXJuIFJlc291cmNlRmlsZUVkaXQubGlmdChlZGl0KTtcblx0XHR9XG5cdFx0aWYgKFJlc291cmNlTm90ZWJvb2tDZWxsRWRpdC5pcyhlZGl0KSkge1xuXHRcdFx0cmV0dXJuIFJlc291cmNlTm90ZWJvb2tDZWxsRWRpdC5saWZ0KGVkaXQpO1xuXHRcdH1cblxuXHRcdGlmIChSZXNvdXJjZUF0dGFjaG1lbnRFZGl0LmlzKGVkaXQpKSB7XG5cdFx0XHRyZXR1cm4gUmVzb3VyY2VBdHRhY2htZW50RWRpdC5saWZ0KGVkaXQpO1xuXHRcdH1cblxuXHRcdHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQgZWRpdCcpO1xuXHR9KTtcbn1cblxuY2xhc3MgQnVsa0VkaXQge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xhYmVsOiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY29kZTogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3IgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcHJvZ3Jlc3M6IElQcm9ncmVzczxJUHJvZ3Jlc3NTdGVwPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF90b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdHM6IFJlc291cmNlRWRpdFtdLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3VuZG9SZWRvR3JvdXA6IFVuZG9SZWRvR3JvdXAsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdW5kb1JlZG9Tb3VyY2U6IFVuZG9SZWRvU291cmNlIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpcm1CZWZvcmVVbmRvOiBib29sZWFuLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFTZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblxuXHR9XG5cblx0YXJpYU1lc3NhZ2UoKTogc3RyaW5nIHtcblxuXHRcdGNvbnN0IG90aGVyUmVzb3VyY2VzID0gbmV3IFJlc291cmNlTWFwPGJvb2xlYW4+KCk7XG5cdFx0Y29uc3QgdGV4dEVkaXRSZXNvdXJjZXMgPSBuZXcgUmVzb3VyY2VNYXA8Ym9vbGVhbj4oKTtcblx0XHRsZXQgdGV4dEVkaXRDb3VudCA9IDA7XG5cdFx0Zm9yIChjb25zdCBlZGl0IG9mIHRoaXMuX2VkaXRzKSB7XG5cdFx0XHRpZiAoZWRpdCBpbnN0YW5jZW9mIFJlc291cmNlVGV4dEVkaXQpIHtcblx0XHRcdFx0dGV4dEVkaXRDb3VudCArPSAxO1xuXHRcdFx0XHR0ZXh0RWRpdFJlc291cmNlcy5zZXQoZWRpdC5yZXNvdXJjZSwgdHJ1ZSk7XG5cdFx0XHR9IGVsc2UgaWYgKGVkaXQgaW5zdGFuY2VvZiBSZXNvdXJjZUZpbGVFZGl0KSB7XG5cdFx0XHRcdG90aGVyUmVzb3VyY2VzLnNldChlZGl0Lm9sZFJlc291cmNlID8/IGVkaXQubmV3UmVzb3VyY2UhLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKHRoaXMuX2VkaXRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCdzdW1tYXJ5LjAnLCBcIk1hZGUgbm8gZWRpdHNcIik7XG5cdFx0fSBlbHNlIGlmIChvdGhlclJlc291cmNlcy5zaXplID09PSAwKSB7XG5cdFx0XHRpZiAodGV4dEVkaXRDb3VudCA+IDEgJiYgdGV4dEVkaXRSZXNvdXJjZXMuc2l6ZSA+IDEpIHtcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdzdW1tYXJ5Lm5tJywgXCJNYWRlIHswfSB0ZXh0IGVkaXRzIGluIHsxfSBmaWxlc1wiLCB0ZXh0RWRpdENvdW50LCB0ZXh0RWRpdFJlc291cmNlcy5zaXplKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgnc3VtbWFyeS5uMCcsIFwiTWFkZSB7MH0gdGV4dCBlZGl0cyBpbiBvbmUgZmlsZVwiLCB0ZXh0RWRpdENvdW50KTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCdzdW1tYXJ5LnRleHRGaWxlcycsIFwiTWFkZSB7MH0gdGV4dCBlZGl0cyBpbiB7MX0gZmlsZXMsIGFsc28gY3JlYXRlZCBvciBkZWxldGVkIHsyfSBmaWxlc1wiLCB0ZXh0RWRpdENvdW50LCB0ZXh0RWRpdFJlc291cmNlcy5zaXplLCBvdGhlclJlc291cmNlcy5zaXplKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBwZXJmb3JtKCk6IFByb21pc2U8cmVhZG9ubHkgVVJJW10+IHtcblxuXHRcdGlmICh0aGlzLl9lZGl0cy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRjb25zdCByYW5nZXM6IG51bWJlcltdID0gWzFdO1xuXHRcdGZvciAobGV0IGkgPSAxOyBpIDwgdGhpcy5fZWRpdHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmIChPYmplY3QuZ2V0UHJvdG90eXBlT2YodGhpcy5fZWRpdHNbaSAtIDFdKSA9PT0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHRoaXMuX2VkaXRzW2ldKSkge1xuXHRcdFx0XHRyYW5nZXNbcmFuZ2VzLmxlbmd0aCAtIDFdKys7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyYW5nZXMucHVzaCgxKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBTaG93IGluZmludGUgcHJvZ3Jlc3Mgd2hlbiB0aGVyZSBpcyBvbmx5IDEgaXRlbSBzaW5jZSB3ZSBkbyBub3Qga25vdyBob3cgbG9uZyBpdCB0YWtlc1xuXHRcdGNvbnN0IGluY3JlbWVudCA9IHRoaXMuX2VkaXRzLmxlbmd0aCA+IDEgPyAwIDogdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3Byb2dyZXNzLnJlcG9ydCh7IGluY3JlbWVudCwgdG90YWw6IDEwMCB9KTtcblx0XHQvLyBJbmNyZW1lbnQgYnkgcGVyY2VudGFnZSBwb2ludHMgc2luY2UgcHJvZ3Jlc3MgQVBJIGV4cGVjdHMgdGhhdFxuXHRcdGNvbnN0IHByb2dyZXNzOiBJUHJvZ3Jlc3M8dm9pZD4gPSB7IHJlcG9ydDogXyA9PiB0aGlzLl9wcm9ncmVzcy5yZXBvcnQoeyBpbmNyZW1lbnQ6IDEwMCAvIHRoaXMuX2VkaXRzLmxlbmd0aCB9KSB9O1xuXG5cdFx0Y29uc3QgcmVzb3VyY2VzOiAocmVhZG9ubHkgVVJJW10pW10gPSBbXTtcblx0XHRsZXQgaW5kZXggPSAwO1xuXHRcdGZvciAoY29uc3QgcmFuZ2Ugb2YgcmFuZ2VzKSB7XG5cdFx0XHRpZiAodGhpcy5fdG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBncm91cCA9IHRoaXMuX2VkaXRzLnNsaWNlKGluZGV4LCBpbmRleCArIHJhbmdlKTtcblx0XHRcdGlmIChncm91cFswXSBpbnN0YW5jZW9mIFJlc291cmNlRmlsZUVkaXQpIHtcblx0XHRcdFx0cmVzb3VyY2VzLnB1c2goYXdhaXQgdGhpcy5fcGVyZm9ybUZpbGVFZGl0cyg8UmVzb3VyY2VGaWxlRWRpdFtdPmdyb3VwLCB0aGlzLl91bmRvUmVkb0dyb3VwLCB0aGlzLl91bmRvUmVkb1NvdXJjZSwgdGhpcy5fY29uZmlybUJlZm9yZVVuZG8sIHByb2dyZXNzKSk7XG5cdFx0XHR9IGVsc2UgaWYgKGdyb3VwWzBdIGluc3RhbmNlb2YgUmVzb3VyY2VUZXh0RWRpdCkge1xuXHRcdFx0XHRyZXNvdXJjZXMucHVzaChhd2FpdCB0aGlzLl9wZXJmb3JtVGV4dEVkaXRzKDxSZXNvdXJjZVRleHRFZGl0W10+Z3JvdXAsIHRoaXMuX3VuZG9SZWRvR3JvdXAsIHRoaXMuX3VuZG9SZWRvU291cmNlLCBwcm9ncmVzcykpO1xuXHRcdFx0fSBlbHNlIGlmIChncm91cFswXSBpbnN0YW5jZW9mIFJlc291cmNlTm90ZWJvb2tDZWxsRWRpdCkge1xuXHRcdFx0XHRyZXNvdXJjZXMucHVzaChhd2FpdCB0aGlzLl9wZXJmb3JtQ2VsbEVkaXRzKDxSZXNvdXJjZU5vdGVib29rQ2VsbEVkaXRbXT5ncm91cCwgdGhpcy5fdW5kb1JlZG9Hcm91cCwgdGhpcy5fdW5kb1JlZG9Tb3VyY2UsIHByb2dyZXNzKSk7XG5cdFx0XHR9IGVsc2UgaWYgKGdyb3VwWzBdIGluc3RhbmNlb2YgUmVzb3VyY2VBdHRhY2htZW50RWRpdCkge1xuXHRcdFx0XHRyZXNvdXJjZXMucHVzaChhd2FpdCB0aGlzLl9wZXJmb3JtT3BhcXVlRWRpdHMoPFJlc291cmNlQXR0YWNobWVudEVkaXRbXT5ncm91cCwgdGhpcy5fdW5kb1JlZG9Hcm91cCwgdGhpcy5fdW5kb1JlZG9Tb3VyY2UsIHByb2dyZXNzKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zb2xlLmxvZygnVU5LTk9XTiBFRElUJyk7XG5cdFx0XHR9XG5cdFx0XHRpbmRleCA9IGluZGV4ICsgcmFuZ2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc291cmNlcy5mbGF0KCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9wZXJmb3JtRmlsZUVkaXRzKGVkaXRzOiBSZXNvdXJjZUZpbGVFZGl0W10sIHVuZG9SZWRvR3JvdXA6IFVuZG9SZWRvR3JvdXAsIHVuZG9SZWRvU291cmNlOiBVbmRvUmVkb1NvdXJjZSB8IHVuZGVmaW5lZCwgY29uZmlybUJlZm9yZVVuZG86IGJvb2xlYW4sIHByb2dyZXNzOiBJUHJvZ3Jlc3M8dm9pZD4pOiBQcm9taXNlPHJlYWRvbmx5IFVSSVtdPiB7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZygnX3BlcmZvcm1GaWxlRWRpdHMnLCBKU09OLnN0cmluZ2lmeShlZGl0cykpO1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5faW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEJ1bGtGaWxlRWRpdHMsIHRoaXMuX2xhYmVsIHx8IGxvY2FsaXplKCd3b3Jrc3BhY2VFZGl0JywgXCJXb3Jrc3BhY2UgRWRpdFwiKSwgdGhpcy5fY29kZSB8fCAndW5kb3JlZG8ud29ya3NwYWNlRWRpdCcsIHVuZG9SZWRvR3JvdXAsIHVuZG9SZWRvU291cmNlLCBjb25maXJtQmVmb3JlVW5kbywgcHJvZ3Jlc3MsIHRoaXMuX3Rva2VuLCBlZGl0cyk7XG5cdFx0cmV0dXJuIGF3YWl0IG1vZGVsLmFwcGx5KCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9wZXJmb3JtVGV4dEVkaXRzKGVkaXRzOiBSZXNvdXJjZVRleHRFZGl0W10sIHVuZG9SZWRvR3JvdXA6IFVuZG9SZWRvR3JvdXAsIHVuZG9SZWRvU291cmNlOiBVbmRvUmVkb1NvdXJjZSB8IHVuZGVmaW5lZCwgcHJvZ3Jlc3M6IElQcm9ncmVzczx2b2lkPik6IFByb21pc2U8cmVhZG9ubHkgVVJJW10+IHtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLmRlYnVnKCdfcGVyZm9ybVRleHRFZGl0cycsIEpTT04uc3RyaW5naWZ5KGVkaXRzKSk7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9pbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQnVsa1RleHRFZGl0cywgdGhpcy5fbGFiZWwgfHwgbG9jYWxpemUoJ3dvcmtzcGFjZUVkaXQnLCBcIldvcmtzcGFjZSBFZGl0XCIpLCB0aGlzLl9jb2RlIHx8ICd1bmRvcmVkby53b3Jrc3BhY2VFZGl0JywgdGhpcy5fZWRpdG9yLCB1bmRvUmVkb0dyb3VwLCB1bmRvUmVkb1NvdXJjZSwgcHJvZ3Jlc3MsIHRoaXMuX3Rva2VuLCBlZGl0cyk7XG5cdFx0cmV0dXJuIGF3YWl0IG1vZGVsLmFwcGx5KCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9wZXJmb3JtQ2VsbEVkaXRzKGVkaXRzOiBSZXNvdXJjZU5vdGVib29rQ2VsbEVkaXRbXSwgdW5kb1JlZG9Hcm91cDogVW5kb1JlZG9Hcm91cCwgdW5kb1JlZG9Tb3VyY2U6IFVuZG9SZWRvU291cmNlIHwgdW5kZWZpbmVkLCBwcm9ncmVzczogSVByb2dyZXNzPHZvaWQ+KTogUHJvbWlzZTxyZWFkb25seSBVUklbXT4ge1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoJ19wZXJmb3JtQ2VsbEVkaXRzJywgSlNPTi5zdHJpbmdpZnkoZWRpdHMpKTtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2luc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShCdWxrQ2VsbEVkaXRzLCB1bmRvUmVkb0dyb3VwLCB1bmRvUmVkb1NvdXJjZSwgcHJvZ3Jlc3MsIHRoaXMuX3Rva2VuLCBlZGl0cyk7XG5cdFx0cmV0dXJuIGF3YWl0IG1vZGVsLmFwcGx5KCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9wZXJmb3JtT3BhcXVlRWRpdHMoZWRpdHM6IFJlc291cmNlQXR0YWNobWVudEVkaXRbXSwgdW5kb1JlZG9Hcm91cDogVW5kb1JlZG9Hcm91cCwgdW5kb1JlZG9Tb3VyY2U6IFVuZG9SZWRvU291cmNlIHwgdW5kZWZpbmVkLCBwcm9ncmVzczogSVByb2dyZXNzPHZvaWQ+KTogUHJvbWlzZTxyZWFkb25seSBVUklbXT4ge1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoJ19wZXJmb3JtT3BhcXVlRWRpdHMnLCBKU09OLnN0cmluZ2lmeShlZGl0cykpO1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5faW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE9wYXF1ZUVkaXRzLCB1bmRvUmVkb0dyb3VwLCB1bmRvUmVkb1NvdXJjZSwgcHJvZ3Jlc3MsIHRoaXMuX3Rva2VuLCBlZGl0cyk7XG5cdFx0cmV0dXJuIGF3YWl0IG1vZGVsLmFwcGx5KCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEJ1bGtFZGl0U2VydmljZSBpbXBsZW1lbnRzIElCdWxrRWRpdFNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2FjdGl2ZVVuZG9SZWRvR3JvdXBzID0gbmV3IExpbmtlZExpc3Q8VW5kb1JlZG9Hcm91cD4oKTtcblx0cHJpdmF0ZSBfcHJldmlld0hhbmRsZXI/OiBJQnVsa0VkaXRQcmV2aWV3SGFuZGxlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xpZmVjeWNsZVNlcnZpY2U6IElMaWZlY3ljbGVTZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9kaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASVdvcmtpbmdDb3B5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF93b3JraW5nQ29weVNlcnZpY2U6IElXb3JraW5nQ29weVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWdTZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkgeyB9XG5cblx0c2V0UHJldmlld0hhbmRsZXIoaGFuZGxlcjogSUJ1bGtFZGl0UHJldmlld0hhbmRsZXIpOiBJRGlzcG9zYWJsZSB7XG5cdFx0dGhpcy5fcHJldmlld0hhbmRsZXIgPSBoYW5kbGVyO1xuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX3ByZXZpZXdIYW5kbGVyID09PSBoYW5kbGVyKSB7XG5cdFx0XHRcdHRoaXMuX3ByZXZpZXdIYW5kbGVyID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0aGFzUHJldmlld0hhbmRsZXIoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIEJvb2xlYW4odGhpcy5fcHJldmlld0hhbmRsZXIpO1xuXHR9XG5cblx0YXN5bmMgYXBwbHkoZWRpdHNJbjogUmVzb3VyY2VFZGl0W10gfCBXb3Jrc3BhY2VFZGl0LCBvcHRpb25zPzogSUJ1bGtFZGl0T3B0aW9ucyk6IFByb21pc2U8SUJ1bGtFZGl0UmVzdWx0PiB7XG5cdFx0bGV0IGVkaXRzID0gbGlmdEVkaXRzKEFycmF5LmlzQXJyYXkoZWRpdHNJbikgPyBlZGl0c0luIDogZWRpdHNJbi5lZGl0cyk7XG5cblx0XHRpZiAoZWRpdHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4geyBhcmlhU3VtbWFyeTogbG9jYWxpemUoJ25vdGhpbmcnLCBcIk1hZGUgbm8gZWRpdHNcIiksIGlzQXBwbGllZDogZmFsc2UgfTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fcHJldmlld0hhbmRsZXIgJiYgKG9wdGlvbnM/LnNob3dQcmV2aWV3IHx8IGVkaXRzLnNvbWUodmFsdWUgPT4gdmFsdWUubWV0YWRhdGE/Lm5lZWRzQ29uZmlybWF0aW9uKSkpIHtcblx0XHRcdGVkaXRzID0gYXdhaXQgdGhpcy5fcHJldmlld0hhbmRsZXIoZWRpdHMsIG9wdGlvbnMpO1xuXHRcdH1cblxuXHRcdGxldCBjb2RlRWRpdG9yID0gb3B0aW9ucz8uZWRpdG9yO1xuXHRcdC8vIHRyeSB0byBmaW5kIGNvZGUgZWRpdG9yXG5cdFx0aWYgKCFjb2RlRWRpdG9yKSB7XG5cdFx0XHRjb25zdCBjYW5kaWRhdGUgPSB0aGlzLl9lZGl0b3JTZXJ2aWNlLmFjdGl2ZVRleHRFZGl0b3JDb250cm9sO1xuXHRcdFx0aWYgKGlzQ29kZUVkaXRvcihjYW5kaWRhdGUpKSB7XG5cdFx0XHRcdGNvZGVFZGl0b3IgPSBjYW5kaWRhdGU7XG5cdFx0XHR9IGVsc2UgaWYgKGlzRGlmZkVkaXRvcihjYW5kaWRhdGUpKSB7XG5cdFx0XHRcdGNvZGVFZGl0b3IgPSBjYW5kaWRhdGUuZ2V0TW9kaWZpZWRFZGl0b3IoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoY29kZUVkaXRvciAmJiBjb2RlRWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ucmVhZE9ubHkpKSB7XG5cdFx0XHQvLyBJZiB0aGUgY29kZSBlZGl0b3IgaXMgcmVhZG9ubHkgc3RpbGwgYWxsb3cgYnVsayBlZGl0cyB0byBiZSBhcHBsaWVkICM2ODU0OVxuXHRcdFx0Y29kZUVkaXRvciA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHQvLyB1bmRvLXJlZG8tZ3JvdXA6IGlmIGEgZ3JvdXAgaWQgaXMgcGFzc2VkIHRoZW4gdHJ5IHRvIGZpbmQgaXRcblx0XHQvLyBpbiB0aGUgbGlzdCBvZiBhY3RpdmUgZWRpdHMuIG90aGVyd2lzZSAob3Igd2hlbiBub3QgZm91bmQpXG5cdFx0Ly8gY3JlYXRlIGEgc2VwYXJhdGUgdW5kby1yZWRvLWdyb3VwXG5cdFx0bGV0IHVuZG9SZWRvR3JvdXA6IFVuZG9SZWRvR3JvdXAgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IHVuZG9SZWRvR3JvdXBSZW1vdmUgPSAoKSA9PiB7IH07XG5cdFx0aWYgKHR5cGVvZiBvcHRpb25zPy51bmRvUmVkb0dyb3VwSWQgPT09ICdudW1iZXInKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGNhbmRpZGF0ZSBvZiB0aGlzLl9hY3RpdmVVbmRvUmVkb0dyb3Vwcykge1xuXHRcdFx0XHRpZiAoY2FuZGlkYXRlLmlkID09PSBvcHRpb25zLnVuZG9SZWRvR3JvdXBJZCkge1xuXHRcdFx0XHRcdHVuZG9SZWRvR3JvdXAgPSBjYW5kaWRhdGU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKCF1bmRvUmVkb0dyb3VwKSB7XG5cdFx0XHR1bmRvUmVkb0dyb3VwID0gbmV3IFVuZG9SZWRvR3JvdXAoKTtcblx0XHRcdHVuZG9SZWRvR3JvdXBSZW1vdmUgPSB0aGlzLl9hY3RpdmVVbmRvUmVkb0dyb3Vwcy5wdXNoKHVuZG9SZWRvR3JvdXApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxhYmVsID0gb3B0aW9ucz8ucXVvdGFibGVMYWJlbCB8fCBvcHRpb25zPy5sYWJlbDtcblx0XHRjb25zdCBidWxrRWRpdCA9IHRoaXMuX2luc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdEJ1bGtFZGl0LFxuXHRcdFx0bGFiZWwsXG5cdFx0XHRvcHRpb25zPy5jb2RlLFxuXHRcdFx0Y29kZUVkaXRvcixcblx0XHRcdG9wdGlvbnM/LnByb2dyZXNzID8/IFByb2dyZXNzLk5vbmUsXG5cdFx0XHRvcHRpb25zPy50b2tlbiA/PyBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lLFxuXHRcdFx0ZWRpdHMsXG5cdFx0XHR1bmRvUmVkb0dyb3VwLFxuXHRcdFx0b3B0aW9ucz8udW5kb1JlZG9Tb3VyY2UsXG5cdFx0XHQhIW9wdGlvbnM/LmNvbmZpcm1CZWZvcmVVbmRvXG5cdFx0KTtcblxuXHRcdGxldCBsaXN0ZW5lcjogSURpc3Bvc2FibGUgfCB1bmRlZmluZWQ7XG5cdFx0dHJ5IHtcblx0XHRcdGxpc3RlbmVyID0gdGhpcy5fbGlmZWN5Y2xlU2VydmljZS5vbkJlZm9yZVNodXRkb3duKGUgPT4gZS52ZXRvKHRoaXMuX3Nob3VsZFZldG8obGFiZWwsIGUucmVhc29uKSwgJ3ZldG8uYmx1a0VkaXRTZXJ2aWNlJykpO1xuXHRcdFx0Y29uc3QgcmVzb3VyY2VzID0gYXdhaXQgYnVsa0VkaXQucGVyZm9ybSgpO1xuXG5cdFx0XHQvLyB3aGVuIGVuYWJsZWQgKG9wdGlvbiBBTkQgc2V0dGluZykgbG9vcCBvdmVyIGFsbCBkaXJ0eSB3b3JraW5nIGNvcGllcyBhbmQgdHJpZ2dlciBzYXZlXG5cdFx0XHQvLyBmb3IgdGhvc2UgdGhhdCB3ZXJlIGludm9sdmVkIGluIHRoaXMgYnVsayBlZGl0IG9wZXJhdGlvbi5cblx0XHRcdGlmIChvcHRpb25zPy5yZXNwZWN0QXV0b1NhdmVDb25maWcgJiYgdGhpcy5fY29uZmlnU2VydmljZS5nZXRWYWx1ZShhdXRvU2F2ZVNldHRpbmcpID09PSB0cnVlICYmIHJlc291cmNlcy5sZW5ndGggPiAxKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuX3NhdmVBbGwocmVzb3VyY2VzKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHsgYXJpYVN1bW1hcnk6IGJ1bGtFZGl0LmFyaWFNZXNzYWdlKCksIGlzQXBwbGllZDogZWRpdHMubGVuZ3RoID4gMCB9O1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0Ly8gY29uc29sZS5sb2coJ2FwcGx5IEZBSUxFRCcpO1xuXHRcdFx0Ly8gY29uc29sZS5sb2coZXJyKTtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoZXJyKTtcblx0XHRcdHRocm93IGVycjtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0bGlzdGVuZXI/LmRpc3Bvc2UoKTtcblx0XHRcdHVuZG9SZWRvR3JvdXBSZW1vdmUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9zYXZlQWxsKHJlc291cmNlczogcmVhZG9ubHkgVVJJW10pIHtcblx0XHRjb25zdCBzZXQgPSBuZXcgUmVzb3VyY2VTZXQocmVzb3VyY2VzKTtcblx0XHRjb25zdCBzYXZlcyA9IHRoaXMuX3dvcmtpbmdDb3B5U2VydmljZS5kaXJ0eVdvcmtpbmdDb3BpZXMubWFwKGFzeW5jIChjb3B5KSA9PiB7XG5cdFx0XHRpZiAoc2V0Lmhhcyhjb3B5LnJlc291cmNlKSkge1xuXHRcdFx0XHRhd2FpdCBjb3B5LnNhdmUoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChzYXZlcyk7XG5cdFx0Zm9yIChjb25zdCBpdGVtIG9mIHJlc3VsdCkge1xuXHRcdFx0aWYgKGl0ZW0uc3RhdHVzID09PSAncmVqZWN0ZWQnKSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybihpdGVtLnJlYXNvbik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfc2hvdWxkVmV0byhsYWJlbDogc3RyaW5nIHwgdW5kZWZpbmVkLCByZWFzb246IFNodXRkb3duUmVhc29uKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0bGV0IG1lc3NhZ2U6IHN0cmluZztcblx0XHRsZXQgcHJpbWFyeUJ1dHRvbjogc3RyaW5nO1xuXHRcdHN3aXRjaCAocmVhc29uKSB7XG5cdFx0XHRjYXNlIFNodXRkb3duUmVhc29uLkNMT1NFOlxuXHRcdFx0XHRtZXNzYWdlID0gbG9jYWxpemUoJ2Nsb3NlVGhlV2luZG93Lm1lc3NhZ2UnLCBcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBjbG9zZSB0aGUgd2luZG93P1wiKTtcblx0XHRcdFx0cHJpbWFyeUJ1dHRvbiA9IGxvY2FsaXplKHsga2V5OiAnY2xvc2VUaGVXaW5kb3cnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZDbG9zZSBXaW5kb3dcIik7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBTaHV0ZG93blJlYXNvbi5MT0FEOlxuXHRcdFx0XHRtZXNzYWdlID0gbG9jYWxpemUoJ2NoYW5nZVdvcmtzcGFjZS5tZXNzYWdlJywgXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gY2hhbmdlIHRoZSB3b3Jrc3BhY2U/XCIpO1xuXHRcdFx0XHRwcmltYXJ5QnV0dG9uID0gbG9jYWxpemUoeyBrZXk6ICdjaGFuZ2VXb3Jrc3BhY2UnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiQ2hhbmdlICYmV29ya3NwYWNlXCIpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgU2h1dGRvd25SZWFzb24uUkVMT0FEOlxuXHRcdFx0XHRtZXNzYWdlID0gbG9jYWxpemUoJ3JlbG9hZFRoZVdpbmRvdy5tZXNzYWdlJywgXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gcmVsb2FkIHRoZSB3aW5kb3c/XCIpO1xuXHRcdFx0XHRwcmltYXJ5QnV0dG9uID0gbG9jYWxpemUoeyBrZXk6ICdyZWxvYWRUaGVXaW5kb3cnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZSZWxvYWQgV2luZG93XCIpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdG1lc3NhZ2UgPSBsb2NhbGl6ZSgncXVpdC5tZXNzYWdlJywgXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gcXVpdD9cIik7XG5cdFx0XHRcdHByaW1hcnlCdXR0b24gPSBsb2NhbGl6ZSh7IGtleTogJ3F1aXQnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZRdWl0XCIpO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLl9kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0bWVzc2FnZSxcblx0XHRcdGRldGFpbDogbG9jYWxpemUoJ2FyZVlvdVN1cmVRdWl0ZUJ1bGtFZGl0LmRldGFpbCcsIFwiJ3swfScgaXMgaW4gcHJvZ3Jlc3MuXCIsIGxhYmVsIHx8IGxvY2FsaXplKCdmaWxlT3BlcmF0aW9uJywgXCJGaWxlIG9wZXJhdGlvblwiKSksXG5cdFx0XHRwcmltYXJ5QnV0dG9uXG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gIXJlc3VsdC5jb25maXJtZWQ7XG5cdH1cbn1cblxucmVnaXN0ZXJTaW5nbGV0b24oSUJ1bGtFZGl0U2VydmljZSwgQnVsa0VkaXRTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcblxuY29uc3QgYXV0b1NhdmVTZXR0aW5nID0gJ2ZpbGVzLnJlZmFjdG9yaW5nLmF1dG9TYXZlJztcblxuUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRpZDogJ2ZpbGVzJyxcblx0cHJvcGVydGllczoge1xuXHRcdFthdXRvU2F2ZVNldHRpbmddOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3JlZmFjdG9yaW5nLmF1dG9TYXZlJywgXCJDb250cm9scyBpZiBmaWxlcyB0aGF0IHdlcmUgcGFydCBvZiBhIHJlZmFjdG9yaW5nIGFyZSBzYXZlZCBhdXRvbWF0aWNhbGx5XCIpLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHR5cGU6ICdib29sZWFuJ1xuXHRcdH1cblx0fVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMseUJBQXlCO0FBQ2xDLFNBQXNCLG9CQUFvQjtBQUMxQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGFBQWEsbUJBQW1CO0FBRXpDLFNBQXNCLGNBQWMsb0JBQW9CO0FBQ3hELFNBQXFFLGtCQUFnQyxrQkFBa0Isd0JBQXdCO0FBQy9JLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsa0JBQTBDO0FBQ25ELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsbUJBQW1CLHlCQUF5QjtBQUNyRCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG1CQUFtQjtBQUM1QixTQUFtQyxnQkFBZ0I7QUFDbkQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxxQkFBcUM7QUFDOUMsU0FBUyxlQUFlLGdDQUFnQztBQUN4RCxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHFC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
