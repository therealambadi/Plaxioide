import { Emitter } from "../../../../../base/common/event.js";
import { hash } from "../../../../../base/common/hash.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { DiffEditorWidget } from "../../../../../editor/browser/widget/diffEditor/diffEditorWidget.js";
import { getEditorPadding } from "./diffCellEditorOptions.js";
import { DiffNestedCellViewModel } from "./diffNestedCellViewModel.js";
import { NotebookDiffViewEventType } from "./eventDispatcher.js";
import { DIFF_CELL_MARGIN, DiffSide } from "./notebookDiffEditorBrowser.js";
import { CellLayoutState } from "../notebookBrowser.js";
import { getFormattedMetadataJSON } from "../../common/model/notebookCellTextModel.js";
import { CellUri } from "../../common/notebookCommon.js";
import { Schemas } from "../../../../../base/common/network.js";
import { NotebookDocumentMetadataTextModel } from "../../common/model/notebookMetadataTextModel.js";
const PropertyHeaderHeight = 25;
const HeightOfHiddenLinesRegionInDiffEditor = 24;
const DefaultLineHeight = 17;
var PropertyFoldingState = /* @__PURE__ */ ((PropertyFoldingState2) => {
  PropertyFoldingState2[PropertyFoldingState2["Expanded"] = 0] = "Expanded";
  PropertyFoldingState2[PropertyFoldingState2["Collapsed"] = 1] = "Collapsed";
  return PropertyFoldingState2;
})(PropertyFoldingState || {});
const OUTPUT_EDITOR_HEIGHT_MAGIC = 1440;
class DiffElementViewModelBase extends Disposable {
  constructor(mainDocumentTextModel, editorEventDispatcher, initData) {
    super();
    this.mainDocumentTextModel = mainDocumentTextModel;
    this.editorEventDispatcher = editorEventDispatcher;
    this.initData = initData;
    this._layoutInfoEmitter = this._register(new Emitter());
    this.onDidLayoutChange = this._layoutInfoEmitter.event;
    this._register(this.editorEventDispatcher.onDidChangeLayout((e) => this._layoutInfoEmitter.fire({ outerWidth: true })));
  }
}
class DiffElementPlaceholderViewModel extends DiffElementViewModelBase {
  constructor(mainDocumentTextModel, editorEventDispatcher, initData) {
    super(mainDocumentTextModel, editorEventDispatcher, initData);
    this.type = "placeholder";
    this.hiddenCells = [];
    this._unfoldHiddenCells = this._register(new Emitter());
    this.onUnfoldHiddenCells = this._unfoldHiddenCells.event;
    this.renderOutput = false;
  }
  get totalHeight() {
    return 24 + 2 * DIFF_CELL_MARGIN;
  }
  getHeight(_) {
    return this.totalHeight;
  }
  layoutChange() {
  }
  showHiddenCells() {
    this._unfoldHiddenCells.fire();
  }
}
class NotebookDocumentMetadataViewModel extends DiffElementViewModelBase {
  constructor(originalDocumentTextModel, modifiedDocumentTextModel, type, editorEventDispatcher, initData, notebookService, editorHeightCalculator) {
    super(originalDocumentTextModel, editorEventDispatcher, initData);
    this.originalDocumentTextModel = originalDocumentTextModel;
    this.modifiedDocumentTextModel = modifiedDocumentTextModel;
    this.type = type;
    this.editorHeightCalculator = editorHeightCalculator;
    this.renderOutput = false;
    this._sourceEditorViewState = null;
    const cellStatusHeight = PropertyHeaderHeight;
    this._layoutInfo = {
      width: 0,
      editorHeight: 0,
      editorMargin: 0,
      metadataHeight: 0,
      cellStatusHeight,
      metadataStatusHeight: 0,
      rawOutputHeight: 0,
      outputTotalHeight: 0,
      outputStatusHeight: 0,
      outputMetadataHeight: 0,
      bodyMargin: 32,
      totalHeight: 82 + cellStatusHeight + 0,
      layoutState: CellLayoutState.Uninitialized
    };
    this.cellFoldingState = type === "modifiedMetadata" ? 0 /* Expanded */ : 1 /* Collapsed */;
    this.originalMetadata = this._register(new NotebookDocumentMetadataTextModel(originalDocumentTextModel));
    this.modifiedMetadata = this._register(new NotebookDocumentMetadataTextModel(modifiedDocumentTextModel));
  }
  set editorHeight(height) {
    this._layout({ editorHeight: height });
  }
  get editorHeight() {
    throw new Error("Use Cell.layoutInfo.editorHeight");
  }
  set editorMargin(margin) {
    this._layout({ editorMargin: margin });
  }
  get editorMargin() {
    throw new Error("Use Cell.layoutInfo.editorMargin");
  }
  get layoutInfo() {
    return this._layoutInfo;
  }
  get totalHeight() {
    return this.layoutInfo.totalHeight;
  }
  async computeHeights() {
    if (this.type === "unchangedMetadata") {
      this.editorHeight = this.editorHeightCalculator.computeHeightFromLines(this.originalMetadata.textBuffer.getLineCount());
    } else {
      const original = this.originalMetadata.uri;
      const modified = this.modifiedMetadata.uri;
      this.editorHeight = await this.editorHeightCalculator.diffAndComputeHeight(original, modified);
    }
  }
  layoutChange() {
    this._layout({ recomputeOutput: true });
  }
  _layout(delta) {
    const width = delta.width !== void 0 ? delta.width : this._layoutInfo.width;
    const editorHeight = delta.editorHeight !== void 0 ? delta.editorHeight : this._layoutInfo.editorHeight;
    const editorMargin = delta.editorMargin !== void 0 ? delta.editorMargin : this._layoutInfo.editorMargin;
    const cellStatusHeight = delta.cellStatusHeight !== void 0 ? delta.cellStatusHeight : this._layoutInfo.cellStatusHeight;
    const bodyMargin = delta.bodyMargin !== void 0 ? delta.bodyMargin : this._layoutInfo.bodyMargin;
    const totalHeight = editorHeight + editorMargin + cellStatusHeight + bodyMargin;
    const newLayout = {
      width,
      editorHeight,
      editorMargin,
      metadataHeight: 0,
      cellStatusHeight,
      metadataStatusHeight: 0,
      outputTotalHeight: 0,
      outputStatusHeight: 0,
      bodyMargin,
      rawOutputHeight: 0,
      outputMetadataHeight: 0,
      totalHeight,
      layoutState: CellLayoutState.Measured
    };
    let somethingChanged = false;
    const changeEvent = {};
    if (newLayout.width !== this._layoutInfo.width) {
      changeEvent.width = true;
      somethingChanged = true;
    }
    if (newLayout.editorHeight !== this._layoutInfo.editorHeight) {
      changeEvent.editorHeight = true;
      somethingChanged = true;
    }
    if (newLayout.editorMargin !== this._layoutInfo.editorMargin) {
      changeEvent.editorMargin = true;
      somethingChanged = true;
    }
    if (newLayout.cellStatusHeight !== this._layoutInfo.cellStatusHeight) {
      changeEvent.cellStatusHeight = true;
      somethingChanged = true;
    }
    if (newLayout.bodyMargin !== this._layoutInfo.bodyMargin) {
      changeEvent.bodyMargin = true;
      somethingChanged = true;
    }
    if (newLayout.totalHeight !== this._layoutInfo.totalHeight) {
      changeEvent.totalHeight = true;
      somethingChanged = true;
    }
    if (somethingChanged) {
      this._layoutInfo = newLayout;
      this._fireLayoutChangeEvent(changeEvent);
    }
  }
  getHeight(lineHeight) {
    if (this._layoutInfo.layoutState === CellLayoutState.Uninitialized) {
      const editorHeight = this.cellFoldingState === 1 /* Collapsed */ ? 0 : this.computeInputEditorHeight(lineHeight);
      return this._computeTotalHeight(editorHeight);
    } else {
      return this._layoutInfo.totalHeight;
    }
  }
  _computeTotalHeight(editorHeight) {
    const totalHeight = editorHeight + this._layoutInfo.editorMargin + this._layoutInfo.metadataHeight + this._layoutInfo.cellStatusHeight + this._layoutInfo.metadataStatusHeight + this._layoutInfo.outputTotalHeight + this._layoutInfo.outputStatusHeight + this._layoutInfo.outputMetadataHeight + this._layoutInfo.bodyMargin;
    return totalHeight;
  }
  computeInputEditorHeight(_lineHeight) {
    return this.editorHeightCalculator.computeHeightFromLines(Math.max(this.originalMetadata.textBuffer.getLineCount(), this.modifiedMetadata.textBuffer.getLineCount()));
  }
  _fireLayoutChangeEvent(state) {
    this._layoutInfoEmitter.fire(state);
    this.editorEventDispatcher.emit([{ type: NotebookDiffViewEventType.CellLayoutChanged, source: this._layoutInfo }]);
  }
  getComputedCellContainerWidth(layoutInfo, diffEditor, fullWidth) {
    if (fullWidth) {
      return layoutInfo.width - 2 * DIFF_CELL_MARGIN + (diffEditor ? DiffEditorWidget.ENTIRE_DIFF_OVERVIEW_WIDTH : 0) - 2;
    }
    return (layoutInfo.width - 2 * DIFF_CELL_MARGIN + (diffEditor ? DiffEditorWidget.ENTIRE_DIFF_OVERVIEW_WIDTH : 0)) / 2 - 18 - 2;
  }
  getSourceEditorViewState() {
    return this._sourceEditorViewState;
  }
  saveSpirceEditorViewState(viewState) {
    this._sourceEditorViewState = viewState;
  }
}
class DiffElementCellViewModelBase extends DiffElementViewModelBase {
  constructor(mainDocumentTextModel, original, modified, type, editorEventDispatcher, initData, notebookService, index, configurationService, diffEditorHeightCalculator) {
    super(mainDocumentTextModel, editorEventDispatcher, initData);
    this.type = type;
    this.index = index;
    this.configurationService = configurationService;
    this.diffEditorHeightCalculator = diffEditorHeightCalculator;
    this._stateChangeEmitter = this._register(new Emitter());
    this.onDidStateChange = this._stateChangeEmitter.event;
    this._hideUnchangedCells = this._register(new Emitter());
    this.onHideUnchangedCells = this._hideUnchangedCells.event;
    this._renderOutput = true;
    this._sourceEditorViewState = null;
    this._outputEditorViewState = null;
    this._metadataEditorViewState = null;
    this.original = original ? this._register(new DiffNestedCellViewModel(original, notebookService)) : void 0;
    this.modified = modified ? this._register(new DiffNestedCellViewModel(modified, notebookService)) : void 0;
    const editorHeight = this._estimateEditorHeight(initData.fontInfo);
    const cellStatusHeight = PropertyHeaderHeight;
    this._layoutInfo = {
      width: 0,
      editorHeight,
      editorMargin: 0,
      metadataHeight: 0,
      cellStatusHeight,
      metadataStatusHeight: this.ignoreMetadata ? 0 : PropertyHeaderHeight,
      rawOutputHeight: 0,
      outputTotalHeight: 0,
      outputStatusHeight: this.ignoreOutputs ? 0 : PropertyHeaderHeight,
      outputMetadataHeight: 0,
      bodyMargin: 32,
      totalHeight: 82 + cellStatusHeight + editorHeight,
      layoutState: CellLayoutState.Uninitialized
    };
    this.cellFoldingState = modified?.getTextBufferHash() !== original?.getTextBufferHash() ? 0 /* Expanded */ : 1 /* Collapsed */;
    this.metadataFoldingState = 1 /* Collapsed */;
    this.outputFoldingState = 1 /* Collapsed */;
  }
  hideUnchangedCells() {
    this._hideUnchangedCells.fire();
  }
  set rawOutputHeight(height) {
    this._layout({ rawOutputHeight: Math.min(OUTPUT_EDITOR_HEIGHT_MAGIC, height) });
  }
  get rawOutputHeight() {
    throw new Error("Use Cell.layoutInfo.rawOutputHeight");
  }
  set outputStatusHeight(height) {
    this._layout({ outputStatusHeight: height });
  }
  get outputStatusHeight() {
    throw new Error("Use Cell.layoutInfo.outputStatusHeight");
  }
  set outputMetadataHeight(height) {
    this._layout({ outputMetadataHeight: height });
  }
  get outputMetadataHeight() {
    throw new Error("Use Cell.layoutInfo.outputStatusHeight");
  }
  set editorHeight(height) {
    this._layout({ editorHeight: height });
  }
  get editorHeight() {
    throw new Error("Use Cell.layoutInfo.editorHeight");
  }
  set editorMargin(margin) {
    this._layout({ editorMargin: margin });
  }
  get editorMargin() {
    throw new Error("Use Cell.layoutInfo.editorMargin");
  }
  set metadataStatusHeight(height) {
    this._layout({ metadataStatusHeight: height });
  }
  get metadataStatusHeight() {
    throw new Error("Use Cell.layoutInfo.outputStatusHeight");
  }
  set metadataHeight(height) {
    this._layout({ metadataHeight: height });
  }
  get metadataHeight() {
    throw new Error("Use Cell.layoutInfo.metadataHeight");
  }
  set renderOutput(value) {
    this._renderOutput = value;
    this._layout({ recomputeOutput: true });
    this._stateChangeEmitter.fire({ renderOutput: this._renderOutput });
  }
  get renderOutput() {
    return this._renderOutput;
  }
  get layoutInfo() {
    return this._layoutInfo;
  }
  get totalHeight() {
    return this.layoutInfo.totalHeight;
  }
  get ignoreOutputs() {
    return this.configurationService.getValue("notebook.diff.ignoreOutputs") || !!this.mainDocumentTextModel?.transientOptions.transientOutputs;
  }
  get ignoreMetadata() {
    return this.configurationService.getValue("notebook.diff.ignoreMetadata");
  }
  layoutChange() {
    this._layout({ recomputeOutput: true });
  }
  _estimateEditorHeight(fontInfo) {
    const lineHeight = fontInfo?.lineHeight ?? 17;
    switch (this.type) {
      case "unchanged":
      case "insert": {
        const lineCount = this.modified.textModel.textBuffer.getLineCount();
        const editorHeight = lineCount * lineHeight + getEditorPadding(lineCount).top + getEditorPadding(lineCount).bottom;
        return editorHeight;
      }
      case "delete":
      case "modified": {
        const lineCount = this.original.textModel.textBuffer.getLineCount();
        const editorHeight = lineCount * lineHeight + getEditorPadding(lineCount).top + getEditorPadding(lineCount).bottom;
        return editorHeight;
      }
    }
  }
  _layout(delta) {
    const width = delta.width !== void 0 ? delta.width : this._layoutInfo.width;
    const editorHeight = delta.editorHeight !== void 0 ? delta.editorHeight : this._layoutInfo.editorHeight;
    const editorMargin = delta.editorMargin !== void 0 ? delta.editorMargin : this._layoutInfo.editorMargin;
    const metadataHeight = delta.metadataHeight !== void 0 ? delta.metadataHeight : this._layoutInfo.metadataHeight;
    const cellStatusHeight = delta.cellStatusHeight !== void 0 ? delta.cellStatusHeight : this._layoutInfo.cellStatusHeight;
    const metadataStatusHeight = delta.metadataStatusHeight !== void 0 ? delta.metadataStatusHeight : this._layoutInfo.metadataStatusHeight;
    const rawOutputHeight = delta.rawOutputHeight !== void 0 ? delta.rawOutputHeight : this._layoutInfo.rawOutputHeight;
    const outputStatusHeight = delta.outputStatusHeight !== void 0 ? delta.outputStatusHeight : this._layoutInfo.outputStatusHeight;
    const bodyMargin = delta.bodyMargin !== void 0 ? delta.bodyMargin : this._layoutInfo.bodyMargin;
    const outputMetadataHeight = delta.outputMetadataHeight !== void 0 ? delta.outputMetadataHeight : this._layoutInfo.outputMetadataHeight;
    const outputHeight = this.ignoreOutputs ? 0 : delta.recomputeOutput || delta.rawOutputHeight !== void 0 || delta.outputMetadataHeight !== void 0 ? this._getOutputTotalHeight(rawOutputHeight, outputMetadataHeight) : this._layoutInfo.outputTotalHeight;
    const totalHeight = editorHeight + editorMargin + cellStatusHeight + metadataHeight + metadataStatusHeight + outputHeight + outputStatusHeight + bodyMargin;
    const newLayout = {
      width,
      editorHeight,
      editorMargin,
      metadataHeight,
      cellStatusHeight,
      metadataStatusHeight,
      outputTotalHeight: outputHeight,
      outputStatusHeight,
      bodyMargin,
      rawOutputHeight,
      outputMetadataHeight,
      totalHeight,
      layoutState: CellLayoutState.Measured
    };
    let somethingChanged = false;
    const changeEvent = {};
    if (newLayout.width !== this._layoutInfo.width) {
      changeEvent.width = true;
      somethingChanged = true;
    }
    if (newLayout.editorHeight !== this._layoutInfo.editorHeight) {
      changeEvent.editorHeight = true;
      somethingChanged = true;
    }
    if (newLayout.editorMargin !== this._layoutInfo.editorMargin) {
      changeEvent.editorMargin = true;
      somethingChanged = true;
    }
    if (newLayout.metadataHeight !== this._layoutInfo.metadataHeight) {
      changeEvent.metadataHeight = true;
      somethingChanged = true;
    }
    if (newLayout.cellStatusHeight !== this._layoutInfo.cellStatusHeight) {
      changeEvent.cellStatusHeight = true;
      somethingChanged = true;
    }
    if (newLayout.metadataStatusHeight !== this._layoutInfo.metadataStatusHeight) {
      changeEvent.metadataStatusHeight = true;
      somethingChanged = true;
    }
    if (newLayout.outputTotalHeight !== this._layoutInfo.outputTotalHeight) {
      changeEvent.outputTotalHeight = true;
      somethingChanged = true;
    }
    if (newLayout.outputStatusHeight !== this._layoutInfo.outputStatusHeight) {
      changeEvent.outputStatusHeight = true;
      somethingChanged = true;
    }
    if (newLayout.bodyMargin !== this._layoutInfo.bodyMargin) {
      changeEvent.bodyMargin = true;
      somethingChanged = true;
    }
    if (newLayout.outputMetadataHeight !== this._layoutInfo.outputMetadataHeight) {
      changeEvent.outputMetadataHeight = true;
      somethingChanged = true;
    }
    if (newLayout.totalHeight !== this._layoutInfo.totalHeight) {
      changeEvent.totalHeight = true;
      somethingChanged = true;
    }
    if (somethingChanged) {
      this._layoutInfo = newLayout;
      this._fireLayoutChangeEvent(changeEvent);
    }
  }
  getHeight(lineHeight) {
    if (this._layoutInfo.layoutState === CellLayoutState.Uninitialized) {
      const editorHeight = this.cellFoldingState === 1 /* Collapsed */ ? 0 : this.computeInputEditorHeight(lineHeight);
      return this._computeTotalHeight(editorHeight);
    } else {
      return this._layoutInfo.totalHeight;
    }
  }
  _computeTotalHeight(editorHeight) {
    const totalHeight = editorHeight + this._layoutInfo.editorMargin + this._layoutInfo.metadataHeight + this._layoutInfo.cellStatusHeight + this._layoutInfo.metadataStatusHeight + this._layoutInfo.outputTotalHeight + this._layoutInfo.outputStatusHeight + this._layoutInfo.outputMetadataHeight + this._layoutInfo.bodyMargin;
    return totalHeight;
  }
  computeInputEditorHeight(lineHeight) {
    const lineCount = Math.max(this.original?.textModel.textBuffer.getLineCount() ?? 1, this.modified?.textModel.textBuffer.getLineCount() ?? 1);
    return this.diffEditorHeightCalculator.computeHeightFromLines(lineCount);
  }
  _getOutputTotalHeight(rawOutputHeight, metadataHeight) {
    if (this.outputFoldingState === 1 /* Collapsed */) {
      return 0;
    }
    if (this.renderOutput) {
      if (this.isOutputEmpty()) {
        return 24;
      }
      return this.getRichOutputTotalHeight() + metadataHeight;
    } else {
      return rawOutputHeight;
    }
  }
  _fireLayoutChangeEvent(state) {
    this._layoutInfoEmitter.fire(state);
    this.editorEventDispatcher.emit([{ type: NotebookDiffViewEventType.CellLayoutChanged, source: this._layoutInfo }]);
  }
  getComputedCellContainerWidth(layoutInfo, diffEditor, fullWidth) {
    if (fullWidth) {
      return layoutInfo.width - 2 * DIFF_CELL_MARGIN + (diffEditor ? DiffEditorWidget.ENTIRE_DIFF_OVERVIEW_WIDTH : 0) - 2;
    }
    return (layoutInfo.width - 2 * DIFF_CELL_MARGIN + (diffEditor ? DiffEditorWidget.ENTIRE_DIFF_OVERVIEW_WIDTH : 0)) / 2 - 18 - 2;
  }
  getOutputEditorViewState() {
    return this._outputEditorViewState;
  }
  saveOutputEditorViewState(viewState) {
    this._outputEditorViewState = viewState;
  }
  getMetadataEditorViewState() {
    return this._metadataEditorViewState;
  }
  saveMetadataEditorViewState(viewState) {
    this._metadataEditorViewState = viewState;
  }
  getSourceEditorViewState() {
    return this._sourceEditorViewState;
  }
  saveSpirceEditorViewState(viewState) {
    this._sourceEditorViewState = viewState;
  }
}
class SideBySideDiffElementViewModel extends DiffElementCellViewModelBase {
  constructor(mainDocumentTextModel, otherDocumentTextModel, original, modified, type, editorEventDispatcher, initData, notebookService, configurationService, index, diffEditorHeightCalculator) {
    super(
      mainDocumentTextModel,
      original,
      modified,
      type,
      editorEventDispatcher,
      initData,
      notebookService,
      index,
      configurationService,
      diffEditorHeightCalculator
    );
    this.otherDocumentTextModel = otherDocumentTextModel;
    this.type = type;
    this.cellFoldingState = this.modified.textModel.getValue() !== this.original.textModel.getValue() ? 0 /* Expanded */ : 1 /* Collapsed */;
    this.metadataFoldingState = 1 /* Collapsed */;
    this.outputFoldingState = 1 /* Collapsed */;
    if (this.checkMetadataIfModified()) {
      this.metadataFoldingState = 0 /* Expanded */;
    }
    if (this.checkIfOutputsModified()) {
      this.outputFoldingState = 0 /* Expanded */;
    }
    this._register(this.original.onDidChangeOutputLayout(() => {
      this._layout({ recomputeOutput: true });
    }));
    this._register(this.modified.onDidChangeOutputLayout(() => {
      this._layout({ recomputeOutput: true });
    }));
    this._register(this.modified.textModel.onDidChangeContent(() => {
      if (mainDocumentTextModel.transientOptions.cellContentMetadata) {
        const cellMetadataKeys = [...Object.keys(mainDocumentTextModel.transientOptions.cellContentMetadata)];
        const modifiedMedataRaw = Object.assign({}, this.modified.metadata);
        const originalCellMetadata = this.original.metadata;
        for (const key of cellMetadataKeys) {
          if (key in originalCellMetadata) {
            modifiedMedataRaw[key] = originalCellMetadata[key];
          }
        }
        this.modified.textModel.metadata = modifiedMedataRaw;
      }
    }));
  }
  get originalDocument() {
    return this.otherDocumentTextModel;
  }
  get modifiedDocument() {
    return this.mainDocumentTextModel;
  }
  checkIfInputModified() {
    if (this.original.textModel.getTextBufferHash() === this.modified.textModel.getTextBufferHash()) {
      return false;
    }
    return {
      reason: "Cell content has changed"
    };
  }
  checkIfOutputsModified() {
    if (this.mainDocumentTextModel.transientOptions.transientOutputs || this.ignoreOutputs) {
      return false;
    }
    const ret = outputsEqual(this.original?.outputs ?? [], this.modified?.outputs ?? []);
    if (ret === 0 /* Unchanged */) {
      return false;
    }
    return {
      reason: ret === 1 /* Metadata */ ? "Output metadata has changed" : void 0,
      kind: ret
    };
  }
  checkMetadataIfModified() {
    if (this.ignoreMetadata) {
      return false;
    }
    const modified = hash(getFormattedMetadataJSON(this.mainDocumentTextModel.transientOptions.transientCellMetadata, this.original?.metadata || {}, this.original?.language)) !== hash(getFormattedMetadataJSON(this.mainDocumentTextModel.transientOptions.transientCellMetadata, this.modified?.metadata ?? {}, this.modified?.language));
    if (modified) {
      return { reason: void 0 };
    } else {
      return false;
    }
  }
  updateOutputHeight(diffSide, index, height) {
    if (diffSide === DiffSide.Original) {
      this.original.updateOutputHeight(index, height);
    } else {
      this.modified.updateOutputHeight(index, height);
    }
  }
  getOutputOffsetInContainer(diffSide, index) {
    if (diffSide === DiffSide.Original) {
      return this.original.getOutputOffset(index);
    } else {
      return this.modified.getOutputOffset(index);
    }
  }
  getOutputOffsetInCell(diffSide, index) {
    const offsetInOutputsContainer = this.getOutputOffsetInContainer(diffSide, index);
    return this._layoutInfo.editorHeight + this._layoutInfo.editorMargin + this._layoutInfo.metadataHeight + this._layoutInfo.cellStatusHeight + this._layoutInfo.metadataStatusHeight + this._layoutInfo.outputStatusHeight + this._layoutInfo.bodyMargin / 2 + offsetInOutputsContainer;
  }
  isOutputEmpty() {
    if (this.mainDocumentTextModel.transientOptions.transientOutputs) {
      return true;
    }
    if (this.checkIfOutputsModified()) {
      return false;
    }
    return (this.original?.outputs || []).length === 0;
  }
  getRichOutputTotalHeight() {
    return Math.max(this.original.getOutputTotalHeight(), this.modified.getOutputTotalHeight());
  }
  getNestedCellViewModel(diffSide) {
    return diffSide === DiffSide.Original ? this.original : this.modified;
  }
  getCellByUri(cellUri) {
    if (cellUri.toString() === this.original.uri.toString()) {
      return this.original;
    } else {
      return this.modified;
    }
  }
  computeInputEditorHeight(lineHeight) {
    if (this.type === "modified" && typeof this.editorHeightWithUnchangedLinesCollapsed === "number" && this.checkIfInputModified()) {
      return this.editorHeightWithUnchangedLinesCollapsed;
    }
    return super.computeInputEditorHeight(lineHeight);
  }
  async computeModifiedInputEditorHeight() {
    if (this.checkIfInputModified()) {
      this.editorHeightWithUnchangedLinesCollapsed = this._layoutInfo.editorHeight = await this.diffEditorHeightCalculator.diffAndComputeHeight(this.original.uri, this.modified.uri);
    }
  }
  async computeModifiedMetadataEditorHeight() {
    if (this.checkMetadataIfModified()) {
      const originalMetadataUri = CellUri.generateCellPropertyUri(this.originalDocument.uri, this.original.handle, Schemas.vscodeNotebookCellMetadata);
      const modifiedMetadataUri = CellUri.generateCellPropertyUri(this.modifiedDocument.uri, this.modified.handle, Schemas.vscodeNotebookCellMetadata);
      this._layoutInfo.metadataHeight = await this.diffEditorHeightCalculator.diffAndComputeHeight(originalMetadataUri, modifiedMetadataUri);
    }
  }
  async computeEditorHeights() {
    if (this.type === "unchanged") {
      return;
    }
    await Promise.all([this.computeModifiedInputEditorHeight(), this.computeModifiedMetadataEditorHeight()]);
  }
}
class SingleSideDiffElementViewModel extends DiffElementCellViewModelBase {
  constructor(mainDocumentTextModel, otherDocumentTextModel, original, modified, type, editorEventDispatcher, initData, notebookService, configurationService, diffEditorHeightCalculator, index) {
    super(mainDocumentTextModel, original, modified, type, editorEventDispatcher, initData, notebookService, index, configurationService, diffEditorHeightCalculator);
    this.otherDocumentTextModel = otherDocumentTextModel;
    this.type = type;
    this._register(this.cellViewModel.onDidChangeOutputLayout(() => {
      this._layout({ recomputeOutput: true });
    }));
  }
  get cellViewModel() {
    return this.type === "insert" ? this.modified : this.original;
  }
  get originalDocument() {
    if (this.type === "insert") {
      return this.otherDocumentTextModel;
    } else {
      return this.mainDocumentTextModel;
    }
  }
  get modifiedDocument() {
    if (this.type === "insert") {
      return this.mainDocumentTextModel;
    } else {
      return this.otherDocumentTextModel;
    }
  }
  checkIfInputModified() {
    return {
      reason: "Cell content has changed"
    };
  }
  getNestedCellViewModel(diffSide) {
    return this.type === "insert" ? this.modified : this.original;
  }
  checkIfOutputsModified() {
    return false;
  }
  checkMetadataIfModified() {
    return false;
  }
  updateOutputHeight(diffSide, index, height) {
    this.cellViewModel?.updateOutputHeight(index, height);
  }
  getOutputOffsetInContainer(diffSide, index) {
    return this.cellViewModel.getOutputOffset(index);
  }
  getOutputOffsetInCell(diffSide, index) {
    const offsetInOutputsContainer = this.cellViewModel.getOutputOffset(index);
    return this._layoutInfo.editorHeight + this._layoutInfo.editorMargin + this._layoutInfo.metadataHeight + this._layoutInfo.cellStatusHeight + this._layoutInfo.metadataStatusHeight + this._layoutInfo.outputStatusHeight + this._layoutInfo.bodyMargin / 2 + offsetInOutputsContainer;
  }
  isOutputEmpty() {
    if (this.mainDocumentTextModel.transientOptions.transientOutputs) {
      return true;
    }
    return (this.original?.outputs || this.modified?.outputs || []).length === 0;
  }
  getRichOutputTotalHeight() {
    return this.cellViewModel?.getOutputTotalHeight() ?? 0;
  }
  getCellByUri(cellUri) {
    return this.cellViewModel;
  }
}
var OutputComparison = /* @__PURE__ */ ((OutputComparison2) => {
  OutputComparison2[OutputComparison2["Unchanged"] = 0] = "Unchanged";
  OutputComparison2[OutputComparison2["Metadata"] = 1] = "Metadata";
  OutputComparison2[OutputComparison2["Other"] = 2] = "Other";
  return OutputComparison2;
})(OutputComparison || {});
function outputEqual(a, b) {
  if (hash(a.metadata) === hash(b.metadata)) {
    return 2 /* Other */;
  }
  for (let j = 0; j < a.outputs.length; j++) {
    const aOutputItem = a.outputs[j];
    const bOutputItem = b.outputs[j];
    if (aOutputItem.mime !== bOutputItem.mime) {
      return 2 /* Other */;
    }
    if (aOutputItem.data.buffer.length !== bOutputItem.data.buffer.length) {
      return 2 /* Other */;
    }
    for (let k = 0; k < aOutputItem.data.buffer.length; k++) {
      if (aOutputItem.data.buffer[k] !== bOutputItem.data.buffer[k]) {
        return 2 /* Other */;
      }
    }
  }
  return 1 /* Metadata */;
}
function outputsEqual(original, modified) {
  if (original.length !== modified.length) {
    return 2 /* Other */;
  }
  const len = original.length;
  for (let i = 0; i < len; i++) {
    const a = original[i];
    const b = modified[i];
    if (hash(a.metadata) !== hash(b.metadata)) {
      return 1 /* Metadata */;
    }
    if (a.outputs.length !== b.outputs.length) {
      return 2 /* Other */;
    }
    for (let j = 0; j < a.outputs.length; j++) {
      const aOutputItem = a.outputs[j];
      const bOutputItem = b.outputs[j];
      if (aOutputItem.mime !== bOutputItem.mime) {
        return 2 /* Other */;
      }
      if (aOutputItem.data.buffer.length !== bOutputItem.data.buffer.length) {
        return 2 /* Other */;
      }
      for (let k = 0; k < aOutputItem.data.buffer.length; k++) {
        if (aOutputItem.data.buffer[k] !== bOutputItem.data.buffer[k]) {
          return 2 /* Other */;
        }
      }
    }
  }
  return 0 /* Unchanged */;
}
function getStreamOutputData(outputs) {
  if (!outputs.length) {
    return null;
  }
  const first = outputs[0];
  const mime = first.mime;
  const sameStream = !outputs.find((op) => op.mime !== mime);
  if (sameStream) {
    return outputs.map((opit) => opit.data.toString()).join("");
  } else {
    return null;
  }
}
function getFormattedOutputJSON(outputs) {
  if (outputs.length === 1) {
    const streamOutputData = getStreamOutputData(outputs[0].outputs);
    if (streamOutputData) {
      return streamOutputData;
    }
  }
  return JSON.stringify(outputs.map((output) => {
    return {
      metadata: output.metadata,
      outputItems: output.outputs.map((opit) => ({
        mimeType: opit.mime,
        data: opit.data.toString()
      }))
    };
  }), void 0, "	");
}
export {
  DefaultLineHeight,
  DiffElementCellViewModelBase,
  DiffElementPlaceholderViewModel,
  DiffElementViewModelBase,
  HeightOfHiddenLinesRegionInDiffEditor,
  NotebookDocumentMetadataViewModel,
  OUTPUT_EDITOR_HEIGHT_MAGIC,
  OutputComparison,
  PropertyFoldingState,
  SideBySideDiffElementViewModel,
  SingleSideDiffElementViewModel,
  getFormattedOutputJSON,
  getStreamOutputData,
  outputEqual
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2RpZmYvZGlmZkVsZW1lbnRWaWV3TW9kZWwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgaGFzaCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2hhc2guanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRGlmZkVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9kaWZmRWRpdG9yL2RpZmZFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgRm9udEluZm8gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9mb250SW5mby5qcyc7XG5pbXBvcnQgKiBhcyBlZGl0b3JDb21tb24gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgZ2V0RWRpdG9yUGFkZGluZyB9IGZyb20gJy4vZGlmZkNlbGxFZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IERpZmZOZXN0ZWRDZWxsVmlld01vZGVsIH0gZnJvbSAnLi9kaWZmTmVzdGVkQ2VsbFZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0RpZmZFZGl0b3JFdmVudERpc3BhdGNoZXIsIE5vdGVib29rRGlmZlZpZXdFdmVudFR5cGUgfSBmcm9tICcuL2V2ZW50RGlzcGF0Y2hlci5qcyc7XG5pbXBvcnQgeyBDZWxsRGlmZlZpZXdNb2RlbExheW91dENoYW5nZUV2ZW50LCBESUZGX0NFTExfTUFSR0lOLCBEaWZmU2lkZSwgSURpZmZFbGVtZW50TGF5b3V0SW5mbyB9IGZyb20gJy4vbm90ZWJvb2tEaWZmRWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBDZWxsTGF5b3V0U3RhdGUsIElHZW5lcmljQ2VsbFZpZXdNb2RlbCB9IGZyb20gJy4uL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0xheW91dEluZm8gfSBmcm9tICcuLi9ub3RlYm9va1ZpZXdFdmVudHMuanMnO1xuaW1wb3J0IHsgZ2V0Rm9ybWF0dGVkTWV0YWRhdGFKU09OLCBOb3RlYm9va0NlbGxUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi9jb21tb24vbW9kZWwvbm90ZWJvb2tDZWxsVGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IE5vdGVib29rVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL21vZGVsL25vdGVib29rVGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IENlbGxVcmksIElDZWxsT3V0cHV0LCBJTm90ZWJvb2tUZXh0TW9kZWwsIElPdXRwdXREdG8sIElPdXRwdXRJdGVtRHRvIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IElOb3RlYm9va1NlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgSURpZmZFZGl0b3JIZWlnaHRDYWxjdWxhdG9yU2VydmljZSB9IGZyb20gJy4vZWRpdG9ySGVpZ2h0Q2FsY3VsYXRvci5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0RvY3VtZW50TWV0YWRhdGFUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi9jb21tb24vbW9kZWwvbm90ZWJvb2tNZXRhZGF0YVRleHRNb2RlbC5qcyc7XG5cbmNvbnN0IFByb3BlcnR5SGVhZGVySGVpZ2h0ID0gMjU7XG5cbi8vIEZyb20gYC5tb25hY28tZWRpdG9yIC5kaWZmLWhpZGRlbi1saW5lcyAuY2VudGVyYCBpbiBzcmMvdnMvZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2RpZmZFZGl0b3Ivc3R5bGUuY3NzXG5leHBvcnQgY29uc3QgSGVpZ2h0T2ZIaWRkZW5MaW5lc1JlZ2lvbkluRGlmZkVkaXRvciA9IDI0O1xuXG5leHBvcnQgY29uc3QgRGVmYXVsdExpbmVIZWlnaHQgPSAxNztcblxuZXhwb3J0IGVudW0gUHJvcGVydHlGb2xkaW5nU3RhdGUge1xuXHRFeHBhbmRlZCxcblx0Q29sbGFwc2VkXG59XG5cbmV4cG9ydCBjb25zdCBPVVRQVVRfRURJVE9SX0hFSUdIVF9NQUdJQyA9IDE0NDA7XG5cbnR5cGUgSUxheW91dEluZm9EZWx0YTAgPSB7IFtLIGluIGtleW9mIElEaWZmRWxlbWVudExheW91dEluZm9dPzogbnVtYmVyOyB9O1xuaW50ZXJmYWNlIElMYXlvdXRJbmZvRGVsdGEgZXh0ZW5kcyBJTGF5b3V0SW5mb0RlbHRhMCB7XG5cdHJhd091dHB1dEhlaWdodD86IG51bWJlcjtcblx0cmVjb21wdXRlT3V0cHV0PzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IHR5cGUgSURpZmZFbGVtZW50Vmlld01vZGVsQmFzZSA9IERpZmZFbGVtZW50Q2VsbFZpZXdNb2RlbEJhc2UgfCBEaWZmRWxlbWVudFBsYWNlaG9sZGVyVmlld01vZGVsIHwgTm90ZWJvb2tEb2N1bWVudE1ldGFkYXRhVmlld01vZGVsO1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRGlmZkVsZW1lbnRWaWV3TW9kZWxCYXNlIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByb3RlY3RlZCBfbGF5b3V0SW5mb0VtaXR0ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxDZWxsRGlmZlZpZXdNb2RlbExheW91dENoYW5nZUV2ZW50PigpKTtcblx0b25EaWRMYXlvdXRDaGFuZ2UgPSB0aGlzLl9sYXlvdXRJbmZvRW1pdHRlci5ldmVudDtcblx0YWJzdHJhY3QgcmVuZGVyT3V0cHV0OiBib29sZWFuO1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgbWFpbkRvY3VtZW50VGV4dE1vZGVsOiBJTm90ZWJvb2tUZXh0TW9kZWwsXG5cdFx0cHVibGljIHJlYWRvbmx5IGVkaXRvckV2ZW50RGlzcGF0Y2hlcjogTm90ZWJvb2tEaWZmRWRpdG9yRXZlbnREaXNwYXRjaGVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBpbml0RGF0YToge1xuXHRcdFx0bWV0YWRhdGFTdGF0dXNIZWlnaHQ6IG51bWJlcjtcblx0XHRcdG91dHB1dFN0YXR1c0hlaWdodDogbnVtYmVyO1xuXHRcdFx0Zm9udEluZm86IEZvbnRJbmZvIHwgdW5kZWZpbmVkO1xuXHRcdH1cblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdG9yRXZlbnREaXNwYXRjaGVyLm9uRGlkQ2hhbmdlTGF5b3V0KGUgPT4gdGhpcy5fbGF5b3V0SW5mb0VtaXR0ZXIuZmlyZSh7IG91dGVyV2lkdGg6IHRydWUgfSkpKTtcblx0fVxuXG5cdGFic3RyYWN0IGxheW91dENoYW5nZSgpOiB2b2lkO1xuXHRhYnN0cmFjdCBnZXRIZWlnaHQobGluZUhlaWdodDogbnVtYmVyKTogbnVtYmVyO1xuXHRhYnN0cmFjdCBnZXQgdG90YWxIZWlnaHQoKTogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgRGlmZkVsZW1lbnRQbGFjZWhvbGRlclZpZXdNb2RlbCBleHRlbmRzIERpZmZFbGVtZW50Vmlld01vZGVsQmFzZSB7XG5cdHJlYWRvbmx5IHR5cGU6ICdwbGFjZWhvbGRlcicgPSAncGxhY2Vob2xkZXInO1xuXHRwdWJsaWMgaGlkZGVuQ2VsbHM6IERpZmZFbGVtZW50Q2VsbFZpZXdNb2RlbEJhc2VbXSA9IFtdO1xuXHRwcm90ZWN0ZWQgX3VuZm9sZEhpZGRlbkNlbGxzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdG9uVW5mb2xkSGlkZGVuQ2VsbHMgPSB0aGlzLl91bmZvbGRIaWRkZW5DZWxscy5ldmVudDtcblxuXHRwdWJsaWMgcmVuZGVyT3V0cHV0OiBib29sZWFuID0gZmFsc2U7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdG1haW5Eb2N1bWVudFRleHRNb2RlbDogSU5vdGVib29rVGV4dE1vZGVsLFxuXHRcdGVkaXRvckV2ZW50RGlzcGF0Y2hlcjogTm90ZWJvb2tEaWZmRWRpdG9yRXZlbnREaXNwYXRjaGVyLFxuXHRcdGluaXREYXRhOiB7XG5cdFx0XHRtZXRhZGF0YVN0YXR1c0hlaWdodDogbnVtYmVyO1xuXHRcdFx0b3V0cHV0U3RhdHVzSGVpZ2h0OiBudW1iZXI7XG5cdFx0XHRmb250SW5mbzogRm9udEluZm8gfCB1bmRlZmluZWQ7XG5cdFx0fVxuXHQpIHtcblx0XHRzdXBlcihtYWluRG9jdW1lbnRUZXh0TW9kZWwsIGVkaXRvckV2ZW50RGlzcGF0Y2hlciwgaW5pdERhdGEpO1xuXG5cdH1cblx0Z2V0IHRvdGFsSGVpZ2h0KCkge1xuXHRcdHJldHVybiAyNCArICgyICogRElGRl9DRUxMX01BUkdJTik7XG5cdH1cblx0Z2V0SGVpZ2h0KF86IG51bWJlcik6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMudG90YWxIZWlnaHQ7XG5cdH1cblx0b3ZlcnJpZGUgbGF5b3V0Q2hhbmdlKCk6IHZvaWQge1xuXHRcdC8vXG5cdH1cblx0c2hvd0hpZGRlbkNlbGxzKCkge1xuXHRcdHRoaXMuX3VuZm9sZEhpZGRlbkNlbGxzLmZpcmUoKTtcblx0fVxufVxuXG5cbmV4cG9ydCBjbGFzcyBOb3RlYm9va0RvY3VtZW50TWV0YWRhdGFWaWV3TW9kZWwgZXh0ZW5kcyBEaWZmRWxlbWVudFZpZXdNb2RlbEJhc2Uge1xuXHRwdWJsaWMgcmVhZG9ubHkgb3JpZ2luYWxNZXRhZGF0YTogTm90ZWJvb2tEb2N1bWVudE1ldGFkYXRhVGV4dE1vZGVsO1xuXHRwdWJsaWMgcmVhZG9ubHkgbW9kaWZpZWRNZXRhZGF0YTogTm90ZWJvb2tEb2N1bWVudE1ldGFkYXRhVGV4dE1vZGVsO1xuXHRwdWJsaWMgY2VsbEZvbGRpbmdTdGF0ZTogUHJvcGVydHlGb2xkaW5nU3RhdGU7XG5cdHByb3RlY3RlZCBfbGF5b3V0SW5mbyE6IElEaWZmRWxlbWVudExheW91dEluZm87XG5cdHB1YmxpYyByZW5kZXJPdXRwdXQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0c2V0IGVkaXRvckhlaWdodChoZWlnaHQ6IG51bWJlcikge1xuXHRcdHRoaXMuX2xheW91dCh7IGVkaXRvckhlaWdodDogaGVpZ2h0IH0pO1xuXHR9XG5cblx0Z2V0IGVkaXRvckhlaWdodCgpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ1VzZSBDZWxsLmxheW91dEluZm8uZWRpdG9ySGVpZ2h0Jyk7XG5cdH1cblxuXHRzZXQgZWRpdG9yTWFyZ2luKG1hcmdpbjogbnVtYmVyKSB7XG5cdFx0dGhpcy5fbGF5b3V0KHsgZWRpdG9yTWFyZ2luOiBtYXJnaW4gfSk7XG5cdH1cblxuXHRnZXQgZWRpdG9yTWFyZ2luKCkge1xuXHRcdHRocm93IG5ldyBFcnJvcignVXNlIENlbGwubGF5b3V0SW5mby5lZGl0b3JNYXJnaW4nKTtcblx0fVxuXHRnZXQgbGF5b3V0SW5mbygpOiBJRGlmZkVsZW1lbnRMYXlvdXRJbmZvIHtcblx0XHRyZXR1cm4gdGhpcy5fbGF5b3V0SW5mbztcblx0fVxuXG5cdGdldCB0b3RhbEhlaWdodCgpIHtcblx0XHRyZXR1cm4gdGhpcy5sYXlvdXRJbmZvLnRvdGFsSGVpZ2h0O1xuXHR9XG5cblx0cHJpdmF0ZSBfc291cmNlRWRpdG9yVmlld1N0YXRlOiBlZGl0b3JDb21tb24uSUNvZGVFZGl0b3JWaWV3U3RhdGUgfCBlZGl0b3JDb21tb24uSURpZmZFZGl0b3JWaWV3U3RhdGUgfCBudWxsID0gbnVsbDtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IG9yaWdpbmFsRG9jdW1lbnRUZXh0TW9kZWw6IElOb3RlYm9va1RleHRNb2RlbCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgbW9kaWZpZWREb2N1bWVudFRleHRNb2RlbDogSU5vdGVib29rVGV4dE1vZGVsLFxuXHRcdHB1YmxpYyByZWFkb25seSB0eXBlOiAndW5jaGFuZ2VkTWV0YWRhdGEnIHwgJ21vZGlmaWVkTWV0YWRhdGEnLFxuXHRcdGVkaXRvckV2ZW50RGlzcGF0Y2hlcjogTm90ZWJvb2tEaWZmRWRpdG9yRXZlbnREaXNwYXRjaGVyLFxuXHRcdGluaXREYXRhOiB7XG5cdFx0XHRtZXRhZGF0YVN0YXR1c0hlaWdodDogbnVtYmVyO1xuXHRcdFx0b3V0cHV0U3RhdHVzSGVpZ2h0OiBudW1iZXI7XG5cdFx0XHRmb250SW5mbzogRm9udEluZm8gfCB1bmRlZmluZWQ7XG5cdFx0fSxcblx0XHRub3RlYm9va1NlcnZpY2U6IElOb3RlYm9va1NlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3JIZWlnaHRDYWxjdWxhdG9yOiBJRGlmZkVkaXRvckhlaWdodENhbGN1bGF0b3JTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKG9yaWdpbmFsRG9jdW1lbnRUZXh0TW9kZWwsIGVkaXRvckV2ZW50RGlzcGF0Y2hlciwgaW5pdERhdGEpO1xuXG5cdFx0Y29uc3QgY2VsbFN0YXR1c0hlaWdodCA9IFByb3BlcnR5SGVhZGVySGVpZ2h0O1xuXHRcdHRoaXMuX2xheW91dEluZm8gPSB7XG5cdFx0XHR3aWR0aDogMCxcblx0XHRcdGVkaXRvckhlaWdodDogMCxcblx0XHRcdGVkaXRvck1hcmdpbjogMCxcblx0XHRcdG1ldGFkYXRhSGVpZ2h0OiAwLFxuXHRcdFx0Y2VsbFN0YXR1c0hlaWdodCxcblx0XHRcdG1ldGFkYXRhU3RhdHVzSGVpZ2h0OiAwLFxuXHRcdFx0cmF3T3V0cHV0SGVpZ2h0OiAwLFxuXHRcdFx0b3V0cHV0VG90YWxIZWlnaHQ6IDAsXG5cdFx0XHRvdXRwdXRTdGF0dXNIZWlnaHQ6IDAsXG5cdFx0XHRvdXRwdXRNZXRhZGF0YUhlaWdodDogMCxcblx0XHRcdGJvZHlNYXJnaW46IDMyLFxuXHRcdFx0dG90YWxIZWlnaHQ6IDgyICsgY2VsbFN0YXR1c0hlaWdodCArIDAsXG5cdFx0XHRsYXlvdXRTdGF0ZTogQ2VsbExheW91dFN0YXRlLlVuaW5pdGlhbGl6ZWRcblx0XHR9O1xuXG5cdFx0dGhpcy5jZWxsRm9sZGluZ1N0YXRlID0gdHlwZSA9PT0gJ21vZGlmaWVkTWV0YWRhdGEnID8gUHJvcGVydHlGb2xkaW5nU3RhdGUuRXhwYW5kZWQgOiBQcm9wZXJ0eUZvbGRpbmdTdGF0ZS5Db2xsYXBzZWQ7XG5cdFx0dGhpcy5vcmlnaW5hbE1ldGFkYXRhID0gdGhpcy5fcmVnaXN0ZXIobmV3IE5vdGVib29rRG9jdW1lbnRNZXRhZGF0YVRleHRNb2RlbChvcmlnaW5hbERvY3VtZW50VGV4dE1vZGVsKSk7XG5cdFx0dGhpcy5tb2RpZmllZE1ldGFkYXRhID0gdGhpcy5fcmVnaXN0ZXIobmV3IE5vdGVib29rRG9jdW1lbnRNZXRhZGF0YVRleHRNb2RlbChtb2RpZmllZERvY3VtZW50VGV4dE1vZGVsKSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgY29tcHV0ZUhlaWdodHMoKSB7XG5cdFx0aWYgKHRoaXMudHlwZSA9PT0gJ3VuY2hhbmdlZE1ldGFkYXRhJykge1xuXHRcdFx0dGhpcy5lZGl0b3JIZWlnaHQgPSB0aGlzLmVkaXRvckhlaWdodENhbGN1bGF0b3IuY29tcHV0ZUhlaWdodEZyb21MaW5lcyh0aGlzLm9yaWdpbmFsTWV0YWRhdGEudGV4dEJ1ZmZlci5nZXRMaW5lQ291bnQoKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IG9yaWdpbmFsID0gdGhpcy5vcmlnaW5hbE1ldGFkYXRhLnVyaTtcblx0XHRcdGNvbnN0IG1vZGlmaWVkID0gdGhpcy5tb2RpZmllZE1ldGFkYXRhLnVyaTtcblx0XHRcdHRoaXMuZWRpdG9ySGVpZ2h0ID0gYXdhaXQgdGhpcy5lZGl0b3JIZWlnaHRDYWxjdWxhdG9yLmRpZmZBbmRDb21wdXRlSGVpZ2h0KG9yaWdpbmFsLCBtb2RpZmllZCk7XG5cdFx0fVxuXHR9XG5cblx0bGF5b3V0Q2hhbmdlKCkge1xuXHRcdHRoaXMuX2xheW91dCh7IHJlY29tcHV0ZU91dHB1dDogdHJ1ZSB9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBfbGF5b3V0KGRlbHRhOiBJTGF5b3V0SW5mb0RlbHRhKSB7XG5cdFx0Y29uc3Qgd2lkdGggPSBkZWx0YS53aWR0aCAhPT0gdW5kZWZpbmVkID8gZGVsdGEud2lkdGggOiB0aGlzLl9sYXlvdXRJbmZvLndpZHRoO1xuXHRcdGNvbnN0IGVkaXRvckhlaWdodCA9IGRlbHRhLmVkaXRvckhlaWdodCAhPT0gdW5kZWZpbmVkID8gZGVsdGEuZWRpdG9ySGVpZ2h0IDogdGhpcy5fbGF5b3V0SW5mby5lZGl0b3JIZWlnaHQ7XG5cdFx0Y29uc3QgZWRpdG9yTWFyZ2luID0gZGVsdGEuZWRpdG9yTWFyZ2luICE9PSB1bmRlZmluZWQgPyBkZWx0YS5lZGl0b3JNYXJnaW4gOiB0aGlzLl9sYXlvdXRJbmZvLmVkaXRvck1hcmdpbjtcblx0XHRjb25zdCBjZWxsU3RhdHVzSGVpZ2h0ID0gZGVsdGEuY2VsbFN0YXR1c0hlaWdodCAhPT0gdW5kZWZpbmVkID8gZGVsdGEuY2VsbFN0YXR1c0hlaWdodCA6IHRoaXMuX2xheW91dEluZm8uY2VsbFN0YXR1c0hlaWdodDtcblx0XHRjb25zdCBib2R5TWFyZ2luID0gZGVsdGEuYm9keU1hcmdpbiAhPT0gdW5kZWZpbmVkID8gZGVsdGEuYm9keU1hcmdpbiA6IHRoaXMuX2xheW91dEluZm8uYm9keU1hcmdpbjtcblxuXHRcdGNvbnN0IHRvdGFsSGVpZ2h0ID0gZWRpdG9ySGVpZ2h0XG5cdFx0XHQrIGVkaXRvck1hcmdpblxuXHRcdFx0KyBjZWxsU3RhdHVzSGVpZ2h0XG5cdFx0XHQrIGJvZHlNYXJnaW47XG5cblx0XHRjb25zdCBuZXdMYXlvdXQ6IElEaWZmRWxlbWVudExheW91dEluZm8gPSB7XG5cdFx0XHR3aWR0aDogd2lkdGgsXG5cdFx0XHRlZGl0b3JIZWlnaHQ6IGVkaXRvckhlaWdodCxcblx0XHRcdGVkaXRvck1hcmdpbjogZWRpdG9yTWFyZ2luLFxuXHRcdFx0bWV0YWRhdGFIZWlnaHQ6IDAsXG5cdFx0XHRjZWxsU3RhdHVzSGVpZ2h0LFxuXHRcdFx0bWV0YWRhdGFTdGF0dXNIZWlnaHQ6IDAsXG5cdFx0XHRvdXRwdXRUb3RhbEhlaWdodDogMCxcblx0XHRcdG91dHB1dFN0YXR1c0hlaWdodDogMCxcblx0XHRcdGJvZHlNYXJnaW46IGJvZHlNYXJnaW4sXG5cdFx0XHRyYXdPdXRwdXRIZWlnaHQ6IDAsXG5cdFx0XHRvdXRwdXRNZXRhZGF0YUhlaWdodDogMCxcblx0XHRcdHRvdGFsSGVpZ2h0OiB0b3RhbEhlaWdodCxcblx0XHRcdGxheW91dFN0YXRlOiBDZWxsTGF5b3V0U3RhdGUuTWVhc3VyZWRcblx0XHR9O1xuXG5cdFx0bGV0IHNvbWV0aGluZ0NoYW5nZWQgPSBmYWxzZTtcblxuXHRcdGNvbnN0IGNoYW5nZUV2ZW50OiBDZWxsRGlmZlZpZXdNb2RlbExheW91dENoYW5nZUV2ZW50ID0ge307XG5cblx0XHRpZiAobmV3TGF5b3V0LndpZHRoICE9PSB0aGlzLl9sYXlvdXRJbmZvLndpZHRoKSB7XG5cdFx0XHRjaGFuZ2VFdmVudC53aWR0aCA9IHRydWU7XG5cdFx0XHRzb21ldGhpbmdDaGFuZ2VkID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAobmV3TGF5b3V0LmVkaXRvckhlaWdodCAhPT0gdGhpcy5fbGF5b3V0SW5mby5lZGl0b3JIZWlnaHQpIHtcblx0XHRcdGNoYW5nZUV2ZW50LmVkaXRvckhlaWdodCA9IHRydWU7XG5cdFx0XHRzb21ldGhpbmdDaGFuZ2VkID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAobmV3TGF5b3V0LmVkaXRvck1hcmdpbiAhPT0gdGhpcy5fbGF5b3V0SW5mby5lZGl0b3JNYXJnaW4pIHtcblx0XHRcdGNoYW5nZUV2ZW50LmVkaXRvck1hcmdpbiA9IHRydWU7XG5cdFx0XHRzb21ldGhpbmdDaGFuZ2VkID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAobmV3TGF5b3V0LmNlbGxTdGF0dXNIZWlnaHQgIT09IHRoaXMuX2xheW91dEluZm8uY2VsbFN0YXR1c0hlaWdodCkge1xuXHRcdFx0Y2hhbmdlRXZlbnQuY2VsbFN0YXR1c0hlaWdodCA9IHRydWU7XG5cdFx0XHRzb21ldGhpbmdDaGFuZ2VkID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAobmV3TGF5b3V0LmJvZHlNYXJnaW4gIT09IHRoaXMuX2xheW91dEluZm8uYm9keU1hcmdpbikge1xuXHRcdFx0Y2hhbmdlRXZlbnQuYm9keU1hcmdpbiA9IHRydWU7XG5cdFx0XHRzb21ldGhpbmdDaGFuZ2VkID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAobmV3TGF5b3V0LnRvdGFsSGVpZ2h0ICE9PSB0aGlzLl9sYXlvdXRJbmZvLnRvdGFsSGVpZ2h0KSB7XG5cdFx0XHRjaGFuZ2VFdmVudC50b3RhbEhlaWdodCA9IHRydWU7XG5cdFx0XHRzb21ldGhpbmdDaGFuZ2VkID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAoc29tZXRoaW5nQ2hhbmdlZCkge1xuXHRcdFx0dGhpcy5fbGF5b3V0SW5mbyA9IG5ld0xheW91dDtcblx0XHRcdHRoaXMuX2ZpcmVMYXlvdXRDaGFuZ2VFdmVudChjaGFuZ2VFdmVudCk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0SGVpZ2h0KGxpbmVIZWlnaHQ6IG51bWJlcikge1xuXHRcdGlmICh0aGlzLl9sYXlvdXRJbmZvLmxheW91dFN0YXRlID09PSBDZWxsTGF5b3V0U3RhdGUuVW5pbml0aWFsaXplZCkge1xuXHRcdFx0Y29uc3QgZWRpdG9ySGVpZ2h0ID0gdGhpcy5jZWxsRm9sZGluZ1N0YXRlID09PSBQcm9wZXJ0eUZvbGRpbmdTdGF0ZS5Db2xsYXBzZWQgPyAwIDogdGhpcy5jb21wdXRlSW5wdXRFZGl0b3JIZWlnaHQobGluZUhlaWdodCk7XG5cdFx0XHRyZXR1cm4gdGhpcy5fY29tcHV0ZVRvdGFsSGVpZ2h0KGVkaXRvckhlaWdodCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9sYXlvdXRJbmZvLnRvdGFsSGVpZ2h0O1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2NvbXB1dGVUb3RhbEhlaWdodChlZGl0b3JIZWlnaHQ6IG51bWJlcikge1xuXHRcdGNvbnN0IHRvdGFsSGVpZ2h0ID0gZWRpdG9ySGVpZ2h0XG5cdFx0XHQrIHRoaXMuX2xheW91dEluZm8uZWRpdG9yTWFyZ2luXG5cdFx0XHQrIHRoaXMuX2xheW91dEluZm8ubWV0YWRhdGFIZWlnaHRcblx0XHRcdCsgdGhpcy5fbGF5b3V0SW5mby5jZWxsU3RhdHVzSGVpZ2h0XG5cdFx0XHQrIHRoaXMuX2xheW91dEluZm8ubWV0YWRhdGFTdGF0dXNIZWlnaHRcblx0XHRcdCsgdGhpcy5fbGF5b3V0SW5mby5vdXRwdXRUb3RhbEhlaWdodFxuXHRcdFx0KyB0aGlzLl9sYXlvdXRJbmZvLm91dHB1dFN0YXR1c0hlaWdodFxuXHRcdFx0KyB0aGlzLl9sYXlvdXRJbmZvLm91dHB1dE1ldGFkYXRhSGVpZ2h0XG5cdFx0XHQrIHRoaXMuX2xheW91dEluZm8uYm9keU1hcmdpbjtcblxuXHRcdHJldHVybiB0b3RhbEhlaWdodDtcblx0fVxuXG5cdHB1YmxpYyBjb21wdXRlSW5wdXRFZGl0b3JIZWlnaHQoX2xpbmVIZWlnaHQ6IG51bWJlcik6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuZWRpdG9ySGVpZ2h0Q2FsY3VsYXRvci5jb21wdXRlSGVpZ2h0RnJvbUxpbmVzKE1hdGgubWF4KHRoaXMub3JpZ2luYWxNZXRhZGF0YS50ZXh0QnVmZmVyLmdldExpbmVDb3VudCgpLCB0aGlzLm1vZGlmaWVkTWV0YWRhdGEudGV4dEJ1ZmZlci5nZXRMaW5lQ291bnQoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZmlyZUxheW91dENoYW5nZUV2ZW50KHN0YXRlOiBDZWxsRGlmZlZpZXdNb2RlbExheW91dENoYW5nZUV2ZW50KSB7XG5cdFx0dGhpcy5fbGF5b3V0SW5mb0VtaXR0ZXIuZmlyZShzdGF0ZSk7XG5cdFx0dGhpcy5lZGl0b3JFdmVudERpc3BhdGNoZXIuZW1pdChbeyB0eXBlOiBOb3RlYm9va0RpZmZWaWV3RXZlbnRUeXBlLkNlbGxMYXlvdXRDaGFuZ2VkLCBzb3VyY2U6IHRoaXMuX2xheW91dEluZm8gfV0pO1xuXHR9XG5cblx0Z2V0Q29tcHV0ZWRDZWxsQ29udGFpbmVyV2lkdGgobGF5b3V0SW5mbzogTm90ZWJvb2tMYXlvdXRJbmZvLCBkaWZmRWRpdG9yOiBib29sZWFuLCBmdWxsV2lkdGg6IGJvb2xlYW4pIHtcblx0XHRpZiAoZnVsbFdpZHRoKSB7XG5cdFx0XHRyZXR1cm4gbGF5b3V0SW5mby53aWR0aCAtIDIgKiBESUZGX0NFTExfTUFSR0lOICsgKGRpZmZFZGl0b3IgPyBEaWZmRWRpdG9yV2lkZ2V0LkVOVElSRV9ESUZGX09WRVJWSUVXX1dJRFRIIDogMCkgLSAyO1xuXHRcdH1cblxuXHRcdHJldHVybiAobGF5b3V0SW5mby53aWR0aCAtIDIgKiBESUZGX0NFTExfTUFSR0lOICsgKGRpZmZFZGl0b3IgPyBEaWZmRWRpdG9yV2lkZ2V0LkVOVElSRV9ESUZGX09WRVJWSUVXX1dJRFRIIDogMCkpIC8gMiAtIDE4IC0gMjtcblx0fVxuXG5cdGdldFNvdXJjZUVkaXRvclZpZXdTdGF0ZSgpOiBlZGl0b3JDb21tb24uSUNvZGVFZGl0b3JWaWV3U3RhdGUgfCBlZGl0b3JDb21tb24uSURpZmZFZGl0b3JWaWV3U3RhdGUgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fc291cmNlRWRpdG9yVmlld1N0YXRlO1xuXHR9XG5cblx0c2F2ZVNwaXJjZUVkaXRvclZpZXdTdGF0ZSh2aWV3U3RhdGU6IGVkaXRvckNvbW1vbi5JQ29kZUVkaXRvclZpZXdTdGF0ZSB8IGVkaXRvckNvbW1vbi5JRGlmZkVkaXRvclZpZXdTdGF0ZSB8IG51bGwpIHtcblx0XHR0aGlzLl9zb3VyY2VFZGl0b3JWaWV3U3RhdGUgPSB2aWV3U3RhdGU7XG5cdH1cbn1cblxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRGlmZkVsZW1lbnRDZWxsVmlld01vZGVsQmFzZSBleHRlbmRzIERpZmZFbGVtZW50Vmlld01vZGVsQmFzZSB7XG5cdHB1YmxpYyBjZWxsRm9sZGluZ1N0YXRlOiBQcm9wZXJ0eUZvbGRpbmdTdGF0ZTtcblx0cHVibGljIG1ldGFkYXRhRm9sZGluZ1N0YXRlOiBQcm9wZXJ0eUZvbGRpbmdTdGF0ZTtcblx0cHVibGljIG91dHB1dEZvbGRpbmdTdGF0ZTogUHJvcGVydHlGb2xkaW5nU3RhdGU7XG5cdHByb3RlY3RlZCBfc3RhdGVDaGFuZ2VFbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyByZW5kZXJPdXRwdXQ6IGJvb2xlYW4gfT4oKSk7XG5cdG9uRGlkU3RhdGVDaGFuZ2UgPSB0aGlzLl9zdGF0ZUNoYW5nZUVtaXR0ZXIuZXZlbnQ7XG5cdHByb3RlY3RlZCBfbGF5b3V0SW5mbyE6IElEaWZmRWxlbWVudExheW91dEluZm87XG5cblx0cHVibGljIGRpc3BsYXlJY29uVG9IaWRlVW5tb2RpZmllZENlbGxzPzogYm9vbGVhbjtcblx0cHJpdmF0ZSBfaGlkZVVuY2hhbmdlZENlbGxzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHB1YmxpYyBvbkhpZGVVbmNoYW5nZWRDZWxscyA9IHRoaXMuX2hpZGVVbmNoYW5nZWRDZWxscy5ldmVudDtcblxuXHRoaWRlVW5jaGFuZ2VkQ2VsbHMoKSB7XG5cdFx0dGhpcy5faGlkZVVuY2hhbmdlZENlbGxzLmZpcmUoKTtcblx0fVxuXHRzZXQgcmF3T3V0cHV0SGVpZ2h0KGhlaWdodDogbnVtYmVyKSB7XG5cdFx0dGhpcy5fbGF5b3V0KHsgcmF3T3V0cHV0SGVpZ2h0OiBNYXRoLm1pbihPVVRQVVRfRURJVE9SX0hFSUdIVF9NQUdJQywgaGVpZ2h0KSB9KTtcblx0fVxuXG5cdGdldCByYXdPdXRwdXRIZWlnaHQoKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdVc2UgQ2VsbC5sYXlvdXRJbmZvLnJhd091dHB1dEhlaWdodCcpO1xuXHR9XG5cblx0c2V0IG91dHB1dFN0YXR1c0hlaWdodChoZWlnaHQ6IG51bWJlcikge1xuXHRcdHRoaXMuX2xheW91dCh7IG91dHB1dFN0YXR1c0hlaWdodDogaGVpZ2h0IH0pO1xuXHR9XG5cblx0Z2V0IG91dHB1dFN0YXR1c0hlaWdodCgpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ1VzZSBDZWxsLmxheW91dEluZm8ub3V0cHV0U3RhdHVzSGVpZ2h0Jyk7XG5cdH1cblxuXHRzZXQgb3V0cHV0TWV0YWRhdGFIZWlnaHQoaGVpZ2h0OiBudW1iZXIpIHtcblx0XHR0aGlzLl9sYXlvdXQoeyBvdXRwdXRNZXRhZGF0YUhlaWdodDogaGVpZ2h0IH0pO1xuXHR9XG5cblx0Z2V0IG91dHB1dE1ldGFkYXRhSGVpZ2h0KCkge1xuXHRcdHRocm93IG5ldyBFcnJvcignVXNlIENlbGwubGF5b3V0SW5mby5vdXRwdXRTdGF0dXNIZWlnaHQnKTtcblx0fVxuXG5cdHNldCBlZGl0b3JIZWlnaHQoaGVpZ2h0OiBudW1iZXIpIHtcblx0XHR0aGlzLl9sYXlvdXQoeyBlZGl0b3JIZWlnaHQ6IGhlaWdodCB9KTtcblx0fVxuXG5cdGdldCBlZGl0b3JIZWlnaHQoKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdVc2UgQ2VsbC5sYXlvdXRJbmZvLmVkaXRvckhlaWdodCcpO1xuXHR9XG5cblx0c2V0IGVkaXRvck1hcmdpbihtYXJnaW46IG51bWJlcikge1xuXHRcdHRoaXMuX2xheW91dCh7IGVkaXRvck1hcmdpbjogbWFyZ2luIH0pO1xuXHR9XG5cblx0Z2V0IGVkaXRvck1hcmdpbigpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ1VzZSBDZWxsLmxheW91dEluZm8uZWRpdG9yTWFyZ2luJyk7XG5cdH1cblxuXHRzZXQgbWV0YWRhdGFTdGF0dXNIZWlnaHQoaGVpZ2h0OiBudW1iZXIpIHtcblx0XHR0aGlzLl9sYXlvdXQoeyBtZXRhZGF0YVN0YXR1c0hlaWdodDogaGVpZ2h0IH0pO1xuXHR9XG5cblx0Z2V0IG1ldGFkYXRhU3RhdHVzSGVpZ2h0KCkge1xuXHRcdHRocm93IG5ldyBFcnJvcignVXNlIENlbGwubGF5b3V0SW5mby5vdXRwdXRTdGF0dXNIZWlnaHQnKTtcblx0fVxuXG5cdHNldCBtZXRhZGF0YUhlaWdodChoZWlnaHQ6IG51bWJlcikge1xuXHRcdHRoaXMuX2xheW91dCh7IG1ldGFkYXRhSGVpZ2h0OiBoZWlnaHQgfSk7XG5cdH1cblxuXHRnZXQgbWV0YWRhdGFIZWlnaHQoKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdVc2UgQ2VsbC5sYXlvdXRJbmZvLm1ldGFkYXRhSGVpZ2h0Jyk7XG5cdH1cblxuXHRwcml2YXRlIF9yZW5kZXJPdXRwdXQgPSB0cnVlO1xuXG5cdHNldCByZW5kZXJPdXRwdXQodmFsdWU6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9yZW5kZXJPdXRwdXQgPSB2YWx1ZTtcblx0XHR0aGlzLl9sYXlvdXQoeyByZWNvbXB1dGVPdXRwdXQ6IHRydWUgfSk7XG5cdFx0dGhpcy5fc3RhdGVDaGFuZ2VFbWl0dGVyLmZpcmUoeyByZW5kZXJPdXRwdXQ6IHRoaXMuX3JlbmRlck91dHB1dCB9KTtcblx0fVxuXG5cdGdldCByZW5kZXJPdXRwdXQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlbmRlck91dHB1dDtcblx0fVxuXG5cdGdldCBsYXlvdXRJbmZvKCk6IElEaWZmRWxlbWVudExheW91dEluZm8ge1xuXHRcdHJldHVybiB0aGlzLl9sYXlvdXRJbmZvO1xuXHR9XG5cblx0Z2V0IHRvdGFsSGVpZ2h0KCkge1xuXHRcdHJldHVybiB0aGlzLmxheW91dEluZm8udG90YWxIZWlnaHQ7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0IGlnbm9yZU91dHB1dHMoKSB7XG5cdFx0cmV0dXJuIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ25vdGVib29rLmRpZmYuaWdub3JlT3V0cHV0cycpIHx8ICEhKHRoaXMubWFpbkRvY3VtZW50VGV4dE1vZGVsPy50cmFuc2llbnRPcHRpb25zLnRyYW5zaWVudE91dHB1dHMpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldCBpZ25vcmVNZXRhZGF0YSgpIHtcblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPignbm90ZWJvb2suZGlmZi5pZ25vcmVNZXRhZGF0YScpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc291cmNlRWRpdG9yVmlld1N0YXRlOiBlZGl0b3JDb21tb24uSUNvZGVFZGl0b3JWaWV3U3RhdGUgfCBlZGl0b3JDb21tb24uSURpZmZFZGl0b3JWaWV3U3RhdGUgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBfb3V0cHV0RWRpdG9yVmlld1N0YXRlOiBlZGl0b3JDb21tb24uSUNvZGVFZGl0b3JWaWV3U3RhdGUgfCBlZGl0b3JDb21tb24uSURpZmZFZGl0b3JWaWV3U3RhdGUgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBfbWV0YWRhdGFFZGl0b3JWaWV3U3RhdGU6IGVkaXRvckNvbW1vbi5JQ29kZUVkaXRvclZpZXdTdGF0ZSB8IGVkaXRvckNvbW1vbi5JRGlmZkVkaXRvclZpZXdTdGF0ZSB8IG51bGwgPSBudWxsO1xuXHRwdWJsaWMgcmVhZG9ubHkgb3JpZ2luYWw6IERpZmZOZXN0ZWRDZWxsVmlld01vZGVsIHwgdW5kZWZpbmVkO1xuXG5cdHB1YmxpYyByZWFkb25seSBtb2RpZmllZDogRGlmZk5lc3RlZENlbGxWaWV3TW9kZWwgfCB1bmRlZmluZWQ7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdG1haW5Eb2N1bWVudFRleHRNb2RlbDogSU5vdGVib29rVGV4dE1vZGVsLFxuXHRcdG9yaWdpbmFsOiBOb3RlYm9va0NlbGxUZXh0TW9kZWwgfCB1bmRlZmluZWQsXG5cdFx0bW9kaWZpZWQ6IE5vdGVib29rQ2VsbFRleHRNb2RlbCB8IHVuZGVmaW5lZCxcblx0XHRyZWFkb25seSB0eXBlOiAndW5jaGFuZ2VkJyB8ICdpbnNlcnQnIHwgJ2RlbGV0ZScgfCAnbW9kaWZpZWQnLFxuXHRcdGVkaXRvckV2ZW50RGlzcGF0Y2hlcjogTm90ZWJvb2tEaWZmRWRpdG9yRXZlbnREaXNwYXRjaGVyLFxuXHRcdGluaXREYXRhOiB7XG5cdFx0XHRtZXRhZGF0YVN0YXR1c0hlaWdodDogbnVtYmVyO1xuXHRcdFx0b3V0cHV0U3RhdHVzSGVpZ2h0OiBudW1iZXI7XG5cdFx0XHRmb250SW5mbzogRm9udEluZm8gfCB1bmRlZmluZWQ7XG5cdFx0fSxcblx0XHRub3RlYm9va1NlcnZpY2U6IElOb3RlYm9va1NlcnZpY2UsXG5cdFx0cHVibGljIHJlYWRvbmx5IGluZGV4OiBudW1iZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdHB1YmxpYyByZWFkb25seSBkaWZmRWRpdG9ySGVpZ2h0Q2FsY3VsYXRvcjogSURpZmZFZGl0b3JIZWlnaHRDYWxjdWxhdG9yU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihtYWluRG9jdW1lbnRUZXh0TW9kZWwsIGVkaXRvckV2ZW50RGlzcGF0Y2hlciwgaW5pdERhdGEpO1xuXHRcdHRoaXMub3JpZ2luYWwgPSBvcmlnaW5hbCA/IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaWZmTmVzdGVkQ2VsbFZpZXdNb2RlbChvcmlnaW5hbCwgbm90ZWJvb2tTZXJ2aWNlKSkgOiB1bmRlZmluZWQ7XG5cdFx0dGhpcy5tb2RpZmllZCA9IG1vZGlmaWVkID8gdGhpcy5fcmVnaXN0ZXIobmV3IERpZmZOZXN0ZWRDZWxsVmlld01vZGVsKG1vZGlmaWVkLCBub3RlYm9va1NlcnZpY2UpKSA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCBlZGl0b3JIZWlnaHQgPSB0aGlzLl9lc3RpbWF0ZUVkaXRvckhlaWdodChpbml0RGF0YS5mb250SW5mbyk7XG5cdFx0Y29uc3QgY2VsbFN0YXR1c0hlaWdodCA9IFByb3BlcnR5SGVhZGVySGVpZ2h0O1xuXHRcdHRoaXMuX2xheW91dEluZm8gPSB7XG5cdFx0XHR3aWR0aDogMCxcblx0XHRcdGVkaXRvckhlaWdodDogZWRpdG9ySGVpZ2h0LFxuXHRcdFx0ZWRpdG9yTWFyZ2luOiAwLFxuXHRcdFx0bWV0YWRhdGFIZWlnaHQ6IDAsXG5cdFx0XHRjZWxsU3RhdHVzSGVpZ2h0LFxuXHRcdFx0bWV0YWRhdGFTdGF0dXNIZWlnaHQ6IHRoaXMuaWdub3JlTWV0YWRhdGEgPyAwIDogUHJvcGVydHlIZWFkZXJIZWlnaHQsXG5cdFx0XHRyYXdPdXRwdXRIZWlnaHQ6IDAsXG5cdFx0XHRvdXRwdXRUb3RhbEhlaWdodDogMCxcblx0XHRcdG91dHB1dFN0YXR1c0hlaWdodDogdGhpcy5pZ25vcmVPdXRwdXRzID8gMCA6IFByb3BlcnR5SGVhZGVySGVpZ2h0LFxuXHRcdFx0b3V0cHV0TWV0YWRhdGFIZWlnaHQ6IDAsXG5cdFx0XHRib2R5TWFyZ2luOiAzMixcblx0XHRcdHRvdGFsSGVpZ2h0OiA4MiArIGNlbGxTdGF0dXNIZWlnaHQgKyBlZGl0b3JIZWlnaHQsXG5cdFx0XHRsYXlvdXRTdGF0ZTogQ2VsbExheW91dFN0YXRlLlVuaW5pdGlhbGl6ZWRcblx0XHR9O1xuXG5cdFx0dGhpcy5jZWxsRm9sZGluZ1N0YXRlID0gbW9kaWZpZWQ/LmdldFRleHRCdWZmZXJIYXNoKCkgIT09IG9yaWdpbmFsPy5nZXRUZXh0QnVmZmVySGFzaCgpID8gUHJvcGVydHlGb2xkaW5nU3RhdGUuRXhwYW5kZWQgOiBQcm9wZXJ0eUZvbGRpbmdTdGF0ZS5Db2xsYXBzZWQ7XG5cdFx0dGhpcy5tZXRhZGF0YUZvbGRpbmdTdGF0ZSA9IFByb3BlcnR5Rm9sZGluZ1N0YXRlLkNvbGxhcHNlZDtcblx0XHR0aGlzLm91dHB1dEZvbGRpbmdTdGF0ZSA9IFByb3BlcnR5Rm9sZGluZ1N0YXRlLkNvbGxhcHNlZDtcblx0fVxuXG5cdGxheW91dENoYW5nZSgpIHtcblx0XHR0aGlzLl9sYXlvdXQoeyByZWNvbXB1dGVPdXRwdXQ6IHRydWUgfSk7XG5cdH1cblxuXHRwcml2YXRlIF9lc3RpbWF0ZUVkaXRvckhlaWdodChmb250SW5mbzogRm9udEluZm8gfCB1bmRlZmluZWQpIHtcblx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gZm9udEluZm8/LmxpbmVIZWlnaHQgPz8gMTc7XG5cblx0XHRzd2l0Y2ggKHRoaXMudHlwZSkge1xuXHRcdFx0Y2FzZSAndW5jaGFuZ2VkJzpcblx0XHRcdGNhc2UgJ2luc2VydCc6XG5cdFx0XHRcdHtcblx0XHRcdFx0XHRjb25zdCBsaW5lQ291bnQgPSB0aGlzLm1vZGlmaWVkIS50ZXh0TW9kZWwudGV4dEJ1ZmZlci5nZXRMaW5lQ291bnQoKTtcblx0XHRcdFx0XHRjb25zdCBlZGl0b3JIZWlnaHQgPSBsaW5lQ291bnQgKiBsaW5lSGVpZ2h0ICsgZ2V0RWRpdG9yUGFkZGluZyhsaW5lQ291bnQpLnRvcCArIGdldEVkaXRvclBhZGRpbmcobGluZUNvdW50KS5ib3R0b207XG5cdFx0XHRcdFx0cmV0dXJuIGVkaXRvckhlaWdodDtcblx0XHRcdFx0fVxuXHRcdFx0Y2FzZSAnZGVsZXRlJzpcblx0XHRcdGNhc2UgJ21vZGlmaWVkJzpcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnN0IGxpbmVDb3VudCA9IHRoaXMub3JpZ2luYWwhLnRleHRNb2RlbC50ZXh0QnVmZmVyLmdldExpbmVDb3VudCgpO1xuXHRcdFx0XHRcdGNvbnN0IGVkaXRvckhlaWdodCA9IGxpbmVDb3VudCAqIGxpbmVIZWlnaHQgKyBnZXRFZGl0b3JQYWRkaW5nKGxpbmVDb3VudCkudG9wICsgZ2V0RWRpdG9yUGFkZGluZyhsaW5lQ291bnQpLmJvdHRvbTtcblx0XHRcdFx0XHRyZXR1cm4gZWRpdG9ySGVpZ2h0O1xuXHRcdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIF9sYXlvdXQoZGVsdGE6IElMYXlvdXRJbmZvRGVsdGEpIHtcblx0XHRjb25zdCB3aWR0aCA9IGRlbHRhLndpZHRoICE9PSB1bmRlZmluZWQgPyBkZWx0YS53aWR0aCA6IHRoaXMuX2xheW91dEluZm8ud2lkdGg7XG5cdFx0Y29uc3QgZWRpdG9ySGVpZ2h0ID0gZGVsdGEuZWRpdG9ySGVpZ2h0ICE9PSB1bmRlZmluZWQgPyBkZWx0YS5lZGl0b3JIZWlnaHQgOiB0aGlzLl9sYXlvdXRJbmZvLmVkaXRvckhlaWdodDtcblx0XHRjb25zdCBlZGl0b3JNYXJnaW4gPSBkZWx0YS5lZGl0b3JNYXJnaW4gIT09IHVuZGVmaW5lZCA/IGRlbHRhLmVkaXRvck1hcmdpbiA6IHRoaXMuX2xheW91dEluZm8uZWRpdG9yTWFyZ2luO1xuXHRcdGNvbnN0IG1ldGFkYXRhSGVpZ2h0ID0gZGVsdGEubWV0YWRhdGFIZWlnaHQgIT09IHVuZGVmaW5lZCA/IGRlbHRhLm1ldGFkYXRhSGVpZ2h0IDogdGhpcy5fbGF5b3V0SW5mby5tZXRhZGF0YUhlaWdodDtcblx0XHRjb25zdCBjZWxsU3RhdHVzSGVpZ2h0ID0gZGVsdGEuY2VsbFN0YXR1c0hlaWdodCAhPT0gdW5kZWZpbmVkID8gZGVsdGEuY2VsbFN0YXR1c0hlaWdodCA6IHRoaXMuX2xheW91dEluZm8uY2VsbFN0YXR1c0hlaWdodDtcblx0XHRjb25zdCBtZXRhZGF0YVN0YXR1c0hlaWdodCA9IGRlbHRhLm1ldGFkYXRhU3RhdHVzSGVpZ2h0ICE9PSB1bmRlZmluZWQgPyBkZWx0YS5tZXRhZGF0YVN0YXR1c0hlaWdodCA6IHRoaXMuX2xheW91dEluZm8ubWV0YWRhdGFTdGF0dXNIZWlnaHQ7XG5cdFx0Y29uc3QgcmF3T3V0cHV0SGVpZ2h0ID0gZGVsdGEucmF3T3V0cHV0SGVpZ2h0ICE9PSB1bmRlZmluZWQgPyBkZWx0YS5yYXdPdXRwdXRIZWlnaHQgOiB0aGlzLl9sYXlvdXRJbmZvLnJhd091dHB1dEhlaWdodDtcblx0XHRjb25zdCBvdXRwdXRTdGF0dXNIZWlnaHQgPSBkZWx0YS5vdXRwdXRTdGF0dXNIZWlnaHQgIT09IHVuZGVmaW5lZCA/IGRlbHRhLm91dHB1dFN0YXR1c0hlaWdodCA6IHRoaXMuX2xheW91dEluZm8ub3V0cHV0U3RhdHVzSGVpZ2h0O1xuXHRcdGNvbnN0IGJvZHlNYXJnaW4gPSBkZWx0YS5ib2R5TWFyZ2luICE9PSB1bmRlZmluZWQgPyBkZWx0YS5ib2R5TWFyZ2luIDogdGhpcy5fbGF5b3V0SW5mby5ib2R5TWFyZ2luO1xuXHRcdGNvbnN0IG91dHB1dE1ldGFkYXRhSGVpZ2h0ID0gZGVsdGEub3V0cHV0TWV0YWRhdGFIZWlnaHQgIT09IHVuZGVmaW5lZCA/IGRlbHRhLm91dHB1dE1ldGFkYXRhSGVpZ2h0IDogdGhpcy5fbGF5b3V0SW5mby5vdXRwdXRNZXRhZGF0YUhlaWdodDtcblx0XHRjb25zdCBvdXRwdXRIZWlnaHQgPSB0aGlzLmlnbm9yZU91dHB1dHMgPyAwIDogKGRlbHRhLnJlY29tcHV0ZU91dHB1dCB8fCBkZWx0YS5yYXdPdXRwdXRIZWlnaHQgIT09IHVuZGVmaW5lZCB8fCBkZWx0YS5vdXRwdXRNZXRhZGF0YUhlaWdodCAhPT0gdW5kZWZpbmVkKSA/IHRoaXMuX2dldE91dHB1dFRvdGFsSGVpZ2h0KHJhd091dHB1dEhlaWdodCwgb3V0cHV0TWV0YWRhdGFIZWlnaHQpIDogdGhpcy5fbGF5b3V0SW5mby5vdXRwdXRUb3RhbEhlaWdodDtcblxuXHRcdGNvbnN0IHRvdGFsSGVpZ2h0ID0gZWRpdG9ySGVpZ2h0XG5cdFx0XHQrIGVkaXRvck1hcmdpblxuXHRcdFx0KyBjZWxsU3RhdHVzSGVpZ2h0XG5cdFx0XHQrIG1ldGFkYXRhSGVpZ2h0XG5cdFx0XHQrIG1ldGFkYXRhU3RhdHVzSGVpZ2h0XG5cdFx0XHQrIG91dHB1dEhlaWdodFxuXHRcdFx0KyBvdXRwdXRTdGF0dXNIZWlnaHRcblx0XHRcdCsgYm9keU1hcmdpbjtcblxuXHRcdGNvbnN0IG5ld0xheW91dDogSURpZmZFbGVtZW50TGF5b3V0SW5mbyA9IHtcblx0XHRcdHdpZHRoOiB3aWR0aCxcblx0XHRcdGVkaXRvckhlaWdodDogZWRpdG9ySGVpZ2h0LFxuXHRcdFx0ZWRpdG9yTWFyZ2luOiBlZGl0b3JNYXJnaW4sXG5cdFx0XHRtZXRhZGF0YUhlaWdodDogbWV0YWRhdGFIZWlnaHQsXG5cdFx0XHRjZWxsU3RhdHVzSGVpZ2h0LFxuXHRcdFx0bWV0YWRhdGFTdGF0dXNIZWlnaHQ6IG1ldGFkYXRhU3RhdHVzSGVpZ2h0LFxuXHRcdFx0b3V0cHV0VG90YWxIZWlnaHQ6IG91dHB1dEhlaWdodCxcblx0XHRcdG91dHB1dFN0YXR1c0hlaWdodDogb3V0cHV0U3RhdHVzSGVpZ2h0LFxuXHRcdFx0Ym9keU1hcmdpbjogYm9keU1hcmdpbixcblx0XHRcdHJhd091dHB1dEhlaWdodDogcmF3T3V0cHV0SGVpZ2h0LFxuXHRcdFx0b3V0cHV0TWV0YWRhdGFIZWlnaHQ6IG91dHB1dE1ldGFkYXRhSGVpZ2h0LFxuXHRcdFx0dG90YWxIZWlnaHQ6IHRvdGFsSGVpZ2h0LFxuXHRcdFx0bGF5b3V0U3RhdGU6IENlbGxMYXlvdXRTdGF0ZS5NZWFzdXJlZFxuXHRcdH07XG5cblx0XHRsZXQgc29tZXRoaW5nQ2hhbmdlZCA9IGZhbHNlO1xuXG5cdFx0Y29uc3QgY2hhbmdlRXZlbnQ6IENlbGxEaWZmVmlld01vZGVsTGF5b3V0Q2hhbmdlRXZlbnQgPSB7fTtcblxuXHRcdGlmIChuZXdMYXlvdXQud2lkdGggIT09IHRoaXMuX2xheW91dEluZm8ud2lkdGgpIHtcblx0XHRcdGNoYW5nZUV2ZW50LndpZHRoID0gdHJ1ZTtcblx0XHRcdHNvbWV0aGluZ0NoYW5nZWQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChuZXdMYXlvdXQuZWRpdG9ySGVpZ2h0ICE9PSB0aGlzLl9sYXlvdXRJbmZvLmVkaXRvckhlaWdodCkge1xuXHRcdFx0Y2hhbmdlRXZlbnQuZWRpdG9ySGVpZ2h0ID0gdHJ1ZTtcblx0XHRcdHNvbWV0aGluZ0NoYW5nZWQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChuZXdMYXlvdXQuZWRpdG9yTWFyZ2luICE9PSB0aGlzLl9sYXlvdXRJbmZvLmVkaXRvck1hcmdpbikge1xuXHRcdFx0Y2hhbmdlRXZlbnQuZWRpdG9yTWFyZ2luID0gdHJ1ZTtcblx0XHRcdHNvbWV0aGluZ0NoYW5nZWQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChuZXdMYXlvdXQubWV0YWRhdGFIZWlnaHQgIT09IHRoaXMuX2xheW91dEluZm8ubWV0YWRhdGFIZWlnaHQpIHtcblx0XHRcdGNoYW5nZUV2ZW50Lm1ldGFkYXRhSGVpZ2h0ID0gdHJ1ZTtcblx0XHRcdHNvbWV0aGluZ0NoYW5nZWQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChuZXdMYXlvdXQuY2VsbFN0YXR1c0hlaWdodCAhPT0gdGhpcy5fbGF5b3V0SW5mby5jZWxsU3RhdHVzSGVpZ2h0KSB7XG5cdFx0XHRjaGFuZ2VFdmVudC5jZWxsU3RhdHVzSGVpZ2h0ID0gdHJ1ZTtcblx0XHRcdHNvbWV0aGluZ0NoYW5nZWQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChuZXdMYXlvdXQubWV0YWRhdGFTdGF0dXNIZWlnaHQgIT09IHRoaXMuX2xheW91dEluZm8ubWV0YWRhdGFTdGF0dXNIZWlnaHQpIHtcblx0XHRcdGNoYW5nZUV2ZW50Lm1ldGFkYXRhU3RhdHVzSGVpZ2h0ID0gdHJ1ZTtcblx0XHRcdHNvbWV0aGluZ0NoYW5nZWQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChuZXdMYXlvdXQub3V0cHV0VG90YWxIZWlnaHQgIT09IHRoaXMuX2xheW91dEluZm8ub3V0cHV0VG90YWxIZWlnaHQpIHtcblx0XHRcdGNoYW5nZUV2ZW50Lm91dHB1dFRvdGFsSGVpZ2h0ID0gdHJ1ZTtcblx0XHRcdHNvbWV0aGluZ0NoYW5nZWQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChuZXdMYXlvdXQub3V0cHV0U3RhdHVzSGVpZ2h0ICE9PSB0aGlzLl9sYXlvdXRJbmZvLm91dHB1dFN0YXR1c0hlaWdodCkge1xuXHRcdFx0Y2hhbmdlRXZlbnQub3V0cHV0U3RhdHVzSGVpZ2h0ID0gdHJ1ZTtcblx0XHRcdHNvbWV0aGluZ0NoYW5nZWQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChuZXdMYXlvdXQuYm9keU1hcmdpbiAhPT0gdGhpcy5fbGF5b3V0SW5mby5ib2R5TWFyZ2luKSB7XG5cdFx0XHRjaGFuZ2VFdmVudC5ib2R5TWFyZ2luID0gdHJ1ZTtcblx0XHRcdHNvbWV0aGluZ0NoYW5nZWQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChuZXdMYXlvdXQub3V0cHV0TWV0YWRhdGFIZWlnaHQgIT09IHRoaXMuX2xheW91dEluZm8ub3V0cHV0TWV0YWRhdGFIZWlnaHQpIHtcblx0XHRcdGNoYW5nZUV2ZW50Lm91dHB1dE1ldGFkYXRhSGVpZ2h0ID0gdHJ1ZTtcblx0XHRcdHNvbWV0aGluZ0NoYW5nZWQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChuZXdMYXlvdXQudG90YWxIZWlnaHQgIT09IHRoaXMuX2xheW91dEluZm8udG90YWxIZWlnaHQpIHtcblx0XHRcdGNoYW5nZUV2ZW50LnRvdGFsSGVpZ2h0ID0gdHJ1ZTtcblx0XHRcdHNvbWV0aGluZ0NoYW5nZWQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChzb21ldGhpbmdDaGFuZ2VkKSB7XG5cdFx0XHR0aGlzLl9sYXlvdXRJbmZvID0gbmV3TGF5b3V0O1xuXHRcdFx0dGhpcy5fZmlyZUxheW91dENoYW5nZUV2ZW50KGNoYW5nZUV2ZW50KTtcblx0XHR9XG5cdH1cblxuXHRnZXRIZWlnaHQobGluZUhlaWdodDogbnVtYmVyKSB7XG5cdFx0aWYgKHRoaXMuX2xheW91dEluZm8ubGF5b3V0U3RhdGUgPT09IENlbGxMYXlvdXRTdGF0ZS5VbmluaXRpYWxpemVkKSB7XG5cdFx0XHRjb25zdCBlZGl0b3JIZWlnaHQgPSB0aGlzLmNlbGxGb2xkaW5nU3RhdGUgPT09IFByb3BlcnR5Rm9sZGluZ1N0YXRlLkNvbGxhcHNlZCA/IDAgOiB0aGlzLmNvbXB1dGVJbnB1dEVkaXRvckhlaWdodChsaW5lSGVpZ2h0KTtcblx0XHRcdHJldHVybiB0aGlzLl9jb21wdXRlVG90YWxIZWlnaHQoZWRpdG9ySGVpZ2h0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2xheW91dEluZm8udG90YWxIZWlnaHQ7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfY29tcHV0ZVRvdGFsSGVpZ2h0KGVkaXRvckhlaWdodDogbnVtYmVyKSB7XG5cdFx0Y29uc3QgdG90YWxIZWlnaHQgPSBlZGl0b3JIZWlnaHRcblx0XHRcdCsgdGhpcy5fbGF5b3V0SW5mby5lZGl0b3JNYXJnaW5cblx0XHRcdCsgdGhpcy5fbGF5b3V0SW5mby5tZXRhZGF0YUhlaWdodFxuXHRcdFx0KyB0aGlzLl9sYXlvdXRJbmZvLmNlbGxTdGF0dXNIZWlnaHRcblx0XHRcdCsgdGhpcy5fbGF5b3V0SW5mby5tZXRhZGF0YVN0YXR1c0hlaWdodFxuXHRcdFx0KyB0aGlzLl9sYXlvdXRJbmZvLm91dHB1dFRvdGFsSGVpZ2h0XG5cdFx0XHQrIHRoaXMuX2xheW91dEluZm8ub3V0cHV0U3RhdHVzSGVpZ2h0XG5cdFx0XHQrIHRoaXMuX2xheW91dEluZm8ub3V0cHV0TWV0YWRhdGFIZWlnaHRcblx0XHRcdCsgdGhpcy5fbGF5b3V0SW5mby5ib2R5TWFyZ2luO1xuXG5cdFx0cmV0dXJuIHRvdGFsSGVpZ2h0O1xuXHR9XG5cblx0cHVibGljIGNvbXB1dGVJbnB1dEVkaXRvckhlaWdodChsaW5lSGVpZ2h0OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGNvbnN0IGxpbmVDb3VudCA9IE1hdGgubWF4KHRoaXMub3JpZ2luYWw/LnRleHRNb2RlbC50ZXh0QnVmZmVyLmdldExpbmVDb3VudCgpID8/IDEsIHRoaXMubW9kaWZpZWQ/LnRleHRNb2RlbC50ZXh0QnVmZmVyLmdldExpbmVDb3VudCgpID8/IDEpO1xuXHRcdHJldHVybiB0aGlzLmRpZmZFZGl0b3JIZWlnaHRDYWxjdWxhdG9yLmNvbXB1dGVIZWlnaHRGcm9tTGluZXMobGluZUNvdW50KTtcblx0fVxuXG5cdHByaXZhdGUgX2dldE91dHB1dFRvdGFsSGVpZ2h0KHJhd091dHB1dEhlaWdodDogbnVtYmVyLCBtZXRhZGF0YUhlaWdodDogbnVtYmVyKSB7XG5cdFx0aWYgKHRoaXMub3V0cHV0Rm9sZGluZ1N0YXRlID09PSBQcm9wZXJ0eUZvbGRpbmdTdGF0ZS5Db2xsYXBzZWQpIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnJlbmRlck91dHB1dCkge1xuXHRcdFx0aWYgKHRoaXMuaXNPdXRwdXRFbXB0eSgpKSB7XG5cdFx0XHRcdC8vIHNpbmdsZSBsaW5lO1xuXHRcdFx0XHRyZXR1cm4gMjQ7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcy5nZXRSaWNoT3V0cHV0VG90YWxIZWlnaHQoKSArIG1ldGFkYXRhSGVpZ2h0O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gcmF3T3V0cHV0SGVpZ2h0O1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2ZpcmVMYXlvdXRDaGFuZ2VFdmVudChzdGF0ZTogQ2VsbERpZmZWaWV3TW9kZWxMYXlvdXRDaGFuZ2VFdmVudCkge1xuXHRcdHRoaXMuX2xheW91dEluZm9FbWl0dGVyLmZpcmUoc3RhdGUpO1xuXHRcdHRoaXMuZWRpdG9yRXZlbnREaXNwYXRjaGVyLmVtaXQoW3sgdHlwZTogTm90ZWJvb2tEaWZmVmlld0V2ZW50VHlwZS5DZWxsTGF5b3V0Q2hhbmdlZCwgc291cmNlOiB0aGlzLl9sYXlvdXRJbmZvIH1dKTtcblx0fVxuXG5cdGFic3RyYWN0IGNoZWNrSWZJbnB1dE1vZGlmaWVkKCk6IGZhbHNlIHwgeyByZWFzb246IHN0cmluZyB8IHVuZGVmaW5lZCB9O1xuXHRhYnN0cmFjdCBjaGVja0lmT3V0cHV0c01vZGlmaWVkKCk6IGZhbHNlIHwgeyByZWFzb246IHN0cmluZyB8IHVuZGVmaW5lZCB9O1xuXHRhYnN0cmFjdCBjaGVja01ldGFkYXRhSWZNb2RpZmllZCgpOiBmYWxzZSB8IHsgcmVhc29uOiBzdHJpbmcgfCB1bmRlZmluZWQgfTtcblx0YWJzdHJhY3QgaXNPdXRwdXRFbXB0eSgpOiBib29sZWFuO1xuXHRhYnN0cmFjdCBnZXRSaWNoT3V0cHV0VG90YWxIZWlnaHQoKTogbnVtYmVyO1xuXHRhYnN0cmFjdCBnZXRDZWxsQnlVcmkoY2VsbFVyaTogVVJJKTogSUdlbmVyaWNDZWxsVmlld01vZGVsO1xuXHRhYnN0cmFjdCBnZXRPdXRwdXRPZmZzZXRJbkNlbGwoZGlmZlNpZGU6IERpZmZTaWRlLCBpbmRleDogbnVtYmVyKTogbnVtYmVyO1xuXHRhYnN0cmFjdCBnZXRPdXRwdXRPZmZzZXRJbkNvbnRhaW5lcihkaWZmU2lkZTogRGlmZlNpZGUsIGluZGV4OiBudW1iZXIpOiBudW1iZXI7XG5cdGFic3RyYWN0IHVwZGF0ZU91dHB1dEhlaWdodChkaWZmU2lkZTogRGlmZlNpZGUsIGluZGV4OiBudW1iZXIsIGhlaWdodDogbnVtYmVyKTogdm9pZDtcblx0YWJzdHJhY3QgZ2V0TmVzdGVkQ2VsbFZpZXdNb2RlbChkaWZmU2lkZTogRGlmZlNpZGUpOiBEaWZmTmVzdGVkQ2VsbFZpZXdNb2RlbDtcblxuXHRnZXRDb21wdXRlZENlbGxDb250YWluZXJXaWR0aChsYXlvdXRJbmZvOiBOb3RlYm9va0xheW91dEluZm8sIGRpZmZFZGl0b3I6IGJvb2xlYW4sIGZ1bGxXaWR0aDogYm9vbGVhbikge1xuXHRcdGlmIChmdWxsV2lkdGgpIHtcblx0XHRcdHJldHVybiBsYXlvdXRJbmZvLndpZHRoIC0gMiAqIERJRkZfQ0VMTF9NQVJHSU4gKyAoZGlmZkVkaXRvciA/IERpZmZFZGl0b3JXaWRnZXQuRU5USVJFX0RJRkZfT1ZFUlZJRVdfV0lEVEggOiAwKSAtIDI7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIChsYXlvdXRJbmZvLndpZHRoIC0gMiAqIERJRkZfQ0VMTF9NQVJHSU4gKyAoZGlmZkVkaXRvciA/IERpZmZFZGl0b3JXaWRnZXQuRU5USVJFX0RJRkZfT1ZFUlZJRVdfV0lEVEggOiAwKSkgLyAyIC0gMTggLSAyO1xuXHR9XG5cblx0Z2V0T3V0cHV0RWRpdG9yVmlld1N0YXRlKCk6IGVkaXRvckNvbW1vbi5JQ29kZUVkaXRvclZpZXdTdGF0ZSB8IGVkaXRvckNvbW1vbi5JRGlmZkVkaXRvclZpZXdTdGF0ZSB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLl9vdXRwdXRFZGl0b3JWaWV3U3RhdGU7XG5cdH1cblxuXHRzYXZlT3V0cHV0RWRpdG9yVmlld1N0YXRlKHZpZXdTdGF0ZTogZWRpdG9yQ29tbW9uLklDb2RlRWRpdG9yVmlld1N0YXRlIHwgZWRpdG9yQ29tbW9uLklEaWZmRWRpdG9yVmlld1N0YXRlIHwgbnVsbCkge1xuXHRcdHRoaXMuX291dHB1dEVkaXRvclZpZXdTdGF0ZSA9IHZpZXdTdGF0ZTtcblx0fVxuXG5cdGdldE1ldGFkYXRhRWRpdG9yVmlld1N0YXRlKCk6IGVkaXRvckNvbW1vbi5JQ29kZUVkaXRvclZpZXdTdGF0ZSB8IGVkaXRvckNvbW1vbi5JRGlmZkVkaXRvclZpZXdTdGF0ZSB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLl9tZXRhZGF0YUVkaXRvclZpZXdTdGF0ZTtcblx0fVxuXG5cdHNhdmVNZXRhZGF0YUVkaXRvclZpZXdTdGF0ZSh2aWV3U3RhdGU6IGVkaXRvckNvbW1vbi5JQ29kZUVkaXRvclZpZXdTdGF0ZSB8IGVkaXRvckNvbW1vbi5JRGlmZkVkaXRvclZpZXdTdGF0ZSB8IG51bGwpIHtcblx0XHR0aGlzLl9tZXRhZGF0YUVkaXRvclZpZXdTdGF0ZSA9IHZpZXdTdGF0ZTtcblx0fVxuXG5cdGdldFNvdXJjZUVkaXRvclZpZXdTdGF0ZSgpOiBlZGl0b3JDb21tb24uSUNvZGVFZGl0b3JWaWV3U3RhdGUgfCBlZGl0b3JDb21tb24uSURpZmZFZGl0b3JWaWV3U3RhdGUgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fc291cmNlRWRpdG9yVmlld1N0YXRlO1xuXHR9XG5cblx0c2F2ZVNwaXJjZUVkaXRvclZpZXdTdGF0ZSh2aWV3U3RhdGU6IGVkaXRvckNvbW1vbi5JQ29kZUVkaXRvclZpZXdTdGF0ZSB8IGVkaXRvckNvbW1vbi5JRGlmZkVkaXRvclZpZXdTdGF0ZSB8IG51bGwpIHtcblx0XHR0aGlzLl9zb3VyY2VFZGl0b3JWaWV3U3RhdGUgPSB2aWV3U3RhdGU7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNpZGVCeVNpZGVEaWZmRWxlbWVudFZpZXdNb2RlbCBleHRlbmRzIERpZmZFbGVtZW50Q2VsbFZpZXdNb2RlbEJhc2Uge1xuXHRnZXQgb3JpZ2luYWxEb2N1bWVudCgpIHtcblx0XHRyZXR1cm4gdGhpcy5vdGhlckRvY3VtZW50VGV4dE1vZGVsO1xuXHR9XG5cblx0Z2V0IG1vZGlmaWVkRG9jdW1lbnQoKSB7XG5cdFx0cmV0dXJuIHRoaXMubWFpbkRvY3VtZW50VGV4dE1vZGVsO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVhZG9ubHkgb3JpZ2luYWwhOiBEaWZmTmVzdGVkQ2VsbFZpZXdNb2RlbDtcblx0b3ZlcnJpZGUgcmVhZG9ubHkgbW9kaWZpZWQhOiBEaWZmTmVzdGVkQ2VsbFZpZXdNb2RlbDtcblx0b3ZlcnJpZGUgcmVhZG9ubHkgdHlwZTogJ3VuY2hhbmdlZCcgfCAnbW9kaWZpZWQnO1xuXG5cdC8qKlxuXHQgKiBUaGUgaGVpZ2h0IG9mIHRoZSBlZGl0b3Igd2hlbiB0aGUgdW5jaGFuZ2VkIGxpbmVzIGFyZSBjb2xsYXBzZWQuXG5cdCAqL1xuXHRwcml2YXRlIGVkaXRvckhlaWdodFdpdGhVbmNoYW5nZWRMaW5lc0NvbGxhcHNlZD86IG51bWJlcjtcblx0Y29uc3RydWN0b3IoXG5cdFx0bWFpbkRvY3VtZW50VGV4dE1vZGVsOiBOb3RlYm9va1RleHRNb2RlbCxcblx0XHRyZWFkb25seSBvdGhlckRvY3VtZW50VGV4dE1vZGVsOiBOb3RlYm9va1RleHRNb2RlbCxcblx0XHRvcmlnaW5hbDogTm90ZWJvb2tDZWxsVGV4dE1vZGVsLFxuXHRcdG1vZGlmaWVkOiBOb3RlYm9va0NlbGxUZXh0TW9kZWwsXG5cdFx0dHlwZTogJ3VuY2hhbmdlZCcgfCAnbW9kaWZpZWQnLFxuXHRcdGVkaXRvckV2ZW50RGlzcGF0Y2hlcjogTm90ZWJvb2tEaWZmRWRpdG9yRXZlbnREaXNwYXRjaGVyLFxuXHRcdGluaXREYXRhOiB7XG5cdFx0XHRtZXRhZGF0YVN0YXR1c0hlaWdodDogbnVtYmVyO1xuXHRcdFx0b3V0cHV0U3RhdHVzSGVpZ2h0OiBudW1iZXI7XG5cdFx0XHRmb250SW5mbzogRm9udEluZm8gfCB1bmRlZmluZWQ7XG5cdFx0fSxcblx0XHRub3RlYm9va1NlcnZpY2U6IElOb3RlYm9va1NlcnZpY2UsXG5cdFx0Y29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRpbmRleDogbnVtYmVyLFxuXHRcdGRpZmZFZGl0b3JIZWlnaHRDYWxjdWxhdG9yOiBJRGlmZkVkaXRvckhlaWdodENhbGN1bGF0b3JTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0bWFpbkRvY3VtZW50VGV4dE1vZGVsLFxuXHRcdFx0b3JpZ2luYWwsXG5cdFx0XHRtb2RpZmllZCxcblx0XHRcdHR5cGUsXG5cdFx0XHRlZGl0b3JFdmVudERpc3BhdGNoZXIsXG5cdFx0XHRpbml0RGF0YSxcblx0XHRcdG5vdGVib29rU2VydmljZSxcblx0XHRcdGluZGV4LFxuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0XHRkaWZmRWRpdG9ySGVpZ2h0Q2FsY3VsYXRvcik7XG5cblx0XHR0aGlzLnR5cGUgPSB0eXBlO1xuXG5cdFx0dGhpcy5jZWxsRm9sZGluZ1N0YXRlID0gdGhpcy5tb2RpZmllZC50ZXh0TW9kZWwuZ2V0VmFsdWUoKSAhPT0gdGhpcy5vcmlnaW5hbC50ZXh0TW9kZWwuZ2V0VmFsdWUoKSA/IFByb3BlcnR5Rm9sZGluZ1N0YXRlLkV4cGFuZGVkIDogUHJvcGVydHlGb2xkaW5nU3RhdGUuQ29sbGFwc2VkO1xuXHRcdHRoaXMubWV0YWRhdGFGb2xkaW5nU3RhdGUgPSBQcm9wZXJ0eUZvbGRpbmdTdGF0ZS5Db2xsYXBzZWQ7XG5cdFx0dGhpcy5vdXRwdXRGb2xkaW5nU3RhdGUgPSBQcm9wZXJ0eUZvbGRpbmdTdGF0ZS5Db2xsYXBzZWQ7XG5cblx0XHRpZiAodGhpcy5jaGVja01ldGFkYXRhSWZNb2RpZmllZCgpKSB7XG5cdFx0XHR0aGlzLm1ldGFkYXRhRm9sZGluZ1N0YXRlID0gUHJvcGVydHlGb2xkaW5nU3RhdGUuRXhwYW5kZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tJZk91dHB1dHNNb2RpZmllZCgpKSB7XG5cdFx0XHR0aGlzLm91dHB1dEZvbGRpbmdTdGF0ZSA9IFByb3BlcnR5Rm9sZGluZ1N0YXRlLkV4cGFuZGVkO1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub3JpZ2luYWwub25EaWRDaGFuZ2VPdXRwdXRMYXlvdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5fbGF5b3V0KHsgcmVjb21wdXRlT3V0cHV0OiB0cnVlIH0pO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubW9kaWZpZWQub25EaWRDaGFuZ2VPdXRwdXRMYXlvdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5fbGF5b3V0KHsgcmVjb21wdXRlT3V0cHV0OiB0cnVlIH0pO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubW9kaWZpZWQudGV4dE1vZGVsLm9uRGlkQ2hhbmdlQ29udGVudCgoKSA9PiB7XG5cdFx0XHRpZiAobWFpbkRvY3VtZW50VGV4dE1vZGVsLnRyYW5zaWVudE9wdGlvbnMuY2VsbENvbnRlbnRNZXRhZGF0YSkge1xuXHRcdFx0XHRjb25zdCBjZWxsTWV0YWRhdGFLZXlzID0gWy4uLk9iamVjdC5rZXlzKG1haW5Eb2N1bWVudFRleHRNb2RlbC50cmFuc2llbnRPcHRpb25zLmNlbGxDb250ZW50TWV0YWRhdGEpXTtcblx0XHRcdFx0Y29uc3QgbW9kaWZpZWRNZWRhdGFSYXcgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLm1vZGlmaWVkLm1ldGFkYXRhKTtcblx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxDZWxsTWV0YWRhdGEgPSB0aGlzLm9yaWdpbmFsLm1ldGFkYXRhO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGtleSBvZiBjZWxsTWV0YWRhdGFLZXlzKSB7XG5cdFx0XHRcdFx0aWYgKGtleSBpbiBvcmlnaW5hbENlbGxNZXRhZGF0YSkge1xuXHRcdFx0XHRcdFx0bW9kaWZpZWRNZWRhdGFSYXdba2V5XSA9IG9yaWdpbmFsQ2VsbE1ldGFkYXRhW2tleV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5tb2RpZmllZC50ZXh0TW9kZWwubWV0YWRhdGEgPSBtb2RpZmllZE1lZGF0YVJhdztcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRvdmVycmlkZSBjaGVja0lmSW5wdXRNb2RpZmllZCgpOiBmYWxzZSB8IHsgcmVhc29uOiBzdHJpbmcgfCB1bmRlZmluZWQgfSB7XG5cdFx0aWYgKHRoaXMub3JpZ2luYWwudGV4dE1vZGVsLmdldFRleHRCdWZmZXJIYXNoKCkgPT09IHRoaXMubW9kaWZpZWQudGV4dE1vZGVsLmdldFRleHRCdWZmZXJIYXNoKCkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlYXNvbjogJ0NlbGwgY29udGVudCBoYXMgY2hhbmdlZCcsXG5cdFx0fTtcblx0fVxuXHRjaGVja0lmT3V0cHV0c01vZGlmaWVkKCkge1xuXHRcdGlmICh0aGlzLm1haW5Eb2N1bWVudFRleHRNb2RlbC50cmFuc2llbnRPcHRpb25zLnRyYW5zaWVudE91dHB1dHMgfHwgdGhpcy5pZ25vcmVPdXRwdXRzKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmV0ID0gb3V0cHV0c0VxdWFsKHRoaXMub3JpZ2luYWw/Lm91dHB1dHMgPz8gW10sIHRoaXMubW9kaWZpZWQ/Lm91dHB1dHMgPz8gW10pO1xuXG5cdFx0aWYgKHJldCA9PT0gT3V0cHV0Q29tcGFyaXNvbi5VbmNoYW5nZWQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVhc29uOiByZXQgPT09IE91dHB1dENvbXBhcmlzb24uTWV0YWRhdGEgPyAnT3V0cHV0IG1ldGFkYXRhIGhhcyBjaGFuZ2VkJyA6IHVuZGVmaW5lZCxcblx0XHRcdGtpbmQ6IHJldFxuXHRcdH07XG5cdH1cblxuXHRjaGVja01ldGFkYXRhSWZNb2RpZmllZCgpIHtcblx0XHRpZiAodGhpcy5pZ25vcmVNZXRhZGF0YSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCBtb2RpZmllZCA9IGhhc2goZ2V0Rm9ybWF0dGVkTWV0YWRhdGFKU09OKHRoaXMubWFpbkRvY3VtZW50VGV4dE1vZGVsLnRyYW5zaWVudE9wdGlvbnMudHJhbnNpZW50Q2VsbE1ldGFkYXRhLCB0aGlzLm9yaWdpbmFsPy5tZXRhZGF0YSB8fCB7fSwgdGhpcy5vcmlnaW5hbD8ubGFuZ3VhZ2UpKSAhPT0gaGFzaChnZXRGb3JtYXR0ZWRNZXRhZGF0YUpTT04odGhpcy5tYWluRG9jdW1lbnRUZXh0TW9kZWwudHJhbnNpZW50T3B0aW9ucy50cmFuc2llbnRDZWxsTWV0YWRhdGEsIHRoaXMubW9kaWZpZWQ/Lm1ldGFkYXRhID8/IHt9LCB0aGlzLm1vZGlmaWVkPy5sYW5ndWFnZSkpO1xuXHRcdGlmIChtb2RpZmllZCkge1xuXHRcdFx0cmV0dXJuIHsgcmVhc29uOiB1bmRlZmluZWQgfTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHVwZGF0ZU91dHB1dEhlaWdodChkaWZmU2lkZTogRGlmZlNpZGUsIGluZGV4OiBudW1iZXIsIGhlaWdodDogbnVtYmVyKSB7XG5cdFx0aWYgKGRpZmZTaWRlID09PSBEaWZmU2lkZS5PcmlnaW5hbCkge1xuXHRcdFx0dGhpcy5vcmlnaW5hbC51cGRhdGVPdXRwdXRIZWlnaHQoaW5kZXgsIGhlaWdodCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubW9kaWZpZWQudXBkYXRlT3V0cHV0SGVpZ2h0KGluZGV4LCBoZWlnaHQpO1xuXHRcdH1cblx0fVxuXG5cdGdldE91dHB1dE9mZnNldEluQ29udGFpbmVyKGRpZmZTaWRlOiBEaWZmU2lkZSwgaW5kZXg6IG51bWJlcikge1xuXHRcdGlmIChkaWZmU2lkZSA9PT0gRGlmZlNpZGUuT3JpZ2luYWwpIHtcblx0XHRcdHJldHVybiB0aGlzLm9yaWdpbmFsLmdldE91dHB1dE9mZnNldChpbmRleCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLm1vZGlmaWVkLmdldE91dHB1dE9mZnNldChpbmRleCk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0T3V0cHV0T2Zmc2V0SW5DZWxsKGRpZmZTaWRlOiBEaWZmU2lkZSwgaW5kZXg6IG51bWJlcikge1xuXHRcdGNvbnN0IG9mZnNldEluT3V0cHV0c0NvbnRhaW5lciA9IHRoaXMuZ2V0T3V0cHV0T2Zmc2V0SW5Db250YWluZXIoZGlmZlNpZGUsIGluZGV4KTtcblxuXHRcdHJldHVybiB0aGlzLl9sYXlvdXRJbmZvLmVkaXRvckhlaWdodFxuXHRcdFx0KyB0aGlzLl9sYXlvdXRJbmZvLmVkaXRvck1hcmdpblxuXHRcdFx0KyB0aGlzLl9sYXlvdXRJbmZvLm1ldGFkYXRhSGVpZ2h0XG5cdFx0XHQrIHRoaXMuX2xheW91dEluZm8uY2VsbFN0YXR1c0hlaWdodFxuXHRcdFx0KyB0aGlzLl9sYXlvdXRJbmZvLm1ldGFkYXRhU3RhdHVzSGVpZ2h0XG5cdFx0XHQrIHRoaXMuX2xheW91dEluZm8ub3V0cHV0U3RhdHVzSGVpZ2h0XG5cdFx0XHQrIHRoaXMuX2xheW91dEluZm8uYm9keU1hcmdpbiAvIDJcblx0XHRcdCsgb2Zmc2V0SW5PdXRwdXRzQ29udGFpbmVyO1xuXHR9XG5cblx0aXNPdXRwdXRFbXB0eSgpIHtcblx0XHRpZiAodGhpcy5tYWluRG9jdW1lbnRUZXh0TW9kZWwudHJhbnNpZW50T3B0aW9ucy50cmFuc2llbnRPdXRwdXRzKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja0lmT3V0cHV0c01vZGlmaWVkKCkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBvdXRwdXRzIGFyZSBub3QgY2hhbmdlZFxuXG5cdFx0cmV0dXJuICh0aGlzLm9yaWdpbmFsPy5vdXRwdXRzIHx8IFtdKS5sZW5ndGggPT09IDA7XG5cdH1cblxuXHRnZXRSaWNoT3V0cHV0VG90YWxIZWlnaHQoKSB7XG5cdFx0cmV0dXJuIE1hdGgubWF4KHRoaXMub3JpZ2luYWwuZ2V0T3V0cHV0VG90YWxIZWlnaHQoKSwgdGhpcy5tb2RpZmllZC5nZXRPdXRwdXRUb3RhbEhlaWdodCgpKTtcblx0fVxuXG5cdGdldE5lc3RlZENlbGxWaWV3TW9kZWwoZGlmZlNpZGU6IERpZmZTaWRlKTogRGlmZk5lc3RlZENlbGxWaWV3TW9kZWwge1xuXHRcdHJldHVybiBkaWZmU2lkZSA9PT0gRGlmZlNpZGUuT3JpZ2luYWwgPyB0aGlzLm9yaWdpbmFsIDogdGhpcy5tb2RpZmllZDtcblx0fVxuXG5cdGdldENlbGxCeVVyaShjZWxsVXJpOiBVUkkpOiBJR2VuZXJpY0NlbGxWaWV3TW9kZWwge1xuXHRcdGlmIChjZWxsVXJpLnRvU3RyaW5nKCkgPT09IHRoaXMub3JpZ2luYWwudXJpLnRvU3RyaW5nKCkpIHtcblx0XHRcdHJldHVybiB0aGlzLm9yaWdpbmFsO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5tb2RpZmllZDtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgY29tcHV0ZUlucHV0RWRpdG9ySGVpZ2h0KGxpbmVIZWlnaHQ6IG51bWJlcik6IG51bWJlciB7XG5cdFx0aWYgKHRoaXMudHlwZSA9PT0gJ21vZGlmaWVkJyAmJlxuXHRcdFx0dHlwZW9mIHRoaXMuZWRpdG9ySGVpZ2h0V2l0aFVuY2hhbmdlZExpbmVzQ29sbGFwc2VkID09PSAnbnVtYmVyJyAmJlxuXHRcdFx0dGhpcy5jaGVja0lmSW5wdXRNb2RpZmllZCgpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5lZGl0b3JIZWlnaHRXaXRoVW5jaGFuZ2VkTGluZXNDb2xsYXBzZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN1cGVyLmNvbXB1dGVJbnB1dEVkaXRvckhlaWdodChsaW5lSGVpZ2h0KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgY29tcHV0ZU1vZGlmaWVkSW5wdXRFZGl0b3JIZWlnaHQoKSB7XG5cdFx0aWYgKHRoaXMuY2hlY2tJZklucHV0TW9kaWZpZWQoKSkge1xuXHRcdFx0dGhpcy5lZGl0b3JIZWlnaHRXaXRoVW5jaGFuZ2VkTGluZXNDb2xsYXBzZWQgPSB0aGlzLl9sYXlvdXRJbmZvLmVkaXRvckhlaWdodCA9IGF3YWl0IHRoaXMuZGlmZkVkaXRvckhlaWdodENhbGN1bGF0b3IuZGlmZkFuZENvbXB1dGVIZWlnaHQodGhpcy5vcmlnaW5hbC51cmksIHRoaXMubW9kaWZpZWQudXJpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNvbXB1dGVNb2RpZmllZE1ldGFkYXRhRWRpdG9ySGVpZ2h0KCkge1xuXHRcdGlmICh0aGlzLmNoZWNrTWV0YWRhdGFJZk1vZGlmaWVkKCkpIHtcblx0XHRcdGNvbnN0IG9yaWdpbmFsTWV0YWRhdGFVcmkgPSBDZWxsVXJpLmdlbmVyYXRlQ2VsbFByb3BlcnR5VXJpKHRoaXMub3JpZ2luYWxEb2N1bWVudC51cmksIHRoaXMub3JpZ2luYWwuaGFuZGxlLCBTY2hlbWFzLnZzY29kZU5vdGVib29rQ2VsbE1ldGFkYXRhKTtcblx0XHRcdGNvbnN0IG1vZGlmaWVkTWV0YWRhdGFVcmkgPSBDZWxsVXJpLmdlbmVyYXRlQ2VsbFByb3BlcnR5VXJpKHRoaXMubW9kaWZpZWREb2N1bWVudC51cmksIHRoaXMubW9kaWZpZWQuaGFuZGxlLCBTY2hlbWFzLnZzY29kZU5vdGVib29rQ2VsbE1ldGFkYXRhKTtcblx0XHRcdHRoaXMuX2xheW91dEluZm8ubWV0YWRhdGFIZWlnaHQgPSBhd2FpdCB0aGlzLmRpZmZFZGl0b3JIZWlnaHRDYWxjdWxhdG9yLmRpZmZBbmRDb21wdXRlSGVpZ2h0KG9yaWdpbmFsTWV0YWRhdGFVcmksIG1vZGlmaWVkTWV0YWRhdGFVcmkpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBhc3luYyBjb21wdXRlRWRpdG9ySGVpZ2h0cygpIHtcblx0XHRpZiAodGhpcy50eXBlID09PSAndW5jaGFuZ2VkJykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGF3YWl0IFByb21pc2UuYWxsKFt0aGlzLmNvbXB1dGVNb2RpZmllZElucHV0RWRpdG9ySGVpZ2h0KCksIHRoaXMuY29tcHV0ZU1vZGlmaWVkTWV0YWRhdGFFZGl0b3JIZWlnaHQoKV0pO1xuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIFNpbmdsZVNpZGVEaWZmRWxlbWVudFZpZXdNb2RlbCBleHRlbmRzIERpZmZFbGVtZW50Q2VsbFZpZXdNb2RlbEJhc2Uge1xuXHRnZXQgY2VsbFZpZXdNb2RlbCgpIHtcblx0XHRyZXR1cm4gdGhpcy50eXBlID09PSAnaW5zZXJ0JyA/IHRoaXMubW9kaWZpZWQhIDogdGhpcy5vcmlnaW5hbCE7XG5cdH1cblxuXHRnZXQgb3JpZ2luYWxEb2N1bWVudCgpIHtcblx0XHRpZiAodGhpcy50eXBlID09PSAnaW5zZXJ0Jykge1xuXHRcdFx0cmV0dXJuIHRoaXMub3RoZXJEb2N1bWVudFRleHRNb2RlbDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMubWFpbkRvY3VtZW50VGV4dE1vZGVsO1xuXHRcdH1cblx0fVxuXG5cdGdldCBtb2RpZmllZERvY3VtZW50KCkge1xuXHRcdGlmICh0aGlzLnR5cGUgPT09ICdpbnNlcnQnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5tYWluRG9jdW1lbnRUZXh0TW9kZWw7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLm90aGVyRG9jdW1lbnRUZXh0TW9kZWw7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgcmVhZG9ubHkgdHlwZTogJ2luc2VydCcgfCAnZGVsZXRlJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRtYWluRG9jdW1lbnRUZXh0TW9kZWw6IE5vdGVib29rVGV4dE1vZGVsLFxuXHRcdHJlYWRvbmx5IG90aGVyRG9jdW1lbnRUZXh0TW9kZWw6IE5vdGVib29rVGV4dE1vZGVsLFxuXHRcdG9yaWdpbmFsOiBOb3RlYm9va0NlbGxUZXh0TW9kZWwgfCB1bmRlZmluZWQsXG5cdFx0bW9kaWZpZWQ6IE5vdGVib29rQ2VsbFRleHRNb2RlbCB8IHVuZGVmaW5lZCxcblx0XHR0eXBlOiAnaW5zZXJ0JyB8ICdkZWxldGUnLFxuXHRcdGVkaXRvckV2ZW50RGlzcGF0Y2hlcjogTm90ZWJvb2tEaWZmRWRpdG9yRXZlbnREaXNwYXRjaGVyLFxuXHRcdGluaXREYXRhOiB7XG5cdFx0XHRtZXRhZGF0YVN0YXR1c0hlaWdodDogbnVtYmVyO1xuXHRcdFx0b3V0cHV0U3RhdHVzSGVpZ2h0OiBudW1iZXI7XG5cdFx0XHRmb250SW5mbzogRm9udEluZm8gfCB1bmRlZmluZWQ7XG5cdFx0fSxcblx0XHRub3RlYm9va1NlcnZpY2U6IElOb3RlYm9va1NlcnZpY2UsXG5cdFx0Y29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRkaWZmRWRpdG9ySGVpZ2h0Q2FsY3VsYXRvcjogSURpZmZFZGl0b3JIZWlnaHRDYWxjdWxhdG9yU2VydmljZSxcblx0XHRpbmRleDogbnVtYmVyXG5cdCkge1xuXHRcdHN1cGVyKG1haW5Eb2N1bWVudFRleHRNb2RlbCwgb3JpZ2luYWwsIG1vZGlmaWVkLCB0eXBlLCBlZGl0b3JFdmVudERpc3BhdGNoZXIsIGluaXREYXRhLCBub3RlYm9va1NlcnZpY2UsIGluZGV4LCBjb25maWd1cmF0aW9uU2VydmljZSwgZGlmZkVkaXRvckhlaWdodENhbGN1bGF0b3IpO1xuXHRcdHRoaXMudHlwZSA9IHR5cGU7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNlbGxWaWV3TW9kZWwub25EaWRDaGFuZ2VPdXRwdXRMYXlvdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5fbGF5b3V0KHsgcmVjb21wdXRlT3V0cHV0OiB0cnVlIH0pO1xuXHRcdH0pKTtcblx0fVxuXG5cdG92ZXJyaWRlIGNoZWNrSWZJbnB1dE1vZGlmaWVkKCk6IGZhbHNlIHwgeyByZWFzb246IHN0cmluZyB8IHVuZGVmaW5lZCB9IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVhc29uOiAnQ2VsbCBjb250ZW50IGhhcyBjaGFuZ2VkJyxcblx0XHR9O1xuXHR9XG5cblx0Z2V0TmVzdGVkQ2VsbFZpZXdNb2RlbChkaWZmU2lkZTogRGlmZlNpZGUpOiBEaWZmTmVzdGVkQ2VsbFZpZXdNb2RlbCB7XG5cdFx0cmV0dXJuIHRoaXMudHlwZSA9PT0gJ2luc2VydCcgPyB0aGlzLm1vZGlmaWVkISA6IHRoaXMub3JpZ2luYWwhO1xuXHR9XG5cblxuXHRjaGVja0lmT3V0cHV0c01vZGlmaWVkKCk6IGZhbHNlIHwgeyByZWFzb246IHN0cmluZyB8IHVuZGVmaW5lZCB9IHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRjaGVja01ldGFkYXRhSWZNb2RpZmllZCgpOiBmYWxzZSB8IHsgcmVhc29uOiBzdHJpbmcgfCB1bmRlZmluZWQgfSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0dXBkYXRlT3V0cHV0SGVpZ2h0KGRpZmZTaWRlOiBEaWZmU2lkZSwgaW5kZXg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpIHtcblx0XHR0aGlzLmNlbGxWaWV3TW9kZWw/LnVwZGF0ZU91dHB1dEhlaWdodChpbmRleCwgaGVpZ2h0KTtcblx0fVxuXG5cdGdldE91dHB1dE9mZnNldEluQ29udGFpbmVyKGRpZmZTaWRlOiBEaWZmU2lkZSwgaW5kZXg6IG51bWJlcikge1xuXHRcdHJldHVybiB0aGlzLmNlbGxWaWV3TW9kZWwuZ2V0T3V0cHV0T2Zmc2V0KGluZGV4KTtcblx0fVxuXG5cdGdldE91dHB1dE9mZnNldEluQ2VsbChkaWZmU2lkZTogRGlmZlNpZGUsIGluZGV4OiBudW1iZXIpIHtcblx0XHRjb25zdCBvZmZzZXRJbk91dHB1dHNDb250YWluZXIgPSB0aGlzLmNlbGxWaWV3TW9kZWwuZ2V0T3V0cHV0T2Zmc2V0KGluZGV4KTtcblxuXHRcdHJldHVybiB0aGlzLl9sYXlvdXRJbmZvLmVkaXRvckhlaWdodFxuXHRcdFx0KyB0aGlzLl9sYXlvdXRJbmZvLmVkaXRvck1hcmdpblxuXHRcdFx0KyB0aGlzLl9sYXlvdXRJbmZvLm1ldGFkYXRhSGVpZ2h0XG5cdFx0XHQrIHRoaXMuX2xheW91dEluZm8uY2VsbFN0YXR1c0hlaWdodFxuXHRcdFx0KyB0aGlzLl9sYXlvdXRJbmZvLm1ldGFkYXRhU3RhdHVzSGVpZ2h0XG5cdFx0XHQrIHRoaXMuX2xheW91dEluZm8ub3V0cHV0U3RhdHVzSGVpZ2h0XG5cdFx0XHQrIHRoaXMuX2xheW91dEluZm8uYm9keU1hcmdpbiAvIDJcblx0XHRcdCsgb2Zmc2V0SW5PdXRwdXRzQ29udGFpbmVyO1xuXHR9XG5cblx0aXNPdXRwdXRFbXB0eSgpIHtcblx0XHRpZiAodGhpcy5tYWluRG9jdW1lbnRUZXh0TW9kZWwudHJhbnNpZW50T3B0aW9ucy50cmFuc2llbnRPdXRwdXRzKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBvdXRwdXRzIGFyZSBub3QgY2hhbmdlZFxuXG5cdFx0cmV0dXJuICh0aGlzLm9yaWdpbmFsPy5vdXRwdXRzIHx8IHRoaXMubW9kaWZpZWQ/Lm91dHB1dHMgfHwgW10pLmxlbmd0aCA9PT0gMDtcblx0fVxuXG5cdGdldFJpY2hPdXRwdXRUb3RhbEhlaWdodCgpIHtcblx0XHRyZXR1cm4gdGhpcy5jZWxsVmlld01vZGVsPy5nZXRPdXRwdXRUb3RhbEhlaWdodCgpID8/IDA7XG5cdH1cblxuXHRnZXRDZWxsQnlVcmkoY2VsbFVyaTogVVJJKTogSUdlbmVyaWNDZWxsVmlld01vZGVsIHtcblx0XHRyZXR1cm4gdGhpcy5jZWxsVmlld01vZGVsO1xuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIE91dHB1dENvbXBhcmlzb24ge1xuXHRVbmNoYW5nZWQgPSAwLFxuXHRNZXRhZGF0YSA9IDEsXG5cdE90aGVyID0gMlxufVxuXG5leHBvcnQgZnVuY3Rpb24gb3V0cHV0RXF1YWwoYTogSUNlbGxPdXRwdXQsIGI6IElDZWxsT3V0cHV0KTogT3V0cHV0Q29tcGFyaXNvbiB7XG5cdGlmIChoYXNoKGEubWV0YWRhdGEpID09PSBoYXNoKGIubWV0YWRhdGEpKSB7XG5cdFx0cmV0dXJuIE91dHB1dENvbXBhcmlzb24uT3RoZXI7XG5cdH1cblxuXHQvLyBtZXRhZGF0YSBub3QgZXF1YWxcblx0Zm9yIChsZXQgaiA9IDA7IGogPCBhLm91dHB1dHMubGVuZ3RoOyBqKyspIHtcblx0XHRjb25zdCBhT3V0cHV0SXRlbSA9IGEub3V0cHV0c1tqXTtcblx0XHRjb25zdCBiT3V0cHV0SXRlbSA9IGIub3V0cHV0c1tqXTtcblxuXHRcdGlmIChhT3V0cHV0SXRlbS5taW1lICE9PSBiT3V0cHV0SXRlbS5taW1lKSB7XG5cdFx0XHRyZXR1cm4gT3V0cHV0Q29tcGFyaXNvbi5PdGhlcjtcblx0XHR9XG5cblx0XHRpZiAoYU91dHB1dEl0ZW0uZGF0YS5idWZmZXIubGVuZ3RoICE9PSBiT3V0cHV0SXRlbS5kYXRhLmJ1ZmZlci5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBPdXRwdXRDb21wYXJpc29uLk90aGVyO1xuXHRcdH1cblxuXHRcdGZvciAobGV0IGsgPSAwOyBrIDwgYU91dHB1dEl0ZW0uZGF0YS5idWZmZXIubGVuZ3RoOyBrKyspIHtcblx0XHRcdGlmIChhT3V0cHV0SXRlbS5kYXRhLmJ1ZmZlcltrXSAhPT0gYk91dHB1dEl0ZW0uZGF0YS5idWZmZXJba10pIHtcblx0XHRcdFx0cmV0dXJuIE91dHB1dENvbXBhcmlzb24uT3RoZXI7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIE91dHB1dENvbXBhcmlzb24uTWV0YWRhdGE7XG59XG5cbmZ1bmN0aW9uIG91dHB1dHNFcXVhbChvcmlnaW5hbDogSUNlbGxPdXRwdXRbXSwgbW9kaWZpZWQ6IElDZWxsT3V0cHV0W10pIHtcblx0aWYgKG9yaWdpbmFsLmxlbmd0aCAhPT0gbW9kaWZpZWQubGVuZ3RoKSB7XG5cdFx0cmV0dXJuIE91dHB1dENvbXBhcmlzb24uT3RoZXI7XG5cdH1cblxuXHRjb25zdCBsZW4gPSBvcmlnaW5hbC5sZW5ndGg7XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcblx0XHRjb25zdCBhID0gb3JpZ2luYWxbaV07XG5cdFx0Y29uc3QgYiA9IG1vZGlmaWVkW2ldO1xuXG5cdFx0aWYgKGhhc2goYS5tZXRhZGF0YSkgIT09IGhhc2goYi5tZXRhZGF0YSkpIHtcblx0XHRcdHJldHVybiBPdXRwdXRDb21wYXJpc29uLk1ldGFkYXRhO1xuXHRcdH1cblxuXHRcdGlmIChhLm91dHB1dHMubGVuZ3RoICE9PSBiLm91dHB1dHMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gT3V0cHV0Q29tcGFyaXNvbi5PdGhlcjtcblx0XHR9XG5cblx0XHRmb3IgKGxldCBqID0gMDsgaiA8IGEub3V0cHV0cy5sZW5ndGg7IGorKykge1xuXHRcdFx0Y29uc3QgYU91dHB1dEl0ZW0gPSBhLm91dHB1dHNbal07XG5cdFx0XHRjb25zdCBiT3V0cHV0SXRlbSA9IGIub3V0cHV0c1tqXTtcblxuXHRcdFx0aWYgKGFPdXRwdXRJdGVtLm1pbWUgIT09IGJPdXRwdXRJdGVtLm1pbWUpIHtcblx0XHRcdFx0cmV0dXJuIE91dHB1dENvbXBhcmlzb24uT3RoZXI7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChhT3V0cHV0SXRlbS5kYXRhLmJ1ZmZlci5sZW5ndGggIT09IGJPdXRwdXRJdGVtLmRhdGEuYnVmZmVyLmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm4gT3V0cHV0Q29tcGFyaXNvbi5PdGhlcjtcblx0XHRcdH1cblxuXHRcdFx0Zm9yIChsZXQgayA9IDA7IGsgPCBhT3V0cHV0SXRlbS5kYXRhLmJ1ZmZlci5sZW5ndGg7IGsrKykge1xuXHRcdFx0XHRpZiAoYU91dHB1dEl0ZW0uZGF0YS5idWZmZXJba10gIT09IGJPdXRwdXRJdGVtLmRhdGEuYnVmZmVyW2tdKSB7XG5cdFx0XHRcdFx0cmV0dXJuIE91dHB1dENvbXBhcmlzb24uT3RoZXI7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gT3V0cHV0Q29tcGFyaXNvbi5VbmNoYW5nZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTdHJlYW1PdXRwdXREYXRhKG91dHB1dHM6IElPdXRwdXRJdGVtRHRvW10pIHtcblx0aWYgKCFvdXRwdXRzLmxlbmd0aCkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0Y29uc3QgZmlyc3QgPSBvdXRwdXRzWzBdO1xuXHRjb25zdCBtaW1lID0gZmlyc3QubWltZTtcblx0Y29uc3Qgc2FtZVN0cmVhbSA9ICFvdXRwdXRzLmZpbmQob3AgPT4gb3AubWltZSAhPT0gbWltZSk7XG5cblx0aWYgKHNhbWVTdHJlYW0pIHtcblx0XHRyZXR1cm4gb3V0cHV0cy5tYXAob3BpdCA9PiBvcGl0LmRhdGEudG9TdHJpbmcoKSkuam9pbignJyk7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEZvcm1hdHRlZE91dHB1dEpTT04ob3V0cHV0czogSU91dHB1dER0b1tdKSB7XG5cdGlmIChvdXRwdXRzLmxlbmd0aCA9PT0gMSkge1xuXHRcdGNvbnN0IHN0cmVhbU91dHB1dERhdGEgPSBnZXRTdHJlYW1PdXRwdXREYXRhKG91dHB1dHNbMF0ub3V0cHV0cyk7XG5cdFx0aWYgKHN0cmVhbU91dHB1dERhdGEpIHtcblx0XHRcdHJldHVybiBzdHJlYW1PdXRwdXREYXRhO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBKU09OLnN0cmluZ2lmeShvdXRwdXRzLm1hcChvdXRwdXQgPT4ge1xuXHRcdHJldHVybiAoe1xuXHRcdFx0bWV0YWRhdGE6IG91dHB1dC5tZXRhZGF0YSxcblx0XHRcdG91dHB1dEl0ZW1zOiBvdXRwdXQub3V0cHV0cy5tYXAob3BpdCA9PiAoe1xuXHRcdFx0XHRtaW1lVHlwZTogb3BpdC5taW1lLFxuXHRcdFx0XHRkYXRhOiBvcGl0LmRhdGEudG9TdHJpbmcoKVxuXHRcdFx0fSkpXG5cdFx0fSk7XG5cdH0pLCB1bmRlZmluZWQsICdcXHQnKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZUFBZTtBQUN4QixTQUFTLFlBQVk7QUFDckIsU0FBUyxrQkFBa0I7QUFFM0IsU0FBUyx3QkFBd0I7QUFHakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUywrQkFBK0I7QUFDeEMsU0FBNEMsaUNBQWlDO0FBQzdFLFNBQTZDLGtCQUFrQixnQkFBd0M7QUFDdkcsU0FBUyx1QkFBOEM7QUFFdkQsU0FBUyxnQ0FBdUQ7QUFFaEUsU0FBUyxlQUE0RTtBQUdyRixTQUFTLGVBQWU7QUFFeEIsU0FBUyx5Q0FBeUM7QUFFbEQsTUFBTSx1QkFBdUI7QUFHdEIsTUFBTSx3Q0FBd0M7QUFFOUMsTUFBTSxvQkFBb0I7QUFFMUIsSUFBSyx1QkFBTCxrQkFBS0EsMEJBQUw7QUFDTixFQUFBQSw0Q0FBQTtBQUNBLEVBQUFBLDRDQUFBO0FBRlcsU0FBQUE7QUFBQSxHQUFBO0FBS0wsTUFBTSw2QkFBNkI7QUFVbkMsTUFBZSxpQ0FBaUMsV0FBVztBQUFBLEVBSWpFLFlBQ2lCLHVCQUNBLHVCQUNBLFVBS2Y7QUFDRCxVQUFNO0FBUlU7QUFDQTtBQUNBO0FBTmpCLFNBQVUscUJBQXFCLEtBQUssVUFBVSxJQUFJLFFBQTRDLENBQUM7QUFDL0YsNkJBQW9CLEtBQUssbUJBQW1CO0FBYTND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
