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
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ResourceMap, ResourceSet } from "../../../../../base/common/map.js";
import { autorun } from "../../../../../base/common/observable.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { localize } from "../../../../../nls.js";
import { IChatEditingService } from "../../common/chatEditingService.js";
import { IChatWidgetService } from "../chat.js";
let ChatRelatedFilesContribution = class extends Disposable {
  constructor(chatEditingService, chatWidgetService) {
    super();
    this.chatEditingService = chatEditingService;
    this.chatWidgetService = chatWidgetService;
    this.chatEditingSessionDisposables = /* @__PURE__ */ new Map();
    this._register(autorun((reader) => {
      const sessions = this.chatEditingService.editingSessionsObs.read(reader);
      sessions.forEach((session) => {
        const widget = this.chatWidgetService.getWidgetBySessionId(session.chatSessionId);
        if (widget && !this.chatEditingSessionDisposables.has(session.chatSessionId)) {
          this._handleNewEditingSession(session, widget);
        }
      });
    }));
  }
  _updateRelatedFileSuggestions(currentEditingSession, widget) {
    if (this._currentRelatedFilesRetrievalOperation) {
      return;
    }
    const workingSetEntries = currentEditingSession.entries.get();
    if (workingSetEntries.length > 0 || widget.attachmentModel.fileAttachments.length === 0) {
      return;
    }
    this._currentRelatedFilesRetrievalOperation = this.chatEditingService.getRelatedFiles(currentEditingSession.chatSessionId, widget.getInput(), widget.attachmentModel.fileAttachments, CancellationToken.None).then((files) => {
      if (!files?.length || !widget.viewModel?.sessionId || !widget.input.relatedFiles) {
        return;
      }
      const currentEditingSession2 = this.chatEditingService.getEditingSession(widget.viewModel.sessionId);
      if (!currentEditingSession2 || currentEditingSession2.entries.get().length) {
        return;
      }
      const existingFiles = new ResourceSet([...widget.attachmentModel.fileAttachments, ...widget.input.relatedFiles.removedFiles]);
      if (!existingFiles.size) {
        return;
      }
      const newSuggestions = new ResourceMap();
      for (const group of files) {
        for (const file of group.files) {
          if (newSuggestions.size >= 2) {
            break;
          }
          if (existingFiles.has(file.uri)) {
            continue;
          }
          newSuggestions.set(file.uri, localize("relatedFile", "{0} (Suggested)", file.description));
          existingFiles.add(file.uri);
        }
      }
      widget.input.relatedFiles.value = [...newSuggestions.entries()].map(([uri, description]) => ({ uri, description }));
    }).finally(() => {
      this._currentRelatedFilesRetrievalOperation = void 0;
    });
  }
  _handleNewEditingSession(currentEditingSession, widget) {
    const disposableStore = new DisposableStore();
    disposableStore.add(currentEditingSession.onDidDispose(() => {
      disposableStore.clear();
    }));
    this._updateRelatedFileSuggestions(currentEditingSession, widget);
    const onDebouncedType = Event.debounce(widget.inputEditor.onDidChangeModelContent, () => null, 3e3);
    disposableStore.add(onDebouncedType(() => {
      this._updateRelatedFileSuggestions(currentEditingSession, widget);
    }));
    disposableStore.add(widget.attachmentModel.onDidChangeContext(() => {
      this._updateRelatedFileSuggestions(currentEditingSession, widget);
    }));
    disposableStore.add(currentEditingSession.onDidDispose(() => {
      disposableStore.dispose();
    }));
    disposableStore.add(widget.onDidAcceptInput(() => {
      widget.input.relatedFiles?.clear();
      this._updateRelatedFileSuggestions(currentEditingSession, widget);
    }));
    this.chatEditingSessionDisposables.set(currentEditingSession.chatSessionId, disposableStore);
  }
  dispose() {
    for (const store of this.chatEditingSessionDisposables.values()) {
      store.dispose();
    }
    super.dispose();
  }
};
ChatRelatedFilesContribution.ID = "chat.relatedFilesWorkingSet";
ChatRelatedFilesContribution = __decorateClass([
  __decorateParam(0, IChatEditingService),
  __decorateParam(1, IChatWidgetService)
], ChatRelatedFilesContribution);
class ChatRelatedFiles extends Disposable {
  constructor() {
    super(...arguments);
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._removedFiles = new ResourceSet();
    this._value = [];
  }
  get removedFiles() {
    return this._removedFiles;
  }
  get value() {
    return this._value;
  }
  set value(value) {
    this._value = value;
    this._onDidChange.fire();
  }
  remove(uri) {
    this._value = this._value.filter((file) => !isEqual(file.uri, uri));
    this._removedFiles.add(uri);
    this._onDidChange.fire();
  }
  clearRemovedFiles() {
    this._removedFiles.clear();
  }
  clear() {
    this._value = [];
    this._removedFiles.clear();
    this._onDidChange.fire();
  }
}
export {
  ChatRelatedFiles,
  ChatRelatedFilesContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY29udHJpYi9jaGF0SW5wdXRSZWxhdGVkRmlsZXNDb250cmliLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAsIFJlc291cmNlU2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IGF1dG9ydW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ2hhdEVkaXRpbmdTZXJ2aWNlLCBJQ2hhdEVkaXRpbmdTZXNzaW9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRFZGl0aW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ2hhdFdpZGdldCwgSUNoYXRXaWRnZXRTZXJ2aWNlIH0gZnJvbSAnLi4vY2hhdC5qcyc7XG5cbmV4cG9ydCBjbGFzcyBDaGF0UmVsYXRlZEZpbGVzQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnY2hhdC5yZWxhdGVkRmlsZXNXb3JraW5nU2V0JztcblxuXHRwcml2YXRlIHJlYWRvbmx5IGNoYXRFZGl0aW5nU2Vzc2lvbkRpc3Bvc2FibGVzID0gbmV3IE1hcDxzdHJpbmcsIERpc3Bvc2FibGVTdG9yZT4oKTtcblx0cHJpdmF0ZSBfY3VycmVudFJlbGF0ZWRGaWxlc1JldHJpZXZhbE9wZXJhdGlvbjogUHJvbWlzZTx2b2lkPiB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNoYXRFZGl0aW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNoYXRFZGl0aW5nU2VydmljZTogSUNoYXRFZGl0aW5nU2VydmljZSxcblx0XHRASUNoYXRXaWRnZXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdFdpZGdldFNlcnZpY2U6IElDaGF0V2lkZ2V0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4oKHJlYWRlcikgPT4ge1xuXHRcdFx0Y29uc3Qgc2Vzc2lvbnMgPSB0aGlzLmNoYXRFZGl0aW5nU2VydmljZS5lZGl0aW5nU2Vzc2lvbnNPYnMucmVhZChyZWFkZXIpO1xuXHRcdFx0c2Vzc2lvbnMuZm9yRWFjaChzZXNzaW9uID0+IHtcblx0XHRcdFx0Y29uc3Qgd2lkZ2V0ID0gdGhpcy5jaGF0V2lkZ2V0U2VydmljZS5nZXRXaWRnZXRCeVNlc3Npb25JZChzZXNzaW9uLmNoYXRTZXNzaW9uSWQpO1xuXHRcdFx0XHRpZiAod2lkZ2V0ICYmICF0aGlzLmNoYXRFZGl0aW5nU2Vzc2lvbkRpc3Bvc2FibGVzLmhhcyhzZXNzaW9uLmNoYXRTZXNzaW9uSWQpKSB7XG5cdFx0XHRcdFx0dGhpcy5faGFuZGxlTmV3RWRpdGluZ1Nlc3Npb24oc2Vzc2lvbiwgd2lkZ2V0KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlUmVsYXRlZEZpbGVTdWdnZXN0aW9ucyhjdXJyZW50RWRpdGluZ1Nlc3Npb246IElDaGF0RWRpdGluZ1Nlc3Npb24sIHdpZGdldDogSUNoYXRXaWRnZXQpIHtcblx0XHRpZiAodGhpcy5fY3VycmVudFJlbGF0ZWRGaWxlc1JldHJpZXZhbE9wZXJhdGlvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHdvcmtpbmdTZXRFbnRyaWVzID0gY3VycmVudEVkaXRpbmdTZXNzaW9uLmVudHJpZXMuZ2V0KCk7XG5cdFx0aWYgKHdvcmtpbmdTZXRFbnRyaWVzLmxlbmd0aCA+IDAgfHwgd2lkZ2V0LmF0dGFjaG1lbnRNb2RlbC5maWxlQXR0YWNobWVudHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHQvLyBEbyB0aGlzIG9ubHkgZm9yIHRoZSBpbml0aWFsIHdvcmtpbmcgc2V0IHN0YXRlXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fY3VycmVudFJlbGF0ZWRGaWxlc1JldHJpZXZhbE9wZXJhdGlvbiA9IHRoaXMuY2hhdEVkaXRpbmdTZXJ2aWNlLmdldFJlbGF0ZWRGaWxlcyhjdXJyZW50RWRpdGluZ1Nlc3Npb24uY2hhdFNlc3Npb25JZCwgd2lkZ2V0LmdldElucHV0KCksIHdpZGdldC5hdHRhY2htZW50TW9kZWwuZmlsZUF0dGFjaG1lbnRzLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKVxuXHRcdFx0LnRoZW4oKGZpbGVzKSA9PiB7XG5cdFx0XHRcdGlmICghZmlsZXM/Lmxlbmd0aCB8fCAhd2lkZ2V0LnZpZXdNb2RlbD8uc2Vzc2lvbklkIHx8ICF3aWRnZXQuaW5wdXQucmVsYXRlZEZpbGVzKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgY3VycmVudEVkaXRpbmdTZXNzaW9uID0gdGhpcy5jaGF0RWRpdGluZ1NlcnZpY2UuZ2V0RWRpdGluZ1Nlc3Npb24od2lkZ2V0LnZpZXdNb2RlbC5zZXNzaW9uSWQpO1xuXHRcdFx0XHRpZiAoIWN1cnJlbnRFZGl0aW5nU2Vzc2lvbiB8fCBjdXJyZW50RWRpdGluZ1Nlc3Npb24uZW50cmllcy5nZXQoKS5sZW5ndGgpIHtcblx0XHRcdFx0XHRyZXR1cm47IC8vIE1pZ2h0IGhhdmUgZGlzcG9zZWQgd2hpbGUgd2Ugd2VyZSBjYWxjdWxhdGluZ1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgZXhpc3RpbmdGaWxlcyA9IG5ldyBSZXNvdXJjZVNldChbLi4ud2lkZ2V0LmF0dGFjaG1lbnRNb2RlbC5maWxlQXR0YWNobWVudHMsIC4uLndpZGdldC5pbnB1dC5yZWxhdGVkRmlsZXMucmVtb3ZlZEZpbGVzXSk7XG5cdFx0XHRcdGlmICghZXhpc3RpbmdGaWxlcy5zaXplKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gUGljayB1cCB0byAyIHJlbGF0ZWQgZmlsZXNcblx0XHRcdFx0Y29uc3QgbmV3U3VnZ2VzdGlvbnMgPSBuZXcgUmVzb3VyY2VNYXA8c3RyaW5nPigpO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGdyb3VwIG9mIGZpbGVzKSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBmaWxlIG9mIGdyb3VwLmZpbGVzKSB7XG5cdFx0XHRcdFx0XHRpZiAobmV3U3VnZ2VzdGlvbnMuc2l6ZSA+PSAyKSB7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKGV4aXN0aW5nRmlsZXMuaGFzKGZpbGUudXJpKSkge1xuXHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdG5ld1N1Z2dlc3Rpb25zLnNldChmaWxlLnVyaSwgbG9jYWxpemUoJ3JlbGF0ZWRGaWxlJywgXCJ7MH0gKFN1Z2dlc3RlZClcIiwgZmlsZS5kZXNjcmlwdGlvbikpO1xuXHRcdFx0XHRcdFx0ZXhpc3RpbmdGaWxlcy5hZGQoZmlsZS51cmkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHdpZGdldC5pbnB1dC5yZWxhdGVkRmlsZXMudmFsdWUgPSBbLi4ubmV3U3VnZ2VzdGlvbnMuZW50cmllcygpXS5tYXAoKFt1cmksIGRlc2NyaXB0aW9uXSkgPT4gKHsgdXJpLCBkZXNjcmlwdGlvbiB9KSk7XG5cdFx0XHR9KVxuXHRcdFx0LmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9jdXJyZW50UmVsYXRlZEZpbGVzUmV0cmlldmFsT3BlcmF0aW9uID0gdW5kZWZpbmVkO1xuXHRcdFx0fSk7XG5cblx0fVxuXG5cdHByaXZhdGUgX2hhbmRsZU5ld0VkaXRpbmdTZXNzaW9uKGN1cnJlbnRFZGl0aW5nU2Vzc2lvbjogSUNoYXRFZGl0aW5nU2Vzc2lvbiwgd2lkZ2V0OiBJQ2hhdFdpZGdldCkge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKGN1cnJlbnRFZGl0aW5nU2Vzc2lvbi5vbkRpZERpc3Bvc2UoKCkgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZVN0b3JlLmNsZWFyKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3VwZGF0ZVJlbGF0ZWRGaWxlU3VnZ2VzdGlvbnMoY3VycmVudEVkaXRpbmdTZXNzaW9uLCB3aWRnZXQpO1xuXHRcdGNvbnN0IG9uRGVib3VuY2VkVHlwZSA9IEV2ZW50LmRlYm91bmNlKHdpZGdldC5pbnB1dEVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCwgKCkgPT4gbnVsbCwgMzAwMCk7XG5cdFx0ZGlzcG9zYWJsZVN0b3JlLmFkZChvbkRlYm91bmNlZFR5cGUoKCkgPT4ge1xuXHRcdFx0dGhpcy5fdXBkYXRlUmVsYXRlZEZpbGVTdWdnZXN0aW9ucyhjdXJyZW50RWRpdGluZ1Nlc3Npb24sIHdpZGdldCk7XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQod2lkZ2V0LmF0dGFjaG1lbnRNb2RlbC5vbkRpZENoYW5nZUNvbnRleHQoKCkgPT4ge1xuXHRcdFx0dGhpcy5fdXBkYXRlUmVsYXRlZEZpbGVTdWdnZXN0aW9ucyhjdXJyZW50RWRpdGluZ1Nlc3Npb24sIHdpZGdldCk7XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQoY3VycmVudEVkaXRpbmdTZXNzaW9uLm9uRGlkRGlzcG9zZSgoKSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlU3RvcmUuZGlzcG9zZSgpO1xuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKHdpZGdldC5vbkRpZEFjY2VwdElucHV0KCgpID0+IHtcblx0XHRcdHdpZGdldC5pbnB1dC5yZWxhdGVkRmlsZXM/LmNsZWFyKCk7XG5cdFx0XHR0aGlzLl91cGRhdGVSZWxhdGVkRmlsZVN1Z2dlc3Rpb25zKGN1cnJlbnRFZGl0aW5nU2Vzc2lvbiwgd2lkZ2V0KTtcblx0XHR9KSk7XG5cdFx0dGhpcy5jaGF0RWRpdGluZ1Nlc3Npb25EaXNwb3NhYmxlcy5zZXQoY3VycmVudEVkaXRpbmdTZXNzaW9uLmNoYXRTZXNzaW9uSWQsIGRpc3Bvc2FibGVTdG9yZSk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdGZvciAoY29uc3Qgc3RvcmUgb2YgdGhpcy5jaGF0RWRpdGluZ1Nlc3Npb25EaXNwb3NhYmxlcy52YWx1ZXMoKSkge1xuXHRcdFx0c3RvcmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdFJlbGF0ZWRGaWxlIHtcblx0dXJpOiBVUkk7XG5cdGRlc2NyaXB0aW9uOiBzdHJpbmc7XG59XG5leHBvcnQgY2xhc3MgQ2hhdFJlbGF0ZWRGaWxlcyBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgX3JlbW92ZWRGaWxlcyA9IG5ldyBSZXNvdXJjZVNldCgpO1xuXHRnZXQgcmVtb3ZlZEZpbGVzKCkge1xuXHRcdHJldHVybiB0aGlzLl9yZW1vdmVkRmlsZXM7XG5cdH1cblxuXHRwcml2YXRlIF92YWx1ZTogSUNoYXRSZWxhdGVkRmlsZVtdID0gW107XG5cdGdldCB2YWx1ZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fdmFsdWU7XG5cdH1cblxuXHRzZXQgdmFsdWUodmFsdWU6IElDaGF0UmVsYXRlZEZpbGVbXSkge1xuXHRcdHRoaXMuX3ZhbHVlID0gdmFsdWU7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSgpO1xuXHR9XG5cblx0cmVtb3ZlKHVyaTogVVJJKSB7XG5cdFx0dGhpcy5fdmFsdWUgPSB0aGlzLl92YWx1ZS5maWx0ZXIoZmlsZSA9PiAhaXNFcXVhbChmaWxlLnVyaSwgdXJpKSk7XG5cdFx0dGhpcy5fcmVtb3ZlZEZpbGVzLmFkZCh1cmkpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoKTtcblx0fVxuXG5cdGNsZWFyUmVtb3ZlZEZpbGVzKCkge1xuXHRcdHRoaXMuX3JlbW92ZWRGaWxlcy5jbGVhcigpO1xuXHR9XG5cblx0Y2xlYXIoKSB7XG5cdFx0dGhpcy5fdmFsdWUgPSBbXTtcblx0XHR0aGlzLl9yZW1vdmVkRmlsZXMuY2xlYXIoKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxZQUFZLHVCQUF1QjtBQUM1QyxTQUFTLGFBQWEsbUJBQW1CO0FBQ3pDLFNBQVMsZUFBZTtBQUN4QixTQUFTLGVBQWU7QUFFeEIsU0FBUyxnQkFBZ0I7QUFFekIsU0FBUywyQkFBZ0Q7QUFDekQsU0FBc0IsMEJBQTBCO0FBRXpDLElBQU0sK0JBQU4sY0FBMkMsV0FBNkM7QUFBQSxFQU05RixZQUN1QyxvQkFDRCxtQkFDcEM7QUFDRCxVQUFNO0FBSGdDO0FBQ0Q7QUFMdEMsU0FBaUIsZ0NBQWdDLG9CQUFJLElBQTZCO0FBU2pGLFNBQUssVUFBVSxRQUFRLENBQUMsV0FBVztBQUNsQyxZQUFNLFdBQVcsS0FBSyxtQkFBbUIsbUJBQW1CLEtBQUssTUFBTTtBQUN2RSxlQUFTLFFBQVEsYUFBVztBQUMzQixjQUFNLFNBQVMsS0FBSyxrQkFBa0IscUJBQXFCLFFBQVEsYUFBYTtBQUNoRixZQUFJLFVBQVUsQ0FBQyxLQUFLLDhCQUE4QixJQUFJLFFBQVEsYUFBYSxHQUFHO0FBQzdFLGVBQUsseUJBQXlCLFNBQVMsTUFBTTtBQUFBLFFBQzlDO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRixDQUFDLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFUSw4QkFBOEIsdUJBQTRDLFFBQXFCO0FBQ3RHLFFBQUksS0FBSyx3Q0FBd0M7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
