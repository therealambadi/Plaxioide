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
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { getEditorFeatures } from "../../../../editor/common/editorFeatures.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
let EditorFeaturesInstantiator = class extends Disposable {
  constructor(codeEditorService, _instantiationService) {
    super();
    this._instantiationService = _instantiationService;
    this._instantiated = false;
    this._register(codeEditorService.onWillCreateCodeEditor(() => this._instantiate()));
    this._register(codeEditorService.onWillCreateDiffEditor(() => this._instantiate()));
    if (codeEditorService.listCodeEditors().length > 0 || codeEditorService.listDiffEditors().length > 0) {
      this._instantiate();
    }
  }
  _instantiate() {
    if (this._instantiated) {
      return;
    }
    this._instantiated = true;
    const editorFeatures = getEditorFeatures();
    for (const feature of editorFeatures) {
      try {
        const instance = this._instantiationService.createInstance(feature);
        if (typeof instance.dispose === "function") {
          this._register(instance);
        }
      } catch (err) {
        onUnexpectedError(err);
      }
    }
  }
};
EditorFeaturesInstantiator.ID = "workbench.contrib.editorFeaturesInstantiator";
EditorFeaturesInstantiator = __decorateClass([
  __decorateParam(0, ICodeEditorService),
  __decorateParam(1, IInstantiationService)
], EditorFeaturesInstantiator);
registerWorkbenchContribution2(EditorFeaturesInstantiator.ID, EditorFeaturesInstantiator, WorkbenchPhase.BlockRestore);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL2Jyb3dzZXIvZWRpdG9yRmVhdHVyZXMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBnZXRFZGl0b3JGZWF0dXJlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZSwgcmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuXG5jbGFzcyBFZGl0b3JGZWF0dXJlc0luc3RhbnRpYXRvciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIuZWRpdG9yRmVhdHVyZXNJbnN0YW50aWF0b3InO1xuXG5cdHByaXZhdGUgX2luc3RhbnRpYXRlZCA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgY29kZUVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvZGVFZGl0b3JTZXJ2aWNlLm9uV2lsbENyZWF0ZUNvZGVFZGl0b3IoKCkgPT4gdGhpcy5faW5zdGFudGlhdGUoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvZGVFZGl0b3JTZXJ2aWNlLm9uV2lsbENyZWF0ZURpZmZFZGl0b3IoKCkgPT4gdGhpcy5faW5zdGFudGlhdGUoKSkpO1xuXHRcdGlmIChjb2RlRWRpdG9yU2VydmljZS5saXN0Q29kZUVkaXRvcnMoKS5sZW5ndGggPiAwIHx8IGNvZGVFZGl0b3JTZXJ2aWNlLmxpc3REaWZmRWRpdG9ycygpLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuX2luc3RhbnRpYXRlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfaW5zdGFudGlhdGUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2luc3RhbnRpYXRlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9pbnN0YW50aWF0ZWQgPSB0cnVlO1xuXG5cdFx0Ly8gSW5zdGFudGlhdGUgYWxsIGVkaXRvciBmZWF0dXJlc1xuXHRcdGNvbnN0IGVkaXRvckZlYXR1cmVzID0gZ2V0RWRpdG9yRmVhdHVyZXMoKTtcblx0XHRmb3IgKGNvbnN0IGZlYXR1cmUgb2YgZWRpdG9yRmVhdHVyZXMpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGluc3RhbmNlID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoZmVhdHVyZSk7XG5cdFx0XHRcdGlmICh0eXBlb2YgKDxJRGlzcG9zYWJsZT5pbnN0YW5jZSkuZGlzcG9zZSA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKCg8SURpc3Bvc2FibGU+aW5zdGFuY2UpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGVycik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihFZGl0b3JGZWF0dXJlc0luc3RhbnRpYXRvci5JRCwgRWRpdG9yRmVhdHVyZXNJbnN0YW50aWF0b3IsIFdvcmtiZW5jaFBoYXNlLkJsb2NrUmVzdG9yZSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsa0JBQStCO0FBQ3hDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQWlDLGdCQUFnQixzQ0FBc0M7QUFFdkYsSUFBTSw2QkFBTixjQUF5QyxXQUE2QztBQUFBLEVBTXJGLFlBQ3FCLG1CQUNvQix1QkFDdkM7QUFDRCxVQUFNO0FBRmtDO0FBSnpDLFNBQVEsZ0JBQWdCO0FBUXZCLFNBQUssVUFBVSxrQkFBa0IsdUJBQXVCLE1BQU0sS0FBSyxhQUFhLENBQUMsQ0FBQztBQUNsRixTQUFLLFVBQVUsa0JBQWtCLHVCQUF1QixNQUFNLEtBQUssYUFBYSxDQUFDLENBQUM7QUFDbEYsUUFBSSxrQkFBa0IsZ0JBQWdCLEVBQUUsU0FBUyxLQUFLLGtCQUFrQixnQkFBZ0IsRUFBRSxTQUFTLEdBQUc7QUFDckcsV0FBSyxhQUFhO0FBQUEsSUFDbkI7QUFBQSxFQUNEO0FBQUEsRUFFUSxlQUFxQjtBQUM1QixRQUFJLEtBQUssZUFBZTtBQUN2QjtBQUFBLElBQ0Q7QUFDQSxTQUFLLGdCQUFnQjtBQUdyQixVQUFNLGlCQUFpQixrQkFBa0I7QUFDekMsZUFBVyxXQUFXLGdCQUFnQjtBQUNyQyxVQUFJO0FBQ0gsY0FBTSxXQUFXLEtBQUssc0JBQXNCLGVBQWUsT0FBTztBQUNsRSxZQUFJLE9BQXFCLFNBQVUsWUFBWSxZQUFZO0FBQzFELGVBQUssVUFBd0IsUUFBUztBQUFBLFFBQ3ZDO0FBQUEsTUFDRCxTQUFTLEtBQUs7QUFDYiwwQkFBa0IsR0FBRztBQUFBLE1BQ3RCO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQXRDTSwyQkFFVyxLQUFLO0FBRmhCLDZCQUFOO0FBQUEsRUFPRztBQUFBLEVBQ0E7QUFBQSxHQVJHO0FBd0NOLCtCQUErQiwyQkFBMkIsSUFBSSw0QkFBNEIsZUFBZSxZQUFZOyIsCiAgIm5hbWVzIjogW10KfQo=
