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
import { debounce } from "../../../../base/common/decorators.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { hash } from "../../../../base/common/hash.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IRemoteAuthorityResolverService } from "../../../../platform/remote/common/remoteAuthorityResolver.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITunnelService, TunnelProtocol, TunnelPrivacyId, LOCALHOST_ADDRESSES, isLocalhost, isAllInterfaces, ProvidedOnAutoForward, ALL_INTERFACES_ADDRESSES } from "../../../../platform/tunnel/common/tunnel.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { isNumber, isObject, isString } from "../../../../base/common/types.js";
import { deepClone } from "../../../../base/common/objects.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
const MISMATCH_LOCAL_PORT_COOLDOWN = 10 * 1e3;
const TUNNELS_TO_RESTORE = "remote.tunnels.toRestore";
const TUNNELS_TO_RESTORE_EXPIRATION = "remote.tunnels.toRestoreExpiration";
const RESTORE_EXPIRATION_TIME = 1e3 * 60 * 60 * 24 * 14;
const ACTIVATION_EVENT = "onTunnel";
const forwardedPortsFeaturesEnabled = new RawContextKey("forwardedPortsViewEnabled", false, nls.localize("tunnel.forwardedPortsViewEnabled", "Whether the Ports view is enabled."));
const forwardedPortsViewEnabled = new RawContextKey("forwardedPortsViewOnlyEnabled", false, nls.localize("tunnel.forwardedPortsViewEnabled", "Whether the Ports view is enabled."));
function parseAddress(address) {
  const matches = address.match(/^([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*:)?([0-9]+)$/);
  if (!matches) {
    return void 0;
  }
  return { host: matches[1]?.substring(0, matches[1].length - 1) || "localhost", port: Number(matches[2]) };
}
var TunnelCloseReason = /* @__PURE__ */ ((TunnelCloseReason2) => {
  TunnelCloseReason2["Other"] = "Other";
  TunnelCloseReason2["User"] = "User";
  TunnelCloseReason2["AutoForwardEnd"] = "AutoForwardEnd";
  return TunnelCloseReason2;
})(TunnelCloseReason || {});
var TunnelSource = /* @__PURE__ */ ((TunnelSource2) => {
  TunnelSource2[TunnelSource2["User"] = 0] = "User";
  TunnelSource2[TunnelSource2["Auto"] = 1] = "Auto";
  TunnelSource2[TunnelSource2["Extension"] = 2] = "Extension";
  return TunnelSource2;
})(TunnelSource || {});
const UserTunnelSource = {
  source: 0 /* User */,
  description: nls.localize("tunnel.source.user", "User Forwarded")
};
const AutoTunnelSource = {
  source: 1 /* Auto */,
  description: nls.localize("tunnel.source.auto", "Auto Forwarded")
};
function mapHasAddress(map, host, port) {
  const initialAddress = map.get(makeAddress(host, port));
  if (initialAddress) {
    return initialAddress;
  }
  if (isLocalhost(host)) {
    for (const testHost of LOCALHOST_ADDRESSES) {
      const testAddress = makeAddress(testHost, port);
      if (map.has(testAddress)) {
        return map.get(testAddress);
      }
    }
  } else if (isAllInterfaces(host)) {
    for (const testHost of ALL_INTERFACES_ADDRESSES) {
      const testAddress = makeAddress(testHost, port);
      if (map.has(testAddress)) {
        return map.get(testAddress);
      }
    }
  }
  return void 0;
}
function mapHasAddressLocalhostOrAllInterfaces(map, host, port) {
  const originalAddress = mapHasAddress(map, host, port);
  if (originalAddress) {
    return originalAddress;
  }
  const otherHost = isAllInterfaces(host) ? "localhost" : isLocalhost(host) ? "0.0.0.0" : void 0;
  if (otherHost) {
    return mapHasAddress(map, otherHost, port);
  }
  return void 0;
}
function makeAddress(host, port) {
  return host + ":" + port;
}
var OnPortForward = /* @__PURE__ */ ((OnPortForward2) => {
  OnPortForward2["Notify"] = "notify";
  OnPortForward2["OpenBrowser"] = "openBrowser";
  OnPortForward2["OpenBrowserOnce"] = "openBrowserOnce";
  OnPortForward2["OpenPreview"] = "openPreview";
  OnPortForward2["Silent"] = "silent";
  OnPortForward2["Ignore"] = "ignore";
  return OnPortForward2;
})(OnPortForward || {});
function isCandidatePort(candidate) {
  return candidate && "host" in candidate && typeof candidate.host === "string" && "port" in candidate && typeof candidate.port === "number" && (!("detail" in candidate) || typeof candidate.detail === "string") && (!("pid" in candidate) || typeof candidate.pid === "string");
}
const _PortsAttributes = class _PortsAttributes extends Disposable {
  constructor(configurationService) {
    super();
    this.configurationService = configurationService;
    this.portsAttributes = [];
    this._onDidChangeAttributes = new Emitter();
    this.onDidChangeAttributes = this._onDidChangeAttributes.event;
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(_PortsAttributes.SETTING) || e.affectsConfiguration(_PortsAttributes.DEFAULTS)) {
        this.updateAttributes();
      }
    }));
    this.updateAttributes();
  }
  updateAttributes() {
    this.portsAttributes = this.readSetting();
    this._onDidChangeAttributes.fire();
  }
  getAttributes(port, host, commandLine) {
    let index = this.findNextIndex(port, host, commandLine, this.portsAttributes, 0);
    const attributes = {
      label: void 0,
      onAutoForward: void 0,
      elevateIfNeeded: void 0,
      requireLocalPort: void 0,
      protocol: void 0
    };
    while (index >= 0) {
      const found = this.portsAttributes[index];
      if (found.key === port) {
        attributes.onAutoForward = found.onAutoForward ?? attributes.onAutoForward;
        attributes.elevateIfNeeded = found.elevateIfNeeded !== void 0 ? found.elevateIfNeeded : attributes.elevateIfNeeded;
        attributes.label = found.label ?? attributes.label;
        attributes.requireLocalPort = found.requireLocalPort;
        attributes.protocol = found.protocol;
      } else {
        attributes.onAutoForward = attributes.onAutoForward ?? found.onAutoForward;
        attributes.elevateIfNeeded = attributes.elevateIfNeeded !== void 0 ? attributes.elevateIfNeeded : found.elevateIfNeeded;
        attributes.label = attributes.label ?? found.label;
        attributes.requireLocalPort = attributes.requireLocalPort !== void 0 ? attributes.requireLocalPort : void 0;
        attributes.protocol = attributes.protocol ?? found.protocol;
      }
      index = this.findNextIndex(port, host, commandLine, this.portsAttributes, index + 1);
    }
    if (attributes.onAutoForward !== void 0 || attributes.elevateIfNeeded !== void 0 || attributes.label !== void 0 || attributes.requireLocalPort !== void 0 || attributes.protocol !== void 0) {
      return attributes;
    }
    return this.getOtherAttributes();
  }
  hasStartEnd(value) {
    return value.start !== void 0 && value.end !== void 0;
  }
  hasHostAndPort(value) {
    return value.host !== void 0 && value.port !== void 0 && isString(value.host) && isNumber(value.port);
  }
  findNextIndex(port, host, commandLine, attributes, fromIndex) {
    if (fromIndex >= attributes.length) {
      return -1;
    }
    const shouldUseHost = !isLocalhost(host) && !isAllInterfaces(host);
    const sliced = attributes.slice(fromIndex);
    const foundIndex = sliced.findIndex((value) => {
      if (isNumber(value.key)) {
        return shouldUseHost ? false : value.key === port;
      } else if (this.hasStartEnd(value.key)) {
        return shouldUseHost ? false : port >= value.key.start && port <= value.key.end;
      } else if (this.hasHostAndPort(value.key)) {
        return port === value.key.port && host === value.key.host;
      } else {
        return commandLine ? value.key.test(commandLine) : false;
      }
    });
    return foundIndex >= 0 ? foundIndex + fromIndex : -1;
  }
  readSetting() {
    const settingValue = this.configurationService.getValue(_PortsAttributes.SETTING);
    if (!settingValue || !isObject(settingValue)) {
      return [];
    }
    const attributes = [];
    for (const attributesKey in settingValue) {
      if (attributesKey === void 0) {
        continue;
      }
      const setting = settingValue[attributesKey];
      let key = void 0;
      if (Number(attributesKey)) {
        key = Number(attributesKey);
      } else if (isString(attributesKey)) {
        if (_PortsAttributes.RANGE.test(attributesKey)) {
          const match = attributesKey.match(_PortsAttributes.RANGE);
          key = { start: Number(match[1]), end: Number(match[2]) };
        } else if (_PortsAttributes.HOST_AND_PORT.test(attributesKey)) {
          const match = attributesKey.match(_PortsAttributes.HOST_AND_PORT);
          key = { host: match[1], port: Number(match[2]) };
        } else {
          let regTest = void 0;
          try {
            regTest = RegExp(attributesKey);
          } catch (e) {
          }
          if (regTest) {
            key = regTest;
          }
        }
      }
      if (!key) {
        continue;
      }
      attributes.push({
        key,
        elevateIfNeeded: setting.elevateIfNeeded,
        onAutoForward: setting.onAutoForward,
        label: setting.label,
        requireLocalPort: setting.requireLocalPort,
        protocol: setting.protocol
      });
    }
    const defaults = this.configurationService.getValue(_PortsAttributes.DEFAULTS);
    if (defaults) {
      this.defaultPortAttributes = {
        elevateIfNeeded: defaults.elevateIfNeeded,
        label: defaults.label,
        onAutoForward: defaults.onAutoForward,
        requireLocalPort: defaults.requireLocalPort,
        protocol: defaults.protocol
      };
    }
    return this.sortAttributes(attributes);
  }
  sortAttributes(attributes) {
    function getVal(item, thisRef) {
      if (isNumber(item.key)) {
        return item.key;
      } else if (thisRef.hasStartEnd(item.key)) {
        return item.key.start;
      } else if (thisRef.hasHostAndPort(item.key)) {
        return item.key.port;
      } else {
        return Number.MAX_VALUE;
      }
    }
    return attributes.sort((a, b) => {
      return getVal(a, this) - getVal(b, this);
    });
  }
  getOtherAttributes() {
    return this.defaultPortAttributes;
  }
  static providedActionToAction(providedAction) {
    switch (providedAction) {
      case ProvidedOnAutoForward.Notify:
        return "notify" /* Notify */;
      case ProvidedOnAutoForward.OpenBrowser:
        return "openBrowser" /* OpenBrowser */;
      case ProvidedOnAutoForward.OpenBrowserOnce:
        return "openBrowserOnce" /* OpenBrowserOnce */;
      case ProvidedOnAutoForward.OpenPreview:
        return "openPreview" /* OpenPreview */;
      case ProvidedOnAutoForward.Silent:
        return "silent" /* Silent */;
      case ProvidedOnAutoForward.Ignore:
        return "ignore" /* Ignore */;
      default:
        return void 0;
    }
  }
  async addAttributes(port, attributes, target) {
    const settingValue = this.configurationService.inspect(_PortsAttributes.SETTING);
    const remoteValue = settingValue.userRemoteValue;
    let newRemoteValue;
    if (!remoteValue || !isObject(remoteValue)) {
      newRemoteValue = {};
    } else {
      newRemoteValue = deepClone(remoteValue);
    }
    if (!newRemoteValue[`${port}`]) {
      newRemoteValue[`${port}`] = {};
    }
    for (const attribute in attributes) {
      newRemoteValue[`${port}`][attribute] = attributes[attribute];
    }
    return this.configurationService.updateValue(_PortsAttributes.SETTING, newRemoteValue, target);
  }
};
_PortsAttributes.SETTING = "remote.portsAttributes";
_PortsAttributes.DEFAULTS = "remote.otherPortsAttributes";
_PortsAttributes.RANGE = /^(\d+)\-(\d+)$/;
_PortsAttributes.HOST_AND_PORT = /^([a-z0-9\-]+):(\d{1,5})$/;
let PortsAttributes = _PortsAttributes;
let TunnelModel = class extends Disposable {
  constructor(tunnelService, storageService, configurationService, environmentService, remoteAuthorityResolverService, workspaceContextService, logService, dialogService, extensionService, contextKeyService) {
    super();
    this.tunnelService = tunnelService;
    this.storageService = storageService;
    this.configurationService = configurationService;
    this.environmentService = environmentService;
    this.remoteAuthorityResolverService = remoteAuthorityResolverService;
    this.workspaceContextService = workspaceContextService;
    this.logService = logService;
    this.dialogService = dialogService;
    this.extensionService = extensionService;
    this.contextKeyService = contextKeyService;
    this.inProgress = /* @__PURE__ */ new Map();
    this._onForwardPort = new Emitter();
    this.onForwardPort = this._onForwardPort.event;
    this._onClosePort = new Emitter();
    this.onClosePort = this._onClosePort.event;
    this._onPortName = new Emitter();
    this.onPortName = this._onPortName.event;
    this._onCandidatesChanged = new Emitter();
    // onCandidateChanged returns the removed candidates
    this.onCandidatesChanged = this._onCandidatesChanged.event;
    this._onEnvironmentTunnelsSet = new Emitter();
    this.onEnvironmentTunnelsSet = this._onEnvironmentTunnelsSet.event;
    this._environmentTunnelsSet = false;
    this.restoreListener = void 0;
    this.restoreComplete = false;
    this.onRestoreComplete = new Emitter();
    this.unrestoredExtensionTunnels = /* @__PURE__ */ new Map();
    this.sessionCachedProperties = /* @__PURE__ */ new Map();
    this.portAttributesProviders = [];
    this.hasCheckedExtensionsOnTunnelOpened = false;
    this.mismatchCooldown = /* @__PURE__ */ new Date();
    this.configPortsAttributes = new PortsAttributes(configurationService);
    this.tunnelRestoreValue = this.getTunnelRestoreValue();
    this._register(this.configPortsAttributes.onDidChangeAttributes(this.updateAttributes, this));
    this.forwarded = /* @__PURE__ */ new Map();
    this.remoteTunnels = /* @__PURE__ */ new Map();
    this.tunnelService.tunnels.then(async (tunnels) => {
      const attributes = await this.getAttributes(tunnels.map((tunnel) => {
        return { port: tunnel.tunnelRemotePort, host: tunnel.tunnelRemoteHost };
      }));
      for (const tunnel of tunnels) {
        if (tunnel.localAddress) {
          const key = makeAddress(tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort);
          const matchingCandidate = mapHasAddressLocalhostOrAllInterfaces(this._candidates ?? /* @__PURE__ */ new Map(), tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort);
          this.forwarded.set(key, {
            remotePort: tunnel.tunnelRemotePort,
            remoteHost: tunnel.tunnelRemoteHost,
            localAddress: tunnel.localAddress,
            protocol: attributes?.get(tunnel.tunnelRemotePort)?.protocol ?? TunnelProtocol.Http,
            localUri: await this.makeLocalUri(tunnel.localAddress, attributes?.get(tunnel.tunnelRemotePort)),
            localPort: tunnel.tunnelLocalPort,
            name: attributes?.get(tunnel.tunnelRemotePort)?.label,
            runningProcess: matchingCandidate?.detail,
            hasRunningProcess: !!matchingCandidate,
            pid: matchingCandidate?.pid,
            privacy: tunnel.privacy,
            source: UserTunnelSource
          });
          this.remoteTunnels.set(key, tunnel);
        }
      }
    });
    this.detected = /* @__PURE__ */ new Map();
    this._register(this.tunnelService.onTunnelOpened(async (tunnel) => {
      const key = makeAddress(tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort);
      if (!mapHasAddressLocalhostOrAllInterfaces(this.forwarded, tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort) && !mapHasAddressLocalhostOrAllInterfaces(this.detected, tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort) && !mapHasAddressLocalhostOrAllInterfaces(this.inProgress, tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort) && tunnel.localAddress) {
        const matchingCandidate = mapHasAddressLocalhostOrAllInterfaces(this._candidates ?? /* @__PURE__ */ new Map(), tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort);
        const attributes = (await this.getAttributes([{ port: tunnel.tunnelRemotePort, host: tunnel.tunnelRemoteHost }]))?.get(tunnel.tunnelRemotePort);
        this.forwarded.set(key, {
          remoteHost: tunnel.tunnelRemoteHost,
          remotePort: tunnel.tunnelRemotePort,
          localAddress: tunnel.localAddress,
          protocol: attributes?.protocol ?? TunnelProtocol.Http,
          localUri: await this.makeLocalUri(tunnel.localAddress, attributes),
          localPort: tunnel.tunnelLocalPort,
          name: attributes?.label,
          closeable: true,
          runningProcess: matchingCandidate?.detail,
          hasRunningProcess: !!matchingCandidate,
          pid: matchingCandidate?.pid,
          privacy: tunnel.privacy,
          source: UserTunnelSource
        });
      }
      await this.storeForwarded();
      this.checkExtensionActivationEvents(true);
      this.remoteTunnels.set(key, tunnel);
      this._onForwardPort.fire(this.forwarded.get(key));
    }));
    this._register(this.tunnelService.onTunnelClosed((address) => {
      return this.onTunnelClosed(address, "Other" /* Other */);
    }));
    this.checkExtensionActivationEvents(false);
  }
  extensionHasActivationEvent() {
    if (this.extensionService.extensions.find((extension) => extension.activationEvents?.includes(ACTIVATION_EVENT))) {
      this.contextKeyService.createKey(forwardedPortsViewEnabled.key, true);
      return true;
    }
    return false;
  }
  checkExtensionActivationEvents(tunnelOpened) {
    if (this.hasCheckedExtensionsOnTunnelOpened) {
      return;
    }
    if (tunnelOpened) {
      this.hasCheckedExtensionsOnTunnelOpened = true;
    }
    const hasRemote = this.environmentService.remoteAuthority !== void 0;
    if (hasRemote && !tunnelOpened) {
      return;
    }
    if (this.extensionHasActivationEvent()) {
      return;
    }
    const activationDisposable = this._register(this.extensionService.onDidRegisterExtensions(() => {
      if (this.extensionHasActivationEvent()) {
        activationDisposable.dispose();
      }
    }));
  }
  async onTunnelClosed(address, reason) {
    const key = makeAddress(address.host, address.port);
    if (this.forwarded.has(key)) {
      this.forwarded.delete(key);
      await this.storeForwarded();
      this._onClosePort.fire(address);
    }
  }
  makeLocalUri(localAddress, attributes) {
    if (localAddress.startsWith("http")) {
      return URI.parse(localAddress);
    }
    const protocol = attributes?.protocol ?? "http";
    return URI.parse(`${protocol}://${localAddress}`);
  }
  async addStorageKeyPostfix(prefix) {
    const workspace = this.workspaceContextService.getWorkspace();
    const workspaceHash = workspace.configuration ? hash(workspace.configuration.path) : workspace.folders.length > 0 ? hash(workspace.folders[0].uri.path) : void 0;
    if (workspaceHash === void 0) {
      this.logService.debug("Could not get workspace hash for forwarded ports storage key.");
      return void 0;
    }
    return `${prefix}.${this.environmentService.remoteAuthority}.${workspaceHash}`;
  }
  async getTunnelRestoreStorageKey() {
    return this.addStorageKeyPostfix(TUNNELS_TO_RESTORE);
  }
  async getRestoreExpirationStorageKey() {
    return this.addStorageKeyPostfix(TUNNELS_TO_RESTORE_EXPIRATION);
  }
  async getTunnelRestoreValue() {
    const deprecatedValue = this.storageService.get(TUNNELS_TO_RESTORE, StorageScope.WORKSPACE);
    if (deprecatedValue) {
      this.storageService.remove(TUNNELS_TO_RESTORE, StorageScope.WORKSPACE);
      await this.storeForwarded();
      return deprecatedValue;
    }
    const storageKey = await this.getTunnelRestoreStorageKey();
    if (!storageKey) {
      return void 0;
    }
    return this.storageService.get(storageKey, StorageScope.PROFILE);
  }
  async restoreForwarded() {
    this.cleanupExpiredTunnelsForRestore();
    if (this.configurationService.getValue("remote.restoreForwardedPorts")) {
      const tunnelRestoreValue = await this.tunnelRestoreValue;
      if (tunnelRestoreValue && tunnelRestoreValue !== this.knownPortsRestoreValue) {
        const tunnels = JSON.parse(tunnelRestoreValue) ?? [];
        this.logService.trace(`ForwardedPorts: (TunnelModel) restoring ports ${tunnels.map((tunnel) => tunnel.remotePort).join(", ")}`);
        for (const tunnel of tunnels) {
          const alreadyForwarded = mapHasAddressLocalhostOrAllInterfaces(this.detected, tunnel.remoteHost, tunnel.remotePort);
          if (tunnel.source.source !== 2 /* Extension */ && !alreadyForwarded || tunnel.source.source === 2 /* Extension */ && alreadyForwarded) {
            await this.doForward({
              remote: { host: tunnel.remoteHost, port: tunnel.remotePort },
              local: tunnel.localPort,
              name: tunnel.name,
              elevateIfNeeded: true,
              source: tunnel.source
            });
          } else if (tunnel.source.source === 2 /* Extension */ && !alreadyForwarded) {
            this.unrestoredExtensionTunnels.set(makeAddress(tunnel.remoteHost, tunnel.remotePort), tunnel);
          }
        }
      }
    }
    this.restoreComplete = true;
    this.onRestoreComplete.fire();
    if (!this.restoreListener) {
      const key = await this.getTunnelRestoreStorageKey();
      this.restoreListener = this._register(new DisposableStore());
      this.restoreListener.add(this.storageService.onDidChangeValue(StorageScope.PROFILE, void 0, this.restoreListener)(async (e) => {
        if (e.key === key) {
          this.tunnelRestoreValue = Promise.resolve(this.storageService.get(key, StorageScope.PROFILE));
          await this.restoreForwarded();
        }
      }));
    }
  }
  cleanupExpiredTunnelsForRestore() {
    const keys = this.storageService.keys(StorageScope.PROFILE, StorageTarget.USER).filter((key) => key.startsWith(TUNNELS_TO_RESTORE_EXPIRATION));
    for (const key of keys) {
      const expiration = this.storageService.getNumber(key, StorageScope.PROFILE);
      if (expiration && expiration < Date.now()) {
        this.tunnelRestoreValue = Promise.resolve(void 0);
        const storageKey = key.replace(TUNNELS_TO_RESTORE_EXPIRATION, TUNNELS_TO_RESTORE);
        this.storageService.remove(key, StorageScope.PROFILE);
        this.storageService.remove(storageKey, StorageScope.PROFILE);
      }
    }
  }
  async storeForwarded() {
    if (this.configurationService.getValue("remote.restoreForwardedPorts")) {
      const forwarded = Array.from(this.forwarded.values());
      const restorableTunnels = forwarded.map((tunnel) => {
        return {
          remoteHost: tunnel.remoteHost,
          remotePort: tunnel.remotePort,
          localPort: tunnel.localPort,
          name: tunnel.name,
          localAddress: tunnel.localAddress,
          localUri: tunnel.localUri,
          protocol: tunnel.protocol,
          source: tunnel.source
        };
      });
      let valueToStore;
      if (forwarded.length > 0) {
        valueToStore = JSON.stringify(restorableTunnels);
      }
      const key = await this.getTunnelRestoreStorageKey();
      const expirationKey = await this.getRestoreExpirationStorageKey();
      if (!valueToStore && key && expirationKey) {
        this.storageService.remove(key, StorageScope.PROFILE);
        this.storageService.remove(expirationKey, StorageScope.PROFILE);
      } else if (valueToStore !== this.knownPortsRestoreValue && key && expirationKey) {
        this.storageService.store(key, valueToStore, StorageScope.PROFILE, StorageTarget.USER);
        this.storageService.store(expirationKey, Date.now() + RESTORE_EXPIRATION_TIME, StorageScope.PROFILE, StorageTarget.USER);
      }
      this.knownPortsRestoreValue = valueToStore;
    }
  }
  async showPortMismatchModalIfNeeded(tunnel, expectedLocal, attributes) {
    if (!tunnel.tunnelLocalPort || !attributes?.requireLocalPort) {
      return;
    }
    if (tunnel.tunnelLocalPort === expectedLocal) {
      return;
    }
    const newCooldown = /* @__PURE__ */ new Date();
    if (this.mismatchCooldown.getTime() + MISMATCH_LOCAL_PORT_COOLDOWN > newCooldown.getTime()) {
      return;
    }
    this.mismatchCooldown = newCooldown;
    const mismatchString = nls.localize(
      "remote.localPortMismatch.single",
      "Local port {0} could not be used for forwarding to remote port {1}.\n\nThis usually happens when there is already another process using local port {0}.\n\nPort number {2} has been used instead.",
      expectedLocal,
      tunnel.tunnelRemotePort,
      tunnel.tunnelLocalPort
    );
    return this.dialogService.info(mismatchString);
  }
  async forward(tunnelProperties, attributes) {
    if (!this.restoreComplete && this.environmentService.remoteAuthority) {
      await Event.toPromise(this.onRestoreComplete.event);
    }
    return this.doForward(tunnelProperties, attributes);
  }
  async doForward(tunnelProperties, attributes) {
    await this.extensionService.activateByEvent(ACTIVATION_EVENT);
    const existingTunnel = mapHasAddressLocalhostOrAllInterfaces(this.forwarded, tunnelProperties.remote.host, tunnelProperties.remote.port);
    attributes = attributes ?? (attributes !== null ? (await this.getAttributes([tunnelProperties.remote]))?.get(tunnelProperties.remote.port) : void 0);
    const localPort = tunnelProperties.local !== void 0 ? tunnelProperties.local : tunnelProperties.remote.port;
    let noTunnelValue;
    if (!existingTunnel) {
      const authority = this.environmentService.remoteAuthority;
      const addressProvider = authority ? {
        getAddress: async () => {
          return (await this.remoteAuthorityResolverService.resolveAuthority(authority)).authority;
        }
      } : void 0;
      const key = makeAddress(tunnelProperties.remote.host, tunnelProperties.remote.port);
      this.inProgress.set(key, true);
      tunnelProperties = this.mergeCachedAndUnrestoredProperties(key, tunnelProperties);
      const tunnel = await this.tunnelService.openTunnel(addressProvider, tunnelProperties.remote.host, tunnelProperties.remote.port, void 0, localPort, !tunnelProperties.elevateIfNeeded ? attributes?.elevateIfNeeded : tunnelProperties.elevateIfNeeded, tunnelProperties.privacy, attributes?.protocol);
      if (typeof tunnel === "string") {
        noTunnelValue = tunnel;
      } else if (tunnel && tunnel.localAddress) {
        const matchingCandidate = mapHasAddressLocalhostOrAllInterfaces(this._candidates ?? /* @__PURE__ */ new Map(), tunnelProperties.remote.host, tunnelProperties.remote.port);
        const protocol = tunnel.protocol ? tunnel.protocol === TunnelProtocol.Https ? TunnelProtocol.Https : TunnelProtocol.Http : attributes?.protocol ?? TunnelProtocol.Http;
        const newForward = {
          remoteHost: tunnel.tunnelRemoteHost,
          remotePort: tunnel.tunnelRemotePort,
          localPort: tunnel.tunnelLocalPort,
          name: attributes?.label ?? tunnelProperties.name,
          closeable: true,
          localAddress: tunnel.localAddress,
          protocol,
          localUri: await this.makeLocalUri(tunnel.localAddress, attributes),
          runningProcess: matchingCandidate?.detail,
          hasRunningProcess: !!matchingCandidate,
          pid: matchingCandidate?.pid,
          source: tunnelProperties.source ?? UserTunnelSource,
          privacy: tunnel.privacy
        };
        this.forwarded.set(key, newForward);
        this.remoteTunnels.set(key, tunnel);
        this.inProgress.delete(key);
        await this.storeForwarded();
        await this.showPortMismatchModalIfNeeded(tunnel, localPort, attributes);
        this._onForwardPort.fire(newForward);
        return tunnel;
      }
      this.inProgress.delete(key);
    } else {
      return this.mergeAttributesIntoExistingTunnel(existingTunnel, tunnelProperties, attributes);
    }
    return noTunnelValue;
  }
  mergeCachedAndUnrestoredProperties(key, tunnelProperties) {
    const map = this.unrestoredExtensionTunnels.has(key) ? this.unrestoredExtensionTunnels : this.sessionCachedProperties.has(key) ? this.sessionCachedProperties : void 0;
    if (map) {
      const updateProps = map.get(key);
      map.delete(key);
      if (updateProps) {
        tunnelProperties.name = updateProps.name ?? tunnelProperties.name;
        tunnelProperties.local = ("local" in updateProps ? updateProps.local : "localPort" in updateProps ? updateProps.localPort : void 0) ?? tunnelProperties.local;
        tunnelProperties.privacy = tunnelProperties.privacy;
      }
    }
    return tunnelProperties;
  }
  async mergeAttributesIntoExistingTunnel(existingTunnel, tunnelProperties, attributes) {
    const newName = attributes?.label ?? tunnelProperties.name;
    let MergedAttributeAction;
    ((MergedAttributeAction2) => {
      MergedAttributeAction2[MergedAttributeAction2["None"] = 0] = "None";
      MergedAttributeAction2[MergedAttributeAction2["Fire"] = 1] = "Fire";
      MergedAttributeAction2[MergedAttributeAction2["Reopen"] = 2] = "Reopen";
    })(MergedAttributeAction || (MergedAttributeAction = {}));
    let mergedAction = 0 /* None */;
    if (newName !== existingTunnel.name) {
      existingTunnel.name = newName;
      mergedAction = 1 /* Fire */;
    }
    if ((attributes?.protocol || existingTunnel.protocol !== TunnelProtocol.Http) && attributes?.protocol !== existingTunnel.protocol) {
      tunnelProperties.source = existingTunnel.source;
      mergedAction = 2 /* Reopen */;
    }
    if (tunnelProperties.privacy && existingTunnel.privacy !== tunnelProperties.privacy) {
      mergedAction = 2 /* Reopen */;
    }
    switch (mergedAction) {
      case 1 /* Fire */: {
        this._onForwardPort.fire();
        break;
      }
      case 2 /* Reopen */: {
        await this.close(existingTunnel.remoteHost, existingTunnel.remotePort, "User" /* User */);
        await this.doForward(tunnelProperties, attributes);
      }
    }
    return mapHasAddressLocalhostOrAllInterfaces(this.remoteTunnels, tunnelProperties.remote.host, tunnelProperties.remote.port);
  }
  async name(host, port, name) {
    const existingForwarded = mapHasAddressLocalhostOrAllInterfaces(this.forwarded, host, port);
    const key = makeAddress(host, port);
    if (existingForwarded) {
      existingForwarded.name = name;
      await this.storeForwarded();
      this._onPortName.fire({ host, port });
      return;
    } else if (this.detected.has(key)) {
      this.detected.get(key).name = name;
      this._onPortName.fire({ host, port });
    }
  }
  async close(host, port, reason) {
    const key = makeAddress(host, port);
    const oldTunnel = this.forwarded.get(key);
    if (reason === "AutoForwardEnd" /* AutoForwardEnd */ && oldTunnel && oldTunnel.source.source === 1 /* Auto */) {
      this.sessionCachedProperties.set(key, {
        local: oldTunnel.localPort,
        name: oldTunnel.name,
        privacy: oldTunnel.privacy
      });
    }
    await this.tunnelService.closeTunnel(host, port);
    return this.onTunnelClosed({ host, port }, reason);
  }
  address(host, port) {
    const key = makeAddress(host, port);
    return (this.forwarded.get(key) || this.detected.get(key))?.localAddress;
  }
  get environmentTunnelsSet() {
    return this._environmentTunnelsSet;
  }
  addEnvironmentTunnels(tunnels) {
    if (tunnels) {
      for (const tunnel of tunnels) {
        const matchingCandidate = mapHasAddressLocalhostOrAllInterfaces(this._candidates ?? /* @__PURE__ */ new Map(), tunnel.remoteAddress.host, tunnel.remoteAddress.port);
        const localAddress = typeof tunnel.localAddress === "string" ? tunnel.localAddress : makeAddress(tunnel.localAddress.host, tunnel.localAddress.port);
        this.detected.set(makeAddress(tunnel.remoteAddress.host, tunnel.remoteAddress.port), {
          remoteHost: tunnel.remoteAddress.host,
          remotePort: tunnel.remoteAddress.port,
          localAddress,
          protocol: TunnelProtocol.Http,
          localUri: this.makeLocalUri(localAddress),
          closeable: false,
          runningProcess: matchingCandidate?.detail,
          hasRunningProcess: !!matchingCandidate,
          pid: matchingCandidate?.pid,
          privacy: TunnelPrivacyId.ConstantPrivate,
          source: {
            source: 2 /* Extension */,
            description: nls.localize("tunnel.staticallyForwarded", "Statically Forwarded")
          }
        });
        this.tunnelService.setEnvironmentTunnel(tunnel.remoteAddress.host, tunnel.remoteAddress.port, localAddress, TunnelPrivacyId.ConstantPrivate, TunnelProtocol.Http);
      }
    }
    this._environmentTunnelsSet = true;
    this._onEnvironmentTunnelsSet.fire();
    this._onForwardPort.fire();
  }
  setCandidateFilter(filter) {
    this._candidateFilter = filter;
  }
  async setCandidates(candidates) {
    let processedCandidates = candidates;
    if (this._candidateFilter) {
      processedCandidates = await this._candidateFilter(candidates);
    }
    const removedCandidates = this.updateInResponseToCandidates(processedCandidates);
    this.logService.trace(`ForwardedPorts: (TunnelModel) removed candidates ${Array.from(removedCandidates.values()).map((candidate) => candidate.port).join(", ")}`);
    this._onCandidatesChanged.fire(removedCandidates);
  }
  // Returns removed candidates
  updateInResponseToCandidates(candidates) {
    const removedCandidates = this._candidates ?? /* @__PURE__ */ new Map();
    const candidatesMap = /* @__PURE__ */ new Map();
    this._candidates = candidatesMap;
    candidates.forEach((value) => {
      const addressKey = makeAddress(value.host, value.port);
      candidatesMap.set(addressKey, {
        host: value.host,
        port: value.port,
        detail: value.detail,
        pid: value.pid
      });
      if (removedCandidates.has(addressKey)) {
        removedCandidates.delete(addressKey);
      }
      const forwardedValue = mapHasAddressLocalhostOrAllInterfaces(this.forwarded, value.host, value.port);
      if (forwardedValue) {
        forwardedValue.runningProcess = value.detail;
        forwardedValue.hasRunningProcess = true;
        forwardedValue.pid = value.pid;
      }
    });
    removedCandidates.forEach((_value, key) => {
      const parsedAddress = parseAddress(key);
      if (!parsedAddress) {
        return;
      }
      const forwardedValue = mapHasAddressLocalhostOrAllInterfaces(this.forwarded, parsedAddress.host, parsedAddress.port);
      if (forwardedValue) {
        forwardedValue.runningProcess = void 0;
        forwardedValue.hasRunningProcess = false;
        forwardedValue.pid = void 0;
      }
      const detectedValue = mapHasAddressLocalhostOrAllInterfaces(this.detected, parsedAddress.host, parsedAddress.port);
      if (detectedValue) {
        detectedValue.runningProcess = void 0;
        detectedValue.hasRunningProcess = false;
        detectedValue.pid = void 0;
      }
    });
    return removedCandidates;
  }
  get candidates() {
    return this._candidates ? Array.from(this._candidates.values()) : [];
  }
  get candidatesOrUndefined() {
    return this._candidates ? this.candidates : void 0;
  }
  async updateAttributes() {
    const tunnels = Array.from(this.forwarded.values());
    const allAttributes = await this.getAttributes(tunnels.map((tunnel) => {
      return { port: tunnel.remotePort, host: tunnel.remoteHost };
    }), false);
    if (!allAttributes) {
      return;
    }
    for (const forwarded of tunnels) {
      const attributes = allAttributes.get(forwarded.remotePort);
      if ((attributes?.protocol || forwarded.protocol !== TunnelProtocol.Http) && attributes?.protocol !== forwarded.protocol) {
        await this.doForward({
          remote: { host: forwarded.remoteHost, port: forwarded.remotePort },
          local: forwarded.localPort,
          name: forwarded.name,
          source: forwarded.source
        }, attributes);
      }
      if (!attributes) {
        continue;
      }
      if (attributes.label && attributes.label !== forwarded.name) {
        await this.name(forwarded.remoteHost, forwarded.remotePort, attributes.label);
      }
    }
  }
  async getAttributes(forwardedPorts, checkProviders = true) {
    const matchingCandidates = /* @__PURE__ */ new Map();
    const pidToPortsMapping = /* @__PURE__ */ new Map();
    forwardedPorts.forEach((forwardedPort) => {
      const matchingCandidate = mapHasAddressLocalhostOrAllInterfaces(this._candidates ?? /* @__PURE__ */ new Map(), LOCALHOST_ADDRESSES[0], forwardedPort.port) ?? forwardedPort;
      if (matchingCandidate) {
        matchingCandidates.set(forwardedPort.port, matchingCandidate);
        const pid = isCandidatePort(matchingCandidate) ? matchingCandidate.pid : void 0;
        if (!pidToPortsMapping.has(pid)) {
          pidToPortsMapping.set(pid, []);
        }
        pidToPortsMapping.get(pid)?.push(forwardedPort.port);
      }
    });
    const configAttributes = /* @__PURE__ */ new Map();
    forwardedPorts.forEach((forwardedPort) => {
      const attributes = this.configPortsAttributes.getAttributes(forwardedPort.port, forwardedPort.host, matchingCandidates.get(forwardedPort.port)?.detail);
      if (attributes) {
        configAttributes.set(forwardedPort.port, attributes);
      }
    });
    if (this.portAttributesProviders.length === 0 || !checkProviders) {
      return configAttributes.size > 0 ? configAttributes : void 0;
    }
    const allProviderResults = await Promise.all(this.portAttributesProviders.flatMap((provider) => {
      return Array.from(pidToPortsMapping.entries()).map((entry) => {
        const portGroup = entry[1];
        const matchingCandidate = matchingCandidates.get(portGroup[0]);
        return provider.providePortAttributes(
          portGroup,
          matchingCandidate?.pid,
          matchingCandidate?.detail,
          CancellationToken.None
        );
      });
    }));
    const providedAttributes = /* @__PURE__ */ new Map();
    allProviderResults.forEach((attributes) => attributes.forEach((attribute) => {
      if (attribute) {
        providedAttributes.set(attribute.port, attribute);
      }
    }));
    if (!configAttributes && !providedAttributes) {
      return void 0;
    }
    const mergedAttributes = /* @__PURE__ */ new Map();
    forwardedPorts.forEach((forwardedPorts2) => {
      const config = configAttributes.get(forwardedPorts2.port);
      const provider = providedAttributes.get(forwardedPorts2.port);
      mergedAttributes.set(forwardedPorts2.port, {
        elevateIfNeeded: config?.elevateIfNeeded,
        label: config?.label,
        onAutoForward: config?.onAutoForward ?? PortsAttributes.providedActionToAction(provider?.autoForwardAction),
        requireLocalPort: config?.requireLocalPort,
        protocol: config?.protocol
      });
    });
    return mergedAttributes;
  }
  addAttributesProvider(provider) {
    this.portAttributesProviders.push(provider);
  }
};
__decorateClass([
  debounce(1e3)
], TunnelModel.prototype, "storeForwarded", 1);
TunnelModel = __decorateClass([
  __decorateParam(0, ITunnelService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IWorkbenchEnvironmentService),
  __decorateParam(4, IRemoteAuthorityResolverService),
  __decorateParam(5, IWorkspaceContextService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IDialogService),
  __decorateParam(8, IExtensionService),
  __decorateParam(9, IContextKeyService)
], TunnelModel);
export {
  ACTIVATION_EVENT,
  AutoTunnelSource,
  OnPortForward,
  PortsAttributes,
  TunnelCloseReason,
  TunnelModel,
  TunnelSource,
  UserTunnelSource,
  forwardedPortsFeaturesEnabled,
  forwardedPortsViewEnabled,
  isCandidatePort,
  makeAddress,
  mapHasAddress,
  mapHasAddressLocalhostOrAllInterfaces,
  parseAddress
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvcmVtb3RlL2NvbW1vbi90dW5uZWxNb2RlbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgZGVib3VuY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9kZWNvcmF0b3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgaGFzaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2hhc2guanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uVGFyZ2V0LCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElBZGRyZXNzUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50Q29ubmVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlLCBUdW5uZWxEZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlbW90ZS9jb21tb24vcmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IFJlbW90ZVR1bm5lbCwgSVR1bm5lbFNlcnZpY2UsIFR1bm5lbFByb3RvY29sLCBUdW5uZWxQcml2YWN5SWQsIExPQ0FMSE9TVF9BRERSRVNTRVMsIFByb3ZpZGVkUG9ydEF0dHJpYnV0ZXMsIFBvcnRBdHRyaWJ1dGVzUHJvdmlkZXIsIGlzTG9jYWxob3N0LCBpc0FsbEludGVyZmFjZXMsIFByb3ZpZGVkT25BdXRvRm9yd2FyZCwgQUxMX0lOVEVSRkFDRVNfQUREUkVTU0VTIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdHVubmVsL2NvbW1vbi90dW5uZWwuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IGlzTnVtYmVyLCBpc09iamVjdCwgaXNTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBkZWVwQ2xvbmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSwgUmF3Q29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuXG5jb25zdCBNSVNNQVRDSF9MT0NBTF9QT1JUX0NPT0xET1dOID0gMTAgKiAxMDAwOyAvLyAxMCBzZWNvbmRzXG5jb25zdCBUVU5ORUxTX1RPX1JFU1RPUkUgPSAncmVtb3RlLnR1bm5lbHMudG9SZXN0b3JlJztcbmNvbnN0IFRVTk5FTFNfVE9fUkVTVE9SRV9FWFBJUkFUSU9OID0gJ3JlbW90ZS50dW5uZWxzLnRvUmVzdG9yZUV4cGlyYXRpb24nO1xuY29uc3QgUkVTVE9SRV9FWFBJUkFUSU9OX1RJTUUgPSAxMDAwICogNjAgKiA2MCAqIDI0ICogMTQ7IC8vIDIgd2Vla3NcbmV4cG9ydCBjb25zdCBBQ1RJVkFUSU9OX0VWRU5UID0gJ29uVHVubmVsJztcbmV4cG9ydCBjb25zdCBmb3J3YXJkZWRQb3J0c0ZlYXR1cmVzRW5hYmxlZCA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdmb3J3YXJkZWRQb3J0c1ZpZXdFbmFibGVkJywgZmFsc2UsIG5scy5sb2NhbGl6ZSgndHVubmVsLmZvcndhcmRlZFBvcnRzVmlld0VuYWJsZWQnLCBcIldoZXRoZXIgdGhlIFBvcnRzIHZpZXcgaXMgZW5hYmxlZC5cIikpO1xuZXhwb3J0IGNvbnN0IGZvcndhcmRlZFBvcnRzVmlld0VuYWJsZWQgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignZm9yd2FyZGVkUG9ydHNWaWV3T25seUVuYWJsZWQnLCBmYWxzZSwgbmxzLmxvY2FsaXplKCd0dW5uZWwuZm9yd2FyZGVkUG9ydHNWaWV3RW5hYmxlZCcsIFwiV2hldGhlciB0aGUgUG9ydHMgdmlldyBpcyBlbmFibGVkLlwiKSk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVzdG9yYWJsZVR1bm5lbCB7XG5cdHJlbW90ZUhvc3Q6IHN0cmluZztcblx0cmVtb3RlUG9ydDogbnVtYmVyO1xuXHRsb2NhbEFkZHJlc3M6IHN0cmluZztcblx0bG9jYWxVcmk6IFVSSTtcblx0cHJvdG9jb2w6IFR1bm5lbFByb3RvY29sO1xuXHRsb2NhbFBvcnQ/OiBudW1iZXI7XG5cdG5hbWU/OiBzdHJpbmc7XG5cdHNvdXJjZToge1xuXHRcdHNvdXJjZTogVHVubmVsU291cmNlO1xuXHRcdGRlc2NyaXB0aW9uOiBzdHJpbmc7XG5cdH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHVubmVsIHtcblx0cmVtb3RlSG9zdDogc3RyaW5nO1xuXHRyZW1vdGVQb3J0OiBudW1iZXI7XG5cdGxvY2FsQWRkcmVzczogc3RyaW5nO1xuXHRsb2NhbFVyaTogVVJJO1xuXHRwcm90b2NvbDogVHVubmVsUHJvdG9jb2w7XG5cdGxvY2FsUG9ydD86IG51bWJlcjtcblx0bmFtZT86IHN0cmluZztcblx0Y2xvc2VhYmxlPzogYm9vbGVhbjtcblx0cHJpdmFjeTogVHVubmVsUHJpdmFjeUlkIHwgc3RyaW5nO1xuXHRydW5uaW5nUHJvY2Vzczogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRoYXNSdW5uaW5nUHJvY2Vzcz86IGJvb2xlYW47XG5cdHBpZDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRzb3VyY2U6IHtcblx0XHRzb3VyY2U6IFR1bm5lbFNvdXJjZTtcblx0XHRkZXNjcmlwdGlvbjogc3RyaW5nO1xuXHR9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VBZGRyZXNzKGFkZHJlc3M6IHN0cmluZyk6IHsgaG9zdDogc3RyaW5nOyBwb3J0OiBudW1iZXIgfSB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IG1hdGNoZXMgPSBhZGRyZXNzLm1hdGNoKC9eKFthLXpBLVowLTlfLV0rKD86XFwuW2EtekEtWjAtOV8tXSspKjopPyhbMC05XSspJC8pO1xuXHRpZiAoIW1hdGNoZXMpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cdHJldHVybiB7IGhvc3Q6IG1hdGNoZXNbMV0/LnN1YnN0cmluZygwLCBtYXRjaGVzWzFdLmxlbmd0aCAtIDEpIHx8ICdsb2NhbGhvc3QnLCBwb3J0OiBOdW1iZXIobWF0Y2hlc1syXSkgfTtcbn1cblxuZXhwb3J0IGVudW0gVHVubmVsQ2xvc2VSZWFzb24ge1xuXHRPdGhlciA9ICdPdGhlcicsXG5cdFVzZXIgPSAnVXNlcicsXG5cdEF1dG9Gb3J3YXJkRW5kID0gJ0F1dG9Gb3J3YXJkRW5kJyxcbn1cblxuZXhwb3J0IGVudW0gVHVubmVsU291cmNlIHtcblx0VXNlcixcblx0QXV0byxcblx0RXh0ZW5zaW9uXG59XG5cbmV4cG9ydCBjb25zdCBVc2VyVHVubmVsU291cmNlID0ge1xuXHRzb3VyY2U6IFR1bm5lbFNvdXJjZS5Vc2VyLFxuXHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd0dW5uZWwuc291cmNlLnVzZXInLCBcIlVzZXIgRm9yd2FyZGVkXCIpXG59O1xuZXhwb3J0IGNvbnN0IEF1dG9UdW5uZWxTb3VyY2UgPSB7XG5cdHNvdXJjZTogVHVubmVsU291cmNlLkF1dG8sXG5cdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3R1bm5lbC5zb3VyY2UuYXV0bycsIFwiQXV0byBGb3J3YXJkZWRcIilcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXBIYXNBZGRyZXNzPFQ+KG1hcDogTWFwPHN0cmluZywgVD4sIGhvc3Q6IHN0cmluZywgcG9ydDogbnVtYmVyKTogVCB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IGluaXRpYWxBZGRyZXNzID0gbWFwLmdldChtYWtlQWRkcmVzcyhob3N0LCBwb3J0KSk7XG5cdGlmIChpbml0aWFsQWRkcmVzcykge1xuXHRcdHJldHVybiBpbml0aWFsQWRkcmVzcztcblx0fVxuXG5cdGlmIChpc0xvY2FsaG9zdChob3N0KSkge1xuXHRcdC8vIERvIGxvY2FsaG9zdCBjaGVja3Ncblx0XHRmb3IgKGNvbnN0IHRlc3RIb3N0IG9mIExPQ0FMSE9TVF9BRERSRVNTRVMpIHtcblx0XHRcdGNvbnN0IHRlc3RBZGRyZXNzID0gbWFrZUFkZHJlc3ModGVzdEhvc3QsIHBvcnQpO1xuXHRcdFx0aWYgKG1hcC5oYXModGVzdEFkZHJlc3MpKSB7XG5cdFx0XHRcdHJldHVybiBtYXAuZ2V0KHRlc3RBZGRyZXNzKTtcblx0XHRcdH1cblx0XHR9XG5cdH0gZWxzZSBpZiAoaXNBbGxJbnRlcmZhY2VzKGhvc3QpKSB7XG5cdFx0Ly8gRG8gYWxsIGludGVyZmFjZXMgY2hlY2tzXG5cdFx0Zm9yIChjb25zdCB0ZXN0SG9zdCBvZiBBTExfSU5URVJGQUNFU19BRERSRVNTRVMpIHtcblx0XHRcdGNvbnN0IHRlc3RBZGRyZXNzID0gbWFrZUFkZHJlc3ModGVzdEhvc3QsIHBvcnQpO1xuXHRcdFx0aWYgKG1hcC5oYXModGVzdEFkZHJlc3MpKSB7XG5cdFx0XHRcdHJldHVybiBtYXAuZ2V0KHRlc3RBZGRyZXNzKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWFwSGFzQWRkcmVzc0xvY2FsaG9zdE9yQWxsSW50ZXJmYWNlczxUPihtYXA6IE1hcDxzdHJpbmcsIFQ+LCBob3N0OiBzdHJpbmcsIHBvcnQ6IG51bWJlcik6IFQgfCB1bmRlZmluZWQge1xuXHRjb25zdCBvcmlnaW5hbEFkZHJlc3MgPSBtYXBIYXNBZGRyZXNzKG1hcCwgaG9zdCwgcG9ydCk7XG5cdGlmIChvcmlnaW5hbEFkZHJlc3MpIHtcblx0XHRyZXR1cm4gb3JpZ2luYWxBZGRyZXNzO1xuXHR9XG5cdGNvbnN0IG90aGVySG9zdCA9IGlzQWxsSW50ZXJmYWNlcyhob3N0KSA/ICdsb2NhbGhvc3QnIDogKGlzTG9jYWxob3N0KGhvc3QpID8gJzAuMC4wLjAnIDogdW5kZWZpbmVkKTtcblx0aWYgKG90aGVySG9zdCkge1xuXHRcdHJldHVybiBtYXBIYXNBZGRyZXNzKG1hcCwgb3RoZXJIb3N0LCBwb3J0KTtcblx0fVxuXHRyZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBtYWtlQWRkcmVzcyhob3N0OiBzdHJpbmcsIHBvcnQ6IG51bWJlcik6IHN0cmluZyB7XG5cdHJldHVybiBob3N0ICsgJzonICsgcG9ydDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUdW5uZWxQcm9wZXJ0aWVzIHtcblx0cmVtb3RlOiB7IGhvc3Q6IHN0cmluZzsgcG9ydDogbnVtYmVyIH07XG5cdGxvY2FsPzogbnVtYmVyO1xuXHRuYW1lPzogc3RyaW5nO1xuXHRzb3VyY2U/OiB7XG5cdFx0c291cmNlOiBUdW5uZWxTb3VyY2U7XG5cdFx0ZGVzY3JpcHRpb246IHN0cmluZztcblx0fTtcblx0ZWxldmF0ZUlmTmVlZGVkPzogYm9vbGVhbjtcblx0cHJpdmFjeT86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDYW5kaWRhdGVQb3J0IHtcblx0aG9zdDogc3RyaW5nO1xuXHRwb3J0OiBudW1iZXI7XG5cdGRldGFpbD86IHN0cmluZztcblx0cGlkPzogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgUG9ydEF0dHJpYnV0ZXMgZXh0ZW5kcyBBdHRyaWJ1dGVzIHtcblx0a2V5OiBudW1iZXIgfCBQb3J0UmFuZ2UgfCBSZWdFeHAgfCBIb3N0QW5kUG9ydDtcbn1cblxuZXhwb3J0IGVudW0gT25Qb3J0Rm9yd2FyZCB7XG5cdE5vdGlmeSA9ICdub3RpZnknLFxuXHRPcGVuQnJvd3NlciA9ICdvcGVuQnJvd3NlcicsXG5cdE9wZW5Ccm93c2VyT25jZSA9ICdvcGVuQnJvd3Nlck9uY2UnLFxuXHRPcGVuUHJldmlldyA9ICdvcGVuUHJldmlldycsXG5cdFNpbGVudCA9ICdzaWxlbnQnLFxuXHRJZ25vcmUgPSAnaWdub3JlJ1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEF0dHJpYnV0ZXMge1xuXHRsYWJlbDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRvbkF1dG9Gb3J3YXJkOiBPblBvcnRGb3J3YXJkIHwgdW5kZWZpbmVkO1xuXHRlbGV2YXRlSWZOZWVkZWQ6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdHJlcXVpcmVMb2NhbFBvcnQ6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdHByb3RvY29sOiBUdW5uZWxQcm90b2NvbCB8IHVuZGVmaW5lZDtcbn1cblxuaW50ZXJmYWNlIFBvcnRSYW5nZSB7IHN0YXJ0OiBudW1iZXI7IGVuZDogbnVtYmVyIH1cblxuaW50ZXJmYWNlIEhvc3RBbmRQb3J0IHsgaG9zdDogc3RyaW5nOyBwb3J0OiBudW1iZXIgfVxuXG5leHBvcnQgZnVuY3Rpb24gaXNDYW5kaWRhdGVQb3J0KGNhbmRpZGF0ZTogYW55KTogY2FuZGlkYXRlIGlzIENhbmRpZGF0ZVBvcnQge1xuXHRyZXR1cm4gY2FuZGlkYXRlICYmICdob3N0JyBpbiBjYW5kaWRhdGUgJiYgdHlwZW9mIGNhbmRpZGF0ZS5ob3N0ID09PSAnc3RyaW5nJ1xuXHRcdCYmICdwb3J0JyBpbiBjYW5kaWRhdGUgJiYgdHlwZW9mIGNhbmRpZGF0ZS5wb3J0ID09PSAnbnVtYmVyJ1xuXHRcdCYmICghKCdkZXRhaWwnIGluIGNhbmRpZGF0ZSkgfHwgdHlwZW9mIGNhbmRpZGF0ZS5kZXRhaWwgPT09ICdzdHJpbmcnKVxuXHRcdCYmICghKCdwaWQnIGluIGNhbmRpZGF0ZSkgfHwgdHlwZW9mIGNhbmRpZGF0ZS5waWQgPT09ICdzdHJpbmcnKTtcbn1cblxuZXhwb3J0IGNsYXNzIFBvcnRzQXR0cmlidXRlcyBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIHN0YXRpYyBTRVRUSU5HID0gJ3JlbW90ZS5wb3J0c0F0dHJpYnV0ZXMnO1xuXHRwcml2YXRlIHN0YXRpYyBERUZBVUxUUyA9ICdyZW1vdGUub3RoZXJQb3J0c0F0dHJpYnV0ZXMnO1xuXHRwcml2YXRlIHN0YXRpYyBSQU5HRSA9IC9eKFxcZCspXFwtKFxcZCspJC87XG5cdHByaXZhdGUgc3RhdGljIEhPU1RfQU5EX1BPUlQgPSAvXihbYS16MC05XFwtXSspOihcXGR7MSw1fSkkLztcblx0cHJpdmF0ZSBwb3J0c0F0dHJpYnV0ZXM6IFBvcnRBdHRyaWJ1dGVzW10gPSBbXTtcblx0cHJpdmF0ZSBkZWZhdWx0UG9ydEF0dHJpYnV0ZXM6IEF0dHJpYnV0ZXMgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlQXR0cmlidXRlcyA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZUF0dHJpYnV0ZXMgPSB0aGlzLl9vbkRpZENoYW5nZUF0dHJpYnV0ZXMuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihQb3J0c0F0dHJpYnV0ZXMuU0VUVElORykgfHwgZS5hZmZlY3RzQ29uZmlndXJhdGlvbihQb3J0c0F0dHJpYnV0ZXMuREVGQVVMVFMpKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlQXR0cmlidXRlcygpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLnVwZGF0ZUF0dHJpYnV0ZXMoKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQXR0cmlidXRlcygpIHtcblx0XHR0aGlzLnBvcnRzQXR0cmlidXRlcyA9IHRoaXMucmVhZFNldHRpbmcoKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUF0dHJpYnV0ZXMuZmlyZSgpO1xuXHR9XG5cblx0Z2V0QXR0cmlidXRlcyhwb3J0OiBudW1iZXIsIGhvc3Q6IHN0cmluZywgY29tbWFuZExpbmU/OiBzdHJpbmcpOiBBdHRyaWJ1dGVzIHwgdW5kZWZpbmVkIHtcblx0XHRsZXQgaW5kZXggPSB0aGlzLmZpbmROZXh0SW5kZXgocG9ydCwgaG9zdCwgY29tbWFuZExpbmUsIHRoaXMucG9ydHNBdHRyaWJ1dGVzLCAwKTtcblx0XHRjb25zdCBhdHRyaWJ1dGVzOiBBdHRyaWJ1dGVzID0ge1xuXHRcdFx0bGFiZWw6IHVuZGVmaW5lZCxcblx0XHRcdG9uQXV0b0ZvcndhcmQ6IHVuZGVmaW5lZCxcblx0XHRcdGVsZXZhdGVJZk5lZWRlZDogdW5kZWZpbmVkLFxuXHRcdFx0cmVxdWlyZUxvY2FsUG9ydDogdW5kZWZpbmVkLFxuXHRcdFx0cHJvdG9jb2w6IHVuZGVmaW5lZFxuXHRcdH07XG5cdFx0d2hpbGUgKGluZGV4ID49IDApIHtcblx0XHRcdGNvbnN0IGZvdW5kID0gdGhpcy5wb3J0c0F0dHJpYnV0ZXNbaW5kZXhdO1xuXHRcdFx0aWYgKGZvdW5kLmtleSA9PT0gcG9ydCkge1xuXHRcdFx0XHRhdHRyaWJ1dGVzLm9uQXV0b0ZvcndhcmQgPSBmb3VuZC5vbkF1dG9Gb3J3YXJkID8/IGF0dHJpYnV0ZXMub25BdXRvRm9yd2FyZDtcblx0XHRcdFx0YXR0cmlidXRlcy5lbGV2YXRlSWZOZWVkZWQgPSAoZm91bmQuZWxldmF0ZUlmTmVlZGVkICE9PSB1bmRlZmluZWQpID8gZm91bmQuZWxldmF0ZUlmTmVlZGVkIDogYXR0cmlidXRlcy5lbGV2YXRlSWZOZWVkZWQ7XG5cdFx0XHRcdGF0dHJpYnV0ZXMubGFiZWwgPSBmb3VuZC5sYWJlbCA/PyBhdHRyaWJ1dGVzLmxhYmVsO1xuXHRcdFx0XHRhdHRyaWJ1dGVzLnJlcXVpcmVMb2NhbFBvcnQgPSBmb3VuZC5yZXF1aXJlTG9jYWxQb3J0O1xuXHRcdFx0XHRhdHRyaWJ1dGVzLnByb3RvY29sID0gZm91bmQucHJvdG9jb2w7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBJdCdzIGEgcmFuZ2Ugb3IgcmVnZXgsIHdoaWNoIG1lYW5zIHRoYXQgaWYgdGhlIGF0dHJpYnV0ZSBpcyBhbHJlYWR5IHNldCwgd2Uga2VlcCBpdFxuXHRcdFx0XHRhdHRyaWJ1dGVzLm9uQXV0b0ZvcndhcmQgPSBhdHRyaWJ1dGVzLm9uQXV0b0ZvcndhcmQgPz8gZm91bmQub25BdXRvRm9yd2FyZDtcblx0XHRcdFx0YXR0cmlidXRlcy5lbGV2YXRlSWZOZWVkZWQgPSAoYXR0cmlidXRlcy5lbGV2YXRlSWZOZWVkZWQgIT09IHVuZGVmaW5lZCkgPyBhdHRyaWJ1dGVzLmVsZXZhdGVJZk5lZWRlZCA6IGZvdW5kLmVsZXZhdGVJZk5lZWRlZDtcblx0XHRcdFx0YXR0cmlidXRlcy5sYWJlbCA9IGF0dHJpYnV0ZXMubGFiZWwgPz8gZm91bmQubGFiZWw7XG5cdFx0XHRcdGF0dHJpYnV0ZXMucmVxdWlyZUxvY2FsUG9ydCA9IChhdHRyaWJ1dGVzLnJlcXVpcmVMb2NhbFBvcnQgIT09IHVuZGVmaW5lZCkgPyBhdHRyaWJ1dGVzLnJlcXVpcmVMb2NhbFBvcnQgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdGF0dHJpYnV0ZXMucHJvdG9jb2wgPSBhdHRyaWJ1dGVzLnByb3RvY29sID8/IGZvdW5kLnByb3RvY29sO1xuXHRcdFx0fVxuXHRcdFx0aW5kZXggPSB0aGlzLmZpbmROZXh0SW5kZXgocG9ydCwgaG9zdCwgY29tbWFuZExpbmUsIHRoaXMucG9ydHNBdHRyaWJ1dGVzLCBpbmRleCArIDEpO1xuXHRcdH1cblx0XHRpZiAoYXR0cmlidXRlcy5vbkF1dG9Gb3J3YXJkICE9PSB1bmRlZmluZWQgfHwgYXR0cmlidXRlcy5lbGV2YXRlSWZOZWVkZWQgIT09IHVuZGVmaW5lZFxuXHRcdFx0fHwgYXR0cmlidXRlcy5sYWJlbCAhPT0gdW5kZWZpbmVkIHx8IGF0dHJpYnV0ZXMucmVxdWlyZUxvY2FsUG9ydCAhPT0gdW5kZWZpbmVkXG5cdFx0XHR8fCBhdHRyaWJ1dGVzLnByb3RvY29sICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiBhdHRyaWJ1dGVzO1xuXHRcdH1cblxuXHRcdC8vIElmIHdlIGZpbmQgbm8gbWF0Y2hlcywgdGhlbiB1c2UgdGhlIG90aGVyIHBvcnQgYXR0cmlidXRlcy5cblx0XHRyZXR1cm4gdGhpcy5nZXRPdGhlckF0dHJpYnV0ZXMoKTtcblx0fVxuXG5cdHByaXZhdGUgaGFzU3RhcnRFbmQodmFsdWU6IG51bWJlciB8IFBvcnRSYW5nZSB8IFJlZ0V4cCB8IEhvc3RBbmRQb3J0KTogdmFsdWUgaXMgUG9ydFJhbmdlIHtcblx0XHRyZXR1cm4gKCg8YW55PnZhbHVlKS5zdGFydCAhPT0gdW5kZWZpbmVkKSAmJiAoKDxhbnk+dmFsdWUpLmVuZCAhPT0gdW5kZWZpbmVkKTtcblx0fVxuXG5cdHByaXZhdGUgaGFzSG9zdEFuZFBvcnQodmFsdWU6IG51bWJlciB8IFBvcnRSYW5nZSB8IFJlZ0V4cCB8IEhvc3RBbmRQb3J0KTogdmFsdWUgaXMgSG9zdEFuZFBvcnQge1xuXHRcdHJldHVybiAoKDxhbnk+dmFsdWUpLmhvc3QgIT09IHVuZGVmaW5lZCkgJiYgKCg8YW55PnZhbHVlKS5wb3J0ICE9PSB1bmRlZmluZWQpXG5cdFx0XHQmJiBpc1N0cmluZygoPGFueT52YWx1ZSkuaG9zdCkgJiYgaXNOdW1iZXIoKDxhbnk+dmFsdWUpLnBvcnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBmaW5kTmV4dEluZGV4KHBvcnQ6IG51bWJlciwgaG9zdDogc3RyaW5nLCBjb21tYW5kTGluZTogc3RyaW5nIHwgdW5kZWZpbmVkLCBhdHRyaWJ1dGVzOiBQb3J0QXR0cmlidXRlc1tdLCBmcm9tSW5kZXg6IG51bWJlcik6IG51bWJlciB7XG5cdFx0aWYgKGZyb21JbmRleCA+PSBhdHRyaWJ1dGVzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH1cblx0XHRjb25zdCBzaG91bGRVc2VIb3N0ID0gIWlzTG9jYWxob3N0KGhvc3QpICYmICFpc0FsbEludGVyZmFjZXMoaG9zdCk7XG5cdFx0Y29uc3Qgc2xpY2VkID0gYXR0cmlidXRlcy5zbGljZShmcm9tSW5kZXgpO1xuXHRcdGNvbnN0IGZvdW5kSW5kZXggPSBzbGljZWQuZmluZEluZGV4KCh2YWx1ZSkgPT4ge1xuXHRcdFx0aWYgKGlzTnVtYmVyKHZhbHVlLmtleSkpIHtcblx0XHRcdFx0cmV0dXJuIHNob3VsZFVzZUhvc3QgPyBmYWxzZSA6IHZhbHVlLmtleSA9PT0gcG9ydDtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5oYXNTdGFydEVuZCh2YWx1ZS5rZXkpKSB7XG5cdFx0XHRcdHJldHVybiBzaG91bGRVc2VIb3N0ID8gZmFsc2UgOiAocG9ydCA+PSB2YWx1ZS5rZXkuc3RhcnQgJiYgcG9ydCA8PSB2YWx1ZS5rZXkuZW5kKTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5oYXNIb3N0QW5kUG9ydCh2YWx1ZS5rZXkpKSB7XG5cdFx0XHRcdHJldHVybiAocG9ydCA9PT0gdmFsdWUua2V5LnBvcnQpICYmIChob3N0ID09PSB2YWx1ZS5rZXkuaG9zdCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gY29tbWFuZExpbmUgPyB2YWx1ZS5rZXkudGVzdChjb21tYW5kTGluZSkgOiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdH0pO1xuXHRcdHJldHVybiBmb3VuZEluZGV4ID49IDAgPyBmb3VuZEluZGV4ICsgZnJvbUluZGV4IDogLTE7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRTZXR0aW5nKCk6IFBvcnRBdHRyaWJ1dGVzW10ge1xuXHRcdGNvbnN0IHNldHRpbmdWYWx1ZSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoUG9ydHNBdHRyaWJ1dGVzLlNFVFRJTkcpO1xuXHRcdGlmICghc2V0dGluZ1ZhbHVlIHx8ICFpc09iamVjdChzZXR0aW5nVmFsdWUpKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgYXR0cmlidXRlczogUG9ydEF0dHJpYnV0ZXNbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgYXR0cmlidXRlc0tleSBpbiBzZXR0aW5nVmFsdWUpIHtcblx0XHRcdGlmIChhdHRyaWJ1dGVzS2V5ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBzZXR0aW5nID0gKDxhbnk+c2V0dGluZ1ZhbHVlKVthdHRyaWJ1dGVzS2V5XTtcblx0XHRcdGxldCBrZXk6IG51bWJlciB8IFBvcnRSYW5nZSB8IFJlZ0V4cCB8IEhvc3RBbmRQb3J0IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0aWYgKE51bWJlcihhdHRyaWJ1dGVzS2V5KSkge1xuXHRcdFx0XHRrZXkgPSBOdW1iZXIoYXR0cmlidXRlc0tleSk7XG5cdFx0XHR9IGVsc2UgaWYgKGlzU3RyaW5nKGF0dHJpYnV0ZXNLZXkpKSB7XG5cdFx0XHRcdGlmIChQb3J0c0F0dHJpYnV0ZXMuUkFOR0UudGVzdChhdHRyaWJ1dGVzS2V5KSkge1xuXHRcdFx0XHRcdGNvbnN0IG1hdGNoID0gYXR0cmlidXRlc0tleS5tYXRjaChQb3J0c0F0dHJpYnV0ZXMuUkFOR0UpO1xuXHRcdFx0XHRcdGtleSA9IHsgc3RhcnQ6IE51bWJlcihtYXRjaCFbMV0pLCBlbmQ6IE51bWJlcihtYXRjaCFbMl0pIH07XG5cdFx0XHRcdH0gZWxzZSBpZiAoUG9ydHNBdHRyaWJ1dGVzLkhPU1RfQU5EX1BPUlQudGVzdChhdHRyaWJ1dGVzS2V5KSkge1xuXHRcdFx0XHRcdGNvbnN0IG1hdGNoID0gYXR0cmlidXRlc0tleS5tYXRjaChQb3J0c0F0dHJpYnV0ZXMuSE9TVF9BTkRfUE9SVCk7XG5cdFx0XHRcdFx0a2V5ID0geyBob3N0OiBtYXRjaCFbMV0sIHBvcnQ6IE51bWJlcihtYXRjaCFbMl0pIH07XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bGV0IHJlZ1Rlc3Q6IFJlZ0V4cCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0cmVnVGVzdCA9IFJlZ0V4cChhdHRyaWJ1dGVzS2V5KTtcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0XHQvLyBUaGUgdXNlciBlbnRlcmVkIGFuIGludmFsaWQgcmVndWxhciBleHByZXNzaW9uLlxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAocmVnVGVzdCkge1xuXHRcdFx0XHRcdFx0a2V5ID0gcmVnVGVzdDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICgha2V5KSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0YXR0cmlidXRlcy5wdXNoKHtcblx0XHRcdFx0a2V5OiBrZXksXG5cdFx0XHRcdGVsZXZhdGVJZk5lZWRlZDogc2V0dGluZy5lbGV2YXRlSWZOZWVkZWQsXG5cdFx0XHRcdG9uQXV0b0ZvcndhcmQ6IHNldHRpbmcub25BdXRvRm9yd2FyZCxcblx0XHRcdFx0bGFiZWw6IHNldHRpbmcubGFiZWwsXG5cdFx0XHRcdHJlcXVpcmVMb2NhbFBvcnQ6IHNldHRpbmcucmVxdWlyZUxvY2FsUG9ydCxcblx0XHRcdFx0cHJvdG9jb2w6IHNldHRpbmcucHJvdG9jb2xcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRlZmF1bHRzID0gPGFueT50aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFBvcnRzQXR0cmlidXRlcy5ERUZBVUxUUyk7XG5cdFx0aWYgKGRlZmF1bHRzKSB7XG5cdFx0XHR0aGlzLmRlZmF1bHRQb3J0QXR0cmlidXRlcyA9IHtcblx0XHRcdFx0ZWxldmF0ZUlmTmVlZGVkOiBkZWZhdWx0cy5lbGV2YXRlSWZOZWVkZWQsXG5cdFx0XHRcdGxhYmVsOiBkZWZhdWx0cy5sYWJlbCxcblx0XHRcdFx0b25BdXRvRm9yd2FyZDogZGVmYXVsdHMub25BdXRvRm9yd2FyZCxcblx0XHRcdFx0cmVxdWlyZUxvY2FsUG9ydDogZGVmYXVsdHMucmVxdWlyZUxvY2FsUG9ydCxcblx0XHRcdFx0cHJvdG9jb2w6IGRlZmF1bHRzLnByb3RvY29sXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnNvcnRBdHRyaWJ1dGVzKGF0dHJpYnV0ZXMpO1xuXHR9XG5cblx0cHJpdmF0ZSBzb3J0QXR0cmlidXRlcyhhdHRyaWJ1dGVzOiBQb3J0QXR0cmlidXRlc1tdKTogUG9ydEF0dHJpYnV0ZXNbXSB7XG5cdFx0ZnVuY3Rpb24gZ2V0VmFsKGl0ZW06IFBvcnRBdHRyaWJ1dGVzLCB0aGlzUmVmOiBQb3J0c0F0dHJpYnV0ZXMpIHtcblx0XHRcdGlmIChpc051bWJlcihpdGVtLmtleSkpIHtcblx0XHRcdFx0cmV0dXJuIGl0ZW0ua2V5O1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzUmVmLmhhc1N0YXJ0RW5kKGl0ZW0ua2V5KSkge1xuXHRcdFx0XHRyZXR1cm4gaXRlbS5rZXkuc3RhcnQ7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXNSZWYuaGFzSG9zdEFuZFBvcnQoaXRlbS5rZXkpKSB7XG5cdFx0XHRcdHJldHVybiBpdGVtLmtleS5wb3J0O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIE51bWJlci5NQVhfVkFMVUU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGF0dHJpYnV0ZXMuc29ydCgoYSwgYikgPT4ge1xuXHRcdFx0cmV0dXJuIGdldFZhbChhLCB0aGlzKSAtIGdldFZhbChiLCB0aGlzKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0T3RoZXJBdHRyaWJ1dGVzKCkge1xuXHRcdHJldHVybiB0aGlzLmRlZmF1bHRQb3J0QXR0cmlidXRlcztcblx0fVxuXG5cdHN0YXRpYyBwcm92aWRlZEFjdGlvblRvQWN0aW9uKHByb3ZpZGVkQWN0aW9uOiBQcm92aWRlZE9uQXV0b0ZvcndhcmQgfCB1bmRlZmluZWQpIHtcblx0XHRzd2l0Y2ggKHByb3ZpZGVkQWN0aW9uKSB7XG5cdFx0XHRjYXNlIFByb3ZpZGVkT25BdXRvRm9yd2FyZC5Ob3RpZnk6IHJldHVybiBPblBvcnRGb3J3YXJkLk5vdGlmeTtcblx0XHRcdGNhc2UgUHJvdmlkZWRPbkF1dG9Gb3J3YXJkLk9wZW5Ccm93c2VyOiByZXR1cm4gT25Qb3J0Rm9yd2FyZC5PcGVuQnJvd3Nlcjtcblx0XHRcdGNhc2UgUHJvdmlkZWRPbkF1dG9Gb3J3YXJkLk9wZW5Ccm93c2VyT25jZTogcmV0dXJuIE9uUG9ydEZvcndhcmQuT3BlbkJyb3dzZXJPbmNlO1xuXHRcdFx0Y2FzZSBQcm92aWRlZE9uQXV0b0ZvcndhcmQuT3BlblByZXZpZXc6IHJldHVybiBPblBvcnRGb3J3YXJkLk9wZW5QcmV2aWV3O1xuXHRcdFx0Y2FzZSBQcm92aWRlZE9uQXV0b0ZvcndhcmQuU2lsZW50OiByZXR1cm4gT25Qb3J0Rm9yd2FyZC5TaWxlbnQ7XG5cdFx0XHRjYXNlIFByb3ZpZGVkT25BdXRvRm9yd2FyZC5JZ25vcmU6IHJldHVybiBPblBvcnRGb3J3YXJkLklnbm9yZTtcblx0XHRcdGRlZmF1bHQ6IHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGFzeW5jIGFkZEF0dHJpYnV0ZXMocG9ydDogbnVtYmVyLCBhdHRyaWJ1dGVzOiBQYXJ0aWFsPEF0dHJpYnV0ZXM+LCB0YXJnZXQ6IENvbmZpZ3VyYXRpb25UYXJnZXQpIHtcblx0XHRjb25zdCBzZXR0aW5nVmFsdWUgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmluc3BlY3QoUG9ydHNBdHRyaWJ1dGVzLlNFVFRJTkcpO1xuXHRcdGNvbnN0IHJlbW90ZVZhbHVlOiBhbnkgPSBzZXR0aW5nVmFsdWUudXNlclJlbW90ZVZhbHVlO1xuXHRcdGxldCBuZXdSZW1vdGVWYWx1ZTogYW55O1xuXHRcdGlmICghcmVtb3RlVmFsdWUgfHwgIWlzT2JqZWN0KHJlbW90ZVZhbHVlKSkge1xuXHRcdFx0bmV3UmVtb3RlVmFsdWUgPSB7fTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bmV3UmVtb3RlVmFsdWUgPSBkZWVwQ2xvbmUocmVtb3RlVmFsdWUpO1xuXHRcdH1cblxuXHRcdGlmICghbmV3UmVtb3RlVmFsdWVbYCR7cG9ydH1gXSkge1xuXHRcdFx0bmV3UmVtb3RlVmFsdWVbYCR7cG9ydH1gXSA9IHt9O1xuXHRcdH1cblx0XHRmb3IgKGNvbnN0IGF0dHJpYnV0ZSBpbiBhdHRyaWJ1dGVzKSB7XG5cdFx0XHRuZXdSZW1vdGVWYWx1ZVtgJHtwb3J0fWBdW2F0dHJpYnV0ZV0gPSAoPGFueT5hdHRyaWJ1dGVzKVthdHRyaWJ1dGVdO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKFBvcnRzQXR0cmlidXRlcy5TRVRUSU5HLCBuZXdSZW1vdGVWYWx1ZSwgdGFyZ2V0KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVHVubmVsTW9kZWwgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cmVhZG9ubHkgZm9yd2FyZGVkOiBNYXA8c3RyaW5nLCBUdW5uZWw+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGluUHJvZ3Jlc3M6IE1hcDxzdHJpbmcsIHRydWU+ID0gbmV3IE1hcCgpO1xuXHRyZWFkb25seSBkZXRlY3RlZDogTWFwPHN0cmluZywgVHVubmVsPjtcblx0cHJpdmF0ZSByZW1vdGVUdW5uZWxzOiBNYXA8c3RyaW5nLCBSZW1vdGVUdW5uZWw+O1xuXHRwcml2YXRlIF9vbkZvcndhcmRQb3J0OiBFbWl0dGVyPFR1bm5lbCB8IHZvaWQ+ID0gbmV3IEVtaXR0ZXIoKTtcblx0cHVibGljIG9uRm9yd2FyZFBvcnQ6IEV2ZW50PFR1bm5lbCB8IHZvaWQ+ID0gdGhpcy5fb25Gb3J3YXJkUG9ydC5ldmVudDtcblx0cHJpdmF0ZSBfb25DbG9zZVBvcnQ6IEVtaXR0ZXI8eyBob3N0OiBzdHJpbmc7IHBvcnQ6IG51bWJlciB9PiA9IG5ldyBFbWl0dGVyKCk7XG5cdHB1YmxpYyBvbkNsb3NlUG9ydDogRXZlbnQ8eyBob3N0OiBzdHJpbmc7IHBvcnQ6IG51bWJlciB9PiA9IHRoaXMuX29uQ2xvc2VQb3J0LmV2ZW50O1xuXHRwcml2YXRlIF9vblBvcnROYW1lOiBFbWl0dGVyPHsgaG9zdDogc3RyaW5nOyBwb3J0OiBudW1iZXIgfT4gPSBuZXcgRW1pdHRlcigpO1xuXHRwdWJsaWMgb25Qb3J0TmFtZTogRXZlbnQ8eyBob3N0OiBzdHJpbmc7IHBvcnQ6IG51bWJlciB9PiA9IHRoaXMuX29uUG9ydE5hbWUuZXZlbnQ7XG5cdHByaXZhdGUgX2NhbmRpZGF0ZXM6IE1hcDxzdHJpbmcsIENhbmRpZGF0ZVBvcnQ+IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9vbkNhbmRpZGF0ZXNDaGFuZ2VkOiBFbWl0dGVyPE1hcDxzdHJpbmcsIHsgaG9zdDogc3RyaW5nOyBwb3J0OiBudW1iZXIgfT4+ID0gbmV3IEVtaXR0ZXIoKTtcblx0Ly8gb25DYW5kaWRhdGVDaGFuZ2VkIHJldHVybnMgdGhlIHJlbW92ZWQgY2FuZGlkYXRlc1xuXHRwdWJsaWMgb25DYW5kaWRhdGVzQ2hhbmdlZDogRXZlbnQ8TWFwPHN0cmluZywgeyBob3N0OiBzdHJpbmc7IHBvcnQ6IG51bWJlciB9Pj4gPSB0aGlzLl9vbkNhbmRpZGF0ZXNDaGFuZ2VkLmV2ZW50O1xuXHRwcml2YXRlIF9jYW5kaWRhdGVGaWx0ZXI6ICgoY2FuZGlkYXRlczogQ2FuZGlkYXRlUG9ydFtdKSA9PiBQcm9taXNlPENhbmRpZGF0ZVBvcnRbXT4pIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHR1bm5lbFJlc3RvcmVWYWx1ZTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+O1xuXHRwcml2YXRlIF9vbkVudmlyb25tZW50VHVubmVsc1NldDogRW1pdHRlcjx2b2lkPiA9IG5ldyBFbWl0dGVyKCk7XG5cdHB1YmxpYyBvbkVudmlyb25tZW50VHVubmVsc1NldDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkVudmlyb25tZW50VHVubmVsc1NldC5ldmVudDtcblx0cHJpdmF0ZSBfZW52aXJvbm1lbnRUdW5uZWxzU2V0OiBib29sZWFuID0gZmFsc2U7XG5cdHB1YmxpYyByZWFkb25seSBjb25maWdQb3J0c0F0dHJpYnV0ZXM6IFBvcnRzQXR0cmlidXRlcztcblx0cHJpdmF0ZSByZXN0b3JlTGlzdGVuZXI6IERpc3Bvc2FibGVTdG9yZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBrbm93blBvcnRzUmVzdG9yZVZhbHVlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVzdG9yZUNvbXBsZXRlID0gZmFsc2U7XG5cdHByaXZhdGUgb25SZXN0b3JlQ29tcGxldGU6IEVtaXR0ZXI8dm9pZD4gPSBuZXcgRW1pdHRlcigpO1xuXHRwcml2YXRlIHVucmVzdG9yZWRFeHRlbnNpb25UdW5uZWxzOiBNYXA8c3RyaW5nLCBSZXN0b3JhYmxlVHVubmVsPiA9IG5ldyBNYXAoKTtcblx0cHJpdmF0ZSBzZXNzaW9uQ2FjaGVkUHJvcGVydGllczogTWFwPHN0cmluZywgUGFydGlhbDxUdW5uZWxQcm9wZXJ0aWVzPj4gPSBuZXcgTWFwKCk7XG5cblx0cHJpdmF0ZSBwb3J0QXR0cmlidXRlc1Byb3ZpZGVyczogUG9ydEF0dHJpYnV0ZXNQcm92aWRlcltdID0gW107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElUdW5uZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdHVubmVsU2VydmljZTogSVR1bm5lbFNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElSZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSByZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2U6IElSZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmNvbmZpZ1BvcnRzQXR0cmlidXRlcyA9IG5ldyBQb3J0c0F0dHJpYnV0ZXMoY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHRoaXMudHVubmVsUmVzdG9yZVZhbHVlID0gdGhpcy5nZXRUdW5uZWxSZXN0b3JlVmFsdWUoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ1BvcnRzQXR0cmlidXRlcy5vbkRpZENoYW5nZUF0dHJpYnV0ZXModGhpcy51cGRhdGVBdHRyaWJ1dGVzLCB0aGlzKSk7XG5cdFx0dGhpcy5mb3J3YXJkZWQgPSBuZXcgTWFwKCk7XG5cdFx0dGhpcy5yZW1vdGVUdW5uZWxzID0gbmV3IE1hcCgpO1xuXHRcdHRoaXMudHVubmVsU2VydmljZS50dW5uZWxzLnRoZW4oYXN5bmMgKHR1bm5lbHMpID0+IHtcblx0XHRcdGNvbnN0IGF0dHJpYnV0ZXMgPSBhd2FpdCB0aGlzLmdldEF0dHJpYnV0ZXModHVubmVscy5tYXAodHVubmVsID0+IHtcblx0XHRcdFx0cmV0dXJuIHsgcG9ydDogdHVubmVsLnR1bm5lbFJlbW90ZVBvcnQsIGhvc3Q6IHR1bm5lbC50dW5uZWxSZW1vdGVIb3N0IH07XG5cdFx0XHR9KSk7XG5cdFx0XHRmb3IgKGNvbnN0IHR1bm5lbCBvZiB0dW5uZWxzKSB7XG5cdFx0XHRcdGlmICh0dW5uZWwubG9jYWxBZGRyZXNzKSB7XG5cdFx0XHRcdFx0Y29uc3Qga2V5ID0gbWFrZUFkZHJlc3ModHVubmVsLnR1bm5lbFJlbW90ZUhvc3QsIHR1bm5lbC50dW5uZWxSZW1vdGVQb3J0KTtcblx0XHRcdFx0XHRjb25zdCBtYXRjaGluZ0NhbmRpZGF0ZSA9IG1hcEhhc0FkZHJlc3NMb2NhbGhvc3RPckFsbEludGVyZmFjZXModGhpcy5fY2FuZGlkYXRlcyA/PyBuZXcgTWFwKCksIHR1bm5lbC50dW5uZWxSZW1vdGVIb3N0LCB0dW5uZWwudHVubmVsUmVtb3RlUG9ydCk7XG5cdFx0XHRcdFx0dGhpcy5mb3J3YXJkZWQuc2V0KGtleSwge1xuXHRcdFx0XHRcdFx0cmVtb3RlUG9ydDogdHVubmVsLnR1bm5lbFJlbW90ZVBvcnQsXG5cdFx0XHRcdFx0XHRyZW1vdGVIb3N0OiB0dW5uZWwudHVubmVsUmVtb3RlSG9zdCxcblx0XHRcdFx0XHRcdGxvY2FsQWRkcmVzczogdHVubmVsLmxvY2FsQWRkcmVzcyxcblx0XHRcdFx0XHRcdHByb3RvY29sOiBhdHRyaWJ1dGVzPy5nZXQodHVubmVsLnR1bm5lbFJlbW90ZVBvcnQpPy5wcm90b2NvbCA/PyBUdW5uZWxQcm90b2NvbC5IdHRwLFxuXHRcdFx0XHRcdFx0bG9jYWxVcmk6IGF3YWl0IHRoaXMubWFrZUxvY2FsVXJpKHR1bm5lbC5sb2NhbEFkZHJlc3MsIGF0dHJpYnV0ZXM/LmdldCh0dW5uZWwudHVubmVsUmVtb3RlUG9ydCkpLFxuXHRcdFx0XHRcdFx0bG9jYWxQb3J0OiB0dW5uZWwudHVubmVsTG9jYWxQb3J0LFxuXHRcdFx0XHRcdFx0bmFtZTogYXR0cmlidXRlcz8uZ2V0KHR1bm5lbC50dW5uZWxSZW1vdGVQb3J0KT8ubGFiZWwsXG5cdFx0XHRcdFx0XHRydW5uaW5nUHJvY2VzczogbWF0Y2hpbmdDYW5kaWRhdGU/LmRldGFpbCxcblx0XHRcdFx0XHRcdGhhc1J1bm5pbmdQcm9jZXNzOiAhIW1hdGNoaW5nQ2FuZGlkYXRlLFxuXHRcdFx0XHRcdFx0cGlkOiBtYXRjaGluZ0NhbmRpZGF0ZT8ucGlkLFxuXHRcdFx0XHRcdFx0cHJpdmFjeTogdHVubmVsLnByaXZhY3ksXG5cdFx0XHRcdFx0XHRzb3VyY2U6IFVzZXJUdW5uZWxTb3VyY2UsXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0dGhpcy5yZW1vdGVUdW5uZWxzLnNldChrZXksIHR1bm5lbCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMuZGV0ZWN0ZWQgPSBuZXcgTWFwKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50dW5uZWxTZXJ2aWNlLm9uVHVubmVsT3BlbmVkKGFzeW5jICh0dW5uZWwpID0+IHtcblx0XHRcdGNvbnN0IGtleSA9IG1ha2VBZGRyZXNzKHR1bm5lbC50dW5uZWxSZW1vdGVIb3N0LCB0dW5uZWwudHVubmVsUmVtb3RlUG9ydCk7XG5cdFx0XHRpZiAoIW1hcEhhc0FkZHJlc3NMb2NhbGhvc3RPckFsbEludGVyZmFjZXModGhpcy5mb3J3YXJkZWQsIHR1bm5lbC50dW5uZWxSZW1vdGVIb3N0LCB0dW5uZWwudHVubmVsUmVtb3RlUG9ydClcblx0XHRcdFx0JiYgIW1hcEhhc0FkZHJlc3NMb2NhbGhvc3RPckFsbEludGVyZmFjZXModGhpcy5kZXRlY3RlZCwgdHVubmVsLnR1bm5lbFJlbW90ZUhvc3QsIHR1bm5lbC50dW5uZWxSZW1vdGVQb3J0KVxuXHRcdFx0XHQmJiAhbWFwSGFzQWRkcmVzc0xvY2FsaG9zdE9yQWxsSW50ZXJmYWNlcyh0aGlzLmluUHJvZ3Jlc3MsIHR1bm5lbC50dW5uZWxSZW1vdGVIb3N0LCB0dW5uZWwudHVubmVsUmVtb3RlUG9ydClcblx0XHRcdFx0JiYgdHVubmVsLmxvY2FsQWRkcmVzcykge1xuXHRcdFx0XHRjb25zdCBtYXRjaGluZ0NhbmRpZGF0ZSA9IG1hcEhhc0FkZHJlc3NMb2NhbGhvc3RPckFsbEludGVyZmFjZXModGhpcy5fY2FuZGlkYXRlcyA/PyBuZXcgTWFwKCksIHR1bm5lbC50dW5uZWxSZW1vdGVIb3N0LCB0dW5uZWwudHVubmVsUmVtb3RlUG9ydCk7XG5cdFx0XHRcdGNvbnN0IGF0dHJpYnV0ZXMgPSAoYXdhaXQgdGhpcy5nZXRBdHRyaWJ1dGVzKFt7IHBvcnQ6IHR1bm5lbC50dW5uZWxSZW1vdGVQb3J0LCBob3N0OiB0dW5uZWwudHVubmVsUmVtb3RlSG9zdCB9XSkpPy5nZXQodHVubmVsLnR1bm5lbFJlbW90ZVBvcnQpO1xuXHRcdFx0XHR0aGlzLmZvcndhcmRlZC5zZXQoa2V5LCB7XG5cdFx0XHRcdFx0cmVtb3RlSG9zdDogdHVubmVsLnR1bm5lbFJlbW90ZUhvc3QsXG5cdFx0XHRcdFx0cmVtb3RlUG9ydDogdHVubmVsLnR1bm5lbFJlbW90ZVBvcnQsXG5cdFx0XHRcdFx0bG9jYWxBZGRyZXNzOiB0dW5uZWwubG9jYWxBZGRyZXNzLFxuXHRcdFx0XHRcdHByb3RvY29sOiBhdHRyaWJ1dGVzPy5wcm90b2NvbCA/PyBUdW5uZWxQcm90b2NvbC5IdHRwLFxuXHRcdFx0XHRcdGxvY2FsVXJpOiBhd2FpdCB0aGlzLm1ha2VMb2NhbFVyaSh0dW5uZWwubG9jYWxBZGRyZXNzLCBhdHRyaWJ1dGVzKSxcblx0XHRcdFx0XHRsb2NhbFBvcnQ6IHR1bm5lbC50dW5uZWxMb2NhbFBvcnQsXG5cdFx0XHRcdFx0bmFtZTogYXR0cmlidXRlcz8ubGFiZWwsXG5cdFx0XHRcdFx0Y2xvc2VhYmxlOiB0cnVlLFxuXHRcdFx0XHRcdHJ1bm5pbmdQcm9jZXNzOiBtYXRjaGluZ0NhbmRpZGF0ZT8uZGV0YWlsLFxuXHRcdFx0XHRcdGhhc1J1bm5pbmdQcm9jZXNzOiAhIW1hdGNoaW5nQ2FuZGlkYXRlLFxuXHRcdFx0XHRcdHBpZDogbWF0Y2hpbmdDYW5kaWRhdGU/LnBpZCxcblx0XHRcdFx0XHRwcml2YWN5OiB0dW5uZWwucHJpdmFjeSxcblx0XHRcdFx0XHRzb3VyY2U6IFVzZXJUdW5uZWxTb3VyY2UsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGhpcy5zdG9yZUZvcndhcmRlZCgpO1xuXHRcdFx0dGhpcy5jaGVja0V4dGVuc2lvbkFjdGl2YXRpb25FdmVudHModHJ1ZSk7XG5cdFx0XHR0aGlzLnJlbW90ZVR1bm5lbHMuc2V0KGtleSwgdHVubmVsKTtcblx0XHRcdHRoaXMuX29uRm9yd2FyZFBvcnQuZmlyZSh0aGlzLmZvcndhcmRlZC5nZXQoa2V5KSEpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnR1bm5lbFNlcnZpY2Uub25UdW5uZWxDbG9zZWQoYWRkcmVzcyA9PiB7XG5cdFx0XHRyZXR1cm4gdGhpcy5vblR1bm5lbENsb3NlZChhZGRyZXNzLCBUdW5uZWxDbG9zZVJlYXNvbi5PdGhlcik7XG5cdFx0fSkpO1xuXHRcdHRoaXMuY2hlY2tFeHRlbnNpb25BY3RpdmF0aW9uRXZlbnRzKGZhbHNlKTtcblx0fVxuXG5cdHByaXZhdGUgZXh0ZW5zaW9uSGFzQWN0aXZhdGlvbkV2ZW50KCkge1xuXHRcdGlmICh0aGlzLmV4dGVuc2lvblNlcnZpY2UuZXh0ZW5zaW9ucy5maW5kKGV4dGVuc2lvbiA9PiBleHRlbnNpb24uYWN0aXZhdGlvbkV2ZW50cz8uaW5jbHVkZXMoQUNUSVZBVElPTl9FVkVOVCkpKSB7XG5cdFx0XHR0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZUtleShmb3J3YXJkZWRQb3J0c1ZpZXdFbmFibGVkLmtleSwgdHJ1ZSk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBoYXNDaGVja2VkRXh0ZW5zaW9uc09uVHVubmVsT3BlbmVkID0gZmFsc2U7XG5cdHByaXZhdGUgY2hlY2tFeHRlbnNpb25BY3RpdmF0aW9uRXZlbnRzKHR1bm5lbE9wZW5lZDogYm9vbGVhbikge1xuXHRcdGlmICh0aGlzLmhhc0NoZWNrZWRFeHRlbnNpb25zT25UdW5uZWxPcGVuZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHR1bm5lbE9wZW5lZCkge1xuXHRcdFx0dGhpcy5oYXNDaGVja2VkRXh0ZW5zaW9uc09uVHVubmVsT3BlbmVkID0gdHJ1ZTtcblx0XHR9XG5cdFx0Y29uc3QgaGFzUmVtb3RlID0gdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5ICE9PSB1bmRlZmluZWQ7XG5cdFx0aWYgKGhhc1JlbW90ZSAmJiAhdHVubmVsT3BlbmVkKSB7XG5cdFx0XHQvLyBXZSBkb24ndCBhY3RpdmF0ZSBleHRlbnNpb25zIG9uIHN0YXJ0dXAgaWYgdGhlcmUgaXMgYSByZW1vdGVcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uSGFzQWN0aXZhdGlvbkV2ZW50KCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBhY3RpdmF0aW9uRGlzcG9zYWJsZSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuZXh0ZW5zaW9uU2VydmljZS5vbkRpZFJlZ2lzdGVyRXh0ZW5zaW9ucygoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5leHRlbnNpb25IYXNBY3RpdmF0aW9uRXZlbnQoKSkge1xuXHRcdFx0XHRhY3RpdmF0aW9uRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvblR1bm5lbENsb3NlZChhZGRyZXNzOiB7IGhvc3Q6IHN0cmluZzsgcG9ydDogbnVtYmVyIH0sIHJlYXNvbjogVHVubmVsQ2xvc2VSZWFzb24pIHtcblx0XHRjb25zdCBrZXkgPSBtYWtlQWRkcmVzcyhhZGRyZXNzLmhvc3QsIGFkZHJlc3MucG9ydCk7XG5cdFx0aWYgKHRoaXMuZm9yd2FyZGVkLmhhcyhrZXkpKSB7XG5cdFx0XHR0aGlzLmZvcndhcmRlZC5kZWxldGUoa2V5KTtcblx0XHRcdGF3YWl0IHRoaXMuc3RvcmVGb3J3YXJkZWQoKTtcblx0XHRcdHRoaXMuX29uQ2xvc2VQb3J0LmZpcmUoYWRkcmVzcyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBtYWtlTG9jYWxVcmkobG9jYWxBZGRyZXNzOiBzdHJpbmcsIGF0dHJpYnV0ZXM/OiBBdHRyaWJ1dGVzKSB7XG5cdFx0aWYgKGxvY2FsQWRkcmVzcy5zdGFydHNXaXRoKCdodHRwJykpIHtcblx0XHRcdHJldHVybiBVUkkucGFyc2UobG9jYWxBZGRyZXNzKTtcblx0XHR9XG5cdFx0Y29uc3QgcHJvdG9jb2wgPSBhdHRyaWJ1dGVzPy5wcm90b2NvbCA/PyAnaHR0cCc7XG5cdFx0cmV0dXJuIFVSSS5wYXJzZShgJHtwcm90b2NvbH06Ly8ke2xvY2FsQWRkcmVzc31gKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgYWRkU3RvcmFnZUtleVBvc3RmaXgocHJlZml4OiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHdvcmtzcGFjZSA9IHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCk7XG5cdFx0Y29uc3Qgd29ya3NwYWNlSGFzaCA9IHdvcmtzcGFjZS5jb25maWd1cmF0aW9uID8gaGFzaCh3b3Jrc3BhY2UuY29uZmlndXJhdGlvbi5wYXRoKSA6ICh3b3Jrc3BhY2UuZm9sZGVycy5sZW5ndGggPiAwID8gaGFzaCh3b3Jrc3BhY2UuZm9sZGVyc1swXS51cmkucGF0aCkgOiB1bmRlZmluZWQpO1xuXHRcdGlmICh3b3Jrc3BhY2VIYXNoID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5kZWJ1ZygnQ291bGQgbm90IGdldCB3b3Jrc3BhY2UgaGFzaCBmb3IgZm9yd2FyZGVkIHBvcnRzIHN0b3JhZ2Uga2V5LicpO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIGAke3ByZWZpeH0uJHt0aGlzLmVudmlyb25tZW50U2VydmljZS5yZW1vdGVBdXRob3JpdHl9LiR7d29ya3NwYWNlSGFzaH1gO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRUdW5uZWxSZXN0b3JlU3RvcmFnZUtleSgpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLmFkZFN0b3JhZ2VLZXlQb3N0Zml4KFRVTk5FTFNfVE9fUkVTVE9SRSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldFJlc3RvcmVFeHBpcmF0aW9uU3RvcmFnZUtleSgpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLmFkZFN0b3JhZ2VLZXlQb3N0Zml4KFRVTk5FTFNfVE9fUkVTVE9SRV9FWFBJUkFUSU9OKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0VHVubmVsUmVzdG9yZVZhbHVlKCk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgZGVwcmVjYXRlZFZhbHVlID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQoVFVOTkVMU19UT19SRVNUT1JFLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKTtcblx0XHRpZiAoZGVwcmVjYXRlZFZhbHVlKSB7XG5cdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShUVU5ORUxTX1RPX1JFU1RPUkUsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpO1xuXHRcdFx0YXdhaXQgdGhpcy5zdG9yZUZvcndhcmRlZCgpO1xuXHRcdFx0cmV0dXJuIGRlcHJlY2F0ZWRWYWx1ZTtcblx0XHR9XG5cdFx0Y29uc3Qgc3RvcmFnZUtleSA9IGF3YWl0IHRoaXMuZ2V0VHVubmVsUmVzdG9yZVN0b3JhZ2VLZXkoKTtcblx0XHRpZiAoIXN0b3JhZ2VLZXkpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChzdG9yYWdlS2V5LCBTdG9yYWdlU2NvcGUuUFJPRklMRSk7XG5cdH1cblxuXHRhc3luYyByZXN0b3JlRm9yd2FyZGVkKCkge1xuXHRcdHRoaXMuY2xlYW51cEV4cGlyZWRUdW5uZWxzRm9yUmVzdG9yZSgpO1xuXHRcdGlmICh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdyZW1vdGUucmVzdG9yZUZvcndhcmRlZFBvcnRzJykpIHtcblx0XHRcdGNvbnN0IHR1bm5lbFJlc3RvcmVWYWx1ZSA9IGF3YWl0IHRoaXMudHVubmVsUmVzdG9yZVZhbHVlO1xuXHRcdFx0aWYgKHR1bm5lbFJlc3RvcmVWYWx1ZSAmJiAodHVubmVsUmVzdG9yZVZhbHVlICE9PSB0aGlzLmtub3duUG9ydHNSZXN0b3JlVmFsdWUpKSB7XG5cdFx0XHRcdGNvbnN0IHR1bm5lbHMgPSA8UmVzdG9yYWJsZVR1bm5lbFtdIHwgdW5kZWZpbmVkPkpTT04ucGFyc2UodHVubmVsUmVzdG9yZVZhbHVlKSA/PyBbXTtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBGb3J3YXJkZWRQb3J0czogKFR1bm5lbE1vZGVsKSByZXN0b3JpbmcgcG9ydHMgJHt0dW5uZWxzLm1hcCh0dW5uZWwgPT4gdHVubmVsLnJlbW90ZVBvcnQpLmpvaW4oJywgJyl9YCk7XG5cdFx0XHRcdGZvciAoY29uc3QgdHVubmVsIG9mIHR1bm5lbHMpIHtcblx0XHRcdFx0XHRjb25zdCBhbHJlYWR5Rm9yd2FyZGVkID0gbWFwSGFzQWRkcmVzc0xvY2FsaG9zdE9yQWxsSW50ZXJmYWNlcyh0aGlzLmRldGVjdGVkLCB0dW5uZWwucmVtb3RlSG9zdCwgdHVubmVsLnJlbW90ZVBvcnQpO1xuXHRcdFx0XHRcdC8vIEV4dGVuc2lvbiBmb3J3YXJkZWQgcG9ydHMgc2hvdWxkIG9ubHkgYmUgdXBkYXRlZCwgbm90IHJlc3RvcmVkLlxuXHRcdFx0XHRcdGlmICgodHVubmVsLnNvdXJjZS5zb3VyY2UgIT09IFR1bm5lbFNvdXJjZS5FeHRlbnNpb24gJiYgIWFscmVhZHlGb3J3YXJkZWQpIHx8ICh0dW5uZWwuc291cmNlLnNvdXJjZSA9PT0gVHVubmVsU291cmNlLkV4dGVuc2lvbiAmJiBhbHJlYWR5Rm9yd2FyZGVkKSkge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5kb0ZvcndhcmQoe1xuXHRcdFx0XHRcdFx0XHRyZW1vdGU6IHsgaG9zdDogdHVubmVsLnJlbW90ZUhvc3QsIHBvcnQ6IHR1bm5lbC5yZW1vdGVQb3J0IH0sXG5cdFx0XHRcdFx0XHRcdGxvY2FsOiB0dW5uZWwubG9jYWxQb3J0LFxuXHRcdFx0XHRcdFx0XHRuYW1lOiB0dW5uZWwubmFtZSxcblx0XHRcdFx0XHRcdFx0ZWxldmF0ZUlmTmVlZGVkOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRzb3VyY2U6IHR1bm5lbC5zb3VyY2Vcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAodHVubmVsLnNvdXJjZS5zb3VyY2UgPT09IFR1bm5lbFNvdXJjZS5FeHRlbnNpb24gJiYgIWFscmVhZHlGb3J3YXJkZWQpIHtcblx0XHRcdFx0XHRcdHRoaXMudW5yZXN0b3JlZEV4dGVuc2lvblR1bm5lbHMuc2V0KG1ha2VBZGRyZXNzKHR1bm5lbC5yZW1vdGVIb3N0LCB0dW5uZWwucmVtb3RlUG9ydCksIHR1bm5lbCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5yZXN0b3JlQ29tcGxldGUgPSB0cnVlO1xuXHRcdHRoaXMub25SZXN0b3JlQ29tcGxldGUuZmlyZSgpO1xuXG5cdFx0aWYgKCF0aGlzLnJlc3RvcmVMaXN0ZW5lcikge1xuXHRcdFx0Ly8gSXQncyBwb3NzaWJsZSB0aGF0IGF0IHJlc3RvcmUgdGltZSB0aGUgdmFsdWUgaGFzbid0IHN5bmNlZC5cblx0XHRcdGNvbnN0IGtleSA9IGF3YWl0IHRoaXMuZ2V0VHVubmVsUmVzdG9yZVN0b3JhZ2VLZXkoKTtcblx0XHRcdHRoaXMucmVzdG9yZUxpc3RlbmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0XHRcdHRoaXMucmVzdG9yZUxpc3RlbmVyLmFkZCh0aGlzLnN0b3JhZ2VTZXJ2aWNlLm9uRGlkQ2hhbmdlVmFsdWUoU3RvcmFnZVNjb3BlLlBST0ZJTEUsIHVuZGVmaW5lZCwgdGhpcy5yZXN0b3JlTGlzdGVuZXIpKGFzeW5jIChlKSA9PiB7XG5cdFx0XHRcdGlmIChlLmtleSA9PT0ga2V5KSB7XG5cdFx0XHRcdFx0dGhpcy50dW5uZWxSZXN0b3JlVmFsdWUgPSBQcm9taXNlLnJlc29sdmUodGhpcy5zdG9yYWdlU2VydmljZS5nZXQoa2V5LCBTdG9yYWdlU2NvcGUuUFJPRklMRSkpO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMucmVzdG9yZUZvcndhcmRlZCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjbGVhbnVwRXhwaXJlZFR1bm5lbHNGb3JSZXN0b3JlKCkge1xuXHRcdGNvbnN0IGtleXMgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmtleXMoU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuVVNFUikuZmlsdGVyKGtleSA9PiBrZXkuc3RhcnRzV2l0aChUVU5ORUxTX1RPX1JFU1RPUkVfRVhQSVJBVElPTikpO1xuXHRcdGZvciAoY29uc3Qga2V5IG9mIGtleXMpIHtcblx0XHRcdGNvbnN0IGV4cGlyYXRpb24gPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldE51bWJlcihrZXksIFN0b3JhZ2VTY29wZS5QUk9GSUxFKTtcblx0XHRcdGlmIChleHBpcmF0aW9uICYmIGV4cGlyYXRpb24gPCBEYXRlLm5vdygpKSB7XG5cdFx0XHRcdHRoaXMudHVubmVsUmVzdG9yZVZhbHVlID0gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0XHRcdGNvbnN0IHN0b3JhZ2VLZXkgPSBrZXkucmVwbGFjZShUVU5ORUxTX1RPX1JFU1RPUkVfRVhQSVJBVElPTiwgVFVOTkVMU19UT19SRVNUT1JFKTtcblx0XHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5yZW1vdmUoa2V5LCBTdG9yYWdlU2NvcGUuUFJPRklMRSk7XG5cdFx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2UucmVtb3ZlKHN0b3JhZ2VLZXksIFN0b3JhZ2VTY29wZS5QUk9GSUxFKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRAZGVib3VuY2UoMTAwMClcblx0cHJpdmF0ZSBhc3luYyBzdG9yZUZvcndhcmRlZCgpIHtcblx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgncmVtb3RlLnJlc3RvcmVGb3J3YXJkZWRQb3J0cycpKSB7XG5cdFx0XHRjb25zdCBmb3J3YXJkZWQgPSBBcnJheS5mcm9tKHRoaXMuZm9yd2FyZGVkLnZhbHVlcygpKTtcblx0XHRcdGNvbnN0IHJlc3RvcmFibGVUdW5uZWxzOiBSZXN0b3JhYmxlVHVubmVsW10gPSBmb3J3YXJkZWQubWFwKHR1bm5lbCA9PiB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0cmVtb3RlSG9zdDogdHVubmVsLnJlbW90ZUhvc3QsXG5cdFx0XHRcdFx0cmVtb3RlUG9ydDogdHVubmVsLnJlbW90ZVBvcnQsXG5cdFx0XHRcdFx0bG9jYWxQb3J0OiB0dW5uZWwubG9jYWxQb3J0LFxuXHRcdFx0XHRcdG5hbWU6IHR1bm5lbC5uYW1lLFxuXHRcdFx0XHRcdGxvY2FsQWRkcmVzczogdHVubmVsLmxvY2FsQWRkcmVzcyxcblx0XHRcdFx0XHRsb2NhbFVyaTogdHVubmVsLmxvY2FsVXJpLFxuXHRcdFx0XHRcdHByb3RvY29sOiB0dW5uZWwucHJvdG9jb2wsXG5cdFx0XHRcdFx0c291cmNlOiB0dW5uZWwuc291cmNlLFxuXHRcdFx0XHR9O1xuXHRcdFx0fSk7XG5cdFx0XHRsZXQgdmFsdWVUb1N0b3JlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoZm9yd2FyZGVkLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0dmFsdWVUb1N0b3JlID0gSlNPTi5zdHJpbmdpZnkocmVzdG9yYWJsZVR1bm5lbHMpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBrZXkgPSBhd2FpdCB0aGlzLmdldFR1bm5lbFJlc3RvcmVTdG9yYWdlS2V5KCk7XG5cdFx0XHRjb25zdCBleHBpcmF0aW9uS2V5ID0gYXdhaXQgdGhpcy5nZXRSZXN0b3JlRXhwaXJhdGlvblN0b3JhZ2VLZXkoKTtcblx0XHRcdGlmICghdmFsdWVUb1N0b3JlICYmIGtleSAmJiBleHBpcmF0aW9uS2V5KSB7XG5cdFx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2UucmVtb3ZlKGtleSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUpO1xuXHRcdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShleHBpcmF0aW9uS2V5LCBTdG9yYWdlU2NvcGUuUFJPRklMRSk7XG5cdFx0XHR9IGVsc2UgaWYgKCh2YWx1ZVRvU3RvcmUgIT09IHRoaXMua25vd25Qb3J0c1Jlc3RvcmVWYWx1ZSkgJiYga2V5ICYmIGV4cGlyYXRpb25LZXkpIHtcblx0XHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShrZXksIHZhbHVlVG9TdG9yZSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cdFx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoZXhwaXJhdGlvbktleSwgRGF0ZS5ub3coKSArIFJFU1RPUkVfRVhQSVJBVElPTl9USU1FLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0XHRcdH1cblx0XHRcdHRoaXMua25vd25Qb3J0c1Jlc3RvcmVWYWx1ZSA9IHZhbHVlVG9TdG9yZTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG1pc21hdGNoQ29vbGRvd24gPSBuZXcgRGF0ZSgpO1xuXHRwcml2YXRlIGFzeW5jIHNob3dQb3J0TWlzbWF0Y2hNb2RhbElmTmVlZGVkKHR1bm5lbDogUmVtb3RlVHVubmVsLCBleHBlY3RlZExvY2FsOiBudW1iZXIsIGF0dHJpYnV0ZXM6IEF0dHJpYnV0ZXMgfCB1bmRlZmluZWQpIHtcblx0XHRpZiAoIXR1bm5lbC50dW5uZWxMb2NhbFBvcnQgfHwgIWF0dHJpYnV0ZXM/LnJlcXVpcmVMb2NhbFBvcnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHR1bm5lbC50dW5uZWxMb2NhbFBvcnQgPT09IGV4cGVjdGVkTG9jYWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBuZXdDb29sZG93biA9IG5ldyBEYXRlKCk7XG5cdFx0aWYgKCh0aGlzLm1pc21hdGNoQ29vbGRvd24uZ2V0VGltZSgpICsgTUlTTUFUQ0hfTE9DQUxfUE9SVF9DT09MRE9XTikgPiBuZXdDb29sZG93bi5nZXRUaW1lKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5taXNtYXRjaENvb2xkb3duID0gbmV3Q29vbGRvd247XG5cdFx0Y29uc3QgbWlzbWF0Y2hTdHJpbmcgPSBubHMubG9jYWxpemUoJ3JlbW90ZS5sb2NhbFBvcnRNaXNtYXRjaC5zaW5nbGUnLCBcIkxvY2FsIHBvcnQgezB9IGNvdWxkIG5vdCBiZSB1c2VkIGZvciBmb3J3YXJkaW5nIHRvIHJlbW90ZSBwb3J0IHsxfS5cXG5cXG5UaGlzIHVzdWFsbHkgaGFwcGVucyB3aGVuIHRoZXJlIGlzIGFscmVhZHkgYW5vdGhlciBwcm9jZXNzIHVzaW5nIGxvY2FsIHBvcnQgezB9LlxcblxcblBvcnQgbnVtYmVyIHsyfSBoYXMgYmVlbiB1c2VkIGluc3RlYWQuXCIsXG5cdFx0XHRleHBlY3RlZExvY2FsLCB0dW5uZWwudHVubmVsUmVtb3RlUG9ydCwgdHVubmVsLnR1bm5lbExvY2FsUG9ydCk7XG5cdFx0cmV0dXJuIHRoaXMuZGlhbG9nU2VydmljZS5pbmZvKG1pc21hdGNoU3RyaW5nKTtcblx0fVxuXG5cdGFzeW5jIGZvcndhcmQodHVubmVsUHJvcGVydGllczogVHVubmVsUHJvcGVydGllcywgYXR0cmlidXRlcz86IEF0dHJpYnV0ZXMgfCBudWxsKTogUHJvbWlzZTxSZW1vdGVUdW5uZWwgfCBzdHJpbmcgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXRoaXMucmVzdG9yZUNvbXBsZXRlICYmIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSkge1xuXHRcdFx0YXdhaXQgRXZlbnQudG9Qcm9taXNlKHRoaXMub25SZXN0b3JlQ29tcGxldGUuZXZlbnQpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5kb0ZvcndhcmQodHVubmVsUHJvcGVydGllcywgYXR0cmlidXRlcyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvRm9yd2FyZCh0dW5uZWxQcm9wZXJ0aWVzOiBUdW5uZWxQcm9wZXJ0aWVzLCBhdHRyaWJ1dGVzPzogQXR0cmlidXRlcyB8IG51bGwpOiBQcm9taXNlPFJlbW90ZVR1bm5lbCB8IHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuXHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uU2VydmljZS5hY3RpdmF0ZUJ5RXZlbnQoQUNUSVZBVElPTl9FVkVOVCk7XG5cblx0XHRjb25zdCBleGlzdGluZ1R1bm5lbCA9IG1hcEhhc0FkZHJlc3NMb2NhbGhvc3RPckFsbEludGVyZmFjZXModGhpcy5mb3J3YXJkZWQsIHR1bm5lbFByb3BlcnRpZXMucmVtb3RlLmhvc3QsIHR1bm5lbFByb3BlcnRpZXMucmVtb3RlLnBvcnQpO1xuXHRcdGF0dHJpYnV0ZXMgPSBhdHRyaWJ1dGVzID8/XG5cdFx0XHQoKGF0dHJpYnV0ZXMgIT09IG51bGwpXG5cdFx0XHRcdD8gKGF3YWl0IHRoaXMuZ2V0QXR0cmlidXRlcyhbdHVubmVsUHJvcGVydGllcy5yZW1vdGVdKSk/LmdldCh0dW5uZWxQcm9wZXJ0aWVzLnJlbW90ZS5wb3J0KVxuXHRcdFx0XHQ6IHVuZGVmaW5lZCk7XG5cdFx0Y29uc3QgbG9jYWxQb3J0ID0gKHR1bm5lbFByb3BlcnRpZXMubG9jYWwgIT09IHVuZGVmaW5lZCkgPyB0dW5uZWxQcm9wZXJ0aWVzLmxvY2FsIDogdHVubmVsUHJvcGVydGllcy5yZW1vdGUucG9ydDtcblx0XHRsZXQgbm9UdW5uZWxWYWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGlmICghZXhpc3RpbmdUdW5uZWwpIHtcblx0XHRcdGNvbnN0IGF1dGhvcml0eSA9IHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eTtcblx0XHRcdGNvbnN0IGFkZHJlc3NQcm92aWRlcjogSUFkZHJlc3NQcm92aWRlciB8IHVuZGVmaW5lZCA9IGF1dGhvcml0eSA/IHtcblx0XHRcdFx0Z2V0QWRkcmVzczogYXN5bmMgKCkgPT4geyByZXR1cm4gKGF3YWl0IHRoaXMucmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlLnJlc29sdmVBdXRob3JpdHkoYXV0aG9yaXR5KSkuYXV0aG9yaXR5OyB9XG5cdFx0XHR9IDogdW5kZWZpbmVkO1xuXG5cdFx0XHRjb25zdCBrZXkgPSBtYWtlQWRkcmVzcyh0dW5uZWxQcm9wZXJ0aWVzLnJlbW90ZS5ob3N0LCB0dW5uZWxQcm9wZXJ0aWVzLnJlbW90ZS5wb3J0KTtcblx0XHRcdHRoaXMuaW5Qcm9ncmVzcy5zZXQoa2V5LCB0cnVlKTtcblx0XHRcdHR1bm5lbFByb3BlcnRpZXMgPSB0aGlzLm1lcmdlQ2FjaGVkQW5kVW5yZXN0b3JlZFByb3BlcnRpZXMoa2V5LCB0dW5uZWxQcm9wZXJ0aWVzKTtcblxuXHRcdFx0Y29uc3QgdHVubmVsID0gYXdhaXQgdGhpcy50dW5uZWxTZXJ2aWNlLm9wZW5UdW5uZWwoYWRkcmVzc1Byb3ZpZGVyLCB0dW5uZWxQcm9wZXJ0aWVzLnJlbW90ZS5ob3N0LCB0dW5uZWxQcm9wZXJ0aWVzLnJlbW90ZS5wb3J0LCB1bmRlZmluZWQsIGxvY2FsUG9ydCwgKCF0dW5uZWxQcm9wZXJ0aWVzLmVsZXZhdGVJZk5lZWRlZCkgPyBhdHRyaWJ1dGVzPy5lbGV2YXRlSWZOZWVkZWQgOiB0dW5uZWxQcm9wZXJ0aWVzLmVsZXZhdGVJZk5lZWRlZCwgdHVubmVsUHJvcGVydGllcy5wcml2YWN5LCBhdHRyaWJ1dGVzPy5wcm90b2NvbCk7XG5cdFx0XHRpZiAodHlwZW9mIHR1bm5lbCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0Ly8gVGhlcmUgd2FzIGFuIGVycm9yICB3aGlsZSBjcmVhdGluZyB0aGUgdHVubmVsLlxuXHRcdFx0XHRub1R1bm5lbFZhbHVlID0gdHVubmVsO1xuXHRcdFx0fSBlbHNlIGlmICh0dW5uZWwgJiYgdHVubmVsLmxvY2FsQWRkcmVzcykge1xuXHRcdFx0XHRjb25zdCBtYXRjaGluZ0NhbmRpZGF0ZSA9IG1hcEhhc0FkZHJlc3NMb2NhbGhvc3RPckFsbEludGVyZmFjZXM8Q2FuZGlkYXRlUG9ydD4odGhpcy5fY2FuZGlkYXRlcyA/PyBuZXcgTWFwKCksIHR1bm5lbFByb3BlcnRpZXMucmVtb3RlLmhvc3QsIHR1bm5lbFByb3BlcnRpZXMucmVtb3RlLnBvcnQpO1xuXHRcdFx0XHRjb25zdCBwcm90b2NvbCA9ICh0dW5uZWwucHJvdG9jb2wgP1xuXHRcdFx0XHRcdCgodHVubmVsLnByb3RvY29sID09PSBUdW5uZWxQcm90b2NvbC5IdHRwcykgPyBUdW5uZWxQcm90b2NvbC5IdHRwcyA6IFR1bm5lbFByb3RvY29sLkh0dHApXG5cdFx0XHRcdFx0OiAoYXR0cmlidXRlcz8ucHJvdG9jb2wgPz8gVHVubmVsUHJvdG9jb2wuSHR0cCkpO1xuXHRcdFx0XHRjb25zdCBuZXdGb3J3YXJkOiBUdW5uZWwgPSB7XG5cdFx0XHRcdFx0cmVtb3RlSG9zdDogdHVubmVsLnR1bm5lbFJlbW90ZUhvc3QsXG5cdFx0XHRcdFx0cmVtb3RlUG9ydDogdHVubmVsLnR1bm5lbFJlbW90ZVBvcnQsXG5cdFx0XHRcdFx0bG9jYWxQb3J0OiB0dW5uZWwudHVubmVsTG9jYWxQb3J0LFxuXHRcdFx0XHRcdG5hbWU6IGF0dHJpYnV0ZXM/LmxhYmVsID8/IHR1bm5lbFByb3BlcnRpZXMubmFtZSxcblx0XHRcdFx0XHRjbG9zZWFibGU6IHRydWUsXG5cdFx0XHRcdFx0bG9jYWxBZGRyZXNzOiB0dW5uZWwubG9jYWxBZGRyZXNzLFxuXHRcdFx0XHRcdHByb3RvY29sLFxuXHRcdFx0XHRcdGxvY2FsVXJpOiBhd2FpdCB0aGlzLm1ha2VMb2NhbFVyaSh0dW5uZWwubG9jYWxBZGRyZXNzLCBhdHRyaWJ1dGVzKSxcblx0XHRcdFx0XHRydW5uaW5nUHJvY2VzczogbWF0Y2hpbmdDYW5kaWRhdGU/LmRldGFpbCxcblx0XHRcdFx0XHRoYXNSdW5uaW5nUHJvY2VzczogISFtYXRjaGluZ0NhbmRpZGF0ZSxcblx0XHRcdFx0XHRwaWQ6IG1hdGNoaW5nQ2FuZGlkYXRlPy5waWQsXG5cdFx0XHRcdFx0c291cmNlOiB0dW5uZWxQcm9wZXJ0aWVzLnNvdXJjZSA/PyBVc2VyVHVubmVsU291cmNlLFxuXHRcdFx0XHRcdHByaXZhY3k6IHR1bm5lbC5wcml2YWN5LFxuXHRcdFx0XHR9O1xuXHRcdFx0XHR0aGlzLmZvcndhcmRlZC5zZXQoa2V5LCBuZXdGb3J3YXJkKTtcblx0XHRcdFx0dGhpcy5yZW1vdGVUdW5uZWxzLnNldChrZXksIHR1bm5lbCk7XG5cdFx0XHRcdHRoaXMuaW5Qcm9ncmVzcy5kZWxldGUoa2V5KTtcblx0XHRcdFx0YXdhaXQgdGhpcy5zdG9yZUZvcndhcmRlZCgpO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnNob3dQb3J0TWlzbWF0Y2hNb2RhbElmTmVlZGVkKHR1bm5lbCwgbG9jYWxQb3J0LCBhdHRyaWJ1dGVzKTtcblx0XHRcdFx0dGhpcy5fb25Gb3J3YXJkUG9ydC5maXJlKG5ld0ZvcndhcmQpO1xuXHRcdFx0XHRyZXR1cm4gdHVubmVsO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5pblByb2dyZXNzLmRlbGV0ZShrZXkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5tZXJnZUF0dHJpYnV0ZXNJbnRvRXhpc3RpbmdUdW5uZWwoZXhpc3RpbmdUdW5uZWwsIHR1bm5lbFByb3BlcnRpZXMsIGF0dHJpYnV0ZXMpO1xuXHRcdH1cblxuXHRcdHJldHVybiBub1R1bm5lbFZhbHVlO1xuXHR9XG5cblx0cHJpdmF0ZSBtZXJnZUNhY2hlZEFuZFVucmVzdG9yZWRQcm9wZXJ0aWVzKGtleTogc3RyaW5nLCB0dW5uZWxQcm9wZXJ0aWVzOiBUdW5uZWxQcm9wZXJ0aWVzKTogVHVubmVsUHJvcGVydGllcyB7XG5cdFx0Y29uc3QgbWFwID0gdGhpcy51bnJlc3RvcmVkRXh0ZW5zaW9uVHVubmVscy5oYXMoa2V5KSA/IHRoaXMudW5yZXN0b3JlZEV4dGVuc2lvblR1bm5lbHMgOiAodGhpcy5zZXNzaW9uQ2FjaGVkUHJvcGVydGllcy5oYXMoa2V5KSA/IHRoaXMuc2Vzc2lvbkNhY2hlZFByb3BlcnRpZXMgOiB1bmRlZmluZWQpO1xuXHRcdGlmIChtYXApIHtcblx0XHRcdGNvbnN0IHVwZGF0ZVByb3BzID0gbWFwLmdldChrZXkpITtcblx0XHRcdG1hcC5kZWxldGUoa2V5KTtcblx0XHRcdGlmICh1cGRhdGVQcm9wcykge1xuXHRcdFx0XHR0dW5uZWxQcm9wZXJ0aWVzLm5hbWUgPSB1cGRhdGVQcm9wcy5uYW1lID8/IHR1bm5lbFByb3BlcnRpZXMubmFtZTtcblx0XHRcdFx0dHVubmVsUHJvcGVydGllcy5sb2NhbCA9ICgoJ2xvY2FsJyBpbiB1cGRhdGVQcm9wcykgPyB1cGRhdGVQcm9wcy5sb2NhbCA6ICgoJ2xvY2FsUG9ydCcgaW4gdXBkYXRlUHJvcHMpID8gdXBkYXRlUHJvcHMubG9jYWxQb3J0IDogdW5kZWZpbmVkKSkgPz8gdHVubmVsUHJvcGVydGllcy5sb2NhbDtcblx0XHRcdFx0dHVubmVsUHJvcGVydGllcy5wcml2YWN5ID0gdHVubmVsUHJvcGVydGllcy5wcml2YWN5O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdHVubmVsUHJvcGVydGllcztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgbWVyZ2VBdHRyaWJ1dGVzSW50b0V4aXN0aW5nVHVubmVsKGV4aXN0aW5nVHVubmVsOiBUdW5uZWwsIHR1bm5lbFByb3BlcnRpZXM6IFR1bm5lbFByb3BlcnRpZXMsIGF0dHJpYnV0ZXM6IEF0dHJpYnV0ZXMgfCB1bmRlZmluZWQpIHtcblx0XHRjb25zdCBuZXdOYW1lID0gYXR0cmlidXRlcz8ubGFiZWwgPz8gdHVubmVsUHJvcGVydGllcy5uYW1lO1xuXHRcdGVudW0gTWVyZ2VkQXR0cmlidXRlQWN0aW9uIHtcblx0XHRcdE5vbmUgPSAwLFxuXHRcdFx0RmlyZSA9IDEsXG5cdFx0XHRSZW9wZW4gPSAyXG5cdFx0fVxuXHRcdGxldCBtZXJnZWRBY3Rpb24gPSBNZXJnZWRBdHRyaWJ1dGVBY3Rpb24uTm9uZTtcblx0XHRpZiAobmV3TmFtZSAhPT0gZXhpc3RpbmdUdW5uZWwubmFtZSkge1xuXHRcdFx0ZXhpc3RpbmdUdW5uZWwubmFtZSA9IG5ld05hbWU7XG5cdFx0XHRtZXJnZWRBY3Rpb24gPSBNZXJnZWRBdHRyaWJ1dGVBY3Rpb24uRmlyZTtcblx0XHR9XG5cdFx0Ly8gU291cmNlIG9mIGV4aXN0aW5nIHR1bm5lbCB3aW5zIHNvIHRoYXQgb3JpZ2luYWwgc291cmNlIGlzIG1haW50YWluZWRcblx0XHRpZiAoKGF0dHJpYnV0ZXM/LnByb3RvY29sIHx8IChleGlzdGluZ1R1bm5lbC5wcm90b2NvbCAhPT0gVHVubmVsUHJvdG9jb2wuSHR0cCkpICYmIChhdHRyaWJ1dGVzPy5wcm90b2NvbCAhPT0gZXhpc3RpbmdUdW5uZWwucHJvdG9jb2wpKSB7XG5cdFx0XHR0dW5uZWxQcm9wZXJ0aWVzLnNvdXJjZSA9IGV4aXN0aW5nVHVubmVsLnNvdXJjZTtcblx0XHRcdG1lcmdlZEFjdGlvbiA9IE1lcmdlZEF0dHJpYnV0ZUFjdGlvbi5SZW9wZW47XG5cdFx0fVxuXHRcdC8vIE5ldyBwcml2YWN5IHZhbHVlIHdpbnNcblx0XHRpZiAodHVubmVsUHJvcGVydGllcy5wcml2YWN5ICYmIChleGlzdGluZ1R1bm5lbC5wcml2YWN5ICE9PSB0dW5uZWxQcm9wZXJ0aWVzLnByaXZhY3kpKSB7XG5cdFx0XHRtZXJnZWRBY3Rpb24gPSBNZXJnZWRBdHRyaWJ1dGVBY3Rpb24uUmVvcGVuO1xuXHRcdH1cblx0XHRzd2l0Y2ggKG1lcmdlZEFjdGlvbikge1xuXHRcdFx0Y2FzZSBNZXJnZWRBdHRyaWJ1dGVBY3Rpb24uRmlyZToge1xuXHRcdFx0XHR0aGlzLl9vbkZvcndhcmRQb3J0LmZpcmUoKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIE1lcmdlZEF0dHJpYnV0ZUFjdGlvbi5SZW9wZW46IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5jbG9zZShleGlzdGluZ1R1bm5lbC5yZW1vdGVIb3N0LCBleGlzdGluZ1R1bm5lbC5yZW1vdGVQb3J0LCBUdW5uZWxDbG9zZVJlYXNvbi5Vc2VyKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5kb0ZvcndhcmQodHVubmVsUHJvcGVydGllcywgYXR0cmlidXRlcyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG1hcEhhc0FkZHJlc3NMb2NhbGhvc3RPckFsbEludGVyZmFjZXModGhpcy5yZW1vdGVUdW5uZWxzLCB0dW5uZWxQcm9wZXJ0aWVzLnJlbW90ZS5ob3N0LCB0dW5uZWxQcm9wZXJ0aWVzLnJlbW90ZS5wb3J0KTtcblx0fVxuXG5cdGFzeW5jIG5hbWUoaG9zdDogc3RyaW5nLCBwb3J0OiBudW1iZXIsIG5hbWU6IHN0cmluZykge1xuXHRcdGNvbnN0IGV4aXN0aW5nRm9yd2FyZGVkID0gbWFwSGFzQWRkcmVzc0xvY2FsaG9zdE9yQWxsSW50ZXJmYWNlcyh0aGlzLmZvcndhcmRlZCwgaG9zdCwgcG9ydCk7XG5cdFx0Y29uc3Qga2V5ID0gbWFrZUFkZHJlc3MoaG9zdCwgcG9ydCk7XG5cdFx0aWYgKGV4aXN0aW5nRm9yd2FyZGVkKSB7XG5cdFx0XHRleGlzdGluZ0ZvcndhcmRlZC5uYW1lID0gbmFtZTtcblx0XHRcdGF3YWl0IHRoaXMuc3RvcmVGb3J3YXJkZWQoKTtcblx0XHRcdHRoaXMuX29uUG9ydE5hbWUuZmlyZSh7IGhvc3QsIHBvcnQgfSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fSBlbHNlIGlmICh0aGlzLmRldGVjdGVkLmhhcyhrZXkpKSB7XG5cdFx0XHR0aGlzLmRldGVjdGVkLmdldChrZXkpIS5uYW1lID0gbmFtZTtcblx0XHRcdHRoaXMuX29uUG9ydE5hbWUuZmlyZSh7IGhvc3QsIHBvcnQgfSk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgY2xvc2UoaG9zdDogc3RyaW5nLCBwb3J0OiBudW1iZXIsIHJlYXNvbjogVHVubmVsQ2xvc2VSZWFzb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBrZXkgPSBtYWtlQWRkcmVzcyhob3N0LCBwb3J0KTtcblx0XHRjb25zdCBvbGRUdW5uZWwgPSB0aGlzLmZvcndhcmRlZC5nZXQoa2V5KSE7XG5cdFx0aWYgKChyZWFzb24gPT09IFR1bm5lbENsb3NlUmVhc29uLkF1dG9Gb3J3YXJkRW5kKSAmJiBvbGRUdW5uZWwgJiYgKG9sZFR1bm5lbC5zb3VyY2Uuc291cmNlID09PSBUdW5uZWxTb3VyY2UuQXV0bykpIHtcblx0XHRcdHRoaXMuc2Vzc2lvbkNhY2hlZFByb3BlcnRpZXMuc2V0KGtleSwge1xuXHRcdFx0XHRsb2NhbDogb2xkVHVubmVsLmxvY2FsUG9ydCxcblx0XHRcdFx0bmFtZTogb2xkVHVubmVsLm5hbWUsXG5cdFx0XHRcdHByaXZhY3k6IG9sZFR1bm5lbC5wcml2YWN5LFxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdGF3YWl0IHRoaXMudHVubmVsU2VydmljZS5jbG9zZVR1bm5lbChob3N0LCBwb3J0KTtcblx0XHRyZXR1cm4gdGhpcy5vblR1bm5lbENsb3NlZCh7IGhvc3QsIHBvcnQgfSwgcmVhc29uKTtcblx0fVxuXG5cdGFkZHJlc3MoaG9zdDogc3RyaW5nLCBwb3J0OiBudW1iZXIpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGtleSA9IG1ha2VBZGRyZXNzKGhvc3QsIHBvcnQpO1xuXHRcdHJldHVybiAodGhpcy5mb3J3YXJkZWQuZ2V0KGtleSkgfHwgdGhpcy5kZXRlY3RlZC5nZXQoa2V5KSk/LmxvY2FsQWRkcmVzcztcblx0fVxuXG5cdHB1YmxpYyBnZXQgZW52aXJvbm1lbnRUdW5uZWxzU2V0KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9lbnZpcm9ubWVudFR1bm5lbHNTZXQ7XG5cdH1cblxuXHRhZGRFbnZpcm9ubWVudFR1bm5lbHModHVubmVsczogVHVubmVsRGVzY3JpcHRpb25bXSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmICh0dW5uZWxzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHR1bm5lbCBvZiB0dW5uZWxzKSB7XG5cdFx0XHRcdGNvbnN0IG1hdGNoaW5nQ2FuZGlkYXRlID0gbWFwSGFzQWRkcmVzc0xvY2FsaG9zdE9yQWxsSW50ZXJmYWNlcyh0aGlzLl9jYW5kaWRhdGVzID8/IG5ldyBNYXAoKSwgdHVubmVsLnJlbW90ZUFkZHJlc3MuaG9zdCwgdHVubmVsLnJlbW90ZUFkZHJlc3MucG9ydCk7XG5cdFx0XHRcdGNvbnN0IGxvY2FsQWRkcmVzcyA9IHR5cGVvZiB0dW5uZWwubG9jYWxBZGRyZXNzID09PSAnc3RyaW5nJyA/IHR1bm5lbC5sb2NhbEFkZHJlc3MgOiBtYWtlQWRkcmVzcyh0dW5uZWwubG9jYWxBZGRyZXNzLmhvc3QsIHR1bm5lbC5sb2NhbEFkZHJlc3MucG9ydCk7XG5cdFx0XHRcdHRoaXMuZGV0ZWN0ZWQuc2V0KG1ha2VBZGRyZXNzKHR1bm5lbC5yZW1vdGVBZGRyZXNzLmhvc3QsIHR1bm5lbC5yZW1vdGVBZGRyZXNzLnBvcnQpLCB7XG5cdFx0XHRcdFx0cmVtb3RlSG9zdDogdHVubmVsLnJlbW90ZUFkZHJlc3MuaG9zdCxcblx0XHRcdFx0XHRyZW1vdGVQb3J0OiB0dW5uZWwucmVtb3RlQWRkcmVzcy5wb3J0LFxuXHRcdFx0XHRcdGxvY2FsQWRkcmVzczogbG9jYWxBZGRyZXNzLFxuXHRcdFx0XHRcdHByb3RvY29sOiBUdW5uZWxQcm90b2NvbC5IdHRwLFxuXHRcdFx0XHRcdGxvY2FsVXJpOiB0aGlzLm1ha2VMb2NhbFVyaShsb2NhbEFkZHJlc3MpLFxuXHRcdFx0XHRcdGNsb3NlYWJsZTogZmFsc2UsXG5cdFx0XHRcdFx0cnVubmluZ1Byb2Nlc3M6IG1hdGNoaW5nQ2FuZGlkYXRlPy5kZXRhaWwsXG5cdFx0XHRcdFx0aGFzUnVubmluZ1Byb2Nlc3M6ICEhbWF0Y2hpbmdDYW5kaWRhdGUsXG5cdFx0XHRcdFx0cGlkOiBtYXRjaGluZ0NhbmRpZGF0ZT8ucGlkLFxuXHRcdFx0XHRcdHByaXZhY3k6IFR1bm5lbFByaXZhY3lJZC5Db25zdGFudFByaXZhdGUsXG5cdFx0XHRcdFx0c291cmNlOiB7XG5cdFx0XHRcdFx0XHRzb3VyY2U6IFR1bm5lbFNvdXJjZS5FeHRlbnNpb24sXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd0dW5uZWwuc3RhdGljYWxseUZvcndhcmRlZCcsIFwiU3RhdGljYWxseSBGb3J3YXJkZWRcIilcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aGlzLnR1bm5lbFNlcnZpY2Uuc2V0RW52aXJvbm1lbnRUdW5uZWwodHVubmVsLnJlbW90ZUFkZHJlc3MuaG9zdCwgdHVubmVsLnJlbW90ZUFkZHJlc3MucG9ydCwgbG9jYWxBZGRyZXNzLCBUdW5uZWxQcml2YWN5SWQuQ29uc3RhbnRQcml2YXRlLCBUdW5uZWxQcm90b2NvbC5IdHRwKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fZW52aXJvbm1lbnRUdW5uZWxzU2V0ID0gdHJ1ZTtcblx0XHR0aGlzLl9vbkVudmlyb25tZW50VHVubmVsc1NldC5maXJlKCk7XG5cdFx0dGhpcy5fb25Gb3J3YXJkUG9ydC5maXJlKCk7XG5cdH1cblxuXHRzZXRDYW5kaWRhdGVGaWx0ZXIoZmlsdGVyOiAoKGNhbmRpZGF0ZXM6IENhbmRpZGF0ZVBvcnRbXSkgPT4gUHJvbWlzZTxDYW5kaWRhdGVQb3J0W10+KSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuX2NhbmRpZGF0ZUZpbHRlciA9IGZpbHRlcjtcblx0fVxuXG5cdGFzeW5jIHNldENhbmRpZGF0ZXMoY2FuZGlkYXRlczogQ2FuZGlkYXRlUG9ydFtdKSB7XG5cdFx0bGV0IHByb2Nlc3NlZENhbmRpZGF0ZXMgPSBjYW5kaWRhdGVzO1xuXHRcdGlmICh0aGlzLl9jYW5kaWRhdGVGaWx0ZXIpIHtcblx0XHRcdC8vIFdoZW4gYW4gZXh0ZW5zaW9uIHByb3ZpZGVzIGEgZmlsdGVyLCB3ZSBkbyB0aGUgZmlsdGVyaW5nIG9uIHRoZSBleHRlbnNpb24gaG9zdCBiZWZvcmUgdGhlIGNhbmRpZGF0ZXMgYXJlIHNldCBoZXJlLlxuXHRcdFx0Ly8gSG93ZXZlciwgd2hlbiB0aGUgZmlsdGVyIGRvZXNuJ3QgY29tZSBmcm9tIGFuIGV4dGVuc2lvbiB3ZSBmaWx0ZXIgaGVyZS5cblx0XHRcdHByb2Nlc3NlZENhbmRpZGF0ZXMgPSBhd2FpdCB0aGlzLl9jYW5kaWRhdGVGaWx0ZXIoY2FuZGlkYXRlcyk7XG5cdFx0fVxuXHRcdGNvbnN0IHJlbW92ZWRDYW5kaWRhdGVzID0gdGhpcy51cGRhdGVJblJlc3BvbnNlVG9DYW5kaWRhdGVzKHByb2Nlc3NlZENhbmRpZGF0ZXMpO1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgRm9yd2FyZGVkUG9ydHM6IChUdW5uZWxNb2RlbCkgcmVtb3ZlZCBjYW5kaWRhdGVzICR7QXJyYXkuZnJvbShyZW1vdmVkQ2FuZGlkYXRlcy52YWx1ZXMoKSkubWFwKGNhbmRpZGF0ZSA9PiBjYW5kaWRhdGUucG9ydCkuam9pbignLCAnKX1gKTtcblx0XHR0aGlzLl9vbkNhbmRpZGF0ZXNDaGFuZ2VkLmZpcmUocmVtb3ZlZENhbmRpZGF0ZXMpO1xuXHR9XG5cblx0Ly8gUmV0dXJucyByZW1vdmVkIGNhbmRpZGF0ZXNcblx0cHJpdmF0ZSB1cGRhdGVJblJlc3BvbnNlVG9DYW5kaWRhdGVzKGNhbmRpZGF0ZXM6IENhbmRpZGF0ZVBvcnRbXSk6IE1hcDxzdHJpbmcsIHsgaG9zdDogc3RyaW5nOyBwb3J0OiBudW1iZXIgfT4ge1xuXHRcdGNvbnN0IHJlbW92ZWRDYW5kaWRhdGVzID0gdGhpcy5fY2FuZGlkYXRlcyA/PyBuZXcgTWFwKCk7XG5cdFx0Y29uc3QgY2FuZGlkYXRlc01hcCA9IG5ldyBNYXAoKTtcblx0XHR0aGlzLl9jYW5kaWRhdGVzID0gY2FuZGlkYXRlc01hcDtcblx0XHRjYW5kaWRhdGVzLmZvckVhY2godmFsdWUgPT4ge1xuXHRcdFx0Y29uc3QgYWRkcmVzc0tleSA9IG1ha2VBZGRyZXNzKHZhbHVlLmhvc3QsIHZhbHVlLnBvcnQpO1xuXHRcdFx0Y2FuZGlkYXRlc01hcC5zZXQoYWRkcmVzc0tleSwge1xuXHRcdFx0XHRob3N0OiB2YWx1ZS5ob3N0LFxuXHRcdFx0XHRwb3J0OiB2YWx1ZS5wb3J0LFxuXHRcdFx0XHRkZXRhaWw6IHZhbHVlLmRldGFpbCxcblx0XHRcdFx0cGlkOiB2YWx1ZS5waWRcblx0XHRcdH0pO1xuXHRcdFx0aWYgKHJlbW92ZWRDYW5kaWRhdGVzLmhhcyhhZGRyZXNzS2V5KSkge1xuXHRcdFx0XHRyZW1vdmVkQ2FuZGlkYXRlcy5kZWxldGUoYWRkcmVzc0tleSk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBmb3J3YXJkZWRWYWx1ZSA9IG1hcEhhc0FkZHJlc3NMb2NhbGhvc3RPckFsbEludGVyZmFjZXModGhpcy5mb3J3YXJkZWQsIHZhbHVlLmhvc3QsIHZhbHVlLnBvcnQpO1xuXHRcdFx0aWYgKGZvcndhcmRlZFZhbHVlKSB7XG5cdFx0XHRcdGZvcndhcmRlZFZhbHVlLnJ1bm5pbmdQcm9jZXNzID0gdmFsdWUuZGV0YWlsO1xuXHRcdFx0XHRmb3J3YXJkZWRWYWx1ZS5oYXNSdW5uaW5nUHJvY2VzcyA9IHRydWU7XG5cdFx0XHRcdGZvcndhcmRlZFZhbHVlLnBpZCA9IHZhbHVlLnBpZDtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRyZW1vdmVkQ2FuZGlkYXRlcy5mb3JFYWNoKChfdmFsdWUsIGtleSkgPT4ge1xuXHRcdFx0Y29uc3QgcGFyc2VkQWRkcmVzcyA9IHBhcnNlQWRkcmVzcyhrZXkpO1xuXHRcdFx0aWYgKCFwYXJzZWRBZGRyZXNzKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGZvcndhcmRlZFZhbHVlID0gbWFwSGFzQWRkcmVzc0xvY2FsaG9zdE9yQWxsSW50ZXJmYWNlcyh0aGlzLmZvcndhcmRlZCwgcGFyc2VkQWRkcmVzcy5ob3N0LCBwYXJzZWRBZGRyZXNzLnBvcnQpO1xuXHRcdFx0aWYgKGZvcndhcmRlZFZhbHVlKSB7XG5cdFx0XHRcdGZvcndhcmRlZFZhbHVlLnJ1bm5pbmdQcm9jZXNzID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRmb3J3YXJkZWRWYWx1ZS5oYXNSdW5uaW5nUHJvY2VzcyA9IGZhbHNlO1xuXHRcdFx0XHRmb3J3YXJkZWRWYWx1ZS5waWQgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBkZXRlY3RlZFZhbHVlID0gbWFwSGFzQWRkcmVzc0xvY2FsaG9zdE9yQWxsSW50ZXJmYWNlcyh0aGlzLmRldGVjdGVkLCBwYXJzZWRBZGRyZXNzLmhvc3QsIHBhcnNlZEFkZHJlc3MucG9ydCk7XG5cdFx0XHRpZiAoZGV0ZWN0ZWRWYWx1ZSkge1xuXHRcdFx0XHRkZXRlY3RlZFZhbHVlLnJ1bm5pbmdQcm9jZXNzID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRkZXRlY3RlZFZhbHVlLmhhc1J1bm5pbmdQcm9jZXNzID0gZmFsc2U7XG5cdFx0XHRcdGRldGVjdGVkVmFsdWUucGlkID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHJldHVybiByZW1vdmVkQ2FuZGlkYXRlcztcblx0fVxuXG5cdGdldCBjYW5kaWRhdGVzKCk6IENhbmRpZGF0ZVBvcnRbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX2NhbmRpZGF0ZXMgPyBBcnJheS5mcm9tKHRoaXMuX2NhbmRpZGF0ZXMudmFsdWVzKCkpIDogW107XG5cdH1cblxuXHRnZXQgY2FuZGlkYXRlc09yVW5kZWZpbmVkKCk6IENhbmRpZGF0ZVBvcnRbXSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2NhbmRpZGF0ZXMgPyB0aGlzLmNhbmRpZGF0ZXMgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZUF0dHJpYnV0ZXMoKSB7XG5cdFx0Ly8gSWYgdGhlIGxhYmVsIGNoYW5nZXMgaW4gdGhlIGF0dHJpYnV0ZXMsIHdlIHNob3VsZCB1cGRhdGUgaXQuXG5cdFx0Y29uc3QgdHVubmVscyA9IEFycmF5LmZyb20odGhpcy5mb3J3YXJkZWQudmFsdWVzKCkpO1xuXHRcdGNvbnN0IGFsbEF0dHJpYnV0ZXMgPSBhd2FpdCB0aGlzLmdldEF0dHJpYnV0ZXModHVubmVscy5tYXAodHVubmVsID0+IHtcblx0XHRcdHJldHVybiB7IHBvcnQ6IHR1bm5lbC5yZW1vdGVQb3J0LCBob3N0OiB0dW5uZWwucmVtb3RlSG9zdCB9O1xuXHRcdH0pLCBmYWxzZSk7XG5cdFx0aWYgKCFhbGxBdHRyaWJ1dGVzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGZvciAoY29uc3QgZm9yd2FyZGVkIG9mIHR1bm5lbHMpIHtcblx0XHRcdGNvbnN0IGF0dHJpYnV0ZXMgPSBhbGxBdHRyaWJ1dGVzLmdldChmb3J3YXJkZWQucmVtb3RlUG9ydCk7XG5cdFx0XHRpZiAoKGF0dHJpYnV0ZXM/LnByb3RvY29sIHx8IChmb3J3YXJkZWQucHJvdG9jb2wgIT09IFR1bm5lbFByb3RvY29sLkh0dHApKSAmJiAoYXR0cmlidXRlcz8ucHJvdG9jb2wgIT09IGZvcndhcmRlZC5wcm90b2NvbCkpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5kb0ZvcndhcmQoe1xuXHRcdFx0XHRcdHJlbW90ZTogeyBob3N0OiBmb3J3YXJkZWQucmVtb3RlSG9zdCwgcG9ydDogZm9yd2FyZGVkLnJlbW90ZVBvcnQgfSxcblx0XHRcdFx0XHRsb2NhbDogZm9yd2FyZGVkLmxvY2FsUG9ydCxcblx0XHRcdFx0XHRuYW1lOiBmb3J3YXJkZWQubmFtZSxcblx0XHRcdFx0XHRzb3VyY2U6IGZvcndhcmRlZC5zb3VyY2Vcblx0XHRcdFx0fSwgYXR0cmlidXRlcyk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghYXR0cmlidXRlcykge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGlmIChhdHRyaWJ1dGVzLmxhYmVsICYmIGF0dHJpYnV0ZXMubGFiZWwgIT09IGZvcndhcmRlZC5uYW1lKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMubmFtZShmb3J3YXJkZWQucmVtb3RlSG9zdCwgZm9yd2FyZGVkLnJlbW90ZVBvcnQsIGF0dHJpYnV0ZXMubGFiZWwpO1xuXHRcdFx0fVxuXG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZ2V0QXR0cmlidXRlcyhmb3J3YXJkZWRQb3J0czogeyBob3N0OiBzdHJpbmc7IHBvcnQ6IG51bWJlciB9W10sIGNoZWNrUHJvdmlkZXJzOiBib29sZWFuID0gdHJ1ZSk6IFByb21pc2U8TWFwPG51bWJlciwgQXR0cmlidXRlcz4gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBtYXRjaGluZ0NhbmRpZGF0ZXM6IE1hcDxudW1iZXIsIENhbmRpZGF0ZVBvcnQ+ID0gbmV3IE1hcCgpO1xuXHRcdGNvbnN0IHBpZFRvUG9ydHNNYXBwaW5nOiBNYXA8bnVtYmVyIHwgdW5kZWZpbmVkLCBudW1iZXJbXT4gPSBuZXcgTWFwKCk7XG5cdFx0Zm9yd2FyZGVkUG9ydHMuZm9yRWFjaChmb3J3YXJkZWRQb3J0ID0+IHtcblx0XHRcdGNvbnN0IG1hdGNoaW5nQ2FuZGlkYXRlID0gbWFwSGFzQWRkcmVzc0xvY2FsaG9zdE9yQWxsSW50ZXJmYWNlczxDYW5kaWRhdGVQb3J0Pih0aGlzLl9jYW5kaWRhdGVzID8/IG5ldyBNYXAoKSwgTE9DQUxIT1NUX0FERFJFU1NFU1swXSwgZm9yd2FyZGVkUG9ydC5wb3J0KSA/PyBmb3J3YXJkZWRQb3J0O1xuXHRcdFx0aWYgKG1hdGNoaW5nQ2FuZGlkYXRlKSB7XG5cdFx0XHRcdG1hdGNoaW5nQ2FuZGlkYXRlcy5zZXQoZm9yd2FyZGVkUG9ydC5wb3J0LCBtYXRjaGluZ0NhbmRpZGF0ZSk7XG5cdFx0XHRcdGNvbnN0IHBpZCA9IGlzQ2FuZGlkYXRlUG9ydChtYXRjaGluZ0NhbmRpZGF0ZSkgPyBtYXRjaGluZ0NhbmRpZGF0ZS5waWQgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmICghcGlkVG9Qb3J0c01hcHBpbmcuaGFzKHBpZCkpIHtcblx0XHRcdFx0XHRwaWRUb1BvcnRzTWFwcGluZy5zZXQocGlkLCBbXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cGlkVG9Qb3J0c01hcHBpbmcuZ2V0KHBpZCk/LnB1c2goZm9yd2FyZGVkUG9ydC5wb3J0KTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IGNvbmZpZ0F0dHJpYnV0ZXM6IE1hcDxudW1iZXIsIEF0dHJpYnV0ZXM+ID0gbmV3IE1hcCgpO1xuXHRcdGZvcndhcmRlZFBvcnRzLmZvckVhY2goZm9yd2FyZGVkUG9ydCA9PiB7XG5cdFx0XHRjb25zdCBhdHRyaWJ1dGVzID0gdGhpcy5jb25maWdQb3J0c0F0dHJpYnV0ZXMuZ2V0QXR0cmlidXRlcyhmb3J3YXJkZWRQb3J0LnBvcnQsIGZvcndhcmRlZFBvcnQuaG9zdCwgbWF0Y2hpbmdDYW5kaWRhdGVzLmdldChmb3J3YXJkZWRQb3J0LnBvcnQpPy5kZXRhaWwpO1xuXHRcdFx0aWYgKGF0dHJpYnV0ZXMpIHtcblx0XHRcdFx0Y29uZmlnQXR0cmlidXRlcy5zZXQoZm9yd2FyZGVkUG9ydC5wb3J0LCBhdHRyaWJ1dGVzKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRpZiAoKHRoaXMucG9ydEF0dHJpYnV0ZXNQcm92aWRlcnMubGVuZ3RoID09PSAwKSB8fCAhY2hlY2tQcm92aWRlcnMpIHtcblx0XHRcdHJldHVybiAoY29uZmlnQXR0cmlidXRlcy5zaXplID4gMCkgPyBjb25maWdBdHRyaWJ1dGVzIDogdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIEdyb3VwIGNhbGxzIHRvIHByb3ZpZGUgYXR0cmlidXRlcyBieSBwaWQuXG5cdFx0Y29uc3QgYWxsUHJvdmlkZXJSZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwodGhpcy5wb3J0QXR0cmlidXRlc1Byb3ZpZGVycy5mbGF0TWFwKHByb3ZpZGVyID0+IHtcblx0XHRcdHJldHVybiBBcnJheS5mcm9tKHBpZFRvUG9ydHNNYXBwaW5nLmVudHJpZXMoKSkubWFwKGVudHJ5ID0+IHtcblx0XHRcdFx0Y29uc3QgcG9ydEdyb3VwID0gZW50cnlbMV07XG5cdFx0XHRcdGNvbnN0IG1hdGNoaW5nQ2FuZGlkYXRlID0gbWF0Y2hpbmdDYW5kaWRhdGVzLmdldChwb3J0R3JvdXBbMF0pO1xuXHRcdFx0XHRyZXR1cm4gcHJvdmlkZXIucHJvdmlkZVBvcnRBdHRyaWJ1dGVzKHBvcnRHcm91cCxcblx0XHRcdFx0XHRtYXRjaGluZ0NhbmRpZGF0ZT8ucGlkLCBtYXRjaGluZ0NhbmRpZGF0ZT8uZGV0YWlsLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdH0pO1xuXHRcdH0pKTtcblx0XHRjb25zdCBwcm92aWRlZEF0dHJpYnV0ZXM6IE1hcDxudW1iZXIsIFByb3ZpZGVkUG9ydEF0dHJpYnV0ZXM+ID0gbmV3IE1hcCgpO1xuXHRcdGFsbFByb3ZpZGVyUmVzdWx0cy5mb3JFYWNoKGF0dHJpYnV0ZXMgPT4gYXR0cmlidXRlcy5mb3JFYWNoKGF0dHJpYnV0ZSA9PiB7XG5cdFx0XHRpZiAoYXR0cmlidXRlKSB7XG5cdFx0XHRcdHByb3ZpZGVkQXR0cmlidXRlcy5zZXQoYXR0cmlidXRlLnBvcnQsIGF0dHJpYnV0ZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0aWYgKCFjb25maWdBdHRyaWJ1dGVzICYmICFwcm92aWRlZEF0dHJpYnV0ZXMpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Ly8gTWVyZ2UuIFRoZSBjb25maWcgd2lucy5cblx0XHRjb25zdCBtZXJnZWRBdHRyaWJ1dGVzOiBNYXA8bnVtYmVyLCBBdHRyaWJ1dGVzPiA9IG5ldyBNYXAoKTtcblx0XHRmb3J3YXJkZWRQb3J0cy5mb3JFYWNoKGZvcndhcmRlZFBvcnRzID0+IHtcblx0XHRcdGNvbnN0IGNvbmZpZyA9IGNvbmZpZ0F0dHJpYnV0ZXMuZ2V0KGZvcndhcmRlZFBvcnRzLnBvcnQpO1xuXHRcdFx0Y29uc3QgcHJvdmlkZXIgPSBwcm92aWRlZEF0dHJpYnV0ZXMuZ2V0KGZvcndhcmRlZFBvcnRzLnBvcnQpO1xuXHRcdFx0bWVyZ2VkQXR0cmlidXRlcy5zZXQoZm9yd2FyZGVkUG9ydHMucG9ydCwge1xuXHRcdFx0XHRlbGV2YXRlSWZOZWVkZWQ6IGNvbmZpZz8uZWxldmF0ZUlmTmVlZGVkLFxuXHRcdFx0XHRsYWJlbDogY29uZmlnPy5sYWJlbCxcblx0XHRcdFx0b25BdXRvRm9yd2FyZDogY29uZmlnPy5vbkF1dG9Gb3J3YXJkID8/IFBvcnRzQXR0cmlidXRlcy5wcm92aWRlZEFjdGlvblRvQWN0aW9uKHByb3ZpZGVyPy5hdXRvRm9yd2FyZEFjdGlvbiksXG5cdFx0XHRcdHJlcXVpcmVMb2NhbFBvcnQ6IGNvbmZpZz8ucmVxdWlyZUxvY2FsUG9ydCxcblx0XHRcdFx0cHJvdG9jb2w6IGNvbmZpZz8ucHJvdG9jb2xcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIG1lcmdlZEF0dHJpYnV0ZXM7XG5cdH1cblxuXHRhZGRBdHRyaWJ1dGVzUHJvdmlkZXIocHJvdmlkZXI6IFBvcnRBdHRyaWJ1dGVzUHJvdmlkZXIpIHtcblx0XHR0aGlzLnBvcnRBdHRyaWJ1dGVzUHJvdmlkZXJzLnB1c2gocHJvdmlkZXIpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLFlBQVk7QUFDckIsU0FBUyxZQUFZLHVCQUF1QjtBQUM1QyxTQUFTLFdBQVc7QUFDcEIsU0FBOEIsNkJBQTZCO0FBQzNELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsbUJBQW1CO0FBRTVCLFNBQVMsdUNBQTBEO0FBQ25FLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdE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YTtBQUN4RSxVQUFJLFdBQVc7QUFDZCwyQkFBbUIsSUFBSSxVQUFVLE1BQU0sU0FBUztBQUFBLE1BQ2pEO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixRQUFJLENBQUMsb0JBQW9CLENBQUMsb0JBQW9CO0FBQzdDLGFBQU87QUFBQSxJQUNSO0FBR0EsVUFBTSxtQkFBNEMsb0JBQUksSUFBSTtBQUMxRCxtQkFBZSxRQUFRLENBQUFDLG9CQUFrQjtBQUN4QyxZQUFNLFNBQVMsaUJBQWlCLElBQUlBLGdCQUFlLElBQUk7QUFDdkQsWUFBTSxXQUFXLG1CQUFtQixJQUFJQSxnQkFBZSxJQUFJO0FBQzNELHVCQUFpQixJQUFJQSxnQkFBZSxNQUFNO0FBQUEsUUFDekMsaUJBQWlCLFFBQVE7QUFBQSxRQUN6QixPQUFPLFFBQVE7QUFBQSxRQUNmLGVBQWUsUUFBUSxpQkFBaUIsZ0JBQWdCLHVCQUF1QixVQUFVLGlCQUFpQjtBQUFBLFFBQzFHLGtCQUFrQixRQUFRO0FBQUEsUUFDMUIsVUFBVSxRQUFRO0FBQUEsTUFDbkIsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUVELFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxzQkFBc0IsVUFBa0M7QUFDdkQsU0FBSyx3QkFBd0IsS0FBSyxRQUFRO0FBQUEsRUFDM0M7QUFDRDtBQTlZZTtBQUFBLEVBRGIsU0FBUyxHQUFJO0FBQUEsR0F0UEYsWUF1UEU7QUF2UEYsY0FBTjtBQUFBLEVBK0JKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0F4Q1U7IiwKICAibmFtZXMiOiBbIlR1bm5lbENsb3NlUmVhc29uIiwgIlR1bm5lbFNvdXJjZSIsICJPblBvcnRGb3J3YXJkIiwgIk1lcmdlZEF0dHJpYnV0ZUFjdGlvbiIsICJmb3J3YXJkZWRQb3J0cyJdCn0K
