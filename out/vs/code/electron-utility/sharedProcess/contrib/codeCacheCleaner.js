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
import { promises } from "fs";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { basename, dirname, join } from "../../../../base/common/path.js";
import { Promises } from "../../../../base/node/pfs.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
let CodeCacheCleaner = class extends Disposable {
  constructor(currentCodeCachePath, productService, logService) {
    super();
    this.logService = logService;
    this.dataMaxAge = productService.quality !== "stable" ? 1e3 * 60 * 60 * 24 * 7 : 1e3 * 60 * 60 * 24 * 30 * 3;
    if (currentCodeCachePath) {
      const scheduler = this._register(new RunOnceScheduler(
        () => {
          this.cleanUpCodeCaches(currentCodeCachePath);
        },
        30 * 1e3
        /* after 30s */
      ));
      scheduler.schedule();
    }
  }
  async cleanUpCodeCaches(currentCodeCachePath) {
    this.logService.trace("[code cache cleanup]: Starting to clean up old code cache folders.");
    try {
      const now = Date.now();
      const codeCacheRootPath = dirname(currentCodeCachePath);
      const currentCodeCache = basename(currentCodeCachePath);
      const codeCaches = await Promises.readdir(codeCacheRootPath);
      await Promise.all(codeCaches.map(async (codeCache) => {
        if (codeCache === currentCodeCache) {
          return;
        }
        const codeCacheEntryPath = join(codeCacheRootPath, codeCache);
        const codeCacheEntryStat = await promises.stat(codeCacheEntryPath);
        if (codeCacheEntryStat.isDirectory() && now - codeCacheEntryStat.mtime.getTime() > this.dataMaxAge) {
          this.logService.trace(`[code cache cleanup]: Removing code cache folder ${codeCache}.`);
          return Promises.rm(codeCacheEntryPath);
        }
      }));
    } catch (error) {
      onUnexpectedError(error);
    }
  }
};
CodeCacheCleaner = __decorateClass([
  __decorateParam(1, IProductService),
  __decorateParam(2, ILogService)
], CodeCacheCleaner);
export {
  CodeCacheCleaner
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9jb2RlL2VsZWN0cm9uLXV0aWxpdHkvc2hhcmVkUHJvY2Vzcy9jb250cmliL2NvZGVDYWNoZUNsZWFuZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBwcm9taXNlcyB9IGZyb20gJ2ZzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lLCBkaXJuYW1lLCBqb2luIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBQcm9taXNlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2Uvbm9kZS9wZnMuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBDb2RlQ2FjaGVDbGVhbmVyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBkYXRhTWF4QWdlOiBudW1iZXI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Y3VycmVudENvZGVDYWNoZVBhdGg6IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuZGF0YU1heEFnZSA9IHByb2R1Y3RTZXJ2aWNlLnF1YWxpdHkgIT09ICdzdGFibGUnXG5cdFx0XHQ/IDEwMDAgKiA2MCAqIDYwICogMjQgKiA3IFx0XHQvLyByb3VnaGx5IDEgd2VlayAoaW5zaWRlcnMpXG5cdFx0XHQ6IDEwMDAgKiA2MCAqIDYwICogMjQgKiAzMCAqIDM7IC8vIHJvdWdobHkgMyBtb250aHMgKHN0YWJsZSlcblxuXHRcdC8vIENhY2hlZCBkYXRhIGlzIHN0b3JlZCBhcyB1c2VyIGRhdGEgYW5kIHdlIHJ1biBhIGNsZWFudXAgdGFzayBldmVyeSB0aW1lXG5cdFx0Ly8gdGhlIGVkaXRvciBzdGFydHMuIFRoZSBzdHJhdGVneSBpcyB0byBkZWxldGUgYWxsIGZpbGVzIHRoYXQgYXJlIG9sZGVyIHRoYW5cblx0XHQvLyAzIG1vbnRocyAoMSB3ZWVrIHJlc3BlY3RpdmVseSlcblx0XHRpZiAoY3VycmVudENvZGVDYWNoZVBhdGgpIHtcblx0XHRcdGNvbnN0IHNjaGVkdWxlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHtcblx0XHRcdFx0dGhpcy5jbGVhblVwQ29kZUNhY2hlcyhjdXJyZW50Q29kZUNhY2hlUGF0aCk7XG5cdFx0XHR9LCAzMCAqIDEwMDAgLyogYWZ0ZXIgMzBzICovKSk7XG5cdFx0XHRzY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNsZWFuVXBDb2RlQ2FjaGVzKGN1cnJlbnRDb2RlQ2FjaGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ1tjb2RlIGNhY2hlIGNsZWFudXBdOiBTdGFydGluZyB0byBjbGVhbiB1cCBvbGQgY29kZSBjYWNoZSBmb2xkZXJzLicpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cblx0XHRcdC8vIFRoZSBmb2xkZXIgd2hpY2ggY29udGFpbnMgZm9sZGVycyBvZiBjYWNoZWQgZGF0YS5cblx0XHRcdC8vIEVhY2ggb2YgdGhlc2UgZm9sZGVycyBpcyBwYXJ0aW9uZWQgcGVyIGNvbW1pdFxuXHRcdFx0Y29uc3QgY29kZUNhY2hlUm9vdFBhdGggPSBkaXJuYW1lKGN1cnJlbnRDb2RlQ2FjaGVQYXRoKTtcblx0XHRcdGNvbnN0IGN1cnJlbnRDb2RlQ2FjaGUgPSBiYXNlbmFtZShjdXJyZW50Q29kZUNhY2hlUGF0aCk7XG5cblx0XHRcdGNvbnN0IGNvZGVDYWNoZXMgPSBhd2FpdCBQcm9taXNlcy5yZWFkZGlyKGNvZGVDYWNoZVJvb3RQYXRoKTtcblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKGNvZGVDYWNoZXMubWFwKGFzeW5jIGNvZGVDYWNoZSA9PiB7XG5cdFx0XHRcdGlmIChjb2RlQ2FjaGUgPT09IGN1cnJlbnRDb2RlQ2FjaGUpIHtcblx0XHRcdFx0XHRyZXR1cm47IC8vIG5vdCB0aGUgY3VycmVudCBjYWNoZSBmb2xkZXJcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIERlbGV0ZSBjYWNoZSBmb2xkZXIgaWYgb2xkIGVub3VnaFxuXHRcdFx0XHRjb25zdCBjb2RlQ2FjaGVFbnRyeVBhdGggPSBqb2luKGNvZGVDYWNoZVJvb3RQYXRoLCBjb2RlQ2FjaGUpO1xuXHRcdFx0XHRjb25zdCBjb2RlQ2FjaGVFbnRyeVN0YXQgPSBhd2FpdCBwcm9taXNlcy5zdGF0KGNvZGVDYWNoZUVudHJ5UGF0aCk7XG5cdFx0XHRcdGlmIChjb2RlQ2FjaGVFbnRyeVN0YXQuaXNEaXJlY3RvcnkoKSAmJiAobm93IC0gY29kZUNhY2hlRW50cnlTdGF0Lm10aW1lLmdldFRpbWUoKSkgPiB0aGlzLmRhdGFNYXhBZ2UpIHtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYFtjb2RlIGNhY2hlIGNsZWFudXBdOiBSZW1vdmluZyBjb2RlIGNhY2hlIGZvbGRlciAke2NvZGVDYWNoZX0uYCk7XG5cblx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZXMucm0oY29kZUNhY2hlRW50cnlQYXRoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlcnJvcik7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsVUFBVSxTQUFTLFlBQVk7QUFDeEMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyx1QkFBdUI7QUFFekIsSUFBTSxtQkFBTixjQUErQixXQUFXO0FBQUEsRUFJaEQsWUFDQyxzQkFDaUIsZ0JBQ2EsWUFDN0I7QUFDRCxVQUFNO0FBRndCO0FBSTlCLFNBQUssYUFBYSxlQUFlLFlBQVksV0FDMUMsTUFBTyxLQUFLLEtBQUssS0FBSyxJQUN0QixNQUFPLEtBQUssS0FBSyxLQUFLLEtBQUs7QUFLOUIsUUFBSSxzQkFBc0I7QUFDekIsWUFBTSxZQUFZLEtBQUssVUFBVSxJQUFJO0FBQUEsUUFBaUIsTUFBTTtBQUMzRCxlQUFLLGtCQUFrQixvQkFBb0I7QUFBQSxRQUM1QztBQUFBLFFBQUcsS0FBSztBQUFBO0FBQUEsTUFBb0IsQ0FBQztBQUM3QixnQkFBVSxTQUFTO0FBQUEsSUFDcEI7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFjLGtCQUFrQixzQkFBNkM7QUFDNUUsU0FBSyxXQUFXLE1BQU0sb0VBQW9FO0FBRTFGLFFBQUk7QUFDSCxZQUFNLE1BQU0sS0FBSyxJQUFJO0FBSXJCLFlBQU0sb0JBQW9CLFFBQVEsb0JBQW9CO0FBQ3RELFlBQU0sbUJBQW1CLFNBQVMsb0JBQW9CO0FBRXRELFlBQU0sYUFBYSxNQUFNLFNBQVMsUUFBUSxpQkFBaUI7QUFDM0QsWUFBTSxRQUFRLElBQUksV0FBVyxJQUFJLE9BQU0sY0FBYTtBQUNuRCxZQUFJLGNBQWMsa0JBQWtCO0FBQ25DO0FBQUEsUUFDRDtBQUdBLGNBQU0scUJBQXFCLEtBQUssbUJBQW1CLFNBQVM7QUFDNUQsY0FBTSxxQkFBcUIsTUFBTSxTQUFTLEtBQUssa0JBQWtCO0FBQ2pFLFlBQUksbUJBQW1CLFlBQVksS0FBTSxNQUFNLG1CQUFtQixNQUFNLFFBQVEsSUFBSyxLQUFLLFlBQVk7QUFDckcsZUFBSyxXQUFXLE1BQU0sb0RBQW9ELFNBQVMsR0FBRztBQUV0RixpQkFBTyxTQUFTLEdBQUcsa0JBQWtCO0FBQUEsUUFDdEM7QUFBQSxNQUNELENBQUMsQ0FBQztBQUFBLElBQ0gsU0FBUyxPQUFPO0FBQ2Ysd0JBQWtCLEtBQUs7QUFBQSxJQUN4QjtBQUFBLEVBQ0Q7QUFDRDtBQXhEYSxtQkFBTjtBQUFBLEVBTUo7QUFBQSxFQUNBO0FBQUEsR0FQVTsiLAogICJuYW1lcyI6IFtdCn0K
