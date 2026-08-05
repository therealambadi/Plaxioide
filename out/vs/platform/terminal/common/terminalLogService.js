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
import { Disposable } from "../../../base/common/lifecycle.js";
import { Event } from "../../../base/common/event.js";
import { localize } from "../../../nls.js";
import { ILoggerService, LogLevel } from "../../log/common/log.js";
import { IWorkspaceContextService } from "../../workspace/common/workspace.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { joinPath } from "../../../base/common/resources.js";
let TerminalLogService = class extends Disposable {
  constructor(_loggerService, workspaceContextService, environmentService) {
    super();
    this._loggerService = _loggerService;
    this._logger = this._loggerService.createLogger(joinPath(environmentService.logsHome, "terminal.log"), { id: "terminal", name: localize("terminalLoggerName", "Terminal") });
    this._register(Event.runAndSubscribe(workspaceContextService.onDidChangeWorkspaceFolders, () => {
      this._workspaceId = workspaceContextService.getWorkspace().id.substring(0, 7);
    }));
  }
  get onDidChangeLogLevel() {
    return this._logger.onDidChangeLogLevel;
  }
  getLevel() {
    return this._logger.getLevel();
  }
  setLevel(level) {
    this._logger.setLevel(level);
  }
  flush() {
    this._logger.flush();
  }
  trace(message, ...args) {
    this._logger.trace(this._formatMessage(message), args);
  }
  debug(message, ...args) {
    this._logger.debug(this._formatMessage(message), args);
  }
  info(message, ...args) {
    this._logger.info(this._formatMessage(message), args);
  }
  warn(message, ...args) {
    this._logger.warn(this._formatMessage(message), args);
  }
  error(message, ...args) {
    if (message instanceof Error) {
      this._logger.error(this._formatMessage(""), message, args);
      return;
    }
    this._logger.error(this._formatMessage(message), args);
  }
  _formatMessage(message) {
    if (this._logger.getLevel() === LogLevel.Trace) {
      return `[${this._workspaceId}] ${message}`;
    }
    return message;
  }
};
TerminalLogService = __decorateClass([
  __decorateParam(0, ILoggerService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IEnvironmentService)
], TerminalLogService);
export {
  TerminalLogService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWxMb2dTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElMb2dnZXIsIElMb2dnZXJTZXJ2aWNlLCBMb2dMZXZlbCB9IGZyb20gJy4uLy4uL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbExvZ1NlcnZpY2UgfSBmcm9tICcuL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgam9pblBhdGggfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuXG5leHBvcnQgY2xhc3MgVGVybWluYWxMb2dTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElUZXJtaW5hbExvZ1NlcnZpY2Uge1xuXHRkZWNsYXJlIF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0ZGVjbGFyZSBfbG9nQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9sb2dnZXI6IElMb2dnZXI7XG5cblx0cHJpdmF0ZSBfd29ya3NwYWNlSWQhOiBzdHJpbmc7XG5cblx0Z2V0IG9uRGlkQ2hhbmdlTG9nTGV2ZWwoKTogRXZlbnQ8TG9nTGV2ZWw+IHsgcmV0dXJuIHRoaXMuX2xvZ2dlci5vbkRpZENoYW5nZUxvZ0xldmVsOyB9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElMb2dnZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ2dlclNlcnZpY2U6IElMb2dnZXJTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2Ugd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElFbnZpcm9ubWVudFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fbG9nZ2VyID0gdGhpcy5fbG9nZ2VyU2VydmljZS5jcmVhdGVMb2dnZXIoam9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLmxvZ3NIb21lLCAndGVybWluYWwubG9nJyksIHsgaWQ6ICd0ZXJtaW5hbCcsIG5hbWU6IGxvY2FsaXplKCd0ZXJtaW5hbExvZ2dlck5hbWUnLCAnVGVybWluYWwnKSB9KTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmUod29ya3NwYWNlQ29udGV4dFNlcnZpY2Uub25EaWRDaGFuZ2VXb3Jrc3BhY2VGb2xkZXJzLCAoKSA9PiB7XG5cdFx0XHR0aGlzLl93b3Jrc3BhY2VJZCA9IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmlkLnN1YnN0cmluZygwLCA3KTtcblx0XHR9KSk7XG5cdH1cblxuXHRnZXRMZXZlbCgpOiBMb2dMZXZlbCB7IHJldHVybiB0aGlzLl9sb2dnZXIuZ2V0TGV2ZWwoKTsgfVxuXHRzZXRMZXZlbChsZXZlbDogTG9nTGV2ZWwpOiB2b2lkIHsgdGhpcy5fbG9nZ2VyLnNldExldmVsKGxldmVsKTsgfVxuXHRmbHVzaCgpOiB2b2lkIHsgdGhpcy5fbG9nZ2VyLmZsdXNoKCk7IH1cblxuXHR0cmFjZShtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7IHRoaXMuX2xvZ2dlci50cmFjZSh0aGlzLl9mb3JtYXRNZXNzYWdlKG1lc3NhZ2UpLCBhcmdzKTsgfVxuXHRkZWJ1ZyhtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7IHRoaXMuX2xvZ2dlci5kZWJ1Zyh0aGlzLl9mb3JtYXRNZXNzYWdlKG1lc3NhZ2UpLCBhcmdzKTsgfVxuXHRpbmZvKG1lc3NhZ2U6IHN0cmluZywgLi4uYXJnczogYW55W10pOiB2b2lkIHsgdGhpcy5fbG9nZ2VyLmluZm8odGhpcy5fZm9ybWF0TWVzc2FnZShtZXNzYWdlKSwgYXJncyk7IH1cblx0d2FybihtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7IHRoaXMuX2xvZ2dlci53YXJuKHRoaXMuX2Zvcm1hdE1lc3NhZ2UobWVzc2FnZSksIGFyZ3MpOyB9XG5cdGVycm9yKG1lc3NhZ2U6IHN0cmluZyB8IEVycm9yLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGlmIChtZXNzYWdlIGluc3RhbmNlb2YgRXJyb3IpIHtcblx0XHRcdHRoaXMuX2xvZ2dlci5lcnJvcih0aGlzLl9mb3JtYXRNZXNzYWdlKCcnKSwgbWVzc2FnZSwgYXJncyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2xvZ2dlci5lcnJvcih0aGlzLl9mb3JtYXRNZXNzYWdlKG1lc3NhZ2UpLCBhcmdzKTtcblx0fVxuXG5cdHByaXZhdGUgX2Zvcm1hdE1lc3NhZ2UobWVzc2FnZTogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRpZiAodGhpcy5fbG9nZ2VyLmdldExldmVsKCkgPT09IExvZ0xldmVsLlRyYWNlKSB7XG5cdFx0XHRyZXR1cm4gYFske3RoaXMuX3dvcmtzcGFjZUlkfV0gJHttZXNzYWdlfWA7XG5cdFx0fVxuXHRcdHJldHVybiBtZXNzYWdlO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsYUFBYTtBQUN0QixTQUFTLGdCQUFnQjtBQUN6QixTQUFrQixnQkFBZ0IsZ0JBQWdCO0FBRWxELFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsZ0JBQWdCO0FBRWxCLElBQU0scUJBQU4sY0FBaUMsV0FBMEM7QUFBQSxFQVVqRixZQUNrQyxnQkFDUCx5QkFDTCxvQkFDcEI7QUFDRCxVQUFNO0FBSjJCO0FBS2pDLFNBQUssVUFBVSxLQUFLLGVBQWUsYUFBYSxTQUFTLG1CQUFtQixVQUFVLGNBQWMsR0FBRyxFQUFFLElBQUksWUFBWSxNQUFNLFNBQVMsc0JBQXNCLFVBQVUsRUFBRSxDQUFDO0FBQzNLLFNBQUssVUFBVSxNQUFNLGdCQUFnQix3QkFBd0IsNkJBQTZCLE1BQU07QUFDL0YsV0FBSyxlQUFlLHdCQUF3QixhQUFhLEVBQUUsR0FBRyxVQUFVLEdBQUcsQ0FBQztBQUFBLElBQzdFLENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQVpBLElBQUksc0JBQXVDO0FBQUUsV0FBTyxLQUFLLFFBQVE7QUFBQSxFQUFxQjtBQUFBLEVBY3RGLFdBQXFCO0FBQUUsV0FBTyxLQUFLLFFBQVEsU0FBUztBQUFBLEVBQUc7QUFBQSxFQUN2RCxTQUFTLE9BQXVCO0FBQUUsU0FBSyxRQUFRLFNBQVMsS0FBSztBQUFBLEVBQUc7QUFBQSxFQUNoRSxRQUFjO0FBQUUsU0FBSyxRQUFRLE1BQU07QUFBQSxFQUFHO0FBQUEsRUFFdEMsTUFBTSxZQUFvQixNQUFtQjtBQUFFLFNBQUssUUFBUSxNQUFNLEtBQUssZUFBZSxPQUFPLEdBQUcsSUFBSTtBQUFBLEVBQUc7QUFBQSxFQUN2RyxNQUFNLFlBQW9CLE1BQW1CO0FBQUUsU0FBSyxRQUFRLE1BQU0sS0FBSyxlQUFlLE9BQU8sR0FBRyxJQUFJO0FBQUEsRUFBRztBQUFBLEVBQ3ZHLEtBQUssWUFBb0IsTUFBbUI7QUFBRSxTQUFLLFFBQVEsS0FBSyxLQUFLLGVBQWUsT0FBTyxHQUFHLElBQUk7QUFBQSxFQUFHO0FBQUEsRUFDckcsS0FBSyxZQUFvQixNQUFtQjtBQUFFLFNBQUssUUFBUSxLQUFLLEtBQUssZUFBZSxPQUFPLEdBQUcsSUFBSTtBQUFBLEVBQUc7QUFBQSxFQUNyRyxNQUFNLFlBQTRCLE1BQW1CO0FBQ3BELFFBQUksbUJBQW1CLE9BQU87QUFDN0IsV0FBSyxRQUFRLE1BQU0sS0FBSyxlQUFlLEVBQUUsR0FBRyxTQUFTLElBQUk7QUFDekQ7QUFBQSxJQUNEO0FBQ0EsU0FBSyxRQUFRLE1BQU0sS0FBSyxlQUFlLE9BQU8sR0FBRyxJQUFJO0FBQUEsRUFDdEQ7QUFBQSxFQUVRLGVBQWUsU0FBeUI7QUFDL0MsUUFBSSxLQUFLLFFBQVEsU0FBUyxNQUFNLFNBQVMsT0FBTztBQUMvQyxhQUFPLElBQUksS0FBSyxZQUFZLEtBQUssT0FBTztBQUFBLElBQ3pDO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQTVDYSxxQkFBTjtBQUFBLEVBV0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBYlU7IiwKICAibmFtZXMiOiBbXQp9Cg==
