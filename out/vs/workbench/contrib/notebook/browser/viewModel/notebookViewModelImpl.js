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
import { groupBy } from "../../../../../base/common/collections.js";
import { onUnexpectedError } from "../../../../../base/common/errors.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { clamp } from "../../../../../base/common/numbers.js";
import * as strings from "../../../../../base/common/strings.js";
import { IBulkEditService, ResourceTextEdit } from "../../../../../editor/browser/services/bulkEditService.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { TrackedRangeStickiness } from "../../../../../editor/common/model.js";
import { MultiModelEditStackElement, SingleModelEditStackElement } from "../../../../../editor/common/model/editStack.js";
import { IntervalNode, IntervalTree } from "../../../../../editor/common/model/intervalTree.js";
import { ModelDecorationOptions } from "../../../../../editor/common/model/textModel.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IUndoRedoService } from "../../../../../platform/undoRedo/common/undoRedo.js";
import { CellFindMatchModel } from "../contrib/find/findModel.js";
import { CellEditState, CellFoldingState, isNotebookCellDecoration } from "../notebookBrowser.js";
import { NotebookMetadataChangedEvent } from "../notebookViewEvents.js";
import { NotebookCellSelectionCollection } from "./cellSelectionCollection.js";
import { CodeCellViewModel } from "./codeCellViewModel.js";
import { MarkupCellViewModel } from "./markupCellViewModel.js";
import { CellKind, NotebookCellsChangeType, NotebookFindScopeType, SelectionStateType } from "../../common/notebookCommon.js";
import { INotebookExecutionStateService, NotebookExecutionType } from "../../common/notebookExecutionStateService.js";
import { cellIndexesToRanges, cellRangesToIndexes, reduceCellRanges } from "../../common/notebookRange.js";
const invalidFunc = () => {
  throw new Error(`Invalid change accessor`);
};
class DecorationsTree {
  constructor() {
    this._decorationsTree = new IntervalTree();
  }
  intervalSearch(start, end, filterOwnerId, filterOutValidation, cachedVersionId, onlyMarginDecorations = false) {
    const r1 = this._decorationsTree.intervalSearch(start, end, filterOwnerId, filterOutValidation, cachedVersionId, onlyMarginDecorations);
    return r1;
  }
  search(filterOwnerId, filterOutValidation, overviewRulerOnly, cachedVersionId, onlyMarginDecorations) {
    return this._decorationsTree.search(filterOwnerId, filterOutValidation, cachedVersionId, onlyMarginDecorations);
  }
  collectNodesFromOwner(ownerId) {
    const r1 = this._decorationsTree.collectNodesFromOwner(ownerId);
    return r1;
  }
  collectNodesPostOrder() {
    const r1 = this._decorationsTree.collectNodesPostOrder();
    return r1;
  }
  insert(node) {
    this._decorationsTree.insert(node);
  }
  delete(node) {
    this._decorationsTree.delete(node);
  }
  resolveNode(node, cachedVersionId) {
    this._decorationsTree.resolveNode(node, cachedVersionId);
  }
  acceptReplace(offset, length, textLength, forceMoveMarkers) {
    this._decorationsTree.acceptReplace(offset, length, textLength, forceMoveMarkers);
  }
}
const TRACKED_RANGE_OPTIONS = [
  ModelDecorationOptions.register({ description: "notebook-view-model-tracked-range-always-grows-when-typing-at-edges", stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges }),
  ModelDecorationOptions.register({ description: "notebook-view-model-tracked-range-never-grows-when-typing-at-edges", stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges }),
  ModelDecorationOptions.register({ description: "notebook-view-model-tracked-range-grows-only-when-typing-before", stickiness: TrackedRangeStickiness.GrowsOnlyWhenTypingBefore }),
  ModelDecorationOptions.register({ description: "notebook-view-model-tracked-range-grows-only-when-typing-after", stickiness: TrackedRangeStickiness.GrowsOnlyWhenTypingAfter })
];
function _normalizeOptions(options) {
  if (options instanceof ModelDecorationOptions) {
    return options;
  }
  return ModelDecorationOptions.createDynamic(options);
}
let MODEL_ID = 0;
let NotebookViewModel = class extends Disposable {
  constructor(viewType, _notebook, _viewContext, _layoutInfo, _options, _instantiationService, _bulkEditService, _undoService, _textModelService, notebookExecutionStateService) {
    super();
    this.viewType = viewType;
    this._notebook = _notebook;
    this._viewContext = _viewContext;
    this._layoutInfo = _layoutInfo;
    this._options = _options;
    this._instantiationService = _instantiationService;
    this._bulkEditService = _bulkEditService;
    this._undoService = _undoService;
    this._textModelService = _textModelService;
    this.notebookExecutionStateService = notebookExecutionStateService;
    this._localStore = this._register(new DisposableStore());
    this._handleToViewCellMapping = /* @__PURE__ */ new Map();
    this._onDidChangeOptions = this._register(new Emitter());
    this._viewCells = [];
    this._onDidChangeViewCells = this._register(new Emitter());
    this._lastNotebookEditResource = [];
    this._onDidChangeSelection = this._register(new Emitter());
    this._selectionCollection = this._register(new NotebookCellSelectionCollection());
    this._decorationsTree = new DecorationsTree();
    this._decorations = /* @__PURE__ */ Object.create(null);
    this._lastDecorationId = 0;
    this._foldingRanges = null;
    this._onDidFoldingStateChanged = new Emitter();
    this.onDidFoldingStateChanged = this._onDidFoldingStateChanged.event;
    this._hiddenRanges = [];
    this._focused = true;
    this._decorationIdToCellMap = /* @__PURE__ */ new Map();
    this._statusBarItemIdToCellMap = /* @__PURE__ */ new Map();
    this._lastOverviewRulerDecorationId = 0;
    this._overviewRulerDecorations = /* @__PURE__ */ new Map();
    MODEL_ID++;
    this.id = "$notebookViewModel" + MODEL_ID;
    this._instanceId = strings.singleLetterHash(MODEL_ID);
    const compute = (changes, synchronous) => {
      const diffs = changes.map((splice) => {
        return [splice[0], splice[1], splice[2].map((cell) => {
          return createCellViewModel(this._instantiationService, this, cell, this._viewContext);
        })];
      });
      diffs.reverse().forEach((diff) => {
        const deletedCells = this._viewCells.splice(diff[0], diff[1], ...diff[2]);
        this._decorationsTree.acceptReplace(diff[0], diff[1], diff[2].length, true);
        deletedCells.forEach((cell) => {
          this._handleToViewCellMapping.delete(cell.handle);
          cell.dispose();
        });
        diff[2].forEach((cell) => {
          this._handleToViewCellMapping.set(cell.handle, cell);
          this._localStore.add(cell);
        });
      });
      const selectionHandles = this.selectionHandles;
      this._onDidChangeViewCells.fire({
        synchronous,
        splices: diffs
      });
      let endSelectionHandles = [];
      if (selectionHandles.length) {
        const primaryHandle = selectionHandles[0];
        const primarySelectionIndex = this._viewCells.indexOf(this.getCellByHandle(primaryHandle));
        endSelectionHandles = [primaryHandle];
        let delta = 0;
        for (let i = 0; i < diffs.length; i++) {
          const diff = diffs[0];
          if (diff[0] + diff[1] <= primarySelectionIndex) {
            delta += diff[2].length - diff[1];
            continue;
          }
          if (diff[0] > primarySelectionIndex) {
            endSelectionHandles = [primaryHandle];
            break;
          }
          if (diff[0] + diff[1] > primarySelectionIndex) {
            endSelectionHandles = [this._viewCells[diff[0] + delta].handle];
            break;
          }
        }
      }
      const selectionIndexes = endSelectionHandles.map((handle) => this._viewCells.findIndex((cell) => cell.handle === handle));
      this._selectionCollection.setState(cellIndexesToRanges([selectionIndexes[0]])[0], cellIndexesToRanges(selectionIndexes), true, "model");
    };
    this._register(this._notebook.onDidChangeContent((e) => {
      for (let i = 0; i < e.rawEvents.length; i++) {
        const change = e.rawEvents[i];
        let changes = [];
        const synchronous = e.synchronous ?? true;
        if (change.kind === NotebookCellsChangeType.ModelChange || change.kind === NotebookCellsChangeType.Initialize) {
          changes = change.changes;
          compute(changes, synchronous);
          continue;
        } else if (change.kind === NotebookCellsChangeType.Move) {
          compute([[change.index, change.length, []]], synchronous);
          compute([[change.newIdx, 0, change.cells]], synchronous);
        } else {
          continue;
        }
      }
    }));
    this._register(this._notebook.onDidChangeContent((contentChanges) => {
      contentChanges.rawEvents.forEach((e) => {
        if (e.kind === NotebookCellsChangeType.ChangeDocumentMetadata) {
          this._viewContext.eventDispatcher.emit([new NotebookMetadataChangedEvent(this._notebook.metadata)]);
        }
      });
      if (contentChanges.endSelectionState) {
        this.updateSelectionsState(contentChanges.endSelectionState);
      }
    }));
    this._register(this._viewContext.eventDispatcher.onDidChangeLayout((e) => {
      this._layoutInfo = e.value;
      this._viewCells.forEach((cell) => {
        if (cell.cellKind === CellKind.Markup) {
          if (e.source.width || e.source.fontInfo) {
            cell.layoutChange({ outerWidth: e.value.width, font: e.value.fontInfo });
          }
        } else {
          if (e.source.width !== void 0) {
            cell.layoutChange({ outerWidth: e.value.width, font: e.value.fontInfo });
          }
        }
      });
    }));
    this._register(this._viewContext.notebookOptions.onDidChangeOptions((e) => {
      for (let i = 0; i < this.length; i++) {
        const cell = this._viewCells[i];
        cell.updateOptions(e);
      }
    }));
    this._register(notebookExecutionStateService.onDidChangeExecution((e) => {
      if (e.type !== NotebookExecutionType.cell) {
        return;
      }
      const cell = this.getCellByHandle(e.cellHandle);
      if (cell instanceof CodeCellViewModel) {
        cell.updateExecutionState(e);
      }
    }));
    this._register(this._selectionCollection.onDidChangeSelection((e) => {
      this._onDidChangeSelection.fire(e);
    }));
    const viewCellCount = this.isRepl ? this._notebook.cells.length - 1 : this._notebook.cells.length;
    for (let i = 0; i < viewCellCount; i++) {
      this._viewCells.push(createCellViewModel(this._instantiationService, this, this._notebook.cells[i], this._viewContext));
    }
    this._viewCells.forEach((cell) => {
      this._handleToViewCellMapping.set(cell.handle, cell);
    });
  }
  get options() {
    return this._options;
  }
  get onDidChangeOptions() {
    return this._onDidChangeOptions.event;
  }
  get viewCells() {
    return this._viewCells;
  }
  get length() {
    return this._viewCells.length;
  }
  get notebookDocument() {
    return this._notebook;
  }
  get uri() {
    return this._notebook.uri;
  }
  get metadata() {
    return this._notebook.metadata;
  }
  get isRepl() {
    return this.viewType === "repl";
  }
  get onDidChangeViewCells() {
    return this._onDidChangeViewCells.event;
  }
  get lastNotebookEditResource() {
    if (this._lastNotebookEditResource.length) {
      return this._lastNotebookEditResource[this._lastNotebookEditResource.length - 1];
    }
    return null;
  }
  get layoutInfo() {
    return this._layoutInfo;
  }
  get onDidChangeSelection() {
    return this._onDidChangeSelection.event;
  }
  get selectionHandles() {
    const handlesSet = /* @__PURE__ */ new Set();
    const handles = [];
    cellRangesToIndexes(this._selectionCollection.selections).map((index) => index < this.length ? this.cellAt(index) : void 0).forEach((cell) => {
      if (cell && !handlesSet.has(cell.handle)) {
        handles.push(cell.handle);
      }
    });
    return handles;
  }
  set selectionHandles(selectionHandles) {
    const indexes = selectionHandles.map((handle) => this._viewCells.findIndex((cell) => cell.handle === handle));
    this._selectionCollection.setSelections(cellIndexesToRanges(indexes), true, "model");
  }
  get focused() {
    return this._focused;
  }
  updateOptions(newOptions) {
    this._options = { ...this._options, ...newOptions };
    this._viewCells.forEach((cell) => cell.updateOptions({ readonly: this._options.isReadOnly }));
    this._onDidChangeOptions.fire();
  }
  getFocus() {
    return this._selectionCollection.focus;
  }
  getSelections() {
    return this._selectionCollection.selections;
  }
  getMostRecentlyExecutedCell() {
    const handle = this.notebookExecutionStateService.getLastCompletedCellForNotebook(this._notebook.uri);
    return handle !== void 0 ? this.getCellByHandle(handle) : void 0;
  }
  setEditorFocus(focused) {
    this._focused = focused;
  }
  validateRange(cellRange) {
    if (!cellRange) {
      return null;
    }
    const start = clamp(cellRange.start, 0, this.length);
    const end = clamp(cellRange.end, 0, this.length);
    if (start <= end) {
      return { start, end };
    } else {
      return { start: end, end: start };
    }
  }
  // selection change from list view's `setFocus` and `setSelection` should always use `source: view` to prevent events breaking the list view focus/selection change transaction
  updateSelectionsState(state, source = "model") {
    if (this._focused || source === "model") {
      if (state.kind === SelectionStateType.Handle) {
        const primaryIndex = state.primary !== null ? this.getCellIndexByHandle(state.primary) : null;
        const primarySelection = primaryIndex !== null ? this.validateRange({ start: primaryIndex, end: primaryIndex + 1 }) : null;
        const selections = cellIndexesToRanges(state.selections.map((sel) => this.getCellIndexByHandle(sel))).map((range) => this.validateRange(range)).filter((range) => range !== null);
        this._selectionCollection.setState(primarySelection, reduceCellRanges(selections), true, source);
      } else {
        const primarySelection = this.validateRange(state.focus);
        const selections = state.selections.map((range) => this.validateRange(range)).filter((range) => range !== null);
        this._selectionCollection.setState(primarySelection, reduceCellRanges(selections), true, source);
      }
    }
  }
  getFoldingStartIndex(index) {
    if (!this._foldingRanges) {
      return -1;
    }
    const range = this._foldingRanges.findRange(index + 1);
    const startIndex = this._foldingRanges.getStartLineNumber(range) - 1;
    return startIndex;
  }
  getFoldingState(index) {
    if (!this._foldingRanges) {
      return CellFoldingState.None;
    }
    const range = this._foldingRanges.findRange(index + 1);
    const startIndex = this._foldingRanges.getStartLineNumber(range) - 1;
    if (startIndex !== index) {
      return CellFoldingState.None;
    }
    return this._foldingRanges.isCollapsed(range) ? CellFoldingState.Collapsed : CellFoldingState.Expanded;
  }
  getFoldedLength(index) {
    if (!this._foldingRanges) {
      return 0;
    }
    const range = this._foldingRanges.findRange(index + 1);
    const startIndex = this._foldingRanges.getStartLineNumber(range) - 1;
    const endIndex = this._foldingRanges.getEndLineNumber(range) - 1;
    return endIndex - startIndex;
  }
  updateFoldingRanges(ranges) {
    this._foldingRanges = ranges;
    let updateHiddenAreas = false;
    const newHiddenAreas = [];
    let i = 0;
    let k = 0;
    let lastCollapsedStart = Number.MAX_VALUE;
    let lastCollapsedEnd = -1;
    for (; i < ranges.length; i++) {
      if (!ranges.isCollapsed(i)) {
        continue;
      }
      const startLineNumber = ranges.getStartLineNumber(i) + 1;
      const endLineNumber = ranges.getEndLineNumber(i);
      if (lastCollapsedStart <= startLineNumber && endLineNumber <= lastCollapsedEnd) {
        continue;
      }
      if (!updateHiddenAreas && k < this._hiddenRanges.length && this._hiddenRanges[k].start + 1 === startLineNumber && this._hiddenRanges[k].end + 1 === endLineNumber) {
        newHiddenAreas.push(this._hiddenRanges[k]);
        k++;
      } else {
        updateHiddenAreas = true;
        newHiddenAreas.push({ start: startLineNumber - 1, end: endLineNumber - 1 });
      }
      lastCollapsedStart = startLineNumber;
      lastCollapsedEnd = endLineNumber;
    }
    if (updateHiddenAreas || k < this._hiddenRanges.length) {
      this._hiddenRanges = newHiddenAreas;
      this._onDidFoldingStateChanged.fire();
    }
    this._viewCells.forEach((cell) => {
      if (cell.cellKind === CellKind.Markup) {
        cell.triggerFoldingStateChange();
      }
    });
  }
  getHiddenRanges() {
    return this._hiddenRanges;
  }
  getOverviewRulerDecorations() {
    return Array.from(this._overviewRulerDecorations.values());
  }
  getCellByHandle(handle) {
    return this._handleToViewCellMapping.get(handle);
  }
  getCellIndexByHandle(handle) {
    return this._viewCells.findIndex((cell) => cell.handle === handle);
  }
  getCellIndex(cell) {
    return this._viewCells.indexOf(cell);
  }
  cellAt(index) {
    return this._viewCells[index];
  }
  getCellsInRange(range) {
    if (!range) {
      return this._viewCells.slice(0);
    }
    const validatedRange = this.validateRange(range);
    if (validatedRange) {
      const result = [];
      for (let i = validatedRange.start; i < validatedRange.end; i++) {
        result.push(this._viewCells[i]);
      }
      return result;
    }
    return [];
  }
  /**
   * If this._viewCells[index] is visible then return index
   */
  getNearestVisibleCellIndexUpwards(index) {
    for (let i = this._hiddenRanges.length - 1; i >= 0; i--) {
      const cellRange = this._hiddenRanges[i];
      const foldStart = cellRange.start - 1;
      const foldEnd = cellRange.end;
      if (foldStart > index) {
        continue;
      }
      if (foldStart <= index && foldEnd >= index) {
        return index;
      }
      break;
    }
    return index;
  }
  getNextVisibleCellIndex(index) {
    for (let i = 0; i < this._hiddenRanges.length; i++) {
      const cellRange = this._hiddenRanges[i];
      const foldStart = cellRange.start - 1;
      const foldEnd = cellRange.end;
      if (foldEnd < index) {
        continue;
      }
      if (foldStart <= index) {
        return foldEnd + 1;
      }
      break;
    }
    return index + 1;
  }
  getPreviousVisibleCellIndex(index) {
    for (let i = this._hiddenRanges.length - 1; i >= 0; i--) {
      const cellRange = this._hiddenRanges[i];
      const foldStart = cellRange.start - 1;
      const foldEnd = cellRange.end;
      if (foldEnd < index) {
        return index;
      }
      if (foldStart <= index) {
        return foldStart;
      }
    }
    return index;
  }
  hasCell(cell) {
    return this._handleToViewCellMapping.has(cell.handle);
  }
  getVersionId() {
    return this._notebook.versionId;
  }
  getAlternativeId() {
    return this._notebook.alternativeVersionId;
  }
  getTrackedRange(id) {
    return this._getDecorationRange(id);
  }
  _getDecorationRange(decorationId) {
    const node = this._decorations[decorationId];
    if (!node) {
      return null;
    }
    const versionId = this.getVersionId();
    if (node.cachedVersionId !== versionId) {
      this._decorationsTree.resolveNode(node, versionId);
    }
    if (node.range === null) {
      return { start: node.cachedAbsoluteStart - 1, end: node.cachedAbsoluteEnd - 1 };
    }
    return { start: node.range.startLineNumber - 1, end: node.range.endLineNumber - 1 };
  }
  setTrackedRange(id, newRange, newStickiness) {
    const node = id ? this._decorations[id] : null;
    if (!node) {
      if (!newRange) {
        return null;
      }
      return this._deltaCellDecorationsImpl(0, [], [{ range: new Range(newRange.start + 1, 1, newRange.end + 1, 1), options: TRACKED_RANGE_OPTIONS[newStickiness] }])[0];
    }
    if (!newRange) {
      this._decorationsTree.delete(node);
      delete this._decorations[node.id];
      return null;
    }
    this._decorationsTree.delete(node);
    node.reset(this.getVersionId(), newRange.start, newRange.end + 1, new Range(newRange.start + 1, 1, newRange.end + 1, 1));
    node.setOptions(TRACKED_RANGE_OPTIONS[newStickiness]);
    this._decorationsTree.insert(node);
    return node.id;
  }
  _deltaCellDecorationsImpl(ownerId, oldDecorationsIds, newDecorations) {
    const versionId = this.getVersionId();
    const oldDecorationsLen = oldDecorationsIds.length;
    let oldDecorationIndex = 0;
    const newDecorationsLen = newDecorations.length;
    let newDecorationIndex = 0;
    const result = new Array(newDecorationsLen);
    while (oldDecorationIndex < oldDecorationsLen || newDecorationIndex < newDecorationsLen) {
      let node = null;
      if (oldDecorationIndex < oldDecorationsLen) {
        do {
          node = this._decorations[oldDecorationsIds[oldDecorationIndex++]];
        } while (!node && oldDecorationIndex < oldDecorationsLen);
        if (node) {
          this._decorationsTree.delete(node);
        }
      }
      if (newDecorationIndex < newDecorationsLen) {
        if (!node) {
          const internalDecorationId = ++this._lastDecorationId;
          const decorationId = `${this._instanceId};${internalDecorationId}`;
          node = new IntervalNode(decorationId, 0, 0);
          this._decorations[decorationId] = node;
        }
        const newDecoration = newDecorations[newDecorationIndex];
        const range = newDecoration.range;
        const options = _normalizeOptions(newDecoration.options);
        node.ownerId = ownerId;
        node.reset(versionId, range.startLineNumber, range.endLineNumber, Range.lift(range));
        node.setOptions(options);
        this._decorationsTree.insert(node);
        result[newDecorationIndex] = node.id;
        newDecorationIndex++;
      } else {
        if (node) {
          delete this._decorations[node.id];
        }
      }
    }
    return result;
  }
  deltaCellDecorations(oldDecorations, newDecorations) {
    oldDecorations.forEach((id) => {
      const handle = this._decorationIdToCellMap.get(id);
      if (handle !== void 0) {
        const cell = this.getCellByHandle(handle);
        cell?.deltaCellDecorations([id], []);
        this._decorationIdToCellMap.delete(id);
      }
      if (this._overviewRulerDecorations.has(id)) {
        this._overviewRulerDecorations.delete(id);
      }
    });
    const result = [];
    newDecorations.forEach((decoration) => {
      if (isNotebookCellDecoration(decoration)) {
        const cell = this.getCellByHandle(decoration.handle);
        const ret = cell?.deltaCellDecorations([], [decoration.options]) || [];
        ret.forEach((id) => {
          this._decorationIdToCellMap.set(id, decoration.handle);
        });
        result.push(...ret);
      } else {
        const id = ++this._lastOverviewRulerDecorationId;
        const decorationId = `_overview_${this.id};${id}`;
        this._overviewRulerDecorations.set(decorationId, decoration);
        result.push(decorationId);
      }
    });
    return result;
  }
  deltaCellStatusBarItems(oldItems, newItems) {
    const deletesByHandle = groupBy(oldItems, (id) => this._statusBarItemIdToCellMap.get(id) ?? -1);
    const result = [];
    newItems.forEach((itemDelta) => {
      const cell = this.getCellByHandle(itemDelta.handle);
      const deleted = deletesByHandle[itemDelta.handle] ?? [];
      delete deletesByHandle[itemDelta.handle];
      deleted.forEach((id) => this._statusBarItemIdToCellMap.delete(id));
      const ret = cell?.deltaCellStatusBarItems(deleted, itemDelta.items) || [];
      ret.forEach((id) => {
        this._statusBarItemIdToCellMap.set(id, itemDelta.handle);
      });
      result.push(...ret);
    });
    for (const _handle in deletesByHandle) {
      const handle = parseInt(_handle);
      const ids = deletesByHandle[handle];
      const cell = this.getCellByHandle(handle);
      cell?.deltaCellStatusBarItems(ids, []);
      ids.forEach((id) => this._statusBarItemIdToCellMap.delete(id));
    }
    return result;
  }
  nearestCodeCellIndex(index) {
    const nearest = this.viewCells.slice(0, index).reverse().findIndex((cell) => cell.cellKind === CellKind.Code);
    if (nearest > -1) {
      return index - nearest - 1;
    } else {
      const nearestCellTheOtherDirection = this.viewCells.slice(index + 1).findIndex((cell) => cell.cellKind === CellKind.Code);
      if (nearestCellTheOtherDirection > -1) {
        return index + 1 + nearestCellTheOtherDirection;
      }
      return -1;
    }
  }
  getEditorViewState() {
    const editingCells = {};
    const collapsedInputCells = {};
    const collapsedOutputCells = {};
    const cellLineNumberStates = {};
    this._viewCells.forEach((cell, i) => {
      if (cell.getEditState() === CellEditState.Editing) {
        editingCells[i] = true;
      }
      if (cell.isInputCollapsed) {
        collapsedInputCells[i] = true;
      }
      if (cell instanceof CodeCellViewModel && cell.isOutputCollapsed) {
        collapsedOutputCells[i] = true;
      }
      if (cell.lineNumbers !== "inherit") {
        cellLineNumberStates[i] = cell.lineNumbers;
      }
    });
    const editorViewStates = {};
    this._viewCells.map((cell) => ({ handle: cell.model.handle, state: cell.saveEditorViewState() })).forEach((viewState, i) => {
      if (viewState.state) {
        editorViewStates[i] = viewState.state;
      }
    });
    return {
      editingCells,
      editorViewStates,
      cellLineNumberStates,
      collapsedInputCells,
      collapsedOutputCells
    };
  }
  restoreEditorViewState(viewState) {
    if (!viewState) {
      return;
    }
    this._viewCells.forEach((cell, index) => {
      const isEditing = viewState.editingCells && viewState.editingCells[index];
      const editorViewState = viewState.editorViewStates && viewState.editorViewStates[index];
      cell.updateEditState(isEditing ? CellEditState.Editing : CellEditState.Preview, "viewState");
      const cellHeight = viewState.cellTotalHeights ? viewState.cellTotalHeights[index] : void 0;
      cell.restoreEditorViewState(editorViewState, cellHeight);
      if (viewState.collapsedInputCells && viewState.collapsedInputCells[index]) {
        cell.isInputCollapsed = true;
      }
      if (viewState.collapsedOutputCells && viewState.collapsedOutputCells[index] && cell instanceof CodeCellViewModel) {
        cell.isOutputCollapsed = true;
      }
      if (viewState.cellLineNumberStates && viewState.cellLineNumberStates[index]) {
        cell.lineNumbers = viewState.cellLineNumberStates[index];
      }
    });
  }
  /**
   * Editor decorations across cells. For example, find decorations for multiple code cells
   * The reason that we can't completely delegate this to CodeEditorWidget is most of the time, the editors for cells are not created yet but we already have decorations for them.
   */
  changeModelDecorations(callback) {
    const changeAccessor = {
      deltaDecorations: (oldDecorations, newDecorations) => {
        return this._deltaModelDecorationsImpl(oldDecorations, newDecorations);
      }
    };
    let result = null;
    try {
      result = callback(changeAccessor);
    } catch (e) {
      onUnexpectedError(e);
    }
    changeAccessor.deltaDecorations = invalidFunc;
    return result;
  }
  _deltaModelDecorationsImpl(oldDecorations, newDecorations) {
    const mapping = /* @__PURE__ */ new Map();
    oldDecorations.forEach((oldDecoration) => {
      const ownerId = oldDecoration.ownerId;
      if (!mapping.has(ownerId)) {
        const cell = this._viewCells.find((cell2) => cell2.handle === ownerId);
        if (cell) {
          mapping.set(ownerId, { cell, oldDecorations: [], newDecorations: [] });
        }
      }
      const data = mapping.get(ownerId);
      if (data) {
        data.oldDecorations = oldDecoration.decorations;
      }
    });
    newDecorations.forEach((newDecoration) => {
      const ownerId = newDecoration.ownerId;
      if (!mapping.has(ownerId)) {
        const cell = this._viewCells.find((cell2) => cell2.handle === ownerId);
        if (cell) {
          mapping.set(ownerId, { cell, oldDecorations: [], newDecorations: [] });
        }
      }
      const data = mapping.get(ownerId);
      if (data) {
        data.newDecorations = newDecoration.decorations;
      }
    });
    const ret = [];
    mapping.forEach((value, ownerId) => {
      const cellRet = value.cell.deltaModelDecorations(value.oldDecorations, value.newDecorations);
      ret.push({
        ownerId,
        decorations: cellRet
      });
    });
    return ret;
  }
  //#region Find
  find(value, options) {
    const matches = [];
    let findCells = [];
    if (options.findScope && (options.findScope.findScopeType === NotebookFindScopeType.Cells || options.findScope.findScopeType === NotebookFindScopeType.Text)) {
      const selectedRanges = options.findScope.selectedCellRanges?.map((range) => this.validateRange(range)).filter((range) => !!range) ?? [];
      const selectedIndexes = cellRangesToIndexes(selectedRanges);
      findCells = selectedIndexes.map((index) => this._viewCells[index]);
    } else {
      findCells = this._viewCells;
    }
    findCells.forEach((cell, index) => {
      const cellMatches = cell.startFind(value, options);
      if (cellMatches) {
        matches.push(new CellFindMatchModel(
          cellMatches.cell,
          index,
          cellMatches.contentMatches,
          []
        ));
      }
    });
    return matches.filter(
      (match) => {
        if (match.cell.cellKind === CellKind.Code) {
          return options.includeCodeInput;
        }
        if (match.cell.getEditState() === CellEditState.Editing) {
          return options.includeMarkupInput;
        } else {
          return !options.includeMarkupPreview && options.includeMarkupInput;
        }
      }
    );
  }
  replaceOne(cell, range, text) {
    const viewCell = cell;
    this._lastNotebookEditResource.push(viewCell.uri);
    return viewCell.resolveTextModel().then(() => {
      this._bulkEditService.apply(
        [new ResourceTextEdit(cell.uri, { range, text })],
        { quotableLabel: "Notebook Replace" }
      );
    });
  }
  async replaceAll(matches, texts) {
    if (!matches.length) {
      return;
    }
    const textEdits = [];
    this._lastNotebookEditResource.push(matches[0].cell.uri);
    matches.forEach((match) => {
      match.contentMatches.forEach((singleMatch, index) => {
        textEdits.push({
          versionId: void 0,
          textEdit: { range: singleMatch.range, text: texts[index] },
          resource: match.cell.uri
        });
      });
    });
    return Promise.all(matches.map((match) => {
      return match.cell.resolveTextModel();
    })).then(async () => {
      this._bulkEditService.apply({ edits: textEdits }, { quotableLabel: "Notebook Replace All" });
      return;
    });
  }
  //#endregion
  //#region Undo/Redo
  async _withElement(element, callback) {
    const viewCells = this._viewCells.filter((cell) => element.matchesResource(cell.uri));
    const refs = await Promise.all(viewCells.map((cell) => this._textModelService.createModelReference(cell.uri)));
    await callback();
    refs.forEach((ref) => ref.dispose());
  }
  async undo() {
    const editStack = this._undoService.getElements(this.uri);
    const element = editStack.past.length ? editStack.past[editStack.past.length - 1] : void 0;
    if (element && element instanceof SingleModelEditStackElement || element instanceof MultiModelEditStackElement) {
      await this._withElement(element, async () => {
        await this._undoService.undo(this.uri);
      });
      return element instanceof SingleModelEditStackElement ? [element.resource] : element.resources;
    }
    await this._undoService.undo(this.uri);
    return [];
  }
  async redo() {
    const editStack = this._undoService.getElements(this.uri);
    const element = editStack.future[0];
    if (element && element instanceof SingleModelEditStackElement || element instanceof MultiModelEditStackElement) {
      await this._withElement(element, async () => {
        await this._undoService.redo(this.uri);
      });
      return element instanceof SingleModelEditStackElement ? [element.resource] : element.resources;
    }
    await this._undoService.redo(this.uri);
    return [];
  }
  //#endregion
  equal(notebook) {
    return this._notebook === notebook;
  }
  dispose() {
    this._localStore.clear();
    this._viewCells.forEach((cell) => {
      cell.dispose();
    });
    super.dispose();
  }
};
NotebookViewModel = __decorateClass([
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IBulkEditService),
  __decorateParam(7, IUndoRedoService),
  __decorateParam(8, ITextModelService),
  __decorateParam(9, INotebookExecutionStateService)
], NotebookViewModel);
function createCellViewModel(instantiationService, notebookViewModel, cell, viewContext) {
  if (cell.cellKind === CellKind.Code) {
    return instantiationService.createInstance(CodeCellViewModel, notebookViewModel.viewType, cell, notebookViewModel.layoutInfo, viewContext);
  } else {
    return instantiationService.createInstance(MarkupCellViewModel, notebookViewModel.viewType, cell, notebookViewModel.layoutInfo, notebookViewModel, viewContext);
  }
}
export {
  NotebookViewModel,
  createCellViewModel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXdNb2RlbC9ub3RlYm9va1ZpZXdNb2RlbEltcGwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBncm91cEJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29sbGVjdGlvbnMuanMnO1xuaW1wb3J0IHsgb25VbmV4cGVjdGVkRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgY2xhbXAgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9udW1iZXJzLmpzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUJ1bGtFZGl0U2VydmljZSwgUmVzb3VyY2VUZXh0RWRpdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2J1bGtFZGl0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgKiBhcyBlZGl0b3JDb21tb24gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZVRleHRFZGl0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgRmluZE1hdGNoLCBJTW9kZWxEZWNvcmF0aW9uT3B0aW9ucywgSU1vZGVsRGVsdGFEZWNvcmF0aW9uLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBNdWx0aU1vZGVsRWRpdFN0YWNrRWxlbWVudCwgU2luZ2xlTW9kZWxFZGl0U3RhY2tFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC9lZGl0U3RhY2suanMnO1xuaW1wb3J0IHsgSW50ZXJ2YWxOb2RlLCBJbnRlcnZhbFRyZWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsL2ludGVydmFsVHJlZS5qcyc7XG5pbXBvcnQgeyBNb2RlbERlY29yYXRpb25PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBGb2xkaW5nUmVnaW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2ZvbGRpbmcvYnJvd3Nlci9mb2xkaW5nUmFuZ2VzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSVVuZG9SZWRvU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuZG9SZWRvL2NvbW1vbi91bmRvUmVkby5qcyc7XG5pbXBvcnQgeyBDZWxsRmluZE1hdGNoTW9kZWwgfSBmcm9tICcuLi9jb250cmliL2ZpbmQvZmluZE1vZGVsLmpzJztcbmltcG9ydCB7IENlbGxFZGl0U3RhdGUsIENlbGxGaW5kTWF0Y2hXaXRoSW5kZXgsIENlbGxGb2xkaW5nU3RhdGUsIEVkaXRvckZvbGRpbmdTdGF0ZURlbGVnYXRlLCBJQ2VsbE1vZGVsRGVjb3JhdGlvbnMsIElDZWxsTW9kZWxEZWx0YURlY29yYXRpb25zLCBJQ2VsbFZpZXdNb2RlbCwgSU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VBY2Nlc3NvciwgSU5vdGVib29rRGVsdGFDZWxsU3RhdHVzQmFySXRlbXMsIElOb3RlYm9va0VkaXRvclZpZXdTdGF0ZSwgSU5vdGVib29rVmlld0NlbGxzVXBkYXRlRXZlbnQsIElOb3RlYm9va1ZpZXdNb2RlbCwgSU5vdGVib29rRGVsdGFEZWNvcmF0aW9uLCBpc05vdGVib29rQ2VsbERlY29yYXRpb24sIElOb3RlYm9va0RlbHRhVmlld1pvbmVEZWNvcmF0aW9uIH0gZnJvbSAnLi4vbm90ZWJvb2tCcm93c2VyLmpzJztcbmltcG9ydCB7IE5vdGVib29rTGF5b3V0SW5mbywgTm90ZWJvb2tNZXRhZGF0YUNoYW5nZWRFdmVudCB9IGZyb20gJy4uL25vdGVib29rVmlld0V2ZW50cy5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0NlbGxTZWxlY3Rpb25Db2xsZWN0aW9uIH0gZnJvbSAnLi9jZWxsU2VsZWN0aW9uQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBDb2RlQ2VsbFZpZXdNb2RlbCB9IGZyb20gJy4vY29kZUNlbGxWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgTWFya3VwQ2VsbFZpZXdNb2RlbCB9IGZyb20gJy4vbWFya3VwQ2VsbFZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBWaWV3Q29udGV4dCB9IGZyb20gJy4vdmlld0NvbnRleHQuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tDZWxsVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL21vZGVsL25vdGVib29rQ2VsbFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va1RleHRNb2RlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi9tb2RlbC9ub3RlYm9va1RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBDZWxsS2luZCwgSUNlbGwsIElOb3RlYm9va0ZpbmRPcHRpb25zLCBJU2VsZWN0aW9uU3RhdGUsIE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLCBOb3RlYm9va0NlbGxUZXh0TW9kZWxTcGxpY2UsIE5vdGVib29rRmluZFNjb3BlVHlwZSwgU2VsZWN0aW9uU3RhdGVUeXBlIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSwgTm90ZWJvb2tFeGVjdXRpb25UeXBlIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGNlbGxJbmRleGVzVG9SYW5nZXMsIGNlbGxSYW5nZXNUb0luZGV4ZXMsIElDZWxsUmFuZ2UsIHJlZHVjZUNlbGxSYW5nZXMgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tSYW5nZS5qcyc7XG5cbmNvbnN0IGludmFsaWRGdW5jID0gKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgY2hhbmdlIGFjY2Vzc29yYCk7IH07XG5cbmNsYXNzIERlY29yYXRpb25zVHJlZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlY29yYXRpb25zVHJlZTogSW50ZXJ2YWxUcmVlO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMuX2RlY29yYXRpb25zVHJlZSA9IG5ldyBJbnRlcnZhbFRyZWUoKTtcblx0fVxuXG5cdHB1YmxpYyBpbnRlcnZhbFNlYXJjaChzdGFydDogbnVtYmVyLCBlbmQ6IG51bWJlciwgZmlsdGVyT3duZXJJZDogbnVtYmVyLCBmaWx0ZXJPdXRWYWxpZGF0aW9uOiBib29sZWFuLCBjYWNoZWRWZXJzaW9uSWQ6IG51bWJlciwgb25seU1hcmdpbkRlY29yYXRpb25zOiBib29sZWFuID0gZmFsc2UpOiBJbnRlcnZhbE5vZGVbXSB7XG5cdFx0Y29uc3QgcjEgPSB0aGlzLl9kZWNvcmF0aW9uc1RyZWUuaW50ZXJ2YWxTZWFyY2goc3RhcnQsIGVuZCwgZmlsdGVyT3duZXJJZCwgZmlsdGVyT3V0VmFsaWRhdGlvbiwgY2FjaGVkVmVyc2lvbklkLCBvbmx5TWFyZ2luRGVjb3JhdGlvbnMpO1xuXHRcdHJldHVybiByMTtcblx0fVxuXG5cdHB1YmxpYyBzZWFyY2goZmlsdGVyT3duZXJJZDogbnVtYmVyLCBmaWx0ZXJPdXRWYWxpZGF0aW9uOiBib29sZWFuLCBvdmVydmlld1J1bGVyT25seTogYm9vbGVhbiwgY2FjaGVkVmVyc2lvbklkOiBudW1iZXIsIG9ubHlNYXJnaW5EZWNvcmF0aW9uczogYm9vbGVhbik6IEludGVydmFsTm9kZVtdIHtcblx0XHRyZXR1cm4gdGhpcy5fZGVjb3JhdGlvbnNUcmVlLnNlYXJjaChmaWx0ZXJPd25lcklkLCBmaWx0ZXJPdXRWYWxpZGF0aW9uLCBjYWNoZWRWZXJzaW9uSWQsIG9ubHlNYXJnaW5EZWNvcmF0aW9ucyk7XG5cblx0fVxuXG5cdHB1YmxpYyBjb2xsZWN0Tm9kZXNGcm9tT3duZXIob3duZXJJZDogbnVtYmVyKTogSW50ZXJ2YWxOb2RlW10ge1xuXHRcdGNvbnN0IHIxID0gdGhpcy5fZGVjb3JhdGlvbnNUcmVlLmNvbGxlY3ROb2Rlc0Zyb21Pd25lcihvd25lcklkKTtcblx0XHRyZXR1cm4gcjE7XG5cdH1cblxuXHRwdWJsaWMgY29sbGVjdE5vZGVzUG9zdE9yZGVyKCk6IEludGVydmFsTm9kZVtdIHtcblx0XHRjb25zdCByMSA9IHRoaXMuX2RlY29yYXRpb25zVHJlZS5jb2xsZWN0Tm9kZXNQb3N0T3JkZXIoKTtcblx0XHRyZXR1cm4gcjE7XG5cdH1cblxuXHRwdWJsaWMgaW5zZXJ0KG5vZGU6IEludGVydmFsTm9kZSk6IHZvaWQge1xuXHRcdHRoaXMuX2RlY29yYXRpb25zVHJlZS5pbnNlcnQobm9kZSk7XG5cdH1cblxuXHRwdWJsaWMgZGVsZXRlKG5vZGU6IEludGVydmFsTm9kZSk6IHZvaWQge1xuXHRcdHRoaXMuX2RlY29yYXRpb25zVHJlZS5kZWxldGUobm9kZSk7XG5cdH1cblxuXHRwdWJsaWMgcmVzb2x2ZU5vZGUobm9kZTogSW50ZXJ2YWxOb2RlLCBjYWNoZWRWZXJzaW9uSWQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX2RlY29yYXRpb25zVHJlZS5yZXNvbHZlTm9kZShub2RlLCBjYWNoZWRWZXJzaW9uSWQpO1xuXHR9XG5cblx0cHVibGljIGFjY2VwdFJlcGxhY2Uob2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyLCB0ZXh0TGVuZ3RoOiBudW1iZXIsIGZvcmNlTW92ZU1hcmtlcnM6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLl9kZWNvcmF0aW9uc1RyZWUuYWNjZXB0UmVwbGFjZShvZmZzZXQsIGxlbmd0aCwgdGV4dExlbmd0aCwgZm9yY2VNb3ZlTWFya2Vycyk7XG5cdH1cbn1cblxuY29uc3QgVFJBQ0tFRF9SQU5HRV9PUFRJT05TID0gW1xuXHRNb2RlbERlY29yYXRpb25PcHRpb25zLnJlZ2lzdGVyKHsgZGVzY3JpcHRpb246ICdub3RlYm9vay12aWV3LW1vZGVsLXRyYWNrZWQtcmFuZ2UtYWx3YXlzLWdyb3dzLXdoZW4tdHlwaW5nLWF0LWVkZ2VzJywgc3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzIH0pLFxuXHRNb2RlbERlY29yYXRpb25PcHRpb25zLnJlZ2lzdGVyKHsgZGVzY3JpcHRpb246ICdub3RlYm9vay12aWV3LW1vZGVsLXRyYWNrZWQtcmFuZ2UtbmV2ZXItZ3Jvd3Mtd2hlbi10eXBpbmctYXQtZWRnZXMnLCBzdGlja2luZXNzOiBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcyB9KSxcblx0TW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5yZWdpc3Rlcih7IGRlc2NyaXB0aW9uOiAnbm90ZWJvb2stdmlldy1tb2RlbC10cmFja2VkLXJhbmdlLWdyb3dzLW9ubHktd2hlbi10eXBpbmctYmVmb3JlJywgc3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQmVmb3JlIH0pLFxuXHRNb2RlbERlY29yYXRpb25PcHRpb25zLnJlZ2lzdGVyKHsgZGVzY3JpcHRpb246ICdub3RlYm9vay12aWV3LW1vZGVsLXRyYWNrZWQtcmFuZ2UtZ3Jvd3Mtb25seS13aGVuLXR5cGluZy1hZnRlcicsIHN0aWNraW5lc3M6IFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuR3Jvd3NPbmx5V2hlblR5cGluZ0FmdGVyIH0pLFxuXTtcblxuZnVuY3Rpb24gX25vcm1hbGl6ZU9wdGlvbnMob3B0aW9uczogSU1vZGVsRGVjb3JhdGlvbk9wdGlvbnMpOiBNb2RlbERlY29yYXRpb25PcHRpb25zIHtcblx0aWYgKG9wdGlvbnMgaW5zdGFuY2VvZiBNb2RlbERlY29yYXRpb25PcHRpb25zKSB7XG5cdFx0cmV0dXJuIG9wdGlvbnM7XG5cdH1cblx0cmV0dXJuIE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMuY3JlYXRlRHluYW1pYyhvcHRpb25zKTtcbn1cblxubGV0IE1PREVMX0lEID0gMDtcblxuZXhwb3J0IGludGVyZmFjZSBOb3RlYm9va1ZpZXdNb2RlbE9wdGlvbnMge1xuXHRpc1JlYWRPbmx5OiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tWaWV3TW9kZWwgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgRWRpdG9yRm9sZGluZ1N0YXRlRGVsZWdhdGUsIElOb3RlYm9va1ZpZXdNb2RlbCB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2xvY2FsU3RvcmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIF9oYW5kbGVUb1ZpZXdDZWxsTWFwcGluZyA9IG5ldyBNYXA8bnVtYmVyLCBDZWxsVmlld01vZGVsPigpO1xuXHRnZXQgb3B0aW9ucygpOiBOb3RlYm9va1ZpZXdNb2RlbE9wdGlvbnMgeyByZXR1cm4gdGhpcy5fb3B0aW9uczsgfVxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZU9wdGlvbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0Z2V0IG9uRGlkQ2hhbmdlT3B0aW9ucygpOiBFdmVudDx2b2lkPiB7IHJldHVybiB0aGlzLl9vbkRpZENoYW5nZU9wdGlvbnMuZXZlbnQ7IH1cblx0cHJpdmF0ZSBfdmlld0NlbGxzOiBDZWxsVmlld01vZGVsW10gPSBbXTtcblxuXHRnZXQgdmlld0NlbGxzKCk6IElDZWxsVmlld01vZGVsW10ge1xuXHRcdHJldHVybiB0aGlzLl92aWV3Q2VsbHM7XG5cdH1cblxuXHRnZXQgbGVuZ3RoKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX3ZpZXdDZWxscy5sZW5ndGg7XG5cdH1cblxuXHRnZXQgbm90ZWJvb2tEb2N1bWVudCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbm90ZWJvb2s7XG5cdH1cblxuXHRnZXQgdXJpKCkge1xuXHRcdHJldHVybiB0aGlzLl9ub3RlYm9vay51cmk7XG5cdH1cblxuXHRnZXQgbWV0YWRhdGEoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX25vdGVib29rLm1ldGFkYXRhO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgaXNSZXBsKCkge1xuXHRcdHJldHVybiB0aGlzLnZpZXdUeXBlID09PSAncmVwbCc7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVZpZXdDZWxscyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElOb3RlYm9va1ZpZXdDZWxsc1VwZGF0ZUV2ZW50PigpKTtcblx0Z2V0IG9uRGlkQ2hhbmdlVmlld0NlbGxzKCk6IEV2ZW50PElOb3RlYm9va1ZpZXdDZWxsc1VwZGF0ZUV2ZW50PiB7IHJldHVybiB0aGlzLl9vbkRpZENoYW5nZVZpZXdDZWxscy5ldmVudDsgfVxuXG5cdHByaXZhdGUgX2xhc3ROb3RlYm9va0VkaXRSZXNvdXJjZTogVVJJW10gPSBbXTtcblxuXHRnZXQgbGFzdE5vdGVib29rRWRpdFJlc291cmNlKCk6IFVSSSB8IG51bGwge1xuXHRcdGlmICh0aGlzLl9sYXN0Tm90ZWJvb2tFZGl0UmVzb3VyY2UubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fbGFzdE5vdGVib29rRWRpdFJlc291cmNlW3RoaXMuX2xhc3ROb3RlYm9va0VkaXRSZXNvdXJjZS5sZW5ndGggLSAxXTtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRnZXQgbGF5b3V0SW5mbygpOiBOb3RlYm9va0xheW91dEluZm8gfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fbGF5b3V0SW5mbztcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU2VsZWN0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8c3RyaW5nPigpKTtcblx0Z2V0IG9uRGlkQ2hhbmdlU2VsZWN0aW9uKCk6IEV2ZW50PHN0cmluZz4geyByZXR1cm4gdGhpcy5fb25EaWRDaGFuZ2VTZWxlY3Rpb24uZXZlbnQ7IH1cblxuXHRwcml2YXRlIF9zZWxlY3Rpb25Db2xsZWN0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IE5vdGVib29rQ2VsbFNlbGVjdGlvbkNvbGxlY3Rpb24oKSk7XG5cblx0cHJpdmF0ZSBnZXQgc2VsZWN0aW9uSGFuZGxlcygpIHtcblx0XHRjb25zdCBoYW5kbGVzU2V0ID0gbmV3IFNldDxudW1iZXI+KCk7XG5cdFx0Y29uc3QgaGFuZGxlczogbnVtYmVyW10gPSBbXTtcblx0XHRjZWxsUmFuZ2VzVG9JbmRleGVzKHRoaXMuX3NlbGVjdGlvbkNvbGxlY3Rpb24uc2VsZWN0aW9ucykubWFwKGluZGV4ID0+IGluZGV4IDwgdGhpcy5sZW5ndGggPyB0aGlzLmNlbGxBdChpbmRleCkgOiB1bmRlZmluZWQpLmZvckVhY2goY2VsbCA9PiB7XG5cdFx0XHRpZiAoY2VsbCAmJiAhaGFuZGxlc1NldC5oYXMoY2VsbC5oYW5kbGUpKSB7XG5cdFx0XHRcdGhhbmRsZXMucHVzaChjZWxsLmhhbmRsZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gaGFuZGxlcztcblx0fVxuXG5cdHByaXZhdGUgc2V0IHNlbGVjdGlvbkhhbmRsZXMoc2VsZWN0aW9uSGFuZGxlczogbnVtYmVyW10pIHtcblx0XHRjb25zdCBpbmRleGVzID0gc2VsZWN0aW9uSGFuZGxlcy5tYXAoaGFuZGxlID0+IHRoaXMuX3ZpZXdDZWxscy5maW5kSW5kZXgoY2VsbCA9PiBjZWxsLmhhbmRsZSA9PT0gaGFuZGxlKSk7XG5cdFx0dGhpcy5fc2VsZWN0aW9uQ29sbGVjdGlvbi5zZXRTZWxlY3Rpb25zKGNlbGxJbmRleGVzVG9SYW5nZXMoaW5kZXhlcyksIHRydWUsICdtb2RlbCcpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZGVjb3JhdGlvbnNUcmVlID0gbmV3IERlY29yYXRpb25zVHJlZSgpO1xuXHRwcml2YXRlIF9kZWNvcmF0aW9uczogeyBbZGVjb3JhdGlvbklkOiBzdHJpbmddOiBJbnRlcnZhbE5vZGUgfSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdHByaXZhdGUgX2xhc3REZWNvcmF0aW9uSWQ6IG51bWJlciA9IDA7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbmNlSWQ6IHN0cmluZztcblx0cHVibGljIHJlYWRvbmx5IGlkOiBzdHJpbmc7XG5cdHByaXZhdGUgX2ZvbGRpbmdSYW5nZXM6IEZvbGRpbmdSZWdpb25zIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgX29uRGlkRm9sZGluZ1N0YXRlQ2hhbmdlZCA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdG9uRGlkRm9sZGluZ1N0YXRlQ2hhbmdlZDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZEZvbGRpbmdTdGF0ZUNoYW5nZWQuZXZlbnQ7XG5cdHByaXZhdGUgX2hpZGRlblJhbmdlczogSUNlbGxSYW5nZVtdID0gW107XG5cdHByaXZhdGUgX2ZvY3VzZWQ6IGJvb2xlYW4gPSB0cnVlO1xuXG5cdGdldCBmb2N1c2VkKCkge1xuXHRcdHJldHVybiB0aGlzLl9mb2N1c2VkO1xuXHR9XG5cblx0cHJpdmF0ZSBfZGVjb3JhdGlvbklkVG9DZWxsTWFwID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblx0cHJpdmF0ZSBfc3RhdHVzQmFySXRlbUlkVG9DZWxsTWFwID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblxuXHRwcml2YXRlIF9sYXN0T3ZlcnZpZXdSdWxlckRlY29yYXRpb25JZDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBfb3ZlcnZpZXdSdWxlckRlY29yYXRpb25zID0gbmV3IE1hcDxzdHJpbmcsIElOb3RlYm9va0RlbHRhVmlld1pvbmVEZWNvcmF0aW9uPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyB2aWV3VHlwZTogc3RyaW5nLFxuXHRcdHByaXZhdGUgX25vdGVib29rOiBOb3RlYm9va1RleHRNb2RlbCxcblx0XHRwcml2YXRlIF92aWV3Q29udGV4dDogVmlld0NvbnRleHQsXG5cdFx0cHJpdmF0ZSBfbGF5b3V0SW5mbzogTm90ZWJvb2tMYXlvdXRJbmZvIHwgbnVsbCxcblx0XHRwcml2YXRlIF9vcHRpb25zOiBOb3RlYm9va1ZpZXdNb2RlbE9wdGlvbnMsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQnVsa0VkaXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2J1bGtFZGl0U2VydmljZTogSUJ1bGtFZGl0U2VydmljZSxcblx0XHRASVVuZG9SZWRvU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF91bmRvU2VydmljZTogSVVuZG9SZWRvU2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGV4dE1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlOiBJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRNT0RFTF9JRCsrO1xuXHRcdHRoaXMuaWQgPSAnJG5vdGVib29rVmlld01vZGVsJyArIE1PREVMX0lEO1xuXHRcdHRoaXMuX2luc3RhbmNlSWQgPSBzdHJpbmdzLnNpbmdsZUxldHRlckhhc2goTU9ERUxfSUQpO1xuXG5cdFx0Y29uc3QgY29tcHV0ZSA9IChjaGFuZ2VzOiBOb3RlYm9va0NlbGxUZXh0TW9kZWxTcGxpY2U8SUNlbGw+W10sIHN5bmNocm9ub3VzOiBib29sZWFuKSA9PiB7XG5cdFx0XHRjb25zdCBkaWZmcyA9IGNoYW5nZXMubWFwKHNwbGljZSA9PiB7XG5cdFx0XHRcdHJldHVybiBbc3BsaWNlWzBdLCBzcGxpY2VbMV0sIHNwbGljZVsyXS5tYXAoY2VsbCA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIGNyZWF0ZUNlbGxWaWV3TW9kZWwodGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UsIHRoaXMsIGNlbGwgYXMgTm90ZWJvb2tDZWxsVGV4dE1vZGVsLCB0aGlzLl92aWV3Q29udGV4dCk7XG5cdFx0XHRcdH0pXSBhcyBbbnVtYmVyLCBudW1iZXIsIENlbGxWaWV3TW9kZWxbXV07XG5cdFx0XHR9KTtcblxuXHRcdFx0ZGlmZnMucmV2ZXJzZSgpLmZvckVhY2goZGlmZiA9PiB7XG5cdFx0XHRcdGNvbnN0IGRlbGV0ZWRDZWxscyA9IHRoaXMuX3ZpZXdDZWxscy5zcGxpY2UoZGlmZlswXSwgZGlmZlsxXSwgLi4uZGlmZlsyXSk7XG5cblx0XHRcdFx0dGhpcy5fZGVjb3JhdGlvbnNUcmVlLmFjY2VwdFJlcGxhY2UoZGlmZlswXSwgZGlmZlsxXSwgZGlmZlsyXS5sZW5ndGgsIHRydWUpO1xuXHRcdFx0XHRkZWxldGVkQ2VsbHMuZm9yRWFjaChjZWxsID0+IHtcblx0XHRcdFx0XHR0aGlzLl9oYW5kbGVUb1ZpZXdDZWxsTWFwcGluZy5kZWxldGUoY2VsbC5oYW5kbGUpO1xuXHRcdFx0XHRcdC8vIGRpc3Bvc2UgdGhlIGNlbGwgdG8gcmVsZWFzZSByZWYgdG8gdGhlIGNlbGwgdGV4dCBkb2N1bWVudFxuXHRcdFx0XHRcdGNlbGwuZGlzcG9zZSgpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRkaWZmWzJdLmZvckVhY2goY2VsbCA9PiB7XG5cdFx0XHRcdFx0dGhpcy5faGFuZGxlVG9WaWV3Q2VsbE1hcHBpbmcuc2V0KGNlbGwuaGFuZGxlLCBjZWxsKTtcblx0XHRcdFx0XHR0aGlzLl9sb2NhbFN0b3JlLmFkZChjZWxsKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3Qgc2VsZWN0aW9uSGFuZGxlcyA9IHRoaXMuc2VsZWN0aW9uSGFuZGxlcztcblxuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VWaWV3Q2VsbHMuZmlyZSh7XG5cdFx0XHRcdHN5bmNocm9ub3VzOiBzeW5jaHJvbm91cyxcblx0XHRcdFx0c3BsaWNlczogZGlmZnNcblx0XHRcdH0pO1xuXG5cdFx0XHRsZXQgZW5kU2VsZWN0aW9uSGFuZGxlczogbnVtYmVyW10gPSBbXTtcblx0XHRcdGlmIChzZWxlY3Rpb25IYW5kbGVzLmxlbmd0aCkge1xuXHRcdFx0XHRjb25zdCBwcmltYXJ5SGFuZGxlID0gc2VsZWN0aW9uSGFuZGxlc1swXTtcblx0XHRcdFx0Y29uc3QgcHJpbWFyeVNlbGVjdGlvbkluZGV4ID0gdGhpcy5fdmlld0NlbGxzLmluZGV4T2YodGhpcy5nZXRDZWxsQnlIYW5kbGUocHJpbWFyeUhhbmRsZSkhKTtcblx0XHRcdFx0ZW5kU2VsZWN0aW9uSGFuZGxlcyA9IFtwcmltYXJ5SGFuZGxlXTtcblx0XHRcdFx0bGV0IGRlbHRhID0gMDtcblxuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGRpZmZzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGlmZiA9IGRpZmZzWzBdO1xuXHRcdFx0XHRcdGlmIChkaWZmWzBdICsgZGlmZlsxXSA8PSBwcmltYXJ5U2VsZWN0aW9uSW5kZXgpIHtcblx0XHRcdFx0XHRcdGRlbHRhICs9IGRpZmZbMl0ubGVuZ3RoIC0gZGlmZlsxXTtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChkaWZmWzBdID4gcHJpbWFyeVNlbGVjdGlvbkluZGV4KSB7XG5cdFx0XHRcdFx0XHRlbmRTZWxlY3Rpb25IYW5kbGVzID0gW3ByaW1hcnlIYW5kbGVdO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKGRpZmZbMF0gKyBkaWZmWzFdID4gcHJpbWFyeVNlbGVjdGlvbkluZGV4KSB7XG5cdFx0XHRcdFx0XHRlbmRTZWxlY3Rpb25IYW5kbGVzID0gW3RoaXMuX3ZpZXdDZWxsc1tkaWZmWzBdICsgZGVsdGFdLmhhbmRsZV07XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gVE9ET0ByZWJvcm5peFxuXHRcdFx0Y29uc3Qgc2VsZWN0aW9uSW5kZXhlcyA9IGVuZFNlbGVjdGlvbkhhbmRsZXMubWFwKGhhbmRsZSA9PiB0aGlzLl92aWV3Q2VsbHMuZmluZEluZGV4KGNlbGwgPT4gY2VsbC5oYW5kbGUgPT09IGhhbmRsZSkpO1xuXHRcdFx0dGhpcy5fc2VsZWN0aW9uQ29sbGVjdGlvbi5zZXRTdGF0ZShjZWxsSW5kZXhlc1RvUmFuZ2VzKFtzZWxlY3Rpb25JbmRleGVzWzBdXSlbMF0sIGNlbGxJbmRleGVzVG9SYW5nZXMoc2VsZWN0aW9uSW5kZXhlcyksIHRydWUsICdtb2RlbCcpO1xuXHRcdH07XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9ub3RlYm9vay5vbkRpZENoYW5nZUNvbnRlbnQoZSA9PiB7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGUucmF3RXZlbnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGNoYW5nZSA9IGUucmF3RXZlbnRzW2ldO1xuXHRcdFx0XHRsZXQgY2hhbmdlczogTm90ZWJvb2tDZWxsVGV4dE1vZGVsU3BsaWNlPElDZWxsPltdID0gW107XG5cdFx0XHRcdGNvbnN0IHN5bmNocm9ub3VzID0gZS5zeW5jaHJvbm91cyA/PyB0cnVlO1xuXG5cdFx0XHRcdGlmIChjaGFuZ2Uua2luZCA9PT0gTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuTW9kZWxDaGFuZ2UgfHwgY2hhbmdlLmtpbmQgPT09IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLkluaXRpYWxpemUpIHtcblx0XHRcdFx0XHRjaGFuZ2VzID0gY2hhbmdlLmNoYW5nZXM7XG5cdFx0XHRcdFx0Y29tcHV0ZShjaGFuZ2VzLCBzeW5jaHJvbm91cyk7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH0gZWxzZSBpZiAoY2hhbmdlLmtpbmQgPT09IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLk1vdmUpIHtcblx0XHRcdFx0XHRjb21wdXRlKFtbY2hhbmdlLmluZGV4LCBjaGFuZ2UubGVuZ3RoLCBbXV1dLCBzeW5jaHJvbm91cyk7XG5cdFx0XHRcdFx0Y29tcHV0ZShbW2NoYW5nZS5uZXdJZHgsIDAsIGNoYW5nZS5jZWxsc11dLCBzeW5jaHJvbm91cyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9ub3RlYm9vay5vbkRpZENoYW5nZUNvbnRlbnQoY29udGVudENoYW5nZXMgPT4ge1xuXHRcdFx0Y29udGVudENoYW5nZXMucmF3RXZlbnRzLmZvckVhY2goZSA9PiB7XG5cdFx0XHRcdGlmIChlLmtpbmQgPT09IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLkNoYW5nZURvY3VtZW50TWV0YWRhdGEpIHtcblx0XHRcdFx0XHR0aGlzLl92aWV3Q29udGV4dC5ldmVudERpc3BhdGNoZXIuZW1pdChbbmV3IE5vdGVib29rTWV0YWRhdGFDaGFuZ2VkRXZlbnQodGhpcy5fbm90ZWJvb2subWV0YWRhdGEpXSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoY29udGVudENoYW5nZXMuZW5kU2VsZWN0aW9uU3RhdGUpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVTZWxlY3Rpb25zU3RhdGUoY29udGVudENoYW5nZXMuZW5kU2VsZWN0aW9uU3RhdGUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3ZpZXdDb250ZXh0LmV2ZW50RGlzcGF0Y2hlci5vbkRpZENoYW5nZUxheW91dCgoZSkgPT4ge1xuXHRcdFx0dGhpcy5fbGF5b3V0SW5mbyA9IGUudmFsdWU7XG5cblx0XHRcdHRoaXMuX3ZpZXdDZWxscy5mb3JFYWNoKGNlbGwgPT4ge1xuXHRcdFx0XHRpZiAoY2VsbC5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuTWFya3VwKSB7XG5cdFx0XHRcdFx0aWYgKGUuc291cmNlLndpZHRoIHx8IGUuc291cmNlLmZvbnRJbmZvKSB7XG5cdFx0XHRcdFx0XHRjZWxsLmxheW91dENoYW5nZSh7IG91dGVyV2lkdGg6IGUudmFsdWUud2lkdGgsIGZvbnQ6IGUudmFsdWUuZm9udEluZm8gfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmIChlLnNvdXJjZS53aWR0aCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRjZWxsLmxheW91dENoYW5nZSh7IG91dGVyV2lkdGg6IGUudmFsdWUud2lkdGgsIGZvbnQ6IGUudmFsdWUuZm9udEluZm8gfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl92aWV3Q29udGV4dC5ub3RlYm9va09wdGlvbnMub25EaWRDaGFuZ2VPcHRpb25zKGUgPT4ge1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLl92aWV3Q2VsbHNbaV07XG5cdFx0XHRcdGNlbGwudXBkYXRlT3B0aW9ucyhlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZS5vbkRpZENoYW5nZUV4ZWN1dGlvbihlID0+IHtcblx0XHRcdGlmIChlLnR5cGUgIT09IE5vdGVib29rRXhlY3V0aW9uVHlwZS5jZWxsKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLmdldENlbGxCeUhhbmRsZShlLmNlbGxIYW5kbGUpO1xuXG5cdFx0XHRpZiAoY2VsbCBpbnN0YW5jZW9mIENvZGVDZWxsVmlld01vZGVsKSB7XG5cdFx0XHRcdGNlbGwudXBkYXRlRXhlY3V0aW9uU3RhdGUoZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fc2VsZWN0aW9uQ29sbGVjdGlvbi5vbkRpZENoYW5nZVNlbGVjdGlvbihlID0+IHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU2VsZWN0aW9uLmZpcmUoZSk7XG5cdFx0fSkpO1xuXG5cblx0XHRjb25zdCB2aWV3Q2VsbENvdW50ID0gdGhpcy5pc1JlcGwgPyB0aGlzLl9ub3RlYm9vay5jZWxscy5sZW5ndGggLSAxIDogdGhpcy5fbm90ZWJvb2suY2VsbHMubGVuZ3RoO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdmlld0NlbGxDb3VudDsgaSsrKSB7XG5cdFx0XHR0aGlzLl92aWV3Q2VsbHMucHVzaChjcmVhdGVDZWxsVmlld01vZGVsKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLCB0aGlzLCB0aGlzLl9ub3RlYm9vay5jZWxsc1tpXSwgdGhpcy5fdmlld0NvbnRleHQpKTtcblx0XHR9XG5cblxuXHRcdHRoaXMuX3ZpZXdDZWxscy5mb3JFYWNoKGNlbGwgPT4ge1xuXHRcdFx0dGhpcy5faGFuZGxlVG9WaWV3Q2VsbE1hcHBpbmcuc2V0KGNlbGwuaGFuZGxlLCBjZWxsKTtcblx0XHR9KTtcblx0fVxuXG5cdHVwZGF0ZU9wdGlvbnMobmV3T3B0aW9uczogUGFydGlhbDxOb3RlYm9va1ZpZXdNb2RlbE9wdGlvbnM+KSB7XG5cdFx0dGhpcy5fb3B0aW9ucyA9IHsgLi4udGhpcy5fb3B0aW9ucywgLi4ubmV3T3B0aW9ucyB9O1xuXHRcdHRoaXMuX3ZpZXdDZWxscy5mb3JFYWNoKGNlbGwgPT4gY2VsbC51cGRhdGVPcHRpb25zKHsgcmVhZG9ubHk6IHRoaXMuX29wdGlvbnMuaXNSZWFkT25seSB9KSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VPcHRpb25zLmZpcmUoKTtcblx0fVxuXG5cdGdldEZvY3VzKCkge1xuXHRcdHJldHVybiB0aGlzLl9zZWxlY3Rpb25Db2xsZWN0aW9uLmZvY3VzO1xuXHR9XG5cblx0Z2V0U2VsZWN0aW9ucygpIHtcblx0XHRyZXR1cm4gdGhpcy5fc2VsZWN0aW9uQ29sbGVjdGlvbi5zZWxlY3Rpb25zO1xuXHR9XG5cblx0Z2V0TW9zdFJlY2VudGx5RXhlY3V0ZWRDZWxsKCk6IElDZWxsVmlld01vZGVsIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBoYW5kbGUgPSB0aGlzLm5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmdldExhc3RDb21wbGV0ZWRDZWxsRm9yTm90ZWJvb2sodGhpcy5fbm90ZWJvb2sudXJpKTtcblx0XHRyZXR1cm4gaGFuZGxlICE9PSB1bmRlZmluZWQgPyB0aGlzLmdldENlbGxCeUhhbmRsZShoYW5kbGUpIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0c2V0RWRpdG9yRm9jdXMoZm9jdXNlZDogYm9vbGVhbikge1xuXHRcdHRoaXMuX2ZvY3VzZWQgPSBmb2N1c2VkO1xuXHR9XG5cblx0dmFsaWRhdGVSYW5nZShjZWxsUmFuZ2U6IElDZWxsUmFuZ2UgfCBudWxsIHwgdW5kZWZpbmVkKTogSUNlbGxSYW5nZSB8IG51bGwge1xuXHRcdGlmICghY2VsbFJhbmdlKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCBzdGFydCA9IGNsYW1wKGNlbGxSYW5nZS5zdGFydCwgMCwgdGhpcy5sZW5ndGgpO1xuXHRcdGNvbnN0IGVuZCA9IGNsYW1wKGNlbGxSYW5nZS5lbmQsIDAsIHRoaXMubGVuZ3RoKTtcblxuXHRcdGlmIChzdGFydCA8PSBlbmQpIHtcblx0XHRcdHJldHVybiB7IHN0YXJ0LCBlbmQgfTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHsgc3RhcnQ6IGVuZCwgZW5kOiBzdGFydCB9O1xuXHRcdH1cblx0fVxuXG5cdC8vIHNlbGVjdGlvbiBjaGFuZ2UgZnJvbSBsaXN0IHZpZXcncyBgc2V0Rm9jdXNgIGFuZCBgc2V0U2VsZWN0aW9uYCBzaG91bGQgYWx3YXlzIHVzZSBgc291cmNlOiB2aWV3YCB0byBwcmV2ZW50IGV2ZW50cyBicmVha2luZyB0aGUgbGlzdCB2aWV3IGZvY3VzL3NlbGVjdGlvbiBjaGFuZ2UgdHJhbnNhY3Rpb25cblx0dXBkYXRlU2VsZWN0aW9uc1N0YXRlKHN0YXRlOiBJU2VsZWN0aW9uU3RhdGUsIHNvdXJjZTogJ3ZpZXcnIHwgJ21vZGVsJyA9ICdtb2RlbCcpIHtcblx0XHRpZiAodGhpcy5fZm9jdXNlZCB8fCBzb3VyY2UgPT09ICdtb2RlbCcpIHtcblx0XHRcdGlmIChzdGF0ZS5raW5kID09PSBTZWxlY3Rpb25TdGF0ZVR5cGUuSGFuZGxlKSB7XG5cdFx0XHRcdGNvbnN0IHByaW1hcnlJbmRleCA9IHN0YXRlLnByaW1hcnkgIT09IG51bGwgPyB0aGlzLmdldENlbGxJbmRleEJ5SGFuZGxlKHN0YXRlLnByaW1hcnkpIDogbnVsbDtcblx0XHRcdFx0Y29uc3QgcHJpbWFyeVNlbGVjdGlvbiA9IHByaW1hcnlJbmRleCAhPT0gbnVsbCA/IHRoaXMudmFsaWRhdGVSYW5nZSh7IHN0YXJ0OiBwcmltYXJ5SW5kZXgsIGVuZDogcHJpbWFyeUluZGV4ICsgMSB9KSA6IG51bGw7XG5cdFx0XHRcdGNvbnN0IHNlbGVjdGlvbnMgPSBjZWxsSW5kZXhlc1RvUmFuZ2VzKHN0YXRlLnNlbGVjdGlvbnMubWFwKHNlbCA9PiB0aGlzLmdldENlbGxJbmRleEJ5SGFuZGxlKHNlbCkpKVxuXHRcdFx0XHRcdC5tYXAocmFuZ2UgPT4gdGhpcy52YWxpZGF0ZVJhbmdlKHJhbmdlKSlcblx0XHRcdFx0XHQuZmlsdGVyKHJhbmdlID0+IHJhbmdlICE9PSBudWxsKSBhcyBJQ2VsbFJhbmdlW107XG5cdFx0XHRcdHRoaXMuX3NlbGVjdGlvbkNvbGxlY3Rpb24uc2V0U3RhdGUocHJpbWFyeVNlbGVjdGlvbiwgcmVkdWNlQ2VsbFJhbmdlcyhzZWxlY3Rpb25zKSwgdHJ1ZSwgc291cmNlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHByaW1hcnlTZWxlY3Rpb24gPSB0aGlzLnZhbGlkYXRlUmFuZ2Uoc3RhdGUuZm9jdXMpO1xuXHRcdFx0XHRjb25zdCBzZWxlY3Rpb25zID0gc3RhdGUuc2VsZWN0aW9uc1xuXHRcdFx0XHRcdC5tYXAocmFuZ2UgPT4gdGhpcy52YWxpZGF0ZVJhbmdlKHJhbmdlKSlcblx0XHRcdFx0XHQuZmlsdGVyKHJhbmdlID0+IHJhbmdlICE9PSBudWxsKSBhcyBJQ2VsbFJhbmdlW107XG5cdFx0XHRcdHRoaXMuX3NlbGVjdGlvbkNvbGxlY3Rpb24uc2V0U3RhdGUocHJpbWFyeVNlbGVjdGlvbiwgcmVkdWNlQ2VsbFJhbmdlcyhzZWxlY3Rpb25zKSwgdHJ1ZSwgc291cmNlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRnZXRGb2xkaW5nU3RhcnRJbmRleChpbmRleDogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRpZiAoIXRoaXMuX2ZvbGRpbmdSYW5nZXMpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cblx0XHRjb25zdCByYW5nZSA9IHRoaXMuX2ZvbGRpbmdSYW5nZXMuZmluZFJhbmdlKGluZGV4ICsgMSk7XG5cdFx0Y29uc3Qgc3RhcnRJbmRleCA9IHRoaXMuX2ZvbGRpbmdSYW5nZXMuZ2V0U3RhcnRMaW5lTnVtYmVyKHJhbmdlKSAtIDE7XG5cdFx0cmV0dXJuIHN0YXJ0SW5kZXg7XG5cdH1cblxuXHRnZXRGb2xkaW5nU3RhdGUoaW5kZXg6IG51bWJlcik6IENlbGxGb2xkaW5nU3RhdGUge1xuXHRcdGlmICghdGhpcy5fZm9sZGluZ1Jhbmdlcykge1xuXHRcdFx0cmV0dXJuIENlbGxGb2xkaW5nU3RhdGUuTm9uZTtcblx0XHR9XG5cblx0XHRjb25zdCByYW5nZSA9IHRoaXMuX2ZvbGRpbmdSYW5nZXMuZmluZFJhbmdlKGluZGV4ICsgMSk7XG5cdFx0Y29uc3Qgc3RhcnRJbmRleCA9IHRoaXMuX2ZvbGRpbmdSYW5nZXMuZ2V0U3RhcnRMaW5lTnVtYmVyKHJhbmdlKSAtIDE7XG5cblx0XHRpZiAoc3RhcnRJbmRleCAhPT0gaW5kZXgpIHtcblx0XHRcdHJldHVybiBDZWxsRm9sZGluZ1N0YXRlLk5vbmU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX2ZvbGRpbmdSYW5nZXMuaXNDb2xsYXBzZWQocmFuZ2UpID8gQ2VsbEZvbGRpbmdTdGF0ZS5Db2xsYXBzZWQgOiBDZWxsRm9sZGluZ1N0YXRlLkV4cGFuZGVkO1xuXHR9XG5cblx0Z2V0Rm9sZGVkTGVuZ3RoKGluZGV4OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGlmICghdGhpcy5fZm9sZGluZ1Jhbmdlcykge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmFuZ2UgPSB0aGlzLl9mb2xkaW5nUmFuZ2VzLmZpbmRSYW5nZShpbmRleCArIDEpO1xuXHRcdGNvbnN0IHN0YXJ0SW5kZXggPSB0aGlzLl9mb2xkaW5nUmFuZ2VzLmdldFN0YXJ0TGluZU51bWJlcihyYW5nZSkgLSAxO1xuXHRcdGNvbnN0IGVuZEluZGV4ID0gdGhpcy5fZm9sZGluZ1Jhbmdlcy5nZXRFbmRMaW5lTnVtYmVyKHJhbmdlKSAtIDE7XG5cblx0XHRyZXR1cm4gZW5kSW5kZXggLSBzdGFydEluZGV4O1xuXHR9XG5cblx0dXBkYXRlRm9sZGluZ1JhbmdlcyhyYW5nZXM6IEZvbGRpbmdSZWdpb25zKSB7XG5cdFx0dGhpcy5fZm9sZGluZ1JhbmdlcyA9IHJhbmdlcztcblx0XHRsZXQgdXBkYXRlSGlkZGVuQXJlYXMgPSBmYWxzZTtcblx0XHRjb25zdCBuZXdIaWRkZW5BcmVhczogSUNlbGxSYW5nZVtdID0gW107XG5cblx0XHRsZXQgaSA9IDA7IC8vIGluZGV4IGludG8gaGlkZGVuXG5cdFx0bGV0IGsgPSAwO1xuXG5cdFx0bGV0IGxhc3RDb2xsYXBzZWRTdGFydCA9IE51bWJlci5NQVhfVkFMVUU7XG5cdFx0bGV0IGxhc3RDb2xsYXBzZWRFbmQgPSAtMTtcblxuXHRcdGZvciAoOyBpIDwgcmFuZ2VzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRpZiAoIXJhbmdlcy5pc0NvbGxhcHNlZChpKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc3RhcnRMaW5lTnVtYmVyID0gcmFuZ2VzLmdldFN0YXJ0TGluZU51bWJlcihpKSArIDE7IC8vIHRoZSBmaXJzdCBsaW5lIGlzIG5vdCBoaWRkZW5cblx0XHRcdGNvbnN0IGVuZExpbmVOdW1iZXIgPSByYW5nZXMuZ2V0RW5kTGluZU51bWJlcihpKTtcblx0XHRcdGlmIChsYXN0Q29sbGFwc2VkU3RhcnQgPD0gc3RhcnRMaW5lTnVtYmVyICYmIGVuZExpbmVOdW1iZXIgPD0gbGFzdENvbGxhcHNlZEVuZCkge1xuXHRcdFx0XHQvLyBpZ25vcmUgcmFuZ2VzIGNvbnRhaW5lZCBpbiBjb2xsYXBzZWQgcmVnaW9uc1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF1cGRhdGVIaWRkZW5BcmVhcyAmJiBrIDwgdGhpcy5faGlkZGVuUmFuZ2VzLmxlbmd0aCAmJiB0aGlzLl9oaWRkZW5SYW5nZXNba10uc3RhcnQgKyAxID09PSBzdGFydExpbmVOdW1iZXIgJiYgKHRoaXMuX2hpZGRlblJhbmdlc1trXS5lbmQgKyAxKSA9PT0gZW5kTGluZU51bWJlcikge1xuXHRcdFx0XHQvLyByZXVzZSB0aGUgb2xkIHJhbmdlc1xuXHRcdFx0XHRuZXdIaWRkZW5BcmVhcy5wdXNoKHRoaXMuX2hpZGRlblJhbmdlc1trXSk7XG5cdFx0XHRcdGsrKztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHVwZGF0ZUhpZGRlbkFyZWFzID0gdHJ1ZTtcblx0XHRcdFx0bmV3SGlkZGVuQXJlYXMucHVzaCh7IHN0YXJ0OiBzdGFydExpbmVOdW1iZXIgLSAxLCBlbmQ6IGVuZExpbmVOdW1iZXIgLSAxIH0pO1xuXHRcdFx0fVxuXHRcdFx0bGFzdENvbGxhcHNlZFN0YXJ0ID0gc3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0bGFzdENvbGxhcHNlZEVuZCA9IGVuZExpbmVOdW1iZXI7XG5cdFx0fVxuXG5cdFx0aWYgKHVwZGF0ZUhpZGRlbkFyZWFzIHx8IGsgPCB0aGlzLl9oaWRkZW5SYW5nZXMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLl9oaWRkZW5SYW5nZXMgPSBuZXdIaWRkZW5BcmVhcztcblx0XHRcdHRoaXMuX29uRGlkRm9sZGluZ1N0YXRlQ2hhbmdlZC5maXJlKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fdmlld0NlbGxzLmZvckVhY2goY2VsbCA9PiB7XG5cdFx0XHRpZiAoY2VsbC5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuTWFya3VwKSB7XG5cdFx0XHRcdGNlbGwudHJpZ2dlckZvbGRpbmdTdGF0ZUNoYW5nZSgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0Z2V0SGlkZGVuUmFuZ2VzKCkge1xuXHRcdHJldHVybiB0aGlzLl9oaWRkZW5SYW5nZXM7XG5cdH1cblxuXHRnZXRPdmVydmlld1J1bGVyRGVjb3JhdGlvbnMoKTogSU5vdGVib29rRGVsdGFWaWV3Wm9uZURlY29yYXRpb25bXSB7XG5cdFx0cmV0dXJuIEFycmF5LmZyb20odGhpcy5fb3ZlcnZpZXdSdWxlckRlY29yYXRpb25zLnZhbHVlcygpKTtcblx0fVxuXG5cdGdldENlbGxCeUhhbmRsZShoYW5kbGU6IG51bWJlcikge1xuXHRcdHJldHVybiB0aGlzLl9oYW5kbGVUb1ZpZXdDZWxsTWFwcGluZy5nZXQoaGFuZGxlKTtcblx0fVxuXG5cdGdldENlbGxJbmRleEJ5SGFuZGxlKGhhbmRsZTogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fdmlld0NlbGxzLmZpbmRJbmRleChjZWxsID0+IGNlbGwuaGFuZGxlID09PSBoYW5kbGUpO1xuXHR9XG5cblx0Z2V0Q2VsbEluZGV4KGNlbGw6IElDZWxsVmlld01vZGVsKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3ZpZXdDZWxscy5pbmRleE9mKGNlbGwgYXMgQ2VsbFZpZXdNb2RlbCk7XG5cdH1cblxuXHRjZWxsQXQoaW5kZXg6IG51bWJlcik6IENlbGxWaWV3TW9kZWwgfCB1bmRlZmluZWQge1xuXHRcdC8vIGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy5sZW5ndGgpIHtcblx0XHQvLyBcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBpbmRleCAke2luZGV4fWApO1xuXHRcdC8vIH1cblxuXHRcdHJldHVybiB0aGlzLl92aWV3Q2VsbHNbaW5kZXhdO1xuXHR9XG5cblx0Z2V0Q2VsbHNJblJhbmdlKHJhbmdlPzogSUNlbGxSYW5nZSk6IFJlYWRvbmx5QXJyYXk8SUNlbGxWaWV3TW9kZWw+IHtcblx0XHRpZiAoIXJhbmdlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fdmlld0NlbGxzLnNsaWNlKDApO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZhbGlkYXRlZFJhbmdlID0gdGhpcy52YWxpZGF0ZVJhbmdlKHJhbmdlKTtcblxuXHRcdGlmICh2YWxpZGF0ZWRSYW5nZSkge1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBJQ2VsbFZpZXdNb2RlbFtdID0gW107XG5cblx0XHRcdGZvciAobGV0IGkgPSB2YWxpZGF0ZWRSYW5nZS5zdGFydDsgaSA8IHZhbGlkYXRlZFJhbmdlLmVuZDsgaSsrKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKHRoaXMuX3ZpZXdDZWxsc1tpXSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0LyoqXG5cdCAqIElmIHRoaXMuX3ZpZXdDZWxsc1tpbmRleF0gaXMgdmlzaWJsZSB0aGVuIHJldHVybiBpbmRleFxuXHQgKi9cblx0Z2V0TmVhcmVzdFZpc2libGVDZWxsSW5kZXhVcHdhcmRzKGluZGV4OiBudW1iZXIpIHtcblx0XHRmb3IgKGxldCBpID0gdGhpcy5faGlkZGVuUmFuZ2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRjb25zdCBjZWxsUmFuZ2UgPSB0aGlzLl9oaWRkZW5SYW5nZXNbaV07XG5cdFx0XHRjb25zdCBmb2xkU3RhcnQgPSBjZWxsUmFuZ2Uuc3RhcnQgLSAxO1xuXHRcdFx0Y29uc3QgZm9sZEVuZCA9IGNlbGxSYW5nZS5lbmQ7XG5cblx0XHRcdGlmIChmb2xkU3RhcnQgPiBpbmRleCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGZvbGRTdGFydCA8PSBpbmRleCAmJiBmb2xkRW5kID49IGluZGV4KSB7XG5cdFx0XHRcdHJldHVybiBpbmRleDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gZm9sZFN0YXJ0IDw9IGluZGV4LCBmb2xkRW5kIDwgaW5kZXhcblx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdHJldHVybiBpbmRleDtcblx0fVxuXG5cdGdldE5leHRWaXNpYmxlQ2VsbEluZGV4KGluZGV4OiBudW1iZXIpIHtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2hpZGRlblJhbmdlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgY2VsbFJhbmdlID0gdGhpcy5faGlkZGVuUmFuZ2VzW2ldO1xuXHRcdFx0Y29uc3QgZm9sZFN0YXJ0ID0gY2VsbFJhbmdlLnN0YXJ0IC0gMTtcblx0XHRcdGNvbnN0IGZvbGRFbmQgPSBjZWxsUmFuZ2UuZW5kO1xuXG5cdFx0XHRpZiAoZm9sZEVuZCA8IGluZGV4KSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBmb2xkRW5kID49IGluZGV4XG5cdFx0XHRpZiAoZm9sZFN0YXJ0IDw9IGluZGV4KSB7XG5cdFx0XHRcdHJldHVybiBmb2xkRW5kICsgMTtcblx0XHRcdH1cblxuXHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGluZGV4ICsgMTtcblx0fVxuXG5cdGdldFByZXZpb3VzVmlzaWJsZUNlbGxJbmRleChpbmRleDogbnVtYmVyKSB7XG5cdFx0Zm9yIChsZXQgaSA9IHRoaXMuX2hpZGRlblJhbmdlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0Y29uc3QgY2VsbFJhbmdlID0gdGhpcy5faGlkZGVuUmFuZ2VzW2ldO1xuXHRcdFx0Y29uc3QgZm9sZFN0YXJ0ID0gY2VsbFJhbmdlLnN0YXJ0IC0gMTtcblx0XHRcdGNvbnN0IGZvbGRFbmQgPSBjZWxsUmFuZ2UuZW5kO1xuXG5cdFx0XHRpZiAoZm9sZEVuZCA8IGluZGV4KSB7XG5cdFx0XHRcdHJldHVybiBpbmRleDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGZvbGRTdGFydCA8PSBpbmRleCkge1xuXHRcdFx0XHRyZXR1cm4gZm9sZFN0YXJ0O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBpbmRleDtcblx0fVxuXG5cdGhhc0NlbGwoY2VsbDogSUNlbGxWaWV3TW9kZWwpIHtcblx0XHRyZXR1cm4gdGhpcy5faGFuZGxlVG9WaWV3Q2VsbE1hcHBpbmcuaGFzKGNlbGwuaGFuZGxlKTtcblx0fVxuXG5cdGdldFZlcnNpb25JZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbm90ZWJvb2sudmVyc2lvbklkO1xuXHR9XG5cblx0Z2V0QWx0ZXJuYXRpdmVJZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbm90ZWJvb2suYWx0ZXJuYXRpdmVWZXJzaW9uSWQ7XG5cdH1cblxuXHRnZXRUcmFja2VkUmFuZ2UoaWQ6IHN0cmluZyk6IElDZWxsUmFuZ2UgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fZ2V0RGVjb3JhdGlvblJhbmdlKGlkKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldERlY29yYXRpb25SYW5nZShkZWNvcmF0aW9uSWQ6IHN0cmluZyk6IElDZWxsUmFuZ2UgfCBudWxsIHtcblx0XHRjb25zdCBub2RlID0gdGhpcy5fZGVjb3JhdGlvbnNbZGVjb3JhdGlvbklkXTtcblx0XHRpZiAoIW5vZGUpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRjb25zdCB2ZXJzaW9uSWQgPSB0aGlzLmdldFZlcnNpb25JZCgpO1xuXHRcdGlmIChub2RlLmNhY2hlZFZlcnNpb25JZCAhPT0gdmVyc2lvbklkKSB7XG5cdFx0XHR0aGlzLl9kZWNvcmF0aW9uc1RyZWUucmVzb2x2ZU5vZGUobm9kZSwgdmVyc2lvbklkKTtcblx0XHR9XG5cdFx0aWYgKG5vZGUucmFuZ2UgPT09IG51bGwpIHtcblx0XHRcdHJldHVybiB7IHN0YXJ0OiBub2RlLmNhY2hlZEFic29sdXRlU3RhcnQgLSAxLCBlbmQ6IG5vZGUuY2FjaGVkQWJzb2x1dGVFbmQgLSAxIH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgc3RhcnQ6IG5vZGUucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyIC0gMSwgZW5kOiBub2RlLnJhbmdlLmVuZExpbmVOdW1iZXIgLSAxIH07XG5cdH1cblxuXHRzZXRUcmFja2VkUmFuZ2UoaWQ6IHN0cmluZyB8IG51bGwsIG5ld1JhbmdlOiBJQ2VsbFJhbmdlIHwgbnVsbCwgbmV3U3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcyk6IHN0cmluZyB8IG51bGwge1xuXHRcdGNvbnN0IG5vZGUgPSAoaWQgPyB0aGlzLl9kZWNvcmF0aW9uc1tpZF0gOiBudWxsKTtcblxuXHRcdGlmICghbm9kZSkge1xuXHRcdFx0aWYgKCFuZXdSYW5nZSkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRoaXMuX2RlbHRhQ2VsbERlY29yYXRpb25zSW1wbCgwLCBbXSwgW3sgcmFuZ2U6IG5ldyBSYW5nZShuZXdSYW5nZS5zdGFydCArIDEsIDEsIG5ld1JhbmdlLmVuZCArIDEsIDEpLCBvcHRpb25zOiBUUkFDS0VEX1JBTkdFX09QVElPTlNbbmV3U3RpY2tpbmVzc10gfV0pWzBdO1xuXHRcdH1cblxuXHRcdGlmICghbmV3UmFuZ2UpIHtcblx0XHRcdC8vIG5vZGUgZXhpc3RzLCB0aGUgcmVxdWVzdCBpcyB0byBkZWxldGUgPT4gZGVsZXRlIG5vZGVcblx0XHRcdHRoaXMuX2RlY29yYXRpb25zVHJlZS5kZWxldGUobm9kZSk7XG5cdFx0XHRkZWxldGUgdGhpcy5fZGVjb3JhdGlvbnNbbm9kZS5pZF07XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHR0aGlzLl9kZWNvcmF0aW9uc1RyZWUuZGVsZXRlKG5vZGUpO1xuXHRcdG5vZGUucmVzZXQodGhpcy5nZXRWZXJzaW9uSWQoKSwgbmV3UmFuZ2Uuc3RhcnQsIG5ld1JhbmdlLmVuZCArIDEsIG5ldyBSYW5nZShuZXdSYW5nZS5zdGFydCArIDEsIDEsIG5ld1JhbmdlLmVuZCArIDEsIDEpKTtcblx0XHRub2RlLnNldE9wdGlvbnMoVFJBQ0tFRF9SQU5HRV9PUFRJT05TW25ld1N0aWNraW5lc3NdKTtcblx0XHR0aGlzLl9kZWNvcmF0aW9uc1RyZWUuaW5zZXJ0KG5vZGUpO1xuXHRcdHJldHVybiBub2RlLmlkO1xuXHR9XG5cblx0cHJpdmF0ZSBfZGVsdGFDZWxsRGVjb3JhdGlvbnNJbXBsKG93bmVySWQ6IG51bWJlciwgb2xkRGVjb3JhdGlvbnNJZHM6IHN0cmluZ1tdLCBuZXdEZWNvcmF0aW9uczogSU1vZGVsRGVsdGFEZWNvcmF0aW9uW10pOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgdmVyc2lvbklkID0gdGhpcy5nZXRWZXJzaW9uSWQoKTtcblxuXHRcdGNvbnN0IG9sZERlY29yYXRpb25zTGVuID0gb2xkRGVjb3JhdGlvbnNJZHMubGVuZ3RoO1xuXHRcdGxldCBvbGREZWNvcmF0aW9uSW5kZXggPSAwO1xuXG5cdFx0Y29uc3QgbmV3RGVjb3JhdGlvbnNMZW4gPSBuZXdEZWNvcmF0aW9ucy5sZW5ndGg7XG5cdFx0bGV0IG5ld0RlY29yYXRpb25JbmRleCA9IDA7XG5cblx0XHRjb25zdCByZXN1bHQgPSBuZXcgQXJyYXk8c3RyaW5nPihuZXdEZWNvcmF0aW9uc0xlbik7XG5cdFx0d2hpbGUgKG9sZERlY29yYXRpb25JbmRleCA8IG9sZERlY29yYXRpb25zTGVuIHx8IG5ld0RlY29yYXRpb25JbmRleCA8IG5ld0RlY29yYXRpb25zTGVuKSB7XG5cblx0XHRcdGxldCBub2RlOiBJbnRlcnZhbE5vZGUgfCBudWxsID0gbnVsbDtcblxuXHRcdFx0aWYgKG9sZERlY29yYXRpb25JbmRleCA8IG9sZERlY29yYXRpb25zTGVuKSB7XG5cdFx0XHRcdC8vICgxKSBnZXQgb3Vyc2VsdmVzIGFuIG9sZCBub2RlXG5cdFx0XHRcdGRvIHtcblx0XHRcdFx0XHRub2RlID0gdGhpcy5fZGVjb3JhdGlvbnNbb2xkRGVjb3JhdGlvbnNJZHNbb2xkRGVjb3JhdGlvbkluZGV4KytdXTtcblx0XHRcdFx0fSB3aGlsZSAoIW5vZGUgJiYgb2xkRGVjb3JhdGlvbkluZGV4IDwgb2xkRGVjb3JhdGlvbnNMZW4pO1xuXG5cdFx0XHRcdC8vICgyKSByZW1vdmUgdGhlIG5vZGUgZnJvbSB0aGUgdHJlZSAoaWYgaXQgZXhpc3RzKVxuXHRcdFx0XHRpZiAobm9kZSkge1xuXHRcdFx0XHRcdHRoaXMuX2RlY29yYXRpb25zVHJlZS5kZWxldGUobm9kZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKG5ld0RlY29yYXRpb25JbmRleCA8IG5ld0RlY29yYXRpb25zTGVuKSB7XG5cdFx0XHRcdC8vICgzKSBjcmVhdGUgYSBuZXcgbm9kZSBpZiBuZWNlc3Nhcnlcblx0XHRcdFx0aWYgKCFub2RlKSB7XG5cdFx0XHRcdFx0Y29uc3QgaW50ZXJuYWxEZWNvcmF0aW9uSWQgPSAoKyt0aGlzLl9sYXN0RGVjb3JhdGlvbklkKTtcblx0XHRcdFx0XHRjb25zdCBkZWNvcmF0aW9uSWQgPSBgJHt0aGlzLl9pbnN0YW5jZUlkfTske2ludGVybmFsRGVjb3JhdGlvbklkfWA7XG5cdFx0XHRcdFx0bm9kZSA9IG5ldyBJbnRlcnZhbE5vZGUoZGVjb3JhdGlvbklkLCAwLCAwKTtcblx0XHRcdFx0XHR0aGlzLl9kZWNvcmF0aW9uc1tkZWNvcmF0aW9uSWRdID0gbm9kZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vICg0KSBpbml0aWFsaXplIG5vZGVcblx0XHRcdFx0Y29uc3QgbmV3RGVjb3JhdGlvbiA9IG5ld0RlY29yYXRpb25zW25ld0RlY29yYXRpb25JbmRleF07XG5cdFx0XHRcdGNvbnN0IHJhbmdlID0gbmV3RGVjb3JhdGlvbi5yYW5nZTtcblx0XHRcdFx0Y29uc3Qgb3B0aW9ucyA9IF9ub3JtYWxpemVPcHRpb25zKG5ld0RlY29yYXRpb24ub3B0aW9ucyk7XG5cblx0XHRcdFx0bm9kZS5vd25lcklkID0gb3duZXJJZDtcblx0XHRcdFx0bm9kZS5yZXNldCh2ZXJzaW9uSWQsIHJhbmdlLnN0YXJ0TGluZU51bWJlciwgcmFuZ2UuZW5kTGluZU51bWJlciwgUmFuZ2UubGlmdChyYW5nZSkpO1xuXHRcdFx0XHRub2RlLnNldE9wdGlvbnMob3B0aW9ucyk7XG5cblx0XHRcdFx0dGhpcy5fZGVjb3JhdGlvbnNUcmVlLmluc2VydChub2RlKTtcblxuXHRcdFx0XHRyZXN1bHRbbmV3RGVjb3JhdGlvbkluZGV4XSA9IG5vZGUuaWQ7XG5cblx0XHRcdFx0bmV3RGVjb3JhdGlvbkluZGV4Kys7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAobm9kZSkge1xuXHRcdFx0XHRcdGRlbGV0ZSB0aGlzLl9kZWNvcmF0aW9uc1tub2RlLmlkXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRkZWx0YUNlbGxEZWNvcmF0aW9ucyhvbGREZWNvcmF0aW9uczogc3RyaW5nW10sIG5ld0RlY29yYXRpb25zOiBJTm90ZWJvb2tEZWx0YURlY29yYXRpb25bXSk6IHN0cmluZ1tdIHtcblx0XHRvbGREZWNvcmF0aW9ucy5mb3JFYWNoKGlkID0+IHtcblx0XHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX2RlY29yYXRpb25JZFRvQ2VsbE1hcC5nZXQoaWQpO1xuXG5cdFx0XHRpZiAoaGFuZGxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Y29uc3QgY2VsbCA9IHRoaXMuZ2V0Q2VsbEJ5SGFuZGxlKGhhbmRsZSk7XG5cdFx0XHRcdGNlbGw/LmRlbHRhQ2VsbERlY29yYXRpb25zKFtpZF0sIFtdKTtcblx0XHRcdFx0dGhpcy5fZGVjb3JhdGlvbklkVG9DZWxsTWFwLmRlbGV0ZShpZCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLl9vdmVydmlld1J1bGVyRGVjb3JhdGlvbnMuaGFzKGlkKSkge1xuXHRcdFx0XHR0aGlzLl9vdmVydmlld1J1bGVyRGVjb3JhdGlvbnMuZGVsZXRlKGlkKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IHJlc3VsdDogc3RyaW5nW10gPSBbXTtcblxuXHRcdG5ld0RlY29yYXRpb25zLmZvckVhY2goZGVjb3JhdGlvbiA9PiB7XG5cdFx0XHRpZiAoaXNOb3RlYm9va0NlbGxEZWNvcmF0aW9uKGRlY29yYXRpb24pKSB7XG5cdFx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLmdldENlbGxCeUhhbmRsZShkZWNvcmF0aW9uLmhhbmRsZSk7XG5cdFx0XHRcdGNvbnN0IHJldCA9IGNlbGw/LmRlbHRhQ2VsbERlY29yYXRpb25zKFtdLCBbZGVjb3JhdGlvbi5vcHRpb25zXSkgfHwgW107XG5cdFx0XHRcdHJldC5mb3JFYWNoKGlkID0+IHtcblx0XHRcdFx0XHR0aGlzLl9kZWNvcmF0aW9uSWRUb0NlbGxNYXAuc2V0KGlkLCBkZWNvcmF0aW9uLmhhbmRsZSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXN1bHQucHVzaCguLi5yZXQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgaWQgPSArK3RoaXMuX2xhc3RPdmVydmlld1J1bGVyRGVjb3JhdGlvbklkO1xuXHRcdFx0XHRjb25zdCBkZWNvcmF0aW9uSWQgPSBgX292ZXJ2aWV3XyR7dGhpcy5pZH07JHtpZH1gO1xuXHRcdFx0XHR0aGlzLl9vdmVydmlld1J1bGVyRGVjb3JhdGlvbnMuc2V0KGRlY29yYXRpb25JZCwgZGVjb3JhdGlvbik7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKGRlY29yYXRpb25JZCk7XG5cdFx0XHR9XG5cblx0XHR9KTtcblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRkZWx0YUNlbGxTdGF0dXNCYXJJdGVtcyhvbGRJdGVtczogc3RyaW5nW10sIG5ld0l0ZW1zOiBJTm90ZWJvb2tEZWx0YUNlbGxTdGF0dXNCYXJJdGVtc1tdKTogc3RyaW5nW10ge1xuXHRcdGNvbnN0IGRlbGV0ZXNCeUhhbmRsZSA9IGdyb3VwQnkob2xkSXRlbXMsIGlkID0+IHRoaXMuX3N0YXR1c0Jhckl0ZW1JZFRvQ2VsbE1hcC5nZXQoaWQpID8/IC0xKTtcblxuXHRcdGNvbnN0IHJlc3VsdDogc3RyaW5nW10gPSBbXTtcblx0XHRuZXdJdGVtcy5mb3JFYWNoKGl0ZW1EZWx0YSA9PiB7XG5cdFx0XHRjb25zdCBjZWxsID0gdGhpcy5nZXRDZWxsQnlIYW5kbGUoaXRlbURlbHRhLmhhbmRsZSk7XG5cdFx0XHRjb25zdCBkZWxldGVkID0gZGVsZXRlc0J5SGFuZGxlW2l0ZW1EZWx0YS5oYW5kbGVdID8/IFtdO1xuXHRcdFx0ZGVsZXRlIGRlbGV0ZXNCeUhhbmRsZVtpdGVtRGVsdGEuaGFuZGxlXTtcblx0XHRcdGRlbGV0ZWQuZm9yRWFjaChpZCA9PiB0aGlzLl9zdGF0dXNCYXJJdGVtSWRUb0NlbGxNYXAuZGVsZXRlKGlkKSk7XG5cblx0XHRcdGNvbnN0IHJldCA9IGNlbGw/LmRlbHRhQ2VsbFN0YXR1c0Jhckl0ZW1zKGRlbGV0ZWQsIGl0ZW1EZWx0YS5pdGVtcykgfHwgW107XG5cdFx0XHRyZXQuZm9yRWFjaChpZCA9PiB7XG5cdFx0XHRcdHRoaXMuX3N0YXR1c0Jhckl0ZW1JZFRvQ2VsbE1hcC5zZXQoaWQsIGl0ZW1EZWx0YS5oYW5kbGUpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHJlc3VsdC5wdXNoKC4uLnJldCk7XG5cdFx0fSk7XG5cblx0XHRmb3IgKGNvbnN0IF9oYW5kbGUgaW4gZGVsZXRlc0J5SGFuZGxlKSB7XG5cdFx0XHRjb25zdCBoYW5kbGUgPSBwYXJzZUludChfaGFuZGxlKTtcblx0XHRcdGNvbnN0IGlkcyA9IGRlbGV0ZXNCeUhhbmRsZVtoYW5kbGVdO1xuXHRcdFx0Y29uc3QgY2VsbCA9IHRoaXMuZ2V0Q2VsbEJ5SGFuZGxlKGhhbmRsZSk7XG5cdFx0XHRjZWxsPy5kZWx0YUNlbGxTdGF0dXNCYXJJdGVtcyhpZHMsIFtdKTtcblx0XHRcdGlkcy5mb3JFYWNoKGlkID0+IHRoaXMuX3N0YXR1c0Jhckl0ZW1JZFRvQ2VsbE1hcC5kZWxldGUoaWQpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0bmVhcmVzdENvZGVDZWxsSW5kZXgoaW5kZXg6IG51bWJlciAvKiBleGNsdXNpdmUgKi8pIHtcblx0XHRjb25zdCBuZWFyZXN0ID0gdGhpcy52aWV3Q2VsbHMuc2xpY2UoMCwgaW5kZXgpLnJldmVyc2UoKS5maW5kSW5kZXgoY2VsbCA9PiBjZWxsLmNlbGxLaW5kID09PSBDZWxsS2luZC5Db2RlKTtcblx0XHRpZiAobmVhcmVzdCA+IC0xKSB7XG5cdFx0XHRyZXR1cm4gaW5kZXggLSBuZWFyZXN0IC0gMTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgbmVhcmVzdENlbGxUaGVPdGhlckRpcmVjdGlvbiA9IHRoaXMudmlld0NlbGxzLnNsaWNlKGluZGV4ICsgMSkuZmluZEluZGV4KGNlbGwgPT4gY2VsbC5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuQ29kZSk7XG5cdFx0XHRpZiAobmVhcmVzdENlbGxUaGVPdGhlckRpcmVjdGlvbiA+IC0xKSB7XG5cdFx0XHRcdHJldHVybiBpbmRleCArIDEgKyBuZWFyZXN0Q2VsbFRoZU90aGVyRGlyZWN0aW9uO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH1cblx0fVxuXG5cdGdldEVkaXRvclZpZXdTdGF0ZSgpOiBJTm90ZWJvb2tFZGl0b3JWaWV3U3RhdGUge1xuXHRcdGNvbnN0IGVkaXRpbmdDZWxsczogeyBba2V5OiBudW1iZXJdOiBib29sZWFuIH0gPSB7fTtcblx0XHRjb25zdCBjb2xsYXBzZWRJbnB1dENlbGxzOiB7IFtrZXk6IG51bWJlcl06IGJvb2xlYW4gfSA9IHt9O1xuXHRcdGNvbnN0IGNvbGxhcHNlZE91dHB1dENlbGxzOiB7IFtrZXk6IG51bWJlcl06IGJvb2xlYW4gfSA9IHt9O1xuXHRcdGNvbnN0IGNlbGxMaW5lTnVtYmVyU3RhdGVzOiB7IFtrZXk6IG51bWJlcl06ICdvbicgfCAnb2ZmJyB9ID0ge307XG5cblx0XHR0aGlzLl92aWV3Q2VsbHMuZm9yRWFjaCgoY2VsbCwgaSkgPT4ge1xuXHRcdFx0aWYgKGNlbGwuZ2V0RWRpdFN0YXRlKCkgPT09IENlbGxFZGl0U3RhdGUuRWRpdGluZykge1xuXHRcdFx0XHRlZGl0aW5nQ2VsbHNbaV0gPSB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY2VsbC5pc0lucHV0Q29sbGFwc2VkKSB7XG5cdFx0XHRcdGNvbGxhcHNlZElucHV0Q2VsbHNbaV0gPSB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY2VsbCBpbnN0YW5jZW9mIENvZGVDZWxsVmlld01vZGVsICYmIGNlbGwuaXNPdXRwdXRDb2xsYXBzZWQpIHtcblx0XHRcdFx0Y29sbGFwc2VkT3V0cHV0Q2VsbHNbaV0gPSB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY2VsbC5saW5lTnVtYmVycyAhPT0gJ2luaGVyaXQnKSB7XG5cdFx0XHRcdGNlbGxMaW5lTnVtYmVyU3RhdGVzW2ldID0gY2VsbC5saW5lTnVtYmVycztcblx0XHRcdH1cblx0XHR9KTtcblx0XHRjb25zdCBlZGl0b3JWaWV3U3RhdGVzOiB7IFtrZXk6IG51bWJlcl06IGVkaXRvckNvbW1vbi5JQ29kZUVkaXRvclZpZXdTdGF0ZSB9ID0ge307XG5cdFx0dGhpcy5fdmlld0NlbGxzLm1hcChjZWxsID0+ICh7IGhhbmRsZTogY2VsbC5tb2RlbC5oYW5kbGUsIHN0YXRlOiBjZWxsLnNhdmVFZGl0b3JWaWV3U3RhdGUoKSB9KSkuZm9yRWFjaCgodmlld1N0YXRlLCBpKSA9PiB7XG5cdFx0XHRpZiAodmlld1N0YXRlLnN0YXRlKSB7XG5cdFx0XHRcdGVkaXRvclZpZXdTdGF0ZXNbaV0gPSB2aWV3U3RhdGUuc3RhdGU7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZWRpdGluZ0NlbGxzLFxuXHRcdFx0ZWRpdG9yVmlld1N0YXRlcyxcblx0XHRcdGNlbGxMaW5lTnVtYmVyU3RhdGVzLFxuXHRcdFx0Y29sbGFwc2VkSW5wdXRDZWxscyxcblx0XHRcdGNvbGxhcHNlZE91dHB1dENlbGxzXG5cdFx0fTtcblx0fVxuXG5cdHJlc3RvcmVFZGl0b3JWaWV3U3RhdGUodmlld1N0YXRlOiBJTm90ZWJvb2tFZGl0b3JWaWV3U3RhdGUgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAoIXZpZXdTdGF0ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3ZpZXdDZWxscy5mb3JFYWNoKChjZWxsLCBpbmRleCkgPT4ge1xuXHRcdFx0Y29uc3QgaXNFZGl0aW5nID0gdmlld1N0YXRlLmVkaXRpbmdDZWxscyAmJiB2aWV3U3RhdGUuZWRpdGluZ0NlbGxzW2luZGV4XTtcblx0XHRcdGNvbnN0IGVkaXRvclZpZXdTdGF0ZSA9IHZpZXdTdGF0ZS5lZGl0b3JWaWV3U3RhdGVzICYmIHZpZXdTdGF0ZS5lZGl0b3JWaWV3U3RhdGVzW2luZGV4XTtcblxuXHRcdFx0Y2VsbC51cGRhdGVFZGl0U3RhdGUoaXNFZGl0aW5nID8gQ2VsbEVkaXRTdGF0ZS5FZGl0aW5nIDogQ2VsbEVkaXRTdGF0ZS5QcmV2aWV3LCAndmlld1N0YXRlJyk7XG5cdFx0XHRjb25zdCBjZWxsSGVpZ2h0ID0gdmlld1N0YXRlLmNlbGxUb3RhbEhlaWdodHMgPyB2aWV3U3RhdGUuY2VsbFRvdGFsSGVpZ2h0c1tpbmRleF0gOiB1bmRlZmluZWQ7XG5cdFx0XHRjZWxsLnJlc3RvcmVFZGl0b3JWaWV3U3RhdGUoZWRpdG9yVmlld1N0YXRlLCBjZWxsSGVpZ2h0KTtcblx0XHRcdGlmICh2aWV3U3RhdGUuY29sbGFwc2VkSW5wdXRDZWxscyAmJiB2aWV3U3RhdGUuY29sbGFwc2VkSW5wdXRDZWxsc1tpbmRleF0pIHtcblx0XHRcdFx0Y2VsbC5pc0lucHV0Q29sbGFwc2VkID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICh2aWV3U3RhdGUuY29sbGFwc2VkT3V0cHV0Q2VsbHMgJiYgdmlld1N0YXRlLmNvbGxhcHNlZE91dHB1dENlbGxzW2luZGV4XSAmJiBjZWxsIGluc3RhbmNlb2YgQ29kZUNlbGxWaWV3TW9kZWwpIHtcblx0XHRcdFx0Y2VsbC5pc091dHB1dENvbGxhcHNlZCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAodmlld1N0YXRlLmNlbGxMaW5lTnVtYmVyU3RhdGVzICYmIHZpZXdTdGF0ZS5jZWxsTGluZU51bWJlclN0YXRlc1tpbmRleF0pIHtcblx0XHRcdFx0Y2VsbC5saW5lTnVtYmVycyA9IHZpZXdTdGF0ZS5jZWxsTGluZU51bWJlclN0YXRlc1tpbmRleF07XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICogRWRpdG9yIGRlY29yYXRpb25zIGFjcm9zcyBjZWxscy4gRm9yIGV4YW1wbGUsIGZpbmQgZGVjb3JhdGlvbnMgZm9yIG11bHRpcGxlIGNvZGUgY2VsbHNcblx0ICogVGhlIHJlYXNvbiB0aGF0IHdlIGNhbid0IGNvbXBsZXRlbHkgZGVsZWdhdGUgdGhpcyB0byBDb2RlRWRpdG9yV2lkZ2V0IGlzIG1vc3Qgb2YgdGhlIHRpbWUsIHRoZSBlZGl0b3JzIGZvciBjZWxscyBhcmUgbm90IGNyZWF0ZWQgeWV0IGJ1dCB3ZSBhbHJlYWR5IGhhdmUgZGVjb3JhdGlvbnMgZm9yIHRoZW0uXG5cdCAqL1xuXHRjaGFuZ2VNb2RlbERlY29yYXRpb25zPFQ+KGNhbGxiYWNrOiAoY2hhbmdlQWNjZXNzb3I6IElNb2RlbERlY29yYXRpb25zQ2hhbmdlQWNjZXNzb3IpID0+IFQpOiBUIHwgbnVsbCB7XG5cdFx0Y29uc3QgY2hhbmdlQWNjZXNzb3I6IElNb2RlbERlY29yYXRpb25zQ2hhbmdlQWNjZXNzb3IgPSB7XG5cdFx0XHRkZWx0YURlY29yYXRpb25zOiAob2xkRGVjb3JhdGlvbnM6IElDZWxsTW9kZWxEZWNvcmF0aW9uc1tdLCBuZXdEZWNvcmF0aW9uczogSUNlbGxNb2RlbERlbHRhRGVjb3JhdGlvbnNbXSk6IElDZWxsTW9kZWxEZWNvcmF0aW9uc1tdID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX2RlbHRhTW9kZWxEZWNvcmF0aW9uc0ltcGwob2xkRGVjb3JhdGlvbnMsIG5ld0RlY29yYXRpb25zKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0bGV0IHJlc3VsdDogVCB8IG51bGwgPSBudWxsO1xuXHRcdHRyeSB7XG5cdFx0XHRyZXN1bHQgPSBjYWxsYmFjayhjaGFuZ2VBY2Nlc3Nvcik7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZSk7XG5cdFx0fVxuXG5cdFx0Y2hhbmdlQWNjZXNzb3IuZGVsdGFEZWNvcmF0aW9ucyA9IGludmFsaWRGdW5jO1xuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgX2RlbHRhTW9kZWxEZWNvcmF0aW9uc0ltcGwob2xkRGVjb3JhdGlvbnM6IElDZWxsTW9kZWxEZWNvcmF0aW9uc1tdLCBuZXdEZWNvcmF0aW9uczogSUNlbGxNb2RlbERlbHRhRGVjb3JhdGlvbnNbXSk6IElDZWxsTW9kZWxEZWNvcmF0aW9uc1tdIHtcblxuXHRcdGNvbnN0IG1hcHBpbmcgPSBuZXcgTWFwPG51bWJlciwgeyBjZWxsOiBDZWxsVmlld01vZGVsOyBvbGREZWNvcmF0aW9uczogcmVhZG9ubHkgc3RyaW5nW107IG5ld0RlY29yYXRpb25zOiByZWFkb25seSBJTW9kZWxEZWx0YURlY29yYXRpb25bXSB9PigpO1xuXHRcdG9sZERlY29yYXRpb25zLmZvckVhY2gob2xkRGVjb3JhdGlvbiA9PiB7XG5cdFx0XHRjb25zdCBvd25lcklkID0gb2xkRGVjb3JhdGlvbi5vd25lcklkO1xuXG5cdFx0XHRpZiAoIW1hcHBpbmcuaGFzKG93bmVySWQpKSB7XG5cdFx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLl92aWV3Q2VsbHMuZmluZChjZWxsID0+IGNlbGwuaGFuZGxlID09PSBvd25lcklkKTtcblx0XHRcdFx0aWYgKGNlbGwpIHtcblx0XHRcdFx0XHRtYXBwaW5nLnNldChvd25lcklkLCB7IGNlbGw6IGNlbGwsIG9sZERlY29yYXRpb25zOiBbXSwgbmV3RGVjb3JhdGlvbnM6IFtdIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGRhdGEgPSBtYXBwaW5nLmdldChvd25lcklkKSE7XG5cdFx0XHRpZiAoZGF0YSkge1xuXHRcdFx0XHRkYXRhLm9sZERlY29yYXRpb25zID0gb2xkRGVjb3JhdGlvbi5kZWNvcmF0aW9ucztcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdG5ld0RlY29yYXRpb25zLmZvckVhY2gobmV3RGVjb3JhdGlvbiA9PiB7XG5cdFx0XHRjb25zdCBvd25lcklkID0gbmV3RGVjb3JhdGlvbi5vd25lcklkO1xuXG5cdFx0XHRpZiAoIW1hcHBpbmcuaGFzKG93bmVySWQpKSB7XG5cdFx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLl92aWV3Q2VsbHMuZmluZChjZWxsID0+IGNlbGwuaGFuZGxlID09PSBvd25lcklkKTtcblxuXHRcdFx0XHRpZiAoY2VsbCkge1xuXHRcdFx0XHRcdG1hcHBpbmcuc2V0KG93bmVySWQsIHsgY2VsbDogY2VsbCwgb2xkRGVjb3JhdGlvbnM6IFtdLCBuZXdEZWNvcmF0aW9uczogW10gfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZGF0YSA9IG1hcHBpbmcuZ2V0KG93bmVySWQpITtcblx0XHRcdGlmIChkYXRhKSB7XG5cdFx0XHRcdGRhdGEubmV3RGVjb3JhdGlvbnMgPSBuZXdEZWNvcmF0aW9uLmRlY29yYXRpb25zO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgcmV0OiBJQ2VsbE1vZGVsRGVjb3JhdGlvbnNbXSA9IFtdO1xuXHRcdG1hcHBpbmcuZm9yRWFjaCgodmFsdWUsIG93bmVySWQpID0+IHtcblx0XHRcdGNvbnN0IGNlbGxSZXQgPSB2YWx1ZS5jZWxsLmRlbHRhTW9kZWxEZWNvcmF0aW9ucyh2YWx1ZS5vbGREZWNvcmF0aW9ucywgdmFsdWUubmV3RGVjb3JhdGlvbnMpO1xuXHRcdFx0cmV0LnB1c2goe1xuXHRcdFx0XHRvd25lcklkOiBvd25lcklkLFxuXHRcdFx0XHRkZWNvcmF0aW9uczogY2VsbFJldFxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gcmV0O1xuXHR9XG5cblx0Ly8jcmVnaW9uIEZpbmRcblx0ZmluZCh2YWx1ZTogc3RyaW5nLCBvcHRpb25zOiBJTm90ZWJvb2tGaW5kT3B0aW9ucyk6IENlbGxGaW5kTWF0Y2hXaXRoSW5kZXhbXSB7XG5cdFx0Y29uc3QgbWF0Y2hlczogQ2VsbEZpbmRNYXRjaFdpdGhJbmRleFtdID0gW107XG5cdFx0bGV0IGZpbmRDZWxsczogQ2VsbFZpZXdNb2RlbFtdID0gW107XG5cblx0XHRpZiAob3B0aW9ucy5maW5kU2NvcGUgJiYgKG9wdGlvbnMuZmluZFNjb3BlLmZpbmRTY29wZVR5cGUgPT09IE5vdGVib29rRmluZFNjb3BlVHlwZS5DZWxscyB8fCBvcHRpb25zLmZpbmRTY29wZS5maW5kU2NvcGVUeXBlID09PSBOb3RlYm9va0ZpbmRTY29wZVR5cGUuVGV4dCkpIHtcblx0XHRcdGNvbnN0IHNlbGVjdGVkUmFuZ2VzID0gb3B0aW9ucy5maW5kU2NvcGUuc2VsZWN0ZWRDZWxsUmFuZ2VzPy5tYXAocmFuZ2UgPT4gdGhpcy52YWxpZGF0ZVJhbmdlKHJhbmdlKSkuZmlsdGVyKHJhbmdlID0+ICEhcmFuZ2UpID8/IFtdO1xuXHRcdFx0Y29uc3Qgc2VsZWN0ZWRJbmRleGVzID0gY2VsbFJhbmdlc1RvSW5kZXhlcyhzZWxlY3RlZFJhbmdlcyk7XG5cdFx0XHRmaW5kQ2VsbHMgPSBzZWxlY3RlZEluZGV4ZXMubWFwKGluZGV4ID0+IHRoaXMuX3ZpZXdDZWxsc1tpbmRleF0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRmaW5kQ2VsbHMgPSB0aGlzLl92aWV3Q2VsbHM7XG5cdFx0fVxuXG5cdFx0ZmluZENlbGxzLmZvckVhY2goKGNlbGwsIGluZGV4KSA9PiB7XG5cdFx0XHRjb25zdCBjZWxsTWF0Y2hlcyA9IGNlbGwuc3RhcnRGaW5kKHZhbHVlLCBvcHRpb25zKTtcblx0XHRcdGlmIChjZWxsTWF0Y2hlcykge1xuXHRcdFx0XHRtYXRjaGVzLnB1c2gobmV3IENlbGxGaW5kTWF0Y2hNb2RlbChcblx0XHRcdFx0XHRjZWxsTWF0Y2hlcy5jZWxsLFxuXHRcdFx0XHRcdGluZGV4LFxuXHRcdFx0XHRcdGNlbGxNYXRjaGVzLmNvbnRlbnRNYXRjaGVzLFxuXHRcdFx0XHRcdFtdXG5cdFx0XHRcdCkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Ly8gZmlsdGVyIGJhc2VkIG9uIG9wdGlvbnMgYW5kIGVkaXRpbmcgc3RhdGVcblxuXHRcdHJldHVybiBtYXRjaGVzLmZpbHRlcihtYXRjaCA9PiB7XG5cdFx0XHRpZiAobWF0Y2guY2VsbC5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuQ29kZSkge1xuXHRcdFx0XHQvLyBjb2RlIGNlbGwsIHdlIG9ubHkgaW5jbHVkZSBpdHMgbWF0Y2ggaWYgaW5jbHVkZSBpbnB1dCBpcyBlbmFibGVkXG5cdFx0XHRcdHJldHVybiBvcHRpb25zLmluY2x1ZGVDb2RlSW5wdXQ7XG5cdFx0XHR9XG5cblx0XHRcdC8vIG1hcmt1cCBjZWxsLCBpdCBkZXBlbmRzIG9uIHRoZSBlZGl0aW5nIHN0YXRlXG5cdFx0XHRpZiAobWF0Y2guY2VsbC5nZXRFZGl0U3RhdGUoKSA9PT0gQ2VsbEVkaXRTdGF0ZS5FZGl0aW5nKSB7XG5cdFx0XHRcdC8vIGVkaXRpbmcsIGV2ZW4gaWYgd2UgaW5jbHVkZU1hcmt1cFByZXZpZXdcblx0XHRcdFx0cmV0dXJuIG9wdGlvbnMuaW5jbHVkZU1hcmt1cElucHV0O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gY2VsbCBpbiBwcmV2aWV3IG1vZGUsIHdlIHNob3VsZCBvbmx5IGluY2x1ZGUgaXQgaWYgaW5jbHVkZU1hcmt1cFByZXZpZXcgaXMgZmFsc2UgYnV0IGluY2x1ZGVNYXJrdXBJbnB1dCBpcyB0cnVlXG5cdFx0XHRcdC8vIGlmIGluY2x1ZGVNYXJrdXBQcmV2aWV3IGlzIHRydWUsIHRoZW4gd2Ugc2hvdWxkIGluY2x1ZGUgdGhlIHdlYnZpZXcgbWF0Y2ggcmVzdWx0IG90aGVyIHRoYW4gdGhpc1xuXHRcdFx0XHRyZXR1cm4gIW9wdGlvbnMuaW5jbHVkZU1hcmt1cFByZXZpZXcgJiYgb3B0aW9ucy5pbmNsdWRlTWFya3VwSW5wdXQ7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdCk7XG5cdH1cblxuXHRyZXBsYWNlT25lKGNlbGw6IElDZWxsVmlld01vZGVsLCByYW5nZTogUmFuZ2UsIHRleHQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHZpZXdDZWxsID0gY2VsbCBhcyBDZWxsVmlld01vZGVsO1xuXHRcdHRoaXMuX2xhc3ROb3RlYm9va0VkaXRSZXNvdXJjZS5wdXNoKHZpZXdDZWxsLnVyaSk7XG5cdFx0cmV0dXJuIHZpZXdDZWxsLnJlc29sdmVUZXh0TW9kZWwoKS50aGVuKCgpID0+IHtcblx0XHRcdHRoaXMuX2J1bGtFZGl0U2VydmljZS5hcHBseShcblx0XHRcdFx0W25ldyBSZXNvdXJjZVRleHRFZGl0KGNlbGwudXJpLCB7IHJhbmdlLCB0ZXh0IH0pXSxcblx0XHRcdFx0eyBxdW90YWJsZUxhYmVsOiAnTm90ZWJvb2sgUmVwbGFjZScgfVxuXHRcdFx0KTtcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJlcGxhY2VBbGwobWF0Y2hlczogQ2VsbEZpbmRNYXRjaFdpdGhJbmRleFtdLCB0ZXh0czogc3RyaW5nW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIW1hdGNoZXMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGV4dEVkaXRzOiBJV29ya3NwYWNlVGV4dEVkaXRbXSA9IFtdO1xuXHRcdHRoaXMuX2xhc3ROb3RlYm9va0VkaXRSZXNvdXJjZS5wdXNoKG1hdGNoZXNbMF0uY2VsbC51cmkpO1xuXG5cdFx0bWF0Y2hlcy5mb3JFYWNoKG1hdGNoID0+IHtcblx0XHRcdG1hdGNoLmNvbnRlbnRNYXRjaGVzLmZvckVhY2goKHNpbmdsZU1hdGNoLCBpbmRleCkgPT4ge1xuXHRcdFx0XHR0ZXh0RWRpdHMucHVzaCh7XG5cdFx0XHRcdFx0dmVyc2lvbklkOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0dGV4dEVkaXQ6IHsgcmFuZ2U6IChzaW5nbGVNYXRjaCBhcyBGaW5kTWF0Y2gpLnJhbmdlLCB0ZXh0OiB0ZXh0c1tpbmRleF0gfSxcblx0XHRcdFx0XHRyZXNvdXJjZTogbWF0Y2guY2VsbC51cmlcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBQcm9taXNlLmFsbChtYXRjaGVzLm1hcChtYXRjaCA9PiB7XG5cdFx0XHRyZXR1cm4gbWF0Y2guY2VsbC5yZXNvbHZlVGV4dE1vZGVsKCk7XG5cdFx0fSkpLnRoZW4oYXN5bmMgKCkgPT4ge1xuXHRcdFx0dGhpcy5fYnVsa0VkaXRTZXJ2aWNlLmFwcGx5KHsgZWRpdHM6IHRleHRFZGl0cyB9LCB7IHF1b3RhYmxlTGFiZWw6ICdOb3RlYm9vayBSZXBsYWNlIEFsbCcgfSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fSk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gVW5kby9SZWRvXG5cblx0cHJpdmF0ZSBhc3luYyBfd2l0aEVsZW1lbnQoZWxlbWVudDogU2luZ2xlTW9kZWxFZGl0U3RhY2tFbGVtZW50IHwgTXVsdGlNb2RlbEVkaXRTdGFja0VsZW1lbnQsIGNhbGxiYWNrOiAoKSA9PiBQcm9taXNlPHZvaWQ+KSB7XG5cdFx0Y29uc3Qgdmlld0NlbGxzID0gdGhpcy5fdmlld0NlbGxzLmZpbHRlcihjZWxsID0+IGVsZW1lbnQubWF0Y2hlc1Jlc291cmNlKGNlbGwudXJpKSk7XG5cdFx0Y29uc3QgcmVmcyA9IGF3YWl0IFByb21pc2UuYWxsKHZpZXdDZWxscy5tYXAoY2VsbCA9PiB0aGlzLl90ZXh0TW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKGNlbGwudXJpKSkpO1xuXHRcdGF3YWl0IGNhbGxiYWNrKCk7XG5cdFx0cmVmcy5mb3JFYWNoKHJlZiA9PiByZWYuZGlzcG9zZSgpKTtcblx0fVxuXG5cdGFzeW5jIHVuZG8oKSB7XG5cblx0XHRjb25zdCBlZGl0U3RhY2sgPSB0aGlzLl91bmRvU2VydmljZS5nZXRFbGVtZW50cyh0aGlzLnVyaSk7XG5cdFx0Y29uc3QgZWxlbWVudCA9IGVkaXRTdGFjay5wYXN0Lmxlbmd0aCA/IGVkaXRTdGFjay5wYXN0W2VkaXRTdGFjay5wYXN0Lmxlbmd0aCAtIDFdIDogdW5kZWZpbmVkO1xuXG5cdFx0aWYgKGVsZW1lbnQgJiYgZWxlbWVudCBpbnN0YW5jZW9mIFNpbmdsZU1vZGVsRWRpdFN0YWNrRWxlbWVudCB8fCBlbGVtZW50IGluc3RhbmNlb2YgTXVsdGlNb2RlbEVkaXRTdGFja0VsZW1lbnQpIHtcblx0XHRcdGF3YWl0IHRoaXMuX3dpdGhFbGVtZW50KGVsZW1lbnQsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5fdW5kb1NlcnZpY2UudW5kbyh0aGlzLnVyaSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuIChlbGVtZW50IGluc3RhbmNlb2YgU2luZ2xlTW9kZWxFZGl0U3RhY2tFbGVtZW50KSA/IFtlbGVtZW50LnJlc291cmNlXSA6IGVsZW1lbnQucmVzb3VyY2VzO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMuX3VuZG9TZXJ2aWNlLnVuZG8odGhpcy51cmkpO1xuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdGFzeW5jIHJlZG8oKSB7XG5cblx0XHRjb25zdCBlZGl0U3RhY2sgPSB0aGlzLl91bmRvU2VydmljZS5nZXRFbGVtZW50cyh0aGlzLnVyaSk7XG5cdFx0Y29uc3QgZWxlbWVudCA9IGVkaXRTdGFjay5mdXR1cmVbMF07XG5cblx0XHRpZiAoZWxlbWVudCAmJiBlbGVtZW50IGluc3RhbmNlb2YgU2luZ2xlTW9kZWxFZGl0U3RhY2tFbGVtZW50IHx8IGVsZW1lbnQgaW5zdGFuY2VvZiBNdWx0aU1vZGVsRWRpdFN0YWNrRWxlbWVudCkge1xuXHRcdFx0YXdhaXQgdGhpcy5fd2l0aEVsZW1lbnQoZWxlbWVudCwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRhd2FpdCB0aGlzLl91bmRvU2VydmljZS5yZWRvKHRoaXMudXJpKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gKGVsZW1lbnQgaW5zdGFuY2VvZiBTaW5nbGVNb2RlbEVkaXRTdGFja0VsZW1lbnQpID8gW2VsZW1lbnQucmVzb3VyY2VdIDogZWxlbWVudC5yZXNvdXJjZXM7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5fdW5kb1NlcnZpY2UucmVkbyh0aGlzLnVyaSk7XG5cblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHRlcXVhbChub3RlYm9vazogTm90ZWJvb2tUZXh0TW9kZWwpIHtcblx0XHRyZXR1cm4gdGhpcy5fbm90ZWJvb2sgPT09IG5vdGVib29rO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHR0aGlzLl9sb2NhbFN0b3JlLmNsZWFyKCk7XG5cdFx0dGhpcy5fdmlld0NlbGxzLmZvckVhY2goY2VsbCA9PiB7XG5cdFx0XHRjZWxsLmRpc3Bvc2UoKTtcblx0XHR9KTtcblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5leHBvcnQgdHlwZSBDZWxsVmlld01vZGVsID0gKENvZGVDZWxsVmlld01vZGVsIHwgTWFya3VwQ2VsbFZpZXdNb2RlbCkgJiBJQ2VsbFZpZXdNb2RlbDtcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNlbGxWaWV3TW9kZWwoaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSwgbm90ZWJvb2tWaWV3TW9kZWw6IE5vdGVib29rVmlld01vZGVsLCBjZWxsOiBOb3RlYm9va0NlbGxUZXh0TW9kZWwsIHZpZXdDb250ZXh0OiBWaWV3Q29udGV4dCkge1xuXHRpZiAoY2VsbC5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuQ29kZSkge1xuXHRcdHJldHVybiBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb2RlQ2VsbFZpZXdNb2RlbCwgbm90ZWJvb2tWaWV3TW9kZWwudmlld1R5cGUsIGNlbGwsIG5vdGVib29rVmlld01vZGVsLmxheW91dEluZm8sIHZpZXdDb250ZXh0KTtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWFya3VwQ2VsbFZpZXdNb2RlbCwgbm90ZWJvb2tWaWV3TW9kZWwudmlld1R5cGUsIGNlbGwsIG5vdGVib29rVmlld01vZGVsLmxheW91dEluZm8sIG5vdGVib29rVmlld01vZGVsLCB2aWV3Q29udGV4dCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxlQUFlO0FBQ3hCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZUFBc0I7QUFDL0IsU0FBUyxZQUFZLHVCQUF1QjtBQUM1QyxTQUFTLGFBQWE7QUFDdEIsWUFBWSxhQUFhO0FBRXpCLFNBQVMsa0JBQWtCLHdCQUF3QjtBQUNuRCxTQUFTLGFBQWE7QUFHdEIsU0FBb0UsOEJBQThCO0FBQ2xHLFNBQVMsNEJBQTRCLG1DQUFtQztBQUN4RSxTQUFTLGNBQWMsb0JBQW9CO0FBQzNDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMseUJBQXlCO0FBRWxDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsZUFBdUMsa0JBQTJSLGdDQUFrRTtBQUM3WSxTQUE2QixvQ0FBb0M7QUFDakUsU0FBUyx1Q0FBdUM7QUFDaEQsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUywyQkFBMkI7QUFJcEMsU0FBUyxVQUF3RCx5QkFBc0QsdUJBQXVCLDBCQUEwQjtBQUN4SyxTQUFTLGdDQUFnQyw2QkFBNkI7QUFDdEUsU0FBUyxxQkFBcUIscUJBQWlDLHdCQUF3QjtBQUV2RixNQUFNLGNBQWMsTUFBTTtBQUFFLFFBQU0sSUFBSSxNQUFNLHlCQUF5QjtBQUFHO0FBRXhFLE1BQU0sZ0JBQWdCO0FBQUEsRUFHckIsY0FBYztBQUNiLFNBQUssbUJBQW1CLElBQUksYUFBYTtBQUFBLEVBQzFDO0FBQUEsRUFFTyxlQUFlLE9BQWUsS0FBYSxlQUF1QixxQkFBOEIsaUJBQXlCLHdCQUFpQyxPQUF1QjtBQUN2TCxV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
