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
import { localize } from "../../../nls.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { ILoggerService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { TelemetryLogGroup, isLoggingOnly, telemetryLogId, validateTelemetryData } from "./telemetryUtils.js";
let TelemetryLogAppender = class extends Disposable {
  constructor(prefix, remote, loggerService, environmentService, productService) {
    super();
    this.prefix = prefix;
    const id = remote ? "remoteTelemetry" : telemetryLogId;
    const logger = loggerService.getLogger(id);
    if (logger) {
      this.logger = this._register(logger);
    } else {
      const justLoggingAndNotSending = isLoggingOnly(productService, environmentService);
      const logSuffix = justLoggingAndNotSending ? " (Not Sent)" : "";
      this.logger = this._register(loggerService.createLogger(
        id,
        {
          name: localize("telemetryLog", "Telemetry{0}", logSuffix),
          group: TelemetryLogGroup,
          hidden: true
        }
      ));
    }
  }
  flush() {
    return Promise.resolve();
  }
  log(eventName, data) {
    this.logger.trace(`${this.prefix}telemetry/${eventName}`, validateTelemetryData(data));
  }
};
TelemetryLogAppender = __decorateClass([
  __decorateParam(2, ILoggerService),
  __decorateParam(3, IEnvironmentService),
  __decorateParam(4, IProductService)
], TelemetryLogAppender);
export {
  TelemetryLogAppender
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeUxvZ0FwcGVuZGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IElMb2dnZXIsIElMb2dnZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeUFwcGVuZGVyLCBUZWxlbWV0cnlMb2dHcm91cCwgaXNMb2dnaW5nT25seSwgdGVsZW1ldHJ5TG9nSWQsIHZhbGlkYXRlVGVsZW1ldHJ5RGF0YSB9IGZyb20gJy4vdGVsZW1ldHJ5VXRpbHMuanMnO1xuXG5leHBvcnQgY2xhc3MgVGVsZW1ldHJ5TG9nQXBwZW5kZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVRlbGVtZXRyeUFwcGVuZGVyIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGxvZ2dlcjogSUxvZ2dlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHByZWZpeDogc3RyaW5nLFxuXHRcdHJlbW90ZTogYm9vbGVhbixcblx0XHRASUxvZ2dlclNlcnZpY2UgbG9nZ2VyU2VydmljZTogSUxvZ2dlclNlcnZpY2UsXG5cdFx0QElFbnZpcm9ubWVudFNlcnZpY2UgZW52aXJvbm1lbnRTZXJ2aWNlOiBJRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnN0IGlkID0gcmVtb3RlID8gJ3JlbW90ZVRlbGVtZXRyeScgOiB0ZWxlbWV0cnlMb2dJZDtcblx0XHRjb25zdCBsb2dnZXIgPSBsb2dnZXJTZXJ2aWNlLmdldExvZ2dlcihpZCk7XG5cdFx0aWYgKGxvZ2dlcikge1xuXHRcdFx0dGhpcy5sb2dnZXIgPSB0aGlzLl9yZWdpc3Rlcihsb2dnZXIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBOb3QgYSBwZXJmZWN0IGNoZWNrLCBidXQgYSBuaWNlIHdheSB0byBpbmRpY2F0ZSBpZiB3ZSBvbmx5IGhhdmUgbG9nZ2luZyBlbmFibGVkIGZvciBkZWJ1ZyBwdXJwb3NlcyBhbmQgbm90aGluZyBpcyBhY3R1YWxseSBiZWluZyBzZW50XG5cdFx0XHRjb25zdCBqdXN0TG9nZ2luZ0FuZE5vdFNlbmRpbmcgPSBpc0xvZ2dpbmdPbmx5KHByb2R1Y3RTZXJ2aWNlLCBlbnZpcm9ubWVudFNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgbG9nU3VmZml4ID0ganVzdExvZ2dpbmdBbmROb3RTZW5kaW5nID8gJyAoTm90IFNlbnQpJyA6ICcnO1xuXHRcdFx0dGhpcy5sb2dnZXIgPSB0aGlzLl9yZWdpc3Rlcihsb2dnZXJTZXJ2aWNlLmNyZWF0ZUxvZ2dlcihpZCxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG5hbWU6IGxvY2FsaXplKCd0ZWxlbWV0cnlMb2cnLCBcIlRlbGVtZXRyeXswfVwiLCBsb2dTdWZmaXgpLFxuXHRcdFx0XHRcdGdyb3VwOiBUZWxlbWV0cnlMb2dHcm91cCxcblx0XHRcdFx0XHRoaWRkZW46IHRydWVcblx0XHRcdFx0fSkpO1xuXHRcdH1cblx0fVxuXG5cdGZsdXNoKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0fVxuXG5cdGxvZyhldmVudE5hbWU6IHN0cmluZywgZGF0YTogYW55KTogdm9pZCB7XG5cdFx0dGhpcy5sb2dnZXIudHJhY2UoYCR7dGhpcy5wcmVmaXh9dGVsZW1ldHJ5LyR7ZXZlbnROYW1lfWAsIHZhbGlkYXRlVGVsZW1ldHJ5RGF0YShkYXRhKSk7XG5cdH1cbn1cblxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFrQixzQkFBc0I7QUFDeEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBNkIsbUJBQW1CLGVBQWUsZ0JBQWdCLDZCQUE2QjtBQUVyRyxJQUFNLHVCQUFOLGNBQW1DLFdBQXlDO0FBQUEsRUFJbEYsWUFDa0IsUUFDakIsUUFDZ0IsZUFDSyxvQkFDSixnQkFDaEI7QUFDRCxVQUFNO0FBTlc7QUFRakIsVUFBTSxLQUFLLFNBQVMsb0JBQW9CO0FBQ3hDLFVBQU0sU0FBUyxjQUFjLFVBQVUsRUFBRTtBQUN6QyxRQUFJLFFBQVE7QUFDWCxXQUFLLFNBQVMsS0FBSyxVQUFVLE1BQU07QUFBQSxJQUNwQyxPQUFPO0FBRU4sWUFBTSwyQkFBMkIsY0FBYyxnQkFBZ0Isa0JBQWtCO0FBQ2pGLFlBQU0sWUFBWSwyQkFBMkIsZ0JBQWdCO0FBQzdELFdBQUssU0FBUyxLQUFLLFVBQVUsY0FBYztBQUFBLFFBQWE7QUFBQSxRQUN2RDtBQUFBLFVBQ0MsTUFBTSxTQUFTLGdCQUFnQixnQkFBZ0IsU0FBUztBQUFBLFVBQ3hELE9BQU87QUFBQSxVQUNQLFFBQVE7QUFBQSxRQUNUO0FBQUEsTUFBQyxDQUFDO0FBQUEsSUFDSjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLFFBQXVCO0FBQ3RCLFdBQU8sUUFBUSxRQUFRO0FBQUEsRUFDeEI7QUFBQSxFQUVBLElBQUksV0FBbUIsTUFBaUI7QUFDdkMsU0FBSyxPQUFPLE1BQU0sR0FBRyxLQUFLLE1BQU0sYUFBYSxTQUFTLElBQUksc0JBQXNCLElBQUksQ0FBQztBQUFBLEVBQ3RGO0FBQ0Q7QUFyQ2EsdUJBQU47QUFBQSxFQU9KO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVRVOyIsCiAgIm5hbWVzIjogW10KfQo=
