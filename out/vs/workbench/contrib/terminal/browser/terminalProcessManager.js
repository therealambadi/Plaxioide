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
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { isMacintosh, isWindows, OperatingSystem, OS } from "../../../../base/common/platform.js";
import { localize } from "../../../../nls.js";
import { formatMessageForTerminal } from "../../../../platform/terminal/common/terminalStrings.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { getRemoteAuthority } from "../../../../platform/remote/common/remoteHosts.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { TerminalCapability } from "../../../../platform/terminal/common/capabilities/capabilities.js";
import { NaiveCwdDetectionCapability } from "../../../../platform/terminal/common/capabilities/naiveCwdDetectionCapability.js";
import { TerminalCapabilityStore } from "../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js";
import { FlowControlConstants, ITerminalLogService, ProcessPropertyType, TerminalSettingId } from "../../../../platform/terminal/common/terminal.js";
import { TerminalRecorder } from "../../../../platform/terminal/common/terminalRecorder.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { EnvironmentVariableInfoChangesActive, EnvironmentVariableInfoStale } from "./environmentVariableInfo.js";
import { ITerminalConfigurationService, ITerminalInstanceService } from "./terminal.js";
import { IEnvironmentVariableService } from "../common/environmentVariable.js";
import { MergedEnvironmentVariableCollection } from "../../../../platform/terminal/common/environmentVariableCollection.js";
import { serializeEnvironmentVariableCollections } from "../../../../platform/terminal/common/environmentVariableShared.js";
import { ITerminalProfileResolverService, ProcessState } from "../common/terminal.js";
import * as terminalEnvironment from "../common/terminalEnvironment.js";
import { IConfigurationResolverService } from "../../../services/configurationResolver/common/configurationResolver.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IHistoryService } from "../../../services/history/common/history.js";
import { IPathService } from "../../../services/path/common/pathService.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { TaskSettingId } from "../../tasks/common/tasks.js";
import Severity from "../../../../base/common/severity.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { getActiveWindow, runWhenWindowIdle } from "../../../../base/browser/dom.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { shouldUseEnvironmentVariableCollection } from "../../../../platform/terminal/common/terminalEnvironment.js";
import { TerminalContribSettingId } from "../terminalContribExports.js";
var ProcessConstants = /* @__PURE__ */ ((ProcessConstants2) => {
  ProcessConstants2[ProcessConstants2["ErrorLaunchThresholdDuration"] = 500] = "ErrorLaunchThresholdDuration";
  ProcessConstants2[ProcessConstants2["LatencyMeasuringInterval"] = 1e3] = "LatencyMeasuringInterval";
  return ProcessConstants2;
})(ProcessConstants || {});
var ProcessType = /* @__PURE__ */ ((ProcessType2) => {
  ProcessType2[ProcessType2["Process"] = 0] = "Process";
  ProcessType2[ProcessType2["PsuedoTerminal"] = 1] = "PsuedoTerminal";
  return ProcessType2;
})(ProcessType || {});
let TerminalProcessManager = class extends Disposable {
  constructor(_instanceId, cwd, environmentVariableCollections, shellIntegrationNonce, _historyService, _instantiationService, _logService, _workspaceContextService, _configurationResolverService, _workbenchEnvironmentService, _productService, _remoteAgentService, _pathService, _environmentVariableService, _terminalConfigurationService, _terminalProfileResolverService, _configurationService, _terminalInstanceService, _telemetryService, _notificationService) {
    super();
    this._instanceId = _instanceId;
    this._historyService = _historyService;
    this._instantiationService = _instantiationService;
    this._logService = _logService;
    this._workspaceContextService = _workspaceContextService;
    this._configurationResolverService = _configurationResolverService;
    this._workbenchEnvironmentService = _workbenchEnvironmentService;
    this._productService = _productService;
    this._remoteAgentService = _remoteAgentService;
    this._pathService = _pathService;
    this._environmentVariableService = _environmentVariableService;
    this._terminalConfigurationService = _terminalConfigurationService;
    this._terminalProfileResolverService = _terminalProfileResolverService;
    this._configurationService = _configurationService;
    this._terminalInstanceService = _terminalInstanceService;
    this._telemetryService = _telemetryService;
    this._notificationService = _notificationService;
    this.processState = ProcessState.Uninitialized;
    this.capabilities = this._register(new TerminalCapabilityStore());
    this._isDisposed = false;
    this._process = null;
    this._processType = 0 /* Process */;
    this._preLaunchInputQueue = [];
    this._hasWrittenData = false;
    this._hasChildProcesses = false;
    this._ptyListenersAttached = false;
    this._isDisconnected = false;
    this._dimensions = { cols: 0, rows: 0 };
    this._onPtyDisconnect = this._register(new Emitter());
    this.onPtyDisconnect = this._onPtyDisconnect.event;
    this._onPtyReconnect = this._register(new Emitter());
    this.onPtyReconnect = this._onPtyReconnect.event;
    this._onProcessReady = this._register(new Emitter());
    this.onProcessReady = this._onProcessReady.event;
    this._onProcessStateChange = this._register(new Emitter());
    this.onProcessStateChange = this._onProcessStateChange.event;
    this._onBeforeProcessData = this._register(new Emitter());
    this.onBeforeProcessData = this._onBeforeProcessData.event;
    this._onProcessData = this._register(new Emitter());
    this.onProcessData = this._onProcessData.event;
    this._onProcessReplayComplete = this._register(new Emitter());
    this.onProcessReplayComplete = this._onProcessReplayComplete.event;
    this._onDidChangeProperty = this._register(new Emitter());
    this.onDidChangeProperty = this._onDidChangeProperty.event;
    this._onEnvironmentVariableInfoChange = this._register(new Emitter());
    this.onEnvironmentVariableInfoChanged = this._onEnvironmentVariableInfoChange.event;
    this._onProcessExit = this._register(new Emitter());
    this.onProcessExit = this._onProcessExit.event;
    this._onRestoreCommands = this._register(new Emitter());
    this.onRestoreCommands = this._onRestoreCommands.event;
    this._cwdWorkspaceFolder = terminalEnvironment.getWorkspaceForTerminal(cwd, this._workspaceContextService, this._historyService);
    this.ptyProcessReady = this._createPtyProcessReadyPromise();
    this._ackDataBufferer = new AckDataBufferer((e) => this._process?.acknowledgeDataEvent(e));
    this._dataFilter = this._register(this._instantiationService.createInstance(SeamlessRelaunchDataFilter));
    this._register(this._dataFilter.onProcessData((ev) => {
      const data = typeof ev === "string" ? ev : ev.data;
      const beforeProcessDataEvent = { data };
      this._onBeforeProcessData.fire(beforeProcessDataEvent);
      if (beforeProcessDataEvent.data && beforeProcessDataEvent.data.length > 0) {
        if (typeof ev !== "string") {
          ev.data = beforeProcessDataEvent.data;
        }
        this._onProcessData.fire(typeof ev !== "string" ? ev : { data: beforeProcessDataEvent.data, trackCommit: false });
      }
    }));
    if (cwd && typeof cwd === "object") {
      this.remoteAuthority = getRemoteAuthority(cwd);
    } else {
      this.remoteAuthority = this._workbenchEnvironmentService.remoteAuthority;
    }
    if (environmentVariableCollections) {
      this._extEnvironmentVariableCollection = new MergedEnvironmentVariableCollection(environmentVariableCollections);
      this._register(this._environmentVariableService.onDidChangeCollections((newCollection) => this._onEnvironmentVariableCollectionChange(newCollection)));
      this.environmentVariableInfo = this._instantiationService.createInstance(EnvironmentVariableInfoChangesActive, this._extEnvironmentVariableCollection);
      this._onEnvironmentVariableInfoChange.fire(this.environmentVariableInfo);
    }
    this.shellIntegrationNonce = shellIntegrationNonce ?? generateUuid();
  }
  get persistentProcessId() {
    return this._process?.id;
  }
  get shouldPersist() {
    return !!this.reconnectionProperties || (this._process ? this._process.shouldPersist : false);
  }
  get hasWrittenData() {
    return this._hasWrittenData;
  }
  get hasChildProcesses() {
    return this._hasChildProcesses;
  }
  get reconnectionProperties() {
    return this._shellLaunchConfig?.attachPersistentProcess?.reconnectionProperties || this._shellLaunchConfig?.reconnectionProperties || void 0;
  }
  get extEnvironmentVariableCollection() {
    return this._extEnvironmentVariableCollection;
  }
  get processTraits() {
    return this._processTraits;
  }
  async freePortKillProcess(port) {
    try {
      if (this._process?.freePortKillProcess) {
        await this._process?.freePortKillProcess(port);
      }
    } catch (e) {
      this._notificationService.notify({ message: localize("killportfailure", "Could not kill process listening on port {0}, command exited with error {1}", port, e), severity: Severity.Warning });
    }
  }
  dispose(immediate = false) {
    this._isDisposed = true;
    if (this._process) {
      this._setProcessState(ProcessState.KilledByUser);
      this._process.shutdown(immediate);
      this._process = null;
    }
    super.dispose();
  }
  _createPtyProcessReadyPromise() {
    return new Promise((c) => {
      const listener = Event.once(this.onProcessReady)(() => {
        this._logService.debug(`Terminal process ready (shellProcessId: ${this.shellProcessId})`);
        this._store.delete(listener);
        c(void 0);
      });
      this._store.add(listener);
    });
  }
  async detachFromProcess(forcePersist) {
    await this._process?.detach?.(forcePersist);
    this._process = null;
  }
  async createProcess(shellLaunchConfig, cols, rows, reset = true) {
    this._shellLaunchConfig = shellLaunchConfig;
    this._dimensions.cols = cols;
    this._dimensions.rows = rows;
    let newProcess;
    if (shellLaunchConfig.customPtyImplementation) {
      this._processType = 1 /* PsuedoTerminal */;
      newProcess = shellLaunchConfig.customPtyImplementation(this._instanceId, cols, rows);
    } else {
      const backend = await this._terminalInstanceService.getBackend(this.remoteAuthority);
      if (!backend) {
        throw new Error(`No terminal backend registered for remote authority '${this.remoteAuthority}'`);
      }
      this.backend = backend;
      const variableResolver = terminalEnvironment.createVariableResolver(this._cwdWorkspaceFolder, await this._terminalProfileResolverService.getEnvironment(this.remoteAuthority), this._configurationResolverService);
      this.userHome = this._pathService.resolvedUserHome?.fsPath;
      this.os = OS;
      if (!!this.remoteAuthority) {
        const userHomeUri = await this._pathService.userHome();
        this.userHome = userHomeUri.path;
        const remoteEnv = await this._remoteAgentService.getEnvironment();
        if (!remoteEnv) {
          throw new Error(`Failed to get remote environment for remote authority "${this.remoteAuthority}"`);
        }
        this.userHome = remoteEnv.userHome.path;
        this.os = remoteEnv.os;
        const env = await this._resolveEnvironment(backend, variableResolver, shellLaunchConfig);
        const shouldPersist = (this._configurationService.getValue(TaskSettingId.Reconnection) && shellLaunchConfig.reconnectionProperties || !shellLaunchConfig.isFeatureTerminal) && this._terminalConfigurationService.config.enablePersistentSessions && !shellLaunchConfig.isTransient;
        if (shellLaunchConfig.attachPersistentProcess) {
          const result2 = await backend.attachToProcess(shellLaunchConfig.attachPersistentProcess.id);
          if (result2) {
            newProcess = result2;
          } else {
            this._logService.warn(`Attach to process failed for terminal`, shellLaunchConfig.attachPersistentProcess);
            shellLaunchConfig.attachPersistentProcess = void 0;
          }
        }
        if (!newProcess) {
          await this._terminalProfileResolverService.resolveShellLaunchConfig(shellLaunchConfig, {
            remoteAuthority: this.remoteAuthority,
            os: this.os
          });
          const options = {
            shellIntegration: {
              enabled: this._configurationService.getValue(TerminalSettingId.ShellIntegrationEnabled),
              suggestEnabled: this._configurationService.getValue(TerminalContribSettingId.SuggestEnabled),
              nonce: this.shellIntegrationNonce
            },
            windowsEnableConpty: this._terminalConfigurationService.config.windowsEnableConpty,
            windowsUseConptyDll: this._terminalConfigurationService.config.windowsUseConptyDll ?? false,
            environmentVariableCollections: this._extEnvironmentVariableCollection?.collections ? serializeEnvironmentVariableCollections(this._extEnvironmentVariableCollection.collections) : void 0,
            workspaceFolder: this._cwdWorkspaceFolder
          };
          try {
            newProcess = await backend.createProcess(
              shellLaunchConfig,
              "",
              // TODO: Fix cwd
              cols,
              rows,
              this._terminalConfigurationService.config.unicodeVersion,
              env,
              // TODO:
              options,
              shouldPersist
            );
          } catch (e) {
            if (e?.message === "Could not fetch remote environment") {
              this._logService.trace(`Could not fetch remote environment, silently failing`);
              return void 0;
            }
            throw e;
          }
        }
        if (!this._isDisposed) {
          this._setupPtyHostListeners(backend);
        }
      } else {
        if (shellLaunchConfig.attachPersistentProcess) {
          const result2 = shellLaunchConfig.attachPersistentProcess.findRevivedId ? await backend.attachToRevivedProcess(shellLaunchConfig.attachPersistentProcess.id) : await backend.attachToProcess(shellLaunchConfig.attachPersistentProcess.id);
          if (result2) {
            newProcess = result2;
          } else {
            this._logService.warn(`Attach to process failed for terminal`, shellLaunchConfig.attachPersistentProcess);
            shellLaunchConfig.attachPersistentProcess = void 0;
          }
        }
        if (!newProcess) {
          newProcess = await this._launchLocalProcess(backend, shellLaunchConfig, cols, rows, this.userHome, variableResolver);
        }
        if (!this._isDisposed) {
          this._setupPtyHostListeners(backend);
        }
      }
    }
    if (this._isDisposed) {
      newProcess.shutdown(false);
      return void 0;
    }
    this._process = newProcess;
    this._setProcessState(ProcessState.Launching);
    if (this.os === OperatingSystem.Linux || this.os === OperatingSystem.Macintosh) {
      this.capabilities.add(TerminalCapability.NaiveCwdDetection, new NaiveCwdDetectionCapability(this._process));
    }
    this._dataFilter.newProcess(this._process, reset);
    if (this._processListeners) {
      dispose(this._processListeners);
    }
    this._processListeners = [
      newProcess.onProcessReady((e) => {
        this._processTraits = e;
        this.shellProcessId = e.pid;
        this._initialCwd = e.cwd;
        this._onDidChangeProperty.fire({ type: ProcessPropertyType.InitialCwd, value: this._initialCwd });
        this._onProcessReady.fire(e);
        if (this._preLaunchInputQueue.length > 0 && this._process) {
          newProcess.input(this._preLaunchInputQueue.join(""));
          this._preLaunchInputQueue.length = 0;
        }
      }),
      newProcess.onProcessExit((exitCode) => this._onExit(exitCode)),
      newProcess.onDidChangeProperty(({ type, value }) => {
        switch (type) {
          case ProcessPropertyType.HasChildProcesses:
            this._hasChildProcesses = value;
            break;
          case ProcessPropertyType.FailedShellIntegrationActivation:
            this._telemetryService?.publicLog2("terminal/shellIntegrationActivationFailureCustomArgs");
            break;
        }
        this._onDidChangeProperty.fire({ type, value });
      })
    ];
    if (newProcess.onProcessReplayComplete) {
      this._processListeners.push(newProcess.onProcessReplayComplete(() => this._onProcessReplayComplete.fire()));
    }
    if (newProcess.onRestoreCommands) {
      this._processListeners.push(newProcess.onRestoreCommands((e) => this._onRestoreCommands.fire(e)));
    }
    setTimeout(() => {
      if (this.processState === ProcessState.Launching) {
        this._setProcessState(ProcessState.Running);
      }
    }, 500 /* ErrorLaunchThresholdDuration */);
    const result = await newProcess.start();
    if (result) {
      return result;
    }
    runWhenWindowIdle(getActiveWindow(), () => {
      this.backend?.getLatency().then((measurements) => {
        this._logService.info(`Latency measurements for ${this.remoteAuthority ?? "local"} backend
${measurements.map((e) => `${e.label}: ${e.latency.toFixed(2)}ms`).join("\n")}`);
      });
    });
    return void 0;
  }
  async relaunch(shellLaunchConfig, cols, rows, reset) {
    this.ptyProcessReady = this._createPtyProcessReadyPromise();
    this._logService.trace(`Relaunching terminal instance ${this._instanceId}`);
    if (this._isDisconnected) {
      this._isDisconnected = false;
      this._onPtyReconnect.fire();
    }
    this._hasWrittenData = false;
    return this.createProcess(shellLaunchConfig, cols, rows, reset);
  }
  // Fetch any extension environment additions and apply them
  async _resolveEnvironment(backend, variableResolver, shellLaunchConfig) {
    const workspaceFolder = terminalEnvironment.getWorkspaceForTerminal(shellLaunchConfig.cwd, this._workspaceContextService, this._historyService);
    const platformKey = isWindows ? "windows" : isMacintosh ? "osx" : "linux";
    const envFromConfigValue = this._configurationService.getValue(`terminal.integrated.env.${platformKey}`);
    let baseEnv;
    if (shellLaunchConfig.useShellEnvironment) {
      baseEnv = await backend.getShellEnvironment();
    } else {
      baseEnv = await this._terminalProfileResolverService.getEnvironment(this.remoteAuthority);
    }
    const env = await terminalEnvironment.createTerminalEnvironment(shellLaunchConfig, envFromConfigValue, variableResolver, this._productService.version, this._terminalConfigurationService.config.detectLocale, baseEnv);
    if (!this._isDisposed && shouldUseEnvironmentVariableCollection(shellLaunchConfig)) {
      this._extEnvironmentVariableCollection = this._environmentVariableService.mergedCollection;
      this._register(this._environmentVariableService.onDidChangeCollections((newCollection) => this._onEnvironmentVariableCollectionChange(newCollection)));
      await this._extEnvironmentVariableCollection.applyToProcessEnvironment(env, { workspaceFolder }, variableResolver);
      if (this._extEnvironmentVariableCollection.getVariableMap({ workspaceFolder }).size) {
        this.environmentVariableInfo = this._instantiationService.createInstance(EnvironmentVariableInfoChangesActive, this._extEnvironmentVariableCollection);
        this._onEnvironmentVariableInfoChange.fire(this.environmentVariableInfo);
      }
    }
    return env;
  }
  async _launchLocalProcess(backend, shellLaunchConfig, cols, rows, userHome, variableResolver) {
    await this._terminalProfileResolverService.resolveShellLaunchConfig(shellLaunchConfig, {
      remoteAuthority: void 0,
      os: OS
    });
    const activeWorkspaceRootUri = this._historyService.getLastActiveWorkspaceRoot(Schemas.file);
    const initialCwd = await terminalEnvironment.getCwd(
      shellLaunchConfig,
      userHome,
      variableResolver,
      activeWorkspaceRootUri,
      this._terminalConfigurationService.config.cwd,
      this._logService
    );
    const env = await this._resolveEnvironment(backend, variableResolver, shellLaunchConfig);
    const options = {
      shellIntegration: {
        enabled: this._configurationService.getValue(TerminalSettingId.ShellIntegrationEnabled),
        suggestEnabled: this._configurationService.getValue(TerminalContribSettingId.SuggestEnabled),
        nonce: this.shellIntegrationNonce
      },
      windowsEnableConpty: this._terminalConfigurationService.config.windowsEnableConpty,
      windowsUseConptyDll: this._terminalConfigurationService.config.windowsUseConptyDll ?? false,
      environmentVariableCollections: this._extEnvironmentVariableCollection ? serializeEnvironmentVariableCollections(this._extEnvironmentVariableCollection.collections) : void 0,
      workspaceFolder: this._cwdWorkspaceFolder
    };
    const shouldPersist = (this._configurationService.getValue(TaskSettingId.Reconnection) && shellLaunchConfig.reconnectionProperties || !shellLaunchConfig.isFeatureTerminal) && this._terminalConfigurationService.config.enablePersistentSessions && !shellLaunchConfig.isTransient;
    return await backend.createProcess(shellLaunchConfig, initialCwd, cols, rows, this._terminalConfigurationService.config.unicodeVersion, env, options, shouldPersist);
  }
  _setupPtyHostListeners(backend) {
    if (this._ptyListenersAttached) {
      return;
    }
    this._ptyListenersAttached = true;
    this._register(backend.onPtyHostUnresponsive(() => {
      this._isDisconnected = true;
      this._onPtyDisconnect.fire();
    }));
    this._ptyResponsiveListener = backend.onPtyHostResponsive(() => {
      this._isDisconnected = false;
      this._onPtyReconnect.fire();
    });
    this._register(toDisposable(() => this._ptyResponsiveListener?.dispose()));
    this._register(backend.onPtyHostRestart(async () => {
      if (!this._isDisconnected) {
        this._isDisconnected = true;
        this._onPtyDisconnect.fire();
      }
      this._ptyResponsiveListener?.dispose();
      this._ptyResponsiveListener = void 0;
      if (this._shellLaunchConfig) {
        if (this._shellLaunchConfig.isFeatureTerminal && !this.reconnectionProperties) {
          this._onExit(-1);
        } else {
          const message = localize("ptyHostRelaunch", "Restarting the terminal because the connection to the shell process was lost...");
          this._onProcessData.fire({ data: formatMessageForTerminal(message, { loudFormatting: true }), trackCommit: false });
          await this.relaunch(this._shellLaunchConfig, this._dimensions.cols, this._dimensions.rows, false);
        }
      }
    }));
  }
  async getBackendOS() {
    let os = OS;
    if (!!this.remoteAuthority) {
      const remoteEnv = await this._remoteAgentService.getEnvironment();
      if (!remoteEnv) {
        throw new Error(`Failed to get remote environment for remote authority "${this.remoteAuthority}"`);
      }
      os = remoteEnv.os;
    }
    return os;
  }
  setDimensions(cols, rows, sync) {
    if (sync) {
      this._resize(cols, rows);
      return;
    }
    return this.ptyProcessReady.then(() => this._resize(cols, rows));
  }
  async setUnicodeVersion(version) {
    return this._process?.setUnicodeVersion(version);
  }
  _resize(cols, rows) {
    if (!this._process) {
      return;
    }
    try {
      this._process.resize(cols, rows);
    } catch (error) {
      if (error.code !== "EPIPE" && error.code !== "ERR_IPC_CHANNEL_CLOSED") {
        throw error;
      }
    }
    this._dimensions.cols = cols;
    this._dimensions.rows = rows;
  }
  async write(data) {
    await this.ptyProcessReady;
    this._dataFilter.disableSeamlessRelaunch();
    this._hasWrittenData = true;
    if (this.shellProcessId || this._processType === 1 /* PsuedoTerminal */) {
      if (this._process) {
        this._process.input(data);
      }
    } else {
      this._preLaunchInputQueue.push(data);
    }
  }
  async processBinary(data) {
    await this.ptyProcessReady;
    this._dataFilter.disableSeamlessRelaunch();
    this._hasWrittenData = true;
    this._process?.processBinary(data);
  }
  get initialCwd() {
    return this._initialCwd ?? "";
  }
  async refreshProperty(type) {
    if (!this._process) {
      throw new Error("Cannot refresh property when process is not set");
    }
    return this._process.refreshProperty(type);
  }
  async updateProperty(type, value) {
    return this._process?.updateProperty(type, value);
  }
  acknowledgeDataEvent(charCount) {
    this._ackDataBufferer.ack(charCount);
  }
  _onExit(exitCode) {
    this._process = null;
    if (this.processState === ProcessState.Launching) {
      this._setProcessState(ProcessState.KilledDuringLaunch);
    }
    if (this.processState === ProcessState.Running) {
      this._setProcessState(ProcessState.KilledByProcess);
    }
    this._onProcessExit.fire(exitCode);
  }
  _setProcessState(state) {
    this.processState = state;
    this._onProcessStateChange.fire();
  }
  _onEnvironmentVariableCollectionChange(newCollection) {
    const diff = this._extEnvironmentVariableCollection.diff(newCollection, { workspaceFolder: this._cwdWorkspaceFolder });
    if (diff === void 0) {
      if (this.environmentVariableInfo instanceof EnvironmentVariableInfoStale) {
        this.environmentVariableInfo = this._instantiationService.createInstance(EnvironmentVariableInfoChangesActive, this._extEnvironmentVariableCollection);
        this._onEnvironmentVariableInfoChange.fire(this.environmentVariableInfo);
      }
      return;
    }
    this.environmentVariableInfo = this._instantiationService.createInstance(EnvironmentVariableInfoStale, diff, this._instanceId, newCollection);
    this._onEnvironmentVariableInfoChange.fire(this.environmentVariableInfo);
  }
  async clearBuffer() {
    this._process?.clearBuffer?.();
  }
};
TerminalProcessManager = __decorateClass([
  __decorateParam(4, IHistoryService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, ITerminalLogService),
  __decorateParam(7, IWorkspaceContextService),
  __decorateParam(8, IConfigurationResolverService),
  __decorateParam(9, IWorkbenchEnvironmentService),
  __decorateParam(10, IProductService),
  __decorateParam(11, IRemoteAgentService),
  __decorateParam(12, IPathService),
  __decorateParam(13, IEnvironmentVariableService),
  __decorateParam(14, ITerminalConfigurationService),
  __decorateParam(15, ITerminalProfileResolverService),
  __decorateParam(16, IConfigurationService),
  __decorateParam(17, ITerminalInstanceService),
  __decorateParam(18, ITelemetryService),
  __decorateParam(19, INotificationService)
], TerminalProcessManager);
class AckDataBufferer {
  constructor(_callback) {
    this._callback = _callback;
    this._unsentCharCount = 0;
  }
  ack(charCount) {
    this._unsentCharCount += charCount;
    while (this._unsentCharCount > FlowControlConstants.CharCountAckSize) {
      this._unsentCharCount -= FlowControlConstants.CharCountAckSize;
      this._callback(FlowControlConstants.CharCountAckSize);
    }
  }
}
var SeamlessRelaunchConstants = /* @__PURE__ */ ((SeamlessRelaunchConstants2) => {
  SeamlessRelaunchConstants2[SeamlessRelaunchConstants2["RecordTerminalDuration"] = 1e4] = "RecordTerminalDuration";
  SeamlessRelaunchConstants2[SeamlessRelaunchConstants2["SwapWaitMaximumDuration"] = 3e3] = "SwapWaitMaximumDuration";
  return SeamlessRelaunchConstants2;
})(SeamlessRelaunchConstants || {});
let SeamlessRelaunchDataFilter = class extends Disposable {
  constructor(_logService) {
    super();
    this._logService = _logService;
    this._disableSeamlessRelaunch = false;
    this._onProcessData = this._register(new Emitter());
  }
  get onProcessData() {
    return this._onProcessData.event;
  }
  newProcess(process, reset) {
    this._dataListener?.dispose();
    this._activeProcess?.shutdown(false);
    this._activeProcess = process;
    if (!this._firstRecorder || !reset || this._disableSeamlessRelaunch) {
      this._firstDisposable?.dispose();
      [this._firstRecorder, this._firstDisposable] = this._createRecorder(process);
      if (this._disableSeamlessRelaunch && reset) {
        this._onProcessData.fire("\x1Bc");
      }
      this._dataListener = process.onProcessData((e) => this._onProcessData.fire(e));
      this._disableSeamlessRelaunch = false;
      return;
    }
    if (this._secondRecorder) {
      this.triggerSwap();
    }
    this._swapTimeout = mainWindow.setTimeout(() => this.triggerSwap(), 3e3 /* SwapWaitMaximumDuration */);
    this._dataListener?.dispose();
    this._firstDisposable?.dispose();
    const recorder = this._createRecorder(process);
    [this._secondRecorder, this._secondDisposable] = recorder;
  }
  /**
   * Disables seamless relaunch for the active process
   */
  disableSeamlessRelaunch() {
    this._disableSeamlessRelaunch = true;
    this._stopRecording();
    this.triggerSwap();
  }
  /**
   * Trigger the swap of the processes if needed (eg. timeout, input)
   */
  triggerSwap() {
    if (this._swapTimeout) {
      mainWindow.clearTimeout(this._swapTimeout);
      this._swapTimeout = void 0;
    }
    if (!this._firstRecorder) {
      return;
    }
    if (!this._secondRecorder) {
      this._firstRecorder = void 0;
      this._firstDisposable?.dispose();
      return;
    }
    const firstData = this._getDataFromRecorder(this._firstRecorder);
    const secondData = this._getDataFromRecorder(this._secondRecorder);
    if (firstData === secondData) {
      this._logService.trace(`Seamless terminal relaunch - identical content`);
    } else {
      this._logService.trace(`Seamless terminal relaunch - resetting content`);
      this._onProcessData.fire({ data: `\x1Bc${secondData}`, trackCommit: false });
    }
    this._dataListener?.dispose();
    this._dataListener = this._activeProcess.onProcessData((e) => this._onProcessData.fire(e));
    this._firstRecorder = this._secondRecorder;
    this._firstDisposable?.dispose();
    this._firstDisposable = this._secondDisposable;
    this._secondRecorder = void 0;
  }
  _stopRecording() {
    if (this._swapTimeout) {
      return;
    }
    this._firstRecorder = void 0;
    this._firstDisposable?.dispose();
    this._secondRecorder = void 0;
    this._secondDisposable?.dispose();
  }
  _createRecorder(process) {
    const recorder = new TerminalRecorder(0, 0);
    const disposable = process.onProcessData((e) => recorder.handleData(typeof e === "string" ? e : e.data));
    return [recorder, disposable];
  }
  _getDataFromRecorder(recorder) {
    return recorder.generateReplayEventSync().events.filter((e) => !!e.data).map((e) => e.data).join("");
  }
};
SeamlessRelaunchDataFilter = __decorateClass([
  __decorateParam(0, ITerminalLogService)
], SeamlessRelaunchDataFilter);
export {
  TerminalProcessManager
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsUHJvY2Vzc01hbmFnZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIGRpc3Bvc2UsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgSVByb2Nlc3NFbnZpcm9ubWVudCwgaXNNYWNpbnRvc2gsIGlzV2luZG93cywgT3BlcmF0aW5nU3lzdGVtLCBPUyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBmb3JtYXRNZXNzYWdlRm9yVGVybWluYWwgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWxTdHJpbmdzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBnZXRSZW1vdGVBdXRob3JpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZUhvc3RzLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSVNlcmlhbGl6ZWRDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSwgVGVybWluYWxDYXBhYmlsaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy9jYXBhYmlsaXRpZXMuanMnO1xuaW1wb3J0IHsgTmFpdmVDd2REZXRlY3Rpb25DYXBhYmlsaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy9uYWl2ZUN3ZERldGVjdGlvbkNhcGFiaWxpdHkuanMnO1xuaW1wb3J0IHsgVGVybWluYWxDYXBhYmlsaXR5U3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL3Rlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlLmpzJztcbmltcG9ydCB7IEZsb3dDb250cm9sQ29uc3RhbnRzLCBJUHJvY2Vzc0RhdGFFdmVudCwgSVByb2Nlc3NQcm9wZXJ0eSwgSVByb2Nlc3NQcm9wZXJ0eU1hcCwgSVByb2Nlc3NSZWFkeUV2ZW50LCBJUmVjb25uZWN0aW9uUHJvcGVydGllcywgSVNoZWxsTGF1bmNoQ29uZmlnLCBJVGVybWluYWxCYWNrZW5kLCBJVGVybWluYWxDaGlsZFByb2Nlc3MsIElUZXJtaW5hbERpbWVuc2lvbnMsIElUZXJtaW5hbEVudmlyb25tZW50LCBJVGVybWluYWxMYXVuY2hFcnJvciwgSVRlcm1pbmFsTG9nU2VydmljZSwgSVRlcm1pbmFsUHJvY2Vzc09wdGlvbnMsIFByb2Nlc3NQcm9wZXJ0eVR5cGUsIFRlcm1pbmFsU2V0dGluZ0lkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsUmVjb3JkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWxSZWNvcmRlci5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIElXb3Jrc3BhY2VGb2xkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBFbnZpcm9ubWVudFZhcmlhYmxlSW5mb0NoYW5nZXNBY3RpdmUsIEVudmlyb25tZW50VmFyaWFibGVJbmZvU3RhbGUgfSBmcm9tICcuL2Vudmlyb25tZW50VmFyaWFibGVJbmZvLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLCBJVGVybWluYWxJbnN0YW5jZVNlcnZpY2UgfSBmcm9tICcuL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFZhcmlhYmxlSW5mbywgSUVudmlyb25tZW50VmFyaWFibGVTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2Vudmlyb25tZW50VmFyaWFibGUuanMnO1xuaW1wb3J0IHsgTWVyZ2VkRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vZW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2Vudmlyb25tZW50VmFyaWFibGVTaGFyZWQuanMnO1xuaW1wb3J0IHsgSUJlZm9yZVByb2Nlc3NEYXRhRXZlbnQsIElUZXJtaW5hbFByb2Nlc3NNYW5hZ2VyLCBJVGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlLCBQcm9jZXNzU3RhdGUgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0ICogYXMgdGVybWluYWxFbnZpcm9ubWVudCBmcm9tICcuLi9jb21tb24vdGVybWluYWxFbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2NvbmZpZ3VyYXRpb25SZXNvbHZlci9jb21tb24vY29uZmlndXJhdGlvblJlc29sdmVyLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElIaXN0b3J5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2hpc3RvcnkvY29tbW9uL2hpc3RvcnkuanMnO1xuaW1wb3J0IHsgSVBhdGhTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcGF0aC9jb21tb24vcGF0aFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3JlbW90ZS9jb21tb24vcmVtb3RlQWdlbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRhc2tTZXR0aW5nSWQgfSBmcm9tICcuLi8uLi90YXNrcy9jb21tb24vdGFza3MuanMnO1xuaW1wb3J0IFNldmVyaXR5IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3NldmVyaXR5LmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uLCBJTWVyZ2VkRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vZW52aXJvbm1lbnRWYXJpYWJsZS5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCB7IGdldEFjdGl2ZVdpbmRvdywgcnVuV2hlbldpbmRvd0lkbGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IHNob3VsZFVzZUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsRW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgVGVybWluYWxDb250cmliU2V0dGluZ0lkIH0gZnJvbSAnLi4vdGVybWluYWxDb250cmliRXhwb3J0cy5qcyc7XG5cbmNvbnN0IGVudW0gUHJvY2Vzc0NvbnN0YW50cyB7XG5cdC8qKlxuXHQgKiBUaGUgYW1vdW50IG9mIHRpbWUgdG8gY29uc2lkZXIgdGVybWluYWwgZXJyb3JzIHRvIGJlIHJlbGF0ZWQgdG8gdGhlIGxhdW5jaC5cblx0ICovXG5cdEVycm9yTGF1bmNoVGhyZXNob2xkRHVyYXRpb24gPSA1MDAsXG5cdC8qKlxuXHQgKiBUaGUgbWluaW11bSBhbW91bnQgb2YgdGltZSBiZXR3ZWVuIGxhdGVuY3kgcmVxdWVzdHMuXG5cdCAqL1xuXHRMYXRlbmN5TWVhc3VyaW5nSW50ZXJ2YWwgPSAxMDAwLFxufVxuXG5jb25zdCBlbnVtIFByb2Nlc3NUeXBlIHtcblx0UHJvY2Vzcyxcblx0UHN1ZWRvVGVybWluYWxcbn1cblxuLyoqXG4gKiBIb2xkcyBhbGwgc3RhdGUgcmVsYXRlZCB0byB0aGUgY3JlYXRpb24gYW5kIG1hbmFnZW1lbnQgb2YgdGVybWluYWwgcHJvY2Vzc2VzLlxuICpcbiAqIEludGVybmFsIGRlZmluaXRpb25zOlxuICogLSBQcm9jZXNzOiBUaGUgcHJvY2VzcyBsYXVuY2hlZCB3aXRoIHRoZSB0ZXJtaW5hbFByb2Nlc3MudHMgZmlsZSwgb3IgdGhlIHB0eSBhcyBhIHdob2xlXG4gKiAtIFB0eSBQcm9jZXNzOiBUaGUgcHNldWRvdGVybWluYWwgcGFyZW50IHByb2Nlc3MgKG9yIHRoZSBjb25wdHkvd2lucHR5IGFnZW50IHByb2Nlc3MpXG4gKiAtIFNoZWxsIFByb2Nlc3M6IFRoZSBwc2V1ZG90ZXJtaW5hbCBjaGlsZCBwcm9jZXNzIChpZS4gdGhlIHNoZWxsKVxuICovXG5leHBvcnQgY2xhc3MgVGVybWluYWxQcm9jZXNzTWFuYWdlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVGVybWluYWxQcm9jZXNzTWFuYWdlciB7XG5cdHByb2Nlc3NTdGF0ZTogUHJvY2Vzc1N0YXRlID0gUHJvY2Vzc1N0YXRlLlVuaW5pdGlhbGl6ZWQ7XG5cdHB0eVByb2Nlc3NSZWFkeTogUHJvbWlzZTx2b2lkPjtcblx0c2hlbGxQcm9jZXNzSWQ6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgcmVtb3RlQXV0aG9yaXR5OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdG9zOiBPcGVyYXRpbmdTeXN0ZW0gfCB1bmRlZmluZWQ7XG5cdHVzZXJIb21lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGVudmlyb25tZW50VmFyaWFibGVJbmZvOiBJRW52aXJvbm1lbnRWYXJpYWJsZUluZm8gfCB1bmRlZmluZWQ7XG5cdGJhY2tlbmQ6IElUZXJtaW5hbEJhY2tlbmQgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGNhcGFiaWxpdGllcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBUZXJtaW5hbENhcGFiaWxpdHlTdG9yZSgpKTtcblx0cmVhZG9ubHkgc2hlbGxJbnRlZ3JhdGlvbk5vbmNlOiBzdHJpbmc7XG5cblx0cHJpdmF0ZSBfaXNEaXNwb3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIF9wcm9jZXNzOiBJVGVybWluYWxDaGlsZFByb2Nlc3MgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBfcHJvY2Vzc1R5cGU6IFByb2Nlc3NUeXBlID0gUHJvY2Vzc1R5cGUuUHJvY2Vzcztcblx0cHJpdmF0ZSBfcHJlTGF1bmNoSW5wdXRRdWV1ZTogc3RyaW5nW10gPSBbXTtcblx0cHJpdmF0ZSBfaW5pdGlhbEN3ZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9leHRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbjogSU1lcmdlZEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9hY2tEYXRhQnVmZmVyZXI6IEFja0RhdGFCdWZmZXJlcjtcblx0cHJpdmF0ZSBfaGFzV3JpdHRlbkRhdGE6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfaGFzQ2hpbGRQcm9jZXNzZXM6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfcHR5UmVzcG9uc2l2ZUxpc3RlbmVyOiBJRGlzcG9zYWJsZSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfcHR5TGlzdGVuZXJzQXR0YWNoZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfZGF0YUZpbHRlcjogU2VhbWxlc3NSZWxhdW5jaERhdGFGaWx0ZXI7XG5cdHByaXZhdGUgX3Byb2Nlc3NMaXN0ZW5lcnM/OiBJRGlzcG9zYWJsZVtdO1xuXHRwcml2YXRlIF9pc0Rpc2Nvbm5lY3RlZDogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdHByaXZhdGUgX3Byb2Nlc3NUcmFpdHM6IElQcm9jZXNzUmVhZHlFdmVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfc2hlbGxMYXVuY2hDb25maWc/OiBJU2hlbGxMYXVuY2hDb25maWc7XG5cdHByaXZhdGUgX2RpbWVuc2lvbnM6IElUZXJtaW5hbERpbWVuc2lvbnMgPSB7IGNvbHM6IDAsIHJvd3M6IDAgfTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vblB0eURpc2Nvbm5lY3QgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25QdHlEaXNjb25uZWN0ID0gdGhpcy5fb25QdHlEaXNjb25uZWN0LmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vblB0eVJlY29ubmVjdCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvblB0eVJlY29ubmVjdCA9IHRoaXMuX29uUHR5UmVjb25uZWN0LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uUHJvY2Vzc1JlYWR5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVByb2Nlc3NSZWFkeUV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25Qcm9jZXNzUmVhZHkgPSB0aGlzLl9vblByb2Nlc3NSZWFkeS5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25Qcm9jZXNzU3RhdGVDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25Qcm9jZXNzU3RhdGVDaGFuZ2UgPSB0aGlzLl9vblByb2Nlc3NTdGF0ZUNoYW5nZS5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25CZWZvcmVQcm9jZXNzRGF0YSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElCZWZvcmVQcm9jZXNzRGF0YUV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25CZWZvcmVQcm9jZXNzRGF0YSA9IHRoaXMuX29uQmVmb3JlUHJvY2Vzc0RhdGEuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uUHJvY2Vzc0RhdGEgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJUHJvY2Vzc0RhdGFFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uUHJvY2Vzc0RhdGEgPSB0aGlzLl9vblByb2Nlc3NEYXRhLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vblByb2Nlc3NSZXBsYXlDb21wbGV0ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvblByb2Nlc3NSZXBsYXlDb21wbGV0ZSA9IHRoaXMuX29uUHJvY2Vzc1JlcGxheUNvbXBsZXRlLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVByb3BlcnR5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVByb2Nlc3NQcm9wZXJ0eTxhbnk+PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VQcm9wZXJ0eSA9IHRoaXMuX29uRGlkQ2hhbmdlUHJvcGVydHkuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRW52aXJvbm1lbnRWYXJpYWJsZUluZm9DaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJRW52aXJvbm1lbnRWYXJpYWJsZUluZm8+KCkpO1xuXHRyZWFkb25seSBvbkVudmlyb25tZW50VmFyaWFibGVJbmZvQ2hhbmdlZCA9IHRoaXMuX29uRW52aXJvbm1lbnRWYXJpYWJsZUluZm9DaGFuZ2UuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uUHJvY2Vzc0V4aXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxudW1iZXIgfCB1bmRlZmluZWQ+KCkpO1xuXHRyZWFkb25seSBvblByb2Nlc3NFeGl0ID0gdGhpcy5fb25Qcm9jZXNzRXhpdC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25SZXN0b3JlQ29tbWFuZHMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJU2VyaWFsaXplZENvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5PigpKTtcblx0cmVhZG9ubHkgb25SZXN0b3JlQ29tbWFuZHMgPSB0aGlzLl9vblJlc3RvcmVDb21tYW5kcy5ldmVudDtcblx0cHJpdmF0ZSBfY3dkV29ya3NwYWNlRm9sZGVyOiBJV29ya3NwYWNlRm9sZGVyIHwgdW5kZWZpbmVkO1xuXG5cdGdldCBwZXJzaXN0ZW50UHJvY2Vzc0lkKCk6IG51bWJlciB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9wcm9jZXNzPy5pZDsgfVxuXHRnZXQgc2hvdWxkUGVyc2lzdCgpOiBib29sZWFuIHsgcmV0dXJuICEhdGhpcy5yZWNvbm5lY3Rpb25Qcm9wZXJ0aWVzIHx8ICh0aGlzLl9wcm9jZXNzID8gdGhpcy5fcHJvY2Vzcy5zaG91bGRQZXJzaXN0IDogZmFsc2UpOyB9XG5cdGdldCBoYXNXcml0dGVuRGF0YSgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX2hhc1dyaXR0ZW5EYXRhOyB9XG5cdGdldCBoYXNDaGlsZFByb2Nlc3NlcygpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX2hhc0NoaWxkUHJvY2Vzc2VzOyB9XG5cdGdldCByZWNvbm5lY3Rpb25Qcm9wZXJ0aWVzKCk6IElSZWNvbm5lY3Rpb25Qcm9wZXJ0aWVzIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnPy5hdHRhY2hQZXJzaXN0ZW50UHJvY2Vzcz8ucmVjb25uZWN0aW9uUHJvcGVydGllcyB8fCB0aGlzLl9zaGVsbExhdW5jaENvbmZpZz8ucmVjb25uZWN0aW9uUHJvcGVydGllcyB8fCB1bmRlZmluZWQ7IH1cblx0Z2V0IGV4dEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKCk6IElNZXJnZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbiB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9leHRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbjsgfVxuXHRnZXQgcHJvY2Vzc1RyYWl0cygpOiBJUHJvY2Vzc1JlYWR5RXZlbnQgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fcHJvY2Vzc1RyYWl0czsgfVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbmNlSWQ6IG51bWJlcixcblx0XHRjd2Q6IHN0cmluZyB8IFVSSSB8IHVuZGVmaW5lZCxcblx0XHRlbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbnM6IFJlYWRvbmx5TWFwPHN0cmluZywgSUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uPiB8IHVuZGVmaW5lZCxcblx0XHRzaGVsbEludGVncmF0aW9uTm9uY2U6IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRASUhpc3RvcnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2hpc3RvcnlTZXJ2aWNlOiBJSGlzdG9yeVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElUZXJtaW5hbExvZ1NlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF93b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlOiBJQ29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF93b3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9wcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJUmVtb3RlQWdlbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3JlbW90ZUFnZW50U2VydmljZTogSVJlbW90ZUFnZW50U2VydmljZSxcblx0XHRASVBhdGhTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3BhdGhTZXJ2aWNlOiBJUGF0aFNlcnZpY2UsXG5cdFx0QElFbnZpcm9ubWVudFZhcmlhYmxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lbnZpcm9ubWVudFZhcmlhYmxlU2VydmljZTogSUVudmlyb25tZW50VmFyaWFibGVTZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJVGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVRlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2U6IElUZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxJbnN0YW5jZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxJbnN0YW5jZVNlcnZpY2U6IElUZXJtaW5hbEluc3RhbmNlU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fY3dkV29ya3NwYWNlRm9sZGVyID0gdGVybWluYWxFbnZpcm9ubWVudC5nZXRXb3Jrc3BhY2VGb3JUZXJtaW5hbChjd2QsIHRoaXMuX3dvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCB0aGlzLl9oaXN0b3J5U2VydmljZSk7XG5cdFx0dGhpcy5wdHlQcm9jZXNzUmVhZHkgPSB0aGlzLl9jcmVhdGVQdHlQcm9jZXNzUmVhZHlQcm9taXNlKCk7XG5cdFx0dGhpcy5fYWNrRGF0YUJ1ZmZlcmVyID0gbmV3IEFja0RhdGFCdWZmZXJlcihlID0+IHRoaXMuX3Byb2Nlc3M/LmFja25vd2xlZGdlRGF0YUV2ZW50KGUpKTtcblx0XHR0aGlzLl9kYXRhRmlsdGVyID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2VhbWxlc3NSZWxhdW5jaERhdGFGaWx0ZXIpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9kYXRhRmlsdGVyLm9uUHJvY2Vzc0RhdGEoZXYgPT4ge1xuXHRcdFx0Y29uc3QgZGF0YSA9ICh0eXBlb2YgZXYgPT09ICdzdHJpbmcnID8gZXYgOiBldi5kYXRhKTtcblx0XHRcdGNvbnN0IGJlZm9yZVByb2Nlc3NEYXRhRXZlbnQ6IElCZWZvcmVQcm9jZXNzRGF0YUV2ZW50ID0geyBkYXRhIH07XG5cdFx0XHR0aGlzLl9vbkJlZm9yZVByb2Nlc3NEYXRhLmZpcmUoYmVmb3JlUHJvY2Vzc0RhdGFFdmVudCk7XG5cdFx0XHRpZiAoYmVmb3JlUHJvY2Vzc0RhdGFFdmVudC5kYXRhICYmIGJlZm9yZVByb2Nlc3NEYXRhRXZlbnQuZGF0YS5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdC8vIFRoaXMgZXZlbnQgaXMgdXNlZCBieSB0aGUgY2FsbGVyIHNvIHRoZSBvYmplY3QgbXVzdCBiZSByZXVzZWRcblx0XHRcdFx0aWYgKHR5cGVvZiBldiAhPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRldi5kYXRhID0gYmVmb3JlUHJvY2Vzc0RhdGFFdmVudC5kYXRhO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX29uUHJvY2Vzc0RhdGEuZmlyZSh0eXBlb2YgZXYgIT09ICdzdHJpbmcnID8gZXYgOiB7IGRhdGE6IGJlZm9yZVByb2Nlc3NEYXRhRXZlbnQuZGF0YSwgdHJhY2tDb21taXQ6IGZhbHNlIH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGlmIChjd2QgJiYgdHlwZW9mIGN3ZCA9PT0gJ29iamVjdCcpIHtcblx0XHRcdHRoaXMucmVtb3RlQXV0aG9yaXR5ID0gZ2V0UmVtb3RlQXV0aG9yaXR5KGN3ZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMucmVtb3RlQXV0aG9yaXR5ID0gdGhpcy5fd29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eTtcblx0XHR9XG5cblx0XHRpZiAoZW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb25zKSB7XG5cdFx0XHR0aGlzLl9leHRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbiA9IG5ldyBNZXJnZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihlbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbnMpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZW52aXJvbm1lbnRWYXJpYWJsZVNlcnZpY2Uub25EaWRDaGFuZ2VDb2xsZWN0aW9ucyhuZXdDb2xsZWN0aW9uID0+IHRoaXMuX29uRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb25DaGFuZ2UobmV3Q29sbGVjdGlvbikpKTtcblx0XHRcdHRoaXMuZW52aXJvbm1lbnRWYXJpYWJsZUluZm8gPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFbnZpcm9ubWVudFZhcmlhYmxlSW5mb0NoYW5nZXNBY3RpdmUsIHRoaXMuX2V4dEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKTtcblx0XHRcdHRoaXMuX29uRW52aXJvbm1lbnRWYXJpYWJsZUluZm9DaGFuZ2UuZmlyZSh0aGlzLmVudmlyb25tZW50VmFyaWFibGVJbmZvKTtcblx0XHR9XG5cblx0XHR0aGlzLnNoZWxsSW50ZWdyYXRpb25Ob25jZSA9IHNoZWxsSW50ZWdyYXRpb25Ob25jZSA/PyBnZW5lcmF0ZVV1aWQoKTtcblx0fVxuXG5cdGFzeW5jIGZyZWVQb3J0S2lsbFByb2Nlc3MocG9ydDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGlmICh0aGlzLl9wcm9jZXNzPy5mcmVlUG9ydEtpbGxQcm9jZXNzKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuX3Byb2Nlc3M/LmZyZWVQb3J0S2lsbFByb2Nlc3MocG9ydCk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhpcy5fbm90aWZpY2F0aW9uU2VydmljZS5ub3RpZnkoeyBtZXNzYWdlOiBsb2NhbGl6ZSgna2lsbHBvcnRmYWlsdXJlJywgJ0NvdWxkIG5vdCBraWxsIHByb2Nlc3MgbGlzdGVuaW5nIG9uIHBvcnQgezB9LCBjb21tYW5kIGV4aXRlZCB3aXRoIGVycm9yIHsxfScsIHBvcnQsIGUpLCBzZXZlcml0eTogU2V2ZXJpdHkuV2FybmluZyB9KTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKGltbWVkaWF0ZTogYm9vbGVhbiA9IGZhbHNlKTogdm9pZCB7XG5cdFx0dGhpcy5faXNEaXNwb3NlZCA9IHRydWU7XG5cdFx0aWYgKHRoaXMuX3Byb2Nlc3MpIHtcblx0XHRcdC8vIElmIHRoZSBwcm9jZXNzIHdhcyBzdGlsbCBjb25uZWN0ZWQgdGhpcyBkaXNwb3NlIGNhbWUgZnJvbVxuXHRcdFx0Ly8gd2l0aGluIFZTIENvZGUsIG5vdCB0aGUgcHJvY2Vzcywgc28gbWFyayB0aGUgcHJvY2VzcyBhc1xuXHRcdFx0Ly8ga2lsbGVkIGJ5IHRoZSB1c2VyLlxuXHRcdFx0dGhpcy5fc2V0UHJvY2Vzc1N0YXRlKFByb2Nlc3NTdGF0ZS5LaWxsZWRCeVVzZXIpO1xuXHRcdFx0dGhpcy5fcHJvY2Vzcy5zaHV0ZG93bihpbW1lZGlhdGUpO1xuXHRcdFx0dGhpcy5fcHJvY2VzcyA9IG51bGw7XG5cdFx0fVxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZVB0eVByb2Nlc3NSZWFkeVByb21pc2UoKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHRyZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oYyA9PiB7XG5cdFx0XHRjb25zdCBsaXN0ZW5lciA9IEV2ZW50Lm9uY2UodGhpcy5vblByb2Nlc3NSZWFkeSkoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmRlYnVnKGBUZXJtaW5hbCBwcm9jZXNzIHJlYWR5IChzaGVsbFByb2Nlc3NJZDogJHt0aGlzLnNoZWxsUHJvY2Vzc0lkfSlgKTtcblx0XHRcdFx0dGhpcy5fc3RvcmUuZGVsZXRlKGxpc3RlbmVyKTtcblx0XHRcdFx0Yyh1bmRlZmluZWQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLl9zdG9yZS5hZGQobGlzdGVuZXIpO1xuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgZGV0YWNoRnJvbVByb2Nlc3MoZm9yY2VQZXJzaXN0PzogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuX3Byb2Nlc3M/LmRldGFjaD8uKGZvcmNlUGVyc2lzdCk7XG5cdFx0dGhpcy5fcHJvY2VzcyA9IG51bGw7XG5cdH1cblxuXHRhc3luYyBjcmVhdGVQcm9jZXNzKFxuXHRcdHNoZWxsTGF1bmNoQ29uZmlnOiBJU2hlbGxMYXVuY2hDb25maWcsXG5cdFx0Y29sczogbnVtYmVyLFxuXHRcdHJvd3M6IG51bWJlcixcblx0XHRyZXNldDogYm9vbGVhbiA9IHRydWVcblx0KTogUHJvbWlzZTxJVGVybWluYWxMYXVuY2hFcnJvciB8IHsgaW5qZWN0ZWRBcmdzOiBzdHJpbmdbXSB9IHwgdW5kZWZpbmVkPiB7XG5cdFx0dGhpcy5fc2hlbGxMYXVuY2hDb25maWcgPSBzaGVsbExhdW5jaENvbmZpZztcblx0XHR0aGlzLl9kaW1lbnNpb25zLmNvbHMgPSBjb2xzO1xuXHRcdHRoaXMuX2RpbWVuc2lvbnMucm93cyA9IHJvd3M7XG5cblx0XHRsZXQgbmV3UHJvY2VzczogSVRlcm1pbmFsQ2hpbGRQcm9jZXNzIHwgdW5kZWZpbmVkO1xuXG5cdFx0aWYgKHNoZWxsTGF1bmNoQ29uZmlnLmN1c3RvbVB0eUltcGxlbWVudGF0aW9uKSB7XG5cdFx0XHR0aGlzLl9wcm9jZXNzVHlwZSA9IFByb2Nlc3NUeXBlLlBzdWVkb1Rlcm1pbmFsO1xuXHRcdFx0bmV3UHJvY2VzcyA9IHNoZWxsTGF1bmNoQ29uZmlnLmN1c3RvbVB0eUltcGxlbWVudGF0aW9uKHRoaXMuX2luc3RhbmNlSWQsIGNvbHMsIHJvd3MpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBiYWNrZW5kID0gYXdhaXQgdGhpcy5fdGVybWluYWxJbnN0YW5jZVNlcnZpY2UuZ2V0QmFja2VuZCh0aGlzLnJlbW90ZUF1dGhvcml0eSk7XG5cdFx0XHRpZiAoIWJhY2tlbmQpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBObyB0ZXJtaW5hbCBiYWNrZW5kIHJlZ2lzdGVyZWQgZm9yIHJlbW90ZSBhdXRob3JpdHkgJyR7dGhpcy5yZW1vdGVBdXRob3JpdHl9J2ApO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5iYWNrZW5kID0gYmFja2VuZDtcblxuXHRcdFx0Ly8gQ3JlYXRlIHZhcmlhYmxlIHJlc29sdmVyXG5cdFx0XHRjb25zdCB2YXJpYWJsZVJlc29sdmVyID0gdGVybWluYWxFbnZpcm9ubWVudC5jcmVhdGVWYXJpYWJsZVJlc29sdmVyKHRoaXMuX2N3ZFdvcmtzcGFjZUZvbGRlciwgYXdhaXQgdGhpcy5fdGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlLmdldEVudmlyb25tZW50KHRoaXMucmVtb3RlQXV0aG9yaXR5KSwgdGhpcy5fY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSk7XG5cblx0XHRcdC8vIHJlc29sdmVkVXNlckhvbWUgaXMgbmVlZGVkIGhlcmUgYXMgcmVtb3RlIHJlc29sdmVycyBjYW4gbGF1bmNoIGxvY2FsIHRlcm1pbmFscyBiZWZvcmVcblx0XHRcdC8vIHRoZXkncmUgY29ubmVjdGVkIHRvIHRoZSByZW1vdGUuXG5cdFx0XHR0aGlzLnVzZXJIb21lID0gdGhpcy5fcGF0aFNlcnZpY2UucmVzb2x2ZWRVc2VySG9tZT8uZnNQYXRoO1xuXHRcdFx0dGhpcy5vcyA9IE9TO1xuXHRcdFx0aWYgKCEhdGhpcy5yZW1vdGVBdXRob3JpdHkpIHtcblxuXHRcdFx0XHRjb25zdCB1c2VySG9tZVVyaSA9IGF3YWl0IHRoaXMuX3BhdGhTZXJ2aWNlLnVzZXJIb21lKCk7XG5cdFx0XHRcdHRoaXMudXNlckhvbWUgPSB1c2VySG9tZVVyaS5wYXRoO1xuXHRcdFx0XHRjb25zdCByZW1vdGVFbnYgPSBhd2FpdCB0aGlzLl9yZW1vdGVBZ2VudFNlcnZpY2UuZ2V0RW52aXJvbm1lbnQoKTtcblx0XHRcdFx0aWYgKCFyZW1vdGVFbnYpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBnZXQgcmVtb3RlIGVudmlyb25tZW50IGZvciByZW1vdGUgYXV0aG9yaXR5IFwiJHt0aGlzLnJlbW90ZUF1dGhvcml0eX1cImApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMudXNlckhvbWUgPSByZW1vdGVFbnYudXNlckhvbWUucGF0aDtcblx0XHRcdFx0dGhpcy5vcyA9IHJlbW90ZUVudi5vcztcblxuXHRcdFx0XHQvLyB0aGlzIGlzIGEgY29weSBvZiB3aGF0IHRoZSBtZXJnZWQgZW52aXJvbm1lbnQgY29sbGVjdGlvbiBpcyBvbiB0aGUgcmVtb3RlIHNpZGVcblx0XHRcdFx0Y29uc3QgZW52ID0gYXdhaXQgdGhpcy5fcmVzb2x2ZUVudmlyb25tZW50KGJhY2tlbmQsIHZhcmlhYmxlUmVzb2x2ZXIsIHNoZWxsTGF1bmNoQ29uZmlnKTtcblx0XHRcdFx0Y29uc3Qgc2hvdWxkUGVyc2lzdCA9ICgodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGFza1NldHRpbmdJZC5SZWNvbm5lY3Rpb24pICYmIHNoZWxsTGF1bmNoQ29uZmlnLnJlY29ubmVjdGlvblByb3BlcnRpZXMpIHx8ICFzaGVsbExhdW5jaENvbmZpZy5pc0ZlYXR1cmVUZXJtaW5hbCkgJiYgdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcuZW5hYmxlUGVyc2lzdGVudFNlc3Npb25zICYmICFzaGVsbExhdW5jaENvbmZpZy5pc1RyYW5zaWVudDtcblx0XHRcdFx0aWYgKHNoZWxsTGF1bmNoQ29uZmlnLmF0dGFjaFBlcnNpc3RlbnRQcm9jZXNzKSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgYmFja2VuZC5hdHRhY2hUb1Byb2Nlc3Moc2hlbGxMYXVuY2hDb25maWcuYXR0YWNoUGVyc2lzdGVudFByb2Nlc3MuaWQpO1xuXHRcdFx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0XHRcdG5ld1Byb2Nlc3MgPSByZXN1bHQ7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vIFdhcm4gYW5kIGp1c3QgY3JlYXRlIGEgbmV3IHRlcm1pbmFsIGlmIGF0dGFjaCBmYWlsZWQgZm9yIHNvbWUgcmVhc29uXG5cdFx0XHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLndhcm4oYEF0dGFjaCB0byBwcm9jZXNzIGZhaWxlZCBmb3IgdGVybWluYWxgLCBzaGVsbExhdW5jaENvbmZpZy5hdHRhY2hQZXJzaXN0ZW50UHJvY2Vzcyk7XG5cdFx0XHRcdFx0XHRzaGVsbExhdW5jaENvbmZpZy5hdHRhY2hQZXJzaXN0ZW50UHJvY2VzcyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFuZXdQcm9jZXNzKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5fdGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlLnJlc29sdmVTaGVsbExhdW5jaENvbmZpZyhzaGVsbExhdW5jaENvbmZpZywge1xuXHRcdFx0XHRcdFx0cmVtb3RlQXV0aG9yaXR5OiB0aGlzLnJlbW90ZUF1dGhvcml0eSxcblx0XHRcdFx0XHRcdG9zOiB0aGlzLm9zXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0Y29uc3Qgb3B0aW9uczogSVRlcm1pbmFsUHJvY2Vzc09wdGlvbnMgPSB7XG5cdFx0XHRcdFx0XHRzaGVsbEludGVncmF0aW9uOiB7XG5cdFx0XHRcdFx0XHRcdGVuYWJsZWQ6IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlcm1pbmFsU2V0dGluZ0lkLlNoZWxsSW50ZWdyYXRpb25FbmFibGVkKSxcblx0XHRcdFx0XHRcdFx0c3VnZ2VzdEVuYWJsZWQ6IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlcm1pbmFsQ29udHJpYlNldHRpbmdJZC5TdWdnZXN0RW5hYmxlZCksXG5cdFx0XHRcdFx0XHRcdG5vbmNlOiB0aGlzLnNoZWxsSW50ZWdyYXRpb25Ob25jZVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHdpbmRvd3NFbmFibGVDb25wdHk6IHRoaXMuX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuY29uZmlnLndpbmRvd3NFbmFibGVDb25wdHksXG5cdFx0XHRcdFx0XHR3aW5kb3dzVXNlQ29ucHR5RGxsOiB0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy53aW5kb3dzVXNlQ29ucHR5RGxsID8/IGZhbHNlLFxuXHRcdFx0XHRcdFx0ZW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb25zOiB0aGlzLl9leHRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbj8uY29sbGVjdGlvbnMgPyBzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbnModGhpcy5fZXh0RW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24uY29sbGVjdGlvbnMpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0d29ya3NwYWNlRm9sZGVyOiB0aGlzLl9jd2RXb3Jrc3BhY2VGb2xkZXIsXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0bmV3UHJvY2VzcyA9IGF3YWl0IGJhY2tlbmQuY3JlYXRlUHJvY2Vzcyhcblx0XHRcdFx0XHRcdFx0c2hlbGxMYXVuY2hDb25maWcsXG5cdFx0XHRcdFx0XHRcdCcnLCAvLyBUT0RPOiBGaXggY3dkXG5cdFx0XHRcdFx0XHRcdGNvbHMsXG5cdFx0XHRcdFx0XHRcdHJvd3MsXG5cdFx0XHRcdFx0XHRcdHRoaXMuX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuY29uZmlnLnVuaWNvZGVWZXJzaW9uLFxuXHRcdFx0XHRcdFx0XHRlbnYsIC8vIFRPRE86XG5cdFx0XHRcdFx0XHRcdG9wdGlvbnMsXG5cdFx0XHRcdFx0XHRcdHNob3VsZFBlcnNpc3Rcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdFx0aWYgKGU/Lm1lc3NhZ2UgPT09ICdDb3VsZCBub3QgZmV0Y2ggcmVtb3RlIGVudmlyb25tZW50Jykge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBDb3VsZCBub3QgZmV0Y2ggcmVtb3RlIGVudmlyb25tZW50LCBzaWxlbnRseSBmYWlsaW5nYCk7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR0aHJvdyBlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIXRoaXMuX2lzRGlzcG9zZWQpIHtcblx0XHRcdFx0XHR0aGlzLl9zZXR1cFB0eUhvc3RMaXN0ZW5lcnMoYmFja2VuZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmIChzaGVsbExhdW5jaENvbmZpZy5hdHRhY2hQZXJzaXN0ZW50UHJvY2Vzcykge1xuXHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IHNoZWxsTGF1bmNoQ29uZmlnLmF0dGFjaFBlcnNpc3RlbnRQcm9jZXNzLmZpbmRSZXZpdmVkSWQgPyBhd2FpdCBiYWNrZW5kLmF0dGFjaFRvUmV2aXZlZFByb2Nlc3Moc2hlbGxMYXVuY2hDb25maWcuYXR0YWNoUGVyc2lzdGVudFByb2Nlc3MuaWQpIDogYXdhaXQgYmFja2VuZC5hdHRhY2hUb1Byb2Nlc3Moc2hlbGxMYXVuY2hDb25maWcuYXR0YWNoUGVyc2lzdGVudFByb2Nlc3MuaWQpO1xuXHRcdFx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0XHRcdG5ld1Byb2Nlc3MgPSByZXN1bHQ7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vIFdhcm4gYW5kIGp1c3QgY3JlYXRlIGEgbmV3IHRlcm1pbmFsIGlmIGF0dGFjaCBmYWlsZWQgZm9yIHNvbWUgcmVhc29uXG5cdFx0XHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLndhcm4oYEF0dGFjaCB0byBwcm9jZXNzIGZhaWxlZCBmb3IgdGVybWluYWxgLCBzaGVsbExhdW5jaENvbmZpZy5hdHRhY2hQZXJzaXN0ZW50UHJvY2Vzcyk7XG5cdFx0XHRcdFx0XHRzaGVsbExhdW5jaENvbmZpZy5hdHRhY2hQZXJzaXN0ZW50UHJvY2VzcyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFuZXdQcm9jZXNzKSB7XG5cdFx0XHRcdFx0bmV3UHJvY2VzcyA9IGF3YWl0IHRoaXMuX2xhdW5jaExvY2FsUHJvY2VzcyhiYWNrZW5kLCBzaGVsbExhdW5jaENvbmZpZywgY29scywgcm93cywgdGhpcy51c2VySG9tZSwgdmFyaWFibGVSZXNvbHZlcik7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCF0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdFx0dGhpcy5fc2V0dXBQdHlIb3N0TGlzdGVuZXJzKGJhY2tlbmQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSWYgdGhlIHByb2Nlc3Mgd2FzIGRpc3Bvc2VkIGR1cmluZyBpdHMgY3JlYXRpb24sIHNodXQgaXQgZG93biBhbmQgcmV0dXJuIGZhaWx1cmVcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0bmV3UHJvY2Vzcy5zaHV0ZG93bihmYWxzZSk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHRoaXMuX3Byb2Nlc3MgPSBuZXdQcm9jZXNzO1xuXHRcdHRoaXMuX3NldFByb2Nlc3NTdGF0ZShQcm9jZXNzU3RhdGUuTGF1bmNoaW5nKTtcblxuXHRcdC8vIEFkZCBhbnkgY2FwYWJpbGl0aWVzIGluaGVyZW50IHRvIHRoZSBiYWNrZW5kXG5cdFx0aWYgKHRoaXMub3MgPT09IE9wZXJhdGluZ1N5c3RlbS5MaW51eCB8fCB0aGlzLm9zID09PSBPcGVyYXRpbmdTeXN0ZW0uTWFjaW50b3NoKSB7XG5cdFx0XHR0aGlzLmNhcGFiaWxpdGllcy5hZGQoVGVybWluYWxDYXBhYmlsaXR5Lk5haXZlQ3dkRGV0ZWN0aW9uLCBuZXcgTmFpdmVDd2REZXRlY3Rpb25DYXBhYmlsaXR5KHRoaXMuX3Byb2Nlc3MpKTtcblx0XHR9XG5cblx0XHR0aGlzLl9kYXRhRmlsdGVyLm5ld1Byb2Nlc3ModGhpcy5fcHJvY2VzcywgcmVzZXQpO1xuXG5cdFx0aWYgKHRoaXMuX3Byb2Nlc3NMaXN0ZW5lcnMpIHtcblx0XHRcdGRpc3Bvc2UodGhpcy5fcHJvY2Vzc0xpc3RlbmVycyk7XG5cdFx0fVxuXHRcdHRoaXMuX3Byb2Nlc3NMaXN0ZW5lcnMgPSBbXG5cdFx0XHRuZXdQcm9jZXNzLm9uUHJvY2Vzc1JlYWR5KChlOiBJUHJvY2Vzc1JlYWR5RXZlbnQpID0+IHtcblx0XHRcdFx0dGhpcy5fcHJvY2Vzc1RyYWl0cyA9IGU7XG5cdFx0XHRcdHRoaXMuc2hlbGxQcm9jZXNzSWQgPSBlLnBpZDtcblx0XHRcdFx0dGhpcy5faW5pdGlhbEN3ZCA9IGUuY3dkO1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVByb3BlcnR5LmZpcmUoeyB0eXBlOiBQcm9jZXNzUHJvcGVydHlUeXBlLkluaXRpYWxDd2QsIHZhbHVlOiB0aGlzLl9pbml0aWFsQ3dkIH0pO1xuXHRcdFx0XHR0aGlzLl9vblByb2Nlc3NSZWFkeS5maXJlKGUpO1xuXG5cdFx0XHRcdGlmICh0aGlzLl9wcmVMYXVuY2hJbnB1dFF1ZXVlLmxlbmd0aCA+IDAgJiYgdGhpcy5fcHJvY2Vzcykge1xuXHRcdFx0XHRcdC8vIFNlbmQgYW55IHF1ZXVlZCBkYXRhIHRoYXQncyB3YWl0aW5nXG5cdFx0XHRcdFx0bmV3UHJvY2Vzcy5pbnB1dCh0aGlzLl9wcmVMYXVuY2hJbnB1dFF1ZXVlLmpvaW4oJycpKTtcblx0XHRcdFx0XHR0aGlzLl9wcmVMYXVuY2hJbnB1dFF1ZXVlLmxlbmd0aCA9IDA7XG5cdFx0XHRcdH1cblx0XHRcdH0pLFxuXHRcdFx0bmV3UHJvY2Vzcy5vblByb2Nlc3NFeGl0KGV4aXRDb2RlID0+IHRoaXMuX29uRXhpdChleGl0Q29kZSkpLFxuXHRcdFx0bmV3UHJvY2Vzcy5vbkRpZENoYW5nZVByb3BlcnR5KCh7IHR5cGUsIHZhbHVlIH0pID0+IHtcblx0XHRcdFx0c3dpdGNoICh0eXBlKSB7XG5cdFx0XHRcdFx0Y2FzZSBQcm9jZXNzUHJvcGVydHlUeXBlLkhhc0NoaWxkUHJvY2Vzc2VzOlxuXHRcdFx0XHRcdFx0dGhpcy5faGFzQ2hpbGRQcm9jZXNzZXMgPSB2YWx1ZTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgUHJvY2Vzc1Byb3BlcnR5VHlwZS5GYWlsZWRTaGVsbEludGVncmF0aW9uQWN0aXZhdGlvbjpcblx0XHRcdFx0XHRcdHRoaXMuX3RlbGVtZXRyeVNlcnZpY2U/LnB1YmxpY0xvZzI8e30sIHsgb3duZXI6ICdtZWdhbnJvZ2dlJzsgY29tbWVudDogJ0luZGljYXRlcyBzaGVsbCBpbnRlZ3JhdGlvbiB3YXMgbm90IGFjdGl2YXRlZCBiZWNhdXNlIG9mIGN1c3RvbSBhcmdzJyB9PigndGVybWluYWwvc2hlbGxJbnRlZ3JhdGlvbkFjdGl2YXRpb25GYWlsdXJlQ3VzdG9tQXJncycpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VQcm9wZXJ0eS5maXJlKHsgdHlwZSwgdmFsdWUgfSk7XG5cdFx0XHR9KVxuXHRcdF07XG5cdFx0aWYgKG5ld1Byb2Nlc3Mub25Qcm9jZXNzUmVwbGF5Q29tcGxldGUpIHtcblx0XHRcdHRoaXMuX3Byb2Nlc3NMaXN0ZW5lcnMucHVzaChuZXdQcm9jZXNzLm9uUHJvY2Vzc1JlcGxheUNvbXBsZXRlKCgpID0+IHRoaXMuX29uUHJvY2Vzc1JlcGxheUNvbXBsZXRlLmZpcmUoKSkpO1xuXHRcdH1cblx0XHRpZiAobmV3UHJvY2Vzcy5vblJlc3RvcmVDb21tYW5kcykge1xuXHRcdFx0dGhpcy5fcHJvY2Vzc0xpc3RlbmVycy5wdXNoKG5ld1Byb2Nlc3Mub25SZXN0b3JlQ29tbWFuZHMoZSA9PiB0aGlzLl9vblJlc3RvcmVDb21tYW5kcy5maXJlKGUpKSk7XG5cdFx0fVxuXHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMucHJvY2Vzc1N0YXRlID09PSBQcm9jZXNzU3RhdGUuTGF1bmNoaW5nKSB7XG5cdFx0XHRcdHRoaXMuX3NldFByb2Nlc3NTdGF0ZShQcm9jZXNzU3RhdGUuUnVubmluZyk7XG5cdFx0XHR9XG5cdFx0fSwgUHJvY2Vzc0NvbnN0YW50cy5FcnJvckxhdW5jaFRocmVzaG9sZER1cmF0aW9uKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IG5ld1Byb2Nlc3Muc3RhcnQoKTtcblx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHQvLyBFcnJvclxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cblx0XHQvLyBSZXBvcnQgdGhlIGxhdGVuY3kgdG8gdGhlIHB0eSBob3N0IHdoZW4gaWRsZVxuXHRcdHJ1bldoZW5XaW5kb3dJZGxlKGdldEFjdGl2ZVdpbmRvdygpLCAoKSA9PiB7XG5cdFx0XHR0aGlzLmJhY2tlbmQ/LmdldExhdGVuY3koKS50aGVuKG1lYXN1cmVtZW50cyA9PiB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbyhgTGF0ZW5jeSBtZWFzdXJlbWVudHMgZm9yICR7dGhpcy5yZW1vdGVBdXRob3JpdHkgPz8gJ2xvY2FsJ30gYmFja2VuZFxcbiR7bWVhc3VyZW1lbnRzLm1hcChlID0+IGAke2UubGFiZWx9OiAke2UubGF0ZW5jeS50b0ZpeGVkKDIpfW1zYCkuam9pbignXFxuJyl9YCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRhc3luYyByZWxhdW5jaChzaGVsbExhdW5jaENvbmZpZzogSVNoZWxsTGF1bmNoQ29uZmlnLCBjb2xzOiBudW1iZXIsIHJvd3M6IG51bWJlciwgcmVzZXQ6IGJvb2xlYW4pOiBQcm9taXNlPElUZXJtaW5hbExhdW5jaEVycm9yIHwgeyBpbmplY3RlZEFyZ3M6IHN0cmluZ1tdIH0gfCB1bmRlZmluZWQ+IHtcblx0XHR0aGlzLnB0eVByb2Nlc3NSZWFkeSA9IHRoaXMuX2NyZWF0ZVB0eVByb2Nlc3NSZWFkeVByb21pc2UoKTtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBSZWxhdW5jaGluZyB0ZXJtaW5hbCBpbnN0YW5jZSAke3RoaXMuX2luc3RhbmNlSWR9YCk7XG5cblx0XHQvLyBGaXJlIHJlY29ubmVjdCBpZiBuZWVkZWQgdG8gZW5zdXJlIHRoZSB0ZXJtaW5hbCBpcyB1c2FibGUgYWdhaW5cblx0XHRpZiAodGhpcy5faXNEaXNjb25uZWN0ZWQpIHtcblx0XHRcdHRoaXMuX2lzRGlzY29ubmVjdGVkID0gZmFsc2U7XG5cdFx0XHR0aGlzLl9vblB0eVJlY29ubmVjdC5maXJlKCk7XG5cdFx0fVxuXG5cdFx0Ly8gQ2xlYXIgZGF0YSB3cml0dGVuIGZsYWcgdG8gcmUtZW5hYmxlIHNlYW1sZXNzIHJlbGF1bmNoIGlmIHRoaXMgcmVsYXVuY2ggd2FzIG1hbnVhbGx5XG5cdFx0Ly8gdHJpZ2dlcmVkXG5cdFx0dGhpcy5faGFzV3JpdHRlbkRhdGEgPSBmYWxzZTtcblxuXHRcdHJldHVybiB0aGlzLmNyZWF0ZVByb2Nlc3Moc2hlbGxMYXVuY2hDb25maWcsIGNvbHMsIHJvd3MsIHJlc2V0KTtcblx0fVxuXG5cdC8vIEZldGNoIGFueSBleHRlbnNpb24gZW52aXJvbm1lbnQgYWRkaXRpb25zIGFuZCBhcHBseSB0aGVtXG5cdHByaXZhdGUgYXN5bmMgX3Jlc29sdmVFbnZpcm9ubWVudChiYWNrZW5kOiBJVGVybWluYWxCYWNrZW5kLCB2YXJpYWJsZVJlc29sdmVyOiB0ZXJtaW5hbEVudmlyb25tZW50LlZhcmlhYmxlUmVzb2x2ZXIgfCB1bmRlZmluZWQsIHNoZWxsTGF1bmNoQ29uZmlnOiBJU2hlbGxMYXVuY2hDb25maWcpOiBQcm9taXNlPElQcm9jZXNzRW52aXJvbm1lbnQ+IHtcblx0XHRjb25zdCB3b3Jrc3BhY2VGb2xkZXIgPSB0ZXJtaW5hbEVudmlyb25tZW50LmdldFdvcmtzcGFjZUZvclRlcm1pbmFsKHNoZWxsTGF1bmNoQ29uZmlnLmN3ZCwgdGhpcy5fd29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIHRoaXMuX2hpc3RvcnlTZXJ2aWNlKTtcblx0XHRjb25zdCBwbGF0Zm9ybUtleSA9IGlzV2luZG93cyA/ICd3aW5kb3dzJyA6IChpc01hY2ludG9zaCA/ICdvc3gnIDogJ2xpbnV4Jyk7XG5cdFx0Y29uc3QgZW52RnJvbUNvbmZpZ1ZhbHVlID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SVRlcm1pbmFsRW52aXJvbm1lbnQgfCB1bmRlZmluZWQ+KGB0ZXJtaW5hbC5pbnRlZ3JhdGVkLmVudi4ke3BsYXRmb3JtS2V5fWApO1xuXG5cdFx0bGV0IGJhc2VFbnY6IElQcm9jZXNzRW52aXJvbm1lbnQ7XG5cdFx0aWYgKHNoZWxsTGF1bmNoQ29uZmlnLnVzZVNoZWxsRW52aXJvbm1lbnQpIHtcblx0XHRcdC8vIFRPRE86IEF2b2lkIGFzIGFueT9cblx0XHRcdGJhc2VFbnYgPSBhd2FpdCBiYWNrZW5kLmdldFNoZWxsRW52aXJvbm1lbnQoKSBhcyBhbnk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGJhc2VFbnYgPSBhd2FpdCB0aGlzLl90ZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UuZ2V0RW52aXJvbm1lbnQodGhpcy5yZW1vdGVBdXRob3JpdHkpO1xuXHRcdH1cblx0XHRjb25zdCBlbnYgPSBhd2FpdCB0ZXJtaW5hbEVudmlyb25tZW50LmNyZWF0ZVRlcm1pbmFsRW52aXJvbm1lbnQoc2hlbGxMYXVuY2hDb25maWcsIGVudkZyb21Db25maWdWYWx1ZSwgdmFyaWFibGVSZXNvbHZlciwgdGhpcy5fcHJvZHVjdFNlcnZpY2UudmVyc2lvbiwgdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcuZGV0ZWN0TG9jYWxlLCBiYXNlRW52KTtcblx0XHRpZiAoIXRoaXMuX2lzRGlzcG9zZWQgJiYgc2hvdWxkVXNlRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oc2hlbGxMYXVuY2hDb25maWcpKSB7XG5cdFx0XHR0aGlzLl9leHRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbiA9IHRoaXMuX2Vudmlyb25tZW50VmFyaWFibGVTZXJ2aWNlLm1lcmdlZENvbGxlY3Rpb247XG5cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2Vudmlyb25tZW50VmFyaWFibGVTZXJ2aWNlLm9uRGlkQ2hhbmdlQ29sbGVjdGlvbnMobmV3Q29sbGVjdGlvbiA9PiB0aGlzLl9vbkVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uQ2hhbmdlKG5ld0NvbGxlY3Rpb24pKSk7XG5cdFx0XHQvLyBGb3IgcmVtb3RlIHRlcm1pbmFscywgdGhpcyBpcyBhIGNvcHkgb2YgdGhlIG1lcmdlZEVudmlyb25tZW50Q29sbGVjdGlvbiBjcmVhdGVkIG9uXG5cdFx0XHQvLyB0aGUgcmVtb3RlIHNpZGUuIFNpbmNlIHRoZSBlbnZpcm9ubWVudCBjb2xsZWN0aW9uIGlzIHN5bmNlZCBiZXR3ZWVuIHRoZSByZW1vdGUgYW5kXG5cdFx0XHQvLyBsb2NhbCBzaWRlcyBpbW1lZGlhdGVseSB0aGlzIGlzIGEgZmFpcmx5IHNhZmUgd2F5IG9mIGVuYWJsaW5nIHRoZSBlbnYgdmFyIGRpZmZpbmcgYW5kXG5cdFx0XHQvLyBpbmZvIHdpZGdldC4gV2hpbGUgdGVjaG5pY2FsbHkgdGhlc2UgY291bGQgZGlmZmVyIGR1ZSB0byB0aGUgc2xpZ2h0IGNoYW5nZSBvZiBhIHJhY2Vcblx0XHRcdC8vIGNvbmRpdGlvbiwgdGhlIGNoYW5jZSBpcyBtaW5pbWFsIHBsdXMgdGhlIGltcGFjdCBvbiB0aGUgdXNlciBpcyBhbHNvIG5vdCB0aGF0IGdyZWF0XG5cdFx0XHQvLyBpZiBpdCBoYXBwZW5zIC0gaXQncyBub3Qgd29ydGggYWRkaW5nIHBsdW1iaW5nIHRvIHN5bmMgYmFjayB0aGUgcmVzb2x2ZWQgY29sbGVjdGlvbi5cblx0XHRcdGF3YWl0IHRoaXMuX2V4dEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uLmFwcGx5VG9Qcm9jZXNzRW52aXJvbm1lbnQoZW52LCB7IHdvcmtzcGFjZUZvbGRlciB9LCB2YXJpYWJsZVJlc29sdmVyKTtcblx0XHRcdGlmICh0aGlzLl9leHRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbi5nZXRWYXJpYWJsZU1hcCh7IHdvcmtzcGFjZUZvbGRlciB9KS5zaXplKSB7XG5cdFx0XHRcdHRoaXMuZW52aXJvbm1lbnRWYXJpYWJsZUluZm8gPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFbnZpcm9ubWVudFZhcmlhYmxlSW5mb0NoYW5nZXNBY3RpdmUsIHRoaXMuX2V4dEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKTtcblx0XHRcdFx0dGhpcy5fb25FbnZpcm9ubWVudFZhcmlhYmxlSW5mb0NoYW5nZS5maXJlKHRoaXMuZW52aXJvbm1lbnRWYXJpYWJsZUluZm8pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZW52O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfbGF1bmNoTG9jYWxQcm9jZXNzKFxuXHRcdGJhY2tlbmQ6IElUZXJtaW5hbEJhY2tlbmQsXG5cdFx0c2hlbGxMYXVuY2hDb25maWc6IElTaGVsbExhdW5jaENvbmZpZyxcblx0XHRjb2xzOiBudW1iZXIsXG5cdFx0cm93czogbnVtYmVyLFxuXHRcdHVzZXJIb21lOiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0dmFyaWFibGVSZXNvbHZlcjogdGVybWluYWxFbnZpcm9ubWVudC5WYXJpYWJsZVJlc29sdmVyIHwgdW5kZWZpbmVkXG5cdCk6IFByb21pc2U8SVRlcm1pbmFsQ2hpbGRQcm9jZXNzPiB7XG5cdFx0YXdhaXQgdGhpcy5fdGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlLnJlc29sdmVTaGVsbExhdW5jaENvbmZpZyhzaGVsbExhdW5jaENvbmZpZywge1xuXHRcdFx0cmVtb3RlQXV0aG9yaXR5OiB1bmRlZmluZWQsXG5cdFx0XHRvczogT1Ncblx0XHR9KTtcblx0XHRjb25zdCBhY3RpdmVXb3Jrc3BhY2VSb290VXJpID0gdGhpcy5faGlzdG9yeVNlcnZpY2UuZ2V0TGFzdEFjdGl2ZVdvcmtzcGFjZVJvb3QoU2NoZW1hcy5maWxlKTtcblxuXHRcdGNvbnN0IGluaXRpYWxDd2QgPSBhd2FpdCB0ZXJtaW5hbEVudmlyb25tZW50LmdldEN3ZChcblx0XHRcdHNoZWxsTGF1bmNoQ29uZmlnLFxuXHRcdFx0dXNlckhvbWUsXG5cdFx0XHR2YXJpYWJsZVJlc29sdmVyLFxuXHRcdFx0YWN0aXZlV29ya3NwYWNlUm9vdFVyaSxcblx0XHRcdHRoaXMuX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuY29uZmlnLmN3ZCxcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Vcblx0XHQpO1xuXG5cdFx0Y29uc3QgZW52ID0gYXdhaXQgdGhpcy5fcmVzb2x2ZUVudmlyb25tZW50KGJhY2tlbmQsIHZhcmlhYmxlUmVzb2x2ZXIsIHNoZWxsTGF1bmNoQ29uZmlnKTtcblxuXHRcdGNvbnN0IG9wdGlvbnM6IElUZXJtaW5hbFByb2Nlc3NPcHRpb25zID0ge1xuXHRcdFx0c2hlbGxJbnRlZ3JhdGlvbjoge1xuXHRcdFx0XHRlbmFibGVkOiB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShUZXJtaW5hbFNldHRpbmdJZC5TaGVsbEludGVncmF0aW9uRW5hYmxlZCksXG5cdFx0XHRcdHN1Z2dlc3RFbmFibGVkOiB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShUZXJtaW5hbENvbnRyaWJTZXR0aW5nSWQuU3VnZ2VzdEVuYWJsZWQpLFxuXHRcdFx0XHRub25jZTogdGhpcy5zaGVsbEludGVncmF0aW9uTm9uY2Vcblx0XHRcdH0sXG5cdFx0XHR3aW5kb3dzRW5hYmxlQ29ucHR5OiB0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy53aW5kb3dzRW5hYmxlQ29ucHR5LFxuXHRcdFx0d2luZG93c1VzZUNvbnB0eURsbDogdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcud2luZG93c1VzZUNvbnB0eURsbCA/PyBmYWxzZSxcblx0XHRcdGVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uczogdGhpcy5fZXh0RW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24gPyBzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbnModGhpcy5fZXh0RW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24uY29sbGVjdGlvbnMpIDogdW5kZWZpbmVkLFxuXHRcdFx0d29ya3NwYWNlRm9sZGVyOiB0aGlzLl9jd2RXb3Jrc3BhY2VGb2xkZXIsXG5cdFx0fTtcblx0XHRjb25zdCBzaG91bGRQZXJzaXN0ID0gKCh0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShUYXNrU2V0dGluZ0lkLlJlY29ubmVjdGlvbikgJiYgc2hlbGxMYXVuY2hDb25maWcucmVjb25uZWN0aW9uUHJvcGVydGllcykgfHwgIXNoZWxsTGF1bmNoQ29uZmlnLmlzRmVhdHVyZVRlcm1pbmFsKSAmJiB0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy5lbmFibGVQZXJzaXN0ZW50U2Vzc2lvbnMgJiYgIXNoZWxsTGF1bmNoQ29uZmlnLmlzVHJhbnNpZW50O1xuXHRcdHJldHVybiBhd2FpdCBiYWNrZW5kLmNyZWF0ZVByb2Nlc3Moc2hlbGxMYXVuY2hDb25maWcsIGluaXRpYWxDd2QsIGNvbHMsIHJvd3MsIHRoaXMuX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuY29uZmlnLnVuaWNvZGVWZXJzaW9uLCBlbnYsIG9wdGlvbnMsIHNob3VsZFBlcnNpc3QpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0dXBQdHlIb3N0TGlzdGVuZXJzKGJhY2tlbmQ6IElUZXJtaW5hbEJhY2tlbmQpIHtcblx0XHRpZiAodGhpcy5fcHR5TGlzdGVuZXJzQXR0YWNoZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fcHR5TGlzdGVuZXJzQXR0YWNoZWQgPSB0cnVlO1xuXG5cdFx0Ly8gTWFyayB0aGUgcHJvY2VzcyBhcyBkaXNjb25uZWN0ZWQgaXMgdGhlIHB0eSBob3N0IGlzIHVucmVzcG9uc2l2ZSwgdGhlIHJlc3BvbnNpdmUgZXZlbnRcblx0XHQvLyB3aWxsIGZpcmUgb25seSB3aGVuIHRoZSBwdHkgaG9zdCB3YXMgYWxyZWFkeSB1bnJlc3BvbnNpdmVcblx0XHR0aGlzLl9yZWdpc3RlcihiYWNrZW5kLm9uUHR5SG9zdFVucmVzcG9uc2l2ZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9pc0Rpc2Nvbm5lY3RlZCA9IHRydWU7XG5cdFx0XHR0aGlzLl9vblB0eURpc2Nvbm5lY3QuZmlyZSgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9wdHlSZXNwb25zaXZlTGlzdGVuZXIgPSBiYWNrZW5kLm9uUHR5SG9zdFJlc3BvbnNpdmUoKCkgPT4ge1xuXHRcdFx0dGhpcy5faXNEaXNjb25uZWN0ZWQgPSBmYWxzZTtcblx0XHRcdHRoaXMuX29uUHR5UmVjb25uZWN0LmZpcmUoKTtcblx0XHR9KTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy5fcHR5UmVzcG9uc2l2ZUxpc3RlbmVyPy5kaXNwb3NlKCkpKTtcblxuXHRcdC8vIFdoZW4gdGhlIHB0eSBob3N0IHJlc3RhcnRzLCByZWNvbm5lY3QgaXMgbm8gbG9uZ2VyIHBvc3NpYmxlIHNvIGRpc3Bvc2UgdGhlIHJlc3BvbnNpdmVcblx0XHQvLyBsaXN0ZW5lclxuXHRcdHRoaXMuX3JlZ2lzdGVyKGJhY2tlbmQub25QdHlIb3N0UmVzdGFydChhc3luYyAoKSA9PiB7XG5cdFx0XHQvLyBXaGVuIHRoZSBwdHkgaG9zdCByZXN0YXJ0cywgcmVjb25uZWN0IGlzIG5vIGxvbmdlciBwb3NzaWJsZVxuXHRcdFx0aWYgKCF0aGlzLl9pc0Rpc2Nvbm5lY3RlZCkge1xuXHRcdFx0XHR0aGlzLl9pc0Rpc2Nvbm5lY3RlZCA9IHRydWU7XG5cdFx0XHRcdHRoaXMuX29uUHR5RGlzY29ubmVjdC5maXJlKCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9wdHlSZXNwb25zaXZlTGlzdGVuZXI/LmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuX3B0eVJlc3BvbnNpdmVMaXN0ZW5lciA9IHVuZGVmaW5lZDtcblx0XHRcdGlmICh0aGlzLl9zaGVsbExhdW5jaENvbmZpZykge1xuXHRcdFx0XHRpZiAodGhpcy5fc2hlbGxMYXVuY2hDb25maWcuaXNGZWF0dXJlVGVybWluYWwgJiYgIXRoaXMucmVjb25uZWN0aW9uUHJvcGVydGllcykge1xuXHRcdFx0XHRcdC8vIEluZGljYXRlIHRoZSBwcm9jZXNzIGlzIGV4aXRlZCAoYW5kIGdvbmUgZm9yZXZlcikgb25seSBmb3IgZmVhdHVyZSB0ZXJtaW5hbHNcblx0XHRcdFx0XHQvLyBzbyB0aGV5IGNhbiByZWFjdCB0byB0aGUgZXhpdCwgdGhpcyBpcyBwYXJ0aWN1bGFybHkgaW1wb3J0YW50IGZvciB0YXNrcyBzb1xuXHRcdFx0XHRcdC8vIHRoYXQgaXQga25vd3MgdGhhdCB0aGUgcHJvY2VzcyBpcyBub3Qgc3RpbGwgYWN0aXZlLiBOb3RlIHRoYXQgdGhpcyBpcyBub3Rcblx0XHRcdFx0XHQvLyBkb25lIGZvciByZWd1bGFyIHRlcm1pbmFscyBiZWNhdXNlIG90aGVyd2lzZSB0aGUgdGVybWluYWwgaW5zdGFuY2Ugd291bGQgYmVcblx0XHRcdFx0XHQvLyBkaXNwb3NlZC5cblx0XHRcdFx0XHR0aGlzLl9vbkV4aXQoLTEpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIEZvciBub3JtYWwgdGVybWluYWxzIHdyaXRlIGEgbWVzc2FnZSBpbmRpY2F0aW5nIHdoYXQgaGFwcGVuZWQgYW5kIHJlbGF1bmNoXG5cdFx0XHRcdFx0Ly8gdXNpbmcgdGhlIHByZXZpb3VzIHNoZWxsTGF1bmNoQ29uZmlnXG5cdFx0XHRcdFx0Y29uc3QgbWVzc2FnZSA9IGxvY2FsaXplKCdwdHlIb3N0UmVsYXVuY2gnLCBcIlJlc3RhcnRpbmcgdGhlIHRlcm1pbmFsIGJlY2F1c2UgdGhlIGNvbm5lY3Rpb24gdG8gdGhlIHNoZWxsIHByb2Nlc3Mgd2FzIGxvc3QuLi5cIik7XG5cdFx0XHRcdFx0dGhpcy5fb25Qcm9jZXNzRGF0YS5maXJlKHsgZGF0YTogZm9ybWF0TWVzc2FnZUZvclRlcm1pbmFsKG1lc3NhZ2UsIHsgbG91ZEZvcm1hdHRpbmc6IHRydWUgfSksIHRyYWNrQ29tbWl0OiBmYWxzZSB9KTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnJlbGF1bmNoKHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLCB0aGlzLl9kaW1lbnNpb25zLmNvbHMsIHRoaXMuX2RpbWVuc2lvbnMucm93cywgZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0YXN5bmMgZ2V0QmFja2VuZE9TKCk6IFByb21pc2U8T3BlcmF0aW5nU3lzdGVtPiB7XG5cdFx0bGV0IG9zID0gT1M7XG5cdFx0aWYgKCEhdGhpcy5yZW1vdGVBdXRob3JpdHkpIHtcblx0XHRcdGNvbnN0IHJlbW90ZUVudiA9IGF3YWl0IHRoaXMuX3JlbW90ZUFnZW50U2VydmljZS5nZXRFbnZpcm9ubWVudCgpO1xuXHRcdFx0aWYgKCFyZW1vdGVFbnYpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZ2V0IHJlbW90ZSBlbnZpcm9ubWVudCBmb3IgcmVtb3RlIGF1dGhvcml0eSBcIiR7dGhpcy5yZW1vdGVBdXRob3JpdHl9XCJgKTtcblx0XHRcdH1cblx0XHRcdG9zID0gcmVtb3RlRW52Lm9zO1xuXHRcdH1cblx0XHRyZXR1cm4gb3M7XG5cdH1cblxuXHRzZXREaW1lbnNpb25zKGNvbHM6IG51bWJlciwgcm93czogbnVtYmVyKTogUHJvbWlzZTx2b2lkPjtcblx0c2V0RGltZW5zaW9ucyhjb2xzOiBudW1iZXIsIHJvd3M6IG51bWJlciwgc3luYzogZmFsc2UpOiBQcm9taXNlPHZvaWQ+O1xuXHRzZXREaW1lbnNpb25zKGNvbHM6IG51bWJlciwgcm93czogbnVtYmVyLCBzeW5jOiB0cnVlKTogdm9pZDtcblx0c2V0RGltZW5zaW9ucyhjb2xzOiBudW1iZXIsIHJvd3M6IG51bWJlciwgc3luYz86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHwgdm9pZCB7XG5cdFx0aWYgKHN5bmMpIHtcblx0XHRcdHRoaXMuX3Jlc2l6ZShjb2xzLCByb3dzKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5wdHlQcm9jZXNzUmVhZHkudGhlbigoKSA9PiB0aGlzLl9yZXNpemUoY29scywgcm93cykpO1xuXHR9XG5cblx0YXN5bmMgc2V0VW5pY29kZVZlcnNpb24odmVyc2lvbjogJzYnIHwgJzExJyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm9jZXNzPy5zZXRVbmljb2RlVmVyc2lvbih2ZXJzaW9uKTtcblx0fVxuXG5cdHByaXZhdGUgX3Jlc2l6ZShjb2xzOiBudW1iZXIsIHJvd3M6IG51bWJlcikge1xuXHRcdGlmICghdGhpcy5fcHJvY2Vzcykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHQvLyBUaGUgY2hpbGQgcHJvY2VzcyBjb3VsZCBhbHJlYWR5IGJlIHRlcm1pbmF0ZWRcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5fcHJvY2Vzcy5yZXNpemUoY29scywgcm93cyk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdC8vIFdlIHRyaWVkIHRvIHdyaXRlIHRvIGEgY2xvc2VkIHBpcGUgLyBjaGFubmVsLlxuXHRcdFx0aWYgKGVycm9yLmNvZGUgIT09ICdFUElQRScgJiYgZXJyb3IuY29kZSAhPT0gJ0VSUl9JUENfQ0hBTk5FTF9DTE9TRUQnKSB7XG5cdFx0XHRcdHRocm93IChlcnJvcik7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX2RpbWVuc2lvbnMuY29scyA9IGNvbHM7XG5cdFx0dGhpcy5fZGltZW5zaW9ucy5yb3dzID0gcm93cztcblx0fVxuXG5cdGFzeW5jIHdyaXRlKGRhdGE6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMucHR5UHJvY2Vzc1JlYWR5O1xuXHRcdHRoaXMuX2RhdGFGaWx0ZXIuZGlzYWJsZVNlYW1sZXNzUmVsYXVuY2goKTtcblx0XHR0aGlzLl9oYXNXcml0dGVuRGF0YSA9IHRydWU7XG5cdFx0aWYgKHRoaXMuc2hlbGxQcm9jZXNzSWQgfHwgdGhpcy5fcHJvY2Vzc1R5cGUgPT09IFByb2Nlc3NUeXBlLlBzdWVkb1Rlcm1pbmFsKSB7XG5cdFx0XHRpZiAodGhpcy5fcHJvY2Vzcykge1xuXHRcdFx0XHQvLyBTZW5kIGRhdGEgaWYgdGhlIHB0eSBpcyByZWFkeVxuXHRcdFx0XHR0aGlzLl9wcm9jZXNzLmlucHV0KGRhdGEpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBJZiB0aGUgcHR5IGlzIG5vdCByZWFkeSwgcXVldWUgdGhlIGRhdGEgcmVjZWl2ZWQgdG8gc2VuZCBsYXRlclxuXHRcdFx0dGhpcy5fcHJlTGF1bmNoSW5wdXRRdWV1ZS5wdXNoKGRhdGEpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHByb2Nlc3NCaW5hcnkoZGF0YTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5wdHlQcm9jZXNzUmVhZHk7XG5cdFx0dGhpcy5fZGF0YUZpbHRlci5kaXNhYmxlU2VhbWxlc3NSZWxhdW5jaCgpO1xuXHRcdHRoaXMuX2hhc1dyaXR0ZW5EYXRhID0gdHJ1ZTtcblx0XHR0aGlzLl9wcm9jZXNzPy5wcm9jZXNzQmluYXJ5KGRhdGEpO1xuXHR9XG5cblx0Z2V0IGluaXRpYWxDd2QoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5faW5pdGlhbEN3ZCA/PyAnJztcblx0fVxuXG5cdGFzeW5jIHJlZnJlc2hQcm9wZXJ0eTxUIGV4dGVuZHMgUHJvY2Vzc1Byb3BlcnR5VHlwZT4odHlwZTogVCk6IFByb21pc2U8SVByb2Nlc3NQcm9wZXJ0eU1hcFtUXT4ge1xuXHRcdGlmICghdGhpcy5fcHJvY2Vzcykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgcmVmcmVzaCBwcm9wZXJ0eSB3aGVuIHByb2Nlc3MgaXMgbm90IHNldCcpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fcHJvY2Vzcy5yZWZyZXNoUHJvcGVydHkodHlwZSk7XG5cdH1cblxuXHRhc3luYyB1cGRhdGVQcm9wZXJ0eTxUIGV4dGVuZHMgUHJvY2Vzc1Byb3BlcnR5VHlwZT4odHlwZTogVCwgdmFsdWU6IElQcm9jZXNzUHJvcGVydHlNYXBbVF0pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fcHJvY2Vzcz8udXBkYXRlUHJvcGVydHkodHlwZSwgdmFsdWUpO1xuXHR9XG5cblx0YWNrbm93bGVkZ2VEYXRhRXZlbnQoY2hhckNvdW50OiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9hY2tEYXRhQnVmZmVyZXIuYWNrKGNoYXJDb3VudCk7XG5cdH1cblxuXHRwcml2YXRlIF9vbkV4aXQoZXhpdENvZGU6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuX3Byb2Nlc3MgPSBudWxsO1xuXHRcdC8vIElmIHRoZSBwcm9jZXNzIGlzIG1hcmtlZCBhcyBsYXVuY2hpbmcgdGhlbiBtYXJrIHRoZSBwcm9jZXNzIGFzIGtpbGxlZFxuXHRcdC8vIGR1cmluZyBsYXVuY2guIFRoaXMgdHlwaWNhbGx5IG1lYW5zIHRoYXQgdGhlcmUgaXMgYSBwcm9ibGVtIHdpdGggdGhlXG5cdFx0Ly8gc2hlbGwgYW5kIGFyZ3MuXG5cdFx0aWYgKHRoaXMucHJvY2Vzc1N0YXRlID09PSBQcm9jZXNzU3RhdGUuTGF1bmNoaW5nKSB7XG5cdFx0XHR0aGlzLl9zZXRQcm9jZXNzU3RhdGUoUHJvY2Vzc1N0YXRlLktpbGxlZER1cmluZ0xhdW5jaCk7XG5cdFx0fVxuXG5cdFx0Ly8gSWYgVGVybWluYWxJbnN0YW5jZSBkaWQgbm90IGtub3cgYWJvdXQgdGhlIHByb2Nlc3MgZXhpdCB0aGVuIGl0IHdhc1xuXHRcdC8vIHRyaWdnZXJlZCBieSB0aGUgcHJvY2Vzcywgbm90IG9uIFZTIENvZGUncyBzaWRlLlxuXHRcdGlmICh0aGlzLnByb2Nlc3NTdGF0ZSA9PT0gUHJvY2Vzc1N0YXRlLlJ1bm5pbmcpIHtcblx0XHRcdHRoaXMuX3NldFByb2Nlc3NTdGF0ZShQcm9jZXNzU3RhdGUuS2lsbGVkQnlQcm9jZXNzKTtcblx0XHR9XG5cblx0XHR0aGlzLl9vblByb2Nlc3NFeGl0LmZpcmUoZXhpdENvZGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0UHJvY2Vzc1N0YXRlKHN0YXRlOiBQcm9jZXNzU3RhdGUpIHtcblx0XHR0aGlzLnByb2Nlc3NTdGF0ZSA9IHN0YXRlO1xuXHRcdHRoaXMuX29uUHJvY2Vzc1N0YXRlQ2hhbmdlLmZpcmUoKTtcblx0fVxuXG5cdHByaXZhdGUgX29uRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb25DaGFuZ2UobmV3Q29sbGVjdGlvbjogSU1lcmdlZEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKTogdm9pZCB7XG5cdFx0Y29uc3QgZGlmZiA9IHRoaXMuX2V4dEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uIS5kaWZmKG5ld0NvbGxlY3Rpb24sIHsgd29ya3NwYWNlRm9sZGVyOiB0aGlzLl9jd2RXb3Jrc3BhY2VGb2xkZXIgfSk7XG5cdFx0aWYgKGRpZmYgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Ly8gSWYgdGhlcmUgYXJlIG5vIGxvbmdlciBkaWZmZXJlbmNlcywgcmVtb3ZlIHRoZSBzdGFsZSBpbmZvIGluZGljYXRvclxuXHRcdFx0aWYgKHRoaXMuZW52aXJvbm1lbnRWYXJpYWJsZUluZm8gaW5zdGFuY2VvZiBFbnZpcm9ubWVudFZhcmlhYmxlSW5mb1N0YWxlKSB7XG5cdFx0XHRcdHRoaXMuZW52aXJvbm1lbnRWYXJpYWJsZUluZm8gPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFbnZpcm9ubWVudFZhcmlhYmxlSW5mb0NoYW5nZXNBY3RpdmUsIHRoaXMuX2V4dEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uISk7XG5cdFx0XHRcdHRoaXMuX29uRW52aXJvbm1lbnRWYXJpYWJsZUluZm9DaGFuZ2UuZmlyZSh0aGlzLmVudmlyb25tZW50VmFyaWFibGVJbmZvKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5lbnZpcm9ubWVudFZhcmlhYmxlSW5mbyA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVudmlyb25tZW50VmFyaWFibGVJbmZvU3RhbGUsIGRpZmYsIHRoaXMuX2luc3RhbmNlSWQsIG5ld0NvbGxlY3Rpb24pO1xuXHRcdHRoaXMuX29uRW52aXJvbm1lbnRWYXJpYWJsZUluZm9DaGFuZ2UuZmlyZSh0aGlzLmVudmlyb25tZW50VmFyaWFibGVJbmZvKTtcblx0fVxuXG5cdGFzeW5jIGNsZWFyQnVmZmVyKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3Byb2Nlc3M/LmNsZWFyQnVmZmVyPy4oKTtcblx0fVxufVxuXG5jbGFzcyBBY2tEYXRhQnVmZmVyZXIge1xuXHRwcml2YXRlIF91bnNlbnRDaGFyQ291bnQ6IG51bWJlciA9IDA7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY2FsbGJhY2s6IChjaGFyQ291bnQ6IG51bWJlcikgPT4gdm9pZFxuXHQpIHtcblx0fVxuXG5cdGFjayhjaGFyQ291bnQ6IG51bWJlcikge1xuXHRcdHRoaXMuX3Vuc2VudENoYXJDb3VudCArPSBjaGFyQ291bnQ7XG5cdFx0d2hpbGUgKHRoaXMuX3Vuc2VudENoYXJDb3VudCA+IEZsb3dDb250cm9sQ29uc3RhbnRzLkNoYXJDb3VudEFja1NpemUpIHtcblx0XHRcdHRoaXMuX3Vuc2VudENoYXJDb3VudCAtPSBGbG93Q29udHJvbENvbnN0YW50cy5DaGFyQ291bnRBY2tTaXplO1xuXHRcdFx0dGhpcy5fY2FsbGJhY2soRmxvd0NvbnRyb2xDb25zdGFudHMuQ2hhckNvdW50QWNrU2l6ZSk7XG5cdFx0fVxuXHR9XG59XG5cbmNvbnN0IGVudW0gU2VhbWxlc3NSZWxhdW5jaENvbnN0YW50cyB7XG5cdC8qKlxuXHQgKiBIb3cgbG9uZyB0byByZWNvcmQgZGF0YSBldmVudHMgZm9yIG5ldyB0ZXJtaW5hbHMuXG5cdCAqL1xuXHRSZWNvcmRUZXJtaW5hbER1cmF0aW9uID0gMTAwMDAsXG5cdC8qKlxuXHQgKiBUaGUgbWF4aW11bSBkdXJhdGlvbiBhZnRlciBhIHJlbGF1bmNoIG9jY3VycyB0byB0cmlnZ2VyIGEgc3dhcC5cblx0ICovXG5cdFN3YXBXYWl0TWF4aW11bUR1cmF0aW9uID0gMzAwMFxufVxuXG4vKipcbiAqIEZpbHRlcnMgZGF0YSBldmVudHMgZnJvbSB0aGUgcHJvY2VzcyBhbmQgc3VwcG9ydHMgc2VhbWxlc3NseSByZXN0YXJ0aW5nIHN3YXBwaW5nIG91dCB0aGUgcHJvY2Vzc1xuICogd2l0aCBhbm90aGVyLCBkZWxheWluZyB0aGUgc3dhcCBpbiBvdXRwdXQgaW4gb3JkZXIgdG8gbWluaW1pemUgZmxpY2tlcmluZy9jbGVhcmluZyBvZiB0aGVcbiAqIHRlcm1pbmFsLlxuICovXG5jbGFzcyBTZWFtbGVzc1JlbGF1bmNoRGF0YUZpbHRlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIF9maXJzdFJlY29yZGVyPzogVGVybWluYWxSZWNvcmRlcjtcblx0cHJpdmF0ZSBfc2Vjb25kUmVjb3JkZXI/OiBUZXJtaW5hbFJlY29yZGVyO1xuXHRwcml2YXRlIF9maXJzdERpc3Bvc2FibGU/OiBJRGlzcG9zYWJsZTtcblx0cHJpdmF0ZSBfc2Vjb25kRGlzcG9zYWJsZT86IElEaXNwb3NhYmxlO1xuXHRwcml2YXRlIF9kYXRhTGlzdGVuZXI/OiBJRGlzcG9zYWJsZTtcblx0cHJpdmF0ZSBfYWN0aXZlUHJvY2Vzcz86IElUZXJtaW5hbENoaWxkUHJvY2Vzcztcblx0cHJpdmF0ZSBfZGlzYWJsZVNlYW1sZXNzUmVsYXVuY2g6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRwcml2YXRlIF9zd2FwVGltZW91dD86IG51bWJlcjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vblByb2Nlc3NEYXRhID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8c3RyaW5nIHwgSVByb2Nlc3NEYXRhRXZlbnQ+KCkpO1xuXHRnZXQgb25Qcm9jZXNzRGF0YSgpOiBFdmVudDxzdHJpbmcgfCBJUHJvY2Vzc0RhdGFFdmVudD4geyByZXR1cm4gdGhpcy5fb25Qcm9jZXNzRGF0YS5ldmVudDsgfVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVGVybWluYWxMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElUZXJtaW5hbExvZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdG5ld1Byb2Nlc3MocHJvY2VzczogSVRlcm1pbmFsQ2hpbGRQcm9jZXNzLCByZXNldDogYm9vbGVhbikge1xuXHRcdC8vIFN0b3AgbGlzdGVuaW5nIHRvIHRoZSBvbGQgcHJvY2VzcyBhbmQgdHJpZ2dlciBkZWxheWVkIHNodXRkb3duIChmb3IgaGFuZyBpc3N1ZSAjNzE5NjYpXG5cdFx0dGhpcy5fZGF0YUxpc3RlbmVyPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fYWN0aXZlUHJvY2Vzcz8uc2h1dGRvd24oZmFsc2UpO1xuXG5cdFx0dGhpcy5fYWN0aXZlUHJvY2VzcyA9IHByb2Nlc3M7XG5cblx0XHQvLyBTdGFydCBmaXJpbmcgZXZlbnRzIGltbWVkaWF0ZWx5IGlmOlxuXHRcdC8vIC0gdGhlcmUncyBubyByZWNvcmRlciwgd2hpY2ggbWVhbnMgaXQncyBhIG5ldyB0ZXJtaW5hbFxuXHRcdC8vIC0gdGhpcyBpcyBub3QgYSByZXNldCwgc28gc2VhbWxlc3MgcmVsYXVuY2ggaXNuJ3QgbmVjZXNzYXJ5XG5cdFx0Ly8gLSBzZWFtbGVzcyByZWxhdW5jaCBpcyBkaXNhYmxlZCBiZWNhdXNlIHRoZSB0ZXJtaW5hbCBoYXMgYWNjZXB0ZWQgaW5wdXRcblx0XHRpZiAoIXRoaXMuX2ZpcnN0UmVjb3JkZXIgfHwgIXJlc2V0IHx8IHRoaXMuX2Rpc2FibGVTZWFtbGVzc1JlbGF1bmNoKSB7XG5cdFx0XHR0aGlzLl9maXJzdERpc3Bvc2FibGU/LmRpc3Bvc2UoKTtcblx0XHRcdFt0aGlzLl9maXJzdFJlY29yZGVyLCB0aGlzLl9maXJzdERpc3Bvc2FibGVdID0gdGhpcy5fY3JlYXRlUmVjb3JkZXIocHJvY2Vzcyk7XG5cdFx0XHRpZiAodGhpcy5fZGlzYWJsZVNlYW1sZXNzUmVsYXVuY2ggJiYgcmVzZXQpIHtcblx0XHRcdFx0dGhpcy5fb25Qcm9jZXNzRGF0YS5maXJlKCdcXHgxYmMnKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2RhdGFMaXN0ZW5lciA9IHByb2Nlc3Mub25Qcm9jZXNzRGF0YShlID0+IHRoaXMuX29uUHJvY2Vzc0RhdGEuZmlyZShlKSk7XG5cdFx0XHR0aGlzLl9kaXNhYmxlU2VhbWxlc3NSZWxhdW5jaCA9IGZhbHNlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFRyaWdnZXIgYSBzd2FwIGlmIHRoZXJlIHdhcyBhIHJlY2VudCByZWxhdW5jaFxuXHRcdGlmICh0aGlzLl9zZWNvbmRSZWNvcmRlcikge1xuXHRcdFx0dGhpcy50cmlnZ2VyU3dhcCgpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3N3YXBUaW1lb3V0ID0gbWFpbldpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHRoaXMudHJpZ2dlclN3YXAoKSwgU2VhbWxlc3NSZWxhdW5jaENvbnN0YW50cy5Td2FwV2FpdE1heGltdW1EdXJhdGlvbik7XG5cblx0XHQvLyBQYXVzZSBhbGwgb3V0Z29pbmcgZGF0YSBldmVudHNcblx0XHR0aGlzLl9kYXRhTGlzdGVuZXI/LmRpc3Bvc2UoKTtcblxuXHRcdHRoaXMuX2ZpcnN0RGlzcG9zYWJsZT8uZGlzcG9zZSgpO1xuXHRcdGNvbnN0IHJlY29yZGVyID0gdGhpcy5fY3JlYXRlUmVjb3JkZXIocHJvY2Vzcyk7XG5cdFx0W3RoaXMuX3NlY29uZFJlY29yZGVyLCB0aGlzLl9zZWNvbmREaXNwb3NhYmxlXSA9IHJlY29yZGVyO1xuXHR9XG5cblx0LyoqXG5cdCAqIERpc2FibGVzIHNlYW1sZXNzIHJlbGF1bmNoIGZvciB0aGUgYWN0aXZlIHByb2Nlc3Ncblx0ICovXG5cdGRpc2FibGVTZWFtbGVzc1JlbGF1bmNoKCkge1xuXHRcdHRoaXMuX2Rpc2FibGVTZWFtbGVzc1JlbGF1bmNoID0gdHJ1ZTtcblx0XHR0aGlzLl9zdG9wUmVjb3JkaW5nKCk7XG5cdFx0dGhpcy50cmlnZ2VyU3dhcCgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRyaWdnZXIgdGhlIHN3YXAgb2YgdGhlIHByb2Nlc3NlcyBpZiBuZWVkZWQgKGVnLiB0aW1lb3V0LCBpbnB1dClcblx0ICovXG5cdHRyaWdnZXJTd2FwKCkge1xuXHRcdC8vIENsZWFyIHRoZSBzd2FwIHRpbWVvdXQgaWYgaXQgZXhpc3RzXG5cdFx0aWYgKHRoaXMuX3N3YXBUaW1lb3V0KSB7XG5cdFx0XHRtYWluV2luZG93LmNsZWFyVGltZW91dCh0aGlzLl9zd2FwVGltZW91dCk7XG5cdFx0XHR0aGlzLl9zd2FwVGltZW91dCA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHQvLyBEbyBub3RoaW5nIGlmIHRoZXJlJ3Mgbm90aGluZyBiZWluZyByZWNvcmRlclxuXHRcdGlmICghdGhpcy5fZmlyc3RSZWNvcmRlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHQvLyBDbGVhciB0aGUgZmlyc3QgcmVjb3JkZXIgaWYgbm8gc2Vjb25kIHByb2Nlc3Mgd2FzIGF0dGFjaGVkIGJlZm9yZSB0aGUgc3dhcCB0cmlnZ2VyXG5cdFx0aWYgKCF0aGlzLl9zZWNvbmRSZWNvcmRlcikge1xuXHRcdFx0dGhpcy5fZmlyc3RSZWNvcmRlciA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX2ZpcnN0RGlzcG9zYWJsZT8uZGlzcG9zZSgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIEdlbmVyYXRlIGRhdGEgZm9yIGVhY2ggcmVjb3JkZXJcblx0XHRjb25zdCBmaXJzdERhdGEgPSB0aGlzLl9nZXREYXRhRnJvbVJlY29yZGVyKHRoaXMuX2ZpcnN0UmVjb3JkZXIpO1xuXHRcdGNvbnN0IHNlY29uZERhdGEgPSB0aGlzLl9nZXREYXRhRnJvbVJlY29yZGVyKHRoaXMuX3NlY29uZFJlY29yZGVyKTtcblxuXHRcdC8vIFJlLXdyaXRlIHRoZSB0ZXJtaW5hbCBpZiB0aGUgZGF0YSBkaWZmZXJzXG5cdFx0aWYgKGZpcnN0RGF0YSA9PT0gc2Vjb25kRGF0YSkge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZShgU2VhbWxlc3MgdGVybWluYWwgcmVsYXVuY2ggLSBpZGVudGljYWwgY29udGVudGApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBTZWFtbGVzcyB0ZXJtaW5hbCByZWxhdW5jaCAtIHJlc2V0dGluZyBjb250ZW50YCk7XG5cdFx0XHQvLyBGaXJlIGZ1bGwgcmVzZXQgKFJJUykgZm9sbG93ZWQgYnkgdGhlIG5ldyBkYXRhIHNvIHRoZSB1cGRhdGUgaGFwcGVucyBpbiB0aGUgc2FtZSBmcmFtZVxuXHRcdFx0dGhpcy5fb25Qcm9jZXNzRGF0YS5maXJlKHsgZGF0YTogYFxceDFiYyR7c2Vjb25kRGF0YX1gLCB0cmFja0NvbW1pdDogZmFsc2UgfSk7XG5cdFx0fVxuXG5cdFx0Ly8gU2V0IHVwIHRoZSBuZXcgZGF0YSBsaXN0ZW5lclxuXHRcdHRoaXMuX2RhdGFMaXN0ZW5lcj8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2RhdGFMaXN0ZW5lciA9IHRoaXMuX2FjdGl2ZVByb2Nlc3MhLm9uUHJvY2Vzc0RhdGEoZSA9PiB0aGlzLl9vblByb2Nlc3NEYXRhLmZpcmUoZSkpO1xuXG5cdFx0Ly8gUmVwbGFjZSBmaXJzdCByZWNvcmRlciB3aXRoIHNlY29uZFxuXHRcdHRoaXMuX2ZpcnN0UmVjb3JkZXIgPSB0aGlzLl9zZWNvbmRSZWNvcmRlcjtcblx0XHR0aGlzLl9maXJzdERpc3Bvc2FibGU/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9maXJzdERpc3Bvc2FibGUgPSB0aGlzLl9zZWNvbmREaXNwb3NhYmxlO1xuXHRcdHRoaXMuX3NlY29uZFJlY29yZGVyID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBfc3RvcFJlY29yZGluZygpIHtcblx0XHQvLyBDb250aW51ZSByZWNvcmRpbmcgaWYgYSBzd2FwIGlzIGNvbWluZ1xuXHRcdGlmICh0aGlzLl9zd2FwVGltZW91dCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHQvLyBTdG9wIHJlY29yZGluZ1xuXHRcdHRoaXMuX2ZpcnN0UmVjb3JkZXIgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fZmlyc3REaXNwb3NhYmxlPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fc2Vjb25kUmVjb3JkZXIgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fc2Vjb25kRGlzcG9zYWJsZT8uZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlUmVjb3JkZXIocHJvY2VzczogSVRlcm1pbmFsQ2hpbGRQcm9jZXNzKTogW1Rlcm1pbmFsUmVjb3JkZXIsIElEaXNwb3NhYmxlXSB7XG5cdFx0Y29uc3QgcmVjb3JkZXIgPSBuZXcgVGVybWluYWxSZWNvcmRlcigwLCAwKTtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gcHJvY2Vzcy5vblByb2Nlc3NEYXRhKGUgPT4gcmVjb3JkZXIuaGFuZGxlRGF0YSh0eXBlb2YgZSA9PT0gJ3N0cmluZycgPyBlIDogZS5kYXRhKSk7XG5cdFx0cmV0dXJuIFtyZWNvcmRlciwgZGlzcG9zYWJsZV07XG5cdH1cblxuXHRwcml2YXRlIF9nZXREYXRhRnJvbVJlY29yZGVyKHJlY29yZGVyOiBUZXJtaW5hbFJlY29yZGVyKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gcmVjb3JkZXIuZ2VuZXJhdGVSZXBsYXlFdmVudFN5bmMoKS5ldmVudHMuZmlsdGVyKGUgPT4gISFlLmRhdGEpLm1hcChlID0+IGUuZGF0YSkuam9pbignJyk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxZQUFZLFNBQXNCLG9CQUFvQjtBQUMvRCxTQUFTLGVBQWU7QUFDeEIsU0FBOEIsYUFBYSxXQUFXLGlCQUFpQixVQUFVO0FBRWpGLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsdUJB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QSxFQUNsRDtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS0EsMEJBQTBCO0FBQ3pCLFNBQUssMkJBQTJCO0FBQ2hDLFNBQUssZUFBZTtBQUNwQixTQUFLLFlBQVk7QUFBQSxFQUNsQjtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS0EsY0FBYztBQUViLFFBQUksS0FBSyxjQUFjO0FBQ3RCLGlCQUFXLGFBQWEsS0FBSyxZQUFZO0FBQ3pDLFdBQUssZUFBZTtBQUFBLElBQ3JCO0FBR0EsUUFBSSxDQUFDLEtBQUssZ0JBQWdCO0FBQ3pCO0FBQUEsSUFDRDtBQUVBLFFBQUksQ0FBQyxLQUFLLGlCQUFpQjtBQUMxQixXQUFLLGlCQUFpQjtBQUN0QixXQUFLLGtCQUFrQixRQUFRO0FBQy9CO0FBQUEsSUFDRDtBQUdBLFVBQU0sWUFBWSxLQUFLLHFCQUFxQixLQUFLLGNBQWM7QUFDL0QsVUFBTSxhQUFhLEtBQUsscUJBQXFCLEtBQUssZUFBZTtBQUdqRSxRQUFJLGNBQWMsWUFBWTtBQUM3QixXQUFLLFlBQVksTUFBTSxnREFBZ0Q7QUFBQSxJQUN4RSxPQUFPO0FBQ04sV0FBSyxZQUFZLE1BQU0sZ0RBQWdEO0FBRXZFLFdBQUssZUFBZSxLQUFLLEVBQUUsTUFBTSxRQUFRLFVBQVUsSUFBSSxhQUFhLE1BQU0sQ0FBQztBQUFBLElBQzVFO0FBR0EsU0FBSyxlQUFlLFFBQVE7QUFDNUIsU0FBSyxnQkFBZ0IsS0FBSyxlQUFnQixjQUFjLE9BQUssS0FBSyxlQUFlLEtBQUssQ0FBQyxDQUFDO0FBR3hGLFNBQUssaUJBQWlCLEtBQUs7QUFDM0IsU0FBSyxrQkFBa0IsUUFBUTtBQUMvQixTQUFLLG1CQUFtQixLQUFLO0FBQzdCLFNBQUssa0JBQWtCO0FBQUEsRUFDeEI7QUFBQSxFQUVRLGlCQUFpQjtBQUV4QixRQUFJLEtBQUssY0FBYztBQUN0QjtBQUFBLElBQ0Q7QUFFQSxTQUFLLGlCQUFpQjtBQUN0QixTQUFLLGtCQUFrQixRQUFRO0FBQy9CLFNBQUssa0JBQWtCO0FBQ3ZCLFNBQUssbUJBQW1CLFFBQVE7QUFBQSxFQUNqQztBQUFBLEVBRVEsZ0JBQWdCLFNBQWlFO0FBQ3hGLFVBQU0sV0FBVyxJQUFJLGlCQUFpQixHQUFHLENBQUM7QUFDMUMsVUFBTSxhQUFhLFFBQVEsY0FBYyxPQUFLLFNBQVMsV0FBVyxPQUFPLE1BQU0sV0FBVyxJQUFJLEVBQUUsSUFBSSxDQUFDO0FBQ3JHLFdBQU8sQ0FBQyxVQUFVLFVBQVU7QUFBQSxFQUM3QjtBQUFBLEVBRVEscUJBQXFCLFVBQW9DO0FBQ2hFLFdBQU8sU0FBUyx3QkFBd0IsRUFBRSxPQUFPLE9BQU8sT0FBSyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxPQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRTtBQUFBLEVBQ2hHO0FBQ0Q7QUFwSU0sNkJBQU47QUFBQSxFQWVHO0FBQUEsR0FmRzsiLAogICJuYW1lcyI6IFsiUHJvY2Vzc0NvbnN0YW50cyIsICJQcm9jZXNzVHlwZSIsICJyZXN1bHQiLCAiU2VhbWxlc3NSZWxhdW5jaENvbnN0YW50cyJdCn0K
