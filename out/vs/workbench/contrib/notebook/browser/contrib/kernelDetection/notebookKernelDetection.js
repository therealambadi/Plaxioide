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
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { Registry } from "../../../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../../../common/contributions.js";
import { INotebookKernelService } from "../../../common/notebookKernelService.js";
import { INotebookLoggingService } from "../../../common/notebookLoggingService.js";
import { IExtensionService } from "../../../../../services/extensions/common/extensions.js";
import { LifecyclePhase } from "../../../../../services/lifecycle/common/lifecycle.js";
let NotebookKernelDetection = class extends Disposable {
  constructor(_notebookKernelService, _extensionService, _notebookLoggingService) {
    super();
    this._notebookKernelService = _notebookKernelService;
    this._extensionService = _extensionService;
    this._notebookLoggingService = _notebookLoggingService;
    this._detectionMap = /* @__PURE__ */ new Map();
    this._localDisposableStore = this._register(new DisposableStore());
    this._registerListeners();
  }
  _registerListeners() {
    this._localDisposableStore.clear();
    this._localDisposableStore.add(this._extensionService.onWillActivateByEvent((e) => {
      if (e.event.startsWith("onNotebook:")) {
        if (this._extensionService.activationEventIsDone(e.event)) {
          return;
        }
        const notebookType = e.event.substring("onNotebook:".length);
        if (notebookType === "*") {
          return;
        }
        let shouldStartDetection = false;
        const extensionStatus = this._extensionService.getExtensionsStatus();
        this._extensionService.extensions.forEach((extension) => {
          if (extensionStatus[extension.identifier.value].activationTimes) {
            return;
          }
          if (extension.activationEvents?.includes(e.event)) {
            shouldStartDetection = true;
          }
        });
        if (shouldStartDetection && !this._detectionMap.has(notebookType)) {
          this._notebookLoggingService.debug("KernelDetection", `start extension activation for ${notebookType}`);
          const task = this._notebookKernelService.registerNotebookKernelDetectionTask({
            notebookType
          });
          this._detectionMap.set(notebookType, task);
        }
      }
    }));
    let timer = null;
    this._localDisposableStore.add(this._extensionService.onDidChangeExtensionsStatus(() => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        const taskToDelete = [];
        for (const [notebookType, task] of this._detectionMap) {
          if (this._extensionService.activationEventIsDone(`onNotebook:${notebookType}`)) {
            this._notebookLoggingService.debug("KernelDetection", `finish extension activation for ${notebookType}`);
            taskToDelete.push(notebookType);
            task.dispose();
          }
        }
        taskToDelete.forEach((notebookType) => {
          this._detectionMap.delete(notebookType);
        });
      });
    }));
    this._localDisposableStore.add({
      dispose: () => {
        if (timer) {
          clearTimeout(timer);
        }
      }
    });
  }
};
NotebookKernelDetection = __decorateClass([
  __decorateParam(0, INotebookKernelService),
  __decorateParam(1, IExtensionService),
  __decorateParam(2, INotebookLoggingService)
], NotebookKernelDetection);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(NotebookKernelDetection, LifecyclePhase.Restored);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyaWIva2VybmVsRGV0ZWN0aW9uL25vdGVib29rS2VybmVsRGV0ZWN0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuXG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24sIElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgV29ya2JlbmNoRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0tlcm5lbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbm90ZWJvb2tLZXJuZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0xvZ2dpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rTG9nZ2luZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuXG5jbGFzcyBOb3RlYm9va0tlcm5lbERldGVjdGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblx0cHJpdmF0ZSBfZGV0ZWN0aW9uTWFwID0gbmV3IE1hcDxzdHJpbmcsIElEaXNwb3NhYmxlPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9sb2NhbERpc3Bvc2FibGVTdG9yZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElOb3RlYm9va0tlcm5lbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tLZXJuZWxTZXJ2aWNlOiBJTm90ZWJvb2tLZXJuZWxTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASU5vdGVib29rTG9nZ2luZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tMb2dnaW5nU2VydmljZTogSU5vdGVib29rTG9nZ2luZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIF9yZWdpc3Rlckxpc3RlbmVycygpIHtcblx0XHR0aGlzLl9sb2NhbERpc3Bvc2FibGVTdG9yZS5jbGVhcigpO1xuXG5cdFx0dGhpcy5fbG9jYWxEaXNwb3NhYmxlU3RvcmUuYWRkKHRoaXMuX2V4dGVuc2lvblNlcnZpY2Uub25XaWxsQWN0aXZhdGVCeUV2ZW50KGUgPT4ge1xuXHRcdFx0aWYgKGUuZXZlbnQuc3RhcnRzV2l0aCgnb25Ob3RlYm9vazonKSkge1xuXHRcdFx0XHRpZiAodGhpcy5fZXh0ZW5zaW9uU2VydmljZS5hY3RpdmF0aW9uRXZlbnRJc0RvbmUoZS5ldmVudCkpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBwYXJzZSB0aGUgZXZlbnQgdG8gZ2V0IHRoZSBub3RlYm9vayB0eXBlXG5cdFx0XHRcdGNvbnN0IG5vdGVib29rVHlwZSA9IGUuZXZlbnQuc3Vic3RyaW5nKCdvbk5vdGVib29rOicubGVuZ3RoKTtcblxuXHRcdFx0XHRpZiAobm90ZWJvb2tUeXBlID09PSAnKicpIHtcblx0XHRcdFx0XHQvLyBpZ25vcmVcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRsZXQgc2hvdWxkU3RhcnREZXRlY3Rpb24gPSBmYWxzZTtcblxuXHRcdFx0XHRjb25zdCBleHRlbnNpb25TdGF0dXMgPSB0aGlzLl9leHRlbnNpb25TZXJ2aWNlLmdldEV4dGVuc2lvbnNTdGF0dXMoKTtcblx0XHRcdFx0dGhpcy5fZXh0ZW5zaW9uU2VydmljZS5leHRlbnNpb25zLmZvckVhY2goZXh0ZW5zaW9uID0+IHtcblx0XHRcdFx0XHRpZiAoZXh0ZW5zaW9uU3RhdHVzW2V4dGVuc2lvbi5pZGVudGlmaWVyLnZhbHVlXS5hY3RpdmF0aW9uVGltZXMpIHtcblx0XHRcdFx0XHRcdC8vIGFscmVhZHkgYWN0aXZhdGVkXG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChleHRlbnNpb24uYWN0aXZhdGlvbkV2ZW50cz8uaW5jbHVkZXMoZS5ldmVudCkpIHtcblx0XHRcdFx0XHRcdHNob3VsZFN0YXJ0RGV0ZWN0aW9uID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGlmIChzaG91bGRTdGFydERldGVjdGlvbiAmJiAhdGhpcy5fZGV0ZWN0aW9uTWFwLmhhcyhub3RlYm9va1R5cGUpKSB7XG5cdFx0XHRcdFx0dGhpcy5fbm90ZWJvb2tMb2dnaW5nU2VydmljZS5kZWJ1ZygnS2VybmVsRGV0ZWN0aW9uJywgYHN0YXJ0IGV4dGVuc2lvbiBhY3RpdmF0aW9uIGZvciAke25vdGVib29rVHlwZX1gKTtcblx0XHRcdFx0XHRjb25zdCB0YXNrID0gdGhpcy5fbm90ZWJvb2tLZXJuZWxTZXJ2aWNlLnJlZ2lzdGVyTm90ZWJvb2tLZXJuZWxEZXRlY3Rpb25UYXNrKHtcblx0XHRcdFx0XHRcdG5vdGVib29rVHlwZTogbm90ZWJvb2tUeXBlXG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHR0aGlzLl9kZXRlY3Rpb25NYXAuc2V0KG5vdGVib29rVHlwZSwgdGFzayk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRsZXQgdGltZXI6IGFueSA9IG51bGw7XG5cblx0XHR0aGlzLl9sb2NhbERpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy5fZXh0ZW5zaW9uU2VydmljZS5vbkRpZENoYW5nZUV4dGVuc2lvbnNTdGF0dXMoKCkgPT4ge1xuXHRcdFx0aWYgKHRpbWVyKSB7XG5cdFx0XHRcdGNsZWFyVGltZW91dCh0aW1lcik7XG5cdFx0XHR9XG5cblx0XHRcdC8vIGFjdGl2YXRpb24gc3RhdGUgbWlnaHQgbm90IGJlIHVwZGF0ZWQgeWV0LCBwb3N0cG9uZSB0byBuZXh0IGZyYW1lXG5cdFx0XHR0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRjb25zdCB0YXNrVG9EZWxldGU6IHN0cmluZ1tdID0gW107XG5cdFx0XHRcdGZvciAoY29uc3QgW25vdGVib29rVHlwZSwgdGFza10gb2YgdGhpcy5fZGV0ZWN0aW9uTWFwKSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuX2V4dGVuc2lvblNlcnZpY2UuYWN0aXZhdGlvbkV2ZW50SXNEb25lKGBvbk5vdGVib29rOiR7bm90ZWJvb2tUeXBlfWApKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9ub3RlYm9va0xvZ2dpbmdTZXJ2aWNlLmRlYnVnKCdLZXJuZWxEZXRlY3Rpb24nLCBgZmluaXNoIGV4dGVuc2lvbiBhY3RpdmF0aW9uIGZvciAke25vdGVib29rVHlwZX1gKTtcblx0XHRcdFx0XHRcdHRhc2tUb0RlbGV0ZS5wdXNoKG5vdGVib29rVHlwZSk7XG5cdFx0XHRcdFx0XHR0YXNrLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0YXNrVG9EZWxldGUuZm9yRWFjaChub3RlYm9va1R5cGUgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX2RldGVjdGlvbk1hcC5kZWxldGUobm90ZWJvb2tUeXBlKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9sb2NhbERpc3Bvc2FibGVTdG9yZS5hZGQoe1xuXHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHRpZiAodGltZXIpIHtcblx0XHRcdFx0XHRjbGVhclRpbWVvdXQodGltZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpLnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uKE5vdGVib29rS2VybmVsRGV0ZWN0aW9uLCBMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU1BLFNBQVMsWUFBWSx1QkFBb0M7QUFDekQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBa0UsY0FBYywyQkFB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
