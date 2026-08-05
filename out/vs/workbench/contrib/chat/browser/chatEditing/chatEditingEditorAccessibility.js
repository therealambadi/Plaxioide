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
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { autorun, observableFromEvent } from "../../../../../base/common/observable.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IChatEditingService } from "../../common/chatEditingService.js";
let ChatEditingEditorAccessibility = class {
  constructor(chatEditingService, editorService, accessibilityService) {
    this._store = new DisposableStore();
    const activeUri = observableFromEvent(this, editorService.onDidActiveEditorChange, () => editorService.activeEditorPane?.input.resource);
    this._store.add(autorun((r) => {
      const editor = activeUri.read(r);
      if (!editor) {
        return;
      }
      const entry = chatEditingService.editingSessionsObs.read(r).find((session) => session.readEntry(editor, r));
      if (entry) {
        accessibilityService.playSignal(AccessibilitySignal.chatEditModifiedFile);
      }
    }));
  }
  dispose() {
    this._store.dispose();
  }
};
ChatEditingEditorAccessibility.ID = "chat.edits.accessibilty";
ChatEditingEditorAccessibility = __decorateClass([
  __decorateParam(0, IChatEditingService),
  __decorateParam(1, IEditorService),
  __decorateParam(2, IAccessibilitySignalService)
], ChatEditingEditorAccessibility);
export {
  ChatEditingEditorAccessibility
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRpbmcvY2hhdEVkaXRpbmdFZGl0b3JBY2Nlc3NpYmlsaXR5LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGF1dG9ydW4sIG9ic2VydmFibGVGcm9tRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlTaWduYWwsIElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHlTaWduYWwvYnJvd3Nlci9hY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRFZGl0aW5nU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0RWRpdGluZ1NlcnZpY2UuanMnO1xuXG5leHBvcnQgY2xhc3MgQ2hhdEVkaXRpbmdFZGl0b3JBY2Nlc3NpYmlsaXR5IGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ2NoYXQuZWRpdHMuYWNjZXNzaWJpbHR5JztcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNoYXRFZGl0aW5nU2VydmljZSBjaGF0RWRpdGluZ1NlcnZpY2U6IElDaGF0RWRpdGluZ1NlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UgYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZVxuXHQpIHtcblxuXHRcdGNvbnN0IGFjdGl2ZVVyaSA9IG9ic2VydmFibGVGcm9tRXZlbnQodGhpcywgZWRpdG9yU2VydmljZS5vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSwgKCkgPT4gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lPy5pbnB1dC5yZXNvdXJjZSk7XG5cblx0XHR0aGlzLl9zdG9yZS5hZGQoYXV0b3J1bihyID0+IHtcblxuXHRcdFx0Y29uc3QgZWRpdG9yID0gYWN0aXZlVXJpLnJlYWQocik7XG5cdFx0XHRpZiAoIWVkaXRvcikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGVudHJ5ID0gY2hhdEVkaXRpbmdTZXJ2aWNlLmVkaXRpbmdTZXNzaW9uc09icy5yZWFkKHIpLmZpbmQoc2Vzc2lvbiA9PiBzZXNzaW9uLnJlYWRFbnRyeShlZGl0b3IsIHIpKTtcblx0XHRcdGlmIChlbnRyeSkge1xuXHRcdFx0XHRhY2Nlc3NpYmlsaXR5U2VydmljZS5wbGF5U2lnbmFsKEFjY2Vzc2liaWxpdHlTaWduYWwuY2hhdEVkaXRNb2RpZmllZEZpbGUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fc3RvcmUuZGlzcG9zZSgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsU0FBUywyQkFBMkI7QUFDN0MsU0FBUyxxQkFBcUIsbUNBQW1DO0FBRWpFLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMkJBQTJCO0FBRTdCLElBQU0saUNBQU4sTUFBdUU7QUFBQSxFQU03RSxZQUNzQixvQkFDTCxlQUNhLHNCQUM1QjtBQU5GLFNBQWlCLFNBQVMsSUFBSSxnQkFBZ0I7QUFRN0MsVUFBTSxZQUFZLG9CQUFvQixNQUFNLGNBQWMseUJBQXlCLE1BQU0sY0FBYyxrQkFBa0IsTUFBTSxRQUFRO0FBRXZJLFNBQUssT0FBTyxJQUFJLFFBQVEsT0FBSztBQUU1QixZQUFNLFNBQVMsVUFBVSxLQUFLLENBQUM7QUFDL0IsVUFBSSxDQUFDLFFBQVE7QUFDWjtBQUFBLE1BQ0Q7QUFFQSxZQUFNLFFBQVEsbUJBQW1CLG1CQUFtQixLQUFLLENBQUMsRUFBRSxLQUFLLGFBQVcsUUFBUSxVQUFVLFFBQVEsQ0FBQyxDQUFDO0FBQ3hHLFVBQUksT0FBTztBQUNWLDZCQUFxQixXQUFXLG9CQUFvQixvQkFBb0I7QUFBQSxNQUN6RTtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRUEsVUFBZ0I7QUFDZixTQUFLLE9BQU8sUUFBUTtBQUFBLEVBQ3JCO0FBQ0Q7QUEvQmEsK0JBRUksS0FBSztBQUZULGlDQUFOO0FBQUEsRUFPSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FUVTsiLAogICJuYW1lcyI6IFtdCn0K
