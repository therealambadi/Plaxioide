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
import { LcsDiff } from "../../../../../base/common/diff/diff.js";
import { Emitter, PauseableEmitter } from "../../../../../base/common/event.js";
import { hash } from "../../../../../base/common/hash.js";
import { Disposable, dispose } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { filter } from "../../../../../base/common/objects.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { isDefined } from "../../../../../base/common/types.js";
import { Position } from "../../../../../editor/common/core/position.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { TextModel } from "../../../../../editor/common/model/textModel.js";
import { SearchParams } from "../../../../../editor/common/model/textModelSearch.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { IUndoRedoService, UndoRedoElementType } from "../../../../../platform/undoRedo/common/undoRedo.js";
import { ILanguageDetectionService } from "../../../../services/languageDetection/common/languageDetectionWorkerService.js";
import { SnapshotContext } from "../../../../services/workingCopy/common/fileWorkingCopy.js";
import { CellEditType, CellKind, CellUri, diff, NotebookCellExecutionState, NotebookCellsChangeType } from "../notebookCommon.js";
import { INotebookExecutionStateService } from "../notebookExecutionStateService.js";
import { CellMetadataEdit, MoveCellEdit, SpliceCellsEdit } from "./cellEdit.js";
import { NotebookCellOutputTextModel } from "./notebookCellOutputTextModel.js";
import { NotebookCellTextModel } from "./notebookCellTextModel.js";
class StackOperation {
  constructor(textModel, undoRedoGroup, _pauseableEmitter, _postUndoRedo, selectionState, beginAlternativeVersionId) {
    this.textModel = textModel;
    this.undoRedoGroup = undoRedoGroup;
    this._pauseableEmitter = _pauseableEmitter;
    this._postUndoRedo = _postUndoRedo;
    this.tag = "notebookUndoRedoElement";
    this._operations = [];
    this._beginSelectionState = void 0;
    this._resultSelectionState = void 0;
    this.type = UndoRedoElementType.Workspace;
    this._beginSelectionState = selectionState;
    this._beginAlternativeVersionId = beginAlternativeVersionId;
    this._resultAlternativeVersionId = beginAlternativeVersionId;
  }
  get code() {
    return this._operations.length === 1 ? this._operations[0].code : "undoredo.notebooks.stackOperation";
  }
  get label() {
    return this._operations.length === 1 ? this._operations[0].label : "edit";
  }
  get resources() {
    return [this.textModel.uri];
  }
  get isEmpty() {
    return this._operations.length === 0;
  }
  pushEndState(alternativeVersionId, selectionState) {
    this._resultAlternativeVersionId = alternativeVersionId;
    this._resultSelectionState = selectionState || this._resultSelectionState;
  }
  pushEditOperation(element, beginSelectionState, resultSelectionState, alternativeVersionId) {
    if (this._operations.length === 0) {
      this._beginSelectionState = this._beginSelectionState ?? beginSelectionState;
    }
    this._operations.push(element);
    this._resultSelectionState = resultSelectionState;
    this._resultAlternativeVersionId = alternativeVersionId;
  }
  async undo() {
    this._pauseableEmitter.pause();
    try {
      for (let i = this._operations.length - 1; i >= 0; i--) {
        await this._operations[i].undo();
      }
      this._postUndoRedo(this._beginAlternativeVersionId);
      this._pauseableEmitter.fire({
        rawEvents: [],
        synchronous: void 0,
        versionId: this.textModel.versionId,
        endSelectionState: this._beginSelectionState
      });
    } finally {
      this._pauseableEmitter.resume();
    }
  }
  async redo() {
    this._pauseableEmitter.pause();
    try {
      for (let i = 0; i < this._operations.length; i++) {
        await this._operations[i].redo();
      }
      this._postUndoRedo(this._resultAlternativeVersionId);
      this._pauseableEmitter.fire({
        rawEvents: [],
        synchronous: void 0,
        versionId: this.textModel.versionId,
        endSelectionState: this._resultSelectionState
      });
    } finally {
      this._pauseableEmitter.resume();
    }
  }
}
class NotebookOperationManager {
  constructor(_textModel, _undoService, _pauseableEmitter, _postUndoRedo) {
    this._textModel = _textModel;
    this._undoService = _undoService;
    this._pauseableEmitter = _pauseableEmitter;
    this._postUndoRedo = _postUndoRedo;
    this._pendingStackOperation = null;
    this._isAppending = false;
  }
  isUndoStackEmpty() {
    return this._pendingStackOperation === null || this._pendingStackOperation.isEmpty;
  }
  pushStackElement(alternativeVersionId, selectionState) {
    if (this._pendingStackOperation && !this._pendingStackOperation.isEmpty) {
      this._pendingStackOperation.pushEndState(alternativeVersionId, selectionState);
      if (!this._isAppending) {
        this._undoService.pushElement(this._pendingStackOperation, this._pendingStackOperation.undoRedoGroup);
      }
    }
    this._isAppending = false;
    this._pendingStackOperation = null;
  }
  _getOrCreateEditStackElement(beginSelectionState, undoRedoGroup, alternativeVersionId) {
    return this._pendingStackOperation ??= new StackOperation(this._textModel, undoRedoGroup, this._pauseableEmitter, this._postUndoRedo, beginSelectionState, alternativeVersionId || "");
  }
  appendPreviousOperation() {
    const previous = this._undoService.getLastElement(this._textModel.uri);
    if (previous && previous.tag === "notebookUndoRedoElement") {
      this._pendingStackOperation = previous;
      this._isAppending = true;
      return true;
    }
    return false;
  }
  pushEditOperation(element, beginSelectionState, resultSelectionState, alternativeVersionId, undoRedoGroup) {
    const pendingStackOperation = this._getOrCreateEditStackElement(beginSelectionState, undoRedoGroup, alternativeVersionId);
    pendingStackOperation.pushEditOperation(element, beginSelectionState, resultSelectionState, alternativeVersionId);
  }
}
class NotebookEventEmitter extends PauseableEmitter {
  get isEmpty() {
    return this._eventQueue.isEmpty();
  }
  isDirtyEvent() {
    for (const e of this._eventQueue) {
      for (let i = 0; i < e.rawEvents.length; i++) {
        if (!e.rawEvents[i].transient) {
          return true;
        }
      }
    }
    return false;
  }
}
let NotebookTextModel = class extends Disposable {
  constructor(viewType, uri, cells, metadata, options, _undoService, _modelService, _languageService, _languageDetectionService, _notebookExecutionStateService) {
    super();
    this.viewType = viewType;
    this.uri = uri;
    this._undoService = _undoService;
    this._modelService = _modelService;
    this._languageService = _languageService;
    this._languageDetectionService = _languageDetectionService;
    this._notebookExecutionStateService = _notebookExecutionStateService;
    this._isDisposed = false;
    this._onWillDispose = this._register(new Emitter());
    this._onWillAddRemoveCells = this._register(new Emitter());
    this._onDidChangeContent = this._register(new Emitter());
    this.onWillDispose = this._onWillDispose.event;
    this.onWillAddRemoveCells = this._onWillAddRemoveCells.event;
    this.onDidChangeContent = this._onDidChangeContent.event;
    this._cellhandlePool = 0;
    this._cellListeners = /* @__PURE__ */ new Map();
    this._cells = [];
    this.metadata = {};
    this.transientOptions = { transientCellMetadata: {}, transientDocumentMetadata: {}, transientOutputs: false, cellContentMetadata: {} };
    this._versionId = 0;
    /**
     * This alternative id is only for non-cell-content changes.
     */
    this._notebookSpecificAlternativeId = 0;
    /**
     * Unlike, versionId, this can go down (via undo) or go to previous values (via redo)
     */
    this._alternativeVersionId = "1";
    this.newCellsFromLastEdit = /* @__PURE__ */ new Set();
    this.transientOptions = options;
    this.metadata = metadata;
    this._initialize(cells);
    const maybeUpdateCellTextModel = (textModel) => {
      if (textModel.uri.scheme === Schemas.vscodeNotebookCell && textModel instanceof TextModel) {
        const cellUri = CellUri.parse(textModel.uri);
        if (cellUri && isEqual(cellUri.notebook, this.uri)) {
          const cellIdx = this._getCellIndexByHandle(cellUri.handle);
          if (cellIdx >= 0) {
            const cell = this.cells[cellIdx];
            if (cell) {
              cell.textModel = textModel;
            }
          }
        }
      }
    };
    this._register(_modelService.onModelAdded((e) => maybeUpdateCellTextModel(e)));
    this._pauseableEmitter = new NotebookEventEmitter({
      merge: (events) => {
        const first = events[0];
        const rawEvents = first.rawEvents;
        let versionId = first.versionId;
        let endSelectionState = first.endSelectionState;
        let synchronous = first.synchronous;
        for (let i = 1; i < events.length; i++) {
          rawEvents.push(...events[i].rawEvents);
          versionId = events[i].versionId;
          endSelectionState = events[i].endSelectionState !== void 0 ? events[i].endSelectionState : endSelectionState;
          synchronous = events[i].synchronous !== void 0 ? events[i].synchronous : synchronous;
        }
        return { rawEvents, versionId, endSelectionState, synchronous };
      }
    });
    this._register(this._pauseableEmitter.event((e) => {
      if (e.rawEvents.length) {
        this._onDidChangeContent.fire(e);
      }
    }));
    this._operationManager = new NotebookOperationManager(
      this,
      this._undoService,
      this._pauseableEmitter,
      (alternativeVersionId) => {
        this._increaseVersionId(true);
        this._overwriteAlternativeVersionId(alternativeVersionId);
      }
    );
  }
  get length() {
    return this._cells.length;
  }
  get cells() {
    return this._cells;
  }
  get versionId() {
    return this._versionId;
  }
  get alternativeVersionId() {
    return this._alternativeVersionId;
  }
  get notebookType() {
    return this.viewType;
  }
  setCellCollapseDefault(collapseConfig) {
    this._defaultCollapseConfig = collapseConfig;
  }
  _initialize(cells, triggerDirty) {
    this._cells = [];
    this._versionId = 0;
    this._notebookSpecificAlternativeId = 0;
    const mainCells = cells.map((cell) => {
      const cellHandle = this._cellhandlePool++;
      const cellUri = CellUri.generate(this.uri, cellHandle);
      const collapseState = this._getDefaultCollapseState(cell);
      return new NotebookCellTextModel(cellUri, cellHandle, cell.source, cell.language, cell.mime, cell.cellKind, cell.outputs, cell.metadata, cell.internalMetadata, collapseState, this.transientOptions, this._languageService, this._languageDetectionService);
    });
    for (let i = 0; i < mainCells.length; i++) {
      const dirtyStateListener = mainCells[i].onDidChangeContent((e) => {
        this._bindCellContentHandler(mainCells[i], e);
      });
      this._cellListeners.set(mainCells[i].handle, dirtyStateListener);
      this._register(mainCells[i]);
    }
    this._cells.splice(0, 0, ...mainCells);
    this._alternativeVersionId = this._generateAlternativeId();
    if (triggerDirty) {
      this._pauseableEmitter.fire({
        rawEvents: [{ kind: NotebookCellsChangeType.Unknown, transient: false }],
        versionId: this.versionId,
        synchronous: true,
        endSelectionState: void 0
      });
    }
  }
  _bindCellContentHandler(cell, e) {
    this._increaseVersionId(e === "content" || typeof e === "object" && e.type === "model");
    switch (e) {
      case "content":
        this._pauseableEmitter.fire({
          rawEvents: [{ kind: NotebookCellsChangeType.ChangeCellContent, index: this._getCellIndexByHandle(cell.handle), transient: false }],
          versionId: this.versionId,
          synchronous: true,
          endSelectionState: void 0
        });
        break;
      case "language":
        this._pauseableEmitter.fire({
          rawEvents: [{ kind: NotebookCellsChangeType.ChangeCellLanguage, index: this._getCellIndexByHandle(cell.handle), language: cell.language, transient: false }],
          versionId: this.versionId,
          synchronous: true,
          endSelectionState: void 0
        });
        break;
      case "mime":
        this._pauseableEmitter.fire({
          rawEvents: [{ kind: NotebookCellsChangeType.ChangeCellMime, index: this._getCellIndexByHandle(cell.handle), mime: cell.mime, transient: false }],
          versionId: this.versionId,
          synchronous: true,
          endSelectionState: void 0
        });
        break;
      default:
        if (typeof e === "object" && e.type === "model") {
          this._pauseableEmitter.fire({
            rawEvents: [{ kind: NotebookCellsChangeType.ChangeCellContent, index: this._getCellIndexByHandle(cell.handle), transient: false }],
            versionId: this.versionId,
            synchronous: true,
            endSelectionState: void 0
          });
        }
        break;
    }
  }
  _generateAlternativeId() {
    return `${this._notebookSpecificAlternativeId}_` + this.cells.map((cell) => cell.handle + "," + cell.alternativeId).join(";");
  }
  dispose() {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._onWillDispose.fire();
    this._undoService.removeElements(this.uri);
    dispose(this._cellListeners.values());
    this._cellListeners.clear();
    dispose(this._cells);
    this._cells = [];
    super.dispose();
  }
  pushStackElement() {
  }
  _getCellIndexByHandle(handle) {
    return this.cells.findIndex((c) => c.handle === handle);
  }
  _getCellIndexWithOutputIdHandleFromEdits(outputId, rawEdits) {
    const edit = rawEdits.find((e) => "outputs" in e && e.outputs.some((o) => o.outputId === outputId));
    if (edit) {
      if ("index" in edit) {
        return edit.index;
      } else if ("handle" in edit) {
        const cellIndex = this._getCellIndexByHandle(edit.handle);
        this._assertIndex(cellIndex);
        return cellIndex;
      }
    }
    return -1;
  }
  _getCellIndexWithOutputIdHandle(outputId) {
    return this.cells.findIndex((c) => !!c.outputs.find((o) => o.outputId === outputId));
  }
  reset(cells, metadata, transientOptions) {
    this.transientOptions = transientOptions;
    const executions = this._notebookExecutionStateService.getCellExecutionsForNotebook(this.uri);
    const executingCellHandles = executions.filter((exe) => exe.state === NotebookCellExecutionState.Executing).map((exe) => exe.cellHandle);
    const edits = NotebookTextModel.computeEdits(this, cells, executingCellHandles);
    this.applyEdits(
      [
        ...edits,
        { editType: CellEditType.DocumentMetadata, metadata }
      ],
      true,
      void 0,
      () => void 0,
      void 0,
      false
    );
  }
  createSnapshot(options) {
    const transientOptions = options.transientOptions ?? this.transientOptions;
    const data = {
      metadata: filter(this.metadata, (key) => !transientOptions.transientDocumentMetadata[key]),
      cells: []
    };
    let outputSize = 0;
    for (const cell of this.cells) {
      const cellData = {
        cellKind: cell.cellKind,
        language: cell.language,
        mime: cell.mime,
        source: cell.getValue(),
        outputs: [],
        internalMetadata: cell.internalMetadata
      };
      if (options.context === SnapshotContext.Backup && options.outputSizeLimit > 0) {
        cell.outputs.forEach((output) => {
          output.outputs.forEach((item) => {
            outputSize += item.data.byteLength;
          });
        });
        if (outputSize > options.outputSizeLimit) {
          throw new Error("Notebook too large to backup");
        }
      }
      cellData.outputs = !transientOptions.transientOutputs ? cell.outputs : [];
      cellData.metadata = filter(cell.metadata, (key) => !transientOptions.transientCellMetadata[key]);
      data.cells.push(cellData);
    }
    return data;
  }
  restoreSnapshot(snapshot, transientOptions) {
    this.reset(snapshot.cells, snapshot.metadata, transientOptions ?? this.transientOptions);
  }
  static computeEdits(model, cells, executingHandles = []) {
    const edits = [];
    const isExecuting = (cell) => executingHandles.includes(cell.handle);
    const commonPrefix = this._commonPrefix(model.cells, model.cells.length, 0, cells, cells.length, 0, isExecuting);
    if (commonPrefix > 0) {
      for (let i = 0; i < commonPrefix; i++) {
        edits.push(
          {
            editType: CellEditType.Metadata,
            index: i,
            metadata: cells[i].metadata ?? {}
          },
          ...this._computeOutputEdit(i, model.cells[i].outputs, cells[i].outputs)
        );
      }
    }
    if (model.cells.length === cells.length && commonPrefix === model.cells.length) {
      return edits;
    }
    const commonSuffix = this._commonSuffix(model.cells, model.cells.length - commonPrefix, commonPrefix, cells, cells.length - commonPrefix, commonPrefix, isExecuting);
    if (commonSuffix > 0) {
      edits.push({ editType: CellEditType.Replace, index: commonPrefix, count: model.cells.length - commonPrefix - commonSuffix, cells: cells.slice(commonPrefix, cells.length - commonSuffix) });
    } else if (commonPrefix > 0) {
      edits.push({ editType: CellEditType.Replace, index: commonPrefix, count: model.cells.length - commonPrefix, cells: cells.slice(commonPrefix) });
    } else {
      edits.push({ editType: CellEditType.Replace, index: 0, count: model.cells.length, cells });
    }
    if (commonSuffix > 0) {
      for (let i = commonSuffix; i > 0; i--) {
        edits.push(
          {
            editType: CellEditType.Metadata,
            index: model.cells.length - i,
            metadata: cells[cells.length - i].metadata ?? {}
          },
          ...this._computeOutputEdit(model.cells.length - i, model.cells[model.cells.length - i].outputs, cells[cells.length - i].outputs)
        );
      }
    }
    return edits;
  }
  static _computeOutputEdit(index, a, b) {
    if (a.length !== b.length) {
      return [
        {
          editType: CellEditType.Output,
          index,
          outputs: b,
          append: false
        }
      ];
    }
    if (a.length === 0) {
      return [];
    }
    return b.map((output, i) => {
      return {
        editType: CellEditType.OutputItems,
        outputId: a[i].outputId,
        items: output.outputs,
        append: false
      };
    });
  }
  static _commonPrefix(a, aLen, aDelta, b, bLen, bDelta, isExecuting) {
    const maxResult = Math.min(aLen, bLen);
    let result = 0;
    for (let i = 0; i < maxResult && a[aDelta + i].fastEqual(b[bDelta + i], isExecuting(a[aDelta + i])); i++) {
      result++;
    }
    return result;
  }
  static _commonSuffix(a, aLen, aDelta, b, bLen, bDelta, isExecuting) {
    const maxResult = Math.min(aLen, bLen);
    let result = 0;
    for (let i = 0; i < maxResult && a[aDelta + aLen - i - 1].fastEqual(b[bDelta + bLen - i - 1], isExecuting(a[aDelta + aLen - i - 1])); i++) {
      result++;
    }
    return result;
  }
  isOnlyEditingMetadataOnNewCells(rawEdits) {
    for (const edit of rawEdits) {
      if (edit.editType === CellEditType.PartialInternalMetadata) {
        continue;
      }
      if (edit.editType !== CellEditType.Metadata && edit.editType !== CellEditType.PartialMetadata) {
        return false;
      }
      if ("index" in edit && !this.newCellsFromLastEdit.has(this.cells[edit.index].handle)) {
        return false;
      }
      if ("handle" in edit && !this.newCellsFromLastEdit.has(edit.handle)) {
        return false;
      }
    }
    return true;
  }
  applyEdits(rawEdits, synchronous, beginSelectionState, endSelectionsComputer, undoRedoGroup, computeUndoRedo) {
    this._pauseableEmitter.pause();
    this._operationManager.pushStackElement(this._alternativeVersionId, void 0);
    if (computeUndoRedo && this.isOnlyEditingMetadataOnNewCells(rawEdits)) {
      if (!this._operationManager.appendPreviousOperation()) {
        computeUndoRedo = false;
      }
    } else if (computeUndoRedo) {
      this.newCellsFromLastEdit.clear();
    }
    try {
      this._doApplyEdits(rawEdits, synchronous, computeUndoRedo, beginSelectionState, undoRedoGroup);
      return true;
    } finally {
      if (!this._pauseableEmitter.isEmpty) {
        const endSelections = endSelectionsComputer();
        this._increaseVersionId(this._operationManager.isUndoStackEmpty() && !this._pauseableEmitter.isDirtyEvent());
        this._operationManager.pushStackElement(this._alternativeVersionId, endSelections);
        this._pauseableEmitter.fire({ rawEvents: [], versionId: this.versionId, synchronous, endSelectionState: endSelections });
      }
      this._pauseableEmitter.resume();
    }
  }
  _doApplyEdits(rawEdits, synchronous, computeUndoRedo, beginSelectionState, undoRedoGroup) {
    const editsWithDetails = rawEdits.map((edit, index) => {
      let cellIndex = -1;
      if ("index" in edit) {
        cellIndex = edit.index;
      } else if ("handle" in edit) {
        cellIndex = this._getCellIndexByHandle(edit.handle);
        this._assertIndex(cellIndex);
      } else if ("outputId" in edit) {
        cellIndex = this._getCellIndexWithOutputIdHandle(edit.outputId);
        if (this._indexIsInvalid(cellIndex)) {
          cellIndex = this._getCellIndexWithOutputIdHandleFromEdits(edit.outputId, rawEdits.slice(0, index));
        }
        if (this._indexIsInvalid(cellIndex)) {
          return null;
        }
      } else if (edit.editType !== CellEditType.DocumentMetadata) {
        throw new Error("Invalid cell edit");
      }
      return {
        edit,
        cellIndex,
        end: edit.editType === CellEditType.DocumentMetadata ? void 0 : edit.editType === CellEditType.Replace ? edit.index + edit.count : cellIndex,
        originalIndex: index
      };
    }).filter(isDefined);
    const edits = this._mergeCellEdits(editsWithDetails).sort((a, b) => {
      if (a.end === void 0) {
        return -1;
      }
      if (b.end === void 0) {
        return -1;
      }
      return b.end - a.end || b.originalIndex - a.originalIndex;
    }).reduce((prev, curr) => {
      if (!prev.length) {
        prev.push([curr]);
      } else {
        const last = prev[prev.length - 1];
        const index = last[0].cellIndex;
        if (curr.cellIndex === index) {
          last.push(curr);
        } else {
          prev.push([curr]);
        }
      }
      return prev;
    }, []).map((editsOnSameIndex) => {
      const replaceEdits = [];
      const otherEdits = [];
      editsOnSameIndex.forEach((edit) => {
        if (edit.edit.editType === CellEditType.Replace) {
          replaceEdits.push(edit);
        } else {
          otherEdits.push(edit);
        }
      });
      return [...otherEdits.reverse(), ...replaceEdits];
    });
    const flattenEdits = edits.flat();
    for (const { edit, cellIndex } of flattenEdits) {
      switch (edit.editType) {
        case CellEditType.Replace:
          this._replaceCells(edit.index, edit.count, edit.cells, synchronous, computeUndoRedo, beginSelectionState, undoRedoGroup);
          break;
        case CellEditType.Output: {
          this._assertIndex(cellIndex);
          const cell = this._cells[cellIndex];
          if (edit.append) {
            this._spliceNotebookCellOutputs(cell, { start: cell.outputs.length, deleteCount: 0, newOutputs: edit.outputs.map((op) => new NotebookCellOutputTextModel(op)) }, true, computeUndoRedo);
          } else {
            this._spliceNotebookCellOutputs2(cell, edit.outputs, computeUndoRedo);
          }
          break;
        }
        case CellEditType.OutputItems:
          {
            this._assertIndex(cellIndex);
            const cell = this._cells[cellIndex];
            if (edit.append) {
              this._appendNotebookCellOutputItems(cell, edit.outputId, edit.items);
            } else {
              this._replaceNotebookCellOutputItems(cell, edit.outputId, edit.items);
            }
          }
          break;
        case CellEditType.Metadata:
          this._assertIndex(edit.index);
          this._changeCellMetadata(this._cells[edit.index], edit.metadata, computeUndoRedo, beginSelectionState, undoRedoGroup);
          break;
        case CellEditType.PartialMetadata:
          this._assertIndex(cellIndex);
          this._changeCellMetadataPartial(this._cells[cellIndex], edit.metadata, computeUndoRedo, beginSelectionState, undoRedoGroup);
          break;
        case CellEditType.PartialInternalMetadata:
          this._assertIndex(cellIndex);
          this._changeCellInternalMetadataPartial(this._cells[cellIndex], edit.internalMetadata);
          break;
        case CellEditType.CellLanguage:
          this._assertIndex(edit.index);
          this._changeCellLanguage(this._cells[edit.index], edit.language, computeUndoRedo, beginSelectionState, undoRedoGroup);
          break;
        case CellEditType.DocumentMetadata:
          this._updateNotebookCellMetadata(edit.metadata, computeUndoRedo, beginSelectionState, undoRedoGroup);
          break;
        case CellEditType.Move:
          this._moveCellToIdx(edit.index, edit.length, edit.newIdx, synchronous, computeUndoRedo, beginSelectionState, void 0, undoRedoGroup);
          break;
      }
    }
  }
  _mergeCellEdits(rawEdits) {
    const mergedEdits = [];
    rawEdits.forEach((edit) => {
      if (mergedEdits.length) {
        const last = mergedEdits[mergedEdits.length - 1];
        if (last.edit.editType === CellEditType.Output && last.edit.append && edit.edit.editType === CellEditType.Output && edit.edit.append && last.cellIndex === edit.cellIndex) {
          last.edit.outputs = [...last.edit.outputs, ...edit.edit.outputs];
        } else if (last.edit.editType === CellEditType.Output && !last.edit.append && last.edit.outputs.length === 0 && edit.edit.editType === CellEditType.Output && edit.edit.append && last.cellIndex === edit.cellIndex) {
          last.edit.append = false;
          last.edit.outputs = edit.edit.outputs;
        } else {
          mergedEdits.push(edit);
        }
      } else {
        mergedEdits.push(edit);
      }
    });
    return mergedEdits;
  }
  _getDefaultCollapseState(cellDto) {
    const defaultConfig = cellDto.cellKind === CellKind.Code ? this._defaultCollapseConfig?.codeCell : this._defaultCollapseConfig?.markupCell;
    return cellDto.collapseState ?? (defaultConfig ?? void 0);
  }
  _replaceCells(index, count, cellDtos, synchronous, computeUndoRedo, beginSelectionState, undoRedoGroup) {
    if (count === 0 && cellDtos.length === 0) {
      return;
    }
    const oldViewCells = this._cells.slice(0);
    const oldSet = /* @__PURE__ */ new Set();
    oldViewCells.forEach((cell) => {
      oldSet.add(cell.handle);
    });
    for (let i = index; i < Math.min(index + count, this._cells.length); i++) {
      const cell = this._cells[i];
      this._cellListeners.get(cell.handle)?.dispose();
      this._cellListeners.delete(cell.handle);
    }
    const cells = cellDtos.map((cellDto) => {
      const cellHandle = this._cellhandlePool++;
      const cellUri = CellUri.generate(this.uri, cellHandle);
      const collapseState = this._getDefaultCollapseState(cellDto);
      const cell = new NotebookCellTextModel(
        cellUri,
        cellHandle,
        cellDto.source,
        cellDto.language,
        cellDto.mime,
        cellDto.cellKind,
        cellDto.outputs || [],
        cellDto.metadata,
        cellDto.internalMetadata,
        collapseState,
        this.transientOptions,
        this._languageService,
        this._languageDetectionService
      );
      const textModel = this._modelService.getModel(cellUri);
      if (textModel && textModel instanceof TextModel) {
        cell.textModel = textModel;
        cell.language = cellDto.language;
        cell.textModel.setValue(cellDto.source);
        cell.resetTextBuffer(cell.textModel.getTextBuffer());
      }
      const dirtyStateListener = cell.onDidChangeContent((e) => {
        this._bindCellContentHandler(cell, e);
      });
      this.newCellsFromLastEdit.add(cell.handle);
      this._cellListeners.set(cell.handle, dirtyStateListener);
      this._register(cell);
      return cell;
    });
    const cellsCopy = this._cells.slice(0);
    cellsCopy.splice(index, count, ...cells);
    const diffs = diff(this._cells, cellsCopy, (cell) => {
      return oldSet.has(cell.handle);
    }).map((diff2) => {
      return [diff2.start, diff2.deleteCount, diff2.toInsert];
    });
    this._onWillAddRemoveCells.fire({ rawEvent: { kind: NotebookCellsChangeType.ModelChange, changes: diffs } });
    this._cells = cellsCopy;
    const undoDiff = diffs.map((diff2) => {
      const deletedCells = oldViewCells.slice(diff2[0], diff2[0] + diff2[1]);
      return [diff2[0], deletedCells, diff2[2]];
    });
    if (computeUndoRedo) {
      this._operationManager.pushEditOperation(new SpliceCellsEdit(this.uri, undoDiff, {
        insertCell: (index2, cell, endSelections) => {
          this._insertNewCell(index2, [cell], true, endSelections);
        },
        deleteCell: (index2, endSelections) => {
          this._removeCell(index2, 1, true, endSelections);
        },
        replaceCell: (index2, count2, cells2, endSelections) => {
          this._replaceNewCells(index2, count2, cells2, true, endSelections);
        }
      }, void 0, void 0), beginSelectionState, void 0, this._alternativeVersionId, undoRedoGroup);
    }
    this._pauseableEmitter.fire({
      rawEvents: [{ kind: NotebookCellsChangeType.ModelChange, changes: diffs, transient: false }],
      versionId: this.versionId,
      synchronous,
      endSelectionState: void 0
    });
  }
  _increaseVersionId(transient) {
    this._versionId = this._versionId + 1;
    if (!transient) {
      this._notebookSpecificAlternativeId = this._versionId;
    }
    this._alternativeVersionId = this._generateAlternativeId();
  }
  _overwriteAlternativeVersionId(newAlternativeVersionId) {
    this._alternativeVersionId = newAlternativeVersionId;
    this._notebookSpecificAlternativeId = Number(newAlternativeVersionId.substring(0, newAlternativeVersionId.indexOf("_")));
  }
  _updateNotebookCellMetadata(metadata, computeUndoRedo, beginSelectionState, undoRedoGroup) {
    const oldMetadata = this.metadata;
    const triggerDirtyChange = this._isDocumentMetadataChanged(this.metadata, metadata);
    if (triggerDirtyChange) {
      if (computeUndoRedo) {
        const that = this;
        this._operationManager.pushEditOperation(new class {
          constructor() {
            this.type = UndoRedoElementType.Resource;
            this.label = "Update Cell Metadata";
            this.code = "undoredo.textBufferEdit";
          }
          get resource() {
            return that.uri;
          }
          undo() {
            that._updateNotebookCellMetadata(oldMetadata, false, beginSelectionState, undoRedoGroup);
          }
          redo() {
            that._updateNotebookCellMetadata(metadata, false, beginSelectionState, undoRedoGroup);
          }
        }(), beginSelectionState, void 0, this._alternativeVersionId, undoRedoGroup);
      }
    }
    this.metadata = metadata;
    this._pauseableEmitter.fire({
      rawEvents: [{ kind: NotebookCellsChangeType.ChangeDocumentMetadata, metadata: this.metadata, transient: !triggerDirtyChange }],
      versionId: this.versionId,
      synchronous: true,
      endSelectionState: void 0
    });
  }
  _insertNewCell(index, cells, synchronous, endSelections) {
    for (let i = 0; i < cells.length; i++) {
      const dirtyStateListener = cells[i].onDidChangeContent((e) => {
        this._bindCellContentHandler(cells[i], e);
      });
      this._cellListeners.set(cells[i].handle, dirtyStateListener);
    }
    const changes = [[index, 0, cells]];
    this._onWillAddRemoveCells.fire({ rawEvent: { kind: NotebookCellsChangeType.ModelChange, changes } });
    this._cells.splice(index, 0, ...cells);
    this._pauseableEmitter.fire({
      rawEvents: [{ kind: NotebookCellsChangeType.ModelChange, changes, transient: false }],
      versionId: this.versionId,
      synchronous,
      endSelectionState: endSelections
    });
    return;
  }
  _removeCell(index, count, synchronous, endSelections) {
    for (let i = index; i < index + count; i++) {
      const cell = this._cells[i];
      this._cellListeners.get(cell.handle)?.dispose();
      this._cellListeners.delete(cell.handle);
    }
    const changes = [[index, count, []]];
    this._onWillAddRemoveCells.fire({ rawEvent: { kind: NotebookCellsChangeType.ModelChange, changes } });
    this._cells.splice(index, count);
    this._pauseableEmitter.fire({
      rawEvents: [{ kind: NotebookCellsChangeType.ModelChange, changes, transient: false }],
      versionId: this.versionId,
      synchronous,
      endSelectionState: endSelections
    });
  }
  _replaceNewCells(index, count, cells, synchronous, endSelections) {
    for (let i = index; i < index + count; i++) {
      const cell = this._cells[i];
      this._cellListeners.get(cell.handle)?.dispose();
      this._cellListeners.delete(cell.handle);
    }
    for (let i = 0; i < cells.length; i++) {
      const dirtyStateListener = cells[i].onDidChangeContent((e) => {
        this._bindCellContentHandler(cells[i], e);
      });
      this._cellListeners.set(cells[i].handle, dirtyStateListener);
    }
    const changes = [[index, count, cells]];
    this._onWillAddRemoveCells.fire({ rawEvent: { kind: NotebookCellsChangeType.ModelChange, changes } });
    this._cells.splice(index, count, ...cells);
    this._pauseableEmitter.fire({
      rawEvents: [{ kind: NotebookCellsChangeType.ModelChange, changes, transient: false }],
      versionId: this.versionId,
      synchronous,
      endSelectionState: endSelections
    });
  }
  _isDocumentMetadataChanged(a, b) {
    const keys = /* @__PURE__ */ new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const key of keys) {
      if (key === "custom") {
        if (!this._customMetadataEqual(a[key], b[key]) && !this.transientOptions.transientDocumentMetadata[key]) {
          return true;
        }
      } else if (a[key] !== b[key] && !this.transientOptions.transientDocumentMetadata[key]) {
        return true;
      }
    }
    return false;
  }
  _isCellMetadataChanged(a, b) {
    const keys = /* @__PURE__ */ new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const key of keys) {
      if (a[key] !== b[key] && !this.transientOptions.transientCellMetadata[key]) {
        return true;
      }
    }
    return false;
  }
  _customMetadataEqual(a, b) {
    if (!a && !b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    const aProps = Object.getOwnPropertyNames(a);
    const bProps = Object.getOwnPropertyNames(b);
    if (aProps.length !== bProps.length) {
      return false;
    }
    for (let i = 0; i < aProps.length; i++) {
      const propName = aProps[i];
      if (a[propName] !== b[propName]) {
        return false;
      }
    }
    return true;
  }
  _changeCellMetadataPartial(cell, metadata, computeUndoRedo, beginSelectionState, undoRedoGroup) {
    const newMetadata = {
      ...cell.metadata
    };
    let k;
    for (k in metadata) {
      const value = metadata[k] ?? void 0;
      newMetadata[k] = value;
    }
    return this._changeCellMetadata(cell, newMetadata, computeUndoRedo, beginSelectionState, undoRedoGroup);
  }
  _changeCellMetadata(cell, metadata, computeUndoRedo, beginSelectionState, undoRedoGroup) {
    const triggerDirtyChange = this._isCellMetadataChanged(cell.metadata, metadata);
    if (triggerDirtyChange) {
      if (computeUndoRedo) {
        const index = this._cells.indexOf(cell);
        this._operationManager.pushEditOperation(new CellMetadataEdit(this.uri, index, Object.freeze(cell.metadata), Object.freeze(metadata), {
          updateCellMetadata: (index2, newMetadata) => {
            const cell2 = this._cells[index2];
            if (!cell2) {
              return;
            }
            this._changeCellMetadata(cell2, newMetadata, false, beginSelectionState, undoRedoGroup);
          }
        }), beginSelectionState, void 0, this._alternativeVersionId, undoRedoGroup);
      }
    }
    cell.metadata = metadata;
    this._pauseableEmitter.fire({
      rawEvents: [{ kind: NotebookCellsChangeType.ChangeCellMetadata, index: this._cells.indexOf(cell), metadata: cell.metadata, transient: !triggerDirtyChange }],
      versionId: this.versionId,
      synchronous: true,
      endSelectionState: void 0
    });
  }
  _changeCellInternalMetadataPartial(cell, internalMetadata) {
    const newInternalMetadata = {
      ...cell.internalMetadata
    };
    let k;
    for (k in internalMetadata) {
      const value = internalMetadata[k] ?? void 0;
      newInternalMetadata[k] = value;
    }
    cell.internalMetadata = newInternalMetadata;
    this._pauseableEmitter.fire({
      rawEvents: [{ kind: NotebookCellsChangeType.ChangeCellInternalMetadata, index: this._cells.indexOf(cell), internalMetadata: cell.internalMetadata, transient: true }],
      versionId: this.versionId,
      synchronous: true,
      endSelectionState: void 0
    });
  }
  _changeCellLanguage(cell, languageId, computeUndoRedo, beginSelectionState, undoRedoGroup) {
    if (cell.language === languageId) {
      return;
    }
    const oldLanguage = cell.language;
    cell.language = languageId;
    if (computeUndoRedo) {
      const that = this;
      this._operationManager.pushEditOperation(new class {
        constructor() {
          this.type = UndoRedoElementType.Resource;
          this.label = "Update Cell Language";
          this.code = "undoredo.textBufferEdit";
        }
        get resource() {
          return that.uri;
        }
        undo() {
          that._changeCellLanguage(cell, oldLanguage, false, beginSelectionState, undoRedoGroup);
        }
        redo() {
          that._changeCellLanguage(cell, languageId, false, beginSelectionState, undoRedoGroup);
        }
      }(), beginSelectionState, void 0, this._alternativeVersionId, undoRedoGroup);
    }
    this._pauseableEmitter.fire({
      rawEvents: [{ kind: NotebookCellsChangeType.ChangeCellLanguage, index: this._cells.indexOf(cell), language: languageId, transient: false }],
      versionId: this.versionId,
      synchronous: true,
      endSelectionState: void 0
    });
  }
  _spliceNotebookCellOutputs2(cell, outputs, computeUndoRedo) {
    if (outputs.length === 0 && cell.outputs.length === 0) {
      return;
    }
    if (outputs.length <= 1) {
      this._spliceNotebookCellOutputs(cell, { start: 0, deleteCount: cell.outputs.length, newOutputs: outputs.map((op) => new NotebookCellOutputTextModel(op)) }, false, computeUndoRedo);
      return;
    }
    const diff2 = new LcsDiff(new OutputSequence(cell.outputs), new OutputSequence(outputs));
    const diffResult = diff2.ComputeDiff(false);
    const splices = diffResult.changes.map((change) => ({
      start: change.originalStart,
      deleteCount: change.originalLength,
      // create cell output text model only when it's inserted into the notebook document
      newOutputs: outputs.slice(change.modifiedStart, change.modifiedStart + change.modifiedLength).map((op) => new NotebookCellOutputTextModel(op))
    }));
    splices.reverse().forEach((splice) => {
      this._spliceNotebookCellOutputs(cell, splice, false, computeUndoRedo);
    });
  }
  _spliceNotebookCellOutputs(cell, splice, append, computeUndoRedo) {
    cell.spliceNotebookCellOutputs(splice);
    this._pauseableEmitter.fire({
      rawEvents: [{
        kind: NotebookCellsChangeType.Output,
        index: this._cells.indexOf(cell),
        outputs: cell.outputs.map((output) => output.asDto()) ?? [],
        append,
        transient: this.transientOptions.transientOutputs
      }],
      versionId: this.versionId,
      synchronous: true,
      endSelectionState: void 0
    });
  }
  _appendNotebookCellOutputItems(cell, outputId, items) {
    if (cell.changeOutputItems(outputId, true, items)) {
      this._pauseableEmitter.fire({
        rawEvents: [{
          kind: NotebookCellsChangeType.OutputItem,
          index: this._cells.indexOf(cell),
          outputId,
          outputItems: items,
          append: true,
          transient: this.transientOptions.transientOutputs
        }],
        versionId: this.versionId,
        synchronous: true,
        endSelectionState: void 0
      });
    }
  }
  _replaceNotebookCellOutputItems(cell, outputId, items) {
    if (cell.changeOutputItems(outputId, false, items)) {
      this._pauseableEmitter.fire({
        rawEvents: [{
          kind: NotebookCellsChangeType.OutputItem,
          index: this._cells.indexOf(cell),
          outputId,
          outputItems: items,
          append: false,
          transient: this.transientOptions.transientOutputs
        }],
        versionId: this.versionId,
        synchronous: true,
        endSelectionState: void 0
      });
    }
  }
  _moveCellToIdx(index, length, newIdx, synchronous, pushedToUndoStack, beforeSelections, endSelections, undoRedoGroup) {
    if (pushedToUndoStack) {
      this._operationManager.pushEditOperation(new MoveCellEdit(this.uri, index, length, newIdx, {
        moveCell: (fromIndex, length2, toIndex, beforeSelections2, endSelections2) => {
          this._moveCellToIdx(fromIndex, length2, toIndex, true, false, beforeSelections2, endSelections2, undoRedoGroup);
        }
      }, beforeSelections, endSelections), beforeSelections, endSelections, this._alternativeVersionId, undoRedoGroup);
    }
    this._assertIndex(index);
    this._assertIndex(newIdx);
    const cells = this._cells.splice(index, length);
    this._cells.splice(newIdx, 0, ...cells);
    this._pauseableEmitter.fire({
      rawEvents: [{ kind: NotebookCellsChangeType.Move, index, length, newIdx, cells, transient: false }],
      versionId: this.versionId,
      synchronous,
      endSelectionState: endSelections
    });
    return true;
  }
  _assertIndex(index) {
    if (this._indexIsInvalid(index)) {
      throw new Error(`model index out of range ${index}`);
    }
  }
  _indexIsInvalid(index) {
    return index < 0 || index >= this._cells.length;
  }
  //#region Find
  findNextMatch(searchString, searchStart, isRegex, matchCase, wordSeparators, searchEnd) {
    this._assertIndex(searchStart.cellIndex);
    const searchParams = new SearchParams(searchString, isRegex, matchCase, wordSeparators);
    const searchData = searchParams.parseSearchRequest();
    if (!searchData) {
      return null;
    }
    let cellIndex = searchStart.cellIndex;
    let searchStartPosition = searchStart.position;
    let searchEndCell = this._cells.length;
    while (cellIndex < searchEndCell) {
      const cell = this._cells[cellIndex];
      const wrapFlag = searchEnd && cellIndex === searchEnd.cellIndex && searchStartPosition.isBefore(searchEnd.position);
      const searchRange = new Range(
        searchStartPosition.lineNumber,
        searchStartPosition.column,
        wrapFlag ? searchEnd.position.lineNumber : cell.textBuffer.getLineCount(),
        wrapFlag ? searchEnd.position.column : cell.textBuffer.getLineMaxColumn(cell.textBuffer.getLineCount())
      );
      const result = cell.textBuffer.findMatchesLineByLine(searchRange, searchData, false, 1);
      if (result.length > 0) {
        return { cell, match: result[0] };
      } else if (wrapFlag) {
        break;
      }
      cellIndex++;
      if (searchEnd && cellIndex >= this._cells.length) {
        cellIndex = 0;
        searchEndCell = searchEnd.cellIndex + 1;
      }
      searchStartPosition = new Position(1, 1);
    }
    return null;
  }
  findMatches(searchString, isRegex, matchCase, wordSeparators) {
    const searchParams = new SearchParams(searchString, isRegex, matchCase, wordSeparators);
    const searchData = searchParams.parseSearchRequest();
    if (!searchData) {
      return [];
    }
    const results = [];
    for (const cell of this._cells) {
      const searchRange = new Range(1, 1, cell.textBuffer.getLineCount(), cell.textBuffer.getLineMaxColumn(cell.textBuffer.getLineCount()));
      const matches = cell.textBuffer.findMatchesLineByLine(searchRange, searchData, false, 1e3);
      if (matches.length > 0) {
        results.push({ cell, matches });
      }
    }
    return results;
  }
  //#endregion
};
NotebookTextModel = __decorateClass([
  __decorateParam(5, IUndoRedoService),
  __decorateParam(6, IModelService),
  __decorateParam(7, ILanguageService),
  __decorateParam(8, ILanguageDetectionService),
  __decorateParam(9, INotebookExecutionStateService)
], NotebookTextModel);
class OutputSequence {
  constructor(outputs) {
    this.outputs = outputs;
  }
  getElements() {
    return this.outputs.map((output) => {
      return hash(output.outputs.map((output2) => ({
        mime: output2.mime,
        data: output2.data
      })));
    });
  }
}
export {
  NotebookTextModel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9jb21tb24vbW9kZWwvbm90ZWJvb2tUZXh0TW9kZWwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJU2VxdWVuY2UsIExjc0RpZmYgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9kaWZmL2RpZmYuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQsIFBhdXNlYWJsZUVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBoYXNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaGFzaC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBkaXNwb3NlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBmaWx0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCB7IGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgaXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBGaW5kTWF0Y2gsIElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IFRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IFNlYXJjaFBhcmFtcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwvdGV4dE1vZGVsU2VhcmNoLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElNb2RlbENvbnRlbnRDaGFuZ2VkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3RleHRNb2RlbEV2ZW50cy5qcyc7XG5pbXBvcnQgeyBJUmVzb3VyY2VVbmRvUmVkb0VsZW1lbnQsIElVbmRvUmVkb0VsZW1lbnQsIElVbmRvUmVkb1NlcnZpY2UsIElXb3Jrc3BhY2VVbmRvUmVkb0VsZW1lbnQsIFVuZG9SZWRvRWxlbWVudFR5cGUsIFVuZG9SZWRvR3JvdXAgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91bmRvUmVkby9jb21tb24vdW5kb1JlZG8uanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRGV0ZWN0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2xhbmd1YWdlRGV0ZWN0aW9uL2NvbW1vbi9sYW5ndWFnZURldGVjdGlvbldvcmtlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgU25hcHNob3RDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL2ZpbGVXb3JraW5nQ29weS5qcyc7XG5pbXBvcnQgeyBDZWxsRWRpdFR5cGUsIENlbGxLaW5kLCBDZWxsVXJpLCBkaWZmLCBJQ2VsbCwgSUNlbGxEdG8yLCBJQ2VsbEVkaXRPcGVyYXRpb24sIElDZWxsT3V0cHV0LCBJTm90ZWJvb2tTbmFwc2hvdE9wdGlvbnMsIElOb3RlYm9va1RleHRNb2RlbCwgSU91dHB1dER0bywgSU91dHB1dEl0ZW1EdG8sIElTZWxlY3Rpb25TdGF0ZSwgTm90ZWJvb2tDZWxsQ29sbGFwc2VTdGF0ZSwgTm90ZWJvb2tDZWxsRGVmYXVsdENvbGxhcHNlQ29uZmlnLCBOb3RlYm9va0NlbGxFeGVjdXRpb25TdGF0ZSwgTm90ZWJvb2tDZWxsSW50ZXJuYWxNZXRhZGF0YSwgTm90ZWJvb2tDZWxsTWV0YWRhdGEsIE5vdGVib29rQ2VsbE91dHB1dHNTcGxpY2UsIE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLCBOb3RlYm9va0NlbGxUZXh0TW9kZWxTcGxpY2UsIE5vdGVib29rRGF0YSwgTm90ZWJvb2tEb2N1bWVudE1ldGFkYXRhLCBOb3RlYm9va1RleHRNb2RlbENoYW5nZWRFdmVudCwgTm90ZWJvb2tUZXh0TW9kZWxXaWxsQWRkUmVtb3ZlRXZlbnQsIE51bGxhYmxlUGFydGlhbE5vdGVib29rQ2VsbEludGVybmFsTWV0YWRhdGEsIE51bGxhYmxlUGFydGlhbE5vdGVib29rQ2VsbE1ldGFkYXRhLCBUcmFuc2llbnRPcHRpb25zIH0gZnJvbSAnLi4vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlIH0gZnJvbSAnLi4vbm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2VsbE1ldGFkYXRhRWRpdCwgTW92ZUNlbGxFZGl0LCBTcGxpY2VDZWxsc0VkaXQgfSBmcm9tICcuL2NlbGxFZGl0LmpzJztcbmltcG9ydCB7IE5vdGVib29rQ2VsbE91dHB1dFRleHRNb2RlbCB9IGZyb20gJy4vbm90ZWJvb2tDZWxsT3V0cHV0VGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IE5vdGVib29rQ2VsbFRleHRNb2RlbCB9IGZyb20gJy4vbm90ZWJvb2tDZWxsVGV4dE1vZGVsLmpzJztcblxuY2xhc3MgU3RhY2tPcGVyYXRpb24gaW1wbGVtZW50cyBJV29ya3NwYWNlVW5kb1JlZG9FbGVtZW50IHtcblx0dHlwZTogVW5kb1JlZG9FbGVtZW50VHlwZS5Xb3Jrc3BhY2U7XG5cdHRhZyA9ICdub3RlYm9va1VuZG9SZWRvRWxlbWVudCc7XG5cblx0cHVibGljIGdldCBjb2RlKCkge1xuXHRcdHJldHVybiB0aGlzLl9vcGVyYXRpb25zLmxlbmd0aCA9PT0gMSA/IHRoaXMuX29wZXJhdGlvbnNbMF0uY29kZSA6ICd1bmRvcmVkby5ub3RlYm9va3Muc3RhY2tPcGVyYXRpb24nO1xuXHR9XG5cblx0cHJpdmF0ZSBfb3BlcmF0aW9uczogSVVuZG9SZWRvRWxlbWVudFtdID0gW107XG5cdHByaXZhdGUgX2JlZ2luU2VsZWN0aW9uU3RhdGU6IElTZWxlY3Rpb25TdGF0ZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfcmVzdWx0U2VsZWN0aW9uU3RhdGU6IElTZWxlY3Rpb25TdGF0ZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfYmVnaW5BbHRlcm5hdGl2ZVZlcnNpb25JZDogc3RyaW5nO1xuXHRwcml2YXRlIF9yZXN1bHRBbHRlcm5hdGl2ZVZlcnNpb25JZDogc3RyaW5nO1xuXHRwdWJsaWMgZ2V0IGxhYmVsKCkge1xuXHRcdHJldHVybiB0aGlzLl9vcGVyYXRpb25zLmxlbmd0aCA9PT0gMSA/IHRoaXMuX29wZXJhdGlvbnNbMF0ubGFiZWwgOiAnZWRpdCc7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSB0ZXh0TW9kZWw6IE5vdGVib29rVGV4dE1vZGVsLFxuXHRcdHJlYWRvbmx5IHVuZG9SZWRvR3JvdXA6IFVuZG9SZWRvR3JvdXAgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSBfcGF1c2VhYmxlRW1pdHRlcjogUGF1c2VhYmxlRW1pdHRlcjxOb3RlYm9va1RleHRNb2RlbENoYW5nZWRFdmVudD4sXG5cdFx0cHJpdmF0ZSBfcG9zdFVuZG9SZWRvOiAoYWx0ZXJuYXRpdmVWZXJzaW9uSWQ6IHN0cmluZykgPT4gdm9pZCxcblx0XHRzZWxlY3Rpb25TdGF0ZTogSVNlbGVjdGlvblN0YXRlIHwgdW5kZWZpbmVkLFxuXHRcdGJlZ2luQWx0ZXJuYXRpdmVWZXJzaW9uSWQ6IHN0cmluZ1xuXHQpIHtcblx0XHR0aGlzLnR5cGUgPSBVbmRvUmVkb0VsZW1lbnRUeXBlLldvcmtzcGFjZTtcblx0XHR0aGlzLl9iZWdpblNlbGVjdGlvblN0YXRlID0gc2VsZWN0aW9uU3RhdGU7XG5cdFx0dGhpcy5fYmVnaW5BbHRlcm5hdGl2ZVZlcnNpb25JZCA9IGJlZ2luQWx0ZXJuYXRpdmVWZXJzaW9uSWQ7XG5cdFx0dGhpcy5fcmVzdWx0QWx0ZXJuYXRpdmVWZXJzaW9uSWQgPSBiZWdpbkFsdGVybmF0aXZlVmVyc2lvbklkO1xuXHR9XG5cdGdldCByZXNvdXJjZXMoKTogcmVhZG9ubHkgVVJJW10ge1xuXHRcdHJldHVybiBbdGhpcy50ZXh0TW9kZWwudXJpXTtcblx0fVxuXG5cdGdldCBpc0VtcHR5KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9vcGVyYXRpb25zLmxlbmd0aCA9PT0gMDtcblx0fVxuXG5cdHB1c2hFbmRTdGF0ZShhbHRlcm5hdGl2ZVZlcnNpb25JZDogc3RyaW5nLCBzZWxlY3Rpb25TdGF0ZTogSVNlbGVjdGlvblN0YXRlIHwgdW5kZWZpbmVkKSB7XG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIwNzUyM1xuXHRcdHRoaXMuX3Jlc3VsdEFsdGVybmF0aXZlVmVyc2lvbklkID0gYWx0ZXJuYXRpdmVWZXJzaW9uSWQ7XG5cdFx0dGhpcy5fcmVzdWx0U2VsZWN0aW9uU3RhdGUgPSBzZWxlY3Rpb25TdGF0ZSB8fCB0aGlzLl9yZXN1bHRTZWxlY3Rpb25TdGF0ZTtcblx0fVxuXG5cdHB1c2hFZGl0T3BlcmF0aW9uKGVsZW1lbnQ6IElVbmRvUmVkb0VsZW1lbnQsIGJlZ2luU2VsZWN0aW9uU3RhdGU6IElTZWxlY3Rpb25TdGF0ZSB8IHVuZGVmaW5lZCwgcmVzdWx0U2VsZWN0aW9uU3RhdGU6IElTZWxlY3Rpb25TdGF0ZSB8IHVuZGVmaW5lZCwgYWx0ZXJuYXRpdmVWZXJzaW9uSWQ6IHN0cmluZykge1xuXHRcdGlmICh0aGlzLl9vcGVyYXRpb25zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhpcy5fYmVnaW5TZWxlY3Rpb25TdGF0ZSA9IHRoaXMuX2JlZ2luU2VsZWN0aW9uU3RhdGUgPz8gYmVnaW5TZWxlY3Rpb25TdGF0ZTtcblx0XHR9XG5cdFx0dGhpcy5fb3BlcmF0aW9ucy5wdXNoKGVsZW1lbnQpO1xuXHRcdHRoaXMuX3Jlc3VsdFNlbGVjdGlvblN0YXRlID0gcmVzdWx0U2VsZWN0aW9uU3RhdGU7XG5cdFx0dGhpcy5fcmVzdWx0QWx0ZXJuYXRpdmVWZXJzaW9uSWQgPSBhbHRlcm5hdGl2ZVZlcnNpb25JZDtcblx0fVxuXG5cdGFzeW5jIHVuZG8oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fcGF1c2VhYmxlRW1pdHRlci5wYXVzZSgpO1xuXHRcdHRyeSB7XG5cdFx0XHRmb3IgKGxldCBpID0gdGhpcy5fb3BlcmF0aW9ucy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLl9vcGVyYXRpb25zW2ldLnVuZG8oKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3Bvc3RVbmRvUmVkbyh0aGlzLl9iZWdpbkFsdGVybmF0aXZlVmVyc2lvbklkKTtcblx0XHRcdHRoaXMuX3BhdXNlYWJsZUVtaXR0ZXIuZmlyZSh7XG5cdFx0XHRcdHJhd0V2ZW50czogW10sXG5cdFx0XHRcdHN5bmNocm9ub3VzOiB1bmRlZmluZWQsXG5cdFx0XHRcdHZlcnNpb25JZDogdGhpcy50ZXh0TW9kZWwudmVyc2lvbklkLFxuXHRcdFx0XHRlbmRTZWxlY3Rpb25TdGF0ZTogdGhpcy5fYmVnaW5TZWxlY3Rpb25TdGF0ZVxuXHRcdFx0fSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuX3BhdXNlYWJsZUVtaXR0ZXIucmVzdW1lKCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcmVkbygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9wYXVzZWFibGVFbWl0dGVyLnBhdXNlKCk7XG5cdFx0dHJ5IHtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fb3BlcmF0aW9ucy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRhd2FpdCB0aGlzLl9vcGVyYXRpb25zW2ldLnJlZG8oKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3Bvc3RVbmRvUmVkbyh0aGlzLl9yZXN1bHRBbHRlcm5hdGl2ZVZlcnNpb25JZCk7XG5cdFx0XHR0aGlzLl9wYXVzZWFibGVFbWl0dGVyLmZpcmUoe1xuXHRcdFx0XHRyYXdFdmVudHM6IFtdLFxuXHRcdFx0XHRzeW5jaHJvbm91czogdW5kZWZpbmVkLFxuXHRcdFx0XHR2ZXJzaW9uSWQ6IHRoaXMudGV4dE1vZGVsLnZlcnNpb25JZCxcblx0XHRcdFx0ZW5kU2VsZWN0aW9uU3RhdGU6IHRoaXMuX3Jlc3VsdFNlbGVjdGlvblN0YXRlXG5cdFx0XHR9KTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5fcGF1c2VhYmxlRW1pdHRlci5yZXN1bWUoKTtcblx0XHR9XG5cblx0fVxufVxuXG5jbGFzcyBOb3RlYm9va09wZXJhdGlvbk1hbmFnZXIge1xuXHRwcml2YXRlIF9wZW5kaW5nU3RhY2tPcGVyYXRpb246IFN0YWNrT3BlcmF0aW9uIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgX2lzQXBwZW5kaW5nOiBib29sZWFuID0gZmFsc2U7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3RleHRNb2RlbDogTm90ZWJvb2tUZXh0TW9kZWwsXG5cdFx0cHJpdmF0ZSBfdW5kb1NlcnZpY2U6IElVbmRvUmVkb1NlcnZpY2UsXG5cdFx0cHJpdmF0ZSBfcGF1c2VhYmxlRW1pdHRlcjogUGF1c2VhYmxlRW1pdHRlcjxOb3RlYm9va1RleHRNb2RlbENoYW5nZWRFdmVudD4sXG5cdFx0cHJpdmF0ZSBfcG9zdFVuZG9SZWRvOiAoYWx0ZXJuYXRpdmVWZXJzaW9uSWQ6IHN0cmluZykgPT4gdm9pZFxuXHQpIHtcblx0fVxuXG5cdGlzVW5kb1N0YWNrRW1wdHkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3BlbmRpbmdTdGFja09wZXJhdGlvbiA9PT0gbnVsbCB8fCB0aGlzLl9wZW5kaW5nU3RhY2tPcGVyYXRpb24uaXNFbXB0eTtcblx0fVxuXG5cdHB1c2hTdGFja0VsZW1lbnQoYWx0ZXJuYXRpdmVWZXJzaW9uSWQ6IHN0cmluZywgc2VsZWN0aW9uU3RhdGU6IElTZWxlY3Rpb25TdGF0ZSB8IHVuZGVmaW5lZCkge1xuXHRcdGlmICh0aGlzLl9wZW5kaW5nU3RhY2tPcGVyYXRpb24gJiYgIXRoaXMuX3BlbmRpbmdTdGFja09wZXJhdGlvbi5pc0VtcHR5KSB7XG5cdFx0XHR0aGlzLl9wZW5kaW5nU3RhY2tPcGVyYXRpb24ucHVzaEVuZFN0YXRlKGFsdGVybmF0aXZlVmVyc2lvbklkLCBzZWxlY3Rpb25TdGF0ZSk7XG5cdFx0XHRpZiAoIXRoaXMuX2lzQXBwZW5kaW5nKSB7XG5cdFx0XHRcdHRoaXMuX3VuZG9TZXJ2aWNlLnB1c2hFbGVtZW50KHRoaXMuX3BlbmRpbmdTdGFja09wZXJhdGlvbiwgdGhpcy5fcGVuZGluZ1N0YWNrT3BlcmF0aW9uLnVuZG9SZWRvR3JvdXApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9pc0FwcGVuZGluZyA9IGZhbHNlO1xuXHRcdHRoaXMuX3BlbmRpbmdTdGFja09wZXJhdGlvbiA9IG51bGw7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRPckNyZWF0ZUVkaXRTdGFja0VsZW1lbnQoYmVnaW5TZWxlY3Rpb25TdGF0ZTogSVNlbGVjdGlvblN0YXRlIHwgdW5kZWZpbmVkLCB1bmRvUmVkb0dyb3VwOiBVbmRvUmVkb0dyb3VwIHwgdW5kZWZpbmVkLCBhbHRlcm5hdGl2ZVZlcnNpb25JZDogc3RyaW5nKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3BlbmRpbmdTdGFja09wZXJhdGlvbiA/Pz0gbmV3IFN0YWNrT3BlcmF0aW9uKHRoaXMuX3RleHRNb2RlbCwgdW5kb1JlZG9Hcm91cCwgdGhpcy5fcGF1c2VhYmxlRW1pdHRlciwgdGhpcy5fcG9zdFVuZG9SZWRvLCBiZWdpblNlbGVjdGlvblN0YXRlLCBhbHRlcm5hdGl2ZVZlcnNpb25JZCB8fCAnJyk7XG5cdH1cblxuXHRhcHBlbmRQcmV2aW91c09wZXJhdGlvbigpOiBib29sZWFuIHtcblx0XHRjb25zdCBwcmV2aW91cyA9IHRoaXMuX3VuZG9TZXJ2aWNlLmdldExhc3RFbGVtZW50KHRoaXMuX3RleHRNb2RlbC51cmkpIGFzIFN0YWNrT3BlcmF0aW9uO1xuXHRcdGlmIChwcmV2aW91cyAmJiBwcmV2aW91cy50YWcgPT09ICdub3RlYm9va1VuZG9SZWRvRWxlbWVudCcpIHtcblx0XHRcdHRoaXMuX3BlbmRpbmdTdGFja09wZXJhdGlvbiA9IHByZXZpb3VzO1xuXHRcdFx0dGhpcy5faXNBcHBlbmRpbmcgPSB0cnVlO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHB1c2hFZGl0T3BlcmF0aW9uKGVsZW1lbnQ6IElVbmRvUmVkb0VsZW1lbnQsIGJlZ2luU2VsZWN0aW9uU3RhdGU6IElTZWxlY3Rpb25TdGF0ZSB8IHVuZGVmaW5lZCwgcmVzdWx0U2VsZWN0aW9uU3RhdGU6IElTZWxlY3Rpb25TdGF0ZSB8IHVuZGVmaW5lZCwgYWx0ZXJuYXRpdmVWZXJzaW9uSWQ6IHN0cmluZywgdW5kb1JlZG9Hcm91cDogVW5kb1JlZG9Hcm91cCB8IHVuZGVmaW5lZCkge1xuXHRcdGNvbnN0IHBlbmRpbmdTdGFja09wZXJhdGlvbiA9IHRoaXMuX2dldE9yQ3JlYXRlRWRpdFN0YWNrRWxlbWVudChiZWdpblNlbGVjdGlvblN0YXRlLCB1bmRvUmVkb0dyb3VwLCBhbHRlcm5hdGl2ZVZlcnNpb25JZCk7XG5cdFx0cGVuZGluZ1N0YWNrT3BlcmF0aW9uLnB1c2hFZGl0T3BlcmF0aW9uKGVsZW1lbnQsIGJlZ2luU2VsZWN0aW9uU3RhdGUsIHJlc3VsdFNlbGVjdGlvblN0YXRlLCBhbHRlcm5hdGl2ZVZlcnNpb25JZCk7XG5cdH1cbn1cblxudHlwZSBUcmFuc2Zvcm1lZEVkaXQgPSB7XG5cdGVkaXQ6IElDZWxsRWRpdE9wZXJhdGlvbjtcblx0Y2VsbEluZGV4OiBudW1iZXI7XG5cdGVuZDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRvcmlnaW5hbEluZGV4OiBudW1iZXI7XG59O1xuXG5jbGFzcyBOb3RlYm9va0V2ZW50RW1pdHRlciBleHRlbmRzIFBhdXNlYWJsZUVtaXR0ZXI8Tm90ZWJvb2tUZXh0TW9kZWxDaGFuZ2VkRXZlbnQ+IHtcblx0Z2V0IGlzRW1wdHkoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2V2ZW50UXVldWUuaXNFbXB0eSgpO1xuXHR9XG5cblx0aXNEaXJ0eUV2ZW50KCkge1xuXHRcdGZvciAoY29uc3QgZSBvZiB0aGlzLl9ldmVudFF1ZXVlKSB7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGUucmF3RXZlbnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmICghZS5yYXdFdmVudHNbaV0udHJhbnNpZW50KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE5vdGVib29rVGV4dE1vZGVsIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElOb3RlYm9va1RleHRNb2RlbCB7XG5cblx0cHJpdmF0ZSBfaXNEaXNwb3NlZCA9IGZhbHNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbldpbGxEaXNwb3NlOiBFbWl0dGVyPHZvaWQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uV2lsbEFkZFJlbW92ZUNlbGxzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8Tm90ZWJvb2tUZXh0TW9kZWxXaWxsQWRkUmVtb3ZlRXZlbnQ+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUNvbnRlbnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxOb3RlYm9va1RleHRNb2RlbENoYW5nZWRFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uV2lsbERpc3Bvc2U6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25XaWxsRGlzcG9zZS5ldmVudDtcblx0cmVhZG9ubHkgb25XaWxsQWRkUmVtb3ZlQ2VsbHMgPSB0aGlzLl9vbldpbGxBZGRSZW1vdmVDZWxscy5ldmVudDtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VDb250ZW50ID0gdGhpcy5fb25EaWRDaGFuZ2VDb250ZW50LmV2ZW50O1xuXHRwcml2YXRlIF9jZWxsaGFuZGxlUG9vbDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSByZWFkb25seSBfY2VsbExpc3RlbmVyczogTWFwPG51bWJlciwgSURpc3Bvc2FibGU+ID0gbmV3IE1hcCgpO1xuXHRwcml2YXRlIF9jZWxsczogTm90ZWJvb2tDZWxsVGV4dE1vZGVsW10gPSBbXTtcblx0cHJpdmF0ZSBfZGVmYXVsdENvbGxhcHNlQ29uZmlnOiBOb3RlYm9va0NlbGxEZWZhdWx0Q29sbGFwc2VDb25maWcgfCB1bmRlZmluZWQ7XG5cblx0bWV0YWRhdGE6IE5vdGVib29rRG9jdW1lbnRNZXRhZGF0YSA9IHt9O1xuXHR0cmFuc2llbnRPcHRpb25zOiBUcmFuc2llbnRPcHRpb25zID0geyB0cmFuc2llbnRDZWxsTWV0YWRhdGE6IHt9LCB0cmFuc2llbnREb2N1bWVudE1ldGFkYXRhOiB7fSwgdHJhbnNpZW50T3V0cHV0czogZmFsc2UsIGNlbGxDb250ZW50TWV0YWRhdGE6IHt9IH07XG5cdHByaXZhdGUgX3ZlcnNpb25JZCA9IDA7XG5cblx0LyoqXG5cdCAqIFRoaXMgYWx0ZXJuYXRpdmUgaWQgaXMgb25seSBmb3Igbm9uLWNlbGwtY29udGVudCBjaGFuZ2VzLlxuXHQgKi9cblx0cHJpdmF0ZSBfbm90ZWJvb2tTcGVjaWZpY0FsdGVybmF0aXZlSWQgPSAwO1xuXG5cdC8qKlxuXHQgKiBVbmxpa2UsIHZlcnNpb25JZCwgdGhpcyBjYW4gZ28gZG93biAodmlhIHVuZG8pIG9yIGdvIHRvIHByZXZpb3VzIHZhbHVlcyAodmlhIHJlZG8pXG5cdCAqL1xuXHRwcml2YXRlIF9hbHRlcm5hdGl2ZVZlcnNpb25JZDogc3RyaW5nID0gJzEnO1xuXHRwcml2YXRlIF9vcGVyYXRpb25NYW5hZ2VyOiBOb3RlYm9va09wZXJhdGlvbk1hbmFnZXI7XG5cdHByaXZhdGUgX3BhdXNlYWJsZUVtaXR0ZXI6IE5vdGVib29rRXZlbnRFbWl0dGVyO1xuXG5cdGdldCBsZW5ndGgoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2NlbGxzLmxlbmd0aDtcblx0fVxuXG5cdGdldCBjZWxscygpOiByZWFkb25seSBOb3RlYm9va0NlbGxUZXh0TW9kZWxbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX2NlbGxzO1xuXHR9XG5cblx0Z2V0IHZlcnNpb25JZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fdmVyc2lvbklkO1xuXHR9XG5cblx0Z2V0IGFsdGVybmF0aXZlVmVyc2lvbklkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX2FsdGVybmF0aXZlVmVyc2lvbklkO1xuXHR9XG5cblx0Z2V0IG5vdGVib29rVHlwZSgpIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3VHlwZTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IHZpZXdUeXBlOiBzdHJpbmcsXG5cdFx0cmVhZG9ubHkgdXJpOiBVUkksXG5cdFx0Y2VsbHM6IElDZWxsRHRvMltdLFxuXHRcdG1ldGFkYXRhOiBOb3RlYm9va0RvY3VtZW50TWV0YWRhdGEsXG5cdFx0b3B0aW9uczogVHJhbnNpZW50T3B0aW9ucyxcblx0XHRASVVuZG9SZWRvU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF91bmRvU2VydmljZTogSVVuZG9SZWRvU2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9tb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VEZXRlY3Rpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlRGV0ZWN0aW9uU2VydmljZTogSUxhbmd1YWdlRGV0ZWN0aW9uU2VydmljZSxcblx0XHRASU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlOiBJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy50cmFuc2llbnRPcHRpb25zID0gb3B0aW9ucztcblx0XHR0aGlzLm1ldGFkYXRhID0gbWV0YWRhdGE7XG5cdFx0dGhpcy5faW5pdGlhbGl6ZShjZWxscyk7XG5cblx0XHRjb25zdCBtYXliZVVwZGF0ZUNlbGxUZXh0TW9kZWwgPSAodGV4dE1vZGVsOiBJVGV4dE1vZGVsKSA9PiB7XG5cdFx0XHRpZiAodGV4dE1vZGVsLnVyaS5zY2hlbWUgPT09IFNjaGVtYXMudnNjb2RlTm90ZWJvb2tDZWxsICYmIHRleHRNb2RlbCBpbnN0YW5jZW9mIFRleHRNb2RlbCkge1xuXHRcdFx0XHRjb25zdCBjZWxsVXJpID0gQ2VsbFVyaS5wYXJzZSh0ZXh0TW9kZWwudXJpKTtcblx0XHRcdFx0aWYgKGNlbGxVcmkgJiYgaXNFcXVhbChjZWxsVXJpLm5vdGVib29rLCB0aGlzLnVyaSkpIHtcblx0XHRcdFx0XHRjb25zdCBjZWxsSWR4ID0gdGhpcy5fZ2V0Q2VsbEluZGV4QnlIYW5kbGUoY2VsbFVyaS5oYW5kbGUpO1xuXHRcdFx0XHRcdGlmIChjZWxsSWR4ID49IDApIHtcblx0XHRcdFx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLmNlbGxzW2NlbGxJZHhdO1xuXHRcdFx0XHRcdFx0aWYgKGNlbGwpIHtcblx0XHRcdFx0XHRcdFx0Y2VsbC50ZXh0TW9kZWwgPSB0ZXh0TW9kZWw7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHR0aGlzLl9yZWdpc3RlcihfbW9kZWxTZXJ2aWNlLm9uTW9kZWxBZGRlZChlID0+IG1heWJlVXBkYXRlQ2VsbFRleHRNb2RlbChlKSkpO1xuXG5cdFx0dGhpcy5fcGF1c2VhYmxlRW1pdHRlciA9IG5ldyBOb3RlYm9va0V2ZW50RW1pdHRlcih7XG5cdFx0XHRtZXJnZTogKGV2ZW50czogTm90ZWJvb2tUZXh0TW9kZWxDaGFuZ2VkRXZlbnRbXSkgPT4ge1xuXHRcdFx0XHRjb25zdCBmaXJzdCA9IGV2ZW50c1swXTtcblxuXHRcdFx0XHRjb25zdCByYXdFdmVudHMgPSBmaXJzdC5yYXdFdmVudHM7XG5cdFx0XHRcdGxldCB2ZXJzaW9uSWQgPSBmaXJzdC52ZXJzaW9uSWQ7XG5cdFx0XHRcdGxldCBlbmRTZWxlY3Rpb25TdGF0ZSA9IGZpcnN0LmVuZFNlbGVjdGlvblN0YXRlO1xuXHRcdFx0XHRsZXQgc3luY2hyb25vdXMgPSBmaXJzdC5zeW5jaHJvbm91cztcblxuXHRcdFx0XHRmb3IgKGxldCBpID0gMTsgaSA8IGV2ZW50cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdHJhd0V2ZW50cy5wdXNoKC4uLmV2ZW50c1tpXS5yYXdFdmVudHMpO1xuXHRcdFx0XHRcdHZlcnNpb25JZCA9IGV2ZW50c1tpXS52ZXJzaW9uSWQ7XG5cdFx0XHRcdFx0ZW5kU2VsZWN0aW9uU3RhdGUgPSBldmVudHNbaV0uZW5kU2VsZWN0aW9uU3RhdGUgIT09IHVuZGVmaW5lZCA/IGV2ZW50c1tpXS5lbmRTZWxlY3Rpb25TdGF0ZSA6IGVuZFNlbGVjdGlvblN0YXRlO1xuXHRcdFx0XHRcdHN5bmNocm9ub3VzID0gZXZlbnRzW2ldLnN5bmNocm9ub3VzICE9PSB1bmRlZmluZWQgPyBldmVudHNbaV0uc3luY2hyb25vdXMgOiBzeW5jaHJvbm91cztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB7IHJhd0V2ZW50cywgdmVyc2lvbklkLCBlbmRTZWxlY3Rpb25TdGF0ZSwgc3luY2hyb25vdXMgfTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3BhdXNlYWJsZUVtaXR0ZXIuZXZlbnQoZSA9PiB7XG5cdFx0XHRpZiAoZS5yYXdFdmVudHMubGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udGVudC5maXJlKGUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX29wZXJhdGlvbk1hbmFnZXIgPSBuZXcgTm90ZWJvb2tPcGVyYXRpb25NYW5hZ2VyKFxuXHRcdFx0dGhpcyxcblx0XHRcdHRoaXMuX3VuZG9TZXJ2aWNlLFxuXHRcdFx0dGhpcy5fcGF1c2VhYmxlRW1pdHRlcixcblx0XHRcdChhbHRlcm5hdGl2ZVZlcnNpb25JZDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdHRoaXMuX2luY3JlYXNlVmVyc2lvbklkKHRydWUpO1xuXHRcdFx0XHR0aGlzLl9vdmVyd3JpdGVBbHRlcm5hdGl2ZVZlcnNpb25JZChhbHRlcm5hdGl2ZVZlcnNpb25JZCk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdHNldENlbGxDb2xsYXBzZURlZmF1bHQoY29sbGFwc2VDb25maWc6IE5vdGVib29rQ2VsbERlZmF1bHRDb2xsYXBzZUNvbmZpZyB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX2RlZmF1bHRDb2xsYXBzZUNvbmZpZyA9IGNvbGxhcHNlQ29uZmlnO1xuXHR9XG5cblx0X2luaXRpYWxpemUoY2VsbHM6IElDZWxsRHRvMltdLCB0cmlnZ2VyRGlydHk/OiBib29sZWFuKSB7XG5cdFx0dGhpcy5fY2VsbHMgPSBbXTtcblx0XHR0aGlzLl92ZXJzaW9uSWQgPSAwO1xuXHRcdHRoaXMuX25vdGVib29rU3BlY2lmaWNBbHRlcm5hdGl2ZUlkID0gMDtcblxuXHRcdGNvbnN0IG1haW5DZWxscyA9IGNlbGxzLm1hcChjZWxsID0+IHtcblx0XHRcdGNvbnN0IGNlbGxIYW5kbGUgPSB0aGlzLl9jZWxsaGFuZGxlUG9vbCsrO1xuXHRcdFx0Y29uc3QgY2VsbFVyaSA9IENlbGxVcmkuZ2VuZXJhdGUodGhpcy51cmksIGNlbGxIYW5kbGUpO1xuXHRcdFx0Y29uc3QgY29sbGFwc2VTdGF0ZSA9IHRoaXMuX2dldERlZmF1bHRDb2xsYXBzZVN0YXRlKGNlbGwpO1xuXHRcdFx0cmV0dXJuIG5ldyBOb3RlYm9va0NlbGxUZXh0TW9kZWwoY2VsbFVyaSwgY2VsbEhhbmRsZSwgY2VsbC5zb3VyY2UsIGNlbGwubGFuZ3VhZ2UsIGNlbGwubWltZSwgY2VsbC5jZWxsS2luZCwgY2VsbC5vdXRwdXRzLCBjZWxsLm1ldGFkYXRhLCBjZWxsLmludGVybmFsTWV0YWRhdGEsIGNvbGxhcHNlU3RhdGUsIHRoaXMudHJhbnNpZW50T3B0aW9ucywgdGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLCB0aGlzLl9sYW5ndWFnZURldGVjdGlvblNlcnZpY2UpO1xuXHRcdH0pO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBtYWluQ2VsbHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IGRpcnR5U3RhdGVMaXN0ZW5lciA9IG1haW5DZWxsc1tpXS5vbkRpZENoYW5nZUNvbnRlbnQoKGUpID0+IHtcblx0XHRcdFx0dGhpcy5fYmluZENlbGxDb250ZW50SGFuZGxlcihtYWluQ2VsbHNbaV0sIGUpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMuX2NlbGxMaXN0ZW5lcnMuc2V0KG1haW5DZWxsc1tpXS5oYW5kbGUsIGRpcnR5U3RhdGVMaXN0ZW5lcik7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihtYWluQ2VsbHNbaV0pO1xuXHRcdH1cblxuXHRcdHRoaXMuX2NlbGxzLnNwbGljZSgwLCAwLCAuLi5tYWluQ2VsbHMpO1xuXHRcdHRoaXMuX2FsdGVybmF0aXZlVmVyc2lvbklkID0gdGhpcy5fZ2VuZXJhdGVBbHRlcm5hdGl2ZUlkKCk7XG5cblx0XHRpZiAodHJpZ2dlckRpcnR5KSB7XG5cdFx0XHR0aGlzLl9wYXVzZWFibGVFbWl0dGVyLmZpcmUoe1xuXHRcdFx0XHRyYXdFdmVudHM6IFt7IGtpbmQ6IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLlVua25vd24sIHRyYW5zaWVudDogZmFsc2UgfV0sXG5cdFx0XHRcdHZlcnNpb25JZDogdGhpcy52ZXJzaW9uSWQsXG5cdFx0XHRcdHN5bmNocm9ub3VzOiB0cnVlLFxuXHRcdFx0XHRlbmRTZWxlY3Rpb25TdGF0ZTogdW5kZWZpbmVkXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9iaW5kQ2VsbENvbnRlbnRIYW5kbGVyKGNlbGw6IE5vdGVib29rQ2VsbFRleHRNb2RlbCwgZTogJ2NvbnRlbnQnIHwgJ2xhbmd1YWdlJyB8ICdtaW1lJyB8IHsgdHlwZTogJ21vZGVsJzsgZXZlbnQ6IElNb2RlbENvbnRlbnRDaGFuZ2VkRXZlbnQgfSkge1xuXHRcdHRoaXMuX2luY3JlYXNlVmVyc2lvbklkKGUgPT09ICdjb250ZW50JyB8fCAodHlwZW9mIGUgPT09ICdvYmplY3QnICYmIGUudHlwZSA9PT0gJ21vZGVsJykpO1xuXHRcdHN3aXRjaCAoZSkge1xuXHRcdFx0Y2FzZSAnY29udGVudCc6XG5cdFx0XHRcdHRoaXMuX3BhdXNlYWJsZUVtaXR0ZXIuZmlyZSh7XG5cdFx0XHRcdFx0cmF3RXZlbnRzOiBbeyBraW5kOiBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5DaGFuZ2VDZWxsQ29udGVudCwgaW5kZXg6IHRoaXMuX2dldENlbGxJbmRleEJ5SGFuZGxlKGNlbGwuaGFuZGxlKSwgdHJhbnNpZW50OiBmYWxzZSB9XSxcblx0XHRcdFx0XHR2ZXJzaW9uSWQ6IHRoaXMudmVyc2lvbklkLFxuXHRcdFx0XHRcdHN5bmNocm9ub3VzOiB0cnVlLFxuXHRcdFx0XHRcdGVuZFNlbGVjdGlvblN0YXRlOiB1bmRlZmluZWRcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlICdsYW5ndWFnZSc6XG5cdFx0XHRcdHRoaXMuX3BhdXNlYWJsZUVtaXR0ZXIuZmlyZSh7XG5cdFx0XHRcdFx0cmF3RXZlbnRzOiBbeyBraW5kOiBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5DaGFuZ2VDZWxsTGFuZ3VhZ2UsIGluZGV4OiB0aGlzLl9nZXRDZWxsSW5kZXhCeUhhbmRsZShjZWxsLmhhbmRsZSksIGxhbmd1YWdlOiBjZWxsLmxhbmd1YWdlLCB0cmFuc2llbnQ6IGZhbHNlIH1dLFxuXHRcdFx0XHRcdHZlcnNpb25JZDogdGhpcy52ZXJzaW9uSWQsXG5cdFx0XHRcdFx0c3luY2hyb25vdXM6IHRydWUsXG5cdFx0XHRcdFx0ZW5kU2VsZWN0aW9uU3RhdGU6IHVuZGVmaW5lZFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgJ21pbWUnOlxuXHRcdFx0XHR0aGlzLl9wYXVzZWFibGVFbWl0dGVyLmZpcmUoe1xuXHRcdFx0XHRcdHJhd0V2ZW50czogW3sga2luZDogTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuQ2hhbmdlQ2VsbE1pbWUsIGluZGV4OiB0aGlzLl9nZXRDZWxsSW5kZXhCeUhhbmRsZShjZWxsLmhhbmRsZSksIG1pbWU6IGNlbGwubWltZSwgdHJhbnNpZW50OiBmYWxzZSB9XSxcblx0XHRcdFx0XHR2ZXJzaW9uSWQ6IHRoaXMudmVyc2lvbklkLFxuXHRcdFx0XHRcdHN5bmNocm9ub3VzOiB0cnVlLFxuXHRcdFx0XHRcdGVuZFNlbGVjdGlvblN0YXRlOiB1bmRlZmluZWRcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRpZiAodHlwZW9mIGUgPT09ICdvYmplY3QnICYmIGUudHlwZSA9PT0gJ21vZGVsJykge1xuXHRcdFx0XHRcdHRoaXMuX3BhdXNlYWJsZUVtaXR0ZXIuZmlyZSh7XG5cdFx0XHRcdFx0XHRyYXdFdmVudHM6IFt7IGtpbmQ6IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLkNoYW5nZUNlbGxDb250ZW50LCBpbmRleDogdGhpcy5fZ2V0Q2VsbEluZGV4QnlIYW5kbGUoY2VsbC5oYW5kbGUpLCB0cmFuc2llbnQ6IGZhbHNlIH1dLFxuXHRcdFx0XHRcdFx0dmVyc2lvbklkOiB0aGlzLnZlcnNpb25JZCxcblx0XHRcdFx0XHRcdHN5bmNocm9ub3VzOiB0cnVlLFxuXHRcdFx0XHRcdFx0ZW5kU2VsZWN0aW9uU3RhdGU6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2dlbmVyYXRlQWx0ZXJuYXRpdmVJZCgpIHtcblx0XHRyZXR1cm4gYCR7dGhpcy5fbm90ZWJvb2tTcGVjaWZpY0FsdGVybmF0aXZlSWR9X2AgKyB0aGlzLmNlbGxzLm1hcChjZWxsID0+IGNlbGwuaGFuZGxlICsgJywnICsgY2VsbC5hbHRlcm5hdGl2ZUlkKS5qb2luKCc7Jyk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHQvLyBOb3RlYm9va0VkaXRvck1vZGVsIGNhbiBiZSBkaXNwb3NlZCB0d2ljZSwgZG9uJ3QgZmlyZSBvbldpbGxEaXNwb3NlIGFnYWluXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5faXNEaXNwb3NlZCA9IHRydWU7XG5cdFx0dGhpcy5fb25XaWxsRGlzcG9zZS5maXJlKCk7XG5cdFx0dGhpcy5fdW5kb1NlcnZpY2UucmVtb3ZlRWxlbWVudHModGhpcy51cmkpO1xuXG5cdFx0ZGlzcG9zZSh0aGlzLl9jZWxsTGlzdGVuZXJzLnZhbHVlcygpKTtcblx0XHR0aGlzLl9jZWxsTGlzdGVuZXJzLmNsZWFyKCk7XG5cblx0XHRkaXNwb3NlKHRoaXMuX2NlbGxzKTtcblx0XHR0aGlzLl9jZWxscyA9IFtdO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHB1c2hTdGFja0VsZW1lbnQoKSB7XG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIwNzUyM1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0Q2VsbEluZGV4QnlIYW5kbGUoaGFuZGxlOiBudW1iZXIpIHtcblx0XHRyZXR1cm4gdGhpcy5jZWxscy5maW5kSW5kZXgoYyA9PiBjLmhhbmRsZSA9PT0gaGFuZGxlKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldENlbGxJbmRleFdpdGhPdXRwdXRJZEhhbmRsZUZyb21FZGl0cyhvdXRwdXRJZDogc3RyaW5nLCByYXdFZGl0czogSUNlbGxFZGl0T3BlcmF0aW9uW10pIHtcblx0XHRjb25zdCBlZGl0ID0gcmF3RWRpdHMuZmluZChlID0+ICdvdXRwdXRzJyBpbiBlICYmIGUub3V0cHV0cy5zb21lKG8gPT4gby5vdXRwdXRJZCA9PT0gb3V0cHV0SWQpKTtcblx0XHRpZiAoZWRpdCkge1xuXHRcdFx0aWYgKCdpbmRleCcgaW4gZWRpdCkge1xuXHRcdFx0XHRyZXR1cm4gZWRpdC5pbmRleDtcblx0XHRcdH0gZWxzZSBpZiAoJ2hhbmRsZScgaW4gZWRpdCkge1xuXHRcdFx0XHRjb25zdCBjZWxsSW5kZXggPSB0aGlzLl9nZXRDZWxsSW5kZXhCeUhhbmRsZShlZGl0LmhhbmRsZSk7XG5cdFx0XHRcdHRoaXMuX2Fzc2VydEluZGV4KGNlbGxJbmRleCk7XG5cdFx0XHRcdHJldHVybiBjZWxsSW5kZXg7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIC0xO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0Q2VsbEluZGV4V2l0aE91dHB1dElkSGFuZGxlKG91dHB1dElkOiBzdHJpbmcpIHtcblx0XHRyZXR1cm4gdGhpcy5jZWxscy5maW5kSW5kZXgoYyA9PiAhIWMub3V0cHV0cy5maW5kKG8gPT4gby5vdXRwdXRJZCA9PT0gb3V0cHV0SWQpKTtcblx0fVxuXG5cdHJlc2V0KGNlbGxzOiBJQ2VsbER0bzJbXSwgbWV0YWRhdGE6IE5vdGVib29rRG9jdW1lbnRNZXRhZGF0YSwgdHJhbnNpZW50T3B0aW9uczogVHJhbnNpZW50T3B0aW9ucyk6IHZvaWQge1xuXHRcdHRoaXMudHJhbnNpZW50T3B0aW9ucyA9IHRyYW5zaWVudE9wdGlvbnM7XG5cdFx0Y29uc3QgZXhlY3V0aW9ucyA9IHRoaXMuX25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmdldENlbGxFeGVjdXRpb25zRm9yTm90ZWJvb2sodGhpcy51cmkpO1xuXHRcdGNvbnN0IGV4ZWN1dGluZ0NlbGxIYW5kbGVzID0gZXhlY3V0aW9ucy5maWx0ZXIoZXhlID0+IGV4ZS5zdGF0ZSA9PT0gTm90ZWJvb2tDZWxsRXhlY3V0aW9uU3RhdGUuRXhlY3V0aW5nKS5tYXAoZXhlID0+IGV4ZS5jZWxsSGFuZGxlKTtcblx0XHRjb25zdCBlZGl0cyA9IE5vdGVib29rVGV4dE1vZGVsLmNvbXB1dGVFZGl0cyh0aGlzLCBjZWxscywgZXhlY3V0aW5nQ2VsbEhhbmRsZXMpO1xuXG5cdFx0dGhpcy5hcHBseUVkaXRzKFxuXHRcdFx0W1xuXHRcdFx0XHQuLi5lZGl0cyxcblx0XHRcdFx0eyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLkRvY3VtZW50TWV0YWRhdGEsIG1ldGFkYXRhIH1cblx0XHRcdF0sXG5cdFx0XHR0cnVlLFxuXHRcdFx0dW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQsXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRmYWxzZVxuXHRcdCk7XG5cdH1cblxuXHRjcmVhdGVTbmFwc2hvdChvcHRpb25zOiBJTm90ZWJvb2tTbmFwc2hvdE9wdGlvbnMpOiBOb3RlYm9va0RhdGEge1xuXHRcdGNvbnN0IHRyYW5zaWVudE9wdGlvbnMgPSBvcHRpb25zLnRyYW5zaWVudE9wdGlvbnMgPz8gdGhpcy50cmFuc2llbnRPcHRpb25zO1xuXHRcdGNvbnN0IGRhdGE6IE5vdGVib29rRGF0YSA9IHtcblx0XHRcdG1ldGFkYXRhOiBmaWx0ZXIodGhpcy5tZXRhZGF0YSwga2V5ID0+ICF0cmFuc2llbnRPcHRpb25zLnRyYW5zaWVudERvY3VtZW50TWV0YWRhdGFba2V5XSksXG5cdFx0XHRjZWxsczogW10sXG5cdFx0fTtcblxuXHRcdGxldCBvdXRwdXRTaXplID0gMDtcblx0XHRmb3IgKGNvbnN0IGNlbGwgb2YgdGhpcy5jZWxscykge1xuXHRcdFx0Y29uc3QgY2VsbERhdGE6IElDZWxsRHRvMiA9IHtcblx0XHRcdFx0Y2VsbEtpbmQ6IGNlbGwuY2VsbEtpbmQsXG5cdFx0XHRcdGxhbmd1YWdlOiBjZWxsLmxhbmd1YWdlLFxuXHRcdFx0XHRtaW1lOiBjZWxsLm1pbWUsXG5cdFx0XHRcdHNvdXJjZTogY2VsbC5nZXRWYWx1ZSgpLFxuXHRcdFx0XHRvdXRwdXRzOiBbXSxcblx0XHRcdFx0aW50ZXJuYWxNZXRhZGF0YTogY2VsbC5pbnRlcm5hbE1ldGFkYXRhXG5cdFx0XHR9O1xuXG5cdFx0XHRpZiAob3B0aW9ucy5jb250ZXh0ID09PSBTbmFwc2hvdENvbnRleHQuQmFja3VwICYmIG9wdGlvbnMub3V0cHV0U2l6ZUxpbWl0ID4gMCkge1xuXHRcdFx0XHRjZWxsLm91dHB1dHMuZm9yRWFjaChvdXRwdXQgPT4ge1xuXHRcdFx0XHRcdG91dHB1dC5vdXRwdXRzLmZvckVhY2goaXRlbSA9PiB7XG5cdFx0XHRcdFx0XHRvdXRwdXRTaXplICs9IGl0ZW0uZGF0YS5ieXRlTGVuZ3RoO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0aWYgKG91dHB1dFNpemUgPiBvcHRpb25zLm91dHB1dFNpemVMaW1pdCkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignTm90ZWJvb2sgdG9vIGxhcmdlIHRvIGJhY2t1cCcpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNlbGxEYXRhLm91dHB1dHMgPSAhdHJhbnNpZW50T3B0aW9ucy50cmFuc2llbnRPdXRwdXRzID8gY2VsbC5vdXRwdXRzIDogW107XG5cdFx0XHRjZWxsRGF0YS5tZXRhZGF0YSA9IGZpbHRlcihjZWxsLm1ldGFkYXRhLCBrZXkgPT4gIXRyYW5zaWVudE9wdGlvbnMudHJhbnNpZW50Q2VsbE1ldGFkYXRhW2tleV0pO1xuXG5cdFx0XHRkYXRhLmNlbGxzLnB1c2goY2VsbERhdGEpO1xuXHRcdH1cblxuXHRcdHJldHVybiBkYXRhO1xuXHR9XG5cblx0cmVzdG9yZVNuYXBzaG90KHNuYXBzaG90OiBOb3RlYm9va0RhdGEsIHRyYW5zaWVudE9wdGlvbnM/OiBUcmFuc2llbnRPcHRpb25zKTogdm9pZCB7XG5cdFx0dGhpcy5yZXNldChzbmFwc2hvdC5jZWxscywgc25hcHNob3QubWV0YWRhdGEsIHRyYW5zaWVudE9wdGlvbnMgPz8gdGhpcy50cmFuc2llbnRPcHRpb25zKTtcblx0fVxuXG5cdHN0YXRpYyBjb21wdXRlRWRpdHMobW9kZWw6IE5vdGVib29rVGV4dE1vZGVsLCBjZWxsczogSUNlbGxEdG8yW10sIGV4ZWN1dGluZ0hhbmRsZXM6IG51bWJlcltdID0gW10pOiBJQ2VsbEVkaXRPcGVyYXRpb25bXSB7XG5cdFx0Y29uc3QgZWRpdHM6IElDZWxsRWRpdE9wZXJhdGlvbltdID0gW107XG5cdFx0Y29uc3QgaXNFeGVjdXRpbmcgPSAoY2VsbDogTm90ZWJvb2tDZWxsVGV4dE1vZGVsKSA9PiBleGVjdXRpbmdIYW5kbGVzLmluY2x1ZGVzKGNlbGwuaGFuZGxlKTtcblxuXHRcdGNvbnN0IGNvbW1vblByZWZpeCA9IHRoaXMuX2NvbW1vblByZWZpeChtb2RlbC5jZWxscywgbW9kZWwuY2VsbHMubGVuZ3RoLCAwLCBjZWxscywgY2VsbHMubGVuZ3RoLCAwLCBpc0V4ZWN1dGluZyk7XG5cblx0XHRpZiAoY29tbW9uUHJlZml4ID4gMCkge1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjb21tb25QcmVmaXg7IGkrKykge1xuXHRcdFx0XHRlZGl0cy5wdXNoKFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuTWV0YWRhdGEsXG5cdFx0XHRcdFx0XHRpbmRleDogaSxcblx0XHRcdFx0XHRcdG1ldGFkYXRhOiBjZWxsc1tpXS5tZXRhZGF0YSA/PyB7fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Li4udGhpcy5fY29tcHV0ZU91dHB1dEVkaXQoaSwgbW9kZWwuY2VsbHNbaV0ub3V0cHV0cywgY2VsbHNbaV0ub3V0cHV0cylcblx0XHRcdFx0KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAobW9kZWwuY2VsbHMubGVuZ3RoID09PSBjZWxscy5sZW5ndGggJiYgY29tbW9uUHJlZml4ID09PSBtb2RlbC5jZWxscy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBlZGl0cztcblx0XHR9XG5cblx0XHRjb25zdCBjb21tb25TdWZmaXggPSB0aGlzLl9jb21tb25TdWZmaXgobW9kZWwuY2VsbHMsIG1vZGVsLmNlbGxzLmxlbmd0aCAtIGNvbW1vblByZWZpeCwgY29tbW9uUHJlZml4LCBjZWxscywgY2VsbHMubGVuZ3RoIC0gY29tbW9uUHJlZml4LCBjb21tb25QcmVmaXgsIGlzRXhlY3V0aW5nKTtcblxuXHRcdGlmIChjb21tb25TdWZmaXggPiAwKSB7XG5cdFx0XHRlZGl0cy5wdXNoKHsgZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLCBpbmRleDogY29tbW9uUHJlZml4LCBjb3VudDogbW9kZWwuY2VsbHMubGVuZ3RoIC0gY29tbW9uUHJlZml4IC0gY29tbW9uU3VmZml4LCBjZWxsczogY2VsbHMuc2xpY2UoY29tbW9uUHJlZml4LCBjZWxscy5sZW5ndGggLSBjb21tb25TdWZmaXgpIH0pO1xuXHRcdH0gZWxzZSBpZiAoY29tbW9uUHJlZml4ID4gMCkge1xuXHRcdFx0ZWRpdHMucHVzaCh7IGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUmVwbGFjZSwgaW5kZXg6IGNvbW1vblByZWZpeCwgY291bnQ6IG1vZGVsLmNlbGxzLmxlbmd0aCAtIGNvbW1vblByZWZpeCwgY2VsbHM6IGNlbGxzLnNsaWNlKGNvbW1vblByZWZpeCkgfSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGVkaXRzLnB1c2goeyBlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsIGluZGV4OiAwLCBjb3VudDogbW9kZWwuY2VsbHMubGVuZ3RoLCBjZWxscyB9KTtcblx0XHR9XG5cblx0XHRpZiAoY29tbW9uU3VmZml4ID4gMCkge1xuXHRcdFx0Ly8gaGFzIHNhbWUgc3VmZml4XG5cdFx0XHRmb3IgKGxldCBpID0gY29tbW9uU3VmZml4OyBpID4gMDsgaS0tKSB7XG5cdFx0XHRcdGVkaXRzLnB1c2goXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5NZXRhZGF0YSxcblx0XHRcdFx0XHRcdGluZGV4OiBtb2RlbC5jZWxscy5sZW5ndGggLSBpLFxuXHRcdFx0XHRcdFx0bWV0YWRhdGE6IGNlbGxzW2NlbGxzLmxlbmd0aCAtIGldLm1ldGFkYXRhID8/IHt9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHQuLi50aGlzLl9jb21wdXRlT3V0cHV0RWRpdChtb2RlbC5jZWxscy5sZW5ndGggLSBpLCBtb2RlbC5jZWxsc1ttb2RlbC5jZWxscy5sZW5ndGggLSBpXS5vdXRwdXRzLCBjZWxsc1tjZWxscy5sZW5ndGggLSBpXS5vdXRwdXRzKVxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBlZGl0cztcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9jb21wdXRlT3V0cHV0RWRpdChpbmRleDogbnVtYmVyLCBhOiBJQ2VsbE91dHB1dFtdLCBiOiBJT3V0cHV0RHRvW10pOiBJQ2VsbEVkaXRPcGVyYXRpb25bXSB7XG5cdFx0aWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuT3V0cHV0LFxuXHRcdFx0XHRcdGluZGV4OiBpbmRleCxcblx0XHRcdFx0XHRvdXRwdXRzOiBiLFxuXHRcdFx0XHRcdGFwcGVuZDogZmFsc2Vcblx0XHRcdFx0fVxuXHRcdFx0XTtcblx0XHR9XG5cblx0XHRpZiAoYS5sZW5ndGggPT09IDApIHtcblx0XHRcdC8vIG5vIG91dHB1dFxuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdC8vIHNhbWUgbGVuZ3RoXG5cdFx0cmV0dXJuIGIubWFwKChvdXRwdXQsIGkpID0+IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuT3V0cHV0SXRlbXMsXG5cdFx0XHRcdG91dHB1dElkOiBhW2ldLm91dHB1dElkLFxuXHRcdFx0XHRpdGVtczogb3V0cHV0Lm91dHB1dHMsXG5cdFx0XHRcdGFwcGVuZDogZmFsc2Vcblx0XHRcdH07XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfY29tbW9uUHJlZml4KGE6IHJlYWRvbmx5IE5vdGVib29rQ2VsbFRleHRNb2RlbFtdLCBhTGVuOiBudW1iZXIsIGFEZWx0YTogbnVtYmVyLCBiOiBJQ2VsbER0bzJbXSwgYkxlbjogbnVtYmVyLCBiRGVsdGE6IG51bWJlciwgaXNFeGVjdXRpbmc6IChjZWxsOiBOb3RlYm9va0NlbGxUZXh0TW9kZWwpID0+IGJvb2xlYW4pOiBudW1iZXIge1xuXHRcdGNvbnN0IG1heFJlc3VsdCA9IE1hdGgubWluKGFMZW4sIGJMZW4pO1xuXHRcdGxldCByZXN1bHQgPSAwO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbWF4UmVzdWx0ICYmIGFbYURlbHRhICsgaV0uZmFzdEVxdWFsKGJbYkRlbHRhICsgaV0sIGlzRXhlY3V0aW5nKGFbYURlbHRhICsgaV0pKTsgaSsrKSB7XG5cdFx0XHRyZXN1bHQrKztcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2NvbW1vblN1ZmZpeChhOiByZWFkb25seSBOb3RlYm9va0NlbGxUZXh0TW9kZWxbXSwgYUxlbjogbnVtYmVyLCBhRGVsdGE6IG51bWJlciwgYjogSUNlbGxEdG8yW10sIGJMZW46IG51bWJlciwgYkRlbHRhOiBudW1iZXIsIGlzRXhlY3V0aW5nOiAoY2VsbDogTm90ZWJvb2tDZWxsVGV4dE1vZGVsKSA9PiBib29sZWFuKTogbnVtYmVyIHtcblx0XHRjb25zdCBtYXhSZXN1bHQgPSBNYXRoLm1pbihhTGVuLCBiTGVuKTtcblx0XHRsZXQgcmVzdWx0ID0gMDtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG1heFJlc3VsdCAmJiBhW2FEZWx0YSArIGFMZW4gLSBpIC0gMV0uZmFzdEVxdWFsKGJbYkRlbHRhICsgYkxlbiAtIGkgLSAxXSwgaXNFeGVjdXRpbmcoYVthRGVsdGEgKyBhTGVuIC0gaSAtIDFdKSk7IGkrKykge1xuXHRcdFx0cmVzdWx0Kys7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIG5ld0NlbGxzRnJvbUxhc3RFZGl0ID0gbmV3IFNldDxudW1iZXI+KCk7XG5cdHByaXZhdGUgaXNPbmx5RWRpdGluZ01ldGFkYXRhT25OZXdDZWxscyhyYXdFZGl0czogSUNlbGxFZGl0T3BlcmF0aW9uW10pOiBib29sZWFuIHtcblx0XHRmb3IgKGNvbnN0IGVkaXQgb2YgcmF3RWRpdHMpIHtcblx0XHRcdGlmIChlZGl0LmVkaXRUeXBlID09PSBDZWxsRWRpdFR5cGUuUGFydGlhbEludGVybmFsTWV0YWRhdGEpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZWRpdC5lZGl0VHlwZSAhPT0gQ2VsbEVkaXRUeXBlLk1ldGFkYXRhICYmIGVkaXQuZWRpdFR5cGUgIT09IENlbGxFZGl0VHlwZS5QYXJ0aWFsTWV0YWRhdGEpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoKCdpbmRleCcgaW4gZWRpdCkgJiYgIXRoaXMubmV3Q2VsbHNGcm9tTGFzdEVkaXQuaGFzKHRoaXMuY2VsbHNbZWRpdC5pbmRleF0uaGFuZGxlKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoJ2hhbmRsZScgaW4gZWRpdCAmJiAhdGhpcy5uZXdDZWxsc0Zyb21MYXN0RWRpdC5oYXMoZWRpdC5oYW5kbGUpKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGFwcGx5RWRpdHMocmF3RWRpdHM6IElDZWxsRWRpdE9wZXJhdGlvbltdLCBzeW5jaHJvbm91czogYm9vbGVhbiwgYmVnaW5TZWxlY3Rpb25TdGF0ZTogSVNlbGVjdGlvblN0YXRlIHwgdW5kZWZpbmVkLCBlbmRTZWxlY3Rpb25zQ29tcHV0ZXI6ICgpID0+IElTZWxlY3Rpb25TdGF0ZSB8IHVuZGVmaW5lZCwgdW5kb1JlZG9Hcm91cDogVW5kb1JlZG9Hcm91cCB8IHVuZGVmaW5lZCwgY29tcHV0ZVVuZG9SZWRvOiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0dGhpcy5fcGF1c2VhYmxlRW1pdHRlci5wYXVzZSgpO1xuXHRcdHRoaXMuX29wZXJhdGlvbk1hbmFnZXIucHVzaFN0YWNrRWxlbWVudCh0aGlzLl9hbHRlcm5hdGl2ZVZlcnNpb25JZCwgdW5kZWZpbmVkKTtcblxuXHRcdGlmIChjb21wdXRlVW5kb1JlZG8gJiYgdGhpcy5pc09ubHlFZGl0aW5nTWV0YWRhdGFPbk5ld0NlbGxzKHJhd0VkaXRzKSkge1xuXHRcdFx0aWYgKCF0aGlzLl9vcGVyYXRpb25NYW5hZ2VyLmFwcGVuZFByZXZpb3VzT3BlcmF0aW9uKCkpIHtcblx0XHRcdFx0Ly8gd2UgY2FuJ3QgYXBwZW5kIHRoZSBwcmV2aW91cyBvcGVyYXRpb24sIHNvIGp1c3QgZG9uJ3QgY29tcHV0ZSB1bmRvL3JlZG9cblx0XHRcdFx0Y29tcHV0ZVVuZG9SZWRvID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChjb21wdXRlVW5kb1JlZG8pIHtcblx0XHRcdHRoaXMubmV3Q2VsbHNGcm9tTGFzdEVkaXQuY2xlYXIoKTtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0dGhpcy5fZG9BcHBseUVkaXRzKHJhd0VkaXRzLCBzeW5jaHJvbm91cywgY29tcHV0ZVVuZG9SZWRvLCBiZWdpblNlbGVjdGlvblN0YXRlLCB1bmRvUmVkb0dyb3VwKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRpZiAoIXRoaXMuX3BhdXNlYWJsZUVtaXR0ZXIuaXNFbXB0eSkge1xuXHRcdFx0XHQvLyBVcGRhdGUgc2VsZWN0aW9uIGFuZCB2ZXJzaW9uSWQgYWZ0ZXIgYXBwbHlpbmcgZWRpdHMuXG5cdFx0XHRcdGNvbnN0IGVuZFNlbGVjdGlvbnMgPSBlbmRTZWxlY3Rpb25zQ29tcHV0ZXIoKTtcblx0XHRcdFx0dGhpcy5faW5jcmVhc2VWZXJzaW9uSWQodGhpcy5fb3BlcmF0aW9uTWFuYWdlci5pc1VuZG9TdGFja0VtcHR5KCkgJiYgIXRoaXMuX3BhdXNlYWJsZUVtaXR0ZXIuaXNEaXJ0eUV2ZW50KCkpO1xuXG5cdFx0XHRcdC8vIEZpbmFsaXplIHVuZG8gZWxlbWVudFxuXHRcdFx0XHR0aGlzLl9vcGVyYXRpb25NYW5hZ2VyLnB1c2hTdGFja0VsZW1lbnQodGhpcy5fYWx0ZXJuYXRpdmVWZXJzaW9uSWQsIGVuZFNlbGVjdGlvbnMpO1xuXG5cdFx0XHRcdC8vIEJyb2FkY2FzdCBjaGFuZ2VzXG5cdFx0XHRcdHRoaXMuX3BhdXNlYWJsZUVtaXR0ZXIuZmlyZSh7IHJhd0V2ZW50czogW10sIHZlcnNpb25JZDogdGhpcy52ZXJzaW9uSWQsIHN5bmNocm9ub3VzOiBzeW5jaHJvbm91cywgZW5kU2VsZWN0aW9uU3RhdGU6IGVuZFNlbGVjdGlvbnMgfSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9wYXVzZWFibGVFbWl0dGVyLnJlc3VtZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2RvQXBwbHlFZGl0cyhyYXdFZGl0czogSUNlbGxFZGl0T3BlcmF0aW9uW10sIHN5bmNocm9ub3VzOiBib29sZWFuLCBjb21wdXRlVW5kb1JlZG86IGJvb2xlYW4sIGJlZ2luU2VsZWN0aW9uU3RhdGU6IElTZWxlY3Rpb25TdGF0ZSB8IHVuZGVmaW5lZCwgdW5kb1JlZG9Hcm91cDogVW5kb1JlZG9Hcm91cCB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNvbnN0IGVkaXRzV2l0aERldGFpbHMgPSByYXdFZGl0cy5tYXAoKGVkaXQsIGluZGV4KSA9PiB7XG5cdFx0XHRsZXQgY2VsbEluZGV4OiBudW1iZXIgPSAtMTtcblx0XHRcdGlmICgnaW5kZXgnIGluIGVkaXQpIHtcblx0XHRcdFx0Y2VsbEluZGV4ID0gZWRpdC5pbmRleDtcblx0XHRcdH0gZWxzZSBpZiAoJ2hhbmRsZScgaW4gZWRpdCkge1xuXHRcdFx0XHRjZWxsSW5kZXggPSB0aGlzLl9nZXRDZWxsSW5kZXhCeUhhbmRsZShlZGl0LmhhbmRsZSk7XG5cdFx0XHRcdHRoaXMuX2Fzc2VydEluZGV4KGNlbGxJbmRleCk7XG5cdFx0XHR9IGVsc2UgaWYgKCdvdXRwdXRJZCcgaW4gZWRpdCkge1xuXHRcdFx0XHRjZWxsSW5kZXggPSB0aGlzLl9nZXRDZWxsSW5kZXhXaXRoT3V0cHV0SWRIYW5kbGUoZWRpdC5vdXRwdXRJZCk7XG5cdFx0XHRcdGlmICh0aGlzLl9pbmRleElzSW52YWxpZChjZWxsSW5kZXgpKSB7XG5cdFx0XHRcdFx0Ly8gVGhlIHJlZmVyZW5jZWQgb3V0cHV0IG1heSBoYXZlIGJlZW4gY3JlYXRlZCBpbiB0aGlzIGJhdGNoIG9mIGVkaXRzXG5cdFx0XHRcdFx0Y2VsbEluZGV4ID0gdGhpcy5fZ2V0Q2VsbEluZGV4V2l0aE91dHB1dElkSGFuZGxlRnJvbUVkaXRzKGVkaXQub3V0cHV0SWQsIHJhd0VkaXRzLnNsaWNlKDAsIGluZGV4KSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGhpcy5faW5kZXhJc0ludmFsaWQoY2VsbEluZGV4KSkge1xuXHRcdFx0XHRcdC8vIEl0J3MgcG9zc2libGUgZm9yIGFuIGVkaXQgdG8gcmVmZXIgdG8gYW4gb3V0cHV0IHdoaWNoIHdhcyBqdXN0IGNsZWFyZWQsIGlnbm9yZSBpdCB3aXRob3V0IHRocm93aW5nXG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoZWRpdC5lZGl0VHlwZSAhPT0gQ2VsbEVkaXRUeXBlLkRvY3VtZW50TWV0YWRhdGEpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNlbGwgZWRpdCcpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRlZGl0LFxuXHRcdFx0XHRjZWxsSW5kZXgsXG5cdFx0XHRcdGVuZDpcblx0XHRcdFx0XHQoZWRpdC5lZGl0VHlwZSA9PT0gQ2VsbEVkaXRUeXBlLkRvY3VtZW50TWV0YWRhdGEpXG5cdFx0XHRcdFx0XHQ/IHVuZGVmaW5lZFxuXHRcdFx0XHRcdFx0OiAoZWRpdC5lZGl0VHlwZSA9PT0gQ2VsbEVkaXRUeXBlLlJlcGxhY2UgPyBlZGl0LmluZGV4ICsgZWRpdC5jb3VudCA6IGNlbGxJbmRleCksXG5cdFx0XHRcdG9yaWdpbmFsSW5kZXg6IGluZGV4XG5cdFx0XHR9O1xuXHRcdH0pLmZpbHRlcihpc0RlZmluZWQpO1xuXG5cdFx0Ly8gY29tcHJlc3MgYWxsIGVkaXRzIHdoaWNoIGhhdmUgbm8gc2lkZSBlZmZlY3RzIG9uIGNlbGwgaW5kZXhcblx0XHRjb25zdCBlZGl0cyA9IHRoaXMuX21lcmdlQ2VsbEVkaXRzKGVkaXRzV2l0aERldGFpbHMpXG5cdFx0XHQuc29ydCgoYSwgYikgPT4ge1xuXHRcdFx0XHRpZiAoYS5lbmQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChiLmVuZCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGIuZW5kIC0gYS5lbmQgfHwgYi5vcmlnaW5hbEluZGV4IC0gYS5vcmlnaW5hbEluZGV4O1xuXHRcdFx0fSkucmVkdWNlKChwcmV2LCBjdXJyKSA9PiB7XG5cdFx0XHRcdGlmICghcHJldi5sZW5ndGgpIHtcblx0XHRcdFx0XHQvLyBlbXB0eVxuXHRcdFx0XHRcdHByZXYucHVzaChbY3Vycl0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGxhc3QgPSBwcmV2W3ByZXYubGVuZ3RoIC0gMV07XG5cdFx0XHRcdFx0Y29uc3QgaW5kZXggPSBsYXN0WzBdLmNlbGxJbmRleDtcblxuXHRcdFx0XHRcdGlmIChjdXJyLmNlbGxJbmRleCA9PT0gaW5kZXgpIHtcblx0XHRcdFx0XHRcdGxhc3QucHVzaChjdXJyKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cHJldi5wdXNoKFtjdXJyXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHByZXY7XG5cdFx0XHR9LCBbXSBhcyBUcmFuc2Zvcm1lZEVkaXRbXVtdKS5tYXAoZWRpdHNPblNhbWVJbmRleCA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlcGxhY2VFZGl0czogVHJhbnNmb3JtZWRFZGl0W10gPSBbXTtcblx0XHRcdFx0Y29uc3Qgb3RoZXJFZGl0czogVHJhbnNmb3JtZWRFZGl0W10gPSBbXTtcblxuXHRcdFx0XHRlZGl0c09uU2FtZUluZGV4LmZvckVhY2goZWRpdCA9PiB7XG5cdFx0XHRcdFx0aWYgKGVkaXQuZWRpdC5lZGl0VHlwZSA9PT0gQ2VsbEVkaXRUeXBlLlJlcGxhY2UpIHtcblx0XHRcdFx0XHRcdHJlcGxhY2VFZGl0cy5wdXNoKGVkaXQpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRvdGhlckVkaXRzLnB1c2goZWRpdCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRyZXR1cm4gWy4uLm90aGVyRWRpdHMucmV2ZXJzZSgpLCAuLi5yZXBsYWNlRWRpdHNdO1xuXHRcdFx0fSk7XG5cblx0XHRjb25zdCBmbGF0dGVuRWRpdHMgPSBlZGl0cy5mbGF0KCk7XG5cblx0XHRmb3IgKGNvbnN0IHsgZWRpdCwgY2VsbEluZGV4IH0gb2YgZmxhdHRlbkVkaXRzKSB7XG5cdFx0XHRzd2l0Y2ggKGVkaXQuZWRpdFR5cGUpIHtcblx0XHRcdFx0Y2FzZSBDZWxsRWRpdFR5cGUuUmVwbGFjZTpcblx0XHRcdFx0XHR0aGlzLl9yZXBsYWNlQ2VsbHMoZWRpdC5pbmRleCwgZWRpdC5jb3VudCwgZWRpdC5jZWxscywgc3luY2hyb25vdXMsIGNvbXB1dGVVbmRvUmVkbywgYmVnaW5TZWxlY3Rpb25TdGF0ZSwgdW5kb1JlZG9Hcm91cCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgQ2VsbEVkaXRUeXBlLk91dHB1dDoge1xuXHRcdFx0XHRcdHRoaXMuX2Fzc2VydEluZGV4KGNlbGxJbmRleCk7XG5cdFx0XHRcdFx0Y29uc3QgY2VsbCA9IHRoaXMuX2NlbGxzW2NlbGxJbmRleF07XG5cdFx0XHRcdFx0aWYgKGVkaXQuYXBwZW5kKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9zcGxpY2VOb3RlYm9va0NlbGxPdXRwdXRzKGNlbGwsIHsgc3RhcnQ6IGNlbGwub3V0cHV0cy5sZW5ndGgsIGRlbGV0ZUNvdW50OiAwLCBuZXdPdXRwdXRzOiBlZGl0Lm91dHB1dHMubWFwKG9wID0+IG5ldyBOb3RlYm9va0NlbGxPdXRwdXRUZXh0TW9kZWwob3ApKSB9LCB0cnVlLCBjb21wdXRlVW5kb1JlZG8pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9zcGxpY2VOb3RlYm9va0NlbGxPdXRwdXRzMihjZWxsLCBlZGl0Lm91dHB1dHMsIGNvbXB1dGVVbmRvUmVkbyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgQ2VsbEVkaXRUeXBlLk91dHB1dEl0ZW1zOlxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHRoaXMuX2Fzc2VydEluZGV4KGNlbGxJbmRleCk7XG5cdFx0XHRcdFx0XHRjb25zdCBjZWxsID0gdGhpcy5fY2VsbHNbY2VsbEluZGV4XTtcblx0XHRcdFx0XHRcdGlmIChlZGl0LmFwcGVuZCkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9hcHBlbmROb3RlYm9va0NlbGxPdXRwdXRJdGVtcyhjZWxsLCBlZGl0Lm91dHB1dElkLCBlZGl0Lml0ZW1zKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX3JlcGxhY2VOb3RlYm9va0NlbGxPdXRwdXRJdGVtcyhjZWxsLCBlZGl0Lm91dHB1dElkLCBlZGl0Lml0ZW1zKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Y2FzZSBDZWxsRWRpdFR5cGUuTWV0YWRhdGE6XG5cdFx0XHRcdFx0dGhpcy5fYXNzZXJ0SW5kZXgoZWRpdC5pbmRleCk7XG5cdFx0XHRcdFx0dGhpcy5fY2hhbmdlQ2VsbE1ldGFkYXRhKHRoaXMuX2NlbGxzW2VkaXQuaW5kZXhdLCBlZGl0Lm1ldGFkYXRhLCBjb21wdXRlVW5kb1JlZG8sIGJlZ2luU2VsZWN0aW9uU3RhdGUsIHVuZG9SZWRvR3JvdXApO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIENlbGxFZGl0VHlwZS5QYXJ0aWFsTWV0YWRhdGE6XG5cdFx0XHRcdFx0dGhpcy5fYXNzZXJ0SW5kZXgoY2VsbEluZGV4KTtcblx0XHRcdFx0XHR0aGlzLl9jaGFuZ2VDZWxsTWV0YWRhdGFQYXJ0aWFsKHRoaXMuX2NlbGxzW2NlbGxJbmRleF0sIGVkaXQubWV0YWRhdGEsIGNvbXB1dGVVbmRvUmVkbywgYmVnaW5TZWxlY3Rpb25TdGF0ZSwgdW5kb1JlZG9Hcm91cCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgQ2VsbEVkaXRUeXBlLlBhcnRpYWxJbnRlcm5hbE1ldGFkYXRhOlxuXHRcdFx0XHRcdHRoaXMuX2Fzc2VydEluZGV4KGNlbGxJbmRleCk7XG5cdFx0XHRcdFx0dGhpcy5fY2hhbmdlQ2VsbEludGVybmFsTWV0YWRhdGFQYXJ0aWFsKHRoaXMuX2NlbGxzW2NlbGxJbmRleF0sIGVkaXQuaW50ZXJuYWxNZXRhZGF0YSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgQ2VsbEVkaXRUeXBlLkNlbGxMYW5ndWFnZTpcblx0XHRcdFx0XHR0aGlzLl9hc3NlcnRJbmRleChlZGl0LmluZGV4KTtcblx0XHRcdFx0XHR0aGlzLl9jaGFuZ2VDZWxsTGFuZ3VhZ2UodGhpcy5fY2VsbHNbZWRpdC5pbmRleF0sIGVkaXQubGFuZ3VhZ2UsIGNvbXB1dGVVbmRvUmVkbywgYmVnaW5TZWxlY3Rpb25TdGF0ZSwgdW5kb1JlZG9Hcm91cCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgQ2VsbEVkaXRUeXBlLkRvY3VtZW50TWV0YWRhdGE6XG5cdFx0XHRcdFx0dGhpcy5fdXBkYXRlTm90ZWJvb2tDZWxsTWV0YWRhdGEoZWRpdC5tZXRhZGF0YSwgY29tcHV0ZVVuZG9SZWRvLCBiZWdpblNlbGVjdGlvblN0YXRlLCB1bmRvUmVkb0dyb3VwKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBDZWxsRWRpdFR5cGUuTW92ZTpcblx0XHRcdFx0XHR0aGlzLl9tb3ZlQ2VsbFRvSWR4KGVkaXQuaW5kZXgsIGVkaXQubGVuZ3RoLCBlZGl0Lm5ld0lkeCwgc3luY2hyb25vdXMsIGNvbXB1dGVVbmRvUmVkbywgYmVnaW5TZWxlY3Rpb25TdGF0ZSwgdW5kZWZpbmVkLCB1bmRvUmVkb0dyb3VwKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9tZXJnZUNlbGxFZGl0cyhyYXdFZGl0czogVHJhbnNmb3JtZWRFZGl0W10pOiBUcmFuc2Zvcm1lZEVkaXRbXSB7XG5cdFx0Y29uc3QgbWVyZ2VkRWRpdHM6IFRyYW5zZm9ybWVkRWRpdFtdID0gW107XG5cblx0XHRyYXdFZGl0cy5mb3JFYWNoKGVkaXQgPT4ge1xuXHRcdFx0aWYgKG1lcmdlZEVkaXRzLmxlbmd0aCkge1xuXHRcdFx0XHRjb25zdCBsYXN0ID0gbWVyZ2VkRWRpdHNbbWVyZ2VkRWRpdHMubGVuZ3RoIC0gMV07XG5cblx0XHRcdFx0aWYgKGxhc3QuZWRpdC5lZGl0VHlwZSA9PT0gQ2VsbEVkaXRUeXBlLk91dHB1dFxuXHRcdFx0XHRcdCYmIGxhc3QuZWRpdC5hcHBlbmRcblx0XHRcdFx0XHQmJiBlZGl0LmVkaXQuZWRpdFR5cGUgPT09IENlbGxFZGl0VHlwZS5PdXRwdXRcblx0XHRcdFx0XHQmJiBlZGl0LmVkaXQuYXBwZW5kXG5cdFx0XHRcdFx0JiYgbGFzdC5jZWxsSW5kZXggPT09IGVkaXQuY2VsbEluZGV4XG5cdFx0XHRcdCkge1xuXHRcdFx0XHRcdGxhc3QuZWRpdC5vdXRwdXRzID0gWy4uLmxhc3QuZWRpdC5vdXRwdXRzLCAuLi5lZGl0LmVkaXQub3V0cHV0c107XG5cdFx0XHRcdH0gZWxzZSBpZiAobGFzdC5lZGl0LmVkaXRUeXBlID09PSBDZWxsRWRpdFR5cGUuT3V0cHV0XG5cdFx0XHRcdFx0JiYgIWxhc3QuZWRpdC5hcHBlbmQgLy8gbGFzdCBjZWxsIGlzIG5vdCBhcHBlbmRcblx0XHRcdFx0XHQmJiBsYXN0LmVkaXQub3V0cHV0cy5sZW5ndGggPT09IDAgLy8gbGFzdCBjZWxsIGlzIGNsZWFyIG91dHB1dHNcblx0XHRcdFx0XHQmJiBlZGl0LmVkaXQuZWRpdFR5cGUgPT09IENlbGxFZGl0VHlwZS5PdXRwdXRcblx0XHRcdFx0XHQmJiBlZGl0LmVkaXQuYXBwZW5kXG5cdFx0XHRcdFx0JiYgbGFzdC5jZWxsSW5kZXggPT09IGVkaXQuY2VsbEluZGV4XG5cdFx0XHRcdCkge1xuXHRcdFx0XHRcdGxhc3QuZWRpdC5hcHBlbmQgPSBmYWxzZTtcblx0XHRcdFx0XHRsYXN0LmVkaXQub3V0cHV0cyA9IGVkaXQuZWRpdC5vdXRwdXRzO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG1lcmdlZEVkaXRzLnB1c2goZWRpdCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1lcmdlZEVkaXRzLnB1c2goZWRpdCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gbWVyZ2VkRWRpdHM7XG5cdH1cblxuXHRwcml2YXRlIF9nZXREZWZhdWx0Q29sbGFwc2VTdGF0ZShjZWxsRHRvOiBJQ2VsbER0bzIpOiBOb3RlYm9va0NlbGxDb2xsYXBzZVN0YXRlIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBkZWZhdWx0Q29uZmlnID0gY2VsbER0by5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuQ29kZSA/IHRoaXMuX2RlZmF1bHRDb2xsYXBzZUNvbmZpZz8uY29kZUNlbGwgOiB0aGlzLl9kZWZhdWx0Q29sbGFwc2VDb25maWc/Lm1hcmt1cENlbGw7XG5cdFx0cmV0dXJuIGNlbGxEdG8uY29sbGFwc2VTdGF0ZSA/PyAoZGVmYXVsdENvbmZpZyA/PyB1bmRlZmluZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVwbGFjZUNlbGxzKGluZGV4OiBudW1iZXIsIGNvdW50OiBudW1iZXIsIGNlbGxEdG9zOiBJQ2VsbER0bzJbXSwgc3luY2hyb25vdXM6IGJvb2xlYW4sIGNvbXB1dGVVbmRvUmVkbzogYm9vbGVhbiwgYmVnaW5TZWxlY3Rpb25TdGF0ZTogSVNlbGVjdGlvblN0YXRlIHwgdW5kZWZpbmVkLCB1bmRvUmVkb0dyb3VwOiBVbmRvUmVkb0dyb3VwIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cblx0XHRpZiAoY291bnQgPT09IDAgJiYgY2VsbER0b3MubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb2xkVmlld0NlbGxzID0gdGhpcy5fY2VsbHMuc2xpY2UoMCk7XG5cdFx0Y29uc3Qgb2xkU2V0ID0gbmV3IFNldCgpO1xuXHRcdG9sZFZpZXdDZWxscy5mb3JFYWNoKGNlbGwgPT4ge1xuXHRcdFx0b2xkU2V0LmFkZChjZWxsLmhhbmRsZSk7XG5cdFx0fSk7XG5cblx0XHQvLyBwcmVwYXJlIHJlbW92ZVxuXHRcdGZvciAobGV0IGkgPSBpbmRleDsgaSA8IE1hdGgubWluKGluZGV4ICsgY291bnQsIHRoaXMuX2NlbGxzLmxlbmd0aCk7IGkrKykge1xuXHRcdFx0Y29uc3QgY2VsbCA9IHRoaXMuX2NlbGxzW2ldO1xuXHRcdFx0dGhpcy5fY2VsbExpc3RlbmVycy5nZXQoY2VsbC5oYW5kbGUpPy5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9jZWxsTGlzdGVuZXJzLmRlbGV0ZShjZWxsLmhhbmRsZSk7XG5cdFx0fVxuXG5cdFx0Ly8gcHJlcGFyZSBhZGRcblx0XHRjb25zdCBjZWxscyA9IGNlbGxEdG9zLm1hcChjZWxsRHRvID0+IHtcblx0XHRcdGNvbnN0IGNlbGxIYW5kbGUgPSB0aGlzLl9jZWxsaGFuZGxlUG9vbCsrO1xuXHRcdFx0Y29uc3QgY2VsbFVyaSA9IENlbGxVcmkuZ2VuZXJhdGUodGhpcy51cmksIGNlbGxIYW5kbGUpO1xuXHRcdFx0Y29uc3QgY29sbGFwc2VTdGF0ZSA9IHRoaXMuX2dldERlZmF1bHRDb2xsYXBzZVN0YXRlKGNlbGxEdG8pO1xuXHRcdFx0Y29uc3QgY2VsbCA9IG5ldyBOb3RlYm9va0NlbGxUZXh0TW9kZWwoXG5cdFx0XHRcdGNlbGxVcmksIGNlbGxIYW5kbGUsXG5cdFx0XHRcdGNlbGxEdG8uc291cmNlLCBjZWxsRHRvLmxhbmd1YWdlLCBjZWxsRHRvLm1pbWUsIGNlbGxEdG8uY2VsbEtpbmQsIGNlbGxEdG8ub3V0cHV0cyB8fCBbXSwgY2VsbER0by5tZXRhZGF0YSwgY2VsbER0by5pbnRlcm5hbE1ldGFkYXRhLCBjb2xsYXBzZVN0YXRlLCB0aGlzLnRyYW5zaWVudE9wdGlvbnMsXG5cdFx0XHRcdHRoaXMuX2xhbmd1YWdlU2VydmljZSxcblx0XHRcdFx0dGhpcy5fbGFuZ3VhZ2VEZXRlY3Rpb25TZXJ2aWNlXG5cdFx0XHQpO1xuXHRcdFx0Y29uc3QgdGV4dE1vZGVsID0gdGhpcy5fbW9kZWxTZXJ2aWNlLmdldE1vZGVsKGNlbGxVcmkpO1xuXHRcdFx0aWYgKHRleHRNb2RlbCAmJiB0ZXh0TW9kZWwgaW5zdGFuY2VvZiBUZXh0TW9kZWwpIHtcblx0XHRcdFx0Y2VsbC50ZXh0TW9kZWwgPSB0ZXh0TW9kZWw7XG5cdFx0XHRcdGNlbGwubGFuZ3VhZ2UgPSBjZWxsRHRvLmxhbmd1YWdlO1xuXHRcdFx0XHRjZWxsLnRleHRNb2RlbC5zZXRWYWx1ZShjZWxsRHRvLnNvdXJjZSk7XG5cdFx0XHRcdGNlbGwucmVzZXRUZXh0QnVmZmVyKGNlbGwudGV4dE1vZGVsLmdldFRleHRCdWZmZXIoKSk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBkaXJ0eVN0YXRlTGlzdGVuZXIgPSBjZWxsLm9uRGlkQ2hhbmdlQ29udGVudCgoZSkgPT4ge1xuXHRcdFx0XHR0aGlzLl9iaW5kQ2VsbENvbnRlbnRIYW5kbGVyKGNlbGwsIGUpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMubmV3Q2VsbHNGcm9tTGFzdEVkaXQuYWRkKGNlbGwuaGFuZGxlKTtcblx0XHRcdHRoaXMuX2NlbGxMaXN0ZW5lcnMuc2V0KGNlbGwuaGFuZGxlLCBkaXJ0eVN0YXRlTGlzdGVuZXIpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoY2VsbCk7XG5cdFx0XHRyZXR1cm4gY2VsbDtcblx0XHR9KTtcblxuXHRcdC8vIGNvbXB1dGUgY2hhbmdlXG5cdFx0Y29uc3QgY2VsbHNDb3B5ID0gdGhpcy5fY2VsbHMuc2xpY2UoMCk7XG5cdFx0Y2VsbHNDb3B5LnNwbGljZShpbmRleCwgY291bnQsIC4uLmNlbGxzKTtcblx0XHRjb25zdCBkaWZmcyA9IGRpZmYodGhpcy5fY2VsbHMsIGNlbGxzQ29weSwgY2VsbCA9PiB7XG5cdFx0XHRyZXR1cm4gb2xkU2V0LmhhcyhjZWxsLmhhbmRsZSk7XG5cdFx0fSkubWFwKGRpZmYgPT4ge1xuXHRcdFx0cmV0dXJuIFtkaWZmLnN0YXJ0LCBkaWZmLmRlbGV0ZUNvdW50LCBkaWZmLnRvSW5zZXJ0XSBhcyBbbnVtYmVyLCBudW1iZXIsIE5vdGVib29rQ2VsbFRleHRNb2RlbFtdXTtcblx0XHR9KTtcblx0XHR0aGlzLl9vbldpbGxBZGRSZW1vdmVDZWxscy5maXJlKHsgcmF3RXZlbnQ6IHsga2luZDogTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuTW9kZWxDaGFuZ2UsIGNoYW5nZXM6IGRpZmZzIH0gfSk7XG5cblx0XHQvLyBtYWtlIGNoYW5nZVxuXHRcdHRoaXMuX2NlbGxzID0gY2VsbHNDb3B5O1xuXG5cdFx0Y29uc3QgdW5kb0RpZmYgPSBkaWZmcy5tYXAoZGlmZiA9PiB7XG5cdFx0XHRjb25zdCBkZWxldGVkQ2VsbHMgPSBvbGRWaWV3Q2VsbHMuc2xpY2UoZGlmZlswXSwgZGlmZlswXSArIGRpZmZbMV0pO1xuXG5cdFx0XHRyZXR1cm4gW2RpZmZbMF0sIGRlbGV0ZWRDZWxscywgZGlmZlsyXV0gYXMgW251bWJlciwgTm90ZWJvb2tDZWxsVGV4dE1vZGVsW10sIE5vdGVib29rQ2VsbFRleHRNb2RlbFtdXTtcblx0XHR9KTtcblxuXHRcdGlmIChjb21wdXRlVW5kb1JlZG8pIHtcblx0XHRcdHRoaXMuX29wZXJhdGlvbk1hbmFnZXIucHVzaEVkaXRPcGVyYXRpb24obmV3IFNwbGljZUNlbGxzRWRpdCh0aGlzLnVyaSwgdW5kb0RpZmYsIHtcblx0XHRcdFx0aW5zZXJ0Q2VsbDogKGluZGV4LCBjZWxsLCBlbmRTZWxlY3Rpb25zKSA9PiB7IHRoaXMuX2luc2VydE5ld0NlbGwoaW5kZXgsIFtjZWxsXSwgdHJ1ZSwgZW5kU2VsZWN0aW9ucyk7IH0sXG5cdFx0XHRcdGRlbGV0ZUNlbGw6IChpbmRleCwgZW5kU2VsZWN0aW9ucykgPT4geyB0aGlzLl9yZW1vdmVDZWxsKGluZGV4LCAxLCB0cnVlLCBlbmRTZWxlY3Rpb25zKTsgfSxcblx0XHRcdFx0cmVwbGFjZUNlbGw6IChpbmRleCwgY291bnQsIGNlbGxzLCBlbmRTZWxlY3Rpb25zKSA9PiB7IHRoaXMuX3JlcGxhY2VOZXdDZWxscyhpbmRleCwgY291bnQsIGNlbGxzLCB0cnVlLCBlbmRTZWxlY3Rpb25zKTsgfSxcblx0XHRcdH0sIHVuZGVmaW5lZCwgdW5kZWZpbmVkKSwgYmVnaW5TZWxlY3Rpb25TdGF0ZSwgdW5kZWZpbmVkLCB0aGlzLl9hbHRlcm5hdGl2ZVZlcnNpb25JZCwgdW5kb1JlZG9Hcm91cCk7XG5cdFx0fVxuXG5cdFx0Ly8gc2hvdWxkIGJlIGRlZmVycmVkXG5cdFx0dGhpcy5fcGF1c2VhYmxlRW1pdHRlci5maXJlKHtcblx0XHRcdHJhd0V2ZW50czogW3sga2luZDogTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuTW9kZWxDaGFuZ2UsIGNoYW5nZXM6IGRpZmZzLCB0cmFuc2llbnQ6IGZhbHNlIH1dLFxuXHRcdFx0dmVyc2lvbklkOiB0aGlzLnZlcnNpb25JZCxcblx0XHRcdHN5bmNocm9ub3VzOiBzeW5jaHJvbm91cyxcblx0XHRcdGVuZFNlbGVjdGlvblN0YXRlOiB1bmRlZmluZWRcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX2luY3JlYXNlVmVyc2lvbklkKHRyYW5zaWVudDogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX3ZlcnNpb25JZCA9IHRoaXMuX3ZlcnNpb25JZCArIDE7XG5cdFx0aWYgKCF0cmFuc2llbnQpIHtcblx0XHRcdHRoaXMuX25vdGVib29rU3BlY2lmaWNBbHRlcm5hdGl2ZUlkID0gdGhpcy5fdmVyc2lvbklkO1xuXHRcdH1cblx0XHR0aGlzLl9hbHRlcm5hdGl2ZVZlcnNpb25JZCA9IHRoaXMuX2dlbmVyYXRlQWx0ZXJuYXRpdmVJZCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfb3ZlcndyaXRlQWx0ZXJuYXRpdmVWZXJzaW9uSWQobmV3QWx0ZXJuYXRpdmVWZXJzaW9uSWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX2FsdGVybmF0aXZlVmVyc2lvbklkID0gbmV3QWx0ZXJuYXRpdmVWZXJzaW9uSWQ7XG5cdFx0dGhpcy5fbm90ZWJvb2tTcGVjaWZpY0FsdGVybmF0aXZlSWQgPSBOdW1iZXIobmV3QWx0ZXJuYXRpdmVWZXJzaW9uSWQuc3Vic3RyaW5nKDAsIG5ld0FsdGVybmF0aXZlVmVyc2lvbklkLmluZGV4T2YoJ18nKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlTm90ZWJvb2tDZWxsTWV0YWRhdGEobWV0YWRhdGE6IE5vdGVib29rRG9jdW1lbnRNZXRhZGF0YSwgY29tcHV0ZVVuZG9SZWRvOiBib29sZWFuLCBiZWdpblNlbGVjdGlvblN0YXRlOiBJU2VsZWN0aW9uU3RhdGUgfCB1bmRlZmluZWQsIHVuZG9SZWRvR3JvdXA6IFVuZG9SZWRvR3JvdXAgfCB1bmRlZmluZWQpIHtcblx0XHRjb25zdCBvbGRNZXRhZGF0YSA9IHRoaXMubWV0YWRhdGE7XG5cdFx0Y29uc3QgdHJpZ2dlckRpcnR5Q2hhbmdlID0gdGhpcy5faXNEb2N1bWVudE1ldGFkYXRhQ2hhbmdlZCh0aGlzLm1ldGFkYXRhLCBtZXRhZGF0YSk7XG5cblx0XHRpZiAodHJpZ2dlckRpcnR5Q2hhbmdlKSB7XG5cdFx0XHRpZiAoY29tcHV0ZVVuZG9SZWRvKSB7XG5cdFx0XHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdFx0XHR0aGlzLl9vcGVyYXRpb25NYW5hZ2VyLnB1c2hFZGl0T3BlcmF0aW9uKG5ldyBjbGFzcyBpbXBsZW1lbnRzIElSZXNvdXJjZVVuZG9SZWRvRWxlbWVudCB7XG5cdFx0XHRcdFx0cmVhZG9ubHkgdHlwZTogVW5kb1JlZG9FbGVtZW50VHlwZS5SZXNvdXJjZSA9IFVuZG9SZWRvRWxlbWVudFR5cGUuUmVzb3VyY2U7XG5cdFx0XHRcdFx0Z2V0IHJlc291cmNlKCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoYXQudXJpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZWFkb25seSBsYWJlbCA9ICdVcGRhdGUgQ2VsbCBNZXRhZGF0YSc7XG5cdFx0XHRcdFx0cmVhZG9ubHkgY29kZSA9ICd1bmRvcmVkby50ZXh0QnVmZmVyRWRpdCc7XG5cdFx0XHRcdFx0dW5kbygpIHtcblx0XHRcdFx0XHRcdHRoYXQuX3VwZGF0ZU5vdGVib29rQ2VsbE1ldGFkYXRhKG9sZE1ldGFkYXRhLCBmYWxzZSwgYmVnaW5TZWxlY3Rpb25TdGF0ZSwgdW5kb1JlZG9Hcm91cCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJlZG8oKSB7XG5cdFx0XHRcdFx0XHR0aGF0Ll91cGRhdGVOb3RlYm9va0NlbGxNZXRhZGF0YShtZXRhZGF0YSwgZmFsc2UsIGJlZ2luU2VsZWN0aW9uU3RhdGUsIHVuZG9SZWRvR3JvdXApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSgpLCBiZWdpblNlbGVjdGlvblN0YXRlLCB1bmRlZmluZWQsIHRoaXMuX2FsdGVybmF0aXZlVmVyc2lvbklkLCB1bmRvUmVkb0dyb3VwKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLm1ldGFkYXRhID0gbWV0YWRhdGE7XG5cdFx0dGhpcy5fcGF1c2VhYmxlRW1pdHRlci5maXJlKHtcblx0XHRcdHJhd0V2ZW50czogW3sga2luZDogTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuQ2hhbmdlRG9jdW1lbnRNZXRhZGF0YSwgbWV0YWRhdGE6IHRoaXMubWV0YWRhdGEsIHRyYW5zaWVudDogIXRyaWdnZXJEaXJ0eUNoYW5nZSB9XSxcblx0XHRcdHZlcnNpb25JZDogdGhpcy52ZXJzaW9uSWQsXG5cdFx0XHRzeW5jaHJvbm91czogdHJ1ZSxcblx0XHRcdGVuZFNlbGVjdGlvblN0YXRlOiB1bmRlZmluZWRcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX2luc2VydE5ld0NlbGwoaW5kZXg6IG51bWJlciwgY2VsbHM6IE5vdGVib29rQ2VsbFRleHRNb2RlbFtdLCBzeW5jaHJvbm91czogYm9vbGVhbiwgZW5kU2VsZWN0aW9uczogSVNlbGVjdGlvblN0YXRlIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjZWxscy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgZGlydHlTdGF0ZUxpc3RlbmVyID0gY2VsbHNbaV0ub25EaWRDaGFuZ2VDb250ZW50KChlKSA9PiB7XG5cdFx0XHRcdHRoaXMuX2JpbmRDZWxsQ29udGVudEhhbmRsZXIoY2VsbHNbaV0sIGUpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMuX2NlbGxMaXN0ZW5lcnMuc2V0KGNlbGxzW2ldLmhhbmRsZSwgZGlydHlTdGF0ZUxpc3RlbmVyKTtcblx0XHR9XG5cblx0XHRjb25zdCBjaGFuZ2VzOiBOb3RlYm9va0NlbGxUZXh0TW9kZWxTcGxpY2U8SUNlbGw+W10gPSBbW2luZGV4LCAwLCBjZWxsc11dO1xuXHRcdHRoaXMuX29uV2lsbEFkZFJlbW92ZUNlbGxzLmZpcmUoeyByYXdFdmVudDogeyBraW5kOiBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5Nb2RlbENoYW5nZSwgY2hhbmdlcyB9IH0pO1xuXHRcdHRoaXMuX2NlbGxzLnNwbGljZShpbmRleCwgMCwgLi4uY2VsbHMpO1xuXHRcdHRoaXMuX3BhdXNlYWJsZUVtaXR0ZXIuZmlyZSh7XG5cdFx0XHRyYXdFdmVudHM6IFt7IGtpbmQ6IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLk1vZGVsQ2hhbmdlLCBjaGFuZ2VzLCB0cmFuc2llbnQ6IGZhbHNlIH1dLFxuXHRcdFx0dmVyc2lvbklkOiB0aGlzLnZlcnNpb25JZCxcblx0XHRcdHN5bmNocm9ub3VzOiBzeW5jaHJvbm91cyxcblx0XHRcdGVuZFNlbGVjdGlvblN0YXRlOiBlbmRTZWxlY3Rpb25zXG5cdFx0fSk7XG5cblx0XHRyZXR1cm47XG5cdH1cblxuXHRwcml2YXRlIF9yZW1vdmVDZWxsKGluZGV4OiBudW1iZXIsIGNvdW50OiBudW1iZXIsIHN5bmNocm9ub3VzOiBib29sZWFuLCBlbmRTZWxlY3Rpb25zOiBJU2VsZWN0aW9uU3RhdGUgfCB1bmRlZmluZWQpIHtcblx0XHRmb3IgKGxldCBpID0gaW5kZXg7IGkgPCBpbmRleCArIGNvdW50OyBpKyspIHtcblx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLl9jZWxsc1tpXTtcblx0XHRcdHRoaXMuX2NlbGxMaXN0ZW5lcnMuZ2V0KGNlbGwuaGFuZGxlKT8uZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fY2VsbExpc3RlbmVycy5kZWxldGUoY2VsbC5oYW5kbGUpO1xuXHRcdH1cblx0XHRjb25zdCBjaGFuZ2VzOiBOb3RlYm9va0NlbGxUZXh0TW9kZWxTcGxpY2U8SUNlbGw+W10gPSBbW2luZGV4LCBjb3VudCwgW11dXTtcblx0XHR0aGlzLl9vbldpbGxBZGRSZW1vdmVDZWxscy5maXJlKHsgcmF3RXZlbnQ6IHsga2luZDogTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuTW9kZWxDaGFuZ2UsIGNoYW5nZXMgfSB9KTtcblx0XHR0aGlzLl9jZWxscy5zcGxpY2UoaW5kZXgsIGNvdW50KTtcblx0XHR0aGlzLl9wYXVzZWFibGVFbWl0dGVyLmZpcmUoe1xuXHRcdFx0cmF3RXZlbnRzOiBbeyBraW5kOiBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5Nb2RlbENoYW5nZSwgY2hhbmdlcywgdHJhbnNpZW50OiBmYWxzZSB9XSxcblx0XHRcdHZlcnNpb25JZDogdGhpcy52ZXJzaW9uSWQsXG5cdFx0XHRzeW5jaHJvbm91czogc3luY2hyb25vdXMsXG5cdFx0XHRlbmRTZWxlY3Rpb25TdGF0ZTogZW5kU2VsZWN0aW9uc1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVwbGFjZU5ld0NlbGxzKGluZGV4OiBudW1iZXIsIGNvdW50OiBudW1iZXIsIGNlbGxzOiBOb3RlYm9va0NlbGxUZXh0TW9kZWxbXSwgc3luY2hyb25vdXM6IGJvb2xlYW4sIGVuZFNlbGVjdGlvbnM6IElTZWxlY3Rpb25TdGF0ZSB8IHVuZGVmaW5lZCkge1xuXHRcdGZvciAobGV0IGkgPSBpbmRleDsgaSA8IGluZGV4ICsgY291bnQ7IGkrKykge1xuXHRcdFx0Y29uc3QgY2VsbCA9IHRoaXMuX2NlbGxzW2ldO1xuXHRcdFx0dGhpcy5fY2VsbExpc3RlbmVycy5nZXQoY2VsbC5oYW5kbGUpPy5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9jZWxsTGlzdGVuZXJzLmRlbGV0ZShjZWxsLmhhbmRsZSk7XG5cdFx0fVxuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjZWxscy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgZGlydHlTdGF0ZUxpc3RlbmVyID0gY2VsbHNbaV0ub25EaWRDaGFuZ2VDb250ZW50KChlKSA9PiB7XG5cdFx0XHRcdHRoaXMuX2JpbmRDZWxsQ29udGVudEhhbmRsZXIoY2VsbHNbaV0sIGUpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMuX2NlbGxMaXN0ZW5lcnMuc2V0KGNlbGxzW2ldLmhhbmRsZSwgZGlydHlTdGF0ZUxpc3RlbmVyKTtcblx0XHR9XG5cblx0XHRjb25zdCBjaGFuZ2VzOiBOb3RlYm9va0NlbGxUZXh0TW9kZWxTcGxpY2U8SUNlbGw+W10gPSBbW2luZGV4LCBjb3VudCwgY2VsbHNdXTtcblx0XHR0aGlzLl9vbldpbGxBZGRSZW1vdmVDZWxscy5maXJlKHsgcmF3RXZlbnQ6IHsga2luZDogTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuTW9kZWxDaGFuZ2UsIGNoYW5nZXMgfSB9KTtcblx0XHR0aGlzLl9jZWxscy5zcGxpY2UoaW5kZXgsIGNvdW50LCAuLi5jZWxscyk7XG5cdFx0dGhpcy5fcGF1c2VhYmxlRW1pdHRlci5maXJlKHtcblx0XHRcdHJhd0V2ZW50czogW3sga2luZDogTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuTW9kZWxDaGFuZ2UsIGNoYW5nZXMsIHRyYW5zaWVudDogZmFsc2UgfV0sXG5cdFx0XHR2ZXJzaW9uSWQ6IHRoaXMudmVyc2lvbklkLFxuXHRcdFx0c3luY2hyb25vdXM6IHN5bmNocm9ub3VzLFxuXHRcdFx0ZW5kU2VsZWN0aW9uU3RhdGU6IGVuZFNlbGVjdGlvbnNcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX2lzRG9jdW1lbnRNZXRhZGF0YUNoYW5nZWQoYTogTm90ZWJvb2tEb2N1bWVudE1ldGFkYXRhLCBiOiBOb3RlYm9va0RvY3VtZW50TWV0YWRhdGEpIHtcblx0XHRjb25zdCBrZXlzID0gbmV3IFNldChbLi4uT2JqZWN0LmtleXMoYSB8fCB7fSksIC4uLk9iamVjdC5rZXlzKGIgfHwge30pXSk7XG5cdFx0Zm9yIChjb25zdCBrZXkgb2Yga2V5cykge1xuXHRcdFx0aWYgKGtleSA9PT0gJ2N1c3RvbScpIHtcblx0XHRcdFx0aWYgKCF0aGlzLl9jdXN0b21NZXRhZGF0YUVxdWFsKGFba2V5XSwgYltrZXldKVxuXHRcdFx0XHRcdCYmXG5cdFx0XHRcdFx0ISh0aGlzLnRyYW5zaWVudE9wdGlvbnMudHJhbnNpZW50RG9jdW1lbnRNZXRhZGF0YVtrZXkgYXMga2V5b2YgTm90ZWJvb2tEb2N1bWVudE1ldGFkYXRhXSlcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoXG5cdFx0XHRcdChhW2tleSBhcyBrZXlvZiBOb3RlYm9va0RvY3VtZW50TWV0YWRhdGFdICE9PSBiW2tleSBhcyBrZXlvZiBOb3RlYm9va0RvY3VtZW50TWV0YWRhdGFdKVxuXHRcdFx0XHQmJlxuXHRcdFx0XHQhKHRoaXMudHJhbnNpZW50T3B0aW9ucy50cmFuc2llbnREb2N1bWVudE1ldGFkYXRhW2tleSBhcyBrZXlvZiBOb3RlYm9va0RvY3VtZW50TWV0YWRhdGFdKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgX2lzQ2VsbE1ldGFkYXRhQ2hhbmdlZChhOiBOb3RlYm9va0NlbGxNZXRhZGF0YSwgYjogTm90ZWJvb2tDZWxsTWV0YWRhdGEpIHtcblx0XHRjb25zdCBrZXlzID0gbmV3IFNldChbLi4uT2JqZWN0LmtleXMoYSB8fCB7fSksIC4uLk9iamVjdC5rZXlzKGIgfHwge30pXSk7XG5cdFx0Zm9yIChjb25zdCBrZXkgb2Yga2V5cykge1xuXHRcdFx0aWYgKFxuXHRcdFx0XHQoYVtrZXkgYXMga2V5b2YgTm90ZWJvb2tDZWxsTWV0YWRhdGFdICE9PSBiW2tleSBhcyBrZXlvZiBOb3RlYm9va0NlbGxNZXRhZGF0YV0pXG5cdFx0XHRcdCYmXG5cdFx0XHRcdCEodGhpcy50cmFuc2llbnRPcHRpb25zLnRyYW5zaWVudENlbGxNZXRhZGF0YVtrZXkgYXMga2V5b2YgTm90ZWJvb2tDZWxsTWV0YWRhdGFdKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgX2N1c3RvbU1ldGFkYXRhRXF1YWwoYTogYW55LCBiOiBhbnkpIHtcblx0XHRpZiAoIWEgJiYgIWIpIHtcblx0XHRcdC8vIGJvdGggb2YgdGhlbSBhcmUgbnVsbGlzaCBvciB1bmRlZmluZWRcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdGlmICghYSB8fCAhYikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFQcm9wcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGEpO1xuXHRcdGNvbnN0IGJQcm9wcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGIpO1xuXG5cdFx0aWYgKGFQcm9wcy5sZW5ndGggIT09IGJQcm9wcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGFQcm9wcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgcHJvcE5hbWUgPSBhUHJvcHNbaV07XG5cdFx0XHRpZiAoYVtwcm9wTmFtZV0gIT09IGJbcHJvcE5hbWVdKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgX2NoYW5nZUNlbGxNZXRhZGF0YVBhcnRpYWwoY2VsbDogTm90ZWJvb2tDZWxsVGV4dE1vZGVsLCBtZXRhZGF0YTogTnVsbGFibGVQYXJ0aWFsTm90ZWJvb2tDZWxsTWV0YWRhdGEsIGNvbXB1dGVVbmRvUmVkbzogYm9vbGVhbiwgYmVnaW5TZWxlY3Rpb25TdGF0ZTogSVNlbGVjdGlvblN0YXRlIHwgdW5kZWZpbmVkLCB1bmRvUmVkb0dyb3VwOiBVbmRvUmVkb0dyb3VwIHwgdW5kZWZpbmVkKSB7XG5cdFx0Y29uc3QgbmV3TWV0YWRhdGE6IE5vdGVib29rQ2VsbE1ldGFkYXRhID0ge1xuXHRcdFx0Li4uY2VsbC5tZXRhZGF0YVxuXHRcdH07XG5cdFx0bGV0IGs6IGtleW9mIE51bGxhYmxlUGFydGlhbE5vdGVib29rQ2VsbE1ldGFkYXRhO1xuXHRcdGZvciAoayBpbiBtZXRhZGF0YSkge1xuXHRcdFx0Y29uc3QgdmFsdWUgPSBtZXRhZGF0YVtrXSA/PyB1bmRlZmluZWQ7XG5cdFx0XHRuZXdNZXRhZGF0YVtrXSA9IHZhbHVlIGFzIGFueTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fY2hhbmdlQ2VsbE1ldGFkYXRhKGNlbGwsIG5ld01ldGFkYXRhLCBjb21wdXRlVW5kb1JlZG8sIGJlZ2luU2VsZWN0aW9uU3RhdGUsIHVuZG9SZWRvR3JvdXApO1xuXHR9XG5cblx0cHJpdmF0ZSBfY2hhbmdlQ2VsbE1ldGFkYXRhKGNlbGw6IE5vdGVib29rQ2VsbFRleHRNb2RlbCwgbWV0YWRhdGE6IE5vdGVib29rQ2VsbE1ldGFkYXRhLCBjb21wdXRlVW5kb1JlZG86IGJvb2xlYW4sIGJlZ2luU2VsZWN0aW9uU3RhdGU6IElTZWxlY3Rpb25TdGF0ZSB8IHVuZGVmaW5lZCwgdW5kb1JlZG9Hcm91cDogVW5kb1JlZG9Hcm91cCB8IHVuZGVmaW5lZCkge1xuXHRcdGNvbnN0IHRyaWdnZXJEaXJ0eUNoYW5nZSA9IHRoaXMuX2lzQ2VsbE1ldGFkYXRhQ2hhbmdlZChjZWxsLm1ldGFkYXRhLCBtZXRhZGF0YSk7XG5cblx0XHRpZiAodHJpZ2dlckRpcnR5Q2hhbmdlKSB7XG5cdFx0XHRpZiAoY29tcHV0ZVVuZG9SZWRvKSB7XG5cdFx0XHRcdGNvbnN0IGluZGV4ID0gdGhpcy5fY2VsbHMuaW5kZXhPZihjZWxsKTtcblx0XHRcdFx0dGhpcy5fb3BlcmF0aW9uTWFuYWdlci5wdXNoRWRpdE9wZXJhdGlvbihuZXcgQ2VsbE1ldGFkYXRhRWRpdCh0aGlzLnVyaSwgaW5kZXgsIE9iamVjdC5mcmVlemUoY2VsbC5tZXRhZGF0YSksIE9iamVjdC5mcmVlemUobWV0YWRhdGEpLCB7XG5cdFx0XHRcdFx0dXBkYXRlQ2VsbE1ldGFkYXRhOiAoaW5kZXgsIG5ld01ldGFkYXRhKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBjZWxsID0gdGhpcy5fY2VsbHNbaW5kZXhdO1xuXHRcdFx0XHRcdFx0aWYgKCFjZWxsKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHRoaXMuX2NoYW5nZUNlbGxNZXRhZGF0YShjZWxsLCBuZXdNZXRhZGF0YSwgZmFsc2UsIGJlZ2luU2VsZWN0aW9uU3RhdGUsIHVuZG9SZWRvR3JvdXApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSksIGJlZ2luU2VsZWN0aW9uU3RhdGUsIHVuZGVmaW5lZCwgdGhpcy5fYWx0ZXJuYXRpdmVWZXJzaW9uSWQsIHVuZG9SZWRvR3JvdXApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIHNob3VsZCBiZSBkZWZlcnJlZFxuXHRcdGNlbGwubWV0YWRhdGEgPSBtZXRhZGF0YTtcblx0XHR0aGlzLl9wYXVzZWFibGVFbWl0dGVyLmZpcmUoe1xuXHRcdFx0cmF3RXZlbnRzOiBbeyBraW5kOiBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5DaGFuZ2VDZWxsTWV0YWRhdGEsIGluZGV4OiB0aGlzLl9jZWxscy5pbmRleE9mKGNlbGwpLCBtZXRhZGF0YTogY2VsbC5tZXRhZGF0YSwgdHJhbnNpZW50OiAhdHJpZ2dlckRpcnR5Q2hhbmdlIH1dLFxuXHRcdFx0dmVyc2lvbklkOiB0aGlzLnZlcnNpb25JZCxcblx0XHRcdHN5bmNocm9ub3VzOiB0cnVlLFxuXHRcdFx0ZW5kU2VsZWN0aW9uU3RhdGU6IHVuZGVmaW5lZFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfY2hhbmdlQ2VsbEludGVybmFsTWV0YWRhdGFQYXJ0aWFsKGNlbGw6IE5vdGVib29rQ2VsbFRleHRNb2RlbCwgaW50ZXJuYWxNZXRhZGF0YTogTnVsbGFibGVQYXJ0aWFsTm90ZWJvb2tDZWxsSW50ZXJuYWxNZXRhZGF0YSkge1xuXHRcdGNvbnN0IG5ld0ludGVybmFsTWV0YWRhdGE6IE5vdGVib29rQ2VsbEludGVybmFsTWV0YWRhdGEgPSB7XG5cdFx0XHQuLi5jZWxsLmludGVybmFsTWV0YWRhdGFcblx0XHR9O1xuXHRcdGxldCBrOiBrZXlvZiBOb3RlYm9va0NlbGxJbnRlcm5hbE1ldGFkYXRhO1xuXHRcdGZvciAoayBpbiBpbnRlcm5hbE1ldGFkYXRhKSB7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IGludGVybmFsTWV0YWRhdGFba10gPz8gdW5kZWZpbmVkO1xuXHRcdFx0bmV3SW50ZXJuYWxNZXRhZGF0YVtrXSA9IHZhbHVlIGFzIGFueTtcblx0XHR9XG5cblx0XHRjZWxsLmludGVybmFsTWV0YWRhdGEgPSBuZXdJbnRlcm5hbE1ldGFkYXRhO1xuXHRcdHRoaXMuX3BhdXNlYWJsZUVtaXR0ZXIuZmlyZSh7XG5cdFx0XHRyYXdFdmVudHM6IFt7IGtpbmQ6IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLkNoYW5nZUNlbGxJbnRlcm5hbE1ldGFkYXRhLCBpbmRleDogdGhpcy5fY2VsbHMuaW5kZXhPZihjZWxsKSwgaW50ZXJuYWxNZXRhZGF0YTogY2VsbC5pbnRlcm5hbE1ldGFkYXRhLCB0cmFuc2llbnQ6IHRydWUgfV0sXG5cdFx0XHR2ZXJzaW9uSWQ6IHRoaXMudmVyc2lvbklkLFxuXHRcdFx0c3luY2hyb25vdXM6IHRydWUsXG5cdFx0XHRlbmRTZWxlY3Rpb25TdGF0ZTogdW5kZWZpbmVkXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9jaGFuZ2VDZWxsTGFuZ3VhZ2UoY2VsbDogTm90ZWJvb2tDZWxsVGV4dE1vZGVsLCBsYW5ndWFnZUlkOiBzdHJpbmcsIGNvbXB1dGVVbmRvUmVkbzogYm9vbGVhbiwgYmVnaW5TZWxlY3Rpb25TdGF0ZTogSVNlbGVjdGlvblN0YXRlIHwgdW5kZWZpbmVkLCB1bmRvUmVkb0dyb3VwOiBVbmRvUmVkb0dyb3VwIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKGNlbGwubGFuZ3VhZ2UgPT09IGxhbmd1YWdlSWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBvbGRMYW5ndWFnZSA9IGNlbGwubGFuZ3VhZ2U7XG5cdFx0Y2VsbC5sYW5ndWFnZSA9IGxhbmd1YWdlSWQ7XG5cblx0XHRpZiAoY29tcHV0ZVVuZG9SZWRvKSB7XG5cdFx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRcdHRoaXMuX29wZXJhdGlvbk1hbmFnZXIucHVzaEVkaXRPcGVyYXRpb24obmV3IGNsYXNzIGltcGxlbWVudHMgSVJlc291cmNlVW5kb1JlZG9FbGVtZW50IHtcblx0XHRcdFx0cmVhZG9ubHkgdHlwZTogVW5kb1JlZG9FbGVtZW50VHlwZS5SZXNvdXJjZSA9IFVuZG9SZWRvRWxlbWVudFR5cGUuUmVzb3VyY2U7XG5cdFx0XHRcdGdldCByZXNvdXJjZSgpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhhdC51cmk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVhZG9ubHkgbGFiZWwgPSAnVXBkYXRlIENlbGwgTGFuZ3VhZ2UnO1xuXHRcdFx0XHRyZWFkb25seSBjb2RlID0gJ3VuZG9yZWRvLnRleHRCdWZmZXJFZGl0Jztcblx0XHRcdFx0dW5kbygpIHtcblx0XHRcdFx0XHR0aGF0Ll9jaGFuZ2VDZWxsTGFuZ3VhZ2UoY2VsbCwgb2xkTGFuZ3VhZ2UsIGZhbHNlLCBiZWdpblNlbGVjdGlvblN0YXRlLCB1bmRvUmVkb0dyb3VwKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZWRvKCkge1xuXHRcdFx0XHRcdHRoYXQuX2NoYW5nZUNlbGxMYW5ndWFnZShjZWxsLCBsYW5ndWFnZUlkLCBmYWxzZSwgYmVnaW5TZWxlY3Rpb25TdGF0ZSwgdW5kb1JlZG9Hcm91cCk7XG5cdFx0XHRcdH1cblx0XHRcdH0oKSwgYmVnaW5TZWxlY3Rpb25TdGF0ZSwgdW5kZWZpbmVkLCB0aGlzLl9hbHRlcm5hdGl2ZVZlcnNpb25JZCwgdW5kb1JlZG9Hcm91cCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcGF1c2VhYmxlRW1pdHRlci5maXJlKHtcblx0XHRcdHJhd0V2ZW50czogW3sga2luZDogTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuQ2hhbmdlQ2VsbExhbmd1YWdlLCBpbmRleDogdGhpcy5fY2VsbHMuaW5kZXhPZihjZWxsKSwgbGFuZ3VhZ2U6IGxhbmd1YWdlSWQsIHRyYW5zaWVudDogZmFsc2UgfV0sXG5cdFx0XHR2ZXJzaW9uSWQ6IHRoaXMudmVyc2lvbklkLFxuXHRcdFx0c3luY2hyb25vdXM6IHRydWUsXG5cdFx0XHRlbmRTZWxlY3Rpb25TdGF0ZTogdW5kZWZpbmVkXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9zcGxpY2VOb3RlYm9va0NlbGxPdXRwdXRzMihjZWxsOiBOb3RlYm9va0NlbGxUZXh0TW9kZWwsIG91dHB1dHM6IElPdXRwdXREdG9bXSwgY29tcHV0ZVVuZG9SZWRvOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKG91dHB1dHMubGVuZ3RoID09PSAwICYmIGNlbGwub3V0cHV0cy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAob3V0cHV0cy5sZW5ndGggPD0gMSkge1xuXHRcdFx0dGhpcy5fc3BsaWNlTm90ZWJvb2tDZWxsT3V0cHV0cyhjZWxsLCB7IHN0YXJ0OiAwLCBkZWxldGVDb3VudDogY2VsbC5vdXRwdXRzLmxlbmd0aCwgbmV3T3V0cHV0czogb3V0cHV0cy5tYXAob3AgPT4gbmV3IE5vdGVib29rQ2VsbE91dHB1dFRleHRNb2RlbChvcCkpIH0sIGZhbHNlLCBjb21wdXRlVW5kb1JlZG8pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRpZmYgPSBuZXcgTGNzRGlmZihuZXcgT3V0cHV0U2VxdWVuY2UoY2VsbC5vdXRwdXRzKSwgbmV3IE91dHB1dFNlcXVlbmNlKG91dHB1dHMpKTtcblx0XHRjb25zdCBkaWZmUmVzdWx0ID0gZGlmZi5Db21wdXRlRGlmZihmYWxzZSk7XG5cdFx0Y29uc3Qgc3BsaWNlczogTm90ZWJvb2tDZWxsT3V0cHV0c1NwbGljZVtdID0gZGlmZlJlc3VsdC5jaGFuZ2VzLm1hcChjaGFuZ2UgPT4gKHtcblx0XHRcdHN0YXJ0OiBjaGFuZ2Uub3JpZ2luYWxTdGFydCxcblx0XHRcdGRlbGV0ZUNvdW50OiBjaGFuZ2Uub3JpZ2luYWxMZW5ndGgsXG5cdFx0XHQvLyBjcmVhdGUgY2VsbCBvdXRwdXQgdGV4dCBtb2RlbCBvbmx5IHdoZW4gaXQncyBpbnNlcnRlZCBpbnRvIHRoZSBub3RlYm9vayBkb2N1bWVudFxuXHRcdFx0bmV3T3V0cHV0czogb3V0cHV0cy5zbGljZShjaGFuZ2UubW9kaWZpZWRTdGFydCwgY2hhbmdlLm1vZGlmaWVkU3RhcnQgKyBjaGFuZ2UubW9kaWZpZWRMZW5ndGgpLm1hcChvcCA9PiBuZXcgTm90ZWJvb2tDZWxsT3V0cHV0VGV4dE1vZGVsKG9wKSlcblx0XHR9KSk7XG5cdFx0c3BsaWNlcy5yZXZlcnNlKCkuZm9yRWFjaChzcGxpY2UgPT4ge1xuXHRcdFx0dGhpcy5fc3BsaWNlTm90ZWJvb2tDZWxsT3V0cHV0cyhjZWxsLCBzcGxpY2UsIGZhbHNlLCBjb21wdXRlVW5kb1JlZG8pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfc3BsaWNlTm90ZWJvb2tDZWxsT3V0cHV0cyhjZWxsOiBOb3RlYm9va0NlbGxUZXh0TW9kZWwsIHNwbGljZTogTm90ZWJvb2tDZWxsT3V0cHV0c1NwbGljZSwgYXBwZW5kOiBib29sZWFuLCBjb21wdXRlVW5kb1JlZG86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjZWxsLnNwbGljZU5vdGVib29rQ2VsbE91dHB1dHMoc3BsaWNlKTtcblx0XHR0aGlzLl9wYXVzZWFibGVFbWl0dGVyLmZpcmUoe1xuXHRcdFx0cmF3RXZlbnRzOiBbe1xuXHRcdFx0XHRraW5kOiBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5PdXRwdXQsXG5cdFx0XHRcdGluZGV4OiB0aGlzLl9jZWxscy5pbmRleE9mKGNlbGwpLFxuXHRcdFx0XHRvdXRwdXRzOiBjZWxsLm91dHB1dHMubWFwKG91dHB1dCA9PiBvdXRwdXQuYXNEdG8oKSkgPz8gW10sXG5cdFx0XHRcdGFwcGVuZCxcblx0XHRcdFx0dHJhbnNpZW50OiB0aGlzLnRyYW5zaWVudE9wdGlvbnMudHJhbnNpZW50T3V0cHV0cyxcblx0XHRcdH1dLFxuXHRcdFx0dmVyc2lvbklkOiB0aGlzLnZlcnNpb25JZCxcblx0XHRcdHN5bmNocm9ub3VzOiB0cnVlLFxuXHRcdFx0ZW5kU2VsZWN0aW9uU3RhdGU6IHVuZGVmaW5lZFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfYXBwZW5kTm90ZWJvb2tDZWxsT3V0cHV0SXRlbXMoY2VsbDogTm90ZWJvb2tDZWxsVGV4dE1vZGVsLCBvdXRwdXRJZDogc3RyaW5nLCBpdGVtczogSU91dHB1dEl0ZW1EdG9bXSkge1xuXHRcdGlmIChjZWxsLmNoYW5nZU91dHB1dEl0ZW1zKG91dHB1dElkLCB0cnVlLCBpdGVtcykpIHtcblx0XHRcdHRoaXMuX3BhdXNlYWJsZUVtaXR0ZXIuZmlyZSh7XG5cdFx0XHRcdHJhd0V2ZW50czogW3tcblx0XHRcdFx0XHRraW5kOiBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5PdXRwdXRJdGVtLFxuXHRcdFx0XHRcdGluZGV4OiB0aGlzLl9jZWxscy5pbmRleE9mKGNlbGwpLFxuXHRcdFx0XHRcdG91dHB1dElkOiBvdXRwdXRJZCxcblx0XHRcdFx0XHRvdXRwdXRJdGVtczogaXRlbXMsXG5cdFx0XHRcdFx0YXBwZW5kOiB0cnVlLFxuXHRcdFx0XHRcdHRyYW5zaWVudDogdGhpcy50cmFuc2llbnRPcHRpb25zLnRyYW5zaWVudE91dHB1dHNcblxuXHRcdFx0XHR9XSxcblx0XHRcdFx0dmVyc2lvbklkOiB0aGlzLnZlcnNpb25JZCxcblx0XHRcdFx0c3luY2hyb25vdXM6IHRydWUsXG5cdFx0XHRcdGVuZFNlbGVjdGlvblN0YXRlOiB1bmRlZmluZWRcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3JlcGxhY2VOb3RlYm9va0NlbGxPdXRwdXRJdGVtcyhjZWxsOiBOb3RlYm9va0NlbGxUZXh0TW9kZWwsIG91dHB1dElkOiBzdHJpbmcsIGl0ZW1zOiBJT3V0cHV0SXRlbUR0b1tdKSB7XG5cdFx0aWYgKGNlbGwuY2hhbmdlT3V0cHV0SXRlbXMob3V0cHV0SWQsIGZhbHNlLCBpdGVtcykpIHtcblx0XHRcdHRoaXMuX3BhdXNlYWJsZUVtaXR0ZXIuZmlyZSh7XG5cdFx0XHRcdHJhd0V2ZW50czogW3tcblx0XHRcdFx0XHRraW5kOiBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5PdXRwdXRJdGVtLFxuXHRcdFx0XHRcdGluZGV4OiB0aGlzLl9jZWxscy5pbmRleE9mKGNlbGwpLFxuXHRcdFx0XHRcdG91dHB1dElkOiBvdXRwdXRJZCxcblx0XHRcdFx0XHRvdXRwdXRJdGVtczogaXRlbXMsXG5cdFx0XHRcdFx0YXBwZW5kOiBmYWxzZSxcblx0XHRcdFx0XHR0cmFuc2llbnQ6IHRoaXMudHJhbnNpZW50T3B0aW9ucy50cmFuc2llbnRPdXRwdXRzXG5cblx0XHRcdFx0fV0sXG5cdFx0XHRcdHZlcnNpb25JZDogdGhpcy52ZXJzaW9uSWQsXG5cdFx0XHRcdHN5bmNocm9ub3VzOiB0cnVlLFxuXHRcdFx0XHRlbmRTZWxlY3Rpb25TdGF0ZTogdW5kZWZpbmVkXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9tb3ZlQ2VsbFRvSWR4KGluZGV4OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyLCBuZXdJZHg6IG51bWJlciwgc3luY2hyb25vdXM6IGJvb2xlYW4sIHB1c2hlZFRvVW5kb1N0YWNrOiBib29sZWFuLCBiZWZvcmVTZWxlY3Rpb25zOiBJU2VsZWN0aW9uU3RhdGUgfCB1bmRlZmluZWQsIGVuZFNlbGVjdGlvbnM6IElTZWxlY3Rpb25TdGF0ZSB8IHVuZGVmaW5lZCwgdW5kb1JlZG9Hcm91cDogVW5kb1JlZG9Hcm91cCB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuXHRcdGlmIChwdXNoZWRUb1VuZG9TdGFjaykge1xuXHRcdFx0dGhpcy5fb3BlcmF0aW9uTWFuYWdlci5wdXNoRWRpdE9wZXJhdGlvbihuZXcgTW92ZUNlbGxFZGl0KHRoaXMudXJpLCBpbmRleCwgbGVuZ3RoLCBuZXdJZHgsIHtcblx0XHRcdFx0bW92ZUNlbGw6IChmcm9tSW5kZXg6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsIHRvSW5kZXg6IG51bWJlciwgYmVmb3JlU2VsZWN0aW9uczogSVNlbGVjdGlvblN0YXRlIHwgdW5kZWZpbmVkLCBlbmRTZWxlY3Rpb25zOiBJU2VsZWN0aW9uU3RhdGUgfCB1bmRlZmluZWQpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9tb3ZlQ2VsbFRvSWR4KGZyb21JbmRleCwgbGVuZ3RoLCB0b0luZGV4LCB0cnVlLCBmYWxzZSwgYmVmb3JlU2VsZWN0aW9ucywgZW5kU2VsZWN0aW9ucywgdW5kb1JlZG9Hcm91cCk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9LCBiZWZvcmVTZWxlY3Rpb25zLCBlbmRTZWxlY3Rpb25zKSwgYmVmb3JlU2VsZWN0aW9ucywgZW5kU2VsZWN0aW9ucywgdGhpcy5fYWx0ZXJuYXRpdmVWZXJzaW9uSWQsIHVuZG9SZWRvR3JvdXApO1xuXHRcdH1cblxuXHRcdHRoaXMuX2Fzc2VydEluZGV4KGluZGV4KTtcblx0XHR0aGlzLl9hc3NlcnRJbmRleChuZXdJZHgpO1xuXG5cdFx0Y29uc3QgY2VsbHMgPSB0aGlzLl9jZWxscy5zcGxpY2UoaW5kZXgsIGxlbmd0aCk7XG5cdFx0dGhpcy5fY2VsbHMuc3BsaWNlKG5ld0lkeCwgMCwgLi4uY2VsbHMpO1xuXHRcdHRoaXMuX3BhdXNlYWJsZUVtaXR0ZXIuZmlyZSh7XG5cdFx0XHRyYXdFdmVudHM6IFt7IGtpbmQ6IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLk1vdmUsIGluZGV4LCBsZW5ndGgsIG5ld0lkeCwgY2VsbHMsIHRyYW5zaWVudDogZmFsc2UgfV0sXG5cdFx0XHR2ZXJzaW9uSWQ6IHRoaXMudmVyc2lvbklkLFxuXHRcdFx0c3luY2hyb25vdXM6IHN5bmNocm9ub3VzLFxuXHRcdFx0ZW5kU2VsZWN0aW9uU3RhdGU6IGVuZFNlbGVjdGlvbnNcblx0XHR9KTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBfYXNzZXJ0SW5kZXgoaW5kZXg6IG51bWJlcikge1xuXHRcdGlmICh0aGlzLl9pbmRleElzSW52YWxpZChpbmRleCkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgbW9kZWwgaW5kZXggb3V0IG9mIHJhbmdlICR7aW5kZXh9YCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfaW5kZXhJc0ludmFsaWQoaW5kZXg6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy5fY2VsbHMubGVuZ3RoO1xuXHR9XG5cblx0Ly8jcmVnaW9uIEZpbmRcblx0ZmluZE5leHRNYXRjaChzZWFyY2hTdHJpbmc6IHN0cmluZywgc2VhcmNoU3RhcnQ6IHsgY2VsbEluZGV4OiBudW1iZXI7IHBvc2l0aW9uOiBQb3NpdGlvbiB9LCBpc1JlZ2V4OiBib29sZWFuLCBtYXRjaENhc2U6IGJvb2xlYW4sIHdvcmRTZXBhcmF0b3JzOiBzdHJpbmcgfCBudWxsLCBzZWFyY2hFbmQ/OiB7IGNlbGxJbmRleDogbnVtYmVyOyBwb3NpdGlvbjogUG9zaXRpb24gfSk6IHsgY2VsbDogTm90ZWJvb2tDZWxsVGV4dE1vZGVsOyBtYXRjaDogRmluZE1hdGNoIH0gfCBudWxsIHtcblx0XHQvLyBjaGVjayBpZiBzZWFyY2ggY2VsbCBpbmRleCBpcyB2YWxpZFxuXHRcdHRoaXMuX2Fzc2VydEluZGV4KHNlYXJjaFN0YXJ0LmNlbGxJbmRleCk7XG5cdFx0Y29uc3Qgc2VhcmNoUGFyYW1zID0gbmV3IFNlYXJjaFBhcmFtcyhzZWFyY2hTdHJpbmcsIGlzUmVnZXgsIG1hdGNoQ2FzZSwgd29yZFNlcGFyYXRvcnMpO1xuXHRcdGNvbnN0IHNlYXJjaERhdGEgPSBzZWFyY2hQYXJhbXMucGFyc2VTZWFyY2hSZXF1ZXN0KCk7XG5cblx0XHRpZiAoIXNlYXJjaERhdGEpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGxldCBjZWxsSW5kZXggPSBzZWFyY2hTdGFydC5jZWxsSW5kZXg7XG5cdFx0bGV0IHNlYXJjaFN0YXJ0UG9zaXRpb24gPSBzZWFyY2hTdGFydC5wb3NpdGlvbjtcblxuXHRcdGxldCBzZWFyY2hFbmRDZWxsID0gdGhpcy5fY2VsbHMubGVuZ3RoO1xuXG5cdFx0d2hpbGUgKGNlbGxJbmRleCA8IHNlYXJjaEVuZENlbGwpIHtcblx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLl9jZWxsc1tjZWxsSW5kZXhdO1xuXG5cdFx0XHQvLyBpZiB3ZSBoYXZlIHdyYXBwZWQgYmFjayB0byB0aGUgcG9pbnQgb2YgdGhlIGluaXRpYWwgc2VhcmNoIGNlbGwsIHdlIHNlYXJjaCBmcm9tIGJlZ2lubmluZyB0byB0aGUgcHJvdmlkZWQgc2VhcmNoRW5kIHBvc2l0aW9uXG5cdFx0XHRjb25zdCB3cmFwRmxhZyA9IHNlYXJjaEVuZCAmJiBjZWxsSW5kZXggPT09IHNlYXJjaEVuZC5jZWxsSW5kZXggJiYgc2VhcmNoU3RhcnRQb3NpdGlvbi5pc0JlZm9yZShzZWFyY2hFbmQucG9zaXRpb24pO1xuXHRcdFx0Y29uc3Qgc2VhcmNoUmFuZ2UgPSBuZXcgUmFuZ2UoXG5cdFx0XHRcdHNlYXJjaFN0YXJ0UG9zaXRpb24ubGluZU51bWJlcixcblx0XHRcdFx0c2VhcmNoU3RhcnRQb3NpdGlvbi5jb2x1bW4sXG5cdFx0XHRcdCh3cmFwRmxhZykgPyBzZWFyY2hFbmQucG9zaXRpb24ubGluZU51bWJlciA6IGNlbGwudGV4dEJ1ZmZlci5nZXRMaW5lQ291bnQoKSxcblx0XHRcdFx0KHdyYXBGbGFnKSA/IHNlYXJjaEVuZC5wb3NpdGlvbi5jb2x1bW4gOiBjZWxsLnRleHRCdWZmZXIuZ2V0TGluZU1heENvbHVtbihjZWxsLnRleHRCdWZmZXIuZ2V0TGluZUNvdW50KCkpXG5cdFx0XHQpO1xuXG5cdFx0XHRjb25zdCByZXN1bHQgPSBjZWxsLnRleHRCdWZmZXIuZmluZE1hdGNoZXNMaW5lQnlMaW5lKHNlYXJjaFJhbmdlLCBzZWFyY2hEYXRhLCBmYWxzZSwgMSk7XG5cdFx0XHRpZiAocmVzdWx0Lmxlbmd0aCA+IDApIHtcblx0XHRcdFx0cmV0dXJuIHsgY2VsbCwgbWF0Y2g6IHJlc3VsdFswXSB9O1xuXHRcdFx0fSBlbHNlIGlmICh3cmFwRmxhZykgeyAvLyB0aGlzIG1lYW5zIHRoZXJlIGFyZSBubyBtb3JlIHZhbGlkIG1hdGNoZXMgaW4gdGhlIG5vdGVib29rXG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBNb3ZlIHRvIHRoZSBuZXh0IGNlbGxcblx0XHRcdGNlbGxJbmRleCsrO1xuXG5cdFx0XHQvLyB3cmFwIGlmIGEgc2VhcmNoRW5kIGlzIHByb3ZpZGVkIGFuZCB3ZSBhcmUgcGFzdCB0aGUgZW5kIG9mIHRoZSBub3RlYm9va1xuXHRcdFx0aWYgKHNlYXJjaEVuZCAmJiBjZWxsSW5kZXggPj0gdGhpcy5fY2VsbHMubGVuZ3RoKSB7XG5cdFx0XHRcdGNlbGxJbmRleCA9IDA7XG5cdFx0XHRcdHNlYXJjaEVuZENlbGwgPSBzZWFyY2hFbmQuY2VsbEluZGV4ICsgMTtcblx0XHRcdH1cblxuXHRcdFx0c2VhcmNoU3RhcnRQb3NpdGlvbiA9IG5ldyBQb3NpdGlvbigxLCAxKTsgLy8gUmVzZXQgcG9zaXRpb24gdG8gc3RhcnQgb2YgdGhlIG5leHQgY2VsbFxuXHRcdH1cblxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0ZmluZE1hdGNoZXMoc2VhcmNoU3RyaW5nOiBzdHJpbmcsIGlzUmVnZXg6IGJvb2xlYW4sIG1hdGNoQ2FzZTogYm9vbGVhbiwgd29yZFNlcGFyYXRvcnM6IHN0cmluZyB8IG51bGwpOiB7IGNlbGw6IE5vdGVib29rQ2VsbFRleHRNb2RlbDsgbWF0Y2hlczogRmluZE1hdGNoW10gfVtdIHtcblx0XHRjb25zdCBzZWFyY2hQYXJhbXMgPSBuZXcgU2VhcmNoUGFyYW1zKHNlYXJjaFN0cmluZywgaXNSZWdleCwgbWF0Y2hDYXNlLCB3b3JkU2VwYXJhdG9ycyk7XG5cdFx0Y29uc3Qgc2VhcmNoRGF0YSA9IHNlYXJjaFBhcmFtcy5wYXJzZVNlYXJjaFJlcXVlc3QoKTtcblxuXHRcdGlmICghc2VhcmNoRGF0YSkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdHM6IHsgY2VsbDogTm90ZWJvb2tDZWxsVGV4dE1vZGVsOyBtYXRjaGVzOiBGaW5kTWF0Y2hbXSB9W10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGNlbGwgb2YgdGhpcy5fY2VsbHMpIHtcblx0XHRcdGNvbnN0IHNlYXJjaFJhbmdlID0gbmV3IFJhbmdlKDEsIDEsIGNlbGwudGV4dEJ1ZmZlci5nZXRMaW5lQ291bnQoKSwgY2VsbC50ZXh0QnVmZmVyLmdldExpbmVNYXhDb2x1bW4oY2VsbC50ZXh0QnVmZmVyLmdldExpbmVDb3VudCgpKSk7XG5cdFx0XHRjb25zdCBtYXRjaGVzID0gY2VsbC50ZXh0QnVmZmVyLmZpbmRNYXRjaGVzTGluZUJ5TGluZShzZWFyY2hSYW5nZSwgc2VhcmNoRGF0YSwgZmFsc2UsIDEwMDApO1xuXG5cdFx0XHRpZiAobWF0Y2hlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHJlc3VsdHMucHVzaCh7IGNlbGwsIG1hdGNoZXM6IG1hdGNoZXMgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdHM7XG5cdH1cblx0Ly8jZW5kcmVnaW9uXG59XG5cbmNsYXNzIE91dHB1dFNlcXVlbmNlIGltcGxlbWVudHMgSVNlcXVlbmNlIHtcblx0Y29uc3RydWN0b3IocmVhZG9ubHkgb3V0cHV0czogSU91dHB1dER0b1tdKSB7XG5cdH1cblxuXHRnZXRFbGVtZW50cygpOiBJbnQzMkFycmF5IHwgbnVtYmVyW10gfCBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMub3V0cHV0cy5tYXAob3V0cHV0ID0+IHtcblx0XHRcdHJldHVybiBoYXNoKG91dHB1dC5vdXRwdXRzLm1hcChvdXRwdXQgPT4gKHtcblx0XHRcdFx0bWltZTogb3V0cHV0Lm1pbWUsXG5cdFx0XHRcdGRhdGE6IG91dHB1dC5kYXRhXG5cdFx0XHR9KSkpO1xuXHRcdH0pO1xuXHR9XG5cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBb0IsZUFBZTtBQUNuQyxTQUFTLFNBQWdCLHdCQUF3QjtBQUNqRCxTQUFTLFlBQVk7QUFDckIsU0FBUyxZQUFZLGVBQTRCO0FBQ2pELFNBQVMsZUFBZTtBQUN4QixTQUFTLGNBQWM7QUFDdkIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsaUJBQWlCO0FBRTFCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsYUFBYTtBQUN0QixTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHFCQUFxQjtBQUU5QixTQUFxRCxrQkFBNkMsMkJBQTBDO0FBQzVJLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsY0FBYyxVQUFVLFNBQVMsTUFBa04sNEJBQTJHLCtCQUE0UTtBQUNubkIsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyxrQkFBa0Is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QUFVLEtBQUssV0FBVyxzQkFBc0IsYUFBYSxZQUFZLE9BQU8sR0FBSTtBQUUxRixVQUFJLFFBQVEsU0FBUyxHQUFHO0FBQ3ZCLGdCQUFRLEtBQUssRUFBRSxNQUFNLFFBQWlCLENBQUM7QUFBQSxNQUN4QztBQUFBLElBQ0Q7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBO0FBRUQ7QUE3b0NhLG9CQUFOO0FBQUEsRUF3REo7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0E1RFU7QUErb0NiLE1BQU0sZUFBb0M7QUFBQSxFQUN6QyxZQUFxQixTQUF1QjtBQUF2QjtBQUFBLEVBQ3JCO0FBQUEsRUFFQSxjQUFnRDtBQUMvQyxXQUFPLEtBQUssUUFBUSxJQUFJLFlBQVU7QUFDakMsYUFBTyxLQUFLLE9BQU8sUUFBUSxJQUFJLENBQUFDLGFBQVc7QUFBQSxRQUN6QyxNQUFNQSxRQUFPO0FBQUEsUUFDYixNQUFNQSxRQUFPO0FBQUEsTUFDZCxFQUFFLENBQUM7QUFBQSxJQUNKLENBQUM7QUFBQSxFQUNGO0FBRUQ7IiwKICAibmFtZXMiOiBbImRpZmYiLCAiaW5kZXgiLCAiY291bnQiLCAiY2VsbHMiLCAiY2VsbCIsICJsZW5ndGgiLCAiYmVmb3JlU2VsZWN0aW9ucyIsICJlbmRTZWxlY3Rpb25zIiwgIm91dHB1dCJdCn0K
