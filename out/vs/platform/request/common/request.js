import { streamToBuffer } from "../../../base/common/buffer.js";
import { getErrorMessage } from "../../../base/common/errors.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { localize } from "../../../nls.js";
import { ConfigurationScope, Extensions } from "../../configuration/common/configurationRegistry.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { Registry } from "../../registry/common/platform.js";
const IRequestService = createDecorator("requestService");
class LoggableHeaders {
  constructor(original) {
    this.original = original;
  }
  toJSON() {
    if (!this.headers) {
      const headers = /* @__PURE__ */ Object.create(null);
      for (const key in this.original) {
        if (key.toLowerCase() === "authorization" || key.toLowerCase() === "proxy-authorization") {
          headers[key] = "*****";
        } else {
          headers[key] = this.original[key];
        }
      }
      this.headers = headers;
    }
    return this.headers;
  }
}
class AbstractRequestService extends Disposable {
  constructor(logService) {
    super();
    this.logService = logService;
    this.counter = 0;
  }
  async logAndRequest(options, request) {
    const prefix = `#${++this.counter}: ${options.url}`;
    this.logService.trace(`${prefix} - begin`, options.type, new LoggableHeaders(options.headers ?? {}));
    try {
      const result = await request();
      this.logService.trace(`${prefix} - end`, options.type, result.res.statusCode, result.res.headers);
      return result;
    } catch (error) {
      this.logService.error(`${prefix} - error`, options.type, getErrorMessage(error));
      throw error;
    }
  }
}
function isSuccess(context) {
  return context.res.statusCode && context.res.statusCode >= 200 && context.res.statusCode < 300 || context.res.statusCode === 1223;
}
function hasNoContent(context) {
  return context.res.statusCode === 204;
}
async function asText(context) {
  if (hasNoContent(context)) {
    return null;
  }
  const buffer = await streamToBuffer(context.stream);
  return buffer.toString();
}
async function asTextOrError(context) {
  if (!isSuccess(context)) {
    throw new Error("Server returned " + context.res.statusCode);
  }
  return asText(context);
}
async function asJson(context) {
  if (!isSuccess(context)) {
    throw new Error("Server returned " + context.res.statusCode);
  }
  if (hasNoContent(context)) {
    return null;
  }
  const buffer = await streamToBuffer(context.stream);
  const str = buffer.toString();
  try {
    return JSON.parse(str);
  } catch (err) {
    err.message += ":\n" + str;
    throw err;
  }
}
function updateProxyConfigurationsScope(useHostProxy, useHostProxyDefault) {
  registerProxyConfigurations(useHostProxy, useHostProxyDefault);
}
const USER_LOCAL_AND_REMOTE_SETTINGS = [
  "http.proxy",
  "http.proxyStrictSSL",
  "http.proxyKerberosServicePrincipal",
  "http.noProxy",
  "http.proxyAuthorization",
  "http.proxySupport",
  "http.systemCertificates",
  "http.experimental.systemCertificatesV2",
  "http.fetchAdditionalSupport"
];
let proxyConfiguration = [];
let previousUseHostProxy = void 0;
let previousUseHostProxyDefault = void 0;
function registerProxyConfigurations(useHostProxy = true, useHostProxyDefault = true) {
  if (previousUseHostProxy === useHostProxy && previousUseHostProxyDefault === useHostProxyDefault) {
    return;
  }
  previousUseHostProxy = useHostProxy;
  previousUseHostProxyDefault = useHostProxyDefault;
  const configurationRegistry = Registry.as(Extensions.Configuration);
  const oldProxyConfiguration = proxyConfiguration;
  proxyConfiguration = [
    {
      id: "http",
      order: 15,
      title: localize("httpConfigurationTitle", "HTTP"),
      type: "object",
      scope: ConfigurationScope.MACHINE,
      properties: {
        "http.useLocalProxyConfiguration": {
          type: "boolean",
          default: useHostProxyDefault,
          markdownDescription: localize("useLocalProxy", "Controls whether in the remote extension host the local proxy configuration should be used. This setting only applies as a remote setting during [remote development](https://aka.ms/vscode-remote)."),
          restricted: true
        }
      }
    },
    {
      id: "http",
      order: 15,
      title: localize("httpConfigurationTitle", "HTTP"),
      type: "object",
      scope: ConfigurationScope.APPLICATION,
      properties: {
        "http.electronFetch": {
          type: "boolean",
          default: false,
          description: localize("electronFetch", "Controls whether use of Electron's fetch implementation instead of Node.js' should be enabled. All local extensions will get Electron's fetch implementation for the global fetch API."),
          restricted: true
        }
      }
    },
    {
      id: "http",
      order: 15,
      title: localize("httpConfigurationTitle", "HTTP"),
      type: "object",
      scope: useHostProxy ? ConfigurationScope.APPLICATION : ConfigurationScope.MACHINE,
      properties: {
        "http.proxy": {
          type: "string",
          pattern: "^(https?|socks|socks4a?|socks5h?)://([^:]*(:[^@]*)?@)?([^:]+|\\[[:0-9a-fA-F]+\\])(:\\d+)?/?$|^$",
          markdownDescription: localize("proxy", "The proxy setting to use. If not set, will be inherited from the `http_proxy` and `https_proxy` environment variables. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", "`#http.useLocalProxyConfiguration#`"),
          restricted: true
        },
        "http.proxyStrictSSL": {
          type: "boolean",
          default: true,
          markdownDescription: localize("strictSSL", "Controls whether the proxy server certificate should be verified against the list of supplied CAs. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", "`#http.useLocalProxyConfiguration#`"),
          restricted: true
        },
        "http.proxyKerberosServicePrincipal": {
          type: "string",
          markdownDescription: localize("proxyKerberosServicePrincipal", "Overrides the principal service name for Kerberos authentication with the HTTP proxy. A default based on the proxy hostname is used when this is not set. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", "`#http.useLocalProxyConfiguration#`"),
          restricted: true
        },
        "http.noProxy": {
          type: "array",
          items: { type: "string" },
          markdownDescription: localize("noProxy", "Specifies domain names for which proxy settings should be ignored for HTTP/HTTPS requests. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", "`#http.useLocalProxyConfiguration#`"),
          restricted: true
        },
        "http.proxyAuthorization": {
          type: ["null", "string"],
          default: null,
          markdownDescription: localize("proxyAuthorization", "The value to send as the `Proxy-Authorization` header for every network request. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", "`#http.useLocalProxyConfiguration#`"),
          restricted: true
        },
        "http.proxySupport": {
          type: "string",
          enum: ["off", "on", "fallback", "override"],
          enumDescriptions: [
            localize("proxySupportOff", "Disable proxy support for extensions."),
            localize("proxySupportOn", "Enable proxy support for extensions."),
            localize("proxySupportFallback", "Enable proxy support for extensions, fall back to request options, when no proxy found."),
            localize("proxySupportOverride", "Enable proxy support for extensions, override request options.")
          ],
          default: "override",
          markdownDescription: localize("proxySupport", "Use the proxy support for extensions. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", "`#http.useLocalProxyConfiguration#`"),
          restricted: true
        },
        "http.systemCertificates": {
          type: "boolean",
          default: true,
          markdownDescription: localize("systemCertificates", "Controls whether CA certificates should be loaded from the OS. On Windows and macOS, a reload of the window is required after turning this off. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", "`#http.useLocalProxyConfiguration#`"),
          restricted: true
        },
        "http.experimental.systemCertificatesV2": {
          type: "boolean",
          tags: ["experimental"],
          default: false,
          markdownDescription: localize("systemCertificatesV2", "Controls whether experimental loading of CA certificates from the OS should be enabled. This uses a more general approach than the default implementation. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", "`#http.useLocalProxyConfiguration#`"),
          restricted: true
        },
        "http.fetchAdditionalSupport": {
          type: "boolean",
          default: true,
          markdownDescription: localize("fetchAdditionalSupport", "Controls whether Node.js' fetch implementation should be extended with additional support. Currently proxy support ({1}) and system certificates ({2}) are added when the corresponding settings are enabled. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", "`#http.useLocalProxyConfiguration#`", "`#http.proxySupport#`", "`#http.systemCertificates#`"),
          restricted: true
        }
      }
    }
  ];
  configurationRegistry.updateConfigurations({ add: proxyConfiguration, remove: oldProxyConfiguration });
}
registerProxyConfigurations();
export {
  AbstractRequestService,
  IRequestService,
  USER_LOCAL_AND_REMOTE_SETTINGS,
  asJson,
  asText,
  asTextOrError,
  hasNoContent,
  isSuccess,
  updateProxyConfigurationsScope
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9yZXF1ZXN0L2NvbW1vbi9yZXF1ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgc3RyZWFtVG9CdWZmZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgZ2V0RXJyb3JNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUhlYWRlcnMsIElSZXF1ZXN0Q29udGV4dCwgSVJlcXVlc3RPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9wYXJ0cy9yZXF1ZXN0L2NvbW1vbi9yZXF1ZXN0LmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25TY29wZSwgRXh0ZW5zaW9ucywgSUNvbmZpZ3VyYXRpb25Ob2RlLCBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IGNyZWF0ZURlY29yYXRvciB9IGZyb20gJy4uLy4uL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5cbmV4cG9ydCBjb25zdCBJUmVxdWVzdFNlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SVJlcXVlc3RTZXJ2aWNlPigncmVxdWVzdFNlcnZpY2UnKTtcblxuZXhwb3J0IGludGVyZmFjZSBBdXRoSW5mbyB7XG5cdGlzUHJveHk6IGJvb2xlYW47XG5cdHNjaGVtZTogc3RyaW5nO1xuXHRob3N0OiBzdHJpbmc7XG5cdHBvcnQ6IG51bWJlcjtcblx0cmVhbG06IHN0cmluZztcblx0YXR0ZW1wdDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENyZWRlbnRpYWxzIHtcblx0dXNlcm5hbWU6IHN0cmluZztcblx0cGFzc3dvcmQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUmVxdWVzdFNlcnZpY2Uge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cmVxdWVzdChvcHRpb25zOiBJUmVxdWVzdE9wdGlvbnMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVJlcXVlc3RDb250ZXh0PjtcblxuXHRyZXNvbHZlUHJveHkodXJsOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD47XG5cdGxvb2t1cEF1dGhvcml6YXRpb24oYXV0aEluZm86IEF1dGhJbmZvKTogUHJvbWlzZTxDcmVkZW50aWFscyB8IHVuZGVmaW5lZD47XG5cdGxvb2t1cEtlcmJlcm9zQXV0aG9yaXphdGlvbih1cmw6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPjtcblx0bG9hZENlcnRpZmljYXRlcygpOiBQcm9taXNlPHN0cmluZ1tdPjtcbn1cblxuY2xhc3MgTG9nZ2FibGVIZWFkZXJzIHtcblxuXHRwcml2YXRlIGhlYWRlcnM6IElIZWFkZXJzIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgb3JpZ2luYWw6IElIZWFkZXJzKSB7IH1cblxuXHR0b0pTT04oKTogYW55IHtcblx0XHRpZiAoIXRoaXMuaGVhZGVycykge1xuXHRcdFx0Y29uc3QgaGVhZGVycyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0XHRmb3IgKGNvbnN0IGtleSBpbiB0aGlzLm9yaWdpbmFsKSB7XG5cdFx0XHRcdGlmIChrZXkudG9Mb3dlckNhc2UoKSA9PT0gJ2F1dGhvcml6YXRpb24nIHx8IGtleS50b0xvd2VyQ2FzZSgpID09PSAncHJveHktYXV0aG9yaXphdGlvbicpIHtcblx0XHRcdFx0XHRoZWFkZXJzW2tleV0gPSAnKioqKionO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGhlYWRlcnNba2V5XSA9IHRoaXMub3JpZ2luYWxba2V5XTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5oZWFkZXJzID0gaGVhZGVycztcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuaGVhZGVycztcblx0fVxuXG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBBYnN0cmFjdFJlcXVlc3RTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElSZXF1ZXN0U2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBjb3VudGVyID0gMDtcblxuXHRjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIGxvZ0FuZFJlcXVlc3Qob3B0aW9uczogSVJlcXVlc3RPcHRpb25zLCByZXF1ZXN0OiAoKSA9PiBQcm9taXNlPElSZXF1ZXN0Q29udGV4dD4pOiBQcm9taXNlPElSZXF1ZXN0Q29udGV4dD4ge1xuXHRcdGNvbnN0IHByZWZpeCA9IGAjJHsrK3RoaXMuY291bnRlcn06ICR7b3B0aW9ucy51cmx9YDtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYCR7cHJlZml4fSAtIGJlZ2luYCwgb3B0aW9ucy50eXBlLCBuZXcgTG9nZ2FibGVIZWFkZXJzKG9wdGlvbnMuaGVhZGVycyA/PyB7fSkpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCByZXF1ZXN0KCk7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYCR7cHJlZml4fSAtIGVuZGAsIG9wdGlvbnMudHlwZSwgcmVzdWx0LnJlcy5zdGF0dXNDb2RlLCByZXN1bHQucmVzLmhlYWRlcnMpO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGAke3ByZWZpeH0gLSBlcnJvcmAsIG9wdGlvbnMudHlwZSwgZ2V0RXJyb3JNZXNzYWdlKGVycm9yKSk7XG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9XG5cdH1cblxuXHRhYnN0cmFjdCByZXF1ZXN0KG9wdGlvbnM6IElSZXF1ZXN0T3B0aW9ucywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJUmVxdWVzdENvbnRleHQ+O1xuXHRhYnN0cmFjdCByZXNvbHZlUHJveHkodXJsOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD47XG5cdGFic3RyYWN0IGxvb2t1cEF1dGhvcml6YXRpb24oYXV0aEluZm86IEF1dGhJbmZvKTogUHJvbWlzZTxDcmVkZW50aWFscyB8IHVuZGVmaW5lZD47XG5cdGFic3RyYWN0IGxvb2t1cEtlcmJlcm9zQXV0aG9yaXphdGlvbih1cmw6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPjtcblx0YWJzdHJhY3QgbG9hZENlcnRpZmljYXRlcygpOiBQcm9taXNlPHN0cmluZ1tdPjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzU3VjY2Vzcyhjb250ZXh0OiBJUmVxdWVzdENvbnRleHQpOiBib29sZWFuIHtcblx0cmV0dXJuIChjb250ZXh0LnJlcy5zdGF0dXNDb2RlICYmIGNvbnRleHQucmVzLnN0YXR1c0NvZGUgPj0gMjAwICYmIGNvbnRleHQucmVzLnN0YXR1c0NvZGUgPCAzMDApIHx8IGNvbnRleHQucmVzLnN0YXR1c0NvZGUgPT09IDEyMjM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBoYXNOb0NvbnRlbnQoY29udGV4dDogSVJlcXVlc3RDb250ZXh0KTogYm9vbGVhbiB7XG5cdHJldHVybiBjb250ZXh0LnJlcy5zdGF0dXNDb2RlID09PSAyMDQ7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBhc1RleHQoY29udGV4dDogSVJlcXVlc3RDb250ZXh0KTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG5cdGlmIChoYXNOb0NvbnRlbnQoY29udGV4dCkpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXHRjb25zdCBidWZmZXIgPSBhd2FpdCBzdHJlYW1Ub0J1ZmZlcihjb250ZXh0LnN0cmVhbSk7XG5cdHJldHVybiBidWZmZXIudG9TdHJpbmcoKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFzVGV4dE9yRXJyb3IoY29udGV4dDogSVJlcXVlc3RDb250ZXh0KTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG5cdGlmICghaXNTdWNjZXNzKGNvbnRleHQpKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdTZXJ2ZXIgcmV0dXJuZWQgJyArIGNvbnRleHQucmVzLnN0YXR1c0NvZGUpO1xuXHR9XG5cdHJldHVybiBhc1RleHQoY29udGV4dCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBhc0pzb248VCA9IHt9Pihjb250ZXh0OiBJUmVxdWVzdENvbnRleHQpOiBQcm9taXNlPFQgfCBudWxsPiB7XG5cdGlmICghaXNTdWNjZXNzKGNvbnRleHQpKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdTZXJ2ZXIgcmV0dXJuZWQgJyArIGNvbnRleHQucmVzLnN0YXR1c0NvZGUpO1xuXHR9XG5cdGlmIChoYXNOb0NvbnRlbnQoY29udGV4dCkpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXHRjb25zdCBidWZmZXIgPSBhd2FpdCBzdHJlYW1Ub0J1ZmZlcihjb250ZXh0LnN0cmVhbSk7XG5cdGNvbnN0IHN0ciA9IGJ1ZmZlci50b1N0cmluZygpO1xuXHR0cnkge1xuXHRcdHJldHVybiBKU09OLnBhcnNlKHN0cik7XG5cdH0gY2F0Y2ggKGVycikge1xuXHRcdGVyci5tZXNzYWdlICs9ICc6XFxuJyArIHN0cjtcblx0XHR0aHJvdyBlcnI7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVwZGF0ZVByb3h5Q29uZmlndXJhdGlvbnNTY29wZSh1c2VIb3N0UHJveHk6IGJvb2xlYW4sIHVzZUhvc3RQcm94eURlZmF1bHQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0cmVnaXN0ZXJQcm94eUNvbmZpZ3VyYXRpb25zKHVzZUhvc3RQcm94eSwgdXNlSG9zdFByb3h5RGVmYXVsdCk7XG59XG5cbmV4cG9ydCBjb25zdCBVU0VSX0xPQ0FMX0FORF9SRU1PVEVfU0VUVElOR1MgPSBbXG5cdCdodHRwLnByb3h5Jyxcblx0J2h0dHAucHJveHlTdHJpY3RTU0wnLFxuXHQnaHR0cC5wcm94eUtlcmJlcm9zU2VydmljZVByaW5jaXBhbCcsXG5cdCdodHRwLm5vUHJveHknLFxuXHQnaHR0cC5wcm94eUF1dGhvcml6YXRpb24nLFxuXHQnaHR0cC5wcm94eVN1cHBvcnQnLFxuXHQnaHR0cC5zeXN0ZW1DZXJ0aWZpY2F0ZXMnLFxuXHQnaHR0cC5leHBlcmltZW50YWwuc3lzdGVtQ2VydGlmaWNhdGVzVjInLFxuXHQnaHR0cC5mZXRjaEFkZGl0aW9uYWxTdXBwb3J0Jyxcbl07XG5cbmxldCBwcm94eUNvbmZpZ3VyYXRpb246IElDb25maWd1cmF0aW9uTm9kZVtdID0gW107XG5sZXQgcHJldmlvdXNVc2VIb3N0UHJveHk6IGJvb2xlYW4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5sZXQgcHJldmlvdXNVc2VIb3N0UHJveHlEZWZhdWx0OiBib29sZWFuIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuZnVuY3Rpb24gcmVnaXN0ZXJQcm94eUNvbmZpZ3VyYXRpb25zKHVzZUhvc3RQcm94eSA9IHRydWUsIHVzZUhvc3RQcm94eURlZmF1bHQgPSB0cnVlKTogdm9pZCB7XG5cdGlmIChwcmV2aW91c1VzZUhvc3RQcm94eSA9PT0gdXNlSG9zdFByb3h5ICYmIHByZXZpb3VzVXNlSG9zdFByb3h5RGVmYXVsdCA9PT0gdXNlSG9zdFByb3h5RGVmYXVsdCkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdHByZXZpb3VzVXNlSG9zdFByb3h5ID0gdXNlSG9zdFByb3h5O1xuXHRwcmV2aW91c1VzZUhvc3RQcm94eURlZmF1bHQgPSB1c2VIb3N0UHJveHlEZWZhdWx0O1xuXG5cdGNvbnN0IGNvbmZpZ3VyYXRpb25SZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KEV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbik7XG5cdGNvbnN0IG9sZFByb3h5Q29uZmlndXJhdGlvbiA9IHByb3h5Q29uZmlndXJhdGlvbjtcblx0cHJveHlDb25maWd1cmF0aW9uID0gW1xuXHRcdHtcblx0XHRcdGlkOiAnaHR0cCcsXG5cdFx0XHRvcmRlcjogMTUsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ2h0dHBDb25maWd1cmF0aW9uVGl0bGUnLCBcIkhUVFBcIiksXG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTUFDSElORSxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0J2h0dHAudXNlTG9jYWxQcm94eUNvbmZpZ3VyYXRpb24nOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHVzZUhvc3RQcm94eURlZmF1bHQsXG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3VzZUxvY2FsUHJveHknLCBcIkNvbnRyb2xzIHdoZXRoZXIgaW4gdGhlIHJlbW90ZSBleHRlbnNpb24gaG9zdCB0aGUgbG9jYWwgcHJveHkgY29uZmlndXJhdGlvbiBzaG91bGQgYmUgdXNlZC4gVGhpcyBzZXR0aW5nIG9ubHkgYXBwbGllcyBhcyBhIHJlbW90ZSBzZXR0aW5nIGR1cmluZyBbcmVtb3RlIGRldmVsb3BtZW50XShodHRwczovL2FrYS5tcy92c2NvZGUtcmVtb3RlKS5cIiksXG5cdFx0XHRcdFx0cmVzdHJpY3RlZDogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0aWQ6ICdodHRwJyxcblx0XHRcdG9yZGVyOiAxNSxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnaHR0cENvbmZpZ3VyYXRpb25UaXRsZScsIFwiSFRUUFwiKSxcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5BUFBMSUNBVElPTixcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0J2h0dHAuZWxlY3Ryb25GZXRjaCc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogZmFsc2UsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdlbGVjdHJvbkZldGNoJywgXCJDb250cm9scyB3aGV0aGVyIHVzZSBvZiBFbGVjdHJvbidzIGZldGNoIGltcGxlbWVudGF0aW9uIGluc3RlYWQgb2YgTm9kZS5qcycgc2hvdWxkIGJlIGVuYWJsZWQuIEFsbCBsb2NhbCBleHRlbnNpb25zIHdpbGwgZ2V0IEVsZWN0cm9uJ3MgZmV0Y2ggaW1wbGVtZW50YXRpb24gZm9yIHRoZSBnbG9iYWwgZmV0Y2ggQVBJLlwiKSxcblx0XHRcdFx0XHRyZXN0cmljdGVkOiB0cnVlXG5cdFx0XHRcdH0sXG5cdFx0XHR9XG5cdFx0fSxcblx0XHR7XG5cdFx0XHRpZDogJ2h0dHAnLFxuXHRcdFx0b3JkZXI6IDE1LFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdodHRwQ29uZmlndXJhdGlvblRpdGxlJywgXCJIVFRQXCIpLFxuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRzY29wZTogdXNlSG9zdFByb3h5ID8gQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OIDogQ29uZmlndXJhdGlvblNjb3BlLk1BQ0hJTkUsXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdCdodHRwLnByb3h5Jzoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdHBhdHRlcm46ICdeKGh0dHBzP3xzb2Nrc3xzb2NrczRhP3xzb2NrczVoPyk6Ly8oW146XSooOlteQF0qKT9AKT8oW146XSt8XFxcXFtbOjAtOWEtZkEtRl0rXFxcXF0pKDpcXFxcZCspPy8/JHxeJCcsXG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Byb3h5JywgXCJUaGUgcHJveHkgc2V0dGluZyB0byB1c2UuIElmIG5vdCBzZXQsIHdpbGwgYmUgaW5oZXJpdGVkIGZyb20gdGhlIGBodHRwX3Byb3h5YCBhbmQgYGh0dHBzX3Byb3h5YCBlbnZpcm9ubWVudCB2YXJpYWJsZXMuIFdoZW4gZHVyaW5nIFtyZW1vdGUgZGV2ZWxvcG1lbnRdKGh0dHBzOi8vYWthLm1zL3ZzY29kZS1yZW1vdGUpIHRoZSB7MH0gc2V0dGluZyBpcyBkaXNhYmxlZCB0aGlzIHNldHRpbmcgY2FuIGJlIGNvbmZpZ3VyZWQgaW4gdGhlIGxvY2FsIGFuZCB0aGUgcmVtb3RlIHNldHRpbmdzIHNlcGFyYXRlbHkuXCIsICdgI2h0dHAudXNlTG9jYWxQcm94eUNvbmZpZ3VyYXRpb24jYCcpLFxuXHRcdFx0XHRcdHJlc3RyaWN0ZWQ6IHRydWVcblx0XHRcdFx0fSxcblx0XHRcdFx0J2h0dHAucHJveHlTdHJpY3RTU0wnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3N0cmljdFNTTCcsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgcHJveHkgc2VydmVyIGNlcnRpZmljYXRlIHNob3VsZCBiZSB2ZXJpZmllZCBhZ2FpbnN0IHRoZSBsaXN0IG9mIHN1cHBsaWVkIENBcy4gV2hlbiBkdXJpbmcgW3JlbW90ZSBkZXZlbG9wbWVudF0oaHR0cHM6Ly9ha2EubXMvdnNjb2RlLXJlbW90ZSkgdGhlIHswfSBzZXR0aW5nIGlzIGRpc2FibGVkIHRoaXMgc2V0dGluZyBjYW4gYmUgY29uZmlndXJlZCBpbiB0aGUgbG9jYWwgYW5kIHRoZSByZW1vdGUgc2V0dGluZ3Mgc2VwYXJhdGVseS5cIiwgJ2AjaHR0cC51c2VMb2NhbFByb3h5Q29uZmlndXJhdGlvbiNgJyksXG5cdFx0XHRcdFx0cmVzdHJpY3RlZDogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnaHR0cC5wcm94eUtlcmJlcm9zU2VydmljZVByaW5jaXBhbCc6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgncHJveHlLZXJiZXJvc1NlcnZpY2VQcmluY2lwYWwnLCBcIk92ZXJyaWRlcyB0aGUgcHJpbmNpcGFsIHNlcnZpY2UgbmFtZSBmb3IgS2VyYmVyb3MgYXV0aGVudGljYXRpb24gd2l0aCB0aGUgSFRUUCBwcm94eS4gQSBkZWZhdWx0IGJhc2VkIG9uIHRoZSBwcm94eSBob3N0bmFtZSBpcyB1c2VkIHdoZW4gdGhpcyBpcyBub3Qgc2V0LiBXaGVuIGR1cmluZyBbcmVtb3RlIGRldmVsb3BtZW50XShodHRwczovL2FrYS5tcy92c2NvZGUtcmVtb3RlKSB0aGUgezB9IHNldHRpbmcgaXMgZGlzYWJsZWQgdGhpcyBzZXR0aW5nIGNhbiBiZSBjb25maWd1cmVkIGluIHRoZSBsb2NhbCBhbmQgdGhlIHJlbW90ZSBzZXR0aW5ncyBzZXBhcmF0ZWx5LlwiLCAnYCNodHRwLnVzZUxvY2FsUHJveHlDb25maWd1cmF0aW9uI2AnKSxcblx0XHRcdFx0XHRyZXN0cmljdGVkOiB0cnVlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdodHRwLm5vUHJveHknOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0XHRpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9LFxuXHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdub1Byb3h5JywgXCJTcGVjaWZpZXMgZG9tYWluIG5hbWVzIGZvciB3aGljaCBwcm94eSBzZXR0aW5ncyBzaG91bGQgYmUgaWdub3JlZCBmb3IgSFRUUC9IVFRQUyByZXF1ZXN0cy4gV2hlbiBkdXJpbmcgW3JlbW90ZSBkZXZlbG9wbWVudF0oaHR0cHM6Ly9ha2EubXMvdnNjb2RlLXJlbW90ZSkgdGhlIHswfSBzZXR0aW5nIGlzIGRpc2FibGVkIHRoaXMgc2V0dGluZyBjYW4gYmUgY29uZmlndXJlZCBpbiB0aGUgbG9jYWwgYW5kIHRoZSByZW1vdGUgc2V0dGluZ3Mgc2VwYXJhdGVseS5cIiwgJ2AjaHR0cC51c2VMb2NhbFByb3h5Q29uZmlndXJhdGlvbiNgJyksXG5cdFx0XHRcdFx0cmVzdHJpY3RlZDogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnaHR0cC5wcm94eUF1dGhvcml6YXRpb24nOiB7XG5cdFx0XHRcdFx0dHlwZTogWydudWxsJywgJ3N0cmluZyddLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IG51bGwsXG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Byb3h5QXV0aG9yaXphdGlvbicsIFwiVGhlIHZhbHVlIHRvIHNlbmQgYXMgdGhlIGBQcm94eS1BdXRob3JpemF0aW9uYCBoZWFkZXIgZm9yIGV2ZXJ5IG5ldHdvcmsgcmVxdWVzdC4gV2hlbiBkdXJpbmcgW3JlbW90ZSBkZXZlbG9wbWVudF0oaHR0cHM6Ly9ha2EubXMvdnNjb2RlLXJlbW90ZSkgdGhlIHswfSBzZXR0aW5nIGlzIGRpc2FibGVkIHRoaXMgc2V0dGluZyBjYW4gYmUgY29uZmlndXJlZCBpbiB0aGUgbG9jYWwgYW5kIHRoZSByZW1vdGUgc2V0dGluZ3Mgc2VwYXJhdGVseS5cIiwgJ2AjaHR0cC51c2VMb2NhbFByb3h5Q29uZmlndXJhdGlvbiNgJyksXG5cdFx0XHRcdFx0cmVzdHJpY3RlZDogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnaHR0cC5wcm94eVN1cHBvcnQnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZW51bTogWydvZmYnLCAnb24nLCAnZmFsbGJhY2snLCAnb3ZlcnJpZGUnXSxcblx0XHRcdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgncHJveHlTdXBwb3J0T2ZmJywgXCJEaXNhYmxlIHByb3h5IHN1cHBvcnQgZm9yIGV4dGVuc2lvbnMuXCIpLFxuXHRcdFx0XHRcdFx0bG9jYWxpemUoJ3Byb3h5U3VwcG9ydE9uJywgXCJFbmFibGUgcHJveHkgc3VwcG9ydCBmb3IgZXh0ZW5zaW9ucy5cIiksXG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgncHJveHlTdXBwb3J0RmFsbGJhY2snLCBcIkVuYWJsZSBwcm94eSBzdXBwb3J0IGZvciBleHRlbnNpb25zLCBmYWxsIGJhY2sgdG8gcmVxdWVzdCBvcHRpb25zLCB3aGVuIG5vIHByb3h5IGZvdW5kLlwiKSxcblx0XHRcdFx0XHRcdGxvY2FsaXplKCdwcm94eVN1cHBvcnRPdmVycmlkZScsIFwiRW5hYmxlIHByb3h5IHN1cHBvcnQgZm9yIGV4dGVuc2lvbnMsIG92ZXJyaWRlIHJlcXVlc3Qgb3B0aW9ucy5cIiksXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRkZWZhdWx0OiAnb3ZlcnJpZGUnLFxuXHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdwcm94eVN1cHBvcnQnLCBcIlVzZSB0aGUgcHJveHkgc3VwcG9ydCBmb3IgZXh0ZW5zaW9ucy4gV2hlbiBkdXJpbmcgW3JlbW90ZSBkZXZlbG9wbWVudF0oaHR0cHM6Ly9ha2EubXMvdnNjb2RlLXJlbW90ZSkgdGhlIHswfSBzZXR0aW5nIGlzIGRpc2FibGVkIHRoaXMgc2V0dGluZyBjYW4gYmUgY29uZmlndXJlZCBpbiB0aGUgbG9jYWwgYW5kIHRoZSByZW1vdGUgc2V0dGluZ3Mgc2VwYXJhdGVseS5cIiwgJ2AjaHR0cC51c2VMb2NhbFByb3h5Q29uZmlndXJhdGlvbiNgJyksXG5cdFx0XHRcdFx0cmVzdHJpY3RlZDogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnaHR0cC5zeXN0ZW1DZXJ0aWZpY2F0ZXMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3N5c3RlbUNlcnRpZmljYXRlcycsIFwiQ29udHJvbHMgd2hldGhlciBDQSBjZXJ0aWZpY2F0ZXMgc2hvdWxkIGJlIGxvYWRlZCBmcm9tIHRoZSBPUy4gT24gV2luZG93cyBhbmQgbWFjT1MsIGEgcmVsb2FkIG9mIHRoZSB3aW5kb3cgaXMgcmVxdWlyZWQgYWZ0ZXIgdHVybmluZyB0aGlzIG9mZi4gV2hlbiBkdXJpbmcgW3JlbW90ZSBkZXZlbG9wbWVudF0oaHR0cHM6Ly9ha2EubXMvdnNjb2RlLXJlbW90ZSkgdGhlIHswfSBzZXR0aW5nIGlzIGRpc2FibGVkIHRoaXMgc2V0dGluZyBjYW4gYmUgY29uZmlndXJlZCBpbiB0aGUgbG9jYWwgYW5kIHRoZSByZW1vdGUgc2V0dGluZ3Mgc2VwYXJhdGVseS5cIiwgJ2AjaHR0cC51c2VMb2NhbFByb3h5Q29uZmlndXJhdGlvbiNgJyksXG5cdFx0XHRcdFx0cmVzdHJpY3RlZDogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnaHR0cC5leHBlcmltZW50YWwuc3lzdGVtQ2VydGlmaWNhdGVzVjInOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdHRhZ3M6IFsnZXhwZXJpbWVudGFsJ10sXG5cdFx0XHRcdFx0ZGVmYXVsdDogZmFsc2UsXG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3N5c3RlbUNlcnRpZmljYXRlc1YyJywgXCJDb250cm9scyB3aGV0aGVyIGV4cGVyaW1lbnRhbCBsb2FkaW5nIG9mIENBIGNlcnRpZmljYXRlcyBmcm9tIHRoZSBPUyBzaG91bGQgYmUgZW5hYmxlZC4gVGhpcyB1c2VzIGEgbW9yZSBnZW5lcmFsIGFwcHJvYWNoIHRoYW4gdGhlIGRlZmF1bHQgaW1wbGVtZW50YXRpb24uIFdoZW4gZHVyaW5nIFtyZW1vdGUgZGV2ZWxvcG1lbnRdKGh0dHBzOi8vYWthLm1zL3ZzY29kZS1yZW1vdGUpIHRoZSB7MH0gc2V0dGluZyBpcyBkaXNhYmxlZCB0aGlzIHNldHRpbmcgY2FuIGJlIGNvbmZpZ3VyZWQgaW4gdGhlIGxvY2FsIGFuZCB0aGUgcmVtb3RlIHNldHRpbmdzIHNlcGFyYXRlbHkuXCIsICdgI2h0dHAudXNlTG9jYWxQcm94eUNvbmZpZ3VyYXRpb24jYCcpLFxuXHRcdFx0XHRcdHJlc3RyaWN0ZWQ6IHRydWVcblx0XHRcdFx0fSxcblx0XHRcdFx0J2h0dHAuZmV0Y2hBZGRpdGlvbmFsU3VwcG9ydCc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmV0Y2hBZGRpdGlvbmFsU3VwcG9ydCcsIFwiQ29udHJvbHMgd2hldGhlciBOb2RlLmpzJyBmZXRjaCBpbXBsZW1lbnRhdGlvbiBzaG91bGQgYmUgZXh0ZW5kZWQgd2l0aCBhZGRpdGlvbmFsIHN1cHBvcnQuIEN1cnJlbnRseSBwcm94eSBzdXBwb3J0ICh7MX0pIGFuZCBzeXN0ZW0gY2VydGlmaWNhdGVzICh7Mn0pIGFyZSBhZGRlZCB3aGVuIHRoZSBjb3JyZXNwb25kaW5nIHNldHRpbmdzIGFyZSBlbmFibGVkLiBXaGVuIGR1cmluZyBbcmVtb3RlIGRldmVsb3BtZW50XShodHRwczovL2FrYS5tcy92c2NvZGUtcmVtb3RlKSB0aGUgezB9IHNldHRpbmcgaXMgZGlzYWJsZWQgdGhpcyBzZXR0aW5nIGNhbiBiZSBjb25maWd1cmVkIGluIHRoZSBsb2NhbCBhbmQgdGhlIHJlbW90ZSBzZXR0aW5ncyBzZXBhcmF0ZWx5LlwiLCAnYCNodHRwLnVzZUxvY2FsUHJveHlDb25maWd1cmF0aW9uI2AnLCAnYCNodHRwLnByb3h5U3VwcG9ydCNgJywgJ2AjaHR0cC5zeXN0ZW1DZXJ0aWZpY2F0ZXMjYCcpLFxuXHRcdFx0XHRcdHJlc3RyaWN0ZWQ6IHRydWVcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XTtcblx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LnVwZGF0ZUNvbmZpZ3VyYXRpb25zKHsgYWRkOiBwcm94eUNvbmZpZ3VyYXRpb24sIHJlbW92ZTogb2xkUHJveHlDb25maWd1cmF0aW9uIH0pO1xufVxuXG5yZWdpc3RlclByb3h5Q29uZmlndXJhdGlvbnMoKTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsc0JBQXNCO0FBRS9CLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsa0JBQWtCO0FBRTNCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsb0JBQW9CLGtCQUE4RDtBQUMzRixTQUFTLHVCQUF1QjtBQUVoQyxTQUFTLGdCQUFnQjtBQUVsQixNQUFNLGtCQUFrQixnQkFBaUMsZ0JBQWdCO0FBMkJoRixNQUFNLGdCQUFnQjtBQUFBLEVBSXJCLFlBQTZC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
