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
import { joinPath } from "../../../../base/common/resources.js";
import { localize } from "../../../../nls.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { AbstractLogger, ILoggerService } from "../../../../platform/log/common/log.js";
import { windowLogGroup } from "../../../services/log/common/logConstants.js";
import { editSessionsLogId } from "./editSessions.js";
let EditSessionsLogService = class extends AbstractLogger {
  constructor(loggerService, environmentService) {
    super();
    this.logger = this._register(loggerService.createLogger(joinPath(environmentService.logsHome, `${editSessionsLogId}.log`), { id: editSessionsLogId, name: localize("cloudChangesLog", "Cloud Changes"), group: windowLogGroup }));
  }
  trace(message, ...args) {
    this.logger.trace(message, ...args);
  }
  debug(message, ...args) {
    this.logger.debug(message, ...args);
  }
  info(message, ...args) {
    this.logger.info(message, ...args);
  }
  warn(message, ...args) {
    this.logger.warn(message, ...args);
  }
  error(message, ...args) {
    this.logger.error(message, ...args);
  }
  flush() {
    this.logger.flush();
  }
};
EditSessionsLogService = __decorateClass([
  __decorateParam(0, ILoggerService),
  __decorateParam(1, IEnvironmentService)
], EditSessionsLogService);
export {
  EditSessionsLogService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9lZGl0U2Vzc2lvbnMvY29tbW9uL2VkaXRTZXNzaW9uc0xvZ1NlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBqb2luUGF0aCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IEFic3RyYWN0TG9nZ2VyLCBJTG9nZ2VyLCBJTG9nZ2VyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IHdpbmRvd0xvZ0dyb3VwIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbG9nL2NvbW1vbi9sb2dDb25zdGFudHMuanMnO1xuaW1wb3J0IHsgSUVkaXRTZXNzaW9uc0xvZ1NlcnZpY2UsIGVkaXRTZXNzaW9uc0xvZ0lkIH0gZnJvbSAnLi9lZGl0U2Vzc2lvbnMuanMnO1xuXG5leHBvcnQgY2xhc3MgRWRpdFNlc3Npb25zTG9nU2VydmljZSBleHRlbmRzIEFic3RyYWN0TG9nZ2VyIGltcGxlbWVudHMgSUVkaXRTZXNzaW9uc0xvZ1NlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IGxvZ2dlcjogSUxvZ2dlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUxvZ2dlclNlcnZpY2UgbG9nZ2VyU2VydmljZTogSUxvZ2dlclNlcnZpY2UsXG5cdFx0QElFbnZpcm9ubWVudFNlcnZpY2UgZW52aXJvbm1lbnRTZXJ2aWNlOiBJRW52aXJvbm1lbnRTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5sb2dnZXIgPSB0aGlzLl9yZWdpc3Rlcihsb2dnZXJTZXJ2aWNlLmNyZWF0ZUxvZ2dlcihqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UubG9nc0hvbWUsIGAke2VkaXRTZXNzaW9uc0xvZ0lkfS5sb2dgKSwgeyBpZDogZWRpdFNlc3Npb25zTG9nSWQsIG5hbWU6IGxvY2FsaXplKCdjbG91ZENoYW5nZXNMb2cnLCBcIkNsb3VkIENoYW5nZXNcIiksIGdyb3VwOiB3aW5kb3dMb2dHcm91cCB9KSk7XG5cdH1cblxuXHR0cmFjZShtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0dGhpcy5sb2dnZXIudHJhY2UobWVzc2FnZSwgLi4uYXJncyk7XG5cdH1cblxuXHRkZWJ1ZyhtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0dGhpcy5sb2dnZXIuZGVidWcobWVzc2FnZSwgLi4uYXJncyk7XG5cdH1cblxuXHRpbmZvKG1lc3NhZ2U6IHN0cmluZywgLi4uYXJnczogYW55W10pOiB2b2lkIHtcblx0XHR0aGlzLmxvZ2dlci5pbmZvKG1lc3NhZ2UsIC4uLmFyZ3MpO1xuXHR9XG5cblx0d2FybihtZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0dGhpcy5sb2dnZXIud2FybihtZXNzYWdlLCAuLi5hcmdzKTtcblx0fVxuXG5cdGVycm9yKG1lc3NhZ2U6IHN0cmluZyB8IEVycm9yLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdHRoaXMubG9nZ2VyLmVycm9yKG1lc3NhZ2UsIC4uLmFyZ3MpO1xuXHR9XG5cblx0Zmx1c2goKTogdm9pZCB7XG5cdFx0dGhpcy5sb2dnZXIuZmx1c2goKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGdCQUF5QixzQkFBc0I7QUFDeEQsU0FBUyxzQkFBc0I7QUFDL0IsU0FBa0MseUJBQXlCO0FBRXBELElBQU0seUJBQU4sY0FBcUMsZUFBa0Q7QUFBQSxFQUs3RixZQUNpQixlQUNLLG9CQUNwQjtBQUNELFVBQU07QUFDTixTQUFLLFNBQVMsS0FBSyxVQUFVLGNBQWMsYUFBYSxTQUFTLG1CQUFtQixVQUFVLEdBQUcsaUJBQWlCLE1BQU0sR0FBRyxFQUFFLElBQUksbUJBQW1CLE1BQU0sU0FBUyxtQkFBbUIsZUFBZSxHQUFHLE9BQU8sZUFBZSxDQUFDLENBQUM7QUFBQSxFQUNqTztBQUFBLEVBRUEsTUFBTSxZQUFvQixNQUFtQjtBQUM1QyxTQUFLLE9BQU8sTUFBTSxTQUFTLEdBQUcsSUFBSTtBQUFBLEVBQ25DO0FBQUEsRUFFQSxNQUFNLFlBQW9CLE1BQW1CO0FBQzVDLFNBQUssT0FBTyxNQUFNLFNBQVMsR0FBRyxJQUFJO0FBQUEsRUFDbkM7QUFBQSxFQUVBLEtBQUssWUFBb0IsTUFBbUI7QUFDM0MsU0FBSyxPQUFPLEtBQUssU0FBUyxHQUFHLElBQUk7QUFBQSxFQUNsQztBQUFBLEVBRUEsS0FBSyxZQUFvQixNQUFtQjtBQUMzQyxTQUFLLE9BQU8sS0FBSyxTQUFTLEdBQUcsSUFBSTtBQUFBLEVBQ2xDO0FBQUEsRUFFQSxNQUFNLFlBQTRCLE1BQW1CO0FBQ3BELFNBQUssT0FBTyxNQUFNLFNBQVMsR0FBRyxJQUFJO0FBQUEsRUFDbkM7QUFBQSxFQUVBLFFBQWM7QUFDYixTQUFLLE9BQU8sTUFBTTtBQUFBLEVBQ25CO0FBQ0Q7QUFwQ2EseUJBQU47QUFBQSxFQU1KO0FBQUEsRUFDQTtBQUFBLEdBUFU7IiwKICAibmFtZXMiOiBbXQp9Cg==
