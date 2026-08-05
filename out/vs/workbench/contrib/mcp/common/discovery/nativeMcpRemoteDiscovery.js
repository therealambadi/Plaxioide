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
import { ProxyChannel } from "../../../../../base/parts/ipc/common/ipc.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { NativeMcpDiscoveryHelperChannelName } from "../../../../../platform/mcp/common/nativeMcpDiscoveryHelper.js";
import { IRemoteAgentService } from "../../../../services/remote/common/remoteAgentService.js";
import { IMcpRegistry } from "../mcpRegistryTypes.js";
import { NativeFilesystemMcpDiscovery } from "./nativeMcpDiscoveryAbstract.js";
let RemoteNativeMpcDiscovery = class extends NativeFilesystemMcpDiscovery {
  constructor(remoteAgent, logService, labelService, fileService, instantiationService, mcpRegistry, configurationService) {
    super(remoteAgent.getConnection()?.remoteAuthority || null, labelService, fileService, instantiationService, mcpRegistry, configurationService);
    this.remoteAgent = remoteAgent;
    this.logService = logService;
  }
  async start() {
    const connection = this.remoteAgent.getConnection();
    if (!connection) {
      return this.setDetails(void 0);
    }
    await connection.withChannel(NativeMcpDiscoveryHelperChannelName, async (channel) => {
      const service = ProxyChannel.toService(channel);
      service.load().then(
        (data) => this.setDetails(data),
        (err) => {
          this.logService.warn("Error getting remote process MCP environment", err);
          this.setDetails(void 0);
        }
      );
    });
  }
};
RemoteNativeMpcDiscovery = __decorateClass([
  __decorateParam(0, IRemoteAgentService),
  __decorateParam(1, ILogService),
  __decorateParam(2, ILabelService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IMcpRegistry),
  __decorateParam(6, IConfigurationService)
], RemoteNativeMpcDiscovery);
export {
  RemoteNativeMpcDiscovery
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tY3AvY29tbW9uL2Rpc2NvdmVyeS9uYXRpdmVNY3BSZW1vdGVEaXNjb3ZlcnkudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBQcm94eUNoYW5uZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3BhcnRzL2lwYy9jb21tb24vaXBjLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElOYXRpdmVNY3BEaXNjb3ZlcnlIZWxwZXJTZXJ2aWNlLCBOYXRpdmVNY3BEaXNjb3ZlcnlIZWxwZXJDaGFubmVsTmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL21jcC9jb21tb24vbmF0aXZlTWNwRGlzY292ZXJ5SGVscGVyLmpzJztcbmltcG9ydCB7IElSZW1vdGVBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTWNwUmVnaXN0cnkgfSBmcm9tICcuLi9tY3BSZWdpc3RyeVR5cGVzLmpzJztcbmltcG9ydCB7IE5hdGl2ZUZpbGVzeXN0ZW1NY3BEaXNjb3ZlcnkgfSBmcm9tICcuL25hdGl2ZU1jcERpc2NvdmVyeUFic3RyYWN0LmpzJztcblxuLyoqXG4gKiBEaXNjb3ZlcnMgTUNQIHNlcnZlcnMgb24gdGhlIHJlbW90ZSBmaWxlc3lzdGVtLCBpZiBhbnkuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZW1vdGVOYXRpdmVNcGNEaXNjb3ZlcnkgZXh0ZW5kcyBOYXRpdmVGaWxlc3lzdGVtTWNwRGlzY292ZXJ5IHtcblx0Y29uc3RydWN0b3IoXG5cdFx0QElSZW1vdGVBZ2VudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSByZW1vdGVBZ2VudDogSVJlbW90ZUFnZW50U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU1jcFJlZ2lzdHJ5IG1jcFJlZ2lzdHJ5OiBJTWNwUmVnaXN0cnksXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihyZW1vdGVBZ2VudC5nZXRDb25uZWN0aW9uKCk/LnJlbW90ZUF1dGhvcml0eSB8fCBudWxsLCBsYWJlbFNlcnZpY2UsIGZpbGVTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgbWNwUmVnaXN0cnksIGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBhc3luYyBzdGFydCgpIHtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gdGhpcy5yZW1vdGVBZ2VudC5nZXRDb25uZWN0aW9uKCk7XG5cdFx0aWYgKCFjb25uZWN0aW9uKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5zZXREZXRhaWxzKHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0YXdhaXQgY29ubmVjdGlvbi53aXRoQ2hhbm5lbChOYXRpdmVNY3BEaXNjb3ZlcnlIZWxwZXJDaGFubmVsTmFtZSwgYXN5bmMgY2hhbm5lbCA9PiB7XG5cdFx0XHRjb25zdCBzZXJ2aWNlID0gUHJveHlDaGFubmVsLnRvU2VydmljZTxJTmF0aXZlTWNwRGlzY292ZXJ5SGVscGVyU2VydmljZT4oY2hhbm5lbCk7XG5cblx0XHRcdHNlcnZpY2UubG9hZCgpLnRoZW4oXG5cdFx0XHRcdGRhdGEgPT4gdGhpcy5zZXREZXRhaWxzKGRhdGEpLFxuXHRcdFx0XHRlcnIgPT4ge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKCdFcnJvciBnZXR0aW5nIHJlbW90ZSBwcm9jZXNzIE1DUCBlbnZpcm9ubWVudCcsIGVycik7XG5cdFx0XHRcdFx0dGhpcy5zZXREZXRhaWxzKHVuZGVmaW5lZCk7XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBMkMsMkNBQTJDO0FBQ3RGLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsb0NBQW9DO0FBS3RDLElBQU0sMkJBQU4sY0FBdUMsNkJBQTZCO0FBQUEsRUFDMUUsWUFDdUMsYUFDUixZQUNmLGNBQ0QsYUFDUyxzQkFDVCxhQUNTLHNCQUN0QjtBQUNELFVBQU0sWUFBWSxjQUFjLEdBQUcsbUJBQW1CLE1BQU0sY0FBYyxhQUFhLHNCQUFzQixhQUFhLG9CQUFvQjtBQVJ4RztBQUNSO0FBQUEsRUFRL0I7QUFBQSxFQUVBLE1BQXNCLFFBQVE7QUFDN0IsVUFBTSxhQUFhLEtBQUssWUFBWSxjQUFjO0FBQ2xELFFBQUksQ0FBQyxZQUFZO0FBQ2hCLGFBQU8sS0FBSyxXQUFXLE1BQVM7QUFBQSxJQUNqQztBQUVBLFVBQU0sV0FBVyxZQUFZLHFDQUFxQyxPQUFNLFlBQVc7QUFDbEYsWUFBTSxVQUFVLGFBQWEsVUFBNEMsT0FBTztBQUVoRixjQUFRLEtBQUssRUFBRTtBQUFBLFFBQ2QsVUFBUSxLQUFLLFdBQVcsSUFBSTtBQUFBLFFBQzVCLFNBQU87QUFDTixlQUFLLFdBQVcsS0FBSyxnREFBZ0QsR0FBRztBQUN4RSxlQUFLLFdBQVcsTUFBUztBQUFBLFFBQzFCO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFDRDtBQS9CYSwyQkFBTjtBQUFBLEVBRUo7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVJVOyIsCiAgIm5hbWVzIjogW10KfQo=
