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
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { autorun } from "../../../../../base/common/observable.js";
import { basename } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { isCodeEditor, isDiffEditor } from "../../../../../editor/browser/editorBrowser.js";
import { ICodeEditorService } from "../../../../../editor/browser/services/codeEditorService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { EditorsOrder } from "../../../../common/editor.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { getNotebookEditorFromEditorPane } from "../../../notebook/browser/notebookBrowser.js";
import { IChatEditingService } from "../../common/chatEditingService.js";
import { IChatService } from "../../common/chatService.js";
import { ChatAgentLocation } from "../../common/constants.js";
import { ILanguageModelIgnoredFilesService } from "../../common/ignoredFiles.js";
import { IChatWidgetService } from "../chat.js";
let ChatImplicitContextContribution = class extends Disposable {
  constructor(codeEditorService, editorService, chatWidgetService, chatService, chatEditingService, configurationService, ignoredFilesService) {
    super();
    this.codeEditorService = codeEditorService;
    this.editorService = editorService;
    this.chatWidgetService = chatWidgetService;
    this.chatService = chatService;
    this.chatEditingService = chatEditingService;
    this.configurationService = configurationService;
    this.ignoredFilesService = ignoredFilesService;
    this._currentCancelTokenSource = this._register(new MutableDisposable());
    this._implicitContextEnablement = this.configurationService.getValue("chat.implicitContext.enabled");
    const activeEditorDisposables = this._register(new DisposableStore());
    this._register(Event.runAndSubscribe(
      editorService.onDidActiveEditorChange,
      () => {
        activeEditorDisposables.clear();
        const codeEditor = this.findActiveCodeEditor();
        if (codeEditor) {
          activeEditorDisposables.add(Event.debounce(
            Event.any(
              codeEditor.onDidChangeModel,
              codeEditor.onDidChangeCursorSelection,
              codeEditor.onDidScrollChange
            ),
            () => void 0,
            500
          )(() => this.updateImplicitContext()));
        }
        const notebookEditor = this.findActiveNotebookEditor();
        if (notebookEditor) {
          activeEditorDisposables.add(Event.debounce(
            Event.any(
              notebookEditor.onDidChangeModel,
              notebookEditor.onDidChangeActiveCell
            ),
            () => void 0,
            500
          )(() => this.updateImplicitContext()));
        }
        this.updateImplicitContext();
      }
    ));
    this._register(autorun((reader) => {
      this.chatEditingService.editingSessionsObs.read(reader);
      this.updateImplicitContext();
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("chat.implicitContext.enabled")) {
        this._implicitContextEnablement = this.configurationService.getValue("chat.implicitContext.enabled");
        this.updateImplicitContext();
      }
    }));
    this._register(this.chatService.onDidSubmitRequest(({ chatSessionId }) => {
      const widget = this.chatWidgetService.getWidgetBySessionId(chatSessionId);
      if (!widget?.input.implicitContext) {
        return;
      }
      if (this._implicitContextEnablement[widget.location] === "first" && widget.viewModel?.getItems().length !== 0) {
        widget.input.implicitContext.setValue(void 0, false);
      }
    }));
    this._register(this.chatWidgetService.onDidAddWidget(async (widget) => {
      await this.updateImplicitContext(widget);
    }));
  }
  findActiveCodeEditor() {
    const codeEditor = this.codeEditorService.getActiveCodeEditor();
    if (codeEditor) {
      const model = codeEditor.getModel();
      if (model?.uri.scheme === Schemas.vscodeNotebookCell) {
        return void 0;
      }
      if (model) {
        return codeEditor;
      }
    }
    for (const codeOrDiffEditor of this.editorService.getVisibleTextEditorControls(EditorsOrder.MOST_RECENTLY_ACTIVE)) {
      let codeEditor2;
      if (isDiffEditor(codeOrDiffEditor)) {
        codeEditor2 = codeOrDiffEditor.getModifiedEditor();
      } else if (isCodeEditor(codeOrDiffEditor)) {
        codeEditor2 = codeOrDiffEditor;
      } else {
        continue;
      }
      const model = codeEditor2.getModel();
      if (model) {
        return codeEditor2;
      }
    }
    return void 0;
  }
  findActiveNotebookEditor() {
    return getNotebookEditorFromEditorPane(this.editorService.activeEditorPane);
  }
  async updateImplicitContext(updateWidget) {
    const cancelTokenSource = this._currentCancelTokenSource.value = new CancellationTokenSource();
    const codeEditor = this.findActiveCodeEditor();
    const model = codeEditor?.getModel();
    const selection = codeEditor?.getSelection();
    let newValue;
    let isSelection = false;
    if (model) {
      if (selection && !selection.isEmpty()) {
        newValue = { uri: model.uri, range: selection };
        isSelection = true;
      } else {
        const visibleRanges = codeEditor?.getVisibleRanges();
        if (visibleRanges && visibleRanges.length > 0) {
          let range = visibleRanges[0];
          visibleRanges.slice(1).forEach((r) => {
            range = range.plusRange(r);
          });
          newValue = { uri: model.uri, range };
        } else {
          newValue = model.uri;
        }
      }
    }
    const notebookEditor = this.findActiveNotebookEditor();
    if (notebookEditor) {
      const activeCell = notebookEditor.getActiveCell();
      if (activeCell) {
        newValue = activeCell.uri;
      } else {
        newValue = notebookEditor.textModel?.uri;
      }
    }
    const uri = newValue instanceof URI ? newValue : newValue?.uri;
    if (uri && await this.ignoredFilesService.fileIsIgnored(uri, cancelTokenSource.token)) {
      newValue = void 0;
    }
    if (cancelTokenSource.token.isCancellationRequested) {
      return;
    }
    const widgets = updateWidget ? [updateWidget] : [...this.chatWidgetService.getWidgetsByLocations(ChatAgentLocation.Panel), ...this.chatWidgetService.getWidgetsByLocations(ChatAgentLocation.EditingSession), ...this.chatWidgetService.getWidgetsByLocations(ChatAgentLocation.Editor)];
    for (const widget of widgets) {
      if (!widget.input.implicitContext) {
        continue;
      }
      const setting = this._implicitContextEnablement[widget.location];
      const isFirstInteraction = widget.viewModel?.getItems().length === 0;
      if (setting === "first" && !isFirstInteraction) {
        widget.input.implicitContext.setValue(void 0, false);
      } else if (setting === "always" || setting === "first" && isFirstInteraction) {
        widget.input.implicitContext.setValue(newValue, isSelection);
      } else if (setting === "never") {
        widget.input.implicitContext.setValue(void 0, false);
      }
    }
  }
};
ChatImplicitContextContribution.ID = "chat.implicitContext";
ChatImplicitContextContribution = __decorateClass([
  __decorateParam(0, ICodeEditorService),
  __decorateParam(1, IEditorService),
  __decorateParam(2, IChatWidgetService),
  __decorateParam(3, IChatService),
  __decorateParam(4, IChatEditingService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, ILanguageModelIgnoredFilesService)
], ChatImplicitContextContribution);
class ChatImplicitContext extends Disposable {
  constructor(value) {
    super();
    this.kind = "implicit";
    this.isFile = true;
    this._isSelection = false;
    this._onDidChangeValue = new Emitter();
    this.onDidChangeValue = this._onDidChangeValue.event;
    this._enabled = true;
    this._value = value;
  }
  get id() {
    if (URI.isUri(this.value)) {
      return "vscode.implicit.file";
    } else if (this.value) {
      if (this._isSelection) {
        return "vscode.implicit.selection";
      } else {
        return "vscode.implicit.viewport";
      }
    } else {
      return "vscode.implicit";
    }
  }
  get name() {
    if (URI.isUri(this.value)) {
      return `file:${basename(this.value)}`;
    } else if (this.value) {
      return `file:${basename(this.value.uri)}`;
    } else {
      return "implicit";
    }
  }
  get modelDescription() {
    if (URI.isUri(this.value)) {
      return `User's active file`;
    } else if (this._isSelection) {
      return `User's active selection`;
    } else {
      return `User's current visible code`;
    }
  }
  get isSelection() {
    return this._isSelection;
  }
  get value() {
    return this._value;
  }
  get enabled() {
    return this._enabled;
  }
  set enabled(value) {
    this._enabled = value;
    this._onDidChangeValue.fire();
  }
  setValue(value, isSelection) {
    this._value = value;
    this._isSelection = isSelection;
    this._onDidChangeValue.fire();
  }
  toBaseEntry() {
    return {
      id: this.id,
      name: this.name,
      value: this.value,
      isFile: true,
      modelDescription: this.modelDescription
    };
  }
}
export {
  ChatImplicitContext,
  ChatImplicitContextContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY29udHJpYi9jaGF0SW1wbGljaXRDb250ZXh0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGF1dG9ydW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciwgaXNDb2RlRWRpdG9yLCBpc0RpZmZFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2NvZGVFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IExvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgRWRpdG9yc09yZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBnZXROb3RlYm9va0VkaXRvckZyb21FZGl0b3JQYW5lLCBJTm90ZWJvb2tFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi9ub3RlYm9vay9icm93c2VyL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBJQ2hhdEVkaXRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRFZGl0aW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQmFzZUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeSwgSUNoYXRSZXF1ZXN0SW1wbGljaXRWYXJpYWJsZUVudHJ5IH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJQ2hhdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2hhdEFnZW50TG9jYXRpb24gfSBmcm9tICcuLi8uLi9jb21tb24vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZU1vZGVsSWdub3JlZEZpbGVzU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9pZ25vcmVkRmlsZXMuanMnO1xuaW1wb3J0IHsgSUNoYXRXaWRnZXQsIElDaGF0V2lkZ2V0U2VydmljZSB9IGZyb20gJy4uL2NoYXQuanMnO1xuXG5leHBvcnQgY2xhc3MgQ2hhdEltcGxpY2l0Q29udGV4dENvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ2NoYXQuaW1wbGljaXRDb250ZXh0JztcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jdXJyZW50Q2FuY2VsVG9rZW5Tb3VyY2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8Q2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2U+KCkpO1xuXG5cdHByaXZhdGUgX2ltcGxpY2l0Q29udGV4dEVuYWJsZW1lbnQgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHsgW21vZGU6IHN0cmluZ106IHN0cmluZyB9PignY2hhdC5pbXBsaWNpdENvbnRleHQuZW5hYmxlZCcpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb2RlRWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJQ2hhdFdpZGdldFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0V2lkZ2V0U2VydmljZTogSUNoYXRXaWRnZXRTZXJ2aWNlLFxuXHRcdEBJQ2hhdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0U2VydmljZTogSUNoYXRTZXJ2aWNlLFxuXHRcdEBJQ2hhdEVkaXRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdEVkaXRpbmdTZXJ2aWNlOiBJQ2hhdEVkaXRpbmdTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VNb2RlbElnbm9yZWRGaWxlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpZ25vcmVkRmlsZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VNb2RlbElnbm9yZWRGaWxlc1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCBhY3RpdmVFZGl0b3JEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmUoXG5cdFx0XHRlZGl0b3JTZXJ2aWNlLm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlLFxuXHRcdFx0KCgpID0+IHtcblx0XHRcdFx0YWN0aXZlRWRpdG9yRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRcdFx0Y29uc3QgY29kZUVkaXRvciA9IHRoaXMuZmluZEFjdGl2ZUNvZGVFZGl0b3IoKTtcblx0XHRcdFx0aWYgKGNvZGVFZGl0b3IpIHtcblx0XHRcdFx0XHRhY3RpdmVFZGl0b3JEaXNwb3NhYmxlcy5hZGQoRXZlbnQuZGVib3VuY2UoXG5cdFx0XHRcdFx0XHRFdmVudC5hbnkoXG5cdFx0XHRcdFx0XHRcdGNvZGVFZGl0b3Iub25EaWRDaGFuZ2VNb2RlbCxcblx0XHRcdFx0XHRcdFx0Y29kZUVkaXRvci5vbkRpZENoYW5nZUN1cnNvclNlbGVjdGlvbixcblx0XHRcdFx0XHRcdFx0Y29kZUVkaXRvci5vbkRpZFNjcm9sbENoYW5nZSksXG5cdFx0XHRcdFx0XHQoKSA9PiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHQ1MDApKCgpID0+IHRoaXMudXBkYXRlSW1wbGljaXRDb250ZXh0KCkpKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IG5vdGVib29rRWRpdG9yID0gdGhpcy5maW5kQWN0aXZlTm90ZWJvb2tFZGl0b3IoKTtcblx0XHRcdFx0aWYgKG5vdGVib29rRWRpdG9yKSB7XG5cdFx0XHRcdFx0YWN0aXZlRWRpdG9yRGlzcG9zYWJsZXMuYWRkKEV2ZW50LmRlYm91bmNlKFxuXHRcdFx0XHRcdFx0RXZlbnQuYW55KFxuXHRcdFx0XHRcdFx0XHRub3RlYm9va0VkaXRvci5vbkRpZENoYW5nZU1vZGVsLFxuXHRcdFx0XHRcdFx0XHRub3RlYm9va0VkaXRvci5vbkRpZENoYW5nZUFjdGl2ZUNlbGxcblx0XHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0XHQoKSA9PiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHQ1MDApKCgpID0+IHRoaXMudXBkYXRlSW1wbGljaXRDb250ZXh0KCkpKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMudXBkYXRlSW1wbGljaXRDb250ZXh0KCk7XG5cdFx0XHR9KSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4oKHJlYWRlcikgPT4ge1xuXHRcdFx0dGhpcy5jaGF0RWRpdGluZ1NlcnZpY2UuZWRpdGluZ1Nlc3Npb25zT2JzLnJlYWQocmVhZGVyKTtcblx0XHRcdHRoaXMudXBkYXRlSW1wbGljaXRDb250ZXh0KCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2NoYXQuaW1wbGljaXRDb250ZXh0LmVuYWJsZWQnKSkge1xuXHRcdFx0XHR0aGlzLl9pbXBsaWNpdENvbnRleHRFbmFibGVtZW50ID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTx7IFttb2RlOiBzdHJpbmddOiBzdHJpbmcgfT4oJ2NoYXQuaW1wbGljaXRDb250ZXh0LmVuYWJsZWQnKTtcblx0XHRcdFx0dGhpcy51cGRhdGVJbXBsaWNpdENvbnRleHQoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jaGF0U2VydmljZS5vbkRpZFN1Ym1pdFJlcXVlc3QoKHsgY2hhdFNlc3Npb25JZCB9KSA9PiB7XG5cdFx0XHRjb25zdCB3aWRnZXQgPSB0aGlzLmNoYXRXaWRnZXRTZXJ2aWNlLmdldFdpZGdldEJ5U2Vzc2lvbklkKGNoYXRTZXNzaW9uSWQpO1xuXHRcdFx0aWYgKCF3aWRnZXQ/LmlucHV0LmltcGxpY2l0Q29udGV4dCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5faW1wbGljaXRDb250ZXh0RW5hYmxlbWVudFt3aWRnZXQubG9jYXRpb25dID09PSAnZmlyc3QnICYmIHdpZGdldC52aWV3TW9kZWw/LmdldEl0ZW1zKCkubGVuZ3RoICE9PSAwKSB7XG5cdFx0XHRcdHdpZGdldC5pbnB1dC5pbXBsaWNpdENvbnRleHQuc2V0VmFsdWUodW5kZWZpbmVkLCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY2hhdFdpZGdldFNlcnZpY2Uub25EaWRBZGRXaWRnZXQoYXN5bmMgKHdpZGdldCkgPT4ge1xuXHRcdFx0YXdhaXQgdGhpcy51cGRhdGVJbXBsaWNpdENvbnRleHQod2lkZ2V0KTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGZpbmRBY3RpdmVDb2RlRWRpdG9yKCk6IElDb2RlRWRpdG9yIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBjb2RlRWRpdG9yID0gdGhpcy5jb2RlRWRpdG9yU2VydmljZS5nZXRBY3RpdmVDb2RlRWRpdG9yKCk7XG5cdFx0aWYgKGNvZGVFZGl0b3IpIHtcblx0XHRcdGNvbnN0IG1vZGVsID0gY29kZUVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdFx0aWYgKG1vZGVsPy51cmkuc2NoZW1lID09PSBTY2hlbWFzLnZzY29kZU5vdGVib29rQ2VsbCkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAobW9kZWwpIHtcblx0XHRcdFx0cmV0dXJuIGNvZGVFZGl0b3I7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGZvciAoY29uc3QgY29kZU9yRGlmZkVkaXRvciBvZiB0aGlzLmVkaXRvclNlcnZpY2UuZ2V0VmlzaWJsZVRleHRFZGl0b3JDb250cm9scyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpKSB7XG5cdFx0XHRsZXQgY29kZUVkaXRvcjogSUNvZGVFZGl0b3I7XG5cdFx0XHRpZiAoaXNEaWZmRWRpdG9yKGNvZGVPckRpZmZFZGl0b3IpKSB7XG5cdFx0XHRcdGNvZGVFZGl0b3IgPSBjb2RlT3JEaWZmRWRpdG9yLmdldE1vZGlmaWVkRWRpdG9yKCk7XG5cdFx0XHR9IGVsc2UgaWYgKGlzQ29kZUVkaXRvcihjb2RlT3JEaWZmRWRpdG9yKSkge1xuXHRcdFx0XHRjb2RlRWRpdG9yID0gY29kZU9yRGlmZkVkaXRvcjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtb2RlbCA9IGNvZGVFZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRcdGlmIChtb2RlbCkge1xuXHRcdFx0XHRyZXR1cm4gY29kZUVkaXRvcjtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgZmluZEFjdGl2ZU5vdGVib29rRWRpdG9yKCk6IElOb3RlYm9va0VkaXRvciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIGdldE5vdGVib29rRWRpdG9yRnJvbUVkaXRvclBhbmUodGhpcy5lZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmUpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVJbXBsaWNpdENvbnRleHQodXBkYXRlV2lkZ2V0PzogSUNoYXRXaWRnZXQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjYW5jZWxUb2tlblNvdXJjZSA9IHRoaXMuX2N1cnJlbnRDYW5jZWxUb2tlblNvdXJjZS52YWx1ZSA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdGNvbnN0IGNvZGVFZGl0b3IgPSB0aGlzLmZpbmRBY3RpdmVDb2RlRWRpdG9yKCk7XG5cdFx0Y29uc3QgbW9kZWwgPSBjb2RlRWRpdG9yPy5nZXRNb2RlbCgpO1xuXHRcdGNvbnN0IHNlbGVjdGlvbiA9IGNvZGVFZGl0b3I/LmdldFNlbGVjdGlvbigpO1xuXHRcdGxldCBuZXdWYWx1ZTogTG9jYXRpb24gfCBVUkkgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGlzU2VsZWN0aW9uID0gZmFsc2U7XG5cdFx0aWYgKG1vZGVsKSB7XG5cdFx0XHRpZiAoc2VsZWN0aW9uICYmICFzZWxlY3Rpb24uaXNFbXB0eSgpKSB7XG5cdFx0XHRcdG5ld1ZhbHVlID0geyB1cmk6IG1vZGVsLnVyaSwgcmFuZ2U6IHNlbGVjdGlvbiB9IHNhdGlzZmllcyBMb2NhdGlvbjtcblx0XHRcdFx0aXNTZWxlY3Rpb24gPSB0cnVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgdmlzaWJsZVJhbmdlcyA9IGNvZGVFZGl0b3I/LmdldFZpc2libGVSYW5nZXMoKTtcblx0XHRcdFx0aWYgKHZpc2libGVSYW5nZXMgJiYgdmlzaWJsZVJhbmdlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0Ly8gTWVyZ2UgdmlzaWJsZSByYW5nZXMuIE1heWJlIHRoZSByZWZlcmVuY2UgdmFsdWUgY291bGQgYWN0dWFsbHkgYmUgYW4gYXJyYXkgb2YgTG9jYXRpb25zP1xuXHRcdFx0XHRcdC8vIFNvbWV0aGluZyBsaWtlIGEgTG9jYXRpb24gd2l0aCBhbiBhcnJheSBvZiBSYW5nZXM/XG5cdFx0XHRcdFx0bGV0IHJhbmdlID0gdmlzaWJsZVJhbmdlc1swXTtcblx0XHRcdFx0XHR2aXNpYmxlUmFuZ2VzLnNsaWNlKDEpLmZvckVhY2gociA9PiB7XG5cdFx0XHRcdFx0XHRyYW5nZSA9IHJhbmdlLnBsdXNSYW5nZShyKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRuZXdWYWx1ZSA9IHsgdXJpOiBtb2RlbC51cmksIHJhbmdlIH0gc2F0aXNmaWVzIExvY2F0aW9uO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG5ld1ZhbHVlID0gbW9kZWwudXJpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3Qgbm90ZWJvb2tFZGl0b3IgPSB0aGlzLmZpbmRBY3RpdmVOb3RlYm9va0VkaXRvcigpO1xuXHRcdGlmIChub3RlYm9va0VkaXRvcikge1xuXHRcdFx0Y29uc3QgYWN0aXZlQ2VsbCA9IG5vdGVib29rRWRpdG9yLmdldEFjdGl2ZUNlbGwoKTtcblx0XHRcdGlmIChhY3RpdmVDZWxsKSB7XG5cdFx0XHRcdG5ld1ZhbHVlID0gYWN0aXZlQ2VsbC51cmk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuZXdWYWx1ZSA9IG5vdGVib29rRWRpdG9yLnRleHRNb2RlbD8udXJpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHVyaSA9IG5ld1ZhbHVlIGluc3RhbmNlb2YgVVJJID8gbmV3VmFsdWUgOiBuZXdWYWx1ZT8udXJpO1xuXHRcdGlmICh1cmkgJiYgYXdhaXQgdGhpcy5pZ25vcmVkRmlsZXNTZXJ2aWNlLmZpbGVJc0lnbm9yZWQodXJpLCBjYW5jZWxUb2tlblNvdXJjZS50b2tlbikpIHtcblx0XHRcdG5ld1ZhbHVlID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmIChjYW5jZWxUb2tlblNvdXJjZS50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHdpZGdldHMgPSB1cGRhdGVXaWRnZXQgPyBbdXBkYXRlV2lkZ2V0XSA6IFsuLi50aGlzLmNoYXRXaWRnZXRTZXJ2aWNlLmdldFdpZGdldHNCeUxvY2F0aW9ucyhDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCksIC4uLnRoaXMuY2hhdFdpZGdldFNlcnZpY2UuZ2V0V2lkZ2V0c0J5TG9jYXRpb25zKENoYXRBZ2VudExvY2F0aW9uLkVkaXRpbmdTZXNzaW9uKSwgLi4udGhpcy5jaGF0V2lkZ2V0U2VydmljZS5nZXRXaWRnZXRzQnlMb2NhdGlvbnMoQ2hhdEFnZW50TG9jYXRpb24uRWRpdG9yKV07XG5cdFx0Zm9yIChjb25zdCB3aWRnZXQgb2Ygd2lkZ2V0cykge1xuXHRcdFx0aWYgKCF3aWRnZXQuaW5wdXQuaW1wbGljaXRDb250ZXh0KSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3Qgc2V0dGluZyA9IHRoaXMuX2ltcGxpY2l0Q29udGV4dEVuYWJsZW1lbnRbd2lkZ2V0LmxvY2F0aW9uXTtcblx0XHRcdGNvbnN0IGlzRmlyc3RJbnRlcmFjdGlvbiA9IHdpZGdldC52aWV3TW9kZWw/LmdldEl0ZW1zKCkubGVuZ3RoID09PSAwO1xuXHRcdFx0aWYgKHNldHRpbmcgPT09ICdmaXJzdCcgJiYgIWlzRmlyc3RJbnRlcmFjdGlvbikge1xuXHRcdFx0XHR3aWRnZXQuaW5wdXQuaW1wbGljaXRDb250ZXh0LnNldFZhbHVlKHVuZGVmaW5lZCwgZmFsc2UpO1xuXHRcdFx0fSBlbHNlIGlmIChzZXR0aW5nID09PSAnYWx3YXlzJyB8fCBzZXR0aW5nID09PSAnZmlyc3QnICYmIGlzRmlyc3RJbnRlcmFjdGlvbikge1xuXHRcdFx0XHR3aWRnZXQuaW5wdXQuaW1wbGljaXRDb250ZXh0LnNldFZhbHVlKG5ld1ZhbHVlLCBpc1NlbGVjdGlvbik7XG5cdFx0XHR9IGVsc2UgaWYgKHNldHRpbmcgPT09ICduZXZlcicpIHtcblx0XHRcdFx0d2lkZ2V0LmlucHV0LmltcGxpY2l0Q29udGV4dC5zZXRWYWx1ZSh1bmRlZmluZWQsIGZhbHNlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENoYXRJbXBsaWNpdENvbnRleHQgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNoYXRSZXF1ZXN0SW1wbGljaXRWYXJpYWJsZUVudHJ5IHtcblx0Z2V0IGlkKCkge1xuXHRcdGlmIChVUkkuaXNVcmkodGhpcy52YWx1ZSkpIHtcblx0XHRcdHJldHVybiAndnNjb2RlLmltcGxpY2l0LmZpbGUnO1xuXHRcdH0gZWxzZSBpZiAodGhpcy52YWx1ZSkge1xuXHRcdFx0aWYgKHRoaXMuX2lzU2VsZWN0aW9uKSB7XG5cdFx0XHRcdHJldHVybiAndnNjb2RlLmltcGxpY2l0LnNlbGVjdGlvbic7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gJ3ZzY29kZS5pbXBsaWNpdC52aWV3cG9ydCc7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiAndnNjb2RlLmltcGxpY2l0Jztcblx0XHR9XG5cdH1cblxuXHRnZXQgbmFtZSgpOiBzdHJpbmcge1xuXHRcdGlmIChVUkkuaXNVcmkodGhpcy52YWx1ZSkpIHtcblx0XHRcdHJldHVybiBgZmlsZToke2Jhc2VuYW1lKHRoaXMudmFsdWUpfWA7XG5cdFx0fSBlbHNlIGlmICh0aGlzLnZhbHVlKSB7XG5cdFx0XHRyZXR1cm4gYGZpbGU6JHtiYXNlbmFtZSh0aGlzLnZhbHVlLnVyaSl9YDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuICdpbXBsaWNpdCc7XG5cdFx0fVxuXHR9XG5cblx0cmVhZG9ubHkga2luZCA9ICdpbXBsaWNpdCc7XG5cblx0Z2V0IG1vZGVsRGVzY3JpcHRpb24oKTogc3RyaW5nIHtcblx0XHRpZiAoVVJJLmlzVXJpKHRoaXMudmFsdWUpKSB7XG5cdFx0XHRyZXR1cm4gYFVzZXIncyBhY3RpdmUgZmlsZWA7XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9pc1NlbGVjdGlvbikge1xuXHRcdFx0cmV0dXJuIGBVc2VyJ3MgYWN0aXZlIHNlbGVjdGlvbmA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBgVXNlcidzIGN1cnJlbnQgdmlzaWJsZSBjb2RlYDtcblx0XHR9XG5cdH1cblxuXHRyZWFkb25seSBpc0ZpbGUgPSB0cnVlO1xuXG5cdHByaXZhdGUgX2lzU2VsZWN0aW9uID0gZmFsc2U7XG5cdHB1YmxpYyBnZXQgaXNTZWxlY3Rpb24oKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2lzU2VsZWN0aW9uO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VWYWx1ZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVmFsdWUgPSB0aGlzLl9vbkRpZENoYW5nZVZhbHVlLmV2ZW50O1xuXG5cdHByaXZhdGUgX3ZhbHVlOiBMb2NhdGlvbiB8IFVSSSB8IHVuZGVmaW5lZDtcblx0Z2V0IHZhbHVlKCkge1xuXHRcdHJldHVybiB0aGlzLl92YWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgX2VuYWJsZWQgPSB0cnVlO1xuXHRnZXQgZW5hYmxlZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fZW5hYmxlZDtcblx0fVxuXG5cdHNldCBlbmFibGVkKHZhbHVlOiBib29sZWFuKSB7XG5cdFx0dGhpcy5fZW5hYmxlZCA9IHZhbHVlO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlVmFsdWUuZmlyZSgpO1xuXHR9XG5cblx0Y29uc3RydWN0b3IodmFsdWU/OiBMb2NhdGlvbiB8IFVSSSkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0fVxuXG5cdHNldFZhbHVlKHZhbHVlOiBMb2NhdGlvbiB8IFVSSSB8IHVuZGVmaW5lZCwgaXNTZWxlY3Rpb246IGJvb2xlYW4pIHtcblx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdHRoaXMuX2lzU2VsZWN0aW9uID0gaXNTZWxlY3Rpb247XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VWYWx1ZS5maXJlKCk7XG5cdH1cblxuXHR0b0Jhc2VFbnRyeSgpOiBJQmFzZUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGlkOiB0aGlzLmlkLFxuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0dmFsdWU6IHRoaXMudmFsdWUsXG5cdFx0XHRpc0ZpbGU6IHRydWUsXG5cdFx0XHRtb2RlbERlc2NyaXB0aW9uOiB0aGlzLm1vZGVsRGVzY3JpcHRpb25cblx0XHR9O1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsWUFBWSxpQkFBaUIseUJBQXlCO0FBQy9ELFNBQVMsZUFBZTtBQUN4QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxXQUFXO0FBQ3BCLFNBQXNCLGNBQWMsb0JBQW9CO0FBQ3hELFNBQVMsMEJBQTBCO0FBRW5DLFNBQVMsNkJBQTZCO0FBRXRDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsdUNBQXdEO0FBQ2pFLFNBQVMsMkJBQTJCO0FBRXBDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMseUNBQXlDO0FBQ2xELFNBQXNCLDBCQUEwQjtBQUV6QyxJQUFNLGtDQUFOLGNBQThDLFdBQTZDO0FBQUEsRUFPakcsWUFDc0MsbUJBQ0osZUFDSSxtQkFDTixhQUNPLG9CQUNFLHNCQUNZLHFCQUNuRDtBQUNELFVBQU07QUFSK0I7QUFDSjtBQUNJO0FBQ047QUFDTztBQUNFO0FBQ1k7QUFYckQsU0FBaUIsNEJBQTRCLEtBQUssVUFBVSxJQUFJLGtCQUEyQyxDQUFDO0FB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
