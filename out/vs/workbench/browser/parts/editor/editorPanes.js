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
import { localize } from "../../../../nls.js";
import { Emitter } from "../../../../base/common/event.js";
import Severity from "../../../../base/common/severity.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { EditorExtensions, EditorInputCapabilities, isEditorOpenError } from "../../../common/editor.js";
import { Dimension, show, hide, isAncestor, getActiveElement, getWindowById, isEditableElement, $ } from "../../../../base/browser/dom.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IWorkbenchLayoutService } from "../../../services/layout/browser/layoutService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IEditorProgressService, LongRunningOperation } from "../../../../platform/progress/common/progress.js";
import { DEFAULT_EDITOR_MIN_DIMENSIONS, DEFAULT_EDITOR_MAX_DIMENSIONS } from "./editor.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { ErrorPlaceholderEditor, WorkspaceTrustRequiredPlaceholderEditor } from "./editorPlaceholder.js";
import { EditorOpenSource } from "../../../../platform/editor/common/editor.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IHostService } from "../../../services/host/browser/host.js";
let EditorPanes = class extends Disposable {
  constructor(editorGroupParent, editorPanesParent, groupView, layoutService, instantiationService, editorProgressService, workspaceTrustService, logService, dialogService, hostService) {
    super();
    this.editorGroupParent = editorGroupParent;
    this.editorPanesParent = editorPanesParent;
    this.groupView = groupView;
    this.layoutService = layoutService;
    this.instantiationService = instantiationService;
    this.workspaceTrustService = workspaceTrustService;
    this.logService = logService;
    this.dialogService = dialogService;
    this.hostService = hostService;
    //#region Events
    this._onDidFocus = this._register(new Emitter());
    this.onDidFocus = this._onDidFocus.event;
    this._onDidChangeSizeConstraints = this._register(new Emitter());
    this.onDidChangeSizeConstraints = this._onDidChangeSizeConstraints.event;
    this._activeEditorPane = null;
    this.editorPanes = [];
    this.mapEditorPaneToPendingSetInput = /* @__PURE__ */ new Map();
    this.activeEditorPaneDisposables = this._register(new DisposableStore());
    this.editorPanesRegistry = Registry.as(EditorExtensions.EditorPane);
    this.editorOperation = this._register(new LongRunningOperation(editorProgressService));
    this.registerListeners();
  }
  //#endregion
  get minimumWidth() {
    return this._activeEditorPane?.minimumWidth ?? DEFAULT_EDITOR_MIN_DIMENSIONS.width;
  }
  get minimumHeight() {
    return this._activeEditorPane?.minimumHeight ?? DEFAULT_EDITOR_MIN_DIMENSIONS.height;
  }
  get maximumWidth() {
    return this._activeEditorPane?.maximumWidth ?? DEFAULT_EDITOR_MAX_DIMENSIONS.width;
  }
  get maximumHeight() {
    return this._activeEditorPane?.maximumHeight ?? DEFAULT_EDITOR_MAX_DIMENSIONS.height;
  }
  get activeEditorPane() {
    return this._activeEditorPane;
  }
  registerListeners() {
    this._register(this.workspaceTrustService.onDidChangeTrust(() => this.onDidChangeWorkspaceTrust()));
  }
  onDidChangeWorkspaceTrust() {
    const editor = this._activeEditorPane?.input;
    const options = this._activeEditorPane?.options;
    if (editor?.hasCapability(EditorInputCapabilities.RequiresTrust)) {
      this.groupView.openEditor(editor, options);
    }
  }
  async openEditor(editor, options, internalOptions, context = /* @__PURE__ */ Object.create(null)) {
    try {
      return await this.doOpenEditor(this.getEditorPaneDescriptor(editor), editor, options, internalOptions, context);
    } catch (error) {
      if (options?.ignoreError) {
        return { error };
      }
      return this.doShowError(error, editor, options, internalOptions, context);
    }
  }
  async doShowError(error, editor, options, internalOptions, context) {
    this.logService.error(error);
    let errorHandled = false;
    if (options?.source === EditorOpenSource.USER && (!isEditorOpenError(error) || error.allowDialog)) {
      errorHandled = await this.doShowErrorDialog(error, editor);
    }
    if (errorHandled) {
      return { error };
    }
    const editorPlaceholderOptions = { ...options };
    if (!isCancellationError(error)) {
      editorPlaceholderOptions.error = error;
    }
    return {
      ...await this.doOpenEditor(ErrorPlaceholderEditor.DESCRIPTOR, editor, editorPlaceholderOptions, internalOptions, context),
      error
    };
  }
  async doShowErrorDialog(error, editor) {
    let severity = Severity.Error;
    let message = void 0;
    let detail = toErrorMessage(error);
    let errorActions = void 0;
    if (isEditorOpenError(error)) {
      errorActions = error.actions;
      severity = error.forceSeverity ?? Severity.Error;
      if (error.forceMessage) {
        message = error.message;
        detail = void 0;
      }
    }
    if (!message) {
      message = localize("editorOpenErrorDialog", "Unable to open '{0}'", editor.getName());
    }
    const buttons = [];
    if (errorActions && errorActions.length > 0) {
      for (const errorAction of errorActions) {
        buttons.push({
          label: errorAction.label,
          run: () => errorAction
        });
      }
    } else {
      buttons.push({
        label: localize({ key: "ok", comment: ["&& denotes a mnemonic"] }, "&&OK"),
        run: () => void 0
      });
    }
    let cancelButton = void 0;
    if (buttons.length === 1) {
      cancelButton = {
        run: () => {
          errorHandled = true;
          return void 0;
        }
      };
    }
    let errorHandled = false;
    const { result } = await this.dialogService.prompt({
      type: severity,
      message,
      detail,
      buttons,
      cancelButton
    });
    if (result) {
      const errorActionResult = result.run();
      if (errorActionResult instanceof Promise) {
        errorActionResult.catch((error2) => this.dialogService.error(toErrorMessage(error2)));
      }
      errorHandled = true;
    }
    return errorHandled;
  }
  async doOpenEditor(descriptor, editor, options, internalOptions, context = /* @__PURE__ */ Object.create(null)) {
    const pane = this.doShowEditorPane(descriptor);
    const activeElement = getActiveElement();
    const { changed, cancelled } = await this.doSetInput(pane, editor, options, context);
    if (!cancelled) {
      const focus = !options || !options.preserveFocus;
      if (focus && this.shouldRestoreFocus(activeElement)) {
        pane.focus();
      } else if (!internalOptions?.preserveWindowOrder) {
        this.hostService.moveTop(getWindowById(this.groupView.windowId, true).window);
      }
    }
    return { pane, changed, cancelled };
  }
  shouldRestoreFocus(expectedActiveElement) {
    if (!this.layoutService.isRestored()) {
      return true;
    }
    if (!expectedActiveElement) {
      return true;
    }
    const activeElement = getActiveElement();
    if (!activeElement || activeElement === expectedActiveElement.ownerDocument.body) {
      return true;
    }
    const same = expectedActiveElement === activeElement;
    if (same) {
      return true;
    }
    if (!isEditableElement(activeElement)) {
      return true;
    }
    if (isAncestor(activeElement, this.editorGroupParent)) {
      return true;
    }
    return false;
  }
  getEditorPaneDescriptor(editor) {
    if (editor.hasCapability(EditorInputCapabilities.RequiresTrust) && !this.workspaceTrustService.isWorkspaceTrusted()) {
      return WorkspaceTrustRequiredPlaceholderEditor.DESCRIPTOR;
    }
    return assertIsDefined(this.editorPanesRegistry.getEditorPane(editor));
  }
  doShowEditorPane(descriptor) {
    if (this._activeEditorPane && descriptor.describes(this._activeEditorPane)) {
      return this._activeEditorPane;
    }
    this.doHideActiveEditorPane();
    const editorPane = this.doCreateEditorPane(descriptor);
    this.doSetActiveEditorPane(editorPane);
    const container = assertIsDefined(editorPane.getContainer());
    this.editorPanesParent.appendChild(container);
    show(container);
    editorPane.setVisible(true);
    if (this.pagePosition) {
      editorPane.layout(new Dimension(this.pagePosition.width, this.pagePosition.height), { top: this.pagePosition.top, left: this.pagePosition.left });
    }
    if (this.boundarySashes) {
      editorPane.setBoundarySashes(this.boundarySashes);
    }
    return editorPane;
  }
  doCreateEditorPane(descriptor) {
    const editorPane = this.doInstantiateEditorPane(descriptor);
    if (!editorPane.getContainer()) {
      const editorPaneContainer = $(".editor-instance");
      this.editorPanesParent.appendChild(editorPaneContainer);
      try {
        editorPane.create(editorPaneContainer);
      } catch (error) {
        editorPaneContainer.remove();
        hide(editorPaneContainer);
        throw error;
      }
    }
    return editorPane;
  }
  doInstantiateEditorPane(descriptor) {
    const existingEditorPane = this.editorPanes.find((editorPane2) => descriptor.describes(editorPane2));
    if (existingEditorPane) {
      return existingEditorPane;
    }
    const editorPane = this._register(descriptor.instantiate(this.instantiationService, this.groupView));
    this.editorPanes.push(editorPane);
    return editorPane;
  }
  doSetActiveEditorPane(editorPane) {
    this._activeEditorPane = editorPane;
    this.activeEditorPaneDisposables.clear();
    if (editorPane) {
      this.activeEditorPaneDisposables.add(editorPane.onDidChangeSizeConstraints((e) => this._onDidChangeSizeConstraints.fire(e)));
      this.activeEditorPaneDisposables.add(editorPane.onDidFocus(() => this._onDidFocus.fire()));
    }
    this._onDidChangeSizeConstraints.fire(void 0);
  }
  async doSetInput(editorPane, editor, options, context) {
    let inputMatches = editorPane.input?.matches(editor);
    if (inputMatches && !options?.forceReload) {
      if (this.mapEditorPaneToPendingSetInput.has(editorPane)) {
        await this.mapEditorPaneToPendingSetInput.get(editorPane);
      }
      inputMatches = editorPane.input?.matches(editor);
      if (inputMatches) {
        editorPane.setOptions(options);
      }
      return { changed: false, cancelled: !inputMatches };
    }
    const operation = this.editorOperation.start(this.layoutService.isRestored() ? 800 : 3200);
    let cancelled = false;
    try {
      editorPane.clearInput();
      const pendingSetInput = editorPane.setInput(editor, options, context, operation.token);
      this.mapEditorPaneToPendingSetInput.set(editorPane, pendingSetInput);
      await pendingSetInput;
      if (!operation.isCurrent()) {
        cancelled = true;
      }
    } catch (error) {
      if (!operation.isCurrent()) {
        cancelled = true;
      } else {
        throw error;
      }
    } finally {
      if (operation.isCurrent()) {
        this.mapEditorPaneToPendingSetInput.delete(editorPane);
      }
      operation.stop();
    }
    return { changed: !inputMatches, cancelled };
  }
  doHideActiveEditorPane() {
    if (!this._activeEditorPane) {
      return;
    }
    this.editorOperation.stop();
    this.safeRun(() => this._activeEditorPane?.clearInput());
    this.safeRun(() => this._activeEditorPane?.setVisible(false));
    this.mapEditorPaneToPendingSetInput.delete(this._activeEditorPane);
    const editorPaneContainer = this._activeEditorPane.getContainer();
    if (editorPaneContainer) {
      editorPaneContainer.remove();
      hide(editorPaneContainer);
    }
    this.doSetActiveEditorPane(null);
  }
  closeEditor(editor) {
    if (this._activeEditorPane?.input && editor.matches(this._activeEditorPane.input)) {
      this.doHideActiveEditorPane();
    }
  }
  setVisible(visible) {
    this.safeRun(() => this._activeEditorPane?.setVisible(visible));
  }
  layout(pagePosition) {
    this.pagePosition = pagePosition;
    this.safeRun(() => this._activeEditorPane?.layout(new Dimension(pagePosition.width, pagePosition.height), pagePosition));
  }
  setBoundarySashes(sashes) {
    this.boundarySashes = sashes;
    this.safeRun(() => this._activeEditorPane?.setBoundarySashes(sashes));
  }
  safeRun(fn) {
    try {
      fn();
    } catch (error) {
      this.logService.error(error);
    }
  }
};
EditorPanes = __decorateClass([
  __decorateParam(3, IWorkbenchLayoutService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IEditorProgressService),
  __decorateParam(6, IWorkspaceTrustManagementService),
  __decorateParam(7, ILogService),
  __decorateParam(8, IDialogService),
  __decorateParam(9, IHostService)
], EditorPanes);
export {
  EditorPanes
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yUGFuZXMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IFNldmVyaXR5IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3NldmVyaXR5LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JFeHRlbnNpb25zLCBFZGl0b3JJbnB1dENhcGFiaWxpdGllcywgSUVkaXRvck9wZW5Db250ZXh0LCBJVmlzaWJsZUVkaXRvclBhbmUsIGlzRWRpdG9yT3BlbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgRGltZW5zaW9uLCBzaG93LCBoaWRlLCBJRG9tTm9kZVBhZ2VQb3NpdGlvbiwgaXNBbmNlc3RvciwgZ2V0QWN0aXZlRWxlbWVudCwgZ2V0V2luZG93QnlJZCwgaXNFZGl0YWJsZUVsZW1lbnQsICQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElFZGl0b3JQYW5lUmVnaXN0cnksIElFZGl0b3JQYW5lRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoTGF5b3V0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xheW91dC9icm93c2VyL2xheW91dFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRWRpdG9yUGFuZSB9IGZyb20gJy4vZWRpdG9yUGFuZS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElFZGl0b3JQcm9ncmVzc1NlcnZpY2UsIExvbmdSdW5uaW5nT3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cFZpZXcsIERFRkFVTFRfRURJVE9SX01JTl9ESU1FTlNJT05TLCBERUZBVUxUX0VESVRPUl9NQVhfRElNRU5TSU9OUywgSUludGVybmFsRWRpdG9yT3Blbk9wdGlvbnMgfSBmcm9tICcuL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBhc3NlcnRJc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlVHJ1c3QuanMnO1xuaW1wb3J0IHsgRXJyb3JQbGFjZWhvbGRlckVkaXRvciwgSUVycm9yRWRpdG9yUGxhY2Vob2xkZXJPcHRpb25zLCBXb3Jrc3BhY2VUcnVzdFJlcXVpcmVkUGxhY2Vob2xkZXJFZGl0b3IgfSBmcm9tICcuL2VkaXRvclBsYWNlaG9sZGVyLmpzJztcbmltcG9ydCB7IEVkaXRvck9wZW5Tb3VyY2UsIElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgaXNDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyB0b0Vycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9yTWVzc2FnZS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlLCBJUHJvbXB0QnV0dG9uLCBJUHJvbXB0Q2FuY2VsQnV0dG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJQm91bmRhcnlTYXNoZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvc2FzaC9zYXNoLmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJT3BlbkVkaXRvclJlc3VsdCB7XG5cblx0LyoqXG5cdCAqIFRoZSBlZGl0b3IgcGFuZSB1c2VkIGZvciBvcGVuaW5nLiBUaGlzIGNhbiBiZSBhIGdlbmVyaWNcblx0ICogcGxhY2Vob2xkZXIgaW4gY2VydGFpbiBjYXNlcywgZS5nLiB3aGVuIHdvcmtzcGFjZSB0cnVzdFxuXHQgKiBpcyByZXF1aXJlZCwgb3IgYW4gZWRpdG9yIGZhaWxzIHRvIHJlc3RvcmUuXG5cdCAqXG5cdCAqIFdpbGwgYmUgYHVuZGVmaW5lZGAgaWYgYW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgdHJ5aW5nIHRvXG5cdCAqIG9wZW4gdGhlIGVkaXRvciBhbmQgaW4gY2FzZXMgd2hlcmUgbm8gcGxhY2Vob2xkZXIgaXMgYmVpbmdcblx0ICogdXNlZC5cblx0ICovXG5cdHJlYWRvbmx5IHBhbmU/OiBFZGl0b3JQYW5lO1xuXG5cdC8qKlxuXHQgKiBXaGV0aGVyIHRoZSBlZGl0b3IgY2hhbmdlZCBhcyBhIHJlc3VsdCBvZiBvcGVuaW5nLlxuXHQgKi9cblx0cmVhZG9ubHkgY2hhbmdlZD86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIFRoaXMgcHJvcGVydHkgaXMgc2V0IHdoZW4gYW4gZWRpdG9yIGZhaWxzIHRvIHJlc3RvcmUgYW5kXG5cdCAqIGlzIHNob3duIHdpdGggYSBnZW5lcmljIHBsYWNlIGhvbGRlci4gSXQgYWxsb3dzIGNhbGxlcnNcblx0ICogdG8gc3RpbGwgcHJlc2VudCB0aGUgZXJyb3IgdG8gdGhlIHVzZXIgaW4gdGhhdCBjYXNlLlxuXHQgKi9cblx0cmVhZG9ubHkgZXJyb3I/OiBFcnJvcjtcblxuXHQvKipcblx0ICogVGhpcyBwcm9wZXJ0eSBpbmRpY2F0ZXMgd2hldGhlciB0aGUgb3BlbiBlZGl0b3Igb3BlcmF0aW9uIHdhc1xuXHQgKiBjYW5jZWxsZWQgb3Igbm90LiBUaGUgb3BlcmF0aW9uIG1heSBoYXZlIGJlZW4gY2FuY2VsbGVkXG5cdCAqIGluIGNhc2UgYW5vdGhlciBlZGl0b3Igb3BlbiBvcGVyYXRpb24gd2FzIHRyaWdnZXJlZCByaWdodFxuXHQgKiBhZnRlciBjYW5jZWxsaW5nIHRoaXMgb25lIG91dC5cblx0ICovXG5cdHJlYWRvbmx5IGNhbmNlbGxlZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBFZGl0b3JQYW5lcyBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdC8vI3JlZ2lvbiBFdmVudHNcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEZvY3VzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRm9jdXMgPSB0aGlzLl9vbkRpZEZvY3VzLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlU2l6ZUNvbnN0cmFpbnRzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9IHwgdW5kZWZpbmVkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VTaXplQ29uc3RyYWludHMgPSB0aGlzLl9vbkRpZENoYW5nZVNpemVDb25zdHJhaW50cy5ldmVudDtcblxuXHQvLyNlbmRyZWdpb25cblxuXHRnZXQgbWluaW11bVdpZHRoKCkgeyByZXR1cm4gdGhpcy5fYWN0aXZlRWRpdG9yUGFuZT8ubWluaW11bVdpZHRoID8/IERFRkFVTFRfRURJVE9SX01JTl9ESU1FTlNJT05TLndpZHRoOyB9XG5cdGdldCBtaW5pbXVtSGVpZ2h0KCkgeyByZXR1cm4gdGhpcy5fYWN0aXZlRWRpdG9yUGFuZT8ubWluaW11bUhlaWdodCA/PyBERUZBVUxUX0VESVRPUl9NSU5fRElNRU5TSU9OUy5oZWlnaHQ7IH1cblx0Z2V0IG1heGltdW1XaWR0aCgpIHsgcmV0dXJuIHRoaXMuX2FjdGl2ZUVkaXRvclBhbmU/Lm1heGltdW1XaWR0aCA/PyBERUZBVUxUX0VESVRPUl9NQVhfRElNRU5TSU9OUy53aWR0aDsgfVxuXHRnZXQgbWF4aW11bUhlaWdodCgpIHsgcmV0dXJuIHRoaXMuX2FjdGl2ZUVkaXRvclBhbmU/Lm1heGltdW1IZWlnaHQgPz8gREVGQVVMVF9FRElUT1JfTUFYX0RJTUVOU0lPTlMuaGVpZ2h0OyB9XG5cblx0cHJpdmF0ZSBfYWN0aXZlRWRpdG9yUGFuZTogRWRpdG9yUGFuZSB8IG51bGwgPSBudWxsO1xuXHRnZXQgYWN0aXZlRWRpdG9yUGFuZSgpOiBJVmlzaWJsZUVkaXRvclBhbmUgfCBudWxsIHsgcmV0dXJuIHRoaXMuX2FjdGl2ZUVkaXRvclBhbmUgYXMgSVZpc2libGVFZGl0b3JQYW5lIHwgbnVsbDsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yUGFuZXM6IEVkaXRvclBhbmVbXSA9IFtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IG1hcEVkaXRvclBhbmVUb1BlbmRpbmdTZXRJbnB1dCA9IG5ldyBNYXA8RWRpdG9yUGFuZSwgUHJvbWlzZTx2b2lkPj4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGFjdGl2ZUVkaXRvclBhbmVEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0cHJpdmF0ZSBwYWdlUG9zaXRpb246IElEb21Ob2RlUGFnZVBvc2l0aW9uIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGJvdW5kYXJ5U2FzaGVzOiBJQm91bmRhcnlTYXNoZXMgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3JPcGVyYXRpb246IExvbmdSdW5uaW5nT3BlcmF0aW9uO1xuXHRwcml2YXRlIHJlYWRvbmx5IGVkaXRvclBhbmVzUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJRWRpdG9yUGFuZVJlZ2lzdHJ5PihFZGl0b3JFeHRlbnNpb25zLkVkaXRvclBhbmUpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yR3JvdXBQYXJlbnQ6IEhUTUxFbGVtZW50LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yUGFuZXNQYXJlbnQ6IEhUTUxFbGVtZW50LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZ3JvdXBWaWV3OiBJRWRpdG9yR3JvdXBWaWV3LFxuXHRcdEBJV29ya2JlbmNoTGF5b3V0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxheW91dFNlcnZpY2U6IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlIGVkaXRvclByb2dyZXNzU2VydmljZTogSUVkaXRvclByb2dyZXNzU2VydmljZSxcblx0XHRASVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VUcnVzdFNlcnZpY2U6IElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmVkaXRvck9wZXJhdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBMb25nUnVubmluZ09wZXJhdGlvbihlZGl0b3JQcm9ncmVzc1NlcnZpY2UpKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy53b3Jrc3BhY2VUcnVzdFNlcnZpY2Uub25EaWRDaGFuZ2VUcnVzdCgoKSA9PiB0aGlzLm9uRGlkQ2hhbmdlV29ya3NwYWNlVHJ1c3QoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZENoYW5nZVdvcmtzcGFjZVRydXN0KCkge1xuXG5cdFx0Ly8gSWYgdGhlIGFjdGl2ZSBlZGl0b3IgcGFuZSByZXF1aXJlcyB3b3Jrc3BhY2UgdHJ1c3Rcblx0XHQvLyB3ZSBuZWVkIHRvIHJlLW9wZW4gaXQgYW55dGltZSB0cnVzdCBjaGFuZ2VzIHRvXG5cdFx0Ly8gYWNjb3VudCBmb3IgaXQuXG5cdFx0Ly8gRm9yIHRoYXQgd2UgZXhwbGljaXRseSBjYWxsIGludG8gdGhlIGdyb3VwLXZpZXdcblx0XHQvLyB0byBoYW5kbGUgZXJyb3JzIHByb3Blcmx5LlxuXHRcdGNvbnN0IGVkaXRvciA9IHRoaXMuX2FjdGl2ZUVkaXRvclBhbmU/LmlucHV0O1xuXHRcdGNvbnN0IG9wdGlvbnMgPSB0aGlzLl9hY3RpdmVFZGl0b3JQYW5lPy5vcHRpb25zO1xuXHRcdGlmIChlZGl0b3I/Lmhhc0NhcGFiaWxpdHkoRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuUmVxdWlyZXNUcnVzdCkpIHtcblx0XHRcdHRoaXMuZ3JvdXBWaWV3Lm9wZW5FZGl0b3IoZWRpdG9yLCBvcHRpb25zKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBvcGVuRWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQsIG9wdGlvbnM6IElFZGl0b3JPcHRpb25zIHwgdW5kZWZpbmVkLCBpbnRlcm5hbE9wdGlvbnM6IElJbnRlcm5hbEVkaXRvck9wZW5PcHRpb25zIHwgdW5kZWZpbmVkLCBjb250ZXh0OiBJRWRpdG9yT3BlbkNvbnRleHQgPSBPYmplY3QuY3JlYXRlKG51bGwpKTogUHJvbWlzZTxJT3BlbkVkaXRvclJlc3VsdD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5kb09wZW5FZGl0b3IodGhpcy5nZXRFZGl0b3JQYW5lRGVzY3JpcHRvcihlZGl0b3IpLCBlZGl0b3IsIG9wdGlvbnMsIGludGVybmFsT3B0aW9ucywgY29udGV4dCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblxuXHRcdFx0Ly8gRmlyc3QgY2hlY2sgaWYgY2FsbGVyIGluc3RydWN0ZWQgdXMgdG8gaWdub3JlIGVycm9yIGhhbmRsaW5nXG5cdFx0XHRpZiAob3B0aW9ucz8uaWdub3JlRXJyb3IpIHtcblx0XHRcdFx0cmV0dXJuIHsgZXJyb3IgfTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSW4gY2FzZSBvZiBhbiBlcnJvciB3aGVuIG9wZW5pbmcgYW4gZWRpdG9yLCB3ZSBzdGlsbCB3YW50IHRvIHNob3dcblx0XHRcdC8vIGFuIGVkaXRvciBpbiB0aGUgZGVzaXJlZCBsb2NhdGlvbiB0byBwcmVzZXJ2ZSB0aGUgdXNlciBpbnRlbnQgYW5kXG5cdFx0XHQvLyB2aWV3IHN0YXRlIChlLmcuIHdoZW4gcmVzdG9yaW5nKS5cblx0XHRcdC8vXG5cdFx0XHQvLyBGb3IgdGhhdCByZWFzb24gd2UgaGF2ZSBwbGFjZSBob2xkZXIgZWRpdG9ycyB0aGF0IGNhbiBjb252ZXkgYVxuXHRcdFx0Ly8gbWVzc2FnZSB3aXRoIGFjdGlvbnMgdGhlIHVzZXIgY2FuIGNsaWNrIG9uLlxuXG5cdFx0XHRyZXR1cm4gdGhpcy5kb1Nob3dFcnJvcihlcnJvciwgZWRpdG9yLCBvcHRpb25zLCBpbnRlcm5hbE9wdGlvbnMsIGNvbnRleHQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9TaG93RXJyb3IoZXJyb3I6IEVycm9yLCBlZGl0b3I6IEVkaXRvcklucHV0LCBvcHRpb25zOiBJRWRpdG9yT3B0aW9ucyB8IHVuZGVmaW5lZCwgaW50ZXJuYWxPcHRpb25zOiBJSW50ZXJuYWxFZGl0b3JPcGVuT3B0aW9ucyB8IHVuZGVmaW5lZCwgY29udGV4dD86IElFZGl0b3JPcGVuQ29udGV4dCk6IFByb21pc2U8SU9wZW5FZGl0b3JSZXN1bHQ+IHtcblxuXHRcdC8vIEFsd2F5cyBsb2cgdGhlIGVycm9yIHRvIGZpZ3VyZSBvdXQgd2hhdCBpcyBnb2luZyBvblxuXHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlcnJvcik7XG5cblx0XHQvLyBTaG93IGFzIG1vZGFsIGRpYWxvZyB3aGVuIGV4cGxpY2l0IHVzZXIgYWN0aW9uIHVubGVzcyBkaXNhYmxlZFxuXHRcdGxldCBlcnJvckhhbmRsZWQgPSBmYWxzZTtcblx0XHRpZiAob3B0aW9ucz8uc291cmNlID09PSBFZGl0b3JPcGVuU291cmNlLlVTRVIgJiYgKCFpc0VkaXRvck9wZW5FcnJvcihlcnJvcikgfHwgZXJyb3IuYWxsb3dEaWFsb2cpKSB7XG5cdFx0XHRlcnJvckhhbmRsZWQgPSBhd2FpdCB0aGlzLmRvU2hvd0Vycm9yRGlhbG9nKGVycm9yLCBlZGl0b3IpO1xuXHRcdH1cblxuXHRcdC8vIFJldHVybiBlYXJseSBpZiB0aGUgdXNlciBkZWFsdCB3aXRoIHRoZSBlcnJvciBhbHJlYWR5XG5cdFx0aWYgKGVycm9ySGFuZGxlZCkge1xuXHRcdFx0cmV0dXJuIHsgZXJyb3IgfTtcblx0XHR9XG5cblx0XHQvLyBTaG93IGFzIGVkaXRvciBwbGFjZWhvbGRlcjogcGFzcyBvdmVyIHRoZSBlcnJvciB0byBkaXNwbGF5XG5cdFx0Y29uc3QgZWRpdG9yUGxhY2Vob2xkZXJPcHRpb25zOiBJRXJyb3JFZGl0b3JQbGFjZWhvbGRlck9wdGlvbnMgPSB7IC4uLm9wdGlvbnMgfTtcblx0XHRpZiAoIWlzQ2FuY2VsbGF0aW9uRXJyb3IoZXJyb3IpKSB7XG5cdFx0XHRlZGl0b3JQbGFjZWhvbGRlck9wdGlvbnMuZXJyb3IgPSBlcnJvcjtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Li4uKGF3YWl0IHRoaXMuZG9PcGVuRWRpdG9yKEVycm9yUGxhY2Vob2xkZXJFZGl0b3IuREVTQ1JJUFRPUiwgZWRpdG9yLCBlZGl0b3JQbGFjZWhvbGRlck9wdGlvbnMsIGludGVybmFsT3B0aW9ucywgY29udGV4dCkpLFxuXHRcdFx0ZXJyb3Jcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1Nob3dFcnJvckRpYWxvZyhlcnJvcjogRXJyb3IsIGVkaXRvcjogRWRpdG9ySW5wdXQpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRsZXQgc2V2ZXJpdHkgPSBTZXZlcml0eS5FcnJvcjtcblx0XHRsZXQgbWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGxldCBkZXRhaWw6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHRvRXJyb3JNZXNzYWdlKGVycm9yKTtcblx0XHRsZXQgZXJyb3JBY3Rpb25zOiByZWFkb25seSBJQWN0aW9uW10gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRpZiAoaXNFZGl0b3JPcGVuRXJyb3IoZXJyb3IpKSB7XG5cdFx0XHRlcnJvckFjdGlvbnMgPSBlcnJvci5hY3Rpb25zO1xuXHRcdFx0c2V2ZXJpdHkgPSBlcnJvci5mb3JjZVNldmVyaXR5ID8/IFNldmVyaXR5LkVycm9yO1xuXHRcdFx0aWYgKGVycm9yLmZvcmNlTWVzc2FnZSkge1xuXHRcdFx0XHRtZXNzYWdlID0gZXJyb3IubWVzc2FnZTtcblx0XHRcdFx0ZGV0YWlsID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghbWVzc2FnZSkge1xuXHRcdFx0bWVzc2FnZSA9IGxvY2FsaXplKCdlZGl0b3JPcGVuRXJyb3JEaWFsb2cnLCBcIlVuYWJsZSB0byBvcGVuICd7MH0nXCIsIGVkaXRvci5nZXROYW1lKCkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGJ1dHRvbnM6IElQcm9tcHRCdXR0b248SUFjdGlvbiB8IHVuZGVmaW5lZD5bXSA9IFtdO1xuXHRcdGlmIChlcnJvckFjdGlvbnMgJiYgZXJyb3JBY3Rpb25zLmxlbmd0aCA+IDApIHtcblx0XHRcdGZvciAoY29uc3QgZXJyb3JBY3Rpb24gb2YgZXJyb3JBY3Rpb25zKSB7XG5cdFx0XHRcdGJ1dHRvbnMucHVzaCh7XG5cdFx0XHRcdFx0bGFiZWw6IGVycm9yQWN0aW9uLmxhYmVsLFxuXHRcdFx0XHRcdHJ1bjogKCkgPT4gZXJyb3JBY3Rpb25cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGJ1dHRvbnMucHVzaCh7XG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSh7IGtleTogJ29rJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmT0tcIiksXG5cdFx0XHRcdHJ1bjogKCkgPT4gdW5kZWZpbmVkXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRsZXQgY2FuY2VsQnV0dG9uOiBJUHJvbXB0Q2FuY2VsQnV0dG9uPHVuZGVmaW5lZD4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKGJ1dHRvbnMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRjYW5jZWxCdXR0b24gPSB7XG5cdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdGVycm9ySGFuZGxlZCA9IHRydWU7IC8vIHRyZWF0IGNhbmNlbCBhcyBoYW5kbGVkIGFuZCBkbyBub3Qgc2hvdyBwbGFjZWhvbGRlclxuXG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRsZXQgZXJyb3JIYW5kbGVkID0gZmFsc2U7ICAvLyBieSBkZWZhdWx0LCBzaG93IHBsYWNlaG9sZGVyXG5cblx0XHRjb25zdCB7IHJlc3VsdCB9ID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLnByb21wdCh7XG5cdFx0XHR0eXBlOiBzZXZlcml0eSxcblx0XHRcdG1lc3NhZ2UsXG5cdFx0XHRkZXRhaWwsXG5cdFx0XHRidXR0b25zLFxuXHRcdFx0Y2FuY2VsQnV0dG9uXG5cdFx0fSk7XG5cblx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRjb25zdCBlcnJvckFjdGlvblJlc3VsdCA9IHJlc3VsdC5ydW4oKTtcblx0XHRcdGlmIChlcnJvckFjdGlvblJlc3VsdCBpbnN0YW5jZW9mIFByb21pc2UpIHtcblx0XHRcdFx0ZXJyb3JBY3Rpb25SZXN1bHQuY2F0Y2goZXJyb3IgPT4gdGhpcy5kaWFsb2dTZXJ2aWNlLmVycm9yKHRvRXJyb3JNZXNzYWdlKGVycm9yKSkpO1xuXHRcdFx0fVxuXG5cdFx0XHRlcnJvckhhbmRsZWQgPSB0cnVlOyAvLyB0cmVhdCBjdXN0b20gZXJyb3IgYWN0aW9uIGFzIGhhbmRsZWQgYW5kIGRvIG5vdCBzaG93IHBsYWNlaG9sZGVyXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVycm9ySGFuZGxlZDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9PcGVuRWRpdG9yKGRlc2NyaXB0b3I6IElFZGl0b3JQYW5lRGVzY3JpcHRvciwgZWRpdG9yOiBFZGl0b3JJbnB1dCwgb3B0aW9uczogSUVkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQsIGludGVybmFsT3B0aW9uczogSUludGVybmFsRWRpdG9yT3Blbk9wdGlvbnMgfCB1bmRlZmluZWQsIGNvbnRleHQ6IElFZGl0b3JPcGVuQ29udGV4dCA9IE9iamVjdC5jcmVhdGUobnVsbCkpOiBQcm9taXNlPElPcGVuRWRpdG9yUmVzdWx0PiB7XG5cblx0XHQvLyBFZGl0b3IgcGFuZVxuXHRcdGNvbnN0IHBhbmUgPSB0aGlzLmRvU2hvd0VkaXRvclBhbmUoZGVzY3JpcHRvcik7XG5cblx0XHQvLyBSZW1lbWJlciBjdXJyZW50IGFjdGl2ZSBlbGVtZW50IGZvciBkZWNpZGluZyB0byByZXN0b3JlIGZvY3VzIGxhdGVyXG5cdFx0Y29uc3QgYWN0aXZlRWxlbWVudCA9IGdldEFjdGl2ZUVsZW1lbnQoKTtcblxuXHRcdC8vIEFwcGx5IGlucHV0IHRvIHBhbmVcblx0XHRjb25zdCB7IGNoYW5nZWQsIGNhbmNlbGxlZCB9ID0gYXdhaXQgdGhpcy5kb1NldElucHV0KHBhbmUsIGVkaXRvciwgb3B0aW9ucywgY29udGV4dCk7XG5cblx0XHQvLyBNYWtlIHN1cmUgdG8gcGFzcyBmb2N1cyB0byB0aGUgcGFuZSBvciBvdGhlcndpc2Vcblx0XHQvLyBtYWtlIHN1cmUgdGhhdCB0aGUgcGFuZSB3aW5kb3cgaXMgdmlzaWJsZSB1bmxlc3Ncblx0XHQvLyB0aGlzIGhhcyBiZWVuIGV4cGxpY2l0bHkgZGlzYWJsZWQuXG5cdFx0aWYgKCFjYW5jZWxsZWQpIHtcblx0XHRcdGNvbnN0IGZvY3VzID0gIW9wdGlvbnMgfHwgIW9wdGlvbnMucHJlc2VydmVGb2N1cztcblx0XHRcdGlmIChmb2N1cyAmJiB0aGlzLnNob3VsZFJlc3RvcmVGb2N1cyhhY3RpdmVFbGVtZW50KSkge1xuXHRcdFx0XHRwYW5lLmZvY3VzKCk7XG5cdFx0XHR9IGVsc2UgaWYgKCFpbnRlcm5hbE9wdGlvbnM/LnByZXNlcnZlV2luZG93T3JkZXIpIHtcblx0XHRcdFx0dGhpcy5ob3N0U2VydmljZS5tb3ZlVG9wKGdldFdpbmRvd0J5SWQodGhpcy5ncm91cFZpZXcud2luZG93SWQsIHRydWUpLndpbmRvdyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgcGFuZSwgY2hhbmdlZCwgY2FuY2VsbGVkIH07XG5cdH1cblxuXHRwcml2YXRlIHNob3VsZFJlc3RvcmVGb2N1cyhleHBlY3RlZEFjdGl2ZUVsZW1lbnQ6IEVsZW1lbnQgfCBudWxsKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLmxheW91dFNlcnZpY2UuaXNSZXN0b3JlZCgpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gcmVzdG9yZSBmb2N1cyBpZiB3ZSBhcmUgbm90IHJlc3RvcmVkIHlldCBvbiBzdGFydHVwXG5cdFx0fVxuXG5cdFx0aWYgKCFleHBlY3RlZEFjdGl2ZUVsZW1lbnQpIHtcblx0XHRcdHJldHVybiB0cnVlOyAvLyByZXN0b3JlIGZvY3VzIGlmIG5vdGhpbmcgd2FzIGZvY3VzZWRcblx0XHR9XG5cblx0XHRjb25zdCBhY3RpdmVFbGVtZW50ID0gZ2V0QWN0aXZlRWxlbWVudCgpO1xuXHRcdGlmICghYWN0aXZlRWxlbWVudCB8fCBhY3RpdmVFbGVtZW50ID09PSBleHBlY3RlZEFjdGl2ZUVsZW1lbnQub3duZXJEb2N1bWVudC5ib2R5KSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gcmVzdG9yZSBmb2N1cyBpZiBub3RoaW5nIGlzIGZvY3VzZWQgY3VycmVudGx5XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2FtZSA9IGV4cGVjdGVkQWN0aXZlRWxlbWVudCA9PT0gYWN0aXZlRWxlbWVudDtcblx0XHRpZiAoc2FtZSkge1xuXHRcdFx0cmV0dXJuIHRydWU7IC8vIHJlc3RvcmUgZm9jdXMgaWYgc2FtZSBlbGVtZW50IGlzIHN0aWxsIGFjdGl2ZVxuXHRcdH1cblxuXHRcdGlmICghaXNFZGl0YWJsZUVsZW1lbnQoYWN0aXZlRWxlbWVudCkpIHtcblxuXHRcdFx0Ly8gVGhpcyBpcyB0byBhdm9pZCByZWdyZXNzaW9ucyBmcm9tIG5vdCByZXN0b3JpbmcgZm9jdXMgYXMgd2UgdXNlZCB0bzpcblx0XHRcdC8vIE9ubHkgYWxsb3cgYSBkaWZmZXJlbnQgaW5wdXQgZWxlbWVudCAob3IgdGV4dGFyZWEpIHRvIHJlbWFpbiBmb2N1c2VkXG5cdFx0XHQvLyBidXQgbm90IG90aGVyIGVsZW1lbnRzIHRoYXQgZG8gbm90IGFjY2VwdCB0ZXh0IGlucHV0LlxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAoaXNBbmNlc3RvcihhY3RpdmVFbGVtZW50LCB0aGlzLmVkaXRvckdyb3VwUGFyZW50KSkge1xuXHRcdFx0cmV0dXJuIHRydWU7IC8vIHJlc3RvcmUgZm9jdXMgaWYgYWN0aXZlIGVsZW1lbnQgaXMgc3RpbGwgaW5zaWRlIG91ciBlZGl0b3IgZ3JvdXBcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7IC8vIGRvIG5vdCByZXN0b3JlIGZvY3VzXG5cdH1cblxuXHRwcml2YXRlIGdldEVkaXRvclBhbmVEZXNjcmlwdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQpOiBJRWRpdG9yUGFuZURlc2NyaXB0b3Ige1xuXHRcdGlmIChlZGl0b3IuaGFzQ2FwYWJpbGl0eShFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5SZXF1aXJlc1RydXN0KSAmJiAhdGhpcy53b3Jrc3BhY2VUcnVzdFNlcnZpY2UuaXNXb3Jrc3BhY2VUcnVzdGVkKCkpIHtcblx0XHRcdC8vIFdvcmtzcGFjZSB0cnVzdDogaWYgYW4gZWRpdG9yIHNpZ25hbHMgaXQgbmVlZHMgd29ya3NwYWNlIHRydXN0XG5cdFx0XHQvLyBidXQgdGhlIGN1cnJlbnQgd29ya3NwYWNlIGlzIHVudHJ1c3RlZCwgd2UgZmFsbGJhY2sgdG8gYSBnZW5lcmljXG5cdFx0XHQvLyBlZGl0b3IgZGVzY3JpcHRvciB0byBpbmRpY2F0ZSB0aGlzIGFuIGRvIE5PVCBsb2FkIHRoZSByZWdpc3RlcmVkXG5cdFx0XHQvLyBlZGl0b3IuXG5cdFx0XHRyZXR1cm4gV29ya3NwYWNlVHJ1c3RSZXF1aXJlZFBsYWNlaG9sZGVyRWRpdG9yLkRFU0NSSVBUT1I7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFzc2VydElzRGVmaW5lZCh0aGlzLmVkaXRvclBhbmVzUmVnaXN0cnkuZ2V0RWRpdG9yUGFuZShlZGl0b3IpKTtcblx0fVxuXG5cdHByaXZhdGUgZG9TaG93RWRpdG9yUGFuZShkZXNjcmlwdG9yOiBJRWRpdG9yUGFuZURlc2NyaXB0b3IpOiBFZGl0b3JQYW5lIHtcblxuXHRcdC8vIFJldHVybiBlYXJseSBpZiB0aGUgY3VycmVudGx5IGFjdGl2ZSBlZGl0b3IgcGFuZSBjYW4gaGFuZGxlIHRoZSBpbnB1dFxuXHRcdGlmICh0aGlzLl9hY3RpdmVFZGl0b3JQYW5lICYmIGRlc2NyaXB0b3IuZGVzY3JpYmVzKHRoaXMuX2FjdGl2ZUVkaXRvclBhbmUpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYWN0aXZlRWRpdG9yUGFuZTtcblx0XHR9XG5cblx0XHQvLyBIaWRlIGFjdGl2ZSBvbmUgZmlyc3Rcblx0XHR0aGlzLmRvSGlkZUFjdGl2ZUVkaXRvclBhbmUoKTtcblxuXHRcdC8vIENyZWF0ZSBlZGl0b3IgcGFuZVxuXHRcdGNvbnN0IGVkaXRvclBhbmUgPSB0aGlzLmRvQ3JlYXRlRWRpdG9yUGFuZShkZXNjcmlwdG9yKTtcblxuXHRcdC8vIFNldCBlZGl0b3IgYXMgYWN0aXZlXG5cdFx0dGhpcy5kb1NldEFjdGl2ZUVkaXRvclBhbmUoZWRpdG9yUGFuZSk7XG5cblx0XHQvLyBTaG93IGVkaXRvclxuXHRcdGNvbnN0IGNvbnRhaW5lciA9IGFzc2VydElzRGVmaW5lZChlZGl0b3JQYW5lLmdldENvbnRhaW5lcigpKTtcblx0XHR0aGlzLmVkaXRvclBhbmVzUGFyZW50LmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XG5cdFx0c2hvdyhjb250YWluZXIpO1xuXG5cdFx0Ly8gSW5kaWNhdGUgdG8gZWRpdG9yIHRoYXQgaXQgaXMgbm93IHZpc2libGVcblx0XHRlZGl0b3JQYW5lLnNldFZpc2libGUodHJ1ZSk7XG5cblx0XHQvLyBMYXlvdXRcblx0XHRpZiAodGhpcy5wYWdlUG9zaXRpb24pIHtcblx0XHRcdGVkaXRvclBhbmUubGF5b3V0KG5ldyBEaW1lbnNpb24odGhpcy5wYWdlUG9zaXRpb24ud2lkdGgsIHRoaXMucGFnZVBvc2l0aW9uLmhlaWdodCksIHsgdG9wOiB0aGlzLnBhZ2VQb3NpdGlvbi50b3AsIGxlZnQ6IHRoaXMucGFnZVBvc2l0aW9uLmxlZnQgfSk7XG5cdFx0fVxuXG5cdFx0Ly8gQm91bmRhcnkgc2FzaGVzXG5cdFx0aWYgKHRoaXMuYm91bmRhcnlTYXNoZXMpIHtcblx0XHRcdGVkaXRvclBhbmUuc2V0Qm91bmRhcnlTYXNoZXModGhpcy5ib3VuZGFyeVNhc2hlcyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVkaXRvclBhbmU7XG5cdH1cblxuXHRwcml2YXRlIGRvQ3JlYXRlRWRpdG9yUGFuZShkZXNjcmlwdG9yOiBJRWRpdG9yUGFuZURlc2NyaXB0b3IpOiBFZGl0b3JQYW5lIHtcblxuXHRcdC8vIEluc3RhbnRpYXRlIGVkaXRvclxuXHRcdGNvbnN0IGVkaXRvclBhbmUgPSB0aGlzLmRvSW5zdGFudGlhdGVFZGl0b3JQYW5lKGRlc2NyaXB0b3IpO1xuXG5cdFx0Ly8gQ3JlYXRlIGVkaXRvciBjb250YWluZXIgYXMgbmVlZGVkXG5cdFx0aWYgKCFlZGl0b3JQYW5lLmdldENvbnRhaW5lcigpKSB7XG5cdFx0XHRjb25zdCBlZGl0b3JQYW5lQ29udGFpbmVyID0gJCgnLmVkaXRvci1pbnN0YW5jZScpO1xuXG5cdFx0XHQvLyBJdCBpcyBjcnVpY2lhbCB0byBhcHBlbmQgdGhlIGNvbnRhaW5lciB0byBpdHMgcGFyZW50IGJlZm9yZVxuXHRcdFx0Ly8gcGFzc2luZyBvbiB0byB0aGUgY3JlYXRlKCkgbWV0aG9kIG9mIHRoZSBwYW5lIHNvIHRoYXQgdGhlXG5cdFx0XHQvLyByaWdodCBgd2luZG93YCBjYW4gYmUgZGV0ZXJtaW5lZCBpbiBmbG9hdGluZyB3aW5kb3cgY2FzZXMuXG5cdFx0XHR0aGlzLmVkaXRvclBhbmVzUGFyZW50LmFwcGVuZENoaWxkKGVkaXRvclBhbmVDb250YWluZXIpO1xuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRlZGl0b3JQYW5lLmNyZWF0ZShlZGl0b3JQYW5lQ29udGFpbmVyKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cblx0XHRcdFx0Ly8gQXQgdGhpcyBwb2ludCB0aGUgZWRpdG9yIHBhbmUgY29udGFpbmVyIGlzIG5vdCBoZWFsdGh5XG5cdFx0XHRcdC8vIGFuZCBhcyBzdWNoLCB3ZSByZW1vdmUgaXQgZnJvbSB0aGUgcGFuZSBwYXJlbnQgYW5kIGhpZGVcblx0XHRcdFx0Ly8gaXQgc28gdGhhdCB3ZSBoYXZlIGEgY2hhbmNlIHRvIHNob3cgYW4gZXJyb3IgcGxhY2Vob2xkZXIuXG5cdFx0XHRcdC8vIE5vdCBkb2luZyBzbyB3b3VsZCByZXN1bHQgaW4gbXVsdGlwbGUgYC5lZGl0b3ItaW5zdGFuY2VgXG5cdFx0XHRcdC8vIGxpbmdlcmluZyBhcm91bmQgaW4gdGhlIERPTS5cblxuXHRcdFx0XHRlZGl0b3JQYW5lQ29udGFpbmVyLnJlbW92ZSgpO1xuXHRcdFx0XHRoaWRlKGVkaXRvclBhbmVDb250YWluZXIpO1xuXG5cdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBlZGl0b3JQYW5lO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0luc3RhbnRpYXRlRWRpdG9yUGFuZShkZXNjcmlwdG9yOiBJRWRpdG9yUGFuZURlc2NyaXB0b3IpOiBFZGl0b3JQYW5lIHtcblxuXHRcdC8vIFJldHVybiBlYXJseSBpZiBhbHJlYWR5IGluc3RhbnRpYXRlZFxuXHRcdGNvbnN0IGV4aXN0aW5nRWRpdG9yUGFuZSA9IHRoaXMuZWRpdG9yUGFuZXMuZmluZChlZGl0b3JQYW5lID0+IGRlc2NyaXB0b3IuZGVzY3JpYmVzKGVkaXRvclBhbmUpKTtcblx0XHRpZiAoZXhpc3RpbmdFZGl0b3JQYW5lKSB7XG5cdFx0XHRyZXR1cm4gZXhpc3RpbmdFZGl0b3JQYW5lO1xuXHRcdH1cblxuXHRcdC8vIE90aGVyd2lzZSBpbnN0YW50aWF0ZSBuZXdcblx0XHRjb25zdCBlZGl0b3JQYW5lID0gdGhpcy5fcmVnaXN0ZXIoZGVzY3JpcHRvci5pbnN0YW50aWF0ZSh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLCB0aGlzLmdyb3VwVmlldykpO1xuXHRcdHRoaXMuZWRpdG9yUGFuZXMucHVzaChlZGl0b3JQYW5lKTtcblxuXHRcdHJldHVybiBlZGl0b3JQYW5lO1xuXHR9XG5cblx0cHJpdmF0ZSBkb1NldEFjdGl2ZUVkaXRvclBhbmUoZWRpdG9yUGFuZTogRWRpdG9yUGFuZSB8IG51bGwpIHtcblx0XHR0aGlzLl9hY3RpdmVFZGl0b3JQYW5lID0gZWRpdG9yUGFuZTtcblxuXHRcdC8vIENsZWFyIG91dCBwcmV2aW91cyBhY3RpdmUgZWRpdG9yIHBhbmUgbGlzdGVuZXJzXG5cdFx0dGhpcy5hY3RpdmVFZGl0b3JQYW5lRGlzcG9zYWJsZXMuY2xlYXIoKTtcblxuXHRcdC8vIExpc3RlbiB0byBlZGl0b3IgcGFuZSBjaGFuZ2VzXG5cdFx0aWYgKGVkaXRvclBhbmUpIHtcblx0XHRcdHRoaXMuYWN0aXZlRWRpdG9yUGFuZURpc3Bvc2FibGVzLmFkZChlZGl0b3JQYW5lLm9uRGlkQ2hhbmdlU2l6ZUNvbnN0cmFpbnRzKGUgPT4gdGhpcy5fb25EaWRDaGFuZ2VTaXplQ29uc3RyYWludHMuZmlyZShlKSkpO1xuXHRcdFx0dGhpcy5hY3RpdmVFZGl0b3JQYW5lRGlzcG9zYWJsZXMuYWRkKGVkaXRvclBhbmUub25EaWRGb2N1cygoKSA9PiB0aGlzLl9vbkRpZEZvY3VzLmZpcmUoKSkpO1xuXHRcdH1cblxuXHRcdC8vIEluZGljYXRlIHRoYXQgc2l6ZSBjb25zdHJhaW50cyBjb3VsZCBoYXZlIGNoYW5nZWQgZHVlIHRvIG5ldyBlZGl0b3Jcblx0XHR0aGlzLl9vbkRpZENoYW5nZVNpemVDb25zdHJhaW50cy5maXJlKHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvU2V0SW5wdXQoZWRpdG9yUGFuZTogRWRpdG9yUGFuZSwgZWRpdG9yOiBFZGl0b3JJbnB1dCwgb3B0aW9uczogSUVkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQsIGNvbnRleHQ6IElFZGl0b3JPcGVuQ29udGV4dCk6IFByb21pc2U8eyBjaGFuZ2VkOiBib29sZWFuOyBjYW5jZWxsZWQ6IGJvb2xlYW4gfT4ge1xuXG5cdFx0Ly8gSWYgdGhlIGlucHV0IGRpZCBub3QgY2hhbmdlLCByZXR1cm4gZWFybHkgYW5kIG9ubHlcblx0XHQvLyBhcHBseSB0aGUgb3B0aW9ucyB1bmxlc3MgdGhlIG9wdGlvbnMgaW5zdHJ1Y3QgdXMgdG9cblx0XHQvLyBmb3JjZSBvcGVuIGl0IGV2ZW4gaWYgaXQgaXMgdGhlIHNhbWVcblx0XHRsZXQgaW5wdXRNYXRjaGVzID0gZWRpdG9yUGFuZS5pbnB1dD8ubWF0Y2hlcyhlZGl0b3IpO1xuXHRcdGlmIChpbnB1dE1hdGNoZXMgJiYgIW9wdGlvbnM/LmZvcmNlUmVsb2FkKSB7XG5cblx0XHRcdC8vIFdlIGhhdmUgdG8gYXdhaXQgYSBwZW5kaW5nIGBzZXRJbnB1dCgpYCBjYWxsIGZvciB0aGlzXG5cdFx0XHQvLyBwYW5lIGJlZm9yZSB3ZSBjYW4gY2FsbCBpbnRvIGBzZXRPcHRpb25zKClgLCBvdGhlcndpc2Vcblx0XHRcdC8vIHdlIHJpc2sgY2FsbGluZyB3aGVuIHRoZSBpbnB1dCBpcyBub3QgeWV0IGZ1bGx5IGFwcGxpZWQuXG5cdFx0XHRpZiAodGhpcy5tYXBFZGl0b3JQYW5lVG9QZW5kaW5nU2V0SW5wdXQuaGFzKGVkaXRvclBhbmUpKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMubWFwRWRpdG9yUGFuZVRvUGVuZGluZ1NldElucHV0LmdldChlZGl0b3JQYW5lKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQXQgdGhpcyBwb2ludCwgdGhlIGlucHV0IG1pZ2h0IGhhdmUgY2hhbmdlZCwgc28gd2UgY2hlY2sgYWdhaW5cblx0XHRcdGlucHV0TWF0Y2hlcyA9IGVkaXRvclBhbmUuaW5wdXQ/Lm1hdGNoZXMoZWRpdG9yKTtcblx0XHRcdGlmIChpbnB1dE1hdGNoZXMpIHtcblx0XHRcdFx0ZWRpdG9yUGFuZS5zZXRPcHRpb25zKG9wdGlvbnMpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4geyBjaGFuZ2VkOiBmYWxzZSwgY2FuY2VsbGVkOiAhaW5wdXRNYXRjaGVzIH07XG5cdFx0fVxuXG5cdFx0Ly8gU3RhcnQgYSBuZXcgZWRpdG9yIGlucHV0IG9wZXJhdGlvbiB0byByZXBvcnQgcHJvZ3Jlc3Ncblx0XHQvLyBhbmQgdG8gc3VwcG9ydCBjYW5jZWxsYXRpb24uIEFueSBuZXcgb3BlcmF0aW9uIHRoYXQgaXNcblx0XHQvLyBzdGFydGVkIHdpbGwgY2FuY2VsIHRoZSBwcmV2aW91cyBvbmUuXG5cdFx0Y29uc3Qgb3BlcmF0aW9uID0gdGhpcy5lZGl0b3JPcGVyYXRpb24uc3RhcnQodGhpcy5sYXlvdXRTZXJ2aWNlLmlzUmVzdG9yZWQoKSA/IDgwMCA6IDMyMDApO1xuXG5cdFx0bGV0IGNhbmNlbGxlZCA9IGZhbHNlO1xuXHRcdHRyeSB7XG5cblx0XHRcdC8vIENsZWFyIHRoZSBjdXJyZW50IGlucHV0IGJlZm9yZSBzZXR0aW5nIG5ldyBpbnB1dFxuXHRcdFx0Ly8gVGhpcyBlbnN1cmVzIHRoYXQgYSBzbG93IGxvYWRpbmcgaW5wdXQgd2lsbCBub3Rcblx0XHRcdC8vIGJlIHZpc2libGUgZm9yIHRoZSBkdXJhdGlvbiBvZiB0aGUgbmV3IGlucHV0IHRvXG5cdFx0XHQvLyBsb2FkIChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMzQ2OTcpXG5cdFx0XHRlZGl0b3JQYW5lLmNsZWFySW5wdXQoKTtcblxuXHRcdFx0Ly8gU2V0IHRoZSBpbnB1dCB0byB0aGUgZWRpdG9yIHBhbmUgYW5kIGtlZXAgdHJhY2sgb2YgaXRcblx0XHRcdGNvbnN0IHBlbmRpbmdTZXRJbnB1dCA9IGVkaXRvclBhbmUuc2V0SW5wdXQoZWRpdG9yLCBvcHRpb25zLCBjb250ZXh0LCBvcGVyYXRpb24udG9rZW4pO1xuXHRcdFx0dGhpcy5tYXBFZGl0b3JQYW5lVG9QZW5kaW5nU2V0SW5wdXQuc2V0KGVkaXRvclBhbmUsIHBlbmRpbmdTZXRJbnB1dCk7XG5cdFx0XHRhd2FpdCBwZW5kaW5nU2V0SW5wdXQ7XG5cblx0XHRcdGlmICghb3BlcmF0aW9uLmlzQ3VycmVudCgpKSB7XG5cdFx0XHRcdGNhbmNlbGxlZCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGlmICghb3BlcmF0aW9uLmlzQ3VycmVudCgpKSB7XG5cdFx0XHRcdGNhbmNlbGxlZCA9IHRydWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdH1cblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0aWYgKG9wZXJhdGlvbi5pc0N1cnJlbnQoKSkge1xuXHRcdFx0XHR0aGlzLm1hcEVkaXRvclBhbmVUb1BlbmRpbmdTZXRJbnB1dC5kZWxldGUoZWRpdG9yUGFuZSk7XG5cdFx0XHR9XG5cdFx0XHRvcGVyYXRpb24uc3RvcCgpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7IGNoYW5nZWQ6ICFpbnB1dE1hdGNoZXMsIGNhbmNlbGxlZCB9O1xuXHR9XG5cblx0cHJpdmF0ZSBkb0hpZGVBY3RpdmVFZGl0b3JQYW5lKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fYWN0aXZlRWRpdG9yUGFuZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFN0b3AgYW55IHJ1bm5pbmcgb3BlcmF0aW9uXG5cdFx0dGhpcy5lZGl0b3JPcGVyYXRpb24uc3RvcCgpO1xuXG5cdFx0Ly8gSW5kaWNhdGUgdG8gZWRpdG9yIHBhbmUgYmVmb3JlIHJlbW92aW5nIHRoZSBlZGl0b3IgZnJvbVxuXHRcdC8vIHRoZSBET00gdG8gZ2l2ZSBhIGNoYW5jZSB0byBwZXJzaXN0IGNlcnRhaW4gc3RhdGUgdGhhdFxuXHRcdC8vIG1pZ2h0IGRlcGVuZCBvbiBzdGlsbCBiZWluZyB0aGUgYWN0aXZlIERPTSBlbGVtZW50LlxuXHRcdHRoaXMuc2FmZVJ1bigoKSA9PiB0aGlzLl9hY3RpdmVFZGl0b3JQYW5lPy5jbGVhcklucHV0KCkpO1xuXHRcdHRoaXMuc2FmZVJ1bigoKSA9PiB0aGlzLl9hY3RpdmVFZGl0b3JQYW5lPy5zZXRWaXNpYmxlKGZhbHNlKSk7XG5cblx0XHQvLyBDbGVhciBhbnkgcGVuZGluZyBzZXRJbnB1dCBwcm9taXNlXG5cdFx0dGhpcy5tYXBFZGl0b3JQYW5lVG9QZW5kaW5nU2V0SW5wdXQuZGVsZXRlKHRoaXMuX2FjdGl2ZUVkaXRvclBhbmUpO1xuXG5cdFx0Ly8gUmVtb3ZlIGVkaXRvciBwYW5lIGZyb20gcGFyZW50XG5cdFx0Y29uc3QgZWRpdG9yUGFuZUNvbnRhaW5lciA9IHRoaXMuX2FjdGl2ZUVkaXRvclBhbmUuZ2V0Q29udGFpbmVyKCk7XG5cdFx0aWYgKGVkaXRvclBhbmVDb250YWluZXIpIHtcblx0XHRcdGVkaXRvclBhbmVDb250YWluZXIucmVtb3ZlKCk7XG5cdFx0XHRoaWRlKGVkaXRvclBhbmVDb250YWluZXIpO1xuXHRcdH1cblxuXHRcdC8vIENsZWFyIGFjdGl2ZSBlZGl0b3IgcGFuZVxuXHRcdHRoaXMuZG9TZXRBY3RpdmVFZGl0b3JQYW5lKG51bGwpO1xuXHR9XG5cblx0Y2xvc2VFZGl0b3IoZWRpdG9yOiBFZGl0b3JJbnB1dCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9hY3RpdmVFZGl0b3JQYW5lPy5pbnB1dCAmJiBlZGl0b3IubWF0Y2hlcyh0aGlzLl9hY3RpdmVFZGl0b3JQYW5lLmlucHV0KSkge1xuXHRcdFx0dGhpcy5kb0hpZGVBY3RpdmVFZGl0b3JQYW5lKCk7XG5cdFx0fVxuXHR9XG5cblx0c2V0VmlzaWJsZSh2aXNpYmxlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5zYWZlUnVuKCgpID0+IHRoaXMuX2FjdGl2ZUVkaXRvclBhbmU/LnNldFZpc2libGUodmlzaWJsZSkpO1xuXHR9XG5cblx0bGF5b3V0KHBhZ2VQb3NpdGlvbjogSURvbU5vZGVQYWdlUG9zaXRpb24pOiB2b2lkIHtcblx0XHR0aGlzLnBhZ2VQb3NpdGlvbiA9IHBhZ2VQb3NpdGlvbjtcblxuXHRcdHRoaXMuc2FmZVJ1bigoKSA9PiB0aGlzLl9hY3RpdmVFZGl0b3JQYW5lPy5sYXlvdXQobmV3IERpbWVuc2lvbihwYWdlUG9zaXRpb24ud2lkdGgsIHBhZ2VQb3NpdGlvbi5oZWlnaHQpLCBwYWdlUG9zaXRpb24pKTtcblx0fVxuXG5cdHNldEJvdW5kYXJ5U2FzaGVzKHNhc2hlczogSUJvdW5kYXJ5U2FzaGVzKTogdm9pZCB7XG5cdFx0dGhpcy5ib3VuZGFyeVNhc2hlcyA9IHNhc2hlcztcblxuXHRcdHRoaXMuc2FmZVJ1bigoKSA9PiB0aGlzLl9hY3RpdmVFZGl0b3JQYW5lPy5zZXRCb3VuZGFyeVNhc2hlcyhzYXNoZXMpKTtcblx0fVxuXG5cdHByaXZhdGUgc2FmZVJ1bihmbjogKCkgPT4gdm9pZCk6IHZvaWQge1xuXG5cdFx0Ly8gV2UgZGVsZWdhdGUgbWFueSBjYWxscyB0byB0aGUgYWN0aXZlIGVkaXRvciBwYW5lIHdoaWNoXG5cdFx0Ly8gY2FuIGJlIGFueSBraW5kIG9mIGVkaXRvci4gV2UgbXVzdCBlbnN1cmUgdGhhdCBvdXIgY2FsbHNcblx0XHQvLyBkbyBub3QgdGhyb3csIGZvciBleGFtcGxlIGluIGBsYXlvdXQoKWAgYmVjYXVzZSB0aGF0IGNhblxuXHRcdC8vIG1lc3Mgd2l0aCB0aGUgZ3JpZCBsYXlvdXQuXG5cblx0XHR0cnkge1xuXHRcdFx0Zm4oKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFFekIsU0FBUyxlQUFlO0FBQ3hCLE9BQU8sY0FBYztBQUNyQixTQUFTLFlBQVksdUJBQXVCO0FBQzVDLFNBQVMsa0JBQWtCLHlCQUFpRSx5QkFBeUI7QUFFckgsU0FBUyxXQUFXLE1BQU0sTUFBNEIsWUFBWSxrQkFBa0IsZUFBZSxtQkFBbUIsU0FBUztBQUMvSCxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLCtCQUErQjtBQUV4QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHdCQUF3Qiw0QkFBNEI7QUFDN0QsU0FBMkIsK0JBQStCLHFDQUFpRTtBQUMzSCxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHdDQUF3QztBQUNqRCxTQUFTLHdCQUF3RCwrQ0FBK0M7QUFDaEgsU0FBUyx3QkFBd0M7QUFDakQsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxzQkFBMEQ7QUFFbkUsU0FBUyxvQkFBb0I7QUFvQ3RCLElBQU0sY0FBTixjQUEwQixXQUFXO0FBQUEsRUErQjNDLFlBQ2tCLG1CQUNBLG1CQUNBLFdBQ3lCLGVBQ0Ysc0JBQ2hCLHVCQUMyQix1QkFDckIsWUFDRyxlQUNGLGFBQzlCO0FBQ0QsVUFBTTtBQVhXO0FBQ0E7QUFDQTtBQUN5QjtBQUNGO0FBRVc7QUFDckI7QUFDRztBQUNGO0FBckNoQztBQUFBLFNBQWlCLGNBQWMsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBQ2pFLFNBQVMsYUFBYSxLQUFLLFlBQVk7QUFFdkMsU0FBUSw4QkFBOEIsS0FBSyxVQUFVLElBQUksUUFBdUQsQ0FBQztBQUNqSCxTQUFTLDZCQUE2QixLQUFLLDRCQUE0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
