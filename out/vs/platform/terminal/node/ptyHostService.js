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
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { OS, isWindows } from "../../../base/common/platform.js";
import { ProxyChannel } from "../../../base/parts/ipc/common/ipc.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { ILogService, ILoggerService, LogLevel } from "../../log/common/log.js";
import { RemoteLoggerChannelClient } from "../../log/common/logIpc.js";
import { getResolvedShellEnv } from "../../shell/node/shellEnv.js";
import { RequestStore } from "../common/requestStore.js";
import { HeartbeatConstants, TerminalIpcChannels, TerminalSettingId } from "../common/terminal.js";
import { registerTerminalPlatformConfiguration } from "../common/terminalPlatformConfiguration.js";
import { detectAvailableProfiles } from "./terminalProfiles.js";
import { getSystemShell } from "../../../base/node/shell.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["MaxRestarts"] = 5] = "MaxRestarts";
  return Constants2;
})(Constants || {});
let PtyHostService = class extends Disposable {
  constructor(_ptyHostStarter, _configurationService, _logService, _loggerService) {
    super();
    this._ptyHostStarter = _ptyHostStarter;
    this._configurationService = _configurationService;
    this._logService = _logService;
    this._loggerService = _loggerService;
    this._wasQuitRequested = false;
    this._restartCount = 0;
    this._isResponsive = true;
    this._onPtyHostExit = this._register(new Emitter());
    this.onPtyHostExit = this._onPtyHostExit.event;
    this._onPtyHostStart = this._register(new Emitter());
    this.onPtyHostStart = this._onPtyHostStart.event;
    this._onPtyHostUnresponsive = this._register(new Emitter());
    this.onPtyHostUnresponsive = this._onPtyHostUnresponsive.event;
    this._onPtyHostResponsive = this._register(new Emitter());
    this.onPtyHostResponsive = this._onPtyHostResponsive.event;
    this._onPtyHostRequestResolveVariables = this._register(new Emitter());
    this.onPtyHostRequestResolveVariables = this._onPtyHostRequestResolveVariables.event;
    this._onProcessData = this._register(new Emitter());
    this.onProcessData = this._onProcessData.event;
    this._onProcessReady = this._register(new Emitter());
    this.onProcessReady = this._onProcessReady.event;
    this._onProcessReplay = this._register(new Emitter());
    this.onProcessReplay = this._onProcessReplay.event;
    this._onProcessOrphanQuestion = this._register(new Emitter());
    this.onProcessOrphanQuestion = this._onProcessOrphanQuestion.event;
    this._onDidRequestDetach = this._register(new Emitter());
    this.onDidRequestDetach = this._onDidRequestDetach.event;
    this._onDidChangeProperty = this._register(new Emitter());
    this.onDidChangeProperty = this._onDidChangeProperty.event;
    this._onProcessExit = this._register(new Emitter());
    this.onProcessExit = this._onProcessExit.event;
    registerTerminalPlatformConfiguration();
    this._register(this._ptyHostStarter);
    this._register(toDisposable(() => this._disposePtyHost()));
    this._resolveVariablesRequestStore = this._register(new RequestStore(void 0, this._logService));
    this._register(this._resolveVariablesRequestStore.onCreateRequest(this._onPtyHostRequestResolveVariables.fire, this._onPtyHostRequestResolveVariables));
    if (this._ptyHostStarter.onRequestConnection) {
      this._register(Event.once(this._ptyHostStarter.onRequestConnection)(() => this._ensurePtyHost()));
    }
    if (this._ptyHostStarter.onWillShutdown) {
      this._register(this._ptyHostStarter.onWillShutdown(() => this._wasQuitRequested = true));
    }
  }
  get _connection() {
    this._ensurePtyHost();
    return this.__connection;
  }
  get _proxy() {
    this._ensurePtyHost();
    return this.__proxy;
  }
  /**
   * Get the proxy if it exists, otherwise undefined. This is used when calls are not needed to be
   * passed through to the pty host if it has not yet been spawned.
   */
  get _optionalProxy() {
    return this.__proxy;
  }
  _ensurePtyHost() {
    if (!this.__connection) {
      this._startPtyHost();
    }
  }
  get _ignoreProcessNames() {
    return this._configurationService.getValue(TerminalSettingId.IgnoreProcessNames);
  }
  async _refreshIgnoreProcessNames() {
    return this._optionalProxy?.refreshIgnoreProcessNames?.(this._ignoreProcessNames);
  }
  async _resolveShellEnv() {
    if (isWindows) {
      return process.env;
    }
    try {
      return await getResolvedShellEnv(this._configurationService, this._logService, { _: [] }, process.env);
    } catch (error) {
      this._logService.error("ptyHost was unable to resolve shell environment", error);
      return {};
    }
  }
  _startPtyHost() {
    const connection = this._ptyHostStarter.start();
    const client = connection.client;
    if (this._logService.getLevel() === LogLevel.Trace) {
      this._logService.trace("PtyHostService#_startPtyHost", new Error().stack?.replace(/^Error/, ""));
    }
    const heartbeatService = ProxyChannel.toService(client.getChannel(TerminalIpcChannels.Heartbeat));
    heartbeatService.onBeat(() => this._handleHeartbeat());
    this._handleHeartbeat(true);
    this._register(connection.onDidProcessExit((e) => {
      this._onPtyHostExit.fire(e.code);
      if (!this._wasQuitRequested && !this._store.isDisposed) {
        if (this._restartCount <= 5 /* MaxRestarts */) {
          this._logService.error(`ptyHost terminated unexpectedly with code ${e.code}`);
          this._restartCount++;
          this.restartPtyHost();
        } else {
          this._logService.error(`ptyHost terminated unexpectedly with code ${e.code}, giving up`);
        }
      }
    }));
    const proxy = ProxyChannel.toService(client.getChannel(TerminalIpcChannels.PtyHost));
    this._register(proxy.onProcessData((e) => this._onProcessData.fire(e)));
    this._register(proxy.onProcessReady((e) => this._onProcessReady.fire(e)));
    this._register(proxy.onProcessExit((e) => this._onProcessExit.fire(e)));
    this._register(proxy.onDidChangeProperty((e) => this._onDidChangeProperty.fire(e)));
    this._register(proxy.onProcessReplay((e) => this._onProcessReplay.fire(e)));
    this._register(proxy.onProcessOrphanQuestion((e) => this._onProcessOrphanQuestion.fire(e)));
    this._register(proxy.onDidRequestDetach((e) => this._onDidRequestDetach.fire(e)));
    this._register(new RemoteLoggerChannelClient(this._loggerService, client.getChannel(TerminalIpcChannels.Logger)));
    this.__connection = connection;
    this.__proxy = proxy;
    this._onPtyHostStart.fire();
    this._register(this._configurationService.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration(TerminalSettingId.IgnoreProcessNames)) {
        await this._refreshIgnoreProcessNames();
      }
    }));
    this._refreshIgnoreProcessNames();
    return [connection, proxy];
  }
  async createProcess(shellLaunchConfig, cwd, cols, rows, unicodeVersion, env, executableEnv, options, shouldPersist, workspaceId, workspaceName) {
    const timeout = setTimeout(() => this._handleUnresponsiveCreateProcess(), HeartbeatConstants.CreateProcessTimeout);
    const id = await this._proxy.createProcess(shellLaunchConfig, cwd, cols, rows, unicodeVersion, env, executableEnv, options, shouldPersist, workspaceId, workspaceName);
    clearTimeout(timeout);
    return id;
  }
  updateTitle(id, title, titleSource) {
    return this._proxy.updateTitle(id, title, titleSource);
  }
  updateIcon(id, userInitiated, icon, color) {
    return this._proxy.updateIcon(id, userInitiated, icon, color);
  }
  attachToProcess(id) {
    return this._proxy.attachToProcess(id);
  }
  detachFromProcess(id, forcePersist) {
    return this._proxy.detachFromProcess(id, forcePersist);
  }
  shutdownAll() {
    return this._proxy.shutdownAll();
  }
  listProcesses() {
    return this._proxy.listProcesses();
  }
  async getPerformanceMarks() {
    return this._optionalProxy?.getPerformanceMarks() ?? [];
  }
  async reduceConnectionGraceTime() {
    return this._optionalProxy?.reduceConnectionGraceTime();
  }
  start(id) {
    return this._proxy.start(id);
  }
  shutdown(id, immediate) {
    return this._proxy.shutdown(id, immediate);
  }
  input(id, data) {
    return this._proxy.input(id, data);
  }
  processBinary(id, data) {
    return this._proxy.processBinary(id, data);
  }
  resize(id, cols, rows) {
    return this._proxy.resize(id, cols, rows);
  }
  clearBuffer(id) {
    return this._proxy.clearBuffer(id);
  }
  acknowledgeDataEvent(id, charCount) {
    return this._proxy.acknowledgeDataEvent(id, charCount);
  }
  setUnicodeVersion(id, version) {
    return this._proxy.setUnicodeVersion(id, version);
  }
  getInitialCwd(id) {
    return this._proxy.getInitialCwd(id);
  }
  getCwd(id) {
    return this._proxy.getCwd(id);
  }
  async getLatency() {
    const sw = new StopWatch();
    const results = await this._proxy.getLatency();
    sw.stop();
    return [
      {
        label: "ptyhostservice<->ptyhost",
        latency: sw.elapsed()
      },
      ...results
    ];
  }
  orphanQuestionReply(id) {
    return this._proxy.orphanQuestionReply(id);
  }
  installAutoReply(match, reply) {
    return this._proxy.installAutoReply(match, reply);
  }
  uninstallAllAutoReplies() {
    return this._proxy.uninstallAllAutoReplies();
  }
  getDefaultSystemShell(osOverride) {
    return this._optionalProxy?.getDefaultSystemShell(osOverride) ?? getSystemShell(osOverride ?? OS, process.env);
  }
  async getProfiles(workspaceId, profiles, defaultProfile, includeDetectedProfiles = false) {
    const shellEnv = await this._resolveShellEnv();
    return detectAvailableProfiles(profiles, defaultProfile, includeDetectedProfiles, this._configurationService, shellEnv, void 0, this._logService, this._resolveVariables.bind(this, workspaceId));
  }
  async getEnvironment() {
    if (!this.__proxy) {
      return { ...process.env };
    }
    return this._proxy.getEnvironment();
  }
  getWslPath(original, direction) {
    return this._proxy.getWslPath(original, direction);
  }
  getRevivedPtyNewId(workspaceId, id) {
    return this._proxy.getRevivedPtyNewId(workspaceId, id);
  }
  setTerminalLayoutInfo(args) {
    return this._proxy.setTerminalLayoutInfo(args);
  }
  async getTerminalLayoutInfo(args) {
    return this._optionalProxy?.getTerminalLayoutInfo(args);
  }
  async requestDetachInstance(workspaceId, instanceId) {
    return this._proxy.requestDetachInstance(workspaceId, instanceId);
  }
  async acceptDetachInstanceReply(requestId, persistentProcessId) {
    return this._proxy.acceptDetachInstanceReply(requestId, persistentProcessId);
  }
  async freePortKillProcess(port) {
    if (!this._proxy.freePortKillProcess) {
      throw new Error("freePortKillProcess does not exist on the pty proxy");
    }
    return this._proxy.freePortKillProcess(port);
  }
  async serializeTerminalState(ids) {
    return this._proxy.serializeTerminalState(ids);
  }
  async reviveTerminalProcesses(workspaceId, state, dateTimeFormatLocate) {
    return this._proxy.reviveTerminalProcesses(workspaceId, state, dateTimeFormatLocate);
  }
  async refreshProperty(id, property) {
    return this._proxy.refreshProperty(id, property);
  }
  async updateProperty(id, property, value) {
    return this._proxy.updateProperty(id, property, value);
  }
  async restartPtyHost() {
    this._disposePtyHost();
    this._isResponsive = true;
    this._startPtyHost();
  }
  _disposePtyHost() {
    this._proxy.shutdownAll();
    this._connection.store.dispose();
  }
  _handleHeartbeat(isConnecting) {
    this._clearHeartbeatTimeouts();
    this._heartbeatFirstTimeout = setTimeout(() => this._handleHeartbeatFirstTimeout(), isConnecting ? HeartbeatConstants.ConnectingBeatInterval : HeartbeatConstants.BeatInterval * HeartbeatConstants.FirstWaitMultiplier);
    if (!this._isResponsive) {
      this._isResponsive = true;
      this._onPtyHostResponsive.fire();
    }
  }
  _handleHeartbeatFirstTimeout() {
    this._logService.warn(`No ptyHost heartbeat after ${HeartbeatConstants.BeatInterval * HeartbeatConstants.FirstWaitMultiplier / 1e3} seconds`);
    this._heartbeatFirstTimeout = void 0;
    this._heartbeatSecondTimeout = setTimeout(() => this._handleHeartbeatSecondTimeout(), HeartbeatConstants.BeatInterval * HeartbeatConstants.SecondWaitMultiplier);
  }
  _handleHeartbeatSecondTimeout() {
    this._logService.error(`No ptyHost heartbeat after ${(HeartbeatConstants.BeatInterval * HeartbeatConstants.FirstWaitMultiplier + HeartbeatConstants.BeatInterval * HeartbeatConstants.FirstWaitMultiplier) / 1e3} seconds`);
    this._heartbeatSecondTimeout = void 0;
    if (this._isResponsive) {
      this._isResponsive = false;
      this._onPtyHostUnresponsive.fire();
    }
  }
  _handleUnresponsiveCreateProcess() {
    this._clearHeartbeatTimeouts();
    this._logService.error(`No ptyHost response to createProcess after ${HeartbeatConstants.CreateProcessTimeout / 1e3} seconds`);
    if (this._isResponsive) {
      this._isResponsive = false;
      this._onPtyHostUnresponsive.fire();
    }
  }
  _clearHeartbeatTimeouts() {
    if (this._heartbeatFirstTimeout) {
      clearTimeout(this._heartbeatFirstTimeout);
      this._heartbeatFirstTimeout = void 0;
    }
    if (this._heartbeatSecondTimeout) {
      clearTimeout(this._heartbeatSecondTimeout);
      this._heartbeatSecondTimeout = void 0;
    }
  }
  _resolveVariables(workspaceId, text) {
    return this._resolveVariablesRequestStore.createRequest({ workspaceId, originalText: text });
  }
  async acceptPtyHostResolvedVariables(requestId, resolved) {
    this._resolveVariablesRequestStore.acceptReply(requestId, resolved);
  }
};
PtyHostService = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ILogService),
  __decorateParam(3, ILoggerService)
], PtyHostService);
export {
  PtyHostService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZXJtaW5hbC9ub2RlL3B0eUhvc3RTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVByb2Nlc3NFbnZpcm9ubWVudCwgT1MsIE9wZXJhdGluZ1N5c3RlbSwgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgUHJveHlDaGFubmVsIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9wYXJ0cy9pcGMvY29tbW9uL2lwYy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlLCBJTG9nZ2VyU2VydmljZSwgTG9nTGV2ZWwgfSBmcm9tICcuLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBSZW1vdGVMb2dnZXJDaGFubmVsQ2xpZW50IH0gZnJvbSAnLi4vLi4vbG9nL2NvbW1vbi9sb2dJcGMuanMnO1xuaW1wb3J0IHsgZ2V0UmVzb2x2ZWRTaGVsbEVudiB9IGZyb20gJy4uLy4uL3NoZWxsL25vZGUvc2hlbGxFbnYuanMnO1xuaW1wb3J0IHsgSVB0eUhvc3RQcm9jZXNzUmVwbGF5RXZlbnQgfSBmcm9tICcuLi9jb21tb24vY2FwYWJpbGl0aWVzL2NhcGFiaWxpdGllcy5qcyc7XG5pbXBvcnQgeyBSZXF1ZXN0U3RvcmUgfSBmcm9tICcuLi9jb21tb24vcmVxdWVzdFN0b3JlLmpzJztcbmltcG9ydCB7IEhlYXJ0YmVhdENvbnN0YW50cywgSUhlYXJ0YmVhdFNlcnZpY2UsIElQcm9jZXNzRGF0YUV2ZW50LCBJUHJvY2Vzc1Byb3BlcnR5LCBJUHJvY2Vzc1Byb3BlcnR5TWFwLCBJUHJvY2Vzc1JlYWR5RXZlbnQsIElQdHlIb3N0TGF0ZW5jeU1lYXN1cmVtZW50LCBJUHR5SG9zdFNlcnZpY2UsIElQdHlTZXJ2aWNlLCBJUmVxdWVzdFJlc29sdmVWYXJpYWJsZXNFdmVudCwgSVNlcmlhbGl6ZWRUZXJtaW5hbFN0YXRlLCBJU2hlbGxMYXVuY2hDb25maWcsIElUZXJtaW5hbExhdW5jaEVycm9yLCBJVGVybWluYWxQcm9jZXNzT3B0aW9ucywgSVRlcm1pbmFsUHJvZmlsZSwgSVRlcm1pbmFsc0xheW91dEluZm8sIFByb2Nlc3NQcm9wZXJ0eVR5cGUsIFRlcm1pbmFsSWNvbiwgVGVybWluYWxJcGNDaGFubmVscywgVGVybWluYWxTZXR0aW5nSWQsIFRpdGxlRXZlbnRTb3VyY2UgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJUZXJtaW5hbFBsYXRmb3JtQ29uZmlndXJhdGlvbiB9IGZyb20gJy4uL2NvbW1vbi90ZXJtaW5hbFBsYXRmb3JtQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJR2V0VGVybWluYWxMYXlvdXRJbmZvQXJncywgSVByb2Nlc3NEZXRhaWxzLCBJU2V0VGVybWluYWxMYXlvdXRJbmZvQXJncyB9IGZyb20gJy4uL2NvbW1vbi90ZXJtaW5hbFByb2Nlc3MuanMnO1xuaW1wb3J0IHsgSVB0eUhvc3RDb25uZWN0aW9uLCBJUHR5SG9zdFN0YXJ0ZXIgfSBmcm9tICcuL3B0eUhvc3QuanMnO1xuaW1wb3J0IHsgZGV0ZWN0QXZhaWxhYmxlUHJvZmlsZXMgfSBmcm9tICcuL3Rlcm1pbmFsUHJvZmlsZXMuanMnO1xuaW1wb3J0ICogYXMgcGVyZm9ybWFuY2UgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGVyZm9ybWFuY2UuanMnO1xuaW1wb3J0IHsgZ2V0U3lzdGVtU2hlbGwgfSBmcm9tICcuLi8uLi8uLi9iYXNlL25vZGUvc2hlbGwuanMnO1xuaW1wb3J0IHsgU3RvcFdhdGNoIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc3RvcHdhdGNoLmpzJztcblxuZW51bSBDb25zdGFudHMge1xuXHRNYXhSZXN0YXJ0cyA9IDVcbn1cblxuLyoqXG4gKiBUaGlzIHNlcnZpY2UgaW1wbGVtZW50cyBJUHR5U2VydmljZSBieSBsYXVuY2hpbmcgYSBwdHkgaG9zdCBwcm9jZXNzLCBmb3J3YXJkaW5nIG1lc3NhZ2VzIHRvIGFuZFxuICogZnJvbSB0aGUgcHR5IGhvc3QgcHJvY2VzcyBhbmQgbWFuYWdlcyB0aGUgY29ubmVjdGlvbi5cbiAqL1xuZXhwb3J0IGNsYXNzIFB0eUhvc3RTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElQdHlIb3N0U2VydmljZSB7XG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgX19jb25uZWN0aW9uPzogSVB0eUhvc3RDb25uZWN0aW9uO1xuXHQvLyBQcm94eUNoYW5uZWwgaXMgbm90IHVzZWQgaGVyZSBiZWNhdXNlIGV2ZW50cyBnZXQgbG9zdCB3aGVuIGZvcndhcmRpbmcgYWNyb3NzIG11bHRpcGxlIHByb3hpZXNcblx0cHJpdmF0ZSBfX3Byb3h5PzogSVB0eVNlcnZpY2U7XG5cblx0cHJpdmF0ZSBnZXQgX2Nvbm5lY3Rpb24oKTogSVB0eUhvc3RDb25uZWN0aW9uIHtcblx0XHR0aGlzLl9lbnN1cmVQdHlIb3N0KCk7XG5cdFx0cmV0dXJuIHRoaXMuX19jb25uZWN0aW9uITtcblx0fVxuXHRwcml2YXRlIGdldCBfcHJveHkoKTogSVB0eVNlcnZpY2Uge1xuXHRcdHRoaXMuX2Vuc3VyZVB0eUhvc3QoKTtcblx0XHRyZXR1cm4gdGhpcy5fX3Byb3h5ITtcblx0fVxuXHQvKipcblx0ICogR2V0IHRoZSBwcm94eSBpZiBpdCBleGlzdHMsIG90aGVyd2lzZSB1bmRlZmluZWQuIFRoaXMgaXMgdXNlZCB3aGVuIGNhbGxzIGFyZSBub3QgbmVlZGVkIHRvIGJlXG5cdCAqIHBhc3NlZCB0aHJvdWdoIHRvIHRoZSBwdHkgaG9zdCBpZiBpdCBoYXMgbm90IHlldCBiZWVuIHNwYXduZWQuXG5cdCAqL1xuXHRwcml2YXRlIGdldCBfb3B0aW9uYWxQcm94eSgpOiBJUHR5U2VydmljZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX19wcm94eTtcblx0fVxuXG5cdHByaXZhdGUgX2Vuc3VyZVB0eUhvc3QoKSB7XG5cdFx0aWYgKCF0aGlzLl9fY29ubmVjdGlvbikge1xuXHRcdFx0dGhpcy5fc3RhcnRQdHlIb3N0KCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcmVzb2x2ZVZhcmlhYmxlc1JlcXVlc3RTdG9yZTogUmVxdWVzdFN0b3JlPHN0cmluZ1tdLCB7IHdvcmtzcGFjZUlkOiBzdHJpbmc7IG9yaWdpbmFsVGV4dDogc3RyaW5nW10gfT47XG5cdHByaXZhdGUgX3dhc1F1aXRSZXF1ZXN0ZWQgPSBmYWxzZTtcblx0cHJpdmF0ZSBfcmVzdGFydENvdW50ID0gMDtcblx0cHJpdmF0ZSBfaXNSZXNwb25zaXZlID0gdHJ1ZTtcblx0cHJpdmF0ZSBfaGVhcnRiZWF0Rmlyc3RUaW1lb3V0PzogTm9kZUpTLlRpbWVvdXQ7XG5cdHByaXZhdGUgX2hlYXJ0YmVhdFNlY29uZFRpbWVvdXQ/OiBOb2RlSlMuVGltZW91dDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vblB0eUhvc3RFeGl0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8bnVtYmVyPigpKTtcblx0cmVhZG9ubHkgb25QdHlIb3N0RXhpdCA9IHRoaXMuX29uUHR5SG9zdEV4aXQuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uUHR5SG9zdFN0YXJ0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uUHR5SG9zdFN0YXJ0ID0gdGhpcy5fb25QdHlIb3N0U3RhcnQuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uUHR5SG9zdFVucmVzcG9uc2l2ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvblB0eUhvc3RVbnJlc3BvbnNpdmUgPSB0aGlzLl9vblB0eUhvc3RVbnJlc3BvbnNpdmUuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uUHR5SG9zdFJlc3BvbnNpdmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25QdHlIb3N0UmVzcG9uc2l2ZSA9IHRoaXMuX29uUHR5SG9zdFJlc3BvbnNpdmUuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uUHR5SG9zdFJlcXVlc3RSZXNvbHZlVmFyaWFibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVJlcXVlc3RSZXNvbHZlVmFyaWFibGVzRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvblB0eUhvc3RSZXF1ZXN0UmVzb2x2ZVZhcmlhYmxlcyA9IHRoaXMuX29uUHR5SG9zdFJlcXVlc3RSZXNvbHZlVmFyaWFibGVzLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uUHJvY2Vzc0RhdGEgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGlkOiBudW1iZXI7IGV2ZW50OiBJUHJvY2Vzc0RhdGFFdmVudCB8IHN0cmluZyB9PigpKTtcblx0cmVhZG9ubHkgb25Qcm9jZXNzRGF0YSA9IHRoaXMuX29uUHJvY2Vzc0RhdGEuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uUHJvY2Vzc1JlYWR5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyBpZDogbnVtYmVyOyBldmVudDogSVByb2Nlc3NSZWFkeUV2ZW50IH0+KCkpO1xuXHRyZWFkb25seSBvblByb2Nlc3NSZWFkeSA9IHRoaXMuX29uUHJvY2Vzc1JlYWR5LmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vblByb2Nlc3NSZXBsYXkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGlkOiBudW1iZXI7IGV2ZW50OiBJUHR5SG9zdFByb2Nlc3NSZXBsYXlFdmVudCB9PigpKTtcblx0cmVhZG9ubHkgb25Qcm9jZXNzUmVwbGF5ID0gdGhpcy5fb25Qcm9jZXNzUmVwbGF5LmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vblByb2Nlc3NPcnBoYW5RdWVzdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgaWQ6IG51bWJlciB9PigpKTtcblx0cmVhZG9ubHkgb25Qcm9jZXNzT3JwaGFuUXVlc3Rpb24gPSB0aGlzLl9vblByb2Nlc3NPcnBoYW5RdWVzdGlvbi5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZXF1ZXN0RGV0YWNoID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyByZXF1ZXN0SWQ6IG51bWJlcjsgd29ya3NwYWNlSWQ6IHN0cmluZzsgaW5zdGFuY2VJZDogbnVtYmVyIH0+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlcXVlc3REZXRhY2ggPSB0aGlzLl9vbkRpZFJlcXVlc3REZXRhY2guZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlUHJvcGVydHkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGlkOiBudW1iZXI7IHByb3BlcnR5OiBJUHJvY2Vzc1Byb3BlcnR5PGFueT4gfT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlUHJvcGVydHkgPSB0aGlzLl9vbkRpZENoYW5nZVByb3BlcnR5LmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vblByb2Nlc3NFeGl0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyBpZDogbnVtYmVyOyBldmVudDogbnVtYmVyIHwgdW5kZWZpbmVkIH0+KCkpO1xuXHRyZWFkb25seSBvblByb2Nlc3NFeGl0ID0gdGhpcy5fb25Qcm9jZXNzRXhpdC5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wdHlIb3N0U3RhcnRlcjogSVB0eUhvc3RTdGFydGVyLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElMb2dnZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ2dlclNlcnZpY2U6IElMb2dnZXJTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Ly8gUGxhdGZvcm0gY29uZmlndXJhdGlvbiBpcyByZXF1aXJlZCBvbiB0aGUgcHJvY2VzcyBydW5uaW5nIHRoZSBwdHkgaG9zdCAoc2hhcmVkIHByb2Nlc3Mgb3Jcblx0XHQvLyByZW1vdGUgc2VydmVyKS5cblx0XHRyZWdpc3RlclRlcm1pbmFsUGxhdGZvcm1Db25maWd1cmF0aW9uKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9wdHlIb3N0U3RhcnRlcik7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMuX2Rpc3Bvc2VQdHlIb3N0KCkpKTtcblxuXHRcdHRoaXMuX3Jlc29sdmVWYXJpYWJsZXNSZXF1ZXN0U3RvcmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgUmVxdWVzdFN0b3JlKHVuZGVmaW5lZCwgdGhpcy5fbG9nU2VydmljZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Jlc29sdmVWYXJpYWJsZXNSZXF1ZXN0U3RvcmUub25DcmVhdGVSZXF1ZXN0KHRoaXMuX29uUHR5SG9zdFJlcXVlc3RSZXNvbHZlVmFyaWFibGVzLmZpcmUsIHRoaXMuX29uUHR5SG9zdFJlcXVlc3RSZXNvbHZlVmFyaWFibGVzKSk7XG5cblx0XHQvLyBTdGFydCB0aGUgcHR5IGhvc3Qgd2hlbiBhIHdpbmRvdyByZXF1ZXN0cyBhIGNvbm5lY3Rpb24sIGlmIHRoZSBzdGFydGVyIGhhcyB0aGF0IGNhcGFiaWxpdHkuXG5cdFx0aWYgKHRoaXMuX3B0eUhvc3RTdGFydGVyLm9uUmVxdWVzdENvbm5lY3Rpb24pIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50Lm9uY2UodGhpcy5fcHR5SG9zdFN0YXJ0ZXIub25SZXF1ZXN0Q29ubmVjdGlvbikoKCkgPT4gdGhpcy5fZW5zdXJlUHR5SG9zdCgpKSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX3B0eUhvc3RTdGFydGVyLm9uV2lsbFNodXRkb3duKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9wdHlIb3N0U3RhcnRlci5vbldpbGxTaHV0ZG93bigoKSA9PiB0aGlzLl93YXNRdWl0UmVxdWVzdGVkID0gdHJ1ZSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0IF9pZ25vcmVQcm9jZXNzTmFtZXMoKTogc3RyaW5nW10ge1xuXHRcdHJldHVybiB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxzdHJpbmdbXT4oVGVybWluYWxTZXR0aW5nSWQuSWdub3JlUHJvY2Vzc05hbWVzKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3JlZnJlc2hJZ25vcmVQcm9jZXNzTmFtZXMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX29wdGlvbmFsUHJveHk/LnJlZnJlc2hJZ25vcmVQcm9jZXNzTmFtZXM/Lih0aGlzLl9pZ25vcmVQcm9jZXNzTmFtZXMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcmVzb2x2ZVNoZWxsRW52KCk6IFByb21pc2U8dHlwZW9mIHByb2Nlc3MuZW52PiB7XG5cdFx0aWYgKGlzV2luZG93cykge1xuXHRcdFx0cmV0dXJuIHByb2Nlc3MuZW52O1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgZ2V0UmVzb2x2ZWRTaGVsbEVudih0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy5fbG9nU2VydmljZSwgeyBfOiBbXSB9LCBwcm9jZXNzLmVudik7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoJ3B0eUhvc3Qgd2FzIHVuYWJsZSB0byByZXNvbHZlIHNoZWxsIGVudmlyb25tZW50JywgZXJyb3IpO1xuXG5cdFx0XHRyZXR1cm4ge307XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfc3RhcnRQdHlIb3N0KCk6IFtJUHR5SG9zdENvbm5lY3Rpb24sIElQdHlTZXJ2aWNlXSB7XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IHRoaXMuX3B0eUhvc3RTdGFydGVyLnN0YXJ0KCk7XG5cdFx0Y29uc3QgY2xpZW50ID0gY29ubmVjdGlvbi5jbGllbnQ7XG5cblx0XHQvLyBMb2cgYSBmdWxsIHN0YWNrIHRyYWNlIHdoaWNoIHdpbGwgdGVsbCB0aGUgZXhhY3QgcmVhc29uIHRoZSBwdHkgaG9zdCBpcyBzdGFydGluZyB1cFxuXHRcdGlmICh0aGlzLl9sb2dTZXJ2aWNlLmdldExldmVsKCkgPT09IExvZ0xldmVsLlRyYWNlKSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCdQdHlIb3N0U2VydmljZSNfc3RhcnRQdHlIb3N0JywgbmV3IEVycm9yKCkuc3RhY2s/LnJlcGxhY2UoL15FcnJvci8sICcnKSk7XG5cdFx0fVxuXG5cdFx0Ly8gU2V0dXAgaGVhcnRiZWF0IHNlcnZpY2UgYW5kIHRyaWdnZXIgYSBoZWFydGJlYXQgaW1tZWRpYXRlbHkgdG8gcmVzZXQgdGhlIHRpbWVvdXRzXG5cdFx0Y29uc3QgaGVhcnRiZWF0U2VydmljZSA9IFByb3h5Q2hhbm5lbC50b1NlcnZpY2U8SUhlYXJ0YmVhdFNlcnZpY2U+KGNsaWVudC5nZXRDaGFubmVsKFRlcm1pbmFsSXBjQ2hhbm5lbHMuSGVhcnRiZWF0KSk7XG5cdFx0aGVhcnRiZWF0U2VydmljZS5vbkJlYXQoKCkgPT4gdGhpcy5faGFuZGxlSGVhcnRiZWF0KCkpO1xuXHRcdHRoaXMuX2hhbmRsZUhlYXJ0YmVhdCh0cnVlKTtcblxuXHRcdC8vIEhhbmRsZSBleGl0XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29ubmVjdGlvbi5vbkRpZFByb2Nlc3NFeGl0KGUgPT4ge1xuXHRcdFx0dGhpcy5fb25QdHlIb3N0RXhpdC5maXJlKGUuY29kZSk7XG5cdFx0XHRpZiAoIXRoaXMuX3dhc1F1aXRSZXF1ZXN0ZWQgJiYgIXRoaXMuX3N0b3JlLmlzRGlzcG9zZWQpIHtcblx0XHRcdFx0aWYgKHRoaXMuX3Jlc3RhcnRDb3VudCA8PSBDb25zdGFudHMuTWF4UmVzdGFydHMpIHtcblx0XHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGBwdHlIb3N0IHRlcm1pbmF0ZWQgdW5leHBlY3RlZGx5IHdpdGggY29kZSAke2UuY29kZX1gKTtcblx0XHRcdFx0XHR0aGlzLl9yZXN0YXJ0Q291bnQrKztcblx0XHRcdFx0XHR0aGlzLnJlc3RhcnRQdHlIb3N0KCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihgcHR5SG9zdCB0ZXJtaW5hdGVkIHVuZXhwZWN0ZWRseSB3aXRoIGNvZGUgJHtlLmNvZGV9LCBnaXZpbmcgdXBgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIENyZWF0ZSBwcm94eSBhbmQgZm9yd2FyZCBldmVudHNcblx0XHRjb25zdCBwcm94eSA9IFByb3h5Q2hhbm5lbC50b1NlcnZpY2U8SVB0eVNlcnZpY2U+KGNsaWVudC5nZXRDaGFubmVsKFRlcm1pbmFsSXBjQ2hhbm5lbHMuUHR5SG9zdCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHByb3h5Lm9uUHJvY2Vzc0RhdGEoZSA9PiB0aGlzLl9vblByb2Nlc3NEYXRhLmZpcmUoZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihwcm94eS5vblByb2Nlc3NSZWFkeShlID0+IHRoaXMuX29uUHJvY2Vzc1JlYWR5LmZpcmUoZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihwcm94eS5vblByb2Nlc3NFeGl0KGUgPT4gdGhpcy5fb25Qcm9jZXNzRXhpdC5maXJlKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocHJveHkub25EaWRDaGFuZ2VQcm9wZXJ0eShlID0+IHRoaXMuX29uRGlkQ2hhbmdlUHJvcGVydHkuZmlyZShlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHByb3h5Lm9uUHJvY2Vzc1JlcGxheShlID0+IHRoaXMuX29uUHJvY2Vzc1JlcGxheS5maXJlKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocHJveHkub25Qcm9jZXNzT3JwaGFuUXVlc3Rpb24oZSA9PiB0aGlzLl9vblByb2Nlc3NPcnBoYW5RdWVzdGlvbi5maXJlKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocHJveHkub25EaWRSZXF1ZXN0RGV0YWNoKGUgPT4gdGhpcy5fb25EaWRSZXF1ZXN0RGV0YWNoLmZpcmUoZSkpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKG5ldyBSZW1vdGVMb2dnZXJDaGFubmVsQ2xpZW50KHRoaXMuX2xvZ2dlclNlcnZpY2UsIGNsaWVudC5nZXRDaGFubmVsKFRlcm1pbmFsSXBjQ2hhbm5lbHMuTG9nZ2VyKSkpO1xuXG5cdFx0dGhpcy5fX2Nvbm5lY3Rpb24gPSBjb25uZWN0aW9uO1xuXHRcdHRoaXMuX19wcm94eSA9IHByb3h5O1xuXG5cdFx0dGhpcy5fb25QdHlIb3N0U3RhcnQuZmlyZSgpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGFzeW5jIGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGVybWluYWxTZXR0aW5nSWQuSWdub3JlUHJvY2Vzc05hbWVzKSkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLl9yZWZyZXNoSWdub3JlUHJvY2Vzc05hbWVzKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZnJlc2hJZ25vcmVQcm9jZXNzTmFtZXMoKTtcblxuXHRcdHJldHVybiBbY29ubmVjdGlvbiwgcHJveHldO1xuXHR9XG5cblx0YXN5bmMgY3JlYXRlUHJvY2Vzcyhcblx0XHRzaGVsbExhdW5jaENvbmZpZzogSVNoZWxsTGF1bmNoQ29uZmlnLFxuXHRcdGN3ZDogc3RyaW5nLFxuXHRcdGNvbHM6IG51bWJlcixcblx0XHRyb3dzOiBudW1iZXIsXG5cdFx0dW5pY29kZVZlcnNpb246ICc2JyB8ICcxMScsXG5cdFx0ZW52OiBJUHJvY2Vzc0Vudmlyb25tZW50LFxuXHRcdGV4ZWN1dGFibGVFbnY6IElQcm9jZXNzRW52aXJvbm1lbnQsXG5cdFx0b3B0aW9uczogSVRlcm1pbmFsUHJvY2Vzc09wdGlvbnMsXG5cdFx0c2hvdWxkUGVyc2lzdDogYm9vbGVhbixcblx0XHR3b3Jrc3BhY2VJZDogc3RyaW5nLFxuXHRcdHdvcmtzcGFjZU5hbWU6IHN0cmluZ1xuXHQpOiBQcm9taXNlPG51bWJlcj4ge1xuXHRcdGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHRoaXMuX2hhbmRsZVVucmVzcG9uc2l2ZUNyZWF0ZVByb2Nlc3MoKSwgSGVhcnRiZWF0Q29uc3RhbnRzLkNyZWF0ZVByb2Nlc3NUaW1lb3V0KTtcblx0XHRjb25zdCBpZCA9IGF3YWl0IHRoaXMuX3Byb3h5LmNyZWF0ZVByb2Nlc3Moc2hlbGxMYXVuY2hDb25maWcsIGN3ZCwgY29scywgcm93cywgdW5pY29kZVZlcnNpb24sIGVudiwgZXhlY3V0YWJsZUVudiwgb3B0aW9ucywgc2hvdWxkUGVyc2lzdCwgd29ya3NwYWNlSWQsIHdvcmtzcGFjZU5hbWUpO1xuXHRcdGNsZWFyVGltZW91dCh0aW1lb3V0KTtcblx0XHRyZXR1cm4gaWQ7XG5cdH1cblx0dXBkYXRlVGl0bGUoaWQ6IG51bWJlciwgdGl0bGU6IHN0cmluZywgdGl0bGVTb3VyY2U6IFRpdGxlRXZlbnRTb3VyY2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fcHJveHkudXBkYXRlVGl0bGUoaWQsIHRpdGxlLCB0aXRsZVNvdXJjZSk7XG5cdH1cblx0dXBkYXRlSWNvbihpZDogbnVtYmVyLCB1c2VySW5pdGlhdGVkOiBib29sZWFuLCBpY29uOiBUZXJtaW5hbEljb24sIGNvbG9yPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5LnVwZGF0ZUljb24oaWQsIHVzZXJJbml0aWF0ZWQsIGljb24sIGNvbG9yKTtcblx0fVxuXHRhdHRhY2hUb1Byb2Nlc3MoaWQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS5hdHRhY2hUb1Byb2Nlc3MoaWQpO1xuXHR9XG5cdGRldGFjaEZyb21Qcm9jZXNzKGlkOiBudW1iZXIsIGZvcmNlUGVyc2lzdD86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fcHJveHkuZGV0YWNoRnJvbVByb2Nlc3MoaWQsIGZvcmNlUGVyc2lzdCk7XG5cdH1cblx0c2h1dGRvd25BbGwoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5LnNodXRkb3duQWxsKCk7XG5cdH1cblx0bGlzdFByb2Nlc3NlcygpOiBQcm9taXNlPElQcm9jZXNzRGV0YWlsc1tdPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5Lmxpc3RQcm9jZXNzZXMoKTtcblx0fVxuXHRhc3luYyBnZXRQZXJmb3JtYW5jZU1hcmtzKCk6IFByb21pc2U8cGVyZm9ybWFuY2UuUGVyZm9ybWFuY2VNYXJrW10+IHtcblx0XHRyZXR1cm4gdGhpcy5fb3B0aW9uYWxQcm94eT8uZ2V0UGVyZm9ybWFuY2VNYXJrcygpID8/IFtdO1xuXHR9XG5cdGFzeW5jIHJlZHVjZUNvbm5lY3Rpb25HcmFjZVRpbWUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX29wdGlvbmFsUHJveHk/LnJlZHVjZUNvbm5lY3Rpb25HcmFjZVRpbWUoKTtcblx0fVxuXHRzdGFydChpZDogbnVtYmVyKTogUHJvbWlzZTxJVGVybWluYWxMYXVuY2hFcnJvciB8IHsgaW5qZWN0ZWRBcmdzOiBzdHJpbmdbXSB9IHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5LnN0YXJ0KGlkKTtcblx0fVxuXHRzaHV0ZG93bihpZDogbnVtYmVyLCBpbW1lZGlhdGU6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fcHJveHkuc2h1dGRvd24oaWQsIGltbWVkaWF0ZSk7XG5cdH1cblx0aW5wdXQoaWQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5LmlucHV0KGlkLCBkYXRhKTtcblx0fVxuXHRwcm9jZXNzQmluYXJ5KGlkOiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS5wcm9jZXNzQmluYXJ5KGlkLCBkYXRhKTtcblx0fVxuXHRyZXNpemUoaWQ6IG51bWJlciwgY29sczogbnVtYmVyLCByb3dzOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fcHJveHkucmVzaXplKGlkLCBjb2xzLCByb3dzKTtcblx0fVxuXHRjbGVhckJ1ZmZlcihpZDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5LmNsZWFyQnVmZmVyKGlkKTtcblx0fVxuXHRhY2tub3dsZWRnZURhdGFFdmVudChpZDogbnVtYmVyLCBjaGFyQ291bnQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS5hY2tub3dsZWRnZURhdGFFdmVudChpZCwgY2hhckNvdW50KTtcblx0fVxuXHRzZXRVbmljb2RlVmVyc2lvbihpZDogbnVtYmVyLCB2ZXJzaW9uOiAnNicgfCAnMTEnKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5LnNldFVuaWNvZGVWZXJzaW9uKGlkLCB2ZXJzaW9uKTtcblx0fVxuXHRnZXRJbml0aWFsQ3dkKGlkOiBudW1iZXIpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS5nZXRJbml0aWFsQ3dkKGlkKTtcblx0fVxuXHRnZXRDd2QoaWQ6IG51bWJlcik6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5LmdldEN3ZChpZCk7XG5cdH1cblx0YXN5bmMgZ2V0TGF0ZW5jeSgpOiBQcm9taXNlPElQdHlIb3N0TGF0ZW5jeU1lYXN1cmVtZW50W10+IHtcblx0XHRjb25zdCBzdyA9IG5ldyBTdG9wV2F0Y2goKTtcblx0XHRjb25zdCByZXN1bHRzID0gYXdhaXQgdGhpcy5fcHJveHkuZ2V0TGF0ZW5jeSgpO1xuXHRcdHN3LnN0b3AoKTtcblx0XHRyZXR1cm4gW1xuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ3B0eWhvc3RzZXJ2aWNlPC0+cHR5aG9zdCcsXG5cdFx0XHRcdGxhdGVuY3k6IHN3LmVsYXBzZWQoKVxuXHRcdFx0fSxcblx0XHRcdC4uLnJlc3VsdHNcblx0XHRdO1xuXHR9XG5cdG9ycGhhblF1ZXN0aW9uUmVwbHkoaWQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS5vcnBoYW5RdWVzdGlvblJlcGx5KGlkKTtcblx0fVxuXG5cdGluc3RhbGxBdXRvUmVwbHkobWF0Y2g6IHN0cmluZywgcmVwbHk6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS5pbnN0YWxsQXV0b1JlcGx5KG1hdGNoLCByZXBseSk7XG5cdH1cblx0dW5pbnN0YWxsQWxsQXV0b1JlcGxpZXMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5LnVuaW5zdGFsbEFsbEF1dG9SZXBsaWVzKCk7XG5cdH1cblxuXHRnZXREZWZhdWx0U3lzdGVtU2hlbGwob3NPdmVycmlkZT86IE9wZXJhdGluZ1N5c3RlbSk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0cmV0dXJuIHRoaXMuX29wdGlvbmFsUHJveHk/LmdldERlZmF1bHRTeXN0ZW1TaGVsbChvc092ZXJyaWRlKSA/PyBnZXRTeXN0ZW1TaGVsbChvc092ZXJyaWRlID8/IE9TLCBwcm9jZXNzLmVudik7XG5cdH1cblx0YXN5bmMgZ2V0UHJvZmlsZXMod29ya3NwYWNlSWQ6IHN0cmluZywgcHJvZmlsZXM6IHVua25vd24sIGRlZmF1bHRQcm9maWxlOiB1bmtub3duLCBpbmNsdWRlRGV0ZWN0ZWRQcm9maWxlczogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxJVGVybWluYWxQcm9maWxlW10+IHtcblx0XHRjb25zdCBzaGVsbEVudiA9IGF3YWl0IHRoaXMuX3Jlc29sdmVTaGVsbEVudigpO1xuXHRcdHJldHVybiBkZXRlY3RBdmFpbGFibGVQcm9maWxlcyhwcm9maWxlcywgZGVmYXVsdFByb2ZpbGUsIGluY2x1ZGVEZXRlY3RlZFByb2ZpbGVzLCB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZSwgc2hlbGxFbnYsIHVuZGVmaW5lZCwgdGhpcy5fbG9nU2VydmljZSwgdGhpcy5fcmVzb2x2ZVZhcmlhYmxlcy5iaW5kKHRoaXMsIHdvcmtzcGFjZUlkKSk7XG5cdH1cblx0YXN5bmMgZ2V0RW52aXJvbm1lbnQoKTogUHJvbWlzZTxJUHJvY2Vzc0Vudmlyb25tZW50PiB7XG5cdFx0Ly8gSWYgdGhlIHB0eSBob3N0IGlzIHlldCB0byBiZSBsYXVuY2hlZCwganVzdCByZXR1cm4gdGhlIGVudmlyb25tZW50IG9mIHRoaXMgcHJvY2VzcyBhcyBpdFxuXHRcdC8vIGlzIGVzc2VudGlhbGx5IHRoZSBzYW1lIHdoZW4gdXNlZCB0byBldmFsdWF0ZSB0ZXJtaW5hbCBwcm9maWxlcy5cblx0XHRpZiAoIXRoaXMuX19wcm94eSkge1xuXHRcdFx0cmV0dXJuIHsgLi4ucHJvY2Vzcy5lbnYgfTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5LmdldEVudmlyb25tZW50KCk7XG5cdH1cblx0Z2V0V3NsUGF0aChvcmlnaW5hbDogc3RyaW5nLCBkaXJlY3Rpb246ICd1bml4LXRvLXdpbicgfCAnd2luLXRvLXVuaXgnKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRyZXR1cm4gdGhpcy5fcHJveHkuZ2V0V3NsUGF0aChvcmlnaW5hbCwgZGlyZWN0aW9uKTtcblx0fVxuXG5cdGdldFJldml2ZWRQdHlOZXdJZCh3b3Jrc3BhY2VJZDogc3RyaW5nLCBpZDogbnVtYmVyKTogUHJvbWlzZTxudW1iZXIgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fcHJveHkuZ2V0UmV2aXZlZFB0eU5ld0lkKHdvcmtzcGFjZUlkLCBpZCk7XG5cdH1cblxuXHRzZXRUZXJtaW5hbExheW91dEluZm8oYXJnczogSVNldFRlcm1pbmFsTGF5b3V0SW5mb0FyZ3MpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fcHJveHkuc2V0VGVybWluYWxMYXlvdXRJbmZvKGFyZ3MpO1xuXHR9XG5cdGFzeW5jIGdldFRlcm1pbmFsTGF5b3V0SW5mbyhhcmdzOiBJR2V0VGVybWluYWxMYXlvdXRJbmZvQXJncyk6IFByb21pc2U8SVRlcm1pbmFsc0xheW91dEluZm8gfCB1bmRlZmluZWQ+IHtcblx0XHQvLyBUaGlzIGlzIG9wdGlvbmFsIGFzIHdlIHdhbnQgcmVjb25uZWN0IHJlcXVlc3RzIHRvIGdvIHRocm91Z2ggb25seSBpZiB0aGUgcHR5IGhvc3QgZXhpc3RzLlxuXHRcdC8vIFJldml2ZSBpcyBoYW5kbGVkIHNwZWNpYWxseSBhcyByZXZpdmVUZXJtaW5hbFByb2Nlc3NlcyBpcyBndWFyYW50ZWVkIHRvIGJlIGNhbGxlZCBiZWZvcmVcblx0XHQvLyB0aGUgcmVxdWVzdCBmb3IgbGF5b3V0IGluZm8uXG5cdFx0cmV0dXJuIHRoaXMuX29wdGlvbmFsUHJveHk/LmdldFRlcm1pbmFsTGF5b3V0SW5mbyhhcmdzKTtcblx0fVxuXG5cdGFzeW5jIHJlcXVlc3REZXRhY2hJbnN0YW5jZSh3b3Jrc3BhY2VJZDogc3RyaW5nLCBpbnN0YW5jZUlkOiBudW1iZXIpOiBQcm9taXNlPElQcm9jZXNzRGV0YWlscyB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS5yZXF1ZXN0RGV0YWNoSW5zdGFuY2Uod29ya3NwYWNlSWQsIGluc3RhbmNlSWQpO1xuXHR9XG5cblx0YXN5bmMgYWNjZXB0RGV0YWNoSW5zdGFuY2VSZXBseShyZXF1ZXN0SWQ6IG51bWJlciwgcGVyc2lzdGVudFByb2Nlc3NJZDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5LmFjY2VwdERldGFjaEluc3RhbmNlUmVwbHkocmVxdWVzdElkLCBwZXJzaXN0ZW50UHJvY2Vzc0lkKTtcblx0fVxuXG5cdGFzeW5jIGZyZWVQb3J0S2lsbFByb2Nlc3MocG9ydDogc3RyaW5nKTogUHJvbWlzZTx7IHBvcnQ6IHN0cmluZzsgcHJvY2Vzc0lkOiBzdHJpbmcgfT4ge1xuXHRcdGlmICghdGhpcy5fcHJveHkuZnJlZVBvcnRLaWxsUHJvY2Vzcykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdmcmVlUG9ydEtpbGxQcm9jZXNzIGRvZXMgbm90IGV4aXN0IG9uIHRoZSBwdHkgcHJveHknKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5LmZyZWVQb3J0S2lsbFByb2Nlc3MocG9ydCk7XG5cdH1cblxuXHRhc3luYyBzZXJpYWxpemVUZXJtaW5hbFN0YXRlKGlkczogbnVtYmVyW10pOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS5zZXJpYWxpemVUZXJtaW5hbFN0YXRlKGlkcyk7XG5cdH1cblxuXHRhc3luYyByZXZpdmVUZXJtaW5hbFByb2Nlc3Nlcyh3b3Jrc3BhY2VJZDogc3RyaW5nLCBzdGF0ZTogSVNlcmlhbGl6ZWRUZXJtaW5hbFN0YXRlW10sIGRhdGVUaW1lRm9ybWF0TG9jYXRlOiBzdHJpbmcpIHtcblx0XHRyZXR1cm4gdGhpcy5fcHJveHkucmV2aXZlVGVybWluYWxQcm9jZXNzZXMod29ya3NwYWNlSWQsIHN0YXRlLCBkYXRlVGltZUZvcm1hdExvY2F0ZSk7XG5cdH1cblxuXHRhc3luYyByZWZyZXNoUHJvcGVydHk8VCBleHRlbmRzIFByb2Nlc3NQcm9wZXJ0eVR5cGU+KGlkOiBudW1iZXIsIHByb3BlcnR5OiBUKTogUHJvbWlzZTxJUHJvY2Vzc1Byb3BlcnR5TWFwW1RdPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5LnJlZnJlc2hQcm9wZXJ0eShpZCwgcHJvcGVydHkpO1xuXG5cdH1cblx0YXN5bmMgdXBkYXRlUHJvcGVydHk8VCBleHRlbmRzIFByb2Nlc3NQcm9wZXJ0eVR5cGU+KGlkOiBudW1iZXIsIHByb3BlcnR5OiBULCB2YWx1ZTogSVByb2Nlc3NQcm9wZXJ0eU1hcFtUXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS51cGRhdGVQcm9wZXJ0eShpZCwgcHJvcGVydHksIHZhbHVlKTtcblx0fVxuXG5cdGFzeW5jIHJlc3RhcnRQdHlIb3N0KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX2Rpc3Bvc2VQdHlIb3N0KCk7XG5cdFx0dGhpcy5faXNSZXNwb25zaXZlID0gdHJ1ZTtcblx0XHR0aGlzLl9zdGFydFB0eUhvc3QoKTtcblx0fVxuXG5cdHByaXZhdGUgX2Rpc3Bvc2VQdHlIb3N0KCk6IHZvaWQge1xuXHRcdHRoaXMuX3Byb3h5LnNodXRkb3duQWxsKCk7XG5cdFx0dGhpcy5fY29ubmVjdGlvbi5zdG9yZS5kaXNwb3NlKCk7XG5cdH1cblxuXHRwcml2YXRlIF9oYW5kbGVIZWFydGJlYXQoaXNDb25uZWN0aW5nPzogYm9vbGVhbikge1xuXHRcdHRoaXMuX2NsZWFySGVhcnRiZWF0VGltZW91dHMoKTtcblx0XHR0aGlzLl9oZWFydGJlYXRGaXJzdFRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHRoaXMuX2hhbmRsZUhlYXJ0YmVhdEZpcnN0VGltZW91dCgpLCBpc0Nvbm5lY3RpbmcgPyBIZWFydGJlYXRDb25zdGFudHMuQ29ubmVjdGluZ0JlYXRJbnRlcnZhbCA6IChIZWFydGJlYXRDb25zdGFudHMuQmVhdEludGVydmFsICogSGVhcnRiZWF0Q29uc3RhbnRzLkZpcnN0V2FpdE11bHRpcGxpZXIpKTtcblx0XHRpZiAoIXRoaXMuX2lzUmVzcG9uc2l2ZSkge1xuXHRcdFx0dGhpcy5faXNSZXNwb25zaXZlID0gdHJ1ZTtcblx0XHRcdHRoaXMuX29uUHR5SG9zdFJlc3BvbnNpdmUuZmlyZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2hhbmRsZUhlYXJ0YmVhdEZpcnN0VGltZW91dCgpIHtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLndhcm4oYE5vIHB0eUhvc3QgaGVhcnRiZWF0IGFmdGVyICR7SGVhcnRiZWF0Q29uc3RhbnRzLkJlYXRJbnRlcnZhbCAqIEhlYXJ0YmVhdENvbnN0YW50cy5GaXJzdFdhaXRNdWx0aXBsaWVyIC8gMTAwMH0gc2Vjb25kc2ApO1xuXHRcdHRoaXMuX2hlYXJ0YmVhdEZpcnN0VGltZW91dCA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9oZWFydGJlYXRTZWNvbmRUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB0aGlzLl9oYW5kbGVIZWFydGJlYXRTZWNvbmRUaW1lb3V0KCksIEhlYXJ0YmVhdENvbnN0YW50cy5CZWF0SW50ZXJ2YWwgKiBIZWFydGJlYXRDb25zdGFudHMuU2Vjb25kV2FpdE11bHRpcGxpZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaGFuZGxlSGVhcnRiZWF0U2Vjb25kVGltZW91dCgpIHtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGBObyBwdHlIb3N0IGhlYXJ0YmVhdCBhZnRlciAkeyhIZWFydGJlYXRDb25zdGFudHMuQmVhdEludGVydmFsICogSGVhcnRiZWF0Q29uc3RhbnRzLkZpcnN0V2FpdE11bHRpcGxpZXIgKyBIZWFydGJlYXRDb25zdGFudHMuQmVhdEludGVydmFsICogSGVhcnRiZWF0Q29uc3RhbnRzLkZpcnN0V2FpdE11bHRpcGxpZXIpIC8gMTAwMH0gc2Vjb25kc2ApO1xuXHRcdHRoaXMuX2hlYXJ0YmVhdFNlY29uZFRpbWVvdXQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKHRoaXMuX2lzUmVzcG9uc2l2ZSkge1xuXHRcdFx0dGhpcy5faXNSZXNwb25zaXZlID0gZmFsc2U7XG5cdFx0XHR0aGlzLl9vblB0eUhvc3RVbnJlc3BvbnNpdmUuZmlyZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2hhbmRsZVVucmVzcG9uc2l2ZUNyZWF0ZVByb2Nlc3MoKSB7XG5cdFx0dGhpcy5fY2xlYXJIZWFydGJlYXRUaW1lb3V0cygpO1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoYE5vIHB0eUhvc3QgcmVzcG9uc2UgdG8gY3JlYXRlUHJvY2VzcyBhZnRlciAke0hlYXJ0YmVhdENvbnN0YW50cy5DcmVhdGVQcm9jZXNzVGltZW91dCAvIDEwMDB9IHNlY29uZHNgKTtcblx0XHRpZiAodGhpcy5faXNSZXNwb25zaXZlKSB7XG5cdFx0XHR0aGlzLl9pc1Jlc3BvbnNpdmUgPSBmYWxzZTtcblx0XHRcdHRoaXMuX29uUHR5SG9zdFVucmVzcG9uc2l2ZS5maXJlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfY2xlYXJIZWFydGJlYXRUaW1lb3V0cygpIHtcblx0XHRpZiAodGhpcy5faGVhcnRiZWF0Rmlyc3RUaW1lb3V0KSB7XG5cdFx0XHRjbGVhclRpbWVvdXQodGhpcy5faGVhcnRiZWF0Rmlyc3RUaW1lb3V0KTtcblx0XHRcdHRoaXMuX2hlYXJ0YmVhdEZpcnN0VGltZW91dCA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2hlYXJ0YmVhdFNlY29uZFRpbWVvdXQpIHtcblx0XHRcdGNsZWFyVGltZW91dCh0aGlzLl9oZWFydGJlYXRTZWNvbmRUaW1lb3V0KTtcblx0XHRcdHRoaXMuX2hlYXJ0YmVhdFNlY29uZFRpbWVvdXQgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVzb2x2ZVZhcmlhYmxlcyh3b3Jrc3BhY2VJZDogc3RyaW5nLCB0ZXh0OiBzdHJpbmdbXSk6IFByb21pc2U8c3RyaW5nW10+IHtcblx0XHRyZXR1cm4gdGhpcy5fcmVzb2x2ZVZhcmlhYmxlc1JlcXVlc3RTdG9yZS5jcmVhdGVSZXF1ZXN0KHsgd29ya3NwYWNlSWQsIG9yaWdpbmFsVGV4dDogdGV4dCB9KTtcblx0fVxuXHRhc3luYyBhY2NlcHRQdHlIb3N0UmVzb2x2ZWRWYXJpYWJsZXMocmVxdWVzdElkOiBudW1iZXIsIHJlc29sdmVkOiBzdHJpbmdbXSkge1xuXHRcdHRoaXMuX3Jlc29sdmVWYXJpYWJsZXNSZXF1ZXN0U3RvcmUuYWNjZXB0UmVwbHkocmVxdWVzdElkLCByZXNvbHZlZCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxZQUFZLG9CQUFvQjtBQUN6QyxTQUE4QixJQUFxQixpQkFBaUI7QUFDcEUsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxhQUFhLGdCQUFnQixnQkFBZ0I7QUFDdEQsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUywyQkFBMkI7QUFFcEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxvQkFBc1gs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
