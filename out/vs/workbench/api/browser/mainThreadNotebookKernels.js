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
import { isNonEmptyArray } from "../../../base/common/arrays.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { onUnexpectedError } from "../../../base/common/errors.js";
import { Emitter } from "../../../base/common/event.js";
import { DisposableMap, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { ILanguageService } from "../../../editor/common/languages/language.js";
import { NotebookDto } from "./mainThreadNotebookDto.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { INotebookEditorService } from "../../contrib/notebook/browser/services/notebookEditorService.js";
import { INotebookExecutionStateService, NotebookExecutionType } from "../../contrib/notebook/common/notebookExecutionStateService.js";
import { INotebookKernelService } from "../../contrib/notebook/common/notebookKernelService.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { INotebookService } from "../../contrib/notebook/common/notebookService.js";
import { AsyncIterableSource } from "../../../base/common/async.js";
class MainThreadKernel {
  constructor(data, _languageService) {
    this._languageService = _languageService;
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this.id = data.id;
    this.viewType = data.notebookType;
    this.extension = data.extensionId;
    this.implementsInterrupt = data.supportsInterrupt ?? false;
    this.label = data.label;
    this.description = data.description;
    this.detail = data.detail;
    this.supportedLanguages = isNonEmptyArray(data.supportedLanguages) ? data.supportedLanguages : _languageService.getRegisteredLanguageIds();
    this.implementsExecutionOrder = data.supportsExecutionOrder ?? false;
    this.hasVariableProvider = data.hasVariableProvider ?? false;
    this.localResourceRoot = URI.revive(data.extensionLocation);
    this.preloads = data.preloads?.map((u) => ({ uri: URI.revive(u.uri), provides: u.provides })) ?? [];
  }
  get preloadUris() {
    return this.preloads.map((p) => p.uri);
  }
  get preloadProvides() {
    return this.preloads.flatMap((p) => p.provides);
  }
  update(data) {
    const event = /* @__PURE__ */ Object.create(null);
    if (data.label !== void 0) {
      this.label = data.label;
      event.label = true;
    }
    if (data.description !== void 0) {
      this.description = data.description;
      event.description = true;
    }
    if (data.detail !== void 0) {
      this.detail = data.detail;
      event.detail = true;
    }
    if (data.supportedLanguages !== void 0) {
      this.supportedLanguages = isNonEmptyArray(data.supportedLanguages) ? data.supportedLanguages : this._languageService.getRegisteredLanguageIds();
      event.supportedLanguages = true;
    }
    if (data.supportsExecutionOrder !== void 0) {
      this.implementsExecutionOrder = data.supportsExecutionOrder;
      event.hasExecutionOrder = true;
    }
    if (data.supportsInterrupt !== void 0) {
      this.implementsInterrupt = data.supportsInterrupt;
      event.hasInterruptHandler = true;
    }
    if (data.hasVariableProvider !== void 0) {
      this.hasVariableProvider = data.hasVariableProvider;
      event.hasVariableProvider = true;
    }
    this._onDidChange.fire(event);
  }
}
class MainThreadKernelDetectionTask {
  constructor(notebookType) {
    this.notebookType = notebookType;
  }
}
let MainThreadNotebookKernels = class {
  constructor(extHostContext, _languageService, _notebookKernelService, _notebookExecutionStateService, _notebookService, notebookEditorService) {
    this._languageService = _languageService;
    this._notebookKernelService = _notebookKernelService;
    this._notebookExecutionStateService = _notebookExecutionStateService;
    this._notebookService = _notebookService;
    this._editors = new DisposableMap();
    this._disposables = new DisposableStore();
    this._kernels = /* @__PURE__ */ new Map();
    this._kernelDetectionTasks = /* @__PURE__ */ new Map();
    this._kernelSourceActionProviders = /* @__PURE__ */ new Map();
    this._kernelSourceActionProvidersEventRegistrations = /* @__PURE__ */ new Map();
    this._executions = /* @__PURE__ */ new Map();
    this._notebookExecutions = /* @__PURE__ */ new Map();
    this.variableRequestIndex = 0;
    this.variableRequestMap = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostNotebookKernels);
    notebookEditorService.listNotebookEditors().forEach(this._onEditorAdd, this);
    notebookEditorService.onDidAddNotebookEditor(this._onEditorAdd, this, this._disposables);
    notebookEditorService.onDidRemoveNotebookEditor(this._onEditorRemove, this, this._disposables);
    this._disposables.add(toDisposable(() => {
      this._executions.forEach((e) => {
        e.complete({});
      });
      this._notebookExecutions.forEach((e) => e.complete());
    }));
    this._disposables.add(this._notebookExecutionStateService.onDidChangeExecution((e) => {
      if (e.type === NotebookExecutionType.cell) {
        this._proxy.$cellExecutionChanged(e.notebook, e.cellHandle, e.changed?.state);
      }
    }));
    this._disposables.add(this._notebookKernelService.onDidChangeSelectedNotebooks((e) => {
      for (const [handle, [kernel]] of this._kernels) {
        if (e.oldKernel === kernel.id) {
          this._proxy.$acceptNotebookAssociation(handle, e.notebook, false);
        } else if (e.newKernel === kernel.id) {
          this._proxy.$acceptNotebookAssociation(handle, e.notebook, true);
        }
      }
    }));
  }
  dispose() {
    this._disposables.dispose();
    for (const [, registration] of this._kernels.values()) {
      registration.dispose();
    }
    for (const [, registration] of this._kernelDetectionTasks.values()) {
      registration.dispose();
    }
    for (const [, registration] of this._kernelSourceActionProviders.values()) {
      registration.dispose();
    }
    this._editors.dispose();
  }
  // --- kernel ipc
  _onEditorAdd(editor) {
    const ipcListener = editor.onDidReceiveMessage((e) => {
      if (!editor.hasModel()) {
        return;
      }
      const { selected } = this._notebookKernelService.getMatchingKernel(editor.textModel);
      if (!selected) {
        return;
      }
      for (const [handle, candidate] of this._kernels) {
        if (candidate[0] === selected) {
          this._proxy.$acceptKernelMessageFromRenderer(handle, editor.getId(), e.message);
          break;
        }
      }
    });
    this._editors.set(editor, ipcListener);
  }
  _onEditorRemove(editor) {
    this._editors.deleteAndDispose(editor);
  }
  async $postMessage(handle, editorId, message) {
    const tuple = this._kernels.get(handle);
    if (!tuple) {
      throw new Error("kernel already disposed");
    }
    const [kernel] = tuple;
    let didSend = false;
    for (const [editor] of this._editors) {
      if (!editor.hasModel()) {
        continue;
      }
      if (this._notebookKernelService.getMatchingKernel(editor.textModel).selected !== kernel) {
        continue;
      }
      if (editorId === void 0) {
        editor.postMessage(message);
        didSend = true;
      } else if (editor.getId() === editorId) {
        editor.postMessage(message);
        didSend = true;
        break;
      }
    }
    return didSend;
  }
  $receiveVariable(requestId, variable) {
    const source = this.variableRequestMap.get(requestId);
    if (source) {
      source.emitOne(variable);
    }
  }
  // --- kernel adding/updating/removal
  async $addKernel(handle, data) {
    const that = this;
    const kernel = new class extends MainThreadKernel {
      async executeNotebookCellsRequest(uri, handles) {
        await that._proxy.$executeCells(handle, uri, handles);
      }
      async cancelNotebookCellExecution(uri, handles) {
        await that._proxy.$cancelCells(handle, uri, handles);
      }
      provideVariables(notebookUri, parentId, kind, start, token) {
        const requestId = `${handle}variables${that.variableRequestIndex++}`;
        if (that.variableRequestMap.has(requestId)) {
          return that.variableRequestMap.get(requestId).asyncIterable;
        }
        const source = new AsyncIterableSource();
        that.variableRequestMap.set(requestId, source);
        that._proxy.$provideVariables(handle, requestId, notebookUri, parentId, kind, start, token).then(() => {
          source.resolve();
          that.variableRequestMap.delete(requestId);
        }).catch((err) => {
          source.reject(err);
          that.variableRequestMap.delete(requestId);
        });
        return source.asyncIterable;
      }
    }(data, this._languageService);
    const disposables = this._disposables.add(new DisposableStore());
    this._kernels.set(handle, [kernel, disposables]);
    disposables.add(this._notebookKernelService.registerKernel(kernel));
  }
  $updateKernel(handle, data) {
    const tuple = this._kernels.get(handle);
    if (tuple) {
      tuple[0].update(data);
    }
  }
  $removeKernel(handle) {
    const tuple = this._kernels.get(handle);
    if (tuple) {
      tuple[1].dispose();
      this._kernels.delete(handle);
    }
  }
  $updateNotebookPriority(handle, notebook, value) {
    const tuple = this._kernels.get(handle);
    if (tuple) {
      this._notebookKernelService.updateKernelNotebookAffinity(tuple[0], URI.revive(notebook), value);
    }
  }
  // --- Cell execution
  $createExecution(handle, controllerId, rawUri, cellHandle) {
    const uri = URI.revive(rawUri);
    const notebook = this._notebookService.getNotebookTextModel(uri);
    if (!notebook) {
      throw new Error(`Notebook not found: ${uri.toString()}`);
    }
    const kernel = this._notebookKernelService.getMatchingKernel(notebook);
    if (!kernel.selected || kernel.selected.id !== controllerId) {
      throw new Error(`Kernel is not selected: ${kernel.selected?.id} !== ${controllerId}`);
    }
    const execution = this._notebookExecutionStateService.createCellExecution(uri, cellHandle);
    execution.confirm();
    this._executions.set(handle, execution);
  }
  $updateExecution(handle, data) {
    const updates = data.value;
    try {
      const execution = this._executions.get(handle);
      execution?.update(updates.map(NotebookDto.fromCellExecuteUpdateDto));
    } catch (e) {
      onUnexpectedError(e);
    }
  }
  $completeExecution(handle, data) {
    try {
      const execution = this._executions.get(handle);
      execution?.complete(NotebookDto.fromCellExecuteCompleteDto(data.value));
    } catch (e) {
      onUnexpectedError(e);
    } finally {
      this._executions.delete(handle);
    }
  }
  // --- Notebook execution
  $createNotebookExecution(handle, controllerId, rawUri) {
    const uri = URI.revive(rawUri);
    const notebook = this._notebookService.getNotebookTextModel(uri);
    if (!notebook) {
      throw new Error(`Notebook not found: ${uri.toString()}`);
    }
    const kernel = this._notebookKernelService.getMatchingKernel(notebook);
    if (!kernel.selected || kernel.selected.id !== controllerId) {
      throw new Error(`Kernel is not selected: ${kernel.selected?.id} !== ${controllerId}`);
    }
    const execution = this._notebookExecutionStateService.createExecution(uri);
    execution.confirm();
    this._notebookExecutions.set(handle, execution);
  }
  $beginNotebookExecution(handle) {
    try {
      const execution = this._notebookExecutions.get(handle);
      execution?.begin();
    } catch (e) {
      onUnexpectedError(e);
    }
  }
  $completeNotebookExecution(handle) {
    try {
      const execution = this._notebookExecutions.get(handle);
      execution?.complete();
    } catch (e) {
      onUnexpectedError(e);
    } finally {
      this._notebookExecutions.delete(handle);
    }
  }
  // --- notebook kernel detection task
  async $addKernelDetectionTask(handle, notebookType) {
    const kernelDetectionTask = new MainThreadKernelDetectionTask(notebookType);
    const registration = this._notebookKernelService.registerNotebookKernelDetectionTask(kernelDetectionTask);
    this._kernelDetectionTasks.set(handle, [kernelDetectionTask, registration]);
  }
  $removeKernelDetectionTask(handle) {
    const tuple = this._kernelDetectionTasks.get(handle);
    if (tuple) {
      tuple[1].dispose();
      this._kernelDetectionTasks.delete(handle);
    }
  }
  // --- notebook kernel source action provider
  async $addKernelSourceActionProvider(handle, eventHandle, notebookType) {
    const kernelSourceActionProvider = {
      viewType: notebookType,
      provideKernelSourceActions: async () => {
        const actions = await this._proxy.$provideKernelSourceActions(handle, CancellationToken.None);
        return actions.map((action) => {
          let documentation = action.documentation;
          if (action.documentation && typeof action.documentation !== "string") {
            documentation = URI.revive(action.documentation);
          }
          return {
            label: action.label,
            command: action.command,
            description: action.description,
            detail: action.detail,
            documentation
          };
        });
      }
    };
    if (typeof eventHandle === "number") {
      const emitter = new Emitter();
      this._kernelSourceActionProvidersEventRegistrations.set(eventHandle, emitter);
      kernelSourceActionProvider.onDidChangeSourceActions = emitter.event;
    }
    const registration = this._notebookKernelService.registerKernelSourceActionProvider(notebookType, kernelSourceActionProvider);
    this._kernelSourceActionProviders.set(handle, [kernelSourceActionProvider, registration]);
  }
  $removeKernelSourceActionProvider(handle, eventHandle) {
    const tuple = this._kernelSourceActionProviders.get(handle);
    if (tuple) {
      tuple[1].dispose();
      this._kernelSourceActionProviders.delete(handle);
    }
    if (typeof eventHandle === "number") {
      this._kernelSourceActionProvidersEventRegistrations.delete(eventHandle);
    }
  }
  $emitNotebookKernelSourceActionsChangeEvent(eventHandle) {
    const emitter = this._kernelSourceActionProvidersEventRegistrations.get(eventHandle);
    if (emitter instanceof Emitter) {
      emitter.fire(void 0);
    }
  }
  $variablesUpdated(notebookUri) {
    this._notebookKernelService.notifyVariablesChange(URI.revive(notebookUri));
  }
};
MainThreadNotebookKernels = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadNotebookKernels),
  __decorateParam(1, ILanguageService),
  __decorateParam(2, INotebookKernelService),
  __decorateParam(3, INotebookExecutionStateService),
  __decorateParam(4, INotebookService),
  __decorateParam(5, INotebookEditorService)
], MainThreadNotebookKernels);
export {
  MainThreadNotebookKernels
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZE5vdGVib29rS2VybmVscy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGlzTm9uRW1wdHlBcnJheSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVNYXAsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkksIFVyaUNvbXBvbmVudHMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbklkZW50aWZpZXIgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IE5vdGVib29rRHRvIH0gZnJvbSAnLi9tYWluVGhyZWFkTm90ZWJvb2tEdG8uanMnO1xuaW1wb3J0IHsgZXh0SG9zdE5hbWVkQ3VzdG9tZXIsIElFeHRIb3N0Q29udGV4dCB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dEhvc3RDdXN0b21lcnMuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRWRpdG9yIH0gZnJvbSAnLi4vLi4vY29udHJpYi9ub3RlYm9vay9icm93c2VyL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29udHJpYi9ub3RlYm9vay9icm93c2VyL3NlcnZpY2VzL25vdGVib29rRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tDZWxsRXhlY3V0aW9uLCBJTm90ZWJvb2tFeGVjdXRpb24sIElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSwgTm90ZWJvb2tFeGVjdXRpb25UeXBlIH0gZnJvbSAnLi4vLi4vY29udHJpYi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUtlcm5lbFNvdXJjZUFjdGlvblByb3ZpZGVyLCBJTm90ZWJvb2tLZXJuZWwsIElOb3RlYm9va0tlcm5lbENoYW5nZUV2ZW50LCBJTm90ZWJvb2tLZXJuZWxEZXRlY3Rpb25UYXNrLCBJTm90ZWJvb2tLZXJuZWxTZXJ2aWNlLCBWYXJpYWJsZXNSZXN1bHQgfSBmcm9tICcuLi8uLi9jb250cmliL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0tlcm5lbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnMgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9wcm94eUlkZW50aWZpZXIuanMnO1xuaW1wb3J0IHsgRXh0SG9zdENvbnRleHQsIEV4dEhvc3ROb3RlYm9va0tlcm5lbHNTaGFwZSwgSUNlbGxFeGVjdXRlVXBkYXRlRHRvLCBJQ2VsbEV4ZWN1dGlvbkNvbXBsZXRlRHRvLCBJTm90ZWJvb2tLZXJuZWxEdG8yLCBNYWluQ29udGV4dCwgTWFpblRocmVhZE5vdGVib29rS2VybmVsc1NoYXBlIH0gZnJvbSAnLi4vY29tbW9uL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbnRyaWIvbm90ZWJvb2svY29tbW9uL25vdGVib29rU2VydmljZS5qcyc7XG5pbXBvcnQgeyBBc3luY0l0ZXJhYmxlT2JqZWN0LCBBc3luY0l0ZXJhYmxlU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuXG5hYnN0cmFjdCBjbGFzcyBNYWluVGhyZWFkS2VybmVsIGltcGxlbWVudHMgSU5vdGVib29rS2VybmVsIHtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2UgPSBuZXcgRW1pdHRlcjxJTm90ZWJvb2tLZXJuZWxDaGFuZ2VFdmVudD4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBwcmVsb2FkczogeyB1cmk6IFVSSTsgcHJvdmlkZXM6IHJlYWRvbmx5IHN0cmluZ1tdIH1bXTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PElOb3RlYm9va0tlcm5lbENoYW5nZUV2ZW50PiA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdHJlYWRvbmx5IGlkOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHZpZXdUeXBlOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGV4dGVuc2lvbjogRXh0ZW5zaW9uSWRlbnRpZmllcjtcblxuXHRpbXBsZW1lbnRzSW50ZXJydXB0OiBib29sZWFuO1xuXHRsYWJlbDogc3RyaW5nO1xuXHRkZXNjcmlwdGlvbj86IHN0cmluZztcblx0ZGV0YWlsPzogc3RyaW5nO1xuXHRzdXBwb3J0ZWRMYW5ndWFnZXM6IHN0cmluZ1tdO1xuXHRpbXBsZW1lbnRzRXhlY3V0aW9uT3JkZXI6IGJvb2xlYW47XG5cdGhhc1ZhcmlhYmxlUHJvdmlkZXI6IGJvb2xlYW47XG5cdGxvY2FsUmVzb3VyY2VSb290OiBVUkk7XG5cblx0cHVibGljIGdldCBwcmVsb2FkVXJpcygpIHtcblx0XHRyZXR1cm4gdGhpcy5wcmVsb2Fkcy5tYXAocCA9PiBwLnVyaSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHByZWxvYWRQcm92aWRlcygpIHtcblx0XHRyZXR1cm4gdGhpcy5wcmVsb2Fkcy5mbGF0TWFwKHAgPT4gcC5wcm92aWRlcyk7XG5cdH1cblxuXHRjb25zdHJ1Y3RvcihkYXRhOiBJTm90ZWJvb2tLZXJuZWxEdG8yLCBwcml2YXRlIF9sYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UpIHtcblx0XHR0aGlzLmlkID0gZGF0YS5pZDtcblx0XHR0aGlzLnZpZXdUeXBlID0gZGF0YS5ub3RlYm9va1R5cGU7XG5cdFx0dGhpcy5leHRlbnNpb24gPSBkYXRhLmV4dGVuc2lvbklkO1xuXG5cdFx0dGhpcy5pbXBsZW1lbnRzSW50ZXJydXB0ID0gZGF0YS5zdXBwb3J0c0ludGVycnVwdCA/PyBmYWxzZTtcblx0XHR0aGlzLmxhYmVsID0gZGF0YS5sYWJlbDtcblx0XHR0aGlzLmRlc2NyaXB0aW9uID0gZGF0YS5kZXNjcmlwdGlvbjtcblx0XHR0aGlzLmRldGFpbCA9IGRhdGEuZGV0YWlsO1xuXHRcdHRoaXMuc3VwcG9ydGVkTGFuZ3VhZ2VzID0gaXNOb25FbXB0eUFycmF5KGRhdGEuc3VwcG9ydGVkTGFuZ3VhZ2VzKSA/IGRhdGEuc3VwcG9ydGVkTGFuZ3VhZ2VzIDogX2xhbmd1YWdlU2VydmljZS5nZXRSZWdpc3RlcmVkTGFuZ3VhZ2VJZHMoKTtcblx0XHR0aGlzLmltcGxlbWVudHNFeGVjdXRpb25PcmRlciA9IGRhdGEuc3VwcG9ydHNFeGVjdXRpb25PcmRlciA/PyBmYWxzZTtcblx0XHR0aGlzLmhhc1ZhcmlhYmxlUHJvdmlkZXIgPSBkYXRhLmhhc1ZhcmlhYmxlUHJvdmlkZXIgPz8gZmFsc2U7XG5cdFx0dGhpcy5sb2NhbFJlc291cmNlUm9vdCA9IFVSSS5yZXZpdmUoZGF0YS5leHRlbnNpb25Mb2NhdGlvbik7XG5cdFx0dGhpcy5wcmVsb2FkcyA9IGRhdGEucHJlbG9hZHM/Lm1hcCh1ID0+ICh7IHVyaTogVVJJLnJldml2ZSh1LnVyaSksIHByb3ZpZGVzOiB1LnByb3ZpZGVzIH0pKSA/PyBbXTtcblx0fVxuXG5cblx0dXBkYXRlKGRhdGE6IFBhcnRpYWw8SU5vdGVib29rS2VybmVsRHRvMj4pIHtcblxuXHRcdGNvbnN0IGV2ZW50OiBJTm90ZWJvb2tLZXJuZWxDaGFuZ2VFdmVudCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0aWYgKGRhdGEubGFiZWwgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5sYWJlbCA9IGRhdGEubGFiZWw7XG5cdFx0XHRldmVudC5sYWJlbCA9IHRydWU7XG5cdFx0fVxuXHRcdGlmIChkYXRhLmRlc2NyaXB0aW9uICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuZGVzY3JpcHRpb24gPSBkYXRhLmRlc2NyaXB0aW9uO1xuXHRcdFx0ZXZlbnQuZGVzY3JpcHRpb24gPSB0cnVlO1xuXHRcdH1cblx0XHRpZiAoZGF0YS5kZXRhaWwgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5kZXRhaWwgPSBkYXRhLmRldGFpbDtcblx0XHRcdGV2ZW50LmRldGFpbCA9IHRydWU7XG5cdFx0fVxuXHRcdGlmIChkYXRhLnN1cHBvcnRlZExhbmd1YWdlcyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLnN1cHBvcnRlZExhbmd1YWdlcyA9IGlzTm9uRW1wdHlBcnJheShkYXRhLnN1cHBvcnRlZExhbmd1YWdlcykgPyBkYXRhLnN1cHBvcnRlZExhbmd1YWdlcyA6IHRoaXMuX2xhbmd1YWdlU2VydmljZS5nZXRSZWdpc3RlcmVkTGFuZ3VhZ2VJZHMoKTtcblx0XHRcdGV2ZW50LnN1cHBvcnRlZExhbmd1YWdlcyA9IHRydWU7XG5cdFx0fVxuXHRcdGlmIChkYXRhLnN1cHBvcnRzRXhlY3V0aW9uT3JkZXIgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5pbXBsZW1lbnRzRXhlY3V0aW9uT3JkZXIgPSBkYXRhLnN1cHBvcnRzRXhlY3V0aW9uT3JkZXI7XG5cdFx0XHRldmVudC5oYXNFeGVjdXRpb25PcmRlciA9IHRydWU7XG5cdFx0fVxuXHRcdGlmIChkYXRhLnN1cHBvcnRzSW50ZXJydXB0ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuaW1wbGVtZW50c0ludGVycnVwdCA9IGRhdGEuc3VwcG9ydHNJbnRlcnJ1cHQ7XG5cdFx0XHRldmVudC5oYXNJbnRlcnJ1cHRIYW5kbGVyID0gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKGRhdGEuaGFzVmFyaWFibGVQcm92aWRlciAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLmhhc1ZhcmlhYmxlUHJvdmlkZXIgPSBkYXRhLmhhc1ZhcmlhYmxlUHJvdmlkZXI7XG5cdFx0XHRldmVudC5oYXNWYXJpYWJsZVByb3ZpZGVyID0gdHJ1ZTtcblx0XHR9XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZShldmVudCk7XG5cdH1cblxuXHRhYnN0cmFjdCBleGVjdXRlTm90ZWJvb2tDZWxsc1JlcXVlc3QodXJpOiBVUkksIGNlbGxIYW5kbGVzOiBudW1iZXJbXSk6IFByb21pc2U8dm9pZD47XG5cdGFic3RyYWN0IGNhbmNlbE5vdGVib29rQ2VsbEV4ZWN1dGlvbih1cmk6IFVSSSwgY2VsbEhhbmRsZXM6IG51bWJlcltdKTogUHJvbWlzZTx2b2lkPjtcblx0YWJzdHJhY3QgcHJvdmlkZVZhcmlhYmxlcyhub3RlYm9va1VyaTogVVJJLCBwYXJlbnRJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBraW5kOiAnbmFtZWQnIHwgJ2luZGV4ZWQnLCBzdGFydDogbnVtYmVyLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBBc3luY0l0ZXJhYmxlT2JqZWN0PFZhcmlhYmxlc1Jlc3VsdD47XG59XG5cbmNsYXNzIE1haW5UaHJlYWRLZXJuZWxEZXRlY3Rpb25UYXNrIGltcGxlbWVudHMgSU5vdGVib29rS2VybmVsRGV0ZWN0aW9uVGFzayB7XG5cdGNvbnN0cnVjdG9yKHJlYWRvbmx5IG5vdGVib29rVHlwZTogc3RyaW5nKSB7IH1cbn1cblxuQGV4dEhvc3ROYW1lZEN1c3RvbWVyKE1haW5Db250ZXh0Lk1haW5UaHJlYWROb3RlYm9va0tlcm5lbHMpXG5leHBvcnQgY2xhc3MgTWFpblRocmVhZE5vdGVib29rS2VybmVscyBpbXBsZW1lbnRzIE1haW5UaHJlYWROb3RlYm9va0tlcm5lbHNTaGFwZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9ycyA9IG5ldyBEaXNwb3NhYmxlTWFwPElOb3RlYm9va0VkaXRvcj4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfa2VybmVscyA9IG5ldyBNYXA8bnVtYmVyLCBba2VybmVsOiBNYWluVGhyZWFkS2VybmVsLCByZWdpc3RyYWlvbjogSURpc3Bvc2FibGVdPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9rZXJuZWxEZXRlY3Rpb25UYXNrcyA9IG5ldyBNYXA8bnVtYmVyLCBbdGFzazogTWFpblRocmVhZEtlcm5lbERldGVjdGlvblRhc2ssIHJlZ2lzdHJhaW9uOiBJRGlzcG9zYWJsZV0+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2tlcm5lbFNvdXJjZUFjdGlvblByb3ZpZGVycyA9IG5ldyBNYXA8bnVtYmVyLCBbcHJvdmlkZXI6IElLZXJuZWxTb3VyY2VBY3Rpb25Qcm92aWRlciwgcmVnaXN0cmFpb246IElEaXNwb3NhYmxlXT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfa2VybmVsU291cmNlQWN0aW9uUHJvdmlkZXJzRXZlbnRSZWdpc3RyYXRpb25zID0gbmV3IE1hcDxudW1iZXIsIElEaXNwb3NhYmxlPigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBFeHRIb3N0Tm90ZWJvb2tLZXJuZWxzU2hhcGU7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZXhlY3V0aW9ucyA9IG5ldyBNYXA8bnVtYmVyLCBJTm90ZWJvb2tDZWxsRXhlY3V0aW9uPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9ub3RlYm9va0V4ZWN1dGlvbnMgPSBuZXcgTWFwPG51bWJlciwgSU5vdGVib29rRXhlY3V0aW9uPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGV4dEhvc3RDb250ZXh0OiBJRXh0SG9zdENvbnRleHQsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tLZXJuZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rS2VybmVsU2VydmljZTogSU5vdGVib29rS2VybmVsU2VydmljZSxcblx0XHRASU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlOiBJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UsXG5cdFx0QElOb3RlYm9va1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tTZXJ2aWNlOiBJTm90ZWJvb2tTZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tFZGl0b3JTZXJ2aWNlIG5vdGVib29rRWRpdG9yU2VydmljZTogSU5vdGVib29rRWRpdG9yU2VydmljZVxuXHQpIHtcblx0XHR0aGlzLl9wcm94eSA9IGV4dEhvc3RDb250ZXh0LmdldFByb3h5KEV4dEhvc3RDb250ZXh0LkV4dEhvc3ROb3RlYm9va0tlcm5lbHMpO1xuXG5cdFx0bm90ZWJvb2tFZGl0b3JTZXJ2aWNlLmxpc3ROb3RlYm9va0VkaXRvcnMoKS5mb3JFYWNoKHRoaXMuX29uRWRpdG9yQWRkLCB0aGlzKTtcblx0XHRub3RlYm9va0VkaXRvclNlcnZpY2Uub25EaWRBZGROb3RlYm9va0VkaXRvcih0aGlzLl9vbkVkaXRvckFkZCwgdGhpcywgdGhpcy5fZGlzcG9zYWJsZXMpO1xuXHRcdG5vdGVib29rRWRpdG9yU2VydmljZS5vbkRpZFJlbW92ZU5vdGVib29rRWRpdG9yKHRoaXMuX29uRWRpdG9yUmVtb3ZlLCB0aGlzLCB0aGlzLl9kaXNwb3NhYmxlcyk7XG5cblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdC8vIEVIIHNodXQgZG93biwgY29tcGxldGUgYWxsIGV4ZWN1dGlvbnMgc3RhcnRlZCBieSB0aGlzIEVIXG5cdFx0XHR0aGlzLl9leGVjdXRpb25zLmZvckVhY2goZSA9PiB7XG5cdFx0XHRcdGUuY29tcGxldGUoe30pO1xuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLl9ub3RlYm9va0V4ZWN1dGlvbnMuZm9yRWFjaChlID0+IGUuY29tcGxldGUoKSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLm9uRGlkQ2hhbmdlRXhlY3V0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUudHlwZSA9PT0gTm90ZWJvb2tFeGVjdXRpb25UeXBlLmNlbGwpIHtcblx0XHRcdFx0dGhpcy5fcHJveHkuJGNlbGxFeGVjdXRpb25DaGFuZ2VkKGUubm90ZWJvb2ssIGUuY2VsbEhhbmRsZSwgZS5jaGFuZ2VkPy5zdGF0ZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX25vdGVib29rS2VybmVsU2VydmljZS5vbkRpZENoYW5nZVNlbGVjdGVkTm90ZWJvb2tzKGUgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBbaGFuZGxlLCBba2VybmVsLF1dIG9mIHRoaXMuX2tlcm5lbHMpIHtcblx0XHRcdFx0aWYgKGUub2xkS2VybmVsID09PSBrZXJuZWwuaWQpIHtcblx0XHRcdFx0XHR0aGlzLl9wcm94eS4kYWNjZXB0Tm90ZWJvb2tBc3NvY2lhdGlvbihoYW5kbGUsIGUubm90ZWJvb2ssIGZhbHNlKTtcblx0XHRcdFx0fSBlbHNlIGlmIChlLm5ld0tlcm5lbCA9PT0ga2VybmVsLmlkKSB7XG5cdFx0XHRcdFx0dGhpcy5fcHJveHkuJGFjY2VwdE5vdGVib29rQXNzb2NpYXRpb24oaGFuZGxlLCBlLm5vdGVib29rLCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdGZvciAoY29uc3QgWywgcmVnaXN0cmF0aW9uXSBvZiB0aGlzLl9rZXJuZWxzLnZhbHVlcygpKSB7XG5cdFx0XHRyZWdpc3RyYXRpb24uZGlzcG9zZSgpO1xuXHRcdH1cblx0XHRmb3IgKGNvbnN0IFssIHJlZ2lzdHJhdGlvbl0gb2YgdGhpcy5fa2VybmVsRGV0ZWN0aW9uVGFza3MudmFsdWVzKCkpIHtcblx0XHRcdHJlZ2lzdHJhdGlvbi5kaXNwb3NlKCk7XG5cdFx0fVxuXHRcdGZvciAoY29uc3QgWywgcmVnaXN0cmF0aW9uXSBvZiB0aGlzLl9rZXJuZWxTb3VyY2VBY3Rpb25Qcm92aWRlcnMudmFsdWVzKCkpIHtcblx0XHRcdHJlZ2lzdHJhdGlvbi5kaXNwb3NlKCk7XG5cdFx0fVxuXHRcdHRoaXMuX2VkaXRvcnMuZGlzcG9zZSgpO1xuXHR9XG5cblx0Ly8gLS0tIGtlcm5lbCBpcGNcblxuXHRwcml2YXRlIF9vbkVkaXRvckFkZChlZGl0b3I6IElOb3RlYm9va0VkaXRvcikge1xuXG5cdFx0Y29uc3QgaXBjTGlzdGVuZXIgPSBlZGl0b3Iub25EaWRSZWNlaXZlTWVzc2FnZShlID0+IHtcblx0XHRcdGlmICghZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgeyBzZWxlY3RlZCB9ID0gdGhpcy5fbm90ZWJvb2tLZXJuZWxTZXJ2aWNlLmdldE1hdGNoaW5nS2VybmVsKGVkaXRvci50ZXh0TW9kZWwpO1xuXHRcdFx0aWYgKCFzZWxlY3RlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGNvbnN0IFtoYW5kbGUsIGNhbmRpZGF0ZV0gb2YgdGhpcy5fa2VybmVscykge1xuXHRcdFx0XHRpZiAoY2FuZGlkYXRlWzBdID09PSBzZWxlY3RlZCkge1xuXHRcdFx0XHRcdHRoaXMuX3Byb3h5LiRhY2NlcHRLZXJuZWxNZXNzYWdlRnJvbVJlbmRlcmVyKGhhbmRsZSwgZWRpdG9yLmdldElkKCksIGUubWVzc2FnZSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLl9lZGl0b3JzLnNldChlZGl0b3IsIGlwY0xpc3RlbmVyKTtcblx0fVxuXG5cdHByaXZhdGUgX29uRWRpdG9yUmVtb3ZlKGVkaXRvcjogSU5vdGVib29rRWRpdG9yKSB7XG5cdFx0dGhpcy5fZWRpdG9ycy5kZWxldGVBbmREaXNwb3NlKGVkaXRvcik7XG5cdH1cblxuXHRhc3luYyAkcG9zdE1lc3NhZ2UoaGFuZGxlOiBudW1iZXIsIGVkaXRvcklkOiBzdHJpbmcgfCB1bmRlZmluZWQsIG1lc3NhZ2U6IGFueSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IHR1cGxlID0gdGhpcy5fa2VybmVscy5nZXQoaGFuZGxlKTtcblx0XHRpZiAoIXR1cGxlKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2tlcm5lbCBhbHJlYWR5IGRpc3Bvc2VkJyk7XG5cdFx0fVxuXHRcdGNvbnN0IFtrZXJuZWxdID0gdHVwbGU7XG5cdFx0bGV0IGRpZFNlbmQgPSBmYWxzZTtcblx0XHRmb3IgKGNvbnN0IFtlZGl0b3JdIG9mIHRoaXMuX2VkaXRvcnMpIHtcblx0XHRcdGlmICghZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5fbm90ZWJvb2tLZXJuZWxTZXJ2aWNlLmdldE1hdGNoaW5nS2VybmVsKGVkaXRvci50ZXh0TW9kZWwpLnNlbGVjdGVkICE9PSBrZXJuZWwpIHtcblx0XHRcdFx0Ly8gZGlmZmVyZW50IGtlcm5lbFxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGlmIChlZGl0b3JJZCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdC8vIGFsbCBlZGl0b3JzXG5cdFx0XHRcdGVkaXRvci5wb3N0TWVzc2FnZShtZXNzYWdlKTtcblx0XHRcdFx0ZGlkU2VuZCA9IHRydWU7XG5cdFx0XHR9IGVsc2UgaWYgKGVkaXRvci5nZXRJZCgpID09PSBlZGl0b3JJZCkge1xuXHRcdFx0XHQvLyBzZWxlY3RlZCBlZGl0b3JzXG5cdFx0XHRcdGVkaXRvci5wb3N0TWVzc2FnZShtZXNzYWdlKTtcblx0XHRcdFx0ZGlkU2VuZCA9IHRydWU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZGlkU2VuZDtcblx0fVxuXG5cdHByaXZhdGUgdmFyaWFibGVSZXF1ZXN0SW5kZXggPSAwO1xuXHRwcml2YXRlIHZhcmlhYmxlUmVxdWVzdE1hcCA9IG5ldyBNYXA8c3RyaW5nLCBBc3luY0l0ZXJhYmxlU291cmNlPFZhcmlhYmxlc1Jlc3VsdD4+KCk7XG5cdCRyZWNlaXZlVmFyaWFibGUocmVxdWVzdElkOiBzdHJpbmcsIHZhcmlhYmxlOiBWYXJpYWJsZXNSZXN1bHQpIHtcblx0XHRjb25zdCBzb3VyY2UgPSB0aGlzLnZhcmlhYmxlUmVxdWVzdE1hcC5nZXQocmVxdWVzdElkKTtcblx0XHRpZiAoc291cmNlKSB7XG5cdFx0XHRzb3VyY2UuZW1pdE9uZSh2YXJpYWJsZSk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gLS0tIGtlcm5lbCBhZGRpbmcvdXBkYXRpbmcvcmVtb3ZhbFxuXG5cdGFzeW5jICRhZGRLZXJuZWwoaGFuZGxlOiBudW1iZXIsIGRhdGE6IElOb3RlYm9va0tlcm5lbER0bzIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRjb25zdCBrZXJuZWwgPSBuZXcgY2xhc3MgZXh0ZW5kcyBNYWluVGhyZWFkS2VybmVsIHtcblx0XHRcdGFzeW5jIGV4ZWN1dGVOb3RlYm9va0NlbGxzUmVxdWVzdCh1cmk6IFVSSSwgaGFuZGxlczogbnVtYmVyW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0YXdhaXQgdGhhdC5fcHJveHkuJGV4ZWN1dGVDZWxscyhoYW5kbGUsIHVyaSwgaGFuZGxlcyk7XG5cdFx0XHR9XG5cdFx0XHRhc3luYyBjYW5jZWxOb3RlYm9va0NlbGxFeGVjdXRpb24odXJpOiBVUkksIGhhbmRsZXM6IG51bWJlcltdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdGF3YWl0IHRoYXQuX3Byb3h5LiRjYW5jZWxDZWxscyhoYW5kbGUsIHVyaSwgaGFuZGxlcyk7XG5cdFx0XHR9XG5cdFx0XHRwcm92aWRlVmFyaWFibGVzKG5vdGVib29rVXJpOiBVUkksIHBhcmVudElkOiBudW1iZXIgfCB1bmRlZmluZWQsIGtpbmQ6ICduYW1lZCcgfCAnaW5kZXhlZCcsIHN0YXJ0OiBudW1iZXIsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IEFzeW5jSXRlcmFibGVPYmplY3Q8VmFyaWFibGVzUmVzdWx0PiB7XG5cdFx0XHRcdGNvbnN0IHJlcXVlc3RJZCA9IGAke2hhbmRsZX12YXJpYWJsZXMke3RoYXQudmFyaWFibGVSZXF1ZXN0SW5kZXgrK31gO1xuXHRcdFx0XHRpZiAodGhhdC52YXJpYWJsZVJlcXVlc3RNYXAuaGFzKHJlcXVlc3RJZCkpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhhdC52YXJpYWJsZVJlcXVlc3RNYXAuZ2V0KHJlcXVlc3RJZCkhLmFzeW5jSXRlcmFibGU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBzb3VyY2UgPSBuZXcgQXN5bmNJdGVyYWJsZVNvdXJjZTxWYXJpYWJsZXNSZXN1bHQ+KCk7XG5cdFx0XHRcdHRoYXQudmFyaWFibGVSZXF1ZXN0TWFwLnNldChyZXF1ZXN0SWQsIHNvdXJjZSk7XG5cdFx0XHRcdHRoYXQuX3Byb3h5LiRwcm92aWRlVmFyaWFibGVzKGhhbmRsZSwgcmVxdWVzdElkLCBub3RlYm9va1VyaSwgcGFyZW50SWQsIGtpbmQsIHN0YXJ0LCB0b2tlbikudGhlbigoKSA9PiB7XG5cdFx0XHRcdFx0c291cmNlLnJlc29sdmUoKTtcblx0XHRcdFx0XHR0aGF0LnZhcmlhYmxlUmVxdWVzdE1hcC5kZWxldGUocmVxdWVzdElkKTtcblx0XHRcdFx0fSkuY2F0Y2goKGVycikgPT4ge1xuXHRcdFx0XHRcdHNvdXJjZS5yZWplY3QoZXJyKTtcblx0XHRcdFx0XHR0aGF0LnZhcmlhYmxlUmVxdWVzdE1hcC5kZWxldGUocmVxdWVzdElkKTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0cmV0dXJuIHNvdXJjZS5hc3luY0l0ZXJhYmxlO1xuXHRcdFx0fVxuXHRcdH0oZGF0YSwgdGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gdGhpcy5fZGlzcG9zYWJsZXMuYWRkKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdFx0Ly8gRW5zdXJlIF9rZXJuZWxzIGlzIHVwIHRvIGRhdGUgYmVmb3JlIHdlIHJlZ2lzdGVyIGEga2VybmVsLlxuXHRcdHRoaXMuX2tlcm5lbHMuc2V0KGhhbmRsZSwgW2tlcm5lbCwgZGlzcG9zYWJsZXNdKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodGhpcy5fbm90ZWJvb2tLZXJuZWxTZXJ2aWNlLnJlZ2lzdGVyS2VybmVsKGtlcm5lbCkpO1xuXHR9XG5cblx0JHVwZGF0ZUtlcm5lbChoYW5kbGU6IG51bWJlciwgZGF0YTogUGFydGlhbDxJTm90ZWJvb2tLZXJuZWxEdG8yPik6IHZvaWQge1xuXHRcdGNvbnN0IHR1cGxlID0gdGhpcy5fa2VybmVscy5nZXQoaGFuZGxlKTtcblx0XHRpZiAodHVwbGUpIHtcblx0XHRcdHR1cGxlWzBdLnVwZGF0ZShkYXRhKTtcblx0XHR9XG5cdH1cblxuXHQkcmVtb3ZlS2VybmVsKGhhbmRsZTogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgdHVwbGUgPSB0aGlzLl9rZXJuZWxzLmdldChoYW5kbGUpO1xuXHRcdGlmICh0dXBsZSkge1xuXHRcdFx0dHVwbGVbMV0uZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fa2VybmVscy5kZWxldGUoaGFuZGxlKTtcblx0XHR9XG5cdH1cblxuXHQkdXBkYXRlTm90ZWJvb2tQcmlvcml0eShoYW5kbGU6IG51bWJlciwgbm90ZWJvb2s6IFVyaUNvbXBvbmVudHMsIHZhbHVlOiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCB0dXBsZSA9IHRoaXMuX2tlcm5lbHMuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKHR1cGxlKSB7XG5cdFx0XHR0aGlzLl9ub3RlYm9va0tlcm5lbFNlcnZpY2UudXBkYXRlS2VybmVsTm90ZWJvb2tBZmZpbml0eSh0dXBsZVswXSwgVVJJLnJldml2ZShub3RlYm9vayksIHZhbHVlKTtcblx0XHR9XG5cdH1cblxuXHQvLyAtLS0gQ2VsbCBleGVjdXRpb25cblxuXHQkY3JlYXRlRXhlY3V0aW9uKGhhbmRsZTogbnVtYmVyLCBjb250cm9sbGVySWQ6IHN0cmluZywgcmF3VXJpOiBVcmlDb21wb25lbnRzLCBjZWxsSGFuZGxlOiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCB1cmkgPSBVUkkucmV2aXZlKHJhd1VyaSk7XG5cdFx0Y29uc3Qgbm90ZWJvb2sgPSB0aGlzLl9ub3RlYm9va1NlcnZpY2UuZ2V0Tm90ZWJvb2tUZXh0TW9kZWwodXJpKTtcblx0XHRpZiAoIW5vdGVib29rKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYE5vdGVib29rIG5vdCBmb3VuZDogJHt1cmkudG9TdHJpbmcoKX1gKTtcblx0XHR9XG5cblx0XHRjb25zdCBrZXJuZWwgPSB0aGlzLl9ub3RlYm9va0tlcm5lbFNlcnZpY2UuZ2V0TWF0Y2hpbmdLZXJuZWwobm90ZWJvb2spO1xuXHRcdGlmICgha2VybmVsLnNlbGVjdGVkIHx8IGtlcm5lbC5zZWxlY3RlZC5pZCAhPT0gY29udHJvbGxlcklkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEtlcm5lbCBpcyBub3Qgc2VsZWN0ZWQ6ICR7a2VybmVsLnNlbGVjdGVkPy5pZH0gIT09ICR7Y29udHJvbGxlcklkfWApO1xuXHRcdH1cblx0XHRjb25zdCBleGVjdXRpb24gPSB0aGlzLl9ub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZS5jcmVhdGVDZWxsRXhlY3V0aW9uKHVyaSwgY2VsbEhhbmRsZSk7XG5cdFx0ZXhlY3V0aW9uLmNvbmZpcm0oKTtcblx0XHR0aGlzLl9leGVjdXRpb25zLnNldChoYW5kbGUsIGV4ZWN1dGlvbik7XG5cdH1cblxuXHQkdXBkYXRlRXhlY3V0aW9uKGhhbmRsZTogbnVtYmVyLCBkYXRhOiBTZXJpYWxpemFibGVPYmplY3RXaXRoQnVmZmVyczxJQ2VsbEV4ZWN1dGVVcGRhdGVEdG9bXT4pOiB2b2lkIHtcblx0XHRjb25zdCB1cGRhdGVzID0gZGF0YS52YWx1ZTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZXhlY3V0aW9uID0gdGhpcy5fZXhlY3V0aW9ucy5nZXQoaGFuZGxlKTtcblx0XHRcdGV4ZWN1dGlvbj8udXBkYXRlKHVwZGF0ZXMubWFwKE5vdGVib29rRHRvLmZyb21DZWxsRXhlY3V0ZVVwZGF0ZUR0bykpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGUpO1xuXHRcdH1cblx0fVxuXG5cdCRjb21wbGV0ZUV4ZWN1dGlvbihoYW5kbGU6IG51bWJlciwgZGF0YTogU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnM8SUNlbGxFeGVjdXRpb25Db21wbGV0ZUR0bz4pOiB2b2lkIHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZXhlY3V0aW9uID0gdGhpcy5fZXhlY3V0aW9ucy5nZXQoaGFuZGxlKTtcblx0XHRcdGV4ZWN1dGlvbj8uY29tcGxldGUoTm90ZWJvb2tEdG8uZnJvbUNlbGxFeGVjdXRlQ29tcGxldGVEdG8oZGF0YS52YWx1ZSkpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGUpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLl9leGVjdXRpb25zLmRlbGV0ZShoYW5kbGUpO1xuXHRcdH1cblx0fVxuXG5cdC8vIC0tLSBOb3RlYm9vayBleGVjdXRpb25cblxuXHQkY3JlYXRlTm90ZWJvb2tFeGVjdXRpb24oaGFuZGxlOiBudW1iZXIsIGNvbnRyb2xsZXJJZDogc3RyaW5nLCByYXdVcmk6IFVyaUNvbXBvbmVudHMpOiB2b2lkIHtcblx0XHRjb25zdCB1cmkgPSBVUkkucmV2aXZlKHJhd1VyaSk7XG5cdFx0Y29uc3Qgbm90ZWJvb2sgPSB0aGlzLl9ub3RlYm9va1NlcnZpY2UuZ2V0Tm90ZWJvb2tUZXh0TW9kZWwodXJpKTtcblx0XHRpZiAoIW5vdGVib29rKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYE5vdGVib29rIG5vdCBmb3VuZDogJHt1cmkudG9TdHJpbmcoKX1gKTtcblx0XHR9XG5cblx0XHRjb25zdCBrZXJuZWwgPSB0aGlzLl9ub3RlYm9va0tlcm5lbFNlcnZpY2UuZ2V0TWF0Y2hpbmdLZXJuZWwobm90ZWJvb2spO1xuXHRcdGlmICgha2VybmVsLnNlbGVjdGVkIHx8IGtlcm5lbC5zZWxlY3RlZC5pZCAhPT0gY29udHJvbGxlcklkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEtlcm5lbCBpcyBub3Qgc2VsZWN0ZWQ6ICR7a2VybmVsLnNlbGVjdGVkPy5pZH0gIT09ICR7Y29udHJvbGxlcklkfWApO1xuXHRcdH1cblx0XHRjb25zdCBleGVjdXRpb24gPSB0aGlzLl9ub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZS5jcmVhdGVFeGVjdXRpb24odXJpKTtcblx0XHRleGVjdXRpb24uY29uZmlybSgpO1xuXHRcdHRoaXMuX25vdGVib29rRXhlY3V0aW9ucy5zZXQoaGFuZGxlLCBleGVjdXRpb24pO1xuXHR9XG5cblx0JGJlZ2luTm90ZWJvb2tFeGVjdXRpb24oaGFuZGxlOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZXhlY3V0aW9uID0gdGhpcy5fbm90ZWJvb2tFeGVjdXRpb25zLmdldChoYW5kbGUpO1xuXHRcdFx0ZXhlY3V0aW9uPy5iZWdpbigpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGUpO1xuXHRcdH1cblx0fVxuXG5cdCRjb21wbGV0ZU5vdGVib29rRXhlY3V0aW9uKGhhbmRsZTogbnVtYmVyKTogdm9pZCB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGV4ZWN1dGlvbiA9IHRoaXMuX25vdGVib29rRXhlY3V0aW9ucy5nZXQoaGFuZGxlKTtcblx0XHRcdGV4ZWN1dGlvbj8uY29tcGxldGUoKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5fbm90ZWJvb2tFeGVjdXRpb25zLmRlbGV0ZShoYW5kbGUpO1xuXHRcdH1cblx0fVxuXG5cdC8vIC0tLSBub3RlYm9vayBrZXJuZWwgZGV0ZWN0aW9uIHRhc2tcblx0YXN5bmMgJGFkZEtlcm5lbERldGVjdGlvblRhc2soaGFuZGxlOiBudW1iZXIsIG5vdGVib29rVHlwZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qga2VybmVsRGV0ZWN0aW9uVGFzayA9IG5ldyBNYWluVGhyZWFkS2VybmVsRGV0ZWN0aW9uVGFzayhub3RlYm9va1R5cGUpO1xuXHRcdGNvbnN0IHJlZ2lzdHJhdGlvbiA9IHRoaXMuX25vdGVib29rS2VybmVsU2VydmljZS5yZWdpc3Rlck5vdGVib29rS2VybmVsRGV0ZWN0aW9uVGFzayhrZXJuZWxEZXRlY3Rpb25UYXNrKTtcblx0XHR0aGlzLl9rZXJuZWxEZXRlY3Rpb25UYXNrcy5zZXQoaGFuZGxlLCBba2VybmVsRGV0ZWN0aW9uVGFzaywgcmVnaXN0cmF0aW9uXSk7XG5cdH1cblxuXHQkcmVtb3ZlS2VybmVsRGV0ZWN0aW9uVGFzayhoYW5kbGU6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IHR1cGxlID0gdGhpcy5fa2VybmVsRGV0ZWN0aW9uVGFza3MuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKHR1cGxlKSB7XG5cdFx0XHR0dXBsZVsxXS5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9rZXJuZWxEZXRlY3Rpb25UYXNrcy5kZWxldGUoaGFuZGxlKTtcblx0XHR9XG5cdH1cblxuXHQvLyAtLS0gbm90ZWJvb2sga2VybmVsIHNvdXJjZSBhY3Rpb24gcHJvdmlkZXJcblxuXHRhc3luYyAkYWRkS2VybmVsU291cmNlQWN0aW9uUHJvdmlkZXIoaGFuZGxlOiBudW1iZXIsIGV2ZW50SGFuZGxlOiBudW1iZXIsIG5vdGVib29rVHlwZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qga2VybmVsU291cmNlQWN0aW9uUHJvdmlkZXI6IElLZXJuZWxTb3VyY2VBY3Rpb25Qcm92aWRlciA9IHtcblx0XHRcdHZpZXdUeXBlOiBub3RlYm9va1R5cGUsXG5cdFx0XHRwcm92aWRlS2VybmVsU291cmNlQWN0aW9uczogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBhY3Rpb25zID0gYXdhaXQgdGhpcy5fcHJveHkuJHByb3ZpZGVLZXJuZWxTb3VyY2VBY3Rpb25zKGhhbmRsZSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0XHRcdFx0cmV0dXJuIGFjdGlvbnMubWFwKGFjdGlvbiA9PiB7XG5cdFx0XHRcdFx0bGV0IGRvY3VtZW50YXRpb24gPSBhY3Rpb24uZG9jdW1lbnRhdGlvbjtcblx0XHRcdFx0XHRpZiAoYWN0aW9uLmRvY3VtZW50YXRpb24gJiYgdHlwZW9mIGFjdGlvbi5kb2N1bWVudGF0aW9uICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0ZG9jdW1lbnRhdGlvbiA9IFVSSS5yZXZpdmUoYWN0aW9uLmRvY3VtZW50YXRpb24pO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRsYWJlbDogYWN0aW9uLmxhYmVsLFxuXHRcdFx0XHRcdFx0Y29tbWFuZDogYWN0aW9uLmNvbW1hbmQsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogYWN0aW9uLmRlc2NyaXB0aW9uLFxuXHRcdFx0XHRcdFx0ZGV0YWlsOiBhY3Rpb24uZGV0YWlsLFxuXHRcdFx0XHRcdFx0ZG9jdW1lbnRhdGlvbixcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0aWYgKHR5cGVvZiBldmVudEhhbmRsZSA9PT0gJ251bWJlcicpIHtcblx0XHRcdGNvbnN0IGVtaXR0ZXIgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRcdFx0dGhpcy5fa2VybmVsU291cmNlQWN0aW9uUHJvdmlkZXJzRXZlbnRSZWdpc3RyYXRpb25zLnNldChldmVudEhhbmRsZSwgZW1pdHRlcik7XG5cdFx0XHRrZXJuZWxTb3VyY2VBY3Rpb25Qcm92aWRlci5vbkRpZENoYW5nZVNvdXJjZUFjdGlvbnMgPSBlbWl0dGVyLmV2ZW50O1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlZ2lzdHJhdGlvbiA9IHRoaXMuX25vdGVib29rS2VybmVsU2VydmljZS5yZWdpc3Rlcktlcm5lbFNvdXJjZUFjdGlvblByb3ZpZGVyKG5vdGVib29rVHlwZSwga2VybmVsU291cmNlQWN0aW9uUHJvdmlkZXIpO1xuXHRcdHRoaXMuX2tlcm5lbFNvdXJjZUFjdGlvblByb3ZpZGVycy5zZXQoaGFuZGxlLCBba2VybmVsU291cmNlQWN0aW9uUHJvdmlkZXIsIHJlZ2lzdHJhdGlvbl0pO1xuXHR9XG5cblx0JHJlbW92ZUtlcm5lbFNvdXJjZUFjdGlvblByb3ZpZGVyKGhhbmRsZTogbnVtYmVyLCBldmVudEhhbmRsZTogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgdHVwbGUgPSB0aGlzLl9rZXJuZWxTb3VyY2VBY3Rpb25Qcm92aWRlcnMuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKHR1cGxlKSB7XG5cdFx0XHR0dXBsZVsxXS5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9rZXJuZWxTb3VyY2VBY3Rpb25Qcm92aWRlcnMuZGVsZXRlKGhhbmRsZSk7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgZXZlbnRIYW5kbGUgPT09ICdudW1iZXInKSB7XG5cdFx0XHR0aGlzLl9rZXJuZWxTb3VyY2VBY3Rpb25Qcm92aWRlcnNFdmVudFJlZ2lzdHJhdGlvbnMuZGVsZXRlKGV2ZW50SGFuZGxlKTtcblx0XHR9XG5cdH1cblxuXHQkZW1pdE5vdGVib29rS2VybmVsU291cmNlQWN0aW9uc0NoYW5nZUV2ZW50KGV2ZW50SGFuZGxlOiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBlbWl0dGVyID0gdGhpcy5fa2VybmVsU291cmNlQWN0aW9uUHJvdmlkZXJzRXZlbnRSZWdpc3RyYXRpb25zLmdldChldmVudEhhbmRsZSk7XG5cdFx0aWYgKGVtaXR0ZXIgaW5zdGFuY2VvZiBFbWl0dGVyKSB7XG5cdFx0XHRlbWl0dGVyLmZpcmUodW5kZWZpbmVkKTtcblx0XHR9XG5cdH1cblxuXHQkdmFyaWFibGVzVXBkYXRlZChub3RlYm9va1VyaTogVXJpQ29tcG9uZW50cyk6IHZvaWQge1xuXHRcdHRoaXMuX25vdGVib29rS2VybmVsU2VydmljZS5ub3RpZnlWYXJpYWJsZXNDaGFuZ2UoVVJJLnJldml2ZShub3RlYm9va1VyaSkpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMseUJBQXlC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
