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
import { isObject } from "../../../../base/common/types.js";
import { ResourceEdit } from "../../../../editor/browser/services/bulkEditService.js";
import { IUndoRedoService, UndoRedoElementType } from "../../../../platform/undoRedo/common/undoRedo.js";
class ResourceAttachmentEdit extends ResourceEdit {
  constructor(resource, undo, redo, metadata) {
    super(metadata);
    this.resource = resource;
    this.undo = undo;
    this.redo = redo;
  }
  static is(candidate) {
    if (candidate instanceof ResourceAttachmentEdit) {
      return true;
    } else {
      return isObject(candidate) && Boolean(candidate.undo && candidate.redo);
    }
  }
  static lift(edit) {
    if (edit instanceof ResourceAttachmentEdit) {
      return edit;
    } else {
      return new ResourceAttachmentEdit(edit.resource, edit.undo, edit.redo, edit.metadata);
    }
  }
}
let OpaqueEdits = class {
  constructor(_undoRedoGroup, _undoRedoSource, _progress, _token, _edits, _undoRedoService) {
    this._undoRedoGroup = _undoRedoGroup;
    this._undoRedoSource = _undoRedoSource;
    this._progress = _progress;
    this._token = _token;
    this._edits = _edits;
    this._undoRedoService = _undoRedoService;
  }
  async apply() {
    const resources = [];
    for (const edit of this._edits) {
      if (this._token.isCancellationRequested) {
        break;
      }
      await edit.redo();
      this._undoRedoService.pushElement({
        type: UndoRedoElementType.Resource,
        resource: edit.resource,
        label: edit.metadata?.label || "Custom Edit",
        code: "paste",
        undo: edit.undo,
        redo: edit.redo
      }, this._undoRedoGroup, this._undoRedoSource);
      this._progress.report(void 0);
      resources.push(edit.resource);
    }
    return resources;
  }
};
OpaqueEdits = __decorateClass([
  __decorateParam(5, IUndoRedoService)
], OpaqueEdits);
export {
  OpaqueEdits,
  ResourceAttachmentEdit
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9idWxrRWRpdC9icm93c2VyL29wYXF1ZUVkaXRzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgaXNPYmplY3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VFZGl0IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvYnVsa0VkaXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDdXN0b21FZGl0LCBXb3Jrc3BhY2VFZGl0TWV0YWRhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJUHJvZ3Jlc3MgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgSVVuZG9SZWRvU2VydmljZSwgVW5kb1JlZG9FbGVtZW50VHlwZSwgVW5kb1JlZG9Hcm91cCwgVW5kb1JlZG9Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91bmRvUmVkby9jb21tb24vdW5kb1JlZG8uanMnO1xuXG5leHBvcnQgY2xhc3MgUmVzb3VyY2VBdHRhY2htZW50RWRpdCBleHRlbmRzIFJlc291cmNlRWRpdCBpbXBsZW1lbnRzIElDdXN0b21FZGl0IHtcblxuXHRzdGF0aWMgaXMoY2FuZGlkYXRlOiBhbnkpOiBjYW5kaWRhdGUgaXMgSUN1c3RvbUVkaXQge1xuXHRcdGlmIChjYW5kaWRhdGUgaW5zdGFuY2VvZiBSZXNvdXJjZUF0dGFjaG1lbnRFZGl0KSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIGlzT2JqZWN0KGNhbmRpZGF0ZSlcblx0XHRcdFx0JiYgKEJvb2xlYW4oKDxJQ3VzdG9tRWRpdD5jYW5kaWRhdGUpLnVuZG8gJiYgKDxJQ3VzdG9tRWRpdD5jYW5kaWRhdGUpLnJlZG8pKTtcblx0XHR9XG5cdH1cblxuXHRzdGF0aWMgbGlmdChlZGl0OiBJQ3VzdG9tRWRpdCk6IFJlc291cmNlQXR0YWNobWVudEVkaXQge1xuXHRcdGlmIChlZGl0IGluc3RhbmNlb2YgUmVzb3VyY2VBdHRhY2htZW50RWRpdCkge1xuXHRcdFx0cmV0dXJuIGVkaXQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBuZXcgUmVzb3VyY2VBdHRhY2htZW50RWRpdChlZGl0LnJlc291cmNlLCBlZGl0LnVuZG8sIGVkaXQucmVkbywgZWRpdC5tZXRhZGF0YSk7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgcmVzb3VyY2U6IFVSSSxcblx0XHRyZWFkb25seSB1bmRvOiAoKSA9PiBQcm9taXNlPHZvaWQ+IHwgdm9pZCxcblx0XHRyZWFkb25seSByZWRvOiAoKSA9PiBQcm9taXNlPHZvaWQ+IHwgdm9pZCxcblx0XHRtZXRhZGF0YT86IFdvcmtzcGFjZUVkaXRNZXRhZGF0YVxuXHQpIHtcblx0XHRzdXBlcihtZXRhZGF0YSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE9wYXF1ZUVkaXRzIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF91bmRvUmVkb0dyb3VwOiBVbmRvUmVkb0dyb3VwLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3VuZG9SZWRvU291cmNlOiBVbmRvUmVkb1NvdXJjZSB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wcm9ncmVzczogSVByb2dyZXNzPHZvaWQ+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Rva2VuOiBDYW5jZWxsYXRpb25Ub2tlbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0czogUmVzb3VyY2VBdHRhY2htZW50RWRpdFtdLFxuXHRcdEBJVW5kb1JlZG9TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3VuZG9SZWRvU2VydmljZTogSVVuZG9SZWRvU2VydmljZSxcblx0KSB7IH1cblxuXHRhc3luYyBhcHBseSgpOiBQcm9taXNlPHJlYWRvbmx5IFVSSVtdPiB7XG5cdFx0Y29uc3QgcmVzb3VyY2VzOiBVUklbXSA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCBlZGl0IG9mIHRoaXMuX2VkaXRzKSB7XG5cdFx0XHRpZiAodGhpcy5fdG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdGF3YWl0IGVkaXQucmVkbygpO1xuXG5cdFx0XHR0aGlzLl91bmRvUmVkb1NlcnZpY2UucHVzaEVsZW1lbnQoe1xuXHRcdFx0XHR0eXBlOiBVbmRvUmVkb0VsZW1lbnRUeXBlLlJlc291cmNlLFxuXHRcdFx0XHRyZXNvdXJjZTogZWRpdC5yZXNvdXJjZSxcblx0XHRcdFx0bGFiZWw6IGVkaXQubWV0YWRhdGE/LmxhYmVsIHx8ICdDdXN0b20gRWRpdCcsXG5cdFx0XHRcdGNvZGU6ICdwYXN0ZScsXG5cdFx0XHRcdHVuZG86IGVkaXQudW5kbyxcblx0XHRcdFx0cmVkbzogZWRpdC5yZWRvLFxuXHRcdFx0fSwgdGhpcy5fdW5kb1JlZG9Hcm91cCwgdGhpcy5fdW5kb1JlZG9Tb3VyY2UpO1xuXG5cdFx0XHR0aGlzLl9wcm9ncmVzcy5yZXBvcnQodW5kZWZpbmVkKTtcblx0XHRcdHJlc291cmNlcy5wdXNoKGVkaXQucmVzb3VyY2UpO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXNvdXJjZXM7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBTUEsU0FBUyxnQkFBZ0I7QUFFekIsU0FBUyxvQkFBb0I7QUFHN0IsU0FBUyxrQkFBa0IsMkJBQTBEO0FBRTlFLE1BQU0sK0JBQStCLGFBQW9DO0FBQUEsRUFtQi9FLFlBQ1UsVUFDQSxNQUNBLE1BQ1QsVUFDQztBQUNELFVBQU0sUUFBUTtBQUxMO0FBQ0E7QUFDQTtBQUFBLEVBSVY7QUFBQSxFQXhCQSxPQUFPLEdBQUcsV0FBMEM7QUFDbkQsUUFBSSxxQkFBcUIsd0JBQXdCO0FBQ2hELGFBQU87QUFBQSxJQUNSLE9BQU87QUFDTixhQUFPLFNBQVMsU0FBUyxLQUNwQixRQUFzQixVQUFXLFFBQXNCLFVBQVcsSUFBSTtBQUFBLElBQzVFO0FBQUEsRUFDRDtBQUFBLEVBRUEsT0FBTyxLQUFLLE1BQTJDO0FBQ3RELFFBQUksZ0JBQWdCLHdCQUF3QjtBQUMzQyxhQUFPO0FBQUEsSUFDUixPQUFPO0FBQ04sYUFBTyxJQUFJLHVCQUF1QixLQUFLLFVBQVUsS0FBSyxNQUFNLEtBQUssTUFBTSxLQUFLLFFBQVE7QUFBQSxJQUNyRjtBQUFBLEVBQ0Q7QUFVRDtBQUVPLElBQU0sY0FBTixNQUFrQjtBQUFBLEVBRXhCLFlBQ2tCLGdCQUNBLGlCQUNBLFdBQ0EsUUFDQSxRQUNrQixrQkFDbEM7QUFOZ0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNrQjtBQUFBLEVBQ2hDO0FBQUEsRUFFSixNQUFNLFFBQWlDO0FBQ3RDLFVBQU0sWUFBbUIsQ0FBQztBQUUxQixlQUFXLFFBQVEsS0FBSyxRQUFRO0FBQy9CLFVBQUksS0FBSyxPQUFPLHlCQUF5QjtBQUN4QztBQUFBLE1BQ0Q7QUFFQSxZQUFNLEtBQUssS0FBSztBQUVoQixXQUFLLGlCQUFpQixZQUFZO0FBQUEsUUFDakMsTUFBTSxvQkFBb0I7QUFBQSxRQUMxQixVQUFVLEtBQUs7QUFBQSxRQUNmLE9BQU8sS0FBSyxVQUFVLFNBQVM7QUFBQSxRQUMvQixNQUFNO0FBQUEsUUFDTixNQUFNLEtBQUs7QUFBQSxRQUNYLE1BQU0sS0FBSztBQUFBLE1BQ1osR0FBRyxLQUFLLGdCQUFnQixLQUFLLGVBQWU7QUFFNUMsV0FBSyxVQUFVLE9BQU8sTUFBUztBQUMvQixnQkFBVSxLQUFLLEtBQUssUUFBUTtBQUFBLElBQzdCO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQXBDYSxjQUFOO0FBQUEsRUFRSjtBQUFBLEdBUlU7IiwKICAibmFtZXMiOiBbXQp9Cg==
