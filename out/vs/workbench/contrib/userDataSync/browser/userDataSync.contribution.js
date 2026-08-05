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
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { UserDataSyncWorkbenchContribution } from "./userDataSync.js";
import { IUserDataAutoSyncService, UserDataSyncErrorCode } from "../../../../platform/userDataSync/common/userDataSync.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { isWeb } from "../../../../base/common/platform.js";
import { UserDataSyncTrigger } from "./userDataSyncTrigger.js";
import { toAction } from "../../../../base/common/actions.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { SHOW_SYNC_LOG_COMMAND_ID } from "../../../services/userDataSync/common/userDataSync.js";
let UserDataSyncReportIssueContribution = class extends Disposable {
  constructor(userDataAutoSyncService, notificationService, productService, commandService, hostService) {
    super();
    this.notificationService = notificationService;
    this.productService = productService;
    this.commandService = commandService;
    this.hostService = hostService;
    this._register(userDataAutoSyncService.onError((error) => this.onAutoSyncError(error)));
  }
  onAutoSyncError(error) {
    switch (error.code) {
      case UserDataSyncErrorCode.LocalTooManyRequests: {
        const message = isWeb ? localize({ key: "local too many requests - reload", comment: ["Settings Sync is the name of the feature"] }, "Settings sync is suspended temporarily because the current device is making too many requests. Please reload {0} to resume.", this.productService.nameLong) : localize({ key: "local too many requests - restart", comment: ["Settings Sync is the name of the feature"] }, "Settings sync is suspended temporarily because the current device is making too many requests. Please restart {0} to resume.", this.productService.nameLong);
        this.notificationService.notify({
          severity: Severity.Error,
          message,
          actions: {
            primary: [
              toAction({
                id: "Show Sync Logs",
                label: localize("show sync logs", "Show Log"),
                run: () => this.commandService.executeCommand(SHOW_SYNC_LOG_COMMAND_ID)
              }),
              toAction({
                id: "Restart",
                label: isWeb ? localize("reload", "Reload") : localize("restart", "Restart"),
                run: () => this.hostService.restart()
              })
            ]
          }
        });
        return;
      }
      case UserDataSyncErrorCode.TooManyRequests: {
        const operationId = error.operationId ? localize("operationId", "Operation Id: {0}", error.operationId) : void 0;
        const message = localize({ key: "server too many requests", comment: ["Settings Sync is the name of the feature"] }, "Settings sync is disabled because the current device is making too many requests. Please wait for 10 minutes and turn on sync.");
        this.notificationService.notify({
          severity: Severity.Error,
          message: operationId ? `${message} ${operationId}` : message,
          source: error.operationId ? localize("settings sync", "Settings Sync. Operation Id: {0}", error.operationId) : void 0,
          actions: {
            primary: [
              toAction({
                id: "Show Sync Logs",
                label: localize("show sync logs", "Show Log"),
                run: () => this.commandService.executeCommand(SHOW_SYNC_LOG_COMMAND_ID)
              })
            ]
          }
        });
        return;
      }
    }
  }
};
UserDataSyncReportIssueContribution = __decorateClass([
  __decorateParam(0, IUserDataAutoSyncService),
  __decorateParam(1, INotificationService),
  __decorateParam(2, IProductService),
  __decorateParam(3, ICommandService),
  __decorateParam(4, IHostService)
], UserDataSyncReportIssueContribution);
const workbenchRegistry = Registry.as(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(UserDataSyncWorkbenchContribution, LifecyclePhase.Restored);
workbenchRegistry.registerWorkbenchContribution(UserDataSyncTrigger, LifecyclePhase.Eventually);
workbenchRegistry.registerWorkbenchContribution(UserDataSyncReportIssueContribution, LifecyclePhase.Eventually);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi91c2VyRGF0YVN5bmMvYnJvd3Nlci91c2VyRGF0YVN5bmMuY29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeSwgRXh0ZW5zaW9ucyBhcyBXb3JrYmVuY2hFeHRlbnNpb25zLCBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgTGlmZWN5Y2xlUGhhc2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVc2VyRGF0YVN5bmNXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuL3VzZXJEYXRhU3luYy5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFBdXRvU3luY1NlcnZpY2UsIFVzZXJEYXRhU3luY0Vycm9yLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL3VzZXJEYXRhU3luYy5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGlzV2ViIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgVXNlckRhdGFTeW5jVHJpZ2dlciB9IGZyb20gJy4vdXNlckRhdGFTeW5jVHJpZ2dlci5qcyc7XG5pbXBvcnQgeyB0b0FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcbmltcG9ydCB7IFNIT1dfU1lOQ19MT0dfQ09NTUFORF9JRCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3VzZXJEYXRhU3luYy9jb21tb24vdXNlckRhdGFTeW5jLmpzJztcblxuY2xhc3MgVXNlckRhdGFTeW5jUmVwb3J0SXNzdWVDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElVc2VyRGF0YUF1dG9TeW5jU2VydmljZSB1c2VyRGF0YUF1dG9TeW5jU2VydmljZTogSVVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlLm9uRXJyb3IoZXJyb3IgPT4gdGhpcy5vbkF1dG9TeW5jRXJyb3IoZXJyb3IpKSk7XG5cdH1cblxuXHRwcml2YXRlIG9uQXV0b1N5bmNFcnJvcihlcnJvcjogVXNlckRhdGFTeW5jRXJyb3IpOiB2b2lkIHtcblx0XHRzd2l0Y2ggKGVycm9yLmNvZGUpIHtcblx0XHRcdGNhc2UgVXNlckRhdGFTeW5jRXJyb3JDb2RlLkxvY2FsVG9vTWFueVJlcXVlc3RzOiB7XG5cdFx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBpc1dlYiA/IGxvY2FsaXplKHsga2V5OiAnbG9jYWwgdG9vIG1hbnkgcmVxdWVzdHMgLSByZWxvYWQnLCBjb21tZW50OiBbJ1NldHRpbmdzIFN5bmMgaXMgdGhlIG5hbWUgb2YgdGhlIGZlYXR1cmUnXSB9LCBcIlNldHRpbmdzIHN5bmMgaXMgc3VzcGVuZGVkIHRlbXBvcmFyaWx5IGJlY2F1c2UgdGhlIGN1cnJlbnQgZGV2aWNlIGlzIG1ha2luZyB0b28gbWFueSByZXF1ZXN0cy4gUGxlYXNlIHJlbG9hZCB7MH0gdG8gcmVzdW1lLlwiLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVMb25nKVxuXHRcdFx0XHRcdDogbG9jYWxpemUoeyBrZXk6ICdsb2NhbCB0b28gbWFueSByZXF1ZXN0cyAtIHJlc3RhcnQnLCBjb21tZW50OiBbJ1NldHRpbmdzIFN5bmMgaXMgdGhlIG5hbWUgb2YgdGhlIGZlYXR1cmUnXSB9LCBcIlNldHRpbmdzIHN5bmMgaXMgc3VzcGVuZGVkIHRlbXBvcmFyaWx5IGJlY2F1c2UgdGhlIGN1cnJlbnQgZGV2aWNlIGlzIG1ha2luZyB0b28gbWFueSByZXF1ZXN0cy4gUGxlYXNlIHJlc3RhcnQgezB9IHRvIHJlc3VtZS5cIiwgdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lTG9uZyk7XG5cdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5ub3RpZnkoe1xuXHRcdFx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5FcnJvcixcblx0XHRcdFx0XHRtZXNzYWdlLFxuXHRcdFx0XHRcdGFjdGlvbnM6IHtcblx0XHRcdFx0XHRcdHByaW1hcnk6IFtcblx0XHRcdFx0XHRcdFx0dG9BY3Rpb24oe1xuXHRcdFx0XHRcdFx0XHRcdGlkOiAnU2hvdyBTeW5jIExvZ3MnLFxuXHRcdFx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnc2hvdyBzeW5jIGxvZ3MnLCBcIlNob3cgTG9nXCIpLFxuXHRcdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChTSE9XX1NZTkNfTE9HX0NPTU1BTkRfSUQpXG5cdFx0XHRcdFx0XHRcdH0pLFxuXHRcdFx0XHRcdFx0XHR0b0FjdGlvbih7XG5cdFx0XHRcdFx0XHRcdFx0aWQ6ICdSZXN0YXJ0Jyxcblx0XHRcdFx0XHRcdFx0XHRsYWJlbDogaXNXZWIgPyBsb2NhbGl6ZSgncmVsb2FkJywgXCJSZWxvYWRcIikgOiBsb2NhbGl6ZSgncmVzdGFydCcsIFwiUmVzdGFydFwiKSxcblx0XHRcdFx0XHRcdFx0XHRydW46ICgpID0+IHRoaXMuaG9zdFNlcnZpY2UucmVzdGFydCgpXG5cdFx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuVG9vTWFueVJlcXVlc3RzOiB7XG5cdFx0XHRcdGNvbnN0IG9wZXJhdGlvbklkID0gZXJyb3Iub3BlcmF0aW9uSWQgPyBsb2NhbGl6ZSgnb3BlcmF0aW9uSWQnLCBcIk9wZXJhdGlvbiBJZDogezB9XCIsIGVycm9yLm9wZXJhdGlvbklkKSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0Y29uc3QgbWVzc2FnZSA9IGxvY2FsaXplKHsga2V5OiAnc2VydmVyIHRvbyBtYW55IHJlcXVlc3RzJywgY29tbWVudDogWydTZXR0aW5ncyBTeW5jIGlzIHRoZSBuYW1lIG9mIHRoZSBmZWF0dXJlJ10gfSwgXCJTZXR0aW5ncyBzeW5jIGlzIGRpc2FibGVkIGJlY2F1c2UgdGhlIGN1cnJlbnQgZGV2aWNlIGlzIG1ha2luZyB0b28gbWFueSByZXF1ZXN0cy4gUGxlYXNlIHdhaXQgZm9yIDEwIG1pbnV0ZXMgYW5kIHR1cm4gb24gc3luYy5cIik7XG5cdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5ub3RpZnkoe1xuXHRcdFx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5FcnJvcixcblx0XHRcdFx0XHRtZXNzYWdlOiBvcGVyYXRpb25JZCA/IGAke21lc3NhZ2V9ICR7b3BlcmF0aW9uSWR9YCA6IG1lc3NhZ2UsXG5cdFx0XHRcdFx0c291cmNlOiBlcnJvci5vcGVyYXRpb25JZCA/IGxvY2FsaXplKCdzZXR0aW5ncyBzeW5jJywgXCJTZXR0aW5ncyBTeW5jLiBPcGVyYXRpb24gSWQ6IHswfVwiLCBlcnJvci5vcGVyYXRpb25JZCkgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0YWN0aW9uczoge1xuXHRcdFx0XHRcdFx0cHJpbWFyeTogW1xuXHRcdFx0XHRcdFx0XHR0b0FjdGlvbih7XG5cdFx0XHRcdFx0XHRcdFx0aWQ6ICdTaG93IFN5bmMgTG9ncycsXG5cdFx0XHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdzaG93IHN5bmMgbG9ncycsIFwiU2hvdyBMb2dcIiksXG5cdFx0XHRcdFx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKFNIT1dfU1lOQ19MT0dfQ09NTUFORF9JRClcblx0XHRcdFx0XHRcdFx0fSlcblx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmNvbnN0IHdvcmtiZW5jaFJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpO1xud29ya2JlbmNoUmVnaXN0cnkucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24oVXNlckRhdGFTeW5jV29ya2JlbmNoQ29udHJpYnV0aW9uLCBMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCk7XG53b3JrYmVuY2hSZWdpc3RyeS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihVc2VyRGF0YVN5bmNUcmlnZ2VyLCBMaWZlY3ljbGVQaGFzZS5FdmVudHVhbGx5KTtcbndvcmtiZW5jaFJlZ2lzdHJ5LnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uKFVzZXJEYXRhU3luY1JlcG9ydElzc3VlQ29udHJpYnV0aW9uLCBMaWZlY3ljbGVQaGFzZS5FdmVudHVhbGx5KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBMEMsY0FBYywy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
