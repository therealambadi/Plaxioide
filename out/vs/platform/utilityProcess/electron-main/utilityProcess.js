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
import { MessageChannelMain, app, utilityProcess } from "electron";
import { Disposable } from "../../../base/common/lifecycle.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { ILogService } from "../../log/common/log.js";
import { StringDecoder } from "string_decoder";
import { timeout } from "../../../base/common/async.js";
import { FileAccess } from "../../../base/common/network.js";
import { IWindowsMainService } from "../../windows/electron-main/windows.js";
import Severity from "../../../base/common/severity.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { ILifecycleMainService } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { removeDangerousEnvVariables } from "../../../base/common/processes.js";
import { deepClone } from "../../../base/common/objects.js";
import { isWindows } from "../../../base/common/platform.js";
import { isUNCAccessRestrictionsDisabled, getUNCHostAllowlist } from "../../../base/node/unc.js";
function isWindowUtilityProcessConfiguration(config) {
  const candidate = config;
  return typeof candidate.responseWindowId === "number";
}
let UtilityProcess = class extends Disposable {
  constructor(logService, telemetryService, lifecycleMainService) {
    super();
    this.logService = logService;
    this.telemetryService = telemetryService;
    this.lifecycleMainService = lifecycleMainService;
    this.id = String(++UtilityProcess.ID_COUNTER);
    this._onStdout = this._register(new Emitter());
    this.onStdout = this._onStdout.event;
    this._onStderr = this._register(new Emitter());
    this.onStderr = this._onStderr.event;
    this._onMessage = this._register(new Emitter());
    this.onMessage = this._onMessage.event;
    this._onSpawn = this._register(new Emitter());
    this.onSpawn = this._onSpawn.event;
    this._onExit = this._register(new Emitter());
    this.onExit = this._onExit.event;
    this._onCrash = this._register(new Emitter());
    this.onCrash = this._onCrash.event;
    this.process = void 0;
    this.processPid = void 0;
    this.configuration = void 0;
  }
  static getAll() {
    return Array.from(UtilityProcess.all.values());
  }
  log(msg, severity) {
    let logMsg;
    if (this.configuration?.correlationId) {
      logMsg = `[UtilityProcess id: ${this.configuration?.correlationId}, type: ${this.configuration?.type}, pid: ${this.processPid ?? "<none>"}]: ${msg}`;
    } else {
      logMsg = `[UtilityProcess type: ${this.configuration?.type}, pid: ${this.processPid ?? "<none>"}]: ${msg}`;
    }
    switch (severity) {
      case Severity.Error:
        this.logService.error(logMsg);
        break;
      case Severity.Warning:
        this.logService.warn(logMsg);
        break;
      case Severity.Info:
        this.logService.trace(logMsg);
        break;
    }
  }
  validateCanStart() {
    if (this.process) {
      this.log("Cannot start utility process because it is already running...", Severity.Error);
      return false;
    }
    return true;
  }
  start(configuration) {
    const started = this.doStart(configuration);
    if (started && configuration.payload) {
      const posted = this.postMessage(configuration.payload);
      if (posted) {
        this.log("payload sent via postMessage()", Severity.Info);
      }
    }
    return started;
  }
  doStart(configuration) {
    if (!this.validateCanStart()) {
      return false;
    }
    this.configuration = configuration;
    const serviceName = `${this.configuration.type}-${this.id}`;
    const modulePath = FileAccess.asFileUri("bootstrap-fork.js").fsPath;
    const args = this.configuration.args ?? [];
    const execArgv = this.configuration.execArgv ?? [];
    const allowLoadingUnsignedLibraries = this.configuration.allowLoadingUnsignedLibraries;
    const respondToAuthRequestsFromMainProcess = this.configuration.respondToAuthRequestsFromMainProcess;
    const stdio = "pipe";
    const env = this.createEnv(configuration);
    this.log("creating new...", Severity.Info);
    this.process = utilityProcess.fork(modulePath, args, {
      serviceName,
      env,
      execArgv,
      // !!! Add `--trace-warnings` for node.js tracing !!!
      allowLoadingUnsignedLibraries,
      respondToAuthRequestsFromMainProcess,
      stdio
    });
    this.registerListeners(this.process, this.configuration, serviceName);
    return true;
  }
  createEnv(configuration) {
    const env = configuration.env ? { ...configuration.env } : { ...deepClone(process.env) };
    env["VSCODE_ESM_ENTRYPOINT"] = configuration.entryPoint;
    if (typeof configuration.parentLifecycleBound === "number") {
      env["VSCODE_PARENT_PID"] = String(configuration.parentLifecycleBound);
    }
    env["VSCODE_CRASH_REPORTER_PROCESS_TYPE"] = configuration.type;
    if (isWindows) {
      if (isUNCAccessRestrictionsDisabled()) {
        env["NODE_DISABLE_UNC_ACCESS_CHECKS"] = "1";
      } else {
        env["NODE_UNC_HOST_ALLOWLIST"] = getUNCHostAllowlist().join("\\");
      }
    }
    removeDangerousEnvVariables(env);
    for (const key of Object.keys(env)) {
      env[key] = String(env[key]);
    }
    return env;
  }
  registerListeners(process2, configuration, serviceName) {
    if (process2.stdout) {
      const stdoutDecoder = new StringDecoder("utf-8");
      this._register(Event.fromNodeEventEmitter(process2.stdout, "data")((chunk) => this._onStdout.fire(typeof chunk === "string" ? chunk : stdoutDecoder.write(chunk))));
    }
    if (process2.stderr) {
      const stderrDecoder = new StringDecoder("utf-8");
      this._register(Event.fromNodeEventEmitter(process2.stderr, "data")((chunk) => this._onStderr.fire(typeof chunk === "string" ? chunk : stderrDecoder.write(chunk))));
    }
    this._register(Event.fromNodeEventEmitter(process2, "message")((msg) => this._onMessage.fire(msg)));
    this._register(Event.fromNodeEventEmitter(process2, "spawn")(() => {
      this.processPid = process2.pid;
      if (typeof process2.pid === "number") {
        UtilityProcess.all.set(process2.pid, { pid: process2.pid, name: isWindowUtilityProcessConfiguration(configuration) ? `${configuration.type} [${configuration.responseWindowId}]` : configuration.type });
      }
      this.log("successfully created", Severity.Info);
      this._onSpawn.fire(process2.pid);
    }));
    this._register(Event.fromNodeEventEmitter(process2, "exit")((code) => {
      this.log(`received exit event with code ${code}`, Severity.Info);
      this._onExit.fire({ pid: this.processPid, code, signal: "unknown" });
      this.onDidExitOrCrashOrKill();
    }));
    this._register(Event.fromNodeEventEmitter(process2, "error", (type, location, report) => ({ type, location, report }))(({ type, location, report }) => {
      this.log(`crashed due to ${type} from V8 at ${location}`, Severity.Info);
      let addons = [];
      try {
        const reportJSON = JSON.parse(report);
        addons = reportJSON.sharedObjects.filter((sharedObject) => sharedObject.endsWith(".node")).map((addon) => {
          const index = addon.indexOf("extensions") === -1 ? addon.indexOf("node_modules") : addon.indexOf("extensions");
          return addon.substring(index);
        });
      } catch (e) {
      }
      this.telemetryService.publicLog2("utilityprocessv8error", {
        processtype: configuration.type,
        error: type,
        location,
        addons
      });
    }));
    this._register(Event.fromNodeEventEmitter(app, "child-process-gone", (event, details) => ({ event, details }))(({ details }) => {
      if (details.type === "Utility" && details.name === serviceName) {
        this.log(`crashed with code ${details.exitCode} and reason '${details.reason}'`, Severity.Error);
        this.telemetryService.publicLog2("utilityprocesscrash", {
          type: configuration.type,
          reason: details.reason,
          code: details.exitCode
        });
        this._onCrash.fire({ pid: this.processPid, code: details.exitCode, reason: details.reason });
        this.onDidExitOrCrashOrKill();
      }
    }));
  }
  once(message, callback) {
    const disposable = this._register(this._onMessage.event((msg) => {
      if (msg === message) {
        disposable.dispose();
        callback();
      }
    }));
  }
  postMessage(message, transfer) {
    if (!this.process) {
      return false;
    }
    this.process.postMessage(message, transfer);
    return true;
  }
  connect(payload) {
    const { port1: outPort, port2: utilityProcessPort } = new MessageChannelMain();
    this.postMessage(payload, [utilityProcessPort]);
    return outPort;
  }
  enableInspectPort() {
    if (!this.process || typeof this.processPid !== "number") {
      return false;
    }
    this.log("enabling inspect port", Severity.Info);
    const processExt = process;
    if (typeof processExt._debugProcess === "function") {
      processExt._debugProcess(this.processPid);
      return true;
    }
    return false;
  }
  kill() {
    if (!this.process) {
      return;
    }
    this.log("attempting to kill the process...", Severity.Info);
    const killed = this.process.kill();
    if (killed) {
      this.log("successfully killed the process", Severity.Info);
      this.onDidExitOrCrashOrKill();
    } else {
      this.log("unable to kill the process", Severity.Warning);
    }
  }
  onDidExitOrCrashOrKill() {
    if (typeof this.processPid === "number") {
      UtilityProcess.all.delete(this.processPid);
    }
    this.process = void 0;
  }
  async waitForExit(maxWaitTimeMs) {
    if (!this.process) {
      return;
    }
    this.log("waiting to exit...", Severity.Info);
    await Promise.race([Event.toPromise(this.onExit), timeout(maxWaitTimeMs)]);
    if (this.process) {
      this.log(`did not exit within ${maxWaitTimeMs}ms, will kill it now...`, Severity.Info);
      this.kill();
    }
  }
};
UtilityProcess.ID_COUNTER = 0;
UtilityProcess.all = /* @__PURE__ */ new Map();
UtilityProcess = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, ILifecycleMainService)
], UtilityProcess);
let WindowUtilityProcess = class extends UtilityProcess {
  constructor(logService, windowsMainService, telemetryService, lifecycleMainService) {
    super(logService, telemetryService, lifecycleMainService);
    this.windowsMainService = windowsMainService;
  }
  start(configuration) {
    const responseWindow = this.windowsMainService.getWindowById(configuration.responseWindowId);
    if (!responseWindow?.win || responseWindow.win.isDestroyed() || responseWindow.win.webContents.isDestroyed()) {
      this.log("Refusing to start utility process because requesting window cannot be found or is destroyed...", Severity.Error);
      return true;
    }
    const started = super.doStart(configuration);
    if (!started) {
      return false;
    }
    this.registerWindowListeners(responseWindow.win, configuration);
    const windowPort = this.connect(configuration.payload);
    responseWindow.win.webContents.postMessage(configuration.responseChannel, configuration.responseNonce, [windowPort]);
    return true;
  }
  registerWindowListeners(window, configuration) {
    if (configuration.windowLifecycleBound) {
      this._register(Event.filter(this.lifecycleMainService.onWillLoadWindow, (e) => e.window.win === window)(() => this.kill()));
      this._register(Event.fromNodeEventEmitter(window, "closed")(() => this.kill()));
    }
  }
};
WindowUtilityProcess = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IWindowsMainService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, ILifecycleMainService)
], WindowUtilityProcess);
export {
  UtilityProcess,
  WindowUtilityProcess
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91dGlsaXR5UHJvY2Vzcy9lbGVjdHJvbi1tYWluL3V0aWxpdHlQcm9jZXNzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQnJvd3NlcldpbmRvdywgRGV0YWlscywgTWVzc2FnZUNoYW5uZWxNYWluLCBhcHAsIHV0aWxpdHlQcm9jZXNzLCBVdGlsaXR5UHJvY2VzcyBhcyBFbGVjdHJvblV0aWxpdHlQcm9jZXNzIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgU3RyaW5nRGVjb2RlciB9IGZyb20gJ3N0cmluZ19kZWNvZGVyJztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBGaWxlQWNjZXNzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBJV2luZG93c01haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vd2luZG93cy9lbGVjdHJvbi1tYWluL3dpbmRvd3MuanMnO1xuaW1wb3J0IFNldmVyaXR5IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3NldmVyaXR5LmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZU1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbGlmZWN5Y2xlL2VsZWN0cm9uLW1haW4vbGlmZWN5Y2xlTWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgcmVtb3ZlRGFuZ2Vyb3VzRW52VmFyaWFibGVzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcHJvY2Vzc2VzLmpzJztcbmltcG9ydCB7IGRlZXBDbG9uZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgaXNVTkNBY2Nlc3NSZXN0cmljdGlvbnNEaXNhYmxlZCwgZ2V0VU5DSG9zdEFsbG93bGlzdCB9IGZyb20gJy4uLy4uLy4uL2Jhc2Uvbm9kZS91bmMuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElVdGlsaXR5UHJvY2Vzc0NvbmZpZ3VyYXRpb24ge1xuXG5cdC8qKlxuXHQgKiBBIHdheSB0byBncm91cCB1dGlsaXR5IHByb2Nlc3NlcyBvZiBzYW1lIHR5cGUgdG9nZXRoZXIuXG5cdCAqL1xuXHRyZWFkb25seSB0eXBlOiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIFRoZSBlbnRyeSBwb2ludCB0byBsb2FkIGluIHRoZSB1dGlsaXR5IHByb2Nlc3MuXG5cdCAqL1xuXHRyZWFkb25seSBlbnRyeVBvaW50OiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIEFuIG9wdGlvbmFsIHNlcmlhbGl6YWJsZSBvYmplY3QgdG8gYmUgc2VudCBpbnRvIHRoZSB1dGlsaXR5IHByb2Nlc3Ncblx0ICogYXMgZmlyc3QgbWVzc2FnZSBhbG9uZ3NpZGUgdGhlIG1lc3NhZ2UgcG9ydC5cblx0ICovXG5cdHJlYWRvbmx5IHBheWxvYWQ/OiB1bmtub3duO1xuXG5cdC8qKlxuXHQgKiBFbnZpcm9ubWVudCBrZXktdmFsdWUgcGFpcnMuIERlZmF1bHQgaXMgYHByb2Nlc3MuZW52YC5cblx0ICovXG5cdHJlYWRvbmx5IGVudj86IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkIH07XG5cblx0LyoqXG5cdCAqIExpc3Qgb2Ygc3RyaW5nIGFyZ3VtZW50cyB0aGF0IHdpbGwgYmUgYXZhaWxhYmxlIGFzIGBwcm9jZXNzLmFyZ3ZgXG5cdCAqIGluIHRoZSBjaGlsZCBwcm9jZXNzLlxuXHQgKi9cblx0cmVhZG9ubHkgYXJncz86IHN0cmluZ1tdO1xuXG5cdC8qKlxuXHQgKiBMaXN0IG9mIHN0cmluZyBhcmd1bWVudHMgcGFzc2VkIHRvIHRoZSBleGVjdXRhYmxlLlxuXHQgKi9cblx0cmVhZG9ubHkgZXhlY0FyZ3Y/OiBzdHJpbmdbXTtcblxuXHQvKipcblx0ICogQWxsb3cgdGhlIHV0aWxpdHkgcHJvY2VzcyB0byBsb2FkIHVuc2lnbmVkIGxpYnJhcmllcy5cblx0ICovXG5cdHJlYWRvbmx5IGFsbG93TG9hZGluZ1Vuc2lnbmVkTGlicmFyaWVzPzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogVXNlZCBpbiBsb2cgbWVzc2FnZXMgdG8gY29ycmVsYXRlIHRoZSBwcm9jZXNzXG5cdCAqIHdpdGggb3RoZXIgY29tcG9uZW50cy5cblx0ICovXG5cdHJlYWRvbmx5IGNvcnJlbGF0aW9uSWQ/OiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIE9wdGlvbmFsIHBpZCBvZiB0aGUgcGFyZW50IHByb2Nlc3MuIElmIHNldCwgdGhlXG5cdCAqIHV0aWxpdHkgcHJvY2VzcyB3aWxsIGJlIHRlcm1pbmF0ZWQgd2hlbiB0aGUgcGFyZW50XG5cdCAqIHByb2Nlc3MgZXhpdHMuXG5cdCAqL1xuXHRyZWFkb25seSBwYXJlbnRMaWZlY3ljbGVCb3VuZD86IG51bWJlcjtcblxuXHQvKipcblx0ICogSFRUUCA0MDEgYW5kIDQwNyByZXF1ZXN0cyBjcmVhdGVkIHZpYSBlbGVjdHJvbjpuZXQgbW9kdWxlXG5cdCAqIHdpbGwgYmUgcmVkaXJlY3RlZCB0byB0aGUgbWFpbiBwcm9jZXNzIGFuZCBjYW4gYmUgaGFuZGxlZFxuXHQgKiB2aWEgdGhlIGFwcCNsb2dpbiBldmVudC5cblx0ICovXG5cdHJlYWRvbmx5IHJlc3BvbmRUb0F1dGhSZXF1ZXN0c0Zyb21NYWluUHJvY2Vzcz86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVdpbmRvd1V0aWxpdHlQcm9jZXNzQ29uZmlndXJhdGlvbiBleHRlbmRzIElVdGlsaXR5UHJvY2Vzc0NvbmZpZ3VyYXRpb24ge1xuXG5cdC8vIC0tLSBtZXNzYWdlIHBvcnQgcmVzcG9uc2UgcmVsYXRlZFxuXG5cdHJlYWRvbmx5IHJlc3BvbnNlV2luZG93SWQ6IG51bWJlcjtcblx0cmVhZG9ubHkgcmVzcG9uc2VDaGFubmVsOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHJlc3BvbnNlTm9uY2U6IHN0cmluZztcblxuXHQvLyAtLS0gdXRpbGl0eSBwcm9jZXNzIG9wdGlvbnNcblxuXHQvKipcblx0ICogSWYgc2V0IHRvIGB0cnVlYCwgd2lsbCB0ZXJtaW5hdGUgdGhlIHV0aWxpdHkgcHJvY2Vzc1xuXHQgKiB3aGVuIHRoZSBhc3NvY2lhdGVkIGJyb3dzZXIgd2luZG93IGNsb3NlcyBvciByZWxvYWRzLlxuXHQgKi9cblx0cmVhZG9ubHkgd2luZG93TGlmZWN5Y2xlQm91bmQ/OiBib29sZWFuO1xufVxuXG5mdW5jdGlvbiBpc1dpbmRvd1V0aWxpdHlQcm9jZXNzQ29uZmlndXJhdGlvbihjb25maWc6IElVdGlsaXR5UHJvY2Vzc0NvbmZpZ3VyYXRpb24pOiBjb25maWcgaXMgSVdpbmRvd1V0aWxpdHlQcm9jZXNzQ29uZmlndXJhdGlvbiB7XG5cdGNvbnN0IGNhbmRpZGF0ZSA9IGNvbmZpZyBhcyBJV2luZG93VXRpbGl0eVByb2Nlc3NDb25maWd1cmF0aW9uO1xuXG5cdHJldHVybiB0eXBlb2YgY2FuZGlkYXRlLnJlc3BvbnNlV2luZG93SWQgPT09ICdudW1iZXInO1xufVxuXG5pbnRlcmZhY2UgSVV0aWxpdHlQcm9jZXNzRXhpdEJhc2VFdmVudCB7XG5cblx0LyoqXG5cdCAqIFRoZSBwcm9jZXNzIGlkIG9mIHRoZSBwcm9jZXNzIHRoYXQgZXhpdGVkLlxuXHQgKi9cblx0cmVhZG9ubHkgcGlkOiBudW1iZXI7XG5cblx0LyoqXG5cdCAqIFRoZSBleGl0IGNvZGUgb2YgdGhlIHByb2Nlc3MuXG5cdCAqL1xuXHRyZWFkb25seSBjb2RlOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVV0aWxpdHlQcm9jZXNzRXhpdEV2ZW50IGV4dGVuZHMgSVV0aWxpdHlQcm9jZXNzRXhpdEJhc2VFdmVudCB7XG5cblx0LyoqXG5cdCAqIFRoZSBzaWduYWwgdGhhdCBjYXVzZWQgdGhlIHByb2Nlc3MgdG8gZXhpdCBpcyB1bmtub3duXG5cdCAqIGZvciB1dGlsaXR5IHByb2Nlc3Nlcy5cblx0ICovXG5cdHJlYWRvbmx5IHNpZ25hbDogJ3Vua25vd24nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElVdGlsaXR5UHJvY2Vzc0NyYXNoRXZlbnQgZXh0ZW5kcyBJVXRpbGl0eVByb2Nlc3NFeGl0QmFzZUV2ZW50IHtcblxuXHQvKipcblx0ICogVGhlIHJlYXNvbiBvZiB0aGUgdXRpbGl0eSBwcm9jZXNzIGNyYXNoLlxuXHQgKi9cblx0cmVhZG9ubHkgcmVhc29uOiAnY2xlYW4tZXhpdCcgfCAnYWJub3JtYWwtZXhpdCcgfCAna2lsbGVkJyB8ICdjcmFzaGVkJyB8ICdvb20nIHwgJ2xhdW5jaC1mYWlsZWQnIHwgJ2ludGVncml0eS1mYWlsdXJlJztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVXRpbGl0eVByb2Nlc3NJbmZvIHtcblx0cmVhZG9ubHkgcGlkOiBudW1iZXI7XG5cdHJlYWRvbmx5IG5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFV0aWxpdHlQcm9jZXNzIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgSURfQ09VTlRFUiA9IDA7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgYWxsID0gbmV3IE1hcDxudW1iZXIsIElVdGlsaXR5UHJvY2Vzc0luZm8+KCk7XG5cdHN0YXRpYyBnZXRBbGwoKTogSVV0aWxpdHlQcm9jZXNzSW5mb1tdIHtcblx0XHRyZXR1cm4gQXJyYXkuZnJvbShVdGlsaXR5UHJvY2Vzcy5hbGwudmFsdWVzKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBpZCA9IFN0cmluZygrK1V0aWxpdHlQcm9jZXNzLklEX0NPVU5URVIpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uU3Rkb3V0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8c3RyaW5nPigpKTtcblx0cmVhZG9ubHkgb25TdGRvdXQgPSB0aGlzLl9vblN0ZG91dC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vblN0ZGVyciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHN0cmluZz4oKSk7XG5cdHJlYWRvbmx5IG9uU3RkZXJyID0gdGhpcy5fb25TdGRlcnIuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25NZXNzYWdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dW5rbm93bj4oKSk7XG5cdHJlYWRvbmx5IG9uTWVzc2FnZSA9IHRoaXMuX29uTWVzc2FnZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vblNwYXduID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8bnVtYmVyIHwgdW5kZWZpbmVkPigpKTtcblx0cmVhZG9ubHkgb25TcGF3biA9IHRoaXMuX29uU3Bhd24uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25FeGl0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVV0aWxpdHlQcm9jZXNzRXhpdEV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25FeGl0ID0gdGhpcy5fb25FeGl0LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uQ3Jhc2ggPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVXRpbGl0eVByb2Nlc3NDcmFzaEV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25DcmFzaCA9IHRoaXMuX29uQ3Jhc2guZXZlbnQ7XG5cblx0cHJpdmF0ZSBwcm9jZXNzOiBFbGVjdHJvblV0aWxpdHlQcm9jZXNzIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIHByb2Nlc3NQaWQ6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBjb25maWd1cmF0aW9uOiBJVXRpbGl0eVByb2Nlc3NDb25maWd1cmF0aW9uIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlTWFpblNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGxpZmVjeWNsZU1haW5TZXJ2aWNlOiBJTGlmZWN5Y2xlTWFpblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBsb2cobXNnOiBzdHJpbmcsIHNldmVyaXR5OiBTZXZlcml0eSk6IHZvaWQge1xuXHRcdGxldCBsb2dNc2c6IHN0cmluZztcblx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uPy5jb3JyZWxhdGlvbklkKSB7XG5cdFx0XHRsb2dNc2cgPSBgW1V0aWxpdHlQcm9jZXNzIGlkOiAke3RoaXMuY29uZmlndXJhdGlvbj8uY29ycmVsYXRpb25JZH0sIHR5cGU6ICR7dGhpcy5jb25maWd1cmF0aW9uPy50eXBlfSwgcGlkOiAke3RoaXMucHJvY2Vzc1BpZCA/PyAnPG5vbmU+J31dOiAke21zZ31gO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRsb2dNc2cgPSBgW1V0aWxpdHlQcm9jZXNzIHR5cGU6ICR7dGhpcy5jb25maWd1cmF0aW9uPy50eXBlfSwgcGlkOiAke3RoaXMucHJvY2Vzc1BpZCA/PyAnPG5vbmU+J31dOiAke21zZ31gO1xuXHRcdH1cblxuXHRcdHN3aXRjaCAoc2V2ZXJpdHkpIHtcblx0XHRcdGNhc2UgU2V2ZXJpdHkuRXJyb3I6XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihsb2dNc2cpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgU2V2ZXJpdHkuV2FybmluZzpcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLndhcm4obG9nTXNnKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFNldmVyaXR5LkluZm86XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShsb2dNc2cpO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHZhbGlkYXRlQ2FuU3RhcnQoKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMucHJvY2Vzcykge1xuXHRcdFx0dGhpcy5sb2coJ0Nhbm5vdCBzdGFydCB1dGlsaXR5IHByb2Nlc3MgYmVjYXVzZSBpdCBpcyBhbHJlYWR5IHJ1bm5pbmcuLi4nLCBTZXZlcml0eS5FcnJvcik7XG5cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHN0YXJ0KGNvbmZpZ3VyYXRpb246IElVdGlsaXR5UHJvY2Vzc0NvbmZpZ3VyYXRpb24pOiBib29sZWFuIHtcblx0XHRjb25zdCBzdGFydGVkID0gdGhpcy5kb1N0YXJ0KGNvbmZpZ3VyYXRpb24pO1xuXG5cdFx0aWYgKHN0YXJ0ZWQgJiYgY29uZmlndXJhdGlvbi5wYXlsb2FkKSB7XG5cdFx0XHRjb25zdCBwb3N0ZWQgPSB0aGlzLnBvc3RNZXNzYWdlKGNvbmZpZ3VyYXRpb24ucGF5bG9hZCk7XG5cdFx0XHRpZiAocG9zdGVkKSB7XG5cdFx0XHRcdHRoaXMubG9nKCdwYXlsb2FkIHNlbnQgdmlhIHBvc3RNZXNzYWdlKCknLCBTZXZlcml0eS5JbmZvKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gc3RhcnRlZDtcblx0fVxuXG5cdHByb3RlY3RlZCBkb1N0YXJ0KGNvbmZpZ3VyYXRpb246IElVdGlsaXR5UHJvY2Vzc0NvbmZpZ3VyYXRpb24pOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMudmFsaWRhdGVDYW5TdGFydCgpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0dGhpcy5jb25maWd1cmF0aW9uID0gY29uZmlndXJhdGlvbjtcblxuXHRcdGNvbnN0IHNlcnZpY2VOYW1lID0gYCR7dGhpcy5jb25maWd1cmF0aW9uLnR5cGV9LSR7dGhpcy5pZH1gO1xuXHRcdGNvbnN0IG1vZHVsZVBhdGggPSBGaWxlQWNjZXNzLmFzRmlsZVVyaSgnYm9vdHN0cmFwLWZvcmsuanMnKS5mc1BhdGg7XG5cdFx0Y29uc3QgYXJncyA9IHRoaXMuY29uZmlndXJhdGlvbi5hcmdzID8/IFtdO1xuXHRcdGNvbnN0IGV4ZWNBcmd2ID0gdGhpcy5jb25maWd1cmF0aW9uLmV4ZWNBcmd2ID8/IFtdO1xuXHRcdGNvbnN0IGFsbG93TG9hZGluZ1Vuc2lnbmVkTGlicmFyaWVzID0gdGhpcy5jb25maWd1cmF0aW9uLmFsbG93TG9hZGluZ1Vuc2lnbmVkTGlicmFyaWVzO1xuXHRcdGNvbnN0IHJlc3BvbmRUb0F1dGhSZXF1ZXN0c0Zyb21NYWluUHJvY2VzcyA9IHRoaXMuY29uZmlndXJhdGlvbi5yZXNwb25kVG9BdXRoUmVxdWVzdHNGcm9tTWFpblByb2Nlc3M7XG5cdFx0Y29uc3Qgc3RkaW8gPSAncGlwZSc7XG5cdFx0Y29uc3QgZW52ID0gdGhpcy5jcmVhdGVFbnYoY29uZmlndXJhdGlvbik7XG5cblx0XHR0aGlzLmxvZygnY3JlYXRpbmcgbmV3Li4uJywgU2V2ZXJpdHkuSW5mbyk7XG5cblx0XHQvLyBGb3JrIHV0aWxpdHkgcHJvY2Vzc1xuXHRcdHRoaXMucHJvY2VzcyA9IHV0aWxpdHlQcm9jZXNzLmZvcmsobW9kdWxlUGF0aCwgYXJncywge1xuXHRcdFx0c2VydmljZU5hbWUsXG5cdFx0XHRlbnYsXG5cdFx0XHRleGVjQXJndiwgLy8gISEhIEFkZCBgLS10cmFjZS13YXJuaW5nc2AgZm9yIG5vZGUuanMgdHJhY2luZyAhISFcblx0XHRcdGFsbG93TG9hZGluZ1Vuc2lnbmVkTGlicmFyaWVzLFxuXHRcdFx0cmVzcG9uZFRvQXV0aFJlcXVlc3RzRnJvbU1haW5Qcm9jZXNzLFxuXHRcdFx0c3RkaW9cblx0XHR9KTtcblxuXHRcdC8vIFJlZ2lzdGVyIHRvIGV2ZW50c1xuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnModGhpcy5wcm9jZXNzLCB0aGlzLmNvbmZpZ3VyYXRpb24sIHNlcnZpY2VOYW1lKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVFbnYoY29uZmlndXJhdGlvbjogSVV0aWxpdHlQcm9jZXNzQ29uZmlndXJhdGlvbik6IHsgW2tleTogc3RyaW5nXTogYW55IH0ge1xuXHRcdGNvbnN0IGVudjogeyBba2V5OiBzdHJpbmddOiBhbnkgfSA9IGNvbmZpZ3VyYXRpb24uZW52ID8geyAuLi5jb25maWd1cmF0aW9uLmVudiB9IDogeyAuLi5kZWVwQ2xvbmUocHJvY2Vzcy5lbnYpIH07XG5cblx0XHQvLyBBcHBseSBzdXBwb3J0ZWQgZW52aXJvbm1lbnQgdmFyaWFibGVzIGZyb20gY29uZmlnXG5cdFx0ZW52WydWU0NPREVfRVNNX0VOVFJZUE9JTlQnXSA9IGNvbmZpZ3VyYXRpb24uZW50cnlQb2ludDtcblx0XHRpZiAodHlwZW9mIGNvbmZpZ3VyYXRpb24ucGFyZW50TGlmZWN5Y2xlQm91bmQgPT09ICdudW1iZXInKSB7XG5cdFx0XHRlbnZbJ1ZTQ09ERV9QQVJFTlRfUElEJ10gPSBTdHJpbmcoY29uZmlndXJhdGlvbi5wYXJlbnRMaWZlY3ljbGVCb3VuZCk7XG5cdFx0fVxuXHRcdGVudlsnVlNDT0RFX0NSQVNIX1JFUE9SVEVSX1BST0NFU1NfVFlQRSddID0gY29uZmlndXJhdGlvbi50eXBlO1xuXHRcdGlmIChpc1dpbmRvd3MpIHtcblx0XHRcdGlmIChpc1VOQ0FjY2Vzc1Jlc3RyaWN0aW9uc0Rpc2FibGVkKCkpIHtcblx0XHRcdFx0ZW52WydOT0RFX0RJU0FCTEVfVU5DX0FDQ0VTU19DSEVDS1MnXSA9ICcxJztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGVudlsnTk9ERV9VTkNfSE9TVF9BTExPV0xJU1QnXSA9IGdldFVOQ0hvc3RBbGxvd2xpc3QoKS5qb2luKCdcXFxcJyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gUmVtb3ZlIGFueSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgdGhhdCBhcmUgbm90IGFsbG93ZWRcblx0XHRyZW1vdmVEYW5nZXJvdXNFbnZWYXJpYWJsZXMoZW52KTtcblxuXHRcdC8vIEVuc3VyZSBhbGwgdmFsdWVzIGFyZSBzdHJpbmdzLCBvdGhlcndpc2UgdGhlIHByb2Nlc3Mgd2lsbCBub3Qgc3RhcnRcblx0XHRmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhlbnYpKSB7XG5cdFx0XHRlbnZba2V5XSA9IFN0cmluZyhlbnZba2V5XSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVudjtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMocHJvY2VzczogRWxlY3Ryb25VdGlsaXR5UHJvY2VzcywgY29uZmlndXJhdGlvbjogSVV0aWxpdHlQcm9jZXNzQ29uZmlndXJhdGlvbiwgc2VydmljZU5hbWU6IHN0cmluZyk6IHZvaWQge1xuXG5cdFx0Ly8gU3Rkb3V0XG5cdFx0aWYgKHByb2Nlc3Muc3Rkb3V0KSB7XG5cdFx0XHRjb25zdCBzdGRvdXREZWNvZGVyID0gbmV3IFN0cmluZ0RlY29kZXIoJ3V0Zi04Jyk7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5mcm9tTm9kZUV2ZW50RW1pdHRlcjxzdHJpbmcgfCBCdWZmZXI+KHByb2Nlc3Muc3Rkb3V0LCAnZGF0YScpKGNodW5rID0+IHRoaXMuX29uU3Rkb3V0LmZpcmUodHlwZW9mIGNodW5rID09PSAnc3RyaW5nJyA/IGNodW5rIDogc3Rkb3V0RGVjb2Rlci53cml0ZShjaHVuaykpKSk7XG5cdFx0fVxuXG5cdFx0Ly8gU3RkZXJyXG5cdFx0aWYgKHByb2Nlc3Muc3RkZXJyKSB7XG5cdFx0XHRjb25zdCBzdGRlcnJEZWNvZGVyID0gbmV3IFN0cmluZ0RlY29kZXIoJ3V0Zi04Jyk7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5mcm9tTm9kZUV2ZW50RW1pdHRlcjxzdHJpbmcgfCBCdWZmZXI+KHByb2Nlc3Muc3RkZXJyLCAnZGF0YScpKGNodW5rID0+IHRoaXMuX29uU3RkZXJyLmZpcmUodHlwZW9mIGNodW5rID09PSAnc3RyaW5nJyA/IGNodW5rIDogc3RkZXJyRGVjb2Rlci53cml0ZShjaHVuaykpKSk7XG5cdFx0fVxuXG5cdFx0Ly8gTWVzc2FnZXNcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5mcm9tTm9kZUV2ZW50RW1pdHRlcihwcm9jZXNzLCAnbWVzc2FnZScpKG1zZyA9PiB0aGlzLl9vbk1lc3NhZ2UuZmlyZShtc2cpKSk7XG5cblx0XHQvLyBTcGF3blxuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmZyb21Ob2RlRXZlbnRFbWl0dGVyPHZvaWQ+KHByb2Nlc3MsICdzcGF3bicpKCgpID0+IHtcblx0XHRcdHRoaXMucHJvY2Vzc1BpZCA9IHByb2Nlc3MucGlkO1xuXG5cdFx0XHRpZiAodHlwZW9mIHByb2Nlc3MucGlkID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRVdGlsaXR5UHJvY2Vzcy5hbGwuc2V0KHByb2Nlc3MucGlkLCB7IHBpZDogcHJvY2Vzcy5waWQsIG5hbWU6IGlzV2luZG93VXRpbGl0eVByb2Nlc3NDb25maWd1cmF0aW9uKGNvbmZpZ3VyYXRpb24pID8gYCR7Y29uZmlndXJhdGlvbi50eXBlfSBbJHtjb25maWd1cmF0aW9uLnJlc3BvbnNlV2luZG93SWR9XWAgOiBjb25maWd1cmF0aW9uLnR5cGUgfSk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMubG9nKCdzdWNjZXNzZnVsbHkgY3JlYXRlZCcsIFNldmVyaXR5LkluZm8pO1xuXHRcdFx0dGhpcy5fb25TcGF3bi5maXJlKHByb2Nlc3MucGlkKTtcblx0XHR9KSk7XG5cblx0XHQvLyBFeGl0XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuZnJvbU5vZGVFdmVudEVtaXR0ZXI8bnVtYmVyPihwcm9jZXNzLCAnZXhpdCcpKGNvZGUgPT4ge1xuXHRcdFx0dGhpcy5sb2coYHJlY2VpdmVkIGV4aXQgZXZlbnQgd2l0aCBjb2RlICR7Y29kZX1gLCBTZXZlcml0eS5JbmZvKTtcblxuXHRcdFx0Ly8gRXZlbnRcblx0XHRcdHRoaXMuX29uRXhpdC5maXJlKHsgcGlkOiB0aGlzLnByb2Nlc3NQaWQhLCBjb2RlLCBzaWduYWw6ICd1bmtub3duJyB9KTtcblxuXHRcdFx0Ly8gQ2xlYW51cFxuXHRcdFx0dGhpcy5vbkRpZEV4aXRPckNyYXNoT3JLaWxsKCk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gVjggRXJyb3Jcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5mcm9tTm9kZUV2ZW50RW1pdHRlcihwcm9jZXNzLCAnZXJyb3InLCAodHlwZSwgbG9jYXRpb24sIHJlcG9ydCkgPT4gKHsgdHlwZSwgbG9jYXRpb24sIHJlcG9ydCB9KSkoKHsgdHlwZSwgbG9jYXRpb24sIHJlcG9ydCB9KSA9PiB7XG5cdFx0XHR0aGlzLmxvZyhgY3Jhc2hlZCBkdWUgdG8gJHt0eXBlfSBmcm9tIFY4IGF0ICR7bG9jYXRpb259YCwgU2V2ZXJpdHkuSW5mbyk7XG5cblx0XHRcdGxldCBhZGRvbnM6IHN0cmluZ1tdID0gW107XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCByZXBvcnRKU09OID0gSlNPTi5wYXJzZShyZXBvcnQpO1xuXHRcdFx0XHRhZGRvbnMgPSByZXBvcnRKU09OLnNoYXJlZE9iamVjdHNcblx0XHRcdFx0XHQuZmlsdGVyKChzaGFyZWRPYmplY3Q6IHN0cmluZykgPT4gc2hhcmVkT2JqZWN0LmVuZHNXaXRoKCcubm9kZScpKVxuXHRcdFx0XHRcdC5tYXAoKGFkZG9uOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGluZGV4ID0gYWRkb24uaW5kZXhPZignZXh0ZW5zaW9ucycpID09PSAtMSA/IGFkZG9uLmluZGV4T2YoJ25vZGVfbW9kdWxlcycpIDogYWRkb24uaW5kZXhPZignZXh0ZW5zaW9ucycpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIGFkZG9uLnN1YnN0cmluZyhpbmRleCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdC8vIGlnbm9yZVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBUZWxlbWV0cnlcblx0XHRcdHR5cGUgVXRpbGl0eVByb2Nlc3NWOEVycm9yQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRcdHByb2Nlc3N0eXBlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIHR5cGUgb2YgdXRpbGl0eSBwcm9jZXNzIHRvIHVuZGVyc3RhbmQgdGhlIG9yaWdpbiBvZiB0aGUgY3Jhc2ggYmV0dGVyLicgfTtcblx0XHRcdFx0ZXJyb3I6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgdHlwZSBvZiBlcnJvciBmcm9tIHRoZSB1dGlsaXR5IHByb2Nlc3MgdG8gdW5kZXJzdGFuZCB0aGUgbmF0dXJlIG9mIHRoZSBjcmFzaCBiZXR0ZXIuJyB9O1xuXHRcdFx0XHRsb2NhdGlvbjogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSBzb3VyY2UgbG9jYXRpb24gdGhhdCB0cmlnZ2VyZWQgdGhlIGNyYXNoIHRvIHVuZGVyc3RhbmQgdGhlIG5hdHVyZSBvZiB0aGUgY3Jhc2ggYmV0dGVyLicgfTtcblx0XHRcdFx0YWRkb25zOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIGxpc3Qgb2YgYWRkb25zIGxvYWRlZCBpbiB0aGUgdXRpbGl0eSBwcm9jZXNzIHRvIHVuZGVyc3RhbmQgdGhlIG5hdHVyZSBvZiB0aGUgY3Jhc2ggYmV0dGVyJyB9O1xuXHRcdFx0XHRvd25lcjogJ2RlZXBhazE1NTYnO1xuXHRcdFx0XHRjb21tZW50OiAnUHJvdmlkZXMgaW5zaWdodCBpbnRvIFY4IHNhbmRib3ggRkFUQUwgZXJyb3IgY2F1c2VkIGJ5IG5hdGl2ZSBhZGRvbnMuJztcblx0XHRcdH07XG5cdFx0XHR0eXBlIFV0aWxpdHlQcm9jZXNzVjhFcnJvckV2ZW50ID0ge1xuXHRcdFx0XHRwcm9jZXNzdHlwZTogc3RyaW5nO1xuXHRcdFx0XHRlcnJvcjogc3RyaW5nO1xuXHRcdFx0XHRsb2NhdGlvbjogc3RyaW5nO1xuXHRcdFx0XHRhZGRvbnM6IHN0cmluZ1tdO1xuXHRcdFx0fTtcblx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFV0aWxpdHlQcm9jZXNzVjhFcnJvckV2ZW50LCBVdGlsaXR5UHJvY2Vzc1Y4RXJyb3JDbGFzc2lmaWNhdGlvbj4oJ3V0aWxpdHlwcm9jZXNzdjhlcnJvcicsIHtcblx0XHRcdFx0cHJvY2Vzc3R5cGU6IGNvbmZpZ3VyYXRpb24udHlwZSxcblx0XHRcdFx0ZXJyb3I6IHR5cGUsXG5cdFx0XHRcdGxvY2F0aW9uLFxuXHRcdFx0XHRhZGRvbnNcblx0XHRcdH0pO1xuXHRcdH0pKTtcblxuXHRcdC8vIENoaWxkIHByb2Nlc3MgZ29uZVxuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmZyb21Ob2RlRXZlbnRFbWl0dGVyPHsgZGV0YWlsczogRGV0YWlscyB9PihhcHAsICdjaGlsZC1wcm9jZXNzLWdvbmUnLCAoZXZlbnQsIGRldGFpbHMpID0+ICh7IGV2ZW50LCBkZXRhaWxzIH0pKSgoeyBkZXRhaWxzIH0pID0+IHtcblx0XHRcdGlmIChkZXRhaWxzLnR5cGUgPT09ICdVdGlsaXR5JyAmJiBkZXRhaWxzLm5hbWUgPT09IHNlcnZpY2VOYW1lKSB7XG5cdFx0XHRcdHRoaXMubG9nKGBjcmFzaGVkIHdpdGggY29kZSAke2RldGFpbHMuZXhpdENvZGV9IGFuZCByZWFzb24gJyR7ZGV0YWlscy5yZWFzb259J2AsIFNldmVyaXR5LkVycm9yKTtcblxuXHRcdFx0XHQvLyBUZWxlbWV0cnlcblx0XHRcdFx0dHlwZSBVdGlsaXR5UHJvY2Vzc0NyYXNoQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRcdFx0dHlwZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSB0eXBlIG9mIHV0aWxpdHkgcHJvY2VzcyB0byB1bmRlcnN0YW5kIHRoZSBvcmlnaW4gb2YgdGhlIGNyYXNoIGJldHRlci4nIH07XG5cdFx0XHRcdFx0cmVhc29uOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIHJlYXNvbiBvZiB0aGUgdXRpbGl0eSBwcm9jZXNzIGNyYXNoIHRvIHVuZGVyc3RhbmQgdGhlIG5hdHVyZSBvZiB0aGUgY3Jhc2ggYmV0dGVyLicgfTtcblx0XHRcdFx0XHRjb2RlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIGV4aXQgY29kZSBvZiB0aGUgdXRpbGl0eSBwcm9jZXNzIHRvIHVuZGVyc3RhbmQgdGhlIG5hdHVyZSBvZiB0aGUgY3Jhc2ggYmV0dGVyJyB9O1xuXHRcdFx0XHRcdG93bmVyOiAnYnBhc2Vybyc7XG5cdFx0XHRcdFx0Y29tbWVudDogJ1Byb3ZpZGVzIGluc2lnaHQgaW50byByZWFzb25zIHRoZSB1dGlsaXR5IHByb2Nlc3MgY3Jhc2hlZC4nO1xuXHRcdFx0XHR9O1xuXHRcdFx0XHR0eXBlIFV0aWxpdHlQcm9jZXNzQ3Jhc2hFdmVudCA9IHtcblx0XHRcdFx0XHR0eXBlOiBzdHJpbmc7XG5cdFx0XHRcdFx0cmVhc29uOiBzdHJpbmc7XG5cdFx0XHRcdFx0Y29kZTogbnVtYmVyO1xuXHRcdFx0XHR9O1xuXHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxVdGlsaXR5UHJvY2Vzc0NyYXNoRXZlbnQsIFV0aWxpdHlQcm9jZXNzQ3Jhc2hDbGFzc2lmaWNhdGlvbj4oJ3V0aWxpdHlwcm9jZXNzY3Jhc2gnLCB7XG5cdFx0XHRcdFx0dHlwZTogY29uZmlndXJhdGlvbi50eXBlLFxuXHRcdFx0XHRcdHJlYXNvbjogZGV0YWlscy5yZWFzb24sXG5cdFx0XHRcdFx0Y29kZTogZGV0YWlscy5leGl0Q29kZVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHQvLyBFdmVudFxuXHRcdFx0XHR0aGlzLl9vbkNyYXNoLmZpcmUoeyBwaWQ6IHRoaXMucHJvY2Vzc1BpZCEsIGNvZGU6IGRldGFpbHMuZXhpdENvZGUsIHJlYXNvbjogZGV0YWlscy5yZWFzb24gfSk7XG5cblx0XHRcdFx0Ly8gQ2xlYW51cFxuXHRcdFx0XHR0aGlzLm9uRGlkRXhpdE9yQ3Jhc2hPcktpbGwoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRvbmNlKG1lc3NhZ2U6IHVua25vd24sIGNhbGxiYWNrOiAoKSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX29uTWVzc2FnZS5ldmVudChtc2cgPT4ge1xuXHRcdFx0aWYgKG1zZyA9PT0gbWVzc2FnZSkge1xuXHRcdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblxuXHRcdFx0XHRjYWxsYmFjaygpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHBvc3RNZXNzYWdlKG1lc3NhZ2U6IHVua25vd24sIHRyYW5zZmVyPzogRWxlY3Ryb24uTWVzc2FnZVBvcnRNYWluW10pOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMucHJvY2Vzcykge1xuXHRcdFx0cmV0dXJuIGZhbHNlOyAvLyBhbHJlYWR5IGtpbGxlZCwgY3Jhc2hlZCBvciBuZXZlciBzdGFydGVkXG5cdFx0fVxuXG5cdFx0dGhpcy5wcm9jZXNzLnBvc3RNZXNzYWdlKG1lc3NhZ2UsIHRyYW5zZmVyKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0Y29ubmVjdChwYXlsb2FkPzogdW5rbm93bik6IEVsZWN0cm9uLk1lc3NhZ2VQb3J0TWFpbiB7XG5cdFx0Y29uc3QgeyBwb3J0MTogb3V0UG9ydCwgcG9ydDI6IHV0aWxpdHlQcm9jZXNzUG9ydCB9ID0gbmV3IE1lc3NhZ2VDaGFubmVsTWFpbigpO1xuXHRcdHRoaXMucG9zdE1lc3NhZ2UocGF5bG9hZCwgW3V0aWxpdHlQcm9jZXNzUG9ydF0pO1xuXG5cdFx0cmV0dXJuIG91dFBvcnQ7XG5cdH1cblxuXHRlbmFibGVJbnNwZWN0UG9ydCgpOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMucHJvY2VzcyB8fCB0eXBlb2YgdGhpcy5wcm9jZXNzUGlkICE9PSAnbnVtYmVyJykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHRoaXMubG9nKCdlbmFibGluZyBpbnNwZWN0IHBvcnQnLCBTZXZlcml0eS5JbmZvKTtcblxuXHRcdGludGVyZmFjZSBQcm9jZXNzRXh0IHtcblx0XHRcdF9kZWJ1Z1Byb2Nlc3M/KHBpZDogbnVtYmVyKTogdW5rbm93bjtcblx0XHR9XG5cblx0XHQvLyB1c2UgKHVuZG9jdW1lbnRlZCkgX2RlYnVnUHJvY2VzcyBmZWF0dXJlIG9mIG5vZGUgaWYgYXZhaWxhYmxlXG5cdFx0Y29uc3QgcHJvY2Vzc0V4dCA9IDxQcm9jZXNzRXh0PnByb2Nlc3M7XG5cdFx0aWYgKHR5cGVvZiBwcm9jZXNzRXh0Ll9kZWJ1Z1Byb2Nlc3MgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHByb2Nlc3NFeHQuX2RlYnVnUHJvY2Vzcyh0aGlzLnByb2Nlc3NQaWQpO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBub3Qgc3VwcG9ydGVkLi4uXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0a2lsbCgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMucHJvY2Vzcykge1xuXHRcdFx0cmV0dXJuOyAvLyBhbHJlYWR5IGtpbGxlZCwgY3Jhc2hlZCBvciBuZXZlciBzdGFydGVkXG5cdFx0fVxuXG5cdFx0dGhpcy5sb2coJ2F0dGVtcHRpbmcgdG8ga2lsbCB0aGUgcHJvY2Vzcy4uLicsIFNldmVyaXR5LkluZm8pO1xuXHRcdGNvbnN0IGtpbGxlZCA9IHRoaXMucHJvY2Vzcy5raWxsKCk7XG5cdFx0aWYgKGtpbGxlZCkge1xuXHRcdFx0dGhpcy5sb2coJ3N1Y2Nlc3NmdWxseSBraWxsZWQgdGhlIHByb2Nlc3MnLCBTZXZlcml0eS5JbmZvKTtcblx0XHRcdHRoaXMub25EaWRFeGl0T3JDcmFzaE9yS2lsbCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmxvZygndW5hYmxlIHRvIGtpbGwgdGhlIHByb2Nlc3MnLCBTZXZlcml0eS5XYXJuaW5nKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkRXhpdE9yQ3Jhc2hPcktpbGwoKTogdm9pZCB7XG5cdFx0aWYgKHR5cGVvZiB0aGlzLnByb2Nlc3NQaWQgPT09ICdudW1iZXInKSB7XG5cdFx0XHRVdGlsaXR5UHJvY2Vzcy5hbGwuZGVsZXRlKHRoaXMucHJvY2Vzc1BpZCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5wcm9jZXNzID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0YXN5bmMgd2FpdEZvckV4aXQobWF4V2FpdFRpbWVNczogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLnByb2Nlc3MpIHtcblx0XHRcdHJldHVybjsgLy8gYWxyZWFkeSBraWxsZWQsIGNyYXNoZWQgb3IgbmV2ZXIgc3RhcnRlZFxuXHRcdH1cblxuXHRcdHRoaXMubG9nKCd3YWl0aW5nIHRvIGV4aXQuLi4nLCBTZXZlcml0eS5JbmZvKTtcblx0XHRhd2FpdCBQcm9taXNlLnJhY2UoW0V2ZW50LnRvUHJvbWlzZSh0aGlzLm9uRXhpdCksIHRpbWVvdXQobWF4V2FpdFRpbWVNcyldKTtcblxuXHRcdGlmICh0aGlzLnByb2Nlc3MpIHtcblx0XHRcdHRoaXMubG9nKGBkaWQgbm90IGV4aXQgd2l0aGluICR7bWF4V2FpdFRpbWVNc31tcywgd2lsbCBraWxsIGl0IG5vdy4uLmAsIFNldmVyaXR5LkluZm8pO1xuXHRcdFx0dGhpcy5raWxsKCk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBXaW5kb3dVdGlsaXR5UHJvY2VzcyBleHRlbmRzIFV0aWxpdHlQcm9jZXNzIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUxvZ1NlcnZpY2UgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElXaW5kb3dzTWFpblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3aW5kb3dzTWFpblNlcnZpY2U6IElXaW5kb3dzTWFpblNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlTWFpblNlcnZpY2UgbGlmZWN5Y2xlTWFpblNlcnZpY2U6IElMaWZlY3ljbGVNYWluU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihsb2dTZXJ2aWNlLCB0ZWxlbWV0cnlTZXJ2aWNlLCBsaWZlY3ljbGVNYWluU2VydmljZSk7XG5cdH1cblxuXHRvdmVycmlkZSBzdGFydChjb25maWd1cmF0aW9uOiBJV2luZG93VXRpbGl0eVByb2Nlc3NDb25maWd1cmF0aW9uKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgcmVzcG9uc2VXaW5kb3cgPSB0aGlzLndpbmRvd3NNYWluU2VydmljZS5nZXRXaW5kb3dCeUlkKGNvbmZpZ3VyYXRpb24ucmVzcG9uc2VXaW5kb3dJZCk7XG5cdFx0aWYgKCFyZXNwb25zZVdpbmRvdz8ud2luIHx8IHJlc3BvbnNlV2luZG93Lndpbi5pc0Rlc3Ryb3llZCgpIHx8IHJlc3BvbnNlV2luZG93Lndpbi53ZWJDb250ZW50cy5pc0Rlc3Ryb3llZCgpKSB7XG5cdFx0XHR0aGlzLmxvZygnUmVmdXNpbmcgdG8gc3RhcnQgdXRpbGl0eSBwcm9jZXNzIGJlY2F1c2UgcmVxdWVzdGluZyB3aW5kb3cgY2Fubm90IGJlIGZvdW5kIG9yIGlzIGRlc3Ryb3llZC4uLicsIFNldmVyaXR5LkVycm9yKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gU3RhcnQgdXRpbGl0eSBwcm9jZXNzXG5cdFx0Y29uc3Qgc3RhcnRlZCA9IHN1cGVyLmRvU3RhcnQoY29uZmlndXJhdGlvbik7XG5cdFx0aWYgKCFzdGFydGVkKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gUmVnaXN0ZXIgdG8gd2luZG93IGV2ZW50c1xuXHRcdHRoaXMucmVnaXN0ZXJXaW5kb3dMaXN0ZW5lcnMocmVzcG9uc2VXaW5kb3cud2luLCBjb25maWd1cmF0aW9uKTtcblxuXHRcdC8vIEVzdGFibGlzaCAmIGV4Y2hhbmdlIG1lc3NhZ2UgcG9ydHNcblx0XHRjb25zdCB3aW5kb3dQb3J0ID0gdGhpcy5jb25uZWN0KGNvbmZpZ3VyYXRpb24ucGF5bG9hZCk7XG5cdFx0cmVzcG9uc2VXaW5kb3cud2luLndlYkNvbnRlbnRzLnBvc3RNZXNzYWdlKGNvbmZpZ3VyYXRpb24ucmVzcG9uc2VDaGFubmVsLCBjb25maWd1cmF0aW9uLnJlc3BvbnNlTm9uY2UsIFt3aW5kb3dQb3J0XSk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJXaW5kb3dMaXN0ZW5lcnMod2luZG93OiBCcm93c2VyV2luZG93LCBjb25maWd1cmF0aW9uOiBJV2luZG93VXRpbGl0eVByb2Nlc3NDb25maWd1cmF0aW9uKTogdm9pZCB7XG5cblx0XHQvLyBJZiB0aGUgbGlmZWN5Y2xlIG9mIHRoZSB1dGlsaXR5IHByb2Nlc3MgaXMgYm91bmQgdG8gdGhlIHdpbmRvdyxcblx0XHQvLyB3ZSBraWxsIHRoZSBwcm9jZXNzIGlmIHRoZSB3aW5kb3cgY2xvc2VzIG9yIGNoYW5nZXNcblxuXHRcdGlmIChjb25maWd1cmF0aW9uLndpbmRvd0xpZmVjeWNsZUJvdW5kKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5maWx0ZXIodGhpcy5saWZlY3ljbGVNYWluU2VydmljZS5vbldpbGxMb2FkV2luZG93LCBlID0+IGUud2luZG93LndpbiA9PT0gd2luZG93KSgoKSA9PiB0aGlzLmtpbGwoKSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuZnJvbU5vZGVFdmVudEVtaXR0ZXIod2luZG93LCAnY2xvc2VkJykoKCkgPT4gdGhpcy5raWxsKCkpKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBaUMsb0JBQW9CLEtBQUssc0JBQWdFO0FBQzFILFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLDJCQUEyQjtBQUNwQyxPQUFPLGNBQWM7QUFDckIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyw2QkFBNkI7QUFDdEMs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
