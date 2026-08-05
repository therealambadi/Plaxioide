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
import { timeout } from "../../../../base/common/async.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { joinPath } from "../../../../base/common/resources.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IProfileAnalysisWorkerService, ProfilingOutput } from "../../../../platform/profiling/electron-sandbox/profileAnalysisWorkerService.js";
import { INativeWorkbenchEnvironmentService } from "../../../services/environment/electron-sandbox/environmentService.js";
import { parseExtensionDevOptions } from "../../../services/extensions/common/extensionDevOptions.js";
import { ITimerService } from "../../../services/timer/browser/timerService.js";
let RendererProfiling = class {
  constructor(_environmentService, _fileService, _logService, nativeHostService, timerService, configService, profileAnalysisService) {
    this._environmentService = _environmentService;
    this._fileService = _fileService;
    this._logService = _logService;
    const devOpts = parseExtensionDevOptions(_environmentService);
    if (devOpts.isExtensionDevTestFromCli) {
      return;
    }
    timerService.perfBaseline.then((perfBaseline) => {
      (_environmentService.isBuilt ? _logService.info : _logService.trace).apply(_logService, [`[perf] Render performance baseline is ${perfBaseline}ms`]);
      if (perfBaseline < 0) {
        return;
      }
      const slowThreshold = perfBaseline * 10;
      const obs = new PerformanceObserver(async (list) => {
        obs.takeRecords();
        const maxDuration = list.getEntries().map((e) => e.duration).reduce((p, c) => Math.max(p, c), 0);
        if (maxDuration < slowThreshold) {
          return;
        }
        if (!configService.getValue("application.experimental.rendererProfiling")) {
          _logService.debug(`[perf] SLOW task detected (${maxDuration}ms) but renderer profiling is disabled via 'application.experimental.rendererProfiling'`);
          return;
        }
        const sessionId = generateUuid();
        _logService.warn(`[perf] Renderer reported VERY LONG TASK (${maxDuration}ms), starting profiling session '${sessionId}'`);
        obs.disconnect();
        for (let i = 0; i < 3; i++) {
          try {
            const profile = await nativeHostService.profileRenderer(sessionId, 5e3);
            const output = await profileAnalysisService.analyseBottomUp(profile, (_url) => "<<renderer>>", perfBaseline, true);
            if (output === ProfilingOutput.Interesting) {
              this._store(profile, sessionId);
              break;
            }
            timeout(15e3);
          } catch (err) {
            _logService.error(err);
            break;
          }
        }
        obs.observe({ entryTypes: ["longtask"] });
      });
      obs.observe({ entryTypes: ["longtask"] });
      this._observer = obs;
    });
  }
  dispose() {
    this._observer?.disconnect();
  }
  async _store(profile, sessionId) {
    const path = joinPath(this._environmentService.tmpDir, `renderer-${Math.random().toString(16).slice(2, 8)}.cpuprofile.json`);
    await this._fileService.writeFile(path, VSBuffer.fromString(JSON.stringify(profile)));
    this._logService.info(`[perf] stored profile to DISK '${path}'`, sessionId);
  }
};
RendererProfiling = __decorateClass([
  __decorateParam(0, INativeWorkbenchEnvironmentService),
  __decorateParam(1, IFileService),
  __decorateParam(2, ILogService),
  __decorateParam(3, INativeHostService),
  __decorateParam(4, ITimerService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IProfileAnalysisWorkerService)
], RendererProfiling);
export {
  RendererProfiling
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wZXJmb3JtYW5jZS9lbGVjdHJvbi1zYW5kYm94L3JlbmRlcmVyQXV0b1Byb2ZpbGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IGpvaW5QYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJTmF0aXZlSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9uYXRpdmUvY29tbW9uL25hdGl2ZS5qcyc7XG5pbXBvcnQgeyBJVjhQcm9maWxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZmlsaW5nL2NvbW1vbi9wcm9maWxpbmcuanMnO1xuaW1wb3J0IHsgSVByb2ZpbGVBbmFseXNpc1dvcmtlclNlcnZpY2UsIFByb2ZpbGluZ091dHB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2ZpbGluZy9lbGVjdHJvbi1zYW5kYm94L3Byb2ZpbGVBbmFseXNpc1dvcmtlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU5hdGl2ZVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2VsZWN0cm9uLXNhbmRib3gvZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHBhcnNlRXh0ZW5zaW9uRGV2T3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbkRldk9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSVRpbWVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3RpbWVyL2Jyb3dzZXIvdGltZXJTZXJ2aWNlLmpzJztcblxuZXhwb3J0IGNsYXNzIFJlbmRlcmVyUHJvZmlsaW5nIHtcblxuXHRwcml2YXRlIF9vYnNlcnZlcj86IFBlcmZvcm1hbmNlT2JzZXJ2ZXI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElOYXRpdmVXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZW52aXJvbm1lbnRTZXJ2aWNlOiBJTmF0aXZlV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElOYXRpdmVIb3N0U2VydmljZSBuYXRpdmVIb3N0U2VydmljZTogSU5hdGl2ZUhvc3RTZXJ2aWNlLFxuXHRcdEBJVGltZXJTZXJ2aWNlIHRpbWVyU2VydmljZTogSVRpbWVyU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ1NlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVByb2ZpbGVBbmFseXNpc1dvcmtlclNlcnZpY2UgcHJvZmlsZUFuYWx5c2lzU2VydmljZTogSVByb2ZpbGVBbmFseXNpc1dvcmtlclNlcnZpY2Vcblx0KSB7XG5cblx0XHRjb25zdCBkZXZPcHRzID0gcGFyc2VFeHRlbnNpb25EZXZPcHRpb25zKF9lbnZpcm9ubWVudFNlcnZpY2UpO1xuXHRcdGlmIChkZXZPcHRzLmlzRXh0ZW5zaW9uRGV2VGVzdEZyb21DbGkpIHtcblx0XHRcdC8vIGRpc2FibGVkIHdoZW4gcnVubmluZyBleHRlbnNpb24gdGVzdHNcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aW1lclNlcnZpY2UucGVyZkJhc2VsaW5lLnRoZW4ocGVyZkJhc2VsaW5lID0+IHtcblx0XHRcdChfZW52aXJvbm1lbnRTZXJ2aWNlLmlzQnVpbHQgPyBfbG9nU2VydmljZS5pbmZvIDogX2xvZ1NlcnZpY2UudHJhY2UpLmFwcGx5KF9sb2dTZXJ2aWNlLCBbYFtwZXJmXSBSZW5kZXIgcGVyZm9ybWFuY2UgYmFzZWxpbmUgaXMgJHtwZXJmQmFzZWxpbmV9bXNgXSk7XG5cblx0XHRcdGlmIChwZXJmQmFzZWxpbmUgPCAwKSB7XG5cdFx0XHRcdC8vIHRvbyBzbG93XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU0xPVyB0aHJlc2hvbGRcblx0XHRcdGNvbnN0IHNsb3dUaHJlc2hvbGQgPSBwZXJmQmFzZWxpbmUgKiAxMDsgLy8gfjEwIGZyYW1lcyBhdCA2NGZwcyBvbiBNWSBtYWNoaW5lXG5cblx0XHRcdGNvbnN0IG9icyA9IG5ldyBQZXJmb3JtYW5jZU9ic2VydmVyKGFzeW5jIGxpc3QgPT4ge1xuXG5cdFx0XHRcdG9icy50YWtlUmVjb3JkcygpO1xuXHRcdFx0XHRjb25zdCBtYXhEdXJhdGlvbiA9IGxpc3QuZ2V0RW50cmllcygpXG5cdFx0XHRcdFx0Lm1hcChlID0+IGUuZHVyYXRpb24pXG5cdFx0XHRcdFx0LnJlZHVjZSgocCwgYykgPT4gTWF0aC5tYXgocCwgYyksIDApO1xuXG5cdFx0XHRcdGlmIChtYXhEdXJhdGlvbiA8IHNsb3dUaHJlc2hvbGQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIWNvbmZpZ1NlcnZpY2UuZ2V0VmFsdWUoJ2FwcGxpY2F0aW9uLmV4cGVyaW1lbnRhbC5yZW5kZXJlclByb2ZpbGluZycpKSB7XG5cdFx0XHRcdFx0X2xvZ1NlcnZpY2UuZGVidWcoYFtwZXJmXSBTTE9XIHRhc2sgZGV0ZWN0ZWQgKCR7bWF4RHVyYXRpb259bXMpIGJ1dCByZW5kZXJlciBwcm9maWxpbmcgaXMgZGlzYWJsZWQgdmlhICdhcHBsaWNhdGlvbi5leHBlcmltZW50YWwucmVuZGVyZXJQcm9maWxpbmcnYCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgc2Vzc2lvbklkID0gZ2VuZXJhdGVVdWlkKCk7XG5cblx0XHRcdFx0X2xvZ1NlcnZpY2Uud2FybihgW3BlcmZdIFJlbmRlcmVyIHJlcG9ydGVkIFZFUlkgTE9ORyBUQVNLICgke21heER1cmF0aW9ufW1zKSwgc3RhcnRpbmcgcHJvZmlsaW5nIHNlc3Npb24gJyR7c2Vzc2lvbklkfSdgKTtcblxuXHRcdFx0XHQvLyBwYXVzZSBvYnNlcnZhdGlvbiwgd2UnbGwgdGFrZSBhIGRldGFpbGVkIGxvb2tcblx0XHRcdFx0b2JzLmRpc2Nvbm5lY3QoKTtcblxuXHRcdFx0XHQvLyBwcm9maWxlIHJlbmRlcmVyIGZvciA1c2VjcywgYW5hbHlzZSwgYW5kIHRha2UgYWN0aW9uIGRlcGVuZGluZyBvbiB0aGUgcmVzdWx0XG5cdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgMzsgaSsrKSB7XG5cblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0Y29uc3QgcHJvZmlsZSA9IGF3YWl0IG5hdGl2ZUhvc3RTZXJ2aWNlLnByb2ZpbGVSZW5kZXJlcihzZXNzaW9uSWQsIDUwMDApO1xuXHRcdFx0XHRcdFx0Y29uc3Qgb3V0cHV0ID0gYXdhaXQgcHJvZmlsZUFuYWx5c2lzU2VydmljZS5hbmFseXNlQm90dG9tVXAocHJvZmlsZSwgX3VybCA9PiAnPDxyZW5kZXJlcj4+JywgcGVyZkJhc2VsaW5lLCB0cnVlKTtcblx0XHRcdFx0XHRcdGlmIChvdXRwdXQgPT09IFByb2ZpbGluZ091dHB1dC5JbnRlcmVzdGluZykge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9zdG9yZShwcm9maWxlLCBzZXNzaW9uSWQpO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0dGltZW91dCgxNTAwMCk7IC8vIHdhaXQgMTVzXG5cblx0XHRcdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0XHRcdF9sb2dTZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyByZWNvbm5lY3QgdGhlIG9ic2VydmVyXG5cdFx0XHRcdG9icy5vYnNlcnZlKHsgZW50cnlUeXBlczogWydsb25ndGFzayddIH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdG9icy5vYnNlcnZlKHsgZW50cnlUeXBlczogWydsb25ndGFzayddIH0pO1xuXHRcdFx0dGhpcy5fb2JzZXJ2ZXIgPSBvYnM7XG5cblx0XHR9KTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fb2JzZXJ2ZXI/LmRpc2Nvbm5lY3QoKTtcblx0fVxuXG5cblx0cHJpdmF0ZSBhc3luYyBfc3RvcmUocHJvZmlsZTogSVY4UHJvZmlsZSwgc2Vzc2lvbklkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBwYXRoID0gam9pblBhdGgodGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLnRtcERpciwgYHJlbmRlcmVyLSR7TWF0aC5yYW5kb20oKS50b1N0cmluZygxNikuc2xpY2UoMiwgOCl9LmNwdXByb2ZpbGUuanNvbmApO1xuXHRcdGF3YWl0IHRoaXMuX2ZpbGVTZXJ2aWNlLndyaXRlRmlsZShwYXRoLCBWU0J1ZmZlci5mcm9tU3RyaW5nKEpTT04uc3RyaW5naWZ5KHByb2ZpbGUpKSk7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGBbcGVyZl0gc3RvcmVkIHByb2ZpbGUgdG8gRElTSyAnJHtwYXRofSdgLCBzZXNzaW9uSWQpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZUFBZTtBQUN4QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDBCQUEwQjtBQUVuQyxTQUFTLCtCQUErQix1QkFBdUI7QUFDL0QsU0FBUywwQ0FBMEM7QUFDbkQsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxxQkFBcUI7QUFFdkIsSUFBTSxvQkFBTixNQUF3QjtBQUFBLEVBSTlCLFlBQ3NELHFCQUN0QixjQUNELGFBQ1YsbUJBQ0wsY0FDUSxlQUNRLHdCQUM5QjtBQVBvRDtBQUN0QjtBQUNEO0FBTzlCLFVBQU0sVUFBVSx5QkFBeUIsbUJBQW1CO0FBQzVELFFBQUksUUFBUSwyQkFBMkI7QUFFdEM7QUFBQSxJQUNEO0FBRUEsaUJBQWEsYUFBYSxLQUFLLGtCQUFnQjtBQUM5QyxPQUFDLG9CQUFvQixVQUFVLFlBQVksT0FBTyxZQUFZLE9BQU8sTUFBTSxhQUFhLENBQUMseUNBQXlDLFlBQVksSUFBSSxDQUFDO0FBRW5KLFVBQUksZUFBZSxHQUFHO0FBRXJCO0FBQUEsTUFDRDtBQUdBLFlBQU0sZ0JBQWdCLGVBQWU7QUFFckMsWUFBTSxNQUFNLElBQUksb0JBQW9CLE9BQU0sU0FBUTtBQUVqRCxZQUFJLFlBQVk7QUFDaEIsY0FBTSxjQUFjLEtBQUssV0FBVyxFQUNsQyxJQUFJLE9BQUssRUFBRSxRQUFRLEVBQ25CLE9BQU8sQ0FBQyxHQUFHLE1BQU0sS0FBSyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUM7QUFFcEMsWUFBSSxjQUFjLGVBQWU7QUFDaEM7QUFBQSxRQUNEO0FBRUEsWUFBSSxDQUFDLGNBQWMsU0FBUyw0Q0FBNEMsR0FBRztBQUMxRSxzQkFBWSxNQUFNLDhCQUE4QixXQUFXLHlGQUF5RjtBQUNwSjtBQUFBLFFBQ0Q7QUFFQSxjQUFNLFlBQVksYUFBYTtBQUUvQixvQkFBWSxLQUFLLDRDQUE0QyxXQUFXLG9DQUFvQyxTQUFTLEdBQUc7QUFHeEgsWUFBSSxXQUFXO0FBR2YsaUJBQVMsSUFBSSxHQUFHLElBQUksR0FBRyxLQUFLO0FBRTNCLGNBQUk7QUFDSCxrQkFBTSxVQUFVLE1BQU0sa0JBQWtCLGdCQUFnQixXQUFXLEdBQUk7QUFDdkUsa0JBQU0sU0FBUyxNQUFNLHVCQUF1QixnQkFBZ0IsU0FBUyxVQUFRLGdCQUFnQixjQUFjLElBQUk7QUFDL0csZ0JBQUksV0FBVyxnQkFBZ0IsYUFBYTtBQUMzQyxtQkFBSyxPQUFPLFNBQVMsU0FBUztBQUM5QjtBQUFBLFlBQ0Q7QUFFQSxvQkFBUSxJQUFLO0FBQUEsVUFFZCxTQUFTLEtBQUs7QUFDYix3QkFBWSxNQUFNLEdBQUc7QUFDckI7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUdBLFlBQUksUUFBUSxFQUFFLFlBQVksQ0FBQyxVQUFVLEVBQUUsQ0FBQztBQUFBLE1BQ3pDLENBQUM7QUFFRCxVQUFJLFFBQVEsRUFBRSxZQUFZLENBQUMsVUFBVSxFQUFFLENBQUM7QUFDeEMsV0FBSyxZQUFZO0FBQUEsSUFFbEIsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLFVBQWdCO0FBQ2YsU0FBSyxXQUFXLFdBQVc7QUFBQSxFQUM1QjtBQUFBLEVBR0EsTUFBYyxPQUFPLFNBQXFCLFdBQWtDO0FBQzNFLFVBQU0sT0FBTyxTQUFTLEtBQUssb0JBQW9CLFFBQVEsWUFBWSxLQUFLLE9BQU8sRUFBRSxTQUFTLEVBQUUsRUFBRSxNQUFNLEdBQUcsQ0FBQyxDQUFDLGtCQUFrQjtBQUMzSCxVQUFNLEtBQUssYUFBYSxVQUFVLE1BQU0sU0FBUyxXQUFXLEtBQUssVUFBVSxPQUFPLENBQUMsQ0FBQztBQUNwRixTQUFLLFlBQVksS0FBSyxrQ0FBa0MsSUFBSSxLQUFLLFNBQVM7QUFBQSxFQUMzRTtBQUNEO0FBN0ZhLG9CQUFOO0FBQUEsRUFLSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBWFU7IiwKICAibmFtZXMiOiBbXQp9Cg==
