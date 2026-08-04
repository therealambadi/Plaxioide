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
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { IExtensionTransferService } from "./extensionTransferService.js";
import { os } from "../common/helpers/systemInfo.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { timeout } from "../../../../base/common/async.js";
import { getActiveWindow } from "../../../../base/browser/dom.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
let MiscWorkbenchContribs = class extends Disposable {
  constructor(extensionTransferService, storageService, configurationService) {
    super();
    this.extensionTransferService = extensionTransferService;
    this.storageService = storageService;
    this.configurationService = configurationService;
    this.initialize();
  }
  initialize() {
    const deleteExtensionsStorageId = "void-deleted-blacklist-2";
    const alreadyDeleted = this.storageService.get(deleteExtensionsStorageId, StorageScope.APPLICATION);
    if (!alreadyDeleted) {
      this.storageService.store(deleteExtensionsStorageId, "true", StorageScope.APPLICATION, StorageTarget.MACHINE);
      this.extensionTransferService.deleteBlacklistExtensions(os);
    }
    // Force activity bar to top position unconditionally
    this.configurationService.updateValue("workbench.activityBar.location", "top");
    timeout(5e3).then(() => {
      const targetWindow = getActiveWindow();
      targetWindow.dispatchEvent(new Event("resize"));
    });
  }
};
MiscWorkbenchContribs.ID = "workbench.contrib.voidMiscWorkbenchContribs";
MiscWorkbenchContribs = __decorateClass([
  __decorateParam(0, IExtensionTransferService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IConfigurationService)
], MiscWorkbenchContribs);
registerWorkbenchContribution2(MiscWorkbenchContribs.ID, MiscWorkbenchContribs, WorkbenchPhase.Eventually);
export {
  MiscWorkbenchContribs
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvbWlzY1dva3JiZW5jaENvbnRyaWIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgMjAyNSBHbGFzcyBEZXZ0b29scywgSW5jLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAuIFNlZSBMSUNFTlNFLnR4dCBmb3IgbW9yZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24sIHJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMiwgV29ya2JlbmNoUGhhc2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uVHJhbnNmZXJTZXJ2aWNlIH0gZnJvbSAnLi9leHRlbnNpb25UcmFuc2ZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgb3MgfSBmcm9tICcuLi9jb21tb24vaGVscGVycy9zeXN0ZW1JbmZvLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgZ2V0QWN0aXZlV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5cbi8vIE9uYm9hcmRpbmcgY29udHJpYnV0aW9uIHRoYXQgbW91bnRzIHRoZSBjb21wb25lbnQgYXQgc3RhcnR1cFxuZXhwb3J0IGNsYXNzIE1pc2NXb3JrYmVuY2hDb250cmlicyBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLnZvaWRNaXNjV29ya2JlbmNoQ29udHJpYnMnO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXh0ZW5zaW9uVHJhbnNmZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uVHJhbnNmZXJTZXJ2aWNlOiBJRXh0ZW5zaW9uVHJhbnNmZXJTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuaW5pdGlhbGl6ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBpbml0aWFsaXplKCk6IHZvaWQge1xuXG5cdFx0Ly8gZGVsZXRlIGJsYWNrbGlzdGVkIGV4dGVuc2lvbnMgb25jZSAodGhpcyBpcyBmb3IgcGVvcGxlIHdobyBhbHJlYWR5IGluc3RhbGxlZCB0aGVtKVxuXHRcdGNvbnN0IGRlbGV0ZUV4dGVuc2lvbnNTdG9yYWdlSWQgPSAndm9pZC1kZWxldGVkLWJsYWNrbGlzdC0yJ1xuXHRcdGNvbnN0IGFscmVhZHlEZWxldGVkID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQoZGVsZXRlRXh0ZW5zaW9uc1N0b3JhZ2VJZCwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKVxuXHRcdGlmICghYWxyZWFkeURlbGV0ZWQpIHtcblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoZGVsZXRlRXh0ZW5zaW9uc1N0b3JhZ2VJZCwgJ3RydWUnLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuTUFDSElORSlcblx0XHRcdHRoaXMuZXh0ZW5zaW9uVHJhbnNmZXJTZXJ2aWNlLmRlbGV0ZUJsYWNrbGlzdEV4dGVuc2lvbnMob3MpXG5cdFx0fVxuXG5cblx0XHQvLyBhZnRlciBzb21lIHRpbWUsIHRyaWdnZXIgYSByZXNpemUgZXZlbnQgZm9yIHRoZSBibGFuayBzY3JlZW4gZXJyb3Jcblx0XHR0aW1lb3V0KDVfMDAwKS50aGVuKCgpID0+IHtcblx0XHRcdC8vIEdldCB0aGUgYWN0aXZlIHdpbmRvdyByZWZlcmVuY2UgZm9yIG11bHRpLXdpbmRvdyBzdXBwb3J0XG5cdFx0XHRjb25zdCB0YXJnZXRXaW5kb3cgPSBnZXRBY3RpdmVXaW5kb3coKTtcblx0XHRcdC8vIFRyaWdnZXIgYSB3aW5kb3cgcmVzaXplIGV2ZW50IHRvIGVuc3VyZSBwcm9wZXIgbGF5b3V0IGNhbGN1bGF0aW9uc1xuXHRcdFx0dGFyZ2V0V2luZG93LmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdyZXNpemUnKSlcblxuXHRcdH0pXG5cblx0fVxufVxuXG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoTWlzY1dvcmtiZW5jaENvbnRyaWJzLklELCBNaXNjV29ya2JlbmNoQ29udHJpYnMsIFdvcmtiZW5jaFBoYXNlLkV2ZW50dWFsbHkpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGtCQUFrQjtBQUMzQixTQUFpQyxnQ0FBZ0Msc0JBQXNCO0FBQ3ZGLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsVUFBVTtBQUNuQixTQUFTLGlCQUFpQixjQUFjLHFCQUFxQjtBQUM3RCxTQUFTLGVBQWU7QUFDeEIsU0FBUyx1QkFBdUI7QUFHekIsSUFBTSx3QkFBTixjQUFvQyxXQUE2QztBQUFBLEVBR3ZGLFlBQzZDLDBCQUNWLGdCQUNqQztBQUNELFVBQU07QUFIc0M7QUFDVjtBQUdsQyxTQUFLLFdBQVc7QUFBQSxFQUNqQjtBQUFBLEVBRVEsYUFBbUI7QUFHMUIsVUFBTSw0QkFBNEI7QUFDbEMsVUFBTSxpQkFBaUIsS0FBSyxlQUFlLElBQUksMkJBQTJCLGFBQWEsV0FBVztBQUNsRyxRQUFJLENBQUMsZ0JBQWdCO0FBQ3BCLFdBQUssZUFBZSxNQUFNLDJCQUEyQixRQUFRLGFBQWEsYUFBYSxjQUFjLE9BQU87QUFDNUcsV0FBSyx5QkFBeUIsMEJBQTBCLEVBQUU7QUFBQSxJQUMzRDtBQUlBLFlBQVEsR0FBSyxFQUFFLEtBQUssTUFBTTtBQUV6QixZQUFNLGVBQWUsZ0JBQWdCO0FBRXJDLG1CQUFhLGNBQWMsSUFBSSxNQUFNLFFBQVEsQ0FBQztBQUFBLElBRS9DLENBQUM7QUFBQSxFQUVGO0FBQ0Q7QUFoQ2Esc0JBQ0ksS0FBSztBQURULHdCQUFOO0FBQUEsRUFJSjtBQUFBLEVBQ0E7QUFBQSxHQUxVO0FBa0NiLCtCQUErQixzQkFBc0IsSUFBSSx1QkFBdUIsZUFBZSxVQUFVOyIsCiAgIm5hbWVzIjogW10KfQo=
