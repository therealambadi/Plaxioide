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
import { Emitter } from "../../../../base/common/event.js";
import { isMacintosh, isWindows } from "../../../../base/common/platform.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ILocalPtyService, ITerminalLogService, TerminalExtensions, TerminalIpcChannels, TerminalSettingId } from "../../../../platform/terminal/common/terminal.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { ITerminalInstanceService } from "../browser/terminal.js";
import { ITerminalProfileResolverService } from "../common/terminal.js";
import { TerminalStorageKeys } from "../common/terminalStorageKeys.js";
import { LocalPty } from "./localPty.js";
import { IConfigurationResolverService } from "../../../services/configurationResolver/common/configurationResolver.js";
import { IShellEnvironmentService } from "../../../services/environment/electron-sandbox/shellEnvironmentService.js";
import { IHistoryService } from "../../../services/history/common/history.js";
import * as terminalEnvironment from "../common/terminalEnvironment.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IEnvironmentVariableService } from "../common/environmentVariable.js";
import { BaseTerminalBackend } from "../browser/baseTerminalBackend.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { Client as MessagePortClient } from "../../../../base/parts/ipc/common/ipc.mp.js";
import { acquirePort } from "../../../../base/parts/ipc/electron-sandbox/ipc.mp.js";
import { getDelayedChannel, ProxyChannel } from "../../../../base/parts/ipc/common/ipc.js";
import { mark } from "../../../../base/common/performance.js";
import { ILifecycleService, LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { DeferredPromise } from "../../../../base/common/async.js";
import { IStatusbarService } from "../../../services/statusbar/browser/statusbar.js";
import { memoize } from "../../../../base/common/decorators.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { shouldUseEnvironmentVariableCollection } from "../../../../platform/terminal/common/terminalEnvironment.js";
import { DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
let LocalTerminalBackendContribution = class {
  constructor(instantiationService, terminalInstanceService) {
    const backend = instantiationService.createInstance(LocalTerminalBackend);
    Registry.as(TerminalExtensions.Backend).registerTerminalBackend(backend);
    terminalInstanceService.didRegisterBackend(backend);
  }
};
LocalTerminalBackendContribution.ID = "workbench.contrib.localTerminalBackend";
LocalTerminalBackendContribution = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ITerminalInstanceService)
], LocalTerminalBackendContribution);
let LocalTerminalBackend = class extends BaseTerminalBackend {
  constructor(workspaceContextService, _lifecycleService, logService, _localPtyService, _labelService, _shellEnvironmentService, _storageService, _configurationResolverService, _configurationService, _productService, _historyService, _terminalProfileResolverService, _environmentVariableService, historyService, _nativeHostService, statusBarService, _remoteAgentService) {
    super(_localPtyService, logService, historyService, _configurationResolverService, statusBarService, workspaceContextService);
    this._lifecycleService = _lifecycleService;
    this._localPtyService = _localPtyService;
    this._labelService = _labelService;
    this._shellEnvironmentService = _shellEnvironmentService;
    this._storageService = _storageService;
    this._configurationResolverService = _configurationResolverService;
    this._configurationService = _configurationService;
    this._productService = _productService;
    this._historyService = _historyService;
    this._terminalProfileResolverService = _terminalProfileResolverService;
    this._environmentVariableService = _environmentVariableService;
    this._nativeHostService = _nativeHostService;
    this._remoteAgentService = _remoteAgentService;
    this.remoteAuthority = void 0;
    this._ptys = /* @__PURE__ */ new Map();
    this._directProxyDisposables = this._register(new MutableDisposable());
    this._whenReady = new DeferredPromise();
    this._onDidRequestDetach = this._register(new Emitter());
    this.onDidRequestDetach = this._onDidRequestDetach.event;
    this._register(this.onPtyHostRestart(() => {
      this._directProxy = void 0;
      this._directProxyClientEventually = void 0;
      this._connectToDirectProxy();
    }));
  }
  /**
   * Communicate to the direct proxy (renderer<->ptyhost) if it's available, otherwise use the
   * indirect proxy (renderer<->main<->ptyhost). The latter may not need to actually launch the
   * pty host, for example when detecting profiles.
   */
  get _proxy() {
    return this._directProxy || this._localPtyService;
  }
  get whenReady() {
    return this._whenReady.p;
  }
  setReady() {
    this._whenReady.complete();
  }
  /**
   * Request a direct connection to the pty host, this will launch the pty host process if necessary.
   */
  async _connectToDirectProxy() {
    if (this._directProxyClientEventually) {
      await this._directProxyClientEventually.p;
      return;
    }
    this._logService.debug("Starting pty host");
    const directProxyClientEventually = new DeferredPromise();
    this._directProxyClientEventually = directProxyClientEventually;
    const directProxy = ProxyChannel.toService(getDelayedChannel(this._directProxyClientEventually.p.then((client) => client.getChannel(TerminalIpcChannels.PtyHostWindow))));
    this._directProxy = directProxy;
    this._directProxyDisposables.clear();
    if (!this._remoteAgentService.getConnection()?.remoteAuthority) {
      await this._lifecycleService.when(LifecyclePhase.Restored);
    }
    mark("code/terminal/willConnectPtyHost");
    this._logService.trace("Renderer->PtyHost#connect: before acquirePort");
    acquirePort("vscode:createPtyHostMessageChannel", "vscode:createPtyHostMessageChannelResult").then((port) => {
      mark("code/terminal/didConnectPtyHost");
      this._logService.trace("Renderer->PtyHost#connect: connection established");
      const store = new DisposableStore();
      this._directProxyDisposables.value = store;
      const client = store.add(new MessagePortClient(port, `window:${this._nativeHostService.windowId}`));
      directProxyClientEventually.complete(client);
      this._onPtyHostConnected.fire();
      store.add(directProxy.onProcessData((e) => this._ptys.get(e.id)?.handleData(e.event)));
      store.add(directProxy.onDidChangeProperty((e) => this._ptys.get(e.id)?.handleDidChangeProperty(e.property)));
      store.add(directProxy.onProcessExit((e) => {
        const pty = this._ptys.get(e.id);
        if (pty) {
          pty.handleExit(e.event);
          this._ptys.delete(e.id);
        }
      }));
      store.add(directProxy.onProcessReady((e) => this._ptys.get(e.id)?.handleReady(e.event)));
      store.add(directProxy.onProcessReplay((e) => this._ptys.get(e.id)?.handleReplay(e.event)));
      store.add(directProxy.onProcessOrphanQuestion((e) => this._ptys.get(e.id)?.handleOrphanQuestion()));
      store.add(directProxy.onDidRequestDetach((e) => this._onDidRequestDetach.fire(e)));
      this.getEnvironment();
    });
  }
  async requestDetachInstance(workspaceId, instanceId) {
    return this._proxy.requestDetachInstance(workspaceId, instanceId);
  }
  async acceptDetachInstanceReply(requestId, persistentProcessId) {
    if (!persistentProcessId) {
      this._logService.warn("Cannot attach to feature terminals, custom pty terminals, or those without a persistentProcessId");
      return;
    }
    return this._proxy.acceptDetachInstanceReply(requestId, persistentProcessId);
  }
  async persistTerminalState() {
    const ids = Array.from(this._ptys.keys());
    const serialized = await this._proxy.serializeTerminalState(ids);
    this._storageService.store(TerminalStorageKeys.TerminalBufferState, serialized, StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  async updateTitle(id, title, titleSource) {
    await this._proxy.updateTitle(id, title, titleSource);
  }
  async updateIcon(id, userInitiated, icon, color) {
    await this._proxy.updateIcon(id, userInitiated, icon, color);
  }
  async updateProperty(id, property, value) {
    return this._proxy.updateProperty(id, property, value);
  }
  async createProcess(shellLaunchConfig, cwd, cols, rows, unicodeVersion, env, options, shouldPersist) {
    await this._connectToDirectProxy();
    const executableEnv = await this._shellEnvironmentService.getShellEnv();
    const id = await this._proxy.createProcess(shellLaunchConfig, cwd, cols, rows, unicodeVersion, env, executableEnv, options, shouldPersist, this._getWorkspaceId(), this._getWorkspaceName());
    const pty = new LocalPty(id, shouldPersist, this._proxy);
    this._ptys.set(id, pty);
    return pty;
  }
  async attachToProcess(id) {
    await this._connectToDirectProxy();
    try {
      await this._proxy.attachToProcess(id);
      const pty = new LocalPty(id, true, this._proxy);
      this._ptys.set(id, pty);
      return pty;
    } catch (e) {
      this._logService.warn(`Couldn't attach to process ${e.message}`);
    }
    return void 0;
  }
  async attachToRevivedProcess(id) {
    await this._connectToDirectProxy();
    try {
      const newId = await this._proxy.getRevivedPtyNewId(this._getWorkspaceId(), id) ?? id;
      return await this.attachToProcess(newId);
    } catch (e) {
      this._logService.warn(`Couldn't attach to process ${e.message}`);
    }
    return void 0;
  }
  async listProcesses() {
    await this._connectToDirectProxy();
    return this._proxy.listProcesses();
  }
  async getLatency() {
    const measurements = [];
    const sw = new StopWatch();
    if (this._directProxy) {
      await this._directProxy.getLatency();
      sw.stop();
      measurements.push({
        label: "window<->ptyhost (message port)",
        latency: sw.elapsed()
      });
      sw.reset();
    }
    const results = await this._localPtyService.getLatency();
    sw.stop();
    measurements.push({
      label: "window<->ptyhostservice<->ptyhost",
      latency: sw.elapsed()
    });
    return [
      ...measurements,
      ...results
    ];
  }
  async getPerformanceMarks() {
    return this._proxy.getPerformanceMarks();
  }
  async reduceConnectionGraceTime() {
    this._proxy.reduceConnectionGraceTime();
  }
  async getDefaultSystemShell(osOverride) {
    return this._proxy.getDefaultSystemShell(osOverride);
  }
  async getProfiles(profiles, defaultProfile, includeDetectedProfiles) {
    return this._localPtyService.getProfiles(this._workspaceContextService.getWorkspace().id, profiles, defaultProfile, includeDetectedProfiles) || [];
  }
  async getEnvironment() {
    return this._proxy.getEnvironment();
  }
  async getShellEnvironment() {
    return this._shellEnvironmentService.getShellEnv();
  }
  async getWslPath(original, direction) {
    return this._proxy.getWslPath(original, direction);
  }
  async setTerminalLayoutInfo(layoutInfo) {
    const args = {
      workspaceId: this._getWorkspaceId(),
      tabs: layoutInfo ? layoutInfo.tabs : []
    };
    await this._proxy.setTerminalLayoutInfo(args);
    this._storageService.store(TerminalStorageKeys.TerminalLayoutInfo, JSON.stringify(args), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  async getTerminalLayoutInfo() {
    const workspaceId = this._getWorkspaceId();
    const layoutArgs = { workspaceId };
    const serializedState = this._storageService.get(TerminalStorageKeys.TerminalBufferState, StorageScope.WORKSPACE);
    const reviveBufferState = this._deserializeTerminalState(serializedState);
    if (reviveBufferState && reviveBufferState.length > 0) {
      try {
        const activeWorkspaceRootUri = this._historyService.getLastActiveWorkspaceRoot();
        const lastActiveWorkspace = activeWorkspaceRootUri ? this._workspaceContextService.getWorkspaceFolder(activeWorkspaceRootUri) ?? void 0 : void 0;
        const variableResolver = terminalEnvironment.createVariableResolver(lastActiveWorkspace, await this._terminalProfileResolverService.getEnvironment(this.remoteAuthority), this._configurationResolverService);
        mark("code/terminal/willGetReviveEnvironments");
        await Promise.all(reviveBufferState.map((state) => new Promise((r) => {
          this._resolveEnvironmentForRevive(variableResolver, state.shellLaunchConfig).then((freshEnv) => {
            state.processLaunchConfig.env = freshEnv;
            r();
          });
        })));
        mark("code/terminal/didGetReviveEnvironments");
        mark("code/terminal/willReviveTerminalProcesses");
        await this._proxy.reviveTerminalProcesses(workspaceId, reviveBufferState, Intl.DateTimeFormat().resolvedOptions().locale);
        mark("code/terminal/didReviveTerminalProcesses");
        this._storageService.remove(TerminalStorageKeys.TerminalBufferState, StorageScope.WORKSPACE);
        const layoutInfo = this._storageService.get(TerminalStorageKeys.TerminalLayoutInfo, StorageScope.WORKSPACE);
        if (layoutInfo) {
          mark("code/terminal/willSetTerminalLayoutInfo");
          await this._proxy.setTerminalLayoutInfo(JSON.parse(layoutInfo));
          mark("code/terminal/didSetTerminalLayoutInfo");
          this._storageService.remove(TerminalStorageKeys.TerminalLayoutInfo, StorageScope.WORKSPACE);
        }
      } catch (e) {
        this._logService.warn("LocalTerminalBackend#getTerminalLayoutInfo Error", e && typeof e === "object" && "message" in e ? e.message : e);
      }
    }
    return this._proxy.getTerminalLayoutInfo(layoutArgs);
  }
  async _resolveEnvironmentForRevive(variableResolver, shellLaunchConfig) {
    const platformKey = isWindows ? "windows" : isMacintosh ? "osx" : "linux";
    const envFromConfigValue = this._configurationService.getValue(`terminal.integrated.env.${platformKey}`);
    const baseEnv = await (shellLaunchConfig.useShellEnvironment ? this.getShellEnvironment() : this.getEnvironment());
    const env = await terminalEnvironment.createTerminalEnvironment(shellLaunchConfig, envFromConfigValue, variableResolver, this._productService.version, this._configurationService.getValue(TerminalSettingId.DetectLocale), baseEnv);
    if (shouldUseEnvironmentVariableCollection(shellLaunchConfig)) {
      const workspaceFolder = terminalEnvironment.getWorkspaceForTerminal(shellLaunchConfig.cwd, this._workspaceContextService, this._historyService);
      await this._environmentVariableService.mergedCollection.applyToProcessEnvironment(env, { workspaceFolder }, variableResolver);
    }
    return env;
  }
  _getWorkspaceName() {
    return this._labelService.getWorkspaceLabel(this._workspaceContextService.getWorkspace());
  }
  // #region Pty service contribution RPC calls
  installAutoReply(match, reply) {
    return this._proxy.installAutoReply(match, reply);
  }
  uninstallAllAutoReplies() {
    return this._proxy.uninstallAllAutoReplies();
  }
  // #endregion
};
__decorateClass([
  memoize
], LocalTerminalBackend.prototype, "getEnvironment", 1);
__decorateClass([
  memoize
], LocalTerminalBackend.prototype, "getShellEnvironment", 1);
LocalTerminalBackend = __decorateClass([
  __decorateParam(0, IWorkspaceContextService),
  __decorateParam(1, ILifecycleService),
  __decorateParam(2, ITerminalLogService),
  __decorateParam(3, ILocalPtyService),
  __decorateParam(4, ILabelService),
  __decorateParam(5, IShellEnvironmentService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, IConfigurationResolverService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IProductService),
  __decorateParam(10, IHistoryService),
  __decorateParam(11, ITerminalProfileResolverService),
  __decorateParam(12, IEnvironmentVariableService),
  __decorateParam(13, IHistoryService),
  __decorateParam(14, INativeHostService),
  __decorateParam(15, IStatusbarService),
  __decorateParam(16, IRemoteAgentService)
], LocalTerminalBackend);
export {
  LocalTerminalBackendContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9lbGVjdHJvbi1zYW5kYm94L2xvY2FsVGVybWluYWxCYWNrZW5kLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElQcm9jZXNzRW52aXJvbm1lbnQsIGlzTWFjaW50b3NoLCBpc1dpbmRvd3MsIE9wZXJhdGluZ1N5c3RlbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSUxvY2FsUHR5U2VydmljZSwgSVByb2Nlc3NQcm9wZXJ0eU1hcCwgSVB0eUhvc3RMYXRlbmN5TWVhc3VyZW1lbnQsIElQdHlTZXJ2aWNlLCBJU2hlbGxMYXVuY2hDb25maWcsIElUZXJtaW5hbEJhY2tlbmQsIElUZXJtaW5hbEJhY2tlbmRSZWdpc3RyeSwgSVRlcm1pbmFsQ2hpbGRQcm9jZXNzLCBJVGVybWluYWxFbnZpcm9ubWVudCwgSVRlcm1pbmFsTG9nU2VydmljZSwgSVRlcm1pbmFsUHJvY2Vzc09wdGlvbnMsIElUZXJtaW5hbHNMYXlvdXRJbmZvLCBJVGVybWluYWxzTGF5b3V0SW5mb0J5SWQsIFByb2Nlc3NQcm9wZXJ0eVR5cGUsIFRlcm1pbmFsRXh0ZW5zaW9ucywgVGVybWluYWxJcGNDaGFubmVscywgVGVybWluYWxTZXR0aW5nSWQsIFRpdGxlRXZlbnRTb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgSUdldFRlcm1pbmFsTGF5b3V0SW5mb0FyZ3MsIElQcm9jZXNzRGV0YWlscywgSVNldFRlcm1pbmFsTGF5b3V0SW5mb0FyZ3MgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWxQcm9jZXNzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxJbnN0YW5jZVNlcnZpY2UgfSBmcm9tICcuLi9icm93c2VyL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgVGVybWluYWxTdG9yYWdlS2V5cyB9IGZyb20gJy4uL2NvbW1vbi90ZXJtaW5hbFN0b3JhZ2VLZXlzLmpzJztcbmltcG9ydCB7IExvY2FsUHR5IH0gZnJvbSAnLi9sb2NhbFB0eS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2NvbmZpZ3VyYXRpb25SZXNvbHZlci9jb21tb24vY29uZmlndXJhdGlvblJlc29sdmVyLmpzJztcbmltcG9ydCB7IElTaGVsbEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2VsZWN0cm9uLXNhbmRib3gvc2hlbGxFbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUhpc3RvcnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaGlzdG9yeS9jb21tb24vaGlzdG9yeS5qcyc7XG5pbXBvcnQgKiBhcyB0ZXJtaW5hbEVudmlyb25tZW50IGZyb20gJy4uL2NvbW1vbi90ZXJtaW5hbEVudmlyb25tZW50LmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFZhcmlhYmxlU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9lbnZpcm9ubWVudFZhcmlhYmxlLmpzJztcbmltcG9ydCB7IEJhc2VUZXJtaW5hbEJhY2tlbmQgfSBmcm9tICcuLi9icm93c2VyL2Jhc2VUZXJtaW5hbEJhY2tlbmQuanMnO1xuaW1wb3J0IHsgSU5hdGl2ZUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbmF0aXZlL2NvbW1vbi9uYXRpdmUuanMnO1xuaW1wb3J0IHsgQ2xpZW50IGFzIE1lc3NhZ2VQb3J0Q2xpZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9wYXJ0cy9pcGMvY29tbW9uL2lwYy5tcC5qcyc7XG5pbXBvcnQgeyBhY3F1aXJlUG9ydCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvcGFydHMvaXBjL2VsZWN0cm9uLXNhbmRib3gvaXBjLm1wLmpzJztcbmltcG9ydCB7IGdldERlbGF5ZWRDaGFubmVsLCBQcm94eUNoYW5uZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3BhcnRzL2lwYy9jb21tb24vaXBjLmpzJztcbmltcG9ydCB7IG1hcmssIFBlcmZvcm1hbmNlTWFyayB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BlcmZvcm1hbmNlLmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVTZXJ2aWNlLCBMaWZlY3ljbGVQaGFzZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IERlZmVycmVkUHJvbWlzZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IElTdGF0dXNiYXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvc3RhdHVzYmFyL2Jyb3dzZXIvc3RhdHVzYmFyLmpzJztcbmltcG9ydCB7IG1lbW9pemUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9kZWNvcmF0b3JzLmpzJztcbmltcG9ydCB7IFN0b3BXYXRjaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0b3B3YXRjaC5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlQWdlbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgc2hvdWxkVXNlRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWxFbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcblxuZXhwb3J0IGNsYXNzIExvY2FsVGVybWluYWxCYWNrZW5kQ29udHJpYnV0aW9uIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLmxvY2FsVGVybWluYWxCYWNrZW5kJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbEluc3RhbmNlU2VydmljZSB0ZXJtaW5hbEluc3RhbmNlU2VydmljZTogSVRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlXG5cdCkge1xuXHRcdGNvbnN0IGJhY2tlbmQgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShMb2NhbFRlcm1pbmFsQmFja2VuZCk7XG5cdFx0UmVnaXN0cnkuYXM8SVRlcm1pbmFsQmFja2VuZFJlZ2lzdHJ5PihUZXJtaW5hbEV4dGVuc2lvbnMuQmFja2VuZCkucmVnaXN0ZXJUZXJtaW5hbEJhY2tlbmQoYmFja2VuZCk7XG5cdFx0dGVybWluYWxJbnN0YW5jZVNlcnZpY2UuZGlkUmVnaXN0ZXJCYWNrZW5kKGJhY2tlbmQpO1xuXHR9XG59XG5cbmNsYXNzIExvY2FsVGVybWluYWxCYWNrZW5kIGV4dGVuZHMgQmFzZVRlcm1pbmFsQmFja2VuZCBpbXBsZW1lbnRzIElUZXJtaW5hbEJhY2tlbmQge1xuXHRyZWFkb25seSByZW1vdGVBdXRob3JpdHkgPSB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcHR5czogTWFwPG51bWJlciwgTG9jYWxQdHk+ID0gbmV3IE1hcCgpO1xuXG5cdHByaXZhdGUgX2RpcmVjdFByb3h5Q2xpZW50RXZlbnR1YWxseTogRGVmZXJyZWRQcm9taXNlPE1lc3NhZ2VQb3J0Q2xpZW50PiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfZGlyZWN0UHJveHk6IElQdHlTZXJ2aWNlIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXJlY3RQcm94eURpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXG5cdC8qKlxuXHQgKiBDb21tdW5pY2F0ZSB0byB0aGUgZGlyZWN0IHByb3h5IChyZW5kZXJlcjwtPnB0eWhvc3QpIGlmIGl0J3MgYXZhaWxhYmxlLCBvdGhlcndpc2UgdXNlIHRoZVxuXHQgKiBpbmRpcmVjdCBwcm94eSAocmVuZGVyZXI8LT5tYWluPC0+cHR5aG9zdCkuIFRoZSBsYXR0ZXIgbWF5IG5vdCBuZWVkIHRvIGFjdHVhbGx5IGxhdW5jaCB0aGVcblx0ICogcHR5IGhvc3QsIGZvciBleGFtcGxlIHdoZW4gZGV0ZWN0aW5nIHByb2ZpbGVzLlxuXHQgKi9cblx0cHJpdmF0ZSBnZXQgX3Byb3h5KCk6IElQdHlTZXJ2aWNlIHsgcmV0dXJuIHRoaXMuX2RpcmVjdFByb3h5IHx8IHRoaXMuX2xvY2FsUHR5U2VydmljZTsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3doZW5SZWFkeSA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblx0Z2V0IHdoZW5SZWFkeSgpOiBQcm9taXNlPHZvaWQ+IHsgcmV0dXJuIHRoaXMuX3doZW5SZWFkeS5wOyB9XG5cdHNldFJlYWR5KCk6IHZvaWQgeyB0aGlzLl93aGVuUmVhZHkuY29tcGxldGUoKTsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUmVxdWVzdERldGFjaCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgcmVxdWVzdElkOiBudW1iZXI7IHdvcmtzcGFjZUlkOiBzdHJpbmc7IGluc3RhbmNlSWQ6IG51bWJlciB9PigpKTtcblx0cmVhZG9ubHkgb25EaWRSZXF1ZXN0RGV0YWNoID0gdGhpcy5fb25EaWRSZXF1ZXN0RGV0YWNoLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2Ugd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUxpZmVjeWNsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbExvZ1NlcnZpY2UgbG9nU2VydmljZTogSVRlcm1pbmFsTG9nU2VydmljZSxcblx0XHRASUxvY2FsUHR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2NhbFB0eVNlcnZpY2U6IElMb2NhbFB0eVNlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJU2hlbGxFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfc2hlbGxFbnZpcm9ubWVudFNlcnZpY2U6IElTaGVsbEVudmlyb25tZW50U2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3N0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2U6IElDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Byb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElIaXN0b3J5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9oaXN0b3J5U2VydmljZTogSUhpc3RvcnlTZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZTogSVRlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZSxcblx0XHRASUVudmlyb25tZW50VmFyaWFibGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2Vudmlyb25tZW50VmFyaWFibGVTZXJ2aWNlOiBJRW52aXJvbm1lbnRWYXJpYWJsZVNlcnZpY2UsXG5cdFx0QElIaXN0b3J5U2VydmljZSBoaXN0b3J5U2VydmljZTogSUhpc3RvcnlTZXJ2aWNlLFxuXHRcdEBJTmF0aXZlSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbmF0aXZlSG9zdFNlcnZpY2U6IElOYXRpdmVIb3N0U2VydmljZSxcblx0XHRASVN0YXR1c2JhclNlcnZpY2Ugc3RhdHVzQmFyU2VydmljZTogSVN0YXR1c2JhclNlcnZpY2UsXG5cdFx0QElSZW1vdGVBZ2VudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcmVtb3RlQWdlbnRTZXJ2aWNlOiBJUmVtb3RlQWdlbnRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihfbG9jYWxQdHlTZXJ2aWNlLCBsb2dTZXJ2aWNlLCBoaXN0b3J5U2VydmljZSwgX2NvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UsIHN0YXR1c0JhclNlcnZpY2UsIHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25QdHlIb3N0UmVzdGFydCgoKSA9PiB7XG5cdFx0XHR0aGlzLl9kaXJlY3RQcm94eSA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX2RpcmVjdFByb3h5Q2xpZW50RXZlbnR1YWxseSA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX2Nvbm5lY3RUb0RpcmVjdFByb3h5KCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlcXVlc3QgYSBkaXJlY3QgY29ubmVjdGlvbiB0byB0aGUgcHR5IGhvc3QsIHRoaXMgd2lsbCBsYXVuY2ggdGhlIHB0eSBob3N0IHByb2Nlc3MgaWYgbmVjZXNzYXJ5LlxuXHQgKi9cblx0cHJpdmF0ZSBhc3luYyBfY29ubmVjdFRvRGlyZWN0UHJveHkoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gQ2hlY2sgaWYgY29ubmVjdGluZyBpcyBpbiBwcm9ncmVzc1xuXHRcdGlmICh0aGlzLl9kaXJlY3RQcm94eUNsaWVudEV2ZW50dWFsbHkpIHtcblx0XHRcdGF3YWl0IHRoaXMuX2RpcmVjdFByb3h5Q2xpZW50RXZlbnR1YWxseS5wO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoJ1N0YXJ0aW5nIHB0eSBob3N0Jyk7XG5cdFx0Y29uc3QgZGlyZWN0UHJveHlDbGllbnRFdmVudHVhbGx5ID0gbmV3IERlZmVycmVkUHJvbWlzZTxNZXNzYWdlUG9ydENsaWVudD4oKTtcblx0XHR0aGlzLl9kaXJlY3RQcm94eUNsaWVudEV2ZW50dWFsbHkgPSBkaXJlY3RQcm94eUNsaWVudEV2ZW50dWFsbHk7XG5cdFx0Y29uc3QgZGlyZWN0UHJveHkgPSBQcm94eUNoYW5uZWwudG9TZXJ2aWNlPElQdHlTZXJ2aWNlPihnZXREZWxheWVkQ2hhbm5lbCh0aGlzLl9kaXJlY3RQcm94eUNsaWVudEV2ZW50dWFsbHkucC50aGVuKGNsaWVudCA9PiBjbGllbnQuZ2V0Q2hhbm5lbChUZXJtaW5hbElwY0NoYW5uZWxzLlB0eUhvc3RXaW5kb3cpKSkpO1xuXHRcdHRoaXMuX2RpcmVjdFByb3h5ID0gZGlyZWN0UHJveHk7XG5cdFx0dGhpcy5fZGlyZWN0UHJveHlEaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0Ly8gVGhlIHB0eSBob3N0IHNob3VsZCBub3QgZ2V0IGxhdW5jaGVkIHVudGlsIGF0IGxlYXN0IHRoZSB3aW5kb3cgcmVzdG9yZWQgcGhhc2Vcblx0XHQvLyBpZiByZW1vdGUgYXV0aCBleGlzdHMsIGRvbid0IGF3YWl0XG5cdFx0aWYgKCF0aGlzLl9yZW1vdGVBZ2VudFNlcnZpY2UuZ2V0Q29ubmVjdGlvbigpPy5yZW1vdGVBdXRob3JpdHkpIHtcblx0XHRcdGF3YWl0IHRoaXMuX2xpZmVjeWNsZVNlcnZpY2Uud2hlbihMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCk7XG5cdFx0fVxuXG5cdFx0bWFyaygnY29kZS90ZXJtaW5hbC93aWxsQ29ubmVjdFB0eUhvc3QnKTtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCdSZW5kZXJlci0+UHR5SG9zdCNjb25uZWN0OiBiZWZvcmUgYWNxdWlyZVBvcnQnKTtcblx0XHRhY3F1aXJlUG9ydCgndnNjb2RlOmNyZWF0ZVB0eUhvc3RNZXNzYWdlQ2hhbm5lbCcsICd2c2NvZGU6Y3JlYXRlUHR5SG9zdE1lc3NhZ2VDaGFubmVsUmVzdWx0JykudGhlbihwb3J0ID0+IHtcblx0XHRcdG1hcmsoJ2NvZGUvdGVybWluYWwvZGlkQ29ubmVjdFB0eUhvc3QnKTtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ1JlbmRlcmVyLT5QdHlIb3N0I2Nvbm5lY3Q6IGNvbm5lY3Rpb24gZXN0YWJsaXNoZWQnKTtcblxuXHRcdFx0Y29uc3Qgc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHR0aGlzLl9kaXJlY3RQcm94eURpc3Bvc2FibGVzLnZhbHVlID0gc3RvcmU7XG5cblx0XHRcdC8vIFRoZXJlIGFyZSB0d28gY29ubmVjdGlvbnMgdG8gdGhlIHB0eSBob3N0OyBvbmUgdG8gdGhlIHJlZ3VsYXIgc2hhcmVkIHByb2Nlc3Ncblx0XHRcdC8vIF9sb2NhbFB0eVNlcnZpY2UsIGFuZCBvbmUgZGlyZWN0bHkgdmlhIG1lc3NhZ2UgcG9ydCBfcHR5SG9zdERpcmVjdFByb3h5LiBUaGUgZm9ybWVyIGlzXG5cdFx0XHQvLyB1c2VkIGZvciBwdHkgaG9zdCBtYW5hZ2VtZW50IG1lc3NhZ2VzLCBpdCB3b3VsZCBtYWtlIHNlbnNlIGluIHRoZSBmdXR1cmUgdG8gdXNlIGFcblx0XHRcdC8vIHNlcGFyYXRlIGludGVyZmFjZS9zZXJ2aWNlIGZvciB0aGlzIG9uZS5cblx0XHRcdGNvbnN0IGNsaWVudCA9IHN0b3JlLmFkZChuZXcgTWVzc2FnZVBvcnRDbGllbnQocG9ydCwgYHdpbmRvdzoke3RoaXMuX25hdGl2ZUhvc3RTZXJ2aWNlLndpbmRvd0lkfWApKTtcblx0XHRcdGRpcmVjdFByb3h5Q2xpZW50RXZlbnR1YWxseS5jb21wbGV0ZShjbGllbnQpO1xuXHRcdFx0dGhpcy5fb25QdHlIb3N0Q29ubmVjdGVkLmZpcmUoKTtcblxuXHRcdFx0Ly8gQXR0YWNoIHByb2Nlc3MgbGlzdGVuZXJzXG5cdFx0XHRzdG9yZS5hZGQoZGlyZWN0UHJveHkub25Qcm9jZXNzRGF0YShlID0+IHRoaXMuX3B0eXMuZ2V0KGUuaWQpPy5oYW5kbGVEYXRhKGUuZXZlbnQpKSk7XG5cdFx0XHRzdG9yZS5hZGQoZGlyZWN0UHJveHkub25EaWRDaGFuZ2VQcm9wZXJ0eShlID0+IHRoaXMuX3B0eXMuZ2V0KGUuaWQpPy5oYW5kbGVEaWRDaGFuZ2VQcm9wZXJ0eShlLnByb3BlcnR5KSkpO1xuXHRcdFx0c3RvcmUuYWRkKGRpcmVjdFByb3h5Lm9uUHJvY2Vzc0V4aXQoZSA9PiB7XG5cdFx0XHRcdGNvbnN0IHB0eSA9IHRoaXMuX3B0eXMuZ2V0KGUuaWQpO1xuXHRcdFx0XHRpZiAocHR5KSB7XG5cdFx0XHRcdFx0cHR5LmhhbmRsZUV4aXQoZS5ldmVudCk7XG5cdFx0XHRcdFx0dGhpcy5fcHR5cy5kZWxldGUoZS5pZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHRcdHN0b3JlLmFkZChkaXJlY3RQcm94eS5vblByb2Nlc3NSZWFkeShlID0+IHRoaXMuX3B0eXMuZ2V0KGUuaWQpPy5oYW5kbGVSZWFkeShlLmV2ZW50KSkpO1xuXHRcdFx0c3RvcmUuYWRkKGRpcmVjdFByb3h5Lm9uUHJvY2Vzc1JlcGxheShlID0+IHRoaXMuX3B0eXMuZ2V0KGUuaWQpPy5oYW5kbGVSZXBsYXkoZS5ldmVudCkpKTtcblx0XHRcdHN0b3JlLmFkZChkaXJlY3RQcm94eS5vblByb2Nlc3NPcnBoYW5RdWVzdGlvbihlID0+IHRoaXMuX3B0eXMuZ2V0KGUuaWQpPy5oYW5kbGVPcnBoYW5RdWVzdGlvbigpKSk7XG5cdFx0XHRzdG9yZS5hZGQoZGlyZWN0UHJveHkub25EaWRSZXF1ZXN0RGV0YWNoKGUgPT4gdGhpcy5fb25EaWRSZXF1ZXN0RGV0YWNoLmZpcmUoZSkpKTtcblxuXHRcdFx0Ly8gRWFnZXJseSBmZXRjaCB0aGUgYmFja2VuZCdzIGVudmlyb25tZW50IGZvciBtZW1vaXphdGlvblxuXHRcdFx0dGhpcy5nZXRFbnZpcm9ubWVudCgpO1xuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcmVxdWVzdERldGFjaEluc3RhbmNlKHdvcmtzcGFjZUlkOiBzdHJpbmcsIGluc3RhbmNlSWQ6IG51bWJlcik6IFByb21pc2U8SVByb2Nlc3NEZXRhaWxzIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5LnJlcXVlc3REZXRhY2hJbnN0YW5jZSh3b3Jrc3BhY2VJZCwgaW5zdGFuY2VJZCk7XG5cdH1cblxuXHRhc3luYyBhY2NlcHREZXRhY2hJbnN0YW5jZVJlcGx5KHJlcXVlc3RJZDogbnVtYmVyLCBwZXJzaXN0ZW50UHJvY2Vzc0lkPzogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCFwZXJzaXN0ZW50UHJvY2Vzc0lkKSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLndhcm4oJ0Nhbm5vdCBhdHRhY2ggdG8gZmVhdHVyZSB0ZXJtaW5hbHMsIGN1c3RvbSBwdHkgdGVybWluYWxzLCBvciB0aG9zZSB3aXRob3V0IGEgcGVyc2lzdGVudFByb2Nlc3NJZCcpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fcHJveHkuYWNjZXB0RGV0YWNoSW5zdGFuY2VSZXBseShyZXF1ZXN0SWQsIHBlcnNpc3RlbnRQcm9jZXNzSWQpO1xuXHR9XG5cblx0YXN5bmMgcGVyc2lzdFRlcm1pbmFsU3RhdGUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaWRzID0gQXJyYXkuZnJvbSh0aGlzLl9wdHlzLmtleXMoKSk7XG5cdFx0Y29uc3Qgc2VyaWFsaXplZCA9IGF3YWl0IHRoaXMuX3Byb3h5LnNlcmlhbGl6ZVRlcm1pbmFsU3RhdGUoaWRzKTtcblx0XHR0aGlzLl9zdG9yYWdlU2VydmljZS5zdG9yZShUZXJtaW5hbFN0b3JhZ2VLZXlzLlRlcm1pbmFsQnVmZmVyU3RhdGUsIHNlcmlhbGl6ZWQsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdH1cblxuXHRhc3luYyB1cGRhdGVUaXRsZShpZDogbnVtYmVyLCB0aXRsZTogc3RyaW5nLCB0aXRsZVNvdXJjZTogVGl0bGVFdmVudFNvdXJjZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuX3Byb3h5LnVwZGF0ZVRpdGxlKGlkLCB0aXRsZSwgdGl0bGVTb3VyY2UpO1xuXHR9XG5cblx0YXN5bmMgdXBkYXRlSWNvbihpZDogbnVtYmVyLCB1c2VySW5pdGlhdGVkOiBib29sZWFuLCBpY29uOiBVUkkgfCB7IGxpZ2h0OiBVUkk7IGRhcms6IFVSSSB9IHwgeyBpZDogc3RyaW5nOyBjb2xvcj86IHsgaWQ6IHN0cmluZyB9IH0sIGNvbG9yPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5fcHJveHkudXBkYXRlSWNvbihpZCwgdXNlckluaXRpYXRlZCwgaWNvbiwgY29sb3IpO1xuXHR9XG5cblx0YXN5bmMgdXBkYXRlUHJvcGVydHk8VCBleHRlbmRzIFByb2Nlc3NQcm9wZXJ0eVR5cGU+KGlkOiBudW1iZXIsIHByb3BlcnR5OiBQcm9jZXNzUHJvcGVydHlUeXBlLCB2YWx1ZTogSVByb2Nlc3NQcm9wZXJ0eU1hcFtUXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS51cGRhdGVQcm9wZXJ0eShpZCwgcHJvcGVydHksIHZhbHVlKTtcblx0fVxuXG5cdGFzeW5jIGNyZWF0ZVByb2Nlc3MoXG5cdFx0c2hlbGxMYXVuY2hDb25maWc6IElTaGVsbExhdW5jaENvbmZpZyxcblx0XHRjd2Q6IHN0cmluZyxcblx0XHRjb2xzOiBudW1iZXIsXG5cdFx0cm93czogbnVtYmVyLFxuXHRcdHVuaWNvZGVWZXJzaW9uOiAnNicgfCAnMTEnLFxuXHRcdGVudjogSVByb2Nlc3NFbnZpcm9ubWVudCxcblx0XHRvcHRpb25zOiBJVGVybWluYWxQcm9jZXNzT3B0aW9ucyxcblx0XHRzaG91bGRQZXJzaXN0OiBib29sZWFuXG5cdCk6IFByb21pc2U8SVRlcm1pbmFsQ2hpbGRQcm9jZXNzPiB7XG5cdFx0YXdhaXQgdGhpcy5fY29ubmVjdFRvRGlyZWN0UHJveHkoKTtcblx0XHRjb25zdCBleGVjdXRhYmxlRW52ID0gYXdhaXQgdGhpcy5fc2hlbGxFbnZpcm9ubWVudFNlcnZpY2UuZ2V0U2hlbGxFbnYoKTtcblx0XHRjb25zdCBpZCA9IGF3YWl0IHRoaXMuX3Byb3h5LmNyZWF0ZVByb2Nlc3Moc2hlbGxMYXVuY2hDb25maWcsIGN3ZCwgY29scywgcm93cywgdW5pY29kZVZlcnNpb24sIGVudiwgZXhlY3V0YWJsZUVudiwgb3B0aW9ucywgc2hvdWxkUGVyc2lzdCwgdGhpcy5fZ2V0V29ya3NwYWNlSWQoKSwgdGhpcy5fZ2V0V29ya3NwYWNlTmFtZSgpKTtcblx0XHRjb25zdCBwdHkgPSBuZXcgTG9jYWxQdHkoaWQsIHNob3VsZFBlcnNpc3QsIHRoaXMuX3Byb3h5KTtcblx0XHR0aGlzLl9wdHlzLnNldChpZCwgcHR5KTtcblx0XHRyZXR1cm4gcHR5O1xuXHR9XG5cblx0YXN5bmMgYXR0YWNoVG9Qcm9jZXNzKGlkOiBudW1iZXIpOiBQcm9taXNlPElUZXJtaW5hbENoaWxkUHJvY2VzcyB8IHVuZGVmaW5lZD4ge1xuXHRcdGF3YWl0IHRoaXMuX2Nvbm5lY3RUb0RpcmVjdFByb3h5KCk7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMuX3Byb3h5LmF0dGFjaFRvUHJvY2VzcyhpZCk7XG5cdFx0XHRjb25zdCBwdHkgPSBuZXcgTG9jYWxQdHkoaWQsIHRydWUsIHRoaXMuX3Byb3h5KTtcblx0XHRcdHRoaXMuX3B0eXMuc2V0KGlkLCBwdHkpO1xuXHRcdFx0cmV0dXJuIHB0eTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLndhcm4oYENvdWxkbid0IGF0dGFjaCB0byBwcm9jZXNzICR7ZS5tZXNzYWdlfWApO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0YXN5bmMgYXR0YWNoVG9SZXZpdmVkUHJvY2VzcyhpZDogbnVtYmVyKTogUHJvbWlzZTxJVGVybWluYWxDaGlsZFByb2Nlc3MgfCB1bmRlZmluZWQ+IHtcblx0XHRhd2FpdCB0aGlzLl9jb25uZWN0VG9EaXJlY3RQcm94eSgpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBuZXdJZCA9IGF3YWl0IHRoaXMuX3Byb3h5LmdldFJldml2ZWRQdHlOZXdJZCh0aGlzLl9nZXRXb3Jrc3BhY2VJZCgpLCBpZCkgPz8gaWQ7XG5cdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5hdHRhY2hUb1Byb2Nlc3MobmV3SWQpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybihgQ291bGRuJ3QgYXR0YWNoIHRvIHByb2Nlc3MgJHtlLm1lc3NhZ2V9YCk7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRhc3luYyBsaXN0UHJvY2Vzc2VzKCk6IFByb21pc2U8SVByb2Nlc3NEZXRhaWxzW10+IHtcblx0XHRhd2FpdCB0aGlzLl9jb25uZWN0VG9EaXJlY3RQcm94eSgpO1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS5saXN0UHJvY2Vzc2VzKCk7XG5cdH1cblxuXHRhc3luYyBnZXRMYXRlbmN5KCk6IFByb21pc2U8SVB0eUhvc3RMYXRlbmN5TWVhc3VyZW1lbnRbXT4ge1xuXHRcdGNvbnN0IG1lYXN1cmVtZW50czogSVB0eUhvc3RMYXRlbmN5TWVhc3VyZW1lbnRbXSA9IFtdO1xuXHRcdGNvbnN0IHN3ID0gbmV3IFN0b3BXYXRjaCgpO1xuXHRcdGlmICh0aGlzLl9kaXJlY3RQcm94eSkge1xuXHRcdFx0YXdhaXQgdGhpcy5fZGlyZWN0UHJveHkuZ2V0TGF0ZW5jeSgpO1xuXHRcdFx0c3cuc3RvcCgpO1xuXHRcdFx0bWVhc3VyZW1lbnRzLnB1c2goe1xuXHRcdFx0XHRsYWJlbDogJ3dpbmRvdzwtPnB0eWhvc3QgKG1lc3NhZ2UgcG9ydCknLFxuXHRcdFx0XHRsYXRlbmN5OiBzdy5lbGFwc2VkKClcblx0XHRcdH0pO1xuXHRcdFx0c3cucmVzZXQoKTtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0cyA9IGF3YWl0IHRoaXMuX2xvY2FsUHR5U2VydmljZS5nZXRMYXRlbmN5KCk7XG5cdFx0c3cuc3RvcCgpO1xuXHRcdG1lYXN1cmVtZW50cy5wdXNoKHtcblx0XHRcdGxhYmVsOiAnd2luZG93PC0+cHR5aG9zdHNlcnZpY2U8LT5wdHlob3N0Jyxcblx0XHRcdGxhdGVuY3k6IHN3LmVsYXBzZWQoKVxuXHRcdH0pO1xuXHRcdHJldHVybiBbXG5cdFx0XHQuLi5tZWFzdXJlbWVudHMsXG5cdFx0XHQuLi5yZXN1bHRzXG5cdFx0XTtcblx0fVxuXG5cdGFzeW5jIGdldFBlcmZvcm1hbmNlTWFya3MoKTogUHJvbWlzZTxQZXJmb3JtYW5jZU1hcmtbXT4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS5nZXRQZXJmb3JtYW5jZU1hcmtzKCk7XG5cdH1cblxuXHRhc3luYyByZWR1Y2VDb25uZWN0aW9uR3JhY2VUaW1lKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3Byb3h5LnJlZHVjZUNvbm5lY3Rpb25HcmFjZVRpbWUoKTtcblx0fVxuXG5cdGFzeW5jIGdldERlZmF1bHRTeXN0ZW1TaGVsbChvc092ZXJyaWRlPzogT3BlcmF0aW5nU3lzdGVtKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRyZXR1cm4gdGhpcy5fcHJveHkuZ2V0RGVmYXVsdFN5c3RlbVNoZWxsKG9zT3ZlcnJpZGUpO1xuXHR9XG5cblx0YXN5bmMgZ2V0UHJvZmlsZXMocHJvZmlsZXM6IHVua25vd24sIGRlZmF1bHRQcm9maWxlOiB1bmtub3duLCBpbmNsdWRlRGV0ZWN0ZWRQcm9maWxlcz86IGJvb2xlYW4pIHtcblx0XHRyZXR1cm4gdGhpcy5fbG9jYWxQdHlTZXJ2aWNlLmdldFByb2ZpbGVzKHRoaXMuX3dvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmlkLCBwcm9maWxlcywgZGVmYXVsdFByb2ZpbGUsIGluY2x1ZGVEZXRlY3RlZFByb2ZpbGVzKSB8fCBbXTtcblx0fVxuXG5cdEBtZW1vaXplXG5cdGFzeW5jIGdldEVudmlyb25tZW50KCk6IFByb21pc2U8SVByb2Nlc3NFbnZpcm9ubWVudD4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS5nZXRFbnZpcm9ubWVudCgpO1xuXHR9XG5cblx0QG1lbW9pemVcblx0YXN5bmMgZ2V0U2hlbGxFbnZpcm9ubWVudCgpOiBQcm9taXNlPElQcm9jZXNzRW52aXJvbm1lbnQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fc2hlbGxFbnZpcm9ubWVudFNlcnZpY2UuZ2V0U2hlbGxFbnYoKTtcblx0fVxuXG5cdGFzeW5jIGdldFdzbFBhdGgob3JpZ2luYWw6IHN0cmluZywgZGlyZWN0aW9uOiAndW5peC10by13aW4nIHwgJ3dpbi10by11bml4Jyk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5LmdldFdzbFBhdGgob3JpZ2luYWwsIGRpcmVjdGlvbik7XG5cdH1cblxuXHRhc3luYyBzZXRUZXJtaW5hbExheW91dEluZm8obGF5b3V0SW5mbz86IElUZXJtaW5hbHNMYXlvdXRJbmZvQnlJZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGFyZ3M6IElTZXRUZXJtaW5hbExheW91dEluZm9BcmdzID0ge1xuXHRcdFx0d29ya3NwYWNlSWQ6IHRoaXMuX2dldFdvcmtzcGFjZUlkKCksXG5cdFx0XHR0YWJzOiBsYXlvdXRJbmZvID8gbGF5b3V0SW5mby50YWJzIDogW11cblx0XHR9O1xuXHRcdGF3YWl0IHRoaXMuX3Byb3h5LnNldFRlcm1pbmFsTGF5b3V0SW5mbyhhcmdzKTtcblx0XHQvLyBTdG9yZSBpbiB0aGUgc3RvcmFnZSBzZXJ2aWNlIGFzIHdlbGwgdG8gYmUgdXNlZCB3aGVuIHJldml2aW5nIHByb2Nlc3NlcyBhcyBub3JtYWxseSB0aGlzXG5cdFx0Ly8gaXMgc3RvcmVkIGluIG1lbW9yeSBvbiB0aGUgcHR5IGhvc3Rcblx0XHR0aGlzLl9zdG9yYWdlU2VydmljZS5zdG9yZShUZXJtaW5hbFN0b3JhZ2VLZXlzLlRlcm1pbmFsTGF5b3V0SW5mbywgSlNPTi5zdHJpbmdpZnkoYXJncyksIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdH1cblxuXHRhc3luYyBnZXRUZXJtaW5hbExheW91dEluZm8oKTogUHJvbWlzZTxJVGVybWluYWxzTGF5b3V0SW5mbyB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHdvcmtzcGFjZUlkID0gdGhpcy5fZ2V0V29ya3NwYWNlSWQoKTtcblx0XHRjb25zdCBsYXlvdXRBcmdzOiBJR2V0VGVybWluYWxMYXlvdXRJbmZvQXJncyA9IHsgd29ya3NwYWNlSWQgfTtcblxuXHRcdC8vIFJldml2ZSBwcm9jZXNzZXMgaWYgbmVlZGVkXG5cdFx0Y29uc3Qgc2VyaWFsaXplZFN0YXRlID0gdGhpcy5fc3RvcmFnZVNlcnZpY2UuZ2V0KFRlcm1pbmFsU3RvcmFnZUtleXMuVGVybWluYWxCdWZmZXJTdGF0ZSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSk7XG5cdFx0Y29uc3QgcmV2aXZlQnVmZmVyU3RhdGUgPSB0aGlzLl9kZXNlcmlhbGl6ZVRlcm1pbmFsU3RhdGUoc2VyaWFsaXplZFN0YXRlKTtcblx0XHRpZiAocmV2aXZlQnVmZmVyU3RhdGUgJiYgcmV2aXZlQnVmZmVyU3RhdGUubGVuZ3RoID4gMCkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Ly8gQ3JlYXRlIHZhcmlhYmxlIHJlc29sdmVyXG5cdFx0XHRcdGNvbnN0IGFjdGl2ZVdvcmtzcGFjZVJvb3RVcmkgPSB0aGlzLl9oaXN0b3J5U2VydmljZS5nZXRMYXN0QWN0aXZlV29ya3NwYWNlUm9vdCgpO1xuXHRcdFx0XHRjb25zdCBsYXN0QWN0aXZlV29ya3NwYWNlID0gYWN0aXZlV29ya3NwYWNlUm9vdFVyaSA/IHRoaXMuX3dvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZUZvbGRlcihhY3RpdmVXb3Jrc3BhY2VSb290VXJpKSA/PyB1bmRlZmluZWQgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdGNvbnN0IHZhcmlhYmxlUmVzb2x2ZXIgPSB0ZXJtaW5hbEVudmlyb25tZW50LmNyZWF0ZVZhcmlhYmxlUmVzb2x2ZXIobGFzdEFjdGl2ZVdvcmtzcGFjZSwgYXdhaXQgdGhpcy5fdGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlLmdldEVudmlyb25tZW50KHRoaXMucmVtb3RlQXV0aG9yaXR5KSwgdGhpcy5fY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSk7XG5cblx0XHRcdFx0Ly8gUmUtcmVzb2x2ZSB0aGUgZW52aXJvbm1lbnRzIGFuZCByZXBsYWNlIGl0IG9uIHRoZSBzdGF0ZSBzbyBsb2NhbCB0ZXJtaW5hbHMgdXNlIGEgZnJlc2hcblx0XHRcdFx0Ly8gZW52aXJvbm1lbnRcblx0XHRcdFx0bWFyaygnY29kZS90ZXJtaW5hbC93aWxsR2V0UmV2aXZlRW52aXJvbm1lbnRzJyk7XG5cdFx0XHRcdGF3YWl0IFByb21pc2UuYWxsKHJldml2ZUJ1ZmZlclN0YXRlLm1hcChzdGF0ZSA9PiBuZXcgUHJvbWlzZTx2b2lkPihyID0+IHtcblx0XHRcdFx0XHR0aGlzLl9yZXNvbHZlRW52aXJvbm1lbnRGb3JSZXZpdmUodmFyaWFibGVSZXNvbHZlciwgc3RhdGUuc2hlbGxMYXVuY2hDb25maWcpLnRoZW4oZnJlc2hFbnYgPT4ge1xuXHRcdFx0XHRcdFx0c3RhdGUucHJvY2Vzc0xhdW5jaENvbmZpZy5lbnYgPSBmcmVzaEVudjtcblx0XHRcdFx0XHRcdHIoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSkpKTtcblx0XHRcdFx0bWFyaygnY29kZS90ZXJtaW5hbC9kaWRHZXRSZXZpdmVFbnZpcm9ubWVudHMnKTtcblxuXHRcdFx0XHRtYXJrKCdjb2RlL3Rlcm1pbmFsL3dpbGxSZXZpdmVUZXJtaW5hbFByb2Nlc3NlcycpO1xuXHRcdFx0XHRhd2FpdCB0aGlzLl9wcm94eS5yZXZpdmVUZXJtaW5hbFByb2Nlc3Nlcyh3b3Jrc3BhY2VJZCwgcmV2aXZlQnVmZmVyU3RhdGUsIEludGwuRGF0ZVRpbWVGb3JtYXQoKS5yZXNvbHZlZE9wdGlvbnMoKS5sb2NhbGUpO1xuXHRcdFx0XHRtYXJrKCdjb2RlL3Rlcm1pbmFsL2RpZFJldml2ZVRlcm1pbmFsUHJvY2Vzc2VzJyk7XG5cdFx0XHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnJlbW92ZShUZXJtaW5hbFN0b3JhZ2VLZXlzLlRlcm1pbmFsQnVmZmVyU3RhdGUsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpO1xuXHRcdFx0XHQvLyBJZiByZXZpdmluZyBwcm9jZXNzZXMsIHNlbmQgdGhlIHRlcm1pbmFsIGxheW91dCBpbmZvIGJhY2sgdG8gdGhlIHB0eSBob3N0IGFzIGl0XG5cdFx0XHRcdC8vIHdpbGwgbm90IGhhdmUgYmVlbiBwZXJzaXN0ZWQgb24gYXBwbGljYXRpb24gZXhpdFxuXHRcdFx0XHRjb25zdCBsYXlvdXRJbmZvID0gdGhpcy5fc3RvcmFnZVNlcnZpY2UuZ2V0KFRlcm1pbmFsU3RvcmFnZUtleXMuVGVybWluYWxMYXlvdXRJbmZvLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKTtcblx0XHRcdFx0aWYgKGxheW91dEluZm8pIHtcblx0XHRcdFx0XHRtYXJrKCdjb2RlL3Rlcm1pbmFsL3dpbGxTZXRUZXJtaW5hbExheW91dEluZm8nKTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLl9wcm94eS5zZXRUZXJtaW5hbExheW91dEluZm8oSlNPTi5wYXJzZShsYXlvdXRJbmZvKSk7XG5cdFx0XHRcdFx0bWFyaygnY29kZS90ZXJtaW5hbC9kaWRTZXRUZXJtaW5hbExheW91dEluZm8nKTtcblx0XHRcdFx0XHR0aGlzLl9zdG9yYWdlU2VydmljZS5yZW1vdmUoVGVybWluYWxTdG9yYWdlS2V5cy5UZXJtaW5hbExheW91dEluZm8sIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlOiB1bmtub3duKSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybignTG9jYWxUZXJtaW5hbEJhY2tlbmQjZ2V0VGVybWluYWxMYXlvdXRJbmZvIEVycm9yJywgZSAmJiB0eXBlb2YgZSA9PT0gJ29iamVjdCcgJiYgJ21lc3NhZ2UnIGluIGUgPyBlLm1lc3NhZ2UgOiBlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fcHJveHkuZ2V0VGVybWluYWxMYXlvdXRJbmZvKGxheW91dEFyZ3MpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcmVzb2x2ZUVudmlyb25tZW50Rm9yUmV2aXZlKHZhcmlhYmxlUmVzb2x2ZXI6IHRlcm1pbmFsRW52aXJvbm1lbnQuVmFyaWFibGVSZXNvbHZlciB8IHVuZGVmaW5lZCwgc2hlbGxMYXVuY2hDb25maWc6IElTaGVsbExhdW5jaENvbmZpZyk6IFByb21pc2U8SVByb2Nlc3NFbnZpcm9ubWVudD4ge1xuXHRcdGNvbnN0IHBsYXRmb3JtS2V5ID0gaXNXaW5kb3dzID8gJ3dpbmRvd3MnIDogKGlzTWFjaW50b3NoID8gJ29zeCcgOiAnbGludXgnKTtcblx0XHRjb25zdCBlbnZGcm9tQ29uZmlnVmFsdWUgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJVGVybWluYWxFbnZpcm9ubWVudCB8IHVuZGVmaW5lZD4oYHRlcm1pbmFsLmludGVncmF0ZWQuZW52LiR7cGxhdGZvcm1LZXl9YCk7XG5cdFx0Y29uc3QgYmFzZUVudiA9IGF3YWl0IChzaGVsbExhdW5jaENvbmZpZy51c2VTaGVsbEVudmlyb25tZW50ID8gdGhpcy5nZXRTaGVsbEVudmlyb25tZW50KCkgOiB0aGlzLmdldEVudmlyb25tZW50KCkpO1xuXHRcdGNvbnN0IGVudiA9IGF3YWl0IHRlcm1pbmFsRW52aXJvbm1lbnQuY3JlYXRlVGVybWluYWxFbnZpcm9ubWVudChzaGVsbExhdW5jaENvbmZpZywgZW52RnJvbUNvbmZpZ1ZhbHVlLCB2YXJpYWJsZVJlc29sdmVyLCB0aGlzLl9wcm9kdWN0U2VydmljZS52ZXJzaW9uLCB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShUZXJtaW5hbFNldHRpbmdJZC5EZXRlY3RMb2NhbGUpLCBiYXNlRW52KTtcblx0XHRpZiAoc2hvdWxkVXNlRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oc2hlbGxMYXVuY2hDb25maWcpKSB7XG5cdFx0XHRjb25zdCB3b3Jrc3BhY2VGb2xkZXIgPSB0ZXJtaW5hbEVudmlyb25tZW50LmdldFdvcmtzcGFjZUZvclRlcm1pbmFsKHNoZWxsTGF1bmNoQ29uZmlnLmN3ZCwgdGhpcy5fd29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIHRoaXMuX2hpc3RvcnlTZXJ2aWNlKTtcblx0XHRcdGF3YWl0IHRoaXMuX2Vudmlyb25tZW50VmFyaWFibGVTZXJ2aWNlLm1lcmdlZENvbGxlY3Rpb24uYXBwbHlUb1Byb2Nlc3NFbnZpcm9ubWVudChlbnYsIHsgd29ya3NwYWNlRm9sZGVyIH0sIHZhcmlhYmxlUmVzb2x2ZXIpO1xuXHRcdH1cblx0XHRyZXR1cm4gZW52O1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0V29ya3NwYWNlTmFtZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9sYWJlbFNlcnZpY2UuZ2V0V29ya3NwYWNlTGFiZWwodGhpcy5fd29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkpO1xuXHR9XG5cblx0Ly8gI3JlZ2lvbiBQdHkgc2VydmljZSBjb250cmlidXRpb24gUlBDIGNhbGxzXG5cblx0aW5zdGFsbEF1dG9SZXBseShtYXRjaDogc3RyaW5nLCByZXBseTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5Lmluc3RhbGxBdXRvUmVwbHkobWF0Y2gsIHJlcGx5KTtcblx0fVxuXHR1bmluc3RhbGxBbGxBdXRvUmVwbGllcygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fcHJveHkudW5pbnN0YWxsQWxsQXV0b1JlcGxpZXMoKTtcblx0fVxuXG5cdC8vICNlbmRyZWdpb25cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxlQUFlO0FBQ3hCLFNBQThCLGFBQWEsaUJBQWtDO0FBRTdFLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMsa0JBQTZMLHFCQUFtSCxvQkFBb0IscUJBQXFCLHlCQUEyQztBQUU3WSxTQUFTLGdDQUFnQztBQUV6QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHVDQUF1QztBQUNoRCxTQUFTLDJCQUEy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
