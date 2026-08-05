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
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { IBannerService } from "../../../services/banner/browser/bannerService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IBrowserWorkbenchEnvironmentService } from "../../../services/environment/browser/environmentService.js";
import { URI } from "../../../../base/common/uri.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
let WelcomeBannerContribution = class {
  constructor(bannerService, storageService, environmentService) {
    const welcomeBanner = environmentService.options?.welcomeBanner;
    if (!welcomeBanner) {
      return;
    }
    if (storageService.getBoolean(WelcomeBannerContribution.WELCOME_BANNER_DISMISSED_KEY, StorageScope.PROFILE, false)) {
      return;
    }
    let icon = void 0;
    if (typeof welcomeBanner.icon === "string") {
      icon = ThemeIcon.fromId(welcomeBanner.icon);
    } else if (welcomeBanner.icon) {
      icon = URI.revive(welcomeBanner.icon);
    }
    bannerService.show({
      id: "welcome.banner",
      message: welcomeBanner.message,
      icon,
      actions: welcomeBanner.actions,
      onClose: () => {
        storageService.store(WelcomeBannerContribution.WELCOME_BANNER_DISMISSED_KEY, true, StorageScope.PROFILE, StorageTarget.MACHINE);
      }
    });
  }
};
WelcomeBannerContribution.WELCOME_BANNER_DISMISSED_KEY = "workbench.banner.welcome.dismissed";
WelcomeBannerContribution = __decorateClass([
  __decorateParam(0, IBannerService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IBrowserWorkbenchEnvironmentService)
], WelcomeBannerContribution);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(WelcomeBannerContribution, LifecyclePhase.Restored);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi93ZWxjb21lQmFubmVyL2Jyb3dzZXIvd2VsY29tZUJhbm5lci5jb250cmlidXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBMaWZlY3ljbGVQaGFzZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMgYXMgV29ya2JlbmNoRXh0ZW5zaW9ucywgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElCYW5uZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvYmFubmVyL2Jyb3dzZXIvYmFubmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSUJyb3dzZXJXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lbnZpcm9ubWVudC9icm93c2VyL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcblxuY2xhc3MgV2VsY29tZUJhbm5lckNvbnRyaWJ1dGlvbiB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgV0VMQ09NRV9CQU5ORVJfRElTTUlTU0VEX0tFWSA9ICd3b3JrYmVuY2guYmFubmVyLndlbGNvbWUuZGlzbWlzc2VkJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUJhbm5lclNlcnZpY2UgYmFubmVyU2VydmljZTogSUJhbm5lclNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlXG5cdCkge1xuXHRcdGNvbnN0IHdlbGNvbWVCYW5uZXIgPSBlbnZpcm9ubWVudFNlcnZpY2Uub3B0aW9ucz8ud2VsY29tZUJhbm5lcjtcblx0XHRpZiAoIXdlbGNvbWVCYW5uZXIpIHtcblx0XHRcdHJldHVybjsgLy8gd2VsY29tZSBiYW5uZXIgaXMgbm90IGVuYWJsZWRcblx0XHR9XG5cblx0XHRpZiAoc3RvcmFnZVNlcnZpY2UuZ2V0Qm9vbGVhbihXZWxjb21lQmFubmVyQ29udHJpYnV0aW9uLldFTENPTUVfQkFOTkVSX0RJU01JU1NFRF9LRVksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBmYWxzZSkpIHtcblx0XHRcdHJldHVybjsgLy8gd2VsY29tZSBiYW5uZXIgZGlzbWlzc2VkXG5cdFx0fVxuXG5cdFx0bGV0IGljb246IFRoZW1lSWNvbiB8IFVSSSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRpZiAodHlwZW9mIHdlbGNvbWVCYW5uZXIuaWNvbiA9PT0gJ3N0cmluZycpIHtcblx0XHRcdGljb24gPSBUaGVtZUljb24uZnJvbUlkKHdlbGNvbWVCYW5uZXIuaWNvbik7XG5cdFx0fSBlbHNlIGlmICh3ZWxjb21lQmFubmVyLmljb24pIHtcblx0XHRcdGljb24gPSBVUkkucmV2aXZlKHdlbGNvbWVCYW5uZXIuaWNvbik7XG5cdFx0fVxuXG5cdFx0YmFubmVyU2VydmljZS5zaG93KHtcblx0XHRcdGlkOiAnd2VsY29tZS5iYW5uZXInLFxuXHRcdFx0bWVzc2FnZTogd2VsY29tZUJhbm5lci5tZXNzYWdlLFxuXHRcdFx0aWNvbixcblx0XHRcdGFjdGlvbnM6IHdlbGNvbWVCYW5uZXIuYWN0aW9ucyxcblx0XHRcdG9uQ2xvc2U6ICgpID0+IHtcblx0XHRcdFx0c3RvcmFnZVNlcnZpY2Uuc3RvcmUoV2VsY29tZUJhbm5lckNvbnRyaWJ1dGlvbi5XRUxDT01FX0JBTk5FUl9ESVNNSVNTRURfS0VZLCB0cnVlLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufVxuXG5SZWdpc3RyeS5hczxJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5PihXb3JrYmVuY2hFeHRlbnNpb25zLldvcmtiZW5jaClcblx0LnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uKFdlbGNvbWVCYW5uZXJDb250cmlidXRpb24sIExpZmVjeWNsZVBoYXNlLlJlc3RvcmVkKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxjQUFjLDJCQUE0RDtBQUNuRixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGlCQUFpQixjQUFjLHFCQUFxQjtBQUM3RCxTQUFTLDJDQUEyQztBQUNwRCxTQUFTLFdBQVc7QUFDcEIsU0FBUyxpQkFBaUI7QUFFMUIsSUFBTSw0QkFBTixNQUFnQztBQUFBLEVBSS9CLFlBQ2lCLGVBQ0MsZ0JBQ29CLG9CQUNwQztBQUNELFVBQU0sZ0JBQWdCLG1CQUFtQixTQUFTO0FBQ2xELFFBQUksQ0FBQyxlQUFlO0FBQ25CO0FBQUEsSUFDRDtBQUVBLFFBQUksZUFBZSxXQUFXLDBCQUEwQiw4QkFBOEIsYUFBYSxTQUFTLEtBQUssR0FBRztBQUNuSDtBQUFBLElBQ0Q7QUFFQSxRQUFJLE9BQW9DO0FBQ3hDLFFBQUksT0FBTyxjQUFjLFNBQVMsVUFBVTtBQUMzQyxhQUFPLFVBQVUsT0FBTyxjQUFjLElBQUk7QUFBQSxJQUMzQyxXQUFXLGNBQWMsTUFBTTtBQUM5QixhQUFPLElBQUksT0FBTyxjQUFjLElBQUk7QUFBQSxJQUNyQztBQUVBLGtCQUFjLEtBQUs7QUFBQSxNQUNsQixJQUFJO0FBQUEsTUFDSixTQUFTLGNBQWM7QUFBQSxNQUN2QjtBQUFBLE1BQ0EsU0FBUyxjQUFjO0FBQUEsTUFDdkIsU0FBUyxNQUFNO0FBQ2QsdUJBQWUsTUFBTSwwQkFBMEIsOEJBQThCLE1BQU0sYUFBYSxTQUFTLGNBQWMsT0FBTztBQUFBLE1BQy9IO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUNEO0FBbkNNLDBCQUVtQiwrQkFBK0I7QUFGbEQsNEJBQU47QUFBQSxFQUtHO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVBHO0FBcUNOLFNBQVMsR0FBb0Msb0JBQW9CLFNBQVMsRUFDeEUsOEJBQThCLDJCQUEyQixlQUFlLFFBQVE7IiwKICAibmFtZXMiOiBbXQp9Cg==
