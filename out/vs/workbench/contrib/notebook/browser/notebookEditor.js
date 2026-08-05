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
import * as DOM from "../../../../base/browser/dom.js";
import { toAction } from "../../../../base/common/actions.js";
import { timeout } from "../../../../base/common/async.js";
import { Emitter } from "../../../../base/common/event.js";
import { DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { extname, isEqual } from "../../../../base/common/resources.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { localize } from "../../../../nls.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ByteSize, FileOperationResult, IFileService, TooLargeFileOperationError } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { DEFAULT_EDITOR_ASSOCIATION, EditorPaneSelectionChangeReason, EditorPaneSelectionCompareResult, EditorResourceAccessor, createEditorOpenError, createTooLargeFileError, isEditorOpenError } from "../../../common/editor.js";
import { SELECT_KERNEL_ID } from "./controller/coreActions.js";
import { INotebookEditorService } from "./services/notebookEditorService.js";
import { NotebooKernelActionViewItem } from "./viewParts/notebookKernelView.js";
import { CellKind, NOTEBOOK_EDITOR_ID, NotebookWorkingCopyTypeIdentifier } from "../common/notebookCommon.js";
import { NotebookEditorInput } from "../common/notebookEditorInput.js";
import { NotebookPerfMarks } from "../common/notebookPerformance.js";
import { GroupsOrder, IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IEditorProgressService } from "../../../../platform/progress/common/progress.js";
import { InstallRecommendedExtensionAction } from "../../extensions/browser/extensionsActions.js";
import { INotebookService } from "../common/notebookService.js";
import { IExtensionsWorkbenchService } from "../../extensions/common/extensions.js";
import { EnablementState } from "../../../services/extensionManagement/common/extensionManagement.js";
import { IWorkingCopyBackupService } from "../../../services/workingCopy/common/workingCopyBackup.js";
import { streamToBuffer } from "../../../../base/common/buffer.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
const NOTEBOOK_EDITOR_VIEW_STATE_PREFERENCE_KEY = "NotebookEditorViewState";
let NotebookEditor = class extends EditorPane {
  constructor(group, telemetryService, themeService, _instantiationService, storageService, _editorService, _editorGroupService, _notebookWidgetService, _contextKeyService, _fileService, configurationService, _editorProgressService, _notebookService, _extensionsWorkbenchService, _workingCopyBackupService, logService, _preferencesService) {
    super(NotebookEditor.ID, group, telemetryService, themeService, storageService);
    this._instantiationService = _instantiationService;
    this._editorService = _editorService;
    this._editorGroupService = _editorGroupService;
    this._notebookWidgetService = _notebookWidgetService;
    this._contextKeyService = _contextKeyService;
    this._fileService = _fileService;
    this._editorProgressService = _editorProgressService;
    this._notebookService = _notebookService;
    this._extensionsWorkbenchService = _extensionsWorkbenchService;
    this._workingCopyBackupService = _workingCopyBackupService;
    this.logService = logService;
    this._preferencesService = _preferencesService;
    this._groupListener = this._register(new DisposableStore());
    this._widgetDisposableStore = this._register(new DisposableStore());
    this._widget = { value: void 0 };
    this._inputListener = this._register(new MutableDisposable());
    // override onDidFocus and onDidBlur to be based on the NotebookEditorWidget element
    this._onDidFocusWidget = this._register(new Emitter());
    this._onDidBlurWidget = this._register(new Emitter());
    this._onDidChangeModel = this._register(new Emitter());
    this.onDidChangeModel = this._onDidChangeModel.event;
    this._onDidChangeSelection = this._register(new Emitter());
    this.onDidChangeSelection = this._onDidChangeSelection.event;
    this._onDidChangeScroll = this._register(new Emitter());
    this.onDidChangeScroll = this._onDidChangeScroll.event;
    this._editorMemento = this.getEditorMemento(_editorGroupService, configurationService, NOTEBOOK_EDITOR_VIEW_STATE_PREFERENCE_KEY);
    this._register(this._fileService.onDidChangeFileSystemProviderCapabilities((e) => this._onDidChangeFileSystemProvider(e.scheme)));
    this._register(this._fileService.onDidChangeFileSystemProviderRegistrations((e) => this._onDidChangeFileSystemProvider(e.scheme)));
  }
  get onDidFocus() {
    return this._onDidFocusWidget.event;
  }
  get onDidBlur() {
    return this._onDidBlurWidget.event;
  }
  _onDidChangeFileSystemProvider(scheme) {
    if (this.input instanceof NotebookEditorInput && this.input.resource?.scheme === scheme) {
      this._updateReadonly(this.input);
    }
  }
  _onDidChangeInputCapabilities(input) {
    if (this.input === input) {
      this._updateReadonly(input);
    }
  }
  _updateReadonly(input) {
    this._widget.value?.setOptions({ isReadOnly: !!input.isReadonly() });
  }
  get textModel() {
    return this._widget.value?.textModel;
  }
  get minimumWidth() {
    return 220;
  }
  get maximumWidth() {
    return Number.POSITIVE_INFINITY;
  }
  // these setters need to exist because this extends from EditorPane
  set minimumWidth(value) {
  }
  set maximumWidth(value) {
  }
  //#region Editor Core
  get scopedContextKeyService() {
    return this._widget.value?.scopedContextKeyService;
  }
  createEditor(parent) {
    this._rootElement = DOM.append(parent, DOM.$(".notebook-editor"));
    this._rootElement.id = `notebook-editor-element-${generateUuid()}`;
  }
  getActionViewItem(action, options) {
    if (action.id === SELECT_KERNEL_ID) {
      return this._register(this._instantiationService.createInstance(NotebooKernelActionViewItem, action, this, options));
    }
    return void 0;
  }
  getControl() {
    return this._widget.value;
  }
  setVisible(visible) {
    super.setVisible(visible);
    if (!visible) {
      this._widget.value?.onWillHide();
    }
  }
  setEditorVisible(visible) {
    super.setEditorVisible(visible);
    this._groupListener.clear();
    this._groupListener.add(this.group.onWillCloseEditor((e) => this._saveEditorViewState(e.editor)));
    this._groupListener.add(this.group.onDidModelChange(() => {
      if (this._editorGroupService.activeGroup !== this.group) {
        this._widget?.value?.updateEditorFocus();
      }
    }));
    if (!visible) {
      this._saveEditorViewState(this.input);
      if (this.input && this._widget.value) {
        this._widget.value.onWillHide();
      }
    }
  }
  focus() {
    super.focus();
    this._widget.value?.focus();
  }
  hasFocus() {
    const value = this._widget.value;
    if (!value) {
      return false;
    }
    return !!value && DOM.isAncestorOfActiveElement(value.getDomNode() || DOM.isAncestorOfActiveElement(value.getOverflowContainerDomNode()));
  }
  async setInput(input, options, context, token, noRetry) {
    try {
      let perfMarksCaptured = false;
      const fileOpenMonitor = timeout(1e4);
      fileOpenMonitor.then(() => {
        perfMarksCaptured = true;
        this._handlePerfMark(perf, input);
      });
      const perf = new NotebookPerfMarks();
      perf.mark("startTime");
      this._inputListener.value = input.onDidChangeCapabilities(() => this._onDidChangeInputCapabilities(input));
      this._widgetDisposableStore.clear();
      this._widget.value?.onWillHide();
      this._widget = this._instantiationService.invokeFunction(this._notebookWidgetService.retrieveWidget, this.group.id, input, void 0, this._pagePosition?.dimension, this.window);
      if (this._rootElement && this._widget.value.getDomNode()) {
        this._rootElement.setAttribute("aria-flowto", this._widget.value.getDomNode().id || "");
        DOM.setParentFlowTo(this._widget.value.getDomNode(), this._rootElement);
      }
      this._widgetDisposableStore.add(this._widget.value.onDidChangeModel(() => this._onDidChangeModel.fire()));
      this._widgetDisposableStore.add(this._widget.value.onDidChangeActiveCell(() => this._onDidChangeSelection.fire({ reason: EditorPaneSelectionChangeReason.USER })));
      if (this._pagePosition) {
        this._widget.value.layout(this._pagePosition.dimension, this._rootElement, this._pagePosition.position);
      }
      await super.setInput(input, options, context, token);
      const model = await input.resolve(options, perf);
      perf.mark("inputLoaded");
      if (token.isCancellationRequested) {
        return void 0;
      }
      if (!this._widget.value) {
        if (noRetry) {
          return void 0;
        }
        return this.setInput(input, options, context, token, true);
      }
      if (model === null) {
        const knownProvider = this._notebookService.getViewTypeProvider(input.viewType);
        if (!knownProvider) {
          throw new Error(localize("fail.noEditor", "Cannot open resource with notebook editor type '{0}', please check if you have the right extension installed and enabled.", input.viewType));
        }
        await this._extensionsWorkbenchService.whenInitialized;
        const extensionInfo = this._extensionsWorkbenchService.local.find((e) => e.identifier.id === knownProvider);
        throw createEditorOpenError(new Error(localize("fail.noEditor.extensionMissing", "Cannot open resource with notebook editor type '{0}', please check if you have the right extension installed and enabled.", input.viewType)), [
          toAction({
            id: "workbench.notebook.action.installOrEnableMissing",
            label: extensionInfo ? localize("notebookOpenEnableMissingViewType", "Enable extension for '{0}'", input.viewType) : localize("notebookOpenInstallMissingViewType", "Install extension for '{0}'", input.viewType),
            run: async () => {
              const d = this._notebookService.onAddViewType((viewType) => {
                if (viewType === input.viewType) {
                  this._editorService.openEditor({ resource: input.resource });
                  d.dispose();
                }
              });
              const extensionInfo2 = this._extensionsWorkbenchService.local.find((e) => e.identifier.id === knownProvider);
              try {
                if (extensionInfo2) {
                  await this._extensionsWorkbenchService.setEnablement(extensionInfo2, extensionInfo2.enablementState === EnablementState.DisabledWorkspace ? EnablementState.EnabledWorkspace : EnablementState.EnabledGlobally);
                } else {
                  await this._instantiationService.createInstance(InstallRecommendedExtensionAction, knownProvider).run();
                }
              } catch (ex) {
                this.logService.error(`Failed to install or enable extension ${knownProvider}`, ex);
                d.dispose();
              }
            }
          }),
          toAction({
            id: "workbench.notebook.action.openAsText",
            label: localize("notebookOpenAsText", "Open As Text"),
            run: async () => {
              const backup = await this._workingCopyBackupService.resolve({ resource: input.resource, typeId: NotebookWorkingCopyTypeIdentifier.create(input.viewType) });
              if (backup) {
                const contents = await streamToBuffer(backup.value);
                this._editorService.openEditor({ resource: void 0, contents: contents.toString() });
              } else {
                this._editorService.openEditor({ resource: input.resource, options: { override: DEFAULT_EDITOR_ASSOCIATION.id, pinned: true } });
              }
            }
          })
        ], { allowDialog: true });
      }
      this._widgetDisposableStore.add(model.notebook.onDidChangeContent(() => this._onDidChangeSelection.fire({ reason: EditorPaneSelectionChangeReason.EDIT })));
      const viewState = options?.viewState ?? this._loadNotebookEditorViewState(input);
      this._widget.value.setParentContextKeyService(this._contextKeyService);
      this._widget.value.setEditorProgressService(this._editorProgressService);
      await this._widget.value.setModel(model.notebook, viewState, perf);
      const isReadOnly = !!input.isReadonly();
      await this._widget.value.setOptions({ ...options, isReadOnly });
      this._widgetDisposableStore.add(this._widget.value.onDidFocusWidget(() => this._onDidFocusWidget.fire()));
      this._widgetDisposableStore.add(this._widget.value.onDidBlurWidget(() => this._onDidBlurWidget.fire()));
      this._widgetDisposableStore.add(this._editorGroupService.createEditorDropTarget(this._widget.value.getDomNode(), {
        containsGroup: (group) => this.group.id === group.id
      }));
      this._widgetDisposableStore.add(this._widget.value.onDidScroll(() => {
        this._onDidChangeScroll.fire();
      }));
      perf.mark("editorLoaded");
      fileOpenMonitor.cancel();
      if (perfMarksCaptured) {
        return;
      }
      this._handlePerfMark(perf, input, model.notebook);
      this._onDidChangeControl.fire();
    } catch (e) {
      this.logService.warn("NotebookEditorWidget#setInput failed", e);
      if (isEditorOpenError(e)) {
        throw e;
      }
      if (e.fileOperationResult === FileOperationResult.FILE_TOO_LARGE) {
        let message;
        if (e instanceof TooLargeFileOperationError) {
          message = localize("notebookTooLargeForHeapErrorWithSize", "The notebook is not displayed in the notebook editor because it is very large ({0}).", ByteSize.formatSize(e.size));
        } else {
          message = localize("notebookTooLargeForHeapErrorWithoutSize", "The notebook is not displayed in the notebook editor because it is very large.");
        }
        throw createTooLargeFileError(this.group, input, options, message, this._preferencesService);
      }
      const error = createEditorOpenError(e instanceof Error ? e : new Error(e ? e.message : ""), [
        toAction({
          id: "workbench.notebook.action.openInTextEditor",
          label: localize("notebookOpenInTextEditor", "Open in Text Editor"),
          run: async () => {
            const activeEditorPane = this._editorService.activeEditorPane;
            if (!activeEditorPane) {
              return;
            }
            const activeEditorResource = EditorResourceAccessor.getCanonicalUri(activeEditorPane.input);
            if (!activeEditorResource) {
              return;
            }
            if (activeEditorResource.toString() === input.resource?.toString()) {
              return this._editorService.openEditor({
                resource: activeEditorResource,
                options: {
                  override: DEFAULT_EDITOR_ASSOCIATION.id,
                  pinned: true
                  // new file gets pinned by default
                }
              });
            }
            return;
          }
        })
      ], { allowDialog: true });
      throw error;
    }
  }
  _handlePerfMark(perf, input, notebook) {
    const perfMarks = perf.value;
    const startTime = perfMarks["startTime"];
    const extensionActivated = perfMarks["extensionActivated"];
    const inputLoaded = perfMarks["inputLoaded"];
    const webviewCommLoaded = perfMarks["webviewCommLoaded"];
    const customMarkdownLoaded = perfMarks["customMarkdownLoaded"];
    const editorLoaded = perfMarks["editorLoaded"];
    let extensionActivationTimespan = -1;
    let inputLoadingTimespan = -1;
    let webviewCommLoadingTimespan = -1;
    let customMarkdownLoadingTimespan = -1;
    let editorLoadingTimespan = -1;
    if (startTime !== void 0 && extensionActivated !== void 0) {
      extensionActivationTimespan = extensionActivated - startTime;
      if (inputLoaded !== void 0) {
        inputLoadingTimespan = inputLoaded - extensionActivated;
      }
      if (webviewCommLoaded !== void 0) {
        webviewCommLoadingTimespan = webviewCommLoaded - extensionActivated;
      }
      if (customMarkdownLoaded !== void 0) {
        customMarkdownLoadingTimespan = customMarkdownLoaded - startTime;
      }
      if (editorLoaded !== void 0) {
        editorLoadingTimespan = editorLoaded - startTime;
      }
    }
    let codeCellCount = void 0;
    let mdCellCount = void 0;
    let outputCount = void 0;
    let outputBytes = void 0;
    let codeLength = void 0;
    let markdownLength = void 0;
    let notebookStatsLoaded = void 0;
    if (notebook) {
      const stopWatch = new StopWatch();
      for (const cell of notebook.cells) {
        if (cell.cellKind === CellKind.Code) {
          codeCellCount = (codeCellCount || 0) + 1;
          codeLength = (codeLength || 0) + cell.getTextLength();
          outputCount = (outputCount || 0) + cell.outputs.length;
          outputBytes = (outputBytes || 0) + cell.outputs.reduce((prev, cur) => prev + cur.outputs.reduce((size, item) => size + item.data.byteLength, 0), 0);
        } else {
          mdCellCount = (mdCellCount || 0) + 1;
          markdownLength = (codeLength || 0) + cell.getTextLength();
        }
      }
      notebookStatsLoaded = stopWatch.elapsed();
    }
    this.logService.trace(`[NotebookEditor] open notebook perf ${notebook?.uri.toString() ?? ""} - extensionActivation: ${extensionActivationTimespan}, inputLoad: ${inputLoadingTimespan}, webviewComm: ${webviewCommLoadingTimespan}, customMarkdown: ${customMarkdownLoadingTimespan}, editorLoad: ${editorLoadingTimespan}`);
    this.telemetryService.publicLog2("notebook/editorOpenPerf", {
      scheme: input.resource.scheme,
      ext: extname(input.resource),
      viewType: input.viewType,
      extensionActivated: extensionActivationTimespan,
      inputLoaded: inputLoadingTimespan,
      webviewCommLoaded: webviewCommLoadingTimespan,
      customMarkdownLoaded: customMarkdownLoadingTimespan,
      editorLoaded: editorLoadingTimespan,
      codeCellCount,
      mdCellCount,
      outputCount,
      outputBytes,
      codeLength,
      markdownLength,
      notebookStatsLoaded
    });
  }
  clearInput() {
    this._inputListener.clear();
    if (this._widget.value) {
      this._saveEditorViewState(this.input);
      this._widget.value.onWillHide();
    }
    super.clearInput();
  }
  setOptions(options) {
    this._widget.value?.setOptions(options);
    super.setOptions(options);
  }
  saveState() {
    this._saveEditorViewState(this.input);
    super.saveState();
  }
  getViewState() {
    const input = this.input;
    if (!(input instanceof NotebookEditorInput)) {
      return void 0;
    }
    this._saveEditorViewState(input);
    return this._loadNotebookEditorViewState(input);
  }
  getSelection() {
    if (this._widget.value) {
      const activeCell = this._widget.value.getActiveCell();
      if (activeCell) {
        const cellUri = activeCell.uri;
        return new NotebookEditorSelection(cellUri, activeCell.getSelections());
      }
    }
    return void 0;
  }
  getScrollPosition() {
    const widget = this.getControl();
    if (!widget) {
      throw new Error("Notebook widget has not yet been initialized");
    }
    return {
      scrollTop: widget.scrollTop,
      scrollLeft: 0
    };
  }
  setScrollPosition(scrollPosition) {
    const editor = this.getControl();
    if (!editor) {
      throw new Error("Control has not yet been initialized");
    }
    editor.setScrollTop(scrollPosition.scrollTop);
  }
  _saveEditorViewState(input) {
    if (this._widget.value && input instanceof NotebookEditorInput) {
      if (this._widget.value.isDisposed) {
        return;
      }
      const state = this._widget.value.getEditorViewState();
      this._editorMemento.saveEditorState(this.group, input.resource, state);
    }
  }
  _loadNotebookEditorViewState(input) {
    const result = this._editorMemento.loadEditorState(this.group, input.resource);
    if (result) {
      return result;
    }
    for (const group of this._editorGroupService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE)) {
      if (group.activeEditorPane !== this && group.activeEditorPane instanceof NotebookEditor && group.activeEditor?.matches(input)) {
        return group.activeEditorPane._widget.value?.getEditorViewState();
      }
    }
    return;
  }
  layout(dimension, position) {
    this._rootElement.classList.toggle("mid-width", dimension.width < 1e3 && dimension.width >= 600);
    this._rootElement.classList.toggle("narrow-width", dimension.width < 600);
    this._pagePosition = { dimension, position };
    if (!this._widget.value || !(this.input instanceof NotebookEditorInput)) {
      return;
    }
    if (this.input.resource.toString() !== this.textModel?.uri.toString() && this._widget.value?.hasModel()) {
      return;
    }
    if (this.isVisible()) {
      this._widget.value.layout(dimension, this._rootElement, position);
    }
  }
  //#endregion
};
NotebookEditor.ID = NOTEBOOK_EDITOR_ID;
NotebookEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IEditorGroupsService),
  __decorateParam(7, INotebookEditorService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IFileService),
  __decorateParam(10, ITextResourceConfigurationService),
  __decorateParam(11, IEditorProgressService),
  __decorateParam(12, INotebookService),
  __decorateParam(13, IExtensionsWorkbenchService),
  __decorateParam(14, IWorkingCopyBackupService),
  __decorateParam(15, ILogService),
  __decorateParam(16, IPreferencesService)
], NotebookEditor);
class NotebookEditorSelection {
  constructor(cellUri, selections) {
    this.cellUri = cellUri;
    this.selections = selections;
  }
  compare(other) {
    if (!(other instanceof NotebookEditorSelection)) {
      return EditorPaneSelectionCompareResult.DIFFERENT;
    }
    if (isEqual(this.cellUri, other.cellUri)) {
      return EditorPaneSelectionCompareResult.IDENTICAL;
    }
    return EditorPaneSelectionCompareResult.DIFFERENT;
  }
  restore(options) {
    const notebookOptions = {
      cellOptions: {
        resource: this.cellUri,
        options: {
          selection: this.selections[0]
        }
      }
    };
    Object.assign(notebookOptions, options);
    return notebookOptions;
  }
  log() {
    return this.cellUri.fragment;
  }
}
export {
  NotebookEditor
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL25vdGVib29rRWRpdG9yLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgRE9NIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSUFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgSUFjdGlvbiwgdG9BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZXh0bmFtZSwgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3RleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IEJ5dGVTaXplLCBGaWxlT3BlcmF0aW9uRXJyb3IsIEZpbGVPcGVyYXRpb25SZXN1bHQsIElGaWxlU2VydmljZSwgVG9vTGFyZ2VGaWxlT3BlcmF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBFZGl0b3JQYW5lIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yUGFuZS5qcyc7XG5pbXBvcnQgeyBERUZBVUxUX0VESVRPUl9BU1NPQ0lBVElPTiwgRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZVJlYXNvbiwgRWRpdG9yUGFuZVNlbGVjdGlvbkNvbXBhcmVSZXN1bHQsIEVkaXRvclJlc291cmNlQWNjZXNzb3IsIElFZGl0b3JNZW1lbnRvLCBJRWRpdG9yT3BlbkNvbnRleHQsIElFZGl0b3JQYW5lU2Nyb2xsUG9zaXRpb24sIElFZGl0b3JQYW5lU2VsZWN0aW9uLCBJRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZUV2ZW50LCBJRWRpdG9yUGFuZVdpdGhTY3JvbGxpbmcsIGNyZWF0ZUVkaXRvck9wZW5FcnJvciwgY3JlYXRlVG9vTGFyZ2VGaWxlRXJyb3IsIGlzRWRpdG9yT3BlbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgU0VMRUNUX0tFUk5FTF9JRCB9IGZyb20gJy4vY29udHJvbGxlci9jb3JlQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tFZGl0b3JPcHRpb25zLCBJTm90ZWJvb2tFZGl0b3JQYW5lLCBJTm90ZWJvb2tFZGl0b3JWaWV3U3RhdGUgfSBmcm9tICcuL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBJQm9ycm93VmFsdWUsIElOb3RlYm9va0VkaXRvclNlcnZpY2UgfSBmcm9tICcuL3NlcnZpY2VzL25vdGVib29rRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0VkaXRvcldpZGdldCB9IGZyb20gJy4vbm90ZWJvb2tFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgTm90ZWJvb0tlcm5lbEFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi92aWV3UGFydHMvbm90ZWJvb2tLZXJuZWxWaWV3LmpzJztcbmltcG9ydCB7IE5vdGVib29rVGV4dE1vZGVsIH0gZnJvbSAnLi4vY29tbW9uL21vZGVsL25vdGVib29rVGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IENlbGxLaW5kLCBOT1RFQk9PS19FRElUT1JfSUQsIE5vdGVib29rV29ya2luZ0NvcHlUeXBlSWRlbnRpZmllciB9IGZyb20gJy4uL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0VkaXRvcklucHV0IH0gZnJvbSAnLi4vY29tbW9uL25vdGVib29rRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tQZXJmTWFya3MgfSBmcm9tICcuLi9jb21tb24vbm90ZWJvb2tQZXJmb3JtYW5jZS5qcyc7XG5pbXBvcnQgeyBHcm91cHNPcmRlciwgSUVkaXRvckdyb3VwLCBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IEluc3RhbGxSZWNvbW1lbmRlZEV4dGVuc2lvbkFjdGlvbiB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvYnJvd3Nlci9leHRlbnNpb25zQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL25vdGVib29rU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEVuYWJsZW1lbnRTdGF0ZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5QmFja3VwU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3dvcmtpbmdDb3B5L2NvbW1vbi93b3JraW5nQ29weUJhY2t1cC5qcyc7XG5pbXBvcnQgeyBzdHJlYW1Ub0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElQcmVmZXJlbmNlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXMuanMnO1xuaW1wb3J0IHsgSUFjdGlvblZpZXdJdGVtT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uVmlld0l0ZW1zLmpzJztcbmltcG9ydCB7IFN0b3BXYXRjaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0b3B3YXRjaC5qcyc7XG5cbmNvbnN0IE5PVEVCT09LX0VESVRPUl9WSUVXX1NUQVRFX1BSRUZFUkVOQ0VfS0VZID0gJ05vdGVib29rRWRpdG9yVmlld1N0YXRlJztcblxuZXhwb3J0IGNsYXNzIE5vdGVib29rRWRpdG9yIGV4dGVuZHMgRWRpdG9yUGFuZSBpbXBsZW1lbnRzIElOb3RlYm9va0VkaXRvclBhbmUsIElFZGl0b3JQYW5lV2l0aFNjcm9sbGluZyB7XG5cdHN0YXRpYyByZWFkb25seSBJRDogc3RyaW5nID0gTk9URUJPT0tfRURJVE9SX0lEO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvck1lbWVudG86IElFZGl0b3JNZW1lbnRvPElOb3RlYm9va0VkaXRvclZpZXdTdGF0ZT47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2dyb3VwTGlzdGVuZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF93aWRnZXREaXNwb3NhYmxlU3RvcmU6IERpc3Bvc2FibGVTdG9yZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgX3dpZGdldDogSUJvcnJvd1ZhbHVlPE5vdGVib29rRWRpdG9yV2lkZ2V0PiA9IHsgdmFsdWU6IHVuZGVmaW5lZCB9O1xuXHRwcml2YXRlIF9yb290RWxlbWVudCE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIF9wYWdlUG9zaXRpb24/OiB7IHJlYWRvbmx5IGRpbWVuc2lvbjogRE9NLkRpbWVuc2lvbjsgcmVhZG9ubHkgcG9zaXRpb246IERPTS5JRG9tUG9zaXRpb24gfTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9pbnB1dExpc3RlbmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXG5cdC8vIG92ZXJyaWRlIG9uRGlkRm9jdXMgYW5kIG9uRGlkQmx1ciB0byBiZSBiYXNlZCBvbiB0aGUgTm90ZWJvb2tFZGl0b3JXaWRnZXQgZWxlbWVudFxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEZvY3VzV2lkZ2V0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdG92ZXJyaWRlIGdldCBvbkRpZEZvY3VzKCk6IEV2ZW50PHZvaWQ+IHsgcmV0dXJuIHRoaXMuX29uRGlkRm9jdXNXaWRnZXQuZXZlbnQ7IH1cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRCbHVyV2lkZ2V0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdG92ZXJyaWRlIGdldCBvbkRpZEJsdXIoKTogRXZlbnQ8dm9pZD4geyByZXR1cm4gdGhpcy5fb25EaWRCbHVyV2lkZ2V0LmV2ZW50OyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VNb2RlbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZU1vZGVsOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlTW9kZWwuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VTZWxlY3Rpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZUV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VTZWxlY3Rpb24gPSB0aGlzLl9vbkRpZENoYW5nZVNlbGVjdGlvbi5ldmVudDtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU2Nyb2xsID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlU2Nyb2xsID0gdGhpcy5fb25EaWRDaGFuZ2VTY3JvbGwuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Z3JvdXA6IElFZGl0b3JHcm91cCxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JHcm91cFNlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rV2lkZ2V0U2VydmljZTogSU5vdGVib29rRWRpdG9yU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9maWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUVkaXRvclByb2dyZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JQcm9ncmVzc1NlcnZpY2U6IElFZGl0b3JQcm9ncmVzc1NlcnZpY2UsXG5cdFx0QElOb3RlYm9va1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tTZXJ2aWNlOiBJTm90ZWJvb2tTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2U6IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSxcblx0XHRASVdvcmtpbmdDb3B5QmFja3VwU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF93b3JraW5nQ29weUJhY2t1cFNlcnZpY2U6IElXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElQcmVmZXJlbmNlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcHJlZmVyZW5jZXNTZXJ2aWNlOiBJUHJlZmVyZW5jZXNTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKE5vdGVib29rRWRpdG9yLklELCBncm91cCwgdGVsZW1ldHJ5U2VydmljZSwgdGhlbWVTZXJ2aWNlLCBzdG9yYWdlU2VydmljZSk7XG5cdFx0dGhpcy5fZWRpdG9yTWVtZW50byA9IHRoaXMuZ2V0RWRpdG9yTWVtZW50bzxJTm90ZWJvb2tFZGl0b3JWaWV3U3RhdGU+KF9lZGl0b3JHcm91cFNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBOT1RFQk9PS19FRElUT1JfVklFV19TVEFURV9QUkVGRVJFTkNFX0tFWSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9maWxlU2VydmljZS5vbkRpZENoYW5nZUZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcyhlID0+IHRoaXMuX29uRGlkQ2hhbmdlRmlsZVN5c3RlbVByb3ZpZGVyKGUuc2NoZW1lKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2ZpbGVTZXJ2aWNlLm9uRGlkQ2hhbmdlRmlsZVN5c3RlbVByb3ZpZGVyUmVnaXN0cmF0aW9ucyhlID0+IHRoaXMuX29uRGlkQ2hhbmdlRmlsZVN5c3RlbVByb3ZpZGVyKGUuc2NoZW1lKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VGaWxlU3lzdGVtUHJvdmlkZXIoc2NoZW1lOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5pbnB1dCBpbnN0YW5jZW9mIE5vdGVib29rRWRpdG9ySW5wdXQgJiYgdGhpcy5pbnB1dC5yZXNvdXJjZT8uc2NoZW1lID09PSBzY2hlbWUpIHtcblx0XHRcdHRoaXMuX3VwZGF0ZVJlYWRvbmx5KHRoaXMuaW5wdXQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlSW5wdXRDYXBhYmlsaXRpZXMoaW5wdXQ6IE5vdGVib29rRWRpdG9ySW5wdXQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5pbnB1dCA9PT0gaW5wdXQpIHtcblx0XHRcdHRoaXMuX3VwZGF0ZVJlYWRvbmx5KGlucHV0KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVSZWFkb25seShpbnB1dDogTm90ZWJvb2tFZGl0b3JJbnB1dCk6IHZvaWQge1xuXHRcdHRoaXMuX3dpZGdldC52YWx1ZT8uc2V0T3B0aW9ucyh7IGlzUmVhZE9ubHk6ICEhaW5wdXQuaXNSZWFkb25seSgpIH0pO1xuXHR9XG5cblx0Z2V0IHRleHRNb2RlbCgpOiBOb3RlYm9va1RleHRNb2RlbCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpZGdldC52YWx1ZT8udGV4dE1vZGVsO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0IG1pbmltdW1XaWR0aCgpOiBudW1iZXIgeyByZXR1cm4gMjIwOyB9XG5cdG92ZXJyaWRlIGdldCBtYXhpbXVtV2lkdGgoKTogbnVtYmVyIHsgcmV0dXJuIE51bWJlci5QT1NJVElWRV9JTkZJTklUWTsgfVxuXG5cdC8vIHRoZXNlIHNldHRlcnMgbmVlZCB0byBleGlzdCBiZWNhdXNlIHRoaXMgZXh0ZW5kcyBmcm9tIEVkaXRvclBhbmVcblx0b3ZlcnJpZGUgc2V0IG1pbmltdW1XaWR0aCh2YWx1ZTogbnVtYmVyKSB7IC8qbm9vcCovIH1cblx0b3ZlcnJpZGUgc2V0IG1heGltdW1XaWR0aCh2YWx1ZTogbnVtYmVyKSB7IC8qbm9vcCovIH1cblxuXHQvLyNyZWdpb24gRWRpdG9yIENvcmVcblx0b3ZlcnJpZGUgZ2V0IHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKCk6IElDb250ZXh0S2V5U2VydmljZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpZGdldC52YWx1ZT8uc2NvcGVkQ29udGV4dEtleVNlcnZpY2U7XG5cdH1cblxuXHRwcm90ZWN0ZWQgY3JlYXRlRWRpdG9yKHBhcmVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHR0aGlzLl9yb290RWxlbWVudCA9IERPTS5hcHBlbmQocGFyZW50LCBET00uJCgnLm5vdGVib29rLWVkaXRvcicpKTtcblx0XHR0aGlzLl9yb290RWxlbWVudC5pZCA9IGBub3RlYm9vay1lZGl0b3ItZWxlbWVudC0ke2dlbmVyYXRlVXVpZCgpfWA7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRBY3Rpb25WaWV3SXRlbShhY3Rpb246IElBY3Rpb24sIG9wdGlvbnM6IElBY3Rpb25WaWV3SXRlbU9wdGlvbnMpOiBJQWN0aW9uVmlld0l0ZW0gfCB1bmRlZmluZWQge1xuXHRcdGlmIChhY3Rpb24uaWQgPT09IFNFTEVDVF9LRVJORUxfSUQpIHtcblx0XHRcdC8vIHRoaXMgaXMgYmVpbmcgZGlzcG9zZWQgYnkgdGhlIGNvbnN1bWVyXG5cdFx0XHRyZXR1cm4gdGhpcy5fcmVnaXN0ZXIodGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90ZWJvb0tlcm5lbEFjdGlvblZpZXdJdGVtLCBhY3Rpb24sIHRoaXMsIG9wdGlvbnMpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdG92ZXJyaWRlIGdldENvbnRyb2woKTogTm90ZWJvb2tFZGl0b3JXaWRnZXQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl93aWRnZXQudmFsdWU7XG5cdH1cblxuXHRvdmVycmlkZSBzZXRWaXNpYmxlKHZpc2libGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRzdXBlci5zZXRWaXNpYmxlKHZpc2libGUpO1xuXHRcdGlmICghdmlzaWJsZSkge1xuXHRcdFx0dGhpcy5fd2lkZ2V0LnZhbHVlPy5vbldpbGxIaWRlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHNldEVkaXRvclZpc2libGUodmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdHN1cGVyLnNldEVkaXRvclZpc2libGUodmlzaWJsZSk7XG5cdFx0dGhpcy5fZ3JvdXBMaXN0ZW5lci5jbGVhcigpO1xuXHRcdHRoaXMuX2dyb3VwTGlzdGVuZXIuYWRkKHRoaXMuZ3JvdXAub25XaWxsQ2xvc2VFZGl0b3IoZSA9PiB0aGlzLl9zYXZlRWRpdG9yVmlld1N0YXRlKGUuZWRpdG9yKSkpO1xuXHRcdHRoaXMuX2dyb3VwTGlzdGVuZXIuYWRkKHRoaXMuZ3JvdXAub25EaWRNb2RlbENoYW5nZSgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fZWRpdG9yR3JvdXBTZXJ2aWNlLmFjdGl2ZUdyb3VwICE9PSB0aGlzLmdyb3VwKSB7XG5cdFx0XHRcdHRoaXMuX3dpZGdldD8udmFsdWU/LnVwZGF0ZUVkaXRvckZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0aWYgKCF2aXNpYmxlKSB7XG5cdFx0XHR0aGlzLl9zYXZlRWRpdG9yVmlld1N0YXRlKHRoaXMuaW5wdXQpO1xuXHRcdFx0aWYgKHRoaXMuaW5wdXQgJiYgdGhpcy5fd2lkZ2V0LnZhbHVlKSB7XG5cdFx0XHRcdC8vIHRoZSB3aWRnZXQgaXMgbm90IHRyYW5zZmVyZWQgdG8gb3RoZXIgZWRpdG9yIGlucHV0c1xuXHRcdFx0XHR0aGlzLl93aWRnZXQudmFsdWUub25XaWxsSGlkZSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGZvY3VzKCkge1xuXHRcdHN1cGVyLmZvY3VzKCk7XG5cdFx0dGhpcy5fd2lkZ2V0LnZhbHVlPy5mb2N1cygpO1xuXHR9XG5cblx0b3ZlcnJpZGUgaGFzRm9jdXMoKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgdmFsdWUgPSB0aGlzLl93aWRnZXQudmFsdWU7XG5cdFx0aWYgKCF2YWx1ZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiAhIXZhbHVlICYmIChET00uaXNBbmNlc3Rvck9mQWN0aXZlRWxlbWVudCh2YWx1ZS5nZXREb21Ob2RlKCkgfHwgRE9NLmlzQW5jZXN0b3JPZkFjdGl2ZUVsZW1lbnQodmFsdWUuZ2V0T3ZlcmZsb3dDb250YWluZXJEb21Ob2RlKCkpKSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBzZXRJbnB1dChpbnB1dDogTm90ZWJvb2tFZGl0b3JJbnB1dCwgb3B0aW9uczogSU5vdGVib29rRWRpdG9yT3B0aW9ucyB8IHVuZGVmaW5lZCwgY29udGV4dDogSUVkaXRvck9wZW5Db250ZXh0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIG5vUmV0cnk/OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGxldCBwZXJmTWFya3NDYXB0dXJlZCA9IGZhbHNlO1xuXHRcdFx0Y29uc3QgZmlsZU9wZW5Nb25pdG9yID0gdGltZW91dCgxMDAwMCk7XG5cdFx0XHRmaWxlT3Blbk1vbml0b3IudGhlbigoKSA9PiB7XG5cdFx0XHRcdHBlcmZNYXJrc0NhcHR1cmVkID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5faGFuZGxlUGVyZk1hcmsocGVyZiwgaW5wdXQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IHBlcmYgPSBuZXcgTm90ZWJvb2tQZXJmTWFya3MoKTtcblx0XHRcdHBlcmYubWFyaygnc3RhcnRUaW1lJyk7XG5cblx0XHRcdHRoaXMuX2lucHV0TGlzdGVuZXIudmFsdWUgPSBpbnB1dC5vbkRpZENoYW5nZUNhcGFiaWxpdGllcygoKSA9PiB0aGlzLl9vbkRpZENoYW5nZUlucHV0Q2FwYWJpbGl0aWVzKGlucHV0KSk7XG5cblx0XHRcdHRoaXMuX3dpZGdldERpc3Bvc2FibGVTdG9yZS5jbGVhcigpO1xuXG5cdFx0XHQvLyB0aGVyZSBjdXJyZW50bHkgaXMgYSB3aWRnZXQgd2hpY2ggd2Ugc3RpbGwgb3duIHNvXG5cdFx0XHQvLyB3ZSBuZWVkIHRvIGhpZGUgaXQgYmVmb3JlIGdldHRpbmcgYSBuZXcgd2lkZ2V0XG5cdFx0XHR0aGlzLl93aWRnZXQudmFsdWU/Lm9uV2lsbEhpZGUoKTtcblxuXHRcdFx0dGhpcy5fd2lkZ2V0ID0gPElCb3Jyb3dWYWx1ZTxOb3RlYm9va0VkaXRvcldpZGdldD4+dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24odGhpcy5fbm90ZWJvb2tXaWRnZXRTZXJ2aWNlLnJldHJpZXZlV2lkZ2V0LCB0aGlzLmdyb3VwLmlkLCBpbnB1dCwgdW5kZWZpbmVkLCB0aGlzLl9wYWdlUG9zaXRpb24/LmRpbWVuc2lvbiwgdGhpcy53aW5kb3cpO1xuXG5cdFx0XHRpZiAodGhpcy5fcm9vdEVsZW1lbnQgJiYgdGhpcy5fd2lkZ2V0LnZhbHVlIS5nZXREb21Ob2RlKCkpIHtcblx0XHRcdFx0dGhpcy5fcm9vdEVsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLWZsb3d0bycsIHRoaXMuX3dpZGdldC52YWx1ZSEuZ2V0RG9tTm9kZSgpLmlkIHx8ICcnKTtcblx0XHRcdFx0RE9NLnNldFBhcmVudEZsb3dUbyh0aGlzLl93aWRnZXQudmFsdWUhLmdldERvbU5vZGUoKSwgdGhpcy5fcm9vdEVsZW1lbnQpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl93aWRnZXREaXNwb3NhYmxlU3RvcmUuYWRkKHRoaXMuX3dpZGdldC52YWx1ZSEub25EaWRDaGFuZ2VNb2RlbCgoKSA9PiB0aGlzLl9vbkRpZENoYW5nZU1vZGVsLmZpcmUoKSkpO1xuXHRcdFx0dGhpcy5fd2lkZ2V0RGlzcG9zYWJsZVN0b3JlLmFkZCh0aGlzLl93aWRnZXQudmFsdWUhLm9uRGlkQ2hhbmdlQWN0aXZlQ2VsbCgoKSA9PiB0aGlzLl9vbkRpZENoYW5nZVNlbGVjdGlvbi5maXJlKHsgcmVhc29uOiBFZGl0b3JQYW5lU2VsZWN0aW9uQ2hhbmdlUmVhc29uLlVTRVIgfSkpKTtcblxuXHRcdFx0aWYgKHRoaXMuX3BhZ2VQb3NpdGlvbikge1xuXHRcdFx0XHR0aGlzLl93aWRnZXQudmFsdWUhLmxheW91dCh0aGlzLl9wYWdlUG9zaXRpb24uZGltZW5zaW9uLCB0aGlzLl9yb290RWxlbWVudCwgdGhpcy5fcGFnZVBvc2l0aW9uLnBvc2l0aW9uKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gb25seSBub3cgYHNldElucHV0YCBhbmQgeWllbGQvYXdhaXQuIHRoaXMgaXMgQUZURVIgdGhlIGFjdHVhbCB3aWRnZXQgaXMgcmVhZHkuIFRoaXMgaXMgdmVyeSBpbXBvcnRhbnRcblx0XHRcdC8vIHNvIHRoYXQgb3RoZXJzIHN5bmNocm9ub3VzbHkgcmVjZWl2ZSBhIG5vdGVib29rIGVkaXRvciB3aXRoIHRoZSBjb3JyZWN0IHdpZGdldCBiZWluZyBzZXRcblx0XHRcdGF3YWl0IHN1cGVyLnNldElucHV0KGlucHV0LCBvcHRpb25zLCBjb250ZXh0LCB0b2tlbik7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGF3YWl0IGlucHV0LnJlc29sdmUob3B0aW9ucywgcGVyZik7XG5cdFx0XHRwZXJmLm1hcmsoJ2lucHV0TG9hZGVkJyk7XG5cblx0XHRcdC8vIENoZWNrIGZvciBjYW5jZWxsYXRpb25cblx0XHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBUaGUgd2lkZ2V0IGhhcyBiZWVuIHRha2VuIGF3YXkgYWdhaW4uIFRoaXMgY2FuIGhhcHBlbiB3aGVuIHRoZSB0YWIgaGFzIGJlZW4gY2xvc2VkIHdoaWxlXG5cdFx0XHQvLyBsb2FkaW5nIHdhcyBpbiBwcm9ncmVzcywgaW4gcGFydGljdWxhciB3aGVuIG9wZW4gdGhlIHNhbWUgcmVzb3VyY2UgYXMgZGlmZmVyZW50IHZpZXcgdHlwZS5cblx0XHRcdC8vIFdoZW4gdGhpcyBoYXBwZW4sIHJldHJ5IG9uY2Vcblx0XHRcdGlmICghdGhpcy5fd2lkZ2V0LnZhbHVlKSB7XG5cdFx0XHRcdGlmIChub1JldHJ5KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5zZXRJbnB1dChpbnB1dCwgb3B0aW9ucywgY29udGV4dCwgdG9rZW4sIHRydWUpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAobW9kZWwgPT09IG51bGwpIHtcblx0XHRcdFx0Y29uc3Qga25vd25Qcm92aWRlciA9IHRoaXMuX25vdGVib29rU2VydmljZS5nZXRWaWV3VHlwZVByb3ZpZGVyKGlucHV0LnZpZXdUeXBlKTtcblxuXHRcdFx0XHRpZiAoIWtub3duUHJvdmlkZXIpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ2ZhaWwubm9FZGl0b3InLCBcIkNhbm5vdCBvcGVuIHJlc291cmNlIHdpdGggbm90ZWJvb2sgZWRpdG9yIHR5cGUgJ3swfScsIHBsZWFzZSBjaGVjayBpZiB5b3UgaGF2ZSB0aGUgcmlnaHQgZXh0ZW5zaW9uIGluc3RhbGxlZCBhbmQgZW5hYmxlZC5cIiwgaW5wdXQudmlld1R5cGUpKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGF3YWl0IHRoaXMuX2V4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLndoZW5Jbml0aWFsaXplZDtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uSW5mbyA9IHRoaXMuX2V4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmxvY2FsLmZpbmQoZSA9PiBlLmlkZW50aWZpZXIuaWQgPT09IGtub3duUHJvdmlkZXIpO1xuXG5cdFx0XHRcdHRocm93IGNyZWF0ZUVkaXRvck9wZW5FcnJvcihuZXcgRXJyb3IobG9jYWxpemUoJ2ZhaWwubm9FZGl0b3IuZXh0ZW5zaW9uTWlzc2luZycsIFwiQ2Fubm90IG9wZW4gcmVzb3VyY2Ugd2l0aCBub3RlYm9vayBlZGl0b3IgdHlwZSAnezB9JywgcGxlYXNlIGNoZWNrIGlmIHlvdSBoYXZlIHRoZSByaWdodCBleHRlbnNpb24gaW5zdGFsbGVkIGFuZCBlbmFibGVkLlwiLCBpbnB1dC52aWV3VHlwZSkpLCBbXG5cdFx0XHRcdFx0dG9BY3Rpb24oe1xuXHRcdFx0XHRcdFx0aWQ6ICd3b3JrYmVuY2gubm90ZWJvb2suYWN0aW9uLmluc3RhbGxPckVuYWJsZU1pc3NpbmcnLCBsYWJlbDpcblx0XHRcdFx0XHRcdFx0ZXh0ZW5zaW9uSW5mb1xuXHRcdFx0XHRcdFx0XHRcdD8gbG9jYWxpemUoJ25vdGVib29rT3BlbkVuYWJsZU1pc3NpbmdWaWV3VHlwZScsIFwiRW5hYmxlIGV4dGVuc2lvbiBmb3IgJ3swfSdcIiwgaW5wdXQudmlld1R5cGUpXG5cdFx0XHRcdFx0XHRcdFx0OiBsb2NhbGl6ZSgnbm90ZWJvb2tPcGVuSW5zdGFsbE1pc3NpbmdWaWV3VHlwZScsIFwiSW5zdGFsbCBleHRlbnNpb24gZm9yICd7MH0nXCIsIGlucHV0LnZpZXdUeXBlKVxuXHRcdFx0XHRcdFx0LCBydW46IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgZCA9IHRoaXMuX25vdGVib29rU2VydmljZS5vbkFkZFZpZXdUeXBlKHZpZXdUeXBlID0+IHtcblx0XHRcdFx0XHRcdFx0XHRpZiAodmlld1R5cGUgPT09IGlucHV0LnZpZXdUeXBlKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQvLyBzZXJpYWxpemVyIGlzIHJlZ2lzdGVyZWQsIHRyeSB0byBvcGVuIGFnYWluXG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLl9lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoeyByZXNvdXJjZTogaW5wdXQucmVzb3VyY2UgfSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRkLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHRjb25zdCBleHRlbnNpb25JbmZvID0gdGhpcy5fZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UubG9jYWwuZmluZChlID0+IGUuaWRlbnRpZmllci5pZCA9PT0ga25vd25Qcm92aWRlcik7XG5cblx0XHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0XHRpZiAoZXh0ZW5zaW9uSW5mbykge1xuXHRcdFx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5fZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uuc2V0RW5hYmxlbWVudChleHRlbnNpb25JbmZvLCBleHRlbnNpb25JbmZvLmVuYWJsZW1lbnRTdGF0ZSA9PT0gRW5hYmxlbWVudFN0YXRlLkRpc2FibGVkV29ya3NwYWNlID8gRW5hYmxlbWVudFN0YXRlLkVuYWJsZWRXb3Jrc3BhY2UgOiBFbmFibGVtZW50U3RhdGUuRW5hYmxlZEdsb2JhbGx5KTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW5zdGFsbFJlY29tbWVuZGVkRXh0ZW5zaW9uQWN0aW9uLCBrbm93blByb3ZpZGVyKS5ydW4oKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0gY2F0Y2ggKGV4KSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBGYWlsZWQgdG8gaW5zdGFsbCBvciBlbmFibGUgZXh0ZW5zaW9uICR7a25vd25Qcm92aWRlcn1gLCBleCk7XG5cdFx0XHRcdFx0XHRcdFx0ZC5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KSxcblx0XHRcdFx0XHR0b0FjdGlvbih7XG5cdFx0XHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5ub3RlYm9vay5hY3Rpb24ub3BlbkFzVGV4dCcsIGxhYmVsOiBsb2NhbGl6ZSgnbm90ZWJvb2tPcGVuQXNUZXh0JywgXCJPcGVuIEFzIFRleHRcIiksIHJ1bjogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBiYWNrdXAgPSBhd2FpdCB0aGlzLl93b3JraW5nQ29weUJhY2t1cFNlcnZpY2UucmVzb2x2ZSh7IHJlc291cmNlOiBpbnB1dC5yZXNvdXJjZSwgdHlwZUlkOiBOb3RlYm9va1dvcmtpbmdDb3B5VHlwZUlkZW50aWZpZXIuY3JlYXRlKGlucHV0LnZpZXdUeXBlKSB9KTtcblx0XHRcdFx0XHRcdFx0aWYgKGJhY2t1cCkge1xuXHRcdFx0XHRcdFx0XHRcdC8vIHdpdGggYSBiYWNrdXAgcHJlc2VudCwgd2UgbXVzdCByZXNvcnQgdG8gb3BlbmluZyB0aGUgYmFja3VwIGNvbnRlbnRzXG5cdFx0XHRcdFx0XHRcdFx0Ly8gYXMgdW50aXRsZWQgdGV4dCBmaWxlIHRvIG5vdCBzaG93IHRoZSB3cm9uZyBkYXRhIHRvIHRoZSB1c2VyXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgY29udGVudHMgPSBhd2FpdCBzdHJlYW1Ub0J1ZmZlcihiYWNrdXAudmFsdWUpO1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMuX2VkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7IHJlc291cmNlOiB1bmRlZmluZWQsIGNvbnRlbnRzOiBjb250ZW50cy50b1N0cmluZygpIH0pO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdC8vIHdpdGhvdXQgYSBiYWNrdXAgcHJlc2VudCwgd2UgY2FuIG9wZW4gdGhlIG9yaWdpbmFsIHJlc291cmNlXG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5fZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHsgcmVzb3VyY2U6IGlucHV0LnJlc291cmNlLCBvcHRpb25zOiB7IG92ZXJyaWRlOiBERUZBVUxUX0VESVRPUl9BU1NPQ0lBVElPTi5pZCwgcGlubmVkOiB0cnVlIH0gfSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KVxuXHRcdFx0XHRdLCB7IGFsbG93RGlhbG9nOiB0cnVlIH0pO1xuXG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX3dpZGdldERpc3Bvc2FibGVTdG9yZS5hZGQobW9kZWwubm90ZWJvb2sub25EaWRDaGFuZ2VDb250ZW50KCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlU2VsZWN0aW9uLmZpcmUoeyByZWFzb246IEVkaXRvclBhbmVTZWxlY3Rpb25DaGFuZ2VSZWFzb24uRURJVCB9KSkpO1xuXG5cdFx0XHRjb25zdCB2aWV3U3RhdGUgPSBvcHRpb25zPy52aWV3U3RhdGUgPz8gdGhpcy5fbG9hZE5vdGVib29rRWRpdG9yVmlld1N0YXRlKGlucHV0KTtcblxuXHRcdFx0Ly8gV2UgbWlnaHQgYmUgbW92aW5nIHRoZSBub3RlYm9vayB3aWRnZXQgYmV0d2VlbiBncm91cHMsIGFuZCB0aGVzZSBzZXJ2aWNlcyBhcmUgdGllZCB0byB0aGUgZ3JvdXBcblx0XHRcdHRoaXMuX3dpZGdldC52YWx1ZS5zZXRQYXJlbnRDb250ZXh0S2V5U2VydmljZSh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0XHR0aGlzLl93aWRnZXQudmFsdWUuc2V0RWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlKHRoaXMuX2VkaXRvclByb2dyZXNzU2VydmljZSk7XG5cblx0XHRcdGF3YWl0IHRoaXMuX3dpZGdldC52YWx1ZS5zZXRNb2RlbChtb2RlbC5ub3RlYm9vaywgdmlld1N0YXRlLCBwZXJmKTtcblx0XHRcdGNvbnN0IGlzUmVhZE9ubHkgPSAhIWlucHV0LmlzUmVhZG9ubHkoKTtcblx0XHRcdGF3YWl0IHRoaXMuX3dpZGdldC52YWx1ZS5zZXRPcHRpb25zKHsgLi4ub3B0aW9ucywgaXNSZWFkT25seSB9KTtcblx0XHRcdHRoaXMuX3dpZGdldERpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy5fd2lkZ2V0LnZhbHVlLm9uRGlkRm9jdXNXaWRnZXQoKCkgPT4gdGhpcy5fb25EaWRGb2N1c1dpZGdldC5maXJlKCkpKTtcblx0XHRcdHRoaXMuX3dpZGdldERpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy5fd2lkZ2V0LnZhbHVlLm9uRGlkQmx1cldpZGdldCgoKSA9PiB0aGlzLl9vbkRpZEJsdXJXaWRnZXQuZmlyZSgpKSk7XG5cblx0XHRcdHRoaXMuX3dpZGdldERpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy5fZWRpdG9yR3JvdXBTZXJ2aWNlLmNyZWF0ZUVkaXRvckRyb3BUYXJnZXQodGhpcy5fd2lkZ2V0LnZhbHVlLmdldERvbU5vZGUoKSwge1xuXHRcdFx0XHRjb250YWluc0dyb3VwOiAoZ3JvdXApID0+IHRoaXMuZ3JvdXAuaWQgPT09IGdyb3VwLmlkXG5cdFx0XHR9KSk7XG5cblx0XHRcdHRoaXMuX3dpZGdldERpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy5fd2lkZ2V0LnZhbHVlLm9uRGlkU2Nyb2xsKCgpID0+IHsgdGhpcy5fb25EaWRDaGFuZ2VTY3JvbGwuZmlyZSgpOyB9KSk7XG5cblx0XHRcdHBlcmYubWFyaygnZWRpdG9yTG9hZGVkJyk7XG5cblx0XHRcdGZpbGVPcGVuTW9uaXRvci5jYW5jZWwoKTtcblx0XHRcdGlmIChwZXJmTWFya3NDYXB0dXJlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2hhbmRsZVBlcmZNYXJrKHBlcmYsIGlucHV0LCBtb2RlbC5ub3RlYm9vayk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbnRyb2wuZmlyZSgpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKCdOb3RlYm9va0VkaXRvcldpZGdldCNzZXRJbnB1dCBmYWlsZWQnLCBlKTtcblx0XHRcdGlmIChpc0VkaXRvck9wZW5FcnJvcihlKSkge1xuXHRcdFx0XHR0aHJvdyBlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBIYW5kbGUgY2FzZSB3aGVyZSBhIGZpbGUgaXMgdG9vIGxhcmdlIHRvIG9wZW4gd2l0aG91dCBjb25maXJtYXRpb25cblx0XHRcdGlmICgoPEZpbGVPcGVyYXRpb25FcnJvcj5lKS5maWxlT3BlcmF0aW9uUmVzdWx0ID09PSBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfVE9PX0xBUkdFKSB7XG5cdFx0XHRcdGxldCBtZXNzYWdlOiBzdHJpbmc7XG5cdFx0XHRcdGlmIChlIGluc3RhbmNlb2YgVG9vTGFyZ2VGaWxlT3BlcmF0aW9uRXJyb3IpIHtcblx0XHRcdFx0XHRtZXNzYWdlID0gbG9jYWxpemUoJ25vdGVib29rVG9vTGFyZ2VGb3JIZWFwRXJyb3JXaXRoU2l6ZScsIFwiVGhlIG5vdGVib29rIGlzIG5vdCBkaXNwbGF5ZWQgaW4gdGhlIG5vdGVib29rIGVkaXRvciBiZWNhdXNlIGl0IGlzIHZlcnkgbGFyZ2UgKHswfSkuXCIsIEJ5dGVTaXplLmZvcm1hdFNpemUoZS5zaXplKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bWVzc2FnZSA9IGxvY2FsaXplKCdub3RlYm9va1Rvb0xhcmdlRm9ySGVhcEVycm9yV2l0aG91dFNpemUnLCBcIlRoZSBub3RlYm9vayBpcyBub3QgZGlzcGxheWVkIGluIHRoZSBub3RlYm9vayBlZGl0b3IgYmVjYXVzZSBpdCBpcyB2ZXJ5IGxhcmdlLlwiKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRocm93IGNyZWF0ZVRvb0xhcmdlRmlsZUVycm9yKHRoaXMuZ3JvdXAsIGlucHV0LCBvcHRpb25zLCBtZXNzYWdlLCB0aGlzLl9wcmVmZXJlbmNlc1NlcnZpY2UpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBlcnJvciA9IGNyZWF0ZUVkaXRvck9wZW5FcnJvcihlIGluc3RhbmNlb2YgRXJyb3IgPyBlIDogbmV3IEVycm9yKChlID8gZS5tZXNzYWdlIDogJycpKSwgW1xuXHRcdFx0XHR0b0FjdGlvbih7XG5cdFx0XHRcdFx0aWQ6ICd3b3JrYmVuY2gubm90ZWJvb2suYWN0aW9uLm9wZW5JblRleHRFZGl0b3InLCBsYWJlbDogbG9jYWxpemUoJ25vdGVib29rT3BlbkluVGV4dEVkaXRvcicsIFwiT3BlbiBpbiBUZXh0IEVkaXRvclwiKSwgcnVuOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBhY3RpdmVFZGl0b3JQYW5lID0gdGhpcy5fZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdFx0XHRcdFx0aWYgKCFhY3RpdmVFZGl0b3JQYW5lKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Y29uc3QgYWN0aXZlRWRpdG9yUmVzb3VyY2UgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldENhbm9uaWNhbFVyaShhY3RpdmVFZGl0b3JQYW5lLmlucHV0KTtcblx0XHRcdFx0XHRcdGlmICghYWN0aXZlRWRpdG9yUmVzb3VyY2UpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRpZiAoYWN0aXZlRWRpdG9yUmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gaW5wdXQucmVzb3VyY2U/LnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0XHRcdFx0Ly8gUmVwbGFjZSB0aGUgY3VycmVudCBlZGl0b3Igd2l0aCB0aGUgdGV4dCBlZGl0b3Jcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuX2VkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRcdFx0XHRcdFx0cmVzb3VyY2U6IGFjdGl2ZUVkaXRvclJlc291cmNlLFxuXHRcdFx0XHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdFx0XHRcdG92ZXJyaWRlOiBERUZBVUxUX0VESVRPUl9BU1NPQ0lBVElPTi5pZCxcblx0XHRcdFx0XHRcdFx0XHRcdHBpbm5lZDogdHJ1ZSAvLyBuZXcgZmlsZSBnZXRzIHBpbm5lZCBieSBkZWZhdWx0XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSlcblx0XHRcdF0sIHsgYWxsb3dEaWFsb2c6IHRydWUgfSk7XG5cblx0XHRcdHRocm93IGVycm9yO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2hhbmRsZVBlcmZNYXJrKHBlcmY6IE5vdGVib29rUGVyZk1hcmtzLCBpbnB1dDogTm90ZWJvb2tFZGl0b3JJbnB1dCwgbm90ZWJvb2s/OiBOb3RlYm9va1RleHRNb2RlbCkge1xuXHRcdGNvbnN0IHBlcmZNYXJrcyA9IHBlcmYudmFsdWU7XG5cblx0XHR0eXBlIFdvcmtiZW5jaE5vdGVib29rT3BlbkNsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0b3duZXI6ICdyZWJvcm5peCc7XG5cdFx0XHRjb21tZW50OiAnVGhlIG5vdGVib29rIGZpbGUgb3BlbiBtZXRyaWNzLiBVc2VkIHRvIGdldCBhIGJldHRlciB1bmRlcnN0YW5kaW5nIG9mIHRoZSBwZXJmb3JtYW5jZSBvZiBub3RlYm9vayBmaWxlIG9wZW5pbmcnO1xuXHRcdFx0c2NoZW1lOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnRmlsZSBzeXN0ZW0gcHJvdmlkZXIgc2NoZW1lIGZvciB0aGUgbm90ZWJvb2sgcmVzb3VyY2UnIH07XG5cdFx0XHRleHQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdGaWxlIGV4dGVuc2lvbiBmb3IgdGhlIG5vdGVib29rIHJlc291cmNlJyB9O1xuXHRcdFx0dmlld1R5cGU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgdmlldyB0eXBlIG9mIHRoZSBub3RlYm9vayBlZGl0b3InIH07XG5cdFx0XHRleHRlbnNpb25BY3RpdmF0ZWQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdFeHRlbnNpb24gYWN0aXZhdGlvbiB0aW1lIGZvciB0aGUgcmVzb3VyY2Ugb3BlbmluZycgfTtcblx0XHRcdGlucHV0TG9hZGVkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnRWRpdG9yIElucHV0IGxvYWRpbmcgdGltZSBmb3IgdGhlIHJlc291cmNlIG9wZW5pbmcnIH07XG5cdFx0XHR3ZWJ2aWV3Q29tbUxvYWRlZDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1dlYnZpZXcgaW5pdGlhbGl6YXRpb24gdGltZSBmb3IgdGhlIHJlc291cmNlIG9wZW5pbmcnIH07XG5cdFx0XHRjdXN0b21NYXJrZG93bkxvYWRlZDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ0N1c3RvbSBtYXJrZG93biBsb2FkaW5nIHRpbWUgZm9yIHRoZSByZXNvdXJjZSBvcGVuaW5nJyB9O1xuXHRcdFx0ZWRpdG9yTG9hZGVkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnT3ZlcmFsbCBlZGl0b3IgbG9hZGluZyB0aW1lIGZvciB0aGUgcmVzb3VyY2Ugb3BlbmluZycgfTtcblx0XHRcdGNvZGVDZWxsQ291bnQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUb3RhbCBudW1iZXIgb2YgY29kZSBjZWxsJyB9O1xuXHRcdFx0bWRDZWxsQ291bnQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUb3RhbCBudW1iZXIgb2YgbWFya2Rvd24gY2VsbCcgfTtcblx0XHRcdG91dHB1dENvdW50OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVG90YWwgbnVtYmVyIG9mIGNlbGwgb3V0cHV0cycgfTtcblx0XHRcdG91dHB1dEJ5dGVzOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVG90YWwgbnVtYmVyIG9mIGJ5dGVzIGZvciBhbGwgb3V0cHV0cycgfTtcblx0XHRcdGNvZGVMZW5ndGg6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdMZW5ndGggb2YgdGV4dCBpbiBhbGwgY29kZSBjZWxscycgfTtcblx0XHRcdG1hcmtkb3duTGVuZ3RoOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnTGVuZ3RoIG9mIHRleHQgaW4gYWxsIG1hcmtkb3duIGNlbGxzJyB9O1xuXHRcdFx0bm90ZWJvb2tTdGF0c0xvYWRlZDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RpbWUgZm9yIGdlbmVyYXRpbmcgdGhlIG5vdGVib29rIGxldmVsIGluZm9ybWF0aW9uIGZvciB0ZWxlbWV0cnknIH07XG5cdFx0fTtcblxuXHRcdHR5cGUgV29ya2JlbmNoTm90ZWJvb2tPcGVuRXZlbnQgPSB7XG5cdFx0XHRzY2hlbWU6IHN0cmluZztcblx0XHRcdGV4dDogc3RyaW5nO1xuXHRcdFx0dmlld1R5cGU6IHN0cmluZztcblx0XHRcdGV4dGVuc2lvbkFjdGl2YXRlZDogbnVtYmVyO1xuXHRcdFx0aW5wdXRMb2FkZWQ6IG51bWJlcjtcblx0XHRcdHdlYnZpZXdDb21tTG9hZGVkOiBudW1iZXI7XG5cdFx0XHRjdXN0b21NYXJrZG93bkxvYWRlZDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRcdFx0ZWRpdG9yTG9hZGVkOiBudW1iZXI7XG5cdFx0XHRjb2RlQ2VsbENvdW50OiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdFx0XHRtZENlbGxDb3VudDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRcdFx0b3V0cHV0Q291bnQ6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0XHRcdG91dHB1dEJ5dGVzOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdFx0XHRjb2RlTGVuZ3RoOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdFx0XHRtYXJrZG93bkxlbmd0aDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRcdFx0bm90ZWJvb2tTdGF0c0xvYWRlZDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRcdH07XG5cblx0XHRjb25zdCBzdGFydFRpbWUgPSBwZXJmTWFya3NbJ3N0YXJ0VGltZSddO1xuXHRcdGNvbnN0IGV4dGVuc2lvbkFjdGl2YXRlZCA9IHBlcmZNYXJrc1snZXh0ZW5zaW9uQWN0aXZhdGVkJ107XG5cdFx0Y29uc3QgaW5wdXRMb2FkZWQgPSBwZXJmTWFya3NbJ2lucHV0TG9hZGVkJ107XG5cdFx0Y29uc3Qgd2Vidmlld0NvbW1Mb2FkZWQgPSBwZXJmTWFya3NbJ3dlYnZpZXdDb21tTG9hZGVkJ107XG5cdFx0Y29uc3QgY3VzdG9tTWFya2Rvd25Mb2FkZWQgPSBwZXJmTWFya3NbJ2N1c3RvbU1hcmtkb3duTG9hZGVkJ107XG5cdFx0Y29uc3QgZWRpdG9yTG9hZGVkID0gcGVyZk1hcmtzWydlZGl0b3JMb2FkZWQnXTtcblxuXHRcdGxldCBleHRlbnNpb25BY3RpdmF0aW9uVGltZXNwYW4gPSAtMTtcblx0XHRsZXQgaW5wdXRMb2FkaW5nVGltZXNwYW4gPSAtMTtcblx0XHRsZXQgd2Vidmlld0NvbW1Mb2FkaW5nVGltZXNwYW4gPSAtMTtcblx0XHRsZXQgY3VzdG9tTWFya2Rvd25Mb2FkaW5nVGltZXNwYW4gPSAtMTtcblx0XHRsZXQgZWRpdG9yTG9hZGluZ1RpbWVzcGFuID0gLTE7XG5cblx0XHRpZiAoc3RhcnRUaW1lICE9PSB1bmRlZmluZWQgJiYgZXh0ZW5zaW9uQWN0aXZhdGVkICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGV4dGVuc2lvbkFjdGl2YXRpb25UaW1lc3BhbiA9IGV4dGVuc2lvbkFjdGl2YXRlZCAtIHN0YXJ0VGltZTtcblxuXHRcdFx0aWYgKGlucHV0TG9hZGVkICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0aW5wdXRMb2FkaW5nVGltZXNwYW4gPSBpbnB1dExvYWRlZCAtIGV4dGVuc2lvbkFjdGl2YXRlZDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHdlYnZpZXdDb21tTG9hZGVkICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0d2Vidmlld0NvbW1Mb2FkaW5nVGltZXNwYW4gPSB3ZWJ2aWV3Q29tbUxvYWRlZCAtIGV4dGVuc2lvbkFjdGl2YXRlZDtcblxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY3VzdG9tTWFya2Rvd25Mb2FkZWQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRjdXN0b21NYXJrZG93bkxvYWRpbmdUaW1lc3BhbiA9IGN1c3RvbU1hcmtkb3duTG9hZGVkIC0gc3RhcnRUaW1lO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZWRpdG9yTG9hZGVkICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0ZWRpdG9yTG9hZGluZ1RpbWVzcGFuID0gZWRpdG9yTG9hZGVkIC0gc3RhcnRUaW1lO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIE5vdGVib29rIGluZm9ybWF0aW9uXG5cdFx0bGV0IGNvZGVDZWxsQ291bnQ6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRsZXQgbWRDZWxsQ291bnQ6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRsZXQgb3V0cHV0Q291bnQ6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRsZXQgb3V0cHV0Qnl0ZXM6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRsZXQgY29kZUxlbmd0aDogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGxldCBtYXJrZG93bkxlbmd0aDogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGxldCBub3RlYm9va1N0YXRzTG9hZGVkOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKG5vdGVib29rKSB7XG5cdFx0XHRjb25zdCBzdG9wV2F0Y2ggPSBuZXcgU3RvcFdhdGNoKCk7XG5cdFx0XHRmb3IgKGNvbnN0IGNlbGwgb2Ygbm90ZWJvb2suY2VsbHMpIHtcblx0XHRcdFx0aWYgKGNlbGwuY2VsbEtpbmQgPT09IENlbGxLaW5kLkNvZGUpIHtcblx0XHRcdFx0XHRjb2RlQ2VsbENvdW50ID0gKGNvZGVDZWxsQ291bnQgfHwgMCkgKyAxO1xuXHRcdFx0XHRcdGNvZGVMZW5ndGggPSAoY29kZUxlbmd0aCB8fCAwKSArIGNlbGwuZ2V0VGV4dExlbmd0aCgpO1xuXHRcdFx0XHRcdG91dHB1dENvdW50ID0gKG91dHB1dENvdW50IHx8IDApICsgY2VsbC5vdXRwdXRzLmxlbmd0aDtcblx0XHRcdFx0XHRvdXRwdXRCeXRlcyA9IChvdXRwdXRCeXRlcyB8fCAwKSArIGNlbGwub3V0cHV0cy5yZWR1Y2UoKHByZXYsIGN1cikgPT4gcHJldiArIGN1ci5vdXRwdXRzLnJlZHVjZSgoc2l6ZSwgaXRlbSkgPT4gc2l6ZSArIGl0ZW0uZGF0YS5ieXRlTGVuZ3RoLCAwKSwgMCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bWRDZWxsQ291bnQgPSAobWRDZWxsQ291bnQgfHwgMCkgKyAxO1xuXHRcdFx0XHRcdG1hcmtkb3duTGVuZ3RoID0gKGNvZGVMZW5ndGggfHwgMCkgKyBjZWxsLmdldFRleHRMZW5ndGgoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0bm90ZWJvb2tTdGF0c0xvYWRlZCA9IHN0b3BXYXRjaC5lbGFwc2VkKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBbTm90ZWJvb2tFZGl0b3JdIG9wZW4gbm90ZWJvb2sgcGVyZiAke25vdGVib29rPy51cmkudG9TdHJpbmcoKSA/PyAnJ30gLSBleHRlbnNpb25BY3RpdmF0aW9uOiAke2V4dGVuc2lvbkFjdGl2YXRpb25UaW1lc3Bhbn0sIGlucHV0TG9hZDogJHtpbnB1dExvYWRpbmdUaW1lc3Bhbn0sIHdlYnZpZXdDb21tOiAke3dlYnZpZXdDb21tTG9hZGluZ1RpbWVzcGFufSwgY3VzdG9tTWFya2Rvd246ICR7Y3VzdG9tTWFya2Rvd25Mb2FkaW5nVGltZXNwYW59LCBlZGl0b3JMb2FkOiAke2VkaXRvckxvYWRpbmdUaW1lc3Bhbn1gKTtcblxuXHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFdvcmtiZW5jaE5vdGVib29rT3BlbkV2ZW50LCBXb3JrYmVuY2hOb3RlYm9va09wZW5DbGFzc2lmaWNhdGlvbj4oJ25vdGVib29rL2VkaXRvck9wZW5QZXJmJywge1xuXHRcdFx0c2NoZW1lOiBpbnB1dC5yZXNvdXJjZS5zY2hlbWUsXG5cdFx0XHRleHQ6IGV4dG5hbWUoaW5wdXQucmVzb3VyY2UpLFxuXHRcdFx0dmlld1R5cGU6IGlucHV0LnZpZXdUeXBlLFxuXHRcdFx0ZXh0ZW5zaW9uQWN0aXZhdGVkOiBleHRlbnNpb25BY3RpdmF0aW9uVGltZXNwYW4sXG5cdFx0XHRpbnB1dExvYWRlZDogaW5wdXRMb2FkaW5nVGltZXNwYW4sXG5cdFx0XHR3ZWJ2aWV3Q29tbUxvYWRlZDogd2Vidmlld0NvbW1Mb2FkaW5nVGltZXNwYW4sXG5cdFx0XHRjdXN0b21NYXJrZG93bkxvYWRlZDogY3VzdG9tTWFya2Rvd25Mb2FkaW5nVGltZXNwYW4sXG5cdFx0XHRlZGl0b3JMb2FkZWQ6IGVkaXRvckxvYWRpbmdUaW1lc3Bhbixcblx0XHRcdGNvZGVDZWxsQ291bnQsXG5cdFx0XHRtZENlbGxDb3VudCxcblx0XHRcdG91dHB1dENvdW50LFxuXHRcdFx0b3V0cHV0Qnl0ZXMsXG5cdFx0XHRjb2RlTGVuZ3RoLFxuXHRcdFx0bWFya2Rvd25MZW5ndGgsXG5cdFx0XHRub3RlYm9va1N0YXRzTG9hZGVkXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBjbGVhcklucHV0KCk6IHZvaWQge1xuXHRcdHRoaXMuX2lucHV0TGlzdGVuZXIuY2xlYXIoKTtcblxuXHRcdGlmICh0aGlzLl93aWRnZXQudmFsdWUpIHtcblx0XHRcdHRoaXMuX3NhdmVFZGl0b3JWaWV3U3RhdGUodGhpcy5pbnB1dCk7XG5cdFx0XHR0aGlzLl93aWRnZXQudmFsdWUub25XaWxsSGlkZSgpO1xuXHRcdH1cblx0XHRzdXBlci5jbGVhcklucHV0KCk7XG5cdH1cblxuXHRvdmVycmlkZSBzZXRPcHRpb25zKG9wdGlvbnM6IElOb3RlYm9va0VkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLl93aWRnZXQudmFsdWU/LnNldE9wdGlvbnMob3B0aW9ucyk7XG5cdFx0c3VwZXIuc2V0T3B0aW9ucyhvcHRpb25zKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBzYXZlU3RhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5fc2F2ZUVkaXRvclZpZXdTdGF0ZSh0aGlzLmlucHV0KTtcblx0XHRzdXBlci5zYXZlU3RhdGUoKTtcblx0fVxuXG5cdG92ZXJyaWRlIGdldFZpZXdTdGF0ZSgpOiBJTm90ZWJvb2tFZGl0b3JWaWV3U3RhdGUgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGlucHV0ID0gdGhpcy5pbnB1dDtcblx0XHRpZiAoIShpbnB1dCBpbnN0YW5jZW9mIE5vdGVib29rRWRpdG9ySW5wdXQpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHRoaXMuX3NhdmVFZGl0b3JWaWV3U3RhdGUoaW5wdXQpO1xuXHRcdHJldHVybiB0aGlzLl9sb2FkTm90ZWJvb2tFZGl0b3JWaWV3U3RhdGUoaW5wdXQpO1xuXHR9XG5cblx0Z2V0U2VsZWN0aW9uKCk6IElFZGl0b3JQYW5lU2VsZWN0aW9uIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGhpcy5fd2lkZ2V0LnZhbHVlKSB7XG5cdFx0XHRjb25zdCBhY3RpdmVDZWxsID0gdGhpcy5fd2lkZ2V0LnZhbHVlLmdldEFjdGl2ZUNlbGwoKTtcblx0XHRcdGlmIChhY3RpdmVDZWxsKSB7XG5cdFx0XHRcdGNvbnN0IGNlbGxVcmkgPSBhY3RpdmVDZWxsLnVyaTtcblx0XHRcdFx0cmV0dXJuIG5ldyBOb3RlYm9va0VkaXRvclNlbGVjdGlvbihjZWxsVXJpLCBhY3RpdmVDZWxsLmdldFNlbGVjdGlvbnMoKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGdldFNjcm9sbFBvc2l0aW9uKCk6IElFZGl0b3JQYW5lU2Nyb2xsUG9zaXRpb24ge1xuXHRcdGNvbnN0IHdpZGdldCA9IHRoaXMuZ2V0Q29udHJvbCgpO1xuXHRcdGlmICghd2lkZ2V0KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ05vdGVib29rIHdpZGdldCBoYXMgbm90IHlldCBiZWVuIGluaXRpYWxpemVkJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHNjcm9sbFRvcDogd2lkZ2V0LnNjcm9sbFRvcCxcblx0XHRcdHNjcm9sbExlZnQ6IDAsXG5cdFx0fTtcblx0fVxuXG5cdHNldFNjcm9sbFBvc2l0aW9uKHNjcm9sbFBvc2l0aW9uOiBJRWRpdG9yUGFuZVNjcm9sbFBvc2l0aW9uKTogdm9pZCB7XG5cdFx0Y29uc3QgZWRpdG9yID0gdGhpcy5nZXRDb250cm9sKCk7XG5cdFx0aWYgKCFlZGl0b3IpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ29udHJvbCBoYXMgbm90IHlldCBiZWVuIGluaXRpYWxpemVkJyk7XG5cdFx0fVxuXG5cdFx0ZWRpdG9yLnNldFNjcm9sbFRvcChzY3JvbGxQb3NpdGlvbi5zY3JvbGxUb3ApO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2F2ZUVkaXRvclZpZXdTdGF0ZShpbnB1dDogRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fd2lkZ2V0LnZhbHVlICYmIGlucHV0IGluc3RhbmNlb2YgTm90ZWJvb2tFZGl0b3JJbnB1dCkge1xuXHRcdFx0aWYgKHRoaXMuX3dpZGdldC52YWx1ZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLl93aWRnZXQudmFsdWUuZ2V0RWRpdG9yVmlld1N0YXRlKCk7XG5cdFx0XHR0aGlzLl9lZGl0b3JNZW1lbnRvLnNhdmVFZGl0b3JTdGF0ZSh0aGlzLmdyb3VwLCBpbnB1dC5yZXNvdXJjZSwgc3RhdGUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2xvYWROb3RlYm9va0VkaXRvclZpZXdTdGF0ZShpbnB1dDogTm90ZWJvb2tFZGl0b3JJbnB1dCk6IElOb3RlYm9va0VkaXRvclZpZXdTdGF0ZSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fZWRpdG9yTWVtZW50by5sb2FkRWRpdG9yU3RhdGUodGhpcy5ncm91cCwgaW5wdXQucmVzb3VyY2UpO1xuXHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXHRcdC8vIHdoZW4gd2UgZG9uJ3QgaGF2ZSBhIHZpZXcgc3RhdGUgZm9yIHRoZSBncm91cC9pbnB1dC10dXBsZSB0aGVuIHdlIHRyeSB0byB1c2UgYW4gZXhpc3Rpbmdcblx0XHQvLyBlZGl0b3IgZm9yIHRoZSBzYW1lIHJlc291cmNlLlxuXHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgdGhpcy5fZWRpdG9yR3JvdXBTZXJ2aWNlLmdldEdyb3VwcyhHcm91cHNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSkpIHtcblx0XHRcdGlmIChncm91cC5hY3RpdmVFZGl0b3JQYW5lICE9PSB0aGlzICYmIGdyb3VwLmFjdGl2ZUVkaXRvclBhbmUgaW5zdGFuY2VvZiBOb3RlYm9va0VkaXRvciAmJiBncm91cC5hY3RpdmVFZGl0b3I/Lm1hdGNoZXMoaW5wdXQpKSB7XG5cdFx0XHRcdHJldHVybiBncm91cC5hY3RpdmVFZGl0b3JQYW5lLl93aWRnZXQudmFsdWU/LmdldEVkaXRvclZpZXdTdGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm47XG5cdH1cblxuXHRsYXlvdXQoZGltZW5zaW9uOiBET00uRGltZW5zaW9uLCBwb3NpdGlvbjogRE9NLklEb21Qb3NpdGlvbik6IHZvaWQge1xuXHRcdHRoaXMuX3Jvb3RFbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ21pZC13aWR0aCcsIGRpbWVuc2lvbi53aWR0aCA8IDEwMDAgJiYgZGltZW5zaW9uLndpZHRoID49IDYwMCk7XG5cdFx0dGhpcy5fcm9vdEVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnbmFycm93LXdpZHRoJywgZGltZW5zaW9uLndpZHRoIDwgNjAwKTtcblx0XHR0aGlzLl9wYWdlUG9zaXRpb24gPSB7IGRpbWVuc2lvbiwgcG9zaXRpb24gfTtcblxuXHRcdGlmICghdGhpcy5fd2lkZ2V0LnZhbHVlIHx8ICEodGhpcy5pbnB1dCBpbnN0YW5jZW9mIE5vdGVib29rRWRpdG9ySW5wdXQpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuaW5wdXQucmVzb3VyY2UudG9TdHJpbmcoKSAhPT0gdGhpcy50ZXh0TW9kZWw/LnVyaS50b1N0cmluZygpICYmIHRoaXMuX3dpZGdldC52YWx1ZT8uaGFzTW9kZWwoKSkge1xuXHRcdFx0Ly8gaW5wdXQgYW5kIHdpZGdldCBtaXNtYXRjaFxuXHRcdFx0Ly8gdGhpcyBoYXBwZW5zIHdoZW5cblx0XHRcdC8vIDEuIG9wZW4gZG9jdW1lbnQgQSwgcGluIHRoZSBkb2N1bWVudFxuXHRcdFx0Ly8gMi4gb3BlbiBkb2N1bWVudCBCXG5cdFx0XHQvLyAzLiBjbG9zZSBkb2N1bWVudCBCXG5cdFx0XHQvLyA0LiBhIGxheW91dCBpcyB0cmlnZ2VyZWRcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5pc1Zpc2libGUoKSkge1xuXHRcdFx0dGhpcy5fd2lkZ2V0LnZhbHVlLmxheW91dChkaW1lbnNpb24sIHRoaXMuX3Jvb3RFbGVtZW50LCBwb3NpdGlvbik7XG5cdFx0fVxuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG59XG5cbmNsYXNzIE5vdGVib29rRWRpdG9yU2VsZWN0aW9uIGltcGxlbWVudHMgSUVkaXRvclBhbmVTZWxlY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY2VsbFVyaTogVVJJLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgc2VsZWN0aW9uczogU2VsZWN0aW9uW11cblx0KSB7IH1cblxuXHRjb21wYXJlKG90aGVyOiBJRWRpdG9yUGFuZVNlbGVjdGlvbik6IEVkaXRvclBhbmVTZWxlY3Rpb25Db21wYXJlUmVzdWx0IHtcblx0XHRpZiAoIShvdGhlciBpbnN0YW5jZW9mIE5vdGVib29rRWRpdG9yU2VsZWN0aW9uKSkge1xuXHRcdFx0cmV0dXJuIEVkaXRvclBhbmVTZWxlY3Rpb25Db21wYXJlUmVzdWx0LkRJRkZFUkVOVDtcblx0XHR9XG5cblx0XHRpZiAoaXNFcXVhbCh0aGlzLmNlbGxVcmksIG90aGVyLmNlbGxVcmkpKSB7XG5cdFx0XHRyZXR1cm4gRWRpdG9yUGFuZVNlbGVjdGlvbkNvbXBhcmVSZXN1bHQuSURFTlRJQ0FMO1xuXHRcdH1cblxuXHRcdHJldHVybiBFZGl0b3JQYW5lU2VsZWN0aW9uQ29tcGFyZVJlc3VsdC5ESUZGRVJFTlQ7XG5cdH1cblxuXHRyZXN0b3JlKG9wdGlvbnM6IElFZGl0b3JPcHRpb25zKTogSU5vdGVib29rRWRpdG9yT3B0aW9ucyB7XG5cdFx0Y29uc3Qgbm90ZWJvb2tPcHRpb25zOiBJTm90ZWJvb2tFZGl0b3JPcHRpb25zID0ge1xuXHRcdFx0Y2VsbE9wdGlvbnM6IHtcblx0XHRcdFx0cmVzb3VyY2U6IHRoaXMuY2VsbFVyaSxcblx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdHNlbGVjdGlvbjogdGhpcy5zZWxlY3Rpb25zWzBdXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0T2JqZWN0LmFzc2lnbihub3RlYm9va09wdGlvbnMsIG9wdGlvbnMpO1xuXG5cdFx0cmV0dXJuIG5vdGVib29rT3B0aW9ucztcblx0fVxuXG5cdGxvZygpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLmNlbGxVcmkuZnJhZ21lbnQ7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBRXJCLFNBQWtCLGdCQUFnQjtBQUNsQyxTQUFTLGVBQWU7QUFFeEIsU0FBUyxlQUFzQjtBQUMvQixTQUFTLGlCQUFpQix5QkFBeUI7QUFDbkQsU0FBUyxTQUFTLGVBQWU7QUFFakMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyx5Q0FBeUM7QUFDbEQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUywwQkFBMEI7QUFFbkMsU0FBUyxVQUE4QixxQkFBcUIsY0FBYyxrQ0FBa0M7QUFDNUcsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxxQkFBcUI7QUFFOUIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyw0QkFBNEIsaUNBQWlDLGtDQUFrQyx3QkFBd0ssdUJBQXVCLHlCQUF5Qix5QkFBeUI7QUFFelYsU0FBUyx3QkFBd0I7QUFFakMsU0FBdUIsOEJBQThCO0FBRXJELFNBQVMsbUNBQW1DO0FBRTVDLFNBQVMsVUFBVSxvQkFBb0IseUNBQXlDO0FBQ2hGLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsYUFBMkIsNEJBQTRCO0FBQ2hFLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMseUNBQXlDO0FBQ2xELFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsbUJB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
