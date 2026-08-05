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
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { join } from "../../../../base/common/path.js";
import { Promises } from "../../../../base/node/pfs.js";
import { INativeEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { StorageClient } from "../../../../platform/storage/common/storageIpc.js";
import { EXTENSION_DEVELOPMENT_EMPTY_WINDOW_WORKSPACE } from "../../../../platform/workspace/common/workspace.js";
import { NON_EMPTY_WORKSPACE_ID_LENGTH } from "../../../../platform/workspaces/node/workspaces.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IMainProcessService } from "../../../../platform/ipc/common/mainProcessService.js";
import { Schemas } from "../../../../base/common/network.js";
let UnusedWorkspaceStorageDataCleaner = class extends Disposable {
  constructor(environmentService, logService, nativeHostService, mainProcessService) {
    super();
    this.environmentService = environmentService;
    this.logService = logService;
    this.nativeHostService = nativeHostService;
    this.mainProcessService = mainProcessService;
    const scheduler = this._register(new RunOnceScheduler(
      () => {
        this.cleanUpStorage();
      },
      30 * 1e3
      /* after 30s */
    ));
    scheduler.schedule();
  }
  async cleanUpStorage() {
    this.logService.trace("[storage cleanup]: Starting to clean up workspace storage folders for unused empty workspaces.");
    try {
      const workspaceStorageHome = this.environmentService.workspaceStorageHome.with({ scheme: Schemas.file }).fsPath;
      const workspaceStorageFolders = await Promises.readdir(workspaceStorageHome);
      const storageClient = new StorageClient(this.mainProcessService.getChannel("storage"));
      await Promise.all(workspaceStorageFolders.map(async (workspaceStorageFolder) => {
        const workspaceStoragePath = join(workspaceStorageHome, workspaceStorageFolder);
        if (workspaceStorageFolder.length === NON_EMPTY_WORKSPACE_ID_LENGTH) {
          return;
        }
        if (workspaceStorageFolder === EXTENSION_DEVELOPMENT_EMPTY_WINDOW_WORKSPACE.id) {
          return;
        }
        const windows = await this.nativeHostService.getWindows({ includeAuxiliaryWindows: false });
        if (windows.some((window) => window.workspace?.id === workspaceStorageFolder)) {
          return;
        }
        const isStorageUsed = await storageClient.isUsed(workspaceStoragePath);
        if (isStorageUsed) {
          return;
        }
        this.logService.trace(`[storage cleanup]: Deleting workspace storage folder ${workspaceStorageFolder} as it seems to be an unused empty workspace.`);
        await Promises.rm(workspaceStoragePath);
      }));
    } catch (error) {
      onUnexpectedError(error);
    }
  }
};
UnusedWorkspaceStorageDataCleaner = __decorateClass([
  __decorateParam(0, INativeEnvironmentService),
  __decorateParam(1, ILogService),
  __decorateParam(2, INativeHostService),
  __decorateParam(3, IMainProcessService)
], UnusedWorkspaceStorageDataCleaner);
export {
  UnusedWorkspaceStorageDataCleaner
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9jb2RlL2VsZWN0cm9uLXV0aWxpdHkvc2hhcmVkUHJvY2Vzcy9jb250cmliL3N0b3JhZ2VEYXRhQ2xlYW5lci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IFByb21pc2VzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9ub2RlL3Bmcy5qcyc7XG5pbXBvcnQgeyBJTmF0aXZlRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgU3RvcmFnZUNsaWVudCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2VJcGMuanMnO1xuaW1wb3J0IHsgRVhURU5TSU9OX0RFVkVMT1BNRU5UX0VNUFRZX1dJTkRPV19XT1JLU1BBQ0UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBOT05fRU1QVFlfV09SS1NQQUNFX0lEX0xFTkdUSCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZXMvbm9kZS93b3Jrc3BhY2VzLmpzJztcbmltcG9ydCB7IElOYXRpdmVIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25hdGl2ZS9jb21tb24vbmF0aXZlLmpzJztcbmltcG9ydCB7IElNYWluUHJvY2Vzc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pcGMvY29tbW9uL21haW5Qcm9jZXNzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5cbmV4cG9ydCBjbGFzcyBVbnVzZWRXb3Jrc3BhY2VTdG9yYWdlRGF0YUNsZWFuZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASU5hdGl2ZUVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVudmlyb25tZW50U2VydmljZTogSU5hdGl2ZUVudmlyb25tZW50U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASU5hdGl2ZUhvc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbmF0aXZlSG9zdFNlcnZpY2U6IElOYXRpdmVIb3N0U2VydmljZSxcblx0XHRASU1haW5Qcm9jZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1haW5Qcm9jZXNzU2VydmljZTogSU1haW5Qcm9jZXNzU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Y29uc3Qgc2NoZWR1bGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4ge1xuXHRcdFx0dGhpcy5jbGVhblVwU3RvcmFnZSgpO1xuXHRcdH0sIDMwICogMTAwMCAvKiBhZnRlciAzMHMgKi8pKTtcblx0XHRzY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgY2xlYW5VcFN0b3JhZ2UoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdbc3RvcmFnZSBjbGVhbnVwXTogU3RhcnRpbmcgdG8gY2xlYW4gdXAgd29ya3NwYWNlIHN0b3JhZ2UgZm9sZGVycyBmb3IgdW51c2VkIGVtcHR5IHdvcmtzcGFjZXMuJyk7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3Qgd29ya3NwYWNlU3RvcmFnZUhvbWUgPSB0aGlzLmVudmlyb25tZW50U2VydmljZS53b3Jrc3BhY2VTdG9yYWdlSG9tZS53aXRoKHsgc2NoZW1lOiBTY2hlbWFzLmZpbGUgfSkuZnNQYXRoO1xuXHRcdFx0Y29uc3Qgd29ya3NwYWNlU3RvcmFnZUZvbGRlcnMgPSBhd2FpdCBQcm9taXNlcy5yZWFkZGlyKHdvcmtzcGFjZVN0b3JhZ2VIb21lKTtcblx0XHRcdGNvbnN0IHN0b3JhZ2VDbGllbnQgPSBuZXcgU3RvcmFnZUNsaWVudCh0aGlzLm1haW5Qcm9jZXNzU2VydmljZS5nZXRDaGFubmVsKCdzdG9yYWdlJykpO1xuXG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbCh3b3Jrc3BhY2VTdG9yYWdlRm9sZGVycy5tYXAoYXN5bmMgd29ya3NwYWNlU3RvcmFnZUZvbGRlciA9PiB7XG5cdFx0XHRcdGNvbnN0IHdvcmtzcGFjZVN0b3JhZ2VQYXRoID0gam9pbih3b3Jrc3BhY2VTdG9yYWdlSG9tZSwgd29ya3NwYWNlU3RvcmFnZUZvbGRlcik7XG5cblx0XHRcdFx0aWYgKHdvcmtzcGFjZVN0b3JhZ2VGb2xkZXIubGVuZ3RoID09PSBOT05fRU1QVFlfV09SS1NQQUNFX0lEX0xFTkdUSCkge1xuXHRcdFx0XHRcdHJldHVybjsgLy8ga2VlcCB3b3Jrc3BhY2Ugc3RvcmFnZSBmb3IgZm9sZGVycy93b3Jrc3BhY2VzIHRoYXQgY2FuIGJlIGFjY2Vzc2VkIHN0aWxsXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAod29ya3NwYWNlU3RvcmFnZUZvbGRlciA9PT0gRVhURU5TSU9OX0RFVkVMT1BNRU5UX0VNUFRZX1dJTkRPV19XT1JLU1BBQ0UuaWQpIHtcblx0XHRcdFx0XHRyZXR1cm47IC8vIGtlZXAgd29ya3NwYWNlIHN0b3JhZ2UgZm9yIGVtcHR5IGV4dGVuc2lvbiBkZXZlbG9wbWVudCB3b3Jrc3BhY2VzXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCB3aW5kb3dzID0gYXdhaXQgdGhpcy5uYXRpdmVIb3N0U2VydmljZS5nZXRXaW5kb3dzKHsgaW5jbHVkZUF1eGlsaWFyeVdpbmRvd3M6IGZhbHNlIH0pO1xuXHRcdFx0XHRpZiAod2luZG93cy5zb21lKHdpbmRvdyA9PiB3aW5kb3cud29ya3NwYWNlPy5pZCA9PT0gd29ya3NwYWNlU3RvcmFnZUZvbGRlcikpIHtcblx0XHRcdFx0XHRyZXR1cm47IC8vIGtlZXAgd29ya3NwYWNlIHN0b3JhZ2UgZm9yIGVtcHR5IHdvcmtzcGFjZXMgb3BlbmVkIGFzIHdpbmRvd1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgaXNTdG9yYWdlVXNlZCA9IGF3YWl0IHN0b3JhZ2VDbGllbnQuaXNVc2VkKHdvcmtzcGFjZVN0b3JhZ2VQYXRoKTtcblx0XHRcdFx0aWYgKGlzU3RvcmFnZVVzZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47IC8vIGtlZXAgd29ya3NwYWNlIHN0b3JhZ2UgZm9yIGVtcHR5IHdvcmtzcGFjZXMgdGhhdCBhcmUgaW4gdXNlXG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYFtzdG9yYWdlIGNsZWFudXBdOiBEZWxldGluZyB3b3Jrc3BhY2Ugc3RvcmFnZSBmb2xkZXIgJHt3b3Jrc3BhY2VTdG9yYWdlRm9sZGVyfSBhcyBpdCBzZWVtcyB0byBiZSBhbiB1bnVzZWQgZW1wdHkgd29ya3NwYWNlLmApO1xuXG5cdFx0XHRcdGF3YWl0IFByb21pc2VzLnJtKHdvcmtzcGFjZVN0b3JhZ2VQYXRoKTtcblx0XHRcdH0pKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZXJyb3IpO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLFlBQVk7QUFDckIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxvREFBb0Q7QUFDN0QsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxlQUFlO0FBRWpCLElBQU0sb0NBQU4sY0FBZ0QsV0FBVztBQUFBLEVBRWpFLFlBQzZDLG9CQUNkLFlBQ08sbUJBQ0Msb0JBQ3JDO0FBQ0QsVUFBTTtBQUxzQztBQUNkO0FBQ087QUFDQztBQUl0QyxVQUFNLFlBQVksS0FBSyxVQUFVLElBQUk7QUFBQSxNQUFpQixNQUFNO0FBQzNELGFBQUssZUFBZTtBQUFBLE1BQ3JCO0FBQUEsTUFBRyxLQUFLO0FBQUE7QUFBQSxJQUFvQixDQUFDO0FBQzdCLGNBQVUsU0FBUztBQUFBLEVBQ3BCO0FBQUEsRUFFQSxNQUFjLGlCQUFnQztBQUM3QyxTQUFLLFdBQVcsTUFBTSxnR0FBZ0c7QUFFdEgsUUFBSTtBQUNILFlBQU0sdUJBQXVCLEtBQUssbUJBQW1CLHFCQUFxQixLQUFLLEVBQUUsUUFBUSxRQUFRLEtBQUssQ0FBQyxFQUFFO0FBQ3pHLFlBQU0sMEJBQTBCLE1BQU0sU0FBUyxRQUFRLG9CQUFvQjtBQUMzRSxZQUFNLGdCQUFnQixJQUFJLGNBQWMsS0FBSyxtQkFBbUIsV0FBVyxTQUFTLENBQUM7QUFFckYsWUFBTSxRQUFRLElBQUksd0JBQXdCLElBQUksT0FBTSwyQkFBMEI7QUFDN0UsY0FBTSx1QkFBdUIsS0FBSyxzQkFBc0Isc0JBQXNCO0FBRTlFLFlBQUksdUJBQXVCLFdBQVcsK0JBQStCO0FBQ3BFO0FBQUEsUUFDRDtBQUVBLFlBQUksMkJBQTJCLDZDQUE2QyxJQUFJO0FBQy9FO0FBQUEsUUFDRDtBQUVBLGNBQU0sVUFBVSxNQUFNLEtBQUssa0JBQWtCLFdBQVcsRUFBRSx5QkFBeUIsTUFBTSxDQUFDO0FBQzFGLFlBQUksUUFBUSxLQUFLLFlBQVUsT0FBTyxXQUFXLE9BQU8sc0JBQXNCLEdBQUc7QUFDNUU7QUFBQSxRQUNEO0FBRUEsY0FBTSxnQkFBZ0IsTUFBTSxjQUFjLE9BQU8sb0JBQW9CO0FBQ3JFLFlBQUksZUFBZTtBQUNsQjtBQUFBLFFBQ0Q7QUFFQSxhQUFLLFdBQVcsTUFBTSx3REFBd0Qsc0JBQXNCLCtDQUErQztBQUVuSixjQUFNLFNBQVMsR0FBRyxvQkFBb0I7QUFBQSxNQUN2QyxDQUFDLENBQUM7QUFBQSxJQUNILFNBQVMsT0FBTztBQUNmLHdCQUFrQixLQUFLO0FBQUEsSUFDeEI7QUFBQSxFQUNEO0FBQ0Q7QUFyRGEsb0NBQU47QUFBQSxFQUdKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FOVTsiLAogICJuYW1lcyI6IFtdCn0K
