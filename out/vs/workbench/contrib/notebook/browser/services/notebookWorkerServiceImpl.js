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
import { Disposable, DisposableStore, dispose, toDisposable } from "../../../../../base/common/lifecycle.js";
import { createWebWorker } from "../../../../../base/browser/webWorkerFactory.js";
import { CellUri, NotebookCellsChangeType } from "../../common/notebookCommon.js";
import { INotebookService } from "../../common/notebookService.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { TextModel } from "../../../../../editor/common/model/textModel.js";
import { FileAccess, Schemas } from "../../../../../base/common/network.js";
import { isEqual } from "../../../../../base/common/resources.js";
let NotebookEditorWorkerServiceImpl = class extends Disposable {
  constructor(notebookService, modelService) {
    super();
    this._workerManager = this._register(new WorkerManager(notebookService, modelService));
  }
  canComputeDiff(original, modified) {
    throw new Error("Method not implemented.");
  }
  computeDiff(original, modified) {
    return this._workerManager.withWorker().then((client) => {
      return client.computeDiff(original, modified);
    });
  }
  canPromptRecommendation(model) {
    return this._workerManager.withWorker().then((client) => {
      return client.canPromptRecommendation(model);
    });
  }
};
NotebookEditorWorkerServiceImpl = __decorateClass([
  __decorateParam(0, INotebookService),
  __decorateParam(1, IModelService)
], NotebookEditorWorkerServiceImpl);
class WorkerManager extends Disposable {
  // private _lastWorkerUsedTime: number;
  constructor(_notebookService, _modelService) {
    super();
    this._notebookService = _notebookService;
    this._modelService = _modelService;
    this._editorWorkerClient = null;
  }
  withWorker() {
    if (!this._editorWorkerClient) {
      this._editorWorkerClient = new NotebookWorkerClient(this._notebookService, this._modelService);
      this._register(this._editorWorkerClient);
    }
    return Promise.resolve(this._editorWorkerClient);
  }
}
class NotebookEditorModelManager extends Disposable {
  constructor(_proxy, _notebookService, _modelService) {
    super();
    this._proxy = _proxy;
    this._notebookService = _notebookService;
    this._modelService = _modelService;
    this._syncedModels = /* @__PURE__ */ Object.create(null);
    this._syncedModelsLastUsedTime = /* @__PURE__ */ Object.create(null);
  }
  ensureSyncedResources(resources) {
    for (const resource of resources) {
      const resourceStr = resource.toString();
      if (!this._syncedModels[resourceStr]) {
        this._beginModelSync(resource);
      }
      if (this._syncedModels[resourceStr]) {
        this._syncedModelsLastUsedTime[resourceStr] = (/* @__PURE__ */ new Date()).getTime();
      }
    }
  }
  _beginModelSync(resource) {
    const model = this._notebookService.listNotebookDocuments().find((document) => document.uri.toString() === resource.toString());
    if (!model) {
      return;
    }
    const modelUrl = resource.toString();
    this._proxy.$acceptNewModel(
      model.uri.toString(),
      model.metadata,
      model.transientOptions.transientDocumentMetadata,
      model.cells.map((cell) => ({
        handle: cell.handle,
        url: cell.uri.toString(),
        source: cell.textBuffer.getLinesContent(),
        eol: cell.textBuffer.getEOL(),
        versionId: cell.textModel?.getVersionId() ?? 0,
        language: cell.language,
        mime: cell.mime,
        cellKind: cell.cellKind,
        outputs: cell.outputs.map((op) => ({ outputId: op.outputId, outputs: op.outputs })),
        metadata: cell.metadata,
        internalMetadata: cell.internalMetadata
      }))
    );
    const toDispose = new DisposableStore();
    const cellToDto = (cell) => {
      return {
        handle: cell.handle,
        url: cell.uri.toString(),
        source: cell.textBuffer.getLinesContent(),
        eol: cell.textBuffer.getEOL(),
        versionId: 0,
        language: cell.language,
        cellKind: cell.cellKind,
        outputs: cell.outputs.map((op) => ({ outputId: op.outputId, outputs: op.outputs })),
        metadata: cell.metadata,
        internalMetadata: cell.internalMetadata
      };
    };
    const cellHandlers = /* @__PURE__ */ new Set();
    const addCellContentChangeHandler = (cell) => {
      cellHandlers.add(cell);
      toDispose.add(cell.onDidChangeContent((e) => {
        if (typeof e === "object" && e.type === "model") {
          this._proxy.$acceptCellModelChanged(modelUrl, cell.handle, e.event);
        }
      }));
    };
    model.cells.forEach((cell) => addCellContentChangeHandler(cell));
    if (model.cells.length !== cellHandlers.size) {
      toDispose.add(this._modelService.onModelAdded((textModel) => {
        if (textModel.uri.scheme !== Schemas.vscodeNotebookCell || !(textModel instanceof TextModel)) {
          return;
        }
        const cellUri = CellUri.parse(textModel.uri);
        if (!cellUri || !isEqual(cellUri.notebook, model.uri)) {
          return;
        }
        const cell = model.cells.find((cell2) => cell2.handle === cellUri.handle);
        if (cell) {
          addCellContentChangeHandler(cell);
        }
      }));
    }
    toDispose.add(model.onDidChangeContent((event) => {
      const dto = [];
      event.rawEvents.forEach((e) => {
        switch (e.kind) {
          case NotebookCellsChangeType.ModelChange:
          case NotebookCellsChangeType.Initialize: {
            dto.push({
              kind: e.kind,
              changes: e.changes.map((diff) => [diff[0], diff[1], diff[2].map((cell) => cellToDto(cell))])
            });
            for (const change of e.changes) {
              for (const cell of change[2]) {
                addCellContentChangeHandler(cell);
              }
            }
            break;
          }
          case NotebookCellsChangeType.Move: {
            dto.push({
              kind: NotebookCellsChangeType.Move,
              index: e.index,
              length: e.length,
              newIdx: e.newIdx,
              cells: e.cells.map((cell) => cellToDto(cell))
            });
            break;
          }
          case NotebookCellsChangeType.ChangeCellContent:
            break;
          case NotebookCellsChangeType.ChangeDocumentMetadata:
            dto.push({
              kind: e.kind,
              metadata: e.metadata
            });
          default:
            dto.push(e);
        }
      });
      this._proxy.$acceptModelChanged(modelUrl.toString(), {
        rawEvents: dto,
        versionId: event.versionId
      });
    }));
    toDispose.add(model.onWillDispose(() => {
      this._stopModelSync(modelUrl);
    }));
    toDispose.add(toDisposable(() => {
      this._proxy.$acceptRemovedModel(modelUrl);
    }));
    this._syncedModels[modelUrl] = toDispose;
  }
  _stopModelSync(modelUrl) {
    const toDispose = this._syncedModels[modelUrl];
    delete this._syncedModels[modelUrl];
    delete this._syncedModelsLastUsedTime[modelUrl];
    dispose(toDispose);
  }
}
class NotebookWorkerClient extends Disposable {
  constructor(_notebookService, _modelService) {
    super();
    this._notebookService = _notebookService;
    this._modelService = _modelService;
    this._worker = null;
    this._modelManager = null;
  }
  computeDiff(original, modified) {
    const proxy = this._ensureSyncedResources([original, modified]);
    return proxy.$computeDiff(original.toString(), modified.toString());
  }
  canPromptRecommendation(modelUri) {
    const proxy = this._ensureSyncedResources([modelUri]);
    return proxy.$canPromptRecommendation(modelUri.toString());
  }
  _getOrCreateModelManager(proxy) {
    if (!this._modelManager) {
      this._modelManager = this._register(new NotebookEditorModelManager(proxy, this._notebookService, this._modelService));
    }
    return this._modelManager;
  }
  _ensureSyncedResources(resources) {
    const proxy = this._getOrCreateWorker().proxy;
    this._getOrCreateModelManager(proxy).ensureSyncedResources(resources);
    return proxy;
  }
  _getOrCreateWorker() {
    if (!this._worker) {
      try {
        this._worker = this._register(createWebWorker(
          FileAccess.asBrowserUri("vs/workbench/contrib/notebook/common/services/notebookWebWorkerMain.js"),
          "NotebookEditorWorker"
        ));
      } catch (err) {
        throw err;
      }
    }
    return this._worker;
  }
}
export {
  NotebookEditorWorkerServiceImpl
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3NlcnZpY2VzL25vdGVib29rV29ya2VyU2VydmljZUltcGwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElXZWJXb3JrZXJDbGllbnQsIFByb3hpZWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi93b3JrZXIvd2ViV29ya2VyLmpzJztcbmltcG9ydCB7IGNyZWF0ZVdlYldvcmtlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci93ZWJXb3JrZXJGYWN0b3J5LmpzJztcbmltcG9ydCB7IE5vdGVib29rQ2VsbFRleHRNb2RlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi9tb2RlbC9ub3RlYm9va0NlbGxUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgQ2VsbFVyaSwgSU1haW5DZWxsRHRvLCBJTm90ZWJvb2tEaWZmUmVzdWx0LCBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZSwgTm90ZWJvb2tSYXdDb250ZW50RXZlbnREdG8gfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgSU5vdGVib29rU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tXb3JrZXIgfSBmcm9tICcuLi8uLi9jb21tb24vc2VydmljZXMvbm90ZWJvb2tXZWJXb3JrZXIuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRWRpdG9yV29ya2VyU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9ub3RlYm9va1dvcmtlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgRmlsZUFjY2VzcywgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBOb3RlYm9va0VkaXRvcldvcmtlclNlcnZpY2VJbXBsIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElOb3RlYm9va0VkaXRvcldvcmtlclNlcnZpY2Uge1xuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF93b3JrZXJNYW5hZ2VyOiBXb3JrZXJNYW5hZ2VyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTm90ZWJvb2tTZXJ2aWNlIG5vdGVib29rU2VydmljZTogSU5vdGVib29rU2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl93b3JrZXJNYW5hZ2VyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFdvcmtlck1hbmFnZXIobm90ZWJvb2tTZXJ2aWNlLCBtb2RlbFNlcnZpY2UpKTtcblx0fVxuXHRjYW5Db21wdXRlRGlmZihvcmlnaW5hbDogVVJJLCBtb2RpZmllZDogVVJJKTogYm9vbGVhbiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0Y29tcHV0ZURpZmYob3JpZ2luYWw6IFVSSSwgbW9kaWZpZWQ6IFVSSSk6IFByb21pc2U8SU5vdGVib29rRGlmZlJlc3VsdD4ge1xuXHRcdHJldHVybiB0aGlzLl93b3JrZXJNYW5hZ2VyLndpdGhXb3JrZXIoKS50aGVuKGNsaWVudCA9PiB7XG5cdFx0XHRyZXR1cm4gY2xpZW50LmNvbXB1dGVEaWZmKG9yaWdpbmFsLCBtb2RpZmllZCk7XG5cdFx0fSk7XG5cdH1cblxuXHRjYW5Qcm9tcHRSZWNvbW1lbmRhdGlvbihtb2RlbDogVVJJKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dvcmtlck1hbmFnZXIud2l0aFdvcmtlcigpLnRoZW4oY2xpZW50ID0+IHtcblx0XHRcdHJldHVybiBjbGllbnQuY2FuUHJvbXB0UmVjb21tZW5kYXRpb24obW9kZWwpO1xuXHRcdH0pO1xuXHR9XG59XG5cbmNsYXNzIFdvcmtlck1hbmFnZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSBfZWRpdG9yV29ya2VyQ2xpZW50OiBOb3RlYm9va1dvcmtlckNsaWVudCB8IG51bGw7XG5cdC8vIHByaXZhdGUgX2xhc3RXb3JrZXJVc2VkVGltZTogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rU2VydmljZTogSU5vdGVib29rU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9tb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fZWRpdG9yV29ya2VyQ2xpZW50ID0gbnVsbDtcblx0XHQvLyB0aGlzLl9sYXN0V29ya2VyVXNlZFRpbWUgPSAobmV3IERhdGUoKSkuZ2V0VGltZSgpO1xuXHR9XG5cblx0d2l0aFdvcmtlcigpOiBQcm9taXNlPE5vdGVib29rV29ya2VyQ2xpZW50PiB7XG5cdFx0Ly8gdGhpcy5fbGFzdFdvcmtlclVzZWRUaW1lID0gKG5ldyBEYXRlKCkpLmdldFRpbWUoKTtcblx0XHRpZiAoIXRoaXMuX2VkaXRvcldvcmtlckNsaWVudCkge1xuXHRcdFx0dGhpcy5fZWRpdG9yV29ya2VyQ2xpZW50ID0gbmV3IE5vdGVib29rV29ya2VyQ2xpZW50KHRoaXMuX25vdGVib29rU2VydmljZSwgdGhpcy5fbW9kZWxTZXJ2aWNlKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvcldvcmtlckNsaWVudCk7XG5cdFx0fVxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5fZWRpdG9yV29ya2VyQ2xpZW50KTtcblx0fVxufVxuXG5jbGFzcyBOb3RlYm9va0VkaXRvck1vZGVsTWFuYWdlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIF9zeW5jZWRNb2RlbHM6IHsgW21vZGVsVXJsOiBzdHJpbmddOiBJRGlzcG9zYWJsZSB9ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0cHJpdmF0ZSBfc3luY2VkTW9kZWxzTGFzdFVzZWRUaW1lOiB7IFttb2RlbFVybDogc3RyaW5nXTogbnVtYmVyIH0gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBQcm94aWVkPE5vdGVib29rV29ya2VyPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9ub3RlYm9va1NlcnZpY2U6IElOb3RlYm9va1NlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0cHVibGljIGVuc3VyZVN5bmNlZFJlc291cmNlcyhyZXNvdXJjZXM6IFVSSVtdKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCByZXNvdXJjZSBvZiByZXNvdXJjZXMpIHtcblx0XHRcdGNvbnN0IHJlc291cmNlU3RyID0gcmVzb3VyY2UudG9TdHJpbmcoKTtcblxuXHRcdFx0aWYgKCF0aGlzLl9zeW5jZWRNb2RlbHNbcmVzb3VyY2VTdHJdKSB7XG5cdFx0XHRcdHRoaXMuX2JlZ2luTW9kZWxTeW5jKHJlc291cmNlKTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLl9zeW5jZWRNb2RlbHNbcmVzb3VyY2VTdHJdKSB7XG5cdFx0XHRcdHRoaXMuX3N5bmNlZE1vZGVsc0xhc3RVc2VkVGltZVtyZXNvdXJjZVN0cl0gPSAobmV3IERhdGUoKSkuZ2V0VGltZSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2JlZ2luTW9kZWxTeW5jKHJlc291cmNlOiBVUkkpOiB2b2lkIHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX25vdGVib29rU2VydmljZS5saXN0Tm90ZWJvb2tEb2N1bWVudHMoKS5maW5kKGRvY3VtZW50ID0+IGRvY3VtZW50LnVyaS50b1N0cmluZygpID09PSByZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWxVcmwgPSByZXNvdXJjZS50b1N0cmluZygpO1xuXG5cdFx0dGhpcy5fcHJveHkuJGFjY2VwdE5ld01vZGVsKFxuXHRcdFx0bW9kZWwudXJpLnRvU3RyaW5nKCksXG5cdFx0XHRtb2RlbC5tZXRhZGF0YSxcblx0XHRcdG1vZGVsLnRyYW5zaWVudE9wdGlvbnMudHJhbnNpZW50RG9jdW1lbnRNZXRhZGF0YSxcblx0XHRcdG1vZGVsLmNlbGxzLm1hcChjZWxsID0+ICh7XG5cdFx0XHRcdGhhbmRsZTogY2VsbC5oYW5kbGUsXG5cdFx0XHRcdHVybDogY2VsbC51cmkudG9TdHJpbmcoKSxcblx0XHRcdFx0c291cmNlOiBjZWxsLnRleHRCdWZmZXIuZ2V0TGluZXNDb250ZW50KCksXG5cdFx0XHRcdGVvbDogY2VsbC50ZXh0QnVmZmVyLmdldEVPTCgpLFxuXHRcdFx0XHR2ZXJzaW9uSWQ6IGNlbGwudGV4dE1vZGVsPy5nZXRWZXJzaW9uSWQoKSA/PyAwLFxuXHRcdFx0XHRsYW5ndWFnZTogY2VsbC5sYW5ndWFnZSxcblx0XHRcdFx0bWltZTogY2VsbC5taW1lLFxuXHRcdFx0XHRjZWxsS2luZDogY2VsbC5jZWxsS2luZCxcblx0XHRcdFx0b3V0cHV0czogY2VsbC5vdXRwdXRzLm1hcChvcCA9PiAoeyBvdXRwdXRJZDogb3Aub3V0cHV0SWQsIG91dHB1dHM6IG9wLm91dHB1dHMgfSkpLFxuXHRcdFx0XHRtZXRhZGF0YTogY2VsbC5tZXRhZGF0YSxcblx0XHRcdFx0aW50ZXJuYWxNZXRhZGF0YTogY2VsbC5pbnRlcm5hbE1ldGFkYXRhLFxuXHRcdFx0fSkpXG5cdFx0KTtcblxuXHRcdGNvbnN0IHRvRGlzcG9zZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdGNvbnN0IGNlbGxUb0R0byA9IChjZWxsOiBOb3RlYm9va0NlbGxUZXh0TW9kZWwpOiBJTWFpbkNlbGxEdG8gPT4ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0aGFuZGxlOiBjZWxsLmhhbmRsZSxcblx0XHRcdFx0dXJsOiBjZWxsLnVyaS50b1N0cmluZygpLFxuXHRcdFx0XHRzb3VyY2U6IGNlbGwudGV4dEJ1ZmZlci5nZXRMaW5lc0NvbnRlbnQoKSxcblx0XHRcdFx0ZW9sOiBjZWxsLnRleHRCdWZmZXIuZ2V0RU9MKCksXG5cdFx0XHRcdHZlcnNpb25JZDogMCxcblx0XHRcdFx0bGFuZ3VhZ2U6IGNlbGwubGFuZ3VhZ2UsXG5cdFx0XHRcdGNlbGxLaW5kOiBjZWxsLmNlbGxLaW5kLFxuXHRcdFx0XHRvdXRwdXRzOiBjZWxsLm91dHB1dHMubWFwKG9wID0+ICh7IG91dHB1dElkOiBvcC5vdXRwdXRJZCwgb3V0cHV0czogb3Aub3V0cHV0cyB9KSksXG5cdFx0XHRcdG1ldGFkYXRhOiBjZWxsLm1ldGFkYXRhLFxuXHRcdFx0XHRpbnRlcm5hbE1ldGFkYXRhOiBjZWxsLmludGVybmFsTWV0YWRhdGEsXG5cdFx0XHR9O1xuXHRcdH07XG5cblx0XHRjb25zdCBjZWxsSGFuZGxlcnMgPSBuZXcgU2V0PE5vdGVib29rQ2VsbFRleHRNb2RlbD4oKTtcblx0XHRjb25zdCBhZGRDZWxsQ29udGVudENoYW5nZUhhbmRsZXIgPSAoY2VsbDogTm90ZWJvb2tDZWxsVGV4dE1vZGVsKSA9PiB7XG5cdFx0XHRjZWxsSGFuZGxlcnMuYWRkKGNlbGwpO1xuXHRcdFx0dG9EaXNwb3NlLmFkZChjZWxsLm9uRGlkQ2hhbmdlQ29udGVudCgoZSkgPT4ge1xuXHRcdFx0XHRpZiAodHlwZW9mIGUgPT09ICdvYmplY3QnICYmIGUudHlwZSA9PT0gJ21vZGVsJykge1xuXHRcdFx0XHRcdHRoaXMuX3Byb3h5LiRhY2NlcHRDZWxsTW9kZWxDaGFuZ2VkKG1vZGVsVXJsLCBjZWxsLmhhbmRsZSwgZS5ldmVudCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9O1xuXG5cdFx0bW9kZWwuY2VsbHMuZm9yRWFjaChjZWxsID0+IGFkZENlbGxDb250ZW50Q2hhbmdlSGFuZGxlcihjZWxsKSk7XG5cdFx0Ly8gUG9zc2libGUgc29tZSBvZiB0aGUgbW9kZWxzIGhhdmUgbm90IHlldCBiZWVuIGxvYWRlZC5cblx0XHQvLyBJZiBhbGwgaGF2ZSBiZWVuIGxvYWRlZCwgZm9yIGFsbCBjZWxscywgdGhlbiBubyBuZWVkIHRvIGxpc3RlbiB0byBtb2RlbCBhZGQgZXZlbnRzLlxuXHRcdGlmIChtb2RlbC5jZWxscy5sZW5ndGggIT09IGNlbGxIYW5kbGVycy5zaXplKSB7XG5cdFx0XHR0b0Rpc3Bvc2UuYWRkKHRoaXMuX21vZGVsU2VydmljZS5vbk1vZGVsQWRkZWQoKHRleHRNb2RlbDogSVRleHRNb2RlbCkgPT4ge1xuXHRcdFx0XHRpZiAodGV4dE1vZGVsLnVyaS5zY2hlbWUgIT09IFNjaGVtYXMudnNjb2RlTm90ZWJvb2tDZWxsIHx8ICEodGV4dE1vZGVsIGluc3RhbmNlb2YgVGV4dE1vZGVsKSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBjZWxsVXJpID0gQ2VsbFVyaS5wYXJzZSh0ZXh0TW9kZWwudXJpKTtcblx0XHRcdFx0aWYgKCFjZWxsVXJpIHx8ICFpc0VxdWFsKGNlbGxVcmkubm90ZWJvb2ssIG1vZGVsLnVyaSkpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgY2VsbCA9IG1vZGVsLmNlbGxzLmZpbmQoY2VsbCA9PiBjZWxsLmhhbmRsZSA9PT0gY2VsbFVyaS5oYW5kbGUpO1xuXHRcdFx0XHRpZiAoY2VsbCkge1xuXHRcdFx0XHRcdGFkZENlbGxDb250ZW50Q2hhbmdlSGFuZGxlcihjZWxsKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdHRvRGlzcG9zZS5hZGQobW9kZWwub25EaWRDaGFuZ2VDb250ZW50KChldmVudCkgPT4ge1xuXHRcdFx0Y29uc3QgZHRvOiBOb3RlYm9va1Jhd0NvbnRlbnRFdmVudER0b1tdID0gW107XG5cdFx0XHRldmVudC5yYXdFdmVudHNcblx0XHRcdFx0LmZvckVhY2goZSA9PiB7XG5cdFx0XHRcdFx0c3dpdGNoIChlLmtpbmQpIHtcblx0XHRcdFx0XHRcdGNhc2UgTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuTW9kZWxDaGFuZ2U6XG5cdFx0XHRcdFx0XHRjYXNlIE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLkluaXRpYWxpemU6IHtcblx0XHRcdFx0XHRcdFx0ZHRvLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdGtpbmQ6IGUua2luZCxcblx0XHRcdFx0XHRcdFx0XHRjaGFuZ2VzOiBlLmNoYW5nZXMubWFwKGRpZmYgPT4gW2RpZmZbMF0sIGRpZmZbMV0sIGRpZmZbMl0ubWFwKGNlbGwgPT4gY2VsbFRvRHRvKGNlbGwgYXMgTm90ZWJvb2tDZWxsVGV4dE1vZGVsKSldIGFzIFtudW1iZXIsIG51bWJlciwgSU1haW5DZWxsRHRvW11dKVxuXHRcdFx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdFx0XHRmb3IgKGNvbnN0IGNoYW5nZSBvZiBlLmNoYW5nZXMpIHtcblx0XHRcdFx0XHRcdFx0XHRmb3IgKGNvbnN0IGNlbGwgb2YgY2hhbmdlWzJdKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRhZGRDZWxsQ29udGVudENoYW5nZUhhbmRsZXIoY2VsbCBhcyBOb3RlYm9va0NlbGxUZXh0TW9kZWwpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNhc2UgTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuTW92ZToge1xuXHRcdFx0XHRcdFx0XHRkdG8ucHVzaCh7XG5cdFx0XHRcdFx0XHRcdFx0a2luZDogTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuTW92ZSxcblx0XHRcdFx0XHRcdFx0XHRpbmRleDogZS5pbmRleCxcblx0XHRcdFx0XHRcdFx0XHRsZW5ndGg6IGUubGVuZ3RoLFxuXHRcdFx0XHRcdFx0XHRcdG5ld0lkeDogZS5uZXdJZHgsXG5cdFx0XHRcdFx0XHRcdFx0Y2VsbHM6IGUuY2VsbHMubWFwKGNlbGwgPT4gY2VsbFRvRHRvKGNlbGwgYXMgTm90ZWJvb2tDZWxsVGV4dE1vZGVsKSlcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y2FzZSBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5DaGFuZ2VDZWxsQ29udGVudDpcblx0XHRcdFx0XHRcdFx0Ly8gQ2hhbmdlcyB0byBjZWxsIGNvbnRlbnQgYXJlIGhhbmRsZWQgYnkgdGhlIGNlbGwgbW9kZWwgY2hhbmdlIGxpc3RlbmVyLlxuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdGNhc2UgTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuQ2hhbmdlRG9jdW1lbnRNZXRhZGF0YTpcblx0XHRcdFx0XHRcdFx0ZHRvLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdGtpbmQ6IGUua2luZCxcblx0XHRcdFx0XHRcdFx0XHRtZXRhZGF0YTogZS5tZXRhZGF0YVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0XHRcdGR0by5wdXNoKGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cblx0XHRcdHRoaXMuX3Byb3h5LiRhY2NlcHRNb2RlbENoYW5nZWQobW9kZWxVcmwudG9TdHJpbmcoKSwge1xuXHRcdFx0XHRyYXdFdmVudHM6IGR0byxcblx0XHRcdFx0dmVyc2lvbklkOiBldmVudC52ZXJzaW9uSWRcblx0XHRcdH0pO1xuXHRcdH0pKTtcblxuXHRcdHRvRGlzcG9zZS5hZGQobW9kZWwub25XaWxsRGlzcG9zZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9zdG9wTW9kZWxTeW5jKG1vZGVsVXJsKTtcblx0XHR9KSk7XG5cdFx0dG9EaXNwb3NlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0dGhpcy5fcHJveHkuJGFjY2VwdFJlbW92ZWRNb2RlbChtb2RlbFVybCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fc3luY2VkTW9kZWxzW21vZGVsVXJsXSA9IHRvRGlzcG9zZTtcblx0fVxuXG5cdHByaXZhdGUgX3N0b3BNb2RlbFN5bmMobW9kZWxVcmw6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IHRvRGlzcG9zZSA9IHRoaXMuX3N5bmNlZE1vZGVsc1ttb2RlbFVybF07XG5cdFx0ZGVsZXRlIHRoaXMuX3N5bmNlZE1vZGVsc1ttb2RlbFVybF07XG5cdFx0ZGVsZXRlIHRoaXMuX3N5bmNlZE1vZGVsc0xhc3RVc2VkVGltZVttb2RlbFVybF07XG5cdFx0ZGlzcG9zZSh0b0Rpc3Bvc2UpO1xuXHR9XG59XG5cbmNsYXNzIE5vdGVib29rV29ya2VyQ2xpZW50IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgX3dvcmtlcjogSVdlYldvcmtlckNsaWVudDxOb3RlYm9va1dvcmtlcj4gfCBudWxsO1xuXHRwcml2YXRlIF9tb2RlbE1hbmFnZXI6IE5vdGVib29rRWRpdG9yTW9kZWxNYW5hZ2VyIHwgbnVsbDtcblxuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rU2VydmljZTogSU5vdGVib29rU2VydmljZSwgcHJpdmF0ZSByZWFkb25seSBfbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlKSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl93b3JrZXIgPSBudWxsO1xuXHRcdHRoaXMuX21vZGVsTWFuYWdlciA9IG51bGw7XG5cblx0fVxuXG5cdGNvbXB1dGVEaWZmKG9yaWdpbmFsOiBVUkksIG1vZGlmaWVkOiBVUkkpIHtcblx0XHRjb25zdCBwcm94eSA9IHRoaXMuX2Vuc3VyZVN5bmNlZFJlc291cmNlcyhbb3JpZ2luYWwsIG1vZGlmaWVkXSk7XG5cdFx0cmV0dXJuIHByb3h5LiRjb21wdXRlRGlmZihvcmlnaW5hbC50b1N0cmluZygpLCBtb2RpZmllZC50b1N0cmluZygpKTtcblx0fVxuXG5cdGNhblByb21wdFJlY29tbWVuZGF0aW9uKG1vZGVsVXJpOiBVUkkpIHtcblx0XHRjb25zdCBwcm94eSA9IHRoaXMuX2Vuc3VyZVN5bmNlZFJlc291cmNlcyhbbW9kZWxVcmldKTtcblx0XHRyZXR1cm4gcHJveHkuJGNhblByb21wdFJlY29tbWVuZGF0aW9uKG1vZGVsVXJpLnRvU3RyaW5nKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0T3JDcmVhdGVNb2RlbE1hbmFnZXIocHJveHk6IFByb3hpZWQ8Tm90ZWJvb2tXb3JrZXI+KTogTm90ZWJvb2tFZGl0b3JNb2RlbE1hbmFnZXIge1xuXHRcdGlmICghdGhpcy5fbW9kZWxNYW5hZ2VyKSB7XG5cdFx0XHR0aGlzLl9tb2RlbE1hbmFnZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgTm90ZWJvb2tFZGl0b3JNb2RlbE1hbmFnZXIocHJveHksIHRoaXMuX25vdGVib29rU2VydmljZSwgdGhpcy5fbW9kZWxTZXJ2aWNlKSk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9tb2RlbE1hbmFnZXI7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2Vuc3VyZVN5bmNlZFJlc291cmNlcyhyZXNvdXJjZXM6IFVSSVtdKTogUHJveGllZDxOb3RlYm9va1dvcmtlcj4ge1xuXHRcdGNvbnN0IHByb3h5ID0gdGhpcy5fZ2V0T3JDcmVhdGVXb3JrZXIoKS5wcm94eTtcblx0XHR0aGlzLl9nZXRPckNyZWF0ZU1vZGVsTWFuYWdlcihwcm94eSkuZW5zdXJlU3luY2VkUmVzb3VyY2VzKHJlc291cmNlcyk7XG5cdFx0cmV0dXJuIHByb3h5O1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0T3JDcmVhdGVXb3JrZXIoKTogSVdlYldvcmtlckNsaWVudDxOb3RlYm9va1dvcmtlcj4ge1xuXHRcdGlmICghdGhpcy5fd29ya2VyKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0aGlzLl93b3JrZXIgPSB0aGlzLl9yZWdpc3RlcihjcmVhdGVXZWJXb3JrZXI8Tm90ZWJvb2tXb3JrZXI+KFxuXHRcdFx0XHRcdEZpbGVBY2Nlc3MuYXNCcm93c2VyVXJpKCd2cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9jb21tb24vc2VydmljZXMvbm90ZWJvb2tXZWJXb3JrZXJNYWluLmpzJyksXG5cdFx0XHRcdFx0J05vdGVib29rRWRpdG9yV29ya2VyJ1xuXHRcdFx0XHQpKTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHR0aHJvdyAoZXJyKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3dvcmtlcjtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFlBQVksaUJBQWlCLFNBQXNCLG9CQUFvQjtBQUdoRixTQUFTLHVCQUF1QjtBQUVoQyxTQUFTLFNBQTRDLCtCQUEyRDtBQUNoSCxTQUFTLHdCQUF3QjtBQUdqQyxTQUFTLHFCQUFxQjtBQUU5QixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLFlBQVksZUFBZTtBQUNwQyxTQUFTLGVBQWU7QUFFakIsSUFBTSxrQ0FBTixjQUE4QyxXQUFtRDtBQUFBLEVBS3ZHLFlBQ21CLGlCQUNILGNBQ2Q7QUFDRCxVQUFNO0FBRU4sU0FBSyxpQkFBaUIsS0FBSyxVQUFVLElBQUksY0FBYyxpQkFBaUIsWUFBWSxDQUFDO0FBQUEsRUFDdEY7QUFBQSxFQUNBLGVBQWUsVUFBZSxVQUF3QjtBQUNyRCxVQUFNLElBQUksTUFBTSx5QkFBeUI7QUFBQSxFQUMxQztBQUFBLEVBRUEsWUFBWSxVQUFlLFVBQTZDO0FBQ3ZFLFdBQU8sS0FBSyxlQUFlLFdBQVcsRUFBRSxLQUFLLFlBQVU7QUFDdEQsYUFBTyxPQUFPLFlBQVksVUFBVSxRQUFRO0FBQUEsSUFDN0MsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLHdCQUF3QixPQUE4QjtBQUNyRCxXQUFPLEtBQUssZUFBZSxXQUFXLEVBQUUsS0FBSyxZQUFVO0FBQ3RELGFBQU8sT0FBTyx3QkFBd0IsS0FBSztBQUFBLElBQzVDLENBQUM7QUFBQSxFQUNGO0FBQ0Q7QUE1QmEsa0NBQU47QUFBQSxFQU1KO0FBQUEsRUFDQTtBQUFBLEdBUFU7QUE4QmIsTUFB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
