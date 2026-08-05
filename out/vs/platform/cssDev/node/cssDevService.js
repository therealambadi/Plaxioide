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
import { spawn } from "child_process";
import { relative } from "path";
import { FileAccess } from "../../../base/common/network.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
const ICSSDevelopmentService = createDecorator("ICSSDevelopmentService");
let CSSDevelopmentService = class {
  constructor(envService, logService) {
    this.envService = envService;
    this.logService = logService;
  }
  get isEnabled() {
    return !this.envService.isBuilt;
  }
  getCssModules() {
    this._cssModules ??= this.computeCssModules();
    return this._cssModules;
  }
  async computeCssModules() {
    if (!this.isEnabled) {
      return [];
    }
    const rg = await import("@vscode/ripgrep");
    return await new Promise((resolve) => {
      const sw = StopWatch.create();
      const chunks = [];
      const decoder = new TextDecoder();
      const basePath = FileAccess.asFileUri("").fsPath;
      const process = spawn(rg.rgPath, ["-g", "**/*.css", "--files", "--no-ignore", basePath], {});
      process.stdout.on("data", (data) => {
        const chunk = decoder.decode(data, { stream: true });
        chunks.push(chunk.split("\n").filter(Boolean));
      });
      process.on("error", (err) => {
        this.logService.error("[CSS_DEV] FAILED to compute CSS data", err);
        resolve([]);
      });
      process.on("close", () => {
        const result = chunks.flat().map((path) => relative(basePath, path).replace(/\\/g, "/")).filter(Boolean).sort();
        resolve(result);
        this.logService.info(`[CSS_DEV] DONE, ${result.length} css modules (${Math.round(sw.elapsed())}ms)`);
      });
    });
  }
};
CSSDevelopmentService = __decorateClass([
  __decorateParam(0, IEnvironmentService),
  __decorateParam(1, ILogService)
], CSSDevelopmentService);
export {
  CSSDevelopmentService,
  ICSSDevelopmentService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9jc3NEZXYvbm9kZS9jc3NEZXZTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgc3Bhd24gfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IHJlbGF0aXZlIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBGaWxlQWNjZXNzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBTdG9wV2F0Y2ggfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9zdG9wd2F0Y2guanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuXG5leHBvcnQgY29uc3QgSUNTU0RldmVsb3BtZW50U2VydmljZSA9IGNyZWF0ZURlY29yYXRvcjxJQ1NTRGV2ZWxvcG1lbnRTZXJ2aWNlPignSUNTU0RldmVsb3BtZW50U2VydmljZScpO1xuXG5leHBvcnQgaW50ZXJmYWNlIElDU1NEZXZlbG9wbWVudFNlcnZpY2Uge1xuXHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdGlzRW5hYmxlZDogYm9vbGVhbjtcblx0Z2V0Q3NzTW9kdWxlcygpOiBQcm9taXNlPHN0cmluZ1tdPjtcbn1cblxuZXhwb3J0IGNsYXNzIENTU0RldmVsb3BtZW50U2VydmljZSBpbXBsZW1lbnRzIElDU1NEZXZlbG9wbWVudFNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgX2Nzc01vZHVsZXM/OiBQcm9taXNlPHN0cmluZ1tdPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVudlNlcnZpY2U6IElFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7IH1cblxuXHRnZXQgaXNFbmFibGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhdGhpcy5lbnZTZXJ2aWNlLmlzQnVpbHQ7XG5cdH1cblxuXHRnZXRDc3NNb2R1bGVzKCk6IFByb21pc2U8c3RyaW5nW10+IHtcblx0XHR0aGlzLl9jc3NNb2R1bGVzID8/PSB0aGlzLmNvbXB1dGVDc3NNb2R1bGVzKCk7XG5cdFx0cmV0dXJuIHRoaXMuX2Nzc01vZHVsZXM7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNvbXB1dGVDc3NNb2R1bGVzKCk6IFByb21pc2U8c3RyaW5nW10+IHtcblx0XHRpZiAoIXRoaXMuaXNFbmFibGVkKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmcgPSBhd2FpdCBpbXBvcnQoJ0B2c2NvZGUvcmlwZ3JlcCcpO1xuXHRcdHJldHVybiBhd2FpdCBuZXcgUHJvbWlzZTxzdHJpbmdbXT4oKHJlc29sdmUpID0+IHtcblxuXHRcdFx0Y29uc3Qgc3cgPSBTdG9wV2F0Y2guY3JlYXRlKCk7XG5cblx0XHRcdGNvbnN0IGNodW5rczogc3RyaW5nW11bXSA9IFtdO1xuXHRcdFx0Y29uc3QgZGVjb2RlciA9IG5ldyBUZXh0RGVjb2RlcigpO1xuXHRcdFx0Y29uc3QgYmFzZVBhdGggPSBGaWxlQWNjZXNzLmFzRmlsZVVyaSgnJykuZnNQYXRoO1xuXHRcdFx0Y29uc3QgcHJvY2VzcyA9IHNwYXduKHJnLnJnUGF0aCwgWyctZycsICcqKi8qLmNzcycsICctLWZpbGVzJywgJy0tbm8taWdub3JlJywgYmFzZVBhdGhdLCB7fSk7XG5cblx0XHRcdHByb2Nlc3Muc3Rkb3V0Lm9uKCdkYXRhJywgZGF0YSA9PiB7XG5cdFx0XHRcdGNvbnN0IGNodW5rID0gZGVjb2Rlci5kZWNvZGUoZGF0YSwgeyBzdHJlYW06IHRydWUgfSk7XG5cdFx0XHRcdGNodW5rcy5wdXNoKGNodW5rLnNwbGl0KCdcXG4nKS5maWx0ZXIoQm9vbGVhbikpO1xuXHRcdFx0fSk7XG5cdFx0XHRwcm9jZXNzLm9uKCdlcnJvcicsIGVyciA9PiB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcignW0NTU19ERVZdIEZBSUxFRCB0byBjb21wdXRlIENTUyBkYXRhJywgZXJyKTtcblx0XHRcdFx0cmVzb2x2ZShbXSk7XG5cdFx0XHR9KTtcblx0XHRcdHByb2Nlc3Mub24oJ2Nsb3NlJywgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBjaHVua3MuZmxhdCgpLm1hcChwYXRoID0+IHJlbGF0aXZlKGJhc2VQYXRoLCBwYXRoKS5yZXBsYWNlKC9cXFxcL2csICcvJykpLmZpbHRlcihCb29sZWFuKS5zb3J0KCk7XG5cdFx0XHRcdHJlc29sdmUocmVzdWx0KTtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYFtDU1NfREVWXSBET05FLCAke3Jlc3VsdC5sZW5ndGh9IGNzcyBtb2R1bGVzICgke01hdGgucm91bmQoc3cuZWxhcHNlZCgpKX1tcylgKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsYUFBYTtBQUN0QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLG1CQUFtQjtBQUVyQixNQUFNLHlCQUF5QixnQkFBd0Msd0JBQXdCO0FBUS9GLElBQU0sd0JBQU4sTUFBOEQ7QUFBQSxFQU1wRSxZQUN1QyxZQUNSLFlBQzdCO0FBRnFDO0FBQ1I7QUFBQSxFQUMzQjtBQUFBLEVBRUosSUFBSSxZQUFxQjtBQUN4QixXQUFPLENBQUMsS0FBSyxXQUFXO0FBQUEsRUFDekI7QUFBQSxFQUVBLGdCQUFtQztBQUNsQyxTQUFLLGdCQUFnQixLQUFLLGtCQUFrQjtBQUM1QyxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxNQUFjLG9CQUF1QztBQUNwRCxRQUFJLENBQUMsS0FBSyxXQUFXO0FBQ3BCLGFBQU8sQ0FBQztBQUFBLElBQ1Q7QUFFQSxVQUFNLEtBQUssTUFBTSxPQUFPLGlCQUFpQjtBQUN6QyxXQUFPLE1BQU0sSUFBSSxRQUFrQixDQUFDLFlBQVk7QUFFL0MsWUFBTSxLQUFLLFVBQVUsT0FBTztBQUU1QixZQUFNLFNBQXFCLENBQUM7QUFDNUIsWUFBTSxVQUFVLElBQUksWUFBWTtBQUNoQyxZQUFNLFdBQVcsV0FBVyxVQUFVLEVBQUUsRUFBRTtBQUMxQyxZQUFNLFVBQVUsTUFBTSxHQUFHLFFBQVEsQ0FBQyxNQUFNLFlBQVksV0FBVyxlQUFlLFFBQVEsR0FBRyxDQUFDLENBQUM7QUFFM0YsY0FBUSxPQUFPLEdBQUcsUUFBUSxVQUFRO0FBQ2pDLGNBQU0sUUFBUSxRQUFRLE9BQU8sTUFBTSxFQUFFLFFBQVEsS0FBSyxDQUFDO0FBQ25ELGVBQU8sS0FBSyxNQUFNLE1BQU0sSUFBSSxFQUFFLE9BQU8sT0FBTyxDQUFDO0FBQUEsTUFDOUMsQ0FBQztBQUNELGNBQVEsR0FBRyxTQUFTLFNBQU87QUFDMUIsYUFBSyxXQUFXLE1BQU0sd0NBQXdDLEdBQUc7QUFDakUsZ0JBQVEsQ0FBQyxDQUFDO0FBQUEsTUFDWCxDQUFDO0FBQ0QsY0FBUSxHQUFHLFNBQVMsTUFBTTtBQUN6QixjQUFNLFNBQVMsT0FBTyxLQUFLLEVBQUUsSUFBSSxVQUFRLFNBQVMsVUFBVSxJQUFJLEVBQUUsUUFBUSxPQUFPLEdBQUcsQ0FBQyxFQUFFLE9BQU8sT0FBTyxFQUFFLEtBQUs7QUFDNUcsZ0JBQVEsTUFBTTtBQUNkLGFBQUssV0FBVyxLQUFLLG1CQUFtQixPQUFPLE1BQU0saUJBQWlCLEtBQUssTUFBTSxHQUFHLFFBQVEsQ0FBQyxDQUFDLEtBQUs7QUFBQSxNQUNwRyxDQUFDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDRjtBQUNEO0FBbERhLHdCQUFOO0FBQUEsRUFPSjtBQUFBLEVBQ0E7QUFBQSxHQVJVOyIsCiAgIm5hbWVzIjogW10KfQo=
