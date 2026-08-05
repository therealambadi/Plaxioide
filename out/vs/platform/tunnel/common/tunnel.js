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
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { OperatingSystem } from "../../../base/common/platform.js";
import { URI } from "../../../base/common/uri.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
const ITunnelService = createDecorator("tunnelService");
const ISharedTunnelsService = createDecorator("sharedTunnelsService");
var TunnelProtocol = /* @__PURE__ */ ((TunnelProtocol2) => {
  TunnelProtocol2["Http"] = "http";
  TunnelProtocol2["Https"] = "https";
  return TunnelProtocol2;
})(TunnelProtocol || {});
var TunnelPrivacyId = /* @__PURE__ */ ((TunnelPrivacyId2) => {
  TunnelPrivacyId2["ConstantPrivate"] = "constantPrivate";
  TunnelPrivacyId2["Private"] = "private";
  TunnelPrivacyId2["Public"] = "public";
  return TunnelPrivacyId2;
})(TunnelPrivacyId || {});
function isTunnelProvider(addressOrTunnelProvider) {
  return !!addressOrTunnelProvider.forwardPort;
}
var ProvidedOnAutoForward = /* @__PURE__ */ ((ProvidedOnAutoForward2) => {
  ProvidedOnAutoForward2[ProvidedOnAutoForward2["Notify"] = 1] = "Notify";
  ProvidedOnAutoForward2[ProvidedOnAutoForward2["OpenBrowser"] = 2] = "OpenBrowser";
  ProvidedOnAutoForward2[ProvidedOnAutoForward2["OpenPreview"] = 3] = "OpenPreview";
  ProvidedOnAutoForward2[ProvidedOnAutoForward2["Silent"] = 4] = "Silent";
  ProvidedOnAutoForward2[ProvidedOnAutoForward2["Ignore"] = 5] = "Ignore";
  ProvidedOnAutoForward2[ProvidedOnAutoForward2["OpenBrowserOnce"] = 6] = "OpenBrowserOnce";
  return ProvidedOnAutoForward2;
})(ProvidedOnAutoForward || {});
function extractLocalHostUriMetaDataForPortMapping(uri) {
  if (uri.scheme !== "http" && uri.scheme !== "https") {
    return void 0;
  }
  const localhostMatch = /^(localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+)$/.exec(uri.authority);
  if (!localhostMatch) {
    return void 0;
  }
  return {
    address: localhostMatch[1],
    port: +localhostMatch[2]
  };
}
function extractQueryLocalHostUriMetaDataForPortMapping(uri) {
  if (uri.scheme !== "http" && uri.scheme !== "https" || !uri.query) {
    return void 0;
  }
  const keyvalues = uri.query.split("&");
  for (const keyvalue of keyvalues) {
    const value = keyvalue.split("=")[1];
    if (/^https?:/.exec(value)) {
      const result = extractLocalHostUriMetaDataForPortMapping(URI.parse(value));
      if (result) {
        return result;
      }
    }
  }
  return void 0;
}
const LOCALHOST_ADDRESSES = ["localhost", "127.0.0.1", "0:0:0:0:0:0:0:1", "::1"];
function isLocalhost(host) {
  return LOCALHOST_ADDRESSES.indexOf(host) >= 0;
}
const ALL_INTERFACES_ADDRESSES = ["0.0.0.0", "0:0:0:0:0:0:0:0", "::"];
function isAllInterfaces(host) {
  return ALL_INTERFACES_ADDRESSES.indexOf(host) >= 0;
}
function isPortPrivileged(port, host, os, osRelease) {
  if (os === OperatingSystem.Windows) {
    return false;
  }
  if (os === OperatingSystem.Macintosh) {
    if (isAllInterfaces(host)) {
      const osVersion = /(\d+)\.(\d+)\.(\d+)/g.exec(osRelease);
      if (osVersion?.length === 4) {
        const major = parseInt(osVersion[1]);
        if (major >= 18) {
          return false;
        }
      }
    }
  }
  return port < 1024;
}
class DisposableTunnel {
  constructor(remoteAddress, localAddress, _dispose) {
    this.remoteAddress = remoteAddress;
    this.localAddress = localAddress;
    this._dispose = _dispose;
    this._onDispose = new Emitter();
    this.onDidDispose = this._onDispose.event;
  }
  dispose() {
    this._onDispose.fire();
    return this._dispose();
  }
}
let AbstractTunnelService = class extends Disposable {
  constructor(logService, configurationService) {
    super();
    this.logService = logService;
    this.configurationService = configurationService;
    this._onTunnelOpened = new Emitter();
    this.onTunnelOpened = this._onTunnelOpened.event;
    this._onTunnelClosed = new Emitter();
    this.onTunnelClosed = this._onTunnelClosed.event;
    this._onAddedTunnelProvider = new Emitter();
    this.onAddedTunnelProvider = this._onAddedTunnelProvider.event;
    this._tunnels = /* @__PURE__ */ new Map();
    this._canElevate = false;
    this._canChangeProtocol = true;
    this._privacyOptions = [];
    this._factoryInProgress = /* @__PURE__ */ new Set();
  }
  get hasTunnelProvider() {
    return !!this._tunnelProvider;
  }
  get defaultTunnelHost() {
    const settingValue = this.configurationService.getValue("remote.localPortHost");
    return !settingValue || settingValue === "localhost" ? "127.0.0.1" : "0.0.0.0";
  }
  setTunnelProvider(provider) {
    this._tunnelProvider = provider;
    if (!provider) {
      this._canElevate = false;
      this._privacyOptions = [];
      this._onAddedTunnelProvider.fire();
      return {
        dispose: () => {
        }
      };
    }
    this._onAddedTunnelProvider.fire();
    return {
      dispose: () => {
        this._tunnelProvider = void 0;
        this._canElevate = false;
        this._privacyOptions = [];
      }
    };
  }
  setTunnelFeatures(features) {
    this._canElevate = features.elevation;
    this._privacyOptions = features.privacyOptions;
    this._canChangeProtocol = features.protocol;
  }
  get canChangeProtocol() {
    return this._canChangeProtocol;
  }
  get canElevate() {
    return this._canElevate;
  }
  get canChangePrivacy() {
    return this._privacyOptions.length > 0;
  }
  get privacyOptions() {
    return this._privacyOptions;
  }
  get tunnels() {
    return this.getTunnels();
  }
  async getTunnels() {
    const tunnels = [];
    const tunnelArray = Array.from(this._tunnels.values());
    for (const portMap of tunnelArray) {
      const portArray = Array.from(portMap.values());
      for (const x of portArray) {
        const tunnelValue = await x.value;
        if (tunnelValue && typeof tunnelValue !== "string") {
          tunnels.push(tunnelValue);
        }
      }
    }
    return tunnels;
  }
  async dispose() {
    super.dispose();
    for (const portMap of this._tunnels.values()) {
      for (const { value } of portMap.values()) {
        await value.then((tunnel) => typeof tunnel !== "string" ? tunnel?.dispose() : void 0);
      }
      portMap.clear();
    }
    this._tunnels.clear();
  }
  setEnvironmentTunnel(remoteHost, remotePort, localAddress, privacy, protocol) {
    this.addTunnelToMap(remoteHost, remotePort, Promise.resolve({
      tunnelRemoteHost: remoteHost,
      tunnelRemotePort: remotePort,
      localAddress,
      privacy,
      protocol,
      dispose: () => Promise.resolve()
    }));
  }
  async getExistingTunnel(remoteHost, remotePort) {
    if (isAllInterfaces(remoteHost) || isLocalhost(remoteHost)) {
      remoteHost = LOCALHOST_ADDRESSES[0];
    }
    const existing = this.getTunnelFromMap(remoteHost, remotePort);
    if (existing) {
      ++existing.refcount;
      return existing.value;
    }
    return void 0;
  }
  openTunnel(addressProvider, remoteHost, remotePort, localHost, localPort, elevateIfNeeded = false, privacy, protocol) {
    this.logService.trace(`ForwardedPorts: (TunnelService) openTunnel request for ${remoteHost}:${remotePort} on local port ${localPort}.`);
    const addressOrTunnelProvider = this._tunnelProvider ?? addressProvider;
    if (!addressOrTunnelProvider) {
      return void 0;
    }
    if (!remoteHost) {
      remoteHost = "localhost";
    }
    if (!localHost) {
      localHost = this.defaultTunnelHost;
    }
    if (this._tunnelProvider && this._factoryInProgress.has(remotePort)) {
      this.logService.debug(`ForwardedPorts: (TunnelService) Another call to create a tunnel with the same address has occurred before the last one completed. This call will be ignored.`);
      return;
    }
    const resolvedTunnel = this.retainOrCreateTunnel(addressOrTunnelProvider, remoteHost, remotePort, localHost, localPort, elevateIfNeeded, privacy, protocol);
    if (!resolvedTunnel) {
      this.logService.trace(`ForwardedPorts: (TunnelService) Tunnel was not created.`);
      return resolvedTunnel;
    }
    return resolvedTunnel.then((tunnel) => {
      if (!tunnel) {
        this.logService.trace("ForwardedPorts: (TunnelService) New tunnel is undefined.");
        this.removeEmptyOrErrorTunnelFromMap(remoteHost, remotePort);
        return void 0;
      } else if (typeof tunnel === "string") {
        this.logService.trace("ForwardedPorts: (TunnelService) The tunnel provider returned an error when creating the tunnel.");
        this.removeEmptyOrErrorTunnelFromMap(remoteHost, remotePort);
        return tunnel;
      }
      this.logService.trace("ForwardedPorts: (TunnelService) New tunnel established.");
      const newTunnel = this.makeTunnel(tunnel);
      if (tunnel.tunnelRemoteHost !== remoteHost || tunnel.tunnelRemotePort !== remotePort) {
        this.logService.warn("ForwardedPorts: (TunnelService) Created tunnel does not match requirements of requested tunnel. Host or port mismatch.");
      }
      if (privacy && tunnel.privacy !== privacy) {
        this.logService.warn("ForwardedPorts: (TunnelService) Created tunnel does not match requirements of requested tunnel. Privacy mismatch.");
      }
      this._onTunnelOpened.fire(newTunnel);
      return newTunnel;
    });
  }
  makeTunnel(tunnel) {
    return {
      tunnelRemotePort: tunnel.tunnelRemotePort,
      tunnelRemoteHost: tunnel.tunnelRemoteHost,
      tunnelLocalPort: tunnel.tunnelLocalPort,
      localAddress: tunnel.localAddress,
      privacy: tunnel.privacy,
      protocol: tunnel.protocol,
      dispose: async () => {
        this.logService.trace(`ForwardedPorts: (TunnelService) dispose request for ${tunnel.tunnelRemoteHost}:${tunnel.tunnelRemotePort} `);
        const existingHost = this._tunnels.get(tunnel.tunnelRemoteHost);
        if (existingHost) {
          const existing = existingHost.get(tunnel.tunnelRemotePort);
          if (existing) {
            existing.refcount--;
            await this.tryDisposeTunnel(tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort, existing);
          }
        }
      }
    };
  }
  async tryDisposeTunnel(remoteHost, remotePort, tunnel) {
    if (tunnel.refcount <= 0) {
      this.logService.trace(`ForwardedPorts: (TunnelService) Tunnel is being disposed ${remoteHost}:${remotePort}.`);
      const disposePromise = tunnel.value.then(async (tunnel2) => {
        if (tunnel2 && typeof tunnel2 !== "string") {
          await tunnel2.dispose(true);
          this._onTunnelClosed.fire({ host: tunnel2.tunnelRemoteHost, port: tunnel2.tunnelRemotePort });
        }
      });
      if (this._tunnels.has(remoteHost)) {
        this._tunnels.get(remoteHost).delete(remotePort);
      }
      return disposePromise;
    }
  }
  async closeTunnel(remoteHost, remotePort) {
    this.logService.trace(`ForwardedPorts: (TunnelService) close request for ${remoteHost}:${remotePort} `);
    const portMap = this._tunnels.get(remoteHost);
    if (portMap && portMap.has(remotePort)) {
      const value = portMap.get(remotePort);
      value.refcount = 0;
      await this.tryDisposeTunnel(remoteHost, remotePort, value);
    }
  }
  addTunnelToMap(remoteHost, remotePort, tunnel) {
    if (!this._tunnels.has(remoteHost)) {
      this._tunnels.set(remoteHost, /* @__PURE__ */ new Map());
    }
    this._tunnels.get(remoteHost).set(remotePort, { refcount: 1, value: tunnel });
  }
  async removeEmptyOrErrorTunnelFromMap(remoteHost, remotePort) {
    const hostMap = this._tunnels.get(remoteHost);
    if (hostMap) {
      const tunnel = hostMap.get(remotePort);
      const tunnelResult = tunnel ? await tunnel.value : void 0;
      if (!tunnelResult || typeof tunnelResult === "string") {
        hostMap.delete(remotePort);
      }
      if (hostMap.size === 0) {
        this._tunnels.delete(remoteHost);
      }
    }
  }
  getTunnelFromMap(remoteHost, remotePort) {
    const hosts = [remoteHost];
    if (isLocalhost(remoteHost)) {
      hosts.push(...LOCALHOST_ADDRESSES);
      hosts.push(...ALL_INTERFACES_ADDRESSES);
    } else if (isAllInterfaces(remoteHost)) {
      hosts.push(...ALL_INTERFACES_ADDRESSES);
    }
    const existingPortMaps = hosts.map((host) => this._tunnels.get(host));
    for (const map of existingPortMaps) {
      const existingTunnel = map?.get(remotePort);
      if (existingTunnel) {
        return existingTunnel;
      }
    }
    return void 0;
  }
  canTunnel(uri) {
    return !!extractLocalHostUriMetaDataForPortMapping(uri);
  }
  createWithProvider(tunnelProvider, remoteHost, remotePort, localPort, elevateIfNeeded, privacy, protocol) {
    this.logService.trace(`ForwardedPorts: (TunnelService) Creating tunnel with provider ${remoteHost}:${remotePort} on local port ${localPort}.`);
    const key = remotePort;
    this._factoryInProgress.add(key);
    const preferredLocalPort = localPort === void 0 ? remotePort : localPort;
    const creationInfo = { elevationRequired: elevateIfNeeded ? this.isPortPrivileged(preferredLocalPort) : false };
    const tunnelOptions = { remoteAddress: { host: remoteHost, port: remotePort }, localAddressPort: localPort, privacy, public: privacy ? privacy !== "private" /* Private */ : void 0, protocol };
    const tunnel = tunnelProvider.forwardPort(tunnelOptions, creationInfo);
    if (tunnel) {
      this.addTunnelToMap(remoteHost, remotePort, tunnel);
      tunnel.finally(() => {
        this.logService.trace("ForwardedPorts: (TunnelService) Tunnel created by provider.");
        this._factoryInProgress.delete(key);
      });
    } else {
      this._factoryInProgress.delete(key);
    }
    return tunnel;
  }
};
AbstractTunnelService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IConfigurationService)
], AbstractTunnelService);
export {
  ALL_INTERFACES_ADDRESSES,
  AbstractTunnelService,
  DisposableTunnel,
  ISharedTunnelsService,
  ITunnelService,
  LOCALHOST_ADDRESSES,
  ProvidedOnAutoForward,
  TunnelPrivacyId,
  TunnelProtocol,
  extractLocalHostUriMetaDataForPortMapping,
  extractQueryLocalHostUriMetaDataForPortMapping,
  isAllInterfaces,
  isLocalhost,
  isPortPrivileged,
  isTunnelProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90dW5uZWwvY29tbW9uL3R1bm5lbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUsIERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgT3BlcmF0aW5nU3lzdGVtIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yIH0gZnJvbSAnLi4vLi4vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElBZGRyZXNzUHJvdmlkZXIgfSBmcm9tICcuLi8uLi9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50Q29ubmVjdGlvbi5qcyc7XG5pbXBvcnQgeyBUdW5uZWxQcml2YWN5IH0gZnJvbSAnLi4vLi4vcmVtb3RlL2NvbW1vbi9yZW1vdGVBdXRob3JpdHlSZXNvbHZlci5qcyc7XG5cbmV4cG9ydCBjb25zdCBJVHVubmVsU2VydmljZSA9IGNyZWF0ZURlY29yYXRvcjxJVHVubmVsU2VydmljZT4oJ3R1bm5lbFNlcnZpY2UnKTtcbmV4cG9ydCBjb25zdCBJU2hhcmVkVHVubmVsc1NlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SVNoYXJlZFR1bm5lbHNTZXJ2aWNlPignc2hhcmVkVHVubmVsc1NlcnZpY2UnKTtcblxuZXhwb3J0IGludGVyZmFjZSBSZW1vdGVUdW5uZWwge1xuXHRyZWFkb25seSB0dW5uZWxSZW1vdGVQb3J0OiBudW1iZXI7XG5cdHJlYWRvbmx5IHR1bm5lbFJlbW90ZUhvc3Q6IHN0cmluZztcblx0cmVhZG9ubHkgdHVubmVsTG9jYWxQb3J0PzogbnVtYmVyO1xuXHRyZWFkb25seSBsb2NhbEFkZHJlc3M6IHN0cmluZztcblx0cmVhZG9ubHkgcHJpdmFjeTogc3RyaW5nO1xuXHRyZWFkb25seSBwcm90b2NvbD86IHN0cmluZztcblx0ZGlzcG9zZShzaWxlbnQ/OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUdW5uZWxPcHRpb25zIHtcblx0cmVtb3RlQWRkcmVzczogeyBwb3J0OiBudW1iZXI7IGhvc3Q6IHN0cmluZyB9O1xuXHRsb2NhbEFkZHJlc3NQb3J0PzogbnVtYmVyO1xuXHRsYWJlbD86IHN0cmluZztcblx0cHVibGljPzogYm9vbGVhbjtcblx0cHJpdmFjeT86IHN0cmluZztcblx0cHJvdG9jb2w/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBlbnVtIFR1bm5lbFByb3RvY29sIHtcblx0SHR0cCA9ICdodHRwJyxcblx0SHR0cHMgPSAnaHR0cHMnXG59XG5cbmV4cG9ydCBlbnVtIFR1bm5lbFByaXZhY3lJZCB7XG5cdENvbnN0YW50UHJpdmF0ZSA9ICdjb25zdGFudFByaXZhdGUnLCAvLyBwcml2YXRlLCBhbmQgY2hhbmdpbmcgaXMgdW5zdXBwb3J0ZWRcblx0UHJpdmF0ZSA9ICdwcml2YXRlJyxcblx0UHVibGljID0gJ3B1YmxpYydcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUdW5uZWxDcmVhdGlvbk9wdGlvbnMge1xuXHRlbGV2YXRpb25SZXF1aXJlZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHVubmVsUHJvdmlkZXJGZWF0dXJlcyB7XG5cdGVsZXZhdGlvbjogYm9vbGVhbjtcblx0LyoqXG5cdCAqIEBkZXByZWNhdGVkXG5cdCAqL1xuXHRwdWJsaWM/OiBib29sZWFuO1xuXHRwcml2YWN5T3B0aW9uczogVHVubmVsUHJpdmFjeVtdO1xuXHRwcm90b2NvbDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVHVubmVsUHJvdmlkZXIge1xuXHRmb3J3YXJkUG9ydCh0dW5uZWxPcHRpb25zOiBUdW5uZWxPcHRpb25zLCB0dW5uZWxDcmVhdGlvbk9wdGlvbnM6IFR1bm5lbENyZWF0aW9uT3B0aW9ucyk6IFByb21pc2U8UmVtb3RlVHVubmVsIHwgc3RyaW5nIHwgdW5kZWZpbmVkPiB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzVHVubmVsUHJvdmlkZXIoYWRkcmVzc09yVHVubmVsUHJvdmlkZXI6IElBZGRyZXNzUHJvdmlkZXIgfCBJVHVubmVsUHJvdmlkZXIpOiBhZGRyZXNzT3JUdW5uZWxQcm92aWRlciBpcyBJVHVubmVsUHJvdmlkZXIge1xuXHRyZXR1cm4gISEoYWRkcmVzc09yVHVubmVsUHJvdmlkZXIgYXMgSVR1bm5lbFByb3ZpZGVyKS5mb3J3YXJkUG9ydDtcbn1cblxuZXhwb3J0IGVudW0gUHJvdmlkZWRPbkF1dG9Gb3J3YXJkIHtcblx0Tm90aWZ5ID0gMSxcblx0T3BlbkJyb3dzZXIgPSAyLFxuXHRPcGVuUHJldmlldyA9IDMsXG5cdFNpbGVudCA9IDQsXG5cdElnbm9yZSA9IDUsXG5cdE9wZW5Ccm93c2VyT25jZSA9IDZcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQcm92aWRlZFBvcnRBdHRyaWJ1dGVzIHtcblx0cG9ydDogbnVtYmVyO1xuXHRhdXRvRm9yd2FyZEFjdGlvbjogUHJvdmlkZWRPbkF1dG9Gb3J3YXJkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBvcnRBdHRyaWJ1dGVzUHJvdmlkZXIge1xuXHRwcm92aWRlUG9ydEF0dHJpYnV0ZXMocG9ydHM6IG51bWJlcltdLCBwaWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgY29tbWFuZExpbmU6IHN0cmluZyB8IHVuZGVmaW5lZCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxQcm92aWRlZFBvcnRBdHRyaWJ1dGVzW10+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUdW5uZWwge1xuXHRyZW1vdGVBZGRyZXNzOiB7IHBvcnQ6IG51bWJlcjsgaG9zdDogc3RyaW5nIH07XG5cblx0LyoqXG5cdCAqIFRoZSBjb21wbGV0ZSBsb2NhbCBhZGRyZXNzKGV4LiBsb2NhbGhvc3Q6MTIzNClcblx0ICovXG5cdGxvY2FsQWRkcmVzczogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBAZGVwcmVjYXRlZCBVc2UgcHJpdmFjeSBpbnN0ZWFkXG5cdCAqL1xuXHRwdWJsaWM/OiBib29sZWFuO1xuXG5cdHByaXZhY3k/OiBzdHJpbmc7XG5cblx0cHJvdG9jb2w/OiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIEltcGxlbWVudGVycyBvZiBUdW5uZWwgc2hvdWxkIGZpcmUgb25EaWREaXNwb3NlIHdoZW4gZGlzcG9zZSBpcyBjYWxsZWQuXG5cdCAqL1xuXHRvbkRpZERpc3Bvc2U6IEV2ZW50PHZvaWQ+O1xuXG5cdGRpc3Bvc2UoKTogUHJvbWlzZTx2b2lkPiB8IHZvaWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNoYXJlZFR1bm5lbHNTZXJ2aWNlIHtcblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdG9wZW5UdW5uZWwoYXV0aG9yaXR5OiBzdHJpbmcsIGFkZHJlc3NQcm92aWRlcjogSUFkZHJlc3NQcm92aWRlciB8IHVuZGVmaW5lZCwgcmVtb3RlSG9zdDogc3RyaW5nIHwgdW5kZWZpbmVkLCByZW1vdGVQb3J0OiBudW1iZXIsIGxvY2FsSG9zdDogc3RyaW5nLCBsb2NhbFBvcnQ/OiBudW1iZXIsIGVsZXZhdGVJZk5lZWRlZD86IGJvb2xlYW4sIHByaXZhY3k/OiBzdHJpbmcsIHByb3RvY29sPzogc3RyaW5nKTogUHJvbWlzZTxSZW1vdGVUdW5uZWwgfCBzdHJpbmcgfCB1bmRlZmluZWQ+IHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUdW5uZWxTZXJ2aWNlIHtcblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHJlYWRvbmx5IHR1bm5lbHM6IFByb21pc2U8cmVhZG9ubHkgUmVtb3RlVHVubmVsW10+O1xuXHRyZWFkb25seSBjYW5DaGFuZ2VQcml2YWN5OiBib29sZWFuO1xuXHRyZWFkb25seSBwcml2YWN5T3B0aW9uczogVHVubmVsUHJpdmFjeVtdO1xuXHRyZWFkb25seSBvblR1bm5lbE9wZW5lZDogRXZlbnQ8UmVtb3RlVHVubmVsPjtcblx0cmVhZG9ubHkgb25UdW5uZWxDbG9zZWQ6IEV2ZW50PHsgaG9zdDogc3RyaW5nOyBwb3J0OiBudW1iZXIgfT47XG5cdHJlYWRvbmx5IGNhbkVsZXZhdGU6IGJvb2xlYW47XG5cdHJlYWRvbmx5IGNhbkNoYW5nZVByb3RvY29sOiBib29sZWFuO1xuXHRyZWFkb25seSBoYXNUdW5uZWxQcm92aWRlcjogYm9vbGVhbjtcblx0cmVhZG9ubHkgb25BZGRlZFR1bm5lbFByb3ZpZGVyOiBFdmVudDx2b2lkPjtcblxuXHRjYW5UdW5uZWwodXJpOiBVUkkpOiBib29sZWFuO1xuXHRvcGVuVHVubmVsKGFkZHJlc3NQcm92aWRlcjogSUFkZHJlc3NQcm92aWRlciB8IHVuZGVmaW5lZCwgcmVtb3RlSG9zdDogc3RyaW5nIHwgdW5kZWZpbmVkLCByZW1vdGVQb3J0OiBudW1iZXIsIGxvY2FsSG9zdD86IHN0cmluZywgbG9jYWxQb3J0PzogbnVtYmVyLCBlbGV2YXRlSWZOZWVkZWQ/OiBib29sZWFuLCBwcml2YWN5Pzogc3RyaW5nLCBwcm90b2NvbD86IHN0cmluZyk6IFByb21pc2U8UmVtb3RlVHVubmVsIHwgc3RyaW5nIHwgdW5kZWZpbmVkPiB8IHVuZGVmaW5lZDtcblx0Z2V0RXhpc3RpbmdUdW5uZWwocmVtb3RlSG9zdDogc3RyaW5nLCByZW1vdGVQb3J0OiBudW1iZXIpOiBQcm9taXNlPFJlbW90ZVR1bm5lbCB8IHN0cmluZyB8IHVuZGVmaW5lZD47XG5cdHNldEVudmlyb25tZW50VHVubmVsKHJlbW90ZUhvc3Q6IHN0cmluZywgcmVtb3RlUG9ydDogbnVtYmVyLCBsb2NhbEFkZHJlc3M6IHN0cmluZywgcHJpdmFjeTogc3RyaW5nLCBwcm90b2NvbDogc3RyaW5nKTogdm9pZDtcblx0Y2xvc2VUdW5uZWwocmVtb3RlSG9zdDogc3RyaW5nLCByZW1vdGVQb3J0OiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+O1xuXHRzZXRUdW5uZWxQcm92aWRlcihwcm92aWRlcjogSVR1bm5lbFByb3ZpZGVyIHwgdW5kZWZpbmVkKTogSURpc3Bvc2FibGU7XG5cdHNldFR1bm5lbEZlYXR1cmVzKGZlYXR1cmVzOiBUdW5uZWxQcm92aWRlckZlYXR1cmVzKTogdm9pZDtcblx0aXNQb3J0UHJpdmlsZWdlZChwb3J0OiBudW1iZXIpOiBib29sZWFuO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdExvY2FsSG9zdFVyaU1ldGFEYXRhRm9yUG9ydE1hcHBpbmcodXJpOiBVUkkpOiB7IGFkZHJlc3M6IHN0cmluZzsgcG9ydDogbnVtYmVyIH0gfCB1bmRlZmluZWQge1xuXHRpZiAodXJpLnNjaGVtZSAhPT0gJ2h0dHAnICYmIHVyaS5zY2hlbWUgIT09ICdodHRwcycpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cdGNvbnN0IGxvY2FsaG9zdE1hdGNoID0gL14obG9jYWxob3N0fDEyN1xcLjBcXC4wXFwuMXwwXFwuMFxcLjBcXC4wKTooXFxkKykkLy5leGVjKHVyaS5hdXRob3JpdHkpO1xuXHRpZiAoIWxvY2FsaG9zdE1hdGNoKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXHRyZXR1cm4ge1xuXHRcdGFkZHJlc3M6IGxvY2FsaG9zdE1hdGNoWzFdLFxuXHRcdHBvcnQ6ICtsb2NhbGhvc3RNYXRjaFsyXSxcblx0fTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RRdWVyeUxvY2FsSG9zdFVyaU1ldGFEYXRhRm9yUG9ydE1hcHBpbmcodXJpOiBVUkkpOiB7IGFkZHJlc3M6IHN0cmluZzsgcG9ydDogbnVtYmVyIH0gfCB1bmRlZmluZWQge1xuXHRpZiAodXJpLnNjaGVtZSAhPT0gJ2h0dHAnICYmIHVyaS5zY2hlbWUgIT09ICdodHRwcycgfHwgIXVyaS5xdWVyeSkge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblx0Y29uc3Qga2V5dmFsdWVzID0gdXJpLnF1ZXJ5LnNwbGl0KCcmJyk7XG5cdGZvciAoY29uc3Qga2V5dmFsdWUgb2Yga2V5dmFsdWVzKSB7XG5cdFx0Y29uc3QgdmFsdWUgPSBrZXl2YWx1ZS5zcGxpdCgnPScpWzFdO1xuXHRcdGlmICgvXmh0dHBzPzovLmV4ZWModmFsdWUpKSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBleHRyYWN0TG9jYWxIb3N0VXJpTWV0YURhdGFGb3JQb3J0TWFwcGluZyhVUkkucGFyc2UodmFsdWUpKTtcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0cmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGNvbnN0IExPQ0FMSE9TVF9BRERSRVNTRVMgPSBbJ2xvY2FsaG9zdCcsICcxMjcuMC4wLjEnLCAnMDowOjA6MDowOjA6MDoxJywgJzo6MSddO1xuZXhwb3J0IGZ1bmN0aW9uIGlzTG9jYWxob3N0KGhvc3Q6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gTE9DQUxIT1NUX0FERFJFU1NFUy5pbmRleE9mKGhvc3QpID49IDA7XG59XG5cbmV4cG9ydCBjb25zdCBBTExfSU5URVJGQUNFU19BRERSRVNTRVMgPSBbJzAuMC4wLjAnLCAnMDowOjA6MDowOjA6MDowJywgJzo6J107XG5leHBvcnQgZnVuY3Rpb24gaXNBbGxJbnRlcmZhY2VzKGhvc3Q6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gQUxMX0lOVEVSRkFDRVNfQUREUkVTU0VTLmluZGV4T2YoaG9zdCkgPj0gMDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzUG9ydFByaXZpbGVnZWQocG9ydDogbnVtYmVyLCBob3N0OiBzdHJpbmcsIG9zOiBPcGVyYXRpbmdTeXN0ZW0sIG9zUmVsZWFzZTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdGlmIChvcyA9PT0gT3BlcmF0aW5nU3lzdGVtLldpbmRvd3MpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0aWYgKG9zID09PSBPcGVyYXRpbmdTeXN0ZW0uTWFjaW50b3NoKSB7XG5cdFx0aWYgKGlzQWxsSW50ZXJmYWNlcyhob3N0KSkge1xuXHRcdFx0Y29uc3Qgb3NWZXJzaW9uID0gKC8oXFxkKylcXC4oXFxkKylcXC4oXFxkKykvZykuZXhlYyhvc1JlbGVhc2UpO1xuXHRcdFx0aWYgKG9zVmVyc2lvbj8ubGVuZ3RoID09PSA0KSB7XG5cdFx0XHRcdGNvbnN0IG1ham9yID0gcGFyc2VJbnQob3NWZXJzaW9uWzFdKTtcblx0XHRcdFx0aWYgKG1ham9yID49IDE4IC8qIHNpbmNlIG1hY09TIE1vamF2ZSwgZGFyd2luIHZlcnNpb24gMTguMC4wICovKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdHJldHVybiBwb3J0IDwgMTAyNDtcbn1cblxuZXhwb3J0IGNsYXNzIERpc3Bvc2FibGVUdW5uZWwge1xuXHRwcml2YXRlIF9vbkRpc3Bvc2U6IEVtaXR0ZXI8dm9pZD4gPSBuZXcgRW1pdHRlcigpO1xuXHRvbkRpZERpc3Bvc2U6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaXNwb3NlLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSByZW1vdGVBZGRyZXNzOiB7IHBvcnQ6IG51bWJlcjsgaG9zdDogc3RyaW5nIH0sXG5cdFx0cHVibGljIHJlYWRvbmx5IGxvY2FsQWRkcmVzczogeyBwb3J0OiBudW1iZXI7IGhvc3Q6IHN0cmluZyB9IHwgc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2Rpc3Bvc2U6ICgpID0+IFByb21pc2U8dm9pZD4pIHsgfVxuXG5cdGRpc3Bvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fb25EaXNwb3NlLmZpcmUoKTtcblx0XHRyZXR1cm4gdGhpcy5fZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBBYnN0cmFjdFR1bm5lbFNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVR1bm5lbFNlcnZpY2Uge1xuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF9vblR1bm5lbE9wZW5lZDogRW1pdHRlcjxSZW1vdGVUdW5uZWw+ID0gbmV3IEVtaXR0ZXIoKTtcblx0cHVibGljIG9uVHVubmVsT3BlbmVkOiBFdmVudDxSZW1vdGVUdW5uZWw+ID0gdGhpcy5fb25UdW5uZWxPcGVuZWQuZXZlbnQ7XG5cdHByaXZhdGUgX29uVHVubmVsQ2xvc2VkOiBFbWl0dGVyPHsgaG9zdDogc3RyaW5nOyBwb3J0OiBudW1iZXIgfT4gPSBuZXcgRW1pdHRlcigpO1xuXHRwdWJsaWMgb25UdW5uZWxDbG9zZWQ6IEV2ZW50PHsgaG9zdDogc3RyaW5nOyBwb3J0OiBudW1iZXIgfT4gPSB0aGlzLl9vblR1bm5lbENsb3NlZC5ldmVudDtcblx0cHJpdmF0ZSBfb25BZGRlZFR1bm5lbFByb3ZpZGVyOiBFbWl0dGVyPHZvaWQ+ID0gbmV3IEVtaXR0ZXIoKTtcblx0cHVibGljIG9uQWRkZWRUdW5uZWxQcm92aWRlcjogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkFkZGVkVHVubmVsUHJvdmlkZXIuZXZlbnQ7XG5cdHByb3RlY3RlZCByZWFkb25seSBfdHVubmVscyA9IG5ldyBNYXA8Lypob3N0Ki8gc3RyaW5nLCBNYXA8LyogcG9ydCAqLyBudW1iZXIsIHsgcmVmY291bnQ6IG51bWJlcjsgcmVhZG9ubHkgdmFsdWU6IFByb21pc2U8UmVtb3RlVHVubmVsIHwgc3RyaW5nIHwgdW5kZWZpbmVkPiB9Pj4oKTtcblx0cHJvdGVjdGVkIF90dW5uZWxQcm92aWRlcjogSVR1bm5lbFByb3ZpZGVyIHwgdW5kZWZpbmVkO1xuXHRwcm90ZWN0ZWQgX2NhbkVsZXZhdGU6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfY2FuQ2hhbmdlUHJvdG9jb2w6IGJvb2xlYW4gPSB0cnVlO1xuXHRwcml2YXRlIF9wcml2YWN5T3B0aW9uczogVHVubmVsUHJpdmFjeVtdID0gW107XG5cdHByaXZhdGUgX2ZhY3RvcnlJblByb2dyZXNzOiBTZXQ8bnVtYmVyLypwb3J0Ki8+ID0gbmV3IFNldCgpO1xuXG5cdHB1YmxpYyBjb25zdHJ1Y3Rvcihcblx0XHRASUxvZ1NlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7IHN1cGVyKCk7IH1cblxuXHRnZXQgaGFzVHVubmVsUHJvdmlkZXIoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5fdHVubmVsUHJvdmlkZXI7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0IGRlZmF1bHRUdW5uZWxIb3N0KCk6IHN0cmluZyB7XG5cdFx0Y29uc3Qgc2V0dGluZ1ZhbHVlID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgncmVtb3RlLmxvY2FsUG9ydEhvc3QnKTtcblx0XHRyZXR1cm4gKCFzZXR0aW5nVmFsdWUgfHwgc2V0dGluZ1ZhbHVlID09PSAnbG9jYWxob3N0JykgPyAnMTI3LjAuMC4xJyA6ICcwLjAuMC4wJztcblx0fVxuXG5cdHNldFR1bm5lbFByb3ZpZGVyKHByb3ZpZGVyOiBJVHVubmVsUHJvdmlkZXIgfCB1bmRlZmluZWQpOiBJRGlzcG9zYWJsZSB7XG5cdFx0dGhpcy5fdHVubmVsUHJvdmlkZXIgPSBwcm92aWRlcjtcblx0XHRpZiAoIXByb3ZpZGVyKSB7XG5cdFx0XHQvLyBjbGVhciBmZWF0dXJlc1xuXHRcdFx0dGhpcy5fY2FuRWxldmF0ZSA9IGZhbHNlO1xuXHRcdFx0dGhpcy5fcHJpdmFjeU9wdGlvbnMgPSBbXTtcblx0XHRcdHRoaXMuX29uQWRkZWRUdW5uZWxQcm92aWRlci5maXJlKCk7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRkaXNwb3NlOiAoKSA9PiB7IH1cblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25BZGRlZFR1bm5lbFByb3ZpZGVyLmZpcmUoKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl90dW5uZWxQcm92aWRlciA9IHVuZGVmaW5lZDtcblx0XHRcdFx0dGhpcy5fY2FuRWxldmF0ZSA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLl9wcml2YWN5T3B0aW9ucyA9IFtdO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRzZXRUdW5uZWxGZWF0dXJlcyhmZWF0dXJlczogVHVubmVsUHJvdmlkZXJGZWF0dXJlcyk6IHZvaWQge1xuXHRcdHRoaXMuX2NhbkVsZXZhdGUgPSBmZWF0dXJlcy5lbGV2YXRpb247XG5cdFx0dGhpcy5fcHJpdmFjeU9wdGlvbnMgPSBmZWF0dXJlcy5wcml2YWN5T3B0aW9ucztcblx0XHR0aGlzLl9jYW5DaGFuZ2VQcm90b2NvbCA9IGZlYXR1cmVzLnByb3RvY29sO1xuXHR9XG5cblx0cHVibGljIGdldCBjYW5DaGFuZ2VQcm90b2NvbCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fY2FuQ2hhbmdlUHJvdG9jb2w7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGNhbkVsZXZhdGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2NhbkVsZXZhdGU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGNhbkNoYW5nZVByaXZhY3koKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3ByaXZhY3lPcHRpb25zLmxlbmd0aCA+IDA7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHByaXZhY3lPcHRpb25zKCkge1xuXHRcdHJldHVybiB0aGlzLl9wcml2YWN5T3B0aW9ucztcblx0fVxuXG5cdHB1YmxpYyBnZXQgdHVubmVscygpOiBQcm9taXNlPHJlYWRvbmx5IFJlbW90ZVR1bm5lbFtdPiB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0VHVubmVscygpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRUdW5uZWxzKCk6IFByb21pc2U8cmVhZG9ubHkgUmVtb3RlVHVubmVsW10+IHtcblx0XHRjb25zdCB0dW5uZWxzOiBSZW1vdGVUdW5uZWxbXSA9IFtdO1xuXHRcdGNvbnN0IHR1bm5lbEFycmF5ID0gQXJyYXkuZnJvbSh0aGlzLl90dW5uZWxzLnZhbHVlcygpKTtcblx0XHRmb3IgKGNvbnN0IHBvcnRNYXAgb2YgdHVubmVsQXJyYXkpIHtcblx0XHRcdGNvbnN0IHBvcnRBcnJheSA9IEFycmF5LmZyb20ocG9ydE1hcC52YWx1ZXMoKSk7XG5cdFx0XHRmb3IgKGNvbnN0IHggb2YgcG9ydEFycmF5KSB7XG5cdFx0XHRcdGNvbnN0IHR1bm5lbFZhbHVlID0gYXdhaXQgeC52YWx1ZTtcblx0XHRcdFx0aWYgKHR1bm5lbFZhbHVlICYmICh0eXBlb2YgdHVubmVsVmFsdWUgIT09ICdzdHJpbmcnKSkge1xuXHRcdFx0XHRcdHR1bm5lbHMucHVzaCh0dW5uZWxWYWx1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHR1bm5lbHM7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBkaXNwb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHRmb3IgKGNvbnN0IHBvcnRNYXAgb2YgdGhpcy5fdHVubmVscy52YWx1ZXMoKSkge1xuXHRcdFx0Zm9yIChjb25zdCB7IHZhbHVlIH0gb2YgcG9ydE1hcC52YWx1ZXMoKSkge1xuXHRcdFx0XHRhd2FpdCB2YWx1ZS50aGVuKHR1bm5lbCA9PiB0eXBlb2YgdHVubmVsICE9PSAnc3RyaW5nJyA/IHR1bm5lbD8uZGlzcG9zZSgpIDogdW5kZWZpbmVkKTtcblx0XHRcdH1cblx0XHRcdHBvcnRNYXAuY2xlYXIoKTtcblx0XHR9XG5cdFx0dGhpcy5fdHVubmVscy5jbGVhcigpO1xuXHR9XG5cblx0c2V0RW52aXJvbm1lbnRUdW5uZWwocmVtb3RlSG9zdDogc3RyaW5nLCByZW1vdGVQb3J0OiBudW1iZXIsIGxvY2FsQWRkcmVzczogc3RyaW5nLCBwcml2YWN5OiBzdHJpbmcsIHByb3RvY29sOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLmFkZFR1bm5lbFRvTWFwKHJlbW90ZUhvc3QsIHJlbW90ZVBvcnQsIFByb21pc2UucmVzb2x2ZSh7XG5cdFx0XHR0dW5uZWxSZW1vdGVIb3N0OiByZW1vdGVIb3N0LFxuXHRcdFx0dHVubmVsUmVtb3RlUG9ydDogcmVtb3RlUG9ydCxcblx0XHRcdGxvY2FsQWRkcmVzcyxcblx0XHRcdHByaXZhY3ksXG5cdFx0XHRwcm90b2NvbCxcblx0XHRcdGRpc3Bvc2U6ICgpID0+IFByb21pc2UucmVzb2x2ZSgpXG5cdFx0fSkpO1xuXHR9XG5cblx0YXN5bmMgZ2V0RXhpc3RpbmdUdW5uZWwocmVtb3RlSG9zdDogc3RyaW5nLCByZW1vdGVQb3J0OiBudW1iZXIpOiBQcm9taXNlPFJlbW90ZVR1bm5lbCB8IHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmIChpc0FsbEludGVyZmFjZXMocmVtb3RlSG9zdCkgfHwgaXNMb2NhbGhvc3QocmVtb3RlSG9zdCkpIHtcblx0XHRcdHJlbW90ZUhvc3QgPSBMT0NBTEhPU1RfQUREUkVTU0VTWzBdO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4aXN0aW5nID0gdGhpcy5nZXRUdW5uZWxGcm9tTWFwKHJlbW90ZUhvc3QsIHJlbW90ZVBvcnQpO1xuXHRcdGlmIChleGlzdGluZykge1xuXHRcdFx0KytleGlzdGluZy5yZWZjb3VudDtcblx0XHRcdHJldHVybiBleGlzdGluZy52YWx1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdG9wZW5UdW5uZWwoYWRkcmVzc1Byb3ZpZGVyOiBJQWRkcmVzc1Byb3ZpZGVyIHwgdW5kZWZpbmVkLCByZW1vdGVIb3N0OiBzdHJpbmcgfCB1bmRlZmluZWQsIHJlbW90ZVBvcnQ6IG51bWJlciwgbG9jYWxIb3N0Pzogc3RyaW5nLCBsb2NhbFBvcnQ/OiBudW1iZXIsIGVsZXZhdGVJZk5lZWRlZDogYm9vbGVhbiA9IGZhbHNlLCBwcml2YWN5Pzogc3RyaW5nLCBwcm90b2NvbD86IHN0cmluZyk6IFByb21pc2U8UmVtb3RlVHVubmVsIHwgc3RyaW5nIHwgdW5kZWZpbmVkPiB8IHVuZGVmaW5lZCB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBGb3J3YXJkZWRQb3J0czogKFR1bm5lbFNlcnZpY2UpIG9wZW5UdW5uZWwgcmVxdWVzdCBmb3IgJHtyZW1vdGVIb3N0fToke3JlbW90ZVBvcnR9IG9uIGxvY2FsIHBvcnQgJHtsb2NhbFBvcnR9LmApO1xuXHRcdGNvbnN0IGFkZHJlc3NPclR1bm5lbFByb3ZpZGVyID0gdGhpcy5fdHVubmVsUHJvdmlkZXIgPz8gYWRkcmVzc1Byb3ZpZGVyO1xuXHRcdGlmICghYWRkcmVzc09yVHVubmVsUHJvdmlkZXIpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKCFyZW1vdGVIb3N0KSB7XG5cdFx0XHRyZW1vdGVIb3N0ID0gJ2xvY2FsaG9zdCc7XG5cdFx0fVxuXHRcdGlmICghbG9jYWxIb3N0KSB7XG5cdFx0XHRsb2NhbEhvc3QgPSB0aGlzLmRlZmF1bHRUdW5uZWxIb3N0O1xuXHRcdH1cblxuXHRcdC8vIFByZXZlbnQgdHVubmVsIGZhY3RvcmllcyBmcm9tIGNhbGxpbmcgb3BlblR1bm5lbCBmcm9tIHdpdGhpbiB0aGUgZmFjdG9yeVxuXHRcdGlmICh0aGlzLl90dW5uZWxQcm92aWRlciAmJiB0aGlzLl9mYWN0b3J5SW5Qcm9ncmVzcy5oYXMocmVtb3RlUG9ydCkpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5kZWJ1ZyhgRm9yd2FyZGVkUG9ydHM6IChUdW5uZWxTZXJ2aWNlKSBBbm90aGVyIGNhbGwgdG8gY3JlYXRlIGEgdHVubmVsIHdpdGggdGhlIHNhbWUgYWRkcmVzcyBoYXMgb2NjdXJyZWQgYmVmb3JlIHRoZSBsYXN0IG9uZSBjb21wbGV0ZWQuIFRoaXMgY2FsbCB3aWxsIGJlIGlnbm9yZWQuYCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzb2x2ZWRUdW5uZWwgPSB0aGlzLnJldGFpbk9yQ3JlYXRlVHVubmVsKGFkZHJlc3NPclR1bm5lbFByb3ZpZGVyLCByZW1vdGVIb3N0LCByZW1vdGVQb3J0LCBsb2NhbEhvc3QsIGxvY2FsUG9ydCwgZWxldmF0ZUlmTmVlZGVkLCBwcml2YWN5LCBwcm90b2NvbCk7XG5cdFx0aWYgKCFyZXNvbHZlZFR1bm5lbCkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBGb3J3YXJkZWRQb3J0czogKFR1bm5lbFNlcnZpY2UpIFR1bm5lbCB3YXMgbm90IGNyZWF0ZWQuYCk7XG5cdFx0XHRyZXR1cm4gcmVzb2x2ZWRUdW5uZWw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc29sdmVkVHVubmVsLnRoZW4odHVubmVsID0+IHtcblx0XHRcdGlmICghdHVubmVsKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnRm9yd2FyZGVkUG9ydHM6IChUdW5uZWxTZXJ2aWNlKSBOZXcgdHVubmVsIGlzIHVuZGVmaW5lZC4nKTtcblx0XHRcdFx0dGhpcy5yZW1vdmVFbXB0eU9yRXJyb3JUdW5uZWxGcm9tTWFwKHJlbW90ZUhvc3QsIHJlbW90ZVBvcnQpO1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSBlbHNlIGlmICh0eXBlb2YgdHVubmVsID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ0ZvcndhcmRlZFBvcnRzOiAoVHVubmVsU2VydmljZSkgVGhlIHR1bm5lbCBwcm92aWRlciByZXR1cm5lZCBhbiBlcnJvciB3aGVuIGNyZWF0aW5nIHRoZSB0dW5uZWwuJyk7XG5cdFx0XHRcdHRoaXMucmVtb3ZlRW1wdHlPckVycm9yVHVubmVsRnJvbU1hcChyZW1vdGVIb3N0LCByZW1vdGVQb3J0KTtcblx0XHRcdFx0cmV0dXJuIHR1bm5lbDtcblx0XHRcdH1cblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnRm9yd2FyZGVkUG9ydHM6IChUdW5uZWxTZXJ2aWNlKSBOZXcgdHVubmVsIGVzdGFibGlzaGVkLicpO1xuXHRcdFx0Y29uc3QgbmV3VHVubmVsID0gdGhpcy5tYWtlVHVubmVsKHR1bm5lbCk7XG5cdFx0XHRpZiAodHVubmVsLnR1bm5lbFJlbW90ZUhvc3QgIT09IHJlbW90ZUhvc3QgfHwgdHVubmVsLnR1bm5lbFJlbW90ZVBvcnQgIT09IHJlbW90ZVBvcnQpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLndhcm4oJ0ZvcndhcmRlZFBvcnRzOiAoVHVubmVsU2VydmljZSkgQ3JlYXRlZCB0dW5uZWwgZG9lcyBub3QgbWF0Y2ggcmVxdWlyZW1lbnRzIG9mIHJlcXVlc3RlZCB0dW5uZWwuIEhvc3Qgb3IgcG9ydCBtaXNtYXRjaC4nKTtcblx0XHRcdH1cblx0XHRcdGlmIChwcml2YWN5ICYmIHR1bm5lbC5wcml2YWN5ICE9PSBwcml2YWN5KSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKCdGb3J3YXJkZWRQb3J0czogKFR1bm5lbFNlcnZpY2UpIENyZWF0ZWQgdHVubmVsIGRvZXMgbm90IG1hdGNoIHJlcXVpcmVtZW50cyBvZiByZXF1ZXN0ZWQgdHVubmVsLiBQcml2YWN5IG1pc21hdGNoLicpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fb25UdW5uZWxPcGVuZWQuZmlyZShuZXdUdW5uZWwpO1xuXHRcdFx0cmV0dXJuIG5ld1R1bm5lbDtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgbWFrZVR1bm5lbCh0dW5uZWw6IFJlbW90ZVR1bm5lbCk6IFJlbW90ZVR1bm5lbCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHR1bm5lbFJlbW90ZVBvcnQ6IHR1bm5lbC50dW5uZWxSZW1vdGVQb3J0LFxuXHRcdFx0dHVubmVsUmVtb3RlSG9zdDogdHVubmVsLnR1bm5lbFJlbW90ZUhvc3QsXG5cdFx0XHR0dW5uZWxMb2NhbFBvcnQ6IHR1bm5lbC50dW5uZWxMb2NhbFBvcnQsXG5cdFx0XHRsb2NhbEFkZHJlc3M6IHR1bm5lbC5sb2NhbEFkZHJlc3MsXG5cdFx0XHRwcml2YWN5OiB0dW5uZWwucHJpdmFjeSxcblx0XHRcdHByb3RvY29sOiB0dW5uZWwucHJvdG9jb2wsXG5cdFx0XHRkaXNwb3NlOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgRm9yd2FyZGVkUG9ydHM6IChUdW5uZWxTZXJ2aWNlKSBkaXNwb3NlIHJlcXVlc3QgZm9yICR7dHVubmVsLnR1bm5lbFJlbW90ZUhvc3R9OiR7dHVubmVsLnR1bm5lbFJlbW90ZVBvcnR9IGApO1xuXHRcdFx0XHRjb25zdCBleGlzdGluZ0hvc3QgPSB0aGlzLl90dW5uZWxzLmdldCh0dW5uZWwudHVubmVsUmVtb3RlSG9zdCk7XG5cdFx0XHRcdGlmIChleGlzdGluZ0hvc3QpIHtcblx0XHRcdFx0XHRjb25zdCBleGlzdGluZyA9IGV4aXN0aW5nSG9zdC5nZXQodHVubmVsLnR1bm5lbFJlbW90ZVBvcnQpO1xuXHRcdFx0XHRcdGlmIChleGlzdGluZykge1xuXHRcdFx0XHRcdFx0ZXhpc3RpbmcucmVmY291bnQtLTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMudHJ5RGlzcG9zZVR1bm5lbCh0dW5uZWwudHVubmVsUmVtb3RlSG9zdCwgdHVubmVsLnR1bm5lbFJlbW90ZVBvcnQsIGV4aXN0aW5nKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB0cnlEaXNwb3NlVHVubmVsKHJlbW90ZUhvc3Q6IHN0cmluZywgcmVtb3RlUG9ydDogbnVtYmVyLCB0dW5uZWw6IHsgcmVmY291bnQ6IG51bWJlcjsgcmVhZG9ubHkgdmFsdWU6IFByb21pc2U8UmVtb3RlVHVubmVsIHwgc3RyaW5nIHwgdW5kZWZpbmVkPiB9KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHR1bm5lbC5yZWZjb3VudCA8PSAwKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYEZvcndhcmRlZFBvcnRzOiAoVHVubmVsU2VydmljZSkgVHVubmVsIGlzIGJlaW5nIGRpc3Bvc2VkICR7cmVtb3RlSG9zdH06JHtyZW1vdGVQb3J0fS5gKTtcblx0XHRcdGNvbnN0IGRpc3Bvc2VQcm9taXNlOiBQcm9taXNlPHZvaWQ+ID0gdHVubmVsLnZhbHVlLnRoZW4oYXN5bmMgKHR1bm5lbCkgPT4ge1xuXHRcdFx0XHRpZiAodHVubmVsICYmICh0eXBlb2YgdHVubmVsICE9PSAnc3RyaW5nJykpIHtcblx0XHRcdFx0XHRhd2FpdCB0dW5uZWwuZGlzcG9zZSh0cnVlKTtcblx0XHRcdFx0XHR0aGlzLl9vblR1bm5lbENsb3NlZC5maXJlKHsgaG9zdDogdHVubmVsLnR1bm5lbFJlbW90ZUhvc3QsIHBvcnQ6IHR1bm5lbC50dW5uZWxSZW1vdGVQb3J0IH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdGlmICh0aGlzLl90dW5uZWxzLmhhcyhyZW1vdGVIb3N0KSkge1xuXHRcdFx0XHR0aGlzLl90dW5uZWxzLmdldChyZW1vdGVIb3N0KSEuZGVsZXRlKHJlbW90ZVBvcnQpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGRpc3Bvc2VQcm9taXNlO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGNsb3NlVHVubmVsKHJlbW90ZUhvc3Q6IHN0cmluZywgcmVtb3RlUG9ydDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBGb3J3YXJkZWRQb3J0czogKFR1bm5lbFNlcnZpY2UpIGNsb3NlIHJlcXVlc3QgZm9yICR7cmVtb3RlSG9zdH06JHtyZW1vdGVQb3J0fSBgKTtcblx0XHRjb25zdCBwb3J0TWFwID0gdGhpcy5fdHVubmVscy5nZXQocmVtb3RlSG9zdCk7XG5cdFx0aWYgKHBvcnRNYXAgJiYgcG9ydE1hcC5oYXMocmVtb3RlUG9ydCkpIHtcblx0XHRcdGNvbnN0IHZhbHVlID0gcG9ydE1hcC5nZXQocmVtb3RlUG9ydCkhO1xuXHRcdFx0dmFsdWUucmVmY291bnQgPSAwO1xuXHRcdFx0YXdhaXQgdGhpcy50cnlEaXNwb3NlVHVubmVsKHJlbW90ZUhvc3QsIHJlbW90ZVBvcnQsIHZhbHVlKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWRkVHVubmVsVG9NYXAocmVtb3RlSG9zdDogc3RyaW5nLCByZW1vdGVQb3J0OiBudW1iZXIsIHR1bm5lbDogUHJvbWlzZTxSZW1vdGVUdW5uZWwgfCBzdHJpbmcgfCB1bmRlZmluZWQ+KSB7XG5cdFx0aWYgKCF0aGlzLl90dW5uZWxzLmhhcyhyZW1vdGVIb3N0KSkge1xuXHRcdFx0dGhpcy5fdHVubmVscy5zZXQocmVtb3RlSG9zdCwgbmV3IE1hcCgpKTtcblx0XHR9XG5cdFx0dGhpcy5fdHVubmVscy5nZXQocmVtb3RlSG9zdCkhLnNldChyZW1vdGVQb3J0LCB7IHJlZmNvdW50OiAxLCB2YWx1ZTogdHVubmVsIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZW1vdmVFbXB0eU9yRXJyb3JUdW5uZWxGcm9tTWFwKHJlbW90ZUhvc3Q6IHN0cmluZywgcmVtb3RlUG9ydDogbnVtYmVyKSB7XG5cdFx0Y29uc3QgaG9zdE1hcCA9IHRoaXMuX3R1bm5lbHMuZ2V0KHJlbW90ZUhvc3QpO1xuXHRcdGlmIChob3N0TWFwKSB7XG5cdFx0XHRjb25zdCB0dW5uZWwgPSBob3N0TWFwLmdldChyZW1vdGVQb3J0KTtcblx0XHRcdGNvbnN0IHR1bm5lbFJlc3VsdCA9IHR1bm5lbCA/IGF3YWl0IHR1bm5lbC52YWx1ZSA6IHVuZGVmaW5lZDtcblx0XHRcdGlmICghdHVubmVsUmVzdWx0IHx8ICh0eXBlb2YgdHVubmVsUmVzdWx0ID09PSAnc3RyaW5nJykpIHtcblx0XHRcdFx0aG9zdE1hcC5kZWxldGUocmVtb3RlUG9ydCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoaG9zdE1hcC5zaXplID09PSAwKSB7XG5cdFx0XHRcdHRoaXMuX3R1bm5lbHMuZGVsZXRlKHJlbW90ZUhvc3QpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBnZXRUdW5uZWxGcm9tTWFwKHJlbW90ZUhvc3Q6IHN0cmluZywgcmVtb3RlUG9ydDogbnVtYmVyKTogeyByZWZjb3VudDogbnVtYmVyOyByZWFkb25seSB2YWx1ZTogUHJvbWlzZTxSZW1vdGVUdW5uZWwgfCBzdHJpbmcgfCB1bmRlZmluZWQ+IH0gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGhvc3RzID0gW3JlbW90ZUhvc3RdO1xuXHRcdC8vIE9yZGVyIG1hdHRlcnMuIFdlIHdhbnQgdGhlIG9yaWdpbmFsIGhvc3QgdG8gYmUgZmlyc3QuXG5cdFx0aWYgKGlzTG9jYWxob3N0KHJlbW90ZUhvc3QpKSB7XG5cdFx0XHRob3N0cy5wdXNoKC4uLkxPQ0FMSE9TVF9BRERSRVNTRVMpO1xuXHRcdFx0Ly8gRm9yIGxvY2FsaG9zdCwgd2UgYWRkIHRoZSBhbGwgaW50ZXJmYWNlcyBob3N0cyBiZWNhdXNlIGlmIHRoZSB0dW5uZWwgaXMgYWxyZWFkeSBhdmFpbGFibGUgYXQgYWxsIGludGVyZmFjZXMsXG5cdFx0XHQvLyB0aGVuIG9mIGNvdXJzZSBpdCBpcyBhdmFpbGFibGUgYXQgbG9jYWxob3N0LlxuXHRcdFx0aG9zdHMucHVzaCguLi5BTExfSU5URVJGQUNFU19BRERSRVNTRVMpO1xuXHRcdH0gZWxzZSBpZiAoaXNBbGxJbnRlcmZhY2VzKHJlbW90ZUhvc3QpKSB7XG5cdFx0XHRob3N0cy5wdXNoKC4uLkFMTF9JTlRFUkZBQ0VTX0FERFJFU1NFUyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXhpc3RpbmdQb3J0TWFwcyA9IGhvc3RzLm1hcChob3N0ID0+IHRoaXMuX3R1bm5lbHMuZ2V0KGhvc3QpKTtcblx0XHRmb3IgKGNvbnN0IG1hcCBvZiBleGlzdGluZ1BvcnRNYXBzKSB7XG5cdFx0XHRjb25zdCBleGlzdGluZ1R1bm5lbCA9IG1hcD8uZ2V0KHJlbW90ZVBvcnQpO1xuXHRcdFx0aWYgKGV4aXN0aW5nVHVubmVsKSB7XG5cdFx0XHRcdHJldHVybiBleGlzdGluZ1R1bm5lbDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGNhblR1bm5lbCh1cmk6IFVSSSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIWV4dHJhY3RMb2NhbEhvc3RVcmlNZXRhRGF0YUZvclBvcnRNYXBwaW5nKHVyaSk7XG5cdH1cblxuXHRwdWJsaWMgYWJzdHJhY3QgaXNQb3J0UHJpdmlsZWdlZChwb3J0OiBudW1iZXIpOiBib29sZWFuO1xuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCByZXRhaW5PckNyZWF0ZVR1bm5lbChhZGRyZXNzUHJvdmlkZXI6IElBZGRyZXNzUHJvdmlkZXIgfCBJVHVubmVsUHJvdmlkZXIsIHJlbW90ZUhvc3Q6IHN0cmluZywgcmVtb3RlUG9ydDogbnVtYmVyLCBsb2NhbEhvc3Q6IHN0cmluZywgbG9jYWxQb3J0OiBudW1iZXIgfCB1bmRlZmluZWQsIGVsZXZhdGVJZk5lZWRlZDogYm9vbGVhbiwgcHJpdmFjeT86IHN0cmluZywgcHJvdG9jb2w/OiBzdHJpbmcpOiBQcm9taXNlPFJlbW90ZVR1bm5lbCB8IHN0cmluZyB8IHVuZGVmaW5lZD4gfCB1bmRlZmluZWQ7XG5cblx0cHJvdGVjdGVkIGNyZWF0ZVdpdGhQcm92aWRlcih0dW5uZWxQcm92aWRlcjogSVR1bm5lbFByb3ZpZGVyLCByZW1vdGVIb3N0OiBzdHJpbmcsIHJlbW90ZVBvcnQ6IG51bWJlciwgbG9jYWxQb3J0OiBudW1iZXIgfCB1bmRlZmluZWQsIGVsZXZhdGVJZk5lZWRlZDogYm9vbGVhbiwgcHJpdmFjeT86IHN0cmluZywgcHJvdG9jb2w/OiBzdHJpbmcpOiBQcm9taXNlPFJlbW90ZVR1bm5lbCB8IHN0cmluZyB8IHVuZGVmaW5lZD4gfCB1bmRlZmluZWQge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgRm9yd2FyZGVkUG9ydHM6IChUdW5uZWxTZXJ2aWNlKSBDcmVhdGluZyB0dW5uZWwgd2l0aCBwcm92aWRlciAke3JlbW90ZUhvc3R9OiR7cmVtb3RlUG9ydH0gb24gbG9jYWwgcG9ydCAke2xvY2FsUG9ydH0uYCk7XG5cdFx0Y29uc3Qga2V5ID0gcmVtb3RlUG9ydDtcblx0XHR0aGlzLl9mYWN0b3J5SW5Qcm9ncmVzcy5hZGQoa2V5KTtcblx0XHRjb25zdCBwcmVmZXJyZWRMb2NhbFBvcnQgPSBsb2NhbFBvcnQgPT09IHVuZGVmaW5lZCA/IHJlbW90ZVBvcnQgOiBsb2NhbFBvcnQ7XG5cdFx0Y29uc3QgY3JlYXRpb25JbmZvID0geyBlbGV2YXRpb25SZXF1aXJlZDogZWxldmF0ZUlmTmVlZGVkID8gdGhpcy5pc1BvcnRQcml2aWxlZ2VkKHByZWZlcnJlZExvY2FsUG9ydCkgOiBmYWxzZSB9O1xuXHRcdGNvbnN0IHR1bm5lbE9wdGlvbnM6IFR1bm5lbE9wdGlvbnMgPSB7IHJlbW90ZUFkZHJlc3M6IHsgaG9zdDogcmVtb3RlSG9zdCwgcG9ydDogcmVtb3RlUG9ydCB9LCBsb2NhbEFkZHJlc3NQb3J0OiBsb2NhbFBvcnQsIHByaXZhY3ksIHB1YmxpYzogcHJpdmFjeSA/IChwcml2YWN5ICE9PSBUdW5uZWxQcml2YWN5SWQuUHJpdmF0ZSkgOiB1bmRlZmluZWQsIHByb3RvY29sIH07XG5cdFx0Y29uc3QgdHVubmVsID0gdHVubmVsUHJvdmlkZXIuZm9yd2FyZFBvcnQodHVubmVsT3B0aW9ucywgY3JlYXRpb25JbmZvKTtcblx0XHRpZiAodHVubmVsKSB7XG5cdFx0XHR0aGlzLmFkZFR1bm5lbFRvTWFwKHJlbW90ZUhvc3QsIHJlbW90ZVBvcnQsIHR1bm5lbCk7XG5cdFx0XHR0dW5uZWwuZmluYWxseSgoKSA9PiB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnRm9yd2FyZGVkUG9ydHM6IChUdW5uZWxTZXJ2aWNlKSBUdW5uZWwgY3JlYXRlZCBieSBwcm92aWRlci4nKTtcblx0XHRcdFx0dGhpcy5fZmFjdG9yeUluUHJvZ3Jlc3MuZGVsZXRlKGtleSk7XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fZmFjdG9yeUluUHJvZ3Jlc3MuZGVsZXRlKGtleSk7XG5cdFx0fVxuXHRcdHJldHVybiB0dW5uZWw7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBTUEsU0FBUyxlQUFzQjtBQUMvQixTQUFzQixrQkFBa0I7QUFDeEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsbUJBQW1CO0FBSXJCLE1BQU0saUJBQWlCLGdCQUFnQyxlQUFlO0FBQ3RFLE1BQU0sd0JBQXdCLGdC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RztBQUFBLEVBQ3ZEO0FBQUEsRUFNVSxtQkFBbUIsZ0JBQWlDLFlBQW9CLFlBQW9CLFdBQStCLGlCQUEwQixTQUFrQixVQUEyRTtBQUMzUCxTQUFLLFdBQVcsTUFBTSxpRUFBaUUsVUFBVSxJQUFJLFVBQVUsa0JBQWtCLFNBQVMsR0FBRztBQUM3SSxVQUFNLE1BQU07QUFDWixTQUFLLG1CQUFtQixJQUFJLEdBQUc7QUFDL0IsVUFBTSxxQkFBcUIsY0FBYyxTQUFZLGFBQWE7QUFDbEUsVUFBTSxlQUFlLEVBQUUsbUJBQW1CLGtCQUFrQixLQUFLLGlCQUFpQixrQkFBa0IsSUFBSSxNQUFNO0FBQzlHLFVBQU0sZ0JBQStCLEVBQUUsZUFBZSxFQUFFLE1BQU0sWUFBWSxNQUFNLFdBQVcsR0FBRyxrQkFBa0IsV0FBVyxTQUFTLFFBQVEsVUFBVyxZQUFZLDBCQUEyQixRQUFXLFNBQVM7QUFDbE4sVUFBTSxTQUFTLGVBQWUsWUFBWSxlQUFlLFlBQVk7QUFDckUsUUFBSSxRQUFRO0FBQ1gsV0FBSyxlQUFlLFlBQVksWUFBWSxNQUFNO0FBQ2xELGFBQU8sUUFBUSxNQUFNO0FBQ3BCLGFBQUssV0FBVyxNQUFNLDZEQUE2RDtBQUNuRixhQUFLLG1CQUFtQixPQUFPLEdBQUc7QUFBQSxNQUNuQyxDQUFDO0FBQUEsSUFDRixPQUFPO0FBQ04sV0FBSyxtQkFBbUIsT0FBTyxHQUFHO0FBQUEsSUFDbkM7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBdlNzQix3QkFBZjtBQUFBLEVBaUJKO0FBQUEsRUFDQTtBQUFBLEdBbEJtQjsiLAogICJuYW1lcyI6IFsiVHVubmVsUHJvdG9jb2wiLCAiVHVubmVsUHJpdmFjeUlkIiwgIlByb3ZpZGVkT25BdXRvRm9yd2FyZCIsICJ0dW5uZWwiXQp9Cg==
