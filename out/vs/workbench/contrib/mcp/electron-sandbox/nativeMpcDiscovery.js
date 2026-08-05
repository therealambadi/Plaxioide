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
import { ProxyChannel } from "../../../../base/parts/ipc/common/ipc.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IMainProcessService } from "../../../../platform/ipc/common/mainProcessService.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { NativeMcpDiscoveryHelperChannelName } from "../../../../platform/mcp/common/nativeMcpDiscoveryHelper.js";
import { NativeFilesystemMcpDiscovery } from "../common/discovery/nativeMcpDiscoveryAbstract.js";
import { IMcpRegistry } from "../common/mcpRegistryTypes.js";
let NativeMcpDiscovery = class extends NativeFilesystemMcpDiscovery {
  constructor(mainProcess, logService, labelService, fileService, instantiationService, mcpRegistry, configurationService) {
    super(null, labelService, fileService, instantiationService, mcpRegistry, configurationService);
    this.mainProcess = mainProcess;
    this.logService = logService;
  }
  start() {
    const service = ProxyChannel.toService(
      this.mainProcess.getChannel(NativeMcpDiscoveryHelperChannelName)
    );
    service.load().then(
      (data) => this.setDetails(data),
      (err) => {
        this.logService.warn("Error getting main process MCP environment", err);
        this.setDetails(void 0);
      }
    );
  }
};
NativeMcpDiscovery = __decorateClass([
  __decorateParam(0, IMainProcessService),
  __decorateParam(1, ILogService),
  __decorateParam(2, ILabelService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IMcpRegistry),
  __decorateParam(6, IConfigurationService)
], NativeMcpDiscovery);
export {
  NativeMcpDiscovery
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tY3AvZWxlY3Ryb24tc2FuZGJveC9uYXRpdmVNcGNEaXNjb3ZlcnkudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBQcm94eUNoYW5uZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3BhcnRzL2lwYy9jb21tb24vaXBjLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSU1haW5Qcm9jZXNzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2lwYy9jb21tb24vbWFpblByb2Nlc3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJTmF0aXZlTWNwRGlzY292ZXJ5SGVscGVyU2VydmljZSwgTmF0aXZlTWNwRGlzY292ZXJ5SGVscGVyQ2hhbm5lbE5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9tY3AvY29tbW9uL25hdGl2ZU1jcERpc2NvdmVyeUhlbHBlci5qcyc7XG5pbXBvcnQgeyBOYXRpdmVGaWxlc3lzdGVtTWNwRGlzY292ZXJ5IH0gZnJvbSAnLi4vY29tbW9uL2Rpc2NvdmVyeS9uYXRpdmVNY3BEaXNjb3ZlcnlBYnN0cmFjdC5qcyc7XG5pbXBvcnQgeyBJTWNwUmVnaXN0cnkgfSBmcm9tICcuLi9jb21tb24vbWNwUmVnaXN0cnlUeXBlcy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBOYXRpdmVNY3BEaXNjb3ZlcnkgZXh0ZW5kcyBOYXRpdmVGaWxlc3lzdGVtTWNwRGlzY292ZXJ5IHtcblx0Y29uc3RydWN0b3IoXG5cdFx0QElNYWluUHJvY2Vzc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtYWluUHJvY2VzczogSU1haW5Qcm9jZXNzU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU1jcFJlZ2lzdHJ5IG1jcFJlZ2lzdHJ5OiBJTWNwUmVnaXN0cnksXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihudWxsLCBsYWJlbFNlcnZpY2UsIGZpbGVTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgbWNwUmVnaXN0cnksIGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBzdGFydCgpOiB2b2lkIHtcblx0XHRjb25zdCBzZXJ2aWNlID0gUHJveHlDaGFubmVsLnRvU2VydmljZTxJTmF0aXZlTWNwRGlzY292ZXJ5SGVscGVyU2VydmljZT4oXG5cdFx0XHR0aGlzLm1haW5Qcm9jZXNzLmdldENoYW5uZWwoTmF0aXZlTWNwRGlzY292ZXJ5SGVscGVyQ2hhbm5lbE5hbWUpKTtcblxuXHRcdHNlcnZpY2UubG9hZCgpLnRoZW4oXG5cdFx0XHRkYXRhID0+IHRoaXMuc2V0RGV0YWlscyhkYXRhKSxcblx0XHRcdGVyciA9PiB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKCdFcnJvciBnZXR0aW5nIG1haW4gcHJvY2VzcyBNQ1AgZW52aXJvbm1lbnQnLCBlcnIpO1xuXHRcdFx0XHR0aGlzLnNldERldGFpbHModW5kZWZpbmVkKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQTJDLDJDQUEyQztBQUN0RixTQUFTLG9DQUFvQztBQUM3QyxTQUFTLG9CQUFvQjtBQUV0QixJQUFNLHFCQUFOLGNBQWlDLDZCQUE2QjtBQUFBLEVBQ3BFLFlBQ3VDLGFBQ1IsWUFDZixjQUNELGFBQ1Msc0JBQ1QsYUFDUyxzQkFDdEI7QUFDRCxVQUFNLE1BQU0sY0FBYyxhQUFhLHNCQUFzQixhQUFhLG9CQUFvQjtBQVJ4RDtBQUNSO0FBQUEsRUFRL0I7QUFBQSxFQUVnQixRQUFjO0FBQzdCLFVBQU0sVUFBVSxhQUFhO0FBQUEsTUFDNUIsS0FBSyxZQUFZLFdBQVcsbUNBQW1DO0FBQUEsSUFBQztBQUVqRSxZQUFRLEtBQUssRUFBRTtBQUFBLE1BQ2QsVUFBUSxLQUFLLFdBQVcsSUFBSTtBQUFBLE1BQzVCLFNBQU87QUFDTixhQUFLLFdBQVcsS0FBSyw4Q0FBOEMsR0FBRztBQUN0RSxhQUFLLFdBQVcsTUFBUztBQUFBLE1BQzFCO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQXpCYSxxQkFBTjtBQUFBLEVBRUo7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVJVOyIsCiAgIm5hbWVzIjogW10KfQo=
