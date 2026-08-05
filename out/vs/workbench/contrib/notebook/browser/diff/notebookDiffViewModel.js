import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore, dispose } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { MultiDiffEditorItem } from "../../../multiDiffEditor/browser/multiDiffSourceResolverService.js";
import { DiffElementPlaceholderViewModel, NotebookDocumentMetadataViewModel, SideBySideDiffElementViewModel, SingleSideDiffElementViewModel } from "./diffElementViewModel.js";
import { NOTEBOOK_DIFF_ITEM_DIFF_STATE, NOTEBOOK_DIFF_ITEM_KIND } from "./notebookDiffEditorBrowser.js";
import { CellUri } from "../../common/notebookCommon.js";
import { raceCancellation } from "../../../../../base/common/async.js";
import { computeDiff } from "../../common/notebookDiff.js";
class NotebookDiffViewModel extends Disposable {
  constructor(model, notebookEditorWorkerService, configurationService, eventDispatcher, notebookService, diffEditorHeightCalculator, fontInfo, excludeUnchangedPlaceholder) {
    super();
    this.model = model;
    this.notebookEditorWorkerService = notebookEditorWorkerService;
    this.configurationService = configurationService;
    this.eventDispatcher = eventDispatcher;
    this.notebookService = notebookService;
    this.diffEditorHeightCalculator = diffEditorHeightCalculator;
    this.fontInfo = fontInfo;
    this.excludeUnchangedPlaceholder = excludeUnchangedPlaceholder;
    this.placeholderAndRelatedCells = /* @__PURE__ */ new Map();
    this._items = [];
    this._onDidChangeItems = this._register(new Emitter());
    this.onDidChangeItems = this._onDidChangeItems.event;
    this.disposables = this._register(new DisposableStore());
    this._onDidChange = this._register(new Emitter());
    this.diffEditorItems = [];
    this.onDidChange = this._onDidChange.event;
    this.originalCellViewModels = [];
    this.hideOutput = this.model.modified.notebook.transientOptions.transientOutputs || this.configurationService.getValue("notebook.diff.ignoreOutputs");
    this.ignoreMetadata = this.configurationService.getValue("notebook.diff.ignoreMetadata");
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      let triggerChange = false;
      let metadataChanged = false;
      if (e.affectsConfiguration("notebook.diff.ignoreMetadata")) {
        const newValue = this.configurationService.getValue("notebook.diff.ignoreMetadata");
        if (newValue !== void 0 && this.ignoreMetadata !== newValue) {
          this.ignoreMetadata = newValue;
          triggerChange = true;
          metadataChanged = true;
        }
      }
      if (e.affectsConfiguration("notebook.diff.ignoreOutputs")) {
        const newValue = this.configurationService.getValue("notebook.diff.ignoreOutputs");
        if (newValue !== void 0 && this.hideOutput !== (newValue || this.model.modified.notebook.transientOptions.transientOutputs)) {
          this.hideOutput = newValue || !!this.model.modified.notebook.transientOptions.transientOutputs;
          triggerChange = true;
        }
      }
      if (metadataChanged) {
        this.toggleNotebookMetadata();
      }
      if (triggerChange) {
        this._onDidChange.fire();
      }
    }));
  }
  get items() {
    return this._items;
  }
  get value() {
    return this.diffEditorItems.filter((item) => item.type !== "placeholder").filter((item) => {
      if (this._includeUnchanged) {
        return true;
      }
      if (item instanceof NotebookMultiDiffEditorCellItem) {
        return item.type === "unchanged" && item.containerType === "unchanged" ? false : true;
      }
      if (item instanceof NotebookMultiDiffEditorMetadataItem) {
        return item.type === "unchanged" && item.containerType === "unchanged" ? false : true;
      }
      if (item instanceof NotebookMultiDiffEditorOutputItem) {
        return item.type === "unchanged" && item.containerType === "unchanged" ? false : true;
      }
      return true;
    }).filter((item) => item instanceof NotebookMultiDiffEditorOutputItem ? !this.hideOutput : true).filter((item) => item instanceof NotebookMultiDiffEditorMetadataItem ? !this.ignoreMetadata : true);
  }
  get hasUnchangedCells() {
    return this._hasUnchangedCells === true;
  }
  get includeUnchanged() {
    return this._includeUnchanged === true;
  }
  set includeUnchanged(value) {
    this._includeUnchanged = value;
    this._onDidChange.fire();
  }
  dispose() {
    this.clear();
    super.dispose();
  }
  clear() {
    this.disposables.clear();
    dispose(Array.from(this.placeholderAndRelatedCells.keys()));
    this.placeholderAndRelatedCells.clear();
    dispose(this.originalCellViewModels);
    this.originalCellViewModels = [];
    dispose(this._items);
    this._items.splice(0, this._items.length);
  }
  async computeDiff(token) {
    const diffResult = await raceCancellation(this.notebookEditorWorkerService.computeDiff(this.model.original.resource, this.model.modified.resource), token);
    if (!diffResult || token.isCancellationRequested) {
      return;
    }
    prettyChanges(this.model.original.notebook, this.model.modified.notebook, diffResult.cellsDiff);
    const { cellDiffInfo, firstChangeIndex } = computeDiff(this.model.original.notebook, this.model.modified.notebook, diffResult);
    if (isEqual(cellDiffInfo, this.originalCellViewModels, this.model)) {
      return;
    } else {
      await raceCancellation(this.updateViewModels(cellDiffInfo, diffResult.metadataChanged, firstChangeIndex), token);
      if (token.isCancellationRequested) {
        return;
      }
      this.updateDiffEditorItems();
    }
  }
  toggleNotebookMetadata() {
    if (!this.notebookMetadataViewModel) {
      return;
    }
    if (this.ignoreMetadata) {
      if (this._items.length && this._items[0] === this.notebookMetadataViewModel) {
        this._items.splice(0, 1);
        this._onDidChangeItems.fire({ start: 0, deleteCount: 1, elements: [] });
      }
    } else {
      if (!this._items.length || this._items[0] !== this.notebookMetadataViewModel) {
        this._items.splice(0, 0, this.notebookMetadataViewModel);
        this._onDidChangeItems.fire({ start: 0, deleteCount: 0, elements: [this.notebookMetadataViewModel] });
      }
    }
  }
  updateDiffEditorItems() {
    this.diffEditorItems = [];
    const originalSourceUri = this.model.original.resource;
    const modifiedSourceUri = this.model.modified.resource;
    this._hasUnchangedCells = false;
    this.items.forEach((item) => {
      switch (item.type) {
        case "delete": {
          this.diffEditorItems.push(new NotebookMultiDiffEditorCellItem(item.original.uri, void 0, item.type, item.type));
          const originalMetadata = CellUri.generateCellPropertyUri(originalSourceUri, item.original.handle, Schemas.vscodeNotebookCellMetadata);
          this.diffEditorItems.push(new NotebookMultiDiffEditorMetadataItem(originalMetadata, void 0, item.type, item.type));
          const originalOutput = CellUri.generateCellPropertyUri(originalSourceUri, item.original.handle, Schemas.vscodeNotebookCellOutput);
          this.diffEditorItems.push(new NotebookMultiDiffEditorOutputItem(originalOutput, void 0, item.type, item.type));
          break;
        }
        case "insert": {
          this.diffEditorItems.push(new NotebookMultiDiffEditorCellItem(void 0, item.modified.uri, item.type, item.type));
          const modifiedMetadata = CellUri.generateCellPropertyUri(modifiedSourceUri, item.modified.handle, Schemas.vscodeNotebookCellMetadata);
          this.diffEditorItems.push(new NotebookMultiDiffEditorMetadataItem(void 0, modifiedMetadata, item.type, item.type));
          const modifiedOutput = CellUri.generateCellPropertyUri(modifiedSourceUri, item.modified.handle, Schemas.vscodeNotebookCellOutput);
          this.diffEditorItems.push(new NotebookMultiDiffEditorOutputItem(void 0, modifiedOutput, item.type, item.type));
          break;
        }
        case "modified": {
          const cellType = item.checkIfInputModified() ? item.type : "unchanged";
          const containerChanged = item.checkIfInputModified() || item.checkMetadataIfModified() || item.checkIfOutputsModified() ? item.type : "unchanged";
          this.diffEditorItems.push(new NotebookMultiDiffEditorCellItem(item.original.uri, item.modified.uri, cellType, containerChanged));
          const originalMetadata = CellUri.generateCellPropertyUri(originalSourceUri, item.original.handle, Schemas.vscodeNotebookCellMetadata);
          const modifiedMetadata = CellUri.generateCellPropertyUri(modifiedSourceUri, item.modified.handle, Schemas.vscodeNotebookCellMetadata);
          this.diffEditorItems.push(new NotebookMultiDiffEditorMetadataItem(originalMetadata, modifiedMetadata, item.checkMetadataIfModified() ? item.type : "unchanged", containerChanged));
          const originalOutput = CellUri.generateCellPropertyUri(originalSourceUri, item.original.handle, Schemas.vscodeNotebookCellOutput);
          const modifiedOutput = CellUri.generateCellPropertyUri(modifiedSourceUri, item.modified.handle, Schemas.vscodeNotebookCellOutput);
          this.diffEditorItems.push(new NotebookMultiDiffEditorOutputItem(originalOutput, modifiedOutput, item.checkIfOutputsModified() ? item.type : "unchanged", containerChanged));
          break;
        }
        case "unchanged": {
          this._hasUnchangedCells = true;
          this.diffEditorItems.push(new NotebookMultiDiffEditorCellItem(item.original.uri, item.modified.uri, item.type, item.type));
          const originalMetadata = CellUri.generateCellPropertyUri(originalSourceUri, item.original.handle, Schemas.vscodeNotebookCellMetadata);
          const modifiedMetadata = CellUri.generateCellPropertyUri(modifiedSourceUri, item.modified.handle, Schemas.vscodeNotebookCellMetadata);
          this.diffEditorItems.push(new NotebookMultiDiffEditorMetadataItem(originalMetadata, modifiedMetadata, item.type, item.type));
          const originalOutput = CellUri.generateCellPropertyUri(originalSourceUri, item.original.handle, Schemas.vscodeNotebookCellOutput);
          const modifiedOutput = CellUri.generateCellPropertyUri(modifiedSourceUri, item.modified.handle, Schemas.vscodeNotebookCellOutput);
          this.diffEditorItems.push(new NotebookMultiDiffEditorOutputItem(originalOutput, modifiedOutput, item.type, item.type));
          break;
        }
      }
    });
    this._onDidChange.fire();
  }
  async updateViewModels(cellDiffInfo, metadataChanged, firstChangeIndex) {
    const cellViewModels = await this.createDiffViewModels(cellDiffInfo, metadataChanged);
    const oldLength = this._items.length;
    this.clear();
    this._items.splice(0, oldLength);
    let placeholder = void 0;
    this.originalCellViewModels = cellViewModels;
    cellViewModels.forEach((vm, index) => {
      if (vm.type === "unchanged" && !this.excludeUnchangedPlaceholder) {
        if (!placeholder) {
          vm.displayIconToHideUnmodifiedCells = true;
          placeholder = new DiffElementPlaceholderViewModel(vm.mainDocumentTextModel, vm.editorEventDispatcher, vm.initData);
          this._items.push(placeholder);
          const placeholderItem = placeholder;
          this.disposables.add(placeholderItem.onUnfoldHiddenCells(() => {
            const hiddenCellViewModels2 = this.placeholderAndRelatedCells.get(placeholderItem);
            if (!Array.isArray(hiddenCellViewModels2)) {
              return;
            }
            const start = this._items.indexOf(placeholderItem);
            this._items.splice(start, 1, ...hiddenCellViewModels2);
            this._onDidChangeItems.fire({ start, deleteCount: 1, elements: hiddenCellViewModels2 });
          }));
          this.disposables.add(vm.onHideUnchangedCells(() => {
            const hiddenCellViewModels2 = this.placeholderAndRelatedCells.get(placeholderItem);
            if (!Array.isArray(hiddenCellViewModels2)) {
              return;
            }
            const start = this._items.indexOf(vm);
            this._items.splice(start, hiddenCellViewModels2.length, placeholderItem);
            this._onDidChangeItems.fire({ start, deleteCount: hiddenCellViewModels2.length, elements: [placeholderItem] });
          }));
        }
        const hiddenCellViewModels = this.placeholderAndRelatedCells.get(placeholder) || [];
        hiddenCellViewModels.push(vm);
        this.placeholderAndRelatedCells.set(placeholder, hiddenCellViewModels);
        placeholder.hiddenCells.push(vm);
      } else {
        placeholder = void 0;
        this._items.push(vm);
      }
    });
    this._onDidChangeItems.fire({ start: 0, deleteCount: oldLength, elements: this._items, firstChangeIndex });
  }
  async createDiffViewModels(computedCellDiffs, metadataChanged) {
    const originalModel = this.model.original.notebook;
    const modifiedModel = this.model.modified.notebook;
    const initData = {
      metadataStatusHeight: this.configurationService.getValue("notebook.diff.ignoreMetadata") ? 0 : 25,
      outputStatusHeight: this.configurationService.getValue("notebook.diff.ignoreOutputs") || !!modifiedModel.transientOptions.transientOutputs ? 0 : 25,
      fontInfo: this.fontInfo
    };
    const viewModels = [];
    this.notebookMetadataViewModel = this._register(new NotebookDocumentMetadataViewModel(this.model.original.notebook, this.model.modified.notebook, metadataChanged ? "modifiedMetadata" : "unchangedMetadata", this.eventDispatcher, initData, this.notebookService, this.diffEditorHeightCalculator));
    if (!this.ignoreMetadata) {
      if (metadataChanged) {
        await this.notebookMetadataViewModel.computeHeights();
      }
      viewModels.push(this.notebookMetadataViewModel);
    }
    const cellViewModels = await Promise.all(computedCellDiffs.map(async (diff) => {
      switch (diff.type) {
        case "delete": {
          return new SingleSideDiffElementViewModel(
            originalModel,
            modifiedModel,
            originalModel.cells[diff.originalCellIndex],
            void 0,
            "delete",
            this.eventDispatcher,
            initData,
            this.notebookService,
            this.configurationService,
            this.diffEditorHeightCalculator,
            diff.originalCellIndex
          );
        }
        case "insert": {
          return new SingleSideDiffElementViewModel(
            modifiedModel,
            originalModel,
            void 0,
            modifiedModel.cells[diff.modifiedCellIndex],
            "insert",
            this.eventDispatcher,
            initData,
            this.notebookService,
            this.configurationService,
            this.diffEditorHeightCalculator,
            diff.modifiedCellIndex
          );
        }
        case "modified": {
          const viewModel = new SideBySideDiffElementViewModel(
            this.model.modified.notebook,
            this.model.original.notebook,
            originalModel.cells[diff.originalCellIndex],
            modifiedModel.cells[diff.modifiedCellIndex],
            "modified",
            this.eventDispatcher,
            initData,
            this.notebookService,
            this.configurationService,
            diff.originalCellIndex,
            this.diffEditorHeightCalculator
          );
          await viewModel.computeEditorHeights();
          return viewModel;
        }
        case "unchanged": {
          return new SideBySideDiffElementViewModel(
            this.model.modified.notebook,
            this.model.original.notebook,
            originalModel.cells[diff.originalCellIndex],
            modifiedModel.cells[diff.modifiedCellIndex],
            "unchanged",
            this.eventDispatcher,
            initData,
            this.notebookService,
            this.configurationService,
            diff.originalCellIndex,
            this.diffEditorHeightCalculator
          );
        }
      }
    }));
    cellViewModels.forEach((vm) => viewModels.push(vm));
    return viewModels;
  }
}
function prettyChanges(original, modified, diffResult) {
  const changes = diffResult.changes;
  for (let i = 0; i < diffResult.changes.length - 1; i++) {
    const curr = changes[i];
    const next = changes[i + 1];
    const x = curr.originalStart;
    const y = curr.modifiedStart;
    if (curr.originalLength === 1 && curr.modifiedLength === 0 && next.originalStart === x + 2 && next.originalLength === 0 && next.modifiedStart === y + 1 && next.modifiedLength === 1 && original.cells[x].getHashValue() === modified.cells[y + 1].getHashValue() && original.cells[x + 1].getHashValue() === modified.cells[y].getHashValue()) {
      curr.originalStart = x;
      curr.originalLength = 0;
      curr.modifiedStart = y;
      curr.modifiedLength = 1;
      next.originalStart = x + 1;
      next.originalLength = 1;
      next.modifiedStart = y + 2;
      next.modifiedLength = 0;
      i++;
    }
  }
}
function isEqual(cellDiffInfo, viewModels, model) {
  if (cellDiffInfo.length !== viewModels.length) {
    return false;
  }
  const originalModel = model.original.notebook;
  const modifiedModel = model.modified.notebook;
  for (let i = 0; i < viewModels.length; i++) {
    const a = cellDiffInfo[i];
    const b = viewModels[i];
    if (a.type !== b.type) {
      return false;
    }
    switch (a.type) {
      case "delete": {
        if (originalModel.cells[a.originalCellIndex].handle !== b.original?.handle) {
          return false;
        }
        continue;
      }
      case "insert": {
        if (modifiedModel.cells[a.modifiedCellIndex].handle !== b.modified?.handle) {
          return false;
        }
        continue;
      }
      default: {
        if (originalModel.cells[a.originalCellIndex].handle !== b.original?.handle) {
          return false;
        }
        if (modifiedModel.cells[a.modifiedCellIndex].handle !== b.modified?.handle) {
          return false;
        }
        continue;
      }
    }
  }
  return true;
}
class NotebookMultiDiffEditorItem extends MultiDiffEditorItem {
  constructor(originalUri, modifiedUri, goToFileUri, type, containerType, kind, contextKeys) {
    super(originalUri, modifiedUri, goToFileUri, contextKeys);
    this.type = type;
    this.containerType = containerType;
    this.kind = kind;
  }
}
class NotebookMultiDiffEditorCellItem extends NotebookMultiDiffEditorItem {
  constructor(originalUri, modifiedUri, type, containerType) {
    super(originalUri, modifiedUri, modifiedUri || originalUri, type, containerType, "Cell", {
      [NOTEBOOK_DIFF_ITEM_KIND.key]: "Cell",
      [NOTEBOOK_DIFF_ITEM_DIFF_STATE.key]: type
    });
  }
}
class NotebookMultiDiffEditorMetadataItem extends NotebookMultiDiffEditorItem {
  constructor(originalUri, modifiedUri, type, containerType) {
    super(originalUri, modifiedUri, modifiedUri || originalUri, type, containerType, "Metadata", {
      [NOTEBOOK_DIFF_ITEM_KIND.key]: "Metadata",
      [NOTEBOOK_DIFF_ITEM_DIFF_STATE.key]: type
    });
  }
}
class NotebookMultiDiffEditorOutputItem extends NotebookMultiDiffEditorItem {
  constructor(originalUri, modifiedUri, type, containerType) {
    super(originalUri, modifiedUri, modifiedUri || originalUri, type, containerType, "Output", {
      [NOTEBOOK_DIFF_ITEM_KIND.key]: "Output",
      [NOTEBOOK_DIFF_ITEM_DIFF_STATE.key]: type
    });
  }
}
export {
  NotebookDiffViewModel,
  NotebookMultiDiffEditorItem,
  prettyChanges
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2RpZmYvbm90ZWJvb2tEaWZmVmlld01vZGVsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSURpZmZSZXN1bHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9kaWZmL2RpZmYuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgdHlwZSBJVmFsdWVXaXRoQ2hhbmdlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHR5cGUgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRm9udEluZm8gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9mb250SW5mby5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB0eXBlIHsgQ29udGV4dEtleVZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBNdWx0aURpZmZFZGl0b3JJdGVtIH0gZnJvbSAnLi4vLi4vLi4vbXVsdGlEaWZmRWRpdG9yL2Jyb3dzZXIvbXVsdGlEaWZmU291cmNlUmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IERpZmZFbGVtZW50Q2VsbFZpZXdNb2RlbEJhc2UsIERpZmZFbGVtZW50UGxhY2Vob2xkZXJWaWV3TW9kZWwsIElEaWZmRWxlbWVudFZpZXdNb2RlbEJhc2UsIE5vdGVib29rRG9jdW1lbnRNZXRhZGF0YVZpZXdNb2RlbCwgU2lkZUJ5U2lkZURpZmZFbGVtZW50Vmlld01vZGVsLCBTaW5nbGVTaWRlRGlmZkVsZW1lbnRWaWV3TW9kZWwgfSBmcm9tICcuL2RpZmZFbGVtZW50Vmlld01vZGVsLmpzJztcbmltcG9ydCB7IE5vdGVib29rRGlmZkVkaXRvckV2ZW50RGlzcGF0Y2hlciB9IGZyb20gJy4vZXZlbnREaXNwYXRjaGVyLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0RpZmZWaWV3TW9kZWwsIElOb3RlYm9va0RpZmZWaWV3TW9kZWxVcGRhdGVFdmVudCwgTk9URUJPT0tfRElGRl9JVEVNX0RJRkZfU1RBVEUsIE5PVEVCT09LX0RJRkZfSVRFTV9LSU5EIH0gZnJvbSAnLi9ub3RlYm9va0RpZmZFZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IE5vdGVib29rVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL21vZGVsL25vdGVib29rVGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IENlbGxVcmksIElOb3RlYm9va0RpZmZFZGl0b3JNb2RlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tFZGl0b3JXb3JrZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NlcnZpY2VzL25vdGVib29rV29ya2VyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRGlmZkVkaXRvckhlaWdodENhbGN1bGF0b3JTZXJ2aWNlIH0gZnJvbSAnLi9lZGl0b3JIZWlnaHRDYWxjdWxhdG9yLmpzJztcbmltcG9ydCB7IHJhY2VDYW5jZWxsYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBjb21wdXRlRGlmZiB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0RpZmYuanMnO1xuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tEaWZmVmlld01vZGVsIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElOb3RlYm9va0RpZmZWaWV3TW9kZWwsIElWYWx1ZVdpdGhDaGFuZ2VFdmVudDxyZWFkb25seSBNdWx0aURpZmZFZGl0b3JJdGVtW10+IHtcblx0cHJpdmF0ZSByZWFkb25seSBwbGFjZWhvbGRlckFuZFJlbGF0ZWRDZWxscyA9IG5ldyBNYXA8RGlmZkVsZW1lbnRQbGFjZWhvbGRlclZpZXdNb2RlbCwgRGlmZkVsZW1lbnRDZWxsVmlld01vZGVsQmFzZVtdPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pdGVtczogSURpZmZFbGVtZW50Vmlld01vZGVsQmFzZVtdID0gW107XG5cdGdldCBpdGVtcygpOiByZWFkb25seSBJRGlmZkVsZW1lbnRWaWV3TW9kZWxCYXNlW10ge1xuXHRcdHJldHVybiB0aGlzLl9pdGVtcztcblx0fVxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUl0ZW1zID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SU5vdGVib29rRGlmZlZpZXdNb2RlbFVwZGF0ZUV2ZW50PigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlSXRlbXMgPSB0aGlzLl9vbkRpZENoYW5nZUl0ZW1zLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IGRpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cHJpdmF0ZSBkaWZmRWRpdG9ySXRlbXM6IE5vdGVib29rTXVsdGlEaWZmRWRpdG9ySXRlbVtdID0gW107XG5cdHB1YmxpYyBvbkRpZENoYW5nZSA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXHRwcml2YXRlIG5vdGVib29rTWV0YWRhdGFWaWV3TW9kZWw/OiBOb3RlYm9va0RvY3VtZW50TWV0YWRhdGFWaWV3TW9kZWw7XG5cdGdldCB2YWx1ZSgpOiByZWFkb25seSBOb3RlYm9va011bHRpRGlmZkVkaXRvckl0ZW1bXSB7XG5cdFx0cmV0dXJuIHRoaXMuZGlmZkVkaXRvckl0ZW1zXG5cdFx0XHQuZmlsdGVyKGl0ZW0gPT4gaXRlbS50eXBlICE9PSAncGxhY2Vob2xkZXInKVxuXHRcdFx0LmZpbHRlcihpdGVtID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuX2luY2x1ZGVVbmNoYW5nZWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoaXRlbSBpbnN0YW5jZW9mIE5vdGVib29rTXVsdGlEaWZmRWRpdG9yQ2VsbEl0ZW0pIHtcblx0XHRcdFx0XHRyZXR1cm4gaXRlbS50eXBlID09PSAndW5jaGFuZ2VkJyAmJiBpdGVtLmNvbnRhaW5lclR5cGUgPT09ICd1bmNoYW5nZWQnID8gZmFsc2UgOiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChpdGVtIGluc3RhbmNlb2YgTm90ZWJvb2tNdWx0aURpZmZFZGl0b3JNZXRhZGF0YUl0ZW0pIHtcblx0XHRcdFx0XHRyZXR1cm4gaXRlbS50eXBlID09PSAndW5jaGFuZ2VkJyAmJiBpdGVtLmNvbnRhaW5lclR5cGUgPT09ICd1bmNoYW5nZWQnID8gZmFsc2UgOiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChpdGVtIGluc3RhbmNlb2YgTm90ZWJvb2tNdWx0aURpZmZFZGl0b3JPdXRwdXRJdGVtKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGl0ZW0udHlwZSA9PT0gJ3VuY2hhbmdlZCcgJiYgaXRlbS5jb250YWluZXJUeXBlID09PSAndW5jaGFuZ2VkJyA/IGZhbHNlIDogdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0pXG5cdFx0XHQuZmlsdGVyKGl0ZW0gPT4gaXRlbSBpbnN0YW5jZW9mIE5vdGVib29rTXVsdGlEaWZmRWRpdG9yT3V0cHV0SXRlbSA/ICF0aGlzLmhpZGVPdXRwdXQgOiB0cnVlKVxuXHRcdFx0LmZpbHRlcihpdGVtID0+IGl0ZW0gaW5zdGFuY2VvZiBOb3RlYm9va011bHRpRGlmZkVkaXRvck1ldGFkYXRhSXRlbSA/ICF0aGlzLmlnbm9yZU1ldGFkYXRhIDogdHJ1ZSk7XG5cdH1cblxuXHRwcml2YXRlIF9oYXNVbmNoYW5nZWRDZWxscz86IGJvb2xlYW47XG5cdHB1YmxpYyBnZXQgaGFzVW5jaGFuZ2VkQ2VsbHMoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2hhc1VuY2hhbmdlZENlbGxzID09PSB0cnVlO1xuXHR9XG5cdHByaXZhdGUgX2luY2x1ZGVVbmNoYW5nZWQ/OiBib29sZWFuO1xuXHRwdWJsaWMgZ2V0IGluY2x1ZGVVbmNoYW5nZWQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2luY2x1ZGVVbmNoYW5nZWQgPT09IHRydWU7XG5cdH1cblx0cHVibGljIHNldCBpbmNsdWRlVW5jaGFuZ2VkKHZhbHVlKSB7XG5cdFx0dGhpcy5faW5jbHVkZVVuY2hhbmdlZCA9IHZhbHVlO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoKTtcblx0fVxuXHRwcml2YXRlIGhpZGVPdXRwdXQ/OiBib29sZWFuO1xuXHRwcml2YXRlIGlnbm9yZU1ldGFkYXRhPzogYm9vbGVhbjtcblxuXHRwcml2YXRlIG9yaWdpbmFsQ2VsbFZpZXdNb2RlbHM6IElEaWZmRWxlbWVudFZpZXdNb2RlbEJhc2VbXSA9IFtdO1xuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IG1vZGVsOiBJTm90ZWJvb2tEaWZmRWRpdG9yTW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBub3RlYm9va0VkaXRvcldvcmtlclNlcnZpY2U6IElOb3RlYm9va0VkaXRvcldvcmtlclNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZXZlbnREaXNwYXRjaGVyOiBOb3RlYm9va0RpZmZFZGl0b3JFdmVudERpc3BhdGNoZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBub3RlYm9va1NlcnZpY2U6IElOb3RlYm9va1NlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBkaWZmRWRpdG9ySGVpZ2h0Q2FsY3VsYXRvcjogSURpZmZFZGl0b3JIZWlnaHRDYWxjdWxhdG9yU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGZvbnRJbmZvPzogRm9udEluZm8sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBleGNsdWRlVW5jaGFuZ2VkUGxhY2Vob2xkZXI/OiBib29sZWFuLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuaGlkZU91dHB1dCA9IHRoaXMubW9kZWwubW9kaWZpZWQubm90ZWJvb2sudHJhbnNpZW50T3B0aW9ucy50cmFuc2llbnRPdXRwdXRzIHx8IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ25vdGVib29rLmRpZmYuaWdub3JlT3V0cHV0cycpO1xuXHRcdHRoaXMuaWdub3JlTWV0YWRhdGEgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdub3RlYm9vay5kaWZmLmlnbm9yZU1ldGFkYXRhJyk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGxldCB0cmlnZ2VyQ2hhbmdlID0gZmFsc2U7XG5cdFx0XHRsZXQgbWV0YWRhdGFDaGFuZ2VkID0gZmFsc2U7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignbm90ZWJvb2suZGlmZi5pZ25vcmVNZXRhZGF0YScpKSB7XG5cdFx0XHRcdGNvbnN0IG5ld1ZhbHVlID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPignbm90ZWJvb2suZGlmZi5pZ25vcmVNZXRhZGF0YScpO1xuXG5cdFx0XHRcdGlmIChuZXdWYWx1ZSAhPT0gdW5kZWZpbmVkICYmIHRoaXMuaWdub3JlTWV0YWRhdGEgIT09IG5ld1ZhbHVlKSB7XG5cdFx0XHRcdFx0dGhpcy5pZ25vcmVNZXRhZGF0YSA9IG5ld1ZhbHVlO1xuXHRcdFx0XHRcdHRyaWdnZXJDaGFuZ2UgPSB0cnVlO1xuXHRcdFx0XHRcdG1ldGFkYXRhQ2hhbmdlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ25vdGVib29rLmRpZmYuaWdub3JlT3V0cHV0cycpKSB7XG5cdFx0XHRcdGNvbnN0IG5ld1ZhbHVlID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPignbm90ZWJvb2suZGlmZi5pZ25vcmVPdXRwdXRzJyk7XG5cblx0XHRcdFx0aWYgKG5ld1ZhbHVlICE9PSB1bmRlZmluZWQgJiYgdGhpcy5oaWRlT3V0cHV0ICE9PSAobmV3VmFsdWUgfHwgdGhpcy5tb2RlbC5tb2RpZmllZC5ub3RlYm9vay50cmFuc2llbnRPcHRpb25zLnRyYW5zaWVudE91dHB1dHMpKSB7XG5cdFx0XHRcdFx0dGhpcy5oaWRlT3V0cHV0ID0gbmV3VmFsdWUgfHwgISEodGhpcy5tb2RlbC5tb2RpZmllZC5ub3RlYm9vay50cmFuc2llbnRPcHRpb25zLnRyYW5zaWVudE91dHB1dHMpO1xuXHRcdFx0XHRcdHRyaWdnZXJDaGFuZ2UgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChtZXRhZGF0YUNoYW5nZWQpIHtcblx0XHRcdFx0dGhpcy50b2dnbGVOb3RlYm9va01ldGFkYXRhKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodHJpZ2dlckNoYW5nZSkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0dGhpcy5jbGVhcigpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXHRwcml2YXRlIGNsZWFyKCkge1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRkaXNwb3NlKEFycmF5LmZyb20odGhpcy5wbGFjZWhvbGRlckFuZFJlbGF0ZWRDZWxscy5rZXlzKCkpKTtcblx0XHR0aGlzLnBsYWNlaG9sZGVyQW5kUmVsYXRlZENlbGxzLmNsZWFyKCk7XG5cdFx0ZGlzcG9zZSh0aGlzLm9yaWdpbmFsQ2VsbFZpZXdNb2RlbHMpO1xuXHRcdHRoaXMub3JpZ2luYWxDZWxsVmlld01vZGVscyA9IFtdO1xuXHRcdGRpc3Bvc2UodGhpcy5faXRlbXMpO1xuXHRcdHRoaXMuX2l0ZW1zLnNwbGljZSgwLCB0aGlzLl9pdGVtcy5sZW5ndGgpO1xuXHR9XG5cblx0YXN5bmMgY29tcHV0ZURpZmYodG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGlmZlJlc3VsdCA9IGF3YWl0IHJhY2VDYW5jZWxsYXRpb24odGhpcy5ub3RlYm9va0VkaXRvcldvcmtlclNlcnZpY2UuY29tcHV0ZURpZmYodGhpcy5tb2RlbC5vcmlnaW5hbC5yZXNvdXJjZSwgdGhpcy5tb2RlbC5tb2RpZmllZC5yZXNvdXJjZSksIHRva2VuKTtcblx0XHRpZiAoIWRpZmZSZXN1bHQgfHwgdG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdC8vIGFmdGVyIGF3YWl0IHRoZSBlZGl0b3IgbWlnaHQgYmUgZGlzcG9zZWQuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cHJldHR5Q2hhbmdlcyh0aGlzLm1vZGVsLm9yaWdpbmFsLm5vdGVib29rLCB0aGlzLm1vZGVsLm1vZGlmaWVkLm5vdGVib29rLCBkaWZmUmVzdWx0LmNlbGxzRGlmZik7XG5cblx0XHRjb25zdCB7IGNlbGxEaWZmSW5mbywgZmlyc3RDaGFuZ2VJbmRleCB9ID0gY29tcHV0ZURpZmYodGhpcy5tb2RlbC5vcmlnaW5hbC5ub3RlYm9vaywgdGhpcy5tb2RlbC5tb2RpZmllZC5ub3RlYm9vaywgZGlmZlJlc3VsdCk7XG5cdFx0aWYgKGlzRXF1YWwoY2VsbERpZmZJbmZvLCB0aGlzLm9yaWdpbmFsQ2VsbFZpZXdNb2RlbHMsIHRoaXMubW9kZWwpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fSBlbHNlIHtcblx0XHRcdGF3YWl0IHJhY2VDYW5jZWxsYXRpb24odGhpcy51cGRhdGVWaWV3TW9kZWxzKGNlbGxEaWZmSW5mbywgZGlmZlJlc3VsdC5tZXRhZGF0YUNoYW5nZWQsIGZpcnN0Q2hhbmdlSW5kZXgpLCB0b2tlbik7XG5cdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy51cGRhdGVEaWZmRWRpdG9ySXRlbXMoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHRvZ2dsZU5vdGVib29rTWV0YWRhdGEoKSB7XG5cdFx0aWYgKCF0aGlzLm5vdGVib29rTWV0YWRhdGFWaWV3TW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5pZ25vcmVNZXRhZGF0YSkge1xuXHRcdFx0aWYgKHRoaXMuX2l0ZW1zLmxlbmd0aCAmJiB0aGlzLl9pdGVtc1swXSA9PT0gdGhpcy5ub3RlYm9va01ldGFkYXRhVmlld01vZGVsKSB7XG5cdFx0XHRcdHRoaXMuX2l0ZW1zLnNwbGljZSgwLCAxKTtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VJdGVtcy5maXJlKHsgc3RhcnQ6IDAsIGRlbGV0ZUNvdW50OiAxLCBlbGVtZW50czogW10gfSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICghdGhpcy5faXRlbXMubGVuZ3RoIHx8IHRoaXMuX2l0ZW1zWzBdICE9PSB0aGlzLm5vdGVib29rTWV0YWRhdGFWaWV3TW9kZWwpIHtcblx0XHRcdFx0dGhpcy5faXRlbXMuc3BsaWNlKDAsIDAsIHRoaXMubm90ZWJvb2tNZXRhZGF0YVZpZXdNb2RlbCk7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlSXRlbXMuZmlyZSh7IHN0YXJ0OiAwLCBkZWxldGVDb3VudDogMCwgZWxlbWVudHM6IFt0aGlzLm5vdGVib29rTWV0YWRhdGFWaWV3TW9kZWxdIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRwcml2YXRlIHVwZGF0ZURpZmZFZGl0b3JJdGVtcygpIHtcblx0XHR0aGlzLmRpZmZFZGl0b3JJdGVtcyA9IFtdO1xuXHRcdGNvbnN0IG9yaWdpbmFsU291cmNlVXJpID0gdGhpcy5tb2RlbC5vcmlnaW5hbC5yZXNvdXJjZSE7XG5cdFx0Y29uc3QgbW9kaWZpZWRTb3VyY2VVcmkgPSB0aGlzLm1vZGVsLm1vZGlmaWVkLnJlc291cmNlITtcblx0XHR0aGlzLl9oYXNVbmNoYW5nZWRDZWxscyA9IGZhbHNlO1xuXHRcdHRoaXMuaXRlbXMuZm9yRWFjaChpdGVtID0+IHtcblx0XHRcdHN3aXRjaCAoaXRlbS50eXBlKSB7XG5cdFx0XHRcdGNhc2UgJ2RlbGV0ZSc6IHtcblx0XHRcdFx0XHR0aGlzLmRpZmZFZGl0b3JJdGVtcy5wdXNoKG5ldyBOb3RlYm9va011bHRpRGlmZkVkaXRvckNlbGxJdGVtKGl0ZW0ub3JpZ2luYWwhLnVyaSwgdW5kZWZpbmVkLCBpdGVtLnR5cGUsIGl0ZW0udHlwZSkpO1xuXHRcdFx0XHRcdGNvbnN0IG9yaWdpbmFsTWV0YWRhdGEgPSBDZWxsVXJpLmdlbmVyYXRlQ2VsbFByb3BlcnR5VXJpKG9yaWdpbmFsU291cmNlVXJpLCBpdGVtLm9yaWdpbmFsIS5oYW5kbGUsIFNjaGVtYXMudnNjb2RlTm90ZWJvb2tDZWxsTWV0YWRhdGEpO1xuXHRcdFx0XHRcdHRoaXMuZGlmZkVkaXRvckl0ZW1zLnB1c2gobmV3IE5vdGVib29rTXVsdGlEaWZmRWRpdG9yTWV0YWRhdGFJdGVtKG9yaWdpbmFsTWV0YWRhdGEsIHVuZGVmaW5lZCwgaXRlbS50eXBlLCBpdGVtLnR5cGUpKTtcblx0XHRcdFx0XHRjb25zdCBvcmlnaW5hbE91dHB1dCA9IENlbGxVcmkuZ2VuZXJhdGVDZWxsUHJvcGVydHlVcmkob3JpZ2luYWxTb3VyY2VVcmksIGl0ZW0ub3JpZ2luYWwhLmhhbmRsZSwgU2NoZW1hcy52c2NvZGVOb3RlYm9va0NlbGxPdXRwdXQpO1xuXHRcdFx0XHRcdHRoaXMuZGlmZkVkaXRvckl0ZW1zLnB1c2gobmV3IE5vdGVib29rTXVsdGlEaWZmRWRpdG9yT3V0cHV0SXRlbShvcmlnaW5hbE91dHB1dCwgdW5kZWZpbmVkLCBpdGVtLnR5cGUsIGl0ZW0udHlwZSkpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgJ2luc2VydCc6IHtcblx0XHRcdFx0XHR0aGlzLmRpZmZFZGl0b3JJdGVtcy5wdXNoKG5ldyBOb3RlYm9va011bHRpRGlmZkVkaXRvckNlbGxJdGVtKHVuZGVmaW5lZCwgaXRlbS5tb2RpZmllZCEudXJpLCBpdGVtLnR5cGUsIGl0ZW0udHlwZSkpO1xuXHRcdFx0XHRcdGNvbnN0IG1vZGlmaWVkTWV0YWRhdGEgPSBDZWxsVXJpLmdlbmVyYXRlQ2VsbFByb3BlcnR5VXJpKG1vZGlmaWVkU291cmNlVXJpLCBpdGVtLm1vZGlmaWVkIS5oYW5kbGUsIFNjaGVtYXMudnNjb2RlTm90ZWJvb2tDZWxsTWV0YWRhdGEpO1xuXHRcdFx0XHRcdHRoaXMuZGlmZkVkaXRvckl0ZW1zLnB1c2gobmV3IE5vdGVib29rTXVsdGlEaWZmRWRpdG9yTWV0YWRhdGFJdGVtKHVuZGVmaW5lZCwgbW9kaWZpZWRNZXRhZGF0YSwgaXRlbS50eXBlLCBpdGVtLnR5cGUpKTtcblx0XHRcdFx0XHRjb25zdCBtb2RpZmllZE91dHB1dCA9IENlbGxVcmkuZ2VuZXJhdGVDZWxsUHJvcGVydHlVcmkobW9kaWZpZWRTb3VyY2VVcmksIGl0ZW0ubW9kaWZpZWQhLmhhbmRsZSwgU2NoZW1hcy52c2NvZGVOb3RlYm9va0NlbGxPdXRwdXQpO1xuXHRcdFx0XHRcdHRoaXMuZGlmZkVkaXRvckl0ZW1zLnB1c2gobmV3IE5vdGVib29rTXVsdGlEaWZmRWRpdG9yT3V0cHV0SXRlbSh1bmRlZmluZWQsIG1vZGlmaWVkT3V0cHV0LCBpdGVtLnR5cGUsIGl0ZW0udHlwZSkpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgJ21vZGlmaWVkJzoge1xuXHRcdFx0XHRcdGNvbnN0IGNlbGxUeXBlID0gaXRlbS5jaGVja0lmSW5wdXRNb2RpZmllZCgpID8gaXRlbS50eXBlIDogJ3VuY2hhbmdlZCc7XG5cdFx0XHRcdFx0Y29uc3QgY29udGFpbmVyQ2hhbmdlZCA9IChpdGVtLmNoZWNrSWZJbnB1dE1vZGlmaWVkKCkgfHwgaXRlbS5jaGVja01ldGFkYXRhSWZNb2RpZmllZCgpIHx8IGl0ZW0uY2hlY2tJZk91dHB1dHNNb2RpZmllZCgpKSA/IGl0ZW0udHlwZSA6ICd1bmNoYW5nZWQnO1xuXHRcdFx0XHRcdHRoaXMuZGlmZkVkaXRvckl0ZW1zLnB1c2gobmV3IE5vdGVib29rTXVsdGlEaWZmRWRpdG9yQ2VsbEl0ZW0oaXRlbS5vcmlnaW5hbCEudXJpLCBpdGVtLm1vZGlmaWVkIS51cmksIGNlbGxUeXBlLCBjb250YWluZXJDaGFuZ2VkKSk7XG5cdFx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxNZXRhZGF0YSA9IENlbGxVcmkuZ2VuZXJhdGVDZWxsUHJvcGVydHlVcmkob3JpZ2luYWxTb3VyY2VVcmksIGl0ZW0ub3JpZ2luYWwhLmhhbmRsZSwgU2NoZW1hcy52c2NvZGVOb3RlYm9va0NlbGxNZXRhZGF0YSk7XG5cdFx0XHRcdFx0Y29uc3QgbW9kaWZpZWRNZXRhZGF0YSA9IENlbGxVcmkuZ2VuZXJhdGVDZWxsUHJvcGVydHlVcmkobW9kaWZpZWRTb3VyY2VVcmksIGl0ZW0ubW9kaWZpZWQhLmhhbmRsZSwgU2NoZW1hcy52c2NvZGVOb3RlYm9va0NlbGxNZXRhZGF0YSk7XG5cdFx0XHRcdFx0dGhpcy5kaWZmRWRpdG9ySXRlbXMucHVzaChuZXcgTm90ZWJvb2tNdWx0aURpZmZFZGl0b3JNZXRhZGF0YUl0ZW0ob3JpZ2luYWxNZXRhZGF0YSwgbW9kaWZpZWRNZXRhZGF0YSwgaXRlbS5jaGVja01ldGFkYXRhSWZNb2RpZmllZCgpID8gaXRlbS50eXBlIDogJ3VuY2hhbmdlZCcsIGNvbnRhaW5lckNoYW5nZWQpKTtcblx0XHRcdFx0XHRjb25zdCBvcmlnaW5hbE91dHB1dCA9IENlbGxVcmkuZ2VuZXJhdGVDZWxsUHJvcGVydHlVcmkob3JpZ2luYWxTb3VyY2VVcmksIGl0ZW0ub3JpZ2luYWwhLmhhbmRsZSwgU2NoZW1hcy52c2NvZGVOb3RlYm9va0NlbGxPdXRwdXQpO1xuXHRcdFx0XHRcdGNvbnN0IG1vZGlmaWVkT3V0cHV0ID0gQ2VsbFVyaS5nZW5lcmF0ZUNlbGxQcm9wZXJ0eVVyaShtb2RpZmllZFNvdXJjZVVyaSwgaXRlbS5tb2RpZmllZCEuaGFuZGxlLCBTY2hlbWFzLnZzY29kZU5vdGVib29rQ2VsbE91dHB1dCk7XG5cdFx0XHRcdFx0dGhpcy5kaWZmRWRpdG9ySXRlbXMucHVzaChuZXcgTm90ZWJvb2tNdWx0aURpZmZFZGl0b3JPdXRwdXRJdGVtKG9yaWdpbmFsT3V0cHV0LCBtb2RpZmllZE91dHB1dCwgaXRlbS5jaGVja0lmT3V0cHV0c01vZGlmaWVkKCkgPyBpdGVtLnR5cGUgOiAndW5jaGFuZ2VkJywgY29udGFpbmVyQ2hhbmdlZCkpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgJ3VuY2hhbmdlZCc6IHtcblx0XHRcdFx0XHR0aGlzLl9oYXNVbmNoYW5nZWRDZWxscyA9IHRydWU7XG5cdFx0XHRcdFx0dGhpcy5kaWZmRWRpdG9ySXRlbXMucHVzaChuZXcgTm90ZWJvb2tNdWx0aURpZmZFZGl0b3JDZWxsSXRlbShpdGVtLm9yaWdpbmFsIS51cmksIGl0ZW0ubW9kaWZpZWQhLnVyaSwgaXRlbS50eXBlLCBpdGVtLnR5cGUpKTtcblx0XHRcdFx0XHRjb25zdCBvcmlnaW5hbE1ldGFkYXRhID0gQ2VsbFVyaS5nZW5lcmF0ZUNlbGxQcm9wZXJ0eVVyaShvcmlnaW5hbFNvdXJjZVVyaSwgaXRlbS5vcmlnaW5hbCEuaGFuZGxlLCBTY2hlbWFzLnZzY29kZU5vdGVib29rQ2VsbE1ldGFkYXRhKTtcblx0XHRcdFx0XHRjb25zdCBtb2RpZmllZE1ldGFkYXRhID0gQ2VsbFVyaS5nZW5lcmF0ZUNlbGxQcm9wZXJ0eVVyaShtb2RpZmllZFNvdXJjZVVyaSwgaXRlbS5tb2RpZmllZCEuaGFuZGxlLCBTY2hlbWFzLnZzY29kZU5vdGVib29rQ2VsbE1ldGFkYXRhKTtcblx0XHRcdFx0XHR0aGlzLmRpZmZFZGl0b3JJdGVtcy5wdXNoKG5ldyBOb3RlYm9va011bHRpRGlmZkVkaXRvck1ldGFkYXRhSXRlbShvcmlnaW5hbE1ldGFkYXRhLCBtb2RpZmllZE1ldGFkYXRhLCBpdGVtLnR5cGUsIGl0ZW0udHlwZSkpO1xuXHRcdFx0XHRcdGNvbnN0IG9yaWdpbmFsT3V0cHV0ID0gQ2VsbFVyaS5nZW5lcmF0ZUNlbGxQcm9wZXJ0eVVyaShvcmlnaW5hbFNvdXJjZVVyaSwgaXRlbS5vcmlnaW5hbCEuaGFuZGxlLCBTY2hlbWFzLnZzY29kZU5vdGVib29rQ2VsbE91dHB1dCk7XG5cdFx0XHRcdFx0Y29uc3QgbW9kaWZpZWRPdXRwdXQgPSBDZWxsVXJpLmdlbmVyYXRlQ2VsbFByb3BlcnR5VXJpKG1vZGlmaWVkU291cmNlVXJpLCBpdGVtLm1vZGlmaWVkIS5oYW5kbGUsIFNjaGVtYXMudnNjb2RlTm90ZWJvb2tDZWxsT3V0cHV0KTtcblx0XHRcdFx0XHR0aGlzLmRpZmZFZGl0b3JJdGVtcy5wdXNoKG5ldyBOb3RlYm9va011bHRpRGlmZkVkaXRvck91dHB1dEl0ZW0ob3JpZ2luYWxPdXRwdXQsIG1vZGlmaWVkT3V0cHV0LCBpdGVtLnR5cGUsIGl0ZW0udHlwZSkpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZVZpZXdNb2RlbHMoY2VsbERpZmZJbmZvOiBDZWxsRGlmZkluZm9bXSwgbWV0YWRhdGFDaGFuZ2VkOiBib29sZWFuLCBmaXJzdENoYW5nZUluZGV4OiBudW1iZXIpIHtcblx0XHRjb25zdCBjZWxsVmlld01vZGVscyA9IGF3YWl0IHRoaXMuY3JlYXRlRGlmZlZpZXdNb2RlbHMoY2VsbERpZmZJbmZvLCBtZXRhZGF0YUNoYW5nZWQpO1xuXHRcdGNvbnN0IG9sZExlbmd0aCA9IHRoaXMuX2l0ZW1zLmxlbmd0aDtcblx0XHR0aGlzLmNsZWFyKCk7XG5cdFx0dGhpcy5faXRlbXMuc3BsaWNlKDAsIG9sZExlbmd0aCk7XG5cblx0XHRsZXQgcGxhY2Vob2xkZXI6IERpZmZFbGVtZW50UGxhY2Vob2xkZXJWaWV3TW9kZWwgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5vcmlnaW5hbENlbGxWaWV3TW9kZWxzID0gY2VsbFZpZXdNb2RlbHM7XG5cdFx0Y2VsbFZpZXdNb2RlbHMuZm9yRWFjaCgodm0sIGluZGV4KSA9PiB7XG5cdFx0XHRpZiAodm0udHlwZSA9PT0gJ3VuY2hhbmdlZCcgJiYgIXRoaXMuZXhjbHVkZVVuY2hhbmdlZFBsYWNlaG9sZGVyKSB7XG5cdFx0XHRcdGlmICghcGxhY2Vob2xkZXIpIHtcblx0XHRcdFx0XHR2bS5kaXNwbGF5SWNvblRvSGlkZVVubW9kaWZpZWRDZWxscyA9IHRydWU7XG5cdFx0XHRcdFx0cGxhY2Vob2xkZXIgPSBuZXcgRGlmZkVsZW1lbnRQbGFjZWhvbGRlclZpZXdNb2RlbCh2bS5tYWluRG9jdW1lbnRUZXh0TW9kZWwsIHZtLmVkaXRvckV2ZW50RGlzcGF0Y2hlciwgdm0uaW5pdERhdGEpO1xuXHRcdFx0XHRcdHRoaXMuX2l0ZW1zLnB1c2gocGxhY2Vob2xkZXIpO1xuXHRcdFx0XHRcdGNvbnN0IHBsYWNlaG9sZGVySXRlbSA9IHBsYWNlaG9sZGVyO1xuXG5cdFx0XHRcdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQocGxhY2Vob2xkZXJJdGVtLm9uVW5mb2xkSGlkZGVuQ2VsbHMoKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgaGlkZGVuQ2VsbFZpZXdNb2RlbHMgPSB0aGlzLnBsYWNlaG9sZGVyQW5kUmVsYXRlZENlbGxzLmdldChwbGFjZWhvbGRlckl0ZW0pO1xuXHRcdFx0XHRcdFx0aWYgKCFBcnJheS5pc0FycmF5KGhpZGRlbkNlbGxWaWV3TW9kZWxzKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjb25zdCBzdGFydCA9IHRoaXMuX2l0ZW1zLmluZGV4T2YocGxhY2Vob2xkZXJJdGVtKTtcblx0XHRcdFx0XHRcdHRoaXMuX2l0ZW1zLnNwbGljZShzdGFydCwgMSwgLi4uaGlkZGVuQ2VsbFZpZXdNb2RlbHMpO1xuXHRcdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VJdGVtcy5maXJlKHsgc3RhcnQsIGRlbGV0ZUNvdW50OiAxLCBlbGVtZW50czogaGlkZGVuQ2VsbFZpZXdNb2RlbHMgfSk7XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHZtLm9uSGlkZVVuY2hhbmdlZENlbGxzKCgpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGhpZGRlbkNlbGxWaWV3TW9kZWxzID0gdGhpcy5wbGFjZWhvbGRlckFuZFJlbGF0ZWRDZWxscy5nZXQocGxhY2Vob2xkZXJJdGVtKTtcblx0XHRcdFx0XHRcdGlmICghQXJyYXkuaXNBcnJheShoaWRkZW5DZWxsVmlld01vZGVscykpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y29uc3Qgc3RhcnQgPSB0aGlzLl9pdGVtcy5pbmRleE9mKHZtKTtcblx0XHRcdFx0XHRcdHRoaXMuX2l0ZW1zLnNwbGljZShzdGFydCwgaGlkZGVuQ2VsbFZpZXdNb2RlbHMubGVuZ3RoLCBwbGFjZWhvbGRlckl0ZW0pO1xuXHRcdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VJdGVtcy5maXJlKHsgc3RhcnQsIGRlbGV0ZUNvdW50OiBoaWRkZW5DZWxsVmlld01vZGVscy5sZW5ndGgsIGVsZW1lbnRzOiBbcGxhY2Vob2xkZXJJdGVtXSB9KTtcblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgaGlkZGVuQ2VsbFZpZXdNb2RlbHMgPSB0aGlzLnBsYWNlaG9sZGVyQW5kUmVsYXRlZENlbGxzLmdldChwbGFjZWhvbGRlcikgfHwgW107XG5cdFx0XHRcdGhpZGRlbkNlbGxWaWV3TW9kZWxzLnB1c2godm0pO1xuXHRcdFx0XHR0aGlzLnBsYWNlaG9sZGVyQW5kUmVsYXRlZENlbGxzLnNldChwbGFjZWhvbGRlciwgaGlkZGVuQ2VsbFZpZXdNb2RlbHMpO1xuXHRcdFx0XHRwbGFjZWhvbGRlci5oaWRkZW5DZWxscy5wdXNoKHZtKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHBsYWNlaG9sZGVyID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR0aGlzLl9pdGVtcy5wdXNoKHZtKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vIE5vdGUsIGVuc3VyZSBhbGwgb2YgdGhlIGhlaWdodCBjYWxjdWxhdGlvbnMgYXJlIGRvbmUgYmVmb3JlIGZpcmluZyB0aGUgZXZlbnQuXG5cdFx0Ly8gVGhpcyBpcyB0byBlbnN1cmUgdGhhdCB0aGUgZGlmZiBlZGl0b3IgaXMgbm90IHJlc2l6ZWQgbXVsdGlwbGUgdGltZXMsIHRoZXJlYnkgYXZvaWRpbmcgZmxpY2tlcmluZy5cblx0XHR0aGlzLl9vbkRpZENoYW5nZUl0ZW1zLmZpcmUoeyBzdGFydDogMCwgZGVsZXRlQ291bnQ6IG9sZExlbmd0aCwgZWxlbWVudHM6IHRoaXMuX2l0ZW1zLCBmaXJzdENoYW5nZUluZGV4IH0pO1xuXHR9XG5cdHByaXZhdGUgYXN5bmMgY3JlYXRlRGlmZlZpZXdNb2RlbHMoY29tcHV0ZWRDZWxsRGlmZnM6IENlbGxEaWZmSW5mb1tdLCBtZXRhZGF0YUNoYW5nZWQ6IGJvb2xlYW4pIHtcblx0XHRjb25zdCBvcmlnaW5hbE1vZGVsID0gdGhpcy5tb2RlbC5vcmlnaW5hbC5ub3RlYm9vaztcblx0XHRjb25zdCBtb2RpZmllZE1vZGVsID0gdGhpcy5tb2RlbC5tb2RpZmllZC5ub3RlYm9vaztcblx0XHRjb25zdCBpbml0RGF0YSA9IHtcblx0XHRcdG1ldGFkYXRhU3RhdHVzSGVpZ2h0OiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdub3RlYm9vay5kaWZmLmlnbm9yZU1ldGFkYXRhJykgPyAwIDogMjUsXG5cdFx0XHRvdXRwdXRTdGF0dXNIZWlnaHQ6IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ25vdGVib29rLmRpZmYuaWdub3JlT3V0cHV0cycpIHx8ICEhKG1vZGlmaWVkTW9kZWwudHJhbnNpZW50T3B0aW9ucy50cmFuc2llbnRPdXRwdXRzKSA/IDAgOiAyNSxcblx0XHRcdGZvbnRJbmZvOiB0aGlzLmZvbnRJbmZvXG5cdFx0fTtcblxuXHRcdGNvbnN0IHZpZXdNb2RlbHM6IChTaW5nbGVTaWRlRGlmZkVsZW1lbnRWaWV3TW9kZWwgfCBTaWRlQnlTaWRlRGlmZkVsZW1lbnRWaWV3TW9kZWwgfCBOb3RlYm9va0RvY3VtZW50TWV0YWRhdGFWaWV3TW9kZWwpW10gPSBbXTtcblx0XHR0aGlzLm5vdGVib29rTWV0YWRhdGFWaWV3TW9kZWwgPSB0aGlzLl9yZWdpc3RlcihuZXcgTm90ZWJvb2tEb2N1bWVudE1ldGFkYXRhVmlld01vZGVsKHRoaXMubW9kZWwub3JpZ2luYWwubm90ZWJvb2ssIHRoaXMubW9kZWwubW9kaWZpZWQubm90ZWJvb2ssIG1ldGFkYXRhQ2hhbmdlZCA/ICdtb2RpZmllZE1ldGFkYXRhJyA6ICd1bmNoYW5nZWRNZXRhZGF0YScsIHRoaXMuZXZlbnREaXNwYXRjaGVyLCBpbml0RGF0YSwgdGhpcy5ub3RlYm9va1NlcnZpY2UsIHRoaXMuZGlmZkVkaXRvckhlaWdodENhbGN1bGF0b3IpKTtcblx0XHRpZiAoIXRoaXMuaWdub3JlTWV0YWRhdGEpIHtcblx0XHRcdGlmIChtZXRhZGF0YUNoYW5nZWQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5ub3RlYm9va01ldGFkYXRhVmlld01vZGVsLmNvbXB1dGVIZWlnaHRzKCk7XG5cdFx0XHR9XG5cdFx0XHR2aWV3TW9kZWxzLnB1c2godGhpcy5ub3RlYm9va01ldGFkYXRhVmlld01vZGVsKTtcblx0XHR9XG5cdFx0Y29uc3QgY2VsbFZpZXdNb2RlbHMgPSBhd2FpdCBQcm9taXNlLmFsbChjb21wdXRlZENlbGxEaWZmcy5tYXAoYXN5bmMgKGRpZmYpID0+IHtcblx0XHRcdHN3aXRjaCAoZGlmZi50eXBlKSB7XG5cdFx0XHRcdGNhc2UgJ2RlbGV0ZSc6IHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IFNpbmdsZVNpZGVEaWZmRWxlbWVudFZpZXdNb2RlbChcblx0XHRcdFx0XHRcdG9yaWdpbmFsTW9kZWwsXG5cdFx0XHRcdFx0XHRtb2RpZmllZE1vZGVsLFxuXHRcdFx0XHRcdFx0b3JpZ2luYWxNb2RlbC5jZWxsc1tkaWZmLm9yaWdpbmFsQ2VsbEluZGV4XSxcblx0XHRcdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdCdkZWxldGUnLFxuXHRcdFx0XHRcdFx0dGhpcy5ldmVudERpc3BhdGNoZXIsXG5cdFx0XHRcdFx0XHRpbml0RGF0YSxcblx0XHRcdFx0XHRcdHRoaXMubm90ZWJvb2tTZXJ2aWNlLFxuXHRcdFx0XHRcdFx0dGhpcy5jb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRcdFx0XHRcdHRoaXMuZGlmZkVkaXRvckhlaWdodENhbGN1bGF0b3IsXG5cdFx0XHRcdFx0XHRkaWZmLm9yaWdpbmFsQ2VsbEluZGV4XG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlICdpbnNlcnQnOiB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBTaW5nbGVTaWRlRGlmZkVsZW1lbnRWaWV3TW9kZWwoXG5cdFx0XHRcdFx0XHRtb2RpZmllZE1vZGVsLFxuXHRcdFx0XHRcdFx0b3JpZ2luYWxNb2RlbCxcblx0XHRcdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdG1vZGlmaWVkTW9kZWwuY2VsbHNbZGlmZi5tb2RpZmllZENlbGxJbmRleF0sXG5cdFx0XHRcdFx0XHQnaW5zZXJ0Jyxcblx0XHRcdFx0XHRcdHRoaXMuZXZlbnREaXNwYXRjaGVyLFxuXHRcdFx0XHRcdFx0aW5pdERhdGEsXG5cdFx0XHRcdFx0XHR0aGlzLm5vdGVib29rU2VydmljZSxcblx0XHRcdFx0XHRcdHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0XHRcdFx0XHR0aGlzLmRpZmZFZGl0b3JIZWlnaHRDYWxjdWxhdG9yLFxuXHRcdFx0XHRcdFx0ZGlmZi5tb2RpZmllZENlbGxJbmRleFxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSAnbW9kaWZpZWQnOiB7XG5cdFx0XHRcdFx0Y29uc3Qgdmlld01vZGVsID0gbmV3IFNpZGVCeVNpZGVEaWZmRWxlbWVudFZpZXdNb2RlbChcblx0XHRcdFx0XHRcdHRoaXMubW9kZWwubW9kaWZpZWQubm90ZWJvb2ssXG5cdFx0XHRcdFx0XHR0aGlzLm1vZGVsLm9yaWdpbmFsLm5vdGVib29rLFxuXHRcdFx0XHRcdFx0b3JpZ2luYWxNb2RlbC5jZWxsc1tkaWZmLm9yaWdpbmFsQ2VsbEluZGV4XSxcblx0XHRcdFx0XHRcdG1vZGlmaWVkTW9kZWwuY2VsbHNbZGlmZi5tb2RpZmllZENlbGxJbmRleF0sXG5cdFx0XHRcdFx0XHQnbW9kaWZpZWQnLFxuXHRcdFx0XHRcdFx0dGhpcy5ldmVudERpc3BhdGNoZXIsXG5cdFx0XHRcdFx0XHRpbml0RGF0YSxcblx0XHRcdFx0XHRcdHRoaXMubm90ZWJvb2tTZXJ2aWNlLFxuXHRcdFx0XHRcdFx0dGhpcy5jb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRcdFx0XHRcdGRpZmYub3JpZ2luYWxDZWxsSW5kZXgsXG5cdFx0XHRcdFx0XHR0aGlzLmRpZmZFZGl0b3JIZWlnaHRDYWxjdWxhdG9yXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0XHQvLyBSZWR1Y2VzIGZsaWNrZXIgKGNvbXB1dGUgdGhpcyBiZWZvcmUgc2V0dGluZyB0aGUgbW9kZWwpXG5cdFx0XHRcdFx0Ly8gRWxzZSB3aGVuIHRoZSBtb2RlbCBpcyBzZXQsIHRoZSBoZWlnaHQgb2YgdGhlIGVkaXRvciB3aWxsIGJlIHgsIGFmdGVyIGRpZmYgaXMgY29tcHV0ZWQsIHRoZW4gaGVpZ2h0IHdpbGwgYmUgeS5cblx0XHRcdFx0XHQvLyAmIHRoYXQgcmVzdWx0cyBpbiBmbGlja2VyLlxuXHRcdFx0XHRcdGF3YWl0IHZpZXdNb2RlbC5jb21wdXRlRWRpdG9ySGVpZ2h0cygpO1xuXHRcdFx0XHRcdHJldHVybiB2aWV3TW9kZWw7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSAndW5jaGFuZ2VkJzoge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgU2lkZUJ5U2lkZURpZmZFbGVtZW50Vmlld01vZGVsKFxuXHRcdFx0XHRcdFx0dGhpcy5tb2RlbC5tb2RpZmllZC5ub3RlYm9vayxcblx0XHRcdFx0XHRcdHRoaXMubW9kZWwub3JpZ2luYWwubm90ZWJvb2ssXG5cdFx0XHRcdFx0XHRvcmlnaW5hbE1vZGVsLmNlbGxzW2RpZmYub3JpZ2luYWxDZWxsSW5kZXhdLFxuXHRcdFx0XHRcdFx0bW9kaWZpZWRNb2RlbC5jZWxsc1tkaWZmLm1vZGlmaWVkQ2VsbEluZGV4XSxcblx0XHRcdFx0XHRcdCd1bmNoYW5nZWQnLCB0aGlzLmV2ZW50RGlzcGF0Y2hlcixcblx0XHRcdFx0XHRcdGluaXREYXRhLFxuXHRcdFx0XHRcdFx0dGhpcy5ub3RlYm9va1NlcnZpY2UsXG5cdFx0XHRcdFx0XHR0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdFx0XHRcdFx0ZGlmZi5vcmlnaW5hbENlbGxJbmRleCxcblx0XHRcdFx0XHRcdHRoaXMuZGlmZkVkaXRvckhlaWdodENhbGN1bGF0b3Jcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y2VsbFZpZXdNb2RlbHMuZm9yRWFjaCh2bSA9PiB2aWV3TW9kZWxzLnB1c2godm0pKTtcblxuXHRcdHJldHVybiB2aWV3TW9kZWxzO1xuXHR9XG5cbn1cblxuXG4vKipcbiAqIG1ha2luZyBzdXJlIHRoYXQgc3dhcHBpbmcgY2VsbHMgYXJlIGFsd2F5cyB0cmFuc2xhdGVkIHRvIGBpbnNlcnQrZGVsZXRlYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHByZXR0eUNoYW5nZXMob3JpZ2luYWw6IE5vdGVib29rVGV4dE1vZGVsLCBtb2RpZmllZDogTm90ZWJvb2tUZXh0TW9kZWwsIGRpZmZSZXN1bHQ6IElEaWZmUmVzdWx0KSB7XG5cdGNvbnN0IGNoYW5nZXMgPSBkaWZmUmVzdWx0LmNoYW5nZXM7XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgZGlmZlJlc3VsdC5jaGFuZ2VzLmxlbmd0aCAtIDE7IGkrKykge1xuXHRcdC8vIHRoZW4gd2Uga25vdyB0aGVyZSBpcyBhbm90aGVyIGNoYW5nZSBhZnRlciBjdXJyZW50IG9uZVxuXHRcdGNvbnN0IGN1cnIgPSBjaGFuZ2VzW2ldO1xuXHRcdGNvbnN0IG5leHQgPSBjaGFuZ2VzW2kgKyAxXTtcblx0XHRjb25zdCB4ID0gY3Vyci5vcmlnaW5hbFN0YXJ0O1xuXHRcdGNvbnN0IHkgPSBjdXJyLm1vZGlmaWVkU3RhcnQ7XG5cblx0XHRpZiAoXG5cdFx0XHRjdXJyLm9yaWdpbmFsTGVuZ3RoID09PSAxXG5cdFx0XHQmJiBjdXJyLm1vZGlmaWVkTGVuZ3RoID09PSAwXG5cdFx0XHQmJiBuZXh0Lm9yaWdpbmFsU3RhcnQgPT09IHggKyAyXG5cdFx0XHQmJiBuZXh0Lm9yaWdpbmFsTGVuZ3RoID09PSAwXG5cdFx0XHQmJiBuZXh0Lm1vZGlmaWVkU3RhcnQgPT09IHkgKyAxXG5cdFx0XHQmJiBuZXh0Lm1vZGlmaWVkTGVuZ3RoID09PSAxXG5cdFx0XHQmJiBvcmlnaW5hbC5jZWxsc1t4XS5nZXRIYXNoVmFsdWUoKSA9PT0gbW9kaWZpZWQuY2VsbHNbeSArIDFdLmdldEhhc2hWYWx1ZSgpXG5cdFx0XHQmJiBvcmlnaW5hbC5jZWxsc1t4ICsgMV0uZ2V0SGFzaFZhbHVlKCkgPT09IG1vZGlmaWVkLmNlbGxzW3ldLmdldEhhc2hWYWx1ZSgpXG5cdFx0KSB7XG5cdFx0XHQvLyB0aGlzIGlzIGEgc3dhcFxuXHRcdFx0Y3Vyci5vcmlnaW5hbFN0YXJ0ID0geDtcblx0XHRcdGN1cnIub3JpZ2luYWxMZW5ndGggPSAwO1xuXHRcdFx0Y3Vyci5tb2RpZmllZFN0YXJ0ID0geTtcblx0XHRcdGN1cnIubW9kaWZpZWRMZW5ndGggPSAxO1xuXG5cdFx0XHRuZXh0Lm9yaWdpbmFsU3RhcnQgPSB4ICsgMTtcblx0XHRcdG5leHQub3JpZ2luYWxMZW5ndGggPSAxO1xuXHRcdFx0bmV4dC5tb2RpZmllZFN0YXJ0ID0geSArIDI7XG5cdFx0XHRuZXh0Lm1vZGlmaWVkTGVuZ3RoID0gMDtcblxuXHRcdFx0aSsrO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgdHlwZSBDZWxsRGlmZkluZm8gPSB7XG5cdG9yaWdpbmFsQ2VsbEluZGV4OiBudW1iZXI7XG5cdG1vZGlmaWVkQ2VsbEluZGV4OiBudW1iZXI7XG5cdHR5cGU6ICd1bmNoYW5nZWQnIHwgJ21vZGlmaWVkJztcbn0gfFxue1xuXHRvcmlnaW5hbENlbGxJbmRleDogbnVtYmVyO1xuXHR0eXBlOiAnZGVsZXRlJztcbn0gfFxue1xuXHRtb2RpZmllZENlbGxJbmRleDogbnVtYmVyO1xuXHR0eXBlOiAnaW5zZXJ0Jztcbn07XG5cbmZ1bmN0aW9uIGlzRXF1YWwoY2VsbERpZmZJbmZvOiBDZWxsRGlmZkluZm9bXSwgdmlld01vZGVsczogSURpZmZFbGVtZW50Vmlld01vZGVsQmFzZVtdLCBtb2RlbDogSU5vdGVib29rRGlmZkVkaXRvck1vZGVsKSB7XG5cdGlmIChjZWxsRGlmZkluZm8ubGVuZ3RoICE9PSB2aWV3TW9kZWxzLmxlbmd0aCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRjb25zdCBvcmlnaW5hbE1vZGVsID0gbW9kZWwub3JpZ2luYWwubm90ZWJvb2s7XG5cdGNvbnN0IG1vZGlmaWVkTW9kZWwgPSBtb2RlbC5tb2RpZmllZC5ub3RlYm9vaztcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCB2aWV3TW9kZWxzLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgYSA9IGNlbGxEaWZmSW5mb1tpXTtcblx0XHRjb25zdCBiID0gdmlld01vZGVsc1tpXTtcblx0XHRpZiAoYS50eXBlICE9PSBiLnR5cGUpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0c3dpdGNoIChhLnR5cGUpIHtcblx0XHRcdGNhc2UgJ2RlbGV0ZSc6IHtcblx0XHRcdFx0aWYgKG9yaWdpbmFsTW9kZWwuY2VsbHNbYS5vcmlnaW5hbENlbGxJbmRleF0uaGFuZGxlICE9PSBiLm9yaWdpbmFsPy5oYW5kbGUpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjYXNlICdpbnNlcnQnOiB7XG5cdFx0XHRcdGlmIChtb2RpZmllZE1vZGVsLmNlbGxzW2EubW9kaWZpZWRDZWxsSW5kZXhdLmhhbmRsZSAhPT0gYi5tb2RpZmllZD8uaGFuZGxlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0ZGVmYXVsdDoge1xuXHRcdFx0XHRpZiAob3JpZ2luYWxNb2RlbC5jZWxsc1thLm9yaWdpbmFsQ2VsbEluZGV4XS5oYW5kbGUgIT09IGIub3JpZ2luYWw/LmhhbmRsZSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAobW9kaWZpZWRNb2RlbC5jZWxsc1thLm1vZGlmaWVkQ2VsbEluZGV4XS5oYW5kbGUgIT09IGIubW9kaWZpZWQ/LmhhbmRsZSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdHJ1ZTtcbn1cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBOb3RlYm9va011bHRpRGlmZkVkaXRvckl0ZW0gZXh0ZW5kcyBNdWx0aURpZmZFZGl0b3JJdGVtIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0b3JpZ2luYWxVcmk6IFVSSSB8IHVuZGVmaW5lZCxcblx0XHRtb2RpZmllZFVyaTogVVJJIHwgdW5kZWZpbmVkLFxuXHRcdGdvVG9GaWxlVXJpOiBVUkkgfCB1bmRlZmluZWQsXG5cdFx0cHVibGljIHJlYWRvbmx5IHR5cGU6IElEaWZmRWxlbWVudFZpZXdNb2RlbEJhc2VbJ3R5cGUnXSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgY29udGFpbmVyVHlwZTogSURpZmZFbGVtZW50Vmlld01vZGVsQmFzZVsndHlwZSddLFxuXHRcdHB1YmxpYyBraW5kOiAnQ2VsbCcgfCAnTWV0YWRhdGEnIHwgJ091dHB1dCcsXG5cdFx0Y29udGV4dEtleXM/OiBSZWNvcmQ8c3RyaW5nLCBDb250ZXh0S2V5VmFsdWU+LFxuXHQpIHtcblx0XHRzdXBlcihvcmlnaW5hbFVyaSwgbW9kaWZpZWRVcmksIGdvVG9GaWxlVXJpLCBjb250ZXh0S2V5cyk7XG5cdH1cbn1cblxuY2xhc3MgTm90ZWJvb2tNdWx0aURpZmZFZGl0b3JDZWxsSXRlbSBleHRlbmRzIE5vdGVib29rTXVsdGlEaWZmRWRpdG9ySXRlbSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdG9yaWdpbmFsVXJpOiBVUkkgfCB1bmRlZmluZWQsXG5cdFx0bW9kaWZpZWRVcmk6IFVSSSB8IHVuZGVmaW5lZCxcblx0XHR0eXBlOiBJRGlmZkVsZW1lbnRWaWV3TW9kZWxCYXNlWyd0eXBlJ10sXG5cdFx0Y29udGFpbmVyVHlwZTogSURpZmZFbGVtZW50Vmlld01vZGVsQmFzZVsndHlwZSddLFxuXHQpIHtcblx0XHRzdXBlcihvcmlnaW5hbFVyaSwgbW9kaWZpZWRVcmksIG1vZGlmaWVkVXJpIHx8IG9yaWdpbmFsVXJpLCB0eXBlLCBjb250YWluZXJUeXBlLCAnQ2VsbCcsIHtcblx0XHRcdFtOT1RFQk9PS19ESUZGX0lURU1fS0lORC5rZXldOiAnQ2VsbCcsXG5cdFx0XHRbTk9URUJPT0tfRElGRl9JVEVNX0RJRkZfU1RBVEUua2V5XTogdHlwZVxuXHRcdH0pO1xuXHR9XG59XG5cbmNsYXNzIE5vdGVib29rTXVsdGlEaWZmRWRpdG9yTWV0YWRhdGFJdGVtIGV4dGVuZHMgTm90ZWJvb2tNdWx0aURpZmZFZGl0b3JJdGVtIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0b3JpZ2luYWxVcmk6IFVSSSB8IHVuZGVmaW5lZCxcblx0XHRtb2RpZmllZFVyaTogVVJJIHwgdW5kZWZpbmVkLFxuXHRcdHR5cGU6IElEaWZmRWxlbWVudFZpZXdNb2RlbEJhc2VbJ3R5cGUnXSxcblx0XHRjb250YWluZXJUeXBlOiBJRGlmZkVsZW1lbnRWaWV3TW9kZWxCYXNlWyd0eXBlJ10sXG5cdCkge1xuXHRcdHN1cGVyKG9yaWdpbmFsVXJpLCBtb2RpZmllZFVyaSwgbW9kaWZpZWRVcmkgfHwgb3JpZ2luYWxVcmksIHR5cGUsIGNvbnRhaW5lclR5cGUsICdNZXRhZGF0YScsIHtcblx0XHRcdFtOT1RFQk9PS19ESUZGX0lURU1fS0lORC5rZXldOiAnTWV0YWRhdGEnLFxuXHRcdFx0W05PVEVCT09LX0RJRkZfSVRFTV9ESUZGX1NUQVRFLmtleV06IHR5cGVcblx0XHR9KTtcblx0fVxufVxuXG5jbGFzcyBOb3RlYm9va011bHRpRGlmZkVkaXRvck91dHB1dEl0ZW0gZXh0ZW5kcyBOb3RlYm9va011bHRpRGlmZkVkaXRvckl0ZW0ge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRvcmlnaW5hbFVyaTogVVJJIHwgdW5kZWZpbmVkLFxuXHRcdG1vZGlmaWVkVXJpOiBVUkkgfCB1bmRlZmluZWQsXG5cdFx0dHlwZTogSURpZmZFbGVtZW50Vmlld01vZGVsQmFzZVsndHlwZSddLFxuXHRcdGNvbnRhaW5lclR5cGU6IElEaWZmRWxlbWVudFZpZXdNb2RlbEJhc2VbJ3R5cGUnXSxcblx0KSB7XG5cdFx0c3VwZXIob3JpZ2luYWxVcmksIG1vZGlmaWVkVXJpLCBtb2RpZmllZFVyaSB8fCBvcmlnaW5hbFVyaSwgdHlwZSwgY29udGFpbmVyVHlwZSwgJ091dHB1dCcsIHtcblx0XHRcdFtOT1RFQk9PS19ESUZGX0lURU1fS0lORC5rZXldOiAnT3V0cHV0Jyxcblx0XHRcdFtOT1RFQk9PS19ESUZGX0lURU1fRElGRl9TVEFURS5rZXldOiB0eXBlXG5cdFx0fSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQU9BLFNBQVMsZUFBMkM7QUFDcEQsU0FBUyxZQUFZLGlCQUFpQixlQUFlO0FBQ3JELFNBQVMsZUFBZTtBQUt4QixTQUFTLDJCQUEyQjtBQUNwQyxTQUF1QyxpQ0FBNEQsbUNBQW1DLGdDQUFnQyxzQ0FBc0M7QUFFNU0sU0FBb0UsK0JBQStCLCtCQUErQjtBQUVsSSxTQUFTLGVBQXlDO0FBSWxELFNBQVMsd0JB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
