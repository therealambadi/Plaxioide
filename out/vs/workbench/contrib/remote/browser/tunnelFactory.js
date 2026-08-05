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
import * as nls from "../../../../nls.js";
import { ITunnelService, TunnelProtocol, TunnelPrivacyId } from "../../../../platform/tunnel/common/tunnel.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IBrowserWorkbenchEnvironmentService } from "../../../services/environment/browser/environmentService.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { URI } from "../../../../base/common/uri.js";
import { IRemoteExplorerService } from "../../../services/remote/common/remoteExplorerService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { forwardedPortsFeaturesEnabled } from "../../../services/remote/common/tunnelModel.js";
let TunnelFactoryContribution = class extends Disposable {
  constructor(tunnelService, environmentService, openerService, remoteExplorerService, logService, contextKeyService) {
    super();
    this.openerService = openerService;
    const tunnelFactory = environmentService.options?.tunnelProvider?.tunnelFactory;
    if (tunnelFactory) {
      contextKeyService.createKey(forwardedPortsFeaturesEnabled.key, true);
      let privacyOptions = environmentService.options?.tunnelProvider?.features?.privacyOptions ?? [];
      if (environmentService.options?.tunnelProvider?.features?.public && privacyOptions.length === 0) {
        privacyOptions = [
          {
            id: "private",
            label: nls.localize("tunnelPrivacy.private", "Private"),
            themeIcon: "lock"
          },
          {
            id: "public",
            label: nls.localize("tunnelPrivacy.public", "Public"),
            themeIcon: "eye"
          }
        ];
      }
      this._register(tunnelService.setTunnelProvider({
        forwardPort: async (tunnelOptions, tunnelCreationOptions) => {
          let tunnelPromise;
          try {
            tunnelPromise = tunnelFactory(tunnelOptions, tunnelCreationOptions);
          } catch (e) {
            logService.trace("tunnelFactory: tunnel provider error");
          }
          if (!tunnelPromise) {
            return void 0;
          }
          let tunnel;
          try {
            tunnel = await tunnelPromise;
          } catch (e) {
            logService.trace("tunnelFactory: tunnel provider promise error");
            if (e instanceof Error) {
              return e.message;
            }
            return void 0;
          }
          const localAddress = tunnel.localAddress.startsWith("http") ? tunnel.localAddress : `http://${tunnel.localAddress}`;
          const remoteTunnel = {
            tunnelRemotePort: tunnel.remoteAddress.port,
            tunnelRemoteHost: tunnel.remoteAddress.host,
            // The tunnel factory may give us an inaccessible local address.
            // To make sure this doesn't happen, resolve the uri immediately.
            localAddress: await this.resolveExternalUri(localAddress),
            privacy: tunnel.privacy ?? (tunnel.public ? TunnelPrivacyId.Public : TunnelPrivacyId.Private),
            protocol: tunnel.protocol ?? TunnelProtocol.Http,
            dispose: async () => {
              await tunnel.dispose();
            }
          };
          return remoteTunnel;
        }
      }));
      const tunnelInformation = environmentService.options?.tunnelProvider?.features ? {
        features: {
          elevation: !!environmentService.options?.tunnelProvider?.features?.elevation,
          public: !!environmentService.options?.tunnelProvider?.features?.public,
          privacyOptions,
          protocol: environmentService.options?.tunnelProvider?.features?.protocol === void 0 ? true : !!environmentService.options?.tunnelProvider?.features?.protocol
        }
      } : void 0;
      remoteExplorerService.setTunnelInformation(tunnelInformation);
    }
  }
  async resolveExternalUri(uri) {
    try {
      return (await this.openerService.resolveExternalUri(URI.parse(uri))).resolved.toString();
    } catch {
      return uri;
    }
  }
};
TunnelFactoryContribution.ID = "workbench.contrib.tunnelFactory";
TunnelFactoryContribution = __decorateClass([
  __decorateParam(0, ITunnelService),
  __decorateParam(1, IBrowserWorkbenchEnvironmentService),
  __decorateParam(2, IOpenerService),
  __decorateParam(3, IRemoteExplorerService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IContextKeyService)
], TunnelFactoryContribution);
export {
  TunnelFactoryContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9yZW1vdGUvYnJvd3Nlci90dW5uZWxGYWN0b3J5LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJVHVubmVsU2VydmljZSwgVHVubmVsT3B0aW9ucywgUmVtb3RlVHVubmVsLCBUdW5uZWxDcmVhdGlvbk9wdGlvbnMsIElUdW5uZWwsIFR1bm5lbFByb3RvY29sLCBUdW5uZWxQcml2YWN5SWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90dW5uZWwvY29tbW9uL3R1bm5lbC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2Jyb3dzZXIvZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElSZW1vdGVFeHBsb3JlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9yZW1vdGUvY29tbW9uL3JlbW90ZUV4cGxvcmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgZm9yd2FyZGVkUG9ydHNGZWF0dXJlc0VuYWJsZWQgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9yZW1vdGUvY29tbW9uL3R1bm5lbE1vZGVsLmpzJztcblxuZXhwb3J0IGNsYXNzIFR1bm5lbEZhY3RvcnlDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLnR1bm5lbEZhY3RvcnknO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVHVubmVsU2VydmljZSB0dW5uZWxTZXJ2aWNlOiBJVHVubmVsU2VydmljZSxcblx0XHRASUJyb3dzZXJXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgZW52aXJvbm1lbnRTZXJ2aWNlOiBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASVJlbW90ZUV4cGxvcmVyU2VydmljZSByZW1vdGVFeHBsb3JlclNlcnZpY2U6IElSZW1vdGVFeHBsb3JlclNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdGNvbnN0IHR1bm5lbEZhY3RvcnkgPSBlbnZpcm9ubWVudFNlcnZpY2Uub3B0aW9ucz8udHVubmVsUHJvdmlkZXI/LnR1bm5lbEZhY3Rvcnk7XG5cdFx0aWYgKHR1bm5lbEZhY3RvcnkpIHtcblx0XHRcdC8vIEF0IHRoaXMgcG9pbnQgd2UgY2xlYXJseSB3YW50IHRoZSBwb3J0cyB2aWV3L2ZlYXR1cmVzIHNpbmNlIHdlIGhhdmUgYSB0dW5uZWwgZmFjdG9yeVxuXHRcdFx0Y29udGV4dEtleVNlcnZpY2UuY3JlYXRlS2V5KGZvcndhcmRlZFBvcnRzRmVhdHVyZXNFbmFibGVkLmtleSwgdHJ1ZSk7XG5cdFx0XHRsZXQgcHJpdmFjeU9wdGlvbnMgPSBlbnZpcm9ubWVudFNlcnZpY2Uub3B0aW9ucz8udHVubmVsUHJvdmlkZXI/LmZlYXR1cmVzPy5wcml2YWN5T3B0aW9ucyA/PyBbXTtcblx0XHRcdGlmIChlbnZpcm9ubWVudFNlcnZpY2Uub3B0aW9ucz8udHVubmVsUHJvdmlkZXI/LmZlYXR1cmVzPy5wdWJsaWNcblx0XHRcdFx0JiYgKHByaXZhY3lPcHRpb25zLmxlbmd0aCA9PT0gMCkpIHtcblx0XHRcdFx0cHJpdmFjeU9wdGlvbnMgPSBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0aWQ6ICdwcml2YXRlJyxcblx0XHRcdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ3R1bm5lbFByaXZhY3kucHJpdmF0ZScsIFwiUHJpdmF0ZVwiKSxcblx0XHRcdFx0XHRcdHRoZW1lSWNvbjogJ2xvY2snXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRpZDogJ3B1YmxpYycsXG5cdFx0XHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCd0dW5uZWxQcml2YWN5LnB1YmxpYycsIFwiUHVibGljXCIpLFxuXHRcdFx0XHRcdFx0dGhlbWVJY29uOiAnZXllJ1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodHVubmVsU2VydmljZS5zZXRUdW5uZWxQcm92aWRlcih7XG5cdFx0XHRcdGZvcndhcmRQb3J0OiBhc3luYyAodHVubmVsT3B0aW9uczogVHVubmVsT3B0aW9ucywgdHVubmVsQ3JlYXRpb25PcHRpb25zOiBUdW5uZWxDcmVhdGlvbk9wdGlvbnMpOiBQcm9taXNlPFJlbW90ZVR1bm5lbCB8IHN0cmluZyB8IHVuZGVmaW5lZD4gPT4ge1xuXHRcdFx0XHRcdGxldCB0dW5uZWxQcm9taXNlOiBQcm9taXNlPElUdW5uZWw+IHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHR0dW5uZWxQcm9taXNlID0gdHVubmVsRmFjdG9yeSh0dW5uZWxPcHRpb25zLCB0dW5uZWxDcmVhdGlvbk9wdGlvbnMpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdGxvZ1NlcnZpY2UudHJhY2UoJ3R1bm5lbEZhY3Rvcnk6IHR1bm5lbCBwcm92aWRlciBlcnJvcicpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICghdHVubmVsUHJvbWlzZSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bGV0IHR1bm5lbDogSVR1bm5lbDtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0dHVubmVsID0gYXdhaXQgdHVubmVsUHJvbWlzZTtcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0XHRsb2dTZXJ2aWNlLnRyYWNlKCd0dW5uZWxGYWN0b3J5OiB0dW5uZWwgcHJvdmlkZXIgcHJvbWlzZSBlcnJvcicpO1xuXHRcdFx0XHRcdFx0aWYgKGUgaW5zdGFuY2VvZiBFcnJvcikge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZS5tZXNzYWdlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3QgbG9jYWxBZGRyZXNzID0gdHVubmVsLmxvY2FsQWRkcmVzcy5zdGFydHNXaXRoKCdodHRwJykgPyB0dW5uZWwubG9jYWxBZGRyZXNzIDogYGh0dHA6Ly8ke3R1bm5lbC5sb2NhbEFkZHJlc3N9YDtcblx0XHRcdFx0XHRjb25zdCByZW1vdGVUdW5uZWw6IFJlbW90ZVR1bm5lbCA9IHtcblx0XHRcdFx0XHRcdHR1bm5lbFJlbW90ZVBvcnQ6IHR1bm5lbC5yZW1vdGVBZGRyZXNzLnBvcnQsXG5cdFx0XHRcdFx0XHR0dW5uZWxSZW1vdGVIb3N0OiB0dW5uZWwucmVtb3RlQWRkcmVzcy5ob3N0LFxuXHRcdFx0XHRcdFx0Ly8gVGhlIHR1bm5lbCBmYWN0b3J5IG1heSBnaXZlIHVzIGFuIGluYWNjZXNzaWJsZSBsb2NhbCBhZGRyZXNzLlxuXHRcdFx0XHRcdFx0Ly8gVG8gbWFrZSBzdXJlIHRoaXMgZG9lc24ndCBoYXBwZW4sIHJlc29sdmUgdGhlIHVyaSBpbW1lZGlhdGVseS5cblx0XHRcdFx0XHRcdGxvY2FsQWRkcmVzczogYXdhaXQgdGhpcy5yZXNvbHZlRXh0ZXJuYWxVcmkobG9jYWxBZGRyZXNzKSxcblx0XHRcdFx0XHRcdHByaXZhY3k6IHR1bm5lbC5wcml2YWN5ID8/ICh0dW5uZWwucHVibGljID8gVHVubmVsUHJpdmFjeUlkLlB1YmxpYyA6IFR1bm5lbFByaXZhY3lJZC5Qcml2YXRlKSxcblx0XHRcdFx0XHRcdHByb3RvY29sOiB0dW5uZWwucHJvdG9jb2wgPz8gVHVubmVsUHJvdG9jb2wuSHR0cCxcblx0XHRcdFx0XHRcdGRpc3Bvc2U6IGFzeW5jICgpID0+IHsgYXdhaXQgdHVubmVsLmRpc3Bvc2UoKTsgfVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0cmV0dXJuIHJlbW90ZVR1bm5lbDtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdFx0Y29uc3QgdHVubmVsSW5mb3JtYXRpb24gPSBlbnZpcm9ubWVudFNlcnZpY2Uub3B0aW9ucz8udHVubmVsUHJvdmlkZXI/LmZlYXR1cmVzID9cblx0XHRcdFx0e1xuXHRcdFx0XHRcdGZlYXR1cmVzOiB7XG5cdFx0XHRcdFx0XHRlbGV2YXRpb246ICEhZW52aXJvbm1lbnRTZXJ2aWNlLm9wdGlvbnM/LnR1bm5lbFByb3ZpZGVyPy5mZWF0dXJlcz8uZWxldmF0aW9uLFxuXHRcdFx0XHRcdFx0cHVibGljOiAhIWVudmlyb25tZW50U2VydmljZS5vcHRpb25zPy50dW5uZWxQcm92aWRlcj8uZmVhdHVyZXM/LnB1YmxpYyxcblx0XHRcdFx0XHRcdHByaXZhY3lPcHRpb25zLFxuXHRcdFx0XHRcdFx0cHJvdG9jb2w6IGVudmlyb25tZW50U2VydmljZS5vcHRpb25zPy50dW5uZWxQcm92aWRlcj8uZmVhdHVyZXM/LnByb3RvY29sID09PSB1bmRlZmluZWQgPyB0cnVlIDogISFlbnZpcm9ubWVudFNlcnZpY2Uub3B0aW9ucz8udHVubmVsUHJvdmlkZXI/LmZlYXR1cmVzPy5wcm90b2NvbFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSA6IHVuZGVmaW5lZDtcblx0XHRcdHJlbW90ZUV4cGxvcmVyU2VydmljZS5zZXRUdW5uZWxJbmZvcm1hdGlvbih0dW5uZWxJbmZvcm1hdGlvbik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXNvbHZlRXh0ZXJuYWxVcmkodXJpOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gKGF3YWl0IHRoaXMub3BlbmVyU2VydmljZS5yZXNvbHZlRXh0ZXJuYWxVcmkoVVJJLnBhcnNlKHVyaSkpKS5yZXNvbHZlZC50b1N0cmluZygpO1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0cmV0dXJuIHVyaTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsZ0JBQTZFLGdCQUFnQix1QkFBdUI7QUFDN0gsU0FBUyxrQkFBa0I7QUFFM0IsU0FBUywyQ0FBMkM7QUFDcEQsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMscUNBQXFDO0FBRXZDLElBQU0sNEJBQU4sY0FBd0MsV0FBNkM7QUFBQSxFQUkzRixZQUNpQixlQUNxQixvQkFDYixlQUNBLHVCQUNYLFlBQ08sbUJBQ25CO0FBQ0QsVUFBTTtBQUxrQjtBQU14QixVQUFNLGdCQUFnQixtQkFBbUIsU0FBUyxnQkFBZ0I7QUFDbEUsUUFBSSxlQUFlO0FBRWxCLHdCQUFrQixVQUFVLDhCQUE4QixLQUFLLElBQUk7QUFDbkUsVUFBSSxpQkFBaUIsbUJBQW1CLFNBQVMsZ0JBQWdCLFVBQVUsa0JBQWtCLENBQUM7QUFDOUYsVUFBSSxtQkFBbUIsU0FBUyxnQkFBZ0IsVUFBVSxVQUNyRCxlQUFlLFdBQVcsR0FBSTtBQUNsQyx5QkFBaUI7QUFBQSxVQUNoQjtBQUFBLFlBQ0MsSUFBSTtBQUFBLFlBQ0osT0FBTyxJQUFJLFNBQVMseUJBQXlCLFNBQVM7QUFBQSxZQUN0RCxXQUFXO0FBQUEsVUFDWjtBQUFBLFVBQ0E7QUFBQSxZQUNDLElBQUk7QUFBQSxZQUNKLE9BQU8sSUFBSSxTQUFTLHdCQUF3QixRQUFRO0FBQUEsWUFDcEQsV0FBVztBQUFBLFVBQ1o7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUVBLFdBQUssVUFBVSxjQUFjLGtCQUFrQjtBQUFBLFFBQzlDLGFBQWEsT0FBTyxlQUE4QiwwQkFBNkY7QUFDOUksY0FBSTtBQUNKLGNBQUk7QUFDSCw0QkFBZ0IsY0FBYyxlQUFlLHFCQUFxQjtBQUFBLFVBQ25FLFNBQVMsR0FBRztBQUNYLHVCQUFXLE1BQU0sc0NBQXNDO0FBQUEsVUFDeEQ7QUFFQSxjQUFJLENBQUMsZUFBZTtBQUNuQixtQkFBTztBQUFBLFVBQ1I7QUFDQSxjQUFJO0FBQ0osY0FBSTtBQUNILHFCQUFTLE1BQU07QUFBQSxVQUNoQixTQUFTLEdBQUc7QUFDWCx1QkFBVyxNQUFNLDhDQUE4QztBQUMvRCxnQkFBSSxhQUFhLE9BQU87QUFDdkIscUJBQU8sRUFBRTtBQUFBLFlBQ1Y7QUFDQSxtQkFBTztBQUFBLFVBQ1I7QUFDQSxnQkFBTSxlQUFlLE9BQU8sYUFBYSxXQUFXLE1BQU0sSUFBSSxPQUFPLGVBQWUsVUFBVSxPQUFPLFlBQVk7QUFDakgsZ0JBQU0sZUFBNkI7QUFBQSxZQUNsQyxrQkFBa0IsT0FBTyxjQUFjO0FBQUEsWUFDdkMsa0JBQWtCLE9BQU8sY0FBYztBQUFBO0FBQUE7QUFBQSxZQUd2QyxjQUFjLE1BQU0sS0FBSyxtQkFBbUIsWUFBWTtBQUFBLFlBQ3hELFNBQVMsT0FBTyxZQUFZLE9BQU8sU0FBUyxnQkFBZ0IsU0FBUyxnQkFBZ0I7QUFBQSxZQUNyRixVQUFVLE9BQU8sWUFBWSxlQUFlO0FBQUEsWUFDNUMsU0FBUyxZQUFZO0FBQUUsb0JBQU0sT0FBTyxRQUFRO0FBQUEsWUFBRztBQUFBLFVBQ2hEO0FBQ0EsaUJBQU87QUFBQSxRQUNSO0FBQUEsTUFDRCxDQUFDLENBQUM7QUFDRixZQUFNLG9CQUFvQixtQkFBbUIsU0FBUyxnQkFBZ0IsV0FDckU7QUFBQSxRQUNDLFVBQVU7QUFBQSxVQUNULFdBQVcsQ0FBQyxDQUFDLG1CQUFtQixTQUFTLGdCQUFnQixVQUFVO0FBQUEsVUFDbkUsUUFBUSxDQUFDLENBQUMsbUJBQW1CLFNBQVMsZ0JBQWdCLFVBQVU7QUFBQSxVQUNoRTtBQUFBLFVBQ0EsVUFBVSxtQkFBbUIsU0FBUyxnQkFBZ0IsVUFBVSxhQUFhLFNBQVksT0FBTyxDQUFDLENBQUMsbUJBQW1CLFNBQVMsZ0JBQWdCLFVBQVU7QUFBQSxRQUN6SjtBQUFBLE1BQ0QsSUFBSTtBQUNMLDRCQUFzQixxQkFBcUIsaUJBQWlCO0FBQUEsSUFDN0Q7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFjLG1CQUFtQixLQUE4QjtBQUM5RCxRQUFJO0FBQ0gsY0FBUSxNQUFNLEtBQUssY0FBYyxtQkFBbUIsSUFBSSxNQUFNLEdBQUcsQ0FBQyxHQUFHLFNBQVMsU0FBUztBQUFBLElBQ3hGLFFBQVE7QUFDUCxhQUFPO0FBQUEsSUFDUjtBQUFBLEVBQ0Q7QUFDRDtBQTFGYSwwQkFFSSxLQUFLO0FBRlQsNEJBQU47QUFBQSxFQUtKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVZVOyIsCiAgIm5hbWVzIjogW10KfQo=
