import { URI } from "../../../base/common/uri.js";
import { LogLevel as LogServiceLevel } from "../../../platform/log/common/log.js";
import { LogLevel, createHttpPatch, createProxyResolver, createTlsPatch, createNetPatch, loadSystemCertificates } from "@vscode/proxy-agent";
import { createRequire } from "node:module";
import { lookupKerberosAuthorization } from "../../../platform/request/node/requestService.js";
import * as proxyAgent from "@vscode/proxy-agent";
const require2 = createRequire(import.meta.url);
const http = require2("http");
const https = require2("https");
const tls = require2("tls");
const net = require2("net");
const systemCertificatesV2Default = false;
const useElectronFetchDefault = false;
function connectProxyResolver(extHostWorkspace, configProvider, extensionService, extHostLogService, mainThreadTelemetry, initData, disposables) {
  const isRemote = initData.remote.isRemote;
  const useHostProxyDefault = initData.environment.useHostProxy ?? !isRemote;
  const fallbackToLocalKerberos = useHostProxyDefault;
  const loadLocalCertificates = useHostProxyDefault;
  const isUseHostProxyEnabled = () => !isRemote || configProvider.getConfiguration("http").get("useLocalProxyConfiguration", useHostProxyDefault);
  const params = {
    resolveProxy: (url) => extHostWorkspace.resolveProxy(url),
    lookupProxyAuthorization: lookupProxyAuthorization.bind(void 0, extHostWorkspace, extHostLogService, mainThreadTelemetry, configProvider, {}, {}, initData.remote.isRemote, fallbackToLocalKerberos),
    getProxyURL: () => getExtHostConfigValue(configProvider, isRemote, "http.proxy"),
    getProxySupport: () => getExtHostConfigValue(configProvider, isRemote, "http.proxySupport") || "off",
    getNoProxyConfig: () => getExtHostConfigValue(configProvider, isRemote, "http.noProxy") || [],
    isAdditionalFetchSupportEnabled: () => getExtHostConfigValue(configProvider, isRemote, "http.fetchAdditionalSupport", true),
    addCertificatesV1: () => certSettingV1(configProvider, isRemote),
    addCertificatesV2: () => certSettingV2(configProvider, isRemote),
    log: extHostLogService,
    getLogLevel: () => {
      const level = extHostLogService.getLevel();
      switch (level) {
        case LogServiceLevel.Trace:
          return LogLevel.Trace;
        case LogServiceLevel.Debug:
          return LogLevel.Debug;
        case LogServiceLevel.Info:
          return LogLevel.Info;
        case LogServiceLevel.Warning:
          return LogLevel.Warning;
        case LogServiceLevel.Error:
          return LogLevel.Error;
        case LogServiceLevel.Off:
          return LogLevel.Off;
        default:
          return never(level);
      }
      function never(level2) {
        extHostLogService.error("Unknown log level", level2);
        return LogLevel.Debug;
      }
    },
    proxyResolveTelemetry: () => {
    },
    isUseHostProxyEnabled,
    loadAdditionalCertificates: async () => {
      const promises = [];
      if (initData.remote.isRemote) {
        promises.push(loadSystemCertificates({ log: extHostLogService }));
      }
      if (loadLocalCertificates) {
        extHostLogService.trace("ProxyResolver#loadAdditionalCertificates: Loading certificates from main process");
        const certs = extHostWorkspace.loadCertificates();
        certs.then((certs2) => extHostLogService.trace("ProxyResolver#loadAdditionalCertificates: Loaded certificates from main process", certs2.length));
        promises.push(certs);
      }
      if (initData.environment.extensionTestsLocationURI && https.globalAgent.testCertificates?.length) {
        extHostLogService.trace("ProxyResolver#loadAdditionalCertificates: Loading test certificates");
        promises.push(Promise.resolve(https.globalAgent.testCertificates));
      }
      return (await Promise.all(promises)).flat();
    },
    env: process.env
  };
  const { resolveProxyWithRequest, resolveProxyURL } = createProxyResolver(params);
  const target = proxyAgent.default || proxyAgent;
  target.resolveProxyURL = resolveProxyURL;
  patchGlobalFetch(params, configProvider, mainThreadTelemetry, initData, resolveProxyURL, disposables);
  const lookup = createPatchedModules(params, resolveProxyWithRequest);
  return configureModuleLoading(extensionService, lookup);
}
const unsafeHeaders = [
  "content-length",
  "host",
  "trailer",
  "te",
  "upgrade",
  "cookie2",
  "keep-alive",
  "transfer-encoding",
  "set-cookie"
];
function patchGlobalFetch(params, configProvider, mainThreadTelemetry, initData, resolveProxyURL, disposables) {
  if (!globalThis.__vscodeOriginalFetch) {
    const originalFetch = globalThis.fetch;
    globalThis.__vscodeOriginalFetch = originalFetch;
    const patchedFetch = proxyAgent.createFetchPatch(params, originalFetch, resolveProxyURL);
    globalThis.__vscodePatchedFetch = patchedFetch;
    let useElectronFetch = false;
    if (!initData.remote.isRemote) {
      useElectronFetch = configProvider.getConfiguration("http").get("electronFetch", useElectronFetchDefault);
      disposables.add(configProvider.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("http.electronFetch")) {
          useElectronFetch = configProvider.getConfiguration("http").get("electronFetch", useElectronFetchDefault);
        }
      }));
    }
    globalThis.fetch = async function fetch(input, init) {
      function getRequestProperty(name) {
        return init && name in init ? init[name] : typeof input === "object" && "cache" in input ? input[name] : void 0;
      }
      const urlString = typeof input === "string" ? input : "cache" in input ? input.url : input.toString();
      const isDataUrl = urlString.startsWith("data:");
      if (isDataUrl) {
        recordFetchFeatureUse(mainThreadTelemetry, "data");
      }
      const isBlobUrl = urlString.startsWith("blob:");
      if (isBlobUrl) {
        recordFetchFeatureUse(mainThreadTelemetry, "blob");
      }
      const isManualRedirect = getRequestProperty("redirect") === "manual";
      if (isManualRedirect) {
        recordFetchFeatureUse(mainThreadTelemetry, "manualRedirect");
      }
      const integrity = getRequestProperty("integrity");
      if (integrity) {
        recordFetchFeatureUse(mainThreadTelemetry, "integrity");
      }
      if (!useElectronFetch || isDataUrl || isBlobUrl || isManualRedirect || integrity) {
        const response2 = await patchedFetch(input, init);
        monitorResponseProperties(mainThreadTelemetry, response2, urlString);
        return response2;
      }
      if (init?.headers) {
        const headers = new Headers(init.headers);
        for (const header of unsafeHeaders) {
          headers.delete(header);
        }
        init = { ...init, headers };
      }
      const electronInput = input instanceof URL ? input.toString() : input;
      const electron = require2("electron");
      const response = await electron.net.fetch(electronInput, init);
      monitorResponseProperties(mainThreadTelemetry, response, urlString);
      return response;
    };
  }
}
function monitorResponseProperties(mainThreadTelemetry, response, urlString) {
  const originalUrl = response.url;
  Object.defineProperty(response, "url", {
    get() {
      recordFetchFeatureUse(mainThreadTelemetry, "url");
      return originalUrl || urlString;
    }
  });
  const originalType = response.type;
  Object.defineProperty(response, "type", {
    get() {
      recordFetchFeatureUse(mainThreadTelemetry, "typeProperty");
      return originalType !== "default" ? originalType : "basic";
    }
  });
}
const fetchFeatureUse = {
  url: 0,
  typeProperty: 0,
  data: 0,
  blob: 0,
  integrity: 0,
  manualRedirect: 0
};
let timer;
const enableFeatureUseTelemetry = false;
function recordFetchFeatureUse(mainThreadTelemetry, feature) {
  if (enableFeatureUseTelemetry && !fetchFeatureUse[feature]++) {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      mainThreadTelemetry.$publicLog2("fetchFeatureUse", fetchFeatureUse);
    }, 1e4);
    timer.unref();
  }
}
function createPatchedModules(params, resolveProxy) {
  function mergeModules(module, patch) {
    const target = module.default || module;
    target.__vscodeOriginal = Object.assign({}, target);
    return Object.assign(target, patch);
  }
  return {
    http: mergeModules(http, createHttpPatch(params, http, resolveProxy)),
    https: mergeModules(https, createHttpPatch(params, https, resolveProxy)),
    net: mergeModules(net, createNetPatch(params, net)),
    tls: mergeModules(tls, createTlsPatch(params, tls))
  };
}
function certSettingV1(configProvider, isRemote) {
  return !getExtHostConfigValue(configProvider, isRemote, "http.experimental.systemCertificatesV2", systemCertificatesV2Default) && !!getExtHostConfigValue(configProvider, isRemote, "http.systemCertificates");
}
function certSettingV2(configProvider, isRemote) {
  return !!getExtHostConfigValue(configProvider, isRemote, "http.experimental.systemCertificatesV2", systemCertificatesV2Default) && !!getExtHostConfigValue(configProvider, isRemote, "http.systemCertificates");
}
const modulesCache = /* @__PURE__ */ new Map();
function configureModuleLoading(extensionService, lookup) {
  return extensionService.getExtensionPathIndex().then((extensionPaths) => {
    const node_module = require2("module");
    const original = node_module._load;
    node_module._load = function load(request, parent, isMain) {
      if (request === "net") {
        return lookup.net;
      }
      if (request === "tls") {
        return lookup.tls;
      }
      if (request !== "http" && request !== "https" && request !== "undici") {
        return original.apply(this, arguments);
      }
      const ext = extensionPaths.findSubstr(URI.file(parent.filename));
      let cache = modulesCache.get(ext);
      if (!cache) {
        modulesCache.set(ext, cache = {});
      }
      if (!cache[request]) {
        if (request === "undici") {
          const undici = original.apply(this, arguments);
          proxyAgent.patchUndici(undici);
          cache[request] = undici;
        } else {
          const mod = lookup[request];
          cache[request] = { ...mod };
        }
      }
      return cache[request];
    };
  });
}
async function lookupProxyAuthorization(extHostWorkspace, extHostLogService, mainThreadTelemetry, configProvider, proxyAuthenticateCache, basicAuthCache, isRemote, fallbackToLocalKerberos, proxyURL, proxyAuthenticate, state) {
  const cached = proxyAuthenticateCache[proxyURL];
  if (proxyAuthenticate) {
    proxyAuthenticateCache[proxyURL] = proxyAuthenticate;
  }
  extHostLogService.trace("ProxyResolver#lookupProxyAuthorization callback", `proxyURL:${proxyURL}`, `proxyAuthenticate:${proxyAuthenticate}`, `proxyAuthenticateCache:${cached}`);
  const header = proxyAuthenticate || cached;
  const authenticate = Array.isArray(header) ? header : typeof header === "string" ? [header] : [];
  sendTelemetry(mainThreadTelemetry, authenticate, isRemote);
  if (authenticate.some((a) => /^(Negotiate|Kerberos)( |$)/i.test(a)) && !state.kerberosRequested) {
    state.kerberosRequested = true;
    try {
      const spnConfig = getExtHostConfigValue(configProvider, isRemote, "http.proxyKerberosServicePrincipal");
      const response = await lookupKerberosAuthorization(proxyURL, spnConfig, extHostLogService, "ProxyResolver#lookupProxyAuthorization");
      return "Negotiate " + response;
    } catch (err) {
      extHostLogService.debug("ProxyResolver#lookupProxyAuthorization Kerberos authentication failed", err);
    }
    if (isRemote && fallbackToLocalKerberos) {
      extHostLogService.debug("ProxyResolver#lookupProxyAuthorization Kerberos authentication lookup on host", `proxyURL:${proxyURL}`);
      const auth = await extHostWorkspace.lookupKerberosAuthorization(proxyURL);
      if (auth) {
        return "Negotiate " + auth;
      }
    }
  }
  const basicAuthHeader = authenticate.find((a) => /^Basic( |$)/i.test(a));
  if (basicAuthHeader) {
    try {
      const cachedAuth = basicAuthCache[proxyURL];
      if (cachedAuth) {
        if (state.basicAuthCacheUsed) {
          extHostLogService.debug("ProxyResolver#lookupProxyAuthorization Basic authentication deleting cached credentials", `proxyURL:${proxyURL}`);
          delete basicAuthCache[proxyURL];
        } else {
          extHostLogService.debug("ProxyResolver#lookupProxyAuthorization Basic authentication using cached credentials", `proxyURL:${proxyURL}`);
          state.basicAuthCacheUsed = true;
          return cachedAuth;
        }
      }
      state.basicAuthAttempt = (state.basicAuthAttempt || 0) + 1;
      const realm = / realm="([^"]+)"/i.exec(basicAuthHeader)?.[1];
      extHostLogService.debug("ProxyResolver#lookupProxyAuthorization Basic authentication lookup", `proxyURL:${proxyURL}`, `realm:${realm}`);
      const url = new URL(proxyURL);
      const authInfo = {
        scheme: "basic",
        host: url.hostname,
        port: Number(url.port),
        realm: realm || "",
        isProxy: true,
        attempt: state.basicAuthAttempt
      };
      const credentials = await extHostWorkspace.lookupAuthorization(authInfo);
      if (credentials) {
        extHostLogService.debug("ProxyResolver#lookupProxyAuthorization Basic authentication received credentials", `proxyURL:${proxyURL}`, `realm:${realm}`);
        const auth = "Basic " + Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64");
        basicAuthCache[proxyURL] = auth;
        return auth;
      } else {
        extHostLogService.debug("ProxyResolver#lookupProxyAuthorization Basic authentication received no credentials", `proxyURL:${proxyURL}`, `realm:${realm}`);
      }
    } catch (err) {
      extHostLogService.error("ProxyResolver#lookupProxyAuthorization Basic authentication failed", err);
    }
  }
  return void 0;
}
let telemetrySent = false;
const enableProxyAuthenticationTelemetry = false;
function sendTelemetry(mainThreadTelemetry, authenticate, isRemote) {
  if (!enableProxyAuthenticationTelemetry || telemetrySent || !authenticate.length) {
    return;
  }
  telemetrySent = true;
  mainThreadTelemetry.$publicLog2("proxyAuthenticationRequest", {
    authenticationType: authenticate.map((a) => a.split(" ")[0]).join(","),
    extensionHostType: isRemote ? "remote" : "local"
  });
}
function getExtHostConfigValue(configProvider, isRemote, key, fallback) {
  if (isRemote) {
    return configProvider.getConfiguration().get(key) ?? fallback;
  }
  const values = configProvider.getConfiguration().inspect(key);
  return values?.globalLocalValue ?? values?.defaultValue ?? fallback;
}
export {
  connectProxyResolver
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL25vZGUvcHJveHlSZXNvbHZlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElFeHRIb3N0V29ya3NwYWNlUHJvdmlkZXIgfSBmcm9tICcuLi9jb21tb24vZXh0SG9zdFdvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uSW5zcGVjdCwgRXh0SG9zdENvbmZpZ1Byb3ZpZGVyIH0gZnJvbSAnLi4vY29tbW9uL2V4dEhvc3RDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IE1haW5UaHJlYWRUZWxlbWV0cnlTaGFwZSB9IGZyb20gJy4uL2NvbW1vbi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25Ib3N0SW5pdERhdGEgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25Ib3N0UHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgRXh0SG9zdEV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuL2V4dEhvc3RFeHRlbnNpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSwgTG9nTGV2ZWwgYXMgTG9nU2VydmljZUxldmVsIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBMb2dMZXZlbCwgY3JlYXRlSHR0cFBhdGNoLCBjcmVhdGVQcm94eVJlc29sdmVyLCBjcmVhdGVUbHNQYXRjaCwgUHJveHlTdXBwb3J0U2V0dGluZywgUHJveHlBZ2VudFBhcmFtcywgY3JlYXRlTmV0UGF0Y2gsIGxvYWRTeXN0ZW1DZXJ0aWZpY2F0ZXMsIFJlc29sdmVQcm94eVdpdGhSZXF1ZXN0IH0gZnJvbSAnQHZzY29kZS9wcm94eS1hZ2VudCc7XG5pbXBvcnQgeyBBdXRoSW5mbyB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3JlcXVlc3QvY29tbW9uL3JlcXVlc3QuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tICdub2RlOm1vZHVsZSc7XG5pbXBvcnQgdHlwZSAqIGFzIHVuZGljaVR5cGUgZnJvbSAndW5kaWNpLXR5cGVzJztcbmltcG9ydCB0eXBlICogYXMgdGxzVHlwZSBmcm9tICd0bHMnO1xuaW1wb3J0IHsgbG9va3VwS2VyYmVyb3NBdXRob3JpemF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vcmVxdWVzdC9ub2RlL3JlcXVlc3RTZXJ2aWNlLmpzJztcbmltcG9ydCAqIGFzIHByb3h5QWdlbnQgZnJvbSAnQHZzY29kZS9wcm94eS1hZ2VudCc7XG5cbmNvbnN0IHJlcXVpcmUgPSBjcmVhdGVSZXF1aXJlKGltcG9ydC5tZXRhLnVybCk7XG5jb25zdCBodHRwID0gcmVxdWlyZSgnaHR0cCcpO1xuY29uc3QgaHR0cHMgPSByZXF1aXJlKCdodHRwcycpO1xuY29uc3QgdGxzOiB0eXBlb2YgdGxzVHlwZSA9IHJlcXVpcmUoJ3RscycpO1xuY29uc3QgbmV0ID0gcmVxdWlyZSgnbmV0Jyk7XG5cbmNvbnN0IHN5c3RlbUNlcnRpZmljYXRlc1YyRGVmYXVsdCA9IGZhbHNlO1xuY29uc3QgdXNlRWxlY3Ryb25GZXRjaERlZmF1bHQgPSBmYWxzZTtcblxuZXhwb3J0IGZ1bmN0aW9uIGNvbm5lY3RQcm94eVJlc29sdmVyKFxuXHRleHRIb3N0V29ya3NwYWNlOiBJRXh0SG9zdFdvcmtzcGFjZVByb3ZpZGVyLFxuXHRjb25maWdQcm92aWRlcjogRXh0SG9zdENvbmZpZ1Byb3ZpZGVyLFxuXHRleHRlbnNpb25TZXJ2aWNlOiBFeHRIb3N0RXh0ZW5zaW9uU2VydmljZSxcblx0ZXh0SG9zdExvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRtYWluVGhyZWFkVGVsZW1ldHJ5OiBNYWluVGhyZWFkVGVsZW1ldHJ5U2hhcGUsXG5cdGluaXREYXRhOiBJRXh0ZW5zaW9uSG9zdEluaXREYXRhLFxuXHRkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlLFxuKSB7XG5cblx0Y29uc3QgaXNSZW1vdGUgPSBpbml0RGF0YS5yZW1vdGUuaXNSZW1vdGU7XG5cdGNvbnN0IHVzZUhvc3RQcm94eURlZmF1bHQgPSBpbml0RGF0YS5lbnZpcm9ubWVudC51c2VIb3N0UHJveHkgPz8gIWlzUmVtb3RlO1xuXHRjb25zdCBmYWxsYmFja1RvTG9jYWxLZXJiZXJvcyA9IHVzZUhvc3RQcm94eURlZmF1bHQ7XG5cdGNvbnN0IGxvYWRMb2NhbENlcnRpZmljYXRlcyA9IHVzZUhvc3RQcm94eURlZmF1bHQ7XG5cdGNvbnN0IGlzVXNlSG9zdFByb3h5RW5hYmxlZCA9ICgpID0+ICFpc1JlbW90ZSB8fCBjb25maWdQcm92aWRlci5nZXRDb25maWd1cmF0aW9uKCdodHRwJykuZ2V0PGJvb2xlYW4+KCd1c2VMb2NhbFByb3h5Q29uZmlndXJhdGlvbicsIHVzZUhvc3RQcm94eURlZmF1bHQpO1xuXHRjb25zdCBwYXJhbXM6IFByb3h5QWdlbnRQYXJhbXMgPSB7XG5cdFx0cmVzb2x2ZVByb3h5OiB1cmwgPT4gZXh0SG9zdFdvcmtzcGFjZS5yZXNvbHZlUHJveHkodXJsKSxcblx0XHRsb29rdXBQcm94eUF1dGhvcml6YXRpb246IGxvb2t1cFByb3h5QXV0aG9yaXphdGlvbi5iaW5kKHVuZGVmaW5lZCwgZXh0SG9zdFdvcmtzcGFjZSwgZXh0SG9zdExvZ1NlcnZpY2UsIG1haW5UaHJlYWRUZWxlbWV0cnksIGNvbmZpZ1Byb3ZpZGVyLCB7fSwge30sIGluaXREYXRhLnJlbW90ZS5pc1JlbW90ZSwgZmFsbGJhY2tUb0xvY2FsS2VyYmVyb3MpLFxuXHRcdGdldFByb3h5VVJMOiAoKSA9PiBnZXRFeHRIb3N0Q29uZmlnVmFsdWU8c3RyaW5nPihjb25maWdQcm92aWRlciwgaXNSZW1vdGUsICdodHRwLnByb3h5JyksXG5cdFx0Z2V0UHJveHlTdXBwb3J0OiAoKSA9PiBnZXRFeHRIb3N0Q29uZmlnVmFsdWU8UHJveHlTdXBwb3J0U2V0dGluZz4oY29uZmlnUHJvdmlkZXIsIGlzUmVtb3RlLCAnaHR0cC5wcm94eVN1cHBvcnQnKSB8fCAnb2ZmJyxcblx0XHRnZXROb1Byb3h5Q29uZmlnOiAoKSA9PiBnZXRFeHRIb3N0Q29uZmlnVmFsdWU8c3RyaW5nW10+KGNvbmZpZ1Byb3ZpZGVyLCBpc1JlbW90ZSwgJ2h0dHAubm9Qcm94eScpIHx8IFtdLFxuXHRcdGlzQWRkaXRpb25hbEZldGNoU3VwcG9ydEVuYWJsZWQ6ICgpID0+IGdldEV4dEhvc3RDb25maWdWYWx1ZTxib29sZWFuPihjb25maWdQcm92aWRlciwgaXNSZW1vdGUsICdodHRwLmZldGNoQWRkaXRpb25hbFN1cHBvcnQnLCB0cnVlKSxcblx0XHRhZGRDZXJ0aWZpY2F0ZXNWMTogKCkgPT4gY2VydFNldHRpbmdWMShjb25maWdQcm92aWRlciwgaXNSZW1vdGUpLFxuXHRcdGFkZENlcnRpZmljYXRlc1YyOiAoKSA9PiBjZXJ0U2V0dGluZ1YyKGNvbmZpZ1Byb3ZpZGVyLCBpc1JlbW90ZSksXG5cdFx0bG9nOiBleHRIb3N0TG9nU2VydmljZSxcblx0XHRnZXRMb2dMZXZlbDogKCkgPT4ge1xuXHRcdFx0Y29uc3QgbGV2ZWwgPSBleHRIb3N0TG9nU2VydmljZS5nZXRMZXZlbCgpO1xuXHRcdFx0c3dpdGNoIChsZXZlbCkge1xuXHRcdFx0XHRjYXNlIExvZ1NlcnZpY2VMZXZlbC5UcmFjZTogcmV0dXJuIExvZ0xldmVsLlRyYWNlO1xuXHRcdFx0XHRjYXNlIExvZ1NlcnZpY2VMZXZlbC5EZWJ1ZzogcmV0dXJuIExvZ0xldmVsLkRlYnVnO1xuXHRcdFx0XHRjYXNlIExvZ1NlcnZpY2VMZXZlbC5JbmZvOiByZXR1cm4gTG9nTGV2ZWwuSW5mbztcblx0XHRcdFx0Y2FzZSBMb2dTZXJ2aWNlTGV2ZWwuV2FybmluZzogcmV0dXJuIExvZ0xldmVsLldhcm5pbmc7XG5cdFx0XHRcdGNhc2UgTG9nU2VydmljZUxldmVsLkVycm9yOiByZXR1cm4gTG9nTGV2ZWwuRXJyb3I7XG5cdFx0XHRcdGNhc2UgTG9nU2VydmljZUxldmVsLk9mZjogcmV0dXJuIExvZ0xldmVsLk9mZjtcblx0XHRcdFx0ZGVmYXVsdDogcmV0dXJuIG5ldmVyKGxldmVsKTtcblx0XHRcdH1cblx0XHRcdGZ1bmN0aW9uIG5ldmVyKGxldmVsOiBuZXZlcikge1xuXHRcdFx0XHRleHRIb3N0TG9nU2VydmljZS5lcnJvcignVW5rbm93biBsb2cgbGV2ZWwnLCBsZXZlbCk7XG5cdFx0XHRcdHJldHVybiBMb2dMZXZlbC5EZWJ1Zztcblx0XHRcdH1cblx0XHR9LFxuXHRcdHByb3h5UmVzb2x2ZVRlbGVtZXRyeTogKCkgPT4geyB9LFxuXHRcdGlzVXNlSG9zdFByb3h5RW5hYmxlZCxcblx0XHRsb2FkQWRkaXRpb25hbENlcnRpZmljYXRlczogYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHJvbWlzZXM6IFByb21pc2U8c3RyaW5nW10+W10gPSBbXTtcblx0XHRcdGlmIChpbml0RGF0YS5yZW1vdGUuaXNSZW1vdGUpIHtcblx0XHRcdFx0cHJvbWlzZXMucHVzaChsb2FkU3lzdGVtQ2VydGlmaWNhdGVzKHsgbG9nOiBleHRIb3N0TG9nU2VydmljZSB9KSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAobG9hZExvY2FsQ2VydGlmaWNhdGVzKSB7XG5cdFx0XHRcdGV4dEhvc3RMb2dTZXJ2aWNlLnRyYWNlKCdQcm94eVJlc29sdmVyI2xvYWRBZGRpdGlvbmFsQ2VydGlmaWNhdGVzOiBMb2FkaW5nIGNlcnRpZmljYXRlcyBmcm9tIG1haW4gcHJvY2VzcycpO1xuXHRcdFx0XHRjb25zdCBjZXJ0cyA9IGV4dEhvc3RXb3Jrc3BhY2UubG9hZENlcnRpZmljYXRlcygpOyAvLyBMb2FkaW5nIGZyb20gbWFpbiBwcm9jZXNzIHRvIHNoYXJlIGNhY2hlLlxuXHRcdFx0XHRjZXJ0cy50aGVuKGNlcnRzID0+IGV4dEhvc3RMb2dTZXJ2aWNlLnRyYWNlKCdQcm94eVJlc29sdmVyI2xvYWRBZGRpdGlvbmFsQ2VydGlmaWNhdGVzOiBMb2FkZWQgY2VydGlmaWNhdGVzIGZyb20gbWFpbiBwcm9jZXNzJywgY2VydHMubGVuZ3RoKSk7XG5cdFx0XHRcdHByb21pc2VzLnB1c2goY2VydHMpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gVXNpbmcgaHR0cHMuZ2xvYmFsQWdlbnQgYmVjYXVzZSBpdCBpcyBzaGFyZWQgd2l0aCBwcm94eS50ZXN0LnRzIGFuZCBtdXRhYmxlLlxuXHRcdFx0aWYgKGluaXREYXRhLmVudmlyb25tZW50LmV4dGVuc2lvblRlc3RzTG9jYXRpb25VUkkgJiYgKGh0dHBzLmdsb2JhbEFnZW50IGFzIGFueSkudGVzdENlcnRpZmljYXRlcz8ubGVuZ3RoKSB7XG5cdFx0XHRcdGV4dEhvc3RMb2dTZXJ2aWNlLnRyYWNlKCdQcm94eVJlc29sdmVyI2xvYWRBZGRpdGlvbmFsQ2VydGlmaWNhdGVzOiBMb2FkaW5nIHRlc3QgY2VydGlmaWNhdGVzJyk7XG5cdFx0XHRcdHByb21pc2VzLnB1c2goUHJvbWlzZS5yZXNvbHZlKChodHRwcy5nbG9iYWxBZ2VudCBhcyBhbnkpLnRlc3RDZXJ0aWZpY2F0ZXMgYXMgc3RyaW5nW10pKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiAoYXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpKS5mbGF0KCk7XG5cdFx0fSxcblx0XHRlbnY6IHByb2Nlc3MuZW52LFxuXHR9O1xuXHRjb25zdCB7IHJlc29sdmVQcm94eVdpdGhSZXF1ZXN0LCByZXNvbHZlUHJveHlVUkwgfSA9IGNyZWF0ZVByb3h5UmVzb2x2ZXIocGFyYW1zKTtcblx0Y29uc3QgdGFyZ2V0ID0gKHByb3h5QWdlbnQgYXMgYW55KS5kZWZhdWx0IHx8IHByb3h5QWdlbnQ7XG5cdHRhcmdldC5yZXNvbHZlUHJveHlVUkwgPSByZXNvbHZlUHJveHlVUkw7XG5cblx0cGF0Y2hHbG9iYWxGZXRjaChwYXJhbXMsIGNvbmZpZ1Byb3ZpZGVyLCBtYWluVGhyZWFkVGVsZW1ldHJ5LCBpbml0RGF0YSwgcmVzb2x2ZVByb3h5VVJMLCBkaXNwb3NhYmxlcyk7XG5cblx0Y29uc3QgbG9va3VwID0gY3JlYXRlUGF0Y2hlZE1vZHVsZXMocGFyYW1zLCByZXNvbHZlUHJveHlXaXRoUmVxdWVzdCk7XG5cdHJldHVybiBjb25maWd1cmVNb2R1bGVMb2FkaW5nKGV4dGVuc2lvblNlcnZpY2UsIGxvb2t1cCk7XG59XG5cbmNvbnN0IHVuc2FmZUhlYWRlcnMgPSBbXG5cdCdjb250ZW50LWxlbmd0aCcsXG5cdCdob3N0Jyxcblx0J3RyYWlsZXInLFxuXHQndGUnLFxuXHQndXBncmFkZScsXG5cdCdjb29raWUyJyxcblx0J2tlZXAtYWxpdmUnLFxuXHQndHJhbnNmZXItZW5jb2RpbmcnLFxuXHQnc2V0LWNvb2tpZScsXG5dO1xuXG5mdW5jdGlvbiBwYXRjaEdsb2JhbEZldGNoKHBhcmFtczogUHJveHlBZ2VudFBhcmFtcywgY29uZmlnUHJvdmlkZXI6IEV4dEhvc3RDb25maWdQcm92aWRlciwgbWFpblRocmVhZFRlbGVtZXRyeTogTWFpblRocmVhZFRlbGVtZXRyeVNoYXBlLCBpbml0RGF0YTogSUV4dGVuc2lvbkhvc3RJbml0RGF0YSwgcmVzb2x2ZVByb3h5VVJMOiAodXJsOiBzdHJpbmcpID0+IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiwgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSkge1xuXHRpZiAoIShnbG9iYWxUaGlzIGFzIGFueSkuX192c2NvZGVPcmlnaW5hbEZldGNoKSB7XG5cdFx0Y29uc3Qgb3JpZ2luYWxGZXRjaCA9IGdsb2JhbFRoaXMuZmV0Y2g7XG5cdFx0KGdsb2JhbFRoaXMgYXMgYW55KS5fX3ZzY29kZU9yaWdpbmFsRmV0Y2ggPSBvcmlnaW5hbEZldGNoO1xuXHRcdGNvbnN0IHBhdGNoZWRGZXRjaCA9IHByb3h5QWdlbnQuY3JlYXRlRmV0Y2hQYXRjaChwYXJhbXMsIG9yaWdpbmFsRmV0Y2gsIHJlc29sdmVQcm94eVVSTCk7XG5cdFx0KGdsb2JhbFRoaXMgYXMgYW55KS5fX3ZzY29kZVBhdGNoZWRGZXRjaCA9IHBhdGNoZWRGZXRjaDtcblx0XHRsZXQgdXNlRWxlY3Ryb25GZXRjaCA9IGZhbHNlO1xuXHRcdGlmICghaW5pdERhdGEucmVtb3RlLmlzUmVtb3RlKSB7XG5cdFx0XHR1c2VFbGVjdHJvbkZldGNoID0gY29uZmlnUHJvdmlkZXIuZ2V0Q29uZmlndXJhdGlvbignaHR0cCcpLmdldDxib29sZWFuPignZWxlY3Ryb25GZXRjaCcsIHVzZUVsZWN0cm9uRmV0Y2hEZWZhdWx0KTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChjb25maWdQcm92aWRlci5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdodHRwLmVsZWN0cm9uRmV0Y2gnKSkge1xuXHRcdFx0XHRcdHVzZUVsZWN0cm9uRmV0Y2ggPSBjb25maWdQcm92aWRlci5nZXRDb25maWd1cmF0aW9uKCdodHRwJykuZ2V0PGJvb2xlYW4+KCdlbGVjdHJvbkZldGNoJywgdXNlRWxlY3Ryb25GZXRjaERlZmF1bHQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHRcdC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9GZXRjaF9BUElcblx0XHRnbG9iYWxUaGlzLmZldGNoID0gYXN5bmMgZnVuY3Rpb24gZmV0Y2goaW5wdXQ6IHN0cmluZyB8IFVSTCB8IFJlcXVlc3QsIGluaXQ/OiBSZXF1ZXN0SW5pdCkge1xuXHRcdFx0ZnVuY3Rpb24gZ2V0UmVxdWVzdFByb3BlcnR5KG5hbWU6IGtleW9mIFJlcXVlc3QgJiBrZXlvZiBSZXF1ZXN0SW5pdCkge1xuXHRcdFx0XHRyZXR1cm4gaW5pdCAmJiBuYW1lIGluIGluaXQgPyBpbml0W25hbWVdIDogdHlwZW9mIGlucHV0ID09PSAnb2JqZWN0JyAmJiAnY2FjaGUnIGluIGlucHV0ID8gaW5wdXRbbmFtZV0gOiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHQvLyBMaW1pdGF0aW9uczogaHR0cHM6Ly9naXRodWIuY29tL2VsZWN0cm9uL2VsZWN0cm9uL3B1bGwvMzY3MzMjaXNzdWVjb21tZW50LTE0MDU2MTU0OTRcblx0XHRcdC8vIG5ldC5mZXRjaCBmYWlscyBvbiBtYW51YWwgcmVkaXJlY3Q6IGh0dHBzOi8vZ2l0aHViLmNvbS9lbGVjdHJvbi9lbGVjdHJvbi9pc3N1ZXMvNDM3MTVcblx0XHRcdGNvbnN0IHVybFN0cmluZyA9IHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycgPyBpbnB1dCA6ICdjYWNoZScgaW4gaW5wdXQgPyBpbnB1dC51cmwgOiBpbnB1dC50b1N0cmluZygpO1xuXHRcdFx0Y29uc3QgaXNEYXRhVXJsID0gdXJsU3RyaW5nLnN0YXJ0c1dpdGgoJ2RhdGE6Jyk7XG5cdFx0XHRpZiAoaXNEYXRhVXJsKSB7XG5cdFx0XHRcdHJlY29yZEZldGNoRmVhdHVyZVVzZShtYWluVGhyZWFkVGVsZW1ldHJ5LCAnZGF0YScpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaXNCbG9iVXJsID0gdXJsU3RyaW5nLnN0YXJ0c1dpdGgoJ2Jsb2I6Jyk7XG5cdFx0XHRpZiAoaXNCbG9iVXJsKSB7XG5cdFx0XHRcdHJlY29yZEZldGNoRmVhdHVyZVVzZShtYWluVGhyZWFkVGVsZW1ldHJ5LCAnYmxvYicpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaXNNYW51YWxSZWRpcmVjdCA9IGdldFJlcXVlc3RQcm9wZXJ0eSgncmVkaXJlY3QnKSA9PT0gJ21hbnVhbCc7XG5cdFx0XHRpZiAoaXNNYW51YWxSZWRpcmVjdCkge1xuXHRcdFx0XHRyZWNvcmRGZXRjaEZlYXR1cmVVc2UobWFpblRocmVhZFRlbGVtZXRyeSwgJ21hbnVhbFJlZGlyZWN0Jyk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBpbnRlZ3JpdHkgPSBnZXRSZXF1ZXN0UHJvcGVydHkoJ2ludGVncml0eScpO1xuXHRcdFx0aWYgKGludGVncml0eSkge1xuXHRcdFx0XHRyZWNvcmRGZXRjaEZlYXR1cmVVc2UobWFpblRocmVhZFRlbGVtZXRyeSwgJ2ludGVncml0eScpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCF1c2VFbGVjdHJvbkZldGNoIHx8IGlzRGF0YVVybCB8fCBpc0Jsb2JVcmwgfHwgaXNNYW51YWxSZWRpcmVjdCB8fCBpbnRlZ3JpdHkpIHtcblx0XHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBwYXRjaGVkRmV0Y2goaW5wdXQsIGluaXQpO1xuXHRcdFx0XHRtb25pdG9yUmVzcG9uc2VQcm9wZXJ0aWVzKG1haW5UaHJlYWRUZWxlbWV0cnksIHJlc3BvbnNlLCB1cmxTdHJpbmcpO1xuXHRcdFx0XHRyZXR1cm4gcmVzcG9uc2U7XG5cdFx0XHR9XG5cdFx0XHQvLyBVbnN1cHBvcnRlZCBoZWFkZXJzOiBodHRwczovL3NvdXJjZS5jaHJvbWl1bS5vcmcvY2hyb21pdW0vY2hyb21pdW0vc3JjLysvbWFpbjpzZXJ2aWNlcy9uZXR3b3JrL3B1YmxpYy9jcHAvaGVhZGVyX3V0aWwuY2M7bD0zMjtkcmM9ZWU3Mjk5Zjg5NjFhMWIwNWEzNTU0ZWZjYzQ5NmI2ZGFhMGQ3ZjZlMVxuXHRcdFx0aWYgKGluaXQ/LmhlYWRlcnMpIHtcblx0XHRcdFx0Y29uc3QgaGVhZGVycyA9IG5ldyBIZWFkZXJzKGluaXQuaGVhZGVycyk7XG5cdFx0XHRcdGZvciAoY29uc3QgaGVhZGVyIG9mIHVuc2FmZUhlYWRlcnMpIHtcblx0XHRcdFx0XHRoZWFkZXJzLmRlbGV0ZShoZWFkZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGluaXQgPSB7IC4uLmluaXQsIGhlYWRlcnMgfTtcblx0XHRcdH1cblx0XHRcdC8vIFN1cHBvcnQgZm9yIFVSTDogaHR0cHM6Ly9naXRodWIuY29tL2VsZWN0cm9uL2VsZWN0cm9uL2lzc3Vlcy80MzcxMlxuXHRcdFx0Y29uc3QgZWxlY3Ryb25JbnB1dCA9IGlucHV0IGluc3RhbmNlb2YgVVJMID8gaW5wdXQudG9TdHJpbmcoKSA6IGlucHV0O1xuXHRcdFx0Y29uc3QgZWxlY3Ryb24gPSByZXF1aXJlKCdlbGVjdHJvbicpO1xuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBlbGVjdHJvbi5uZXQuZmV0Y2goZWxlY3Ryb25JbnB1dCwgaW5pdCk7XG5cdFx0XHRtb25pdG9yUmVzcG9uc2VQcm9wZXJ0aWVzKG1haW5UaHJlYWRUZWxlbWV0cnksIHJlc3BvbnNlLCB1cmxTdHJpbmcpO1xuXHRcdFx0cmV0dXJuIHJlc3BvbnNlO1xuXHRcdH07XG5cdH1cbn1cblxuZnVuY3Rpb24gbW9uaXRvclJlc3BvbnNlUHJvcGVydGllcyhtYWluVGhyZWFkVGVsZW1ldHJ5OiBNYWluVGhyZWFkVGVsZW1ldHJ5U2hhcGUsIHJlc3BvbnNlOiBSZXNwb25zZSwgdXJsU3RyaW5nOiBzdHJpbmcpIHtcblx0Y29uc3Qgb3JpZ2luYWxVcmwgPSByZXNwb25zZS51cmw7XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShyZXNwb25zZSwgJ3VybCcsIHtcblx0XHRnZXQoKSB7XG5cdFx0XHRyZWNvcmRGZXRjaEZlYXR1cmVVc2UobWFpblRocmVhZFRlbGVtZXRyeSwgJ3VybCcpO1xuXHRcdFx0cmV0dXJuIG9yaWdpbmFsVXJsIHx8IHVybFN0cmluZztcblx0XHR9XG5cdH0pO1xuXHRjb25zdCBvcmlnaW5hbFR5cGUgPSByZXNwb25zZS50eXBlO1xuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkocmVzcG9uc2UsICd0eXBlJywge1xuXHRcdGdldCgpIHtcblx0XHRcdHJlY29yZEZldGNoRmVhdHVyZVVzZShtYWluVGhyZWFkVGVsZW1ldHJ5LCAndHlwZVByb3BlcnR5Jyk7XG5cdFx0XHRyZXR1cm4gb3JpZ2luYWxUeXBlICE9PSAnZGVmYXVsdCcgPyBvcmlnaW5hbFR5cGUgOiAnYmFzaWMnO1xuXHRcdH1cblx0fSk7XG59XG5cbnR5cGUgRmV0Y2hGZWF0dXJlVXNlQ2xhc3NpZmljYXRpb24gPSB7XG5cdG93bmVyOiAnY2hybWFydGknO1xuXHRjb21tZW50OiAnRGF0YSBhYm91dCBmZXRjaCBBUEkgdXNlJztcblx0dXJsOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnV2hldGhlciB0aGUgdXJsIHByb3BlcnR5IHdhcyB1c2VkLicgfTtcblx0dHlwZVByb3BlcnR5OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnV2hldGhlciB0aGUgdHlwZSBwcm9wZXJ0eSB3YXMgdXNlZC4nIH07XG5cdGRhdGE6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdXaGV0aGVyIGEgZGF0YSBVUkwgd2FzIHVzZWQuJyB9O1xuXHRibG9iOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnV2hldGhlciBhIGJsb2IgVVJMIHdhcyB1c2VkLicgfTtcblx0aW50ZWdyaXR5OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnV2hldGhlciB0aGUgaW50ZWdyaXR5IHByb3BlcnR5IHdhcyB1c2VkLicgfTtcblx0bWFudWFsUmVkaXJlY3Q6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdXaGV0aGVyIGEgbWFudWFsIHJlZGlyZWN0IHdhcyB1c2VkLicgfTtcbn07XG5cbnR5cGUgRmV0Y2hGZWF0dXJlVXNlRXZlbnQgPSB7XG5cdHVybDogbnVtYmVyO1xuXHR0eXBlUHJvcGVydHk6IG51bWJlcjtcblx0ZGF0YTogbnVtYmVyO1xuXHRibG9iOiBudW1iZXI7XG5cdGludGVncml0eTogbnVtYmVyO1xuXHRtYW51YWxSZWRpcmVjdDogbnVtYmVyO1xufTtcblxuY29uc3QgZmV0Y2hGZWF0dXJlVXNlOiBGZXRjaEZlYXR1cmVVc2VFdmVudCA9IHtcblx0dXJsOiAwLFxuXHR0eXBlUHJvcGVydHk6IDAsXG5cdGRhdGE6IDAsXG5cdGJsb2I6IDAsXG5cdGludGVncml0eTogMCxcblx0bWFudWFsUmVkaXJlY3Q6IDAsXG59O1xuXG5sZXQgdGltZXI6IE5vZGVKUy5UaW1lb3V0IHwgdW5kZWZpbmVkO1xuY29uc3QgZW5hYmxlRmVhdHVyZVVzZVRlbGVtZXRyeSA9IGZhbHNlO1xuZnVuY3Rpb24gcmVjb3JkRmV0Y2hGZWF0dXJlVXNlKG1haW5UaHJlYWRUZWxlbWV0cnk6IE1haW5UaHJlYWRUZWxlbWV0cnlTaGFwZSwgZmVhdHVyZToga2V5b2YgdHlwZW9mIGZldGNoRmVhdHVyZVVzZSkge1xuXHRpZiAoZW5hYmxlRmVhdHVyZVVzZVRlbGVtZXRyeSAmJiAhZmV0Y2hGZWF0dXJlVXNlW2ZlYXR1cmVdKyspIHtcblx0XHRpZiAodGltZXIpIHtcblx0XHRcdGNsZWFyVGltZW91dCh0aW1lcik7XG5cdFx0fVxuXHRcdHRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRtYWluVGhyZWFkVGVsZW1ldHJ5LiRwdWJsaWNMb2cyPEZldGNoRmVhdHVyZVVzZUV2ZW50LCBGZXRjaEZlYXR1cmVVc2VDbGFzc2lmaWNhdGlvbj4oJ2ZldGNoRmVhdHVyZVVzZScsIGZldGNoRmVhdHVyZVVzZSk7XG5cdFx0fSwgMTAwMDApOyAvLyBjb2xsZWN0IGFkZGl0aW9uYWwgZmVhdHVyZXMgZm9yIDEwIHNlY29uZHNcblx0XHR0aW1lci51bnJlZigpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVBhdGNoZWRNb2R1bGVzKHBhcmFtczogUHJveHlBZ2VudFBhcmFtcywgcmVzb2x2ZVByb3h5OiBSZXNvbHZlUHJveHlXaXRoUmVxdWVzdCkge1xuXG5cdGZ1bmN0aW9uIG1lcmdlTW9kdWxlcyhtb2R1bGU6IGFueSwgcGF0Y2g6IGFueSkge1xuXHRcdGNvbnN0IHRhcmdldCA9IG1vZHVsZS5kZWZhdWx0IHx8IG1vZHVsZTtcblx0XHR0YXJnZXQuX192c2NvZGVPcmlnaW5hbCA9IE9iamVjdC5hc3NpZ24oe30sIHRhcmdldCk7XG5cdFx0cmV0dXJuIE9iamVjdC5hc3NpZ24odGFyZ2V0LCBwYXRjaCk7XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGh0dHA6IG1lcmdlTW9kdWxlcyhodHRwLCBjcmVhdGVIdHRwUGF0Y2gocGFyYW1zLCBodHRwLCByZXNvbHZlUHJveHkpKSxcblx0XHRodHRwczogbWVyZ2VNb2R1bGVzKGh0dHBzLCBjcmVhdGVIdHRwUGF0Y2gocGFyYW1zLCBodHRwcywgcmVzb2x2ZVByb3h5KSksXG5cdFx0bmV0OiBtZXJnZU1vZHVsZXMobmV0LCBjcmVhdGVOZXRQYXRjaChwYXJhbXMsIG5ldCkpLFxuXHRcdHRsczogbWVyZ2VNb2R1bGVzKHRscywgY3JlYXRlVGxzUGF0Y2gocGFyYW1zLCB0bHMpKVxuXHR9O1xufVxuXG5mdW5jdGlvbiBjZXJ0U2V0dGluZ1YxKGNvbmZpZ1Byb3ZpZGVyOiBFeHRIb3N0Q29uZmlnUHJvdmlkZXIsIGlzUmVtb3RlOiBib29sZWFuKSB7XG5cdHJldHVybiAhZ2V0RXh0SG9zdENvbmZpZ1ZhbHVlPGJvb2xlYW4+KGNvbmZpZ1Byb3ZpZGVyLCBpc1JlbW90ZSwgJ2h0dHAuZXhwZXJpbWVudGFsLnN5c3RlbUNlcnRpZmljYXRlc1YyJywgc3lzdGVtQ2VydGlmaWNhdGVzVjJEZWZhdWx0KSAmJiAhIWdldEV4dEhvc3RDb25maWdWYWx1ZTxib29sZWFuPihjb25maWdQcm92aWRlciwgaXNSZW1vdGUsICdodHRwLnN5c3RlbUNlcnRpZmljYXRlcycpO1xufVxuXG5mdW5jdGlvbiBjZXJ0U2V0dGluZ1YyKGNvbmZpZ1Byb3ZpZGVyOiBFeHRIb3N0Q29uZmlnUHJvdmlkZXIsIGlzUmVtb3RlOiBib29sZWFuKSB7XG5cdHJldHVybiAhIWdldEV4dEhvc3RDb25maWdWYWx1ZTxib29sZWFuPihjb25maWdQcm92aWRlciwgaXNSZW1vdGUsICdodHRwLmV4cGVyaW1lbnRhbC5zeXN0ZW1DZXJ0aWZpY2F0ZXNWMicsIHN5c3RlbUNlcnRpZmljYXRlc1YyRGVmYXVsdCkgJiYgISFnZXRFeHRIb3N0Q29uZmlnVmFsdWU8Ym9vbGVhbj4oY29uZmlnUHJvdmlkZXIsIGlzUmVtb3RlLCAnaHR0cC5zeXN0ZW1DZXJ0aWZpY2F0ZXMnKTtcbn1cblxuY29uc3QgbW9kdWxlc0NhY2hlID0gbmV3IE1hcDxJRXh0ZW5zaW9uRGVzY3JpcHRpb24gfCB1bmRlZmluZWQsIHsgaHR0cD86IHR5cGVvZiBodHRwOyBodHRwcz86IHR5cGVvZiBodHRwczsgdW5kaWNpPzogdHlwZW9mIHVuZGljaVR5cGUgfT4oKTtcbmZ1bmN0aW9uIGNvbmZpZ3VyZU1vZHVsZUxvYWRpbmcoZXh0ZW5zaW9uU2VydmljZTogRXh0SG9zdEV4dGVuc2lvblNlcnZpY2UsIGxvb2t1cDogUmV0dXJuVHlwZTx0eXBlb2YgY3JlYXRlUGF0Y2hlZE1vZHVsZXM+KTogUHJvbWlzZTx2b2lkPiB7XG5cdHJldHVybiBleHRlbnNpb25TZXJ2aWNlLmdldEV4dGVuc2lvblBhdGhJbmRleCgpXG5cdFx0LnRoZW4oZXh0ZW5zaW9uUGF0aHMgPT4ge1xuXHRcdFx0Y29uc3Qgbm9kZV9tb2R1bGUgPSByZXF1aXJlKCdtb2R1bGUnKTtcblx0XHRcdGNvbnN0IG9yaWdpbmFsID0gbm9kZV9tb2R1bGUuX2xvYWQ7XG5cdFx0XHRub2RlX21vZHVsZS5fbG9hZCA9IGZ1bmN0aW9uIGxvYWQocmVxdWVzdDogc3RyaW5nLCBwYXJlbnQ6IHsgZmlsZW5hbWU6IHN0cmluZyB9LCBpc01haW46IGJvb2xlYW4pIHtcblx0XHRcdFx0aWYgKHJlcXVlc3QgPT09ICduZXQnKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGxvb2t1cC5uZXQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAocmVxdWVzdCA9PT0gJ3RscycpIHtcblx0XHRcdFx0XHRyZXR1cm4gbG9va3VwLnRscztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChyZXF1ZXN0ICE9PSAnaHR0cCcgJiYgcmVxdWVzdCAhPT0gJ2h0dHBzJyAmJiByZXF1ZXN0ICE9PSAndW5kaWNpJykge1xuXHRcdFx0XHRcdHJldHVybiBvcmlnaW5hbC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgZXh0ID0gZXh0ZW5zaW9uUGF0aHMuZmluZFN1YnN0cihVUkkuZmlsZShwYXJlbnQuZmlsZW5hbWUpKTtcblx0XHRcdFx0bGV0IGNhY2hlID0gbW9kdWxlc0NhY2hlLmdldChleHQpO1xuXHRcdFx0XHRpZiAoIWNhY2hlKSB7XG5cdFx0XHRcdFx0bW9kdWxlc0NhY2hlLnNldChleHQsIGNhY2hlID0ge30pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghY2FjaGVbcmVxdWVzdF0pIHtcblx0XHRcdFx0XHRpZiAocmVxdWVzdCA9PT0gJ3VuZGljaScpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHVuZGljaSA9IG9yaWdpbmFsLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cdFx0XHRcdFx0XHRwcm94eUFnZW50LnBhdGNoVW5kaWNpKHVuZGljaSk7XG5cdFx0XHRcdFx0XHRjYWNoZVtyZXF1ZXN0XSA9IHVuZGljaTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Y29uc3QgbW9kID0gbG9va3VwW3JlcXVlc3RdO1xuXHRcdFx0XHRcdFx0Y2FjaGVbcmVxdWVzdF0gPSA8YW55PnsgLi4ubW9kIH07IC8vIENvcHkgdG8gd29yayBhcm91bmQgIzkzMTY3LlxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gY2FjaGVbcmVxdWVzdF07XG5cdFx0XHR9O1xuXHRcdH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBsb29rdXBQcm94eUF1dGhvcml6YXRpb24oXG5cdGV4dEhvc3RXb3Jrc3BhY2U6IElFeHRIb3N0V29ya3NwYWNlUHJvdmlkZXIsXG5cdGV4dEhvc3RMb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0bWFpblRocmVhZFRlbGVtZXRyeTogTWFpblRocmVhZFRlbGVtZXRyeVNoYXBlLFxuXHRjb25maWdQcm92aWRlcjogRXh0SG9zdENvbmZpZ1Byb3ZpZGVyLFxuXHRwcm94eUF1dGhlbnRpY2F0ZUNhY2hlOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmcgfCBzdHJpbmdbXSB8IHVuZGVmaW5lZD4sXG5cdGJhc2ljQXV0aENhY2hlOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmcgfCB1bmRlZmluZWQ+LFxuXHRpc1JlbW90ZTogYm9vbGVhbixcblx0ZmFsbGJhY2tUb0xvY2FsS2VyYmVyb3M6IGJvb2xlYW4sXG5cdHByb3h5VVJMOiBzdHJpbmcsXG5cdHByb3h5QXV0aGVudGljYXRlOiBzdHJpbmcgfCBzdHJpbmdbXSB8IHVuZGVmaW5lZCxcblx0c3RhdGU6IHsga2VyYmVyb3NSZXF1ZXN0ZWQ/OiBib29sZWFuOyBiYXNpY0F1dGhDYWNoZVVzZWQ/OiBib29sZWFuOyBiYXNpY0F1dGhBdHRlbXB0PzogbnVtYmVyIH1cbik6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cdGNvbnN0IGNhY2hlZCA9IHByb3h5QXV0aGVudGljYXRlQ2FjaGVbcHJveHlVUkxdO1xuXHRpZiAocHJveHlBdXRoZW50aWNhdGUpIHtcblx0XHRwcm94eUF1dGhlbnRpY2F0ZUNhY2hlW3Byb3h5VVJMXSA9IHByb3h5QXV0aGVudGljYXRlO1xuXHR9XG5cdGV4dEhvc3RMb2dTZXJ2aWNlLnRyYWNlKCdQcm94eVJlc29sdmVyI2xvb2t1cFByb3h5QXV0aG9yaXphdGlvbiBjYWxsYmFjaycsIGBwcm94eVVSTDoke3Byb3h5VVJMfWAsIGBwcm94eUF1dGhlbnRpY2F0ZToke3Byb3h5QXV0aGVudGljYXRlfWAsIGBwcm94eUF1dGhlbnRpY2F0ZUNhY2hlOiR7Y2FjaGVkfWApO1xuXHRjb25zdCBoZWFkZXIgPSBwcm94eUF1dGhlbnRpY2F0ZSB8fCBjYWNoZWQ7XG5cdGNvbnN0IGF1dGhlbnRpY2F0ZSA9IEFycmF5LmlzQXJyYXkoaGVhZGVyKSA/IGhlYWRlciA6IHR5cGVvZiBoZWFkZXIgPT09ICdzdHJpbmcnID8gW2hlYWRlcl0gOiBbXTtcblx0c2VuZFRlbGVtZXRyeShtYWluVGhyZWFkVGVsZW1ldHJ5LCBhdXRoZW50aWNhdGUsIGlzUmVtb3RlKTtcblx0aWYgKGF1dGhlbnRpY2F0ZS5zb21lKGEgPT4gL14oTmVnb3RpYXRlfEtlcmJlcm9zKSggfCQpL2kudGVzdChhKSkgJiYgIXN0YXRlLmtlcmJlcm9zUmVxdWVzdGVkKSB7XG5cdFx0c3RhdGUua2VyYmVyb3NSZXF1ZXN0ZWQgPSB0cnVlO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHNwbkNvbmZpZyA9IGdldEV4dEhvc3RDb25maWdWYWx1ZTxzdHJpbmc+KGNvbmZpZ1Byb3ZpZGVyLCBpc1JlbW90ZSwgJ2h0dHAucHJveHlLZXJiZXJvc1NlcnZpY2VQcmluY2lwYWwnKTtcblx0XHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgbG9va3VwS2VyYmVyb3NBdXRob3JpemF0aW9uKHByb3h5VVJMLCBzcG5Db25maWcsIGV4dEhvc3RMb2dTZXJ2aWNlLCAnUHJveHlSZXNvbHZlciNsb29rdXBQcm94eUF1dGhvcml6YXRpb24nKTtcblx0XHRcdHJldHVybiAnTmVnb3RpYXRlICcgKyByZXNwb25zZTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdGV4dEhvc3RMb2dTZXJ2aWNlLmRlYnVnKCdQcm94eVJlc29sdmVyI2xvb2t1cFByb3h5QXV0aG9yaXphdGlvbiBLZXJiZXJvcyBhdXRoZW50aWNhdGlvbiBmYWlsZWQnLCBlcnIpO1xuXHRcdH1cblxuXHRcdGlmIChpc1JlbW90ZSAmJiBmYWxsYmFja1RvTG9jYWxLZXJiZXJvcykge1xuXHRcdFx0ZXh0SG9zdExvZ1NlcnZpY2UuZGVidWcoJ1Byb3h5UmVzb2x2ZXIjbG9va3VwUHJveHlBdXRob3JpemF0aW9uIEtlcmJlcm9zIGF1dGhlbnRpY2F0aW9uIGxvb2t1cCBvbiBob3N0JywgYHByb3h5VVJMOiR7cHJveHlVUkx9YCk7XG5cdFx0XHRjb25zdCBhdXRoID0gYXdhaXQgZXh0SG9zdFdvcmtzcGFjZS5sb29rdXBLZXJiZXJvc0F1dGhvcml6YXRpb24ocHJveHlVUkwpO1xuXHRcdFx0aWYgKGF1dGgpIHtcblx0XHRcdFx0cmV0dXJuICdOZWdvdGlhdGUgJyArIGF1dGg7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGNvbnN0IGJhc2ljQXV0aEhlYWRlciA9IGF1dGhlbnRpY2F0ZS5maW5kKGEgPT4gL15CYXNpYyggfCQpL2kudGVzdChhKSk7XG5cdGlmIChiYXNpY0F1dGhIZWFkZXIpIHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgY2FjaGVkQXV0aCA9IGJhc2ljQXV0aENhY2hlW3Byb3h5VVJMXTtcblx0XHRcdGlmIChjYWNoZWRBdXRoKSB7XG5cdFx0XHRcdGlmIChzdGF0ZS5iYXNpY0F1dGhDYWNoZVVzZWQpIHtcblx0XHRcdFx0XHRleHRIb3N0TG9nU2VydmljZS5kZWJ1ZygnUHJveHlSZXNvbHZlciNsb29rdXBQcm94eUF1dGhvcml6YXRpb24gQmFzaWMgYXV0aGVudGljYXRpb24gZGVsZXRpbmcgY2FjaGVkIGNyZWRlbnRpYWxzJywgYHByb3h5VVJMOiR7cHJveHlVUkx9YCk7XG5cdFx0XHRcdFx0ZGVsZXRlIGJhc2ljQXV0aENhY2hlW3Byb3h5VVJMXTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRleHRIb3N0TG9nU2VydmljZS5kZWJ1ZygnUHJveHlSZXNvbHZlciNsb29rdXBQcm94eUF1dGhvcml6YXRpb24gQmFzaWMgYXV0aGVudGljYXRpb24gdXNpbmcgY2FjaGVkIGNyZWRlbnRpYWxzJywgYHByb3h5VVJMOiR7cHJveHlVUkx9YCk7XG5cdFx0XHRcdFx0c3RhdGUuYmFzaWNBdXRoQ2FjaGVVc2VkID0gdHJ1ZTtcblx0XHRcdFx0XHRyZXR1cm4gY2FjaGVkQXV0aDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0c3RhdGUuYmFzaWNBdXRoQXR0ZW1wdCA9IChzdGF0ZS5iYXNpY0F1dGhBdHRlbXB0IHx8IDApICsgMTtcblx0XHRcdGNvbnN0IHJlYWxtID0gLyByZWFsbT1cIihbXlwiXSspXCIvaS5leGVjKGJhc2ljQXV0aEhlYWRlcik/LlsxXTtcblx0XHRcdGV4dEhvc3RMb2dTZXJ2aWNlLmRlYnVnKCdQcm94eVJlc29sdmVyI2xvb2t1cFByb3h5QXV0aG9yaXphdGlvbiBCYXNpYyBhdXRoZW50aWNhdGlvbiBsb29rdXAnLCBgcHJveHlVUkw6JHtwcm94eVVSTH1gLCBgcmVhbG06JHtyZWFsbX1gKTtcblx0XHRcdGNvbnN0IHVybCA9IG5ldyBVUkwocHJveHlVUkwpO1xuXHRcdFx0Y29uc3QgYXV0aEluZm86IEF1dGhJbmZvID0ge1xuXHRcdFx0XHRzY2hlbWU6ICdiYXNpYycsXG5cdFx0XHRcdGhvc3Q6IHVybC5ob3N0bmFtZSxcblx0XHRcdFx0cG9ydDogTnVtYmVyKHVybC5wb3J0KSxcblx0XHRcdFx0cmVhbG06IHJlYWxtIHx8ICcnLFxuXHRcdFx0XHRpc1Byb3h5OiB0cnVlLFxuXHRcdFx0XHRhdHRlbXB0OiBzdGF0ZS5iYXNpY0F1dGhBdHRlbXB0LFxuXHRcdFx0fTtcblx0XHRcdGNvbnN0IGNyZWRlbnRpYWxzID0gYXdhaXQgZXh0SG9zdFdvcmtzcGFjZS5sb29rdXBBdXRob3JpemF0aW9uKGF1dGhJbmZvKTtcblx0XHRcdGlmIChjcmVkZW50aWFscykge1xuXHRcdFx0XHRleHRIb3N0TG9nU2VydmljZS5kZWJ1ZygnUHJveHlSZXNvbHZlciNsb29rdXBQcm94eUF1dGhvcml6YXRpb24gQmFzaWMgYXV0aGVudGljYXRpb24gcmVjZWl2ZWQgY3JlZGVudGlhbHMnLCBgcHJveHlVUkw6JHtwcm94eVVSTH1gLCBgcmVhbG06JHtyZWFsbX1gKTtcblx0XHRcdFx0Y29uc3QgYXV0aCA9ICdCYXNpYyAnICsgQnVmZmVyLmZyb20oYCR7Y3JlZGVudGlhbHMudXNlcm5hbWV9OiR7Y3JlZGVudGlhbHMucGFzc3dvcmR9YCkudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuXHRcdFx0XHRiYXNpY0F1dGhDYWNoZVtwcm94eVVSTF0gPSBhdXRoO1xuXHRcdFx0XHRyZXR1cm4gYXV0aDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGV4dEhvc3RMb2dTZXJ2aWNlLmRlYnVnKCdQcm94eVJlc29sdmVyI2xvb2t1cFByb3h5QXV0aG9yaXphdGlvbiBCYXNpYyBhdXRoZW50aWNhdGlvbiByZWNlaXZlZCBubyBjcmVkZW50aWFscycsIGBwcm94eVVSTDoke3Byb3h5VVJMfWAsIGByZWFsbToke3JlYWxtfWApO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0ZXh0SG9zdExvZ1NlcnZpY2UuZXJyb3IoJ1Byb3h5UmVzb2x2ZXIjbG9va3VwUHJveHlBdXRob3JpemF0aW9uIEJhc2ljIGF1dGhlbnRpY2F0aW9uIGZhaWxlZCcsIGVycik7XG5cdFx0fVxuXHR9XG5cdHJldHVybiB1bmRlZmluZWQ7XG59XG5cbnR5cGUgUHJveHlBdXRoZW50aWNhdGlvbkNsYXNzaWZpY2F0aW9uID0ge1xuXHRvd25lcjogJ2Nocm1hcnRpJztcblx0Y29tbWVudDogJ0RhdGEgYWJvdXQgcHJveHkgYXV0aGVudGljYXRpb24gcmVxdWVzdHMnO1xuXHRhdXRoZW50aWNhdGlvblR5cGU6IHsgY2xhc3NpZmljYXRpb246ICdQdWJsaWNOb25QZXJzb25hbERhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVHlwZSBvZiB0aGUgYXV0aGVudGljYXRpb24gcmVxdWVzdGVkJyB9O1xuXHRleHRlbnNpb25Ib3N0VHlwZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1R5cGUgb2YgdGhlIGV4dGVuc2lvbiBob3N0JyB9O1xufTtcblxudHlwZSBQcm94eUF1dGhlbnRpY2F0aW9uRXZlbnQgPSB7XG5cdGF1dGhlbnRpY2F0aW9uVHlwZTogc3RyaW5nO1xuXHRleHRlbnNpb25Ib3N0VHlwZTogc3RyaW5nO1xufTtcblxubGV0IHRlbGVtZXRyeVNlbnQgPSBmYWxzZTtcbmNvbnN0IGVuYWJsZVByb3h5QXV0aGVudGljYXRpb25UZWxlbWV0cnkgPSBmYWxzZTtcbmZ1bmN0aW9uIHNlbmRUZWxlbWV0cnkobWFpblRocmVhZFRlbGVtZXRyeTogTWFpblRocmVhZFRlbGVtZXRyeVNoYXBlLCBhdXRoZW50aWNhdGU6IHN0cmluZ1tdLCBpc1JlbW90ZTogYm9vbGVhbikge1xuXHRpZiAoIWVuYWJsZVByb3h5QXV0aGVudGljYXRpb25UZWxlbWV0cnkgfHwgdGVsZW1ldHJ5U2VudCB8fCAhYXV0aGVudGljYXRlLmxlbmd0aCkge1xuXHRcdHJldHVybjtcblx0fVxuXHR0ZWxlbWV0cnlTZW50ID0gdHJ1ZTtcblxuXHRtYWluVGhyZWFkVGVsZW1ldHJ5LiRwdWJsaWNMb2cyPFByb3h5QXV0aGVudGljYXRpb25FdmVudCwgUHJveHlBdXRoZW50aWNhdGlvbkNsYXNzaWZpY2F0aW9uPigncHJveHlBdXRoZW50aWNhdGlvblJlcXVlc3QnLCB7XG5cdFx0YXV0aGVudGljYXRpb25UeXBlOiBhdXRoZW50aWNhdGUubWFwKGEgPT4gYS5zcGxpdCgnICcpWzBdKS5qb2luKCcsJyksXG5cdFx0ZXh0ZW5zaW9uSG9zdFR5cGU6IGlzUmVtb3RlID8gJ3JlbW90ZScgOiAnbG9jYWwnLFxuXHR9KTtcbn1cblxuZnVuY3Rpb24gZ2V0RXh0SG9zdENvbmZpZ1ZhbHVlPFQ+KGNvbmZpZ1Byb3ZpZGVyOiBFeHRIb3N0Q29uZmlnUHJvdmlkZXIsIGlzUmVtb3RlOiBib29sZWFuLCBrZXk6IHN0cmluZywgZmFsbGJhY2s6IFQpOiBUO1xuZnVuY3Rpb24gZ2V0RXh0SG9zdENvbmZpZ1ZhbHVlPFQ+KGNvbmZpZ1Byb3ZpZGVyOiBFeHRIb3N0Q29uZmlnUHJvdmlkZXIsIGlzUmVtb3RlOiBib29sZWFuLCBrZXk6IHN0cmluZyk6IFQgfCB1bmRlZmluZWQ7XG5mdW5jdGlvbiBnZXRFeHRIb3N0Q29uZmlnVmFsdWU8VD4oY29uZmlnUHJvdmlkZXI6IEV4dEhvc3RDb25maWdQcm92aWRlciwgaXNSZW1vdGU6IGJvb2xlYW4sIGtleTogc3RyaW5nLCBmYWxsYmFjaz86IFQpOiBUIHwgdW5kZWZpbmVkIHtcblx0aWYgKGlzUmVtb3RlKSB7XG5cdFx0cmV0dXJuIGNvbmZpZ1Byb3ZpZGVyLmdldENvbmZpZ3VyYXRpb24oKS5nZXQ8VD4oa2V5KSA/PyBmYWxsYmFjaztcblx0fVxuXHRjb25zdCB2YWx1ZXM6IENvbmZpZ3VyYXRpb25JbnNwZWN0PFQ+IHwgdW5kZWZpbmVkID0gY29uZmlnUHJvdmlkZXIuZ2V0Q29uZmlndXJhdGlvbigpLmluc3BlY3Q8VD4oa2V5KTtcblx0cmV0dXJuIHZhbHVlcz8uZ2xvYmFsTG9jYWxWYWx1ZSA/PyB2YWx1ZXM/LmRlZmF1bHRWYWx1ZSA/PyBmYWxsYmFjaztcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQVVBLFNBQVMsV0FBVztBQUNwQixTQUFzQixZQUFZLHVCQUF1QjtBQUV6RCxTQUFTLFVBQVUsaUJBQWlCLHFC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
