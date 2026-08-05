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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { autorunWithStore } from "../../../../../base/common/observable.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { CodeEditorWidget } from "../../../../browser/widget/codeEditor/codeEditorWidget.js";
import { StructuredLogger } from "../structuredLogger.js";
let TextModelChangeRecorder = class extends Disposable {
  constructor(_editor, _instantiationService) {
    super();
    this._editor = _editor;
    this._instantiationService = _instantiationService;
    this._structuredLogger = this._register(this._instantiationService.createInstance(
      StructuredLogger.cast(),
      "editor.inlineSuggest.logChangeReason.commandId"
    ));
    this._register(autorunWithStore((reader, store) => {
      if (!(this._editor instanceof CodeEditorWidget)) {
        return;
      }
      if (!this._structuredLogger.isEnabled.read(reader)) {
        return;
      }
      const sources = [];
      store.add(this._editor.onBeforeExecuteEdit(({ source }) => {
        if (source) {
          sources.push(source);
        }
      }));
      store.add(this._editor.onDidChangeModelContent((e) => {
        const tm = this._editor.getModel();
        if (!tm) {
          return;
        }
        for (const source of sources) {
          const data = {
            sourceId: "TextModel.setChangeReason",
            source,
            time: Date.now(),
            modelUri: tm.uri.toString(),
            modelVersion: tm.getVersionId()
          };
          this._structuredLogger.log(data);
        }
        sources.length = 0;
      }));
    }));
  }
};
TextModelChangeRecorder = __decorateClass([
  __decorateParam(1, IInstantiationService)
], TextModelChangeRecorder);
export {
  TextModelChangeRecorder
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL21vZGVsL2NoYW5nZVJlY29yZGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBhdXRvcnVuV2l0aFN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IENvZGVFZGl0b3JXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yL2NvZGVFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgSVJlY29yZGFibGVFZGl0b3JMb2dFbnRyeSwgU3RydWN0dXJlZExvZ2dlciB9IGZyb20gJy4uL3N0cnVjdHVyZWRMb2dnZXIuanMnO1xuXG5leHBvcnQgY2xhc3MgVGV4dE1vZGVsQ2hhbmdlUmVjb3JkZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBfc3RydWN0dXJlZExvZ2dlciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFN0cnVjdHVyZWRMb2dnZXIuY2FzdDxJUmVjb3JkYWJsZUVkaXRvckxvZ0VudHJ5ICYgeyBzb3VyY2U6IHN0cmluZyB9PigpLFxuXHRcdCdlZGl0b3IuaW5saW5lU3VnZ2VzdC5sb2dDaGFuZ2VSZWFzb24uY29tbWFuZElkJ1xuXHQpKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuV2l0aFN0b3JlKChyZWFkZXIsIHN0b3JlKSA9PiB7XG5cdFx0XHRpZiAoISh0aGlzLl9lZGl0b3IgaW5zdGFuY2VvZiBDb2RlRWRpdG9yV2lkZ2V0KSkgeyByZXR1cm47IH1cblx0XHRcdGlmICghdGhpcy5fc3RydWN0dXJlZExvZ2dlci5pc0VuYWJsZWQucmVhZChyZWFkZXIpKSB7IHJldHVybjsgfVxuXG5cdFx0XHRjb25zdCBzb3VyY2VzOiBzdHJpbmdbXSA9IFtdO1xuXG5cdFx0XHRzdG9yZS5hZGQodGhpcy5fZWRpdG9yLm9uQmVmb3JlRXhlY3V0ZUVkaXQoKHsgc291cmNlIH0pID0+IHtcblx0XHRcdFx0aWYgKHNvdXJjZSkge1xuXHRcdFx0XHRcdHNvdXJjZXMucHVzaChzb3VyY2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdHN0b3JlLmFkZCh0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbENvbnRlbnQoZSA9PiB7XG5cdFx0XHRcdGNvbnN0IHRtID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0XHRcdGlmICghdG0pIHsgcmV0dXJuOyB9XG5cdFx0XHRcdGZvciAoY29uc3Qgc291cmNlIG9mIHNvdXJjZXMpIHtcblx0XHRcdFx0XHRjb25zdCBkYXRhOiBJUmVjb3JkYWJsZUVkaXRvckxvZ0VudHJ5ICYgeyBzb3VyY2U6IHN0cmluZyB9ID0ge1xuXHRcdFx0XHRcdFx0c291cmNlSWQ6ICdUZXh0TW9kZWwuc2V0Q2hhbmdlUmVhc29uJyxcblx0XHRcdFx0XHRcdHNvdXJjZTogc291cmNlLFxuXHRcdFx0XHRcdFx0dGltZTogRGF0ZS5ub3coKSxcblx0XHRcdFx0XHRcdG1vZGVsVXJpOiB0bS51cmkudG9TdHJpbmcoKSxcblx0XHRcdFx0XHRcdG1vZGVsVmVyc2lvbjogdG0uZ2V0VmVyc2lvbklkKCksXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR0aGlzLl9zdHJ1Y3R1cmVkTG9nZ2VyLmxvZyhkYXRhKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzb3VyY2VzLmxlbmd0aCA9IDA7XG5cdFx0XHR9KSk7XG5cblx0XHR9KSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyw2QkFBNkI7QUFFdEMsU0FBUyx3QkFBd0I7QUFDakMsU0FBb0Msd0JBQXdCO0FBRXJELElBQU0sMEJBQU4sY0FBc0MsV0FBVztBQUFBLEVBS3ZELFlBQ2tCLFNBQ3VCLHVCQUN2QztBQUNELFVBQU07QUFIVztBQUN1QjtBQU56QyxTQUFpQixvQkFBb0IsS0FBSyxVQUFVLEtBQUssc0JBQXNCO0FBQUEsTUFBZSxpQkFBaUIsS0FBcUQ7QUFBQSxNQUNuSztBQUFBLElBQ0QsQ0FBQztBQU9BLFNBQUssVUFBVSxpQkFBaUIsQ0FBQyxRQUFRLFVBQVU7QUFDbEQsVUFBSSxFQUFFLEtBQUssbUJBQW1CLG1CQUFtQjtBQUFFO0FBQUEsTUFBUTtBQUMzRCxVQUFJLENBQUMsS0FBSyxrQkFBa0IsVUFBVSxLQUFLLE1BQU0sR0FBRztBQUFFO0FBQUEsTUFBUTtBQUU5RCxZQUFNLFVBQW9CLENBQUM7QUFFM0IsWUFBTSxJQUFJLEtBQUssUUFBUSxvQkFBb0IsQ0FBQyxFQUFFLE9BQU8sTUFBTTtBQUMxRCxZQUFJLFFBQVE7QUFDWCxrQkFBUSxLQUFLLE1BQU07QUFBQSxRQUNwQjtBQUFBLE1BQ0QsQ0FBQyxDQUFDO0FBRUYsWUFBTSxJQUFJLEtBQUssUUFBUSx3QkFBd0IsT0FBSztBQUNuRCxjQUFNLEtBQUssS0FBSyxRQUFRLFNBQVM7QUFDakMsWUFBSSxDQUFDLElBQUk7QUFBRTtBQUFBLFFBQVE7QUFDbkIsbUJBQVcsVUFBVSxTQUFTO0FBQzdCLGdCQUFNLE9BQXVEO0FBQUEsWUFDNUQsVUFBVTtBQUFBLFlBQ1Y7QUFBQSxZQUNBLE1BQU0sS0FBSyxJQUFJO0FBQUEsWUFDZixVQUFVLEdBQUcsSUFBSSxTQUFTO0FBQUEsWUFDMUIsY0FBYyxHQUFHLGFBQWE7QUFBQSxVQUMvQjtBQUNBLGVBQUssa0JBQWtCLElBQUksSUFBSTtBQUFBLFFBQ2hDO0FBQ0EsZ0JBQVEsU0FBUztBQUFBLE1BQ2xCLENBQUMsQ0FBQztBQUFBLElBRUgsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUNEO0FBeENhLDBCQUFOO0FBQUEsRUFPSjtBQUFBLEdBUFU7IiwKICAibmFtZXMiOiBbXQp9Cg==
