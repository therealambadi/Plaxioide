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
import * as nls from "../../../../../nls.js";
import * as DOM from "../../../../../base/browser/dom.js";
import { findLastIdx } from "../../../../../base/common/arraysFind.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IThemeService, registerThemingParticipant } from "../../../../../platform/theme/common/themeService.js";
import { EditorPaneSelectionChangeReason, EditorPaneSelectionCompareResult } from "../../../../common/editor.js";
import { getDefaultNotebookCreationOptions } from "../notebookEditorWidget.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { SideBySideDiffElementViewModel } from "./diffElementViewModel.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { CellDiffPlaceholderRenderer, CellDiffSideBySideRenderer, CellDiffSingleSideRenderer, NotebookCellTextDiffListDelegate, NotebookDocumentMetadataDiffRenderer, NotebookTextDiffList } from "./notebookDiffList.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { diffDiagonalFill, editorBackground, focusBorder, foreground } from "../../../../../platform/theme/common/colorRegistry.js";
import { INotebookEditorWorkerService } from "../../common/services/notebookWorkerService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { BareFontInfo } from "../../../../../editor/common/config/fontInfo.js";
import { PixelRatio } from "../../../../../base/browser/pixelRatio.js";
import { DiffSide, DIFF_CELL_MARGIN } from "./notebookDiffEditorBrowser.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { EditorPane } from "../../../../browser/parts/editor/editorPane.js";
import { CellUri, NOTEBOOK_DIFF_EDITOR_ID, NotebookSetting } from "../../common/notebookCommon.js";
import { SequencerByKey } from "../../../../../base/common/async.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { BackLayerWebView } from "../view/renderers/backLayerWebView.js";
import { NotebookDiffEditorEventDispatcher, NotebookDiffLayoutChangedEvent } from "./eventDispatcher.js";
import { FontMeasurements } from "../../../../../editor/browser/config/fontMeasurements.js";
import { NotebookOptions } from "../notebookOptions.js";
import { cellIndexesToRanges, cellRangesToIndexes } from "../../common/notebookRange.js";
import { NotebookDiffOverviewRuler } from "./notebookDiffOverviewRuler.js";
import { registerZIndex, ZIndex } from "../../../../../platform/layout/browser/zIndexRegistry.js";
import { NotebookDiffViewModel } from "./notebookDiffViewModel.js";
import { INotebookService } from "../../common/notebookService.js";
import { DiffEditorHeightCalculatorService } from "./editorHeightCalculator.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { NotebookInlineDiffWidget } from "./inlineDiff/notebookInlineDiffWidget.js";
import { observableValue } from "../../../../../base/common/observable.js";
const $ = DOM.$;
class NotebookDiffEditorSelection {
  constructor(selections) {
    this.selections = selections;
  }
  compare(other) {
    if (!(other instanceof NotebookDiffEditorSelection)) {
      return EditorPaneSelectionCompareResult.DIFFERENT;
    }
    if (this.selections.length !== other.selections.length) {
      return EditorPaneSelectionCompareResult.DIFFERENT;
    }
    for (let i = 0; i < this.selections.length; i++) {
      if (this.selections[i] !== other.selections[i]) {
        return EditorPaneSelectionCompareResult.DIFFERENT;
      }
    }
    return EditorPaneSelectionCompareResult.IDENTICAL;
  }
  restore(options) {
    const notebookOptions = {
      cellSelections: cellIndexesToRanges(this.selections)
    };
    Object.assign(notebookOptions, options);
    return notebookOptions;
  }
}
let NotebookTextDiffEditor = class extends EditorPane {
  constructor(group, instantiationService, themeService, contextKeyService, notebookEditorWorkerService, configurationService, telemetryService, storageService, notebookService, editorService) {
    super(NotebookTextDiffEditor.ID, group, telemetryService, themeService, storageService);
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.notebookEditorWorkerService = notebookEditorWorkerService;
    this.configurationService = configurationService;
    this.notebookService = notebookService;
    this.editorService = editorService;
    this.creationOptions = getDefaultNotebookCreationOptions();
    this._dimension = void 0;
    this._modifiedWebview = null;
    this._originalWebview = null;
    this._webviewTransparentCover = null;
    this._inlineView = false;
    this._onMouseUp = this._register(new Emitter());
    this.onMouseUp = this._onMouseUp.event;
    this._onDidScroll = this._register(new Emitter());
    this.onDidScroll = this._onDidScroll.event;
    this.onDidChangeScroll = this._onDidScroll.event;
    this._model = null;
    this._modifiedResourceDisposableStore = this._register(new DisposableStore());
    this._insetModifyQueueByOutputId = new SequencerByKey();
    this._onDidDynamicOutputRendered = this._register(new Emitter());
    this.onDidDynamicOutputRendered = this._onDidDynamicOutputRendered.event;
    this._localStore = this._register(new DisposableStore());
    this._onDidChangeSelection = this._register(new Emitter());
    this.onDidChangeSelection = this._onDidChangeSelection.event;
    this._isDisposed = false;
    this._currentChangedIndex = observableValue(this, -1);
    this.currentChangedIndex = this._currentChangedIndex;
    this.pendingLayouts = /* @__PURE__ */ new WeakMap();
    this.diffEditorCalcuator = this.instantiationService.createInstance(DiffEditorHeightCalculatorService, this.fontInfo.lineHeight);
    this._notebookOptions = instantiationService.createInstance(NotebookOptions, this.window, false, void 0);
    this._register(this._notebookOptions);
    this._revealFirst = true;
  }
  get textModel() {
    return this._model?.modified.notebook;
  }
  get inlineNotebookEditor() {
    if (this._inlineView) {
      return this.inlineDiffWidget?.editorWidget;
    }
    return void 0;
  }
  get notebookOptions() {
    return this._notebookOptions;
  }
  get isDisposed() {
    return this._isDisposed;
  }
  get fontInfo() {
    if (!this._fontInfo) {
      this._fontInfo = this.createFontInfo();
    }
    return this._fontInfo;
  }
  createFontInfo() {
    const editorOptions = this.configurationService.getValue("editor");
    return FontMeasurements.readFontInfo(this.window, BareFontInfo.createFromRawSettings(editorOptions, PixelRatio.getInstance(this.window).value));
  }
  isOverviewRulerEnabled() {
    return this.configurationService.getValue(NotebookSetting.diffOverviewRuler) ?? false;
  }
  getSelection() {
    const selections = this._list.getFocus();
    return new NotebookDiffEditorSelection(selections);
  }
  toggleNotebookCellSelection(cell) {
  }
  updatePerformanceMetadata(cellId, executionId, duration, rendererId) {
  }
  async focusNotebookCell(cell, focus) {
  }
  async focusNextNotebookCell(cell, focus) {
  }
  didFocusOutputInputChange(inputFocused) {
  }
  getScrollTop() {
    return this._list?.scrollTop ?? 0;
  }
  getScrollHeight() {
    return this._list?.scrollHeight ?? 0;
  }
  getScrollPosition() {
    return {
      scrollTop: this.getScrollTop(),
      scrollLeft: this._list?.scrollLeft ?? 0
    };
  }
  setScrollPosition(scrollPosition) {
    if (!this._list) {
      return;
    }
    this._list.scrollTop = scrollPosition.scrollTop;
    if (scrollPosition.scrollLeft !== void 0) {
      this._list.scrollLeft = scrollPosition.scrollLeft;
    }
  }
  delegateVerticalScrollbarPointerDown(browserEvent) {
    this._list?.delegateVerticalScrollbarPointerDown(browserEvent);
  }
  updateOutputHeight(cellInfo, output, outputHeight, isInit) {
    const diffElement = cellInfo.diffElement;
    const cell = this.getCellByInfo(cellInfo);
    const outputIndex = cell.outputsViewModels.indexOf(output);
    if (diffElement instanceof SideBySideDiffElementViewModel) {
      const info = CellUri.parse(cellInfo.cellUri);
      if (!info) {
        return;
      }
      diffElement.updateOutputHeight(info.notebook.toString() === this._model?.original.resource.toString() ? DiffSide.Original : DiffSide.Modified, outputIndex, outputHeight);
    } else {
      diffElement.updateOutputHeight(diffElement.type === "insert" ? DiffSide.Modified : DiffSide.Original, outputIndex, outputHeight);
    }
    if (isInit) {
      this._onDidDynamicOutputRendered.fire({ cell, output });
    }
  }
  setMarkupCellEditState(cellId, editState) {
  }
  didStartDragMarkupCell(cellId, event) {
  }
  didDragMarkupCell(cellId, event) {
  }
  didEndDragMarkupCell(cellId) {
  }
  didDropMarkupCell(cellId) {
  }
  didResizeOutput(cellId) {
  }
  async toggleInlineView() {
    this._layoutCancellationTokenSource?.dispose();
    this._inlineView = !this._inlineView;
    if (!this._lastLayoutProperties) {
      return;
    }
    if (this._inlineView) {
      this.layout(this._lastLayoutProperties?.dimension, this._lastLayoutProperties?.position);
      this.inlineDiffWidget?.show(this.input, this._model?.modified.notebook, this._model?.original.notebook, this._options);
    } else {
      this.layout(this._lastLayoutProperties?.dimension, this._lastLayoutProperties?.position);
      this.inlineDiffWidget?.hide();
    }
    this._layoutCancellationTokenSource = new CancellationTokenSource();
    this.updateLayout(this._layoutCancellationTokenSource.token);
  }
  createEditor(parent) {
    this._rootElement = DOM.append(parent, DOM.$(".notebook-text-diff-editor"));
    this._overflowContainer = document.createElement("div");
    this._overflowContainer.classList.add("notebook-overflow-widget-container", "monaco-editor");
    DOM.append(parent, this._overflowContainer);
    const renderers = [
      this.instantiationService.createInstance(CellDiffSingleSideRenderer, this),
      this.instantiationService.createInstance(CellDiffSideBySideRenderer, this),
      this.instantiationService.createInstance(CellDiffPlaceholderRenderer, this),
      this.instantiationService.createInstance(NotebookDocumentMetadataDiffRenderer, this)
    ];
    this._listViewContainer = DOM.append(this._rootElement, DOM.$(".notebook-diff-list-view"));
    this._list = this.instantiationService.createInstance(
      NotebookTextDiffList,
      "NotebookTextDiff",
      this._listViewContainer,
      this.instantiationService.createInstance(NotebookCellTextDiffListDelegate, this.window),
      renderers,
      this.contextKeyService,
      {
        setRowLineHeight: false,
        setRowHeight: false,
        supportDynamicHeights: true,
        horizontalScrolling: false,
        keyboardSupport: false,
        mouseSupport: true,
        multipleSelectionSupport: false,
        typeNavigationEnabled: true,
        paddingBottom: 0,
        // transformOptimization: (isMacintosh && isNative) || getTitleBarStyle(this.configurationService, this.environmentService) === 'native',
        styleController: (_suffix) => {
          return this._list;
        },
        overrideStyles: {
          listBackground: editorBackground,
          listActiveSelectionBackground: editorBackground,
          listActiveSelectionForeground: foreground,
          listFocusAndSelectionBackground: editorBackground,
          listFocusAndSelectionForeground: foreground,
          listFocusBackground: editorBackground,
          listFocusForeground: foreground,
          listHoverForeground: foreground,
          listHoverBackground: editorBackground,
          listHoverOutline: focusBorder,
          listFocusOutline: focusBorder,
          listInactiveSelectionBackground: editorBackground,
          listInactiveSelectionForeground: foreground,
          listInactiveFocusBackground: editorBackground,
          listInactiveFocusOutline: editorBackground
        },
        accessibilityProvider: {
          getAriaLabel() {
            return null;
          },
          getWidgetAriaLabel() {
            return nls.localize("notebookTreeAriaLabel", "Notebook Text Diff");
          }
        }
        // focusNextPreviousDelegate: {
        // 	onFocusNext: (applyFocusNext: () => void) => this._updateForCursorNavigationMode(applyFocusNext),
        // 	onFocusPrevious: (applyFocusPrevious: () => void) => this._updateForCursorNavigationMode(applyFocusPrevious),
        // }
      }
    );
    this.inlineDiffWidget = this._register(this.instantiationService.createInstance(NotebookInlineDiffWidget, this._rootElement, this.group.id, this.window, this.notebookOptions, this._dimension));
    this._register(this._list);
    this._register(this._list.onMouseUp((e) => {
      if (e.element) {
        if (typeof e.index === "number") {
          this._list.setFocus([e.index]);
        }
        this._onMouseUp.fire({ event: e.browserEvent, target: e.element });
      }
    }));
    this._register(this._list.onDidScroll(() => {
      this._onDidScroll.fire();
    }));
    this._register(this._list.onDidChangeFocus(() => this._onDidChangeSelection.fire({ reason: EditorPaneSelectionChangeReason.USER })));
    this._overviewRulerContainer = document.createElement("div");
    this._overviewRulerContainer.classList.add("notebook-overview-ruler-container");
    this._rootElement.appendChild(this._overviewRulerContainer);
    this._registerOverviewRuler();
    this._webviewTransparentCover = DOM.append(this._list.rowsContainer, $(".webview-cover"));
    this._webviewTransparentCover.style.display = "none";
    this._register(DOM.addStandardDisposableGenericMouseDownListener(this._overflowContainer, (e) => {
      if (e.target.classList.contains("slider") && this._webviewTransparentCover) {
        this._webviewTransparentCover.style.display = "block";
      }
    }));
    this._register(DOM.addStandardDisposableGenericMouseUpListener(this._overflowContainer, () => {
      if (this._webviewTransparentCover) {
        this._webviewTransparentCover.style.display = "none";
      }
    }));
    this._register(this._list.onDidScroll((e) => {
      this._webviewTransparentCover.style.top = `${e.scrollTop}px`;
    }));
  }
  _registerOverviewRuler() {
    this._overviewRuler = this._register(this.instantiationService.createInstance(NotebookDiffOverviewRuler, this, NotebookTextDiffEditor.ENTIRE_DIFF_OVERVIEW_WIDTH, this._overviewRulerContainer));
  }
  _updateOutputsOffsetsInWebview(scrollTop, scrollHeight, activeWebview, getActiveNestedCell, diffSide) {
    activeWebview.element.style.height = `${scrollHeight}px`;
    if (activeWebview.insetMapping) {
      const updateItems = [];
      const removedItems = [];
      activeWebview.insetMapping.forEach((value, key) => {
        const cell = getActiveNestedCell(value.cellInfo.diffElement);
        if (!cell) {
          return;
        }
        const viewIndex = this._list.indexOf(value.cellInfo.diffElement);
        if (viewIndex === void 0) {
          return;
        }
        if (cell.outputsViewModels.indexOf(key) < 0) {
          removedItems.push(key);
        } else {
          const cellTop = this._list.getCellViewScrollTop(value.cellInfo.diffElement);
          const outputIndex = cell.outputsViewModels.indexOf(key);
          const outputOffset = value.cellInfo.diffElement.getOutputOffsetInCell(diffSide, outputIndex);
          updateItems.push({
            cell,
            output: key,
            cellTop,
            outputOffset,
            forceDisplay: false
          });
        }
      });
      activeWebview.removeInsets(removedItems);
      if (updateItems.length) {
        activeWebview.updateScrollTops(updateItems, []);
      }
    }
  }
  async setInput(input, options, context, token) {
    this.inlineDiffWidget?.hide();
    await super.setInput(input, options, context, token);
    const model = await input.resolve();
    if (this._model !== model) {
      this._detachModel();
      this._attachModel(model);
    }
    this._model = model;
    if (this._model === null) {
      return;
    }
    if (this._inlineView) {
      this._listViewContainer.style.display = "none";
      this.inlineDiffWidget?.show(input, model.modified.notebook, model.original.notebook, options);
    } else {
      this._listViewContainer.style.display = "block";
      this.inlineDiffWidget?.hide();
    }
    this._revealFirst = true;
    this._modifiedResourceDisposableStore.clear();
    this._layoutCancellationTokenSource = new CancellationTokenSource();
    this._modifiedResourceDisposableStore.add(Event.any(this._model.original.notebook.onDidChangeContent, this._model.modified.notebook.onDidChangeContent)((e) => {
      if (this._model !== null && this.editorService.activeEditor !== input) {
        this._layoutCancellationTokenSource?.dispose();
        this._layoutCancellationTokenSource = new CancellationTokenSource();
        this.updateLayout(this._layoutCancellationTokenSource.token);
      }
    }));
    await this._createOriginalWebview(generateUuid(), this._model.original.viewType, this._model.original.resource);
    if (this._originalWebview) {
      this._modifiedResourceDisposableStore.add(this._originalWebview);
    }
    await this._createModifiedWebview(generateUuid(), this._model.modified.viewType, this._model.modified.resource);
    if (this._modifiedWebview) {
      this._modifiedResourceDisposableStore.add(this._modifiedWebview);
    }
    await this.updateLayout(this._layoutCancellationTokenSource.token, options?.cellSelections ? cellRangesToIndexes(options.cellSelections) : void 0);
  }
  setVisible(visible) {
    super.setVisible(visible);
    if (!visible) {
      this.inlineDiffWidget?.hide();
    }
  }
  _detachModel() {
    this._localStore.clear();
    this._originalWebview?.dispose();
    this._originalWebview?.element.remove();
    this._originalWebview = null;
    this._modifiedWebview?.dispose();
    this._modifiedWebview?.element.remove();
    this._modifiedWebview = null;
    this.notebookDiffViewModel?.dispose();
    this.notebookDiffViewModel = void 0;
    this._modifiedResourceDisposableStore.clear();
    this._list.clear();
  }
  _attachModel(model) {
    this._model = model;
    this._eventDispatcher = new NotebookDiffEditorEventDispatcher();
    const updateInsets = () => {
      DOM.scheduleAtNextAnimationFrame(this.window, () => {
        if (this._isDisposed) {
          return;
        }
        if (this._modifiedWebview) {
          this._updateOutputsOffsetsInWebview(this._list.scrollTop, this._list.scrollHeight, this._modifiedWebview, (diffElement) => {
            return diffElement.modified;
          }, DiffSide.Modified);
        }
        if (this._originalWebview) {
          this._updateOutputsOffsetsInWebview(this._list.scrollTop, this._list.scrollHeight, this._originalWebview, (diffElement) => {
            return diffElement.original;
          }, DiffSide.Original);
        }
      });
    };
    this._localStore.add(this._list.onDidChangeContentHeight(() => {
      updateInsets();
    }));
    this._localStore.add(this._list.onDidChangeFocus((e) => {
      if (e.indexes.length && this.notebookDiffViewModel && e.indexes[0] < this.notebookDiffViewModel.items.length) {
        const selectedItem = this.notebookDiffViewModel.items[e.indexes[0]];
        const changedItems = this.notebookDiffViewModel.items.filter((item) => item.type !== "unchanged" && item.type !== "unchangedMetadata" && item.type !== "placeholder");
        if (selectedItem && selectedItem?.type !== "placeholder" && selectedItem?.type !== "unchanged" && selectedItem?.type !== "unchangedMetadata") {
          return this._currentChangedIndex.set(changedItems.indexOf(selectedItem), void 0);
        }
      }
      return this._currentChangedIndex.set(-1, void 0);
    }));
    this._localStore.add(this._eventDispatcher.onDidChangeCellLayout(() => {
      updateInsets();
    }));
    const vm = this.notebookDiffViewModel = this._register(new NotebookDiffViewModel(this._model, this.notebookEditorWorkerService, this.configurationService, this._eventDispatcher, this.notebookService, this.diffEditorCalcuator, this.fontInfo, void 0));
    this._localStore.add(this.notebookDiffViewModel.onDidChangeItems((e) => {
      this._originalWebview?.removeInsets([...this._originalWebview?.insetMapping.keys()]);
      this._modifiedWebview?.removeInsets([...this._modifiedWebview?.insetMapping.keys()]);
      if (this._revealFirst && typeof e.firstChangeIndex === "number" && e.firstChangeIndex > -1 && e.firstChangeIndex < this._list.length) {
        this._revealFirst = false;
        this._list.setFocus([e.firstChangeIndex]);
        this._list.reveal(e.firstChangeIndex, 0.3);
      }
      this._list.splice(e.start, e.deleteCount, e.elements);
      if (this.isOverviewRulerEnabled()) {
        this._overviewRuler.updateViewModels(vm.items, this._eventDispatcher);
      }
    }));
  }
  async _createModifiedWebview(id, viewType, resource) {
    this._modifiedWebview?.dispose();
    this._modifiedWebview = this.instantiationService.createInstance(BackLayerWebView, this, id, viewType, resource, {
      ...this._notebookOptions.computeDiffWebviewOptions(),
      fontFamily: this._generateFontFamily()
    }, void 0);
    this._list.rowsContainer.insertAdjacentElement("afterbegin", this._modifiedWebview.element);
    this._modifiedWebview.createWebview(this.window);
    this._modifiedWebview.element.style.width = `calc(50% - 16px)`;
    this._modifiedWebview.element.style.left = `calc(50%)`;
  }
  _generateFontFamily() {
    return this.fontInfo.fontFamily ?? `"SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace`;
  }
  async _createOriginalWebview(id, viewType, resource) {
    this._originalWebview?.dispose();
    this._originalWebview = this.instantiationService.createInstance(BackLayerWebView, this, id, viewType, resource, {
      ...this._notebookOptions.computeDiffWebviewOptions(),
      fontFamily: this._generateFontFamily()
    }, void 0);
    this._list.rowsContainer.insertAdjacentElement("afterbegin", this._originalWebview.element);
    this._originalWebview.createWebview(this.window);
    this._originalWebview.element.style.width = `calc(50% - 16px)`;
    this._originalWebview.element.style.left = `16px`;
  }
  setOptions(options) {
    const selections = options?.cellSelections ? cellRangesToIndexes(options.cellSelections) : void 0;
    if (selections) {
      this._list.setFocus(selections);
    }
  }
  async updateLayout(token, selections) {
    if (!this._model || !this.notebookDiffViewModel) {
      return;
    }
    await this.notebookDiffViewModel.computeDiff(token);
    if (token.isCancellationRequested) {
      return;
    }
    if (selections) {
      this._list.setFocus(selections);
    }
  }
  scheduleOutputHeightAck(cellInfo, outputId, height) {
    const diffElement = cellInfo.diffElement;
    let diffSide = DiffSide.Original;
    if (diffElement instanceof SideBySideDiffElementViewModel) {
      const info = CellUri.parse(cellInfo.cellUri);
      if (!info) {
        return;
      }
      diffSide = info.notebook.toString() === this._model?.original.resource.toString() ? DiffSide.Original : DiffSide.Modified;
    } else {
      diffSide = diffElement.type === "insert" ? DiffSide.Modified : DiffSide.Original;
    }
    const webview = diffSide === DiffSide.Modified ? this._modifiedWebview : this._originalWebview;
    DOM.scheduleAtNextAnimationFrame(this.window, () => {
      webview?.ackHeight([{ cellId: cellInfo.cellId, outputId, height }]);
    }, 10);
  }
  layoutNotebookCell(cell, height) {
    const relayout = (cell2, height2) => {
      this._list.updateElementHeight2(cell2, height2);
    };
    let disposable = this.pendingLayouts.get(cell);
    if (disposable) {
      this._localStore.delete(disposable);
    }
    let r;
    const layoutDisposable = DOM.scheduleAtNextAnimationFrame(this.window, () => {
      this.pendingLayouts.delete(cell);
      relayout(cell, height);
      r();
    });
    disposable = toDisposable(() => {
      layoutDisposable.dispose();
      r();
    });
    this._localStore.add(disposable);
    this.pendingLayouts.set(cell, disposable);
    return new Promise((resolve) => {
      r = resolve;
    });
  }
  setScrollTop(scrollTop) {
    this._list.scrollTop = scrollTop;
  }
  triggerScroll(event) {
    this._list.triggerScrollFromMouseWheelEvent(event);
  }
  firstChange() {
    if (!this.notebookDiffViewModel) {
      return;
    }
    const currentViewModels = this.notebookDiffViewModel.items;
    const index = currentViewModels.findIndex((vm) => vm.type !== "unchanged" && vm.type !== "unchangedMetadata" && vm.type !== "placeholder");
    if (index >= 0) {
      this._list.setFocus([index]);
      this._list.reveal(index);
    }
  }
  lastChange() {
    if (!this.notebookDiffViewModel) {
      return;
    }
    const currentViewModels = this.notebookDiffViewModel.items;
    const item = currentViewModels.slice().reverse().find((vm) => vm.type !== "unchanged" && vm.type !== "unchangedMetadata" && vm.type !== "placeholder");
    const index = item ? currentViewModels.indexOf(item) : -1;
    if (index >= 0) {
      this._list.setFocus([index]);
      this._list.reveal(index);
    }
  }
  previousChange() {
    if (!this.notebookDiffViewModel) {
      return;
    }
    let currFocus = this._list.getFocus()[0];
    if (isNaN(currFocus) || currFocus < 0) {
      currFocus = 0;
    }
    let prevChangeIndex = currFocus - 1;
    const currentViewModels = this.notebookDiffViewModel.items;
    while (prevChangeIndex >= 0) {
      const vm = currentViewModels[prevChangeIndex];
      if (vm.type !== "unchanged" && vm.type !== "unchangedMetadata" && vm.type !== "placeholder") {
        break;
      }
      prevChangeIndex--;
    }
    if (prevChangeIndex >= 0) {
      this._list.setFocus([prevChangeIndex]);
      this._list.reveal(prevChangeIndex);
    } else {
      const index = findLastIdx(currentViewModels, (vm) => vm.type !== "unchanged" && vm.type !== "unchangedMetadata" && vm.type !== "placeholder");
      if (index >= 0) {
        this._list.setFocus([index]);
        this._list.reveal(index);
      }
    }
  }
  nextChange() {
    if (!this.notebookDiffViewModel) {
      return;
    }
    let currFocus = this._list.getFocus()[0];
    if (isNaN(currFocus) || currFocus < 0) {
      currFocus = 0;
    }
    let nextChangeIndex = currFocus + 1;
    const currentViewModels = this.notebookDiffViewModel.items;
    while (nextChangeIndex < currentViewModels.length) {
      const vm = currentViewModels[nextChangeIndex];
      if (vm.type !== "unchanged" && vm.type !== "unchangedMetadata" && vm.type !== "placeholder") {
        break;
      }
      nextChangeIndex++;
    }
    if (nextChangeIndex < currentViewModels.length) {
      this._list.setFocus([nextChangeIndex]);
      this._list.reveal(nextChangeIndex);
    } else {
      const index = currentViewModels.findIndex((vm) => vm.type !== "unchanged" && vm.type !== "unchangedMetadata" && vm.type !== "placeholder");
      if (index >= 0) {
        this._list.setFocus([index]);
        this._list.reveal(index);
      }
    }
  }
  createOutput(cellDiffViewModel, cellViewModel, output, getOffset, diffSide) {
    this._insetModifyQueueByOutputId.queue(output.source.model.outputId + (diffSide === DiffSide.Modified ? "-right" : "left"), async () => {
      const activeWebview = diffSide === DiffSide.Modified ? this._modifiedWebview : this._originalWebview;
      if (!activeWebview) {
        return;
      }
      if (!activeWebview.insetMapping.has(output.source)) {
        const cellTop = this._list.getCellViewScrollTop(cellDiffViewModel);
        await activeWebview.createOutput({ diffElement: cellDiffViewModel, cellHandle: cellViewModel.handle, cellId: cellViewModel.id, cellUri: cellViewModel.uri }, output, cellTop, getOffset());
      } else {
        const cellTop = this._list.getCellViewScrollTop(cellDiffViewModel);
        const outputIndex = cellViewModel.outputsViewModels.indexOf(output.source);
        const outputOffset = cellDiffViewModel.getOutputOffsetInCell(diffSide, outputIndex);
        activeWebview.updateScrollTops([{
          cell: cellViewModel,
          output: output.source,
          cellTop,
          outputOffset,
          forceDisplay: true
        }], []);
      }
    });
  }
  updateMarkupCellHeight() {
  }
  getCellByInfo(cellInfo) {
    return cellInfo.diffElement.getCellByUri(cellInfo.cellUri);
  }
  getCellById(cellId) {
    throw new Error("Not implemented");
  }
  removeInset(cellDiffViewModel, cellViewModel, displayOutput, diffSide) {
    this._insetModifyQueueByOutputId.queue(displayOutput.model.outputId + (diffSide === DiffSide.Modified ? "-right" : "left"), async () => {
      const activeWebview = diffSide === DiffSide.Modified ? this._modifiedWebview : this._originalWebview;
      if (!activeWebview) {
        return;
      }
      if (!activeWebview.insetMapping.has(displayOutput)) {
        return;
      }
      activeWebview.removeInsets([displayOutput]);
    });
  }
  showInset(cellDiffViewModel, cellViewModel, displayOutput, diffSide) {
    this._insetModifyQueueByOutputId.queue(displayOutput.model.outputId + (diffSide === DiffSide.Modified ? "-right" : "left"), async () => {
      const activeWebview = diffSide === DiffSide.Modified ? this._modifiedWebview : this._originalWebview;
      if (!activeWebview) {
        return;
      }
      if (!activeWebview.insetMapping.has(displayOutput)) {
        return;
      }
      const cellTop = this._list.getCellViewScrollTop(cellDiffViewModel);
      const outputIndex = cellViewModel.outputsViewModels.indexOf(displayOutput);
      const outputOffset = cellDiffViewModel.getOutputOffsetInCell(diffSide, outputIndex);
      activeWebview.updateScrollTops([{
        cell: cellViewModel,
        output: displayOutput,
        cellTop,
        outputOffset,
        forceDisplay: true
      }], []);
    });
  }
  hideInset(cellDiffViewModel, cellViewModel, output) {
    this._modifiedWebview?.hideInset(output);
    this._originalWebview?.hideInset(output);
  }
  // private async _resolveWebview(rightEditor: boolean): Promise<BackLayerWebView | null> {
  // 	if (rightEditor) {
  // 	}
  // }
  getDomNode() {
    return this._rootElement;
  }
  getOverflowContainerDomNode() {
    return this._overflowContainer;
  }
  getControl() {
    return this;
  }
  clearInput() {
    this.inlineDiffWidget?.hide();
    super.clearInput();
    this._modifiedResourceDisposableStore.clear();
    this._list?.splice(0, this._list?.length || 0);
    this._model = null;
    this.notebookDiffViewModel?.dispose();
    this.notebookDiffViewModel = void 0;
  }
  deltaCellOutputContainerClassNames(diffSide, cellId, added, removed) {
    if (diffSide === DiffSide.Original) {
      this._originalWebview?.deltaCellOutputContainerClassNames(cellId, added, removed);
    } else {
      this._modifiedWebview?.deltaCellOutputContainerClassNames(cellId, added, removed);
    }
  }
  getLayoutInfo() {
    if (!this._list) {
      throw new Error("Editor is not initalized successfully");
    }
    return {
      width: this._dimension.width,
      height: this._dimension.height,
      fontInfo: this.fontInfo,
      scrollHeight: this._list?.getScrollHeight() ?? 0,
      stickyHeight: 0
    };
  }
  layout(dimension, position) {
    this._rootElement.classList.toggle("mid-width", dimension.width < 1e3 && dimension.width >= 600);
    this._rootElement.classList.toggle("narrow-width", dimension.width < 600);
    const overviewRulerEnabled = this.isOverviewRulerEnabled();
    this._dimension = dimension.with(dimension.width - (overviewRulerEnabled ? NotebookTextDiffEditor.ENTIRE_DIFF_OVERVIEW_WIDTH : 0));
    this._listViewContainer.style.height = `${dimension.height}px`;
    this._listViewContainer.style.width = `${this._dimension.width}px`;
    if (this._inlineView) {
      this._listViewContainer.style.display = "none";
      this.inlineDiffWidget?.setLayout(dimension, position);
    } else {
      this.inlineDiffWidget?.hide();
      this._listViewContainer.style.display = "block";
      this._list?.layout(this._dimension.height, this._dimension.width);
      if (this._modifiedWebview) {
        this._modifiedWebview.element.style.width = `calc(50% - 16px)`;
        this._modifiedWebview.element.style.left = `calc(50%)`;
      }
      if (this._originalWebview) {
        this._originalWebview.element.style.width = `calc(50% - 16px)`;
        this._originalWebview.element.style.left = `16px`;
      }
      if (this._webviewTransparentCover) {
        this._webviewTransparentCover.style.height = `${this._dimension.height}px`;
        this._webviewTransparentCover.style.width = `${this._dimension.width}px`;
      }
      if (overviewRulerEnabled) {
        this._overviewRuler.layout();
      }
    }
    this._lastLayoutProperties = { dimension, position };
    this._eventDispatcher?.emit([new NotebookDiffLayoutChangedEvent({ width: true, fontInfo: true }, this.getLayoutInfo())]);
  }
  dispose() {
    this._isDisposed = true;
    this._layoutCancellationTokenSource?.dispose();
    this._detachModel();
    super.dispose();
  }
};
NotebookTextDiffEditor.ENTIRE_DIFF_OVERVIEW_WIDTH = 30;
NotebookTextDiffEditor.ID = NOTEBOOK_DIFF_EDITOR_ID;
NotebookTextDiffEditor = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, INotebookEditorWorkerService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, ITelemetryService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, INotebookService),
  __decorateParam(9, IEditorService)
], NotebookTextDiffEditor);
registerZIndex(ZIndex.Base, 10, "notebook-diff-view-viewport-slider");
registerThemingParticipant((theme, collector) => {
  const diffDiagonalFillColor = theme.getColor(diffDiagonalFill);
  collector.addRule(`
	.notebook-text-diff-editor .diagonal-fill {
		background-image: linear-gradient(
			-45deg,
			${diffDiagonalFillColor} 12.5%,
			#0000 12.5%, #0000 50%,
			${diffDiagonalFillColor} 50%, ${diffDiagonalFillColor} 62.5%,
			#0000 62.5%, #0000 100%
		);
		background-size: 8px 8px;
	}
	`);
  collector.addRule(`.notebook-text-diff-editor .cell-body { margin: ${DIFF_CELL_MARGIN}px; }`);
  collector.addRule(`.notebook-text-diff-editor .cell-placeholder-body { margin: ${DIFF_CELL_MARGIN}px 0; }`);
});
export {
  NotebookTextDiffEditor
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2RpZmYvbm90ZWJvb2tEaWZmRWRpdG9yLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgKiBhcyBET00gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBmaW5kTGFzdElkeCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5c0ZpbmQuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UsIHJlZ2lzdGVyVGhlbWluZ1BhcnRpY2lwYW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JQYW5lU2VsZWN0aW9uQ2hhbmdlUmVhc29uLCBFZGl0b3JQYW5lU2VsZWN0aW9uQ29tcGFyZVJlc3VsdCwgSUVkaXRvck9wZW5Db250ZXh0LCBJRWRpdG9yUGFuZVNjcm9sbFBvc2l0aW9uLCBJRWRpdG9yUGFuZVNlbGVjdGlvbiwgSUVkaXRvclBhbmVTZWxlY3Rpb25DaGFuZ2VFdmVudCwgSUVkaXRvclBhbmVXaXRoU2Nyb2xsaW5nLCBJRWRpdG9yUGFuZVdpdGhTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IGdldERlZmF1bHROb3RlYm9va0NyZWF0aW9uT3B0aW9ucyB9IGZyb20gJy4uL25vdGVib29rRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cCB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0RpZmZFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0RpZmZFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRGlmZkVsZW1lbnRDZWxsVmlld01vZGVsQmFzZSwgSURpZmZFbGVtZW50Vmlld01vZGVsQmFzZSwgU2lkZUJ5U2lkZURpZmZFbGVtZW50Vmlld01vZGVsIH0gZnJvbSAnLi9kaWZmRWxlbWVudFZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IENlbGxEaWZmUGxhY2Vob2xkZXJSZW5kZXJlciwgQ2VsbERpZmZTaWRlQnlTaWRlUmVuZGVyZXIsIENlbGxEaWZmU2luZ2xlU2lkZVJlbmRlcmVyLCBOb3RlYm9va0NlbGxUZXh0RGlmZkxpc3REZWxlZ2F0ZSwgTm90ZWJvb2tEb2N1bWVudE1ldGFkYXRhRGlmZlJlbmRlcmVyLCBOb3RlYm9va1RleHREaWZmTGlzdCB9IGZyb20gJy4vbm90ZWJvb2tEaWZmTGlzdC5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IGRpZmZEaWFnb25hbEZpbGwsIGVkaXRvckJhY2tncm91bmQsIGZvY3VzQm9yZGVyLCBmb3JlZ3JvdW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRWRpdG9yV29ya2VyU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9ub3RlYm9va1dvcmtlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yT3B0aW9ucyBhcyBJQ29kZUVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IEJhcmVGb250SW5mbywgRm9udEluZm8gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9mb250SW5mby5qcyc7XG5pbXBvcnQgeyBQaXhlbFJhdGlvIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3BpeGVsUmF0aW8uanMnO1xuaW1wb3J0IHsgQ2VsbEVkaXRTdGF0ZSwgSUNlbGxPdXRwdXRWaWV3TW9kZWwsIElEaXNwbGF5T3V0cHV0TGF5b3V0VXBkYXRlUmVxdWVzdCwgSUdlbmVyaWNDZWxsVmlld01vZGVsLCBJSW5zZXRSZW5kZXJPdXRwdXQsIElOb3RlYm9va0VkaXRvckNyZWF0aW9uT3B0aW9ucywgSU5vdGVib29rRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBEaWZmU2lkZSwgRElGRl9DRUxMX01BUkdJTiwgSURpZmZDZWxsSW5mbywgSU5vdGVib29rVGV4dERpZmZFZGl0b3IsIElOb3RlYm9va0RpZmZWaWV3TW9kZWwgfSBmcm9tICcuL25vdGVib29rRGlmZkVkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgRWRpdG9yUGFuZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvclBhbmUuanMnO1xuaW1wb3J0IHsgQ2VsbFVyaSwgSU5vdGVib29rRGlmZkVkaXRvck1vZGVsLCBOT1RFQk9PS19ESUZGX0VESVRPUl9JRCwgTm90ZWJvb2tTZXR0aW5nIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBTZXF1ZW5jZXJCeUtleSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgSU1vdXNlV2hlZWxFdmVudCwgU3RhbmRhcmRNb3VzZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL21vdXNlRXZlbnQuanMnO1xuaW1wb3J0IHsgRGlmZk5lc3RlZENlbGxWaWV3TW9kZWwgfSBmcm9tICcuL2RpZmZOZXN0ZWRDZWxsVmlld01vZGVsLmpzJztcbmltcG9ydCB7IEJhY2tMYXllcldlYlZpZXcsIElOb3RlYm9va0RlbGVnYXRlRm9yV2VidmlldyB9IGZyb20gJy4uL3ZpZXcvcmVuZGVyZXJzL2JhY2tMYXllcldlYlZpZXcuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tEaWZmRWRpdG9yRXZlbnREaXNwYXRjaGVyLCBOb3RlYm9va0RpZmZMYXlvdXRDaGFuZ2VkRXZlbnQgfSBmcm9tICcuL2V2ZW50RGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgeyBGb250TWVhc3VyZW1lbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvY29uZmlnL2ZvbnRNZWFzdXJlbWVudHMuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tPcHRpb25zIH0gZnJvbSAnLi4vbm90ZWJvb2tPcHRpb25zLmpzJztcbmltcG9ydCB7IE5vdGVib29rTGF5b3V0SW5mbyB9IGZyb20gJy4uL25vdGVib29rVmlld0V2ZW50cy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IGNlbGxJbmRleGVzVG9SYW5nZXMsIGNlbGxSYW5nZXNUb0luZGV4ZXMgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tSYW5nZS5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0RpZmZPdmVydmlld1J1bGVyIH0gZnJvbSAnLi9ub3RlYm9va0RpZmZPdmVydmlld1J1bGVyLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyWkluZGV4LCBaSW5kZXggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYXlvdXQvYnJvd3Nlci96SW5kZXhSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0RpZmZWaWV3TW9kZWwgfSBmcm9tICcuL25vdGVib29rRGlmZlZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rU2VydmljZS5qcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9ySGVpZ2h0Q2FsY3VsYXRvclNlcnZpY2UsIElEaWZmRWRpdG9ySGVpZ2h0Q2FsY3VsYXRvclNlcnZpY2UgfSBmcm9tICcuL2VkaXRvckhlaWdodENhbGN1bGF0b3IuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tJbmxpbmVEaWZmV2lkZ2V0IH0gZnJvbSAnLi9pbmxpbmVEaWZmL25vdGVib29rSW5saW5lRGlmZldpZGdldC5qcyc7XG5pbXBvcnQgeyBJT2JzZXJ2YWJsZSwgb2JzZXJ2YWJsZVZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5cbmNvbnN0ICQgPSBET00uJDtcblxuY2xhc3MgTm90ZWJvb2tEaWZmRWRpdG9yU2VsZWN0aW9uIGltcGxlbWVudHMgSUVkaXRvclBhbmVTZWxlY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgc2VsZWN0aW9uczogbnVtYmVyW11cblx0KSB7IH1cblxuXHRjb21wYXJlKG90aGVyOiBJRWRpdG9yUGFuZVNlbGVjdGlvbik6IEVkaXRvclBhbmVTZWxlY3Rpb25Db21wYXJlUmVzdWx0IHtcblx0XHRpZiAoIShvdGhlciBpbnN0YW5jZW9mIE5vdGVib29rRGlmZkVkaXRvclNlbGVjdGlvbikpIHtcblx0XHRcdHJldHVybiBFZGl0b3JQYW5lU2VsZWN0aW9uQ29tcGFyZVJlc3VsdC5ESUZGRVJFTlQ7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc2VsZWN0aW9ucy5sZW5ndGggIT09IG90aGVyLnNlbGVjdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gRWRpdG9yUGFuZVNlbGVjdGlvbkNvbXBhcmVSZXN1bHQuRElGRkVSRU5UO1xuXHRcdH1cblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zZWxlY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRpZiAodGhpcy5zZWxlY3Rpb25zW2ldICE9PSBvdGhlci5zZWxlY3Rpb25zW2ldKSB7XG5cdFx0XHRcdHJldHVybiBFZGl0b3JQYW5lU2VsZWN0aW9uQ29tcGFyZVJlc3VsdC5ESUZGRVJFTlQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIEVkaXRvclBhbmVTZWxlY3Rpb25Db21wYXJlUmVzdWx0LklERU5USUNBTDtcblx0fVxuXG5cdHJlc3RvcmUob3B0aW9uczogSUVkaXRvck9wdGlvbnMpOiBJTm90ZWJvb2tFZGl0b3JPcHRpb25zIHtcblx0XHRjb25zdCBub3RlYm9va09wdGlvbnM6IElOb3RlYm9va0VkaXRvck9wdGlvbnMgPSB7XG5cdFx0XHRjZWxsU2VsZWN0aW9uczogY2VsbEluZGV4ZXNUb1Jhbmdlcyh0aGlzLnNlbGVjdGlvbnMpXG5cdFx0fTtcblxuXHRcdE9iamVjdC5hc3NpZ24obm90ZWJvb2tPcHRpb25zLCBvcHRpb25zKTtcblx0XHRyZXR1cm4gbm90ZWJvb2tPcHRpb25zO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBOb3RlYm9va1RleHREaWZmRWRpdG9yIGV4dGVuZHMgRWRpdG9yUGFuZSBpbXBsZW1lbnRzIElOb3RlYm9va1RleHREaWZmRWRpdG9yLCBJTm90ZWJvb2tEZWxlZ2F0ZUZvcldlYnZpZXcsIElFZGl0b3JQYW5lV2l0aFNlbGVjdGlvbiwgSUVkaXRvclBhbmVXaXRoU2Nyb2xsaW5nIHtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBFTlRJUkVfRElGRl9PVkVSVklFV19XSURUSCA9IDMwO1xuXHRjcmVhdGlvbk9wdGlvbnM6IElOb3RlYm9va0VkaXRvckNyZWF0aW9uT3B0aW9ucyA9IGdldERlZmF1bHROb3RlYm9va0NyZWF0aW9uT3B0aW9ucygpO1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQ6IHN0cmluZyA9IE5PVEVCT09LX0RJRkZfRURJVE9SX0lEO1xuXG5cdHByaXZhdGUgX3Jvb3RFbGVtZW50ITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgX2xpc3RWaWV3Q29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgX292ZXJmbG93Q29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgX292ZXJ2aWV3UnVsZXJDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBfb3ZlcnZpZXdSdWxlciE6IE5vdGVib29rRGlmZk92ZXJ2aWV3UnVsZXI7XG5cdHByaXZhdGUgX2RpbWVuc2lvbjogRE9NLkRpbWVuc2lvbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBub3RlYm9va0RpZmZWaWV3TW9kZWw/OiBJTm90ZWJvb2tEaWZmVmlld01vZGVsO1xuXHRwcml2YXRlIF9saXN0ITogTm90ZWJvb2tUZXh0RGlmZkxpc3Q7XG5cdHByaXZhdGUgX21vZGlmaWVkV2VidmlldzogQmFja0xheWVyV2ViVmlldzxJRGlmZkNlbGxJbmZvPiB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIF9vcmlnaW5hbFdlYnZpZXc6IEJhY2tMYXllcldlYlZpZXc8SURpZmZDZWxsSW5mbz4gfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBfd2Vidmlld1RyYW5zcGFyZW50Q292ZXI6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgX2ZvbnRJbmZvOiBGb250SW5mbyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfaW5saW5lVmlldyA9IGZhbHNlO1xuXHRwcml2YXRlIF9sYXN0TGF5b3V0UHJvcGVydGllczogeyBkaW1lbnNpb246IERPTS5EaW1lbnNpb247IHBvc2l0aW9uOiBET00uSURvbVBvc2l0aW9uIH0gfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25Nb3VzZVVwID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyByZWFkb25seSBldmVudDogTW91c2VFdmVudDsgcmVhZG9ubHkgdGFyZ2V0OiBJRGlmZkVsZW1lbnRWaWV3TW9kZWxCYXNlIH0+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25Nb3VzZVVwID0gdGhpcy5fb25Nb3VzZVVwLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFNjcm9sbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZFNjcm9sbDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZFNjcm9sbC5ldmVudDtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VTY3JvbGw6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRTY3JvbGwuZXZlbnQ7XG5cdHByaXZhdGUgX2V2ZW50RGlzcGF0Y2hlcjogTm90ZWJvb2tEaWZmRWRpdG9yRXZlbnREaXNwYXRjaGVyIHwgdW5kZWZpbmVkO1xuXHRwcm90ZWN0ZWQgX3Njb3BlQ29udGV4dEtleVNlcnZpY2UhOiBJQ29udGV4dEtleVNlcnZpY2U7XG5cdHByaXZhdGUgX21vZGVsOiBJTm90ZWJvb2tEaWZmRWRpdG9yTW9kZWwgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSByZWFkb25seSBkaWZmRWRpdG9yQ2FsY3VhdG9yOiBJRGlmZkVkaXRvckhlaWdodENhbGN1bGF0b3JTZXJ2aWNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9tb2RpZmllZFJlc291cmNlRGlzcG9zYWJsZVN0b3JlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSBpbmxpbmVEaWZmV2lkZ2V0OiBOb3RlYm9va0lubGluZURpZmZXaWRnZXQgfCB1bmRlZmluZWQ7XG5cblx0Z2V0IHRleHRNb2RlbCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbW9kZWw/Lm1vZGlmaWVkLm5vdGVib29rO1xuXHR9XG5cblx0Z2V0IGlubGluZU5vdGVib29rRWRpdG9yKCkge1xuXHRcdGlmICh0aGlzLl9pbmxpbmVWaWV3KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5pbmxpbmVEaWZmV2lkZ2V0Py5lZGl0b3JXaWRnZXQ7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIF9yZXZlYWxGaXJzdDogYm9vbGVhbjtcblx0cHJpdmF0ZSByZWFkb25seSBfaW5zZXRNb2RpZnlRdWV1ZUJ5T3V0cHV0SWQgPSBuZXcgU2VxdWVuY2VyQnlLZXk8c3RyaW5nPigpO1xuXG5cdHByb3RlY3RlZCBfb25EaWREeW5hbWljT3V0cHV0UmVuZGVyZWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGNlbGw6IElHZW5lcmljQ2VsbFZpZXdNb2RlbDsgb3V0cHV0OiBJQ2VsbE91dHB1dFZpZXdNb2RlbCB9PigpKTtcblx0b25EaWREeW5hbWljT3V0cHV0UmVuZGVyZWQgPSB0aGlzLl9vbkRpZER5bmFtaWNPdXRwdXRSZW5kZXJlZC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9ub3RlYm9va09wdGlvbnM6IE5vdGVib29rT3B0aW9ucztcblxuXHRnZXQgbm90ZWJvb2tPcHRpb25zKCkge1xuXHRcdHJldHVybiB0aGlzLl9ub3RlYm9va09wdGlvbnM7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9sb2NhbFN0b3JlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRwcml2YXRlIF9sYXlvdXRDYW5jZWxsYXRpb25Ub2tlblNvdXJjZT86IENhbmNlbGxhdGlvblRva2VuU291cmNlO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU2VsZWN0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUVkaXRvclBhbmVTZWxlY3Rpb25DaGFuZ2VFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlU2VsZWN0aW9uID0gdGhpcy5fb25EaWRDaGFuZ2VTZWxlY3Rpb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSBfaXNEaXNwb3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdGdldCBpc0Rpc3Bvc2VkKCkge1xuXHRcdHJldHVybiB0aGlzLl9pc0Rpc3Bvc2VkO1xuXHR9XG5cdHByaXZhdGUgcmVhZG9ubHkgX2N1cnJlbnRDaGFuZ2VkSW5kZXggPSBvYnNlcnZhYmxlVmFsdWUodGhpcywgLTEpO1xuXHRyZWFkb25seSBjdXJyZW50Q2hhbmdlZEluZGV4OiBJT2JzZXJ2YWJsZTxudW1iZXI+ID0gdGhpcy5fY3VycmVudENoYW5nZWRJbmRleDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRncm91cDogSUVkaXRvckdyb3VwLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASU5vdGVib29rRWRpdG9yV29ya2VyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGVib29rRWRpdG9yV29ya2VyU2VydmljZTogSU5vdGVib29rRWRpdG9yV29ya2VyU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90ZWJvb2tTZXJ2aWNlOiBJTm90ZWJvb2tTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihOb3RlYm9va1RleHREaWZmRWRpdG9yLklELCBncm91cCwgdGVsZW1ldHJ5U2VydmljZSwgdGhlbWVTZXJ2aWNlLCBzdG9yYWdlU2VydmljZSk7XG5cdFx0dGhpcy5kaWZmRWRpdG9yQ2FsY3VhdG9yID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEaWZmRWRpdG9ySGVpZ2h0Q2FsY3VsYXRvclNlcnZpY2UsIHRoaXMuZm9udEluZm8ubGluZUhlaWdodCk7XG5cdFx0dGhpcy5fbm90ZWJvb2tPcHRpb25zID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90ZWJvb2tPcHRpb25zLCB0aGlzLndpbmRvdywgZmFsc2UsIHVuZGVmaW5lZCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbm90ZWJvb2tPcHRpb25zKTtcblx0XHR0aGlzLl9yZXZlYWxGaXJzdCA9IHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGdldCBmb250SW5mbygpIHtcblx0XHRpZiAoIXRoaXMuX2ZvbnRJbmZvKSB7XG5cdFx0XHR0aGlzLl9mb250SW5mbyA9IHRoaXMuY3JlYXRlRm9udEluZm8oKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fZm9udEluZm87XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUZvbnRJbmZvKCkge1xuXHRcdGNvbnN0IGVkaXRvck9wdGlvbnMgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElDb2RlRWRpdG9yT3B0aW9ucz4oJ2VkaXRvcicpO1xuXHRcdHJldHVybiBGb250TWVhc3VyZW1lbnRzLnJlYWRGb250SW5mbyh0aGlzLndpbmRvdywgQmFyZUZvbnRJbmZvLmNyZWF0ZUZyb21SYXdTZXR0aW5ncyhlZGl0b3JPcHRpb25zLCBQaXhlbFJhdGlvLmdldEluc3RhbmNlKHRoaXMud2luZG93KS52YWx1ZSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc092ZXJ2aWV3UnVsZXJFbmFibGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKE5vdGVib29rU2V0dGluZy5kaWZmT3ZlcnZpZXdSdWxlcikgPz8gZmFsc2U7XG5cdH1cblxuXHRnZXRTZWxlY3Rpb24oKTogSUVkaXRvclBhbmVTZWxlY3Rpb24gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHNlbGVjdGlvbnMgPSB0aGlzLl9saXN0LmdldEZvY3VzKCk7XG5cdFx0cmV0dXJuIG5ldyBOb3RlYm9va0RpZmZFZGl0b3JTZWxlY3Rpb24oc2VsZWN0aW9ucyk7XG5cdH1cblxuXHR0b2dnbGVOb3RlYm9va0NlbGxTZWxlY3Rpb24oY2VsbDogSUdlbmVyaWNDZWxsVmlld01vZGVsKSB7XG5cdFx0Ly8gdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0dXBkYXRlUGVyZm9ybWFuY2VNZXRhZGF0YShjZWxsSWQ6IHN0cmluZywgZXhlY3V0aW9uSWQ6IHN0cmluZywgZHVyYXRpb246IG51bWJlciwgcmVuZGVyZXJJZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Ly8gdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0YXN5bmMgZm9jdXNOb3RlYm9va0NlbGwoY2VsbDogSUdlbmVyaWNDZWxsVmlld01vZGVsLCBmb2N1czogJ291dHB1dCcgfCAnZWRpdG9yJyB8ICdjb250YWluZXInKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0YXN5bmMgZm9jdXNOZXh0Tm90ZWJvb2tDZWxsKGNlbGw6IElHZW5lcmljQ2VsbFZpZXdNb2RlbCwgZm9jdXM6ICdvdXRwdXQnIHwgJ2VkaXRvcicgfCAnY29udGFpbmVyJyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXG5cdGRpZEZvY3VzT3V0cHV0SW5wdXRDaGFuZ2UoaW5wdXRGb2N1c2VkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Ly8gbm9vcFxuXHR9XG5cblx0Z2V0U2Nyb2xsVG9wKCkge1xuXHRcdHJldHVybiB0aGlzLl9saXN0Py5zY3JvbGxUb3AgPz8gMDtcblx0fVxuXG5cdGdldFNjcm9sbEhlaWdodCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbGlzdD8uc2Nyb2xsSGVpZ2h0ID8/IDA7XG5cdH1cblxuXHRnZXRTY3JvbGxQb3NpdGlvbigpOiBJRWRpdG9yUGFuZVNjcm9sbFBvc2l0aW9uIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0c2Nyb2xsVG9wOiB0aGlzLmdldFNjcm9sbFRvcCgpLFxuXHRcdFx0c2Nyb2xsTGVmdDogdGhpcy5fbGlzdD8uc2Nyb2xsTGVmdCA/PyAwXG5cdFx0fTtcblx0fVxuXG5cdHNldFNjcm9sbFBvc2l0aW9uKHNjcm9sbFBvc2l0aW9uOiBJRWRpdG9yUGFuZVNjcm9sbFBvc2l0aW9uKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9saXN0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fbGlzdC5zY3JvbGxUb3AgPSBzY3JvbGxQb3NpdGlvbi5zY3JvbGxUb3A7XG5cdFx0aWYgKHNjcm9sbFBvc2l0aW9uLnNjcm9sbExlZnQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fbGlzdC5zY3JvbGxMZWZ0ID0gc2Nyb2xsUG9zaXRpb24uc2Nyb2xsTGVmdDtcblx0XHR9XG5cdH1cblxuXHRkZWxlZ2F0ZVZlcnRpY2FsU2Nyb2xsYmFyUG9pbnRlckRvd24oYnJvd3NlckV2ZW50OiBQb2ludGVyRXZlbnQpIHtcblx0XHR0aGlzLl9saXN0Py5kZWxlZ2F0ZVZlcnRpY2FsU2Nyb2xsYmFyUG9pbnRlckRvd24oYnJvd3NlckV2ZW50KTtcblx0fVxuXG5cdHVwZGF0ZU91dHB1dEhlaWdodChjZWxsSW5mbzogSURpZmZDZWxsSW5mbywgb3V0cHV0OiBJQ2VsbE91dHB1dFZpZXdNb2RlbCwgb3V0cHV0SGVpZ2h0OiBudW1iZXIsIGlzSW5pdDogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IGRpZmZFbGVtZW50ID0gY2VsbEluZm8uZGlmZkVsZW1lbnQ7XG5cdFx0Y29uc3QgY2VsbCA9IHRoaXMuZ2V0Q2VsbEJ5SW5mbyhjZWxsSW5mbyk7XG5cdFx0Y29uc3Qgb3V0cHV0SW5kZXggPSBjZWxsLm91dHB1dHNWaWV3TW9kZWxzLmluZGV4T2Yob3V0cHV0KTtcblxuXHRcdGlmIChkaWZmRWxlbWVudCBpbnN0YW5jZW9mIFNpZGVCeVNpZGVEaWZmRWxlbWVudFZpZXdNb2RlbCkge1xuXHRcdFx0Y29uc3QgaW5mbyA9IENlbGxVcmkucGFyc2UoY2VsbEluZm8uY2VsbFVyaSk7XG5cdFx0XHRpZiAoIWluZm8pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRkaWZmRWxlbWVudC51cGRhdGVPdXRwdXRIZWlnaHQoaW5mby5ub3RlYm9vay50b1N0cmluZygpID09PSB0aGlzLl9tb2RlbD8ub3JpZ2luYWwucmVzb3VyY2UudG9TdHJpbmcoKSA/IERpZmZTaWRlLk9yaWdpbmFsIDogRGlmZlNpZGUuTW9kaWZpZWQsIG91dHB1dEluZGV4LCBvdXRwdXRIZWlnaHQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkaWZmRWxlbWVudC51cGRhdGVPdXRwdXRIZWlnaHQoZGlmZkVsZW1lbnQudHlwZSA9PT0gJ2luc2VydCcgPyBEaWZmU2lkZS5Nb2RpZmllZCA6IERpZmZTaWRlLk9yaWdpbmFsLCBvdXRwdXRJbmRleCwgb3V0cHV0SGVpZ2h0KTtcblx0XHR9XG5cblx0XHRpZiAoaXNJbml0KSB7XG5cdFx0XHR0aGlzLl9vbkRpZER5bmFtaWNPdXRwdXRSZW5kZXJlZC5maXJlKHsgY2VsbCwgb3V0cHV0IH0pO1xuXHRcdH1cblx0fVxuXG5cdHNldE1hcmt1cENlbGxFZGl0U3RhdGUoY2VsbElkOiBzdHJpbmcsIGVkaXRTdGF0ZTogQ2VsbEVkaXRTdGF0ZSk6IHZvaWQge1xuXHRcdC8vIHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHRkaWRTdGFydERyYWdNYXJrdXBDZWxsKGNlbGxJZDogc3RyaW5nLCBldmVudDogeyBkcmFnT2Zmc2V0WTogbnVtYmVyIH0pOiB2b2lkIHtcblx0XHQvLyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0ZGlkRHJhZ01hcmt1cENlbGwoY2VsbElkOiBzdHJpbmcsIGV2ZW50OiB7IGRyYWdPZmZzZXRZOiBudW1iZXIgfSk6IHZvaWQge1xuXHRcdC8vIHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHRkaWRFbmREcmFnTWFya3VwQ2VsbChjZWxsSWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdC8vIHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHRkaWREcm9wTWFya3VwQ2VsbChjZWxsSWQ6IHN0cmluZykge1xuXHRcdC8vIHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHRkaWRSZXNpemVPdXRwdXQoY2VsbElkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHQvLyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblxuXHRhc3luYyB0b2dnbGVJbmxpbmVWaWV3KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX2xheW91dENhbmNlbGxhdGlvblRva2VuU291cmNlPy5kaXNwb3NlKCk7XG5cblx0XHR0aGlzLl9pbmxpbmVWaWV3ID0gIXRoaXMuX2lubGluZVZpZXc7XG5cblx0XHRpZiAoIXRoaXMuX2xhc3RMYXlvdXRQcm9wZXJ0aWVzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2lubGluZVZpZXcpIHtcblx0XHRcdHRoaXMubGF5b3V0KHRoaXMuX2xhc3RMYXlvdXRQcm9wZXJ0aWVzPy5kaW1lbnNpb24sIHRoaXMuX2xhc3RMYXlvdXRQcm9wZXJ0aWVzPy5wb3NpdGlvbik7XG5cdFx0XHR0aGlzLmlubGluZURpZmZXaWRnZXQ/LnNob3codGhpcy5pbnB1dCBhcyBOb3RlYm9va0RpZmZFZGl0b3JJbnB1dCwgdGhpcy5fbW9kZWw/Lm1vZGlmaWVkLm5vdGVib29rLCB0aGlzLl9tb2RlbD8ub3JpZ2luYWwubm90ZWJvb2ssIHRoaXMuX29wdGlvbnMgYXMgSU5vdGVib29rRWRpdG9yT3B0aW9ucyB8IHVuZGVmaW5lZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubGF5b3V0KHRoaXMuX2xhc3RMYXlvdXRQcm9wZXJ0aWVzPy5kaW1lbnNpb24sIHRoaXMuX2xhc3RMYXlvdXRQcm9wZXJ0aWVzPy5wb3NpdGlvbik7XG5cdFx0XHR0aGlzLmlubGluZURpZmZXaWRnZXQ/LmhpZGUoKTtcblx0XHR9XG5cblx0XHR0aGlzLl9sYXlvdXRDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdHRoaXMudXBkYXRlTGF5b3V0KHRoaXMuX2xheW91dENhbmNlbGxhdGlvblRva2VuU291cmNlLnRva2VuKTtcblx0fVxuXG5cdHByb3RlY3RlZCBjcmVhdGVFZGl0b3IocGFyZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMuX3Jvb3RFbGVtZW50ID0gRE9NLmFwcGVuZChwYXJlbnQsIERPTS4kKCcubm90ZWJvb2stdGV4dC1kaWZmLWVkaXRvcicpKTtcblx0XHR0aGlzLl9vdmVyZmxvd0NvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRoaXMuX292ZXJmbG93Q29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ25vdGVib29rLW92ZXJmbG93LXdpZGdldC1jb250YWluZXInLCAnbW9uYWNvLWVkaXRvcicpO1xuXHRcdERPTS5hcHBlbmQocGFyZW50LCB0aGlzLl9vdmVyZmxvd0NvbnRhaW5lcik7XG5cblx0XHRjb25zdCByZW5kZXJlcnMgPSBbXG5cdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENlbGxEaWZmU2luZ2xlU2lkZVJlbmRlcmVyLCB0aGlzKSxcblx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2VsbERpZmZTaWRlQnlTaWRlUmVuZGVyZXIsIHRoaXMpLFxuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDZWxsRGlmZlBsYWNlaG9sZGVyUmVuZGVyZXIsIHRoaXMpLFxuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShOb3RlYm9va0RvY3VtZW50TWV0YWRhdGFEaWZmUmVuZGVyZXIsIHRoaXMpLFxuXHRcdF07XG5cblx0XHR0aGlzLl9saXN0Vmlld0NvbnRhaW5lciA9IERPTS5hcHBlbmQodGhpcy5fcm9vdEVsZW1lbnQsIERPTS4kKCcubm90ZWJvb2stZGlmZi1saXN0LXZpZXcnKSk7XG5cblx0XHR0aGlzLl9saXN0ID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdE5vdGVib29rVGV4dERpZmZMaXN0LFxuXHRcdFx0J05vdGVib29rVGV4dERpZmYnLFxuXHRcdFx0dGhpcy5fbGlzdFZpZXdDb250YWluZXIsXG5cdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vdGVib29rQ2VsbFRleHREaWZmTGlzdERlbGVnYXRlLCB0aGlzLndpbmRvdyksXG5cdFx0XHRyZW5kZXJlcnMsXG5cdFx0XHR0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0e1xuXHRcdFx0XHRzZXRSb3dMaW5lSGVpZ2h0OiBmYWxzZSxcblx0XHRcdFx0c2V0Um93SGVpZ2h0OiBmYWxzZSxcblx0XHRcdFx0c3VwcG9ydER5bmFtaWNIZWlnaHRzOiB0cnVlLFxuXHRcdFx0XHRob3Jpem9udGFsU2Nyb2xsaW5nOiBmYWxzZSxcblx0XHRcdFx0a2V5Ym9hcmRTdXBwb3J0OiBmYWxzZSxcblx0XHRcdFx0bW91c2VTdXBwb3J0OiB0cnVlLFxuXHRcdFx0XHRtdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQ6IGZhbHNlLFxuXHRcdFx0XHR0eXBlTmF2aWdhdGlvbkVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdHBhZGRpbmdCb3R0b206IDAsXG5cdFx0XHRcdC8vIHRyYW5zZm9ybU9wdGltaXphdGlvbjogKGlzTWFjaW50b3NoICYmIGlzTmF0aXZlKSB8fCBnZXRUaXRsZUJhclN0eWxlKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UsIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlKSA9PT0gJ25hdGl2ZScsXG5cdFx0XHRcdHN0eWxlQ29udHJvbGxlcjogKF9zdWZmaXg6IHN0cmluZykgPT4geyByZXR1cm4gdGhpcy5fbGlzdDsgfSxcblx0XHRcdFx0b3ZlcnJpZGVTdHlsZXM6IHtcblx0XHRcdFx0XHRsaXN0QmFja2dyb3VuZDogZWRpdG9yQmFja2dyb3VuZCxcblx0XHRcdFx0XHRsaXN0QWN0aXZlU2VsZWN0aW9uQmFja2dyb3VuZDogZWRpdG9yQmFja2dyb3VuZCxcblx0XHRcdFx0XHRsaXN0QWN0aXZlU2VsZWN0aW9uRm9yZWdyb3VuZDogZm9yZWdyb3VuZCxcblx0XHRcdFx0XHRsaXN0Rm9jdXNBbmRTZWxlY3Rpb25CYWNrZ3JvdW5kOiBlZGl0b3JCYWNrZ3JvdW5kLFxuXHRcdFx0XHRcdGxpc3RGb2N1c0FuZFNlbGVjdGlvbkZvcmVncm91bmQ6IGZvcmVncm91bmQsXG5cdFx0XHRcdFx0bGlzdEZvY3VzQmFja2dyb3VuZDogZWRpdG9yQmFja2dyb3VuZCxcblx0XHRcdFx0XHRsaXN0Rm9jdXNGb3JlZ3JvdW5kOiBmb3JlZ3JvdW5kLFxuXHRcdFx0XHRcdGxpc3RIb3ZlckZvcmVncm91bmQ6IGZvcmVncm91bmQsXG5cdFx0XHRcdFx0bGlzdEhvdmVyQmFja2dyb3VuZDogZWRpdG9yQmFja2dyb3VuZCxcblx0XHRcdFx0XHRsaXN0SG92ZXJPdXRsaW5lOiBmb2N1c0JvcmRlcixcblx0XHRcdFx0XHRsaXN0Rm9jdXNPdXRsaW5lOiBmb2N1c0JvcmRlcixcblx0XHRcdFx0XHRsaXN0SW5hY3RpdmVTZWxlY3Rpb25CYWNrZ3JvdW5kOiBlZGl0b3JCYWNrZ3JvdW5kLFxuXHRcdFx0XHRcdGxpc3RJbmFjdGl2ZVNlbGVjdGlvbkZvcmVncm91bmQ6IGZvcmVncm91bmQsXG5cdFx0XHRcdFx0bGlzdEluYWN0aXZlRm9jdXNCYWNrZ3JvdW5kOiBlZGl0b3JCYWNrZ3JvdW5kLFxuXHRcdFx0XHRcdGxpc3RJbmFjdGl2ZUZvY3VzT3V0bGluZTogZWRpdG9yQmFja2dyb3VuZCxcblx0XHRcdFx0fSxcblx0XHRcdFx0YWNjZXNzaWJpbGl0eVByb3ZpZGVyOiB7XG5cdFx0XHRcdFx0Z2V0QXJpYUxhYmVsKCkgeyByZXR1cm4gbnVsbDsgfSxcblx0XHRcdFx0XHRnZXRXaWRnZXRBcmlhTGFiZWwoKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdub3RlYm9va1RyZWVBcmlhTGFiZWwnLCBcIk5vdGVib29rIFRleHQgRGlmZlwiKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdC8vIGZvY3VzTmV4dFByZXZpb3VzRGVsZWdhdGU6IHtcblx0XHRcdFx0Ly8gXHRvbkZvY3VzTmV4dDogKGFwcGx5Rm9jdXNOZXh0OiAoKSA9PiB2b2lkKSA9PiB0aGlzLl91cGRhdGVGb3JDdXJzb3JOYXZpZ2F0aW9uTW9kZShhcHBseUZvY3VzTmV4dCksXG5cdFx0XHRcdC8vIFx0b25Gb2N1c1ByZXZpb3VzOiAoYXBwbHlGb2N1c1ByZXZpb3VzOiAoKSA9PiB2b2lkKSA9PiB0aGlzLl91cGRhdGVGb3JDdXJzb3JOYXZpZ2F0aW9uTW9kZShhcHBseUZvY3VzUHJldmlvdXMpLFxuXHRcdFx0XHQvLyB9XG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdHRoaXMuaW5saW5lRGlmZldpZGdldCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90ZWJvb2tJbmxpbmVEaWZmV2lkZ2V0LCB0aGlzLl9yb290RWxlbWVudCwgdGhpcy5ncm91cC5pZCwgdGhpcy53aW5kb3csIHRoaXMubm90ZWJvb2tPcHRpb25zLCB0aGlzLl9kaW1lbnNpb24pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2xpc3QpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2xpc3Qub25Nb3VzZVVwKGUgPT4ge1xuXHRcdFx0aWYgKGUuZWxlbWVudCkge1xuXHRcdFx0XHRpZiAodHlwZW9mIGUuaW5kZXggPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0dGhpcy5fbGlzdC5zZXRGb2N1cyhbZS5pbmRleF0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX29uTW91c2VVcC5maXJlKHsgZXZlbnQ6IGUuYnJvd3NlckV2ZW50LCB0YXJnZXQ6IGUuZWxlbWVudCB9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9saXN0Lm9uRGlkU2Nyb2xsKCgpID0+IHtcblx0XHRcdHRoaXMuX29uRGlkU2Nyb2xsLmZpcmUoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9saXN0Lm9uRGlkQ2hhbmdlRm9jdXMoKCkgPT4gdGhpcy5fb25EaWRDaGFuZ2VTZWxlY3Rpb24uZmlyZSh7IHJlYXNvbjogRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZVJlYXNvbi5VU0VSIH0pKSk7XG5cblx0XHR0aGlzLl9vdmVydmlld1J1bGVyQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dGhpcy5fb3ZlcnZpZXdSdWxlckNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdub3RlYm9vay1vdmVydmlldy1ydWxlci1jb250YWluZXInKTtcblx0XHR0aGlzLl9yb290RWxlbWVudC5hcHBlbmRDaGlsZCh0aGlzLl9vdmVydmlld1J1bGVyQ29udGFpbmVyKTtcblx0XHR0aGlzLl9yZWdpc3Rlck92ZXJ2aWV3UnVsZXIoKTtcblxuXHRcdC8vIHRyYW5zcGFyZW50IGNvdmVyXG5cdFx0dGhpcy5fd2Vidmlld1RyYW5zcGFyZW50Q292ZXIgPSBET00uYXBwZW5kKHRoaXMuX2xpc3Qucm93c0NvbnRhaW5lciwgJCgnLndlYnZpZXctY292ZXInKSk7XG5cdFx0dGhpcy5fd2Vidmlld1RyYW5zcGFyZW50Q292ZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5hZGRTdGFuZGFyZERpc3Bvc2FibGVHZW5lcmljTW91c2VEb3duTGlzdGVuZXIodGhpcy5fb3ZlcmZsb3dDb250YWluZXIsIChlOiBTdGFuZGFyZE1vdXNlRXZlbnQpID0+IHtcblx0XHRcdGlmIChlLnRhcmdldC5jbGFzc0xpc3QuY29udGFpbnMoJ3NsaWRlcicpICYmIHRoaXMuX3dlYnZpZXdUcmFuc3BhcmVudENvdmVyKSB7XG5cdFx0XHRcdHRoaXMuX3dlYnZpZXdUcmFuc3BhcmVudENvdmVyLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5hZGRTdGFuZGFyZERpc3Bvc2FibGVHZW5lcmljTW91c2VVcExpc3RlbmVyKHRoaXMuX292ZXJmbG93Q29udGFpbmVyLCAoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fd2Vidmlld1RyYW5zcGFyZW50Q292ZXIpIHtcblx0XHRcdFx0Ly8gbm8gbWF0dGVyIHdoZW5cblx0XHRcdFx0dGhpcy5fd2Vidmlld1RyYW5zcGFyZW50Q292ZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9saXN0Lm9uRGlkU2Nyb2xsKGUgPT4ge1xuXHRcdFx0dGhpcy5fd2Vidmlld1RyYW5zcGFyZW50Q292ZXIhLnN0eWxlLnRvcCA9IGAke2Uuc2Nyb2xsVG9wfXB4YDtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF9yZWdpc3Rlck92ZXJ2aWV3UnVsZXIoKSB7XG5cdFx0dGhpcy5fb3ZlcnZpZXdSdWxlciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90ZWJvb2tEaWZmT3ZlcnZpZXdSdWxlciwgdGhpcywgTm90ZWJvb2tUZXh0RGlmZkVkaXRvci5FTlRJUkVfRElGRl9PVkVSVklFV19XSURUSCwgdGhpcy5fb3ZlcnZpZXdSdWxlckNvbnRhaW5lcikpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlT3V0cHV0c09mZnNldHNJbldlYnZpZXcoc2Nyb2xsVG9wOiBudW1iZXIsIHNjcm9sbEhlaWdodDogbnVtYmVyLCBhY3RpdmVXZWJ2aWV3OiBCYWNrTGF5ZXJXZWJWaWV3PElEaWZmQ2VsbEluZm8+LCBnZXRBY3RpdmVOZXN0ZWRDZWxsOiAoZGlmZkVsZW1lbnQ6IERpZmZFbGVtZW50Q2VsbFZpZXdNb2RlbEJhc2UpID0+IERpZmZOZXN0ZWRDZWxsVmlld01vZGVsIHwgdW5kZWZpbmVkLCBkaWZmU2lkZTogRGlmZlNpZGUpIHtcblx0XHRhY3RpdmVXZWJ2aWV3LmVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gYCR7c2Nyb2xsSGVpZ2h0fXB4YDtcblxuXHRcdGlmIChhY3RpdmVXZWJ2aWV3Lmluc2V0TWFwcGluZykge1xuXHRcdFx0Y29uc3QgdXBkYXRlSXRlbXM6IElEaXNwbGF5T3V0cHV0TGF5b3V0VXBkYXRlUmVxdWVzdFtdID0gW107XG5cdFx0XHRjb25zdCByZW1vdmVkSXRlbXM6IElDZWxsT3V0cHV0Vmlld01vZGVsW10gPSBbXTtcblx0XHRcdGFjdGl2ZVdlYnZpZXcuaW5zZXRNYXBwaW5nLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcblx0XHRcdFx0Y29uc3QgY2VsbCA9IGdldEFjdGl2ZU5lc3RlZENlbGwodmFsdWUuY2VsbEluZm8uZGlmZkVsZW1lbnQpO1xuXHRcdFx0XHRpZiAoIWNlbGwpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCB2aWV3SW5kZXggPSB0aGlzLl9saXN0LmluZGV4T2YodmFsdWUuY2VsbEluZm8uZGlmZkVsZW1lbnQpO1xuXG5cdFx0XHRcdGlmICh2aWV3SW5kZXggPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChjZWxsLm91dHB1dHNWaWV3TW9kZWxzLmluZGV4T2Yoa2V5KSA8IDApIHtcblx0XHRcdFx0XHQvLyBvdXRwdXQgaXMgYWxyZWFkeSBnb25lXG5cdFx0XHRcdFx0cmVtb3ZlZEl0ZW1zLnB1c2goa2V5KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCBjZWxsVG9wID0gdGhpcy5fbGlzdC5nZXRDZWxsVmlld1Njcm9sbFRvcCh2YWx1ZS5jZWxsSW5mby5kaWZmRWxlbWVudCk7XG5cdFx0XHRcdFx0Y29uc3Qgb3V0cHV0SW5kZXggPSBjZWxsLm91dHB1dHNWaWV3TW9kZWxzLmluZGV4T2Yoa2V5KTtcblx0XHRcdFx0XHRjb25zdCBvdXRwdXRPZmZzZXQgPSB2YWx1ZS5jZWxsSW5mby5kaWZmRWxlbWVudC5nZXRPdXRwdXRPZmZzZXRJbkNlbGwoZGlmZlNpZGUsIG91dHB1dEluZGV4KTtcblx0XHRcdFx0XHR1cGRhdGVJdGVtcy5wdXNoKHtcblx0XHRcdFx0XHRcdGNlbGwsXG5cdFx0XHRcdFx0XHRvdXRwdXQ6IGtleSxcblx0XHRcdFx0XHRcdGNlbGxUb3A6IGNlbGxUb3AsXG5cdFx0XHRcdFx0XHRvdXRwdXRPZmZzZXQ6IG91dHB1dE9mZnNldCxcblx0XHRcdFx0XHRcdGZvcmNlRGlzcGxheTogZmFsc2Vcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHR9KTtcblxuXHRcdFx0YWN0aXZlV2Vidmlldy5yZW1vdmVJbnNldHMocmVtb3ZlZEl0ZW1zKTtcblxuXHRcdFx0aWYgKHVwZGF0ZUl0ZW1zLmxlbmd0aCkge1xuXHRcdFx0XHRhY3RpdmVXZWJ2aWV3LnVwZGF0ZVNjcm9sbFRvcHModXBkYXRlSXRlbXMsIFtdKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBzZXRJbnB1dChpbnB1dDogTm90ZWJvb2tEaWZmRWRpdG9ySW5wdXQsIG9wdGlvbnM6IElOb3RlYm9va0VkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQsIGNvbnRleHQ6IElFZGl0b3JPcGVuQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5pbmxpbmVEaWZmV2lkZ2V0Py5oaWRlKCk7XG5cblx0XHRhd2FpdCBzdXBlci5zZXRJbnB1dChpbnB1dCwgb3B0aW9ucywgY29udGV4dCwgdG9rZW4pO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCBpbnB1dC5yZXNvbHZlKCk7XG5cdFx0aWYgKHRoaXMuX21vZGVsICE9PSBtb2RlbCkge1xuXHRcdFx0dGhpcy5fZGV0YWNoTW9kZWwoKTtcblx0XHRcdHRoaXMuX2F0dGFjaE1vZGVsKG1vZGVsKTtcblx0XHR9XG5cblx0XHR0aGlzLl9tb2RlbCA9IG1vZGVsO1xuXHRcdGlmICh0aGlzLl9tb2RlbCA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9pbmxpbmVWaWV3KSB7XG5cdFx0XHR0aGlzLl9saXN0Vmlld0NvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdFx0dGhpcy5pbmxpbmVEaWZmV2lkZ2V0Py5zaG93KGlucHV0LCBtb2RlbC5tb2RpZmllZC5ub3RlYm9vaywgbW9kZWwub3JpZ2luYWwubm90ZWJvb2ssIG9wdGlvbnMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9saXN0Vmlld0NvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcblx0XHRcdHRoaXMuaW5saW5lRGlmZldpZGdldD8uaGlkZSgpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3JldmVhbEZpcnN0ID0gdHJ1ZTtcblxuXHRcdHRoaXMuX21vZGlmaWVkUmVzb3VyY2VEaXNwb3NhYmxlU3RvcmUuY2xlYXIoKTtcblxuXHRcdHRoaXMuX2xheW91dENhbmNlbGxhdGlvblRva2VuU291cmNlID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cblx0XHR0aGlzLl9tb2RpZmllZFJlc291cmNlRGlzcG9zYWJsZVN0b3JlLmFkZChFdmVudC5hbnkodGhpcy5fbW9kZWwub3JpZ2luYWwubm90ZWJvb2sub25EaWRDaGFuZ2VDb250ZW50LCB0aGlzLl9tb2RlbC5tb2RpZmllZC5ub3RlYm9vay5vbkRpZENoYW5nZUNvbnRlbnQpKGUgPT4ge1xuXHRcdFx0Ly8gSWYgdGhlIHVzZXIgaGFzIG1hZGUgY2hhbmdlcyB0byB0aGUgbm90ZWJvb2sgd2hpbHN0IGluIHRoZSBkaWZmIGVkaXRvcixcblx0XHRcdC8vIHRoZW4gZG8gbm90IHJlLWNvbXB1dGUgdGhlIGRpZmYgb2YgdGhlIG5vdGVib29rLFxuXHRcdFx0Ly8gQXMgY2hhbmdlIHdpbGwgcmVzdWx0IGluIHJlLWNvbXB1dGluZyBkaWZmIGFuZCByZS1idWlsZGluZyBlbnRpcmUgZGlmZiB2aWV3LlxuXHRcdFx0aWYgKHRoaXMuX21vZGVsICE9PSBudWxsICYmIHRoaXMuZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3IgIT09IGlucHV0KSB7XG5cdFx0XHRcdHRoaXMuX2xheW91dENhbmNlbGxhdGlvblRva2VuU291cmNlPy5kaXNwb3NlKCk7XG5cdFx0XHRcdHRoaXMuX2xheW91dENhbmNlbGxhdGlvblRva2VuU291cmNlID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0XHRcdHRoaXMudXBkYXRlTGF5b3V0KHRoaXMuX2xheW91dENhbmNlbGxhdGlvblRva2VuU291cmNlLnRva2VuKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCB0aGlzLl9jcmVhdGVPcmlnaW5hbFdlYnZpZXcoZ2VuZXJhdGVVdWlkKCksIHRoaXMuX21vZGVsLm9yaWdpbmFsLnZpZXdUeXBlLCB0aGlzLl9tb2RlbC5vcmlnaW5hbC5yZXNvdXJjZSk7XG5cdFx0aWYgKHRoaXMuX29yaWdpbmFsV2Vidmlldykge1xuXHRcdFx0dGhpcy5fbW9kaWZpZWRSZXNvdXJjZURpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy5fb3JpZ2luYWxXZWJ2aWV3KTtcblx0XHR9XG5cdFx0YXdhaXQgdGhpcy5fY3JlYXRlTW9kaWZpZWRXZWJ2aWV3KGdlbmVyYXRlVXVpZCgpLCB0aGlzLl9tb2RlbC5tb2RpZmllZC52aWV3VHlwZSwgdGhpcy5fbW9kZWwubW9kaWZpZWQucmVzb3VyY2UpO1xuXHRcdGlmICh0aGlzLl9tb2RpZmllZFdlYnZpZXcpIHtcblx0XHRcdHRoaXMuX21vZGlmaWVkUmVzb3VyY2VEaXNwb3NhYmxlU3RvcmUuYWRkKHRoaXMuX21vZGlmaWVkV2Vidmlldyk7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy51cGRhdGVMYXlvdXQodGhpcy5fbGF5b3V0Q2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UudG9rZW4sIG9wdGlvbnM/LmNlbGxTZWxlY3Rpb25zID8gY2VsbFJhbmdlc1RvSW5kZXhlcyhvcHRpb25zLmNlbGxTZWxlY3Rpb25zKSA6IHVuZGVmaW5lZCk7XG5cdH1cblxuXHRvdmVycmlkZSBzZXRWaXNpYmxlKHZpc2libGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRzdXBlci5zZXRWaXNpYmxlKHZpc2libGUpO1xuXHRcdGlmICghdmlzaWJsZSkge1xuXHRcdFx0dGhpcy5pbmxpbmVEaWZmV2lkZ2V0Py5oaWRlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZGV0YWNoTW9kZWwoKSB7XG5cdFx0dGhpcy5fbG9jYWxTdG9yZS5jbGVhcigpO1xuXHRcdHRoaXMuX29yaWdpbmFsV2Vidmlldz8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuX29yaWdpbmFsV2Vidmlldz8uZWxlbWVudC5yZW1vdmUoKTtcblx0XHR0aGlzLl9vcmlnaW5hbFdlYnZpZXcgPSBudWxsO1xuXHRcdHRoaXMuX21vZGlmaWVkV2Vidmlldz8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuX21vZGlmaWVkV2Vidmlldz8uZWxlbWVudC5yZW1vdmUoKTtcblx0XHR0aGlzLl9tb2RpZmllZFdlYnZpZXcgPSBudWxsO1xuXG5cdFx0dGhpcy5ub3RlYm9va0RpZmZWaWV3TW9kZWw/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLm5vdGVib29rRGlmZlZpZXdNb2RlbCA9IHVuZGVmaW5lZDtcblxuXHRcdHRoaXMuX21vZGlmaWVkUmVzb3VyY2VEaXNwb3NhYmxlU3RvcmUuY2xlYXIoKTtcblx0XHR0aGlzLl9saXN0LmNsZWFyKCk7XG5cblx0fVxuXHRwcml2YXRlIF9hdHRhY2hNb2RlbChtb2RlbDogSU5vdGVib29rRGlmZkVkaXRvck1vZGVsKSB7XG5cdFx0dGhpcy5fbW9kZWwgPSBtb2RlbDtcblx0XHR0aGlzLl9ldmVudERpc3BhdGNoZXIgPSBuZXcgTm90ZWJvb2tEaWZmRWRpdG9yRXZlbnREaXNwYXRjaGVyKCk7XG5cdFx0Y29uc3QgdXBkYXRlSW5zZXRzID0gKCkgPT4ge1xuXHRcdFx0RE9NLnNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWUodGhpcy53aW5kb3csICgpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuX2lzRGlzcG9zZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGhpcy5fbW9kaWZpZWRXZWJ2aWV3KSB7XG5cdFx0XHRcdFx0dGhpcy5fdXBkYXRlT3V0cHV0c09mZnNldHNJbldlYnZpZXcodGhpcy5fbGlzdC5zY3JvbGxUb3AsIHRoaXMuX2xpc3Quc2Nyb2xsSGVpZ2h0LCB0aGlzLl9tb2RpZmllZFdlYnZpZXcsIChkaWZmRWxlbWVudDogRGlmZkVsZW1lbnRDZWxsVmlld01vZGVsQmFzZSkgPT4ge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGRpZmZFbGVtZW50Lm1vZGlmaWVkO1xuXHRcdFx0XHRcdH0sIERpZmZTaWRlLk1vZGlmaWVkKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0aGlzLl9vcmlnaW5hbFdlYnZpZXcpIHtcblx0XHRcdFx0XHR0aGlzLl91cGRhdGVPdXRwdXRzT2Zmc2V0c0luV2Vidmlldyh0aGlzLl9saXN0LnNjcm9sbFRvcCwgdGhpcy5fbGlzdC5zY3JvbGxIZWlnaHQsIHRoaXMuX29yaWdpbmFsV2VidmlldywgKGRpZmZFbGVtZW50OiBEaWZmRWxlbWVudENlbGxWaWV3TW9kZWxCYXNlKSA9PiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZGlmZkVsZW1lbnQub3JpZ2luYWw7XG5cdFx0XHRcdFx0fSwgRGlmZlNpZGUuT3JpZ2luYWwpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9O1xuXG5cdFx0dGhpcy5fbG9jYWxTdG9yZS5hZGQodGhpcy5fbGlzdC5vbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQoKCkgPT4ge1xuXHRcdFx0dXBkYXRlSW5zZXRzKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fbG9jYWxTdG9yZS5hZGQodGhpcy5fbGlzdC5vbkRpZENoYW5nZUZvY3VzKChlKSA9PiB7XG5cdFx0XHRpZiAoZS5pbmRleGVzLmxlbmd0aCAmJiB0aGlzLm5vdGVib29rRGlmZlZpZXdNb2RlbCAmJiBlLmluZGV4ZXNbMF0gPCB0aGlzLm5vdGVib29rRGlmZlZpZXdNb2RlbC5pdGVtcy5sZW5ndGgpIHtcblx0XHRcdFx0Y29uc3Qgc2VsZWN0ZWRJdGVtID0gdGhpcy5ub3RlYm9va0RpZmZWaWV3TW9kZWwuaXRlbXNbZS5pbmRleGVzWzBdXTtcblx0XHRcdFx0Y29uc3QgY2hhbmdlZEl0ZW1zID0gdGhpcy5ub3RlYm9va0RpZmZWaWV3TW9kZWwuaXRlbXMuZmlsdGVyKGl0ZW0gPT4gaXRlbS50eXBlICE9PSAndW5jaGFuZ2VkJyAmJiBpdGVtLnR5cGUgIT09ICd1bmNoYW5nZWRNZXRhZGF0YScgJiYgaXRlbS50eXBlICE9PSAncGxhY2Vob2xkZXInKTtcblx0XHRcdFx0aWYgKHNlbGVjdGVkSXRlbSAmJiBzZWxlY3RlZEl0ZW0/LnR5cGUgIT09ICdwbGFjZWhvbGRlcicgJiYgc2VsZWN0ZWRJdGVtPy50eXBlICE9PSAndW5jaGFuZ2VkJyAmJiBzZWxlY3RlZEl0ZW0/LnR5cGUgIT09ICd1bmNoYW5nZWRNZXRhZGF0YScpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fY3VycmVudENoYW5nZWRJbmRleC5zZXQoY2hhbmdlZEl0ZW1zLmluZGV4T2Yoc2VsZWN0ZWRJdGVtKSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXMuX2N1cnJlbnRDaGFuZ2VkSW5kZXguc2V0KC0xLCB1bmRlZmluZWQpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2xvY2FsU3RvcmUuYWRkKHRoaXMuX2V2ZW50RGlzcGF0Y2hlci5vbkRpZENoYW5nZUNlbGxMYXlvdXQoKCkgPT4ge1xuXHRcdFx0dXBkYXRlSW5zZXRzKCk7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3Qgdm0gPSB0aGlzLm5vdGVib29rRGlmZlZpZXdNb2RlbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBOb3RlYm9va0RpZmZWaWV3TW9kZWwodGhpcy5fbW9kZWwsIHRoaXMubm90ZWJvb2tFZGl0b3JXb3JrZXJTZXJ2aWNlLCB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0aGlzLl9ldmVudERpc3BhdGNoZXIhLCB0aGlzLm5vdGVib29rU2VydmljZSwgdGhpcy5kaWZmRWRpdG9yQ2FsY3VhdG9yLCB0aGlzLmZvbnRJbmZvLCB1bmRlZmluZWQpKTtcblx0XHR0aGlzLl9sb2NhbFN0b3JlLmFkZCh0aGlzLm5vdGVib29rRGlmZlZpZXdNb2RlbC5vbkRpZENoYW5nZUl0ZW1zKGUgPT4ge1xuXHRcdFx0dGhpcy5fb3JpZ2luYWxXZWJ2aWV3Py5yZW1vdmVJbnNldHMoWy4uLnRoaXMuX29yaWdpbmFsV2Vidmlldz8uaW5zZXRNYXBwaW5nLmtleXMoKV0pO1xuXHRcdFx0dGhpcy5fbW9kaWZpZWRXZWJ2aWV3Py5yZW1vdmVJbnNldHMoWy4uLnRoaXMuX21vZGlmaWVkV2Vidmlldz8uaW5zZXRNYXBwaW5nLmtleXMoKV0pO1xuXG5cdFx0XHRpZiAodGhpcy5fcmV2ZWFsRmlyc3QgJiYgdHlwZW9mIGUuZmlyc3RDaGFuZ2VJbmRleCA9PT0gJ251bWJlcicgJiYgZS5maXJzdENoYW5nZUluZGV4ID4gLTEgJiYgZS5maXJzdENoYW5nZUluZGV4IDwgdGhpcy5fbGlzdC5sZW5ndGgpIHtcblx0XHRcdFx0dGhpcy5fcmV2ZWFsRmlyc3QgPSBmYWxzZTtcblx0XHRcdFx0dGhpcy5fbGlzdC5zZXRGb2N1cyhbZS5maXJzdENoYW5nZUluZGV4XSk7XG5cdFx0XHRcdHRoaXMuX2xpc3QucmV2ZWFsKGUuZmlyc3RDaGFuZ2VJbmRleCwgMC4zKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fbGlzdC5zcGxpY2UoZS5zdGFydCwgZS5kZWxldGVDb3VudCwgZS5lbGVtZW50cyk7XG5cblx0XHRcdGlmICh0aGlzLmlzT3ZlcnZpZXdSdWxlckVuYWJsZWQoKSkge1xuXHRcdFx0XHR0aGlzLl9vdmVydmlld1J1bGVyLnVwZGF0ZVZpZXdNb2RlbHModm0uaXRlbXMsIHRoaXMuX2V2ZW50RGlzcGF0Y2hlcik7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfY3JlYXRlTW9kaWZpZWRXZWJ2aWV3KGlkOiBzdHJpbmcsIHZpZXdUeXBlOiBzdHJpbmcsIHJlc291cmNlOiBVUkkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9tb2RpZmllZFdlYnZpZXc/LmRpc3Bvc2UoKTtcblxuXHRcdHRoaXMuX21vZGlmaWVkV2VidmlldyA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQmFja0xheWVyV2ViVmlldywgdGhpcywgaWQsIHZpZXdUeXBlLCByZXNvdXJjZSwge1xuXHRcdFx0Li4udGhpcy5fbm90ZWJvb2tPcHRpb25zLmNvbXB1dGVEaWZmV2Vidmlld09wdGlvbnMoKSxcblx0XHRcdGZvbnRGYW1pbHk6IHRoaXMuX2dlbmVyYXRlRm9udEZhbWlseSgpXG5cdFx0fSwgdW5kZWZpbmVkKSBhcyBCYWNrTGF5ZXJXZWJWaWV3PElEaWZmQ2VsbEluZm8+O1xuXHRcdC8vIGF0dGFjaCB0aGUgd2VidmlldyBjb250YWluZXIgdG8gdGhlIERPTSB0cmVlIGZpcnN0XG5cdFx0dGhpcy5fbGlzdC5yb3dzQ29udGFpbmVyLmluc2VydEFkamFjZW50RWxlbWVudCgnYWZ0ZXJiZWdpbicsIHRoaXMuX21vZGlmaWVkV2Vidmlldy5lbGVtZW50KTtcblx0XHR0aGlzLl9tb2RpZmllZFdlYnZpZXcuY3JlYXRlV2Vidmlldyh0aGlzLndpbmRvdyk7XG5cdFx0dGhpcy5fbW9kaWZpZWRXZWJ2aWV3LmVsZW1lbnQuc3R5bGUud2lkdGggPSBgY2FsYyg1MCUgLSAxNnB4KWA7XG5cdFx0dGhpcy5fbW9kaWZpZWRXZWJ2aWV3LmVsZW1lbnQuc3R5bGUubGVmdCA9IGBjYWxjKDUwJSlgO1xuXHR9XG5cdF9nZW5lcmF0ZUZvbnRGYW1pbHkoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5mb250SW5mby5mb250RmFtaWx5ID8/IGBcIlNGIE1vbm9cIiwgTW9uYWNvLCBNZW5sbywgQ29uc29sYXMsIFwiVWJ1bnR1IE1vbm9cIiwgXCJMaWJlcmF0aW9uIE1vbm9cIiwgXCJEZWphVnUgU2FucyBNb25vXCIsIFwiQ291cmllciBOZXdcIiwgbW9ub3NwYWNlYDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2NyZWF0ZU9yaWdpbmFsV2VidmlldyhpZDogc3RyaW5nLCB2aWV3VHlwZTogc3RyaW5nLCByZXNvdXJjZTogVVJJKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fb3JpZ2luYWxXZWJ2aWV3Py5kaXNwb3NlKCk7XG5cblx0XHR0aGlzLl9vcmlnaW5hbFdlYnZpZXcgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEJhY2tMYXllcldlYlZpZXcsIHRoaXMsIGlkLCB2aWV3VHlwZSwgcmVzb3VyY2UsIHtcblx0XHRcdC4uLnRoaXMuX25vdGVib29rT3B0aW9ucy5jb21wdXRlRGlmZldlYnZpZXdPcHRpb25zKCksXG5cdFx0XHRmb250RmFtaWx5OiB0aGlzLl9nZW5lcmF0ZUZvbnRGYW1pbHkoKVxuXHRcdH0sIHVuZGVmaW5lZCkgYXMgQmFja0xheWVyV2ViVmlldzxJRGlmZkNlbGxJbmZvPjtcblx0XHQvLyBhdHRhY2ggdGhlIHdlYnZpZXcgY29udGFpbmVyIHRvIHRoZSBET00gdHJlZSBmaXJzdFxuXHRcdHRoaXMuX2xpc3Qucm93c0NvbnRhaW5lci5pbnNlcnRBZGphY2VudEVsZW1lbnQoJ2FmdGVyYmVnaW4nLCB0aGlzLl9vcmlnaW5hbFdlYnZpZXcuZWxlbWVudCk7XG5cdFx0dGhpcy5fb3JpZ2luYWxXZWJ2aWV3LmNyZWF0ZVdlYnZpZXcodGhpcy53aW5kb3cpO1xuXHRcdHRoaXMuX29yaWdpbmFsV2Vidmlldy5lbGVtZW50LnN0eWxlLndpZHRoID0gYGNhbGMoNTAlIC0gMTZweClgO1xuXHRcdHRoaXMuX29yaWdpbmFsV2Vidmlldy5lbGVtZW50LnN0eWxlLmxlZnQgPSBgMTZweGA7XG5cdH1cblxuXHRvdmVycmlkZSBzZXRPcHRpb25zKG9wdGlvbnM6IElOb3RlYm9va0VkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCBzZWxlY3Rpb25zID0gb3B0aW9ucz8uY2VsbFNlbGVjdGlvbnMgPyBjZWxsUmFuZ2VzVG9JbmRleGVzKG9wdGlvbnMuY2VsbFNlbGVjdGlvbnMpIDogdW5kZWZpbmVkO1xuXHRcdGlmIChzZWxlY3Rpb25zKSB7XG5cdFx0XHR0aGlzLl9saXN0LnNldEZvY3VzKHNlbGVjdGlvbnMpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHVwZGF0ZUxheW91dCh0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIHNlbGVjdGlvbnM/OiBudW1iZXJbXSkge1xuXHRcdGlmICghdGhpcy5fbW9kZWwgfHwgIXRoaXMubm90ZWJvb2tEaWZmVmlld01vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5ub3RlYm9va0RpZmZWaWV3TW9kZWwuY29tcHV0ZURpZmYodG9rZW4pO1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0Ly8gYWZ0ZXIgYXdhaXQgdGhlIGVkaXRvciBtaWdodCBiZSBkaXNwb3NlZC5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoc2VsZWN0aW9ucykge1xuXHRcdFx0dGhpcy5fbGlzdC5zZXRGb2N1cyhzZWxlY3Rpb25zKTtcblx0XHR9XG5cdH1cblxuXHRzY2hlZHVsZU91dHB1dEhlaWdodEFjayhjZWxsSW5mbzogSURpZmZDZWxsSW5mbywgb3V0cHV0SWQ6IHN0cmluZywgaGVpZ2h0OiBudW1iZXIpIHtcblx0XHRjb25zdCBkaWZmRWxlbWVudCA9IGNlbGxJbmZvLmRpZmZFbGVtZW50O1xuXHRcdC8vIGNvbnN0IGFjdGl2ZVdlYnZpZXcgPSBkaWZmU2lkZSA9PT0gRGlmZlNpZGUuTW9kaWZpZWQgPyB0aGlzLl9tb2RpZmllZFdlYnZpZXcgOiB0aGlzLl9vcmlnaW5hbFdlYnZpZXc7XG5cdFx0bGV0IGRpZmZTaWRlID0gRGlmZlNpZGUuT3JpZ2luYWw7XG5cblx0XHRpZiAoZGlmZkVsZW1lbnQgaW5zdGFuY2VvZiBTaWRlQnlTaWRlRGlmZkVsZW1lbnRWaWV3TW9kZWwpIHtcblx0XHRcdGNvbnN0IGluZm8gPSBDZWxsVXJpLnBhcnNlKGNlbGxJbmZvLmNlbGxVcmkpO1xuXHRcdFx0aWYgKCFpbmZvKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0ZGlmZlNpZGUgPSBpbmZvLm5vdGVib29rLnRvU3RyaW5nKCkgPT09IHRoaXMuX21vZGVsPy5vcmlnaW5hbC5yZXNvdXJjZS50b1N0cmluZygpID8gRGlmZlNpZGUuT3JpZ2luYWwgOiBEaWZmU2lkZS5Nb2RpZmllZDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZGlmZlNpZGUgPSBkaWZmRWxlbWVudC50eXBlID09PSAnaW5zZXJ0JyA/IERpZmZTaWRlLk1vZGlmaWVkIDogRGlmZlNpZGUuT3JpZ2luYWw7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgd2VidmlldyA9IGRpZmZTaWRlID09PSBEaWZmU2lkZS5Nb2RpZmllZCA/IHRoaXMuX21vZGlmaWVkV2VidmlldyA6IHRoaXMuX29yaWdpbmFsV2VidmlldztcblxuXHRcdERPTS5zY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lKHRoaXMud2luZG93LCAoKSA9PiB7XG5cdFx0XHR3ZWJ2aWV3Py5hY2tIZWlnaHQoW3sgY2VsbElkOiBjZWxsSW5mby5jZWxsSWQsIG91dHB1dElkLCBoZWlnaHQgfV0pO1xuXHRcdH0sIDEwKTtcblx0fVxuXG5cdHByaXZhdGUgcGVuZGluZ0xheW91dHMgPSBuZXcgV2Vha01hcDxJRGlmZkVsZW1lbnRWaWV3TW9kZWxCYXNlLCBJRGlzcG9zYWJsZT4oKTtcblxuXG5cdGxheW91dE5vdGVib29rQ2VsbChjZWxsOiBJRGlmZkVsZW1lbnRWaWV3TW9kZWxCYXNlLCBoZWlnaHQ6IG51bWJlcikge1xuXHRcdGNvbnN0IHJlbGF5b3V0ID0gKGNlbGw6IElEaWZmRWxlbWVudFZpZXdNb2RlbEJhc2UsIGhlaWdodDogbnVtYmVyKSA9PiB7XG5cdFx0XHR0aGlzLl9saXN0LnVwZGF0ZUVsZW1lbnRIZWlnaHQyKGNlbGwsIGhlaWdodCk7XG5cdFx0fTtcblxuXHRcdGxldCBkaXNwb3NhYmxlID0gdGhpcy5wZW5kaW5nTGF5b3V0cy5nZXQoY2VsbCk7XG5cdFx0aWYgKGRpc3Bvc2FibGUpIHtcblx0XHRcdHRoaXMuX2xvY2FsU3RvcmUuZGVsZXRlKGRpc3Bvc2FibGUpO1xuXHRcdH1cblxuXHRcdGxldCByOiAoKSA9PiB2b2lkO1xuXHRcdGNvbnN0IGxheW91dERpc3Bvc2FibGUgPSBET00uc2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZSh0aGlzLndpbmRvdywgKCkgPT4ge1xuXHRcdFx0dGhpcy5wZW5kaW5nTGF5b3V0cy5kZWxldGUoY2VsbCk7XG5cblx0XHRcdHJlbGF5b3V0KGNlbGwsIGhlaWdodCk7XG5cdFx0XHRyKCk7XG5cdFx0fSk7XG5cdFx0ZGlzcG9zYWJsZSA9IHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRsYXlvdXREaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdHIoKTtcblx0XHR9KTtcblx0XHR0aGlzLl9sb2NhbFN0b3JlLmFkZChkaXNwb3NhYmxlKTtcblxuXHRcdHRoaXMucGVuZGluZ0xheW91dHMuc2V0KGNlbGwsIGRpc3Bvc2FibGUpO1xuXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4geyByID0gcmVzb2x2ZTsgfSk7XG5cdH1cblxuXHRzZXRTY3JvbGxUb3Aoc2Nyb2xsVG9wOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9saXN0LnNjcm9sbFRvcCA9IHNjcm9sbFRvcDtcblx0fVxuXG5cdHRyaWdnZXJTY3JvbGwoZXZlbnQ6IElNb3VzZVdoZWVsRXZlbnQpIHtcblx0XHR0aGlzLl9saXN0LnRyaWdnZXJTY3JvbGxGcm9tTW91c2VXaGVlbEV2ZW50KGV2ZW50KTtcblx0fVxuXG5cdGZpcnN0Q2hhbmdlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5ub3RlYm9va0RpZmZWaWV3TW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Ly8gZ28gdG8gdGhlIGZpcnN0IG9uZVxuXHRcdGNvbnN0IGN1cnJlbnRWaWV3TW9kZWxzID0gdGhpcy5ub3RlYm9va0RpZmZWaWV3TW9kZWwuaXRlbXM7XG5cdFx0Y29uc3QgaW5kZXggPSBjdXJyZW50Vmlld01vZGVscy5maW5kSW5kZXgodm0gPT4gdm0udHlwZSAhPT0gJ3VuY2hhbmdlZCcgJiYgdm0udHlwZSAhPT0gJ3VuY2hhbmdlZE1ldGFkYXRhJyAmJiB2bS50eXBlICE9PSAncGxhY2Vob2xkZXInKTtcblx0XHRpZiAoaW5kZXggPj0gMCkge1xuXHRcdFx0dGhpcy5fbGlzdC5zZXRGb2N1cyhbaW5kZXhdKTtcblx0XHRcdHRoaXMuX2xpc3QucmV2ZWFsKGluZGV4KTtcblx0XHR9XG5cdH1cblxuXHRsYXN0Q2hhbmdlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5ub3RlYm9va0RpZmZWaWV3TW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Ly8gZ28gdG8gdGhlIGZpcnN0IG9uZVxuXHRcdGNvbnN0IGN1cnJlbnRWaWV3TW9kZWxzID0gdGhpcy5ub3RlYm9va0RpZmZWaWV3TW9kZWwuaXRlbXM7XG5cdFx0Y29uc3QgaXRlbSA9IGN1cnJlbnRWaWV3TW9kZWxzLnNsaWNlKCkucmV2ZXJzZSgpLmZpbmQodm0gPT4gdm0udHlwZSAhPT0gJ3VuY2hhbmdlZCcgJiYgdm0udHlwZSAhPT0gJ3VuY2hhbmdlZE1ldGFkYXRhJyAmJiB2bS50eXBlICE9PSAncGxhY2Vob2xkZXInKTtcblx0XHRjb25zdCBpbmRleCA9IGl0ZW0gPyBjdXJyZW50Vmlld01vZGVscy5pbmRleE9mKGl0ZW0pIDogLTE7XG5cdFx0aWYgKGluZGV4ID49IDApIHtcblx0XHRcdHRoaXMuX2xpc3Quc2V0Rm9jdXMoW2luZGV4XSk7XG5cdFx0XHR0aGlzLl9saXN0LnJldmVhbChpbmRleCk7XG5cdFx0fVxuXHR9XG5cblx0cHJldmlvdXNDaGFuZ2UoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLm5vdGVib29rRGlmZlZpZXdNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRsZXQgY3VyckZvY3VzID0gdGhpcy5fbGlzdC5nZXRGb2N1cygpWzBdO1xuXG5cdFx0aWYgKGlzTmFOKGN1cnJGb2N1cykgfHwgY3VyckZvY3VzIDwgMCkge1xuXHRcdFx0Y3VyckZvY3VzID0gMDtcblx0XHR9XG5cblx0XHQvLyBmaW5kIHRoZSBpbmRleCBvZiBwcmV2aW91cyBjaGFuZ2Vcblx0XHRsZXQgcHJldkNoYW5nZUluZGV4ID0gY3VyckZvY3VzIC0gMTtcblx0XHRjb25zdCBjdXJyZW50Vmlld01vZGVscyA9IHRoaXMubm90ZWJvb2tEaWZmVmlld01vZGVsLml0ZW1zO1xuXHRcdHdoaWxlIChwcmV2Q2hhbmdlSW5kZXggPj0gMCkge1xuXHRcdFx0Y29uc3Qgdm0gPSBjdXJyZW50Vmlld01vZGVsc1twcmV2Q2hhbmdlSW5kZXhdO1xuXHRcdFx0aWYgKHZtLnR5cGUgIT09ICd1bmNoYW5nZWQnICYmIHZtLnR5cGUgIT09ICd1bmNoYW5nZWRNZXRhZGF0YScgJiYgdm0udHlwZSAhPT0gJ3BsYWNlaG9sZGVyJykge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0cHJldkNoYW5nZUluZGV4LS07XG5cdFx0fVxuXG5cdFx0aWYgKHByZXZDaGFuZ2VJbmRleCA+PSAwKSB7XG5cdFx0XHR0aGlzLl9saXN0LnNldEZvY3VzKFtwcmV2Q2hhbmdlSW5kZXhdKTtcblx0XHRcdHRoaXMuX2xpc3QucmV2ZWFsKHByZXZDaGFuZ2VJbmRleCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGdvIHRvIHRoZSBsYXN0IG9uZVxuXHRcdFx0Y29uc3QgaW5kZXggPSBmaW5kTGFzdElkeChjdXJyZW50Vmlld01vZGVscywgdm0gPT4gdm0udHlwZSAhPT0gJ3VuY2hhbmdlZCcgJiYgdm0udHlwZSAhPT0gJ3VuY2hhbmdlZE1ldGFkYXRhJyAmJiB2bS50eXBlICE9PSAncGxhY2Vob2xkZXInKTtcblx0XHRcdGlmIChpbmRleCA+PSAwKSB7XG5cdFx0XHRcdHRoaXMuX2xpc3Quc2V0Rm9jdXMoW2luZGV4XSk7XG5cdFx0XHRcdHRoaXMuX2xpc3QucmV2ZWFsKGluZGV4KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRuZXh0Q2hhbmdlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5ub3RlYm9va0RpZmZWaWV3TW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0bGV0IGN1cnJGb2N1cyA9IHRoaXMuX2xpc3QuZ2V0Rm9jdXMoKVswXTtcblxuXHRcdGlmIChpc05hTihjdXJyRm9jdXMpIHx8IGN1cnJGb2N1cyA8IDApIHtcblx0XHRcdGN1cnJGb2N1cyA9IDA7XG5cdFx0fVxuXG5cdFx0Ly8gZmluZCB0aGUgaW5kZXggb2YgbmV4dCBjaGFuZ2Vcblx0XHRsZXQgbmV4dENoYW5nZUluZGV4ID0gY3VyckZvY3VzICsgMTtcblx0XHRjb25zdCBjdXJyZW50Vmlld01vZGVscyA9IHRoaXMubm90ZWJvb2tEaWZmVmlld01vZGVsLml0ZW1zO1xuXHRcdHdoaWxlIChuZXh0Q2hhbmdlSW5kZXggPCBjdXJyZW50Vmlld01vZGVscy5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IHZtID0gY3VycmVudFZpZXdNb2RlbHNbbmV4dENoYW5nZUluZGV4XTtcblx0XHRcdGlmICh2bS50eXBlICE9PSAndW5jaGFuZ2VkJyAmJiB2bS50eXBlICE9PSAndW5jaGFuZ2VkTWV0YWRhdGEnICYmIHZtLnR5cGUgIT09ICdwbGFjZWhvbGRlcicpIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdG5leHRDaGFuZ2VJbmRleCsrO1xuXHRcdH1cblxuXHRcdGlmIChuZXh0Q2hhbmdlSW5kZXggPCBjdXJyZW50Vmlld01vZGVscy5sZW5ndGgpIHtcblx0XHRcdHRoaXMuX2xpc3Quc2V0Rm9jdXMoW25leHRDaGFuZ2VJbmRleF0pO1xuXHRcdFx0dGhpcy5fbGlzdC5yZXZlYWwobmV4dENoYW5nZUluZGV4KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gZ28gdG8gdGhlIGZpcnN0IG9uZVxuXHRcdFx0Y29uc3QgaW5kZXggPSBjdXJyZW50Vmlld01vZGVscy5maW5kSW5kZXgodm0gPT4gdm0udHlwZSAhPT0gJ3VuY2hhbmdlZCcgJiYgdm0udHlwZSAhPT0gJ3VuY2hhbmdlZE1ldGFkYXRhJyAmJiB2bS50eXBlICE9PSAncGxhY2Vob2xkZXInKTtcblx0XHRcdGlmIChpbmRleCA+PSAwKSB7XG5cdFx0XHRcdHRoaXMuX2xpc3Quc2V0Rm9jdXMoW2luZGV4XSk7XG5cdFx0XHRcdHRoaXMuX2xpc3QucmV2ZWFsKGluZGV4KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRjcmVhdGVPdXRwdXQoY2VsbERpZmZWaWV3TW9kZWw6IERpZmZFbGVtZW50Q2VsbFZpZXdNb2RlbEJhc2UsIGNlbGxWaWV3TW9kZWw6IERpZmZOZXN0ZWRDZWxsVmlld01vZGVsLCBvdXRwdXQ6IElJbnNldFJlbmRlck91dHB1dCwgZ2V0T2Zmc2V0OiAoKSA9PiBudW1iZXIsIGRpZmZTaWRlOiBEaWZmU2lkZSk6IHZvaWQge1xuXHRcdHRoaXMuX2luc2V0TW9kaWZ5UXVldWVCeU91dHB1dElkLnF1ZXVlKG91dHB1dC5zb3VyY2UubW9kZWwub3V0cHV0SWQgKyAoZGlmZlNpZGUgPT09IERpZmZTaWRlLk1vZGlmaWVkID8gJy1yaWdodCcgOiAnbGVmdCcpLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBhY3RpdmVXZWJ2aWV3ID0gZGlmZlNpZGUgPT09IERpZmZTaWRlLk1vZGlmaWVkID8gdGhpcy5fbW9kaWZpZWRXZWJ2aWV3IDogdGhpcy5fb3JpZ2luYWxXZWJ2aWV3O1xuXHRcdFx0aWYgKCFhY3RpdmVXZWJ2aWV3KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFhY3RpdmVXZWJ2aWV3Lmluc2V0TWFwcGluZy5oYXMob3V0cHV0LnNvdXJjZSkpIHtcblx0XHRcdFx0Y29uc3QgY2VsbFRvcCA9IHRoaXMuX2xpc3QuZ2V0Q2VsbFZpZXdTY3JvbGxUb3AoY2VsbERpZmZWaWV3TW9kZWwpO1xuXHRcdFx0XHRhd2FpdCBhY3RpdmVXZWJ2aWV3LmNyZWF0ZU91dHB1dCh7IGRpZmZFbGVtZW50OiBjZWxsRGlmZlZpZXdNb2RlbCwgY2VsbEhhbmRsZTogY2VsbFZpZXdNb2RlbC5oYW5kbGUsIGNlbGxJZDogY2VsbFZpZXdNb2RlbC5pZCwgY2VsbFVyaTogY2VsbFZpZXdNb2RlbC51cmkgfSwgb3V0cHV0LCBjZWxsVG9wLCBnZXRPZmZzZXQoKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBjZWxsVG9wID0gdGhpcy5fbGlzdC5nZXRDZWxsVmlld1Njcm9sbFRvcChjZWxsRGlmZlZpZXdNb2RlbCk7XG5cdFx0XHRcdGNvbnN0IG91dHB1dEluZGV4ID0gY2VsbFZpZXdNb2RlbC5vdXRwdXRzVmlld01vZGVscy5pbmRleE9mKG91dHB1dC5zb3VyY2UpO1xuXHRcdFx0XHRjb25zdCBvdXRwdXRPZmZzZXQgPSBjZWxsRGlmZlZpZXdNb2RlbC5nZXRPdXRwdXRPZmZzZXRJbkNlbGwoZGlmZlNpZGUsIG91dHB1dEluZGV4KTtcblx0XHRcdFx0YWN0aXZlV2Vidmlldy51cGRhdGVTY3JvbGxUb3BzKFt7XG5cdFx0XHRcdFx0Y2VsbDogY2VsbFZpZXdNb2RlbCxcblx0XHRcdFx0XHRvdXRwdXQ6IG91dHB1dC5zb3VyY2UsXG5cdFx0XHRcdFx0Y2VsbFRvcCxcblx0XHRcdFx0XHRvdXRwdXRPZmZzZXQsXG5cdFx0XHRcdFx0Zm9yY2VEaXNwbGF5OiB0cnVlXG5cdFx0XHRcdH1dLCBbXSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHR1cGRhdGVNYXJrdXBDZWxsSGVpZ2h0KCkge1xuXHRcdC8vIFRPRE9cblx0fVxuXG5cdGdldENlbGxCeUluZm8oY2VsbEluZm86IElEaWZmQ2VsbEluZm8pOiBJR2VuZXJpY0NlbGxWaWV3TW9kZWwge1xuXHRcdHJldHVybiBjZWxsSW5mby5kaWZmRWxlbWVudC5nZXRDZWxsQnlVcmkoY2VsbEluZm8uY2VsbFVyaSk7XG5cdH1cblxuXHRnZXRDZWxsQnlJZChjZWxsSWQ6IHN0cmluZyk6IElHZW5lcmljQ2VsbFZpZXdNb2RlbCB8IHVuZGVmaW5lZCB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdOb3QgaW1wbGVtZW50ZWQnKTtcblx0fVxuXG5cdHJlbW92ZUluc2V0KGNlbGxEaWZmVmlld01vZGVsOiBEaWZmRWxlbWVudENlbGxWaWV3TW9kZWxCYXNlLCBjZWxsVmlld01vZGVsOiBEaWZmTmVzdGVkQ2VsbFZpZXdNb2RlbCwgZGlzcGxheU91dHB1dDogSUNlbGxPdXRwdXRWaWV3TW9kZWwsIGRpZmZTaWRlOiBEaWZmU2lkZSkge1xuXHRcdHRoaXMuX2luc2V0TW9kaWZ5UXVldWVCeU91dHB1dElkLnF1ZXVlKGRpc3BsYXlPdXRwdXQubW9kZWwub3V0cHV0SWQgKyAoZGlmZlNpZGUgPT09IERpZmZTaWRlLk1vZGlmaWVkID8gJy1yaWdodCcgOiAnbGVmdCcpLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBhY3RpdmVXZWJ2aWV3ID0gZGlmZlNpZGUgPT09IERpZmZTaWRlLk1vZGlmaWVkID8gdGhpcy5fbW9kaWZpZWRXZWJ2aWV3IDogdGhpcy5fb3JpZ2luYWxXZWJ2aWV3O1xuXHRcdFx0aWYgKCFhY3RpdmVXZWJ2aWV3KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFhY3RpdmVXZWJ2aWV3Lmluc2V0TWFwcGluZy5oYXMoZGlzcGxheU91dHB1dCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRhY3RpdmVXZWJ2aWV3LnJlbW92ZUluc2V0cyhbZGlzcGxheU91dHB1dF0pO1xuXHRcdH0pO1xuXHR9XG5cblx0c2hvd0luc2V0KGNlbGxEaWZmVmlld01vZGVsOiBEaWZmRWxlbWVudENlbGxWaWV3TW9kZWxCYXNlLCBjZWxsVmlld01vZGVsOiBEaWZmTmVzdGVkQ2VsbFZpZXdNb2RlbCwgZGlzcGxheU91dHB1dDogSUNlbGxPdXRwdXRWaWV3TW9kZWwsIGRpZmZTaWRlOiBEaWZmU2lkZSkge1xuXHRcdHRoaXMuX2luc2V0TW9kaWZ5UXVldWVCeU91dHB1dElkLnF1ZXVlKGRpc3BsYXlPdXRwdXQubW9kZWwub3V0cHV0SWQgKyAoZGlmZlNpZGUgPT09IERpZmZTaWRlLk1vZGlmaWVkID8gJy1yaWdodCcgOiAnbGVmdCcpLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBhY3RpdmVXZWJ2aWV3ID0gZGlmZlNpZGUgPT09IERpZmZTaWRlLk1vZGlmaWVkID8gdGhpcy5fbW9kaWZpZWRXZWJ2aWV3IDogdGhpcy5fb3JpZ2luYWxXZWJ2aWV3O1xuXHRcdFx0aWYgKCFhY3RpdmVXZWJ2aWV3KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFhY3RpdmVXZWJ2aWV3Lmluc2V0TWFwcGluZy5oYXMoZGlzcGxheU91dHB1dCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjZWxsVG9wID0gdGhpcy5fbGlzdC5nZXRDZWxsVmlld1Njcm9sbFRvcChjZWxsRGlmZlZpZXdNb2RlbCk7XG5cdFx0XHRjb25zdCBvdXRwdXRJbmRleCA9IGNlbGxWaWV3TW9kZWwub3V0cHV0c1ZpZXdNb2RlbHMuaW5kZXhPZihkaXNwbGF5T3V0cHV0KTtcblx0XHRcdGNvbnN0IG91dHB1dE9mZnNldCA9IGNlbGxEaWZmVmlld01vZGVsLmdldE91dHB1dE9mZnNldEluQ2VsbChkaWZmU2lkZSwgb3V0cHV0SW5kZXgpO1xuXHRcdFx0YWN0aXZlV2Vidmlldy51cGRhdGVTY3JvbGxUb3BzKFt7XG5cdFx0XHRcdGNlbGw6IGNlbGxWaWV3TW9kZWwsXG5cdFx0XHRcdG91dHB1dDogZGlzcGxheU91dHB1dCxcblx0XHRcdFx0Y2VsbFRvcCxcblx0XHRcdFx0b3V0cHV0T2Zmc2V0LFxuXHRcdFx0XHRmb3JjZURpc3BsYXk6IHRydWUsXG5cdFx0XHR9XSwgW10pO1xuXHRcdH0pO1xuXHR9XG5cblx0aGlkZUluc2V0KGNlbGxEaWZmVmlld01vZGVsOiBEaWZmRWxlbWVudENlbGxWaWV3TW9kZWxCYXNlLCBjZWxsVmlld01vZGVsOiBEaWZmTmVzdGVkQ2VsbFZpZXdNb2RlbCwgb3V0cHV0OiBJQ2VsbE91dHB1dFZpZXdNb2RlbCkge1xuXHRcdHRoaXMuX21vZGlmaWVkV2Vidmlldz8uaGlkZUluc2V0KG91dHB1dCk7XG5cdFx0dGhpcy5fb3JpZ2luYWxXZWJ2aWV3Py5oaWRlSW5zZXQob3V0cHV0KTtcblx0fVxuXG5cdC8vIHByaXZhdGUgYXN5bmMgX3Jlc29sdmVXZWJ2aWV3KHJpZ2h0RWRpdG9yOiBib29sZWFuKTogUHJvbWlzZTxCYWNrTGF5ZXJXZWJWaWV3IHwgbnVsbD4ge1xuXHQvLyBcdGlmIChyaWdodEVkaXRvcikge1xuXG5cdC8vIFx0fVxuXHQvLyB9XG5cblx0Z2V0RG9tTm9kZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fcm9vdEVsZW1lbnQ7XG5cdH1cblxuXHRnZXRPdmVyZmxvd0NvbnRhaW5lckRvbU5vZGUoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLl9vdmVyZmxvd0NvbnRhaW5lcjtcblx0fVxuXG5cdG92ZXJyaWRlIGdldENvbnRyb2woKTogSU5vdGVib29rVGV4dERpZmZFZGl0b3IgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0b3ZlcnJpZGUgY2xlYXJJbnB1dCgpOiB2b2lkIHtcblx0XHR0aGlzLmlubGluZURpZmZXaWRnZXQ/LmhpZGUoKTtcblxuXHRcdHN1cGVyLmNsZWFySW5wdXQoKTtcblxuXHRcdHRoaXMuX21vZGlmaWVkUmVzb3VyY2VEaXNwb3NhYmxlU3RvcmUuY2xlYXIoKTtcblx0XHR0aGlzLl9saXN0Py5zcGxpY2UoMCwgdGhpcy5fbGlzdD8ubGVuZ3RoIHx8IDApO1xuXHRcdHRoaXMuX21vZGVsID0gbnVsbDtcblx0XHR0aGlzLm5vdGVib29rRGlmZlZpZXdNb2RlbD8uZGlzcG9zZSgpO1xuXHRcdHRoaXMubm90ZWJvb2tEaWZmVmlld01vZGVsID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0ZGVsdGFDZWxsT3V0cHV0Q29udGFpbmVyQ2xhc3NOYW1lcyhkaWZmU2lkZTogRGlmZlNpZGUsIGNlbGxJZDogc3RyaW5nLCBhZGRlZDogc3RyaW5nW10sIHJlbW92ZWQ6IHN0cmluZ1tdKSB7XG5cdFx0aWYgKGRpZmZTaWRlID09PSBEaWZmU2lkZS5PcmlnaW5hbCkge1xuXHRcdFx0dGhpcy5fb3JpZ2luYWxXZWJ2aWV3Py5kZWx0YUNlbGxPdXRwdXRDb250YWluZXJDbGFzc05hbWVzKGNlbGxJZCwgYWRkZWQsIHJlbW92ZWQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9tb2RpZmllZFdlYnZpZXc/LmRlbHRhQ2VsbE91dHB1dENvbnRhaW5lckNsYXNzTmFtZXMoY2VsbElkLCBhZGRlZCwgcmVtb3ZlZCk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0TGF5b3V0SW5mbygpOiBOb3RlYm9va0xheW91dEluZm8ge1xuXHRcdGlmICghdGhpcy5fbGlzdCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdFZGl0b3IgaXMgbm90IGluaXRhbGl6ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHdpZHRoOiB0aGlzLl9kaW1lbnNpb24hLndpZHRoLFxuXHRcdFx0aGVpZ2h0OiB0aGlzLl9kaW1lbnNpb24hLmhlaWdodCxcblx0XHRcdGZvbnRJbmZvOiB0aGlzLmZvbnRJbmZvLFxuXHRcdFx0c2Nyb2xsSGVpZ2h0OiB0aGlzLl9saXN0Py5nZXRTY3JvbGxIZWlnaHQoKSA/PyAwLFxuXHRcdFx0c3RpY2t5SGVpZ2h0OiAwLFxuXHRcdH07XG5cdH1cblxuXHRsYXlvdXQoZGltZW5zaW9uOiBET00uRGltZW5zaW9uLCBwb3NpdGlvbjogRE9NLklEb21Qb3NpdGlvbik6IHZvaWQge1xuXHRcdHRoaXMuX3Jvb3RFbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ21pZC13aWR0aCcsIGRpbWVuc2lvbi53aWR0aCA8IDEwMDAgJiYgZGltZW5zaW9uLndpZHRoID49IDYwMCk7XG5cdFx0dGhpcy5fcm9vdEVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnbmFycm93LXdpZHRoJywgZGltZW5zaW9uLndpZHRoIDwgNjAwKTtcblx0XHRjb25zdCBvdmVydmlld1J1bGVyRW5hYmxlZCA9IHRoaXMuaXNPdmVydmlld1J1bGVyRW5hYmxlZCgpO1xuXHRcdHRoaXMuX2RpbWVuc2lvbiA9IGRpbWVuc2lvbi53aXRoKGRpbWVuc2lvbi53aWR0aCAtIChvdmVydmlld1J1bGVyRW5hYmxlZCA/IE5vdGVib29rVGV4dERpZmZFZGl0b3IuRU5USVJFX0RJRkZfT1ZFUlZJRVdfV0lEVEggOiAwKSk7XG5cblx0XHR0aGlzLl9saXN0Vmlld0NvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHtkaW1lbnNpb24uaGVpZ2h0fXB4YDtcblx0XHR0aGlzLl9saXN0Vmlld0NvbnRhaW5lci5zdHlsZS53aWR0aCA9IGAke3RoaXMuX2RpbWVuc2lvbi53aWR0aH1weGA7XG5cblx0XHRpZiAodGhpcy5faW5saW5lVmlldykge1xuXHRcdFx0dGhpcy5fbGlzdFZpZXdDb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRcdHRoaXMuaW5saW5lRGlmZldpZGdldD8uc2V0TGF5b3V0KGRpbWVuc2lvbiwgcG9zaXRpb24pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmlubGluZURpZmZXaWRnZXQ/LmhpZGUoKTtcblx0XHRcdHRoaXMuX2xpc3RWaWV3Q29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXHRcdFx0dGhpcy5fbGlzdD8ubGF5b3V0KHRoaXMuX2RpbWVuc2lvbi5oZWlnaHQsIHRoaXMuX2RpbWVuc2lvbi53aWR0aCk7XG5cblx0XHRcdGlmICh0aGlzLl9tb2RpZmllZFdlYnZpZXcpIHtcblx0XHRcdFx0dGhpcy5fbW9kaWZpZWRXZWJ2aWV3LmVsZW1lbnQuc3R5bGUud2lkdGggPSBgY2FsYyg1MCUgLSAxNnB4KWA7XG5cdFx0XHRcdHRoaXMuX21vZGlmaWVkV2Vidmlldy5lbGVtZW50LnN0eWxlLmxlZnQgPSBgY2FsYyg1MCUpYDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuX29yaWdpbmFsV2Vidmlldykge1xuXHRcdFx0XHR0aGlzLl9vcmlnaW5hbFdlYnZpZXcuZWxlbWVudC5zdHlsZS53aWR0aCA9IGBjYWxjKDUwJSAtIDE2cHgpYDtcblx0XHRcdFx0dGhpcy5fb3JpZ2luYWxXZWJ2aWV3LmVsZW1lbnQuc3R5bGUubGVmdCA9IGAxNnB4YDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuX3dlYnZpZXdUcmFuc3BhcmVudENvdmVyKSB7XG5cdFx0XHRcdHRoaXMuX3dlYnZpZXdUcmFuc3BhcmVudENvdmVyLnN0eWxlLmhlaWdodCA9IGAke3RoaXMuX2RpbWVuc2lvbi5oZWlnaHR9cHhgO1xuXHRcdFx0XHR0aGlzLl93ZWJ2aWV3VHJhbnNwYXJlbnRDb3Zlci5zdHlsZS53aWR0aCA9IGAke3RoaXMuX2RpbWVuc2lvbi53aWR0aH1weGA7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChvdmVydmlld1J1bGVyRW5hYmxlZCkge1xuXHRcdFx0XHR0aGlzLl9vdmVydmlld1J1bGVyLmxheW91dCgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX2xhc3RMYXlvdXRQcm9wZXJ0aWVzID0geyBkaW1lbnNpb24sIHBvc2l0aW9uIH07XG5cblx0XHR0aGlzLl9ldmVudERpc3BhdGNoZXI/LmVtaXQoW25ldyBOb3RlYm9va0RpZmZMYXlvdXRDaGFuZ2VkRXZlbnQoeyB3aWR0aDogdHJ1ZSwgZm9udEluZm86IHRydWUgfSwgdGhpcy5nZXRMYXlvdXRJbmZvKCkpXSk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdHRoaXMuX2lzRGlzcG9zZWQgPSB0cnVlO1xuXHRcdHRoaXMuX2xheW91dENhbmNlbGxhdGlvblRva2VuU291cmNlPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fZGV0YWNoTW9kZWwoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cblxucmVnaXN0ZXJaSW5kZXgoWkluZGV4LkJhc2UsIDEwLCAnbm90ZWJvb2stZGlmZi12aWV3LXZpZXdwb3J0LXNsaWRlcicpO1xuXG5yZWdpc3RlclRoZW1pbmdQYXJ0aWNpcGFudCgodGhlbWUsIGNvbGxlY3RvcikgPT4ge1xuXHRjb25zdCBkaWZmRGlhZ29uYWxGaWxsQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihkaWZmRGlhZ29uYWxGaWxsKTtcblx0Y29sbGVjdG9yLmFkZFJ1bGUoYFxuXHQubm90ZWJvb2stdGV4dC1kaWZmLWVkaXRvciAuZGlhZ29uYWwtZmlsbCB7XG5cdFx0YmFja2dyb3VuZC1pbWFnZTogbGluZWFyLWdyYWRpZW50KFxuXHRcdFx0LTQ1ZGVnLFxuXHRcdFx0JHtkaWZmRGlhZ29uYWxGaWxsQ29sb3J9IDEyLjUlLFxuXHRcdFx0IzAwMDAgMTIuNSUsICMwMDAwIDUwJSxcblx0XHRcdCR7ZGlmZkRpYWdvbmFsRmlsbENvbG9yfSA1MCUsICR7ZGlmZkRpYWdvbmFsRmlsbENvbG9yfSA2Mi41JSxcblx0XHRcdCMwMDAwIDYyLjUlLCAjMDAwMCAxMDAlXG5cdFx0KTtcblx0XHRiYWNrZ3JvdW5kLXNpemU6IDhweCA4cHg7XG5cdH1cblx0YCk7XG5cblx0Y29sbGVjdG9yLmFkZFJ1bGUoYC5ub3RlYm9vay10ZXh0LWRpZmYtZWRpdG9yIC5jZWxsLWJvZHkgeyBtYXJnaW46ICR7RElGRl9DRUxMX01BUkdJTn1weDsgfWApO1xuXHQvLyBXZSBkbyBub3Qgd2FudCBhIGxlZnQgbWFyZ2luLCBhcyB3ZSBhZGQgYW4gb3ZlcmxheSBmb3IgZXhwYW5pbmQgdGhlIGNvbGxhcHNlZC9oaWRkZW4gY2VsbHMuXG5cdGNvbGxlY3Rvci5hZGRSdWxlKGAubm90ZWJvb2stdGV4dC1kaWZmLWVkaXRvciAuY2VsbC1wbGFjZWhvbGRlci1ib2R5IHsgbWFyZ2luOiAke0RJRkZfQ0VMTF9NQVJHSU59cHggMDsgfWApO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlB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
