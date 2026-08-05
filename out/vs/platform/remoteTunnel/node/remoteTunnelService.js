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
import { CONFIGURATION_KEY_HOST_NAME, CONFIGURATION_KEY_PREVENT_SLEEP, LOGGER_NAME, LOG_ID, TunnelStates, INACTIVE_TUNNEL_MODE } from "../common/remoteTunnel.js";
import { Emitter } from "../../../base/common/event.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { INativeEnvironmentService } from "../../environment/common/environment.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { ILoggerService, LogLevelToString } from "../../log/common/log.js";
import { dirname, join } from "../../../base/common/path.js";
import { spawn } from "child_process";
import { IProductService } from "../../product/common/productService.js";
import { isMacintosh, isWindows } from "../../../base/common/platform.js";
import { createCancelablePromise, Delayer } from "../../../base/common/async.js";
import { ISharedProcessLifecycleService } from "../../lifecycle/node/sharedProcessLifecycleService.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { localize } from "../../../nls.js";
import { hostname, homedir } from "os";
import { IStorageService, StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { isString } from "../../../base/common/types.js";
import { StreamSplitter } from "../../../base/node/nodeStreams.js";
import { joinPath } from "../../../base/common/resources.js";
const restartTunnelOnConfigurationChanges = [
  CONFIGURATION_KEY_HOST_NAME,
  CONFIGURATION_KEY_PREVENT_SLEEP
];
const TUNNEL_ACCESS_SESSION = "remoteTunnelSession";
const TUNNEL_ACCESS_IS_SERVICE = "remoteTunnelIsService";
let RemoteTunnelService = class extends Disposable {
  constructor(telemetryService, productService, environmentService, loggerService, sharedProcessLifecycleService, configurationService, storageService) {
    super();
    this.telemetryService = telemetryService;
    this.productService = productService;
    this.environmentService = environmentService;
    this.configurationService = configurationService;
    this.storageService = storageService;
    this._onDidTokenFailedEmitter = new Emitter();
    this.onDidTokenFailed = this._onDidTokenFailedEmitter.event;
    this._onDidChangeTunnelStatusEmitter = new Emitter();
    this.onDidChangeTunnelStatus = this._onDidChangeTunnelStatusEmitter.event;
    this._onDidChangeModeEmitter = new Emitter();
    this.onDidChangeMode = this._onDidChangeModeEmitter.event;
    /**
     * "Mode" in the terminal state we want to get to -- started, stopped, and
     * the attributes associated with each.
     *
     * At any given time, work may be ongoing to get `_tunnelStatus` into a
     * state that reflects the desired `mode`.
     */
    this._mode = INACTIVE_TUNNEL_MODE;
    this._initialized = false;
    this.defaultOnOutput = (a, isErr) => {
      if (isErr) {
        this._logger.error(a);
      } else {
        this._logger.info(a);
      }
    };
    this._logger = this._register(loggerService.createLogger(joinPath(environmentService.logsHome, `${LOG_ID}.log`), { id: LOG_ID, name: LOGGER_NAME }));
    this._startTunnelProcessDelayer = new Delayer(100);
    this._register(this._logger.onDidChangeLogLevel((l) => this._logger.info("Log level changed to " + LogLevelToString(l))));
    this._register(sharedProcessLifecycleService.onWillShutdown(() => {
      this._tunnelProcess?.cancel();
      this._tunnelProcess = void 0;
      this.dispose();
    }));
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (restartTunnelOnConfigurationChanges.some((c) => e.affectsConfiguration(c))) {
        this._startTunnelProcessDelayer.trigger(() => this.updateTunnelProcess());
      }
    }));
    this._mode = this._restoreMode();
    this._tunnelStatus = TunnelStates.uninitialized;
  }
  async getTunnelStatus() {
    return this._tunnelStatus;
  }
  setTunnelStatus(tunnelStatus) {
    this._tunnelStatus = tunnelStatus;
    this._onDidChangeTunnelStatusEmitter.fire(tunnelStatus);
  }
  setMode(mode) {
    if (isSameMode(this._mode, mode)) {
      return;
    }
    this._mode = mode;
    this._storeMode(mode);
    this._onDidChangeModeEmitter.fire(this._mode);
    if (mode.active) {
      this._logger.info(`Session updated: ${mode.session.accountLabel} (${mode.session.providerId}) (service=${mode.asService})`);
      if (mode.session.token) {
        this._logger.info(`Session token updated: ${mode.session.accountLabel} (${mode.session.providerId})`);
      }
    } else {
      this._logger.info(`Session reset`);
    }
  }
  getMode() {
    return Promise.resolve(this._mode);
  }
  async initialize(mode) {
    if (this._initialized) {
      return this._tunnelStatus;
    }
    this._initialized = true;
    this.setMode(mode);
    try {
      await this._startTunnelProcessDelayer.trigger(() => this.updateTunnelProcess());
    } catch (e) {
      this._logger.error(e);
    }
    return this._tunnelStatus;
  }
  getTunnelCommandLocation() {
    if (!this._tunnelCommand) {
      let binParentLocation;
      if (isMacintosh) {
        binParentLocation = this.environmentService.appRoot;
      } else {
        binParentLocation = dirname(dirname(this.environmentService.appRoot));
      }
      this._tunnelCommand = join(binParentLocation, "bin", `${this.productService.tunnelApplicationName}${isWindows ? ".exe" : ""}`);
    }
    return this._tunnelCommand;
  }
  async startTunnel(mode) {
    if (isSameMode(this._mode, mode) && this._tunnelStatus.type !== "disconnected") {
      return this._tunnelStatus;
    }
    this.setMode(mode);
    try {
      await this._startTunnelProcessDelayer.trigger(() => this.updateTunnelProcess());
    } catch (e) {
      this._logger.error(e);
    }
    return this._tunnelStatus;
  }
  async stopTunnel() {
    if (this._tunnelProcess) {
      this._tunnelProcess.cancel();
      this._tunnelProcess = void 0;
    }
    if (this._mode.active) {
      const needsServiceUninstall = this._mode.asService;
      this.setMode(INACTIVE_TUNNEL_MODE);
      try {
        if (needsServiceUninstall) {
          this.runCodeTunnelCommand("uninstallService", ["service", "uninstall"]);
        }
      } catch (e) {
        this._logger.error(e);
      }
    }
    try {
      await this.runCodeTunnelCommand("stop", ["kill"]);
    } catch (e) {
      this._logger.error(e);
    }
    this.setTunnelStatus(TunnelStates.disconnected());
  }
  async updateTunnelProcess() {
    this.telemetryService.publicLog2("remoteTunnel.enablement", {
      enabled: this._mode.active,
      service: this._mode.active && this._mode.asService
    });
    if (this._tunnelProcess) {
      this._tunnelProcess.cancel();
      this._tunnelProcess = void 0;
    }
    let output = "";
    let isServiceInstalled = false;
    const onOutput = (a, isErr) => {
      if (isErr) {
        this._logger.error(a);
      } else {
        output += a;
      }
      if (!this.environmentService.isBuilt && a.startsWith("   Compiling")) {
        this.setTunnelStatus(TunnelStates.connecting(localize("remoteTunnelService.building", "Building CLI from sources")));
      }
    };
    const statusProcess = this.runCodeTunnelCommand("status", ["status"], onOutput);
    this._tunnelProcess = statusProcess;
    try {
      await statusProcess;
      if (this._tunnelProcess !== statusProcess) {
        return;
      }
      let status;
      try {
        status = JSON.parse(output.trim().split("\n").find((l) => l.startsWith("{")));
      } catch (e) {
        this._logger.error(`Could not parse status output: ${JSON.stringify(output.trim())}`);
        this.setTunnelStatus(TunnelStates.disconnected());
        return;
      }
      isServiceInstalled = status.service_installed;
      this._logger.info(status.tunnel ? "Other tunnel running, attaching..." : "No other tunnel running");
      if (!status.tunnel && !this._mode.active) {
        this.setTunnelStatus(TunnelStates.disconnected());
        return;
      }
    } catch (e) {
      this._logger.error(e);
      this.setTunnelStatus(TunnelStates.disconnected());
      return;
    } finally {
      if (this._tunnelProcess === statusProcess) {
        this._tunnelProcess = void 0;
      }
    }
    const session = this._mode.active ? this._mode.session : void 0;
    if (session && session.token) {
      const token = session.token;
      this.setTunnelStatus(TunnelStates.connecting(localize({ key: "remoteTunnelService.authorizing", comment: ["{0} is a user account name, {1} a provider name (e.g. Github)"] }, "Connecting as {0} ({1})", session.accountLabel, session.providerId)));
      const onLoginOutput = (a, isErr) => {
        a = a.replaceAll(token, "*".repeat(4));
        onOutput(a, isErr);
      };
      const loginProcess = this.runCodeTunnelCommand("login", ["user", "login", "--provider", session.providerId, "--log", LogLevelToString(this._logger.getLevel())], onLoginOutput, { VSCODE_CLI_ACCESS_TOKEN: token });
      this._tunnelProcess = loginProcess;
      try {
        await loginProcess;
        if (this._tunnelProcess !== loginProcess) {
          return;
        }
      } catch (e) {
        this._logger.error(e);
        this._tunnelProcess = void 0;
        this._onDidTokenFailedEmitter.fire(session);
        this.setTunnelStatus(TunnelStates.disconnected(session));
        return;
      }
    }
    const hostName = this._getTunnelName();
    if (hostName) {
      this.setTunnelStatus(TunnelStates.connecting(localize({ key: "remoteTunnelService.openTunnelWithName", comment: ["{0} is a tunnel name"] }, "Opening tunnel {0}", hostName)));
    } else {
      this.setTunnelStatus(TunnelStates.connecting(localize("remoteTunnelService.openTunnel", "Opening tunnel")));
    }
    const args = ["--accept-server-license-terms", "--log", LogLevelToString(this._logger.getLevel())];
    if (hostName) {
      args.push("--name", hostName);
    } else {
      args.push("--random-name");
    }
    let serviceInstallFailed = false;
    if (this._mode.active && this._mode.asService && !isServiceInstalled) {
      serviceInstallFailed = await this.installTunnelService(args) === false;
    }
    return this.serverOrAttachTunnel(session, args, serviceInstallFailed);
  }
  async installTunnelService(args) {
    let status;
    try {
      status = await this.runCodeTunnelCommand("serviceInstall", ["service", "install", ...args]);
    } catch (e) {
      this._logger.error(e);
      status = 1;
    }
    if (status !== 0) {
      const msg = localize("remoteTunnelService.serviceInstallFailed", "Failed to install tunnel as a service, starting in session...");
      this._logger.warn(msg);
      this.setTunnelStatus(TunnelStates.connecting(msg));
      return false;
    }
    return true;
  }
  async serverOrAttachTunnel(session, args, serviceInstallFailed) {
    args.push("--parent-process-id", String(process.pid));
    if (this._preventSleep()) {
      args.push("--no-sleep");
    }
    let isAttached = false;
    const serveCommand = this.runCodeTunnelCommand("tunnel", args, (message, isErr) => {
      if (isErr) {
        this._logger.error(message);
      } else {
        this._logger.info(message);
      }
      if (message.includes("Connected to an existing tunnel process")) {
        isAttached = true;
      }
      const m = message.match(/Open this link in your browser (https:\/\/([^\/\s]+)\/([^\/\s]+)\/([^\/\s]+))/);
      if (m) {
        const info = { link: m[1], domain: m[2], tunnelName: m[4], isAttached };
        this.setTunnelStatus(TunnelStates.connected(info, serviceInstallFailed));
      } else if (message.match(/error refreshing token/)) {
        serveCommand.cancel();
        this._onDidTokenFailedEmitter.fire(session);
        this.setTunnelStatus(TunnelStates.disconnected(session));
      }
    });
    this._tunnelProcess = serveCommand;
    serveCommand.finally(() => {
      if (serveCommand === this._tunnelProcess) {
        this._logger.info(`tunnel process terminated`);
        this._tunnelProcess = void 0;
        this._mode = INACTIVE_TUNNEL_MODE;
        this.setTunnelStatus(TunnelStates.disconnected());
      }
    });
  }
  runCodeTunnelCommand(logLabel, commandArgs, onOutput = this.defaultOnOutput, env) {
    return createCancelablePromise((token) => {
      return new Promise((resolve, reject) => {
        if (token.isCancellationRequested) {
          resolve(-1);
        }
        let tunnelProcess;
        const stdio = ["ignore", "pipe", "pipe"];
        token.onCancellationRequested(() => {
          if (tunnelProcess) {
            this._logger.info(`${logLabel} terminating(${tunnelProcess.pid})`);
            tunnelProcess.kill();
          }
        });
        if (!this.environmentService.isBuilt) {
          onOutput("Building tunnel CLI from sources and run\n", false);
          onOutput(`${logLabel} Spawning: cargo run -- tunnel ${commandArgs.join(" ")}
`, false);
          tunnelProcess = spawn("cargo", ["run", "--", "tunnel", ...commandArgs], { cwd: join(this.environmentService.appRoot, "cli"), stdio, env: { ...process.env, RUST_BACKTRACE: "1", ...env } });
        } else {
          onOutput("Running tunnel CLI\n", false);
          const tunnelCommand = this.getTunnelCommandLocation();
          onOutput(`${logLabel} Spawning: ${tunnelCommand} tunnel ${commandArgs.join(" ")}
`, false);
          tunnelProcess = spawn(tunnelCommand, ["tunnel", ...commandArgs], { cwd: homedir(), stdio, env: { ...process.env, ...env } });
        }
        tunnelProcess.stdout.pipe(new StreamSplitter("\n")).on("data", (data) => {
          if (tunnelProcess) {
            const message = data.toString();
            onOutput(message, false);
          }
        });
        tunnelProcess.stderr.pipe(new StreamSplitter("\n")).on("data", (data) => {
          if (tunnelProcess) {
            const message = data.toString();
            onOutput(message, true);
          }
        });
        tunnelProcess.on("exit", (e) => {
          if (tunnelProcess) {
            onOutput(`${logLabel} exit(${tunnelProcess.pid}): + ${e} `, false);
            tunnelProcess = void 0;
            resolve(e || 0);
          }
        });
        tunnelProcess.on("error", (e) => {
          if (tunnelProcess) {
            onOutput(`${logLabel} error(${tunnelProcess.pid}): + ${e} `, true);
            tunnelProcess = void 0;
            reject();
          }
        });
      });
    });
  }
  async getTunnelName() {
    return this._getTunnelName();
  }
  _preventSleep() {
    return !!this.configurationService.getValue(CONFIGURATION_KEY_PREVENT_SLEEP);
  }
  _getTunnelName() {
    let name = this.configurationService.getValue(CONFIGURATION_KEY_HOST_NAME) || hostname();
    name = name.replace(/^-+/g, "").replace(/[^\w-]/g, "").substring(0, 20);
    return name || void 0;
  }
  _restoreMode() {
    try {
      const tunnelAccessSession = this.storageService.get(TUNNEL_ACCESS_SESSION, StorageScope.APPLICATION);
      const asService = this.storageService.getBoolean(TUNNEL_ACCESS_IS_SERVICE, StorageScope.APPLICATION, false);
      if (tunnelAccessSession) {
        const session = JSON.parse(tunnelAccessSession);
        if (session && isString(session.accountLabel) && isString(session.sessionId) && isString(session.providerId)) {
          return { active: true, session, asService };
        }
        this._logger.error("Problems restoring session from storage, invalid format", session);
      }
    } catch (e) {
      this._logger.error("Problems restoring session from storage", e);
    }
    return INACTIVE_TUNNEL_MODE;
  }
  _storeMode(mode) {
    if (mode.active) {
      const sessionWithoutToken = {
        providerId: mode.session.providerId,
        sessionId: mode.session.sessionId,
        accountLabel: mode.session.accountLabel
      };
      this.storageService.store(TUNNEL_ACCESS_SESSION, JSON.stringify(sessionWithoutToken), StorageScope.APPLICATION, StorageTarget.MACHINE);
      this.storageService.store(TUNNEL_ACCESS_IS_SERVICE, mode.asService, StorageScope.APPLICATION, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(TUNNEL_ACCESS_SESSION, StorageScope.APPLICATION);
      this.storageService.remove(TUNNEL_ACCESS_IS_SERVICE, StorageScope.APPLICATION);
    }
  }
};
RemoteTunnelService = __decorateClass([
  __decorateParam(0, ITelemetryService),
  __decorateParam(1, IProductService),
  __decorateParam(2, INativeEnvironmentService),
  __decorateParam(3, ILoggerService),
  __decorateParam(4, ISharedProcessLifecycleService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IStorageService)
], RemoteTunnelService);
function isSameSession(a1, a2) {
  if (a1 && a2) {
    return a1.sessionId === a2.sessionId && a1.providerId === a2.providerId && a1.token === a2.token;
  }
  return a1 === a2;
}
const isSameMode = (a, b) => {
  if (a.active !== b.active) {
    return false;
  } else if (a.active && b.active) {
    return a.asService === b.asService && isSameSession(a.session, b.session);
  } else {
    return true;
  }
};
export {
  RemoteTunnelService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9yZW1vdGVUdW5uZWwvbm9kZS9yZW1vdGVUdW5uZWxTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ09ORklHVVJBVElPTl9LRVlfSE9TVF9OQU1FLCBDT05GSUdVUkFUSU9OX0tFWV9QUkVWRU5UX1NMRUVQLCBDb25uZWN0aW9uSW5mbywgSVJlbW90ZVR1bm5lbFNlc3Npb24sIElSZW1vdGVUdW5uZWxTZXJ2aWNlLCBMT0dHRVJfTkFNRSwgTE9HX0lELCBUdW5uZWxTdGF0ZXMsIFR1bm5lbFN0YXR1cywgVHVubmVsTW9kZSwgSU5BQ1RJVkVfVFVOTkVMX01PREUsIEFjdGl2ZVR1bm5lbE1vZGUgfSBmcm9tICcuLi9jb21tb24vcmVtb3RlVHVubmVsLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElOYXRpdmVFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJTG9nZ2VyLCBJTG9nZ2VyU2VydmljZSwgTG9nTGV2ZWxUb1N0cmluZyB9IGZyb20gJy4uLy4uL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IGRpcm5hbWUsIGpvaW4gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IENoaWxkUHJvY2VzcywgU3RkaW9PcHRpb25zLCBzcGF3biB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2gsIGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IENhbmNlbGFibGVQcm9taXNlLCBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSwgRGVsYXllciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IElTaGFyZWRQcm9jZXNzTGlmZWN5Y2xlU2VydmljZSB9IGZyb20gJy4uLy4uL2xpZmVjeWNsZS9ub2RlL3NoYXJlZFByb2Nlc3NMaWZlY3ljbGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgaG9zdG5hbWUsIGhvbWVkaXIgfSBmcm9tICdvcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgaXNTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBTdHJlYW1TcGxpdHRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2Uvbm9kZS9ub2RlU3RyZWFtcy5qcyc7XG5pbXBvcnQgeyBqb2luUGF0aCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5cbnR5cGUgUmVtb3RlVHVubmVsRW5hYmxlbWVudENsYXNzaWZpY2F0aW9uID0ge1xuXHRvd25lcjogJ2Flc2NobGknO1xuXHRjb21tZW50OiAnUmVwb3J0aW5nIHdoZW4gUmVtb3RlIFR1bm5lbCBhY2Nlc3MgaXMgdHVybmVkIG9uIG9yIG9mZic7XG5cdGVuYWJsZWQ/OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnRmxhZyBpbmRpY2F0aW5nIGlmIFJlbW90ZSBUdW5uZWwgQWNjZXNzIGlzIGVuYWJsZWQgb3Igbm90JyB9O1xuXHRzZXJ2aWNlPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ0ZsYWcgaW5kaWNhdGluZyBpZiBSZW1vdGUgVHVubmVsIEFjY2VzcyBpcyBpbnN0YWxsZWQgYXMgYSBzZXJ2aWNlJyB9O1xufTtcblxudHlwZSBSZW1vdGVUdW5uZWxFbmFibGVtZW50RXZlbnQgPSB7XG5cdGVuYWJsZWQ6IGJvb2xlYW47XG5cdHNlcnZpY2U6IGJvb2xlYW47XG59O1xuXG5jb25zdCByZXN0YXJ0VHVubmVsT25Db25maWd1cmF0aW9uQ2hhbmdlczogcmVhZG9ubHkgc3RyaW5nW10gPSBbXG5cdENPTkZJR1VSQVRJT05fS0VZX0hPU1RfTkFNRSxcblx0Q09ORklHVVJBVElPTl9LRVlfUFJFVkVOVF9TTEVFUCxcbl07XG5cbi8vIFRoaXMgaXMgdGhlIHNlc3Npb24gdXNlZCBydW4gdGhlIHR1bm5lbCBhY2Nlc3MuXG4vLyBpZiBzZXQsIHRoZSByZW1vdGUgdHVubmVsIGFjY2VzcyBpcyBjdXJyZW50bHkgZW5hYmxlZC5cbi8vIGlmIG5vdCBzZXQsIHRoZSByZW1vdGUgdHVubmVsIGFjY2VzcyBpcyBjdXJyZW50bHkgZGlzYWJsZWQuXG5jb25zdCBUVU5ORUxfQUNDRVNTX1NFU1NJT04gPSAncmVtb3RlVHVubmVsU2Vzc2lvbic7XG4vLyBCb29sZWFuIGluZGljYXRpbmcgd2hldGhlciB0aGUgdHVubmVsIHNob3VsZCBiZSBpbnN0YWxsZWQgYXMgYSBzZXJ2aWNlLlxuY29uc3QgVFVOTkVMX0FDQ0VTU19JU19TRVJWSUNFID0gJ3JlbW90ZVR1bm5lbElzU2VydmljZSc7XG5cbi8qKlxuICogVGhpcyBzZXJ2aWNlIHJ1bnMgb24gdGhlIHNoYXJlZCBzZXJ2aWNlLiBJdCBpcyBydW5uaW5nIHRoZSBgY29kZS10dW5uZWxgIGNvbW1hbmRcbiAqIHRvIG1ha2UgdGhlIGN1cnJlbnQgbWFjaGluZSBhdmFpbGFibGUgZm9yIHJlbW90ZSBhY2Nlc3MuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZW1vdGVUdW5uZWxTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElSZW1vdGVUdW5uZWxTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFRva2VuRmFpbGVkRW1pdHRlciA9IG5ldyBFbWl0dGVyPElSZW1vdGVUdW5uZWxTZXNzaW9uIHwgdW5kZWZpbmVkPigpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRUb2tlbkZhaWxlZCA9IHRoaXMuX29uRGlkVG9rZW5GYWlsZWRFbWl0dGVyLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlVHVubmVsU3RhdHVzRW1pdHRlciA9IG5ldyBFbWl0dGVyPFR1bm5lbFN0YXR1cz4oKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlVHVubmVsU3RhdHVzID0gdGhpcy5fb25EaWRDaGFuZ2VUdW5uZWxTdGF0dXNFbWl0dGVyLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlTW9kZUVtaXR0ZXIgPSBuZXcgRW1pdHRlcjxUdW5uZWxNb2RlPigpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VNb2RlID0gdGhpcy5fb25EaWRDaGFuZ2VNb2RlRW1pdHRlci5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9sb2dnZXI6IElMb2dnZXI7XG5cblx0LyoqXG5cdCAqIFwiTW9kZVwiIGluIHRoZSB0ZXJtaW5hbCBzdGF0ZSB3ZSB3YW50IHRvIGdldCB0byAtLSBzdGFydGVkLCBzdG9wcGVkLCBhbmRcblx0ICogdGhlIGF0dHJpYnV0ZXMgYXNzb2NpYXRlZCB3aXRoIGVhY2guXG5cdCAqXG5cdCAqIEF0IGFueSBnaXZlbiB0aW1lLCB3b3JrIG1heSBiZSBvbmdvaW5nIHRvIGdldCBgX3R1bm5lbFN0YXR1c2AgaW50byBhXG5cdCAqIHN0YXRlIHRoYXQgcmVmbGVjdHMgdGhlIGRlc2lyZWQgYG1vZGVgLlxuXHQgKi9cblx0cHJpdmF0ZSBfbW9kZTogVHVubmVsTW9kZSA9IElOQUNUSVZFX1RVTk5FTF9NT0RFO1xuXG5cdHByaXZhdGUgX3R1bm5lbFByb2Nlc3M6IENhbmNlbGFibGVQcm9taXNlPGFueT4gfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfdHVubmVsU3RhdHVzOiBUdW5uZWxTdGF0dXM7XG5cdHByaXZhdGUgX3N0YXJ0VHVubmVsUHJvY2Vzc0RlbGF5ZXI6IERlbGF5ZXI8dm9pZD47XG5cblx0cHJpdmF0ZSBfdHVubmVsQ29tbWFuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgX2luaXRpYWxpemVkID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElOYXRpdmVFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlbnZpcm9ubWVudFNlcnZpY2U6IElOYXRpdmVFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElMb2dnZXJTZXJ2aWNlIGxvZ2dlclNlcnZpY2U6IElMb2dnZXJTZXJ2aWNlLFxuXHRcdEBJU2hhcmVkUHJvY2Vzc0xpZmVjeWNsZVNlcnZpY2Ugc2hhcmVkUHJvY2Vzc0xpZmVjeWNsZVNlcnZpY2U6IElTaGFyZWRQcm9jZXNzTGlmZWN5Y2xlU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2xvZ2dlciA9IHRoaXMuX3JlZ2lzdGVyKGxvZ2dlclNlcnZpY2UuY3JlYXRlTG9nZ2VyKGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS5sb2dzSG9tZSwgYCR7TE9HX0lEfS5sb2dgKSwgeyBpZDogTE9HX0lELCBuYW1lOiBMT0dHRVJfTkFNRSB9KSk7XG5cdFx0dGhpcy5fc3RhcnRUdW5uZWxQcm9jZXNzRGVsYXllciA9IG5ldyBEZWxheWVyKDEwMCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9sb2dnZXIub25EaWRDaGFuZ2VMb2dMZXZlbChsID0+IHRoaXMuX2xvZ2dlci5pbmZvKCdMb2cgbGV2ZWwgY2hhbmdlZCB0byAnICsgTG9nTGV2ZWxUb1N0cmluZyhsKSkpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHNoYXJlZFByb2Nlc3NMaWZlY3ljbGVTZXJ2aWNlLm9uV2lsbFNodXRkb3duKCgpID0+IHtcblx0XHRcdHRoaXMuX3R1bm5lbFByb2Nlc3M/LmNhbmNlbCgpO1xuXHRcdFx0dGhpcy5fdHVubmVsUHJvY2VzcyA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuZGlzcG9zZSgpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChyZXN0YXJ0VHVubmVsT25Db25maWd1cmF0aW9uQ2hhbmdlcy5zb21lKGMgPT4gZS5hZmZlY3RzQ29uZmlndXJhdGlvbihjKSkpIHtcblx0XHRcdFx0dGhpcy5fc3RhcnRUdW5uZWxQcm9jZXNzRGVsYXllci50cmlnZ2VyKCgpID0+IHRoaXMudXBkYXRlVHVubmVsUHJvY2VzcygpKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9tb2RlID0gdGhpcy5fcmVzdG9yZU1vZGUoKTtcblx0XHR0aGlzLl90dW5uZWxTdGF0dXMgPSBUdW5uZWxTdGF0ZXMudW5pbml0aWFsaXplZDtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBnZXRUdW5uZWxTdGF0dXMoKTogUHJvbWlzZTxUdW5uZWxTdGF0dXM+IHtcblx0XHRyZXR1cm4gdGhpcy5fdHVubmVsU3RhdHVzO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRUdW5uZWxTdGF0dXModHVubmVsU3RhdHVzOiBUdW5uZWxTdGF0dXMpIHtcblx0XHR0aGlzLl90dW5uZWxTdGF0dXMgPSB0dW5uZWxTdGF0dXM7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VUdW5uZWxTdGF0dXNFbWl0dGVyLmZpcmUodHVubmVsU3RhdHVzKTtcblx0fVxuXG5cdHByaXZhdGUgc2V0TW9kZShtb2RlOiBUdW5uZWxNb2RlKSB7XG5cdFx0aWYgKGlzU2FtZU1vZGUodGhpcy5fbW9kZSwgbW9kZSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9tb2RlID0gbW9kZTtcblx0XHR0aGlzLl9zdG9yZU1vZGUobW9kZSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VNb2RlRW1pdHRlci5maXJlKHRoaXMuX21vZGUpO1xuXHRcdGlmIChtb2RlLmFjdGl2ZSkge1xuXHRcdFx0dGhpcy5fbG9nZ2VyLmluZm8oYFNlc3Npb24gdXBkYXRlZDogJHttb2RlLnNlc3Npb24uYWNjb3VudExhYmVsfSAoJHttb2RlLnNlc3Npb24ucHJvdmlkZXJJZH0pIChzZXJ2aWNlPSR7bW9kZS5hc1NlcnZpY2V9KWApO1xuXHRcdFx0aWYgKG1vZGUuc2Vzc2lvbi50b2tlbikge1xuXHRcdFx0XHR0aGlzLl9sb2dnZXIuaW5mbyhgU2Vzc2lvbiB0b2tlbiB1cGRhdGVkOiAke21vZGUuc2Vzc2lvbi5hY2NvdW50TGFiZWx9ICgke21vZGUuc2Vzc2lvbi5wcm92aWRlcklkfSlgKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fbG9nZ2VyLmluZm8oYFNlc3Npb24gcmVzZXRgKTtcblx0XHR9XG5cdH1cblxuXHRnZXRNb2RlKCk6IFByb21pc2U8VHVubmVsTW9kZT4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5fbW9kZSk7XG5cdH1cblxuXHRhc3luYyBpbml0aWFsaXplKG1vZGU6IFR1bm5lbE1vZGUpOiBQcm9taXNlPFR1bm5lbFN0YXR1cz4ge1xuXHRcdGlmICh0aGlzLl9pbml0aWFsaXplZCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3R1bm5lbFN0YXR1cztcblx0XHR9XG5cdFx0dGhpcy5faW5pdGlhbGl6ZWQgPSB0cnVlO1xuXHRcdHRoaXMuc2V0TW9kZShtb2RlKTtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5fc3RhcnRUdW5uZWxQcm9jZXNzRGVsYXllci50cmlnZ2VyKCgpID0+IHRoaXMudXBkYXRlVHVubmVsUHJvY2VzcygpKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLl9sb2dnZXIuZXJyb3IoZSk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl90dW5uZWxTdGF0dXM7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IGRlZmF1bHRPbk91dHB1dCA9IChhOiBzdHJpbmcsIGlzRXJyOiBib29sZWFuKSA9PiB7XG5cdFx0aWYgKGlzRXJyKSB7XG5cdFx0XHR0aGlzLl9sb2dnZXIuZXJyb3IoYSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2xvZ2dlci5pbmZvKGEpO1xuXHRcdH1cblx0fTtcblxuXHRwcml2YXRlIGdldFR1bm5lbENvbW1hbmRMb2NhdGlvbigpIHtcblx0XHRpZiAoIXRoaXMuX3R1bm5lbENvbW1hbmQpIHtcblx0XHRcdGxldCBiaW5QYXJlbnRMb2NhdGlvbjtcblx0XHRcdGlmIChpc01hY2ludG9zaCkge1xuXHRcdFx0XHQvLyBhcHBSb290ID0gL0FwcGxpY2F0aW9ucy9WaXN1YWwgU3R1ZGlvIENvZGUgLSBJbnNpZGVycy5hcHAvQ29udGVudHMvUmVzb3VyY2VzL2FwcFxuXHRcdFx0XHQvLyBiaW4gPSAvQXBwbGljYXRpb25zL1Zpc3VhbCBTdHVkaW8gQ29kZSAtIEluc2lkZXJzLmFwcC9Db250ZW50cy9SZXNvdXJjZXMvYXBwL2JpblxuXHRcdFx0XHRiaW5QYXJlbnRMb2NhdGlvbiA9IHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLmFwcFJvb3Q7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBhcHBSb290ID0gQzpcXFVzZXJzXFw8bmFtZT5cXEFwcERhdGFcXExvY2FsXFxQcm9ncmFtc1xcTWljcm9zb2Z0IFZTIENvZGUgSW5zaWRlcnNcXHJlc291cmNlc1xcYXBwXG5cdFx0XHRcdC8vIGJpbiA9IEM6XFxVc2Vyc1xcPG5hbWU+XFxBcHBEYXRhXFxMb2NhbFxcUHJvZ3JhbXNcXE1pY3Jvc29mdCBWUyBDb2RlIEluc2lkZXJzXFxiaW5cblx0XHRcdFx0Ly8gYXBwUm9vdCA9IC91c3Ivc2hhcmUvY29kZS1pbnNpZGVycy9yZXNvdXJjZXMvYXBwXG5cdFx0XHRcdC8vIGJpbiA9IC91c3Ivc2hhcmUvY29kZS1pbnNpZGVycy9iaW5cblx0XHRcdFx0YmluUGFyZW50TG9jYXRpb24gPSBkaXJuYW1lKGRpcm5hbWUodGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuYXBwUm9vdCkpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fdHVubmVsQ29tbWFuZCA9IGpvaW4oYmluUGFyZW50TG9jYXRpb24sICdiaW4nLCBgJHt0aGlzLnByb2R1Y3RTZXJ2aWNlLnR1bm5lbEFwcGxpY2F0aW9uTmFtZX0ke2lzV2luZG93cyA/ICcuZXhlJyA6ICcnfWApO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fdHVubmVsQ29tbWFuZDtcblx0fVxuXG5cdGFzeW5jIHN0YXJ0VHVubmVsKG1vZGU6IEFjdGl2ZVR1bm5lbE1vZGUpOiBQcm9taXNlPFR1bm5lbFN0YXR1cz4ge1xuXHRcdGlmIChpc1NhbWVNb2RlKHRoaXMuX21vZGUsIG1vZGUpICYmIHRoaXMuX3R1bm5lbFN0YXR1cy50eXBlICE9PSAnZGlzY29ubmVjdGVkJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3R1bm5lbFN0YXR1cztcblx0XHR9XG5cblx0XHR0aGlzLnNldE1vZGUobW9kZSk7XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5fc3RhcnRUdW5uZWxQcm9jZXNzRGVsYXllci50cmlnZ2VyKCgpID0+IHRoaXMudXBkYXRlVHVubmVsUHJvY2VzcygpKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLl9sb2dnZXIuZXJyb3IoZSk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl90dW5uZWxTdGF0dXM7XG5cdH1cblxuXG5cdGFzeW5jIHN0b3BUdW5uZWwoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuX3R1bm5lbFByb2Nlc3MpIHtcblx0XHRcdHRoaXMuX3R1bm5lbFByb2Nlc3MuY2FuY2VsKCk7XG5cdFx0XHR0aGlzLl90dW5uZWxQcm9jZXNzID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9tb2RlLmFjdGl2ZSkge1xuXHRcdFx0Ly8gQmUgY2FyZWZ1bCB0byBvbmx5IHVuaW5zdGFsbCB0aGUgc2VydmljZSBpZiB3ZSdyZSB0aGUgb25lcyB3aG8gaW5zdGFsbGVkIGl0OlxuXHRcdFx0Y29uc3QgbmVlZHNTZXJ2aWNlVW5pbnN0YWxsID0gdGhpcy5fbW9kZS5hc1NlcnZpY2U7XG5cdFx0XHR0aGlzLnNldE1vZGUoSU5BQ1RJVkVfVFVOTkVMX01PREUpO1xuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRpZiAobmVlZHNTZXJ2aWNlVW5pbnN0YWxsKSB7XG5cdFx0XHRcdFx0dGhpcy5ydW5Db2RlVHVubmVsQ29tbWFuZCgndW5pbnN0YWxsU2VydmljZScsIFsnc2VydmljZScsICd1bmluc3RhbGwnXSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0dGhpcy5fbG9nZ2VyLmVycm9yKGUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLnJ1bkNvZGVUdW5uZWxDb21tYW5kKCdzdG9wJywgWydraWxsJ10pO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMuX2xvZ2dlci5lcnJvcihlKTtcblx0XHR9XG5cblx0XHR0aGlzLnNldFR1bm5lbFN0YXR1cyhUdW5uZWxTdGF0ZXMuZGlzY29ubmVjdGVkKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVUdW5uZWxQcm9jZXNzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFJlbW90ZVR1bm5lbEVuYWJsZW1lbnRFdmVudCwgUmVtb3RlVHVubmVsRW5hYmxlbWVudENsYXNzaWZpY2F0aW9uPigncmVtb3RlVHVubmVsLmVuYWJsZW1lbnQnLCB7XG5cdFx0XHRlbmFibGVkOiB0aGlzLl9tb2RlLmFjdGl2ZSxcblx0XHRcdHNlcnZpY2U6IHRoaXMuX21vZGUuYWN0aXZlICYmIHRoaXMuX21vZGUuYXNTZXJ2aWNlLFxuXHRcdH0pO1xuXG5cdFx0aWYgKHRoaXMuX3R1bm5lbFByb2Nlc3MpIHtcblx0XHRcdHRoaXMuX3R1bm5lbFByb2Nlc3MuY2FuY2VsKCk7XG5cdFx0XHR0aGlzLl90dW5uZWxQcm9jZXNzID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGxldCBvdXRwdXQgPSAnJztcblx0XHRsZXQgaXNTZXJ2aWNlSW5zdGFsbGVkID0gZmFsc2U7XG5cdFx0Y29uc3Qgb25PdXRwdXQgPSAoYTogc3RyaW5nLCBpc0VycjogYm9vbGVhbikgPT4ge1xuXHRcdFx0aWYgKGlzRXJyKSB7XG5cdFx0XHRcdHRoaXMuX2xvZ2dlci5lcnJvcihhKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG91dHB1dCArPSBhO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCF0aGlzLmVudmlyb25tZW50U2VydmljZS5pc0J1aWx0ICYmIGEuc3RhcnRzV2l0aCgnICAgQ29tcGlsaW5nJykpIHtcblx0XHRcdFx0dGhpcy5zZXRUdW5uZWxTdGF0dXMoVHVubmVsU3RhdGVzLmNvbm5lY3RpbmcobG9jYWxpemUoJ3JlbW90ZVR1bm5lbFNlcnZpY2UuYnVpbGRpbmcnLCAnQnVpbGRpbmcgQ0xJIGZyb20gc291cmNlcycpKSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IHN0YXR1c1Byb2Nlc3MgPSB0aGlzLnJ1bkNvZGVUdW5uZWxDb21tYW5kKCdzdGF0dXMnLCBbJ3N0YXR1cyddLCBvbk91dHB1dCk7XG5cdFx0dGhpcy5fdHVubmVsUHJvY2VzcyA9IHN0YXR1c1Byb2Nlc3M7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHN0YXR1c1Byb2Nlc3M7XG5cdFx0XHRpZiAodGhpcy5fdHVubmVsUHJvY2VzcyAhPT0gc3RhdHVzUHJvY2Vzcykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIHNwbGl0IGFuZCBmaW5kIHRoZSBsaW5lLCBzaW5jZSBpbiBkZXYgYnVpbGRzIGFkZGl0aW9uYWwgbm9pc2UgaXNcblx0XHRcdC8vIGFkZGVkIGJ5IGNhcmdvIHRvIHRoZSBvdXRwdXQuXG5cdFx0XHRsZXQgc3RhdHVzOiB7XG5cdFx0XHRcdHNlcnZpY2VfaW5zdGFsbGVkOiBib29sZWFuO1xuXHRcdFx0XHR0dW5uZWw6IG9iamVjdCB8IG51bGw7XG5cdFx0XHR9O1xuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRzdGF0dXMgPSBKU09OLnBhcnNlKG91dHB1dC50cmltKCkuc3BsaXQoJ1xcbicpLmZpbmQobCA9PiBsLnN0YXJ0c1dpdGgoJ3snKSkhKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0dGhpcy5fbG9nZ2VyLmVycm9yKGBDb3VsZCBub3QgcGFyc2Ugc3RhdHVzIG91dHB1dDogJHtKU09OLnN0cmluZ2lmeShvdXRwdXQudHJpbSgpKX1gKTtcblx0XHRcdFx0dGhpcy5zZXRUdW5uZWxTdGF0dXMoVHVubmVsU3RhdGVzLmRpc2Nvbm5lY3RlZCgpKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpc1NlcnZpY2VJbnN0YWxsZWQgPSBzdGF0dXMuc2VydmljZV9pbnN0YWxsZWQ7XG5cdFx0XHR0aGlzLl9sb2dnZXIuaW5mbyhzdGF0dXMudHVubmVsID8gJ090aGVyIHR1bm5lbCBydW5uaW5nLCBhdHRhY2hpbmcuLi4nIDogJ05vIG90aGVyIHR1bm5lbCBydW5uaW5nJyk7XG5cblx0XHRcdC8vIElmIGEgdHVubmVsIGlzIHJ1bm5pbmcgYnV0IHRoZSBtb2RlIGlzbid0IFwiYWN0aXZlXCIsIHdlJ2xsIHN0aWxsIGF0dGFjaFxuXHRcdFx0Ly8gdG8gdGhlIHR1bm5lbCB0byBzaG93IGl0cyBzdGF0ZSBpbiB0aGUgVUkuIElmIG5laXRoZXIgYXJlIHRydWUsIGRpc2Nvbm5lY3Rcblx0XHRcdGlmICghc3RhdHVzLnR1bm5lbCAmJiAhdGhpcy5fbW9kZS5hY3RpdmUpIHtcblx0XHRcdFx0dGhpcy5zZXRUdW5uZWxTdGF0dXMoVHVubmVsU3RhdGVzLmRpc2Nvbm5lY3RlZCgpKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMuX2xvZ2dlci5lcnJvcihlKTtcblx0XHRcdHRoaXMuc2V0VHVubmVsU3RhdHVzKFR1bm5lbFN0YXRlcy5kaXNjb25uZWN0ZWQoKSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGlmICh0aGlzLl90dW5uZWxQcm9jZXNzID09PSBzdGF0dXNQcm9jZXNzKSB7XG5cdFx0XHRcdHRoaXMuX3R1bm5lbFByb2Nlc3MgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMuX21vZGUuYWN0aXZlID8gdGhpcy5fbW9kZS5zZXNzaW9uIDogdW5kZWZpbmVkO1xuXHRcdGlmIChzZXNzaW9uICYmIHNlc3Npb24udG9rZW4pIHtcblx0XHRcdGNvbnN0IHRva2VuID0gc2Vzc2lvbi50b2tlbjtcblx0XHRcdHRoaXMuc2V0VHVubmVsU3RhdHVzKFR1bm5lbFN0YXRlcy5jb25uZWN0aW5nKGxvY2FsaXplKHsga2V5OiAncmVtb3RlVHVubmVsU2VydmljZS5hdXRob3JpemluZycsIGNvbW1lbnQ6IFsnezB9IGlzIGEgdXNlciBhY2NvdW50IG5hbWUsIHsxfSBhIHByb3ZpZGVyIG5hbWUgKGUuZy4gR2l0aHViKSddIH0sICdDb25uZWN0aW5nIGFzIHswfSAoezF9KScsIHNlc3Npb24uYWNjb3VudExhYmVsLCBzZXNzaW9uLnByb3ZpZGVySWQpKSk7XG5cdFx0XHRjb25zdCBvbkxvZ2luT3V0cHV0ID0gKGE6IHN0cmluZywgaXNFcnI6IGJvb2xlYW4pID0+IHtcblx0XHRcdFx0YSA9IGEucmVwbGFjZUFsbCh0b2tlbiwgJyonLnJlcGVhdCg0KSk7XG5cdFx0XHRcdG9uT3V0cHV0KGEsIGlzRXJyKTtcblx0XHRcdH07XG5cdFx0XHRjb25zdCBsb2dpblByb2Nlc3MgPSB0aGlzLnJ1bkNvZGVUdW5uZWxDb21tYW5kKCdsb2dpbicsIFsndXNlcicsICdsb2dpbicsICctLXByb3ZpZGVyJywgc2Vzc2lvbi5wcm92aWRlcklkLCAnLS1sb2cnLCBMb2dMZXZlbFRvU3RyaW5nKHRoaXMuX2xvZ2dlci5nZXRMZXZlbCgpKV0sIG9uTG9naW5PdXRwdXQsIHsgVlNDT0RFX0NMSV9BQ0NFU1NfVE9LRU46IHRva2VuIH0pO1xuXHRcdFx0dGhpcy5fdHVubmVsUHJvY2VzcyA9IGxvZ2luUHJvY2Vzcztcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IGxvZ2luUHJvY2Vzcztcblx0XHRcdFx0aWYgKHRoaXMuX3R1bm5lbFByb2Nlc3MgIT09IGxvZ2luUHJvY2Vzcykge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHR0aGlzLl9sb2dnZXIuZXJyb3IoZSk7XG5cdFx0XHRcdHRoaXMuX3R1bm5lbFByb2Nlc3MgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMuX29uRGlkVG9rZW5GYWlsZWRFbWl0dGVyLmZpcmUoc2Vzc2lvbik7XG5cdFx0XHRcdHRoaXMuc2V0VHVubmVsU3RhdHVzKFR1bm5lbFN0YXRlcy5kaXNjb25uZWN0ZWQoc2Vzc2lvbikpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgaG9zdE5hbWUgPSB0aGlzLl9nZXRUdW5uZWxOYW1lKCk7XG5cdFx0aWYgKGhvc3ROYW1lKSB7XG5cdFx0XHR0aGlzLnNldFR1bm5lbFN0YXR1cyhUdW5uZWxTdGF0ZXMuY29ubmVjdGluZyhsb2NhbGl6ZSh7IGtleTogJ3JlbW90ZVR1bm5lbFNlcnZpY2Uub3BlblR1bm5lbFdpdGhOYW1lJywgY29tbWVudDogWyd7MH0gaXMgYSB0dW5uZWwgbmFtZSddIH0sICdPcGVuaW5nIHR1bm5lbCB7MH0nLCBob3N0TmFtZSkpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zZXRUdW5uZWxTdGF0dXMoVHVubmVsU3RhdGVzLmNvbm5lY3RpbmcobG9jYWxpemUoJ3JlbW90ZVR1bm5lbFNlcnZpY2Uub3BlblR1bm5lbCcsICdPcGVuaW5nIHR1bm5lbCcpKSk7XG5cdFx0fVxuXHRcdGNvbnN0IGFyZ3MgPSBbJy0tYWNjZXB0LXNlcnZlci1saWNlbnNlLXRlcm1zJywgJy0tbG9nJywgTG9nTGV2ZWxUb1N0cmluZyh0aGlzLl9sb2dnZXIuZ2V0TGV2ZWwoKSldO1xuXHRcdGlmIChob3N0TmFtZSkge1xuXHRcdFx0YXJncy5wdXNoKCctLW5hbWUnLCBob3N0TmFtZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFyZ3MucHVzaCgnLS1yYW5kb20tbmFtZScpO1xuXHRcdH1cblxuXHRcdGxldCBzZXJ2aWNlSW5zdGFsbEZhaWxlZCA9IGZhbHNlO1xuXHRcdGlmICh0aGlzLl9tb2RlLmFjdGl2ZSAmJiB0aGlzLl9tb2RlLmFzU2VydmljZSAmJiAhaXNTZXJ2aWNlSW5zdGFsbGVkKSB7XG5cdFx0XHQvLyBJIHRob3VnaHQgYWJvdXQgY2FsbGluZyBgY29kZSB0dW5uZWwga2lsbGAgaGVyZSwgYnV0IGhhdmluZyBtdWx0aXBsZVxuXHRcdFx0Ly8gdHVubmVsIHByb2Nlc3NlcyBydW5uaW5nIGlzIHByZXR0eSBtdWNoIGlkZW1wb3RlbnQuIElmIHRoZXJlJ3Ncblx0XHRcdC8vIGFub3RoZXIgdHVubmVsIHByb2Nlc3MgcnVubmluZywgdGhlIHNlcnZpY2UgcHJvY2VzcyB3aWxsXG5cdFx0XHQvLyB0YWtlIG92ZXIgd2hlbiBpdCBleGl0cywgbm8gaGFyZCBmZWVsaW5ncy5cblx0XHRcdHNlcnZpY2VJbnN0YWxsRmFpbGVkID0gYXdhaXQgdGhpcy5pbnN0YWxsVHVubmVsU2VydmljZShhcmdzKSA9PT0gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuc2VydmVyT3JBdHRhY2hUdW5uZWwoc2Vzc2lvbiwgYXJncywgc2VydmljZUluc3RhbGxGYWlsZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBpbnN0YWxsVHVubmVsU2VydmljZShhcmdzOiByZWFkb25seSBzdHJpbmdbXSkge1xuXHRcdGxldCBzdGF0dXM6IG51bWJlcjtcblx0XHR0cnkge1xuXHRcdFx0c3RhdHVzID0gYXdhaXQgdGhpcy5ydW5Db2RlVHVubmVsQ29tbWFuZCgnc2VydmljZUluc3RhbGwnLCBbJ3NlcnZpY2UnLCAnaW5zdGFsbCcsIC4uLmFyZ3NdKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLl9sb2dnZXIuZXJyb3IoZSk7XG5cdFx0XHRzdGF0dXMgPSAxO1xuXHRcdH1cblxuXHRcdGlmIChzdGF0dXMgIT09IDApIHtcblx0XHRcdGNvbnN0IG1zZyA9IGxvY2FsaXplKCdyZW1vdGVUdW5uZWxTZXJ2aWNlLnNlcnZpY2VJbnN0YWxsRmFpbGVkJywgJ0ZhaWxlZCB0byBpbnN0YWxsIHR1bm5lbCBhcyBhIHNlcnZpY2UsIHN0YXJ0aW5nIGluIHNlc3Npb24uLi4nKTtcblx0XHRcdHRoaXMuX2xvZ2dlci53YXJuKG1zZyk7XG5cdFx0XHR0aGlzLnNldFR1bm5lbFN0YXR1cyhUdW5uZWxTdGF0ZXMuY29ubmVjdGluZyhtc2cpKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2VydmVyT3JBdHRhY2hUdW5uZWwoc2Vzc2lvbjogSVJlbW90ZVR1bm5lbFNlc3Npb24gfCB1bmRlZmluZWQsIGFyZ3M6IHN0cmluZ1tdLCBzZXJ2aWNlSW5zdGFsbEZhaWxlZDogYm9vbGVhbikge1xuXHRcdGFyZ3MucHVzaCgnLS1wYXJlbnQtcHJvY2Vzcy1pZCcsIFN0cmluZyhwcm9jZXNzLnBpZCkpO1xuXG5cdFx0aWYgKHRoaXMuX3ByZXZlbnRTbGVlcCgpKSB7XG5cdFx0XHRhcmdzLnB1c2goJy0tbm8tc2xlZXAnKTtcblx0XHR9XG5cblx0XHRsZXQgaXNBdHRhY2hlZCA9IGZhbHNlO1xuXHRcdGNvbnN0IHNlcnZlQ29tbWFuZCA9IHRoaXMucnVuQ29kZVR1bm5lbENvbW1hbmQoJ3R1bm5lbCcsIGFyZ3MsIChtZXNzYWdlOiBzdHJpbmcsIGlzRXJyOiBib29sZWFuKSA9PiB7XG5cdFx0XHRpZiAoaXNFcnIpIHtcblx0XHRcdFx0dGhpcy5fbG9nZ2VyLmVycm9yKG1lc3NhZ2UpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fbG9nZ2VyLmluZm8obWVzc2FnZSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChtZXNzYWdlLmluY2x1ZGVzKCdDb25uZWN0ZWQgdG8gYW4gZXhpc3RpbmcgdHVubmVsIHByb2Nlc3MnKSkge1xuXHRcdFx0XHRpc0F0dGFjaGVkID0gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbSA9IG1lc3NhZ2UubWF0Y2goL09wZW4gdGhpcyBsaW5rIGluIHlvdXIgYnJvd3NlciAoaHR0cHM6XFwvXFwvKFteXFwvXFxzXSspXFwvKFteXFwvXFxzXSspXFwvKFteXFwvXFxzXSspKS8pO1xuXHRcdFx0aWYgKG0pIHtcblx0XHRcdFx0Y29uc3QgaW5mbzogQ29ubmVjdGlvbkluZm8gPSB7IGxpbms6IG1bMV0sIGRvbWFpbjogbVsyXSwgdHVubmVsTmFtZTogbVs0XSwgaXNBdHRhY2hlZCB9O1xuXHRcdFx0XHR0aGlzLnNldFR1bm5lbFN0YXR1cyhUdW5uZWxTdGF0ZXMuY29ubmVjdGVkKGluZm8sIHNlcnZpY2VJbnN0YWxsRmFpbGVkKSk7XG5cdFx0XHR9IGVsc2UgaWYgKG1lc3NhZ2UubWF0Y2goL2Vycm9yIHJlZnJlc2hpbmcgdG9rZW4vKSkge1xuXHRcdFx0XHRzZXJ2ZUNvbW1hbmQuY2FuY2VsKCk7XG5cdFx0XHRcdHRoaXMuX29uRGlkVG9rZW5GYWlsZWRFbWl0dGVyLmZpcmUoc2Vzc2lvbik7XG5cdFx0XHRcdHRoaXMuc2V0VHVubmVsU3RhdHVzKFR1bm5lbFN0YXRlcy5kaXNjb25uZWN0ZWQoc2Vzc2lvbikpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuX3R1bm5lbFByb2Nlc3MgPSBzZXJ2ZUNvbW1hbmQ7XG5cdFx0c2VydmVDb21tYW5kLmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0aWYgKHNlcnZlQ29tbWFuZCA9PT0gdGhpcy5fdHVubmVsUHJvY2Vzcykge1xuXHRcdFx0XHQvLyBwcm9jZXNzIGV4aXRlZCB1bmV4cGVjdGVkbHlcblx0XHRcdFx0dGhpcy5fbG9nZ2VyLmluZm8oYHR1bm5lbCBwcm9jZXNzIHRlcm1pbmF0ZWRgKTtcblx0XHRcdFx0dGhpcy5fdHVubmVsUHJvY2VzcyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0dGhpcy5fbW9kZSA9IElOQUNUSVZFX1RVTk5FTF9NT0RFO1xuXG5cdFx0XHRcdHRoaXMuc2V0VHVubmVsU3RhdHVzKFR1bm5lbFN0YXRlcy5kaXNjb25uZWN0ZWQoKSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJ1bkNvZGVUdW5uZWxDb21tYW5kKGxvZ0xhYmVsOiBzdHJpbmcsIGNvbW1hbmRBcmdzOiBzdHJpbmdbXSwgb25PdXRwdXQ6IChtZXNzYWdlOiBzdHJpbmcsIGlzRXJyb3I6IGJvb2xlYW4pID0+IHZvaWQgPSB0aGlzLmRlZmF1bHRPbk91dHB1dCwgZW52PzogUmVjb3JkPHN0cmluZywgc3RyaW5nPik6IENhbmNlbGFibGVQcm9taXNlPG51bWJlcj4ge1xuXHRcdHJldHVybiBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZTxudW1iZXI+KHRva2VuID0+IHtcblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdHJlc29sdmUoLTEpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxldCB0dW5uZWxQcm9jZXNzOiBDaGlsZFByb2Nlc3MgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdGNvbnN0IHN0ZGlvOiBTdGRpb09wdGlvbnMgPSBbJ2lnbm9yZScsICdwaXBlJywgJ3BpcGUnXTtcblxuXHRcdFx0XHR0b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHR1bm5lbFByb2Nlc3MpIHtcblx0XHRcdFx0XHRcdHRoaXMuX2xvZ2dlci5pbmZvKGAke2xvZ0xhYmVsfSB0ZXJtaW5hdGluZygke3R1bm5lbFByb2Nlc3MucGlkfSlgKTtcblx0XHRcdFx0XHRcdHR1bm5lbFByb2Nlc3Mua2lsbCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdGlmICghdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuaXNCdWlsdCkge1xuXHRcdFx0XHRcdG9uT3V0cHV0KCdCdWlsZGluZyB0dW5uZWwgQ0xJIGZyb20gc291cmNlcyBhbmQgcnVuXFxuJywgZmFsc2UpO1xuXHRcdFx0XHRcdG9uT3V0cHV0KGAke2xvZ0xhYmVsfSBTcGF3bmluZzogY2FyZ28gcnVuIC0tIHR1bm5lbCAke2NvbW1hbmRBcmdzLmpvaW4oJyAnKX1cXG5gLCBmYWxzZSk7XG5cdFx0XHRcdFx0dHVubmVsUHJvY2VzcyA9IHNwYXduKCdjYXJnbycsIFsncnVuJywgJy0tJywgJ3R1bm5lbCcsIC4uLmNvbW1hbmRBcmdzXSwgeyBjd2Q6IGpvaW4odGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuYXBwUm9vdCwgJ2NsaScpLCBzdGRpbywgZW52OiB7IC4uLnByb2Nlc3MuZW52LCBSVVNUX0JBQ0tUUkFDRTogJzEnLCAuLi5lbnYgfSB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRvbk91dHB1dCgnUnVubmluZyB0dW5uZWwgQ0xJXFxuJywgZmFsc2UpO1xuXHRcdFx0XHRcdGNvbnN0IHR1bm5lbENvbW1hbmQgPSB0aGlzLmdldFR1bm5lbENvbW1hbmRMb2NhdGlvbigpO1xuXHRcdFx0XHRcdG9uT3V0cHV0KGAke2xvZ0xhYmVsfSBTcGF3bmluZzogJHt0dW5uZWxDb21tYW5kfSB0dW5uZWwgJHtjb21tYW5kQXJncy5qb2luKCcgJyl9XFxuYCwgZmFsc2UpO1xuXHRcdFx0XHRcdHR1bm5lbFByb2Nlc3MgPSBzcGF3bih0dW5uZWxDb21tYW5kLCBbJ3R1bm5lbCcsIC4uLmNvbW1hbmRBcmdzXSwgeyBjd2Q6IGhvbWVkaXIoKSwgc3RkaW8sIGVudjogeyAuLi5wcm9jZXNzLmVudiwgLi4uZW52IH0gfSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0dW5uZWxQcm9jZXNzLnN0ZG91dCEucGlwZShuZXcgU3RyZWFtU3BsaXR0ZXIoJ1xcbicpKS5vbignZGF0YScsIGRhdGEgPT4ge1xuXHRcdFx0XHRcdGlmICh0dW5uZWxQcm9jZXNzKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBtZXNzYWdlID0gZGF0YS50b1N0cmluZygpO1xuXHRcdFx0XHRcdFx0b25PdXRwdXQobWVzc2FnZSwgZmFsc2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdHR1bm5lbFByb2Nlc3Muc3RkZXJyIS5waXBlKG5ldyBTdHJlYW1TcGxpdHRlcignXFxuJykpLm9uKCdkYXRhJywgZGF0YSA9PiB7XG5cdFx0XHRcdFx0aWYgKHR1bm5lbFByb2Nlc3MpIHtcblx0XHRcdFx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBkYXRhLnRvU3RyaW5nKCk7XG5cdFx0XHRcdFx0XHRvbk91dHB1dChtZXNzYWdlLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0dW5uZWxQcm9jZXNzLm9uKCdleGl0JywgZSA9PiB7XG5cdFx0XHRcdFx0aWYgKHR1bm5lbFByb2Nlc3MpIHtcblx0XHRcdFx0XHRcdG9uT3V0cHV0KGAke2xvZ0xhYmVsfSBleGl0KCR7dHVubmVsUHJvY2Vzcy5waWR9KTogKyAke2V9IGAsIGZhbHNlKTtcblx0XHRcdFx0XHRcdHR1bm5lbFByb2Nlc3MgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRyZXNvbHZlKGUgfHwgMCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0dHVubmVsUHJvY2Vzcy5vbignZXJyb3InLCBlID0+IHtcblx0XHRcdFx0XHRpZiAodHVubmVsUHJvY2Vzcykge1xuXHRcdFx0XHRcdFx0b25PdXRwdXQoYCR7bG9nTGFiZWx9IGVycm9yKCR7dHVubmVsUHJvY2Vzcy5waWR9KTogKyAke2V9IGAsIHRydWUpO1xuXHRcdFx0XHRcdFx0dHVubmVsUHJvY2VzcyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdHJlamVjdCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBnZXRUdW5uZWxOYW1lKCk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2dldFR1bm5lbE5hbWUoKTtcblx0fVxuXG5cdHByaXZhdGUgX3ByZXZlbnRTbGVlcCgpIHtcblx0XHRyZXR1cm4gISF0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KENPTkZJR1VSQVRJT05fS0VZX1BSRVZFTlRfU0xFRVApO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0VHVubmVsTmFtZSgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGxldCBuYW1lID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxzdHJpbmc+KENPTkZJR1VSQVRJT05fS0VZX0hPU1RfTkFNRSkgfHwgaG9zdG5hbWUoKTtcblx0XHRuYW1lID0gbmFtZS5yZXBsYWNlKC9eLSsvZywgJycpLnJlcGxhY2UoL1teXFx3LV0vZywgJycpLnN1YnN0cmluZygwLCAyMCk7XG5cdFx0cmV0dXJuIG5hbWUgfHwgdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVzdG9yZU1vZGUoKTogVHVubmVsTW9kZSB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHR1bm5lbEFjY2Vzc1Nlc3Npb24gPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChUVU5ORUxfQUNDRVNTX1NFU1NJT04sIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdFx0XHRjb25zdCBhc1NlcnZpY2UgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldEJvb2xlYW4oVFVOTkVMX0FDQ0VTU19JU19TRVJWSUNFLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIGZhbHNlKTtcblx0XHRcdGlmICh0dW5uZWxBY2Nlc3NTZXNzaW9uKSB7XG5cdFx0XHRcdGNvbnN0IHNlc3Npb24gPSBKU09OLnBhcnNlKHR1bm5lbEFjY2Vzc1Nlc3Npb24pIGFzIElSZW1vdGVUdW5uZWxTZXNzaW9uO1xuXHRcdFx0XHRpZiAoc2Vzc2lvbiAmJiBpc1N0cmluZyhzZXNzaW9uLmFjY291bnRMYWJlbCkgJiYgaXNTdHJpbmcoc2Vzc2lvbi5zZXNzaW9uSWQpICYmIGlzU3RyaW5nKHNlc3Npb24ucHJvdmlkZXJJZCkpIHtcblx0XHRcdFx0XHRyZXR1cm4geyBhY3RpdmU6IHRydWUsIHNlc3Npb24sIGFzU2VydmljZSB9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX2xvZ2dlci5lcnJvcignUHJvYmxlbXMgcmVzdG9yaW5nIHNlc3Npb24gZnJvbSBzdG9yYWdlLCBpbnZhbGlkIGZvcm1hdCcsIHNlc3Npb24pO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMuX2xvZ2dlci5lcnJvcignUHJvYmxlbXMgcmVzdG9yaW5nIHNlc3Npb24gZnJvbSBzdG9yYWdlJywgZSk7XG5cdFx0fVxuXHRcdHJldHVybiBJTkFDVElWRV9UVU5ORUxfTU9ERTtcblx0fVxuXG5cdHByaXZhdGUgX3N0b3JlTW9kZShtb2RlOiBUdW5uZWxNb2RlKTogdm9pZCB7XG5cdFx0aWYgKG1vZGUuYWN0aXZlKSB7XG5cdFx0XHRjb25zdCBzZXNzaW9uV2l0aG91dFRva2VuID0ge1xuXHRcdFx0XHRwcm92aWRlcklkOiBtb2RlLnNlc3Npb24ucHJvdmlkZXJJZCwgc2Vzc2lvbklkOiBtb2RlLnNlc3Npb24uc2Vzc2lvbklkLCBhY2NvdW50TGFiZWw6IG1vZGUuc2Vzc2lvbi5hY2NvdW50TGFiZWxcblx0XHRcdH07XG5cdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKFRVTk5FTF9BQ0NFU1NfU0VTU0lPTiwgSlNPTi5zdHJpbmdpZnkoc2Vzc2lvbldpdGhvdXRUb2tlbiksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoVFVOTkVMX0FDQ0VTU19JU19TRVJWSUNFLCBtb2RlLmFzU2VydmljZSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShUVU5ORUxfQUNDRVNTX1NFU1NJT04sIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShUVU5ORUxfQUNDRVNTX0lTX1NFUlZJQ0UsIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIGlzU2FtZVNlc3Npb24oYTE6IElSZW1vdGVUdW5uZWxTZXNzaW9uIHwgdW5kZWZpbmVkLCBhMjogSVJlbW90ZVR1bm5lbFNlc3Npb24gfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0aWYgKGExICYmIGEyKSB7XG5cdFx0cmV0dXJuIGExLnNlc3Npb25JZCA9PT0gYTIuc2Vzc2lvbklkICYmIGExLnByb3ZpZGVySWQgPT09IGEyLnByb3ZpZGVySWQgJiYgYTEudG9rZW4gPT09IGEyLnRva2VuO1xuXHR9XG5cdHJldHVybiBhMSA9PT0gYTI7XG59XG5cbmNvbnN0IGlzU2FtZU1vZGUgPSAoYTogVHVubmVsTW9kZSwgYjogVHVubmVsTW9kZSkgPT4ge1xuXHRpZiAoYS5hY3RpdmUgIT09IGIuYWN0aXZlKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9IGVsc2UgaWYgKGEuYWN0aXZlICYmIGIuYWN0aXZlKSB7XG5cdFx0cmV0dXJuIGEuYXNTZXJ2aWNlID09PSBiLmFzU2VydmljZSAmJiBpc1NhbWVTZXNzaW9uKGEuc2Vz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
