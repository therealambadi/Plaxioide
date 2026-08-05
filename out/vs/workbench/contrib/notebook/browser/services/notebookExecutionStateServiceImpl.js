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
import { Emitter } from "../../../../../base/common/event.js";
import { combinedDisposable, Disposable } from "../../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../../base/common/map.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { CellEditType, CellUri, NotebookCellExecutionState, NotebookExecutionState } from "../../common/notebookCommon.js";
import { CellExecutionUpdateType, INotebookExecutionService } from "../../common/notebookExecutionService.js";
import { INotebookExecutionStateService, NotebookExecutionType } from "../../common/notebookExecutionStateService.js";
import { INotebookKernelService } from "../../common/notebookKernelService.js";
import { INotebookService } from "../../common/notebookService.js";
let NotebookExecutionStateService = class extends Disposable {
  constructor(_instantiationService, _logService, _notebookService, _accessibilitySignalService) {
    super();
    this._instantiationService = _instantiationService;
    this._logService = _logService;
    this._notebookService = _notebookService;
    this._accessibilitySignalService = _accessibilitySignalService;
    this._executions = new ResourceMap();
    this._notebookExecutions = new ResourceMap();
    this._notebookListeners = new ResourceMap();
    this._cellListeners = new ResourceMap();
    this._lastFailedCells = new ResourceMap();
    this._lastCompletedCellHandles = new ResourceMap();
    this._onDidChangeExecution = this._register(new Emitter());
    this.onDidChangeExecution = this._onDidChangeExecution.event;
    this._onDidChangeLastRunFailState = this._register(new Emitter());
    this.onDidChangeLastRunFailState = this._onDidChangeLastRunFailState.event;
  }
  getLastFailedCellForNotebook(notebook) {
    const failedCell = this._lastFailedCells.get(notebook);
    return failedCell?.visible ? failedCell.cellHandle : void 0;
  }
  getLastCompletedCellForNotebook(notebook) {
    return this._lastCompletedCellHandles.get(notebook);
  }
  forceCancelNotebookExecutions(notebookUri) {
    const notebookCellExecutions = this._executions.get(notebookUri);
    if (notebookCellExecutions) {
      for (const exe of notebookCellExecutions.values()) {
        this._onCellExecutionDidComplete(notebookUri, exe.cellHandle, exe);
      }
    }
    if (this._notebookExecutions.has(notebookUri)) {
      this._onExecutionDidComplete(notebookUri);
    }
  }
  getCellExecution(cellUri) {
    const parsed = CellUri.parse(cellUri);
    if (!parsed) {
      throw new Error(`Not a cell URI: ${cellUri}`);
    }
    const exeMap = this._executions.get(parsed.notebook);
    if (exeMap) {
      return exeMap.get(parsed.handle);
    }
    return void 0;
  }
  getExecution(notebook) {
    return this._notebookExecutions.get(notebook)?.[0];
  }
  getCellExecutionsForNotebook(notebook) {
    const exeMap = this._executions.get(notebook);
    return exeMap ? Array.from(exeMap.values()) : [];
  }
  getCellExecutionsByHandleForNotebook(notebook) {
    const exeMap = this._executions.get(notebook);
    return exeMap ? new Map(exeMap.entries()) : void 0;
  }
  _onCellExecutionDidChange(notebookUri, cellHandle, exe) {
    this._onDidChangeExecution.fire(new NotebookCellExecutionEvent(notebookUri, cellHandle, exe));
  }
  _onCellExecutionDidComplete(notebookUri, cellHandle, exe, lastRunSuccess) {
    const notebookExecutions = this._executions.get(notebookUri);
    if (!notebookExecutions) {
      this._logService.debug(`NotebookExecutionStateService#_onCellExecutionDidComplete - unknown notebook ${notebookUri.toString()}`);
      return;
    }
    exe.dispose();
    const cellUri = CellUri.generate(notebookUri, cellHandle);
    this._cellListeners.get(cellUri)?.dispose();
    this._cellListeners.delete(cellUri);
    notebookExecutions.delete(cellHandle);
    if (notebookExecutions.size === 0) {
      this._executions.delete(notebookUri);
      this._notebookListeners.get(notebookUri)?.dispose();
      this._notebookListeners.delete(notebookUri);
    }
    if (lastRunSuccess !== void 0) {
      if (lastRunSuccess) {
        if (this._executions.size === 0) {
          this._accessibilitySignalService.playSignal(AccessibilitySignal.notebookCellCompleted);
        }
        this._clearLastFailedCell(notebookUri);
      } else {
        this._accessibilitySignalService.playSignal(AccessibilitySignal.notebookCellFailed);
        this._setLastFailedCell(notebookUri, cellHandle);
      }
      this._lastCompletedCellHandles.set(notebookUri, cellHandle);
    }
    this._onDidChangeExecution.fire(new NotebookCellExecutionEvent(notebookUri, cellHandle));
  }
  _onExecutionDidChange(notebookUri, exe) {
    this._onDidChangeExecution.fire(new NotebookExecutionEvent(notebookUri, exe));
  }
  _onExecutionDidComplete(notebookUri) {
    const disposables = this._notebookExecutions.get(notebookUri);
    if (!Array.isArray(disposables)) {
      this._logService.debug(`NotebookExecutionStateService#_onCellExecutionDidComplete - unknown notebook ${notebookUri.toString()}`);
      return;
    }
    this._notebookExecutions.delete(notebookUri);
    this._onDidChangeExecution.fire(new NotebookExecutionEvent(notebookUri));
    disposables.forEach((d) => d.dispose());
  }
  createCellExecution(notebookUri, cellHandle) {
    const notebook = this._notebookService.getNotebookTextModel(notebookUri);
    if (!notebook) {
      throw new Error(`Notebook not found: ${notebookUri.toString()}`);
    }
    let notebookExecutionMap = this._executions.get(notebookUri);
    if (!notebookExecutionMap) {
      const listeners = this._instantiationService.createInstance(NotebookExecutionListeners, notebookUri);
      this._notebookListeners.set(notebookUri, listeners);
      notebookExecutionMap = /* @__PURE__ */ new Map();
      this._executions.set(notebookUri, notebookExecutionMap);
    }
    let exe = notebookExecutionMap.get(cellHandle);
    if (!exe) {
      exe = this._createNotebookCellExecution(notebook, cellHandle);
      notebookExecutionMap.set(cellHandle, exe);
      exe.initialize();
      this._onDidChangeExecution.fire(new NotebookCellExecutionEvent(notebookUri, cellHandle, exe));
    }
    return exe;
  }
  createExecution(notebookUri) {
    const notebook = this._notebookService.getNotebookTextModel(notebookUri);
    if (!notebook) {
      throw new Error(`Notebook not found: ${notebookUri.toString()}`);
    }
    if (!this._notebookListeners.has(notebookUri)) {
      const listeners = this._instantiationService.createInstance(NotebookExecutionListeners, notebookUri);
      this._notebookListeners.set(notebookUri, listeners);
    }
    let info = this._notebookExecutions.get(notebookUri);
    if (!info) {
      info = this._createNotebookExecution(notebook);
      this._notebookExecutions.set(notebookUri, info);
      this._onDidChangeExecution.fire(new NotebookExecutionEvent(notebookUri, info[0]));
    }
    return info[0];
  }
  _createNotebookCellExecution(notebook, cellHandle) {
    const notebookUri = notebook.uri;
    const exe = this._instantiationService.createInstance(CellExecution, cellHandle, notebook);
    const disposable = combinedDisposable(
      exe.onDidUpdate(() => this._onCellExecutionDidChange(notebookUri, cellHandle, exe)),
      exe.onDidComplete((lastRunSuccess) => this._onCellExecutionDidComplete(notebookUri, cellHandle, exe, lastRunSuccess))
    );
    this._cellListeners.set(CellUri.generate(notebookUri, cellHandle), disposable);
    return exe;
  }
  _createNotebookExecution(notebook) {
    const notebookUri = notebook.uri;
    const exe = this._instantiationService.createInstance(NotebookExecution, notebook);
    const disposable = combinedDisposable(
      exe.onDidUpdate(() => this._onExecutionDidChange(notebookUri, exe)),
      exe.onDidComplete(() => this._onExecutionDidComplete(notebookUri))
    );
    return [exe, disposable];
  }
  _setLastFailedCell(notebookURI, cellHandle) {
    const prevLastFailedCellInfo = this._lastFailedCells.get(notebookURI);
    const notebook = this._notebookService.getNotebookTextModel(notebookURI);
    if (!notebook) {
      return;
    }
    const newLastFailedCellInfo = {
      cellHandle,
      disposable: prevLastFailedCellInfo ? prevLastFailedCellInfo.disposable : this._getFailedCellListener(notebook),
      visible: true
    };
    this._lastFailedCells.set(notebookURI, newLastFailedCellInfo);
    this._onDidChangeLastRunFailState.fire({ visible: true, notebook: notebookURI });
  }
  _setLastFailedCellVisibility(notebookURI, visible) {
    const lastFailedCellInfo = this._lastFailedCells.get(notebookURI);
    if (lastFailedCellInfo) {
      this._lastFailedCells.set(notebookURI, {
        cellHandle: lastFailedCellInfo.cellHandle,
        disposable: lastFailedCellInfo.disposable,
        visible
      });
    }
    this._onDidChangeLastRunFailState.fire({ visible, notebook: notebookURI });
  }
  _clearLastFailedCell(notebookURI) {
    const lastFailedCellInfo = this._lastFailedCells.get(notebookURI);
    if (lastFailedCellInfo) {
      lastFailedCellInfo.disposable?.dispose();
      this._lastFailedCells.delete(notebookURI);
    }
    this._onDidChangeLastRunFailState.fire({ visible: false, notebook: notebookURI });
  }
  _getFailedCellListener(notebook) {
    return notebook.onWillAddRemoveCells((e) => {
      const lastFailedCell = this._lastFailedCells.get(notebook.uri)?.cellHandle;
      if (lastFailedCell !== void 0) {
        const lastFailedCellPos = notebook.cells.findIndex((c) => c.handle === lastFailedCell);
        e.rawEvent.changes.forEach(([start, deleteCount, addedCells]) => {
          if (deleteCount) {
            if (lastFailedCellPos >= start && lastFailedCellPos < start + deleteCount) {
              this._setLastFailedCellVisibility(notebook.uri, false);
            }
          }
          if (addedCells.some((cell) => cell.handle === lastFailedCell)) {
            this._setLastFailedCellVisibility(notebook.uri, true);
          }
        });
      }
    });
  }
  dispose() {
    super.dispose();
    this._executions.forEach((executionMap) => {
      executionMap.forEach((execution) => execution.dispose());
      executionMap.clear();
    });
    this._executions.clear();
    this._notebookExecutions.forEach((disposables) => {
      disposables.forEach((d) => d.dispose());
    });
    this._notebookExecutions.clear();
    this._cellListeners.forEach((disposable) => disposable.dispose());
    this._notebookListeners.forEach((disposable) => disposable.dispose());
    this._lastFailedCells.forEach((elem) => elem.disposable.dispose());
  }
};
NotebookExecutionStateService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ILogService),
  __decorateParam(2, INotebookService),
  __decorateParam(3, IAccessibilitySignalService)
], NotebookExecutionStateService);
class NotebookCellExecutionEvent {
  constructor(notebook, cellHandle, changed) {
    this.notebook = notebook;
    this.cellHandle = cellHandle;
    this.changed = changed;
    this.type = NotebookExecutionType.cell;
  }
  affectsCell(cell) {
    const parsedUri = CellUri.parse(cell);
    return !!parsedUri && isEqual(this.notebook, parsedUri.notebook) && this.cellHandle === parsedUri.handle;
  }
  affectsNotebook(notebook) {
    return isEqual(this.notebook, notebook);
  }
}
class NotebookExecutionEvent {
  constructor(notebook, changed) {
    this.notebook = notebook;
    this.changed = changed;
    this.type = NotebookExecutionType.notebook;
  }
  affectsNotebook(notebook) {
    return isEqual(this.notebook, notebook);
  }
}
let NotebookExecutionListeners = class extends Disposable {
  constructor(notebook, _notebookService, _notebookKernelService, _notebookExecutionService, _notebookExecutionStateService, _logService) {
    super();
    this._notebookService = _notebookService;
    this._notebookKernelService = _notebookKernelService;
    this._notebookExecutionService = _notebookExecutionService;
    this._notebookExecutionStateService = _notebookExecutionStateService;
    this._logService = _logService;
    this._logService.debug(`NotebookExecution#ctor ${notebook.toString()}`);
    const notebookModel = this._notebookService.getNotebookTextModel(notebook);
    if (!notebookModel) {
      throw new Error("Notebook not found: " + notebook);
    }
    this._notebookModel = notebookModel;
    this._register(this._notebookModel.onWillAddRemoveCells((e) => this.onWillAddRemoveCells(e)));
    this._register(this._notebookModel.onWillDispose(() => this.onWillDisposeDocument()));
  }
  cancelAll() {
    this._logService.debug(`NotebookExecutionListeners#cancelAll`);
    const exes = this._notebookExecutionStateService.getCellExecutionsForNotebook(this._notebookModel.uri);
    this._notebookExecutionService.cancelNotebookCellHandles(this._notebookModel, exes.map((exe) => exe.cellHandle));
  }
  onWillDisposeDocument() {
    this._logService.debug(`NotebookExecution#onWillDisposeDocument`);
    this.cancelAll();
  }
  onWillAddRemoveCells(e) {
    const notebookExes = this._notebookExecutionStateService.getCellExecutionsByHandleForNotebook(this._notebookModel.uri);
    const executingDeletedHandles = /* @__PURE__ */ new Set();
    const pendingDeletedHandles = /* @__PURE__ */ new Set();
    if (notebookExes) {
      e.rawEvent.changes.forEach(([start, deleteCount]) => {
        if (deleteCount) {
          const deletedHandles = this._notebookModel.cells.slice(start, start + deleteCount).map((c) => c.handle);
          deletedHandles.forEach((h) => {
            const exe = notebookExes.get(h);
            if (exe?.state === NotebookCellExecutionState.Executing) {
              executingDeletedHandles.add(h);
            } else if (exe) {
              pendingDeletedHandles.add(h);
            }
          });
        }
      });
    }
    if (executingDeletedHandles.size || pendingDeletedHandles.size) {
      const kernel = this._notebookKernelService.getSelectedOrSuggestedKernel(this._notebookModel);
      if (kernel) {
        const implementsInterrupt = kernel.implementsInterrupt;
        const handlesToCancel = implementsInterrupt ? [...executingDeletedHandles] : [...executingDeletedHandles, ...pendingDeletedHandles];
        this._logService.debug(`NotebookExecution#onWillAddRemoveCells, ${JSON.stringify([...handlesToCancel])}`);
        if (handlesToCancel.length) {
          kernel.cancelNotebookCellExecution(this._notebookModel.uri, handlesToCancel);
        }
      }
    }
  }
};
NotebookExecutionListeners = __decorateClass([
  __decorateParam(1, INotebookService),
  __decorateParam(2, INotebookKernelService),
  __decorateParam(3, INotebookExecutionService),
  __decorateParam(4, INotebookExecutionStateService),
  __decorateParam(5, ILogService)
], NotebookExecutionListeners);
function updateToEdit(update, cellHandle) {
  if (update.editType === CellExecutionUpdateType.Output) {
    return {
      editType: CellEditType.Output,
      handle: update.cellHandle,
      append: update.append,
      outputs: update.outputs
    };
  } else if (update.editType === CellExecutionUpdateType.OutputItems) {
    return {
      editType: CellEditType.OutputItems,
      items: update.items,
      append: update.append,
      outputId: update.outputId
    };
  } else if (update.editType === CellExecutionUpdateType.ExecutionState) {
    const newInternalMetadata = {};
    if (typeof update.executionOrder !== "undefined") {
      newInternalMetadata.executionOrder = update.executionOrder;
    }
    if (typeof update.runStartTime !== "undefined") {
      newInternalMetadata.runStartTime = update.runStartTime;
    }
    return {
      editType: CellEditType.PartialInternalMetadata,
      handle: cellHandle,
      internalMetadata: newInternalMetadata
    };
  }
  throw new Error("Unknown cell update type");
}
let CellExecution = class extends Disposable {
  constructor(cellHandle, _notebookModel, _logService) {
    super();
    this.cellHandle = cellHandle;
    this._notebookModel = _notebookModel;
    this._logService = _logService;
    this._onDidUpdate = this._register(new Emitter());
    this.onDidUpdate = this._onDidUpdate.event;
    this._onDidComplete = this._register(new Emitter());
    this.onDidComplete = this._onDidComplete.event;
    this._state = NotebookCellExecutionState.Unconfirmed;
    this._didPause = false;
    this._isPaused = false;
    this._logService.debug(`CellExecution#ctor ${this.getCellLog()}`);
  }
  get state() {
    return this._state;
  }
  get notebook() {
    return this._notebookModel.uri;
  }
  get didPause() {
    return this._didPause;
  }
  get isPaused() {
    return this._isPaused;
  }
  initialize() {
    const startExecuteEdit = {
      editType: CellEditType.PartialInternalMetadata,
      handle: this.cellHandle,
      internalMetadata: {
        executionId: generateUuid(),
        runStartTime: null,
        runEndTime: null,
        lastRunSuccess: null,
        executionOrder: null,
        renderDuration: null
      }
    };
    this._applyExecutionEdits([startExecuteEdit]);
  }
  getCellLog() {
    return `${this._notebookModel.uri.toString()}, ${this.cellHandle}`;
  }
  logUpdates(updates) {
    const updateTypes = updates.map((u) => CellExecutionUpdateType[u.editType]).join(", ");
    this._logService.debug(`CellExecution#updateExecution ${this.getCellLog()}, [${updateTypes}]`);
  }
  confirm() {
    this._logService.debug(`CellExecution#confirm ${this.getCellLog()}`);
    this._state = NotebookCellExecutionState.Pending;
    this._onDidUpdate.fire();
  }
  update(updates) {
    this.logUpdates(updates);
    if (updates.some((u) => u.editType === CellExecutionUpdateType.ExecutionState)) {
      this._state = NotebookCellExecutionState.Executing;
    }
    if (!this._didPause && updates.some((u) => u.editType === CellExecutionUpdateType.ExecutionState && u.didPause)) {
      this._didPause = true;
    }
    const lastIsPausedUpdate = [...updates].reverse().find((u) => u.editType === CellExecutionUpdateType.ExecutionState && typeof u.isPaused === "boolean");
    if (lastIsPausedUpdate) {
      this._isPaused = lastIsPausedUpdate.isPaused;
    }
    const cellModel = this._notebookModel.cells.find((c) => c.handle === this.cellHandle);
    if (!cellModel) {
      this._logService.debug(`CellExecution#update, updating cell not in notebook: ${this._notebookModel.uri.toString()}, ${this.cellHandle}`);
    } else {
      const edits = updates.map((update) => updateToEdit(update, this.cellHandle));
      this._applyExecutionEdits(edits);
    }
    if (updates.some((u) => u.editType === CellExecutionUpdateType.ExecutionState)) {
      this._onDidUpdate.fire();
    }
  }
  complete(completionData) {
    const cellModel = this._notebookModel.cells.find((c) => c.handle === this.cellHandle);
    if (!cellModel) {
      this._logService.debug(`CellExecution#complete, completing cell not in notebook: ${this._notebookModel.uri.toString()}, ${this.cellHandle}`);
    } else {
      const edit = {
        editType: CellEditType.PartialInternalMetadata,
        handle: this.cellHandle,
        internalMetadata: {
          lastRunSuccess: completionData.lastRunSuccess,
          runStartTime: this._didPause ? null : cellModel.internalMetadata.runStartTime,
          runEndTime: this._didPause ? null : completionData.runEndTime,
          error: completionData.error
        }
      };
      this._applyExecutionEdits([edit]);
    }
    this._onDidComplete.fire(completionData.lastRunSuccess);
  }
  _applyExecutionEdits(edits) {
    this._notebookModel.applyEdits(edits, true, void 0, () => void 0, void 0, false);
  }
};
CellExecution = __decorateClass([
  __decorateParam(2, ILogService)
], CellExecution);
let NotebookExecution = class extends Disposable {
  constructor(_notebookModel, _logService) {
    super();
    this._notebookModel = _notebookModel;
    this._logService = _logService;
    this._onDidUpdate = this._register(new Emitter());
    this.onDidUpdate = this._onDidUpdate.event;
    this._onDidComplete = this._register(new Emitter());
    this.onDidComplete = this._onDidComplete.event;
    this._state = NotebookExecutionState.Unconfirmed;
    this._logService.debug(`NotebookExecution#ctor`);
  }
  get state() {
    return this._state;
  }
  get notebook() {
    return this._notebookModel.uri;
  }
  debug(message) {
    this._logService.debug(`${message} ${this._notebookModel.uri.toString()}`);
  }
  confirm() {
    this.debug(`Execution#confirm`);
    this._state = NotebookExecutionState.Pending;
    this._onDidUpdate.fire();
  }
  begin() {
    this.debug(`Execution#begin`);
    this._state = NotebookExecutionState.Executing;
    this._onDidUpdate.fire();
  }
  complete() {
    this.debug(`Execution#begin`);
    this._state = NotebookExecutionState.Unconfirmed;
    this._onDidComplete.fire();
  }
};
NotebookExecution = __decorateClass([
  __decorateParam(1, ILogService)
], NotebookExecution);
export {
  NotebookExecutionStateService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3NlcnZpY2VzL25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlSW1wbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBjb21iaW5lZERpc3Bvc2FibGUsIERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFJlc291cmNlTWFwIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eVNpZ25hbCwgSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eVNpZ25hbC9icm93c2VyL2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va1RleHRNb2RlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi9tb2RlbC9ub3RlYm9va1RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBDZWxsRWRpdFR5cGUsIENlbGxVcmksIElDZWxsRWRpdE9wZXJhdGlvbiwgTm90ZWJvb2tDZWxsRXhlY3V0aW9uU3RhdGUsIE5vdGVib29rQ2VsbEludGVybmFsTWV0YWRhdGEsIE5vdGVib29rRXhlY3V0aW9uU3RhdGUsIE5vdGVib29rVGV4dE1vZGVsV2lsbEFkZFJlbW92ZUV2ZW50IH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IENlbGxFeGVjdXRpb25VcGRhdGVUeXBlLCBJTm90ZWJvb2tFeGVjdXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rRXhlY3V0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ2VsbEV4ZWN1dGVVcGRhdGUsIElDZWxsRXhlY3V0aW9uQ29tcGxldGUsIElDZWxsRXhlY3V0aW9uU3RhdGVDaGFuZ2VkRXZlbnQsIElDZWxsRXhlY3V0aW9uU3RhdGVVcGRhdGUsIElFeGVjdXRpb25TdGF0ZUNoYW5nZWRFdmVudCwgSUZhaWxlZENlbGxJbmZvLCBJTm90ZWJvb2tDZWxsRXhlY3V0aW9uLCBJTm90ZWJvb2tFeGVjdXRpb24sIElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSwgSU5vdGVib29rRmFpbFN0YXRlQ2hhbmdlZEV2ZW50LCBOb3RlYm9va0V4ZWN1dGlvblR5cGUgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rS2VybmVsU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0tlcm5lbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va1NlcnZpY2UuanMnO1xuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlIHtcblx0ZGVjbGFyZSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZXhlY3V0aW9ucyA9IG5ldyBSZXNvdXJjZU1hcDxNYXA8bnVtYmVyLCBDZWxsRXhlY3V0aW9uPj4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tFeGVjdXRpb25zID0gbmV3IFJlc291cmNlTWFwPFtOb3RlYm9va0V4ZWN1dGlvbiwgSURpc3Bvc2FibGVdPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9ub3RlYm9va0xpc3RlbmVycyA9IG5ldyBSZXNvdXJjZU1hcDxOb3RlYm9va0V4ZWN1dGlvbkxpc3RlbmVycz4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfY2VsbExpc3RlbmVycyA9IG5ldyBSZXNvdXJjZU1hcDxJRGlzcG9zYWJsZT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfbGFzdEZhaWxlZENlbGxzID0gbmV3IFJlc291cmNlTWFwPElGYWlsZWRDZWxsSW5mbz4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfbGFzdENvbXBsZXRlZENlbGxIYW5kbGVzID0gbmV3IFJlc291cmNlTWFwPG51bWJlcj4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUV4ZWN1dGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElDZWxsRXhlY3V0aW9uU3RhdGVDaGFuZ2VkRXZlbnQgfCBJRXhlY3V0aW9uU3RhdGVDaGFuZ2VkRXZlbnQ+KCkpO1xuXHRvbkRpZENoYW5nZUV4ZWN1dGlvbiA9IHRoaXMuX29uRGlkQ2hhbmdlRXhlY3V0aW9uLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlTGFzdFJ1bkZhaWxTdGF0ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElOb3RlYm9va0ZhaWxTdGF0ZUNoYW5nZWRFdmVudD4oKSk7XG5cdG9uRGlkQ2hhbmdlTGFzdFJ1bkZhaWxTdGF0ZSA9IHRoaXMuX29uRGlkQ2hhbmdlTGFzdFJ1bkZhaWxTdGF0ZS5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rU2VydmljZTogSU5vdGVib29rU2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlOiBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdGdldExhc3RGYWlsZWRDZWxsRm9yTm90ZWJvb2sobm90ZWJvb2s6IFVSSSk6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgZmFpbGVkQ2VsbCA9IHRoaXMuX2xhc3RGYWlsZWRDZWxscy5nZXQobm90ZWJvb2spO1xuXHRcdHJldHVybiBmYWlsZWRDZWxsPy52aXNpYmxlID8gZmFpbGVkQ2VsbC5jZWxsSGFuZGxlIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0TGFzdENvbXBsZXRlZENlbGxGb3JOb3RlYm9vayhub3RlYm9vazogVVJJKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fbGFzdENvbXBsZXRlZENlbGxIYW5kbGVzLmdldChub3RlYm9vayk7XG5cdH1cblxuXHRmb3JjZUNhbmNlbE5vdGVib29rRXhlY3V0aW9ucyhub3RlYm9va1VyaTogVVJJKTogdm9pZCB7XG5cdFx0Y29uc3Qgbm90ZWJvb2tDZWxsRXhlY3V0aW9ucyA9IHRoaXMuX2V4ZWN1dGlvbnMuZ2V0KG5vdGVib29rVXJpKTtcblx0XHRpZiAobm90ZWJvb2tDZWxsRXhlY3V0aW9ucykge1xuXHRcdFx0Zm9yIChjb25zdCBleGUgb2Ygbm90ZWJvb2tDZWxsRXhlY3V0aW9ucy52YWx1ZXMoKSkge1xuXHRcdFx0XHR0aGlzLl9vbkNlbGxFeGVjdXRpb25EaWRDb21wbGV0ZShub3RlYm9va1VyaSwgZXhlLmNlbGxIYW5kbGUsIGV4ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9ub3RlYm9va0V4ZWN1dGlvbnMuaGFzKG5vdGVib29rVXJpKSkge1xuXHRcdFx0dGhpcy5fb25FeGVjdXRpb25EaWRDb21wbGV0ZShub3RlYm9va1VyaSk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0Q2VsbEV4ZWN1dGlvbihjZWxsVXJpOiBVUkkpOiBJTm90ZWJvb2tDZWxsRXhlY3V0aW9uIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBwYXJzZWQgPSBDZWxsVXJpLnBhcnNlKGNlbGxVcmkpO1xuXHRcdGlmICghcGFyc2VkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYE5vdCBhIGNlbGwgVVJJOiAke2NlbGxVcml9YCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXhlTWFwID0gdGhpcy5fZXhlY3V0aW9ucy5nZXQocGFyc2VkLm5vdGVib29rKTtcblx0XHRpZiAoZXhlTWFwKSB7XG5cdFx0XHRyZXR1cm4gZXhlTWFwLmdldChwYXJzZWQuaGFuZGxlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cdGdldEV4ZWN1dGlvbihub3RlYm9vazogVVJJKTogSU5vdGVib29rRXhlY3V0aW9uIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fbm90ZWJvb2tFeGVjdXRpb25zLmdldChub3RlYm9vayk/LlswXTtcblx0fVxuXG5cdGdldENlbGxFeGVjdXRpb25zRm9yTm90ZWJvb2sobm90ZWJvb2s6IFVSSSk6IElOb3RlYm9va0NlbGxFeGVjdXRpb25bXSB7XG5cdFx0Y29uc3QgZXhlTWFwID0gdGhpcy5fZXhlY3V0aW9ucy5nZXQobm90ZWJvb2spO1xuXHRcdHJldHVybiBleGVNYXAgPyBBcnJheS5mcm9tKGV4ZU1hcC52YWx1ZXMoKSkgOiBbXTtcblx0fVxuXG5cdGdldENlbGxFeGVjdXRpb25zQnlIYW5kbGVGb3JOb3RlYm9vayhub3RlYm9vazogVVJJKTogTWFwPG51bWJlciwgSU5vdGVib29rQ2VsbEV4ZWN1dGlvbj4gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGV4ZU1hcCA9IHRoaXMuX2V4ZWN1dGlvbnMuZ2V0KG5vdGVib29rKTtcblx0XHRyZXR1cm4gZXhlTWFwID8gbmV3IE1hcChleGVNYXAuZW50cmllcygpKSA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgX29uQ2VsbEV4ZWN1dGlvbkRpZENoYW5nZShub3RlYm9va1VyaTogVVJJLCBjZWxsSGFuZGxlOiBudW1iZXIsIGV4ZTogQ2VsbEV4ZWN1dGlvbik6IHZvaWQge1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlRXhlY3V0aW9uLmZpcmUobmV3IE5vdGVib29rQ2VsbEV4ZWN1dGlvbkV2ZW50KG5vdGVib29rVXJpLCBjZWxsSGFuZGxlLCBleGUpKTtcblx0fVxuXG5cdHByaXZhdGUgX29uQ2VsbEV4ZWN1dGlvbkRpZENvbXBsZXRlKG5vdGVib29rVXJpOiBVUkksIGNlbGxIYW5kbGU6IG51bWJlciwgZXhlOiBDZWxsRXhlY3V0aW9uLCBsYXN0UnVuU3VjY2Vzcz86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCBub3RlYm9va0V4ZWN1dGlvbnMgPSB0aGlzLl9leGVjdXRpb25zLmdldChub3RlYm9va1VyaSk7XG5cdFx0aWYgKCFub3RlYm9va0V4ZWN1dGlvbnMpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoYE5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlI19vbkNlbGxFeGVjdXRpb25EaWRDb21wbGV0ZSAtIHVua25vd24gbm90ZWJvb2sgJHtub3RlYm9va1VyaS50b1N0cmluZygpfWApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGV4ZS5kaXNwb3NlKCk7XG5cdFx0Y29uc3QgY2VsbFVyaSA9IENlbGxVcmkuZ2VuZXJhdGUobm90ZWJvb2tVcmksIGNlbGxIYW5kbGUpO1xuXHRcdHRoaXMuX2NlbGxMaXN0ZW5lcnMuZ2V0KGNlbGxVcmkpPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fY2VsbExpc3RlbmVycy5kZWxldGUoY2VsbFVyaSk7XG5cdFx0bm90ZWJvb2tFeGVjdXRpb25zLmRlbGV0ZShjZWxsSGFuZGxlKTtcblx0XHRpZiAobm90ZWJvb2tFeGVjdXRpb25zLnNpemUgPT09IDApIHtcblx0XHRcdHRoaXMuX2V4ZWN1dGlvbnMuZGVsZXRlKG5vdGVib29rVXJpKTtcblx0XHRcdHRoaXMuX25vdGVib29rTGlzdGVuZXJzLmdldChub3RlYm9va1VyaSk/LmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuX25vdGVib29rTGlzdGVuZXJzLmRlbGV0ZShub3RlYm9va1VyaSk7XG5cdFx0fVxuXG5cdFx0aWYgKGxhc3RSdW5TdWNjZXNzICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGlmIChsYXN0UnVuU3VjY2Vzcykge1xuXHRcdFx0XHRpZiAodGhpcy5fZXhlY3V0aW9ucy5zaXplID09PSAwKSB7XG5cdFx0XHRcdFx0dGhpcy5fYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UucGxheVNpZ25hbChBY2Nlc3NpYmlsaXR5U2lnbmFsLm5vdGVib29rQ2VsbENvbXBsZXRlZCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fY2xlYXJMYXN0RmFpbGVkQ2VsbChub3RlYm9va1VyaSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9hY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZS5wbGF5U2lnbmFsKEFjY2Vzc2liaWxpdHlTaWduYWwubm90ZWJvb2tDZWxsRmFpbGVkKTtcblx0XHRcdFx0dGhpcy5fc2V0TGFzdEZhaWxlZENlbGwobm90ZWJvb2tVcmksIGNlbGxIYW5kbGUpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fbGFzdENvbXBsZXRlZENlbGxIYW5kbGVzLnNldChub3RlYm9va1VyaSwgY2VsbEhhbmRsZSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VFeGVjdXRpb24uZmlyZShuZXcgTm90ZWJvb2tDZWxsRXhlY3V0aW9uRXZlbnQobm90ZWJvb2tVcmksIGNlbGxIYW5kbGUpKTtcblx0fVxuXG5cdHByaXZhdGUgX29uRXhlY3V0aW9uRGlkQ2hhbmdlKG5vdGVib29rVXJpOiBVUkksIGV4ZTogTm90ZWJvb2tFeGVjdXRpb24pOiB2b2lkIHtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUV4ZWN1dGlvbi5maXJlKG5ldyBOb3RlYm9va0V4ZWN1dGlvbkV2ZW50KG5vdGVib29rVXJpLCBleGUpKTtcblx0fVxuXG5cdHByaXZhdGUgX29uRXhlY3V0aW9uRGlkQ29tcGxldGUobm90ZWJvb2tVcmk6IFVSSSk6IHZvaWQge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gdGhpcy5fbm90ZWJvb2tFeGVjdXRpb25zLmdldChub3RlYm9va1VyaSk7XG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGRpc3Bvc2FibGVzKSkge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZyhgTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UjX29uQ2VsbEV4ZWN1dGlvbkRpZENvbXBsZXRlIC0gdW5rbm93biBub3RlYm9vayAke25vdGVib29rVXJpLnRvU3RyaW5nKCl9YCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fbm90ZWJvb2tFeGVjdXRpb25zLmRlbGV0ZShub3RlYm9va1VyaSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VFeGVjdXRpb24uZmlyZShuZXcgTm90ZWJvb2tFeGVjdXRpb25FdmVudChub3RlYm9va1VyaSkpO1xuXHRcdGRpc3Bvc2FibGVzLmZvckVhY2goZCA9PiBkLmRpc3Bvc2UoKSk7XG5cdH1cblxuXHRjcmVhdGVDZWxsRXhlY3V0aW9uKG5vdGVib29rVXJpOiBVUkksIGNlbGxIYW5kbGU6IG51bWJlcik6IElOb3RlYm9va0NlbGxFeGVjdXRpb24ge1xuXHRcdGNvbnN0IG5vdGVib29rID0gdGhpcy5fbm90ZWJvb2tTZXJ2aWNlLmdldE5vdGVib29rVGV4dE1vZGVsKG5vdGVib29rVXJpKTtcblx0XHRpZiAoIW5vdGVib29rKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYE5vdGVib29rIG5vdCBmb3VuZDogJHtub3RlYm9va1VyaS50b1N0cmluZygpfWApO1xuXHRcdH1cblxuXHRcdGxldCBub3RlYm9va0V4ZWN1dGlvbk1hcCA9IHRoaXMuX2V4ZWN1dGlvbnMuZ2V0KG5vdGVib29rVXJpKTtcblx0XHRpZiAoIW5vdGVib29rRXhlY3V0aW9uTWFwKSB7XG5cdFx0XHRjb25zdCBsaXN0ZW5lcnMgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShOb3RlYm9va0V4ZWN1dGlvbkxpc3RlbmVycywgbm90ZWJvb2tVcmkpO1xuXHRcdFx0dGhpcy5fbm90ZWJvb2tMaXN0ZW5lcnMuc2V0KG5vdGVib29rVXJpLCBsaXN0ZW5lcnMpO1xuXG5cdFx0XHRub3RlYm9va0V4ZWN1dGlvbk1hcCA9IG5ldyBNYXA8bnVtYmVyLCBDZWxsRXhlY3V0aW9uPigpO1xuXHRcdFx0dGhpcy5fZXhlY3V0aW9ucy5zZXQobm90ZWJvb2tVcmksIG5vdGVib29rRXhlY3V0aW9uTWFwKTtcblx0XHR9XG5cblx0XHRsZXQgZXhlID0gbm90ZWJvb2tFeGVjdXRpb25NYXAuZ2V0KGNlbGxIYW5kbGUpO1xuXHRcdGlmICghZXhlKSB7XG5cdFx0XHRleGUgPSB0aGlzLl9jcmVhdGVOb3RlYm9va0NlbGxFeGVjdXRpb24obm90ZWJvb2ssIGNlbGxIYW5kbGUpO1xuXHRcdFx0bm90ZWJvb2tFeGVjdXRpb25NYXAuc2V0KGNlbGxIYW5kbGUsIGV4ZSk7XG5cdFx0XHRleGUuaW5pdGlhbGl6ZSgpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VFeGVjdXRpb24uZmlyZShuZXcgTm90ZWJvb2tDZWxsRXhlY3V0aW9uRXZlbnQobm90ZWJvb2tVcmksIGNlbGxIYW5kbGUsIGV4ZSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBleGU7XG5cdH1cblx0Y3JlYXRlRXhlY3V0aW9uKG5vdGVib29rVXJpOiBVUkkpOiBJTm90ZWJvb2tFeGVjdXRpb24ge1xuXHRcdGNvbnN0IG5vdGVib29rID0gdGhpcy5fbm90ZWJvb2tTZXJ2aWNlLmdldE5vdGVib29rVGV4dE1vZGVsKG5vdGVib29rVXJpKTtcblx0XHRpZiAoIW5vdGVib29rKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYE5vdGVib29rIG5vdCBmb3VuZDogJHtub3RlYm9va1VyaS50b1N0cmluZygpfWApO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fbm90ZWJvb2tMaXN0ZW5lcnMuaGFzKG5vdGVib29rVXJpKSkge1xuXHRcdFx0Y29uc3QgbGlzdGVuZXJzID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90ZWJvb2tFeGVjdXRpb25MaXN0ZW5lcnMsIG5vdGVib29rVXJpKTtcblx0XHRcdHRoaXMuX25vdGVib29rTGlzdGVuZXJzLnNldChub3RlYm9va1VyaSwgbGlzdGVuZXJzKTtcblx0XHR9XG5cblx0XHRsZXQgaW5mbyA9IHRoaXMuX25vdGVib29rRXhlY3V0aW9ucy5nZXQobm90ZWJvb2tVcmkpO1xuXHRcdGlmICghaW5mbykge1xuXHRcdFx0aW5mbyA9IHRoaXMuX2NyZWF0ZU5vdGVib29rRXhlY3V0aW9uKG5vdGVib29rKTtcblx0XHRcdHRoaXMuX25vdGVib29rRXhlY3V0aW9ucy5zZXQobm90ZWJvb2tVcmksIGluZm8pO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VFeGVjdXRpb24uZmlyZShuZXcgTm90ZWJvb2tFeGVjdXRpb25FdmVudChub3RlYm9va1VyaSwgaW5mb1swXSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBpbmZvWzBdO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlTm90ZWJvb2tDZWxsRXhlY3V0aW9uKG5vdGVib29rOiBOb3RlYm9va1RleHRNb2RlbCwgY2VsbEhhbmRsZTogbnVtYmVyKTogQ2VsbEV4ZWN1dGlvbiB7XG5cdFx0Y29uc3Qgbm90ZWJvb2tVcmkgPSBub3RlYm9vay51cmk7XG5cdFx0Y29uc3QgZXhlOiBDZWxsRXhlY3V0aW9uID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2VsbEV4ZWN1dGlvbiwgY2VsbEhhbmRsZSwgbm90ZWJvb2spO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBjb21iaW5lZERpc3Bvc2FibGUoXG5cdFx0XHRleGUub25EaWRVcGRhdGUoKCkgPT4gdGhpcy5fb25DZWxsRXhlY3V0aW9uRGlkQ2hhbmdlKG5vdGVib29rVXJpLCBjZWxsSGFuZGxlLCBleGUpKSxcblx0XHRcdGV4ZS5vbkRpZENvbXBsZXRlKGxhc3RSdW5TdWNjZXNzID0+IHRoaXMuX29uQ2VsbEV4ZWN1dGlvbkRpZENvbXBsZXRlKG5vdGVib29rVXJpLCBjZWxsSGFuZGxlLCBleGUsIGxhc3RSdW5TdWNjZXNzKSkpO1xuXHRcdHRoaXMuX2NlbGxMaXN0ZW5lcnMuc2V0KENlbGxVcmkuZ2VuZXJhdGUobm90ZWJvb2tVcmksIGNlbGxIYW5kbGUpLCBkaXNwb3NhYmxlKTtcblxuXHRcdHJldHVybiBleGU7XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVOb3RlYm9va0V4ZWN1dGlvbihub3RlYm9vazogTm90ZWJvb2tUZXh0TW9kZWwpOiBbTm90ZWJvb2tFeGVjdXRpb24sIElEaXNwb3NhYmxlXSB7XG5cdFx0Y29uc3Qgbm90ZWJvb2tVcmkgPSBub3RlYm9vay51cmk7XG5cdFx0Y29uc3QgZXhlOiBOb3RlYm9va0V4ZWN1dGlvbiA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vdGVib29rRXhlY3V0aW9uLCBub3RlYm9vayk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGNvbWJpbmVkRGlzcG9zYWJsZShcblx0XHRcdGV4ZS5vbkRpZFVwZGF0ZSgoKSA9PiB0aGlzLl9vbkV4ZWN1dGlvbkRpZENoYW5nZShub3RlYm9va1VyaSwgZXhlKSksXG5cdFx0XHRleGUub25EaWRDb21wbGV0ZSgoKSA9PiB0aGlzLl9vbkV4ZWN1dGlvbkRpZENvbXBsZXRlKG5vdGVib29rVXJpKSkpO1xuXHRcdHJldHVybiBbZXhlLCBkaXNwb3NhYmxlXTtcblx0fVxuXG5cdHByaXZhdGUgX3NldExhc3RGYWlsZWRDZWxsKG5vdGVib29rVVJJOiBVUkksIGNlbGxIYW5kbGU6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IHByZXZMYXN0RmFpbGVkQ2VsbEluZm8gPSB0aGlzLl9sYXN0RmFpbGVkQ2VsbHMuZ2V0KG5vdGVib29rVVJJKTtcblx0XHRjb25zdCBub3RlYm9vayA9IHRoaXMuX25vdGVib29rU2VydmljZS5nZXROb3RlYm9va1RleHRNb2RlbChub3RlYm9va1VSSSk7XG5cdFx0aWYgKCFub3RlYm9vaykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5ld0xhc3RGYWlsZWRDZWxsSW5mbzogSUZhaWxlZENlbGxJbmZvID0ge1xuXHRcdFx0Y2VsbEhhbmRsZTogY2VsbEhhbmRsZSxcblx0XHRcdGRpc3Bvc2FibGU6IHByZXZMYXN0RmFpbGVkQ2VsbEluZm8gPyBwcmV2TGFzdEZhaWxlZENlbGxJbmZvLmRpc3Bvc2FibGUgOiB0aGlzLl9nZXRGYWlsZWRDZWxsTGlzdGVuZXIobm90ZWJvb2spLFxuXHRcdFx0dmlzaWJsZTogdHJ1ZVxuXHRcdH07XG5cblx0XHR0aGlzLl9sYXN0RmFpbGVkQ2VsbHMuc2V0KG5vdGVib29rVVJJLCBuZXdMYXN0RmFpbGVkQ2VsbEluZm8pO1xuXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VMYXN0UnVuRmFpbFN0YXRlLmZpcmUoeyB2aXNpYmxlOiB0cnVlLCBub3RlYm9vazogbm90ZWJvb2tVUkkgfSk7XG5cdH1cblxuXHRwcml2YXRlIF9zZXRMYXN0RmFpbGVkQ2VsbFZpc2liaWxpdHkobm90ZWJvb2tVUkk6IFVSSSwgdmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IGxhc3RGYWlsZWRDZWxsSW5mbyA9IHRoaXMuX2xhc3RGYWlsZWRDZWxscy5nZXQobm90ZWJvb2tVUkkpO1xuXG5cdFx0aWYgKGxhc3RGYWlsZWRDZWxsSW5mbykge1xuXHRcdFx0dGhpcy5fbGFzdEZhaWxlZENlbGxzLnNldChub3RlYm9va1VSSSwge1xuXHRcdFx0XHRjZWxsSGFuZGxlOiBsYXN0RmFpbGVkQ2VsbEluZm8uY2VsbEhhbmRsZSxcblx0XHRcdFx0ZGlzcG9zYWJsZTogbGFzdEZhaWxlZENlbGxJbmZvLmRpc3Bvc2FibGUsXG5cdFx0XHRcdHZpc2libGU6IHZpc2libGUsXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZUxhc3RSdW5GYWlsU3RhdGUuZmlyZSh7IHZpc2libGU6IHZpc2libGUsIG5vdGVib29rOiBub3RlYm9va1VSSSB9KTtcblx0fVxuXG5cdHByaXZhdGUgX2NsZWFyTGFzdEZhaWxlZENlbGwobm90ZWJvb2tVUkk6IFVSSSk6IHZvaWQge1xuXHRcdGNvbnN0IGxhc3RGYWlsZWRDZWxsSW5mbyA9IHRoaXMuX2xhc3RGYWlsZWRDZWxscy5nZXQobm90ZWJvb2tVUkkpO1xuXG5cdFx0aWYgKGxhc3RGYWlsZWRDZWxsSW5mbykge1xuXHRcdFx0bGFzdEZhaWxlZENlbGxJbmZvLmRpc3Bvc2FibGU/LmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuX2xhc3RGYWlsZWRDZWxscy5kZWxldGUobm90ZWJvb2tVUkkpO1xuXHRcdH1cblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlTGFzdFJ1bkZhaWxTdGF0ZS5maXJlKHsgdmlzaWJsZTogZmFsc2UsIG5vdGVib29rOiBub3RlYm9va1VSSSB9KTtcblx0fVxuXG5cdHByaXZhdGUgX2dldEZhaWxlZENlbGxMaXN0ZW5lcihub3RlYm9vazogTm90ZWJvb2tUZXh0TW9kZWwpOiBJRGlzcG9zYWJsZSB7XG5cdFx0cmV0dXJuIG5vdGVib29rLm9uV2lsbEFkZFJlbW92ZUNlbGxzKChlOiBOb3RlYm9va1RleHRNb2RlbFdpbGxBZGRSZW1vdmVFdmVudCkgPT4ge1xuXHRcdFx0Y29uc3QgbGFzdEZhaWxlZENlbGwgPSB0aGlzLl9sYXN0RmFpbGVkQ2VsbHMuZ2V0KG5vdGVib29rLnVyaSk/LmNlbGxIYW5kbGU7XG5cdFx0XHRpZiAobGFzdEZhaWxlZENlbGwgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRjb25zdCBsYXN0RmFpbGVkQ2VsbFBvcyA9IG5vdGVib29rLmNlbGxzLmZpbmRJbmRleChjID0+IGMuaGFuZGxlID09PSBsYXN0RmFpbGVkQ2VsbCk7XG5cdFx0XHRcdGUucmF3RXZlbnQuY2hhbmdlcy5mb3JFYWNoKChbc3RhcnQsIGRlbGV0ZUNvdW50LCBhZGRlZENlbGxzXSkgPT4ge1xuXHRcdFx0XHRcdGlmIChkZWxldGVDb3VudCkge1xuXHRcdFx0XHRcdFx0aWYgKGxhc3RGYWlsZWRDZWxsUG9zID49IHN0YXJ0ICYmIGxhc3RGYWlsZWRDZWxsUG9zIDwgc3RhcnQgKyBkZWxldGVDb3VudCkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9zZXRMYXN0RmFpbGVkQ2VsbFZpc2liaWxpdHkobm90ZWJvb2sudXJpLCBmYWxzZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKGFkZGVkQ2VsbHMuc29tZShjZWxsID0+IGNlbGwuaGFuZGxlID09PSBsYXN0RmFpbGVkQ2VsbCkpIHtcblx0XHRcdFx0XHRcdHRoaXMuX3NldExhc3RGYWlsZWRDZWxsVmlzaWJpbGl0eShub3RlYm9vay51cmksIHRydWUpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2V4ZWN1dGlvbnMuZm9yRWFjaChleGVjdXRpb25NYXAgPT4ge1xuXHRcdFx0ZXhlY3V0aW9uTWFwLmZvckVhY2goZXhlY3V0aW9uID0+IGV4ZWN1dGlvbi5kaXNwb3NlKCkpO1xuXHRcdFx0ZXhlY3V0aW9uTWFwLmNsZWFyKCk7XG5cdFx0fSk7XG5cdFx0dGhpcy5fZXhlY3V0aW9ucy5jbGVhcigpO1xuXHRcdHRoaXMuX25vdGVib29rRXhlY3V0aW9ucy5mb3JFYWNoKGRpc3Bvc2FibGVzID0+IHtcblx0XHRcdGRpc3Bvc2FibGVzLmZvckVhY2goZCA9PiBkLmRpc3Bvc2UoKSk7XG5cdFx0fSk7XG5cdFx0dGhpcy5fbm90ZWJvb2tFeGVjdXRpb25zLmNsZWFyKCk7XG5cblx0XHR0aGlzLl9jZWxsTGlzdGVuZXJzLmZvckVhY2goZGlzcG9zYWJsZSA9PiBkaXNwb3NhYmxlLmRpc3Bvc2UoKSk7XG5cdFx0dGhpcy5fbm90ZWJvb2tMaXN0ZW5lcnMuZm9yRWFjaChkaXNwb3NhYmxlID0+IGRpc3Bvc2FibGUuZGlzcG9zZSgpKTtcblx0XHR0aGlzLl9sYXN0RmFpbGVkQ2VsbHMuZm9yRWFjaChlbGVtID0+IGVsZW0uZGlzcG9zYWJsZS5kaXNwb3NlKCkpO1xuXHR9XG59XG5cbmNsYXNzIE5vdGVib29rQ2VsbEV4ZWN1dGlvbkV2ZW50IGltcGxlbWVudHMgSUNlbGxFeGVjdXRpb25TdGF0ZUNoYW5nZWRFdmVudCB7XG5cdHJlYWRvbmx5IHR5cGUgPSBOb3RlYm9va0V4ZWN1dGlvblR5cGUuY2VsbDtcblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgbm90ZWJvb2s6IFVSSSxcblx0XHRyZWFkb25seSBjZWxsSGFuZGxlOiBudW1iZXIsXG5cdFx0cmVhZG9ubHkgY2hhbmdlZD86IENlbGxFeGVjdXRpb25cblx0KSB7IH1cblxuXHRhZmZlY3RzQ2VsbChjZWxsOiBVUkkpOiBib29sZWFuIHtcblx0XHRjb25zdCBwYXJzZWRVcmkgPSBDZWxsVXJpLnBhcnNlKGNlbGwpO1xuXHRcdHJldHVybiAhIXBhcnNlZFVyaSAmJiBpc0VxdWFsKHRoaXMubm90ZWJvb2ssIHBhcnNlZFVyaS5ub3RlYm9vaykgJiYgdGhpcy5jZWxsSGFuZGxlID09PSBwYXJzZWRVcmkuaGFuZGxlO1xuXHR9XG5cblx0YWZmZWN0c05vdGVib29rKG5vdGVib29rOiBVUkkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gaXNFcXVhbCh0aGlzLm5vdGVib29rLCBub3RlYm9vayk7XG5cdH1cbn1cblxuY2xhc3MgTm90ZWJvb2tFeGVjdXRpb25FdmVudCBpbXBsZW1lbnRzIElFeGVjdXRpb25TdGF0ZUNoYW5nZWRFdmVudCB7XG5cdHJlYWRvbmx5IHR5cGUgPSBOb3RlYm9va0V4ZWN1dGlvblR5cGUubm90ZWJvb2s7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IG5vdGVib29rOiBVUkksXG5cdFx0cmVhZG9ubHkgY2hhbmdlZD86IE5vdGVib29rRXhlY3V0aW9uXG5cdCkgeyB9XG5cblx0YWZmZWN0c05vdGVib29rKG5vdGVib29rOiBVUkkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gaXNFcXVhbCh0aGlzLm5vdGVib29rLCBub3RlYm9vayk7XG5cdH1cbn1cblxuY2xhc3MgTm90ZWJvb2tFeGVjdXRpb25MaXN0ZW5lcnMgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tNb2RlbDogTm90ZWJvb2tUZXh0TW9kZWw7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0bm90ZWJvb2s6IFVSSSxcblx0XHRASU5vdGVib29rU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9ub3RlYm9va1NlcnZpY2U6IElOb3RlYm9va1NlcnZpY2UsXG5cdFx0QElOb3RlYm9va0tlcm5lbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tLZXJuZWxTZXJ2aWNlOiBJTm90ZWJvb2tLZXJuZWxTZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tFeGVjdXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rRXhlY3V0aW9uU2VydmljZTogSU5vdGVib29rRXhlY3V0aW9uU2VydmljZSxcblx0XHRASU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlOiBJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoYE5vdGVib29rRXhlY3V0aW9uI2N0b3IgJHtub3RlYm9vay50b1N0cmluZygpfWApO1xuXG5cdFx0Y29uc3Qgbm90ZWJvb2tNb2RlbCA9IHRoaXMuX25vdGVib29rU2VydmljZS5nZXROb3RlYm9va1RleHRNb2RlbChub3RlYm9vayk7XG5cdFx0aWYgKCFub3RlYm9va01vZGVsKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ05vdGVib29rIG5vdCBmb3VuZDogJyArIG5vdGVib29rKTtcblx0XHR9XG5cblx0XHR0aGlzLl9ub3RlYm9va01vZGVsID0gbm90ZWJvb2tNb2RlbDtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9ub3RlYm9va01vZGVsLm9uV2lsbEFkZFJlbW92ZUNlbGxzKGUgPT4gdGhpcy5vbldpbGxBZGRSZW1vdmVDZWxscyhlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX25vdGVib29rTW9kZWwub25XaWxsRGlzcG9zZSgoKSA9PiB0aGlzLm9uV2lsbERpc3Bvc2VEb2N1bWVudCgpKSk7XG5cdH1cblxuXHRwcml2YXRlIGNhbmNlbEFsbCgpOiB2b2lkIHtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLmRlYnVnKGBOb3RlYm9va0V4ZWN1dGlvbkxpc3RlbmVycyNjYW5jZWxBbGxgKTtcblx0XHRjb25zdCBleGVzID0gdGhpcy5fbm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UuZ2V0Q2VsbEV4ZWN1dGlvbnNGb3JOb3RlYm9vayh0aGlzLl9ub3RlYm9va01vZGVsLnVyaSk7XG5cdFx0dGhpcy5fbm90ZWJvb2tFeGVjdXRpb25TZXJ2aWNlLmNhbmNlbE5vdGVib29rQ2VsbEhhbmRsZXModGhpcy5fbm90ZWJvb2tNb2RlbCwgZXhlcy5tYXAoZXhlID0+IGV4ZS5jZWxsSGFuZGxlKSk7XG5cdH1cblxuXHRwcml2YXRlIG9uV2lsbERpc3Bvc2VEb2N1bWVudCgpOiB2b2lkIHtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLmRlYnVnKGBOb3RlYm9va0V4ZWN1dGlvbiNvbldpbGxEaXNwb3NlRG9jdW1lbnRgKTtcblx0XHR0aGlzLmNhbmNlbEFsbCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbldpbGxBZGRSZW1vdmVDZWxscyhlOiBOb3RlYm9va1RleHRNb2RlbFdpbGxBZGRSZW1vdmVFdmVudCk6IHZvaWQge1xuXHRcdGNvbnN0IG5vdGVib29rRXhlcyA9IHRoaXMuX25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmdldENlbGxFeGVjdXRpb25zQnlIYW5kbGVGb3JOb3RlYm9vayh0aGlzLl9ub3RlYm9va01vZGVsLnVyaSk7XG5cblx0XHRjb25zdCBleGVjdXRpbmdEZWxldGVkSGFuZGxlcyA9IG5ldyBTZXQ8bnVtYmVyPigpO1xuXHRcdGNvbnN0IHBlbmRpbmdEZWxldGVkSGFuZGxlcyA9IG5ldyBTZXQ8bnVtYmVyPigpO1xuXHRcdGlmIChub3RlYm9va0V4ZXMpIHtcblx0XHRcdGUucmF3RXZlbnQuY2hhbmdlcy5mb3JFYWNoKChbc3RhcnQsIGRlbGV0ZUNvdW50XSkgPT4ge1xuXHRcdFx0XHRpZiAoZGVsZXRlQ291bnQpIHtcblx0XHRcdFx0XHRjb25zdCBkZWxldGVkSGFuZGxlcyA9IHRoaXMuX25vdGVib29rTW9kZWwuY2VsbHMuc2xpY2Uoc3RhcnQsIHN0YXJ0ICsgZGVsZXRlQ291bnQpLm1hcChjID0+IGMuaGFuZGxlKTtcblx0XHRcdFx0XHRkZWxldGVkSGFuZGxlcy5mb3JFYWNoKGggPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgZXhlID0gbm90ZWJvb2tFeGVzLmdldChoKTtcblx0XHRcdFx0XHRcdGlmIChleGU/LnN0YXRlID09PSBOb3RlYm9va0NlbGxFeGVjdXRpb25TdGF0ZS5FeGVjdXRpbmcpIHtcblx0XHRcdFx0XHRcdFx0ZXhlY3V0aW5nRGVsZXRlZEhhbmRsZXMuYWRkKGgpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChleGUpIHtcblx0XHRcdFx0XHRcdFx0cGVuZGluZ0RlbGV0ZWRIYW5kbGVzLmFkZChoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0aWYgKGV4ZWN1dGluZ0RlbGV0ZWRIYW5kbGVzLnNpemUgfHwgcGVuZGluZ0RlbGV0ZWRIYW5kbGVzLnNpemUpIHtcblx0XHRcdGNvbnN0IGtlcm5lbCA9IHRoaXMuX25vdGVib29rS2VybmVsU2VydmljZS5nZXRTZWxlY3RlZE9yU3VnZ2VzdGVkS2VybmVsKHRoaXMuX25vdGVib29rTW9kZWwpO1xuXHRcdFx0aWYgKGtlcm5lbCkge1xuXHRcdFx0XHRjb25zdCBpbXBsZW1lbnRzSW50ZXJydXB0ID0ga2VybmVsLmltcGxlbWVudHNJbnRlcnJ1cHQ7XG5cdFx0XHRcdGNvbnN0IGhhbmRsZXNUb0NhbmNlbCA9IGltcGxlbWVudHNJbnRlcnJ1cHQgPyBbLi4uZXhlY3V0aW5nRGVsZXRlZEhhbmRsZXNdIDogWy4uLmV4ZWN1dGluZ0RlbGV0ZWRIYW5kbGVzLCAuLi5wZW5kaW5nRGVsZXRlZEhhbmRsZXNdO1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmRlYnVnKGBOb3RlYm9va0V4ZWN1dGlvbiNvbldpbGxBZGRSZW1vdmVDZWxscywgJHtKU09OLnN0cmluZ2lmeShbLi4uaGFuZGxlc1RvQ2FuY2VsXSl9YCk7XG5cdFx0XHRcdGlmIChoYW5kbGVzVG9DYW5jZWwubGVuZ3RoKSB7XG5cdFx0XHRcdFx0a2VybmVsLmNhbmNlbE5vdGVib29rQ2VsbEV4ZWN1dGlvbih0aGlzLl9ub3RlYm9va01vZGVsLnVyaSwgaGFuZGxlc1RvQ2FuY2VsKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5mdW5jdGlvbiB1cGRhdGVUb0VkaXQodXBkYXRlOiBJQ2VsbEV4ZWN1dGVVcGRhdGUsIGNlbGxIYW5kbGU6IG51bWJlcik6IElDZWxsRWRpdE9wZXJhdGlvbiB7XG5cdGlmICh1cGRhdGUuZWRpdFR5cGUgPT09IENlbGxFeGVjdXRpb25VcGRhdGVUeXBlLk91dHB1dCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLk91dHB1dCxcblx0XHRcdGhhbmRsZTogdXBkYXRlLmNlbGxIYW5kbGUsXG5cdFx0XHRhcHBlbmQ6IHVwZGF0ZS5hcHBlbmQsXG5cdFx0XHRvdXRwdXRzOiB1cGRhdGUub3V0cHV0cyxcblx0XHR9O1xuXHR9IGVsc2UgaWYgKHVwZGF0ZS5lZGl0VHlwZSA9PT0gQ2VsbEV4ZWN1dGlvblVwZGF0ZVR5cGUuT3V0cHV0SXRlbXMpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5PdXRwdXRJdGVtcyxcblx0XHRcdGl0ZW1zOiB1cGRhdGUuaXRlbXMsXG5cdFx0XHRhcHBlbmQ6IHVwZGF0ZS5hcHBlbmQsXG5cdFx0XHRvdXRwdXRJZDogdXBkYXRlLm91dHB1dElkXG5cdFx0fTtcblx0fSBlbHNlIGlmICh1cGRhdGUuZWRpdFR5cGUgPT09IENlbGxFeGVjdXRpb25VcGRhdGVUeXBlLkV4ZWN1dGlvblN0YXRlKSB7XG5cdFx0Y29uc3QgbmV3SW50ZXJuYWxNZXRhZGF0YTogUGFydGlhbDxOb3RlYm9va0NlbGxJbnRlcm5hbE1ldGFkYXRhPiA9IHt9O1xuXHRcdGlmICh0eXBlb2YgdXBkYXRlLmV4ZWN1dGlvbk9yZGVyICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0bmV3SW50ZXJuYWxNZXRhZGF0YS5leGVjdXRpb25PcmRlciA9IHVwZGF0ZS5leGVjdXRpb25PcmRlcjtcblx0XHR9XG5cdFx0aWYgKHR5cGVvZiB1cGRhdGUucnVuU3RhcnRUaW1lICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0bmV3SW50ZXJuYWxNZXRhZGF0YS5ydW5TdGFydFRpbWUgPSB1cGRhdGUucnVuU3RhcnRUaW1lO1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5QYXJ0aWFsSW50ZXJuYWxNZXRhZGF0YSxcblx0XHRcdGhhbmRsZTogY2VsbEhhbmRsZSxcblx0XHRcdGludGVybmFsTWV0YWRhdGE6IG5ld0ludGVybmFsTWV0YWRhdGFcblx0XHR9O1xuXHR9XG5cblx0dGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGNlbGwgdXBkYXRlIHR5cGUnKTtcbn1cblxuY2xhc3MgQ2VsbEV4ZWN1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJTm90ZWJvb2tDZWxsRXhlY3V0aW9uIHtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRVcGRhdGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRVcGRhdGUgPSB0aGlzLl9vbkRpZFVwZGF0ZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENvbXBsZXRlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8Ym9vbGVhbiB8IHVuZGVmaW5lZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ29tcGxldGUgPSB0aGlzLl9vbkRpZENvbXBsZXRlLmV2ZW50O1xuXG5cdHByaXZhdGUgX3N0YXRlOiBOb3RlYm9va0NlbGxFeGVjdXRpb25TdGF0ZSA9IE5vdGVib29rQ2VsbEV4ZWN1dGlvblN0YXRlLlVuY29uZmlybWVkO1xuXHRnZXQgc3RhdGUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0YXRlO1xuXHR9XG5cblx0Z2V0IG5vdGVib29rKCk6IFVSSSB7XG5cdFx0cmV0dXJuIHRoaXMuX25vdGVib29rTW9kZWwudXJpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZGlkUGF1c2UgPSBmYWxzZTtcblx0Z2V0IGRpZFBhdXNlKCkge1xuXHRcdHJldHVybiB0aGlzLl9kaWRQYXVzZTtcblx0fVxuXG5cdHByaXZhdGUgX2lzUGF1c2VkID0gZmFsc2U7XG5cdGdldCBpc1BhdXNlZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5faXNQYXVzZWQ7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBjZWxsSGFuZGxlOiBudW1iZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tNb2RlbDogTm90ZWJvb2tUZXh0TW9kZWwsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoYENlbGxFeGVjdXRpb24jY3RvciAke3RoaXMuZ2V0Q2VsbExvZygpfWApO1xuXHR9XG5cblx0aW5pdGlhbGl6ZSgpIHtcblx0XHRjb25zdCBzdGFydEV4ZWN1dGVFZGl0OiBJQ2VsbEVkaXRPcGVyYXRpb24gPSB7XG5cdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlBhcnRpYWxJbnRlcm5hbE1ldGFkYXRhLFxuXHRcdFx0aGFuZGxlOiB0aGlzLmNlbGxIYW5kbGUsXG5cdFx0XHRpbnRlcm5hbE1ldGFkYXRhOiB7XG5cdFx0XHRcdGV4ZWN1dGlvbklkOiBnZW5lcmF0ZVV1aWQoKSxcblx0XHRcdFx0cnVuU3RhcnRUaW1lOiBudWxsLFxuXHRcdFx0XHRydW5FbmRUaW1lOiBudWxsLFxuXHRcdFx0XHRsYXN0UnVuU3VjY2VzczogbnVsbCxcblx0XHRcdFx0ZXhlY3V0aW9uT3JkZXI6IG51bGwsXG5cdFx0XHRcdHJlbmRlckR1cmF0aW9uOiBudWxsLFxuXHRcdFx0fVxuXHRcdH07XG5cdFx0dGhpcy5fYXBwbHlFeGVjdXRpb25FZGl0cyhbc3RhcnRFeGVjdXRlRWRpdF0pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRDZWxsTG9nKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGAke3RoaXMuX25vdGVib29rTW9kZWwudXJpLnRvU3RyaW5nKCl9LCAke3RoaXMuY2VsbEhhbmRsZX1gO1xuXHR9XG5cblx0cHJpdmF0ZSBsb2dVcGRhdGVzKHVwZGF0ZXM6IElDZWxsRXhlY3V0ZVVwZGF0ZVtdKTogdm9pZCB7XG5cdFx0Y29uc3QgdXBkYXRlVHlwZXMgPSB1cGRhdGVzLm1hcCh1ID0+IENlbGxFeGVjdXRpb25VcGRhdGVUeXBlW3UuZWRpdFR5cGVdKS5qb2luKCcsICcpO1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoYENlbGxFeGVjdXRpb24jdXBkYXRlRXhlY3V0aW9uICR7dGhpcy5nZXRDZWxsTG9nKCl9LCBbJHt1cGRhdGVUeXBlc31dYCk7XG5cdH1cblxuXHRjb25maXJtKCkge1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoYENlbGxFeGVjdXRpb24jY29uZmlybSAke3RoaXMuZ2V0Q2VsbExvZygpfWApO1xuXHRcdHRoaXMuX3N0YXRlID0gTm90ZWJvb2tDZWxsRXhlY3V0aW9uU3RhdGUuUGVuZGluZztcblx0XHR0aGlzLl9vbkRpZFVwZGF0ZS5maXJlKCk7XG5cdH1cblxuXHR1cGRhdGUodXBkYXRlczogSUNlbGxFeGVjdXRlVXBkYXRlW10pOiB2b2lkIHtcblx0XHR0aGlzLmxvZ1VwZGF0ZXModXBkYXRlcyk7XG5cdFx0aWYgKHVwZGF0ZXMuc29tZSh1ID0+IHUuZWRpdFR5cGUgPT09IENlbGxFeGVjdXRpb25VcGRhdGVUeXBlLkV4ZWN1dGlvblN0YXRlKSkge1xuXHRcdFx0dGhpcy5fc3RhdGUgPSBOb3RlYm9va0NlbGxFeGVjdXRpb25TdGF0ZS5FeGVjdXRpbmc7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl9kaWRQYXVzZSAmJiB1cGRhdGVzLnNvbWUodSA9PiB1LmVkaXRUeXBlID09PSBDZWxsRXhlY3V0aW9uVXBkYXRlVHlwZS5FeGVjdXRpb25TdGF0ZSAmJiB1LmRpZFBhdXNlKSkge1xuXHRcdFx0dGhpcy5fZGlkUGF1c2UgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxhc3RJc1BhdXNlZFVwZGF0ZSA9IFsuLi51cGRhdGVzXS5yZXZlcnNlKCkuZmluZCh1ID0+IHUuZWRpdFR5cGUgPT09IENlbGxFeGVjdXRpb25VcGRhdGVUeXBlLkV4ZWN1dGlvblN0YXRlICYmIHR5cGVvZiB1LmlzUGF1c2VkID09PSAnYm9vbGVhbicpO1xuXHRcdGlmIChsYXN0SXNQYXVzZWRVcGRhdGUpIHtcblx0XHRcdHRoaXMuX2lzUGF1c2VkID0gKGxhc3RJc1BhdXNlZFVwZGF0ZSBhcyBJQ2VsbEV4ZWN1dGlvblN0YXRlVXBkYXRlKS5pc1BhdXNlZCE7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2VsbE1vZGVsID0gdGhpcy5fbm90ZWJvb2tNb2RlbC5jZWxscy5maW5kKGMgPT4gYy5oYW5kbGUgPT09IHRoaXMuY2VsbEhhbmRsZSk7XG5cdFx0aWYgKCFjZWxsTW9kZWwpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoYENlbGxFeGVjdXRpb24jdXBkYXRlLCB1cGRhdGluZyBjZWxsIG5vdCBpbiBub3RlYm9vazogJHt0aGlzLl9ub3RlYm9va01vZGVsLnVyaS50b1N0cmluZygpfSwgJHt0aGlzLmNlbGxIYW5kbGV9YCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGVkaXRzID0gdXBkYXRlcy5tYXAodXBkYXRlID0+IHVwZGF0ZVRvRWRpdCh1cGRhdGUsIHRoaXMuY2VsbEhhbmRsZSkpO1xuXHRcdFx0dGhpcy5fYXBwbHlFeGVjdXRpb25FZGl0cyhlZGl0cyk7XG5cdFx0fVxuXG5cdFx0aWYgKHVwZGF0ZXMuc29tZSh1ID0+IHUuZWRpdFR5cGUgPT09IENlbGxFeGVjdXRpb25VcGRhdGVUeXBlLkV4ZWN1dGlvblN0YXRlKSkge1xuXHRcdFx0dGhpcy5fb25EaWRVcGRhdGUuZmlyZSgpO1xuXHRcdH1cblx0fVxuXG5cdGNvbXBsZXRlKGNvbXBsZXRpb25EYXRhOiBJQ2VsbEV4ZWN1dGlvbkNvbXBsZXRlKTogdm9pZCB7XG5cdFx0Y29uc3QgY2VsbE1vZGVsID0gdGhpcy5fbm90ZWJvb2tNb2RlbC5jZWxscy5maW5kKGMgPT4gYy5oYW5kbGUgPT09IHRoaXMuY2VsbEhhbmRsZSk7XG5cdFx0aWYgKCFjZWxsTW9kZWwpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoYENlbGxFeGVjdXRpb24jY29tcGxldGUsIGNvbXBsZXRpbmcgY2VsbCBub3QgaW4gbm90ZWJvb2s6ICR7dGhpcy5fbm90ZWJvb2tNb2RlbC51cmkudG9TdHJpbmcoKX0sICR7dGhpcy5jZWxsSGFuZGxlfWApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBlZGl0OiBJQ2VsbEVkaXRPcGVyYXRpb24gPSB7XG5cdFx0XHRcdGVkaXRUeXBlOiBDZWxsRWRpdFR5cGUuUGFydGlhbEludGVybmFsTWV0YWRhdGEsXG5cdFx0XHRcdGhhbmRsZTogdGhpcy5jZWxsSGFuZGxlLFxuXHRcdFx0XHRpbnRlcm5hbE1ldGFkYXRhOiB7XG5cdFx0XHRcdFx0bGFzdFJ1blN1Y2Nlc3M6IGNvbXBsZXRpb25EYXRhLmxhc3RSdW5TdWNjZXNzLFxuXHRcdFx0XHRcdHJ1blN0YXJ0VGltZTogdGhpcy5fZGlkUGF1c2UgPyBudWxsIDogY2VsbE1vZGVsLmludGVybmFsTWV0YWRhdGEucnVuU3RhcnRUaW1lLFxuXHRcdFx0XHRcdHJ1bkVuZFRpbWU6IHRoaXMuX2RpZFBhdXNlID8gbnVsbCA6IGNvbXBsZXRpb25EYXRhLnJ1bkVuZFRpbWUsXG5cdFx0XHRcdFx0ZXJyb3I6IGNvbXBsZXRpb25EYXRhLmVycm9yXG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHR0aGlzLl9hcHBseUV4ZWN1dGlvbkVkaXRzKFtlZGl0XSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25EaWRDb21wbGV0ZS5maXJlKGNvbXBsZXRpb25EYXRhLmxhc3RSdW5TdWNjZXNzKTtcblx0fVxuXG5cdHByaXZhdGUgX2FwcGx5RXhlY3V0aW9uRWRpdHMoZWRpdHM6IElDZWxsRWRpdE9wZXJhdGlvbltdKTogdm9pZCB7XG5cdFx0dGhpcy5fbm90ZWJvb2tNb2RlbC5hcHBseUVkaXRzKGVkaXRzLCB0cnVlLCB1bmRlZmluZWQsICgpID0+IHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cdH1cbn1cblxuY2xhc3MgTm90ZWJvb2tFeGVjdXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSU5vdGVib29rRXhlY3V0aW9uIHtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRVcGRhdGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRVcGRhdGUgPSB0aGlzLl9vbkRpZFVwZGF0ZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENvbXBsZXRlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ29tcGxldGUgPSB0aGlzLl9vbkRpZENvbXBsZXRlLmV2ZW50O1xuXG5cdHByaXZhdGUgX3N0YXRlOiBOb3RlYm9va0V4ZWN1dGlvblN0YXRlID0gTm90ZWJvb2tFeGVjdXRpb25TdGF0ZS5VbmNvbmZpcm1lZDtcblx0Z2V0IHN0YXRlKCkge1xuXHRcdHJldHVybiB0aGlzLl9zdGF0ZTtcblx0fVxuXG5cdGdldCBub3RlYm9vaygpOiBVUkkge1xuXHRcdHJldHVybiB0aGlzLl9ub3RlYm9va01vZGVsLnVyaTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rTW9kZWw6IE5vdGVib29rVGV4dE1vZGVsLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLmRlYnVnKGBOb3RlYm9va0V4ZWN1dGlvbiNjdG9yYCk7XG5cdH1cblx0cHJpdmF0ZSBkZWJ1ZyhtZXNzYWdlOiBzdHJpbmcpIHtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLmRlYnVnKGAke21lc3NhZ2V9ICR7dGhpcy5fbm90ZWJvb2tNb2RlbC51cmkudG9TdHJpbmcoKX1gKTtcblx0fVxuXG5cdGNvbmZpcm0oKSB7XG5cdFx0dGhpcy5kZWJ1ZyhgRXhlY3V0aW9uI2NvbmZpcm1gKTtcblx0XHR0aGlzLl9zdGF0ZSA9IE5vdGVib29rRXhlY3V0aW9uU3RhdGUuUGVuZGluZztcblx0XHR0aGlzLl9vbkRpZFVwZGF0ZS5maXJlKCk7XG5cdH1cblxuXHRiZWdpbigpOiB2b2lkIHtcblx0XHR0aGlzLmRlYnVnKGBFeGVjdXRpb24jYmVnaW5gKTtcblx0XHR0aGlzLl9zdGF0ZSA9IE5vdGVib29rRXhlY3V0aW9uU3RhdGUuRXhlY3V0aW5nO1xuXHRcdHRoaXMuX29uRGlkVXBkYXRlLmZpcmUoKTtcblx0fVxuXG5cdGNvbXBsZXRlKCk6IHZvaWQge1xuXHRcdHRoaXMuZGVidWcoYEV4ZWN1dGlvbiNiZWdpbmApO1xuXHRcdHRoaXMuX3N0YXRlID0gTm90ZWJvb2tFeGVjdXRpb25TdGF0ZS5VbmNvbmZpcm1lZDtcblx0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
