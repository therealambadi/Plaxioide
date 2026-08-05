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
import { DeferredPromise } from "../../../../base/common/async.js";
import { Emitter } from "../../../../base/common/event.js";
import { revive } from "../../../../base/common/marshalling.js";
import { mark } from "../../../../base/common/performance.js";
import { OperatingSystem } from "../../../../base/common/platform.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IRemoteAuthorityResolverService } from "../../../../platform/remote/common/remoteAuthorityResolver.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITerminalLogService, TerminalExtensions, TerminalSettingId } from "../../../../platform/terminal/common/terminal.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { BaseTerminalBackend } from "./baseTerminalBackend.js";
import { RemotePty } from "./remotePty.js";
import { ITerminalInstanceService } from "./terminal.js";
import { RemoteTerminalChannelClient, REMOTE_TERMINAL_CHANNEL_NAME } from "../common/remote/remoteTerminalChannel.js";
import { TERMINAL_CONFIG_SECTION } from "../common/terminal.js";
import { TerminalStorageKeys } from "../common/terminalStorageKeys.js";
import { IConfigurationResolverService } from "../../../services/configurationResolver/common/configurationResolver.js";
import { IHistoryService } from "../../../services/history/common/history.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { IStatusbarService } from "../../../services/statusbar/browser/statusbar.js";
let RemoteTerminalBackendContribution = class {
  constructor(instantiationService, remoteAgentService, terminalInstanceService) {
    const connection = remoteAgentService.getConnection();
    if (connection?.remoteAuthority) {
      const channel = instantiationService.createInstance(RemoteTerminalChannelClient, connection.remoteAuthority, connection.getChannel(REMOTE_TERMINAL_CHANNEL_NAME));
      const backend = instantiationService.createInstance(RemoteTerminalBackend, connection.remoteAuthority, channel);
      Registry.as(TerminalExtensions.Backend).registerTerminalBackend(backend);
      terminalInstanceService.didRegisterBackend(backend);
    }
  }
};
RemoteTerminalBackendContribution.ID = "remoteTerminalBackend";
RemoteTerminalBackendContribution = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IRemoteAgentService),
  __decorateParam(2, ITerminalInstanceService)
], RemoteTerminalBackendContribution);
let RemoteTerminalBackend = class extends BaseTerminalBackend {
  constructor(remoteAuthority, _remoteTerminalChannel, _remoteAgentService, _instantiationService, logService, _commandService, _storageService, _remoteAuthorityResolverService, workspaceContextService, configurationResolverService, _historyService, _configurationService, statusBarService) {
    super(_remoteTerminalChannel, logService, _historyService, configurationResolverService, statusBarService, workspaceContextService);
    this.remoteAuthority = remoteAuthority;
    this._remoteTerminalChannel = _remoteTerminalChannel;
    this._remoteAgentService = _remoteAgentService;
    this._instantiationService = _instantiationService;
    this._commandService = _commandService;
    this._storageService = _storageService;
    this._remoteAuthorityResolverService = _remoteAuthorityResolverService;
    this._historyService = _historyService;
    this._configurationService = _configurationService;
    this._ptys = /* @__PURE__ */ new Map();
    this._whenConnected = new DeferredPromise();
    this._onDidRequestDetach = this._register(new Emitter());
    this.onDidRequestDetach = this._onDidRequestDetach.event;
    this._onRestoreCommands = this._register(new Emitter());
    this.onRestoreCommands = this._onRestoreCommands.event;
    this._remoteTerminalChannel.onProcessData((e) => this._ptys.get(e.id)?.handleData(e.event));
    this._remoteTerminalChannel.onProcessReplay((e) => {
      this._ptys.get(e.id)?.handleReplay(e.event);
      if (e.event.commands.commands.length > 0) {
        this._onRestoreCommands.fire({ id: e.id, commands: e.event.commands.commands });
      }
    });
    this._remoteTerminalChannel.onProcessOrphanQuestion((e) => this._ptys.get(e.id)?.handleOrphanQuestion());
    this._remoteTerminalChannel.onDidRequestDetach((e) => this._onDidRequestDetach.fire(e));
    this._remoteTerminalChannel.onProcessReady((e) => this._ptys.get(e.id)?.handleReady(e.event));
    this._remoteTerminalChannel.onDidChangeProperty((e) => this._ptys.get(e.id)?.handleDidChangeProperty(e.property));
    this._remoteTerminalChannel.onProcessExit((e) => {
      const pty = this._ptys.get(e.id);
      if (pty) {
        pty.handleExit(e.event);
        this._ptys.delete(e.id);
      }
    });
    const allowedCommands = ["_remoteCLI.openExternal", "_remoteCLI.windowOpen", "_remoteCLI.getSystemStatus", "_remoteCLI.manageExtensions"];
    this._remoteTerminalChannel.onExecuteCommand(async (e) => {
      const pty = this._ptys.get(e.persistentProcessId);
      if (!pty) {
        return;
      }
      const reqId = e.reqId;
      const commandId = e.commandId;
      if (!allowedCommands.includes(commandId)) {
        this._remoteTerminalChannel.sendCommandResult(reqId, true, "Invalid remote cli command: " + commandId);
        return;
      }
      const commandArgs = e.commandArgs.map((arg) => revive(arg));
      try {
        const result = await this._commandService.executeCommand(e.commandId, ...commandArgs);
        this._remoteTerminalChannel.sendCommandResult(reqId, false, result);
      } catch (err) {
        this._remoteTerminalChannel.sendCommandResult(reqId, true, err);
      }
    });
    this._onPtyHostConnected.fire();
  }
  get whenReady() {
    return this._whenConnected.p;
  }
  setReady() {
    this._whenConnected.complete();
  }
  async requestDetachInstance(workspaceId, instanceId) {
    if (!this._remoteTerminalChannel) {
      throw new Error(`Cannot request detach instance when there is no remote!`);
    }
    return this._remoteTerminalChannel.requestDetachInstance(workspaceId, instanceId);
  }
  async acceptDetachInstanceReply(requestId, persistentProcessId) {
    if (!this._remoteTerminalChannel) {
      throw new Error(`Cannot accept detached instance when there is no remote!`);
    } else if (!persistentProcessId) {
      this._logService.warn("Cannot attach to feature terminals, custom pty terminals, or those without a persistentProcessId");
      return;
    }
    return this._remoteTerminalChannel.acceptDetachInstanceReply(requestId, persistentProcessId);
  }
  async persistTerminalState() {
    if (!this._remoteTerminalChannel) {
      throw new Error(`Cannot persist terminal state when there is no remote!`);
    }
    const ids = Array.from(this._ptys.keys());
    const serialized = await this._remoteTerminalChannel.serializeTerminalState(ids);
    this._storageService.store(TerminalStorageKeys.TerminalBufferState, serialized, StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  async createProcess(shellLaunchConfig, cwd, cols, rows, unicodeVersion, env, options, shouldPersist) {
    if (!this._remoteTerminalChannel) {
      throw new Error(`Cannot create remote terminal when there is no remote!`);
    }
    const remoteEnv = await this._remoteAgentService.getEnvironment();
    if (!remoteEnv) {
      throw new Error("Could not fetch remote environment");
    }
    const terminalConfig = this._configurationService.getValue(TERMINAL_CONFIG_SECTION);
    const configuration = {
      "terminal.integrated.env.windows": this._configurationService.getValue(TerminalSettingId.EnvWindows),
      "terminal.integrated.env.osx": this._configurationService.getValue(TerminalSettingId.EnvMacOs),
      "terminal.integrated.env.linux": this._configurationService.getValue(TerminalSettingId.EnvLinux),
      "terminal.integrated.cwd": this._configurationService.getValue(TerminalSettingId.Cwd),
      "terminal.integrated.detectLocale": terminalConfig.detectLocale
    };
    const shellLaunchConfigDto = {
      name: shellLaunchConfig.name,
      executable: shellLaunchConfig.executable,
      args: shellLaunchConfig.args,
      cwd: shellLaunchConfig.cwd,
      env: shellLaunchConfig.env,
      useShellEnvironment: shellLaunchConfig.useShellEnvironment,
      reconnectionProperties: shellLaunchConfig.reconnectionProperties,
      type: shellLaunchConfig.type,
      isFeatureTerminal: shellLaunchConfig.isFeatureTerminal,
      tabActions: shellLaunchConfig.tabActions,
      shellIntegrationEnvironmentReporting: shellLaunchConfig.shellIntegrationEnvironmentReporting
    };
    const activeWorkspaceRootUri = this._historyService.getLastActiveWorkspaceRoot();
    const result = await this._remoteTerminalChannel.createProcess(
      shellLaunchConfigDto,
      configuration,
      activeWorkspaceRootUri,
      options,
      shouldPersist,
      cols,
      rows,
      unicodeVersion
    );
    const pty = this._instantiationService.createInstance(RemotePty, result.persistentTerminalId, shouldPersist, this._remoteTerminalChannel);
    this._ptys.set(result.persistentTerminalId, pty);
    return pty;
  }
  async attachToProcess(id) {
    if (!this._remoteTerminalChannel) {
      throw new Error(`Cannot create remote terminal when there is no remote!`);
    }
    try {
      await this._remoteTerminalChannel.attachToProcess(id);
      const pty = this._instantiationService.createInstance(RemotePty, id, true, this._remoteTerminalChannel);
      this._ptys.set(id, pty);
      return pty;
    } catch (e) {
      this._logService.trace(`Couldn't attach to process ${e.message}`);
    }
    return void 0;
  }
  async attachToRevivedProcess(id) {
    if (!this._remoteTerminalChannel) {
      throw new Error(`Cannot create remote terminal when there is no remote!`);
    }
    try {
      const newId = await this._remoteTerminalChannel.getRevivedPtyNewId(id) ?? id;
      return await this.attachToProcess(newId);
    } catch (e) {
      this._logService.trace(`Couldn't attach to process ${e.message}`);
    }
    return void 0;
  }
  async listProcesses() {
    return this._remoteTerminalChannel.listProcesses();
  }
  async getLatency() {
    const sw = new StopWatch();
    const results = await this._remoteTerminalChannel.getLatency();
    sw.stop();
    return [
      {
        label: "window<->ptyhostservice<->ptyhost",
        latency: sw.elapsed()
      },
      ...results
    ];
  }
  async updateProperty(id, property, value) {
    await this._remoteTerminalChannel.updateProperty(id, property, value);
  }
  async updateTitle(id, title, titleSource) {
    await this._remoteTerminalChannel.updateTitle(id, title, titleSource);
  }
  async updateIcon(id, userInitiated, icon, color) {
    await this._remoteTerminalChannel.updateIcon(id, userInitiated, icon, color);
  }
  async getDefaultSystemShell(osOverride) {
    return this._remoteTerminalChannel.getDefaultSystemShell(osOverride) || "";
  }
  async getProfiles(profiles, defaultProfile, includeDetectedProfiles) {
    return this._remoteTerminalChannel.getProfiles(profiles, defaultProfile, includeDetectedProfiles) || [];
  }
  async getEnvironment() {
    return this._remoteTerminalChannel.getEnvironment() || {};
  }
  async getShellEnvironment() {
    const connection = this._remoteAgentService.getConnection();
    if (!connection) {
      return void 0;
    }
    const resolverResult = await this._remoteAuthorityResolverService.resolveAuthority(connection.remoteAuthority);
    return resolverResult.options?.extensionHostEnv;
  }
  async getWslPath(original, direction) {
    const env = await this._remoteAgentService.getEnvironment();
    if (env?.os !== OperatingSystem.Windows) {
      return original;
    }
    return this._remoteTerminalChannel.getWslPath(original, direction) || original;
  }
  async setTerminalLayoutInfo(layout) {
    if (!this._remoteTerminalChannel) {
      throw new Error(`Cannot call setActiveInstanceId when there is no remote`);
    }
    return this._remoteTerminalChannel.setTerminalLayoutInfo(layout);
  }
  async reduceConnectionGraceTime() {
    if (!this._remoteTerminalChannel) {
      throw new Error("Cannot reduce grace time when there is no remote");
    }
    return this._remoteTerminalChannel.reduceConnectionGraceTime();
  }
  async getTerminalLayoutInfo() {
    if (!this._remoteTerminalChannel) {
      throw new Error(`Cannot call getActiveInstanceId when there is no remote`);
    }
    const workspaceId = this._getWorkspaceId();
    const serializedState = this._storageService.get(TerminalStorageKeys.TerminalBufferState, StorageScope.WORKSPACE);
    const reviveBufferState = this._deserializeTerminalState(serializedState);
    if (reviveBufferState && reviveBufferState.length > 0) {
      try {
        mark("code/terminal/willReviveTerminalProcessesRemote");
        await this._remoteTerminalChannel.reviveTerminalProcesses(workspaceId, reviveBufferState, Intl.DateTimeFormat().resolvedOptions().locale);
        mark("code/terminal/didReviveTerminalProcessesRemote");
        this._storageService.remove(TerminalStorageKeys.TerminalBufferState, StorageScope.WORKSPACE);
        const layoutInfo = this._storageService.get(TerminalStorageKeys.TerminalLayoutInfo, StorageScope.WORKSPACE);
        if (layoutInfo) {
          mark("code/terminal/willSetTerminalLayoutInfoRemote");
          await this._remoteTerminalChannel.setTerminalLayoutInfo(JSON.parse(layoutInfo));
          mark("code/terminal/didSetTerminalLayoutInfoRemote");
          this._storageService.remove(TerminalStorageKeys.TerminalLayoutInfo, StorageScope.WORKSPACE);
        }
      } catch (e) {
        this._logService.warn("RemoteTerminalBackend#getTerminalLayoutInfo Error", e && typeof e === "object" && "message" in e ? e.message : e);
      }
    }
    return this._remoteTerminalChannel.getTerminalLayoutInfo();
  }
  async getPerformanceMarks() {
    return this._remoteTerminalChannel.getPerformanceMarks();
  }
  installAutoReply(match, reply) {
    return this._remoteTerminalChannel.installAutoReply(match, reply);
  }
  uninstallAllAutoReplies() {
    return this._remoteTerminalChannel.uninstallAllAutoReplies();
  }
};
RemoteTerminalBackend = __decorateClass([
  __decorateParam(2, IRemoteAgentService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ITerminalLogService),
  __decorateParam(5, ICommandService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, IRemoteAuthorityResolverService),
  __decorateParam(8, IWorkspaceContextService),
  __decorateParam(9, IConfigurationResolverService),
  __decorateParam(10, IHistoryService),
  __decorateParam(11, IConfigurationService),
  __decorateParam(12, IStatusbarService)
], RemoteTerminalBackend);
export {
  RemoteTerminalBackendContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3JlbW90ZVRlcm1pbmFsQmFja2VuZC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERlZmVycmVkUHJvbWlzZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyByZXZpdmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZy5qcyc7XG5pbXBvcnQgeyBQZXJmb3JtYW5jZU1hcmssIG1hcmsgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wZXJmb3JtYW5jZS5qcyc7XG5pbXBvcnQgeyBJUHJvY2Vzc0Vudmlyb25tZW50LCBPcGVyYXRpbmdTeXN0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBTdG9wV2F0Y2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdG9wd2F0Y2guanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9yZW1vdGVBdXRob3JpdHlSZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVNlcmlhbGl6ZWRUZXJtaW5hbENvbW1hbmQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL2NhcGFiaWxpdGllcy5qcyc7XG5pbXBvcnQgeyBJUHR5SG9zdExhdGVuY3lNZWFzdXJlbWVudCwgSVNoZWxsTGF1bmNoQ29uZmlnLCBJU2hlbGxMYXVuY2hDb25maWdEdG8sIElUZXJtaW5hbEJhY2tlbmQsIElUZXJtaW5hbEJhY2tlbmRSZWdpc3RyeSwgSVRlcm1pbmFsQ2hpbGRQcm9jZXNzLCBJVGVybWluYWxFbnZpcm9ubWVudCwgSVRlcm1pbmFsTG9nU2VydmljZSwgSVRlcm1pbmFsUHJvY2Vzc09wdGlvbnMsIElUZXJtaW5hbFByb2ZpbGUsIElUZXJtaW5hbHNMYXlvdXRJbmZvLCBJVGVybWluYWxzTGF5b3V0SW5mb0J5SWQsIFByb2Nlc3NQcm9wZXJ0eVR5cGUsIFRlcm1pbmFsRXh0ZW5zaW9ucywgVGVybWluYWxJY29uLCBUZXJtaW5hbFNldHRpbmdJZCwgVGl0bGVFdmVudFNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBJUHJvY2Vzc0RldGFpbHMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWxQcm9jZXNzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBCYXNlVGVybWluYWxCYWNrZW5kIH0gZnJvbSAnLi9iYXNlVGVybWluYWxCYWNrZW5kLmpzJztcbmltcG9ydCB7IFJlbW90ZVB0eSB9IGZyb20gJy4vcmVtb3RlUHR5LmpzJztcbmltcG9ydCB7IElUZXJtaW5hbEluc3RhbmNlU2VydmljZSB9IGZyb20gJy4vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgUmVtb3RlVGVybWluYWxDaGFubmVsQ2xpZW50LCBSRU1PVEVfVEVSTUlOQUxfQ0hBTk5FTF9OQU1FIH0gZnJvbSAnLi4vY29tbW9uL3JlbW90ZS9yZW1vdGVUZXJtaW5hbENoYW5uZWwuanMnO1xuaW1wb3J0IHsgSUNvbXBsZXRlVGVybWluYWxDb25maWd1cmF0aW9uLCBJVGVybWluYWxDb25maWd1cmF0aW9uLCBURVJNSU5BTF9DT05GSUdfU0VDVElPTiB9IGZyb20gJy4uL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbFN0b3JhZ2VLZXlzIH0gZnJvbSAnLi4vY29tbW9uL3Rlcm1pbmFsU3RvcmFnZUtleXMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9jb25maWd1cmF0aW9uUmVzb2x2ZXIvY29tbW9uL2NvbmZpZ3VyYXRpb25SZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBJSGlzdG9yeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9oaXN0b3J5L2NvbW1vbi9oaXN0b3J5LmpzJztcbmltcG9ydCB7IElSZW1vdGVBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJU3RhdHVzYmFyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3N0YXR1c2Jhci9icm93c2VyL3N0YXR1c2Jhci5qcyc7XG5cbmV4cG9ydCBjbGFzcyBSZW1vdGVUZXJtaW5hbEJhY2tlbmRDb250cmlidXRpb24gaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblx0c3RhdGljIElEID0gJ3JlbW90ZVRlcm1pbmFsQmFja2VuZCc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJUmVtb3RlQWdlbnRTZXJ2aWNlIHJlbW90ZUFnZW50U2VydmljZTogSVJlbW90ZUFnZW50U2VydmljZSxcblx0XHRASVRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlIHRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlOiBJVGVybWluYWxJbnN0YW5jZVNlcnZpY2Vcblx0KSB7XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IHJlbW90ZUFnZW50U2VydmljZS5nZXRDb25uZWN0aW9uKCk7XG5cdFx0aWYgKGNvbm5lY3Rpb24/LnJlbW90ZUF1dGhvcml0eSkge1xuXHRcdFx0Y29uc3QgY2hhbm5lbCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlbW90ZVRlcm1pbmFsQ2hhbm5lbENsaWVudCwgY29ubmVjdGlvbi5yZW1vdGVBdXRob3JpdHksIGNvbm5lY3Rpb24uZ2V0Q2hhbm5lbChSRU1PVEVfVEVSTUlOQUxfQ0hBTk5FTF9OQU1FKSk7XG5cdFx0XHRjb25zdCBiYWNrZW5kID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVtb3RlVGVybWluYWxCYWNrZW5kLCBjb25uZWN0aW9uLnJlbW90ZUF1dGhvcml0eSwgY2hhbm5lbCk7XG5cdFx0XHRSZWdpc3RyeS5hczxJVGVybWluYWxCYWNrZW5kUmVnaXN0cnk+KFRlcm1pbmFsRXh0ZW5zaW9ucy5CYWNrZW5kKS5yZWdpc3RlclRlcm1pbmFsQmFja2VuZChiYWNrZW5kKTtcblx0XHRcdHRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlLmRpZFJlZ2lzdGVyQmFja2VuZChiYWNrZW5kKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgUmVtb3RlVGVybWluYWxCYWNrZW5kIGV4dGVuZHMgQmFzZVRlcm1pbmFsQmFja2VuZCBpbXBsZW1lbnRzIElUZXJtaW5hbEJhY2tlbmQge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wdHlzOiBNYXA8bnVtYmVyLCBSZW1vdGVQdHk+ID0gbmV3IE1hcCgpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3doZW5Db25uZWN0ZWQgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cdGdldCB3aGVuUmVhZHkoKTogUHJvbWlzZTx2b2lkPiB7IHJldHVybiB0aGlzLl93aGVuQ29ubmVjdGVkLnA7IH1cblx0c2V0UmVhZHkoKTogdm9pZCB7IHRoaXMuX3doZW5Db25uZWN0ZWQuY29tcGxldGUoKTsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUmVxdWVzdERldGFjaCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgcmVxdWVzdElkOiBudW1iZXI7IHdvcmtzcGFjZUlkOiBzdHJpbmc7IGluc3RhbmNlSWQ6IG51bWJlciB9PigpKTtcblx0cmVhZG9ubHkgb25EaWRSZXF1ZXN0RGV0YWNoID0gdGhpcy5fb25EaWRSZXF1ZXN0RGV0YWNoLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vblJlc3RvcmVDb21tYW5kcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgaWQ6IG51bWJlcjsgY29tbWFuZHM6IElTZXJpYWxpemVkVGVybWluYWxDb21tYW5kW10gfT4oKSk7XG5cdHJlYWRvbmx5IG9uUmVzdG9yZUNvbW1hbmRzID0gdGhpcy5fb25SZXN0b3JlQ29tbWFuZHMuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgcmVtb3RlQXV0aG9yaXR5OiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcmVtb3RlVGVybWluYWxDaGFubmVsOiBSZW1vdGVUZXJtaW5hbENoYW5uZWxDbGllbnQsXG5cdFx0QElSZW1vdGVBZ2VudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcmVtb3RlQWdlbnRTZXJ2aWNlOiBJUmVtb3RlQWdlbnRTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVRlcm1pbmFsTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJVGVybWluYWxMb2dTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3N0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElSZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlOiBJUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2Ugd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UgY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZTogSUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UsXG5cdFx0QElIaXN0b3J5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9oaXN0b3J5U2VydmljZTogSUhpc3RvcnlTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVN0YXR1c2JhclNlcnZpY2Ugc3RhdHVzQmFyU2VydmljZTogSVN0YXR1c2JhclNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoX3JlbW90ZVRlcm1pbmFsQ2hhbm5lbCwgbG9nU2VydmljZSwgX2hpc3RvcnlTZXJ2aWNlLCBjb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlLCBzdGF0dXNCYXJTZXJ2aWNlLCB3b3Jrc3BhY2VDb250ZXh0U2VydmljZSk7XG5cblx0XHR0aGlzLl9yZW1vdGVUZXJtaW5hbENoYW5uZWwub25Qcm9jZXNzRGF0YShlID0+IHRoaXMuX3B0eXMuZ2V0KGUuaWQpPy5oYW5kbGVEYXRhKGUuZXZlbnQpKTtcblx0XHR0aGlzLl9yZW1vdGVUZXJtaW5hbENoYW5uZWwub25Qcm9jZXNzUmVwbGF5KGUgPT4ge1xuXHRcdFx0dGhpcy5fcHR5cy5nZXQoZS5pZCk/LmhhbmRsZVJlcGxheShlLmV2ZW50KTtcblx0XHRcdGlmIChlLmV2ZW50LmNvbW1hbmRzLmNvbW1hbmRzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0dGhpcy5fb25SZXN0b3JlQ29tbWFuZHMuZmlyZSh7IGlkOiBlLmlkLCBjb21tYW5kczogZS5ldmVudC5jb21tYW5kcy5jb21tYW5kcyB9KTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLl9yZW1vdGVUZXJtaW5hbENoYW5uZWwub25Qcm9jZXNzT3JwaGFuUXVlc3Rpb24oZSA9PiB0aGlzLl9wdHlzLmdldChlLmlkKT8uaGFuZGxlT3JwaGFuUXVlc3Rpb24oKSk7XG5cdFx0dGhpcy5fcmVtb3RlVGVybWluYWxDaGFubmVsLm9uRGlkUmVxdWVzdERldGFjaChlID0+IHRoaXMuX29uRGlkUmVxdWVzdERldGFjaC5maXJlKGUpKTtcblx0XHR0aGlzLl9yZW1vdGVUZXJtaW5hbENoYW5uZWwub25Qcm9jZXNzUmVhZHkoZSA9PiB0aGlzLl9wdHlzLmdldChlLmlkKT8uaGFuZGxlUmVhZHkoZS5ldmVudCkpO1xuXHRcdHRoaXMuX3JlbW90ZVRlcm1pbmFsQ2hhbm5lbC5vbkRpZENoYW5nZVByb3BlcnR5KGUgPT4gdGhpcy5fcHR5cy5nZXQoZS5pZCk/LmhhbmRsZURpZENoYW5nZVByb3BlcnR5KGUucHJvcGVydHkpKTtcblx0XHR0aGlzLl9yZW1vdGVUZXJtaW5hbENoYW5uZWwub25Qcm9jZXNzRXhpdChlID0+IHtcblx0XHRcdGNvbnN0IHB0eSA9IHRoaXMuX3B0eXMuZ2V0KGUuaWQpO1xuXHRcdFx0aWYgKHB0eSkge1xuXHRcdFx0XHRwdHkuaGFuZGxlRXhpdChlLmV2ZW50KTtcblx0XHRcdFx0dGhpcy5fcHR5cy5kZWxldGUoZS5pZCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBhbGxvd2VkQ29tbWFuZHMgPSBbJ19yZW1vdGVDTEkub3BlbkV4dGVybmFsJywgJ19yZW1vdGVDTEkud2luZG93T3BlbicsICdfcmVtb3RlQ0xJLmdldFN5c3RlbVN0YXR1cycsICdfcmVtb3RlQ0xJLm1hbmFnZUV4dGVuc2lvbnMnXTtcblx0XHR0aGlzLl9yZW1vdGVUZXJtaW5hbENoYW5uZWwub25FeGVjdXRlQ29tbWFuZChhc3luYyBlID0+IHtcblx0XHRcdC8vIEVuc3VyZSB0aGlzIHJlcXVlc3QgZm9yIGZvciB0aGlzIHdpbmRvd1xuXHRcdFx0Y29uc3QgcHR5ID0gdGhpcy5fcHR5cy5nZXQoZS5wZXJzaXN0ZW50UHJvY2Vzc0lkKTtcblx0XHRcdGlmICghcHR5KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHJlcUlkID0gZS5yZXFJZDtcblx0XHRcdGNvbnN0IGNvbW1hbmRJZCA9IGUuY29tbWFuZElkO1xuXHRcdFx0aWYgKCFhbGxvd2VkQ29tbWFuZHMuaW5jbHVkZXMoY29tbWFuZElkKSkge1xuXHRcdFx0XHR0aGlzLl9yZW1vdGVUZXJtaW5hbENoYW5uZWwuc2VuZENvbW1hbmRSZXN1bHQocmVxSWQsIHRydWUsICdJbnZhbGlkIHJlbW90ZSBjbGkgY29tbWFuZDogJyArIGNvbW1hbmRJZCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGNvbW1hbmRBcmdzID0gZS5jb21tYW5kQXJncy5tYXAoYXJnID0+IHJldml2ZShhcmcpKTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGUuY29tbWFuZElkLCAuLi5jb21tYW5kQXJncyk7XG5cdFx0XHRcdHRoaXMuX3JlbW90ZVRlcm1pbmFsQ2hhbm5lbC5zZW5kQ29tbWFuZFJlc3VsdChyZXFJZCwgZmFsc2UsIHJlc3VsdCk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0dGhpcy5fcmVtb3RlVGVybWluYWxDaGFubmVsLnNlbmRDb21tYW5kUmVzdWx0KHJlcUlkLCB0cnVlLCBlcnIpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5fb25QdHlIb3N0Q29ubmVjdGVkLmZpcmUoKTtcblx0fVxuXG5cdGFzeW5jIHJlcXVlc3REZXRhY2hJbnN0YW5jZSh3b3Jrc3BhY2VJZDogc3RyaW5nLCBpbnN0YW5jZUlkOiBudW1iZXIpOiBQcm9taXNlPElQcm9jZXNzRGV0YWlscyB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICghdGhpcy5fcmVtb3RlVGVybWluYWxDaGFubmVsKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCByZXF1ZXN0IGRldGFjaCBpbnN0YW5jZSB3aGVuIHRoZXJlIGlzIG5vIHJlbW90ZSFgKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3JlbW90ZVRlcm1pbmFsQ2hhbm5lbC5yZXF1ZXN0RGV0YWNoSW5zdGFuY2Uod29ya3NwYWNlSWQsIGluc3RhbmNlSWQpO1xuXHR9XG5cblx0YXN5bmMgYWNjZXB0RGV0YWNoSW5zdGFuY2VSZXBseShyZXF1ZXN0SWQ6IG51bWJlciwgcGVyc2lzdGVudFByb2Nlc3NJZD86IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5fcmVtb3RlVGVybWluYWxDaGFubmVsKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBhY2NlcHQgZGV0YWNoZWQgaW5zdGFuY2Ugd2hlbiB0aGVyZSBpcyBubyByZW1vdGUhYCk7XG5cdFx0fSBlbHNlIGlmICghcGVyc2lzdGVudFByb2Nlc3NJZCkge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS53YXJuKCdDYW5ub3QgYXR0YWNoIHRvIGZlYXR1cmUgdGVybWluYWxzLCBjdXN0b20gcHR5IHRlcm1pbmFscywgb3IgdGhvc2Ugd2l0aG91dCBhIHBlcnNpc3RlbnRQcm9jZXNzSWQnKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fcmVtb3RlVGVybWluYWxDaGFubmVsLmFjY2VwdERldGFjaEluc3RhbmNlUmVwbHkocmVxdWVzdElkLCBwZXJzaXN0ZW50UHJvY2Vzc0lkKTtcblx0fVxuXG5cdGFzeW5jIHBlcnNpc3RUZXJtaW5hbFN0YXRlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5fcmVtb3RlVGVybWluYWxDaGFubmVsKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBwZXJzaXN0IHRlcm1pbmFsIHN0YXRlIHdoZW4gdGhlcmUgaXMgbm8gcmVtb3RlIWApO1xuXHRcdH1cblx0XHRjb25zdCBpZHMgPSBBcnJheS5mcm9tKHRoaXMuX3B0eXMua2V5cygpKTtcblx0XHRjb25zdCBzZXJpYWxpemVkID0gYXdhaXQgdGhpcy5fcmVtb3RlVGVybWluYWxDaGFubmVsLnNlcmlhbGl6ZVRlcm1pbmFsU3RhdGUoaWRzKTtcblx0XHR0aGlzLl9zdG9yYWdlU2VydmljZS5zdG9yZShUZXJtaW5hbFN0b3JhZ2VLZXlzLlRlcm1pbmFsQnVmZmVyU3RhdGUsIHNlcmlhbGl6ZWQsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdH1cblxuXHRhc3luYyBjcmVhdGVQcm9jZXNzKFxuXHRcdHNoZWxsTGF1bmNoQ29uZmlnOiBJU2hlbGxMYXVuY2hDb25maWcsXG5cdFx0Y3dkOiBzdHJpbmcsIC8vIFRPRE86IFRoaXMgaXMgaWdub3JlZFxuXHRcdGNvbHM6IG51bWJlcixcblx0XHRyb3dzOiBudW1iZXIsXG5cdFx0dW5pY29kZVZlcnNpb246ICc2JyB8ICcxMScsXG5cdFx0ZW52OiBJUHJvY2Vzc0Vudmlyb25tZW50LCAvLyBUT0RPOiBUaGlzIGlzIGlnbm9yZWRcblx0XHRvcHRpb25zOiBJVGVybWluYWxQcm9jZXNzT3B0aW9ucyxcblx0XHRzaG91bGRQZXJzaXN0OiBib29sZWFuXG5cdCk6IFByb21pc2U8SVRlcm1pbmFsQ2hpbGRQcm9jZXNzPiB7XG5cdFx0aWYgKCF0aGlzLl9yZW1vdGVUZXJtaW5hbENoYW5uZWwpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgQ2Fubm90IGNyZWF0ZSByZW1vdGUgdGVybWluYWwgd2hlbiB0aGVyZSBpcyBubyByZW1vdGUhYCk7XG5cdFx0fVxuXG5cdFx0Ly8gRmV0Y2ggdGhlIGVudmlyb25tZW50IHRvIGNoZWNrIHNoZWxsIHBlcm1pc3Npb25zXG5cdFx0Y29uc3QgcmVtb3RlRW52ID0gYXdhaXQgdGhpcy5fcmVtb3RlQWdlbnRTZXJ2aWNlLmdldEVudmlyb25tZW50KCk7XG5cdFx0aWYgKCFyZW1vdGVFbnYpIHtcblx0XHRcdC8vIEV4dGVuc2lvbiBob3N0IHByb2Nlc3NlcyBhcmUgb25seSBhbGxvd2VkIGluIHJlbW90ZSBleHRlbnNpb24gaG9zdHMgY3VycmVudGx5XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmZXRjaCByZW1vdGUgZW52aXJvbm1lbnQnKTtcblx0XHR9XG5cblx0XHRjb25zdCB0ZXJtaW5hbENvbmZpZyA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElUZXJtaW5hbENvbmZpZ3VyYXRpb24+KFRFUk1JTkFMX0NPTkZJR19TRUNUSU9OKTtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uOiBJQ29tcGxldGVUZXJtaW5hbENvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHQndGVybWluYWwuaW50ZWdyYXRlZC5lbnYud2luZG93cyc6IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlcm1pbmFsU2V0dGluZ0lkLkVudldpbmRvd3MpIGFzIElUZXJtaW5hbEVudmlyb25tZW50LFxuXHRcdFx0J3Rlcm1pbmFsLmludGVncmF0ZWQuZW52Lm9zeCc6IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlcm1pbmFsU2V0dGluZ0lkLkVudk1hY09zKSBhcyBJVGVybWluYWxFbnZpcm9ubWVudCxcblx0XHRcdCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmVudi5saW51eCc6IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlcm1pbmFsU2V0dGluZ0lkLkVudkxpbnV4KSBhcyBJVGVybWluYWxFbnZpcm9ubWVudCxcblx0XHRcdCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmN3ZCc6IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlcm1pbmFsU2V0dGluZ0lkLkN3ZCkgYXMgc3RyaW5nLFxuXHRcdFx0J3Rlcm1pbmFsLmludGVncmF0ZWQuZGV0ZWN0TG9jYWxlJzogdGVybWluYWxDb25maWcuZGV0ZWN0TG9jYWxlXG5cdFx0fTtcblxuXHRcdGNvbnN0IHNoZWxsTGF1bmNoQ29uZmlnRHRvOiBJU2hlbGxMYXVuY2hDb25maWdEdG8gPSB7XG5cdFx0XHRuYW1lOiBzaGVsbExhdW5jaENvbmZpZy5uYW1lLFxuXHRcdFx0ZXhlY3V0YWJsZTogc2hlbGxMYXVuY2hDb25maWcuZXhlY3V0YWJsZSxcblx0XHRcdGFyZ3M6IHNoZWxsTGF1bmNoQ29uZmlnLmFyZ3MsXG5cdFx0XHRjd2Q6IHNoZWxsTGF1bmNoQ29uZmlnLmN3ZCxcblx0XHRcdGVudjogc2hlbGxMYXVuY2hDb25maWcuZW52LFxuXHRcdFx0dXNlU2hlbGxFbnZpcm9ubWVudDogc2hlbGxMYXVuY2hDb25maWcudXNlU2hlbGxFbnZpcm9ubWVudCxcblx0XHRcdHJlY29ubmVjdGlvblByb3BlcnRpZXM6IHNoZWxsTGF1bmNoQ29uZmlnLnJlY29ubmVjdGlvblByb3BlcnRpZXMsXG5cdFx0XHR0eXBlOiBzaGVsbExhdW5jaENvbmZpZy50eXBlLFxuXHRcdFx0aXNGZWF0dXJlVGVybWluYWw6IHNoZWxsTGF1bmNoQ29uZmlnLmlzRmVhdHVyZVRlcm1pbmFsLFxuXHRcdFx0dGFiQWN0aW9uczogc2hlbGxMYXVuY2hDb25maWcudGFiQWN0aW9ucyxcblx0XHRcdHNoZWxsSW50ZWdyYXRpb25FbnZpcm9ubWVudFJlcG9ydGluZzogc2hlbGxMYXVuY2hDb25maWcuc2hlbGxJbnRlZ3JhdGlvbkVudmlyb25tZW50UmVwb3J0aW5nLFxuXHRcdH07XG5cdFx0Y29uc3QgYWN0aXZlV29ya3NwYWNlUm9vdFVyaSA9IHRoaXMuX2hpc3RvcnlTZXJ2aWNlLmdldExhc3RBY3RpdmVXb3Jrc3BhY2VSb290KCk7XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLl9yZW1vdGVUZXJtaW5hbENoYW5uZWwuY3JlYXRlUHJvY2Vzcyhcblx0XHRcdHNoZWxsTGF1bmNoQ29uZmlnRHRvLFxuXHRcdFx0Y29uZmlndXJhdGlvbixcblx0XHRcdGFjdGl2ZVdvcmtzcGFjZVJvb3RVcmksXG5cdFx0XHRvcHRpb25zLFxuXHRcdFx0c2hvdWxkUGVyc2lzdCxcblx0XHRcdGNvbHMsXG5cdFx0XHRyb3dzLFxuXHRcdFx0dW5pY29kZVZlcnNpb25cblx0XHQpO1xuXHRcdGNvbnN0IHB0eSA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlbW90ZVB0eSwgcmVzdWx0LnBlcnNpc3RlbnRUZXJtaW5hbElkLCBzaG91bGRQZXJzaXN0LCB0aGlzLl9yZW1vdGVUZXJtaW5hbENoYW5uZWwpO1xuXHRcdHRoaXMuX3B0eXMuc2V0KHJlc3VsdC5wZXJzaXN0ZW50VGVybWluYWxJZCwgcHR5KTtcblx0XHRyZXR1cm4gcHR5O1xuXHR9XG5cblx0YXN5bmMgYXR0YWNoVG9Qcm9jZXNzKGlkOiBudW1iZXIpOiBQcm9taXNlPElUZXJtaW5hbENoaWxkUHJvY2VzcyB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICghdGhpcy5fcmVtb3RlVGVybWluYWxDaGFubmVsKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBjcmVhdGUgcmVtb3RlIHRlcm1pbmFsIHdoZW4gdGhlcmUgaXMgbm8gcmVtb3RlIWApO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLl9yZW1vdGVUZXJtaW5hbENoYW5uZWwuYXR0YWNoVG9Qcm9jZXNzKGlkKTtcblx0XHRcdGNvbnN0IHB0eSA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlbW90ZVB0eSwgaWQsIHRydWUsIHRoaXMuX3JlbW90ZVRlcm1pbmFsQ2hhbm5lbCk7XG5cdFx0XHR0aGlzLl9wdHlzLnNldChpZCwgcHR5KTtcblx0XHRcdHJldHVybiBwdHk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZShgQ291bGRuJ3QgYXR0YWNoIHRvIHByb2Nlc3MgJHtlLm1lc3NhZ2V9YCk7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRhc3luYyBhdHRhY2hUb1Jldml2ZWRQcm9jZXNzKGlkOiBudW1iZXIpOiBQcm9taXNlPElUZXJtaW5hbENoaWxkUHJvY2VzcyB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICghdGhpcy5fcmVtb3RlVGVybWluYWxDaGFubmVsKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBjcmVhdGUgcmVtb3RlIHRlcm1pbmFsIHdoZW4gdGhlcmUgaXMgbm8gcmVtb3RlIWApO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBuZXdJZCA9IGF3YWl0IHRoaXMuX3JlbW90ZVRlcm1pbmFsQ2hhbm5lbC5nZXRSZXZpdmVkUHR5TmV3SWQoaWQpID8/IGlkO1xuXHRcdFx0cmV0dXJuIGF3YWl0IHRoaXMuYXR0YWNoVG9Qcm9jZXNzKG5ld0lkKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBDb3VsZG4ndCBhdHRhY2ggdG8gcHJvY2VzcyAke2UubWVzc2FnZX1gKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGFzeW5jIGxpc3RQcm9jZXNzZXMoKTogUHJvbWlzZTxJUHJvY2Vzc0RldGFpbHNbXT4ge1xuXHRcdHJldHVybiB0aGlzLl9yZW1vdGVUZXJtaW5hbENoYW5uZWwubGlzdFByb2Nlc3NlcygpO1xuXHR9XG5cblx0YXN5bmMgZ2V0TGF0ZW5jeSgpOiBQcm9taXNlPElQdHlIb3N0TGF0ZW5jeU1lYXN1cmVtZW50W10+IHtcblx0XHRjb25zdCBzdyA9IG5ldyBTdG9wV2F0Y2goKTtcblx0XHRjb25zdCByZXN1bHRzID0gYXdhaXQgdGhpcy5fcmVtb3RlVGVybWluYWxDaGFubmVsLmdldExhdGVuY3koKTtcblx0XHRzdy5zdG9wKCk7XG5cdFx0cmV0dXJuIFtcblx0XHRcdHtcblx0XHRcdFx0bGFiZWw6ICd3aW5kb3c8LT5wdHlob3N0c2VydmljZTwtPnB0eWhvc3QnLFxuXHRcdFx0XHRsYXRlbmN5OiBzdy5lbGFwc2VkKClcblx0XHRcdH0sXG5cdFx0XHQuLi5yZXN1bHRzXG5cdFx0XTtcblx0fVxuXG5cdGFzeW5jIHVwZGF0ZVByb3BlcnR5PFQgZXh0ZW5kcyBQcm9jZXNzUHJvcGVydHlUeXBlPihpZDogbnVtYmVyLCBwcm9wZXJ0eTogVCwgdmFsdWU6IGFueSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuX3JlbW90ZVRlcm1pbmFsQ2hhbm5lbC51cGRhdGVQcm9wZXJ0eShpZCwgcHJvcGVydHksIHZhbHVlKTtcblx0fVxuXG5cdGFzeW5jIHVwZGF0ZVRpdGxlKGlkOiBudW1iZXIsIHRpdGxlOiBzdHJpbmcsIHRpdGxlU291cmNlOiBUaXRsZUV2ZW50U291cmNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5fcmVtb3RlVGVybWluYWxDaGFubmVsLnVwZGF0ZVRpdGxlKGlkLCB0aXRsZSwgdGl0bGVTb3VyY2UpO1xuXHR9XG5cblx0YXN5bmMgdXBkYXRlSWNvbihpZDogbnVtYmVyLCB1c2VySW5pdGlhdGVkOiBib29sZWFuLCBpY29uOiBUZXJtaW5hbEljb24sIGNvbG9yPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5fcmVtb3RlVGVybWluYWxDaGFubmVsLnVwZGF0ZUljb24oaWQsIHVzZXJJbml0aWF0ZWQsIGljb24sIGNvbG9yKTtcblx0fVxuXG5cdGFzeW5jIGdldERlZmF1bHRTeXN0ZW1TaGVsbChvc092ZXJyaWRlPzogT3BlcmF0aW5nU3lzdGVtKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRyZXR1cm4gdGhpcy5fcmVtb3RlVGVybWluYWxDaGFubmVsLmdldERlZmF1bHRTeXN0ZW1TaGVsbChvc092ZXJyaWRlKSB8fCAnJztcblx0fVxuXG5cdGFzeW5jIGdldFByb2ZpbGVzKHByb2ZpbGVzOiB1bmtub3duLCBkZWZhdWx0UHJvZmlsZTogdW5rbm93biwgaW5jbHVkZURldGVjdGVkUHJvZmlsZXM/OiBib29sZWFuKTogUHJvbWlzZTxJVGVybWluYWxQcm9maWxlW10+IHtcblx0XHRyZXR1cm4gdGhpcy5fcmVtb3RlVGVybWluYWxDaGFubmVsLmdldFByb2ZpbGVzKHByb2ZpbGVzLCBkZWZhdWx0UHJvZmlsZSwgaW5jbHVkZURldGVjdGVkUHJvZmlsZXMpIHx8IFtdO1xuXHR9XG5cblx0YXN5bmMgZ2V0RW52aXJvbm1lbnQoKTogUHJvbWlzZTxJUHJvY2Vzc0Vudmlyb25tZW50PiB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlbW90ZVRlcm1pbmFsQ2hhbm5lbC5nZXRFbnZpcm9ubWVudCgpIHx8IHt9O1xuXHR9XG5cblx0YXN5bmMgZ2V0U2hlbGxFbnZpcm9ubWVudCgpOiBQcm9taXNlPElQcm9jZXNzRW52aXJvbm1lbnQgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gdGhpcy5fcmVtb3RlQWdlbnRTZXJ2aWNlLmdldENvbm5lY3Rpb24oKTtcblx0XHRpZiAoIWNvbm5lY3Rpb24pIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IHJlc29sdmVyUmVzdWx0ID0gYXdhaXQgdGhpcy5fcmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlLnJlc29sdmVBdXRob3JpdHkoY29ubmVjdGlvbi5yZW1vdGVBdXRob3JpdHkpO1xuXHRcdHJldHVybiByZXNvbHZlclJlc3VsdC5vcHRpb25zPy5leHRlbnNpb25Ib3N0RW52IGFzIGFueTtcblx0fVxuXG5cdGFzeW5jIGdldFdzbFBhdGgob3JpZ2luYWw6IHN0cmluZywgZGlyZWN0aW9uOiAndW5peC10by13aW4nIHwgJ3dpbi10by11bml4Jyk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0Y29uc3QgZW52ID0gYXdhaXQgdGhpcy5fcmVtb3RlQWdlbnRTZXJ2aWNlLmdldEVudmlyb25tZW50KCk7XG5cdFx0aWYgKGVudj8ub3MgIT09IE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzKSB7XG5cdFx0XHRyZXR1cm4gb3JpZ2luYWw7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9yZW1vdGVUZXJtaW5hbENoYW5uZWwuZ2V0V3NsUGF0aChvcmlnaW5hbCwgZGlyZWN0aW9uKSB8fCBvcmlnaW5hbDtcblx0fVxuXG5cdGFzeW5jIHNldFRlcm1pbmFsTGF5b3V0SW5mbyhsYXlvdXQ/OiBJVGVybWluYWxzTGF5b3V0SW5mb0J5SWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuX3JlbW90ZVRlcm1pbmFsQ2hhbm5lbCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBDYW5ub3QgY2FsbCBzZXRBY3RpdmVJbnN0YW5jZUlkIHdoZW4gdGhlcmUgaXMgbm8gcmVtb3RlYCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3JlbW90ZVRlcm1pbmFsQ2hhbm5lbC5zZXRUZXJtaW5hbExheW91dEluZm8obGF5b3V0KTtcblx0fVxuXG5cdGFzeW5jIHJlZHVjZUNvbm5lY3Rpb25HcmFjZVRpbWUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLl9yZW1vdGVUZXJtaW5hbENoYW5uZWwpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IHJlZHVjZSBncmFjZSB0aW1lIHdoZW4gdGhlcmUgaXMgbm8gcmVtb3RlJyk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9yZW1vdGVUZXJtaW5hbENoYW5uZWwucmVkdWNlQ29ubmVjdGlvbkdyYWNlVGltZSgpO1xuXHR9XG5cblx0YXN5bmMgZ2V0VGVybWluYWxMYXlvdXRJbmZvKCk6IFByb21pc2U8SVRlcm1pbmFsc0xheW91dEluZm8gfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXRoaXMuX3JlbW90ZVRlcm1pbmFsQ2hhbm5lbCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBDYW5ub3QgY2FsbCBnZXRBY3RpdmVJbnN0YW5jZUlkIHdoZW4gdGhlcmUgaXMgbm8gcmVtb3RlYCk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgd29ya3NwYWNlSWQgPSB0aGlzLl9nZXRXb3Jrc3BhY2VJZCgpO1xuXG5cdFx0Ly8gUmV2aXZlIHByb2Nlc3NlcyBpZiBuZWVkZWRcblx0XHRjb25zdCBzZXJpYWxpemVkU3RhdGUgPSB0aGlzLl9zdG9yYWdlU2VydmljZS5nZXQoVGVybWluYWxTdG9yYWdlS2V5cy5UZXJtaW5hbEJ1ZmZlclN0YXRlLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKTtcblx0XHRjb25zdCByZXZpdmVCdWZmZXJTdGF0ZSA9IHRoaXMuX2Rlc2VyaWFsaXplVGVybWluYWxTdGF0ZShzZXJpYWxpemVkU3RhdGUpO1xuXHRcdGlmIChyZXZpdmVCdWZmZXJTdGF0ZSAmJiByZXZpdmVCdWZmZXJTdGF0ZS5sZW5ndGggPiAwKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHQvLyBOb3RlIHRoYXQgcmVtb3RlIHRlcm1pbmFscyBkbyBub3QgZ2V0IHRoZWlyIGVudmlyb25tZW50IHJlLXJlc29sdmVkIHVubGlrZSBpbiBsb2NhbCB0ZXJtaW5hbHNcblxuXHRcdFx0XHRtYXJrKCdjb2RlL3Rlcm1pbmFsL3dpbGxSZXZpdmVUZXJtaW5hbFByb2Nlc3Nlc1JlbW90ZScpO1xuXHRcdFx0XHRhd2FpdCB0aGlzLl9yZW1vdGVUZXJtaW5hbENoYW5uZWwucmV2aXZlVGVybWluYWxQcm9jZXNzZXMod29ya3NwYWNlSWQsIHJldml2ZUJ1ZmZlclN0YXRlLCBJbnRsLkRhdGVUaW1lRm9ybWF0KCkucmVzb2x2ZWRPcHRpb25zKCkubG9jYWxlKTtcblx0XHRcdFx0bWFyaygnY29kZS90ZXJtaW5hbC9kaWRSZXZpdmVUZXJtaW5hbFByb2Nlc3Nlc1JlbW90ZScpO1xuXHRcdFx0XHR0aGlzLl9zdG9yYWdlU2VydmljZS5yZW1vdmUoVGVybWluYWxTdG9yYWdlS2V5cy5UZXJtaW5hbEJ1ZmZlclN0YXRlLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKTtcblx0XHRcdFx0Ly8gSWYgcmV2aXZpbmcgcHJvY2Vzc2VzLCBzZW5kIHRoZSB0ZXJtaW5hbCBsYXlvdXQgaW5mbyBiYWNrIHRvIHRoZSBwdHkgaG9zdCBhcyBpdFxuXHRcdFx0XHQvLyB3aWxsIG5vdCBoYXZlIGJlZW4gcGVyc2lzdGVkIG9uIGFwcGxpY2F0aW9uIGV4aXRcblx0XHRcdFx0Y29uc3QgbGF5b3V0SW5mbyA9IHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLmdldChUZXJtaW5hbFN0b3JhZ2VLZXlzLlRlcm1pbmFsTGF5b3V0SW5mbywgU3RvcmFnZVNjb3BlLldPUktTUEFDRSk7XG5cdFx0XHRcdGlmIChsYXlvdXRJbmZvKSB7XG5cdFx0XHRcdFx0bWFyaygnY29kZS90ZXJtaW5hbC93aWxsU2V0VGVybWluYWxMYXlvdXRJbmZvUmVtb3RlJyk7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5fcmVtb3RlVGVybWluYWxDaGFubmVsLnNldFRlcm1pbmFsTGF5b3V0SW5mbyhKU09OLnBhcnNlKGxheW91dEluZm8pKTtcblx0XHRcdFx0XHRtYXJrKCdjb2RlL3Rlcm1pbmFsL2RpZFNldFRlcm1pbmFsTGF5b3V0SW5mb1JlbW90ZScpO1xuXHRcdFx0XHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnJlbW92ZShUZXJtaW5hbFN0b3JhZ2VLZXlzLlRlcm1pbmFsTGF5b3V0SW5mbywgU3RvcmFnZVNjb3BlLldPUktTUEFDRSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGU6IHVua25vd24pIHtcblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS53YXJuKCdSZW1vdGVUZXJtaW5hbEJhY2tlbmQjZ2V0VGVybWluYWxMYXlvdXRJbmZvIEVycm9yJywgZSAmJiB0eXBlb2YgZSA9PT0gJ29iamVjdCcgJiYgJ21lc3NhZ2UnIGluIGUgPyBlLm1lc3NhZ2UgOiBlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fcmVtb3RlVGVybWluYWxDaGFubmVsLmdldFRlcm1pbmFsTGF5b3V0SW5mbygpO1xuXHR9XG5cblx0YXN5bmMgZ2V0UGVyZm9ybWFuY2VNYXJrcygpOiBQcm9taXNlPFBlcmZvcm1hbmNlTWFya1tdPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlbW90ZVRlcm1pbmFsQ2hhbm5lbC5nZXRQZXJmb3JtYW5jZU1hcmtzKCk7XG5cdH1cblxuXHRpbnN0YWxsQXV0b1JlcGx5KG1hdGNoOiBzdHJpbmcsIHJlcGx5OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fcmVtb3RlVGVybWluYWxDaGFubmVsLmluc3RhbGxBdXRvUmVwbHkobWF0Y2gsIHJlcGx5KTtcblx0fVxuXG5cdHVuaW5zdGFsbEFsbEF1dG9SZXBsaWVzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl9yZW1vdGVUZXJtaW5hbENoYW5uZWwudW5pbnN0YWxsQWxsQXV0b1JlcGxpZXMoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxjQUFjO0FBQ3ZCLFNBQTBCLFlBQVk7QUFDdEMsU0FBOEIsdUJBQXVCO0FBQ3JELFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsdUNBQXVDO0FBQ2hELFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBRTdELFNBQXlLLHFCQUFxSSxvQkFBa0MseUJBQTJDO0FBRTNYLFNBQVMsZ0NBQWdDO0FBRXpDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsNkJBQTZCLG9DQUFvQztBQUMxRSxTQUFpRSwrQkFBK0I7QUFDaEcsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUyx1QkFBdUI7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
