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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { IVoidModelService } from "../common/voidModelService.js";
let ConvertContribWorkbenchContribution = class extends Disposable {
  constructor(voidModelService, workspaceContext) {
    super();
    this.voidModelService = voidModelService;
    this.workspaceContext = workspaceContext;
    const initializeURI = (uri) => {
      this.workspaceContext.getWorkspace();
      const voidRulesURI = URI.joinPath(uri, ".voidrules");
      this.voidModelService.initializeModel(voidRulesURI);
    };
    this._register(this.workspaceContext.onDidChangeWorkspaceFolders((e) => {
      [...e.changed, ...e.added].forEach((w) => {
        initializeURI(w.uri);
      });
    }));
    this.workspaceContext.getWorkspace().folders.forEach((w) => {
      initializeURI(w.uri);
    });
  }
};
ConvertContribWorkbenchContribution.ID = "workbench.contrib.void.convertcontrib";
ConvertContribWorkbenchContribution = __decorateClass([
  __decorateParam(0, IVoidModelService),
  __decorateParam(1, IWorkspaceContextService)
], ConvertContribWorkbenchContribution);
registerWorkbenchContribution2(ConvertContribWorkbenchContribution.ID, ConvertContribWorkbenchContribution, WorkbenchPhase.BlockRestore);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvY29udmVydFRvTExNTWVzc2FnZVdvcmtiZW5jaENvbnRyaWIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgMjAyNSBHbGFzcyBEZXZ0b29scywgSW5jLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAuIFNlZSBMSUNFTlNFLnR4dCBmb3IgbW9yZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uLCByZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIsIFdvcmtiZW5jaFBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgSVZvaWRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vdm9pZE1vZGVsU2VydmljZS5qcyc7XG5cbmNsYXNzIENvbnZlcnRDb250cmliV29ya2JlbmNoQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIudm9pZC5jb252ZXJ0Y29udHJpYidcblx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVm9pZE1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHZvaWRNb2RlbFNlcnZpY2U6IElWb2lkTW9kZWxTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VDb250ZXh0OiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKClcblxuXHRcdGNvbnN0IGluaXRpYWxpemVVUkkgPSAodXJpOiBVUkkpID0+IHtcblx0XHRcdHRoaXMud29ya3NwYWNlQ29udGV4dC5nZXRXb3Jrc3BhY2UoKVxuXHRcdFx0Y29uc3Qgdm9pZFJ1bGVzVVJJID0gVVJJLmpvaW5QYXRoKHVyaSwgJy52b2lkcnVsZXMnKVxuXHRcdFx0dGhpcy52b2lkTW9kZWxTZXJ2aWNlLmluaXRpYWxpemVNb2RlbCh2b2lkUnVsZXNVUkkpXG5cdFx0fVxuXG5cdFx0Ly8gY2FsbFxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMud29ya3NwYWNlQ29udGV4dC5vbkRpZENoYW5nZVdvcmtzcGFjZUZvbGRlcnMoKGUpID0+IHtcblx0XHRcdFsuLi5lLmNoYW5nZWQsIC4uLmUuYWRkZWRdLmZvckVhY2godyA9PiB7IGluaXRpYWxpemVVUkkody51cmkpIH0pXG5cdFx0fSkpXG5cdFx0dGhpcy53b3Jrc3BhY2VDb250ZXh0LmdldFdvcmtzcGFjZSgpLmZvbGRlcnMuZm9yRWFjaCh3ID0+IHsgaW5pdGlhbGl6ZVVSSSh3LnVyaSkgfSlcblx0fVxufVxuXG5cbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihDb252ZXJ0Q29udHJpYldvcmtiZW5jaENvbnRyaWJ1dGlvbi5JRCwgQ29udmVydENvbnRyaWJXb3JrYmVuY2hDb250cmlidXRpb24sIFdvcmtiZW5jaFBoYXNlLkJsb2NrUmVzdG9yZSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsV0FBVztBQUNwQixTQUFTLGdDQUFnQztBQUN6QyxTQUFpQyxnQ0FBZ0Msc0JBQXNCO0FBQ3ZGLFNBQVMseUJBQXlCO0FBRWxDLElBQU0sc0NBQU4sY0FBa0QsV0FBNkM7QUFBQSxFQUk5RixZQUNxQyxrQkFDTyxrQkFDMUM7QUFDRCxVQUFNO0FBSDhCO0FBQ087QUFJM0MsVUFBTSxnQkFBZ0IsQ0FBQyxRQUFhO0FBQ25DLFdBQUssaUJBQWlCLGFBQWE7QUFDbkMsWUFBTSxlQUFlLElBQUksU0FBUyxLQUFLLFlBQVk7QUFDbkQsV0FBSyxpQkFBaUIsZ0JBQWdCLFlBQVk7QUFBQSxJQUNuRDtBQUdBLFNBQUssVUFBVSxLQUFLLGlCQUFpQiw0QkFBNEIsQ0FBQyxNQUFNO0FBQ3ZFLE9BQUMsR0FBRyxFQUFFLFNBQVMsR0FBRyxFQUFFLEtBQUssRUFBRSxRQUFRLE9BQUs7QUFBRSxzQkFBYyxFQUFFLEdBQUc7QUFBQSxNQUFFLENBQUM7QUFBQSxJQUNqRSxDQUFDLENBQUM7QUFDRixTQUFLLGlCQUFpQixhQUFhLEVBQUUsUUFBUSxRQUFRLE9BQUs7QUFBRSxvQkFBYyxFQUFFLEdBQUc7QUFBQSxJQUFFLENBQUM7QUFBQSxFQUNuRjtBQUNEO0FBdEJNLG9DQUNXLEtBQUs7QUFEaEIsc0NBQU47QUFBQSxFQUtHO0FBQUEsRUFDQTtBQUFBLEdBTkc7QUF5Qk4sK0JBQStCLG9DQUFvQyxJQUFJLHFDQUFxQyxlQUFlLFlBQVk7IiwKICAibmFtZXMiOiBbXQp9Cg==
