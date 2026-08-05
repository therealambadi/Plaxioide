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
import "./media/notebook.css";
import "./media/notebookCellChat.css";
import "./media/notebookCellEditorHint.css";
import "./media/notebookCellInsertToolbar.css";
import "./media/notebookCellStatusBar.css";
import "./media/notebookCellTitleToolbar.css";
import "./media/notebookFocusIndicator.css";
import "./media/notebookToolbar.css";
import "./media/notebookDnd.css";
import "./media/notebookFolding.css";
import "./media/notebookCellOutput.css";
import "./media/notebookEditorStickyScroll.css";
import "./media/notebookKernelActionViewItem.css";
import "./media/notebookOutline.css";
import "./media/notebookChatEditController.css";
import "./media/notebookChatEditorOverlay.css";
import * as DOM from "../../../../base/browser/dom.js";
import * as domStylesheets from "../../../../base/browser/domStylesheets.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { DeferredPromise, SequencerByKey } from "../../../../base/common/async.js";
import { Color, RGBA } from "../../../../base/common/color.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { combinedDisposable, Disposable, DisposableStore, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import { setTimeout0 } from "../../../../base/common/platform.js";
import { extname, isEqual } from "../../../../base/common/resources.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { FontMeasurements } from "../../../../editor/browser/config/fontMeasurements.js";
import { BareFontInfo } from "../../../../editor/common/config/fontInfo.js";
import { Range } from "../../../../editor/common/core/range.js";
import { SuggestController } from "../../../../editor/contrib/suggest/browser/suggestController.js";
import * as nls from "../../../../nls.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { registerZIndex, ZIndex } from "../../../../platform/layout/browser/zIndexRegistry.js";
import { IEditorProgressService } from "../../../../platform/progress/common/progress.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { contrastBorder, errorForeground, focusBorder, foreground, listInactiveSelectionBackground, registerColor, scrollbarSliderActiveBackground, scrollbarSliderBackground, scrollbarSliderHoverBackground, transparent } from "../../../../platform/theme/common/colorRegistry.js";
import { EDITOR_PANE_BACKGROUND, PANEL_BORDER, SIDE_BAR_BACKGROUND } from "../../../common/theme.js";
import { debugIconStartForeground } from "../../debug/browser/debugColors.js";
import { CellEditState, CellFocusMode, CellRevealRangeType, CellRevealType, RenderOutputType, ScrollToRevealBehavior } from "./notebookBrowser.js";
import { NotebookEditorExtensionsRegistry } from "./notebookEditorExtensions.js";
import { INotebookEditorService } from "./services/notebookEditorService.js";
import { notebookDebug } from "./notebookLogger.js";
import { NotebookLayoutChangedEvent } from "./notebookViewEvents.js";
import { CellContextKeyManager } from "./view/cellParts/cellContextKeys.js";
import { CellDragAndDropController } from "./view/cellParts/cellDnd.js";
import { ListViewInfoAccessor, NotebookCellList, NOTEBOOK_WEBVIEW_BOUNDARY } from "./view/notebookCellList.js";
import { BackLayerWebView } from "./view/renderers/backLayerWebView.js";
import { CodeCellRenderer, MarkupCellRenderer, NotebookCellListDelegate } from "./view/renderers/cellRenderer.js";
import { CodeCellViewModel, outputDisplayLimit } from "./viewModel/codeCellViewModel.js";
import { NotebookEventDispatcher } from "./viewModel/eventDispatcher.js";
import { MarkupCellViewModel } from "./viewModel/markupCellViewModel.js";
import { NotebookViewModel } from "./viewModel/notebookViewModelImpl.js";
import { ViewContext } from "./viewModel/viewContext.js";
import { NotebookEditorWorkbenchToolbar } from "./viewParts/notebookEditorToolbar.js";
import { NotebookEditorContextKeys } from "./viewParts/notebookEditorWidgetContextKeys.js";
import { NotebookOverviewRuler } from "./viewParts/notebookOverviewRuler.js";
import { ListTopCellToolbar } from "./viewParts/notebookTopCellToolbar.js";
import { CellEditType, CellKind, NotebookFindScopeType, RENDERER_NOT_AVAILABLE, SelectionStateType } from "../common/notebookCommon.js";
import { NOTEBOOK_CURSOR_NAVIGATION_MODE, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_OUTPUT_FOCUSED, NOTEBOOK_OUTPUT_INPUT_FOCUSED } from "../common/notebookContextKeys.js";
import { INotebookExecutionService } from "../common/notebookExecutionService.js";
import { INotebookKernelService } from "../common/notebookKernelService.js";
import { NotebookOptions, OutputInnerContainerTopPadding } from "./notebookOptions.js";
import { cellRangesToIndexes } from "../common/notebookRange.js";
import { INotebookRendererMessagingService } from "../common/notebookRendererMessagingService.js";
import { INotebookService } from "../common/notebookService.js";
import { EditorExtensionsRegistry } from "../../../../editor/browser/editorExtensions.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { BaseCellEditorOptions } from "./viewModel/cellEditorOptions.js";
import { FloatingEditorClickMenu } from "../../../browser/codeeditor.js";
import { CellFindMatchModel } from "./contrib/find/findModel.js";
import { INotebookLoggingService } from "../common/notebookLoggingService.js";
import { Schemas } from "../../../../base/common/network.js";
import { DropIntoEditorController } from "../../../../editor/contrib/dropOrPasteInto/browser/dropIntoEditorController.js";
import { CopyPasteController } from "../../../../editor/contrib/dropOrPasteInto/browser/copyPasteController.js";
import { NotebookStickyScroll } from "./viewParts/notebookEditorStickyScroll.js";
import { PixelRatio } from "../../../../base/browser/pixelRatio.js";
import { PreventDefaultContextMenuItemsContextKeyName } from "../../webview/browser/webview.contribution.js";
import { NotebookAccessibilityProvider } from "./notebookAccessibilityProvider.js";
import { NotebookHorizontalTracker } from "./viewParts/notebookHorizontalTracker.js";
import { NotebookCellEditorPool } from "./view/notebookCellEditorPool.js";
import { InlineCompletionsController } from "../../../../editor/contrib/inlineCompletions/browser/controller/inlineCompletionsController.js";
const $ = DOM.$;
function getDefaultNotebookCreationOptions() {
  const skipContributions = [
    "editor.contrib.review",
    FloatingEditorClickMenu.ID,
    "editor.contrib.dirtydiff",
    "editor.contrib.testingOutputPeek",
    "editor.contrib.testingDecorations",
    "store.contrib.stickyScrollController",
    "editor.contrib.findController",
    "editor.contrib.emptyTextEditorHint"
  ];
  const contributions = EditorExtensionsRegistry.getEditorContributions().filter((c) => skipContributions.indexOf(c.id) === -1);
  return {
    menuIds: {
      notebookToolbar: MenuId.NotebookToolbar,
      cellTitleToolbar: MenuId.NotebookCellTitle,
      cellDeleteToolbar: MenuId.NotebookCellDelete,
      cellInsertToolbar: MenuId.NotebookCellBetween,
      cellTopInsertToolbar: MenuId.NotebookCellListTop,
      cellExecuteToolbar: MenuId.NotebookCellExecute,
      cellExecutePrimary: MenuId.NotebookCellExecutePrimary
    },
    cellEditorContributions: contributions
  };
}
let NotebookEditorWidget = class extends Disposable {
  constructor(creationOptions, dimension, instantiationService, editorGroupsService, notebookRendererMessaging, notebookEditorService, notebookKernelService, _notebookService, configurationService, contextKeyService, layoutService, contextMenuService, telemetryService, notebookExecutionService, editorProgressService, logService) {
    super();
    this.creationOptions = creationOptions;
    this.notebookRendererMessaging = notebookRendererMessaging;
    this.notebookEditorService = notebookEditorService;
    this.notebookKernelService = notebookKernelService;
    this._notebookService = _notebookService;
    this.configurationService = configurationService;
    this.layoutService = layoutService;
    this.contextMenuService = contextMenuService;
    this.telemetryService = telemetryService;
    this.notebookExecutionService = notebookExecutionService;
    this.editorProgressService = editorProgressService;
    this.logService = logService;
    //#region Eventing
    this._onDidChangeCellState = this._register(new Emitter());
    this.onDidChangeCellState = this._onDidChangeCellState.event;
    this._onDidChangeViewCells = this._register(new Emitter());
    this.onDidChangeViewCells = this._onDidChangeViewCells.event;
    this._onWillChangeModel = this._register(new Emitter());
    this.onWillChangeModel = this._onWillChangeModel.event;
    this._onDidChangeModel = this._register(new Emitter());
    this.onDidChangeModel = this._onDidChangeModel.event;
    this._onDidAttachViewModel = this._register(new Emitter());
    this.onDidAttachViewModel = this._onDidAttachViewModel.event;
    this._onDidChangeOptions = this._register(new Emitter());
    this.onDidChangeOptions = this._onDidChangeOptions.event;
    this._onDidChangeDecorations = this._register(new Emitter());
    this.onDidChangeDecorations = this._onDidChangeDecorations.event;
    this._onDidScroll = this._register(new Emitter());
    this.onDidScroll = this._onDidScroll.event;
    this._onDidChangeLayout = this._register(new Emitter());
    this.onDidChangeLayout = this._onDidChangeLayout.event;
    this._onDidChangeActiveCell = this._register(new Emitter());
    this.onDidChangeActiveCell = this._onDidChangeActiveCell.event;
    this._onDidChangeFocus = this._register(new Emitter());
    this.onDidChangeFocus = this._onDidChangeFocus.event;
    this._onDidChangeSelection = this._register(new Emitter());
    this.onDidChangeSelection = this._onDidChangeSelection.event;
    this._onDidChangeVisibleRanges = this._register(new Emitter());
    this.onDidChangeVisibleRanges = this._onDidChangeVisibleRanges.event;
    this._onDidFocusEmitter = this._register(new Emitter());
    this.onDidFocusWidget = this._onDidFocusEmitter.event;
    this._onDidBlurEmitter = this._register(new Emitter());
    this.onDidBlurWidget = this._onDidBlurEmitter.event;
    this._onDidChangeActiveEditor = this._register(new Emitter());
    this.onDidChangeActiveEditor = this._onDidChangeActiveEditor.event;
    this._onDidChangeActiveKernel = this._register(new Emitter());
    this.onDidChangeActiveKernel = this._onDidChangeActiveKernel.event;
    this._onMouseUp = this._register(new Emitter());
    this.onMouseUp = this._onMouseUp.event;
    this._onMouseDown = this._register(new Emitter());
    this.onMouseDown = this._onMouseDown.event;
    this._onDidReceiveMessage = this._register(new Emitter());
    this.onDidReceiveMessage = this._onDidReceiveMessage.event;
    this._onDidRenderOutput = this._register(new Emitter());
    this.onDidRenderOutput = this._onDidRenderOutput.event;
    this._onDidRemoveOutput = this._register(new Emitter());
    this.onDidRemoveOutput = this._onDidRemoveOutput.event;
    this._onDidResizeOutputEmitter = this._register(new Emitter());
    this.onDidResizeOutput = this._onDidResizeOutputEmitter.event;
    this._webview = null;
    this._webviewResolvePromise = null;
    this._webviewTransparentCover = null;
    this._listDelegate = null;
    this._dndController = null;
    this._listTopCellToolbar = null;
    this._renderedEditors = /* @__PURE__ */ new Map();
    this._localStore = this._register(new DisposableStore());
    this._localCellStateListeners = [];
    this._shadowElementViewInfo = null;
    this._contributions = /* @__PURE__ */ new Map();
    this._insetModifyQueueByOutputId = new SequencerByKey();
    this._cellContextKeyManager = null;
    this._uuid = generateUuid();
    this._webviewFocused = false;
    this._isVisible = false;
    this._isDisposed = false;
    this._baseCellEditorOptions = /* @__PURE__ */ new Map();
    this._debugFlag = false;
    this._backgroundMarkdownRenderRunning = false;
    this._lastCellWithEditorFocus = null;
    //#endregion
    //#region Cell operations/layout API
    this._pendingLayouts = /* @__PURE__ */ new WeakMap();
    this._layoutDisposables = /* @__PURE__ */ new Set();
    this._pendingOutputHeightAcks = /* @__PURE__ */ new Map();
    this._dimension = dimension;
    this.isReplHistory = creationOptions.isReplHistory ?? false;
    this._readOnly = creationOptions.isReadOnly ?? false;
    this._overlayContainer = document.createElement("div");
    this.scopedContextKeyService = this._register(contextKeyService.createScoped(this._overlayContainer));
    this.instantiationService = this._register(instantiationService.createChild(new ServiceCollection([IContextKeyService, this.scopedContextKeyService])));
    this._notebookOptions = creationOptions.options ?? this.instantiationService.createInstance(NotebookOptions, this.creationOptions?.codeWindow ?? mainWindow, this._readOnly, void 0);
    this._register(this._notebookOptions);
    const eventDispatcher = this._register(new NotebookEventDispatcher());
    this._viewContext = new ViewContext(
      this._notebookOptions,
      eventDispatcher,
      (language) => this.getBaseCellEditorOptions(language)
    );
    this._register(this._viewContext.eventDispatcher.onDidChangeLayout(() => {
      this._onDidChangeLayout.fire();
    }));
    this._register(this._viewContext.eventDispatcher.onDidChangeCellState((e) => {
      this._onDidChangeCellState.fire(e);
    }));
    this._register(_notebookService.onDidChangeOutputRenderers(() => {
      this._updateOutputRenderers();
    }));
    this._register(this.instantiationService.createInstance(NotebookEditorContextKeys, this));
    this._register(notebookKernelService.onDidChangeSelectedNotebooks((e) => {
      if (isEqual(e.notebook, this.viewModel?.uri)) {
        this._loadKernelPreloads();
        this._onDidChangeActiveKernel.fire();
      }
    }));
    this._scrollBeyondLastLine = this.configurationService.getValue("editor.scrollBeyondLastLine");
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("editor.scrollBeyondLastLine")) {
        this._scrollBeyondLastLine = this.configurationService.getValue("editor.scrollBeyondLastLine");
        if (this._dimension && this._isVisible) {
          this.layout(this._dimension);
        }
      }
    }));
    this._register(this._notebookOptions.onDidChangeOptions((e) => {
      if (e.cellStatusBarVisibility || e.cellToolbarLocation || e.cellToolbarInteraction) {
        this._updateForNotebookConfiguration();
      }
      if (e.fontFamily) {
        this._generateFontInfo();
      }
      if (e.compactView || e.focusIndicator || e.insertToolbarPosition || e.cellToolbarLocation || e.dragAndDropEnabled || e.fontSize || e.markupFontSize || e.markdownLineHeight || e.fontFamily || e.insertToolbarAlignment || e.outputFontSize || e.outputLineHeight || e.outputFontFamily || e.outputWordWrap || e.outputScrolling || e.outputLinkifyFilePaths || e.minimalError) {
        this._styleElement?.remove();
        this._createLayoutStyles();
        this._webview?.updateOptions({
          ...this.notebookOptions.computeWebviewOptions(),
          fontFamily: this._generateFontFamily()
        });
      }
      if (this._dimension && this._isVisible) {
        this.layout(this._dimension);
      }
    }));
    const container = creationOptions.codeWindow ? this.layoutService.getContainer(creationOptions.codeWindow) : this.layoutService.mainContainer;
    this._register(editorGroupsService.getPart(container).onDidScroll((e) => {
      if (!this._shadowElement || !this._isVisible) {
        return;
      }
      this.updateShadowElement(this._shadowElement, this._dimension);
      this.layoutContainerOverShadowElement(this._dimension, this._position);
    }));
    this.notebookEditorService.addNotebookEditor(this);
    const id = generateUuid();
    this._overlayContainer.id = `notebook-${id}`;
    this._overlayContainer.className = "notebookOverlay";
    this._overlayContainer.classList.add("notebook-editor");
    this._overlayContainer.inert = true;
    this._overlayContainer.style.visibility = "hidden";
    container.appendChild(this._overlayContainer);
    this._createBody(this._overlayContainer);
    this._generateFontInfo();
    this._isVisible = true;
    this._editorFocus = NOTEBOOK_EDITOR_FOCUSED.bindTo(this.scopedContextKeyService);
    this._outputFocus = NOTEBOOK_OUTPUT_FOCUSED.bindTo(this.scopedContextKeyService);
    this._outputInputFocus = NOTEBOOK_OUTPUT_INPUT_FOCUSED.bindTo(this.scopedContextKeyService);
    this._editorEditable = NOTEBOOK_EDITOR_EDITABLE.bindTo(this.scopedContextKeyService);
    this._cursorNavMode = NOTEBOOK_CURSOR_NAVIGATION_MODE.bindTo(this.scopedContextKeyService);
    new RawContextKey(PreventDefaultContextMenuItemsContextKeyName, false).bindTo(this.scopedContextKeyService).set(true);
    this._editorEditable.set(!creationOptions.isReadOnly);
    let contributions;
    if (Array.isArray(this.creationOptions.contributions)) {
      contributions = this.creationOptions.contributions;
    } else {
      contributions = NotebookEditorExtensionsRegistry.getEditorContributions();
    }
    for (const desc of contributions) {
      let contribution;
      try {
        contribution = this.instantiationService.createInstance(desc.ctor, this);
      } catch (err) {
        onUnexpectedError(err);
      }
      if (contribution) {
        if (!this._contributions.has(desc.id)) {
          this._contributions.set(desc.id, contribution);
        } else {
          contribution.dispose();
          throw new Error(`DUPLICATE notebook editor contribution: '${desc.id}'`);
        }
      }
    }
    this._updateForNotebookConfiguration();
  }
  get isVisible() {
    return this._isVisible;
  }
  get isDisposed() {
    return this._isDisposed;
  }
  set viewModel(newModel) {
    this._onWillChangeModel.fire(this._notebookViewModel?.notebookDocument);
    this._notebookViewModel = newModel;
    this._onDidChangeModel.fire(newModel?.notebookDocument);
  }
  get viewModel() {
    return this._notebookViewModel;
  }
  get textModel() {
    return this._notebookViewModel?.notebookDocument;
  }
  get isReadOnly() {
    return this._notebookViewModel?.options.isReadOnly ?? false;
  }
  get activeCodeEditor() {
    if (this._isDisposed) {
      return;
    }
    const [focused] = this._list.getFocusedElements();
    return this._renderedEditors.get(focused);
  }
  get activeCellAndCodeEditor() {
    if (this._isDisposed) {
      return;
    }
    const [focused] = this._list.getFocusedElements();
    const editor = this._renderedEditors.get(focused);
    if (!editor) {
      return;
    }
    return [focused, editor];
  }
  get codeEditors() {
    return [...this._renderedEditors];
  }
  get visibleRanges() {
    return this._list ? this._list.visibleRanges || [] : [];
  }
  get notebookOptions() {
    return this._notebookOptions;
  }
  _debug(...args) {
    if (!this._debugFlag) {
      return;
    }
    notebookDebug(...args);
  }
  /**
   * EditorId
   */
  getId() {
    return this._uuid;
  }
  getViewModel() {
    return this.viewModel;
  }
  getLength() {
    return this.viewModel?.length ?? 0;
  }
  getSelections() {
    return this.viewModel?.getSelections() ?? [];
  }
  setSelections(selections) {
    if (!this.viewModel) {
      return;
    }
    const focus = this.viewModel.getFocus();
    this.viewModel.updateSelectionsState({
      kind: SelectionStateType.Index,
      focus,
      selections
    });
  }
  getFocus() {
    return this.viewModel?.getFocus() ?? { start: 0, end: 0 };
  }
  setFocus(focus) {
    if (!this.viewModel) {
      return;
    }
    const selections = this.viewModel.getSelections();
    this.viewModel.updateSelectionsState({
      kind: SelectionStateType.Index,
      focus,
      selections
    });
  }
  getSelectionViewModels() {
    if (!this.viewModel) {
      return [];
    }
    const cellsSet = /* @__PURE__ */ new Set();
    return this.viewModel.getSelections().map((range) => this.viewModel.viewCells.slice(range.start, range.end)).reduce((a, b) => {
      b.forEach((cell) => {
        if (!cellsSet.has(cell.handle)) {
          cellsSet.add(cell.handle);
          a.push(cell);
        }
      });
      return a;
    }, []);
  }
  hasModel() {
    return !!this._notebookViewModel;
  }
  showProgress() {
    this._currentProgress = this.editorProgressService.show(true);
  }
  hideProgress() {
    if (this._currentProgress) {
      this._currentProgress.done();
      this._currentProgress = void 0;
    }
  }
  //#region Editor Core
  getBaseCellEditorOptions(language) {
    const existingOptions = this._baseCellEditorOptions.get(language);
    if (existingOptions) {
      return existingOptions;
    } else {
      const options = new BaseCellEditorOptions(this, this.notebookOptions, this.configurationService, language);
      this._baseCellEditorOptions.set(language, options);
      return options;
    }
  }
  _updateForNotebookConfiguration() {
    if (!this._overlayContainer) {
      return;
    }
    this._overlayContainer.classList.remove("cell-title-toolbar-left");
    this._overlayContainer.classList.remove("cell-title-toolbar-right");
    this._overlayContainer.classList.remove("cell-title-toolbar-hidden");
    const cellToolbarLocation = this._notebookOptions.computeCellToolbarLocation(this.viewModel?.viewType);
    this._overlayContainer.classList.add(`cell-title-toolbar-${cellToolbarLocation}`);
    const cellToolbarInteraction = this._notebookOptions.getDisplayOptions().cellToolbarInteraction;
    let cellToolbarInteractionState = "hover";
    this._overlayContainer.classList.remove("cell-toolbar-hover");
    this._overlayContainer.classList.remove("cell-toolbar-click");
    if (cellToolbarInteraction === "hover" || cellToolbarInteraction === "click") {
      cellToolbarInteractionState = cellToolbarInteraction;
    }
    this._overlayContainer.classList.add(`cell-toolbar-${cellToolbarInteractionState}`);
  }
  _generateFontInfo() {
    const editorOptions = this.configurationService.getValue("editor");
    const targetWindow = DOM.getWindow(this.getDomNode());
    this._fontInfo = FontMeasurements.readFontInfo(targetWindow, BareFontInfo.createFromRawSettings(editorOptions, PixelRatio.getInstance(targetWindow).value));
  }
  _createBody(parent) {
    this._notebookTopToolbarContainer = document.createElement("div");
    this._notebookTopToolbarContainer.classList.add("notebook-toolbar-container");
    this._notebookTopToolbarContainer.style.display = "none";
    DOM.append(parent, this._notebookTopToolbarContainer);
    this._notebookStickyScrollContainer = document.createElement("div");
    this._notebookStickyScrollContainer.classList.add("notebook-sticky-scroll-container");
    DOM.append(parent, this._notebookStickyScrollContainer);
    this._body = document.createElement("div");
    DOM.append(parent, this._body);
    this._body.classList.add("cell-list-container");
    this._createLayoutStyles();
    this._createCellList();
    this._notebookOverviewRulerContainer = document.createElement("div");
    this._notebookOverviewRulerContainer.classList.add("notebook-overview-ruler-container");
    this._list.scrollableElement.appendChild(this._notebookOverviewRulerContainer);
    this._registerNotebookOverviewRuler();
    this._register(this.instantiationService.createInstance(NotebookHorizontalTracker, this, this._list.scrollableElement));
    this._overflowContainer = document.createElement("div");
    this._overflowContainer.classList.add("notebook-overflow-widget-container", "monaco-editor");
    DOM.append(parent, this._overflowContainer);
  }
  _generateFontFamily() {
    return this._fontInfo?.fontFamily ?? `"SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace`;
  }
  _createLayoutStyles() {
    this._styleElement = domStylesheets.createStyleSheet(this._body);
    const {
      cellRightMargin,
      cellTopMargin,
      cellRunGutter,
      cellBottomMargin,
      codeCellLeftMargin,
      markdownCellGutter,
      markdownCellLeftMargin,
      markdownCellBottomMargin,
      markdownCellTopMargin,
      collapsedIndicatorHeight,
      focusIndicator,
      insertToolbarPosition,
      outputFontSize,
      focusIndicatorLeftMargin,
      focusIndicatorGap
    } = this._notebookOptions.getLayoutConfiguration();
    const {
      insertToolbarAlignment,
      compactView,
      fontSize
    } = this._notebookOptions.getDisplayOptions();
    const getCellEditorContainerLeftMargin = this._notebookOptions.getCellEditorContainerLeftMargin();
    const { bottomToolbarGap, bottomToolbarHeight } = this._notebookOptions.computeBottomToolbarDimensions(this.viewModel?.viewType);
    const styleSheets = [];
    if (!this._fontInfo) {
      this._generateFontInfo();
    }
    const fontFamily = this._generateFontFamily();
    styleSheets.push(`
		.notebook-editor {
			--notebook-cell-output-font-size: ${outputFontSize}px;
			--notebook-cell-input-preview-font-size: ${fontSize}px;
			--notebook-cell-input-preview-font-family: ${fontFamily};
		}
		`);
    if (compactView) {
      styleSheets.push(`.notebookOverlay .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .markdown-cell-row div.cell.code { margin-left: ${getCellEditorContainerLeftMargin}px; }`);
    } else {
      styleSheets.push(`.notebookOverlay .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .markdown-cell-row div.cell.code { margin-left: ${codeCellLeftMargin}px; }`);
    }
    if (focusIndicator === "border") {
      styleSheets.push(`
			.monaco-workbench .notebookOverlay .monaco-list .monaco-list-row .cell-focus-indicator-top:before,
			.monaco-workbench .notebookOverlay .monaco-list .monaco-list-row .cell-focus-indicator-bottom:before,
			.monaco-workbench .notebookOverlay .monaco-list .markdown-cell-row .cell-inner-container:before,
			.monaco-workbench .notebookOverlay .monaco-list .markdown-cell-row .cell-inner-container:after {
				content: "";
				position: absolute;
				width: 100%;
				height: 1px;
			}

			.monaco-workbench .notebookOverlay .monaco-list .monaco-list-row .cell-focus-indicator-left:before,
			.monaco-workbench .notebookOverlay .monaco-list .monaco-list-row .cell-focus-indicator-right:before {
				content: "";
				position: absolute;
				width: 1px;
				height: 100%;
				z-index: 10;
			}

			/* top border */
			.monaco-workbench .notebookOverlay .monaco-list .monaco-list-row .cell-focus-indicator-top:before {
				border-top: 1px solid transparent;
			}

			/* left border */
			.monaco-workbench .notebookOverlay .monaco-list .monaco-list-row .cell-focus-indicator-left:before {
				border-left: 1px solid transparent;
			}

			/* bottom border */
			.monaco-workbench .notebookOverlay .monaco-list .monaco-list-row .cell-focus-indicator-bottom:before {
				border-bottom: 1px solid transparent;
			}

			/* right border */
			.monaco-workbench .notebookOverlay .monaco-list .monaco-list-row .cell-focus-indicator-right:before {
				border-right: 1px solid transparent;
			}
			`);
      styleSheets.push(`
			.monaco-workbench .notebookOverlay .monaco-list .monaco-list-row.code-cell-row.focused .cell-focus-indicator-left:before,
			.monaco-workbench .notebookOverlay .monaco-list .monaco-list-row.code-cell-row.focused .cell-focus-indicator-right:before,
			.monaco-workbench .notebookOverlay .monaco-list.selection-multiple .monaco-list-row.code-cell-row.selected .cell-focus-indicator-left:before,
			.monaco-workbench .notebookOverlay .monaco-list.selection-multiple .monaco-list-row.code-cell-row.selected .cell-focus-indicator-right:before {
				top: -${cellTopMargin}px; height: calc(100% + ${cellTopMargin + cellBottomMargin}px)
			}`);
    } else {
      styleSheets.push(`
			.monaco-workbench .notebookOverlay .monaco-list .monaco-list-row .cell-focus-indicator-left .codeOutput-focus-indicator {
				border-left: 3px solid transparent;
				border-radius: 4px;
				width: 0px;
				margin-left: ${focusIndicatorLeftMargin}px;
				border-color: var(--vscode-notebook-inactiveFocusedCellBorder) !important;
			}

			.monaco-workbench .notebookOverlay .monaco-list .monaco-list-row.focused .cell-focus-indicator-left .codeOutput-focus-indicator-container,
			.monaco-workbench .notebookOverlay .monaco-list .monaco-list-row .cell-output-hover .cell-focus-indicator-left .codeOutput-focus-indicator-container,
			.monaco-workbench .notebookOverlay .monaco-list .monaco-list-row .markdown-cell-hover .cell-focus-indicator-left .codeOutput-focus-indicator-container,
			.monaco-workbench .notebookOverlay .monaco-list .monaco-list-row:hover .cell-focus-indicator-left .codeOutput-focus-indicator-container {
				display: block;
			}

			.monaco-workbench .notebookOverlay .monaco-list .monaco-list-row .cell-focus-indicator-left .codeOutput-focus-indicator-container:hover .codeOutput-focus-indicator {
				border-left: 5px solid transparent;
				margin-left: ${focusIndicatorLeftMargin - 1}px;
			}
			`);
      styleSheets.push(`
			.monaco-workbench .notebookOverlay .monaco-list .monaco-list-row.focused .cell-inner-container.cell-output-focus .cell-focus-indicator-left .codeOutput-focus-indicator,
			.monaco-workbench .notebookOverlay .monaco-list:focus-within .monaco-list-row.focused .cell-inner-container .cell-focus-indicator-left .codeOutput-focus-indicator {
				border-color: var(--vscode-notebook-focusedCellBorder) !important;
			}

			.monaco-workbench .notebookOverlay .monaco-list .monaco-list-row .cell-inner-container .cell-focus-indicator-left .output-focus-indicator {
				margin-top: ${focusIndicatorGap}px;
			}
			`);
    }
    if (insertToolbarPosition === "betweenCells" || insertToolbarPosition === "both") {
      styleSheets.push(`.monaco-workbench .notebookOverlay > .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .monaco-list-row .cell-bottom-toolbar-container { display: flex; }`);
      styleSheets.push(`.monaco-workbench .notebookOverlay > .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .view-zones .cell-list-top-cell-toolbar-container { display: flex; }`);
    } else {
      styleSheets.push(`.monaco-workbench .notebookOverlay > .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .monaco-list-row .cell-bottom-toolbar-container { display: none; }`);
      styleSheets.push(`.monaco-workbench .notebookOverlay > .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .view-zones .cell-list-top-cell-toolbar-container { display: none; }`);
    }
    if (insertToolbarAlignment === "left") {
      styleSheets.push(`
			.monaco-workbench .notebookOverlay .cell-list-top-cell-toolbar-container .action-item:first-child,
			.monaco-workbench .notebookOverlay .cell-list-top-cell-toolbar-container .action-item:first-child, .monaco-workbench .notebookOverlay > .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .monaco-list-row .cell-bottom-toolbar-container .action-item:first-child {
				margin-right: 0px !important;
			}`);
      styleSheets.push(`
			.monaco-workbench .notebookOverlay .cell-list-top-cell-toolbar-container .monaco-toolbar .action-label,
			.monaco-workbench .notebookOverlay .cell-list-top-cell-toolbar-container .monaco-toolbar .action-label, .monaco-workbench .notebookOverlay > .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .monaco-list-row .cell-bottom-toolbar-container .monaco-toolbar .action-label {
				padding: 0px !important;
				justify-content: center;
				border-radius: 4px;
			}`);
      styleSheets.push(`
			.monaco-workbench .notebookOverlay .cell-list-top-cell-toolbar-container,
			.monaco-workbench .notebookOverlay .cell-list-top-cell-toolbar-container, .monaco-workbench .notebookOverlay > .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .monaco-list-row .cell-bottom-toolbar-container {
				align-items: flex-start;
				justify-content: left;
				margin: 0 16px 0 ${8 + codeCellLeftMargin}px;
			}`);
      styleSheets.push(`
			.monaco-workbench .notebookOverlay .cell-list-top-cell-toolbar-container,
			.notebookOverlay .cell-bottom-toolbar-container .action-item {
				border: 0px;
			}`);
    }
    styleSheets.push(`.notebookOverlay .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .code-cell-row div.cell.code { margin-left: ${getCellEditorContainerLeftMargin}px; }`);
    styleSheets.push(`.notebookOverlay .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .view-zones .code-cell-row div.cell.code { margin-left: ${getCellEditorContainerLeftMargin}px; }`);
    styleSheets.push(`.notebookOverlay .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .view-zones .code-cell-row div.cell { margin-right: ${cellRightMargin}px; }`);
    styleSheets.push(`.notebookOverlay .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .monaco-list-row div.cell { margin-right: ${cellRightMargin}px; }`);
    styleSheets.push(`.notebookOverlay .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .monaco-list-row > .cell-inner-container { padding-top: ${cellTopMargin}px; }`);
    styleSheets.push(`.notebookOverlay .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .markdown-cell-row > .cell-inner-container { padding-bottom: ${markdownCellBottomMargin}px; padding-top: ${markdownCellTopMargin}px; }`);
    styleSheets.push(`.notebookOverlay .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .markdown-cell-row > .cell-inner-container.webview-backed-markdown-cell { padding: 0; }`);
    styleSheets.push(`.notebookOverlay .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .markdown-cell-row > .webview-backed-markdown-cell.markdown-cell-edit-mode .cell.code { padding-bottom: ${markdownCellBottomMargin}px; padding-top: ${markdownCellTopMargin}px; }`);
    styleSheets.push(`.notebookOverlay .output { margin: 0px ${cellRightMargin}px 0px ${getCellEditorContainerLeftMargin}px; }`);
    styleSheets.push(`.notebookOverlay .output { width: calc(100% - ${getCellEditorContainerLeftMargin + cellRightMargin}px); }`);
    styleSheets.push(`.notebookOverlay .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .monaco-list-row .cell-comment-container { left: ${getCellEditorContainerLeftMargin}px; }`);
    styleSheets.push(`.notebookOverlay .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .monaco-list-row .cell-comment-container { width: calc(100% - ${getCellEditorContainerLeftMargin + cellRightMargin}px); }`);
    styleSheets.push(`.monaco-workbench .notebookOverlay .output .output-collapse-container .expandButton { left: -${cellRunGutter}px; }`);
    styleSheets.push(`.monaco-workbench .notebookOverlay .output .output-collapse-container .expandButton {
			position: absolute;
			width: ${cellRunGutter}px;
			padding: 6px 0px;
		}`);
    styleSheets.push(`.notebookOverlay .output-show-more-container { margin: 0px ${cellRightMargin}px 0px ${getCellEditorContainerLeftMargin}px; }`);
    styleSheets.push(`.notebookOverlay .output-show-more-container { width: calc(100% - ${getCellEditorContainerLeftMargin + cellRightMargin}px); }`);
    styleSheets.push(`.notebookOverlay .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .monaco-list-row div.cell.markdown { padding-left: ${cellRunGutter}px; }`);
    styleSheets.push(`.monaco-workbench .notebookOverlay > .cell-list-container .notebook-folding-indicator { left: ${(markdownCellGutter - 20) / 2 + markdownCellLeftMargin}px; }`);
    styleSheets.push(`.notebookOverlay > .cell-list-container .notebook-folded-hint { left: ${markdownCellGutter + markdownCellLeftMargin + 8}px; }`);
    styleSheets.push(`.notebookOverlay .monaco-list .monaco-list-row :not(.webview-backed-markdown-cell) .cell-focus-indicator-top { height: ${cellTopMargin}px; }`);
    styleSheets.push(`.notebookOverlay .monaco-list .monaco-list-row .cell-focus-indicator-side { bottom: ${bottomToolbarGap}px; }`);
    styleSheets.push(`.notebookOverlay .monaco-list .monaco-list-row.code-cell-row .cell-focus-indicator-left { width: ${getCellEditorContainerLeftMargin}px; }`);
    styleSheets.push(`.notebookOverlay .monaco-list .monaco-list-row.markdown-cell-row .cell-focus-indicator-left { width: ${codeCellLeftMargin}px; }`);
    styleSheets.push(`.notebookOverlay .monaco-list .monaco-list-row .cell-focus-indicator.cell-focus-indicator-right { width: ${cellRightMargin}px; }`);
    styleSheets.push(`.notebookOverlay .monaco-list .monaco-list-row .cell-focus-indicator-bottom { height: ${cellBottomMargin}px; }`);
    styleSheets.push(`.notebookOverlay .monaco-list .monaco-list-row .cell-shadow-container-bottom { top: ${cellBottomMargin}px; }`);
    styleSheets.push(`
			.notebookOverlay .monaco-list.selection-multiple .monaco-list-row:has(+ .monaco-list-row.selected) .cell-focus-indicator-bottom {
				height: ${bottomToolbarGap + cellBottomMargin}px;
			}
		`);
    styleSheets.push(`
			.notebookOverlay .monaco-list .monaco-list-row.code-cell-row.nb-multiCellHighlight:has(+ .monaco-list-row.nb-multiCellHighlight) .cell-focus-indicator-bottom {
				height: ${bottomToolbarGap + cellBottomMargin}px;
				background-color: var(--vscode-notebook-symbolHighlightBackground) !important;
			}

			.notebookOverlay .monaco-list .monaco-list-row.markdown-cell-row.nb-multiCellHighlight:has(+ .monaco-list-row.nb-multiCellHighlight) .cell-focus-indicator-bottom {
				height: ${bottomToolbarGap + cellBottomMargin - 6}px;
				background-color: var(--vscode-notebook-symbolHighlightBackground) !important;
			}
		`);
    styleSheets.push(`
			.monaco-workbench .notebookOverlay > .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .monaco-list-row .input-collapse-container .cell-collapse-preview {
				line-height: ${collapsedIndicatorHeight}px;
			}

			.monaco-workbench .notebookOverlay > .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .monaco-list-row .input-collapse-container .cell-collapse-preview .monaco-tokenized-source {
				max-height: ${collapsedIndicatorHeight}px;
			}
		`);
    styleSheets.push(`.monaco-workbench .notebookOverlay > .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .monaco-list-row .cell-bottom-toolbar-container .monaco-toolbar { height: ${bottomToolbarHeight}px }`);
    styleSheets.push(`.monaco-workbench .notebookOverlay > .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .view-zones .cell-list-top-cell-toolbar-container .monaco-toolbar { height: ${bottomToolbarHeight}px }`);
    styleSheets.push(`.monaco-workbench .notebookOverlay.cell-title-toolbar-right > .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .monaco-list-row .cell-title-toolbar {
			right: ${cellRightMargin + 26}px;
		}
		.monaco-workbench .notebookOverlay.cell-title-toolbar-left > .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .monaco-list-row .cell-title-toolbar {
			left: ${getCellEditorContainerLeftMargin + 16}px;
		}
		.monaco-workbench .notebookOverlay.cell-title-toolbar-hidden > .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .monaco-list-row .cell-title-toolbar {
			display: none;
		}`);
    styleSheets.push(`
		.monaco-workbench .notebookOverlay .output > div.foreground.output-inner-container {
			padding: ${OutputInnerContainerTopPadding}px 8px;
		}
		.monaco-workbench .notebookOverlay > .cell-list-container > .monaco-list > .monaco-scrollable-element > .monaco-list-rows > .monaco-list-row .output-collapse-container {
			padding: ${OutputInnerContainerTopPadding}px 8px;
		}
		`);
    styleSheets.push(`
		.monaco-workbench .notebookOverlay .cell-chat-part {
			margin: 0 ${cellRightMargin}px 6px 4px;
		}
		`);
    this._styleElement.textContent = styleSheets.join("\n");
  }
  _createCellList() {
    this._body.classList.add("cell-list-container");
    this._dndController = this._register(new CellDragAndDropController(this, this._body));
    const getScopedContextKeyService = (container) => this._list.contextKeyService.createScoped(container);
    this._editorPool = this._register(this.instantiationService.createInstance(NotebookCellEditorPool, this, getScopedContextKeyService));
    const renderers = [
      this.instantiationService.createInstance(CodeCellRenderer, this, this._renderedEditors, this._editorPool, this._dndController, getScopedContextKeyService),
      this.instantiationService.createInstance(MarkupCellRenderer, this, this._dndController, this._renderedEditors, getScopedContextKeyService)
    ];
    renderers.forEach((renderer) => {
      this._register(renderer);
    });
    this._listDelegate = this.instantiationService.createInstance(NotebookCellListDelegate, DOM.getWindow(this.getDomNode()));
    this._register(this._listDelegate);
    const accessibilityProvider = this.instantiationService.createInstance(NotebookAccessibilityProvider, () => this.viewModel, this.isReplHistory);
    this._register(accessibilityProvider);
    this._list = this.instantiationService.createInstance(
      NotebookCellList,
      "NotebookCellList",
      this._body,
      this._viewContext.notebookOptions,
      this._listDelegate,
      renderers,
      this.scopedContextKeyService,
      {
        setRowLineHeight: false,
        setRowHeight: false,
        supportDynamicHeights: true,
        horizontalScrolling: false,
        keyboardSupport: false,
        mouseSupport: true,
        multipleSelectionSupport: true,
        selectionNavigation: true,
        typeNavigationEnabled: true,
        paddingTop: 0,
        paddingBottom: 0,
        transformOptimization: false,
        //(isMacintosh && isNative) || getTitleBarStyle(this.configurationService, this.environmentService) === 'native',
        initialSize: this._dimension,
        styleController: (_suffix) => {
          return this._list;
        },
        overrideStyles: {
          listBackground: notebookEditorBackground,
          listActiveSelectionBackground: notebookEditorBackground,
          listActiveSelectionForeground: foreground,
          listFocusAndSelectionBackground: notebookEditorBackground,
          listFocusAndSelectionForeground: foreground,
          listFocusBackground: notebookEditorBackground,
          listFocusForeground: foreground,
          listHoverForeground: foreground,
          listHoverBackground: notebookEditorBackground,
          listHoverOutline: focusBorder,
          listFocusOutline: focusBorder,
          listInactiveSelectionBackground: notebookEditorBackground,
          listInactiveSelectionForeground: foreground,
          listInactiveFocusBackground: notebookEditorBackground,
          listInactiveFocusOutline: notebookEditorBackground
        },
        accessibilityProvider
      }
    );
    this._dndController.setList(this._list);
    this._register(this._list);
    this._listViewInfoAccessor = new ListViewInfoAccessor(this._list);
    this._register(this._listViewInfoAccessor);
    this._register(combinedDisposable(...renderers));
    this._listTopCellToolbar = this._register(this.instantiationService.createInstance(ListTopCellToolbar, this, this.notebookOptions));
    this._webviewTransparentCover = DOM.append(this._list.rowsContainer, $(".webview-cover"));
    this._webviewTransparentCover.style.display = "none";
    this._register(DOM.addStandardDisposableGenericMouseDownListener(this._overlayContainer, (e) => {
      if (e.target.classList.contains("slider") && this._webviewTransparentCover) {
        this._webviewTransparentCover.style.display = "block";
      }
    }));
    this._register(DOM.addStandardDisposableGenericMouseUpListener(this._overlayContainer, () => {
      if (this._webviewTransparentCover) {
        this._webviewTransparentCover.style.display = "none";
      }
    }));
    this._register(this._list.onMouseDown((e) => {
      if (e.element) {
        this._onMouseDown.fire({ event: e.browserEvent, target: e.element });
      }
    }));
    this._register(this._list.onMouseUp((e) => {
      if (e.element) {
        this._onMouseUp.fire({ event: e.browserEvent, target: e.element });
      }
    }));
    this._register(this._list.onDidChangeFocus((_e) => {
      this._onDidChangeActiveEditor.fire(this);
      this._onDidChangeActiveCell.fire();
      this._onDidChangeFocus.fire();
      this._cursorNavMode.set(false);
    }));
    this._register(this._list.onContextMenu((e) => {
      this.showListContextMenu(e);
    }));
    this._register(this._list.onDidChangeVisibleRanges(() => {
      this._onDidChangeVisibleRanges.fire();
    }));
    this._register(this._list.onDidScroll((e) => {
      if (e.scrollTop !== e.oldScrollTop) {
        this._onDidScroll.fire();
        this.clearActiveCellWidgets();
      }
      if (e.scrollTop === e.oldScrollTop && e.scrollHeightChanged) {
        this._onDidChangeLayout.fire();
      }
    }));
    this._focusTracker = this._register(DOM.trackFocus(this.getDomNode()));
    this._register(this._focusTracker.onDidBlur(() => {
      this._editorFocus.set(false);
      this.viewModel?.setEditorFocus(false);
      this._onDidBlurEmitter.fire();
    }));
    this._register(this._focusTracker.onDidFocus(() => {
      this._editorFocus.set(true);
      this.viewModel?.setEditorFocus(true);
      this._onDidFocusEmitter.fire();
    }));
    this._registerNotebookActionsToolbar();
    this._registerNotebookStickyScroll();
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(accessibilityProvider.verbositySettingId)) {
        this._list.ariaLabel = accessibilityProvider?.getWidgetAriaLabel();
      }
    }));
  }
  showListContextMenu(e) {
    this.contextMenuService.showContextMenu({
      menuId: MenuId.NotebookCellTitle,
      menuActionOptions: {
        shouldForwardArgs: true
      },
      contextKeyService: this.scopedContextKeyService,
      getAnchor: () => e.anchor,
      getActionsContext: () => {
        return {
          from: "cellContainer"
        };
      }
    });
  }
  _registerNotebookOverviewRuler() {
    this._notebookOverviewRuler = this._register(this.instantiationService.createInstance(NotebookOverviewRuler, this, this._notebookOverviewRulerContainer));
  }
  _registerNotebookActionsToolbar() {
    this._notebookTopToolbar = this._register(this.instantiationService.createInstance(NotebookEditorWorkbenchToolbar, this, this.scopedContextKeyService, this._notebookOptions, this._notebookTopToolbarContainer));
    this._register(this._notebookTopToolbar.onDidChangeVisibility(() => {
      if (this._dimension && this._isVisible) {
        this.layout(this._dimension);
      }
    }));
  }
  _registerNotebookStickyScroll() {
    this._notebookStickyScroll = this._register(this.instantiationService.createInstance(NotebookStickyScroll, this._notebookStickyScrollContainer, this, this._list, (sizeDelta) => {
      if (this.isDisposed) {
        return;
      }
      if (this._dimension && this._isVisible) {
        if (sizeDelta > 0) {
          this.layout(this._dimension);
          this.setScrollTop(this.scrollTop + sizeDelta);
        } else if (sizeDelta < 0) {
          this.setScrollTop(this.scrollTop + sizeDelta);
          this.layout(this._dimension);
        }
      }
      this._onDidScroll.fire();
    }));
  }
  _updateOutputRenderers() {
    if (!this.viewModel || !this._webview) {
      return;
    }
    this._webview.updateOutputRenderers();
    this.viewModel.viewCells.forEach((cell) => {
      cell.outputsViewModels.forEach((output) => {
        if (output.pickedMimeType?.rendererId === RENDERER_NOT_AVAILABLE) {
          output.resetRenderer();
        }
      });
    });
  }
  getDomNode() {
    return this._overlayContainer;
  }
  getOverflowContainerDomNode() {
    return this._overflowContainer;
  }
  getInnerWebview() {
    return this._webview?.webview;
  }
  setEditorProgressService(editorProgressService) {
    this.editorProgressService = editorProgressService;
  }
  setParentContextKeyService(parentContextKeyService) {
    this.scopedContextKeyService.updateParent(parentContextKeyService);
  }
  async setModel(textModel, viewState, perf, viewType) {
    if (this.viewModel === void 0 || !this.viewModel.equal(textModel)) {
      const oldBottomToolbarDimensions = this._notebookOptions.computeBottomToolbarDimensions(this.viewModel?.viewType);
      this._detachModel();
      await this._attachModel(textModel, viewType ?? textModel.viewType, viewState, perf);
      const newBottomToolbarDimensions = this._notebookOptions.computeBottomToolbarDimensions(this.viewModel?.viewType);
      if (oldBottomToolbarDimensions.bottomToolbarGap !== newBottomToolbarDimensions.bottomToolbarGap || oldBottomToolbarDimensions.bottomToolbarHeight !== newBottomToolbarDimensions.bottomToolbarHeight) {
        this._styleElement?.remove();
        this._createLayoutStyles();
        this._webview?.updateOptions({
          ...this.notebookOptions.computeWebviewOptions(),
          fontFamily: this._generateFontFamily()
        });
      }
      this.telemetryService.publicLog2("notebook/editorOpened", {
        scheme: textModel.uri.scheme,
        ext: extname(textModel.uri),
        viewType: textModel.viewType,
        isRepl: this.isReplHistory
      });
    } else {
      this.restoreListViewState(viewState);
    }
    this._restoreSelectedKernel(viewState);
    this._loadKernelPreloads();
    this._dndController?.clearGlobalDragState();
    this._localStore.add(this._list.onDidChangeFocus(() => {
      this.updateContextKeysOnFocusChange();
    }));
    this.updateContextKeysOnFocusChange();
    this._backgroundMarkdownRendering();
  }
  _backgroundMarkdownRendering() {
    if (this._backgroundMarkdownRenderRunning) {
      return;
    }
    this._backgroundMarkdownRenderRunning = true;
    DOM.runWhenWindowIdle(DOM.getWindow(this.getDomNode()), (deadline) => {
      this._backgroundMarkdownRenderingWithDeadline(deadline);
    });
  }
  _backgroundMarkdownRenderingWithDeadline(deadline) {
    const endTime = Date.now() + deadline.timeRemaining();
    const execute = () => {
      try {
        this._backgroundMarkdownRenderRunning = true;
        if (this._isDisposed) {
          return;
        }
        if (!this.viewModel) {
          return;
        }
        const firstMarkupCell = this.viewModel.viewCells.find((cell) => cell.cellKind === CellKind.Markup && !this._webview?.markupPreviewMapping.has(cell.id) && !this.cellIsHidden(cell));
        if (!firstMarkupCell) {
          return;
        }
        this.createMarkupPreview(firstMarkupCell);
      } finally {
        this._backgroundMarkdownRenderRunning = false;
      }
      if (Date.now() < endTime) {
        setTimeout0(execute);
      } else {
        this._backgroundMarkdownRendering();
      }
    };
    execute();
  }
  updateContextKeysOnFocusChange() {
    if (!this.viewModel) {
      return;
    }
    const focused = this._list.getFocusedElements()[0];
    if (focused) {
      if (!this._cellContextKeyManager) {
        this._cellContextKeyManager = this._localStore.add(this.instantiationService.createInstance(CellContextKeyManager, this, focused));
      }
      this._cellContextKeyManager.updateForElement(focused);
    }
  }
  async setOptions(options) {
    if (options?.isReadOnly !== void 0) {
      this._readOnly = options?.isReadOnly;
    }
    if (!this.viewModel) {
      return;
    }
    this.viewModel.updateOptions({ isReadOnly: this._readOnly });
    this.notebookOptions.updateOptions(this._readOnly);
    const cellOptions = options?.cellOptions ?? this._parseIndexedCellOptions(options);
    if (cellOptions) {
      const cell = this.viewModel.viewCells.find((cell2) => cell2.uri.toString() === cellOptions.resource.toString());
      if (cell) {
        this.focusElement(cell);
        const selection = cellOptions.options?.selection;
        if (selection) {
          cell.updateEditState(CellEditState.Editing, "setOptions");
          cell.focusMode = CellFocusMode.Editor;
          await this.revealRangeInCenterIfOutsideViewportAsync(cell, new Range(selection.startLineNumber, selection.startColumn, selection.endLineNumber || selection.startLineNumber, selection.endColumn || selection.startColumn));
        } else {
          this._list.revealCell(cell, options?.cellRevealType ?? CellRevealType.CenterIfOutsideViewport);
        }
        const editor = this._renderedEditors.get(cell);
        if (editor) {
          if (cellOptions.options?.selection) {
            const { selection: selection2 } = cellOptions.options;
            const editorSelection = new Range(selection2.startLineNumber, selection2.startColumn, selection2.endLineNumber || selection2.startLineNumber, selection2.endColumn || selection2.startColumn);
            editor.setSelection(editorSelection);
            editor.revealPositionInCenterIfOutsideViewport({
              lineNumber: selection2.startLineNumber,
              column: selection2.startColumn
            });
            await this.revealRangeInCenterIfOutsideViewportAsync(cell, editorSelection);
          }
          if (!cellOptions.options?.preserveFocus) {
            editor.focus();
          }
        }
      }
    }
    if (options?.cellSelections) {
      const focusCellIndex = options.cellSelections[0].start;
      const focusedCell = this.viewModel.cellAt(focusCellIndex);
      if (focusedCell) {
        this.viewModel.updateSelectionsState({
          kind: SelectionStateType.Index,
          focus: { start: focusCellIndex, end: focusCellIndex + 1 },
          selections: options.cellSelections
        });
        this.revealInCenterIfOutsideViewport(focusedCell);
      }
    }
    this._updateForOptions();
    this._onDidChangeOptions.fire();
  }
  _parseIndexedCellOptions(options) {
    if (options?.indexedCellOptions) {
      const cell = this.cellAt(options.indexedCellOptions.index);
      if (cell) {
        return {
          resource: cell.uri,
          options: {
            selection: options.indexedCellOptions.selection,
            preserveFocus: false
          }
        };
      }
    }
    return void 0;
  }
  _detachModel() {
    this._localStore.clear();
    dispose(this._localCellStateListeners);
    this._list.detachViewModel();
    this.viewModel?.dispose();
    this.viewModel = void 0;
    this._webview?.dispose();
    this._webview?.element.remove();
    this._webview = null;
    this._list.clear();
  }
  _updateForOptions() {
    if (!this.viewModel) {
      return;
    }
    this._editorEditable.set(!this.viewModel.options.isReadOnly);
    this._overflowContainer.classList.toggle("notebook-editor-editable", !this.viewModel.options.isReadOnly);
    this.getDomNode().classList.toggle("notebook-editor-editable", !this.viewModel.options.isReadOnly);
  }
  async _resolveWebview() {
    if (!this.textModel) {
      return null;
    }
    if (this._webviewResolvePromise) {
      return this._webviewResolvePromise;
    }
    if (!this._webview) {
      this._ensureWebview(this.getId(), this.textModel.viewType, this.textModel.uri);
    }
    this._webviewResolvePromise = (async () => {
      if (!this._webview) {
        throw new Error("Notebook output webview object is not created successfully.");
      }
      await this._webview.createWebview(this.creationOptions.codeWindow ?? mainWindow);
      if (!this._webview.webview) {
        throw new Error("Notebook output webview element was not created successfully.");
      }
      this._localStore.add(this._webview.webview.onDidBlur(() => {
        this._outputFocus.set(false);
        this._webviewFocused = false;
        this.updateEditorFocus();
        this.updateCellFocusMode();
      }));
      this._localStore.add(this._webview.webview.onDidFocus(() => {
        this._outputFocus.set(true);
        this.updateEditorFocus();
        this._webviewFocused = true;
      }));
      this._localStore.add(this._webview.onMessage((e) => {
        this._onDidReceiveMessage.fire(e);
      }));
      return this._webview;
    })();
    return this._webviewResolvePromise;
  }
  _ensureWebview(id, viewType, resource) {
    if (this._webview) {
      return;
    }
    const that = this;
    this._webview = this.instantiationService.createInstance(BackLayerWebView, {
      get creationOptions() {
        return that.creationOptions;
      },
      setScrollTop(scrollTop) {
        that._list.scrollTop = scrollTop;
      },
      triggerScroll(event) {
        that._list.triggerScrollFromMouseWheelEvent(event);
      },
      getCellByInfo: that.getCellByInfo.bind(that),
      getCellById: that._getCellById.bind(that),
      toggleNotebookCellSelection: that._toggleNotebookCellSelection.bind(that),
      focusNotebookCell: that.focusNotebookCell.bind(that),
      focusNextNotebookCell: that.focusNextNotebookCell.bind(that),
      updateOutputHeight: that._updateOutputHeight.bind(that),
      scheduleOutputHeightAck: that._scheduleOutputHeightAck.bind(that),
      updateMarkupCellHeight: that._updateMarkupCellHeight.bind(that),
      setMarkupCellEditState: that._setMarkupCellEditState.bind(that),
      didStartDragMarkupCell: that._didStartDragMarkupCell.bind(that),
      didDragMarkupCell: that._didDragMarkupCell.bind(that),
      didDropMarkupCell: that._didDropMarkupCell.bind(that),
      didEndDragMarkupCell: that._didEndDragMarkupCell.bind(that),
      didResizeOutput: that._didResizeOutput.bind(that),
      updatePerformanceMetadata: that._updatePerformanceMetadata.bind(that),
      didFocusOutputInputChange: that._didFocusOutputInputChange.bind(that)
    }, id, viewType, resource, {
      ...this._notebookOptions.computeWebviewOptions(),
      fontFamily: this._generateFontFamily()
    }, this.notebookRendererMessaging.getScoped(this._uuid));
    this._webview.element.style.width = "100%";
    this._list.attachWebview(this._webview.element);
  }
  async _attachModel(textModel, viewType, viewState, perf) {
    this._ensureWebview(this.getId(), textModel.viewType, textModel.uri);
    this.viewModel = this.instantiationService.createInstance(NotebookViewModel, viewType, textModel, this._viewContext, this.getLayoutInfo(), { isReadOnly: this._readOnly });
    this._viewContext.eventDispatcher.emit([new NotebookLayoutChangedEvent({ width: true, fontInfo: true }, this.getLayoutInfo())]);
    this.notebookOptions.updateOptions(this._readOnly);
    this._updateForOptions();
    this._updateForNotebookConfiguration();
    {
      this.viewModel.restoreEditorViewState(viewState);
      const contributionsState = viewState?.contributionsState || {};
      for (const [id, contribution] of this._contributions) {
        if (typeof contribution.restoreViewState === "function") {
          contribution.restoreViewState(contributionsState[id]);
        }
      }
    }
    this._localStore.add(this.viewModel.onDidChangeViewCells((e) => {
      this._onDidChangeViewCells.fire(e);
    }));
    this._localStore.add(this.viewModel.onDidChangeSelection(() => {
      this._onDidChangeSelection.fire();
      this.updateSelectedMarkdownPreviews();
    }));
    this._localStore.add(this._list.onWillScroll((e) => {
      if (this._webview?.isResolved()) {
        this._webviewTransparentCover.style.transform = `translateY(${e.scrollTop})`;
      }
    }));
    let hasPendingChangeContentHeight = false;
    this._localStore.add(this._list.onDidChangeContentHeight(() => {
      if (hasPendingChangeContentHeight) {
        return;
      }
      hasPendingChangeContentHeight = true;
      this._localStore.add(DOM.scheduleAtNextAnimationFrame(DOM.getWindow(this.getDomNode()), () => {
        hasPendingChangeContentHeight = false;
        this._updateScrollHeight();
      }, 100));
    }));
    this._localStore.add(this._list.onDidRemoveOutputs((outputs) => {
      outputs.forEach((output) => this.removeInset(output));
    }));
    this._localStore.add(this._list.onDidHideOutputs((outputs) => {
      outputs.forEach((output) => this.hideInset(output));
    }));
    this._localStore.add(this._list.onDidRemoveCellsFromView((cells) => {
      const hiddenCells = [];
      const deletedCells = [];
      for (const cell of cells) {
        if (cell.cellKind === CellKind.Markup) {
          const mdCell = cell;
          if (this.viewModel?.viewCells.find((cell2) => cell2.handle === mdCell.handle)) {
            hiddenCells.push(mdCell);
          } else {
            deletedCells.push(mdCell);
          }
        }
      }
      this.hideMarkupPreviews(hiddenCells);
      this.deleteMarkupPreviews(deletedCells);
    }));
    await this._warmupWithMarkdownRenderer(this.viewModel, viewState, perf);
    perf?.mark("customMarkdownLoaded");
    this._localCellStateListeners = this.viewModel.viewCells.map((cell) => this._bindCellListener(cell));
    this._lastCellWithEditorFocus = this.viewModel.viewCells.find((viewCell) => this.getActiveCell() === viewCell && viewCell.focusMode === CellFocusMode.Editor) ?? null;
    this._localStore.add(this.viewModel.onDidChangeViewCells((e) => {
      if (this._isDisposed) {
        return;
      }
      [...e.splices].reverse().forEach((splice) => {
        const [start, deleted, newCells] = splice;
        const deletedCells = this._localCellStateListeners.splice(start, deleted, ...newCells.map((cell) => this._bindCellListener(cell)));
        dispose(deletedCells);
      });
      if (e.splices.some((s) => s[2].some((cell) => cell.cellKind === CellKind.Markup))) {
        this._backgroundMarkdownRendering();
      }
    }));
    if (this._dimension) {
      this._list.layout(this.getBodyHeight(this._dimension.height), this._dimension.width);
    } else {
      this._list.layout();
    }
    this._dndController?.clearGlobalDragState();
    this.restoreListViewState(viewState);
  }
  _bindCellListener(cell) {
    const store = new DisposableStore();
    store.add(cell.onDidChangeLayout((e) => {
      if (e.totalHeight || e.outerWidth) {
        this.layoutNotebookCell(cell, cell.layoutInfo.totalHeight, e.context);
      }
    }));
    if (cell.cellKind === CellKind.Code) {
      store.add(cell.onDidRemoveOutputs((outputs) => {
        outputs.forEach((output) => this.removeInset(output));
      }));
    }
    store.add(cell.onDidChangeState((e) => {
      if (e.inputCollapsedChanged && cell.isInputCollapsed && cell.cellKind === CellKind.Markup) {
        this.hideMarkupPreviews([cell]);
      }
      if (e.outputCollapsedChanged && cell.isOutputCollapsed && cell.cellKind === CellKind.Code) {
        cell.outputsViewModels.forEach((output) => this.hideInset(output));
      }
      if (e.focusModeChanged) {
        this._validateCellFocusMode(cell);
      }
    }));
    store.add(cell.onCellDecorationsChanged((e) => {
      e.added.forEach((options) => {
        if (options.className) {
          this.deltaCellContainerClassNames(cell.id, [options.className], [], cell.cellKind);
        }
        if (options.outputClassName) {
          this.deltaCellContainerClassNames(cell.id, [options.outputClassName], [], cell.cellKind);
        }
      });
      e.removed.forEach((options) => {
        if (options.className) {
          this.deltaCellContainerClassNames(cell.id, [], [options.className], cell.cellKind);
        }
        if (options.outputClassName) {
          this.deltaCellContainerClassNames(cell.id, [], [options.outputClassName], cell.cellKind);
        }
      });
    }));
    return store;
  }
  _validateCellFocusMode(cell) {
    if (cell.focusMode !== CellFocusMode.Editor) {
      return;
    }
    if (this._lastCellWithEditorFocus && this._lastCellWithEditorFocus !== cell) {
      this._lastCellWithEditorFocus.focusMode = CellFocusMode.Container;
    }
    this._lastCellWithEditorFocus = cell;
  }
  async _warmupWithMarkdownRenderer(viewModel, viewState, perf) {
    this.logService.debug("NotebookEditorWidget", "warmup " + this.viewModel?.uri.toString());
    await this._resolveWebview();
    perf?.mark("webviewCommLoaded");
    this.logService.debug("NotebookEditorWidget", "warmup - webview resolved");
    this._webview.element.style.visibility = "hidden";
    await this._warmupViewportMarkdownCells(viewModel, viewState);
    this.logService.debug("NotebookEditorWidget", "warmup - viewport warmed up");
    this._list.layout(0, 0);
    this._list.attachViewModel(viewModel);
    this._list.scrollTop = viewState?.scrollPosition?.top ?? 0;
    this._debug("finish initial viewport warmup and view state restore.");
    this._webview.element.style.visibility = "visible";
    this.logService.debug("NotebookEditorWidget", "warmup - list view model attached, set to visible");
    this._onDidAttachViewModel.fire();
  }
  async _warmupViewportMarkdownCells(viewModel, viewState) {
    if (viewState && viewState.cellTotalHeights) {
      const totalHeightCache = viewState.cellTotalHeights;
      const scrollTop = viewState.scrollPosition?.top ?? 0;
      const scrollBottom = scrollTop + Math.max(this._dimension?.height ?? 0, 1080);
      let offset = 0;
      const requests = [];
      for (let i = 0; i < viewModel.length; i++) {
        const cell = viewModel.cellAt(i);
        const cellHeight = totalHeightCache[i] ?? 0;
        if (offset + cellHeight < scrollTop) {
          offset += cellHeight;
          continue;
        }
        if (cell.cellKind === CellKind.Markup) {
          requests.push([cell, offset]);
        }
        offset += cellHeight;
        if (offset > scrollBottom) {
          break;
        }
      }
      await this._webview.initializeMarkup(requests.map(([model, offset2]) => this.createMarkupCellInitialization(model, offset2)));
    } else {
      const initRequests = viewModel.viewCells.filter((cell) => cell.cellKind === CellKind.Markup).slice(0, 5).map((cell) => this.createMarkupCellInitialization(cell, -1e4));
      await this._webview.initializeMarkup(initRequests);
      let offset = 0;
      const offsetUpdateRequests = [];
      const scrollBottom = Math.max(this._dimension?.height ?? 0, 1080);
      for (const cell of viewModel.viewCells) {
        if (cell.cellKind === CellKind.Markup) {
          offsetUpdateRequests.push({ id: cell.id, top: offset });
        }
        offset += cell.getHeight(this.getLayoutInfo().fontInfo.lineHeight);
        if (offset > scrollBottom) {
          break;
        }
      }
      this._webview?.updateScrollTops([], offsetUpdateRequests);
    }
  }
  createMarkupCellInitialization(model, offset) {
    return {
      mime: model.mime,
      cellId: model.id,
      cellHandle: model.handle,
      content: model.getText(),
      offset,
      visible: false,
      metadata: model.metadata
    };
  }
  restoreListViewState(viewState) {
    if (!this.viewModel) {
      return;
    }
    if (viewState?.scrollPosition !== void 0) {
      this._list.scrollTop = viewState.scrollPosition.top;
      this._list.scrollLeft = viewState.scrollPosition.left;
    } else {
      this._list.scrollTop = 0;
      this._list.scrollLeft = 0;
    }
    const focusIdx = typeof viewState?.focus === "number" ? viewState.focus : 0;
    if (focusIdx < this.viewModel.length) {
      const element = this.viewModel.cellAt(focusIdx);
      if (element) {
        this.viewModel?.updateSelectionsState({
          kind: SelectionStateType.Handle,
          primary: element.handle,
          selections: [element.handle]
        });
      }
    } else if (this._list.length > 0) {
      this.viewModel.updateSelectionsState({
        kind: SelectionStateType.Index,
        focus: { start: 0, end: 1 },
        selections: [{ start: 0, end: 1 }]
      });
    }
    if (viewState?.editorFocused) {
      const cell = this.viewModel.cellAt(focusIdx);
      if (cell) {
        cell.focusMode = CellFocusMode.Editor;
      }
    }
  }
  _restoreSelectedKernel(viewState) {
    if (viewState?.selectedKernelId && this.textModel) {
      const matching = this.notebookKernelService.getMatchingKernel(this.textModel);
      const kernel = matching.all.find((k) => k.id === viewState.selectedKernelId);
      if (kernel && !matching.selected) {
        this.notebookKernelService.selectKernelForNotebook(kernel, this.textModel);
      }
    }
  }
  getEditorViewState() {
    const state = this.viewModel?.getEditorViewState();
    if (!state) {
      return {
        editingCells: {},
        cellLineNumberStates: {},
        editorViewStates: {},
        collapsedInputCells: {},
        collapsedOutputCells: {}
      };
    }
    if (this._list) {
      state.scrollPosition = { left: this._list.scrollLeft, top: this._list.scrollTop };
      const cellHeights = {};
      for (let i = 0; i < this.viewModel.length; i++) {
        const elm = this.viewModel.cellAt(i);
        cellHeights[i] = elm.layoutInfo.totalHeight;
      }
      state.cellTotalHeights = cellHeights;
      if (this.viewModel) {
        const focusRange = this.viewModel.getFocus();
        const element = this.viewModel.cellAt(focusRange.start);
        if (element) {
          const itemDOM = this._list.domElementOfElement(element);
          const editorFocused = element.getEditState() === CellEditState.Editing && !!(itemDOM && itemDOM.ownerDocument.activeElement && itemDOM.contains(itemDOM.ownerDocument.activeElement));
          state.editorFocused = editorFocused;
          state.focus = focusRange.start;
        }
      }
    }
    const contributionsState = {};
    for (const [id, contribution] of this._contributions) {
      if (typeof contribution.saveViewState === "function") {
        contributionsState[id] = contribution.saveViewState();
      }
    }
    state.contributionsState = contributionsState;
    if (this.textModel?.uri.scheme === Schemas.untitled) {
      state.selectedKernelId = this.activeKernel?.id;
    }
    return state;
  }
  _allowScrollBeyondLastLine() {
    return this._scrollBeyondLastLine && !this.isReplHistory;
  }
  getBodyHeight(dimensionHeight) {
    return Math.max(dimensionHeight - (this._notebookTopToolbar?.useGlobalToolbar ? (
      /** Toolbar height */
      26
    ) : 0), 0);
  }
  layout(dimension, shadowElement, position) {
    if (!shadowElement && this._shadowElementViewInfo === null) {
      this._dimension = dimension;
      this._position = position;
      return;
    }
    if (dimension.width <= 0 || dimension.height <= 0) {
      this.onWillHide();
      return;
    }
    const whenContainerStylesLoaded = this.layoutService.whenContainerStylesLoaded(DOM.getWindow(this.getDomNode()));
    if (whenContainerStylesLoaded) {
      whenContainerStylesLoaded.then(() => this.layoutNotebook(dimension, shadowElement, position));
    } else {
      this.layoutNotebook(dimension, shadowElement, position);
    }
  }
  layoutNotebook(dimension, shadowElement, position) {
    if (shadowElement) {
      this.updateShadowElement(shadowElement, dimension, position);
    }
    if (this._shadowElementViewInfo && this._shadowElementViewInfo.width <= 0 && this._shadowElementViewInfo.height <= 0) {
      this.onWillHide();
      return;
    }
    this._dimension = dimension;
    this._position = position;
    const newBodyHeight = this.getBodyHeight(dimension.height) - this.getLayoutInfo().stickyHeight;
    DOM.size(this._body, dimension.width, newBodyHeight);
    const newCellListHeight = newBodyHeight;
    if (this._list.getRenderHeight() < newCellListHeight) {
      this._list.updateOptions({ paddingBottom: this._allowScrollBeyondLastLine() ? Math.max(0, newCellListHeight - 50) : 0, paddingTop: 0 });
      this._list.layout(newCellListHeight, dimension.width);
    } else {
      this._list.layout(newCellListHeight, dimension.width);
      this._list.updateOptions({ paddingBottom: this._allowScrollBeyondLastLine() ? Math.max(0, newCellListHeight - 50) : 0, paddingTop: 0 });
    }
    this._overlayContainer.inert = false;
    this._overlayContainer.style.visibility = "visible";
    this._overlayContainer.style.display = "block";
    this._overlayContainer.style.position = "absolute";
    this._overlayContainer.style.overflow = "hidden";
    this.layoutContainerOverShadowElement(dimension, position);
    if (this._webviewTransparentCover) {
      this._webviewTransparentCover.style.height = `${dimension.height}px`;
      this._webviewTransparentCover.style.width = `${dimension.width}px`;
    }
    this._notebookTopToolbar.layout(this._dimension);
    this._notebookOverviewRuler.layout();
    this._viewContext?.eventDispatcher.emit([new NotebookLayoutChangedEvent({ width: true, fontInfo: true }, this.getLayoutInfo())]);
  }
  updateShadowElement(shadowElement, dimension, position) {
    this._shadowElement = shadowElement;
    if (dimension && position) {
      this._shadowElementViewInfo = {
        height: dimension.height,
        width: dimension.width,
        top: position.top,
        left: position.left
      };
    } else {
      const containerRect = shadowElement.getBoundingClientRect();
      this._shadowElementViewInfo = {
        height: containerRect.height,
        width: containerRect.width,
        top: containerRect.top,
        left: containerRect.left
      };
    }
  }
  layoutContainerOverShadowElement(dimension, position) {
    if (dimension && position) {
      this._overlayContainer.style.top = `${position.top}px`;
      this._overlayContainer.style.left = `${position.left}px`;
      this._overlayContainer.style.width = `${dimension.width}px`;
      this._overlayContainer.style.height = `${dimension.height}px`;
      return;
    }
    if (!this._shadowElementViewInfo) {
      return;
    }
    const elementContainerRect = this._overlayContainer.parentElement?.getBoundingClientRect();
    this._overlayContainer.style.top = `${this._shadowElementViewInfo.top - (elementContainerRect?.top || 0)}px`;
    this._overlayContainer.style.left = `${this._shadowElementViewInfo.left - (elementContainerRect?.left || 0)}px`;
    this._overlayContainer.style.width = `${dimension ? dimension.width : this._shadowElementViewInfo.width}px`;
    this._overlayContainer.style.height = `${dimension ? dimension.height : this._shadowElementViewInfo.height}px`;
  }
  //#endregion
  //#region Focus tracker
  focus() {
    this._isVisible = true;
    this._editorFocus.set(true);
    if (this._webviewFocused) {
      this._webview?.focusWebview();
    } else {
      if (this.viewModel) {
        const focusRange = this.viewModel.getFocus();
        const element = this.viewModel.cellAt(focusRange.start);
        if (!this.hasEditorFocus()) {
          this.focusContainer();
          this.updateEditorFocus();
        }
        if (element && element.focusMode === CellFocusMode.Editor) {
          element.updateEditState(CellEditState.Editing, "editorWidget.focus");
          element.focusMode = CellFocusMode.Editor;
          this.focusEditor(element);
          return;
        }
      }
      this._list.domFocus();
    }
    if (this._currentProgress) {
      this.showProgress();
    }
  }
  onShow() {
    this._isVisible = true;
  }
  focusEditor(activeElement) {
    for (const [element, editor] of this._renderedEditors.entries()) {
      if (element === activeElement) {
        editor.focus();
        return;
      }
    }
  }
  focusContainer(clearSelection = false) {
    if (this._webviewFocused) {
      this._webview?.focusWebview();
    } else {
      this._list.focusContainer(clearSelection);
    }
  }
  selectOutputContent(cell) {
    this._webview?.selectOutputContents(cell);
  }
  selectInputContents(cell) {
    this._webview?.selectInputContents(cell);
  }
  onWillHide() {
    this._isVisible = false;
    this._editorFocus.set(false);
    this._overlayContainer.inert = true;
    this._overlayContainer.style.visibility = "hidden";
    this._overlayContainer.style.left = "-50000px";
    this._notebookTopToolbarContainer.style.display = "none";
    this.clearActiveCellWidgets();
  }
  clearActiveCellWidgets() {
    this._renderedEditors.forEach((editor, cell) => {
      if (this.getActiveCell() === cell && editor) {
        SuggestController.get(editor)?.cancelSuggestWidget();
        DropIntoEditorController.get(editor)?.clearWidgets();
        CopyPasteController.get(editor)?.clearWidgets();
      }
    });
    this._renderedEditors.forEach((editor, cell) => {
      const controller = InlineCompletionsController.get(editor);
      if (controller?.model.get()?.inlineEditState.get()) {
        editor.render(true);
      }
    });
  }
  editorHasDomFocus() {
    return DOM.isAncestorOfActiveElement(this.getDomNode());
  }
  updateEditorFocus() {
    this._focusTracker.refreshState();
    const focused = this.editorHasDomFocus();
    this._editorFocus.set(focused);
    this.viewModel?.setEditorFocus(focused);
  }
  updateCellFocusMode() {
    const activeCell = this.getActiveCell();
    if (activeCell?.focusMode === CellFocusMode.Output && !this._webviewFocused) {
      activeCell.focusMode = CellFocusMode.Container;
    }
  }
  hasEditorFocus() {
    this.updateEditorFocus();
    return this.editorHasDomFocus();
  }
  hasWebviewFocus() {
    return this._webviewFocused;
  }
  hasOutputTextSelection() {
    if (!this.hasEditorFocus()) {
      return false;
    }
    const windowSelection = DOM.getWindow(this.getDomNode()).getSelection();
    if (windowSelection?.rangeCount !== 1) {
      return false;
    }
    const activeSelection = windowSelection.getRangeAt(0);
    if (activeSelection.startContainer === activeSelection.endContainer && activeSelection.endOffset - activeSelection.startOffset === 0) {
      return false;
    }
    let container = activeSelection.commonAncestorContainer;
    if (!this._body.contains(container)) {
      return false;
    }
    while (container && container !== this._body) {
      if (container.classList && container.classList.contains("output")) {
        return true;
      }
      container = container.parentNode;
    }
    return false;
  }
  _didFocusOutputInputChange(hasFocus) {
    this._outputInputFocus.set(hasFocus);
  }
  //#endregion
  //#region Editor Features
  focusElement(cell) {
    this.viewModel?.updateSelectionsState({
      kind: SelectionStateType.Handle,
      primary: cell.handle,
      selections: [cell.handle]
    });
  }
  get scrollTop() {
    return this._list.scrollTop;
  }
  get scrollBottom() {
    return this._list.scrollTop + this._list.getRenderHeight();
  }
  getAbsoluteTopOfElement(cell) {
    return this._list.getCellViewScrollTop(cell);
  }
  getHeightOfElement(cell) {
    return this._list.elementHeight(cell);
  }
  scrollToBottom() {
    this._list.scrollToBottom();
  }
  setScrollTop(scrollTop) {
    this._list.scrollTop = scrollTop;
  }
  revealCellRangeInView(range) {
    return this._list.revealCells(range);
  }
  revealInView(cell) {
    return this._list.revealCell(cell, CellRevealType.Default);
  }
  revealInViewAtTop(cell) {
    this._list.revealCell(cell, CellRevealType.Top);
  }
  revealInCenter(cell) {
    this._list.revealCell(cell, CellRevealType.Center);
  }
  async revealInCenterIfOutsideViewport(cell) {
    await this._list.revealCell(cell, CellRevealType.CenterIfOutsideViewport);
  }
  async revealFirstLineIfOutsideViewport(cell) {
    await this._list.revealCell(cell, CellRevealType.FirstLineIfOutsideViewport);
  }
  async revealLineInViewAsync(cell, line) {
    return this._list.revealRangeInCell(cell, new Range(line, 1, line, 1), CellRevealRangeType.Default);
  }
  async revealLineInCenterAsync(cell, line) {
    return this._list.revealRangeInCell(cell, new Range(line, 1, line, 1), CellRevealRangeType.Center);
  }
  async revealLineInCenterIfOutsideViewportAsync(cell, line) {
    return this._list.revealRangeInCell(cell, new Range(line, 1, line, 1), CellRevealRangeType.CenterIfOutsideViewport);
  }
  async revealRangeInViewAsync(cell, range) {
    return this._list.revealRangeInCell(cell, range, CellRevealRangeType.Default);
  }
  async revealRangeInCenterAsync(cell, range) {
    return this._list.revealRangeInCell(cell, range, CellRevealRangeType.Center);
  }
  async revealRangeInCenterIfOutsideViewportAsync(cell, range) {
    return this._list.revealRangeInCell(cell, range, CellRevealRangeType.CenterIfOutsideViewport);
  }
  revealCellOffsetInCenter(cell, offset) {
    return this._list.revealCellOffsetInCenter(cell, offset);
  }
  revealOffsetInCenterIfOutsideViewport(offset) {
    return this._list.revealOffsetInCenterIfOutsideViewport(offset);
  }
  getViewIndexByModelIndex(index) {
    if (!this._listViewInfoAccessor) {
      return -1;
    }
    const cell = this.viewModel?.viewCells[index];
    if (!cell) {
      return -1;
    }
    return this._listViewInfoAccessor.getViewIndex(cell);
  }
  getViewHeight(cell) {
    if (!this._listViewInfoAccessor) {
      return -1;
    }
    return this._listViewInfoAccessor.getViewHeight(cell);
  }
  getCellRangeFromViewRange(startIndex, endIndex) {
    return this._listViewInfoAccessor.getCellRangeFromViewRange(startIndex, endIndex);
  }
  getCellsInRange(range) {
    return this._listViewInfoAccessor.getCellsInRange(range);
  }
  setCellEditorSelection(cell, range) {
    this._list.setCellEditorSelection(cell, range);
  }
  setHiddenAreas(_ranges) {
    return this._list.setHiddenAreas(_ranges, true);
  }
  getVisibleRangesPlusViewportAboveAndBelow() {
    return this._listViewInfoAccessor.getVisibleRangesPlusViewportAboveAndBelow();
  }
  //#endregion
  //#region Decorations
  deltaCellDecorations(oldDecorations, newDecorations) {
    const ret = this.viewModel?.deltaCellDecorations(oldDecorations, newDecorations) || [];
    this._onDidChangeDecorations.fire();
    return ret;
  }
  deltaCellContainerClassNames(cellId, added, removed, cellkind) {
    if (cellkind === CellKind.Markup) {
      this._webview?.deltaMarkupPreviewClassNames(cellId, added, removed);
    } else {
      this._webview?.deltaCellOutputContainerClassNames(cellId, added, removed);
    }
  }
  changeModelDecorations(callback) {
    return this.viewModel?.changeModelDecorations(callback) || null;
  }
  //#endregion
  //#region View Zones
  changeViewZones(callback) {
    this._list.changeViewZones(callback);
    this._onDidChangeLayout.fire();
  }
  getViewZoneLayoutInfo(id) {
    return this._list.getViewZoneLayoutInfo(id);
  }
  //#endregion
  //#region Overlay
  changeCellOverlays(callback) {
    this._list.changeCellOverlays(callback);
  }
  //#endregion
  //#region Kernel/Execution
  async _loadKernelPreloads() {
    if (!this.hasModel()) {
      return;
    }
    const { selected } = this.notebookKernelService.getMatchingKernel(this.textModel);
    if (!this._webview?.isResolved()) {
      await this._resolveWebview();
    }
    this._webview?.updateKernelPreloads(selected);
  }
  get activeKernel() {
    return this.textModel && this.notebookKernelService.getSelectedOrSuggestedKernel(this.textModel);
  }
  async cancelNotebookCells(cells) {
    if (!this.viewModel || !this.hasModel()) {
      return;
    }
    if (!cells) {
      cells = this.viewModel.viewCells;
    }
    return this.notebookExecutionService.cancelNotebookCellHandles(this.textModel, Array.from(cells).map((cell) => cell.handle));
  }
  async executeNotebookCells(cells) {
    if (!this.viewModel || !this.hasModel()) {
      this.logService.info("notebookEditorWidget", "No NotebookViewModel, cannot execute cells");
      return;
    }
    if (!cells) {
      cells = this.viewModel.viewCells;
    }
    return this.notebookExecutionService.executeNotebookCells(this.textModel, Array.from(cells).map((c) => c.model), this.scopedContextKeyService);
  }
  async layoutNotebookCell(cell, height, context) {
    this._debug("layout cell", cell.handle, height);
    const viewIndex = this._list.getViewIndex(cell);
    if (viewIndex === void 0) {
      return;
    }
    if (this._pendingLayouts?.has(cell)) {
      this._pendingLayouts?.get(cell).dispose();
    }
    const deferred = new DeferredPromise();
    const doLayout = () => {
      if (this._isDisposed) {
        return;
      }
      if (!this.viewModel?.hasCell(cell)) {
        return;
      }
      if (this._list.getViewIndex(cell) === void 0) {
        return;
      }
      if (this._list.elementHeight(cell) === height) {
        return;
      }
      const pendingLayout = this._pendingLayouts?.get(cell);
      this._pendingLayouts?.delete(cell);
      if (!this.hasEditorFocus()) {
        const cellIndex = this.viewModel?.getCellIndex(cell);
        const visibleRanges = this.visibleRanges;
        if (cellIndex !== void 0 && visibleRanges && visibleRanges.length && visibleRanges[0].start === cellIndex && this._list.scrollTop > this.getAbsoluteTopOfElement(cell)) {
          return this._list.updateElementHeight2(cell, height, Math.min(cellIndex + 1, this.getLength() - 1));
        }
      }
      this._list.updateElementHeight2(cell, height);
      deferred.complete(void 0);
      if (pendingLayout) {
        pendingLayout.dispose();
        this._layoutDisposables.delete(pendingLayout);
      }
    };
    if (this._list.inRenderingTransaction) {
      const layoutDisposable = DOM.scheduleAtNextAnimationFrame(DOM.getWindow(this.getDomNode()), doLayout);
      const disposable = toDisposable(() => {
        layoutDisposable.dispose();
        deferred.complete(void 0);
      });
      this._pendingLayouts?.set(cell, disposable);
      this._layoutDisposables.add(disposable);
    } else {
      doLayout();
    }
    return deferred.p;
  }
  getActiveCell() {
    const elements = this._list.getFocusedElements();
    if (elements && elements.length) {
      return elements[0];
    }
    return void 0;
  }
  _toggleNotebookCellSelection(selectedCell, selectFromPrevious) {
    const currentSelections = this._list.getSelectedElements();
    const isSelected = currentSelections.includes(selectedCell);
    const previousSelection = selectFromPrevious ? currentSelections[currentSelections.length - 1] ?? selectedCell : selectedCell;
    const selectedIndex = this._list.getViewIndex(selectedCell);
    const previousIndex = this._list.getViewIndex(previousSelection);
    const cellsInSelectionRange = this.getCellsInViewRange(selectedIndex, previousIndex);
    if (isSelected) {
      this._list.selectElements(currentSelections.filter((current) => !cellsInSelectionRange.includes(current)));
    } else {
      this.focusElement(selectedCell);
      this._list.selectElements([...currentSelections.filter((current) => !cellsInSelectionRange.includes(current)), ...cellsInSelectionRange]);
    }
  }
  getCellsInViewRange(fromInclusive, toInclusive) {
    const selectedCellsInRange = [];
    for (let index = 0; index < this._list.length; ++index) {
      const cell = this._list.element(index);
      if (cell) {
        if (index >= fromInclusive && index <= toInclusive || index >= toInclusive && index <= fromInclusive) {
          selectedCellsInRange.push(cell);
        }
      }
    }
    return selectedCellsInRange;
  }
  async focusNotebookCell(cell, focusItem, options) {
    if (this._isDisposed) {
      return;
    }
    cell.focusedOutputId = void 0;
    if (focusItem === "editor") {
      cell.isInputCollapsed = false;
      this.focusElement(cell);
      this._list.focusView();
      cell.updateEditState(CellEditState.Editing, "focusNotebookCell");
      cell.focusMode = CellFocusMode.Editor;
      if (!options?.skipReveal) {
        if (typeof options?.focusEditorLine === "number") {
          this._cursorNavMode.set(true);
          await this.revealLineInViewAsync(cell, options.focusEditorLine);
          const editor = this._renderedEditors.get(cell);
          const focusEditorLine = options.focusEditorLine;
          editor?.setSelection({
            startLineNumber: focusEditorLine,
            startColumn: 1,
            endLineNumber: focusEditorLine,
            endColumn: 1
          });
        } else {
          const selectionsStartPosition = cell.getSelectionsStartPosition();
          if (selectionsStartPosition?.length) {
            const firstSelectionPosition = selectionsStartPosition[0];
            await this.revealRangeInViewAsync(cell, Range.fromPositions(firstSelectionPosition, firstSelectionPosition));
          } else {
            await this.revealInView(cell);
          }
        }
      }
    } else if (focusItem === "output") {
      this.focusElement(cell);
      if (!this.hasEditorFocus()) {
        this._list.focusView();
      }
      if (!this._webview) {
        return;
      }
      const firstOutputId = cell.outputsViewModels.find((o) => o.model.alternativeOutputId)?.model.alternativeOutputId;
      const focusElementId = options?.outputId ?? firstOutputId ?? cell.id;
      this._webview.focusOutput(focusElementId, options?.altOutputId, options?.outputWebviewFocused || this._webviewFocused);
      cell.updateEditState(CellEditState.Preview, "focusNotebookCell");
      cell.focusMode = CellFocusMode.Output;
      cell.focusedOutputId = options?.outputId;
      this._outputFocus.set(true);
      if (!options?.skipReveal) {
        this.revealInCenterIfOutsideViewport(cell);
      }
    } else {
      const itemDOM = this._list.domElementOfElement(cell);
      if (itemDOM && itemDOM.ownerDocument.activeElement && itemDOM.contains(itemDOM.ownerDocument.activeElement)) {
        itemDOM.ownerDocument.activeElement.blur();
      }
      this._webview?.blurOutput();
      cell.updateEditState(CellEditState.Preview, "focusNotebookCell");
      cell.focusMode = CellFocusMode.Container;
      this.focusElement(cell);
      if (!options?.skipReveal) {
        if (typeof options?.focusEditorLine === "number") {
          this._cursorNavMode.set(true);
          await this.revealInView(cell);
        } else if (options?.revealBehavior === ScrollToRevealBehavior.firstLine) {
          await this.revealFirstLineIfOutsideViewport(cell);
        } else if (options?.revealBehavior === ScrollToRevealBehavior.fullCell) {
          await this.revealInView(cell);
        } else {
          await this.revealInCenterIfOutsideViewport(cell);
        }
      }
      this._list.focusView();
      this.updateEditorFocus();
    }
  }
  async focusNextNotebookCell(cell, focusItem) {
    const idx = this.viewModel?.getCellIndex(cell);
    if (typeof idx !== "number") {
      return;
    }
    const newCell = this.viewModel?.cellAt(idx + 1);
    if (!newCell) {
      return;
    }
    await this.focusNotebookCell(newCell, focusItem);
  }
  //#endregion
  //#region Find
  async _warmupCell(viewCell) {
    if (viewCell.isOutputCollapsed) {
      return;
    }
    const outputs = viewCell.outputsViewModels;
    for (const output of outputs.slice(0, outputDisplayLimit)) {
      const [mimeTypes, pick] = output.resolveMimeTypes(this.textModel, void 0);
      if (!mimeTypes.find((mimeType) => mimeType.isTrusted) || mimeTypes.length === 0) {
        continue;
      }
      const pickedMimeTypeRenderer = mimeTypes[pick];
      if (!pickedMimeTypeRenderer) {
        return;
      }
      const renderer = this._notebookService.getRendererInfo(pickedMimeTypeRenderer.rendererId);
      if (!renderer) {
        return;
      }
      const result = { type: RenderOutputType.Extension, renderer, source: output, mimeType: pickedMimeTypeRenderer.mimeType };
      const inset = this._webview?.insetMapping.get(result.source);
      if (!inset || !inset.initialized) {
        const p = new Promise((resolve) => {
          this._register(Event.any(this.onDidRenderOutput, this.onDidRemoveOutput)((e) => {
            if (e.model === result.source.model) {
              resolve();
            }
          }));
        });
        this.createOutput(viewCell, result, 0, false);
        await p;
      } else {
        this.createOutput(viewCell, result, 0, false);
      }
      return;
    }
  }
  async _warmupAll(includeOutput) {
    if (!this.hasModel() || !this.viewModel) {
      return;
    }
    const cells = this.viewModel.viewCells;
    const requests = [];
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].cellKind === CellKind.Markup && !this._webview.markupPreviewMapping.has(cells[i].id)) {
        requests.push(this.createMarkupPreview(cells[i]));
      }
    }
    if (includeOutput && this._list) {
      for (let i = 0; i < this._list.length; i++) {
        const cell = this._list.element(i);
        if (cell?.cellKind === CellKind.Code) {
          requests.push(this._warmupCell(cell));
        }
      }
    }
    return Promise.all(requests);
  }
  async _warmupSelection(includeOutput, selectedCellRanges) {
    if (!this.hasModel() || !this.viewModel) {
      return;
    }
    const cells = this.viewModel.viewCells;
    const requests = [];
    for (const range of selectedCellRanges) {
      for (let i = range.start; i < range.end; i++) {
        if (cells[i].cellKind === CellKind.Markup && !this._webview.markupPreviewMapping.has(cells[i].id)) {
          requests.push(this.createMarkupPreview(cells[i]));
        }
      }
    }
    if (includeOutput && this._list) {
      for (const range of selectedCellRanges) {
        for (let i = range.start; i < range.end; i++) {
          const cell = this._list.element(i);
          if (cell?.cellKind === CellKind.Code) {
            requests.push(this._warmupCell(cell));
          }
        }
      }
    }
    return Promise.all(requests);
  }
  async find(query, options, token, skipWarmup = false, shouldGetSearchPreviewInfo = false, ownerID) {
    if (!this._notebookViewModel) {
      return [];
    }
    if (!ownerID) {
      ownerID = this.getId();
    }
    const findMatches = this._notebookViewModel.find(query, options).filter((match) => match.length > 0);
    if (!options.includeMarkupPreview && !options.includeOutput || options.findScope?.findScopeType === NotebookFindScopeType.Text) {
      this._webview?.findStop(ownerID);
      return findMatches;
    }
    const matchMap = {};
    findMatches.forEach((match) => {
      matchMap[match.cell.id] = match;
    });
    if (this._webview) {
      const start = Date.now();
      if (options.findScope && options.findScope.findScopeType === NotebookFindScopeType.Cells && options.findScope.selectedCellRanges) {
        await this._warmupSelection(!!options.includeOutput, options.findScope.selectedCellRanges);
      } else {
        await this._warmupAll(!!options.includeOutput);
      }
      const end = Date.now();
      this.logService.debug("Find", `Warmup time: ${end - start}ms`);
      if (token.isCancellationRequested) {
        return [];
      }
      let findIds = [];
      if (options.findScope && options.findScope.findScopeType === NotebookFindScopeType.Cells && options.findScope.selectedCellRanges) {
        const selectedIndexes = cellRangesToIndexes(options.findScope.selectedCellRanges);
        findIds = selectedIndexes.map((index) => this._notebookViewModel?.viewCells[index].id ?? "");
      }
      const webviewMatches = await this._webview.find(query, { caseSensitive: options.caseSensitive, wholeWord: options.wholeWord, includeMarkup: !!options.includeMarkupPreview, includeOutput: !!options.includeOutput, shouldGetSearchPreviewInfo, ownerID, findIds });
      if (token.isCancellationRequested) {
        return [];
      }
      webviewMatches.forEach((match) => {
        const cell = this._notebookViewModel.viewCells.find((cell2) => cell2.id === match.cellId);
        if (!cell) {
          return;
        }
        if (match.type === "preview") {
          if (cell.getEditState() === CellEditState.Preview && !options.includeMarkupPreview) {
            return;
          }
          if (cell.getEditState() === CellEditState.Editing && options.includeMarkupInput) {
            return;
          }
        } else {
          if (!options.includeOutput) {
            return;
          }
        }
        const exisitingMatch = matchMap[match.cellId];
        if (exisitingMatch) {
          exisitingMatch.webviewMatches.push(match);
        } else {
          matchMap[match.cellId] = new CellFindMatchModel(
            this._notebookViewModel.viewCells.find((cell2) => cell2.id === match.cellId),
            this._notebookViewModel.viewCells.findIndex((cell2) => cell2.id === match.cellId),
            [],
            [match]
          );
        }
      });
    }
    const ret = [];
    this._notebookViewModel.viewCells.forEach((cell, index) => {
      if (matchMap[cell.id]) {
        ret.push(new CellFindMatchModel(cell, index, matchMap[cell.id].contentMatches, matchMap[cell.id].webviewMatches));
      }
    });
    return ret;
  }
  async findHighlightCurrent(matchIndex, ownerID) {
    if (!this._webview) {
      return 0;
    }
    return this._webview?.findHighlightCurrent(matchIndex, ownerID ?? this.getId());
  }
  async findUnHighlightCurrent(matchIndex, ownerID) {
    if (!this._webview) {
      return;
    }
    return this._webview?.findUnHighlightCurrent(matchIndex, ownerID ?? this.getId());
  }
  findStop(ownerID) {
    this._webview?.findStop(ownerID ?? this.getId());
  }
  //#endregion
  //#region MISC
  getLayoutInfo() {
    if (!this._list) {
      throw new Error("Editor is not initalized successfully");
    }
    if (!this._fontInfo) {
      this._generateFontInfo();
    }
    return {
      width: this._dimension?.width ?? 0,
      height: this._dimension?.height ?? 0,
      scrollHeight: this._list?.getScrollHeight() ?? 0,
      fontInfo: this._fontInfo,
      stickyHeight: this._notebookStickyScroll?.getCurrentStickyHeight() ?? 0
    };
  }
  async createMarkupPreview(cell) {
    if (!this._webview) {
      return;
    }
    if (!this._webview.isResolved()) {
      await this._resolveWebview();
    }
    if (!this._webview || !this._list.webviewElement) {
      return;
    }
    if (!this.viewModel || !this._list.viewModel) {
      return;
    }
    if (this.viewModel.getCellIndex(cell) === -1) {
      return;
    }
    if (this.cellIsHidden(cell)) {
      return;
    }
    const webviewTop = parseInt(this._list.webviewElement.domNode.style.top, 10);
    const top = !!webviewTop ? 0 - webviewTop : 0;
    const cellTop = this._list.getCellViewScrollTop(cell);
    await this._webview.showMarkupPreview({
      mime: cell.mime,
      cellHandle: cell.handle,
      cellId: cell.id,
      content: cell.getText(),
      offset: cellTop + top,
      visible: true,
      metadata: cell.metadata
    });
  }
  cellIsHidden(cell) {
    const modelIndex = this.viewModel.getCellIndex(cell);
    const foldedRanges = this.viewModel.getHiddenRanges();
    return foldedRanges.some((range) => modelIndex >= range.start && modelIndex <= range.end);
  }
  async unhideMarkupPreviews(cells) {
    if (!this._webview) {
      return;
    }
    if (!this._webview.isResolved()) {
      await this._resolveWebview();
    }
    await this._webview?.unhideMarkupPreviews(cells.map((cell) => cell.id));
  }
  async hideMarkupPreviews(cells) {
    if (!this._webview || !cells.length) {
      return;
    }
    if (!this._webview.isResolved()) {
      await this._resolveWebview();
    }
    await this._webview?.hideMarkupPreviews(cells.map((cell) => cell.id));
  }
  async deleteMarkupPreviews(cells) {
    if (!this._webview) {
      return;
    }
    if (!this._webview.isResolved()) {
      await this._resolveWebview();
    }
    await this._webview?.deleteMarkupPreviews(cells.map((cell) => cell.id));
  }
  async updateSelectedMarkdownPreviews() {
    if (!this._webview) {
      return;
    }
    if (!this._webview.isResolved()) {
      await this._resolveWebview();
    }
    const selectedCells = this.getSelectionViewModels().map((cell) => cell.id);
    await this._webview?.updateMarkupPreviewSelections(selectedCells.length > 1 ? selectedCells : []);
  }
  async createOutput(cell, output, offset, createWhenIdle) {
    this._insetModifyQueueByOutputId.queue(output.source.model.outputId, async () => {
      if (this._isDisposed || !this._webview) {
        return;
      }
      if (!this._webview.isResolved()) {
        await this._resolveWebview();
      }
      if (!this._webview) {
        return;
      }
      if (!this._list.webviewElement) {
        return;
      }
      if (output.type === RenderOutputType.Extension) {
        this.notebookRendererMessaging.prepare(output.renderer.id);
      }
      const webviewTop = parseInt(this._list.webviewElement.domNode.style.top, 10);
      const top = !!webviewTop ? 0 - webviewTop : 0;
      const cellTop = this._list.getCellViewScrollTop(cell) + top;
      const existingOutput = this._webview.insetMapping.get(output.source);
      if (!existingOutput || !existingOutput.renderer && output.type === RenderOutputType.Extension) {
        if (createWhenIdle) {
          this._webview.requestCreateOutputWhenWebviewIdle({ cellId: cell.id, cellHandle: cell.handle, cellUri: cell.uri, executionId: cell.internalMetadata.executionId }, output, cellTop, offset);
        } else {
          this._webview.createOutput({ cellId: cell.id, cellHandle: cell.handle, cellUri: cell.uri, executionId: cell.internalMetadata.executionId }, output, cellTop, offset);
        }
      } else if (existingOutput.renderer && output.type === RenderOutputType.Extension && existingOutput.renderer.id !== output.renderer.id) {
        this._webview.removeInsets([output.source]);
        this._webview.createOutput({ cellId: cell.id, cellHandle: cell.handle, cellUri: cell.uri }, output, cellTop, offset);
      } else if (existingOutput.versionId !== output.source.model.versionId) {
        this._webview.updateOutput({ cellId: cell.id, cellHandle: cell.handle, cellUri: cell.uri, executionId: cell.internalMetadata.executionId }, output, cellTop, offset);
      } else {
        const outputIndex = cell.outputsViewModels.indexOf(output.source);
        const outputOffset = cell.getOutputOffset(outputIndex);
        this._webview.updateScrollTops([{
          cell,
          output: output.source,
          cellTop,
          outputOffset,
          forceDisplay: !cell.isOutputCollapsed
        }], []);
      }
    });
  }
  async updateOutput(cell, output, offset) {
    this._insetModifyQueueByOutputId.queue(output.source.model.outputId, async () => {
      if (this._isDisposed || !this._webview || cell.isOutputCollapsed) {
        return;
      }
      if (!this._webview.isResolved()) {
        await this._resolveWebview();
      }
      if (!this._webview || !this._list.webviewElement) {
        return;
      }
      if (!this._webview.insetMapping.has(output.source)) {
        return this.createOutput(cell, output, offset, false);
      }
      if (output.type === RenderOutputType.Extension) {
        this.notebookRendererMessaging.prepare(output.renderer.id);
      }
      const webviewTop = parseInt(this._list.webviewElement.domNode.style.top, 10);
      const top = !!webviewTop ? 0 - webviewTop : 0;
      const cellTop = this._list.getCellViewScrollTop(cell) + top;
      this._webview.updateOutput({ cellId: cell.id, cellHandle: cell.handle, cellUri: cell.uri }, output, cellTop, offset);
    });
  }
  async copyOutputImage(cellOutput) {
    this._webview?.copyImage(cellOutput);
  }
  removeInset(output) {
    this._insetModifyQueueByOutputId.queue(output.model.outputId, async () => {
      if (this._isDisposed || !this._webview) {
        return;
      }
      if (this._webview?.isResolved()) {
        this._webview.removeInsets([output]);
      }
      this._onDidRemoveOutput.fire(output);
    });
  }
  hideInset(output) {
    this._insetModifyQueueByOutputId.queue(output.model.outputId, async () => {
      if (this._isDisposed || !this._webview) {
        return;
      }
      if (this._webview?.isResolved()) {
        this._webview.hideInset(output);
      }
    });
  }
  //#region --- webview IPC ----
  postMessage(message) {
    if (this._webview?.isResolved()) {
      this._webview.postKernelMessage(message);
    }
  }
  //#endregion
  addClassName(className) {
    this._overlayContainer.classList.add(className);
  }
  removeClassName(className) {
    this._overlayContainer.classList.remove(className);
  }
  cellAt(index) {
    return this.viewModel?.cellAt(index);
  }
  getCellByInfo(cellInfo) {
    const { cellHandle } = cellInfo;
    return this.viewModel?.viewCells.find((vc) => vc.handle === cellHandle);
  }
  getCellByHandle(handle) {
    return this.viewModel?.getCellByHandle(handle);
  }
  getCellIndex(cell) {
    return this.viewModel?.getCellIndexByHandle(cell.handle);
  }
  getNextVisibleCellIndex(index) {
    return this.viewModel?.getNextVisibleCellIndex(index);
  }
  getPreviousVisibleCellIndex(index) {
    return this.viewModel?.getPreviousVisibleCellIndex(index);
  }
  _updateScrollHeight() {
    if (this._isDisposed || !this._webview?.isResolved()) {
      return;
    }
    if (!this._list.webviewElement) {
      return;
    }
    const scrollHeight = this._list.scrollHeight;
    this._webview.element.style.height = `${scrollHeight + NOTEBOOK_WEBVIEW_BOUNDARY * 2}px`;
    const webviewTop = parseInt(this._list.webviewElement.domNode.style.top, 10);
    const top = !!webviewTop ? 0 - webviewTop : 0;
    const updateItems = [];
    const removedItems = [];
    this._webview?.insetMapping.forEach((value, key) => {
      const cell = this.viewModel?.getCellByHandle(value.cellInfo.cellHandle);
      if (!cell || !(cell instanceof CodeCellViewModel)) {
        return;
      }
      this.viewModel?.viewCells.find((cell2) => cell2.handle === value.cellInfo.cellHandle);
      const viewIndex = this._list.getViewIndex(cell);
      if (viewIndex === void 0) {
        return;
      }
      if (cell.outputsViewModels.indexOf(key) < 0) {
        removedItems.push(key);
      }
      const cellTop = this._list.getCellViewScrollTop(cell);
      const outputIndex = cell.outputsViewModels.indexOf(key);
      const outputOffset = cell.getOutputOffset(outputIndex);
      updateItems.push({
        cell,
        output: key,
        cellTop: cellTop + top,
        outputOffset,
        forceDisplay: false
      });
    });
    this._webview.removeInsets(removedItems);
    const markdownUpdateItems = [];
    for (const cellId of this._webview.markupPreviewMapping.keys()) {
      const cell = this.viewModel?.viewCells.find((cell2) => cell2.id === cellId);
      if (cell) {
        const cellTop = this._list.getCellViewScrollTop(cell);
        markdownUpdateItems.push({ id: cellId, top: cellTop + top });
      }
    }
    if (markdownUpdateItems.length || updateItems.length) {
      this._debug("_list.onDidChangeContentHeight/markdown", markdownUpdateItems);
      this._webview?.updateScrollTops(updateItems, markdownUpdateItems);
    }
  }
  //#endregion
  //#region BacklayerWebview delegate
  _updateOutputHeight(cellInfo, output, outputHeight, isInit, source) {
    const cell = this.viewModel?.viewCells.find((vc) => vc.handle === cellInfo.cellHandle);
    if (cell && cell instanceof CodeCellViewModel) {
      const outputIndex = cell.outputsViewModels.indexOf(output);
      if (outputIndex > -1) {
        this._debug("update cell output", cell.handle, outputHeight);
        cell.updateOutputHeight(outputIndex, outputHeight, source);
        this.layoutNotebookCell(cell, cell.layoutInfo.totalHeight);
        if (isInit) {
          this._onDidRenderOutput.fire(output);
        }
      } else {
        this._debug("tried to update cell output that does not exist");
      }
    }
  }
  _scheduleOutputHeightAck(cellInfo, outputId, height) {
    const wasEmpty = this._pendingOutputHeightAcks.size === 0;
    this._pendingOutputHeightAcks.set(outputId, { cellId: cellInfo.cellId, outputId, height });
    if (wasEmpty) {
      DOM.scheduleAtNextAnimationFrame(DOM.getWindow(this.getDomNode()), () => {
        this._debug("ack height");
        this._updateScrollHeight();
        this._webview?.ackHeight([...this._pendingOutputHeightAcks.values()]);
        this._pendingOutputHeightAcks.clear();
      }, -1);
    }
  }
  _getCellById(cellId) {
    return this.viewModel?.viewCells.find((vc) => vc.id === cellId);
  }
  _updateMarkupCellHeight(cellId, height, isInit) {
    const cell = this._getCellById(cellId);
    if (cell && cell instanceof MarkupCellViewModel) {
      const { bottomToolbarGap } = this._notebookOptions.computeBottomToolbarDimensions(this.viewModel?.viewType);
      this._debug("updateMarkdownCellHeight", cell.handle, height + bottomToolbarGap, isInit);
      cell.renderedMarkdownHeight = height;
    }
  }
  _setMarkupCellEditState(cellId, editState) {
    const cell = this._getCellById(cellId);
    if (cell instanceof MarkupCellViewModel) {
      this.revealInView(cell);
      cell.updateEditState(editState, "setMarkdownCellEditState");
    }
  }
  _didStartDragMarkupCell(cellId, event) {
    const cell = this._getCellById(cellId);
    if (cell instanceof MarkupCellViewModel) {
      const webviewOffset = this._list.webviewElement ? -parseInt(this._list.webviewElement.domNode.style.top, 10) : 0;
      this._dndController?.startExplicitDrag(cell, event.dragOffsetY - webviewOffset);
    }
  }
  _didDragMarkupCell(cellId, event) {
    const cell = this._getCellById(cellId);
    if (cell instanceof MarkupCellViewModel) {
      const webviewOffset = this._list.webviewElement ? -parseInt(this._list.webviewElement.domNode.style.top, 10) : 0;
      this._dndController?.explicitDrag(cell, event.dragOffsetY - webviewOffset);
    }
  }
  _didDropMarkupCell(cellId, event) {
    const cell = this._getCellById(cellId);
    if (cell instanceof MarkupCellViewModel) {
      const webviewOffset = this._list.webviewElement ? -parseInt(this._list.webviewElement.domNode.style.top, 10) : 0;
      event.dragOffsetY -= webviewOffset;
      this._dndController?.explicitDrop(cell, event);
    }
  }
  _didEndDragMarkupCell(cellId) {
    const cell = this._getCellById(cellId);
    if (cell instanceof MarkupCellViewModel) {
      this._dndController?.endExplicitDrag(cell);
    }
  }
  _didResizeOutput(cellId) {
    const cell = this._getCellById(cellId);
    if (cell) {
      this._onDidResizeOutputEmitter.fire(cell);
    }
  }
  _updatePerformanceMetadata(cellId, executionId, duration, rendererId) {
    if (!this.hasModel()) {
      return;
    }
    const cell = this._getCellById(cellId);
    const cellIndex = !cell ? void 0 : this.getCellIndex(cell);
    if (cell?.internalMetadata.executionId === executionId && cellIndex !== void 0) {
      const renderDurationMap = cell.internalMetadata.renderDuration || {};
      renderDurationMap[rendererId] = (renderDurationMap[rendererId] ?? 0) + duration;
      this.textModel.applyEdits([
        {
          editType: CellEditType.PartialInternalMetadata,
          index: cellIndex,
          internalMetadata: {
            executionId,
            renderDuration: renderDurationMap
          }
        }
      ], true, void 0, () => void 0, void 0, false);
    }
  }
  //#endregion
  //#region Editor Contributions
  getContribution(id) {
    return this._contributions.get(id) || null;
  }
  //#endregion
  dispose() {
    this._isDisposed = true;
    this._webview?.dispose();
    this._webview = null;
    this._layoutDisposables.forEach((d) => d.dispose());
    this.notebookEditorService.removeNotebookEditor(this);
    dispose(this._contributions.values());
    this._contributions.clear();
    this._localStore.clear();
    dispose(this._localCellStateListeners);
    this._list.dispose();
    this._listTopCellToolbar?.dispose();
    this._overlayContainer.remove();
    this.viewModel?.dispose();
    this._renderedEditors.clear();
    this._baseCellEditorOptions.forEach((v) => v.dispose());
    this._baseCellEditorOptions.clear();
    this._notebookOverviewRulerContainer.remove();
    super.dispose();
    this._webview = null;
    this._webviewResolvePromise = null;
    this._webviewTransparentCover = null;
    this._dndController = null;
    this._listTopCellToolbar = null;
    this._notebookViewModel = void 0;
    this._cellContextKeyManager = null;
    this._notebookTopToolbar = null;
    this._list = null;
    this._listViewInfoAccessor = null;
    this._pendingLayouts = null;
    this._listDelegate = null;
  }
  toJSON() {
    return {
      notebookUri: this.viewModel?.uri
    };
  }
};
NotebookEditorWidget = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IEditorGroupsService),
  __decorateParam(4, INotebookRendererMessagingService),
  __decorateParam(5, INotebookEditorService),
  __decorateParam(6, INotebookKernelService),
  __decorateParam(7, INotebookService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, ILayoutService),
  __decorateParam(11, IContextMenuService),
  __decorateParam(12, ITelemetryService),
  __decorateParam(13, INotebookExecutionService),
  __decorateParam(14, IEditorProgressService),
  __decorateParam(15, INotebookLoggingService)
], NotebookEditorWidget);
registerZIndex(ZIndex.Base, 5, "notebook-progress-bar");
registerZIndex(ZIndex.Base, 10, "notebook-list-insertion-indicator");
registerZIndex(ZIndex.Base, 20, "notebook-cell-editor-outline");
registerZIndex(ZIndex.Base, 25, "notebook-scrollbar");
registerZIndex(ZIndex.Base, 26, "notebook-cell-status");
registerZIndex(ZIndex.Base, 26, "notebook-folding-indicator");
registerZIndex(ZIndex.Base, 27, "notebook-output");
registerZIndex(ZIndex.Base, 28, "notebook-cell-bottom-toolbar-container");
registerZIndex(ZIndex.Base, 29, "notebook-run-button-container");
registerZIndex(ZIndex.Base, 29, "notebook-input-collapse-condicon");
registerZIndex(ZIndex.Base, 30, "notebook-cell-output-toolbar");
registerZIndex(ZIndex.Sash, 1, "notebook-cell-expand-part-button");
registerZIndex(ZIndex.Sash, 2, "notebook-cell-toolbar");
registerZIndex(ZIndex.Sash, 3, "notebook-cell-toolbar-dropdown-active");
const notebookCellBorder = registerColor("notebook.cellBorderColor", {
  dark: transparent(listInactiveSelectionBackground, 1),
  light: transparent(listInactiveSelectionBackground, 1),
  hcDark: PANEL_BORDER,
  hcLight: PANEL_BORDER
}, nls.localize("notebook.cellBorderColor", "The border color for notebook cells."));
const focusedEditorBorderColor = registerColor("notebook.focusedEditorBorder", focusBorder, nls.localize("notebook.focusedEditorBorder", "The color of the notebook cell editor border."));
const cellStatusIconSuccess = registerColor("notebookStatusSuccessIcon.foreground", debugIconStartForeground, nls.localize("notebookStatusSuccessIcon.foreground", "The error icon color of notebook cells in the cell status bar."));
const runningCellRulerDecorationColor = registerColor("notebookEditorOverviewRuler.runningCellForeground", debugIconStartForeground, nls.localize("notebookEditorOverviewRuler.runningCellForeground", "The color of the running cell decoration in the notebook editor overview ruler."));
const cellStatusIconError = registerColor("notebookStatusErrorIcon.foreground", errorForeground, nls.localize("notebookStatusErrorIcon.foreground", "The error icon color of notebook cells in the cell status bar."));
const cellStatusIconRunning = registerColor("notebookStatusRunningIcon.foreground", foreground, nls.localize("notebookStatusRunningIcon.foreground", "The running icon color of notebook cells in the cell status bar."));
const notebookOutputContainerBorderColor = registerColor("notebook.outputContainerBorderColor", null, nls.localize("notebook.outputContainerBorderColor", "The border color of the notebook output container."));
const notebookOutputContainerColor = registerColor("notebook.outputContainerBackgroundColor", null, nls.localize("notebook.outputContainerBackgroundColor", "The color of the notebook output container background."));
const CELL_TOOLBAR_SEPERATOR = registerColor("notebook.cellToolbarSeparator", {
  dark: Color.fromHex("#808080").transparent(0.35),
  light: Color.fromHex("#808080").transparent(0.35),
  hcDark: contrastBorder,
  hcLight: contrastBorder
}, nls.localize("notebook.cellToolbarSeparator", "The color of the separator in the cell bottom toolbar"));
const focusedCellBackground = registerColor("notebook.focusedCellBackground", null, nls.localize("focusedCellBackground", "The background color of a cell when the cell is focused."));
const selectedCellBackground = registerColor("notebook.selectedCellBackground", {
  dark: listInactiveSelectionBackground,
  light: listInactiveSelectionBackground,
  hcDark: null,
  hcLight: null
}, nls.localize("selectedCellBackground", "The background color of a cell when the cell is selected."));
const cellHoverBackground = registerColor("notebook.cellHoverBackground", {
  dark: transparent(focusedCellBackground, 0.5),
  light: transparent(focusedCellBackground, 0.7),
  hcDark: null,
  hcLight: null
}, nls.localize("notebook.cellHoverBackground", "The background color of a cell when the cell is hovered."));
const selectedCellBorder = registerColor("notebook.selectedCellBorder", {
  dark: notebookCellBorder,
  light: notebookCellBorder,
  hcDark: contrastBorder,
  hcLight: contrastBorder
}, nls.localize("notebook.selectedCellBorder", "The color of the cell's top and bottom border when the cell is selected but not focused."));
const inactiveSelectedCellBorder = registerColor("notebook.inactiveSelectedCellBorder", {
  dark: null,
  light: null,
  hcDark: focusBorder,
  hcLight: focusBorder
}, nls.localize("notebook.inactiveSelectedCellBorder", "The color of the cell's borders when multiple cells are selected."));
const focusedCellBorder = registerColor("notebook.focusedCellBorder", focusBorder, nls.localize("notebook.focusedCellBorder", "The color of the cell's focus indicator borders when the cell is focused."));
const inactiveFocusedCellBorder = registerColor("notebook.inactiveFocusedCellBorder", notebookCellBorder, nls.localize("notebook.inactiveFocusedCellBorder", "The color of the cell's top and bottom border when a cell is focused while the primary focus is outside of the editor."));
const cellStatusBarItemHover = registerColor("notebook.cellStatusBarItemHoverBackground", {
  light: new Color(new RGBA(0, 0, 0, 0.08)),
  dark: new Color(new RGBA(255, 255, 255, 0.15)),
  hcDark: new Color(new RGBA(255, 255, 255, 0.15)),
  hcLight: new Color(new RGBA(0, 0, 0, 0.08))
}, nls.localize("notebook.cellStatusBarItemHoverBackground", "The background color of notebook cell status bar items."));
const cellInsertionIndicator = registerColor("notebook.cellInsertionIndicator", focusBorder, nls.localize("notebook.cellInsertionIndicator", "The color of the notebook cell insertion indicator."));
const listScrollbarSliderBackground = registerColor("notebookScrollbarSlider.background", scrollbarSliderBackground, nls.localize("notebookScrollbarSliderBackground", "Notebook scrollbar slider background color."));
const listScrollbarSliderHoverBackground = registerColor("notebookScrollbarSlider.hoverBackground", scrollbarSliderHoverBackground, nls.localize("notebookScrollbarSliderHoverBackground", "Notebook scrollbar slider background color when hovering."));
const listScrollbarSliderActiveBackground = registerColor("notebookScrollbarSlider.activeBackground", scrollbarSliderActiveBackground, nls.localize("notebookScrollbarSliderActiveBackground", "Notebook scrollbar slider background color when clicked on."));
const cellSymbolHighlight = registerColor("notebook.symbolHighlightBackground", {
  dark: Color.fromHex("#ffffff0b"),
  light: Color.fromHex("#fdff0033"),
  hcDark: null,
  hcLight: null
}, nls.localize("notebook.symbolHighlightBackground", "Background color of highlighted cell"));
const cellEditorBackground = registerColor("notebook.cellEditorBackground", {
  light: SIDE_BAR_BACKGROUND,
  dark: SIDE_BAR_BACKGROUND,
  hcDark: null,
  hcLight: null
}, nls.localize("notebook.cellEditorBackground", "Cell editor background color."));
const notebookEditorBackground = registerColor("notebook.editorBackground", {
  light: EDITOR_PANE_BACKGROUND,
  dark: EDITOR_PANE_BACKGROUND,
  hcDark: null,
  hcLight: null
}, nls.localize("notebook.editorBackground", "Notebook background color."));
export {
  CELL_TOOLBAR_SEPERATOR,
  NotebookEditorWidget,
  cellEditorBackground,
  cellHoverBackground,
  cellInsertionIndicator,
  cellStatusBarItemHover,
  cellStatusIconError,
  cellStatusIconRunning,
  cellStatusIconSuccess,
  cellSymbolHighlight,
  focusedCellBackground,
  focusedCellBorder,
  focusedEditorBorderColor,
  getDefaultNotebookCreationOptions,
  inactiveFocusedCellBorder,
  inactiveSelectedCellBorder,
  listScrollbarSliderActiveBackground,
  listScrollbarSliderBackground,
  listScrollbarSliderHoverBackground,
  notebookCellBorder,
  notebookOutputContainerBorderColor,
  notebookOutputContainerColor,
  runningCellRulerDecorationColor,
  selectedCellBackground,
  selectedCellBorder
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL25vdGVib29rRWRpdG9yV2lkZ2V0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuL21lZGlhL25vdGVib29rLmNzcyc7XG5pbXBvcnQgJy4vbWVkaWEvbm90ZWJvb2tDZWxsQ2hhdC5jc3MnO1xuaW1wb3J0ICcuL21lZGlhL25vdGVib29rQ2VsbEVkaXRvckhpbnQuY3NzJztcbmltcG9ydCAnLi9tZWRpYS9ub3RlYm9va0NlbGxJbnNlcnRUb29sYmFyLmNzcyc7XG5pbXBvcnQgJy4vbWVkaWEvbm90ZWJvb2tDZWxsU3RhdHVzQmFyLmNzcyc7XG5pbXBvcnQgJy4vbWVkaWEvbm90ZWJvb2tDZWxsVGl0bGVUb29sYmFyLmNzcyc7XG5pbXBvcnQgJy4vbWVkaWEvbm90ZWJvb2tGb2N1c0luZGljYXRvci5jc3MnO1xuaW1wb3J0ICcuL21lZGlhL25vdGVib29rVG9vbGJhci5jc3MnO1xuaW1wb3J0ICcuL21lZGlhL25vdGVib29rRG5kLmNzcyc7XG5pbXBvcnQgJy4vbWVkaWEvbm90ZWJvb2tGb2xkaW5nLmNzcyc7XG5pbXBvcnQgJy4vbWVkaWEvbm90ZWJvb2tDZWxsT3V0cHV0LmNzcyc7XG5pbXBvcnQgJy4vbWVkaWEvbm90ZWJvb2tFZGl0b3JTdGlja3lTY3JvbGwuY3NzJztcbmltcG9ydCAnLi9tZWRpYS9ub3RlYm9va0tlcm5lbEFjdGlvblZpZXdJdGVtLmNzcyc7XG5pbXBvcnQgJy4vbWVkaWEvbm90ZWJvb2tPdXRsaW5lLmNzcyc7XG5pbXBvcnQgJy4vbWVkaWEvbm90ZWJvb2tDaGF0RWRpdENvbnRyb2xsZXIuY3NzJztcbmltcG9ydCAnLi9tZWRpYS9ub3RlYm9va0NoYXRFZGl0b3JPdmVybGF5LmNzcyc7XG5pbXBvcnQgKiBhcyBET00gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgKiBhcyBkb21TdHlsZXNoZWV0cyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tU3R5bGVzaGVldHMuanMnO1xuaW1wb3J0IHsgSU1vdXNlV2hlZWxFdmVudCwgU3RhbmRhcmRNb3VzZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL21vdXNlRXZlbnQuanMnO1xuaW1wb3J0IHsgSUxpc3RDb250ZXh0TWVudUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UsIFNlcXVlbmNlckJ5S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgQ29sb3IsIFJHQkEgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xvci5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGNvbWJpbmVkRGlzcG9zYWJsZSwgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBkaXNwb3NlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IHNldFRpbWVvdXQwIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgZXh0bmFtZSwgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBGb250TWVhc3VyZW1lbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvY29uZmlnL2ZvbnRNZWFzdXJlbWVudHMuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBCYXJlRm9udEluZm8sIEZvbnRJbmZvIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZm9udEluZm8uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBTdWdnZXN0Q29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3N1Z2dlc3QvYnJvd3Nlci9zdWdnZXN0Q29udHJvbGxlci5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlLCBSYXdDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vc2VydmljZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUxheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyWkluZGV4LCBaSW5kZXggfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYXlvdXQvYnJvd3Nlci96SW5kZXhSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlLCBJUHJvZ3Jlc3NSdW5uZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBjb250cmFzdEJvcmRlciwgZXJyb3JGb3JlZ3JvdW5kLCBmb2N1c0JvcmRlciwgZm9yZWdyb3VuZCwgbGlzdEluYWN0aXZlU2VsZWN0aW9uQmFja2dyb3VuZCwgcmVnaXN0ZXJDb2xvciwgc2Nyb2xsYmFyU2xpZGVyQWN0aXZlQmFja2dyb3VuZCwgc2Nyb2xsYmFyU2xpZGVyQmFja2dyb3VuZCwgc2Nyb2xsYmFyU2xpZGVySG92ZXJCYWNrZ3JvdW5kLCB0cmFuc3BhcmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEVESVRPUl9QQU5FX0JBQ0tHUk9VTkQsIFBBTkVMX0JPUkRFUiwgU0lERV9CQVJfQkFDS0dST1VORCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi90aGVtZS5qcyc7XG5pbXBvcnQgeyBkZWJ1Z0ljb25TdGFydEZvcmVncm91bmQgfSBmcm9tICcuLi8uLi9kZWJ1Zy9icm93c2VyL2RlYnVnQ29sb3JzLmpzJztcbmltcG9ydCB7IENlbGxFZGl0U3RhdGUsIENlbGxGaW5kTWF0Y2hXaXRoSW5kZXgsIENlbGxGb2N1c01vZGUsIENlbGxMYXlvdXRDb250ZXh0LCBDZWxsUmV2ZWFsUmFuZ2VUeXBlLCBDZWxsUmV2ZWFsVHlwZSwgSUFjdGl2ZU5vdGVib29rRWRpdG9yRGVsZWdhdGUsIElCYXNlQ2VsbEVkaXRvck9wdGlvbnMsIElDZWxsT3V0cHV0Vmlld01vZGVsLCBJQ2VsbFZpZXdNb2RlbCwgSUNvbW1vbkNlbGxJbmZvLCBJRGlzcGxheU91dHB1dExheW91dFVwZGF0ZVJlcXVlc3QsIElGb2N1c05vdGVib29rQ2VsbE9wdGlvbnMsIElJbnNldFJlbmRlck91dHB1dCwgSU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VBY2Nlc3NvciwgSU5vdGVib29rQ2VsbE92ZXJsYXlDaGFuZ2VBY2Nlc3NvciwgSU5vdGVib29rRGVsdGFEZWNvcmF0aW9uLCBJTm90ZWJvb2tFZGl0b3IsIElOb3RlYm9va0VkaXRvckNvbnRyaWJ1dGlvbiwgSU5vdGVib29rRWRpdG9yQ29udHJpYnV0aW9uRGVzY3JpcHRpb24sIElOb3RlYm9va0VkaXRvckNyZWF0aW9uT3B0aW9ucywgSU5vdGVib29rRWRpdG9yRGVsZWdhdGUsIElOb3RlYm9va0VkaXRvck1vdXNlRXZlbnQsIElOb3RlYm9va0VkaXRvck9wdGlvbnMsIElOb3RlYm9va0VkaXRvclZpZXdTdGF0ZSwgSU5vdGVib29rVmlld0NlbGxzVXBkYXRlRXZlbnQsIElOb3RlYm9va1ZpZXdab25lQ2hhbmdlQWNjZXNzb3IsIElOb3RlYm9va1dlYnZpZXdNZXNzYWdlLCBSZW5kZXJPdXRwdXRUeXBlLCBTY3JvbGxUb1JldmVhbEJlaGF2aW9yIH0gZnJvbSAnLi9ub3RlYm9va0Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tFZGl0b3JFeHRlbnNpb25zUmVnaXN0cnkgfSBmcm9tICcuL25vdGVib29rRWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi9zZXJ2aWNlcy9ub3RlYm9va0VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgbm90ZWJvb2tEZWJ1ZyB9IGZyb20gJy4vbm90ZWJvb2tMb2dnZXIuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tDZWxsU3RhdGVDaGFuZ2VkRXZlbnQsIE5vdGVib29rTGF5b3V0Q2hhbmdlZEV2ZW50LCBOb3RlYm9va0xheW91dEluZm8gfSBmcm9tICcuL25vdGVib29rVmlld0V2ZW50cy5qcyc7XG5pbXBvcnQgeyBDZWxsQ29udGV4dEtleU1hbmFnZXIgfSBmcm9tICcuL3ZpZXcvY2VsbFBhcnRzL2NlbGxDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBDZWxsRHJhZ0FuZERyb3BDb250cm9sbGVyIH0gZnJvbSAnLi92aWV3L2NlbGxQYXJ0cy9jZWxsRG5kLmpzJztcbmltcG9ydCB7IExpc3RWaWV3SW5mb0FjY2Vzc29yLCBOb3RlYm9va0NlbGxMaXN0LCBOT1RFQk9PS19XRUJWSUVXX0JPVU5EQVJZIH0gZnJvbSAnLi92aWV3L25vdGVib29rQ2VsbExpc3QuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rQ2VsbExpc3QgfSBmcm9tICcuL3ZpZXcvbm90ZWJvb2tSZW5kZXJpbmdDb21tb24uanMnO1xuaW1wb3J0IHsgQmFja0xheWVyV2ViVmlldyB9IGZyb20gJy4vdmlldy9yZW5kZXJlcnMvYmFja0xheWVyV2ViVmlldy5qcyc7XG5pbXBvcnQgeyBDb2RlQ2VsbFJlbmRlcmVyLCBNYXJrdXBDZWxsUmVuZGVyZXIsIE5vdGVib29rQ2VsbExpc3REZWxlZ2F0ZSB9IGZyb20gJy4vdmlldy9yZW5kZXJlcnMvY2VsbFJlbmRlcmVyLmpzJztcbmltcG9ydCB7IElBY2tPdXRwdXRIZWlnaHQsIElNYXJrdXBDZWxsSW5pdGlhbGl6YXRpb24gfSBmcm9tICcuL3ZpZXcvcmVuZGVyZXJzL3dlYnZpZXdNZXNzYWdlcy5qcyc7XG5pbXBvcnQgeyBDb2RlQ2VsbFZpZXdNb2RlbCwgb3V0cHV0RGlzcGxheUxpbWl0IH0gZnJvbSAnLi92aWV3TW9kZWwvY29kZUNlbGxWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tFdmVudERpc3BhdGNoZXIgfSBmcm9tICcuL3ZpZXdNb2RlbC9ldmVudERpc3BhdGNoZXIuanMnO1xuaW1wb3J0IHsgTWFya3VwQ2VsbFZpZXdNb2RlbCB9IGZyb20gJy4vdmlld01vZGVsL21hcmt1cENlbGxWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgQ2VsbFZpZXdNb2RlbCwgTm90ZWJvb2tWaWV3TW9kZWwgfSBmcm9tICcuL3ZpZXdNb2RlbC9ub3RlYm9va1ZpZXdNb2RlbEltcGwuanMnO1xuaW1wb3J0IHsgVmlld0NvbnRleHQgfSBmcm9tICcuL3ZpZXdNb2RlbC92aWV3Q29udGV4dC5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0VkaXRvcldvcmtiZW5jaFRvb2xiYXIgfSBmcm9tICcuL3ZpZXdQYXJ0cy9ub3RlYm9va0VkaXRvclRvb2xiYXIuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tFZGl0b3JDb250ZXh0S2V5cyB9IGZyb20gJy4vdmlld1BhcnRzL25vdGVib29rRWRpdG9yV2lkZ2V0Q29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tPdmVydmlld1J1bGVyIH0gZnJvbSAnLi92aWV3UGFydHMvbm90ZWJvb2tPdmVydmlld1J1bGVyLmpzJztcbmltcG9ydCB7IExpc3RUb3BDZWxsVG9vbGJhciB9IGZyb20gJy4vdmlld1BhcnRzL25vdGVib29rVG9wQ2VsbFRvb2xiYXIuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tUZXh0TW9kZWwgfSBmcm9tICcuLi9jb21tb24vbW9kZWwvbm90ZWJvb2tUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgQ2VsbEVkaXRUeXBlLCBDZWxsS2luZCwgSU5vdGVib29rRmluZE9wdGlvbnMsIE5vdGVib29rRmluZFNjb3BlVHlwZSwgUkVOREVSRVJfTk9UX0FWQUlMQUJMRSwgU2VsZWN0aW9uU3RhdGVUeXBlIH0gZnJvbSAnLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IE5PVEVCT09LX0NVUlNPUl9OQVZJR0FUSU9OX01PREUsIE5PVEVCT09LX0VESVRPUl9FRElUQUJMRSwgTk9URUJPT0tfRURJVE9SX0ZPQ1VTRUQsIE5PVEVCT09LX09VVFBVVF9GT0NVU0VELCBOT1RFQk9PS19PVVRQVVRfSU5QVVRfRk9DVVNFRCB9IGZyb20gJy4uL2NvbW1vbi9ub3RlYm9va0NvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0V4ZWN1dGlvblNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vbm90ZWJvb2tFeGVjdXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0tlcm5lbFNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vbm90ZWJvb2tLZXJuZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE5vdGVib29rT3B0aW9ucywgT3V0cHV0SW5uZXJDb250YWluZXJUb3BQYWRkaW5nIH0gZnJvbSAnLi9ub3RlYm9va09wdGlvbnMuanMnO1xuaW1wb3J0IHsgY2VsbFJhbmdlc1RvSW5kZXhlcywgSUNlbGxSYW5nZSB9IGZyb20gJy4uL2NvbW1vbi9ub3RlYm9va1JhbmdlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va1JlbmRlcmVyTWVzc2FnaW5nU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9ub3RlYm9va1JlbmRlcmVyTWVzc2FnaW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL25vdGVib29rU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV2Vidmlld0VsZW1lbnQgfSBmcm9tICcuLi8uLi93ZWJ2aWV3L2Jyb3dzZXIvd2Vidmlldy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JFeHRlbnNpb25zUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE5vdGVib29rUGVyZk1hcmtzIH0gZnJvbSAnLi4vY29tbW9uL25vdGVib29rUGVyZm9ybWFuY2UuanMnO1xuaW1wb3J0IHsgQmFzZUNlbGxFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi92aWV3TW9kZWwvY2VsbEVkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgRmxvYXRpbmdFZGl0b3JDbGlja01lbnUgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2NvZGVlZGl0b3IuanMnO1xuaW1wb3J0IHsgSURpbWVuc2lvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9kaW1lbnNpb24uanMnO1xuaW1wb3J0IHsgQ2VsbEZpbmRNYXRjaE1vZGVsIH0gZnJvbSAnLi9jb250cmliL2ZpbmQvZmluZE1vZGVsLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0xvZ2dpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL25vdGVib29rTG9nZ2luZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgRHJvcEludG9FZGl0b3JDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZHJvcE9yUGFzdGVJbnRvL2Jyb3dzZXIvZHJvcEludG9FZGl0b3JDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IENvcHlQYXN0ZUNvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9kcm9wT3JQYXN0ZUludG8vYnJvd3Nlci9jb3B5UGFzdGVDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IE5vdGVib29rU3RpY2t5U2Nyb2xsIH0gZnJvbSAnLi92aWV3UGFydHMvbm90ZWJvb2tFZGl0b3JTdGlja3lTY3JvbGwuanMnO1xuaW1wb3J0IHsgUGl4ZWxSYXRpbyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9waXhlbFJhdGlvLmpzJztcbmltcG9ydCB7IFByZXZlbnREZWZhdWx0Q29udGV4dE1lbnVJdGVtc0NvbnRleHRLZXlOYW1lIH0gZnJvbSAnLi4vLi4vd2Vidmlldy9icm93c2VyL3dlYnZpZXcuY29udHJpYnV0aW9uLmpzJztcbmltcG9ydCB7IE5vdGVib29rQWNjZXNzaWJpbGl0eVByb3ZpZGVyIH0gZnJvbSAnLi9ub3RlYm9va0FjY2Vzc2liaWxpdHlQcm92aWRlci5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0hvcml6b250YWxUcmFja2VyIH0gZnJvbSAnLi92aWV3UGFydHMvbm90ZWJvb2tIb3Jpem9udGFsVHJhY2tlci5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0NlbGxFZGl0b3JQb29sIH0gZnJvbSAnLi92aWV3L25vdGVib29rQ2VsbEVkaXRvclBvb2wuanMnO1xuaW1wb3J0IHsgSW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvaW5saW5lQ29tcGxldGlvbnMvYnJvd3Nlci9jb250cm9sbGVyL2lubGluZUNvbXBsZXRpb25zQ29udHJvbGxlci5qcyc7XG5cbmNvbnN0ICQgPSBET00uJDtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldERlZmF1bHROb3RlYm9va0NyZWF0aW9uT3B0aW9ucygpOiBJTm90ZWJvb2tFZGl0b3JDcmVhdGlvbk9wdGlvbnMge1xuXHQvLyBXZSBpbmxpbmVkIHRoZSBpZCB0byBhdm9pZCBsb2FkaW5nIGNvbW1lbnQgY29udHJpYiBpbiB0ZXN0c1xuXHRjb25zdCBza2lwQ29udHJpYnV0aW9ucyA9IFtcblx0XHQnZWRpdG9yLmNvbnRyaWIucmV2aWV3Jyxcblx0XHRGbG9hdGluZ0VkaXRvckNsaWNrTWVudS5JRCxcblx0XHQnZWRpdG9yLmNvbnRyaWIuZGlydHlkaWZmJyxcblx0XHQnZWRpdG9yLmNvbnRyaWIudGVzdGluZ091dHB1dFBlZWsnLFxuXHRcdCdlZGl0b3IuY29udHJpYi50ZXN0aW5nRGVjb3JhdGlvbnMnLFxuXHRcdCdzdG9yZS5jb250cmliLnN0aWNreVNjcm9sbENvbnRyb2xsZXInLFxuXHRcdCdlZGl0b3IuY29udHJpYi5maW5kQ29udHJvbGxlcicsXG5cdFx0J2VkaXRvci5jb250cmliLmVtcHR5VGV4dEVkaXRvckhpbnQnXG5cdF07XG5cdGNvbnN0IGNvbnRyaWJ1dGlvbnMgPSBFZGl0b3JFeHRlbnNpb25zUmVnaXN0cnkuZ2V0RWRpdG9yQ29udHJpYnV0aW9ucygpLmZpbHRlcihjID0+IHNraXBDb250cmlidXRpb25zLmluZGV4T2YoYy5pZCkgPT09IC0xKTtcblxuXHRyZXR1cm4ge1xuXHRcdG1lbnVJZHM6IHtcblx0XHRcdG5vdGVib29rVG9vbGJhcjogTWVudUlkLk5vdGVib29rVG9vbGJhcixcblx0XHRcdGNlbGxUaXRsZVRvb2xiYXI6IE1lbnVJZC5Ob3RlYm9va0NlbGxUaXRsZSxcblx0XHRcdGNlbGxEZWxldGVUb29sYmFyOiBNZW51SWQuTm90ZWJvb2tDZWxsRGVsZXRlLFxuXHRcdFx0Y2VsbEluc2VydFRvb2xiYXI6IE1lbnVJZC5Ob3RlYm9va0NlbGxCZXR3ZWVuLFxuXHRcdFx0Y2VsbFRvcEluc2VydFRvb2xiYXI6IE1lbnVJZC5Ob3RlYm9va0NlbGxMaXN0VG9wLFxuXHRcdFx0Y2VsbEV4ZWN1dGVUb29sYmFyOiBNZW51SWQuTm90ZWJvb2tDZWxsRXhlY3V0ZSxcblx0XHRcdGNlbGxFeGVjdXRlUHJpbWFyeTogTWVudUlkLk5vdGVib29rQ2VsbEV4ZWN1dGVQcmltYXJ5LFxuXHRcdH0sXG5cdFx0Y2VsbEVkaXRvckNvbnRyaWJ1dGlvbnM6IGNvbnRyaWJ1dGlvbnNcblx0fTtcbn1cblxuZXhwb3J0IGNsYXNzIE5vdGVib29rRWRpdG9yV2lkZ2V0IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElOb3RlYm9va0VkaXRvckRlbGVnYXRlLCBJTm90ZWJvb2tFZGl0b3Ige1xuXHQvLyNyZWdpb24gRXZlbnRpbmdcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VDZWxsU3RhdGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxOb3RlYm9va0NlbGxTdGF0ZUNoYW5nZWRFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQ2VsbFN0YXRlID0gdGhpcy5fb25EaWRDaGFuZ2VDZWxsU3RhdGUuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlVmlld0NlbGxzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SU5vdGVib29rVmlld0NlbGxzVXBkYXRlRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVZpZXdDZWxsczogRXZlbnQ8SU5vdGVib29rVmlld0NlbGxzVXBkYXRlRXZlbnQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VWaWV3Q2VsbHMuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uV2lsbENoYW5nZU1vZGVsID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8Tm90ZWJvb2tUZXh0TW9kZWwgfCB1bmRlZmluZWQ+KCkpO1xuXHRyZWFkb25seSBvbldpbGxDaGFuZ2VNb2RlbDogRXZlbnQ8Tm90ZWJvb2tUZXh0TW9kZWwgfCB1bmRlZmluZWQ+ID0gdGhpcy5fb25XaWxsQ2hhbmdlTW9kZWwuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlTW9kZWwgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxOb3RlYm9va1RleHRNb2RlbCB8IHVuZGVmaW5lZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlTW9kZWw6IEV2ZW50PE5vdGVib29rVGV4dE1vZGVsIHwgdW5kZWZpbmVkPiA9IHRoaXMuX29uRGlkQ2hhbmdlTW9kZWwuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQXR0YWNoVmlld01vZGVsID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQXR0YWNoVmlld01vZGVsOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQXR0YWNoVmlld01vZGVsLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZU9wdGlvbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VPcHRpb25zOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlT3B0aW9ucy5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VEZWNvcmF0aW9ucyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZURlY29yYXRpb25zOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlRGVjb3JhdGlvbnMuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkU2Nyb2xsID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkU2Nyb2xsOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkU2Nyb2xsLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUxheW91dCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUxheW91dDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZUxheW91dC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VBY3RpdmVDZWxsID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQWN0aXZlQ2VsbDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZUNlbGwuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlRm9jdXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VGb2N1czogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZUZvY3VzLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVNlbGVjdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVNlbGVjdGlvbjogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZVNlbGVjdGlvbi5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VWaXNpYmxlUmFuZ2VzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVmlzaWJsZVJhbmdlczogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZVZpc2libGVSYW5nZXMuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRm9jdXNFbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRm9jdXNXaWRnZXQgPSB0aGlzLl9vbkRpZEZvY3VzRW1pdHRlci5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRCbHVyRW1pdHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZEJsdXJXaWRnZXQgPSB0aGlzLl9vbkRpZEJsdXJFbWl0dGVyLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUFjdGl2ZUVkaXRvciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHRoaXM+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUFjdGl2ZUVkaXRvcjogRXZlbnQ8dGhpcz4gPSB0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZUVkaXRvci5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VBY3RpdmVLZXJuZWwgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VBY3RpdmVLZXJuZWw6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVLZXJuZWwuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uTW91c2VVcDogRW1pdHRlcjxJTm90ZWJvb2tFZGl0b3JNb3VzZUV2ZW50PiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElOb3RlYm9va0VkaXRvck1vdXNlRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbk1vdXNlVXA6IEV2ZW50PElOb3RlYm9va0VkaXRvck1vdXNlRXZlbnQ+ID0gdGhpcy5fb25Nb3VzZVVwLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbk1vdXNlRG93bjogRW1pdHRlcjxJTm90ZWJvb2tFZGl0b3JNb3VzZUV2ZW50PiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElOb3RlYm9va0VkaXRvck1vdXNlRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbk1vdXNlRG93bjogRXZlbnQ8SU5vdGVib29rRWRpdG9yTW91c2VFdmVudD4gPSB0aGlzLl9vbk1vdXNlRG93bi5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZWNlaXZlTWVzc2FnZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElOb3RlYm9va1dlYnZpZXdNZXNzYWdlPigpKTtcblx0cmVhZG9ubHkgb25EaWRSZWNlaXZlTWVzc2FnZTogRXZlbnQ8SU5vdGVib29rV2Vidmlld01lc3NhZ2U+ID0gdGhpcy5fb25EaWRSZWNlaXZlTWVzc2FnZS5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZW5kZXJPdXRwdXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJQ2VsbE91dHB1dFZpZXdNb2RlbD4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgb25EaWRSZW5kZXJPdXRwdXQgPSB0aGlzLl9vbkRpZFJlbmRlck91dHB1dC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZW1vdmVPdXRwdXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJQ2VsbE91dHB1dFZpZXdNb2RlbD4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgb25EaWRSZW1vdmVPdXRwdXQgPSB0aGlzLl9vbkRpZFJlbW92ZU91dHB1dC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZXNpemVPdXRwdXRFbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUNlbGxWaWV3TW9kZWw+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlc2l6ZU91dHB1dCA9IHRoaXMuX29uRGlkUmVzaXplT3V0cHV0RW1pdHRlci5ldmVudDtcblxuXHQvLyNlbmRyZWdpb25cblx0cHJpdmF0ZSBfb3ZlcmxheUNvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIF9ub3RlYm9va1RvcFRvb2xiYXJDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBfbm90ZWJvb2tUb3BUb29sYmFyITogTm90ZWJvb2tFZGl0b3JXb3JrYmVuY2hUb29sYmFyO1xuXHRwcml2YXRlIF9ub3RlYm9va1N0aWNreVNjcm9sbENvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIF9ub3RlYm9va1N0aWNreVNjcm9sbCE6IE5vdGVib29rU3RpY2t5U2Nyb2xsO1xuXHRwcml2YXRlIF9ub3RlYm9va092ZXJ2aWV3UnVsZXJDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBfbm90ZWJvb2tPdmVydmlld1J1bGVyITogTm90ZWJvb2tPdmVydmlld1J1bGVyO1xuXHRwcml2YXRlIF9ib2R5ITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgX3N0eWxlRWxlbWVudCE6IEhUTUxTdHlsZUVsZW1lbnQ7XG5cdHByaXZhdGUgX292ZXJmbG93Q29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgX3dlYnZpZXc6IEJhY2tMYXllcldlYlZpZXc8SUNvbW1vbkNlbGxJbmZvPiB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIF93ZWJ2aWV3UmVzb2x2ZVByb21pc2U6IFByb21pc2U8QmFja0xheWVyV2ViVmlldzxJQ29tbW9uQ2VsbEluZm8+IHwgbnVsbD4gfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBfd2Vidmlld1RyYW5zcGFyZW50Q292ZXI6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgX2xpc3REZWxlZ2F0ZTogTm90ZWJvb2tDZWxsTGlzdERlbGVnYXRlIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgX2xpc3QhOiBJTm90ZWJvb2tDZWxsTGlzdDtcblx0cHJpdmF0ZSBfbGlzdFZpZXdJbmZvQWNjZXNzb3IhOiBMaXN0Vmlld0luZm9BY2Nlc3Nvcjtcblx0cHJpdmF0ZSBfZG5kQ29udHJvbGxlcjogQ2VsbERyYWdBbmREcm9wQ29udHJvbGxlciB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIF9saXN0VG9wQ2VsbFRvb2xiYXI6IExpc3RUb3BDZWxsVG9vbGJhciB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIF9yZW5kZXJlZEVkaXRvcnM6IE1hcDxJQ2VsbFZpZXdNb2RlbCwgSUNvZGVFZGl0b3I+ID0gbmV3IE1hcCgpO1xuXHRwcml2YXRlIF9lZGl0b3JQb29sITogTm90ZWJvb2tDZWxsRWRpdG9yUG9vbDtcblx0cHJpdmF0ZSBfdmlld0NvbnRleHQ6IFZpZXdDb250ZXh0O1xuXHRwcml2YXRlIF9ub3RlYm9va1ZpZXdNb2RlbDogTm90ZWJvb2tWaWV3TW9kZWwgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2xvY2FsU3RvcmU6IERpc3Bvc2FibGVTdG9yZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgX2xvY2FsQ2VsbFN0YXRlTGlzdGVuZXJzOiBEaXNwb3NhYmxlU3RvcmVbXSA9IFtdO1xuXHRwcml2YXRlIF9mb250SW5mbzogRm9udEluZm8gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2RpbWVuc2lvbj86IERPTS5EaW1lbnNpb247XG5cdHByaXZhdGUgX3Bvc2l0aW9uPzogRE9NLklEb21Qb3NpdGlvbjtcblx0cHJpdmF0ZSBfc2hhZG93RWxlbWVudD86IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIF9zaGFkb3dFbGVtZW50Vmlld0luZm86IHsgaGVpZ2h0OiBudW1iZXI7IHdpZHRoOiBudW1iZXI7IHRvcDogbnVtYmVyOyBsZWZ0OiBudW1iZXIgfSB8IG51bGwgPSBudWxsO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvckZvY3VzOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfb3V0cHV0Rm9jdXM6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JFZGl0YWJsZTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2N1cnNvck5hdk1vZGU6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vdXRwdXRJbnB1dEZvY3VzOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9jb250cmlidXRpb25zID0gbmV3IE1hcDxzdHJpbmcsIElOb3RlYm9va0VkaXRvckNvbnRyaWJ1dGlvbj4oKTtcblx0cHJpdmF0ZSBfc2Nyb2xsQmV5b25kTGFzdExpbmU6IGJvb2xlYW47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2luc2V0TW9kaWZ5UXVldWVCeU91dHB1dElkID0gbmV3IFNlcXVlbmNlckJ5S2V5PHN0cmluZz4oKTtcblx0cHJpdmF0ZSBfY2VsbENvbnRleHRLZXlNYW5hZ2VyOiBDZWxsQ29udGV4dEtleU1hbmFnZXIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSByZWFkb25seSBfdXVpZCA9IGdlbmVyYXRlVXVpZCgpO1xuXHRwcml2YXRlIF9mb2N1c1RyYWNrZXIhOiBET00uSUZvY3VzVHJhY2tlcjtcblx0cHJpdmF0ZSBfd2Vidmlld0ZvY3VzZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfaXNWaXNpYmxlID0gZmFsc2U7XG5cdGdldCBpc1Zpc2libGUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2lzVmlzaWJsZTtcblx0fVxuXG5cdHByaXZhdGUgX2lzRGlzcG9zZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRnZXQgaXNEaXNwb3NlZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5faXNEaXNwb3NlZDtcblx0fVxuXG5cdHNldCB2aWV3TW9kZWwobmV3TW9kZWw6IE5vdGVib29rVmlld01vZGVsIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fb25XaWxsQ2hhbmdlTW9kZWwuZmlyZSh0aGlzLl9ub3RlYm9va1ZpZXdNb2RlbD8ubm90ZWJvb2tEb2N1bWVudCk7XG5cdFx0dGhpcy5fbm90ZWJvb2tWaWV3TW9kZWwgPSBuZXdNb2RlbDtcblx0XHR0aGlzLl9vbkRpZENoYW5nZU1vZGVsLmZpcmUobmV3TW9kZWw/Lm5vdGVib29rRG9jdW1lbnQpO1xuXHR9XG5cblx0Z2V0IHZpZXdNb2RlbCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbm90ZWJvb2tWaWV3TW9kZWw7XG5cdH1cblxuXHRnZXQgdGV4dE1vZGVsKCkge1xuXHRcdHJldHVybiB0aGlzLl9ub3RlYm9va1ZpZXdNb2RlbD8ubm90ZWJvb2tEb2N1bWVudDtcblx0fVxuXG5cdGdldCBpc1JlYWRPbmx5KCkge1xuXHRcdHJldHVybiB0aGlzLl9ub3RlYm9va1ZpZXdNb2RlbD8ub3B0aW9ucy5pc1JlYWRPbmx5ID8/IGZhbHNlO1xuXHR9XG5cblx0Z2V0IGFjdGl2ZUNvZGVFZGl0b3IoKTogSUNvZGVFZGl0b3IgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgW2ZvY3VzZWRdID0gdGhpcy5fbGlzdC5nZXRGb2N1c2VkRWxlbWVudHMoKTtcblx0XHRyZXR1cm4gdGhpcy5fcmVuZGVyZWRFZGl0b3JzLmdldChmb2N1c2VkKTtcblx0fVxuXG5cdGdldCBhY3RpdmVDZWxsQW5kQ29kZUVkaXRvcigpOiBbSUNlbGxWaWV3TW9kZWwsIElDb2RlRWRpdG9yXSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMuX2lzRGlzcG9zZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBbZm9jdXNlZF0gPSB0aGlzLl9saXN0LmdldEZvY3VzZWRFbGVtZW50cygpO1xuXHRcdGNvbnN0IGVkaXRvciA9IHRoaXMuX3JlbmRlcmVkRWRpdG9ycy5nZXQoZm9jdXNlZCk7XG5cdFx0aWYgKCFlZGl0b3IpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cmV0dXJuIFtmb2N1c2VkLCBlZGl0b3JdO1xuXHR9XG5cblx0Z2V0IGNvZGVFZGl0b3JzKCk6IFtJQ2VsbFZpZXdNb2RlbCwgSUNvZGVFZGl0b3JdW10ge1xuXHRcdHJldHVybiBbLi4udGhpcy5fcmVuZGVyZWRFZGl0b3JzXTtcblx0fVxuXG5cdGdldCB2aXNpYmxlUmFuZ2VzKCkge1xuXHRcdHJldHVybiB0aGlzLl9saXN0ID8gKHRoaXMuX2xpc3QudmlzaWJsZVJhbmdlcyB8fCBbXSkgOiBbXTtcblx0fVxuXG5cdHByaXZhdGUgX2Jhc2VDZWxsRWRpdG9yT3B0aW9ucyA9IG5ldyBNYXA8c3RyaW5nLCBJQmFzZUNlbGxFZGl0b3JPcHRpb25zPigpO1xuXG5cdHJlYWRvbmx5IGlzUmVwbEhpc3Rvcnk6IGJvb2xlYW47XG5cdHByaXZhdGUgX3JlYWRPbmx5OiBib29sZWFuO1xuXG5cdHB1YmxpYyByZWFkb25seSBzY29wZWRDb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rT3B0aW9uczogTm90ZWJvb2tPcHRpb25zO1xuXG5cdHByaXZhdGUgX2N1cnJlbnRQcm9ncmVzczogSVByb2dyZXNzUnVubmVyIHwgdW5kZWZpbmVkO1xuXG5cdGdldCBub3RlYm9va09wdGlvbnMoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX25vdGVib29rT3B0aW9ucztcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGNyZWF0aW9uT3B0aW9uczogSU5vdGVib29rRWRpdG9yQ3JlYXRpb25PcHRpb25zLFxuXHRcdGRpbWVuc2lvbjogRE9NLkRpbWVuc2lvbiB8IHVuZGVmaW5lZCxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElFZGl0b3JHcm91cHNTZXJ2aWNlIGVkaXRvckdyb3Vwc1NlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tSZW5kZXJlck1lc3NhZ2luZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RlYm9va1JlbmRlcmVyTWVzc2FnaW5nOiBJTm90ZWJvb2tSZW5kZXJlck1lc3NhZ2luZ1NlcnZpY2UsXG5cdFx0QElOb3RlYm9va0VkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RlYm9va0VkaXRvclNlcnZpY2U6IElOb3RlYm9va0VkaXRvclNlcnZpY2UsXG5cdFx0QElOb3RlYm9va0tlcm5lbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RlYm9va0tlcm5lbFNlcnZpY2U6IElOb3RlYm9va0tlcm5lbFNlcnZpY2UsXG5cdFx0QElOb3RlYm9va1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tTZXJ2aWNlOiBJTm90ZWJvb2tTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUxheW91dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYXlvdXRTZXJ2aWNlOiBJTGF5b3V0U2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASU5vdGVib29rRXhlY3V0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGVib29rRXhlY3V0aW9uU2VydmljZTogSU5vdGVib29rRXhlY3V0aW9uU2VydmljZSxcblx0XHRASUVkaXRvclByb2dyZXNzU2VydmljZSBwcml2YXRlIGVkaXRvclByb2dyZXNzU2VydmljZTogSUVkaXRvclByb2dyZXNzU2VydmljZSxcblx0XHRASU5vdGVib29rTG9nZ2luZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTm90ZWJvb2tMb2dnaW5nU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX2RpbWVuc2lvbiA9IGRpbWVuc2lvbjtcblxuXHRcdHRoaXMuaXNSZXBsSGlzdG9yeSA9IGNyZWF0aW9uT3B0aW9ucy5pc1JlcGxIaXN0b3J5ID8/IGZhbHNlO1xuXHRcdHRoaXMuX3JlYWRPbmx5ID0gY3JlYXRpb25PcHRpb25zLmlzUmVhZE9ubHkgPz8gZmFsc2U7XG5cblx0XHR0aGlzLl9vdmVybGF5Q29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dGhpcy5zY29wZWRDb250ZXh0S2V5U2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKGNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZCh0aGlzLl9vdmVybGF5Q29udGFpbmVyKSk7XG5cdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbSUNvbnRleHRLZXlTZXJ2aWNlLCB0aGlzLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlXSkpKTtcblxuXHRcdHRoaXMuX25vdGVib29rT3B0aW9ucyA9IGNyZWF0aW9uT3B0aW9ucy5vcHRpb25zID8/XG5cdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vdGVib29rT3B0aW9ucywgdGhpcy5jcmVhdGlvbk9wdGlvbnM/LmNvZGVXaW5kb3cgPz8gbWFpbldpbmRvdywgdGhpcy5fcmVhZE9ubHksIHVuZGVmaW5lZCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbm90ZWJvb2tPcHRpb25zKTtcblx0XHRjb25zdCBldmVudERpc3BhdGNoZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgTm90ZWJvb2tFdmVudERpc3BhdGNoZXIoKSk7XG5cdFx0dGhpcy5fdmlld0NvbnRleHQgPSBuZXcgVmlld0NvbnRleHQoXG5cdFx0XHR0aGlzLl9ub3RlYm9va09wdGlvbnMsXG5cdFx0XHRldmVudERpc3BhdGNoZXIsXG5cdFx0XHRsYW5ndWFnZSA9PiB0aGlzLmdldEJhc2VDZWxsRWRpdG9yT3B0aW9ucyhsYW5ndWFnZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3ZpZXdDb250ZXh0LmV2ZW50RGlzcGF0Y2hlci5vbkRpZENoYW5nZUxheW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUxheW91dC5maXJlKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3ZpZXdDb250ZXh0LmV2ZW50RGlzcGF0Y2hlci5vbkRpZENoYW5nZUNlbGxTdGF0ZShlID0+IHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQ2VsbFN0YXRlLmZpcmUoZSk7XG5cdFx0fSkpO1xuXG5cblx0XHR0aGlzLl9yZWdpc3Rlcihfbm90ZWJvb2tTZXJ2aWNlLm9uRGlkQ2hhbmdlT3V0cHV0UmVuZGVyZXJzKCgpID0+IHtcblx0XHRcdHRoaXMuX3VwZGF0ZU91dHB1dFJlbmRlcmVycygpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90ZWJvb2tFZGl0b3JDb250ZXh0S2V5cywgdGhpcykpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIobm90ZWJvb2tLZXJuZWxTZXJ2aWNlLm9uRGlkQ2hhbmdlU2VsZWN0ZWROb3RlYm9va3MoZSA9PiB7XG5cdFx0XHRpZiAoaXNFcXVhbChlLm5vdGVib29rLCB0aGlzLnZpZXdNb2RlbD8udXJpKSkge1xuXHRcdFx0XHR0aGlzLl9sb2FkS2VybmVsUHJlbG9hZHMoKTtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVLZXJuZWwuZmlyZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3Njcm9sbEJleW9uZExhc3RMaW5lID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPignZWRpdG9yLnNjcm9sbEJleW9uZExhc3RMaW5lJyk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdlZGl0b3Iuc2Nyb2xsQmV5b25kTGFzdExpbmUnKSkge1xuXHRcdFx0XHR0aGlzLl9zY3JvbGxCZXlvbmRMYXN0TGluZSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ2VkaXRvci5zY3JvbGxCZXlvbmRMYXN0TGluZScpO1xuXHRcdFx0XHRpZiAodGhpcy5fZGltZW5zaW9uICYmIHRoaXMuX2lzVmlzaWJsZSkge1xuXHRcdFx0XHRcdHRoaXMubGF5b3V0KHRoaXMuX2RpbWVuc2lvbik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9ub3RlYm9va09wdGlvbnMub25EaWRDaGFuZ2VPcHRpb25zKGUgPT4ge1xuXHRcdFx0aWYgKGUuY2VsbFN0YXR1c0JhclZpc2liaWxpdHkgfHwgZS5jZWxsVG9vbGJhckxvY2F0aW9uIHx8IGUuY2VsbFRvb2xiYXJJbnRlcmFjdGlvbikge1xuXHRcdFx0XHR0aGlzLl91cGRhdGVGb3JOb3RlYm9va0NvbmZpZ3VyYXRpb24oKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGUuZm9udEZhbWlseSkge1xuXHRcdFx0XHR0aGlzLl9nZW5lcmF0ZUZvbnRJbmZvKCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlLmNvbXBhY3RWaWV3XG5cdFx0XHRcdHx8IGUuZm9jdXNJbmRpY2F0b3Jcblx0XHRcdFx0fHwgZS5pbnNlcnRUb29sYmFyUG9zaXRpb25cblx0XHRcdFx0fHwgZS5jZWxsVG9vbGJhckxvY2F0aW9uXG5cdFx0XHRcdHx8IGUuZHJhZ0FuZERyb3BFbmFibGVkXG5cdFx0XHRcdHx8IGUuZm9udFNpemVcblx0XHRcdFx0fHwgZS5tYXJrdXBGb250U2l6ZVxuXHRcdFx0XHR8fCBlLm1hcmtkb3duTGluZUhlaWdodFxuXHRcdFx0XHR8fCBlLmZvbnRGYW1pbHlcblx0XHRcdFx0fHwgZS5pbnNlcnRUb29sYmFyQWxpZ25tZW50XG5cdFx0XHRcdHx8IGUub3V0cHV0Rm9udFNpemVcblx0XHRcdFx0fHwgZS5vdXRwdXRMaW5lSGVpZ2h0XG5cdFx0XHRcdHx8IGUub3V0cHV0Rm9udEZhbWlseVxuXHRcdFx0XHR8fCBlLm91dHB1dFdvcmRXcmFwXG5cdFx0XHRcdHx8IGUub3V0cHV0U2Nyb2xsaW5nXG5cdFx0XHRcdHx8IGUub3V0cHV0TGlua2lmeUZpbGVQYXRoc1xuXHRcdFx0XHR8fCBlLm1pbmltYWxFcnJvclxuXHRcdFx0KSB7XG5cdFx0XHRcdHRoaXMuX3N0eWxlRWxlbWVudD8ucmVtb3ZlKCk7XG5cdFx0XHRcdHRoaXMuX2NyZWF0ZUxheW91dFN0eWxlcygpO1xuXHRcdFx0XHR0aGlzLl93ZWJ2aWV3Py51cGRhdGVPcHRpb25zKHtcblx0XHRcdFx0XHQuLi50aGlzLm5vdGVib29rT3B0aW9ucy5jb21wdXRlV2Vidmlld09wdGlvbnMoKSxcblx0XHRcdFx0XHRmb250RmFtaWx5OiB0aGlzLl9nZW5lcmF0ZUZvbnRGYW1pbHkoKVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuX2RpbWVuc2lvbiAmJiB0aGlzLl9pc1Zpc2libGUpIHtcblx0XHRcdFx0dGhpcy5sYXlvdXQodGhpcy5fZGltZW5zaW9uKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCBjb250YWluZXIgPSBjcmVhdGlvbk9wdGlvbnMuY29kZVdpbmRvdyA/IHRoaXMubGF5b3V0U2VydmljZS5nZXRDb250YWluZXIoY3JlYXRpb25PcHRpb25zLmNvZGVXaW5kb3cpIDogdGhpcy5sYXlvdXRTZXJ2aWNlLm1haW5Db250YWluZXI7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdG9yR3JvdXBzU2VydmljZS5nZXRQYXJ0KGNvbnRhaW5lcikub25EaWRTY3JvbGwoZSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuX3NoYWRvd0VsZW1lbnQgfHwgIXRoaXMuX2lzVmlzaWJsZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMudXBkYXRlU2hhZG93RWxlbWVudCh0aGlzLl9zaGFkb3dFbGVtZW50LCB0aGlzLl9kaW1lbnNpb24pO1xuXHRcdFx0dGhpcy5sYXlvdXRDb250YWluZXJPdmVyU2hhZG93RWxlbWVudCh0aGlzLl9kaW1lbnNpb24sIHRoaXMuX3Bvc2l0aW9uKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLm5vdGVib29rRWRpdG9yU2VydmljZS5hZGROb3RlYm9va0VkaXRvcih0aGlzKTtcblxuXHRcdGNvbnN0IGlkID0gZ2VuZXJhdGVVdWlkKCk7XG5cdFx0dGhpcy5fb3ZlcmxheUNvbnRhaW5lci5pZCA9IGBub3RlYm9vay0ke2lkfWA7XG5cdFx0dGhpcy5fb3ZlcmxheUNvbnRhaW5lci5jbGFzc05hbWUgPSAnbm90ZWJvb2tPdmVybGF5Jztcblx0XHR0aGlzLl9vdmVybGF5Q29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ25vdGVib29rLWVkaXRvcicpO1xuXHRcdHRoaXMuX292ZXJsYXlDb250YWluZXIuaW5lcnQgPSB0cnVlO1xuXHRcdHRoaXMuX292ZXJsYXlDb250YWluZXIuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuXG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX292ZXJsYXlDb250YWluZXIpO1xuXG5cdFx0dGhpcy5fY3JlYXRlQm9keSh0aGlzLl9vdmVybGF5Q29udGFpbmVyKTtcblx0XHR0aGlzLl9nZW5lcmF0ZUZvbnRJbmZvKCk7XG5cdFx0dGhpcy5faXNWaXNpYmxlID0gdHJ1ZTtcblx0XHR0aGlzLl9lZGl0b3JGb2N1cyA9IE5PVEVCT09LX0VESVRPUl9GT0NVU0VELmJpbmRUbyh0aGlzLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9vdXRwdXRGb2N1cyA9IE5PVEVCT09LX09VVFBVVF9GT0NVU0VELmJpbmRUbyh0aGlzLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9vdXRwdXRJbnB1dEZvY3VzID0gTk9URUJPT0tfT1VUUFVUX0lOUFVUX0ZPQ1VTRUQuYmluZFRvKHRoaXMuc2NvcGVkQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX2VkaXRvckVkaXRhYmxlID0gTk9URUJPT0tfRURJVE9SX0VESVRBQkxFLmJpbmRUbyh0aGlzLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9jdXJzb3JOYXZNb2RlID0gTk9URUJPT0tfQ1VSU09SX05BVklHQVRJT05fTU9ERS5iaW5kVG8odGhpcy5zY29wZWRDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Ly8gTmV2ZXIgZGlzcGxheSB0aGUgbmF0aXZlIGN1dC9jb3B5IGNvbnRleHQgbWVudSBpdGVtcyBpbiBub3RlYm9va3Ncblx0XHRuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPihQcmV2ZW50RGVmYXVsdENvbnRleHRNZW51SXRlbXNDb250ZXh0S2V5TmFtZSwgZmFsc2UpLmJpbmRUbyh0aGlzLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKS5zZXQodHJ1ZSk7XG5cblx0XHR0aGlzLl9lZGl0b3JFZGl0YWJsZS5zZXQoIWNyZWF0aW9uT3B0aW9ucy5pc1JlYWRPbmx5KTtcblxuXHRcdGxldCBjb250cmlidXRpb25zOiBJTm90ZWJvb2tFZGl0b3JDb250cmlidXRpb25EZXNjcmlwdGlvbltdO1xuXHRcdGlmIChBcnJheS5pc0FycmF5KHRoaXMuY3JlYXRpb25PcHRpb25zLmNvbnRyaWJ1dGlvbnMpKSB7XG5cdFx0XHRjb250cmlidXRpb25zID0gdGhpcy5jcmVhdGlvbk9wdGlvbnMuY29udHJpYnV0aW9ucztcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29udHJpYnV0aW9ucyA9IE5vdGVib29rRWRpdG9yRXh0ZW5zaW9uc1JlZ2lzdHJ5LmdldEVkaXRvckNvbnRyaWJ1dGlvbnMoKTtcblx0XHR9XG5cdFx0Zm9yIChjb25zdCBkZXNjIG9mIGNvbnRyaWJ1dGlvbnMpIHtcblx0XHRcdGxldCBjb250cmlidXRpb246IElOb3RlYm9va0VkaXRvckNvbnRyaWJ1dGlvbiB8IHVuZGVmaW5lZDtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnRyaWJ1dGlvbiA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoZGVzYy5jdG9yLCB0aGlzKTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlcnIpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGNvbnRyaWJ1dGlvbikge1xuXHRcdFx0XHRpZiAoIXRoaXMuX2NvbnRyaWJ1dGlvbnMuaGFzKGRlc2MuaWQpKSB7XG5cdFx0XHRcdFx0dGhpcy5fY29udHJpYnV0aW9ucy5zZXQoZGVzYy5pZCwgY29udHJpYnV0aW9uKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb250cmlidXRpb24uZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihgRFVQTElDQVRFIG5vdGVib29rIGVkaXRvciBjb250cmlidXRpb246ICcke2Rlc2MuaWR9J2ApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fdXBkYXRlRm9yTm90ZWJvb2tDb25maWd1cmF0aW9uKCk7XG5cdH1cblxuXHRwcml2YXRlIF9kZWJ1Z0ZsYWc6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRwcml2YXRlIF9kZWJ1ZyguLi5hcmdzOiBhbnlbXSkge1xuXHRcdGlmICghdGhpcy5fZGVidWdGbGFnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bm90ZWJvb2tEZWJ1ZyguLi5hcmdzKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBFZGl0b3JJZFxuXHQgKi9cblx0cHVibGljIGdldElkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX3V1aWQ7XG5cdH1cblxuXHRnZXRWaWV3TW9kZWwoKTogTm90ZWJvb2tWaWV3TW9kZWwgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnZpZXdNb2RlbDtcblx0fVxuXG5cdGdldExlbmd0aCgpIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3TW9kZWw/Lmxlbmd0aCA/PyAwO1xuXHR9XG5cblx0Z2V0U2VsZWN0aW9ucygpIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3TW9kZWw/LmdldFNlbGVjdGlvbnMoKSA/PyBbXTtcblx0fVxuXG5cdHNldFNlbGVjdGlvbnMoc2VsZWN0aW9uczogSUNlbGxSYW5nZVtdKSB7XG5cdFx0aWYgKCF0aGlzLnZpZXdNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZvY3VzID0gdGhpcy52aWV3TW9kZWwuZ2V0Rm9jdXMoKTtcblx0XHR0aGlzLnZpZXdNb2RlbC51cGRhdGVTZWxlY3Rpb25zU3RhdGUoe1xuXHRcdFx0a2luZDogU2VsZWN0aW9uU3RhdGVUeXBlLkluZGV4LFxuXHRcdFx0Zm9jdXM6IGZvY3VzLFxuXHRcdFx0c2VsZWN0aW9uczogc2VsZWN0aW9uc1xuXHRcdH0pO1xuXHR9XG5cblx0Z2V0Rm9jdXMoKSB7XG5cdFx0cmV0dXJuIHRoaXMudmlld01vZGVsPy5nZXRGb2N1cygpID8/IHsgc3RhcnQ6IDAsIGVuZDogMCB9O1xuXHR9XG5cblx0c2V0Rm9jdXMoZm9jdXM6IElDZWxsUmFuZ2UpIHtcblx0XHRpZiAoIXRoaXMudmlld01vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IHRoaXMudmlld01vZGVsLmdldFNlbGVjdGlvbnMoKTtcblx0XHR0aGlzLnZpZXdNb2RlbC51cGRhdGVTZWxlY3Rpb25zU3RhdGUoe1xuXHRcdFx0a2luZDogU2VsZWN0aW9uU3RhdGVUeXBlLkluZGV4LFxuXHRcdFx0Zm9jdXM6IGZvY3VzLFxuXHRcdFx0c2VsZWN0aW9uczogc2VsZWN0aW9uc1xuXHRcdH0pO1xuXHR9XG5cblx0Z2V0U2VsZWN0aW9uVmlld01vZGVscygpOiBJQ2VsbFZpZXdNb2RlbFtdIHtcblx0XHRpZiAoIXRoaXMudmlld01vZGVsKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2VsbHNTZXQgPSBuZXcgU2V0PG51bWJlcj4oKTtcblxuXHRcdHJldHVybiB0aGlzLnZpZXdNb2RlbC5nZXRTZWxlY3Rpb25zKCkubWFwKHJhbmdlID0+IHRoaXMudmlld01vZGVsIS52aWV3Q2VsbHMuc2xpY2UocmFuZ2Uuc3RhcnQsIHJhbmdlLmVuZCkpLnJlZHVjZSgoYSwgYikgPT4ge1xuXHRcdFx0Yi5mb3JFYWNoKGNlbGwgPT4ge1xuXHRcdFx0XHRpZiAoIWNlbGxzU2V0LmhhcyhjZWxsLmhhbmRsZSkpIHtcblx0XHRcdFx0XHRjZWxsc1NldC5hZGQoY2VsbC5oYW5kbGUpO1xuXHRcdFx0XHRcdGEucHVzaChjZWxsKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdHJldHVybiBhO1xuXHRcdH0sIFtdIGFzIElDZWxsVmlld01vZGVsW10pO1xuXHR9XG5cblx0aGFzTW9kZWwoKTogdGhpcyBpcyBJQWN0aXZlTm90ZWJvb2tFZGl0b3JEZWxlZ2F0ZSB7XG5cdFx0cmV0dXJuICEhdGhpcy5fbm90ZWJvb2tWaWV3TW9kZWw7XG5cdH1cblxuXHRzaG93UHJvZ3Jlc3MoKTogdm9pZCB7XG5cdFx0dGhpcy5fY3VycmVudFByb2dyZXNzID0gdGhpcy5lZGl0b3JQcm9ncmVzc1NlcnZpY2Uuc2hvdyh0cnVlKTtcblx0fVxuXG5cdGhpZGVQcm9ncmVzcygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fY3VycmVudFByb2dyZXNzKSB7XG5cdFx0XHR0aGlzLl9jdXJyZW50UHJvZ3Jlc3MuZG9uZSgpO1xuXHRcdFx0dGhpcy5fY3VycmVudFByb2dyZXNzID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdC8vI3JlZ2lvbiBFZGl0b3IgQ29yZVxuXG5cdGdldEJhc2VDZWxsRWRpdG9yT3B0aW9ucyhsYW5ndWFnZTogc3RyaW5nKTogSUJhc2VDZWxsRWRpdG9yT3B0aW9ucyB7XG5cdFx0Y29uc3QgZXhpc3RpbmdPcHRpb25zID0gdGhpcy5fYmFzZUNlbGxFZGl0b3JPcHRpb25zLmdldChsYW5ndWFnZSk7XG5cblx0XHRpZiAoZXhpc3RpbmdPcHRpb25zKSB7XG5cdFx0XHRyZXR1cm4gZXhpc3RpbmdPcHRpb25zO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBvcHRpb25zID0gbmV3IEJhc2VDZWxsRWRpdG9yT3B0aW9ucyh0aGlzLCB0aGlzLm5vdGVib29rT3B0aW9ucywgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgbGFuZ3VhZ2UpO1xuXHRcdFx0dGhpcy5fYmFzZUNlbGxFZGl0b3JPcHRpb25zLnNldChsYW5ndWFnZSwgb3B0aW9ucyk7XG5cdFx0XHRyZXR1cm4gb3B0aW9ucztcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVGb3JOb3RlYm9va0NvbmZpZ3VyYXRpb24oKSB7XG5cdFx0aWYgKCF0aGlzLl9vdmVybGF5Q29udGFpbmVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fb3ZlcmxheUNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdjZWxsLXRpdGxlLXRvb2xiYXItbGVmdCcpO1xuXHRcdHRoaXMuX292ZXJsYXlDb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZSgnY2VsbC10aXRsZS10b29sYmFyLXJpZ2h0Jyk7XG5cdFx0dGhpcy5fb3ZlcmxheUNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdjZWxsLXRpdGxlLXRvb2xiYXItaGlkZGVuJyk7XG5cdFx0Y29uc3QgY2VsbFRvb2xiYXJMb2NhdGlvbiA9IHRoaXMuX25vdGVib29rT3B0aW9ucy5jb21wdXRlQ2VsbFRvb2xiYXJMb2NhdGlvbih0aGlzLnZpZXdNb2RlbD8udmlld1R5cGUpO1xuXHRcdHRoaXMuX292ZXJsYXlDb250YWluZXIuY2xhc3NMaXN0LmFkZChgY2VsbC10aXRsZS10b29sYmFyLSR7Y2VsbFRvb2xiYXJMb2NhdGlvbn1gKTtcblxuXHRcdGNvbnN0IGNlbGxUb29sYmFySW50ZXJhY3Rpb24gPSB0aGlzLl9ub3RlYm9va09wdGlvbnMuZ2V0RGlzcGxheU9wdGlvbnMoKS5jZWxsVG9vbGJhckludGVyYWN0aW9uO1xuXHRcdGxldCBjZWxsVG9vbGJhckludGVyYWN0aW9uU3RhdGUgPSAnaG92ZXInO1xuXHRcdHRoaXMuX292ZXJsYXlDb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZSgnY2VsbC10b29sYmFyLWhvdmVyJyk7XG5cdFx0dGhpcy5fb3ZlcmxheUNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdjZWxsLXRvb2xiYXItY2xpY2snKTtcblxuXHRcdGlmIChjZWxsVG9vbGJhckludGVyYWN0aW9uID09PSAnaG92ZXInIHx8IGNlbGxUb29sYmFySW50ZXJhY3Rpb24gPT09ICdjbGljaycpIHtcblx0XHRcdGNlbGxUb29sYmFySW50ZXJhY3Rpb25TdGF0ZSA9IGNlbGxUb29sYmFySW50ZXJhY3Rpb247XG5cdFx0fVxuXHRcdHRoaXMuX292ZXJsYXlDb250YWluZXIuY2xhc3NMaXN0LmFkZChgY2VsbC10b29sYmFyLSR7Y2VsbFRvb2xiYXJJbnRlcmFjdGlvblN0YXRlfWApO1xuXG5cdH1cblxuXHRwcml2YXRlIF9nZW5lcmF0ZUZvbnRJbmZvKCk6IHZvaWQge1xuXHRcdGNvbnN0IGVkaXRvck9wdGlvbnMgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElFZGl0b3JPcHRpb25zPignZWRpdG9yJyk7XG5cdFx0Y29uc3QgdGFyZ2V0V2luZG93ID0gRE9NLmdldFdpbmRvdyh0aGlzLmdldERvbU5vZGUoKSk7XG5cdFx0dGhpcy5fZm9udEluZm8gPSBGb250TWVhc3VyZW1lbnRzLnJlYWRGb250SW5mbyh0YXJnZXRXaW5kb3csIEJhcmVGb250SW5mby5jcmVhdGVGcm9tUmF3U2V0dGluZ3MoZWRpdG9yT3B0aW9ucywgUGl4ZWxSYXRpby5nZXRJbnN0YW5jZSh0YXJnZXRXaW5kb3cpLnZhbHVlKSk7XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVCb2R5KHBhcmVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHR0aGlzLl9ub3RlYm9va1RvcFRvb2xiYXJDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLl9ub3RlYm9va1RvcFRvb2xiYXJDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnbm90ZWJvb2stdG9vbGJhci1jb250YWluZXInKTtcblx0XHR0aGlzLl9ub3RlYm9va1RvcFRvb2xiYXJDb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRET00uYXBwZW5kKHBhcmVudCwgdGhpcy5fbm90ZWJvb2tUb3BUb29sYmFyQ29udGFpbmVyKTtcblxuXHRcdHRoaXMuX25vdGVib29rU3RpY2t5U2Nyb2xsQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dGhpcy5fbm90ZWJvb2tTdGlja3lTY3JvbGxDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnbm90ZWJvb2stc3RpY2t5LXNjcm9sbC1jb250YWluZXInKTtcblx0XHRET00uYXBwZW5kKHBhcmVudCwgdGhpcy5fbm90ZWJvb2tTdGlja3lTY3JvbGxDb250YWluZXIpO1xuXG5cdFx0dGhpcy5fYm9keSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdERPTS5hcHBlbmQocGFyZW50LCB0aGlzLl9ib2R5KTtcblxuXHRcdHRoaXMuX2JvZHkuY2xhc3NMaXN0LmFkZCgnY2VsbC1saXN0LWNvbnRhaW5lcicpO1xuXHRcdHRoaXMuX2NyZWF0ZUxheW91dFN0eWxlcygpO1xuXHRcdHRoaXMuX2NyZWF0ZUNlbGxMaXN0KCk7XG5cblx0XHR0aGlzLl9ub3RlYm9va092ZXJ2aWV3UnVsZXJDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLl9ub3RlYm9va092ZXJ2aWV3UnVsZXJDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnbm90ZWJvb2stb3ZlcnZpZXctcnVsZXItY29udGFpbmVyJyk7XG5cdFx0dGhpcy5fbGlzdC5zY3JvbGxhYmxlRWxlbWVudC5hcHBlbmRDaGlsZCh0aGlzLl9ub3RlYm9va092ZXJ2aWV3UnVsZXJDb250YWluZXIpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyTm90ZWJvb2tPdmVydmlld1J1bGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vdGVib29rSG9yaXpvbnRhbFRyYWNrZXIsIHRoaXMsIHRoaXMuX2xpc3Quc2Nyb2xsYWJsZUVsZW1lbnQpKTtcblxuXHRcdHRoaXMuX292ZXJmbG93Q29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dGhpcy5fb3ZlcmZsb3dDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnbm90ZWJvb2stb3ZlcmZsb3ctd2lkZ2V0LWNvbnRhaW5lcicsICdtb25hY28tZWRpdG9yJyk7XG5cdFx0RE9NLmFwcGVuZChwYXJlbnQsIHRoaXMuX292ZXJmbG93Q29udGFpbmVyKTtcblx0fVxuXG5cdHByaXZhdGUgX2dlbmVyYXRlRm9udEZhbWlseSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fZm9udEluZm8/LmZvbnRGYW1pbHkgPz8gYFwiU0YgTW9ub1wiLCBNb25hY28sIE1lbmxvLCBDb25zb2xhcywgXCJVYnVudHUgTW9ub1wiLCBcIkxpYmVyYXRpb24gTW9ub1wiLCBcIkRlamFWdSBTYW5zIE1vbm9cIiwgXCJDb3VyaWVyIE5ld1wiLCBtb25vc3BhY2VgO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlTGF5b3V0U3R5bGVzKCk6IHZvaWQge1xuXHRcdHRoaXMuX3N0eWxlRWxlbWVudCA9IGRvbVN0eWxlc2hlZXRzLmNyZWF0ZVN0eWxlU2hlZXQodGhpcy5fYm9keSk7XG5cdFx0Y29uc3Qge1xuXHRcdFx0Y2VsbFJpZ2h0TWFyZ2luLFxuXHRcdFx0Y2VsbFRvcE1hcmdpbixcblx0XHRcdGNlbGxSdW5HdXR0ZXIsXG5cdFx0XHRjZWxsQm90dG9tTWFyZ2luLFxuXHRcdFx0Y29kZUNlbGxMZWZ0TWFyZ2luLFxuXHRcdFx0bWFya2Rvd25DZWxsR3V0dGVyLFxuXHRcdFx0bWFya2Rvd25DZWxsTGVmdE1hcmdpbixcblx0XHRcdG1hcmtkb3duQ2VsbEJvdHRvbU1hcmdpbixcblx0XHRcdG1hcmtkb3duQ2VsbFRvcE1hcmdpbixcblx0XHRcdGNvbGxhcHNlZEluZGljYXRvckhlaWdodCxcblx0XHRcdGZvY3VzSW5kaWNhdG9yLFxuXHRcdFx0aW5zZXJ0VG9vbGJhclBvc2l0aW9uLFxuXHRcdFx0b3V0cHV0Rm9udFNpemUsXG5cdFx0XHRmb2N1c0luZGljYXRvckxlZnRNYXJnaW4sXG5cdFx0XHRmb2N1c0luZGljYXRvckdhcFxuXHRcdH0gPSB0aGlzLl9ub3RlYm9va09wdGlvbnMuZ2V0TGF5b3V0Q29uZmlndXJhdGlvbigpO1xuXG5cdFx0Y29uc3Qge1xuXHRcdFx0aW5zZXJ0VG9vbGJhckFsaWdubWVudCxcblx0XHRcdGNvbXBhY3RWaWV3LFxuXHRcdFx0Zm9udFNpemVcblx0XHR9ID0gdGhpcy5fbm90ZWJvb2tPcHRpb25zLmdldERpc3BsYXlPcHRpb25zKCk7XG5cblx0XHRjb25zdCBnZXRDZWxsRWRpdG9yQ29udGFpbmVyTGVmdE1hcmdpbiA9IHRoaXMuX25vdGVib29rT3B0aW9ucy5nZXRDZWxsRWRpdG9yQ29udGFpbmVyTGVmdE1hcmdpbigpO1xuXG5cdFx0Y29uc3QgeyBib3R0b21Ub29sYmFyR2FwLCBib3R0b21Ub29sYmFySGVpZ2h0IH0gPSB0aGlzLl9ub3RlYm9va09wdGlvbnMuY29tcHV0ZUJvdHRvbVRvb2xiYXJEaW1lbnNpb25zKHRoaXMudmlld01vZGVsPy52aWV3VHlwZSk7XG5cblx0XHRjb25zdCBzdHlsZVNoZWV0czogc3RyaW5nW10gPSBbXTtcblx0XHRpZiAoIXRoaXMuX2ZvbnRJbmZvKSB7XG5cdFx0XHR0aGlzLl9nZW5lcmF0ZUZvbnRJbmZvKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZm9udEZhbWlseSA9IHRoaXMuX2dlbmVyYXRlRm9udEZhbWlseSgpO1xuXG5cdFx0c3R5bGVTaGVldHMucHVzaChgXG5cdFx0Lm5vdGVib29rLWVkaXRvciB7XG5cdFx0XHQtLW5vdGVib29rLWNlbGwtb3V0cHV0LWZvbnQtc2l6ZTogJHtvdXRwdXRGb250U2l6ZX1weDtcblx0XHRcdC0tbm90ZWJvb2stY2VsbC1pbnB1dC1wcmV2aWV3LWZvbnQtc2l6ZTogJHtmb250U2l6ZX1weDtcblx0XHRcdC0tbm90ZWJvb2stY2VsbC1pbnB1dC1wcmV2aWV3LWZvbnQtZmFtaWx5OiAke2ZvbnRGYW1pbHl9O1xuXHRcdH1cblx0XHRgKTtcblxuXHRcdGlmIChjb21wYWN0Vmlldykge1xuXHRcdFx0c3R5bGVTaGVldHMucHVzaChgLm5vdGVib29rT3ZlcmxheSAuY2VsbC1saXN0LWNvbnRhaW5lciA+IC5tb25hY28tbGlzdCA+IC5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50ID4gLm1vbmFjby1saXN0LXJvd3MgPiAubWFya2Rvd24tY2VsbC1yb3cgZGl2LmNlbGwuY29kZSB7IG1hcmdpbi1sZWZ0OiAke2dldENlbGxFZGl0b3JDb250YWluZXJMZWZ0TWFyZ2lufXB4OyB9YCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHN0eWxlU2hlZXRzLnB1c2goYC5ub3RlYm9va092ZXJsYXkgLmNlbGwtbGlzdC1jb250YWluZXIgPiAubW9uYWNvLWxpc3QgPiAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1hcmtkb3duLWNlbGwtcm93IGRpdi5jZWxsLmNvZGUgeyBtYXJnaW4tbGVmdDogJHtjb2RlQ2VsbExlZnRNYXJnaW59cHg7IH1gKTtcblx0XHR9XG5cblx0XHQvLyBmb2N1cyBpbmRpY2F0b3Jcblx0XHRpZiAoZm9jdXNJbmRpY2F0b3IgPT09ICdib3JkZXInKSB7XG5cdFx0XHRzdHlsZVNoZWV0cy5wdXNoKGBcblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkgLm1vbmFjby1saXN0IC5tb25hY28tbGlzdC1yb3cgLmNlbGwtZm9jdXMtaW5kaWNhdG9yLXRvcDpiZWZvcmUsXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAubm90ZWJvb2tPdmVybGF5IC5tb25hY28tbGlzdCAubW9uYWNvLWxpc3Qtcm93IC5jZWxsLWZvY3VzLWluZGljYXRvci1ib3R0b206YmVmb3JlLFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLm5vdGVib29rT3ZlcmxheSAubW9uYWNvLWxpc3QgLm1hcmtkb3duLWNlbGwtcm93IC5jZWxsLWlubmVyLWNvbnRhaW5lcjpiZWZvcmUsXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAubm90ZWJvb2tPdmVybGF5IC5tb25hY28tbGlzdCAubWFya2Rvd24tY2VsbC1yb3cgLmNlbGwtaW5uZXItY29udGFpbmVyOmFmdGVyIHtcblx0XHRcdFx0Y29udGVudDogXCJcIjtcblx0XHRcdFx0cG9zaXRpb246IGFic29sdXRlO1xuXHRcdFx0XHR3aWR0aDogMTAwJTtcblx0XHRcdFx0aGVpZ2h0OiAxcHg7XG5cdFx0XHR9XG5cblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkgLm1vbmFjby1saXN0IC5tb25hY28tbGlzdC1yb3cgLmNlbGwtZm9jdXMtaW5kaWNhdG9yLWxlZnQ6YmVmb3JlLFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLm5vdGVib29rT3ZlcmxheSAubW9uYWNvLWxpc3QgLm1vbmFjby1saXN0LXJvdyAuY2VsbC1mb2N1cy1pbmRpY2F0b3ItcmlnaHQ6YmVmb3JlIHtcblx0XHRcdFx0Y29udGVudDogXCJcIjtcblx0XHRcdFx0cG9zaXRpb246IGFic29sdXRlO1xuXHRcdFx0XHR3aWR0aDogMXB4O1xuXHRcdFx0XHRoZWlnaHQ6IDEwMCU7XG5cdFx0XHRcdHotaW5kZXg6IDEwO1xuXHRcdFx0fVxuXG5cdFx0XHQvKiB0b3AgYm9yZGVyICovXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAubm90ZWJvb2tPdmVybGF5IC5tb25hY28tbGlzdCAubW9uYWNvLWxpc3Qtcm93IC5jZWxsLWZvY3VzLWluZGljYXRvci10b3A6YmVmb3JlIHtcblx0XHRcdFx0Ym9yZGVyLXRvcDogMXB4IHNvbGlkIHRyYW5zcGFyZW50O1xuXHRcdFx0fVxuXG5cdFx0XHQvKiBsZWZ0IGJvcmRlciAqL1xuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLm5vdGVib29rT3ZlcmxheSAubW9uYWNvLWxpc3QgLm1vbmFjby1saXN0LXJvdyAuY2VsbC1mb2N1cy1pbmRpY2F0b3ItbGVmdDpiZWZvcmUge1xuXHRcdFx0XHRib3JkZXItbGVmdDogMXB4IHNvbGlkIHRyYW5zcGFyZW50O1xuXHRcdFx0fVxuXG5cdFx0XHQvKiBib3R0b20gYm9yZGVyICovXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAubm90ZWJvb2tPdmVybGF5IC5tb25hY28tbGlzdCAubW9uYWNvLWxpc3Qtcm93IC5jZWxsLWZvY3VzLWluZGljYXRvci1ib3R0b206YmVmb3JlIHtcblx0XHRcdFx0Ym9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHRyYW5zcGFyZW50O1xuXHRcdFx0fVxuXG5cdFx0XHQvKiByaWdodCBib3JkZXIgKi9cblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkgLm1vbmFjby1saXN0IC5tb25hY28tbGlzdC1yb3cgLmNlbGwtZm9jdXMtaW5kaWNhdG9yLXJpZ2h0OmJlZm9yZSB7XG5cdFx0XHRcdGJvcmRlci1yaWdodDogMXB4IHNvbGlkIHRyYW5zcGFyZW50O1xuXHRcdFx0fVxuXHRcdFx0YCk7XG5cblx0XHRcdC8vIGxlZnQgYW5kIHJpZ2h0IGJvcmRlciBtYXJnaW5zXG5cdFx0XHRzdHlsZVNoZWV0cy5wdXNoKGBcblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkgLm1vbmFjby1saXN0IC5tb25hY28tbGlzdC1yb3cuY29kZS1jZWxsLXJvdy5mb2N1c2VkIC5jZWxsLWZvY3VzLWluZGljYXRvci1sZWZ0OmJlZm9yZSxcblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkgLm1vbmFjby1saXN0IC5tb25hY28tbGlzdC1yb3cuY29kZS1jZWxsLXJvdy5mb2N1c2VkIC5jZWxsLWZvY3VzLWluZGljYXRvci1yaWdodDpiZWZvcmUsXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAubm90ZWJvb2tPdmVybGF5IC5tb25hY28tbGlzdC5zZWxlY3Rpb24tbXVsdGlwbGUgLm1vbmFjby1saXN0LXJvdy5jb2RlLWNlbGwtcm93LnNlbGVjdGVkIC5jZWxsLWZvY3VzLWluZGljYXRvci1sZWZ0OmJlZm9yZSxcblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkgLm1vbmFjby1saXN0LnNlbGVjdGlvbi1tdWx0aXBsZSAubW9uYWNvLWxpc3Qtcm93LmNvZGUtY2VsbC1yb3cuc2VsZWN0ZWQgLmNlbGwtZm9jdXMtaW5kaWNhdG9yLXJpZ2h0OmJlZm9yZSB7XG5cdFx0XHRcdHRvcDogLSR7Y2VsbFRvcE1hcmdpbn1weDsgaGVpZ2h0OiBjYWxjKDEwMCUgKyAke2NlbGxUb3BNYXJnaW4gKyBjZWxsQm90dG9tTWFyZ2lufXB4KVxuXHRcdFx0fWApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzdHlsZVNoZWV0cy5wdXNoKGBcblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkgLm1vbmFjby1saXN0IC5tb25hY28tbGlzdC1yb3cgLmNlbGwtZm9jdXMtaW5kaWNhdG9yLWxlZnQgLmNvZGVPdXRwdXQtZm9jdXMtaW5kaWNhdG9yIHtcblx0XHRcdFx0Ym9yZGVyLWxlZnQ6IDNweCBzb2xpZCB0cmFuc3BhcmVudDtcblx0XHRcdFx0Ym9yZGVyLXJhZGl1czogNHB4O1xuXHRcdFx0XHR3aWR0aDogMHB4O1xuXHRcdFx0XHRtYXJnaW4tbGVmdDogJHtmb2N1c0luZGljYXRvckxlZnRNYXJnaW59cHg7XG5cdFx0XHRcdGJvcmRlci1jb2xvcjogdmFyKC0tdnNjb2RlLW5vdGVib29rLWluYWN0aXZlRm9jdXNlZENlbGxCb3JkZXIpICFpbXBvcnRhbnQ7XG5cdFx0XHR9XG5cblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkgLm1vbmFjby1saXN0IC5tb25hY28tbGlzdC1yb3cuZm9jdXNlZCAuY2VsbC1mb2N1cy1pbmRpY2F0b3ItbGVmdCAuY29kZU91dHB1dC1mb2N1cy1pbmRpY2F0b3ItY29udGFpbmVyLFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLm5vdGVib29rT3ZlcmxheSAubW9uYWNvLWxpc3QgLm1vbmFjby1saXN0LXJvdyAuY2VsbC1vdXRwdXQtaG92ZXIgLmNlbGwtZm9jdXMtaW5kaWNhdG9yLWxlZnQgLmNvZGVPdXRwdXQtZm9jdXMtaW5kaWNhdG9yLWNvbnRhaW5lcixcblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkgLm1vbmFjby1saXN0IC5tb25hY28tbGlzdC1yb3cgLm1hcmtkb3duLWNlbGwtaG92ZXIgLmNlbGwtZm9jdXMtaW5kaWNhdG9yLWxlZnQgLmNvZGVPdXRwdXQtZm9jdXMtaW5kaWNhdG9yLWNvbnRhaW5lcixcblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkgLm1vbmFjby1saXN0IC5tb25hY28tbGlzdC1yb3c6aG92ZXIgLmNlbGwtZm9jdXMtaW5kaWNhdG9yLWxlZnQgLmNvZGVPdXRwdXQtZm9jdXMtaW5kaWNhdG9yLWNvbnRhaW5lciB7XG5cdFx0XHRcdGRpc3BsYXk6IGJsb2NrO1xuXHRcdFx0fVxuXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAubm90ZWJvb2tPdmVybGF5IC5tb25hY28tbGlzdCAubW9uYWNvLWxpc3Qtcm93IC5jZWxsLWZvY3VzLWluZGljYXRvci1sZWZ0IC5jb2RlT3V0cHV0LWZvY3VzLWluZGljYXRvci1jb250YWluZXI6aG92ZXIgLmNvZGVPdXRwdXQtZm9jdXMtaW5kaWNhdG9yIHtcblx0XHRcdFx0Ym9yZGVyLWxlZnQ6IDVweCBzb2xpZCB0cmFuc3BhcmVudDtcblx0XHRcdFx0bWFyZ2luLWxlZnQ6ICR7Zm9jdXNJbmRpY2F0b3JMZWZ0TWFyZ2luIC0gMX1weDtcblx0XHRcdH1cblx0XHRcdGApO1xuXG5cdFx0XHRzdHlsZVNoZWV0cy5wdXNoKGBcblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkgLm1vbmFjby1saXN0IC5tb25hY28tbGlzdC1yb3cuZm9jdXNlZCAuY2VsbC1pbm5lci1jb250YWluZXIuY2VsbC1vdXRwdXQtZm9jdXMgLmNlbGwtZm9jdXMtaW5kaWNhdG9yLWxlZnQgLmNvZGVPdXRwdXQtZm9jdXMtaW5kaWNhdG9yLFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLm5vdGVib29rT3ZlcmxheSAubW9uYWNvLWxpc3Q6Zm9jdXMtd2l0aGluIC5tb25hY28tbGlzdC1yb3cuZm9jdXNlZCAuY2VsbC1pbm5lci1jb250YWluZXIgLmNlbGwtZm9jdXMtaW5kaWNhdG9yLWxlZnQgLmNvZGVPdXRwdXQtZm9jdXMtaW5kaWNhdG9yIHtcblx0XHRcdFx0Ym9yZGVyLWNvbG9yOiB2YXIoLS12c2NvZGUtbm90ZWJvb2stZm9jdXNlZENlbGxCb3JkZXIpICFpbXBvcnRhbnQ7XG5cdFx0XHR9XG5cblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkgLm1vbmFjby1saXN0IC5tb25hY28tbGlzdC1yb3cgLmNlbGwtaW5uZXItY29udGFpbmVyIC5jZWxsLWZvY3VzLWluZGljYXRvci1sZWZ0IC5vdXRwdXQtZm9jdXMtaW5kaWNhdG9yIHtcblx0XHRcdFx0bWFyZ2luLXRvcDogJHtmb2N1c0luZGljYXRvckdhcH1weDtcblx0XHRcdH1cblx0XHRcdGApO1xuXHRcdH1cblxuXHRcdC8vIGJldHdlZW4gY2VsbCBpbnNlcnQgdG9vbGJhclxuXHRcdGlmIChpbnNlcnRUb29sYmFyUG9zaXRpb24gPT09ICdiZXR3ZWVuQ2VsbHMnIHx8IGluc2VydFRvb2xiYXJQb3NpdGlvbiA9PT0gJ2JvdGgnKSB7XG5cdFx0XHRzdHlsZVNoZWV0cy5wdXNoKGAubW9uYWNvLXdvcmtiZW5jaCAubm90ZWJvb2tPdmVybGF5ID4gLmNlbGwtbGlzdC1jb250YWluZXIgPiAubW9uYWNvLWxpc3QgPiAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdyAuY2VsbC1ib3R0b20tdG9vbGJhci1jb250YWluZXIgeyBkaXNwbGF5OiBmbGV4OyB9YCk7XG5cdFx0XHRzdHlsZVNoZWV0cy5wdXNoKGAubW9uYWNvLXdvcmtiZW5jaCAubm90ZWJvb2tPdmVybGF5ID4gLmNlbGwtbGlzdC1jb250YWluZXIgPiAubW9uYWNvLWxpc3QgPiAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLnZpZXctem9uZXMgLmNlbGwtbGlzdC10b3AtY2VsbC10b29sYmFyLWNvbnRhaW5lciB7IGRpc3BsYXk6IGZsZXg7IH1gKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c3R5bGVTaGVldHMucHVzaChgLm1vbmFjby13b3JrYmVuY2ggLm5vdGVib29rT3ZlcmxheSA+IC5jZWxsLWxpc3QtY29udGFpbmVyID4gLm1vbmFjby1saXN0ID4gLm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgPiAubW9uYWNvLWxpc3Qtcm93cyA+IC5tb25hY28tbGlzdC1yb3cgLmNlbGwtYm90dG9tLXRvb2xiYXItY29udGFpbmVyIHsgZGlzcGxheTogbm9uZTsgfWApO1xuXHRcdFx0c3R5bGVTaGVldHMucHVzaChgLm1vbmFjby13b3JrYmVuY2ggLm5vdGVib29rT3ZlcmxheSA+IC5jZWxsLWxpc3QtY29udGFpbmVyID4gLm1vbmFjby1saXN0ID4gLm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgPiAubW9uYWNvLWxpc3Qtcm93cyA+IC52aWV3LXpvbmVzIC5jZWxsLWxpc3QtdG9wLWNlbGwtdG9vbGJhci1jb250YWluZXIgeyBkaXNwbGF5OiBub25lOyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKGluc2VydFRvb2xiYXJBbGlnbm1lbnQgPT09ICdsZWZ0Jykge1xuXHRcdFx0c3R5bGVTaGVldHMucHVzaChgXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAubm90ZWJvb2tPdmVybGF5IC5jZWxsLWxpc3QtdG9wLWNlbGwtdG9vbGJhci1jb250YWluZXIgLmFjdGlvbi1pdGVtOmZpcnN0LWNoaWxkLFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLm5vdGVib29rT3ZlcmxheSAuY2VsbC1saXN0LXRvcC1jZWxsLXRvb2xiYXItY29udGFpbmVyIC5hY3Rpb24taXRlbTpmaXJzdC1jaGlsZCwgLm1vbmFjby13b3JrYmVuY2ggLm5vdGVib29rT3ZlcmxheSA+IC5jZWxsLWxpc3QtY29udGFpbmVyID4gLm1vbmFjby1saXN0ID4gLm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgPiAubW9uYWNvLWxpc3Qtcm93cyA+IC5tb25hY28tbGlzdC1yb3cgLmNlbGwtYm90dG9tLXRvb2xiYXItY29udGFpbmVyIC5hY3Rpb24taXRlbTpmaXJzdC1jaGlsZCB7XG5cdFx0XHRcdG1hcmdpbi1yaWdodDogMHB4ICFpbXBvcnRhbnQ7XG5cdFx0XHR9YCk7XG5cblx0XHRcdHN0eWxlU2hlZXRzLnB1c2goYFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLm5vdGVib29rT3ZlcmxheSAuY2VsbC1saXN0LXRvcC1jZWxsLXRvb2xiYXItY29udGFpbmVyIC5tb25hY28tdG9vbGJhciAuYWN0aW9uLWxhYmVsLFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLm5vdGVib29rT3ZlcmxheSAuY2VsbC1saXN0LXRvcC1jZWxsLXRvb2xiYXItY29udGFpbmVyIC5tb25hY28tdG9vbGJhciAuYWN0aW9uLWxhYmVsLCAubW9uYWNvLXdvcmtiZW5jaCAubm90ZWJvb2tPdmVybGF5ID4gLmNlbGwtbGlzdC1jb250YWluZXIgPiAubW9uYWNvLWxpc3QgPiAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdyAuY2VsbC1ib3R0b20tdG9vbGJhci1jb250YWluZXIgLm1vbmFjby10b29sYmFyIC5hY3Rpb24tbGFiZWwge1xuXHRcdFx0XHRwYWRkaW5nOiAwcHggIWltcG9ydGFudDtcblx0XHRcdFx0anVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG5cdFx0XHRcdGJvcmRlci1yYWRpdXM6IDRweDtcblx0XHRcdH1gKTtcblxuXHRcdFx0c3R5bGVTaGVldHMucHVzaChgXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAubm90ZWJvb2tPdmVybGF5IC5jZWxsLWxpc3QtdG9wLWNlbGwtdG9vbGJhci1jb250YWluZXIsXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAubm90ZWJvb2tPdmVybGF5IC5jZWxsLWxpc3QtdG9wLWNlbGwtdG9vbGJhci1jb250YWluZXIsIC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkgPiAuY2VsbC1saXN0LWNvbnRhaW5lciA+IC5tb25hY28tbGlzdCA+IC5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50ID4gLm1vbmFjby1saXN0LXJvd3MgPiAubW9uYWNvLWxpc3Qtcm93IC5jZWxsLWJvdHRvbS10b29sYmFyLWNvbnRhaW5lciB7XG5cdFx0XHRcdGFsaWduLWl0ZW1zOiBmbGV4LXN0YXJ0O1xuXHRcdFx0XHRqdXN0aWZ5LWNvbnRlbnQ6IGxlZnQ7XG5cdFx0XHRcdG1hcmdpbjogMCAxNnB4IDAgJHs4ICsgY29kZUNlbGxMZWZ0TWFyZ2lufXB4O1xuXHRcdFx0fWApO1xuXG5cdFx0XHRzdHlsZVNoZWV0cy5wdXNoKGBcblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkgLmNlbGwtbGlzdC10b3AtY2VsbC10b29sYmFyLWNvbnRhaW5lcixcblx0XHRcdC5ub3RlYm9va092ZXJsYXkgLmNlbGwtYm90dG9tLXRvb2xiYXItY29udGFpbmVyIC5hY3Rpb24taXRlbSB7XG5cdFx0XHRcdGJvcmRlcjogMHB4O1xuXHRcdFx0fWApO1xuXHRcdH1cblxuXHRcdHN0eWxlU2hlZXRzLnB1c2goYC5ub3RlYm9va092ZXJsYXkgLmNlbGwtbGlzdC1jb250YWluZXIgPiAubW9uYWNvLWxpc3QgPiAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLmNvZGUtY2VsbC1yb3cgZGl2LmNlbGwuY29kZSB7IG1hcmdpbi1sZWZ0OiAke2dldENlbGxFZGl0b3JDb250YWluZXJMZWZ0TWFyZ2lufXB4OyB9YCk7XG5cdFx0Ly8gQ2hhdCBFZGl0LCBkZWxldGVkIENlbGwgT3ZlcmxheVxuXHRcdHN0eWxlU2hlZXRzLnB1c2goYC5ub3RlYm9va092ZXJsYXkgLmNlbGwtbGlzdC1jb250YWluZXIgPiAubW9uYWNvLWxpc3QgPiAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLnZpZXctem9uZXMgLmNvZGUtY2VsbC1yb3cgZGl2LmNlbGwuY29kZSB7IG1hcmdpbi1sZWZ0OiAke2dldENlbGxFZGl0b3JDb250YWluZXJMZWZ0TWFyZ2lufXB4OyB9YCk7XG5cdFx0Ly8gQ2hhdCBFZGl0LCBkZWxldGVkIENlbGwgT3ZlcmxheVxuXHRcdHN0eWxlU2hlZXRzLnB1c2goYC5ub3RlYm9va092ZXJsYXkgLmNlbGwtbGlzdC1jb250YWluZXIgPiAubW9uYWNvLWxpc3QgPiAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLnZpZXctem9uZXMgLmNvZGUtY2VsbC1yb3cgZGl2LmNlbGwgeyBtYXJnaW4tcmlnaHQ6ICR7Y2VsbFJpZ2h0TWFyZ2lufXB4OyB9YCk7XG5cdFx0c3R5bGVTaGVldHMucHVzaChgLm5vdGVib29rT3ZlcmxheSAuY2VsbC1saXN0LWNvbnRhaW5lciA+IC5tb25hY28tbGlzdCA+IC5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50ID4gLm1vbmFjby1saXN0LXJvd3MgPiAubW9uYWNvLWxpc3Qtcm93IGRpdi5jZWxsIHsgbWFyZ2luLXJpZ2h0OiAke2NlbGxSaWdodE1hcmdpbn1weDsgfWApO1xuXHRcdHN0eWxlU2hlZXRzLnB1c2goYC5ub3RlYm9va092ZXJsYXkgLmNlbGwtbGlzdC1jb250YWluZXIgPiAubW9uYWNvLWxpc3QgPiAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdyA+IC5jZWxsLWlubmVyLWNvbnRhaW5lciB7IHBhZGRpbmctdG9wOiAke2NlbGxUb3BNYXJnaW59cHg7IH1gKTtcblx0XHRzdHlsZVNoZWV0cy5wdXNoKGAubm90ZWJvb2tPdmVybGF5IC5jZWxsLWxpc3QtY29udGFpbmVyID4gLm1vbmFjby1saXN0ID4gLm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgPiAubW9uYWNvLWxpc3Qtcm93cyA+IC5tYXJrZG93bi1jZWxsLXJvdyA+IC5jZWxsLWlubmVyLWNvbnRhaW5lciB7IHBhZGRpbmctYm90dG9tOiAke21hcmtkb3duQ2VsbEJvdHRvbU1hcmdpbn1weDsgcGFkZGluZy10b3A6ICR7bWFya2Rvd25DZWxsVG9wTWFyZ2lufXB4OyB9YCk7XG5cdFx0c3R5bGVTaGVldHMucHVzaChgLm5vdGVib29rT3ZlcmxheSAuY2VsbC1saXN0LWNvbnRhaW5lciA+IC5tb25hY28tbGlzdCA+IC5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50ID4gLm1vbmFjby1saXN0LXJvd3MgPiAubWFya2Rvd24tY2VsbC1yb3cgPiAuY2VsbC1pbm5lci1jb250YWluZXIud2Vidmlldy1iYWNrZWQtbWFya2Rvd24tY2VsbCB7IHBhZGRpbmc6IDA7IH1gKTtcblx0XHRzdHlsZVNoZWV0cy5wdXNoKGAubm90ZWJvb2tPdmVybGF5IC5jZWxsLWxpc3QtY29udGFpbmVyID4gLm1vbmFjby1saXN0ID4gLm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgPiAubW9uYWNvLWxpc3Qtcm93cyA+IC5tYXJrZG93bi1jZWxsLXJvdyA+IC53ZWJ2aWV3LWJhY2tlZC1tYXJrZG93bi1jZWxsLm1hcmtkb3duLWNlbGwtZWRpdC1tb2RlIC5jZWxsLmNvZGUgeyBwYWRkaW5nLWJvdHRvbTogJHttYXJrZG93bkNlbGxCb3R0b21NYXJnaW59cHg7IHBhZGRpbmctdG9wOiAke21hcmtkb3duQ2VsbFRvcE1hcmdpbn1weDsgfWApO1xuXHRcdHN0eWxlU2hlZXRzLnB1c2goYC5ub3RlYm9va092ZXJsYXkgLm91dHB1dCB7IG1hcmdpbjogMHB4ICR7Y2VsbFJpZ2h0TWFyZ2lufXB4IDBweCAke2dldENlbGxFZGl0b3JDb250YWluZXJMZWZ0TWFyZ2lufXB4OyB9YCk7XG5cdFx0c3R5bGVTaGVldHMucHVzaChgLm5vdGVib29rT3ZlcmxheSAub3V0cHV0IHsgd2lkdGg6IGNhbGMoMTAwJSAtICR7Z2V0Q2VsbEVkaXRvckNvbnRhaW5lckxlZnRNYXJnaW4gKyBjZWxsUmlnaHRNYXJnaW59cHgpOyB9YCk7XG5cblx0XHQvLyBjb21tZW50XG5cdFx0c3R5bGVTaGVldHMucHVzaChgLm5vdGVib29rT3ZlcmxheSAuY2VsbC1saXN0LWNvbnRhaW5lciA+IC5tb25hY28tbGlzdCA+IC5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50ID4gLm1vbmFjby1saXN0LXJvd3MgPiAubW9uYWNvLWxpc3Qtcm93IC5jZWxsLWNvbW1lbnQtY29udGFpbmVyIHsgbGVmdDogJHtnZXRDZWxsRWRpdG9yQ29udGFpbmVyTGVmdE1hcmdpbn1weDsgfWApO1xuXHRcdHN0eWxlU2hlZXRzLnB1c2goYC5ub3RlYm9va092ZXJsYXkgLmNlbGwtbGlzdC1jb250YWluZXIgPiAubW9uYWNvLWxpc3QgPiAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdyAuY2VsbC1jb21tZW50LWNvbnRhaW5lciB7IHdpZHRoOiBjYWxjKDEwMCUgLSAke2dldENlbGxFZGl0b3JDb250YWluZXJMZWZ0TWFyZ2luICsgY2VsbFJpZ2h0TWFyZ2lufXB4KTsgfWApO1xuXG5cdFx0Ly8gb3V0cHV0IGNvbGxhcHNlIGJ1dHRvblxuXHRcdHN0eWxlU2hlZXRzLnB1c2goYC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkgLm91dHB1dCAub3V0cHV0LWNvbGxhcHNlLWNvbnRhaW5lciAuZXhwYW5kQnV0dG9uIHsgbGVmdDogLSR7Y2VsbFJ1bkd1dHRlcn1weDsgfWApO1xuXHRcdHN0eWxlU2hlZXRzLnB1c2goYC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkgLm91dHB1dCAub3V0cHV0LWNvbGxhcHNlLWNvbnRhaW5lciAuZXhwYW5kQnV0dG9uIHtcblx0XHRcdHBvc2l0aW9uOiBhYnNvbHV0ZTtcblx0XHRcdHdpZHRoOiAke2NlbGxSdW5HdXR0ZXJ9cHg7XG5cdFx0XHRwYWRkaW5nOiA2cHggMHB4O1xuXHRcdH1gKTtcblxuXHRcdC8vIHNob3cgbW9yZSBjb250YWluZXJcblx0XHRzdHlsZVNoZWV0cy5wdXNoKGAubm90ZWJvb2tPdmVybGF5IC5vdXRwdXQtc2hvdy1tb3JlLWNvbnRhaW5lciB7IG1hcmdpbjogMHB4ICR7Y2VsbFJpZ2h0TWFyZ2lufXB4IDBweCAke2dldENlbGxFZGl0b3JDb250YWluZXJMZWZ0TWFyZ2lufXB4OyB9YCk7XG5cdFx0c3R5bGVTaGVldHMucHVzaChgLm5vdGVib29rT3ZlcmxheSAub3V0cHV0LXNob3ctbW9yZS1jb250YWluZXIgeyB3aWR0aDogY2FsYygxMDAlIC0gJHtnZXRDZWxsRWRpdG9yQ29udGFpbmVyTGVmdE1hcmdpbiArIGNlbGxSaWdodE1hcmdpbn1weCk7IH1gKTtcblxuXHRcdHN0eWxlU2hlZXRzLnB1c2goYC5ub3RlYm9va092ZXJsYXkgLmNlbGwtbGlzdC1jb250YWluZXIgPiAubW9uYWNvLWxpc3QgPiAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdyBkaXYuY2VsbC5tYXJrZG93biB7IHBhZGRpbmctbGVmdDogJHtjZWxsUnVuR3V0dGVyfXB4OyB9YCk7XG5cdFx0c3R5bGVTaGVldHMucHVzaChgLm1vbmFjby13b3JrYmVuY2ggLm5vdGVib29rT3ZlcmxheSA+IC5jZWxsLWxpc3QtY29udGFpbmVyIC5ub3RlYm9vay1mb2xkaW5nLWluZGljYXRvciB7IGxlZnQ6ICR7KG1hcmtkb3duQ2VsbEd1dHRlciAtIDIwKSAvIDIgKyBtYXJrZG93bkNlbGxMZWZ0TWFyZ2lufXB4OyB9YCk7XG5cdFx0c3R5bGVTaGVldHMucHVzaChgLm5vdGVib29rT3ZlcmxheSA+IC5jZWxsLWxpc3QtY29udGFpbmVyIC5ub3RlYm9vay1mb2xkZWQtaGludCB7IGxlZnQ6ICR7bWFya2Rvd25DZWxsR3V0dGVyICsgbWFya2Rvd25DZWxsTGVmdE1hcmdpbiArIDh9cHg7IH1gKTtcblx0XHRzdHlsZVNoZWV0cy5wdXNoKGAubm90ZWJvb2tPdmVybGF5IC5tb25hY28tbGlzdCAubW9uYWNvLWxpc3Qtcm93IDpub3QoLndlYnZpZXctYmFja2VkLW1hcmtkb3duLWNlbGwpIC5jZWxsLWZvY3VzLWluZGljYXRvci10b3AgeyBoZWlnaHQ6ICR7Y2VsbFRvcE1hcmdpbn1weDsgfWApO1xuXHRcdHN0eWxlU2hlZXRzLnB1c2goYC5ub3RlYm9va092ZXJsYXkgLm1vbmFjby1saXN0IC5tb25hY28tbGlzdC1yb3cgLmNlbGwtZm9jdXMtaW5kaWNhdG9yLXNpZGUgeyBib3R0b206ICR7Ym90dG9tVG9vbGJhckdhcH1weDsgfWApO1xuXHRcdHN0eWxlU2hlZXRzLnB1c2goYC5ub3RlYm9va092ZXJsYXkgLm1vbmFjby1saXN0IC5tb25hY28tbGlzdC1yb3cuY29kZS1jZWxsLXJvdyAuY2VsbC1mb2N1cy1pbmRpY2F0b3ItbGVmdCB7IHdpZHRoOiAke2dldENlbGxFZGl0b3JDb250YWluZXJMZWZ0TWFyZ2lufXB4OyB9YCk7XG5cdFx0c3R5bGVTaGVldHMucHVzaChgLm5vdGVib29rT3ZlcmxheSAubW9uYWNvLWxpc3QgLm1vbmFjby1saXN0LXJvdy5tYXJrZG93bi1jZWxsLXJvdyAuY2VsbC1mb2N1cy1pbmRpY2F0b3ItbGVmdCB7IHdpZHRoOiAke2NvZGVDZWxsTGVmdE1hcmdpbn1weDsgfWApO1xuXHRcdHN0eWxlU2hlZXRzLnB1c2goYC5ub3RlYm9va092ZXJsYXkgLm1vbmFjby1saXN0IC5tb25hY28tbGlzdC1yb3cgLmNlbGwtZm9jdXMtaW5kaWNhdG9yLmNlbGwtZm9jdXMtaW5kaWNhdG9yLXJpZ2h0IHsgd2lkdGg6ICR7Y2VsbFJpZ2h0TWFyZ2lufXB4OyB9YCk7XG5cdFx0c3R5bGVTaGVldHMucHVzaChgLm5vdGVib29rT3ZlcmxheSAubW9uYWNvLWxpc3QgLm1vbmFjby1saXN0LXJvdyAuY2VsbC1mb2N1cy1pbmRpY2F0b3ItYm90dG9tIHsgaGVpZ2h0OiAke2NlbGxCb3R0b21NYXJnaW59cHg7IH1gKTtcblx0XHRzdHlsZVNoZWV0cy5wdXNoKGAubm90ZWJvb2tPdmVybGF5IC5tb25hY28tbGlzdCAubW9uYWNvLWxpc3Qtcm93IC5jZWxsLXNoYWRvdy1jb250YWluZXItYm90dG9tIHsgdG9wOiAke2NlbGxCb3R0b21NYXJnaW59cHg7IH1gKTtcblxuXHRcdHN0eWxlU2hlZXRzLnB1c2goYFxuXHRcdFx0Lm5vdGVib29rT3ZlcmxheSAubW9uYWNvLWxpc3Quc2VsZWN0aW9uLW11bHRpcGxlIC5tb25hY28tbGlzdC1yb3c6aGFzKCsgLm1vbmFjby1saXN0LXJvdy5zZWxlY3RlZCkgLmNlbGwtZm9jdXMtaW5kaWNhdG9yLWJvdHRvbSB7XG5cdFx0XHRcdGhlaWdodDogJHtib3R0b21Ub29sYmFyR2FwICsgY2VsbEJvdHRvbU1hcmdpbn1weDtcblx0XHRcdH1cblx0XHRgKTtcblxuXHRcdHN0eWxlU2hlZXRzLnB1c2goYFxuXHRcdFx0Lm5vdGVib29rT3ZlcmxheSAubW9uYWNvLWxpc3QgLm1vbmFjby1saXN0LXJvdy5jb2RlLWNlbGwtcm93Lm5iLW11bHRpQ2VsbEhpZ2hsaWdodDpoYXMoKyAubW9uYWNvLWxpc3Qtcm93Lm5iLW11bHRpQ2VsbEhpZ2hsaWdodCkgLmNlbGwtZm9jdXMtaW5kaWNhdG9yLWJvdHRvbSB7XG5cdFx0XHRcdGhlaWdodDogJHtib3R0b21Ub29sYmFyR2FwICsgY2VsbEJvdHRvbU1hcmdpbn1weDtcblx0XHRcdFx0YmFja2dyb3VuZC1jb2xvcjogdmFyKC0tdnNjb2RlLW5vdGVib29rLXN5bWJvbEhpZ2hsaWdodEJhY2tncm91bmQpICFpbXBvcnRhbnQ7XG5cdFx0XHR9XG5cblx0XHRcdC5ub3RlYm9va092ZXJsYXkgLm1vbmFjby1saXN0IC5tb25hY28tbGlzdC1yb3cubWFya2Rvd24tY2VsbC1yb3cubmItbXVsdGlDZWxsSGlnaGxpZ2h0OmhhcygrIC5tb25hY28tbGlzdC1yb3cubmItbXVsdGlDZWxsSGlnaGxpZ2h0KSAuY2VsbC1mb2N1cy1pbmRpY2F0b3ItYm90dG9tIHtcblx0XHRcdFx0aGVpZ2h0OiAke2JvdHRvbVRvb2xiYXJHYXAgKyBjZWxsQm90dG9tTWFyZ2luIC0gNn1weDtcblx0XHRcdFx0YmFja2dyb3VuZC1jb2xvcjogdmFyKC0tdnNjb2RlLW5vdGVib29rLXN5bWJvbEhpZ2hsaWdodEJhY2tncm91bmQpICFpbXBvcnRhbnQ7XG5cdFx0XHR9XG5cdFx0YCk7XG5cblxuXHRcdHN0eWxlU2hlZXRzLnB1c2goYFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLm5vdGVib29rT3ZlcmxheSA+IC5jZWxsLWxpc3QtY29udGFpbmVyID4gLm1vbmFjby1saXN0ID4gLm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgPiAubW9uYWNvLWxpc3Qtcm93cyA+IC5tb25hY28tbGlzdC1yb3cgLmlucHV0LWNvbGxhcHNlLWNvbnRhaW5lciAuY2VsbC1jb2xsYXBzZS1wcmV2aWV3IHtcblx0XHRcdFx0bGluZS1oZWlnaHQ6ICR7Y29sbGFwc2VkSW5kaWNhdG9ySGVpZ2h0fXB4O1xuXHRcdFx0fVxuXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAubm90ZWJvb2tPdmVybGF5ID4gLmNlbGwtbGlzdC1jb250YWluZXIgPiAubW9uYWNvLWxpc3QgPiAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdyAuaW5wdXQtY29sbGFwc2UtY29udGFpbmVyIC5jZWxsLWNvbGxhcHNlLXByZXZpZXcgLm1vbmFjby10b2tlbml6ZWQtc291cmNlIHtcblx0XHRcdFx0bWF4LWhlaWdodDogJHtjb2xsYXBzZWRJbmRpY2F0b3JIZWlnaHR9cHg7XG5cdFx0XHR9XG5cdFx0YCk7XG5cblx0XHRzdHlsZVNoZWV0cy5wdXNoKGAubW9uYWNvLXdvcmtiZW5jaCAubm90ZWJvb2tPdmVybGF5ID4gLmNlbGwtbGlzdC1jb250YWluZXIgPiAubW9uYWNvLWxpc3QgPiAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdyAuY2VsbC1ib3R0b20tdG9vbGJhci1jb250YWluZXIgLm1vbmFjby10b29sYmFyIHsgaGVpZ2h0OiAke2JvdHRvbVRvb2xiYXJIZWlnaHR9cHggfWApO1xuXHRcdHN0eWxlU2hlZXRzLnB1c2goYC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkgPiAuY2VsbC1saXN0LWNvbnRhaW5lciA+IC5tb25hY28tbGlzdCA+IC5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50ID4gLm1vbmFjby1saXN0LXJvd3MgPiAudmlldy16b25lcyAuY2VsbC1saXN0LXRvcC1jZWxsLXRvb2xiYXItY29udGFpbmVyIC5tb25hY28tdG9vbGJhciB7IGhlaWdodDogJHtib3R0b21Ub29sYmFySGVpZ2h0fXB4IH1gKTtcblxuXHRcdC8vIGNlbGwgdG9vbGJhclxuXHRcdHN0eWxlU2hlZXRzLnB1c2goYC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkuY2VsbC10aXRsZS10b29sYmFyLXJpZ2h0ID4gLmNlbGwtbGlzdC1jb250YWluZXIgPiAubW9uYWNvLWxpc3QgPiAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdyAuY2VsbC10aXRsZS10b29sYmFyIHtcblx0XHRcdHJpZ2h0OiAke2NlbGxSaWdodE1hcmdpbiArIDI2fXB4O1xuXHRcdH1cblx0XHQubW9uYWNvLXdvcmtiZW5jaCAubm90ZWJvb2tPdmVybGF5LmNlbGwtdGl0bGUtdG9vbGJhci1sZWZ0ID4gLmNlbGwtbGlzdC1jb250YWluZXIgPiAubW9uYWNvLWxpc3QgPiAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdyAuY2VsbC10aXRsZS10b29sYmFyIHtcblx0XHRcdGxlZnQ6ICR7Z2V0Q2VsbEVkaXRvckNvbnRhaW5lckxlZnRNYXJnaW4gKyAxNn1weDtcblx0XHR9XG5cdFx0Lm1vbmFjby13b3JrYmVuY2ggLm5vdGVib29rT3ZlcmxheS5jZWxsLXRpdGxlLXRvb2xiYXItaGlkZGVuID4gLmNlbGwtbGlzdC1jb250YWluZXIgPiAubW9uYWNvLWxpc3QgPiAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdyAuY2VsbC10aXRsZS10b29sYmFyIHtcblx0XHRcdGRpc3BsYXk6IG5vbmU7XG5cdFx0fWApO1xuXG5cdFx0Ly8gY2VsbCBvdXRwdXQgaW5uZXJ0IGNvbnRhaW5lclxuXHRcdHN0eWxlU2hlZXRzLnB1c2goYFxuXHRcdC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkgLm91dHB1dCA+IGRpdi5mb3JlZ3JvdW5kLm91dHB1dC1pbm5lci1jb250YWluZXIge1xuXHRcdFx0cGFkZGluZzogJHtPdXRwdXRJbm5lckNvbnRhaW5lclRvcFBhZGRpbmd9cHggOHB4O1xuXHRcdH1cblx0XHQubW9uYWNvLXdvcmtiZW5jaCAubm90ZWJvb2tPdmVybGF5ID4gLmNlbGwtbGlzdC1jb250YWluZXIgPiAubW9uYWNvLWxpc3QgPiAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdyAub3V0cHV0LWNvbGxhcHNlLWNvbnRhaW5lciB7XG5cdFx0XHRwYWRkaW5nOiAke091dHB1dElubmVyQ29udGFpbmVyVG9wUGFkZGluZ31weCA4cHg7XG5cdFx0fVxuXHRcdGApO1xuXG5cdFx0Ly8gY2hhdFxuXHRcdHN0eWxlU2hlZXRzLnB1c2goYFxuXHRcdC5tb25hY28td29ya2JlbmNoIC5ub3RlYm9va092ZXJsYXkgLmNlbGwtY2hhdC1wYXJ0IHtcblx0XHRcdG1hcmdpbjogMCAke2NlbGxSaWdodE1hcmdpbn1weCA2cHggNHB4O1xuXHRcdH1cblx0XHRgKTtcblxuXHRcdHRoaXMuX3N0eWxlRWxlbWVudC50ZXh0Q29udGVudCA9IHN0eWxlU2hlZXRzLmpvaW4oJ1xcbicpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlQ2VsbExpc3QoKTogdm9pZCB7XG5cdFx0dGhpcy5fYm9keS5jbGFzc0xpc3QuYWRkKCdjZWxsLWxpc3QtY29udGFpbmVyJyk7XG5cdFx0dGhpcy5fZG5kQ29udHJvbGxlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBDZWxsRHJhZ0FuZERyb3BDb250cm9sbGVyKHRoaXMsIHRoaXMuX2JvZHkpKTtcblx0XHRjb25zdCBnZXRTY29wZWRDb250ZXh0S2V5U2VydmljZSA9IChjb250YWluZXI6IEhUTUxFbGVtZW50KSA9PiB0aGlzLl9saXN0LmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZChjb250YWluZXIpO1xuXHRcdHRoaXMuX2VkaXRvclBvb2wgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vdGVib29rQ2VsbEVkaXRvclBvb2wsIHRoaXMsIGdldFNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKSk7XG5cdFx0Y29uc3QgcmVuZGVyZXJzID0gW1xuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb2RlQ2VsbFJlbmRlcmVyLCB0aGlzLCB0aGlzLl9yZW5kZXJlZEVkaXRvcnMsIHRoaXMuX2VkaXRvclBvb2wsIHRoaXMuX2RuZENvbnRyb2xsZXIsIGdldFNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKSxcblx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWFya3VwQ2VsbFJlbmRlcmVyLCB0aGlzLCB0aGlzLl9kbmRDb250cm9sbGVyLCB0aGlzLl9yZW5kZXJlZEVkaXRvcnMsIGdldFNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKSxcblx0XHRdO1xuXG5cdFx0cmVuZGVyZXJzLmZvckVhY2gocmVuZGVyZXIgPT4ge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIocmVuZGVyZXIpO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5fbGlzdERlbGVnYXRlID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShOb3RlYm9va0NlbGxMaXN0RGVsZWdhdGUsIERPTS5nZXRXaW5kb3codGhpcy5nZXREb21Ob2RlKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9saXN0RGVsZWdhdGUpO1xuXG5cdFx0Y29uc3QgYWNjZXNzaWJpbGl0eVByb3ZpZGVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShOb3RlYm9va0FjY2Vzc2liaWxpdHlQcm92aWRlciwgKCkgPT4gdGhpcy52aWV3TW9kZWwsIHRoaXMuaXNSZXBsSGlzdG9yeSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWNjZXNzaWJpbGl0eVByb3ZpZGVyKTtcblxuXHRcdHRoaXMuX2xpc3QgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0Tm90ZWJvb2tDZWxsTGlzdCxcblx0XHRcdCdOb3RlYm9va0NlbGxMaXN0Jyxcblx0XHRcdHRoaXMuX2JvZHksXG5cdFx0XHR0aGlzLl92aWV3Q29udGV4dC5ub3RlYm9va09wdGlvbnMsXG5cdFx0XHR0aGlzLl9saXN0RGVsZWdhdGUsXG5cdFx0XHRyZW5kZXJlcnMsXG5cdFx0XHR0aGlzLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0e1xuXHRcdFx0XHRzZXRSb3dMaW5lSGVpZ2h0OiBmYWxzZSxcblx0XHRcdFx0c2V0Um93SGVpZ2h0OiBmYWxzZSxcblx0XHRcdFx0c3VwcG9ydER5bmFtaWNIZWlnaHRzOiB0cnVlLFxuXHRcdFx0XHRob3Jpem9udGFsU2Nyb2xsaW5nOiBmYWxzZSxcblx0XHRcdFx0a2V5Ym9hcmRTdXBwb3J0OiBmYWxzZSxcblx0XHRcdFx0bW91c2VTdXBwb3J0OiB0cnVlLFxuXHRcdFx0XHRtdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQ6IHRydWUsXG5cdFx0XHRcdHNlbGVjdGlvbk5hdmlnYXRpb246IHRydWUsXG5cdFx0XHRcdHR5cGVOYXZpZ2F0aW9uRW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0cGFkZGluZ1RvcDogMCxcblx0XHRcdFx0cGFkZGluZ0JvdHRvbTogMCxcblx0XHRcdFx0dHJhbnNmb3JtT3B0aW1pemF0aW9uOiBmYWxzZSwgLy8oaXNNYWNpbnRvc2ggJiYgaXNOYXRpdmUpIHx8IGdldFRpdGxlQmFyU3R5bGUodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UpID09PSAnbmF0aXZlJyxcblx0XHRcdFx0aW5pdGlhbFNpemU6IHRoaXMuX2RpbWVuc2lvbixcblx0XHRcdFx0c3R5bGVDb250cm9sbGVyOiAoX3N1ZmZpeDogc3RyaW5nKSA9PiB7IHJldHVybiB0aGlzLl9saXN0OyB9LFxuXHRcdFx0XHRvdmVycmlkZVN0eWxlczoge1xuXHRcdFx0XHRcdGxpc3RCYWNrZ3JvdW5kOiBub3RlYm9va0VkaXRvckJhY2tncm91bmQsXG5cdFx0XHRcdFx0bGlzdEFjdGl2ZVNlbGVjdGlvbkJhY2tncm91bmQ6IG5vdGVib29rRWRpdG9yQmFja2dyb3VuZCxcblx0XHRcdFx0XHRsaXN0QWN0aXZlU2VsZWN0aW9uRm9yZWdyb3VuZDogZm9yZWdyb3VuZCxcblx0XHRcdFx0XHRsaXN0Rm9jdXNBbmRTZWxlY3Rpb25CYWNrZ3JvdW5kOiBub3RlYm9va0VkaXRvckJhY2tncm91bmQsXG5cdFx0XHRcdFx0bGlzdEZvY3VzQW5kU2VsZWN0aW9uRm9yZWdyb3VuZDogZm9yZWdyb3VuZCxcblx0XHRcdFx0XHRsaXN0Rm9jdXNCYWNrZ3JvdW5kOiBub3RlYm9va0VkaXRvckJhY2tncm91bmQsXG5cdFx0XHRcdFx0bGlzdEZvY3VzRm9yZWdyb3VuZDogZm9yZWdyb3VuZCxcblx0XHRcdFx0XHRsaXN0SG92ZXJGb3JlZ3JvdW5kOiBmb3JlZ3JvdW5kLFxuXHRcdFx0XHRcdGxpc3RIb3ZlckJhY2tncm91bmQ6IG5vdGVib29rRWRpdG9yQmFja2dyb3VuZCxcblx0XHRcdFx0XHRsaXN0SG92ZXJPdXRsaW5lOiBmb2N1c0JvcmRlcixcblx0XHRcdFx0XHRsaXN0Rm9jdXNPdXRsaW5lOiBmb2N1c0JvcmRlcixcblx0XHRcdFx0XHRsaXN0SW5hY3RpdmVTZWxlY3Rpb25CYWNrZ3JvdW5kOiBub3RlYm9va0VkaXRvckJhY2tncm91bmQsXG5cdFx0XHRcdFx0bGlzdEluYWN0aXZlU2VsZWN0aW9uRm9yZWdyb3VuZDogZm9yZWdyb3VuZCxcblx0XHRcdFx0XHRsaXN0SW5hY3RpdmVGb2N1c0JhY2tncm91bmQ6IG5vdGVib29rRWRpdG9yQmFja2dyb3VuZCxcblx0XHRcdFx0XHRsaXN0SW5hY3RpdmVGb2N1c091dGxpbmU6IG5vdGVib29rRWRpdG9yQmFja2dyb3VuZCxcblx0XHRcdFx0fSxcblx0XHRcdFx0YWNjZXNzaWJpbGl0eVByb3ZpZGVyXG5cdFx0XHR9LFxuXHRcdCk7XG5cdFx0dGhpcy5fZG5kQ29udHJvbGxlci5zZXRMaXN0KHRoaXMuX2xpc3QpO1xuXG5cdFx0Ly8gY3JlYXRlIFdlYnZpZXdcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2xpc3QpO1xuXHRcdHRoaXMuX2xpc3RWaWV3SW5mb0FjY2Vzc29yID0gbmV3IExpc3RWaWV3SW5mb0FjY2Vzc29yKHRoaXMuX2xpc3QpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2xpc3RWaWV3SW5mb0FjY2Vzc29yKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbWJpbmVkRGlzcG9zYWJsZSguLi5yZW5kZXJlcnMpKTtcblxuXHRcdC8vIHRvcCBjZWxsIHRvb2xiYXJcblx0XHR0aGlzLl9saXN0VG9wQ2VsbFRvb2xiYXIgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKExpc3RUb3BDZWxsVG9vbGJhciwgdGhpcywgdGhpcy5ub3RlYm9va09wdGlvbnMpKTtcblxuXHRcdC8vIHRyYW5zcGFyZW50IGNvdmVyXG5cdFx0dGhpcy5fd2Vidmlld1RyYW5zcGFyZW50Q292ZXIgPSBET00uYXBwZW5kKHRoaXMuX2xpc3Qucm93c0NvbnRhaW5lciwgJCgnLndlYnZpZXctY292ZXInKSk7XG5cdFx0dGhpcy5fd2Vidmlld1RyYW5zcGFyZW50Q292ZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5hZGRTdGFuZGFyZERpc3Bvc2FibGVHZW5lcmljTW91c2VEb3duTGlzdGVuZXIodGhpcy5fb3ZlcmxheUNvbnRhaW5lciwgKGU6IFN0YW5kYXJkTW91c2VFdmVudCkgPT4ge1xuXHRcdFx0aWYgKGUudGFyZ2V0LmNsYXNzTGlzdC5jb250YWlucygnc2xpZGVyJykgJiYgdGhpcy5fd2Vidmlld1RyYW5zcGFyZW50Q292ZXIpIHtcblx0XHRcdFx0dGhpcy5fd2Vidmlld1RyYW5zcGFyZW50Q292ZXIuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRE9NLmFkZFN0YW5kYXJkRGlzcG9zYWJsZUdlbmVyaWNNb3VzZVVwTGlzdGVuZXIodGhpcy5fb3ZlcmxheUNvbnRhaW5lciwgKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX3dlYnZpZXdUcmFuc3BhcmVudENvdmVyKSB7XG5cdFx0XHRcdC8vIG5vIG1hdHRlciB3aGVuXG5cdFx0XHRcdHRoaXMuX3dlYnZpZXdUcmFuc3BhcmVudENvdmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbGlzdC5vbk1vdXNlRG93bihlID0+IHtcblx0XHRcdGlmIChlLmVsZW1lbnQpIHtcblx0XHRcdFx0dGhpcy5fb25Nb3VzZURvd24uZmlyZSh7IGV2ZW50OiBlLmJyb3dzZXJFdmVudCwgdGFyZ2V0OiBlLmVsZW1lbnQgfSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbGlzdC5vbk1vdXNlVXAoZSA9PiB7XG5cdFx0XHRpZiAoZS5lbGVtZW50KSB7XG5cdFx0XHRcdHRoaXMuX29uTW91c2VVcC5maXJlKHsgZXZlbnQ6IGUuYnJvd3NlckV2ZW50LCB0YXJnZXQ6IGUuZWxlbWVudCB9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9saXN0Lm9uRGlkQ2hhbmdlRm9jdXMoX2UgPT4ge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVFZGl0b3IuZmlyZSh0aGlzKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZlQ2VsbC5maXJlKCk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUZvY3VzLmZpcmUoKTtcblx0XHRcdHRoaXMuX2N1cnNvck5hdk1vZGUuc2V0KGZhbHNlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9saXN0Lm9uQ29udGV4dE1lbnUoZSA9PiB7XG5cdFx0XHR0aGlzLnNob3dMaXN0Q29udGV4dE1lbnUoZSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbGlzdC5vbkRpZENoYW5nZVZpc2libGVSYW5nZXMoKCkgPT4ge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VWaXNpYmxlUmFuZ2VzLmZpcmUoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9saXN0Lm9uRGlkU2Nyb2xsKChlKSA9PiB7XG5cdFx0XHRpZiAoZS5zY3JvbGxUb3AgIT09IGUub2xkU2Nyb2xsVG9wKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkU2Nyb2xsLmZpcmUoKTtcblx0XHRcdFx0dGhpcy5jbGVhckFjdGl2ZUNlbGxXaWRnZXRzKCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlLnNjcm9sbFRvcCA9PT0gZS5vbGRTY3JvbGxUb3AgJiYgZS5zY3JvbGxIZWlnaHRDaGFuZ2VkKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlTGF5b3V0LmZpcmUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9mb2N1c1RyYWNrZXIgPSB0aGlzLl9yZWdpc3RlcihET00udHJhY2tGb2N1cyh0aGlzLmdldERvbU5vZGUoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2ZvY3VzVHJhY2tlci5vbkRpZEJsdXIoKCkgPT4ge1xuXHRcdFx0dGhpcy5fZWRpdG9yRm9jdXMuc2V0KGZhbHNlKTtcblx0XHRcdHRoaXMudmlld01vZGVsPy5zZXRFZGl0b3JGb2N1cyhmYWxzZSk7XG5cdFx0XHR0aGlzLl9vbkRpZEJsdXJFbWl0dGVyLmZpcmUoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZm9jdXNUcmFja2VyLm9uRGlkRm9jdXMoKCkgPT4ge1xuXHRcdFx0dGhpcy5fZWRpdG9yRm9jdXMuc2V0KHRydWUpO1xuXHRcdFx0dGhpcy52aWV3TW9kZWw/LnNldEVkaXRvckZvY3VzKHRydWUpO1xuXHRcdFx0dGhpcy5fb25EaWRGb2N1c0VtaXR0ZXIuZmlyZSgpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyTm90ZWJvb2tBY3Rpb25zVG9vbGJhcigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyTm90ZWJvb2tTdGlja3lTY3JvbGwoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oYWNjZXNzaWJpbGl0eVByb3ZpZGVyLnZlcmJvc2l0eVNldHRpbmdJZCkpIHtcblx0XHRcdFx0dGhpcy5fbGlzdC5hcmlhTGFiZWwgPSBhY2Nlc3NpYmlsaXR5UHJvdmlkZXI/LmdldFdpZGdldEFyaWFMYWJlbCgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgc2hvd0xpc3RDb250ZXh0TWVudShlOiBJTGlzdENvbnRleHRNZW51RXZlbnQ8Q2VsbFZpZXdNb2RlbD4pIHtcblx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0bWVudUlkOiBNZW51SWQuTm90ZWJvb2tDZWxsVGl0bGUsXG5cdFx0XHRtZW51QWN0aW9uT3B0aW9uczoge1xuXHRcdFx0XHRzaG91bGRGb3J3YXJkQXJnczogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdGNvbnRleHRLZXlTZXJ2aWNlOiB0aGlzLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiBlLmFuY2hvcixcblx0XHRcdGdldEFjdGlvbnNDb250ZXh0OiAoKSA9PiB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZnJvbTogJ2NlbGxDb250YWluZXInXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9yZWdpc3Rlck5vdGVib29rT3ZlcnZpZXdSdWxlcigpIHtcblx0XHR0aGlzLl9ub3RlYm9va092ZXJ2aWV3UnVsZXIgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vdGVib29rT3ZlcnZpZXdSdWxlciwgdGhpcywgdGhpcy5fbm90ZWJvb2tPdmVydmlld1J1bGVyQ29udGFpbmVyKSk7XG5cdH1cblxuXHRwcml2YXRlIF9yZWdpc3Rlck5vdGVib29rQWN0aW9uc1Rvb2xiYXIoKSB7XG5cdFx0dGhpcy5fbm90ZWJvb2tUb3BUb29sYmFyID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShOb3RlYm9va0VkaXRvcldvcmtiZW5jaFRvb2xiYXIsIHRoaXMsIHRoaXMuc2NvcGVkQ29udGV4dEtleVNlcnZpY2UsIHRoaXMuX25vdGVib29rT3B0aW9ucywgdGhpcy5fbm90ZWJvb2tUb3BUb29sYmFyQ29udGFpbmVyKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbm90ZWJvb2tUb3BUb29sYmFyLm9uRGlkQ2hhbmdlVmlzaWJpbGl0eSgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fZGltZW5zaW9uICYmIHRoaXMuX2lzVmlzaWJsZSkge1xuXHRcdFx0XHR0aGlzLmxheW91dCh0aGlzLl9kaW1lbnNpb24pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlZ2lzdGVyTm90ZWJvb2tTdGlja3lTY3JvbGwoKSB7XG5cdFx0dGhpcy5fbm90ZWJvb2tTdGlja3lTY3JvbGwgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vdGVib29rU3RpY2t5U2Nyb2xsLCB0aGlzLl9ub3RlYm9va1N0aWNreVNjcm9sbENvbnRhaW5lciwgdGhpcywgdGhpcy5fbGlzdCwgKHNpemVEZWx0YSkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLl9kaW1lbnNpb24gJiYgdGhpcy5faXNWaXNpYmxlKSB7XG5cdFx0XHRcdGlmIChzaXplRGVsdGEgPiAwKSB7IC8vIGRlbHRhID4gMCA9PT4gc3RpY2t5IGlzIGdyb3dpbmcsIGNlbGwgbGlzdCBzaHJpbmtpbmdcblx0XHRcdFx0XHR0aGlzLmxheW91dCh0aGlzLl9kaW1lbnNpb24pO1xuXHRcdFx0XHRcdHRoaXMuc2V0U2Nyb2xsVG9wKHRoaXMuc2Nyb2xsVG9wICsgc2l6ZURlbHRhKTtcblx0XHRcdFx0fSBlbHNlIGlmIChzaXplRGVsdGEgPCAwKSB7IC8vIGRlbHRhIDwgMCA9PT4gc3RpY2t5IGlzIHNocmlua2luZywgY2VsbCBsaXN0IGdyb3dpbmdcblx0XHRcdFx0XHR0aGlzLnNldFNjcm9sbFRvcCh0aGlzLnNjcm9sbFRvcCArIHNpemVEZWx0YSk7XG5cdFx0XHRcdFx0dGhpcy5sYXlvdXQodGhpcy5fZGltZW5zaW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9vbkRpZFNjcm9sbC5maXJlKCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlT3V0cHV0UmVuZGVyZXJzKCkge1xuXHRcdGlmICghdGhpcy52aWV3TW9kZWwgfHwgIXRoaXMuX3dlYnZpZXcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl93ZWJ2aWV3LnVwZGF0ZU91dHB1dFJlbmRlcmVycygpO1xuXHRcdHRoaXMudmlld01vZGVsLnZpZXdDZWxscy5mb3JFYWNoKGNlbGwgPT4ge1xuXHRcdFx0Y2VsbC5vdXRwdXRzVmlld01vZGVscy5mb3JFYWNoKG91dHB1dCA9PiB7XG5cdFx0XHRcdGlmIChvdXRwdXQucGlja2VkTWltZVR5cGU/LnJlbmRlcmVySWQgPT09IFJFTkRFUkVSX05PVF9BVkFJTEFCTEUpIHtcblx0XHRcdFx0XHRvdXRwdXQucmVzZXRSZW5kZXJlcigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdGdldERvbU5vZGUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX292ZXJsYXlDb250YWluZXI7XG5cdH1cblxuXHRnZXRPdmVyZmxvd0NvbnRhaW5lckRvbU5vZGUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX292ZXJmbG93Q29udGFpbmVyO1xuXHR9XG5cblx0Z2V0SW5uZXJXZWJ2aWV3KCk6IElXZWJ2aWV3RWxlbWVudCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3dlYnZpZXc/LndlYnZpZXc7XG5cdH1cblxuXHRzZXRFZGl0b3JQcm9ncmVzc1NlcnZpY2UoZWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlOiBJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlKTogdm9pZCB7XG5cdFx0dGhpcy5lZGl0b3JQcm9ncmVzc1NlcnZpY2UgPSBlZGl0b3JQcm9ncmVzc1NlcnZpY2U7XG5cdH1cblxuXHRzZXRQYXJlbnRDb250ZXh0S2V5U2VydmljZShwYXJlbnRDb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlKTogdm9pZCB7XG5cdFx0dGhpcy5zY29wZWRDb250ZXh0S2V5U2VydmljZS51cGRhdGVQYXJlbnQocGFyZW50Q29udGV4dEtleVNlcnZpY2UpO1xuXHR9XG5cblx0YXN5bmMgc2V0TW9kZWwodGV4dE1vZGVsOiBOb3RlYm9va1RleHRNb2RlbCwgdmlld1N0YXRlOiBJTm90ZWJvb2tFZGl0b3JWaWV3U3RhdGUgfCB1bmRlZmluZWQsIHBlcmY/OiBOb3RlYm9va1BlcmZNYXJrcywgdmlld1R5cGU/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy52aWV3TW9kZWwgPT09IHVuZGVmaW5lZCB8fCAhdGhpcy52aWV3TW9kZWwuZXF1YWwodGV4dE1vZGVsKSkge1xuXHRcdFx0Y29uc3Qgb2xkQm90dG9tVG9vbGJhckRpbWVuc2lvbnMgPSB0aGlzLl9ub3RlYm9va09wdGlvbnMuY29tcHV0ZUJvdHRvbVRvb2xiYXJEaW1lbnNpb25zKHRoaXMudmlld01vZGVsPy52aWV3VHlwZSk7XG5cdFx0XHR0aGlzLl9kZXRhY2hNb2RlbCgpO1xuXHRcdFx0YXdhaXQgdGhpcy5fYXR0YWNoTW9kZWwodGV4dE1vZGVsLCB2aWV3VHlwZSA/PyB0ZXh0TW9kZWwudmlld1R5cGUsIHZpZXdTdGF0ZSwgcGVyZik7XG5cdFx0XHRjb25zdCBuZXdCb3R0b21Ub29sYmFyRGltZW5zaW9ucyA9IHRoaXMuX25vdGVib29rT3B0aW9ucy5jb21wdXRlQm90dG9tVG9vbGJhckRpbWVuc2lvbnModGhpcy52aWV3TW9kZWw/LnZpZXdUeXBlKTtcblxuXHRcdFx0aWYgKG9sZEJvdHRvbVRvb2xiYXJEaW1lbnNpb25zLmJvdHRvbVRvb2xiYXJHYXAgIT09IG5ld0JvdHRvbVRvb2xiYXJEaW1lbnNpb25zLmJvdHRvbVRvb2xiYXJHYXBcblx0XHRcdFx0fHwgb2xkQm90dG9tVG9vbGJhckRpbWVuc2lvbnMuYm90dG9tVG9vbGJhckhlaWdodCAhPT0gbmV3Qm90dG9tVG9vbGJhckRpbWVuc2lvbnMuYm90dG9tVG9vbGJhckhlaWdodCkge1xuXHRcdFx0XHR0aGlzLl9zdHlsZUVsZW1lbnQ/LnJlbW92ZSgpO1xuXHRcdFx0XHR0aGlzLl9jcmVhdGVMYXlvdXRTdHlsZXMoKTtcblx0XHRcdFx0dGhpcy5fd2Vidmlldz8udXBkYXRlT3B0aW9ucyh7XG5cdFx0XHRcdFx0Li4udGhpcy5ub3RlYm9va09wdGlvbnMuY29tcHV0ZVdlYnZpZXdPcHRpb25zKCksXG5cdFx0XHRcdFx0Zm9udEZhbWlseTogdGhpcy5fZ2VuZXJhdGVGb250RmFtaWx5KClcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHR0eXBlIFdvcmtiZW5jaE5vdGVib29rT3BlbkNsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0XHRvd25lcjogJ3JlYm9ybml4Jztcblx0XHRcdFx0Y29tbWVudDogJ0lkZW50aWZ5IHRoZSBub3RlYm9vayBlZGl0b3IgdmlldyB0eXBlJztcblx0XHRcdFx0c2NoZW1lOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnRmlsZSBzeXN0ZW0gcHJvdmlkZXIgc2NoZW1lIGZvciB0aGUgcmVzb3VyY2UnIH07XG5cdFx0XHRcdGV4dDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ0ZpbGUgZXh0ZW5zaW9uIGZvciB0aGUgcmVzb3VyY2UnIH07XG5cdFx0XHRcdHZpZXdUeXBlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVmlldyB0eXBlIG9mIHRoZSBub3RlYm9vayBlZGl0b3InIH07XG5cdFx0XHRcdGlzUmVwbDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1doZXRoZXIgdGhlIG5vdGVib29rIGVkaXRvciBpcyB3aXRoaW4gYSBSRVBMIGVkaXRvcicgfTtcblx0XHRcdH07XG5cblx0XHRcdHR5cGUgV29ya2JlbmNoTm90ZWJvb2tPcGVuRXZlbnQgPSB7XG5cdFx0XHRcdHNjaGVtZTogc3RyaW5nO1xuXHRcdFx0XHRleHQ6IHN0cmluZztcblx0XHRcdFx0dmlld1R5cGU6IHN0cmluZztcblx0XHRcdFx0aXNSZXBsOiBib29sZWFuO1xuXHRcdFx0fTtcblxuXHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8V29ya2JlbmNoTm90ZWJvb2tPcGVuRXZlbnQsIFdvcmtiZW5jaE5vdGVib29rT3BlbkNsYXNzaWZpY2F0aW9uPignbm90ZWJvb2svZWRpdG9yT3BlbmVkJywge1xuXHRcdFx0XHRzY2hlbWU6IHRleHRNb2RlbC51cmkuc2NoZW1lLFxuXHRcdFx0XHRleHQ6IGV4dG5hbWUodGV4dE1vZGVsLnVyaSksXG5cdFx0XHRcdHZpZXdUeXBlOiB0ZXh0TW9kZWwudmlld1R5cGUsXG5cdFx0XHRcdGlzUmVwbDogdGhpcy5pc1JlcGxIaXN0b3J5XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5yZXN0b3JlTGlzdFZpZXdTdGF0ZSh2aWV3U3RhdGUpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3Jlc3RvcmVTZWxlY3RlZEtlcm5lbCh2aWV3U3RhdGUpO1xuXG5cdFx0Ly8gbG9hZCBwcmVsb2FkcyBmb3IgbWF0Y2hpbmcga2VybmVsXG5cdFx0dGhpcy5fbG9hZEtlcm5lbFByZWxvYWRzKCk7XG5cblx0XHQvLyBjbGVhciBzdGF0ZVxuXHRcdHRoaXMuX2RuZENvbnRyb2xsZXI/LmNsZWFyR2xvYmFsRHJhZ1N0YXRlKCk7XG5cblx0XHR0aGlzLl9sb2NhbFN0b3JlLmFkZCh0aGlzLl9saXN0Lm9uRGlkQ2hhbmdlRm9jdXMoKCkgPT4ge1xuXHRcdFx0dGhpcy51cGRhdGVDb250ZXh0S2V5c09uRm9jdXNDaGFuZ2UoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLnVwZGF0ZUNvbnRleHRLZXlzT25Gb2N1c0NoYW5nZSgpO1xuXHRcdC8vIHJlbmRlciBtYXJrZG93biB0b3AgZG93biBvbiBpZGxlXG5cdFx0dGhpcy5fYmFja2dyb3VuZE1hcmtkb3duUmVuZGVyaW5nKCk7XG5cdH1cblxuXHRwcml2YXRlIF9iYWNrZ3JvdW5kTWFya2Rvd25SZW5kZXJSdW5uaW5nID0gZmFsc2U7XG5cdHByaXZhdGUgX2JhY2tncm91bmRNYXJrZG93blJlbmRlcmluZygpIHtcblx0XHRpZiAodGhpcy5fYmFja2dyb3VuZE1hcmtkb3duUmVuZGVyUnVubmluZykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2JhY2tncm91bmRNYXJrZG93blJlbmRlclJ1bm5pbmcgPSB0cnVlO1xuXHRcdERPTS5ydW5XaGVuV2luZG93SWRsZShET00uZ2V0V2luZG93KHRoaXMuZ2V0RG9tTm9kZSgpKSwgKGRlYWRsaW5lKSA9PiB7XG5cdFx0XHR0aGlzLl9iYWNrZ3JvdW5kTWFya2Rvd25SZW5kZXJpbmdXaXRoRGVhZGxpbmUoZGVhZGxpbmUpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfYmFja2dyb3VuZE1hcmtkb3duUmVuZGVyaW5nV2l0aERlYWRsaW5lKGRlYWRsaW5lOiBJZGxlRGVhZGxpbmUpIHtcblx0XHRjb25zdCBlbmRUaW1lID0gRGF0ZS5ub3coKSArIGRlYWRsaW5lLnRpbWVSZW1haW5pbmcoKTtcblxuXHRcdGNvbnN0IGV4ZWN1dGUgPSAoKSA9PiB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0aGlzLl9iYWNrZ3JvdW5kTWFya2Rvd25SZW5kZXJSdW5uaW5nID0gdHJ1ZTtcblx0XHRcdFx0aWYgKHRoaXMuX2lzRGlzcG9zZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIXRoaXMudmlld01vZGVsKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgZmlyc3RNYXJrdXBDZWxsID0gdGhpcy52aWV3TW9kZWwudmlld0NlbGxzLmZpbmQoY2VsbCA9PiBjZWxsLmNlbGxLaW5kID09PSBDZWxsS2luZC5NYXJrdXAgJiYgIXRoaXMuX3dlYnZpZXc/Lm1hcmt1cFByZXZpZXdNYXBwaW5nLmhhcyhjZWxsLmlkKSAmJiAhdGhpcy5jZWxsSXNIaWRkZW4oY2VsbCkpIGFzIE1hcmt1cENlbGxWaWV3TW9kZWwgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmICghZmlyc3RNYXJrdXBDZWxsKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5jcmVhdGVNYXJrdXBQcmV2aWV3KGZpcnN0TWFya3VwQ2VsbCk7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHR0aGlzLl9iYWNrZ3JvdW5kTWFya2Rvd25SZW5kZXJSdW5uaW5nID0gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChEYXRlLm5vdygpIDwgZW5kVGltZSkge1xuXHRcdFx0XHRzZXRUaW1lb3V0MChleGVjdXRlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2JhY2tncm91bmRNYXJrZG93blJlbmRlcmluZygpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRleGVjdXRlKCk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUNvbnRleHRLZXlzT25Gb2N1c0NoYW5nZSgpIHtcblx0XHRpZiAoIXRoaXMudmlld01vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZm9jdXNlZCA9IHRoaXMuX2xpc3QuZ2V0Rm9jdXNlZEVsZW1lbnRzKClbMF07XG5cdFx0aWYgKGZvY3VzZWQpIHtcblx0XHRcdGlmICghdGhpcy5fY2VsbENvbnRleHRLZXlNYW5hZ2VyKSB7XG5cdFx0XHRcdHRoaXMuX2NlbGxDb250ZXh0S2V5TWFuYWdlciA9IHRoaXMuX2xvY2FsU3RvcmUuYWRkKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2VsbENvbnRleHRLZXlNYW5hZ2VyLCB0aGlzLCBmb2N1c2VkIGFzIENlbGxWaWV3TW9kZWwpKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fY2VsbENvbnRleHRLZXlNYW5hZ2VyLnVwZGF0ZUZvckVsZW1lbnQoZm9jdXNlZCBhcyBDZWxsVmlld01vZGVsKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBzZXRPcHRpb25zKG9wdGlvbnM6IElOb3RlYm9va0VkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQpIHtcblx0XHRpZiAob3B0aW9ucz8uaXNSZWFkT25seSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLl9yZWFkT25seSA9IG9wdGlvbnM/LmlzUmVhZE9ubHk7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLnZpZXdNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMudmlld01vZGVsLnVwZGF0ZU9wdGlvbnMoeyBpc1JlYWRPbmx5OiB0aGlzLl9yZWFkT25seSB9KTtcblx0XHR0aGlzLm5vdGVib29rT3B0aW9ucy51cGRhdGVPcHRpb25zKHRoaXMuX3JlYWRPbmx5KTtcblxuXHRcdC8vIHJldmVhbCBjZWxsIGlmIGVkaXRvciBvcHRpb25zIHRlbGwgdG8gZG8gc29cblx0XHRjb25zdCBjZWxsT3B0aW9ucyA9IG9wdGlvbnM/LmNlbGxPcHRpb25zID8/IHRoaXMuX3BhcnNlSW5kZXhlZENlbGxPcHRpb25zKG9wdGlvbnMpO1xuXHRcdGlmIChjZWxsT3B0aW9ucykge1xuXHRcdFx0Y29uc3QgY2VsbCA9IHRoaXMudmlld01vZGVsLnZpZXdDZWxscy5maW5kKGNlbGwgPT4gY2VsbC51cmkudG9TdHJpbmcoKSA9PT0gY2VsbE9wdGlvbnMucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0XHRpZiAoY2VsbCkge1xuXHRcdFx0XHR0aGlzLmZvY3VzRWxlbWVudChjZWxsKTtcblx0XHRcdFx0Y29uc3Qgc2VsZWN0aW9uID0gY2VsbE9wdGlvbnMub3B0aW9ucz8uc2VsZWN0aW9uO1xuXHRcdFx0XHRpZiAoc2VsZWN0aW9uKSB7XG5cdFx0XHRcdFx0Y2VsbC51cGRhdGVFZGl0U3RhdGUoQ2VsbEVkaXRTdGF0ZS5FZGl0aW5nLCAnc2V0T3B0aW9ucycpO1xuXHRcdFx0XHRcdGNlbGwuZm9jdXNNb2RlID0gQ2VsbEZvY3VzTW9kZS5FZGl0b3I7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5yZXZlYWxSYW5nZUluQ2VudGVySWZPdXRzaWRlVmlld3BvcnRBc3luYyhjZWxsLCBuZXcgUmFuZ2Uoc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciwgc2VsZWN0aW9uLnN0YXJ0Q29sdW1uLCBzZWxlY3Rpb24uZW5kTGluZU51bWJlciB8fCBzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyLCBzZWxlY3Rpb24uZW5kQ29sdW1uIHx8IHNlbGVjdGlvbi5zdGFydENvbHVtbikpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuX2xpc3QucmV2ZWFsQ2VsbChjZWxsLCBvcHRpb25zPy5jZWxsUmV2ZWFsVHlwZSA/PyBDZWxsUmV2ZWFsVHlwZS5DZW50ZXJJZk91dHNpZGVWaWV3cG9ydCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBlZGl0b3IgPSB0aGlzLl9yZW5kZXJlZEVkaXRvcnMuZ2V0KGNlbGwpITtcblx0XHRcdFx0aWYgKGVkaXRvcikge1xuXHRcdFx0XHRcdGlmIChjZWxsT3B0aW9ucy5vcHRpb25zPy5zZWxlY3Rpb24pIHtcblx0XHRcdFx0XHRcdGNvbnN0IHsgc2VsZWN0aW9uIH0gPSBjZWxsT3B0aW9ucy5vcHRpb25zO1xuXHRcdFx0XHRcdFx0Y29uc3QgZWRpdG9yU2VsZWN0aW9uID0gbmV3IFJhbmdlKHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIsIHNlbGVjdGlvbi5zdGFydENvbHVtbiwgc2VsZWN0aW9uLmVuZExpbmVOdW1iZXIgfHwgc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciwgc2VsZWN0aW9uLmVuZENvbHVtbiB8fCBzZWxlY3Rpb24uc3RhcnRDb2x1bW4pO1xuXHRcdFx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihlZGl0b3JTZWxlY3Rpb24pO1xuXHRcdFx0XHRcdFx0ZWRpdG9yLnJldmVhbFBvc2l0aW9uSW5DZW50ZXJJZk91dHNpZGVWaWV3cG9ydCh7XG5cdFx0XHRcdFx0XHRcdGxpbmVOdW1iZXI6IHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRcdGNvbHVtbjogc2VsZWN0aW9uLnN0YXJ0Q29sdW1uXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucmV2ZWFsUmFuZ2VJbkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0QXN5bmMoY2VsbCwgZWRpdG9yU2VsZWN0aW9uKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCFjZWxsT3B0aW9ucy5vcHRpb25zPy5wcmVzZXJ2ZUZvY3VzKSB7XG5cdFx0XHRcdFx0XHRlZGl0b3IuZm9jdXMoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBzZWxlY3QgY2VsbHMgaWYgb3B0aW9ucyB0ZWxsIHRvIGRvIHNvXG5cdFx0Ly8gdG9kb0ByZWJvcm5peCBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTE4MTA4IHN1cHBvcnQgc2VsZWN0aW9ucyBub3QganVzdCBmb2N1c1xuXHRcdC8vIHRvZG9AcmVib3JuaXggc3VwcG9ydCBtdWx0aXBlIHNlbGVjdGlvbnNcblx0XHRpZiAob3B0aW9ucz8uY2VsbFNlbGVjdGlvbnMpIHtcblx0XHRcdGNvbnN0IGZvY3VzQ2VsbEluZGV4ID0gb3B0aW9ucy5jZWxsU2VsZWN0aW9uc1swXS5zdGFydDtcblx0XHRcdGNvbnN0IGZvY3VzZWRDZWxsID0gdGhpcy52aWV3TW9kZWwuY2VsbEF0KGZvY3VzQ2VsbEluZGV4KTtcblx0XHRcdGlmIChmb2N1c2VkQ2VsbCkge1xuXHRcdFx0XHR0aGlzLnZpZXdNb2RlbC51cGRhdGVTZWxlY3Rpb25zU3RhdGUoe1xuXHRcdFx0XHRcdGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCxcblx0XHRcdFx0XHRmb2N1czogeyBzdGFydDogZm9jdXNDZWxsSW5kZXgsIGVuZDogZm9jdXNDZWxsSW5kZXggKyAxIH0sXG5cdFx0XHRcdFx0c2VsZWN0aW9uczogb3B0aW9ucy5jZWxsU2VsZWN0aW9uc1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGhpcy5yZXZlYWxJbkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0KGZvY3VzZWRDZWxsKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl91cGRhdGVGb3JPcHRpb25zKCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VPcHRpb25zLmZpcmUoKTtcblx0fVxuXG5cdHByaXZhdGUgX3BhcnNlSW5kZXhlZENlbGxPcHRpb25zKG9wdGlvbnM6IElOb3RlYm9va0VkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQpIHtcblx0XHRpZiAob3B0aW9ucz8uaW5kZXhlZENlbGxPcHRpb25zKSB7XG5cdFx0XHQvLyBjb252ZXJ0IGluZGV4IGJhc2VkIHNlbGVjdGlvbnNcblx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLmNlbGxBdChvcHRpb25zLmluZGV4ZWRDZWxsT3B0aW9ucy5pbmRleCk7XG5cdFx0XHRpZiAoY2VsbCkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHJlc291cmNlOiBjZWxsLnVyaSxcblx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRzZWxlY3Rpb246IG9wdGlvbnMuaW5kZXhlZENlbGxPcHRpb25zLnNlbGVjdGlvbixcblx0XHRcdFx0XHRcdHByZXNlcnZlRm9jdXM6IGZhbHNlXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIF9kZXRhY2hNb2RlbCgpIHtcblx0XHR0aGlzLl9sb2NhbFN0b3JlLmNsZWFyKCk7XG5cdFx0ZGlzcG9zZSh0aGlzLl9sb2NhbENlbGxTdGF0ZUxpc3RlbmVycyk7XG5cdFx0dGhpcy5fbGlzdC5kZXRhY2hWaWV3TW9kZWwoKTtcblx0XHR0aGlzLnZpZXdNb2RlbD8uZGlzcG9zZSgpO1xuXHRcdC8vIGF2b2lkIGV2ZW50XG5cdFx0dGhpcy52aWV3TW9kZWwgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fd2Vidmlldz8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3dlYnZpZXc/LmVsZW1lbnQucmVtb3ZlKCk7XG5cdFx0dGhpcy5fd2VidmlldyA9IG51bGw7XG5cdFx0dGhpcy5fbGlzdC5jbGVhcigpO1xuXHR9XG5cblxuXHRwcml2YXRlIF91cGRhdGVGb3JPcHRpb25zKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy52aWV3TW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9lZGl0b3JFZGl0YWJsZS5zZXQoIXRoaXMudmlld01vZGVsLm9wdGlvbnMuaXNSZWFkT25seSk7XG5cdFx0dGhpcy5fb3ZlcmZsb3dDb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnbm90ZWJvb2stZWRpdG9yLWVkaXRhYmxlJywgIXRoaXMudmlld01vZGVsLm9wdGlvbnMuaXNSZWFkT25seSk7XG5cdFx0dGhpcy5nZXREb21Ob2RlKCkuY2xhc3NMaXN0LnRvZ2dsZSgnbm90ZWJvb2stZWRpdG9yLWVkaXRhYmxlJywgIXRoaXMudmlld01vZGVsLm9wdGlvbnMuaXNSZWFkT25seSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9yZXNvbHZlV2VidmlldygpOiBQcm9taXNlPEJhY2tMYXllcldlYlZpZXc8SUNvbW1vbkNlbGxJbmZvPiB8IG51bGw+IHtcblx0XHRpZiAoIXRoaXMudGV4dE1vZGVsKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fd2Vidmlld1Jlc29sdmVQcm9taXNlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fd2Vidmlld1Jlc29sdmVQcm9taXNlO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fd2Vidmlldykge1xuXHRcdFx0dGhpcy5fZW5zdXJlV2Vidmlldyh0aGlzLmdldElkKCksIHRoaXMudGV4dE1vZGVsLnZpZXdUeXBlLCB0aGlzLnRleHRNb2RlbC51cmkpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3dlYnZpZXdSZXNvbHZlUHJvbWlzZSA9IChhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuX3dlYnZpZXcpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdOb3RlYm9vayBvdXRwdXQgd2VidmlldyBvYmplY3QgaXMgbm90IGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LicpO1xuXHRcdFx0fVxuXG5cdFx0XHRhd2FpdCB0aGlzLl93ZWJ2aWV3LmNyZWF0ZVdlYnZpZXcodGhpcy5jcmVhdGlvbk9wdGlvbnMuY29kZVdpbmRvdyA/PyBtYWluV2luZG93KTtcblx0XHRcdGlmICghdGhpcy5fd2Vidmlldy53ZWJ2aWV3KSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignTm90ZWJvb2sgb3V0cHV0IHdlYnZpZXcgZWxlbWVudCB3YXMgbm90IGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LicpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9sb2NhbFN0b3JlLmFkZCh0aGlzLl93ZWJ2aWV3LndlYnZpZXcub25EaWRCbHVyKCgpID0+IHtcblx0XHRcdFx0dGhpcy5fb3V0cHV0Rm9jdXMuc2V0KGZhbHNlKTtcblx0XHRcdFx0dGhpcy5fd2Vidmlld0ZvY3VzZWQgPSBmYWxzZTtcblxuXHRcdFx0XHR0aGlzLnVwZGF0ZUVkaXRvckZvY3VzKCk7XG5cdFx0XHRcdHRoaXMudXBkYXRlQ2VsbEZvY3VzTW9kZSgpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHR0aGlzLl9sb2NhbFN0b3JlLmFkZCh0aGlzLl93ZWJ2aWV3LndlYnZpZXcub25EaWRGb2N1cygoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX291dHB1dEZvY3VzLnNldCh0cnVlKTtcblx0XHRcdFx0dGhpcy51cGRhdGVFZGl0b3JGb2N1cygpO1xuXHRcdFx0XHR0aGlzLl93ZWJ2aWV3Rm9jdXNlZCA9IHRydWU7XG5cdFx0XHR9KSk7XG5cblx0XHRcdHRoaXMuX2xvY2FsU3RvcmUuYWRkKHRoaXMuX3dlYnZpZXcub25NZXNzYWdlKGUgPT4ge1xuXHRcdFx0XHR0aGlzLl9vbkRpZFJlY2VpdmVNZXNzYWdlLmZpcmUoZSk7XG5cdFx0XHR9KSk7XG5cblx0XHRcdHJldHVybiB0aGlzLl93ZWJ2aWV3O1xuXHRcdH0pKCk7XG5cblx0XHRyZXR1cm4gdGhpcy5fd2Vidmlld1Jlc29sdmVQcm9taXNlO1xuXHR9XG5cblx0cHJpdmF0ZSBfZW5zdXJlV2VidmlldyhpZDogc3RyaW5nLCB2aWV3VHlwZTogc3RyaW5nLCByZXNvdXJjZTogVVJJKSB7XG5cdFx0aWYgKHRoaXMuX3dlYnZpZXcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblxuXHRcdHRoaXMuX3dlYnZpZXcgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEJhY2tMYXllcldlYlZpZXcsIHtcblx0XHRcdGdldCBjcmVhdGlvbk9wdGlvbnMoKSB7IHJldHVybiB0aGF0LmNyZWF0aW9uT3B0aW9uczsgfSxcblx0XHRcdHNldFNjcm9sbFRvcChzY3JvbGxUb3A6IG51bWJlcikgeyB0aGF0Ll9saXN0LnNjcm9sbFRvcCA9IHNjcm9sbFRvcDsgfSxcblx0XHRcdHRyaWdnZXJTY3JvbGwoZXZlbnQ6IElNb3VzZVdoZWVsRXZlbnQpIHsgdGhhdC5fbGlzdC50cmlnZ2VyU2Nyb2xsRnJvbU1vdXNlV2hlZWxFdmVudChldmVudCk7IH0sXG5cdFx0XHRnZXRDZWxsQnlJbmZvOiB0aGF0LmdldENlbGxCeUluZm8uYmluZCh0aGF0KSxcblx0XHRcdGdldENlbGxCeUlkOiB0aGF0Ll9nZXRDZWxsQnlJZC5iaW5kKHRoYXQpLFxuXHRcdFx0dG9nZ2xlTm90ZWJvb2tDZWxsU2VsZWN0aW9uOiB0aGF0Ll90b2dnbGVOb3RlYm9va0NlbGxTZWxlY3Rpb24uYmluZCh0aGF0KSxcblx0XHRcdGZvY3VzTm90ZWJvb2tDZWxsOiB0aGF0LmZvY3VzTm90ZWJvb2tDZWxsLmJpbmQodGhhdCksXG5cdFx0XHRmb2N1c05leHROb3RlYm9va0NlbGw6IHRoYXQuZm9jdXNOZXh0Tm90ZWJvb2tDZWxsLmJpbmQodGhhdCksXG5cdFx0XHR1cGRhdGVPdXRwdXRIZWlnaHQ6IHRoYXQuX3VwZGF0ZU91dHB1dEhlaWdodC5iaW5kKHRoYXQpLFxuXHRcdFx0c2NoZWR1bGVPdXRwdXRIZWlnaHRBY2s6IHRoYXQuX3NjaGVkdWxlT3V0cHV0SGVpZ2h0QWNrLmJpbmQodGhhdCksXG5cdFx0XHR1cGRhdGVNYXJrdXBDZWxsSGVpZ2h0OiB0aGF0Ll91cGRhdGVNYXJrdXBDZWxsSGVpZ2h0LmJpbmQodGhhdCksXG5cdFx0XHRzZXRNYXJrdXBDZWxsRWRpdFN0YXRlOiB0aGF0Ll9zZXRNYXJrdXBDZWxsRWRpdFN0YXRlLmJpbmQodGhhdCksXG5cdFx0XHRkaWRTdGFydERyYWdNYXJrdXBDZWxsOiB0aGF0Ll9kaWRTdGFydERyYWdNYXJrdXBDZWxsLmJpbmQodGhhdCksXG5cdFx0XHRkaWREcmFnTWFya3VwQ2VsbDogdGhhdC5fZGlkRHJhZ01hcmt1cENlbGwuYmluZCh0aGF0KSxcblx0XHRcdGRpZERyb3BNYXJrdXBDZWxsOiB0aGF0Ll9kaWREcm9wTWFya3VwQ2VsbC5iaW5kKHRoYXQpLFxuXHRcdFx0ZGlkRW5kRHJhZ01hcmt1cENlbGw6IHRoYXQuX2RpZEVuZERyYWdNYXJrdXBDZWxsLmJpbmQodGhhdCksXG5cdFx0XHRkaWRSZXNpemVPdXRwdXQ6IHRoYXQuX2RpZFJlc2l6ZU91dHB1dC5iaW5kKHRoYXQpLFxuXHRcdFx0dXBkYXRlUGVyZm9ybWFuY2VNZXRhZGF0YTogdGhhdC5fdXBkYXRlUGVyZm9ybWFuY2VNZXRhZGF0YS5iaW5kKHRoYXQpLFxuXHRcdFx0ZGlkRm9jdXNPdXRwdXRJbnB1dENoYW5nZTogdGhhdC5fZGlkRm9jdXNPdXRwdXRJbnB1dENoYW5nZS5iaW5kKHRoYXQpLFxuXHRcdH0sIGlkLCB2aWV3VHlwZSwgcmVzb3VyY2UsIHtcblx0XHRcdC4uLnRoaXMuX25vdGVib29rT3B0aW9ucy5jb21wdXRlV2Vidmlld09wdGlvbnMoKSxcblx0XHRcdGZvbnRGYW1pbHk6IHRoaXMuX2dlbmVyYXRlRm9udEZhbWlseSgpXG5cdFx0fSwgdGhpcy5ub3RlYm9va1JlbmRlcmVyTWVzc2FnaW5nLmdldFNjb3BlZCh0aGlzLl91dWlkKSk7XG5cblx0XHR0aGlzLl93ZWJ2aWV3LmVsZW1lbnQuc3R5bGUud2lkdGggPSAnMTAwJSc7XG5cblx0XHQvLyBhdHRhY2ggdGhlIHdlYnZpZXcgY29udGFpbmVyIHRvIHRoZSBET00gdHJlZSBmaXJzdFxuXHRcdHRoaXMuX2xpc3QuYXR0YWNoV2Vidmlldyh0aGlzLl93ZWJ2aWV3LmVsZW1lbnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfYXR0YWNoTW9kZWwodGV4dE1vZGVsOiBOb3RlYm9va1RleHRNb2RlbCwgdmlld1R5cGU6IHN0cmluZywgdmlld1N0YXRlOiBJTm90ZWJvb2tFZGl0b3JWaWV3U3RhdGUgfCB1bmRlZmluZWQsIHBlcmY/OiBOb3RlYm9va1BlcmZNYXJrcykge1xuXHRcdHRoaXMuX2Vuc3VyZVdlYnZpZXcodGhpcy5nZXRJZCgpLCB0ZXh0TW9kZWwudmlld1R5cGUsIHRleHRNb2RlbC51cmkpO1xuXG5cdFx0dGhpcy52aWV3TW9kZWwgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vdGVib29rVmlld01vZGVsLCB2aWV3VHlwZSwgdGV4dE1vZGVsLCB0aGlzLl92aWV3Q29udGV4dCwgdGhpcy5nZXRMYXlvdXRJbmZvKCksIHsgaXNSZWFkT25seTogdGhpcy5fcmVhZE9ubHkgfSk7XG5cdFx0dGhpcy5fdmlld0NvbnRleHQuZXZlbnREaXNwYXRjaGVyLmVtaXQoW25ldyBOb3RlYm9va0xheW91dENoYW5nZWRFdmVudCh7IHdpZHRoOiB0cnVlLCBmb250SW5mbzogdHJ1ZSB9LCB0aGlzLmdldExheW91dEluZm8oKSldKTtcblx0XHR0aGlzLm5vdGVib29rT3B0aW9ucy51cGRhdGVPcHRpb25zKHRoaXMuX3JlYWRPbmx5KTtcblxuXHRcdHRoaXMuX3VwZGF0ZUZvck9wdGlvbnMoKTtcblx0XHR0aGlzLl91cGRhdGVGb3JOb3RlYm9va0NvbmZpZ3VyYXRpb24oKTtcblxuXHRcdC8vIHJlc3RvcmUgdmlldyBzdGF0ZXMsIGluY2x1ZGluZyBjb250cmlidXRpb25zXG5cblx0XHR7XG5cdFx0XHQvLyByZXN0b3JlIHZpZXcgc3RhdGVcblx0XHRcdHRoaXMudmlld01vZGVsLnJlc3RvcmVFZGl0b3JWaWV3U3RhdGUodmlld1N0YXRlKTtcblxuXHRcdFx0Ly8gY29udHJpYnV0aW9uIHN0YXRlIHJlc3RvcmVcblxuXHRcdFx0Y29uc3QgY29udHJpYnV0aW9uc1N0YXRlID0gdmlld1N0YXRlPy5jb250cmlidXRpb25zU3RhdGUgfHwge307XG5cdFx0XHRmb3IgKGNvbnN0IFtpZCwgY29udHJpYnV0aW9uXSBvZiB0aGlzLl9jb250cmlidXRpb25zKSB7XG5cdFx0XHRcdGlmICh0eXBlb2YgY29udHJpYnV0aW9uLnJlc3RvcmVWaWV3U3RhdGUgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0XHRjb250cmlidXRpb24ucmVzdG9yZVZpZXdTdGF0ZShjb250cmlidXRpb25zU3RhdGVbaWRdKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX2xvY2FsU3RvcmUuYWRkKHRoaXMudmlld01vZGVsLm9uRGlkQ2hhbmdlVmlld0NlbGxzKGUgPT4ge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VWaWV3Q2VsbHMuZmlyZShlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9sb2NhbFN0b3JlLmFkZCh0aGlzLnZpZXdNb2RlbC5vbkRpZENoYW5nZVNlbGVjdGlvbigoKSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVNlbGVjdGlvbi5maXJlKCk7XG5cdFx0XHR0aGlzLnVwZGF0ZVNlbGVjdGVkTWFya2Rvd25QcmV2aWV3cygpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2xvY2FsU3RvcmUuYWRkKHRoaXMuX2xpc3Qub25XaWxsU2Nyb2xsKGUgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX3dlYnZpZXc/LmlzUmVzb2x2ZWQoKSkge1xuXHRcdFx0XHR0aGlzLl93ZWJ2aWV3VHJhbnNwYXJlbnRDb3ZlciEuc3R5bGUudHJhbnNmb3JtID0gYHRyYW5zbGF0ZVkoJHtlLnNjcm9sbFRvcH0pYDtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRsZXQgaGFzUGVuZGluZ0NoYW5nZUNvbnRlbnRIZWlnaHQgPSBmYWxzZTtcblx0XHR0aGlzLl9sb2NhbFN0b3JlLmFkZCh0aGlzLl9saXN0Lm9uRGlkQ2hhbmdlQ29udGVudEhlaWdodCgoKSA9PiB7XG5cdFx0XHRpZiAoaGFzUGVuZGluZ0NoYW5nZUNvbnRlbnRIZWlnaHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aGFzUGVuZGluZ0NoYW5nZUNvbnRlbnRIZWlnaHQgPSB0cnVlO1xuXG5cdFx0XHR0aGlzLl9sb2NhbFN0b3JlLmFkZChET00uc2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZShET00uZ2V0V2luZG93KHRoaXMuZ2V0RG9tTm9kZSgpKSwgKCkgPT4ge1xuXHRcdFx0XHRoYXNQZW5kaW5nQ2hhbmdlQ29udGVudEhlaWdodCA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLl91cGRhdGVTY3JvbGxIZWlnaHQoKTtcblx0XHRcdH0sIDEwMCkpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2xvY2FsU3RvcmUuYWRkKHRoaXMuX2xpc3Qub25EaWRSZW1vdmVPdXRwdXRzKG91dHB1dHMgPT4ge1xuXHRcdFx0b3V0cHV0cy5mb3JFYWNoKG91dHB1dCA9PiB0aGlzLnJlbW92ZUluc2V0KG91dHB1dCkpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9sb2NhbFN0b3JlLmFkZCh0aGlzLl9saXN0Lm9uRGlkSGlkZU91dHB1dHMob3V0cHV0cyA9PiB7XG5cdFx0XHRvdXRwdXRzLmZvckVhY2gob3V0cHV0ID0+IHRoaXMuaGlkZUluc2V0KG91dHB1dCkpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9sb2NhbFN0b3JlLmFkZCh0aGlzLl9saXN0Lm9uRGlkUmVtb3ZlQ2VsbHNGcm9tVmlldyhjZWxscyA9PiB7XG5cdFx0XHRjb25zdCBoaWRkZW5DZWxsczogTWFya3VwQ2VsbFZpZXdNb2RlbFtdID0gW107XG5cdFx0XHRjb25zdCBkZWxldGVkQ2VsbHM6IE1hcmt1cENlbGxWaWV3TW9kZWxbXSA9IFtdO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGNlbGwgb2YgY2VsbHMpIHtcblx0XHRcdFx0aWYgKGNlbGwuY2VsbEtpbmQgPT09IENlbGxLaW5kLk1hcmt1cCkge1xuXHRcdFx0XHRcdGNvbnN0IG1kQ2VsbCA9IGNlbGwgYXMgTWFya3VwQ2VsbFZpZXdNb2RlbDtcblx0XHRcdFx0XHRpZiAodGhpcy52aWV3TW9kZWw/LnZpZXdDZWxscy5maW5kKGNlbGwgPT4gY2VsbC5oYW5kbGUgPT09IG1kQ2VsbC5oYW5kbGUpKSB7XG5cdFx0XHRcdFx0XHQvLyBDZWxsIGhhcyBiZWVuIGZvbGRlZCBidXQgaXMgc3RpbGwgaW4gbW9kZWxcblx0XHRcdFx0XHRcdGhpZGRlbkNlbGxzLnB1c2gobWRDZWxsKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly8gQ2VsbCB3YXMgZGVsZXRlZFxuXHRcdFx0XHRcdFx0ZGVsZXRlZENlbGxzLnB1c2gobWRDZWxsKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy5oaWRlTWFya3VwUHJldmlld3MoaGlkZGVuQ2VsbHMpO1xuXHRcdFx0dGhpcy5kZWxldGVNYXJrdXBQcmV2aWV3cyhkZWxldGVkQ2VsbHMpO1xuXHRcdH0pKTtcblxuXHRcdC8vIGluaXQgcmVuZGVyaW5nXG5cdFx0YXdhaXQgdGhpcy5fd2FybXVwV2l0aE1hcmtkb3duUmVuZGVyZXIodGhpcy52aWV3TW9kZWwsIHZpZXdTdGF0ZSwgcGVyZik7XG5cblx0XHRwZXJmPy5tYXJrKCdjdXN0b21NYXJrZG93bkxvYWRlZCcpO1xuXG5cdFx0Ly8gbW9kZWwgYXR0YWNoZWRcblx0XHR0aGlzLl9sb2NhbENlbGxTdGF0ZUxpc3RlbmVycyA9IHRoaXMudmlld01vZGVsLnZpZXdDZWxscy5tYXAoY2VsbCA9PiB0aGlzLl9iaW5kQ2VsbExpc3RlbmVyKGNlbGwpKTtcblx0XHR0aGlzLl9sYXN0Q2VsbFdpdGhFZGl0b3JGb2N1cyA9IHRoaXMudmlld01vZGVsLnZpZXdDZWxscy5maW5kKHZpZXdDZWxsID0+IHRoaXMuZ2V0QWN0aXZlQ2VsbCgpID09PSB2aWV3Q2VsbCAmJiB2aWV3Q2VsbC5mb2N1c01vZGUgPT09IENlbGxGb2N1c01vZGUuRWRpdG9yKSA/PyBudWxsO1xuXG5cdFx0dGhpcy5fbG9jYWxTdG9yZS5hZGQodGhpcy52aWV3TW9kZWwub25EaWRDaGFuZ2VWaWV3Q2VsbHMoKGUpID0+IHtcblx0XHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gdXBkYXRlIGNlbGwgbGlzdGVuZXJcblx0XHRcdFsuLi5lLnNwbGljZXNdLnJldmVyc2UoKS5mb3JFYWNoKHNwbGljZSA9PiB7XG5cdFx0XHRcdGNvbnN0IFtzdGFydCwgZGVsZXRlZCwgbmV3Q2VsbHNdID0gc3BsaWNlO1xuXHRcdFx0XHRjb25zdCBkZWxldGVkQ2VsbHMgPSB0aGlzLl9sb2NhbENlbGxTdGF0ZUxpc3RlbmVycy5zcGxpY2Uoc3RhcnQsIGRlbGV0ZWQsIC4uLm5ld0NlbGxzLm1hcChjZWxsID0+IHRoaXMuX2JpbmRDZWxsTGlzdGVuZXIoY2VsbCkpKTtcblxuXHRcdFx0XHRkaXNwb3NlKGRlbGV0ZWRDZWxscyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKGUuc3BsaWNlcy5zb21lKHMgPT4gc1syXS5zb21lKGNlbGwgPT4gY2VsbC5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuTWFya3VwKSkpIHtcblx0XHRcdFx0dGhpcy5fYmFja2dyb3VuZE1hcmtkb3duUmVuZGVyaW5nKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0aWYgKHRoaXMuX2RpbWVuc2lvbikge1xuXHRcdFx0dGhpcy5fbGlzdC5sYXlvdXQodGhpcy5nZXRCb2R5SGVpZ2h0KHRoaXMuX2RpbWVuc2lvbi5oZWlnaHQpLCB0aGlzLl9kaW1lbnNpb24ud2lkdGgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9saXN0LmxheW91dCgpO1xuXHRcdH1cblxuXHRcdHRoaXMuX2RuZENvbnRyb2xsZXI/LmNsZWFyR2xvYmFsRHJhZ1N0YXRlKCk7XG5cblx0XHQvLyByZXN0b3JlIGxpc3Qgc3RhdGUgYXQgbGFzdCwgaXQgbXVzdCBiZSBhZnRlciBsaXN0IGxheW91dFxuXHRcdHRoaXMucmVzdG9yZUxpc3RWaWV3U3RhdGUodmlld1N0YXRlKTtcblx0fVxuXG5cdHByaXZhdGUgX2JpbmRDZWxsTGlzdGVuZXIoY2VsbDogSUNlbGxWaWV3TW9kZWwpIHtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdHN0b3JlLmFkZChjZWxsLm9uRGlkQ2hhbmdlTGF5b3V0KGUgPT4ge1xuXHRcdFx0Ly8gZS50b3RhbEhlaWdodCB3aWxsIGJlIGZhbHNlIGl0J3Mgbm90IGNoYW5nZWRcblx0XHRcdGlmIChlLnRvdGFsSGVpZ2h0IHx8IGUub3V0ZXJXaWR0aCkge1xuXHRcdFx0XHR0aGlzLmxheW91dE5vdGVib29rQ2VsbChjZWxsLCBjZWxsLmxheW91dEluZm8udG90YWxIZWlnaHQsIGUuY29udGV4dCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0aWYgKGNlbGwuY2VsbEtpbmQgPT09IENlbGxLaW5kLkNvZGUpIHtcblx0XHRcdHN0b3JlLmFkZCgoY2VsbCBhcyBDb2RlQ2VsbFZpZXdNb2RlbCkub25EaWRSZW1vdmVPdXRwdXRzKChvdXRwdXRzKSA9PiB7XG5cdFx0XHRcdG91dHB1dHMuZm9yRWFjaChvdXRwdXQgPT4gdGhpcy5yZW1vdmVJbnNldChvdXRwdXQpKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHRzdG9yZS5hZGQoKGNlbGwgYXMgQ2VsbFZpZXdNb2RlbCkub25EaWRDaGFuZ2VTdGF0ZShlID0+IHtcblx0XHRcdGlmIChlLmlucHV0Q29sbGFwc2VkQ2hhbmdlZCAmJiBjZWxsLmlzSW5wdXRDb2xsYXBzZWQgJiYgY2VsbC5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuTWFya3VwKSB7XG5cdFx0XHRcdHRoaXMuaGlkZU1hcmt1cFByZXZpZXdzKFsoY2VsbCBhcyBNYXJrdXBDZWxsVmlld01vZGVsKV0pO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZS5vdXRwdXRDb2xsYXBzZWRDaGFuZ2VkICYmIGNlbGwuaXNPdXRwdXRDb2xsYXBzZWQgJiYgY2VsbC5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuQ29kZSkge1xuXHRcdFx0XHRjZWxsLm91dHB1dHNWaWV3TW9kZWxzLmZvckVhY2gob3V0cHV0ID0+IHRoaXMuaGlkZUluc2V0KG91dHB1dCkpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZS5mb2N1c01vZGVDaGFuZ2VkKSB7XG5cdFx0XHRcdHRoaXMuX3ZhbGlkYXRlQ2VsbEZvY3VzTW9kZShjZWxsKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRzdG9yZS5hZGQoY2VsbC5vbkNlbGxEZWNvcmF0aW9uc0NoYW5nZWQoZSA9PiB7XG5cdFx0XHRlLmFkZGVkLmZvckVhY2gob3B0aW9ucyA9PiB7XG5cdFx0XHRcdGlmIChvcHRpb25zLmNsYXNzTmFtZSkge1xuXHRcdFx0XHRcdHRoaXMuZGVsdGFDZWxsQ29udGFpbmVyQ2xhc3NOYW1lcyhjZWxsLmlkLCBbb3B0aW9ucy5jbGFzc05hbWVdLCBbXSwgY2VsbC5jZWxsS2luZCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAob3B0aW9ucy5vdXRwdXRDbGFzc05hbWUpIHtcblx0XHRcdFx0XHR0aGlzLmRlbHRhQ2VsbENvbnRhaW5lckNsYXNzTmFtZXMoY2VsbC5pZCwgW29wdGlvbnMub3V0cHV0Q2xhc3NOYW1lXSwgW10sIGNlbGwuY2VsbEtpbmQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0ZS5yZW1vdmVkLmZvckVhY2gob3B0aW9ucyA9PiB7XG5cdFx0XHRcdGlmIChvcHRpb25zLmNsYXNzTmFtZSkge1xuXHRcdFx0XHRcdHRoaXMuZGVsdGFDZWxsQ29udGFpbmVyQ2xhc3NOYW1lcyhjZWxsLmlkLCBbXSwgW29wdGlvbnMuY2xhc3NOYW1lXSwgY2VsbC5jZWxsS2luZCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAob3B0aW9ucy5vdXRwdXRDbGFzc05hbWUpIHtcblx0XHRcdFx0XHR0aGlzLmRlbHRhQ2VsbENvbnRhaW5lckNsYXNzTmFtZXMoY2VsbC5pZCwgW10sIFtvcHRpb25zLm91dHB1dENsYXNzTmFtZV0sIGNlbGwuY2VsbEtpbmQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gc3RvcmU7XG5cdH1cblxuXG5cdHByaXZhdGUgX2xhc3RDZWxsV2l0aEVkaXRvckZvY3VzOiBJQ2VsbFZpZXdNb2RlbCB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIF92YWxpZGF0ZUNlbGxGb2N1c01vZGUoY2VsbDogSUNlbGxWaWV3TW9kZWwpIHtcblx0XHRpZiAoY2VsbC5mb2N1c01vZGUgIT09IENlbGxGb2N1c01vZGUuRWRpdG9yKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2xhc3RDZWxsV2l0aEVkaXRvckZvY3VzICYmIHRoaXMuX2xhc3RDZWxsV2l0aEVkaXRvckZvY3VzICE9PSBjZWxsKSB7XG5cdFx0XHR0aGlzLl9sYXN0Q2VsbFdpdGhFZGl0b3JGb2N1cy5mb2N1c01vZGUgPSBDZWxsRm9jdXNNb2RlLkNvbnRhaW5lcjtcblx0XHR9XG5cblx0XHR0aGlzLl9sYXN0Q2VsbFdpdGhFZGl0b3JGb2N1cyA9IGNlbGw7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF93YXJtdXBXaXRoTWFya2Rvd25SZW5kZXJlcih2aWV3TW9kZWw6IE5vdGVib29rVmlld01vZGVsLCB2aWV3U3RhdGU6IElOb3RlYm9va0VkaXRvclZpZXdTdGF0ZSB8IHVuZGVmaW5lZCwgcGVyZj86IE5vdGVib29rUGVyZk1hcmtzKSB7XG5cblx0XHR0aGlzLmxvZ1NlcnZpY2UuZGVidWcoJ05vdGVib29rRWRpdG9yV2lkZ2V0JywgJ3dhcm11cCAnICsgdGhpcy52aWV3TW9kZWw/LnVyaS50b1N0cmluZygpKTtcblx0XHRhd2FpdCB0aGlzLl9yZXNvbHZlV2VidmlldygpO1xuXHRcdHBlcmY/Lm1hcmsoJ3dlYnZpZXdDb21tTG9hZGVkJyk7XG5cblx0XHR0aGlzLmxvZ1NlcnZpY2UuZGVidWcoJ05vdGVib29rRWRpdG9yV2lkZ2V0JywgJ3dhcm11cCAtIHdlYnZpZXcgcmVzb2x2ZWQnKTtcblxuXHRcdC8vIG1ha2Ugc3VyZSB0aGF0IHRoZSB3ZWJ2aWV3IGlzIG5vdCB2aXNpYmxlIG90aGVyd2lzZSB1c2VycyB3aWxsIHNlZSBwcmUtcmVuZGVyZWQgbWFya2Rvd24gY2VsbHMgaW4gd3JvbmcgcG9zaXRpb24gYXMgdGhlIGxpc3QgdmlldyBkb2Vzbid0IGhhdmUgYSBjb3JyZWN0IGB0b3BgIG9mZnNldCB5ZXRcblx0XHR0aGlzLl93ZWJ2aWV3IS5lbGVtZW50LnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcblx0XHQvLyB3YXJtIHVwIGNhbiB0YWtlIGFyb3VuZCAyMDBtcyB0byBsb2FkIG1hcmtkb3duIGxpYnJhcmllcywgZXRjLlxuXHRcdGF3YWl0IHRoaXMuX3dhcm11cFZpZXdwb3J0TWFya2Rvd25DZWxscyh2aWV3TW9kZWwsIHZpZXdTdGF0ZSk7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLmRlYnVnKCdOb3RlYm9va0VkaXRvcldpZGdldCcsICd3YXJtdXAgLSB2aWV3cG9ydCB3YXJtZWQgdXAnKTtcblxuXHRcdC8vIHRvZG9AcmVib3JuaXggQG1qYnZ6LCBpcyB0aGlzIHRvbyBjb21wbGljYXRlZD9cblxuXHRcdC8qIG5vdyB0aGUgd2VidmlldyBpcyByZWFkeSwgYW5kIHJlcXVlc3RzIHRvIHJlbmRlciBtYXJrZG93biBhcmUgZmFzdCBlbm91Z2hcblx0XHQgKiB3ZSBjYW4gc3RhcnQgcmVuZGVyaW5nIHRoZSBsaXN0IHZpZXdcblx0XHQgKiByZW5kZXJcblx0XHQgKiAgIC0gbWFya2Rvd24gY2VsbCAtPiByZXF1ZXN0IHRvIHdlYnZpZXcgdG8gKDEwbXMsIGJhc2ljYWxseSBqdXN0IGxhdGVuY3kgYmV0d2VlbiBVSSBhbmQgaWZyYW1lKVxuXHRcdCAqICAgLSBjb2RlIGNlbGwgLT4gcmVuZGVyIGluIHBsYWNlXG5cdFx0ICovXG5cdFx0dGhpcy5fbGlzdC5sYXlvdXQoMCwgMCk7XG5cdFx0dGhpcy5fbGlzdC5hdHRhY2hWaWV3TW9kZWwodmlld01vZGVsKTtcblxuXHRcdC8vIG5vdyB0aGUgbGlzdCB3aWRnZXQgaGFzIGEgY29ycmVjdCBjb250ZW50SGVpZ2h0L3Njcm9sbEhlaWdodFxuXHRcdC8vIHNldHRpbmcgc2Nyb2xsVG9wIHdpbGwgd29yayBwcm9wZXJseVxuXHRcdC8vIGFmdGVyIHNldHRpbmcgc2Nyb2xsIHRvcCwgdGhlIGxpc3QgdmlldyB3aWxsIHVwZGF0ZSBgdG9wYCBvZiB0aGUgc2Nyb2xsYWJsZSBlbGVtZW50LCBlLmcuIGB0b3A6IC01ODRweGBcblx0XHR0aGlzLl9saXN0LnNjcm9sbFRvcCA9IHZpZXdTdGF0ZT8uc2Nyb2xsUG9zaXRpb24/LnRvcCA/PyAwO1xuXHRcdHRoaXMuX2RlYnVnKCdmaW5pc2ggaW5pdGlhbCB2aWV3cG9ydCB3YXJtdXAgYW5kIHZpZXcgc3RhdGUgcmVzdG9yZS4nKTtcblx0XHR0aGlzLl93ZWJ2aWV3IS5lbGVtZW50LnN0eWxlLnZpc2liaWxpdHkgPSAndmlzaWJsZSc7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLmRlYnVnKCdOb3RlYm9va0VkaXRvcldpZGdldCcsICd3YXJtdXAgLSBsaXN0IHZpZXcgbW9kZWwgYXR0YWNoZWQsIHNldCB0byB2aXNpYmxlJyk7XG5cdFx0dGhpcy5fb25EaWRBdHRhY2hWaWV3TW9kZWwuZmlyZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfd2FybXVwVmlld3BvcnRNYXJrZG93bkNlbGxzKHZpZXdNb2RlbDogTm90ZWJvb2tWaWV3TW9kZWwsIHZpZXdTdGF0ZTogSU5vdGVib29rRWRpdG9yVmlld1N0YXRlIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKHZpZXdTdGF0ZSAmJiB2aWV3U3RhdGUuY2VsbFRvdGFsSGVpZ2h0cykge1xuXHRcdFx0Y29uc3QgdG90YWxIZWlnaHRDYWNoZSA9IHZpZXdTdGF0ZS5jZWxsVG90YWxIZWlnaHRzO1xuXHRcdFx0Y29uc3Qgc2Nyb2xsVG9wID0gdmlld1N0YXRlLnNjcm9sbFBvc2l0aW9uPy50b3AgPz8gMDtcblx0XHRcdGNvbnN0IHNjcm9sbEJvdHRvbSA9IHNjcm9sbFRvcCArIE1hdGgubWF4KHRoaXMuX2RpbWVuc2lvbj8uaGVpZ2h0ID8/IDAsIDEwODApO1xuXG5cdFx0XHRsZXQgb2Zmc2V0ID0gMDtcblx0XHRcdGNvbnN0IHJlcXVlc3RzOiBbSUNlbGxWaWV3TW9kZWwsIG51bWJlcl1bXSA9IFtdO1xuXG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHZpZXdNb2RlbC5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBjZWxsID0gdmlld01vZGVsLmNlbGxBdChpKSE7XG5cdFx0XHRcdGNvbnN0IGNlbGxIZWlnaHQgPSB0b3RhbEhlaWdodENhY2hlW2ldID8/IDA7XG5cblx0XHRcdFx0aWYgKG9mZnNldCArIGNlbGxIZWlnaHQgPCBzY3JvbGxUb3ApIHtcblx0XHRcdFx0XHRvZmZzZXQgKz0gY2VsbEhlaWdodDtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChjZWxsLmNlbGxLaW5kID09PSBDZWxsS2luZC5NYXJrdXApIHtcblx0XHRcdFx0XHRyZXF1ZXN0cy5wdXNoKFtjZWxsLCBvZmZzZXRdKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdG9mZnNldCArPSBjZWxsSGVpZ2h0O1xuXG5cdFx0XHRcdGlmIChvZmZzZXQgPiBzY3JvbGxCb3R0b20pIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRhd2FpdCB0aGlzLl93ZWJ2aWV3IS5pbml0aWFsaXplTWFya3VwKHJlcXVlc3RzLm1hcCgoW21vZGVsLCBvZmZzZXRdKSA9PiB0aGlzLmNyZWF0ZU1hcmt1cENlbGxJbml0aWFsaXphdGlvbihtb2RlbCwgb2Zmc2V0KSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBpbml0UmVxdWVzdHMgPSB2aWV3TW9kZWwudmlld0NlbGxzXG5cdFx0XHRcdC5maWx0ZXIoY2VsbCA9PiBjZWxsLmNlbGxLaW5kID09PSBDZWxsS2luZC5NYXJrdXApXG5cdFx0XHRcdC5zbGljZSgwLCA1KVxuXHRcdFx0XHQubWFwKGNlbGwgPT4gdGhpcy5jcmVhdGVNYXJrdXBDZWxsSW5pdGlhbGl6YXRpb24oY2VsbCwgLTEwMDAwKSk7XG5cblx0XHRcdGF3YWl0IHRoaXMuX3dlYnZpZXchLmluaXRpYWxpemVNYXJrdXAoaW5pdFJlcXVlc3RzKTtcblxuXHRcdFx0Ly8gbm8gY2FjaGVkIHZpZXcgc3RhdGUgc28gd2UgYXJlIHJlbmRlcmluZyB0aGUgZmlyc3Qgdmlld3BvcnRcblx0XHRcdC8vIGFmdGVyIGFib3ZlIGFzeW5jIGNhbGwsIHdlIGFscmVhZHkgZ2V0IGluaXQgaGVpZ2h0IGZvciBtYXJrZG93biBjZWxscywgd2UgY2FuIHVwZGF0ZSB0aGVpciBvZmZzZXRcblx0XHRcdGxldCBvZmZzZXQgPSAwO1xuXHRcdFx0Y29uc3Qgb2Zmc2V0VXBkYXRlUmVxdWVzdHM6IHsgaWQ6IHN0cmluZzsgdG9wOiBudW1iZXIgfVtdID0gW107XG5cdFx0XHRjb25zdCBzY3JvbGxCb3R0b20gPSBNYXRoLm1heCh0aGlzLl9kaW1lbnNpb24/LmhlaWdodCA/PyAwLCAxMDgwKTtcblx0XHRcdGZvciAoY29uc3QgY2VsbCBvZiB2aWV3TW9kZWwudmlld0NlbGxzKSB7XG5cdFx0XHRcdGlmIChjZWxsLmNlbGxLaW5kID09PSBDZWxsS2luZC5NYXJrdXApIHtcblx0XHRcdFx0XHRvZmZzZXRVcGRhdGVSZXF1ZXN0cy5wdXNoKHsgaWQ6IGNlbGwuaWQsIHRvcDogb2Zmc2V0IH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0b2Zmc2V0ICs9IGNlbGwuZ2V0SGVpZ2h0KHRoaXMuZ2V0TGF5b3V0SW5mbygpLmZvbnRJbmZvLmxpbmVIZWlnaHQpO1xuXG5cdFx0XHRcdGlmIChvZmZzZXQgPiBzY3JvbGxCb3R0b20pIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl93ZWJ2aWV3Py51cGRhdGVTY3JvbGxUb3BzKFtdLCBvZmZzZXRVcGRhdGVSZXF1ZXN0cyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVNYXJrdXBDZWxsSW5pdGlhbGl6YXRpb24obW9kZWw6IElDZWxsVmlld01vZGVsLCBvZmZzZXQ6IG51bWJlcik6IElNYXJrdXBDZWxsSW5pdGlhbGl6YXRpb24ge1xuXHRcdHJldHVybiAoe1xuXHRcdFx0bWltZTogbW9kZWwubWltZSxcblx0XHRcdGNlbGxJZDogbW9kZWwuaWQsXG5cdFx0XHRjZWxsSGFuZGxlOiBtb2RlbC5oYW5kbGUsXG5cdFx0XHRjb250ZW50OiBtb2RlbC5nZXRUZXh0KCksXG5cdFx0XHRvZmZzZXQ6IG9mZnNldCxcblx0XHRcdHZpc2libGU6IGZhbHNlLFxuXHRcdFx0bWV0YWRhdGE6IG1vZGVsLm1ldGFkYXRhLFxuXHRcdH0pO1xuXHR9XG5cblx0cmVzdG9yZUxpc3RWaWV3U3RhdGUodmlld1N0YXRlOiBJTm90ZWJvb2tFZGl0b3JWaWV3U3RhdGUgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMudmlld01vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHZpZXdTdGF0ZT8uc2Nyb2xsUG9zaXRpb24gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fbGlzdC5zY3JvbGxUb3AgPSB2aWV3U3RhdGUuc2Nyb2xsUG9zaXRpb24udG9wO1xuXHRcdFx0dGhpcy5fbGlzdC5zY3JvbGxMZWZ0ID0gdmlld1N0YXRlLnNjcm9sbFBvc2l0aW9uLmxlZnQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2xpc3Quc2Nyb2xsVG9wID0gMDtcblx0XHRcdHRoaXMuX2xpc3Quc2Nyb2xsTGVmdCA9IDA7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZm9jdXNJZHggPSB0eXBlb2Ygdmlld1N0YXRlPy5mb2N1cyA9PT0gJ251bWJlcicgPyB2aWV3U3RhdGUuZm9jdXMgOiAwO1xuXHRcdGlmIChmb2N1c0lkeCA8IHRoaXMudmlld01vZGVsLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgZWxlbWVudCA9IHRoaXMudmlld01vZGVsLmNlbGxBdChmb2N1c0lkeCk7XG5cdFx0XHRpZiAoZWxlbWVudCkge1xuXHRcdFx0XHR0aGlzLnZpZXdNb2RlbD8udXBkYXRlU2VsZWN0aW9uc1N0YXRlKHtcblx0XHRcdFx0XHRraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSGFuZGxlLFxuXHRcdFx0XHRcdHByaW1hcnk6IGVsZW1lbnQuaGFuZGxlLFxuXHRcdFx0XHRcdHNlbGVjdGlvbnM6IFtlbGVtZW50LmhhbmRsZV1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9saXN0Lmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMudmlld01vZGVsLnVwZGF0ZVNlbGVjdGlvbnNTdGF0ZSh7XG5cdFx0XHRcdGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCxcblx0XHRcdFx0Zm9jdXM6IHsgc3RhcnQ6IDAsIGVuZDogMSB9LFxuXHRcdFx0XHRzZWxlY3Rpb25zOiBbeyBzdGFydDogMCwgZW5kOiAxIH1dXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRpZiAodmlld1N0YXRlPy5lZGl0b3JGb2N1c2VkKSB7XG5cdFx0XHRjb25zdCBjZWxsID0gdGhpcy52aWV3TW9kZWwuY2VsbEF0KGZvY3VzSWR4KTtcblx0XHRcdGlmIChjZWxsKSB7XG5cdFx0XHRcdGNlbGwuZm9jdXNNb2RlID0gQ2VsbEZvY3VzTW9kZS5FZGl0b3I7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVzdG9yZVNlbGVjdGVkS2VybmVsKHZpZXdTdGF0ZTogSU5vdGVib29rRWRpdG9yVmlld1N0YXRlIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0aWYgKHZpZXdTdGF0ZT8uc2VsZWN0ZWRLZXJuZWxJZCAmJiB0aGlzLnRleHRNb2RlbCkge1xuXHRcdFx0Y29uc3QgbWF0Y2hpbmcgPSB0aGlzLm5vdGVib29rS2VybmVsU2VydmljZS5nZXRNYXRjaGluZ0tlcm5lbCh0aGlzLnRleHRNb2RlbCk7XG5cdFx0XHRjb25zdCBrZXJuZWwgPSBtYXRjaGluZy5hbGwuZmluZChrID0+IGsuaWQgPT09IHZpZXdTdGF0ZS5zZWxlY3RlZEtlcm5lbElkKTtcblx0XHRcdC8vIFNlbGVjdGVkIGtlcm5lbCBtYXkgaGF2ZSBhbHJlYWR5IGJlZW4gcGlja2VkIHByaW9yIHRvIHRoZSB2aWV3IHN0YXRlIGxvYWRpbmdcblx0XHRcdC8vIElmIHNvLCBkb24ndCBvdmVyd3JpdGUgaXQgd2l0aCB0aGUgc2F2ZWQga2VybmVsLlxuXHRcdFx0aWYgKGtlcm5lbCAmJiAhbWF0Y2hpbmcuc2VsZWN0ZWQpIHtcblx0XHRcdFx0dGhpcy5ub3RlYm9va0tlcm5lbFNlcnZpY2Uuc2VsZWN0S2VybmVsRm9yTm90ZWJvb2soa2VybmVsLCB0aGlzLnRleHRNb2RlbCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Z2V0RWRpdG9yVmlld1N0YXRlKCk6IElOb3RlYm9va0VkaXRvclZpZXdTdGF0ZSB7XG5cdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLnZpZXdNb2RlbD8uZ2V0RWRpdG9yVmlld1N0YXRlKCk7XG5cdFx0aWYgKCFzdGF0ZSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZWRpdGluZ0NlbGxzOiB7fSxcblx0XHRcdFx0Y2VsbExpbmVOdW1iZXJTdGF0ZXM6IHt9LFxuXHRcdFx0XHRlZGl0b3JWaWV3U3RhdGVzOiB7fSxcblx0XHRcdFx0Y29sbGFwc2VkSW5wdXRDZWxsczoge30sXG5cdFx0XHRcdGNvbGxhcHNlZE91dHB1dENlbGxzOiB7fSxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2xpc3QpIHtcblx0XHRcdHN0YXRlLnNjcm9sbFBvc2l0aW9uID0geyBsZWZ0OiB0aGlzLl9saXN0LnNjcm9sbExlZnQsIHRvcDogdGhpcy5fbGlzdC5zY3JvbGxUb3AgfTtcblx0XHRcdGNvbnN0IGNlbGxIZWlnaHRzOiB7IFtrZXk6IG51bWJlcl06IG51bWJlciB9ID0ge307XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMudmlld01vZGVsIS5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBlbG0gPSB0aGlzLnZpZXdNb2RlbCEuY2VsbEF0KGkpIGFzIENlbGxWaWV3TW9kZWw7XG5cdFx0XHRcdGNlbGxIZWlnaHRzW2ldID0gZWxtLmxheW91dEluZm8udG90YWxIZWlnaHQ7XG5cdFx0XHR9XG5cblx0XHRcdHN0YXRlLmNlbGxUb3RhbEhlaWdodHMgPSBjZWxsSGVpZ2h0cztcblxuXHRcdFx0aWYgKHRoaXMudmlld01vZGVsKSB7XG5cdFx0XHRcdGNvbnN0IGZvY3VzUmFuZ2UgPSB0aGlzLnZpZXdNb2RlbC5nZXRGb2N1cygpO1xuXHRcdFx0XHRjb25zdCBlbGVtZW50ID0gdGhpcy52aWV3TW9kZWwuY2VsbEF0KGZvY3VzUmFuZ2Uuc3RhcnQpO1xuXHRcdFx0XHRpZiAoZWxlbWVudCkge1xuXHRcdFx0XHRcdGNvbnN0IGl0ZW1ET00gPSB0aGlzLl9saXN0LmRvbUVsZW1lbnRPZkVsZW1lbnQoZWxlbWVudCk7XG5cdFx0XHRcdFx0Y29uc3QgZWRpdG9yRm9jdXNlZCA9IGVsZW1lbnQuZ2V0RWRpdFN0YXRlKCkgPT09IENlbGxFZGl0U3RhdGUuRWRpdGluZyAmJiAhIShpdGVtRE9NICYmIGl0ZW1ET00ub3duZXJEb2N1bWVudC5hY3RpdmVFbGVtZW50ICYmIGl0ZW1ET00uY29udGFpbnMoaXRlbURPTS5vd25lckRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpKTtcblxuXHRcdFx0XHRcdHN0YXRlLmVkaXRvckZvY3VzZWQgPSBlZGl0b3JGb2N1c2VkO1xuXHRcdFx0XHRcdHN0YXRlLmZvY3VzID0gZm9jdXNSYW5nZS5zdGFydDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFNhdmUgY29udHJpYnV0aW9uIHZpZXcgc3RhdGVzXG5cdFx0Y29uc3QgY29udHJpYnV0aW9uc1N0YXRlOiB7IFtrZXk6IHN0cmluZ106IHVua25vd24gfSA9IHt9O1xuXHRcdGZvciAoY29uc3QgW2lkLCBjb250cmlidXRpb25dIG9mIHRoaXMuX2NvbnRyaWJ1dGlvbnMpIHtcblx0XHRcdGlmICh0eXBlb2YgY29udHJpYnV0aW9uLnNhdmVWaWV3U3RhdGUgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0Y29udHJpYnV0aW9uc1N0YXRlW2lkXSA9IGNvbnRyaWJ1dGlvbi5zYXZlVmlld1N0YXRlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHN0YXRlLmNvbnRyaWJ1dGlvbnNTdGF0ZSA9IGNvbnRyaWJ1dGlvbnNTdGF0ZTtcblx0XHRpZiAodGhpcy50ZXh0TW9kZWw/LnVyaS5zY2hlbWUgPT09IFNjaGVtYXMudW50aXRsZWQpIHtcblx0XHRcdHN0YXRlLnNlbGVjdGVkS2VybmVsSWQgPSB0aGlzLmFjdGl2ZUtlcm5lbD8uaWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN0YXRlO1xuXHR9XG5cblx0cHJpdmF0ZSBfYWxsb3dTY3JvbGxCZXlvbmRMYXN0TGluZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fc2Nyb2xsQmV5b25kTGFzdExpbmUgJiYgIXRoaXMuaXNSZXBsSGlzdG9yeTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Qm9keUhlaWdodChkaW1lbnNpb25IZWlnaHQ6IG51bWJlcikge1xuXHRcdHJldHVybiBNYXRoLm1heChkaW1lbnNpb25IZWlnaHQgLSAodGhpcy5fbm90ZWJvb2tUb3BUb29sYmFyPy51c2VHbG9iYWxUb29sYmFyID8gLyoqIFRvb2xiYXIgaGVpZ2h0ICovIDI2IDogMCksIDApO1xuXHR9XG5cblx0bGF5b3V0KGRpbWVuc2lvbjogRE9NLkRpbWVuc2lvbiwgc2hhZG93RWxlbWVudD86IEhUTUxFbGVtZW50LCBwb3NpdGlvbj86IERPTS5JRG9tUG9zaXRpb24pOiB2b2lkIHtcblx0XHRpZiAoIXNoYWRvd0VsZW1lbnQgJiYgdGhpcy5fc2hhZG93RWxlbWVudFZpZXdJbmZvID09PSBudWxsKSB7XG5cdFx0XHR0aGlzLl9kaW1lbnNpb24gPSBkaW1lbnNpb247XG5cdFx0XHR0aGlzLl9wb3NpdGlvbiA9IHBvc2l0aW9uO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChkaW1lbnNpb24ud2lkdGggPD0gMCB8fCBkaW1lbnNpb24uaGVpZ2h0IDw9IDApIHtcblx0XHRcdHRoaXMub25XaWxsSGlkZSgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHdoZW5Db250YWluZXJTdHlsZXNMb2FkZWQgPSB0aGlzLmxheW91dFNlcnZpY2Uud2hlbkNvbnRhaW5lclN0eWxlc0xvYWRlZChET00uZ2V0V2luZG93KHRoaXMuZ2V0RG9tTm9kZSgpKSk7XG5cdFx0aWYgKHdoZW5Db250YWluZXJTdHlsZXNMb2FkZWQpIHtcblx0XHRcdC8vIEluIGZsb2F0aW5nIHdpbmRvd3MsIHdlIG5lZWQgdG8gZW5zdXJlIHRoYXQgdGhlXG5cdFx0XHQvLyBjb250YWluZXIgaXMgcmVhZHkgZm9yIHVzIHRvIGNvbXB1dGUgY2VydGFpblxuXHRcdFx0Ly8gbGF5b3V0IHJlbGF0ZWQgcHJvcGVydGllcy5cblx0XHRcdHdoZW5Db250YWluZXJTdHlsZXNMb2FkZWQudGhlbigoKSA9PiB0aGlzLmxheW91dE5vdGVib29rKGRpbWVuc2lvbiwgc2hhZG93RWxlbWVudCwgcG9zaXRpb24pKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5sYXlvdXROb3RlYm9vayhkaW1lbnNpb24sIHNoYWRvd0VsZW1lbnQsIHBvc2l0aW9uKTtcblx0XHR9XG5cblx0fVxuXG5cdHByaXZhdGUgbGF5b3V0Tm90ZWJvb2soZGltZW5zaW9uOiBET00uRGltZW5zaW9uLCBzaGFkb3dFbGVtZW50PzogSFRNTEVsZW1lbnQsIHBvc2l0aW9uPzogRE9NLklEb21Qb3NpdGlvbikge1xuXHRcdGlmIChzaGFkb3dFbGVtZW50KSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVNoYWRvd0VsZW1lbnQoc2hhZG93RWxlbWVudCwgZGltZW5zaW9uLCBwb3NpdGlvbik7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX3NoYWRvd0VsZW1lbnRWaWV3SW5mbyAmJiB0aGlzLl9zaGFkb3dFbGVtZW50Vmlld0luZm8ud2lkdGggPD0gMCAmJiB0aGlzLl9zaGFkb3dFbGVtZW50Vmlld0luZm8uaGVpZ2h0IDw9IDApIHtcblx0XHRcdHRoaXMub25XaWxsSGlkZSgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2RpbWVuc2lvbiA9IGRpbWVuc2lvbjtcblx0XHR0aGlzLl9wb3NpdGlvbiA9IHBvc2l0aW9uO1xuXHRcdGNvbnN0IG5ld0JvZHlIZWlnaHQgPSB0aGlzLmdldEJvZHlIZWlnaHQoZGltZW5zaW9uLmhlaWdodCkgLSB0aGlzLmdldExheW91dEluZm8oKS5zdGlja3lIZWlnaHQ7XG5cdFx0RE9NLnNpemUodGhpcy5fYm9keSwgZGltZW5zaW9uLndpZHRoLCBuZXdCb2R5SGVpZ2h0KTtcblxuXHRcdGNvbnN0IG5ld0NlbGxMaXN0SGVpZ2h0ID0gbmV3Qm9keUhlaWdodDtcblx0XHRpZiAodGhpcy5fbGlzdC5nZXRSZW5kZXJIZWlnaHQoKSA8IG5ld0NlbGxMaXN0SGVpZ2h0KSB7XG5cdFx0XHQvLyB0aGUgbmV3IGRpbWVuc2lvbiBpcyBsYXJnZXIgdGhhbiB0aGUgbGlzdCB2aWV3cG9ydCwgdXBkYXRlIGl0cyBhZGRpdGlvbmFsIGhlaWdodCBmaXJzdCwgb3RoZXJ3aXNlIHRoZSBsaXN0IHZpZXcgd2lsbCBtb3ZlIGRvd24gYSBiaXQgKGFzIHRoZSBgc2Nyb2xsQm90dG9tYCB3aWxsIG1vdmUgZG93bilcblx0XHRcdHRoaXMuX2xpc3QudXBkYXRlT3B0aW9ucyh7IHBhZGRpbmdCb3R0b206IHRoaXMuX2FsbG93U2Nyb2xsQmV5b25kTGFzdExpbmUoKSA/IE1hdGgubWF4KDAsIChuZXdDZWxsTGlzdEhlaWdodCAtIDUwKSkgOiAwLCBwYWRkaW5nVG9wOiAwIH0pO1xuXHRcdFx0dGhpcy5fbGlzdC5sYXlvdXQobmV3Q2VsbExpc3RIZWlnaHQsIGRpbWVuc2lvbi53aWR0aCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIHRoZSBuZXcgZGltZW5zaW9uIGlzIHNtYWxsZXIgdGhhbiB0aGUgbGlzdCB2aWV3cG9ydCwgaWYgd2UgdXBkYXRlIHRoZSBhZGRpdGlvbmFsIGhlaWdodCwgdGhlIGBzY3JvbGxCb3R0b21gIHdpbGwgbW92ZSB1cCwgd2hpY2ggbW92ZXMgdGhlIHdob2xlIGxpc3QgdmlldyB1cHdhcmRzIGEgYml0LiBTbyB3ZSBydW4gYSBsYXlvdXQgZmlyc3QuXG5cdFx0XHR0aGlzLl9saXN0LmxheW91dChuZXdDZWxsTGlzdEhlaWdodCwgZGltZW5zaW9uLndpZHRoKTtcblx0XHRcdHRoaXMuX2xpc3QudXBkYXRlT3B0aW9ucyh7IHBhZGRpbmdCb3R0b206IHRoaXMuX2FsbG93U2Nyb2xsQmV5b25kTGFzdExpbmUoKSA/IE1hdGgubWF4KDAsIChuZXdDZWxsTGlzdEhlaWdodCAtIDUwKSkgOiAwLCBwYWRkaW5nVG9wOiAwIH0pO1xuXHRcdH1cblxuXHRcdHRoaXMuX292ZXJsYXlDb250YWluZXIuaW5lcnQgPSBmYWxzZTtcblx0XHR0aGlzLl9vdmVybGF5Q29udGFpbmVyLnN0eWxlLnZpc2liaWxpdHkgPSAndmlzaWJsZSc7XG5cdFx0dGhpcy5fb3ZlcmxheUNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcblx0XHR0aGlzLl9vdmVybGF5Q29udGFpbmVyLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHR0aGlzLl9vdmVybGF5Q29udGFpbmVyLnN0eWxlLm92ZXJmbG93ID0gJ2hpZGRlbic7XG5cblx0XHR0aGlzLmxheW91dENvbnRhaW5lck92ZXJTaGFkb3dFbGVtZW50KGRpbWVuc2lvbiwgcG9zaXRpb24pO1xuXG5cdFx0aWYgKHRoaXMuX3dlYnZpZXdUcmFuc3BhcmVudENvdmVyKSB7XG5cdFx0XHR0aGlzLl93ZWJ2aWV3VHJhbnNwYXJlbnRDb3Zlci5zdHlsZS5oZWlnaHQgPSBgJHtkaW1lbnNpb24uaGVpZ2h0fXB4YDtcblx0XHRcdHRoaXMuX3dlYnZpZXdUcmFuc3BhcmVudENvdmVyLnN0eWxlLndpZHRoID0gYCR7ZGltZW5zaW9uLndpZHRofXB4YDtcblx0XHR9XG5cblx0XHR0aGlzLl9ub3RlYm9va1RvcFRvb2xiYXIubGF5b3V0KHRoaXMuX2RpbWVuc2lvbik7XG5cdFx0dGhpcy5fbm90ZWJvb2tPdmVydmlld1J1bGVyLmxheW91dCgpO1xuXG5cdFx0dGhpcy5fdmlld0NvbnRleHQ/LmV2ZW50RGlzcGF0Y2hlci5lbWl0KFtuZXcgTm90ZWJvb2tMYXlvdXRDaGFuZ2VkRXZlbnQoeyB3aWR0aDogdHJ1ZSwgZm9udEluZm86IHRydWUgfSwgdGhpcy5nZXRMYXlvdXRJbmZvKCkpXSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVNoYWRvd0VsZW1lbnQoc2hhZG93RWxlbWVudDogSFRNTEVsZW1lbnQsIGRpbWVuc2lvbj86IElEaW1lbnNpb24sIHBvc2l0aW9uPzogRE9NLklEb21Qb3NpdGlvbikge1xuXHRcdHRoaXMuX3NoYWRvd0VsZW1lbnQgPSBzaGFkb3dFbGVtZW50O1xuXHRcdGlmIChkaW1lbnNpb24gJiYgcG9zaXRpb24pIHtcblx0XHRcdHRoaXMuX3NoYWRvd0VsZW1lbnRWaWV3SW5mbyA9IHtcblx0XHRcdFx0aGVpZ2h0OiBkaW1lbnNpb24uaGVpZ2h0LFxuXHRcdFx0XHR3aWR0aDogZGltZW5zaW9uLndpZHRoLFxuXHRcdFx0XHR0b3A6IHBvc2l0aW9uLnRvcCxcblx0XHRcdFx0bGVmdDogcG9zaXRpb24ubGVmdCxcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIFdlIGhhdmUgdG8gcmVjb21wdXRlIHBvc2l0aW9uIGFuZCBzaXplIG91cnNlbHZlcyAod2hpY2ggaXMgc2xvdylcblx0XHRcdGNvbnN0IGNvbnRhaW5lclJlY3QgPSBzaGFkb3dFbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0dGhpcy5fc2hhZG93RWxlbWVudFZpZXdJbmZvID0ge1xuXHRcdFx0XHRoZWlnaHQ6IGNvbnRhaW5lclJlY3QuaGVpZ2h0LFxuXHRcdFx0XHR3aWR0aDogY29udGFpbmVyUmVjdC53aWR0aCxcblx0XHRcdFx0dG9wOiBjb250YWluZXJSZWN0LnRvcCxcblx0XHRcdFx0bGVmdDogY29udGFpbmVyUmVjdC5sZWZ0XG5cdFx0XHR9O1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgbGF5b3V0Q29udGFpbmVyT3ZlclNoYWRvd0VsZW1lbnQoZGltZW5zaW9uPzogRE9NLkRpbWVuc2lvbiwgcG9zaXRpb24/OiBET00uSURvbVBvc2l0aW9uKTogdm9pZCB7XG5cdFx0aWYgKGRpbWVuc2lvbiAmJiBwb3NpdGlvbikge1xuXHRcdFx0dGhpcy5fb3ZlcmxheUNvbnRhaW5lci5zdHlsZS50b3AgPSBgJHtwb3NpdGlvbi50b3B9cHhgO1xuXHRcdFx0dGhpcy5fb3ZlcmxheUNvbnRhaW5lci5zdHlsZS5sZWZ0ID0gYCR7cG9zaXRpb24ubGVmdH1weGA7XG5cdFx0XHR0aGlzLl9vdmVybGF5Q29udGFpbmVyLnN0eWxlLndpZHRoID0gYCR7ZGltZW5zaW9uLndpZHRofXB4YDtcblx0XHRcdHRoaXMuX292ZXJsYXlDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7ZGltZW5zaW9uLmhlaWdodH1weGA7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl9zaGFkb3dFbGVtZW50Vmlld0luZm8pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlbGVtZW50Q29udGFpbmVyUmVjdCA9IHRoaXMuX292ZXJsYXlDb250YWluZXIucGFyZW50RWxlbWVudD8uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0dGhpcy5fb3ZlcmxheUNvbnRhaW5lci5zdHlsZS50b3AgPSBgJHt0aGlzLl9zaGFkb3dFbGVtZW50Vmlld0luZm8udG9wIC0gKGVsZW1lbnRDb250YWluZXJSZWN0Py50b3AgfHwgMCl9cHhgO1xuXHRcdHRoaXMuX292ZXJsYXlDb250YWluZXIuc3R5bGUubGVmdCA9IGAke3RoaXMuX3NoYWRvd0VsZW1lbnRWaWV3SW5mby5sZWZ0IC0gKGVsZW1lbnRDb250YWluZXJSZWN0Py5sZWZ0IHx8IDApfXB4YDtcblx0XHR0aGlzLl9vdmVybGF5Q29udGFpbmVyLnN0eWxlLndpZHRoID0gYCR7ZGltZW5zaW9uID8gZGltZW5zaW9uLndpZHRoIDogdGhpcy5fc2hhZG93RWxlbWVudFZpZXdJbmZvLndpZHRofXB4YDtcblx0XHR0aGlzLl9vdmVybGF5Q29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGAke2RpbWVuc2lvbiA/IGRpbWVuc2lvbi5oZWlnaHQgOiB0aGlzLl9zaGFkb3dFbGVtZW50Vmlld0luZm8uaGVpZ2h0fXB4YDtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBGb2N1cyB0cmFja2VyXG5cdGZvY3VzKCkge1xuXHRcdHRoaXMuX2lzVmlzaWJsZSA9IHRydWU7XG5cdFx0dGhpcy5fZWRpdG9yRm9jdXMuc2V0KHRydWUpO1xuXG5cdFx0aWYgKHRoaXMuX3dlYnZpZXdGb2N1c2VkKSB7XG5cdFx0XHR0aGlzLl93ZWJ2aWV3Py5mb2N1c1dlYnZpZXcoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKHRoaXMudmlld01vZGVsKSB7XG5cdFx0XHRcdGNvbnN0IGZvY3VzUmFuZ2UgPSB0aGlzLnZpZXdNb2RlbC5nZXRGb2N1cygpO1xuXHRcdFx0XHRjb25zdCBlbGVtZW50ID0gdGhpcy52aWV3TW9kZWwuY2VsbEF0KGZvY3VzUmFuZ2Uuc3RhcnQpO1xuXG5cdFx0XHRcdC8vIFRoZSBub3RlYm9vayBlZGl0b3IgZG9lc24ndCBoYXZlIGZvY3VzIHlldFxuXHRcdFx0XHRpZiAoIXRoaXMuaGFzRWRpdG9yRm9jdXMoKSkge1xuXHRcdFx0XHRcdHRoaXMuZm9jdXNDb250YWluZXIoKTtcblx0XHRcdFx0XHQvLyB0cmlnZ2VyIGVkaXRvciB0byB1cGRhdGUgYXMgRm9jdXNUcmFja2VyIG1pZ2h0IG5vdCBlbWl0IGZvY3VzIGNoYW5nZSBldmVudFxuXHRcdFx0XHRcdHRoaXMudXBkYXRlRWRpdG9yRm9jdXMoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChlbGVtZW50ICYmIGVsZW1lbnQuZm9jdXNNb2RlID09PSBDZWxsRm9jdXNNb2RlLkVkaXRvcikge1xuXHRcdFx0XHRcdGVsZW1lbnQudXBkYXRlRWRpdFN0YXRlKENlbGxFZGl0U3RhdGUuRWRpdGluZywgJ2VkaXRvcldpZGdldC5mb2N1cycpO1xuXHRcdFx0XHRcdGVsZW1lbnQuZm9jdXNNb2RlID0gQ2VsbEZvY3VzTW9kZS5FZGl0b3I7XG5cdFx0XHRcdFx0dGhpcy5mb2N1c0VkaXRvcihlbGVtZW50KTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fbGlzdC5kb21Gb2N1cygpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9jdXJyZW50UHJvZ3Jlc3MpIHtcblx0XHRcdC8vIFRoZSBlZGl0b3IgZm9yY2VzIHByb2dyZXNzIHRvIGhpZGUgd2hlbiBzd2l0Y2hpbmcgZWRpdG9ycy4gU28gaWYgcHJvZ3Jlc3Mgc2hvdWxkIGJlIHZpc2libGUsIGZvcmNlIGl0IHRvIHNob3cgd2hlbiB0aGUgZWRpdG9yIGlzIGZvY3VzZWQuXG5cdFx0XHR0aGlzLnNob3dQcm9ncmVzcygpO1xuXHRcdH1cblx0fVxuXG5cdG9uU2hvdygpIHtcblx0XHR0aGlzLl9pc1Zpc2libGUgPSB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBmb2N1c0VkaXRvcihhY3RpdmVFbGVtZW50OiBDZWxsVmlld01vZGVsKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBbZWxlbWVudCwgZWRpdG9yXSBvZiB0aGlzLl9yZW5kZXJlZEVkaXRvcnMuZW50cmllcygpKSB7XG5cdFx0XHRpZiAoZWxlbWVudCA9PT0gYWN0aXZlRWxlbWVudCkge1xuXHRcdFx0XHRlZGl0b3IuZm9jdXMoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGZvY3VzQ29udGFpbmVyKGNsZWFyU2VsZWN0aW9uOiBib29sZWFuID0gZmFsc2UpIHtcblx0XHRpZiAodGhpcy5fd2Vidmlld0ZvY3VzZWQpIHtcblx0XHRcdHRoaXMuX3dlYnZpZXc/LmZvY3VzV2VidmlldygpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9saXN0LmZvY3VzQ29udGFpbmVyKGNsZWFyU2VsZWN0aW9uKTtcblx0XHR9XG5cdH1cblxuXHRzZWxlY3RPdXRwdXRDb250ZW50KGNlbGw6IElDZWxsVmlld01vZGVsKSB7XG5cdFx0dGhpcy5fd2Vidmlldz8uc2VsZWN0T3V0cHV0Q29udGVudHMoY2VsbCk7XG5cdH1cblxuXHRzZWxlY3RJbnB1dENvbnRlbnRzKGNlbGw6IElDZWxsVmlld01vZGVsKSB7XG5cdFx0dGhpcy5fd2Vidmlldz8uc2VsZWN0SW5wdXRDb250ZW50cyhjZWxsKTtcblx0fVxuXG5cdG9uV2lsbEhpZGUoKSB7XG5cdFx0dGhpcy5faXNWaXNpYmxlID0gZmFsc2U7XG5cdFx0dGhpcy5fZWRpdG9yRm9jdXMuc2V0KGZhbHNlKTtcblx0XHR0aGlzLl9vdmVybGF5Q29udGFpbmVyLmluZXJ0ID0gdHJ1ZTtcblx0XHR0aGlzLl9vdmVybGF5Q29udGFpbmVyLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcblx0XHR0aGlzLl9vdmVybGF5Q29udGFpbmVyLnN0eWxlLmxlZnQgPSAnLTUwMDAwcHgnO1xuXHRcdHRoaXMuX25vdGVib29rVG9wVG9vbGJhckNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdHRoaXMuY2xlYXJBY3RpdmVDZWxsV2lkZ2V0cygpO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhckFjdGl2ZUNlbGxXaWRnZXRzKCkge1xuXHRcdHRoaXMuX3JlbmRlcmVkRWRpdG9ycy5mb3JFYWNoKChlZGl0b3IsIGNlbGwpID0+IHtcblx0XHRcdGlmICh0aGlzLmdldEFjdGl2ZUNlbGwoKSA9PT0gY2VsbCAmJiBlZGl0b3IpIHtcblx0XHRcdFx0U3VnZ2VzdENvbnRyb2xsZXIuZ2V0KGVkaXRvcik/LmNhbmNlbFN1Z2dlc3RXaWRnZXQoKTtcblx0XHRcdFx0RHJvcEludG9FZGl0b3JDb250cm9sbGVyLmdldChlZGl0b3IpPy5jbGVhcldpZGdldHMoKTtcblx0XHRcdFx0Q29weVBhc3RlQ29udHJvbGxlci5nZXQoZWRpdG9yKT8uY2xlYXJXaWRnZXRzKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9yZW5kZXJlZEVkaXRvcnMuZm9yRWFjaCgoZWRpdG9yLCBjZWxsKSA9PiB7XG5cdFx0XHRjb25zdCBjb250cm9sbGVyID0gSW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXHRcdFx0aWYgKGNvbnRyb2xsZXI/Lm1vZGVsLmdldCgpPy5pbmxpbmVFZGl0U3RhdGUuZ2V0KCkpIHtcblx0XHRcdFx0ZWRpdG9yLnJlbmRlcih0cnVlKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgZWRpdG9ySGFzRG9tRm9jdXMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIERPTS5pc0FuY2VzdG9yT2ZBY3RpdmVFbGVtZW50KHRoaXMuZ2V0RG9tTm9kZSgpKTtcblx0fVxuXG5cdHVwZGF0ZUVkaXRvckZvY3VzKCkge1xuXHRcdC8vIE5vdGUgLSBmb2N1cyBnb2luZyB0byB0aGUgd2VidmlldyB3aWxsIGZpcmUgJ2JsdXInLCBidXQgdGhlIHdlYnZpZXcgZWxlbWVudCB3aWxsIGJlXG5cdFx0Ly8gYSBkZXNjZW5kZW50IG9mIHRoZSBub3RlYm9vayBlZGl0b3Igcm9vdC5cblx0XHR0aGlzLl9mb2N1c1RyYWNrZXIucmVmcmVzaFN0YXRlKCk7XG5cdFx0Y29uc3QgZm9jdXNlZCA9IHRoaXMuZWRpdG9ySGFzRG9tRm9jdXMoKTtcblx0XHR0aGlzLl9lZGl0b3JGb2N1cy5zZXQoZm9jdXNlZCk7XG5cdFx0dGhpcy52aWV3TW9kZWw/LnNldEVkaXRvckZvY3VzKGZvY3VzZWQpO1xuXHR9XG5cblx0dXBkYXRlQ2VsbEZvY3VzTW9kZSgpIHtcblx0XHRjb25zdCBhY3RpdmVDZWxsID0gdGhpcy5nZXRBY3RpdmVDZWxsKCk7XG5cblx0XHRpZiAoYWN0aXZlQ2VsbD8uZm9jdXNNb2RlID09PSBDZWxsRm9jdXNNb2RlLk91dHB1dCAmJiAhdGhpcy5fd2Vidmlld0ZvY3VzZWQpIHtcblx0XHRcdC8vIG91dHB1dCBwcmV2aW91c2x5IGhhcyBmb2N1cywgYnV0IG5vdyBpdCdzIGJsdXJyZWQuXG5cdFx0XHRhY3RpdmVDZWxsLmZvY3VzTW9kZSA9IENlbGxGb2N1c01vZGUuQ29udGFpbmVyO1xuXHRcdH1cblx0fVxuXG5cdGhhc0VkaXRvckZvY3VzKCkge1xuXHRcdC8vIF9lZGl0b3JGb2N1cyBpcyBkcml2ZW4gYnkgdGhlIEZvY3VzVHJhY2tlciwgd2hpY2ggaXMgb25seSBndWFyYW50ZWVkIHRvIF9ldmVudHVhbGx5XyBmaXJlIGJsdXIuXG5cdFx0Ly8gSWYgd2UgbmVlZCB0byBrbm93IHdoZXRoZXIgd2UgaGF2ZSBmb2N1cyBhdCB0aGlzIGluc3RhbnQsIHdlIG5lZWQgdG8gY2hlY2sgdGhlIERPTSBtYW51YWxseS5cblx0XHR0aGlzLnVwZGF0ZUVkaXRvckZvY3VzKCk7XG5cdFx0cmV0dXJuIHRoaXMuZWRpdG9ySGFzRG9tRm9jdXMoKTtcblx0fVxuXG5cdGhhc1dlYnZpZXdGb2N1cygpIHtcblx0XHRyZXR1cm4gdGhpcy5fd2Vidmlld0ZvY3VzZWQ7XG5cdH1cblxuXHRoYXNPdXRwdXRUZXh0U2VsZWN0aW9uKCkge1xuXHRcdGlmICghdGhpcy5oYXNFZGl0b3JGb2N1cygpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgd2luZG93U2VsZWN0aW9uID0gRE9NLmdldFdpbmRvdyh0aGlzLmdldERvbU5vZGUoKSkuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0aWYgKHdpbmRvd1NlbGVjdGlvbj8ucmFuZ2VDb3VudCAhPT0gMSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGl2ZVNlbGVjdGlvbiA9IHdpbmRvd1NlbGVjdGlvbi5nZXRSYW5nZUF0KDApO1xuXHRcdGlmIChhY3RpdmVTZWxlY3Rpb24uc3RhcnRDb250YWluZXIgPT09IGFjdGl2ZVNlbGVjdGlvbi5lbmRDb250YWluZXIgJiYgYWN0aXZlU2VsZWN0aW9uLmVuZE9mZnNldCAtIGFjdGl2ZVNlbGVjdGlvbi5zdGFydE9mZnNldCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGxldCBjb250YWluZXI6IGFueSA9IGFjdGl2ZVNlbGVjdGlvbi5jb21tb25BbmNlc3RvckNvbnRhaW5lcjtcblxuXHRcdGlmICghdGhpcy5fYm9keS5jb250YWlucyhjb250YWluZXIpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0d2hpbGUgKGNvbnRhaW5lclxuXHRcdFx0JiZcblx0XHRcdGNvbnRhaW5lciAhPT0gdGhpcy5fYm9keSkge1xuXHRcdFx0aWYgKChjb250YWluZXIgYXMgSFRNTEVsZW1lbnQpLmNsYXNzTGlzdCAmJiAoY29udGFpbmVyIGFzIEhUTUxFbGVtZW50KS5jbGFzc0xpc3QuY29udGFpbnMoJ291dHB1dCcpKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb250YWluZXIgPSBjb250YWluZXIucGFyZW50Tm9kZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRfZGlkRm9jdXNPdXRwdXRJbnB1dENoYW5nZShoYXNGb2N1czogYm9vbGVhbikge1xuXHRcdHRoaXMuX291dHB1dElucHV0Rm9jdXMuc2V0KGhhc0ZvY3VzKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBFZGl0b3IgRmVhdHVyZXNcblxuXHRmb2N1c0VsZW1lbnQoY2VsbDogSUNlbGxWaWV3TW9kZWwpIHtcblx0XHR0aGlzLnZpZXdNb2RlbD8udXBkYXRlU2VsZWN0aW9uc1N0YXRlKHtcblx0XHRcdGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5IYW5kbGUsXG5cdFx0XHRwcmltYXJ5OiBjZWxsLmhhbmRsZSxcblx0XHRcdHNlbGVjdGlvbnM6IFtjZWxsLmhhbmRsZV1cblx0XHR9KTtcblx0fVxuXG5cdGdldCBzY3JvbGxUb3AoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2xpc3Quc2Nyb2xsVG9wO1xuXHR9XG5cblx0Z2V0IHNjcm9sbEJvdHRvbSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbGlzdC5zY3JvbGxUb3AgKyB0aGlzLl9saXN0LmdldFJlbmRlckhlaWdodCgpO1xuXHR9XG5cblx0Z2V0QWJzb2x1dGVUb3BPZkVsZW1lbnQoY2VsbDogSUNlbGxWaWV3TW9kZWwpIHtcblx0XHRyZXR1cm4gdGhpcy5fbGlzdC5nZXRDZWxsVmlld1Njcm9sbFRvcChjZWxsKTtcblx0fVxuXG5cdGdldEhlaWdodE9mRWxlbWVudChjZWxsOiBJQ2VsbFZpZXdNb2RlbCkge1xuXHRcdHJldHVybiB0aGlzLl9saXN0LmVsZW1lbnRIZWlnaHQoY2VsbCk7XG5cdH1cblxuXHRzY3JvbGxUb0JvdHRvbSgpIHtcblx0XHR0aGlzLl9saXN0LnNjcm9sbFRvQm90dG9tKCk7XG5cdH1cblxuXHRzZXRTY3JvbGxUb3Aoc2Nyb2xsVG9wOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9saXN0LnNjcm9sbFRvcCA9IHNjcm9sbFRvcDtcblx0fVxuXG5cdHJldmVhbENlbGxSYW5nZUluVmlldyhyYW5nZTogSUNlbGxSYW5nZSkge1xuXHRcdHJldHVybiB0aGlzLl9saXN0LnJldmVhbENlbGxzKHJhbmdlKTtcblx0fVxuXG5cdHJldmVhbEluVmlldyhjZWxsOiBJQ2VsbFZpZXdNb2RlbCkge1xuXHRcdHJldHVybiB0aGlzLl9saXN0LnJldmVhbENlbGwoY2VsbCwgQ2VsbFJldmVhbFR5cGUuRGVmYXVsdCk7XG5cdH1cblxuXHRyZXZlYWxJblZpZXdBdFRvcChjZWxsOiBJQ2VsbFZpZXdNb2RlbCkge1xuXHRcdHRoaXMuX2xpc3QucmV2ZWFsQ2VsbChjZWxsLCBDZWxsUmV2ZWFsVHlwZS5Ub3ApO1xuXHR9XG5cblx0cmV2ZWFsSW5DZW50ZXIoY2VsbDogSUNlbGxWaWV3TW9kZWwpIHtcblx0XHR0aGlzLl9saXN0LnJldmVhbENlbGwoY2VsbCwgQ2VsbFJldmVhbFR5cGUuQ2VudGVyKTtcblx0fVxuXG5cdGFzeW5jIHJldmVhbEluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQoY2VsbDogSUNlbGxWaWV3TW9kZWwpIHtcblx0XHRhd2FpdCB0aGlzLl9saXN0LnJldmVhbENlbGwoY2VsbCwgQ2VsbFJldmVhbFR5cGUuQ2VudGVySWZPdXRzaWRlVmlld3BvcnQpO1xuXHR9XG5cblx0YXN5bmMgcmV2ZWFsRmlyc3RMaW5lSWZPdXRzaWRlVmlld3BvcnQoY2VsbDogSUNlbGxWaWV3TW9kZWwpIHtcblx0XHRhd2FpdCB0aGlzLl9saXN0LnJldmVhbENlbGwoY2VsbCwgQ2VsbFJldmVhbFR5cGUuRmlyc3RMaW5lSWZPdXRzaWRlVmlld3BvcnQpO1xuXHR9XG5cblx0YXN5bmMgcmV2ZWFsTGluZUluVmlld0FzeW5jKGNlbGw6IElDZWxsVmlld01vZGVsLCBsaW5lOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fbGlzdC5yZXZlYWxSYW5nZUluQ2VsbChjZWxsLCBuZXcgUmFuZ2UobGluZSwgMSwgbGluZSwgMSksIENlbGxSZXZlYWxSYW5nZVR5cGUuRGVmYXVsdCk7XG5cdH1cblxuXHRhc3luYyByZXZlYWxMaW5lSW5DZW50ZXJBc3luYyhjZWxsOiBJQ2VsbFZpZXdNb2RlbCwgbGluZTogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2xpc3QucmV2ZWFsUmFuZ2VJbkNlbGwoY2VsbCwgbmV3IFJhbmdlKGxpbmUsIDEsIGxpbmUsIDEpLCBDZWxsUmV2ZWFsUmFuZ2VUeXBlLkNlbnRlcik7XG5cdH1cblxuXHRhc3luYyByZXZlYWxMaW5lSW5DZW50ZXJJZk91dHNpZGVWaWV3cG9ydEFzeW5jKGNlbGw6IElDZWxsVmlld01vZGVsLCBsaW5lOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fbGlzdC5yZXZlYWxSYW5nZUluQ2VsbChjZWxsLCBuZXcgUmFuZ2UobGluZSwgMSwgbGluZSwgMSksIENlbGxSZXZlYWxSYW5nZVR5cGUuQ2VudGVySWZPdXRzaWRlVmlld3BvcnQpO1xuXHR9XG5cblx0YXN5bmMgcmV2ZWFsUmFuZ2VJblZpZXdBc3luYyhjZWxsOiBJQ2VsbFZpZXdNb2RlbCwgcmFuZ2U6IFNlbGVjdGlvbiB8IFJhbmdlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2xpc3QucmV2ZWFsUmFuZ2VJbkNlbGwoY2VsbCwgcmFuZ2UsIENlbGxSZXZlYWxSYW5nZVR5cGUuRGVmYXVsdCk7XG5cdH1cblxuXHRhc3luYyByZXZlYWxSYW5nZUluQ2VudGVyQXN5bmMoY2VsbDogSUNlbGxWaWV3TW9kZWwsIHJhbmdlOiBTZWxlY3Rpb24gfCBSYW5nZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl9saXN0LnJldmVhbFJhbmdlSW5DZWxsKGNlbGwsIHJhbmdlLCBDZWxsUmV2ZWFsUmFuZ2VUeXBlLkNlbnRlcik7XG5cdH1cblxuXHRhc3luYyByZXZlYWxSYW5nZUluQ2VudGVySWZPdXRzaWRlVmlld3BvcnRBc3luYyhjZWxsOiBJQ2VsbFZpZXdNb2RlbCwgcmFuZ2U6IFNlbGVjdGlvbiB8IFJhbmdlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2xpc3QucmV2ZWFsUmFuZ2VJbkNlbGwoY2VsbCwgcmFuZ2UsIENlbGxSZXZlYWxSYW5nZVR5cGUuQ2VudGVySWZPdXRzaWRlVmlld3BvcnQpO1xuXHR9XG5cblx0cmV2ZWFsQ2VsbE9mZnNldEluQ2VudGVyKGNlbGw6IElDZWxsVmlld01vZGVsLCBvZmZzZXQ6IG51bWJlcikge1xuXHRcdHJldHVybiB0aGlzLl9saXN0LnJldmVhbENlbGxPZmZzZXRJbkNlbnRlcihjZWxsLCBvZmZzZXQpO1xuXHR9XG5cblx0cmV2ZWFsT2Zmc2V0SW5DZW50ZXJJZk91dHNpZGVWaWV3cG9ydChvZmZzZXQ6IG51bWJlcikge1xuXHRcdHJldHVybiB0aGlzLl9saXN0LnJldmVhbE9mZnNldEluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQob2Zmc2V0KTtcblx0fVxuXG5cdGdldFZpZXdJbmRleEJ5TW9kZWxJbmRleChpbmRleDogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRpZiAoIXRoaXMuX2xpc3RWaWV3SW5mb0FjY2Vzc29yKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXHRcdGNvbnN0IGNlbGwgPSB0aGlzLnZpZXdNb2RlbD8udmlld0NlbGxzW2luZGV4XTtcblx0XHRpZiAoIWNlbGwpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fbGlzdFZpZXdJbmZvQWNjZXNzb3IuZ2V0Vmlld0luZGV4KGNlbGwpO1xuXHR9XG5cblx0Z2V0Vmlld0hlaWdodChjZWxsOiBJQ2VsbFZpZXdNb2RlbCk6IG51bWJlciB7XG5cdFx0aWYgKCF0aGlzLl9saXN0Vmlld0luZm9BY2Nlc3Nvcikge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9saXN0Vmlld0luZm9BY2Nlc3Nvci5nZXRWaWV3SGVpZ2h0KGNlbGwpO1xuXHR9XG5cblx0Z2V0Q2VsbFJhbmdlRnJvbVZpZXdSYW5nZShzdGFydEluZGV4OiBudW1iZXIsIGVuZEluZGV4OiBudW1iZXIpOiBJQ2VsbFJhbmdlIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fbGlzdFZpZXdJbmZvQWNjZXNzb3IuZ2V0Q2VsbFJhbmdlRnJvbVZpZXdSYW5nZShzdGFydEluZGV4LCBlbmRJbmRleCk7XG5cdH1cblxuXHRnZXRDZWxsc0luUmFuZ2UocmFuZ2U/OiBJQ2VsbFJhbmdlKTogUmVhZG9ubHlBcnJheTxJQ2VsbFZpZXdNb2RlbD4ge1xuXHRcdHJldHVybiB0aGlzLl9saXN0Vmlld0luZm9BY2Nlc3Nvci5nZXRDZWxsc0luUmFuZ2UocmFuZ2UpO1xuXHR9XG5cblx0c2V0Q2VsbEVkaXRvclNlbGVjdGlvbihjZWxsOiBJQ2VsbFZpZXdNb2RlbCwgcmFuZ2U6IFJhbmdlKTogdm9pZCB7XG5cdFx0dGhpcy5fbGlzdC5zZXRDZWxsRWRpdG9yU2VsZWN0aW9uKGNlbGwsIHJhbmdlKTtcblx0fVxuXG5cdHNldEhpZGRlbkFyZWFzKF9yYW5nZXM6IElDZWxsUmFuZ2VbXSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9saXN0LnNldEhpZGRlbkFyZWFzKF9yYW5nZXMsIHRydWUpO1xuXHR9XG5cblx0Z2V0VmlzaWJsZVJhbmdlc1BsdXNWaWV3cG9ydEFib3ZlQW5kQmVsb3coKTogSUNlbGxSYW5nZVtdIHtcblx0XHRyZXR1cm4gdGhpcy5fbGlzdFZpZXdJbmZvQWNjZXNzb3IuZ2V0VmlzaWJsZVJhbmdlc1BsdXNWaWV3cG9ydEFib3ZlQW5kQmVsb3coKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBEZWNvcmF0aW9uc1xuXG5cdGRlbHRhQ2VsbERlY29yYXRpb25zKG9sZERlY29yYXRpb25zOiBzdHJpbmdbXSwgbmV3RGVjb3JhdGlvbnM6IElOb3RlYm9va0RlbHRhRGVjb3JhdGlvbltdKTogc3RyaW5nW10ge1xuXHRcdGNvbnN0IHJldCA9IHRoaXMudmlld01vZGVsPy5kZWx0YUNlbGxEZWNvcmF0aW9ucyhvbGREZWNvcmF0aW9ucywgbmV3RGVjb3JhdGlvbnMpIHx8IFtdO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlRGVjb3JhdGlvbnMuZmlyZSgpO1xuXHRcdHJldHVybiByZXQ7XG5cdH1cblxuXHRkZWx0YUNlbGxDb250YWluZXJDbGFzc05hbWVzKGNlbGxJZDogc3RyaW5nLCBhZGRlZDogc3RyaW5nW10sIHJlbW92ZWQ6IHN0cmluZ1tdLCBjZWxsa2luZDogQ2VsbEtpbmQpOiB2b2lkIHtcblx0XHRpZiAoY2VsbGtpbmQgPT09IENlbGxLaW5kLk1hcmt1cCkge1xuXHRcdFx0dGhpcy5fd2Vidmlldz8uZGVsdGFNYXJrdXBQcmV2aWV3Q2xhc3NOYW1lcyhjZWxsSWQsIGFkZGVkLCByZW1vdmVkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fd2Vidmlldz8uZGVsdGFDZWxsT3V0cHV0Q29udGFpbmVyQ2xhc3NOYW1lcyhjZWxsSWQsIGFkZGVkLCByZW1vdmVkKTtcblx0XHR9XG5cdH1cblxuXHRjaGFuZ2VNb2RlbERlY29yYXRpb25zPFQ+KGNhbGxiYWNrOiAoY2hhbmdlQWNjZXNzb3I6IElNb2RlbERlY29yYXRpb25zQ2hhbmdlQWNjZXNzb3IpID0+IFQpOiBUIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMudmlld01vZGVsPy5jaGFuZ2VNb2RlbERlY29yYXRpb25zPFQ+KGNhbGxiYWNrKSB8fCBudWxsO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIFZpZXcgWm9uZXNcblx0Y2hhbmdlVmlld1pvbmVzKGNhbGxiYWNrOiAoYWNjZXNzb3I6IElOb3RlYm9va1ZpZXdab25lQ2hhbmdlQWNjZXNzb3IpID0+IHZvaWQpOiB2b2lkIHtcblx0XHR0aGlzLl9saXN0LmNoYW5nZVZpZXdab25lcyhjYWxsYmFjayk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VMYXlvdXQuZmlyZSgpO1xuXHR9XG5cblx0Z2V0Vmlld1pvbmVMYXlvdXRJbmZvKGlkOiBzdHJpbmcpOiB7IHRvcDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9IHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMuX2xpc3QuZ2V0Vmlld1pvbmVMYXlvdXRJbmZvKGlkKTtcblx0fVxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gT3ZlcmxheVxuXHRjaGFuZ2VDZWxsT3ZlcmxheXMoY2FsbGJhY2s6IChhY2Nlc3NvcjogSU5vdGVib29rQ2VsbE92ZXJsYXlDaGFuZ2VBY2Nlc3NvcikgPT4gdm9pZCk6IHZvaWQge1xuXHRcdHRoaXMuX2xpc3QuY2hhbmdlQ2VsbE92ZXJsYXlzKGNhbGxiYWNrKTtcblx0fVxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gS2VybmVsL0V4ZWN1dGlvblxuXG5cdHByaXZhdGUgYXN5bmMgX2xvYWRLZXJuZWxQcmVsb2FkcygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCB7IHNlbGVjdGVkIH0gPSB0aGlzLm5vdGVib29rS2VybmVsU2VydmljZS5nZXRNYXRjaGluZ0tlcm5lbCh0aGlzLnRleHRNb2RlbCk7XG5cdFx0aWYgKCF0aGlzLl93ZWJ2aWV3Py5pc1Jlc29sdmVkKCkpIHtcblx0XHRcdGF3YWl0IHRoaXMuX3Jlc29sdmVXZWJ2aWV3KCk7XG5cdFx0fVxuXHRcdHRoaXMuX3dlYnZpZXc/LnVwZGF0ZUtlcm5lbFByZWxvYWRzKHNlbGVjdGVkKTtcblx0fVxuXG5cdGdldCBhY3RpdmVLZXJuZWwoKSB7XG5cdFx0cmV0dXJuIHRoaXMudGV4dE1vZGVsICYmIHRoaXMubm90ZWJvb2tLZXJuZWxTZXJ2aWNlLmdldFNlbGVjdGVkT3JTdWdnZXN0ZWRLZXJuZWwodGhpcy50ZXh0TW9kZWwpO1xuXHR9XG5cblx0YXN5bmMgY2FuY2VsTm90ZWJvb2tDZWxscyhjZWxscz86IEl0ZXJhYmxlPElDZWxsVmlld01vZGVsPik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy52aWV3TW9kZWwgfHwgIXRoaXMuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIWNlbGxzKSB7XG5cdFx0XHRjZWxscyA9IHRoaXMudmlld01vZGVsLnZpZXdDZWxscztcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMubm90ZWJvb2tFeGVjdXRpb25TZXJ2aWNlLmNhbmNlbE5vdGVib29rQ2VsbEhhbmRsZXModGhpcy50ZXh0TW9kZWwsIEFycmF5LmZyb20oY2VsbHMpLm1hcChjZWxsID0+IGNlbGwuaGFuZGxlKSk7XG5cdH1cblxuXHRhc3luYyBleGVjdXRlTm90ZWJvb2tDZWxscyhjZWxscz86IEl0ZXJhYmxlPElDZWxsVmlld01vZGVsPik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy52aWV3TW9kZWwgfHwgIXRoaXMuaGFzTW9kZWwoKSkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oJ25vdGVib29rRWRpdG9yV2lkZ2V0JywgJ05vIE5vdGVib29rVmlld01vZGVsLCBjYW5ub3QgZXhlY3V0ZSBjZWxscycpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIWNlbGxzKSB7XG5cdFx0XHRjZWxscyA9IHRoaXMudmlld01vZGVsLnZpZXdDZWxscztcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMubm90ZWJvb2tFeGVjdXRpb25TZXJ2aWNlLmV4ZWN1dGVOb3RlYm9va0NlbGxzKHRoaXMudGV4dE1vZGVsLCBBcnJheS5mcm9tKGNlbGxzKS5tYXAoYyA9PiBjLm1vZGVsKSwgdGhpcy5zY29wZWRDb250ZXh0S2V5U2VydmljZSk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gQ2VsbCBvcGVyYXRpb25zL2xheW91dCBBUElcblx0cHJpdmF0ZSBfcGVuZGluZ0xheW91dHM6IFdlYWtNYXA8SUNlbGxWaWV3TW9kZWwsIElEaXNwb3NhYmxlPiB8IG51bGwgPSBuZXcgV2Vha01hcDxJQ2VsbFZpZXdNb2RlbCwgSURpc3Bvc2FibGU+KCk7XG5cdHByaXZhdGUgX2xheW91dERpc3Bvc2FibGVzOiBTZXQ8SURpc3Bvc2FibGU+ID0gbmV3IFNldDxJRGlzcG9zYWJsZT4oKTtcblx0YXN5bmMgbGF5b3V0Tm90ZWJvb2tDZWxsKGNlbGw6IElDZWxsVmlld01vZGVsLCBoZWlnaHQ6IG51bWJlciwgY29udGV4dD86IENlbGxMYXlvdXRDb250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fZGVidWcoJ2xheW91dCBjZWxsJywgY2VsbC5oYW5kbGUsIGhlaWdodCk7XG5cdFx0Y29uc3Qgdmlld0luZGV4ID0gdGhpcy5fbGlzdC5nZXRWaWV3SW5kZXgoY2VsbCk7XG5cdFx0aWYgKHZpZXdJbmRleCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHQvLyB0aGUgY2VsbCBpcyBoaWRkZW5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fcGVuZGluZ0xheW91dHM/LmhhcyhjZWxsKSkge1xuXHRcdFx0dGhpcy5fcGVuZGluZ0xheW91dHM/LmdldChjZWxsKSEuZGlzcG9zZSgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRlZmVycmVkID0gbmV3IERlZmVycmVkUHJvbWlzZTx2b2lkPigpO1xuXHRcdGNvbnN0IGRvTGF5b3V0ID0gKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX2lzRGlzcG9zZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXRoaXMudmlld01vZGVsPy5oYXNDZWxsKGNlbGwpKSB7XG5cdFx0XHRcdC8vIENlbGwgcmVtb3ZlZCBpbiB0aGUgbWVhbnRpbWU/XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuX2xpc3QuZ2V0Vmlld0luZGV4KGNlbGwpID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Ly8gQ2VsbCBjYW4gYmUgaGlkZGVuXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuX2xpc3QuZWxlbWVudEhlaWdodChjZWxsKSA9PT0gaGVpZ2h0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcGVuZGluZ0xheW91dCA9IHRoaXMuX3BlbmRpbmdMYXlvdXRzPy5nZXQoY2VsbCk7XG5cdFx0XHR0aGlzLl9wZW5kaW5nTGF5b3V0cz8uZGVsZXRlKGNlbGwpO1xuXG5cdFx0XHRpZiAoIXRoaXMuaGFzRWRpdG9yRm9jdXMoKSkge1xuXHRcdFx0XHQvLyBEbyBub3Qgc2Nyb2xsIGluYWN0aXZlIG5vdGVib29rXG5cdFx0XHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNDUzNDBcblx0XHRcdFx0Y29uc3QgY2VsbEluZGV4ID0gdGhpcy52aWV3TW9kZWw/LmdldENlbGxJbmRleChjZWxsKTtcblx0XHRcdFx0Y29uc3QgdmlzaWJsZVJhbmdlcyA9IHRoaXMudmlzaWJsZVJhbmdlcztcblx0XHRcdFx0aWYgKGNlbGxJbmRleCAhPT0gdW5kZWZpbmVkXG5cdFx0XHRcdFx0JiYgdmlzaWJsZVJhbmdlcyAmJiB2aXNpYmxlUmFuZ2VzLmxlbmd0aCAmJiB2aXNpYmxlUmFuZ2VzWzBdLnN0YXJ0ID09PSBjZWxsSW5kZXhcblx0XHRcdFx0XHQvLyBjZWxsIGlzIHBhcnRpYWxseSB2aXNpYmxlXG5cdFx0XHRcdFx0JiYgdGhpcy5fbGlzdC5zY3JvbGxUb3AgPiB0aGlzLmdldEFic29sdXRlVG9wT2ZFbGVtZW50KGNlbGwpXG5cdFx0XHRcdCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLl9saXN0LnVwZGF0ZUVsZW1lbnRIZWlnaHQyKGNlbGwsIGhlaWdodCwgTWF0aC5taW4oY2VsbEluZGV4ICsgMSwgdGhpcy5nZXRMZW5ndGgoKSAtIDEpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9saXN0LnVwZGF0ZUVsZW1lbnRIZWlnaHQyKGNlbGwsIGhlaWdodCk7XG5cdFx0XHRkZWZlcnJlZC5jb21wbGV0ZSh1bmRlZmluZWQpO1xuXHRcdFx0aWYgKHBlbmRpbmdMYXlvdXQpIHtcblx0XHRcdFx0cGVuZGluZ0xheW91dC5kaXNwb3NlKCk7XG5cdFx0XHRcdHRoaXMuX2xheW91dERpc3Bvc2FibGVzLmRlbGV0ZShwZW5kaW5nTGF5b3V0KTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0aWYgKHRoaXMuX2xpc3QuaW5SZW5kZXJpbmdUcmFuc2FjdGlvbikge1xuXHRcdFx0Y29uc3QgbGF5b3V0RGlzcG9zYWJsZSA9IERPTS5zY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lKERPTS5nZXRXaW5kb3codGhpcy5nZXREb21Ob2RlKCkpLCBkb0xheW91dCk7XG5cblx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0XHRsYXlvdXREaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdFx0ZGVmZXJyZWQuY29tcGxldGUodW5kZWZpbmVkKTtcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5fcGVuZGluZ0xheW91dHM/LnNldChjZWxsLCBkaXNwb3NhYmxlKTtcblx0XHRcdHRoaXMuX2xheW91dERpc3Bvc2FibGVzLmFkZChkaXNwb3NhYmxlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZG9MYXlvdXQoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZGVmZXJyZWQucDtcblx0fVxuXG5cdGdldEFjdGl2ZUNlbGwoKSB7XG5cdFx0Y29uc3QgZWxlbWVudHMgPSB0aGlzLl9saXN0LmdldEZvY3VzZWRFbGVtZW50cygpO1xuXG5cdFx0aWYgKGVsZW1lbnRzICYmIGVsZW1lbnRzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIGVsZW1lbnRzWzBdO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIF90b2dnbGVOb3RlYm9va0NlbGxTZWxlY3Rpb24oc2VsZWN0ZWRDZWxsOiBJQ2VsbFZpZXdNb2RlbCwgc2VsZWN0RnJvbVByZXZpb3VzOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgY3VycmVudFNlbGVjdGlvbnMgPSB0aGlzLl9saXN0LmdldFNlbGVjdGVkRWxlbWVudHMoKTtcblx0XHRjb25zdCBpc1NlbGVjdGVkID0gY3VycmVudFNlbGVjdGlvbnMuaW5jbHVkZXMoc2VsZWN0ZWRDZWxsKTtcblxuXHRcdGNvbnN0IHByZXZpb3VzU2VsZWN0aW9uID0gc2VsZWN0RnJvbVByZXZpb3VzID8gY3VycmVudFNlbGVjdGlvbnNbY3VycmVudFNlbGVjdGlvbnMubGVuZ3RoIC0gMV0gPz8gc2VsZWN0ZWRDZWxsIDogc2VsZWN0ZWRDZWxsO1xuXHRcdGNvbnN0IHNlbGVjdGVkSW5kZXggPSB0aGlzLl9saXN0LmdldFZpZXdJbmRleChzZWxlY3RlZENlbGwpITtcblx0XHRjb25zdCBwcmV2aW91c0luZGV4ID0gdGhpcy5fbGlzdC5nZXRWaWV3SW5kZXgocHJldmlvdXNTZWxlY3Rpb24pITtcblxuXHRcdGNvbnN0IGNlbGxzSW5TZWxlY3Rpb25SYW5nZSA9IHRoaXMuZ2V0Q2VsbHNJblZpZXdSYW5nZShzZWxlY3RlZEluZGV4LCBwcmV2aW91c0luZGV4KTtcblx0XHRpZiAoaXNTZWxlY3RlZCkge1xuXHRcdFx0Ly8gRGVzZWxlY3Rcblx0XHRcdHRoaXMuX2xpc3Quc2VsZWN0RWxlbWVudHMoY3VycmVudFNlbGVjdGlvbnMuZmlsdGVyKGN1cnJlbnQgPT4gIWNlbGxzSW5TZWxlY3Rpb25SYW5nZS5pbmNsdWRlcyhjdXJyZW50KSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBBZGQgdG8gc2VsZWN0aW9uXG5cdFx0XHR0aGlzLmZvY3VzRWxlbWVudChzZWxlY3RlZENlbGwpO1xuXHRcdFx0dGhpcy5fbGlzdC5zZWxlY3RFbGVtZW50cyhbLi4uY3VycmVudFNlbGVjdGlvbnMuZmlsdGVyKGN1cnJlbnQgPT4gIWNlbGxzSW5TZWxlY3Rpb25SYW5nZS5pbmNsdWRlcyhjdXJyZW50KSksIC4uLmNlbGxzSW5TZWxlY3Rpb25SYW5nZV0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0Q2VsbHNJblZpZXdSYW5nZShmcm9tSW5jbHVzaXZlOiBudW1iZXIsIHRvSW5jbHVzaXZlOiBudW1iZXIpOiBJQ2VsbFZpZXdNb2RlbFtdIHtcblx0XHRjb25zdCBzZWxlY3RlZENlbGxzSW5SYW5nZTogSUNlbGxWaWV3TW9kZWxbXSA9IFtdO1xuXHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLl9saXN0Lmxlbmd0aDsgKytpbmRleCkge1xuXHRcdFx0Y29uc3QgY2VsbCA9IHRoaXMuX2xpc3QuZWxlbWVudChpbmRleCk7XG5cdFx0XHRpZiAoY2VsbCkge1xuXHRcdFx0XHRpZiAoKGluZGV4ID49IGZyb21JbmNsdXNpdmUgJiYgaW5kZXggPD0gdG9JbmNsdXNpdmUpIHx8IChpbmRleCA+PSB0b0luY2x1c2l2ZSAmJiBpbmRleCA8PSBmcm9tSW5jbHVzaXZlKSkge1xuXHRcdFx0XHRcdHNlbGVjdGVkQ2VsbHNJblJhbmdlLnB1c2goY2VsbCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHNlbGVjdGVkQ2VsbHNJblJhbmdlO1xuXHR9XG5cblx0YXN5bmMgZm9jdXNOb3RlYm9va0NlbGwoY2VsbDogSUNlbGxWaWV3TW9kZWwsIGZvY3VzSXRlbTogJ2VkaXRvcicgfCAnY29udGFpbmVyJyB8ICdvdXRwdXQnLCBvcHRpb25zPzogSUZvY3VzTm90ZWJvb2tDZWxsT3B0aW9ucykge1xuXHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y2VsbC5mb2N1c2VkT3V0cHV0SWQgPSB1bmRlZmluZWQ7XG5cblx0XHRpZiAoZm9jdXNJdGVtID09PSAnZWRpdG9yJykge1xuXHRcdFx0Y2VsbC5pc0lucHV0Q29sbGFwc2VkID0gZmFsc2U7XG5cdFx0XHR0aGlzLmZvY3VzRWxlbWVudChjZWxsKTtcblx0XHRcdHRoaXMuX2xpc3QuZm9jdXNWaWV3KCk7XG5cblx0XHRcdGNlbGwudXBkYXRlRWRpdFN0YXRlKENlbGxFZGl0U3RhdGUuRWRpdGluZywgJ2ZvY3VzTm90ZWJvb2tDZWxsJyk7XG5cdFx0XHRjZWxsLmZvY3VzTW9kZSA9IENlbGxGb2N1c01vZGUuRWRpdG9yO1xuXHRcdFx0aWYgKCFvcHRpb25zPy5za2lwUmV2ZWFsKSB7XG5cdFx0XHRcdGlmICh0eXBlb2Ygb3B0aW9ucz8uZm9jdXNFZGl0b3JMaW5lID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdHRoaXMuX2N1cnNvck5hdk1vZGUuc2V0KHRydWUpO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMucmV2ZWFsTGluZUluVmlld0FzeW5jKGNlbGwsIG9wdGlvbnMuZm9jdXNFZGl0b3JMaW5lKTtcblx0XHRcdFx0XHRjb25zdCBlZGl0b3IgPSB0aGlzLl9yZW5kZXJlZEVkaXRvcnMuZ2V0KGNlbGwpITtcblx0XHRcdFx0XHRjb25zdCBmb2N1c0VkaXRvckxpbmUgPSBvcHRpb25zLmZvY3VzRWRpdG9yTGluZTtcblx0XHRcdFx0XHRlZGl0b3I/LnNldFNlbGVjdGlvbih7XG5cdFx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IGZvY3VzRWRpdG9yTGluZSxcblx0XHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiAxLFxuXHRcdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogZm9jdXNFZGl0b3JMaW5lLFxuXHRcdFx0XHRcdFx0ZW5kQ29sdW1uOiAxXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3Qgc2VsZWN0aW9uc1N0YXJ0UG9zaXRpb24gPSBjZWxsLmdldFNlbGVjdGlvbnNTdGFydFBvc2l0aW9uKCk7XG5cdFx0XHRcdFx0aWYgKHNlbGVjdGlvbnNTdGFydFBvc2l0aW9uPy5sZW5ndGgpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGZpcnN0U2VsZWN0aW9uUG9zaXRpb24gPSBzZWxlY3Rpb25zU3RhcnRQb3NpdGlvblswXTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucmV2ZWFsUmFuZ2VJblZpZXdBc3luYyhjZWxsLCBSYW5nZS5mcm9tUG9zaXRpb25zKGZpcnN0U2VsZWN0aW9uUG9zaXRpb24sIGZpcnN0U2VsZWN0aW9uUG9zaXRpb24pKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5yZXZlYWxJblZpZXcoY2VsbCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdH1cblxuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoZm9jdXNJdGVtID09PSAnb3V0cHV0Jykge1xuXHRcdFx0dGhpcy5mb2N1c0VsZW1lbnQoY2VsbCk7XG5cblx0XHRcdGlmICghdGhpcy5oYXNFZGl0b3JGb2N1cygpKSB7XG5cdFx0XHRcdHRoaXMuX2xpc3QuZm9jdXNWaWV3KCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdGhpcy5fd2Vidmlldykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGZpcnN0T3V0cHV0SWQgPSBjZWxsLm91dHB1dHNWaWV3TW9kZWxzLmZpbmQobyA9PiBvLm1vZGVsLmFsdGVybmF0aXZlT3V0cHV0SWQpPy5tb2RlbC5hbHRlcm5hdGl2ZU91dHB1dElkO1xuXHRcdFx0Y29uc3QgZm9jdXNFbGVtZW50SWQgPSBvcHRpb25zPy5vdXRwdXRJZCA/PyBmaXJzdE91dHB1dElkID8/IGNlbGwuaWQ7XG5cdFx0XHR0aGlzLl93ZWJ2aWV3LmZvY3VzT3V0cHV0KGZvY3VzRWxlbWVudElkLCBvcHRpb25zPy5hbHRPdXRwdXRJZCwgb3B0aW9ucz8ub3V0cHV0V2Vidmlld0ZvY3VzZWQgfHwgdGhpcy5fd2Vidmlld0ZvY3VzZWQpO1xuXG5cdFx0XHRjZWxsLnVwZGF0ZUVkaXRTdGF0ZShDZWxsRWRpdFN0YXRlLlByZXZpZXcsICdmb2N1c05vdGVib29rQ2VsbCcpO1xuXHRcdFx0Y2VsbC5mb2N1c01vZGUgPSBDZWxsRm9jdXNNb2RlLk91dHB1dDtcblx0XHRcdGNlbGwuZm9jdXNlZE91dHB1dElkID0gb3B0aW9ucz8ub3V0cHV0SWQ7XG5cdFx0XHR0aGlzLl9vdXRwdXRGb2N1cy5zZXQodHJ1ZSk7XG5cdFx0XHRpZiAoIW9wdGlvbnM/LnNraXBSZXZlYWwpIHtcblx0XHRcdFx0dGhpcy5yZXZlYWxJbkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0KGNlbGwpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBmb2N1cyBjb250YWluZXJcblx0XHRcdGNvbnN0IGl0ZW1ET00gPSB0aGlzLl9saXN0LmRvbUVsZW1lbnRPZkVsZW1lbnQoY2VsbCk7XG5cdFx0XHRpZiAoaXRlbURPTSAmJiBpdGVtRE9NLm93bmVyRG9jdW1lbnQuYWN0aXZlRWxlbWVudCAmJiBpdGVtRE9NLmNvbnRhaW5zKGl0ZW1ET00ub3duZXJEb2N1bWVudC5hY3RpdmVFbGVtZW50KSkge1xuXHRcdFx0XHQoaXRlbURPTS5vd25lckRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgYXMgSFRNTEVsZW1lbnQpLmJsdXIoKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fd2Vidmlldz8uYmx1ck91dHB1dCgpO1xuXG5cdFx0XHRjZWxsLnVwZGF0ZUVkaXRTdGF0ZShDZWxsRWRpdFN0YXRlLlByZXZpZXcsICdmb2N1c05vdGVib29rQ2VsbCcpO1xuXHRcdFx0Y2VsbC5mb2N1c01vZGUgPSBDZWxsRm9jdXNNb2RlLkNvbnRhaW5lcjtcblxuXHRcdFx0dGhpcy5mb2N1c0VsZW1lbnQoY2VsbCk7XG5cdFx0XHRpZiAoIW9wdGlvbnM/LnNraXBSZXZlYWwpIHtcblx0XHRcdFx0aWYgKHR5cGVvZiBvcHRpb25zPy5mb2N1c0VkaXRvckxpbmUgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0dGhpcy5fY3Vyc29yTmF2TW9kZS5zZXQodHJ1ZSk7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5yZXZlYWxJblZpZXcoY2VsbCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAob3B0aW9ucz8ucmV2ZWFsQmVoYXZpb3IgPT09IFNjcm9sbFRvUmV2ZWFsQmVoYXZpb3IuZmlyc3RMaW5lKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5yZXZlYWxGaXJzdExpbmVJZk91dHNpZGVWaWV3cG9ydChjZWxsKTtcblx0XHRcdFx0fSBlbHNlIGlmIChvcHRpb25zPy5yZXZlYWxCZWhhdmlvciA9PT0gU2Nyb2xsVG9SZXZlYWxCZWhhdmlvci5mdWxsQ2VsbCkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMucmV2ZWFsSW5WaWV3KGNlbGwpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMucmV2ZWFsSW5DZW50ZXJJZk91dHNpZGVWaWV3cG9ydChjZWxsKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5fbGlzdC5mb2N1c1ZpZXcoKTtcblx0XHRcdHRoaXMudXBkYXRlRWRpdG9yRm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBmb2N1c05leHROb3RlYm9va0NlbGwoY2VsbDogSUNlbGxWaWV3TW9kZWwsIGZvY3VzSXRlbTogJ2VkaXRvcicgfCAnY29udGFpbmVyJyB8ICdvdXRwdXQnKSB7XG5cdFx0Y29uc3QgaWR4ID0gdGhpcy52aWV3TW9kZWw/LmdldENlbGxJbmRleChjZWxsKTtcblx0XHRpZiAodHlwZW9mIGlkeCAhPT0gJ251bWJlcicpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBuZXdDZWxsID0gdGhpcy52aWV3TW9kZWw/LmNlbGxBdChpZHggKyAxKTtcblx0XHRpZiAoIW5ld0NlbGwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLmZvY3VzTm90ZWJvb2tDZWxsKG5ld0NlbGwsIGZvY3VzSXRlbSk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gRmluZFxuXG5cdHByaXZhdGUgYXN5bmMgX3dhcm11cENlbGwodmlld0NlbGw6IENvZGVDZWxsVmlld01vZGVsKSB7XG5cdFx0aWYgKHZpZXdDZWxsLmlzT3V0cHV0Q29sbGFwc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3V0cHV0cyA9IHZpZXdDZWxsLm91dHB1dHNWaWV3TW9kZWxzO1xuXHRcdGZvciAoY29uc3Qgb3V0cHV0IG9mIG91dHB1dHMuc2xpY2UoMCwgb3V0cHV0RGlzcGxheUxpbWl0KSkge1xuXHRcdFx0Y29uc3QgW21pbWVUeXBlcywgcGlja10gPSBvdXRwdXQucmVzb2x2ZU1pbWVUeXBlcyh0aGlzLnRleHRNb2RlbCEsIHVuZGVmaW5lZCk7XG5cdFx0XHRpZiAoIW1pbWVUeXBlcy5maW5kKG1pbWVUeXBlID0+IG1pbWVUeXBlLmlzVHJ1c3RlZCkgfHwgbWltZVR5cGVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcGlja2VkTWltZVR5cGVSZW5kZXJlciA9IG1pbWVUeXBlc1twaWNrXTtcblxuXHRcdFx0aWYgKCFwaWNrZWRNaW1lVHlwZVJlbmRlcmVyKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcmVuZGVyZXIgPSB0aGlzLl9ub3RlYm9va1NlcnZpY2UuZ2V0UmVuZGVyZXJJbmZvKHBpY2tlZE1pbWVUeXBlUmVuZGVyZXIucmVuZGVyZXJJZCk7XG5cblx0XHRcdGlmICghcmVuZGVyZXIpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByZXN1bHQ6IElJbnNldFJlbmRlck91dHB1dCA9IHsgdHlwZTogUmVuZGVyT3V0cHV0VHlwZS5FeHRlbnNpb24sIHJlbmRlcmVyLCBzb3VyY2U6IG91dHB1dCwgbWltZVR5cGU6IHBpY2tlZE1pbWVUeXBlUmVuZGVyZXIubWltZVR5cGUgfTtcblx0XHRcdGNvbnN0IGluc2V0ID0gdGhpcy5fd2Vidmlldz8uaW5zZXRNYXBwaW5nLmdldChyZXN1bHQuc291cmNlKTtcblx0XHRcdGlmICghaW5zZXQgfHwgIWluc2V0LmluaXRpYWxpemVkKSB7XG5cdFx0XHRcdGNvbnN0IHAgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHtcblx0XHRcdFx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5hbnkodGhpcy5vbkRpZFJlbmRlck91dHB1dCwgdGhpcy5vbkRpZFJlbW92ZU91dHB1dCkoZSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoZS5tb2RlbCA9PT0gcmVzdWx0LnNvdXJjZS5tb2RlbCkge1xuXHRcdFx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGhpcy5jcmVhdGVPdXRwdXQodmlld0NlbGwsIHJlc3VsdCwgMCwgZmFsc2UpO1xuXHRcdFx0XHRhd2FpdCBwO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gcmVxdWVzdCB0byB1cGRhdGUgaXRzIHZpc2liaWxpdHlcblx0XHRcdFx0dGhpcy5jcmVhdGVPdXRwdXQodmlld0NlbGwsIHJlc3VsdCwgMCwgZmFsc2UpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF93YXJtdXBBbGwoaW5jbHVkZU91dHB1dDogYm9vbGVhbikge1xuXHRcdGlmICghdGhpcy5oYXNNb2RlbCgpIHx8ICF0aGlzLnZpZXdNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNlbGxzID0gdGhpcy52aWV3TW9kZWwudmlld0NlbGxzO1xuXHRcdGNvbnN0IHJlcXVlc3RzID0gW107XG5cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGNlbGxzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRpZiAoY2VsbHNbaV0uY2VsbEtpbmQgPT09IENlbGxLaW5kLk1hcmt1cCAmJiAhdGhpcy5fd2VidmlldyEubWFya3VwUHJldmlld01hcHBpbmcuaGFzKGNlbGxzW2ldLmlkKSkge1xuXHRcdFx0XHRyZXF1ZXN0cy5wdXNoKHRoaXMuY3JlYXRlTWFya3VwUHJldmlldyhjZWxsc1tpXSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChpbmNsdWRlT3V0cHV0ICYmIHRoaXMuX2xpc3QpIHtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGlzdC5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBjZWxsID0gdGhpcy5fbGlzdC5lbGVtZW50KGkpO1xuXG5cdFx0XHRcdGlmIChjZWxsPy5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuQ29kZSkge1xuXHRcdFx0XHRcdHJlcXVlc3RzLnB1c2godGhpcy5fd2FybXVwQ2VsbCgoY2VsbCBhcyBDb2RlQ2VsbFZpZXdNb2RlbCkpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBQcm9taXNlLmFsbChyZXF1ZXN0cyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF93YXJtdXBTZWxlY3Rpb24oaW5jbHVkZU91dHB1dDogYm9vbGVhbiwgc2VsZWN0ZWRDZWxsUmFuZ2VzOiBJQ2VsbFJhbmdlW10pIHtcblx0XHRpZiAoIXRoaXMuaGFzTW9kZWwoKSB8fCAhdGhpcy52aWV3TW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjZWxscyA9IHRoaXMudmlld01vZGVsLnZpZXdDZWxscztcblx0XHRjb25zdCByZXF1ZXN0cyA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCByYW5nZSBvZiBzZWxlY3RlZENlbGxSYW5nZXMpIHtcblx0XHRcdGZvciAobGV0IGkgPSByYW5nZS5zdGFydDsgaSA8IHJhbmdlLmVuZDsgaSsrKSB7XG5cdFx0XHRcdGlmIChjZWxsc1tpXS5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuTWFya3VwICYmICF0aGlzLl93ZWJ2aWV3IS5tYXJrdXBQcmV2aWV3TWFwcGluZy5oYXMoY2VsbHNbaV0uaWQpKSB7XG5cdFx0XHRcdFx0cmVxdWVzdHMucHVzaCh0aGlzLmNyZWF0ZU1hcmt1cFByZXZpZXcoY2VsbHNbaV0pKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChpbmNsdWRlT3V0cHV0ICYmIHRoaXMuX2xpc3QpIHtcblx0XHRcdGZvciAoY29uc3QgcmFuZ2Ugb2Ygc2VsZWN0ZWRDZWxsUmFuZ2VzKSB7XG5cdFx0XHRcdGZvciAobGV0IGkgPSByYW5nZS5zdGFydDsgaSA8IHJhbmdlLmVuZDsgaSsrKSB7XG5cdFx0XHRcdFx0Y29uc3QgY2VsbCA9IHRoaXMuX2xpc3QuZWxlbWVudChpKTtcblxuXHRcdFx0XHRcdGlmIChjZWxsPy5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuQ29kZSkge1xuXHRcdFx0XHRcdFx0cmVxdWVzdHMucHVzaCh0aGlzLl93YXJtdXBDZWxsKChjZWxsIGFzIENvZGVDZWxsVmlld01vZGVsKSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBQcm9taXNlLmFsbChyZXF1ZXN0cyk7XG5cdH1cblxuXHRhc3luYyBmaW5kKHF1ZXJ5OiBzdHJpbmcsIG9wdGlvbnM6IElOb3RlYm9va0ZpbmRPcHRpb25zLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIHNraXBXYXJtdXA6IGJvb2xlYW4gPSBmYWxzZSwgc2hvdWxkR2V0U2VhcmNoUHJldmlld0luZm8gPSBmYWxzZSwgb3duZXJJRD86IHN0cmluZyk6IFByb21pc2U8Q2VsbEZpbmRNYXRjaFdpdGhJbmRleFtdPiB7XG5cdFx0aWYgKCF0aGlzLl9ub3RlYm9va1ZpZXdNb2RlbCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGlmICghb3duZXJJRCkge1xuXHRcdFx0b3duZXJJRCA9IHRoaXMuZ2V0SWQoKTtcblx0XHR9XG5cblx0XHRjb25zdCBmaW5kTWF0Y2hlcyA9IHRoaXMuX25vdGVib29rVmlld01vZGVsLmZpbmQocXVlcnksIG9wdGlvbnMpLmZpbHRlcihtYXRjaCA9PiBtYXRjaC5sZW5ndGggPiAwKTtcblxuXHRcdGlmICgoIW9wdGlvbnMuaW5jbHVkZU1hcmt1cFByZXZpZXcgJiYgIW9wdGlvbnMuaW5jbHVkZU91dHB1dCkgfHwgb3B0aW9ucy5maW5kU2NvcGU/LmZpbmRTY29wZVR5cGUgPT09IE5vdGVib29rRmluZFNjb3BlVHlwZS5UZXh0KSB7XG5cdFx0XHR0aGlzLl93ZWJ2aWV3Py5maW5kU3RvcChvd25lcklEKTtcblx0XHRcdHJldHVybiBmaW5kTWF0Y2hlcztcblx0XHR9XG5cblx0XHQvLyBzZWFyY2ggaW4gd2VidmlldyBlbmFibGVkXG5cblx0XHRjb25zdCBtYXRjaE1hcDogeyBba2V5OiBzdHJpbmddOiBDZWxsRmluZE1hdGNoV2l0aEluZGV4IH0gPSB7fTtcblx0XHRmaW5kTWF0Y2hlcy5mb3JFYWNoKG1hdGNoID0+IHtcblx0XHRcdG1hdGNoTWFwW21hdGNoLmNlbGwuaWRdID0gbWF0Y2g7XG5cdFx0fSk7XG5cblx0XHRpZiAodGhpcy5fd2Vidmlldykge1xuXHRcdFx0Ly8gcmVxdWVzdCBhbGwgb3Igc29tZSBvdXRwdXRzIHRvIGJlIHJlbmRlcmVkXG5cdFx0XHQvLyBtZWFzdXJlIHBlcmZcblx0XHRcdGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcblx0XHRcdGlmIChvcHRpb25zLmZpbmRTY29wZSAmJiBvcHRpb25zLmZpbmRTY29wZS5maW5kU2NvcGVUeXBlID09PSBOb3RlYm9va0ZpbmRTY29wZVR5cGUuQ2VsbHMgJiYgb3B0aW9ucy5maW5kU2NvcGUuc2VsZWN0ZWRDZWxsUmFuZ2VzKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuX3dhcm11cFNlbGVjdGlvbighIW9wdGlvbnMuaW5jbHVkZU91dHB1dCwgb3B0aW9ucy5maW5kU2NvcGUuc2VsZWN0ZWRDZWxsUmFuZ2VzKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuX3dhcm11cEFsbCghIW9wdGlvbnMuaW5jbHVkZU91dHB1dCk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBlbmQgPSBEYXRlLm5vdygpO1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmRlYnVnKCdGaW5kJywgYFdhcm11cCB0aW1lOiAke2VuZCAtIHN0YXJ0fW1zYCk7XG5cblx0XHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHR9XG5cblx0XHRcdGxldCBmaW5kSWRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0aWYgKG9wdGlvbnMuZmluZFNjb3BlICYmIG9wdGlvbnMuZmluZFNjb3BlLmZpbmRTY29wZVR5cGUgPT09IE5vdGVib29rRmluZFNjb3BlVHlwZS5DZWxscyAmJiBvcHRpb25zLmZpbmRTY29wZS5zZWxlY3RlZENlbGxSYW5nZXMpIHtcblx0XHRcdFx0Y29uc3Qgc2VsZWN0ZWRJbmRleGVzID0gY2VsbFJhbmdlc1RvSW5kZXhlcyhvcHRpb25zLmZpbmRTY29wZS5zZWxlY3RlZENlbGxSYW5nZXMpO1xuXHRcdFx0XHRmaW5kSWRzID0gc2VsZWN0ZWRJbmRleGVzLm1hcDxzdHJpbmc+KGluZGV4ID0+IHRoaXMuX25vdGVib29rVmlld01vZGVsPy52aWV3Q2VsbHNbaW5kZXhdLmlkID8/ICcnKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgd2Vidmlld01hdGNoZXMgPSBhd2FpdCB0aGlzLl93ZWJ2aWV3LmZpbmQocXVlcnksIHsgY2FzZVNlbnNpdGl2ZTogb3B0aW9ucy5jYXNlU2Vuc2l0aXZlLCB3aG9sZVdvcmQ6IG9wdGlvbnMud2hvbGVXb3JkLCBpbmNsdWRlTWFya3VwOiAhIW9wdGlvbnMuaW5jbHVkZU1hcmt1cFByZXZpZXcsIGluY2x1ZGVPdXRwdXQ6ICEhb3B0aW9ucy5pbmNsdWRlT3V0cHV0LCBzaG91bGRHZXRTZWFyY2hQcmV2aWV3SW5mbywgb3duZXJJRCwgZmluZElkczogZmluZElkcyB9KTtcblxuXHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gYXR0YWNoIHdlYnZpZXcgbWF0Y2hlcyB0byBtb2RlbCBmaW5kIG1hdGNoZXNcblx0XHRcdHdlYnZpZXdNYXRjaGVzLmZvckVhY2gobWF0Y2ggPT4ge1xuXHRcdFx0XHRjb25zdCBjZWxsID0gdGhpcy5fbm90ZWJvb2tWaWV3TW9kZWwhLnZpZXdDZWxscy5maW5kKGNlbGwgPT4gY2VsbC5pZCA9PT0gbWF0Y2guY2VsbElkKTtcblxuXHRcdFx0XHRpZiAoIWNlbGwpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAobWF0Y2gudHlwZSA9PT0gJ3ByZXZpZXcnKSB7XG5cdFx0XHRcdFx0Ly8gbWFya3VwIHByZXZpZXdcblx0XHRcdFx0XHRpZiAoY2VsbC5nZXRFZGl0U3RhdGUoKSA9PT0gQ2VsbEVkaXRTdGF0ZS5QcmV2aWV3ICYmICFvcHRpb25zLmluY2x1ZGVNYXJrdXBQcmV2aWV3KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKGNlbGwuZ2V0RWRpdFN0YXRlKCkgPT09IENlbGxFZGl0U3RhdGUuRWRpdGluZyAmJiBvcHRpb25zLmluY2x1ZGVNYXJrdXBJbnB1dCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAoIW9wdGlvbnMuaW5jbHVkZU91dHB1dCkge1xuXHRcdFx0XHRcdFx0Ly8gc2tpcCBvdXRwdXRzIGlmIG5vdCBpbmNsdWRlZFxuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGV4aXNpdGluZ01hdGNoID0gbWF0Y2hNYXBbbWF0Y2guY2VsbElkXTtcblxuXHRcdFx0XHRpZiAoZXhpc2l0aW5nTWF0Y2gpIHtcblx0XHRcdFx0XHRleGlzaXRpbmdNYXRjaC53ZWJ2aWV3TWF0Y2hlcy5wdXNoKG1hdGNoKTtcblx0XHRcdFx0fSBlbHNlIHtcblxuXHRcdFx0XHRcdG1hdGNoTWFwW21hdGNoLmNlbGxJZF0gPSBuZXcgQ2VsbEZpbmRNYXRjaE1vZGVsKFxuXHRcdFx0XHRcdFx0dGhpcy5fbm90ZWJvb2tWaWV3TW9kZWwhLnZpZXdDZWxscy5maW5kKGNlbGwgPT4gY2VsbC5pZCA9PT0gbWF0Y2guY2VsbElkKSEsXG5cdFx0XHRcdFx0XHR0aGlzLl9ub3RlYm9va1ZpZXdNb2RlbCEudmlld0NlbGxzLmZpbmRJbmRleChjZWxsID0+IGNlbGwuaWQgPT09IG1hdGNoLmNlbGxJZCkhLFxuXHRcdFx0XHRcdFx0W10sXG5cdFx0XHRcdFx0XHRbbWF0Y2hdXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmV0OiBDZWxsRmluZE1hdGNoV2l0aEluZGV4W10gPSBbXTtcblx0XHR0aGlzLl9ub3RlYm9va1ZpZXdNb2RlbC52aWV3Q2VsbHMuZm9yRWFjaCgoY2VsbCwgaW5kZXgpID0+IHtcblx0XHRcdGlmIChtYXRjaE1hcFtjZWxsLmlkXSkge1xuXHRcdFx0XHRyZXQucHVzaChuZXcgQ2VsbEZpbmRNYXRjaE1vZGVsKGNlbGwsIGluZGV4LCBtYXRjaE1hcFtjZWxsLmlkXS5jb250ZW50TWF0Y2hlcywgbWF0Y2hNYXBbY2VsbC5pZF0ud2Vidmlld01hdGNoZXMpKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHJldHVybiByZXQ7XG5cdH1cblxuXHRhc3luYyBmaW5kSGlnaGxpZ2h0Q3VycmVudChtYXRjaEluZGV4OiBudW1iZXIsIG93bmVySUQ/OiBzdHJpbmcpOiBQcm9taXNlPG51bWJlcj4ge1xuXHRcdGlmICghdGhpcy5fd2Vidmlldykge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3dlYnZpZXc/LmZpbmRIaWdobGlnaHRDdXJyZW50KG1hdGNoSW5kZXgsIG93bmVySUQgPz8gdGhpcy5nZXRJZCgpKTtcblx0fVxuXG5cdGFzeW5jIGZpbmRVbkhpZ2hsaWdodEN1cnJlbnQobWF0Y2hJbmRleDogbnVtYmVyLCBvd25lcklEPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLl93ZWJ2aWV3KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3dlYnZpZXc/LmZpbmRVbkhpZ2hsaWdodEN1cnJlbnQobWF0Y2hJbmRleCwgb3duZXJJRCA/PyB0aGlzLmdldElkKCkpO1xuXHR9XG5cblx0ZmluZFN0b3Aob3duZXJJRD86IHN0cmluZykge1xuXHRcdHRoaXMuX3dlYnZpZXc/LmZpbmRTdG9wKG93bmVySUQgPz8gdGhpcy5nZXRJZCgpKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBNSVNDXG5cblx0Z2V0TGF5b3V0SW5mbygpOiBOb3RlYm9va0xheW91dEluZm8ge1xuXHRcdGlmICghdGhpcy5fbGlzdCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdFZGl0b3IgaXMgbm90IGluaXRhbGl6ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl9mb250SW5mbykge1xuXHRcdFx0dGhpcy5fZ2VuZXJhdGVGb250SW5mbygpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHR3aWR0aDogdGhpcy5fZGltZW5zaW9uPy53aWR0aCA/PyAwLFxuXHRcdFx0aGVpZ2h0OiB0aGlzLl9kaW1lbnNpb24/LmhlaWdodCA/PyAwLFxuXHRcdFx0c2Nyb2xsSGVpZ2h0OiB0aGlzLl9saXN0Py5nZXRTY3JvbGxIZWlnaHQoKSA/PyAwLFxuXHRcdFx0Zm9udEluZm86IHRoaXMuX2ZvbnRJbmZvISxcblx0XHRcdHN0aWNreUhlaWdodDogdGhpcy5fbm90ZWJvb2tTdGlja3lTY3JvbGw/LmdldEN1cnJlbnRTdGlja3lIZWlnaHQoKSA/PyAwXG5cdFx0fTtcblx0fVxuXG5cdGFzeW5jIGNyZWF0ZU1hcmt1cFByZXZpZXcoY2VsbDogTWFya3VwQ2VsbFZpZXdNb2RlbCkge1xuXHRcdGlmICghdGhpcy5fd2Vidmlldykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fd2Vidmlldy5pc1Jlc29sdmVkKCkpIHtcblx0XHRcdGF3YWl0IHRoaXMuX3Jlc29sdmVXZWJ2aWV3KCk7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl93ZWJ2aWV3IHx8ICF0aGlzLl9saXN0LndlYnZpZXdFbGVtZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLnZpZXdNb2RlbCB8fCAhdGhpcy5fbGlzdC52aWV3TW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy52aWV3TW9kZWwuZ2V0Q2VsbEluZGV4KGNlbGwpID09PSAtMSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNlbGxJc0hpZGRlbihjZWxsKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHdlYnZpZXdUb3AgPSBwYXJzZUludCh0aGlzLl9saXN0LndlYnZpZXdFbGVtZW50LmRvbU5vZGUuc3R5bGUudG9wLCAxMCk7XG5cdFx0Y29uc3QgdG9wID0gISF3ZWJ2aWV3VG9wID8gKDAgLSB3ZWJ2aWV3VG9wKSA6IDA7XG5cblx0XHRjb25zdCBjZWxsVG9wID0gdGhpcy5fbGlzdC5nZXRDZWxsVmlld1Njcm9sbFRvcChjZWxsKTtcblx0XHRhd2FpdCB0aGlzLl93ZWJ2aWV3LnNob3dNYXJrdXBQcmV2aWV3KHtcblx0XHRcdG1pbWU6IGNlbGwubWltZSxcblx0XHRcdGNlbGxIYW5kbGU6IGNlbGwuaGFuZGxlLFxuXHRcdFx0Y2VsbElkOiBjZWxsLmlkLFxuXHRcdFx0Y29udGVudDogY2VsbC5nZXRUZXh0KCksXG5cdFx0XHRvZmZzZXQ6IGNlbGxUb3AgKyB0b3AsXG5cdFx0XHR2aXNpYmxlOiB0cnVlLFxuXHRcdFx0bWV0YWRhdGE6IGNlbGwubWV0YWRhdGEsXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGNlbGxJc0hpZGRlbihjZWxsOiBJQ2VsbFZpZXdNb2RlbCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IG1vZGVsSW5kZXggPSB0aGlzLnZpZXdNb2RlbCEuZ2V0Q2VsbEluZGV4KGNlbGwpO1xuXHRcdGNvbnN0IGZvbGRlZFJhbmdlcyA9IHRoaXMudmlld01vZGVsIS5nZXRIaWRkZW5SYW5nZXMoKTtcblx0XHRyZXR1cm4gZm9sZGVkUmFuZ2VzLnNvbWUocmFuZ2UgPT4gbW9kZWxJbmRleCA+PSByYW5nZS5zdGFydCAmJiBtb2RlbEluZGV4IDw9IHJhbmdlLmVuZCk7XG5cdH1cblxuXHRhc3luYyB1bmhpZGVNYXJrdXBQcmV2aWV3cyhjZWxsczogcmVhZG9ubHkgTWFya3VwQ2VsbFZpZXdNb2RlbFtdKSB7XG5cdFx0aWYgKCF0aGlzLl93ZWJ2aWV3KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl93ZWJ2aWV3LmlzUmVzb2x2ZWQoKSkge1xuXHRcdFx0YXdhaXQgdGhpcy5fcmVzb2x2ZVdlYnZpZXcoKTtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLl93ZWJ2aWV3Py51bmhpZGVNYXJrdXBQcmV2aWV3cyhjZWxscy5tYXAoY2VsbCA9PiBjZWxsLmlkKSk7XG5cdH1cblxuXHRhc3luYyBoaWRlTWFya3VwUHJldmlld3MoY2VsbHM6IHJlYWRvbmx5IE1hcmt1cENlbGxWaWV3TW9kZWxbXSkge1xuXHRcdGlmICghdGhpcy5fd2VidmlldyB8fCAhY2VsbHMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl93ZWJ2aWV3LmlzUmVzb2x2ZWQoKSkge1xuXHRcdFx0YXdhaXQgdGhpcy5fcmVzb2x2ZVdlYnZpZXcoKTtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLl93ZWJ2aWV3Py5oaWRlTWFya3VwUHJldmlld3MoY2VsbHMubWFwKGNlbGwgPT4gY2VsbC5pZCkpO1xuXHR9XG5cblx0YXN5bmMgZGVsZXRlTWFya3VwUHJldmlld3MoY2VsbHM6IHJlYWRvbmx5IE1hcmt1cENlbGxWaWV3TW9kZWxbXSkge1xuXHRcdGlmICghdGhpcy5fd2Vidmlldykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fd2Vidmlldy5pc1Jlc29sdmVkKCkpIHtcblx0XHRcdGF3YWl0IHRoaXMuX3Jlc29sdmVXZWJ2aWV3KCk7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5fd2Vidmlldz8uZGVsZXRlTWFya3VwUHJldmlld3MoY2VsbHMubWFwKGNlbGwgPT4gY2VsbC5pZCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVTZWxlY3RlZE1hcmtkb3duUHJldmlld3MoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLl93ZWJ2aWV3KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl93ZWJ2aWV3LmlzUmVzb2x2ZWQoKSkge1xuXHRcdFx0YXdhaXQgdGhpcy5fcmVzb2x2ZVdlYnZpZXcoKTtcblx0XHR9XG5cblx0XHRjb25zdCBzZWxlY3RlZENlbGxzID0gdGhpcy5nZXRTZWxlY3Rpb25WaWV3TW9kZWxzKCkubWFwKGNlbGwgPT4gY2VsbC5pZCk7XG5cblx0XHQvLyBPbmx5IHNob3cgc2VsZWN0aW9uIHdoZW4gdGhlcmUgaXMgbW9yZSB0aGFuIDEgY2VsbCBzZWxlY3RlZFxuXHRcdGF3YWl0IHRoaXMuX3dlYnZpZXc/LnVwZGF0ZU1hcmt1cFByZXZpZXdTZWxlY3Rpb25zKHNlbGVjdGVkQ2VsbHMubGVuZ3RoID4gMSA/IHNlbGVjdGVkQ2VsbHMgOiBbXSk7XG5cdH1cblxuXHRhc3luYyBjcmVhdGVPdXRwdXQoY2VsbDogQ29kZUNlbGxWaWV3TW9kZWwsIG91dHB1dDogSUluc2V0UmVuZGVyT3V0cHV0LCBvZmZzZXQ6IG51bWJlciwgY3JlYXRlV2hlbklkbGU6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9pbnNldE1vZGlmeVF1ZXVlQnlPdXRwdXRJZC5xdWV1ZShvdXRwdXQuc291cmNlLm1vZGVsLm91dHB1dElkLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCB8fCAhdGhpcy5fd2Vidmlldykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdGhpcy5fd2Vidmlldy5pc1Jlc29sdmVkKCkpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5fcmVzb2x2ZVdlYnZpZXcoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0aGlzLl93ZWJ2aWV3KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0aGlzLl9saXN0LndlYnZpZXdFbGVtZW50KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKG91dHB1dC50eXBlID09PSBSZW5kZXJPdXRwdXRUeXBlLkV4dGVuc2lvbikge1xuXHRcdFx0XHR0aGlzLm5vdGVib29rUmVuZGVyZXJNZXNzYWdpbmcucHJlcGFyZShvdXRwdXQucmVuZGVyZXIuaWQpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB3ZWJ2aWV3VG9wID0gcGFyc2VJbnQodGhpcy5fbGlzdC53ZWJ2aWV3RWxlbWVudC5kb21Ob2RlLnN0eWxlLnRvcCwgMTApO1xuXHRcdFx0Y29uc3QgdG9wID0gISF3ZWJ2aWV3VG9wID8gKDAgLSB3ZWJ2aWV3VG9wKSA6IDA7XG5cblx0XHRcdGNvbnN0IGNlbGxUb3AgPSB0aGlzLl9saXN0LmdldENlbGxWaWV3U2Nyb2xsVG9wKGNlbGwpICsgdG9wO1xuXG5cdFx0XHRjb25zdCBleGlzdGluZ091dHB1dCA9IHRoaXMuX3dlYnZpZXcuaW5zZXRNYXBwaW5nLmdldChvdXRwdXQuc291cmNlKTtcblx0XHRcdGlmICghZXhpc3RpbmdPdXRwdXRcblx0XHRcdFx0fHwgKCFleGlzdGluZ091dHB1dC5yZW5kZXJlciAmJiBvdXRwdXQudHlwZSA9PT0gUmVuZGVyT3V0cHV0VHlwZS5FeHRlbnNpb24pXG5cdFx0XHQpIHtcblx0XHRcdFx0aWYgKGNyZWF0ZVdoZW5JZGxlKSB7XG5cdFx0XHRcdFx0dGhpcy5fd2Vidmlldy5yZXF1ZXN0Q3JlYXRlT3V0cHV0V2hlbldlYnZpZXdJZGxlKHsgY2VsbElkOiBjZWxsLmlkLCBjZWxsSGFuZGxlOiBjZWxsLmhhbmRsZSwgY2VsbFVyaTogY2VsbC51cmksIGV4ZWN1dGlvbklkOiBjZWxsLmludGVybmFsTWV0YWRhdGEuZXhlY3V0aW9uSWQgfSwgb3V0cHV0LCBjZWxsVG9wLCBvZmZzZXQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuX3dlYnZpZXcuY3JlYXRlT3V0cHV0KHsgY2VsbElkOiBjZWxsLmlkLCBjZWxsSGFuZGxlOiBjZWxsLmhhbmRsZSwgY2VsbFVyaTogY2VsbC51cmksIGV4ZWN1dGlvbklkOiBjZWxsLmludGVybmFsTWV0YWRhdGEuZXhlY3V0aW9uSWQgfSwgb3V0cHV0LCBjZWxsVG9wLCBvZmZzZXQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKGV4aXN0aW5nT3V0cHV0LnJlbmRlcmVyXG5cdFx0XHRcdCYmIG91dHB1dC50eXBlID09PSBSZW5kZXJPdXRwdXRUeXBlLkV4dGVuc2lvblxuXHRcdFx0XHQmJiBleGlzdGluZ091dHB1dC5yZW5kZXJlci5pZCAhPT0gb3V0cHV0LnJlbmRlcmVyLmlkKSB7XG5cdFx0XHRcdC8vIHN3aXRjaCBtaW1ldHlwZVxuXHRcdFx0XHR0aGlzLl93ZWJ2aWV3LnJlbW92ZUluc2V0cyhbb3V0cHV0LnNvdXJjZV0pO1xuXHRcdFx0XHR0aGlzLl93ZWJ2aWV3LmNyZWF0ZU91dHB1dCh7IGNlbGxJZDogY2VsbC5pZCwgY2VsbEhhbmRsZTogY2VsbC5oYW5kbGUsIGNlbGxVcmk6IGNlbGwudXJpIH0sIG91dHB1dCwgY2VsbFRvcCwgb2Zmc2V0KTtcblx0XHRcdH0gZWxzZSBpZiAoZXhpc3RpbmdPdXRwdXQudmVyc2lvbklkICE9PSBvdXRwdXQuc291cmNlLm1vZGVsLnZlcnNpb25JZCkge1xuXHRcdFx0XHR0aGlzLl93ZWJ2aWV3LnVwZGF0ZU91dHB1dCh7IGNlbGxJZDogY2VsbC5pZCwgY2VsbEhhbmRsZTogY2VsbC5oYW5kbGUsIGNlbGxVcmk6IGNlbGwudXJpLCBleGVjdXRpb25JZDogY2VsbC5pbnRlcm5hbE1ldGFkYXRhLmV4ZWN1dGlvbklkIH0sIG91dHB1dCwgY2VsbFRvcCwgb2Zmc2V0KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IG91dHB1dEluZGV4ID0gY2VsbC5vdXRwdXRzVmlld01vZGVscy5pbmRleE9mKG91dHB1dC5zb3VyY2UpO1xuXHRcdFx0XHRjb25zdCBvdXRwdXRPZmZzZXQgPSBjZWxsLmdldE91dHB1dE9mZnNldChvdXRwdXRJbmRleCk7XG5cdFx0XHRcdHRoaXMuX3dlYnZpZXcudXBkYXRlU2Nyb2xsVG9wcyhbe1xuXHRcdFx0XHRcdGNlbGwsXG5cdFx0XHRcdFx0b3V0cHV0OiBvdXRwdXQuc291cmNlLFxuXHRcdFx0XHRcdGNlbGxUb3AsXG5cdFx0XHRcdFx0b3V0cHV0T2Zmc2V0LFxuXHRcdFx0XHRcdGZvcmNlRGlzcGxheTogIWNlbGwuaXNPdXRwdXRDb2xsYXBzZWQsXG5cdFx0XHRcdH1dLCBbXSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyB1cGRhdGVPdXRwdXQoY2VsbDogQ29kZUNlbGxWaWV3TW9kZWwsIG91dHB1dDogSUluc2V0UmVuZGVyT3V0cHV0LCBvZmZzZXQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX2luc2V0TW9kaWZ5UXVldWVCeU91dHB1dElkLnF1ZXVlKG91dHB1dC5zb3VyY2UubW9kZWwub3V0cHV0SWQsIGFzeW5jICgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkIHx8ICF0aGlzLl93ZWJ2aWV3IHx8IGNlbGwuaXNPdXRwdXRDb2xsYXBzZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXRoaXMuX3dlYnZpZXcuaXNSZXNvbHZlZCgpKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuX3Jlc29sdmVXZWJ2aWV3KCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdGhpcy5fd2VidmlldyB8fCAhdGhpcy5fbGlzdC53ZWJ2aWV3RWxlbWVudCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdGhpcy5fd2Vidmlldy5pbnNldE1hcHBpbmcuaGFzKG91dHB1dC5zb3VyY2UpKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmNyZWF0ZU91dHB1dChjZWxsLCBvdXRwdXQsIG9mZnNldCwgZmFsc2UpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAob3V0cHV0LnR5cGUgPT09IFJlbmRlck91dHB1dFR5cGUuRXh0ZW5zaW9uKSB7XG5cdFx0XHRcdHRoaXMubm90ZWJvb2tSZW5kZXJlck1lc3NhZ2luZy5wcmVwYXJlKG91dHB1dC5yZW5kZXJlci5pZCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHdlYnZpZXdUb3AgPSBwYXJzZUludCh0aGlzLl9saXN0LndlYnZpZXdFbGVtZW50LmRvbU5vZGUuc3R5bGUudG9wLCAxMCk7XG5cdFx0XHRjb25zdCB0b3AgPSAhIXdlYnZpZXdUb3AgPyAoMCAtIHdlYnZpZXdUb3ApIDogMDtcblxuXHRcdFx0Y29uc3QgY2VsbFRvcCA9IHRoaXMuX2xpc3QuZ2V0Q2VsbFZpZXdTY3JvbGxUb3AoY2VsbCkgKyB0b3A7XG5cdFx0XHR0aGlzLl93ZWJ2aWV3LnVwZGF0ZU91dHB1dCh7IGNlbGxJZDogY2VsbC5pZCwgY2VsbEhhbmRsZTogY2VsbC5oYW5kbGUsIGNlbGxVcmk6IGNlbGwudXJpIH0sIG91dHB1dCwgY2VsbFRvcCwgb2Zmc2V0KTtcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIGNvcHlPdXRwdXRJbWFnZShjZWxsT3V0cHV0OiBJQ2VsbE91dHB1dFZpZXdNb2RlbCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3dlYnZpZXc/LmNvcHlJbWFnZShjZWxsT3V0cHV0KTtcblx0fVxuXG5cdHJlbW92ZUluc2V0KG91dHB1dDogSUNlbGxPdXRwdXRWaWV3TW9kZWwpIHtcblx0XHR0aGlzLl9pbnNldE1vZGlmeVF1ZXVlQnlPdXRwdXRJZC5xdWV1ZShvdXRwdXQubW9kZWwub3V0cHV0SWQsIGFzeW5jICgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkIHx8ICF0aGlzLl93ZWJ2aWV3KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuX3dlYnZpZXc/LmlzUmVzb2x2ZWQoKSkge1xuXHRcdFx0XHR0aGlzLl93ZWJ2aWV3LnJlbW92ZUluc2V0cyhbb3V0cHV0XSk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX29uRGlkUmVtb3ZlT3V0cHV0LmZpcmUob3V0cHV0KTtcblx0XHR9KTtcblx0fVxuXG5cdGhpZGVJbnNldChvdXRwdXQ6IElDZWxsT3V0cHV0Vmlld01vZGVsKSB7XG5cdFx0dGhpcy5faW5zZXRNb2RpZnlRdWV1ZUJ5T3V0cHV0SWQucXVldWUob3V0cHV0Lm1vZGVsLm91dHB1dElkLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCB8fCAhdGhpcy5fd2Vidmlldykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLl93ZWJ2aWV3Py5pc1Jlc29sdmVkKCkpIHtcblx0XHRcdFx0dGhpcy5fd2Vidmlldy5oaWRlSW5zZXQob3V0cHV0KTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdC8vI3JlZ2lvbiAtLS0gd2VidmlldyBJUEMgLS0tLVxuXHRwb3N0TWVzc2FnZShtZXNzYWdlOiBhbnkpIHtcblx0XHRpZiAodGhpcy5fd2Vidmlldz8uaXNSZXNvbHZlZCgpKSB7XG5cdFx0XHR0aGlzLl93ZWJ2aWV3LnBvc3RLZXJuZWxNZXNzYWdlKG1lc3NhZ2UpO1xuXHRcdH1cblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdGFkZENsYXNzTmFtZShjbGFzc05hbWU6IHN0cmluZykge1xuXHRcdHRoaXMuX292ZXJsYXlDb250YWluZXIuY2xhc3NMaXN0LmFkZChjbGFzc05hbWUpO1xuXHR9XG5cblx0cmVtb3ZlQ2xhc3NOYW1lKGNsYXNzTmFtZTogc3RyaW5nKSB7XG5cdFx0dGhpcy5fb3ZlcmxheUNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKGNsYXNzTmFtZSk7XG5cdH1cblxuXHRjZWxsQXQoaW5kZXg6IG51bWJlcik6IElDZWxsVmlld01vZGVsIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3TW9kZWw/LmNlbGxBdChpbmRleCk7XG5cdH1cblxuXHRnZXRDZWxsQnlJbmZvKGNlbGxJbmZvOiBJQ29tbW9uQ2VsbEluZm8pOiBJQ2VsbFZpZXdNb2RlbCB7XG5cdFx0Y29uc3QgeyBjZWxsSGFuZGxlIH0gPSBjZWxsSW5mbztcblx0XHRyZXR1cm4gdGhpcy52aWV3TW9kZWw/LnZpZXdDZWxscy5maW5kKHZjID0+IHZjLmhhbmRsZSA9PT0gY2VsbEhhbmRsZSkgYXMgQ29kZUNlbGxWaWV3TW9kZWw7XG5cdH1cblxuXHRnZXRDZWxsQnlIYW5kbGUoaGFuZGxlOiBudW1iZXIpOiBJQ2VsbFZpZXdNb2RlbCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMudmlld01vZGVsPy5nZXRDZWxsQnlIYW5kbGUoaGFuZGxlKTtcblx0fVxuXG5cdGdldENlbGxJbmRleChjZWxsOiBJQ2VsbFZpZXdNb2RlbCkge1xuXHRcdHJldHVybiB0aGlzLnZpZXdNb2RlbD8uZ2V0Q2VsbEluZGV4QnlIYW5kbGUoY2VsbC5oYW5kbGUpO1xuXHR9XG5cblx0Z2V0TmV4dFZpc2libGVDZWxsSW5kZXgoaW5kZXg6IG51bWJlcik6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMudmlld01vZGVsPy5nZXROZXh0VmlzaWJsZUNlbGxJbmRleChpbmRleCk7XG5cdH1cblxuXHRnZXRQcmV2aW91c1Zpc2libGVDZWxsSW5kZXgoaW5kZXg6IG51bWJlcik6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMudmlld01vZGVsPy5nZXRQcmV2aW91c1Zpc2libGVDZWxsSW5kZXgoaW5kZXgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlU2Nyb2xsSGVpZ2h0KCkge1xuXHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkIHx8ICF0aGlzLl93ZWJ2aWV3Py5pc1Jlc29sdmVkKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuX2xpc3Qud2Vidmlld0VsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzY3JvbGxIZWlnaHQgPSB0aGlzLl9saXN0LnNjcm9sbEhlaWdodDtcblx0XHR0aGlzLl93ZWJ2aWV3LmVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gYCR7c2Nyb2xsSGVpZ2h0ICsgTk9URUJPT0tfV0VCVklFV19CT1VOREFSWSAqIDJ9cHhgO1xuXG5cdFx0Y29uc3Qgd2Vidmlld1RvcCA9IHBhcnNlSW50KHRoaXMuX2xpc3Qud2Vidmlld0VsZW1lbnQuZG9tTm9kZS5zdHlsZS50b3AsIDEwKTtcblx0XHRjb25zdCB0b3AgPSAhIXdlYnZpZXdUb3AgPyAoMCAtIHdlYnZpZXdUb3ApIDogMDtcblxuXHRcdGNvbnN0IHVwZGF0ZUl0ZW1zOiBJRGlzcGxheU91dHB1dExheW91dFVwZGF0ZVJlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IHJlbW92ZWRJdGVtczogSUNlbGxPdXRwdXRWaWV3TW9kZWxbXSA9IFtdO1xuXHRcdHRoaXMuX3dlYnZpZXc/Lmluc2V0TWFwcGluZy5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiB7XG5cdFx0XHRjb25zdCBjZWxsID0gdGhpcy52aWV3TW9kZWw/LmdldENlbGxCeUhhbmRsZSh2YWx1ZS5jZWxsSW5mby5jZWxsSGFuZGxlKTtcblx0XHRcdGlmICghY2VsbCB8fCAhKGNlbGwgaW5zdGFuY2VvZiBDb2RlQ2VsbFZpZXdNb2RlbCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnZpZXdNb2RlbD8udmlld0NlbGxzLmZpbmQoY2VsbCA9PiBjZWxsLmhhbmRsZSA9PT0gdmFsdWUuY2VsbEluZm8uY2VsbEhhbmRsZSk7XG5cdFx0XHRjb25zdCB2aWV3SW5kZXggPSB0aGlzLl9saXN0LmdldFZpZXdJbmRleChjZWxsKTtcblxuXHRcdFx0aWYgKHZpZXdJbmRleCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGNlbGwub3V0cHV0c1ZpZXdNb2RlbHMuaW5kZXhPZihrZXkpIDwgMCkge1xuXHRcdFx0XHQvLyBvdXRwdXQgaXMgYWxyZWFkeSBnb25lXG5cdFx0XHRcdHJlbW92ZWRJdGVtcy5wdXNoKGtleSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNlbGxUb3AgPSB0aGlzLl9saXN0LmdldENlbGxWaWV3U2Nyb2xsVG9wKGNlbGwpO1xuXHRcdFx0Y29uc3Qgb3V0cHV0SW5kZXggPSBjZWxsLm91dHB1dHNWaWV3TW9kZWxzLmluZGV4T2Yoa2V5KTtcblx0XHRcdGNvbnN0IG91dHB1dE9mZnNldCA9IGNlbGwuZ2V0T3V0cHV0T2Zmc2V0KG91dHB1dEluZGV4KTtcblx0XHRcdHVwZGF0ZUl0ZW1zLnB1c2goe1xuXHRcdFx0XHRjZWxsLFxuXHRcdFx0XHRvdXRwdXQ6IGtleSxcblx0XHRcdFx0Y2VsbFRvcDogY2VsbFRvcCArIHRvcCxcblx0XHRcdFx0b3V0cHV0T2Zmc2V0LFxuXHRcdFx0XHRmb3JjZURpc3BsYXk6IGZhbHNlLFxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl93ZWJ2aWV3LnJlbW92ZUluc2V0cyhyZW1vdmVkSXRlbXMpO1xuXG5cdFx0Y29uc3QgbWFya2Rvd25VcGRhdGVJdGVtczogeyBpZDogc3RyaW5nOyB0b3A6IG51bWJlciB9W10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGNlbGxJZCBvZiB0aGlzLl93ZWJ2aWV3Lm1hcmt1cFByZXZpZXdNYXBwaW5nLmtleXMoKSkge1xuXHRcdFx0Y29uc3QgY2VsbCA9IHRoaXMudmlld01vZGVsPy52aWV3Q2VsbHMuZmluZChjZWxsID0+IGNlbGwuaWQgPT09IGNlbGxJZCk7XG5cdFx0XHRpZiAoY2VsbCkge1xuXHRcdFx0XHRjb25zdCBjZWxsVG9wID0gdGhpcy5fbGlzdC5nZXRDZWxsVmlld1Njcm9sbFRvcChjZWxsKTtcblx0XHRcdFx0Ly8gbWFya2Rvd25VcGRhdGVJdGVtcy5wdXNoKHsgaWQ6IGNlbGxJZCwgdG9wOiBjZWxsVG9wIH0pO1xuXHRcdFx0XHRtYXJrZG93blVwZGF0ZUl0ZW1zLnB1c2goeyBpZDogY2VsbElkLCB0b3A6IGNlbGxUb3AgKyB0b3AgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKG1hcmtkb3duVXBkYXRlSXRlbXMubGVuZ3RoIHx8IHVwZGF0ZUl0ZW1zLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5fZGVidWcoJ19saXN0Lm9uRGlkQ2hhbmdlQ29udGVudEhlaWdodC9tYXJrZG93bicsIG1hcmtkb3duVXBkYXRlSXRlbXMpO1xuXHRcdFx0dGhpcy5fd2Vidmlldz8udXBkYXRlU2Nyb2xsVG9wcyh1cGRhdGVJdGVtcywgbWFya2Rvd25VcGRhdGVJdGVtcyk7XG5cdFx0fVxuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIEJhY2tsYXllcldlYnZpZXcgZGVsZWdhdGVcblx0cHJpdmF0ZSBfdXBkYXRlT3V0cHV0SGVpZ2h0KGNlbGxJbmZvOiBJQ29tbW9uQ2VsbEluZm8sIG91dHB1dDogSUNlbGxPdXRwdXRWaWV3TW9kZWwsIG91dHB1dEhlaWdodDogbnVtYmVyLCBpc0luaXQ6IGJvb2xlYW4sIHNvdXJjZT86IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IGNlbGwgPSB0aGlzLnZpZXdNb2RlbD8udmlld0NlbGxzLmZpbmQodmMgPT4gdmMuaGFuZGxlID09PSBjZWxsSW5mby5jZWxsSGFuZGxlKTtcblx0XHRpZiAoY2VsbCAmJiBjZWxsIGluc3RhbmNlb2YgQ29kZUNlbGxWaWV3TW9kZWwpIHtcblx0XHRcdGNvbnN0IG91dHB1dEluZGV4ID0gY2VsbC5vdXRwdXRzVmlld01vZGVscy5pbmRleE9mKG91dHB1dCk7XG5cdFx0XHRpZiAob3V0cHV0SW5kZXggPiAtMSkge1xuXHRcdFx0XHR0aGlzLl9kZWJ1ZygndXBkYXRlIGNlbGwgb3V0cHV0JywgY2VsbC5oYW5kbGUsIG91dHB1dEhlaWdodCk7XG5cdFx0XHRcdGNlbGwudXBkYXRlT3V0cHV0SGVpZ2h0KG91dHB1dEluZGV4LCBvdXRwdXRIZWlnaHQsIHNvdXJjZSk7XG5cdFx0XHRcdHRoaXMubGF5b3V0Tm90ZWJvb2tDZWxsKGNlbGwsIGNlbGwubGF5b3V0SW5mby50b3RhbEhlaWdodCk7XG5cblx0XHRcdFx0aWYgKGlzSW5pdCkge1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkUmVuZGVyT3V0cHV0LmZpcmUob3V0cHV0KTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fZGVidWcoJ3RyaWVkIHRvIHVwZGF0ZSBjZWxsIG91dHB1dCB0aGF0IGRvZXMgbm90IGV4aXN0Jyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcGVuZGluZ091dHB1dEhlaWdodEFja3MgPSBuZXcgTWFwPC8qIG91dHB1dElkICovIHN0cmluZywgSUFja091dHB1dEhlaWdodD4oKTtcblxuXHRwcml2YXRlIF9zY2hlZHVsZU91dHB1dEhlaWdodEFjayhjZWxsSW5mbzogSUNvbW1vbkNlbGxJbmZvLCBvdXRwdXRJZDogc3RyaW5nLCBoZWlnaHQ6IG51bWJlcikge1xuXHRcdGNvbnN0IHdhc0VtcHR5ID0gdGhpcy5fcGVuZGluZ091dHB1dEhlaWdodEFja3Muc2l6ZSA9PT0gMDtcblx0XHR0aGlzLl9wZW5kaW5nT3V0cHV0SGVpZ2h0QWNrcy5zZXQob3V0cHV0SWQsIHsgY2VsbElkOiBjZWxsSW5mby5jZWxsSWQsIG91dHB1dElkLCBoZWlnaHQgfSk7XG5cblx0XHRpZiAod2FzRW1wdHkpIHtcblx0XHRcdERPTS5zY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lKERPTS5nZXRXaW5kb3codGhpcy5nZXREb21Ob2RlKCkpLCAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX2RlYnVnKCdhY2sgaGVpZ2h0Jyk7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZVNjcm9sbEhlaWdodCgpO1xuXG5cdFx0XHRcdHRoaXMuX3dlYnZpZXc/LmFja0hlaWdodChbLi4udGhpcy5fcGVuZGluZ091dHB1dEhlaWdodEFja3MudmFsdWVzKCldKTtcblxuXHRcdFx0XHR0aGlzLl9wZW5kaW5nT3V0cHV0SGVpZ2h0QWNrcy5jbGVhcigpO1xuXHRcdFx0fSwgLTEpOyAvLyAtMSBwcmlvcml0eSBiZWNhdXNlIHRoaXMgZGVwZW5kcyBvbiBjYWxscyB0byBsYXlvdXROb3RlYm9va0NlbGwsIGFuZCB0aGF0IG1heSBiZSBjYWxsZWQgbXVsdGlwbGUgdGltZXMgYmVmb3JlIHRoaXMgcnVuc1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2dldENlbGxCeUlkKGNlbGxJZDogc3RyaW5nKTogSUNlbGxWaWV3TW9kZWwgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnZpZXdNb2RlbD8udmlld0NlbGxzLmZpbmQodmMgPT4gdmMuaWQgPT09IGNlbGxJZCk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVNYXJrdXBDZWxsSGVpZ2h0KGNlbGxJZDogc3RyaW5nLCBoZWlnaHQ6IG51bWJlciwgaXNJbml0OiBib29sZWFuKSB7XG5cdFx0Y29uc3QgY2VsbCA9IHRoaXMuX2dldENlbGxCeUlkKGNlbGxJZCk7XG5cdFx0aWYgKGNlbGwgJiYgY2VsbCBpbnN0YW5jZW9mIE1hcmt1cENlbGxWaWV3TW9kZWwpIHtcblx0XHRcdGNvbnN0IHsgYm90dG9tVG9vbGJhckdhcCB9ID0gdGhpcy5fbm90ZWJvb2tPcHRpb25zLmNvbXB1dGVCb3R0b21Ub29sYmFyRGltZW5zaW9ucyh0aGlzLnZpZXdNb2RlbD8udmlld1R5cGUpO1xuXHRcdFx0dGhpcy5fZGVidWcoJ3VwZGF0ZU1hcmtkb3duQ2VsbEhlaWdodCcsIGNlbGwuaGFuZGxlLCBoZWlnaHQgKyBib3R0b21Ub29sYmFyR2FwLCBpc0luaXQpO1xuXHRcdFx0Y2VsbC5yZW5kZXJlZE1hcmtkb3duSGVpZ2h0ID0gaGVpZ2h0O1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3NldE1hcmt1cENlbGxFZGl0U3RhdGUoY2VsbElkOiBzdHJpbmcsIGVkaXRTdGF0ZTogQ2VsbEVkaXRTdGF0ZSk6IHZvaWQge1xuXHRcdGNvbnN0IGNlbGwgPSB0aGlzLl9nZXRDZWxsQnlJZChjZWxsSWQpO1xuXHRcdGlmIChjZWxsIGluc3RhbmNlb2YgTWFya3VwQ2VsbFZpZXdNb2RlbCkge1xuXHRcdFx0dGhpcy5yZXZlYWxJblZpZXcoY2VsbCk7XG5cdFx0XHRjZWxsLnVwZGF0ZUVkaXRTdGF0ZShlZGl0U3RhdGUsICdzZXRNYXJrZG93bkNlbGxFZGl0U3RhdGUnKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9kaWRTdGFydERyYWdNYXJrdXBDZWxsKGNlbGxJZDogc3RyaW5nLCBldmVudDogeyBkcmFnT2Zmc2V0WTogbnVtYmVyIH0pOiB2b2lkIHtcblx0XHRjb25zdCBjZWxsID0gdGhpcy5fZ2V0Q2VsbEJ5SWQoY2VsbElkKTtcblx0XHRpZiAoY2VsbCBpbnN0YW5jZW9mIE1hcmt1cENlbGxWaWV3TW9kZWwpIHtcblx0XHRcdGNvbnN0IHdlYnZpZXdPZmZzZXQgPSB0aGlzLl9saXN0LndlYnZpZXdFbGVtZW50ID8gLXBhcnNlSW50KHRoaXMuX2xpc3Qud2Vidmlld0VsZW1lbnQuZG9tTm9kZS5zdHlsZS50b3AsIDEwKSA6IDA7XG5cdFx0XHR0aGlzLl9kbmRDb250cm9sbGVyPy5zdGFydEV4cGxpY2l0RHJhZyhjZWxsLCBldmVudC5kcmFnT2Zmc2V0WSAtIHdlYnZpZXdPZmZzZXQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2RpZERyYWdNYXJrdXBDZWxsKGNlbGxJZDogc3RyaW5nLCBldmVudDogeyBkcmFnT2Zmc2V0WTogbnVtYmVyIH0pOiB2b2lkIHtcblx0XHRjb25zdCBjZWxsID0gdGhpcy5fZ2V0Q2VsbEJ5SWQoY2VsbElkKTtcblx0XHRpZiAoY2VsbCBpbnN0YW5jZW9mIE1hcmt1cENlbGxWaWV3TW9kZWwpIHtcblx0XHRcdGNvbnN0IHdlYnZpZXdPZmZzZXQgPSB0aGlzLl9saXN0LndlYnZpZXdFbGVtZW50ID8gLXBhcnNlSW50KHRoaXMuX2xpc3Qud2Vidmlld0VsZW1lbnQuZG9tTm9kZS5zdHlsZS50b3AsIDEwKSA6IDA7XG5cdFx0XHR0aGlzLl9kbmRDb250cm9sbGVyPy5leHBsaWNpdERyYWcoY2VsbCwgZXZlbnQuZHJhZ09mZnNldFkgLSB3ZWJ2aWV3T2Zmc2V0KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9kaWREcm9wTWFya3VwQ2VsbChjZWxsSWQ6IHN0cmluZywgZXZlbnQ6IHsgZHJhZ09mZnNldFk6IG51bWJlcjsgY3RybEtleTogYm9vbGVhbjsgYWx0S2V5OiBib29sZWFuIH0pOiB2b2lkIHtcblx0XHRjb25zdCBjZWxsID0gdGhpcy5fZ2V0Q2VsbEJ5SWQoY2VsbElkKTtcblx0XHRpZiAoY2VsbCBpbnN0YW5jZW9mIE1hcmt1cENlbGxWaWV3TW9kZWwpIHtcblx0XHRcdGNvbnN0IHdlYnZpZXdPZmZzZXQgPSB0aGlzLl9saXN0LndlYnZpZXdFbGVtZW50ID8gLXBhcnNlSW50KHRoaXMuX2xpc3Qud2Vidmlld0VsZW1lbnQuZG9tTm9kZS5zdHlsZS50b3AsIDEwKSA6IDA7XG5cdFx0XHRldmVudC5kcmFnT2Zmc2V0WSAtPSB3ZWJ2aWV3T2Zmc2V0O1xuXHRcdFx0dGhpcy5fZG5kQ29udHJvbGxlcj8uZXhwbGljaXREcm9wKGNlbGwsIGV2ZW50KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9kaWRFbmREcmFnTWFya3VwQ2VsbChjZWxsSWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IGNlbGwgPSB0aGlzLl9nZXRDZWxsQnlJZChjZWxsSWQpO1xuXHRcdGlmIChjZWxsIGluc3RhbmNlb2YgTWFya3VwQ2VsbFZpZXdNb2RlbCkge1xuXHRcdFx0dGhpcy5fZG5kQ29udHJvbGxlcj8uZW5kRXhwbGljaXREcmFnKGNlbGwpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2RpZFJlc2l6ZU91dHB1dChjZWxsSWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IGNlbGwgPSB0aGlzLl9nZXRDZWxsQnlJZChjZWxsSWQpO1xuXHRcdGlmIChjZWxsKSB7XG5cdFx0XHR0aGlzLl9vbkRpZFJlc2l6ZU91dHB1dEVtaXR0ZXIuZmlyZShjZWxsKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVQZXJmb3JtYW5jZU1ldGFkYXRhKGNlbGxJZDogc3RyaW5nLCBleGVjdXRpb25JZDogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyLCByZW5kZXJlcklkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNlbGwgPSB0aGlzLl9nZXRDZWxsQnlJZChjZWxsSWQpO1xuXHRcdGNvbnN0IGNlbGxJbmRleCA9ICFjZWxsID8gdW5kZWZpbmVkIDogdGhpcy5nZXRDZWxsSW5kZXgoY2VsbCk7XG5cdFx0aWYgKGNlbGw/LmludGVybmFsTWV0YWRhdGEuZXhlY3V0aW9uSWQgPT09IGV4ZWN1dGlvbklkICYmIGNlbGxJbmRleCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb25zdCByZW5kZXJEdXJhdGlvbk1hcCA9IGNlbGwuaW50ZXJuYWxNZXRhZGF0YS5yZW5kZXJEdXJhdGlvbiB8fCB7fTtcblx0XHRcdHJlbmRlckR1cmF0aW9uTWFwW3JlbmRlcmVySWRdID0gKHJlbmRlckR1cmF0aW9uTWFwW3JlbmRlcmVySWRdID8/IDApICsgZHVyYXRpb247XG5cblx0XHRcdHRoaXMudGV4dE1vZGVsLmFwcGx5RWRpdHMoW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5QYXJ0aWFsSW50ZXJuYWxNZXRhZGF0YSxcblx0XHRcdFx0XHRpbmRleDogY2VsbEluZGV4LFxuXHRcdFx0XHRcdGludGVybmFsTWV0YWRhdGE6IHtcblx0XHRcdFx0XHRcdGV4ZWN1dGlvbklkOiBleGVjdXRpb25JZCxcblx0XHRcdFx0XHRcdHJlbmRlckR1cmF0aW9uOiByZW5kZXJEdXJhdGlvbk1hcFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XSwgdHJ1ZSwgdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZmFsc2UpO1xuXG5cdFx0fVxuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIEVkaXRvciBDb250cmlidXRpb25zXG5cdGdldENvbnRyaWJ1dGlvbjxUIGV4dGVuZHMgSU5vdGVib29rRWRpdG9yQ29udHJpYnV0aW9uPihpZDogc3RyaW5nKTogVCB7XG5cdFx0cmV0dXJuIDxUPih0aGlzLl9jb250cmlidXRpb25zLmdldChpZCkgfHwgbnVsbCk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHRvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdHRoaXMuX2lzRGlzcG9zZWQgPSB0cnVlO1xuXHRcdC8vIGRpc3Bvc2Ugd2VidmlldyBmaXJzdFxuXHRcdHRoaXMuX3dlYnZpZXc/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl93ZWJ2aWV3ID0gbnVsbDtcblxuXHRcdHRoaXMuX2xheW91dERpc3Bvc2FibGVzLmZvckVhY2goZCA9PiBkLmRpc3Bvc2UoKSk7XG5cblx0XHR0aGlzLm5vdGVib29rRWRpdG9yU2VydmljZS5yZW1vdmVOb3RlYm9va0VkaXRvcih0aGlzKTtcblx0XHRkaXNwb3NlKHRoaXMuX2NvbnRyaWJ1dGlvbnMudmFsdWVzKCkpO1xuXHRcdHRoaXMuX2NvbnRyaWJ1dGlvbnMuY2xlYXIoKTtcblxuXHRcdHRoaXMuX2xvY2FsU3RvcmUuY2xlYXIoKTtcblx0XHRkaXNwb3NlKHRoaXMuX2xvY2FsQ2VsbFN0YXRlTGlzdGVuZXJzKTtcblx0XHR0aGlzLl9saXN0LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9saXN0VG9wQ2VsbFRvb2xiYXI/LmRpc3Bvc2UoKTtcblxuXHRcdHRoaXMuX292ZXJsYXlDb250YWluZXIucmVtb3ZlKCk7XG5cdFx0dGhpcy52aWV3TW9kZWw/LmRpc3Bvc2UoKTtcblxuXHRcdHRoaXMuX3JlbmRlcmVkRWRpdG9ycy5jbGVhcigpO1xuXHRcdHRoaXMuX2Jhc2VDZWxsRWRpdG9yT3B0aW9ucy5mb3JFYWNoKHYgPT4gdi5kaXNwb3NlKCkpO1xuXHRcdHRoaXMuX2Jhc2VDZWxsRWRpdG9yT3B0aW9ucy5jbGVhcigpO1xuXG5cdFx0dGhpcy5fbm90ZWJvb2tPdmVydmlld1J1bGVyQ29udGFpbmVyLnJlbW92ZSgpO1xuXG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXG5cdFx0Ly8gdW5yZWZcblx0XHR0aGlzLl93ZWJ2aWV3ID0gbnVsbDtcblx0XHR0aGlzLl93ZWJ2aWV3UmVzb2x2ZVByb21pc2UgPSBudWxsO1xuXHRcdHRoaXMuX3dlYnZpZXdUcmFuc3BhcmVudENvdmVyID0gbnVsbDtcblx0XHR0aGlzLl9kbmRDb250cm9sbGVyID0gbnVsbDtcblx0XHR0aGlzLl9saXN0VG9wQ2VsbFRvb2xiYXIgPSBudWxsO1xuXHRcdHRoaXMuX25vdGVib29rVmlld01vZGVsID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX2NlbGxDb250ZXh0S2V5TWFuYWdlciA9IG51bGw7XG5cdFx0dGhpcy5fbm90ZWJvb2tUb3BUb29sYmFyID0gbnVsbCE7XG5cdFx0dGhpcy5fbGlzdCA9IG51bGwhO1xuXHRcdHRoaXMuX2xpc3RWaWV3SW5mb0FjY2Vzc29yID0gbnVsbCE7XG5cdFx0dGhpcy5fcGVuZGluZ0xheW91dHMgPSBudWxsO1xuXHRcdHRoaXMuX2xpc3REZWxlZ2F0ZSA9IG51bGw7XG5cdH1cblxuXHR0b0pTT04oKTogeyBub3RlYm9va1VyaTogVVJJIHwgdW5kZWZpbmVkIH0ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRub3RlYm9va1VyaTogdGhpcy52aWV3TW9kZWw/LnVyaSxcblx0XHR9O1xuXHR9XG59XG5cbnJlZ2lzdGVyWkluZGV4KFpJbmRleC5CYXNlLCA1LCAnbm90ZWJvb2stcHJvZ3Jlc3MtYmFyJywpO1xucmVnaXN0ZXJaSW5kZXgoWkluZGV4LkJhc2UsIDEwLCAnbm90ZWJvb2stbGlzdC1pbnNlcnRpb24taW5kaWNhdG9yJyk7XG5yZWdpc3RlclpJbmRleChaSW5kZXguQmFzZSwgMjAsICdub3RlYm9vay1jZWxsLWVkaXRvci1vdXRsaW5lJyk7XG5yZWdpc3RlclpJbmRleChaSW5kZXguQmFzZSwgMjUsICdub3RlYm9vay1zY3JvbGxiYXInKTtcbnJlZ2lzdGVyWkluZGV4KFpJbmRleC5CYXNlLCAyNiwgJ25vdGVib29rLWNlbGwtc3RhdHVzJyk7XG5yZWdpc3RlclpJbmRleChaSW5kZXguQmFzZSwgMjYsICdub3RlYm9vay1mb2xkaW5nLWluZGljYXRvcicpO1xucmVnaXN0ZXJaSW5kZXgoWkluZGV4LkJhc2UsIDI3LCAnbm90ZWJvb2stb3V0cHV0Jyk7XG5yZWdpc3RlclpJbmRleChaSW5kZXguQmFzZSwgMjgsICdub3RlYm9vay1jZWxsLWJvdHRvbS10b29sYmFyLWNvbnRhaW5lcicpO1xucmVnaXN0ZXJaSW5kZXgoWkluZGV4LkJhc2UsIDI5LCAnbm90ZWJvb2stcnVuLWJ1dHRvbi1jb250YWluZXInKTtcbnJlZ2lzdGVyWkluZGV4KFpJbmRleC5CYXNlLCAyOSwgJ25vdGVib29rLWlucHV0LWNvbGxhcHNlLWNvbmRpY29uJyk7XG5yZWdpc3RlclpJbmRleChaSW5kZXguQmFzZSwgMzAsICdub3RlYm9vay1jZWxsLW91dHB1dC10b29sYmFyJyk7XG5yZWdpc3RlclpJbmRleChaSW5kZXguU2FzaCwgMSwgJ25vdGVib29rLWNlbGwtZXhwYW5kLXBhcnQtYnV0dG9uJyk7XG5yZWdpc3RlclpJbmRleChaSW5kZXguU2FzaCwgMiwgJ25vdGVib29rLWNlbGwtdG9vbGJhcicpO1xucmVnaXN0ZXJaSW5kZXgoWkluZGV4LlNhc2gsIDMsICdub3RlYm9vay1jZWxsLXRvb2xiYXItZHJvcGRvd24tYWN0aXZlJyk7XG5cbmV4cG9ydCBjb25zdCBub3RlYm9va0NlbGxCb3JkZXIgPSByZWdpc3RlckNvbG9yKCdub3RlYm9vay5jZWxsQm9yZGVyQ29sb3InLCB7XG5cdGRhcms6IHRyYW5zcGFyZW50KGxpc3RJbmFjdGl2ZVNlbGVjdGlvbkJhY2tncm91bmQsIDEpLFxuXHRsaWdodDogdHJhbnNwYXJlbnQobGlzdEluYWN0aXZlU2VsZWN0aW9uQmFja2dyb3VuZCwgMSksXG5cdGhjRGFyazogUEFORUxfQk9SREVSLFxuXHRoY0xpZ2h0OiBQQU5FTF9CT1JERVJcbn0sIG5scy5sb2NhbGl6ZSgnbm90ZWJvb2suY2VsbEJvcmRlckNvbG9yJywgXCJUaGUgYm9yZGVyIGNvbG9yIGZvciBub3RlYm9vayBjZWxscy5cIikpO1xuXG5leHBvcnQgY29uc3QgZm9jdXNlZEVkaXRvckJvcmRlckNvbG9yID0gcmVnaXN0ZXJDb2xvcignbm90ZWJvb2suZm9jdXNlZEVkaXRvckJvcmRlcicsIGZvY3VzQm9yZGVyLCBubHMubG9jYWxpemUoJ25vdGVib29rLmZvY3VzZWRFZGl0b3JCb3JkZXInLCBcIlRoZSBjb2xvciBvZiB0aGUgbm90ZWJvb2sgY2VsbCBlZGl0b3IgYm9yZGVyLlwiKSk7XG5cbmV4cG9ydCBjb25zdCBjZWxsU3RhdHVzSWNvblN1Y2Nlc3MgPSByZWdpc3RlckNvbG9yKCdub3RlYm9va1N0YXR1c1N1Y2Nlc3NJY29uLmZvcmVncm91bmQnLCBkZWJ1Z0ljb25TdGFydEZvcmVncm91bmQsIG5scy5sb2NhbGl6ZSgnbm90ZWJvb2tTdGF0dXNTdWNjZXNzSWNvbi5mb3JlZ3JvdW5kJywgXCJUaGUgZXJyb3IgaWNvbiBjb2xvciBvZiBub3RlYm9vayBjZWxscyBpbiB0aGUgY2VsbCBzdGF0dXMgYmFyLlwiKSk7XG5cbmV4cG9ydCBjb25zdCBydW5uaW5nQ2VsbFJ1bGVyRGVjb3JhdGlvbkNvbG9yID0gcmVnaXN0ZXJDb2xvcignbm90ZWJvb2tFZGl0b3JPdmVydmlld1J1bGVyLnJ1bm5pbmdDZWxsRm9yZWdyb3VuZCcsIGRlYnVnSWNvblN0YXJ0Rm9yZWdyb3VuZCwgbmxzLmxvY2FsaXplKCdub3RlYm9va0VkaXRvck92ZXJ2aWV3UnVsZXIucnVubmluZ0NlbGxGb3JlZ3JvdW5kJywgXCJUaGUgY29sb3Igb2YgdGhlIHJ1bm5pbmcgY2VsbCBkZWNvcmF0aW9uIGluIHRoZSBub3RlYm9vayBlZGl0b3Igb3ZlcnZpZXcgcnVsZXIuXCIpKTtcblxuZXhwb3J0IGNvbnN0IGNlbGxTdGF0dXNJY29uRXJyb3IgPSByZWdpc3RlckNvbG9yKCdub3RlYm9va1N0YXR1c0Vycm9ySWNvbi5mb3JlZ3JvdW5kJywgZXJyb3JGb3JlZ3JvdW5kLCBubHMubG9jYWxpemUoJ25vdGVib29rU3RhdHVzRXJyb3JJY29uLmZvcmVncm91bmQnLCBcIlRoZSBlcnJvciBpY29uIGNvbG9yIG9mIG5vdGVib29rIGNlbGxzIGluIHRoZSBjZWxsIHN0YXR1cyBiYXIuXCIpKTtcblxuZXhwb3J0IGNvbnN0IGNlbGxTdGF0dXNJY29uUnVubmluZyA9IHJlZ2lzdGVyQ29sb3IoJ25vdGVib29rU3RhdHVzUnVubmluZ0ljb24uZm9yZWdyb3VuZCcsIGZvcmVncm91bmQsIG5scy5sb2NhbGl6ZSgnbm90ZWJvb2tTdGF0dXNSdW5uaW5nSWNvbi5mb3JlZ3JvdW5kJywgXCJUaGUgcnVubmluZyBpY29uIGNvbG9yIG9mIG5vdGVib29rIGNlbGxzIGluIHRoZSBjZWxsIHN0YXR1cyBiYXIuXCIpKTtcblxuZXhwb3J0IGNvbnN0IG5vdGVib29rT3V0cHV0Q29udGFpbmVyQm9yZGVyQ29sb3IgPSByZWdpc3RlckNvbG9yKCdub3RlYm9vay5vdXRwdXRDb250YWluZXJCb3JkZXJDb2xvcicsIG51bGwsIG5scy5sb2NhbGl6ZSgnbm90ZWJvb2sub3V0cHV0Q29udGFpbmVyQm9yZGVyQ29sb3InLCBcIlRoZSBib3JkZXIgY29sb3Igb2YgdGhlIG5vdGVib29rIG91dHB1dCBjb250YWluZXIuXCIpKTtcblxuZXhwb3J0IGNvbnN0IG5vdGVib29rT3V0cHV0Q29udGFpbmVyQ29sb3IgPSByZWdpc3RlckNvbG9yKCdub3RlYm9vay5vdXRwdXRDb250YWluZXJCYWNrZ3JvdW5kQ29sb3InLCBudWxsLCBubHMubG9jYWxpemUoJ25vdGVib29rLm91dHB1dENvbnRhaW5lckJhY2tncm91bmRDb2xvcicsIFwiVGhlIGNvbG9yIG9mIHRoZSBub3RlYm9vayBvdXRwdXQgY29udGFpbmVyIGJhY2tncm91bmQuXCIpKTtcblxuLy8gVE9ET0ByZWJvcm5peCBjdXJyZW50bHkgYWxzbyB1c2VkIGZvciB0b29sYmFyIGJvcmRlciwgaWYgd2Uga2VlcCBhbGwgb2YgdGhpcywgcGljayBhIGdlbmVyaWMgbmFtZVxuZXhwb3J0IGNvbnN0IENFTExfVE9PTEJBUl9TRVBFUkFUT1IgPSByZWdpc3RlckNvbG9yKCdub3RlYm9vay5jZWxsVG9vbGJhclNlcGFyYXRvcicsIHtcblx0ZGFyazogQ29sb3IuZnJvbUhleCgnIzgwODA4MCcpLnRyYW5zcGFyZW50KDAuMzUpLFxuXHRsaWdodDogQ29sb3IuZnJvbUhleCgnIzgwODA4MCcpLnRyYW5zcGFyZW50KDAuMzUpLFxuXHRoY0Rhcms6IGNvbnRyYXN0Qm9yZGVyLFxuXHRoY0xpZ2h0OiBjb250cmFzdEJvcmRlclxufSwgbmxzLmxvY2FsaXplKCdub3RlYm9vay5jZWxsVG9vbGJhclNlcGFyYXRvcicsIFwiVGhlIGNvbG9yIG9mIHRoZSBzZXBhcmF0b3IgaW4gdGhlIGNlbGwgYm90dG9tIHRvb2xiYXJcIikpO1xuXG5leHBvcnQgY29uc3QgZm9jdXNlZENlbGxCYWNrZ3JvdW5kID0gcmVnaXN0ZXJDb2xvcignbm90ZWJvb2suZm9jdXNlZENlbGxCYWNrZ3JvdW5kJywgbnVsbCwgbmxzLmxvY2FsaXplKCdmb2N1c2VkQ2VsbEJhY2tncm91bmQnLCBcIlRoZSBiYWNrZ3JvdW5kIGNvbG9yIG9mIGEgY2VsbCB3aGVuIHRoZSBjZWxsIGlzIGZvY3VzZWQuXCIpKTtcblxuZXhwb3J0IGNvbnN0IHNlbGVjdGVkQ2VsbEJhY2tncm91bmQgPSByZWdpc3RlckNvbG9yKCdub3RlYm9vay5zZWxlY3RlZENlbGxCYWNrZ3JvdW5kJywge1xuXHRkYXJrOiBsaXN0SW5hY3RpdmVTZWxlY3Rpb25CYWNrZ3JvdW5kLFxuXHRsaWdodDogbGlzdEluYWN0aXZlU2VsZWN0aW9uQmFja2dyb3VuZCxcblx0aGNEYXJrOiBudWxsLFxuXHRoY0xpZ2h0OiBudWxsXG59LCBubHMubG9jYWxpemUoJ3NlbGVjdGVkQ2VsbEJhY2tncm91bmQnLCBcIlRoZSBiYWNrZ3JvdW5kIGNvbG9yIG9mIGEgY2VsbCB3aGVuIHRoZSBjZWxsIGlzIHNlbGVjdGVkLlwiKSk7XG5cblxuZXhwb3J0IGNvbnN0IGNlbGxIb3ZlckJhY2tncm91bmQgPSByZWdpc3RlckNvbG9yKCdub3RlYm9vay5jZWxsSG92ZXJCYWNrZ3JvdW5kJywge1xuXHRkYXJrOiB0cmFuc3BhcmVudChmb2N1c2VkQ2VsbEJhY2tncm91bmQsIC41KSxcblx0bGlnaHQ6IHRyYW5zcGFyZW50KGZvY3VzZWRDZWxsQmFja2dyb3VuZCwgLjcpLFxuXHRoY0Rhcms6IG51bGwsXG5cdGhjTGlnaHQ6IG51bGxcbn0sIG5scy5sb2NhbGl6ZSgnbm90ZWJvb2suY2VsbEhvdmVyQmFja2dyb3VuZCcsIFwiVGhlIGJhY2tncm91bmQgY29sb3Igb2YgYSBjZWxsIHdoZW4gdGhlIGNlbGwgaXMgaG92ZXJlZC5cIikpO1xuXG5leHBvcnQgY29uc3Qgc2VsZWN0ZWRDZWxsQm9yZGVyID0gcmVnaXN0ZXJDb2xvcignbm90ZWJvb2suc2VsZWN0ZWRDZWxsQm9yZGVyJywge1xuXHRkYXJrOiBub3RlYm9va0NlbGxCb3JkZXIsXG5cdGxpZ2h0OiBub3RlYm9va0NlbGxCb3JkZXIsXG5cdGhjRGFyazogY29udHJhc3RCb3JkZXIsXG5cdGhjTGlnaHQ6IGNvbnRyYXN0Qm9yZGVyXG59LCBubHMubG9jYWxpemUoJ25vdGVib29rLnNlbGVjdGVkQ2VsbEJvcmRlcicsIFwiVGhlIGNvbG9yIG9mIHRoZSBjZWxsJ3MgdG9wIGFuZCBib3R0b20gYm9yZGVyIHdoZW4gdGhlIGNlbGwgaXMgc2VsZWN0ZWQgYnV0IG5vdCBmb2N1c2VkLlwiKSk7XG5cbmV4cG9ydCBjb25zdCBpbmFjdGl2ZVNlbGVjdGVkQ2VsbEJvcmRlciA9IHJlZ2lzdGVyQ29sb3IoJ25vdGVib29rLmluYWN0aXZlU2VsZWN0ZWRDZWxsQm9yZGVyJywge1xuXHRkYXJrOiBudWxsLFxuXHRsaWdodDogbnVsbCxcblx0aGNEYXJrOiBmb2N1c0JvcmRlcixcblx0aGNMaWdodDogZm9jdXNCb3JkZXJcbn0sIG5scy5sb2NhbGl6ZSgnbm90ZWJvb2suaW5hY3RpdmVTZWxlY3RlZENlbGxCb3JkZXInLCBcIlRoZSBjb2xvciBvZiB0aGUgY2VsbCdzIGJvcmRlcnMgd2hlbiBtdWx0aXBsZSBjZWxscyBhcmUgc2VsZWN0ZWQuXCIpKTtcblxuZXhwb3J0IGNvbnN0IGZvY3VzZWRDZWxsQm9yZGVyID0gcmVnaXN0ZXJDb2xvcignbm90ZWJvb2suZm9jdXNlZENlbGxCb3JkZXInLCBmb2N1c0JvcmRlciwgbmxzLmxvY2FsaXplKCdub3RlYm9vay5mb2N1c2VkQ2VsbEJvcmRlcicsIFwiVGhlIGNvbG9yIG9mIHRoZSBjZWxsJ3MgZm9jdXMgaW5kaWNhdG9yIGJvcmRlcnMgd2hlbiB0aGUgY2VsbCBpcyBmb2N1c2VkLlwiKSk7XG5cbmV4cG9ydCBjb25zdCBpbmFjdGl2ZUZvY3VzZWRDZWxsQm9yZGVyID0gcmVnaXN0ZXJDb2xvcignbm90ZWJvb2suaW5hY3RpdmVGb2N1c2VkQ2VsbEJvcmRlcicsIG5vdGVib29rQ2VsbEJvcmRlciwgbmxzLmxvY2FsaXplKCdub3RlYm9vay5pbmFjdGl2ZUZvY3VzZWRDZWxsQm9yZGVyJywgXCJUaGUgY29sb3Igb2YgdGhlIGNlbGwncyB0b3AgYW5kIGJvdHRvbSBib3JkZXIgd2hlbiBhIGNlbGwgaXMgZm9jdXNlZCB3aGlsZSB0aGUgcHJpbWFyeSBmb2N1cyBpcyBvdXRzaWRlIG9mIHRoZSBlZGl0b3IuXCIpKTtcblxuZXhwb3J0IGNvbnN0IGNlbGxTdGF0dXNCYXJJdGVtSG92ZXIgPSByZWdpc3RlckNvbG9yKCdub3RlYm9vay5jZWxsU3RhdHVzQmFySXRlbUhvdmVyQmFja2dyb3VuZCcsIHtcblx0bGlnaHQ6IG5ldyBDb2xvcihuZXcgUkdCQSgwLCAwLCAwLCAwLjA4KSksXG5cdGRhcms6IG5ldyBDb2xvcihuZXcgUkdCQSgyNTUsIDI1NSwgMjU1LCAwLjE1KSksXG5cdGhjRGFyazogbmV3IENvbG9yKG5ldyBSR0JBKDI1NSwgMjU1LCAyNTUsIDAuMTUpKSxcblx0aGNMaWdodDogbmV3IENvbG9yKG5ldyBSR0JBKDAsIDAsIDAsIDAuMDgpKSxcbn0sIG5scy5sb2NhbGl6ZSgnbm90ZWJvb2suY2VsbFN0YXR1c0Jhckl0ZW1Ib3ZlckJhY2tncm91bmQnLCBcIlRoZSBiYWNrZ3JvdW5kIGNvbG9yIG9mIG5vdGVib29rIGNlbGwgc3RhdHVzIGJhciBpdGVtcy5cIikpO1xuXG5leHBvcnQgY29uc3QgY2VsbEluc2VydGlvbkluZGljYXRvciA9IHJlZ2lzdGVyQ29sb3IoJ25vdGVib29rLmNlbGxJbnNlcnRpb25JbmRpY2F0b3InLCBmb2N1c0JvcmRlciwgbmxzLmxvY2FsaXplKCdub3RlYm9vay5jZWxsSW5zZXJ0aW9uSW5kaWNhdG9yJywgXCJUaGUgY29sb3Igb2YgdGhlIG5vdGVib29rIGNlbGwgaW5zZXJ0aW9uIGluZGljYXRvci5cIikpO1xuXG5leHBvcnQgY29uc3QgbGlzdFNjcm9sbGJhclNsaWRlckJhY2tncm91bmQgPSByZWdpc3RlckNvbG9yKCdub3RlYm9va1Njcm9sbGJhclNsaWRlci5iYWNrZ3JvdW5kJywgc2Nyb2xsYmFyU2xpZGVyQmFja2dyb3VuZCwgbmxzLmxvY2FsaXplKCdub3RlYm9va1Njcm9sbGJhclNsaWRlckJhY2tncm91bmQnLCBcIk5vdGVib29rIHNjcm9sbGJhciBzbGlkZXIgYmFja2dyb3VuZCBjb2xvci5cIikpO1xuXG5leHBvcnQgY29uc3QgbGlzdFNjcm9sbGJhclNsaWRlckhvdmVyQmFja2dyb3VuZCA9IHJlZ2lzdGVyQ29sb3IoJ25vdGVib29rU2Nyb2xsYmFyU2xpZGVyLmhvdmVyQmFja2dyb3VuZCcsIHNjcm9sbGJhclNsaWRlckhvdmVyQmFja2dyb3VuZCwgbmxzLmxvY2FsaXplKCdub3RlYm9va1Njcm9sbGJhclNsaWRlckhvdmVyQmFja2dyb3VuZCcsIFwiTm90ZWJvb2sgc2Nyb2xsYmFyIHNsaWRlciBiYWNrZ3JvdW5kIGNvbG9yIHdoZW4gaG92ZXJpbmcuXCIpKTtcblxuZXhwb3J0IGNvbnN0IGxpc3RTY3JvbGxiYXJTbGlkZXJBY3RpdmVCYWNrZ3JvdW5kID0gcmVnaXN0ZXJDb2xvcignbm90ZWJvb2tTY3JvbGxiYXJTbGlkZXIuYWN0aXZlQmFja2dyb3VuZCcsIHNjcm9sbGJhclNsaWRlckFjdGl2ZUJhY2tncm91bmQsIG5scy5sb2NhbGl6ZSgnbm90ZWJvb2tTY3JvbGxiYXJTbGlkZXJBY3RpdmVCYWNrZ3JvdW5kJywgXCJOb3RlYm9vayBzY3JvbGxiYXIgc2xpZGVyIGJhY2tncm91bmQgY29sb3Igd2hlbiBjbGlja2VkIG9uLlwiKSk7XG5cbmV4cG9ydCBjb25zdCBjZWxsU3ltYm9sSGlnaGxpZ2h0ID0gcmVnaXN0ZXJDb2xvcignbm90ZWJvb2suc3ltYm9sSGlnaGxpZ2h0QmFja2dyb3VuZCcsIHtcblx0ZGFyazogQ29sb3IuZnJvbUhleCgnI2ZmZmZmZjBiJyksXG5cdGxpZ2h0OiBDb2xvci5mcm9tSGV4KCcjZmRmZjAwMzMnKSxcblx0aGNEYXJrOiBudWxsLFxuXHRoY0xpZ2h0OiBudWxsXG59LCBubHMubG9jYWxpemUoJ25vdGVib29rLnN5bWJvbEhpZ2hsaWdodEJhY2tncm91bmQnLCBcIkJhY2tncm91bmQgY29sb3Igb2YgaGlnaGxpZ2h0ZWQgY2VsbFwiKSk7XG5cbmV4cG9ydCBjb25zdCBjZWxsRWRpdG9yQmFja2dyb3VuZCA9IHJlZ2lzdGVyQ29sb3IoJ25vdGVib29rLmNlbGxFZGl0b3JCYWNrZ3JvdW5kJywge1xuXHRsaWdodDogU0lERV9CQVJfQkFDS0dST1VORCxcblx0ZGFyazogU0lERV9CQVJfQkFDS0dST1VORCxcblx0aGNEYXJrOiBudWxsLFxuXHRoY0xpZ2h0OiBudWxsXG59LCBubHMubG9jYWxpemUoJ25vdGVib29rLmNlbGxFZGl0b3JCYWNrZ3JvdW5kJywgXCJDZWxsIGVkaXRvciBiYWNrZ3JvdW5kIGNvbG9yLlwiKSk7XG5cbmNvbnN0IG5vdGVib29rRWRpdG9yQmFja2dyb3VuZCA9IHJlZ2lzdGVyQ29sb3IoJ25vdGVib29rLmVkaXRvckJhY2tncm91bmQnLCB7XG5cdGxpZ2h0OiBFRElUT1JfUEFORV9CQUNLR1JPVU5ELFxuXHRkYXJrOiBFRElUT1JfUEFORV9CQUNLR1JPVU5ELFxuXHRoY0Rhcms6IG51bGwsXG5cdGhjTGlnaHQ6IG51bGxcbn0sIG5scy5sb2NhbGl6ZSgnbm90ZWJvb2suZWRpdG9yQmFja2dyb3VuZCcsIFwiTm90ZWJvb2sgYmFja2dyb3VuZCBjb2xvci5cIikpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsT0FBTztBQUNQLE9BQU87QUFDUCxPQUFPO0FBQ1AsT0FBTztBQUNQLE9BQU87QUFDUCxPQUFPO0FBQ1AsT0FBTztBQUNQLE9BQU87QUFDUCxPQUFPO0FBQ1AsT0FBTztBQUNQLE9BQU87QUFDUCxPQUFPO0FBQ1AsT0FBTztBQUNQLE9BQU87QUFDUCxPQUFPO0FBQ1AsWUFBWSxTQUFTO0FBQ3JCLFlBQVksb0JBQW9CO0FBR2hDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsaUJBQWlCLHNCQUFzQjtBQUVoRCxTQUFTLE9BQU8sWUFBWTtBQUM1QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLG9CQUFvQixZQUFZLGlCQUFpQixTQUFzQixvQkFBb0I7QUFDcEcsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxTQUFTLGVBQWU7QUFFakMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyx3QkFBd0I7QUFHakMsU0FBUyxvQkFBOEI7QUFDdkMsU0FBUyxhQUFhO0FBRXRCLFNBQVMseUJBQXlCO0FBQ2xDLFlBQVksU0FBUztBQUNyQixTQUFTLGNBQWM7QUFDdkIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBc0Isb0JBQW9CLHFCQUFxQjtBQUMvRCxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGdCQUFnQixjQUFjO0FBQ3ZDLFNBQVMsOEJBQStDO0FBQ3hELFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZ0JBQWdCLGlCQUFpQixhQUFhLFlBQVksaUNBQWlDLGVBQWUsaUNBQWlDLDJCQUEyQixnQ0FBZ0MsbUJBQW1CO0FBQ2xPLFNBQVMsd0JBQXdCLGNBQWMsMkJBQTJCO0FBQzFFLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsZUFBdUMsZUFBa0MscUJBQXFCLGdCQUFvbUIsa0JBQWtCLDhCQUE4QjtBQUMzdkIsU0FBUyx3Q0FBd0M7QUFDakQsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBd0Msa0NBQXNEO0FBQzlGLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsc0JBQXNCLGtCQUFrQixpQ0FBaUM7QUFFbEYsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxrQkFBa0Isb0JBQW9CLGdDQUFnQztBQUUvRSxTQUFTLG1CQUFtQiwwQkFBMEI7QUFDdEQsU0FBUywrQkFBK0I7QUFDeEMsU0FBUywyQkFBMkI7QUFDcEMsU0FBd0IseUJBQXlCO0FBQ2pELFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsc0NBQXNDO0FBQy9DLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsMEJBQTBCO0FBRW5DLFNBQVMsY0FBYyxVQUFnQyx1QkFBdUIsd0JBQXdCLDBCQUEwQjtBQUNoSSxTQUFTLGlDQUFpQywwQkFBMEIseUJBQXlCLHlCQUF5QixxQ0FBcUM7QUFDM0osU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxpQkFBaUIsc0NBQXNDO0FBQ2hFLFNBQVMsMkJBQXVDO0FBQ2hELFNBQVMseUNBQXlDO0FBQ2xELFNBQVMsd0JBQXdCO0FBRWpDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsNEJBQTRCO0FBRXJDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsK0JBQStCO0FBRXhDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsZUFBZTtBQUN4QixTQUFTLGdDQUFnQztBQUN6QyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLG9EQUFvRDtBQUM3RCxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLGlDQUFpQztBQUMxQyxTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLG1DQUFtQztBQUU1QyxNQUFNLElBQUksSUFBSTtBQUVQLFNBQVMsb0NBQW9FO0FBRW5GLFFBQU0sb0JBQW9CO0FBQUEsSUFDekI7QUFBQSxJQUNBLHdCQUF3QjtBQUFBLElBQ3hCO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNEO0FBQ0EsUUFBTSxnQkFBZ0IseUJBQXlCLHVCQUF1QixFQUFFLE9BQU8sT0FBSyxrQkFBa0IsUUFBUSxFQUFFLEVBQUUsTUFBTSxFQUFFO0FBRTFILFNBQU87QUFBQSxJQUNOLFNBQVM7QUFBQSxNQUNSLGlCQUFpQixPQUFPO0FBQUEsTUFDeEIsa0JBQWtCLE9BQU87QUFBQSxNQUN6QixtQkFBbUIsT0FBTztBQUFBLE1BQzFCLG1CQUFtQixPQUFPO0FBQUEsTUFDMUIsc0JBQXNCLE9BQU87QUFBQSxNQUM3QixvQkFBb0IsT0FBTztBQUFBLE1BQzNCLG9CQUFvQixPQUFPO0FBQUEsSUFDNUI7QUFBQSxJQUNBLHlCQUF5QjtBQUFBLEVBQzFCO0FBQ0Q7QUFFTyxJQUFNLHVCQUFOLGNBQW1DLFdBQStEO0FBQUEsRUFzS3hHLFlBQ1UsaUJBQ1QsV0FDdUIsc0JBQ0QscUJBQzhCLDJCQUNYLHVCQUNBLHVCQUNOLGtCQUNLLHNCQUNwQixtQkFDYSxlQUNLLG9CQUNGLGtCQUNRLDBCQUNaLHVCQUNVLFlBQ3pDO0FBQ0QsVUFBTTtBQWpCRztBQUkyQztBQUNYO0FBQ0E7QUFDTjtBQUNLO0FBRVA7QUFDSztBQUNGO0FBQ1E7QUFDWjtBQUNVO0FBcEwzQztBQUFBLFNBQWlCLHdCQUF3QixLQUFLLFVBQVUsSUFBSSxRQUF1QyxDQUFDO0FBQ3BHLFNBQVMsdUJBQXVCLEtBQUssc0JBQXNCO0FBQzNELFNBQWlCLHdCQUF3QixLQUFLLFVBQVUsSUFBSSxRQUF1QyxDQUFDO0FBQ3BHLFNBQVMsdUJBQTZELEtBQUssc0JBQXNCO0FBQ2pHLFNBQWlCLHFCQUFxQixLQUFLLFVBQVUsSUFBSSxRQUF1QyxDQUFDO0FBQ2pHLFNBQVMsb0JBQTBELEtBQUssbUJBQW1CO0FBQzNGLFNBQWlCLG9CQUFvQixLQUFLLFVBQVUsSUFBSSxRQUF1QyxDQUFDO0FBQ2hHLFNBQVMsbUJBQXlELEtBQUssa0JBQWtCO0FBQ3pGLFNBQWlCLHdCQUF3QixLQUFLLFVBQVUsSUFBSSxRQUFjLENBQUM7QUFDM0UsU0FBUyx1QkFBb0MsS0FBSyxzQkFBc0I7QUFDeEUsU0FBaUIsc0JBQXNCLEtBQUssVUFBVSxJQUFJLFFBQWMsQ0FBQztBQUN6RSxTQUFTLHFCQUFrQyxLQUFLLG9CQUFvQjtBQUNwRSxTQUFpQiwwQkFBMEIsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBQzdFLFNBQVMseUJBQXNDLEtBQUssd0JBQXdCO0FBQzVFLFNBQWlCLGVBQWUsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBQ2xFLFNBQVMsY0FBMkIsS0FBSyxhQUFhO0FBQ3RELFNBQWlCLHFCQUFxQixLQUFLLFVBQVUsSUFBSSxRQUFjLENBQUM7QUFDeEUsU0FBUyxvQkFBaUMsS0FBSyxtQkFBbUI7QUFDbEUsU0FBaUIseUJBQXlCLEtBQUssVUFBVSxJQUFJLFFBQWMsQ0FBQztBQUM1RSxTQUFTLHdCQUFxQyxLQUFLLHVCQUF1QjtBQUMxRSxTQUFpQixvQkFBb0IsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBQ3ZFLFNBQVMsbUJBQWdDLEtBQUssa0JBQWtCO0FBQ2hFLFNBQWlCLHdCQUF3QixLQUFLLFVBQVUsSUFBSSxRQUFjLENBQUM7QUFDM0UsU0FBUyx1QkFBb0MsS0FBSyxzQkFBc0I7QUFDeEUsU0FBaUIsNEJBQTRCLEtBQUssVUFBVSxJQUFJLFFBQWMsQ0FBQztBQUMvRSxTQUFTLDJCQUF3QyxLQUFLLDBCQUEwQjtBQUNoRixTQUFpQixxQkFBcUIsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBQ3hFLFNBQVMsbUJBQW1CLEtBQUssbUJBQW1CO0FBQ3BELFNBQWlCLG9CQUFvQixLQUFLLFVBQVUsSUFBSSxRQUFjLENBQUM7QUFDdkUsU0FBUyxrQkFBa0IsS0FBSyxrQkFBa0I7QUFDbEQsU0FBaUIsMkJBQTJCLEtBQUssVUFBVSxJQUFJLFFBQWMsQ0FBQztBQUM5RSxTQUFTLDBCQUF1QyxLQUFLLHlCQUF5QjtBQUM5RSxTQUFpQiwyQkFBMkIsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBQzlFLFNBQVMsMEJBQXVDLEtBQUsseUJBQXlCO0FBQzlFLFNBQWlCLGFBQWlELEtBQUssVUFBVSxJQUFJLFFBQW1DLENBQUM7QUFDekgsU0FBUyxZQUE4QyxLQUFLLFdBQVc7QUFDdkUsU0FBaUIsZUFBbUQsS0FBSyxVQUFVLElBQUksUUFBbUMsQ0FBQztBQUMzSCxTQUFTLGNBQWdELEtBQUssYUFBYTtBQUMzRSxTQUFpQix1QkFBdUIsS0FBSyxVQUFVLElBQUksUUFBaUMsQ0FBQztBQUM3RixTQUFTLHNCQUFzRCxLQUFLLHFCQUFxQjtBQUN6RixTQUFpQixxQkFBcUIsS0FBSyxVQUFVLElBQUksUUFBOEIsQ0FBQztBQUN4RixTQUFpQixvQkFBb0IsS0FBSyxtQkFBbUI7QUFDN0QsU0FBaUIscUJBQXFCLEtBQUssVUFBVSxJQUFJLFFBQThCLENBQUM7QUFDeEYsU0FBaUIsb0JBQW9CLEtBQUssbUJBQW1CO0FBQzdELFNBQWlCLDRCQUE0QixLQUFLLFVBQVUsSUFBSSxRQUF3QixDQUFDO0FBQ3pGLFNBQVMsb0JBQW9CLEtBQUssMEJBQTBCO0FBYTVELFNBQVEsV0FBcUQ7QUFDN0QsU0FBUSx5QkFBbUY7QUFDM0YsU0FBUSwyQkFBK0M7QUFDdkQsU0FBUSxnQkFBaUQ7QUFHekQsU0FBUSxpQkFBbUQ7QUFDM0QsU0FBUSxzQkFBaUQ7QUFDekQsU0FBUSxtQkFBcUQsb0JBQUksSUFBSTtBQUlyRSxTQUFpQixjQUErQixLQUFLLFVBQVUsSUFBSSxnQkFBZ0IsQ0FBQztBQUNwRixTQUFRLDJCQUE4QyxDQUFDO0FBS3ZELFNBQVEseUJBQThGO0FBT3RHLFNBQW1CLGlCQUFpQixvQkFBSSxJQUF5QztBQUVqRixTQUFpQiw4QkFBOEIsSUFBSSxlQUF1QjtBQUMxRSxTQUFRLHlCQUF1RDtBQUMvRCxTQUFpQixRQUFRLGFBQWE7QUFFdEMsU0FBUSxrQkFBMkI7QUFDbkMsU0FBUSxhQUFhO0FBS3JCLFNBQVEsY0FBdUI7QUFzRC9CLFNBQVEseUJBQXlCLG9CQUFJLElBQW9DO0FBd0x6RSxTQUFRLGFBQXNCO0FBd3VCOUIsU0FBUSxtQ0FBbUM7QUE4YTNDLFNBQVEsMkJBQWtEO0FBNnNCMUQ7QUFBQTtBQUFBLFNBQVEsa0JBQStELG9CQUFJLFFBQXFDO0FBQ2hILFNBQVEscUJBQXVDLG9CQUFJLElBQWlCO0FBOHlCcEUsU0FBaUIsMkJBQTJCLG9CQUFJLElBQTZDO0FBdnlGNUYsU0FBSyxhQUFhO0FBRWxCLFNBQUssZ0JBQWdCLGdCQUFnQixpQkFBaUI7QUFDdEQsU0FBSyxZQUFZLGdCQUFnQixjQUFjO0FBRS9DLFNBQUssb0JBQW9CLFNBQVMsY0FBYyxLQUFLO0FBQ3JELFNBQUssMEJBQTBCLEtBQUssVUFBVSxrQkFBa0IsYUFBYSxLQUFLLGlCQUFpQixDQUFDO0FBQ3BHLFNBQUssdUJBQXVCLEtBQUssVUFBVSxxQkFBcUIsWUFBWSxJQUFJLGtCQUFrQixDQUFDLG9CQUFvQixLQUFLLHVCQUF1QixDQUFDLENBQUMsQ0FBQztBQUV0SixTQUFLLG1CQUFtQixnQkFBZ0IsV0FDdkMsS0FBSyxxQkFBcUIsZUFBZSxpQkFBaUIsS0FBSyxpQkFBaUIsY0FBYyxZQUFZLEtBQUssV0FBVyxNQUFTO0FBQ3BJLFNBQUssVUFBVSxLQUFLLGdCQUFnQjtBQUNwQyxVQUFNLGtCQUFrQixLQUFLLFVBQVUsSUFBSSx3QkFBd0IsQ0FBQztBQUNwRSxTQUFLLGVBQWUsSUFBSTtBQUFBLE1BQ3ZCLEtBQUs7QUFBQSxNQUNMO0FBQUEsTUFDQSxjQUFZLEtBQUsseUJBQXlCLFFBQVE7QUFBQSxJQUFDO0FBQ3BELFNBQUssVUFBVSxLQUFLLGFBQWEsZ0JBQWdCLGtCQUFrQixNQUFNO0FBQ3hFLFdBQUssbUJBQW1CLEtBQUs7QUFBQSxJQUM5QixDQUFDLENBQUM7QUFDRixTQUFLLFVBQVUsS0FBSyxhQUFhLGdCQUFnQixxQkFBcUIsT0FBSztBQUMxRSxXQUFLLHNCQUFzQixLQUFLLENBQUM7QUFBQSxJQUNsQyxDQUFDLENBQUM7QUFHRixTQUFLLFVBQVUsaUJBQWlCLDJCQUEyQixNQUFNO0FBQ2hFLFdBQUssdUJBQXVCO0FBQUEsSUFDN0IsQ0FBQyxDQUFDO0FBRUYsU0FBSyxVQUFVLEtBQUsscUJBQXFCLGVBQWUsMkJBQTJCLElBQUksQ0FBQztBQUV4RixTQUFLLFVBQVUsc0JBQXNCLDZCQUE2QixPQUFLO0FBQ3RFLFVBQUksUUFBUSxFQUFFLFVBQVUsS0FBSyxXQUFXLEdBQUcsR0FBRztBQUM3QyxhQUFLLG9CQUFvQjtBQUN6QixhQUFLLHlCQUF5QixLQUFLO0FBQUEsTUFDcEM7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFNBQUssd0JBQXdCLEtBQUsscUJBQXFCLFNBQWtCLDZCQUE2QjtBQUV0RyxTQUFLLFVBQVUsS0FBSyxxQkFBcUIseUJBQXlCLE9BQUs7QUFDdEUsVUFBSSxFQUFFLHFCQUFxQiw2QkFBNkIsR0FBRztBQUMxRCxhQUFLLHdCQUF3QixLQUFLLHFCQUFxQixTQUFrQiw2QkFBNkI7QUFDdEcsWUFBSSxLQUFLLGNBQWMsS0FBSyxZQUFZO0FBQ3ZDLGVBQUssT0FBTyxLQUFLLFVBQVU7QUFBQSxRQUM1QjtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFNBQUssVUFBVSxLQUFLLGlCQUFpQixtQkFBbUIsT0FBSztBQUM1RCxVQUFJLEVBQUUsMkJBQTJCLEVBQUUsdUJBQXVCLEVBQUUsd0JBQXdCO0FBQ25GLGFBQUssZ0NBQWdDO0FBQUEsTUFDdEM7QUFFQSxVQUFJLEVBQUUsWUFBWTtBQUNqQixhQUFLLGtCQUFrQjtBQUFBLE1BQ3hCO0FBRUEsVUFBSSxFQUFFLGVBQ0YsRUFBRSxrQkFDRixFQUFFLHlCQUNGLEVBQUUsdUJBQ0YsRUFBRSxzQkFDRixFQUFFLFlBQ0YsRUFBRSxrQkFDRixFQUFFLHNCQUNGLEVBQUUsY0FDRixFQUFFLDBCQUNGLEVBQUUsa0JBQ0YsRUFBRSxvQkFDRixFQUFFLG9CQUNGLEVBQUUsa0JBQ0YsRUFBRSxtQkFDRixFQUFFLDBCQUNGLEVBQUUsY0FDSjtBQUNELGFBQUssZUFBZSxPQUFPO0FBQzNCLGFBQUssb0JBQW9CO0FBQ3pCLGFBQUssVUFBVSxjQUFjO0FBQUEsVUFDNUIsR0FBRyxLQUFLLGdCQUFnQixzQkFBc0I7QUFBQSxVQUM5QyxZQUFZLEtBQUssb0JBQW9CO0FBQUEsUUFDdEMsQ0FBQztBQUFBLE1BQ0Y7QUFFQSxVQUFJLEtBQUssY0FBYyxLQUFLLFlBQVk7QUFDdkMsYUFBSyxPQUFPLEtBQUssVUFBVTtBQUFBLE1BQzVCO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixVQUFNLFlBQVksZ0JBQWdCLGFBQWEsS0FBSyxjQUFjLGFBQWEsZ0JBQWdCLFVBQVUsSUFBSSxLQUFLLGNBQWM7QUFDaEksU0FBSyxVQUFVLG9CQUFvQixRQUFRLFNBQVMsRUFBRSxZQUFZLE9BQUs7QUFDdEUsVUFBSSxDQUFDLEtBQUssa0JBQWtCLENBQUMsS0FBSyxZQUFZO0FBQzdDO0FBQUEsTUFDRDtBQUVBLFdBQUssb0JBQW9CLEtBQUssZ0JBQWdCLEtBQUssVUFBVTtBQUM3RCxXQUFLLGlDQUFpQyxLQUFLLFlBQVksS0FBSyxTQUFTO0FBQUEsSUFDdEUsQ0FBQyxDQUFDO0FBRUYsU0FBSyxzQkFBc0Isa0JBQWtCLElBQUk7QUFFakQsVUFBTSxLQUFLLGFBQWE7QUFDeEIsU0FBSyxrQkFBa0IsS0FBSyxZQUFZLEVBQUU7QUFDMUMsU0FBSyxrQkFBa0IsWUFBWTtBQUNuQyxTQUFLLGtCQUFrQixVQUFVLElBQUksaUJBQWlCO0FBQ3RELFNBQUssa0JBQWtCLFFBQVE7QUFDL0IsU0FBSyxrQkFBa0IsTUFBTSxhQUFhO0FBRTFDLGNBQVUsWUFBWSxLQUFLLGlCQUFpQjtBQUU1QyxTQUFLLFlBQVksS0FBSyxpQkFBaUI7QUFDdkMsU0FBSyxrQkFBa0I7QUFDdkIsU0FBSyxhQUFhO0FBQ2xCLFNBQUssZUFBZSx3QkFBd0IsT0FBTyxLQUFLLHVCQUF1QjtBQUMvRSxTQUFLLGVBQWUsd0JBQXdCLE9BQU8sS0FBSyx1QkFBdUI7QUFDL0UsU0FBSyxvQkFBb0IsOEJBQThCLE9BQU8sS0FBSyx1QkFBdUI7QUFDMUYsU0FBSyxrQkFBa0IseUJBQXlCLE9BQU8sS0FBSyx1QkFBdUI7QUFDbkYsU0FBSyxpQkFBaUIsZ0NBQWdDLE9BQU8sS0FBSyx1QkFBdUI7QUFFekYsUUFBSSxjQUF1Qiw4Q0FBOEMsS0FBSyxFQUFFLE9BQU8sS0FBSyx1QkFBdUIsRUFBRSxJQUFJLElBQUk7QUFFN0gsU0FBSyxnQkFBZ0IsSUFBSSxDQUFDLGdCQUFnQixVQUFVO0FBRXBELFFBQUk7QUFDSixRQUFJLE1BQU0sUUFBUSxLQUFLLGdCQUFnQixhQUFhLEdBQUc7QUFDdEQsc0JBQWdCLEtBQUssZ0JBQWdCO0FBQUEsSUFDdEMsT0FBTztBQUNOLHNCQUFnQixpQ0FBaUMsdUJBQXVCO0FBQUEsSUFDekU7QUFDQSxlQUFXLFFBQVEsZUFBZTtBQUNqQyxVQUFJO0FBQ0osVUFBSTtBQUNILHVCQUFlLEtBQUsscUJBQXFCLGVBQWUsS0FBSyxNQUFNLElBQUk7QUFBQSxNQUN4RSxTQUFTLEtBQUs7QUFDYiwwQkFBa0IsR0FBRztBQUFBLE1BQ3RCO0FBQ0EsVUFBSSxjQUFjO0FBQ2pCLFlBQUksQ0FBQyxLQUFLLGVBQWUsSUFBSSxLQUFLLEVBQUUsR0FBRztBQUN0QyxlQUFLLGVBQWUsSUFBSSxLQUFLLElBQUksWUFBWTtBQUFBLFFBQzlDLE9BQU87QUFDTix1QkFBYSxRQUFRO0FBQ3JCLGdCQUFNLElBQUksTUFBTSw0Q0FBNEMsS0FBSyxFQUFFLEdBQUc7QUFBQSxRQUN2RTtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBRUEsU0FBSyxnQ0FBZ0M7QUFBQSxFQUN0QztBQUFBLEVBaFBBLElBQUksWUFBWTtBQUNmLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUlBLElBQUksYUFBYTtBQUNoQixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxJQUFJLFVBQVUsVUFBeUM7QUFDdEQsU0FBSyxtQkFBbUIsS0FBSyxLQUFLLG9CQUFvQixnQkFBZ0I7QUFDdEUsU0FBSyxxQkFBcUI7QUFDMUIsU0FBSyxrQkFBa0IsS0FBSyxVQUFVLGdCQUFnQjtBQUFBLEVBQ3ZEO0FBQUEsRUFFQSxJQUFJLFlBQVk7QUFDZixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxJQUFJLFlBQVk7QUFDZixXQUFPLEtBQUssb0JBQW9CO0FBQUEsRUFDakM7QUFBQSxFQUVBLElBQUksYUFBYTtBQUNoQixXQUFPLEtBQUssb0JBQW9CLFFBQVEsY0FBYztBQUFBLEVBQ3ZEO0FBQUEsRUFFQSxJQUFJLG1CQUE0QztBQUMvQyxRQUFJLEtBQUssYUFBYTtBQUNyQjtBQUFBLElBQ0Q7QUFFQSxVQUFNLENBQUMsT0FBTyxJQUFJLEtBQUssTUFBTSxtQkFBbUI7QUFDaEQsV0FBTyxLQUFLLGlCQUFpQixJQUFJLE9BQU87QUFBQSxFQUN6QztBQUFBLEVBRUEsSUFBSSwwQkFBcUU7QUFDeEUsUUFBSSxLQUFLLGFBQWE7QUFDckI7QUFBQSxJQUNEO0FBRUEsVUFBTSxDQUFDLE9BQU8sSUFBSSxLQUFLLE1BQU0sbUJBQW1CO0FBQ2hELFVBQU0sU0FBUyxLQUFLLGlCQUFpQixJQUFJLE9BQU87QUFDaEQsUUFBSSxDQUFDLFFBQVE7QUFDWjtBQUFBLElBQ0Q7QUFDQSxXQUFPLENBQUMsU0FBUyxNQUFNO0FBQUEsRUFDeEI7QUFBQSxFQUVBLElBQUksY0FBK0M7QUFDbEQsV0FBTyxDQUFDLEdBQUcsS0FBSyxnQkFBZ0I7QUFBQSxFQUNqQztBQUFBLEVBRUEsSUFBSSxnQkFBZ0I7QUFDbkIsV0FBTyxLQUFLLFFBQVMsS0FBSyxNQUFNLGlCQUFpQixDQUFDLElBQUssQ0FBQztBQUFBLEVBQ3pEO0FBQUEsRUFhQSxJQUFJLGtCQUFrQjtBQUNyQixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUE2S1EsVUFBVSxNQUFhO0FBQzlCLFFBQUksQ0FBQyxLQUFLLFlBQVk7QUFDckI7QUFBQSxJQUNEO0FBRUEsa0JBQWMsR0FBRyxJQUFJO0FBQUEsRUFDdEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtPLFFBQWdCO0FBQ3RCLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVBLGVBQThDO0FBQzdDLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVBLFlBQVk7QUFDWCxXQUFPLEtBQUssV0FBVyxVQUFVO0FBQUEsRUFDbEM7QUFBQSxFQUVBLGdCQUFnQjtBQUNmLFdBQU8sS0FBSyxXQUFXLGNBQWMsS0FBSyxDQUFDO0FBQUEsRUFDNUM7QUFBQSxFQUVBLGNBQWMsWUFBMEI7QUFDdkMsUUFBSSxDQUFDLEtBQUssV0FBVztBQUNwQjtBQUFBLElBQ0Q7QUFFQSxVQUFNLFFBQVEsS0FBSyxVQUFVLFNBQVM7QUFDdEMsU0FBSyxVQUFVLHNCQUFzQjtBQUFBLE1BQ3BDLE1BQU0sbUJBQW1CO0FBQUEsTUFDekI7QUFBQSxNQUNBO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsV0FBVztBQUNWLFdBQU8sS0FBSyxXQUFXLFNBQVMsS0FBSyxFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUU7QUFBQSxFQUN6RDtBQUFBLEVBRUEsU0FBUyxPQUFtQjtBQUMzQixRQUFJLENBQUMsS0FBSyxXQUFXO0FBQ3BCO0FBQUEsSUFDRDtBQUVBLFVBQU0sYUFBYSxLQUFLLFVBQVUsY0FBYztBQUNoRCxTQUFLLFVBQVUsc0JBQXNCO0FBQUEsTUFDcEMsTUFBTSxtQkFBbUI7QUFBQSxNQUN6QjtBQUFBLE1BQ0E7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFQSx5QkFBMkM7QUFDMUMsUUFBSSxDQUFDLEtBQUssV0FBVztBQUNwQixhQUFPLENBQUM7QUFBQSxJQUNUO0FBRUEsVUFBTSxXQUFXLG9CQUFJLElBQVk7QUFFakMsV0FBTyxLQUFLLFVBQVUsY0FBYyxFQUFFLElBQUksV0FBUyxLQUFLLFVBQVcsVUFBVSxNQUFNLE1BQU0sT0FBTyxNQUFNLEdBQUcsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxHQUFHLE1BQU07QUFDNUgsUUFBRSxRQUFRLFVBQVE7QUFDakIsWUFBSSxDQUFDLFNBQVMsSUFBSSxLQUFLLE1BQU0sR0FBRztBQUMvQixtQkFBUyxJQUFJLEtBQUssTUFBTTtBQUN4QixZQUFFLEtBQUssSUFBSTtBQUFBLFFBQ1o7QUFBQSxNQUNELENBQUM7QUFFRCxhQUFPO0FBQUEsSUFDUixHQUFHLENBQUMsQ0FBcUI7QUFBQSxFQUMxQjtBQUFBLEVBRUEsV0FBa0Q7QUFDakQsV0FBTyxDQUFDLENBQUMsS0FBSztBQUFBLEVBQ2Y7QUFBQSxFQUVBLGVBQXFCO0FBQ3BCLFNBQUssbUJBQW1CLEtBQUssc0JBQXNCLEtBQUssSUFBSTtBQUFBLEVBQzdEO0FBQUEsRUFFQSxlQUFxQjtBQUNwQixRQUFJLEtBQUssa0JBQWtCO0FBQzFCLFdBQUssaUJBQWlCLEtBQUs7QUFDM0IsV0FBSyxtQkFBbUI7QUFBQSxJQUN6QjtBQUFBLEVBQ0Q7QUFBQTtBQUFBLEVBSUEseUJBQXlCLFVBQTBDO0FBQ2xFLFVBQU0sa0JBQWtCLEtBQUssdUJBQXVCLElBQUksUUFBUTtBQUVoRSxRQUFJLGlCQUFpQjtBQUNwQixhQUFPO0FBQUEsSUFDUixPQUFPO0FBQ04sWUFBTSxVQUFVLElBQUksc0JBQXNCLE1BQU0sS0FBSyxpQkFBaUIsS0FBSyxzQkFBc0IsUUFBUTtBQUN6RyxXQUFLLHVCQUF1QixJQUFJLFVBQVUsT0FBTztBQUNqRCxhQUFPO0FBQUEsSUFDUjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLGtDQUFrQztBQUN6QyxRQUFJLENBQUMsS0FBSyxtQkFBbUI7QUFDNUI7QUFBQSxJQUNEO0FBRUEsU0FBSyxrQkFBa0IsVUFBVSxPQUFPLHlCQUF5QjtBQUNqRSxTQUFLLGtCQUFrQixVQUFVLE9BQU8sMEJBQTBCO0FBQ2xFLFNBQUssa0JBQWtCLFVBQVUsT0FBTywyQkFBMkI7QUFDbkUsVUFBTSxzQkFBc0IsS0FBSyxpQkFBaUIsMkJBQTJCLEtBQUssV0FBVyxRQUFRO0FBQ3JHLFNBQUssa0JBQWtCLFVBQVUsSUFBSSxzQkFBc0IsbUJBQW1CLEVBQUU7QUFFaEYsVUFBTSx5QkFBeUIsS0FBSyxpQkFBaUIsa0JBQWtCLEVBQUU7QUFDekUsUUFBSSw4QkFBOEI7QUFDbEMsU0FBSyxrQkFBa0IsVUFBVSxPQUFPLG9CQUFvQjtBQUM1RCxTQUFLLGtCQUFrQixVQUFVLE9BQU8sb0JBQW9CO0FBRTVELFFBQUksMkJBQTJCLFdBQVcsMkJBQTJCLFNBQVM7QUFDN0Usb0NBQThCO0FBQUEsSUFDL0I7QUFDQSxTQUFLLGtCQUFrQixVQUFVLElBQUksZ0JBQWdCLDJCQUEyQixFQUFFO0FBQUEsRUFFbkY7QUFBQSxFQUVRLG9CQUEwQjtBQUNqQyxVQUFNLGdCQUFnQixLQUFLLHFCQUFxQixTQUF5QixRQUFRO0FBQ2pGLFVBQU0sZUFBZSxJQUFJLFVBQVUsS0FBSyxXQUFXLENBQUM7QUFDcEQsU0FBSyxZQUFZLGlCQUFpQixhQUFhLGNBQWMsYUFBYSxzQkFBc0IsZUFBZSxXQUFXLFlBQVksWUFBWSxFQUFFLEtBQUssQ0FBQztBQUFBLEVBQzNKO0FBQUEsRUFFUSxZQUFZLFFBQTJCO0FBQzlDLFNBQUssK0JBQStCLFNBQVMsY0FBYyxLQUFLO0FBQ2hFLFNBQUssNkJBQTZCLFVBQVUsSUFBSSw0QkFBNEI7QUFDNUUsU0FBSyw2QkFBNkIsTUFBTSxVQUFVO0FBQ2xELFFBQUksT0FBTyxRQUFRLEtBQUssNEJBQTRCO0FBRXBELFNBQUssaUNBQWlDLFNBQVMsY0FBYyxLQUFLO0FBQ2xFLFNBQUssK0JBQStCLFVBQVUsSUFBSSxrQ0FBa0M7QUFDcEYsUUFBSSxPQUFPLFFBQVEsS0FBSyw4QkFBOEI7QUFFdEQsU0FBSyxRQUFRLFNBQVMsY0FBYyxLQUFLO0FBQ3pDLFFBQUksT0FBTyxRQUFRLEtBQUssS0FBSztBQUU3QixTQUFLLE1BQU0sVUFBVSxJQUFJLHFCQUFxQjtBQUM5QyxTQUFLLG9CQUFvQjtBQUN6QixTQUFLLGdCQUFnQjtBQUVyQixTQUFLLGtDQUFrQyxTQUFTLGNBQWMsS0FBSztBQUNuRSxTQUFLLGdDQUFnQyxVQUFVLElBQUksbUNBQW1DO0FBQ3RGLFNBQUssTUFBTSxrQkFBa0IsWUFBWSxLQUFLLCtCQUErQjtBQUM3RSxTQUFLLCtCQUErQjtBQUVwQyxTQUFLLFVBQVUsS0FBSyxxQkFBcUIsZUFBZSwyQkFBMkIsTUFBTSxLQUFLLE1BQU0saUJBQWlCLENBQUM7QUFFdEgsU0FBSyxxQkFBcUIsU0FBUyxjQUFjLEtBQUs7QUFDdEQsU0FBSyxtQkFBbUIsVUFBVSxJQUFJLHNDQUFzQyxlQUFlO0FBQzNGLFFBQUksT0FBTyxRQUFRLEtBQUssa0JBQWtCO0FBQUEsRUFDM0M7QUFBQSxFQUVRLHNCQUFzQjtBQUM3QixXQUFPLEtBQUssV0FBVyxjQUFjO0FBQUEsRUFDdEM7QUFBQSxFQUVRLHNCQUE0QjtBQUNuQyxTQUFLLGdCQUFnQixlQUFlLGlCQUFpQixLQUFLLEtBQUs7QUFDL0QsVUFBTTtBQUFBLE1BQ0w7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsSUFBSSxLQUFLLGlCQUFpQix1QkFBdUI7QUFFakQsVUFBTTtBQUFBLE1BQ0w7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsSUFBSSxLQUFLLGlCQUFpQixrQkFBa0I7QUFFNUMsVUFBTSxtQ0FBbUMsS0FBSyxpQkFBaUIsaUNBQWlDO0FBRWhHLFVBQU0sRUFBRSxrQkFBa0Isb0JBQW9CLElBQUksS0FBSyxpQkFBaUIsK0JBQStCLEtBQUssV0FBVyxRQUFRO0FBRS9ILFVBQU0sY0FBd0IsQ0FBQztBQUMvQixRQUFJLENBQUMsS0FBSyxXQUFXO0FBQ3BCLFdBQUssa0JBQWtCO0FBQUEsSUFDeEI7QUFFQSxVQUFNLGFBQWEsS0FBSyxvQkFBb0I7QUFFNUMsZ0JBQVksS0FBSztBQUFBO0FBQUEsdUNBRW9CLGNBQWM7QUFBQSw4Q0FDUCxRQUFRO0FBQUEsZ0RBQ04sVUFBVTtBQUFBO0FBQUEsR0FFdkQ7QUFFRCxRQUFJLGFBQWE7QUFDaEIsa0JBQVksS0FBSywySkFBMkosZ0NBQWdDLE9BQU87QUFBQSxJQUNwTixPQUFPO0FBQ04sa0JBQVksS0FBSywySkFBMkosa0JBQWtCLE9BQU87QUFBQSxJQUN0TTtBQUdBLFFBQUksbUJBQW1CLFVBQVU7QUFDaEMsa0JBQVksS0FBSztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQXVDaEI7QUFHRCxrQkFBWSxLQUFLO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxZQUtSLGFBQWEsMkJBQTJCLGdCQUFnQixnQkFBZ0I7QUFBQSxLQUMvRTtBQUFBLElBQ0gsT0FBTztBQUNOLGtCQUFZLEtBQUs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUtELHdCQUF3QjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQWF4QiwyQkFBMkIsQ0FBQztBQUFBO0FBQUEsSUFFM0M7QUFFRCxrQkFBWSxLQUFLO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsa0JBT0YsaUJBQWlCO0FBQUE7QUFBQSxJQUUvQjtBQUFBLElBQ0Y7QUFHQSxRQUFJLDBCQUEwQixrQkFBa0IsMEJBQTBCLFFBQVE7QUFDakYsa0JBQVksS0FBSyxnTUFBZ007QUFDak4sa0JBQVksS0FBSyxrTUFBa007QUFBQSxJQUNwTixPQUFPO0FBQ04sa0JBQVksS0FBSyxnTUFBZ007QUFDak4sa0JBQVksS0FBSyxrTUFBa007QUFBQSxJQUNwTjtBQUVBLFFBQUksMkJBQTJCLFFBQVE7QUFDdEMsa0JBQVksS0FBSztBQUFBO0FBQUE7QUFBQTtBQUFBLEtBSWY7QUFFRixrQkFBWSxLQUFLO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEtBTWY7QUFFRixrQkFBWSxLQUFLO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFLRyxJQUFJLGtCQUFrQjtBQUFBLEtBQ3hDO0FBRUYsa0JBQVksS0FBSztBQUFBO0FBQUE7QUFBQTtBQUFBLEtBSWY7QUFBQSxJQUNIO0FBRUEsZ0JBQVksS0FBSyx1SkFBdUosZ0NBQWdDLE9BQU87QUFFL00sZ0JBQVksS0FBSyxtS0FBbUssZ0NBQWdDLE9BQU87QUFFM04sZ0JBQVksS0FBSywrSkFBK0osZUFBZSxPQUFPO0FBQ3RNLGdCQUFZLEtBQUsscUpBQXFKLGVBQWUsT0FBTztBQUM1TCxnQkFBWSxLQUFLLG1LQUFtSyxhQUFhLE9BQU87QUFDeE0sZ0JBQVksS0FBSyx3S0FBd0ssd0JBQXdCLG9CQUFvQixxQkFBcUIsT0FBTztBQUNqUSxnQkFBWSxLQUFLLGlNQUFpTTtBQUNsTixnQkFBWSxLQUFLLG1OQUFtTix3QkFBd0Isb0JBQW9CLHFCQUFxQixPQUFPO0FBQzVTLGdCQUFZLEtBQUssMENBQTBDLGVBQWUsVUFBVSxnQ0FBZ0MsT0FBTztBQUMzSCxnQkFBWSxLQUFLLGlEQUFpRCxtQ0FBbUMsZUFBZSxRQUFRO0FBRzVILGdCQUFZLEtBQUssNEpBQTRKLGdDQUFnQyxPQUFPO0FBQ3BOLGdCQUFZLEtBQUsseUtBQXlLLG1DQUFtQyxlQUFlLFFBQVE7QUFHcFAsZ0JBQVksS0FBSyxnR0FBZ0csYUFBYSxPQUFPO0FBQ3JJLGdCQUFZLEtBQUs7QUFBQTtBQUFBLFlBRVAsYUFBYTtBQUFBO0FBQUEsSUFFckI7QUFHRixnQkFBWSxLQUFLLDhEQUE4RCxlQUFlLFVBQVUsZ0NBQWdDLE9BQU87QUFDL0ksZ0JBQVksS0FBSyxxRUFBcUUsbUNBQW1DLGVBQWUsUUFBUTtBQUVoSixnQkFBWSxLQUFLLDhKQUE4SixhQUFhLE9BQU87QUFDbk0sZ0JBQVksS0FBSyxrR0FBa0cscUJBQXFCLE1BQU0sSUFBSSxzQkFBc0IsT0FBTztBQUMvSyxnQkFBWSxLQUFLLHlFQUF5RSxxQkFBcUIseUJBQXlCLENBQUMsT0FBTztBQUNoSixnQkFBWSxLQUFLLDBIQUEwSCxhQUFhLE9BQU87QUFDL0osZ0JBQVksS0FBSyx1RkFBdUYsZ0JBQWdCLE9BQU87QUFDL0gsZ0JBQVksS0FBSyxvR0FBb0csZ0NBQWdDLE9BQU87QUFDNUosZ0JBQVksS0FBSyx3R0FBd0csa0JBQWtCLE9BQU87QUFDbEosZ0JBQVksS0FBSyw0R0FBNEcsZUFBZSxPQUFPO0FBQ25KLGdCQUFZLEtBQUsseUZBQXlGLGdCQUFnQixPQUFPO0FBQ2pJLGdCQUFZLEtBQUssdUZBQXVGLGdCQUFnQixPQUFPO0FBRS9ILGdCQUFZLEtBQUs7QUFBQTtBQUFBLGNBRUwsbUJBQW1CLGdCQUFnQjtBQUFBO0FBQUEsR0FFOUM7QUFFRCxnQkFBWSxLQUFLO0FBQUE7QUFBQSxjQUVMLG1CQUFtQixnQkFBZ0I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGNBS25DLG1CQUFtQixtQkFBbUIsQ0FBQztBQUFBO0FBQUE7QUFBQSxHQUdsRDtBQUdELGdCQUFZLEtBQUs7QUFBQTtBQUFBLG1CQUVBLHdCQUF3QjtBQUFBO0FBQUE7QUFBQTtBQUFBLGtCQUl6Qix3QkFBd0I7QUFBQTtBQUFBLEdBRXZDO0FBRUQsZ0JBQVksS0FBSyx5TUFBeU0sbUJBQW1CLE1BQU07QUFDblAsZ0JBQVksS0FBSywyTUFBMk0sbUJBQW1CLE1BQU07QUFHclAsZ0JBQVksS0FBSztBQUFBLFlBQ1Asa0JBQWtCLEVBQUU7QUFBQTtBQUFBO0FBQUEsV0FHckIsbUNBQW1DLEVBQUU7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUk1QztBQUdGLGdCQUFZLEtBQUs7QUFBQTtBQUFBLGNBRUwsOEJBQThCO0FBQUE7QUFBQTtBQUFBLGNBRzlCLDhCQUE4QjtBQUFBO0FBQUEsR0FFekM7QUFHRCxnQkFBWSxLQUFLO0FBQUE7QUFBQSxlQUVKLGVBQWU7QUFBQTtBQUFBLEdBRTNCO0FBRUQsU0FBSyxjQUFjLGNBQWMsWUFBWSxLQUFLLElBQUk7QUFBQSxFQUN2RDtBQUFBLEVBRVEsa0JBQXdCO0FBQy9CLFNBQUssTUFBTSxVQUFVLElBQUkscUJBQXFCO0FBQzlDLFNBQUssaUJBQWlCLEtBQUssVUFBVSxJQUFJLDBCQUEwQixNQUFNLEtBQUssS0FBSyxDQUFDO0FBQ3BGLFVBQU0sNkJBQTZCLENBQUMsY0FBMkIsS0FBSyxNQUFNLGtCQUFrQixhQUFhLFNBQVM7QUFDbEgsU0FBSyxjQUFjLEtBQUssVUFBVSxLQUFLLHFCQUFxQixlQUFlLHdCQUF3QixNQUFNLDBCQUEwQixDQUFDO0FBQ3BJLFVBQU0sWUFBWTtBQUFBLE1BQ2pCLEtBQUsscUJBQXFCLGVBQWUsa0JBQWtCLE1BQU0sS0FBSyxrQkFBa0IsS0FBSyxhQUFhLEtBQUssZ0JBQWdCLDBCQUEwQjtBQUFBLE1BQ3pKLEtBQUsscUJBQXFCLGVBQWUsb0JBQW9CLE1BQU0sS0FBSyxnQkFBZ0IsS0FBSyxrQkFBa0IsMEJBQTBCO0FBQUEsSUFDMUk7QUFFQSxjQUFVLFFBQVEsY0FBWTtBQUM3QixXQUFLLFVBQVUsUUFBUTtBQUFBLElBQ3hCLENBQUM7QUFFRCxTQUFLLGdCQUFnQixLQUFLLHFCQUFxQixlQUFlLDBCQUEwQixJQUFJLFVBQVUsS0FBSyxXQUFXLENBQUMsQ0FBQztBQUN4SCxTQUFLLFVBQVUsS0FBSyxhQUFhO0FBRWpDLFVBQU0sd0JBQXdCLEtBQUsscUJBQXFCLGVBQWUsK0JBQStCLE1BQU0sS0FBSyxXQUFXLEtBQUssYUFBYTtBQUM5SSxTQUFLLFVBQVUscUJBQXFCO0FBRXBDLFNBQUssUUFBUSxLQUFLLHFCQUFxQjtBQUFBLE1BQ3RDO0FBQUEsTUFDQTtBQUFBLE1BQ0EsS0FBSztBQUFBLE1BQ0wsS0FBSyxhQUFhO0FBQUEsTUFDbEIsS0FBSztBQUFBLE1BQ0w7QUFBQSxNQUNBLEtBQUs7QUFBQSxNQUNMO0FBQUEsUUFDQyxrQkFBa0I7QUFBQSxRQUNsQixjQUFjO0FBQUEsUUFDZCx1QkFBdUI7QUFBQSxRQUN2QixxQkFBcUI7QUFBQSxRQUNyQixpQkFBaUI7QUFBQSxRQUNqQixjQUFjO0FBQUEsUUFDZCwwQkFBMEI7QUFBQSxRQUMxQixxQkFBcUI7QUFBQSxRQUNyQix1QkFBdUI7QUFBQSxRQUN2QixZQUFZO0FBQUEsUUFDWixlQUFlO0FBQUEsUUFDZix1QkFBdUI7QUFBQTtBQUFBLFFBQ3ZCLGFBQWEsS0FBSztBQUFBLFFBQ2xCLGlCQUFpQixDQUFDLFlBQW9CO0FBQUUsaUJBQU8sS0FBSztBQUFBLFFBQU87QUFBQSxRQUMzRCxnQkFBZ0I7QUFBQSxVQUNmLGdCQUFnQjtBQUFBLFVBQ2hCLCtCQUErQjtBQUFBLFVBQy9CLCtCQUErQjtBQUFBLFVBQy9CLGlDQUFpQztBQUFBLFVBQ2pDLGlDQUFpQztBQUFBLFVBQ2pDLHFCQUFxQjtBQUFBLFVBQ3JCLHFCQUFxQjtBQUFBLFVBQ3JCLHFCQUFxQjtBQUFBLFVBQ3JCLHFCQUFxQjtBQUFBLFVBQ3JCLGtCQUFrQjtBQUFBLFVBQ2xCLGtCQUFrQjtBQUFBLFVBQ2xCLGlDQUFpQztBQUFBLFVBQ2pDLGlDQUFpQztBQUFBLFVBQ2pDLDZCQUE2QjtBQUFBLFVBQzdCLDBCQUEwQjtBQUFBLFFBQzNCO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQ0EsU0FBSyxlQUFlLFFBQVEsS0FBSyxLQUFLO0FBSXRDLFNBQUssVUFBVSxLQUFLLEtBQUs7QUFDekIsU0FBSyx3QkFBd0IsSUFBSSxxQkFBcUIsS0FBSyxLQUFLO0FBQ2hFLFNBQUssVUFBVSxLQUFLLHFCQUFxQjtBQUV6QyxTQUFLLFVBQVUsbUJBQW1CLEdBQUcsU0FBUyxDQUFDO0FBRy9DLFNBQUssc0JBQXNCLEtBQUssVUFBVSxLQUFLLHFCQUFxQixlQUFlLG9CQUFvQixNQUFNLEtBQUssZUFBZSxDQUFDO0FBR2xJLFNBQUssMkJBQTJCLElBQUksT0FBTyxLQUFLLE1BQU0sZUFBZSxFQUFFLGdCQUFnQixDQUFDO0FBQ3hGLFNBQUsseUJBQXlCLE1BQU0sVUFBVTtBQUU5QyxTQUFLLFVBQVUsSUFBSSw4Q0FBOEMsS0FBSyxtQkFBbUIsQ0FBQyxNQUEwQjtBQUNuSCxVQUFJLEVBQUUsT0FBTyxVQUFVLFNBQVMsUUFBUSxLQUFLLEtBQUssMEJBQTBCO0FBQzNFLGFBQUsseUJBQXlCLE1BQU0sVUFBVTtBQUFBLE1BQy9DO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixTQUFLLFVBQVUsSUFBSSw0Q0FBNEMsS0FBSyxtQkFBbUIsTUFBTTtBQUM1RixVQUFJLEtBQUssMEJBQTBCO0FBRWxDLGFBQUsseUJBQXlCLE1BQU0sVUFBVTtBQUFBLE1BQy9DO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixTQUFLLFVBQVUsS0FBSyxNQUFNLFlBQVksT0FBSztBQUMxQyxVQUFJLEVBQUUsU0FBUztBQUNkLGFBQUssYUFBYSxLQUFLLEVBQUUsT0FBTyxFQUFFLGNBQWMsUUFBUSxFQUFFLFFBQVEsQ0FBQztBQUFBLE1BQ3BFO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixTQUFLLFVBQVUsS0FBSyxNQUFNLFVBQVUsT0FBSztBQUN4QyxVQUFJLEVBQUUsU0FBUztBQUNkLGFBQUssV0FBVyxLQUFLLEVBQUUsT0FBTyxFQUFFLGNBQWMsUUFBUSxFQUFFLFFBQVEsQ0FBQztBQUFBLE1BQ2xFO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixTQUFLLFVBQVUsS0FBSyxNQUFNLGlCQUFpQixRQUFNO0FBQ2hELFdBQUsseUJBQXlCLEtBQUssSUFBSTtBQUN2QyxXQUFLLHVCQUF1QixLQUFLO0FBQ2pDLFdBQUssa0JBQWtCLEtBQUs7QUFDNUIsV0FBSyxlQUFlLElBQUksS0FBSztBQUFBLElBQzlCLENBQUMsQ0FBQztBQUVGLFNBQUssVUFBVSxLQUFLLE1BQU0sY0FBYyxPQUFLO0FBQzVDLFdBQUssb0JBQW9CLENBQUM7QUFBQSxJQUMzQixDQUFDLENBQUM7QUFFRixTQUFLLFVBQVUsS0FBSyxNQUFNLHlCQUF5QixNQUFNO0FBQ3hELFdBQUssMEJBQTBCLEtBQUs7QUFBQSxJQUNyQyxDQUFDLENBQUM7QUFFRixTQUFLLFVBQVUsS0FBSyxNQUFNLFlBQVksQ0FBQyxNQUFNO0FBQzVDLFVBQUksRUFBRSxjQUFjLEVBQUUsY0FBYztBQUNuQyxhQUFLLGFBQWEsS0FBSztBQUN2QixhQUFLLHVCQUF1QjtBQUFBLE1BQzdCO0FBRUEsVUFBSSxFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxxQkFBcUI7QUFDNUQsYUFBSyxtQkFBbUIsS0FBSztBQUFBLE1BQzlCO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixTQUFLLGdCQUFnQixLQUFLLFVBQVUsSUFBSSxXQUFXLEtBQUssV0FBVyxDQUFDLENBQUM7QUFDckUsU0FBSyxVQUFVLEtBQUssY0FBYyxVQUFVLE1BQU07QUFDakQsV0FBSyxhQUFhLElBQUksS0FBSztBQUMzQixXQUFLLFdBQVcsZUFBZSxLQUFLO0FBQ3BDLFdBQUssa0JBQWtCLEtBQUs7QUFBQSxJQUM3QixDQUFDLENBQUM7QUFDRixTQUFLLFVBQVUsS0FBSyxjQUFjLFdBQVcsTUFBTTtBQUNsRCxXQUFLLGFBQWEsSUFBSSxJQUFJO0FBQzFCLFdBQUssV0FBVyxlQUFlLElBQUk7QUFDbkMsV0FBSyxtQkFBbUIsS0FBSztBQUFBLElBQzlCLENBQUMsQ0FBQztBQUVGLFNBQUssZ0NBQWdDO0FBQ3JDLFNBQUssOEJBQThCO0FBRW5DLFNBQUssVUFBVSxLQUFLLHFCQUFxQix5QkFBeUIsT0FBSztBQUN0RSxVQUFJLEVBQUUscUJBQXFCLHNCQUFzQixrQkFBa0IsR0FBRztBQUNyRSxhQUFLLE1BQU0sWUFBWSx1QkFBdUIsbUJBQW1CO0FBQUEsTUFDbEU7QUFBQSxJQUNELENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVRLG9CQUFvQixHQUF5QztBQUNwRSxTQUFLLG1CQUFtQixnQkFBZ0I7QUFBQSxNQUN2QyxRQUFRLE9BQU87QUFBQSxNQUNmLG1CQUFtQjtBQUFBLFFBQ2xCLG1CQUFtQjtBQUFBLE1BQ3BCO0FBQUEsTUFDQSxtQkFBbUIsS0FBSztBQUFBLE1BQ3hCLFdBQVcsTUFBTSxFQUFFO0FBQUEsTUFDbkIsbUJBQW1CLE1BQU07QUFDeEIsZUFBTztBQUFBLFVBQ04sTUFBTTtBQUFBLFFBQ1A7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRVEsaUNBQWlDO0FBQ3hDLFNBQUsseUJBQXlCLEtBQUssVUFBVSxLQUFLLHFCQUFxQixlQUFlLHVCQUF1QixNQUFNLEtBQUssK0JBQStCLENBQUM7QUFBQSxFQUN6SjtBQUFBLEVBRVEsa0NBQWtDO0FBQ3pDLFNBQUssc0JBQXNCLEtBQUssVUFBVSxLQUFLLHFCQUFxQixlQUFlLGdDQUFnQyxNQUFNLEtBQUsseUJBQXlCLEtBQUssa0JBQWtCLEtBQUssNEJBQTRCLENBQUM7QUFDaE4sU0FBSyxVQUFVLEtBQUssb0JBQW9CLHNCQUFzQixNQUFNO0FBQ25FLFVBQUksS0FBSyxjQUFjLEtBQUssWUFBWTtBQUN2QyxhQUFLLE9BQU8sS0FBSyxVQUFVO0FBQUEsTUFDNUI7QUFBQSxJQUNELENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVRLGdDQUFnQztBQUN2QyxTQUFLLHdCQUF3QixLQUFLLFVBQVUsS0FBSyxxQkFBcUIsZUFBZSxzQkFBc0IsS0FBSyxnQ0FBZ0MsTUFBTSxLQUFLLE9BQU8sQ0FBQyxjQUFjO0FBQ2hMLFVBQUksS0FBSyxZQUFZO0FBQ3BCO0FBQUEsTUFDRDtBQUVBLFVBQUksS0FBSyxjQUFjLEtBQUssWUFBWTtBQUN2QyxZQUFJLFlBQVksR0FBRztBQUNsQixlQUFLLE9BQU8sS0FBSyxVQUFVO0FBQzNCLGVBQUssYUFBYSxLQUFLLFlBQVksU0FBUztBQUFBLFFBQzdDLFdBQVcsWUFBWSxHQUFHO0FBQ3pCLGVBQUssYUFBYSxLQUFLLFlBQVksU0FBUztBQUM1QyxlQUFLLE9BQU8sS0FBSyxVQUFVO0FBQUEsUUFDNUI7QUFBQSxNQUNEO0FBRUEsV0FBSyxhQUFhLEtBQUs7QUFBQSxJQUN4QixDQUFDLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFUSx5QkFBeUI7QUFDaEMsUUFBSSxDQUFDLEtBQUssYUFBYSxDQUFDLEtBQUssVUFBVTtBQUN0QztBQUFBLElBQ0Q7QUFFQSxTQUFLLFNBQVMsc0JBQXNCO0FBQ3BDLFNBQUssVUFBVSxVQUFVLFFBQVEsVUFBUTtBQUN4QyxXQUFLLGtCQUFrQixRQUFRLFlBQVU7QUFDeEMsWUFBSSxPQUFPLGdCQUFnQixlQUFlLHdCQUF3QjtBQUNqRSxpQkFBTyxjQUFjO0FBQUEsUUFDdEI7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFQSxhQUFhO0FBQ1osV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsOEJBQThCO0FBQzdCLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVBLGtCQUErQztBQUM5QyxXQUFPLEtBQUssVUFBVTtBQUFBLEVBQ3ZCO0FBQUEsRUFFQSx5QkFBeUIsdUJBQXFEO0FBQzdFLFNBQUssd0JBQXdCO0FBQUEsRUFDOUI7QUFBQSxFQUVBLDJCQUEyQix5QkFBbUQ7QUFDN0UsU0FBSyx3QkFBd0IsYUFBYSx1QkFBdUI7QUFBQSxFQUNsRTtBQUFBLEVBRUEsTUFBTSxTQUFTLFdBQThCLFdBQWlELE1BQTBCLFVBQWtDO0FBQ3pKLFFBQUksS0FBSyxjQUFjLFVBQWEsQ0FBQyxLQUFLLFVBQVUsTUFBTSxTQUFTLEdBQUc7QUFDckUsWUFBTSw2QkFBNkIsS0FBSyxpQkFBaUIsK0JBQStCLEtBQUssV0FBVyxRQUFRO0FBQ2hILFdBQUssYUFBYTtBQUNsQixZQUFNLEtBQUssYUFBYSxXQUFXLFlBQVksVUFBVSxVQUFVLFdBQVcsSUFBSTtBQUNsRixZQUFNLDZCQUE2QixLQUFLLGlCQUFpQiwrQkFBK0IsS0FBSyxXQUFXLFFBQVE7QUFFaEgsVUFBSSwyQkFBMkIscUJBQXFCLDJCQUEyQixvQkFDM0UsMkJBQTJCLHdCQUF3QiwyQkFBMkIscUJBQXFCO0FBQ3RHLGFBQUssZUFBZSxPQUFPO0FBQzNCLGFBQUssb0JBQW9CO0FBQ3pCLGFBQUssVUFBVSxjQUFjO0FBQUEsVUFDNUIsR0FBRyxLQUFLLGdCQUFnQixzQkFBc0I7QUFBQSxVQUM5QyxZQUFZLEtBQUssb0JBQW9CO0FBQUEsUUFDdEMsQ0FBQztBQUFBLE1BQ0Y7QUFpQkEsV0FBSyxpQkFBaUIsV0FBNEUseUJBQXlCO0FBQUEsUUFDMUgsUUFBUSxVQUFVLElBQUk7QUFBQSxRQUN0QixLQUFLLFFBQVEsVUFBVSxHQUFHO0FBQUEsUUFDMUIsVUFBVSxVQUFVO0FBQUEsUUFDcEIsUUFBUSxLQUFLO0FBQUEsTUFDZCxDQUFDO0FBQUEsSUFDRixPQUFPO0FBQ04sV0FBSyxxQkFBcUIsU0FBUztBQUFBLElBQ3BDO0FBRUEsU0FBSyx1QkFBdUIsU0FBUztBQUdyQyxTQUFLLG9CQUFvQjtBQUd6QixTQUFLLGdCQUFnQixxQkFBcUI7QUFFMUMsU0FBSyxZQUFZLElBQUksS0FBSyxNQUFNLGlCQUFpQixNQUFNO0FBQ3RELFdBQUssK0JBQStCO0FBQUEsSUFDckMsQ0FBQyxDQUFDO0FBRUYsU0FBSywrQkFBK0I7QUFFcEMsU0FBSyw2QkFBNkI7QUFBQSxFQUNuQztBQUFBLEVBR1EsK0JBQStCO0FBQ3RDLFFBQUksS0FBSyxrQ0FBa0M7QUFDMUM7QUFBQSxJQUNEO0FBRUEsU0FBSyxtQ0FBbUM7QUFDeEMsUUFBSSxrQkFBa0IsSUFBSSxVQUFVLEtBQUssV0FBVyxDQUFDLEdBQUcsQ0FBQyxhQUFhO0FBQ3JFLFdBQUsseUNBQXlDLFFBQVE7QUFBQSxJQUN2RCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRVEseUNBQXlDLFVBQXdCO0FBQ3hFLFVBQU0sVUFBVSxLQUFLLElBQUksSUFBSSxTQUFTLGNBQWM7QUFFcEQsVUFBTSxVQUFVLE1BQU07QUFDckIsVUFBSTtBQUNILGFBQUssbUNBQW1DO0FBQ3hDLFlBQUksS0FBSyxhQUFhO0FBQ3JCO0FBQUEsUUFDRDtBQUVBLFlBQUksQ0FBQyxLQUFLLFdBQVc7QUFDcEI7QUFBQSxRQUNEO0FBRUEsY0FBTSxrQkFBa0IsS0FBSyxVQUFVLFVBQVUsS0FBSyxVQUFRLEtBQUssYUFBYSxTQUFTLFVBQVUsQ0FBQyxLQUFLLFVBQVUscUJBQXFCLElBQUksS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLLGFBQWEsSUFBSSxDQUFDO0FBQ2hMLFlBQUksQ0FBQyxpQkFBaUI7QUFDckI7QUFBQSxRQUNEO0FBRUEsYUFBSyxvQkFBb0IsZUFBZTtBQUFBLE1BQ3pDLFVBQUU7QUFDRCxhQUFLLG1DQUFtQztBQUFBLE1BQ3pDO0FBRUEsVUFBSSxLQUFLLElBQUksSUFBSSxTQUFTO0FBQ3pCLG9CQUFZLE9BQU87QUFBQSxNQUNwQixPQUFPO0FBQ04sYUFBSyw2QkFBNkI7QUFBQSxNQUNuQztBQUFBLElBQ0Q7QUFFQSxZQUFRO0FBQUEsRUFDVDtBQUFBLEVBRVEsaUNBQWlDO0FBQ3hDLFFBQUksQ0FBQyxLQUFLLFdBQVc7QUFDcEI7QUFBQSxJQUNEO0FBRUEsVUFBTSxVQUFVLEtBQUssTUFBTSxtQkFBbUIsRUFBRSxDQUFDO0FBQ2pELFFBQUksU0FBUztBQUNaLFVBQUksQ0FBQyxLQUFLLHdCQUF3QjtBQUNqQyxhQUFLLHlCQUF5QixLQUFLLFlBQVksSUFBSSxLQUFLLHFCQUFxQixlQUFlLHVCQUF1QixNQUFNLE9BQXdCLENBQUM7QUFBQSxNQUNuSjtBQUVBLFdBQUssdUJBQXVCLGlCQUFpQixPQUF3QjtBQUFBLElBQ3RFO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBTSxXQUFXLFNBQTZDO0FBQzdELFFBQUksU0FBUyxlQUFlLFFBQVc7QUFDdEMsV0FBSyxZQUFZLFNBQVM7QUFBQSxJQUMzQjtBQUVBLFFBQUksQ0FBQyxLQUFLLFdBQVc7QUFDcEI7QUFBQSxJQUNEO0FBRUEsU0FBSyxVQUFVLGNBQWMsRUFBRSxZQUFZLEtBQUssVUFBVSxDQUFDO0FBQzNELFNBQUssZ0JBQWdCLGNBQWMsS0FBSyxTQUFTO0FBR2pELFVBQU0sY0FBYyxTQUFTLGVBQWUsS0FBSyx5QkFBeUIsT0FBTztBQUNqRixRQUFJLGFBQWE7QUFDaEIsWUFBTSxPQUFPLEtBQUssVUFBVSxVQUFVLEtBQUssQ0FBQUEsVUFBUUEsTUFBSyxJQUFJLFNBQVMsTUFBTSxZQUFZLFNBQVMsU0FBUyxDQUFDO0FBQzFHLFVBQUksTUFBTTtBQUNULGFBQUssYUFBYSxJQUFJO0FBQ3RCLGNBQU0sWUFBWSxZQUFZLFNBQVM7QUFDdkMsWUFBSSxXQUFXO0FBQ2QsZUFBSyxnQkFBZ0IsY0FBYyxTQUFTLFlBQVk7QUFDeEQsZUFBSyxZQUFZLGNBQWM7QUFDL0IsZ0JBQU0sS0FBSywwQ0FBMEMsTUFBTSxJQUFJLE1BQU0sVUFBVSxpQkFBaUIsVUFBVSxhQUFhLFVBQVUsaUJBQWlCLFVBQVUsaUJBQWlCLFVBQVUsYUFBYSxVQUFVLFdBQVcsQ0FBQztBQUFBLFFBQzNOLE9BQU87QUFDTixlQUFLLE1BQU0sV0FBVyxNQUFNLFNBQVMsa0JBQWtCLGVBQWUsdUJBQXVCO0FBQUEsUUFDOUY7QUFFQSxjQUFNLFNBQVMsS0FBSyxpQkFBaUIsSUFBSSxJQUFJO0FBQzdDLFlBQUksUUFBUTtBQUNYLGNBQUksWUFBWSxTQUFTLFdBQVc7QUFDbkMsa0JBQU0sRUFBRSxXQUFBQyxXQUFVLElBQUksWUFBWTtBQUNsQyxrQkFBTSxrQkFBa0IsSUFBSSxNQUFNQSxXQUFVLGlCQUFpQkEsV0FBVSxhQUFhQSxXQUFVLGlCQUFpQkEsV0FBVSxpQkFBaUJBLFdBQVUsYUFBYUEsV0FBVSxXQUFXO0FBQ3RMLG1CQUFPLGFBQWEsZUFBZTtBQUNuQyxtQkFBTyx3Q0FBd0M7QUFBQSxjQUM5QyxZQUFZQSxXQUFVO0FBQUEsY0FDdEIsUUFBUUEsV0FBVTtBQUFBLFlBQ25CLENBQUM7QUFDRCxrQkFBTSxLQUFLLDBDQUEwQyxNQUFNLGVBQWU7QUFBQSxVQUMzRTtBQUNBLGNBQUksQ0FBQyxZQUFZLFNBQVMsZUFBZTtBQUN4QyxtQkFBTyxNQUFNO0FBQUEsVUFDZDtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUtBLFFBQUksU0FBUyxnQkFBZ0I7QUFDNUIsWUFBTSxpQkFBaUIsUUFBUSxlQUFlLENBQUMsRUFBRTtBQUNqRCxZQUFNLGNBQWMsS0FBSyxVQUFVLE9BQU8sY0FBYztBQUN4RCxVQUFJLGFBQWE7QUFDaEIsYUFBSyxVQUFVLHNCQUFzQjtBQUFBLFVBQ3BDLE1BQU0sbUJBQW1CO0FBQUEsVUFDekIsT0FBTyxFQUFFLE9BQU8sZ0JBQWdCLEtBQUssaUJBQWlCLEVBQUU7QUFBQSxVQUN4RCxZQUFZLFFBQVE7QUFBQSxRQUNyQixDQUFDO0FBQ0QsYUFBSyxnQ0FBZ0MsV0FBVztBQUFBLE1BQ2pEO0FBQUEsSUFDRDtBQUVBLFNBQUssa0JBQWtCO0FBQ3ZCLFNBQUssb0JBQW9CLEtBQUs7QUFBQSxFQUMvQjtBQUFBLEVBRVEseUJBQXlCLFNBQTZDO0FBQzdFLFFBQUksU0FBUyxvQkFBb0I7QUFFaEMsWUFBTSxPQUFPLEtBQUssT0FBTyxRQUFRLG1CQUFtQixLQUFLO0FBQ3pELFVBQUksTUFBTTtBQUNULGVBQU87QUFBQSxVQUNOLFVBQVUsS0FBSztBQUFBLFVBQ2YsU0FBUztBQUFBLFlBQ1IsV0FBVyxRQUFRLG1CQUFtQjtBQUFBLFlBQ3RDLGVBQWU7QUFBQSxVQUNoQjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxlQUFlO0FBQ3RCLFNBQUssWUFBWSxNQUFNO0FBQ3ZCLFlBQVEsS0FBSyx3QkFBd0I7QUFDckMsU0FBSyxNQUFNLGdCQUFnQjtBQUMzQixTQUFLLFdBQVcsUUFBUTtBQUV4QixTQUFLLFlBQVk7QUFDakIsU0FBSyxVQUFVLFFBQVE7QUFDdkIsU0FBSyxVQUFVLFFBQVEsT0FBTztBQUM5QixTQUFLLFdBQVc7QUFDaEIsU0FBSyxNQUFNLE1BQU07QUFBQSxFQUNsQjtBQUFBLEVBR1Esb0JBQTBCO0FBQ2pDLFFBQUksQ0FBQyxLQUFLLFdBQVc7QUFDcEI7QUFBQSxJQUNEO0FBRUEsU0FBSyxnQkFBZ0IsSUFBSSxDQUFDLEtBQUssVUFBVSxRQUFRLFVBQVU7QUFDM0QsU0FBSyxtQkFBbUIsVUFBVSxPQUFPLDRCQUE0QixDQUFDLEtBQUssVUFBVSxRQUFRLFVBQVU7QUFDdkcsU0FBSyxXQUFXLEVBQUUsVUFBVSxPQUFPLDRCQUE0QixDQUFDLEtBQUssVUFBVSxRQUFRLFVBQVU7QUFBQSxFQUNsRztBQUFBLEVBRUEsTUFBYyxrQkFBcUU7QUFDbEYsUUFBSSxDQUFDLEtBQUssV0FBVztBQUNwQixhQUFPO0FBQUEsSUFDUjtBQUVBLFFBQUksS0FBSyx3QkFBd0I7QUFDaEMsYUFBTyxLQUFLO0FBQUEsSUFDYjtBQUVBLFFBQUksQ0FBQyxLQUFLLFVBQVU7QUFDbkIsV0FBSyxlQUFlLEtBQUssTUFBTSxHQUFHLEtBQUssVUFBVSxVQUFVLEtBQUssVUFBVSxHQUFHO0FBQUEsSUFDOUU7QUFFQSxTQUFLLDBCQUEwQixZQUFZO0FBQzFDLFVBQUksQ0FBQyxLQUFLLFVBQVU7QUFDbkIsY0FBTSxJQUFJLE1BQU0sNkRBQTZEO0FBQUEsTUFDOUU7QUFFQSxZQUFNLEtBQUssU0FBUyxjQUFjLEtBQUssZ0JBQWdCLGNBQWMsVUFBVTtBQUMvRSxVQUFJLENBQUMsS0FBSyxTQUFTLFNBQVM7QUFDM0IsY0FBTSxJQUFJLE1BQU0sK0RBQStEO0FBQUEsTUFDaEY7QUFFQSxXQUFLLFlBQVksSUFBSSxLQUFLLFNBQVMsUUFBUSxVQUFVLE1BQU07QUFDMUQsYUFBSyxhQUFhLElBQUksS0FBSztBQUMzQixhQUFLLGtCQUFrQjtBQUV2QixhQUFLLGtCQUFrQjtBQUN2QixhQUFLLG9CQUFvQjtBQUFBLE1BQzFCLENBQUMsQ0FBQztBQUVGLFdBQUssWUFBWSxJQUFJLEtBQUssU0FBUyxRQUFRLFdBQVcsTUFBTTtBQUMzRCxhQUFLLGFBQWEsSUFBSSxJQUFJO0FBQzFCLGFBQUssa0JBQWtCO0FBQ3ZCLGFBQUssa0JBQWtCO0FBQUEsTUFDeEIsQ0FBQyxDQUFDO0FBRUYsV0FBSyxZQUFZLElBQUksS0FBSyxTQUFTLFVBQVUsT0FBSztBQUNqRCxhQUFLLHFCQUFxQixLQUFLLENBQUM7QUFBQSxNQUNqQyxDQUFDLENBQUM7QUFFRixhQUFPLEtBQUs7QUFBQSxJQUNiLEdBQUc7QUFFSCxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFUSxlQUFlLElBQVksVUFBa0IsVUFBZTtBQUNuRSxRQUFJLEtBQUssVUFBVTtBQUNsQjtBQUFBLElBQ0Q7QUFFQSxVQUFNLE9BQU87QUFFYixTQUFLLFdBQVcsS0FBSyxxQkFBcUIsZUFBZSxrQkFBa0I7QUFBQSxNQUMxRSxJQUFJLGtCQUFrQjtBQUFFLGVBQU8sS0FBSztBQUFBLE1BQWlCO0FBQUEsTUFDckQsYUFBYSxXQUFtQjtBQUFFLGFBQUssTUFBTSxZQUFZO0FBQUEsTUFBVztBQUFBLE1BQ3BFLGNBQWMsT0FBeUI7QUFBRSxhQUFLLE1BQU0saUNBQWlDLEtBQUs7QUFBQSxNQUFHO0FBQUEsTUFDN0YsZUFBZSxLQUFLLGNBQWMsS0FBSyxJQUFJO0FBQUEsTUFDM0MsYUFBYSxLQUFLLGFBQWEsS0FBSyxJQUFJO0FBQUEsTUFDeEMsNkJBQTZCLEtBQUssNkJBQTZCLEtBQUssSUFBSTtBQUFBLE1BQ3hFLG1CQUFtQixLQUFLLGtCQUFrQixLQUFLLElBQUk7QUFBQSxNQUNuRCx1QkFBdUIsS0FBSyxzQkFBc0IsS0FBSyxJQUFJO0FBQUEsTUFDM0Qsb0JBQW9CLEtBQUssb0JBQW9CLEtBQUssSUFBSTtBQUFBLE1BQ3RELHlCQUF5QixLQUFLLHlCQUF5QixLQUFLLElBQUk7QUFBQSxNQUNoRSx3QkFBd0IsS0FBSyx3QkFBd0IsS0FBSyxJQUFJO0FBQUEsTUFDOUQsd0JBQXdCLEtBQUssd0JBQXdCLEtBQUssSUFBSTtBQUFBLE1BQzlELHdCQUF3QixLQUFLLHdCQUF3QixLQUFLLElBQUk7QUFBQSxNQUM5RCxtQkFBbUIsS0FBSyxtQkFBbUIsS0FBSyxJQUFJO0FBQUEsTUFDcEQsbUJBQW1CLEtBQUssbUJBQW1CLEtBQUssSUFBSTtBQUFBLE1BQ3BELHNCQUFzQixLQUFLLHNCQUFzQixLQUFLLElBQUk7QUFBQSxNQUMxRCxpQkFBaUIsS0FBSyxpQkFBaUIsS0FBSyxJQUFJO0FBQUEsTUFDaEQsMkJBQTJCLEtBQUssMkJBQTJCLEtBQUssSUFBSTtBQUFBLE1BQ3BFLDJCQUEyQixLQUFLLDJCQUEyQixLQUFLLElBQUk7QUFBQSxJQUNyRSxHQUFHLElBQUksVUFBVSxVQUFVO0FBQUEsTUFDMUIsR0FBRyxLQUFLLGlCQUFpQixzQkFBc0I7QUFBQSxNQUMvQyxZQUFZLEtBQUssb0JBQW9CO0FBQUEsSUFDdEMsR0FBRyxLQUFLLDBCQUEwQixVQUFVLEtBQUssS0FBSyxDQUFDO0FBRXZELFNBQUssU0FBUyxRQUFRLE1BQU0sUUFBUTtBQUdwQyxTQUFLLE1BQU0sY0FBYyxLQUFLLFNBQVMsT0FBTztBQUFBLEVBQy9DO0FBQUEsRUFFQSxNQUFjLGFBQWEsV0FBOEIsVUFBa0IsV0FBaUQsTUFBMEI7QUFDckosU0FBSyxlQUFlLEtBQUssTUFBTSxHQUFHLFVBQVUsVUFBVSxVQUFVLEdBQUc7QUFFbkUsU0FBSyxZQUFZLEtBQUsscUJBQXFCLGVBQWUsbUJBQW1CLFVBQVUsV0FBVyxLQUFLLGNBQWMsS0FBSyxjQUFjLEdBQUcsRUFBRSxZQUFZLEtBQUssVUFBVSxDQUFDO0FBQ3pLLFNBQUssYUFBYSxnQkFBZ0IsS0FBSyxDQUFDLElBQUksMkJBQTJCLEVBQUUsT0FBTyxNQUFNLFVBQVUsS0FBSyxHQUFHLEtBQUssY0FBYyxDQUFDLENBQUMsQ0FBQztBQUM5SCxTQUFLLGdCQUFnQixjQUFjLEtBQUssU0FBUztBQUVqRCxTQUFLLGtCQUFrQjtBQUN2QixTQUFLLGdDQUFnQztBQUlyQztBQUVDLFdBQUssVUFBVSx1QkFBdUIsU0FBUztBQUkvQyxZQUFNLHFCQUFxQixXQUFXLHNCQUFzQixDQUFDO0FBQzdELGlCQUFXLENBQUMsSUFBSSxZQUFZLEtBQUssS0FBSyxnQkFBZ0I7QUFDckQsWUFBSSxPQUFPLGFBQWEscUJBQXFCLFlBQVk7QUFDeEQsdUJBQWEsaUJBQWlCLG1CQUFtQixFQUFFLENBQUM7QUFBQSxRQUNyRDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBRUEsU0FBSyxZQUFZLElBQUksS0FBSyxVQUFVLHFCQUFxQixPQUFLO0FBQzdELFdBQUssc0JBQXNCLEtBQUssQ0FBQztBQUFBLElBQ2xDLENBQUMsQ0FBQztBQUVGLFNBQUssWUFBWSxJQUFJLEtBQUssVUFBVSxxQkFBcUIsTUFBTTtBQUM5RCxXQUFLLHNCQUFzQixLQUFLO0FBQ2hDLFdBQUssK0JBQStCO0FBQUEsSUFDckMsQ0FBQyxDQUFDO0FBRUYsU0FBSyxZQUFZLElBQUksS0FBSyxNQUFNLGFBQWEsT0FBSztBQUNqRCxVQUFJLEtBQUssVUFBVSxXQUFXLEdBQUc7QUFDaEMsYUFBSyx5QkFBMEIsTUFBTSxZQUFZLGNBQWMsRUFBRSxTQUFTO0FBQUEsTUFDM0U7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFFBQUksZ0NBQWdDO0FBQ3BDLFNBQUssWUFBWSxJQUFJLEtBQUssTUFBTSx5QkFBeUIsTUFBTTtBQUM5RCxVQUFJLCtCQUErQjtBQUNsQztBQUFBLE1BQ0Q7QUFDQSxzQ0FBZ0M7QUFFaEMsV0FBSyxZQUFZLElBQUksSUFBSSw2QkFBNkIsSUFBSSxVQUFVLEtBQUssV0FBVyxDQUFDLEdBQUcsTUFBTTtBQUM3Rix3Q0FBZ0M7QUFDaEMsYUFBSyxvQkFBb0I7QUFBQSxNQUMxQixHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ1IsQ0FBQyxDQUFDO0FBRUYsU0FBSyxZQUFZLElBQUksS0FBSyxNQUFNLG1CQUFtQixhQUFXO0FBQzdELGNBQVEsUUFBUSxZQUFVLEtBQUssWUFBWSxNQUFNLENBQUM7QUFBQSxJQUNuRCxDQUFDLENBQUM7QUFDRixTQUFLLFlBQVksSUFBSSxLQUFLLE1BQU0saUJBQWlCLGFBQVc7QUFDM0QsY0FBUSxRQUFRLFlBQVUsS0FBSyxVQUFVLE1BQU0sQ0FBQztBQUFBLElBQ2pELENBQUMsQ0FBQztBQUNGLFNBQUssWUFBWSxJQUFJLEtBQUssTUFBTSx5QkFBeUIsV0FBUztBQUNqRSxZQUFNLGNBQXFDLENBQUM7QUFDNUMsWUFBTSxlQUFzQyxDQUFDO0FBRTdDLGlCQUFXLFFBQVEsT0FBTztBQUN6QixZQUFJLEtBQUssYUFBYSxTQUFTLFFBQVE7QUFDdEMsZ0JBQU0sU0FBUztBQUNmLGNBQUksS0FBSyxXQUFXLFVBQVUsS0FBSyxDQUFBRCxVQUFRQSxNQUFLLFdBQVcsT0FBTyxNQUFNLEdBQUc7QUFFMUUsd0JBQVksS0FBSyxNQUFNO0FBQUEsVUFDeEIsT0FBTztBQUVOLHlCQUFhLEtBQUssTUFBTTtBQUFBLFVBQ3pCO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFFQSxXQUFLLG1CQUFtQixXQUFXO0FBQ25DLFdBQUsscUJBQXFCLFlBQVk7QUFBQSxJQUN2QyxDQUFDLENBQUM7QUFHRixVQUFNLEtBQUssNEJBQTRCLEtBQUssV0FBVyxXQUFXLElBQUk7QUFFdEUsVUFBTSxLQUFLLHNCQUFzQjtBQUdqQyxTQUFLLDJCQUEyQixLQUFLLFVBQVUsVUFBVSxJQUFJLFVBQVEsS0FBSyxrQkFBa0IsSUFBSSxDQUFDO0FBQ2pHLFNBQUssMkJBQTJCLEtBQUssVUFBVSxVQUFVLEtBQUssY0FBWSxLQUFLLGNBQWMsTUFBTSxZQUFZLFNBQVMsY0FBYyxjQUFjLE1BQU0sS0FBSztBQUUvSixTQUFLLFlBQVksSUFBSSxLQUFLLFVBQVUscUJBQXFCLENBQUMsTUFBTTtBQUMvRCxVQUFJLEtBQUssYUFBYTtBQUNyQjtBQUFBLE1BQ0Q7QUFHQSxPQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLFFBQVEsWUFBVTtBQUMxQyxjQUFNLENBQUMsT0FBTyxTQUFTLFFBQVEsSUFBSTtBQUNuQyxjQUFNLGVBQWUsS0FBSyx5QkFBeUIsT0FBTyxPQUFPLFNBQVMsR0FBRyxTQUFTLElBQUksVUFBUSxLQUFLLGtCQUFrQixJQUFJLENBQUMsQ0FBQztBQUUvSCxnQkFBUSxZQUFZO0FBQUEsTUFDckIsQ0FBQztBQUVELFVBQUksRUFBRSxRQUFRLEtBQUssT0FBSyxFQUFFLENBQUMsRUFBRSxLQUFLLFVBQVEsS0FBSyxhQUFhLFNBQVMsTUFBTSxDQUFDLEdBQUc7QUFDOUUsYUFBSyw2QkFBNkI7QUFBQSxNQUNuQztBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsUUFBSSxLQUFLLFlBQVk7QUFDcEIsV0FBSyxNQUFNLE9BQU8sS0FBSyxjQUFjLEtBQUssV0FBVyxNQUFNLEdBQUcsS0FBSyxXQUFXLEtBQUs7QUFBQSxJQUNwRixPQUFPO0FBQ04sV0FBSyxNQUFNLE9BQU87QUFBQSxJQUNuQjtBQUVBLFNBQUssZ0JBQWdCLHFCQUFxQjtBQUcxQyxTQUFLLHFCQUFxQixTQUFTO0FBQUEsRUFDcEM7QUFBQSxFQUVRLGtCQUFrQixNQUFzQjtBQUMvQyxVQUFNLFFBQVEsSUFBSSxnQkFBZ0I7QUFFbEMsVUFBTSxJQUFJLEtBQUssa0JBQWtCLE9BQUs7QUFFckMsVUFBSSxFQUFFLGVBQWUsRUFBRSxZQUFZO0FBQ2xDLGFBQUssbUJBQW1CLE1BQU0sS0FBSyxXQUFXLGFBQWEsRUFBRSxPQUFPO0FBQUEsTUFDckU7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFFBQUksS0FBSyxhQUFhLFNBQVMsTUFBTTtBQUNwQyxZQUFNLElBQUssS0FBMkIsbUJBQW1CLENBQUMsWUFBWTtBQUNyRSxnQkFBUSxRQUFRLFlBQVUsS0FBSyxZQUFZLE1BQU0sQ0FBQztBQUFBLE1BQ25ELENBQUMsQ0FBQztBQUFBLElBQ0g7QUFFQSxVQUFNLElBQUssS0FBdUIsaUJBQWlCLE9BQUs7QUFDdkQsVUFBSSxFQUFFLHlCQUF5QixLQUFLLG9CQUFvQixLQUFLLGFBQWEsU0FBUyxRQUFRO0FBQzFGLGFBQUssbUJBQW1CLENBQUUsSUFBNEIsQ0FBQztBQUFBLE1BQ3hEO0FBRUEsVUFBSSxFQUFFLDBCQUEwQixLQUFLLHFCQUFxQixLQUFLLGFBQWEsU0FBUyxNQUFNO0FBQzFGLGFBQUssa0JBQWtCLFFBQVEsWUFBVSxLQUFLLFVBQVUsTUFBTSxDQUFDO0FBQUEsTUFDaEU7QUFFQSxVQUFJLEVBQUUsa0JBQWtCO0FBQ3ZCLGFBQUssdUJBQXVCLElBQUk7QUFBQSxNQUNqQztBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsVUFBTSxJQUFJLEtBQUsseUJBQXlCLE9BQUs7QUFDNUMsUUFBRSxNQUFNLFFBQVEsYUFBVztBQUMxQixZQUFJLFFBQVEsV0FBVztBQUN0QixlQUFLLDZCQUE2QixLQUFLLElBQUksQ0FBQyxRQUFRLFNBQVMsR0FBRyxDQUFDLEdBQUcsS0FBSyxRQUFRO0FBQUEsUUFDbEY7QUFFQSxZQUFJLFFBQVEsaUJBQWlCO0FBQzVCLGVBQUssNkJBQTZCLEtBQUssSUFBSSxDQUFDLFFBQVEsZUFBZSxHQUFHLENBQUMsR0FBRyxLQUFLLFFBQVE7QUFBQSxRQUN4RjtBQUFBLE1BQ0QsQ0FBQztBQUVELFFBQUUsUUFBUSxRQUFRLGFBQVc7QUFDNUIsWUFBSSxRQUFRLFdBQVc7QUFDdEIsZUFBSyw2QkFBNkIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsU0FBUyxHQUFHLEtBQUssUUFBUTtBQUFBLFFBQ2xGO0FBRUEsWUFBSSxRQUFRLGlCQUFpQjtBQUM1QixlQUFLLDZCQUE2QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxlQUFlLEdBQUcsS0FBSyxRQUFRO0FBQUEsUUFDeEY7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGLENBQUMsQ0FBQztBQUVGLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFJUSx1QkFBdUIsTUFBc0I7QUFDcEQsUUFBSSxLQUFLLGNBQWMsY0FBYyxRQUFRO0FBQzVDO0FBQUEsSUFDRDtBQUVBLFFBQUksS0FBSyw0QkFBNEIsS0FBSyw2QkFBNkIsTUFBTTtBQUM1RSxXQUFLLHlCQUF5QixZQUFZLGNBQWM7QUFBQSxJQUN6RDtBQUVBLFNBQUssMkJBQTJCO0FBQUEsRUFDakM7QUFBQSxFQUVBLE1BQWMsNEJBQTRCLFdBQThCLFdBQWlELE1BQTBCO0FBRWxKLFNBQUssV0FBVyxNQUFNLHdCQUF3QixZQUFZLEtBQUssV0FBVyxJQUFJLFNBQVMsQ0FBQztBQUN4RixVQUFNLEtBQUssZ0JBQWdCO0FBQzNCLFVBQU0sS0FBSyxtQkFBbUI7QUFFOUIsU0FBSyxXQUFXLE1BQU0sd0JBQXdCLDJCQUEyQjtBQUd6RSxTQUFLLFNBQVUsUUFBUSxNQUFNLGFBQWE7QUFFMUMsVUFBTSxLQUFLLDZCQUE2QixXQUFXLFNBQVM7QUFDNUQsU0FBSyxXQUFXLE1BQU0sd0JBQXdCLDZCQUE2QjtBQVUzRSxTQUFLLE1BQU0sT0FBTyxHQUFHLENBQUM7QUFDdEIsU0FBSyxNQUFNLGdCQUFnQixTQUFTO0FBS3BDLFNBQUssTUFBTSxZQUFZLFdBQVcsZ0JBQWdCLE9BQU87QUFDekQsU0FBSyxPQUFPLHdEQUF3RDtBQUNwRSxTQUFLLFNBQVUsUUFBUSxNQUFNLGFBQWE7QUFDMUMsU0FBSyxXQUFXLE1BQU0sd0JBQXdCLG1EQUFtRDtBQUNqRyxTQUFLLHNCQUFzQixLQUFLO0FBQUEsRUFDakM7QUFBQSxFQUVBLE1BQWMsNkJBQTZCLFdBQThCLFdBQWlEO0FBQ3pILFFBQUksYUFBYSxVQUFVLGtCQUFrQjtBQUM1QyxZQUFNLG1CQUFtQixVQUFVO0FBQ25DLFlBQU0sWUFBWSxVQUFVLGdCQUFnQixPQUFPO0FBQ25ELFlBQU0sZUFBZSxZQUFZLEtBQUssSUFBSSxLQUFLLFlBQVksVUFBVSxHQUFHLElBQUk7QUFFNUUsVUFBSSxTQUFTO0FBQ2IsWUFBTSxXQUF1QyxDQUFDO0FBRTlDLGVBQVMsSUFBSSxHQUFHLElBQUksVUFBVSxRQUFRLEtBQUs7QUFDMUMsY0FBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQy9CLGNBQU0sYUFBYSxpQkFBaUIsQ0FBQyxLQUFLO0FBRTFDLFlBQUksU0FBUyxhQUFhLFdBQVc7QUFDcEMsb0JBQVU7QUFDVjtBQUFBLFFBQ0Q7QUFFQSxZQUFJLEtBQUssYUFBYSxTQUFTLFFBQVE7QUFDdEMsbUJBQVMsS0FBSyxDQUFDLE1BQU0sTUFBTSxDQUFDO0FBQUEsUUFDN0I7QUFFQSxrQkFBVTtBQUVWLFlBQUksU0FBUyxjQUFjO0FBQzFCO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFFQSxZQUFNLEtBQUssU0FBVSxpQkFBaUIsU0FBUyxJQUFJLENBQUMsQ0FBQyxPQUFPRSxPQUFNLE1BQU0sS0FBSywrQkFBK0IsT0FBT0EsT0FBTSxDQUFDLENBQUM7QUFBQSxJQUM1SCxPQUFPO0FBQ04sWUFBTSxlQUFlLFVBQVUsVUFDN0IsT0FBTyxVQUFRLEtBQUssYUFBYSxTQUFTLE1BQU0sRUFDaEQsTUFBTSxHQUFHLENBQUMsRUFDVixJQUFJLFVBQVEsS0FBSywrQkFBK0IsTUFBTSxJQUFNLENBQUM7QUFFL0QsWUFBTSxLQUFLLFNBQVUsaUJBQWlCLFlBQVk7QUFJbEQsVUFBSSxTQUFTO0FBQ2IsWUFBTSx1QkFBc0QsQ0FBQztBQUM3RCxZQUFNLGVBQWUsS0FBSyxJQUFJLEtBQUssWUFBWSxVQUFVLEdBQUcsSUFBSTtBQUNoRSxpQkFBVyxRQUFRLFVBQVUsV0FBVztBQUN2QyxZQUFJLEtBQUssYUFBYSxTQUFTLFFBQVE7QUFDdEMsK0JBQXFCLEtBQUssRUFBRSxJQUFJLEtBQUssSUFBSSxLQUFLLE9BQU8sQ0FBQztBQUFBLFFBQ3ZEO0FBRUEsa0JBQVUsS0FBSyxVQUFVLEtBQUssY0FBYyxFQUFFLFNBQVMsVUFBVTtBQUVqRSxZQUFJLFNBQVMsY0FBYztBQUMxQjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBRUEsV0FBSyxVQUFVLGlCQUFpQixDQUFDLEdBQUcsb0JBQW9CO0FBQUEsSUFDekQ7QUFBQSxFQUNEO0FBQUEsRUFFUSwrQkFBK0IsT0FBdUIsUUFBMkM7QUFDeEcsV0FBUTtBQUFBLE1BQ1AsTUFBTSxNQUFNO0FBQUEsTUFDWixRQUFRLE1BQU07QUFBQSxNQUNkLFlBQVksTUFBTTtBQUFBLE1BQ2xCLFNBQVMsTUFBTSxRQUFRO0FBQUEsTUFDdkI7QUFBQSxNQUNBLFNBQVM7QUFBQSxNQUNULFVBQVUsTUFBTTtBQUFBLElBQ2pCO0FBQUEsRUFDRDtBQUFBLEVBRUEscUJBQXFCLFdBQXVEO0FBQzNFLFFBQUksQ0FBQyxLQUFLLFdBQVc7QUFDcEI7QUFBQSxJQUNEO0FBRUEsUUFBSSxXQUFXLG1CQUFtQixRQUFXO0FBQzVDLFdBQUssTUFBTSxZQUFZLFVBQVUsZUFBZTtBQUNoRCxXQUFLLE1BQU0sYUFBYSxVQUFVLGVBQWU7QUFBQSxJQUNsRCxPQUFPO0FBQ04sV0FBSyxNQUFNLFlBQVk7QUFDdkIsV0FBSyxNQUFNLGFBQWE7QUFBQSxJQUN6QjtBQUVBLFVBQU0sV0FBVyxPQUFPLFdBQVcsVUFBVSxXQUFXLFVBQVUsUUFBUTtBQUMxRSxRQUFJLFdBQVcsS0FBSyxVQUFVLFFBQVE7QUFDckMsWUFBTSxVQUFVLEtBQUssVUFBVSxPQUFPLFFBQVE7QUFDOUMsVUFBSSxTQUFTO0FBQ1osYUFBSyxXQUFXLHNCQUFzQjtBQUFBLFVBQ3JDLE1BQU0sbUJBQW1CO0FBQUEsVUFDekIsU0FBUyxRQUFRO0FBQUEsVUFDakIsWUFBWSxDQUFDLFFBQVEsTUFBTTtBQUFBLFFBQzVCLENBQUM7QUFBQSxNQUNGO0FBQUEsSUFDRCxXQUFXLEtBQUssTUFBTSxTQUFTLEdBQUc7QUFDakMsV0FBSyxVQUFVLHNCQUFzQjtBQUFBLFFBQ3BDLE1BQU0sbUJBQW1CO0FBQUEsUUFDekIsT0FBTyxFQUFFLE9BQU8sR0FBRyxLQUFLLEVBQUU7QUFBQSxRQUMxQixZQUFZLENBQUMsRUFBRSxPQUFPLEdBQUcsS0FBSyxFQUFFLENBQUM7QUFBQSxNQUNsQyxDQUFDO0FBQUEsSUFDRjtBQUVBLFFBQUksV0FBVyxlQUFlO0FBQzdCLFlBQU0sT0FBTyxLQUFLLFVBQVUsT0FBTyxRQUFRO0FBQzNDLFVBQUksTUFBTTtBQUNULGFBQUssWUFBWSxjQUFjO0FBQUEsTUFDaEM7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRVEsdUJBQXVCLFdBQXVEO0FBQ3JGLFFBQUksV0FBVyxvQkFBb0IsS0FBSyxXQUFXO0FBQ2xELFlBQU0sV0FBVyxLQUFLLHNCQUFzQixrQkFBa0IsS0FBSyxTQUFTO0FBQzVFLFlBQU0sU0FBUyxTQUFTLElBQUksS0FBSyxPQUFLLEVBQUUsT0FBTyxVQUFVLGdCQUFnQjtBQUd6RSxVQUFJLFVBQVUsQ0FBQyxTQUFTLFVBQVU7QUFDakMsYUFBSyxzQkFBc0Isd0JBQXdCLFFBQVEsS0FBSyxTQUFTO0FBQUEsTUFDMUU7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRUEscUJBQStDO0FBQzlDLFVBQU0sUUFBUSxLQUFLLFdBQVcsbUJBQW1CO0FBQ2pELFFBQUksQ0FBQyxPQUFPO0FBQ1gsYUFBTztBQUFBLFFBQ04sY0FBYyxDQUFDO0FBQUEsUUFDZixzQkFBc0IsQ0FBQztBQUFBLFFBQ3ZCLGtCQUFrQixDQUFDO0FBQUEsUUFDbkIscUJBQXFCLENBQUM7QUFBQSxRQUN0QixzQkFBc0IsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsSUFDRDtBQUVBLFFBQUksS0FBSyxPQUFPO0FBQ2YsWUFBTSxpQkFBaUIsRUFBRSxNQUFNLEtBQUssTUFBTSxZQUFZLEtBQUssS0FBSyxNQUFNLFVBQVU7QUFDaEYsWUFBTSxjQUF5QyxDQUFDO0FBQ2hELGVBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxVQUFXLFFBQVEsS0FBSztBQUNoRCxjQUFNLE1BQU0sS0FBSyxVQUFXLE9BQU8sQ0FBQztBQUNwQyxvQkFBWSxDQUFDLElBQUksSUFBSSxXQUFXO0FBQUEsTUFDakM7QUFFQSxZQUFNLG1CQUFtQjtBQUV6QixVQUFJLEtBQUssV0FBVztBQUNuQixjQUFNLGFBQWEsS0FBSyxVQUFVLFNBQVM7QUFDM0MsY0FBTSxVQUFVLEtBQUssVUFBVSxPQUFPLFdBQVcsS0FBSztBQUN0RCxZQUFJLFNBQVM7QUFDWixnQkFBTSxVQUFVLEtBQUssTUFBTSxvQkFBb0IsT0FBTztBQUN0RCxnQkFBTSxnQkFBZ0IsUUFBUSxhQUFhLE1BQU0sY0FBYyxXQUFXLENBQUMsRUFBRSxXQUFXLFFBQVEsY0FBYyxpQkFBaUIsUUFBUSxTQUFTLFFBQVEsY0FBYyxhQUFhO0FBRW5MLGdCQUFNLGdCQUFnQjtBQUN0QixnQkFBTSxRQUFRLFdBQVc7QUFBQSxRQUMxQjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBR0EsVUFBTSxxQkFBaUQsQ0FBQztBQUN4RCxlQUFXLENBQUMsSUFBSSxZQUFZLEtBQUssS0FBSyxnQkFBZ0I7QUFDckQsVUFBSSxPQUFPLGFBQWEsa0JBQWtCLFlBQVk7QUFDckQsMkJBQW1CLEVBQUUsSUFBSSxhQUFhLGNBQWM7QUFBQSxNQUNyRDtBQUFBLElBQ0Q7QUFDQSxVQUFNLHFCQUFxQjtBQUMzQixRQUFJLEtBQUssV0FBVyxJQUFJLFdBQVcsUUFBUSxVQUFVO0FBQ3BELFlBQU0sbUJBQW1CLEtBQUssY0FBYztBQUFBLElBQzdDO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLDZCQUE2QjtBQUNwQyxXQUFPLEtBQUsseUJBQXlCLENBQUMsS0FBSztBQUFBLEVBQzVDO0FBQUEsRUFFUSxjQUFjLGlCQUF5QjtBQUM5QyxXQUFPLEtBQUssSUFBSSxtQkFBbUIsS0FBSyxxQkFBcUI7QUFBQTtBQUFBLE1BQXlDO0FBQUEsUUFBSyxJQUFJLENBQUM7QUFBQSxFQUNqSDtBQUFBLEVBRUEsT0FBTyxXQUEwQixlQUE2QixVQUFtQztBQUNoRyxRQUFJLENBQUMsaUJBQWlCLEtBQUssMkJBQTJCLE1BQU07QUFDM0QsV0FBSyxhQUFhO0FBQ2xCLFdBQUssWUFBWTtBQUNqQjtBQUFBLElBQ0Q7QUFFQSxRQUFJLFVBQVUsU0FBUyxLQUFLLFVBQVUsVUFBVSxHQUFHO0FBQ2xELFdBQUssV0FBVztBQUNoQjtBQUFBLElBQ0Q7QUFFQSxVQUFNLDRCQUE0QixLQUFLLGNBQWMsMEJBQTBCLElBQUksVUFBVSxLQUFLLFdBQVcsQ0FBQyxDQUFDO0FBQy9HLFFBQUksMkJBQTJCO0FBSTlCLGdDQUEwQixLQUFLLE1BQU0sS0FBSyxlQUFlLFdBQVcsZUFBZSxRQUFRLENBQUM7QUFBQSxJQUM3RixPQUFPO0FBQ04sV0FBSyxlQUFlLFdBQVcsZUFBZSxRQUFRO0FBQUEsSUFDdkQ7QUFBQSxFQUVEO0FBQUEsRUFFUSxlQUFlLFdBQTBCLGVBQTZCLFVBQTZCO0FBQzFHLFFBQUksZUFBZTtBQUNsQixXQUFLLG9CQUFvQixlQUFlLFdBQVcsUUFBUTtBQUFBLElBQzVEO0FBRUEsUUFBSSxLQUFLLDBCQUEwQixLQUFLLHVCQUF1QixTQUFTLEtBQUssS0FBSyx1QkFBdUIsVUFBVSxHQUFHO0FBQ3JILFdBQUssV0FBVztBQUNoQjtBQUFBLElBQ0Q7QUFFQSxTQUFLLGFBQWE7QUFDbEIsU0FBSyxZQUFZO0FBQ2pCLFVBQU0sZ0JBQWdCLEtBQUssY0FBYyxVQUFVLE1BQU0sSUFBSSxLQUFLLGNBQWMsRUFBRTtBQUNsRixRQUFJLEtBQUssS0FBSyxPQUFPLFVBQVUsT0FBTyxhQUFhO0FBRW5ELFVBQU0sb0JBQW9CO0FBQzFCLFFBQUksS0FBSyxNQUFNLGdCQUFnQixJQUFJLG1CQUFtQjtBQUVyRCxXQUFLLE1BQU0sY0FBYyxFQUFFLGVBQWUsS0FBSywyQkFBMkIsSUFBSSxLQUFLLElBQUksR0FBSSxvQkFBb0IsRUFBRyxJQUFJLEdBQUcsWUFBWSxFQUFFLENBQUM7QUFDeEksV0FBSyxNQUFNLE9BQU8sbUJBQW1CLFVBQVUsS0FBSztBQUFBLElBQ3JELE9BQU87QUFFTixXQUFLLE1BQU0sT0FBTyxtQkFBbUIsVUFBVSxLQUFLO0FBQ3BELFdBQUssTUFBTSxjQUFjLEVBQUUsZUFBZSxLQUFLLDJCQUEyQixJQUFJLEtBQUssSUFBSSxHQUFJLG9CQUFvQixFQUFHLElBQUksR0FBRyxZQUFZLEVBQUUsQ0FBQztBQUFBLElBQ3pJO0FBRUEsU0FBSyxrQkFBa0IsUUFBUTtBQUMvQixTQUFLLGtCQUFrQixNQUFNLGFBQWE7QUFDMUMsU0FBSyxrQkFBa0IsTUFBTSxVQUFVO0FBQ3ZDLFNBQUssa0JBQWtCLE1BQU0sV0FBVztBQUN4QyxTQUFLLGtCQUFrQixNQUFNLFdBQVc7QUFFeEMsU0FBSyxpQ0FBaUMsV0FBVyxRQUFRO0FBRXpELFFBQUksS0FBSywwQkFBMEI7QUFDbEMsV0FBSyx5QkFBeUIsTUFBTSxTQUFTLEdBQUcsVUFBVSxNQUFNO0FBQ2hFLFdBQUsseUJBQXlCLE1BQU0sUUFBUSxHQUFHLFVBQVUsS0FBSztBQUFBLElBQy9EO0FBRUEsU0FBSyxvQkFBb0IsT0FBTyxLQUFLLFVBQVU7QUFDL0MsU0FBSyx1QkFBdUIsT0FBTztBQUVuQyxTQUFLLGNBQWMsZ0JBQWdCLEtBQUssQ0FBQyxJQUFJLDJCQUEyQixFQUFFLE9BQU8sTUFBTSxVQUFVLEtBQUssR0FBRyxLQUFLLGNBQWMsQ0FBQyxDQUFDLENBQUM7QUFBQSxFQUNoSTtBQUFBLEVBRVEsb0JBQW9CLGVBQTRCLFdBQXdCLFVBQTZCO0FBQzVHLFNBQUssaUJBQWlCO0FBQ3RCLFFBQUksYUFBYSxVQUFVO0FBQzFCLFdBQUsseUJBQXlCO0FBQUEsUUFDN0IsUUFBUSxVQUFVO0FBQUEsUUFDbEIsT0FBTyxVQUFVO0FBQUEsUUFDakIsS0FBSyxTQUFTO0FBQUEsUUFDZCxNQUFNLFNBQVM7QUFBQSxNQUNoQjtBQUFBLElBQ0QsT0FBTztBQUVOLFlBQU0sZ0JBQWdCLGNBQWMsc0JBQXNCO0FBQzFELFdBQUsseUJBQXlCO0FBQUEsUUFDN0IsUUFBUSxjQUFjO0FBQUEsUUFDdEIsT0FBTyxjQUFjO0FBQUEsUUFDckIsS0FBSyxjQUFjO0FBQUEsUUFDbkIsTUFBTSxjQUFjO0FBQUEsTUFDckI7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRVEsaUNBQWlDLFdBQTJCLFVBQW1DO0FBQ3RHLFFBQUksYUFBYSxVQUFVO0FBQzFCLFdBQUssa0JBQWtCLE1BQU0sTUFBTSxHQUFHLFNBQVMsR0FBRztBQUNsRCxXQUFLLGtCQUFrQixNQUFNLE9BQU8sR0FBRyxTQUFTLElBQUk7QUFDcEQsV0FBSyxrQkFBa0IsTUFBTSxRQUFRLEdBQUcsVUFBVSxLQUFLO0FBQ3ZELFdBQUssa0JBQWtCLE1BQU0sU0FBUyxHQUFHLFVBQVUsTUFBTTtBQUN6RDtBQUFBLElBQ0Q7QUFFQSxRQUFJLENBQUMsS0FBSyx3QkFBd0I7QUFDakM7QUFBQSxJQUNEO0FBRUEsVUFBTSx1QkFBdUIsS0FBSyxrQkFBa0IsZUFBZSxzQkFBc0I7QUFDekYsU0FBSyxrQkFBa0IsTUFBTSxNQUFNLEdBQUcsS0FBSyx1QkFBdUIsT0FBTyxzQkFBc0IsT0FBTyxFQUFFO0FBQ3hHLFNBQUssa0JBQWtCLE1BQU0sT0FBTyxHQUFHLEtBQUssdUJBQXVCLFFBQVEsc0JBQXNCLFFBQVEsRUFBRTtBQUMzRyxTQUFLLGtCQUFrQixNQUFNLFFBQVEsR0FBRyxZQUFZLFVBQVUsUUFBUSxLQUFLLHVCQUF1QixLQUFLO0FBQ3ZHLFNBQUssa0JBQWtCLE1BQU0sU0FBUyxHQUFHLFlBQVksVUFBVSxTQUFTLEtBQUssdUJBQXVCLE1BQU07QUFBQSxFQUMzRztBQUFBO0FBQUE7QUFBQSxFQUtBLFFBQVE7QUFDUCxTQUFLLGFBQWE7QUFDbEIsU0FBSyxhQUFhLElBQUksSUFBSTtBQUUxQixRQUFJLEtBQUssaUJBQWlCO0FBQ3pCLFdBQUssVUFBVSxhQUFhO0FBQUEsSUFDN0IsT0FBTztBQUNOLFVBQUksS0FBSyxXQUFXO0FBQ25CLGNBQU0sYUFBYSxLQUFLLFVBQVUsU0FBUztBQUMzQyxjQUFNLFVBQVUsS0FBSyxVQUFVLE9BQU8sV0FBVyxLQUFLO0FBR3RELFlBQUksQ0FBQyxLQUFLLGVBQWUsR0FBRztBQUMzQixlQUFLLGVBQWU7QUFFcEIsZUFBSyxrQkFBa0I7QUFBQSxRQUN4QjtBQUVBLFlBQUksV0FBVyxRQUFRLGNBQWMsY0FBYyxRQUFRO0FBQzFELGtCQUFRLGdCQUFnQixjQUFjLFNBQVMsb0JBQW9CO0FBQ25FLGtCQUFRLFlBQVksY0FBYztBQUNsQyxlQUFLLFlBQVksT0FBTztBQUN4QjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBRUEsV0FBSyxNQUFNLFNBQVM7QUFBQSxJQUNyQjtBQUVBLFFBQUksS0FBSyxrQkFBa0I7QUFFMUIsV0FBSyxhQUFhO0FBQUEsSUFDbkI7QUFBQSxFQUNEO0FBQUEsRUFFQSxTQUFTO0FBQ1IsU0FBSyxhQUFhO0FBQUEsRUFDbkI7QUFBQSxFQUVRLFlBQVksZUFBb0M7QUFDdkQsZUFBVyxDQUFDLFNBQVMsTUFBTSxLQUFLLEtBQUssaUJBQWlCLFFBQVEsR0FBRztBQUNoRSxVQUFJLFlBQVksZUFBZTtBQUM5QixlQUFPLE1BQU07QUFDYjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRUEsZUFBZSxpQkFBMEIsT0FBTztBQUMvQyxRQUFJLEtBQUssaUJBQWlCO0FBQ3pCLFdBQUssVUFBVSxhQUFhO0FBQUEsSUFDN0IsT0FBTztBQUNOLFdBQUssTUFBTSxlQUFlLGNBQWM7QUFBQSxJQUN6QztBQUFBLEVBQ0Q7QUFBQSxFQUVBLG9CQUFvQixNQUFzQjtBQUN6QyxTQUFLLFVBQVUscUJBQXFCLElBQUk7QUFBQSxFQUN6QztBQUFBLEVBRUEsb0JBQW9CLE1BQXNCO0FBQ3pDLFNBQUssVUFBVSxvQkFBb0IsSUFBSTtBQUFBLEVBQ3hDO0FBQUEsRUFFQSxhQUFhO0FBQ1osU0FBSyxhQUFhO0FBQ2xCLFNBQUssYUFBYSxJQUFJLEtBQUs7QUFDM0IsU0FBSyxrQkFBa0IsUUFBUTtBQUMvQixTQUFLLGtCQUFrQixNQUFNLGFBQWE7QUFDMUMsU0FBSyxrQkFBa0IsTUFBTSxPQUFPO0FBQ3BDLFNBQUssNkJBQTZCLE1BQU0sVUFBVTtBQUNsRCxTQUFLLHVCQUF1QjtBQUFBLEVBQzdCO0FBQUEsRUFFUSx5QkFBeUI7QUFDaEMsU0FBSyxpQkFBaUIsUUFBUSxDQUFDLFFBQVEsU0FBUztBQUMvQyxVQUFJLEtBQUssY0FBYyxNQUFNLFFBQVEsUUFBUTtBQUM1QywwQkFBa0IsSUFBSSxNQUFNLEdBQUcsb0JBQW9CO0FBQ25ELGlDQUF5QixJQUFJLE1BQU0sR0FBRyxhQUFhO0FBQ25ELDRCQUFvQixJQUFJLE1BQU0sR0FBRyxhQUFhO0FBQUEsTUFDL0M7QUFBQSxJQUNELENBQUM7QUFFRCxTQUFLLGlCQUFpQixRQUFRLENBQUMsUUFBUSxTQUFTO0FBQy9DLFlBQU0sYUFBYSw0QkFBNEIsSUFBSSxNQUFNO0FBQ3pELFVBQUksWUFBWSxNQUFNLElBQUksR0FBRyxnQkFBZ0IsSUFBSSxHQUFHO0FBQ25ELGVBQU8sT0FBTyxJQUFJO0FBQUEsTUFDbkI7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFUSxvQkFBNkI7QUFDcEMsV0FBTyxJQUFJLDBCQUEwQixLQUFLLFdBQVcsQ0FBQztBQUFBLEVBQ3ZEO0FBQUEsRUFFQSxvQkFBb0I7QUFHbkIsU0FBSyxjQUFjLGFBQWE7QUFDaEMsVUFBTSxVQUFVLEtBQUssa0JBQWtCO0FBQ3ZDLFNBQUssYUFBYSxJQUFJLE9BQU87QUFDN0IsU0FBSyxXQUFXLGVBQWUsT0FBTztBQUFBLEVBQ3ZDO0FBQUEsRUFFQSxzQkFBc0I7QUFDckIsVUFBTSxhQUFhLEtBQUssY0FBYztBQUV0QyxRQUFJLFlBQVksY0FBYyxjQUFjLFVBQVUsQ0FBQyxLQUFLLGlCQUFpQjtBQUU1RSxpQkFBVyxZQUFZLGNBQWM7QUFBQSxJQUN0QztBQUFBLEVBQ0Q7QUFBQSxFQUVBLGlCQUFpQjtBQUdoQixTQUFLLGtCQUFrQjtBQUN2QixXQUFPLEtBQUssa0JBQWtCO0FBQUEsRUFDL0I7QUFBQSxFQUVBLGtCQUFrQjtBQUNqQixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSx5QkFBeUI7QUFDeEIsUUFBSSxDQUFDLEtBQUssZUFBZSxHQUFHO0FBQzNCLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxrQkFBa0IsSUFBSSxVQUFVLEtBQUssV0FBVyxDQUFDLEVBQUUsYUFBYTtBQUN0RSxRQUFJLGlCQUFpQixlQUFlLEdBQUc7QUFDdEMsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLGtCQUFrQixnQkFBZ0IsV0FBVyxDQUFDO0FBQ3BELFFBQUksZ0JBQWdCLG1CQUFtQixnQkFBZ0IsZ0JBQWdCLGdCQUFnQixZQUFZLGdCQUFnQixnQkFBZ0IsR0FBRztBQUNySSxhQUFPO0FBQUEsSUFDUjtBQUVBLFFBQUksWUFBaUIsZ0JBQWdCO0FBRXJDLFFBQUksQ0FBQyxLQUFLLE1BQU0sU0FBUyxTQUFTLEdBQUc7QUFDcEMsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPLGFBRU4sY0FBYyxLQUFLLE9BQU87QUFDMUIsVUFBSyxVQUEwQixhQUFjLFVBQTBCLFVBQVUsU0FBUyxRQUFRLEdBQUc7QUFDcEcsZUFBTztBQUFBLE1BQ1I7QUFFQSxrQkFBWSxVQUFVO0FBQUEsSUFDdkI7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsMkJBQTJCLFVBQW1CO0FBQzdDLFNBQUssa0JBQWtCLElBQUksUUFBUTtBQUFBLEVBQ3BDO0FBQUE7QUFBQTtBQUFBLEVBTUEsYUFBYSxNQUFzQjtBQUNsQyxTQUFLLFdBQVcsc0JBQXNCO0FBQUEsTUFDckMsTUFBTSxtQkFBbUI7QUFBQSxNQUN6QixTQUFTLEtBQUs7QUFBQSxNQUNkLFlBQVksQ0FBQyxLQUFLLE1BQU07QUFBQSxJQUN6QixDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsSUFBSSxZQUFZO0FBQ2YsV0FBTyxLQUFLLE1BQU07QUFBQSxFQUNuQjtBQUFBLEVBRUEsSUFBSSxlQUFlO0FBQ2xCLFdBQU8sS0FBSyxNQUFNLFlBQVksS0FBSyxNQUFNLGdCQUFnQjtBQUFBLEVBQzFEO0FBQUEsRUFFQSx3QkFBd0IsTUFBc0I7QUFDN0MsV0FBTyxLQUFLLE1BQU0scUJBQXFCLElBQUk7QUFBQSxFQUM1QztBQUFBLEVBRUEsbUJBQW1CLE1BQXNCO0FBQ3hDLFdBQU8sS0FBSyxNQUFNLGNBQWMsSUFBSTtBQUFBLEVBQ3JDO0FBQUEsRUFFQSxpQkFBaUI7QUFDaEIsU0FBSyxNQUFNLGVBQWU7QUFBQSxFQUMzQjtBQUFBLEVBRUEsYUFBYSxXQUF5QjtBQUNyQyxTQUFLLE1BQU0sWUFBWTtBQUFBLEVBQ3hCO0FBQUEsRUFFQSxzQkFBc0IsT0FBbUI7QUFDeEMsV0FBTyxLQUFLLE1BQU0sWUFBWSxLQUFLO0FBQUEsRUFDcEM7QUFBQSxFQUVBLGFBQWEsTUFBc0I7QUFDbEMsV0FBTyxLQUFLLE1BQU0sV0FBVyxNQUFNLGVBQWUsT0FBTztBQUFBLEVBQzFEO0FBQUEsRUFFQSxrQkFBa0IsTUFBc0I7QUFDdkMsU0FBSyxNQUFNLFdBQVcsTUFBTSxlQUFlLEdBQUc7QUFBQSxFQUMvQztBQUFBLEVBRUEsZUFBZSxNQUFzQjtBQUNwQyxTQUFLLE1BQU0sV0FBVyxNQUFNLGVBQWUsTUFBTTtBQUFBLEVBQ2xEO0FBQUEsRUFFQSxNQUFNLGdDQUFnQyxNQUFzQjtBQUMzRCxVQUFNLEtBQUssTUFBTSxXQUFXLE1BQU0sZUFBZSx1QkFBdUI7QUFBQSxFQUN6RTtBQUFBLEVBRUEsTUFBTSxpQ0FBaUMsTUFBc0I7QUFDNUQsVUFBTSxLQUFLLE1BQU0sV0FBVyxNQUFNLGVBQWUsMEJBQTBCO0FBQUEsRUFDNUU7QUFBQSxFQUVBLE1BQU0sc0JBQXNCLE1BQXNCLE1BQTZCO0FBQzlFLFdBQU8sS0FBSyxNQUFNLGtCQUFrQixNQUFNLElBQUksTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLEdBQUcsb0JBQW9CLE9BQU87QUFBQSxFQUNuRztBQUFBLEVBRUEsTUFBTSx3QkFBd0IsTUFBc0IsTUFBNkI7QUFDaEYsV0FBTyxLQUFLLE1BQU0sa0JBQWtCLE1BQU0sSUFBSSxNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsR0FBRyxvQkFBb0IsTUFBTTtBQUFBLEVBQ2xHO0FBQUEsRUFFQSxNQUFNLHlDQUF5QyxNQUFzQixNQUE2QjtBQUNqRyxXQUFPLEtBQUssTUFBTSxrQkFBa0IsTUFBTSxJQUFJLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxHQUFHLG9CQUFvQix1QkFBdUI7QUFBQSxFQUNuSDtBQUFBLEVBRUEsTUFBTSx1QkFBdUIsTUFBc0IsT0FBeUM7QUFDM0YsV0FBTyxLQUFLLE1BQU0sa0JBQWtCLE1BQU0sT0FBTyxvQkFBb0IsT0FBTztBQUFBLEVBQzdFO0FBQUEsRUFFQSxNQUFNLHlCQUF5QixNQUFzQixPQUF5QztBQUM3RixXQUFPLEtBQUssTUFBTSxrQkFBa0IsTUFBTSxPQUFPLG9CQUFvQixNQUFNO0FBQUEsRUFDNUU7QUFBQSxFQUVBLE1BQU0sMENBQTBDLE1BQXNCLE9BQXlDO0FBQzlHLFdBQU8sS0FBSyxNQUFNLGtCQUFrQixNQUFNLE9BQU8sb0JBQW9CLHVCQUF1QjtBQUFBLEVBQzdGO0FBQUEsRUFFQSx5QkFBeUIsTUFBc0IsUUFBZ0I7QUFDOUQsV0FBTyxLQUFLLE1BQU0seUJBQXlCLE1BQU0sTUFBTTtBQUFBLEVBQ3hEO0FBQUEsRUFFQSxzQ0FBc0MsUUFBZ0I7QUFDckQsV0FBTyxLQUFLLE1BQU0sc0NBQXNDLE1BQU07QUFBQSxFQUMvRDtBQUFBLEVBRUEseUJBQXlCLE9BQXVCO0FBQy9DLFFBQUksQ0FBQyxLQUFLLHVCQUF1QjtBQUNoQyxhQUFPO0FBQUEsSUFDUjtBQUNBLFVBQU0sT0FBTyxLQUFLLFdBQVcsVUFBVSxLQUFLO0FBQzVDLFFBQUksQ0FBQyxNQUFNO0FBQ1YsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPLEtBQUssc0JBQXNCLGFBQWEsSUFBSTtBQUFBLEVBQ3BEO0FBQUEsRUFFQSxjQUFjLE1BQThCO0FBQzNDLFFBQUksQ0FBQyxLQUFLLHVCQUF1QjtBQUNoQyxhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU8sS0FBSyxzQkFBc0IsY0FBYyxJQUFJO0FBQUEsRUFDckQ7QUFBQSxFQUVBLDBCQUEwQixZQUFvQixVQUEwQztBQUN2RixXQUFPLEtBQUssc0JBQXNCLDBCQUEwQixZQUFZLFFBQVE7QUFBQSxFQUNqRjtBQUFBLEVBRUEsZ0JBQWdCLE9BQW1EO0FBQ2xFLFdBQU8sS0FBSyxzQkFBc0IsZ0JBQWdCLEtBQUs7QUFBQSxFQUN4RDtBQUFBLEVBRUEsdUJBQXVCLE1BQXNCLE9BQW9CO0FBQ2hFLFNBQUssTUFBTSx1QkFBdUIsTUFBTSxLQUFLO0FBQUEsRUFDOUM7QUFBQSxFQUVBLGVBQWUsU0FBZ0M7QUFDOUMsV0FBTyxLQUFLLE1BQU0sZUFBZSxTQUFTLElBQUk7QUFBQSxFQUMvQztBQUFBLEVBRUEsNENBQTBEO0FBQ3pELFdBQU8sS0FBSyxzQkFBc0IsMENBQTBDO0FBQUEsRUFDN0U7QUFBQTtBQUFBO0FBQUEsRUFNQSxxQkFBcUIsZ0JBQTBCLGdCQUFzRDtBQUNwRyxVQUFNLE1BQU0sS0FBSyxXQUFXLHFCQUFxQixnQkFBZ0IsY0FBYyxLQUFLLENBQUM7QUFDckYsU0FBSyx3QkFBd0IsS0FBSztBQUNsQyxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsNkJBQTZCLFFBQWdCLE9BQWlCLFNBQW1CLFVBQTBCO0FBQzFHLFFBQUksYUFBYSxTQUFTLFFBQVE7QUFDakMsV0FBSyxVQUFVLDZCQUE2QixRQUFRLE9BQU8sT0FBTztBQUFBLElBQ25FLE9BQU87QUFDTixXQUFLLFVBQVUsbUNBQW1DLFFBQVEsT0FBTyxPQUFPO0FBQUEsSUFDekU7QUFBQSxFQUNEO0FBQUEsRUFFQSx1QkFBMEIsVUFBNEU7QUFDckcsV0FBTyxLQUFLLFdBQVcsdUJBQTBCLFFBQVEsS0FBSztBQUFBLEVBQy9EO0FBQUE7QUFBQTtBQUFBLEVBS0EsZ0JBQWdCLFVBQXFFO0FBQ3BGLFNBQUssTUFBTSxnQkFBZ0IsUUFBUTtBQUNuQyxTQUFLLG1CQUFtQixLQUFLO0FBQUEsRUFDOUI7QUFBQSxFQUVBLHNCQUFzQixJQUFvRDtBQUN6RSxXQUFPLEtBQUssTUFBTSxzQkFBc0IsRUFBRTtBQUFBLEVBQzNDO0FBQUE7QUFBQTtBQUFBLEVBSUEsbUJBQW1CLFVBQXdFO0FBQzFGLFNBQUssTUFBTSxtQkFBbUIsUUFBUTtBQUFBLEVBQ3ZDO0FBQUE7QUFBQTtBQUFBLEVBS0EsTUFBYyxzQkFBcUM7QUFDbEQsUUFBSSxDQUFDLEtBQUssU0FBUyxHQUFHO0FBQ3JCO0FBQUEsSUFDRDtBQUNBLFVBQU0sRUFBRSxTQUFTLElBQUksS0FBSyxzQkFBc0Isa0JBQWtCLEtBQUssU0FBUztBQUNoRixRQUFJLENBQUMsS0FBSyxVQUFVLFdBQVcsR0FBRztBQUNqQyxZQUFNLEtBQUssZ0JBQWdCO0FBQUEsSUFDNUI7QUFDQSxTQUFLLFVBQVUscUJBQXFCLFFBQVE7QUFBQSxFQUM3QztBQUFBLEVBRUEsSUFBSSxlQUFlO0FBQ2xCLFdBQU8sS0FBSyxhQUFhLEtBQUssc0JBQXNCLDZCQUE2QixLQUFLLFNBQVM7QUFBQSxFQUNoRztBQUFBLEVBRUEsTUFBTSxvQkFBb0IsT0FBaUQ7QUFDMUUsUUFBSSxDQUFDLEtBQUssYUFBYSxDQUFDLEtBQUssU0FBUyxHQUFHO0FBQ3hDO0FBQUEsSUFDRDtBQUNBLFFBQUksQ0FBQyxPQUFPO0FBQ1gsY0FBUSxLQUFLLFVBQVU7QUFBQSxJQUN4QjtBQUNBLFdBQU8sS0FBSyx5QkFBeUIsMEJBQTBCLEtBQUssV0FBVyxNQUFNLEtBQUssS0FBSyxFQUFFLElBQUksVUFBUSxLQUFLLE1BQU0sQ0FBQztBQUFBLEVBQzFIO0FBQUEsRUFFQSxNQUFNLHFCQUFxQixPQUFpRDtBQUMzRSxRQUFJLENBQUMsS0FBSyxhQUFhLENBQUMsS0FBSyxTQUFTLEdBQUc7QUFDeEMsV0FBSyxXQUFXLEtBQUssd0JBQXdCLDRDQUE0QztBQUN6RjtBQUFBLElBQ0Q7QUFDQSxRQUFJLENBQUMsT0FBTztBQUNYLGNBQVEsS0FBSyxVQUFVO0FBQUEsSUFDeEI7QUFDQSxXQUFPLEtBQUsseUJBQXlCLHFCQUFxQixLQUFLLFdBQVcsTUFBTSxLQUFLLEtBQUssRUFBRSxJQUFJLE9BQUssRUFBRSxLQUFLLEdBQUcsS0FBSyx1QkFBdUI7QUFBQSxFQUM1STtBQUFBLEVBT0EsTUFBTSxtQkFBbUIsTUFBc0IsUUFBZ0IsU0FBNEM7QUFDMUcsU0FBSyxPQUFPLGVBQWUsS0FBSyxRQUFRLE1BQU07QUFDOUMsVUFBTSxZQUFZLEtBQUssTUFBTSxhQUFhLElBQUk7QUFDOUMsUUFBSSxjQUFjLFFBQVc7QUFFNUI7QUFBQSxJQUNEO0FBRUEsUUFBSSxLQUFLLGlCQUFpQixJQUFJLElBQUksR0FBRztBQUNwQyxXQUFLLGlCQUFpQixJQUFJLElBQUksRUFBRyxRQUFRO0FBQUEsSUFDMUM7QUFFQSxVQUFNLFdBQVcsSUFBSSxnQkFBc0I7QUFDM0MsVUFBTSxXQUFXLE1BQU07QUFDdEIsVUFBSSxLQUFLLGFBQWE7QUFDckI7QUFBQSxNQUNEO0FBRUEsVUFBSSxDQUFDLEtBQUssV0FBVyxRQUFRLElBQUksR0FBRztBQUVuQztBQUFBLE1BQ0Q7QUFFQSxVQUFJLEtBQUssTUFBTSxhQUFhLElBQUksTUFBTSxRQUFXO0FBRWhEO0FBQUEsTUFDRDtBQUVBLFVBQUksS0FBSyxNQUFNLGNBQWMsSUFBSSxNQUFNLFFBQVE7QUFDOUM7QUFBQSxNQUNEO0FBRUEsWUFBTSxnQkFBZ0IsS0FBSyxpQkFBaUIsSUFBSSxJQUFJO0FBQ3BELFdBQUssaUJBQWlCLE9BQU8sSUFBSTtBQUVqQyxVQUFJLENBQUMsS0FBSyxlQUFlLEdBQUc7QUFHM0IsY0FBTSxZQUFZLEtBQUssV0FBVyxhQUFhLElBQUk7QUFDbkQsY0FBTSxnQkFBZ0IsS0FBSztBQUMzQixZQUFJLGNBQWMsVUFDZCxpQkFBaUIsY0FBYyxVQUFVLGNBQWMsQ0FBQyxFQUFFLFVBQVUsYUFFcEUsS0FBSyxNQUFNLFlBQVksS0FBSyx3QkFBd0IsSUFBSSxHQUMxRDtBQUNELGlCQUFPLEtBQUssTUFBTSxxQkFBcUIsTUFBTSxRQUFRLEtBQUssSUFBSSxZQUFZLEdBQUcsS0FBSyxVQUFVLElBQUksQ0FBQyxDQUFDO0FBQUEsUUFDbkc7QUFBQSxNQUNEO0FBRUEsV0FBSyxNQUFNLHFCQUFxQixNQUFNLE1BQU07QUFDNUMsZUFBUyxTQUFTLE1BQVM7QUFDM0IsVUFBSSxlQUFlO0FBQ2xCLHNCQUFjLFFBQVE7QUFDdEIsYUFBSyxtQkFBbUIsT0FBTyxhQUFhO0FBQUEsTUFDN0M7QUFBQSxJQUNEO0FBRUEsUUFBSSxLQUFLLE1BQU0sd0JBQXdCO0FBQ3RDLFlBQU0sbUJBQW1CLElBQUksNkJBQTZCLElBQUksVUFBVSxLQUFLLFdBQVcsQ0FBQyxHQUFHLFFBQVE7QUFFcEcsWUFBTSxhQUFhLGFBQWEsTUFBTTtBQUNyQyx5QkFBaUIsUUFBUTtBQUN6QixpQkFBUyxTQUFTLE1BQVM7QUFBQSxNQUM1QixDQUFDO0FBQ0QsV0FBSyxpQkFBaUIsSUFBSSxNQUFNLFVBQVU7QUFDMUMsV0FBSyxtQkFBbUIsSUFBSSxVQUFVO0FBQUEsSUFDdkMsT0FBTztBQUNOLGVBQVM7QUFBQSxJQUNWO0FBRUEsV0FBTyxTQUFTO0FBQUEsRUFDakI7QUFBQSxFQUVBLGdCQUFnQjtBQUNmLFVBQU0sV0FBVyxLQUFLLE1BQU0sbUJBQW1CO0FBRS9DLFFBQUksWUFBWSxTQUFTLFFBQVE7QUFDaEMsYUFBTyxTQUFTLENBQUM7QUFBQSxJQUNsQjtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSw2QkFBNkIsY0FBOEIsb0JBQW1DO0FBQ3JHLFVBQU0sb0JBQW9CLEtBQUssTUFBTSxvQkFBb0I7QUFDekQsVUFBTSxhQUFhLGtCQUFrQixTQUFTLFlBQVk7QUFFMUQsVUFBTSxvQkFBb0IscUJBQXFCLGtCQUFrQixrQkFBa0IsU0FBUyxDQUFDLEtBQUssZUFBZTtBQUNqSCxVQUFNLGdCQUFnQixLQUFLLE1BQU0sYUFBYSxZQUFZO0FBQzFELFVBQU0sZ0JBQWdCLEtBQUssTUFBTSxhQUFhLGlCQUFpQjtBQUUvRCxVQUFNLHdCQUF3QixLQUFLLG9CQUFvQixlQUFlLGFBQWE7QUFDbkYsUUFBSSxZQUFZO0FBRWYsV0FBSyxNQUFNLGVBQWUsa0JBQWtCLE9BQU8sYUFBVyxDQUFDLHNCQUFzQixTQUFTLE9BQU8sQ0FBQyxDQUFDO0FBQUEsSUFDeEcsT0FBTztBQUVOLFdBQUssYUFBYSxZQUFZO0FBQzlCLFdBQUssTUFBTSxlQUFlLENBQUMsR0FBRyxrQkFBa0IsT0FBTyxhQUFXLENBQUMsc0JBQXNCLFNBQVMsT0FBTyxDQUFDLEdBQUcsR0FBRyxxQkFBcUIsQ0FBQztBQUFBLElBQ3ZJO0FBQUEsRUFDRDtBQUFBLEVBRVEsb0JBQW9CLGVBQXVCLGFBQXVDO0FBQ3pGLFVBQU0sdUJBQXlDLENBQUM7QUFDaEQsYUFBUyxRQUFRLEdBQUcsUUFBUSxLQUFLLE1BQU0sUUFBUSxFQUFFLE9BQU87QUFDdkQsWUFBTSxPQUFPLEtBQUssTUFBTSxRQUFRLEtBQUs7QUFDckMsVUFBSSxNQUFNO0FBQ1QsWUFBSyxTQUFTLGlCQUFpQixTQUFTLGVBQWlCLFNBQVMsZUFBZSxTQUFTLGVBQWdCO0FBQ3pHLCtCQUFxQixLQUFLLElBQUk7QUFBQSxRQUMvQjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQU0sa0JBQWtCLE1BQXNCLFdBQThDLFNBQXFDO0FBQ2hJLFFBQUksS0FBSyxhQUFhO0FBQ3JCO0FBQUEsSUFDRDtBQUVBLFNBQUssa0JBQWtCO0FBRXZCLFFBQUksY0FBYyxVQUFVO0FBQzNCLFdBQUssbUJBQW1CO0FBQ3hCLFdBQUssYUFBYSxJQUFJO0FBQ3RCLFdBQUssTUFBTSxVQUFVO0FBRXJCLFdBQUssZ0JBQWdCLGNBQWMsU0FBUyxtQkFBbUI7QUFDL0QsV0FBSyxZQUFZLGNBQWM7QUFDL0IsVUFBSSxDQUFDLFNBQVMsWUFBWTtBQUN6QixZQUFJLE9BQU8sU0FBUyxvQkFBb0IsVUFBVTtBQUNqRCxlQUFLLGVBQWUsSUFBSSxJQUFJO0FBQzVCLGdCQUFNLEtBQUssc0JBQXNCLE1BQU0sUUFBUSxlQUFlO0FBQzlELGdCQUFNLFNBQVMsS0FBSyxpQkFBaUIsSUFBSSxJQUFJO0FBQzdDLGdCQUFNLGtCQUFrQixRQUFRO0FBQ2hDLGtCQUFRLGFBQWE7QUFBQSxZQUNwQixpQkFBaUI7QUFBQSxZQUNqQixhQUFhO0FBQUEsWUFDYixlQUFlO0FBQUEsWUFDZixXQUFXO0FBQUEsVUFDWixDQUFDO0FBQUEsUUFDRixPQUFPO0FBQ04sZ0JBQU0sMEJBQTBCLEtBQUssMkJBQTJCO0FBQ2hFLGNBQUkseUJBQXlCLFFBQVE7QUFDcEMsa0JBQU0seUJBQXlCLHdCQUF3QixDQUFDO0FBQ3hELGtCQUFNLEtBQUssdUJBQXVCLE1BQU0sTUFBTSxjQUFjLHdCQUF3QixzQkFBc0IsQ0FBQztBQUFBLFVBQzVHLE9BQU87QUFDTixrQkFBTSxLQUFLLGFBQWEsSUFBSTtBQUFBLFVBQzdCO0FBQUEsUUFFRDtBQUFBLE1BRUQ7QUFBQSxJQUNELFdBQVcsY0FBYyxVQUFVO0FBQ2xDLFdBQUssYUFBYSxJQUFJO0FBRXRCLFVBQUksQ0FBQyxLQUFLLGVBQWUsR0FBRztBQUMzQixhQUFLLE1BQU0sVUFBVTtBQUFBLE1BQ3RCO0FBRUEsVUFBSSxDQUFDLEtBQUssVUFBVTtBQUNuQjtBQUFBLE1BQ0Q7QUFFQSxZQUFNLGdCQUFnQixLQUFLLGtCQUFrQixLQUFLLE9BQUssRUFBRSxNQUFNLG1CQUFtQixHQUFHLE1BQU07QUFDM0YsWUFBTSxpQkFBaUIsU0FBUyxZQUFZLGlCQUFpQixLQUFLO0FBQ2xFLFdBQUssU0FBUyxZQUFZLGdCQUFnQixTQUFTLGFBQWEsU0FBUyx3QkFBd0IsS0FBSyxlQUFlO0FBRXJILFdBQUssZ0JBQWdCLGNBQWMsU0FBUyxtQkFBbUI7QUFDL0QsV0FBSyxZQUFZLGNBQWM7QUFDL0IsV0FBSyxrQkFBa0IsU0FBUztBQUNoQyxXQUFLLGFBQWEsSUFBSSxJQUFJO0FBQzFCLFVBQUksQ0FBQyxTQUFTLFlBQVk7QUFDekIsYUFBSyxnQ0FBZ0MsSUFBSTtBQUFBLE1BQzFDO0FBQUEsSUFDRCxPQUFPO0FBRU4sWUFBTSxVQUFVLEtBQUssTUFBTSxvQkFBb0IsSUFBSTtBQUNuRCxVQUFJLFdBQVcsUUFBUSxjQUFjLGlCQUFpQixRQUFRLFNBQVMsUUFBUSxjQUFjLGFBQWEsR0FBRztBQUM1RyxRQUFDLFFBQVEsY0FBYyxjQUE4QixLQUFLO0FBQUEsTUFDM0Q7QUFFQSxXQUFLLFVBQVUsV0FBVztBQUUxQixXQUFLLGdCQUFnQixjQUFjLFNBQVMsbUJBQW1CO0FBQy9ELFdBQUssWUFBWSxjQUFjO0FBRS9CLFdBQUssYUFBYSxJQUFJO0FBQ3RCLFVBQUksQ0FBQyxTQUFTLFlBQVk7QUFDekIsWUFBSSxPQUFPLFNBQVMsb0JBQW9CLFVBQVU7QUFDakQsZUFBSyxlQUFlLElBQUksSUFBSTtBQUM1QixnQkFBTSxLQUFLLGFBQWEsSUFBSTtBQUFBLFFBQzdCLFdBQVcsU0FBUyxtQkFBbUIsdUJBQXVCLFdBQVc7QUFDeEUsZ0JBQU0sS0FBSyxpQ0FBaUMsSUFBSTtBQUFBLFFBQ2pELFdBQVcsU0FBUyxtQkFBbUIsdUJBQXVCLFVBQVU7QUFDdkUsZ0JBQU0sS0FBSyxhQUFhLElBQUk7QUFBQSxRQUM3QixPQUFPO0FBQ04sZ0JBQU0sS0FBSyxnQ0FBZ0MsSUFBSTtBQUFBLFFBQ2hEO0FBQUEsTUFDRDtBQUNBLFdBQUssTUFBTSxVQUFVO0FBQ3JCLFdBQUssa0JBQWtCO0FBQUEsSUFDeEI7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFNLHNCQUFzQixNQUFzQixXQUE4QztBQUMvRixVQUFNLE1BQU0sS0FBSyxXQUFXLGFBQWEsSUFBSTtBQUM3QyxRQUFJLE9BQU8sUUFBUSxVQUFVO0FBQzVCO0FBQUEsSUFDRDtBQUVBLFVBQU0sVUFBVSxLQUFLLFdBQVcsT0FBTyxNQUFNLENBQUM7QUFDOUMsUUFBSSxDQUFDLFNBQVM7QUFDYjtBQUFBLElBQ0Q7QUFFQSxVQUFNLEtBQUssa0JBQWtCLFNBQVMsU0FBUztBQUFBLEVBQ2hEO0FBQUE7QUFBQTtBQUFBLEVBTUEsTUFBYyxZQUFZLFVBQTZCO0FBQ3RELFFBQUksU0FBUyxtQkFBbUI7QUFDL0I7QUFBQSxJQUNEO0FBRUEsVUFBTSxVQUFVLFNBQVM7QUFDekIsZUFBVyxVQUFVLFFBQVEsTUFBTSxHQUFHLGtCQUFrQixHQUFHO0FBQzFELFlBQU0sQ0FBQyxXQUFXLElBQUksSUFBSSxPQUFPLGlCQUFpQixLQUFLLFdBQVksTUFBUztBQUM1RSxVQUFJLENBQUMsVUFBVSxLQUFLLGNBQVksU0FBUyxTQUFTLEtBQUssVUFBVSxXQUFXLEdBQUc7QUFDOUU7QUFBQSxNQUNEO0FBRUEsWUFBTSx5QkFBeUIsVUFBVSxJQUFJO0FBRTdDLFVBQUksQ0FBQyx3QkFBd0I7QUFDNUI7QUFBQSxNQUNEO0FBRUEsWUFBTSxXQUFXLEtBQUssaUJBQWlCLGdCQUFnQix1QkFBdUIsVUFBVTtBQUV4RixVQUFJLENBQUMsVUFBVTtBQUNkO0FBQUEsTUFDRDtBQUVBLFlBQU0sU0FBNkIsRUFBRSxNQUFNLGlCQUFpQixXQUFXLFVBQVUsUUFBUSxRQUFRLFVBQVUsdUJBQXVCLFNBQVM7QUFDM0ksWUFBTSxRQUFRLEtBQUssVUFBVSxhQUFhLElBQUksT0FBTyxNQUFNO0FBQzNELFVBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxhQUFhO0FBQ2pDLGNBQU0sSUFBSSxJQUFJLFFBQWMsYUFBVztBQUN0QyxlQUFLLFVBQVUsTUFBTSxJQUFJLEtBQUssbUJBQW1CLEtBQUssaUJBQWlCLEVBQUUsT0FBSztBQUM3RSxnQkFBSSxFQUFFLFVBQVUsT0FBTyxPQUFPLE9BQU87QUFDcEMsc0JBQVE7QUFBQSxZQUNUO0FBQUEsVUFDRCxDQUFDLENBQUM7QUFBQSxRQUNILENBQUM7QUFDRCxhQUFLLGFBQWEsVUFBVSxRQUFRLEdBQUcsS0FBSztBQUM1QyxjQUFNO0FBQUEsTUFDUCxPQUFPO0FBRU4sYUFBSyxhQUFhLFVBQVUsUUFBUSxHQUFHLEtBQUs7QUFBQSxNQUM3QztBQUVBO0FBQUEsSUFDRDtBQUFBLEVBRUQ7QUFBQSxFQUVBLE1BQWMsV0FBVyxlQUF3QjtBQUNoRCxRQUFJLENBQUMsS0FBSyxTQUFTLEtBQUssQ0FBQyxLQUFLLFdBQVc7QUFDeEM7QUFBQSxJQUNEO0FBRUEsVUFBTSxRQUFRLEtBQUssVUFBVTtBQUM3QixVQUFNLFdBQVcsQ0FBQztBQUVsQixhQUFTLElBQUksR0FBRyxJQUFJLE1BQU0sUUFBUSxLQUFLO0FBQ3RDLFVBQUksTUFBTSxDQUFDLEVBQUUsYUFBYSxTQUFTLFVBQVUsQ0FBQyxLQUFLLFNBQVUscUJBQXFCLElBQUksTUFBTSxDQUFDLEVBQUUsRUFBRSxHQUFHO0FBQ25HLGlCQUFTLEtBQUssS0FBSyxvQkFBb0IsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUFBLE1BQ2pEO0FBQUEsSUFDRDtBQUVBLFFBQUksaUJBQWlCLEtBQUssT0FBTztBQUNoQyxlQUFTLElBQUksR0FBRyxJQUFJLEtBQUssTUFBTSxRQUFRLEtBQUs7QUFDM0MsY0FBTSxPQUFPLEtBQUssTUFBTSxRQUFRLENBQUM7QUFFakMsWUFBSSxNQUFNLGFBQWEsU0FBUyxNQUFNO0FBQ3JDLG1CQUFTLEtBQUssS0FBSyxZQUFhLElBQTBCLENBQUM7QUFBQSxRQUM1RDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBRUEsV0FBTyxRQUFRLElBQUksUUFBUTtBQUFBLEVBQzVCO0FBQUEsRUFFQSxNQUFjLGlCQUFpQixlQUF3QixvQkFBa0M7QUFDeEYsUUFBSSxDQUFDLEtBQUssU0FBUyxLQUFLLENBQUMsS0FBSyxXQUFXO0FBQ3hDO0FBQUEsSUFDRDtBQUVBLFVBQU0sUUFBUSxLQUFLLFVBQVU7QUFDN0IsVUFBTSxXQUFXLENBQUM7QUFFbEIsZUFBVyxTQUFTLG9CQUFvQjtBQUN2QyxlQUFTLElBQUksTUFBTSxPQUFPLElBQUksTUFBTSxLQUFLLEtBQUs7QUFDN0MsWUFBSSxNQUFNLENBQUMsRUFBRSxhQUFhLFNBQVMsVUFBVSxDQUFDLEtBQUssU0FBVSxxQkFBcUIsSUFBSSxNQUFNLENBQUMsRUFBRSxFQUFFLEdBQUc7QUFDbkcsbUJBQVMsS0FBSyxLQUFLLG9CQUFvQixNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQUEsUUFDakQ7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFFBQUksaUJBQWlCLEtBQUssT0FBTztBQUNoQyxpQkFBVyxTQUFTLG9CQUFvQjtBQUN2QyxpQkFBUyxJQUFJLE1BQU0sT0FBTyxJQUFJLE1BQU0sS0FBSyxLQUFLO0FBQzdDLGdCQUFNLE9BQU8sS0FBSyxNQUFNLFFBQVEsQ0FBQztBQUVqQyxjQUFJLE1BQU0sYUFBYSxTQUFTLE1BQU07QUFDckMscUJBQVMsS0FBSyxLQUFLLFlBQWEsSUFBMEIsQ0FBQztBQUFBLFVBQzVEO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBRUEsV0FBTyxRQUFRLElBQUksUUFBUTtBQUFBLEVBQzVCO0FBQUEsRUFFQSxNQUFNLEtBQUssT0FBZSxTQUErQixPQUEwQixhQUFzQixPQUFPLDZCQUE2QixPQUFPLFNBQXFEO0FBQ3hNLFFBQUksQ0FBQyxLQUFLLG9CQUFvQjtBQUM3QixhQUFPLENBQUM7QUFBQSxJQUNUO0FBRUEsUUFBSSxDQUFDLFNBQVM7QUFDYixnQkFBVSxLQUFLLE1BQU07QUFBQSxJQUN0QjtBQUVBLFVBQU0sY0FBYyxLQUFLLG1CQUFtQixLQUFLLE9BQU8sT0FBTyxFQUFFLE9BQU8sV0FBUyxNQUFNLFNBQVMsQ0FBQztBQUVqRyxRQUFLLENBQUMsUUFBUSx3QkFBd0IsQ0FBQyxRQUFRLGlCQUFrQixRQUFRLFdBQVcsa0JBQWtCLHNCQUFzQixNQUFNO0FBQ2pJLFdBQUssVUFBVSxTQUFTLE9BQU87QUFDL0IsYUFBTztBQUFBLElBQ1I7QUFJQSxVQUFNLFdBQXNELENBQUM7QUFDN0QsZ0JBQVksUUFBUSxXQUFTO0FBQzVCLGVBQVMsTUFBTSxLQUFLLEVBQUUsSUFBSTtBQUFBLElBQzNCLENBQUM7QUFFRCxRQUFJLEtBQUssVUFBVTtBQUdsQixZQUFNLFFBQVEsS0FBSyxJQUFJO0FBQ3ZCLFVBQUksUUFBUSxhQUFhLFFBQVEsVUFBVSxrQkFBa0Isc0JBQXNCLFNBQVMsUUFBUSxVQUFVLG9CQUFvQjtBQUNqSSxjQUFNLEtBQUssaUJBQWlCLENBQUMsQ0FBQyxRQUFRLGVBQWUsUUFBUSxVQUFVLGtCQUFrQjtBQUFBLE1BQzFGLE9BQU87QUFDTixjQUFNLEtBQUssV0FBVyxDQUFDLENBQUMsUUFBUSxhQUFhO0FBQUEsTUFDOUM7QUFDQSxZQUFNLE1BQU0sS0FBSyxJQUFJO0FBQ3JCLFdBQUssV0FBVyxNQUFNLFFBQVEsZ0JBQWdCLE1BQU0sS0FBSyxJQUFJO0FBRTdELFVBQUksTUFBTSx5QkFBeUI7QUFDbEMsZUFBTyxDQUFDO0FBQUEsTUFDVDtBQUVBLFVBQUksVUFBb0IsQ0FBQztBQUN6QixVQUFJLFFBQVEsYUFBYSxRQUFRLFVBQVUsa0JBQWtCLHNCQUFzQixTQUFTLFFBQVEsVUFBVSxvQkFBb0I7QUFDakksY0FBTSxrQkFBa0Isb0JBQW9CLFFBQVEsVUFBVSxrQkFBa0I7QUFDaEYsa0JBQVUsZ0JBQWdCLElBQVksV0FBUyxLQUFLLG9CQUFvQixVQUFVLEtBQUssRUFBRSxNQUFNLEVBQUU7QUFBQSxNQUNsRztBQUVBLFlBQU0saUJBQWlCLE1BQU0sS0FBSyxTQUFTLEtBQUssT0FBTyxFQUFFLGVBQWUsUUFBUSxlQUFlLFdBQVcsUUFBUSxXQUFXLGVBQWUsQ0FBQyxDQUFDLFFBQVEsc0JBQXNCLGVBQWUsQ0FBQyxDQUFDLFFBQVEsZUFBZSw0QkFBNEIsU0FBUyxRQUFpQixDQUFDO0FBRTNRLFVBQUksTUFBTSx5QkFBeUI7QUFDbEMsZUFBTyxDQUFDO0FBQUEsTUFDVDtBQUdBLHFCQUFlLFFBQVEsV0FBUztBQUMvQixjQUFNLE9BQU8sS0FBSyxtQkFBb0IsVUFBVSxLQUFLLENBQUFGLFVBQVFBLE1BQUssT0FBTyxNQUFNLE1BQU07QUFFckYsWUFBSSxDQUFDLE1BQU07QUFDVjtBQUFBLFFBQ0Q7QUFFQSxZQUFJLE1BQU0sU0FBUyxXQUFXO0FBRTdCLGNBQUksS0FBSyxhQUFhLE1BQU0sY0FBYyxXQUFXLENBQUMsUUFBUSxzQkFBc0I7QUFDbkY7QUFBQSxVQUNEO0FBRUEsY0FBSSxLQUFLLGFBQWEsTUFBTSxjQUFjLFdBQVcsUUFBUSxvQkFBb0I7QUFDaEY7QUFBQSxVQUNEO0FBQUEsUUFDRCxPQUFPO0FBQ04sY0FBSSxDQUFDLFFBQVEsZUFBZTtBQUUzQjtBQUFBLFVBQ0Q7QUFBQSxRQUNEO0FBRUEsY0FBTSxpQkFBaUIsU0FBUyxNQUFNLE1BQU07QUFFNUMsWUFBSSxnQkFBZ0I7QUFDbkIseUJBQWUsZUFBZSxLQUFLLEtBQUs7QUFBQSxRQUN6QyxPQUFPO0FBRU4sbUJBQVMsTUFBTSxNQUFNLElBQUksSUFBSTtBQUFBLFlBQzVCLEtBQUssbUJBQW9CLFVBQVUsS0FBSyxDQUFBQSxVQUFRQSxNQUFLLE9BQU8sTUFBTSxNQUFNO0FBQUEsWUFDeEUsS0FBSyxtQkFBb0IsVUFBVSxVQUFVLENBQUFBLFVBQVFBLE1BQUssT0FBTyxNQUFNLE1BQU07QUFBQSxZQUM3RSxDQUFDO0FBQUEsWUFDRCxDQUFDLEtBQUs7QUFBQSxVQUNQO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUFBLElBQ0Y7QUFFQSxVQUFNLE1BQWdDLENBQUM7QUFDdkMsU0FBSyxtQkFBbUIsVUFBVSxRQUFRLENBQUMsTUFBTSxVQUFVO0FBQzFELFVBQUksU0FBUyxLQUFLLEVBQUUsR0FBRztBQUN0QixZQUFJLEtBQUssSUFBSSxtQkFBbUIsTUFBTSxPQUFPLFNBQVMsS0FBSyxFQUFFLEVBQUUsZ0JBQWdCLFNBQVMsS0FBSyxFQUFFLEVBQUUsY0FBYyxDQUFDO0FBQUEsTUFDakg7QUFBQSxJQUNELENBQUM7QUFFRCxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBTSxxQkFBcUIsWUFBb0IsU0FBbUM7QUFDakYsUUFBSSxDQUFDLEtBQUssVUFBVTtBQUNuQixhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU8sS0FBSyxVQUFVLHFCQUFxQixZQUFZLFdBQVcsS0FBSyxNQUFNLENBQUM7QUFBQSxFQUMvRTtBQUFBLEVBRUEsTUFBTSx1QkFBdUIsWUFBb0IsU0FBaUM7QUFDakYsUUFBSSxDQUFDLEtBQUssVUFBVTtBQUNuQjtBQUFBLElBQ0Q7QUFFQSxXQUFPLEtBQUssVUFBVSx1QkFBdUIsWUFBWSxXQUFXLEtBQUssTUFBTSxDQUFDO0FBQUEsRUFDakY7QUFBQSxFQUVBLFNBQVMsU0FBa0I7QUFDMUIsU0FBSyxVQUFVLFNBQVMsV0FBVyxLQUFLLE1BQU0sQ0FBQztBQUFBLEVBQ2hEO0FBQUE7QUFBQTtBQUFBLEVBTUEsZ0JBQW9DO0FBQ25DLFFBQUksQ0FBQyxLQUFLLE9BQU87QUFDaEIsWUFBTSxJQUFJLE1BQU0sdUNBQXVDO0FBQUEsSUFDeEQ7QUFFQSxRQUFJLENBQUMsS0FBSyxXQUFXO0FBQ3BCLFdBQUssa0JBQWtCO0FBQUEsSUFDeEI7QUFFQSxXQUFPO0FBQUEsTUFDTixPQUFPLEtBQUssWUFBWSxTQUFTO0FBQUEsTUFDakMsUUFBUSxLQUFLLFlBQVksVUFBVTtBQUFBLE1BQ25DLGNBQWMsS0FBSyxPQUFPLGdCQUFnQixLQUFLO0FBQUEsTUFDL0MsVUFBVSxLQUFLO0FBQUEsTUFDZixjQUFjLEtBQUssdUJBQXVCLHVCQUF1QixLQUFLO0FBQUEsSUFDdkU7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFNLG9CQUFvQixNQUEyQjtBQUNwRCxRQUFJLENBQUMsS0FBSyxVQUFVO0FBQ25CO0FBQUEsSUFDRDtBQUVBLFFBQUksQ0FBQyxLQUFLLFNBQVMsV0FBVyxHQUFHO0FBQ2hDLFlBQU0sS0FBSyxnQkFBZ0I7QUFBQSxJQUM1QjtBQUVBLFFBQUksQ0FBQyxLQUFLLFlBQVksQ0FBQyxLQUFLLE1BQU0sZ0JBQWdCO0FBQ2pEO0FBQUEsSUFDRDtBQUVBLFFBQUksQ0FBQyxLQUFLLGFBQWEsQ0FBQyxLQUFLLE1BQU0sV0FBVztBQUM3QztBQUFBLElBQ0Q7QUFFQSxRQUFJLEtBQUssVUFBVSxhQUFhLElBQUksTUFBTSxJQUFJO0FBQzdDO0FBQUEsSUFDRDtBQUVBLFFBQUksS0FBSyxhQUFhLElBQUksR0FBRztBQUM1QjtBQUFBLElBQ0Q7QUFFQSxVQUFNLGFBQWEsU0FBUyxLQUFLLE1BQU0sZUFBZSxRQUFRLE1BQU0sS0FBSyxFQUFFO0FBQzNFLFVBQU0sTUFBTSxDQUFDLENBQUMsYUFBYyxJQUFJLGFBQWM7QUFFOUMsVUFBTSxVQUFVLEtBQUssTUFBTSxxQkFBcUIsSUFBSTtBQUNwRCxVQUFNLEtBQUssU0FBUyxrQkFBa0I7QUFBQSxNQUNyQyxNQUFNLEtBQUs7QUFBQSxNQUNYLFlBQVksS0FBSztBQUFBLE1BQ2pCLFFBQVEsS0FBSztBQUFBLE1BQ2IsU0FBUyxLQUFLLFFBQVE7QUFBQSxNQUN0QixRQUFRLFVBQVU7QUFBQSxNQUNsQixTQUFTO0FBQUEsTUFDVCxVQUFVLEtBQUs7QUFBQSxJQUNoQixDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRVEsYUFBYSxNQUErQjtBQUNuRCxVQUFNLGFBQWEsS0FBSyxVQUFXLGFBQWEsSUFBSTtBQUNwRCxVQUFNLGVBQWUsS0FBSyxVQUFXLGdCQUFnQjtBQUNyRCxXQUFPLGFBQWEsS0FBSyxXQUFTLGNBQWMsTUFBTSxTQUFTLGNBQWMsTUFBTSxHQUFHO0FBQUEsRUFDdkY7QUFBQSxFQUVBLE1BQU0scUJBQXFCLE9BQXVDO0FBQ2pFLFFBQUksQ0FBQyxLQUFLLFVBQVU7QUFDbkI7QUFBQSxJQUNEO0FBRUEsUUFBSSxDQUFDLEtBQUssU0FBUyxXQUFXLEdBQUc7QUFDaEMsWUFBTSxLQUFLLGdCQUFnQjtBQUFBLElBQzVCO0FBRUEsVUFBTSxLQUFLLFVBQVUscUJBQXFCLE1BQU0sSUFBSSxVQUFRLEtBQUssRUFBRSxDQUFDO0FBQUEsRUFDckU7QUFBQSxFQUVBLE1BQU0sbUJBQW1CLE9BQXVDO0FBQy9ELFFBQUksQ0FBQyxLQUFLLFlBQVksQ0FBQyxNQUFNLFFBQVE7QUFDcEM7QUFBQSxJQUNEO0FBRUEsUUFBSSxDQUFDLEtBQUssU0FBUyxXQUFXLEdBQUc7QUFDaEMsWUFBTSxLQUFLLGdCQUFnQjtBQUFBLElBQzVCO0FBRUEsVUFBTSxLQUFLLFVBQVUsbUJBQW1CLE1BQU0sSUFBSSxVQUFRLEtBQUssRUFBRSxDQUFDO0FBQUEsRUFDbkU7QUFBQSxFQUVBLE1BQU0scUJBQXFCLE9BQXVDO0FBQ2pFLFFBQUksQ0FBQyxLQUFLLFVBQVU7QUFDbkI7QUFBQSxJQUNEO0FBRUEsUUFBSSxDQUFDLEtBQUssU0FBUyxXQUFXLEdBQUc7QUFDaEMsWUFBTSxLQUFLLGdCQUFnQjtBQUFBLElBQzVCO0FBRUEsVUFBTSxLQUFLLFVBQVUscUJBQXFCLE1BQU0sSUFBSSxVQUFRLEtBQUssRUFBRSxDQUFDO0FBQUEsRUFDckU7QUFBQSxFQUVBLE1BQWMsaUNBQWdEO0FBQzdELFFBQUksQ0FBQyxLQUFLLFVBQVU7QUFDbkI7QUFBQSxJQUNEO0FBRUEsUUFBSSxDQUFDLEtBQUssU0FBUyxXQUFXLEdBQUc7QUFDaEMsWUFBTSxLQUFLLGdCQUFnQjtBQUFBLElBQzVCO0FBRUEsVUFBTSxnQkFBZ0IsS0FBSyx1QkFBdUIsRUFBRSxJQUFJLFVBQVEsS0FBSyxFQUFFO0FBR3ZFLFVBQU0sS0FBSyxVQUFVLDhCQUE4QixjQUFjLFNBQVMsSUFBSSxnQkFBZ0IsQ0FBQyxDQUFDO0FBQUEsRUFDakc7QUFBQSxFQUVBLE1BQU0sYUFBYSxNQUF5QixRQUE0QixRQUFnQixnQkFBd0M7QUFDL0gsU0FBSyw0QkFBNEIsTUFBTSxPQUFPLE9BQU8sTUFBTSxVQUFVLFlBQVk7QUFDaEYsVUFBSSxLQUFLLGVBQWUsQ0FBQyxLQUFLLFVBQVU7QUFDdkM7QUFBQSxNQUNEO0FBRUEsVUFBSSxDQUFDLEtBQUssU0FBUyxXQUFXLEdBQUc7QUFDaEMsY0FBTSxLQUFLLGdCQUFnQjtBQUFBLE1BQzVCO0FBRUEsVUFBSSxDQUFDLEtBQUssVUFBVTtBQUNuQjtBQUFBLE1BQ0Q7QUFFQSxVQUFJLENBQUMsS0FBSyxNQUFNLGdCQUFnQjtBQUMvQjtBQUFBLE1BQ0Q7QUFFQSxVQUFJLE9BQU8sU0FBUyxpQkFBaUIsV0FBVztBQUMvQyxhQUFLLDBCQUEwQixRQUFRLE9BQU8sU0FBUyxFQUFFO0FBQUEsTUFDMUQ7QUFFQSxZQUFNLGFBQWEsU0FBUyxLQUFLLE1BQU0sZUFBZSxRQUFRLE1BQU0sS0FBSyxFQUFFO0FBQzNFLFlBQU0sTUFBTSxDQUFDLENBQUMsYUFBYyxJQUFJLGFBQWM7QUFFOUMsWUFBTSxVQUFVLEtBQUssTUFBTSxxQkFBcUIsSUFBSSxJQUFJO0FBRXhELFlBQU0saUJBQWlCLEtBQUssU0FBUyxhQUFhLElBQUksT0FBTyxNQUFNO0FBQ25FLFVBQUksQ0FBQyxrQkFDQSxDQUFDLGVBQWUsWUFBWSxPQUFPLFNBQVMsaUJBQWlCLFdBQ2hFO0FBQ0QsWUFBSSxnQkFBZ0I7QUFDbkIsZUFBSyxTQUFTLG1DQUFtQyxFQUFFLFFBQVEsS0FBSyxJQUFJLFlBQVksS0FBSyxRQUFRLFNBQVMsS0FBSyxLQUFLLGFBQWEsS0FBSyxpQkFBaUIsWUFBWSxHQUFHLFFBQVEsU0FBUyxNQUFNO0FBQUEsUUFDMUwsT0FBTztBQUNOLGVBQUssU0FBUyxhQUFhLEVBQUUsUUFBUSxLQUFLLElBQUksWUFBWSxLQUFLLFFBQVEsU0FBUyxLQUFLLEtBQUssYUFBYSxLQUFLLGlCQUFpQixZQUFZLEdBQUcsUUFBUSxTQUFTLE1BQU07QUFBQSxRQUNwSztBQUFBLE1BQ0QsV0FBVyxlQUFlLFlBQ3RCLE9BQU8sU0FBUyxpQkFBaUIsYUFDakMsZUFBZSxTQUFTLE9BQU8sT0FBTyxTQUFTLElBQUk7QUFFdEQsYUFBSyxTQUFTLGFBQWEsQ0FBQyxPQUFPLE1BQU0sQ0FBQztBQUMxQyxhQUFLLFNBQVMsYUFBYSxFQUFFLFFBQVEsS0FBSyxJQUFJLFlBQVksS0FBSyxRQUFRLFNBQVMsS0FBSyxJQUFJLEdBQUcsUUFBUSxTQUFTLE1BQU07QUFBQSxNQUNwSCxXQUFXLGVBQWUsY0FBYyxPQUFPLE9BQU8sTUFBTSxXQUFXO0FBQ3RFLGFBQUssU0FBUyxhQUFhLEVBQUUsUUFBUSxLQUFLLElBQUksWUFBWSxLQUFLLFFBQVEsU0FBUyxLQUFLLEtBQUssYUFBYSxLQUFLLGlCQUFpQixZQUFZLEdBQUcsUUFBUSxTQUFTLE1BQU07QUFBQSxNQUNwSyxPQUFPO0FBQ04sY0FBTSxjQUFjLEtBQUssa0JBQWtCLFFBQVEsT0FBTyxNQUFNO0FBQ2hFLGNBQU0sZUFBZSxLQUFLLGdCQUFnQixXQUFXO0FBQ3JELGFBQUssU0FBUyxpQkFBaUIsQ0FBQztBQUFBLFVBQy9CO0FBQUEsVUFDQSxRQUFRLE9BQU87QUFBQSxVQUNmO0FBQUEsVUFDQTtBQUFBLFVBQ0EsY0FBYyxDQUFDLEtBQUs7QUFBQSxRQUNyQixDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDUDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQU0sYUFBYSxNQUF5QixRQUE0QixRQUErQjtBQUN0RyxTQUFLLDRCQUE0QixNQUFNLE9BQU8sT0FBTyxNQUFNLFVBQVUsWUFBWTtBQUNoRixVQUFJLEtBQUssZUFBZSxDQUFDLEtBQUssWUFBWSxLQUFLLG1CQUFtQjtBQUNqRTtBQUFBLE1BQ0Q7QUFFQSxVQUFJLENBQUMsS0FBSyxTQUFTLFdBQVcsR0FBRztBQUNoQyxjQUFNLEtBQUssZ0JBQWdCO0FBQUEsTUFDNUI7QUFFQSxVQUFJLENBQUMsS0FBSyxZQUFZLENBQUMsS0FBSyxNQUFNLGdCQUFnQjtBQUNqRDtBQUFBLE1BQ0Q7QUFFQSxVQUFJLENBQUMsS0FBSyxTQUFTLGFBQWEsSUFBSSxPQUFPLE1BQU0sR0FBRztBQUNuRCxlQUFPLEtBQUssYUFBYSxNQUFNLFFBQVEsUUFBUSxLQUFLO0FBQUEsTUFDckQ7QUFFQSxVQUFJLE9BQU8sU0FBUyxpQkFBaUIsV0FBVztBQUMvQyxhQUFLLDBCQUEwQixRQUFRLE9BQU8sU0FBUyxFQUFFO0FBQUEsTUFDMUQ7QUFFQSxZQUFNLGFBQWEsU0FBUyxLQUFLLE1BQU0sZUFBZSxRQUFRLE1BQU0sS0FBSyxFQUFFO0FBQzNFLFlBQU0sTUFBTSxDQUFDLENBQUMsYUFBYyxJQUFJLGFBQWM7QUFFOUMsWUFBTSxVQUFVLEtBQUssTUFBTSxxQkFBcUIsSUFBSSxJQUFJO0FBQ3hELFdBQUssU0FBUyxhQUFhLEVBQUUsUUFBUSxLQUFLLElBQUksWUFBWSxLQUFLLFFBQVEsU0FBUyxLQUFLLElBQUksR0FBRyxRQUFRLFNBQVMsTUFBTTtBQUFBLElBQ3BILENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFNLGdCQUFnQixZQUFpRDtBQUN0RSxTQUFLLFVBQVUsVUFBVSxVQUFVO0FBQUEsRUFDcEM7QUFBQSxFQUVBLFlBQVksUUFBOEI7QUFDekMsU0FBSyw0QkFBNEIsTUFBTSxPQUFPLE1BQU0sVUFBVSxZQUFZO0FBQ3pFLFVBQUksS0FBSyxlQUFlLENBQUMsS0FBSyxVQUFVO0FBQ3ZDO0FBQUEsTUFDRDtBQUVBLFVBQUksS0FBSyxVQUFVLFdBQVcsR0FBRztBQUNoQyxhQUFLLFNBQVMsYUFBYSxDQUFDLE1BQU0sQ0FBQztBQUFBLE1BQ3BDO0FBRUEsV0FBSyxtQkFBbUIsS0FBSyxNQUFNO0FBQUEsSUFDcEMsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLFVBQVUsUUFBOEI7QUFDdkMsU0FBSyw0QkFBNEIsTUFBTSxPQUFPLE1BQU0sVUFBVSxZQUFZO0FBQ3pFLFVBQUksS0FBSyxlQUFlLENBQUMsS0FBSyxVQUFVO0FBQ3ZDO0FBQUEsTUFDRDtBQUVBLFVBQUksS0FBSyxVQUFVLFdBQVcsR0FBRztBQUNoQyxhQUFLLFNBQVMsVUFBVSxNQUFNO0FBQUEsTUFDL0I7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQUE7QUFBQSxFQUdBLFlBQVksU0FBYztBQUN6QixRQUFJLEtBQUssVUFBVSxXQUFXLEdBQUc7QUFDaEMsV0FBSyxTQUFTLGtCQUFrQixPQUFPO0FBQUEsSUFDeEM7QUFBQSxFQUNEO0FBQUE7QUFBQSxFQUlBLGFBQWEsV0FBbUI7QUFDL0IsU0FBSyxrQkFBa0IsVUFBVSxJQUFJLFNBQVM7QUFBQSxFQUMvQztBQUFBLEVBRUEsZ0JBQWdCLFdBQW1CO0FBQ2xDLFNBQUssa0JBQWtCLFVBQVUsT0FBTyxTQUFTO0FBQUEsRUFDbEQ7QUFBQSxFQUVBLE9BQU8sT0FBMkM7QUFDakQsV0FBTyxLQUFLLFdBQVcsT0FBTyxLQUFLO0FBQUEsRUFDcEM7QUFBQSxFQUVBLGNBQWMsVUFBMkM7QUFDeEQsVUFBTSxFQUFFLFdBQVcsSUFBSTtBQUN2QixXQUFPLEtBQUssV0FBVyxVQUFVLEtBQUssUUFBTSxHQUFHLFdBQVcsVUFBVTtBQUFBLEVBQ3JFO0FBQUEsRUFFQSxnQkFBZ0IsUUFBNEM7QUFDM0QsV0FBTyxLQUFLLFdBQVcsZ0JBQWdCLE1BQU07QUFBQSxFQUM5QztBQUFBLEVBRUEsYUFBYSxNQUFzQjtBQUNsQyxXQUFPLEtBQUssV0FBVyxxQkFBcUIsS0FBSyxNQUFNO0FBQUEsRUFDeEQ7QUFBQSxFQUVBLHdCQUF3QixPQUFtQztBQUMxRCxXQUFPLEtBQUssV0FBVyx3QkFBd0IsS0FBSztBQUFBLEVBQ3JEO0FBQUEsRUFFQSw0QkFBNEIsT0FBbUM7QUFDOUQsV0FBTyxLQUFLLFdBQVcsNEJBQTRCLEtBQUs7QUFBQSxFQUN6RDtBQUFBLEVBRVEsc0JBQXNCO0FBQzdCLFFBQUksS0FBSyxlQUFlLENBQUMsS0FBSyxVQUFVLFdBQVcsR0FBRztBQUNyRDtBQUFBLElBQ0Q7QUFFQSxRQUFJLENBQUMsS0FBSyxNQUFNLGdCQUFnQjtBQUMvQjtBQUFBLElBQ0Q7QUFFQSxVQUFNLGVBQWUsS0FBSyxNQUFNO0FBQ2hDLFNBQUssU0FBUyxRQUFRLE1BQU0sU0FBUyxHQUFHLGVBQWUsNEJBQTRCLENBQUM7QUFFcEYsVUFBTSxhQUFhLFNBQVMsS0FBSyxNQUFNLGVBQWUsUUFBUSxNQUFNLEtBQUssRUFBRTtBQUMzRSxVQUFNLE1BQU0sQ0FBQyxDQUFDLGFBQWMsSUFBSSxhQUFjO0FBRTlDLFVBQU0sY0FBbUQsQ0FBQztBQUMxRCxVQUFNLGVBQXVDLENBQUM7QUFDOUMsU0FBSyxVQUFVLGFBQWEsUUFBUSxDQUFDLE9BQU8sUUFBUTtBQUNuRCxZQUFNLE9BQU8sS0FBSyxXQUFXLGdCQUFnQixNQUFNLFNBQVMsVUFBVTtBQUN0RSxVQUFJLENBQUMsUUFBUSxFQUFFLGdCQUFnQixvQkFBb0I7QUFDbEQ7QUFBQSxNQUNEO0FBRUEsV0FBSyxXQUFXLFVBQVUsS0FBSyxDQUFBQSxVQUFRQSxNQUFLLFdBQVcsTUFBTSxTQUFTLFVBQVU7QUFDaEYsWUFBTSxZQUFZLEtBQUssTUFBTSxhQUFhLElBQUk7QUFFOUMsVUFBSSxjQUFjLFFBQVc7QUFDNUI7QUFBQSxNQUNEO0FBRUEsVUFBSSxLQUFLLGtCQUFrQixRQUFRLEdBQUcsSUFBSSxHQUFHO0FBRTVDLHFCQUFhLEtBQUssR0FBRztBQUFBLE1BQ3RCO0FBRUEsWUFBTSxVQUFVLEtBQUssTUFBTSxxQkFBcUIsSUFBSTtBQUNwRCxZQUFNLGNBQWMsS0FBSyxrQkFBa0IsUUFBUSxHQUFHO0FBQ3RELFlBQU0sZUFBZSxLQUFLLGdCQUFnQixXQUFXO0FBQ3JELGtCQUFZLEtBQUs7QUFBQSxRQUNoQjtBQUFBLFFBQ0EsUUFBUTtBQUFBLFFBQ1IsU0FBUyxVQUFVO0FBQUEsUUFDbkI7QUFBQSxRQUNBLGNBQWM7QUFBQSxNQUNmLENBQUM7QUFBQSxJQUNGLENBQUM7QUFFRCxTQUFLLFNBQVMsYUFBYSxZQUFZO0FBRXZDLFVBQU0sc0JBQXFELENBQUM7QUFDNUQsZUFBVyxVQUFVLEtBQUssU0FBUyxxQkFBcUIsS0FBSyxHQUFHO0FBQy9ELFlBQU0sT0FBTyxLQUFLLFdBQVcsVUFBVSxLQUFLLENBQUFBLFVBQVFBLE1BQUssT0FBTyxNQUFNO0FBQ3RFLFVBQUksTUFBTTtBQUNULGNBQU0sVUFBVSxLQUFLLE1BQU0scUJBQXFCLElBQUk7QUFFcEQsNEJBQW9CLEtBQUssRUFBRSxJQUFJLFFBQVEsS0FBSyxVQUFVLElBQUksQ0FBQztBQUFBLE1BQzVEO0FBQUEsSUFDRDtBQUVBLFFBQUksb0JBQW9CLFVBQVUsWUFBWSxRQUFRO0FBQ3JELFdBQUssT0FBTywyQ0FBMkMsbUJBQW1CO0FBQzFFLFdBQUssVUFBVSxpQkFBaUIsYUFBYSxtQkFBbUI7QUFBQSxJQUNqRTtBQUFBLEVBQ0Q7QUFBQTtBQUFBO0FBQUEsRUFLUSxvQkFBb0IsVUFBMkIsUUFBOEIsY0FBc0IsUUFBaUIsUUFBdUI7QUFDbEosVUFBTSxPQUFPLEtBQUssV0FBVyxVQUFVLEtBQUssUUFBTSxHQUFHLFdBQVcsU0FBUyxVQUFVO0FBQ25GLFFBQUksUUFBUSxnQkFBZ0IsbUJBQW1CO0FBQzlDLFlBQU0sY0FBYyxLQUFLLGtCQUFrQixRQUFRLE1BQU07QUFDekQsVUFBSSxjQUFjLElBQUk7QUFDckIsYUFBSyxPQUFPLHNCQUFzQixLQUFLLFFBQVEsWUFBWTtBQUMzRCxhQUFLLG1CQUFtQixhQUFhLGNBQWMsTUFBTTtBQUN6RCxhQUFLLG1CQUFtQixNQUFNLEtBQUssV0FBVyxXQUFXO0FBRXpELFlBQUksUUFBUTtBQUNYLGVBQUssbUJBQW1CLEtBQUssTUFBTTtBQUFBLFFBQ3BDO0FBQUEsTUFDRCxPQUFPO0FBQ04sYUFBSyxPQUFPLGlEQUFpRDtBQUFBLE1BQzlEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUlRLHlCQUF5QixVQUEyQixVQUFrQixRQUFnQjtBQUM3RixVQUFNLFdBQVcsS0FBSyx5QkFBeUIsU0FBUztBQUN4RCxTQUFLLHlCQUF5QixJQUFJLFVBQVUsRUFBRSxRQUFRLFNBQVMsUUFBUSxVQUFVLE9BQU8sQ0FBQztBQUV6RixRQUFJLFVBQVU7QUFDYixVQUFJLDZCQUE2QixJQUFJLFVBQVUsS0FBSyxXQUFXLENBQUMsR0FBRyxNQUFNO0FBQ3hFLGFBQUssT0FBTyxZQUFZO0FBQ3hCLGFBQUssb0JBQW9CO0FBRXpCLGFBQUssVUFBVSxVQUFVLENBQUMsR0FBRyxLQUFLLHlCQUF5QixPQUFPLENBQUMsQ0FBQztBQUVwRSxhQUFLLHlCQUF5QixNQUFNO0FBQUEsTUFDckMsR0FBRyxFQUFFO0FBQUEsSUFDTjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLGFBQWEsUUFBNEM7QUFDaEUsV0FBTyxLQUFLLFdBQVcsVUFBVSxLQUFLLFFBQU0sR0FBRyxPQUFPLE1BQU07QUFBQSxFQUM3RDtBQUFBLEVBRVEsd0JBQXdCLFFBQWdCLFFBQWdCLFFBQWlCO0FBQ2hGLFVBQU0sT0FBTyxLQUFLLGFBQWEsTUFBTTtBQUNyQyxRQUFJLFFBQVEsZ0JBQWdCLHFCQUFxQjtBQUNoRCxZQUFNLEVBQUUsaUJBQWlCLElBQUksS0FBSyxpQkFBaUIsK0JBQStCLEtBQUssV0FBVyxRQUFRO0FBQzFHLFdBQUssT0FBTyw0QkFBNEIsS0FBSyxRQUFRLFNBQVMsa0JBQWtCLE1BQU07QUFDdEYsV0FBSyx5QkFBeUI7QUFBQSxJQUMvQjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLHdCQUF3QixRQUFnQixXQUFnQztBQUMvRSxVQUFNLE9BQU8sS0FBSyxhQUFhLE1BQU07QUFDckMsUUFBSSxnQkFBZ0IscUJBQXFCO0FBQ3hDLFdBQUssYUFBYSxJQUFJO0FBQ3RCLFdBQUssZ0JBQWdCLFdBQVcsMEJBQTBCO0FBQUEsSUFDM0Q7QUFBQSxFQUNEO0FBQUEsRUFFUSx3QkFBd0IsUUFBZ0IsT0FBc0M7QUFDckYsVUFBTSxPQUFPLEtBQUssYUFBYSxNQUFNO0FBQ3JDLFFBQUksZ0JBQWdCLHFCQUFxQjtBQUN4QyxZQUFNLGdCQUFnQixLQUFLLE1BQU0saUJBQWlCLENBQUMsU0FBUyxLQUFLLE1BQU0sZUFBZSxRQUFRLE1BQU0sS0FBSyxFQUFFLElBQUk7QUFDL0csV0FBSyxnQkFBZ0Isa0JBQWtCLE1BQU0sTUFBTSxjQUFjLGFBQWE7QUFBQSxJQUMvRTtBQUFBLEVBQ0Q7QUFBQSxFQUVRLG1CQUFtQixRQUFnQixPQUFzQztBQUNoRixVQUFNLE9BQU8sS0FBSyxhQUFhLE1BQU07QUFDckMsUUFBSSxnQkFBZ0IscUJBQXFCO0FBQ3hDLFlBQU0sZ0JBQWdCLEtBQUssTUFBTSxpQkFBaUIsQ0FBQyxTQUFTLEtBQUssTUFBTSxlQUFlLFFBQVEsTUFBTSxLQUFLLEVBQUUsSUFBSTtBQUMvRyxXQUFLLGdCQUFnQixhQUFhLE1BQU0sTUFBTSxjQUFjLGFBQWE7QUFBQSxJQUMxRTtBQUFBLEVBQ0Q7QUFBQSxFQUVRLG1CQUFtQixRQUFnQixPQUF5RTtBQUNuSCxVQUFNLE9BQU8sS0FBSyxhQUFhLE1BQU07QUFDckMsUUFBSSxnQkFBZ0IscUJBQXFCO0FBQ3hDLFlBQU0sZ0JBQWdCLEtBQUssTUFBTSxpQkFBaUIsQ0FBQyxTQUFTLEtBQUssTUFBTSxlQUFlLFFBQVEsTUFBTSxLQUFLLEVBQUUsSUFBSTtBQUMvRyxZQUFNLGVBQWU7QUFDckIsV0FBSyxnQkFBZ0IsYUFBYSxNQUFNLEtBQUs7QUFBQSxJQUM5QztBQUFBLEVBQ0Q7QUFBQSxFQUVRLHNCQUFzQixRQUFzQjtBQUNuRCxVQUFNLE9BQU8sS0FBSyxhQUFhLE1BQU07QUFDckMsUUFBSSxnQkFBZ0IscUJBQXFCO0FBQ3hDLFdBQUssZ0JBQWdCLGdCQUFnQixJQUFJO0FBQUEsSUFDMUM7QUFBQSxFQUNEO0FBQUEsRUFFUSxpQkFBaUIsUUFBc0I7QUFDOUMsVUFBTSxPQUFPLEtBQUssYUFBYSxNQUFNO0FBQ3JDLFFBQUksTUFBTTtBQUNULFdBQUssMEJBQTBCLEtBQUssSUFBSTtBQUFBLElBQ3pDO0FBQUEsRUFDRDtBQUFBLEVBRVEsMkJBQTJCLFFBQWdCLGFBQXFCLFVBQWtCLFlBQTBCO0FBQ25ILFFBQUksQ0FBQyxLQUFLLFNBQVMsR0FBRztBQUNyQjtBQUFBLElBQ0Q7QUFFQSxVQUFNLE9BQU8sS0FBSyxhQUFhLE1BQU07QUFDckMsVUFBTSxZQUFZLENBQUMsT0FBTyxTQUFZLEtBQUssYUFBYSxJQUFJO0FBQzVELFFBQUksTUFBTSxpQkFBaUIsZ0JBQWdCLGVBQWUsY0FBYyxRQUFXO0FBQ2xGLFlBQU0sb0JBQW9CLEtBQUssaUJBQWlCLGtCQUFrQixDQUFDO0FBQ25FLHdCQUFrQixVQUFVLEtBQUssa0JBQWtCLFVBQVUsS0FBSyxLQUFLO0FBRXZFLFdBQUssVUFBVSxXQUFXO0FBQUEsUUFDekI7QUFBQSxVQUNDLFVBQVUsYUFBYTtBQUFBLFVBQ3ZCLE9BQU87QUFBQSxVQUNQLGtCQUFrQjtBQUFBLFlBQ2pCO0FBQUEsWUFDQSxnQkFBZ0I7QUFBQSxVQUNqQjtBQUFBLFFBQ0Q7QUFBQSxNQUNELEdBQUcsTUFBTSxRQUFXLE1BQU0sUUFBVyxRQUFXLEtBQUs7QUFBQSxJQUV0RDtBQUFBLEVBQ0Q7QUFBQTtBQUFBO0FBQUEsRUFLQSxnQkFBdUQsSUFBZTtBQUNyRSxXQUFXLEtBQUssZUFBZSxJQUFJLEVBQUUsS0FBSztBQUFBLEVBQzNDO0FBQUE7QUFBQSxFQUlTLFVBQVU7QUFDbEIsU0FBSyxjQUFjO0FBRW5CLFNBQUssVUFBVSxRQUFRO0FBQ3ZCLFNBQUssV0FBVztBQUVoQixTQUFLLG1CQUFtQixRQUFRLE9BQUssRUFBRSxRQUFRLENBQUM7QUFFaEQsU0FBSyxzQkFBc0IscUJBQXFCLElBQUk7QUFDcEQsWUFBUSxLQUFLLGVBQWUsT0FBTyxDQUFDO0FBQ3BDLFNBQUssZUFBZSxNQUFNO0FBRTFCLFNBQUssWUFBWSxNQUFNO0FBQ3ZCLFlBQVEsS0FBSyx3QkFBd0I7QUFDckMsU0FBSyxNQUFNLFFBQVE7QUFDbkIsU0FBSyxxQkFBcUIsUUFBUTtBQUVsQyxTQUFLLGtCQUFrQixPQUFPO0FBQzlCLFNBQUssV0FBVyxRQUFRO0FBRXhCLFNBQUssaUJBQWlCLE1BQU07QUFDNUIsU0FBSyx1QkFBdUIsUUFBUSxPQUFLLEVBQUUsUUFBUSxDQUFDO0FBQ3BELFNBQUssdUJBQXVCLE1BQU07QUFFbEMsU0FBSyxnQ0FBZ0MsT0FBTztBQUU1QyxVQUFNLFFBQVE7QUFHZCxTQUFLLFdBQVc7QUFDaEIsU0FBSyx5QkFBeUI7QUFDOUIsU0FBSywyQkFBMkI7QUFDaEMsU0FBSyxpQkFBaUI7QUFDdEIsU0FBSyxzQkFBc0I7QUFDM0IsU0FBSyxxQkFBcUI7QUFDMUIsU0FBSyx5QkFBeUI7QUFDOUIsU0FBSyxzQkFBc0I7QUFDM0IsU0FBSyxRQUFRO0FBQ2IsU0FBSyx3QkFBd0I7QUFDN0IsU0FBSyxrQkFBa0I7QUFDdkIsU0FBSyxnQkFBZ0I7QUFBQSxFQUN0QjtBQUFBLEVBRUEsU0FBMkM7QUFDMUMsV0FBTztBQUFBLE1BQ04sYUFBYSxLQUFLLFdBQVc7QUFBQSxJQUM5QjtBQUFBLEVBQ0Q7QUFDRDtBQWpvR2EsdUJBQU47QUFBQSxFQXlLSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQXRMVTtBQW1vR2IsZUFBZSxPQUFPLE1BQU0sR0FBRyx1QkFBd0I7QUFDdkQsZUFBZSxPQUFPLE1BQU0sSUFBSSxtQ0FBbUM7QUFDbkUsZUFBZSxPQUFPLE1BQU0sSUFBSSw4QkFBOEI7QUFDOUQsZUFBZSxPQUFPLE1BQU0sSUFBSSxvQkFBb0I7QUFDcEQsZUFBZSxPQUFPLE1BQU0sSUFBSSxzQkFBc0I7QUFDdEQsZUFBZSxPQUFPLE1BQU0sSUFBSSw0QkFBNEI7QUFDNUQsZUFBZSxPQUFPLE1BQU0sSUFBSSxpQkFBaUI7QUFDakQsZUFBZSxPQUFPLE1BQU0sSUFBSSx3Q0FBd0M7QUFDeEUsZUFBZSxPQUFPLE1BQU0sSUFBSSwrQkFBK0I7QUFDL0QsZUFBZSxPQUFPLE1BQU0sSUFBSSxrQ0FBa0M7QUFDbEUsZUFBZSxPQUFPLE1BQU0sSUFBSSw4QkFBOEI7QUFDOUQsZUFBZSxPQUFPLE1BQU0sR0FBRyxrQ0FBa0M7QUFDakUsZUFBZSxPQUFPLE1BQU0sR0FBRyx1QkFBdUI7QUFDdEQsZUFBZSxPQUFPLE1BQU0sR0FBRyx1Q0FBdUM7QUFFL0QsTUFBTSxxQkFBcUIsY0FBYyw0QkFBNEI7QUFBQSxFQUMzRSxNQUFNLFlBQVksaUNBQWlDLENBQUM7QUFBQSxFQUNwRCxPQUFPLFlBQVksaUNBQWlDLENBQUM7QUFBQSxFQUNyRCxRQUFRO0FBQUEsRUFDUixTQUFTO0FBQ1YsR0FBRyxJQUFJLFNBQVMsNEJBQTRCLHNDQUFzQyxDQUFDO0FBRTVFLE1BQU0sMkJBQTJCLGNBQWMsZ0NBQWdDLGFBQWEsSUFBSSxTQUFTLGdDQUFnQywrQ0FBK0MsQ0FBQztBQUV6TCxNQUFNLHdCQUF3QixjQUFjLHdDQUF3QywwQkFBMEIsSUFBSSxTQUFTLHdDQUF3QyxnRUFBZ0UsQ0FBQztBQUVwTyxNQUFNLGtDQUFrQyxjQUFjLHFEQUFxRCwwQkFBMEIsSUFBSSxTQUFTLHFEQUFxRCxpRkFBaUYsQ0FBQztBQUV6UixNQUFNLHNCQUFzQixjQUFjLHNDQUFzQyxpQkFBaUIsSUFBSSxTQUFTLHNDQUFzQyxnRUFBZ0UsQ0FBQztBQUVyTixNQUFNLHdCQUF3QixjQUFjLHdDQUF3QyxZQUFZLElBQUksU0FBUyx3Q0FBd0Msa0VBQWtFLENBQUM7QUFFeE4sTUFBTSxxQ0FBcUMsY0FBYyx1Q0FBdUMsTUFBTSxJQUFJLFNBQVMsdUNBQXVDLG9EQUFvRCxDQUFDO0FBRS9NLE1BQU0sK0JBQStCLGNBQWMsMkNBQTJDLE1BQU0sSUFBSSxTQUFTLDJDQUEyQyx3REFBd0QsQ0FBQztBQUdyTixNQUFNLHlCQUF5QixjQUFjLGlDQUFpQztBQUFBLEVBQ3BGLE1BQU0sTUFBTSxRQUFRLFNBQVMsRUFBRSxZQUFZLElBQUk7QUFBQSxFQUMvQyxPQUFPLE1BQU0sUUFBUSxTQUFTLEVBQUUsWUFBWSxJQUFJO0FBQUEsRUFDaEQsUUFBUTtBQUFBLEVBQ1IsU0FBUztBQUNWLEdBQUcsSUFBSSxTQUFTLGlDQUFpQyx1REFBdUQsQ0FBQztBQUVsRyxNQUFNLHdCQUF3QixjQUFjLGtDQUFrQyxNQUFNLElBQUksU0FBUyx5QkFBeUIsMERBQTBELENBQUM7QUFFckwsTUFBTSx5QkFBeUIsY0FBYyxtQ0FBbUM7QUFBQSxFQUN0RixNQUFNO0FBQUEsRUFDTixPQUFPO0FBQUEsRUFDUCxRQUFRO0FBQUEsRUFDUixTQUFTO0FBQ1YsR0FBRyxJQUFJLFNBQVMsMEJBQTBCLDJEQUEyRCxDQUFDO0FBRy9GLE1BQU0sc0JBQXNCLGNBQWMsZ0NBQWdDO0FBQUEsRUFDaEYsTUFBTSxZQUFZLHVCQUF1QixHQUFFO0FBQUEsRUFDM0MsT0FBTyxZQUFZLHVCQUF1QixHQUFFO0FBQUEsRUFDNUMsUUFBUTtBQUFBLEVBQ1IsU0FBUztBQUNWLEdBQUcsSUFBSSxTQUFTLGdDQUFnQywwREFBMEQsQ0FBQztBQUVwRyxNQUFNLHFCQUFxQixjQUFjLCtCQUErQjtBQUFBLEVBQzlFLE1BQU07QUFBQSxFQUNOLE9BQU87QUFBQSxFQUNQLFFBQVE7QUFBQSxFQUNSLFNBQVM7QUFDVixHQUFHLElBQUksU0FBUywrQkFBK0IsMEZBQTBGLENBQUM7QUFFbkksTUFBTSw2QkFBNkIsY0FBYyx1Q0FBdUM7QUFBQSxFQUM5RixNQUFNO0FBQUEsRUFDTixPQUFPO0FBQUEsRUFDUCxRQUFRO0FBQUEsRUFDUixTQUFTO0FBQ1YsR0FBRyxJQUFJLFNBQVMsdUNBQXVDLG1FQUFtRSxDQUFDO0FBRXBILE1BQU0sb0JBQW9CLGNBQWMsOEJBQThCLGFBQWEsSUFBSSxTQUFTLDhCQUE4QiwyRUFBMkUsQ0FBQztBQUUxTSxNQUFNLDRCQUE0QixjQUFjLHNDQUFzQyxvQkFBb0IsSUFBSSxTQUFTLHNDQUFzQyx3SEFBd0gsQ0FBQztBQUV0UixNQUFNLHlCQUF5QixjQUFjLDZDQUE2QztBQUFBLEVBQ2hHLE9BQU8sSUFBSSxNQUFNLElBQUksS0FBSyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUM7QUFBQSxFQUN4QyxNQUFNLElBQUksTUFBTSxJQUFJLEtBQUssS0FBSyxLQUFLLEtBQUssSUFBSSxDQUFDO0FBQUEsRUFDN0MsUUFBUSxJQUFJLE1BQU0sSUFBSSxLQUFLLEtBQUssS0FBSyxLQUFLLElBQUksQ0FBQztBQUFBLEVBQy9DLFNBQVMsSUFBSSxNQUFNLElBQUksS0FBSyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUM7QUFDM0MsR0FBRyxJQUFJLFNBQVMsNkNBQTZDLHlEQUF5RCxDQUFDO0FBRWhILE1BQU0seUJBQXlCLGNBQWMsbUNBQW1DLGFBQWEsSUFBSSxTQUFTLG1DQUFtQyxxREFBcUQsQ0FBQztBQUVuTSxNQUFNLGdDQUFnQyxjQUFjLHNDQUFzQywyQkFBMkIsSUFBSSxTQUFTLHFDQUFxQyw2Q0FBNkMsQ0FBQztBQUVyTixNQUFNLHFDQUFxQyxjQUFjLDJDQUEyQyxnQ0FBZ0MsSUFBSSxTQUFTLDBDQUEwQywyREFBMkQsQ0FBQztBQUV2UCxNQUFNLHNDQUFzQyxjQUFjLDRDQUE0QyxpQ0FBaUMsSUFBSSxTQUFTLDJDQUEyQyw2REFBNkQsQ0FBQztBQUU3UCxNQUFNLHNCQUFzQixjQUFjLHNDQUFzQztBQUFBLEVBQ3RGLE1BQU0sTUFBTSxRQUFRLFdBQVc7QUFBQSxFQUMvQixPQUFPLE1BQU0sUUFBUSxXQUFXO0FBQUEsRUFDaEMsUUFBUTtBQUFBLEVBQ1IsU0FBUztBQUNWLEdBQUcsSUFBSSxTQUFTLHNDQUFzQyxzQ0FBc0MsQ0FBQztBQUV0RixNQUFNLHVCQUF1QixjQUFjLGlDQUFpQztBQUFBLEVBQ2xGLE9BQU87QUFBQSxFQUNQLE1BQU07QUFBQSxFQUNOLFFBQVE7QUFBQSxFQUNSLFNBQVM7QUFDVixHQUFHLElBQUksU0FBUyxpQ0FBaUMsK0JBQStCLENBQUM7QUFFakYsTUFBTSwyQkFBMkIsY0FBYyw2QkFBNkI7QUFBQSxFQUMzRSxPQUFPO0FBQUEsRUFDUCxNQUFNO0FBQUEsRUFDTixRQUFRO0FBQUEsRUFDUixTQUFTO0FBQ1YsR0FBRyxJQUFJLFNBQVMsNkJBQTZCLDRCQUE0QixDQUFDOyIsCiAgIm5hbWVzIjogWyJjZWxsIiwgInNlbGVjdGlvbiIsICJvZmZzZXQiXQp9Cg==
