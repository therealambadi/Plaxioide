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
import { IExtensionsWorkbenchService } from "../common/extensions.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { MenuRegistry, MenuId } from "../../../../platform/actions/common/actions.js";
import { localize } from "../../../../nls.js";
import { areSameExtensions } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { Action } from "../../../../base/common/actions.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Promises } from "../../../../base/common/async.js";
let ExtensionDependencyChecker = class extends Disposable {
  constructor(extensionService, extensionsWorkbenchService, notificationService, hostService) {
    super();
    this.extensionService = extensionService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.notificationService = notificationService;
    this.hostService = hostService;
    CommandsRegistry.registerCommand("workbench.extensions.installMissingDependencies", () => this.installMissingDependencies());
    MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
      command: {
        id: "workbench.extensions.installMissingDependencies",
        category: localize("extensions", "Extensions"),
        title: localize("auto install missing deps", "Install Missing Dependencies")
      }
    });
  }
  async getUninstalledMissingDependencies() {
    const allMissingDependencies = await this.getAllMissingDependencies();
    const localExtensions = await this.extensionsWorkbenchService.queryLocal();
    return allMissingDependencies.filter((id) => localExtensions.every((l) => !areSameExtensions(l.identifier, { id })));
  }
  async getAllMissingDependencies() {
    await this.extensionService.whenInstalledExtensionsRegistered();
    const runningExtensionsIds = this.extensionService.extensions.reduce((result, r) => {
      result.add(r.identifier.value.toLowerCase());
      return result;
    }, /* @__PURE__ */ new Set());
    const missingDependencies = /* @__PURE__ */ new Set();
    for (const extension of this.extensionService.extensions) {
      if (extension.extensionDependencies) {
        extension.extensionDependencies.forEach((dep) => {
          if (!runningExtensionsIds.has(dep.toLowerCase())) {
            missingDependencies.add(dep);
          }
        });
      }
    }
    return [...missingDependencies.values()];
  }
  async installMissingDependencies() {
    const missingDependencies = await this.getUninstalledMissingDependencies();
    if (missingDependencies.length) {
      const extensions = await this.extensionsWorkbenchService.getExtensions(missingDependencies.map((id) => ({ id })), CancellationToken.None);
      if (extensions.length) {
        await Promises.settled(extensions.map((extension) => this.extensionsWorkbenchService.install(extension)));
        this.notificationService.notify({
          severity: Severity.Info,
          message: localize("finished installing missing deps", "Finished installing missing dependencies. Please reload the window now."),
          actions: {
            primary: [new Action(
              "realod",
              localize("reload", "Reload Window"),
              "",
              true,
              () => this.hostService.reload()
            )]
          }
        });
      }
    } else {
      this.notificationService.info(localize("no missing deps", "There are no missing dependencies to install."));
    }
  }
};
ExtensionDependencyChecker = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IHostService)
], ExtensionDependencyChecker);
export {
  ExtensionDependencyChecker
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2Jyb3dzZXIvZXh0ZW5zaW9uc0RlcGVuZGVuY3lDaGVja2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IE1lbnVSZWdpc3RyeSwgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBhcmVTYW1lRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnRVdGlsLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlLCBTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IEFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBQcm9taXNlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcblxuZXhwb3J0IGNsYXNzIEV4dGVuc2lvbkRlcGVuZGVuY3lDaGVja2VyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0Q29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ3dvcmtiZW5jaC5leHRlbnNpb25zLmluc3RhbGxNaXNzaW5nRGVwZW5kZW5jaWVzJywgKCkgPT4gdGhpcy5pbnN0YWxsTWlzc2luZ0RlcGVuZGVuY2llcygpKTtcblx0XHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkNvbW1hbmRQYWxldHRlLCB7XG5cdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLmV4dGVuc2lvbnMuaW5zdGFsbE1pc3NpbmdEZXBlbmRlbmNpZXMnLFxuXHRcdFx0XHRjYXRlZ29yeTogbG9jYWxpemUoJ2V4dGVuc2lvbnMnLCBcIkV4dGVuc2lvbnNcIiksXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnYXV0byBpbnN0YWxsIG1pc3NpbmcgZGVwcycsIFwiSW5zdGFsbCBNaXNzaW5nIERlcGVuZGVuY2llc1wiKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRVbmluc3RhbGxlZE1pc3NpbmdEZXBlbmRlbmNpZXMoKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuXHRcdGNvbnN0IGFsbE1pc3NpbmdEZXBlbmRlbmNpZXMgPSBhd2FpdCB0aGlzLmdldEFsbE1pc3NpbmdEZXBlbmRlbmNpZXMoKTtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnF1ZXJ5TG9jYWwoKTtcblx0XHRyZXR1cm4gYWxsTWlzc2luZ0RlcGVuZGVuY2llcy5maWx0ZXIoaWQgPT4gbG9jYWxFeHRlbnNpb25zLmV2ZXJ5KGwgPT4gIWFyZVNhbWVFeHRlbnNpb25zKGwuaWRlbnRpZmllciwgeyBpZCB9KSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRBbGxNaXNzaW5nRGVwZW5kZW5jaWVzKCk6IFByb21pc2U8c3RyaW5nW10+IHtcblx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvblNlcnZpY2Uud2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCk7XG5cdFx0Y29uc3QgcnVubmluZ0V4dGVuc2lvbnNJZHM6IFNldDxzdHJpbmc+ID0gdGhpcy5leHRlbnNpb25TZXJ2aWNlLmV4dGVuc2lvbnMucmVkdWNlKChyZXN1bHQsIHIpID0+IHsgcmVzdWx0LmFkZChyLmlkZW50aWZpZXIudmFsdWUudG9Mb3dlckNhc2UoKSk7IHJldHVybiByZXN1bHQ7IH0sIG5ldyBTZXQ8c3RyaW5nPigpKTtcblx0XHRjb25zdCBtaXNzaW5nRGVwZW5kZW5jaWVzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIHRoaXMuZXh0ZW5zaW9uU2VydmljZS5leHRlbnNpb25zKSB7XG5cdFx0XHRpZiAoZXh0ZW5zaW9uLmV4dGVuc2lvbkRlcGVuZGVuY2llcykge1xuXHRcdFx0XHRleHRlbnNpb24uZXh0ZW5zaW9uRGVwZW5kZW5jaWVzLmZvckVhY2goZGVwID0+IHtcblx0XHRcdFx0XHRpZiAoIXJ1bm5pbmdFeHRlbnNpb25zSWRzLmhhcyhkZXAudG9Mb3dlckNhc2UoKSkpIHtcblx0XHRcdFx0XHRcdG1pc3NpbmdEZXBlbmRlbmNpZXMuYWRkKGRlcCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIFsuLi5taXNzaW5nRGVwZW5kZW5jaWVzLnZhbHVlcygpXTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaW5zdGFsbE1pc3NpbmdEZXBlbmRlbmNpZXMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgbWlzc2luZ0RlcGVuZGVuY2llcyA9IGF3YWl0IHRoaXMuZ2V0VW5pbnN0YWxsZWRNaXNzaW5nRGVwZW5kZW5jaWVzKCk7XG5cdFx0aWYgKG1pc3NpbmdEZXBlbmRlbmNpZXMubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBleHRlbnNpb25zID0gYXdhaXQgdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5nZXRFeHRlbnNpb25zKG1pc3NpbmdEZXBlbmRlbmNpZXMubWFwKGlkID0+ICh7IGlkIH0pKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRpZiAoZXh0ZW5zaW9ucy5sZW5ndGgpIHtcblx0XHRcdFx0YXdhaXQgUHJvbWlzZXMuc2V0dGxlZChleHRlbnNpb25zLm1hcChleHRlbnNpb24gPT4gdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5pbnN0YWxsKGV4dGVuc2lvbikpKTtcblx0XHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLm5vdGlmeSh7XG5cdFx0XHRcdFx0c2V2ZXJpdHk6IFNldmVyaXR5LkluZm8sXG5cdFx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2ZpbmlzaGVkIGluc3RhbGxpbmcgbWlzc2luZyBkZXBzJywgXCJGaW5pc2hlZCBpbnN0YWxsaW5nIG1pc3NpbmcgZGVwZW5kZW5jaWVzLiBQbGVhc2UgcmVsb2FkIHRoZSB3aW5kb3cgbm93LlwiKSxcblx0XHRcdFx0XHRhY3Rpb25zOiB7XG5cdFx0XHRcdFx0XHRwcmltYXJ5OiBbbmV3IEFjdGlvbigncmVhbG9kJywgbG9jYWxpemUoJ3JlbG9hZCcsIFwiUmVsb2FkIFdpbmRvd1wiKSwgJycsIHRydWUsXG5cdFx0XHRcdFx0XHRcdCgpID0+IHRoaXMuaG9zdFNlcnZpY2UucmVsb2FkKCkpXVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5pbmZvKGxvY2FsaXplKCdubyBtaXNzaW5nIGRlcHMnLCBcIlRoZXJlIGFyZSBubyBtaXNzaW5nIGRlcGVuZGVuY2llcyB0byBpbnN0YWxsLlwiKSk7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsbUNBQW1DO0FBRTVDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsY0FBYyxjQUFjO0FBQ3JDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsc0JBQXNCLGdCQUFnQjtBQUMvQyxTQUFTLGNBQWM7QUFDdkIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxnQkFBZ0I7QUFFbEIsSUFBTSw2QkFBTixjQUF5QyxXQUE2QztBQUFBLEVBRTVGLFlBQ3FDLGtCQUNVLDRCQUNQLHFCQUNSLGFBQzlCO0FBQ0QsVUFBTTtBQUw4QjtBQUNVO0FBQ1A7QUFDUjtBQUcvQixxQkFBaUIsZ0JBQWdCLG1EQUFtRCxNQUFNLEtBQUssMkJBQTJCLENBQUM7QUFDM0gsaUJBQWEsZUFBZSxPQUFPLGdCQUFnQjtBQUFBLE1BQ2xELFNBQVM7QUFBQSxRQUNSLElBQUk7QUFBQSxRQUNKLFVBQVUsU0FBUyxjQUFjLFlBQVk7QUFBQSxRQUM3QyxPQUFPLFNBQVMsNkJBQTZCLDhCQUE4QjtBQUFBLE1BQzVFO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsTUFBYyxvQ0FBdUQ7QUFDcEUsVUFBTSx5QkFBeUIsTUFBTSxLQUFLLDBCQUEwQjtBQUNwRSxVQUFNLGtCQUFrQixNQUFNLEtBQUssMkJBQTJCLFdBQVc7QUFDekUsV0FBTyx1QkFBdUIsT0FBTyxRQUFNLGdCQUFnQixNQUFNLE9BQUssQ0FBQyxrQkFBa0IsRUFBRSxZQUFZLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUFBLEVBQ2hIO0FBQUEsRUFFQSxNQUFjLDRCQUErQztBQUM1RCxVQUFNLEtBQUssaUJBQWlCLGtDQUFrQztBQUM5RCxVQUFNLHVCQUFvQyxLQUFLLGlCQUFpQixXQUFXLE9BQU8sQ0FBQyxRQUFRLE1BQU07QUFBRSxhQUFPLElBQUksRUFBRSxXQUFXLE1BQU0sWUFBWSxDQUFDO0FBQUcsYUFBTztBQUFBLElBQVEsR0FBRyxvQkFBSSxJQUFZLENBQUM7QUFDcEwsVUFBTSxzQkFBbUMsb0JBQUksSUFBWTtBQUN6RCxlQUFXLGFBQWEsS0FBSyxpQkFBaUIsWUFBWTtBQUN6RCxVQUFJLFVBQVUsdUJBQXVCO0FBQ3BDLGtCQUFVLHNCQUFzQixRQUFRLFNBQU87QUFDOUMsY0FBSSxDQUFDLHFCQUFxQixJQUFJLElBQUksWUFBWSxDQUFDLEdBQUc7QUFDakQsZ0NBQW9CLElBQUksR0FBRztBQUFBLFVBQzVCO0FBQUEsUUFDRCxDQUFDO0FBQUEsTUFDRjtBQUFBLElBQ0Q7QUFDQSxXQUFPLENBQUMsR0FBRyxvQkFBb0IsT0FBTyxDQUFDO0FBQUEsRUFDeEM7QUFBQSxFQUVBLE1BQWMsNkJBQTRDO0FBQ3pELFVBQU0sc0JBQXNCLE1BQU0sS0FBSyxrQ0FBa0M7QUFDekUsUUFBSSxvQkFBb0IsUUFBUTtBQUMvQixZQUFNLGFBQWEsTUFBTSxLQUFLLDJCQUEyQixjQUFjLG9CQUFvQixJQUFJLFNBQU8sRUFBRSxHQUFHLEVBQUUsR0FBRyxrQkFBa0IsSUFBSTtBQUN0SSxVQUFJLFdBQVcsUUFBUTtBQUN0QixjQUFNLFNBQVMsUUFBUSxXQUFXLElBQUksZUFBYSxLQUFLLDJCQUEyQixRQUFRLFNBQVMsQ0FBQyxDQUFDO0FBQ3RHLGFBQUssb0JBQW9CLE9BQU87QUFBQSxVQUMvQixVQUFVLFNBQVM7QUFBQSxVQUNuQixTQUFTLFNBQVMsb0NBQW9DLHlFQUF5RTtBQUFBLFVBQy9ILFNBQVM7QUFBQSxZQUNSLFNBQVMsQ0FBQyxJQUFJO0FBQUEsY0FBTztBQUFBLGNBQVUsU0FBUyxVQUFVLGVBQWU7QUFBQSxjQUFHO0FBQUEsY0FBSTtBQUFBLGNBQ3ZFLE1BQU0sS0FBSyxZQUFZLE9BQU87QUFBQSxZQUFDLENBQUM7QUFBQSxVQUNsQztBQUFBLFFBQ0QsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxJQUNELE9BQU87QUFDTixXQUFLLG9CQUFvQixLQUFLLFNBQVMsbUJBQW1CLCtDQUErQyxDQUFDO0FBQUEsSUFDM0c7QUFBQSxFQUNEO0FBQ0Q7QUE1RGEsNkJBQU47QUFBQSxFQUdKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FOVTsiLAogICJuYW1lcyI6IFtdCn0K
