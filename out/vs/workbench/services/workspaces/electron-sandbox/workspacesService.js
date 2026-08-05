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
import { IWorkspacesService } from "../../../../platform/workspaces/common/workspaces.js";
import { IMainProcessService } from "../../../../platform/ipc/common/mainProcessService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ProxyChannel } from "../../../../base/parts/ipc/common/ipc.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
let NativeWorkspacesService = class {
  constructor(mainProcessService, nativeHostService) {
    return ProxyChannel.toService(mainProcessService.getChannel("workspaces"), { context: nativeHostService.windowId });
  }
};
NativeWorkspacesService = __decorateClass([
  __decorateParam(0, IMainProcessService),
  __decorateParam(1, INativeHostService)
], NativeWorkspacesService);
registerSingleton(IWorkspacesService, NativeWorkspacesService, InstantiationType.Delayed);
export {
  NativeWorkspacesService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvd29ya3NwYWNlcy9lbGVjdHJvbi1zYW5kYm94L3dvcmtzcGFjZXNTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSVdvcmtzcGFjZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlcy9jb21tb24vd29ya3NwYWNlcy5qcyc7XG5pbXBvcnQgeyBJTWFpblByb2Nlc3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaXBjL2NvbW1vbi9tYWluUHJvY2Vzc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBQcm94eUNoYW5uZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3BhcnRzL2lwYy9jb21tb24vaXBjLmpzJztcbmltcG9ydCB7IElOYXRpdmVIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25hdGl2ZS9jb21tb24vbmF0aXZlLmpzJztcblxuLy8gQHRzLWlnbm9yZTogaW50ZXJmYWNlIGlzIGltcGxlbWVudGVkIHZpYSBwcm94eVxuZXhwb3J0IGNsYXNzIE5hdGl2ZVdvcmtzcGFjZXNTZXJ2aWNlIGltcGxlbWVudHMgSVdvcmtzcGFjZXNTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASU1haW5Qcm9jZXNzU2VydmljZSBtYWluUHJvY2Vzc1NlcnZpY2U6IElNYWluUHJvY2Vzc1NlcnZpY2UsXG5cdFx0QElOYXRpdmVIb3N0U2VydmljZSBuYXRpdmVIb3N0U2VydmljZTogSU5hdGl2ZUhvc3RTZXJ2aWNlXG5cdCkge1xuXHRcdHJldHVybiBQcm94eUNoYW5uZWwudG9TZXJ2aWNlPElXb3Jrc3BhY2VzU2VydmljZT4obWFpblByb2Nlc3NTZXJ2aWNlLmdldENoYW5uZWwoJ3dvcmtzcGFjZXMnKSwgeyBjb250ZXh0OiBuYXRpdmVIb3N0U2VydmljZS53aW5kb3dJZCB9KTtcblx0fVxufVxuXG5yZWdpc3RlclNpbmdsZXRvbihJV29ya3NwYWNlc1NlcnZpY2UsIE5hdGl2ZVdvcmtzcGFjZXNTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxtQkFBbUIseUJBQXlCO0FBQ3JELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsMEJBQTBCO0FBRzVCLElBQU0sMEJBQU4sTUFBNEQ7QUFBQSxFQUlsRSxZQUNzQixvQkFDRCxtQkFDbkI7QUFDRCxXQUFPLGFBQWEsVUFBOEIsbUJBQW1CLFdBQVcsWUFBWSxHQUFHLEVBQUUsU0FBUyxrQkFBa0IsU0FBUyxDQUFDO0FBQUEsRUFDdkk7QUFDRDtBQVZhLDBCQUFOO0FBQUEsRUFLSjtBQUFBLEVBQ0E7QUFBQSxHQU5VO0FBWWIsa0JBQWtCLG9CQUFvQix5QkFBeUIsa0JBQWtCLE9BQU87IiwKICAibmFtZXMiOiBbXQp9Cg==
