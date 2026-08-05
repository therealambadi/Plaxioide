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
import { IFileService } from "../../../../platform/files/common/files.js";
import { basename, dirname } from "../../../../base/common/resources.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
import { Promises } from "../../../../base/common/async.js";
let LogsDataCleaner = class extends Disposable {
  constructor(environmentService, fileService, lifecycleService) {
    super();
    this.environmentService = environmentService;
    this.fileService = fileService;
    this.lifecycleService = lifecycleService;
    this.cleanUpOldLogsSoon();
  }
  cleanUpOldLogsSoon() {
    let handle = setTimeout(async () => {
      handle = void 0;
      const stat = await this.fileService.resolve(dirname(this.environmentService.logsHome));
      if (stat.children) {
        const currentLog = basename(this.environmentService.logsHome);
        const allSessions = stat.children.filter((stat2) => stat2.isDirectory && /^\d{8}T\d{6}$/.test(stat2.name));
        const oldSessions = allSessions.sort().filter((d, i) => d.name !== currentLog);
        const toDelete = oldSessions.slice(0, Math.max(0, oldSessions.length - 49));
        Promises.settled(toDelete.map((stat2) => this.fileService.del(stat2.resource, { recursive: true })));
      }
    }, 10 * 1e3);
    this.lifecycleService.onWillShutdown(() => {
      if (handle) {
        clearTimeout(handle);
        handle = void 0;
      }
    });
  }
};
LogsDataCleaner = __decorateClass([
  __decorateParam(0, IWorkbenchEnvironmentService),
  __decorateParam(1, IFileService),
  __decorateParam(2, ILifecycleService)
], LogsDataCleaner);
export {
  LogsDataCleaner
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9sb2dzL2NvbW1vbi9sb2dzRGF0YUNsZWFuZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZGlybmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFByb21pc2VzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuXG5leHBvcnQgY2xhc3MgTG9nc0RhdGFDbGVhbmVyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5jbGVhblVwT2xkTG9nc1Nvb24oKTtcblx0fVxuXG5cdHByaXZhdGUgY2xlYW5VcE9sZExvZ3NTb29uKCk6IHZvaWQge1xuXHRcdGxldCBoYW5kbGU6IGFueSA9IHNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0aGFuZGxlID0gdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3Qgc3RhdCA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UucmVzb2x2ZShkaXJuYW1lKHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLmxvZ3NIb21lKSk7XG5cdFx0XHRpZiAoc3RhdC5jaGlsZHJlbikge1xuXHRcdFx0XHRjb25zdCBjdXJyZW50TG9nID0gYmFzZW5hbWUodGhpcy5lbnZpcm9ubWVudFNlcnZpY2UubG9nc0hvbWUpO1xuXHRcdFx0XHRjb25zdCBhbGxTZXNzaW9ucyA9IHN0YXQuY2hpbGRyZW4uZmlsdGVyKHN0YXQgPT4gc3RhdC5pc0RpcmVjdG9yeSAmJiAvXlxcZHs4fVRcXGR7Nn0kLy50ZXN0KHN0YXQubmFtZSkpO1xuXHRcdFx0XHRjb25zdCBvbGRTZXNzaW9ucyA9IGFsbFNlc3Npb25zLnNvcnQoKS5maWx0ZXIoKGQsIGkpID0+IGQubmFtZSAhPT0gY3VycmVudExvZyk7XG5cdFx0XHRcdGNvbnN0IHRvRGVsZXRlID0gb2xkU2Vzc2lvbnMuc2xpY2UoMCwgTWF0aC5tYXgoMCwgb2xkU2Vzc2lvbnMubGVuZ3RoIC0gNDkpKTtcblx0XHRcdFx0UHJvbWlzZXMuc2V0dGxlZCh0b0RlbGV0ZS5tYXAoc3RhdCA9PiB0aGlzLmZpbGVTZXJ2aWNlLmRlbChzdGF0LnJlc291cmNlLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KSkpO1xuXHRcdFx0fVxuXHRcdH0sIDEwICogMTAwMCk7XG5cdFx0dGhpcy5saWZlY3ljbGVTZXJ2aWNlLm9uV2lsbFNodXRkb3duKCgpID0+IHtcblx0XHRcdGlmIChoYW5kbGUpIHtcblx0XHRcdFx0Y2xlYXJUaW1lb3V0KGhhbmRsZSk7XG5cdFx0XHRcdGhhbmRsZSA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLFVBQVUsZUFBZTtBQUNsQyxTQUFTLG9DQUFvQztBQUM3QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGdCQUFnQjtBQUVsQixJQUFNLGtCQUFOLGNBQThCLFdBQVc7QUFBQSxFQUUvQyxZQUNnRCxvQkFDaEIsYUFDSyxrQkFDbkM7QUFDRCxVQUFNO0FBSnlDO0FBQ2hCO0FBQ0s7QUFHcEMsU0FBSyxtQkFBbUI7QUFBQSxFQUN6QjtBQUFBLEVBRVEscUJBQTJCO0FBQ2xDLFFBQUksU0FBYyxXQUFXLFlBQVk7QUFDeEMsZUFBUztBQUNULFlBQU0sT0FBTyxNQUFNLEtBQUssWUFBWSxRQUFRLFFBQVEsS0FBSyxtQkFBbUIsUUFBUSxDQUFDO0FBQ3JGLFVBQUksS0FBSyxVQUFVO0FBQ2xCLGNBQU0sYUFBYSxTQUFTLEtBQUssbUJBQW1CLFFBQVE7QUFDNUQsY0FBTSxjQUFjLEtBQUssU0FBUyxPQUFPLENBQUFBLFVBQVFBLE1BQUssZUFBZSxnQkFBZ0IsS0FBS0EsTUFBSyxJQUFJLENBQUM7QUFDcEcsY0FBTSxjQUFjLFlBQVksS0FBSyxFQUFFLE9BQU8sQ0FBQyxHQUFHLE1BQU0sRUFBRSxTQUFTLFVBQVU7QUFDN0UsY0FBTSxXQUFXLFlBQVksTUFBTSxHQUFHLEtBQUssSUFBSSxHQUFHLFlBQVksU0FBUyxFQUFFLENBQUM7QUFDMUUsaUJBQVMsUUFBUSxTQUFTLElBQUksQ0FBQUEsVUFBUSxLQUFLLFlBQVksSUFBSUEsTUFBSyxVQUFVLEVBQUUsV0FBVyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQUEsTUFDaEc7QUFBQSxJQUNELEdBQUcsS0FBSyxHQUFJO0FBQ1osU0FBSyxpQkFBaUIsZUFBZSxNQUFNO0FBQzFDLFVBQUksUUFBUTtBQUNYLHFCQUFhLE1BQU07QUFDbkIsaUJBQVM7QUFBQSxNQUNWO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUNEO0FBOUJhLGtCQUFOO0FBQUEsRUFHSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FMVTsiLAogICJuYW1lcyI6IFsic3RhdCJdCn0K
