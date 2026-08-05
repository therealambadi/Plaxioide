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
import { Schemas } from "../../../../base/common/network.js";
import { join } from "../../../../base/common/path.js";
import { basename, dirname } from "../../../../base/common/resources.js";
import { Promises } from "../../../../base/node/pfs.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { ILogService } from "../../../../platform/log/common/log.js";
let LogsDataCleaner = class extends Disposable {
  constructor(environmentService, logService) {
    super();
    this.environmentService = environmentService;
    this.logService = logService;
    const scheduler = this._register(new RunOnceScheduler(
      () => {
        this.cleanUpOldLogs();
      },
      10 * 1e3
      /* after 10s */
    ));
    scheduler.schedule();
  }
  async cleanUpOldLogs() {
    this.logService.trace("[logs cleanup]: Starting to clean up old logs.");
    try {
      const currentLog = basename(this.environmentService.logsHome);
      const logsRoot = dirname(this.environmentService.logsHome.with({ scheme: Schemas.file })).fsPath;
      const logFiles = await Promises.readdir(logsRoot);
      const allSessions = logFiles.filter((logFile) => /^\d{8}T\d{6}$/.test(logFile));
      const oldSessions = allSessions.sort().filter((session) => session !== currentLog);
      const sessionsToDelete = oldSessions.slice(0, Math.max(0, oldSessions.length - 9));
      if (sessionsToDelete.length > 0) {
        this.logService.trace(`[logs cleanup]: Removing log folders '${sessionsToDelete.join(", ")}'`);
        await Promise.all(sessionsToDelete.map((sessionToDelete) => Promises.rm(join(logsRoot, sessionToDelete))));
      }
    } catch (error) {
      onUnexpectedError(error);
    }
  }
};
LogsDataCleaner = __decorateClass([
  __decorateParam(0, IEnvironmentService),
  __decorateParam(1, ILogService)
], LogsDataCleaner);
export {
  LogsDataCleaner
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9jb2RlL2VsZWN0cm9uLXV0aWxpdHkvc2hhcmVkUHJvY2Vzcy9jb250cmliL2xvZ3NEYXRhQ2xlYW5lci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lLCBkaXJuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFByb21pc2VzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9ub2RlL3Bmcy5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuXG5leHBvcnQgY2xhc3MgTG9nc0RhdGFDbGVhbmVyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlbnZpcm9ubWVudFNlcnZpY2U6IElFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnN0IHNjaGVkdWxlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHtcblx0XHRcdHRoaXMuY2xlYW5VcE9sZExvZ3MoKTtcblx0XHR9LCAxMCAqIDEwMDAgLyogYWZ0ZXIgMTBzICovKSk7XG5cdFx0c2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNsZWFuVXBPbGRMb2dzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnW2xvZ3MgY2xlYW51cF06IFN0YXJ0aW5nIHRvIGNsZWFuIHVwIG9sZCBsb2dzLicpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGN1cnJlbnRMb2cgPSBiYXNlbmFtZSh0aGlzLmVudmlyb25tZW50U2VydmljZS5sb2dzSG9tZSk7XG5cdFx0XHRjb25zdCBsb2dzUm9vdCA9IGRpcm5hbWUodGhpcy5lbnZpcm9ubWVudFNlcnZpY2UubG9nc0hvbWUud2l0aCh7IHNjaGVtZTogU2NoZW1hcy5maWxlIH0pKS5mc1BhdGg7XG5cdFx0XHRjb25zdCBsb2dGaWxlcyA9IGF3YWl0IFByb21pc2VzLnJlYWRkaXIobG9nc1Jvb3QpO1xuXG5cdFx0XHRjb25zdCBhbGxTZXNzaW9ucyA9IGxvZ0ZpbGVzLmZpbHRlcihsb2dGaWxlID0+IC9eXFxkezh9VFxcZHs2fSQvLnRlc3QobG9nRmlsZSkpO1xuXHRcdFx0Y29uc3Qgb2xkU2Vzc2lvbnMgPSBhbGxTZXNzaW9ucy5zb3J0KCkuZmlsdGVyKHNlc3Npb24gPT4gc2Vzc2lvbiAhPT0gY3VycmVudExvZyk7XG5cdFx0XHRjb25zdCBzZXNzaW9uc1RvRGVsZXRlID0gb2xkU2Vzc2lvbnMuc2xpY2UoMCwgTWF0aC5tYXgoMCwgb2xkU2Vzc2lvbnMubGVuZ3RoIC0gOSkpO1xuXG5cdFx0XHRpZiAoc2Vzc2lvbnNUb0RlbGV0ZS5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgW2xvZ3MgY2xlYW51cF06IFJlbW92aW5nIGxvZyBmb2xkZXJzICcke3Nlc3Npb25zVG9EZWxldGUuam9pbignLCAnKX0nYCk7XG5cblx0XHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwoc2Vzc2lvbnNUb0RlbGV0ZS5tYXAoc2Vzc2lvblRvRGVsZXRlID0+IFByb21pc2VzLnJtKGpvaW4obG9nc1Jvb3QsIHNlc3Npb25Ub0RlbGV0ZSkpKSk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGVycm9yKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsWUFBWTtBQUNyQixTQUFTLFVBQVUsZUFBZTtBQUNsQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLG1CQUFtQjtBQUVyQixJQUFNLGtCQUFOLGNBQThCLFdBQVc7QUFBQSxFQUUvQyxZQUN1QyxvQkFDUixZQUM3QjtBQUNELFVBQU07QUFIZ0M7QUFDUjtBQUk5QixVQUFNLFlBQVksS0FBSyxVQUFVLElBQUk7QUFBQSxNQUFpQixNQUFNO0FBQzNELGFBQUssZUFBZTtBQUFBLE1BQ3JCO0FBQUEsTUFBRyxLQUFLO0FBQUE7QUFBQSxJQUFvQixDQUFDO0FBQzdCLGNBQVUsU0FBUztBQUFBLEVBQ3BCO0FBQUEsRUFFQSxNQUFjLGlCQUFnQztBQUM3QyxTQUFLLFdBQVcsTUFBTSxnREFBZ0Q7QUFFdEUsUUFBSTtBQUNILFlBQU0sYUFBYSxTQUFTLEtBQUssbUJBQW1CLFFBQVE7QUFDNUQsWUFBTSxXQUFXLFFBQVEsS0FBSyxtQkFBbUIsU0FBUyxLQUFLLEVBQUUsUUFBUSxRQUFRLEtBQUssQ0FBQyxDQUFDLEVBQUU7QUFDMUYsWUFBTSxXQUFXLE1BQU0sU0FBUyxRQUFRLFFBQVE7QUFFaEQsWUFBTSxjQUFjLFNBQVMsT0FBTyxhQUFXLGdCQUFnQixLQUFLLE9BQU8sQ0FBQztBQUM1RSxZQUFNLGNBQWMsWUFBWSxLQUFLLEVBQUUsT0FBTyxhQUFXLFlBQVksVUFBVTtBQUMvRSxZQUFNLG1CQUFtQixZQUFZLE1BQU0sR0FBRyxLQUFLLElBQUksR0FBRyxZQUFZLFNBQVMsQ0FBQyxDQUFDO0FBRWpGLFVBQUksaUJBQWlCLFNBQVMsR0FBRztBQUNoQyxhQUFLLFdBQVcsTUFBTSx5Q0FBeUMsaUJBQWlCLEtBQUssSUFBSSxDQUFDLEdBQUc7QUFFN0YsY0FBTSxRQUFRLElBQUksaUJBQWlCLElBQUkscUJBQW1CLFNBQVMsR0FBRyxLQUFLLFVBQVUsZUFBZSxDQUFDLENBQUMsQ0FBQztBQUFBLE1BQ3hHO0FBQUEsSUFDRCxTQUFTLE9BQU87QUFDZix3QkFBa0IsS0FBSztBQUFBLElBQ3hCO0FBQUEsRUFDRDtBQUNEO0FBbkNhLGtCQUFOO0FBQUEsRUFHSjtBQUFBLEVBQ0E7QUFBQSxHQUpVOyIsCiAgIm5hbWVzIjogW10KfQo=
