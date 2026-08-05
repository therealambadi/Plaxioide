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
import { join } from "../../../../base/common/path.js";
import { Promises } from "../../../../base/node/pfs.js";
import { INativeEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
let LanguagePackCachedDataCleaner = class extends Disposable {
  constructor(environmentService, logService, productService) {
    super();
    this.environmentService = environmentService;
    this.logService = logService;
    this.dataMaxAge = productService.quality !== "stable" ? 1e3 * 60 * 60 * 24 * 7 : 1e3 * 60 * 60 * 24 * 30 * 3;
    if (this.environmentService.isBuilt) {
      const scheduler = this._register(new RunOnceScheduler(
        () => {
          this.cleanUpLanguagePackCache();
        },
        40 * 1e3
        /* after 40s */
      ));
      scheduler.schedule();
    }
  }
  async cleanUpLanguagePackCache() {
    this.logService.trace("[language pack cache cleanup]: Starting to clean up unused language packs.");
    try {
      const installed = /* @__PURE__ */ Object.create(null);
      const metaData = JSON.parse(await promises.readFile(join(this.environmentService.userDataPath, "languagepacks.json"), "utf8"));
      for (const locale of Object.keys(metaData)) {
        const entry = metaData[locale];
        installed[`${entry.hash}.${locale}`] = true;
      }
      const cacheDir = join(this.environmentService.userDataPath, "clp");
      const cacheDirExists = await Promises.exists(cacheDir);
      if (!cacheDirExists) {
        return;
      }
      const entries = await Promises.readdir(cacheDir);
      for (const entry of entries) {
        if (installed[entry]) {
          this.logService.trace(`[language pack cache cleanup]: Skipping folder ${entry}. Language pack still in use.`);
          continue;
        }
        this.logService.trace(`[language pack cache cleanup]: Removing unused language pack: ${entry}`);
        await Promises.rm(join(cacheDir, entry));
      }
      const now = Date.now();
      for (const packEntry of Object.keys(installed)) {
        const folder = join(cacheDir, packEntry);
        const entries2 = await Promises.readdir(folder);
        for (const entry of entries2) {
          if (entry === "tcf.json") {
            continue;
          }
          const candidate = join(folder, entry);
          const stat = await promises.stat(candidate);
          if (stat.isDirectory() && now - stat.mtime.getTime() > this.dataMaxAge) {
            this.logService.trace(`[language pack cache cleanup]: Removing language pack cache folder: ${join(packEntry, entry)}`);
            await Promises.rm(candidate);
          }
        }
      }
    } catch (error) {
      onUnexpectedError(error);
    }
  }
};
LanguagePackCachedDataCleaner = __decorateClass([
  __decorateParam(0, INativeEnvironmentService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IProductService)
], LanguagePackCachedDataCleaner);
export {
  LanguagePackCachedDataCleaner
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9jb2RlL2VsZWN0cm9uLXV0aWxpdHkvc2hhcmVkUHJvY2Vzcy9jb250cmliL2xhbmd1YWdlUGFja0NhY2hlZERhdGFDbGVhbmVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgcHJvbWlzZXMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgSVN0cmluZ0RpY3Rpb25hcnkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xsZWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IFByb21pc2VzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9ub2RlL3Bmcy5qcyc7XG5pbXBvcnQgeyBJTmF0aXZlRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuXG5pbnRlcmZhY2UgSUV4dGVuc2lvbkVudHJ5IHtcblx0dmVyc2lvbjogc3RyaW5nO1xuXHRleHRlbnNpb25JZGVudGlmaWVyOiB7XG5cdFx0aWQ6IHN0cmluZztcblx0XHR1dWlkOiBzdHJpbmc7XG5cdH07XG59XG5cbmludGVyZmFjZSBJTGFuZ3VhZ2VQYWNrRW50cnkge1xuXHRoYXNoOiBzdHJpbmc7XG5cdGV4dGVuc2lvbnM6IElFeHRlbnNpb25FbnRyeVtdO1xufVxuXG5pbnRlcmZhY2UgSUxhbmd1YWdlUGFja0ZpbGUge1xuXHRbbG9jYWxlOiBzdHJpbmddOiBJTGFuZ3VhZ2VQYWNrRW50cnk7XG59XG5cbmV4cG9ydCBjbGFzcyBMYW5ndWFnZVBhY2tDYWNoZWREYXRhQ2xlYW5lciBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZGF0YU1heEFnZTogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTmF0aXZlRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJTmF0aXZlRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5kYXRhTWF4QWdlID0gcHJvZHVjdFNlcnZpY2UucXVhbGl0eSAhPT0gJ3N0YWJsZSdcblx0XHRcdD8gMTAwMCAqIDYwICogNjAgKiAyNCAqIDcgXHRcdC8vIHJvdWdobHkgMSB3ZWVrIChpbnNpZGVycylcblx0XHRcdDogMTAwMCAqIDYwICogNjAgKiAyNCAqIDMwICogMzsgLy8gcm91Z2hseSAzIG1vbnRocyAoc3RhYmxlKVxuXG5cdFx0Ly8gV2UgaGF2ZSBubyBMYW5ndWFnZSBwYWNrIHN1cHBvcnQgZm9yIGRldiB2ZXJzaW9uIChydW4gZnJvbSBzb3VyY2UpXG5cdFx0Ly8gU28gb25seSBjbGVhbnVwIHdoZW4gd2UgaGF2ZSBhIGJ1aWxkIHZlcnNpb24uXG5cdFx0aWYgKHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLmlzQnVpbHQpIHtcblx0XHRcdGNvbnN0IHNjaGVkdWxlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHtcblx0XHRcdFx0dGhpcy5jbGVhblVwTGFuZ3VhZ2VQYWNrQ2FjaGUoKTtcblx0XHRcdH0sIDQwICogMTAwMCAvKiBhZnRlciA0MHMgKi8pKTtcblx0XHRcdHNjaGVkdWxlci5zY2hlZHVsZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgY2xlYW5VcExhbmd1YWdlUGFja0NhY2hlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnW2xhbmd1YWdlIHBhY2sgY2FjaGUgY2xlYW51cF06IFN0YXJ0aW5nIHRvIGNsZWFuIHVwIHVudXNlZCBsYW5ndWFnZSBwYWNrcy4nKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YWxsZWQ6IElTdHJpbmdEaWN0aW9uYXJ5PGJvb2xlYW4+ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRcdGNvbnN0IG1ldGFEYXRhOiBJTGFuZ3VhZ2VQYWNrRmlsZSA9IEpTT04ucGFyc2UoYXdhaXQgcHJvbWlzZXMucmVhZEZpbGUoam9pbih0aGlzLmVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVBhdGgsICdsYW5ndWFnZXBhY2tzLmpzb24nKSwgJ3V0ZjgnKSk7XG5cdFx0XHRmb3IgKGNvbnN0IGxvY2FsZSBvZiBPYmplY3Qua2V5cyhtZXRhRGF0YSkpIHtcblx0XHRcdFx0Y29uc3QgZW50cnkgPSBtZXRhRGF0YVtsb2NhbGVdO1xuXHRcdFx0XHRpbnN0YWxsZWRbYCR7ZW50cnkuaGFzaH0uJHtsb2NhbGV9YF0gPSB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBDbGVhbnVwIGVudHJpZXMgZm9yIGxhbmd1YWdlIHBhY2tzIHRoYXQgYXJlbid0IGluc3RhbGxlZCBhbnltb3JlXG5cdFx0XHRjb25zdCBjYWNoZURpciA9IGpvaW4odGhpcy5lbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFQYXRoLCAnY2xwJyk7XG5cdFx0XHRjb25zdCBjYWNoZURpckV4aXN0cyA9IGF3YWl0IFByb21pc2VzLmV4aXN0cyhjYWNoZURpcik7XG5cdFx0XHRpZiAoIWNhY2hlRGlyRXhpc3RzKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZW50cmllcyA9IGF3YWl0IFByb21pc2VzLnJlYWRkaXIoY2FjaGVEaXIpO1xuXHRcdFx0Zm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG5cdFx0XHRcdGlmIChpbnN0YWxsZWRbZW50cnldKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBbbGFuZ3VhZ2UgcGFjayBjYWNoZSBjbGVhbnVwXTogU2tpcHBpbmcgZm9sZGVyICR7ZW50cnl9LiBMYW5ndWFnZSBwYWNrIHN0aWxsIGluIHVzZS5gKTtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgW2xhbmd1YWdlIHBhY2sgY2FjaGUgY2xlYW51cF06IFJlbW92aW5nIHVudXNlZCBsYW5ndWFnZSBwYWNrOiAke2VudHJ5fWApO1xuXG5cdFx0XHRcdGF3YWl0IFByb21pc2VzLnJtKGpvaW4oY2FjaGVEaXIsIGVudHJ5KSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cdFx0XHRmb3IgKGNvbnN0IHBhY2tFbnRyeSBvZiBPYmplY3Qua2V5cyhpbnN0YWxsZWQpKSB7XG5cdFx0XHRcdGNvbnN0IGZvbGRlciA9IGpvaW4oY2FjaGVEaXIsIHBhY2tFbnRyeSk7XG5cdFx0XHRcdGNvbnN0IGVudHJpZXMgPSBhd2FpdCBQcm9taXNlcy5yZWFkZGlyKGZvbGRlcik7XG5cdFx0XHRcdGZvciAoY29uc3QgZW50cnkgb2YgZW50cmllcykge1xuXHRcdFx0XHRcdGlmIChlbnRyeSA9PT0gJ3RjZi5qc29uJykge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgY2FuZGlkYXRlID0gam9pbihmb2xkZXIsIGVudHJ5KTtcblx0XHRcdFx0XHRjb25zdCBzdGF0ID0gYXdhaXQgcHJvbWlzZXMuc3RhdChjYW5kaWRhdGUpO1xuXHRcdFx0XHRcdGlmIChzdGF0LmlzRGlyZWN0b3J5KCkgJiYgKG5vdyAtIHN0YXQubXRpbWUuZ2V0VGltZSgpKSA+IHRoaXMuZGF0YU1heEFnZSkge1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBbbGFuZ3VhZ2UgcGFjayBjYWNoZSBjbGVhbnVwXTogUmVtb3ZpbmcgbGFuZ3VhZ2UgcGFjayBjYWNoZSBmb2xkZXI6ICR7am9pbihwYWNrRW50cnksIGVudHJ5KX1gKTtcblxuXHRcdFx0XHRcdFx0YXdhaXQgUHJvbWlzZXMucm0oY2FuZGlkYXRlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZXJyb3IpO1xu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
