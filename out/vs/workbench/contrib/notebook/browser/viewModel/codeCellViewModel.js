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
import { Emitter, PauseableEmitter } from "../../../../../base/common/event.js";
import { dispose } from "../../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../../base/common/observable.js";
import * as UUID from "../../../../../base/common/uuid.js";
import { ICodeEditorService } from "../../../../../editor/browser/services/codeEditorService.js";
import { PrefixSumComputer } from "../../../../../editor/common/model/prefixSumComputer.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IUndoRedoService } from "../../../../../platform/undoRedo/common/undoRedo.js";
import { CellEditState, CellLayoutState } from "../notebookBrowser.js";
import { CellOutputViewModel } from "./cellOutputViewModel.js";
import { CellKind } from "../../common/notebookCommon.js";
import { INotebookService } from "../../common/notebookService.js";
import { BaseCellViewModel } from "./baseCellViewModel.js";
import { IInlineChatSessionService } from "../../../inlineChat/browser/inlineChatSessionService.js";
const outputDisplayLimit = 500;
let CodeCellViewModel = class extends BaseCellViewModel {
  constructor(viewType, model, initialNotebookLayoutInfo, viewContext, configurationService, _notebookService, modelService, undoRedoService, codeEditorService, inlineChatSessionService) {
    super(viewType, model, UUID.generateUuid(), viewContext, configurationService, modelService, undoRedoService, codeEditorService, inlineChatSessionService);
    this.viewContext = viewContext;
    this._notebookService = _notebookService;
    this.cellKind = CellKind.Code;
    this._onLayoutInfoRead = this._register(new Emitter());
    this.onLayoutInfoRead = this._onLayoutInfoRead.event;
    this._onDidStartExecution = this._register(new Emitter());
    this.onDidStartExecution = this._onDidStartExecution.event;
    this._onDidStopExecution = this._register(new Emitter());
    this.onDidStopExecution = this._onDidStopExecution.event;
    this._onDidChangeOutputs = this._register(new Emitter());
    this.onDidChangeOutputs = this._onDidChangeOutputs.event;
    this._onDidRemoveOutputs = this._register(new Emitter());
    this.onDidRemoveOutputs = this._onDidRemoveOutputs.event;
    this._outputCollection = [];
    this._outputsTop = null;
    this._pauseableEmitter = this._register(new PauseableEmitter());
    this.onDidChangeLayout = this._pauseableEmitter.event;
    this._editorHeight = 0;
    this._chatHeight = 0;
    this._hoveringOutput = false;
    this._focusOnOutput = false;
    this._focusInputInOutput = false;
    this._outputMinHeight = 0;
    this.executionErrorDiagnostic = observableValue("excecutionError", void 0);
    this._hasFindResult = this._register(new Emitter());
    this.hasFindResult = this._hasFindResult.event;
    this._outputViewModels = this.model.outputs.map((output) => new CellOutputViewModel(this, output, this._notebookService));
    this._register(this.model.onDidChangeOutputs((splice) => {
      const removedOutputs = [];
      let outputLayoutChange = false;
      for (let i = splice.start; i < splice.start + splice.deleteCount; i++) {
        if (this._outputCollection[i] !== void 0 && this._outputCollection[i] !== 0) {
          outputLayoutChange = true;
        }
      }
      this._outputCollection.splice(splice.start, splice.deleteCount, ...splice.newOutputs.map(() => 0));
      removedOutputs.push(...this._outputViewModels.splice(splice.start, splice.deleteCount, ...splice.newOutputs.map((output) => new CellOutputViewModel(this, output, this._notebookService))));
      this._outputsTop = null;
      this._onDidChangeOutputs.fire(splice);
      this._onDidRemoveOutputs.fire(removedOutputs);
      if (outputLayoutChange) {
        this.layoutChange({ outputHeight: true }, "CodeCellViewModel#model.onDidChangeOutputs");
      }
      if (!this._outputCollection.length) {
        this.executionErrorDiagnostic.set(void 0, void 0);
      }
      dispose(removedOutputs);
    }));
    this._outputCollection = new Array(this.model.outputs.length);
    this._layoutInfo = {
      fontInfo: initialNotebookLayoutInfo?.fontInfo || null,
      editorHeight: 0,
      editorWidth: initialNotebookLayoutInfo ? this.viewContext.notebookOptions.computeCodeCellEditorWidth(initialNotebookLayoutInfo.width) : 0,
      chatHeight: 0,
      statusBarHeight: 0,
      commentOffset: 0,
      commentHeight: 0,
      outputContainerOffset: 0,
      outputTotalHeight: 0,
      outputShowMoreContainerHeight: 0,
      outputShowMoreContainerOffset: 0,
      totalHeight: this.computeTotalHeight(17, 0, 0, 0),
      codeIndicatorHeight: 0,
      outputIndicatorHeight: 0,
      bottomToolbarOffset: 0,
      layoutState: CellLayoutState.Uninitialized,
      estimatedHasHorizontalScrolling: false
    };
  }
  set editorHeight(height) {
    if (this._editorHeight === height) {
      return;
    }
    this._editorHeight = height;
    this.layoutChange({ editorHeight: true }, "CodeCellViewModel#editorHeight");
  }
  get editorHeight() {
    throw new Error("editorHeight is write-only");
  }
  set chatHeight(height) {
    if (this._chatHeight === height) {
      return;
    }
    this._chatHeight = height;
    this.layoutChange({ chatHeight: true }, "CodeCellViewModel#chatHeight");
  }
  get chatHeight() {
    return this._chatHeight;
  }
  get outputIsHovered() {
    return this._hoveringOutput;
  }
  set outputIsHovered(v) {
    this._hoveringOutput = v;
    this._onDidChangeState.fire({ outputIsHoveredChanged: true });
  }
  get outputIsFocused() {
    return this._focusOnOutput;
  }
  set outputIsFocused(v) {
    this._focusOnOutput = v;
    this._onDidChangeState.fire({ outputIsFocusedChanged: true });
  }
  get inputInOutputIsFocused() {
    return this._focusInputInOutput;
  }
  set inputInOutputIsFocused(v) {
    this._focusInputInOutput = v;
  }
  get outputMinHeight() {
    return this._outputMinHeight;
  }
  /**
   * The minimum height of the output region. It's only set to non-zero temporarily when replacing an output with a new one.
   * It's reset to 0 when the new output is rendered, or in one second.
   */
  set outputMinHeight(newMin) {
    this._outputMinHeight = newMin;
  }
  get layoutInfo() {
    return this._layoutInfo;
  }
  get outputsViewModels() {
    return this._outputViewModels;
  }
  updateExecutionState(e) {
    if (e.changed) {
      this.executionErrorDiagnostic.set(void 0, void 0);
      this._onDidStartExecution.fire(e);
    } else {
      this._onDidStopExecution.fire(e);
    }
  }
  updateOptions(e) {
    super.updateOptions(e);
    if (e.cellStatusBarVisibility || e.insertToolbarPosition || e.cellToolbarLocation) {
      this.layoutChange({});
    }
  }
  pauseLayout() {
    this._pauseableEmitter.pause();
  }
  resumeLayout() {
    this._pauseableEmitter.resume();
  }
  layoutChange(state, source) {
    this._ensureOutputsTop();
    const notebookLayoutConfiguration = this.viewContext.notebookOptions.getLayoutConfiguration();
    const bottomToolbarDimensions = this.viewContext.notebookOptions.computeBottomToolbarDimensions(this.viewType);
    const outputShowMoreContainerHeight = state.outputShowMoreContainerHeight ? state.outputShowMoreContainerHeight : this._layoutInfo.outputShowMoreContainerHeight;
    const outputTotalHeight = Math.max(this._outputMinHeight, this.isOutputCollapsed ? notebookLayoutConfiguration.collapsedIndicatorHeight : this._outputsTop.getTotalSum());
    const commentHeight = state.commentHeight ? this._commentHeight : this._layoutInfo.commentHeight;
    const originalLayout = this.layoutInfo;
    if (!this.isInputCollapsed) {
      let newState;
      let editorHeight;
      let totalHeight;
      let hasHorizontalScrolling = false;
      const chatHeight = state.chatHeight ? this._chatHeight : this._layoutInfo.chatHeight;
      if (!state.editorHeight && this._layoutInfo.layoutState === CellLayoutState.FromCache && !state.outputHeight) {
        const estimate = this.estimateEditorHeight(state.font?.lineHeight ?? this._layoutInfo.fontInfo?.lineHeight);
        editorHeight = estimate.editorHeight;
        hasHorizontalScrolling = estimate.hasHorizontalScrolling;
        totalHeight = this._layoutInfo.totalHeight;
        newState = CellLayoutState.FromCache;
      } else if (state.editorHeight || this._layoutInfo.layoutState === CellLayoutState.Measured) {
        editorHeight = this._editorHeight;
        totalHeight = this.computeTotalHeight(this._editorHeight, outputTotalHeight, outputShowMoreContainerHeight, chatHeight);
        newState = CellLayoutState.Measured;
        hasHorizontalScrolling = this._layoutInfo.estimatedHasHorizontalScrolling;
      } else {
        const estimate = this.estimateEditorHeight(state.font?.lineHeight ?? this._layoutInfo.fontInfo?.lineHeight);
        editorHeight = estimate.editorHeight;
        hasHorizontalScrolling = estimate.hasHorizontalScrolling;
        totalHeight = this.computeTotalHeight(editorHeight, outputTotalHeight, outputShowMoreContainerHeight, chatHeight);
        newState = CellLayoutState.Estimated;
      }
      const statusBarHeight = this.viewContext.notebookOptions.computeEditorStatusbarHeight(this.internalMetadata, this.uri);
      const codeIndicatorHeight = editorHeight + statusBarHeight;
      const outputIndicatorHeight = outputTotalHeight + outputShowMoreContainerHeight;
      const outputContainerOffset = notebookLayoutConfiguration.editorToolbarHeight + notebookLayoutConfiguration.cellTopMargin + chatHeight + editorHeight + statusBarHeight;
      const outputShowMoreContainerOffset = totalHeight - bottomToolbarDimensions.bottomToolbarGap - bottomToolbarDimensions.bottomToolbarHeight / 2 - outputShowMoreContainerHeight;
      const bottomToolbarOffset = this.viewContext.notebookOptions.computeBottomToolbarOffset(totalHeight, this.viewType);
      const editorWidth = state.outerWidth !== void 0 ? this.viewContext.notebookOptions.computeCodeCellEditorWidth(state.outerWidth) : this._layoutInfo?.editorWidth;
      this._layoutInfo = {
        fontInfo: state.font ?? this._layoutInfo.fontInfo ?? null,
        chatHeight,
        editorHeight,
        editorWidth,
        statusBarHeight,
        outputContainerOffset,
        outputTotalHeight,
        outputShowMoreContainerHeight,
        outputShowMoreContainerOffset,
        commentOffset: outputContainerOffset + outputTotalHeight,
        commentHeight,
        totalHeight,
        codeIndicatorHeight,
        outputIndicatorHeight,
        bottomToolbarOffset,
        layoutState: newState,
        estimatedHasHorizontalScrolling: hasHorizontalScrolling
      };
    } else {
      const codeIndicatorHeight = notebookLayoutConfiguration.collapsedIndicatorHeight;
      const outputIndicatorHeight = outputTotalHeight + outputShowMoreContainerHeight;
      const chatHeight = state.chatHeight ? this._chatHeight : this._layoutInfo.chatHeight;
      const outputContainerOffset = notebookLayoutConfiguration.cellTopMargin + notebookLayoutConfiguration.collapsedIndicatorHeight;
      const totalHeight = notebookLayoutConfiguration.cellTopMargin + notebookLayoutConfiguration.collapsedIndicatorHeight + notebookLayoutConfiguration.cellBottomMargin + bottomToolbarDimensions.bottomToolbarGap + chatHeight + commentHeight + outputTotalHeight + outputShowMoreContainerHeight;
      const outputShowMoreContainerOffset = totalHeight - bottomToolbarDimensions.bottomToolbarGap - bottomToolbarDimensions.bottomToolbarHeight / 2 - outputShowMoreContainerHeight;
      const bottomToolbarOffset = this.viewContext.notebookOptions.computeBottomToolbarOffset(totalHeight, this.viewType);
      const editorWidth = state.outerWidth !== void 0 ? this.viewContext.notebookOptions.computeCodeCellEditorWidth(state.outerWidth) : this._layoutInfo?.editorWidth;
      this._layoutInfo = {
        fontInfo: state.font ?? this._layoutInfo.fontInfo ?? null,
        editorHeight: this._layoutInfo.editorHeight,
        editorWidth,
        chatHeight,
        statusBarHeight: 0,
        outputContainerOffset,
        outputTotalHeight,
        outputShowMoreContainerHeight,
        outputShowMoreContainerOffset,
        commentOffset: outputContainerOffset + outputTotalHeight,
        commentHeight,
        totalHeight,
        codeIndicatorHeight,
        outputIndicatorHeight,
        bottomToolbarOffset,
        layoutState: this._layoutInfo.layoutState,
        estimatedHasHorizontalScrolling: false
      };
    }
    this._fireOnDidChangeLayout({
      ...state,
      totalHeight: this.layoutInfo.totalHeight !== originalLayout.totalHeight,
      source
    });
  }
  _fireOnDidChangeLayout(state) {
    this._pauseableEmitter.fire(state);
  }
  restoreEditorViewState(editorViewStates, totalHeight) {
    super.restoreEditorViewState(editorViewStates);
    if (totalHeight !== void 0 && this._layoutInfo.layoutState !== CellLayoutState.Measured) {
      this._layoutInfo = {
        ...this._layoutInfo,
        totalHeight,
        layoutState: CellLayoutState.FromCache
      };
    }
  }
  getDynamicHeight() {
    this._onLayoutInfoRead.fire();
    return this._layoutInfo.totalHeight;
  }
  getHeight(lineHeight) {
    if (this._layoutInfo.layoutState === CellLayoutState.Uninitialized) {
      const estimate = this.estimateEditorHeight(lineHeight);
      return this.computeTotalHeight(estimate.editorHeight, 0, 0, 0);
    } else {
      return this._layoutInfo.totalHeight;
    }
  }
  estimateEditorHeight(lineHeight = 20) {
    let hasHorizontalScrolling = false;
    const cellEditorOptions = this.viewContext.getBaseCellEditorOptions(this.language);
    if (this.layoutInfo.fontInfo && cellEditorOptions.value.wordWrap === "off") {
      for (let i = 0; i < this.lineCount; i++) {
        const max = this.textBuffer.getLineLastNonWhitespaceColumn(i + 1);
        const estimatedWidth = max * (this.layoutInfo.fontInfo.typicalHalfwidthCharacterWidth + this.layoutInfo.fontInfo.letterSpacing);
        if (estimatedWidth > this.layoutInfo.editorWidth) {
          hasHorizontalScrolling = true;
          break;
        }
      }
    }
    const verticalScrollbarHeight = hasHorizontalScrolling ? 12 : 0;
    const editorPadding = this.viewContext.notebookOptions.computeEditorPadding(this.internalMetadata, this.uri);
    const editorHeight = this.lineCount * lineHeight + editorPadding.top + editorPadding.bottom + verticalScrollbarHeight;
    return {
      editorHeight,
      hasHorizontalScrolling
    };
  }
  computeTotalHeight(editorHeight, outputsTotalHeight, outputShowMoreContainerHeight, chatHeight) {
    const layoutConfiguration = this.viewContext.notebookOptions.getLayoutConfiguration();
    const { bottomToolbarGap } = this.viewContext.notebookOptions.computeBottomToolbarDimensions(this.viewType);
    return layoutConfiguration.editorToolbarHeight + layoutConfiguration.cellTopMargin + chatHeight + editorHeight + this.viewContext.notebookOptions.computeEditorStatusbarHeight(this.internalMetadata, this.uri) + this._commentHeight + outputsTotalHeight + outputShowMoreContainerHeight + bottomToolbarGap + layoutConfiguration.cellBottomMargin;
  }
  onDidChangeTextModelContent() {
    if (this.getEditState() !== CellEditState.Editing) {
      this.updateEditState(CellEditState.Editing, "onDidChangeTextModelContent");
      this._onDidChangeState.fire({ contentChanged: true });
    }
  }
  onDeselect() {
    this.updateEditState(CellEditState.Preview, "onDeselect");
  }
  updateOutputShowMoreContainerHeight(height) {
    this.layoutChange({ outputShowMoreContainerHeight: height }, "CodeCellViewModel#updateOutputShowMoreContainerHeight");
  }
  updateOutputMinHeight(height) {
    this.outputMinHeight = height;
  }
  unlockOutputHeight() {
    this.outputMinHeight = 0;
    this.layoutChange({ outputHeight: true });
  }
  updateOutputHeight(index, height, source) {
    if (index >= this._outputCollection.length) {
      throw new Error("Output index out of range!");
    }
    this._ensureOutputsTop();
    try {
      if (index === 0 || height > 0) {
        this._outputViewModels[index].setVisible(true);
      } else if (height === 0) {
        this._outputViewModels[index].setVisible(false);
      }
    } catch (e) {
      const errorMessage = `Failed to update output height for cell ${this.handle}, output ${index}. this.outputCollection.length: ${this._outputCollection.length}, this._outputViewModels.length: ${this._outputViewModels.length}`;
      throw new Error(`${errorMessage}.
 Error: ${e.message}`);
    }
    if (this._outputViewModels[index].visible.get() && height < 28) {
      height = 28;
    }
    this._outputCollection[index] = height;
    if (this._outputsTop.setValue(index, height)) {
      this.layoutChange({ outputHeight: true }, source);
    }
  }
  getOutputOffsetInContainer(index) {
    this._ensureOutputsTop();
    if (index >= this._outputCollection.length) {
      throw new Error("Output index out of range!");
    }
    return this._outputsTop.getPrefixSum(index - 1);
  }
  getOutputOffset(index) {
    return this.layoutInfo.outputContainerOffset + this.getOutputOffsetInContainer(index);
  }
  spliceOutputHeights(start, deleteCnt, heights) {
    this._ensureOutputsTop();
    this._outputsTop.removeValues(start, deleteCnt);
    if (heights.length) {
      const values = new Uint32Array(heights.length);
      for (let i = 0; i < heights.length; i++) {
        values[i] = heights[i];
      }
      this._outputsTop.insertValues(start, values);
    }
    this.layoutChange({ outputHeight: true }, "CodeCellViewModel#spliceOutputs");
  }
  _ensureOutputsTop() {
    if (!this._outputsTop) {
      const values = new Uint32Array(this._outputCollection.length);
      for (let i = 0; i < this._outputCollection.length; i++) {
        values[i] = this._outputCollection[i];
      }
      this._outputsTop = new PrefixSumComputer(values);
    }
  }
  startFind(value, options) {
    const matches = super.cellStartFind(value, options);
    if (matches === null) {
      return null;
    }
    return {
      cell: this,
      contentMatches: matches
    };
  }
  dispose() {
    super.dispose();
    this._outputCollection = [];
    this._outputsTop = null;
    dispose(this._outputViewModels);
  }
};
CodeCellViewModel = __decorateClass([
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, INotebookService),
  __decorateParam(6, ITextModelService),
  __decorateParam(7, IUndoRedoService),
  __decorateParam(8, ICodeEditorService),
  __decorateParam(9, IInlineChatSessionService)
], CodeCellViewModel);
export {
  CodeCellViewModel,
  outputDisplayLimit
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXdNb2RlbC9jb2RlQ2VsbFZpZXdNb2RlbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50LCBQYXVzZWFibGVFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgZGlzcG9zZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBvYnNlcnZhYmxlVmFsdWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCAqIGFzIFVVSUQgZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgKiBhcyBlZGl0b3JDb21tb24gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgUHJlZml4U3VtQ29tcHV0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsL3ByZWZpeFN1bUNvbXB1dGVyLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVW5kb1JlZG9TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdW5kb1JlZG8vY29tbW9uL3VuZG9SZWRvLmpzJztcbmltcG9ydCB7IENlbGxFZGl0U3RhdGUsIENlbGxGaW5kTWF0Y2gsIENlbGxMYXlvdXRTdGF0ZSwgQ29kZUNlbGxMYXlvdXRDaGFuZ2VFdmVudCwgQ29kZUNlbGxMYXlvdXRJbmZvLCBJQ2VsbE91dHB1dFZpZXdNb2RlbCwgSUNlbGxWaWV3TW9kZWwgfSBmcm9tICcuLi9ub3RlYm9va0Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tPcHRpb25zQ2hhbmdlRXZlbnQgfSBmcm9tICcuLi9ub3RlYm9va09wdGlvbnMuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tMYXlvdXRJbmZvIH0gZnJvbSAnLi4vbm90ZWJvb2tWaWV3RXZlbnRzLmpzJztcbmltcG9ydCB7IENlbGxPdXRwdXRWaWV3TW9kZWwgfSBmcm9tICcuL2NlbGxPdXRwdXRWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgVmlld0NvbnRleHQgfSBmcm9tICcuL3ZpZXdDb250ZXh0LmpzJztcbmltcG9ydCB7IE5vdGVib29rQ2VsbFRleHRNb2RlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi9tb2RlbC9ub3RlYm9va0NlbGxUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgQ2VsbEtpbmQsIElOb3RlYm9va0ZpbmRPcHRpb25zLCBOb3RlYm9va0NlbGxPdXRwdXRzU3BsaWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IElDZWxsRXhlY3V0aW9uRXJyb3IsIElDZWxsRXhlY3V0aW9uU3RhdGVDaGFuZ2VkRXZlbnQgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgQmFzZUNlbGxWaWV3TW9kZWwgfSBmcm9tICcuL2Jhc2VDZWxsVmlld01vZGVsLmpzJztcbmltcG9ydCB7IElJbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9pbmxpbmVDaGF0L2Jyb3dzZXIvaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLmpzJztcblxuZXhwb3J0IGNvbnN0IG91dHB1dERpc3BsYXlMaW1pdCA9IDUwMDtcblxuZXhwb3J0IGNsYXNzIENvZGVDZWxsVmlld01vZGVsIGV4dGVuZHMgQmFzZUNlbGxWaWV3TW9kZWwgaW1wbGVtZW50cyBJQ2VsbFZpZXdNb2RlbCB7XG5cdHJlYWRvbmx5IGNlbGxLaW5kID0gQ2VsbEtpbmQuQ29kZTtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uTGF5b3V0SW5mb1JlYWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25MYXlvdXRJbmZvUmVhZCA9IHRoaXMuX29uTGF5b3V0SW5mb1JlYWQuZXZlbnQ7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZFN0YXJ0RXhlY3V0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUNlbGxFeGVjdXRpb25TdGF0ZUNoYW5nZWRFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkU3RhcnRFeGVjdXRpb24gPSB0aGlzLl9vbkRpZFN0YXJ0RXhlY3V0aW9uLmV2ZW50O1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkU3RvcEV4ZWN1dGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElDZWxsRXhlY3V0aW9uU3RhdGVDaGFuZ2VkRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZFN0b3BFeGVjdXRpb24gPSB0aGlzLl9vbkRpZFN0b3BFeGVjdXRpb24uZXZlbnQ7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZENoYW5nZU91dHB1dHMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxOb3RlYm9va0NlbGxPdXRwdXRzU3BsaWNlPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VPdXRwdXRzID0gdGhpcy5fb25EaWRDaGFuZ2VPdXRwdXRzLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUmVtb3ZlT3V0cHV0cyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHJlYWRvbmx5IElDZWxsT3V0cHV0Vmlld01vZGVsW10+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlbW92ZU91dHB1dHMgPSB0aGlzLl9vbkRpZFJlbW92ZU91dHB1dHMuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb3V0cHV0Q29sbGVjdGlvbjogbnVtYmVyW10gPSBbXTtcblxuXHRwcml2YXRlIF9vdXRwdXRzVG9wOiBQcmVmaXhTdW1Db21wdXRlciB8IG51bGwgPSBudWxsO1xuXG5cdHByb3RlY3RlZCBfcGF1c2VhYmxlRW1pdHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBQYXVzZWFibGVFbWl0dGVyPENvZGVDZWxsTGF5b3V0Q2hhbmdlRXZlbnQ+KCkpO1xuXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlTGF5b3V0ID0gdGhpcy5fcGF1c2VhYmxlRW1pdHRlci5ldmVudDtcblxuXHRwcml2YXRlIF9lZGl0b3JIZWlnaHQgPSAwO1xuXHRzZXQgZWRpdG9ySGVpZ2h0KGhlaWdodDogbnVtYmVyKSB7XG5cdFx0aWYgKHRoaXMuX2VkaXRvckhlaWdodCA9PT0gaGVpZ2h0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fZWRpdG9ySGVpZ2h0ID0gaGVpZ2h0O1xuXHRcdHRoaXMubGF5b3V0Q2hhbmdlKHsgZWRpdG9ySGVpZ2h0OiB0cnVlIH0sICdDb2RlQ2VsbFZpZXdNb2RlbCNlZGl0b3JIZWlnaHQnKTtcblx0fVxuXG5cdGdldCBlZGl0b3JIZWlnaHQoKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdlZGl0b3JIZWlnaHQgaXMgd3JpdGUtb25seScpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY2hhdEhlaWdodCA9IDA7XG5cdHNldCBjaGF0SGVpZ2h0KGhlaWdodDogbnVtYmVyKSB7XG5cdFx0aWYgKHRoaXMuX2NoYXRIZWlnaHQgPT09IGhlaWdodCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2NoYXRIZWlnaHQgPSBoZWlnaHQ7XG5cdFx0dGhpcy5sYXlvdXRDaGFuZ2UoeyBjaGF0SGVpZ2h0OiB0cnVlIH0sICdDb2RlQ2VsbFZpZXdNb2RlbCNjaGF0SGVpZ2h0Jyk7XG5cdH1cblxuXHRnZXQgY2hhdEhlaWdodCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fY2hhdEhlaWdodDtcblx0fVxuXG5cdHByaXZhdGUgX2hvdmVyaW5nT3V0cHV0OiBib29sZWFuID0gZmFsc2U7XG5cdHB1YmxpYyBnZXQgb3V0cHV0SXNIb3ZlcmVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9ob3ZlcmluZ091dHB1dDtcblx0fVxuXG5cdHB1YmxpYyBzZXQgb3V0cHV0SXNIb3ZlcmVkKHY6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9ob3ZlcmluZ091dHB1dCA9IHY7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKHsgb3V0cHV0SXNIb3ZlcmVkQ2hhbmdlZDogdHJ1ZSB9KTtcblx0fVxuXG5cdHByaXZhdGUgX2ZvY3VzT25PdXRwdXQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHVibGljIGdldCBvdXRwdXRJc0ZvY3VzZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2ZvY3VzT25PdXRwdXQ7XG5cdH1cblxuXHRwdWJsaWMgc2V0IG91dHB1dElzRm9jdXNlZCh2OiBib29sZWFuKSB7XG5cdFx0dGhpcy5fZm9jdXNPbk91dHB1dCA9IHY7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKHsgb3V0cHV0SXNGb2N1c2VkQ2hhbmdlZDogdHJ1ZSB9KTtcblx0fVxuXG5cdHByaXZhdGUgX2ZvY3VzSW5wdXRJbk91dHB1dDogYm9vbGVhbiA9IGZhbHNlO1xuXHRwdWJsaWMgZ2V0IGlucHV0SW5PdXRwdXRJc0ZvY3VzZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2ZvY3VzSW5wdXRJbk91dHB1dDtcblx0fVxuXG5cdHB1YmxpYyBzZXQgaW5wdXRJbk91dHB1dElzRm9jdXNlZCh2OiBib29sZWFuKSB7XG5cdFx0dGhpcy5fZm9jdXNJbnB1dEluT3V0cHV0ID0gdjtcblx0fVxuXG5cdHByaXZhdGUgX291dHB1dE1pbkhlaWdodDogbnVtYmVyID0gMDtcblxuXHRwcml2YXRlIGdldCBvdXRwdXRNaW5IZWlnaHQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX291dHB1dE1pbkhlaWdodDtcblx0fVxuXG5cdC8qKlxuXHQgKiBUaGUgbWluaW11bSBoZWlnaHQgb2YgdGhlIG91dHB1dCByZWdpb24uIEl0J3Mgb25seSBzZXQgdG8gbm9uLXplcm8gdGVtcG9yYXJpbHkgd2hlbiByZXBsYWNpbmcgYW4gb3V0cHV0IHdpdGggYSBuZXcgb25lLlxuXHQgKiBJdCdzIHJlc2V0IHRvIDAgd2hlbiB0aGUgbmV3IG91dHB1dCBpcyByZW5kZXJlZCwgb3IgaW4gb25lIHNlY29uZC5cblx0ICovXG5cdHByaXZhdGUgc2V0IG91dHB1dE1pbkhlaWdodChuZXdNaW46IG51bWJlcikge1xuXHRcdHRoaXMuX291dHB1dE1pbkhlaWdodCA9IG5ld01pbjtcblx0fVxuXG5cdHByaXZhdGUgX2xheW91dEluZm86IENvZGVDZWxsTGF5b3V0SW5mbztcblxuXHRnZXQgbGF5b3V0SW5mbygpIHtcblx0XHRyZXR1cm4gdGhpcy5fbGF5b3V0SW5mbztcblx0fVxuXG5cdHByaXZhdGUgX291dHB1dFZpZXdNb2RlbHM6IElDZWxsT3V0cHV0Vmlld01vZGVsW107XG5cblx0Z2V0IG91dHB1dHNWaWV3TW9kZWxzKCkge1xuXHRcdHJldHVybiB0aGlzLl9vdXRwdXRWaWV3TW9kZWxzO1xuXHR9XG5cblx0cmVhZG9ubHkgZXhlY3V0aW9uRXJyb3JEaWFnbm9zdGljID0gb2JzZXJ2YWJsZVZhbHVlPElDZWxsRXhlY3V0aW9uRXJyb3IgfCB1bmRlZmluZWQ+KCdleGNlY3V0aW9uRXJyb3InLCB1bmRlZmluZWQpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHZpZXdUeXBlOiBzdHJpbmcsXG5cdFx0bW9kZWw6IE5vdGVib29rQ2VsbFRleHRNb2RlbCxcblx0XHRpbml0aWFsTm90ZWJvb2tMYXlvdXRJbmZvOiBOb3RlYm9va0xheW91dEluZm8gfCBudWxsLFxuXHRcdHJlYWRvbmx5IHZpZXdDb250ZXh0OiBWaWV3Q29udGV4dCxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElOb3RlYm9va1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tTZXJ2aWNlOiBJTm90ZWJvb2tTZXJ2aWNlLFxuXHRcdEBJVGV4dE1vZGVsU2VydmljZSBtb2RlbFNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJVW5kb1JlZG9TZXJ2aWNlIHVuZG9SZWRvU2VydmljZTogSVVuZG9SZWRvU2VydmljZSxcblx0XHRASUNvZGVFZGl0b3JTZXJ2aWNlIGNvZGVFZGl0b3JTZXJ2aWNlOiBJQ29kZUVkaXRvclNlcnZpY2UsXG5cdFx0QElJbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UgaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlOiBJSW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKHZpZXdUeXBlLCBtb2RlbCwgVVVJRC5nZW5lcmF0ZVV1aWQoKSwgdmlld0NvbnRleHQsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBtb2RlbFNlcnZpY2UsIHVuZG9SZWRvU2VydmljZSwgY29kZUVkaXRvclNlcnZpY2UsIGlubGluZUNoYXRTZXNzaW9uU2VydmljZSk7XG5cdFx0dGhpcy5fb3V0cHV0Vmlld01vZGVscyA9IHRoaXMubW9kZWwub3V0cHV0cy5tYXAob3V0cHV0ID0+IG5ldyBDZWxsT3V0cHV0Vmlld01vZGVsKHRoaXMsIG91dHB1dCwgdGhpcy5fbm90ZWJvb2tTZXJ2aWNlKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm1vZGVsLm9uRGlkQ2hhbmdlT3V0cHV0cygoc3BsaWNlKSA9PiB7XG5cdFx0XHRjb25zdCByZW1vdmVkT3V0cHV0czogSUNlbGxPdXRwdXRWaWV3TW9kZWxbXSA9IFtdO1xuXHRcdFx0bGV0IG91dHB1dExheW91dENoYW5nZSA9IGZhbHNlO1xuXHRcdFx0Zm9yIChsZXQgaSA9IHNwbGljZS5zdGFydDsgaSA8IHNwbGljZS5zdGFydCArIHNwbGljZS5kZWxldGVDb3VudDsgaSsrKSB7XG5cdFx0XHRcdGlmICh0aGlzLl9vdXRwdXRDb2xsZWN0aW9uW2ldICE9PSB1bmRlZmluZWQgJiYgdGhpcy5fb3V0cHV0Q29sbGVjdGlvbltpXSAhPT0gMCkge1xuXHRcdFx0XHRcdG91dHB1dExheW91dENoYW5nZSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fb3V0cHV0Q29sbGVjdGlvbi5zcGxpY2Uoc3BsaWNlLnN0YXJ0LCBzcGxpY2UuZGVsZXRlQ291bnQsIC4uLnNwbGljZS5uZXdPdXRwdXRzLm1hcCgoKSA9PiAwKSk7XG5cdFx0XHRyZW1vdmVkT3V0cHV0cy5wdXNoKC4uLnRoaXMuX291dHB1dFZpZXdNb2RlbHMuc3BsaWNlKHNwbGljZS5zdGFydCwgc3BsaWNlLmRlbGV0ZUNvdW50LCAuLi5zcGxpY2UubmV3T3V0cHV0cy5tYXAob3V0cHV0ID0+IG5ldyBDZWxsT3V0cHV0Vmlld01vZGVsKHRoaXMsIG91dHB1dCwgdGhpcy5fbm90ZWJvb2tTZXJ2aWNlKSkpKTtcblxuXHRcdFx0dGhpcy5fb3V0cHV0c1RvcCA9IG51bGw7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZU91dHB1dHMuZmlyZShzcGxpY2UpO1xuXHRcdFx0dGhpcy5fb25EaWRSZW1vdmVPdXRwdXRzLmZpcmUocmVtb3ZlZE91dHB1dHMpO1xuXHRcdFx0aWYgKG91dHB1dExheW91dENoYW5nZSkge1xuXHRcdFx0XHR0aGlzLmxheW91dENoYW5nZSh7IG91dHB1dEhlaWdodDogdHJ1ZSB9LCAnQ29kZUNlbGxWaWV3TW9kZWwjbW9kZWwub25EaWRDaGFuZ2VPdXRwdXRzJyk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXRoaXMuX291dHB1dENvbGxlY3Rpb24ubGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMuZXhlY3V0aW9uRXJyb3JEaWFnbm9zdGljLnNldCh1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cdFx0XHRkaXNwb3NlKHJlbW92ZWRPdXRwdXRzKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9vdXRwdXRDb2xsZWN0aW9uID0gbmV3IEFycmF5KHRoaXMubW9kZWwub3V0cHV0cy5sZW5ndGgpO1xuXG5cdFx0dGhpcy5fbGF5b3V0SW5mbyA9IHtcblx0XHRcdGZvbnRJbmZvOiBpbml0aWFsTm90ZWJvb2tMYXlvdXRJbmZvPy5mb250SW5mbyB8fCBudWxsLFxuXHRcdFx0ZWRpdG9ySGVpZ2h0OiAwLFxuXHRcdFx0ZWRpdG9yV2lkdGg6IGluaXRpYWxOb3RlYm9va0xheW91dEluZm9cblx0XHRcdFx0PyB0aGlzLnZpZXdDb250ZXh0Lm5vdGVib29rT3B0aW9ucy5jb21wdXRlQ29kZUNlbGxFZGl0b3JXaWR0aChpbml0aWFsTm90ZWJvb2tMYXlvdXRJbmZvLndpZHRoKVxuXHRcdFx0XHQ6IDAsXG5cdFx0XHRjaGF0SGVpZ2h0OiAwLFxuXHRcdFx0c3RhdHVzQmFySGVpZ2h0OiAwLFxuXHRcdFx0Y29tbWVudE9mZnNldDogMCxcblx0XHRcdGNvbW1lbnRIZWlnaHQ6IDAsXG5cdFx0XHRvdXRwdXRDb250YWluZXJPZmZzZXQ6IDAsXG5cdFx0XHRvdXRwdXRUb3RhbEhlaWdodDogMCxcblx0XHRcdG91dHB1dFNob3dNb3JlQ29udGFpbmVySGVpZ2h0OiAwLFxuXHRcdFx0b3V0cHV0U2hvd01vcmVDb250YWluZXJPZmZzZXQ6IDAsXG5cdFx0XHR0b3RhbEhlaWdodDogdGhpcy5jb21wdXRlVG90YWxIZWlnaHQoMTcsIDAsIDAsIDApLFxuXHRcdFx0Y29kZUluZGljYXRvckhlaWdodDogMCxcblx0XHRcdG91dHB1dEluZGljYXRvckhlaWdodDogMCxcblx0XHRcdGJvdHRvbVRvb2xiYXJPZmZzZXQ6IDAsXG5cdFx0XHRsYXlvdXRTdGF0ZTogQ2VsbExheW91dFN0YXRlLlVuaW5pdGlhbGl6ZWQsXG5cdFx0XHRlc3RpbWF0ZWRIYXNIb3Jpem9udGFsU2Nyb2xsaW5nOiBmYWxzZVxuXHRcdH07XG5cdH1cblxuXHR1cGRhdGVFeGVjdXRpb25TdGF0ZShlOiBJQ2VsbEV4ZWN1dGlvblN0YXRlQ2hhbmdlZEV2ZW50KSB7XG5cdFx0aWYgKGUuY2hhbmdlZCkge1xuXHRcdFx0dGhpcy5leGVjdXRpb25FcnJvckRpYWdub3N0aWMuc2V0KHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0XHRcdHRoaXMuX29uRGlkU3RhcnRFeGVjdXRpb24uZmlyZShlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fb25EaWRTdG9wRXhlY3V0aW9uLmZpcmUoZSk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgdXBkYXRlT3B0aW9ucyhlOiBOb3RlYm9va09wdGlvbnNDaGFuZ2VFdmVudCkge1xuXHRcdHN1cGVyLnVwZGF0ZU9wdGlvbnMoZSk7XG5cdFx0aWYgKGUuY2VsbFN0YXR1c0JhclZpc2liaWxpdHkgfHwgZS5pbnNlcnRUb29sYmFyUG9zaXRpb24gfHwgZS5jZWxsVG9vbGJhckxvY2F0aW9uKSB7XG5cdFx0XHR0aGlzLmxheW91dENoYW5nZSh7fSk7XG5cdFx0fVxuXHR9XG5cblx0cGF1c2VMYXlvdXQoKSB7XG5cdFx0dGhpcy5fcGF1c2VhYmxlRW1pdHRlci5wYXVzZSgpO1xuXHR9XG5cblx0cmVzdW1lTGF5b3V0KCkge1xuXHRcdHRoaXMuX3BhdXNlYWJsZUVtaXR0ZXIucmVzdW1lKCk7XG5cdH1cblxuXHRsYXlvdXRDaGFuZ2Uoc3RhdGU6IENvZGVDZWxsTGF5b3V0Q2hhbmdlRXZlbnQsIHNvdXJjZT86IHN0cmluZykge1xuXHRcdC8vIHJlY29tcHV0ZVxuXHRcdHRoaXMuX2Vuc3VyZU91dHB1dHNUb3AoKTtcblx0XHRjb25zdCBub3RlYm9va0xheW91dENvbmZpZ3VyYXRpb24gPSB0aGlzLnZpZXdDb250ZXh0Lm5vdGVib29rT3B0aW9ucy5nZXRMYXlvdXRDb25maWd1cmF0aW9uKCk7XG5cdFx0Y29uc3QgYm90dG9tVG9vbGJhckRpbWVuc2lvbnMgPSB0aGlzLnZpZXdDb250ZXh0Lm5vdGVib29rT3B0aW9ucy5jb21wdXRlQm90dG9tVG9vbGJhckRpbWVuc2lvbnModGhpcy52aWV3VHlwZSk7XG5cdFx0Y29uc3Qgb3V0cHV0U2hvd01vcmVDb250YWluZXJIZWlnaHQgPSBzdGF0ZS5vdXRwdXRTaG93TW9yZUNvbnRhaW5lckhlaWdodCA/IHN0YXRlLm91dHB1dFNob3dNb3JlQ29udGFpbmVySGVpZ2h0IDogdGhpcy5fbGF5b3V0SW5mby5vdXRwdXRTaG93TW9yZUNvbnRhaW5lckhlaWdodDtcblx0XHRjb25zdCBvdXRwdXRUb3RhbEhlaWdodCA9IE1hdGgubWF4KHRoaXMuX291dHB1dE1pbkhlaWdodCwgdGhpcy5pc091dHB1dENvbGxhcHNlZCA/IG5vdGVib29rTGF5b3V0Q29uZmlndXJhdGlvbi5jb2xsYXBzZWRJbmRpY2F0b3JIZWlnaHQgOiB0aGlzLl9vdXRwdXRzVG9wIS5nZXRUb3RhbFN1bSgpKTtcblx0XHRjb25zdCBjb21tZW50SGVpZ2h0ID0gc3RhdGUuY29tbWVudEhlaWdodCA/IHRoaXMuX2NvbW1lbnRIZWlnaHQgOiB0aGlzLl9sYXlvdXRJbmZvLmNvbW1lbnRIZWlnaHQ7XG5cblx0XHRjb25zdCBvcmlnaW5hbExheW91dCA9IHRoaXMubGF5b3V0SW5mbztcblx0XHRpZiAoIXRoaXMuaXNJbnB1dENvbGxhcHNlZCkge1xuXHRcdFx0bGV0IG5ld1N0YXRlOiBDZWxsTGF5b3V0U3RhdGU7XG5cdFx0XHRsZXQgZWRpdG9ySGVpZ2h0OiBudW1iZXI7XG5cdFx0XHRsZXQgdG90YWxIZWlnaHQ6IG51bWJlcjtcblx0XHRcdGxldCBoYXNIb3Jpem9udGFsU2Nyb2xsaW5nID0gZmFsc2U7XG5cdFx0XHRjb25zdCBjaGF0SGVpZ2h0ID0gc3RhdGUuY2hhdEhlaWdodCA/IHRoaXMuX2NoYXRIZWlnaHQgOiB0aGlzLl9sYXlvdXRJbmZvLmNoYXRIZWlnaHQ7XG5cdFx0XHRpZiAoIXN0YXRlLmVkaXRvckhlaWdodCAmJiB0aGlzLl9sYXlvdXRJbmZvLmxheW91dFN0YXRlID09PSBDZWxsTGF5b3V0U3RhdGUuRnJvbUNhY2hlICYmICFzdGF0ZS5vdXRwdXRIZWlnaHQpIHtcblx0XHRcdFx0Ly8gTm8gbmV3IGVkaXRvckhlaWdodCBpbmZvIC0ga2VlcCBjYWNoZWQgdG90YWxIZWlnaHQgYW5kIGVzdGltYXRlIGVkaXRvckhlaWdodFxuXHRcdFx0XHRjb25zdCBlc3RpbWF0ZSA9IHRoaXMuZXN0aW1hdGVFZGl0b3JIZWlnaHQoc3RhdGUuZm9udD8ubGluZUhlaWdodCA/PyB0aGlzLl9sYXlvdXRJbmZvLmZvbnRJbmZvPy5saW5lSGVpZ2h0KTtcblx0XHRcdFx0ZWRpdG9ySGVpZ2h0ID0gZXN0aW1hdGUuZWRpdG9ySGVpZ2h0O1xuXHRcdFx0XHRoYXNIb3Jpem9udGFsU2Nyb2xsaW5nID0gZXN0aW1hdGUuaGFzSG9yaXpvbnRhbFNjcm9sbGluZztcblx0XHRcdFx0dG90YWxIZWlnaHQgPSB0aGlzLl9sYXlvdXRJbmZvLnRvdGFsSGVpZ2h0O1xuXHRcdFx0XHRuZXdTdGF0ZSA9IENlbGxMYXlvdXRTdGF0ZS5Gcm9tQ2FjaGU7XG5cdFx0XHR9IGVsc2UgaWYgKHN0YXRlLmVkaXRvckhlaWdodCB8fCB0aGlzLl9sYXlvdXRJbmZvLmxheW91dFN0YXRlID09PSBDZWxsTGF5b3V0U3RhdGUuTWVhc3VyZWQpIHtcblx0XHRcdFx0Ly8gRWRpdG9yIGhhcyBiZWVuIG1lYXN1cmVkXG5cdFx0XHRcdGVkaXRvckhlaWdodCA9IHRoaXMuX2VkaXRvckhlaWdodDtcblx0XHRcdFx0dG90YWxIZWlnaHQgPSB0aGlzLmNvbXB1dGVUb3RhbEhlaWdodCh0aGlzLl9lZGl0b3JIZWlnaHQsIG91dHB1dFRvdGFsSGVpZ2h0LCBvdXRwdXRTaG93TW9yZUNvbnRhaW5lckhlaWdodCwgY2hhdEhlaWdodCk7XG5cdFx0XHRcdG5ld1N0YXRlID0gQ2VsbExheW91dFN0YXRlLk1lYXN1cmVkO1xuXHRcdFx0XHRoYXNIb3Jpem9udGFsU2Nyb2xsaW5nID0gdGhpcy5fbGF5b3V0SW5mby5lc3RpbWF0ZWRIYXNIb3Jpem9udGFsU2Nyb2xsaW5nO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgZXN0aW1hdGUgPSB0aGlzLmVzdGltYXRlRWRpdG9ySGVpZ2h0KHN0YXRlLmZvbnQ/LmxpbmVIZWlnaHQgPz8gdGhpcy5fbGF5b3V0SW5mby5mb250SW5mbz8ubGluZUhlaWdodCk7XG5cdFx0XHRcdGVkaXRvckhlaWdodCA9IGVzdGltYXRlLmVkaXRvckhlaWdodDtcblx0XHRcdFx0aGFzSG9yaXpvbnRhbFNjcm9sbGluZyA9IGVzdGltYXRlLmhhc0hvcml6b250YWxTY3JvbGxpbmc7XG5cdFx0XHRcdHRvdGFsSGVpZ2h0ID0gdGhpcy5jb21wdXRlVG90YWxIZWlnaHQoZWRpdG9ySGVpZ2h0LCBvdXRwdXRUb3RhbEhlaWdodCwgb3V0cHV0U2hvd01vcmVDb250YWluZXJIZWlnaHQsIGNoYXRIZWlnaHQpO1xuXHRcdFx0XHRuZXdTdGF0ZSA9IENlbGxMYXlvdXRTdGF0ZS5Fc3RpbWF0ZWQ7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHN0YXR1c0JhckhlaWdodCA9IHRoaXMudmlld0NvbnRleHQubm90ZWJvb2tPcHRpb25zLmNvbXB1dGVFZGl0b3JTdGF0dXNiYXJIZWlnaHQodGhpcy5pbnRlcm5hbE1ldGFkYXRhLCB0aGlzLnVyaSk7XG5cdFx0XHRjb25zdCBjb2RlSW5kaWNhdG9ySGVpZ2h0ID0gZWRpdG9ySGVpZ2h0ICsgc3RhdHVzQmFySGVpZ2h0O1xuXHRcdFx0Y29uc3Qgb3V0cHV0SW5kaWNhdG9ySGVpZ2h0ID0gb3V0cHV0VG90YWxIZWlnaHQgKyBvdXRwdXRTaG93TW9yZUNvbnRhaW5lckhlaWdodDtcblx0XHRcdGNvbnN0IG91dHB1dENvbnRhaW5lck9mZnNldCA9IG5vdGVib29rTGF5b3V0Q29uZmlndXJhdGlvbi5lZGl0b3JUb29sYmFySGVpZ2h0XG5cdFx0XHRcdCsgbm90ZWJvb2tMYXlvdXRDb25maWd1cmF0aW9uLmNlbGxUb3BNYXJnaW4gLy8gQ0VMTF9UT1BfTUFSR0lOXG5cdFx0XHRcdCsgY2hhdEhlaWdodFxuXHRcdFx0XHQrIGVkaXRvckhlaWdodFxuXHRcdFx0XHQrIHN0YXR1c0JhckhlaWdodDtcblx0XHRcdGNvbnN0IG91dHB1dFNob3dNb3JlQ29udGFpbmVyT2Zmc2V0ID0gdG90YWxIZWlnaHRcblx0XHRcdFx0LSBib3R0b21Ub29sYmFyRGltZW5zaW9ucy5ib3R0b21Ub29sYmFyR2FwXG5cdFx0XHRcdC0gYm90dG9tVG9vbGJhckRpbWVuc2lvbnMuYm90dG9tVG9vbGJhckhlaWdodCAvIDJcblx0XHRcdFx0LSBvdXRwdXRTaG93TW9yZUNvbnRhaW5lckhlaWdodDtcblx0XHRcdGNvbnN0IGJvdHRvbVRvb2xiYXJPZmZzZXQgPSB0aGlzLnZpZXdDb250ZXh0Lm5vdGVib29rT3B0aW9ucy5jb21wdXRlQm90dG9tVG9vbGJhck9mZnNldCh0b3RhbEhlaWdodCwgdGhpcy52aWV3VHlwZSk7XG5cdFx0XHRjb25zdCBlZGl0b3JXaWR0aCA9IHN0YXRlLm91dGVyV2lkdGggIT09IHVuZGVmaW5lZFxuXHRcdFx0XHQ/IHRoaXMudmlld0NvbnRleHQubm90ZWJvb2tPcHRpb25zLmNvbXB1dGVDb2RlQ2VsbEVkaXRvcldpZHRoKHN0YXRlLm91dGVyV2lkdGgpXG5cdFx0XHRcdDogdGhpcy5fbGF5b3V0SW5mbz8uZWRpdG9yV2lkdGg7XG5cblx0XHRcdHRoaXMuX2xheW91dEluZm8gPSB7XG5cdFx0XHRcdGZvbnRJbmZvOiBzdGF0ZS5mb250ID8/IHRoaXMuX2xheW91dEluZm8uZm9udEluZm8gPz8gbnVsbCxcblx0XHRcdFx0Y2hhdEhlaWdodCxcblx0XHRcdFx0ZWRpdG9ySGVpZ2h0LFxuXHRcdFx0XHRlZGl0b3JXaWR0aCxcblx0XHRcdFx0c3RhdHVzQmFySGVpZ2h0LFxuXHRcdFx0XHRvdXRwdXRDb250YWluZXJPZmZzZXQsXG5cdFx0XHRcdG91dHB1dFRvdGFsSGVpZ2h0LFxuXHRcdFx0XHRvdXRwdXRTaG93TW9yZUNvbnRhaW5lckhlaWdodCxcblx0XHRcdFx0b3V0cHV0U2hvd01vcmVDb250YWluZXJPZmZzZXQsXG5cdFx0XHRcdGNvbW1lbnRPZmZzZXQ6IG91dHB1dENvbnRhaW5lck9mZnNldCArIG91dHB1dFRvdGFsSGVpZ2h0LFxuXHRcdFx0XHRjb21tZW50SGVpZ2h0LFxuXHRcdFx0XHR0b3RhbEhlaWdodCxcblx0XHRcdFx0Y29kZUluZGljYXRvckhlaWdodCxcblx0XHRcdFx0b3V0cHV0SW5kaWNhdG9ySGVpZ2h0LFxuXHRcdFx0XHRib3R0b21Ub29sYmFyT2Zmc2V0LFxuXHRcdFx0XHRsYXlvdXRTdGF0ZTogbmV3U3RhdGUsXG5cdFx0XHRcdGVzdGltYXRlZEhhc0hvcml6b250YWxTY3JvbGxpbmc6IGhhc0hvcml6b250YWxTY3JvbGxpbmdcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGNvZGVJbmRpY2F0b3JIZWlnaHQgPSBub3RlYm9va0xheW91dENvbmZpZ3VyYXRpb24uY29sbGFwc2VkSW5kaWNhdG9ySGVpZ2h0O1xuXHRcdFx0Y29uc3Qgb3V0cHV0SW5kaWNhdG9ySGVpZ2h0ID0gb3V0cHV0VG90YWxIZWlnaHQgKyBvdXRwdXRTaG93TW9yZUNvbnRhaW5lckhlaWdodDtcblx0XHRcdGNvbnN0IGNoYXRIZWlnaHQgPSBzdGF0ZS5jaGF0SGVpZ2h0ID8gdGhpcy5fY2hhdEhlaWdodCA6IHRoaXMuX2xheW91dEluZm8uY2hhdEhlaWdodDtcblxuXHRcdFx0Y29uc3Qgb3V0cHV0Q29udGFpbmVyT2Zmc2V0ID0gbm90ZWJvb2tMYXlvdXRDb25maWd1cmF0aW9uLmNlbGxUb3BNYXJnaW4gKyBub3RlYm9va0xheW91dENvbmZpZ3VyYXRpb24uY29sbGFwc2VkSW5kaWNhdG9ySGVpZ2h0O1xuXHRcdFx0Y29uc3QgdG90YWxIZWlnaHQgPVxuXHRcdFx0XHRub3RlYm9va0xheW91dENvbmZpZ3VyYXRpb24uY2VsbFRvcE1hcmdpblxuXHRcdFx0XHQrIG5vdGVib29rTGF5b3V0Q29uZmlndXJhdGlvbi5jb2xsYXBzZWRJbmRpY2F0b3JIZWlnaHRcblx0XHRcdFx0KyBub3RlYm9va0xheW91dENvbmZpZ3VyYXRpb24uY2VsbEJvdHRvbU1hcmdpbiAvL0NFTExfQk9UVE9NX01BUkdJTlxuXHRcdFx0XHQrIGJvdHRvbVRvb2xiYXJEaW1lbnNpb25zLmJvdHRvbVRvb2xiYXJHYXAgLy9CT1RUT01fQ0VMTF9UT09MQkFSX0dBUFxuXHRcdFx0XHQrIGNoYXRIZWlnaHRcblx0XHRcdFx0KyBjb21tZW50SGVpZ2h0XG5cdFx0XHRcdCsgb3V0cHV0VG90YWxIZWlnaHQgKyBvdXRwdXRTaG93TW9yZUNvbnRhaW5lckhlaWdodDtcblx0XHRcdGNvbnN0IG91dHB1dFNob3dNb3JlQ29udGFpbmVyT2Zmc2V0ID0gdG90YWxIZWlnaHRcblx0XHRcdFx0LSBib3R0b21Ub29sYmFyRGltZW5zaW9ucy5ib3R0b21Ub29sYmFyR2FwXG5cdFx0XHRcdC0gYm90dG9tVG9vbGJhckRpbWVuc2lvbnMuYm90dG9tVG9vbGJhckhlaWdodCAvIDJcblx0XHRcdFx0LSBvdXRwdXRTaG93TW9yZUNvbnRhaW5lckhlaWdodDtcblx0XHRcdGNvbnN0IGJvdHRvbVRvb2xiYXJPZmZzZXQgPSB0aGlzLnZpZXdDb250ZXh0Lm5vdGVib29rT3B0aW9ucy5jb21wdXRlQm90dG9tVG9vbGJhck9mZnNldCh0b3RhbEhlaWdodCwgdGhpcy52aWV3VHlwZSk7XG5cdFx0XHRjb25zdCBlZGl0b3JXaWR0aCA9IHN0YXRlLm91dGVyV2lkdGggIT09IHVuZGVmaW5lZFxuXHRcdFx0XHQ/IHRoaXMudmlld0NvbnRleHQubm90ZWJvb2tPcHRpb25zLmNvbXB1dGVDb2RlQ2VsbEVkaXRvcldpZHRoKHN0YXRlLm91dGVyV2lkdGgpXG5cdFx0XHRcdDogdGhpcy5fbGF5b3V0SW5mbz8uZWRpdG9yV2lkdGg7XG5cblx0XHRcdHRoaXMuX2xheW91dEluZm8gPSB7XG5cdFx0XHRcdGZvbnRJbmZvOiBzdGF0ZS5mb250ID8/IHRoaXMuX2xheW91dEluZm8uZm9udEluZm8gPz8gbnVsbCxcblx0XHRcdFx0ZWRpdG9ySGVpZ2h0OiB0aGlzLl9sYXlvdXRJbmZvLmVkaXRvckhlaWdodCxcblx0XHRcdFx0ZWRpdG9yV2lkdGgsXG5cdFx0XHRcdGNoYXRIZWlnaHQ6IGNoYXRIZWlnaHQsXG5cdFx0XHRcdHN0YXR1c0JhckhlaWdodDogMCxcblx0XHRcdFx0b3V0cHV0Q29udGFpbmVyT2Zmc2V0LFxuXHRcdFx0XHRvdXRwdXRUb3RhbEhlaWdodCxcblx0XHRcdFx0b3V0cHV0U2hvd01vcmVDb250YWluZXJIZWlnaHQsXG5cdFx0XHRcdG91dHB1dFNob3dNb3JlQ29udGFpbmVyT2Zmc2V0LFxuXHRcdFx0XHRjb21tZW50T2Zmc2V0OiBvdXRwdXRDb250YWluZXJPZmZzZXQgKyBvdXRwdXRUb3RhbEhlaWdodCxcblx0XHRcdFx0Y29tbWVudEhlaWdodCxcblx0XHRcdFx0dG90YWxIZWlnaHQsXG5cdFx0XHRcdGNvZGVJbmRpY2F0b3JIZWlnaHQsXG5cdFx0XHRcdG91dHB1dEluZGljYXRvckhlaWdodCxcblx0XHRcdFx0Ym90dG9tVG9vbGJhck9mZnNldCxcblx0XHRcdFx0bGF5b3V0U3RhdGU6IHRoaXMuX2xheW91dEluZm8ubGF5b3V0U3RhdGUsXG5cdFx0XHRcdGVzdGltYXRlZEhhc0hvcml6b250YWxTY3JvbGxpbmc6IGZhbHNlXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHRoaXMuX2ZpcmVPbkRpZENoYW5nZUxheW91dCh7XG5cdFx0XHQuLi5zdGF0ZSxcblx0XHRcdHRvdGFsSGVpZ2h0OiB0aGlzLmxheW91dEluZm8udG90YWxIZWlnaHQgIT09IG9yaWdpbmFsTGF5b3V0LnRvdGFsSGVpZ2h0LFxuXHRcdFx0c291cmNlLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfZmlyZU9uRGlkQ2hhbmdlTGF5b3V0KHN0YXRlOiBDb2RlQ2VsbExheW91dENoYW5nZUV2ZW50KSB7XG5cdFx0dGhpcy5fcGF1c2VhYmxlRW1pdHRlci5maXJlKHN0YXRlKTtcblx0fVxuXG5cdG92ZXJyaWRlIHJlc3RvcmVFZGl0b3JWaWV3U3RhdGUoZWRpdG9yVmlld1N0YXRlczogZWRpdG9yQ29tbW9uLklDb2RlRWRpdG9yVmlld1N0YXRlIHwgbnVsbCwgdG90YWxIZWlnaHQ/OiBudW1iZXIpIHtcblx0XHRzdXBlci5yZXN0b3JlRWRpdG9yVmlld1N0YXRlKGVkaXRvclZpZXdTdGF0ZXMpO1xuXHRcdGlmICh0b3RhbEhlaWdodCAhPT0gdW5kZWZpbmVkICYmIHRoaXMuX2xheW91dEluZm8ubGF5b3V0U3RhdGUgIT09IENlbGxMYXlvdXRTdGF0ZS5NZWFzdXJlZCkge1xuXHRcdFx0dGhpcy5fbGF5b3V0SW5mbyA9IHtcblx0XHRcdFx0Li4udGhpcy5fbGF5b3V0SW5mbyxcblx0XHRcdFx0dG90YWxIZWlnaHQ6IHRvdGFsSGVpZ2h0LFxuXHRcdFx0XHRsYXlvdXRTdGF0ZTogQ2VsbExheW91dFN0YXRlLkZyb21DYWNoZSxcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0Z2V0RHluYW1pY0hlaWdodCgpIHtcblx0XHR0aGlzLl9vbkxheW91dEluZm9SZWFkLmZpcmUoKTtcblx0XHRyZXR1cm4gdGhpcy5fbGF5b3V0SW5mby50b3RhbEhlaWdodDtcblx0fVxuXG5cdGdldEhlaWdodChsaW5lSGVpZ2h0OiBudW1iZXIpIHtcblx0XHRpZiAodGhpcy5fbGF5b3V0SW5mby5sYXlvdXRTdGF0ZSA9PT0gQ2VsbExheW91dFN0YXRlLlVuaW5pdGlhbGl6ZWQpIHtcblx0XHRcdGNvbnN0IGVzdGltYXRlID0gdGhpcy5lc3RpbWF0ZUVkaXRvckhlaWdodChsaW5lSGVpZ2h0KTtcblx0XHRcdHJldHVybiB0aGlzLmNvbXB1dGVUb3RhbEhlaWdodChlc3RpbWF0ZS5lZGl0b3JIZWlnaHQsIDAsIDAsIDApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fbGF5b3V0SW5mby50b3RhbEhlaWdodDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGVzdGltYXRlRWRpdG9ySGVpZ2h0KGxpbmVIZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCA9IDIwKTogeyBlZGl0b3JIZWlnaHQ6IG51bWJlcjsgaGFzSG9yaXpvbnRhbFNjcm9sbGluZzogYm9vbGVhbiB9IHtcblx0XHRsZXQgaGFzSG9yaXpvbnRhbFNjcm9sbGluZyA9IGZhbHNlO1xuXHRcdGNvbnN0IGNlbGxFZGl0b3JPcHRpb25zID0gdGhpcy52aWV3Q29udGV4dC5nZXRCYXNlQ2VsbEVkaXRvck9wdGlvbnModGhpcy5sYW5ndWFnZSk7XG5cdFx0aWYgKHRoaXMubGF5b3V0SW5mby5mb250SW5mbyAmJiBjZWxsRWRpdG9yT3B0aW9ucy52YWx1ZS53b3JkV3JhcCA9PT0gJ29mZicpIHtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5saW5lQ291bnQ7IGkrKykge1xuXHRcdFx0XHRjb25zdCBtYXggPSB0aGlzLnRleHRCdWZmZXIuZ2V0TGluZUxhc3ROb25XaGl0ZXNwYWNlQ29sdW1uKGkgKyAxKTtcblx0XHRcdFx0Y29uc3QgZXN0aW1hdGVkV2lkdGggPSBtYXggKiAodGhpcy5sYXlvdXRJbmZvLmZvbnRJbmZvLnR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aCArIHRoaXMubGF5b3V0SW5mby5mb250SW5mby5sZXR0ZXJTcGFjaW5nKTtcblx0XHRcdFx0aWYgKGVzdGltYXRlZFdpZHRoID4gdGhpcy5sYXlvdXRJbmZvLmVkaXRvcldpZHRoKSB7XG5cdFx0XHRcdFx0aGFzSG9yaXpvbnRhbFNjcm9sbGluZyA9IHRydWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCB2ZXJ0aWNhbFNjcm9sbGJhckhlaWdodCA9IGhhc0hvcml6b250YWxTY3JvbGxpbmcgPyAxMiA6IDA7IC8vIHRha2Ugem9vbSBsZXZlbCBpbnRvIGFjY291bnRcblx0XHRjb25zdCBlZGl0b3JQYWRkaW5nID0gdGhpcy52aWV3Q29udGV4dC5ub3RlYm9va09wdGlvbnMuY29tcHV0ZUVkaXRvclBhZGRpbmcodGhpcy5pbnRlcm5hbE1ldGFkYXRhLCB0aGlzLnVyaSk7XG5cdFx0Y29uc3QgZWRpdG9ySGVpZ2h0ID0gdGhpcy5saW5lQ291bnQgKiBsaW5lSGVpZ2h0XG5cdFx0XHQrIGVkaXRvclBhZGRpbmcudG9wXG5cdFx0XHQrIGVkaXRvclBhZGRpbmcuYm90dG9tIC8vIEVESVRPUl9CT1RUT01fUEFERElOR1xuXHRcdFx0KyB2ZXJ0aWNhbFNjcm9sbGJhckhlaWdodDtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZWRpdG9ySGVpZ2h0LFxuXHRcdFx0aGFzSG9yaXpvbnRhbFNjcm9sbGluZ1xuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGNvbXB1dGVUb3RhbEhlaWdodChlZGl0b3JIZWlnaHQ6IG51bWJlciwgb3V0cHV0c1RvdGFsSGVpZ2h0OiBudW1iZXIsIG91dHB1dFNob3dNb3JlQ29udGFpbmVySGVpZ2h0OiBudW1iZXIsIGNoYXRIZWlnaHQ6IG51bWJlcik6IG51bWJlciB7XG5cdFx0Y29uc3QgbGF5b3V0Q29uZmlndXJhdGlvbiA9IHRoaXMudmlld0NvbnRleHQubm90ZWJvb2tPcHRpb25zLmdldExheW91dENvbmZpZ3VyYXRpb24oKTtcblx0XHRjb25zdCB7IGJvdHRvbVRvb2xiYXJHYXAgfSA9IHRoaXMudmlld0NvbnRleHQubm90ZWJvb2tPcHRpb25zLmNvbXB1dGVCb3R0b21Ub29sYmFyRGltZW5zaW9ucyh0aGlzLnZpZXdUeXBlKTtcblx0XHRyZXR1cm4gbGF5b3V0Q29uZmlndXJhdGlvbi5lZGl0b3JUb29sYmFySGVpZ2h0XG5cdFx0XHQrIGxheW91dENvbmZpZ3VyYXRpb24uY2VsbFRvcE1hcmdpblxuXHRcdFx0KyBjaGF0SGVpZ2h0XG5cdFx0XHQrIGVkaXRvckhlaWdodFxuXHRcdFx0KyB0aGlzLnZpZXdDb250ZXh0Lm5vdGVib29rT3B0aW9ucy5jb21wdXRlRWRpdG9yU3RhdHVzYmFySGVpZ2h0KHRoaXMuaW50ZXJuYWxNZXRhZGF0YSwgdGhpcy51cmkpXG5cdFx0XHQrIHRoaXMuX2NvbW1lbnRIZWlnaHRcblx0XHRcdCsgb3V0cHV0c1RvdGFsSGVpZ2h0XG5cdFx0XHQrIG91dHB1dFNob3dNb3JlQ29udGFpbmVySGVpZ2h0XG5cdFx0XHQrIGJvdHRvbVRvb2xiYXJHYXBcblx0XHRcdCsgbGF5b3V0Q29uZmlndXJhdGlvbi5jZWxsQm90dG9tTWFyZ2luO1xuXHR9XG5cblx0cHJvdGVjdGVkIG9uRGlkQ2hhbmdlVGV4dE1vZGVsQ29udGVudCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5nZXRFZGl0U3RhdGUoKSAhPT0gQ2VsbEVkaXRTdGF0ZS5FZGl0aW5nKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZUVkaXRTdGF0ZShDZWxsRWRpdFN0YXRlLkVkaXRpbmcsICdvbkRpZENoYW5nZVRleHRNb2RlbENvbnRlbnQnKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUuZmlyZSh7IGNvbnRlbnRDaGFuZ2VkOiB0cnVlIH0pO1xuXHRcdH1cblx0fVxuXG5cdG9uRGVzZWxlY3QoKSB7XG5cdFx0dGhpcy51cGRhdGVFZGl0U3RhdGUoQ2VsbEVkaXRTdGF0ZS5QcmV2aWV3LCAnb25EZXNlbGVjdCcpO1xuXHR9XG5cblx0dXBkYXRlT3V0cHV0U2hvd01vcmVDb250YWluZXJIZWlnaHQoaGVpZ2h0OiBudW1iZXIpIHtcblx0XHR0aGlzLmxheW91dENoYW5nZSh7IG91dHB1dFNob3dNb3JlQ29udGFpbmVySGVpZ2h0OiBoZWlnaHQgfSwgJ0NvZGVDZWxsVmlld01vZGVsI3VwZGF0ZU91dHB1dFNob3dNb3JlQ29udGFpbmVySGVpZ2h0Jyk7XG5cdH1cblxuXHR1cGRhdGVPdXRwdXRNaW5IZWlnaHQoaGVpZ2h0OiBudW1iZXIpIHtcblx0XHR0aGlzLm91dHB1dE1pbkhlaWdodCA9IGhlaWdodDtcblx0fVxuXG5cdHVubG9ja091dHB1dEhlaWdodCgpIHtcblx0XHR0aGlzLm91dHB1dE1pbkhlaWdodCA9IDA7XG5cdFx0dGhpcy5sYXlvdXRDaGFuZ2UoeyBvdXRwdXRIZWlnaHQ6IHRydWUgfSk7XG5cdH1cblxuXHR1cGRhdGVPdXRwdXRIZWlnaHQoaW5kZXg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIHNvdXJjZT86IHN0cmluZykge1xuXHRcdGlmIChpbmRleCA+PSB0aGlzLl9vdXRwdXRDb2xsZWN0aW9uLmxlbmd0aCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdPdXRwdXQgaW5kZXggb3V0IG9mIHJhbmdlIScpO1xuXHRcdH1cblxuXHRcdHRoaXMuX2Vuc3VyZU91dHB1dHNUb3AoKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRpZiAoaW5kZXggPT09IDAgfHwgaGVpZ2h0ID4gMCkge1xuXHRcdFx0XHR0aGlzLl9vdXRwdXRWaWV3TW9kZWxzW2luZGV4XS5zZXRWaXNpYmxlKHRydWUpO1xuXHRcdFx0fSBlbHNlIGlmIChoZWlnaHQgPT09IDApIHtcblx0XHRcdFx0dGhpcy5fb3V0cHV0Vmlld01vZGVsc1tpbmRleF0uc2V0VmlzaWJsZShmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc3QgZXJyb3JNZXNzYWdlID0gYEZhaWxlZCB0byB1cGRhdGUgb3V0cHV0IGhlaWdodCBmb3IgY2VsbCAke3RoaXMuaGFuZGxlfSwgb3V0cHV0ICR7aW5kZXh9LiBgXG5cdFx0XHRcdCsgYHRoaXMub3V0cHV0Q29sbGVjdGlvbi5sZW5ndGg6ICR7dGhpcy5fb3V0cHV0Q29sbGVjdGlvbi5sZW5ndGh9LCB0aGlzLl9vdXRwdXRWaWV3TW9kZWxzLmxlbmd0aDogJHt0aGlzLl9vdXRwdXRWaWV3TW9kZWxzLmxlbmd0aH1gO1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGAke2Vycm9yTWVzc2FnZX0uXFxuIEVycm9yOiAke2UubWVzc2FnZX1gKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fb3V0cHV0Vmlld01vZGVsc1tpbmRleF0udmlzaWJsZS5nZXQoKSAmJiBoZWlnaHQgPCAyOCkge1xuXHRcdFx0aGVpZ2h0ID0gMjg7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb3V0cHV0Q29sbGVjdGlvbltpbmRleF0gPSBoZWlnaHQ7XG5cdFx0aWYgKHRoaXMuX291dHB1dHNUb3AhLnNldFZhbHVlKGluZGV4LCBoZWlnaHQpKSB7XG5cdFx0XHR0aGlzLmxheW91dENoYW5nZSh7IG91dHB1dEhlaWdodDogdHJ1ZSB9LCBzb3VyY2UpO1xuXHRcdH1cblx0fVxuXG5cdGdldE91dHB1dE9mZnNldEluQ29udGFpbmVyKGluZGV4OiBudW1iZXIpIHtcblx0XHR0aGlzLl9lbnN1cmVPdXRwdXRzVG9wKCk7XG5cblx0XHRpZiAoaW5kZXggPj0gdGhpcy5fb3V0cHV0Q29sbGVjdGlvbi5sZW5ndGgpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignT3V0cHV0IGluZGV4IG91dCBvZiByYW5nZSEnKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fb3V0cHV0c1RvcCEuZ2V0UHJlZml4U3VtKGluZGV4IC0gMSk7XG5cdH1cblxuXHRnZXRPdXRwdXRPZmZzZXQoaW5kZXg6IG51bWJlcik6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMubGF5b3V0SW5mby5vdXRwdXRDb250YWluZXJPZmZzZXQgKyB0aGlzLmdldE91dHB1dE9mZnNldEluQ29udGFpbmVyKGluZGV4KTtcblx0fVxuXG5cdHNwbGljZU91dHB1dEhlaWdodHMoc3RhcnQ6IG51bWJlciwgZGVsZXRlQ250OiBudW1iZXIsIGhlaWdodHM6IG51bWJlcltdKSB7XG5cdFx0dGhpcy5fZW5zdXJlT3V0cHV0c1RvcCgpO1xuXG5cdFx0dGhpcy5fb3V0cHV0c1RvcCEucmVtb3ZlVmFsdWVzKHN0YXJ0LCBkZWxldGVDbnQpO1xuXHRcdGlmIChoZWlnaHRzLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgdmFsdWVzID0gbmV3IFVpbnQzMkFycmF5KGhlaWdodHMubGVuZ3RoKTtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgaGVpZ2h0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHR2YWx1ZXNbaV0gPSBoZWlnaHRzW2ldO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9vdXRwdXRzVG9wIS5pbnNlcnRWYWx1ZXMoc3RhcnQsIHZhbHVlcyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5sYXlvdXRDaGFuZ2UoeyBvdXRwdXRIZWlnaHQ6IHRydWUgfSwgJ0NvZGVDZWxsVmlld01vZGVsI3NwbGljZU91dHB1dHMnKTtcblx0fVxuXG5cdHByaXZhdGUgX2Vuc3VyZU91dHB1dHNUb3AoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9vdXRwdXRzVG9wKSB7XG5cdFx0XHRjb25zdCB2YWx1ZXMgPSBuZXcgVWludDMyQXJyYXkodGhpcy5fb3V0cHV0Q29sbGVjdGlvbi5sZW5ndGgpO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9vdXRwdXRDb2xsZWN0aW9uLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdHZhbHVlc1tpXSA9IHRoaXMuX291dHB1dENvbGxlY3Rpb25baV07XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX291dHB1dHNUb3AgPSBuZXcgUHJlZml4U3VtQ29tcHV0ZXIodmFsdWVzKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9oYXNGaW5kUmVzdWx0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8Ym9vbGVhbj4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBoYXNGaW5kUmVzdWx0OiBFdmVudDxib29sZWFuPiA9IHRoaXMuX2hhc0ZpbmRSZXN1bHQuZXZlbnQ7XG5cblx0c3RhcnRGaW5kKHZhbHVlOiBzdHJpbmcsIG9wdGlvbnM6IElOb3RlYm9va0ZpbmRPcHRpb25zKTogQ2VsbEZpbmRNYXRjaCB8IG51bGwge1xuXHRcdGNvbnN0IG1hdGNoZXMgPSBzdXBlci5jZWxsU3RhcnRGaW5kKHZhbHVlLCBvcHRpb25zKTtcblxuXHRcdGlmIChtYXRjaGVzID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Y2VsbDogdGhpcyxcblx0XHRcdGNvbnRlbnRNYXRjaGVzOiBtYXRjaGVzXG5cdFx0fTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXG5cdFx0dGhpcy5fb3V0cHV0Q29sbGVjdGlvbiA9IFtdO1xuXHRcdHRoaXMuX291dHB1dHNUb3AgPSBudWxsO1xuXHRcdGRpc3Bvc2UodGhpcy5fb3V0cHV0Vmlld01vZGVscyk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxTQUFnQix3QkFBd0I7QUFDakQsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsdUJBQXVCO0FBQ2hDLFlBQVksVUFBVTtBQUN0QixTQUFTLDBCQUEwQjtBQUVuQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFT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
