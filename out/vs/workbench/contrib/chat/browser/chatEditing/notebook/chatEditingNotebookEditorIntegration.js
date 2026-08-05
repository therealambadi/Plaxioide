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
import { Disposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { autorun, observableFromEvent, observableValue } from "../../../../../../base/common/observable.js";
import { debouncedObservable } from "../../../../../../base/common/observableInternal/utils.js";
import { basename } from "../../../../../../base/common/resources.js";
import { assertType } from "../../../../../../base/common/types.js";
import { LineRange } from "../../../../../../editor/common/core/lineRange.js";
import { Range } from "../../../../../../editor/common/core/range.js";
import { nullDocumentDiff } from "../../../../../../editor/common/diff/documentDiffProvider.js";
import { localize } from "../../../../../../nls.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { MenuId } from "../../../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { NotebookDeletedCellDecorator } from "../../../../notebook/browser/diff/inlineDiff/notebookDeletedCellDecorator.js";
import { NotebookInsertedCellDecorator } from "../../../../notebook/browser/diff/inlineDiff/notebookInsertedCellDecorator.js";
import { NotebookModifiedCellDecorator } from "../../../../notebook/browser/diff/inlineDiff/notebookModifiedCellDecorator.js";
import { getNotebookEditorFromEditorPane } from "../../../../notebook/browser/notebookBrowser.js";
import { INotebookEditorService } from "../../../../notebook/browser/services/notebookEditorService.js";
import { CellKind } from "../../../../notebook/common/notebookCommon.js";
import { IChatAgentService } from "../../../common/chatAgents.js";
import { ChatAgentLocation } from "../../../common/constants.js";
import { ChatEditingCodeEditorIntegration } from "../chatEditingCodeEditorIntegration.js";
import { countChanges, sortCellChanges } from "./notebookCellChanges.js";
let ChatEditingNotebookEditorIntegration = class extends Disposable {
  constructor(_entry, editor, notebookModel, originalModel, cellChanges, instantiationService) {
    super();
    this.instantiationService = instantiationService;
    const notebookEditor = getNotebookEditorFromEditorPane(editor);
    assertType(notebookEditor);
    this.notebookEditor = notebookEditor;
    this.integration = this.instantiationService.createInstance(ChatEditingNotebookEditorWidgetIntegration, _entry, notebookEditor, notebookModel, originalModel, cellChanges);
    this._register(editor.onDidChangeControl(() => {
      const notebookEditor2 = getNotebookEditorFromEditorPane(editor);
      if (notebookEditor2 && notebookEditor2 !== this.notebookEditor) {
        this.notebookEditor = notebookEditor2;
        this.integration.dispose();
        this.integration = this.instantiationService.createInstance(ChatEditingNotebookEditorWidgetIntegration, _entry, notebookEditor2, notebookModel, originalModel, cellChanges);
      }
    }));
  }
  get currentIndex() {
    return this.integration.currentIndex;
  }
  reveal(firstOrLast) {
    return this.integration.reveal(firstOrLast);
  }
  next(wrap) {
    return this.integration.next(wrap);
  }
  previous(wrap) {
    return this.integration.previous(wrap);
  }
  enableAccessibleDiffView() {
    this.integration.enableAccessibleDiffView();
  }
  acceptNearestChange(change) {
    this.integration.acceptNearestChange(change);
  }
  rejectNearestChange(change) {
    this.integration.rejectNearestChange(change);
  }
  toggleDiff(change) {
    return this.integration.toggleDiff(change);
  }
  dispose() {
    this.integration.dispose();
    super.dispose();
  }
};
ChatEditingNotebookEditorIntegration = __decorateClass([
  __decorateParam(5, IInstantiationService)
], ChatEditingNotebookEditorIntegration);
let ChatEditingNotebookEditorWidgetIntegration = class extends Disposable {
  constructor(_entry, notebookEditor, notebookModel, originalModel, cellChanges, instantiationService, _editorService, _chatAgentService, notebookEditorService, accessibilitySignalService) {
    super();
    this._entry = _entry;
    this.notebookEditor = notebookEditor;
    this.notebookModel = notebookModel;
    this.cellChanges = cellChanges;
    this.instantiationService = instantiationService;
    this._editorService = _editorService;
    this._chatAgentService = _chatAgentService;
    this.accessibilitySignalService = accessibilitySignalService;
    this._currentIndex = observableValue(this, -1);
    this.currentIndex = this._currentIndex;
    this._currentChange = observableValue(this, void 0);
    this.currentChange = this._currentChange;
    this.cellEditorIntegrations = /* @__PURE__ */ new Map();
    this.mdCellEditorAttached = observableValue(this, -1);
    this.markupCellListeners = /* @__PURE__ */ new Map();
    const onDidChangeVisibleRanges = debouncedObservable(observableFromEvent(notebookEditor.onDidChangeVisibleRanges, () => notebookEditor.visibleRanges), 50);
    this._register(toDisposable(() => {
      this.markupCellListeners.forEach((v) => v.dispose());
    }));
    let originalReadonly = void 0;
    const shouldBeReadonly = _entry.isCurrentlyBeingModifiedBy.map((value) => !!value);
    this._register(autorun((r) => {
      const isReadOnly = shouldBeReadonly.read(r);
      const notebookEditor2 = notebookEditorService.retrieveExistingWidgetFromURI(_entry.modifiedURI)?.value;
      if (!notebookEditor2) {
        return;
      }
      originalReadonly ??= notebookEditor2.isReadOnly;
      if (isReadOnly) {
        notebookEditor2.setOptions({ isReadOnly: true });
      } else if (originalReadonly === false) {
        notebookEditor2.setOptions({ isReadOnly: false });
        const timeout = setTimeout(() => {
          notebookEditor2.setOptions({ isReadOnly: true });
          notebookEditor2.setOptions({ isReadOnly: false });
          disposable.dispose();
        }, 100);
        const disposable = toDisposable(() => clearTimeout(timeout));
        this._register(disposable);
      }
    }));
    let lastModifyingRequestId;
    this._store.add(autorun((r) => {
      if (!_entry.isCurrentlyBeingModifiedBy.read(r) && !_entry.isProcessingResponse.read(r) && lastModifyingRequestId !== _entry.lastModifyingRequestId && cellChanges.read(r).some((c) => c.type !== "unchanged" && !c.diff.read(r).identical)) {
        lastModifyingRequestId = _entry.lastModifyingRequestId;
        this.reveal(true);
      }
    }));
    this._register(autorun((r) => {
      if (this.notebookEditor.textModel !== this.notebookModel) {
        return;
      }
      const sortedCellChanges = sortCellChanges(cellChanges.read(r));
      const changes = sortedCellChanges.filter((c) => c.type !== "delete");
      onDidChangeVisibleRanges.read(r);
      if (!changes.length) {
        this.cellEditorIntegrations.forEach(({ diff }) => {
          diff.set({ ...diff.get(), ...nullDocumentDiff }, void 0);
        });
        return;
      }
      this.mdCellEditorAttached.read(r);
      const validCells = /* @__PURE__ */ new Set();
      changes.forEach((change) => {
        if (change.modifiedCellIndex === void 0 || change.modifiedCellIndex >= notebookModel.cells.length) {
          return;
        }
        const cell = notebookModel.cells[change.modifiedCellIndex];
        const editor = notebookEditor.codeEditors.find(([vm]) => vm.handle === notebookModel.cells[change.modifiedCellIndex].handle)?.[1];
        const modifiedModel = change.modifiedModel.promiseResult.read(r)?.data;
        const originalModel2 = change.originalModel.promiseResult.read(r)?.data;
        if (!cell || !originalModel2 || !modifiedModel) {
          return;
        }
        if (!editor) {
          if (!this.markupCellListeners.has(cell.handle) && cell.cellKind === CellKind.Markup) {
            const cellModel = this.notebookEditor.getViewModel()?.viewCells.find((c) => c.handle === cell.handle);
            if (cellModel) {
              const listener = cellModel.onDidChangeEditorAttachState(() => {
                if (cellModel.editorAttached) {
                  this.mdCellEditorAttached.set(cell.handle, void 0);
                  listener.dispose();
                  this.markupCellListeners.delete(cell.handle);
                }
              });
              this.markupCellListeners.set(cell.handle, listener);
            }
          }
          return;
        }
        const diff = {
          ...change.diff.read(r),
          modifiedModel,
          originalModel: originalModel2,
          keep: change.keep,
          undo: change.undo
        };
        validCells.add(cell);
        const currentDiff = this.cellEditorIntegrations.get(cell);
        if (currentDiff) {
          if (!areDocumentDiff2Equal(currentDiff.diff.get(), diff)) {
            currentDiff.diff.set(diff, void 0);
          }
        } else {
          const diff2 = observableValue(`diff${cell.handle}`, diff);
          const integration = this.instantiationService.createInstance(ChatEditingCodeEditorIntegration, _entry, editor, diff2);
          this.cellEditorIntegrations.set(cell, { integration, diff: diff2 });
          this._register(integration);
          this._register(editor.onDidDispose(() => {
            this.cellEditorIntegrations.get(cell)?.integration.dispose();
            this.cellEditorIntegrations.delete(cell);
          }));
          this._register(editor.onDidChangeModel(() => {
            if (editor.getModel() !== cell.textModel) {
              this.cellEditorIntegrations.get(cell)?.integration.dispose();
              this.cellEditorIntegrations.delete(cell);
            }
          }));
        }
      });
      this.cellEditorIntegrations.forEach((v, cell) => {
        if (!validCells.has(cell)) {
          v.integration.dispose();
          this.cellEditorIntegrations.delete(cell);
        }
      });
    }));
    this._register(autorun((r) => {
      const currentChange = this.currentChange.read(r);
      if (!currentChange) {
        this._currentIndex.set(-1, void 0);
        return;
      }
      let index = 0;
      const sortedCellChanges = sortCellChanges(cellChanges.read(r));
      for (const change of sortedCellChanges) {
        if (currentChange && currentChange.change === change) {
          if (change.type === "modified") {
            index += currentChange.index;
          }
          break;
        }
        if (change.type === "insert" || change.type === "delete") {
          index++;
        } else if (change.type === "modified") {
          index += change.diff.read(r).changes.length;
        }
      }
      this._currentIndex.set(index, void 0);
    }));
    const cellsAreVisible = onDidChangeVisibleRanges.map((v) => v.length > 0);
    const debouncedChanges = debouncedObservable(cellChanges, 10);
    this._register(autorun((r) => {
      if (this.notebookEditor.textModel !== this.notebookModel || !cellsAreVisible.read(r) || !this.notebookEditor.getViewModel()) {
        return;
      }
      const changes = debouncedChanges.read(r).filter((c) => c.type === "insert" ? !c.diff.read(r).identical : true);
      const modifiedChanges = changes.filter((c) => c.type === "modified");
      this.createDecorators();
      this.insertedCellDecorator?.apply(changes);
      this.modifiedCellDecorator?.apply(modifiedChanges);
      this.deletedCellDecorator?.apply(changes, originalModel);
    }));
  }
  createDecorators() {
    const cellChanges = this.cellChanges.get();
    const accessibilitySignalService = this.accessibilitySignalService;
    this.insertedCellDecorator ??= this._register(this.instantiationService.createInstance(NotebookInsertedCellDecorator, this.notebookEditor));
    this.modifiedCellDecorator ??= this._register(this.instantiationService.createInstance(NotebookModifiedCellDecorator, this.notebookEditor));
    if (this.deletedCellDecorator) {
      this._store.delete(this.deletedCellDecorator);
      this.deletedCellDecorator.dispose();
    }
    this.deletedCellDecorator = this._register(this.instantiationService.createInstance(NotebookDeletedCellDecorator, this.notebookEditor, {
      className: "chat-diff-change-content-widget",
      telemetrySource: "chatEditingNotebookHunk",
      menuId: MenuId.ChatEditingEditorHunk,
      argFactory: (deletedCellIndex) => {
        return {
          accept() {
            const entry = cellChanges.find((c) => c.type === "delete" && c.originalCellIndex === deletedCellIndex);
            if (entry) {
              return entry.keep(entry.diff.get().changes[0]);
            }
            accessibilitySignalService.playSignal(AccessibilitySignal.editsKept, { allowManyInParallel: true });
            return Promise.resolve(true);
          },
          reject() {
            const entry = cellChanges.find((c) => c.type === "delete" && c.originalCellIndex === deletedCellIndex);
            if (entry) {
              return entry.undo(entry.diff.get().changes[0]);
            }
            accessibilitySignalService.playSignal(AccessibilitySignal.editsUndone, { allowManyInParallel: true });
            return Promise.resolve(true);
          }
        };
      }
    }));
  }
  getCell(modifiedCellIndex) {
    const cell = this.notebookModel.cells[modifiedCellIndex];
    const integration = this.cellEditorIntegrations.get(cell)?.integration;
    return integration;
  }
  reveal(firstOrLast) {
    const changes = sortCellChanges(this.cellChanges.get().filter((c) => c.type !== "unchanged"));
    if (!changes.length) {
      return void 0;
    }
    const change = firstOrLast ? changes[0] : changes[changes.length - 1];
    this._revealFirstOrLast(change, firstOrLast);
  }
  _revealFirstOrLast(change, firstOrLast = true) {
    switch (change.type) {
      case "insert":
      case "modified": {
        const index = firstOrLast || change.type === "insert" ? 0 : change.diff.get().changes.length - 1;
        const cellIntegration = this.getCell(change.modifiedCellIndex);
        if (cellIntegration) {
          cellIntegration.reveal(firstOrLast);
          this._currentChange.set({ change, index }, void 0);
          return true;
        } else {
          return this._revealChange(change, index);
        }
      }
      case "delete":
        this.deletedCellDecorator?.reveal(change.originalCellIndex);
        this._currentChange.set({ change, index: 0 }, void 0);
        return true;
      default:
        break;
    }
    return false;
  }
  _revealChange(change, indexInCell) {
    switch (change.type) {
      case "insert":
      case "modified": {
        const textChange = change.diff.get().changes[indexInCell];
        const cellViewModel = this.getCellViewModel(change);
        if (cellViewModel) {
          this.revealChangeInView(cellViewModel, textChange?.modified);
          this._currentChange.set({ change, index: indexInCell }, void 0);
        }
        return true;
      }
      case "delete":
        this.deletedCellDecorator?.reveal(change.originalCellIndex);
        this._currentChange.set({ change, index: 0 }, void 0);
        return true;
      default:
        break;
    }
    return false;
  }
  getCellViewModel(change) {
    if (change.type === "delete" || change.modifiedCellIndex === void 0) {
      return void 0;
    }
    const cell = this.notebookModel.cells[change.modifiedCellIndex];
    const cellViewModel = this.notebookEditor.getViewModel()?.viewCells.find((c) => c.handle === cell.handle);
    return cellViewModel;
  }
  async revealChangeInView(cell, lines) {
    const targetLines = lines ?? new LineRange(0, 0);
    await this.notebookEditor.focusNotebookCell(cell, "container", { focusEditorLine: targetLines.startLineNumber });
    await this.notebookEditor.revealRangeInCenterAsync(cell, new Range(targetLines.startLineNumber, 0, targetLines.endLineNumberExclusive, 0));
  }
  next(wrap) {
    const changes = sortCellChanges(this.cellChanges.get().filter((c) => c.type !== "unchanged"));
    const currentChange = this.currentChange.get();
    if (!currentChange) {
      const firstChange = changes[0];
      if (firstChange) {
        return this._revealFirstOrLast(firstChange);
      }
      return false;
    }
    switch (currentChange.change.type) {
      case "modified":
        {
          const cellIntegration = this.getCell(currentChange.change.modifiedCellIndex);
          if (cellIntegration) {
            if (cellIntegration.next(false)) {
              this._currentChange.set({ change: currentChange.change, index: cellIntegration.currentIndex.get() }, void 0);
              return true;
            }
          }
          const isLastChangeInCell = currentChange.index === lastChangeIndex(currentChange.change);
          const index = isLastChangeInCell ? 0 : currentChange.index + 1;
          const change = isLastChangeInCell ? changes[changes.indexOf(currentChange.change) + 1] : currentChange.change;
          if (change) {
            return this._revealChange(change, index);
          }
        }
        break;
      case "insert":
      case "delete":
        {
          const nextChange = changes[changes.indexOf(currentChange.change) + 1];
          if (nextChange) {
            return this._revealFirstOrLast(nextChange, true);
          }
        }
        break;
      default:
        break;
    }
    if (wrap) {
      return this.next(false);
    }
    return false;
  }
  previous(wrap) {
    const changes = sortCellChanges(this.cellChanges.get().filter((c) => c.type !== "unchanged"));
    const currentChange = this.currentChange.get();
    if (!currentChange) {
      const lastChange = changes[changes.length - 1];
      if (lastChange) {
        return this._revealFirstOrLast(lastChange, false);
      }
      return false;
    }
    switch (currentChange.change.type) {
      case "modified":
        {
          const cellIntegration = this.getCell(currentChange.change.modifiedCellIndex);
          if (cellIntegration) {
            if (cellIntegration.previous(false)) {
              this._currentChange.set({ change: currentChange.change, index: cellIntegration.currentIndex.get() }, void 0);
              return true;
            }
          }
          const isFirstChangeInCell = currentChange.index === 0;
          const change = isFirstChangeInCell ? changes[changes.indexOf(currentChange.change) - 1] : currentChange.change;
          if (change) {
            const index = isFirstChangeInCell ? lastChangeIndex(change) : currentChange.index - 1;
            return this._revealChange(change, index);
          }
        }
        break;
      case "insert":
      case "delete":
        {
          const prevChange = changes[changes.indexOf(currentChange.change) - 1];
          if (prevChange) {
            return this._revealFirstOrLast(prevChange, false);
          }
        }
        break;
      default:
        break;
    }
    if (wrap) {
      const lastChange = changes[changes.length - 1];
      if (lastChange) {
        return this._revealFirstOrLast(lastChange, false);
      }
    }
    return false;
  }
  enableAccessibleDiffView() {
    const cell = this.notebookEditor.getActiveCell()?.model;
    if (cell) {
      const integration = this.cellEditorIntegrations.get(cell)?.integration;
      integration?.enableAccessibleDiffView();
    }
  }
  acceptNearestChange(change) {
    change.accept();
    this.next(true);
  }
  rejectNearestChange(change) {
    change.reject();
    this.next(true);
  }
  async toggleDiff(_change) {
    const defaultAgentName = this._chatAgentService.getDefaultAgent(ChatAgentLocation.EditingSession)?.fullName;
    const diffInput = {
      original: { resource: this._entry.originalURI, options: { selection: void 0 } },
      modified: { resource: this._entry.modifiedURI, options: { selection: void 0 } },
      label: defaultAgentName ? localize("diff.agent", "{0} (changes from {1})", basename(this._entry.modifiedURI), defaultAgentName) : localize("diff.generic", "{0} (changes from chat)", basename(this._entry.modifiedURI))
    };
    await this._editorService.openEditor(diffInput);
  }
};
ChatEditingNotebookEditorWidgetIntegration = __decorateClass([
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IEditorService),
  __decorateParam(7, IChatAgentService),
  __decorateParam(8, INotebookEditorService),
  __decorateParam(9, IAccessibilitySignalService)
], ChatEditingNotebookEditorWidgetIntegration);
class ChatEditingNotebookDiffEditorIntegration extends Disposable {
  constructor(notebookDiffEditor, cellChanges) {
    super();
    this.notebookDiffEditor = notebookDiffEditor;
    this.cellChanges = cellChanges;
    this._currentIndex = observableValue(this, -1);
    this.currentIndex = this._currentIndex;
    this._store.add(autorun((r) => {
      const index = notebookDiffEditor.currentChangedIndex.read(r);
      const numberOfCellChanges = cellChanges.read(r).filter((c) => !c.diff.read(r).identical);
      if (numberOfCellChanges.length && index >= 0 && index < numberOfCellChanges.length) {
        const changesSoFar = countChanges(numberOfCellChanges.slice(0, index + 1));
        this._currentIndex.set(changesSoFar - 1, void 0);
      } else {
        this._currentIndex.set(-1, void 0);
      }
    }));
  }
  reveal(firstOrLast) {
    const changes = sortCellChanges(this.cellChanges.get().filter((c) => c.type !== "unchanged"));
    if (!changes.length) {
      return void 0;
    }
    if (firstOrLast) {
      this.notebookDiffEditor.firstChange();
    } else {
      this.notebookDiffEditor.lastChange();
    }
  }
  next(_wrap) {
    const changes = this.cellChanges.get().filter((c) => !c.diff.get().identical).length;
    if (this.notebookDiffEditor.currentChangedIndex.get() === changes - 1) {
      return false;
    }
    this.notebookDiffEditor.nextChange();
    return true;
  }
  previous(_wrap) {
    const changes = this.cellChanges.get().filter((c) => !c.diff.get().identical).length;
    if (this.notebookDiffEditor.currentChangedIndex.get() === changes - 1) {
      return false;
    }
    this.notebookDiffEditor.nextChange();
    return true;
  }
  enableAccessibleDiffView() {
  }
  acceptNearestChange(change) {
    change.accept();
    this.next(true);
  }
  rejectNearestChange(change) {
    change.reject();
    this.next(true);
  }
  async toggleDiff(_change) {
  }
}
function areDocumentDiff2Equal(diff1, diff2) {
  if (diff1.changes !== diff2.changes) {
    return false;
  }
  if (diff1.identical !== diff2.identical) {
    return false;
  }
  if (diff1.moves !== diff2.moves) {
    return false;
  }
  if (diff1.originalModel !== diff2.originalModel) {
    return false;
  }
  if (diff1.modifiedModel !== diff2.modifiedModel) {
    return false;
  }
  if (diff1.keep !== diff2.keep) {
    return false;
  }
  if (diff1.undo !== diff2.undo) {
    return false;
  }
  if (diff1.quitEarly !== diff2.quitEarly) {
    return false;
  }
  return true;
}
function lastChangeIndex(change) {
  if (change.type === "modified") {
    return change.diff.get().changes.length - 1;
  }
  return 0;
}
export {
  ChatEditingNotebookDiffEditorIntegration,
  ChatEditingNotebookEditorIntegration
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRpbmcvbm90ZWJvb2svY2hhdEVkaXRpbmdOb3RlYm9va0VkaXRvckludGVncmF0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBhdXRvcnVuLCBJT2JzZXJ2YWJsZSwgSVNldHRhYmxlT2JzZXJ2YWJsZSwgb2JzZXJ2YWJsZUZyb21FdmVudCwgb2JzZXJ2YWJsZVZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBkZWJvdW5jZWRPYnNlcnZhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZUludGVybmFsL3V0aWxzLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGFzc2VydFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBMaW5lUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvbGluZVJhbmdlLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IG51bGxEb2N1bWVudERpZmYgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2RpZmYvZG9jdW1lbnREaWZmUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eVNpZ25hbCwgSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eVNpZ25hbC9icm93c2VyL2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yUGFuZSwgSVJlc291cmNlRGlmZkVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0RlbGV0ZWRDZWxsRGVjb3JhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vbm90ZWJvb2svYnJvd3Nlci9kaWZmL2lubGluZURpZmYvbm90ZWJvb2tEZWxldGVkQ2VsbERlY29yYXRvci5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0luc2VydGVkQ2VsbERlY29yYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL25vdGVib29rL2Jyb3dzZXIvZGlmZi9pbmxpbmVEaWZmL25vdGVib29rSW5zZXJ0ZWRDZWxsRGVjb3JhdG9yLmpzJztcbmltcG9ydCB7IE5vdGVib29rTW9kaWZpZWRDZWxsRGVjb3JhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vbm90ZWJvb2svYnJvd3Nlci9kaWZmL2lubGluZURpZmYvbm90ZWJvb2tNb2RpZmllZENlbGxEZWNvcmF0b3IuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rVGV4dERpZmZFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9ub3RlYm9vay9icm93c2VyL2RpZmYvbm90ZWJvb2tEaWZmRWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBnZXROb3RlYm9va0VkaXRvckZyb21FZGl0b3JQYW5lLCBJQ2VsbFZpZXdNb2RlbCwgSU5vdGVib29rRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vbm90ZWJvb2svYnJvd3Nlci9ub3RlYm9va0Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL25vdGVib29rL2Jyb3dzZXIvc2VydmljZXMvbm90ZWJvb2tFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE5vdGVib29rQ2VsbFRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL25vdGVib29rL2NvbW1vbi9tb2RlbC9ub3RlYm9va0NlbGxUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9ub3RlYm9vay9jb21tb24vbW9kZWwvbm90ZWJvb2tUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgQ2VsbEtpbmQgfSBmcm9tICcuLi8uLi8uLi8uLi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgSUNoYXRBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY2hhdEFnZW50cy5qcyc7XG5pbXBvcnQgeyBJTW9kaWZpZWRGaWxlRW50cnlDaGFuZ2VIdW5rLCBJTW9kaWZpZWRGaWxlRW50cnlFZGl0b3JJbnRlZ3JhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jaGF0RWRpdGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2hhdEFnZW50TG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IENoYXRFZGl0aW5nQ29kZUVkaXRvckludGVncmF0aW9uLCBJRG9jdW1lbnREaWZmMiB9IGZyb20gJy4uL2NoYXRFZGl0aW5nQ29kZUVkaXRvckludGVncmF0aW9uLmpzJztcbmltcG9ydCB7IENoYXRFZGl0aW5nTW9kaWZpZWROb3RlYm9va0VudHJ5IH0gZnJvbSAnLi4vY2hhdEVkaXRpbmdNb2RpZmllZE5vdGVib29rRW50cnkuanMnO1xuaW1wb3J0IHsgY291bnRDaGFuZ2VzLCBJQ2VsbERpZmZJbmZvLCBzb3J0Q2VsbENoYW5nZXMgfSBmcm9tICcuL25vdGVib29rQ2VsbENoYW5nZXMuanMnO1xuXG5leHBvcnQgY2xhc3MgQ2hhdEVkaXRpbmdOb3RlYm9va0VkaXRvckludGVncmF0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElNb2RpZmllZEZpbGVFbnRyeUVkaXRvckludGVncmF0aW9uIHtcblx0cHJpdmF0ZSBpbnRlZ3JhdGlvbjogQ2hhdEVkaXRpbmdOb3RlYm9va0VkaXRvcldpZGdldEludGVncmF0aW9uO1xuXHRwcml2YXRlIG5vdGVib29rRWRpdG9yOiBJTm90ZWJvb2tFZGl0b3I7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdF9lbnRyeTogQ2hhdEVkaXRpbmdNb2RpZmllZE5vdGVib29rRW50cnksXG5cdFx0ZWRpdG9yOiBJRWRpdG9yUGFuZSxcblx0XHRub3RlYm9va01vZGVsOiBOb3RlYm9va1RleHRNb2RlbCxcblx0XHRvcmlnaW5hbE1vZGVsOiBOb3RlYm9va1RleHRNb2RlbCxcblx0XHRjZWxsQ2hhbmdlczogSU9ic2VydmFibGU8SUNlbGxEaWZmSW5mb1tdPixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnN0IG5vdGVib29rRWRpdG9yID0gZ2V0Tm90ZWJvb2tFZGl0b3JGcm9tRWRpdG9yUGFuZShlZGl0b3IpO1xuXHRcdGFzc2VydFR5cGUobm90ZWJvb2tFZGl0b3IpO1xuXHRcdHRoaXMubm90ZWJvb2tFZGl0b3IgPSBub3RlYm9va0VkaXRvcjtcblx0XHR0aGlzLmludGVncmF0aW9uID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0RWRpdGluZ05vdGVib29rRWRpdG9yV2lkZ2V0SW50ZWdyYXRpb24sIF9lbnRyeSwgbm90ZWJvb2tFZGl0b3IsIG5vdGVib29rTW9kZWwsIG9yaWdpbmFsTW9kZWwsIGNlbGxDaGFuZ2VzKTtcblx0XHR0aGlzLl9yZWdpc3RlcihlZGl0b3Iub25EaWRDaGFuZ2VDb250cm9sKCgpID0+IHtcblx0XHRcdGNvbnN0IG5vdGVib29rRWRpdG9yID0gZ2V0Tm90ZWJvb2tFZGl0b3JGcm9tRWRpdG9yUGFuZShlZGl0b3IpO1xuXHRcdFx0aWYgKG5vdGVib29rRWRpdG9yICYmIG5vdGVib29rRWRpdG9yICE9PSB0aGlzLm5vdGVib29rRWRpdG9yKSB7XG5cdFx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IgPSBub3RlYm9va0VkaXRvcjtcblx0XHRcdFx0dGhpcy5pbnRlZ3JhdGlvbi5kaXNwb3NlKCk7XG5cdFx0XHRcdHRoaXMuaW50ZWdyYXRpb24gPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRFZGl0aW5nTm90ZWJvb2tFZGl0b3JXaWRnZXRJbnRlZ3JhdGlvbiwgX2VudHJ5LCBub3RlYm9va0VkaXRvciwgbm90ZWJvb2tNb2RlbCwgb3JpZ2luYWxNb2RlbCwgY2VsbENoYW5nZXMpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXHRwdWJsaWMgZ2V0IGN1cnJlbnRJbmRleCgpOiBJT2JzZXJ2YWJsZTxudW1iZXI+IHtcblx0XHRyZXR1cm4gdGhpcy5pbnRlZ3JhdGlvbi5jdXJyZW50SW5kZXg7XG5cdH1cblx0cmV2ZWFsKGZpcnN0T3JMYXN0OiBib29sZWFuKTogdm9pZCB7XG5cdFx0cmV0dXJuIHRoaXMuaW50ZWdyYXRpb24ucmV2ZWFsKGZpcnN0T3JMYXN0KTtcblx0fVxuXHRuZXh0KHdyYXA6IGJvb2xlYW4pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5pbnRlZ3JhdGlvbi5uZXh0KHdyYXApO1xuXHR9XG5cdHByZXZpb3VzKHdyYXA6IGJvb2xlYW4pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5pbnRlZ3JhdGlvbi5wcmV2aW91cyh3cmFwKTtcblx0fVxuXHRlbmFibGVBY2Nlc3NpYmxlRGlmZlZpZXcoKTogdm9pZCB7XG5cdFx0dGhpcy5pbnRlZ3JhdGlvbi5lbmFibGVBY2Nlc3NpYmxlRGlmZlZpZXcoKTtcblx0fVxuXHRhY2NlcHROZWFyZXN0Q2hhbmdlKGNoYW5nZTogSU1vZGlmaWVkRmlsZUVudHJ5Q2hhbmdlSHVuayk6IHZvaWQge1xuXHRcdHRoaXMuaW50ZWdyYXRpb24uYWNjZXB0TmVhcmVzdENoYW5nZShjaGFuZ2UpO1xuXHR9XG5cdHJlamVjdE5lYXJlc3RDaGFuZ2UoY2hhbmdlOiBJTW9kaWZpZWRGaWxlRW50cnlDaGFuZ2VIdW5rKTogdm9pZCB7XG5cdFx0dGhpcy5pbnRlZ3JhdGlvbi5yZWplY3ROZWFyZXN0Q2hhbmdlKGNoYW5nZSk7XG5cdH1cblx0dG9nZ2xlRGlmZihjaGFuZ2U6IElNb2RpZmllZEZpbGVFbnRyeUNoYW5nZUh1bmsgfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5pbnRlZ3JhdGlvbi50b2dnbGVEaWZmKGNoYW5nZSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmludGVncmF0aW9uLmRpc3Bvc2UoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuY2xhc3MgQ2hhdEVkaXRpbmdOb3RlYm9va0VkaXRvcldpZGdldEludGVncmF0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElNb2RpZmllZEZpbGVFbnRyeUVkaXRvckludGVncmF0aW9uIHtcblx0cHJpdmF0ZSByZWFkb25seSBfY3VycmVudEluZGV4ID0gb2JzZXJ2YWJsZVZhbHVlKHRoaXMsIC0xKTtcblx0cmVhZG9ubHkgY3VycmVudEluZGV4OiBJT2JzZXJ2YWJsZTxudW1iZXI+ID0gdGhpcy5fY3VycmVudEluZGV4O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2N1cnJlbnRDaGFuZ2UgPSBvYnNlcnZhYmxlVmFsdWU8eyBjaGFuZ2U6IElDZWxsRGlmZkluZm87IGluZGV4OiBudW1iZXIgfSB8IHVuZGVmaW5lZD4odGhpcywgdW5kZWZpbmVkKTtcblx0cmVhZG9ubHkgY3VycmVudENoYW5nZTogSU9ic2VydmFibGU8eyBjaGFuZ2U6IElDZWxsRGlmZkluZm87IGluZGV4OiBudW1iZXIgfSB8IHVuZGVmaW5lZD4gPSB0aGlzLl9jdXJyZW50Q2hhbmdlO1xuXG5cdHByaXZhdGUgZGVsZXRlZENlbGxEZWNvcmF0b3I6IE5vdGVib29rRGVsZXRlZENlbGxEZWNvcmF0b3IgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgaW5zZXJ0ZWRDZWxsRGVjb3JhdG9yOiBOb3RlYm9va0luc2VydGVkQ2VsbERlY29yYXRvciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBtb2RpZmllZENlbGxEZWNvcmF0b3I6IE5vdGVib29rTW9kaWZpZWRDZWxsRGVjb3JhdG9yIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgY2VsbEVkaXRvckludGVncmF0aW9ucyA9IG5ldyBNYXA8Tm90ZWJvb2tDZWxsVGV4dE1vZGVsLCB7IGludGVncmF0aW9uOiBDaGF0RWRpdGluZ0NvZGVFZGl0b3JJbnRlZ3JhdGlvbjsgZGlmZjogSVNldHRhYmxlT2JzZXJ2YWJsZTxJRG9jdW1lbnREaWZmMj4gfT4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IG1kQ2VsbEVkaXRvckF0dGFjaGVkID0gb2JzZXJ2YWJsZVZhbHVlPG51bWJlcj4odGhpcywgLTEpO1xuXG5cdHByaXZhdGUgbWFya3VwQ2VsbExpc3RlbmVycyA9IG5ldyBNYXA8bnVtYmVyLCBJRGlzcG9zYWJsZT4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lbnRyeTogQ2hhdEVkaXRpbmdNb2RpZmllZE5vdGVib29rRW50cnksXG5cdFx0cHJpdmF0ZSByZWFkb25seSBub3RlYm9va0VkaXRvcjogSU5vdGVib29rRWRpdG9yLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbm90ZWJvb2tNb2RlbDogTm90ZWJvb2tUZXh0TW9kZWwsXG5cdFx0b3JpZ2luYWxNb2RlbDogTm90ZWJvb2tUZXh0TW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjZWxsQ2hhbmdlczogSU9ic2VydmFibGU8SUNlbGxEaWZmSW5mb1tdPixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElDaGF0QWdlbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NoYXRBZ2VudFNlcnZpY2U6IElDaGF0QWdlbnRTZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tFZGl0b3JTZXJ2aWNlIG5vdGVib29rRWRpdG9yU2VydmljZTogSU5vdGVib29rRWRpdG9yU2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnN0IG9uRGlkQ2hhbmdlVmlzaWJsZVJhbmdlcyA9IGRlYm91bmNlZE9ic2VydmFibGUob2JzZXJ2YWJsZUZyb21FdmVudChub3RlYm9va0VkaXRvci5vbkRpZENoYW5nZVZpc2libGVSYW5nZXMsICgpID0+IG5vdGVib29rRWRpdG9yLnZpc2libGVSYW5nZXMpLCA1MCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0dGhpcy5tYXJrdXBDZWxsTGlzdGVuZXJzLmZvckVhY2goKHYpID0+IHYuZGlzcG9zZSgpKTtcblx0XHR9KSk7XG5cblx0XHRsZXQgb3JpZ2luYWxSZWFkb25seTogYm9vbGVhbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRjb25zdCBzaG91bGRCZVJlYWRvbmx5ID0gX2VudHJ5LmlzQ3VycmVudGx5QmVpbmdNb2RpZmllZEJ5Lm1hcCh2YWx1ZSA9PiAhIXZhbHVlKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHIgPT4ge1xuXHRcdFx0Y29uc3QgaXNSZWFkT25seSA9IHNob3VsZEJlUmVhZG9ubHkucmVhZChyKTtcblx0XHRcdGNvbnN0IG5vdGVib29rRWRpdG9yID0gbm90ZWJvb2tFZGl0b3JTZXJ2aWNlLnJldHJpZXZlRXhpc3RpbmdXaWRnZXRGcm9tVVJJKF9lbnRyeS5tb2RpZmllZFVSSSk/LnZhbHVlO1xuXHRcdFx0aWYgKCFub3RlYm9va0VkaXRvcikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRvcmlnaW5hbFJlYWRvbmx5ID8/PSBub3RlYm9va0VkaXRvci5pc1JlYWRPbmx5O1xuXHRcdFx0aWYgKGlzUmVhZE9ubHkpIHtcblx0XHRcdFx0bm90ZWJvb2tFZGl0b3Iuc2V0T3B0aW9ucyh7IGlzUmVhZE9ubHk6IHRydWUgfSk7XG5cdFx0XHR9IGVsc2UgaWYgKG9yaWdpbmFsUmVhZG9ubHkgPT09IGZhbHNlKSB7XG5cdFx0XHRcdG5vdGVib29rRWRpdG9yLnNldE9wdGlvbnMoeyBpc1JlYWRPbmx5OiBmYWxzZSB9KTtcblx0XHRcdFx0Ly8gRW5zdXJlIGFsbCBjZWxscyBhcmVhIGVkaXRhYmxlLlxuXHRcdFx0XHQvLyBXZSBtYWtlIHVzZSBvZiBjaGF0RWRpdGluZ0NvZGVFZGl0b3JJbnRlZ3JhdGlvbiB0byBoYW5kbGUgY2VsbCBkaWZmaW5nIGFuZCBuYXZpZ2F0aW9uLlxuXHRcdFx0XHQvLyBIb3dldmVyIHRoYXQgYWxzbyBtYWtlcyB0aGUgY2VsbCByZWFkLW9ubHkuIFdlIG5lZWQgdG8gZW5zdXJlIHRoYXQgdGhlIGNlbGwgaXMgZWRpdGFibGUuXG5cdFx0XHRcdC8vIEUuZy4gZmlyc3Qgd2UgbWFrZSBub3RlYm9vayByZWFkb25seSAoaW4gaGVyZSksIHRoZW4gY2VsbHMgZW5kIHVwIGJlaW5nIHJlYWRvbmx5IGJlY2F1c2Ugbm90ZWJvb2sgaXMgcmVhZG9ubHkuXG5cdFx0XHRcdC8vIFRoZW4gY2hhdEVkaXRpbmdDb2RlRWRpdG9ySW50ZWdyYXRpb24gbWFrZXMgY2VsbHMgcmVhZG9ubHkgYW5kIGtlZXBzIHRyYWNrIG9mIHRoZSBvcmlnaW5hbCByZWFkb25seSBzdGF0ZS5cblx0XHRcdFx0Ly8gSG93ZXZlciB0aGUgY2VsbCBpcyBhbHJlYWR5IHJlYWRvbmx5IGJlY2F1c2UgdGhlIG5vdGVib29rIGlzIHJlYWRvbmx5LlxuXHRcdFx0XHQvLyBTbyB3aGVuIHdlIHJlc3RvcmUgdGhlIG5vdGVib29rIHRvIGVkaXRhYmxlIChpbiBoZXJlKSwgdGhlIGNlbGwgaXMgbWFkZSBlZGl0YWJsZSBhZ2Fpbi5cblx0XHRcdFx0Ly8gQnV0IHdoZW4gY2hhdEVkaXRpbmdDb2RlRWRpdG9ySW50ZWdyYXRpb24gYXR0ZW1wdHMgdG8gcmVzdG9yZSwgaXQgd2lsbCByZXN0b3JlIHRoZSBvcmlnaW5hbCByZWFkb25seSBzdGF0ZS5cblx0XHRcdFx0Ly8gJiBmcm9tIHRoZSBwZXJwc3BlY3RpdmUgb2YgY2hhdEVkaXRpbmdDb2RlRWRpdG9ySW50ZWdyYXRpb24sIHRoZSBjZWxsIHdhcyByZWFkb25seSAmIHNob3VsZCBjb250aW51ZSB0byBiZSByZWFkb25seS5cblx0XHRcdFx0Ly8gVG8gZ2V0IGFyb3VuZCB0aGlzLCB3ZSB3YWl0IGZvciBhIGZldyBtcyBiZWZvcmUgcmVzdG9yaW5nIHRoZSBvcmlnaW5hbCByZWFkb25seSBzdGF0ZSBmb3IgZWFjaCBjZWxsLlxuXHRcdFx0XHRjb25zdCB0aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0bm90ZWJvb2tFZGl0b3Iuc2V0T3B0aW9ucyh7IGlzUmVhZE9ubHk6IHRydWUgfSk7XG5cdFx0XHRcdFx0bm90ZWJvb2tFZGl0b3Iuc2V0T3B0aW9ucyh7IGlzUmVhZE9ubHk6IGZhbHNlIH0pO1xuXHRcdFx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0XHR9LCAxMDApO1xuXHRcdFx0XHRjb25zdCBkaXNwb3NhYmxlID0gdG9EaXNwb3NhYmxlKCgpID0+IGNsZWFyVGltZW91dCh0aW1lb3V0KSk7XG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKGRpc3Bvc2FibGUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIElOSVQgd2hlbiBub3Qgc3RyZWFtaW5nIG5vciBkaWZmaW5nIHRoZSByZXNwb25zZSBhbnltb3JlLCBvbmNlIHBlciByZXF1ZXN0LCBhbmQgd2hlbiBoYXZpbmcgY2hhbmdlc1xuXHRcdGxldCBsYXN0TW9kaWZ5aW5nUmVxdWVzdElkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fc3RvcmUuYWRkKGF1dG9ydW4ociA9PiB7XG5cblx0XHRcdGlmICghX2VudHJ5LmlzQ3VycmVudGx5QmVpbmdNb2RpZmllZEJ5LnJlYWQocilcblx0XHRcdFx0JiYgIV9lbnRyeS5pc1Byb2Nlc3NpbmdSZXNwb25zZS5yZWFkKHIpXG5cdFx0XHRcdCYmIGxhc3RNb2RpZnlpbmdSZXF1ZXN0SWQgIT09IF9lbnRyeS5sYXN0TW9kaWZ5aW5nUmVxdWVzdElkXG5cdFx0XHRcdCYmIGNlbGxDaGFuZ2VzLnJlYWQocikuc29tZShjID0+IGMudHlwZSAhPT0gJ3VuY2hhbmdlZCcgJiYgIWMuZGlmZi5yZWFkKHIpLmlkZW50aWNhbClcblx0XHRcdCkge1xuXHRcdFx0XHRsYXN0TW9kaWZ5aW5nUmVxdWVzdElkID0gX2VudHJ5Lmxhc3RNb2RpZnlpbmdSZXF1ZXN0SWQ7XG5cdFx0XHRcdHRoaXMucmV2ZWFsKHRydWUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIEJ1aWxkIGNlbGwgaW50ZWdyYXRpb25zIChyZXNwb25zaWJsZSBmb3IgbmF2aWdhdGluZyBjaGFuZ2VzIHdpdGhpbiBhIGNlbGwgYW5kIGRlY29yYXRpbmcgY2VsbCB0ZXh0IGNoYW5nZXMpXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyID0+IHtcblx0XHRcdGlmICh0aGlzLm5vdGVib29rRWRpdG9yLnRleHRNb2RlbCAhPT0gdGhpcy5ub3RlYm9va01vZGVsKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHNvcnRlZENlbGxDaGFuZ2VzID0gc29ydENlbGxDaGFuZ2VzKGNlbGxDaGFuZ2VzLnJlYWQocikpO1xuXG5cdFx0XHRjb25zdCBjaGFuZ2VzID0gc29ydGVkQ2VsbENoYW5nZXMuZmlsdGVyKGMgPT4gYy50eXBlICE9PSAnZGVsZXRlJyk7XG5cdFx0XHRvbkRpZENoYW5nZVZpc2libGVSYW5nZXMucmVhZChyKTtcblx0XHRcdGlmICghY2hhbmdlcy5sZW5ndGgpIHtcblx0XHRcdFx0dGhpcy5jZWxsRWRpdG9ySW50ZWdyYXRpb25zLmZvckVhY2goKHsgZGlmZiB9KSA9PiB7XG5cdFx0XHRcdFx0ZGlmZi5zZXQoeyAuLi5kaWZmLmdldCgpLCAuLi5udWxsRG9jdW1lbnREaWZmIH0sIHVuZGVmaW5lZCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLm1kQ2VsbEVkaXRvckF0dGFjaGVkLnJlYWQocik7XG5cblx0XHRcdGNvbnN0IHZhbGlkQ2VsbHMgPSBuZXcgU2V0PE5vdGVib29rQ2VsbFRleHRNb2RlbD4oKTtcblx0XHRcdGNoYW5nZXMuZm9yRWFjaCgoY2hhbmdlKSA9PiB7XG5cdFx0XHRcdGlmIChjaGFuZ2UubW9kaWZpZWRDZWxsSW5kZXggPT09IHVuZGVmaW5lZCB8fCBjaGFuZ2UubW9kaWZpZWRDZWxsSW5kZXggPj0gbm90ZWJvb2tNb2RlbC5jZWxscy5sZW5ndGgpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgY2VsbCA9IG5vdGVib29rTW9kZWwuY2VsbHNbY2hhbmdlLm1vZGlmaWVkQ2VsbEluZGV4XTtcblx0XHRcdFx0Y29uc3QgZWRpdG9yID0gbm90ZWJvb2tFZGl0b3IuY29kZUVkaXRvcnMuZmluZCgoW3ZtLF0pID0+IHZtLmhhbmRsZSA9PT0gbm90ZWJvb2tNb2RlbC5jZWxsc1tjaGFuZ2UubW9kaWZpZWRDZWxsSW5kZXhdLmhhbmRsZSk/LlsxXTtcblx0XHRcdFx0Y29uc3QgbW9kaWZpZWRNb2RlbCA9IGNoYW5nZS5tb2RpZmllZE1vZGVsLnByb21pc2VSZXN1bHQucmVhZChyKT8uZGF0YTtcblx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxNb2RlbCA9IGNoYW5nZS5vcmlnaW5hbE1vZGVsLnByb21pc2VSZXN1bHQucmVhZChyKT8uZGF0YTtcblx0XHRcdFx0aWYgKCFjZWxsIHx8ICFvcmlnaW5hbE1vZGVsIHx8ICFtb2RpZmllZE1vZGVsKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghZWRpdG9yKSB7XG5cdFx0XHRcdFx0aWYgKCF0aGlzLm1hcmt1cENlbGxMaXN0ZW5lcnMuaGFzKGNlbGwuaGFuZGxlKSAmJiBjZWxsLmNlbGxLaW5kID09PSBDZWxsS2luZC5NYXJrdXApIHtcblx0XHRcdFx0XHRcdGNvbnN0IGNlbGxNb2RlbCA9IHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0Vmlld01vZGVsKCk/LnZpZXdDZWxscy5maW5kKGMgPT4gYy5oYW5kbGUgPT09IGNlbGwuaGFuZGxlKTtcblx0XHRcdFx0XHRcdGlmIChjZWxsTW9kZWwpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbGlzdGVuZXIgPSBjZWxsTW9kZWwub25EaWRDaGFuZ2VFZGl0b3JBdHRhY2hTdGF0ZSgoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGNlbGxNb2RlbC5lZGl0b3JBdHRhY2hlZCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dGhpcy5tZENlbGxFZGl0b3JBdHRhY2hlZC5zZXQoY2VsbC5oYW5kbGUsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0XHRcdFx0XHRsaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLm1hcmt1cENlbGxMaXN0ZW5lcnMuZGVsZXRlKGNlbGwuaGFuZGxlKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHR0aGlzLm1hcmt1cENlbGxMaXN0ZW5lcnMuc2V0KGNlbGwuaGFuZGxlLCBsaXN0ZW5lcik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBkaWZmID0ge1xuXHRcdFx0XHRcdC4uLmNoYW5nZS5kaWZmLnJlYWQociksXG5cdFx0XHRcdFx0bW9kaWZpZWRNb2RlbCxcblx0XHRcdFx0XHRvcmlnaW5hbE1vZGVsLFxuXHRcdFx0XHRcdGtlZXA6IGNoYW5nZS5rZWVwLFxuXHRcdFx0XHRcdHVuZG86IGNoYW5nZS51bmRvXG5cdFx0XHRcdH0gc2F0aXNmaWVzIElEb2N1bWVudERpZmYyO1xuXHRcdFx0XHR2YWxpZENlbGxzLmFkZChjZWxsKTtcblx0XHRcdFx0Y29uc3QgY3VycmVudERpZmYgPSB0aGlzLmNlbGxFZGl0b3JJbnRlZ3JhdGlvbnMuZ2V0KGNlbGwpO1xuXHRcdFx0XHRpZiAoY3VycmVudERpZmYpIHtcblx0XHRcdFx0XHQvLyBEbyBub3QgdW5uZWNlc3NhcmlseSB0cmlnZ2VyIGEgY2hhbmdlIGV2ZW50XG5cdFx0XHRcdFx0aWYgKCFhcmVEb2N1bWVudERpZmYyRXF1YWwoY3VycmVudERpZmYuZGlmZi5nZXQoKSwgZGlmZikpIHtcblx0XHRcdFx0XHRcdGN1cnJlbnREaWZmLmRpZmYuc2V0KGRpZmYsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGRpZmYyID0gb2JzZXJ2YWJsZVZhbHVlKGBkaWZmJHtjZWxsLmhhbmRsZX1gLCBkaWZmKTtcblx0XHRcdFx0XHRjb25zdCBpbnRlZ3JhdGlvbiA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdEVkaXRpbmdDb2RlRWRpdG9ySW50ZWdyYXRpb24sIF9lbnRyeSwgZWRpdG9yLCBkaWZmMik7XG5cdFx0XHRcdFx0dGhpcy5jZWxsRWRpdG9ySW50ZWdyYXRpb25zLnNldChjZWxsLCB7IGludGVncmF0aW9uLCBkaWZmOiBkaWZmMiB9KTtcblx0XHRcdFx0XHR0aGlzLl9yZWdpc3RlcihpbnRlZ3JhdGlvbik7XG5cdFx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdG9yLm9uRGlkRGlzcG9zZSgoKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLmNlbGxFZGl0b3JJbnRlZ3JhdGlvbnMuZ2V0KGNlbGwpPy5pbnRlZ3JhdGlvbi5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHR0aGlzLmNlbGxFZGl0b3JJbnRlZ3JhdGlvbnMuZGVsZXRlKGNlbGwpO1xuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0XHR0aGlzLl9yZWdpc3RlcihlZGl0b3Iub25EaWRDaGFuZ2VNb2RlbCgoKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoZWRpdG9yLmdldE1vZGVsKCkgIT09IGNlbGwudGV4dE1vZGVsKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuY2VsbEVkaXRvckludGVncmF0aW9ucy5nZXQoY2VsbCk/LmludGVncmF0aW9uLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5jZWxsRWRpdG9ySW50ZWdyYXRpb25zLmRlbGV0ZShjZWxsKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHQvLyBEaXNwb3NlIG9sZCBpbnRlZ3JhdGlvbnMgYXMgdGhlIGVkaXRvcnMgYXJlIG5vIGxvbmdlciB2YWxpZC5cblx0XHRcdHRoaXMuY2VsbEVkaXRvckludGVncmF0aW9ucy5mb3JFYWNoKCh2LCBjZWxsKSA9PiB7XG5cdFx0XHRcdGlmICghdmFsaWRDZWxscy5oYXMoY2VsbCkpIHtcblx0XHRcdFx0XHR2LmludGVncmF0aW9uLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHR0aGlzLmNlbGxFZGl0b3JJbnRlZ3JhdGlvbnMuZGVsZXRlKGNlbGwpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHIgPT4ge1xuXHRcdFx0Y29uc3QgY3VycmVudENoYW5nZSA9IHRoaXMuY3VycmVudENoYW5nZS5yZWFkKHIpO1xuXHRcdFx0aWYgKCFjdXJyZW50Q2hhbmdlKSB7XG5cdFx0XHRcdHRoaXMuX2N1cnJlbnRJbmRleC5zZXQoLTEsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0bGV0IGluZGV4ID0gMDtcblx0XHRcdGNvbnN0IHNvcnRlZENlbGxDaGFuZ2VzID0gc29ydENlbGxDaGFuZ2VzKGNlbGxDaGFuZ2VzLnJlYWQocikpO1xuXHRcdFx0Zm9yIChjb25zdCBjaGFuZ2Ugb2Ygc29ydGVkQ2VsbENoYW5nZXMpIHtcblx0XHRcdFx0aWYgKGN1cnJlbnRDaGFuZ2UgJiYgY3VycmVudENoYW5nZS5jaGFuZ2UgPT09IGNoYW5nZSkge1xuXHRcdFx0XHRcdGlmIChjaGFuZ2UudHlwZSA9PT0gJ21vZGlmaWVkJykge1xuXHRcdFx0XHRcdFx0aW5kZXggKz0gY3VycmVudENoYW5nZS5pbmRleDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGNoYW5nZS50eXBlID09PSAnaW5zZXJ0JyB8fCBjaGFuZ2UudHlwZSA9PT0gJ2RlbGV0ZScpIHtcblx0XHRcdFx0XHRpbmRleCsrO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGNoYW5nZS50eXBlID09PSAnbW9kaWZpZWQnKSB7XG5cdFx0XHRcdFx0aW5kZXggKz0gY2hhbmdlLmRpZmYucmVhZChyKS5jaGFuZ2VzLmxlbmd0aDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9jdXJyZW50SW5kZXguc2V0KGluZGV4LCB1bmRlZmluZWQpO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGNlbGxzQXJlVmlzaWJsZSA9IG9uRGlkQ2hhbmdlVmlzaWJsZVJhbmdlcy5tYXAodiA9PiB2Lmxlbmd0aCA+IDApO1xuXHRcdGNvbnN0IGRlYm91bmNlZENoYW5nZXMgPSBkZWJvdW5jZWRPYnNlcnZhYmxlKGNlbGxDaGFuZ2VzLCAxMCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyID0+IHtcblx0XHRcdGlmICh0aGlzLm5vdGVib29rRWRpdG9yLnRleHRNb2RlbCAhPT0gdGhpcy5ub3RlYm9va01vZGVsIHx8ICFjZWxsc0FyZVZpc2libGUucmVhZChyKSB8fCAhdGhpcy5ub3RlYm9va0VkaXRvci5nZXRWaWV3TW9kZWwoKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHQvLyBXZSBjYW4gaGF2ZSBpbnNlcnRlZCBjZWxscyB0aGF0IGhhdmUgYmVlbiBhY2NlcHRlZCwgaW4gdGhvc2UgY2FzZXMgd2UgZG8gbm90IHdhbnQgYW55IGRlY29yYXRvcnMgb24gdGhlbS5cblx0XHRcdGNvbnN0IGNoYW5nZXMgPSBkZWJvdW5jZWRDaGFuZ2VzLnJlYWQocikuZmlsdGVyKGMgPT4gYy50eXBlID09PSAnaW5zZXJ0JyA/ICFjLmRpZmYucmVhZChyKS5pZGVudGljYWwgOiB0cnVlKTtcblx0XHRcdGNvbnN0IG1vZGlmaWVkQ2hhbmdlcyA9IGNoYW5nZXMuZmlsdGVyKGMgPT4gYy50eXBlID09PSAnbW9kaWZpZWQnKTtcblxuXHRcdFx0dGhpcy5jcmVhdGVEZWNvcmF0b3JzKCk7XG5cdFx0XHR0aGlzLmluc2VydGVkQ2VsbERlY29yYXRvcj8uYXBwbHkoY2hhbmdlcyk7XG5cdFx0XHR0aGlzLm1vZGlmaWVkQ2VsbERlY29yYXRvcj8uYXBwbHkobW9kaWZpZWRDaGFuZ2VzKTtcblx0XHRcdHRoaXMuZGVsZXRlZENlbGxEZWNvcmF0b3I/LmFwcGx5KGNoYW5nZXMsIG9yaWdpbmFsTW9kZWwpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlRGVjb3JhdG9ycygpIHtcblx0XHRjb25zdCBjZWxsQ2hhbmdlcyA9IHRoaXMuY2VsbENoYW5nZXMuZ2V0KCk7XG5cdFx0Y29uc3QgYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UgPSB0aGlzLmFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlO1xuXG5cdFx0dGhpcy5pbnNlcnRlZENlbGxEZWNvcmF0b3IgPz89IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90ZWJvb2tJbnNlcnRlZENlbGxEZWNvcmF0b3IsIHRoaXMubm90ZWJvb2tFZGl0b3IpKTtcblx0XHR0aGlzLm1vZGlmaWVkQ2VsbERlY29yYXRvciA/Pz0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShOb3RlYm9va01vZGlmaWVkQ2VsbERlY29yYXRvciwgdGhpcy5ub3RlYm9va0VkaXRvcikpO1xuXG5cdFx0aWYgKHRoaXMuZGVsZXRlZENlbGxEZWNvcmF0b3IpIHtcblx0XHRcdHRoaXMuX3N0b3JlLmRlbGV0ZSh0aGlzLmRlbGV0ZWRDZWxsRGVjb3JhdG9yKTtcblx0XHRcdHRoaXMuZGVsZXRlZENlbGxEZWNvcmF0b3IuZGlzcG9zZSgpO1xuXHRcdH1cblx0XHR0aGlzLmRlbGV0ZWRDZWxsRGVjb3JhdG9yID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShOb3RlYm9va0RlbGV0ZWRDZWxsRGVjb3JhdG9yLCB0aGlzLm5vdGVib29rRWRpdG9yLCB7XG5cdFx0XHRjbGFzc05hbWU6ICdjaGF0LWRpZmYtY2hhbmdlLWNvbnRlbnQtd2lkZ2V0Jyxcblx0XHRcdHRlbGVtZXRyeVNvdXJjZTogJ2NoYXRFZGl0aW5nTm90ZWJvb2tIdW5rJyxcblx0XHRcdG1lbnVJZDogTWVudUlkLkNoYXRFZGl0aW5nRWRpdG9ySHVuayxcblx0XHRcdGFyZ0ZhY3Rvcnk6IChkZWxldGVkQ2VsbEluZGV4OiBudW1iZXIpID0+IHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRhY2NlcHQoKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBlbnRyeSA9IGNlbGxDaGFuZ2VzLmZpbmQoYyA9PiBjLnR5cGUgPT09ICdkZWxldGUnICYmIGMub3JpZ2luYWxDZWxsSW5kZXggPT09IGRlbGV0ZWRDZWxsSW5kZXgpO1xuXHRcdFx0XHRcdFx0aWYgKGVudHJ5KSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBlbnRyeS5rZWVwKGVudHJ5LmRpZmYuZ2V0KCkuY2hhbmdlc1swXSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRhY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZS5wbGF5U2lnbmFsKEFjY2Vzc2liaWxpdHlTaWduYWwuZWRpdHNLZXB0LCB7IGFsbG93TWFueUluUGFyYWxsZWw6IHRydWUgfSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRydWUpO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0cmVqZWN0KCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgZW50cnkgPSBjZWxsQ2hhbmdlcy5maW5kKGMgPT4gYy50eXBlID09PSAnZGVsZXRlJyAmJiBjLm9yaWdpbmFsQ2VsbEluZGV4ID09PSBkZWxldGVkQ2VsbEluZGV4KTtcblx0XHRcdFx0XHRcdGlmIChlbnRyeSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZW50cnkudW5kbyhlbnRyeS5kaWZmLmdldCgpLmNoYW5nZXNbMF0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0YWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UucGxheVNpZ25hbChBY2Nlc3NpYmlsaXR5U2lnbmFsLmVkaXRzVW5kb25lLCB7IGFsbG93TWFueUluUGFyYWxsZWw6IHRydWUgfSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRydWUpO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0gc2F0aXNmaWVzIElNb2RpZmllZEZpbGVFbnRyeUNoYW5nZUh1bms7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0Z2V0Q2VsbChtb2RpZmllZENlbGxJbmRleDogbnVtYmVyKSB7XG5cdFx0Y29uc3QgY2VsbCA9IHRoaXMubm90ZWJvb2tNb2RlbC5jZWxsc1ttb2RpZmllZENlbGxJbmRleF07XG5cdFx0Y29uc3QgaW50ZWdyYXRpb24gPSB0aGlzLmNlbGxFZGl0b3JJbnRlZ3JhdGlvbnMuZ2V0KGNlbGwpPy5pbnRlZ3JhdGlvbjtcblx0XHRyZXR1cm4gaW50ZWdyYXRpb247XG5cdH1cblxuXHRyZXZlYWwoZmlyc3RPckxhc3Q6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCBjaGFuZ2VzID0gc29ydENlbGxDaGFuZ2VzKHRoaXMuY2VsbENoYW5nZXMuZ2V0KCkuZmlsdGVyKGMgPT4gYy50eXBlICE9PSAndW5jaGFuZ2VkJykpO1xuXHRcdGlmICghY2hhbmdlcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IGNoYW5nZSA9IGZpcnN0T3JMYXN0ID8gY2hhbmdlc1swXSA6IGNoYW5nZXNbY2hhbmdlcy5sZW5ndGggLSAxXTtcblx0XHR0aGlzLl9yZXZlYWxGaXJzdE9yTGFzdChjaGFuZ2UsIGZpcnN0T3JMYXN0KTtcblx0fVxuXG5cdHByaXZhdGUgX3JldmVhbEZpcnN0T3JMYXN0KGNoYW5nZTogSUNlbGxEaWZmSW5mbywgZmlyc3RPckxhc3Q6IGJvb2xlYW4gPSB0cnVlKSB7XG5cdFx0c3dpdGNoIChjaGFuZ2UudHlwZSkge1xuXHRcdFx0Y2FzZSAnaW5zZXJ0Jzpcblx0XHRcdGNhc2UgJ21vZGlmaWVkJzpcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnN0IGluZGV4ID0gZmlyc3RPckxhc3QgfHwgY2hhbmdlLnR5cGUgPT09ICdpbnNlcnQnID8gMCA6IGNoYW5nZS5kaWZmLmdldCgpLmNoYW5nZXMubGVuZ3RoIC0gMTtcblx0XHRcdFx0XHRjb25zdCBjZWxsSW50ZWdyYXRpb24gPSB0aGlzLmdldENlbGwoY2hhbmdlLm1vZGlmaWVkQ2VsbEluZGV4KTtcblx0XHRcdFx0XHRpZiAoY2VsbEludGVncmF0aW9uKSB7XG5cdFx0XHRcdFx0XHRjZWxsSW50ZWdyYXRpb24ucmV2ZWFsKGZpcnN0T3JMYXN0KTtcblx0XHRcdFx0XHRcdHRoaXMuX2N1cnJlbnRDaGFuZ2Uuc2V0KHsgY2hhbmdlOiBjaGFuZ2UsIGluZGV4IH0sIHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuX3JldmVhbENoYW5nZShjaGFuZ2UsIGluZGV4KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdGNhc2UgJ2RlbGV0ZSc6XG5cdFx0XHRcdC8vIHJldmVhbCB0aGUgZGVsZXRlZCBjZWxsIGRlY29yYXRvclxuXHRcdFx0XHR0aGlzLmRlbGV0ZWRDZWxsRGVjb3JhdG9yPy5yZXZlYWwoY2hhbmdlLm9yaWdpbmFsQ2VsbEluZGV4KTtcblx0XHRcdFx0dGhpcy5fY3VycmVudENoYW5nZS5zZXQoeyBjaGFuZ2U6IGNoYW5nZSwgaW5kZXg6IDAgfSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIF9yZXZlYWxDaGFuZ2UoY2hhbmdlOiBJQ2VsbERpZmZJbmZvLCBpbmRleEluQ2VsbDogbnVtYmVyKSB7XG5cdFx0c3dpdGNoIChjaGFuZ2UudHlwZSkge1xuXHRcdFx0Y2FzZSAnaW5zZXJ0Jzpcblx0XHRcdGNhc2UgJ21vZGlmaWVkJzpcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnN0IHRleHRDaGFuZ2UgPSBjaGFuZ2UuZGlmZi5nZXQoKS5jaGFuZ2VzW2luZGV4SW5DZWxsXTtcblx0XHRcdFx0XHRjb25zdCBjZWxsVmlld01vZGVsID0gdGhpcy5nZXRDZWxsVmlld01vZGVsKGNoYW5nZSk7XG5cdFx0XHRcdFx0aWYgKGNlbGxWaWV3TW9kZWwpIHtcblx0XHRcdFx0XHRcdHRoaXMucmV2ZWFsQ2hhbmdlSW5WaWV3KGNlbGxWaWV3TW9kZWwsIHRleHRDaGFuZ2U/Lm1vZGlmaWVkKTtcblx0XHRcdFx0XHRcdHRoaXMuX2N1cnJlbnRDaGFuZ2Uuc2V0KHsgY2hhbmdlOiBjaGFuZ2UsIGluZGV4OiBpbmRleEluQ2VsbCB9LCB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRjYXNlICdkZWxldGUnOlxuXHRcdFx0XHQvLyByZXZlYWwgdGhlIGRlbGV0ZWQgY2VsbCBkZWNvcmF0b3Jcblx0XHRcdFx0dGhpcy5kZWxldGVkQ2VsbERlY29yYXRvcj8ucmV2ZWFsKGNoYW5nZS5vcmlnaW5hbENlbGxJbmRleCk7XG5cdFx0XHRcdHRoaXMuX2N1cnJlbnRDaGFuZ2Uuc2V0KHsgY2hhbmdlOiBjaGFuZ2UsIGluZGV4OiAwIH0sIHVuZGVmaW5lZCk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRDZWxsVmlld01vZGVsKGNoYW5nZTogSUNlbGxEaWZmSW5mbykge1xuXHRcdGlmIChjaGFuZ2UudHlwZSA9PT0gJ2RlbGV0ZScgfHwgY2hhbmdlLm1vZGlmaWVkQ2VsbEluZGV4ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IGNlbGwgPSB0aGlzLm5vdGVib29rTW9kZWwuY2VsbHNbY2hhbmdlLm1vZGlmaWVkQ2VsbEluZGV4XTtcblx0XHRjb25zdCBjZWxsVmlld01vZGVsID0gdGhpcy5ub3RlYm9va0VkaXRvci5nZXRWaWV3TW9kZWwoKT8udmlld0NlbGxzLmZpbmQoYyA9PiBjLmhhbmRsZSA9PT0gY2VsbC5oYW5kbGUpO1xuXHRcdHJldHVybiBjZWxsVmlld01vZGVsO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXZlYWxDaGFuZ2VJblZpZXcoY2VsbDogSUNlbGxWaWV3TW9kZWwsIGxpbmVzOiBMaW5lUmFuZ2UgfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB0YXJnZXRMaW5lcyA9IGxpbmVzID8/IG5ldyBMaW5lUmFuZ2UoMCwgMCk7XG5cdFx0YXdhaXQgdGhpcy5ub3RlYm9va0VkaXRvci5mb2N1c05vdGVib29rQ2VsbChjZWxsLCAnY29udGFpbmVyJywgeyBmb2N1c0VkaXRvckxpbmU6IHRhcmdldExpbmVzLnN0YXJ0TGluZU51bWJlciB9KTtcblx0XHRhd2FpdCB0aGlzLm5vdGVib29rRWRpdG9yLnJldmVhbFJhbmdlSW5DZW50ZXJBc3luYyhjZWxsLCBuZXcgUmFuZ2UodGFyZ2V0TGluZXMuc3RhcnRMaW5lTnVtYmVyLCAwLCB0YXJnZXRMaW5lcy5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlLCAwKSk7XG5cdH1cblxuXHRuZXh0KHdyYXA6IGJvb2xlYW4pOiBib29sZWFuIHtcblx0XHRjb25zdCBjaGFuZ2VzID0gc29ydENlbGxDaGFuZ2VzKHRoaXMuY2VsbENoYW5nZXMuZ2V0KCkuZmlsdGVyKGMgPT4gYy50eXBlICE9PSAndW5jaGFuZ2VkJykpO1xuXHRcdGNvbnN0IGN1cnJlbnRDaGFuZ2UgPSB0aGlzLmN1cnJlbnRDaGFuZ2UuZ2V0KCk7XG5cdFx0aWYgKCFjdXJyZW50Q2hhbmdlKSB7XG5cdFx0XHRjb25zdCBmaXJzdENoYW5nZSA9IGNoYW5nZXNbMF07XG5cblx0XHRcdGlmIChmaXJzdENoYW5nZSkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcmV2ZWFsRmlyc3RPckxhc3QoZmlyc3RDaGFuZ2UpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gZ28gdG8gbmV4dFxuXHRcdC8vIGZpcnN0IGNoZWNrIGlmIHdlIGFyZSBhdCB0aGUgZW5kIG9mIHRoZSBjdXJyZW50IGNoYW5nZVxuXHRcdHN3aXRjaCAoY3VycmVudENoYW5nZS5jaGFuZ2UudHlwZSkge1xuXHRcdFx0Y2FzZSAnbW9kaWZpZWQnOlxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Y29uc3QgY2VsbEludGVncmF0aW9uID0gdGhpcy5nZXRDZWxsKGN1cnJlbnRDaGFuZ2UuY2hhbmdlLm1vZGlmaWVkQ2VsbEluZGV4KTtcblx0XHRcdFx0XHRpZiAoY2VsbEludGVncmF0aW9uKSB7XG5cdFx0XHRcdFx0XHRpZiAoY2VsbEludGVncmF0aW9uLm5leHQoZmFsc2UpKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX2N1cnJlbnRDaGFuZ2Uuc2V0KHsgY2hhbmdlOiBjdXJyZW50Q2hhbmdlLmNoYW5nZSwgaW5kZXg6IGNlbGxJbnRlZ3JhdGlvbi5jdXJyZW50SW5kZXguZ2V0KCkgfSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgaXNMYXN0Q2hhbmdlSW5DZWxsID0gY3VycmVudENoYW5nZS5pbmRleCA9PT0gbGFzdENoYW5nZUluZGV4KGN1cnJlbnRDaGFuZ2UuY2hhbmdlKTtcblx0XHRcdFx0XHRjb25zdCBpbmRleCA9IGlzTGFzdENoYW5nZUluQ2VsbCA/IDAgOiBjdXJyZW50Q2hhbmdlLmluZGV4ICsgMTtcblx0XHRcdFx0XHRjb25zdCBjaGFuZ2UgPSBpc0xhc3RDaGFuZ2VJbkNlbGwgPyBjaGFuZ2VzW2NoYW5nZXMuaW5kZXhPZihjdXJyZW50Q2hhbmdlLmNoYW5nZSkgKyAxXSA6IGN1cnJlbnRDaGFuZ2UuY2hhbmdlO1xuXG5cdFx0XHRcdFx0aWYgKGNoYW5nZSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuX3JldmVhbENoYW5nZShjaGFuZ2UsIGluZGV4KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdpbnNlcnQnOlxuXHRcdFx0Y2FzZSAnZGVsZXRlJzpcblx0XHRcdFx0e1xuXHRcdFx0XHRcdC8vIGdvIHRvIG5leHQgY2hhbmdlIGRpcmVjdGx5XG5cdFx0XHRcdFx0Y29uc3QgbmV4dENoYW5nZSA9IGNoYW5nZXNbY2hhbmdlcy5pbmRleE9mKGN1cnJlbnRDaGFuZ2UuY2hhbmdlKSArIDFdO1xuXHRcdFx0XHRcdGlmIChuZXh0Q2hhbmdlKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fcmV2ZWFsRmlyc3RPckxhc3QobmV4dENoYW5nZSwgdHJ1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0aWYgKHdyYXApIHtcblx0XHRcdHJldHVybiB0aGlzLm5leHQoZmFsc2UpO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByZXZpb3VzKHdyYXA6IGJvb2xlYW4pOiBib29sZWFuIHtcblx0XHRjb25zdCBjaGFuZ2VzID0gc29ydENlbGxDaGFuZ2VzKHRoaXMuY2VsbENoYW5nZXMuZ2V0KCkuZmlsdGVyKGMgPT4gYy50eXBlICE9PSAndW5jaGFuZ2VkJykpO1xuXHRcdGNvbnN0IGN1cnJlbnRDaGFuZ2UgPSB0aGlzLmN1cnJlbnRDaGFuZ2UuZ2V0KCk7XG5cdFx0aWYgKCFjdXJyZW50Q2hhbmdlKSB7XG5cdFx0XHRjb25zdCBsYXN0Q2hhbmdlID0gY2hhbmdlc1tjaGFuZ2VzLmxlbmd0aCAtIDFdO1xuXHRcdFx0aWYgKGxhc3RDaGFuZ2UpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3JldmVhbEZpcnN0T3JMYXN0KGxhc3RDaGFuZ2UsIGZhbHNlKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIGdvIHRvIHByZXZpb3VzXG5cdFx0Ly8gZmlyc3QgY2hlY2sgaWYgd2UgYXJlIGF0IHRoZSBzdGFydCBvZiB0aGUgY3VycmVudCBjaGFuZ2Vcblx0XHRzd2l0Y2ggKGN1cnJlbnRDaGFuZ2UuY2hhbmdlLnR5cGUpIHtcblx0XHRcdGNhc2UgJ21vZGlmaWVkJzpcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnN0IGNlbGxJbnRlZ3JhdGlvbiA9IHRoaXMuZ2V0Q2VsbChjdXJyZW50Q2hhbmdlLmNoYW5nZS5tb2RpZmllZENlbGxJbmRleCk7XG5cdFx0XHRcdFx0aWYgKGNlbGxJbnRlZ3JhdGlvbikge1xuXHRcdFx0XHRcdFx0aWYgKGNlbGxJbnRlZ3JhdGlvbi5wcmV2aW91cyhmYWxzZSkpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fY3VycmVudENoYW5nZS5zZXQoeyBjaGFuZ2U6IGN1cnJlbnRDaGFuZ2UuY2hhbmdlLCBpbmRleDogY2VsbEludGVncmF0aW9uLmN1cnJlbnRJbmRleC5nZXQoKSB9LCB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCBpc0ZpcnN0Q2hhbmdlSW5DZWxsID0gY3VycmVudENoYW5nZS5pbmRleCA9PT0gMDtcblx0XHRcdFx0XHRjb25zdCBjaGFuZ2UgPSBpc0ZpcnN0Q2hhbmdlSW5DZWxsID8gY2hhbmdlc1tjaGFuZ2VzLmluZGV4T2YoY3VycmVudENoYW5nZS5jaGFuZ2UpIC0gMV0gOiBjdXJyZW50Q2hhbmdlLmNoYW5nZTtcblxuXHRcdFx0XHRcdGlmIChjaGFuZ2UpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGluZGV4ID0gaXNGaXJzdENoYW5nZUluQ2VsbCA/IGxhc3RDaGFuZ2VJbmRleChjaGFuZ2UpIDogY3VycmVudENoYW5nZS5pbmRleCAtIDE7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fcmV2ZWFsQ2hhbmdlKGNoYW5nZSwgaW5kZXgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ2luc2VydCc6XG5cdFx0XHRjYXNlICdkZWxldGUnOlxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Ly8gZ28gdG8gcHJldmlvdXMgY2hhbmdlIGRpcmVjdGx5XG5cdFx0XHRcdFx0Y29uc3QgcHJldkNoYW5nZSA9IGNoYW5nZXNbY2hhbmdlcy5pbmRleE9mKGN1cnJlbnRDaGFuZ2UuY2hhbmdlKSAtIDFdO1xuXHRcdFx0XHRcdGlmIChwcmV2Q2hhbmdlKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fcmV2ZWFsRmlyc3RPckxhc3QocHJldkNoYW5nZSwgZmFsc2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdGlmICh3cmFwKSB7XG5cdFx0XHRjb25zdCBsYXN0Q2hhbmdlID0gY2hhbmdlc1tjaGFuZ2VzLmxlbmd0aCAtIDFdO1xuXHRcdFx0aWYgKGxhc3RDaGFuZ2UpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3JldmVhbEZpcnN0T3JMYXN0KGxhc3RDaGFuZ2UsIGZhbHNlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRlbmFibGVBY2Nlc3NpYmxlRGlmZlZpZXcoKTogdm9pZCB7XG5cdFx0Y29uc3QgY2VsbCA9IHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0QWN0aXZlQ2VsbCgpPy5tb2RlbDtcblx0XHRpZiAoY2VsbCkge1xuXHRcdFx0Y29uc3QgaW50ZWdyYXRpb24gPSB0aGlzLmNlbGxFZGl0b3JJbnRlZ3JhdGlvbnMuZ2V0KGNlbGwpPy5pbnRlZ3JhdGlvbjtcblx0XHRcdGludGVncmF0aW9uPy5lbmFibGVBY2Nlc3NpYmxlRGlmZlZpZXcoKTtcblx0XHR9XG5cdH1cblx0YWNjZXB0TmVhcmVzdENoYW5nZShjaGFuZ2U6IElNb2RpZmllZEZpbGVFbnRyeUNoYW5nZUh1bmspOiB2b2lkIHtcblx0XHRjaGFuZ2UuYWNjZXB0KCk7XG5cdFx0dGhpcy5uZXh0KHRydWUpO1xuXHR9XG5cdHJlamVjdE5lYXJlc3RDaGFuZ2UoY2hhbmdlOiBJTW9kaWZpZWRGaWxlRW50cnlDaGFuZ2VIdW5rKTogdm9pZCB7XG5cdFx0Y2hhbmdlLnJlamVjdCgpO1xuXHRcdHRoaXMubmV4dCh0cnVlKTtcblx0fVxuXHRhc3luYyB0b2dnbGVEaWZmKF9jaGFuZ2U6IElNb2RpZmllZEZpbGVFbnRyeUNoYW5nZUh1bmsgfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBkZWZhdWx0QWdlbnROYW1lID0gdGhpcy5fY2hhdEFnZW50U2VydmljZS5nZXREZWZhdWx0QWdlbnQoQ2hhdEFnZW50TG9jYXRpb24uRWRpdGluZ1Nlc3Npb24pPy5mdWxsTmFtZTtcblx0XHRjb25zdCBkaWZmSW5wdXQgPSB7XG5cdFx0XHRvcmlnaW5hbDogeyByZXNvdXJjZTogdGhpcy5fZW50cnkub3JpZ2luYWxVUkksIG9wdGlvbnM6IHsgc2VsZWN0aW9uOiB1bmRlZmluZWQgfSB9LFxuXHRcdFx0bW9kaWZpZWQ6IHsgcmVzb3VyY2U6IHRoaXMuX2VudHJ5Lm1vZGlmaWVkVVJJLCBvcHRpb25zOiB7IHNlbGVjdGlvbjogdW5kZWZpbmVkIH0gfSxcblx0XHRcdGxhYmVsOiBkZWZhdWx0QWdlbnROYW1lXG5cdFx0XHRcdD8gbG9jYWxpemUoJ2RpZmYuYWdlbnQnLCAnezB9IChjaGFuZ2VzIGZyb20gezF9KScsIGJhc2VuYW1lKHRoaXMuX2VudHJ5Lm1vZGlmaWVkVVJJKSwgZGVmYXVsdEFnZW50TmFtZSlcblx0XHRcdFx0OiBsb2NhbGl6ZSgnZGlmZi5nZW5lcmljJywgJ3swfSAoY2hhbmdlcyBmcm9tIGNoYXQpJywgYmFzZW5hbWUodGhpcy5fZW50cnkubW9kaWZpZWRVUkkpKVxuXHRcdH0gc2F0aXNmaWVzIElSZXNvdXJjZURpZmZFZGl0b3JJbnB1dDtcblx0XHRhd2FpdCB0aGlzLl9lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoZGlmZklucHV0KTtcblxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0RWRpdGluZ05vdGVib29rRGlmZkVkaXRvckludGVncmF0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElNb2RpZmllZEZpbGVFbnRyeUVkaXRvckludGVncmF0aW9uIHtcblx0cHJpdmF0ZSByZWFkb25seSBfY3VycmVudEluZGV4ID0gb2JzZXJ2YWJsZVZhbHVlKHRoaXMsIC0xKTtcblx0cmVhZG9ubHkgY3VycmVudEluZGV4OiBJT2JzZXJ2YWJsZTxudW1iZXI+ID0gdGhpcy5fY3VycmVudEluZGV4O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbm90ZWJvb2tEaWZmRWRpdG9yOiBJTm90ZWJvb2tUZXh0RGlmZkVkaXRvcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNlbGxDaGFuZ2VzOiBJT2JzZXJ2YWJsZTxJQ2VsbERpZmZJbmZvW10+XG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9zdG9yZS5hZGQoYXV0b3J1bihyID0+IHtcblx0XHRcdGNvbnN0IGluZGV4ID0gbm90ZWJvb2tEaWZmRWRpdG9yLmN1cnJlbnRDaGFuZ2VkSW5kZXgucmVhZChyKTtcblx0XHRcdGNvbnN0IG51bWJlck9mQ2VsbENoYW5nZXMgPSBjZWxsQ2hhbmdlcy5yZWFkKHIpLmZpbHRlcihjID0+ICFjLmRpZmYucmVhZChyKS5pZGVudGljYWwpO1xuXHRcdFx0aWYgKG51bWJlck9mQ2VsbENoYW5nZXMubGVuZ3RoICYmIGluZGV4ID49IDAgJiYgaW5kZXggPCBudW1iZXJPZkNlbGxDaGFuZ2VzLmxlbmd0aCkge1xuXHRcdFx0XHQvLyBOb3RlYm9vayBEaWZmIGVkaXRvciBvbmx5IHN1cHBvcnRzIG5hdmlnYXRpbmcgdGhyb3VnaCBjaGFuZ2VzIHRvIGNlbGxzLlxuXHRcdFx0XHQvLyBIb3dldmVyIGluIGNoYXQgd2UgdGFrZSBjaGFuZ2VzIHRvIGxpbmVzIGluIHRoZSBjZWxscyBpbnRvIGFjY291bnQuXG5cdFx0XHRcdC8vIFNvIGlmIHdlJ3JlIG9uIHRoZSBzZWNvbmQgY2VsbCBhbmQgZmlyc3QgY2VsbCBoYXMgMyBjaGFuZ2VzLCB0aGVuIHdlJ3JlIG9uIHRoZSA0dGggY2hhbmdlLlxuXHRcdFx0XHRjb25zdCBjaGFuZ2VzU29GYXIgPSBjb3VudENoYW5nZXMobnVtYmVyT2ZDZWxsQ2hhbmdlcy5zbGljZSgwLCBpbmRleCArIDEpKTtcblx0XHRcdFx0dGhpcy5fY3VycmVudEluZGV4LnNldChjaGFuZ2VzU29GYXIgLSAxLCB1bmRlZmluZWQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fY3VycmVudEluZGV4LnNldCgtMSwgdW5kZWZpbmVkKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRyZXZlYWwoZmlyc3RPckxhc3Q6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCBjaGFuZ2VzID0gc29ydENlbGxDaGFuZ2VzKHRoaXMuY2VsbENoYW5nZXMuZ2V0KCkuZmlsdGVyKGMgPT4gYy50eXBlICE9PSAndW5jaGFuZ2VkJykpO1xuXHRcdGlmICghY2hhbmdlcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmIChmaXJzdE9yTGFzdCkge1xuXHRcdFx0dGhpcy5ub3RlYm9va0RpZmZFZGl0b3IuZmlyc3RDaGFuZ2UoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5ub3RlYm9va0RpZmZFZGl0b3IubGFzdENoYW5nZSgpO1xuXHRcdH1cblx0fVxuXG5cdG5leHQoX3dyYXA6IGJvb2xlYW4pOiBib29sZWFuIHtcblx0XHRjb25zdCBjaGFuZ2VzID0gdGhpcy5jZWxsQ2hhbmdlcy5nZXQoKS5maWx0ZXIoYyA9PiAhYy5kaWZmLmdldCgpLmlkZW50aWNhbCkubGVuZ3RoO1xuXHRcdGlmICh0aGlzLm5vdGVib29rRGlmZkVkaXRvci5jdXJyZW50Q2hhbmdlZEluZGV4LmdldCgpID09PSBjaGFuZ2VzIC0gMSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHR0aGlzLm5vdGVib29rRGlmZkVkaXRvci5uZXh0Q2hhbmdlKCk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcmV2aW91cyhfd3JhcDogYm9vbGVhbik6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGNoYW5nZXMgPSB0aGlzLmNlbGxDaGFuZ2VzLmdldCgpLmZpbHRlcihjID0+ICFjLmRpZmYuZ2V0KCkuaWRlbnRpY2FsKS5sZW5ndGg7XG5cdFx0aWYgKHRoaXMubm90ZWJvb2tEaWZmRWRpdG9yLmN1cnJlbnRDaGFuZ2VkSW5kZXguZ2V0KCkgPT09IGNoYW5nZXMgLSAxKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHRoaXMubm90ZWJvb2tEaWZmRWRpdG9yLm5leHRDaGFuZ2UoKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGVuYWJsZUFjY2Vzc2libGVEaWZmVmlldygpOiB2b2lkIHtcblx0XHQvL1xuXHR9XG5cdGFjY2VwdE5lYXJlc3RDaGFuZ2UoY2hhbmdlOiBJTW9kaWZpZWRGaWxlRW50cnlDaGFuZ2VIdW5rKTogdm9pZCB7XG5cdFx0Y2hhbmdlLmFjY2VwdCgpO1xuXHRcdHRoaXMubmV4dCh0cnVlKTtcblx0fVxuXHRyZWplY3ROZWFyZXN0Q2hhbmdlKGNoYW5nZTogSU1vZGlmaWVkRmlsZUVudHJ5Q2hhbmdlSHVuayk6IHZvaWQge1xuXHRcdGNoYW5nZS5yZWplY3QoKTtcblx0XHR0aGlzLm5leHQodHJ1ZSk7XG5cdH1cblx0YXN5bmMgdG9nZ2xlRGlmZihfY2hhbmdlOiBJTW9kaWZpZWRGaWxlRW50cnlDaGFuZ2VIdW5rIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly9cblx0fVxufVxuXG5mdW5jdGlvbiBhcmVEb2N1bWVudERpZmYyRXF1YWwoZGlmZjE6IElEb2N1bWVudERpZmYyLCBkaWZmMjogSURvY3VtZW50RGlmZjIpOiBib29sZWFuIHtcblx0aWYgKGRpZmYxLmNoYW5nZXMgIT09IGRpZmYyLmNoYW5nZXMpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0aWYgKGRpZmYxLmlkZW50aWNhbCAhPT0gZGlmZjIuaWRlbnRpY2FsKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdGlmIChkaWZmMS5tb3ZlcyAhPT0gZGlmZjIubW92ZXMpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0aWYgKGRpZmYxLm9yaWdpbmFsTW9kZWwgIT09IGRpZmYyLm9yaWdpbmFsTW9kZWwpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0aWYgKGRpZmYxLm1vZGlmaWVkTW9kZWwgIT09IGRpZmYyLm1vZGlmaWVkTW9kZWwpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0aWYgKGRpZmYxLmtlZXAgIT09IGRpZmYyLmtlZXApIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0aWYgKGRpZmYxLnVuZG8gIT09IGRpZmYyLnVuZG8pIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0aWYgKGRpZmYxLnF1aXRFYXJseSAhPT0gZGlmZjIucXVpdEVhcmx5KSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBsYXN0Q2hhbmdlSW5kZXgoY2hhbmdlOiBJQ2VsbERpZmZJbmZvKTogbnVtYmVyIHtcblx0aWYgKGNoYW5nZS50eXBlID09PSAnbW9kaWZpZWQnKSB7XG5cdFx0cmV0dXJuIGNoYW5nZS5kaWZmLmdldCgpLmNoYW5nZXMubGVuZ3RoIC0gMTtcblx0fVxuXHRyZXR1cm4gMDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxZQUF5QixvQkFBb0I7QUFDdEQsU0FBUyxTQUEyQyxxQkFBcUIsdUJBQXVCO0FBQ2hHLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsYUFBYTtBQUN0QixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHFCQUFxQixtQ0FBbUM7QUFDakUsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsNkJBQTZCO0FBRXRDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsb0NBQW9DO0FBQzdDLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMscUNBQXFDO0FBRTlDLFNBQVMsdUNBQXdFO0FBQ2pGLFNBQVMsOEJBQThCO0FBR3ZDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMseUJBQXlCO0FBRWxDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsd0NBQXdEO0FBRWpFLFNBQVMsY0FBNkIsdUJBQXVCO0FBRXRELElBQU0sdUNBQU4sY0FBbUQsV0FBMEQ7QUFBQSxFQUduSCxZQUNDLFFBQ0EsUUFDQSxlQUNBLGVBQ0EsYUFDd0Msc0JBQ3ZDO0FBQ0QsVUFBTTtBQUZrQztBQUl4QyxVQUFNLGlCQUFpQixnQ0FBZ0MsTUFB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
