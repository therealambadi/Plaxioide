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
import * as DOM from "../../../../../base/browser/dom.js";
import * as domStylesheetsJs from "../../../../../base/browser/domStylesheets.js";
import { ListError } from "../../../../../base/browser/ui/list/list.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { isMacintosh } from "../../../../../base/common/platform.js";
import { TrackedRangeStickiness } from "../../../../../editor/common/model.js";
import { PrefixSumComputer } from "../../../../../editor/common/model/prefixSumComputer.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IListService, WorkbenchList } from "../../../../../platform/list/browser/listService.js";
import { CursorAtBoundary, CellEditState, CellRevealType, CellRevealRangeType, CursorAtLineBoundary } from "../notebookBrowser.js";
import { diff, NOTEBOOK_EDITOR_CURSOR_BOUNDARY, CellKind, SelectionStateType, NOTEBOOK_EDITOR_CURSOR_LINE_BOUNDARY } from "../../common/notebookCommon.js";
import { cellRangesToIndexes, reduceCellRanges, cellRangesEqual } from "../../common/notebookRange.js";
import { NOTEBOOK_CELL_LIST_FOCUSED } from "../../common/notebookContextKeys.js";
import { clamp } from "../../../../../base/common/numbers.js";
import { FastDomNode } from "../../../../../base/browser/fastDomNode.js";
import { MarkupCellViewModel } from "../viewModel/markupCellViewModel.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { NotebookCellListView } from "./notebookCellListView.js";
import { INotebookExecutionStateService } from "../../common/notebookExecutionStateService.js";
import { NotebookCellAnchor } from "./notebookCellAnchor.js";
import { NotebookViewZones } from "../viewParts/notebookViewZones.js";
import { NotebookCellOverlays } from "../viewParts/notebookCellOverlays.js";
var CellRevealPosition = /* @__PURE__ */ ((CellRevealPosition2) => {
  CellRevealPosition2[CellRevealPosition2["Top"] = 0] = "Top";
  CellRevealPosition2[CellRevealPosition2["Center"] = 1] = "Center";
  CellRevealPosition2[CellRevealPosition2["Bottom"] = 2] = "Bottom";
  CellRevealPosition2[CellRevealPosition2["NearTop"] = 3] = "NearTop";
  return CellRevealPosition2;
})(CellRevealPosition || {});
function getVisibleCells(cells, hiddenRanges) {
  if (!hiddenRanges.length) {
    return cells;
  }
  let start = 0;
  let hiddenRangeIndex = 0;
  const result = [];
  while (start < cells.length && hiddenRangeIndex < hiddenRanges.length) {
    if (start < hiddenRanges[hiddenRangeIndex].start) {
      result.push(...cells.slice(start, hiddenRanges[hiddenRangeIndex].start));
    }
    start = hiddenRanges[hiddenRangeIndex].end + 1;
    hiddenRangeIndex++;
  }
  if (start < cells.length) {
    result.push(...cells.slice(start));
  }
  return result;
}
const NOTEBOOK_WEBVIEW_BOUNDARY = 5e3;
function validateWebviewBoundary(element) {
  const webviewTop = 0 - (parseInt(element.style.top, 10) || 0);
  return webviewTop >= 0 && webviewTop <= NOTEBOOK_WEBVIEW_BOUNDARY * 2;
}
let NotebookCellList = class extends WorkbenchList {
  constructor(listUser, container, notebookOptions, delegate, renderers, contextKeyService, options, listService, configurationService, instantiationService, notebookExecutionStateService) {
    super(listUser, container, delegate, renderers, options, contextKeyService, listService, configurationService, instantiationService);
    this.listUser = listUser;
    this.notebookOptions = notebookOptions;
    this._previousFocusedElements = [];
    this._localDisposableStore = new DisposableStore();
    this._viewModelStore = new DisposableStore();
    this._onDidRemoveOutputs = this._localDisposableStore.add(new Emitter());
    this.onDidRemoveOutputs = this._onDidRemoveOutputs.event;
    this._onDidHideOutputs = this._localDisposableStore.add(new Emitter());
    this.onDidHideOutputs = this._onDidHideOutputs.event;
    this._onDidRemoveCellsFromView = this._localDisposableStore.add(new Emitter());
    this.onDidRemoveCellsFromView = this._onDidRemoveCellsFromView.event;
    this._viewModel = null;
    this._hiddenRangeIds = [];
    this.hiddenRangesPrefixSum = null;
    this._onDidChangeVisibleRanges = this._localDisposableStore.add(new Emitter());
    this.onDidChangeVisibleRanges = this._onDidChangeVisibleRanges.event;
    this._visibleRanges = [];
    this._isDisposed = false;
    this._isInLayout = false;
    this._webviewElement = null;
    NOTEBOOK_CELL_LIST_FOCUSED.bindTo(this.contextKeyService).set(true);
    this._previousFocusedElements = this.getFocusedElements();
    this._localDisposableStore.add(this.onDidChangeFocus((e) => {
      this._previousFocusedElements.forEach((element) => {
        if (e.elements.indexOf(element) < 0) {
          element.onDeselect();
        }
      });
      this._previousFocusedElements = e.elements;
    }));
    const notebookEditorCursorAtBoundaryContext = NOTEBOOK_EDITOR_CURSOR_BOUNDARY.bindTo(contextKeyService);
    notebookEditorCursorAtBoundaryContext.set("none");
    const notebookEditorCursorAtLineBoundaryContext = NOTEBOOK_EDITOR_CURSOR_LINE_BOUNDARY.bindTo(contextKeyService);
    notebookEditorCursorAtLineBoundaryContext.set("none");
    const cursorSelectionListener = this._localDisposableStore.add(new MutableDisposable());
    const textEditorAttachListener = this._localDisposableStore.add(new MutableDisposable());
    this._notebookCellAnchor = new NotebookCellAnchor(notebookExecutionStateService, configurationService, this.onDidScroll);
    const recomputeContext = (element) => {
      switch (element.cursorAtBoundary()) {
        case CursorAtBoundary.Both:
          notebookEditorCursorAtBoundaryContext.set("both");
          break;
        case CursorAtBoundary.Top:
          notebookEditorCursorAtBoundaryContext.set("top");
          break;
        case CursorAtBoundary.Bottom:
          notebookEditorCursorAtBoundaryContext.set("bottom");
          break;
        default:
          notebookEditorCursorAtBoundaryContext.set("none");
          break;
      }
      switch (element.cursorAtLineBoundary()) {
        case CursorAtLineBoundary.Both:
          notebookEditorCursorAtLineBoundaryContext.set("both");
          break;
        case CursorAtLineBoundary.Start:
          notebookEditorCursorAtLineBoundaryContext.set("start");
          break;
        case CursorAtLineBoundary.End:
          notebookEditorCursorAtLineBoundaryContext.set("end");
          break;
        default:
          notebookEditorCursorAtLineBoundaryContext.set("none");
          break;
      }
      return;
    };
    this._localDisposableStore.add(this.onDidChangeFocus((e) => {
      if (e.elements.length) {
        const focusedElement = e.elements[0];
        cursorSelectionListener.value = focusedElement.onDidChangeState((e2) => {
          if (e2.selectionChanged) {
            recomputeContext(focusedElement);
          }
        });
        textEditorAttachListener.value = focusedElement.onDidChangeEditorAttachState(() => {
          if (focusedElement.editorAttached) {
            recomputeContext(focusedElement);
          }
        });
        recomputeContext(focusedElement);
        return;
      }
      notebookEditorCursorAtBoundaryContext.set("none");
    }));
    const updateVisibleRanges = () => {
      if (!this.view.length) {
        return;
      }
      const top = this.getViewScrollTop();
      const bottom = this.getViewScrollBottom();
      if (top >= bottom) {
        return;
      }
      const topViewIndex = clamp(this.view.indexAt(top), 0, this.view.length - 1);
      const topElement = this.view.element(topViewIndex);
      const topModelIndex = this._viewModel.getCellIndex(topElement);
      const bottomViewIndex = clamp(this.view.indexAt(bottom), 0, this.view.length - 1);
      const bottomElement = this.view.element(bottomViewIndex);
      const bottomModelIndex = this._viewModel.getCellIndex(bottomElement);
      if (bottomModelIndex - topModelIndex === bottomViewIndex - topViewIndex) {
        this.visibleRanges = [{ start: topModelIndex, end: bottomModelIndex + 1 }];
      } else {
        this.visibleRanges = this._getVisibleRangesFromIndex(topViewIndex, topModelIndex, bottomViewIndex, bottomModelIndex);
      }
    };
    this._localDisposableStore.add(this.view.onDidChangeContentHeight(() => {
      if (this._isInLayout) {
        DOM.scheduleAtNextAnimationFrame(DOM.getWindow(container), () => {
          updateVisibleRanges();
        });
      }
      updateVisibleRanges();
    }));
    this._localDisposableStore.add(this.view.onDidScroll(() => {
      if (this._isInLayout) {
        DOM.scheduleAtNextAnimationFrame(DOM.getWindow(container), () => {
          updateVisibleRanges();
        });
      }
      updateVisibleRanges();
    }));
  }
  get onWillScroll() {
    return this.view.onWillScroll;
  }
  get rowsContainer() {
    return this.view.containerDomNode;
  }
  get scrollableElement() {
    return this.view.scrollableElementDomNode;
  }
  get viewModel() {
    return this._viewModel;
  }
  get visibleRanges() {
    return this._visibleRanges;
  }
  set visibleRanges(ranges) {
    if (cellRangesEqual(this._visibleRanges, ranges)) {
      return;
    }
    this._visibleRanges = ranges;
    this._onDidChangeVisibleRanges.fire();
  }
  get isDisposed() {
    return this._isDisposed;
  }
  get webviewElement() {
    return this._webviewElement;
  }
  get inRenderingTransaction() {
    return this.view.inRenderingTransaction;
  }
  createListView(container, virtualDelegate, renderers, viewOptions) {
    const listView = new NotebookCellListView(container, virtualDelegate, renderers, viewOptions);
    this.viewZones = new NotebookViewZones(listView, this);
    this.cellOverlays = new NotebookCellOverlays(listView);
    return listView;
  }
  /**
   * Test Only
   */
  _getView() {
    return this.view;
  }
  attachWebview(element) {
    element.style.top = `-${NOTEBOOK_WEBVIEW_BOUNDARY}px`;
    this.rowsContainer.insertAdjacentElement("afterbegin", element);
    this._webviewElement = new FastDomNode(element);
  }
  elementAt(position) {
    if (!this.view.length) {
      return void 0;
    }
    const idx = this.view.indexAt(position);
    const clamped = clamp(idx, 0, this.view.length - 1);
    return this.element(clamped);
  }
  elementHeight(element) {
    const index = this._getViewIndexUpperBound(element);
    if (index === void 0 || index < 0 || index >= this.length) {
      this._getViewIndexUpperBound(element);
      throw new ListError(this.listUser, `Invalid index ${index}`);
    }
    return this.view.elementHeight(index);
  }
  detachViewModel() {
    this._viewModelStore.clear();
    this._viewModel = null;
    this.hiddenRangesPrefixSum = null;
  }
  attachViewModel(model) {
    this._viewModel = model;
    this._viewModelStore.add(model.onDidChangeViewCells((e) => {
      if (this._isDisposed) {
        return;
      }
      this.viewZones.onCellsChanged(e);
      this.cellOverlays.onCellsChanged(e);
      const currentRanges = this._hiddenRangeIds.map((id) => this._viewModel.getTrackedRange(id)).filter((range) => range !== null);
      const newVisibleViewCells = getVisibleCells(this._viewModel.viewCells, currentRanges);
      const oldVisibleViewCells = [];
      const oldViewCellMapping = /* @__PURE__ */ new Set();
      for (let i = 0; i < this.length; i++) {
        oldVisibleViewCells.push(this.element(i));
        oldViewCellMapping.add(this.element(i).uri.toString());
      }
      const viewDiffs = diff(oldVisibleViewCells, newVisibleViewCells, (a) => {
        return oldViewCellMapping.has(a.uri.toString());
      });
      if (e.synchronous) {
        this._updateElementsInWebview(viewDiffs);
      } else {
        this._viewModelStore.add(DOM.scheduleAtNextAnimationFrame(DOM.getWindow(this.rowsContainer), () => {
          if (this._isDisposed) {
            return;
          }
          this._updateElementsInWebview(viewDiffs);
        }));
      }
    }));
    this._viewModelStore.add(model.onDidChangeSelection((e) => {
      if (e === "view") {
        return;
      }
      const viewSelections = cellRangesToIndexes(model.getSelections()).map((index) => model.cellAt(index)).filter((cell) => !!cell).map((cell) => this._getViewIndexUpperBound(cell));
      this.setSelection(viewSelections, void 0, true);
      const primary = cellRangesToIndexes([model.getFocus()]).map((index) => model.cellAt(index)).filter((cell) => !!cell).map((cell) => this._getViewIndexUpperBound(cell));
      if (primary.length) {
        this.setFocus(primary, void 0, true);
      }
    }));
    const hiddenRanges = model.getHiddenRanges();
    this.setHiddenAreas(hiddenRanges, false);
    const newRanges = reduceCellRanges(hiddenRanges);
    const viewCells = model.viewCells.slice(0);
    newRanges.reverse().forEach((range) => {
      const removedCells = viewCells.splice(range.start, range.end - range.start + 1);
      this._onDidRemoveCellsFromView.fire(removedCells);
    });
    this.splice2(0, 0, viewCells);
  }
  _updateElementsInWebview(viewDiffs) {
    viewDiffs.reverse().forEach((diff2) => {
      const hiddenOutputs = [];
      const deletedOutputs = [];
      const removedMarkdownCells = [];
      for (let i = diff2.start; i < diff2.start + diff2.deleteCount; i++) {
        const cell = this.element(i);
        if (cell.cellKind === CellKind.Code) {
          if (this._viewModel.hasCell(cell)) {
            hiddenOutputs.push(...cell?.outputsViewModels);
          } else {
            deletedOutputs.push(...cell?.outputsViewModels);
          }
        } else {
          removedMarkdownCells.push(cell);
        }
      }
      this.splice2(diff2.start, diff2.deleteCount, diff2.toInsert);
      this._onDidHideOutputs.fire(hiddenOutputs);
      this._onDidRemoveOutputs.fire(deletedOutputs);
      this._onDidRemoveCellsFromView.fire(removedMarkdownCells);
    });
  }
  clear() {
    super.splice(0, this.length);
  }
  setHiddenAreas(_ranges, triggerViewUpdate) {
    if (!this._viewModel) {
      return false;
    }
    const newRanges = reduceCellRanges(_ranges);
    const oldRanges = this._hiddenRangeIds.map((id) => this._viewModel.getTrackedRange(id)).filter((range) => range !== null);
    if (newRanges.length === oldRanges.length) {
      let hasDifference = false;
      for (let i = 0; i < newRanges.length; i++) {
        if (!(newRanges[i].start === oldRanges[i].start && newRanges[i].end === oldRanges[i].end)) {
          hasDifference = true;
          break;
        }
      }
      if (!hasDifference) {
        this._updateHiddenRangePrefixSum(newRanges);
        this.viewZones.onHiddenRangesChange();
        this.viewZones.layout();
        this.cellOverlays.onHiddenRangesChange();
        this.cellOverlays.layout();
        return false;
      }
    }
    this._hiddenRangeIds.forEach((id) => this._viewModel.setTrackedRange(id, null, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter));
    const hiddenAreaIds = newRanges.map((range) => this._viewModel.setTrackedRange(null, range, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter)).filter((id) => id !== null);
    this._hiddenRangeIds = hiddenAreaIds;
    this._updateHiddenRangePrefixSum(newRanges);
    this.viewZones.onHiddenRangesChange();
    this.cellOverlays.onHiddenRangesChange();
    if (triggerViewUpdate) {
      this.updateHiddenAreasInView(oldRanges, newRanges);
    }
    this.viewZones.layout();
    this.cellOverlays.layout();
    return true;
  }
  _updateHiddenRangePrefixSum(newRanges) {
    let start = 0;
    let index = 0;
    const ret = [];
    while (index < newRanges.length) {
      for (let j = start; j < newRanges[index].start - 1; j++) {
        ret.push(1);
      }
      ret.push(newRanges[index].end - newRanges[index].start + 1 + 1);
      start = newRanges[index].end + 1;
      index++;
    }
    for (let i = start; i < this._viewModel.length; i++) {
      ret.push(1);
    }
    const values = new Uint32Array(ret.length);
    for (let i = 0; i < ret.length; i++) {
      values[i] = ret[i];
    }
    this.hiddenRangesPrefixSum = new PrefixSumComputer(values);
  }
  /**
   * oldRanges and newRanges are all reduced and sorted.
   */
  updateHiddenAreasInView(oldRanges, newRanges) {
    const oldViewCellEntries = getVisibleCells(this._viewModel.viewCells, oldRanges);
    const oldViewCellMapping = /* @__PURE__ */ new Set();
    oldViewCellEntries.forEach((cell) => {
      oldViewCellMapping.add(cell.uri.toString());
    });
    const newViewCellEntries = getVisibleCells(this._viewModel.viewCells, newRanges);
    const viewDiffs = diff(oldViewCellEntries, newViewCellEntries, (a) => {
      return oldViewCellMapping.has(a.uri.toString());
    });
    this._updateElementsInWebview(viewDiffs);
  }
  splice2(start, deleteCount, elements = []) {
    if (start < 0 || start > this.view.length) {
      return;
    }
    const focusInside = DOM.isAncestorOfActiveElement(this.rowsContainer);
    super.splice(start, deleteCount, elements);
    if (focusInside) {
      this.domFocus();
    }
    const selectionsLeft = [];
    this.getSelectedElements().forEach((el) => {
      if (this._viewModel.hasCell(el)) {
        selectionsLeft.push(el.handle);
      }
    });
    if (!selectionsLeft.length && this._viewModel.viewCells.length) {
      this._viewModel.updateSelectionsState({ kind: SelectionStateType.Index, focus: { start: 0, end: 1 }, selections: [{ start: 0, end: 1 }] });
    }
    this.viewZones.layout();
    this.cellOverlays.layout();
  }
  getModelIndex(cell) {
    const viewIndex = this.indexOf(cell);
    return this.getModelIndex2(viewIndex);
  }
  getModelIndex2(viewIndex) {
    if (!this.hiddenRangesPrefixSum) {
      return viewIndex;
    }
    const modelIndex = this.hiddenRangesPrefixSum.getPrefixSum(viewIndex - 1);
    return modelIndex;
  }
  getViewIndex(cell) {
    const modelIndex = this._viewModel.getCellIndex(cell);
    return this.getViewIndex2(modelIndex);
  }
  getViewIndex2(modelIndex) {
    if (!this.hiddenRangesPrefixSum) {
      return modelIndex;
    }
    const viewIndexInfo = this.hiddenRangesPrefixSum.getIndexOf(modelIndex);
    if (viewIndexInfo.remainder !== 0) {
      if (modelIndex >= this.hiddenRangesPrefixSum.getTotalSum()) {
        return modelIndex - (this.hiddenRangesPrefixSum.getTotalSum() - this.hiddenRangesPrefixSum.getCount());
      }
      return void 0;
    } else {
      return viewIndexInfo.index;
    }
  }
  convertModelIndexToViewIndex(modelIndex) {
    if (!this.hiddenRangesPrefixSum) {
      return modelIndex;
    }
    if (modelIndex >= this.hiddenRangesPrefixSum.getTotalSum()) {
      return Math.min(this.length, this.hiddenRangesPrefixSum.getTotalSum());
    }
    return this.hiddenRangesPrefixSum.getIndexOf(modelIndex).index;
  }
  modelIndexIsVisible(modelIndex) {
    if (!this.hiddenRangesPrefixSum) {
      return true;
    }
    const viewIndexInfo = this.hiddenRangesPrefixSum.getIndexOf(modelIndex);
    if (viewIndexInfo.remainder !== 0) {
      if (modelIndex >= this.hiddenRangesPrefixSum.getTotalSum()) {
        return true;
      }
      return false;
    } else {
      return true;
    }
  }
  _getVisibleRangesFromIndex(topViewIndex, topModelIndex, bottomViewIndex, bottomModelIndex) {
    const stack = [];
    const ranges = [];
    let index = topViewIndex;
    let modelIndex = topModelIndex;
    while (index <= bottomViewIndex) {
      const accu = this.hiddenRangesPrefixSum.getPrefixSum(index);
      if (accu === modelIndex + 1) {
        if (stack.length) {
          if (stack[stack.length - 1] === modelIndex - 1) {
            ranges.push({ start: stack[stack.length - 1], end: modelIndex + 1 });
          } else {
            ranges.push({ start: stack[stack.length - 1], end: stack[stack.length - 1] + 1 });
          }
        }
        stack.push(modelIndex);
        index++;
        modelIndex++;
      } else {
        if (stack.length) {
          if (stack[stack.length - 1] === modelIndex - 1) {
            ranges.push({ start: stack[stack.length - 1], end: modelIndex + 1 });
          } else {
            ranges.push({ start: stack[stack.length - 1], end: stack[stack.length - 1] + 1 });
          }
        }
        stack.push(modelIndex);
        index++;
        modelIndex = accu;
      }
    }
    if (stack.length) {
      ranges.push({ start: stack[stack.length - 1], end: stack[stack.length - 1] + 1 });
    }
    return reduceCellRanges(ranges);
  }
  getVisibleRangesPlusViewportAboveAndBelow() {
    if (this.view.length <= 0) {
      return [];
    }
    const top = Math.max(this.getViewScrollTop() - this.renderHeight, 0);
    const topViewIndex = this.view.indexAt(top);
    const topElement = this.view.element(topViewIndex);
    const topModelIndex = this._viewModel.getCellIndex(topElement);
    const bottom = clamp(this.getViewScrollBottom() + this.renderHeight, 0, this.scrollHeight);
    const bottomViewIndex = clamp(this.view.indexAt(bottom), 0, this.view.length - 1);
    const bottomElement = this.view.element(bottomViewIndex);
    const bottomModelIndex = this._viewModel.getCellIndex(bottomElement);
    if (bottomModelIndex - topModelIndex === bottomViewIndex - topViewIndex) {
      return [{ start: topModelIndex, end: bottomModelIndex }];
    } else {
      return this._getVisibleRangesFromIndex(topViewIndex, topModelIndex, bottomViewIndex, bottomModelIndex);
    }
  }
  _getViewIndexUpperBound(cell) {
    if (!this._viewModel) {
      return -1;
    }
    const modelIndex = this._viewModel.getCellIndex(cell);
    if (modelIndex === -1) {
      return -1;
    }
    if (!this.hiddenRangesPrefixSum) {
      return modelIndex;
    }
    const viewIndexInfo = this.hiddenRangesPrefixSum.getIndexOf(modelIndex);
    if (viewIndexInfo.remainder !== 0) {
      if (modelIndex >= this.hiddenRangesPrefixSum.getTotalSum()) {
        return modelIndex - (this.hiddenRangesPrefixSum.getTotalSum() - this.hiddenRangesPrefixSum.getCount());
      }
    }
    return viewIndexInfo.index;
  }
  _getViewIndexUpperBound2(modelIndex) {
    if (!this.hiddenRangesPrefixSum) {
      return modelIndex;
    }
    const viewIndexInfo = this.hiddenRangesPrefixSum.getIndexOf(modelIndex);
    if (viewIndexInfo.remainder !== 0) {
      if (modelIndex >= this.hiddenRangesPrefixSum.getTotalSum()) {
        return modelIndex - (this.hiddenRangesPrefixSum.getTotalSum() - this.hiddenRangesPrefixSum.getCount());
      }
    }
    return viewIndexInfo.index;
  }
  focusElement(cell) {
    const index = this._getViewIndexUpperBound(cell);
    if (index >= 0 && this._viewModel) {
      const focusedElementHandle = this.element(index).handle;
      this._viewModel.updateSelectionsState({
        kind: SelectionStateType.Handle,
        primary: focusedElementHandle,
        selections: [focusedElementHandle]
      }, "view");
      this.setFocus([index], void 0, false);
    }
  }
  selectElements(elements) {
    const indices = elements.map((cell) => this._getViewIndexUpperBound(cell)).filter((index) => index >= 0);
    this.setSelection(indices);
  }
  getCellViewScrollTop(cell) {
    const index = this._getViewIndexUpperBound(cell);
    if (index === void 0 || index < 0 || index >= this.length) {
      throw new ListError(this.listUser, `Invalid index ${index}`);
    }
    return this.view.elementTop(index);
  }
  getCellViewScrollBottom(cell) {
    const index = this._getViewIndexUpperBound(cell);
    if (index === void 0 || index < 0 || index >= this.length) {
      throw new ListError(this.listUser, `Invalid index ${index}`);
    }
    const top = this.view.elementTop(index);
    const height = this.view.elementHeight(index);
    return top + height;
  }
  setFocus(indexes, browserEvent, ignoreTextModelUpdate) {
    if (ignoreTextModelUpdate) {
      super.setFocus(indexes, browserEvent);
      return;
    }
    if (!indexes.length) {
      if (this._viewModel) {
        if (this.length) {
          return;
        }
        this._viewModel.updateSelectionsState({
          kind: SelectionStateType.Handle,
          primary: null,
          selections: []
        }, "view");
      }
    } else {
      if (this._viewModel) {
        const focusedElementHandle = this.element(indexes[0]).handle;
        this._viewModel.updateSelectionsState({
          kind: SelectionStateType.Handle,
          primary: focusedElementHandle,
          selections: this.getSelection().map((selection) => this.element(selection).handle)
        }, "view");
      }
    }
    super.setFocus(indexes, browserEvent);
  }
  setSelection(indexes, browserEvent, ignoreTextModelUpdate) {
    if (ignoreTextModelUpdate) {
      super.setSelection(indexes, browserEvent);
      return;
    }
    if (!indexes.length) {
      if (this._viewModel) {
        this._viewModel.updateSelectionsState({
          kind: SelectionStateType.Handle,
          primary: this.getFocusedElements()[0]?.handle ?? null,
          selections: []
        }, "view");
      }
    } else {
      if (this._viewModel) {
        this._viewModel.updateSelectionsState({
          kind: SelectionStateType.Handle,
          primary: this.getFocusedElements()[0]?.handle ?? null,
          selections: indexes.map((index) => this.element(index)).map((cell) => cell.handle)
        }, "view");
      }
    }
    super.setSelection(indexes, browserEvent);
  }
  /**
   * The range will be revealed with as little scrolling as possible.
   */
  revealCells(range) {
    const startIndex = this._getViewIndexUpperBound2(range.start);
    if (startIndex < 0) {
      return;
    }
    const endIndex = this._getViewIndexUpperBound2(range.end - 1);
    const scrollTop = this.getViewScrollTop();
    const wrapperBottom = this.getViewScrollBottom();
    const elementTop = this.view.elementTop(startIndex);
    if (elementTop >= scrollTop && elementTop < wrapperBottom) {
      const endElementTop = this.view.elementTop(endIndex);
      const endElementHeight = this.view.elementHeight(endIndex);
      if (endElementTop + endElementHeight <= wrapperBottom) {
        return;
      }
      if (endElementTop >= wrapperBottom) {
        return this._revealInternal(endIndex, false, 2 /* Bottom */);
      }
      if (endElementTop < wrapperBottom) {
        if (endElementTop + endElementHeight - wrapperBottom < elementTop - scrollTop) {
          return this.view.setScrollTop(scrollTop + endElementTop + endElementHeight - wrapperBottom);
        } else {
          return this._revealInternal(startIndex, false, 0 /* Top */);
        }
      }
    }
    this._revealInViewWithMinimalScrolling(startIndex);
  }
  _revealInViewWithMinimalScrolling(viewIndex, firstLine) {
    const firstIndex = this.view.firstMostlyVisibleIndex;
    const elementHeight = this.view.elementHeight(viewIndex);
    if (viewIndex <= firstIndex || !firstLine && elementHeight >= this.view.renderHeight) {
      this._revealInternal(viewIndex, true, 0 /* Top */);
    } else {
      this._revealInternal(viewIndex, true, 2 /* Bottom */, firstLine);
    }
  }
  scrollToBottom() {
    const scrollHeight = this.view.scrollHeight;
    const scrollTop = this.getViewScrollTop();
    const wrapperBottom = this.getViewScrollBottom();
    this.view.setScrollTop(scrollHeight - (wrapperBottom - scrollTop));
  }
  /**
   * Reveals the given cell in the notebook cell list. The cell will come into view syncronously
   * but the cell's editor will be attached asyncronously if it was previously out of view.
   * @returns The promise to await for the cell editor to be attached
   */
  async revealCell(cell, revealType) {
    const index = this._getViewIndexUpperBound(cell);
    if (index < 0) {
      return;
    }
    switch (revealType) {
      case CellRevealType.Top:
        this._revealInternal(index, false, 0 /* Top */);
        break;
      case CellRevealType.Center:
        this._revealInternal(index, false, 1 /* Center */);
        break;
      case CellRevealType.CenterIfOutsideViewport:
        this._revealInternal(index, true, 1 /* Center */);
        break;
      case CellRevealType.NearTopIfOutsideViewport:
        this._revealInternal(index, true, 3 /* NearTop */);
        break;
      case CellRevealType.FirstLineIfOutsideViewport:
        this._revealInViewWithMinimalScrolling(index, true);
        break;
      case CellRevealType.Default:
        this._revealInViewWithMinimalScrolling(index);
        break;
    }
    if (
      // wait for the editor to be created if the cell is in editing mode
      (cell.getEditState() === CellEditState.Editing || revealType === CellRevealType.FirstLineIfOutsideViewport && cell.cellKind === CellKind.Code) && !cell.editorAttached
    ) {
      return getEditorAttachedPromise(cell);
    }
    return;
  }
  _revealInternal(viewIndex, ignoreIfInsideViewport, revealPosition, firstLine) {
    if (viewIndex >= this.view.length) {
      return;
    }
    const scrollTop = this.getViewScrollTop();
    const wrapperBottom = this.getViewScrollBottom();
    const elementTop = this.view.elementTop(viewIndex);
    const elementBottom = this.view.elementHeight(viewIndex) + elementTop;
    if (ignoreIfInsideViewport) {
      if (elementTop >= scrollTop && elementBottom < wrapperBottom) {
        return;
      }
    }
    switch (revealPosition) {
      case 0 /* Top */:
        this.view.setScrollTop(elementTop);
        this.view.setScrollTop(this.view.elementTop(viewIndex));
        break;
      case 1 /* Center */:
      case 3 /* NearTop */:
        {
          this.view.setScrollTop(elementTop - this.view.renderHeight / 2);
          const newElementTop = this.view.elementTop(viewIndex);
          const newElementHeight = this.view.elementHeight(viewIndex);
          const renderHeight = this.getViewScrollBottom() - this.getViewScrollTop();
          if (newElementHeight >= renderHeight) {
            this.view.setScrollTop(newElementTop);
          } else if (revealPosition === 1 /* Center */) {
            this.view.setScrollTop(newElementTop + newElementHeight / 2 - renderHeight / 2);
          } else if (revealPosition === 3 /* NearTop */) {
            this.view.setScrollTop(newElementTop - renderHeight / 5);
          }
        }
        break;
      case 2 /* Bottom */:
        if (firstLine) {
          const lineHeight = this.viewModel?.layoutInfo?.fontInfo.lineHeight ?? 15;
          const padding = this.notebookOptions.getLayoutConfiguration().cellTopMargin + this.notebookOptions.getLayoutConfiguration().editorTopPadding;
          const firstLineLocation = elementTop + lineHeight + padding;
          if (firstLineLocation < wrapperBottom) {
            return;
          }
          this.view.setScrollTop(this.scrollTop + (firstLineLocation - wrapperBottom));
          break;
        }
        this.view.setScrollTop(this.scrollTop + (elementBottom - wrapperBottom));
        this.view.setScrollTop(this.scrollTop + (this.view.elementTop(viewIndex) + this.view.elementHeight(viewIndex) - this.getViewScrollBottom()));
        break;
      default:
        break;
    }
  }
  //#region Reveal Cell Editor Range asynchronously
  async revealRangeInCell(cell, range, revealType) {
    const index = this._getViewIndexUpperBound(cell);
    if (index < 0) {
      return;
    }
    switch (revealType) {
      case CellRevealRangeType.Default:
        return this._revealRangeInternalAsync(index, range);
      case CellRevealRangeType.Center:
        return this._revealRangeInCenterInternalAsync(index, range);
      case CellRevealRangeType.CenterIfOutsideViewport:
        return this._revealRangeInCenterIfOutsideViewportInternalAsync(index, range);
    }
  }
  // List items have real dynamic heights, which means after we set `scrollTop` based on the `elementTop(index)`, the element at `index` might still be removed from the view once all relayouting tasks are done.
  // For example, we scroll item 10 into the view upwards, in the first round, items 7, 8, 9, 10 are all in the viewport. Then item 7 and 8 resize themselves to be larger and finally item 10 is removed from the view.
  // To ensure that item 10 is always there, we need to scroll item 10 to the top edge of the viewport.
  async _revealRangeInternalAsync(viewIndex, range) {
    const scrollTop = this.getViewScrollTop();
    const wrapperBottom = this.getViewScrollBottom();
    const elementTop = this.view.elementTop(viewIndex);
    const element = this.view.element(viewIndex);
    if (element.editorAttached) {
      this._revealRangeCommon(viewIndex, range);
    } else {
      const elementHeight = this.view.elementHeight(viewIndex);
      let alignHint = void 0;
      if (elementTop + elementHeight <= scrollTop) {
        this.view.setScrollTop(elementTop);
        alignHint = "top";
      } else if (elementTop >= wrapperBottom) {
        this.view.setScrollTop(elementTop - this.view.renderHeight / 2);
        alignHint = "bottom";
      }
      const editorAttachedPromise = new Promise((resolve, reject) => {
        Event.once(element.onDidChangeEditorAttachState)(() => {
          element.editorAttached ? resolve() : reject();
        });
      });
      return editorAttachedPromise.then(() => {
        this._revealRangeCommon(viewIndex, range, alignHint);
      });
    }
  }
  async _revealRangeInCenterInternalAsync(viewIndex, range) {
    const reveal = (viewIndex2, range2) => {
      const element2 = this.view.element(viewIndex2);
      const positionOffset = element2.getPositionScrollTopOffset(range2);
      const positionOffsetInView = this.view.elementTop(viewIndex2) + positionOffset;
      this.view.setScrollTop(positionOffsetInView - this.view.renderHeight / 2);
      element2.revealRangeInCenter(range2);
    };
    const elementTop = this.view.elementTop(viewIndex);
    const viewItemOffset = elementTop;
    this.view.setScrollTop(viewItemOffset - this.view.renderHeight / 2);
    const element = this.view.element(viewIndex);
    if (!element.editorAttached) {
      return getEditorAttachedPromise(element).then(() => reveal(viewIndex, range));
    } else {
      reveal(viewIndex, range);
    }
  }
  async _revealRangeInCenterIfOutsideViewportInternalAsync(viewIndex, range) {
    const reveal = (viewIndex2, range2) => {
      const element2 = this.view.element(viewIndex2);
      const positionOffset2 = element2.getPositionScrollTopOffset(range2);
      const positionOffsetInView = this.view.elementTop(viewIndex2) + positionOffset2;
      this.view.setScrollTop(positionOffsetInView - this.view.renderHeight / 2);
      element2.revealRangeInCenter(range2);
    };
    const scrollTop = this.getViewScrollTop();
    const wrapperBottom = this.getViewScrollBottom();
    const elementTop = this.view.elementTop(viewIndex);
    const viewItemOffset = elementTop;
    const element = this.view.element(viewIndex);
    const positionOffset = viewItemOffset + element.getPositionScrollTopOffset(range);
    if (positionOffset < scrollTop || positionOffset > wrapperBottom) {
      this.view.setScrollTop(positionOffset - this.view.renderHeight / 2);
      const newPositionOffset = this.view.elementTop(viewIndex) + element.getPositionScrollTopOffset(range);
      this.view.setScrollTop(newPositionOffset - this.view.renderHeight / 2);
      if (!element.editorAttached) {
        return getEditorAttachedPromise(element).then(() => reveal(viewIndex, range));
      } else {
      }
    } else {
      if (element.editorAttached) {
        element.revealRangeInCenter(range);
      } else {
        return getEditorAttachedPromise(element).then(() => reveal(viewIndex, range));
      }
    }
  }
  _revealRangeCommon(viewIndex, range, alignHint) {
    const element = this.view.element(viewIndex);
    const scrollTop = this.getViewScrollTop();
    const wrapperBottom = this.getViewScrollBottom();
    const positionOffset = element.getPositionScrollTopOffset(range);
    const elementOriginalHeight = this.view.elementHeight(viewIndex);
    if (positionOffset >= elementOriginalHeight) {
      const newTotalHeight = element.layoutInfo.totalHeight;
      this.updateElementHeight(viewIndex, newTotalHeight);
    }
    const elementTop = this.view.elementTop(viewIndex);
    const positionTop = elementTop + positionOffset;
    if (positionTop < scrollTop) {
      this.view.setScrollTop(positionTop - 30);
    } else if (positionTop > wrapperBottom) {
      this.view.setScrollTop(scrollTop + positionTop - wrapperBottom + 30);
    } else if (alignHint === "bottom") {
      this.view.setScrollTop(scrollTop + positionTop - wrapperBottom + 30);
    } else if (alignHint === "top") {
      this.view.setScrollTop(positionTop - 30);
    }
  }
  //#endregion
  /**
   * Reveals the specified offset of the given cell in the center of the viewport.
   * This enables revealing locations in the output as well as the input.
   */
  revealCellOffsetInCenter(cell, offset) {
    const viewIndex = this._getViewIndexUpperBound(cell);
    if (viewIndex >= 0) {
      const element = this.view.element(viewIndex);
      const elementTop = this.view.elementTop(viewIndex);
      if (element instanceof MarkupCellViewModel) {
        return this._revealInCenterIfOutsideViewport(viewIndex);
      } else {
        const rangeOffset = element.layoutInfo.outputContainerOffset + Math.min(offset, element.layoutInfo.outputTotalHeight);
        this.view.setScrollTop(elementTop - this.view.renderHeight / 2);
        this.view.setScrollTop(elementTop + rangeOffset - this.view.renderHeight / 2);
      }
    }
  }
  revealOffsetInCenterIfOutsideViewport(offset) {
    const scrollTop = this.getViewScrollTop();
    const wrapperBottom = this.getViewScrollBottom();
    if (offset < scrollTop || offset > wrapperBottom) {
      const newTop = Math.max(0, offset - this.view.renderHeight / 2);
      this.view.setScrollTop(newTop);
    }
  }
  _revealInCenterIfOutsideViewport(viewIndex) {
    this._revealInternal(viewIndex, true, 1 /* Center */);
  }
  domElementOfElement(element) {
    const index = this._getViewIndexUpperBound(element);
    if (index >= 0 && index < this.length) {
      return this.view.domElement(index);
    }
    return null;
  }
  focusView() {
    this.view.domNode.focus();
  }
  triggerScrollFromMouseWheelEvent(browserEvent) {
    this.view.delegateScrollFromMouseWheelEvent(browserEvent);
  }
  delegateVerticalScrollbarPointerDown(browserEvent) {
    this.view.delegateVerticalScrollbarPointerDown(browserEvent);
  }
  isElementAboveViewport(index) {
    const elementTop = this.view.elementTop(index);
    const elementBottom = elementTop + this.view.elementHeight(index);
    return elementBottom < this.scrollTop;
  }
  updateElementHeight2(element, size, anchorElementIndex = null) {
    const index = this._getViewIndexUpperBound(element);
    if (index === void 0 || index < 0 || index >= this.length) {
      return;
    }
    if (this.isElementAboveViewport(index)) {
      const oldHeight = this.elementHeight(element);
      const delta = oldHeight - size;
      if (this._webviewElement) {
        Event.once(this.view.onWillScroll)(() => {
          const webviewTop = parseInt(this._webviewElement.domNode.style.top, 10);
          if (validateWebviewBoundary(this._webviewElement.domNode)) {
            this._webviewElement.setTop(webviewTop - delta);
          } else {
            this._webviewElement.setTop(-NOTEBOOK_WEBVIEW_BOUNDARY);
          }
        });
      }
      this.view.updateElementHeight(index, size, anchorElementIndex);
      this.viewZones.layout();
      this.cellOverlays.layout();
      return;
    }
    if (anchorElementIndex !== null) {
      this.view.updateElementHeight(index, size, anchorElementIndex);
      this.viewZones.layout();
      this.cellOverlays.layout();
      return;
    }
    const focused = this.getFocus();
    const focus = focused.length ? focused[0] : null;
    if (focus) {
      const heightDelta = size - this.view.elementHeight(index);
      if (this._notebookCellAnchor.shouldAnchor(this.view, focus, heightDelta, this.element(index))) {
        this.view.updateElementHeight(index, size, focus);
        this.viewZones.layout();
        this.cellOverlays.layout();
        return;
      }
    }
    this.view.updateElementHeight(index, size, null);
    this.viewZones.layout();
    this.cellOverlays.layout();
    return;
  }
  changeViewZones(callback) {
    if (this.viewZones.changeViewZones(callback)) {
      this.viewZones.layout();
    }
  }
  changeCellOverlays(callback) {
    if (this.cellOverlays.changeCellOverlays(callback)) {
      this.cellOverlays.layout();
    }
  }
  getViewZoneLayoutInfo(viewZoneId) {
    return this.viewZones.getViewZoneLayoutInfo(viewZoneId);
  }
  // override
  domFocus() {
    const focused = this.getFocusedElements()[0];
    const focusedDomElement = focused && this.domElementOfElement(focused);
    if (this.view.domNode.ownerDocument.activeElement && focusedDomElement && focusedDomElement.contains(this.view.domNode.ownerDocument.activeElement)) {
      return;
    }
    if (!isMacintosh && this.view.domNode.ownerDocument.activeElement && !!DOM.findParentWithClass(this.view.domNode.ownerDocument.activeElement, "context-view")) {
      return;
    }
    super.domFocus();
  }
  focusContainer(clearSelection) {
    if (clearSelection) {
      this._viewModel?.updateSelectionsState({
        kind: SelectionStateType.Handle,
        primary: null,
        selections: []
      }, "view");
      this.setFocus([], void 0, true);
      this.setSelection([], void 0, true);
    }
    super.domFocus();
  }
  getViewScrollTop() {
    return this.view.getScrollTop();
  }
  getViewScrollBottom() {
    return this.getViewScrollTop() + this.view.renderHeight;
  }
  setCellEditorSelection(cell, range) {
    const element = cell;
    if (element.editorAttached) {
      element.setSelection(range);
    } else {
      getEditorAttachedPromise(element).then(() => {
        element.setSelection(range);
      });
    }
  }
  style(styles) {
    const selectorSuffix = this.view.domId;
    if (!this.styleElement) {
      this.styleElement = domStylesheetsJs.createStyleSheet(this.view.domNode);
    }
    const suffix = selectorSuffix && `.${selectorSuffix}`;
    const content = [];
    if (styles.listBackground) {
      content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows { background: ${styles.listBackground}; }`);
    }
    if (styles.listFocusBackground) {
      content.push(`.monaco-list${suffix}:focus > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.focused { background-color: ${styles.listFocusBackground}; }`);
      content.push(`.monaco-list${suffix}:focus > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.focused:hover { background-color: ${styles.listFocusBackground}; }`);
    }
    if (styles.listFocusForeground) {
      content.push(`.monaco-list${suffix}:focus > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.focused { color: ${styles.listFocusForeground}; }`);
    }
    if (styles.listActiveSelectionBackground) {
      content.push(`.monaco-list${suffix}:focus > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.selected { background-color: ${styles.listActiveSelectionBackground}; }`);
      content.push(`.monaco-list${suffix}:focus > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.selected:hover { background-color: ${styles.listActiveSelectionBackground}; }`);
    }
    if (styles.listActiveSelectionForeground) {
      content.push(`.monaco-list${suffix}:focus > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.selected { color: ${styles.listActiveSelectionForeground}; }`);
    }
    if (styles.listFocusAndSelectionBackground) {
      content.push(`
				.monaco-drag-image${suffix},
				.monaco-list${suffix}:focus > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.selected.focused { background-color: ${styles.listFocusAndSelectionBackground}; }
			`);
    }
    if (styles.listFocusAndSelectionForeground) {
      content.push(`
				.monaco-drag-image${suffix},
				.monaco-list${suffix}:focus > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.selected.focused { color: ${styles.listFocusAndSelectionForeground}; }
			`);
    }
    if (styles.listInactiveFocusBackground) {
      content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.focused { background-color:  ${styles.listInactiveFocusBackground}; }`);
      content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.focused:hover { background-color:  ${styles.listInactiveFocusBackground}; }`);
    }
    if (styles.listInactiveSelectionBackground) {
      content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.selected { background-color:  ${styles.listInactiveSelectionBackground}; }`);
      content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.selected:hover { background-color:  ${styles.listInactiveSelectionBackground}; }`);
    }
    if (styles.listInactiveSelectionForeground) {
      content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.selected { color: ${styles.listInactiveSelectionForeground}; }`);
    }
    if (styles.listHoverBackground) {
      content.push(`.monaco-list${suffix}:not(.drop-target) > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row:hover:not(.selected):not(.focused) { background-color:  ${styles.listHoverBackground}; }`);
    }
    if (styles.listHoverForeground) {
      content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row:hover:not(.selected):not(.focused) { color:  ${styles.listHoverForeground}; }`);
    }
    if (styles.listSelectionOutline) {
      content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.selected { outline: 1px dotted ${styles.listSelectionOutline}; outline-offset: -1px; }`);
    }
    if (styles.listFocusOutline) {
      content.push(`
				.monaco-drag-image${suffix},
				.monaco-list${suffix}:focus > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.focused { outline: 1px solid ${styles.listFocusOutline}; outline-offset: -1px; }
			`);
    }
    if (styles.listInactiveFocusOutline) {
      content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.focused { outline: 1px dotted ${styles.listInactiveFocusOutline}; outline-offset: -1px; }`);
    }
    if (styles.listHoverOutline) {
      content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row:hover { outline: 1px dashed ${styles.listHoverOutline}; outline-offset: -1px; }`);
    }
    if (styles.listDropOverBackground) {
      content.push(`
				.monaco-list${suffix}.drop-target,
				.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows.drop-target,
				.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-row.drop-target { background-color: ${styles.listDropOverBackground} !important; color: inherit !important; }
			`);
    }
    const newStyles = content.join("\n");
    if (newStyles !== this.styleElement.textContent) {
      this.styleElement.textContent = newStyles;
    }
  }
  getRenderHeight() {
    return this.view.renderHeight;
  }
  getScrollHeight() {
    return this.view.scrollHeight;
  }
  layout(height, width) {
    this._isInLayout = true;
    super.layout(height, width);
    if (this.renderHeight === 0) {
      this.view.domNode.style.visibility = "hidden";
    } else {
      this.view.domNode.style.visibility = "initial";
    }
    this._isInLayout = false;
  }
  dispose() {
    this._isDisposed = true;
    this._viewModelStore.dispose();
    this._localDisposableStore.dispose();
    this._notebookCellAnchor.dispose();
    this.viewZones.dispose();
    this.cellOverlays.dispose();
    super.dispose();
    this._previousFocusedElements = [];
    this._viewModel = null;
    this._hiddenRangeIds = [];
    this.hiddenRangesPrefixSum = null;
    this._visibleRanges = [];
  }
};
NotebookCellList = __decorateClass([
  __decorateParam(7, IListService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IInstantiationService),
  __decorateParam(10, INotebookExecutionStateService)
], NotebookCellList);
class ListViewInfoAccessor extends Disposable {
  constructor(list) {
    super();
    this.list = list;
  }
  getViewIndex(cell) {
    return this.list.getViewIndex(cell) ?? -1;
  }
  getViewHeight(cell) {
    if (!this.list.viewModel) {
      return -1;
    }
    return this.list.elementHeight(cell);
  }
  getCellRangeFromViewRange(startIndex, endIndex) {
    if (!this.list.viewModel) {
      return void 0;
    }
    const modelIndex = this.list.getModelIndex2(startIndex);
    if (modelIndex === void 0) {
      throw new Error(`startIndex ${startIndex} out of boundary`);
    }
    if (endIndex >= this.list.length) {
      const endModelIndex = this.list.viewModel.length;
      return { start: modelIndex, end: endModelIndex };
    } else {
      const endModelIndex = this.list.getModelIndex2(endIndex);
      if (endModelIndex === void 0) {
        throw new Error(`endIndex ${endIndex} out of boundary`);
      }
      return { start: modelIndex, end: endModelIndex };
    }
  }
  getCellsFromViewRange(startIndex, endIndex) {
    if (!this.list.viewModel) {
      return [];
    }
    const range = this.getCellRangeFromViewRange(startIndex, endIndex);
    if (!range) {
      return [];
    }
    return this.list.viewModel.getCellsInRange(range);
  }
  getCellsInRange(range) {
    return this.list.viewModel?.getCellsInRange(range) ?? [];
  }
  getVisibleRangesPlusViewportAboveAndBelow() {
    return this.list?.getVisibleRangesPlusViewportAboveAndBelow() ?? [];
  }
}
function getEditorAttachedPromise(element) {
  return new Promise((resolve, reject) => {
    Event.once(element.onDidChangeEditorAttachState)(() => element.editorAttached ? resolve() : reject());
  });
}
export {
  ListViewInfoAccessor,
  NOTEBOOK_WEBVIEW_BOUNDARY,
  NotebookCellList
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXcvbm90ZWJvb2tDZWxsTGlzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIERPTSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCAqIGFzIGRvbVN0eWxlc2hlZXRzSnMgZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbVN0eWxlc2hlZXRzLmpzJztcbmltcG9ydCB7IElNb3VzZVdoZWVsRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBJTGlzdFJlbmRlcmVyLCBJTGlzdFZpcnR1YWxEZWxlZ2F0ZSwgTGlzdEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBJTGlzdFN0eWxlcywgSVN0eWxlQ29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3RXaWRnZXQuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc01hY2ludG9zaCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFNjcm9sbEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2Nyb2xsYWJsZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IFRyYWNrZWRSYW5nZVN0aWNraW5lc3MgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IFByZWZpeFN1bUNvbXB1dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC9wcmVmaXhTdW1Db21wdXRlci5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUxpc3RTZXJ2aWNlLCBJV29ya2JlbmNoTGlzdE9wdGlvbnMsIFdvcmtiZW5jaExpc3QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ3Vyc29yQXRCb3VuZGFyeSwgSUNlbGxWaWV3TW9kZWwsIENlbGxFZGl0U3RhdGUsIElDZWxsT3V0cHV0Vmlld01vZGVsLCBDZWxsUmV2ZWFsVHlwZSwgQ2VsbFJldmVhbFJhbmdlVHlwZSwgQ3Vyc29yQXRMaW5lQm91bmRhcnksIElOb3RlYm9va1ZpZXdab25lQ2hhbmdlQWNjZXNzb3IsIElOb3RlYm9va0NlbGxPdmVybGF5Q2hhbmdlQWNjZXNzb3IgfSBmcm9tICcuLi9ub3RlYm9va0Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgQ2VsbFZpZXdNb2RlbCwgTm90ZWJvb2tWaWV3TW9kZWwgfSBmcm9tICcuLi92aWV3TW9kZWwvbm90ZWJvb2tWaWV3TW9kZWxJbXBsLmpzJztcbmltcG9ydCB7IGRpZmYsIE5PVEVCT09LX0VESVRPUl9DVVJTT1JfQk9VTkRBUlksIENlbGxLaW5kLCBTZWxlY3Rpb25TdGF0ZVR5cGUsIE5PVEVCT09LX0VESVRPUl9DVVJTT1JfTElORV9CT1VOREFSWSB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBJQ2VsbFJhbmdlLCBjZWxsUmFuZ2VzVG9JbmRleGVzLCByZWR1Y2VDZWxsUmFuZ2VzLCBjZWxsUmFuZ2VzRXF1YWwgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tSYW5nZS5qcyc7XG5pbXBvcnQgeyBOT1RFQk9PS19DRUxMX0xJU1RfRk9DVVNFRCB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IGNsYW1wIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbnVtYmVycy5qcyc7XG5pbXBvcnQgeyBJU3BsaWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2VxdWVuY2UuanMnO1xuaW1wb3J0IHsgQmFzZUNlbGxSZW5kZXJUZW1wbGF0ZSwgSU5vdGVib29rQ2VsbExpc3QgfSBmcm9tICcuL25vdGVib29rUmVuZGVyaW5nQ29tbW9uLmpzJztcbmltcG9ydCB7IEZhc3REb21Ob2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2Zhc3REb21Ob2RlLmpzJztcbmltcG9ydCB7IE1hcmt1cENlbGxWaWV3TW9kZWwgfSBmcm9tICcuLi92aWV3TW9kZWwvbWFya3VwQ2VsbFZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMaXN0Vmlld09wdGlvbnMsIElMaXN0VmlldyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3RWaWV3LmpzJztcbmltcG9ydCB7IE5vdGVib29rQ2VsbExpc3RWaWV3IH0gZnJvbSAnLi9ub3RlYm9va0NlbGxMaXN0Vmlldy5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va09wdGlvbnMgfSBmcm9tICcuLi9ub3RlYm9va09wdGlvbnMuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE5vdGVib29rQ2VsbEFuY2hvciB9IGZyb20gJy4vbm90ZWJvb2tDZWxsQW5jaG9yLmpzJztcbmltcG9ydCB7IE5vdGVib29rVmlld1pvbmVzIH0gZnJvbSAnLi4vdmlld1BhcnRzL25vdGVib29rVmlld1pvbmVzLmpzJztcbmltcG9ydCB7IE5vdGVib29rQ2VsbE92ZXJsYXlzIH0gZnJvbSAnLi4vdmlld1BhcnRzL25vdGVib29rQ2VsbE92ZXJsYXlzLmpzJztcblxuY29uc3QgZW51bSBDZWxsUmV2ZWFsUG9zaXRpb24ge1xuXHRUb3AsXG5cdENlbnRlcixcblx0Qm90dG9tLFxuXHROZWFyVG9wXG59XG5cbmZ1bmN0aW9uIGdldFZpc2libGVDZWxscyhjZWxsczogQ2VsbFZpZXdNb2RlbFtdLCBoaWRkZW5SYW5nZXM6IElDZWxsUmFuZ2VbXSkge1xuXHRpZiAoIWhpZGRlblJhbmdlcy5sZW5ndGgpIHtcblx0XHRyZXR1cm4gY2VsbHM7XG5cdH1cblxuXHRsZXQgc3RhcnQgPSAwO1xuXHRsZXQgaGlkZGVuUmFuZ2VJbmRleCA9IDA7XG5cdGNvbnN0IHJlc3VsdDogQ2VsbFZpZXdNb2RlbFtdID0gW107XG5cblx0d2hpbGUgKHN0YXJ0IDwgY2VsbHMubGVuZ3RoICYmIGhpZGRlblJhbmdlSW5kZXggPCBoaWRkZW5SYW5nZXMubGVuZ3RoKSB7XG5cdFx0aWYgKHN0YXJ0IDwgaGlkZGVuUmFuZ2VzW2hpZGRlblJhbmdlSW5kZXhdLnN0YXJ0KSB7XG5cdFx0XHRyZXN1bHQucHVzaCguLi5jZWxscy5zbGljZShzdGFydCwgaGlkZGVuUmFuZ2VzW2hpZGRlblJhbmdlSW5kZXhdLnN0YXJ0KSk7XG5cdFx0fVxuXG5cdFx0c3RhcnQgPSBoaWRkZW5SYW5nZXNbaGlkZGVuUmFuZ2VJbmRleF0uZW5kICsgMTtcblx0XHRoaWRkZW5SYW5nZUluZGV4Kys7XG5cdH1cblxuXHRpZiAoc3RhcnQgPCBjZWxscy5sZW5ndGgpIHtcblx0XHRyZXN1bHQucHVzaCguLi5jZWxscy5zbGljZShzdGFydCkpO1xuXHR9XG5cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IGNvbnN0IE5PVEVCT09LX1dFQlZJRVdfQk9VTkRBUlkgPSA1MDAwO1xuXG5mdW5jdGlvbiB2YWxpZGF0ZVdlYnZpZXdCb3VuZGFyeShlbGVtZW50OiBIVE1MRWxlbWVudCkge1xuXHRjb25zdCB3ZWJ2aWV3VG9wID0gMCAtIChwYXJzZUludChlbGVtZW50LnN0eWxlLnRvcCwgMTApIHx8IDApO1xuXHRyZXR1cm4gd2Vidmlld1RvcCA+PSAwICYmIHdlYnZpZXdUb3AgPD0gTk9URUJPT0tfV0VCVklFV19CT1VOREFSWSAqIDI7XG59XG5cbmV4cG9ydCBjbGFzcyBOb3RlYm9va0NlbGxMaXN0IGV4dGVuZHMgV29ya2JlbmNoTGlzdDxDZWxsVmlld01vZGVsPiBpbXBsZW1lbnRzIElEaXNwb3NhYmxlLCBJU3R5bGVDb250cm9sbGVyLCBJTm90ZWJvb2tDZWxsTGlzdCB7XG5cdHByb3RlY3RlZCBvdmVycmlkZSByZWFkb25seSB2aWV3ITogTm90ZWJvb2tDZWxsTGlzdFZpZXc8Q2VsbFZpZXdNb2RlbD47XG5cdHByaXZhdGUgdmlld1pvbmVzITogTm90ZWJvb2tWaWV3Wm9uZXM7XG5cdHByaXZhdGUgY2VsbE92ZXJsYXlzITogTm90ZWJvb2tDZWxsT3ZlcmxheXM7XG5cdGdldCBvbldpbGxTY3JvbGwoKTogRXZlbnQ8U2Nyb2xsRXZlbnQ+IHsgcmV0dXJuIHRoaXMudmlldy5vbldpbGxTY3JvbGw7IH1cblxuXHRnZXQgcm93c0NvbnRhaW5lcigpOiBIVE1MRWxlbWVudCB7XG5cdFx0cmV0dXJuIHRoaXMudmlldy5jb250YWluZXJEb21Ob2RlO1xuXHR9XG5cblx0Z2V0IHNjcm9sbGFibGVFbGVtZW50KCk6IEhUTUxFbGVtZW50IHtcblx0XHRyZXR1cm4gdGhpcy52aWV3LnNjcm9sbGFibGVFbGVtZW50RG9tTm9kZTtcblx0fVxuXHRwcml2YXRlIF9wcmV2aW91c0ZvY3VzZWRFbGVtZW50czogcmVhZG9ubHkgQ2VsbFZpZXdNb2RlbFtdID0gW107XG5cdHByaXZhdGUgcmVhZG9ubHkgX2xvY2FsRGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF92aWV3TW9kZWxTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSBzdHlsZUVsZW1lbnQ/OiBIVE1MU3R5bGVFbGVtZW50O1xuXHRwcml2YXRlIF9ub3RlYm9va0NlbGxBbmNob3I6IE5vdGVib29rQ2VsbEFuY2hvcjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFJlbW92ZU91dHB1dHMgPSB0aGlzLl9sb2NhbERpc3Bvc2FibGVTdG9yZS5hZGQobmV3IEVtaXR0ZXI8cmVhZG9ubHkgSUNlbGxPdXRwdXRWaWV3TW9kZWxbXT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkUmVtb3ZlT3V0cHV0cyA9IHRoaXMuX29uRGlkUmVtb3ZlT3V0cHV0cy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEhpZGVPdXRwdXRzID0gdGhpcy5fbG9jYWxEaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBFbWl0dGVyPHJlYWRvbmx5IElDZWxsT3V0cHV0Vmlld01vZGVsW10+KCkpO1xuXHRyZWFkb25seSBvbkRpZEhpZGVPdXRwdXRzID0gdGhpcy5fb25EaWRIaWRlT3V0cHV0cy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFJlbW92ZUNlbGxzRnJvbVZpZXcgPSB0aGlzLl9sb2NhbERpc3Bvc2FibGVTdG9yZS5hZGQobmV3IEVtaXR0ZXI8cmVhZG9ubHkgSUNlbGxWaWV3TW9kZWxbXT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkUmVtb3ZlQ2VsbHNGcm9tVmlldyA9IHRoaXMuX29uRGlkUmVtb3ZlQ2VsbHNGcm9tVmlldy5ldmVudDtcblxuXHRwcml2YXRlIF92aWV3TW9kZWw6IE5vdGVib29rVmlld01vZGVsIHwgbnVsbCA9IG51bGw7XG5cdGdldCB2aWV3TW9kZWwoKTogTm90ZWJvb2tWaWV3TW9kZWwgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fdmlld01vZGVsO1xuXHR9XG5cdHByaXZhdGUgX2hpZGRlblJhbmdlSWRzOiBzdHJpbmdbXSA9IFtdO1xuXHRwcml2YXRlIGhpZGRlblJhbmdlc1ByZWZpeFN1bTogUHJlZml4U3VtQ29tcHV0ZXIgfCBudWxsID0gbnVsbDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVZpc2libGVSYW5nZXMgPSB0aGlzLl9sb2NhbERpc3Bvc2FibGVTdG9yZS5hZGQobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cblx0b25EaWRDaGFuZ2VWaXNpYmxlUmFuZ2VzOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlVmlzaWJsZVJhbmdlcy5ldmVudDtcblx0cHJpdmF0ZSBfdmlzaWJsZVJhbmdlczogSUNlbGxSYW5nZVtdID0gW107XG5cblx0Z2V0IHZpc2libGVSYW5nZXMoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3Zpc2libGVSYW5nZXM7XG5cdH1cblxuXHRzZXQgdmlzaWJsZVJhbmdlcyhyYW5nZXM6IElDZWxsUmFuZ2VbXSkge1xuXHRcdGlmIChjZWxsUmFuZ2VzRXF1YWwodGhpcy5fdmlzaWJsZVJhbmdlcywgcmFuZ2VzKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3Zpc2libGVSYW5nZXMgPSByYW5nZXM7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VWaXNpYmxlUmFuZ2VzLmZpcmUoKTtcblx0fVxuXG5cdHByaXZhdGUgX2lzRGlzcG9zZWQgPSBmYWxzZTtcblxuXHRnZXQgaXNEaXNwb3NlZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5faXNEaXNwb3NlZDtcblx0fVxuXG5cdHByaXZhdGUgX2lzSW5MYXlvdXQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRwcml2YXRlIF93ZWJ2aWV3RWxlbWVudDogRmFzdERvbU5vZGU8SFRNTEVsZW1lbnQ+IHwgbnVsbCA9IG51bGw7XG5cblx0Z2V0IHdlYnZpZXdFbGVtZW50KCkge1xuXHRcdHJldHVybiB0aGlzLl93ZWJ2aWV3RWxlbWVudDtcblx0fVxuXG5cdGdldCBpblJlbmRlcmluZ1RyYW5zYWN0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLnZpZXcuaW5SZW5kZXJpbmdUcmFuc2FjdGlvbjtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgbGlzdFVzZXI6IHN0cmluZyxcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbm90ZWJvb2tPcHRpb25zOiBOb3RlYm9va09wdGlvbnMsXG5cdFx0ZGVsZWdhdGU6IElMaXN0VmlydHVhbERlbGVnYXRlPENlbGxWaWV3TW9kZWw+LFxuXHRcdHJlbmRlcmVyczogSUxpc3RSZW5kZXJlcjxDZWxsVmlld01vZGVsLCBCYXNlQ2VsbFJlbmRlclRlbXBsYXRlPltdLFxuXHRcdGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0b3B0aW9uczogSVdvcmtiZW5jaExpc3RPcHRpb25zPENlbGxWaWV3TW9kZWw+LFxuXHRcdEBJTGlzdFNlcnZpY2UgbGlzdFNlcnZpY2U6IElMaXN0U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2Ugbm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2U6IElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIobGlzdFVzZXIsIGNvbnRhaW5lciwgZGVsZWdhdGUsIHJlbmRlcmVycywgb3B0aW9ucywgY29udGV4dEtleVNlcnZpY2UsIGxpc3RTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdE5PVEVCT09LX0NFTExfTElTVF9GT0NVU0VELmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKS5zZXQodHJ1ZSk7XG5cdFx0dGhpcy5fcHJldmlvdXNGb2N1c2VkRWxlbWVudHMgPSB0aGlzLmdldEZvY3VzZWRFbGVtZW50cygpO1xuXHRcdHRoaXMuX2xvY2FsRGlzcG9zYWJsZVN0b3JlLmFkZCh0aGlzLm9uRGlkQ2hhbmdlRm9jdXMoKGUpID0+IHtcblx0XHRcdHRoaXMuX3ByZXZpb3VzRm9jdXNlZEVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7XG5cdFx0XHRcdGlmIChlLmVsZW1lbnRzLmluZGV4T2YoZWxlbWVudCkgPCAwKSB7XG5cdFx0XHRcdFx0ZWxlbWVudC5vbkRlc2VsZWN0KCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5fcHJldmlvdXNGb2N1c2VkRWxlbWVudHMgPSBlLmVsZW1lbnRzO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IG5vdGVib29rRWRpdG9yQ3Vyc29yQXRCb3VuZGFyeUNvbnRleHQgPSBOT1RFQk9PS19FRElUT1JfQ1VSU09SX0JPVU5EQVJZLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0bm90ZWJvb2tFZGl0b3JDdXJzb3JBdEJvdW5kYXJ5Q29udGV4dC5zZXQoJ25vbmUnKTtcblxuXHRcdGNvbnN0IG5vdGVib29rRWRpdG9yQ3Vyc29yQXRMaW5lQm91bmRhcnlDb250ZXh0ID0gTk9URUJPT0tfRURJVE9SX0NVUlNPUl9MSU5FX0JPVU5EQVJZLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0bm90ZWJvb2tFZGl0b3JDdXJzb3JBdExpbmVCb3VuZGFyeUNvbnRleHQuc2V0KCdub25lJyk7XG5cblx0XHRjb25zdCBjdXJzb3JTZWxlY3Rpb25MaXN0ZW5lciA9IHRoaXMuX2xvY2FsRGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdFx0Y29uc3QgdGV4dEVkaXRvckF0dGFjaExpc3RlbmVyID0gdGhpcy5fbG9jYWxEaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblxuXHRcdHRoaXMuX25vdGVib29rQ2VsbEFuY2hvciA9IG5ldyBOb3RlYm9va0NlbGxBbmNob3Iobm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0aGlzLm9uRGlkU2Nyb2xsKTtcblxuXHRcdGNvbnN0IHJlY29tcHV0ZUNvbnRleHQgPSAoZWxlbWVudDogQ2VsbFZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0c3dpdGNoIChlbGVtZW50LmN1cnNvckF0Qm91bmRhcnkoKSkge1xuXHRcdFx0XHRjYXNlIEN1cnNvckF0Qm91bmRhcnkuQm90aDpcblx0XHRcdFx0XHRub3RlYm9va0VkaXRvckN1cnNvckF0Qm91bmRhcnlDb250ZXh0LnNldCgnYm90aCcpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIEN1cnNvckF0Qm91bmRhcnkuVG9wOlxuXHRcdFx0XHRcdG5vdGVib29rRWRpdG9yQ3Vyc29yQXRCb3VuZGFyeUNvbnRleHQuc2V0KCd0b3AnKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBDdXJzb3JBdEJvdW5kYXJ5LkJvdHRvbTpcblx0XHRcdFx0XHRub3RlYm9va0VkaXRvckN1cnNvckF0Qm91bmRhcnlDb250ZXh0LnNldCgnYm90dG9tJyk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0bm90ZWJvb2tFZGl0b3JDdXJzb3JBdEJvdW5kYXJ5Q29udGV4dC5zZXQoJ25vbmUnKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0c3dpdGNoIChlbGVtZW50LmN1cnNvckF0TGluZUJvdW5kYXJ5KCkpIHtcblx0XHRcdFx0Y2FzZSBDdXJzb3JBdExpbmVCb3VuZGFyeS5Cb3RoOlxuXHRcdFx0XHRcdG5vdGVib29rRWRpdG9yQ3Vyc29yQXRMaW5lQm91bmRhcnlDb250ZXh0LnNldCgnYm90aCcpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIEN1cnNvckF0TGluZUJvdW5kYXJ5LlN0YXJ0OlxuXHRcdFx0XHRcdG5vdGVib29rRWRpdG9yQ3Vyc29yQXRMaW5lQm91bmRhcnlDb250ZXh0LnNldCgnc3RhcnQnKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBDdXJzb3JBdExpbmVCb3VuZGFyeS5FbmQ6XG5cdFx0XHRcdFx0bm90ZWJvb2tFZGl0b3JDdXJzb3JBdExpbmVCb3VuZGFyeUNvbnRleHQuc2V0KCdlbmQnKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRub3RlYm9va0VkaXRvckN1cnNvckF0TGluZUJvdW5kYXJ5Q29udGV4dC5zZXQoJ25vbmUnKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuO1xuXHRcdH07XG5cblx0XHQvLyBDdXJzb3IgQm91bmRhcnkgY29udGV4dFxuXHRcdHRoaXMuX2xvY2FsRGlzcG9zYWJsZVN0b3JlLmFkZCh0aGlzLm9uRGlkQ2hhbmdlRm9jdXMoKGUpID0+IHtcblx0XHRcdGlmIChlLmVsZW1lbnRzLmxlbmd0aCkge1xuXHRcdFx0XHQvLyB3ZSBvbmx5IHZhbGlkYXRlIHRoZSBmaXJzdCBmb2N1c2VkIGVsZW1lbnRcblx0XHRcdFx0Y29uc3QgZm9jdXNlZEVsZW1lbnQgPSBlLmVsZW1lbnRzWzBdO1xuXG5cdFx0XHRcdGN1cnNvclNlbGVjdGlvbkxpc3RlbmVyLnZhbHVlID0gZm9jdXNlZEVsZW1lbnQub25EaWRDaGFuZ2VTdGF0ZSgoZSkgPT4ge1xuXHRcdFx0XHRcdGlmIChlLnNlbGVjdGlvbkNoYW5nZWQpIHtcblx0XHRcdFx0XHRcdHJlY29tcHV0ZUNvbnRleHQoZm9jdXNlZEVsZW1lbnQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGV4dEVkaXRvckF0dGFjaExpc3RlbmVyLnZhbHVlID0gZm9jdXNlZEVsZW1lbnQub25EaWRDaGFuZ2VFZGl0b3JBdHRhY2hTdGF0ZSgoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGZvY3VzZWRFbGVtZW50LmVkaXRvckF0dGFjaGVkKSB7XG5cdFx0XHRcdFx0XHRyZWNvbXB1dGVDb250ZXh0KGZvY3VzZWRFbGVtZW50KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHJlY29tcHV0ZUNvbnRleHQoZm9jdXNlZEVsZW1lbnQpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIHJlc2V0IGNvbnRleHRcblx0XHRcdG5vdGVib29rRWRpdG9yQ3Vyc29yQXRCb3VuZGFyeUNvbnRleHQuc2V0KCdub25lJyk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gdXBkYXRlIHZpc2libGVSYW5nZXNcblx0XHRjb25zdCB1cGRhdGVWaXNpYmxlUmFuZ2VzID0gKCkgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLnZpZXcubGVuZ3RoKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgdG9wID0gdGhpcy5nZXRWaWV3U2Nyb2xsVG9wKCk7XG5cdFx0XHRjb25zdCBib3R0b20gPSB0aGlzLmdldFZpZXdTY3JvbGxCb3R0b20oKTtcblx0XHRcdGlmICh0b3AgPj0gYm90dG9tKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgdG9wVmlld0luZGV4ID0gY2xhbXAodGhpcy52aWV3LmluZGV4QXQodG9wKSwgMCwgdGhpcy52aWV3Lmxlbmd0aCAtIDEpO1xuXHRcdFx0Y29uc3QgdG9wRWxlbWVudCA9IHRoaXMudmlldy5lbGVtZW50KHRvcFZpZXdJbmRleCk7XG5cdFx0XHRjb25zdCB0b3BNb2RlbEluZGV4ID0gdGhpcy5fdmlld01vZGVsIS5nZXRDZWxsSW5kZXgodG9wRWxlbWVudCk7XG5cdFx0XHRjb25zdCBib3R0b21WaWV3SW5kZXggPSBjbGFtcCh0aGlzLnZpZXcuaW5kZXhBdChib3R0b20pLCAwLCB0aGlzLnZpZXcubGVuZ3RoIC0gMSk7XG5cdFx0XHRjb25zdCBib3R0b21FbGVtZW50ID0gdGhpcy52aWV3LmVsZW1lbnQoYm90dG9tVmlld0luZGV4KTtcblx0XHRcdGNvbnN0IGJvdHRvbU1vZGVsSW5kZXggPSB0aGlzLl92aWV3TW9kZWwhLmdldENlbGxJbmRleChib3R0b21FbGVtZW50KTtcblxuXHRcdFx0aWYgKGJvdHRvbU1vZGVsSW5kZXggLSB0b3BNb2RlbEluZGV4ID09PSBib3R0b21WaWV3SW5kZXggLSB0b3BWaWV3SW5kZXgpIHtcblx0XHRcdFx0dGhpcy52aXNpYmxlUmFuZ2VzID0gW3sgc3RhcnQ6IHRvcE1vZGVsSW5kZXgsIGVuZDogYm90dG9tTW9kZWxJbmRleCArIDEgfV07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnZpc2libGVSYW5nZXMgPSB0aGlzLl9nZXRWaXNpYmxlUmFuZ2VzRnJvbUluZGV4KHRvcFZpZXdJbmRleCwgdG9wTW9kZWxJbmRleCwgYm90dG9tVmlld0luZGV4LCBib3R0b21Nb2RlbEluZGV4KTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dGhpcy5fbG9jYWxEaXNwb3NhYmxlU3RvcmUuYWRkKHRoaXMudmlldy5vbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX2lzSW5MYXlvdXQpIHtcblx0XHRcdFx0RE9NLnNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWUoRE9NLmdldFdpbmRvdyhjb250YWluZXIpLCAoKSA9PiB7XG5cdFx0XHRcdFx0dXBkYXRlVmlzaWJsZVJhbmdlcygpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdHVwZGF0ZVZpc2libGVSYW5nZXMoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fbG9jYWxEaXNwb3NhYmxlU3RvcmUuYWRkKHRoaXMudmlldy5vbkRpZFNjcm9sbCgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5faXNJbkxheW91dCkge1xuXHRcdFx0XHRET00uc2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZShET00uZ2V0V2luZG93KGNvbnRhaW5lciksICgpID0+IHtcblx0XHRcdFx0XHR1cGRhdGVWaXNpYmxlUmFuZ2VzKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0dXBkYXRlVmlzaWJsZVJhbmdlcygpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBjcmVhdGVMaXN0Vmlldyhjb250YWluZXI6IEhUTUxFbGVtZW50LCB2aXJ0dWFsRGVsZWdhdGU6IElMaXN0VmlydHVhbERlbGVnYXRlPENlbGxWaWV3TW9kZWw+LCByZW5kZXJlcnM6IElMaXN0UmVuZGVyZXI8YW55LCBhbnk+W10sIHZpZXdPcHRpb25zOiBJTGlzdFZpZXdPcHRpb25zPENlbGxWaWV3TW9kZWw+KTogSUxpc3RWaWV3PENlbGxWaWV3TW9kZWw+IHtcblx0XHRjb25zdCBsaXN0VmlldyA9IG5ldyBOb3RlYm9va0NlbGxMaXN0Vmlldyhjb250YWluZXIsIHZpcnR1YWxEZWxlZ2F0ZSwgcmVuZGVyZXJzLCB2aWV3T3B0aW9ucyk7XG5cdFx0dGhpcy52aWV3Wm9uZXMgPSBuZXcgTm90ZWJvb2tWaWV3Wm9uZXMobGlzdFZpZXcsIHRoaXMpO1xuXHRcdHRoaXMuY2VsbE92ZXJsYXlzID0gbmV3IE5vdGVib29rQ2VsbE92ZXJsYXlzKGxpc3RWaWV3KTtcblx0XHRyZXR1cm4gbGlzdFZpZXc7XG5cdH1cblxuXHQvKipcblx0ICogVGVzdCBPbmx5XG5cdCAqL1xuXHRfZ2V0VmlldygpIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3O1xuXHR9XG5cblx0YXR0YWNoV2VidmlldyhlbGVtZW50OiBIVE1MRWxlbWVudCkge1xuXHRcdGVsZW1lbnQuc3R5bGUudG9wID0gYC0ke05PVEVCT09LX1dFQlZJRVdfQk9VTkRBUll9cHhgO1xuXHRcdHRoaXMucm93c0NvbnRhaW5lci5pbnNlcnRBZGphY2VudEVsZW1lbnQoJ2FmdGVyYmVnaW4nLCBlbGVtZW50KTtcblx0XHR0aGlzLl93ZWJ2aWV3RWxlbWVudCA9IG5ldyBGYXN0RG9tTm9kZTxIVE1MRWxlbWVudD4oZWxlbWVudCk7XG5cdH1cblxuXHRlbGVtZW50QXQocG9zaXRpb246IG51bWJlcik6IElDZWxsVmlld01vZGVsIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMudmlldy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaWR4ID0gdGhpcy52aWV3LmluZGV4QXQocG9zaXRpb24pO1xuXHRcdGNvbnN0IGNsYW1wZWQgPSBjbGFtcChpZHgsIDAsIHRoaXMudmlldy5sZW5ndGggLSAxKTtcblx0XHRyZXR1cm4gdGhpcy5lbGVtZW50KGNsYW1wZWQpO1xuXHR9XG5cblx0ZWxlbWVudEhlaWdodChlbGVtZW50OiBJQ2VsbFZpZXdNb2RlbCk6IG51bWJlciB7XG5cdFx0Y29uc3QgaW5kZXggPSB0aGlzLl9nZXRWaWV3SW5kZXhVcHBlckJvdW5kKGVsZW1lbnQpO1xuXHRcdGlmIChpbmRleCA9PT0gdW5kZWZpbmVkIHx8IGluZGV4IDwgMCB8fCBpbmRleCA+PSB0aGlzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5fZ2V0Vmlld0luZGV4VXBwZXJCb3VuZChlbGVtZW50KTtcblx0XHRcdHRocm93IG5ldyBMaXN0RXJyb3IodGhpcy5saXN0VXNlciwgYEludmFsaWQgaW5kZXggJHtpbmRleH1gKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy52aWV3LmVsZW1lbnRIZWlnaHQoaW5kZXgpO1xuXHR9XG5cblx0ZGV0YWNoVmlld01vZGVsKCkge1xuXHRcdHRoaXMuX3ZpZXdNb2RlbFN0b3JlLmNsZWFyKCk7XG5cdFx0dGhpcy5fdmlld01vZGVsID0gbnVsbDtcblx0XHR0aGlzLmhpZGRlblJhbmdlc1ByZWZpeFN1bSA9IG51bGw7XG5cdH1cblxuXHRhdHRhY2hWaWV3TW9kZWwobW9kZWw6IE5vdGVib29rVmlld01vZGVsKSB7XG5cdFx0dGhpcy5fdmlld01vZGVsID0gbW9kZWw7XG5cdFx0dGhpcy5fdmlld01vZGVsU3RvcmUuYWRkKG1vZGVsLm9uRGlkQ2hhbmdlVmlld0NlbGxzKChlKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIHVwZGF0ZSB3aGl0ZXNwYWNlcyB3aGljaCBhcmUgYW5jaG9yZWQgdG8gdGhlIG1vZGVsIGluZGV4ZXNcblx0XHRcdHRoaXMudmlld1pvbmVzLm9uQ2VsbHNDaGFuZ2VkKGUpO1xuXHRcdFx0dGhpcy5jZWxsT3ZlcmxheXMub25DZWxsc0NoYW5nZWQoZSk7XG5cblx0XHRcdGNvbnN0IGN1cnJlbnRSYW5nZXMgPSB0aGlzLl9oaWRkZW5SYW5nZUlkcy5tYXAoaWQgPT4gdGhpcy5fdmlld01vZGVsIS5nZXRUcmFja2VkUmFuZ2UoaWQpKS5maWx0ZXIocmFuZ2UgPT4gcmFuZ2UgIT09IG51bGwpIGFzIElDZWxsUmFuZ2VbXTtcblx0XHRcdGNvbnN0IG5ld1Zpc2libGVWaWV3Q2VsbHM6IENlbGxWaWV3TW9kZWxbXSA9IGdldFZpc2libGVDZWxscyh0aGlzLl92aWV3TW9kZWwhLnZpZXdDZWxscyBhcyBDZWxsVmlld01vZGVsW10sIGN1cnJlbnRSYW5nZXMpO1xuXG5cdFx0XHRjb25zdCBvbGRWaXNpYmxlVmlld0NlbGxzOiBDZWxsVmlld01vZGVsW10gPSBbXTtcblx0XHRcdGNvbnN0IG9sZFZpZXdDZWxsTWFwcGluZyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdG9sZFZpc2libGVWaWV3Q2VsbHMucHVzaCh0aGlzLmVsZW1lbnQoaSkpO1xuXHRcdFx0XHRvbGRWaWV3Q2VsbE1hcHBpbmcuYWRkKHRoaXMuZWxlbWVudChpKS51cmkudG9TdHJpbmcoKSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHZpZXdEaWZmcyA9IGRpZmY8Q2VsbFZpZXdNb2RlbD4ob2xkVmlzaWJsZVZpZXdDZWxscywgbmV3VmlzaWJsZVZpZXdDZWxscywgYSA9PiB7XG5cdFx0XHRcdHJldHVybiBvbGRWaWV3Q2VsbE1hcHBpbmcuaGFzKGEudXJpLnRvU3RyaW5nKCkpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGlmIChlLnN5bmNocm9ub3VzKSB7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZUVsZW1lbnRzSW5XZWJ2aWV3KHZpZXdEaWZmcyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl92aWV3TW9kZWxTdG9yZS5hZGQoRE9NLnNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWUoRE9NLmdldFdpbmRvdyh0aGlzLnJvd3NDb250YWluZXIpLCAoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuX2lzRGlzcG9zZWQpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0aGlzLl91cGRhdGVFbGVtZW50c0luV2Vidmlldyh2aWV3RGlmZnMpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fdmlld01vZGVsU3RvcmUuYWRkKG1vZGVsLm9uRGlkQ2hhbmdlU2VsZWN0aW9uKChlKSA9PiB7XG5cdFx0XHRpZiAoZSA9PT0gJ3ZpZXcnKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gY29udmVydCBtb2RlbCBzZWxlY3Rpb25zIHRvIHZpZXcgc2VsZWN0aW9uc1xuXHRcdFx0Y29uc3Qgdmlld1NlbGVjdGlvbnMgPSBjZWxsUmFuZ2VzVG9JbmRleGVzKG1vZGVsLmdldFNlbGVjdGlvbnMoKSkubWFwKGluZGV4ID0+IG1vZGVsLmNlbGxBdChpbmRleCkpLmZpbHRlcihjZWxsID0+ICEhY2VsbCkubWFwKGNlbGwgPT4gdGhpcy5fZ2V0Vmlld0luZGV4VXBwZXJCb3VuZChjZWxsISkpO1xuXHRcdFx0dGhpcy5zZXRTZWxlY3Rpb24odmlld1NlbGVjdGlvbnMsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHRjb25zdCBwcmltYXJ5ID0gY2VsbFJhbmdlc1RvSW5kZXhlcyhbbW9kZWwuZ2V0Rm9jdXMoKV0pLm1hcChpbmRleCA9PiBtb2RlbC5jZWxsQXQoaW5kZXgpKS5maWx0ZXIoY2VsbCA9PiAhIWNlbGwpLm1hcChjZWxsID0+IHRoaXMuX2dldFZpZXdJbmRleFVwcGVyQm91bmQoY2VsbCEpKTtcblxuXHRcdFx0aWYgKHByaW1hcnkubGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMuc2V0Rm9jdXMocHJpbWFyeSwgdW5kZWZpbmVkLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCBoaWRkZW5SYW5nZXMgPSBtb2RlbC5nZXRIaWRkZW5SYW5nZXMoKTtcblx0XHR0aGlzLnNldEhpZGRlbkFyZWFzKGhpZGRlblJhbmdlcywgZmFsc2UpO1xuXHRcdGNvbnN0IG5ld1JhbmdlcyA9IHJlZHVjZUNlbGxSYW5nZXMoaGlkZGVuUmFuZ2VzKTtcblx0XHRjb25zdCB2aWV3Q2VsbHMgPSBtb2RlbC52aWV3Q2VsbHMuc2xpY2UoMCkgYXMgQ2VsbFZpZXdNb2RlbFtdO1xuXHRcdG5ld1Jhbmdlcy5yZXZlcnNlKCkuZm9yRWFjaChyYW5nZSA9PiB7XG5cdFx0XHRjb25zdCByZW1vdmVkQ2VsbHMgPSB2aWV3Q2VsbHMuc3BsaWNlKHJhbmdlLnN0YXJ0LCByYW5nZS5lbmQgLSByYW5nZS5zdGFydCArIDEpO1xuXHRcdFx0dGhpcy5fb25EaWRSZW1vdmVDZWxsc0Zyb21WaWV3LmZpcmUocmVtb3ZlZENlbGxzKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuc3BsaWNlMigwLCAwLCB2aWV3Q2VsbHMpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlRWxlbWVudHNJbldlYnZpZXcodmlld0RpZmZzOiBJU3BsaWNlPENlbGxWaWV3TW9kZWw+W10pIHtcblx0XHR2aWV3RGlmZnMucmV2ZXJzZSgpLmZvckVhY2goKGRpZmYpID0+IHtcblx0XHRcdGNvbnN0IGhpZGRlbk91dHB1dHM6IElDZWxsT3V0cHV0Vmlld01vZGVsW10gPSBbXTtcblx0XHRcdGNvbnN0IGRlbGV0ZWRPdXRwdXRzOiBJQ2VsbE91dHB1dFZpZXdNb2RlbFtdID0gW107XG5cdFx0XHRjb25zdCByZW1vdmVkTWFya2Rvd25DZWxsczogSUNlbGxWaWV3TW9kZWxbXSA9IFtdO1xuXG5cdFx0XHRmb3IgKGxldCBpID0gZGlmZi5zdGFydDsgaSA8IGRpZmYuc3RhcnQgKyBkaWZmLmRlbGV0ZUNvdW50OyBpKyspIHtcblx0XHRcdFx0Y29uc3QgY2VsbCA9IHRoaXMuZWxlbWVudChpKTtcblx0XHRcdFx0aWYgKGNlbGwuY2VsbEtpbmQgPT09IENlbGxLaW5kLkNvZGUpIHtcblx0XHRcdFx0XHRpZiAodGhpcy5fdmlld01vZGVsIS5oYXNDZWxsKGNlbGwpKSB7XG5cdFx0XHRcdFx0XHRoaWRkZW5PdXRwdXRzLnB1c2goLi4uY2VsbD8ub3V0cHV0c1ZpZXdNb2RlbHMpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRkZWxldGVkT3V0cHV0cy5wdXNoKC4uLmNlbGw/Lm91dHB1dHNWaWV3TW9kZWxzKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVtb3ZlZE1hcmtkb3duQ2VsbHMucHVzaChjZWxsKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnNwbGljZTIoZGlmZi5zdGFydCwgZGlmZi5kZWxldGVDb3VudCwgZGlmZi50b0luc2VydCk7XG5cblx0XHRcdHRoaXMuX29uRGlkSGlkZU91dHB1dHMuZmlyZShoaWRkZW5PdXRwdXRzKTtcblx0XHRcdHRoaXMuX29uRGlkUmVtb3ZlT3V0cHV0cy5maXJlKGRlbGV0ZWRPdXRwdXRzKTtcblx0XHRcdHRoaXMuX29uRGlkUmVtb3ZlQ2VsbHNGcm9tVmlldy5maXJlKHJlbW92ZWRNYXJrZG93bkNlbGxzKTtcblx0XHR9KTtcblx0fVxuXG5cdGNsZWFyKCkge1xuXHRcdHN1cGVyLnNwbGljZSgwLCB0aGlzLmxlbmd0aCk7XG5cdH1cblxuXHRzZXRIaWRkZW5BcmVhcyhfcmFuZ2VzOiBJQ2VsbFJhbmdlW10sIHRyaWdnZXJWaWV3VXBkYXRlOiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLl92aWV3TW9kZWwpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBuZXdSYW5nZXMgPSByZWR1Y2VDZWxsUmFuZ2VzKF9yYW5nZXMpO1xuXHRcdC8vIGRlbGV0ZSBvbGQgdHJhY2tpbmcgcmFuZ2VzXG5cdFx0Y29uc3Qgb2xkUmFuZ2VzID0gdGhpcy5faGlkZGVuUmFuZ2VJZHMubWFwKGlkID0+IHRoaXMuX3ZpZXdNb2RlbCEuZ2V0VHJhY2tlZFJhbmdlKGlkKSkuZmlsdGVyKHJhbmdlID0+IHJhbmdlICE9PSBudWxsKSBhcyBJQ2VsbFJhbmdlW107XG5cdFx0aWYgKG5ld1Jhbmdlcy5sZW5ndGggPT09IG9sZFJhbmdlcy5sZW5ndGgpIHtcblx0XHRcdGxldCBoYXNEaWZmZXJlbmNlID0gZmFsc2U7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG5ld1Jhbmdlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpZiAoIShuZXdSYW5nZXNbaV0uc3RhcnQgPT09IG9sZFJhbmdlc1tpXS5zdGFydCAmJiBuZXdSYW5nZXNbaV0uZW5kID09PSBvbGRSYW5nZXNbaV0uZW5kKSkge1xuXHRcdFx0XHRcdGhhc0RpZmZlcmVuY2UgPSB0cnVlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICghaGFzRGlmZmVyZW5jZSkge1xuXHRcdFx0XHQvLyB0aGV5IGNhbGwgJ3NldEhpZGRlbkFyZWFzJyBmb3IgYSByZWFzb24sIGV2ZW4gaWYgdGhlIHJhbmdlcyBhcmUgc3RpbGwgdGhlIHNhbWUsIGl0J3MgcG9zc2libGUgdGhhdCB0aGUgaGlkZGVuUmFuZ2VTdW0gaXMgbm90IHVwZGF0ZSB0byBkYXRlXG5cdFx0XHRcdHRoaXMuX3VwZGF0ZUhpZGRlblJhbmdlUHJlZml4U3VtKG5ld1Jhbmdlcyk7XG5cdFx0XHRcdHRoaXMudmlld1pvbmVzLm9uSGlkZGVuUmFuZ2VzQ2hhbmdlKCk7XG5cdFx0XHRcdHRoaXMudmlld1pvbmVzLmxheW91dCgpO1xuXHRcdFx0XHR0aGlzLmNlbGxPdmVybGF5cy5vbkhpZGRlblJhbmdlc0NoYW5nZSgpO1xuXHRcdFx0XHR0aGlzLmNlbGxPdmVybGF5cy5sYXlvdXQoKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX2hpZGRlblJhbmdlSWRzLmZvckVhY2goaWQgPT4gdGhpcy5fdmlld01vZGVsIS5zZXRUcmFja2VkUmFuZ2UoaWQsIG51bGwsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyKSk7XG5cdFx0Y29uc3QgaGlkZGVuQXJlYUlkcyA9IG5ld1Jhbmdlcy5tYXAocmFuZ2UgPT4gdGhpcy5fdmlld01vZGVsIS5zZXRUcmFja2VkUmFuZ2UobnVsbCwgcmFuZ2UsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyKSkuZmlsdGVyKGlkID0+IGlkICE9PSBudWxsKSBhcyBzdHJpbmdbXTtcblxuXHRcdHRoaXMuX2hpZGRlblJhbmdlSWRzID0gaGlkZGVuQXJlYUlkcztcblxuXHRcdC8vIHNldCBoaWRkZW4gcmFuZ2VzIHByZWZpeCBzdW1cblx0XHR0aGlzLl91cGRhdGVIaWRkZW5SYW5nZVByZWZpeFN1bShuZXdSYW5nZXMpO1xuXHRcdC8vIFVwZGF0ZSB2aWV3IHpvbmUgcG9zaXRpb25zIGFmdGVyIGhpZGRlbiByYW5nZXMgY2hhbmdlXG5cdFx0dGhpcy52aWV3Wm9uZXMub25IaWRkZW5SYW5nZXNDaGFuZ2UoKTtcblx0XHR0aGlzLmNlbGxPdmVybGF5cy5vbkhpZGRlblJhbmdlc0NoYW5nZSgpO1xuXG5cdFx0aWYgKHRyaWdnZXJWaWV3VXBkYXRlKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZUhpZGRlbkFyZWFzSW5WaWV3KG9sZFJhbmdlcywgbmV3UmFuZ2VzKTtcblx0XHR9XG5cblx0XHR0aGlzLnZpZXdab25lcy5sYXlvdXQoKTtcblx0XHR0aGlzLmNlbGxPdmVybGF5cy5sYXlvdXQoKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUhpZGRlblJhbmdlUHJlZml4U3VtKG5ld1JhbmdlczogSUNlbGxSYW5nZVtdKSB7XG5cdFx0bGV0IHN0YXJ0ID0gMDtcblx0XHRsZXQgaW5kZXggPSAwO1xuXHRcdGNvbnN0IHJldDogbnVtYmVyW10gPSBbXTtcblxuXHRcdHdoaWxlIChpbmRleCA8IG5ld1Jhbmdlcy5sZW5ndGgpIHtcblx0XHRcdGZvciAobGV0IGogPSBzdGFydDsgaiA8IG5ld1Jhbmdlc1tpbmRleF0uc3RhcnQgLSAxOyBqKyspIHtcblx0XHRcdFx0cmV0LnB1c2goMSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldC5wdXNoKG5ld1Jhbmdlc1tpbmRleF0uZW5kIC0gbmV3UmFuZ2VzW2luZGV4XS5zdGFydCArIDEgKyAxKTtcblx0XHRcdHN0YXJ0ID0gbmV3UmFuZ2VzW2luZGV4XS5lbmQgKyAxO1xuXHRcdFx0aW5kZXgrKztcblx0XHR9XG5cblx0XHRmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCB0aGlzLl92aWV3TW9kZWwhLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRyZXQucHVzaCgxKTtcblx0XHR9XG5cblx0XHRjb25zdCB2YWx1ZXMgPSBuZXcgVWludDMyQXJyYXkocmV0Lmxlbmd0aCk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCByZXQubGVuZ3RoOyBpKyspIHtcblx0XHRcdHZhbHVlc1tpXSA9IHJldFtpXTtcblx0XHR9XG5cblx0XHR0aGlzLmhpZGRlblJhbmdlc1ByZWZpeFN1bSA9IG5ldyBQcmVmaXhTdW1Db21wdXRlcih2YWx1ZXMpO1xuXHR9XG5cblx0LyoqXG5cdCAqIG9sZFJhbmdlcyBhbmQgbmV3UmFuZ2VzIGFyZSBhbGwgcmVkdWNlZCBhbmQgc29ydGVkLlxuXHQgKi9cblx0dXBkYXRlSGlkZGVuQXJlYXNJblZpZXcob2xkUmFuZ2VzOiBJQ2VsbFJhbmdlW10sIG5ld1JhbmdlczogSUNlbGxSYW5nZVtdKSB7XG5cdFx0Y29uc3Qgb2xkVmlld0NlbGxFbnRyaWVzOiBDZWxsVmlld01vZGVsW10gPSBnZXRWaXNpYmxlQ2VsbHModGhpcy5fdmlld01vZGVsIS52aWV3Q2VsbHMgYXMgQ2VsbFZpZXdNb2RlbFtdLCBvbGRSYW5nZXMpO1xuXHRcdGNvbnN0IG9sZFZpZXdDZWxsTWFwcGluZyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdG9sZFZpZXdDZWxsRW50cmllcy5mb3JFYWNoKGNlbGwgPT4ge1xuXHRcdFx0b2xkVmlld0NlbGxNYXBwaW5nLmFkZChjZWxsLnVyaS50b1N0cmluZygpKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IG5ld1ZpZXdDZWxsRW50cmllczogQ2VsbFZpZXdNb2RlbFtdID0gZ2V0VmlzaWJsZUNlbGxzKHRoaXMuX3ZpZXdNb2RlbCEudmlld0NlbGxzIGFzIENlbGxWaWV3TW9kZWxbXSwgbmV3UmFuZ2VzKTtcblxuXHRcdGNvbnN0IHZpZXdEaWZmcyA9IGRpZmY8Q2VsbFZpZXdNb2RlbD4ob2xkVmlld0NlbGxFbnRyaWVzLCBuZXdWaWV3Q2VsbEVudHJpZXMsIGEgPT4ge1xuXHRcdFx0cmV0dXJuIG9sZFZpZXdDZWxsTWFwcGluZy5oYXMoYS51cmkudG9TdHJpbmcoKSk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl91cGRhdGVFbGVtZW50c0luV2Vidmlldyh2aWV3RGlmZnMpO1xuXHR9XG5cblx0c3BsaWNlMihzdGFydDogbnVtYmVyLCBkZWxldGVDb3VudDogbnVtYmVyLCBlbGVtZW50czogcmVhZG9ubHkgQ2VsbFZpZXdNb2RlbFtdID0gW10pOiB2b2lkIHtcblx0XHQvLyB3ZSBuZWVkIHRvIGNvbnZlcnQgc3RhcnQgYW5kIGRlbGV0ZSBjb3VudCBiYXNlZCBvbiBoaWRkZW4gcmFuZ2VzXG5cdFx0aWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+IHRoaXMudmlldy5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBmb2N1c0luc2lkZSA9IERPTS5pc0FuY2VzdG9yT2ZBY3RpdmVFbGVtZW50KHRoaXMucm93c0NvbnRhaW5lcik7XG5cdFx0c3VwZXIuc3BsaWNlKHN0YXJ0LCBkZWxldGVDb3VudCwgZWxlbWVudHMpO1xuXHRcdGlmIChmb2N1c0luc2lkZSkge1xuXHRcdFx0dGhpcy5kb21Gb2N1cygpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlbGVjdGlvbnNMZWZ0ID0gW107XG5cdFx0dGhpcy5nZXRTZWxlY3RlZEVsZW1lbnRzKCkuZm9yRWFjaChlbCA9PiB7XG5cdFx0XHRpZiAodGhpcy5fdmlld01vZGVsIS5oYXNDZWxsKGVsKSkge1xuXHRcdFx0XHRzZWxlY3Rpb25zTGVmdC5wdXNoKGVsLmhhbmRsZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRpZiAoIXNlbGVjdGlvbnNMZWZ0Lmxlbmd0aCAmJiB0aGlzLl92aWV3TW9kZWwhLnZpZXdDZWxscy5sZW5ndGgpIHtcblx0XHRcdC8vIGFmdGVyIHNwbGljZSwgdGhlIHNlbGVjdGVkIGNlbGxzIGFyZSBkZWxldGVkXG5cdFx0XHR0aGlzLl92aWV3TW9kZWwhLnVwZGF0ZVNlbGVjdGlvbnNTdGF0ZSh7IGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCwgZm9jdXM6IHsgc3RhcnQ6IDAsIGVuZDogMSB9LCBzZWxlY3Rpb25zOiBbeyBzdGFydDogMCwgZW5kOiAxIH1dIH0pO1xuXHRcdH1cblxuXHRcdHRoaXMudmlld1pvbmVzLmxheW91dCgpO1xuXHRcdHRoaXMuY2VsbE92ZXJsYXlzLmxheW91dCgpO1xuXHR9XG5cblx0Z2V0TW9kZWxJbmRleChjZWxsOiBDZWxsVmlld01vZGVsKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCB2aWV3SW5kZXggPSB0aGlzLmluZGV4T2YoY2VsbCk7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0TW9kZWxJbmRleDIodmlld0luZGV4KTtcblx0fVxuXG5cdGdldE1vZGVsSW5kZXgyKHZpZXdJbmRleDogbnVtYmVyKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMuaGlkZGVuUmFuZ2VzUHJlZml4U3VtKSB7XG5cdFx0XHRyZXR1cm4gdmlld0luZGV4O1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGVsSW5kZXggPSB0aGlzLmhpZGRlblJhbmdlc1ByZWZpeFN1bS5nZXRQcmVmaXhTdW0odmlld0luZGV4IC0gMSk7XG5cdFx0cmV0dXJuIG1vZGVsSW5kZXg7XG5cdH1cblxuXHRnZXRWaWV3SW5kZXgoY2VsbDogSUNlbGxWaWV3TW9kZWwpIHtcblx0XHRjb25zdCBtb2RlbEluZGV4ID0gdGhpcy5fdmlld01vZGVsIS5nZXRDZWxsSW5kZXgoY2VsbCk7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0Vmlld0luZGV4Mihtb2RlbEluZGV4KTtcblx0fVxuXG5cdGdldFZpZXdJbmRleDIobW9kZWxJbmRleDogbnVtYmVyKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMuaGlkZGVuUmFuZ2VzUHJlZml4U3VtKSB7XG5cdFx0XHRyZXR1cm4gbW9kZWxJbmRleDtcblx0XHR9XG5cblx0XHRjb25zdCB2aWV3SW5kZXhJbmZvID0gdGhpcy5oaWRkZW5SYW5nZXNQcmVmaXhTdW0uZ2V0SW5kZXhPZihtb2RlbEluZGV4KTtcblxuXHRcdGlmICh2aWV3SW5kZXhJbmZvLnJlbWFpbmRlciAhPT0gMCkge1xuXHRcdFx0aWYgKG1vZGVsSW5kZXggPj0gdGhpcy5oaWRkZW5SYW5nZXNQcmVmaXhTdW0uZ2V0VG90YWxTdW0oKSkge1xuXHRcdFx0XHQvLyBpdCdzIGFscmVhZHkgYWZ0ZXIgdGhlIGxhc3QgaGlkZGVuIHJhbmdlXG5cdFx0XHRcdHJldHVybiBtb2RlbEluZGV4IC0gKHRoaXMuaGlkZGVuUmFuZ2VzUHJlZml4U3VtLmdldFRvdGFsU3VtKCkgLSB0aGlzLmhpZGRlblJhbmdlc1ByZWZpeFN1bS5nZXRDb3VudCgpKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB2aWV3SW5kZXhJbmZvLmluZGV4O1xuXHRcdH1cblx0fVxuXG5cdGNvbnZlcnRNb2RlbEluZGV4VG9WaWV3SW5kZXgobW9kZWxJbmRleDogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRpZiAoIXRoaXMuaGlkZGVuUmFuZ2VzUHJlZml4U3VtKSB7XG5cdFx0XHRyZXR1cm4gbW9kZWxJbmRleDtcblx0XHR9XG5cblx0XHRpZiAobW9kZWxJbmRleCA+PSB0aGlzLmhpZGRlblJhbmdlc1ByZWZpeFN1bS5nZXRUb3RhbFN1bSgpKSB7XG5cdFx0XHQvLyBpdCdzIGFscmVhZHkgYWZ0ZXIgdGhlIGxhc3QgaGlkZGVuIHJhbmdlXG5cdFx0XHRyZXR1cm4gTWF0aC5taW4odGhpcy5sZW5ndGgsIHRoaXMuaGlkZGVuUmFuZ2VzUHJlZml4U3VtLmdldFRvdGFsU3VtKCkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmhpZGRlblJhbmdlc1ByZWZpeFN1bS5nZXRJbmRleE9mKG1vZGVsSW5kZXgpLmluZGV4O1xuXHR9XG5cblx0bW9kZWxJbmRleElzVmlzaWJsZShtb2RlbEluZGV4OiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMuaGlkZGVuUmFuZ2VzUHJlZml4U3VtKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCB2aWV3SW5kZXhJbmZvID0gdGhpcy5oaWRkZW5SYW5nZXNQcmVmaXhTdW0uZ2V0SW5kZXhPZihtb2RlbEluZGV4KTtcblx0XHRpZiAodmlld0luZGV4SW5mby5yZW1haW5kZXIgIT09IDApIHtcblx0XHRcdGlmIChtb2RlbEluZGV4ID49IHRoaXMuaGlkZGVuUmFuZ2VzUHJlZml4U3VtLmdldFRvdGFsU3VtKCkpIHtcblx0XHRcdFx0Ly8gaXQncyBhbHJlYWR5IGFmdGVyIHRoZSBsYXN0IGhpZGRlbiByYW5nZVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0VmlzaWJsZVJhbmdlc0Zyb21JbmRleCh0b3BWaWV3SW5kZXg6IG51bWJlciwgdG9wTW9kZWxJbmRleDogbnVtYmVyLCBib3R0b21WaWV3SW5kZXg6IG51bWJlciwgYm90dG9tTW9kZWxJbmRleDogbnVtYmVyKSB7XG5cdFx0Y29uc3Qgc3RhY2s6IG51bWJlcltdID0gW107XG5cdFx0Y29uc3QgcmFuZ2VzOiBJQ2VsbFJhbmdlW10gPSBbXTtcblx0XHQvLyB0aGVyZSBhcmUgaGlkZGVuIHJhbmdlc1xuXHRcdGxldCBpbmRleCA9IHRvcFZpZXdJbmRleDtcblx0XHRsZXQgbW9kZWxJbmRleCA9IHRvcE1vZGVsSW5kZXg7XG5cblx0XHR3aGlsZSAoaW5kZXggPD0gYm90dG9tVmlld0luZGV4KSB7XG5cdFx0XHRjb25zdCBhY2N1ID0gdGhpcy5oaWRkZW5SYW5nZXNQcmVmaXhTdW0hLmdldFByZWZpeFN1bShpbmRleCk7XG5cdFx0XHRpZiAoYWNjdSA9PT0gbW9kZWxJbmRleCArIDEpIHtcblx0XHRcdFx0Ly8gbm8gaGlkZGVuIGFyZWEgYWZ0ZXIgaXRcblx0XHRcdFx0aWYgKHN0YWNrLmxlbmd0aCkge1xuXHRcdFx0XHRcdGlmIChzdGFja1tzdGFjay5sZW5ndGggLSAxXSA9PT0gbW9kZWxJbmRleCAtIDEpIHtcblx0XHRcdFx0XHRcdHJhbmdlcy5wdXNoKHsgc3RhcnQ6IHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdLCBlbmQ6IG1vZGVsSW5kZXggKyAxIH0pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyYW5nZXMucHVzaCh7IHN0YXJ0OiBzdGFja1tzdGFjay5sZW5ndGggLSAxXSwgZW5kOiBzdGFja1tzdGFjay5sZW5ndGggLSAxXSArIDEgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0c3RhY2sucHVzaChtb2RlbEluZGV4KTtcblx0XHRcdFx0aW5kZXgrKztcblx0XHRcdFx0bW9kZWxJbmRleCsrO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gdGhlcmUgYXJlIGhpZGRlbiByYW5nZXMgYWZ0ZXIgaXRcblx0XHRcdFx0aWYgKHN0YWNrLmxlbmd0aCkge1xuXHRcdFx0XHRcdGlmIChzdGFja1tzdGFjay5sZW5ndGggLSAxXSA9PT0gbW9kZWxJbmRleCAtIDEpIHtcblx0XHRcdFx0XHRcdHJhbmdlcy5wdXNoKHsgc3RhcnQ6IHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdLCBlbmQ6IG1vZGVsSW5kZXggKyAxIH0pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyYW5nZXMucHVzaCh7IHN0YXJ0OiBzdGFja1tzdGFjay5sZW5ndGggLSAxXSwgZW5kOiBzdGFja1tzdGFjay5sZW5ndGggLSAxXSArIDEgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0c3RhY2sucHVzaChtb2RlbEluZGV4KTtcblx0XHRcdFx0aW5kZXgrKztcblx0XHRcdFx0bW9kZWxJbmRleCA9IGFjY3U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHN0YWNrLmxlbmd0aCkge1xuXHRcdFx0cmFuZ2VzLnB1c2goeyBzdGFydDogc3RhY2tbc3RhY2subGVuZ3RoIC0gMV0sIGVuZDogc3RhY2tbc3RhY2subGVuZ3RoIC0gMV0gKyAxIH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiByZWR1Y2VDZWxsUmFuZ2VzKHJhbmdlcyk7XG5cdH1cblxuXHRnZXRWaXNpYmxlUmFuZ2VzUGx1c1ZpZXdwb3J0QWJvdmVBbmRCZWxvdygpIHtcblx0XHRpZiAodGhpcy52aWV3Lmxlbmd0aCA8PSAwKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgdG9wID0gTWF0aC5tYXgodGhpcy5nZXRWaWV3U2Nyb2xsVG9wKCkgLSB0aGlzLnJlbmRlckhlaWdodCwgMCk7XG5cdFx0Y29uc3QgdG9wVmlld0luZGV4ID0gdGhpcy52aWV3LmluZGV4QXQodG9wKTtcblx0XHRjb25zdCB0b3BFbGVtZW50ID0gdGhpcy52aWV3LmVsZW1lbnQodG9wVmlld0luZGV4KTtcblx0XHRjb25zdCB0b3BNb2RlbEluZGV4ID0gdGhpcy5fdmlld01vZGVsIS5nZXRDZWxsSW5kZXgodG9wRWxlbWVudCk7XG5cdFx0Y29uc3QgYm90dG9tID0gY2xhbXAodGhpcy5nZXRWaWV3U2Nyb2xsQm90dG9tKCkgKyB0aGlzLnJlbmRlckhlaWdodCwgMCwgdGhpcy5zY3JvbGxIZWlnaHQpO1xuXHRcdGNvbnN0IGJvdHRvbVZpZXdJbmRleCA9IGNsYW1wKHRoaXMudmlldy5pbmRleEF0KGJvdHRvbSksIDAsIHRoaXMudmlldy5sZW5ndGggLSAxKTtcblx0XHRjb25zdCBib3R0b21FbGVtZW50ID0gdGhpcy52aWV3LmVsZW1lbnQoYm90dG9tVmlld0luZGV4KTtcblx0XHRjb25zdCBib3R0b21Nb2RlbEluZGV4ID0gdGhpcy5fdmlld01vZGVsIS5nZXRDZWxsSW5kZXgoYm90dG9tRWxlbWVudCk7XG5cblx0XHRpZiAoYm90dG9tTW9kZWxJbmRleCAtIHRvcE1vZGVsSW5kZXggPT09IGJvdHRvbVZpZXdJbmRleCAtIHRvcFZpZXdJbmRleCkge1xuXHRcdFx0cmV0dXJuIFt7IHN0YXJ0OiB0b3BNb2RlbEluZGV4LCBlbmQ6IGJvdHRvbU1vZGVsSW5kZXggfV07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9nZXRWaXNpYmxlUmFuZ2VzRnJvbUluZGV4KHRvcFZpZXdJbmRleCwgdG9wTW9kZWxJbmRleCwgYm90dG9tVmlld0luZGV4LCBib3R0b21Nb2RlbEluZGV4KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9nZXRWaWV3SW5kZXhVcHBlckJvdW5kKGNlbGw6IElDZWxsVmlld01vZGVsKTogbnVtYmVyIHtcblx0XHRpZiAoIXRoaXMuX3ZpZXdNb2RlbCkge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGVsSW5kZXggPSB0aGlzLl92aWV3TW9kZWwuZ2V0Q2VsbEluZGV4KGNlbGwpO1xuXHRcdGlmIChtb2RlbEluZGV4ID09PSAtMSkge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5oaWRkZW5SYW5nZXNQcmVmaXhTdW0pIHtcblx0XHRcdHJldHVybiBtb2RlbEluZGV4O1xuXHRcdH1cblxuXHRcdGNvbnN0IHZpZXdJbmRleEluZm8gPSB0aGlzLmhpZGRlblJhbmdlc1ByZWZpeFN1bS5nZXRJbmRleE9mKG1vZGVsSW5kZXgpO1xuXG5cdFx0aWYgKHZpZXdJbmRleEluZm8ucmVtYWluZGVyICE9PSAwKSB7XG5cdFx0XHRpZiAobW9kZWxJbmRleCA+PSB0aGlzLmhpZGRlblJhbmdlc1ByZWZpeFN1bS5nZXRUb3RhbFN1bSgpKSB7XG5cdFx0XHRcdHJldHVybiBtb2RlbEluZGV4IC0gKHRoaXMuaGlkZGVuUmFuZ2VzUHJlZml4U3VtLmdldFRvdGFsU3VtKCkgLSB0aGlzLmhpZGRlblJhbmdlc1ByZWZpeFN1bS5nZXRDb3VudCgpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdmlld0luZGV4SW5mby5pbmRleDtcblx0fVxuXG5cdHByaXZhdGUgX2dldFZpZXdJbmRleFVwcGVyQm91bmQyKG1vZGVsSW5kZXg6IG51bWJlcikge1xuXHRcdGlmICghdGhpcy5oaWRkZW5SYW5nZXNQcmVmaXhTdW0pIHtcblx0XHRcdHJldHVybiBtb2RlbEluZGV4O1xuXHRcdH1cblxuXHRcdGNvbnN0IHZpZXdJbmRleEluZm8gPSB0aGlzLmhpZGRlblJhbmdlc1ByZWZpeFN1bS5nZXRJbmRleE9mKG1vZGVsSW5kZXgpO1xuXG5cdFx0aWYgKHZpZXdJbmRleEluZm8ucmVtYWluZGVyICE9PSAwKSB7XG5cdFx0XHRpZiAobW9kZWxJbmRleCA+PSB0aGlzLmhpZGRlblJhbmdlc1ByZWZpeFN1bS5nZXRUb3RhbFN1bSgpKSB7XG5cdFx0XHRcdHJldHVybiBtb2RlbEluZGV4IC0gKHRoaXMuaGlkZGVuUmFuZ2VzUHJlZml4U3VtLmdldFRvdGFsU3VtKCkgLSB0aGlzLmhpZGRlblJhbmdlc1ByZWZpeFN1bS5nZXRDb3VudCgpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdmlld0luZGV4SW5mby5pbmRleDtcblx0fVxuXG5cdGZvY3VzRWxlbWVudChjZWxsOiBJQ2VsbFZpZXdNb2RlbCkge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5fZ2V0Vmlld0luZGV4VXBwZXJCb3VuZChjZWxsKTtcblxuXHRcdGlmIChpbmRleCA+PSAwICYmIHRoaXMuX3ZpZXdNb2RlbCkge1xuXHRcdFx0Ly8gdXBkYXRlIHZpZXcgbW9kZWwgZmlyc3QsIHdoaWNoIHdpbGwgdXBkYXRlIGJvdGggYGZvY3VzYCBhbmQgYHNlbGVjdGlvbmAgaW4gYSBzaW5nbGUgdHJhbnNhY3Rpb25cblx0XHRcdGNvbnN0IGZvY3VzZWRFbGVtZW50SGFuZGxlID0gdGhpcy5lbGVtZW50KGluZGV4KS5oYW5kbGU7XG5cdFx0XHR0aGlzLl92aWV3TW9kZWwudXBkYXRlU2VsZWN0aW9uc1N0YXRlKHtcblx0XHRcdFx0a2luZDogU2VsZWN0aW9uU3RhdGVUeXBlLkhhbmRsZSxcblx0XHRcdFx0cHJpbWFyeTogZm9jdXNlZEVsZW1lbnRIYW5kbGUsXG5cdFx0XHRcdHNlbGVjdGlvbnM6IFtmb2N1c2VkRWxlbWVudEhhbmRsZV1cblx0XHRcdH0sICd2aWV3Jyk7XG5cblx0XHRcdC8vIHVwZGF0ZSB0aGUgdmlldyBhcyBwcmV2aW91cyBtb2RlbCB1cGRhdGUgd2lsbCBub3QgdHJpZ2dlciBldmVudFxuXHRcdFx0dGhpcy5zZXRGb2N1cyhbaW5kZXhdLCB1bmRlZmluZWQsIGZhbHNlKTtcblx0XHR9XG5cdH1cblxuXHRzZWxlY3RFbGVtZW50cyhlbGVtZW50czogSUNlbGxWaWV3TW9kZWxbXSkge1xuXHRcdGNvbnN0IGluZGljZXMgPSBlbGVtZW50cy5tYXAoY2VsbCA9PiB0aGlzLl9nZXRWaWV3SW5kZXhVcHBlckJvdW5kKGNlbGwpKS5maWx0ZXIoaW5kZXggPT4gaW5kZXggPj0gMCk7XG5cdFx0dGhpcy5zZXRTZWxlY3Rpb24oaW5kaWNlcyk7XG5cdH1cblxuXHRnZXRDZWxsVmlld1Njcm9sbFRvcChjZWxsOiBJQ2VsbFZpZXdNb2RlbCkge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5fZ2V0Vmlld0luZGV4VXBwZXJCb3VuZChjZWxsKTtcblx0XHRpZiAoaW5kZXggPT09IHVuZGVmaW5lZCB8fCBpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy5sZW5ndGgpIHtcblx0XHRcdHRocm93IG5ldyBMaXN0RXJyb3IodGhpcy5saXN0VXNlciwgYEludmFsaWQgaW5kZXggJHtpbmRleH1gKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy52aWV3LmVsZW1lbnRUb3AoaW5kZXgpO1xuXHR9XG5cblx0Z2V0Q2VsbFZpZXdTY3JvbGxCb3R0b20oY2VsbDogSUNlbGxWaWV3TW9kZWwpIHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMuX2dldFZpZXdJbmRleFVwcGVyQm91bmQoY2VsbCk7XG5cdFx0aWYgKGluZGV4ID09PSB1bmRlZmluZWQgfHwgaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMubGVuZ3RoKSB7XG5cdFx0XHR0aHJvdyBuZXcgTGlzdEVycm9yKHRoaXMubGlzdFVzZXIsIGBJbnZhbGlkIGluZGV4ICR7aW5kZXh9YCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdG9wID0gdGhpcy52aWV3LmVsZW1lbnRUb3AoaW5kZXgpO1xuXHRcdGNvbnN0IGhlaWdodCA9IHRoaXMudmlldy5lbGVtZW50SGVpZ2h0KGluZGV4KTtcblx0XHRyZXR1cm4gdG9wICsgaGVpZ2h0O1xuXHR9XG5cblx0b3ZlcnJpZGUgc2V0Rm9jdXMoaW5kZXhlczogbnVtYmVyW10sIGJyb3dzZXJFdmVudD86IFVJRXZlbnQsIGlnbm9yZVRleHRNb2RlbFVwZGF0ZT86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAoaWdub3JlVGV4dE1vZGVsVXBkYXRlKSB7XG5cdFx0XHRzdXBlci5zZXRGb2N1cyhpbmRleGVzLCBicm93c2VyRXZlbnQpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghaW5kZXhlcy5sZW5ndGgpIHtcblx0XHRcdGlmICh0aGlzLl92aWV3TW9kZWwpIHtcblx0XHRcdFx0aWYgKHRoaXMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0Ly8gRG9uJ3QgYWxsb3cgY2xlYXJpbmcgZm9jdXMsICMxMjExMjlcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLl92aWV3TW9kZWwudXBkYXRlU2VsZWN0aW9uc1N0YXRlKHtcblx0XHRcdFx0XHRraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSGFuZGxlLFxuXHRcdFx0XHRcdHByaW1hcnk6IG51bGwsXG5cdFx0XHRcdFx0c2VsZWN0aW9uczogW11cblx0XHRcdFx0fSwgJ3ZpZXcnKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKHRoaXMuX3ZpZXdNb2RlbCkge1xuXHRcdFx0XHRjb25zdCBmb2N1c2VkRWxlbWVudEhhbmRsZSA9IHRoaXMuZWxlbWVudChpbmRleGVzWzBdKS5oYW5kbGU7XG5cdFx0XHRcdHRoaXMuX3ZpZXdNb2RlbC51cGRhdGVTZWxlY3Rpb25zU3RhdGUoe1xuXHRcdFx0XHRcdGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5IYW5kbGUsXG5cdFx0XHRcdFx0cHJpbWFyeTogZm9jdXNlZEVsZW1lbnRIYW5kbGUsXG5cdFx0XHRcdFx0c2VsZWN0aW9uczogdGhpcy5nZXRTZWxlY3Rpb24oKS5tYXAoc2VsZWN0aW9uID0+IHRoaXMuZWxlbWVudChzZWxlY3Rpb24pLmhhbmRsZSlcblx0XHRcdFx0fSwgJ3ZpZXcnKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRzdXBlci5zZXRGb2N1cyhpbmRleGVzLCBicm93c2VyRXZlbnQpO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2V0U2VsZWN0aW9uKGluZGV4ZXM6IG51bWJlcltdLCBicm93c2VyRXZlbnQ/OiBVSUV2ZW50IHwgdW5kZWZpbmVkLCBpZ25vcmVUZXh0TW9kZWxVcGRhdGU/OiBib29sZWFuKSB7XG5cdFx0aWYgKGlnbm9yZVRleHRNb2RlbFVwZGF0ZSkge1xuXHRcdFx0c3VwZXIuc2V0U2VsZWN0aW9uKGluZGV4ZXMsIGJyb3dzZXJFdmVudCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCFpbmRleGVzLmxlbmd0aCkge1xuXHRcdFx0aWYgKHRoaXMuX3ZpZXdNb2RlbCkge1xuXHRcdFx0XHR0aGlzLl92aWV3TW9kZWwudXBkYXRlU2VsZWN0aW9uc1N0YXRlKHtcblx0XHRcdFx0XHRraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSGFuZGxlLFxuXHRcdFx0XHRcdHByaW1hcnk6IHRoaXMuZ2V0Rm9jdXNlZEVsZW1lbnRzKClbMF0/LmhhbmRsZSA/PyBudWxsLFxuXHRcdFx0XHRcdHNlbGVjdGlvbnM6IFtdXG5cdFx0XHRcdH0sICd2aWV3Jyk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh0aGlzLl92aWV3TW9kZWwpIHtcblx0XHRcdFx0dGhpcy5fdmlld01vZGVsLnVwZGF0ZVNlbGVjdGlvbnNTdGF0ZSh7XG5cdFx0XHRcdFx0a2luZDogU2VsZWN0aW9uU3RhdGVUeXBlLkhhbmRsZSxcblx0XHRcdFx0XHRwcmltYXJ5OiB0aGlzLmdldEZvY3VzZWRFbGVtZW50cygpWzBdPy5oYW5kbGUgPz8gbnVsbCxcblx0XHRcdFx0XHRzZWxlY3Rpb25zOiBpbmRleGVzLm1hcChpbmRleCA9PiB0aGlzLmVsZW1lbnQoaW5kZXgpKS5tYXAoY2VsbCA9PiBjZWxsLmhhbmRsZSlcblx0XHRcdFx0fSwgJ3ZpZXcnKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRzdXBlci5zZXRTZWxlY3Rpb24oaW5kZXhlcywgYnJvd3NlckV2ZW50KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBUaGUgcmFuZ2Ugd2lsbCBiZSByZXZlYWxlZCB3aXRoIGFzIGxpdHRsZSBzY3JvbGxpbmcgYXMgcG9zc2libGUuXG5cdCAqL1xuXHRyZXZlYWxDZWxscyhyYW5nZTogSUNlbGxSYW5nZSkge1xuXHRcdGNvbnN0IHN0YXJ0SW5kZXggPSB0aGlzLl9nZXRWaWV3SW5kZXhVcHBlckJvdW5kMihyYW5nZS5zdGFydCk7XG5cblx0XHRpZiAoc3RhcnRJbmRleCA8IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlbmRJbmRleCA9IHRoaXMuX2dldFZpZXdJbmRleFVwcGVyQm91bmQyKHJhbmdlLmVuZCAtIDEpO1xuXG5cdFx0Y29uc3Qgc2Nyb2xsVG9wID0gdGhpcy5nZXRWaWV3U2Nyb2xsVG9wKCk7XG5cdFx0Y29uc3Qgd3JhcHBlckJvdHRvbSA9IHRoaXMuZ2V0Vmlld1Njcm9sbEJvdHRvbSgpO1xuXHRcdGNvbnN0IGVsZW1lbnRUb3AgPSB0aGlzLnZpZXcuZWxlbWVudFRvcChzdGFydEluZGV4KTtcblx0XHRpZiAoZWxlbWVudFRvcCA+PSBzY3JvbGxUb3Bcblx0XHRcdCYmIGVsZW1lbnRUb3AgPCB3cmFwcGVyQm90dG9tKSB7XG5cdFx0XHQvLyBzdGFydCBlbGVtZW50IGlzIHZpc2libGVcblx0XHRcdC8vIGNoZWNrIGVuZFxuXG5cdFx0XHRjb25zdCBlbmRFbGVtZW50VG9wID0gdGhpcy52aWV3LmVsZW1lbnRUb3AoZW5kSW5kZXgpO1xuXHRcdFx0Y29uc3QgZW5kRWxlbWVudEhlaWdodCA9IHRoaXMudmlldy5lbGVtZW50SGVpZ2h0KGVuZEluZGV4KTtcblxuXHRcdFx0aWYgKGVuZEVsZW1lbnRUb3AgKyBlbmRFbGVtZW50SGVpZ2h0IDw9IHdyYXBwZXJCb3R0b20pIHtcblx0XHRcdFx0Ly8gZnVsbHkgdmlzaWJsZVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlbmRFbGVtZW50VG9wID49IHdyYXBwZXJCb3R0b20pIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3JldmVhbEludGVybmFsKGVuZEluZGV4LCBmYWxzZSwgQ2VsbFJldmVhbFBvc2l0aW9uLkJvdHRvbSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlbmRFbGVtZW50VG9wIDwgd3JhcHBlckJvdHRvbSkge1xuXHRcdFx0XHQvLyBlbmQgZWxlbWVudCBwYXJ0aWFsbHkgdmlzaWJsZVxuXHRcdFx0XHRpZiAoZW5kRWxlbWVudFRvcCArIGVuZEVsZW1lbnRIZWlnaHQgLSB3cmFwcGVyQm90dG9tIDwgZWxlbWVudFRvcCAtIHNjcm9sbFRvcCkge1xuXHRcdFx0XHRcdC8vIHRoZXJlIGlzIGVub3VnaCBzcGFjZSB0byBqdXN0IHNjcm9sbCB1cCBhIGxpdHRsZSBiaXQgdG8gbWFrZSB0aGUgZW5kIGVsZW1lbnQgdmlzaWJsZVxuXHRcdFx0XHRcdHJldHVybiB0aGlzLnZpZXcuc2V0U2Nyb2xsVG9wKHNjcm9sbFRvcCArIGVuZEVsZW1lbnRUb3AgKyBlbmRFbGVtZW50SGVpZ2h0IC0gd3JhcHBlckJvdHRvbSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gZG9uJ3QgZXZlbiB0cnkgaXRcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fcmV2ZWFsSW50ZXJuYWwoc3RhcnRJbmRleCwgZmFsc2UsIENlbGxSZXZlYWxQb3NpdGlvbi5Ub3ApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmV2ZWFsSW5WaWV3V2l0aE1pbmltYWxTY3JvbGxpbmcoc3RhcnRJbmRleCk7XG5cdH1cblxuXHRwcml2YXRlIF9yZXZlYWxJblZpZXdXaXRoTWluaW1hbFNjcm9sbGluZyh2aWV3SW5kZXg6IG51bWJlciwgZmlyc3RMaW5lPzogYm9vbGVhbikge1xuXHRcdGNvbnN0IGZpcnN0SW5kZXggPSB0aGlzLnZpZXcuZmlyc3RNb3N0bHlWaXNpYmxlSW5kZXg7XG5cdFx0Y29uc3QgZWxlbWVudEhlaWdodCA9IHRoaXMudmlldy5lbGVtZW50SGVpZ2h0KHZpZXdJbmRleCk7XG5cblx0XHRpZiAodmlld0luZGV4IDw9IGZpcnN0SW5kZXggfHwgKCFmaXJzdExpbmUgJiYgZWxlbWVudEhlaWdodCA+PSB0aGlzLnZpZXcucmVuZGVySGVpZ2h0KSkge1xuXHRcdFx0dGhpcy5fcmV2ZWFsSW50ZXJuYWwodmlld0luZGV4LCB0cnVlLCBDZWxsUmV2ZWFsUG9zaXRpb24uVG9wKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fcmV2ZWFsSW50ZXJuYWwodmlld0luZGV4LCB0cnVlLCBDZWxsUmV2ZWFsUG9zaXRpb24uQm90dG9tLCBmaXJzdExpbmUpO1xuXHRcdH1cblx0fVxuXG5cdHNjcm9sbFRvQm90dG9tKCkge1xuXHRcdGNvbnN0IHNjcm9sbEhlaWdodCA9IHRoaXMudmlldy5zY3JvbGxIZWlnaHQ7XG5cdFx0Y29uc3Qgc2Nyb2xsVG9wID0gdGhpcy5nZXRWaWV3U2Nyb2xsVG9wKCk7XG5cdFx0Y29uc3Qgd3JhcHBlckJvdHRvbSA9IHRoaXMuZ2V0Vmlld1Njcm9sbEJvdHRvbSgpO1xuXG5cdFx0dGhpcy52aWV3LnNldFNjcm9sbFRvcChzY3JvbGxIZWlnaHQgLSAod3JhcHBlckJvdHRvbSAtIHNjcm9sbFRvcCkpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldmVhbHMgdGhlIGdpdmVuIGNlbGwgaW4gdGhlIG5vdGVib29rIGNlbGwgbGlzdC4gVGhlIGNlbGwgd2lsbCBjb21lIGludG8gdmlldyBzeW5jcm9ub3VzbHlcblx0ICogYnV0IHRoZSBjZWxsJ3MgZWRpdG9yIHdpbGwgYmUgYXR0YWNoZWQgYXN5bmNyb25vdXNseSBpZiBpdCB3YXMgcHJldmlvdXNseSBvdXQgb2Ygdmlldy5cblx0ICogQHJldHVybnMgVGhlIHByb21pc2UgdG8gYXdhaXQgZm9yIHRoZSBjZWxsIGVkaXRvciB0byBiZSBhdHRhY2hlZFxuXHQgKi9cblx0YXN5bmMgcmV2ZWFsQ2VsbChjZWxsOiBJQ2VsbFZpZXdNb2RlbCwgcmV2ZWFsVHlwZTogQ2VsbFJldmVhbFR5cGUpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMuX2dldFZpZXdJbmRleFVwcGVyQm91bmQoY2VsbCk7XG5cblx0XHRpZiAoaW5kZXggPCAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c3dpdGNoIChyZXZlYWxUeXBlKSB7XG5cdFx0XHRjYXNlIENlbGxSZXZlYWxUeXBlLlRvcDpcblx0XHRcdFx0dGhpcy5fcmV2ZWFsSW50ZXJuYWwoaW5kZXgsIGZhbHNlLCBDZWxsUmV2ZWFsUG9zaXRpb24uVG9wKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIENlbGxSZXZlYWxUeXBlLkNlbnRlcjpcblx0XHRcdFx0dGhpcy5fcmV2ZWFsSW50ZXJuYWwoaW5kZXgsIGZhbHNlLCBDZWxsUmV2ZWFsUG9zaXRpb24uQ2VudGVyKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIENlbGxSZXZlYWxUeXBlLkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0OlxuXHRcdFx0XHR0aGlzLl9yZXZlYWxJbnRlcm5hbChpbmRleCwgdHJ1ZSwgQ2VsbFJldmVhbFBvc2l0aW9uLkNlbnRlcik7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBDZWxsUmV2ZWFsVHlwZS5OZWFyVG9wSWZPdXRzaWRlVmlld3BvcnQ6XG5cdFx0XHRcdHRoaXMuX3JldmVhbEludGVybmFsKGluZGV4LCB0cnVlLCBDZWxsUmV2ZWFsUG9zaXRpb24uTmVhclRvcCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBDZWxsUmV2ZWFsVHlwZS5GaXJzdExpbmVJZk91dHNpZGVWaWV3cG9ydDpcblx0XHRcdFx0dGhpcy5fcmV2ZWFsSW5WaWV3V2l0aE1pbmltYWxTY3JvbGxpbmcoaW5kZXgsIHRydWUpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgQ2VsbFJldmVhbFR5cGUuRGVmYXVsdDpcblx0XHRcdFx0dGhpcy5fcmV2ZWFsSW5WaWV3V2l0aE1pbmltYWxTY3JvbGxpbmcoaW5kZXgpO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRpZiAoKFxuXHRcdFx0Ly8gd2FpdCBmb3IgdGhlIGVkaXRvciB0byBiZSBjcmVhdGVkIGlmIHRoZSBjZWxsIGlzIGluIGVkaXRpbmcgbW9kZVxuXHRcdFx0Y2VsbC5nZXRFZGl0U3RhdGUoKSA9PT0gQ2VsbEVkaXRTdGF0ZS5FZGl0aW5nXG5cdFx0XHQvLyB3YWl0IGZvciB0aGUgZWRpdG9yIHRvIGJlIGNyZWF0ZWQgaWYgd2UgYXJlIHJldmVhbGluZyB0aGUgZmlyc3QgbGluZSBvZiB0aGUgY2VsbFxuXHRcdFx0fHwgKHJldmVhbFR5cGUgPT09IENlbGxSZXZlYWxUeXBlLkZpcnN0TGluZUlmT3V0c2lkZVZpZXdwb3J0ICYmIGNlbGwuY2VsbEtpbmQgPT09IENlbGxLaW5kLkNvZGUpXG5cdFx0KSAmJiAhY2VsbC5lZGl0b3JBdHRhY2hlZCkge1xuXHRcdFx0cmV0dXJuIGdldEVkaXRvckF0dGFjaGVkUHJvbWlzZShjZWxsKTtcblx0XHR9XG5cblx0XHRyZXR1cm47XG5cdH1cblxuXHRwcml2YXRlIF9yZXZlYWxJbnRlcm5hbCh2aWV3SW5kZXg6IG51bWJlciwgaWdub3JlSWZJbnNpZGVWaWV3cG9ydDogYm9vbGVhbiwgcmV2ZWFsUG9zaXRpb246IENlbGxSZXZlYWxQb3NpdGlvbiwgZmlyc3RMaW5lPzogYm9vbGVhbikge1xuXHRcdGlmICh2aWV3SW5kZXggPj0gdGhpcy52aWV3Lmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNjcm9sbFRvcCA9IHRoaXMuZ2V0Vmlld1Njcm9sbFRvcCgpO1xuXHRcdGNvbnN0IHdyYXBwZXJCb3R0b20gPSB0aGlzLmdldFZpZXdTY3JvbGxCb3R0b20oKTtcblx0XHRjb25zdCBlbGVtZW50VG9wID0gdGhpcy52aWV3LmVsZW1lbnRUb3Aodmlld0luZGV4KTtcblx0XHRjb25zdCBlbGVtZW50Qm90dG9tID0gdGhpcy52aWV3LmVsZW1lbnRIZWlnaHQodmlld0luZGV4KSArIGVsZW1lbnRUb3A7XG5cblx0XHRpZiAoaWdub3JlSWZJbnNpZGVWaWV3cG9ydCkge1xuXHRcdFx0aWYgKGVsZW1lbnRUb3AgPj0gc2Nyb2xsVG9wICYmIGVsZW1lbnRCb3R0b20gPCB3cmFwcGVyQm90dG9tKSB7XG5cdFx0XHRcdC8vIGVsZW1lbnQgaXMgYWxyZWFkeSBmdWxseSB2aXNpYmxlXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRzd2l0Y2ggKHJldmVhbFBvc2l0aW9uKSB7XG5cdFx0XHRjYXNlIENlbGxSZXZlYWxQb3NpdGlvbi5Ub3A6XG5cdFx0XHRcdHRoaXMudmlldy5zZXRTY3JvbGxUb3AoZWxlbWVudFRvcCk7XG5cdFx0XHRcdHRoaXMudmlldy5zZXRTY3JvbGxUb3AodGhpcy52aWV3LmVsZW1lbnRUb3Aodmlld0luZGV4KSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBDZWxsUmV2ZWFsUG9zaXRpb24uQ2VudGVyOlxuXHRcdFx0Y2FzZSBDZWxsUmV2ZWFsUG9zaXRpb24uTmVhclRvcDpcblx0XHRcdFx0e1xuXHRcdFx0XHRcdC8vIHJldmVhbCB0aGUgY2VsbCB0b3AgaW4gdGhlIHZpZXdwb3J0IGNlbnRlciBpbml0aWFsbHlcblx0XHRcdFx0XHR0aGlzLnZpZXcuc2V0U2Nyb2xsVG9wKGVsZW1lbnRUb3AgLSB0aGlzLnZpZXcucmVuZGVySGVpZ2h0IC8gMik7XG5cdFx0XHRcdFx0Ly8gY2VsbCByZW5kZXJlZCBhbHJlYWR5LCB3ZSBub3cgaGF2ZSBhIG1vcmUgYWNjdXJhdGUgY2VsbCBoZWlnaHRcblx0XHRcdFx0XHRjb25zdCBuZXdFbGVtZW50VG9wID0gdGhpcy52aWV3LmVsZW1lbnRUb3Aodmlld0luZGV4KTtcblx0XHRcdFx0XHRjb25zdCBuZXdFbGVtZW50SGVpZ2h0ID0gdGhpcy52aWV3LmVsZW1lbnRIZWlnaHQodmlld0luZGV4KTtcblx0XHRcdFx0XHRjb25zdCByZW5kZXJIZWlnaHQgPSB0aGlzLmdldFZpZXdTY3JvbGxCb3R0b20oKSAtIHRoaXMuZ2V0Vmlld1Njcm9sbFRvcCgpO1xuXHRcdFx0XHRcdGlmIChuZXdFbGVtZW50SGVpZ2h0ID49IHJlbmRlckhlaWdodCkge1xuXHRcdFx0XHRcdFx0Ly8gY2VsbCBpcyBsYXJnZXIgdGhhbiB2aWV3cG9ydCwgcmV2ZWFsIHRvcFxuXHRcdFx0XHRcdFx0dGhpcy52aWV3LnNldFNjcm9sbFRvcChuZXdFbGVtZW50VG9wKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHJldmVhbFBvc2l0aW9uID09PSBDZWxsUmV2ZWFsUG9zaXRpb24uQ2VudGVyKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnZpZXcuc2V0U2Nyb2xsVG9wKG5ld0VsZW1lbnRUb3AgKyAobmV3RWxlbWVudEhlaWdodCAvIDIpIC0gKHJlbmRlckhlaWdodCAvIDIpKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHJldmVhbFBvc2l0aW9uID09PSBDZWxsUmV2ZWFsUG9zaXRpb24uTmVhclRvcCkge1xuXHRcdFx0XHRcdFx0dGhpcy52aWV3LnNldFNjcm9sbFRvcChuZXdFbGVtZW50VG9wIC0gKHJlbmRlckhlaWdodCAvIDUpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIENlbGxSZXZlYWxQb3NpdGlvbi5Cb3R0b206XG5cdFx0XHRcdGlmIChmaXJzdExpbmUpIHtcblx0XHRcdFx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gdGhpcy52aWV3TW9kZWw/LmxheW91dEluZm8/LmZvbnRJbmZvLmxpbmVIZWlnaHQgPz8gMTU7XG5cdFx0XHRcdFx0Y29uc3QgcGFkZGluZyA9IHRoaXMubm90ZWJvb2tPcHRpb25zLmdldExheW91dENvbmZpZ3VyYXRpb24oKS5jZWxsVG9wTWFyZ2luICsgdGhpcy5ub3RlYm9va09wdGlvbnMuZ2V0TGF5b3V0Q29uZmlndXJhdGlvbigpLmVkaXRvclRvcFBhZGRpbmc7XG5cdFx0XHRcdFx0Y29uc3QgZmlyc3RMaW5lTG9jYXRpb24gPSBlbGVtZW50VG9wICsgbGluZUhlaWdodCArIHBhZGRpbmc7XG5cdFx0XHRcdFx0aWYgKGZpcnN0TGluZUxvY2F0aW9uIDwgd3JhcHBlckJvdHRvbSkge1xuXHRcdFx0XHRcdFx0Ly8gZmlyc3QgbGluZSBpcyBhbHJlYWR5IHZpc2libGVcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0aGlzLnZpZXcuc2V0U2Nyb2xsVG9wKHRoaXMuc2Nyb2xsVG9wICsgKGZpcnN0TGluZUxvY2F0aW9uIC0gd3JhcHBlckJvdHRvbSkpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMudmlldy5zZXRTY3JvbGxUb3AodGhpcy5zY3JvbGxUb3AgKyAoZWxlbWVudEJvdHRvbSAtIHdyYXBwZXJCb3R0b20pKTtcblx0XHRcdFx0dGhpcy52aWV3LnNldFNjcm9sbFRvcCh0aGlzLnNjcm9sbFRvcCArICh0aGlzLnZpZXcuZWxlbWVudFRvcCh2aWV3SW5kZXgpICsgdGhpcy52aWV3LmVsZW1lbnRIZWlnaHQodmlld0luZGV4KSAtIHRoaXMuZ2V0Vmlld1Njcm9sbEJvdHRvbSgpKSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHR9XG5cblx0Ly8jcmVnaW9uIFJldmVhbCBDZWxsIEVkaXRvciBSYW5nZSBhc3luY2hyb25vdXNseVxuXHRhc3luYyByZXZlYWxSYW5nZUluQ2VsbChjZWxsOiBJQ2VsbFZpZXdNb2RlbCwgcmFuZ2U6IFNlbGVjdGlvbiB8IFJhbmdlLCByZXZlYWxUeXBlOiBDZWxsUmV2ZWFsUmFuZ2VUeXBlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaW5kZXggPSB0aGlzLl9nZXRWaWV3SW5kZXhVcHBlckJvdW5kKGNlbGwpO1xuXG5cdFx0aWYgKGluZGV4IDwgMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHN3aXRjaCAocmV2ZWFsVHlwZSkge1xuXHRcdFx0Y2FzZSBDZWxsUmV2ZWFsUmFuZ2VUeXBlLkRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiB0aGlzLl9yZXZlYWxSYW5nZUludGVybmFsQXN5bmMoaW5kZXgsIHJhbmdlKTtcblx0XHRcdGNhc2UgQ2VsbFJldmVhbFJhbmdlVHlwZS5DZW50ZXI6XG5cdFx0XHRcdHJldHVybiB0aGlzLl9yZXZlYWxSYW5nZUluQ2VudGVySW50ZXJuYWxBc3luYyhpbmRleCwgcmFuZ2UpO1xuXHRcdFx0Y2FzZSBDZWxsUmV2ZWFsUmFuZ2VUeXBlLkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0OlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcmV2ZWFsUmFuZ2VJbkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0SW50ZXJuYWxBc3luYyhpbmRleCwgcmFuZ2UpO1xuXHRcdH1cblx0fVxuXG5cdC8vIExpc3QgaXRlbXMgaGF2ZSByZWFsIGR5bmFtaWMgaGVpZ2h0cywgd2hpY2ggbWVhbnMgYWZ0ZXIgd2Ugc2V0IGBzY3JvbGxUb3BgIGJhc2VkIG9uIHRoZSBgZWxlbWVudFRvcChpbmRleClgLCB0aGUgZWxlbWVudCBhdCBgaW5kZXhgIG1pZ2h0IHN0aWxsIGJlIHJlbW92ZWQgZnJvbSB0aGUgdmlldyBvbmNlIGFsbCByZWxheW91dGluZyB0YXNrcyBhcmUgZG9uZS5cblx0Ly8gRm9yIGV4YW1wbGUsIHdlIHNjcm9sbCBpdGVtIDEwIGludG8gdGhlIHZpZXcgdXB3YXJkcywgaW4gdGhlIGZpcnN0IHJvdW5kLCBpdGVtcyA3LCA4LCA5LCAxMCBhcmUgYWxsIGluIHRoZSB2aWV3cG9ydC4gVGhlbiBpdGVtIDcgYW5kIDggcmVzaXplIHRoZW1zZWx2ZXMgdG8gYmUgbGFyZ2VyIGFuZCBmaW5hbGx5IGl0ZW0gMTAgaXMgcmVtb3ZlZCBmcm9tIHRoZSB2aWV3LlxuXHQvLyBUbyBlbnN1cmUgdGhhdCBpdGVtIDEwIGlzIGFsd2F5cyB0aGVyZSwgd2UgbmVlZCB0byBzY3JvbGwgaXRlbSAxMCB0byB0aGUgdG9wIGVkZ2Ugb2YgdGhlIHZpZXdwb3J0LlxuXHRwcml2YXRlIGFzeW5jIF9yZXZlYWxSYW5nZUludGVybmFsQXN5bmModmlld0luZGV4OiBudW1iZXIsIHJhbmdlOiBTZWxlY3Rpb24gfCBSYW5nZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHNjcm9sbFRvcCA9IHRoaXMuZ2V0Vmlld1Njcm9sbFRvcCgpO1xuXHRcdGNvbnN0IHdyYXBwZXJCb3R0b20gPSB0aGlzLmdldFZpZXdTY3JvbGxCb3R0b20oKTtcblx0XHRjb25zdCBlbGVtZW50VG9wID0gdGhpcy52aWV3LmVsZW1lbnRUb3Aodmlld0luZGV4KTtcblx0XHRjb25zdCBlbGVtZW50ID0gdGhpcy52aWV3LmVsZW1lbnQodmlld0luZGV4KTtcblxuXHRcdGlmIChlbGVtZW50LmVkaXRvckF0dGFjaGVkKSB7XG5cdFx0XHR0aGlzLl9yZXZlYWxSYW5nZUNvbW1vbih2aWV3SW5kZXgsIHJhbmdlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgZWxlbWVudEhlaWdodCA9IHRoaXMudmlldy5lbGVtZW50SGVpZ2h0KHZpZXdJbmRleCk7XG5cdFx0XHRsZXQgYWxpZ25IaW50OiAndG9wJyB8ICdib3R0b20nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0XHRpZiAoZWxlbWVudFRvcCArIGVsZW1lbnRIZWlnaHQgPD0gc2Nyb2xsVG9wKSB7XG5cdFx0XHRcdC8vIHNjcm9sbCB1cFxuXHRcdFx0XHR0aGlzLnZpZXcuc2V0U2Nyb2xsVG9wKGVsZW1lbnRUb3ApO1xuXHRcdFx0XHRhbGlnbkhpbnQgPSAndG9wJztcblx0XHRcdH0gZWxzZSBpZiAoZWxlbWVudFRvcCA+PSB3cmFwcGVyQm90dG9tKSB7XG5cdFx0XHRcdC8vIHNjcm9sbCBkb3duXG5cdFx0XHRcdHRoaXMudmlldy5zZXRTY3JvbGxUb3AoZWxlbWVudFRvcCAtIHRoaXMudmlldy5yZW5kZXJIZWlnaHQgLyAyKTtcblx0XHRcdFx0YWxpZ25IaW50ID0gJ2JvdHRvbSc7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGVkaXRvckF0dGFjaGVkUHJvbWlzZSA9IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0RXZlbnQub25jZShlbGVtZW50Lm9uRGlkQ2hhbmdlRWRpdG9yQXR0YWNoU3RhdGUpKCgpID0+IHtcblx0XHRcdFx0XHRlbGVtZW50LmVkaXRvckF0dGFjaGVkID8gcmVzb2x2ZSgpIDogcmVqZWN0KCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdHJldHVybiBlZGl0b3JBdHRhY2hlZFByb21pc2UudGhlbigoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3JldmVhbFJhbmdlQ29tbW9uKHZpZXdJbmRleCwgcmFuZ2UsIGFsaWduSGludCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9yZXZlYWxSYW5nZUluQ2VudGVySW50ZXJuYWxBc3luYyh2aWV3SW5kZXg6IG51bWJlciwgcmFuZ2U6IFNlbGVjdGlvbiB8IFJhbmdlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcmV2ZWFsID0gKHZpZXdJbmRleDogbnVtYmVyLCByYW5nZTogUmFuZ2UpID0+IHtcblx0XHRcdGNvbnN0IGVsZW1lbnQgPSB0aGlzLnZpZXcuZWxlbWVudCh2aWV3SW5kZXgpO1xuXHRcdFx0Y29uc3QgcG9zaXRpb25PZmZzZXQgPSBlbGVtZW50LmdldFBvc2l0aW9uU2Nyb2xsVG9wT2Zmc2V0KHJhbmdlKTtcblx0XHRcdGNvbnN0IHBvc2l0aW9uT2Zmc2V0SW5WaWV3ID0gdGhpcy52aWV3LmVsZW1lbnRUb3Aodmlld0luZGV4KSArIHBvc2l0aW9uT2Zmc2V0O1xuXHRcdFx0dGhpcy52aWV3LnNldFNjcm9sbFRvcChwb3NpdGlvbk9mZnNldEluVmlldyAtIHRoaXMudmlldy5yZW5kZXJIZWlnaHQgLyAyKTtcblx0XHRcdGVsZW1lbnQucmV2ZWFsUmFuZ2VJbkNlbnRlcihyYW5nZSk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGVsZW1lbnRUb3AgPSB0aGlzLnZpZXcuZWxlbWVudFRvcCh2aWV3SW5kZXgpO1xuXHRcdGNvbnN0IHZpZXdJdGVtT2Zmc2V0ID0gZWxlbWVudFRvcDtcblx0XHR0aGlzLnZpZXcuc2V0U2Nyb2xsVG9wKHZpZXdJdGVtT2Zmc2V0IC0gdGhpcy52aWV3LnJlbmRlckhlaWdodCAvIDIpO1xuXHRcdGNvbnN0IGVsZW1lbnQgPSB0aGlzLnZpZXcuZWxlbWVudCh2aWV3SW5kZXgpO1xuXG5cdFx0aWYgKCFlbGVtZW50LmVkaXRvckF0dGFjaGVkKSB7XG5cdFx0XHRyZXR1cm4gZ2V0RWRpdG9yQXR0YWNoZWRQcm9taXNlKGVsZW1lbnQpLnRoZW4oKCkgPT4gcmV2ZWFsKHZpZXdJbmRleCwgcmFuZ2UpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV2ZWFsKHZpZXdJbmRleCwgcmFuZ2UpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3JldmVhbFJhbmdlSW5DZW50ZXJJZk91dHNpZGVWaWV3cG9ydEludGVybmFsQXN5bmModmlld0luZGV4OiBudW1iZXIsIHJhbmdlOiBTZWxlY3Rpb24gfCBSYW5nZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHJldmVhbCA9ICh2aWV3SW5kZXg6IG51bWJlciwgcmFuZ2U6IFJhbmdlKSA9PiB7XG5cdFx0XHRjb25zdCBlbGVtZW50ID0gdGhpcy52aWV3LmVsZW1lbnQodmlld0luZGV4KTtcblx0XHRcdGNvbnN0IHBvc2l0aW9uT2Zmc2V0ID0gZWxlbWVudC5nZXRQb3NpdGlvblNjcm9sbFRvcE9mZnNldChyYW5nZSk7XG5cdFx0XHRjb25zdCBwb3NpdGlvbk9mZnNldEluVmlldyA9IHRoaXMudmlldy5lbGVtZW50VG9wKHZpZXdJbmRleCkgKyBwb3NpdGlvbk9mZnNldDtcblx0XHRcdHRoaXMudmlldy5zZXRTY3JvbGxUb3AocG9zaXRpb25PZmZzZXRJblZpZXcgLSB0aGlzLnZpZXcucmVuZGVySGVpZ2h0IC8gMik7XG5cblx0XHRcdGVsZW1lbnQucmV2ZWFsUmFuZ2VJbkNlbnRlcihyYW5nZSk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IHNjcm9sbFRvcCA9IHRoaXMuZ2V0Vmlld1Njcm9sbFRvcCgpO1xuXHRcdGNvbnN0IHdyYXBwZXJCb3R0b20gPSB0aGlzLmdldFZpZXdTY3JvbGxCb3R0b20oKTtcblx0XHRjb25zdCBlbGVtZW50VG9wID0gdGhpcy52aWV3LmVsZW1lbnRUb3Aodmlld0luZGV4KTtcblx0XHRjb25zdCB2aWV3SXRlbU9mZnNldCA9IGVsZW1lbnRUb3A7XG5cdFx0Y29uc3QgZWxlbWVudCA9IHRoaXMudmlldy5lbGVtZW50KHZpZXdJbmRleCk7XG5cdFx0Y29uc3QgcG9zaXRpb25PZmZzZXQgPSB2aWV3SXRlbU9mZnNldCArIGVsZW1lbnQuZ2V0UG9zaXRpb25TY3JvbGxUb3BPZmZzZXQocmFuZ2UpO1xuXG5cdFx0aWYgKHBvc2l0aW9uT2Zmc2V0IDwgc2Nyb2xsVG9wIHx8IHBvc2l0aW9uT2Zmc2V0ID4gd3JhcHBlckJvdHRvbSkge1xuXHRcdFx0Ly8gbGV0IGl0IHJlbmRlclxuXHRcdFx0dGhpcy52aWV3LnNldFNjcm9sbFRvcChwb3NpdGlvbk9mZnNldCAtIHRoaXMudmlldy5yZW5kZXJIZWlnaHQgLyAyKTtcblxuXHRcdFx0Ly8gYWZ0ZXIgcmVuZGVyaW5nLCBpdCBtaWdodCBiZSBwdXNoZWQgZG93biBkdWUgdG8gbWFya2Rvd24gY2VsbCBkeW5hbWljIGhlaWdodFxuXHRcdFx0Y29uc3QgbmV3UG9zaXRpb25PZmZzZXQgPSB0aGlzLnZpZXcuZWxlbWVudFRvcCh2aWV3SW5kZXgpICsgZWxlbWVudC5nZXRQb3NpdGlvblNjcm9sbFRvcE9mZnNldChyYW5nZSk7XG5cdFx0XHR0aGlzLnZpZXcuc2V0U2Nyb2xsVG9wKG5ld1Bvc2l0aW9uT2Zmc2V0IC0gdGhpcy52aWV3LnJlbmRlckhlaWdodCAvIDIpO1xuXG5cdFx0XHQvLyByZXZlYWwgZWRpdG9yXG5cdFx0XHRpZiAoIWVsZW1lbnQuZWRpdG9yQXR0YWNoZWQpIHtcblx0XHRcdFx0cmV0dXJuIGdldEVkaXRvckF0dGFjaGVkUHJvbWlzZShlbGVtZW50KS50aGVuKCgpID0+IHJldmVhbCh2aWV3SW5kZXgsIHJhbmdlKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBmb3IgZXhhbXBsZSBtYXJrZG93blxuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoZWxlbWVudC5lZGl0b3JBdHRhY2hlZCkge1xuXHRcdFx0XHRlbGVtZW50LnJldmVhbFJhbmdlSW5DZW50ZXIocmFuZ2UpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gZm9yIGV4YW1wbGUsIG1hcmtkb3duIGNlbGwgaW4gcHJldmlldyBtb2RlXG5cdFx0XHRcdHJldHVybiBnZXRFZGl0b3JBdHRhY2hlZFByb21pc2UoZWxlbWVudCkudGhlbigoKSA9PiByZXZlYWwodmlld0luZGV4LCByYW5nZSkpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3JldmVhbFJhbmdlQ29tbW9uKHZpZXdJbmRleDogbnVtYmVyLCByYW5nZTogU2VsZWN0aW9uIHwgUmFuZ2UsIGFsaWduSGludD86ICd0b3AnIHwgJ2JvdHRvbScgfCB1bmRlZmluZWQpIHtcblx0XHRjb25zdCBlbGVtZW50ID0gdGhpcy52aWV3LmVsZW1lbnQodmlld0luZGV4KTtcblx0XHRjb25zdCBzY3JvbGxUb3AgPSB0aGlzLmdldFZpZXdTY3JvbGxUb3AoKTtcblx0XHRjb25zdCB3cmFwcGVyQm90dG9tID0gdGhpcy5nZXRWaWV3U2Nyb2xsQm90dG9tKCk7XG5cdFx0Y29uc3QgcG9zaXRpb25PZmZzZXQgPSBlbGVtZW50LmdldFBvc2l0aW9uU2Nyb2xsVG9wT2Zmc2V0KHJhbmdlKTtcblx0XHRjb25zdCBlbGVtZW50T3JpZ2luYWxIZWlnaHQgPSB0aGlzLnZpZXcuZWxlbWVudEhlaWdodCh2aWV3SW5kZXgpO1xuXHRcdGlmIChwb3NpdGlvbk9mZnNldCA+PSBlbGVtZW50T3JpZ2luYWxIZWlnaHQpIHtcblx0XHRcdC8vIHdlIGFyZSByZXZlYWxpbmcgYSByYW5nZSB0aGF0IGlzIGJleW9uZCBjdXJyZW50IGVsZW1lbnQgaGVpZ2h0XG5cdFx0XHQvLyBpZiB3ZSBkb24ndCB1cGRhdGUgdGhlIGVsZW1lbnQgaGVpZ2h0IG5vdywgYW5kIGRpcmVjdGx5IGBzZXRUb3BgIHRvIHJldmVhbCB0aGUgcmFuZ2Vcblx0XHRcdC8vIHRoZSBlbGVtZW50IG1pZ2h0IGJlIHNjcm9sbGVkIG91dCBvZiB2aWV3XG5cdFx0XHQvLyBuZXh0IGZyYW1lLCB3aGVuIHdlIHVwZGF0ZSB0aGUgZWxlbWVudCBoZWlnaHQsIHRoZSBlbGVtZW50IHdpbGwgbmV2ZXIgYmUgc2Nyb2xsZWQgYmFjayBpbnRvIHZpZXdcblx0XHRcdGNvbnN0IG5ld1RvdGFsSGVpZ2h0ID0gZWxlbWVudC5sYXlvdXRJbmZvLnRvdGFsSGVpZ2h0O1xuXHRcdFx0dGhpcy51cGRhdGVFbGVtZW50SGVpZ2h0KHZpZXdJbmRleCwgbmV3VG90YWxIZWlnaHQpO1xuXHRcdH1cblx0XHRjb25zdCBlbGVtZW50VG9wID0gdGhpcy52aWV3LmVsZW1lbnRUb3Aodmlld0luZGV4KTtcblx0XHRjb25zdCBwb3NpdGlvblRvcCA9IGVsZW1lbnRUb3AgKyBwb3NpdGlvbk9mZnNldDtcblxuXHRcdC8vIFRPRE9AcmVib3JuaXggMzAgLS0tPiBsaW5lIGhlaWdodCAqIDEuNVxuXHRcdGlmIChwb3NpdGlvblRvcCA8IHNjcm9sbFRvcCkge1xuXHRcdFx0dGhpcy52aWV3LnNldFNjcm9sbFRvcChwb3NpdGlvblRvcCAtIDMwKTtcblx0XHR9IGVsc2UgaWYgKHBvc2l0aW9uVG9wID4gd3JhcHBlckJvdHRvbSkge1xuXHRcdFx0dGhpcy52aWV3LnNldFNjcm9sbFRvcChzY3JvbGxUb3AgKyBwb3NpdGlvblRvcCAtIHdyYXBwZXJCb3R0b20gKyAzMCk7XG5cdFx0fSBlbHNlIGlmIChhbGlnbkhpbnQgPT09ICdib3R0b20nKSB7XG5cdFx0XHQvLyBTY3JvbGxlZCBpbnRvIHZpZXcgZnJvbSBiZWxvd1xuXHRcdFx0dGhpcy52aWV3LnNldFNjcm9sbFRvcChzY3JvbGxUb3AgKyBwb3NpdGlvblRvcCAtIHdyYXBwZXJCb3R0b20gKyAzMCk7XG5cdFx0fSBlbHNlIGlmIChhbGlnbkhpbnQgPT09ICd0b3AnKSB7XG5cdFx0XHQvLyBTY3JvbGxlZCBpbnRvIHZpZXcgZnJvbSBhYm92ZVxuXHRcdFx0dGhpcy52aWV3LnNldFNjcm9sbFRvcChwb3NpdGlvblRvcCAtIDMwKTtcblx0XHR9XG5cdH1cblx0Ly8jZW5kcmVnaW9uXG5cblxuXG5cdC8qKlxuXHQgKiBSZXZlYWxzIHRoZSBzcGVjaWZpZWQgb2Zmc2V0IG9mIHRoZSBnaXZlbiBjZWxsIGluIHRoZSBjZW50ZXIgb2YgdGhlIHZpZXdwb3J0LlxuXHQgKiBUaGlzIGVuYWJsZXMgcmV2ZWFsaW5nIGxvY2F0aW9ucyBpbiB0aGUgb3V0cHV0IGFzIHdlbGwgYXMgdGhlIGlucHV0LlxuXHQgKi9cblx0cmV2ZWFsQ2VsbE9mZnNldEluQ2VudGVyKGNlbGw6IElDZWxsVmlld01vZGVsLCBvZmZzZXQ6IG51bWJlcikge1xuXHRcdGNvbnN0IHZpZXdJbmRleCA9IHRoaXMuX2dldFZpZXdJbmRleFVwcGVyQm91bmQoY2VsbCk7XG5cblx0XHRpZiAodmlld0luZGV4ID49IDApIHtcblx0XHRcdGNvbnN0IGVsZW1lbnQgPSB0aGlzLnZpZXcuZWxlbWVudCh2aWV3SW5kZXgpO1xuXHRcdFx0Y29uc3QgZWxlbWVudFRvcCA9IHRoaXMudmlldy5lbGVtZW50VG9wKHZpZXdJbmRleCk7XG5cdFx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIE1hcmt1cENlbGxWaWV3TW9kZWwpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3JldmVhbEluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQodmlld0luZGV4KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHJhbmdlT2Zmc2V0ID0gZWxlbWVudC5sYXlvdXRJbmZvLm91dHB1dENvbnRhaW5lck9mZnNldCArIE1hdGgubWluKG9mZnNldCwgZWxlbWVudC5sYXlvdXRJbmZvLm91dHB1dFRvdGFsSGVpZ2h0KTtcblx0XHRcdFx0dGhpcy52aWV3LnNldFNjcm9sbFRvcChlbGVtZW50VG9wIC0gdGhpcy52aWV3LnJlbmRlckhlaWdodCAvIDIpO1xuXHRcdFx0XHR0aGlzLnZpZXcuc2V0U2Nyb2xsVG9wKGVsZW1lbnRUb3AgKyByYW5nZU9mZnNldCAtIHRoaXMudmlldy5yZW5kZXJIZWlnaHQgLyAyKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXZlYWxPZmZzZXRJbkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0KG9mZnNldDogbnVtYmVyKSB7XG5cdFx0Y29uc3Qgc2Nyb2xsVG9wID0gdGhpcy5nZXRWaWV3U2Nyb2xsVG9wKCk7XG5cdFx0Y29uc3Qgd3JhcHBlckJvdHRvbSA9IHRoaXMuZ2V0Vmlld1Njcm9sbEJvdHRvbSgpO1xuXG5cdFx0aWYgKG9mZnNldCA8IHNjcm9sbFRvcCB8fCBvZmZzZXQgPiB3cmFwcGVyQm90dG9tKSB7XG5cdFx0XHRjb25zdCBuZXdUb3AgPSBNYXRoLm1heCgwLCBvZmZzZXQgLSB0aGlzLnZpZXcucmVuZGVySGVpZ2h0IC8gMik7XG5cdFx0XHR0aGlzLnZpZXcuc2V0U2Nyb2xsVG9wKG5ld1RvcCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmV2ZWFsSW5DZW50ZXJJZk91dHNpZGVWaWV3cG9ydCh2aWV3SW5kZXg6IG51bWJlcikge1xuXHRcdHRoaXMuX3JldmVhbEludGVybmFsKHZpZXdJbmRleCwgdHJ1ZSwgQ2VsbFJldmVhbFBvc2l0aW9uLkNlbnRlcik7XG5cdH1cblxuXHRkb21FbGVtZW50T2ZFbGVtZW50KGVsZW1lbnQ6IElDZWxsVmlld01vZGVsKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMuX2dldFZpZXdJbmRleFVwcGVyQm91bmQoZWxlbWVudCk7XG5cdFx0aWYgKGluZGV4ID49IDAgJiYgaW5kZXggPCB0aGlzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIHRoaXMudmlldy5kb21FbGVtZW50KGluZGV4KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGZvY3VzVmlldygpIHtcblx0XHR0aGlzLnZpZXcuZG9tTm9kZS5mb2N1cygpO1xuXHR9XG5cblx0dHJpZ2dlclNjcm9sbEZyb21Nb3VzZVdoZWVsRXZlbnQoYnJvd3NlckV2ZW50OiBJTW91c2VXaGVlbEV2ZW50KSB7XG5cdFx0dGhpcy52aWV3LmRlbGVnYXRlU2Nyb2xsRnJvbU1vdXNlV2hlZWxFdmVudChicm93c2VyRXZlbnQpO1xuXHR9XG5cblx0ZGVsZWdhdGVWZXJ0aWNhbFNjcm9sbGJhclBvaW50ZXJEb3duKGJyb3dzZXJFdmVudDogUG9pbnRlckV2ZW50KSB7XG5cdFx0dGhpcy52aWV3LmRlbGVnYXRlVmVydGljYWxTY3JvbGxiYXJQb2ludGVyRG93bihicm93c2VyRXZlbnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc0VsZW1lbnRBYm92ZVZpZXdwb3J0KGluZGV4OiBudW1iZXIpIHtcblx0XHRjb25zdCBlbGVtZW50VG9wID0gdGhpcy52aWV3LmVsZW1lbnRUb3AoaW5kZXgpO1xuXHRcdGNvbnN0IGVsZW1lbnRCb3R0b20gPSBlbGVtZW50VG9wICsgdGhpcy52aWV3LmVsZW1lbnRIZWlnaHQoaW5kZXgpO1xuXG5cdFx0cmV0dXJuIGVsZW1lbnRCb3R0b20gPCB0aGlzLnNjcm9sbFRvcDtcblx0fVxuXG5cdHVwZGF0ZUVsZW1lbnRIZWlnaHQyKGVsZW1lbnQ6IElDZWxsVmlld01vZGVsLCBzaXplOiBudW1iZXIsIGFuY2hvckVsZW1lbnRJbmRleDogbnVtYmVyIHwgbnVsbCA9IG51bGwpOiB2b2lkIHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMuX2dldFZpZXdJbmRleFVwcGVyQm91bmQoZWxlbWVudCk7XG5cdFx0aWYgKGluZGV4ID09PSB1bmRlZmluZWQgfHwgaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuaXNFbGVtZW50QWJvdmVWaWV3cG9ydChpbmRleCkpIHtcblx0XHRcdC8vIHVwZGF0ZSBlbGVtZW50IGFib3ZlIHZpZXdwb3J0XG5cdFx0XHRjb25zdCBvbGRIZWlnaHQgPSB0aGlzLmVsZW1lbnRIZWlnaHQoZWxlbWVudCk7XG5cdFx0XHRjb25zdCBkZWx0YSA9IG9sZEhlaWdodCAtIHNpemU7XG5cdFx0XHRpZiAodGhpcy5fd2Vidmlld0VsZW1lbnQpIHtcblx0XHRcdFx0RXZlbnQub25jZSh0aGlzLnZpZXcub25XaWxsU2Nyb2xsKSgoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3Qgd2Vidmlld1RvcCA9IHBhcnNlSW50KHRoaXMuX3dlYnZpZXdFbGVtZW50IS5kb21Ob2RlLnN0eWxlLnRvcCwgMTApO1xuXHRcdFx0XHRcdGlmICh2YWxpZGF0ZVdlYnZpZXdCb3VuZGFyeSh0aGlzLl93ZWJ2aWV3RWxlbWVudCEuZG9tTm9kZSkpIHtcblx0XHRcdFx0XHRcdHRoaXMuX3dlYnZpZXdFbGVtZW50IS5zZXRUb3Aod2Vidmlld1RvcCAtIGRlbHRhKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly8gV2hlbiB0aGUgd2VidmlldyB0b3AgYm91bmRhcnkgaXMgYmVsb3cgdGhlIGxpc3QgdmlldyBzY3JvbGxhYmxlIGVsZW1lbnQgdG9wIGJvdW5kYXJ5LCB0aGVuIHdlIGNhbid0IGluc2VydCBhIG1hcmtkb3duIGNlbGwgYXQgdGhlIHRvcFxuXHRcdFx0XHRcdFx0Ly8gb3Igd2hlbiBpdHMgYm90dG9tIGJvdW5kYXJ5IGlzIGFib3ZlIHRoZSBsaXN0IHZpZXcgYm90dG9tIGJvdW5kYXJ5LCB0aGVuIHdlIGNhbid0IGluc2VydCBhIG1hcmtkb3duIGNlbGwgYXQgdGhlIGVuZFxuXHRcdFx0XHRcdFx0Ly8gdGh1cyB3ZSBoYXZlIHRvIHJldmVydCB0aGUgd2VidmlldyBlbGVtZW50IHBvc2l0aW9uIHRvIGluaXRpYWwgc3RhdGUgYC1OT1RFQk9PS19XRUJWSUVXX0JPVU5EQVJZYC5cblx0XHRcdFx0XHRcdC8vIHRoaXMgd2lsbCB0cmlnZ2VyIG9uZSB2aXN1YWwgZmxpY2tlciAoYXMgd2UgbmVlZCB0byB1cGRhdGUgZWxlbWVudCBvZmZzZXRzIGluIHRoZSB3ZWJ2aWV3KVxuXHRcdFx0XHRcdFx0Ly8gYnV0IGFzIGxvbmcgYXMgTk9URUJPT0tfV0VCVklFV19CT1VOREFSWSBpcyBsYXJnZSBlbm91Z2gsIGl0IHdpbGwgaGFwcGVuIGxlc3Mgb2Z0ZW5cblx0XHRcdFx0XHRcdHRoaXMuX3dlYnZpZXdFbGVtZW50IS5zZXRUb3AoLU5PVEVCT09LX1dFQlZJRVdfQk9VTkRBUlkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnZpZXcudXBkYXRlRWxlbWVudEhlaWdodChpbmRleCwgc2l6ZSwgYW5jaG9yRWxlbWVudEluZGV4KTtcblx0XHRcdHRoaXMudmlld1pvbmVzLmxheW91dCgpO1xuXHRcdFx0dGhpcy5jZWxsT3ZlcmxheXMubGF5b3V0KCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGFuY2hvckVsZW1lbnRJbmRleCAhPT0gbnVsbCkge1xuXHRcdFx0dGhpcy52aWV3LnVwZGF0ZUVsZW1lbnRIZWlnaHQoaW5kZXgsIHNpemUsIGFuY2hvckVsZW1lbnRJbmRleCk7XG5cdFx0XHR0aGlzLnZpZXdab25lcy5sYXlvdXQoKTtcblx0XHRcdHRoaXMuY2VsbE92ZXJsYXlzLmxheW91dCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZvY3VzZWQgPSB0aGlzLmdldEZvY3VzKCk7XG5cdFx0Y29uc3QgZm9jdXMgPSBmb2N1c2VkLmxlbmd0aCA/IGZvY3VzZWRbMF0gOiBudWxsO1xuXG5cdFx0aWYgKGZvY3VzKSB7XG5cdFx0XHQvLyBJZiB0aGUgY2VsbCBpcyBncm93aW5nLCB3ZSBzaG91bGQgZmF2b3IgYW5jaG9yaW5nIHRvIHRoZSBmb2N1c2VkIGNlbGxcblx0XHRcdGNvbnN0IGhlaWdodERlbHRhID0gc2l6ZSAtIHRoaXMudmlldy5lbGVtZW50SGVpZ2h0KGluZGV4KTtcblxuXHRcdFx0aWYgKHRoaXMuX25vdGVib29rQ2VsbEFuY2hvci5zaG91bGRBbmNob3IodGhpcy52aWV3LCBmb2N1cywgaGVpZ2h0RGVsdGEsIHRoaXMuZWxlbWVudChpbmRleCkpKSB7XG5cdFx0XHRcdHRoaXMudmlldy51cGRhdGVFbGVtZW50SGVpZ2h0KGluZGV4LCBzaXplLCBmb2N1cyk7XG5cdFx0XHRcdHRoaXMudmlld1pvbmVzLmxheW91dCgpO1xuXHRcdFx0XHR0aGlzLmNlbGxPdmVybGF5cy5sYXlvdXQoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMudmlldy51cGRhdGVFbGVtZW50SGVpZ2h0KGluZGV4LCBzaXplLCBudWxsKTtcblx0XHR0aGlzLnZpZXdab25lcy5sYXlvdXQoKTtcblx0XHR0aGlzLmNlbGxPdmVybGF5cy5sYXlvdXQoKTtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRjaGFuZ2VWaWV3Wm9uZXMoY2FsbGJhY2s6IChhY2Nlc3NvcjogSU5vdGVib29rVmlld1pvbmVDaGFuZ2VBY2Nlc3NvcikgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnZpZXdab25lcy5jaGFuZ2VWaWV3Wm9uZXMoY2FsbGJhY2spKSB7XG5cdFx0XHR0aGlzLnZpZXdab25lcy5sYXlvdXQoKTtcblx0XHR9XG5cdH1cblxuXHRjaGFuZ2VDZWxsT3ZlcmxheXMoY2FsbGJhY2s6IChhY2Nlc3NvcjogSU5vdGVib29rQ2VsbE92ZXJsYXlDaGFuZ2VBY2Nlc3NvcikgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmNlbGxPdmVybGF5cy5jaGFuZ2VDZWxsT3ZlcmxheXMoY2FsbGJhY2spKSB7XG5cdFx0XHR0aGlzLmNlbGxPdmVybGF5cy5sYXlvdXQoKTtcblx0XHR9XG5cdH1cblxuXHRnZXRWaWV3Wm9uZUxheW91dEluZm8odmlld1pvbmVJZDogc3RyaW5nKTogeyBoZWlnaHQ6IG51bWJlcjsgdG9wOiBudW1iZXIgfSB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLnZpZXdab25lcy5nZXRWaWV3Wm9uZUxheW91dEluZm8odmlld1pvbmVJZCk7XG5cdH1cblxuXHQvLyBvdmVycmlkZVxuXHRvdmVycmlkZSBkb21Gb2N1cygpIHtcblx0XHRjb25zdCBmb2N1c2VkID0gdGhpcy5nZXRGb2N1c2VkRWxlbWVudHMoKVswXTtcblx0XHRjb25zdCBmb2N1c2VkRG9tRWxlbWVudCA9IGZvY3VzZWQgJiYgdGhpcy5kb21FbGVtZW50T2ZFbGVtZW50KGZvY3VzZWQpO1xuXG5cdFx0aWYgKHRoaXMudmlldy5kb21Ob2RlLm93bmVyRG9jdW1lbnQuYWN0aXZlRWxlbWVudCAmJiBmb2N1c2VkRG9tRWxlbWVudCAmJiBmb2N1c2VkRG9tRWxlbWVudC5jb250YWlucyh0aGlzLnZpZXcuZG9tTm9kZS5vd25lckRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpKSB7XG5cdFx0XHQvLyBmb3IgZXhhbXBsZSwgd2hlbiBmb2N1cyBnb2VzIGludG8gbW9uYWNvIGVkaXRvciwgaWYgd2UgcmVmb2N1cyB0aGUgbGlzdCB2aWV3LCB0aGUgZWRpdG9yIHdpbGwgbG9zZSBmb2N1cy5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIWlzTWFjaW50b3NoICYmIHRoaXMudmlldy5kb21Ob2RlLm93bmVyRG9jdW1lbnQuYWN0aXZlRWxlbWVudCAmJiAhIURPTS5maW5kUGFyZW50V2l0aENsYXNzKDxIVE1MRWxlbWVudD50aGlzLnZpZXcuZG9tTm9kZS5vd25lckRvY3VtZW50LmFjdGl2ZUVsZW1lbnQsICdjb250ZXh0LXZpZXcnKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHN1cGVyLmRvbUZvY3VzKCk7XG5cdH1cblxuXHRmb2N1c0NvbnRhaW5lcihjbGVhclNlbGVjdGlvbjogYm9vbGVhbikge1xuXHRcdGlmIChjbGVhclNlbGVjdGlvbikge1xuXHRcdFx0Ly8gYWxsb3cgZm9jdXMgdG8gYmUgYmV0d2VlbiBjZWxsc1xuXHRcdFx0dGhpcy5fdmlld01vZGVsPy51cGRhdGVTZWxlY3Rpb25zU3RhdGUoe1xuXHRcdFx0XHRraW5kOiBTZWxlY3Rpb25TdGF0ZVR5cGUuSGFuZGxlLFxuXHRcdFx0XHRwcmltYXJ5OiBudWxsLFxuXHRcdFx0XHRzZWxlY3Rpb25zOiBbXVxuXHRcdFx0fSwgJ3ZpZXcnKTtcblx0XHRcdHRoaXMuc2V0Rm9jdXMoW10sIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHR0aGlzLnNldFNlbGVjdGlvbihbXSwgdW5kZWZpbmVkLCB0cnVlKTtcblx0XHR9XG5cblx0XHRzdXBlci5kb21Gb2N1cygpO1xuXHR9XG5cblx0Z2V0Vmlld1Njcm9sbFRvcCgpIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3LmdldFNjcm9sbFRvcCgpO1xuXHR9XG5cblx0Z2V0Vmlld1Njcm9sbEJvdHRvbSgpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRWaWV3U2Nyb2xsVG9wKCkgKyB0aGlzLnZpZXcucmVuZGVySGVpZ2h0O1xuXHR9XG5cblx0c2V0Q2VsbEVkaXRvclNlbGVjdGlvbihjZWxsOiBJQ2VsbFZpZXdNb2RlbCwgcmFuZ2U6IFJhbmdlKSB7XG5cdFx0Y29uc3QgZWxlbWVudCA9IGNlbGwgYXMgQ2VsbFZpZXdNb2RlbDtcblx0XHRpZiAoZWxlbWVudC5lZGl0b3JBdHRhY2hlZCkge1xuXHRcdFx0ZWxlbWVudC5zZXRTZWxlY3Rpb24ocmFuZ2UpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRnZXRFZGl0b3JBdHRhY2hlZFByb21pc2UoZWxlbWVudCkudGhlbigoKSA9PiB7IGVsZW1lbnQuc2V0U2VsZWN0aW9uKHJhbmdlKTsgfSk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgc3R5bGUoc3R5bGVzOiBJTGlzdFN0eWxlcykge1xuXHRcdGNvbnN0IHNlbGVjdG9yU3VmZml4ID0gdGhpcy52aWV3LmRvbUlkO1xuXHRcdGlmICghdGhpcy5zdHlsZUVsZW1lbnQpIHtcblx0XHRcdHRoaXMuc3R5bGVFbGVtZW50ID0gZG9tU3R5bGVzaGVldHNKcy5jcmVhdGVTdHlsZVNoZWV0KHRoaXMudmlldy5kb21Ob2RlKTtcblx0XHR9XG5cdFx0Y29uc3Qgc3VmZml4ID0gc2VsZWN0b3JTdWZmaXggJiYgYC4ke3NlbGVjdG9yU3VmZml4fWA7XG5cdFx0Y29uc3QgY29udGVudDogc3RyaW5nW10gPSBbXTtcblxuXHRcdGlmIChzdHlsZXMubGlzdEJhY2tncm91bmQpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1saXN0JHtzdWZmaXh9ID4gZGl2Lm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgPiAubW9uYWNvLWxpc3Qtcm93cyB7IGJhY2tncm91bmQ6ICR7c3R5bGVzLmxpc3RCYWNrZ3JvdW5kfTsgfWApO1xuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMubGlzdEZvY3VzQmFja2dyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH06Zm9jdXMgPiBkaXYubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdy5mb2N1c2VkIHsgYmFja2dyb3VuZC1jb2xvcjogJHtzdHlsZXMubGlzdEZvY3VzQmFja2dyb3VuZH07IH1gKTtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1saXN0JHtzdWZmaXh9OmZvY3VzID4gZGl2Lm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgPiAubW9uYWNvLWxpc3Qtcm93cyA+IC5tb25hY28tbGlzdC1yb3cuZm9jdXNlZDpob3ZlciB7IGJhY2tncm91bmQtY29sb3I6ICR7c3R5bGVzLmxpc3RGb2N1c0JhY2tncm91bmR9OyB9YCk7IC8vIG92ZXJ3cml0ZSA6aG92ZXIgc3R5bGUgaW4gdGhpcyBjYXNlIVxuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMubGlzdEZvY3VzRm9yZWdyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH06Zm9jdXMgPiBkaXYubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdy5mb2N1c2VkIHsgY29sb3I6ICR7c3R5bGVzLmxpc3RGb2N1c0ZvcmVncm91bmR9OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5saXN0QWN0aXZlU2VsZWN0aW9uQmFja2dyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH06Zm9jdXMgPiBkaXYubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdy5zZWxlY3RlZCB7IGJhY2tncm91bmQtY29sb3I6ICR7c3R5bGVzLmxpc3RBY3RpdmVTZWxlY3Rpb25CYWNrZ3JvdW5kfTsgfWApO1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH06Zm9jdXMgPiBkaXYubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdy5zZWxlY3RlZDpob3ZlciB7IGJhY2tncm91bmQtY29sb3I6ICR7c3R5bGVzLmxpc3RBY3RpdmVTZWxlY3Rpb25CYWNrZ3JvdW5kfTsgfWApOyAvLyBvdmVyd3JpdGUgOmhvdmVyIHN0eWxlIGluIHRoaXMgY2FzZSFcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLmxpc3RBY3RpdmVTZWxlY3Rpb25Gb3JlZ3JvdW5kKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdCR7c3VmZml4fTpmb2N1cyA+IGRpdi5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50ID4gLm1vbmFjby1saXN0LXJvd3MgPiAubW9uYWNvLWxpc3Qtcm93LnNlbGVjdGVkIHsgY29sb3I6ICR7c3R5bGVzLmxpc3RBY3RpdmVTZWxlY3Rpb25Gb3JlZ3JvdW5kfTsgfWApO1xuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMubGlzdEZvY3VzQW5kU2VsZWN0aW9uQmFja2dyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGBcblx0XHRcdFx0Lm1vbmFjby1kcmFnLWltYWdlJHtzdWZmaXh9LFxuXHRcdFx0XHQubW9uYWNvLWxpc3Qke3N1ZmZpeH06Zm9jdXMgPiBkaXYubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdy5zZWxlY3RlZC5mb2N1c2VkIHsgYmFja2dyb3VuZC1jb2xvcjogJHtzdHlsZXMubGlzdEZvY3VzQW5kU2VsZWN0aW9uQmFja2dyb3VuZH07IH1cblx0XHRcdGApO1xuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMubGlzdEZvY3VzQW5kU2VsZWN0aW9uRm9yZWdyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGBcblx0XHRcdFx0Lm1vbmFjby1kcmFnLWltYWdlJHtzdWZmaXh9LFxuXHRcdFx0XHQubW9uYWNvLWxpc3Qke3N1ZmZpeH06Zm9jdXMgPiBkaXYubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdy5zZWxlY3RlZC5mb2N1c2VkIHsgY29sb3I6ICR7c3R5bGVzLmxpc3RGb2N1c0FuZFNlbGVjdGlvbkZvcmVncm91bmR9OyB9XG5cdFx0XHRgKTtcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLmxpc3RJbmFjdGl2ZUZvY3VzQmFja2dyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH0gPiBkaXYubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdy5mb2N1c2VkIHsgYmFja2dyb3VuZC1jb2xvcjogICR7c3R5bGVzLmxpc3RJbmFjdGl2ZUZvY3VzQmFja2dyb3VuZH07IH1gKTtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1saXN0JHtzdWZmaXh9ID4gZGl2Lm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgPiAubW9uYWNvLWxpc3Qtcm93cyA+IC5tb25hY28tbGlzdC1yb3cuZm9jdXNlZDpob3ZlciB7IGJhY2tncm91bmQtY29sb3I6ICAke3N0eWxlcy5saXN0SW5hY3RpdmVGb2N1c0JhY2tncm91bmR9OyB9YCk7IC8vIG92ZXJ3cml0ZSA6aG92ZXIgc3R5bGUgaW4gdGhpcyBjYXNlIVxuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMubGlzdEluYWN0aXZlU2VsZWN0aW9uQmFja2dyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH0gPiBkaXYubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdy5zZWxlY3RlZCB7IGJhY2tncm91bmQtY29sb3I6ICAke3N0eWxlcy5saXN0SW5hY3RpdmVTZWxlY3Rpb25CYWNrZ3JvdW5kfTsgfWApO1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH0gPiBkaXYubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdy5zZWxlY3RlZDpob3ZlciB7IGJhY2tncm91bmQtY29sb3I6ICAke3N0eWxlcy5saXN0SW5hY3RpdmVTZWxlY3Rpb25CYWNrZ3JvdW5kfTsgfWApOyAvLyBvdmVyd3JpdGUgOmhvdmVyIHN0eWxlIGluIHRoaXMgY2FzZSFcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLmxpc3RJbmFjdGl2ZVNlbGVjdGlvbkZvcmVncm91bmQpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1saXN0JHtzdWZmaXh9ID4gZGl2Lm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgPiAubW9uYWNvLWxpc3Qtcm93cyA+IC5tb25hY28tbGlzdC1yb3cuc2VsZWN0ZWQgeyBjb2xvcjogJHtzdHlsZXMubGlzdEluYWN0aXZlU2VsZWN0aW9uRm9yZWdyb3VuZH07IH1gKTtcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLmxpc3RIb3ZlckJhY2tncm91bmQpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1saXN0JHtzdWZmaXh9Om5vdCguZHJvcC10YXJnZXQpID4gZGl2Lm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgPiAubW9uYWNvLWxpc3Qtcm93cyA+IC5tb25hY28tbGlzdC1yb3c6aG92ZXI6bm90KC5zZWxlY3RlZCk6bm90KC5mb2N1c2VkKSB7IGJhY2tncm91bmQtY29sb3I6ICAke3N0eWxlcy5saXN0SG92ZXJCYWNrZ3JvdW5kfTsgfWApO1xuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMubGlzdEhvdmVyRm9yZWdyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH0gPiBkaXYubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5tb25hY28tbGlzdC1yb3dzID4gLm1vbmFjby1saXN0LXJvdzpob3Zlcjpub3QoLnNlbGVjdGVkKTpub3QoLmZvY3VzZWQpIHsgY29sb3I6ICAke3N0eWxlcy5saXN0SG92ZXJGb3JlZ3JvdW5kfTsgfWApO1xuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMubGlzdFNlbGVjdGlvbk91dGxpbmUpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1saXN0JHtzdWZmaXh9ID4gZGl2Lm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgPiAubW9uYWNvLWxpc3Qtcm93cyA+IC5tb25hY28tbGlzdC1yb3cuc2VsZWN0ZWQgeyBvdXRsaW5lOiAxcHggZG90dGVkICR7c3R5bGVzLmxpc3RTZWxlY3Rpb25PdXRsaW5lfTsgb3V0bGluZS1vZmZzZXQ6IC0xcHg7IH1gKTtcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLmxpc3RGb2N1c091dGxpbmUpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgXG5cdFx0XHRcdC5tb25hY28tZHJhZy1pbWFnZSR7c3VmZml4fSxcblx0XHRcdFx0Lm1vbmFjby1saXN0JHtzdWZmaXh9OmZvY3VzID4gZGl2Lm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgPiAubW9uYWNvLWxpc3Qtcm93cyA+IC5tb25hY28tbGlzdC1yb3cuZm9jdXNlZCB7IG91dGxpbmU6IDFweCBzb2xpZCAke3N0eWxlcy5saXN0Rm9jdXNPdXRsaW5lfTsgb3V0bGluZS1vZmZzZXQ6IC0xcHg7IH1cblx0XHRcdGApO1xuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMubGlzdEluYWN0aXZlRm9jdXNPdXRsaW5lKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdCR7c3VmZml4fSA+IGRpdi5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50ID4gLm1vbmFjby1saXN0LXJvd3MgPiAubW9uYWNvLWxpc3Qtcm93LmZvY3VzZWQgeyBvdXRsaW5lOiAxcHggZG90dGVkICR7c3R5bGVzLmxpc3RJbmFjdGl2ZUZvY3VzT3V0bGluZX07IG91dGxpbmUtb2Zmc2V0OiAtMXB4OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5saXN0SG92ZXJPdXRsaW5lKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdCR7c3VmZml4fSA+IGRpdi5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50ID4gLm1vbmFjby1saXN0LXJvd3MgPiAubW9uYWNvLWxpc3Qtcm93OmhvdmVyIHsgb3V0bGluZTogMXB4IGRhc2hlZCAke3N0eWxlcy5saXN0SG92ZXJPdXRsaW5lfTsgb3V0bGluZS1vZmZzZXQ6IC0xcHg7IH1gKTtcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLmxpc3REcm9wT3ZlckJhY2tncm91bmQpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgXG5cdFx0XHRcdC5tb25hY28tbGlzdCR7c3VmZml4fS5kcm9wLXRhcmdldCxcblx0XHRcdFx0Lm1vbmFjby1saXN0JHtzdWZmaXh9ID4gZGl2Lm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgPiAubW9uYWNvLWxpc3Qtcm93cy5kcm9wLXRhcmdldCxcblx0XHRcdFx0Lm1vbmFjby1saXN0JHtzdWZmaXh9ID4gZGl2Lm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgPiAubW9uYWNvLWxpc3Qtcm93LmRyb3AtdGFyZ2V0IHsgYmFja2dyb3VuZC1jb2xvcjogJHtzdHlsZXMubGlzdERyb3BPdmVyQmFja2dyb3VuZH0gIWltcG9ydGFudDsgY29sb3I6IGluaGVyaXQgIWltcG9ydGFudDsgfVxuXHRcdFx0YCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmV3U3R5bGVzID0gY29udGVudC5qb2luKCdcXG4nKTtcblx0XHRpZiAobmV3U3R5bGVzICE9PSB0aGlzLnN0eWxlRWxlbWVudC50ZXh0Q29udGVudCkge1xuXHRcdFx0dGhpcy5zdHlsZUVsZW1lbnQudGV4dENvbnRlbnQgPSBuZXdTdHlsZXM7XG5cdFx0fVxuXHR9XG5cblx0Z2V0UmVuZGVySGVpZ2h0KCkge1xuXHRcdHJldHVybiB0aGlzLnZpZXcucmVuZGVySGVpZ2h0O1xuXHR9XG5cblx0Z2V0U2Nyb2xsSGVpZ2h0KCkge1xuXHRcdHJldHVybiB0aGlzLnZpZXcuc2Nyb2xsSGVpZ2h0O1xuXHR9XG5cblx0b3ZlcnJpZGUgbGF5b3V0KGhlaWdodD86IG51bWJlciwgd2lkdGg/OiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9pc0luTGF5b3V0ID0gdHJ1ZTtcblx0XHRzdXBlci5sYXlvdXQoaGVpZ2h0LCB3aWR0aCk7XG5cdFx0aWYgKHRoaXMucmVuZGVySGVpZ2h0ID09PSAwKSB7XG5cdFx0XHR0aGlzLnZpZXcuZG9tTm9kZS5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudmlldy5kb21Ob2RlLnN0eWxlLnZpc2liaWxpdHkgPSAnaW5pdGlhbCc7XG5cdFx0fVxuXHRcdHRoaXMuX2lzSW5MYXlvdXQgPSBmYWxzZTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0dGhpcy5faXNEaXNwb3NlZCA9IHRydWU7XG5cdFx0dGhpcy5fdmlld01vZGVsU3RvcmUuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2xvY2FsRGlzcG9zYWJsZVN0b3JlLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9ub3RlYm9va0NlbGxBbmNob3IuZGlzcG9zZSgpO1xuXHRcdHRoaXMudmlld1pvbmVzLmRpc3Bvc2UoKTtcblx0XHR0aGlzLmNlbGxPdmVybGF5cy5kaXNwb3NlKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXG5cdFx0Ly8gdW4tcmVmXG5cdFx0dGhpcy5fcHJldmlvdXNGb2N1c2VkRWxlbWVudHMgPSBbXTtcblx0XHR0aGlzLl92aWV3TW9kZWwgPSBudWxsO1xuXHRcdHRoaXMuX2hpZGRlblJhbmdlSWRzID0gW107XG5cdFx0dGhpcy5oaWRkZW5SYW5nZXNQcmVmaXhTdW0gPSBudWxsO1xuXHRcdHRoaXMuX3Zpc2libGVSYW5nZXMgPSBbXTtcblx0fVxufVxuXG5cbmV4cG9ydCBjbGFzcyBMaXN0Vmlld0luZm9BY2Nlc3NvciBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBsaXN0OiBJTm90ZWJvb2tDZWxsTGlzdFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0Z2V0Vmlld0luZGV4KGNlbGw6IElDZWxsVmlld01vZGVsKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5saXN0LmdldFZpZXdJbmRleChjZWxsKSA/PyAtMTtcblx0fVxuXG5cdGdldFZpZXdIZWlnaHQoY2VsbDogSUNlbGxWaWV3TW9kZWwpOiBudW1iZXIge1xuXHRcdGlmICghdGhpcy5saXN0LnZpZXdNb2RlbCkge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmxpc3QuZWxlbWVudEhlaWdodChjZWxsKTtcblx0fVxuXG5cdGdldENlbGxSYW5nZUZyb21WaWV3UmFuZ2Uoc3RhcnRJbmRleDogbnVtYmVyLCBlbmRJbmRleDogbnVtYmVyKTogSUNlbGxSYW5nZSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCF0aGlzLmxpc3Qudmlld01vZGVsKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGVsSW5kZXggPSB0aGlzLmxpc3QuZ2V0TW9kZWxJbmRleDIoc3RhcnRJbmRleCk7XG5cdFx0aWYgKG1vZGVsSW5kZXggPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBzdGFydEluZGV4ICR7c3RhcnRJbmRleH0gb3V0IG9mIGJvdW5kYXJ5YCk7XG5cdFx0fVxuXG5cdFx0aWYgKGVuZEluZGV4ID49IHRoaXMubGlzdC5sZW5ndGgpIHtcblx0XHRcdC8vIGl0J3MgdGhlIGVuZFxuXHRcdFx0Y29uc3QgZW5kTW9kZWxJbmRleCA9IHRoaXMubGlzdC52aWV3TW9kZWwubGVuZ3RoO1xuXHRcdFx0cmV0dXJuIHsgc3RhcnQ6IG1vZGVsSW5kZXgsIGVuZDogZW5kTW9kZWxJbmRleCB9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBlbmRNb2RlbEluZGV4ID0gdGhpcy5saXN0LmdldE1vZGVsSW5kZXgyKGVuZEluZGV4KTtcblx0XHRcdGlmIChlbmRNb2RlbEluZGV4ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBlbmRJbmRleCAke2VuZEluZGV4fSBvdXQgb2YgYm91bmRhcnlgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB7IHN0YXJ0OiBtb2RlbEluZGV4LCBlbmQ6IGVuZE1vZGVsSW5kZXggfTtcblx0XHR9XG5cdH1cblxuXHRnZXRDZWxsc0Zyb21WaWV3UmFuZ2Uoc3RhcnRJbmRleDogbnVtYmVyLCBlbmRJbmRleDogbnVtYmVyKTogUmVhZG9ubHlBcnJheTxJQ2VsbFZpZXdNb2RlbD4ge1xuXHRcdGlmICghdGhpcy5saXN0LnZpZXdNb2RlbCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJhbmdlID0gdGhpcy5nZXRDZWxsUmFuZ2VGcm9tVmlld1JhbmdlKHN0YXJ0SW5kZXgsIGVuZEluZGV4KTtcblx0XHRpZiAoIXJhbmdlKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMubGlzdC52aWV3TW9kZWwuZ2V0Q2VsbHNJblJhbmdlKHJhbmdlKTtcblx0fVxuXG5cdGdldENlbGxzSW5SYW5nZShyYW5nZT86IElDZWxsUmFuZ2UpOiBSZWFkb25seUFycmF5PElDZWxsVmlld01vZGVsPiB7XG5cdFx0cmV0dXJuIHRoaXMubGlzdC52aWV3TW9kZWw/LmdldENlbGxzSW5SYW5nZShyYW5nZSkgPz8gW107XG5cdH1cblxuXHRnZXRWaXNpYmxlUmFuZ2VzUGx1c1ZpZXdwb3J0QWJvdmVBbmRCZWxvdygpOiBJQ2VsbFJhbmdlW10ge1xuXHRcdHJldHVybiB0aGlzLmxpc3Q/LmdldFZpc2libGVSYW5nZXNQbHVzVmlld3BvcnRBYm92ZUFuZEJlbG93KCkgPz8gW107XG5cdH1cbn1cblxuZnVuY3Rpb24gZ2V0RWRpdG9yQXR0YWNoZWRQcm9taXNlKGVsZW1lbnQ6IElDZWxsVmlld01vZGVsKSB7XG5cdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0RXZlbnQub25jZShlbGVtZW50Lm9uRGlkQ2hhbmdlRWRpdG9yQXR0YWNoU3RhdGUpKCgpID0+IGVsZW1lbnQuZWRpdG9yQXR0YWNoZWQgPyByZXNvbHZlKCkgOiByZWplY3QoKSk7XG5cdH0pO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsWUFBWSxzQkFBc0I7QUFFbEMsU0FBOEMsaUJBQWlCO0FBRS9ELFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsWUFBWSxpQkFBOEIseUJBQXlCO0FBQzVFLFNBQVMsbUJBQW1CO0FBSTVCLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsNkJBQTZCO0FBRXRDLFNBQVMsY0FBcUMscUJBQXFCO0FBQ25FLFNBQVMsa0JBQWtDLGVBQXFDLGdCQUFnQixxQkFBcUIsNEJBQWlHO0FBRXROLFNBQVMsTUFBTSxpQ0FBaUMsVUFBVSxvQkFBb0IsNENBQTRDO0FBQzFILFNBQXFCLHFCQUFxQixrQkFBa0IsdUJBQXVCO0FBQ25GLFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsYUFBYTtBQUd0QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDZCQUE2QjtBQUV0QyxTQUFTLDRCQUE0QjtBQUVyQyxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDRCQUE0QjtBQUVyQyxJQUFXLHFCQUFYLGtCQUFXQSx3QkFBWDtBQUNDLEVBQUFBLHdDQUFBO0FBQ0EsRUFBQUEsd0NBQUE7QUFDQSxFQUFBQSx3Q0FBQTtBQUNBLEVBQUFBLHdDQUFBO0FBSlUsU0FBQUE7QUFBQSxHQUFBO0FB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MEIsWUFBb0IsVUFBMEM7QUFDdkYsUUFBSSxDQUFDLEtBQUssS0FBSyxXQUFXO0FBQ3pCLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxhQUFhLEtBQUssS0FBSyxlQUFlLFVBQVU7QUFDdEQsUUFBSSxlQUFlLFFBQVc7QUFDN0IsWUFBTSxJQUFJLE1BQU0sY0FBYyxVQUFVLGtCQUFrQjtBQUFBLElBQzNEO0FBRUEsUUFBSSxZQUFZLEtBQUssS0FBSyxRQUFRO0FBRWpDLFlBQU0sZ0JBQWdCLEtBQUssS0FBSyxVQUFVO0FBQzFDLGFBQU8sRUFBRSxPQUFPLFlBQVksS0FBSyxjQUFjO0FBQUEsSUFDaEQsT0FBTztBQUNOLFlBQU0sZ0JBQWdCLEtBQUssS0FBSyxlQUFlLFFBQVE7QUFDdkQsVUFBSSxrQkFBa0IsUUFBVztBQUNoQyxjQUFNLElBQUksTUFBTSxZQUFZLFFBQVEsa0JBQWtCO0FBQUEsTUFDdkQ7QUFDQSxhQUFPLEVBQUUsT0FBTyxZQUFZLEtBQUssY0FBYztBQUFBLElBQ2hEO0FBQUEsRUFDRDtBQUFBLEVBRUEsc0JBQXNCLFlBQW9CLFVBQWlEO0FBQzFGLFFBQUksQ0FBQyxLQUFLLEtBQUssV0FBVztBQUN6QixhQUFPLENBQUM7QUFBQSxJQUNUO0FBRUEsVUFBTSxRQUFRLEtBQUssMEJBQTBCLFlBQVksUUFBUTtBQUNqRSxRQUFJLENBQUMsT0FBTztBQUNYLGFBQU8sQ0FBQztBQUFBLElBQ1Q7QUFFQSxXQUFPLEtBQUssS0FBSyxVQUFVLGdCQUFnQixLQUFLO0FBQUEsRUFDakQ7QUFBQSxFQUVBLGdCQUFnQixPQUFtRDtBQUNsRSxXQUFPLEtBQUssS0FBSyxXQUFXLGdCQUFnQixLQUFLLEtBQUssQ0FBQztBQUFBLEVBQ3hEO0FBQUEsRUFFQSw0Q0FBMEQ7QUFDekQsV0FBTyxLQUFLLE1BQU0sMENBQTBDLEtBQUssQ0FBQztBQUFBLEVBQ25FO0FBQ0Q7QUFFQSxTQUFTLHlCQUF5QixTQUF5QjtBQUMxRCxTQUFPLElBQUksUUFBYyxDQUFDLFNBQVMsV0FBVztBQUM3QyxVQUFNLEtBQUssUUFBUSw0QkFBNEIsRUFBRSxNQUFNLFFBQVEsaUJBQWlCLFFBQVEsSUFBSSxPQUFPLENBQUM7QUFBQSxFQUNyRyxDQUFDO0FBQ0Y7IiwKICAibmFtZXMiOiBbIkNlbGxSZXZlYWxQb3NpdGlvbiIsICJlIiwgImRpZmYiLCAidmlld0luZGV4IiwgInJhbmdlIiwgImVsZW1lbnQiLCAicG9zaXRpb25PZmZzZXQiXQp9Cg==
