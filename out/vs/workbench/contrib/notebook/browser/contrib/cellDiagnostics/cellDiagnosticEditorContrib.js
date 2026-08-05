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
import { Disposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { IMarkerService } from "../../../../../../platform/markers/common/markers.js";
import { INotebookExecutionStateService, NotebookExecutionType } from "../../../common/notebookExecutionStateService.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { CellKind, NotebookSetting } from "../../../common/notebookCommon.js";
import { registerNotebookContribution } from "../../notebookEditorExtensions.js";
import { CodeCellViewModel } from "../../viewModel/codeCellViewModel.js";
import { Event } from "../../../../../../base/common/event.js";
import { IChatAgentService } from "../../../../chat/common/chatAgents.js";
import { ChatAgentLocation } from "../../../../chat/common/constants.js";
let CellDiagnostics = class extends Disposable {
  constructor(notebookEditor, notebookExecutionStateService, markerService, chatAgentService, configurationService) {
    super();
    this.notebookEditor = notebookEditor;
    this.notebookExecutionStateService = notebookExecutionStateService;
    this.markerService = markerService;
    this.chatAgentService = chatAgentService;
    this.configurationService = configurationService;
    this.enabled = false;
    this.listening = false;
    this.diagnosticsByHandle = /* @__PURE__ */ new Map();
    this.updateEnabled();
    this._register(chatAgentService.onDidChangeAgents(() => this.updateEnabled()));
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(NotebookSetting.cellFailureDiagnostics)) {
        this.updateEnabled();
      }
    }));
  }
  hasNotebookAgent() {
    const agents = this.chatAgentService.getAgents();
    return !!agents.find((agent) => agent.locations.includes(ChatAgentLocation.Notebook));
  }
  updateEnabled() {
    const settingEnabled = this.configurationService.getValue(NotebookSetting.cellFailureDiagnostics);
    if (this.enabled && (!settingEnabled || !this.hasNotebookAgent())) {
      this.enabled = false;
      this.clearAll();
    } else if (!this.enabled && settingEnabled && this.hasNotebookAgent()) {
      this.enabled = true;
      if (!this.listening) {
        this.listening = true;
        this._register(Event.accumulate(
          this.notebookExecutionStateService.onDidChangeExecution,
          200
        )((e) => this.handleChangeExecutionState(e)));
      }
    }
  }
  handleChangeExecutionState(changes) {
    if (!this.enabled) {
      return;
    }
    const handled = /* @__PURE__ */ new Set();
    for (const e of changes.reverse()) {
      const notebookUri = this.notebookEditor.textModel?.uri;
      if (e.type === NotebookExecutionType.cell && notebookUri && e.affectsNotebook(notebookUri) && !handled.has(e.cellHandle)) {
        handled.add(e.cellHandle);
        if (!!e.changed) {
          this.clear(e.cellHandle);
        } else {
          this.setDiagnostics(e.cellHandle);
        }
      }
    }
  }
  clearAll() {
    for (const handle of this.diagnosticsByHandle.keys()) {
      this.clear(handle);
    }
  }
  clear(cellHandle) {
    const disposables = this.diagnosticsByHandle.get(cellHandle);
    if (disposables) {
      for (const disposable of disposables) {
        disposable.dispose();
      }
      this.diagnosticsByHandle.delete(cellHandle);
    }
  }
  setDiagnostics(cellHandle) {
    if (this.diagnosticsByHandle.has(cellHandle)) {
      return;
    }
    const cell = this.notebookEditor.getCellByHandle(cellHandle);
    if (!cell || cell.cellKind !== CellKind.Code) {
      return;
    }
    const metadata = cell.model.internalMetadata;
    if (cell instanceof CodeCellViewModel && !metadata.lastRunSuccess && metadata?.error?.location) {
      const disposables = [];
      const errorLabel = metadata.error.name ? `${metadata.error.name}: ${metadata.error.message}` : metadata.error.message;
      const marker = this.createMarkerData(errorLabel, metadata.error.location);
      this.markerService.changeOne(CellDiagnostics.ID, cell.uri, [marker]);
      disposables.push(toDisposable(() => this.markerService.changeOne(CellDiagnostics.ID, cell.uri, [])));
      cell.executionErrorDiagnostic.set(metadata.error, void 0);
      disposables.push(toDisposable(() => cell.executionErrorDiagnostic.set(void 0, void 0)));
      disposables.push(cell.model.onDidChangeOutputs(() => {
        if (cell.model.outputs.length === 0) {
          this.clear(cellHandle);
        }
      }));
      disposables.push(cell.model.onDidChangeContent(() => {
        this.clear(cellHandle);
      }));
      this.diagnosticsByHandle.set(cellHandle, disposables);
    }
  }
  createMarkerData(message, location) {
    return {
      severity: 8,
      message,
      startLineNumber: location.startLineNumber + 1,
      startColumn: location.startColumn + 1,
      endLineNumber: location.endLineNumber + 1,
      endColumn: location.endColumn + 1,
      source: "Cell Execution Error"
    };
  }
  dispose() {
    super.dispose();
    this.clearAll();
  }
};
CellDiagnostics.ID = "workbench.notebook.cellDiagnostics";
CellDiagnostics = __decorateClass([
  __decorateParam(1, INotebookExecutionStateService),
  __decorateParam(2, IMarkerService),
  __decorateParam(3, IChatAgentService),
  __decorateParam(4, IConfigurationService)
], CellDiagnostics);
registerNotebookContribution(CellDiagnostics.ID, CellDiagnostics);
export {
  CellDiagnostics
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyaWIvY2VsbERpYWdub3N0aWNzL2NlbGxEaWFnbm9zdGljRWRpdG9yQ29udHJpYi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSU1hcmtlckRhdGEsIElNYXJrZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2Vycy5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSUNlbGxFeGVjdXRpb25TdGF0ZUNoYW5nZWRFdmVudCwgSUV4ZWN1dGlvblN0YXRlQ2hhbmdlZEV2ZW50LCBJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UsIE5vdGVib29rRXhlY3V0aW9uVHlwZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9ub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENlbGxLaW5kLCBOb3RlYm9va1NldHRpbmcgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRWRpdG9yLCBJTm90ZWJvb2tFZGl0b3JDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi9ub3RlYm9va0Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJOb3RlYm9va0NvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uL25vdGVib29rRWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBDb2RlQ2VsbFZpZXdNb2RlbCB9IGZyb20gJy4uLy4uL3ZpZXdNb2RlbC9jb2RlQ2VsbFZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElDaGF0QWdlbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY2hhdC9jb21tb24vY2hhdEFnZW50cy5qcyc7XG5pbXBvcnQgeyBDaGF0QWdlbnRMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NoYXQvY29tbW9uL2NvbnN0YW50cy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBDZWxsRGlhZ25vc3RpY3MgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSU5vdGVib29rRWRpdG9yQ29udHJpYnV0aW9uIHtcblxuXHRzdGF0aWMgSUQ6IHN0cmluZyA9ICd3b3JrYmVuY2gubm90ZWJvb2suY2VsbERpYWdub3N0aWNzJztcblxuXHRwcml2YXRlIGVuYWJsZWQgPSBmYWxzZTtcblx0cHJpdmF0ZSBsaXN0ZW5pbmcgPSBmYWxzZTtcblx0cHJpdmF0ZSBkaWFnbm9zdGljc0J5SGFuZGxlOiBNYXA8bnVtYmVyLCBJRGlzcG9zYWJsZVtdPiA9IG5ldyBNYXAoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IG5vdGVib29rRWRpdG9yOiBJTm90ZWJvb2tFZGl0b3IsXG5cdFx0QElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlOiBJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UsXG5cdFx0QElNYXJrZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWFya2VyU2VydmljZTogSU1hcmtlclNlcnZpY2UsXG5cdFx0QElDaGF0QWdlbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdEFnZW50U2VydmljZTogSUNoYXRBZ2VudFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMudXBkYXRlRW5hYmxlZCgpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoY2hhdEFnZW50U2VydmljZS5vbkRpZENoYW5nZUFnZW50cygoKSA9PiB0aGlzLnVwZGF0ZUVuYWJsZWQoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbigoZSkgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTm90ZWJvb2tTZXR0aW5nLmNlbGxGYWlsdXJlRGlhZ25vc3RpY3MpKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlRW5hYmxlZCgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgaGFzTm90ZWJvb2tBZ2VudCgpOiBib29sZWFuIHtcblx0XHRjb25zdCBhZ2VudHMgPSB0aGlzLmNoYXRBZ2VudFNlcnZpY2UuZ2V0QWdlbnRzKCk7XG5cdFx0cmV0dXJuICEhYWdlbnRzLmZpbmQoYWdlbnQgPT4gYWdlbnQubG9jYXRpb25zLmluY2x1ZGVzKENoYXRBZ2VudExvY2F0aW9uLk5vdGVib29rKSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUVuYWJsZWQoKSB7XG5cdFx0Y29uc3Qgc2V0dGluZ0VuYWJsZWQgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKE5vdGVib29rU2V0dGluZy5jZWxsRmFpbHVyZURpYWdub3N0aWNzKTtcblx0XHRpZiAodGhpcy5lbmFibGVkICYmICghc2V0dGluZ0VuYWJsZWQgfHwgIXRoaXMuaGFzTm90ZWJvb2tBZ2VudCgpKSkge1xuXHRcdFx0dGhpcy5lbmFibGVkID0gZmFsc2U7XG5cdFx0XHR0aGlzLmNsZWFyQWxsKCk7XG5cdFx0fSBlbHNlIGlmICghdGhpcy5lbmFibGVkICYmIHNldHRpbmdFbmFibGVkICYmIHRoaXMuaGFzTm90ZWJvb2tBZ2VudCgpKSB7XG5cdFx0XHR0aGlzLmVuYWJsZWQgPSB0cnVlO1xuXHRcdFx0aWYgKCF0aGlzLmxpc3RlbmluZykge1xuXHRcdFx0XHR0aGlzLmxpc3RlbmluZyA9IHRydWU7XG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmFjY3VtdWxhdGU8SUNlbGxFeGVjdXRpb25TdGF0ZUNoYW5nZWRFdmVudCB8IElFeGVjdXRpb25TdGF0ZUNoYW5nZWRFdmVudD4oXG5cdFx0XHRcdFx0dGhpcy5ub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZS5vbkRpZENoYW5nZUV4ZWN1dGlvbiwgMjAwXG5cdFx0XHRcdCkoKGUpID0+IHRoaXMuaGFuZGxlQ2hhbmdlRXhlY3V0aW9uU3RhdGUoZSkpKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZUNoYW5nZUV4ZWN1dGlvblN0YXRlKGNoYW5nZXM6IChJQ2VsbEV4ZWN1dGlvblN0YXRlQ2hhbmdlZEV2ZW50IHwgSUV4ZWN1dGlvblN0YXRlQ2hhbmdlZEV2ZW50KVtdKSB7XG5cdFx0aWYgKCF0aGlzLmVuYWJsZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBoYW5kbGVkID0gbmV3IFNldDxudW1iZXI+KCk7XG5cdFx0Zm9yIChjb25zdCBlIG9mIGNoYW5nZXMucmV2ZXJzZSgpKSB7XG5cblx0XHRcdGNvbnN0IG5vdGVib29rVXJpID0gdGhpcy5ub3RlYm9va0VkaXRvci50ZXh0TW9kZWw/LnVyaTtcblx0XHRcdGlmIChlLnR5cGUgPT09IE5vdGVib29rRXhlY3V0aW9uVHlwZS5jZWxsICYmIG5vdGVib29rVXJpICYmIGUuYWZmZWN0c05vdGVib29rKG5vdGVib29rVXJpKSAmJiAhaGFuZGxlZC5oYXMoZS5jZWxsSGFuZGxlKSkge1xuXHRcdFx0XHRoYW5kbGVkLmFkZChlLmNlbGxIYW5kbGUpO1xuXHRcdFx0XHRpZiAoISFlLmNoYW5nZWQpIHtcblx0XHRcdFx0XHQvLyBjZWxsIGlzIHJ1bm5pbmdcblx0XHRcdFx0XHR0aGlzLmNsZWFyKGUuY2VsbEhhbmRsZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5zZXREaWFnbm9zdGljcyhlLmNlbGxIYW5kbGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjbGVhckFsbCgpIHtcblx0XHRmb3IgKGNvbnN0IGhhbmRsZSBvZiB0aGlzLmRpYWdub3N0aWNzQnlIYW5kbGUua2V5cygpKSB7XG5cdFx0XHR0aGlzLmNsZWFyKGhhbmRsZSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGNsZWFyKGNlbGxIYW5kbGU6IG51bWJlcikge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gdGhpcy5kaWFnbm9zdGljc0J5SGFuZGxlLmdldChjZWxsSGFuZGxlKTtcblx0XHRpZiAoZGlzcG9zYWJsZXMpIHtcblx0XHRcdGZvciAoY29uc3QgZGlzcG9zYWJsZSBvZiBkaXNwb3NhYmxlcykge1xuXHRcdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuZGlhZ25vc3RpY3NCeUhhbmRsZS5kZWxldGUoY2VsbEhhbmRsZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzZXREaWFnbm9zdGljcyhjZWxsSGFuZGxlOiBudW1iZXIpIHtcblx0XHRpZiAodGhpcy5kaWFnbm9zdGljc0J5SGFuZGxlLmhhcyhjZWxsSGFuZGxlKSkge1xuXHRcdFx0Ly8gbXVsdGlwbGUgZGlhZ25vc3RpY3MgcGVyIGNlbGwgbm90IHN1cHBvcnRlZCBmb3Igbm93XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2VsbCA9IHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0Q2VsbEJ5SGFuZGxlKGNlbGxIYW5kbGUpO1xuXHRcdGlmICghY2VsbCB8fCBjZWxsLmNlbGxLaW5kICE9PSBDZWxsS2luZC5Db2RlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWV0YWRhdGEgPSBjZWxsLm1vZGVsLmludGVybmFsTWV0YWRhdGE7XG5cdFx0aWYgKGNlbGwgaW5zdGFuY2VvZiBDb2RlQ2VsbFZpZXdNb2RlbCAmJiAhbWV0YWRhdGEubGFzdFJ1blN1Y2Nlc3MgJiYgbWV0YWRhdGE/LmVycm9yPy5sb2NhdGlvbikge1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZXM6IElEaXNwb3NhYmxlW10gPSBbXTtcblx0XHRcdGNvbnN0IGVycm9yTGFiZWwgPSBtZXRhZGF0YS5lcnJvci5uYW1lID8gYCR7bWV0YWRhdGEuZXJyb3IubmFtZX06ICR7bWV0YWRhdGEuZXJyb3IubWVzc2FnZX1gIDogbWV0YWRhdGEuZXJyb3IubWVzc2FnZTtcblx0XHRcdGNvbnN0IG1hcmtlciA9IHRoaXMuY3JlYXRlTWFya2VyRGF0YShlcnJvckxhYmVsLCBtZXRhZGF0YS5lcnJvci5sb2NhdGlvbik7XG5cdFx0XHR0aGlzLm1hcmtlclNlcnZpY2UuY2hhbmdlT25lKENlbGxEaWFnbm9zdGljcy5JRCwgY2VsbC51cmksIFttYXJrZXJdKTtcblx0XHRcdGRpc3Bvc2FibGVzLnB1c2godG9EaXNwb3NhYmxlKCgpID0+IHRoaXMubWFya2VyU2VydmljZS5jaGFuZ2VPbmUoQ2VsbERpYWdub3N0aWNzLklELCBjZWxsLnVyaSwgW10pKSk7XG5cdFx0XHRjZWxsLmV4ZWN1dGlvbkVycm9yRGlhZ25vc3RpYy5zZXQobWV0YWRhdGEuZXJyb3IsIHVuZGVmaW5lZCk7XG5cdFx0XHRkaXNwb3NhYmxlcy5wdXNoKHRvRGlzcG9zYWJsZSgoKSA9PiBjZWxsLmV4ZWN1dGlvbkVycm9yRGlhZ25vc3RpYy5zZXQodW5kZWZpbmVkLCB1bmRlZmluZWQpKSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5wdXNoKGNlbGwubW9kZWwub25EaWRDaGFuZ2VPdXRwdXRzKCgpID0+IHtcblx0XHRcdFx0aWYgKGNlbGwubW9kZWwub3V0cHV0cy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHR0aGlzLmNsZWFyKGNlbGxIYW5kbGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5wdXNoKGNlbGwubW9kZWwub25EaWRDaGFuZ2VDb250ZW50KCgpID0+IHtcblx0XHRcdFx0dGhpcy5jbGVhcihjZWxsSGFuZGxlKTtcblx0XHRcdH0pKTtcblx0XHRcdHRoaXMuZGlhZ25vc3RpY3NCeUhhbmRsZS5zZXQoY2VsbEhhbmRsZSwgZGlzcG9zYWJsZXMpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlTWFya2VyRGF0YShtZXNzYWdlOiBzdHJpbmcsIGxvY2F0aW9uOiBJUmFuZ2UpOiBJTWFya2VyRGF0YSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHNldmVyaXR5OiA4LFxuXHRcdFx0bWVzc2FnZTogbWVzc2FnZSxcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogbG9jYXRpb24uc3RhcnRMaW5lTnVtYmVyICsgMSxcblx0XHRcdHN0YXJ0Q29sdW1uOiBsb2NhdGlvbi5zdGFydENvbHVtbiArIDEsXG5cdFx0XHRlbmRMaW5lTnVtYmVyOiBsb2NhdGlvbi5lbmRMaW5lTnVtYmVyICsgMSxcblx0XHRcdGVuZENvbHVtbjogbG9jYXRpb24uZW5kQ29sdW1uICsgMSxcblx0XHRcdHNvdXJjZTogJ0NlbGwgRXhlY3V0aW9uIEVycm9yJ1xuXHRcdH07XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLmNsZWFyQWxsKCk7XG5cdH1cblxufVxuXG5yZWdpc3Rlck5vdGVib29rQ29udHJpYnV0aW9uKENlbGxEaWFnbm9zdGljcy5JRCwgQ2VsbERpYWdub3N0aWNzKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxZQUF5QixvQkFBb0I7QUFDdEQsU0FBc0Isc0JBQXNCO0FBRTVDLFNBQXVFLGdDQUFnQyw2QkFBNkI7QUFDcEksU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxVQUFVLHVCQUF1QjtBQUUxQyxTQUFTLG9DQUFvQztBQUM3QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGFBQWE7QUFDdEIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx5QkFBeUI7QUFFM0IsSUFBTSxrQkFBTixjQUE4QixXQUFrRDtBQUFBLEVBUXRGLFlBQ2tCLGdCQUNnQywrQkFDaEIsZUFDRyxrQkFDSSxzQkFDdkM7QUFDRCxVQUFNO0FBTlc7QUFDZ0M7QUFDaEI7QUFDRztBQUNJO0FBVHpDLFNBQVEsVUFBVTtBQUNsQixTQUFRLFlBQVk7QUFDcEIsU0FBUSxzQkFBa0Qsb0JBQUksSUFBSTtBQVdqRSxTQUFLLGNBQWM7QUFFbkIsU0FBSyxVQUFVLGlCQUFpQixrQkFBa0IsTUFBTSxLQUFLLGNBQWMsQ0FBQyxDQUFDO0FBQzdFLFNBQUssVUFBVSxxQkFBcUIseUJBQXlCLENBQUMsTUFBTTtBQUNuRSxVQUFJLEVBQUUscUJBQXFCLGdCQUFnQixzQkFBc0Is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
