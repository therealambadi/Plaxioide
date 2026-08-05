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
import { IFileService } from "../../../../platform/files/common/files.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../base/common/event.js";
import { ResourceFileEdit, ResourceTextEdit } from "../../../../editor/browser/services/bulkEditService.js";
import { ResourceNotebookCellEdit } from "./bulkCellEdits.js";
import { ILogService } from "../../../../platform/log/common/log.js";
let ConflictDetector = class {
  constructor(edits, fileService, modelService, logService) {
    this._conflicts = new ResourceMap();
    this._disposables = new DisposableStore();
    this._onDidConflict = new Emitter();
    this.onDidConflict = this._onDidConflict.event;
    const _workspaceEditResources = new ResourceMap();
    for (const edit of edits) {
      if (edit instanceof ResourceTextEdit) {
        _workspaceEditResources.set(edit.resource, true);
        if (typeof edit.versionId === "number") {
          const model = modelService.getModel(edit.resource);
          if (model && model.getVersionId() !== edit.versionId) {
            this._conflicts.set(edit.resource, true);
            this._onDidConflict.fire(this);
          }
        }
      } else if (edit instanceof ResourceFileEdit) {
        if (edit.newResource) {
          _workspaceEditResources.set(edit.newResource, true);
        } else if (edit.oldResource) {
          _workspaceEditResources.set(edit.oldResource, true);
        }
      } else if (edit instanceof ResourceNotebookCellEdit) {
        _workspaceEditResources.set(edit.resource, true);
      } else {
        logService.warn("UNKNOWN edit type", edit);
      }
    }
    this._disposables.add(fileService.onDidFilesChange((e) => {
      for (const uri of _workspaceEditResources.keys()) {
        if (!modelService.getModel(uri) && e.contains(uri)) {
          this._conflicts.set(uri, true);
          this._onDidConflict.fire(this);
          break;
        }
      }
    }));
    const onDidChangeModel = (model) => {
      if (_workspaceEditResources.has(model.uri)) {
        this._conflicts.set(model.uri, true);
        this._onDidConflict.fire(this);
      }
    };
    for (const model of modelService.getModels()) {
      this._disposables.add(model.onDidChangeContent(() => onDidChangeModel(model)));
    }
  }
  dispose() {
    this._disposables.dispose();
    this._onDidConflict.dispose();
  }
  list() {
    return [...this._conflicts.keys()];
  }
  hasConflicts() {
    return this._conflicts.size > 0;
  }
};
ConflictDetector = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, IModelService),
  __decorateParam(3, ILogService)
], ConflictDetector);
export {
  ConflictDetector
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9idWxrRWRpdC9icm93c2VyL2NvbmZsaWN0cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VFZGl0LCBSZXNvdXJjZUZpbGVFZGl0LCBSZXNvdXJjZVRleHRFZGl0IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvYnVsa0VkaXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFJlc291cmNlTm90ZWJvb2tDZWxsRWRpdCB9IGZyb20gJy4vYnVsa0NlbGxFZGl0cy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcblxuZXhwb3J0IGNsYXNzIENvbmZsaWN0RGV0ZWN0b3Ige1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbmZsaWN0cyA9IG5ldyBSZXNvdXJjZU1hcDxib29sZWFuPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENvbmZsaWN0ID0gbmV3IEVtaXR0ZXI8dGhpcz4oKTtcblx0cmVhZG9ubHkgb25EaWRDb25mbGljdDogRXZlbnQ8dGhpcz4gPSB0aGlzLl9vbkRpZENvbmZsaWN0LmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXRzOiBSZXNvdXJjZUVkaXRbXSxcblx0XHRASUZpbGVTZXJ2aWNlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cblx0XHRjb25zdCBfd29ya3NwYWNlRWRpdFJlc291cmNlcyA9IG5ldyBSZXNvdXJjZU1hcDxib29sZWFuPigpO1xuXG5cdFx0Zm9yIChjb25zdCBlZGl0IG9mIGVkaXRzKSB7XG5cdFx0XHRpZiAoZWRpdCBpbnN0YW5jZW9mIFJlc291cmNlVGV4dEVkaXQpIHtcblx0XHRcdFx0X3dvcmtzcGFjZUVkaXRSZXNvdXJjZXMuc2V0KGVkaXQucmVzb3VyY2UsIHRydWUpO1xuXHRcdFx0XHRpZiAodHlwZW9mIGVkaXQudmVyc2lvbklkID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdGNvbnN0IG1vZGVsID0gbW9kZWxTZXJ2aWNlLmdldE1vZGVsKGVkaXQucmVzb3VyY2UpO1xuXHRcdFx0XHRcdGlmIChtb2RlbCAmJiBtb2RlbC5nZXRWZXJzaW9uSWQoKSAhPT0gZWRpdC52ZXJzaW9uSWQpIHtcblx0XHRcdFx0XHRcdHRoaXMuX2NvbmZsaWN0cy5zZXQoZWRpdC5yZXNvdXJjZSwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHR0aGlzLl9vbkRpZENvbmZsaWN0LmZpcmUodGhpcyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdH0gZWxzZSBpZiAoZWRpdCBpbnN0YW5jZW9mIFJlc291cmNlRmlsZUVkaXQpIHtcblx0XHRcdFx0aWYgKGVkaXQubmV3UmVzb3VyY2UpIHtcblx0XHRcdFx0XHRfd29ya3NwYWNlRWRpdFJlc291cmNlcy5zZXQoZWRpdC5uZXdSZXNvdXJjZSwgdHJ1ZSk7XG5cblx0XHRcdFx0fSBlbHNlIGlmIChlZGl0Lm9sZFJlc291cmNlKSB7XG5cdFx0XHRcdFx0X3dvcmtzcGFjZUVkaXRSZXNvdXJjZXMuc2V0KGVkaXQub2xkUmVzb3VyY2UsIHRydWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKGVkaXQgaW5zdGFuY2VvZiBSZXNvdXJjZU5vdGVib29rQ2VsbEVkaXQpIHtcblx0XHRcdFx0X3dvcmtzcGFjZUVkaXRSZXNvdXJjZXMuc2V0KGVkaXQucmVzb3VyY2UsIHRydWUpO1xuXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsb2dTZXJ2aWNlLndhcm4oJ1VOS05PV04gZWRpdCB0eXBlJywgZWRpdCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gbGlzdGVuIHRvIGZpbGUgY2hhbmdlc1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChmaWxlU2VydmljZS5vbkRpZEZpbGVzQ2hhbmdlKGUgPT4ge1xuXG5cdFx0XHRmb3IgKGNvbnN0IHVyaSBvZiBfd29ya3NwYWNlRWRpdFJlc291cmNlcy5rZXlzKCkpIHtcblx0XHRcdFx0Ly8gY29uZmxpY3QgaGFwcGVucyB3aGVuIGEgZmlsZSB0aGF0IHdlIGFyZSB3b3JraW5nXG5cdFx0XHRcdC8vIG9uIGNoYW5nZXMgb24gZGlzay4gaWdub3JlIGNoYW5nZXMgZm9yIHdoaWNoIGEgbW9kZWxcblx0XHRcdFx0Ly8gZXhpc3RzIGJlY2F1c2Ugd2UgaGF2ZSBhIGJldHRlciBjaGVjayBmb3IgbW9kZWxzXG5cdFx0XHRcdGlmICghbW9kZWxTZXJ2aWNlLmdldE1vZGVsKHVyaSkgJiYgZS5jb250YWlucyh1cmkpKSB7XG5cdFx0XHRcdFx0dGhpcy5fY29uZmxpY3RzLnNldCh1cmksIHRydWUpO1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkQ29uZmxpY3QuZmlyZSh0aGlzKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIGxpc3RlbiB0byBtb2RlbCBjaGFuZ2VzLi4uP1xuXHRcdGNvbnN0IG9uRGlkQ2hhbmdlTW9kZWwgPSAobW9kZWw6IElUZXh0TW9kZWwpID0+IHtcblxuXHRcdFx0Ly8gY29uZmxpY3Rcblx0XHRcdGlmIChfd29ya3NwYWNlRWRpdFJlc291cmNlcy5oYXMobW9kZWwudXJpKSkge1xuXHRcdFx0XHR0aGlzLl9jb25mbGljdHMuc2V0KG1vZGVsLnVyaSwgdHJ1ZSk7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ29uZmxpY3QuZmlyZSh0aGlzKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdGZvciAoY29uc3QgbW9kZWwgb2YgbW9kZWxTZXJ2aWNlLmdldE1vZGVscygpKSB7XG5cdFx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQobW9kZWwub25EaWRDaGFuZ2VDb250ZW50KCgpID0+IG9uRGlkQ2hhbmdlTW9kZWwobW9kZWwpKSk7XG5cdFx0fVxuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fb25EaWRDb25mbGljdC5kaXNwb3NlKCk7XG5cdH1cblxuXHRsaXN0KCk6IFVSSVtdIHtcblx0XHRyZXR1cm4gWy4uLnRoaXMuX2NvbmZsaWN0cy5rZXlzKCldO1xuXHR9XG5cblx0aGFzQ29uZmxpY3RzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9jb25mbGljdHMuc2l6ZSA+IDA7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxvQkFBb0I7QUFFN0IsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxlQUFzQjtBQUUvQixTQUF1QixrQkFBa0Isd0JBQXdCO0FBQ2pFLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsbUJBQW1CO0FBRXJCLElBQU0sbUJBQU4sTUFBdUI7QUFBQSxFQVE3QixZQUNDLE9BQ2MsYUFDQyxjQUNGLFlBQ1o7QUFYRixTQUFpQixhQUFhLElBQUksWUFBcUI7QUFDdkQsU0FBaUIsZUFBZSxJQUFJLGdCQUFnQjtBQUVwRCxTQUFpQixpQkFBaUIsSUFBSSxRQUFjO0FBQ3BELFNBQVMsZ0JBQTZCLEtBQUssZUFBZTtBQVN6RCxVQUFNLDBCQUEwQixJQUFJLFlBQXFCO0FBRXpELGVBQVcsUUFBUSxPQUFPO0FBQ3pCLFVBQUksZ0JBQWdCLGtCQUFrQjtBQUNyQyxnQ0FBd0IsSUFBSSxLQUFLLFVBQVUsSUFBSTtBQUMvQyxZQUFJLE9BQU8sS0FBSyxjQUFjLFVBQVU7QUFDdkMsZ0JBQU0sUUFBUSxhQUFhLFNBQVMsS0FBSyxRQUFRO0FBQ2pELGNBQUksU0FBUyxNQUFNLGFBQWEsTUFBTSxLQUFLLFdBQVc7QUFDckQsaUJBQUssV0FBVyxJQUFJLEtBQUssVUFBVSxJQUFJO0FBQ3ZDLGlCQUFLLGVBQWUsS0FBSyxJQUFJO0FBQUEsVUFDOUI7QUFBQSxRQUNEO0FBQUEsTUFFRCxXQUFXLGdCQUFnQixrQkFBa0I7QUFDNUMsWUFBSSxLQUFLLGFBQWE7QUFDckIsa0NBQXdCLElBQUksS0FBSyxhQUFhLElBQUk7QUFBQSxRQUVuRCxXQUFXLEtBQUssYUFBYTtBQUM1QixrQ0FBd0IsSUFBSSxLQUFLLGFBQWEsSUFBSTtBQUFBLFFBQ25EO0FBQUEsTUFDRCxXQUFXLGdCQUFnQiwwQkFBMEI7QUFDcEQsZ0NBQXdCLElBQUksS0FBSyxVQUFVLElBQUk7QUFBQSxNQUVoRCxPQUFPO0FBQ04sbUJBQVcsS0FBSyxxQkFBcUIsSUFBSTtBQUFBLE1BQzFDO0FBQUEsSUFDRDtBQUdBLFNBQUssYUFBYSxJQUFJLFlBQVksaUJBQWlCLE9BQUs7QUFFdkQsaUJBQVcsT0FBTyx3QkFBd0IsS0FBSyxHQUFHO0FBSWpELFlBQUksQ0FBQyxhQUFhLFNBQVMsR0FBRyxLQUFLLEVBQUUsU0FBUyxHQUFHLEdBQUc7QUFDbkQsZUFBSyxXQUFXLElBQUksS0FBSyxJQUFJO0FBQzdCLGVBQUssZUFBZSxLQUFLLElBQUk7QUFDN0I7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBR0YsVUFBTSxtQkFBbUIsQ0FBQyxVQUFzQjtBQUcvQyxVQUFJLHdCQUF3QixJQUFJLE1BQU0sR0FBRyxHQUFHO0FBQzNDLGFBQUssV0FBVyxJQUFJLE1BQU0sS0FBSyxJQUFJO0FBQ25DLGFBQUssZUFBZSxLQUFLLElBQUk7QUFBQSxNQUM5QjtBQUFBLElBQ0Q7QUFDQSxlQUFXLFNBQVMsYUFBYSxVQUFVLEdBQUc7QUFDN0MsV0FBSyxhQUFhLElBQUksTUFBTSxtQkFBbUIsTUFBTSxpQkFBaUIsS0FBSyxDQUFDLENBQUM7QUFBQSxJQUM5RTtBQUFBLEVBQ0Q7QUFBQSxFQUVBLFVBQWdCO0FBQ2YsU0FBSyxhQUFhLFFBQVE7QUFDMUIsU0FBSyxlQUFlLFFBQVE7QUFBQSxFQUM3QjtBQUFBLEVBRUEsT0FBYztBQUNiLFdBQU8sQ0FBQyxHQUFHLEtBQUssV0FBVyxLQUFLLENBQUM7QUFBQSxFQUNsQztBQUFBLEVBRUEsZUFBd0I7QUFDdkIsV0FBTyxLQUFLLFdBQVcsT0FBTztBQUFBLEVBQy9CO0FBQ0Q7QUFwRmEsbUJBQU47QUFBQSxFQVVKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVpVOyIsCiAgIm5hbWVzIjogW10KfQo=
