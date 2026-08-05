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
import * as nls from "../../../../../nls.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { ILoggerService } from "../../../../../platform/log/common/log.js";
import { windowLogGroup } from "../../../../services/log/common/logConstants.js";
const logChannelId = "notebook.rendering";
let NotebookLoggingService = class extends Disposable {
  constructor(loggerService) {
    super();
    this._logger = this._register(loggerService.createLogger(logChannelId, { name: nls.localize("renderChannelName", "Notebook"), group: windowLogGroup }));
  }
  debug(category, output) {
    this._logger.debug(`[${category}] ${output}`);
  }
  info(category, output) {
    this._logger.info(`[${category}] ${output}`);
  }
  warn(category, output) {
    this._logger.warn(`[${category}] ${output}`);
  }
  error(category, output) {
    this._logger.error(`[${category}] ${output}`);
  }
};
NotebookLoggingService.ID = "notebook";
NotebookLoggingService = __decorateClass([
  __decorateParam(0, ILoggerService)
], NotebookLoggingService);
export {
  NotebookLoggingService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3NlcnZpY2VzL25vdGVib29rTG9nZ2luZ1NlcnZpY2VJbXBsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0xvZ2dpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rTG9nZ2luZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxvZ2dlciwgSUxvZ2dlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyB3aW5kb3dMb2dHcm91cCB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2xvZy9jb21tb24vbG9nQ29uc3RhbnRzLmpzJztcblxuY29uc3QgbG9nQ2hhbm5lbElkID0gJ25vdGVib29rLnJlbmRlcmluZyc7XG5cbmV4cG9ydCBjbGFzcyBOb3RlYm9va0xvZ2dpbmdTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElOb3RlYm9va0xvZ2dpbmdTZXJ2aWNlIHtcblx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHN0YXRpYyBJRDogc3RyaW5nID0gJ25vdGVib29rJztcblx0cHJpdmF0ZSByZWFkb25seSBfbG9nZ2VyOiBJTG9nZ2VyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTG9nZ2VyU2VydmljZSBsb2dnZXJTZXJ2aWNlOiBJTG9nZ2VyU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9sb2dnZXIgPSB0aGlzLl9yZWdpc3Rlcihsb2dnZXJTZXJ2aWNlLmNyZWF0ZUxvZ2dlcihsb2dDaGFubmVsSWQsIHsgbmFtZTogbmxzLmxvY2FsaXplKCdyZW5kZXJDaGFubmVsTmFtZScsIFwiTm90ZWJvb2tcIiksIGdyb3VwOiB3aW5kb3dMb2dHcm91cCB9KSk7XG5cdH1cblxuXHRkZWJ1ZyhjYXRlZ29yeTogc3RyaW5nLCBvdXRwdXQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX2xvZ2dlci5kZWJ1ZyhgWyR7Y2F0ZWdvcnl9XSAke291dHB1dH1gKTtcblx0fVxuXG5cdGluZm8oY2F0ZWdvcnk6IHN0cmluZywgb3V0cHV0OiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9sb2dnZXIuaW5mbyhgWyR7Y2F0ZWdvcnl9XSAke291dHB1dH1gKTtcblx0fVxuXG5cdHdhcm4oY2F0ZWdvcnk6IHN0cmluZywgb3V0cHV0OiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9sb2dnZXIud2FybihgWyR7Y2F0ZWdvcnl9XSAke291dHB1dH1gKTtcblx0fVxuXG5cdGVycm9yKGNhdGVnb3J5OiBzdHJpbmcsIG91dHB1dDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fbG9nZ2VyLmVycm9yKGBbJHtjYXRlZ29yeX1dICR7b3V0cHV0fWApO1xuXHR9XG59XG5cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsa0JBQWtCO0FBRTNCLFNBQWtCLHNCQUFzQjtBQUN4QyxTQUFTLHNCQUFzQjtBQUUvQixNQUFNLGVBQWU7QUFFZCxJQUFNLHlCQUFOLGNBQXFDLFdBQThDO0FBQUEsRUFNekYsWUFDaUIsZUFDZjtBQUNELFVBQU07QUFDTixTQUFLLFVBQVUsS0FBSyxVQUFVLGNBQWMsYUFBYSxjQUFjLEVBQUUsTUFBTSxJQUFJLFNBQVMscUJBQXFCLFVBQVUsR0FBRyxPQUFPLGVBQWUsQ0FBQyxDQUFDO0FBQUEsRUFDdko7QUFBQSxFQUVBLE1BQU0sVUFBa0IsUUFBc0I7QUFDN0MsU0FBSyxRQUFRLE1BQU0sSUFBSSxRQUFRLEtBQUssTUFBTSxFQUFFO0FBQUEsRUFDN0M7QUFBQSxFQUVBLEtBQUssVUFBa0IsUUFBc0I7QUFDNUMsU0FBSyxRQUFRLEtBQUssSUFBSSxRQUFRLEtBQUssTUFBTSxFQUFFO0FBQUEsRUFDNUM7QUFBQSxFQUVBLEtBQUssVUFBa0IsUUFBc0I7QUFDNUMsU0FBSyxRQUFRLEtBQUssSUFBSSxRQUFRLEtBQUssTUFBTSxFQUFFO0FBQUEsRUFDNUM7QUFBQSxFQUVBLE1BQU0sVUFBa0IsUUFBc0I7QUFDN0MsU0FBSyxRQUFRLE1BQU0sSUFBSSxRQUFRLEtBQUssTUFBTSxFQUFFO0FBQUEsRUFDN0M7QUFDRDtBQTVCYSx1QkFHTCxLQUFhO0FBSFIseUJBQU47QUFBQSxFQU9KO0FBQUEsR0FQVTsiLAogICJuYW1lcyI6IFtdCn0K
